/**
 * Response-side enhancements applied after the upstream tool handler runs.
 * Ported and substantially reworked from the legacy enhancement layer's
 * `packages/playwright-mcp/src/tools/enhancer.ts` to match upstream v0.0.79's
 * actual response shapes (verified via live tools/call probes against
 * playwright-core 1.63.0-alpha-2026-08-05 — see comments inline for the
 * specific behavior changes this accounts for).
 */
'use strict';

const { truncateString, truncateSnapshotText } = require('../utils/truncate');
const { appendMetaToResponse } = require('../utils/meta');
const { summarizeSnapshot, formatSnapshotSummary } = require('../utils/summary');
const { filterSnapshotText } = require('../utils/filter');
const { tryReadLinkedSnapshotFile } = require('../utils/snapshotFile');
const {
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
} = require('../utils/confirmation');
const { actionToolNames } = require('./schemas');

const INLINE_SNAPSHOT_RE = /### Snapshot\n```yaml\n([\s\S]*?)```/;

/**
 * @param {{ content: Array<{type:string,text?:string}>, isError?: boolean }} response
 * @param {{ toolName: string, params: Record<string, any>, config: any }} context
 */
async function enhanceToolResponse(response, context) {
  const { toolName, params, config } = context;

  if (actionToolNames.has(toolName)) {
    if (response.isError)
      return response; // don't fabricate confirmations or reshape error output
    if (params.returnSnapshot === true)
      return inlineActionToolSnapshot(response, toolName, params, config);
    return removeSnapshotFromResponse(response, toolName, params);
  }

  if (toolName === 'browser_snapshot')
    return enhanceStandaloneSnapshotResponse(response, params);

  if (toolName === 'browser_console_messages')
    return enhanceConsoleResponse(response, params);

  if (toolName === 'browser_network_requests')
    return enhanceNetworkResponse(response, params);

  if (toolName === 'browser_evaluate' || toolName === 'browser_run_code_unsafe')
    return enhanceCodeExecutionResponse(response, params, toolName === 'browser_run_code_unsafe' ? 50000 : 10000);

  return response;
}

function textBlock(response) {
  if (!response.content || response.content.length === 0)
    return undefined;
  return response.content.find(c => c.type === 'text' && c.text);
}

function withReplacedText(response, newText) {
  return {
    ...response,
    content: [{ type: 'text', text: newText }, ...response.content.filter(c => c.type !== 'text')],
  };
}

/** Extract `- Page URL: ...` / `- Page Title: ...` from a "### Page" section. */
function extractPageInfo(text) {
  const urlMatch = text.match(/- Page URL: (.+)/);
  const titleMatch = text.match(/- Page Title: (.+)/);
  return { pageUrl: urlMatch ? urlMatch[1].trim() : undefined, pageTitle: titleMatch ? titleMatch[1].trim() : undefined };
}

/**
 * Apply role filtering + (truncation | summarization) to raw YAML snapshot
 * text. Pure function, format-agnostic about where the text came from
 * (inline block or file read).
 */
function shapeSnapshotText(snapshotText, shapeParams, pageInfo) {
  let text = snapshotText;
  const meta = {};

  if (shapeParams.includeRoles || shapeParams.excludeRoles) {
    const filtered = filterSnapshotText(text, { includeRoles: shapeParams.includeRoles, excludeRoles: shapeParams.excludeRoles });
    text = filtered.text;
    if (filtered.meta.filtered) {
      meta.filtered = true;
      meta.filteredOut = filtered.meta.filteredOut;
      meta.filterType = filtered.meta.filterType;
      meta.filterRoles = filtered.meta.roles;
    }
  }

  if (shapeParams.format === 'summary') {
    const summary = summarizeSnapshot(text, pageInfo);
    meta.format = 'summary';
    return { text: formatSnapshotSummary(summary), meta, isSummary: true };
  }

  const truncated = truncateSnapshotText(text, shapeParams.maxElements ?? 300);
  if (truncated.meta.truncated) {
    meta.truncated = true;
    meta.returnedCount = truncated.meta.returnedCount;
    meta.totalCount = truncated.meta.totalCount;
    meta.limit = truncated.meta.limit;
    meta.hint = 'Increase maxElements (browser_snapshot) or snapshotMaxElements (action tools) to see more';
  }
  return { text: truncated.text, meta, isSummary: false };
}

