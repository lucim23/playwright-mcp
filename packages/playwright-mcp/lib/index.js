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
 * Enhanced tool schemas that add new parameters to existing tools.
 * These are merged with the original schemas when creating the connection.
 */
exports.enhancedToolSchemas = {
    browser_click: {
        additionalProperties: {
            returnSnapshot: {
                type: 'boolean',
                default: false,
                description: 'Whether to include a page snapshot in the response. Default: false'
            }
        }
    },
    browser_type: {
        additionalProperties: {
            returnSnapshot: {
                type: 'boolean',
                default: false,
                description: 'Whether to include a page snapshot in the response. Default: false'
            }
        }
    },
    browser_hover: {
        additionalProperties: {
            returnSnapshot: {
                type: 'boolean',
                default: false,
                description: 'Whether to include a page snapshot in the response. Default: false'
            }
        }
    },
    browser_drag: {
        additionalProperties: {
            returnSnapshot: {
                type: 'boolean',
                default: false,
                description: 'Whether to include a page snapshot in the response. Default: false'
            }
        }
    },
    browser_select_option: {
        additionalProperties: {
            returnSnapshot: {
                type: 'boolean',
                default: false,
                description: 'Whether to include a page snapshot in the response. Default: false'
            }
        }
    },
    browser_press_key: {
        additionalProperties: {
            returnSnapshot: {
                type: 'boolean',
                default: false,
                description: 'Whether to include a page snapshot in the response. Default: false'
            }
        }
    },
    browser_navigate: {
        additionalProperties: {
            returnSnapshot: {
                type: 'boolean',
                default: false,
                description: 'Whether to include a page snapshot in the response. Default: false'
            }
        }
    },
    browser_navigate_back: {
        additionalProperties: {
            returnSnapshot: {
                type: 'boolean',
                default: false,
                description: 'Whether to include a page snapshot in the response. Default: false'
            }
        }
    },
    browser_wait_for: {
        additionalProperties: {
            returnSnapshot: {
                type: 'boolean',
                default: false,
                description: 'Whether to include a page snapshot in the response. Default: false'
            }
        }
    },
    browser_resize: {
        additionalProperties: {
            returnSnapshot: {
                type: 'boolean',
                default: false,
                description: 'Whether to include a page snapshot in the response. Default: false'
            }
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
            selector: {
                type: 'string',
                description: 'CSS selector to limit snapshot scope to a specific element'
            },
            maxElements: {
                type: 'integer',
                default: 300,
                minimum: 1,
                maximum: 2000,
                description: 'Maximum number of elements to include. Default: 300, Max: 2000'
            },
            maxDepth: {
                type: 'integer',
                default: 10,
                minimum: 1,
                maximum: 20,
                description: 'Maximum tree depth. Default: 10, Max: 20'
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
        }
    }
};
/**
 * Create an enhanced MCP connection with additional tool parameters
 * for controlling snapshot behavior and output size.
 */
async function createConnection(config, contextGetter) {
    const server = await originalCreateConnection(config, contextGetter);
    // Store original tool handlers
    const originalHandlers = new Map();
    // Intercept tool calls to apply enhancements
    const originalSetRequestHandler = server.setRequestHandler.bind(server);
    server.setRequestHandler = function (schema, handler) {
        if (schema.method === 'tools/call') {
            // Wrap the tool call handler to apply enhancements
            const wrappedHandler = async (request) => {
                const result = await handler(request);
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
            return originalSetRequestHandler(schema, wrappedHandler);
        }
        return originalSetRequestHandler(schema, handler);
    };
    return server;
}
// Re-export utilities
var enhancer_2 = require("./tools/enhancer");
Object.defineProperty(exports, "enhanceToolResponse", { enumerable: true, get: function () { return enhancer_2.enhanceToolResponse; } });
__exportStar(require("./utils"), exports);
//# sourceMappingURL=index.js.map