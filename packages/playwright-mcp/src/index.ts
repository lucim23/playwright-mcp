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
import { enhanceToolResponse, EnhancementContext } from './tools/enhancer';

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
export const enhancedToolSchemas = {
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
function mergeToolSchema(tool: any, enhancements: { additionalProperties?: Record<string, any> }): any {
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

  return enhancedTool;
}

/**
 * Create an enhanced MCP connection with additional tool parameters
 * for controlling snapshot behavior and output size.
 */
export async function createConnection(
  config?: Config,
  contextGetter?: () => Promise<BrowserContext>
): Promise<Server> {
  const server = await originalCreateConnection(config, contextGetter);

  // Access the internal request handlers map
  // The handlers are already registered by originalCreateConnection,
  // so we need to wrap them after the fact
  const handlers = (server as any)._requestHandlers as Map<string, Function>;

  // Wrap the existing tools/list handler to add enhanced parameters
  const originalToolsListHandler = handlers.get('tools/list');
  if (originalToolsListHandler) {
    const wrappedToolsListHandler = async (request: any) => {
      const result = await originalToolsListHandler(request);

      if (result && result.tools && Array.isArray(result.tools)) {
        result.tools = result.tools.map((tool: any) => {
          // Strip outputSchema from upstream tools — our wrapper returns unstructured
          // content (text blocks), but MCP requires structuredContent when outputSchema
          // is present. Removing it avoids protocol validation errors.
          if (tool.outputSchema) {
            const { outputSchema: _, ...toolWithoutSchema } = tool;
            tool = toolWithoutSchema;
          }

          const enhancements = enhancedToolSchemas[tool.name as keyof typeof enhancedToolSchemas];
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
    const wrappedToolsCallHandler = async (request: any) => {
      const result = await originalToolsCallHandler(request);

      // Apply enhancements based on the tool and parameters
      const toolName = request.params?.name;
      const toolParams = request.params?.arguments || {};

      if (toolName && enhancedToolSchemas[toolName as keyof typeof enhancedToolSchemas]) {
        const enhancementContext: EnhancementContext = {
          toolName,
          params: toolParams,
          config: {
            snapshotMode: config?.snapshot?.mode,
            imageResponses: config?.imageResponses
          }
        };

        return enhanceToolResponse(result, enhancementContext);
      }

      return result;
    };
    handlers.set('tools/call', wrappedToolsCallHandler);
  }

  return server;
}

// Re-export utilities
export { enhanceToolResponse } from './tools/enhancer';
export * from './utils';
