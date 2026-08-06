# Enhancement layer (`enhanced/`)

This directory is a purely additive enhancement layer built on top of
upstream `@playwright/mcp`'s public `createConnection` export. It does not
modify any upstream file (the only exception, `package.json`, is documented
below). It replaces the old fork's `packages/playwright-mcp/src/*`
monkey-patch layer, which broke twice as upstream restructured (see issues
#6, #8, #9 — EP-1 / TK-2 / TK-3).

Tracking: GitHub issues [#8](../../issues/8) (TK-2, build the layer) and
[#9](../../issues/9) (TK-3, regression gate).

## Why this exists

Upstream v0.0.79 flattened the repo and moved the entire MCP tool
implementation into an esbuild bundle (`playwright-core/lib/coreBundle.js`).
The only stable integration point it exposes is `createConnection` (via this
repo's own `index.js` / `index.d.ts`). The old fork's hooks — a `cli.js`
require-cache patch and a direct import of `playwright/lib/mcp/index.js` —
no longer exist. This layer is rebuilt against that reality: it wraps the
public `createConnection`, never reaches into `playwright-core` internals
except through the same public module path `index.js` itself already uses
(`playwright-core/lib/coreBundle`, one specific function of which,
`resolveCLIConfigForMCP`, is used non-critically — see "Config resolution"
below), and fails loudly instead of silently if its interception point ever
changes shape.

## Mechanism

`enhanced/index.js` exports `createConnection(config)`, which:

1. Calls `require('../index.js').createConnection(config)` — upstream, unmodified.
2. Reads the returned MCP SDK `Server`'s private `_requestHandlers` Map.
3. Replaces the `tools/list` and `tools/call` entries with wrappers that call
   through to the original handlers and then apply enhancements.

This is the **only** interception mechanism used anywhere in this layer — no
second CLI-side monkeypatch. If `_requestHandlers`, or the `tools/list`
/`tools/call` handlers on it, are missing or not functions, `createConnection`
**throws immediately** with a descriptive error. This layer has broken
silently twice before (once via the `cli.js` require-cache patch, once via
the `packages/*` -> flat-repo + coreBundle move); the fix here is: never
again — degrade loudly, not silently.

## What's kept, dropped, and why

All of this was verified against a **live `tools/list`/`tools/call`** of
`@playwright/mcp` 0.0.79 (`playwright-core` 1.63.0-alpha-2026-08-05), not
assumed from the legacy fork, because upstream changed several things since
the fork's merge-base (~v0.0.63):

| Legacy fork had | Upstream v0.0.79 status | This layer |
|---|---|---|
| Always-inline image data, image auto-scaling | Now native (`scaleImageToFitMessage`, inline-unless-filename) | Dropped — redundant |
| Output dir + `outputMaxSize` eviction | Now native (`Config.outputDir`, `PLAYWRIGHT_MCP_OUTPUT_DIR`) | Dropped — redundant; `file_download` and the snapshot-file reader *reuse* this same directory/env var for consistency |
| `since` param on console/network tools | Superseded by native `all: boolean` | Dropped |
| `browser_run_code` | Renamed `browser_run_code_unsafe` | `maxOutputLength` ported under the new name |
| `ref` param on click/hover/drag/select_option | Renamed `target` (drag: `startTarget`/`endTarget`) | All confirmation-message builders updated |
| `browser_check`/`browser_uncheck`/`browser_navigate_forward`/`browser_reload` | Still exist in the full tool catalog but are `skillOnly: true` — **not reachable via `tools/call`** (verified: returns `Tool "..." not found`); check/uncheck folded into `browser_fill_form`'s `fields[].type` | Excluded from the action-tool list — nothing to enhance on an uncallable tool |
| `returnSnapshot` on action tools | Upstream's own default response for action tools changed: the auto-attached snapshot is now a **file link** (`- [Snapshot](.playwright-mcp/page-....yml)`), not inline YAML (only a direct `browser_snapshot` call without `filename` stays inline — verified via `Response.resolveClientFile`/`snapshotToFile` in coreBundle.js) | Kept, reworked: `false` (our default) strips the Page/Snapshot sections down to a one-line confirmation; `true` reads the linked file back (confined to the output dir) and inlines it with shaping applied — see below |
| Snapshot shaping (`maxElements`/`format`/`includeRoles`/`excludeRoles`) | Not native | Kept on `browser_snapshot`, and extended to action tools' `returnSnapshot: true` path via the file-read above |
| Screenshot quality tiers (thumbnail/medium/full) + `jpegQuality` | Upstream's `browser_take_screenshot` schema has **no** `quality`/`jpegQuality` property at all — only `type` (`png`/`jpeg`/`webp`, default `png`) | **Dropped as infeasible.** The enhancement layer only injects `type: 'jpeg'` into the call arguments when the caller didn't specify one (overriding upstream's own `png` default). There is no argument to inject for quality/resolution because upstream doesn't read one; reproducing it would require decoding/re-encoding the already-serialized image buffer in the response, which the task brief explicitly asked NOT to do (that's the "temp-dir relocation" style of legacy behavior this layer intentionally does not port) |
| Temp-dir screenshot relocation, forced inline image data, response text-scraping | — | Dropped per issue #8 |
| `file_download` (unsandboxed: arbitrary path, no size/time bound) | — | Rebuilt hardened (see below) |
| `test-mcp-client.py` | — | Ported + extended (issue #9); Node equivalent added since it needs no `mcp` pip package but this environment has no `pip` at all — see `enhanced/tests/` |

### Snapshot shaping on action tools — how `returnSnapshot: true` works now

Because upstream now returns a *file link* for the auto-attached snapshot on
action tools, `returnSnapshot: true` reads that file back (path resolved
relative to the server process's cwd, exactly like upstream's own
`Response._computeRelativeTo`, then re-confined to the configured output
directory as a defense-in-depth check — see `enhanced/utils/outputDir.js`),
applies `snapshotMaxElements`/`snapshotFormat`/`snapshotIncludeRoles`/
`snapshotExcludeRoles`, and inlines the result in place of the link. If the
file can't be read (confinement rejection, race, `snapshot.mode: 'none'`,
etc.), the response is left exactly as upstream produced it, with a `### Meta`
note explaining why inlining didn't happen — it never fabricates content or
turns an otherwise-successful action into an error.

## Tools with enhanced parameters

Action tools (all currently-callable, per the table above) get:
`returnSnapshot`, `snapshotMaxElements`, `snapshotFormat`,
`snapshotIncludeRoles`, `snapshotExcludeRoles`:
`browser_click`, `browser_type`, `browser_hover`, `browser_drag`,
`browser_select_option`, `browser_press_key`, `browser_navigate`,
`browser_navigate_back`, `browser_fill_form`, `browser_file_upload`,
`browser_wait_for`, `browser_resize`.

Other tools:
- `browser_snapshot`: `format`, `maxElements`, `includeRoles`, `excludeRoles`
- `browser_console_messages`: `limit`, `countOnly`
- `browser_network_requests`: `limit`, `countOnly`
- `browser_evaluate`: `maxOutputLength` (default 10000)
- `browser_run_code_unsafe`: `maxOutputLength` (default 50000)
- `browser_take_screenshot`: `type` default overridden to `jpeg` (upstream default is `png`) — only when the caller gave neither `type` nor `filename`; if a `filename` is given, upstream's own extension-based inference is left alone so a `filename: "foo.png"` call doesn't silently get jpeg bytes written into a `.png`-named file
- `file_download` (new tool, see below)

Every `tools/list` entry also has any `outputSchema` field defensively
stripped (cheap, harmless insurance against an MCP protocol validation error,
since this layer's wrapped responses are unstructured text/image content).

## `file_download` — hardening

Rebuilt from scratch (`enhanced/tools/fileDownload.js`) per the EP-1 study
report's findings (legacy version wrote to an arbitrary path with no
size/time bound):

- **http/https only** — `file:`, `data:`, `ftp:`, etc. rejected outright.
- **Confined to the output directory** (`Config.outputDir` /
  `PLAYWRIGHT_MCP_OUTPUT_DIR`, default `<cwd>/.playwright-mcp`) — path
  traversal (`../..`) and absolute paths outside it are rejected, unless
  `PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS=1` (mirrors upstream's own
  `allowUnrestrictedFileAccess` guardrail name/spirit) is set.
- **Size cap** (default 100MB, configurable per call via `maxBytes`) enforced
  both against `Content-Length` up front *and* against actual streamed bytes
  — a server that lies about or omits `Content-Length` cannot exceed it. See
  `enhanced/tests/fileDownload.test.mjs` for a raw-socket test that proves
  the streaming check works independent of headers.
- **Timeout** (default 60s, configurable via `timeoutMs`) for the whole
  operation.
- **Redirects followed** up to a 5-hop limit, re-validating the scheme on
  every hop.
- **Partial files are deleted** on any failure (bad status, size exceeded,
  timeout, network error).
- Returns the resolved path, byte count, and content-type on success.

**Known, deliberate gap:** no SSRF protection (resolving the hostname and
rejecting private/loopback/link-local IP ranges). The EP-1 study report
flagged this as a risk, but it wasn't part of TK-2's explicit hardening
checklist and was left out rather than silently added as unscoped behavior.
Flagging as a follow-up if the owner wants it.

## Config resolution (`enhanced/cli.js` / `enhanced/utils/config.js`)

`enhanced/cli.js` is a thin stdio-only CLI. It does not reimplement
upstream's ~50-flag Commander surface. Instead it calls
`tools.resolveCLIConfigForMCP(cliOptions, env)` from
`playwright-core/lib/coreBundle` — the same function upstream's own
`decorateMCPCommand` calls internally — which reads **every**
`PLAYWRIGHT_MCP_*` env var and merges a `--config <file>` /
`PLAYWRIGHT_MCP_CONFIG` JSON file and a curated subset of CLI flags
(`--headless`, `--browser`, `--output-dir`,
`--allow-unrestricted-file-access`, `--isolated`, `--user-data-dir`,
`--executable-path`, `--port`, `--host`, `--caps`) on top, applying the same
defaults/validation upstream's own CLI does.

This function is reachable via `playwright-core`'s own public
`./lib/coreBundle` export path (the same module `index.js` requires) but is
**not** part of `@playwright/mcp`'s documented API (only `createConnection`
is, via `index.d.ts`). It is therefore treated as less trustworthy than the
`createConnection` interception: if it's missing or throws, `enhanced/cli.js`
prints a loud warning to stderr and falls back to a small hand-rolled
env/config-file resolver covering just the flags above — degraded, but
visibly so.

For anything not covered by the curated flag list, use `PLAYWRIGHT_MCP_*` env
vars or `--config <file>` (full upstream `Config` shape), or run the
unmodified root `cli.js` directly (you'll lose the enhancement layer, but
get upstream's full flag surface).

## Deviation from the task brief: implementation language

The brief allowed either TypeScript-with-a-build-step or plain modern JS,
at the implementer's judgment, "state it." This layer is plain CommonJS
(matching the style of the repo root's own `index.js`/`cli.js`, and of
`playwright-core/lib/coreBundle.js` which it wraps), with JSDoc type
annotations where useful. Reasoning: the layer is moderate-sized but not
large, upstream's own integration surface is intentionally plain JS with
only `.d.ts` files for types, and a TS build step is one more place a
"forgot to rebuild" bug could hide, working against the goal of a
low-maintenance additive layer that's cheap to keep in sync across upstream
rolls. No `enhanced/tsconfig.json` exists as a result.

## Known limitation: npm packaging

`.npmignore` at the repo root uses an allow-list (`**/*` then explicit
`!file` un-ignores) and was intentionally **not** modified here (the task
brief restricted upstream-file changes to `package.json` only). This means
`npm pack`/`npm publish` would currently **exclude** `enhanced/` from the
published tarball, silently breaking the `playwright-mcp-enhanced` bin entry
for anyone who installs via `npm install @playwright/mcp` rather than a git
checkout. This only matters if/when this fork is actually published to npm;
local use (this repo checked out, `npm install`, `node enhanced/cli.js`) is
unaffected and is what was verified. Flagging as a required follow-up before
any npm publish — either add `!enhanced` / `!enhanced/**` to `.npmignore`,
or switch to a `package.json` `"files"` allow-list.

## Running the tests

```bash
npm run test:enhanced
# or individually:
node enhanced/tests/fileDownload.test.mjs   # unit-level file_download hardening (local HTTP/raw-socket server only)
node enhanced/tests/smoke.mjs               # end-to-end: real subprocess, real stdio MCP client
python3 enhanced/tests/test-mcp-client.py   # same idea, raw JSON-RPC over stdio, stdlib only (no `mcp` pip package needed)
```

`smoke.mjs` launches a real headless Chromium via `enhanced/cli.js`, so a
browser must be installed (`npx playwright install chromium` if needed).
