import { binToHex } from '@bitauth/libauth';
import { encodeChunkableValueTail, sha256, splitValueIntoValueChunks } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';
import { encodeEntryCommitment } from '../../src/stateful/SortedList.js';
import { registerCreateBuilderBuilderState } from '../../src/stateful/sc-register-create-builder-builder-state.js';

const key = new Uint8Array(32).fill(0x31);
const successor = new Uint8Array(32).fill(0x52);
const oldValue = new Uint8Array(150).fill(0x21);
const newValue = new Uint8Array(290).fill(0x43);
const commitment = (value: Uint8Array, next = successor): string => binToHex(
  encodeEntryCommitment(key, next, encodeChunkableValueTail(value)),
);

// Exercise the real entry-completion method and registrar without transaction/funding setup.
function fixture(overrides: Record<string, unknown> = {}): {
  builder: StatefulTransactionBuilder;
  entryRawCommitments: Map<number, string>;
  pinnedEntrySlots: Set<number>;
  register: () => void;
} {
  const entryRawCommitments = new Map<number, string>();
  const pinnedEntrySlots = new Set<number>();
  const entry = {
    collection: 'records', exists: true,
    utxo: { token: { nft: { commitment: commitment(oldValue) } } },
  };
  const entryNfts = [{ ...entry, slotIndex: 1 }, { ...entry, slotIndex: 4, ...overrides }];
  const builder = Object.assign(Object.create(StatefulTransactionBuilder.prototype), {
    entryNfts, entryRawCommitments, pinnedEntrySlots, addValueChunkOutput: vi.fn(),
  }) as StatefulTransactionBuilder;
  return {
    builder, entryRawCommitments, pinnedEntrySlots,
    register: () => registerCreateBuilderBuilderState({
      categoryId: '12'.repeat(32),
      inner: { artifact: {}, provider: { network: 'chipnet' }, addressType: 'p2sh32' },
    }, {
      builder, oldDynamicChunkCommitments: new Map(), oldDynamicChunkCounts: new Map(),
      overrides: undefined, masterUtxo: { vout: 0 }, inactiveMessageBusEntrySlots: [],
      entryDeleteSlots: [], condSoftDeleteSlots: [], entryNfts, entryAbiFunction: undefined,
      batchTargetPlaceholders: new Map(), exactBatchTargetSlots: new Set(), sortedInserts: [],
      compilerRouteDelegateLayout: undefined, activeDynamicWrites: new Set(),
      usesComposedDelegateDynamicTail: false, computedValueChunkRuns: [],
      onChainState: {} as never, entryArgs: [], pendingEntryValueTails: [], transportedProductions: [],
      valueChunkMints: [{
        collection: 'records', slotIndex: 4, slot: key, value: newValue,
        digest: sha256(newValue), chunks: splitValueIntoValueChunks(newValue),
      }],
      maxBhLocktime: 0, functionName: '__message_bus1',
    }),
  };
}

describe('precomputed value-chunk entry commitments', () => {
  it('updates only the exact write lane, not an earlier read of the same key', () => {
    const { register, entryRawCommitments, pinnedEntrySlots } = fixture();
    register();
    expect([...entryRawCommitments]).toEqual([[4, commitment(newValue)]]);
    expect([...pinnedEntrySlots]).toEqual([4]);
  });

  it('retains an already planned successor link while replacing the value', () => {
    const { register, entryRawCommitments } = fixture();
    const next = new Uint8Array(32).fill(0x62);
    entryRawCommitments.set(4, commitment(oldValue, next));
    register();
    expect(entryRawCommitments.get(4)).toBe(commitment(newValue, next));
  });

  it.each([
    { name: 'different collection', overrides: { collection: 'other' } },
    { name: 'absent key', overrides: { exists: false } },
    { name: 'different key', overrides: {
      utxo: { token: { nft: { commitment: binToHex(encodeEntryCommitment(
        new Uint8Array(32).fill(0x44), successor, encodeChunkableValueTail(oldValue),
      )) } } },
    } },
  ])('does not complete a $name or fall back to the read lane', ({ overrides }) => {
    const { register, entryRawCommitments, pinnedEntrySlots } = fixture(overrides);
    register();
    expect(entryRawCommitments.size).toBe(0);
    expect(pinnedEntrySlots.size).toBe(0);
  });
});
