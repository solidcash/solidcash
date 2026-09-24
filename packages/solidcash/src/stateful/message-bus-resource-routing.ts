/**
 * phase-boundary extract: message-bus resource routing helpers (phase-boundary extract from StatefulContract.ts).
 */

import type { AbiFunction } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';

/** Runtime resources selected by a concrete message-bus envelope. The published route ABI describes the
 * bounded union of every eligible handler, while mutating transaction resources follow only authenticated rows. */
export function selectedMessageBusResourceMetadata(
  rows: readonly { handler: AbiFunction }[] | undefined,
): {
    entryLoopWrites: readonly string[];
    entryLoopWriteSignatures: Readonly<Record<string, string>>;
    loopCollections: readonly string[];
    dynamicReads: readonly string[];
    dynamicWrites: readonly string[];
  } {
  const entryLoopWrites = new Set<string>();
  const entryLoopWriteSignatures: Record<string, string> = {};
  const loopCollections = new Set<string>();
  const dynamicReads = new Set<string>();
  const dynamicWrites = new Set<string>();
  for (const { handler } of rows ?? []) {
    for (const collection of handler.entryLoopWrites ?? []) {
      entryLoopWrites.add(collection);
      loopCollections.add(collection);
    }
    for (const collection of handler.sortedInsertLoops ?? []) loopCollections.add(collection);
    for (const info of handler.sortedInsertLoopInfo ?? []) loopCollections.add(info.collection);
    for (const info of handler.sortedUpsertLoopInfo ?? []) loopCollections.add(info.collection);
    for (const variable of handler.dynamicReads ?? []) dynamicReads.add(variable);
    for (const variable of handler.dynamicWrites ?? []) dynamicWrites.add(variable);
    for (const [collection, signature] of Object.entries(handler.entryLoopWriteSignatures ?? {})) {
      const previous = entryLoopWriteSignatures[collection];
      if (previous !== undefined && previous !== signature) {
        throw new Error(`Selected message-bus handlers disagree on collection signature for '${collection}'`);
      }
      entryLoopWriteSignatures[collection] = signature;
    }
  }
  return {
    entryLoopWrites: [...entryLoopWrites],
    entryLoopWriteSignatures,
    loopCollections: [...loopCollections],
    dynamicReads: [...dynamicReads],
    dynamicWrites: [...dynamicWrites],
  };
}

/** Move route-owned dynamic inputs from executor-relative provisional slots to the state owner's published
 * trailing band. The displaced balanced funders retain the provisional positions, preserving total block width. */
export function anchorRoutedDynamicResourcesAtOwner<T extends { token?: unknown }>(
  blockInputs: readonly T[],
  resources: readonly { blockSlot: number; name: string }[],
  executorOffset: number,
): T[] {
  const anchored = [...blockInputs];
  for (const resource of resources) {
    const shiftedSlot = resource.blockSlot + executorOffset;
    const destination = anchored[resource.blockSlot];
    const source = anchored[shiftedSlot];
    if (!source) {
      throw new Error(
        `Nested dynamic state '${resource.name}' has no provisional routed slot ${shiftedSlot}`,
      );
    }
    if (destination?.token) {
      throw new Error(
        `Nested dynamic state '${resource.name}' overlaps a fixed routed resource at `
        + `block slot ${resource.blockSlot}`,
      );
    }
    anchored[resource.blockSlot] = source;
    anchored[shiftedSlot] = destination;
  }
  return anchored;
}

/** A compiler route needs the physical entry ABI only when an actual wrapper entry point carries it. Synthetic
 * routes live exclusively in message-bus metadata, so the absence of a same-named physical ABI is not a wrapper. */
export function compilerRouteUsesPhysicalWrapper(
  compilerRouteSelector: Uint8Array | undefined,
  physicalAbiFunction: AbiFunction | undefined,
  effectiveAbiFunction: AbiFunction | undefined,
): boolean {
  return compilerRouteSelector !== undefined
    && physicalAbiFunction !== undefined
    && effectiveAbiFunction !== undefined
    && physicalAbiFunction !== effectiveAbiFunction;
}

/** Rebase compiler-route proof offsets when an implementation block is embedded after a proxy's state prefix.
 * Batch proof witnesses are relative to the authenticated state owner, unlike ordinary implementation block slots
 * which are relative to the executor. Negative sentinels and output-relative witnesses are intentionally unchanged. */
export function rebaseRoutedBatchProofOffsets(
  internalArgs: Readonly<Record<string, FunctionArgument>>,
  executorOffset: number,
): Record<string, FunctionArgument> {
  if (executorOffset === 0) return { ...internalArgs };
  const delta = BigInt(executorOffset);
  return Object.fromEntries(Object.entries(internalArgs).map(([name, value]) => [
    name,
    /^__internal__vmapBatchProof_\d+$/.test(name) && typeof value === 'bigint' && value >= 0n
      ? value + delta : value,
  ]));
}

