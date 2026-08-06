/**
 * Config resolution for the thin `enhanced/cli.js` entry point.
 *
 * The upstream CLI's full flag surface (~50 flags) is wired up by
 * `tools.decorateMCPCommand` deep inside playwright-core/lib/coreBundle.js,
 * built on top of Commander, and is not itself exported as something we can
 * drive without also pulling in Commander's program object. Re-implementing
 * that whole surface would be a lot of code to keep in sync with upstream
 * for very little benefit, since `createConnection(config)` only needs a
 * plain resolved Config object.
 *
 * Instead we call `tools.resolveCLIConfigForMCP(cliOptions, env)` — the same
 * function `decorateMCPCommand` itself calls internally — directly. It reads
 * *all* `PLAYWRIGHT_MCP_*` env vars (see configFromEnv in coreBundle.js) and
 * merges a config file (`--config` / `PLAYWRIGHT_MCP_CONFIG`) and a handful
 * of CLI-shaped overrides on top, applying the same defaults/validation
 * upstream's own CLI does. This gives full env-var parity essentially for
 * free, at the cost of depending on a function that is reachable via
 * playwright-core's public `./lib/coreBundle` export path (same module
 * `index.js` itself requires) but is NOT part of `@playwright/mcp`'s own
 * documented API surface (only `createConnection` is, via index.d.ts).
 *
 * Because of that, this is guarded: if `resolveCLIConfigForMCP` disappears
 * or changes shape in a future roll, we fall back to a small hand-rolled
 * subset (the handful of env vars/flags spelled out below) and print a
 * loud warning to stderr — degraded but visibly so, never silently.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CLI_FLAGS = new Map([
  ['--headless', { key: 'headless', type: 'boolean' }],
  ['--no-headless', { key: 'headless', type: 'boolean', value: false }],
  ['--browser', { key: 'browser', type: 'string' }],
  ['--config', { key: 'config', type: 'string' }],
  ['--output-dir', { key: 'outputDir', type: 'string' }],
  ['--allow-unrestricted-file-access', { key: 'allowUnrestrictedFileAccess', type: 'boolean' }],
  ['--isolated', { key: 'isolated', type: 'boolean' }],
  ['--user-data-dir', { key: 'userDataDir', type: 'string' }],
  ['--executable-path', { key: 'executablePath', type: 'string' }],
  ['--port', { key: 'port', type: 'number' }],
  ['--host', { key: 'host', type: 'string' }],
  ['--caps', { key: 'caps', type: 'string' }],
]);

/**
 * Parse the curated subset of CLI flags documented above (`enhanced/cli.js
 * --help` prints the full list). Anything else is ignored — advanced
 * configuration should go through env vars or `--config <file>`, which
 * cover the full upstream Config shape.
 * @param {string[]} argv
 */
function parseCliOptions(argv) {
  /** @type {Record<string, any>} */
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const spec = CLI_FLAGS.get(arg);
    if (!spec)
      continue;
    if (spec.type === 'boolean') {
      options[spec.key] = spec.value === undefined ? true : spec.value;
    } else {
      const value = argv[i + 1];
      i++;
      if (spec.type === 'number')
        options[spec.key] = Number(value);
      else
        options[spec.key] = value;
    }
  }
  if (options.caps)
    options.caps = String(options.caps).split(',').map(s => s.trim()).filter(Boolean);
  return options;
}

function resolveAllowUnrestrictedFileAccess(cliOptions, env, fileConfig) {
  if (cliOptions.allowUnrestrictedFileAccess !== undefined)
    return cliOptions.allowUnrestrictedFileAccess;
  if (env.PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS !== undefined)
    return env.PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS === '1' || env.PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS === 'true';
  return fileConfig.allowUnrestrictedFileAccess;
}

/** Minimal fallback env mapping used only if resolveCLIConfigForMCP is unavailable. */
function fallbackConfigFromEnv(env, cliOptions) {
  const configFile = cliOptions.config || env.PLAYWRIGHT_MCP_CONFIG;
  let fileConfig = {};
  if (configFile) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(path.resolve(configFile), 'utf-8'));
    } catch (e) {
      throw new Error(`[playwright-mcp enhanced] Could not read --config file "${configFile}": ${e.message}`);
    }
  }

  const headless = cliOptions.headless !== undefined
    ? cliOptions.headless
    : env.PLAYWRIGHT_MCP_HEADLESS !== undefined ? env.PLAYWRIGHT_MCP_HEADLESS === 'true' : undefined;

  return {
    ...fileConfig,
    browser: {
      browserName: cliOptions.browser || env.PLAYWRIGHT_MCP_BROWSER || undefined,
      isolated: cliOptions.isolated ?? (env.PLAYWRIGHT_MCP_ISOLATED === 'true' ? true : undefined),
      userDataDir: cliOptions.userDataDir || env.PLAYWRIGHT_MCP_USER_DATA_DIR || undefined,
      launchOptions: {
        headless,
        executablePath: cliOptions.executablePath || env.PLAYWRIGHT_MCP_EXECUTABLE_PATH || undefined,
      },
      ...(fileConfig.browser || {}),
    },
    outputDir: cliOptions.outputDir || env.PLAYWRIGHT_MCP_OUTPUT_DIR || fileConfig.outputDir,
    allowUnrestrictedFileAccess: resolveAllowUnrestrictedFileAccess(cliOptions, env, fileConfig),
    server: cliOptions.port || cliOptions.host ? { port: cliOptions.port, host: cliOptions.host } : fileConfig.server,
    capabilities: cliOptions.caps || fileConfig.capabilities,
  };
}

/**
 * Resolve a Config object for `createConnection` from CLI argv + env vars,
 * preferring upstream's own resolution logic when available.
 * @param {string[]} argv process.argv.slice(2)
 * @param {NodeJS.ProcessEnv} env
 */
async function loadConfig(argv, env) {
  const cliOptions = parseCliOptions(argv);

  let resolveCLIConfigForMCP;
  try {
    ({ tools: { resolveCLIConfigForMCP } } = require('playwright-core/lib/coreBundle'));
  } catch (e) {
    resolveCLIConfigForMCP = undefined;
  }

  if (typeof resolveCLIConfigForMCP === 'function') {
    try {
      return await resolveCLIConfigForMCP(cliOptions, env);
    } catch (e) {
      process.stderr.write(
        `[playwright-mcp enhanced] WARNING: tools.resolveCLIConfigForMCP threw (${e.message}). ` +
        'Falling back to a minimal hand-rolled env/config-file resolver that only understands a ' +
        'subset of PLAYWRIGHT_MCP_* env vars. Advanced configuration may not be applied. This ' +
        'usually means an upstream playwright-core roll changed internals enhanced/utils/config.js ' +
        'depends on non-contractually.\n'
      );
    }
  } else {
    process.stderr.write(
      '[playwright-mcp enhanced] WARNING: tools.resolveCLIConfigForMCP is not available in this ' +
      'playwright-core build. Falling back to a minimal hand-rolled env/config-file resolver that ' +
      'only understands a subset of PLAYWRIGHT_MCP_* env vars. Advanced configuration may not be ' +
      'applied.\n'
    );
  }

  return fallbackConfigFromEnv(env, cliOptions);
}

module.exports = { loadConfig, parseCliOptions, CLI_FLAGS };
