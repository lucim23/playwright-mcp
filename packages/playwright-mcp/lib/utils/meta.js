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
exports.buildResponseMeta = buildResponseMeta;
exports.formatMetaAsMarkdown = formatMetaAsMarkdown;
exports.appendMetaToResponse = appendMetaToResponse;
/**
 * Build a response meta object for including in tool responses
 */
function buildResponseMeta(options) {
    const meta = {};
    if (options.truncation) {
        meta.truncated = options.truncation.truncated;
        meta.returnedCount = options.truncation.returnedCount;
        meta.totalCount = options.truncation.totalCount;
        meta.limit = options.truncation.limit;
        if ('maxDepthReached' in options.truncation) {
            meta.maxDepthReached = options.truncation.maxDepthReached;
        }
    }
    if (options.snapshotDisabled !== undefined) {
        meta.snapshotDisabled = options.snapshotDisabled;
    }
    if (options.disabledReason) {
        meta.disabledReason = options.disabledReason;
    }
    if (options.hint) {
        meta.hint = options.hint;
    }
    if (options.quality) {
        meta.quality = options.quality;
    }
    if (options.dimensions) {
        meta.dimensions = options.dimensions;
    }
    if (options.sizeBytes !== undefined) {
        meta.sizeBytes = options.sizeBytes;
    }
    if (options.format) {
        meta.format = options.format;
    }
    return meta;
}
/**
 * Format meta information as a markdown section
 */
function formatMetaAsMarkdown(meta) {
    const lines = [];
    if (meta.truncated) {
        lines.push(`- Truncated: yes (returned ${meta.returnedCount} of ${meta.totalCount})`);
        if (meta.hint) {
            lines.push(`- Hint: ${meta.hint}`);
        }
    }
    if (meta.snapshotDisabled) {
        lines.push(`- Snapshot: disabled`);
        if (meta.disabledReason) {
            lines.push(`- Reason: ${meta.disabledReason}`);
        }
    }
    if (meta.quality) {
        lines.push(`- Quality: ${meta.quality}`);
    }
    if (meta.dimensions) {
        lines.push(`- Dimensions: ${meta.dimensions}`);
    }
    if (meta.sizeBytes !== undefined) {
        const sizeKB = (meta.sizeBytes / 1024).toFixed(1);
        lines.push(`- Size: ${sizeKB} KB`);
    }
    if (meta.format) {
        lines.push(`- Format: ${meta.format}`);
    }
    if (meta.maxDepthReached) {
        lines.push(`- Max depth reached: yes`);
    }
    return lines.length > 0 ? lines.join('\n') : '';
}
/**
 * Add meta section to response text
 */
function appendMetaToResponse(responseText, meta) {
    const metaMarkdown = formatMetaAsMarkdown(meta);
    if (!metaMarkdown) {
        return responseText;
    }
    return `${responseText}\n\n### Meta\n${metaMarkdown}`;
}
//# sourceMappingURL=meta.js.map