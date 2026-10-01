import { binToHex } from '@bitauth/libauth';
import { computeCollectionHash } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import type { ExternalCallUtxoGroup } from '../../src/stateful/external-call-utxo-group.js';
import type { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';
import { authenticatedTransportedValueChunkWrite } from '../../src/stateful/sc-apply-create-builder-transported-productions.js';
import {
  prepareDeriveFullValueChunkWrites,
  preserveTransportedValueChunkWriteGeometry,
} from '../../src/stateful/sc-prepare-derive-full-value-chunk-writes.js';
import {
  bindMaterializedValueChunkWitnesses,
  type BindMaterializedValueChunkWitnessesHost,
} from '../../src/stateful/stb-bind-materialized-value-chunk-witnesses.js';
import {
  valueChunkWriteResourceIdentity,
  type ValueChunkWriteDescriptor,
} from '../../src/stateful/value-chunk-persist.js';
import { describeValueChunkWrites } from '../../src/stateful/writer-group-selection.js';

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

  it('does not globally rebase unrelated writes from one identified run', () => {
    const { host, builder, group } = fixture(40, 16, 14);
    const first = group.valueChunkWrites![0]!;
    const second: ValueChunkWriteDescriptor = {
      ...first,
      collection: 'profiles',
      collectionSignature: 'profiles:mapping(int => bytes[])',
      collectionHash: binToHex(computeCollectionHash('profiles:mapping(int => bytes[])')),
      keySlot: '64'.repeat(32),
      outputBase: 58,
    };
    group.valueChunkWrites = [first, second];

    expect(bindMaterializedValueChunkWitnesses(host, builder, 40)).toBe(true);
    expect(group.valueChunkWrites?.map((write) => write.outputBase)).toEqual([54, 58]);
  });

  it('replaces an aggregate route estimate with its authenticated production lane', () => {
    const { group } = fixture(40, 14);
    const existing = { ...group.valueChunkWrites![0]!, outputBase: 54, outputCount: 5 };
    const exact = { ...existing, outputBase: 58, outputCount: 4 };
    const unrelated = {
      ...existing, keySlot: '64'.repeat(32), outputBase: 61, outputCount: 2,
    };
    const writes = new Map([
      [valueChunkWriteResourceIdentity(existing), existing],
      [valueChunkWriteResourceIdentity(unrelated), unrelated],
    ]);
    writes.set(valueChunkWriteResourceIdentity(exact), authenticatedTransportedValueChunkWrite(
      writes.get(valueChunkWriteResourceIdentity(exact)), exact,
    ));
    expect([...writes.values()]).toEqual([exact, unrelated]);
    expect(() => authenticatedTransportedValueChunkWrite(
      { ...existing, routeSlot: 2 }, exact,
    )).toThrow(/disagrees with its final routed write shape/);
  });

  it('preserves authenticated B1/A4 geometry before carrier materialization', () => {
    const { group } = fixture(40, 14);
    const first = { ...group.valueChunkWrites![0]!, outputCount: 1 };
    const second: ValueChunkWriteDescriptor = {
      ...first,
      collection: 'profiles',
      collectionSignature: 'profiles:mapping(int => bytes[])',
      collectionHash: binToHex(computeCollectionHash('profiles:mapping(int => bytes[])')),
      keySlot: '64'.repeat(32),
      outputBase: 58,
      outputCount: 4,
    };
    group.valueChunkWrites = [first, second];
    group.valueChunkOutputCount = 5;
    group.transportedValueChunkProductions = true;
    group.continuationResourceClaims = [first, second].map((write) => ({
      bandOffset: write.outputBase - 40,
      chunkCount: write.outputCount,
      producerClaim: { resourceIdentity: valueChunkWriteResourceIdentity(write) },
    })) as ExternalCallUtxoGroup['continuationResourceClaims'];
    const aggregate = [first, second].map((write) => ({
      ...write, outputBase: 54, outputCount: 5,
    }));

    expect(preserveTransportedValueChunkWriteGeometry(group, aggregate)).toEqual([first, second]);
    expect(() => preserveTransportedValueChunkWriteGeometry({
      ...group, valueChunkWrites: aggregate,
    }, aggregate)).toThrow(/lost its exact write geometry/);
  });

  it('rejects a described transported lane with a changed mutation shape', () => {
    const { group } = fixture(40, 14);
    const exact = group.valueChunkWrites![0]!;
    group.transportedValueChunkProductions = true;
    group.continuationResourceClaims = [{
      bandOffset: 14,
      chunkCount: exact.outputCount,
      producerClaim: { resourceIdentity: valueChunkWriteResourceIdentity(exact) },
    }] as ExternalCallUtxoGroup['continuationResourceClaims'];
    const aggregate = { ...exact, outputBase: 54, outputCount: 5 };
    for (const changed of [
      { ...aggregate, entryAccessSlot: 1 },
    ]) {
      expect(() => preserveTransportedValueChunkWriteGeometry(group, [changed]))
        .toThrow(/changed its routed write shape/);
    }
    expect(() => preserveTransportedValueChunkWriteGeometry(group, [aggregate, aggregate]))
      .toThrow(/changed its routed write shape/);
  });

  it('keeps an authenticated insert when provisional ABI discovery reports update', () => {
    const { group } = fixture(40, 14);
    const exact = { ...group.valueChunkWrites![0]!, operation: 'insert' as const };
    group.valueChunkWrites = [exact];
    group.transportedValueChunkProductions = true;
    group.continuationResourceClaims = [{
      bandOffset: 14,
      chunkCount: exact.outputCount,
      producerClaim: { resourceIdentity: valueChunkWriteResourceIdentity(exact) },
    }] as ExternalCallUtxoGroup['continuationResourceClaims'];
    const provisional = { ...exact, operation: 'update' as const, outputCount: 5 };

    expect(preserveTransportedValueChunkWriteGeometry(group, [provisional])).toEqual([exact]);
  });

  it('keeps the authenticated source route when batching remaps its physical slot', () => {
    const { group } = fixture(40, 14);
    const exact = group.valueChunkWrites![0]!;
    group.transportedValueChunkProductions = true;
    group.continuationResourceClaims = [{
      bandOffset: 14,
      chunkCount: exact.outputCount,
      producerClaim: { resourceIdentity: valueChunkWriteResourceIdentity(exact) },
    }] as ExternalCallUtxoGroup['continuationResourceClaims'];
    const described = { ...exact, routeSlot: 1, outputCount: 5 };

    expect(preserveTransportedValueChunkWriteGeometry(group, [described])).toEqual([exact]);
  });

  it('keeps transported lanes through the derivation descriptor refresh', () => {
    const { group } = fixture(40, 14);
    const first = { ...group.valueChunkWrites![0]!, outputCount: 1 };
    const second: ValueChunkWriteDescriptor = {
      ...first,
      collection: 'profiles',
      collectionSignature: 'profiles:mapping(int => bytes[])',
      collectionHash: binToHex(computeCollectionHash('profiles:mapping(int => bytes[])')),
      keySlot: '64'.repeat(32),
      entryAccessSlot: 1,
      routeSlot: 1,
      outputBase: 58,
      outputCount: 4,
    };
    group.valueChunkWrites = [first, second];
    group.valueChunkOutputCount = 5;
    group.transportedValueChunkProductions = true;
    group.valueChunkProducerClaims = [first, second].map((write) => ({
      resourceIdentity: valueChunkWriteResourceIdentity(write),
    })) as ExternalCallUtxoGroup['valueChunkProducerClaims'];
    group.continuationResourceClaims = [first, second].map((write) => ({
      bandOffset: write.outputBase - 40,
      chunkCount: write.outputCount,
      producerClaim: { resourceIdentity: valueChunkWriteResourceIdentity(write) },
    })) as ExternalCallUtxoGroup['continuationResourceClaims'];
    group.stateLayout.collections = [
      { name: 'records', signature: first.collectionSignature, valueType: 'bytes[]', chunkableValue: true },
      { name: 'profiles', signature: second.collectionSignature, valueType: 'bytes[]', chunkableValue: true },
    ] as ExternalCallUtxoGroup['stateLayout']['collections'];
    group.blockLayout!.slots = [
      { kind: 'entry', slotIndex: 0, offset: 2 },
      { kind: 'entry', slotIndex: 1, offset: 3 },
    ] as ExternalCallUtxoGroup['blockLayout']['slots'];
    group.compilerRoute!.abiFunction.entryAccesses = [
      { collection: 'records', slotIndex: 0, operations: ['write'] },
      { collection: 'profiles', slotIndex: 1, operations: ['write'] },
    ];
    const stb = {
      getExternalCallUtxoGroups: () => [group],
      getLowLevelCallUtxoGroups: () => [],
    } as unknown as StatefulTransactionBuilder;

    expect(describeValueChunkWrites(group).map((write) => write.outputCount)).toEqual([5, 5]);
    expect(prepareDeriveFullValueChunkWrites(stb).valueChunkWrites).toEqual([first, second]);
    expect(group.valueChunkWrites).toEqual([first, second]);
  });

  it('reconstructs sparse B1/A4 lanes from aggregate carrier descriptors', () => {
    const { host, builder, group, refreshInternalArgs } = fixture(40, 16, 14);
    const first = { ...group.valueChunkWrites![0]!, outputCount: 5 };
    const firstResource = valueChunkWriteResourceIdentity(first);
    const second: ValueChunkWriteDescriptor = {
      ...first,
      collection: 'profiles',
      collectionSignature: 'profiles:mapping(int => bytes[])',
      collectionHash: binToHex(computeCollectionHash('profiles:mapping(int => bytes[])')),
      keySlot: '64'.repeat(32),
    };
    const secondResource = valueChunkWriteResourceIdentity(second);
    group.valueChunkWrites = [first, second];
    host.derivedChunkOutputs.delete(15);
    builder.outputs[15] = { to: Uint8Array.of(0x51), amount: 1200n };
    group.continuationResourceClaims = [{
      bandOffset: 14, chunkCount: 1, producerClaim: { resourceIdentity: firstResource },
    }, {
      bandOffset: 18, chunkCount: 4, producerClaim: { resourceIdentity: secondResource },
    }] as ExternalCallUtxoGroup['continuationResourceClaims'];
    for (const [index, commitment] of ['0000cafe', '0100beef', '0200beef', '0300beef'].entries()) {
      builder.outputs[18 + index] = {
        to: lockingBytecode, amount: 1200n,
        token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment } },
      };
      host.derivedChunkOutputs.set(18 + index, {
        commitment, lockingBytecode, categoryId, resourceIdentity: secondResource,
        resourcePart: `chunk:${index}`,
      });
    }

    expect(bindMaterializedValueChunkWitnesses(host, builder, 40)).toBe(true);
    expect(group.valueChunkOutputBase).toBe(54);
    expect(group.valueChunkWrites?.map((write) => write.outputBase)).toEqual([54, 58]);
    expect(group.valueChunkWrites?.map((write) => write.outputCount)).toEqual([1, 4]);
    expect(group.continuationResourceClaims?.map((claim) => claim.bandOffset)).toEqual([14, 18]);
    expect(refreshInternalArgs).toHaveBeenCalledWith(
      { __internal__valueChunkOutputBase: 54n },
      expect.objectContaining({ shiftPredOut: false }),
    );
  });
});
