/**
 * Shared guard for extracting JSON-RPC request handlers off an MCP SDK
 * `Server`'s private `_requestHandlers` Map.
 *
 * `enhanced/index.js` uses this for the primary server; `enhanced/utils/sessions.js`
 * uses it for every secondary (named-session) server it creates. Factored out
 * so there is exactly one place that knows the shape of this private
 * implementation detail and exactly one hard-fail error message to keep in
 * sync if `@modelcontextprotocol/sdk` (or playwright-core/lib/coreBundle.js's
 * use of it) ever changes shape — see ENHANCEMENTS.md "Mechanism" for why
 * this fails loudly instead of degrading silently.
 */
'use strict';

/**
 * @param {import('@modelcontextprotocol/sdk/server/index.js').Server} server
 * @param {string} label human-readable identifier for the server this guard is checking, used in the error message (e.g. "primary server", 'secondary session "a"')
 * @returns {Map<string, Function>}
 */
function extractRequestHandlers(server, label) {
  const handlers = server && server._requestHandlers;
  if (!handlers || typeof handlers.get !== 'function' || typeof handlers.set !== 'function') {
    throw new Error(
      `[playwright-mcp enhanced] FATAL: MCP SDK Server._requestHandlers is missing or is not a Map-like ` +
      `object (${label}). The enhancement layer intercepts tools/list, tools/call, and (for named sessions) ` +
      'initialize by replacing entries in this private map, and @modelcontextprotocol/sdk (or the upstream ' +
      'createConnection() implementation in playwright-core/lib/coreBundle.js) has changed shape in a way ' +
      'that breaks this. Refusing to proceed in a silently-degraded state.'
    );
  }
  return handlers;
}

/**
 * @param {Map<string, Function>} handlers
 * @param {string} method
 * @param {string} label see {@link extractRequestHandlers}
 * @returns {Function}
 */
function requireHandler(handlers, method, label) {
  const handler = handlers.get(method);
  if (typeof handler !== 'function') {
    throw new Error(
      `[playwright-mcp enhanced] FATAL: ${label} did not register a "${method}" request handler ` +
      `(found: ${typeof handler}). Refusing to proceed in a silently-degraded state.`
    );
  }
  return handler;
}

module.exports = { extractRequestHandlers, requireHandler };
