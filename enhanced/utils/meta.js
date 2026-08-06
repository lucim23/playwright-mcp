/**
 * Ported (and lightly adapted) from the legacy enhancement layer's
 * `packages/playwright-mcp/src/utils/meta.ts`. Builds a small "### Meta"
 * markdown section appended to tool responses to explain what the
 * enhancement layer did (truncation, filtering, snapshot suppression, etc.)
 * so callers aren't surprised by missing content.
 */
'use strict';

/**
 * @typedef {Object} ResponseMeta
 * @property {boolean} [truncated]
 * @property {number} [returnedCount]
 * @property {number} [totalCount]
 * @property {number} [limit]
 * @property {boolean} [snapshotDisabled]
 * @property {string} [disabledReason]
 * @property {string} [hint]
 * @property {string} [format]
 * @property {boolean} [filtered]
 * @property {number} [filteredOut]
 * @property {string} [filterType]
 * @property {string[]} [filterRoles]
 * @property {boolean} [snapshotInlined]
 * @property {boolean} [snapshotInlineUnavailable]
 * @property {string} [snapshotInlineUnavailableReason]
 */

/**
 * Format meta information as a markdown section.
 * @param {ResponseMeta} meta
 * @returns {string}
 */
function formatMetaAsMarkdown(meta) {
  const lines = [];

  if (meta.truncated) {
    lines.push(`- Truncated: yes (returned ${meta.returnedCount} of ${meta.totalCount})`);
    if (meta.hint)
      lines.push(`- Hint: ${meta.hint}`);
  }

  if (meta.snapshotDisabled) {
    lines.push('- Snapshot: disabled');
    if (meta.disabledReason)
      lines.push(`- Reason: ${meta.disabledReason}`);
  }

  if (meta.format)
    lines.push(`- Format: ${meta.format}`);

  if (meta.filtered) {
    lines.push(`- Filtered: yes (${meta.filterType} ${(meta.filterRoles || []).join(', ')})`);
    if (meta.filteredOut)
      lines.push(`- Filtered out: ${meta.filteredOut} elements`);
  }

  if (meta.snapshotInlined)
    lines.push('- Snapshot: inlined from saved file with shaping applied');

  if (meta.snapshotInlineUnavailable) {
    lines.push('- Snapshot: inline requested but unavailable');
    if (meta.snapshotInlineUnavailableReason)
      lines.push(`- Reason: ${meta.snapshotInlineUnavailableReason}`);
  }

  return lines.length > 0 ? lines.join('\n') : '';
}

/**
 * Add a meta section to response text. No-op if meta has nothing to say.
 * @param {string} responseText
 * @param {ResponseMeta} meta
 * @returns {string}
 */
function appendMetaToResponse(responseText, meta) {
  const metaMarkdown = formatMetaAsMarkdown(meta);
  if (!metaMarkdown)
    return responseText;
  return `${responseText}\n\n### Meta\n${metaMarkdown}`;
}

module.exports = { formatMetaAsMarkdown, appendMetaToResponse };