function renderShapedSnapshotSection(shaped) {
  return shaped.isSummary
    ? `### Snapshot (summary)\n${shaped.text}`
    : `### Snapshot\n\`\`\`yaml\n${shaped.text}\n\`\`\``;
}

/**
 * `browser_snapshot` called directly (not via an action tool). Without a
 * `filename` argument this is still inline YAML (`_includeSnapshot ===
 * 'explicit'` in upstream), so we can shape it in place with a regex.
 */
function enhanceStandaloneSnapshotResponse(response, params) {
  const tc = textBlock(response);
  if (!tc)
    return response;
  const text = tc.text;
  const match = text.match(INLINE_SNAPSHOT_RE);
  if (!match)
    return response; // e.g. filename was given -> only a file link, nothing to shape

  const shapeParams = {
    maxElements: params.maxElements,
    format: params.format,
    includeRoles: params.includeRoles,
    excludeRoles: params.excludeRoles,
  };
  const pageInfo = extractPageInfo(text);
  const shaped = shapeSnapshotText(match[1], shapeParams, pageInfo);
  const newText = text.replace(INLINE_SNAPSHOT_RE, renderShapedSnapshotSection(shaped));
  return withReplacedText(response, appendMetaToResponse(newText, shaped.meta));
}

/**
 * Action tool called with returnSnapshot=true. In upstream v0.0.79 the
 * auto-attached snapshot for action tools is always a file link (see
 * utils/snapshotFile.js for why), so "true" means: read that file back,
 * apply shaping, and inline the result in place of the link. If the link
 * can't be resolved/read (confinement rejection, race, snapshot.mode=none,
 * etc.) we leave the response exactly as upstream produced it and just note
 * why inlining didn't happen — never fabricate content, never error out an
 * otherwise-successful action.
 */
async function inlineActionToolSnapshot(response, toolName, params, config) {
  const tc = textBlock(response);
  if (!tc)
    return response;
  const text = tc.text;

  // Already inline for some reason (e.g. a future upstream change) — shape directly.
  if (INLINE_SNAPSHOT_RE.test(text))
    return enhanceStandaloneSnapshotResponse(response, {
      maxElements: params.snapshotMaxElements,
      format: params.snapshotFormat,
      includeRoles: params.snapshotIncludeRoles,
      excludeRoles: params.snapshotExcludeRoles,
    });

  const fileResult = await tryReadLinkedSnapshotFile(text, config);
  if (!fileResult.found)
    return response; // no snapshot section at all (e.g. snapshot.mode: 'none')

  if (!fileResult.ok) {
    return withReplacedText(response, appendMetaToResponse(text, {
      snapshotInlineUnavailable: true,
      snapshotInlineUnavailableReason: fileResult.reason,
    }));
  }

  const shapeParams = {
    maxElements: params.snapshotMaxElements,
    format: params.snapshotFormat,
    includeRoles: params.snapshotIncludeRoles,
    excludeRoles: params.snapshotExcludeRoles,
  };
  const pageInfo = extractPageInfo(text);
  const shaped = shapeSnapshotText(fileResult.content, shapeParams, pageInfo);
  const newText = text.replace(fileResult.matchedText, renderShapedSnapshotSection(shaped));
  const meta = { ...shaped.meta, snapshotInlined: true };
  return withReplacedText(response, appendMetaToResponse(newText, meta));
}

/**
 * returnSnapshot=false (the enhancement layer's default override). Strips
 * the "### Snapshot" section (whether it's a file link or, in principle,
 * inline YAML) and replaces the response with a short confirmation so the
 * caller isn't paying for tokens they didn't ask for. "### Page",
 * "### Open tabs", "### Modal state" and any "### Error" sections are kept.
 */
