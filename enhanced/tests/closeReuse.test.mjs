#!/usr/bin/env node
/**
 * Regression test for issue #15: a long-lived MCP connection must survive
 * `browser_close` and keep working.
 *
 * Upstream's `browser_close` sets `isClose` on the response, which disposes
 * the whole backend (`Context.dispose()`: tabs cleared, the browser-context
 * "page" listener removed) — but the memoized `_browserContextPromise`
 * survives, so on the NEXT call `newPage()` succeeds with nobody listening,
 * `_currentTab` stays undefined, and every call from then on dies with
 * `TypeError: Cannot read properties of undefined (reading
 * 'waitForInitialized')`. Upstream assumes the client disconnects after
 * close; Claude Code (and any long-lived stdio client) does not.
 *
 * Pre-fix, the "navigate after close" checks below fail with exactly that
 * TypeError. Post-fix, the session router transparently swaps in a fresh
 * upstream connection (default session) / recreates the session (named
 * sessions), so navigate → close → navigate just works.
 *
 * Run with: node enhanced/tests/closeReuse.test.mjs
 * Requires a Chromium (or headless shell) install; if missing, run:
 *   npx playwright install chromium
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'enhanced', 'cli.js');

let passed = 0;
let failed = 0;
function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`PASS - ${name}`);
  } else {
    failed++;
    console.log(`FAIL - ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function textOf(result) {
  return (result && result.content && result.content.find(c => c.type === 'text' && c.text) || {}).text || '';
}

function startLocalServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<!doctype html><html><body>close-reuse-test ${req.url}</body></html>`);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function withClient(fn) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cliPath, '--headless', '--isolated'],
    cwd: repoRoot,
    stderr: 'pipe',
    env: { ...process.env },
  });
  const stderrChunks = [];
  transport.stderr?.on('data', chunk => stderrChunks.push(chunk));
  const client = new Client({ name: 'enhanced-close-reuse-test', version: '1.0.0' }, { capabilities: {} });
  try {
    await client.connect(transport);
    await fn(client);
  } finally {
    await client.close().catch(() => {});
    const stderrText = Buffer.concat(stderrChunks).toString('utf-8');
    if (stderrText.trim())
      console.log(`\nServer stderr:\n${stderrText}`);
  }
}

async function main() {
  const server = await startLocalServer();
  const { port } = server.address();
  const url = p => `http://127.0.0.1:${port}/${p}`;

  try {
    await withClient(async client => {
      const navigate = (p, session) => client.callTool({
        name: 'browser_navigate',
        arguments: { url: url(p), ...(session ? { session } : {}) },
      });
      const close = session => client.callTool({
        name: 'browser_close',
        arguments: { ...(session ? { session } : {}) },
      });

      // --- default session: navigate → close → navigate ---
      const nav1 = await navigate('one');
      check('default: first navigate succeeds', !nav1.isError, textOf(nav1));

      const close1 = await close();
      check('default: browser_close succeeds', !close1.isError, textOf(close1));

      const nav2 = await navigate('two');
      check('default: navigate AFTER close succeeds (the #15 wedge)', !nav2.isError, textOf(nav2));
      check('default: post-close navigate reports no waitForInitialized TypeError',
        !textOf(nav2).includes('waitForInitialized'), textOf(nav2));

      // A second close→reuse cycle proves the rebuilt connection is itself
      // rebuildable (nothing one-shot about the recovery).
      const close2 = await close();
      check('default: second browser_close succeeds', !close2.isError, textOf(close2));
      const nav3 = await navigate('three');
      check('default: navigate after the SECOND close succeeds', !nav3.isError, textOf(nav3));

      // --- named session: navigate → close → navigate ---
      const nav4 = await navigate('named-one', 'reuse');
      check('named: first navigate succeeds', !nav4.isError, textOf(nav4));

      const close3 = await close('reuse');
      check('named: browser_close succeeds', !close3.isError, textOf(close3));

      const nav5 = await navigate('named-two', 'reuse');
      check('named: navigate AFTER close succeeds', !nav5.isError, textOf(nav5));
      check('named: post-close navigate reports no waitForInitialized TypeError',
        !textOf(nav5).includes('waitForInitialized'), textOf(nav5));

      // The default session must have stayed independent of the named
      // session's close/rebuild churn.
      const nav6 = await navigate('four');
      check('default: still healthy after named-session close/reuse', !nav6.isError, textOf(nav6));
    });
  } finally {
    server.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
