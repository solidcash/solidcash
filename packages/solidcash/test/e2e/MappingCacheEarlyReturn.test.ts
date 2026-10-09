import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { bobAddress } from '../fixture/vars.js';
import { fundedSigner } from '../test-util.js';

// Repeated writes to one mapping entry share a cache declared where the entry is first used. A `return;` ahead of
// that point flushed the cache too, naming it before its declaration ("Undefined reference to symbol
// __vmapcache_bal_0_dirty"; KashiPair's withdrawFees). A return there has nothing to flush.
const SOURCE = `pragma solidity ^0.8.0;
contract EarlyReturnBeforeCache {
  mapping(address => uint256) public bal;
  uint256 public open;
  function setOpen(uint256 v) public { open = v; }
  function credit(address a, uint256 v) public {
    if (open == 0) {
      return;
    }
    address k = a;
    bal[k] = bal[k] + v;
    bal[k] = bal[k] + 2;
  }
}`;

describe('an early return ahead of a cached mapping entry', () => {
  it('returns without a write, and writes both updates once past the return', async () => {
    const artifact = compileString(SOURCE, { evmCompat: true, forceStateful: true });
    const sc: any = await getContractFactory(artifact, await fundedSigner()).deploy();
    const bob = addressToLockScript(bobAddress);

    await sc.credit(bob, 5n);
    expect(await sc.state.bal(bob)).toBe(0n);

    await sc.setOpen(1n);
    await sc.credit(bob, 5n);
    expect(await sc.state.bal(bob)).toBe(7n);
  });
});