function removeSnapshotFromResponse(response, toolName, params) {
  const tc = textBlock(response);
  if (!tc)
    return response;

  const text = tc.text;
  const sections = text.split(/^### /m);
  const kept = [];
  let pageUrl = '';
  let pageTitle = '';
  let hadSnapshot = false;

  for (const section of sections) {
    if (!section.trim())
      continue;
    if (section.startsWith('Page')) {
      const info = extractPageInfo('### ' + section);
      if (info.pageUrl) pageUrl = info.pageUrl;
      if (info.pageTitle) pageTitle = info.pageTitle;
      kept.push('### ' + section);
    } else if (section.startsWith('Snapshot')) {
      hadSnapshot = true;
      // dropped
    } else {
      kept.push('### ' + section);
    }
  }

  if (!hadSnapshot)
    return response; // nothing to strip (e.g. snapshot.mode: 'none') — leave untouched

  // If a "### Page" section is being kept, it already shows URL/Title —
  // don't repeat them in the confirmation line too (defeats some of the
  // point of returnSnapshot=false, which is to minimize tokens).
  const pageSectionKept = kept.some(s => s.startsWith('### Page'));
  const confirmation = generateConfirmation(toolName, params, pageSectionKept ? '' : pageUrl, pageSectionKept ? '' : pageTitle);
  let resultText = kept.join('').trim();
  if (!resultText.includes('### Result'))
    resultText = `### Result\n${confirmation}\n\n${resultText}`.trim();

  const meta = {
    snapshotDisabled: true,
    disabledReason: 'returnSnapshot set to false (default)',
    hint: 'Set returnSnapshot: true to inline the accessibility tree',
  };

  return withReplacedText(response, appendMetaToResponse(resultText, meta));
}

function generateConfirmation(toolName, params, url, title) {
  switch (toolName) {
    case 'browser_click':
      return buildClickConfirmation(params.element || params.target, {
        doubleClick: params.doubleClick,
        button: params.button,
        url,
        title,
      });
    case 'browser_type':
      return buildTypeConfirmation(params.element || params.target, (params.text || '').length, {
        submitted: params.submit,
        url,
        title,
      });
    case 'browser_hover':
      return buildHoverConfirmation(params.element || params.target, { url, title });
    case 'browser_drag':
      return buildDragConfirmation(params.startElement || params.startTarget, params.endElement || params.endTarget, { url, title });
    case 'browser_select_option':
      return buildSelectConfirmation(params.element || params.target, params.values || [], { url, title });
    case 'browser_press_key':
      return buildPressKeyConfirmation(params.key, { url, title });
    case 'browser_navigate':
      return buildNavigationConfirmation(params.url || url, { title, action: 'Navigated' });
    case 'browser_navigate_back':
      return buildNavigationConfirmation(url, { title, action: 'Navigated back' });
    case 'browser_fill_form':
      return buildFillFormConfirmation((params.fields || []).length, { url, title });
    case 'browser_file_upload':
      return buildFileUploadConfirmation((params.paths || []).length, { url, title });
    case 'browser_wait_for':
      if (params.time !== undefined)
        return buildWaitConfirmation({ waitType: 'time', value: params.time, url, title });
      if (params.text)
        return buildWaitConfirmation({ waitType: 'text', value: params.text, url, title });
      if (params.textGone)
        return buildWaitConfirmation({ waitType: 'textGone', value: params.textGone, url, title });
      return `Wait completed\nURL: ${url}\nTitle: ${title}`;
    case 'browser_resize':
      return `Resized viewport to ${params.width}x${params.height}\nURL: ${url}\nTitle: ${title}`;
    default:
      return `Action completed: ${toolName}\nURL: ${url}\nTitle: ${title}`;
  }
}

/** `### Result\nTotal messages: N (Errors: X, Warnings: Y)\n<lines...>` */
function enhanceConsoleResponse(response, params) {
  const tc = textBlock(response);
  if (!tc)
    return response;

  const text = tc.text;
  const limit = params.limit ?? 50;
  const countOnly = params.countOnly ?? false;

  const resultMatch = text.match(/### Result\n([\s\S]*?)(?=###|$)/);
  if (!resultMatch)
    return response;

  const lines = resultMatch[1].trim().split('\n');
  const headerMatch = lines[0] && lines[0].match(/Total messages: (\d+) \(Errors: (\d+), Warnings: (\d+)\)/);

  if (countOnly && headerMatch) {
    const total = parseInt(headerMatch[1], 10);
    const errors = parseInt(headerMatch[2], 10);
    const warnings = parseInt(headerMatch[3], 10);
    const countResult = [
      'Console message counts:',
      `- Total: ${total}`,
      `- Errors: ${errors}`,
      `- Warnings: ${warnings}`,
      `- Info/Other: ${total - errors - warnings}`,
    ].join('\n');
    const newText = text.replace(/### Result\n[\s\S]*?(?=###|$)/, `### Result\n${countResult}\n\n`);
    return withReplacedText(response, newText);
  }

  const headerLines = lines.slice(0, 1);
  const messageLines = lines.slice(1);
  if (messageLines.length > limit) {
    const truncatedMessages = messageLines.slice(-limit);
    const meta = { truncated: true, returnedCount: limit, totalCount: messageLines.length, limit, hint: 'Increase limit to see more messages' };
    const newResultContent = [...headerLines, ...truncatedMessages].join('\n');
    const newText = appendMetaToResponse(text.replace(/### Result\n[\s\S]*?(?=###|$)/, `### Result\n${newResultContent}\n\n`), meta);
    return withReplacedText(response, newText);
  }

  return response;
}

/** `### Result\n1. [GET] https://... => [200]\n2. ...` */
function enhanceNetworkResponse(response, params) {
  const tc = textBlock(response);
  if (!tc)
    return response;

  const text = tc.text;
  const limit = params.limit ?? 50;
  const countOnly = params.countOnly ?? false;

  const resultMatch = text.match(/### Result\n([\s\S]*?)(?=###|$)/);
  if (!resultMatch)
    return response;

  const lines = resultMatch[1].split('\n').filter(l => l.trim());

  if (countOnly) {
    const statusCounts = {};
    for (const line of lines) {
      const statusMatch = line.match(/=> \[(\d+|FAILED)\]/);
      if (statusMatch)
        statusCounts[statusMatch[1]] = (statusCounts[statusMatch[1]] || 0) + 1;
    }
    const countResult = [
      `Network request counts (total: ${lines.length}):`,
      ...Object.entries(statusCounts).sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => `- ${status}: ${count}`),
    ].join('\n');
    const newText = text.replace(/### Result\n[\s\S]*?(?=###|$)/, `### Result\n${countResult}\n\n`);
    return withReplacedText(response, newText);
  }

  if (lines.length > limit) {
    const truncatedLines = lines.slice(-limit);
    const meta = { truncated: true, returnedCount: limit, totalCount: lines.length, limit, hint: 'Increase limit to see more requests' };
    const newText = appendMetaToResponse(text.replace(/### Result\n[\s\S]*?(?=###|$)/, `### Result\n${truncatedLines.join('\n')}\n\n`), meta);
    return withReplacedText(response, newText);
  }

  return response;
}

/** browser_evaluate / browser_run_code_unsafe: `### Result\n<value>\n### Ran Playwright code\n...` */
function enhanceCodeExecutionResponse(response, params, defaultMaxOutputLength) {
  const tc = textBlock(response);
  if (!tc)
    return response;

  const text = tc.text;
  const maxOutputLength = params.maxOutputLength ?? defaultMaxOutputLength;

  const resultMatch = text.match(/### Result\n([\s\S]*?)(?=###|$)/);
  if (!resultMatch)
    return response;

  const resultContent = resultMatch[1];
  if (resultContent.length > maxOutputLength) {
    const truncated = truncateString(resultContent, maxOutputLength);
    const meta = { truncated: true, returnedCount: maxOutputLength, totalCount: resultContent.length, hint: 'Reduce output size or increase maxOutputLength' };
    const newText = appendMetaToResponse(text.replace(/### Result\n[\s\S]*?(?=###|$)/, `### Result\n${truncated.text}\n\n`), meta);
    return withReplacedText(response, newText);
  }

  return response;
}

module.exports = { enhanceToolResponse };
