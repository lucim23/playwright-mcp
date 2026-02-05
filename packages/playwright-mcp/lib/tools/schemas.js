"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancedRunCodeSchema = exports.enhancedEvaluateSchema = exports.enhancedScreenshotSchema = exports.enhancedNetworkRequestsSchema = exports.enhancedConsoleMessagesSchema = exports.enhancedSnapshotSchema = exports.enhancedResizeSchema = exports.enhancedWaitSchema = exports.enhancedNavigateBackSchema = exports.enhancedNavigateSchema = exports.enhancedFillFormSchema = exports.enhancedPressKeySchema = exports.enhancedSelectOptionSchema = exports.enhancedDragSchema = exports.enhancedHoverSchema = exports.enhancedTypeSchema = exports.enhancedClickSchema = exports.elementSchema = exports.returnSnapshotParam = void 0;
/**
 * This file defines extended schemas for Playwright MCP tools
 * that add parameters for controlling snapshot behavior and output size.
 */
const zod_1 = require("zod");
// Common parameters for controlling snapshot behavior
exports.returnSnapshotParam = zod_1.z.boolean()
    .optional()
    .default(false)
    .describe('Whether to include a page snapshot in the response. Default: false. Set to true to receive the accessibility tree after the action.');
// Element schema (base for interaction tools)
exports.elementSchema = zod_1.z.object({
    element: zod_1.z.string().optional().describe('Human-readable element description used to obtain permission to interact with the element'),
    ref: zod_1.z.string().describe('Exact target element reference from the page snapshot'),
});
// Enhanced click schema
exports.enhancedClickSchema = exports.elementSchema.extend({
    doubleClick: zod_1.z.boolean().optional().describe('Whether to perform a double click instead of a single click'),
    button: zod_1.z.enum(['left', 'right', 'middle']).optional().describe('Button to click, defaults to left'),
    modifiers: zod_1.z.array(zod_1.z.enum(['Alt', 'Control', 'ControlOrMeta', 'Meta', 'Shift'])).optional().describe('Modifier keys to press'),
    returnSnapshot: exports.returnSnapshotParam,
});
// Enhanced type schema
exports.enhancedTypeSchema = exports.elementSchema.extend({
    text: zod_1.z.string().describe('Text to type into the element'),
    submit: zod_1.z.boolean().optional().describe('Whether to submit entered text (press Enter after)'),
    slowly: zod_1.z.boolean().optional().describe('Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.'),
    returnSnapshot: exports.returnSnapshotParam,
});
// Enhanced hover schema
exports.enhancedHoverSchema = exports.elementSchema.extend({
    returnSnapshot: exports.returnSnapshotParam,
});
// Enhanced drag schema
exports.enhancedDragSchema = zod_1.z.object({
    startElement: zod_1.z.string().describe('Human-readable source element description used to obtain the permission to interact with the element'),
    startRef: zod_1.z.string().describe('Exact source element reference from the page snapshot'),
    endElement: zod_1.z.string().describe('Human-readable target element description used to obtain the permission to interact with the element'),
    endRef: zod_1.z.string().describe('Exact target element reference from the page snapshot'),
    returnSnapshot: exports.returnSnapshotParam,
});
// Enhanced select option schema
exports.enhancedSelectOptionSchema = exports.elementSchema.extend({
    values: zod_1.z.array(zod_1.z.string()).describe('Array of values to select in the dropdown. This can be a single value or multiple values.'),
    returnSnapshot: exports.returnSnapshotParam,
});
// Enhanced press key schema
exports.enhancedPressKeySchema = zod_1.z.object({
    key: zod_1.z.string().describe('Name of the key to press or a character to generate, such as `ArrowLeft` or `a`'),
    returnSnapshot: exports.returnSnapshotParam,
});
// Enhanced fill form schema (for browser_fill_form if it exists)
exports.enhancedFillFormSchema = zod_1.z.object({
    fields: zod_1.z.record(zod_1.z.string()).describe('Object mapping field names/labels to values to fill'),
    returnSnapshot: exports.returnSnapshotParam,
});
// Enhanced navigate schema
exports.enhancedNavigateSchema = zod_1.z.object({
    url: zod_1.z.string().describe('The URL to navigate to'),
    returnSnapshot: exports.returnSnapshotParam,
});
// Enhanced navigate back/forward schema
exports.enhancedNavigateBackSchema = zod_1.z.object({
    returnSnapshot: exports.returnSnapshotParam,
});
// Enhanced wait schema
exports.enhancedWaitSchema = zod_1.z.object({
    time: zod_1.z.number().optional().describe('The time to wait in seconds'),
    text: zod_1.z.string().optional().describe('The text to wait for'),
    textGone: zod_1.z.string().optional().describe('The text to wait for to disappear'),
    returnSnapshot: exports.returnSnapshotParam,
});
// Enhanced resize schema
exports.enhancedResizeSchema = zod_1.z.object({
    width: zod_1.z.number().describe('Width of the browser window'),
    height: zod_1.z.number().describe('Height of the browser window'),
    returnSnapshot: exports.returnSnapshotParam,
});
// Enhanced snapshot schema
exports.enhancedSnapshotSchema = zod_1.z.object({
    filename: zod_1.z.string().optional().describe('Save snapshot to markdown file instead of returning it in the response.'),
    format: zod_1.z.enum(['full', 'summary']).optional().default('full').describe('Output format: "full" returns the complete accessibility tree, "summary" returns a compact overview. Default: full'),
    selector: zod_1.z.string().optional().describe('CSS selector to limit snapshot scope to a specific element and its descendants'),
    maxElements: zod_1.z.number().int().min(1).max(2000).optional().default(300).describe('Maximum number of elements to include in the snapshot. Default: 300, Max: 2000'),
    maxDepth: zod_1.z.number().int().min(1).max(20).optional().default(10).describe('Maximum depth of the accessibility tree to traverse. Default: 10, Max: 20'),
    includeRoles: zod_1.z.array(zod_1.z.string()).optional().describe('Only include elements with these roles (e.g. ["button", "link", "textbox"]). Ancestor elements are preserved for context. Takes priority over excludeRoles.'),
    excludeRoles: zod_1.z.array(zod_1.z.string()).optional().describe('Exclude elements with these roles (e.g. ["generic", "group"]). Children of excluded elements are promoted to their parent level. Ignored if includeRoles is provided.'),
});
// Enhanced console messages schema
exports.enhancedConsoleMessagesSchema = zod_1.z.object({
    level: zod_1.z.enum(['error', 'warning', 'info', 'debug']).default('info').describe('Level of the console messages to return. Each level includes the messages of more severe levels. Defaults to "info".'),
    filename: zod_1.z.string().optional().describe('Filename to save the console messages to. If not provided, messages are returned as text.'),
    limit: zod_1.z.number().int().min(1).max(500).optional().default(50).describe('Maximum number of messages to return. Default: 50, Max: 500'),
    countOnly: zod_1.z.boolean().optional().default(false).describe('Return only message counts by level instead of full messages'),
    since: zod_1.z.string().optional().describe('ISO timestamp - return only messages after this time'),
});
// Enhanced network requests schema
exports.enhancedNetworkRequestsSchema = zod_1.z.object({
    includeStatic: zod_1.z.boolean().default(false).describe('Whether to include successful static resources like images, fonts, scripts, etc. Defaults to false.'),
    filename: zod_1.z.string().optional().describe('Filename to save the network requests to. If not provided, requests are returned as text.'),
    limit: zod_1.z.number().int().min(1).max(500).optional().default(50).describe('Maximum number of requests to return. Default: 50, Max: 500'),
    countOnly: zod_1.z.boolean().optional().default(false).describe('Return only request counts by status/type instead of full request list'),
    format: zod_1.z.enum(['full', 'compact']).optional().default('full').describe('Output format: "full" includes all details, "compact" shows only method, URL, and status'),
});
// Enhanced screenshot schema
exports.enhancedScreenshotSchema = zod_1.z.object({
    type: zod_1.z.enum(['png', 'jpeg']).default('png').describe('Image format for the screenshot. Default is png.'),
    filename: zod_1.z.string().optional().describe('File name to save the screenshot to. Defaults to `page-{timestamp}.{png|jpeg}` if not specified. Prefer relative file names to stay within the output directory.'),
    element: zod_1.z.string().optional().describe('Human-readable element description used to obtain permission to screenshot the element. If not provided, the screenshot will be taken of viewport. If element is provided, ref must be provided too.'),
    ref: zod_1.z.string().optional().describe('Exact target element reference from the page snapshot. If not provided, the screenshot will be taken of viewport. If ref is provided, element must be provided too.'),
    fullPage: zod_1.z.boolean().optional().describe('When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Cannot be used with element screenshots.'),
    quality: zod_1.z.enum(['thumbnail', 'medium', 'full']).optional().default('medium').describe('Image quality/size: "thumbnail" (~400px width), "medium" (~800px width), "full" (original viewport size). Default: medium'),
    jpegQuality: zod_1.z.number().int().min(1).max(100).optional().default(80).describe('JPEG quality (1-100) when type is jpeg. Default: 80'),
});
// Enhanced evaluate schema
exports.enhancedEvaluateSchema = zod_1.z.object({
    function: zod_1.z.string().describe('() => { /* code */ } or (element) => { /* code */ } when element is provided'),
    element: zod_1.z.string().optional().describe('Human-readable element description used to obtain permission to interact with the element'),
    ref: zod_1.z.string().optional().describe('Exact target element reference from the page snapshot'),
    maxOutputLength: zod_1.z.number().int().min(100).max(100000).optional().default(10000).describe('Maximum characters to return in output. Longer outputs will be truncated. Default: 10000'),
});
// Enhanced run code schema
exports.enhancedRunCodeSchema = zod_1.z.object({
    code: zod_1.z.string().describe('A JavaScript function containing Playwright code to execute. It will be invoked with a single argument, page, which you can use for any page interaction. For example: `async (page) => { await page.getByRole(\'button\', { name: \'Submit\' }).click(); return await page.title(); }`'),
    maxOutputLength: zod_1.z.number().int().min(100).max(100000).optional().default(50000).describe('Maximum characters to return in output. Longer outputs will be truncated. Default: 50000'),
    outputFile: zod_1.z.string().optional().describe('Save output to this file instead of returning in response. Useful for large outputs.'),
});
//# sourceMappingURL=schemas.js.map