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
import type { BrowserContext } from 'playwright';
import type { Config } from '../config';
/**
 * Enhanced tool schemas that add new parameters to existing tools.
 * These are merged with the original schemas when creating the connection.
 */
export declare const enhancedToolSchemas: {
    browser_click: {
        additionalProperties: {
            returnSnapshot: {
                type: string;
                default: boolean;
                description: string;
            };
            snapshotMaxElements: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            snapshotFormat: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            snapshotIncludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            snapshotExcludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
    };
    browser_type: {
        additionalProperties: {
            returnSnapshot: {
                type: string;
                default: boolean;
                description: string;
            };
            snapshotMaxElements: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            snapshotFormat: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            snapshotIncludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            snapshotExcludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
    };
    browser_hover: {
        additionalProperties: {
            returnSnapshot: {
                type: string;
                default: boolean;
                description: string;
            };
            snapshotMaxElements: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            snapshotFormat: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            snapshotIncludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            snapshotExcludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
    };
    browser_drag: {
        additionalProperties: {
            returnSnapshot: {
                type: string;
                default: boolean;
                description: string;
            };
            snapshotMaxElements: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            snapshotFormat: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            snapshotIncludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            snapshotExcludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
    };
    browser_select_option: {
        additionalProperties: {
            returnSnapshot: {
                type: string;
                default: boolean;
                description: string;
            };
            snapshotMaxElements: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            snapshotFormat: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            snapshotIncludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            snapshotExcludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
    };
    browser_press_key: {
        additionalProperties: {
            returnSnapshot: {
                type: string;
                default: boolean;
                description: string;
            };
            snapshotMaxElements: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            snapshotFormat: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            snapshotIncludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            snapshotExcludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
    };
    browser_navigate: {
        additionalProperties: {
            returnSnapshot: {
                type: string;
                default: boolean;
                description: string;
            };
            snapshotMaxElements: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            snapshotFormat: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            snapshotIncludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            snapshotExcludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
    };
    browser_navigate_back: {
        additionalProperties: {
            returnSnapshot: {
                type: string;
                default: boolean;
                description: string;
            };
            snapshotMaxElements: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            snapshotFormat: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            snapshotIncludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            snapshotExcludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
    };
    browser_navigate_forward: {
        additionalProperties: {
            returnSnapshot: {
                type: string;
                default: boolean;
                description: string;
            };
            snapshotMaxElements: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            snapshotFormat: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            snapshotIncludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            snapshotExcludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
    };
    browser_reload: {
        additionalProperties: {
            returnSnapshot: {
                type: string;
                default: boolean;
                description: string;
            };
            snapshotMaxElements: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            snapshotFormat: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            snapshotIncludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            snapshotExcludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
    };
    browser_fill_form: {
        additionalProperties: {
            returnSnapshot: {
                type: string;
                default: boolean;
                description: string;
            };
            snapshotMaxElements: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            snapshotFormat: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            snapshotIncludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            snapshotExcludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
    };
    browser_file_upload: {
        additionalProperties: {
            returnSnapshot: {
                type: string;
                default: boolean;
                description: string;
            };
            snapshotMaxElements: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            snapshotFormat: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            snapshotIncludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            snapshotExcludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
    };
    browser_check: {
        additionalProperties: {
            returnSnapshot: {
                type: string;
                default: boolean;
                description: string;
            };
            snapshotMaxElements: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            snapshotFormat: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            snapshotIncludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            snapshotExcludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
    };
    browser_uncheck: {
        additionalProperties: {
            returnSnapshot: {
                type: string;
                default: boolean;
                description: string;
            };
            snapshotMaxElements: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            snapshotFormat: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            snapshotIncludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            snapshotExcludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
    };
    browser_wait_for: {
        additionalProperties: {
            returnSnapshot: {
                type: string;
                default: boolean;
                description: string;
            };
            snapshotMaxElements: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            snapshotFormat: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            snapshotIncludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            snapshotExcludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
    };
    browser_resize: {
        additionalProperties: {
            returnSnapshot: {
                type: string;
                default: boolean;
                description: string;
            };
            snapshotMaxElements: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            snapshotFormat: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            snapshotIncludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            snapshotExcludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
    };
    browser_snapshot: {
        additionalProperties: {
            format: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            maxElements: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            includeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            excludeRoles: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
    };
    browser_console_messages: {
        additionalProperties: {
            limit: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            countOnly: {
                type: string;
                default: boolean;
                description: string;
            };
            since: {
                type: string;
                description: string;
            };
        };
    };
    browser_network_requests: {
        additionalProperties: {
            limit: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            countOnly: {
                type: string;
                default: boolean;
                description: string;
            };
            format: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
        };
    };
    browser_take_screenshot: {
        additionalProperties: {
            quality: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            jpegQuality: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
        };
    };
    browser_evaluate: {
        additionalProperties: {
            maxOutputLength: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
        };
    };
    browser_run_code: {
        additionalProperties: {
            maxOutputLength: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                description: string;
            };
            outputFile: {
                type: string;
                description: string;
            };
        };
    };
};
/**
 * Create an enhanced MCP connection with additional tool parameters
 * for controlling snapshot behavior and output size.
 */
export declare function createConnection(config?: Config, contextGetter?: () => Promise<BrowserContext>): Promise<Server>;
export { enhanceToolResponse } from './tools/enhancer';
export * from './utils';
//# sourceMappingURL=index.d.ts.map