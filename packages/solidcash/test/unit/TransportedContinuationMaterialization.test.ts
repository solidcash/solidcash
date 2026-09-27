import { binToHex, hexToBin } from '@bitauth/libauth';
import { BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import type { Output, UnlockableUtxo } from '../../src/interfaces.js';
import {
  materializeTransportedContinuations, transportedContinuationSpanClaims, type TransportedContinuationOutput,
} from '../../src/message-bus/materialize-transported-continuations.js';
import { minimumActualSizeForComputedValueChunkClaims } from '../../src/message-bus/compose-recipes.js';

const categoryId = '71'.repeat(32);
const lock = (byte: number): Uint8Array => Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(byte), 0x87]);
const chunks: TransportedContinuationOutput[] = [0, 1].map((index) => ({
  offset: 6 + index, categoryId, lockingBytecode: lock(0x31),
  commitment: `${index.toString(16).padStart(2, '0')}00010203`,
}));

function fixture(): { inputs: UnlockableUtxo[]; outputs: Output[] } {
  const inputs = Array.from({ length: 9 }, (_, index) => ({
    txid: '11'.repeat(32), vout: index, satoshis: 5000n,
    unlocker: { generateLockingBytecode: () => hexToBin(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX) },
  })) as UnlockableUtxo[];
  const outputs: Output[] = inputs.map((input) => ({ to: Uint8Array.of(0x51), amount: input.satoshis }));
  for (const [index, chunk] of chunks.entries()) {
    // The local builder appended the new root early, but the reserved band still contains the old root.
    outputs[2 + index] = {
      to: chunk.lockingBytecode, amount: 1200n,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: chunk.commitment } },
    };
    outputs[chunk.offset] = { ...outputs[2 + index], to: lock(0x42) };
  }
  return { inputs, outputs };
}

describe('transported continuation materialization', () => {
  it('replaces stale transported-resource spans while retaining all unrelated collision checks', () => {
    const resourceA = `${categoryId}:${'12'.repeat(20)}:${'34'.repeat(32)}`;
    const resourceB = `${categoryId}:${'56'.repeat(20)}:${'78'.repeat(32)}`;
    const part = (resourceIdentity: string, offset: number, index = 0): {
      resourceIdentity: string; offset: number; resourcePart: string;
    } => ({
      resourceIdentity, offset, resourcePart: `chunk:${index}`,
    });
    const final = [part(resourceA, 46), part(resourceB, 47), part(resourceB, 48, 1)];
    const stale = [part(resourceA, 46), part(resourceA, 47, 1), part(resourceB, 46)];
    const reconciled = transportedContinuationSpanClaims(stale, final);
    expect(reconciled).toEqual(final);
    expect(minimumActualSizeForComputedValueChunkClaims(0, 40, 2, 9, reconciled)).toBe(9);
    const unrelated = part(`${categoryId}:${'90'.repeat(20)}:${'ab'.repeat(32)}`, 47);
    expect(() => minimumActualSizeForComputedValueChunkClaims(0, 40, 2, 9,
      transportedContinuationSpanClaims([...stale, unrelated], final))).toThrow(/claimed by both/);
    expect(() => minimumActualSizeForComputedValueChunkClaims(0, 40, 2, 9,
      transportedContinuationSpanClaims(stale, [part(resourceA, 46), part(resourceB, 46)])))
      .toThrow(/claimed by both/);
  });

  it('moves an already materialized run into its reserved band exactly once', () => {
    const builder = fixture();
    materializeTransportedContinuations(builder, [2, 3, 4, 5, 6, 7], chunks);
    expect(builder.outputs.slice(2, 4)).toEqual([
      { to: Uint8Array.of(0x51), amount: 5000n }, { to: Uint8Array.of(0x51), amount: 5000n },
    ]);
    for (const chunk of chunks) {
      expect(builder.outputs[chunk.offset]).toMatchObject({
        to: chunk.lockingBytecode, amount: 5000n,
        token: { category: categoryId, nft: { commitment: chunk.commitment } },
      });
      expect(builder.outputs.filter((output) => output.to instanceof Uint8Array
        && binToHex(output.to) === binToHex(chunk.lockingBytecode)
        && output.token?.nft?.commitment === chunk.commitment)).toHaveLength(1);
    }
    const once = structuredClone(builder.outputs);
    materializeTransportedContinuations(builder, [2, 3, 4, 5, 6, 7], chunks);
    expect(builder.outputs).toEqual(once);
  });

  it.each(['category', 'lock', 'commitment', 'capability', 'amount', 'token input', 'other input', 'outside band'])(
    'preserves an output differing by %s', (difference) => {
      const builder = fixture();
      const output = builder.outputs[2];
      if (difference === 'category') output.token!.category = '82'.repeat(32);
      if (difference === 'lock') output.to = lock(0x53);
      if (difference === 'commitment') output.token!.nft!.commitment = '0000040506';
      if (difference === 'capability') output.token!.nft!.capability = 'none';
      if (difference === 'amount') output.token!.amount = 1n;
      if (difference === 'token input') builder.inputs[2].token = structuredClone(output.token);
      if (difference === 'other input') builder.inputs[2].unlocker = {
        ...builder.inputs[2].unlocker, generateLockingBytecode: () => Uint8Array.of(0x51),
      };
      const before = structuredClone(output);
      materializeTransportedContinuations(builder, difference === 'outside band' ? [3, 6, 7] : [2, 3, 6, 7], chunks);
      expect(builder.outputs[2]).toEqual(before);
      expect(builder.outputs[3].token).toBeUndefined();
    },
  );

  it('rejects an invalid destination before changing any output', () => {
    const builder = fixture();
    const before = structuredClone(builder.outputs);
    expect(() => materializeTransportedContinuations(builder, [2, 3, 6], chunks)).toThrow('balanced trailing slot');
    expect(builder.outputs).toEqual(before);
  });
});
