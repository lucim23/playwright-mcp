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
export interface ActionConfirmationOptions {
    action: string;
    element?: string;
    url?: string;
    previousUrl?: string;
    title?: string;
    dialogMessage?: string;
    dialogType?: string;
    additionalInfo?: string[];
}
/**
 * Build a lightweight confirmation message for action tools
 * This is used when returnSnapshot is false to provide minimal feedback
 */
export declare function buildLightweightConfirmation(options: ActionConfirmationOptions): string;
/**
 * Build confirmation for a click action
 */
export declare function buildClickConfirmation(element: string, options?: {
    doubleClick?: boolean;
    button?: string;
    url?: string;
    previousUrl?: string;
    title?: string;
}): string;
/**
 * Build confirmation for a type action
 */
export declare function buildTypeConfirmation(element: string, textLength: number, options?: {
    submitted?: boolean;
    url?: string;
    previousUrl?: string;
    title?: string;
}): string;
/**
 * Build confirmation for a hover action
 */
export declare function buildHoverConfirmation(element: string, options?: {
    url?: string;
    title?: string;
}): string;
/**
 * Build confirmation for a drag action
 */
export declare function buildDragConfirmation(startElement: string, endElement: string, options?: {
    url?: string;
    title?: string;
}): string;
/**
 * Build confirmation for a select action
 */
export declare function buildSelectConfirmation(element: string, values: string[], options?: {
    url?: string;
    title?: string;
}): string;
/**
 * Build confirmation for a press key action
 */
export declare function buildPressKeyConfirmation(key: string, options?: {
    url?: string;
    previousUrl?: string;
    title?: string;
}): string;
/**
 * Build confirmation for a navigation action
 */
export declare function buildNavigationConfirmation(url: string, options?: {
    title?: string;
    action?: string;
}): string;
/**
 * Build confirmation for a wait action
 */
export declare function buildWaitConfirmation(options: {
    waitType: 'time' | 'text' | 'textGone';
    value: string | number;
    url?: string;
    title?: string;
}): string;
//# sourceMappingURL=confirmation.d.ts.map