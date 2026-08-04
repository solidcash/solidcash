import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';

const PREFIX = 'pragma solidcash >=0.8.0; contract C() { int x;';
const HELPER_BODY = 'this.x = ((this.x + n) * 3 - n) / 2;';

describe('Release 1 scalar journal lowering', () => {
  it('marks a physical wrapper with only transitive scalar writes as state-writing', () => {
    const artifact = compileString(`${PREFIX}
      function add(int n) internal { this.x = this.x + n; }
      function run(int a, int b) { add(a); add(b); require(a >= 0); }
    }`, { forceStateful: true });

    const run = artifact.abi.find((entry) => entry.name === 'run');
    expect(run?.writesState).toBe(true);
    expect(run?.requiredNftIndices).toEqual([0]);
  });

  it('emits a multi-site scalar helper smaller than duplicating its body', () => {
    const journalized = compileString(`${PREFIX}
      function update(int n) internal { ${HELPER_BODY} }
      function run(int a, int b, int c) {
        update(a); update(b); update(c); require(a >= 0);
      }
    }`, { forceStateful: true });

    const duplicated = compileString(`${PREFIX}
      function run(int a, int b, int c) {
        int n = a; ${HELPER_BODY}
        n = b; ${HELPER_BODY}
        n = c; ${HELPER_BODY}
        require(a >= 0);
      }
    }`, { forceStateful: true });

    const journalizedBytes = journalized.debug.bytecode.length / 2;
    const duplicatedBytes = duplicated.debug.bytecode.length / 2;
    expect(journalizedBytes).toBeLessThan(duplicatedBytes);
  });

  it('marks direct and mutual recursive entry closures for concrete SDK preflight', () => {
    const direct = compileString(`${PREFIX}
      function run(int n) { this.x = this.x + 1; if (n > 0) run(n - 1); require(n >= 0); }
    }`, { forceStateful: true });
    expect(direct.abi.find((entry) => entry.name === 'run')?.recursiveStateHandler).toBe(true);

    const mutual = compileString(`${PREFIX}
      function a(int n) internal { this.x = this.x + 1; if (n > 0) b(n - 1); }
      function b(int n) internal { this.x = this.x + 1; if (n > 0) a(n - 1); }
      function run(int n) { a(n); require(n >= 0); }
      function flat() { this.x = this.x + 1; require(this.x > 0); }
    }`, { forceStateful: true });
    expect(mutual.abi.find((entry) => entry.name === 'run')?.recursiveStateHandler).toBe(true);
    expect(mutual.abi.find((entry) => entry.name === 'flat')?.recursiveStateHandler).toBeUndefined();
  });

  it('keeps an external-call scalar helper on the established inline path', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface ICounter { function increment(); }
      contract ExternalScalar(bytes32 target) {
        int x;
        function update() internal {
          ICounter(target).increment.call();
          this.x = this.x + 1;
        }
        function run() { update(); require(this.x > 0); }
      }
    `, { forceStateful: true });

    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'update')).toBeUndefined();
    expect(artifact.abi.find((entry) => entry.name === 'run')?.externalCalls).toHaveLength(1);
  });

  it('keeps transitive cast-form external calls on the established inline path', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface ICounter { function increment(); }
      contract ExternalScalar(bytes32 target) {
        int x;
        function invoke() internal { ICounter(target).increment.call(); }
        function update() internal { invoke(); this.x = this.x + 1; }
        function run() { update(); require(this.x > 0); }
      }
    `, { forceStateful: true });

    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'update')).toBeUndefined();
    expect(artifact.abi.find((entry) => entry.name === 'run')?.externalCalls).toHaveLength(1);
  });

  it('keeps a deploying scalar helper on the physical entry path', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Child { int x; constructor(int value) { x = value; } }
      contract Factory {
        int count;
        function create(int value) internal { Child child = new Child(value); this.count = this.count + 1; }
        function run(int value) { create(value); require(this.count > 0); }
      }
    `, { forceStateful: true });

    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'create')).toBeUndefined();
    expect(artifact.abi.find((entry) => entry.name === 'run')?.modifiers).toContain('deploy');
  });

  // X118 RENAMED THIS REFUSAL. The SUBJECT is unchanged - this shape must still fail closed - and the assertion
  // is strengthened rather than relaxed: the class name and the presence of a position are asserted too, because
  // the whole point of the rename was that a bare internal `Error` reached users with no name, position or
  // remedy. Pinned in full by DiagnosticResidueX118X119X120.test.ts.
  it('rejects an event-bearing returning state helper that cannot be inlined', () => {
    const source = `pragma solidcash >=0.8.0;
      contract EventReturn() {
        int x;
        event Changed(int value);
        function update(int n) internal returns (int) {
          this.x = this.x + n;
          emit Changed(this.x);
          if (n > 0) { return this.x; }
          return 0;
        }
        function run(int n) {
          int result = update(n);
          require(result >= 0);
        }
      }
    `;
    expect(() => compileString(source, { forceStateful: true })).toThrow(
      /Helper 'update' emits an event and is invoked internally as a value-returning subroutine/,
    );
    let raised: Error | undefined;
    try { compileString(source, { forceStateful: true }); } catch (error) { raised = error as Error; }
    expect(raised?.name).toBe('EmittingStateHelperEventError');
    expect(raised?.message).toMatch(/at Line \d+, Column \d+/);
  });

  it('rejects a returning emit helper (no direct state write) invoked from a journal handler', () => {
    // Regression for J5: a returning helper that emits but does not itself write state survives as an
    // OP_INVOKE subroutine (void emit helpers are force-inlined; returning ones are not) and its event
    // was silently dropped at the subroutine epilogue. It must now fail closed instead.
    const source = `pragma solidcash >=0.8.0;
      contract EmitReturn() {
        int x;
        event Changed(int value);
        function log(int v) internal returns (int) {
          emit Changed(v);
          return v + 1;
        }
        function bump(int n) internal returns (int) {
          this.x = this.x + n;
          int tag = log(n);
          if (n > 0) { return tag; }
          return 0;
        }
        function run(int n) {
          int result = bump(n);
          require(result >= 0);
        }
      }
    `;
    // X118 rename, same reasoning as above.
    expect(() => compileString(source, { forceStateful: true })).toThrow(
      /Helper 'log' emits an event and is invoked internally as a value-returning subroutine/,
    );
    let raised: Error | undefined;
    try { compileString(source, { forceStateful: true }); } catch (error) { raised = error as Error; }
    expect(raised?.name).toBe('EmittingStateHelperEventError');
    // DISCRIMINATING: `log` is DECLARED returning and writes no state, so the collection-journal clause must be
    // ABSENT here while the `update` case above (void as written, made returning by the journal) carries it.
    // Without this the message could claim a cause that is not the cause.
    expect(raised?.message).not.toContain('it is void as written');
  });
});
