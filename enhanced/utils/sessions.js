/**
 * Named browser session router (issue #13 / TK-6).
 *
 * Lets a single stdio MCP connection (the primary server `enhanced/index.js`
 * already creates via upstream's own `createConnection`) drive multiple
 * independent, isolated browsers by keying additional, lazily-created
 * upstream connections off a `session` name a caller passes on tool calls.
 *
 * Hard requirement: the default session (no `session` param, or
 * `session: "default"`) IS the primary server/handlers this module is
 * handed at construction time -- never a copy, never re-created, never
 * routed through any extra indirection. See `createSessionRouter` below.
 *
 * ## The initialize-handshake wrinkle
 *
 * Upstream's `createConnection()` (playwright-core/lib/coreBundle.js) does
 * NOT create the browser backend eagerly. It's created lazily, memoized,
 * on the server's first `tools/call`, by a closure-local `initializeServer()`
 * helper that reads `server.getClientCapabilities()` / `server.getClientVersion()`
 * (and, only if the client advertised the `roots` capability, calls
 * `server.listRoots()`) to build a `clientInfo` object
 * (`{ cwd, clientName }`) passed to the browser-backend factory.
 *
 * Those `getClientCapabilities()`/`getClientVersion()` accessors are only
 * populated by the MCP SDK's `Server` once it has actually handled an
 * `initialize` request over a transport (`Protocol._oninitialize` sets
 * `this._clientCapabilities` / `this._clientVersion` from the request
 * params). A secondary session's `Server` object (returned by our own
 * in-process call to upstream `createConnection()`) is never `.connect()`-ed
 * to any transport, so it never receives a real `initialize` request and
 * those accessors would return `undefined` forever, which breaks
 * `initializeServer()` (empty `clientName`, and worse, if
 * `getClientCapabilities()?.roots` were ever truthy it would try to
 * `server.listRoots()` over a transport that doesn't exist and hang).
 *
 * Fix: every secondary session's own `initialize` request handler (which
 * upstream's `Server` base class always registers in its `_requestHandlers`,
 * whether or not a transport is attached -- verified against
 * `@modelcontextprotocol/sdk`'s `Protocol.setRequestHandler` /
 * `Server._oninitialize`) is invoked directly, in-process, with a
 * synthesized request that mirrors the shape a real client would send:
 * `{ method: 'initialize', params: { protocolVersion, capabilities: {},
 * clientInfo } }`. `capabilities` is synthesized as `{}` (no `roots`)
 * specifically so `initializeServer()` never attempts `server.listRoots()`
 * on a session with no transport -- `clientInfo.cwd` then falls back to
 * `process.cwd()` inside upstream's own `firstRootPath([])`, which is a
 * reasonable default since secondary sessions are always forced isolated
 * (in-memory profile; `clientInfo.cwd` only otherwise affects where the
 * isolated browser's traces directory defaults to).
 *
 * `clientInfo.name`/`protocolVersion` are taken from the PRIMARY session's
 * real handshake when available (captured by `enhanced/index.js`'s own
 * wrapper around the primary server's `initialize` handler, and threaded
 * through here via the `getCapturedPrimaryInit` option) so a secondary
 * session's synthesized identity plausibly resembles
 * the real client's, with a `(session:<name>)` suffix for observability in
 * any client-name-keyed logging upstream does. If the primary hasn't
 * initialized yet (shouldn't happen in practice -- a client always sends
 * `initialize` before any `tools/call` can reach our router) or the
 * capture never wired up, a hardcoded fallback identity is used instead;
 * this only affects cosmetic clientName-derived behavior, not correctness.
 *
 * This was verified empirically, not assumed: see
 * `enhanced/tests/sessions.test.mjs`, which navigates two named sessions to
 * different `data:` URLs and asserts each has independent page state.
 *
 * ## Why secondary sessions launch their own browser (the teardown wrinkle)
 *
 * The first implementation of this router asked upstream's own
 * `createConnection(sessionConfig)` (no `contextGetter`) to create the
 * secondary browser, on the theory that calling the session's own
 * `browser_close` tool plus `server.close()` would tear it down cleanly --
 * mirroring how a real client disconnecting cleans up the primary session.
 *
 * That was checked empirically (`pgrep`-counting browser processes before/
 * after `browser_session` `close_all`) and turned out to be **false** for
 * this factory path: `playwright-core/lib/coreBundle.js`'s plain
 * `createConnection()` builds `new BrowserBackend(config, context, tools)`
 * with **no** `disposeCallback` (that 4th constructor argument, which is
 * what actually closes the browser, is only ever passed by upstream's own
 * CLI/daemon entry points -- not by the public `createConnection()` this
 * layer wraps). `BrowserBackend.dispose()` therefore only disposes open tabs
 * (`Context.dispose()`) -- it never calls `browserContext.close()` or
 * `browser.close()`. The browser process only gets reaped when the *entire*
 * Node process running this MCP server exits, via playwright-core's own
 * process-level `gracefullyCloseSet`/`exit`-handler safety net (see
 * `packages/playwright-core/src/utils/processLauncher.ts` in coreBundle.js)
 * -- not through anything MCP-level. For a long-lived server juggling many
 * named sessions, that means `browser_session close`/`close_all`/the idle
 * sweeper would silently accumulate orphaned browser processes for as long
 * as the server itself keeps running.
 *
 * Fix: secondary sessions launch and own their browser+context themselves,
 * via `playwright-core`'s standard **public** `chromium`/`firefox`/`webkit`
 * launchers (`require('playwright-core')` -- the same top-level export
 * surface any Playwright script uses, more stable than the
 * `playwright-core/lib/coreBundle` internal already used for CLI config
 * resolution elsewhere in this layer), and hand the resulting
 * `BrowserContext` to upstream via `createConnection(sessionConfig,
 * contextGetter)`'s existing `contextGetter` parameter -- the same
 * embedding hook the public API already exposes for exactly this "bring
 * your own browser" use case (see `enhanced/index.js`'s own JSDoc on
 * `createConnection`, and `SimpleBrowser` in coreBundle.js, which is what
 * upstream wraps a supplied context in). Because we hold the real
 * `browser`/`context` objects directly, teardown calls `context.close()`
 * then `browser.close()` ourselves -- not dependent on MCP-level dispose
 * plumbing at all. This was re-verified with the same `pgrep` experiment
 * after the fix: process count returns to baseline immediately after
 * `close_all`, not only after the whole server exits.
 *
 * One consequence: when a `contextGetter` is supplied, upstream's factory
 * takes `browser.contexts()[0]` rather than calling `browser.newContext()`
 * again (see `createConnection`'s factory in coreBundle.js) -- calling
 * `newContext()` a second time on the `SimpleBrowser` wrapper upstream
 * builds around a supplied context throws
 * `"Creating a new context is not supported in SimpleBrowserContextFactory."`.
 * So `cloneConfigForSecondary` sets `browser.isolated: false` (not `true`)
 * for this path -- the actual isolation (a fresh, non-persistent profile
 * with no shared state) is achieved by *us* launching a brand-new browser
 * process with no `userDataDir` every time, not by upstream's own
 * `isolated` branch, which we bypass entirely via `contextGetter`. See
 * `launchSecondaryBrowser` below.
 */
