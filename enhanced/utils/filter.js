/**
 * Ported from the legacy enhancement layer's
 * `packages/playwright-mcp/src/utils/filter.ts`. Filters a YAML-like
 * accessibility-tree snapshot by ARIA role, either keeping only matching
 * roles (ancestors preserved for context) or dropping matching roles
 * (children promoted to the parent's indentation level).
 */
'use strict';

/**
 * @typedef {Object} FilterOptions
 * @property {string[]} [includeRoles]
 * @property {string[]} [excludeRoles]
 */

/**
 * @typedef {Object} FilterMeta
 * @property {boolean} filtered
 * @property {number} totalElements
 * @property {number} returnedCount
 * @property {number} filteredOut
 * @property {'include'|'exclude'} filterType
 * @property {string[]} roles
 */

/**
 * @typedef {Object} ParsedLine
 * @property {number} index
 * @property {number} indent
 * @property {string} role
 * @property {boolean} isElement
 * @property {string} raw
 */

/** @param {string} text @returns {ParsedLine[]} */
function parseLines(text) {
  const lines = text.split('\n');
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const indent = raw.length - raw.trimStart().length;
    const isElement = trimmed.startsWith('- ');
    let role = '';

    if (isElement) {
      const roleMatch = trimmed.match(/^- (\w+)/);
      if (roleMatch)
        role = roleMatch[1].toLowerCase();
    }

    result.push({ index: i, indent, role, isElement, raw });
  }

  return result;
}

/** @param {ParsedLine[]} parsed @param {string[]} roles @returns {Set<number>} */
function filterByIncludeRoles(parsed, roles) {
  const lowerRoles = roles.map(r => r.toLowerCase());
  const keepIndices = new Set();

  for (let i = 0; i < parsed.length; i++) {
    const line = parsed[i];
    if (!line.isElement)
      continue;

    if (lowerRoles.includes(line.role)) {
      keepIndices.add(i);

      let currentIndent = line.indent;
      for (let j = i - 1; j >= 0 && currentIndent > 0; j--) {
        const prev = parsed[j];
        if (prev.isElement && prev.indent < currentIndent) {
          keepIndices.add(j);
          currentIndent = prev.indent;
        }
      }
    }
  }

  return keepIndices;
}

/** @param {ParsedLine[]} parsed @param {string[]} roles @returns {string[]} */
function filterByExcludeRoles(parsed, roles) {
  const lowerRoles = roles.map(r => r.toLowerCase());
  const result = [];
  const excludedIndents = [];

  for (const line of parsed) {
    while (excludedIndents.length > 0 && line.isElement && line.indent <= excludedIndents[excludedIndents.length - 1])
      excludedIndents.pop();

    if (line.isElement && lowerRoles.includes(line.role)) {
      excludedIndents.push(line.indent);
      continue;
    }

    if (excludedIndents.length > 0) {
      const offset = excludedIndents.length * 2;
      const newIndent = Math.max(0, line.indent - offset);
      result.push(' '.repeat(newIndent) + line.raw.trimStart());
    } else {
      result.push(line.raw);
    }
  }

  return result;
}

/** @param {string} text @returns {number} */
function countElements(text) {
  let count = 0;
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('- '))
      count++;
  }
  return count;
}

/**
 * Filter a YAML-like snapshot text by element roles. `includeRoles` takes
 * priority over `excludeRoles` if both are provided. Empty arrays are
 * treated as not provided.
 * @param {string} snapshotText
 * @param {FilterOptions} options
 * @returns {{ text: string, meta: FilterMeta }}
 */
function filterSnapshotText(snapshotText, options) {
  const includeRoles = options.includeRoles && options.includeRoles.length ? options.includeRoles : undefined;
  const excludeRoles = options.excludeRoles && options.excludeRoles.length ? options.excludeRoles : undefined;

  if (!includeRoles && !excludeRoles) {
    const totalElements = countElements(snapshotText);
    return {
      text: snapshotText,
      meta: {
        filtered: false,
        totalElements,
        returnedCount: totalElements,
        filteredOut: 0,
        filterType: 'include',
        roles: [],
      },
    };
  }

  const parsed = parseLines(snapshotText);
  const totalElements = parsed.filter(l => l.isElement).length;

  if (includeRoles) {
    const keepIndices = filterByIncludeRoles(parsed, includeRoles);

    const resultLines = [];
    for (let i = 0; i < parsed.length; i++) {
      const line = parsed[i];

      if (!line.isElement) {
        let precedingElementKept = false;
        for (let j = i - 1; j >= 0; j--) {
          if (parsed[j].isElement) {
            precedingElementKept = keepIndices.has(j);
            break;
          }
        }
        if (precedingElementKept)
          resultLines.push(line.raw);
        continue;
      }

      if (keepIndices.has(i))
        resultLines.push(line.raw);
    }

    const returnedCount = [...keepIndices].filter(i => parsed[i].isElement).length;
    return {
      text: resultLines.join('\n'),
      meta: {
        filtered: true,
        totalElements,
        returnedCount,
        filteredOut: totalElements - returnedCount,
        filterType: 'include',
        roles: includeRoles,
      },
    };
  }

  const resultLines = filterByExcludeRoles(parsed, excludeRoles);
  const returnedCount = countElements(resultLines.join('\n'));

  return {
    text: resultLines.join('\n'),
    meta: {
      filtered: true,
      totalElements,
      returnedCount,
      filteredOut: totalElements - returnedCount,
      filterType: 'exclude',
      roles: excludeRoles,
    },
  };
}

module.exports = { filterSnapshotText };
