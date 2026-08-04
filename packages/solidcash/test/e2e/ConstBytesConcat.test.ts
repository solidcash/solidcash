import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

const verifyFailure = 'messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';
// bytes.concat in a constant initializer folds to the concatenation of its (constant) args.
const SRC = `
bytes constant aaaa = hex"aaaa";
contract C {
  bytes constant abc = bytes.concat(aaaa, hex"bbbb", hex"cccc");
  function ok() public pure {
    require(abc.length == 6);
    require(abc[0] == 0xaa && abc[1] == 0xaa && abc[2] == 0xbb && abc[3] == 0xbb && abc[4] == 0xcc && abc[5] == 0xcc);
  }
  function wrong() public pure { require(abc[0] == 0xbb); }
}`;
const artifact = compileString(SRC, { forceStateful: true });
describe('const bytes.concat fold (runtime)', () => {
  it('folds to the concatenated bytes value', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.ok()).resolves.toBeDefined();
  });
  it('a wrong expectation reverts (value really is aaaabbbbcccc)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.wrong()).rejects.toThrow(verifyFailure);
  });
});
