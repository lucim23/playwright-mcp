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

/**
 * This file defines extended schemas for Playwright MCP tools
 * that add parameters for controlling snapshot behavior and output size.
 */

import { z } from 'zod';

// Common parameters for controlling snapshot behavior
export const returnSnapshotParam = z.boolean()
  .optional()
  .default(false)
  .describe('Whether to include a page snapshot in the response. Default: false. Set to true to receive the accessibility tree after the action.');

// Element schema (base for interaction tools)
export const elementSchema = z.object({
  element: z.string().optional().describe('Human-readable element description used to obtain permission to interact with the element'),
  ref: z.string().describe('Exact target element reference from the page snapshot'),
});

// Enhanced click schema
export const enhancedClickSchema = elementSchema.extend({
  doubleClick: z.boolean().optional().describe('Whether to perform a double click instead of a single click'),
  button: z.enum(['left', 'right', 'middle']).optional().describe('Button to click, defaults to left'),
  modifiers: z.array(z.enum(['Alt', 'Control', 'ControlOrMeta', 'Meta', 'Shift'])).optional().describe('Modifier keys to press'),
  returnSnapshot: returnSnapshotParam,
});

// Enhanced type schema
export const enhancedTypeSchema = elementSchema.extend({
  text: z.string().describe('Text to type into the element'),
  submit: z.boolean().optional().describe('Whether to submit entered text (press Enter after)'),
  slowly: z.boolean().optional().describe('Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.'),
  returnSnapshot: returnSnapshotParam,
});

// Enhanced hover schema
export const enhancedHoverSchema = elementSchema.extend({
  returnSnapshot: returnSnapshotParam,
});

// Enhanced drag schema
export const enhancedDragSchema = z.object({
  startElement: z.string().describe('Human-readable source element description used to obtain the permission to interact with the element'),
  startRef: z.string().describe('Exact source element reference from the page snapshot'),
  endElement: z.string().describe('Human-readable target element description used to obtain the permission to interact with the element'),
  endRef: z.string().describe('Exact target element reference from the page snapshot'),
  returnSnapshot: returnSnapshotParam,
});

// Enhanced select option schema
export const enhancedSelectOptionSchema = elementSchema.extend({
  values: z.array(z.string()).describe('Array of values to select in the dropdown. This can be a single value or multiple values.'),
  returnSnapshot: returnSnapshotParam,
});

// Enhanced press key schema
export const enhancedPressKeySchema = z.object({
  key: z.string().describe('Name of the key to press or a character to generate, such as `ArrowLeft` or `a`'),
  returnSnapshot: returnSnapshotParam,
});

// Enhanced fill form schema (for browser_fill_form if it exists)
export const enhancedFillFormSchema = z.object({
  fields: z.record(z.string()).describe('Object mapping field names/labels to values to fill'),
  returnSnapshot: returnSnapshotParam,
});

// Enhanced navigate schema
export const enhancedNavigateSchema = z.object({
  url: z.string().describe('The URL to navigate to'),
  returnSnapshot: returnSnapshotParam,
});

// Enhanced navigate back/forward schema
export const enhancedNavigateBackSchema = z.object({
  returnSnapshot: returnSnapshotParam,
});

// Enhanced wait schema
export const enhancedWaitSchema = z.object({
  time: z.number().optional().describe('The time to wait in seconds'),
  text: z.string().optional().describe('The text to wait for'),
  textGone: z.string().optional().describe('The text to wait for to disappear'),
  returnSnapshot: returnSnapshotParam,
});

// Enhanced resize schema
export const enhancedResizeSchema = z.object({
  width: z.number().describe('Width of the browser window'),
  height: z.number().describe('Height of the browser window'),
  returnSnapshot: returnSnapshotParam,
});

// Enhanced snapshot schema
export const enhancedSnapshotSchema = z.object({
  filename: z.string().optional().describe('Save snapshot to markdown file instead of returning it in the response.'),
  format: z.enum(['full', 'summary']).optional().default('full').describe('Output format: "full" returns the complete accessibility tree, "summary" returns a compact overview. Default: full'),
  selector: z.string().optional().describe('CSS selector to limit snapshot scope to a specific element and its descendants'),
  maxElements: z.number().int().min(1).max(2000).optional().default(300).describe('Maximum number of elements to include in the snapshot. Default: 300, Max: 2000'),
  maxDepth: z.number().int().min(1).max(20).optional().default(10).describe('Maximum depth of the accessibility tree to traverse. Default: 10, Max: 20'),
  includeRoles: z.array(z.string()).optional().describe('Only include elements with these roles (e.g. ["button", "link", "textbox"]). Ancestor elements are preserved for context. Takes priority over excludeRoles.'),
  excludeRoles: z.array(z.string()).optional().describe('Exclude elements with these roles (e.g. ["generic", "group"]). Children of excluded elements are promoted to their parent level. Ignored if includeRoles is provided.'),
});

