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
exports.truncateArray = truncateArray;
exports.truncateString = truncateString;
exports.truncateSnapshot = truncateSnapshot;
exports.countNodes = countNodes;
exports.countSnapshotElements = countSnapshotElements;
exports.truncateSnapshotText = truncateSnapshotText;
/**
 * Truncate an array to a maximum number of elements
 */
function truncateArray(array, limit, fromEnd = true) {
    const total = array.length;
    const truncated = total > limit;
    const items = fromEnd ? array.slice(-limit) : array.slice(0, limit);
    return {
        items,
        meta: {
            truncated,
            returnedCount: items.length,
            totalCount: total,
            limit
        }
    };
}
/**
 * Truncate a string to a maximum length
 */
function truncateString(text, maxLength) {
    const total = text.length;
    const truncated = total > maxLength;
    const resultText = truncated ? text.slice(0, maxLength) + '...[truncated]' : text;
    return {
        text: resultText,
        meta: {
            truncated,
            returnedCount: Math.min(total, maxLength),
            totalCount: total,
            limit: maxLength
        }
    };
}
/**
 * Truncate an accessibility snapshot tree to a maximum number of elements and depth
 */
function truncateSnapshot(snapshot, maxElements, maxDepth) {
    let count = 0;
    const total = countNodes(snapshot);
    let maxDepthReached = false;
    function traverse(node, depth) {
        if (count >= maxElements)
            return null;
        if (depth > maxDepth) {
            maxDepthReached = true;
            return null;
        }
        count++;
        const result = { ...node };
        if (node.children && node.children.length > 0) {
            result.children = node.children
                .map(child => traverse(child, depth + 1))
                .filter((child) => child !== null);
        }
        return result;
    }
    const tree = traverse(snapshot, 0);
    return {
        tree,
        meta: {
            truncated: count >= maxElements || maxDepthReached,
            returnedCount: count,
            totalCount: total,
            limit: maxElements,
            maxDepthReached
        }
    };
}
/**
 * Count all nodes in a snapshot tree
 */
function countNodes(node) {
    let count = 1;
    if (node.children) {
        for (const child of node.children) {
            count += countNodes(child);
        }
    }
    return count;
}
/**
 * Parse YAML-like snapshot text and count elements
 */
function countSnapshotElements(snapshotText) {
    // Count lines that start with '- ' which indicate elements in YAML aria snapshot
    const lines = snapshotText.split('\n');
    let count = 0;
    for (const line of lines) {
        if (line.trim().startsWith('- ')) {
            count++;
        }
    }
    return count;
}
/**
 * Truncate YAML-like snapshot text to a maximum number of elements
 */
function truncateSnapshotText(snapshotText, maxElements) {
    const lines = snapshotText.split('\n');
    const resultLines = [];
    let elementCount = 0;
    let totalElements = 0;
    // First pass: count total elements
    for (const line of lines) {
        if (line.trim().startsWith('- ')) {
            totalElements++;
        }
    }
    // Second pass: truncate
    for (const line of lines) {
        if (line.trim().startsWith('- ')) {
            if (elementCount >= maxElements) {
                break;
            }
            elementCount++;
        }
        resultLines.push(line);
    }
    const truncated = totalElements > maxElements;
    if (truncated) {
        resultLines.push(`# ... truncated (${totalElements - elementCount} more elements)`);
    }
    return {
        text: resultLines.join('\n'),
        meta: {
            truncated,
            returnedCount: elementCount,
            totalCount: totalElements,
            limit: maxElements
        }
    };
}
//# sourceMappingURL=truncate.js.map