'use strict';

const { chromium, firefox, webkit } = require('playwright-core');

let LATEST_PROTOCOL_VERSION = '2025-06-18';
try {
  // Best-effort: read the SDK's own constant so the synthesized handshake
  // advertises a protocol version the installed SDK actually knows about.
  // Not load-bearing -- InitializeRequestSchema only requires a string, and
  // upstream's own _oninitialize() falls back to LATEST_PROTOCOL_VERSION
  // for any value it doesn't recognize (see SUPPORTED_PROTOCOL_VERSIONS).
  ({ LATEST_PROTOCOL_VERSION } = require('@modelcontextprotocol/sdk/types.js'));
} catch {
  // Fall back to the hardcoded value above.
}

const { extractRequestHandlers, requireHandler } = require('./handlers');

const DEFAULT_SESSION_NAME = 'default';
const MAX_SESSION_NAME_LENGTH = 64;
// Deliberately conservative: letters, digits, underscore, hyphen only. Rejects
// path separators (`/`, `\`), `..`, dots, whitespace, and all control
// characters -- there's no legitimate reason a session name needs any of
// those, and this name never touches the filesystem directly, but staying
// conservative here costs nothing.
const VALID_NAME_RE = /^[A-Za-z0-9_-]+$/;

const DEFAULT_IDLE_MS = 15 * 60 * 1000; // 15 minutes
const IDLE_SWEEP_INTERVAL_MS = 60 * 1000; // check at most once a minute

