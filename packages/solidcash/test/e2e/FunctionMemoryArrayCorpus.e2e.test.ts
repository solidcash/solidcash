import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Solidity corpus array/function_memory_array.sol verbatim (uint->int): a dynamically-allocated INTERNAL
// function-pointer memory array, populated by static index, then dispatched by a RUNTIME index `arr[i](x)`.
// Internal pointers are functionIds, so the array is an int array and the call is an indexed OP_INVOKE.
// Corpus: test(10,0)->11, (10,1)->12, (10,2)->13, (10,3)->15, (10,4)->18, (10,5)->FAILURE (unset slot).
const SRC = `contract C {
  function a(int x) public returns (int) { return x + 1; }
  function b(int x) public returns (int) { return x + 2; }
  function c(int x) public returns (int) { return x + 3; }
  function d(int x) public returns (int) { return x + 5; }
  function e(int x) public returns (int) { return x + 8; }
  function test(int x, int i) internal returns (int) {
    function(int) internal returns (int)[] memory arr = new function(int) internal returns (int)[](10);
    arr[0] = a; arr[1] = b; arr[2] = c; arr[3] = d; arr[4] = e;
    return arr[i](x);
  }
  function ok() public returns (bool) {
    require(test(10, 0) == 11);
    require(test(10, 1) == 12);
    require(test(10, 2) == 13);
    require(test(10, 3) == 15);
    require(test(10, 4) == 18);
    return true;
  }
  function wrong() public returns (bool) { require(test(10, 1) == 11); return true; }
}`;

const artifact = compileString(SRC, { forceStateful: true });

describe('function_memory_array corpus: runtime-indexed internal fn-ptr memory array', () => {
  it('arr[i](x) dispatches to each element target (11,12,13,15,18)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.ok()).resolves.toBeDefined();
  });

  it('a wrong expectation reverts (dispatch is real per-index, not constant-folded)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.wrong()).rejects.toThrow();
  });
});
