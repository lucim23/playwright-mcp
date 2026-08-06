#!/usr/bin/env node
/**
 * Regression + feature test for issue #13 (TK-6): named independent browser
 * sessions via a `session` param on browser tool calls.
 *
 * Two parts:
 *
 *  (1) Pure unit checks against enhanced/utils/sessions.js's exported
 *      helpers (validateSessionName, cloneConfigForSecondary, resolveIdleMs)
 *      -- no subprocess needed.
 *
 *  (2) A real end-to-end run against enhanced/cli.js as a genuine subprocess
 *      over stdio (same harness style as smoke.mjs), covering:
 *        - session param is accepted and stripped (no upstream schema error)
 *        - two named sessions are independent (separate current page URL,
 *          separate localStorage at the same origin -- proves separate
 *          browser contexts, not just separate tabs of one context)
 *        - browser_session list/close/close_all lifecycle
 *        - closing "default" is rejected (isError), closing an unknown or
 *          invalid name is rejected (isError)
 *        - after close, the next use of that name gets a fresh session
 *          (empty localStorage) -- proxy for "the old browser is actually
 *          gone" per the task brief's fallback allowance
 *        - the idle sweeper actually closes an idle secondary session when
 *          PLAYWRIGHT_MCP_SESSION_IDLE_MS is set low, without touching the
 *          default session
 *
 * Default-path parity (calls with no `session` param behave identically to
 * before this feature existed) is asserted by enhanced/tests/smoke.mjs
 * itself staying green, UNCHANGED -- that IS the parity gate per the task
 * brief. This file additionally spot-checks that an explicit
 * `session: "default"` produces the same shape of response as omitting it.
 *
 * Run with: node enhanced/tests/sessions.test.mjs
 * Requires a Chromium (or headless shell) install; if missing, run:
 *   npx playwright install chromium
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { validateSessionName, cloneConfigForSecondary, resolveIdleMs, DEFAULT_SESSION_NAME, DEFAULT_IDLE_MS } = require('../utils/sessions.js');

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

function extractPageUrl(text) {
  const m = text.match(/- Page URL: (.+)/);
  return m ? m[1].trim() : undefined;
}

/** Evaluate a JS expression string via browser_evaluate and JSON.parse the "### Result" line. */
async function evaluateJson(client, sessionName, expr) {
  const result = await client.callTool({
    name: 'browser_evaluate',
    arguments: { function: expr, ...(sessionName ? { session: sessionName } : {}) },
  });
  const text = textOf(result);
  const m = text.match(/### Result\n([\s\S]*?)\n### /);
  const raw = m ? m[1] : text.replace(/^### Result\n/, '').trim();
  try {
    return { ok: !result.isError, value: JSON.parse(raw), raw, isError: result.isError };
  } catch {
    return { ok: !result.isError, value: undefined, raw, isError: result.isError };
  }
}

/**
 * Best-effort count of chromium-ish OS processes (`pgrep -fc`), used to
 * assert that closing a secondary session actually frees its browser
 * process -- not just removes it from this router's bookkeeping. See the
 * "Why secondary sessions launch their own browser" doc comment in
 * enhanced/utils/sessions.js for why this needed a real fix (an earlier
 * version of this router *looked* like it closed sessions but silently
 * leaked the underlying browser process until the whole server exited).
 * Returns `undefined` (rather than throwing) if `pgrep` isn't available, so
 * this stays best-effort per the task brief's explicit fallback allowance.
 */
function chromiumProcessCount() {
  try {
    const out = execSync("pgrep -fc 'headless_shell|chrome|chromium' 2>/dev/null || true").toString().trim();
    const n = Number(out);
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

function startLocalServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><html><body>local-session-test</body></html>');
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// --- (1) pure unit checks, no subprocess -----------------------------------

function runUnitChecks() {
  check('validateSessionName accepts a normal name', validateSessionName('a').ok === true);
  check('validateSessionName accepts "default"', validateSessionName(DEFAULT_SESSION_NAME).ok === true);
  check('validateSessionName rejects empty string', validateSessionName('').ok === false);
  check('validateSessionName rejects non-string', validateSessionName(42).ok === false);
  check('validateSessionName rejects a name > 64 chars', validateSessionName('x'.repeat(65)).ok === false);
  check('validateSessionName accepts a name == 64 chars', validateSessionName('x'.repeat(64)).ok === true);
  check('validateSessionName rejects path traversal', validateSessionName('../etc/passwd').ok === false);
  check('validateSessionName rejects a path separator', validateSessionName('a/b').ok === false);
  check('validateSessionName rejects whitespace', validateSessionName('a b').ok === false);
  check('validateSessionName rejects control characters', validateSessionName('a\nb').ok === false);

  // NOTE: cloneConfigForSecondary sets browser.isolated: false (not true) --
  // see the module-level "Why secondary sessions launch their own browser"
  // doc comment in enhanced/utils/sessions.js. Secondary sessions supply
  // their own pre-launched BrowserContext via `contextGetter`; upstream's
  // factory only accepts a supplied context correctly when `isolated` is
  // falsy (setting it true makes upstream try to open a second context on
  // top of the one already supplied, which throws). The actual isolation
  // guarantee comes from launchSecondaryBrowser always launching a fresh
  // browser process with no userDataDir, not from this config flag.
  const baseConfig = { browser: { isolated: false, userDataDir: '/some/persistent/profile', browserName: 'chromium' }, outputDir: '/out' };
  const frozenBaseBrowser = JSON.stringify(baseConfig.browser);
  const cloned = cloneConfigForSecondary(baseConfig);
  check('cloneConfigForSecondary sets browser.isolated = false (own contextGetter path)', cloned.browser.isolated === false);
  check('cloneConfigForSecondary clears browser.userDataDir', cloned.browser.userDataDir === undefined);
  check('cloneConfigForSecondary preserves other browser fields', cloned.browser.browserName === 'chromium');
  check('cloneConfigForSecondary preserves top-level fields', cloned.outputDir === '/out');
  check('cloneConfigForSecondary does not mutate the caller\'s config', JSON.stringify(baseConfig.browser) === frozenBaseBrowser);
  check('cloneConfigForSecondary tolerates undefined baseConfig', cloneConfigForSecondary(undefined).browser.isolated === false);

  check('resolveIdleMs falls back to the 15-minute default when unset', resolveIdleMs({}) === DEFAULT_IDLE_MS);
  check('resolveIdleMs honors 0 (disables idle cleanup)', resolveIdleMs({ PLAYWRIGHT_MCP_SESSION_IDLE_MS: '0' }) === 0);
  check('resolveIdleMs honors a positive override', resolveIdleMs({ PLAYWRIGHT_MCP_SESSION_IDLE_MS: '1234' }) === 1234);
  check('resolveIdleMs falls back on a garbage value', resolveIdleMs({ PLAYWRIGHT_MCP_SESSION_IDLE_MS: 'not-a-number' }) === DEFAULT_IDLE_MS);
  check('resolveIdleMs falls back on a negative value', resolveIdleMs({ PLAYWRIGHT_MCP_SESSION_IDLE_MS: '-5' }) === DEFAULT_IDLE_MS);
}

// --- (2) end-to-end checks over real stdio subprocess -----------------------

async function withClient(extraEnv, fn) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cliPath, '--headless'],
    cwd: repoRoot,
    stderr: 'pipe',
    env: { ...process.env, ...extraEnv },
  });
  const stderrChunks = [];
  transport.stderr?.on('data', chunk => stderrChunks.push(chunk));
  const client = new Client({ name: 'enhanced-sessions-test', version: '1.0.0' }, { capabilities: {} });
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

async function runMainScenario() {
  const server = await startLocalServer();
  const { port } = server.address();
  const localUrl = `http://127.0.0.1:${port}/`;

  try {
    await withClient({}, async client => {
      // --- tools/list: session param advertised, browser_session present ---
      const { tools } = await client.listTools();
      const byName = new Map(tools.map(t => [t.name, t]));

      check('browser_session tool is listed', byName.has('browser_session'));
      const bs = byName.get('browser_session');
      check('browser_session schema has action + name (no session param)', !!bs?.inputSchema?.properties?.action && !bs?.inputSchema?.properties?.session);

      check('file_download does not get a session param (session-agnostic)', !byName.get('file_download')?.inputSchema?.properties?.session);

      const navTool = byName.get('browser_navigate');
      check('browser_navigate advertises a "session" param', !!navTool?.inputSchema?.properties?.session);
      const clickTool = byName.get('browser_click');
      check('browser_click advertises a "session" param', !!clickTool?.inputSchema?.properties?.session);

      // --- default-path spot check: explicit session:"default" mirrors omitting it ---
      const navOmitted = await client.callTool({ name: 'browser_navigate', arguments: { url: 'data:text/html,<title>omitted</title>' } });
      const navExplicitDefault = await client.callTool({ name: 'browser_navigate', arguments: { url: 'data:text/html,<title>explicit-default</title>', session: 'default' } });
      check('omitted session does not error', navOmitted.isError !== true);
      check('session:"default" does not error', navExplicitDefault.isError !== true);
      check('session:"default" response has the same shape as omitting session', /### Page/.test(textOf(navExplicitDefault)) === /### Page/.test(textOf(navOmitted)));

      // --- session param combined with an existing enhanced param, and stripped before forwarding ---
      const combined = await client.callTool({
        name: 'browser_navigate',
        arguments: { url: 'data:text/html,<title>combined</title>', returnSnapshot: false, session: 'combo' },
      });
      check('session + returnSnapshot:false together does not error (param stripped, not rejected upstream)', combined.isError !== true, textOf(combined).slice(0, 300));
      check('session + returnSnapshot:false still applies the enhanced param', textOf(combined).includes('Snapshot: disabled'), textOf(combined).slice(0, 300));

      // --- invalid session names rejected without throwing ---
      const badChars = await client.callTool({ name: 'browser_navigate', arguments: { url: 'data:text/html,<h1>x</h1>', session: '../etc' } });
      check('path-like session name is rejected as isError', badChars.isError === true);
      check('path-like session name error message is informative', /Invalid "session"/.test(textOf(badChars)));

      const emptyName = await client.callTool({ name: 'browser_navigate', arguments: { url: 'data:text/html,<h1>x</h1>', session: '' } });
      check('empty session name is rejected as isError', emptyName.isError === true);

      const tooLong = await client.callTool({ name: 'browser_navigate', arguments: { url: 'data:text/html,<h1>x</h1>', session: 'x'.repeat(65) } });
      check('over-length session name is rejected as isError', tooLong.isError === true);

      // --- two named sessions are independent: distinct current page URL ---
      const navA = await client.callTool({ name: 'browser_navigate', arguments: { url: 'data:text/html,<title>A</title><h1>A</h1>', session: 'a' } });
      const navB = await client.callTool({ name: 'browser_navigate', arguments: { url: 'data:text/html,<title>B</title><h1>B</h1>', session: 'b' } });
      check('session "a" navigate does not error', navA.isError !== true, textOf(navA).slice(0, 300));
      check('session "b" navigate does not error', navB.isError !== true, textOf(navB).slice(0, 300));
      const urlA = extractPageUrl(textOf(navA));
      const urlB = extractPageUrl(textOf(navB));
      check('session "a" and "b" have distinct current page URLs', !!urlA && !!urlB && urlA !== urlB, `a=${urlA} b=${urlB}`);
      check('session "a" URL reflects its own navigation', (urlA || '').includes('<title>A'));
      check('session "b" URL reflects its own navigation', (urlB || '').includes('<title>B'));

      // --- storage isolation: same origin, independent localStorage per session ---
      await client.callTool({ name: 'browser_navigate', arguments: { url: localUrl, session: 'a' } });
      await client.callTool({ name: 'browser_navigate', arguments: { url: localUrl, session: 'b' } });
      const setA = await evaluateJson(client, 'a', "() => { localStorage.setItem('marker', 'A'); return localStorage.getItem('marker'); }");
      check('session "a" can set its own localStorage', setA.ok && setA.value === 'A', setA.raw);
      const readBAfterA = await evaluateJson(client, 'b', "() => localStorage.getItem('marker')");
      check('session "b" does not see session "a"\'s localStorage (independent browser contexts)', readBAfterA.ok && readBAfterA.value === null, readBAfterA.raw);
      await client.callTool({ name: 'browser_navigate', arguments: { url: localUrl } }); // default session, same origin
      const readDefaultAfterA = await evaluateJson(client, undefined, "() => localStorage.getItem('marker')");
      check('default session does not see the "a" session\'s localStorage either', readDefaultAfterA.ok && readDefaultAfterA.value === null, readDefaultAfterA.raw);

      // --- browser_session: list ---
      const list1 = await client.callTool({ name: 'browser_session', arguments: { action: 'list' } });
      const list1Text = textOf(list1);
      check('browser_session list includes default', /- default \(default\)/.test(list1Text), list1Text);
      check('browser_session list includes "a"', /- a:/.test(list1Text), list1Text);
      check('browser_session list includes "b"', /- b:/.test(list1Text), list1Text);
      check('browser_session list includes "combo"', /- combo:/.test(list1Text), list1Text);

      // --- browser_session: close default is rejected ---
      const closeDefault = await client.callTool({ name: 'browser_session', arguments: { action: 'close', name: 'default' } });
      check('closing the default session is rejected as isError', closeDefault.isError === true);
      check('closing the default session explains why', /default session cannot be closed/.test(textOf(closeDefault)));

      // --- browser_session: close unknown name is rejected ---
      const closeUnknown = await client.callTool({ name: 'browser_session', arguments: { action: 'close', name: 'does-not-exist' } });
      check('closing an unknown session name is rejected as isError', closeUnknown.isError === true);

      // --- browser_session: close invalid name is rejected ---
      const closeInvalid = await client.callTool({ name: 'browser_session', arguments: { action: 'close', name: '../x' } });
      check('closing an invalid session name is rejected as isError', closeInvalid.isError === true);

      // --- browser_session: close "a", then re-navigate "a" gets a fresh session ---
      const closeA = await client.callTool({ name: 'browser_session', arguments: { action: 'close', name: 'a' } });
      check('closing session "a" succeeds', closeA.isError !== true, textOf(closeA));
      const listAfterCloseA = textOf(await client.callTool({ name: 'browser_session', arguments: { action: 'list' } }));
      check('session "a" no longer appears in the list after closing', !/- a:/.test(listAfterCloseA), listAfterCloseA);

      await client.callTool({ name: 'browser_navigate', arguments: { url: localUrl, session: 'a' } });
      const readAAfterRecreate = await evaluateJson(client, 'a', "() => localStorage.getItem('marker')");
      check('re-using session "a" after close gets a fresh browser (no leftover localStorage)', readAAfterRecreate.ok && readAAfterRecreate.value === null, readAAfterRecreate.raw);
      const listAfterRecreateA = textOf(await client.callTool({ name: 'browser_session', arguments: { action: 'list' } }));
      check('session "a" reappears in the list once reused', /- a:/.test(listAfterRecreateA), listAfterRecreateA);

      // --- browser_session: close_all closes every secondary, leaves default,
      //     AND actually frees the browser processes (not just bookkeeping) ---
      const procCountBeforeCloseAll = chromiumProcessCount();
      const closeAll = await client.callTool({ name: 'browser_session', arguments: { action: 'close_all' } });
      check('close_all does not error', closeAll.isError !== true, textOf(closeAll));
      const listAfterCloseAll = textOf(await client.callTool({ name: 'browser_session', arguments: { action: 'list' } }));
      check('close_all leaves only the default session', listAfterCloseAll.includes('1 session(s)') && /- default \(default\)/.test(listAfterCloseAll), listAfterCloseAll);
      if (procCountBeforeCloseAll !== undefined) {
        // Give the OS a beat to actually reap the closed browser processes.
        await new Promise(resolve => setTimeout(resolve, 500));
        const procCountAfterCloseAll = chromiumProcessCount();
        check(
          'close_all actually frees browser processes (not just router bookkeeping)',
          procCountAfterCloseAll < procCountBeforeCloseAll,
          `before=${procCountBeforeCloseAll} after=${procCountAfterCloseAll}`
        );
      } else {
        console.log('SKIP - close_all frees browser processes (pgrep unavailable in this environment)');
      }

      // default session must still be fully usable after all this session churn
      const finalNav = await client.callTool({ name: 'browser_navigate', arguments: { url: 'data:text/html,<h1>still alive</h1>' } });
      check('default session is still usable after secondary session churn', finalNav.isError !== true, textOf(finalNav).slice(0, 300));
    });
  } finally {
    server.close();
  }
}

async function runIdleSweepScenario() {
  // Short idle timeout so the sweeper's real setInterval loop is exercised
  // end-to-end without waiting anywhere near the 15-minute default. The
  // sweeper checks at most once a minute OR once per idleMs, whichever is
  // smaller (see enhanced/utils/sessions.js), so a small idleMs here also
  // yields a small check interval.
  const idleMs = 700;
  await withClient({ PLAYWRIGHT_MCP_SESSION_IDLE_MS: String(idleMs) }, async client => {
    await client.callTool({ name: 'browser_navigate', arguments: { url: 'data:text/html,<h1>idle-me</h1>', session: 'idle-target' } });
    const listBefore = textOf(await client.callTool({ name: 'browser_session', arguments: { action: 'list' } }));
    check('idle-sweep scenario: session exists right after creation', /- idle-target:/.test(listBefore), listBefore);

    // Wait comfortably past idleMs + one sweep interval.
    await new Promise(resolve => setTimeout(resolve, idleMs * 4));

    const listAfter = textOf(await client.callTool({ name: 'browser_session', arguments: { action: 'list' } }));
    check('idle sweeper auto-closes a session idle past PLAYWRIGHT_MCP_SESSION_IDLE_MS', !/- idle-target:/.test(listAfter), listAfter);
    check('idle sweeper never touches the default session', /- default \(default\)/.test(listAfter), listAfter);
  });
}

async function main() {
  runUnitChecks();
  await runMainScenario();
  await runIdleSweepScenario();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0)
    process.exitCode = 1;
}

main().catch(e => {
  console.error('FATAL', e);
  process.exitCode = 1;
});
