import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

const verifyFailure = 'messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';
// Calling a function pointer from an array element (`a[i]()`) dispatches to the element's target at runtime.
const SRC = `contract C {
  function add1(uint x) internal pure returns (uint) { return x + 1; }
  function add2(uint x) internal pure returns (uint) { return x + 2; }
  function mul10(uint x) internal pure returns (uint) { return x * 10; }
  function pick(uint i, uint v) internal pure returns (uint) {
    function(uint) internal pure returns (uint)[3] memory a;
    a[0] = add1; a[1] = add2; a[2] = mul10;
    return a[i](v);
  }
  function ok() public pure {
    require(pick(0, 5) == 6);
    require(pick(1, 5) == 7);
    require(pick(2, 5) == 50);
  }
  function wrong() public pure { require(pick(0, 5) == 7); }
}`;
const artifact = compileString(SRC, { forceStateful: true });
describe('function pointer array-element call (runtime)', () => {
  it('a[i]() dispatches to the element target', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.ok()).resolves.toBeDefined();
  });
  it('a wrong expectation reverts (dispatch is real, not constant-folded)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.wrong()).rejects.toThrow(verifyFailure);
  });
});
