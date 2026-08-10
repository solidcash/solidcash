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
  // BCHN still refuses this nested delete at the maximum supported reserve; the mock diagnostic profile admits
  // it. Keep both verdicts explicit until nested-array lowering becomes cheaper.
  it('classifies delete x[i][j] at the maximum density reserve for the active provider', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy({ salt: densityReserve(520) });
    expect(sc.inner.salt).toHaveLength(520);
    if (process.env.TESTS_USE_REGTEST) await expectOverOperationCostBudget(sc.memDelete());
    else await expect(sc.memDelete()).resolves.toBeDefined();
  });
  it('a wrong post-delete expectation reverts (the delete really zeroed it)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.memDeleteWrong()).rejects.toThrow(verifyFailure);
  });
});
