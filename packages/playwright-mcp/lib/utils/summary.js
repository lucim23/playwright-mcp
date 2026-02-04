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
exports.parseSnapshotElements = parseSnapshotElements;
exports.extractLandmarks = extractLandmarks;
exports.extractHeadings = extractHeadings;
exports.extractKeyText = extractKeyText;
exports.summarizeSnapshot = summarizeSnapshot;
exports.formatSnapshotSummary = formatSnapshotSummary;
/**
 * Parse YAML-like snapshot text to extract element counts
 */
function parseSnapshotElements(snapshotText) {
    const counts = new Map();
    const lines = snapshotText.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('- '))
            continue;
        // Extract role from line like "- button "Submit" [ref=e2]"
        const roleMatch = trimmed.match(/^- (\w+)/);
        if (roleMatch) {
            const role = roleMatch[1].toLowerCase();
            counts.set(role, (counts.get(role) || 0) + 1);
        }
    }
    return counts;
}
/**
 * Extract landmarks from snapshot text
 */
function extractLandmarks(snapshotText) {
    const landmarks = [];
    const landmarkRoles = ['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'search', 'form', 'region'];
    const lines = snapshotText.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('- '))
            continue;
        for (const role of landmarkRoles) {
            if (trimmed.startsWith(`- ${role}`)) {
                // Extract name if available
                const nameMatch = trimmed.match(/"([^"]+)"/);
                const name = nameMatch ? nameMatch[1] : '';
                landmarks.push(name ? `${role} "${name}"` : role);
                break;
            }
        }
    }
    return landmarks;
}
/**
 * Extract headings from snapshot text
 */
function extractHeadings(snapshotText) {
    const headings = [];
    const lines = snapshotText.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('- heading'))
            continue;
        // Extract heading text like '- heading "My Title" [level=1]'
        const textMatch = trimmed.match(/"([^"]+)"/);
        if (textMatch) {
            headings.push(textMatch[1]);
        }
    }
    return headings.slice(0, 5); // Return first 5 headings
}
/**
 * Extract key text content from snapshot
 */
function extractKeyText(snapshotText) {
    const keyText = [];
    const lines = snapshotText.split('\n');
    // Look for prominent text content (links, headings, buttons with text)
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('- '))
            continue;
        // Skip generic containers
        if (trimmed.startsWith('- generic') || trimmed.startsWith('- group'))
            continue;
        // Extract text from quoted content
        const textMatch = trimmed.match(/"([^"]+)"/);
        if (textMatch && textMatch[1].length > 3 && textMatch[1].length < 100) {
            const text = textMatch[1];
            if (!keyText.includes(text)) {
                keyText.push(text);
            }
        }
        if (keyText.length >= 5)
            break;
    }
    return keyText;
}
/**
 * Generate a summary of a snapshot for quick overview
 */
function summarizeSnapshot(snapshotText, options) {
    const counts = parseSnapshotElements(snapshotText);
    const landmarks = extractLandmarks(snapshotText);
    const headings = extractHeadings(snapshotText);
    const keyText = extractKeyText(snapshotText);
    // Count total elements
    let totalElements = 0;
    for (const line of snapshotText.split('\n')) {
        if (line.trim().startsWith('- '))
            totalElements++;
    }
    return {
        pageTitle: options?.pageTitle,
        pageUrl: options?.pageUrl,
        landmarks,
        interactive: {
            buttons: counts.get('button') || 0,
            links: counts.get('link') || 0,
            inputs: (counts.get('textbox') || 0) + (counts.get('searchbox') || 0) + (counts.get('spinbutton') || 0),
            selects: (counts.get('combobox') || 0) + (counts.get('listbox') || 0),
            checkboxes: counts.get('checkbox') || 0,
            radios: counts.get('radio') || 0,
            textareas: counts.get('textbox') || 0,
            total: (counts.get('button') || 0) + (counts.get('link') || 0) +
                (counts.get('textbox') || 0) + (counts.get('combobox') || 0) +
                (counts.get('checkbox') || 0) + (counts.get('radio') || 0)
        },
        content: {
            headings,
            keyText,
            images: counts.get('img') || counts.get('image') || 0,
            tables: counts.get('table') || 0,
            lists: (counts.get('list') || 0) + (counts.get('listitem') || 0)
        },
        totalElements
    };
}
/**
 * Format a snapshot summary as a compact text representation
 */
function formatSnapshotSummary(summary) {
    const lines = [];
    if (summary.pageTitle) {
        lines.push(`Page: ${summary.pageTitle}`);
    }
    if (summary.pageUrl) {
        lines.push(`URL: ${summary.pageUrl}`);
    }
    if (summary.landmarks.length > 0) {
        lines.push(`Landmarks: ${summary.landmarks.join(', ')}`);
    }
    const { interactive } = summary;
    const interactiveItems = [];
    if (interactive.buttons)
        interactiveItems.push(`${interactive.buttons} buttons`);
    if (interactive.links)
        interactiveItems.push(`${interactive.links} links`);
    if (interactive.inputs)
        interactiveItems.push(`${interactive.inputs} inputs`);
    if (interactive.selects)
        interactiveItems.push(`${interactive.selects} selects`);
    if (interactive.checkboxes)
        interactiveItems.push(`${interactive.checkboxes} checkboxes`);
    if (interactiveItems.length > 0) {
        lines.push(`Interactive elements: ${interactiveItems.join(', ')}`);
    }
    if (summary.content.headings.length > 0) {
        lines.push(`Headings: ${summary.content.headings.map(h => `"${h}"`).join(', ')}`);
    }
    if (summary.content.keyText.length > 0) {
        lines.push(`Key text: ${summary.content.keyText.map(t => `"${t}"`).join(', ')}`);
    }
    lines.push(`Total elements: ${summary.totalElements}`);
    return lines.join('\n');
}
//# sourceMappingURL=summary.js.map