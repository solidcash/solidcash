/**
 * Compose phase-boundary extract: inventory fixed/runtime event and
 * resource/value/token/sidecar slots.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import type { ExecutionContextEffectPlan } from './execution-context.js';
import type { AtomicSidecarSlotEffect } from './graph.js';
import { findMessageBusHandlerForInvocation } from './graph-handler-join.js';
import { deriveCompiledGraphPlan } from './worklist.js';
import { decodeSelectedHandlerArguments, selectedSatoshiContainerRequired } from './selected-satoshi-container.js';

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;

export interface ComposeSlotInventory {
  fixedEventSlots: Array<{ participant: number; offset: number }>;
  runtimeEventSlots: Map<number, Array<{
    participant: number; offset: number; runtimeRow: number; eventSignature: string;
  }>>;
  eventSlots: () => Array<{
    participant: number; offset: number; runtimeRow?: number; eventSignature?: string;
  }>;
  hasRuntimeLoopEvents: boolean;
  resourceSlots: Array<{ participant: number; offset: number; kind: string }>;
  valueSlots: Array<{ participant: number; offset: number }>;
  tokenSlots: Array<{ participant: number; offset: number }>;
  sidecarSlots: Array<{ participant: number; offset: number; kind: AtomicSidecarSlotEffect['kind'] }>;
  hasComputedValueChunks: boolean;
}

/**
 * Collect compiler-published block-layout slots used by assemble / semantic-claim orchestration.
 */
export function inventoryComposeSlots(
  plan: CompiledGraphPlan,
  selectedContainers: ReadonlyMap<number, boolean | undefined> = new Map(),
): ComposeSlotInventory {
  const fixedEventSlots = plan.participants.filter((participant) => participant.authority !== 'direct').flatMap((participant) =>
    participant.blockLayout!.slots.filter((slot) => slot.kind === 'event').map((slot) => ({
      participant: participant.participant, offset: slot.offset,
    })));
  const runtimeEventSlots = new Map<number, Array<{
    participant: number; offset: number; runtimeRow: number; eventSignature: string;
  }>>();
  const eventSlots = (): Array<{
    participant: number; offset: number; runtimeRow?: number; eventSignature?: string;
  }> => [
    ...fixedEventSlots,
    ...[...runtimeEventSlots.values()].flat(),
  ];
  const hasRuntimeLoopEvents = plan.participants.some((participant) => participant.invocations.some(
    (invocationIndex) => {
      const invocation = plan.invocations[invocationIndex];
      const handler = findMessageBusHandlerForInvocation(participant.artifact, invocation);
      return (handler?.runtimeLoopEvents?.length ?? 0) > 0;
    },
  ));
  const resourceSlots = plan.participants.filter((participant) => participant.authority !== 'direct').flatMap((participant) =>
    participant.blockLayout!.slots
      .filter((slot) => [
        'dataNft', 'readOnlyDataNft', 'entry', 'satoshiContainer', 'tokenContainer', 'trailing', 'lowLevelCall',
      ].includes(slot.kind))
      // A slot reserved for an unselected BCH-transfer handler is a balanced placeholder, not a claim that
      // the real container is co-spent. Keep its fixed offset, but do not authenticate it as a container.
      .filter((slot) => slot.kind !== 'satoshiContainer'
        || (selectedContainers.get(participant.participant) ?? selectedSatoshiContainerRequired(participant.artifact,
          participant.invocations.map((index) => plan.invocations[index].selectorHex),
          participant.invocations.map((index) => decodeSelectedHandlerArguments(
            participant.artifact, plan.invocations[index].selectorHex, hexToBin(plan.invocations[index].argsHex),
          )))) !== false)
      .map((slot) => ({
        participant: participant.participant, offset: slot.offset, kind: slot.kind,
      })));
  const valueSlots = plan.participants.filter((participant) => participant.authority !== 'direct').flatMap((participant) =>
    participant.blockLayout!.slots.filter((slot) => slot.kind === 'transfer').map((slot) => ({
      participant: participant.participant, offset: slot.offset,
    })));
  const tokenSlots = plan.participants.filter((participant) => participant.authority !== 'direct').flatMap((participant) =>
    participant.blockLayout!.slots.filter((slot) => slot.kind === 'tcTransfer').map((slot) => ({
      participant: participant.participant, offset: slot.offset,
    })));
  const sidecarSlots = plan.participants.filter((participant) => participant.authority !== 'direct').flatMap((participant) =>
    participant.blockLayout!.slots
      .filter((slot) => ['blockhashOracle', 'keccakSideCar', 'ecrecoverSideCar'].includes(slot.kind))
      .map((slot) => ({
        participant: participant.participant, offset: slot.offset,
        kind: slot.kind as AtomicSidecarSlotEffect['kind'],
      })));
  const hasComputedValueChunks = plan.participants.some((participant) =>
    participant.routeInputs.some((input) => input.name === '__internal__valueChunkOutputBase'));
  return {
    fixedEventSlots,
    runtimeEventSlots,
    eventSlots,
    hasRuntimeLoopEvents,
    resourceSlots,
    valueSlots,
    tokenSlots,
    sidecarSlots,
    hasComputedValueChunks,
  };
}

