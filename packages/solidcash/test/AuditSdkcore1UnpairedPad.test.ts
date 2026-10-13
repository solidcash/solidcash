/**
 * SDKCORE-1: an unpaired message-bus block input is padding. A dummy funder may sit at OP_TRUE.
 * A wallet coin or a token input is recreated at its own lock, so the pad cannot hand its value away.
 */
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { outputForUnpairedBlockInput } from '../src/message-bus/compose-assemble.js';

function unlocker(lock: Uint8Array): { generateLockingBytecode(): Uint8Array } {
  return { generateLockingBytecode: (): Uint8Array => lock };
}

function p2pkh(fill: number): Uint8Array {
  return Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(fill), 0x88, 0xac]);
}

describe('SDKCORE-1 unpaired block pad', () => {
  it('pads a dummy funder to OP_TRUE and recreates a wallet coin at its own lock', () => {
    const dummy = hexToBin(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX);
    const padded = outputForUnpairedBlockInput({ satoshis: 1000n, unlocker: unlocker(dummy) });
    expect(padded.to).toEqual(Uint8Array.of(0x51));
    expect(padded.amount).toBe(1000n);

    const wallet = p2pkh(0x11);
    const kept = outputForUnpairedBlockInput({ satoshis: 50_000_000n, unlocker: unlocker(wallet) });
    expect(binToHex(kept.to as Uint8Array)).toBe(binToHex(wallet));
    expect(kept.amount).toBe(50_000_000n);
    expect(kept.to).not.toEqual(Uint8Array.of(0x51));
  });

  it('keeps a token-bearing input at its own lock instead of publishing it at OP_TRUE', () => {
    const wallet = p2pkh(0x22);
    const token = {
      amount: 0n,
      category: 'ab'.repeat(32),
      nft: { capability: 'mutable' as const, commitment: '00' },
    };
    const kept = outputForUnpairedBlockInput({ satoshis: 800n, token, unlocker: unlocker(wallet) });
    expect(binToHex(kept.to as Uint8Array)).toBe(binToHex(wallet));
    expect(kept.amount).toBe(800n);
    expect(kept.token).toEqual(token);
    expect(kept.token).not.toBe(token);
    expect(kept.to).not.toEqual(Uint8Array.of(0x51));
  });
});
