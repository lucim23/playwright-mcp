/**
 * Custom tool: browser_session.
 *
 * Management surface for the named-session router (enhanced/utils/sessions.js,
 * issue #13 / TK-6). Lets a client inspect and tear down the secondary
 * isolated-browser sessions it created via the `session` param on browser
 * tools, without needing any out-of-band control channel.
 *
 * Registered exactly like `file_download` (enhanced/tools/fileDownload.js):
 * appended to `tools/list`, and handled as a special case in
 * `enhanced/index.js`'s `tools/call` wrapper before session routing (this
 * tool operates ON the router itself, not through any one session's own
 * `tools/call` handler).
 */
'use strict';

const { validateSessionName, DEFAULT_SESSION_NAME } = require('../utils/sessions');

const browserSessionToolDefinition = {
  name: 'browser_session',
  description:
    'Manage named browser sessions created via the "session" parameter on browser tools. Each distinct ' +
    'session name gets its own independent, isolated browser (own cookies/storage/tabs). Actions: ' +
    '"list" (show every session with its creation/last-used time and which one is the default), ' +
    '"close" (close one named secondary session; the default session cannot be closed this way), ' +
    '"close_all" (close every secondary session, leaving the default session untouched). Secondary ' +
    'sessions are also closed automatically after being idle (see PLAYWRIGHT_MCP_SESSION_IDLE_MS).',
  inputSchema: {
    '$schema': 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'close', 'close_all'],
        description: 'Which session-management operation to perform.',
      },
      name: {
        type: 'string',
        description: 'Session name. Required for action="close"; ignored for "list" and "close_all".',
      },
    },
    required: ['action'],
    additionalProperties: false,
  },
  annotations: {
    title: 'Manage browser sessions',
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: false,
  },
};

/** @param {string} text */
function errorResult(text) {
  return { content: [{ type: 'text', text: `### Error\n${text}` }], isError: true };
}

/** @param {string} text */
function okResult(text) {
  return { content: [{ type: 'text', text: `### Result\n${text}` }] };
}

/**
 * @param {{ createdAt: number, lastUsedAt: number }} s
 */
function formatSessionLine(s) {
  const suffix = s.isDefault ? ' (default)' : '';
  return `- ${s.name}${suffix}: created ${new Date(s.createdAt).toISOString()}, last used ${new Date(s.lastUsedAt).toISOString()}`;
}

/**
 * @param {{ action?: string, name?: string }} params
 * @param {ReturnType<typeof import('../utils/sessions').createSessionRouter>} sessionRouter
 */
async function handleBrowserSession(params, sessionRouter) {
  const action = params && params.action;

  if (action === 'list') {
    const sessions = sessionRouter.listSessions();
    const lines = sessions.map(formatSessionLine);
    return okResult(`${sessions.length} session(s):\n${lines.join('\n')}`);
  }

  if (action === 'close') {
    const name = params && params.name;
    if (name === undefined)
      return errorResult('Missing required parameter "name" for action="close".');
    const validation = validateSessionName(name);
    if (!validation.ok)
      return errorResult(`Invalid "name": ${validation.reason}`);
    if (name === DEFAULT_SESSION_NAME)
      return errorResult('The default session cannot be closed (it is the primary connection). Use action="close_all" to close secondary sessions instead.');
    const result = await sessionRouter.closeSession(name);
    if (!result.ok)
      return errorResult(result.reason);
    return okResult(`Closed session "${name}".`);
  }

  if (action === 'close_all') {
    const results = await sessionRouter.closeAllSecondary();
    const closed = results.filter(r => r.ok).length;
    const lines = results.map(r => `- ${r.name}: ${r.ok ? 'closed' : `failed (${r.reason})`}`);
    return okResult(`Closed ${closed}/${results.length} secondary session(s).${lines.length ? `\n${lines.join('\n')}` : ''}`);
  }

  return errorResult(`Unknown action "${action}". Expected one of: "list", "close", "close_all".`);
}

module.exports = { browserSessionToolDefinition, handleBrowserSession };