const FALLBACK_CLIENT_NAME = 'playwright-mcp-enhanced';
const FALLBACK_CLIENT_VERSION = '0.0.0';

/**
 * @param {unknown} name
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function validateSessionName(name) {
  if (typeof name !== 'string' || name.length === 0)
    return { ok: false, reason: 'must be a non-empty string' };
  if (name.length > MAX_SESSION_NAME_LENGTH)
    return { ok: false, reason: `must be at most ${MAX_SESSION_NAME_LENGTH} characters (got ${name.length})` };
  if (!VALID_NAME_RE.test(name))
    return { ok: false, reason: 'must contain only letters, digits, "_", and "-" (no path separators, dots, spaces, or control characters)' };
  return { ok: true };
}

/**
 * Resolve the idle-cleanup timeout from `PLAYWRIGHT_MCP_SESSION_IDLE_MS`.
 * `0` disables idle cleanup entirely. An invalid/missing value falls back to
 * the 15-minute default rather than silently disabling cleanup.
 * @param {NodeJS.ProcessEnv} env
 */
function resolveIdleMs(env) {
  const raw = env && env.PLAYWRIGHT_MCP_SESSION_IDLE_MS;
  if (raw === undefined || raw === '')
    return DEFAULT_IDLE_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0)
    return DEFAULT_IDLE_MS;
  return n;
}

const BROWSER_LAUNCHERS = { chromium, firefox, webkit };

/**
 * Build the Config passed to upstream `createConnection()` for a secondary
 * session: a shallow clone of the caller's resolved config, with
 * `browser.isolated: false` and `browser.userDataDir` cleared.
 *
 * `isolated: false` looks backwards at first glance -- see the module-level
 * "Why secondary sessions launch their own browser" doc comment for the
 * full reasoning. Short version: secondary sessions supply their own
 * pre-launched `BrowserContext` via `contextGetter` (see
 * `launchSecondaryBrowser` below), and upstream's factory only accepts a
 * supplied context correctly when `isolated` is falsy; setting it true
 * would make upstream try to open a *second* context on top of the one we
 * already made, which throws. The actual isolation guarantee (fresh,
 * non-persistent, independent profile) comes from *us* launching a brand
 * new browser process with no `userDataDir`, every time -- not from this
 * config flag.
 *
 * `userDataDir` is cleared regardless, defensively: it has no meaning for a
 * browser this router launches itself, and leaving a primary-config value
 * in place could otherwise confuse any config-introspecting tool/log.
 *
 * Does not mutate `baseConfig` or `baseConfig.browser` -- both are
 * shallow-copied. Nested objects (`launchOptions`, `contextOptions`, etc.)
 * are reused by reference since nothing here or downstream (upstream's own
 * `mergeConfig` always spreads into fresh objects) ever mutates them.
 *
 * @param {Record<string, any> | undefined} baseConfig
 */
function cloneConfigForSecondary(baseConfig) {
  const cfg = { ...(baseConfig || {}) };
  const baseBrowser = (baseConfig && baseConfig.browser) || {};
  cfg.browser = { ...baseBrowser, isolated: false, userDataDir: undefined };
  return cfg;
}

