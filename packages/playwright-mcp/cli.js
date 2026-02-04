#!/usr/bin/env node
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

// Import enhanced tool schemas and enhancer
const { enhancedToolSchemas, enhanceToolResponse } = require('./lib/index');

/**
 * Merge enhanced parameters into a tool's input schema
 */
function mergeToolSchema(tool, enhancements) {
  if (!tool.inputSchema || !enhancements || !enhancements.additionalProperties) {
    return tool;
  }

  return {
    ...tool,
    inputSchema: {
      ...tool.inputSchema,
      properties: {
        ...(tool.inputSchema.properties || {}),
        ...enhancements.additionalProperties
      }
    }
  };
}

// Patch the BrowserServerBackend prototype before the program loads
const { createRequire } = require('module');
const playwrightPath = require.resolve('playwright');
const requireFromPlaywright = createRequire(playwrightPath);

// Get the BrowserServerBackend class and patch its prototype
const browserServerBackendModule = requireFromPlaywright('./lib/mcp/browser/browserServerBackend.js');
const BrowserServerBackend = browserServerBackendModule.BrowserServerBackend;

// Patch listTools to add enhanced parameters to tool schemas
const originalListTools = BrowserServerBackend.prototype.listTools;
BrowserServerBackend.prototype.listTools = async function() {
  const tools = await originalListTools.call(this);
  return tools.map(tool => {
    const enhancements = enhancedToolSchemas[tool.name];
    if (enhancements) {
      return mergeToolSchema(tool, enhancements);
    }
    return tool;
  });
};

// Patch callTool to apply response enhancements
const originalCallTool = BrowserServerBackend.prototype.callTool;
BrowserServerBackend.prototype.callTool = async function(toolName, args, progress) {
  const result = await originalCallTool.call(this, toolName, args, progress);

  // Apply enhancements if this tool has enhanced parameters
  if (enhancedToolSchemas[toolName]) {
    return enhanceToolResponse(result, {
      toolName,
      params: args,
      config: {}
    });
  }

  return result;
};

// Now load the program (which will use our patched BrowserServerBackend)
const { program } = require('playwright-core/lib/utilsBundle');
const { decorateCommand } = require('playwright/lib/mcp/program');

const packageJSON = require('./package.json');
const p = program.version('Version ' + packageJSON.version).name('Playwright MCP');
decorateCommand(p, packageJSON.version);
void program.parseAsync(process.argv);
