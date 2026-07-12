import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Regression: a `return` INSIDE a loop in an ENTRY-POINT (public/external) function generated a
// stack-imbalanced script (VM crash: "read from empty stack" / "OP_SPLIT invalid index"). It COMPILED, so the
// bench + compile-only tests never caught it. DesugarReturnInLoop (which rewrites in-loop returns to
// flag + break + post-loop return) SKIPPED entry points, deferring to a broken GTT "blob-stash" path. The
// internal/private case already worked; the fix routes entry points through the same working desugar.
// A common Solidity pattern (`for (...) { if (found) return x; } return def;`).
describe('return inside a loop in an entry-point function', () => {
  it('return in a for-loop (branch hit and not hit)', async () => {
    const sc: any = await getContractFactory(compileString(`contract C {
      function find(int n) public pure returns (int) {
        for (int i = 0; i < 10; i++) { if (i == n) { return i * 2; } }
        return 99;
      }
    }`, { forceStateful: true }), await fundedSigner()).deploy();
    await expect(sc.find(3n)).resolves.toBeDefined();  // hit: returns 6
    await expect(sc.find(100n)).resolves.toBeDefined(); // miss: returns 99
  });

  it('return in a while-loop', async () => {
    const sc: any = await getContractFactory(compileString(`contract C {
      function find(int n) public pure returns (int) {
        int i = 0;
        while (i < 10) { if (i == n) { return i; } i++; }
        return 99;
      }
    }`, { forceStateful: true }), await fundedSigner()).deploy();
    await expect(sc.find(4n)).resolves.toBeDefined();
  });

  it('return in a for-loop that also writes state, then reads it', async () => {
    const sc: any = await getContractFactory(compileString(`contract C {
      int public count;
      function run(int n) public returns (int) {
        count = 0;
        for (int i = 0; i < 10; i++) { count += 1; if (i == n) { return count; } }
        return count;
      }
    }`, { forceStateful: true }), await fundedSigner()).deploy();
    await sc.run(2n); expect((await sc.getState()).count).toBe(3n); // returns after 3 increments
  });

  it('return in a nested loop (breaks outward to the return)', async () => {
    const sc: any = await getContractFactory(compileString(`contract C {
      function find(int n) public pure returns (int) {
        for (int i = 0; i < 3; i++) {
          for (int j = 0; j < 3; j++) { if (i + j == n) { return i * 10 + j; } }
        }
        return 99;
      }
    }`, { forceStateful: true }), await fundedSigner()).deploy();
    await expect(sc.find(3n)).resolves.toBeDefined();
  });
});
