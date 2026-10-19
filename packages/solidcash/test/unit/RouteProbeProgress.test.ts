import { binToHex } from '@bitauth/libauth';
import { computeCollectionHash } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  progressiveRouteProbePassLimit,
  permitsRouteValueChunkDerivation,
  recordRouteProbeObservation,
  routeProbeEntrySlotOffsetForOutput,
  routeProbeRepairableEntryCoordinateCount,
  routeValueRunFingerprint,
} from '../../src/stateful/StatefulContract.js';
import {
  valueChunkWriteResourceIdentity,
  type ValueChunkWriteDescriptor,
} from '../../src/stateful/StatefulTransactionBuilder.js';

const write = (
  collection: string,
  keyByte: number,
  outputBase: number,
): ValueChunkWriteDescriptor => {
  const collectionSignature = `${collection}:mapping(bytes32 => bytes[])`;
  return {
    categoryId: '71'.repeat(31) + '8e',
    collection,
    collectionSignature,
    collectionHash: binToHex(computeCollectionHash(collectionSignature)),
    keySlot: keyByte.toString(16).padStart(2, '0').repeat(32),
    entryAccessSlot: keyByte,
    routeSlot: keyByte,
    operation: 'update',
    outputBase,
    outputCount: 1,
  };
};

describe('progressive route probe progress', () => {
  it('bounds a probe by only its reachable physical entry coordinates', () => {
    const carrier = (txid: string, offsets: number[]): {
      categoryId: string;
      masterUtxo: { txid: string; vout: number };
      blockLayout: { slots: { kind: string; offset: number }[] };
    } => ({
      categoryId: '71'.repeat(31) + '8e',
      masterUtxo: { txid: txid.repeat(64), vout: 0 },
      blockLayout: {
        slots: [
          { kind: 'master', offset: 0 },
          ...offsets.map((offset) => ({ kind: 'entry', offset })),
        ],
      },
    });
    const current = carrier('1', [1, 2]);
    const embedded = carrier('2', [1, 2, 3]);
    const unrelated = carrier('3', [1, 2, 3, 4, 5]);

    expect(routeProbeRepairableEntryCoordinateCount(current)).toBe(2);
    expect(routeProbeRepairableEntryCoordinateCount(current, embedded)).toBe(5);
    expect(routeProbeRepairableEntryCoordinateCount(current)).not.toBe(
      routeProbeRepairableEntryCoordinateCount(current, unrelated),
    );
  });

  it('authorizes only compiler-declared entry coordinates in a broad trace window', () => {
    const layouts = [{
      base: 15,
      slots: [
        { kind: 'master', offset: 0 },
        { kind: 'dataNft', offset: 1 },
        { kind: 'dataNft', offset: 2 },
        { kind: 'entry', offset: 3 },
        { kind: 'event', offset: 4 },
      ],
    }];

    expect(routeProbeEntrySlotOffsetForOutput(18, layouts)).toBe(3);
    expect(routeProbeEntrySlotOffsetForOutput(16, layouts)).toBeUndefined();
    expect(routeProbeEntrySlotOffsetForOutput(19, layouts)).toBeUndefined();
    // A trailing commitment may be 64 bytes, but its shape and position do not grant entry ownership.
    expect(routeProbeEntrySlotOffsetForOutput(23, layouts)).toBeUndefined();
  });

  it('requires compiler-authored writes before a kernel carrier is treated as a value writer', () => {
    expect(permitsRouteValueChunkDerivation('kernel-row-loop', [])).toBe(false);
    expect(permitsRouteValueChunkDerivation('kernel-row-loop', [write('records', 1, 8)])).toBe(true);
    expect(permitsRouteValueChunkDerivation('legacy-unroll', [])).toBe(true);
  });

  it('keys progress by stable storage resource rather than physical output geometry', () => {
    const first = write('records', 1, 8);
    const relocated = { ...first, outputBase: 24, outputCount: 3 };

    expect(valueChunkWriteResourceIdentity(relocated))
      .toBe(valueChunkWriteResourceIdentity(first));
    expect(progressiveRouteProbePassLimit(2, [first, relocated])).toBe(7);
    expect(progressiveRouteProbePassLimit(2, [first, write('receipts', 2, 30)])).toBe(9);
  });

  it('treats relocation as the same resource materialization and rejects semantic changes', () => {
    const observations = new Map<string, string>();
    const chunks = [
      { outputIndex: 63, commitment: '0000aa', lockingBytecode: Uint8Array.of(0xaa) },
      { outputIndex: 64, commitment: '0100bb', lockingBytecode: Uint8Array.of(0xaa) },
    ];
    const value = { identity: 'value-run:resource-a', fingerprint: routeValueRunFingerprint(chunks) };
    const address = { identity: 'entry-lock:category:12', fingerprint: 'lock' };

    expect(recordRouteProbeObservation(observations, address, 'kernel-row-loop')).toBe('new');
    expect(recordRouteProbeObservation(observations, value, 'kernel-row-loop')).toBe('new');
    expect(recordRouteProbeObservation(observations, {
      ...value,
      fingerprint: routeValueRunFingerprint(chunks.map((chunk) => ({
        ...chunk, outputIndex: chunk.outputIndex + 4,
      }))),
    }, 'kernel-row-loop')).toBe('same');
    expect(() => recordRouteProbeObservation(observations, {
      ...value,
      fingerprint: routeValueRunFingerprint([
        chunks[0], { ...chunks[1], commitment: '0100cc' },
      ]),
    }, 'kernel-row-loop')).toThrow(/unstable materialization/);
    expect(() => routeValueRunFingerprint([
      chunks[0], { ...chunks[1], outputIndex: 65 },
    ])).toThrow(/contiguous output band/);
  });

  it('keeps descriptor-free legacy coordinate changes finite and explicit', () => {
    const observations = new Map<string, string>();
    const coordinate = { identity: 'value-coordinate:category:12', fingerprint: 'first' };

    expect(recordRouteProbeObservation(observations, coordinate, 'legacy-unroll')).toBe('new');
    expect(recordRouteProbeObservation(observations, {
      ...coordinate, fingerprint: 'second',
    }, 'legacy-unroll')).toBe('changed');
    expect(recordRouteProbeObservation(observations, {
      ...coordinate, fingerprint: 'second',
    }, 'legacy-unroll')).toBe('same');
    expect(progressiveRouteProbePassLimit(0, [])).toBe(3);
  });
});
