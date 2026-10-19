/**
 * SDKCORE-1: an unpaired message-bus block input is padding. A dummy funder may sit at OP_TRUE.
 * A wallet coin or a token input is recreated at its own lock, so the pad cannot hand its value away.
 */
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  outputForUnpairedBlockInput, padUnpairedBlockInput, type UnpairedBlockInput,
} from '../src/message-bus/compose-assemble.js';
import type { Output } from '../src/interfaces.js';

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
      category: 'ab'.repeat(31) + '54',
      nft: { capability: 'mutable' as const, commitment: '00' },
    };
    const kept = outputForUnpairedBlockInput({ satoshis: 800n, token, unlocker: unlocker(wallet) });
    expect(binToHex(kept.to as Uint8Array)).toBe(binToHex(wallet));
    expect(kept.amount).toBe(800n);
    expect(kept.token).toEqual(token);
    expect(kept.token).not.toBe(token);
    expect(kept.to).not.toEqual(Uint8Array.of(0x51));
  });

  it('recreates an identity anchor once when the local build already placed it at another slot', () => {
    const anchorLock = hexToBin(`aa20${'33'.repeat(32)}87`);
    const token = {
      amount: 0n,
      category: 'cd'.repeat(31) + '32',
      nft: { capability: 'none' as const, commitment: `5343494401${'00'.repeat(40)}` },
    };
    const anchor = { satoshis: 800n, token, unlocker: unlocker(anchorLock) };
    const replica = (): Output => ({ to: anchorLock, amount: 800n, token: { ...token, nft: { ...token.nft } } });
    const pad = (first: UnpairedBlockInput, outputs: Output[]): Output[] => {
      const local = { inputs: [first, anchor], outputs, addOutput: (output: Output): void => { outputs.push(output); } };
      padUnpairedBlockInput(local);
      return outputs;
    };
    const anchors = (outputs: Output[]): number[] => outputs.flatMap((output, index) => (
      output.token?.nft?.commitment === token.nft.commitment ? [index] : []));

    const dummy = { satoshis: 1000n, unlocker: unlocker(hexToBin(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX)) };
    const moved = pad(dummy, [replica()]);
    expect(anchors(moved)).toEqual([1]);
    expect(moved[0]).toEqual({ to: Uint8Array.of(0x51), amount: 1000n });
    expect(binToHex(moved[1].to as Uint8Array)).toBe(binToHex(anchorLock));

    const tokenInput = {
      satoshis: 900n,
      token: { amount: 0n, category: 'ab'.repeat(31) + '54', nft: { capability: 'mutable' as const, commitment: '00' } },
      unlocker: unlocker(p2pkh(0x33)),
    };
    const stayed = pad(tokenInput, [replica()]);
    expect(anchors(stayed)).toEqual([0]);
    expect(stayed[1]).toEqual({ to: anchorLock, amount: 800n });

    const fresh = pad(dummy, [{ to: Uint8Array.of(0x51), amount: 1000n }]);
    expect(anchors(fresh)).toEqual([1]);
  });
});
