/**
 * Ported from the legacy enhancement layer's
 * `packages/playwright-mcp/src/utils/summary.ts`. Produces a compact,
 * human-readable overview of a YAML-like accessibility-tree snapshot
 * (landmark regions, interactive element counts, headings, key text)
 * instead of the full tree, for `format: 'summary'`.
 */
'use strict';

/**
 * @param {string} snapshotText
 * @returns {Map<string, number>}
 */
function parseSnapshotElements(snapshotText) {
  const counts = new Map();
  for (const line of snapshotText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('- '))
      continue;
    const roleMatch = trimmed.match(/^- (\w+)/);
    if (roleMatch) {
      const role = roleMatch[1].toLowerCase();
      counts.set(role, (counts.get(role) || 0) + 1);
    }
  }
  return counts;
}

/** @param {string} snapshotText @returns {string[]} */
function extractLandmarks(snapshotText) {
  const landmarks = [];
  const landmarkRoles = ['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'search', 'form', 'region'];
  for (const line of snapshotText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('- '))
      continue;
    for (const role of landmarkRoles) {
      if (trimmed.startsWith(`- ${role}`)) {
        const nameMatch = trimmed.match(/"([^"]+)"/);
        const name = nameMatch ? nameMatch[1] : '';
        landmarks.push(name ? `${role} "${name}"` : role);
        break;
      }
    }
  }
  return landmarks;
}

/** @param {string} snapshotText @returns {string[]} */
function extractHeadings(snapshotText) {
  const headings = [];
  for (const line of snapshotText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('- heading'))
      continue;
    const textMatch = trimmed.match(/"([^"]+)"/);
    if (textMatch)
      headings.push(textMatch[1]);
  }
  return headings.slice(0, 5);
}

/** @param {string} snapshotText @returns {string[]} */
function extractKeyText(snapshotText) {
  const keyText = [];
  for (const line of snapshotText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('- '))
      continue;
    if (trimmed.startsWith('- generic') || trimmed.startsWith('- group'))
      continue;
    const textMatch = trimmed.match(/"([^"]+)"/);
    if (textMatch && textMatch[1].length > 3 && textMatch[1].length < 100) {
      const text = textMatch[1];
      if (!keyText.includes(text))
        keyText.push(text);
    }
    if (keyText.length >= 5)
      break;
  }
  return keyText;
}

/**
 * @param {string} snapshotText
 * @param {{ pageTitle?: string, pageUrl?: string }} [options]
 */
function summarizeSnapshot(snapshotText, options) {
  const counts = parseSnapshotElements(snapshotText);
  const landmarks = extractLandmarks(snapshotText);
  const headings = extractHeadings(snapshotText);
  const keyText = extractKeyText(snapshotText);

  let totalElements = 0;
  for (const line of snapshotText.split('\n')) {
    if (line.trim().startsWith('- '))
      totalElements++;
  }

  return {
    pageTitle: options && options.pageTitle,
    pageUrl: options && options.pageUrl,
    landmarks,
    interactive: {
      buttons: counts.get('button') || 0,
      links: counts.get('link') || 0,
      inputs: (counts.get('textbox') || 0) + (counts.get('searchbox') || 0) + (counts.get('spinbutton') || 0),
      selects: (counts.get('combobox') || 0) + (counts.get('listbox') || 0),
      checkboxes: counts.get('checkbox') || 0,
      radios: counts.get('radio') || 0,
      textareas: counts.get('textbox') || 0,
      total: (counts.get('button') || 0) + (counts.get('link') || 0) +
             (counts.get('textbox') || 0) + (counts.get('combobox') || 0) +
             (counts.get('checkbox') || 0) + (counts.get('radio') || 0),
    },
    content: {
      headings,
      keyText,
      images: counts.get('img') || counts.get('image') || 0,
      tables: counts.get('table') || 0,
      lists: (counts.get('list') || 0) + (counts.get('listitem') || 0),
    },
    totalElements,
  };
}

/** @param {ReturnType<typeof summarizeSnapshot>} summary */
function formatSnapshotSummary(summary) {
  const lines = [];

  if (summary.pageTitle)
    lines.push(`Page: ${summary.pageTitle}`);
  if (summary.pageUrl)
    lines.push(`URL: ${summary.pageUrl}`);
  if (summary.landmarks.length > 0)
    lines.push(`Landmarks: ${summary.landmarks.join(', ')}`);

  const { interactive } = summary;
  const interactiveItems = [];
  if (interactive.buttons) interactiveItems.push(`${interactive.buttons} buttons`);
  if (interactive.links) interactiveItems.push(`${interactive.links} links`);
  if (interactive.inputs) interactiveItems.push(`${interactive.inputs} inputs`);
  if (interactive.selects) interactiveItems.push(`${interactive.selects} selects`);
  if (interactive.checkboxes) interactiveItems.push(`${interactive.checkboxes} checkboxes`);
  if (interactiveItems.length > 0)
    lines.push(`Interactive elements: ${interactiveItems.join(', ')}`);

  if (summary.content.headings.length > 0)
    lines.push(`Headings: ${summary.content.headings.map(h => `"${h}"`).join(', ')}`);
  if (summary.content.keyText.length > 0)
    lines.push(`Key text: ${summary.content.keyText.map(t => `"${t}"`).join(', ')}`);

  lines.push(`Total elements: ${summary.totalElements}`);

  return lines.join('\n');
}

module.exports = { summarizeSnapshot, formatSnapshotSummary };
