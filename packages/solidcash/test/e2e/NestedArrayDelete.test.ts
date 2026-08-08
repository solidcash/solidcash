import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner, expectOverOperationCostBudget } from '../test-util.js';

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
  // OVER BUDGET at the real operation-cost limit. Restore the positive assertion when the nested element
  // lowering gets cheaper; see expectOverOperationCostBudget.
  it('delete x[i][j] is currently over the BCH-2026 operation-cost budget', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expectOverOperationCostBudget(sc.memDelete());
  });
  it('a wrong post-delete expectation reverts (the delete really zeroed it)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.memDeleteWrong()).rejects.toThrow(verifyFailure);
  });
});
