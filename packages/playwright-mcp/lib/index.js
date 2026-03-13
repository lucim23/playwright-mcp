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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleFileDownload = exports.fileDownloadToolDefinition = exports.enhanceToolResponse = exports.enhancedToolSchemas = void 0;
exports.createConnection = createConnection;
const enhancer_1 = require("./tools/enhancer");
const fileDownload_1 = require("./tools/fileDownload");
// Import the original createConnection from playwright
const { createConnection: originalCreateConnection } = require('playwright/lib/mcp/index');
/**
 * Common input parameters for action tools with returnSnapshot support
 */
const snapshotControlParams = {
    returnSnapshot: {
        type: 'boolean',
        default: false,
        description: 'Whether to include a page snapshot in the response. Default: false'
    },
    snapshotMaxElements: {
        type: 'integer',
        default: 300,
        minimum: 1,
        maximum: 2000,
        description: 'Maximum elements in snapshot when returnSnapshot=true. Default: 300'
    },
    snapshotFormat: {
        type: 'string',
        enum: ['full', 'summary'],
        default: 'full',
        description: 'Snapshot format when returnSnapshot=true: "full" or "summary"'
    },
    snapshotIncludeRoles: {
        type: 'array',
        items: { type: 'string' },
        description: 'Only include elements with these roles in snapshot (e.g. ["button", "link"]). Ancestors preserved for context. Takes priority over snapshotExcludeRoles.'
    },
    snapshotExcludeRoles: {
        type: 'array',
        items: { type: 'string' },
        description: 'Exclude elements with these roles from snapshot (e.g. ["generic", "group"]). Children promoted to parent level.'
    }
};
/**
 * Enhanced tool schemas that add new parameters to existing tools.
 * These are merged with the original schemas when creating the connection.
 */
exports.enhancedToolSchemas = {
    browser_click: {
        additionalProperties: { ...snapshotControlParams },
    },
    browser_type: {
        additionalProperties: { ...snapshotControlParams },
    },
    browser_hover: {
        additionalProperties: { ...snapshotControlParams },
    },
    browser_drag: {
        additionalProperties: { ...snapshotControlParams },
    },
    browser_select_option: {
        additionalProperties: { ...snapshotControlParams },
    },
    browser_press_key: {
        additionalProperties: { ...snapshotControlParams },
    },
    browser_navigate: {
        additionalProperties: { ...snapshotControlParams },
    },
    browser_navigate_back: {
        additionalProperties: { ...snapshotControlParams },
    },
    browser_navigate_forward: {
        additionalProperties: { ...snapshotControlParams },
    },
    browser_reload: {
        additionalProperties: { ...snapshotControlParams },
    },
    browser_fill_form: {
        additionalProperties: { ...snapshotControlParams },
    },
    browser_file_upload: {
        additionalProperties: { ...snapshotControlParams },
    },
    browser_check: {
        additionalProperties: { ...snapshotControlParams },
    },
    browser_uncheck: {
        additionalProperties: { ...snapshotControlParams },
    },
    browser_wait_for: {
        additionalProperties: { ...snapshotControlParams },
    },
    browser_resize: {
        additionalProperties: { ...snapshotControlParams },
    },
    browser_snapshot: {
        additionalProperties: {
            format: {
                type: 'string',
                enum: ['full', 'summary'],
                default: 'full',
                description: 'Output format: "full" returns complete tree, "summary" returns compact overview'
            },
            maxElements: {
                type: 'integer',
                default: 300,
                minimum: 1,
                maximum: 2000,
                description: 'Maximum number of elements to include. Default: 300, Max: 2000'
            },
            includeRoles: {
                type: 'array',
                items: { type: 'string' },
                description: 'Only include elements with these roles (e.g. ["button", "link", "textbox"]). Ancestors preserved for context. Takes priority over excludeRoles.'
            },
            excludeRoles: {
                type: 'array',
                items: { type: 'string' },
                description: 'Exclude elements with these roles (e.g. ["generic", "group"]). Children promoted to parent level.'
            }
        },
    },
    browser_console_messages: {
        additionalProperties: {
            limit: {
                type: 'integer',
                default: 50,
                minimum: 1,
                maximum: 500,
                description: 'Maximum messages to return. Default: 50, Max: 500'
            },
            countOnly: {
                type: 'boolean',
                default: false,
                description: 'Return only message counts instead of full messages'
            },
            since: {
                type: 'string',
                description: 'ISO timestamp - return messages after this time'
            }
        },
    },
    browser_network_requests: {
        additionalProperties: {
            limit: {
                type: 'integer',
                default: 50,
                minimum: 1,
                maximum: 500,
                description: 'Maximum requests to return. Default: 50, Max: 500'
            },
            countOnly: {
                type: 'boolean',
                default: false,
                description: 'Return only request counts instead of full list'
            },
            format: {
                type: 'string',
                enum: ['full', 'compact'],
                default: 'full',
                description: 'Output format: "full" or "compact"'
            }
        },
    },
    browser_take_screenshot: {
        description: 'Take a screenshot of the current page or a specific element. Supports PNG and JPEG formats with configurable resolution and compression.\n\nResolution presets (quality parameter):\n- "thumbnail": Resizes to ~400px width. Produces very small images ideal for quick visual checks or thumbnails. Lowest fidelity.\n- "medium" (default): Resizes to ~800px width. Good balance of clarity and size for most use cases — UI verification, visual diffing, documentation.\n- "full": No resizing — captures at the original viewport resolution (typically 1280px). Best fidelity but largest file size.\n\nImage format (type parameter):\n- "png": Lossless compression. Larger files but pixel-perfect. Best for screenshots containing text, diagrams, or where exact color accuracy matters.\n- "jpeg" (default): Lossy compression controlled by jpegQuality (1-100, default 80). Much smaller files. Best for photos or when file size matters more than pixel accuracy.\n\nAll screenshots are saved to the OS temp directory unless a custom filename is provided.',
        additionalProperties: {
            type: {
                type: 'string',
                enum: ['png', 'jpeg'],
                default: 'jpeg',
                description: 'Image format. "jpeg" (default): lossy compression, smaller files. "png": lossless, pixel-perfect but larger.'
            },
            quality: {
                type: 'string',
                enum: ['thumbnail', 'medium', 'full'],
                default: 'thumbnail',
                description: 'Resolution preset: "thumbnail" (~400px width, smallest file), "medium" (~800px width, balanced), "full" (original viewport resolution, largest file). Default: "thumbnail"'
            },
            jpegQuality: {
                type: 'integer',
                default: 80,
                minimum: 1,
                maximum: 100,
                description: 'JPEG compression quality (1-100). Lower values produce smaller files with more artifacts. Only applies when type is "jpeg". Default: 80'
            }
        },
    },
    browser_evaluate: {
        additionalProperties: {
            maxOutputLength: {
                type: 'integer',
                default: 10000,
                minimum: 100,
                maximum: 100000,
                description: 'Max output characters. Default: 10000'
            }
        },
    },
    browser_run_code: {
        additionalProperties: {
            maxOutputLength: {
                type: 'integer',
                default: 50000,
                minimum: 100,
                maximum: 100000,
                description: 'Max output characters. Default: 50000'
            },
            outputFile: {
                type: 'string',
                description: 'Save output to file instead of returning'
            }
        },
    }
};
/**
 * Merge enhanced input parameters into a tool definition
 */
