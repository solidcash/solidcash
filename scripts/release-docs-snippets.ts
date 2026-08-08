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
import { spawnSync } from 'child_process';
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

/**
 * The TypeScript half: every name the docs import from OUR packages must still be exported.
 *
 * Type-checking the 262 TS blocks outright is not worth it - most are fragments that reference variables defined
 * in prose around them, so the failures would be about the harness rather than the docs. What DOES rot, and what
 * a reader hits immediately, is an import of a name the SDK renamed or dropped. That is checked exactly here by
 * emitting one probe file that imports every documented name and handing it to `tsc`.
 *
 * `tsc` rather than a runtime `name in module` check, which was tried first and is WRONG: an interface has no
 * runtime presence, so every type-only export reads as missing. It reported `WcTransactionObject` as dropped
 * when `index.ts` re-exports it perfectly well through `export * from './walletconnect-utils.js'`.
 */
const OWN_PACKAGES = new Set(['solidcash', 'solidc', '@solidcash/utils']);
const documentedNames = new Map<string, Set<string>>();
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const fence = /```(?:ts|typescript|js|javascript)\n([\s\S]*?)```/g;
  let block: RegExpExecArray | null;
  while ((block = fence.exec(source)) !== null) {
    const imports = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
    let imported: RegExpExecArray | null;
    while ((imported = imports.exec(block[1])) !== null) {
      const pkg = imported[2];
      if (!OWN_PACKAGES.has(pkg)) continue;
      if (!documentedNames.has(pkg)) documentedNames.set(pkg, new Set());
      for (const raw of imported[1].split(',')) {
        const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
        if (name) documentedNames.get(pkg)!.add(name);
      }
    }
  }
}

const probeDir = path.resolve(here, '../.docscheck');
const probeFile = path.join(probeDir, 'documented-imports.ts');
// Plain value imports, and deliberately UNREFERENCED. `tsc` reports a missing export (TS2305) whether or not
// the name is used, while referencing them would force a choice between type and value position - and the
// documented names are a mix, so either choice errors on half of them for reasons that are not doc rot.
const lines = [...documentedNames.entries()]
  .map(([pkg, names]) => `import { ${[...names].sort().join(', ')} } from '${pkg}';`);
const referenced = [...documentedNames.values()].flatMap((set) => [...set]);
fs.mkdirSync(probeDir, { recursive: true });
fs.writeFileSync(probeFile, `${lines.join('\n')}\n`);

const total = referenced.length;
const tsc = spawnSync(
  'npx',
  ['tsc', '--noEmit', '--skipLibCheck', '--module', 'nodenext', '--moduleResolution', 'nodenext', probeFile],
  { cwd: path.resolve(here, '..'), encoding: 'utf8' },
);
fs.rmSync(probeDir, { recursive: true, force: true });

const tscOutput = `${tsc.stdout ?? ''}${tsc.stderr ?? ''}`.trim();
console.log(`documented SDK imports: ${total} names across ${documentedNames.size} packages, `
  + `${tsc.status === 0 ? 'all resolve' : 'UNRESOLVED'}`);
if (tsc.status !== 0) {
  console.error('\nNames the docs import that the packages no longer export:');
  console.error(tscOutput);
  process.exit(1);
}