/**
 * Launch a brand-new, independent browser + context for a secondary
 * session, using `playwright-core`'s standard public launchers (not the
 * `coreBundle` internals). Mirrors upstream's own defaulting closely enough
 * to behave predictably (`browserName` defaults to chromium; a non-chromium
 * `launchOptions.channel` is dropped, matching `mergeConfig`'s own guard in
 * coreBundle.js against passing e.g. a Chrome channel to firefox) without
 * needing to depend on upstream's *internal*, non-exported
 * `resolveConfig`/`validateBrowserConfig` -- anything not replicated here
 * (e.g. the Linux-headless-without-DISPLAY default) just falls through to
 * Playwright's own `launch()` defaults, which are already sensible.
 *
 * `handleSIGINT`/`handleSIGTERM: false` matches upstream's own
 * `createIsolatedBrowser` -- this router (and ultimately the whole `enhanced/
 * cli.js` process) is responsible for its own shutdown sequencing, not
 * Playwright's per-browser signal handling.
 *
 * @param {Record<string, any>} sessionConfig
 * @returns {Promise<{ browser: import('playwright-core').Browser, context: import('playwright-core').BrowserContext }>}
 */
async function launchSecondaryBrowser(sessionConfig) {
  const browserConfig = (sessionConfig && sessionConfig.browser) || {};
  const browserName = browserConfig.browserName || 'chromium';
  const launcher = BROWSER_LAUNCHERS[browserName] || chromium;
  const launchOptions = { ...(browserConfig.launchOptions || {}) };
  if (browserName !== 'chromium' && launchOptions.channel && !String(launchOptions.channel).startsWith('moz-'))
    delete launchOptions.channel;

  const browser = await launcher.launch({ ...launchOptions, handleSIGINT: false, handleSIGTERM: false });
  try {
    const context = await browser.newContext(browserConfig.contextOptions || {});
    return { browser, context };
  } catch (e) {
    await browser.close().catch(() => {});
    throw e;
  }
}

/**
 * Invoke a secondary session's own `initialize` request handler directly
 * (no transport involved) with a synthesized request, so that upstream's
 * lazy `initializeServer()` (triggered on the session's first real
 * `tools/call`) sees a populated `getClientCapabilities()`/`getClientVersion()`
 * instead of `undefined`. See the module-level doc comment for the full
 * rationale. No-ops (with a stderr warning) if the secondary server didn't
 * register an `initialize` handler at all -- that's degraded, not fatal,
 * since it only affects the cosmetic clientInfo upstream's backend factory
 * receives, not this router's own correctness guards.
 *
 * @param {Map<string, Function>} handlers
 * @param {string} sessionName
 * @param {{ protocolVersion?: string, clientInfo?: { name?: string, version?: string } }} capturedPrimaryInit
 */
async function synthesizeInitialize(handlers, sessionName, capturedPrimaryInit) {
  const initHandler = handlers.get('initialize');
  if (typeof initHandler !== 'function') {
    process.stderr.write(
      `[playwright-mcp enhanced] WARNING: session "${sessionName}": secondary server did not register an ` +
      '"initialize" request handler; proceeding without a synthesized handshake. Upstream\'s lazy backend ' +
      'init may see an empty clientInfo.\n'
    );
    return;
  }

  const primaryClientInfo = (capturedPrimaryInit && capturedPrimaryInit.clientInfo) || {};
  const clientInfo = {
    name: `${primaryClientInfo.name || FALLBACK_CLIENT_NAME} (session:${sessionName})`,
    version: primaryClientInfo.version || FALLBACK_CLIENT_VERSION,
  };
  const protocolVersion = (capturedPrimaryInit && capturedPrimaryInit.protocolVersion) || LATEST_PROTOCOL_VERSION;

  const request = {
    method: 'initialize',
    params: {
      protocolVersion,
      // Deliberately empty: no `roots` capability means upstream's
      // initializeServer() never calls server.listRoots() on this
      // transport-less server (see module doc comment).
      capabilities: {},
      clientInfo,
    },
  };
  await initHandler(request, {});
}