function mergeToolSchema(tool, enhancements) {
    const enhancedTool = { ...tool };
    // Override tool description if provided
    if (enhancements.description)
        enhancedTool.description = enhancements.description;
    // Merge input schema properties
    if (tool.inputSchema && enhancements.additionalProperties) {
        enhancedTool.inputSchema = {
            ...tool.inputSchema,
            properties: {
                ...(tool.inputSchema.properties || {}),
                ...enhancements.additionalProperties
            }
        };
    }
    return enhancedTool;
}
/**
 * Create an enhanced MCP connection with additional tool parameters
 * for controlling snapshot behavior and output size.
 */
async function createConnection(config, contextGetter) {
    const server = await originalCreateConnection(config, contextGetter);
    // Access the internal request handlers map
    // The handlers are already registered by originalCreateConnection,
    // so we need to wrap them after the fact
    const handlers = server._requestHandlers;
    // Wrap the existing tools/list handler to add enhanced parameters
    const originalToolsListHandler = handlers.get('tools/list');
    if (originalToolsListHandler) {
        const wrappedToolsListHandler = async (request) => {
            const result = await originalToolsListHandler(request);
            if (result && result.tools && Array.isArray(result.tools)) {
                result.tools = result.tools.map((tool) => {
                    // Strip outputSchema from upstream tools — our wrapper returns unstructured
                    // content (text blocks), but MCP requires structuredContent when outputSchema
                    // is present. Removing it avoids protocol validation errors.
                    if (tool.outputSchema) {
                        const { outputSchema: _, ...toolWithoutSchema } = tool;
                        tool = toolWithoutSchema;
                    }
                    const enhancements = exports.enhancedToolSchemas[tool.name];
                    if (enhancements) {
                        return mergeToolSchema(tool, enhancements);
                    }
                    return tool;
                });
                // Add custom tools that don't exist upstream
                result.tools.push(fileDownload_1.fileDownloadToolDefinition);
            }
            return result;
        };
        handlers.set('tools/list', wrappedToolsListHandler);
    }
    // Wrap the existing tools/call handler to apply response enhancements
    const originalToolsCallHandler = handlers.get('tools/call');
    if (originalToolsCallHandler) {
        const wrappedToolsCallHandler = async (request) => {
            const toolName = request.params?.name;
            const toolParams = request.params?.arguments || {};
            // Handle custom tools before reaching upstream
            if (toolName === 'file_download')
                return (0, fileDownload_1.handleFileDownload)(toolParams);
            const result = await originalToolsCallHandler(request);
            // Apply enhancements based on the tool and parameters
            if (toolName && exports.enhancedToolSchemas[toolName]) {
                const enhancementContext = {
                    toolName,
                    params: toolParams,
                    config: {
                        snapshotMode: config?.snapshot?.mode,
                        imageResponses: config?.imageResponses
                    }
                };
                return (0, enhancer_1.enhanceToolResponse)(result, enhancementContext);
            }
            return result;
        };
        handlers.set('tools/call', wrappedToolsCallHandler);
    }
    return server;
}
// Re-export utilities
var enhancer_2 = require("./tools/enhancer");
Object.defineProperty(exports, "enhanceToolResponse", { enumerable: true, get: function () { return enhancer_2.enhanceToolResponse; } });
var fileDownload_2 = require("./tools/fileDownload");
Object.defineProperty(exports, "fileDownloadToolDefinition", { enumerable: true, get: function () { return fileDownload_2.fileDownloadToolDefinition; } });
Object.defineProperty(exports, "handleFileDownload", { enumerable: true, get: function () { return fileDownload_2.handleFileDownload; } });
__exportStar(require("./utils"), exports);
//# sourceMappingURL=index.js.map