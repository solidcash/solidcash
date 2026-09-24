import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyParticipantAbsoluteWitnesses,
  resolveComposeParticipantLayoutAuthority,
  resolveComposeTransactionLayoutAuthority,
} from '../../src/message-bus/layout-resolver.js';

/**
 * deferred multi-claim batch layout resolve: one deferred multi-claim batch resolve for all participants.
 * validate-all-then-write: validate-all-then-write in applyParticipantAbsoluteWitnesses.
 */
describe('deferred multi-claim batch layout resolve batch layout resolve + validate-all-then-write validate-then-write', () => {
  const transactionParticipants = [
    {
      participant: 0,
      blockLayout: {
        blockSize: 20, trailingBase: 8, trailingCapacity: 10, slots: [] as const,
      },
    },
    {
      participant: 1,
      contractName: 'Store',
      blockLayout: {
        blockSize: 30, trailingBase: 10, trailingCapacity: 16, slots: [] as const,
      },
    },
  ];

  it('resolveComposeTransactionLayoutAuthority resolves all participants in one batch', () => {
    const { layout, witnessesByParticipant } = resolveComposeTransactionLayoutAuthority({
      transactionParticipants,
      participants: [
        {
          participant: 0,
          publishedBase: 0,
          blockSize: 20,
          trailingBase: 8,
          trailingCapacity: 10,
          dynChunkCount: 1,
          valueChunkBandOffset: 2,
          valueChunkCollection: 'events',
          valueChunkCount: 1,
        },
        {
          participant: 1,
          publishedBase: 20,
          blockSize: 30,
          trailingBase: 10,
          trailingCapacity: 16,
          dynChunkCount: 2,
          valueChunkBandOffset: 4,
          valueChunkCollection: 'jobs',
          valueChunkCount: 1,
          predOuts: [{
            witnessName: '__internal__vmapBatchPredOut_0',
            physicalLocalOffset: 12,
          }],
        },
      ],
    });

    expect(layout.participants).toHaveLength(2);
    expect(layout.participants[0]?.inputBase).toBe(0);
    expect(layout.participants[1]?.inputBase).toBe(20);

    const w0 = witnessesByParticipant.get(0);
    const w1 = witnessesByParticipant.get(1);
    expect(w0?.dynamicChunkInputBase).toBe(8n);
    expect(w0?.valueChunkOutputBase).toBe(10n); // 8 + 2
    expect(w1?.dynamicChunkInputBase).toBe(30n); // 20 + 10
    expect(w1?.valueChunkOutputBase).toBe(34n); // 20 + 10 + 4
    expect(w1?.predOuts.get('__internal__vmapBatchPredOut_0')).toBe(32n); // 20 + 12
  });

  it('batch resolve refuses cross-participant claim collisions in one resolve', () => {
    // Two participants with overlapping absolute value-chunk output ranges under shared packing.
    // P0 trailing at 0+5=5, valueChunk bandOffset 0 width 4 → outputs [5,9).
    // P1 inputBase=20; this test instead puts both claims on P0-style packing via colliding ownership
    // ranges inside one batch (dyn + valueChunk overlap on participant 0).
    expect(() => resolveComposeTransactionLayoutAuthority({
      transactionParticipants: [{
        participant: 0,
        blockLayout: {
          blockSize: 40, trailingBase: 10, trailingCapacity: 20, slots: [] as const,
        },
      }],
      participants: [{
        participant: 0,
        publishedBase: 0,
        blockSize: 40,
        trailingBase: 10,
        trailingCapacity: 20,
        dynChunkCount: 4,
        valueChunkBandOffset: 2,
        valueChunkCollection: 'events',
        valueChunkCount: 2,
        ownership: [
          {
            participant: 0,
            carrier: 'dynamicState',
            roles: { outputSlot: 10 },
            rangeWidth: 4,
          },
          {
            participant: 0,
            carrier: 'valueChunk',
            collection: 'events',
            roles: { outputSlot: 12 },
            rangeWidth: 2,
          },
        ],
      }],
    })).toThrow(/claim-slot-collision|overlapping-range/);
  });

  it('single-participant resolveComposeParticipantLayoutAuthority delegates to batch API', () => {
    const solo = resolveComposeParticipantLayoutAuthority({
      participant: 1,
      publishedBase: 20,
      blockSize: 30,
      trailingBase: 10,
      trailingCapacity: 16,
      dynChunkCount: 1,
      valueChunkBandOffset: 3,
      valueChunkCollection: 'events',
      valueChunkCount: 1,
      transactionParticipants,
    });
    const batch = resolveComposeTransactionLayoutAuthority({
      transactionParticipants,
      participants: [{
        participant: 1,
        publishedBase: 20,
        blockSize: 30,
        trailingBase: 10,
        trailingCapacity: 16,
        dynChunkCount: 1,
        valueChunkBandOffset: 3,
        valueChunkCollection: 'events',
        valueChunkCount: 1,
      }],
    });
    const projected = batch.witnessesByParticipant.get(1);
    expect(solo.dynamicChunkInputBase).toBe(projected?.dynamicChunkInputBase);
    expect(solo.valueChunkOutputBase).toBe(projected?.valueChunkOutputBase);
  });

  it('validate-all-then-write: late PredOut failure leaves earlier params untouched (validate-then-write)', () => {
    const params: unknown[] = [
      8n, // dyn provisional
      12n, // valueChunk provisional
      4n, // active PredOut with no witness → fail
    ];
    const snapshot = [...params];
    expect(() => applyParticipantAbsoluteWitnesses({
      inputs: [
        { name: '__internal__dynamicChunkInputBase' },
        { name: '__internal__valueChunkOutputBase' },
        { name: '__internal__vmapBatchPredOut_0' },
      ],
      params,
      witnesses: {
        dynamicChunkInputBase: 100n,
        valueChunkOutputBase: 200n,
        predOuts: new Map(), // missing active PredOut
      },
      participant: 0,
    })).toThrow(/pred-out-unresolved/);

    // No partial writes: dyn/valueChunk must still be provisional.
    expect(params[0]).toBe(snapshot[0]);
    expect(params[1]).toBe(snapshot[1]);
    expect(params[2]).toBe(snapshot[2]);
    expect(params[0]).not.toBe(100n);
    expect(params[1]).not.toBe(200n);
  });

  it('validate-all-then-write: successful apply still commits all staged writes', () => {
    const params: unknown[] = [8n, 12n, 4n];
    const applied = applyParticipantAbsoluteWitnesses({
      inputs: [
        { name: '__internal__dynamicChunkInputBase' },
        { name: '__internal__valueChunkOutputBase' },
        { name: '__internal__vmapBatchPredOut_0' },
      ],
      params,
      witnesses: {
        dynamicChunkInputBase: 100n,
        valueChunkOutputBase: 200n,
        predOuts: new Map([['__internal__vmapBatchPredOut_0', 300n]]),
      },
      participant: 0,
    });
    expect(params).toEqual([100n, 200n, 300n]);
    expect(applied.written).toHaveLength(3);
  });

  it('compose.ts production path calls resolveComposeTransactionLayoutAuthority (batch)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const bus = join(here, '../../src/message-bus');
    const src = [
      readFileSync(join(bus, 'compose.ts'), 'utf8'),
      readFileSync(join(bus, 'compose-assemble.ts'), 'utf8'),
    ].join('\n');
    expect(src).toContain('resolveComposeTransactionLayoutAuthority');
    expect(src).toContain('deferredLayoutClaims');
    expect(src).toContain('transactionParticipants');
    // Must not gate the resolve on publishedBase > 0.
    expect(src).not.toMatch(/publishedBase > 0\s*\n\s*&& masterUnlocker/);
  });
});
