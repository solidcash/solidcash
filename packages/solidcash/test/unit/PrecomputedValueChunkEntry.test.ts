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
  register: (placement?: {
    valueChunkMints?: readonly { collection: string; slotIndex: number; slot: Uint8Array;
      value: Uint8Array; digest: Uint8Array; chunks: readonly Uint8Array[] }[];
    batchPredCommitments?: Map<string, string[]>;
  }) => void;
} {
  const entryRawCommitments = new Map<number, string>();
  const pinnedEntrySlots = new Set<number>();
  const entry = {
    collection: 'records', exists: true,
    utxo: { token: { nft: { commitment: commitment(oldValue) } } },
  };
  const entryNfts = [{ ...entry, slotIndex: 1 }, { ...entry, slotIndex: 4, ...overrides }];
  const builder = Object.assign(Object.create(StatefulTransactionBuilder.prototype), {
    categoryId: '12'.repeat(31) + 'ed',
    entryNfts, entryRawCommitments, pinnedEntrySlots, addValueChunkOutput: vi.fn(),
    loopEntryVars: [], loopEntryCommitments: new Map(),
    requiredLoopEntryCounts: new Map(), pinnedLoopEntries: new Set(),
  }) as StatefulTransactionBuilder;
  return {
    builder, entryRawCommitments, pinnedEntrySlots,
    register: (placement = {}) => registerCreateBuilderBuilderState({
      categoryId: '12'.repeat(31) + 'ed',
      // Continuation locks bind the owner's 35-byte master lock.
      inner: { artifact: { stateLayout: { collections: [{
        name: 'records', signature: 'records:mapping(uint256 => bytes)',
      }] } }, provider: { network: 'chipnet' }, addressType: 'p2sh32', lockingBytecode: `aa20${'5a'.repeat(32)}87` },
    }, {
      builder, oldDynamicChunkCommitments: new Map(), oldDynamicChunkCounts: new Map(),
      overrides: undefined,
      entryDeleteSlots: [], condSoftDeleteSlots: [], entryNfts, entryAbiFunction: undefined,
      batchTargetPlaceholders: new Map(), exactBatchTargetSlots: new Set(), sortedInserts: [],
      directCallDelegateLayout: undefined, activeDynamicWrites: new Set(),
      usesComposedDelegateDynamicTail: false, computedValueChunkRuns: [],
      entryArgs: [], pendingEntryValueTails: [],
      batchPredCommitments: placement.batchPredCommitments,
      valueChunkMints: placement.valueChunkMints ?? [{
        collection: 'records', slotIndex: 4, slot: key, value: newValue,
        digest: sha256(newValue), chunks: splitValueIntoValueChunks(newValue),
      }],
      maxBhLocktime: 0, functionName: 'record',
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
