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
exports.filterSnapshotText = filterSnapshotText;
function parseLines(text) {
    const lines = text.split('\n');
    const result = [];
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const trimmed = raw.trim();
        const indent = raw.length - raw.trimStart().length;
        const isElement = trimmed.startsWith('- ');
        let role = '';
        if (isElement) {
            const roleMatch = trimmed.match(/^- (\w+)/);
            if (roleMatch)
                role = roleMatch[1].toLowerCase();
        }
        result.push({ index: i, indent, role, isElement, raw });
    }
    return result;
}
/**
 * Filter snapshot text by including only elements with specified roles.
 * Ancestor elements of matching elements are preserved for context.
 */
function filterByIncludeRoles(parsed, roles) {
    const lowerRoles = roles.map(r => r.toLowerCase());
    const keepIndices = new Set();
    for (let i = 0; i < parsed.length; i++) {
        const line = parsed[i];
        if (!line.isElement)
            continue;
        if (lowerRoles.includes(line.role)) {
            keepIndices.add(i);
            // Walk backwards to find and keep all ancestors
            let currentIndent = line.indent;
            for (let j = i - 1; j >= 0 && currentIndent > 0; j--) {
                const prev = parsed[j];
                if (prev.isElement && prev.indent < currentIndent) {
                    keepIndices.add(j);
                    currentIndent = prev.indent;
                }
            }
        }
    }
    return keepIndices;
}
/**
 * Filter snapshot text by excluding elements with specified roles.
 * Children of excluded elements are promoted to the parent's indentation level.
 */
function filterByExcludeRoles(parsed, roles) {
    const lowerRoles = roles.map(r => r.toLowerCase());
    const result = [];
    // Stack of indentation levels of currently-excluded ancestors
    const excludedIndents = [];
    for (const line of parsed) {
        // Pop excluded ancestors we've moved past (same or lesser indent means we left their subtree)
        while (excludedIndents.length > 0 && line.isElement && line.indent <= excludedIndents[excludedIndents.length - 1])
            excludedIndents.pop();
        if (line.isElement && lowerRoles.includes(line.role)) {
            excludedIndents.push(line.indent);
            continue;
        }
        // If we're inside an excluded subtree, we're a child that needs promotion
        if (excludedIndents.length > 0) {
            // Each excluded ancestor removes one indent level (2 spaces)
            const offset = excludedIndents.length * 2;
            const newIndent = Math.max(0, line.indent - offset);
            result.push(' '.repeat(newIndent) + line.raw.trimStart());
        }
        else {
            result.push(line.raw);
        }
    }
    return result;
}
/**
 * Filter a YAML-like snapshot text by element roles.
 *
 * - `includeRoles`: Only keep elements matching these roles (ancestors preserved for context).
 * - `excludeRoles`: Remove elements matching these roles (children promoted to parent level).
 *
 * If both are provided, `includeRoles` takes priority.
 * Empty arrays are treated as not provided.
 */
function filterSnapshotText(snapshotText, options) {
    const includeRoles = options.includeRoles?.length ? options.includeRoles : undefined;
    const excludeRoles = options.excludeRoles?.length ? options.excludeRoles : undefined;
    if (!includeRoles && !excludeRoles) {
        const totalElements = countElements(snapshotText);
        return {
            text: snapshotText,
            meta: {
                filtered: false,
                totalElements,
                returnedCount: totalElements,
                filteredOut: 0,
                filterType: 'include',
                roles: []
            }
        };
    }
    const parsed = parseLines(snapshotText);
    const totalElements = parsed.filter(l => l.isElement).length;
    if (includeRoles) {
        // includeRoles takes priority
        const keepIndices = filterByIncludeRoles(parsed, includeRoles);
        const resultLines = [];
        for (let i = 0; i < parsed.length; i++) {
            const line = parsed[i];
            if (!line.isElement) {
                // Keep non-element lines if the preceding element was kept
                let precedingElementKept = false;
                for (let j = i - 1; j >= 0; j--) {
                    if (parsed[j].isElement) {
                        precedingElementKept = keepIndices.has(j);
                        break;
                    }
                }
                if (precedingElementKept)
                    resultLines.push(line.raw);
                continue;
            }
            if (keepIndices.has(i))
                resultLines.push(line.raw);
        }
        const returnedCount = [...keepIndices].filter(i => parsed[i].isElement).length;
        return {
            text: resultLines.join('\n'),
            meta: {
                filtered: true,
                totalElements,
                returnedCount,
                filteredOut: totalElements - returnedCount,
                filterType: 'include',
                roles: includeRoles
            }
        };
    }
    // excludeRoles
    const resultLines = filterByExcludeRoles(parsed, excludeRoles);
    const returnedCount = countElements(resultLines.join('\n'));
    return {
        text: resultLines.join('\n'),
        meta: {
            filtered: true,
            totalElements,
            returnedCount,
            filteredOut: totalElements - returnedCount,
            filterType: 'exclude',
            roles: excludeRoles
        }
    };
}
function countElements(text) {
    let count = 0;
    for (const line of text.split('\n')) {
        if (line.trim().startsWith('- '))
            count++;
    }
    return count;
}
//# sourceMappingURL=filter.js.map