/**
 * @param {object} opts
 * @param {import('@modelcontextprotocol/sdk/server/index.js').Server} opts.primaryServer
 * @param {Function} opts.primaryListHandler original (unwrapped) primary tools/list handler
 * @param {Function} opts.primaryCallHandler original (unwrapped) primary tools/call handler
 * @param {Record<string, any> | undefined} opts.baseConfig the config the primary server was created with
 * @param {(config: any, contextGetter?: any) => Promise<any>} opts.upstreamCreateConnection
 * @param {() => { protocolVersion?: string, clientInfo?: { name?: string, version?: string } }} opts.getCapturedPrimaryInit
 * @param {NodeJS.ProcessEnv} [opts.env]
 */
function createSessionRouter(opts) {
  const {
    primaryServer,
    primaryListHandler,
    primaryCallHandler,
    baseConfig,
    upstreamCreateConnection,
    getCapturedPrimaryInit,
    env = process.env,
  } = opts;

  const idleMs = resolveIdleMs(env);
  const now = () => Date.now();

  /** @type {Map<string, { name: string, server: any, browser?: any, context?: any, listHandler: Function, callHandler: Function, isDefault: boolean, createdAt: number, lastUsedAt: number }>} */
  const sessions = new Map();
  sessions.set(DEFAULT_SESSION_NAME, {
    name: DEFAULT_SESSION_NAME,
    server: primaryServer,
    listHandler: primaryListHandler,
    callHandler: primaryCallHandler,
    isDefault: true,
    createdAt: now(),
    lastUsedAt: now(),
  });

  /** @type {Map<string, Promise<any>>} in-flight creations, keyed by name, to avoid double-launch races */
  const creating = new Map();

  async function createSecondarySession(name) {
    const sessionConfig = cloneConfigForSecondary(baseConfig);
    // Launch + own the browser/context ourselves (see the module-level "Why
    // secondary sessions launch their own browser" doc comment) so this
    // router -- not upstream's incomplete MCP-level dispose chain -- is what
    // actually frees the process on close.
    const { browser, context } = await launchSecondaryBrowser(sessionConfig);
    let server;
    try {
      server = await upstreamCreateConnection(sessionConfig, async () => context);
    } catch (e) {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
      throw e;
    }
    const handlers = extractRequestHandlers(server, `secondary session "${name}"`);
    await synthesizeInitialize(handlers, name, getCapturedPrimaryInit ? getCapturedPrimaryInit() : undefined);
    const listHandler = requireHandler(handlers, 'tools/list', `secondary session "${name}"`);
    const callHandler = requireHandler(handlers, 'tools/call', `secondary session "${name}"`);
    const entry = {
      name,
      server,
      browser,
      context,
      listHandler,
      callHandler,
      isDefault: false,
      createdAt: now(),
      lastUsedAt: now(),
    };
    sessions.set(name, entry);
    return entry;
  }

  /** @param {string} name */
  async function getOrCreateSession(name) {
    const existing = sessions.get(name);
    if (existing) {
      existing.lastUsedAt = now();
      return existing;
    }
    const inFlight = creating.get(name);
    if (inFlight)
      return inFlight;
    const promise = createSecondarySession(name).finally(() => creating.delete(name));
    creating.set(name, promise);
    return promise;
  }

  function listSessions() {
    return [...sessions.values()]
      .map(s => ({ name: s.name, isDefault: s.isDefault, createdAt: s.createdAt, lastUsedAt: s.lastUsedAt }))
      .sort((a, b) => (a.isDefault === b.isDefault ? a.name.localeCompare(b.name) : a.isDefault ? -1 : 1));
  }

  /**
   * Clean teardown of a secondary session. Every step is best-effort (a
   * failure is logged to stderr, never thrown) so one stuck step can't
   * prevent the rest -- e.g. `browser_close` isn't reachable for a session
   * whose backend never finished initializing, but the browser/context we
   * launched ourselves should still be closed regardless.
   *
   * Order: (1) the session's own `browser_close` tool, through its normal
   * `tools/call` handler -- the "polite" MCP-level path a real client would
   * take; (2) `server.close()` -- releases the MCP `Server` object and
   * triggers whatever upstream's own `onclose` listener does; (3)
   * `context.close()` then `browser.close()` directly on the objects this
   * router launched itself. Step (3) is the one that's actually
   * load-bearing for freeing the OS process -- steps (1)/(2) don't reach it
   * for this factory path (see the module-level doc comment) but are kept
   * for MCP-level correctness/symmetry with how a real client disconnects.
   * @param {ReturnType<typeof sessions.get>} entry
   */
  async function teardown(entry) {
    try {
      await entry.callHandler({ method: 'tools/call', params: { name: 'browser_close', arguments: {} } }, {});
    } catch (e) {
      process.stderr.write(`[playwright-mcp enhanced] WARNING: session "${entry.name}": browser_close during teardown failed: ${(e && e.message) || e}\n`);
    }
    try {
      await entry.server.close();
    } catch (e) {
      process.stderr.write(`[playwright-mcp enhanced] WARNING: session "${entry.name}": server.close() during teardown failed: ${(e && e.message) || e}\n`);
    }
    try {
      await entry.context?.close();
    } catch (e) {
      process.stderr.write(`[playwright-mcp enhanced] WARNING: session "${entry.name}": context.close() during teardown failed: ${(e && e.message) || e}\n`);
    }
    try {
      await entry.browser?.close();
    } catch (e) {
      process.stderr.write(`[playwright-mcp enhanced] WARNING: session "${entry.name}": browser.close() during teardown failed: ${(e && e.message) || e}\n`);
    }
  }

  /**
   * @param {string} name
   */
  async function closeSession(name) {
    if (name === DEFAULT_SESSION_NAME)
      return { ok: false, reason: 'The default session cannot be closed (it is the primary connection). Use close_all to close secondary sessions instead.' };
    let entry = sessions.get(name);
    if (!entry) {
      // Race guard: a creation for this name may be in flight (started by a
      // concurrent tools/call) but not yet in `sessions`. Wait for it and
      // close what it produces, rather than reporting "no such session" and
      // then leaking the browser that finishes launching a moment later.
      const inFlight = creating.get(name);
      if (inFlight) {
        try {
          entry = await inFlight;
        } catch {
          return { ok: false, reason: `No session named "${name}".` };
        }
      }
    }
    if (!entry)
      return { ok: false, reason: `No session named "${name}".` };
    await teardown(entry);
    sessions.delete(name);
    return { ok: true };
  }

  async function closeAllSecondary() {
    const names = [...sessions.keys()].filter(n => n !== DEFAULT_SESSION_NAME);
    const results = [];
    for (const name of names)
      results.push({ name, ...(await closeSession(name)) });
    return results;
  }

  let sweepTimer;
  if (idleMs > 0) {
    sweepTimer = setInterval(() => {
      const cutoff = now() - idleMs;
      for (const [name, entry] of sessions) {
        if (entry.isDefault || entry.lastUsedAt >= cutoff)
          continue;
        process.stderr.write(`[playwright-mcp enhanced] Closing idle session "${name}" (idle for > ${idleMs}ms).\n`);
        closeSession(name).catch(e => process.stderr.write(`[playwright-mcp enhanced] WARNING: idle cleanup of session "${name}" failed: ${(e && e.message) || e}\n`));
      }
    }, Math.min(idleMs, IDLE_SWEEP_INTERVAL_MS));
    if (typeof sweepTimer.unref === 'function')
      sweepTimer.unref();
  }

  return {
    DEFAULT_SESSION_NAME,
    idleMs,
    getOrCreateSession,
    listSessions,
    closeSession,
    closeAllSecondary,
    /** Test-only: stop the idle sweeper so it doesn't keep a process alive/interfere with test timing. */
    _stopIdleSweep() {
      if (sweepTimer)
        clearInterval(sweepTimer);
    },
  };
}

module.exports = {
  createSessionRouter,
  validateSessionName,
  cloneConfigForSecondary,
  resolveIdleMs,
  DEFAULT_SESSION_NAME,
  MAX_SESSION_NAME_LENGTH,
  DEFAULT_IDLE_MS,
};
