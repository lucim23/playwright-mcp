/**
 * Ported from the legacy enhancement layer's
 * `packages/playwright-mcp/src/utils/confirmation.ts`. Builds lightweight
 * one-line-ish confirmation text for action tools when `returnSnapshot` is
 * false, so the caller still gets useful feedback without the (now
 * upstream-native) page/snapshot sections.
 */
'use strict';

/**
 * @typedef {Object} ActionConfirmationOptions
 * @property {string} action
 * @property {string} [element]
 * @property {string} [url]
 * @property {string} [previousUrl]
 * @property {string} [title]
 */

/** @param {ActionConfirmationOptions} options @returns {string} */
function buildLightweightConfirmation(options) {
  const lines = [];
  lines.push(`Action completed: ${options.action}`);

  if (options.element)
    lines.push(`Element: ${options.element}`);

  if (options.url && options.previousUrl && options.url !== options.previousUrl)
    lines.push(`Page navigated to: ${options.url}`);
  else if (options.url)
    lines.push(`Page URL: ${options.url}`);

  if (options.title)
    lines.push(`Title: '${options.title}'`);

  return lines.join('\n');
}

function buildClickConfirmation(element, options) {
  options = options || {};
  const clickType = options.doubleClick ? 'Double-clicked' : 'Clicked';
  const buttonInfo = options.button && options.button !== 'left' ? ` (${options.button} button)` : '';
  return buildLightweightConfirmation({
    action: `${clickType} on "${element}"${buttonInfo}`,
    url: options.url,
    title: options.title,
  });
}

function buildTypeConfirmation(element, textLength, options) {
  options = options || {};
  const submitInfo = options.submitted ? ' and submitted' : '';
  return buildLightweightConfirmation({
    action: `Typed ${textLength} characters into "${element}"${submitInfo}`,
    url: options.url,
    title: options.title,
  });
}

function buildHoverConfirmation(element, options) {
  options = options || {};
  return buildLightweightConfirmation({
    action: `Hovered over "${element}"`,
    url: options.url,
    title: options.title,
  });
}

function buildDragConfirmation(startElement, endElement, options) {
  options = options || {};
  return buildLightweightConfirmation({
    action: `Dragged from "${startElement}" to "${endElement}"`,
    url: options.url,
    title: options.title,
  });
}

function buildSelectConfirmation(element, values, options) {
  options = options || {};
  return buildLightweightConfirmation({
    action: `Selected "${(values || []).join(', ')}" in "${element}"`,
    url: options.url,
    title: options.title,
  });
}

function buildPressKeyConfirmation(key, options) {
  options = options || {};
  return buildLightweightConfirmation({
    action: `Pressed key "${key}"`,
    url: options.url,
    title: options.title,
  });
}

function buildNavigationConfirmation(url, options) {
  options = options || {};
  const actionName = options.action || 'Navigated';
  // Note: the destination is already stated in the action line, so `url` is
  // deliberately not also passed to buildLightweightConfirmation as a
  // separate "Page URL:" line (that would just repeat it).
  return buildLightweightConfirmation({
    action: `${actionName} to ${url}`,
    title: options.title,
  });
}

function buildWaitConfirmation(options) {
  let action;
  switch (options.waitType) {
    case 'time':
      action = `Waited for ${options.value} seconds`;
      break;
    case 'text':
      action = `Waited for text "${options.value}" to appear`;
      break;
    case 'textGone':
      action = `Waited for text "${options.value}" to disappear`;
      break;
    default:
      action = 'Wait completed';
  }
  return buildLightweightConfirmation({ action, url: options.url, title: options.title });
}

function buildFillFormConfirmation(fieldCount, options) {
  options = options || {};
  return buildLightweightConfirmation({
    action: `Filled ${fieldCount} form field${fieldCount === 1 ? '' : 's'}`,
    url: options.url,
    title: options.title,
  });
}

function buildFileUploadConfirmation(pathCount, options) {
  options = options || {};
  return buildLightweightConfirmation({
    action: pathCount ? `Uploaded ${pathCount} file${pathCount === 1 ? '' : 's'}` : 'File chooser cancelled',
    url: options.url,
    title: options.title,
  });
}

module.exports = {
  buildLightweightConfirmation,
  buildClickConfirmation,
  buildTypeConfirmation,
  buildHoverConfirmation,
  buildDragConfirmation,
  buildSelectConfirmation,
  buildPressKeyConfirmation,
  buildNavigationConfirmation,
  buildWaitConfirmation,
  buildFillFormConfirmation,
  buildFileUploadConfirmation,
};
