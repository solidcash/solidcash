import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

const verifyFailure = 'layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';
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
  it('delete x[i][j] resets the element to 0', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.memDelete()).resolves.toBeDefined();
  });
  it('a wrong post-delete expectation reverts (the delete really zeroed it)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.memDeleteWrong()).rejects.toThrow(verifyFailure);
  });
});
