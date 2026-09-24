import { describe, expect, it } from 'vitest';
import {
  assertComposeSlotsCoverEffectPlans,
  pruneComposeSlotInventoryByEffectPlans,
  type ComposeSlotInventory,
} from '../../src/message-bus/compose-slot-inventory.js';
import type { ExecutionContextEffectPlan } from '../../src/message-bus/execution-context.js';

describe('settle-time ExecutionContext compose slots cover effect plans', () => {
  const inventory = {
    fixedEventSlots: [{ participant: 0, offset: 1 }, { participant: 1, offset: 3 }],
    runtimeEventSlots: new Map(),
    eventSlots: () => [{ participant: 0, offset: 1 }, { participant: 1, offset: 3 }],
    hasRuntimeLoopEvents: false,
    resourceSlots: [],
    valueSlots: [{ participant: 0, offset: 2 }, { participant: 1, offset: 4 }],
    tokenSlots: [],
    sidecarSlots: [],
    hasComputedValueChunks: false,
  } as ComposeSlotInventory;

  it('accepts plans within slot capacity and refuses over-capacity events', () => {
    const ok: ExecutionContextEffectPlan = {
      handlerId: 'h',
      participantIndex: 0,
      journalKey: 's0:p0:h',
      activeWrites: [],
      activeEvents: [1_000_000],
      activeTransfers: [2_000_000],
      activeEffects: [],
    };
    expect(() => assertComposeSlotsCoverEffectPlans(inventory, [ok])).not.toThrow();

    const over: ExecutionContextEffectPlan = {
      ...ok,
      activeEvents: [1_000_000, 1_000_001],
    };
    expect(() => assertComposeSlotsCoverEffectPlans(inventory, [over])).toThrow(/activeEvents/);
  });

  it('prunes event/transfer slots when effect plans activate none of that kind', () => {
    const inactive: ExecutionContextEffectPlan = {
      handlerId: 'h',
      participantIndex: 0,
      journalKey: 's0:p0:h',
      activeWrites: [0],
      activeEvents: [],
      activeTransfers: [],
      activeEffects: [],
    };
    const pruned = pruneComposeSlotInventoryByEffectPlans(inventory, [inactive]);
    expect(pruned.fixedEventSlots.every((slot) => slot.participant !== 0)).toBe(true);
    expect(pruned.valueSlots.every((slot) => slot.participant !== 0)).toBe(true);
    expect(pruned.fixedEventSlots.some((slot) => slot.participant === 1)).toBe(true);
  });

  it('prunes dataNft/entry resource slots when activeWrites is empty', () => {
    const withResources = {
      ...inventory,
      resourceSlots: [
        { participant: 0, offset: 5, kind: 'dataNft' },
        { participant: 0, offset: 6, kind: 'tokenContainer' },
        { participant: 1, offset: 7, kind: 'entry' },
      ],
    } as ComposeSlotInventory;
    const noWrites: ExecutionContextEffectPlan = {
      handlerId: 'h',
      participantIndex: 0,
      journalKey: 's0:p0:h',
      activeWrites: [],
      activeEvents: [1],
      activeTransfers: [1],
      activeEffects: [],
    };
    const pruned = pruneComposeSlotInventoryByEffectPlans(withResources, [noWrites]);
    expect(pruned.resourceSlots.some((slot) => slot.kind === 'dataNft' && slot.participant === 0))
      .toBe(false);
    expect(pruned.resourceSlots.some((slot) => slot.kind === 'tokenContainer' && slot.participant === 0))
      .toBe(true);
    expect(pruned.resourceSlots.some((slot) => slot.participant === 1)).toBe(true);
  });

  it('prunes token and sidecar slots for inactive participants', () => {
    const withExtras = {
      ...inventory,
      tokenSlots: [{ participant: 0, offset: 8 }, { participant: 1, offset: 9 }],
      sidecarSlots: [
        { participant: 0, offset: 10, kind: 'keccakSideCar' as const },
        { participant: 1, offset: 11, kind: 'blockhashOracle' as const },
      ],
    } as ComposeSlotInventory;
    const fullyInactive: ExecutionContextEffectPlan = {
      handlerId: 'h',
      participantIndex: 0,
      journalKey: 's0:p0:h',
      activeWrites: [],
      activeEvents: [],
      activeTransfers: [],
      activeEffects: [],
    };
    const pruned = pruneComposeSlotInventoryByEffectPlans(withExtras, [fullyInactive]);
    expect(pruned.tokenSlots.every((slot) => slot.participant !== 0)).toBe(true);
    expect(pruned.sidecarSlots.every((slot) => slot.participant !== 0)).toBe(true);
    expect(pruned.tokenSlots.some((slot) => slot.participant === 1)).toBe(true);
    expect(pruned.sidecarSlots.some((slot) => slot.participant === 1)).toBe(true);
  });

  it('kind-specific sidecar pruning keeps keccak only with writes and blockhash with events', () => {
    const withSidecars = {
      ...inventory,
      sidecarSlots: [
        { participant: 0, offset: 10, kind: 'keccakSideCar' as const },
        { participant: 0, offset: 11, kind: 'blockhashOracle' as const },
        { participant: 0, offset: 12, kind: 'ecrecoverSideCar' as const },
      ],
    } as ComposeSlotInventory;
    const eventsOnly: ExecutionContextEffectPlan = {
      handlerId: 'h',
      participantIndex: 0,
      journalKey: 's0:p0:h',
      activeWrites: [],
      activeEvents: [1_000_000],
      activeTransfers: [],
      activeEffects: [],
    };
    const pruned = pruneComposeSlotInventoryByEffectPlans(withSidecars, [eventsOnly]);
    expect(pruned.sidecarSlots.some((slot) => slot.kind === 'keccakSideCar')).toBe(false);
    expect(pruned.sidecarSlots.some((slot) => slot.kind === 'ecrecoverSideCar')).toBe(false);
    expect(pruned.sidecarSlots.some((slot) => slot.kind === 'blockhashOracle')).toBe(true);
  });

  it('remaps surviving sidecar offsets densely per participant', () => {
    const withSidecars = {
      ...inventory,
      sidecarSlots: [
        { participant: 0, offset: 5, kind: 'blockhashOracle' as const },
        { participant: 0, offset: 9, kind: 'keccakSideCar' as const },
        { participant: 1, offset: 3, kind: 'blockhashOracle' as const },
      ],
    } as ComposeSlotInventory;
    const writes: ExecutionContextEffectPlan = {
      handlerId: 'h',
      participantIndex: 0,
      journalKey: 's0:p0:h',
      activeWrites: [0],
      activeEvents: [],
      activeTransfers: [],
      activeEffects: [],
    };
    const pruned = pruneComposeSlotInventoryByEffectPlans(withSidecars, [writes]);
    const p0 = pruned.sidecarSlots.filter((slot) => slot.participant === 0);
    expect(p0.map((slot) => slot.offset)).toEqual([0, 1]);
    expect(pruned.sidecarSlots.filter((slot) => slot.participant === 1)).toHaveLength(1);
  });

  it('remaps surviving event and transfer offsets densely per participant', () => {
    const sparse = {
      ...inventory,
      fixedEventSlots: [
        { participant: 0, offset: 4 },
        { participant: 0, offset: 9 },
        { participant: 1, offset: 2 },
        { participant: 1, offset: 7 },
      ],
      valueSlots: [
        { participant: 0, offset: 3 },
        { participant: 0, offset: 8 },
        { participant: 1, offset: 1 },
      ],
      runtimeEventSlots: new Map([
        [0, [
          { participant: 0, offset: 12, runtimeRow: 0, eventSignature: 'E()' },
          { participant: 0, offset: 20, runtimeRow: 1, eventSignature: 'F()' },
        ]],
      ]),
      eventSlots: () => [],
    } as ComposeSlotInventory;
    const active: ExecutionContextEffectPlan = {
      handlerId: 'h',
      participantIndex: 0,
      journalKey: 's0:p0:h',
      activeWrites: [],
      activeEvents: [0, 1],
      activeTransfers: [0],
      activeEffects: [],
    };
    const pruned = pruneComposeSlotInventoryByEffectPlans(sparse, [active]);
    expect(pruned.fixedEventSlots.filter((s) => s.participant === 0).map((s) => s.offset))
      .toEqual([0, 1]);
    expect(pruned.valueSlots.filter((s) => s.participant === 0).map((s) => s.offset))
      .toEqual([0, 1]);
    // Participant 1 has no plan → slots kept and remapped densely.
    expect(pruned.fixedEventSlots.filter((s) => s.participant === 1).map((s) => s.offset))
      .toEqual([0, 1]);
    expect(pruned.valueSlots.filter((s) => s.participant === 1).map((s) => s.offset))
      .toEqual([0]);
    const runtime = pruned.runtimeEventSlots.get(0) ?? [];
    expect(runtime.map((s) => s.offset)).toEqual([0, 1]);
    expect(pruned.eventSlots().filter((s) => s.participant === 0).map((s) => s.offset))
      .toEqual([0, 1, 0, 1]);
  });
});
