/**
 * OS-aware temporary directory for Playwright MCP file output.
 *
 * Uses os.tmpdir() so the path is correct on Linux, macOS, and Windows
 * without any hardcoded values.
 */

import os from 'os';
import path from 'path';
import fs from 'fs';

const SUBDIR = 'playwright-mcp';

/**
 * Returns the temporary directory for Playwright MCP screenshots.
 * Creates the directory tree if it doesn't already exist.
 *
 *   Linux   → /tmp/playwright-mcp/screenshots/
 *   macOS   → /var/folders/…/T/playwright-mcp/screenshots/
 *   Windows → C:\Users\…\AppData\Local\Temp\playwright-mcp\screenshots\
 */
export function getScreenshotTempDir(): string {
  const dir = path.join(os.tmpdir(), SUBDIR, 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
