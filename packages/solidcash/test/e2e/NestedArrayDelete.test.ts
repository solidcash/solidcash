import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner, densityReserve } from '../test-util.js';

const verifyFailure = 'messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';
// delete on a nested array element resets it to the type default (Solidity semantics).
const SRC = `contract C {
  function memDelete() public pure {
    uint[][] memory x = new uint[][](5);
    x[3] = new uint[](3);
    x[3][2] = 9;
    delete x[3][2];
    require(x[3][2] == 0 && x[3].length == 3);
  }
  function memDeleteWrong() public pure {
    uint[][] memory x = new uint[][](5);
    x[3] = new uint[](3);
    x[3][2] = 9;
    delete x[3][2];
    require(x[3][2] == 9);
  }
}`;
const artifact = compileString(SRC, { forceStateful: true });
describe('nested array element delete (runtime)', () => {
  // The operation-cost budget scales with SCRIPT SIZE, so outlining spends it: every byte shared away
  // removes 800 units of allowance while saving no operation cost. This shape used to sit just over the
  // budget at its natural size and needed `densityReserve()`; raising MINIMUM_WINDOW_ELEMENTS to 12
  // (see the constant's note) leaves more of it inline, and it now fits on its own. Both rows are kept:
  // the reserve must still work, and the shape must still settle without one.
  it('delete x[i][j] resets the element to 0 (with a density reserve)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy({ salt: densityReserve() });
    await expect(sc.memDelete()).resolves.toBeDefined();
  });
  it('delete x[i][j] now fits the operation-cost budget at its natural size', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.memDelete()).resolves.toBeDefined();
  });
  it('a wrong post-delete expectation reverts (the delete really zeroed it)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.memDeleteWrong()).rejects.toThrow(verifyFailure);
  });
});
