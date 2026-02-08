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

// --- Enhancement layer ---
// Intercept the upstream server module in Node's require cache BEFORE
// program.js is loaded. program.js lazily reads mcpServer.start through
// getters, so our replacement is picked up when the CLI action runs.

const { enhancedToolSchemas, enhanceToolResponse } = require('./lib/index');

function mergeToolSchema(tool, enhancements) {
  const enhanced = { ...tool };
  if (tool.inputSchema && enhancements.additionalProperties) {
    enhanced.inputSchema = {
      ...tool.inputSchema,
      properties: {
        ...(tool.inputSchema.properties || {}),
        ...enhancements.additionalProperties
      }
    };
  }
  if (enhancements.outputSchema)
    enhanced.outputSchema = enhancements.outputSchema;
  return enhanced;
}

function wrapBackend(backend) {
  const origListTools = backend.listTools.bind(backend);
  const origCallTool = backend.callTool.bind(backend);

  backend.listTools = async function() {
    const tools = await origListTools();
    return tools.map(tool => {
      const enhancements = enhancedToolSchemas[tool.name];
      return enhancements ? mergeToolSchema(tool, enhancements) : tool;
    });
  };

  backend.callTool = async function(name, args, progress) {
    const result = await origCallTool(name, args, progress);
    if (enhancedToolSchemas[name]) {
      return enhanceToolResponse(result, {
        toolName: name,
        params: args,
        config: {}
      });
    }
    return result;
  };

  return backend;
}

// Load the original server module and capture its start function.
// We resolve the path manually because 'playwright/lib/mcp/sdk/server' is
// not in the package's "exports" map — require.resolve() would throw
// ERR_PACKAGE_PATH_NOT_EXPORTED. program.js uses a relative require
// ('./sdk/server') which bypasses the exports check, so we do the same
// by constructing the absolute path from the playwright package root.
const path = require('path');
const playwrightDir = path.dirname(require.resolve('playwright/package.json'));
const serverModulePath = path.join(playwrightDir, 'lib', 'mcp', 'sdk', 'server.js');
const serverModule = require(serverModulePath);
const originalStart = serverModule.start;

function enhancedStart(factory, options) {
  const origCreate = factory.create.bind(factory);
  const wrappedFactory = {
    ...factory,
    create: function() {
      return wrapBackend(origCreate());
    }
  };
  return originalStart(wrappedFactory, options);
}

// Build a replacement exports object that overrides 'start'
const wrappedExports = {};
for (const key of Object.getOwnPropertyNames(serverModule)) {
  if (key === 'start') {
    wrappedExports[key] = enhancedStart;
  } else {
    const desc = Object.getOwnPropertyDescriptor(serverModule, key);
    Object.defineProperty(wrappedExports, key, desc);
  }
}
require.cache[serverModulePath].exports = wrappedExports;

// --- Standard CLI setup ---

const { program } = require('playwright-core/lib/utilsBundle');
const { decorateCommand } = require('playwright/lib/mcp/program');

const packageJSON = require('./package.json');
const p = program.version('Version ' + packageJSON.version).name('Playwright MCP');
decorateCommand(p, packageJSON.version);
void program.parseAsync(process.argv);
