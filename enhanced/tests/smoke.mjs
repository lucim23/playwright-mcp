#!/usr/bin/env node
/**
 * Regression gate (TK-3, issue #9) for the enhancement layer.
 *
 * The legacy fork's `test-mcp-client.py` (ported alongside this file as
 * `test-mcp-client.py`, updated for enhanced/cli.js) is a good sanity check
 * but requires `python3` + the `mcp` pip package, which is NOT installed in
 * this environment (`import mcp` fails: ModuleNotFoundError). Per the task
 * brief, this Node-based equivalent substitutes for it here — same
 * assertions, but exercised through the real `@modelcontextprotocol/sdk`
 * Client over a real stdio transport talking to `enhanced/cli.js` as a
 * genuine subprocess (not just in-process handler calls), so it also
 * catches stdio-framing / process-lifecycle issues the in-process probes
 * used during development could not.
 *
 * Asserts:
 *   (a) every enhanced param declared in tools/schemas.js actually appears
 *       in the corresponding tool's tools/list inputSchema
 *   (b) file_download is listed
 *   (c) a tools/call using an enhanced param (browser_navigate with
 *       returnSnapshot:false, against a data: URL — no real network needed)
 *       does not error — this is exactly the check that would have caught
 *       upstream adopting `.strict()` schemas (which would make the extra
 *       param either get rejected outright, or make the enhancement
 *       silently do nothing because the param never reaches our handler)
 *
 * Run with: node enhanced/tests/smoke.mjs
 * Requires a Chromium (or headless shell) install; if missing, run:
 *   npx playwright install chromium
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'enhanced', 'cli.js');

const { enhancedToolSchemas } = require('../tools/schemas.js');

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

async function main() {
  console.log(`Starting: node ${cliPath} --headless (as a real subprocess, stdio transport)`);

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cliPath, '--headless'],
    cwd: repoRoot,
    stderr: 'pipe',
    env: process.env,
  });

  const stderrChunks = [];
  transport.stderr?.on('data', chunk => stderrChunks.push(chunk));

  const client = new Client({ name: 'enhanced-smoke-test', version: '1.0.0' }, { capabilities: {} });

  try {
    await client.connect(transport);

    // --- tools/list ---
    const { tools } = await client.listTools();
    check('tools/list returns a non-empty tool array', Array.isArray(tools) && tools.length > 0, `got ${tools?.length}`);

    const byName = new Map(tools.map(t => [t.name, t]));

    check('file_download is listed', byName.has('file_download'));
    const fd = byName.get('file_download');
    if (fd) {
      check('file_download has url + path in inputSchema', !!fd.inputSchema?.properties?.url && !!fd.inputSchema?.properties?.path);
    }

    check('no tool declares outputSchema (defensive strip)', tools.every(t => !t.outputSchema));

    // (a) every enhanced param appears in tools/list schemas
    for (const [toolName, enhancement] of Object.entries(enhancedToolSchemas)) {
      const tool = byName.get(toolName);
      if (!tool) {
        // Tool not active under default capabilities (e.g. would need
        // extra config.capabilities) — not a failure, just not applicable
        // to this default-config smoke run.
        console.log(`SKIP - ${toolName} not present under default capabilities`);
        continue;
      }
      const props = tool.inputSchema?.properties || {};
      for (const propName of Object.keys(enhancement.additionalProperties || {}))
        check(`${toolName}.inputSchema has enhanced param "${propName}"`, propName in props);
      for (const propName of Object.keys(enhancement.propertyOverrides || {}))
        check(`${toolName}.inputSchema still has overridden param "${propName}"`, propName in props);
    }

    const screenshotTool = byName.get('browser_take_screenshot');
    check('browser_take_screenshot type default is jpeg', screenshotTool?.inputSchema?.properties?.type?.default === 'jpeg');

    // (c) enhanced param accepted without error, against a data: URL (no network)
    const navResult = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'data:text/html,<h1>smoke test</h1>', returnSnapshot: false },
    });
    check('browser_navigate with returnSnapshot:false does not error', navResult.isError !== true, JSON.stringify(navResult).slice(0, 300));
    const navText = navResult.content?.find(c => c.type === 'text')?.text || '';
    check('returnSnapshot:false response omits the Snapshot section', !navText.includes('### Snapshot'), navText.slice(0, 300));
    check('returnSnapshot:false response notes it via Meta', navText.includes('Snapshot: disabled'), navText.slice(0, 300));

    // returnSnapshot:true should inline actual content (guards against a
    // future upstream change silently making this parameter a no-op)
    const clickListResult = await client.callTool({
      name: 'browser_snapshot',
      arguments: {},
    });
    const snapText = clickListResult.content?.find(c => c.type === 'text')?.text || '';
    const refMatch = snapText.match(/\[ref=([^\]]+)\]/);
    check('browser_snapshot returns a ref to interact with', !!refMatch, snapText.slice(0, 300));

    if (refMatch) {
      const navResult2 = await client.callTool({
        name: 'browser_navigate',
        arguments: { url: 'data:text/html,<button id="b">Click me</button>' },
      });
      const snap2 = await client.callTool({ name: 'browser_snapshot', arguments: {} });
      const snap2Text = snap2.content?.find(c => c.type === 'text')?.text || '';
      const ref2Match = snap2Text.match(/\[ref=([^\]]+)\]/);
      check('second browser_snapshot returns a ref for the button', !!ref2Match, snap2Text.slice(0, 300));

      const clickResult = ref2Match
        ? await client.callTool({
          name: 'browser_click',
          arguments: { element: 'Click me button', target: ref2Match[1], returnSnapshot: true, snapshotFormat: 'summary' },
        })
        : undefined;
      check('browser_click with returnSnapshot:true does not error', !!clickResult && clickResult.isError !== true, JSON.stringify(clickResult)?.slice(0, 300));
      const clickText = clickResult?.content?.find(c => c.type === 'text')?.text || '';
      check('returnSnapshot:true inlines shaped snapshot content', clickText.includes('### Snapshot (summary)'), clickText.slice(0, 400));
    } else {
      check('second browser_snapshot returns a ref for the button', false, 'skipped: first browser_snapshot returned no ref');
      check('browser_click with returnSnapshot:true does not error', false, 'skipped: first browser_snapshot returned no ref');
      check('returnSnapshot:true inlines shaped snapshot content', false, 'skipped: first browser_snapshot returned no ref');
    }

    // file_download end-to-end against a tiny local server would need a
    // real listener; unit-level hardening (path traversal, size cap,
    // timeout, redirects) is covered by enhanced/tests/fileDownload.test.mjs
    // against 127.0.0.1. Here we just confirm the tool is reachable and
    // rejects an invalid protocol without crashing the server.
    const fdResult = await client.callTool({
      name: 'file_download',
      arguments: { url: 'ftp://example.com/file.txt', path: 'x.txt' },
    });
    check('file_download rejects non-http(s) protocol via tools/call', fdResult.isError === true);
  } finally {
    await client.close().catch(() => {});
    const stderrText = Buffer.concat(stderrChunks).toString('utf-8');
    if (stderrText.trim())
      console.log(`\nServer stderr:\n${stderrText}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0)
    process.exitCode = 1;
}

main().catch(e => {
  console.error('FATAL', e);
  process.exitCode = 1;
});
