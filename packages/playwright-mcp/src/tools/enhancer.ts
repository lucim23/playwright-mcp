/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { truncateArray, truncateString, truncateSnapshotText, TruncationMeta } from '../utils/truncate';
import { buildResponseMeta, appendMetaToResponse, ResponseMeta } from '../utils/meta';
import { summarizeSnapshot, formatSnapshotSummary } from '../utils/summary';
import {
  buildClickConfirmation,
  buildTypeConfirmation,
  buildHoverConfirmation,
  buildDragConfirmation,
  buildSelectConfirmation,
  buildPressKeyConfirmation,
  buildNavigationConfirmation,
  buildWaitConfirmation,
} from '../utils/confirmation';

export interface ToolResponse {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

export interface EnhancementContext {
  toolName: string;
  params: Record<string, any>;
  config: {
    snapshotMode?: 'incremental' | 'full' | 'none';
    imageResponses?: 'allow' | 'omit';
  };
}

/**
 * Apply enhancements to a tool response based on the tool name and parameters
 */
export function enhanceToolResponse(
  response: ToolResponse,
  context: EnhancementContext
): ToolResponse {
  const { toolName, params, config } = context;

  // Handle returnSnapshot parameter for action tools
  if (isActionTool(toolName)) {
    if (params.returnSnapshot !== true) {
      // Default is false, so remove snapshot and return confirmation
      return removeSnapshotFromResponse(response, toolName, params);
    } else {
      // returnSnapshot=true: apply snapshot control parameters
      return enhanceActionToolSnapshot(response, params, config);
    }
  }

  // Handle snapshot enhancements
  if (toolName === 'browser_snapshot') {
    return enhanceSnapshotResponse(response, params, config);
  }

  // Handle console message enhancements
  if (toolName === 'browser_console_messages') {
    return enhanceConsoleResponse(response, params);
  }

  // Handle network request enhancements
  if (toolName === 'browser_network_requests') {
    return enhanceNetworkResponse(response, params);
  }

  // Handle evaluate/run_code output truncation
  if (toolName === 'browser_evaluate' || toolName === 'browser_run_code') {
    return enhanceCodeExecutionResponse(response, params);
  }

  return response;
}

/**
 * Enhance snapshot returned by action tools when returnSnapshot=true
 * Applies snapshotMaxElements and snapshotFormat parameters
 */
function enhanceActionToolSnapshot(
  response: ToolResponse,
  params: Record<string, any>,
  config: EnhancementContext['config']
): ToolResponse {
  // Map action tool snapshot params to standard snapshot params
  const snapshotParams = {
    maxElements: params.snapshotMaxElements ?? 300,
    format: params.snapshotFormat ?? 'full'
  };

  // Reuse the snapshot enhancement logic
  return enhanceSnapshotResponse(response, snapshotParams, config);
}

function isActionTool(toolName: string): boolean {
  const actionTools = [
    'browser_click',
    'browser_type',
    'browser_hover',
    'browser_drag',
    'browser_select_option',
    'browser_press_key',
    'browser_fill_form',
    'browser_navigate',
    'browser_navigate_back',
    'browser_navigate_forward',
    'browser_reload',
    'browser_wait_for',
    'browser_resize',
    'browser_file_upload',
    'browser_check',
    'browser_uncheck',
  ];
  return actionTools.includes(toolName);
}

/**
 * Remove snapshot section from response and replace with lightweight confirmation
 */
function removeSnapshotFromResponse(
  response: ToolResponse,
  toolName: string,
  params: Record<string, any>
): ToolResponse {
  if (!response.content || response.content.length === 0) {
    return response;
  }

  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || !textContent.text) {
    return response;
  }

