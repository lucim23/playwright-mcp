/**
 * Shared path-confinement helpers used by the hardened `file_download` tool
 * and by the snapshot-file inliner (`utils/snapshotFile.js`).
 *
 * Mirrors upstream's own output-directory convention (`Config.outputDir`,
 * default `<cwd>/.playwright-mcp`, overridable via `PLAYWRIGHT_MCP_OUTPUT_DIR`)
 * so writes/reads performed by the enhancement layer land in the same place
 * users already expect upstream tool output (screenshots, saved snapshots,
 * traces) to live.
 *
 * Note: this intentionally does not replicate upstream's extra fallback of
 * relocating the default directory to the OS tmpdir when `cwd` is a system
 * directory or not writable (see `outputDir()` in coreBundle.js) — that edge
 * case is rare for an MCP server process and the simpler, explicit
 * `config.outputDir` override covers the cases that matter in practice.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Resolve the effective output directory for a given resolved Config object.
 * @param {{ outputDir?: string }} [config]
 * @returns {string} absolute path
 */
function resolveOutputDir(config) {
  if (config && config.outputDir)
    return path.resolve(config.outputDir);
  return path.join(process.cwd(), '.playwright-mcp');
}

/**
 * Whether unrestricted (non-confined) file access has been explicitly opted
 * into. Matches upstream's own guardrail name/spirit
 * (`Config.allowUnrestrictedFileAccess` / `PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS`),
 * plus an enhancement-layer-specific env var for callers who only want to
 * unlock this for our added tools without changing upstream's own flag.
 * @param {{ allowUnrestrictedFileAccess?: boolean }} [config]
 * @returns {boolean}
 */
function unrestrictedFileAccessAllowed(config) {
  if (config && config.allowUnrestrictedFileAccess === true)
    return true;
  const env = process.env.PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS
    ?? process.env.PLAYWRIGHT_MCP_UNRESTRICTED_FILE_ACCESS;
  return env === '1' || env === 'true';
}

/**
 * Resolve `targetPath` (absolute or relative to the output dir) and confirm
 * it is confined within `baseDir`, unless unrestricted access is allowed.
 *
 * @param {string} targetPath
 * @param {string} baseDir absolute path
 * @param {boolean} unrestricted
 * @returns {{ ok: true, resolved: string } | { ok: false, reason: string }}
 */
function confine(targetPath, baseDir, unrestricted) {
  const resolved = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(baseDir, targetPath);

  if (unrestricted)
    return { ok: true, resolved };

  const relative = path.relative(baseDir, resolved);
  const isConfined = relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  if (!isConfined) {
    return {
      ok: false,
      reason: `Path "${targetPath}" resolves to "${resolved}", which is outside the allowed output ` +
        `directory "${baseDir}". Set PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS=1 (or ` +
        `config.allowUnrestrictedFileAccess) to disable this guardrail.`,
    };
  }
  return { ok: true, resolved };
}

/**
 * Ensure the parent directory of `filePath` exists.
 * @param {string} filePath
 */
function ensureParentDir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

module.exports = {
  resolveOutputDir,
  unrestrictedFileAccessAllowed,
  confine,
  ensureParentDir,
  tmpdir: os.tmpdir,
};
