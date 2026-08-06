/**
 * Declares which upstream v0.0.79 tools the enhancement layer adds
 * parameters to, and the JSON-schema fragments merged into their
 * `tools/list` entries.
 *
 * IMPORTANT: this file was written against a live `tools/list` snapshot of
 * @playwright/mcp 0.0.79 (playwright-core 1.63.0-alpha-2026-08-05), not the
 * legacy fork's assumptions, because upstream renamed fields since the fork
 * diverged (merge-base ~v0.0.63):
 *   - element reference param renamed `ref` -> `target` on click/hover/drag/
 *     select_option (drag also uses `startTarget`/`endTarget`)
 *   - `browser_check`/`browser_uncheck`/`browser_navigate_forward`/
 *     `browser_reload` still exist in the full tool catalog
 *     (`tools.browserTools`) but are marked `skillOnly: true` and are NOT
 *     reachable via `tools/call` anymore (verified: calling them directly
 *     returns `Tool "..." not found`) — check/uncheck folded into
 *     `browser_fill_form`'s `fields[].type`. They are intentionally left out
 *     of `actionToolNames` below; there is nothing to enhance on a tool that
 *     cannot be called.
 *   - `browser_run_code` -> `browser_run_code_unsafe`
 *   - `browser_take_screenshot` already exposes a `type` enum
 *     (png/jpeg/webp, default png when omitted) but has NO quality/size
 *     knob at all (no `quality` or `jpegQuality` property) — see
 *     tools/enhancer.js for what that means for the screenshot enhancement.
 */
'use strict';

const snapshotControlParams = {
  returnSnapshot: {
    type: 'boolean',
    default: false,
    description:
      'Whether the response should include the page snapshot inline. Default: false, which strips the ' +
      'Page/Snapshot sections down to a short confirmation. Set to true to get the (optionally shaped, ' +
      'see snapshotMaxElements/snapshotFormat/snapshotIncludeRoles/snapshotExcludeRoles) accessibility ' +
      'tree inlined in the response instead of just a saved-file link.',
  },
  snapshotMaxElements: {
    type: 'integer',
    default: 300,
    minimum: 1,
    maximum: 2000,
    description: 'Maximum elements in the inlined snapshot when returnSnapshot=true. Default: 300',
  },
  snapshotFormat: {
    type: 'string',
    enum: ['full', 'summary'],
    default: 'full',
    description: 'Inlined snapshot format when returnSnapshot=true: "full" tree or compact "summary".',
  },
  snapshotIncludeRoles: {
    type: 'array',
    items: { type: 'string' },
    description:
      'Only include elements with these ARIA roles in the inlined snapshot (e.g. ["button", "link"]). ' +
      'Ancestors are preserved for context. Takes priority over snapshotExcludeRoles.',
  },
  snapshotExcludeRoles: {
    type: 'array',
    items: { type: 'string' },
    description:
      'Exclude elements with these ARIA roles from the inlined snapshot (e.g. ["generic", "group"]). ' +
      'Children are promoted to the parent level.',
  },
};

/** Real, currently-callable action tools that attach a page snapshot to their response. */
const actionToolNames = new Set([
  'browser_click',
  'browser_type',
  'browser_hover',
  'browser_drag',
  'browser_select_option',
  'browser_press_key',
  'browser_navigate',
  'browser_navigate_back',
  'browser_fill_form',
  'browser_file_upload',
  'browser_wait_for',
  'browser_resize',
]);

/**
 * @typedef {Object} ToolEnhancement
 * @property {Record<string, any>} [additionalProperties] new properties merged into inputSchema.properties
 * @property {Record<string, any>} [propertyOverrides] patches merged into existing inputSchema.properties[key]
 */

/** @type {Record<string, ToolEnhancement>} */
const enhancedToolSchemas = {};
for (const name of actionToolNames)
  enhancedToolSchemas[name] = { additionalProperties: { ...snapshotControlParams } };

