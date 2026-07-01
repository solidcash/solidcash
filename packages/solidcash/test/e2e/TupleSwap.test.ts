import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { deployStateful } from '../test-util.js';

// Tuple assignment to existing lvalues + swap. RHS is fully evaluated before any assignment, so swaps
// and self-references are clobber-safe. The contract requires the post-assignment values, so the spend
// only succeeds if the codegen (OP_SWAP fast-path / emitReplace fallback) is correct on the VM.
const SOURCE = `
contract TupleSwap() {
    // a and b are the top two stack vars -> single OP_SWAP.
    function swapTopTwo(int a, int b) {
        (a, b) = (b, a);
        require(a == 20);
        require(b == 10);
    }
    // a local sits above a and b -> general roll-based reposition.
    function swapDeep(int a, int b) {
        int c = a + b;
        (a, b) = (b, a);
        require(a == 20);
        require(b == 10);
        require(c == 30);
    }
    // 3-way rotate to existing lvalues.
    function rotate(int a, int b, int d) {
        (a, b, d) = (d, a, b);
        require(a == 3);
        require(b == 1);
        require(d == 2);
    }
    // Existing-lvalue assignment from arithmetic (RHS uses old values).
    function assignExisting(int a, int b) {
        (a, b) = (a + b, a - b);
        require(a == 30);
        require(b == 10);
    }
    // Existing-lvalue assignment from a tuple-returning expression (split).
    function fromSplit(bytes4 blob) {
        bytes lo = 0x00;
        bytes hi = 0x00;
        (lo, hi) = blob.split(2);
        require(lo == 0x1234);
        require(hi == 0x5678);
    }
}
`;

async function spend(fn: string, args: unknown[]): Promise<unknown> {
  const sc = await deployStateful(compileString(SOURCE, { forceStateful: true }));
  return sc.call[fn](...args); // thenable: the caller awaits, which sends
}

describe('tuple assignment to existing lvalues', () => {
  it('swaps the top two stack vars (OP_SWAP fast-path)', async () => {
    await expect(spend('swapTopTwo', [10n, 20n])).resolves.toBeDefined();
  });

  it('swaps vars below another local (roll-based fallback)', async () => {
    await expect(spend('swapDeep', [10n, 20n])).resolves.toBeDefined();
  });

  it('rotates three existing lvalues', async () => {
    await expect(spend('rotate', [1n, 2n, 3n])).resolves.toBeDefined();
  });

  it('assigns existing lvalues from arithmetic using old values', async () => {
    await expect(spend('assignExisting', [20n, 10n])).resolves.toBeDefined();
  });

  it('assigns existing lvalues from a split', async () => {
    await expect(spend('fromSplit', [Uint8Array.from([0x12, 0x34, 0x56, 0x78])])).resolves.toBeDefined();
  });
});

describe('tuple assignment rejects mixed slots', () => {
  it('rejects mixing a declaration with an existing variable', () => {
    const bad = `
      contract Bad() {
        function f(int a) {
          int b = 0;
          (int x, b) = (a, a);
          require(x == b);
        }
      }
    `;
    expect(() => compileString(bad)).toThrow(/mix/i);
  });
});
