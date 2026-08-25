/**
 * Enhancement layer on top of upstream @playwright/mcp's public
 * `createConnection` export. Purely additive: no upstream file is modified
 * (or even required outside of the repo root `index.js`/`playwright-core`
 * public export surface). See ENHANCEMENTS.md for the full rationale and
 * an inventory of what's kept/dropped vs. the legacy fork this replaces.
 *
 * Mechanism: `createConnection()` calls upstream's `createConnection`, then
 * intercepts the `tools/list` and `tools/call` JSON-RPC request handlers
 * registered on the returned MCP SDK `Server` by rewriting entries in its
 * private `_requestHandlers` Map. This is the single interception mechanism
 * used anywhere in this layer (no separate CLI-side monkeypatch).
 *
 * That map is a private implementation detail of `@modelcontextprotocol/sdk`,
 * not a documented API — this has broken silently twice before (see EP-1 /
 * issue #6), so on any shape mismatch we throw loudly at startup instead of
 * degrading silently.
 */
'use strict';

const { createConnection: upstreamCreateConnection } = require('../index.js');
const { enhancedToolSchemas, mergeToolSchema, injectSessionParam } = require('./tools/schemas');
const { enhanceToolResponse } = require('./tools/enhancer');
const { fileDownloadToolDefinition, handleFileDownload } = require('./tools/fileDownload');
const { browserSessionToolDefinition, handleBrowserSession } = require('./tools/browserSession');
const { extractRequestHandlers, requireHandler } = require('./utils/handlers');
const { createSessionRouter, validateSessionName, DEFAULT_SESSION_NAME } = require('./utils/sessions');

/**
 * Issue #15: the one error signature a disposed upstream backend produces on
 * every subsequent call (`ensureTab()` → `this._currentTab` is undefined
 * because `Context.dispose()` removed the browser-context "page" listener
 * while the memoized `_browserContextPromise` survived). Matched exactly —
 * a page-side TypeError from user code in browser_evaluate/run_code is
 * reported with a different, in-page stack shape, but keep the match string
 * this specific so a coincidental page error can at worst trigger one
 * harmless session rebuild + retry.
 * @param {any} result a tools/call result object
 */
function isDisposedBackendResult(result) {
  if (!result || !result.isError || !Array.isArray(result.content))
    return false;
  return result.content.some(c =>
    c && c.type === 'text' && typeof c.text === 'string' &&
    c.text.includes("Cannot read properties of undefined (reading 'waitForInitialized')"));
}

/**
 * @param {import('../config').Config} [config]
 * @param {() => Promise<import('playwright').BrowserContext>} [contextGetter]
 * @returns {Promise<import('@modelcontextprotocol/sdk/server/index.js').Server>}
 */
