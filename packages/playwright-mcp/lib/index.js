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
exports.enhanceToolResponse = exports.enhancedToolSchemas = void 0;
exports.createConnection = createConnection;
const enhancer_1 = require("./tools/enhancer");
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
 * Common output schema components for reuse
 */
const outputSchemas = {
    // Page info included in most responses
    pageInfo: {
        type: 'object',
        properties: {
            pageUrl: { type: 'string', description: 'Current page URL' },
            pageTitle: { type: 'string', description: 'Current page title' }
        }
    },
    // Meta info for truncated responses
    truncationMeta: {
        type: 'object',
        properties: {
            truncated: { type: 'boolean', description: 'Whether output was truncated' },
            returnedCount: { type: 'integer', description: 'Number of items returned' },
            totalCount: { type: 'integer', description: 'Total items available' }
        }
    },
    // Action confirmation (when returnSnapshot=false)
    actionConfirmation: {
        type: 'object',
        description: 'Compact confirmation when returnSnapshot=false (default)',
        properties: {
            result: { type: 'string', description: 'Action confirmation message' },
            pageUrl: { type: 'string', description: 'Current page URL' },
            pageTitle: { type: 'string', description: 'Current page title' },
            meta: {
                type: 'object',
                properties: {
                    snapshotDisabled: { type: 'boolean', const: true },
                    reason: { type: 'string' }
                }
            }
        }
    },
    // Full snapshot response (when returnSnapshot=true)
    snapshotResponse: {
        type: 'object',
        description: 'Full response when returnSnapshot=true',
        properties: {
            page: {
                type: 'object',
                properties: {
                    url: { type: 'string' },
                    title: { type: 'string' },
                    console: { type: 'string', description: 'Console message counts' }
                }
            },
            snapshot: { type: 'string', description: 'YAML accessibility tree with element refs' },
            meta: {
                type: 'object',
                properties: {
                    truncated: { type: 'boolean' },
                    returnedCount: { type: 'integer' },
                    totalCount: { type: 'integer' }
                }
            }
        }
    }
};
/**
 * Enhanced tool schemas that add new parameters to existing tools.
 * These are merged with the original schemas when creating the connection.
 */
