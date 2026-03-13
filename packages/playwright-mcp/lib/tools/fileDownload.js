"use strict";
/**
 * Custom tool: file_download
 * Downloads a file from a URL and saves it to a local path.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileDownloadToolDefinition = void 0;
exports.handleFileDownload = handleFileDownload;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
exports.fileDownloadToolDefinition = {
    name: 'file_download',
    description: 'Download a file from a URL and save it to a local path. Supports HTTP and HTTPS URLs. Follows redirects automatically.',
    inputSchema: {
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'The URL to download the file from'
            },
            path: {
                type: 'string',
                description: 'Target file path (absolute or just a filename). Relative paths resolve from the current working directory.'
            }
        },
        required: ['url', 'path'],
        additionalProperties: false
    },
    annotations: {
        title: 'File download',
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true
    }
};
async function handleFileDownload(params) {
    const { url } = params;
    const targetPath = path_1.default.resolve(params.path);
    // Ensure parent directory exists
    const dir = path_1.default.dirname(targetPath);
    if (!fs_1.default.existsSync(dir)) {
        return {
            content: [{ type: 'text', text: `### Error\nDirectory does not exist: ${dir}` }],
            isError: true
        };
    }
    try {
        const { size } = await downloadFile(url, targetPath);
        const sizeStr = formatBytes(size);
        return {
            content: [{
                    type: 'text',
                    text: `### Result\nDownloaded ${sizeStr} to ${targetPath}`
                }]
        };
    }
    catch (error) {
        // Clean up partial file on error
        try {
            fs_1.default.unlinkSync(targetPath);
        }
        catch { }
        return {
            content: [{ type: 'text', text: `### Error\nFailed to download: ${error.message}` }],
            isError: true
        };
    }
}
function downloadFile(url, targetPath, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0)
            return reject(new Error('Too many redirects'));
        const client = url.startsWith('https') ? https_1.default : http_1.default;
        client.get(url, (response) => {
            // Follow redirects
            if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                const redirectUrl = new URL(response.headers.location, url).href;
                response.resume();
                downloadFile(redirectUrl, targetPath, maxRedirects - 1).then(resolve, reject);
                return;
            }
            if (response.statusCode && (response.statusCode < 200 || response.statusCode >= 300)) {
                response.resume();
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }
            const file = fs_1.default.createWriteStream(targetPath);
            let size = 0;
            response.on('data', (chunk) => { size += chunk.length; });
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => resolve({ size }));
            });
            file.on('error', (err) => {
                file.close();
                reject(err);
            });
        }).on('error', reject);
    });
}
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
//# sourceMappingURL=fileDownload.js.map