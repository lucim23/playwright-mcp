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
const { enhancedToolSchemas, mergeToolSchema } = require('./tools/schemas');
const { enhanceToolResponse } = require('./tools/enhancer');
const { fileDownloadToolDefinition, handleFileDownload } = require('./tools/fileDownload');

/**
 * @param {import('../config').Config} [config]
 * @param {() => Promise<import('playwright').BrowserContext>} [contextGetter]
 * @returns {Promise<import('@modelcontextprotocol/sdk/server/index.js').Server>}
 */
async function createConnection(config, contextGetter) {
  const server = await upstreamCreateConnection(config, contextGetter);
  const handlers = server && server._requestHandlers;

  if (!handlers || typeof handlers.get !== 'function' || typeof handlers.set !== 'function') {
    throw new Error(
      '[playwright-mcp enhanced] FATAL: MCP SDK Server._requestHandlers is missing or is not a Map-like ' +
      'object. The enhancement layer intercepts tools/list and tools/call by replacing entries in this ' +
      'private map, and @modelcontextprotocol/sdk (or the upstream createConnection() implementation in ' +
      'playwright-core/lib/coreBundle.js) has changed shape in a way that breaks this. Refusing to start ' +
      'in a silently-degraded state — the enhancement layer would otherwise appear to work while none of ' +
      'its tool parameters, snapshot shaping, or file_download tool actually take effect. Update ' +
      'enhanced/index.js for the new Server internals before using this layer.'
    );
  }

  const originalListHandler = handlers.get('tools/list');
  const originalCallHandler = handlers.get('tools/call');

  if (typeof originalListHandler !== 'function' || typeof originalCallHandler !== 'function') {
    throw new Error(
      '[playwright-mcp enhanced] FATAL: upstream createConnection() did not register tools/list and/or ' +
      'tools/call request handlers on the Server it returned (found: ' +
      `tools/list=${typeof originalListHandler}, tools/call=${typeof originalCallHandler}). ` +
      'Refusing to start in a silently-degraded state.'
    );
  }

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
        return enhancement ? mergeToolSchema(tool, enhancement) : tool;
      });
      result.tools.push(fileDownloadToolDefinition);
    }
    return result;
  });

  handlers.set('tools/call', async (request, extra) => {
    const toolName = request.params && request.params.name;
    const toolArgs = (request.params && request.params.arguments) || {};

    if (toolName === 'file_download')
      return handleFileDownload(toolArgs, config);

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
    let effectiveRequest = request;
    if (toolName === 'browser_take_screenshot' && toolArgs.type === undefined && !toolArgs.filename) {
      effectiveRequest = {
        ...request,
        params: { ...request.params, arguments: { ...toolArgs, type: 'jpeg' } },
      };
    }

    const result = await originalCallHandler(effectiveRequest, extra);

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
};
