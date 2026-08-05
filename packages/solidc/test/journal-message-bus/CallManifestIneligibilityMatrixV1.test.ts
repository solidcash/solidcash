import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classifyMessageBusRejection } from '../../src/compiler.js';
import { compileString } from '../../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const compiler = readFileSync(resolve(root, 'src/compiler.ts'), 'utf8');

const MATRIX = [
  ['this.activeBytecode', 'direct-versus-batch-introspection-divergence', 'MESSAGE_BUS_STACK_CONTEXT_UNPRESERVABLE'],
  ['lifecycle/upgrade/selfdestruct/split/merge', 'lifecycle-or-unsafe-handler', 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT'],
  ['unsafe', 'lifecycle-or-unsafe-handler', 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT'],
  ['opaque assembly call/state effects', 'opaque-assembly-effects-callManifest-ineligible', 'MESSAGE_BUS_EFFECT_UNSUMMARIZABLE'],
  ['arbitrary foreign `try/catch`', 'foreign-try-catch-callManifest-ineligible', 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT'],
  ['loops', 'unbounded-external-call-loop-callManifest-ineligible', 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT'],
  ['staticcall', 'has non-static descendant', 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT'],
] as const;

describe('atomic route ineligibility matrix', () => {
  it('pins compiler-owned exclusions to exact reasons and structured classes', () => {
    for (const [, reason, code] of MATRIX.slice(0, 5)) {
      expect(compiler, `compiler does not publish '${reason}'`).toContain(`'${reason}'`);
      expect(classifyMessageBusRejection(reason)).toBe(code);
    }
  });

  it('pins SDK-owned boundedness and staticcall descendant diagnostics verbatim', () => {
    const graph = readFileSync(resolve(root, '../solidcash/src/message-bus/graph.ts'), 'utf8');
    expect(graph).toContain('has non-static descendant');
  });

  it('rejects active bytecode with the exact matrix diagnostic', () => {
    const artifact = compileString(`contract C() {
      function bound(bytes expected) public { require(this.activeBytecode == expected); }
      function control() public { require(true); }
    }`, { forceStateful: true, messageBus: true });
    expect(artifact.messageBus!.handlers.find((handler) => handler.name === 'bound')).toMatchObject({
      eligible: false,
      rejectionReason: 'direct-versus-batch-introspection-divergence',
      rejectionCode: 'MESSAGE_BUS_STACK_CONTEXT_UNPRESERVABLE',
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
      messageBus: true,
    });
    expect(artifact.messageBus!.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'lifecycle-or-unsafe-handler',
      rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
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
      }`, { forceStateful: true, messageBus: true });
    expect(artifact.messageBus!.handlers.find((handler) => handler.name === 'guarded')).toMatchObject({
      eligible: false,
      rejectionReason: 'foreign-try-catch-callManifest-ineligible',
      rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
    });
    expect(artifact.messageBus!.handlers.filter((handler) => handler.eligible).map((handler) => handler.name))
      .toEqual(['control']);
  });

  it('rejects opaque native assembly effects with the matrix diagnostic', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract C() {
        function opaque() public { assembly { OP_1 OP_DROP } require(true); }
        function control() public { require(true); }
      }`, { forceStateful: true, messageBus: true });
    expect(artifact.messageBus!.handlers.find((handler) => handler.name === 'opaque')).toMatchObject({
      eligible: false,
      rejectionReason: 'opaque-assembly-effects-callManifest-ineligible',
      rejectionCode: 'MESSAGE_BUS_EFFECT_UNSUMMARIZABLE',
    });
    expect(artifact.messageBus!.handlers.filter((handler) => handler.eligible).map((handler) => handler.name))
      .toEqual(['control']);
  });

  it('rejects a returning dynamic-array resize before generated-route lowering', () => {
    const artifact = compileString(`contract C() {
      int[] values;
      function resize(int value) public returns (int) {
        this.values.push(value);
        return this.values.length;
      }
      function control() public { require(true); }
    }`, { forceStateful: true, messageBus: true });
    expect(artifact.messageBus!.handlers.find((handler) => handler.name === 'resize')).toMatchObject({
      eligible: false,
      rejectionReason: 'result-route-requires-effect-free-handlers',
    });
    expect(artifact.messageBus!.handlers.filter((handler) => handler.eligible).map((handler) => handler.name))
      .toEqual(['control']);
  });

  it('does not publish a synthetic collection getter as an eligible message-bus handler', () => {
    const artifact = compileString(`contract C() {
      int[] public values;
      function control() public { require(true); }
    }`, { forceStateful: true, messageBus: true, solidityImportCompat: true });
    expect(artifact.abi.some((entry) => entry.name === 'values')).toBe(true);
    expect(artifact.messageBus!.handlers.find((handler) => handler.name === 'values')).toMatchObject({
      eligible: false,
      rejectionReason: 'collection-state-getter-route-not-enabled',
    });
    expect(artifact.messageBus!.handlers.filter((handler) => handler.eligible).map((handler) => handler.name))
      .toEqual(['control']);
  });

  it('keeps nested dynamic-array state handlers on their direct route', () => {
    const artifact = compileString(`contract C() {
      int[][] values;
      function read(int row, int column) public returns (int) {
        return this.values[row][column];
      }
      function control() public { require(true); }
    }`, { forceStateful: true, messageBus: true });
    expect(artifact.messageBus!.handlers.find((handler) => handler.name === 'read')).toMatchObject({
      eligible: false,
      rejectionReason: 'nested-dynamic-array-route-not-enabled',
    });
    expect(artifact.messageBus!.handlers.filter((handler) => handler.eligible).map((handler) => handler.name))
      .toEqual(['control']);
  });

  it('refuses delegate context in an entry point with a positioned stable diagnostic', () => {
    const artifact = compileString(`contract C(address impl) {
      function denied(bytes input) public {
        impl.delegatecall(input);
        require(true);
      }
      function control() public { require(true); }
    }`, { forceStateful: true, messageBus: true });
    expect(artifact.messageBus!.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'atomic-delegate-context-unpreservable',
      rejectionCode: 'MESSAGE_BUS_STACK_CONTEXT_UNPRESERVABLE',
      rejectionContext: {
        functionName: 'denied',
        reason: 'atomic-delegate-context-unpreservable',
        sourceLocation: { line: expect.any(Number), column: expect.any(Number) },
      },
    });
    expect(artifact.messageBus!.handlers.filter((handler) => handler.eligible).map((handler) => handler.name))
      .toEqual(['control']);
  });

  it('refuses delegate context reached through an internal closure before synthetic arity lowering', () => {
    expect(() => compileString(`contract C(address impl) {
      function hop(bytes input) internal { impl.delegatecall(input); }
      function denied(bytes input) public { hop(input); require(true); }
      function control() public { require(true); }
    }`, { forceStateful: true, messageBus: true })).toThrowError(expect.objectContaining({
      code: 'MESSAGE_BUS_DELEGATE_CONTEXT_UNPRESERVABLE',
      context: {
        functionName: 'hop',
        sourceLocation: { line: expect.any(Number), column: expect.any(Number) },
      },
    }));
  }, 90_000);
});
