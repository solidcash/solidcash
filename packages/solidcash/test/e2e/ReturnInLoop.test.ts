import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

const verifyFailure = 'messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';

// An internal function that returns from INSIDE a loop - previously a codegen bug ("variable does not exist on
// the stack"), now desugared to flag + break + post-loop return. VM-verifies the desugar is runtime-correct.
const SOURCE = `
contract ReturnInLoop {
    function firstSquareAbove(int threshold) private pure returns (int) {
        for (int i = 0; i < 10; i = i + 1) {
            if (i * i > threshold) { return i; }
        }
        return 0 - 1;
    }
    function check(int threshold, int expected) {
        require(firstSquareAbove(threshold) == expected);
    }
}
`;

describe('return inside a loop (internal function)', () => {
  const artifact = compileString(SOURCE, { forceStateful: true });

  it('returns the first index whose square exceeds the threshold (3*3=9 > 5, 2*2=4 <= 5)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.check(5n, 3n)).resolves.toBeDefined();
  });

  it('a wrong expected value fails (the loop + early return actually ran)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.check(5n, 2n)).rejects.toThrow(verifyFailure);
  });

  it('returns the sentinel when nothing matches (no early return taken)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.check(1000n, 0n - 1n)).resolves.toBeDefined();
  });
});
