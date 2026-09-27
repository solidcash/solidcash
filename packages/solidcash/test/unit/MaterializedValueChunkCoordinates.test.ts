import { binToHex } from '@bitauth/libauth';
import { computeCollectionHash } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import type { ExternalCallUtxoGroup } from '../../src/stateful/external-call-utxo-group.js';
import {
  bindMaterializedValueChunkWitnesses,
  type BindMaterializedValueChunkWitnessesHost,
} from '../../src/stateful/stb-bind-materialized-value-chunk-witnesses.js';
import {
  valueChunkWriteResourceIdentity,
  type ValueChunkWriteDescriptor,
} from '../../src/stateful/value-chunk-persist.js';

const categoryId = '71'.repeat(32);
const lockingBytecode = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x42), 0x87]);

function fixture(blockBase: number, provisionalLocal: number, selectedLocal = 14): {
  host: BindMaterializedValueChunkWitnessesHost;
  builder: TransactionBuilder;
  group: ExternalCallUtxoGroup;
  refreshInternalArgs: ReturnType<typeof vi.fn>;
} {
  const write: ValueChunkWriteDescriptor = {
    categoryId,
    collection: 'records',
    collectionSignature: 'records:mapping(int => bytes[])',
    collectionHash: binToHex(computeCollectionHash('records:mapping(int => bytes[])')),
    keySlot: '63'.repeat(32),
    entryAccessSlot: 0,
    routeSlot: 0,
    operation: 'update',
    outputBase: blockBase + provisionalLocal,
    outputCount: 2,
  };
  const refreshInternalArgs = vi.fn();
  const group = {
    categoryId,
    stateLayout: { collections: [{ name: 'records', valueType: 'bytes[]', chunkableValue: true }] },
    compilerRoute: { abiFunction: {
      name: '__message_bus',
      inputs: [{ name: '__internal__valueChunkOutputBase', type: 'int' }],
      entryAccesses: [{ collection: 'records', operations: ['write'] }],
    } },
    blockLayout: { blockSize: 24, trailingBase: 8, trailingCapacity: 16, slots: [] },
    valueChunkWrites: [write],
    valueChunkOutputBase: write.outputBase,
    internalArgs: { __internal__valueChunkOutputBase: BigInt(write.outputBase) },
    refreshInternalArgs,
  } as unknown as ExternalCallUtxoGroup;
  const resourceIdentity = valueChunkWriteResourceIdentity(write);
  const chunks = ['0000abcd', '0100ef01'].map((commitment, index) => ({
    index: selectedLocal + index,
    chunk: { commitment, lockingBytecode, categoryId, resourceIdentity, resourcePart: `chunk:${index}` },
  }));
  const outputs = Array.from({ length: Math.max(24, selectedLocal + 2) }, () => ({
    to: Uint8Array.of(0x51), amount: 1200n,
  })) as TransactionBuilder['outputs'];
  for (const { index, chunk } of chunks) outputs[index] = {
    to: lockingBytecode, amount: 1200n,
    token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: chunk.commitment } },
  };
  const builder = { outputs } as TransactionBuilder;
  const host = {
    categoryId,
    externalCallUtxoGroups: [group],
    lowLevelCallUtxoGroups: [],
    derivedChunkOutputs: new Map(chunks.map(({ index, chunk }) => [index, chunk])),
    allInputs: [],
    messageBusConvention: 'kernel-row-loop' as const,
    syncRefreshedCarrierMasters: vi.fn(),
  };
  return { host, builder, group, refreshInternalArgs };
}

describe('materialized value-chunk coordinate frames', () => {
  it('does not reinterpret resource-owned local slots as transaction-wide indices', () => {
    const { host, builder, group, refreshInternalArgs } = fixture(40, 14);
    expect(bindMaterializedValueChunkWitnesses(host, builder, 40)).toBe(false);
    expect(group.valueChunkOutputBase).toBe(54);
    expect(group.internalArgs?.__internal__valueChunkOutputBase).toBe(54n);
    expect(refreshInternalArgs).not.toHaveBeenCalled();
  });

  it.each([4, 40])('resolves a moved run with participant base %s', (blockBase) => {
    const { host, builder, group, refreshInternalArgs } = fixture(blockBase, 16);
    expect(bindMaterializedValueChunkWitnesses(host, builder, blockBase)).toBe(true);
    expect(group.valueChunkOutputBase).toBe(blockBase + 14);
    expect(group.internalArgs?.__internal__valueChunkOutputBase).toBe(BigInt(blockBase + 14));
    expect(refreshInternalArgs).toHaveBeenCalledWith(
      { __internal__valueChunkOutputBase: BigInt(blockBase + 14) },
      expect.objectContaining({ shiftPredOut: false }),
    );
    expect(host.syncRefreshedCarrierMasters).toHaveBeenCalledWith(builder, new Set([group]));
  });

  it('keeps transaction-wide builders in the zero-base coordinate frame', () => {
    const { host, builder, group } = fixture(0, 16);
    expect(bindMaterializedValueChunkWitnesses(host, builder)).toBe(true);
    expect(group.valueChunkOutputBase).toBe(14);
  });

  it('rejects a materialized run outside the published participant block', () => {
    const { host, builder } = fixture(40, 16, 24);
    expect(() => bindMaterializedValueChunkWitnesses(host, builder, 40))
      .toThrow(/value-chunk-band-in-block/);
  });

  it('rejects a run whose first chunk fits but whose full width exceeds capacity', () => {
    const { host, builder } = fixture(40, 16, 23);
    expect(() => bindMaterializedValueChunkWitnesses(host, builder, 40))
      .toThrow(/value-chunk-capacity/);
  });

  it('binds the matched resource width instead of another write\'s aggregate estimate', () => {
    const { host, builder, group, refreshInternalArgs } = fixture(40, 16, 22);
    const actual = group.valueChunkWrites![0];
    group.valueChunkWrites = [{ ...actual, collection: 'profiles', collectionHash: '99'.repeat(20),
      collectionSignature: 'profiles:mapping(int => Profile)', outputCount: 3 }, actual];
    expect(bindMaterializedValueChunkWitnesses(host, builder, 40)).toBe(true);
    expect(refreshInternalArgs).toHaveBeenCalledWith(
      { __internal__valueChunkOutputBase: 62n },
      expect.objectContaining({ resolveAuthority: expect.objectContaining({
        valueChunkCollection: 'records', valueChunkCount: 2,
      }) }),
    );
  });
});