function effectsByParticipant(plans: readonly ExecutionContextEffectPlan[]): Map<number, {
  activeWrites: number[];
  activeEvents: number[];
  activeTransfers: number[];
  journalKeys: string[];
}> {
  const grouped = new Map<number, {
    activeWrites: number[]; activeEvents: number[]; activeTransfers: number[]; journalKeys: string[];
  }>();
  for (const plan of plans) {
    const participant = plan.participantIndex ?? 0;
    const effects = grouped.get(participant) ?? {
      activeWrites: [], activeEvents: [], activeTransfers: [], journalKeys: [],
    };
    // Ordinals are row-local. Two rows executing the same event require two slots.
    effects.activeWrites.push(...plan.activeWrites);
    effects.activeEvents.push(...plan.activeEvents);
    effects.activeTransfers.push(...plan.activeTransfers);
    effects.journalKeys.push(plan.journalKey);
    grouped.set(participant, effects);
  }
  return grouped;
}

/**
 * settle-time ExecutionContext: consume ExecutionContext effect plans against compose slot inventory.
 * Fail closed when a participant's active events/transfers exceed published slot capacity.
 */
export function assertComposeSlotsCoverEffectPlans(
  inventory: ComposeSlotInventory,
  plans: readonly ExecutionContextEffectPlan[],
): void {
  if (plans.length === 0) return;
  const eventSlots = inventory.eventSlots();
  for (const [participant, plan] of effectsByParticipant(plans)) {
    const events = eventSlots.filter((slot) => slot.participant === participant);
    if (plan.activeEvents.length > events.length) {
      throw new Error(
        `execution-context: participant ${participant} activeEvents=${plan.activeEvents.length} `
        + `exceed event slots=${events.length} (journalKeys=${plan.journalKeys.join(',')})`,
      );
    }
    const transfers = inventory.valueSlots.filter((slot) => slot.participant === participant);
    if (plan.activeTransfers.length > transfers.length) {
      throw new Error(
        `execution-context: participant ${participant} activeTransfers=${plan.activeTransfers.length} `
        + `exceed transfer slots=${transfers.length} (journalKeys=${plan.journalKeys.join(',')})`,
      );
    }
  }
}

/**
 * settle-time ExecutionContext: prune event/transfer slots for participants whose effect plans activate none of that kind.
 * Participants without a plan are left unchanged.
 */
