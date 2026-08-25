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
4. (Named sessions, issue #13/TK-6) Wraps the primary server's `initialize`
   entry too, but purely to *capture* the real client's handshake for reuse
   by secondary sessions — the wrapper always forwards to, and returns
   exactly what came back from, the original handler. See "Named browser
   sessions" below for why secondary sessions need this at all.

This is the **only** interception mechanism used anywhere in this layer — no
second CLI-side monkeypatch. If `_requestHandlers`, or the `tools/list`
/`tools/call` handlers on it, are missing or not functions, `createConnection`
**throws immediately** with a descriptive error (this guard is shared code —
`enhanced/utils/handlers.js` — used both for the primary server here and for
every secondary session `enhanced/utils/sessions.js` creates). This layer has
broken silently twice before (once via the `cli.js` require-cache patch, once
via the `packages/*` -> flat-repo + coreBundle move); the fix here is: never
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
- `browser_session` (new tool, see "Named browser sessions" below)

Every real (upstream) tool in `tools/list` — i.e. every browser tool, which
in practice means every tool except `file_download` and `browser_session`
themselves — also gets a `session` param; see "Named browser sessions" below.

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

## Named browser sessions (issue [#13](../../issues/13), TK-6)

Clients keep their existing config unchanged (e.g.
`npx -y github:lucim23/playwright-mcp --isolated`, stdio) but can now drive
multiple **independent, isolated browsers** from the same MCP connection by
passing an optional `session: "<name>"` string on any browser tool call.
Different names get their own browser (own cookies/storage/tabs); the same
name always routes back to the same browser across calls.

### Semantics

- **No `session` param, or `session: "default"`** → the **default session**,
  which *is* the primary server this layer already creates today — same
  object, same handlers, same responses. This is a hard backward-compat
  requirement: nothing about the default session's behavior, timing, or
  identity changed to build this feature (see "Verification" below).
- **Any other name** → lazily creates (on first use of that name) a whole
  second upstream connection (`require('../index.js').createConnection()`,
  the same call this layer already wraps for the primary session) and routes
  that call — and every subsequent call using the same name — to it instead.
- **Secondary sessions always launch their own brand-new, independent
  browser process** — regardless of the primary session's own
  isolated/persistent/CDP/remote/extension setting. A persistent (on-disk)
  profile is inherently single-owner (upstream itself throws `"Browser is
  already in use for <dir>..."` if two processes try to share one), and a
  remote/CDP/extension endpoint is inherently a *shared* target, so there is
  no correct way to give two *named* sessions independent state while
  either of those apply — always launching a fresh local browser is the only
  option that actually delivers "independent browsers" unconditionally. This
  is implemented by `enhanced/utils/sessions.js`'s `launchSecondaryBrowser`,
  which calls `playwright-core`'s standard **public** `chromium`/`firefox`/
  `webkit` launchers directly (not upstream's own isolated-mode code path)
  and hands the resulting context to upstream via `createConnection`'s
  existing `contextGetter` parameter. See "Why secondary sessions launch
  their own browser" in that file's module doc comment for the full
  reasoning, including a real bug this design fixes — see "session
  teardown actually frees the browser process" below.
- Session names: non-empty strings, letters/digits/`_`/`-` only, max 64
  characters. Anything else (path separators, `..`, dots, whitespace,
  control characters, wrong type, too long) is rejected with an `isError`
  text response — never thrown, never silently coerced.
- The `session` key is always stripped from the arguments actually forwarded
  to the underlying tool, so it never reaches upstream's own Zod validation
  (relying on upstream silently ignoring an unrecognized property would be
  fragile — a future `.strict()` schema change upstream could turn that into
  a hard error).

### The initialize-handshake wrinkle

Upstream's browser backend isn't created when `createConnection()` returns —
it's created lazily, on a server's first `tools/call`, by an internal
`initializeServer()` helper (`playwright-core/lib/coreBundle.js`) that reads
`server.getClientCapabilities()` / `server.getClientVersion()` (both only
populated once the MCP SDK's `Server` has actually processed a real
`initialize` request over a transport) to build the `clientInfo` object
`{ cwd, clientName }` passed to the backend factory. A secondary session's
`Server` is never `.connect()`-ed to any transport, so it would never
receive that handshake and those accessors would stay `undefined` forever.

Fix (verified empirically, not assumed — see `enhanced/tests/sessions.test.mjs`
and the "Verification" note below): every secondary session's own
`initialize` request handler — which the SDK's `Server` base class always
registers in `_requestHandlers` at construction time, transport or not — is
invoked directly, in-process, right after the session's connection is
created, with a synthesized request:
`{ method: 'initialize', params: { protocolVersion, capabilities: {}, clientInfo } }`.
`capabilities` is deliberately synthesized empty (no `roots`) so upstream's
`initializeServer()` never attempts `server.listRoots()` — which would try
to send a request over a transport that doesn't exist — on a session with
no transport; `clientInfo.cwd` then falls back to `process.cwd()` via
upstream's own `firstRootPath([])`, which only affects where an isolated
session's default traces directory resolves to. `clientInfo.name` /
`protocolVersion` mirror the **primary** session's real handshake when
available (`enhanced/index.js` wraps the primary server's own `initialize`
handler purely to capture, never alter, those values — the real client's
handshake is forwarded to upstream completely unchanged) with a
`(session:<name>)` suffix; a hardcoded fallback identity is used if that
capture isn't available for some reason. See the module-level comment in
`enhanced/utils/sessions.js` for the full trace through the SDK internals.

### `browser_session` — session management tool

New tool, registered alongside `file_download`. `action`:

- `"list"` — every session's name, creation time, last-used time, and
  whether it's the default.
- `"close"` (requires `name`) — closes one named secondary session. Closing
  `"default"` is rejected (`isError`, with an explanation) — the default
  session is the primary MCP connection itself and closing it would break
  the client's own connection.
- `"close_all"` — closes every secondary session, leaving the default
  session untouched.

Closing a session runs, in order (each step best-effort — a failure is
logged to stderr, never thrown, so it can't block the rest): (1) that
session's own `browser_close` tool (the real upstream tool name — verified
via `tools/list`, not assumed from the legacy fork, which used
`browser_run_code`/`ref`-era naming since superseded — see the table near
the top of this doc) through its own `tools/call` handler; (2)
`server.close()` on the session's MCP `Server` object; (3) `context.close()`
then `browser.close()` directly on the `playwright-core` objects this
router launched itself. The session is removed from the router's map only
after all of these have been attempted, so a subsequent use of the same
name always gets a genuinely fresh browser, not a stale reference.

#### Session teardown actually frees the browser process (not just bookkeeping)

This was **not** true in an earlier version of this feature, and was only
caught by empirically counting OS processes (`pgrep`), not by reading code:
upstream's own `createConnection()` (`playwright-core/lib/coreBundle.js`)
constructs its `BrowserBackend` with no `disposeCallback` — that's the one
thing that would actually call `browser.close()`, and it's only ever
supplied by upstream's own CLI/daemon entry points, not by the public
`createConnection()` this layer wraps. So steps (1) and (2) above dispose
open tabs and release the MCP `Server` object, but **do not** close the
underlying browser process — it would otherwise keep running, orphaned,
until the *entire* `enhanced/cli.js` process exits (at which point
playwright-core's own process-level exit-handler safety net finally reaps
it). For a long-lived server juggling many named sessions over time, that
would mean every `close`/`close_all`/idle-cleanup silently leaked a browser
process.

Because secondary sessions launch their own browser+context (see
"Semantics" above), this router holds direct references to them and closes
them directly in step (3) — which is what actually frees the process, and
does so immediately, not just at server shutdown. Verified with a `pgrep`
process-count check before/after `close_all` (both manually during
development and as an automated best-effort assertion in
`enhanced/tests/sessions.test.mjs`, skipped gracefully if `pgrep` isn't
available in the test environment).

### Idle cleanup

Secondary sessions unused for `PLAYWRIGHT_MCP_SESSION_IDLE_MS` (default 15
minutes; `0` disables idle cleanup entirely; an invalid/missing value falls
back to the default rather than silently disabling cleanup) are closed
automatically by a single `setInterval(...).unref()` sweeper (checked at
most once a minute, or once per `idleMs` if that's shorter) so it never
keeps the process alive on its own. The default session is never
idle-closed. Every automatic closure is logged to stderr.

### Example: instructing an agent to use two sessions

```
Use session "buyer" for the buyer flow and session "seller" for the seller
flow — they need independent logins and cookies. Navigate session "buyer"
to https://example.com/login and log in as buyer@example.com, then
separately navigate session "seller" to the same URL and log in as
seller@example.com. When you're done, call browser_session with
action "close_all" to clean them both up (or just leave them — they'll be
closed automatically after 15 minutes of idling).
```

Concretely, that means: `browser_navigate({ url: ..., session: "buyer" })`,
`browser_click({ target: ..., session: "buyer" })`,
`browser_navigate({ url: ..., session: "seller" })`, etc. — every browser
tool call just carries the same `session` string for calls that belong to
the same logical browser.

### Verification

`enhanced/tests/sessions.test.mjs` (wired into `npm run test:enhanced`
between the pack and smoke gates) covers: pure-function unit checks
(`validateSessionName`, `cloneConfigForSecondary`, `resolveIdleMs`); two
named sessions navigating to different `data:` URLs and ending up with
distinct current-page URLs; `localStorage` isolation between two named
sessions *and* the default session at the same real origin (proving
genuinely separate browser contexts, not just separate tabs); the `session`
param being combined with an existing enhanced param (`returnSnapshot`) and
stripped without upstream rejecting the call; invalid/unknown/default-name
rejection paths; the close → reuse → fresh-session lifecycle; a `pgrep`-based
check (best-effort, skipped if unavailable) that `close_all` actually
reduces the number of live browser processes rather than only updating this
router's own bookkeeping; and a live, short-timeout
(`PLAYWRIGHT_MCP_SESSION_IDLE_MS`) run of the real idle sweeper actually
closing an idle session (process included) while leaving the default alone.
Default-path parity is asserted by `enhanced/tests/smoke.mjs` itself staying
green **unchanged** — that file was not modified by this feature at all,
which is the actual parity gate.

## Surviving `browser_close` on a long-lived connection (issue [#15](../../issues/15))

Upstream's `browser_close` marks its response `isClose`, which disposes the
whole backend: `Context.dispose()` clears the tabs **and removes the
browser-context `"page"` event listener**, while the memoized
`_browserContextPromise` survives. Upstream assumes the client disconnects
right after — but a long-lived stdio client (Claude Code keeps one server
across tasks) calls again: `ensureTab()` gets the stale context promise,
`newPage()` succeeds with nobody listening, `_currentTab` stays `undefined`,
and *every* subsequent call fails instantly with
`TypeError: Cannot read properties of undefined (reading 'waitForInitialized')`
until the server process dies.

This layer recovers in the session router (`enhanced/utils/sessions.js`),
without touching any upstream file:

- After a successful `browser_close` through a session's handler,
  `noteBrowserClosed(name)` runs. The **default** session is marked
  `needsRebuild` and lazily gets a fresh upstream connection (same
  config/`contextGetter`, synthesized initialize — the secondary-session
  handshake machinery reused) swapped into its router entry on next use;
  lazy on purpose, since most clients close at the end of a task and never
  call again. A **named** session goes through the router's own full
  teardown (which also closes the browser/context the router launched —
  upstream's close never reaches them, so this fixes a browser-process leak
  for direct `browser_close` calls on named sessions too) and is recreated
  transparently on next use.
- Belt-and-braces: any tool result carrying the exact wedge signature
  triggers `recoverSession(name)` plus a single transparent retry of the
  same request (safe — the wedge throws in `ensureTab()`, before any tool
  action runs). This heals servers wedged through untracked dispose paths,
  including processes started before this fix existed.

`enhanced/tests/closeReuse.test.mjs` pins it end-to-end over real stdio:
navigate → close → navigate must succeed, twice, on the default session and
on a named session, with the default session unaffected by a named
session's close/rebuild churn. Pre-fix that test fails with the exact
`waitForInitialized` TypeError.

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
node enhanced/tests/closeReuse.test.mjs     # end-to-end: browser_close → reuse survives (issue #15)
node enhanced/tests/smoke.mjs               # end-to-end: real subprocess, real stdio MCP client
python3 enhanced/tests/test-mcp-client.py   # same idea, raw JSON-RPC over stdio, stdlib only (no `mcp` pip package needed)
```

`smoke.mjs` launches a real headless Chromium via `enhanced/cli.js`, so a
browser must be installed (`npx playwright install chromium` if needed).
