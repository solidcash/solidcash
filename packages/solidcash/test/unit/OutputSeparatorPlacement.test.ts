import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { fillerLockingBytecode } from '@solidcash/utils';
import {
  isFillerLockingBytecode,
  redirectViewTailOffFiller as redirectValueWitnessOffSeparator,
  moveTrailingOutputsBeforeValueChunkSuffix as moveTrailingPadsBeforeValueChunkSuffix,
} from '../../src/stateful/StatefulTransactionBuilder.js';

// A 1-byte lock reads as its byte, a 35-byte lock as its third byte, and the filler as 'filler'.
const shape = (output: { to: Uint8Array | string }): number | string => {
  if (!(output.to instanceof Uint8Array)) return 0;
  if (isFillerLockingBytecode(output.to)) return 'filler';
  return output.to.length === 1 ? output.to[0] : output.to[2];
};

describe('value witness placement around the filler separator', () => {
  const witnessPad = (commitment = '00'.repeat(32)): {
    to: Uint8Array;
    token: { nft: { capability: 'none'; commitment: string } };
  } => ({
    to: Uint8Array.of(0x51),
    token: { nft: { capability: 'none', commitment } },
  });
  const separator = (): { to: Uint8Array } => ({ to: fillerLockingBytecode() });

  it('detects the filler lock', () => {
    expect(isFillerLockingBytecode(fillerLockingBytecode())).toBe(true);
    expect(isFillerLockingBytecode(binToHex(fillerLockingBytecode()))).toBe(true);
    expect(isFillerLockingBytecode(Uint8Array.of(0x6a))).toBe(false);
    expect(isFillerLockingBytecode(Uint8Array.of(0x51))).toBe(false);
  });

  it('keeps a placement off the separator unchanged', () => {
    const outputs = [witnessPad(), witnessPad('01'.repeat(32))];
    expect(redirectValueWitnessOffSeparator({
      placedIndex: 1,
      plannedIndex: 0,
      outputs,
    })).toBe(1);
  });

  it('redirects a separator placement onto the planned unlock witness pad before the separator', () => {
    const outputs = [witnessPad(), witnessPad('01'.repeat(32)), separator()];
    expect(redirectValueWitnessOffSeparator({
      placedIndex: 2,
      plannedIndex: 1,
      returnIndex: 2,
      outputs,
    })).toBe(1);
  });

  it('falls back to the pad immediately before the separator', () => {
    const outputs = [witnessPad('00'.repeat(31) + '01'), separator()];
    expect(redirectValueWitnessOffSeparator({
      placedIndex: 1,
      outputs,
    })).toBe(0);
  });

  it('redirects the reserved separator index even before it holds the filler', () => {
    const outputs = [witnessPad(), { to: Uint8Array.of(0x51) }];
    expect(redirectValueWitnessOffSeparator({
      placedIndex: 1,
      plannedIndex: 0,
      suffixStart: 1,
      outputs,
    })).toBe(0);
  });

  it('refuses to redirect onto a pad after the separator', () => {
    const outputs = [separator(), witnessPad('01'.repeat(32))];
    expect(redirectValueWitnessOffSeparator({
      placedIndex: 0,
      outputs,
    })).toBeUndefined();
  });

  it('skips the write when no view pad can host the return', () => {
    const outputs = [separator(), { to: Uint8Array.of(0xaa) }];
    expect(redirectValueWitnessOffSeparator({
      placedIndex: 0,
      outputs,
    })).toBeUndefined();
  });
});

describe('trailing pad placement around a value-chunk suffix', () => {
  it('moves pads after the separator in front of the value-chunk run', () => {
    const valueChunk = {
      to: new Uint8Array(35),
      token: { nft: { capability: 'mutable' as const } },
    };
    valueChunk.to[0] = 0xaa;
    valueChunk.to[1] = 0x20;
    valueChunk.to[2] = 0x33;
    valueChunk.to[34] = 0x87;
    const outputs = [
      { to: Uint8Array.of(0x51) },
      valueChunk,
      { to: fillerLockingBytecode() },
      { to: Uint8Array.of(0x51), token: { nft: { capability: 'none' as const } } },
      { to: Uint8Array.of(0x51) },
    ];
    expect(moveTrailingPadsBeforeValueChunkSuffix(outputs, valueChunk.to)).toBe(2);
    expect(outputs.map(shape)).toEqual([0x51, 0x51, 0x51, 0x33, 'filler']);
  });

  it('parks pads before the separator when the value-chunk lock is not present yet', () => {
    const foreign = new Uint8Array(35);
    foreign[0] = 0xaa;
    foreign[1] = 0x20;
    foreign[34] = 0x87;
    foreign[2] = 0x11;
    const valueChunkLock = new Uint8Array(35);
    valueChunkLock[0] = 0xaa;
    valueChunkLock[1] = 0x20;
    valueChunkLock[34] = 0x87;
    valueChunkLock[2] = 0x22;
    const outputs = [
      { to: Uint8Array.of(0xaa), token: { nft: { capability: 'minting' as const } } },
      { to: foreign, token: { nft: { capability: 'mutable' as const } } },
      { to: foreign, token: { nft: { capability: 'mutable' as const } } },
      { to: fillerLockingBytecode() },
      { to: Uint8Array.of(0x51) },
    ];
    expect(moveTrailingPadsBeforeValueChunkSuffix(outputs, valueChunkLock)).toBe(1);
    expect(outputs.map(shape)).toEqual([0xaa, 0x11, 0x11, 0x51, 'filler']);
  });
});