export function pruneComposeSlotInventoryByEffectPlans(
  inventory: ComposeSlotInventory,
  plans: readonly ExecutionContextEffectPlan[],
): ComposeSlotInventory {
  if (plans.length === 0) return inventory;
  const byParticipant = effectsByParticipant(plans);
  const fixedEventSlots = inventory.fixedEventSlots.filter((slot) => {
    const plan = byParticipant.get(slot.participant);
    if (plan === undefined) return true;
    return plan.activeEvents.length > 0;
  });
  const valueSlots = inventory.valueSlots.filter((slot) => {
    const plan = byParticipant.get(slot.participant);
    if (plan === undefined) return true;
    return plan.activeTransfers.length > 0;
  });
  // settle-time ExecutionContext: prune dataNft/entry resource slots when the plan activates no state writes.
  const resourceSlots = inventory.resourceSlots.filter((slot) => {
    const plan = byParticipant.get(slot.participant);
    if (plan === undefined) return true;
    if (plan.activeWrites.length > 0) return true;
    return slot.kind !== 'dataNft' && slot.kind !== 'entry' && slot.kind !== 'readOnlyDataNft';
  });
  // Settle-time ExecutionContext: prune token slots with transfers;
  // prune sidecars when the participant is fully inactive.
  const tokenSlots = inventory.tokenSlots.filter((slot) => {
    const plan = byParticipant.get(slot.participant);
    if (plan === undefined) return true;
    return plan.activeTransfers.length > 0;
  });
  // settle-time ExecutionContext: kind-specific sidecar pruning —
  // keccak/ecrecover keep with active writes; blockhash keeps with any activity.
  const sidecarSlots = inventory.sidecarSlots.filter((slot) => {
    const plan = byParticipant.get(slot.participant);
    if (plan === undefined) return true;
    if (slot.kind === 'keccakSideCar' || slot.kind === 'ecrecoverSideCar') {
      return plan.activeWrites.length > 0;
    }
    if (slot.kind === 'blockhashOracle') {
      return plan.activeWrites.length > 0
        || plan.activeEvents.length > 0
        || plan.activeTransfers.length > 0;
    }
    return plan.activeWrites.length > 0
      || plan.activeEvents.length > 0
      || plan.activeTransfers.length > 0;
  });
  const runtimeEventSlots = new Map<number, Array<{
    participant: number; offset: number; runtimeRow: number; eventSignature: string;
  }>>();
  for (const [key, rows] of inventory.runtimeEventSlots) {
    const kept = rows.filter((slot) => {
      const plan = byParticipant.get(slot.participant);
      if (plan === undefined) return true;
      return plan.activeEvents.length > 0;
    });
    if (kept.length > 0) runtimeEventSlots.set(key, kept);
  }
  // settle-time ExecutionContext: plan-driven width/offset remap — dense offsets per participant after prune.
  const remapDense = <T extends { participant: number; offset: number }>(
    slots: readonly T[],
  ): T[] => {
    const slotsByParticipant = new Map<number, T[]>();
    for (const slot of slots) {
      const list = slotsByParticipant.get(slot.participant) ?? [];
      list.push(slot);
      slotsByParticipant.set(slot.participant, list);
    }
    const remapped: T[] = [];
    for (const [participant, list] of [...slotsByParticipant.entries()].sort((a, b) => a[0] - b[0])) {
      const ordered = [...list].sort((left, right) => left.offset - right.offset);
      ordered.forEach((slot, index) => {
        remapped.push({ ...slot, participant, offset: index });
      });
    }
    return remapped;
  };
  const remappedFixedEvents = remapDense(fixedEventSlots);
  const remappedValueSlots = remapDense(valueSlots);
  const remappedSidecars = remapDense(sidecarSlots);
  const remappedRuntimeEventSlots = new Map<number, Array<{
    participant: number; offset: number; runtimeRow: number; eventSignature: string;
  }>>();
  for (const [key, rows] of runtimeEventSlots) {
    remappedRuntimeEventSlots.set(key, remapDense(rows));
  }
  const remappedEventSlots = (): ReturnType<ComposeSlotInventory['eventSlots']> => [
    ...remappedFixedEvents,
    ...[...remappedRuntimeEventSlots.values()].flat(),
  ];
  return {
    ...inventory,
    fixedEventSlots: remappedFixedEvents,
    runtimeEventSlots: remappedRuntimeEventSlots,
    valueSlots: remappedValueSlots,
    resourceSlots,
    tokenSlots,
    sidecarSlots: remappedSidecars,
    eventSlots: remappedEventSlots,
  };
}
