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
});
