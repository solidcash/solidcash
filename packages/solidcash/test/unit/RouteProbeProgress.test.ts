import { binToHex } from '@bitauth/libauth';
import { computeCollectionHash } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  progressiveRouteProbePassLimit,
  recordRouteProbeObservation,
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
    categoryId: '71'.repeat(32),
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
  it('keys progress by stable storage resource rather than physical output geometry', () => {
    const first = write('records', 1, 8);
    const relocated = { ...first, outputBase: 24, outputCount: 3 };

    expect(valueChunkWriteResourceIdentity(relocated))
      .toBe(valueChunkWriteResourceIdentity(first));
    expect(progressiveRouteProbePassLimit(2, [first, relocated])).toBe(5);
    expect(progressiveRouteProbePassLimit(2, [first, write('receipts', 2, 30)])).toBe(7);
  });

  it('accepts each materialization once and rejects unstable kernel observations', () => {
    const observations = new Map<string, string>();
    const value = { identity: 'value-run:resource-a', fingerprint: '12:chunk:lock' };
    const address = { identity: 'entry-lock:category:12', fingerprint: 'lock' };

    expect(recordRouteProbeObservation(observations, address, 'kernel-row-loop')).toBe('new');
    expect(recordRouteProbeObservation(observations, value, 'kernel-row-loop')).toBe('new');
    expect(recordRouteProbeObservation(observations, value, 'kernel-row-loop')).toBe('same');
    expect(() => recordRouteProbeObservation(observations, {
      ...value,
      fingerprint: '13:different-chunk:lock',
    }, 'kernel-row-loop')).toThrow(/unstable materialization/);
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
