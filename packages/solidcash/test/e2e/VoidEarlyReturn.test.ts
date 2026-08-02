import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

const verifyFailure = 'layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';

// A void internal function with an early `return;` in one branch and a sibling else-if that still
// reads the param (mirrors OpenZeppelin ECDSA._throwError). Previously a codegen desync ("variable
// does not exist on the stack"); a void return now emits nothing and the subroutine-end cleanup
// drops the params once. Called from two entry points so _check becomes a real OP_DEFINE subroutine.
// VM-verifies the caller's local survives the call intact on both the return and fall-through paths.
const SOURCE = `
contract VoidEarlyReturn {
    function _check(int code) private pure {
        if (code == 0) { return; }
        else if (code == 1) { require(false); }
        else if (code == 2) { require(false); }
    }
    function runA(int code, int expected) {
        int x = code + 100;
        _check(code);
        require(x == expected);
    }
    function runB(int code, int expected) {
        int y = code + 200;
        _check(code);
        require(y == expected);
    }
}
`;

describe('void internal function with an early return in a branch', () => {
  const artifact = compileString(SOURCE, { forceStateful: true });

  it('return-path is a no-op and the caller local survives (code 0)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.runA(0n, 100n)).resolves.toBeDefined();
  });

  it('fall-through path cleans the param without corrupting the caller (code 3)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.runA(3n, 103n)).resolves.toBeDefined();
  });

  it('the revert branch aborts (code 1)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.runA(1n, 100n)).rejects.toThrow(verifyFailure);
  });

  it('the subroutine works from a second caller too (code 0)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.runB(0n, 200n)).resolves.toBeDefined();
  });
});
