#!/usr/bin/env node
/**
 * Unit-level checks for the hardened file_download tool (enhanced/tools/fileDownload.js),
 * run against a local HTTP server on 127.0.0.1 — no external network access.
 *
 * Covers the specific hardening requirements from issue #8 (TK-2):
 *   - path traversal outside the output dir is rejected
 *   - size cap is enforced during streaming, not just from Content-Length
 *   - size cap is enforced even when Content-Length is absent/lying
 *   - non-http(s) protocols are rejected
 *   - redirects are followed, and a redirect loop hits the hop limit
 *   - partial files are cleaned up on failure
 *
 * Not a full test framework — asserts and exits non-zero on first failure,
 * printing a PASS/FAIL summary line per case. Run with:
 *   node enhanced/tests/fileDownload.test.mjs
 */
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { handleFileDownload } = require('../tools/fileDownload.js');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS - ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL - ${name}`);
    console.log(`  ${e && e.stack ? e.stack : e}`);
  }
}

function startServer(handler) {
  return new Promise(resolve => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function serverUrl(server, p) {
  const { port } = server.address();
  return `http://127.0.0.1:${port}${p}`;
}

async function main() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-mcp-enhanced-test-'));
  const outputDir = path.join(tmpRoot, 'output');
  fs.mkdirSync(outputDir, { recursive: true });
  const config = { outputDir };

  // --- Server: small file, big file (unbounded stream), redirect chain, redirect loop ---
  const bigChunk = Buffer.alloc(1024 * 1024, 'a'); // 1MB per chunk
  const server = await startServer((req, res) => {
    if (req.url === '/small.txt') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('hello world');
      return;
    }
    if (req.url === '/huge-no-content-length') {
      // No Content-Length header; stream far more than any reasonable cap,
      // never ending on its own, to prove streaming enforcement kicks in.
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      let sent = 0;
      const interval = setInterval(() => {
        if (res.writableEnded) { clearInterval(interval); return; }
        res.write(bigChunk);
        sent += bigChunk.length;
        if (sent > 500 * 1024 * 1024) { // safety valve, should never be reached
          clearInterval(interval);
          res.end();
        }
      }, 1);
      req.on('close', () => clearInterval(interval));
      return;
    }
    if (req.url === '/huge-content-length') {
      res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': String(500 * 1024 * 1024) });
      res.end(); // never actually sends the body — should be rejected before streaming
      return;
    }
    if (req.url === '/redirect-1') {
      res.writeHead(302, { location: '/redirect-2' });
      res.end();
      return;
    }
    if (req.url === '/redirect-2') {
      res.writeHead(302, { location: '/small.txt' });
      res.end();
      return;
    }
    if (req.url === '/redirect-loop') {
      res.writeHead(302, { location: '/redirect-loop' });
      res.end();
      return;
    }
    if (req.url === '/not-found') {
      res.writeHead(404, {});
      res.end('nope');
      return;
    }
    if (req.url === '/slow') {
      // Never responds within the test's short timeout.
      setTimeout(() => { res.writeHead(200); res.end('late'); }, 5000);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  // Raw TCP server that lies about Content-Length in the HTTP response
  // header (declares 10 bytes, then streams megabytes) — Node's `http`
  // module itself enforces header/body consistency, so a malicious lying
  // server has to be simulated below the http-parsing layer to prove our
  // streaming size check doesn't just trust Content-Length.
  const rawServer = await new Promise(resolve => {
    const s = net.createServer(socket => {
      socket.on('error', () => {}); // client aborting mid-write is expected once the cap trips
      socket.once('data', () => {
        socket.write('HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: 10\r\nConnection: close\r\n\r\n');
        const interval = setInterval(() => {
          if (socket.destroyed || !socket.writable) { clearInterval(interval); return; }
          socket.write(bigChunk, err => { if (err) clearInterval(interval); });
        }, 1);
        socket.on('close', () => clearInterval(interval));
      });
    });
    s.on('error', () => {});
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
  const rawServerUrl = `http://127.0.0.1:${rawServer.address().port}/`;

  try {
    await test('successful download returns path/bytes/contentType', async () => {
      const result = await handleFileDownload({ url: serverUrl(server, '/small.txt'), path: 'small.txt' }, config);
      assert.equal(result.isError, undefined);
      const text = result.content[0].text;
      assert.match(text, /Downloaded/);
      assert.match(text, /bytes: 11/);
      assert.match(text, /contentType: text\/plain/);
      const written = fs.readFileSync(path.join(outputDir, 'small.txt'), 'utf-8');
      assert.equal(written, 'hello world');
    });

    await test('path traversal outside output dir is rejected', async () => {
      const result = await handleFileDownload({ url: serverUrl(server, '/small.txt'), path: '../../etc/passwd' }, config);
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /outside the allowed output directory/);
      assert.ok(!fs.existsSync(path.join(tmpRoot, '..', 'etc', 'passwd')));
    });

    await test('absolute path outside output dir is rejected', async () => {
      const outsidePath = path.join(tmpRoot, 'outside.txt');
      const result = await handleFileDownload({ url: serverUrl(server, '/small.txt'), path: outsidePath }, config);
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /outside the allowed output directory/);
      assert.ok(!fs.existsSync(outsidePath));
    });

    await test('non-http(s) protocol is rejected', async () => {
      const result = await handleFileDownload({ url: 'file:///etc/passwd', path: 'x.txt' }, config);
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /Unsupported protocol/);
    });

    await test('huge Content-Length is rejected before streaming', async () => {
      const target = path.join(outputDir, 'huge-cl.bin');
      const result = await handleFileDownload({ url: serverUrl(server, '/huge-content-length'), path: 'huge-cl.bin', maxBytes: 1024 }, config);
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /exceeds the .* size cap/);
      assert.ok(!fs.existsSync(target), 'partial file must be cleaned up');
    });

    await test('lying Content-Length does not result in an oversized file on disk', async () => {
      // Node's own HTTP client parser is strict about Content-Length vs.
      // actual body framing and will itself reject a response that lies
      // about its length before our streaming byte-counter even gets a
      // meaningful chance to run — so the *exact* error can be either our
      // own size-cap message or a low-level parse error. Either way the
      // invariant that matters is: the download fails, and no partial /
      // oversized file is left on disk. (The no-Content-Length test below
      // is the one that specifically exercises our own streaming counter.)
      const target = path.join(outputDir, 'lying-cl.bin');
      const result = await handleFileDownload({ url: rawServerUrl, path: 'lying-cl.bin', maxBytes: 1024 * 10, timeoutMs: 10000 }, config);
      assert.equal(result.isError, true);
      assert.ok(!fs.existsSync(target) || fs.statSync(target).size <= 1024 * 10, 'must not leave an oversized file on disk');
    });

    await test('unbounded stream with no Content-Length is capped mid-stream', async () => {
      const target = path.join(outputDir, 'huge-nocl.bin');
      const start = Date.now();
      const result = await handleFileDownload({ url: serverUrl(server, '/huge-no-content-length'), path: 'huge-nocl.bin', maxBytes: 5 * 1024 * 1024, timeoutMs: 10000 }, config);
      const elapsed = Date.now() - start;
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /exceeded the .* size cap/);
      assert.ok(!fs.existsSync(target), 'partial file must be cleaned up');
      assert.ok(elapsed < 9000, `should abort quickly once the cap is exceeded, took ${elapsed}ms`);
    });

    await test('redirects are followed to the final resource', async () => {
      const result = await handleFileDownload({ url: serverUrl(server, '/redirect-1'), path: 'redirected.txt' }, config);
      assert.equal(result.isError, undefined);
      assert.equal(fs.readFileSync(path.join(outputDir, 'redirected.txt'), 'utf-8'), 'hello world');
    });

    await test('redirect loop hits the hop limit and fails cleanly', async () => {
      const target = path.join(outputDir, 'loop.txt');
      const result = await handleFileDownload({ url: serverUrl(server, '/redirect-loop'), path: 'loop.txt' }, config);
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /Too many redirects/);
      assert.ok(!fs.existsSync(target));
    });

    await test('non-2xx status is rejected and partial file cleaned up', async () => {
      const target = path.join(outputDir, 'notfound.txt');
      const result = await handleFileDownload({ url: serverUrl(server, '/not-found'), path: 'notfound.txt' }, config);
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /HTTP 404/);
      assert.ok(!fs.existsSync(target));
    });

    await test('timeout is enforced and partial file cleaned up', async () => {
      const target = path.join(outputDir, 'slow.txt');
      const start = Date.now();
      const result = await handleFileDownload({ url: serverUrl(server, '/slow'), path: 'slow.txt', timeoutMs: 500 }, config);
      const elapsed = Date.now() - start;
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /timed out/);
      assert.ok(!fs.existsSync(target));
      assert.ok(elapsed < 4000, `should time out around 500ms, took ${elapsed}ms`);
    });

    await test('filename derived from URL when path omitted', async () => {
      const result = await handleFileDownload({ url: serverUrl(server, '/small.txt') }, config);
      assert.equal(result.isError, undefined);
      assert.ok(fs.existsSync(path.join(outputDir, 'small.txt')));
    });

    await test('unrestricted file access flag allows escaping the output dir', async () => {
      const outsidePath = path.join(tmpRoot, 'unrestricted.txt');
      const result = await handleFileDownload(
        { url: serverUrl(server, '/small.txt'), path: outsidePath },
        { outputDir, allowUnrestrictedFileAccess: true }
      );
      assert.equal(result.isError, undefined);
      assert.ok(fs.existsSync(outsidePath));
      fs.unlinkSync(outsidePath);
    });
  } finally {
    server.close();
    rawServer.close();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0)
    process.exit(1);
}

main().catch(e => {
  console.error('FATAL', e);
  process.exit(1);
});
