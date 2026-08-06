/**
 * Upstream v0.0.79 changed default behavior for the accessibility snapshot
 * that action tools (click, navigate, ...) attach to their response: instead
 * of embedding the YAML tree inline, it now writes the tree to a file inside
 * the output directory and includes only a markdown link, e.g.:
 *
 *   ### Snapshot
 *   - [Snapshot](.playwright-mcp/page-2026-08-06T08-31-55-876Z.yml)
 *
 * (Confirmed by inspecting `Response.resolveClientFile`/`snapshotToFile` in
 * playwright-core/lib/coreBundle.js — action tools use
 * `_includeSnapshot !== 'explicit'`, which always routes through the file
 * path, whereas a standalone `browser_snapshot` call without `filename` uses
 * `_includeSnapshot === 'explicit'` and stays inline.)
 *
 * This is already far more compact than the legacy fork assumed (which
 * always expected an inline block), but it means `returnSnapshot: true` /
 * snapshot shaping (maxElements/format/includeRoles/excludeRoles) has
 * nothing to shape unless we read the linked file back in. This module does
 * that, confined to the configured output directory for the same reason
 * file_download is confined (defense in depth against a future change that
 * makes the link point somewhere unexpected).
 */
'use strict';

const fs = require('fs/promises');
const path = require('path');

const { resolveOutputDir, unrestrictedFileAccessAllowed, confine } = require('./outputDir');

const SNAPSHOT_LINK_RE = /### Snapshot\n- \[[^\]]*\]\(([^)]+)\)/;

/**
 * If `text` contains a "### Snapshot" section that links to a file (rather
 * than embedding YAML inline), read that file back, confined to the output
 * directory.
 *
 * @param {string} text full tool response text
 * @param {object} [config] resolved Config (for outputDir / allowUnrestrictedFileAccess)
 * @returns {Promise<
 *   | { found: false }
 *   | { found: true, ok: true, matchedText: string, content: string }
 *   | { found: true, ok: false, matchedText: string, reason: string }
 * >}
 */
async function tryReadLinkedSnapshotFile(text, config) {
  const match = text.match(SNAPSHOT_LINK_RE);
  if (!match)
    return { found: false };

  const linkPath = match[1];
  const baseDir = resolveOutputDir(config);
  const unrestricted = unrestrictedFileAccessAllowed(config);
  const absFromCwd = path.isAbsolute(linkPath) ? linkPath : path.resolve(process.cwd(), linkPath);

  const confined = confine(absFromCwd, baseDir, unrestricted);
  if (!confined.ok)
    return { found: true, ok: false, matchedText: match[0], reason: confined.reason };

  try {
    const content = await fs.readFile(confined.resolved, 'utf-8');
    return { found: true, ok: true, matchedText: match[0], content };
  } catch (e) {
    return {
      found: true,
      ok: false,
      matchedText: match[0],
      reason: `Could not read snapshot file "${confined.resolved}": ${e.message}`,
    };
  }
}

module.exports = { tryReadLinkedSnapshotFile, SNAPSHOT_LINK_RE };
