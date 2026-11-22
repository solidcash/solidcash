import { describe, expect, it } from 'vitest';
import { binToHex, hash256 } from '@bitauth/libauth';
import { fillerLockingBytecode } from '@solidcash/utils';
import * as stateful from '../../src/stateful/index.js';

// The SDK builds filler outputs (`fillerOutput`) that anyone may sweep after 144 blocks. The stateful entry point
// exports the unlocker for them, so a sweep needs no hand-written script.
describe('fillerUnlocker', () => {
  it('is exported with the sequence a sweep needs', () => {
    expect(typeof stateful.fillerUnlocker).toBe('function');
    expect(stateful.FILLER_SEQUENCE).toBe(144);
  });

  it('unlocks the filler lock: it pushes the one redeem script whose hash the P2SH32 lock commits to', () => {
    const unlocker = stateful.fillerUnlocker();
    const lock = fillerLockingBytecode();
    expect(binToHex(unlocker.generateLockingBytecode())).toBe(binToHex(lock));
    const unlocking = unlocker.generateUnlockingBytecode({} as never);
    // A single push: the length byte, then the redeem script.
    expect(unlocking[0]).toBe(unlocking.length - 1);
    const redeem = unlocking.slice(1);
    // P2SH32: OP_HASH256 <32 bytes> OP_EQUAL.
    expect(binToHex(lock.slice(2, 34))).toBe(binToHex(hash256(redeem)));
    expect(stateful.isFillerLockingBytecode(stateful.fillerOutput().to as Uint8Array)).toBe(true);
  });
});
