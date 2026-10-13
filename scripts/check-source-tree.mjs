import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const authored = new Set([
  'examples/common-js.js',
  'packages/solidcash/src/external-types/@psf/bch-js.d.ts',
  'packages/testing/src/ethers-subpaths.d.ts',
  'vscode-solidcash/src/docs.js',
  'vscode-solidcash/src/extension.js',
  'vscode-solidcash/src/resolver.js',
  'vscode-solidcash/src/scanner.js',
]);
const sourceAreas = ['packages', 'examples', 'bench', 'scripts', 'vscode-solidcash', 'website'];
const generated = (path) => /(?:\.js(?:\.map)?|\.d\.(?:ts|mts|cts)(?:\.map)?)$/.test(path)
  && !authored.has(path)
  && (sourceAreas.some((area) => path.startsWith(`${area}/`)) || !path.includes('/'));

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root })
  .toString().split('\0').filter(Boolean).filter(generated);
const emitted = [];
const visit = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (generated(relative(root, path).replaceAll('\\', '/'))) emitted.push(relative(root, path));
  }
};
for (const area of sourceAreas) visit(join(root, area));
for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && generated(entry.name)) emitted.push(entry.name);
}

const violations = [...new Set([...tracked, ...emitted])].sort();
if (violations.length) {
  console.error('Source-tree TypeScript outputs are forbidden; build into dist/ instead:');
  for (const path of violations) console.error(`  ${path}`);
  process.exitCode = 1;
} else {
  console.log('Source tree is free of generated JS, source maps, and declarations.');
}