enhancedToolSchemas.browser_snapshot = {
  additionalProperties: {
    format: {
      type: 'string',
      enum: ['full', 'summary'],
      default: 'full',
      description: 'Output format: "full" returns the complete tree, "summary" returns a compact overview.',
    },
    maxElements: {
      type: 'integer',
      default: 300,
      minimum: 1,
      maximum: 2000,
      description: 'Maximum number of elements to include. Default: 300, Max: 2000',
    },
    includeRoles: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Only include elements with these ARIA roles (e.g. ["button", "link", "textbox"]). Ancestors ' +
        'preserved for context. Takes priority over excludeRoles.',
    },
    excludeRoles: {
      type: 'array',
      items: { type: 'string' },
      description: 'Exclude elements with these ARIA roles (e.g. ["generic", "group"]). Children promoted to parent level.',
    },
  },
};

enhancedToolSchemas.browser_console_messages = {
  additionalProperties: {
    limit: {
      type: 'integer',
      default: 50,
      minimum: 1,
      maximum: 500,
      description: 'Maximum messages to return. Default: 50, Max: 500',
    },
    countOnly: {
      type: 'boolean',
      default: false,
      description: 'Return only message counts instead of full messages.',
    },
  },
};

enhancedToolSchemas.browser_network_requests = {
  additionalProperties: {
    limit: {
      type: 'integer',
      default: 50,
      minimum: 1,
      maximum: 500,
      description: 'Maximum requests to return. Default: 50, Max: 500',
    },
    countOnly: {
      type: 'boolean',
      default: false,
      description: 'Return only request counts (by status code) instead of the full list.',
    },
  },
};

enhancedToolSchemas.browser_evaluate = {
  additionalProperties: {
    maxOutputLength: {
      type: 'integer',
      default: 10000,
      minimum: 100,
      maximum: 100000,
      description: 'Max characters of returned output before truncation. Default: 10000',
    },
  },
};

enhancedToolSchemas.browser_run_code_unsafe = {
  additionalProperties: {
    maxOutputLength: {
      type: 'integer',
      default: 50000,
      minimum: 100,
      maximum: 100000,
      description: 'Max characters of returned output before truncation. Default: 50000',
    },
  },
};

// browser_take_screenshot already has a `type` property (png/jpeg/webp,
// defaults to png when unset / inferred from filename). We don't add a new
// property here — we patch its documented default and description, and the
// enhancer injects `type: 'jpeg'` into the *call* arguments when the caller
// didn't specify one (see tools/enhancer.js). There is no quality/size knob
// exposed by upstream at all (no `quality`/`jpegQuality` property), so the
// legacy fork's thumbnail/medium/full resolution tiers and jpegQuality are
// dropped as infeasible via argument injection — see ENHANCEMENTS.md.
enhancedToolSchemas.browser_take_screenshot = {
  propertyOverrides: {
    type: {
      default: 'jpeg',
      description:
        'Image format for the screenshot. Enhancement layer default: "jpeg" (smaller than upstream\'s ' +
        'own default of "png"). If unset, inferred from the filename extension, otherwise jpeg.',
    },
  },
};

/**
 * Merge a ToolEnhancement into a tool's `tools/list` definition (schema
 * only — does not affect argument validation or the underlying tool
 * implementation).
 * @param {any} tool
 * @param {ToolEnhancement} enhancement
 */
function mergeToolSchema(tool, enhancement) {
  if (!tool.inputSchema)
    return tool;

  const properties = { ...(tool.inputSchema.properties || {}) };

  if (enhancement.additionalProperties)
    Object.assign(properties, enhancement.additionalProperties);

  if (enhancement.propertyOverrides) {
    for (const [key, patch] of Object.entries(enhancement.propertyOverrides))
      properties[key] = { ...(properties[key] || {}), ...patch };
  }

  return {
    ...tool,
    inputSchema: { ...tool.inputSchema, properties },
  };
}

module.exports = { enhancedToolSchemas, actionToolNames, mergeToolSchema };
