import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classifyHiddenBatchRejection } from '../src/compiler.js';
import { compileString } from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const spec = readFileSync(resolve(root, 'docs/invocation-transcript-v1.md'), 'utf8');
const compiler = readFileSync(resolve(root, 'src/compiler.ts'), 'utf8');

const MATRIX = [
  ['this.activeBytecode', 'direct-versus-batch-introspection-divergence', 'SCB_STACK_CONTEXT_UNPRESERVABLE'],
  ['lifecycle/upgrade/selfdestruct/split/merge', 'lifecycle-or-unsafe-handler', 'SCB_UNSUPPORTED_CONSTRUCT'],
  ['unsafe', 'lifecycle-or-unsafe-handler', 'SCB_UNSUPPORTED_CONSTRUCT'],
  ['opaque assembly call/state effects', 'opaque-assembly-effects-transcript-ineligible', 'SCB_EFFECT_UNSUMMARIZABLE'],
  ['arbitrary foreign `try/catch`', 'foreign-try-catch-transcript-ineligible', 'SCB_UNSUPPORTED_CONSTRUCT'],
  ['loops', 'unbounded-external-call-loop-transcript-ineligible', 'SCB_UNSUPPORTED_CONSTRUCT'],
  ['staticcall', 'has non-static descendant', 'SCB_UNSUPPORTED_CONSTRUCT'],
] as const;

describe('invocation-transcript-v1 section 8 ineligibility matrix', () => {
  it('has one non-empty enforcement row for every normative exclusion class', () => {
    expect(MATRIX).toHaveLength(7);
    expect(new Set(MATRIX.map(([construct]) => construct)).size).toBe(MATRIX.length);
    for (const [construct, reason, code] of MATRIX) {
      expect(spec, `section 8 lost '${construct}'`).toContain(construct);
      expect(reason.length, `${construct} has no exact rejection`).toBeGreaterThan(0);
      expect(code.length, `${construct} has no structured rejection class`).toBeGreaterThan(0);
    }
  });

  it('pins compiler-owned exclusions to exact reasons and structured classes', () => {
    for (const [, reason, code] of MATRIX.slice(0, 5)) {
      expect(compiler, `compiler does not publish '${reason}'`).toContain(`'${reason}'`);
      expect(classifyHiddenBatchRejection(reason)).toBe(code);
    }
  });

  it('pins SDK-owned boundedness and staticcall descendant diagnostics verbatim', () => {
    const graph = readFileSync(resolve(root, '../solidcash/src/layer3/graph.ts'), 'utf8');
    expect(graph).toContain('has non-static descendant');
  });

  it('rejects active bytecode with the exact matrix diagnostic', () => {
    const artifact = compileString(`contract C() {
      function bound(bytes expected) public { require(this.activeBytecode == expected); }
      function control() public { require(true); }
    }`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch!.handlers.find((handler) => handler.name === 'bound')).toMatchObject({
      eligible: false,
      rejectionReason: 'direct-versus-batch-introspection-divergence',
      rejectionCode: 'SCB_STACK_CONTEXT_UNPRESERVABLE',
    });
  });

  it.each([
    ['upgrade', 'function denied() upgrade { require(true); }'],
    ['selfdestruct', 'function denied() selfdestruct { require(true); }'],
    ['split', 'function denied(int n) split(n) { require(n >= 1); }'],
    ['merge', 'function denied(int n) merge(n) { require(n >= 1); }'],
    ['unsafe tier 0', 'function denied() unsafe { require(true); }'],
    ['unsafe tier 1', 'function denied() unsafe(1) { require(true); }'],
    ['unsafe tier 2', 'function denied() unsafe(2) { require(true); }'],
  ])('rejects %s with the exact matrix diagnostic', (_label, denied) => {
    const artifact = compileString(`contract C() {
      int value;
      ${denied}
      function control() public { require(true); }
    }`, {
      forceStateful: true,
      experimentalHiddenBatch: true,
    });
    expect(artifact.hiddenBatch!.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'lifecycle-or-unsafe-handler',
      rejectionCode: 'SCB_UNSUPPORTED_CONSTRUCT',
    });
  });

  it('rejects arbitrary foreign try/catch before publishing its handler selector', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface IPeer { function ping(); }
      contract C(address peer) {
        function guarded() public {
          try IPeer(peer).ping() { require(true); } catch { require(false); }
          require(true);
        }
        function control() public { require(true); }
      }`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch!.handlers.find((handler) => handler.name === 'guarded')).toMatchObject({
      eligible: false,
      rejectionReason: 'foreign-try-catch-transcript-ineligible',
      rejectionCode: 'SCB_UNSUPPORTED_CONSTRUCT',
    });
    expect(artifact.hiddenBatch!.handlers.filter((handler) => handler.eligible).map((handler) => handler.name))
      .toEqual(['control']);
  });

  it('rejects opaque native assembly effects with the matrix diagnostic', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract C() {
        function opaque() public { assembly { OP_1 OP_DROP } require(true); }
        function control() public { require(true); }
      }`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch!.handlers.find((handler) => handler.name === 'opaque')).toMatchObject({
      eligible: false,
      rejectionReason: 'opaque-assembly-effects-transcript-ineligible',
      rejectionCode: 'SCB_EFFECT_UNSUMMARIZABLE',
    });
    expect(artifact.hiddenBatch!.handlers.filter((handler) => handler.eligible).map((handler) => handler.name))
      .toEqual(['control']);
  });
});
