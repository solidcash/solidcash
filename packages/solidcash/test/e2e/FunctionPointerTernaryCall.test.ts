import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';
// Calling the value of a parenthesised callee: a ternary selecting a function pointer, then calling it.
const SRC = `contract C {
  function inc(uint x) internal pure returns (uint) { return x + 1; }
  function dec(uint x) internal pure returns (uint) { return x - 1; }
  function pick(bool c, uint v) internal pure returns (uint) { return (c ? inc : dec)(v); }
  function ok() public pure {
    require(pick(true, 10) == 11);
    require(pick(false, 10) == 9);
  }
  function wrong() public pure { require(pick(true, 10) == 9); }
}`;
const artifact = compileString(SRC, { forceStateful: true });
describe('function pointer ternary call (runtime)', () => {
  it('(c ? f : g)(v) dispatches to the selected branch', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.ok()).resolves.toBeDefined();
  });
  it('a wrong expectation reverts', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.wrong()).rejects.toThrow();
  });
});
