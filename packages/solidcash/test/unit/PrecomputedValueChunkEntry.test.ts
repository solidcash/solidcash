import { binToHex } from '@bitauth/libauth';
import { computeCollectionHash, encodeChunkableValueTail, sha256, splitValueIntoValueChunks } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';
import { encodeEntryCommitment } from '../../src/stateful/SortedList.js';
import { registerCreateBuilderBuilderState } from '../../src/stateful/sc-register-create-builder-builder-state.js';
import type { DerivedChunkOutputObservation, ValueChunkWriteDescriptor } from '../../src/stateful/value-chunk-persist.js';

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
    transportedProductions?: readonly unknown[];
    batchPredCommitments?: Map<string, string[]>;
    effectiveBlockLayout?: unknown;
    blockBase?: number;
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
    categoryId: '12'.repeat(32),
    entryNfts, entryRawCommitments, pinnedEntrySlots, addValueChunkOutput: vi.fn(),
    loopEntryVars: [], loopEntryCommitments: new Map(),
    requiredLoopEntryCounts: new Map(), pinnedLoopEntries: new Set(),
  }) as StatefulTransactionBuilder;
  return {
    builder, entryRawCommitments, pinnedEntrySlots,
    register: (placement = {}) => registerCreateBuilderBuilderState({
      categoryId: '12'.repeat(32),
      // Continuation locks bind the owner's 35-byte master lock.
      inner: { artifact: { stateLayout: { collections: [{
        name: 'records', signature: 'records:mapping(uint256 => bytes)',
      }] } }, provider: { network: 'chipnet' }, addressType: 'p2sh32', lockingBytecode: `aa20${'5a'.repeat(32)}87` },
    }, {
      builder, oldDynamicChunkCommitments: new Map(), oldDynamicChunkCounts: new Map(),
      overrides: placement.blockBase === undefined ? undefined : { blockBase: placement.blockBase },
      masterUtxo: { vout: 0 }, inactiveMessageBusEntrySlots: [],
      entryDeleteSlots: [], condSoftDeleteSlots: [], entryNfts, entryAbiFunction: undefined,
      batchTargetPlaceholders: new Map(), exactBatchTargetSlots: new Set(), sortedInserts: [],
      compilerRouteDelegateLayout: undefined, activeDynamicWrites: new Set(),
      usesComposedDelegateDynamicTail: false, computedValueChunkRuns: [],
      onChainState: {} as never, entryArgs: [], pendingEntryValueTails: [],
      transportedProductions: placement.transportedProductions ?? [],
      batchPredCommitments: placement.batchPredCommitments,
      valueChunkMints: placement.valueChunkMints ?? [{
        collection: 'records', slotIndex: 4, slot: key, value: newValue,
        digest: sha256(newValue), chunks: splitValueIntoValueChunks(newValue),
      }],
      maxBhLocktime: 0, functionName: '__message_bus1',
      effectiveBlockLayout: placement.effectiveBlockLayout,
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

  it('pins mixed-order transported mints at sparse authenticated lanes and keeps unrelated mints outside them', () => {
    const { builder, register } = fixture();
    const categoryId = '12'.repeat(32);
    const collection = 'records';
    const collectionSignature = 'records:mapping(uint256 => bytes)';
    const collectionHash = binToHex(computeCollectionHash(collectionSignature));
    const slotA = key;
    const slotB = new Uint8Array(32).fill(0x32);
    const slotC = new Uint8Array(32).fill(0x33);
    const terminalA = new Uint8Array(260).fill(0x43);
    const terminalB = new Uint8Array(150).fill(0x77);
    const provisionalB = new Uint8Array(150).fill(0x22);
    const unrelatedC = new Uint8Array(150).fill(0x66);
    const mint = (slot: Uint8Array, value: Uint8Array): {
      collection: string; slotIndex: number; slot: Uint8Array; value: Uint8Array;
      digest: Uint8Array; chunks: Uint8Array[];
    } => ({
      collection, slotIndex: 4, slot, value, digest: sha256(value),
      chunks: splitValueIntoValueChunks(value),
    });
    const write = (slot: Uint8Array, localBase: number, count: number): ValueChunkWriteDescriptor => ({
      categoryId, collection, collectionSignature, collectionHash,
      keySlot: binToHex(slot), entryAccessSlot: 0, routeSlot: 4,
      operation: 'update', outputBase: 3000 + localBase, outputCount: count,
    });
    const pins = new Map<number, DerivedChunkOutputObservation>();
    Object.assign(builder, {
      composedParticipant: true, composedBlockBase: 3000,
      getDerivedChunkOutputs: () => pins,
      setDerivedChunkOutput: vi.fn((offset: number, chunk: DerivedChunkOutputObservation) => {
        if (pins.has(offset)) return false;
        pins.set(offset, chunk);
        return true;
      }),
    });
    const placement = {
      blockBase: 3000,
      effectiveBlockLayout: { blockSize: 10, trailingBase: 4, trailingCapacity: 6,
        slots: Array.from({ length: 6 }, (_, index) => ({ kind: 'trailing', offset: 4 + index })) },
      // Source traversal is A, unrelated C, B; graph placement is B5, gap6–7, A8–9.
      valueChunkMints: [mint(slotA, terminalA), mint(slotC, unrelatedC), mint(slotB, provisionalB)],
      transportedProductions: [
        { write: write(slotB, 5, 1), value: terminalB },
        { write: write(slotA, 8, 2), value: terminalA },
      ],
    };
    register(placement);
    expect([...pins.keys()].sort((left, right) => left - right)).toEqual([5, 6, 8, 9]);
    expect(pins.get(5)).toMatchObject({
      commitment: `0000${binToHex(splitValueIntoValueChunks(terminalB)[0]!)}`,
      resourcePart: 'chunk:0',
    });
    expect(pins.get(8)).toMatchObject({ resourcePart: 'chunk:0' });
    expect(pins.get(9)).toMatchObject({ resourcePart: 'chunk:1' });
    expect(pins.get(6)?.resourceIdentity).not.toBe(pins.get(5)?.resourceIdentity);
    expect(pins.get(6)?.resourceIdentity).not.toBe(pins.get(8)?.resourceIdentity);
    expect(builder.addValueChunkOutput).not.toHaveBeenCalled();
    pins.set(5, { ...pins.get(5)!, commitment: '0000ffff' });
    expect(() => register(placement)).toThrow(/conflicting fixed continuation pin/);
  });

  it('keeps unmatched value mints out of a planned trailing predecessor output', () => {
    const { builder, register } = fixture();
    const categoryId = '12'.repeat(32);
    const collectionSignature = 'records:mapping(uint256 => bytes)';
    const slotB = new Uint8Array(32).fill(0x32);
    const transportedValue = new Uint8Array(260).fill(0x44);
    const unrelatedValue = new Uint8Array(40).fill(0x55);
    const mint = (slot: Uint8Array, value: Uint8Array): {
      collection: string; slotIndex: number; slot: Uint8Array; value: Uint8Array;
      digest: Uint8Array; chunks: Uint8Array[];
    } => ({
      collection: 'records', slotIndex: 4, slot, value,
      digest: sha256(value), chunks: splitValueIntoValueChunks(value),
    });
    const pins = new Map<number, DerivedChunkOutputObservation>([
      [6, { commitment: '0000aa', lockingBytecode: new Uint8Array([0x51]), categoryId, fixedIndex: true }],
      [7, { commitment: '0000bb', lockingBytecode: new Uint8Array([0x51]), categoryId, fixedIndex: true }],
    ]);
    Object.assign(builder, {
      composedParticipant: true, composedBlockBase: 3000,
      loopEntryVars: [{ collection: 'predecessors', lockingBytecode: new Uint8Array([0x51]), categoryId }],
      getLoopEntryOutputIndex: (collection: string, ordinal: number) => {
        expect([collection, ordinal]).toEqual(['predecessors', 0]);
        return 4;
      },
      getDerivedChunkOutputs: () => pins,
      setDerivedChunkOutput: vi.fn((offset: number, chunk: DerivedChunkOutputObservation) => {
        if (pins.has(offset)) return false;
        pins.set(offset, chunk);
        return true;
      }),
    });
    register({
      blockBase: 3000,
      effectiveBlockLayout: { blockSize: 10, trailingBase: 4, trailingCapacity: 6,
        slots: Array.from({ length: 6 }, (_, index) => ({ kind: 'trailing', offset: 4 + index })) },
      batchPredCommitments: new Map([['predecessors', ['aa']]]),
      valueChunkMints: [mint(key, transportedValue), mint(slotB, unrelatedValue)],
      transportedProductions: [{
        write: {
          categoryId, collection: 'records', collectionSignature,
          collectionHash: binToHex(computeCollectionHash(collectionSignature)),
          keySlot: binToHex(key), entryAccessSlot: 0, routeSlot: 4,
          operation: 'update', outputBase: 3008, outputCount: 2,
        } satisfies ValueChunkWriteDescriptor,
        value: transportedValue,
      }],
    });
    expect(builder.getLoopEntryCommitments('predecessors')).toEqual(['aa']);
    expect([...pins.keys()].sort((left, right) => left - right)).toEqual([5, 6, 7, 8, 9]);
    expect(builder.addValueChunkOutput).not.toHaveBeenCalled();
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
