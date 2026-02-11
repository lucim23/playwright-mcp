"use strict";
/**
 * OS-aware temporary directory for Playwright MCP file output.
 *
 * Uses os.tmpdir() so the path is correct on Linux, macOS, and Windows
 * without any hardcoded values.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getScreenshotTempDir = getScreenshotTempDir;
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const SUBDIR = 'playwright-mcp';
/**
 * Returns the temporary directory for Playwright MCP screenshots.
 * Creates the directory tree if it doesn't already exist.
 *
 *   Linux   → /tmp/playwright-mcp/screenshots/
 *   macOS   → /var/folders/…/T/playwright-mcp/screenshots/
 *   Windows → C:\Users\…\AppData\Local\Temp\playwright-mcp\screenshots\
 */
function getScreenshotTempDir() {
    const dir = path_1.default.join(os_1.default.tmpdir(), SUBDIR, 'screenshots');
    fs_1.default.mkdirSync(dir, { recursive: true });
    return dir;
}
//# sourceMappingURL=tempdir.js.map