  // Parse the response text and remove the Snapshot section
  const text = textContent.text;
  const sections = text.split(/^### /m);
  const filteredSections: string[] = [];
  let pageUrl = '';
  let pageTitle = '';

  for (const section of sections) {
    if (!section.trim()) continue;

    // Extract page info for confirmation message
    if (section.startsWith('Page')) {
      const urlMatch = section.match(/Page URL: (.+)/);
      const titleMatch = section.match(/Page Title: (.+)/);
      if (urlMatch) pageUrl = urlMatch[1].trim();
      if (titleMatch) pageTitle = titleMatch[1].trim();

      // Keep the Page section but mark it modified
      filteredSections.push('### ' + section);
    } else if (section.startsWith('Snapshot')) {
      // Skip the snapshot section - this is the key optimization
      continue;
    } else if (section.startsWith('Open tabs')) {
      // Keep open tabs section
      filteredSections.push('### ' + section);
    } else {
      // Keep other sections (Error, Result, Ran Playwright code, etc.)
      filteredSections.push('### ' + section);
    }
  }

  // Generate lightweight confirmation based on tool type
  const confirmation = generateConfirmation(toolName, params, pageUrl, pageTitle);

  // Add meta information
  const meta: ResponseMeta = {
    snapshotDisabled: true,
    disabledReason: 'returnSnapshot set to false',
    hint: 'Set returnSnapshot: true to include accessibility tree'
  };

  let resultText = filteredSections.join('').trim();

  // If we removed the snapshot but kept nothing, add the confirmation
  if (!resultText || resultText === '### ') {
    resultText = `### Result\n${confirmation}`;
  } else if (!resultText.includes('### Result')) {
    // Add confirmation to the Result section if it doesn't exist
    resultText = `### Result\n${confirmation}\n\n${resultText}`;
  }

  resultText = appendMetaToResponse(resultText, meta);

  return {
    ...response,
    content: [{ type: 'text', text: resultText }, ...response.content.filter(c => c.type !== 'text')]
  };
}

function generateConfirmation(
  toolName: string,
  params: Record<string, any>,
  url: string,
  title: string
): string {
  switch (toolName) {
    case 'browser_click':
      return buildClickConfirmation(params.element || params.ref, {
        doubleClick: params.doubleClick,
        button: params.button,
        url,
        title
      });
    case 'browser_type':
      return buildTypeConfirmation(params.element || params.ref, params.text?.length || 0, {
        submitted: params.submit,
        url,
        title
      });
    case 'browser_hover':
      return buildHoverConfirmation(params.element || params.ref, { url, title });
    case 'browser_drag':
      return buildDragConfirmation(params.startElement || params.startRef, params.endElement || params.endRef, { url, title });
    case 'browser_select_option':
      return buildSelectConfirmation(params.element || params.ref, params.values || [], { url, title });
    case 'browser_press_key':
      return buildPressKeyConfirmation(params.key, { url, title });
    case 'browser_navigate':
      return buildNavigationConfirmation(params.url, { title, action: 'Navigated' });
    case 'browser_navigate_back':
      return buildNavigationConfirmation(url, { title, action: 'Navigated back' });
    case 'browser_navigate_forward':
      return buildNavigationConfirmation(url, { title, action: 'Navigated forward' });
    case 'browser_reload':
      return buildNavigationConfirmation(url, { title, action: 'Reloaded page' });
    case 'browser_wait_for':
      if (params.time) {
        return buildWaitConfirmation({ waitType: 'time', value: params.time, url, title });
      } else if (params.text) {
        return buildWaitConfirmation({ waitType: 'text', value: params.text, url, title });
      } else if (params.textGone) {
        return buildWaitConfirmation({ waitType: 'textGone', value: params.textGone, url, title });
      }
      return `Wait completed\nURL: ${url}\nTitle: ${title}`;
    case 'browser_resize':
      return `Resized viewport to ${params.width}x${params.height}\nURL: ${url}\nTitle: ${title}`;
    default:
      return `Action completed: ${toolName}\nURL: ${url}\nTitle: ${title}`;
  }
}

/**
 * Enhance snapshot response with truncation and format options
 */
function enhanceSnapshotResponse(
  response: ToolResponse,
  params: Record<string, any>,
  config: EnhancementContext['config']
): ToolResponse {
  if (!response.content || response.content.length === 0) {
    return response;
  }

  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || !textContent.text) {
    return response;
  }

