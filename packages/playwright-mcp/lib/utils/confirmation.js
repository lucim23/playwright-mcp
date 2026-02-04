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
exports.buildLightweightConfirmation = buildLightweightConfirmation;
exports.buildClickConfirmation = buildClickConfirmation;
exports.buildTypeConfirmation = buildTypeConfirmation;
exports.buildHoverConfirmation = buildHoverConfirmation;
exports.buildDragConfirmation = buildDragConfirmation;
exports.buildSelectConfirmation = buildSelectConfirmation;
exports.buildPressKeyConfirmation = buildPressKeyConfirmation;
exports.buildNavigationConfirmation = buildNavigationConfirmation;
exports.buildWaitConfirmation = buildWaitConfirmation;
/**
 * Build a lightweight confirmation message for action tools
 * This is used when returnSnapshot is false to provide minimal feedback
 */
function buildLightweightConfirmation(options) {
    const lines = [];
    // Main action confirmation
    lines.push(`Action completed: ${options.action}`);
    // Element info if provided
    if (options.element) {
        lines.push(`Element: ${options.element}`);
    }
    // Navigation info if URL changed
    if (options.url && options.previousUrl && options.url !== options.previousUrl) {
        lines.push(`Page navigated to: ${options.url}`);
    }
    else if (options.url) {
        lines.push(`Page URL: ${options.url}`);
    }
    // Page title if provided
    if (options.title) {
        lines.push(`Title: '${options.title}'`);
    }
    // Dialog info if visible
    if (options.dialogType && options.dialogMessage) {
        lines.push(`Dialog appeared: [${options.dialogType}] ${options.dialogMessage}`);
    }
    // Additional info
    if (options.additionalInfo) {
        for (const info of options.additionalInfo) {
            lines.push(info);
        }
    }
    return lines.join('\n');
}
/**
 * Build confirmation for a click action
 */
function buildClickConfirmation(element, options) {
    const clickType = options?.doubleClick ? 'Double-clicked' : 'Clicked';
    const buttonInfo = options?.button && options.button !== 'left' ? ` (${options.button} button)` : '';
    return buildLightweightConfirmation({
        action: `${clickType} on "${element}"${buttonInfo}`,
        url: options?.url,
        previousUrl: options?.previousUrl,
        title: options?.title
    });
}
/**
 * Build confirmation for a type action
 */
function buildTypeConfirmation(element, textLength, options) {
    const submitInfo = options?.submitted ? ' and submitted' : '';
    return buildLightweightConfirmation({
        action: `Typed ${textLength} characters into "${element}"${submitInfo}`,
        url: options?.url,
        previousUrl: options?.previousUrl,
        title: options?.title
    });
}
/**
 * Build confirmation for a hover action
 */
function buildHoverConfirmation(element, options) {
    return buildLightweightConfirmation({
        action: `Hovered over "${element}"`,
        url: options?.url,
        title: options?.title
    });
}
/**
 * Build confirmation for a drag action
 */
function buildDragConfirmation(startElement, endElement, options) {
    return buildLightweightConfirmation({
        action: `Dragged from "${startElement}" to "${endElement}"`,
        url: options?.url,
        title: options?.title
    });
}
/**
 * Build confirmation for a select action
 */
function buildSelectConfirmation(element, values, options) {
    return buildLightweightConfirmation({
        action: `Selected "${values.join(', ')}" in "${element}"`,
        url: options?.url,
        title: options?.title
    });
}
/**
 * Build confirmation for a press key action
 */
function buildPressKeyConfirmation(key, options) {
    return buildLightweightConfirmation({
        action: `Pressed key "${key}"`,
        url: options?.url,
        previousUrl: options?.previousUrl,
        title: options?.title
    });
}
/**
 * Build confirmation for a navigation action
 */
function buildNavigationConfirmation(url, options) {
    const actionName = options?.action || 'Navigated';
    return buildLightweightConfirmation({
        action: `${actionName} to ${url}`,
        url,
        title: options?.title
    });
}
/**
 * Build confirmation for a wait action
 */
function buildWaitConfirmation(options) {
    let action;
    switch (options.waitType) {
        case 'time':
            action = `Waited for ${options.value} seconds`;
            break;
        case 'text':
            action = `Waited for text "${options.value}" to appear`;
            break;
        case 'textGone':
            action = `Waited for text "${options.value}" to disappear`;
            break;
        default:
            action = `Wait completed`;
    }
    return buildLightweightConfirmation({
        action,
        url: options.url,
        title: options.title
    });
}
//# sourceMappingURL=confirmation.js.map