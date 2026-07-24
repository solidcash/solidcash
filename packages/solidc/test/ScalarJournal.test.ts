import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

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

  it('rejects an event-bearing returning state helper that cannot be inlined', () => {
    expect(() => compileString(`pragma solidcash >=0.8.0;
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
    `, { forceStateful: true })).toThrow(
      /Returning state helper 'update' with an event must be inlined/,
    );
  });
});
