/**
 * Release gate: every self-contained SolidCash snippet in the public docs must still compile.
 *
 * RELEASE_READINESS asks that "public website examples compile against the exact release packages". The
 * `examples` script only covers three hand-written files at the repo root, so the 250-odd fenced blocks under
 * `website/docs` were ungated - they are the first thing a new user copies, and nothing noticed when a language
 * change made one of them stale.
 *
 * SCOPE, deliberately narrow so the gate stays trustworthy rather than noisy:
 *  - Only fenced `solidity` / `scash` / `sol` blocks are considered.
 *  - Only blocks that DECLARE a `contract`, `library` or `interface` are compiled. The rest are fragments
 *    (a single function, a type, a few statements) that were never meant to stand alone, and compiling them
 *    would report failures that say nothing about the docs being correct.
 *  - Blocks that `import` are counted and skipped, not failed: they resolve against files the docs do not ship,
 *    so a bare `compileString` cannot see them. Skipping is reported so the number is visible rather than
 *    silently absorbed.
 *
 * Run: npx tsx scripts/release-docs-snippets.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileString } from '../packages/solidc/src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(here, '../website/docs');

const markdownFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...markdownFiles(p));
    else if (/\.mdx?$/.test(entry.name)) out.push(p);
  }
  return out;
};

interface Failure { file: string; line: number; reason: string }

const files = markdownFiles(DOCS);
let blocks = 0;
let standalone = 0;
let compiled = 0;
let skippedImports = 0;
const failures: Failure[] = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const fence = /```(?:solidity|scash|sol)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(source)) !== null) {
    blocks += 1;
    const code = match[1];
    if (!/\b(?:contract|library|interface)\s+\w+/.test(code)) continue;
    standalone += 1;
    if (/^\s*import\s/m.test(code)) { skippedImports += 1; continue; }
    const line = source.slice(0, match.index).split('\n').length;
    try {
      compileString(code);
      compiled += 1;
    } catch (error) {
      failures.push({
        file: path.relative(path.resolve(here, '..'), file),
        line,
        reason: String((error as Error).message).split('\n')[0].slice(0, 160),
      });
    }
  }
}

console.log(
  `docs snippets: ${files.length} files, ${blocks} blocks, ${standalone} standalone, `
  + `${compiled} compiled, ${skippedImports} skipped (import a file the docs do not ship), `
  + `${failures.length} failed`,
);
if (failures.length > 0) {
  console.error('\nSnippets that no longer compile:');
  for (const f of failures) console.error(`  ${f.file}:${f.line}  ${f.reason}`);
  process.exit(1);
}
