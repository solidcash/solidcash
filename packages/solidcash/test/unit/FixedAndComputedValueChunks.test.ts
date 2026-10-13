import { binToHex, hexToBin } from '@bitauth/libauth';
import { computeCollectionHash } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import type { Output } from '../../src/interfaces.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import {
  appendValueChunks, type MaterializeValueAndDynamicChunksHost,
} from '../../src/stateful/stb-materialize-value-and-dynamic-chunks.js';
import { getValueChunkLockingBytecode } from '../../src/stateful/covenant-helpers.js';
import { buildTransportedContinuationResourceClaim } from '../../src/stateful/ValueChunkProducerIdentity.js';
import { valueChunkWriteResourceIdentity, type ValueChunkWriteDescriptor } from '../../src/stateful/value-chunk-persist.js';
import type { ExternalCallUtxoGroup } from '../../src/stateful/external-call-utxo-group.js';
import {
  reassertStagedValueChunkOutputs, type ReverseSuffixValueChunkHost,
} from '../../src/stateful/stb-reverse-suffix-value-chunks.js';

const categoryId = '71'.repeat(32);
const lock = (byte: number): Uint8Array => Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(byte), 0x87]);
const commitment = '0000010203';

function fixture(fixedLock: Uint8Array, fixedCategory = categoryId): {
  host: MaterializeValueAndDynamicChunksHost; builder: TransactionBuilder; outputs: Output[];
} {
  const outputs: Output[] = [];
  const builder = { outputs, addOutput: (output: Output) => { outputs.push(output); } } as TransactionBuilder;
  const host = {
    categoryId, valueChunkOutputs: [],
    externalCallUtxoGroups: [], lowLevelCallUtxoGroups: [],
    derivedChunkOutputs: new Map([[4, {
      fixedIndex: true, commitment, lockingBytecode: fixedLock, categoryId: fixedCategory,
    }]]),
    getChunkableValueWriteBand: () => ({ start: 4, end: 4, nNew: 1 }),
    getValueChunkVars: () => [{ id: 'records#0', lockingBytecode: lock(0x31) }],
    valueChunkRawCommitments: new Map([['records#0', [commitment]]]),
  } as unknown as MaterializeValueAndDynamicChunksHost;
  return { host, builder, outputs };
}