async function createConnection(config, contextGetter) {
  const server = await upstreamCreateConnection(config, contextGetter);
  const handlers = extractRequestHandlers(server, 'primary server');

  const originalListHandler = requireHandler(handlers, 'tools/list', 'primary server');
  const originalCallHandler = requireHandler(handlers, 'tools/call', 'primary server');

  // Capture the real client's initialize handshake (protocolVersion +
  // clientInfo) so named secondary sessions -- which never receive a real
  // `initialize` request over any transport, since they're never
  // `.connect()`-ed to one -- can synthesize a plausible one of their own.
  // See enhanced/utils/sessions.js's module doc comment for the full
  // rationale and why this is necessary at all. Purely a capture: the
  // primary's own handshake is forwarded to the original handler completely
  // unchanged, so this has zero effect on the primary/default session's
  // behavior.
  const capturedPrimaryInit = { protocolVersion: undefined, clientInfo: undefined };
  const originalInitializeHandler = handlers.get('initialize');
  if (typeof originalInitializeHandler === 'function') {
    handlers.set('initialize', async (request, extra) => {
      const params = request && request.params;
      if (params) {
        capturedPrimaryInit.protocolVersion = params.protocolVersion;
        capturedPrimaryInit.clientInfo = params.clientInfo;
      }
      return originalInitializeHandler(request, extra);
    });
  } else {
    process.stderr.write(
      '[playwright-mcp enhanced] WARNING: primary server did not register an "initialize" request handler; ' +
      'named secondary sessions will use a hardcoded fallback clientInfo instead of mirroring the real ' +
      'client\'s. This only affects cosmetic identity information upstream\'s backend factory receives, not ' +
      'correctness of the primary/default session.\n'
    );
  }

  const sessionRouter = createSessionRouter({
    primaryServer: server,
    primaryListHandler: originalListHandler,
    primaryCallHandler: originalCallHandler,
    baseConfig: config,
    upstreamCreateConnection,
    getCapturedPrimaryInit: () => capturedPrimaryInit,
    // Issue #15: a default-session rebuild after browser_close recreates the
    // upstream connection with the exact same embedding hook it started with.
    primaryContextGetter: contextGetter,
  });

  handlers.set('tools/list', async (request, extra) => {
    const result = await originalListHandler(request, extra);
    if (result && Array.isArray(result.tools)) {
      result.tools = result.tools.map(tool => {
        // Defensive strip: our wrapper returns unstructured content (text
        // blocks), but MCP requires structuredContent whenever outputSchema
        // is declared. Upstream tools don't currently set outputSchema, but
        // this is cheap insurance against a protocol validation error if
        // that ever changes.
        if (tool && tool.outputSchema) {
          const { outputSchema, ...rest } = tool;
          tool = rest;
        }
        const enhancement = tool && enhancedToolSchemas[tool.name];
        const merged = enhancement ? mergeToolSchema(tool, enhancement) : tool;
        // Every tool upstream lists here is a browser tool that goes
        // through a session's own tools/call handler, so all of them get
        // the `session` param (issue #13 / TK-6). file_download and
        // browser_session are appended below, after this map, so they're
        // never seen by injectSessionParam here.
        return injectSessionParam(merged);
      });
      result.tools.push(fileDownloadToolDefinition);
      result.tools.push(browserSessionToolDefinition);
    }
    return result;
  });

  handlers.set('tools/call', async (request, extra) => {
    const toolName = request.params && request.params.name;
    const rawArgs = (request.params && request.params.arguments) || {};

    if (toolName === 'file_download')
      return handleFileDownload(rawArgs, config);

    if (toolName === 'browser_session')
      return handleBrowserSession(rawArgs, sessionRouter);

    // `session` routing (issue #13 / TK-6): resolve which session's own
    // tools/call handler this call goes through, and strip the `session`
    // key out of the forwarded arguments -- upstream's Zod validation would
    // likely just ignore an unknown extra property today, but that's an
    // accident of upstream's current schema strictness, not a contract this
    // layer should lean on.
    const hadSessionKey = Object.prototype.hasOwnProperty.call(rawArgs, 'session');
    let toolArgs = rawArgs;
    let sessionName = DEFAULT_SESSION_NAME;
    if (hadSessionKey) {
      const { session, ...rest } = rawArgs;
      toolArgs = rest;
      const validation = validateSessionName(session);
      if (!validation.ok) {
        return {
          content: [{ type: 'text', text: `### Error\nInvalid "session" parameter: ${validation.reason}` }],
          isError: true,
        };
      }
      sessionName = session;
    }

    let sessionEntry;
    try {
      sessionEntry = await sessionRouter.getOrCreateSession(sessionName);
    } catch (e) {
      return {
        content: [{ type: 'text', text: `### Error\nFailed to create session "${sessionName}": ${(e && e.message) || e}` }],
        isError: true,
      };
    }

    // Argument injection: default browser_take_screenshot to jpeg (smaller
    // than upstream's own png default) unless the caller specified a type
    // OR a filename — upstream infers format from the filename's extension
    // when `type` is unset, and forcing jpeg there would silently write
    // jpeg bytes into a caller-named `*.png` file. Only override the
    // "no filename, no type" case, where upstream's own fallback is a bare
    // png default with nothing to infer from anyway. Upstream exposes no
    // quality/size knob to inject beyond `type` (no `quality`/`jpegQuality`
    // property in its schema) — see tools/schemas.js and ENHANCEMENTS.md
    // for what that means we dropped.
    //
    // effectiveRequest is only rebuilt from `request` when something
    // actually needs to change (a `session` key was stripped, and/or the
    // screenshot default applies) so the default-session, no-enhanced-args
    // path stays byte-for-byte identical to before this feature existed.
    let effectiveRequest = request;
    if (hadSessionKey)
      effectiveRequest = { ...request, params: { ...request.params, arguments: toolArgs } };
    if (toolName === 'browser_take_screenshot' && toolArgs.type === undefined && !toolArgs.filename) {
      effectiveRequest = {
        ...effectiveRequest,
        params: { ...effectiveRequest.params, arguments: { ...toolArgs, type: 'jpeg' } },
      };
    }

    let result = await sessionEntry.callHandler(effectiveRequest, extra);

    // Issue #15: a call that hit a DISPOSED upstream backend (browser_close
    // on a long-lived connection disposes the backend but leaves its
    // memoized `_browserContextPromise` behind — every later call then dies
    // with this exact TypeError, forever). The failed call did nothing (the
    // throw happens in `ensureTab()`, before any tool action runs), so
    // recover the session once and retry the same request transparently.
    if (isDisposedBackendResult(result)) {
      process.stderr.write(
        `[playwright-mcp enhanced] session "${sessionName}": upstream backend was disposed ` +
        `(stale after browser_close); recreating the session and retrying "${toolName}".\n`
      );
      await sessionRouter.recoverSession(sessionName);
      const freshEntry = await sessionRouter.getOrCreateSession(sessionName);
      result = await freshEntry.callHandler(effectiveRequest, extra);
    }

    // Issue #15: upstream just disposed this session's backend as part of
    // handling browser_close — make sure the NEXT call on this session gets
    // a working one instead of the permanent waitForInitialized wedge (for
    // named sessions this also actually closes the browser process the
    // router launched, which upstream's own close never reaches).
    if (toolName === 'browser_close' && !(result && result.isError))
      await sessionRouter.noteBrowserClosed(sessionName);

    if (toolName && enhancedToolSchemas[toolName])
      return enhanceToolResponse(result, { toolName, params: toolArgs, config: config || {} });

    return result;
  });

  return server;
}

module.exports = {
  createConnection,
  enhancedToolSchemas,
  fileDownloadToolDefinition,
  handleFileDownload,
  browserSessionToolDefinition,
  handleBrowserSession,
};
