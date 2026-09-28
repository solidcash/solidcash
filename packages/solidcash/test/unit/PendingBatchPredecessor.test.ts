import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import {
  batchPredecessorCommitment, isPendingBatchPredecessor,
} from '../../src/message-bus/pending-batch-predecessor.js';

const first = new Uint8Array(32).fill(1);
const second = new Uint8Array(32).fill(2);
const fn = {
  inputs: [0, 1, 2].flatMap((slot) => [
    { name: `__internal__vmapBatchSlot_${slot}`, type: 'bytes32' },
    { name: `__internal__vmapBatchPredOut_${slot}`, type: 'bigint' },
  ]),
  sortedBatchInfo: [
    { collection: 'left', slotIndices: [0, 1] },
    { collection: 'right', slotIndices: [2] },
  ],
};
const proof = (slot: Uint8Array): string => `${binToHex(slot)}${'00'.repeat(32)}07`;

describe('pending batch predecessor discovery', () => {
  it('uses one minimum successor for distinct targets sharing an original predecessor', () => {
    const predecessor = proof(new Uint8Array(32));
    const args = [second, 10n, first, 10n, new Uint8Array(32), 20n];
    const expected = `${'00'.repeat(32)}${binToHex(first)}07`;
    expect(batchPredecessorCommitment(fn, args, 0, predecessor)).toBe(expected);
    expect(batchPredecessorCommitment(fn, args, 1, predecessor)).toBe(expected);
    expect(batchPredecessorCommitment(fn, [second, 10n, first, -2n], 0, predecessor))
      .toBe(`${'00'.repeat(32)}${binToHex(second)}07`);
    expect(batchPredecessorCommitment(fn, args, 0, proof(first))).toBeUndefined();
  });

  it('preserves the inactive witness when another active target recreates the shared predecessor', () => {
    expect(isPendingBatchPredecessor(fn, [first, -1n, second, -1n, first, 23n], 1, proof(first))).toBe(false);
  });

  it('keeps an ordinary update inactive', () => {
    expect(isPendingBatchPredecessor(fn, [first, -1n, second, -1n], 0, proof(first))).toBe(false);
  });

  it('discovers a non-target predecessor without borrowing targets from another collection', () => {
    expect(isPendingBatchPredecessor(fn, [second, -1n, second, -2n, first, -1n], 0, proof(first))).toBe(true);
  });

  it('does not treat an inactive route row as a recreated target', () => {
    expect(isPendingBatchPredecessor(fn, [first, -2n, second, -1n], 1, proof(first))).toBe(true);
  });

  it('does not rebind a later insert in the same proof gap to the first insert\'s P\' output', () => {
    const head = proof(new Uint8Array(32));
    const args = [second, -1n, first, 23n];
    expect(isPendingBatchPredecessor(fn, args, 0, head)).toBe(false);
    expect(isPendingBatchPredecessor(fn, [second, -1n, first, -1n], 1, head)).toBe(true);
  });

  it('requires an absent witness, a complete proof, and compiler batch membership', () => {
    expect(isPendingBatchPredecessor(fn, [second, -2n], 0, proof(first))).toBe(false);
    expect(isPendingBatchPredecessor(fn, [second, 23n], 0, proof(first))).toBe(false);
    expect(isPendingBatchPredecessor(fn, [second, -1n], 0, binToHex(first))).toBe(false);
    expect(isPendingBatchPredecessor(fn, [undefined, -1n], 0, proof(first))).toBe(false);
    expect(isPendingBatchPredecessor({ inputs: fn.inputs }, [second, -1n], 0, proof(first))).toBe(false);
  });
});
