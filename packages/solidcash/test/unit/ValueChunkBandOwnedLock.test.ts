import { buildValueChunkCommitment } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { dominantOwnedValueChunkLock } from '../../src/stateful/value-chunk-band-helpers.js';

const owner = '22'.repeat(32);
const caller = '11'.repeat(32);

type Out = { to: Uint8Array; token?: { category: string; nft: { capability: string; commitment: string } } };

function p2sh32(fill: number): Uint8Array {
  return Uint8Array.from([0xaa, 0x20, ...new Array<number>(32).fill(fill), 0x87]);
}

function nft(to: Uint8Array, category: string, commitment: string, capability = 'mutable'): Out {
  return { to, token: { category, nft: { capability, commitment } } };
}

const ownLock = p2sh32(0x0b);
const callerChunkLock = p2sh32(0x0c);
const pad: Out = { to: Uint8Array.of(0x51) };
// A caller's dynamic-state chunks (entry-shaped commitments) right after the callee's band.
const callerRun = [nft(callerChunkLock, caller, '004c78aa'), nft(callerChunkLock, caller, '514c78bb')];

describe('value-chunk band lock vote', () => {
  it('does not lend a caller dynamic-state run lock to a callee band', () => {
    expect(dominantOwnedValueChunkLock([pad, pad, ...callerRun], 0, 8, owner)).toBeUndefined();
  });

  it('selects the owner continuation over a larger foreign run', () => {
    const outputs = [nft(ownLock, owner, buildValueChunkCommitment(0, Uint8Array.of(1))), ...callerRun];
    expect(dominantOwnedValueChunkLock(outputs, 0, 8, owner)).toEqual(ownLock);
  });

  it('counts only the owner value-chunk continuations', () => {
    const outputs = [
      nft(callerChunkLock, owner, '004c78aa'),
      nft(p2sh32(0x0d), owner, '534349440105', 'none'),
      nft(ownLock, owner, '00'),
    ];
    expect(dominantOwnedValueChunkLock(outputs, 0, 8, owner)).toEqual(ownLock);
    expect(dominantOwnedValueChunkLock(outputs, 0, 8, undefined)).toBeUndefined();
  });
});
