#!/usr/bin/env node
/**
 * Thin CLI for the enhanced MCP server. Starts the wrapped server
 * (enhanced/index.js) over the MCP SDK's StdioServerTransport.
 *
 * Deliberately does NOT reimplement upstream's full ~50-flag Commander
 * surface (see enhanced/utils/config.js for why and what's covered instead
 * — full PLAYWRIGHT_MCP_* env var support plus a curated subset of common
 * flags, `--config <file>` for anything else). For the full upstream flag
 * surface, run the unmodified `cli.js` at the repo root — you'll just be
 * back to upstream tool behavior without the enhancement layer.
 *
 * Only HTTP/SSE transport is NOT supported here (stdio only); upstream's
 * `server.port`/`server.host` config is accepted (and merged in) for
 * forward-compatibility but this thin CLI always connects stdio.
 */
'use strict';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(`Playwright MCP (enhanced)

Usage: playwright-mcp-enhanced [options]

A thin stdio MCP server wrapping @playwright/mcp's createConnection with an
additive enhancement layer (per-call snapshot control/shaping, output
truncation caps, jpeg-by-default screenshots, a hardened file_download
tool). See ENHANCEMENTS.md at the repo root for details.

Options (curated subset; anything else -> use PLAYWRIGHT_MCP_* env vars or
--config, both of which cover the full upstream Config shape):
  --headless                       Run the browser headless
  --no-headless                    Run the browser headed
  --browser <name>                 chromium | firefox | webkit
  --config <path>                  JSON config file (upstream Config shape)
  --output-dir <dir>                Output directory for saved files
  --allow-unrestricted-file-access  Disable output-dir confinement guardrails
  --isolated                       Don't persist the browser profile
  --user-data-dir <dir>            Browser profile directory
  --executable-path <path>         Browser executable path
  --port <n>                       (accepted, not used by this stdio-only CLI)
  --host <host>                    (accepted, not used by this stdio-only CLI)
  --caps <list>                    Comma-separated tool capabilities
  --help, -h                       Show this help
`);
  process.exit(0);
}

async function main() {
  const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
  const { createConnection } = require('./index.js');
  const { loadConfig } = require('./utils/config');

  const config = await loadConfig(process.argv.slice(2), process.env);
  const server = await createConnection(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write('[playwright-mcp enhanced] MCP server listening on stdio.\n');

  const shutdown = async signal => {
    process.stderr.write(`[playwright-mcp enhanced] Received ${signal}, shutting down.\n`);
    try {
      await server.close();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch(err => {
  process.stderr.write(`[playwright-mcp enhanced] FATAL: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
});
