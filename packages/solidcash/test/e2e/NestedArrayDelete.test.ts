import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner, expectOverOperationCostBudget, densityReserve } from '../test-util.js';

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
  // Exceeds the real BCH-2026 operation-cost budget at this contract's natural size, so the deploy reserves
  // density for it. See `densityReserve`.
  it('delete x[i][j] resets the element to 0 (with a density reserve)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy({ salt: densityReserve() });
    await expect(sc.memDelete()).resolves.toBeDefined();
  });
  it('delete x[i][j] without a density reserve is refused by the operation-cost budget', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expectOverOperationCostBudget(sc.memDelete());
  });
  it('a wrong post-delete expectation reverts (the delete really zeroed it)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.memDeleteWrong()).rejects.toThrow(verifyFailure);
  });
});
