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

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Config } from './config';
import type { BrowserContext } from 'playwright';

/**
 * Enhanced tool parameters that extend the base Playwright MCP tools.
 * These parameters provide fine-grained control over snapshot behavior
 * and output size to reduce token usage.
 */
export interface EnhancedToolParameters {
  /**
   * Action tools (click, type, hover, etc.)
   */
  returnSnapshot?: boolean;

  /**
   * Snapshot tool parameters
   */
  format?: 'full' | 'summary';
  selector?: string;
  maxElements?: number;
  maxDepth?: number;

  /**
   * Console/Network tool parameters
   */
  limit?: number;
  countOnly?: boolean;
  since?: string;

  /**
   * Screenshot tool parameters
   */
  quality?: 'thumbnail' | 'medium' | 'full';
  jpegQuality?: number;

  /**
   * Evaluate/RunCode tool parameters
   */
  maxOutputLength?: number;
  outputFile?: string;
}

/**
 * Response metadata that provides information about truncation and processing
 */
export interface ResponseMeta {
  truncated?: boolean;
  returnedCount?: number;
  totalCount?: number;
  limit?: number;
  snapshotDisabled?: boolean;
  disabledReason?: string;
  hint?: string;
  quality?: string;
  dimensions?: string;
  sizeBytes?: number;
  maxDepthReached?: boolean;
  format?: string;
}

/**
 * Enhanced schemas for tools with additional parameters
 */
export declare const enhancedToolSchemas: {
  browser_click: { additionalProperties: Record<string, any> };
  browser_type: { additionalProperties: Record<string, any> };
  browser_hover: { additionalProperties: Record<string, any> };
  browser_drag: { additionalProperties: Record<string, any> };
  browser_select_option: { additionalProperties: Record<string, any> };
  browser_press_key: { additionalProperties: Record<string, any> };
  browser_navigate: { additionalProperties: Record<string, any> };
  browser_navigate_back: { additionalProperties: Record<string, any> };
  browser_wait_for: { additionalProperties: Record<string, any> };
  browser_resize: { additionalProperties: Record<string, any> };
  browser_snapshot: { additionalProperties: Record<string, any> };
  browser_console_messages: { additionalProperties: Record<string, any> };
  browser_network_requests: { additionalProperties: Record<string, any> };
  browser_take_screenshot: { additionalProperties: Record<string, any> };
  browser_evaluate: { additionalProperties: Record<string, any> };
  browser_run_code: { additionalProperties: Record<string, any> };
};

/**
 * Create an enhanced MCP connection with additional tool parameters
 * for controlling snapshot behavior and output size.
 *
 * This is an enhanced version of the standard createConnection that
 * adds the following capabilities:
 *
 * - returnSnapshot parameter on action tools (default: false)
 * - format, maxElements, maxDepth on browser_snapshot
 * - limit, countOnly on console/network tools
 * - quality on browser_take_screenshot
 * - maxOutputLength on evaluate/run_code
 *
 * @param config - Configuration options
 * @param contextGetter - Optional function to provide a custom BrowserContext
 * @returns Enhanced MCP server
 */
export declare function createConnection(
  config?: Config,
  contextGetter?: () => Promise<BrowserContext>
): Promise<Server>;

/**
 * Apply enhancements to a tool response
 */
export declare function enhanceToolResponse(
  response: { content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>; isError?: boolean },
  context: {
    toolName: string;
    params: Record<string, any>;
    config: {
      snapshotMode?: 'incremental' | 'full' | 'none';
      imageResponses?: 'allow' | 'omit';
    };
  }
): { content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>; isError?: boolean };

/**
 * Utility functions for truncation
 */
export declare function truncateArray<T>(
  array: T[],
  limit: number,
  fromEnd?: boolean
): { items: T[]; meta: { truncated: boolean; returnedCount: number; totalCount: number; limit: number } };

export declare function truncateString(
  text: string,
  maxLength: number
): { text: string; meta: { truncated: boolean; returnedCount: number; totalCount: number; limit: number } };

export declare function truncateSnapshotText(
  snapshotText: string,
  maxElements: number
): { text: string; meta: { truncated: boolean; returnedCount: number; totalCount: number; limit: number } };

/**
 * Utility functions for snapshot summarization
 */
export interface SnapshotSummary {
  pageTitle?: string;
  pageUrl?: string;
  landmarks: string[];
  interactive: {
    buttons: number;
    links: number;
    inputs: number;
    selects: number;
    checkboxes: number;
    radios: number;
    textareas: number;
    total: number;
  };
  content: {
    headings: string[];
    keyText: string[];
    images: number;
    tables: number;
    lists: number;
  };
  totalElements: number;
}

export declare function summarizeSnapshot(
  snapshotText: string,
  options?: { pageTitle?: string; pageUrl?: string }
): SnapshotSummary;

export declare function formatSnapshotSummary(summary: SnapshotSummary): string;

/**
 * Utility functions for building lightweight confirmations
 */
export declare function buildLightweightConfirmation(options: {
  action: string;
  element?: string;
  url?: string;
  previousUrl?: string;
  title?: string;
  dialogMessage?: string;
  dialogType?: string;
  additionalInfo?: string[];
}): string;

export declare function buildClickConfirmation(
  element: string,
  options?: {
    doubleClick?: boolean;
    button?: string;
    url?: string;
    previousUrl?: string;
    title?: string;
  }
): string;

export declare function buildTypeConfirmation(
  element: string,
  textLength: number,
  options?: {
    submitted?: boolean;
    url?: string;
    previousUrl?: string;
    title?: string;
  }
): string;

/**
 * Utility functions for response metadata
 */
export declare function buildResponseMeta(options: {
  truncation?: { truncated: boolean; returnedCount: number; totalCount: number; limit?: number };
  snapshotDisabled?: boolean;
  disabledReason?: string;
  hint?: string;
  quality?: string;
  dimensions?: string;
  sizeBytes?: number;
  format?: string;
}): ResponseMeta;

export declare function formatMetaAsMarkdown(meta: ResponseMeta): string;

export declare function appendMetaToResponse(responseText: string, meta: ResponseMeta): string;