  const text = textContent.text;

  // Extract the snapshot section
  const snapshotMatch = text.match(/### Snapshot\n```yaml\n([\s\S]*?)```/);
  if (!snapshotMatch) {
    return response;
  }

  const snapshotText = snapshotMatch[1];
  const maxElements = params.maxElements ?? 300;
  const format = params.format ?? 'full';

  let processedSnapshot: string;
  let meta: ResponseMeta = {};

  if (format === 'summary') {
    // Generate summary format
    const pageMatch = text.match(/Page URL: (.+)/);
    const titleMatch = text.match(/Page Title: (.+)/);
    const summary = summarizeSnapshot(snapshotText, {
      pageUrl: pageMatch?.[1]?.trim(),
      pageTitle: titleMatch?.[1]?.trim()
    });
    processedSnapshot = formatSnapshotSummary(summary);
    meta.format = 'summary';
  } else {
    // Apply truncation for full format
    const truncated = truncateSnapshotText(snapshotText, maxElements);
    processedSnapshot = truncated.text;
    meta = buildResponseMeta({ truncation: truncated.meta });
  }

  // Replace the snapshot in the response
  let newText = text.replace(
    /### Snapshot\n```yaml\n[\s\S]*?```/,
    `### Snapshot\n\`\`\`yaml\n${processedSnapshot}\`\`\``
  );

  // Add meta section
  newText = appendMetaToResponse(newText, meta);

  return {
    ...response,
    content: [{ type: 'text', text: newText }, ...response.content.filter(c => c.type !== 'text')]
  };
}

/**
 * Enhance console messages response with limit and countOnly options
 */
function enhanceConsoleResponse(
  response: ToolResponse,
  params: Record<string, any>
): ToolResponse {
  if (!response.content || response.content.length === 0) {
    return response;
  }

  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || !textContent.text) {
    return response;
  }

  const text = textContent.text;
  const limit = params.limit ?? 50;
  const countOnly = params.countOnly ?? false;

