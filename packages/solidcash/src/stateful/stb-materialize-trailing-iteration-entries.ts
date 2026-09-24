/**
 * phase-boundary extract: STB build-phase extract — pad to trailing resource base and emit iteration entry outputs.
 */

import type { FunctionBlockLayout } from '@solidcash/utils';
import type { Output, UnlockableUtxo } from '../interfaces.js';

export interface MaterializeTrailingIterationEntriesHost {
  readonly blockLayout?: FunctionBlockLayout;
  readonly iterationEntryInputs: readonly UnlockableUtxo[];
  readonly dynamicChunkVars: readonly unknown[];
  readonly loopEntriesBeforeDynamicChunks: boolean;
  readonly runtimeLoopEventOutputs: readonly unknown[];
  readonly runtimeLoopTransferOutputs: readonly unknown[];
  readonly valueChunkOutputs: readonly unknown[];
  readonly valueChunkVars: ReadonlyMap<unknown, unknown>;
  readonly iterationEntriesPlacedAtDelegateBase: boolean;
  readonly categoryId: string;
  getChunkOutputBase(): number;
  trailingLoopEntryOutputCount(): number;
  getLoopEntryOutputBase(): number;
  trailingLoopEntryVars(): readonly unknown[];
  getRuntimeLoopEventOutputBase(): number;
  getRuntimeLoopTransferOutputIndex(index: number): number;
  getValueChunkOutputBase(): number;
}

/**
 * Pad unused fixed slots up to the first trailing resource base, then emit iteration entry
 * NFT recreations (unless already placed before callees / at the delegate base).
 */
export function materializeTrailingIterationEntries(
  host: MaterializeTrailingIterationEntriesHost,
  builder: {
    outputs: Output[];
    addOutput(output: Output): unknown;
  },
  loopChunkBeforeCallees: boolean,
): void {
  // Iteration entry outputs (read-only co-spent chunks / collection-iter entries) come FIRST in the trailing
  // region, preserved at their input index [blockSize, blockSize+count) (the chunk covenant pins
  // output==input). New chunk outputs follow, after getChunkOutputBase() (which includes this count).
  // Skipped when already emitted before the callee outputs (loop external-call case).
  // A balanced block can reserve fixed slots that are absent from this concrete call. Runtime trailing
  // resources still begin at the compiler-owned trailingBase; pad those unused fixed slots BEFORE emitting
  // iteration entries/chunks/loop entries. Padding after the resources shifts every physical output below the
  // index verified by the covenant (for example, computed base 228 while chunks were emitted at 204).
  if (host.blockLayout) {
    const resourceBases: number[] = [];
    if (host.iterationEntryInputs.length > 0 || host.dynamicChunkVars.length > 0) {
      resourceBases.push(host.getChunkOutputBase() - host.iterationEntryInputs.length
        - (host.loopEntriesBeforeDynamicChunks ? host.trailingLoopEntryOutputCount() : 0)
        - host.runtimeLoopEventOutputs.length - host.runtimeLoopTransferOutputs.length);
    }
    if (host.trailingLoopEntryVars().length > 0) resourceBases.push(host.getLoopEntryOutputBase());
    if (host.runtimeLoopEventOutputs.length > 0) {
      resourceBases.push(host.getRuntimeLoopEventOutputBase());
    }
    if (host.runtimeLoopTransferOutputs.length > 0) {
      resourceBases.push(host.getRuntimeLoopTransferOutputIndex(0));
    }
    if (host.valueChunkOutputs.length > 0 || host.valueChunkVars.size > 0) {
      resourceBases.push(host.getValueChunkOutputBase());
    }
    const firstResourceBase = resourceBases.length > 0 ? Math.min(...resourceBases) : undefined;
    while (firstResourceBase !== undefined && builder.outputs.length < firstResourceBase) {
      builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
    }
  }
  for (const iterUtxo of (
    loopChunkBeforeCallees || host.iterationEntriesPlacedAtDelegateBase
      ? [] : host.iterationEntryInputs
  )) {
    builder.addOutput({
      to: iterUtxo.unlocker.generateLockingBytecode(),
      amount: iterUtxo.satoshis,
      token: {
        amount: iterUtxo.token?.amount ?? 0n,
        category: host.categoryId,
        nft: {
          capability: 'mutable',
          commitment: iterUtxo.token?.nft?.commitment ?? '',
        },
      },
    });
  }
}
