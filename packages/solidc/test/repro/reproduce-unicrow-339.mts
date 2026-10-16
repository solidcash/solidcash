/**
 * Reproduction of criterion 5's July-2026 Unicrow `refund` size figure (5683 -> 5344, -339 B).
 *
 * The number was measured before block-layout-v2 and the later codegen shrunk the handler baseline ~3x, so it is
 * not reproducible on the current tree. This script pins the exact inputs that produced it:
 *   - compiler: f74707345 (the commit that recorded the figure, before block-layout-v2),
 *   - corpus:   the EffectiveAcceleration checkout (Unicrow.sol last changed 2024-11-26, commit 868d525),
 *   - pass:     the July-shaped ReuseEntryLocalForWriteback port in ReuseEntryLocalForWritebackJuly.ts.txt
 *               (un-coalesced write-back run only; the kernel's early folded __mefw coalesce did not exist yet).
 *
 * It builds the pinned compiler in a cached throwaway worktree, compiles the corpus Unicrow twice (pass on / off),
 * and prints `5683 -> 5344` with the -339 B delta. Run manually with `npx tsx`; the corpus-gated test
 * ReuseEntryLocalForWritebackUnicrowRepro.test.ts re-runs this script.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const JULY_COMPILER = 'f7470734562777e897eca2f6030ed16764b123d8';
const CORPUS = '/Code/effectiveacceleration.ai/contract/contracts/unicrow/Unicrow.sol';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const WORKTREE = path.join(os.tmpdir(), `solidcash-unicrow-339-${JULY_COMPILER.slice(0, 10)}`);
const PASS_SOURCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ReuseEntryLocalForWritebackJuly.ts.txt');

function run(cmd: string, cwd: string): void {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function readBodyBytes(source: string, reuseEnabled: boolean): number {
  const env = reuseEnabled ? {} : { REUSE_ENTRY_LOCAL: '0' };
  const measure = path.join(WORKTREE, 'measure.mts');
  fs.writeFileSync(measure, `
import { compileFileMulti } from './packages/solidc/src/compileFile.js';
const source = ${JSON.stringify(source)};
const options = { solidityImportCompat: true, evmCompat: false, suppressWarnings: true, __artifactCache: false };
const withPass = compileFileMulti(source, options);
const un = withPass['Unicrow'] ?? withPass['Unicrow.sol'];
const refund = un?.abi?.find((e) => e.name === 'refund');
const body = un?.functionBodies?.[refund?.selector];
if (!body) throw new Error('refund body missing');
console.log('REPRO_BYTES ' + (body.length / 2));
`);
  const out = execSync(`npx tsx measure.mts`, {
    cwd: WORKTREE,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf-8',
  });
  const match = out.match(/REPRO_BYTES (\d+)/);
  if (!match) throw new Error(`no repro bytes in output: ${out}`);
  return Number(match[1]);
}

export function reproduceUnicrow339(): { without: number; withPass: number; delta: number } {
  if (!fs.existsSync(CORPUS)) throw new Error(`corpus missing: ${CORPUS}`);

  // Prepare (or reuse) the pinned compiler worktree.
  const already = fs.existsSync(path.join(WORKTREE, 'packages', 'solidc', 'src'));
  if (!already) {
    fs.mkdirSync(path.dirname(WORKTREE), { recursive: true });
    run(`git worktree add -f ${WORKTREE} ${JULY_COMPILER}`, REPO_ROOT);
    fs.copyFileSync(PASS_SOURCE, path.join(WORKTREE, 'packages/solidc/src/semantic/ReuseEntryLocalForWriteback.ts'));
    const compilerTs = path.join(WORKTREE, 'packages/solidc/src/compiler.ts');
    let src = fs.readFileSync(compilerTs, 'utf-8');
    src = src.replace(
      "import CoalesceMappingEntryFieldWrites from './semantic/CoalesceMappingEntryFieldWrites.js';",
      "import CoalesceMappingEntryFieldWrites from './semantic/CoalesceMappingEntryFieldWrites.js';\n"
        + "import ReuseEntryLocalForWriteback from './semantic/ReuseEntryLocalForWriteback.js';",
    );
    src = src.replace(
      '  ast = ast.accept(new CoalesceMappingEntryFieldWrites()) as Ast;',
      '  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.REUSE_ENTRY_LOCAL !== \'0\') {\n'
        + '    ast = ast.accept(new ReuseEntryLocalForWriteback()) as Ast;\n'
        + '  }\n'
        + '  ast = ast.accept(new CoalesceMappingEntryFieldWrites()) as Ast;',
    );
    if (!src.includes('new ReuseEntryLocalForWriteback()')) throw new Error('compiler patch did not apply');
    fs.writeFileSync(compilerTs, src);
  }

  const installed = fs.existsSync(path.join(WORKTREE, 'node_modules'));
  if (!installed) run('yarn install --ignore-scripts', WORKTREE);
  run('yarn build', WORKTREE);

  const without = readBodyBytes(CORPUS, false);
  const withPass = readBodyBytes(CORPUS, true);
  return { without, withPass, delta: without - withPass };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = reproduceUnicrow339();
  console.log(`Unicrow refund handler body: ${r.without} -> ${r.withPass} bytes (delta ${r.delta} B)`);
}
