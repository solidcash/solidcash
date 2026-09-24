/**
 * Audit #1 / recommended step 1: transaction-global layout resolve + slot exclusivity.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertResolvedClaimSlotExclusivity,
  assertUniqueOwnership,
  resolveComposeParticipantLayoutAuthority,
  resolveParticipantAbsoluteWitnesses,
  resolveTransactionLayout,
  resolveTransactionLayoutWitnesses,
} from '../../src/message-bus/layout-resolver.js';

describe('transaction-global layout authority', () => {
  it('packs multi-participant layouts with distinct inputBase and outputBase fields', () => {
    const layout = resolveTransactionLayout({
      nonParticipantInputPrefix: 2,
      nonParticipantOutputPrefix: 2,
      participants: [
        { participant: 0, blockLayout: { blockSize: 10, trailingBase: 4, trailingCapacity: 6, slots: [] } },
        { participant: 1, blockLayout: { blockSize: 8, trailingBase: 3, trailingCapacity: 5, slots: [] } },
      ],
    });
    expect(layout.nonParticipantInputPrefix).toBe(2);
    expect(layout.nonParticipantOutputPrefix).toBe(2);
    expect(layout.participants[0]?.inputBase).toBe(2);
    expect(layout.participants[0]?.outputBase).toBe(2);
    expect(layout.participants[1]?.inputBase).toBe(12);
    expect(layout.participants[1]?.outputBase).toBe(12);
    expect(layout.participantInputs).toEqual([2, 12]);
    expect(layout.participantOutputs).toEqual([2, 12]);
    expect(layout.absoluteInput(1, 3)).toBe(15);
    expect(layout.absoluteOutput(1, 3)).toBe(15);
  });

  it('resolveTransactionLayoutWitnesses returns per-participant absolutes from one resolve', () => {
    const { layout, witnessesByParticipant } = resolveTransactionLayoutWitnesses({
      participants: [
        { participant: 0, blockLayout: { blockSize: 20, slots: [] } },
        {
          participant: 1,
          blockLayout: { blockSize: 40, trailingBase: 10, trailingCapacity: 20, slots: [] },
        },
      ],
      dynamicBandClaims: [{ participant: 1, chunkCount: 2 }],
      valueChunkClaims: [{
        participant: 1, collection: 'events', bandOffset: 5, chunkCount: 1,
      }],
    });
    expect(layout.participants).toHaveLength(2);
    const w1 = witnessesByParticipant.get(1);
    expect(w1?.dynamicChunkInputBase).toBe(BigInt(20 + 10));
    expect(w1?.valueChunkOutputBase).toBe(BigInt(20 + 10 + 5));
    // Solo rebase path must not be required — absolutes already include participant 0's span.
    expect(Number(w1?.dynamicChunkInputBase)).toBeGreaterThan(20);
  });

  it('transactionParticipants path matches publishedBase to global inputBase (no solo rebase)', () => {
    const transactionParticipants = [
      { participant: 0, blockLayout: { blockSize: 50, slots: [] as const } },
      {
        participant: 1,
        contractName: 'Store',
        blockLayout: {
          blockSize: 30, trailingBase: 8, trailingCapacity: 16, slots: [] as const,
        },
      },
    ];
    const publishedBase = 50; // after participant 0
    const witnesses = resolveParticipantAbsoluteWitnesses({
      participant: 1,
      publishedBase,
      blockSize: 30,
      trailingBase: 8,
      trailingCapacity: 16,
      dynChunkCount: 1,
      valueChunkBandOffset: 3,
      valueChunkCollection: 'data',
      transactionParticipants,
    });
    expect(witnesses.layout.participants[1]?.inputBase).toBe(publishedBase);
    expect(witnesses.dynamicChunkInputBase).toBe(BigInt(publishedBase + 8));
    expect(witnesses.valueChunkOutputBase).toBe(BigInt(publishedBase + 8 + 3));
  });

  it('refuses publishedBase that disagrees with transaction-global inputBase', () => {
    expect(() => resolveParticipantAbsoluteWitnesses({
      participant: 1,
      publishedBase: 0, // wrong — should be 50
      blockSize: 30,
      trailingBase: 8,
      trailingCapacity: 16,
      dynChunkCount: 1,
      transactionParticipants: [
        { participant: 0, blockLayout: { blockSize: 50, slots: [] } },
        { participant: 1, blockLayout: { blockSize: 30, trailingBase: 8, trailingCapacity: 16, slots: [] } },
      ],
    })).toThrow(/published-base-mismatch/);
  });

  it('refuses overlapping value-chunk and dynamic output ranges', () => {
    expect(() => resolveTransactionLayout({
      participants: [{
        participant: 0,
        blockLayout: { blockSize: 40, trailingBase: 10, trailingCapacity: 20, slots: [] },
      }],
      dynamicBandClaims: [{ participant: 0, chunkCount: 4 }],
      valueChunkClaims: [{
        participant: 0, collection: 'events', bandOffset: 2, chunkCount: 2,
      }],
    })).toThrow(/claim-slot-collision/);
  });

  it('assertResolvedClaimSlotExclusivity is exported for production callers', () => {
    const layout = resolveTransactionLayout({
      participants: [{
        participant: 0,
        blockLayout: { blockSize: 20, trailingBase: 5, trailingCapacity: 10, slots: [] },
      }],
      valueChunkClaims: [{ participant: 0, collection: 'a', bandOffset: 0, chunkCount: 1 }],
    });
    expect(() => assertResolvedClaimSlotExclusivity(layout)).not.toThrow();
  });

  it('compose.ts calls resolveComposeTransactionLayoutAuthority (batch, including base-0 frames)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const bus = join(here, '../../src/message-bus');
    const src = [
      readFileSync(join(bus, 'compose.ts'), 'utf8'),
      readFileSync(join(bus, 'compose-assemble.ts'), 'utf8'),
    ].join('\n');
    expect(src).toContain('resolveComposeTransactionLayoutAuthority');
    expect(src).toContain('deferredLayoutClaims');
    expect(src).toContain('transactionParticipants');
    expect(src).toContain('ownershipClaims');
    // Must not gate the resolve on publishedBase > 0.
    expect(src).not.toMatch(/publishedBase > 0\s*\n\s*&& masterUnlocker/);
  });

  it('shipped compose helper refuses base-0 colliding dyn/valueChunk claims', () => {
    const transactionParticipants = [{
      participant: 0,
      blockLayout: {
        blockSize: 40, trailingBase: 10, trailingCapacity: 20, slots: [] as const,
      },
    }];
    expect(() => resolveComposeParticipantLayoutAuthority({
      participant: 0,
      publishedBase: 0,
      blockSize: 40,
      trailingBase: 10,
      trailingCapacity: 20,
      dynChunkCount: 4,
      valueChunkBandOffset: 2,
      valueChunkCollection: 'events',
      valueChunkCount: 2,
      transactionParticipants,
      ownership: [
        {
          participant: 0,
          carrier: 'dynamicState',
          roles: {
            consumeInput: 10,
            produceOutput: 10,
            outputSlot: 10,
          },
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
    })).toThrow(/claim-slot-collision|overlapping-range/);
  });

  it('refuses dyn/valueChunk output collision under asymmetric input≠output prefixes', () => {
    // inputPrefix=10, outputPrefix=0, trailing=5, dyn=4 → output dyn occupies [5,9).
    // valueChunk bandOffset 0 count 2 → output [5,7) overlaps dyn output range.
    expect(() => resolveTransactionLayout({
      nonParticipantInputPrefix: 10,
      nonParticipantOutputPrefix: 0,
      participants: [{
        participant: 0,
        blockLayout: {
          blockSize: 40, trailingBase: 5, trailingCapacity: 20, slots: [],
        },
      }],
      dynamicBandClaims: [{ participant: 0, chunkCount: 4 }],
      valueChunkClaims: [{
        participant: 0, collection: 'events', bandOffset: 0, chunkCount: 2,
      }],
    })).toThrow(/claim-slot-collision/);

    const layout = resolveTransactionLayout({
      nonParticipantInputPrefix: 10,
      nonParticipantOutputPrefix: 0,
      participants: [{
        participant: 0,
        blockLayout: {
          blockSize: 40, trailingBase: 5, trailingCapacity: 20, slots: [],
        },
      }],
      dynamicBandClaims: [{ participant: 0, chunkCount: 4 }],
    });
    expect(layout.dynamicBands[0]?.absoluteBase).toBe(10 + 5); // input space
    expect(layout.dynamicBands[0]?.absoluteOutputBase).toBe(0 + 5); // output space
  });

  it('ownership bounds outputSlot against outputBase under asymmetric prefixes', () => {
    // inputBase=10, outputBase=0: outputSlot 2 is valid in output space but below inputBase.
    expect(() => assertUniqueOwnership(
      [{
        participant: 0,
        carrier: 'valueChunk',
        collection: 'events',
        roles: { outputSlot: 2 },
      }],
      new Map([[0, {
        inputBase: 10,
        outputBase: 0,
        blockSize: 20,
        trailingBase: 5,
        trailingCapacity: 10,
      }]]),
    )).not.toThrow();

    // outputSlot past the output block must refuse.
    expect(() => assertUniqueOwnership(
      [{
        participant: 0,
        carrier: 'valueChunk',
        collection: 'events',
        roles: { outputSlot: 25 },
      }],
      new Map([[0, {
        inputBase: 10,
        outputBase: 0,
        blockSize: 20,
        trailingBase: 5,
        trailingCapacity: 10,
      }]]),
    )).toThrow(/participant-boundary/);

    // consumeInput still bounds against inputBase.
    expect(() => assertUniqueOwnership(
      [{
        participant: 0,
        carrier: 'entry',
        collection: 'balances',
        roles: { consumeInput: 2 },
      }],
      new Map([[0, {
        inputBase: 10,
        outputBase: 0,
        blockSize: 20,
      }]]),
    )).toThrow(/participant-boundary/);
  });
});
