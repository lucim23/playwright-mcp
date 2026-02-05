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
export function buildLightweightConfirmation(options: ActionConfirmationOptions): string {
  const lines: string[] = [];

  // Main action confirmation
  lines.push(`Action completed: ${options.action}`);

  // Element info if provided
  if (options.element) {
    lines.push(`Element: ${options.element}`);
  }

  // Navigation info if URL changed
  if (options.url && options.previousUrl && options.url !== options.previousUrl) {
    lines.push(`Page navigated to: ${options.url}`);
  } else if (options.url) {
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
export function buildClickConfirmation(
  element: string,
  options?: {
    doubleClick?: boolean;
    button?: string;
    url?: string;
    previousUrl?: string;
    title?: string;
  }
): string {
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
export function buildTypeConfirmation(
  element: string,
  textLength: number,
  options?: {
    submitted?: boolean;
    url?: string;
    previousUrl?: string;
    title?: string;
  }
): string {
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
export function buildHoverConfirmation(
  element: string,
  options?: {
    url?: string;
    title?: string;
  }
): string {
  return buildLightweightConfirmation({
    action: `Hovered over "${element}"`,
    url: options?.url,
    title: options?.title
  });
}

/**
 * Build confirmation for a drag action
 */
export function buildDragConfirmation(
  startElement: string,
  endElement: string,
  options?: {
    url?: string;
    title?: string;
  }
): string {
  return buildLightweightConfirmation({
    action: `Dragged from "${startElement}" to "${endElement}"`,
    url: options?.url,
    title: options?.title
  });
}

/**
 * Build confirmation for a select action
 */
export function buildSelectConfirmation(
  element: string,
  values: string[],
  options?: {
    url?: string;
    title?: string;
  }
): string {
  return buildLightweightConfirmation({
    action: `Selected "${values.join(', ')}" in "${element}"`,
    url: options?.url,
    title: options?.title
  });
}

/**
 * Build confirmation for a press key action
 */
export function buildPressKeyConfirmation(
  key: string,
  options?: {
    url?: string;
    previousUrl?: string;
    title?: string;
  }
): string {
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
export function buildNavigationConfirmation(
  url: string,
  options?: {
    title?: string;
    action?: string;
  }
): string {
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
export function buildWaitConfirmation(options: {
  waitType: 'time' | 'text' | 'textGone';
  value: string | number;
  url?: string;
  title?: string;
}): string {
  let action: string;
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
