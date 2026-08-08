import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner, expectOverOperationCostBudget, densityReserve } from '../test-util.js';

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
  // Three dispatches exceed the real BCH-2026 operation-cost budget at this contract's natural size, so the
  // deploy reserves density for them. Measured: this shape needs between 96 and 128 reserve bytes; 256 is the
  // shared default. The single-dispatch negative below needs none, which is why only this row reserves.
  it('a[i]() dispatches to the element target (with a density reserve)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy({ salt: densityReserve() });
    await expect(sc.ok()).resolves.toBeDefined();
  });
  it('a[i]() without a density reserve is refused by the operation-cost budget', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expectOverOperationCostBudget(sc.ok());
  });
  it('a wrong expectation reverts (dispatch is real, not constant-folded)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.wrong()).rejects.toThrow(verifyFailure);
  });
});
