/**
 * Custom tool: file_download.
 *
 * Rebuilt (hardened) version of the legacy enhancement layer's
 * `packages/playwright-mcp/src/tools/fileDownload.ts`. The legacy version
 * wrote to an arbitrary caller-supplied path with no size/time bound and no
 * origin awareness (flagged in the EP-1 study report as an SSRF/disk-fill
 * risk). This version:
 *
 *  - only allows http/https URLs (rejects file:, data:, ftp:, etc.)
 *  - confines writes inside the MCP output directory (Config.outputDir /
 *    PLAYWRIGHT_MCP_OUTPUT_DIR, default `<cwd>/.playwright-mcp`) unless
 *    PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS=1 (mirrors upstream's own
 *    `allowUnrestrictedFileAccess` guardrail) — rejects path traversal
 *    (`../..`) and absolute paths outside that directory
 *  - enforces a configurable size cap (default 100 MB), checked against
 *    Content-Length up front AND against actual bytes streamed (so a server
 *    that lies about, or omits, Content-Length can't blow past the cap)
 *  - enforces a configurable timeout (default 60s) for the whole operation
 *  - follows redirects up to a hop limit (default 5), re-validating the
 *    scheme on every hop
 *  - deletes the partial file on any failure (bad status, size exceeded,
 *    timeout, network error)
 *  - returns the resolved path, byte count, and content-type on success
 *
 * Known, deliberate gap: this does not attempt SSRF protection (e.g.
 * resolving the hostname and rejecting private/loopback/link-local IP
 * ranges). That was flagged in the EP-1 study report as a risk but is not
 * part of the explicit hardening checklist for this tool in TK-2; flagging
 * it here as a follow-up rather than silently adding unscoped behavior.
 */
'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const { resolveOutputDir, unrestrictedFileAccessAllowed, confine, ensureParentDir } = require('../utils/outputDir');

const DEFAULT_MAX_BYTES = 100 * 1024 * 1024; // 100MB
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_REDIRECTS = 5;

const fileDownloadToolDefinition = {
  name: 'file_download',
  description:
    'Download a file from an HTTP or HTTPS URL and save it to disk. Writes are confined to the MCP ' +
    'output directory by default (see PLAYWRIGHT_MCP_OUTPUT_DIR). Follows redirects (up to 5 hops) and ' +
    'enforces a size cap (default 100MB) and timeout (default 60s) during the download, not just from ' +
    'response headers.',
  inputSchema: {
    '$schema': 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The http:// or https:// URL to download the file from.',
      },
      path: {
        type: 'string',
        description:
          'Target file path. Relative paths resolve inside the MCP output directory. Absolute paths ' +
          'must also resolve inside the output directory unless unrestricted file access is enabled. ' +
          'If omitted, a filename is derived from the URL.',
      },
      maxBytes: {
        type: 'integer',
        minimum: 1,
        description: `Maximum allowed download size in bytes. Default ${DEFAULT_MAX_BYTES} (100MB).`,
      },
      timeoutMs: {
        type: 'integer',
        minimum: 1,
        description: `Timeout for the whole download in milliseconds. Default ${DEFAULT_TIMEOUT_MS} (60s).`,
      },
    },
    required: ['url'],
    additionalProperties: false,
  },
  annotations: {
    title: 'File download',
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: true,
  },
};

/** @param {string} text */
function errorResult(text) {
  return { content: [{ type: 'text', text: `### Error\n${text}` }], isError: true };
}

/** @param {string} filePath @param {number} bytes @param {string|undefined} contentType */
function successResult(filePath, bytes, contentType) {
  const sizeStr = formatBytes(bytes);
  const lines = [
    `Downloaded ${sizeStr} to ${filePath}`,
    `- path: ${filePath}`,
    `- bytes: ${bytes}`,
    `- contentType: ${contentType || 'unknown'}`,
  ];
  return { content: [{ type: 'text', text: `### Result\n${lines.join('\n')}` }] };
}

/** @param {number} bytes */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Best-effort derive a filename from a URL's pathname. @param {URL} url */
function deriveFilenameFromUrl(url) {
  const base = path.basename(url.pathname || '');
  if (base && base !== '/' && base !== '.')
    return base;
  return `download-${Date.now()}`;
}

/**
 * Stream `url` to `filePath`, enforcing size cap and timeout, following
 * redirects. Rejects (and the caller is responsible for cleaning up the
 * partial file) on any error.
 *
 * @param {string} url
 * @param {string} filePath
 * @param {{ maxBytes: number, timeoutMs: number, maxRedirects: number, deadline: number }} opts
 * @returns {Promise<{ bytes: number, contentType: string | undefined }>}
 */
