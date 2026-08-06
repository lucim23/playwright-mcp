/**
 * Ported from the legacy enhancement layer's
 * `packages/playwright-mcp/src/utils/truncate.ts`. Pure string/array
 * truncation helpers used to bound tool output size.
 */
'use strict';

/**
 * @typedef {Object} TruncationMeta
 * @property {boolean} truncated
 * @property {number} returnedCount
 * @property {number} totalCount
 * @property {number} [limit]
 */

/**
 * Truncate a string to a maximum length.
 * @param {string} text
 * @param {number} maxLength
 * @returns {{ text: string, meta: TruncationMeta }}
 */
function truncateString(text, maxLength) {
  const total = text.length;
  const truncated = total > maxLength;
  const resultText = truncated ? text.slice(0, maxLength) + '...[truncated]' : text;

  return {
    text: resultText,
    meta: {
      truncated,
      returnedCount: Math.min(total, maxLength),
      totalCount: total,
      limit: maxLength,
    },
  };
}

/**
 * Truncate an array of lines to a maximum count, keeping the most recent
 * (last) entries.
 * @param {string[]} lines
 * @param {number} limit
 * @returns {{ lines: string[], meta: TruncationMeta }}
 */
function truncateLines(lines, limit) {
  const total = lines.length;
  const truncated = total > limit;
  const result = truncated ? lines.slice(-limit) : lines;
  return {
    lines: result,
    meta: {
      truncated,
      returnedCount: result.length,
      totalCount: total,
      limit,
    },
  };
}

/**
 * Truncate YAML-like accessibility-tree snapshot text to a maximum number
 * of top-level elements (lines starting with "- ").
 * @param {string} snapshotText
 * @param {number} maxElements
 * @returns {{ text: string, meta: TruncationMeta }}
 */
function truncateSnapshotText(snapshotText, maxElements) {
  const lines = snapshotText.split('\n');
  const resultLines = [];
  let elementCount = 0;
  let totalElements = 0;

  for (const line of lines) {
    if (line.trim().startsWith('- '))
      totalElements++;
  }

  for (const line of lines) {
    if (line.trim().startsWith('- ')) {
      if (elementCount >= maxElements)
        break;
      elementCount++;
    }
    resultLines.push(line);
  }

  const truncated = totalElements > maxElements;
  if (truncated)
    resultLines.push(`# ... truncated (${totalElements - elementCount} more elements)`);

  return {
    text: resultLines.join('\n'),
    meta: {
      truncated,
      returnedCount: elementCount,
      totalCount: totalElements,
      limit: maxElements,
    },
  };
}

module.exports = { truncateString, truncateLines, truncateSnapshotText };
