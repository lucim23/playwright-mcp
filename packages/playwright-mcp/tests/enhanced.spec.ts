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

import { test, expect } from './fixtures';

test.describe('Enhanced Tool Parameters', () => {
  test.describe('Utility functions', () => {
    const {
      truncateArray,
      truncateString,
      truncateSnapshotText,
      countSnapshotElements,
    } = require('../lib/utils/truncate');

    const {
      buildResponseMeta,
      formatMetaAsMarkdown,
      appendMetaToResponse,
    } = require('../lib/utils/meta');

    const {
      buildClickConfirmation,
      buildTypeConfirmation,
      buildNavigationConfirmation,
    } = require('../lib/utils/confirmation');

    const {
      summarizeSnapshot,
      formatSnapshotSummary,
      parseSnapshotElements,
      extractLandmarks,
      extractHeadings,
    } = require('../lib/utils/summary');

    test('truncateArray should limit array size', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = truncateArray(array, 5);

      expect(result.items).toHaveLength(5);
      expect(result.items).toEqual([6, 7, 8, 9, 10]); // From end by default
      expect(result.meta.truncated).toBe(true);
      expect(result.meta.returnedCount).toBe(5);
      expect(result.meta.totalCount).toBe(10);
    });

    test('truncateArray should not truncate small arrays', () => {
      const array = [1, 2, 3];
      const result = truncateArray(array, 5);

      expect(result.items).toHaveLength(3);
      expect(result.meta.truncated).toBe(false);
    });

    test('truncateString should limit string length', () => {
      const text = 'This is a very long string that needs to be truncated';
      const result = truncateString(text, 20);

      expect(result.text.length).toBeLessThan(text.length);
      expect(result.text).toContain('...[truncated]');
      expect(result.meta.truncated).toBe(true);
    });

    test('truncateSnapshotText should limit elements', () => {
      const snapshotText = `
- button "Submit" [ref=e1]
- textbox "Email" [ref=e2]
- link "Home" [ref=e3]
- heading "Welcome" [ref=e4]
- paragraph "Some text" [ref=e5]
      `.trim();

      const result = truncateSnapshotText(snapshotText, 3);

      expect(result.meta.truncated).toBe(true);
      expect(result.meta.returnedCount).toBe(3);
      expect(result.meta.totalCount).toBe(5);
      expect(result.text).toContain('truncated');
    });

    test('countSnapshotElements should count elements correctly', () => {
      const snapshotText = `
- button "Submit" [ref=e1]
- textbox "Email" [ref=e2]
- link "Home" [ref=e3]
      `.trim();

      expect(countSnapshotElements(snapshotText)).toBe(3);
    });

    test('buildResponseMeta should construct meta object', () => {
      const meta = buildResponseMeta({
        truncation: { truncated: true, returnedCount: 50, totalCount: 100, limit: 50 },
        hint: 'Increase limit to see more',
      });

      expect(meta.truncated).toBe(true);
      expect(meta.returnedCount).toBe(50);
      expect(meta.totalCount).toBe(100);
      expect(meta.hint).toBe('Increase limit to see more');
    });

    test('formatMetaAsMarkdown should generate markdown', () => {
      const meta = {
        truncated: true,
        returnedCount: 50,
        totalCount: 100,
        hint: 'Increase limit',
      };

      const markdown = formatMetaAsMarkdown(meta);

      expect(markdown).toContain('Truncated: yes');
      expect(markdown).toContain('returned 50 of 100');
      expect(markdown).toContain('Hint: Increase limit');
    });

    test('appendMetaToResponse should add meta section', () => {
      const response = '### Result\nAction completed';
      const meta = { truncated: true, returnedCount: 10, totalCount: 50 };

      const result = appendMetaToResponse(response, meta);

      expect(result).toContain('### Result');
      expect(result).toContain('### Meta');
      expect(result).toContain('Truncated: yes');
    });

    test('buildClickConfirmation should generate confirmation', () => {
      const confirmation = buildClickConfirmation('Submit button', {
        url: 'https://example.com/success',
        title: 'Success Page',
      });

      expect(confirmation).toContain('Clicked on "Submit button"');
      expect(confirmation).toContain('https://example.com/success');
      expect(confirmation).toContain('Success Page');
    });

    test('buildTypeConfirmation should generate confirmation', () => {
      const confirmation = buildTypeConfirmation('Email input', 15, {
        submitted: true,
        url: 'https://example.com',
        title: 'Form',
      });

      expect(confirmation).toContain('Typed 15 characters');
      expect(confirmation).toContain('Email input');
      expect(confirmation).toContain('submitted');
    });

    test('buildNavigationConfirmation should generate confirmation', () => {
      const confirmation = buildNavigationConfirmation('https://example.com/page', {
        title: 'My Page',
        action: 'Navigated',
      });

      expect(confirmation).toContain('Navigated to https://example.com/page');
      expect(confirmation).toContain('My Page');
    });

    test('parseSnapshotElements should count element types', () => {
      const snapshotText = `
- button "Submit" [ref=e1]
- button "Cancel" [ref=e2]
- textbox "Email" [ref=e3]
- link "Home" [ref=e4]
- link "About" [ref=e5]
      `.trim();

      const counts = parseSnapshotElements(snapshotText);

      expect(counts.get('button')).toBe(2);
      expect(counts.get('textbox')).toBe(1);
      expect(counts.get('link')).toBe(2);
    });

    test('extractLandmarks should find landmark regions', () => {
      const snapshotText = `
- banner "Site Header"
- navigation "Main Menu"
- main "Content"
- complementary "Sidebar"
- contentinfo "Footer"
- button "Submit"
      `.trim();

      const landmarks = extractLandmarks(snapshotText);

      expect(landmarks).toContain('banner "Site Header"');
      expect(landmarks).toContain('navigation "Main Menu"');
      expect(landmarks).toContain('main "Content"');
      expect(landmarks.length).toBeGreaterThanOrEqual(4);
    });

    test('extractHeadings should find headings', () => {
      const snapshotText = `
- heading "Welcome to Our Site" [level=1]
- heading "About Us" [level=2]
- heading "Contact" [level=2]
- button "Submit"
      `.trim();

      const headings = extractHeadings(snapshotText);

      expect(headings).toContain('Welcome to Our Site');
      expect(headings).toContain('About Us');
      expect(headings).toContain('Contact');
    });

    test('summarizeSnapshot should generate summary', () => {
      const snapshotText = `
- banner "Header"
- navigation "Nav"
- main "Content"
- button "Submit"
- button "Cancel"
- link "Home"
- link "About"
- textbox "Email"
- heading "Welcome" [level=1]
      `.trim();

      const summary = summarizeSnapshot(snapshotText, {
        pageTitle: 'Test Page',
        pageUrl: 'https://example.com',
      });

      expect(summary.pageTitle).toBe('Test Page');
      expect(summary.pageUrl).toBe('https://example.com');
      expect(summary.landmarks.length).toBeGreaterThan(0);
      expect(summary.interactive.buttons).toBe(2);
      expect(summary.interactive.links).toBe(2);
      expect(summary.totalElements).toBe(9);
    });

    test('formatSnapshotSummary should generate text', () => {
      const summary = {
        pageTitle: 'Test Page',
        pageUrl: 'https://example.com',
        landmarks: ['banner', 'main'],
        interactive: {
          buttons: 2,
          links: 3,
          inputs: 1,
          selects: 0,
          checkboxes: 0,
          radios: 0,
          textareas: 0,
          total: 6,
        },
        content: {
          headings: ['Welcome', 'About'],
          keyText: ['Submit', 'Cancel'],
          images: 0,
          tables: 0,
          lists: 0,
        },
        totalElements: 15,
      };

      const text = formatSnapshotSummary(summary);

      expect(text).toContain('Page: Test Page');
      expect(text).toContain('URL: https://example.com');
      expect(text).toContain('Landmarks:');
      expect(text).toContain('buttons');
      expect(text).toContain('links');
      expect(text).toContain('Total elements: 15');
    });
  });

  test.describe('Schema merging', () => {
    const { enhancedToolSchemas } = require('../lib/index');

    test('enhancedToolSchemas should define additional properties for action tools', () => {
      expect(enhancedToolSchemas.browser_click).toBeDefined();
      expect(enhancedToolSchemas.browser_click.additionalProperties.returnSnapshot).toBeDefined();
      expect(enhancedToolSchemas.browser_click.additionalProperties.returnSnapshot.type).toBe('boolean');
      expect(enhancedToolSchemas.browser_click.additionalProperties.returnSnapshot.default).toBe(false);
    });

    test('enhancedToolSchemas should define additional properties for browser_snapshot', () => {
      expect(enhancedToolSchemas.browser_snapshot).toBeDefined();
      expect(enhancedToolSchemas.browser_snapshot.additionalProperties.format).toBeDefined();
      expect(enhancedToolSchemas.browser_snapshot.additionalProperties.maxElements).toBeDefined();
      expect(enhancedToolSchemas.browser_snapshot.additionalProperties.maxDepth).toBeDefined();
      expect(enhancedToolSchemas.browser_snapshot.additionalProperties.selector).toBeDefined();
    });

    test('enhancedToolSchemas should define additional properties for console/network tools', () => {
      expect(enhancedToolSchemas.browser_console_messages).toBeDefined();
      expect(enhancedToolSchemas.browser_console_messages.additionalProperties.limit).toBeDefined();
      expect(enhancedToolSchemas.browser_console_messages.additionalProperties.countOnly).toBeDefined();

      expect(enhancedToolSchemas.browser_network_requests).toBeDefined();
      expect(enhancedToolSchemas.browser_network_requests.additionalProperties.limit).toBeDefined();
      expect(enhancedToolSchemas.browser_network_requests.additionalProperties.countOnly).toBeDefined();
    });

    test('enhancedToolSchemas should define additional properties for evaluate/run_code', () => {
      expect(enhancedToolSchemas.browser_evaluate).toBeDefined();
      expect(enhancedToolSchemas.browser_evaluate.additionalProperties.maxOutputLength).toBeDefined();

      expect(enhancedToolSchemas.browser_run_code).toBeDefined();
      expect(enhancedToolSchemas.browser_run_code.additionalProperties.maxOutputLength).toBeDefined();
      expect(enhancedToolSchemas.browser_run_code.additionalProperties.outputFile).toBeDefined();
    });

    test('enhancedToolSchemas should define additional properties for screenshot', () => {
      expect(enhancedToolSchemas.browser_take_screenshot).toBeDefined();
      expect(enhancedToolSchemas.browser_take_screenshot.additionalProperties.quality).toBeDefined();
      expect(enhancedToolSchemas.browser_take_screenshot.additionalProperties.jpegQuality).toBeDefined();
    });
  });

  test.describe('Tool enhancer', () => {
    const { enhanceToolResponse } = require('../lib/tools/enhancer');

    test('should remove snapshot when returnSnapshot is false', () => {
      const response = {
        content: [{
          type: 'text',
          text: `### Page
- Page URL: https://example.com
- Page Title: Test

### Ran Playwright code
\`\`\`js
await page.click();
\`\`\`

### Snapshot
\`\`\`yaml
- button "Submit" [ref=e1]
- textbox "Email" [ref=e2]
\`\`\``
        }]
      };

      const enhanced = enhanceToolResponse(response, {
        toolName: 'browser_click',
        params: { returnSnapshot: false, element: 'Submit button', ref: 'e1' },
        config: {}
      });

      const text = enhanced.content[0].text;
      expect(text).not.toContain('### Snapshot');
      expect(text).toContain('### Meta');
      expect(text).toContain('Snapshot: disabled');
    });

    test('should preserve snapshot when returnSnapshot is true', () => {
      const response = {
        content: [{
          type: 'text',
          text: `### Page
- Page URL: https://example.com

### Snapshot
\`\`\`yaml
- button "Submit" [ref=e1]
\`\`\``
        }]
      };

      const enhanced = enhanceToolResponse(response, {
        toolName: 'browser_click',
        params: { returnSnapshot: true },
        config: {}
      });

      const text = enhanced.content[0].text;
      expect(text).toContain('### Snapshot');
    });

    test('should truncate console messages with limit', () => {
      const messages = Array.from({ length: 100 }, (_, i) => `[INFO] Message ${i}`).join('\n');
      const response = {
        content: [{
          type: 'text',
          text: `### Result
Total messages: 100 (Errors: 0, Warnings: 0)

${messages}`
        }]
      };

      const enhanced = enhanceToolResponse(response, {
        toolName: 'browser_console_messages',
        params: { limit: 10 },
        config: {}
      });

      const text = enhanced.content[0].text;
      expect(text).toContain('### Meta');
      expect(text).toContain('Truncated: yes');
      expect(text).toContain('returned 10 of 100');
    });

    test('should return counts only with countOnly flag', () => {
      const response = {
        content: [{
          type: 'text',
          text: `### Result
Total messages: 50 (Errors: 5, Warnings: 10)

[ERROR] Error 1
[WARNING] Warning 1
[INFO] Info 1`
        }]
      };

      const enhanced = enhanceToolResponse(response, {
        toolName: 'browser_console_messages',
        params: { countOnly: true },
        config: {}
      });

      const text = enhanced.content[0].text;
      expect(text).toContain('Console message counts');
      expect(text).toContain('Total: 50');
      expect(text).toContain('Errors: 5');
      expect(text).toContain('Warnings: 10');
    });

    test('should truncate code execution output', () => {
      const longOutput = 'x'.repeat(50000);
      const response = {
        content: [{
          type: 'text',
          text: `### Result
${longOutput}`
        }]
      };

      const enhanced = enhanceToolResponse(response, {
        toolName: 'browser_evaluate',
        params: { maxOutputLength: 1000 },
        config: {}
      });

      const text = enhanced.content[0].text;
      expect(text.length).toBeLessThan(longOutput.length);
      expect(text).toContain('### Meta');
      expect(text).toContain('Truncated: yes');
    });
  });
});

