import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { compileFile, compileString } from './direct-compile.js';

// A sorted-mapping write marked conditional settles through ran flags and the guarded batch census. A write that
// runs on every path that completes must not be marked: neither a cache's write-back, nor a write after a guard
// that can only fail, nor one in the arm of a branch an earlier guard decides.
const flagsOf = (artifact: Artifact, fn: string): boolean[] => {
  const entry = artifact.abi.find((candidate) => candidate.name === fn);
  expect(entry?.blockLayout).toBeDefined();
  return entry!.blockLayout!.slots.filter((slot) => slot.kind === 'entry').map((slot) => slot.conditional === true);
};
const entryFlags = (source: string, fn: string): boolean[] => flagsOf(compileString(source), fn);

const LEDGER = `pragma solidcash >=0.8.0;
contract Ledger() {
  mapping(address account => uint256) internal balances;
  internal uint256 supply;
  error InvalidReceiver(address receiver);
  event Landed(address to, uint256 value);

  function _credit(address account, uint256 value) internal {
    this.balances[account] = this.balances[account] + value;
  }

  function _creditOrMint(address account, uint256 value) internal {
    if (account == address(0)) {
      this.supply = this.supply + value;
    } else {
      this.balances[account] = this.balances[account] + value;
    }
  }

  function _land(address to, uint256 value) internal {
    if (to == address(0)) {
      this.supply = this.supply - value;
    } else {
      this.balances[to] = this.balances[to] + value;
    }
    emit Landed(to, value);
  }

  function deposit(address to, uint256 value) {
    require(value > 0);
    _credit(to, value);
  }

  function credit(address to, uint256 value) {
    if (to == address(0)) {
      revert InvalidReceiver(to);
    }
    this.balances[to] = this.balances[to] + value;
  }

  function move(address to, uint256 value) {
    require(value > 0 && to != address(0));
    _land(to, value);
  }

  function claim(uint256 value) {
    address account = msg.sender;
    _creditOrMint(account, value);
  }

  function maybe(address to, uint256 value, bool pay) {
    if (pay) {
      this.balances[to] = this.balances[to] + value;
    }
  }
}`;

describe('entry writes that always run are laid out unconditionally', () => {
  it('writes a cached entry back without a dirty guard', () => {
    expect(entryFlags(LEDGER, 'deposit')).toEqual([false]);
  });

  it('keeps the statements after a guard that can only fail out of a branch', () => {
    expect(entryFlags(LEDGER, 'credit')).toEqual([false]);
  });

  it('folds the zero-address branch a require already decides', () => {
    expect(entryFlags(LEDGER, 'move')).toEqual([false]);
  });

  it('treats msg.sender as nonzero in a direct entry', () => {
    expect(entryFlags(LEDGER, 'claim')).toEqual([false]);
  });

  it('keeps a write a branch guards conditional', () => {
    expect(entryFlags(LEDGER, 'maybe')).toEqual([true]);
  });

  it('lays out every ledger write of the minimal BchNative token unconditionally', () => {
    const token = compileFile(new URL('../../solidcash/contracts/examples/MinimalNativeToken.scash', import.meta.url));
    for (const fn of ['transfer', 'approve', 'transferFrom', 'wrap', 'unwrap']) {
      expect(flagsOf(token, fn).every((conditional) => !conditional), fn).toBe(true);
    }
  });
});