describe('fixed and computed continuation families', () => {
  it('keeps a computed resource when another resource has fixed pins', () => {
    const { host, builder, outputs } = fixture(lock(0x42));
    appendValueChunks(host, builder);
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({ to: lock(0x31), token: { category: categoryId } });
  });

  it('does not deduplicate another state owner with the same locking bytecode', () => {
    const { host, builder, outputs } = fixture(lock(0x31), '82'.repeat(32));
    appendValueChunks(host, builder);
    expect(outputs).toHaveLength(1);
  });

  it('does not append a duplicate of a fixed continuation', () => {
    const { host, builder, outputs } = fixture(lock(0x31));
    appendValueChunks(host, builder);
    expect(outputs).toHaveLength(0);
  });

  it('retains an unpinned chunk of the same resource', () => {
    const { host, builder, outputs } = fixture(lock(0x31));
    host.valueChunkRawCommitments = new Map([['records#0', [commitment, '0100040506']]]);
    appendValueChunks(host, builder);
    expect(outputs).toHaveLength(1);
    expect(outputs[0].token?.nft?.commitment).toBe('0100040506');
  });

  it('keeps an unrelated staged resource while excluding an exact pinned duplicate', () => {
    const { host, builder, outputs } = fixture(lock(0x42));
    Object.assign(host, {
      getValueChunkVars: () => [],
      valueChunkOutputs: [lock(0x42), lock(0x53)].map((to) => ({
        to, amount: 1200n,
        token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment } },
      })),
    });
    appendValueChunks(host, builder);
    expect(outputs).toHaveLength(1);
    expect(outputs[0].to).toEqual(lock(0x53));
  });

  it('suppresses an exact sparse fixed continuation outside the scalar band and rejects contradictory pins', () => {
    const { host, builder, outputs } = fixture(lock(0x42));
    const collection = 'records';
    const collectionSignature = `${collection}:mapping(uint256 => bytes)`;
    const keySlot = '34'.repeat(32);
    const digest = 'ab'.repeat(32);
    const write: ValueChunkWriteDescriptor = {
      categoryId, collection, collectionSignature,
      collectionHash: binToHex(computeCollectionHash(collectionSignature)), keySlot,
      entryAccessSlot: 0, routeSlot: 0, operation: 'update', outputBase: 8, outputCount: 1,
    };
    const resourceA = valueChunkWriteResourceIdentity(write);
    const resourceB = `${categoryId}:${'56'.repeat(20)}:${'78'.repeat(32)}`;
    const owner = { categoryId, lockingBytecode: `aa20${'51'.repeat(32)}87` };
    // The claim's state owner holds the minting baton, so its chunks bind the owner's lock.
    const aLock = getValueChunkLockingBytecode(
      categoryId, collection, hexToBin(keySlot), hexToBin(digest), hexToBin(owner.lockingBytecode),
    );
    const producerClaim = { resourceIdentity: resourceA, producer: {
      version: 1 as const, stateOwner: owner,
      sourcePath: [{ sourceEffectDomainId: '91'.repeat(32), sourceCallsiteId: 3,
        sourceLogicalIndex: 1, occurrenceIndex: 0, sourceEffectOrdinal: 4 }],
      mutationEffectDomainId: '91'.repeat(32), mutationSourceEffectOrdinal: 7,
    } };
    const claim = buildTransportedContinuationResourceClaim({
      owner, collectionSignature, collectionHash: write.collectionHash,
      keySlot, digest, chunkCount: 1, bandOffset: 8, producerClaim,
    });
    expect(claim).toBeDefined();
    const carrier = {
      transportedValueChunkProductions: true,
      continuationResourceClaims: [claim], valueChunkWrites: [write],
    } as unknown as ExternalCallUtxoGroup;
    const fixedA = {
      fixedIndex: true, semanticKind: 'valueChunk' as const,
      categoryId, lockingBytecode: aLock, commitment,
      resourceIdentity: resourceA, resourcePart: 'chunk:0',
    };
    Object.assign(host, {
      blockLayout: { blockSize: 10, trailingBase: 4, trailingCapacity: 6,
        slots: Array.from({ length: 6 }, (_, index) => ({ kind: 'trailing', offset: 4 + index })) },
      externalCallUtxoGroups: [carrier], lowLevelCallUtxoGroups: [],
      derivedChunkOutputs: new Map([
        [4, { ...fixedA, lockingBytecode: lock(0x42), resourceIdentity: resourceB }],
        [8, fixedA],
      ]),
      getValueChunkVars: () => [],
      valueChunkOutputs: [{ to: fixedA.lockingBytecode, amount: 1200n,
        token: { category: categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment } } }],
    });
    outputs.push(...Array.from({ length: 8 }, () => ({ to: Uint8Array.of(0x51), amount: 1000n })));
    outputs.push({ to: fixedA.lockingBytecode, amount: 1200n,
      token: { category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment } } });
    appendValueChunks(host, builder);
    expect(outputs).toHaveLength(9);
    expect(reassertStagedValueChunkOutputs(host as unknown as ReverseSuffixValueChunkHost, builder)).toBe(0);
    expect(reassertStagedValueChunkOutputs(host as unknown as ReverseSuffixValueChunkHost, builder)).toBe(0);
    expect(outputs).toHaveLength(9);

    Object.assign(host, {
      derivedChunkOutputs: new Map([
        [4, { ...fixedA, lockingBytecode: lock(0x42), resourceIdentity: resourceB }],
        [8, fixedA],
        [9, { ...fixedA, commitment: '0000ffff' }],
      ]),
    });
    expect(() => appendValueChunks(host, builder)).toThrow(/conflicting fixed continuation/);
    expect(outputs).toHaveLength(9);

    Object.assign(host, { derivedChunkOutputs: new Map([
      [4, { ...fixedA, lockingBytecode: lock(0x42), resourceIdentity: resourceB }],
    ]) });
    appendValueChunks(host, builder);
    expect(outputs).toHaveLength(10); // An incomplete pin cannot suppress a staged output.

    Object.assign(host, { derivedChunkOutputs: new Map([
      [4, { ...fixedA, lockingBytecode: lock(0x42), resourceIdentity: resourceB }],
      [8, { ...fixedA, resourceIdentity: resourceB, resourcePart: 'chunk:1' }],
    ]) });
    appendValueChunks(host, builder);
    expect(outputs).toHaveLength(11); // An unrelated provisional pin cannot authenticate A's claimed lane.

    Object.assign(host, {
      derivedChunkOutputs: new Map([
        [4, { ...fixedA, lockingBytecode: lock(0x42), resourceIdentity: resourceB }],
        [8, fixedA],
      ]),
      valueChunkOutputs: [host.valueChunkOutputs[0], host.valueChunkOutputs[0]],
    });
    expect(() => appendValueChunks(host, builder)).toThrow(/duplicate staged continuations/);
    expect(outputs).toHaveLength(11);

    const otherWrite: ValueChunkWriteDescriptor = { ...write, keySlot: '35'.repeat(32) };
    const otherResource = valueChunkWriteResourceIdentity(otherWrite);
    const conflictingClaim = buildTransportedContinuationResourceClaim({
      owner, collectionSignature, collectionHash: write.collectionHash,
      keySlot: otherWrite.keySlot, digest, chunkCount: 1, bandOffset: 8,
      producerClaim: { ...producerClaim, resourceIdentity: otherResource },
    });
    expect(conflictingClaim).toBeDefined();
    Object.assign(host, {
      externalCallUtxoGroups: [carrier, {
        ...carrier, continuationResourceClaims: [conflictingClaim], valueChunkWrites: [otherWrite],
      }],
      valueChunkOutputs: [host.valueChunkOutputs[0]],
    });
    expect(() => appendValueChunks(host, builder)).toThrow(/overlapping fixed continuation claims/);
  });
});