function streamDownload(url, filePath, opts) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error(`Invalid URL: ${url}`));
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      reject(new Error(`Unsupported protocol "${parsed.protocol}". Only http: and https: are allowed.`));
      return;
    }
    if (opts.maxRedirects < 0) {
      reject(new Error('Too many redirects'));
      return;
    }

    const remainingMs = opts.deadline - Date.now();
    if (remainingMs <= 0) {
      reject(new Error('Download timed out'));
      return;
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(parsed, { timeout: remainingMs }, response => {
      // Redirect
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        let redirectUrl;
        try {
          redirectUrl = new URL(response.headers.location, parsed).href;
        } catch {
          reject(new Error(`Invalid redirect location: ${response.headers.location}`));
          return;
        }
        streamDownload(redirectUrl, filePath, { ...opts, maxRedirects: opts.maxRedirects - 1 }).then(resolve, reject);
        return;
      }

      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode ?? '(no status)'}`));
        return;
      }

      const contentLength = response.headers['content-length'] ? Number(response.headers['content-length']) : undefined;
      if (contentLength !== undefined && Number.isFinite(contentLength) && contentLength > opts.maxBytes) {
        response.destroy();
        reject(new Error(`Content-Length ${contentLength} exceeds the ${opts.maxBytes}-byte size cap`));
        return;
      }

      const file = fs.createWriteStream(filePath);
      let bytes = 0;
      let settled = false;

      const fail = err => {
        if (settled) return;
        settled = true;
        response.destroy();
        file.close(() => reject(err));
      };

      response.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > opts.maxBytes) {
          fail(new Error(`Download exceeded the ${opts.maxBytes}-byte size cap (streamed ${bytes} bytes so far)`));
          return;
        }
        if (Date.now() > opts.deadline)
          fail(new Error('Download timed out'));
      });

      response.on('error', fail);

      response.pipe(file);

      file.on('finish', () => {
        if (settled) return;
        settled = true;
        file.close(() => resolve({ bytes, contentType: response.headers['content-type'] }));
      });

      file.on('error', fail);
    });

    req.on('timeout', () => {
      req.destroy(new Error('Download timed out'));
    });
    req.on('error', reject);
  });
}

/**
 * @param {{ url?: string, path?: string, maxBytes?: number, timeoutMs?: number }} params
 * @param {{ outputDir?: string, allowUnrestrictedFileAccess?: boolean }} [config]
 */
async function handleFileDownload(params, config) {
  const url = params && params.url;
  if (!url || typeof url !== 'string')
    return errorResult('Missing required parameter "url".');

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return errorResult(`Invalid URL: ${url}`);
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:')
    return errorResult(`Unsupported protocol "${parsedUrl.protocol}". Only http: and https: URLs are supported.`);

  const baseDir = resolveOutputDir(config);
  const unrestricted = unrestrictedFileAccessAllowed(config);
  const requestedPath = (params && params.path) || deriveFilenameFromUrl(parsedUrl);

  const confined = confine(requestedPath, baseDir, unrestricted);
  if (!confined.ok)
    return errorResult(confined.reason);
  const targetPath = confined.resolved;

  const maxBytes = Number.isFinite(params && params.maxBytes) && params.maxBytes > 0 ? params.maxBytes : DEFAULT_MAX_BYTES;
  const timeoutMs = Number.isFinite(params && params.timeoutMs) && params.timeoutMs > 0 ? params.timeoutMs : DEFAULT_TIMEOUT_MS;

  try {
    ensureParentDir(targetPath);
  } catch (e) {
    return errorResult(`Could not create parent directory for ${targetPath}: ${e.message}`);
  }

  try {
    const { bytes, contentType } = await streamDownload(url, targetPath, {
      maxBytes,
      timeoutMs,
      maxRedirects: DEFAULT_MAX_REDIRECTS,
      deadline: Date.now() + timeoutMs,
    });
    return successResult(targetPath, bytes, contentType);
  } catch (e) {
    try {
      if (fs.existsSync(targetPath))
        fs.unlinkSync(targetPath);
    } catch {
      // Best-effort cleanup only.
    }
    return errorResult(`Failed to download: ${e.message}`);
  }
}

module.exports = {
  fileDownloadToolDefinition,
  handleFileDownload,
  DEFAULT_MAX_BYTES,
  DEFAULT_TIMEOUT_MS,
};
