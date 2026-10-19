import { describe, expect, it, vi } from 'vitest';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import type { ExternalCallUtxoGroup } from '../../src/stateful/external-call-utxo-group.js';
import {
  rebindLateValueSuffixAfterInsertion, type LateValueSuffixRebindHost,
} from '../../src/stateful/stb-late-value-suffix-rebind.js';
import type { ValueChunkWriteDescriptor } from '../../src/stateful/value-chunk-persist.js';

const categoryId = '71'.repeat(31) + '8e';

function fixture(): {
  host: LateValueSuffixRebindHost;
  carrier: ExternalCallUtxoGroup;
  builder: TransactionBuilder;
  refresh: ReturnType<typeof vi.fn>;
} {
  const write = (outputBase: number, keySlot: string): ValueChunkWriteDescriptor => ({
    categoryId,
    collection: 'records',
    collectionSignature: 'records:mapping(int => bytes[])',
    collectionHash: '42'.repeat(20),
    keySlot,
    entryAccessSlot: 0,
    routeSlot: 0,
    operation: 'update',
    outputBase,
    outputCount: 2,
  });
  const refresh = vi.fn();
  const carrier = {
    categoryId,
    internalArgNames: ['__internal__valueChunkOutputBase'],
    valueChunkOutputBase: 5,
    valueChunkWrites: [write(5, '11'.repeat(32)), write(10, '22'.repeat(32))],
    continuationResourceClaims: [{ bandOffset: 5, chunkCount: 2 }, { bandOffset: 10, chunkCount: 2 }],
    internalArgs: { __internal__valueChunkOutputBase: 5n },
    refreshInternalArgs: refresh,
  } as unknown as ExternalCallUtxoGroup;
  const host: LateValueSuffixRebindHost = {
    categoryId,
    derivedChunkOutputs: new Map(),
    externalCallEntryOutputsByIndex: new Map(),
    builtReturnEventOutputIndices: new Map(),
    externalCallUtxoGroups: [carrier],
    lowLevelCallUtxoGroups: [],
    getBuiltExternalCallReturnEventOutputIndex: () => -1,
    syncRefreshedCarrierMasters: vi.fn(),
  };
  const builder = { outputs: [] } as unknown as TransactionBuilder;
  return { host, carrier, builder, refresh };
}

describe('sparse continuation suffix rebinding', () => {
  it('shifts both lanes when an output is inserted before the first continuation', () => {
    const { host, carrier, builder, refresh } = fixture();
    rebindLateValueSuffixAfterInsertion(host, builder, 3);
    expect(carrier.valueChunkOutputBase).toBe(6);
    expect(carrier.valueChunkWrites?.map((write) => write.outputBase)).toEqual([6, 11]);
    expect(carrier.continuationResourceClaims?.map((claim) => claim.bandOffset)).toEqual([6, 11]);
    expect(refresh).toHaveBeenCalledWith(
      { __internal__valueChunkOutputBase: 6n },
      expect.objectContaining({ shiftPredOut: false }),
    );
  });

  it('shifts only the later lane when insertion falls in a sparse gap', () => {
    const { host, carrier, builder, refresh } = fixture();
    rebindLateValueSuffixAfterInsertion(host, builder, 8);
    expect(carrier.valueChunkOutputBase).toBe(5);
    expect(carrier.valueChunkWrites?.map((write) => write.outputBase)).toEqual([5, 11]);
    expect(carrier.continuationResourceClaims?.map((claim) => claim.bandOffset)).toEqual([5, 11]);
    expect(refresh).not.toHaveBeenCalled();
  });
});
