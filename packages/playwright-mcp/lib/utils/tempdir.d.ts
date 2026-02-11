/**
 * OS-aware temporary directory for Playwright MCP file output.
 *
 * Uses os.tmpdir() so the path is correct on Linux, macOS, and Windows
 * without any hardcoded values.
 */
/**
 * Returns the temporary directory for Playwright MCP screenshots.
 * Creates the directory tree if it doesn't already exist.
 *
 *   Linux   → /tmp/playwright-mcp/screenshots/
 *   macOS   → /var/folders/…/T/playwright-mcp/screenshots/
 *   Windows → C:\Users\…\AppData\Local\Temp\playwright-mcp\screenshots\
 */
export declare function getScreenshotTempDir(): string;
//# sourceMappingURL=tempdir.d.ts.map