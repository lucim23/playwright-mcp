/**
 * Regression test for issue #12: the npm tarball (which is also what
 * `npx github:lucim23/playwright-mcp` installs — git installs go through the
 * same pack rules) must contain every enhanced/ runtime file, and the bin map
 * must satisfy npx's default-executable rule so a bare
 * `npx github:lucim23/playwright-mcp` keeps working.
 *
 * npx picks a default bin as follows (npm libnpmexec get-bin-from-manifest):
 * a single bin (or all bin entries pointing at one file) is used as-is;
 * otherwise there must be a bin named after the package's unscoped name
 * ("mcp" for @playwright/mcp).
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);

let failures = 0;
function check(name, ok, detail) {
  if (ok) {
    console.log(`PASS - ${name}`);
  } else {
    failures++;
    console.log(`FAIL - ${name}${detail ? `: ${detail}` : ''}`);
  }
}

// --- bin resolution rule ---
const pkg = require(path.join(root, 'package.json'));
const bin = pkg.bin || {};
const unscopedName = pkg.name.replace(/^@[^/]+\//, '');
const distinctTargets = new Set(Object.values(bin));
const npxResolvable = distinctTargets.size === 1 || Object.hasOwn(bin, unscopedName);
check(
  `bare npx can resolve a default executable (bin["${unscopedName}"] or single target)`,
  npxResolvable,
  `bins: ${JSON.stringify(bin)}`
);
if (Object.hasOwn(bin, unscopedName)) {
  check(
    `default bin "${unscopedName}" points at the enhanced CLI`,
    bin[unscopedName] === 'enhanced/cli.js',
    `points at ${bin[unscopedName]}`
  );
}

// --- tarball contents ---
const packOutput = JSON.parse(
  execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: root, encoding: 'utf-8' })
);
const files = new Set(packOutput[0].files.map(f => f.path));

const requiredFiles = [
  'cli.js',
  'index.js',
  'index.d.ts',
  'config.d.ts',
  'enhanced/cli.js',
  'enhanced/index.js',
  'enhanced/tools/browserSession.js',
  'enhanced/tools/enhancer.js',
  'enhanced/tools/fileDownload.js',
  'enhanced/tools/schemas.js',
  'enhanced/utils/config.js',
  'enhanced/utils/confirmation.js',
  'enhanced/utils/filter.js',
  'enhanced/utils/handlers.js',
  'enhanced/utils/meta.js',
  'enhanced/utils/outputDir.js',
  'enhanced/utils/sessions.js',
  'enhanced/utils/snapshotFile.js',
  'enhanced/utils/summary.js',
  'enhanced/utils/truncate.js',
  'package.json',
];
for (const f of requiredFiles)
  check(`tarball contains ${f}`, files.has(f));

check(
  'tarball excludes enhanced/tests/',
  ![...files].some(f => f.startsWith('enhanced/tests/')),
  `found: ${[...files].filter(f => f.startsWith('enhanced/tests/')).join(', ')}`
);

// Every bin target must be inside the tarball, or installs break outright.
for (const [name, target] of Object.entries(bin))
  check(`bin "${name}" target ${target} is packed`, files.has(target));

console.log(`\n${requiredFiles.length + Object.keys(bin).length + 3 - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
