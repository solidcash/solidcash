import { describe, expect, it } from 'vitest';
import {
  dynamicChunkInputBaseFor,
  entryNewOutputBaseFor,
  formatLayoutInvariant,
  predOutClaimFromPhysicalRoute,
  resolveParticipantAbsoluteWitnesses,
  resolveTransactionLayout,
  trailingCapacityExcludingFixedSuffix,
  valueChunkOutputBaseFor,
} from '../../src/message-bus/layout-resolver.js';

describe('layout-resolver', () => {
  it('assigns participant bases contiguously from block sizes', () => {
    const layout = resolveTransactionLayout({
      participants: [
        { participant: 0, contractName: 'A', blockLayout: { blockSize: 8, slots: [] } },
        {
          participant: 1,
          contractName: 'B',
          blockLayout: { blockSize: 85, trailingBase: 21, trailingCapacity: 64, slots: [] },
        },
      ],
    });
    expect([...layout.participantInputs]).toEqual([0, 8]);
    expect(layout.participants[1]?.trailingBase).toBe(21);
    expect(layout.absolute(1, 23)).toBe(8 + 23);
  });

  it('resolves value-chunk band[0] as absolute valueChunkOutputBase', () => {
    const layout = resolveTransactionLayout({
      participants: [
        { participant: 0, blockLayout: { blockSize: 4, slots: [] } },
        {
          participant: 1,
          blockLayout: { blockSize: 40, trailingBase: 10, trailingCapacity: 30, slots: [] },
        },
      ],
      valueChunkClaims: [
        { participant: 1, collection: 'events', bandOffset: 0, chunkCount: 2 },
        { participant: 1, collection: 'notes', bandOffset: 2, chunkCount: 1 },
      ],
    });
    expect(valueChunkOutputBaseFor(layout, 1)).toBe(4 + 10);
    expect(valueChunkOutputBaseFor(layout, 1, 'notes')).toBe(4 + 10 + 2);
    expect(layout.valueChunkBands).toHaveLength(2);
  });

  it('resolves PredOut from physical trailing offset, not concrete handler slot', () => {
    // Historical bug: concrete approve layout slot 4 vs physical route trailing 23 → absolute 203 vs 222.
    const participantBase = 199;
    const layout = resolveTransactionLayout({
      participants: [
        { participant: 0, blockLayout: { blockSize: participantBase, slots: [] } },
        {
          participant: 1,
          contractName: 'FakeToken',
          blockLayout: { blockSize: 88, trailingBase: 23, trailingCapacity: 64, slots: [] },
        },
      ],
      predOutClaims: [
        predOutClaimFromPhysicalRoute({
          participant: 1,
          witnessName: '__internal__vmapBatchPredOut_2',
          physicalLocalOffset: 23,
        }),
      ],
    });
    expect(layout.predOuts[0]?.absoluteOutput).toBe(participantBase + 23);
    expect(layout.participants[1]?.inputBase).toBe(participantBase);
    expect(layout.participants[1]?.outputBase).toBe(participantBase);
    expect(layout.participantOutputs[1]).toBe(participantBase);
  });

  it('R5/layout-sentinel / PredOut: refuses any concreteLocalSlot that disagrees with physicalLocalOffset', () => {
    // Below trailingBase (historical 203↔222 class).
    expect(() => resolveTransactionLayout({
      participants: [{
        participant: 0,
        blockLayout: { blockSize: 88, trailingBase: 23, trailingCapacity: 64, slots: [] },
      }],
      predOutClaims: [
        predOutClaimFromPhysicalRoute({
          participant: 0,
          witnessName: '__internal__vmapBatchPredOut_2',
          physicalLocalOffset: 23,
          concreteLocalSlot: 4,
        }),
      ],
    })).toThrow(/pred-out-concrete-vs-physical/);
    // At/above trailingBase — still not authority.
    expect(() => resolveTransactionLayout({
      participants: [{
        participant: 0,
        blockLayout: { blockSize: 88, trailingBase: 23, trailingCapacity: 64, slots: [] },
      }],
      predOutClaims: [
        predOutClaimFromPhysicalRoute({
          participant: 0,
          witnessName: '__internal__vmapBatchPredOut_2',
          physicalLocalOffset: 23,
          concreteLocalSlot: 40,
        }),
      ],
    })).toThrow(/pred-out-concrete-vs-physical/);
    // Equal concrete is ignored; resolved surface omits the field.
    const ok = resolveTransactionLayout({
      participants: [{
        participant: 0,
        blockLayout: { blockSize: 88, trailingBase: 23, trailingCapacity: 64, slots: [] },
      }],
      predOutClaims: [
        predOutClaimFromPhysicalRoute({
          participant: 0,
          witnessName: '__internal__vmapBatchPredOut_2',
          physicalLocalOffset: 23,
          concreteLocalSlot: 23,
        }),
      ],
    });
    expect(ok.predOuts[0]?.absoluteOutput).toBe(23);
    expect(ok.predOuts[0]).not.toHaveProperty('concreteLocalSlot');
  });

  it('refuses duplicate participant ids and overlapping symbolic bands', () => {
    expect(() => resolveTransactionLayout({
      participants: [
        { participant: 0, blockLayout: { blockSize: 4, slots: [] } },
        { participant: 0, blockLayout: { blockSize: 4, slots: [] } },
      ],
    })).toThrow(/duplicate-participant-id/);

    expect(() => resolveTransactionLayout({
      participants: [{
        participant: 0,
        bands: [
          { kind: 'master', localBase: 0, capacity: 4 },
          { kind: 'trailing', localBase: 2, capacity: 4 },
        ],
      }],
    })).toThrow(/overlapping-symbolic-band/);
  });

  it('fail-closes when value-chunk capacity is exceeded', () => {
    expect(() => resolveTransactionLayout({
      participants: [{
        participant: 0,
        blockLayout: { blockSize: 20, trailingBase: 10, trailingCapacity: 4, slots: [] },
      }],
      valueChunkClaims: [
        { participant: 0, collection: 'events', bandOffset: 0, chunkCount: 5 },
      ],
    })).toThrow(/value-chunk-capacity/);
  });

  it('fail-closes on duplicate ownership claims as L3_LAYOUT_INVARIANT', () => {
    expect(() => resolveTransactionLayout({
      participants: [{ participant: 0, blockLayout: { blockSize: 4, slots: [] } }],
      ownership: [
        { participant: 0, carrier: 'valueChunk', collection: 'events', roles: {} },
        { participant: 0, carrier: 'valueChunk', collection: 'events', roles: { outputSlot: 1 } },
      ],
    })).toThrow(/duplicate-ownership/);
    try {
      resolveTransactionLayout({
        participants: [{ participant: 0, blockLayout: { blockSize: 4, slots: [] } }],
        ownership: [
          { participant: 0, carrier: 'entry', collection: 'balances', roles: {} },
          { participant: 0, carrier: 'entry', collection: 'balances', roles: { outputSlot: 2 } },
        ],
      });
      expect.unreachable('expected duplicate ownership throw');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain('duplicate-ownership');
      expect(message).toContain('L3_LAYOUT_INVARIANT');
      expect(message).toContain('participant 0');
      expect(message).toContain('resource balances');
      expect(message).toContain('expected output');
      expect(message).toContain('actual output');
    }
  });

  it('packs dyn → entry NEW → valueChunk in the trailing band (MDV1 159/161 class)', () => {
    // participantBase 119, trailingBase 40 → dyn@159, two dyn chunks, entry NEW@161, valueChunk band@62.
    const participantBase = 119;
    const trailingBase = 40;
    const layout = resolveTransactionLayout({
      participants: [
        { participant: 0, blockLayout: { blockSize: participantBase, slots: [] } },
        {
          participant: 1,
          contractName: 'MarketplaceDataV1',
          blockLayout: {
            blockSize: 106, trailingBase, trailingCapacity: 66, slots: [],
          },
        },
      ],
      dynamicBandClaims: [{ participant: 1, chunkCount: 2 }],
      entryNewClaims: [{ participant: 1, collection: 'jobEvents', entryIndex: 0 }],
      valueChunkClaims: [
        { participant: 1, collection: 'jobEvents', bandOffset: 22, chunkCount: 1 },
      ],
      predOutClaims: [
        predOutClaimFromPhysicalRoute({
          participant: 1,
          witnessName: '__internal__vmapBatchPredOut_3',
          physicalLocalOffset: trailingBase + 2,
        }),
      ],
    });
    expect(dynamicChunkInputBaseFor(layout, 1)).toBe(participantBase + trailingBase); // 159
    expect(entryNewOutputBaseFor(layout, 1, 'jobEvents')).toBe(participantBase + trailingBase + 2); // 161
    expect(valueChunkOutputBaseFor(layout, 1, 'jobEvents'))
      .toBe(participantBase + trailingBase + 22);
    expect(layout.predOuts[0]?.absoluteOutput).toBe(participantBase + trailingBase + 2);
    // Dyn base < entry NEW ≤ PredOut physical; value-chunk band sits later in trailing.
    expect(dynamicChunkInputBaseFor(layout, 1)!)
      .toBeLessThan(entryNewOutputBaseFor(layout, 1)!);
    expect(entryNewOutputBaseFor(layout, 1)!)
      .toBeLessThanOrEqual(valueChunkOutputBaseFor(layout, 1)!);
  });

  it('resolveParticipantAbsoluteWitnesses rebases one layout pass into publishedBase', () => {
    const publishedBase = 119;
    const witnesses = resolveParticipantAbsoluteWitnesses({
      participant: 1,
      contractName: 'MarketplaceDataV1',
      publishedBase,
      blockSize: 106,
      trailingBase: 40,
      trailingCapacity: 66,
      dynChunkCount: 2,
      valueChunkBandOffset: 22,
      valueChunkCollection: 'jobEvents',
      valueChunkCount: 1,
      entryNews: [{ collection: 'jobEvents', entryIndex: 0 }],
      predOuts: [{
        witnessName: '__internal__vmapBatchPredOut_3',
        physicalLocalOffset: 42,
      }],
    });
    expect(witnesses.dynamicChunkInputBase).toBe(BigInt(publishedBase + 40));
    expect(witnesses.entryNewOutputBase).toBe(BigInt(publishedBase + 42));
    expect(witnesses.valueChunkOutputBase).toBe(BigInt(publishedBase + 62));
    expect(witnesses.predOuts.get('__internal__vmapBatchPredOut_3'))
      .toBe(BigInt(publishedBase + 42));
    // Same absolutes as calling resolveTransactionLayout once and rebasing — no second invent.
    const again = resolveParticipantAbsoluteWitnesses({
      participant: 1,
      publishedBase,
      blockSize: 106,
      trailingBase: 40,
      trailingCapacity: 66,
      dynChunkCount: 2,
      valueChunkBandOffset: 22,
      valueChunkCollection: 'jobEvents',
      entryNews: [{ collection: 'jobEvents', entryIndex: 0 }],
      predOuts: [{
        witnessName: '__internal__vmapBatchPredOut_3',
        physicalLocalOffset: 42,
      }],
    });
    expect(again.dynamicChunkInputBase).toBe(witnesses.dynamicChunkInputBase);
    expect(again.entryNewOutputBase).toBe(witnesses.entryNewOutputBase);
    expect(again.valueChunkOutputBase).toBe(witnesses.valueChunkOutputBase);
    expect(again.predOuts.get('__internal__vmapBatchPredOut_3'))
      .toBe(witnesses.predOuts.get('__internal__vmapBatchPredOut_3'));
  });

  it('formats layout invariants with participant/resource/expected/actual', () => {
    const message = formatLayoutInvariant({
      invariantId: 'final-chunk-locking-bytecode',
      participant: 1,
      resource: 'jobEvents[jobId]',
      expectedOutput: 222,
      actualOutput: 220,
    });
    expect(message).toContain('final-chunk-locking-bytecode');
    expect(message).toContain('participant 1');
    expect(message).toContain('resource jobEvents[jobId]');
    expect(message).toContain('expected output 222');
    expect(message).toContain('actual output 220');
  });

  it('excludes identity-anchor fixedSuffix from trailing capacity (FakeToken 87→88)', () => {
    // Artifact route: blockSize 87, trailingBase 23, capacity 64. Owner +1 identity ⇒ 88.
    expect(trailingCapacityExcludingFixedSuffix({
      blockSize: 88, trailingBase: 23, fixedSuffix: 1,
    })).toBe(64);
    // The buggy formula absorbed the identity slot into trailing:
    expect(88 - 23).toBe(65);
  });
});