// Enhanced console messages schema
export const enhancedConsoleMessagesSchema = z.object({
  level: z.enum(['error', 'warning', 'info', 'debug']).default('info').describe('Level of the console messages to return. Each level includes the messages of more severe levels. Defaults to "info".'),
  filename: z.string().optional().describe('Filename to save the console messages to. If not provided, messages are returned as text.'),
  limit: z.number().int().min(1).max(500).optional().default(50).describe('Maximum number of messages to return. Default: 50, Max: 500'),
  countOnly: z.boolean().optional().default(false).describe('Return only message counts by level instead of full messages'),
  since: z.string().optional().describe('ISO timestamp - return only messages after this time'),
});

// Enhanced network requests schema
export const enhancedNetworkRequestsSchema = z.object({
  includeStatic: z.boolean().default(false).describe('Whether to include successful static resources like images, fonts, scripts, etc. Defaults to false.'),
  filename: z.string().optional().describe('Filename to save the network requests to. If not provided, requests are returned as text.'),
  limit: z.number().int().min(1).max(500).optional().default(50).describe('Maximum number of requests to return. Default: 50, Max: 500'),
  countOnly: z.boolean().optional().default(false).describe('Return only request counts by status/type instead of full request list'),
  format: z.enum(['full', 'compact']).optional().default('full').describe('Output format: "full" includes all details, "compact" shows only method, URL, and status'),
});

// Enhanced screenshot schema
export const enhancedScreenshotSchema = z.object({
  type: z.enum(['png', 'jpeg']).default('jpeg').describe('Image format for the screenshot. Default is jpeg.'),
  filename: z.string().optional().describe('File name to save the screenshot to. Defaults to `page-{timestamp}.{png|jpeg}` if not specified. Prefer relative file names to stay within the output directory.'),
  element: z.string().optional().describe('Human-readable element description used to obtain permission to screenshot the element. If not provided, the screenshot will be taken of viewport. If element is provided, ref must be provided too.'),
  ref: z.string().optional().describe('Exact target element reference from the page snapshot. If not provided, the screenshot will be taken of viewport. If ref is provided, element must be provided too.'),
  fullPage: z.boolean().optional().describe('When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Cannot be used with element screenshots.'),
  quality: z.enum(['thumbnail', 'medium', 'full']).optional().default('medium').describe('Image quality/size: "thumbnail" (~400px width), "medium" (~800px width), "full" (original viewport size). Default: medium'),
  jpegQuality: z.number().int().min(1).max(100).optional().default(80).describe('JPEG quality (1-100) when type is jpeg. Default: 80'),
});

// Enhanced evaluate schema
export const enhancedEvaluateSchema = z.object({
  function: z.string().describe('() => { /* code */ } or (element) => { /* code */ } when element is provided'),
  element: z.string().optional().describe('Human-readable element description used to obtain permission to interact with the element'),
  ref: z.string().optional().describe('Exact target element reference from the page snapshot'),
  maxOutputLength: z.number().int().min(100).max(100000).optional().default(10000).describe('Maximum characters to return in output. Longer outputs will be truncated. Default: 10000'),
});

// Enhanced run code schema
export const enhancedRunCodeSchema = z.object({
  code: z.string().describe('A JavaScript function containing Playwright code to execute. It will be invoked with a single argument, page, which you can use for any page interaction. For example: `async (page) => { await page.getByRole(\'button\', { name: \'Submit\' }).click(); return await page.title(); }`'),
  maxOutputLength: z.number().int().min(100).max(100000).optional().default(50000).describe('Maximum characters to return in output. Longer outputs will be truncated. Default: 50000'),
  outputFile: z.string().optional().describe('Save output to this file instead of returning in response. Useful for large outputs.'),
});

// Export all schema types for use in tool implementations
export type EnhancedClickParams = z.infer<typeof enhancedClickSchema>;
export type EnhancedTypeParams = z.infer<typeof enhancedTypeSchema>;
export type EnhancedHoverParams = z.infer<typeof enhancedHoverSchema>;
export type EnhancedDragParams = z.infer<typeof enhancedDragSchema>;
export type EnhancedSelectOptionParams = z.infer<typeof enhancedSelectOptionSchema>;
export type EnhancedPressKeyParams = z.infer<typeof enhancedPressKeySchema>;
export type EnhancedFillFormParams = z.infer<typeof enhancedFillFormSchema>;
export type EnhancedNavigateParams = z.infer<typeof enhancedNavigateSchema>;
export type EnhancedNavigateBackParams = z.infer<typeof enhancedNavigateBackSchema>;
export type EnhancedWaitParams = z.infer<typeof enhancedWaitSchema>;
export type EnhancedResizeParams = z.infer<typeof enhancedResizeSchema>;
export type EnhancedSnapshotParams = z.infer<typeof enhancedSnapshotSchema>;
export type EnhancedConsoleMessagesParams = z.infer<typeof enhancedConsoleMessagesSchema>;
export type EnhancedNetworkRequestsParams = z.infer<typeof enhancedNetworkRequestsSchema>;
export type EnhancedScreenshotParams = z.infer<typeof enhancedScreenshotSchema>;
export type EnhancedEvaluateParams = z.infer<typeof enhancedEvaluateSchema>;
export type EnhancedRunCodeParams = z.infer<typeof enhancedRunCodeSchema>;