exports.enhancedToolSchemas = {
    browser_click: {
        additionalProperties: { ...snapshotControlParams },
        outputSchema: {
            type: 'object',
            description: 'Returns action confirmation (default) or snapshot if returnSnapshot=true. Use snapshotMaxElements/snapshotFormat to control output.',
            oneOf: [outputSchemas.actionConfirmation, outputSchemas.snapshotResponse]
        }
    },
    browser_type: {
        additionalProperties: { ...snapshotControlParams },
        outputSchema: {
            type: 'object',
            description: 'Returns action confirmation (default) or snapshot if returnSnapshot=true. Use snapshotMaxElements/snapshotFormat to control output.',
            oneOf: [outputSchemas.actionConfirmation, outputSchemas.snapshotResponse]
        }
    },
    browser_hover: {
        additionalProperties: { ...snapshotControlParams },
        outputSchema: {
            type: 'object',
            description: 'Returns action confirmation (default) or snapshot if returnSnapshot=true. Use snapshotMaxElements/snapshotFormat to control output.',
            oneOf: [outputSchemas.actionConfirmation, outputSchemas.snapshotResponse]
        }
    },
    browser_drag: {
        additionalProperties: { ...snapshotControlParams },
        outputSchema: {
            type: 'object',
            description: 'Returns action confirmation (default) or snapshot if returnSnapshot=true. Use snapshotMaxElements/snapshotFormat to control output.',
            oneOf: [outputSchemas.actionConfirmation, outputSchemas.snapshotResponse]
        }
    },
    browser_select_option: {
        additionalProperties: { ...snapshotControlParams },
        outputSchema: {
            type: 'object',
            description: 'Returns action confirmation (default) or snapshot if returnSnapshot=true. Use snapshotMaxElements/snapshotFormat to control output.',
            oneOf: [outputSchemas.actionConfirmation, outputSchemas.snapshotResponse]
        }
    },
    browser_press_key: {
        additionalProperties: { ...snapshotControlParams },
        outputSchema: {
            type: 'object',
            description: 'Returns action confirmation (default) or snapshot if returnSnapshot=true. Use snapshotMaxElements/snapshotFormat to control output.',
            oneOf: [outputSchemas.actionConfirmation, outputSchemas.snapshotResponse]
        }
    },
    browser_navigate: {
        additionalProperties: { ...snapshotControlParams },
        outputSchema: {
            type: 'object',
            description: 'Returns navigation confirmation (default) or snapshot if returnSnapshot=true. Use snapshotMaxElements/snapshotFormat to control output.',
            oneOf: [outputSchemas.actionConfirmation, outputSchemas.snapshotResponse]
        }
    },
    browser_navigate_back: {
        additionalProperties: { ...snapshotControlParams },
        outputSchema: {
            type: 'object',
            description: 'Returns navigation confirmation (default) or snapshot if returnSnapshot=true. Use snapshotMaxElements/snapshotFormat to control output.',
            oneOf: [outputSchemas.actionConfirmation, outputSchemas.snapshotResponse]
        }
    },
    browser_wait_for: {
        additionalProperties: { ...snapshotControlParams },
        outputSchema: {
            type: 'object',
            description: 'Returns wait confirmation (default) or snapshot if returnSnapshot=true. Use snapshotMaxElements/snapshotFormat to control output.',
            oneOf: [outputSchemas.actionConfirmation, outputSchemas.snapshotResponse]
        }
    },
    browser_resize: {
        additionalProperties: { ...snapshotControlParams },
        outputSchema: {
            type: 'object',
            description: 'Returns resize confirmation (default) or snapshot if returnSnapshot=true. Use snapshotMaxElements/snapshotFormat to control output.',
            oneOf: [outputSchemas.actionConfirmation, outputSchemas.snapshotResponse]
        }
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
        outputSchema: {
            type: 'object',
            description: 'Accessibility snapshot of the page',
            properties: {
                page: {
                    type: 'object',
                    properties: {
                        url: { type: 'string', description: 'Current page URL' },
                        title: { type: 'string', description: 'Current page title' },
                        console: { type: 'string', description: 'Console error/warning counts' }
                    }
                },
                snapshot: {
                    type: 'string',
                    description: 'YAML accessibility tree (format=full) or compact summary (format=summary). Elements have [ref=X] attributes for interaction.'
                },
                events: {
                    type: 'array',
                    description: 'Recent console events and warnings',
                    items: { type: 'string' }
                },
                meta: {
                    type: 'object',
                    properties: {
                        format: { type: 'string', enum: ['full', 'summary'] },
                        truncated: { type: 'boolean', description: 'Whether elements were truncated' },
                        returnedCount: { type: 'integer', description: 'Elements returned' },
                        totalCount: { type: 'integer', description: 'Total elements on page' }
                    }
                }
            }
        }
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
        outputSchema: {
            type: 'object',
            description: 'Console messages from the page',
            properties: {
                result: {
                    type: 'string',
                    description: 'Console messages list or counts summary (if countOnly=true)'
                },
                meta: {
                    type: 'object',
                    properties: {
                        truncated: { type: 'boolean' },
                        returnedCount: { type: 'integer' },
                        totalCount: { type: 'integer' },
                        limit: { type: 'integer' }
                    }
                }
            }
        }
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
        outputSchema: {
            type: 'object',
            description: 'Network requests made by the page',
            properties: {
                result: {
                    type: 'string',
                    description: 'Network requests list or counts by status (if countOnly=true)'
                },
                meta: {
                    type: 'object',
                    properties: {
                        truncated: { type: 'boolean' },
                        returnedCount: { type: 'integer' },
                        totalCount: { type: 'integer' },
                        limit: { type: 'integer' }
                    }
                }
            }
        }
    },
    browser_take_screenshot: {
        additionalProperties: {
            quality: {
                type: 'string',
                enum: ['thumbnail', 'medium', 'full'],
                default: 'medium',
                description: 'Image quality: "thumbnail" (~400px), "medium" (~800px), "full" (original)'
            },
            jpegQuality: {
                type: 'integer',
                default: 80,
                minimum: 1,
                maximum: 100,
                description: 'JPEG quality (1-100) when type is jpeg. Default: 80'
            }
        },
        outputSchema: {
            type: 'object',
            description: 'Screenshot of the page or element',
            properties: {
                image: {
                    type: 'string',
                    description: 'Base64-encoded image data (if no filename specified)',
                    contentEncoding: 'base64'
                },
                filename: {
                    type: 'string',
                    description: 'Path to saved screenshot file (if filename specified)'
                },
                mimeType: {
                    type: 'string',
                    enum: ['image/png', 'image/jpeg']
                }
            }
        }
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
        outputSchema: {
            type: 'object',
            description: 'Result of JavaScript evaluation',
            properties: {
                result: {
                    type: 'string',
                    description: 'Serialized return value from the evaluated function'
                },
                meta: {
                    type: 'object',
                    properties: {
                        truncated: { type: 'boolean' },
                        returnedCount: { type: 'integer', description: 'Characters returned' },
                        totalCount: { type: 'integer', description: 'Total characters before truncation' }
                    }
                }
            }
        }
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
        outputSchema: {
            type: 'object',
            description: 'Result of Playwright code execution',
            properties: {
                result: {
                    type: 'string',
                    description: 'Return value from the Playwright code, or file path if outputFile specified'
                },
                code: {
                    type: 'string',
                    description: 'The executed code snippet'
                },
                page: {
                    type: 'object',
                    properties: {
                        url: { type: 'string' },
                        title: { type: 'string' }
                    }
                },
                meta: {
                    type: 'object',
                    properties: {
                        truncated: { type: 'boolean' },
                        returnedCount: { type: 'integer' },
                        totalCount: { type: 'integer' }
                    }
                }
            }
        }
    }
};
/**
 * Merge enhanced parameters and output schema into a tool definition
 */
function mergeToolSchema(tool, enhancements) {
    const enhancedTool = { ...tool };
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
    // Add output schema if provided
    if (enhancements.outputSchema) {
        enhancedTool.outputSchema = enhancements.outputSchema;
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
                    const enhancements = exports.enhancedToolSchemas[tool.name];
                    if (enhancements) {
                        return mergeToolSchema(tool, enhancements);
                    }
                    return tool;
                });
            }
            return result;
        };
        handlers.set('tools/list', wrappedToolsListHandler);
    }
    // Wrap the existing tools/call handler to apply response enhancements
    const originalToolsCallHandler = handlers.get('tools/call');
    if (originalToolsCallHandler) {
        const wrappedToolsCallHandler = async (request) => {
            const result = await originalToolsCallHandler(request);
            // Apply enhancements based on the tool and parameters
            const toolName = request.params?.name;
            const toolParams = request.params?.arguments || {};
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
__exportStar(require("./utils"), exports);
//# sourceMappingURL=index.js.map