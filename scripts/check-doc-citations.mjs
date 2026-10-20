#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
// Fail when a tracked text file cites a repository Markdown path that does not exist on master or archive/docs.
// Relative Markdown links are checked separately by the documentation link check.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const ROOTS = ['docs', 'packages', 'bench', 'examples', 'research', 'scripts'];
const TEXT_EXTENSIONS = ['.md', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.sh', '.yml', '.yaml'];
const SKIP_PREFIXES = ['website/', 'packages/solidc/docs/archive/'];
const CITATION = new RegExp(
  `(?<![\\w/:-])((?:${ROOTS.join('|')})/[\\w./-]+\\.md)`,
  'g',
);

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function archivedPaths() {
  try {
    return new Set(git(['ls-tree', '-r', '--name-only', 'archive/docs']).split('\n').filter(Boolean));
  } catch {
    return new Set();
  }
}

const archived = archivedPaths();
const trackedMarkdown = git(['ls-files', '*.md']).split('\n').filter(Boolean);
const markdownByBasename = new Map();
for (const path of [...trackedMarkdown, ...archived]) {
  const basename = path.slice(path.lastIndexOf('/') + 1);
  if (!markdownByBasename.has(basename)) markdownByBasename.set(basename, []);
  markdownByBasename.get(basename).push(path);
}

function resolves(cited) {
  const candidates = [cited];
  // Compiler feature docs are commonly cited as `docs/<name>` from inside packages/solidc.
  if (cited.startsWith('docs/')) candidates.push(`packages/solidc/${cited}`);
  if (candidates.some((candidate) => existsSync(candidate) || archived.has(candidate))) return true;
  // Accept the shorthand when the same document exists elsewhere under a docs/ directory.
  const basename = cited.slice(cited.lastIndexOf('/') + 1);
  return (markdownByBasename.get(basename) ?? []).some((path) => path.includes('/docs/'));
}

const files = git(['ls-files', '-z']).split('\0').filter(Boolean);
const problems = [];

for (const file of files) {
  if (SKIP_PREFIXES.some((prefix) => file.startsWith(prefix))) continue;
  if (!TEXT_EXTENSIONS.some((extension) => file.endsWith(extension))) continue;
  if (!existsSync(file)) continue;

  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const match of line.matchAll(CITATION)) {
      const cited = match[1];
      if (cited.includes('*') || cited.includes('<') || cited.includes('>')) continue;
      if (resolves(cited)) continue;
      problems.push(`${file}:${index + 1}: ${cited}`);
    }
  });
}

if (problems.length > 0) {
  console.error('Citations to missing Markdown documents:');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('Use archive/docs:<path> for a document that exists only on the archive branch.');
  process.exit(1);
}

console.log('Documentation citations resolve on master or archive/docs.');
