import { describe, expect, it } from 'vitest';
import type { Output, UnlockableUtxo } from '../../src/interfaces.js';
import { resolvePhysicalPredOutWitnesses } from '../../src/message-bus/compose-predout-witness.js';

const categoryId = '11'.repeat(32);
const oldCommitment = `${'22'.repeat(32)}${'33'.repeat(32)}${'44'.repeat(64)}`;
const target = Uint8Array.from({ length: 32 }, () => 0x55);
const routeInputs = [
  { name: '__internal__vmapBatchPredOut_0' },
  { name: '__internal__vmapBatchProof_0' },
  { name: '__internal__vmapBatchSlot_0' },
];
const predecessor = {
  unlocker: { generateLockingBytecode: () => Uint8Array.of(0xaa, 0x20, 0x77) },
  token: { category: categoryId, nft: { capability: 'mutable', commitment: oldCommitment } },
} as unknown as UnlockableUtxo;
const other = {
  unlocker: { generateLockingBytecode: () => Uint8Array.of(0x51) },
} as unknown as UnlockableUtxo;

function recreation(next = '55'.repeat(32)): Output {
  return {
    to: Uint8Array.of(0xaa, 0x20, 0x77), amount: 1000n,
    token: {
      category: categoryId, amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: `${oldCommitment.slice(0, 64)}${next}${oldCommitment.slice(128)}`,
      },
    },
  };
}

const pad: Output = { to: Uint8Array.of(0x51), amount: 1000n };

function resolve(outputs: Output[], inputs = [other, other, other, predecessor]): number {
  const witnesses = resolvePhysicalPredOutWitnesses({
    routeInputs,
    params: [2n, 1n, target],
    routeInputOffset: 2,
    inputs,
    outputs,
    categoryId,
  });
  expect(witnesses).toHaveLength(1);
  return witnesses[0].localOutputIndex;
}

describe('composed executor predecessor output witness', () => {
  it('finds the executor-relative predecessor output across an unrelated local prefix', () => {
    expect(resolve([pad, pad, recreation()])).toBe(2);
  });

  it('prefers the exact target pointer when another output preserves the same predecessor identity', () => {
    expect(resolve([recreation('66'.repeat(32)), pad, recreation()])).toBe(2);
  });

  it('refuses ambiguous or unauthenticated predecessor outputs', () => {
    expect(() => resolve([recreation(), recreation()])).toThrow(/2 authenticated predecessor outputs/);
    const wrongOwner = recreation();
    wrongOwner.token!.category = '99'.repeat(32);
    expect(() => resolve([wrongOwner])).toThrow(/0 authenticated predecessor outputs/);
  });
});