  // Extract the Result section
  const resultMatch = text.match(/### Result\n([\s\S]*?)(?=###|$)/);
  if (!resultMatch) {
    return response;
  }

  const resultContent = resultMatch[1].trim();
  const lines = resultContent.split('\n');

  // Parse header to get counts
  const headerMatch = lines[0]?.match(/Total messages: (\d+) \(Errors: (\d+), Warnings: (\d+)\)/);

  if (countOnly && headerMatch) {
    // Return only counts
    const totalCount = parseInt(headerMatch[1]);
    const errorCount = parseInt(headerMatch[2]);
    const warningCount = parseInt(headerMatch[3]);

    const countResult = [
      `Console message counts:`,
      `- Total: ${totalCount}`,
      `- Errors: ${errorCount}`,
      `- Warnings: ${warningCount}`,
      `- Info/Other: ${totalCount - errorCount - warningCount}`
    ].join('\n');

    const newText = text.replace(/### Result\n[\s\S]*?(?=###|$)/, `### Result\n${countResult}\n\n`);

    return {
      ...response,
      content: [{ type: 'text', text: newText }, ...response.content.filter(c => c.type !== 'text')]
    };
  }

  // Apply limit to messages (skip header lines)
  const headerLines = lines.slice(0, 2); // First two lines are headers
  const messageLines = lines.slice(2);

  if (messageLines.length > limit) {
    const truncatedMessages = messageLines.slice(-limit);
    const meta: ResponseMeta = {
      truncated: true,
      returnedCount: limit,
      totalCount: messageLines.length,
      limit,
      hint: 'Increase limit parameter to see more messages'
    };

    const newResultContent = [...headerLines, ...truncatedMessages].join('\n');
    let newText = text.replace(/### Result\n[\s\S]*?(?=###|$)/, `### Result\n${newResultContent}\n\n`);
    newText = appendMetaToResponse(newText, meta);

    return {
      ...response,
      content: [{ type: 'text', text: newText }, ...response.content.filter(c => c.type !== 'text')]
    };
  }

  return response;
}

/**
 * Enhance network requests response with limit and format options
 */
function enhanceNetworkResponse(
  response: ToolResponse,
  params: Record<string, any>
): ToolResponse {
  if (!response.content || response.content.length === 0) {
    return response;
  }

  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || !textContent.text) {
    return response;
  }

  const text = textContent.text;
  const limit = params.limit ?? 50;
  const countOnly = params.countOnly ?? false;
  const format = params.format ?? 'full';

  // Extract the Result section
  const resultMatch = text.match(/### Result\n([\s\S]*?)(?=###|$)/);
  if (!resultMatch) {
    return response;
  }

  const resultContent = resultMatch[1].trim();
  const lines = resultContent.split('\n').filter(l => l.trim());

  if (countOnly) {
    // Count requests by status code
    const statusCounts: Record<string, number> = {};
    for (const line of lines) {
      const statusMatch = line.match(/=> \[(\d+|FAILED)\]/);
      if (statusMatch) {
        const status = statusMatch[1];
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      }
    }

    const countResult = [
      `Network request counts (total: ${lines.length}):`,
      ...Object.entries(statusCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([status, count]) => `- ${status}: ${count}`)
    ].join('\n');

    const newText = text.replace(/### Result\n[\s\S]*?(?=###|$)/, `### Result\n${countResult}\n\n`);

    return {
      ...response,
      content: [{ type: 'text', text: newText }, ...response.content.filter(c => c.type !== 'text')]
    };
  }

  // Apply limit
  if (lines.length > limit) {
    const truncatedLines = lines.slice(-limit);
    const meta: ResponseMeta = {
      truncated: true,
      returnedCount: limit,
      totalCount: lines.length,
      limit,
      hint: 'Increase limit parameter to see more requests'
    };

    let newText = text.replace(/### Result\n[\s\S]*?(?=###|$)/, `### Result\n${truncatedLines.join('\n')}\n\n`);
    newText = appendMetaToResponse(newText, meta);

    return {
      ...response,
      content: [{ type: 'text', text: newText }, ...response.content.filter(c => c.type !== 'text')]
    };
  }

  return response;
}

/**
 * Enhance code execution response with output truncation
 */
function enhanceCodeExecutionResponse(
  response: ToolResponse,
  params: Record<string, any>
): ToolResponse {
  if (!response.content || response.content.length === 0) {
    return response;
  }

  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || !textContent.text) {
    return response;
  }

  const text = textContent.text;
  const maxOutputLength = params.maxOutputLength ?? 10000;

  // Extract the Result section
  const resultMatch = text.match(/### Result\n([\s\S]*?)(?=###|$)/);
  if (!resultMatch) {
    return response;
  }

  const resultContent = resultMatch[1];

  if (resultContent.length > maxOutputLength) {
    const truncatedResult = truncateString(resultContent, maxOutputLength);
    const meta: ResponseMeta = {
      truncated: true,
      returnedCount: maxOutputLength,
      totalCount: resultContent.length,
      hint: 'Reduce output in your function or increase maxOutputLength'
    };

    let newText = text.replace(/### Result\n[\s\S]*?(?=###|$)/, `### Result\n${truncatedResult.text}\n\n`);
    newText = appendMetaToResponse(newText, meta);

    return {
      ...response,
      content: [{ type: 'text', text: newText }, ...response.content.filter(c => c.type !== 'text')]
    };
  }

  return response;
}