test.describe('Integration tests for enhanced parameters', () => {
  test.skip('browser_click with returnSnapshot=false should not include snapshot', async ({ client, server }) => {
    // This test is skipped because it requires the enhanced wrapper to be fully integrated
    // The test demonstrates the expected behavior once integration is complete
    server.setContent('/', `
      <title>Test Page</title>
      <button>Click Me</button>
    `, 'text/html');

    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    });

    const response = await client.callTool({
      name: 'browser_click',
      arguments: {
        element: 'Click Me button',
        ref: 'e2',
        returnSnapshot: false,
      },
    });

    const text = response.content[0].text;
    // When integrated, this should not contain a snapshot section
    expect(text).not.toContain('### Snapshot');
  });

  test.skip('browser_snapshot with format=summary should return compact output', async ({ client, server }) => {
    server.setContent('/', `
      <title>Test Page</title>
      <nav>Navigation</nav>
      <main>
        <h1>Welcome</h1>
        <button>Submit</button>
        <button>Cancel</button>
        <a href="#">Link 1</a>
        <a href="#">Link 2</a>
        <input type="text" placeholder="Email">
      </main>
    `, 'text/html');

    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    });

    const response = await client.callTool({
      name: 'browser_snapshot',
      arguments: {
        format: 'summary',
      },
    });

    const text = response.content[0].text;
    // When integrated, this should return a compact summary
    expect(text).toContain('buttons');
    expect(text).toContain('links');
    expect(text).toContain('Total elements');
  });

  test.skip('browser_console_messages with limit should truncate output', async ({ client, server }) => {
    server.setContent('/', `
      <title>Console Test</title>
      <script>
        for (let i = 0; i < 100; i++) {
          console.log('Message ' + i);
        }
      </script>
    `, 'text/html');

    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    });

    const response = await client.callTool({
      name: 'browser_console_messages',
      arguments: {
        level: 'info',
        limit: 10,
      },
    });

    const text = response.content[0].text;
    // When integrated, this should be truncated
    expect(text).toContain('### Meta');
    expect(text).toContain('Truncated: yes');
  });
});
