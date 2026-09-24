/**
 * phase-boundary extract: STB build-phase extract — trailing loop entries, capacity pad, compiler-delegate executor, pending outputs.
 */

import type { FunctionBlockLayout } from '@solidcash/utils';
import type { Output } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { calculateDust } from '../utils.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';

export type LoopEntryVarLike = {
  collection: string;
  lockingBytecode: Uint8Array;
  categoryId?: string;
  delegate?: boolean;
};

export type ValueChunkVarLike = {
  id: string;
  collection: string;
};

export interface MaterializeTrailingFrameAndPendingHost {
  readonly loopEntriesBeforeDynamicChunks: boolean;
  readonly delegateEntriesAfterLowLevel: boolean;
  readonly loopEntryCommitments: ReadonlyMap<string, readonly string[]>;
  readonly categoryId: string;
  readonly blockLayout?: FunctionBlockLayout;
  readonly iterationEntryInputs: readonly unknown[];
  readonly runtimeLoopEventOutputs: readonly unknown[];
  readonly runtimeLoopTransferOutputs: readonly unknown[];
  readonly valueChunkOutputs: readonly unknown[];
  readonly valueChunkRawCommitments: ReadonlyMap<string, readonly string[]>;
  readonly loopEntryVars: readonly LoopEntryVarLike[];
  readonly compilerRouteDelegateBlock: boolean;
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly pendingOutputs: readonly Output[];
  trailingLoopEntryVars(): readonly LoopEntryVarLike[];
  loopEntryTransitionSatoshis(variable: LoopEntryVarLike, commitment: string): bigint | undefined;
  dynamicChunkOutputCount(): number;
  trailingLoopEntryOutputCount(): number;
  getValueChunkVars(): Iterable<ValueChunkVarLike>;
}

/**
 * Emit trailing loop-entry NFTs (when not already placed), enforce/pad balanced trailing capacity,
 * place remaining compiler-route delegate executors, and append buffered pending outputs.
 */
export function materializeTrailingFrameAndPending(
  host: MaterializeTrailingFrameAndPendingHost,
  builder: TransactionBuilder,
  appendValueChunks: () => void,
  associatedDelegateOutputs: ReadonlySet<number>,
  appendDelegateGroupOutputs: (groupIndex: number) => void,
  debugOwnMutableOutputs: (stage: string) => void,
  debugAtomicOutputStage: (stage: string) => void,
): void {
// Loop mapping-write entry outputs (trailing, after any chunks). One new mutable entry NFT per loop iteration;
// commitments (key_enc||value_enc) come from auto-derivation (the covenant builds them on-chain per iteration).
if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
  ?.SOLIDC_DEBUG_FAILURE_RING === '1') {
  console.error('builder-loop-entry-vars', host.loopEntryVars.map((value) => ({
    collection: value.collection,
    categoryId: value.categoryId,
    delegate: value.delegate,
    commitments: host.loopEntryCommitments.get(value.collection),
  })));
}
for (const lv of (host.loopEntriesBeforeDynamicChunks || host.delegateEntriesAfterLowLevel
  ? [] : host.trailingLoopEntryVars())) {
  const commitments = host.loopEntryCommitments.get(lv.collection) ?? [];
  for (const commitment of commitments) {
    const entryOutput = {
      to: lv.lockingBytecode,
      amount: 1200n,
      token: {
        amount: 0n,
        category: lv.categoryId ?? host.categoryId,
        nft: { capability: 'mutable' as const, commitment },
      },
    };
    entryOutput.amount = host.loopEntryTransitionSatoshis(lv, commitment)
      ?? BigInt(Math.max(1200, calculateDust(entryOutput)));
    builder.addOutput(entryOutput);
  }
}
debugOwnMutableOutputs('after-loop-entries');

// P5b value chunks (Design D), placed AFTER every covenant-managed output (entries, dynamic chunks,
// loop-entry NEW nodes). DIRECT values are injected exactly (valueChunkOutputs); COMPUTED values are
// trace-derived (valueChunkVars, commitments filled by auto-derivation).
if (!host.delegateEntriesAfterLowLevel) appendValueChunks();

const trailingCapacity = host.blockLayout?.trailingCapacity ?? 0;
if (trailingCapacity > 0) {
  const trailingOutputCounts = {
    iterationEntries: host.iterationEntryInputs.length,
    dynamicChunks: host.dynamicChunkOutputCount(),
    loopEntries: host.trailingLoopEntryOutputCount(),
    runtimeLoopEvents: host.runtimeLoopEventOutputs.length,
    runtimeLoopTransfers: host.runtimeLoopTransferOutputs.length,
    literalValueChunks: host.valueChunkOutputs.length,
    derivedValueChunks: [...host.getValueChunkVars()].reduce(
      (sum, value) => sum + (host.valueChunkRawCommitments.get(value.id) ?? []).length,
      0,
    ),
  };
  const trailingOutputCount = Object.values(trailingOutputCounts).reduce((sum, count) => sum + count, 0);
  if (trailingOutputCount > trailingCapacity) {
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_TRAILING_CAPACITY === '1') {
      console.error('balanced-trailing-capacity', JSON.stringify({
        capacity: trailingCapacity,
        counts: trailingOutputCounts,
        loopEntries: host.loopEntryVars.map((value) => ({
          collection: value.collection,
          delegate: value.delegate,
          commitments: host.loopEntryCommitments.get(value.collection)?.length ?? 0,
        })),
        valueChunks: [...host.getValueChunkVars()].map((value) => ({
          id: value.id,
          collection: value.collection,
          commitments: (host.valueChunkRawCommitments.get(value.id) ?? []).map((commitment) => ({
            bytes: commitment.length / 2,
            head: commitment.slice(0, 20),
          })),
        })),
      }));
    }
    throw new Error(
      'Runtime resource outputs exceed balanced trailing capacity '
      + `(${trailingOutputCount} > ${trailingCapacity})`,
    );
  }
  for (let i = trailingOutputCount; i < trailingCapacity; i++) {
    builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
  }
}
debugAtomicOutputStage('balanced-trailing-frame');

if (host.compilerRouteDelegateBlock) {
  host.lowLevelCallUtxoGroups.forEach((group, groupIndex) => {
    if (group.callMode === 'delegatecall' && !associatedDelegateOutputs.has(groupIndex)) {
      appendDelegateGroupOutputs(groupIndex);
    }
  });
}
debugAtomicOutputStage('compiler-delegate-executor');

// Append any extra outputs buffered via addOutput()
for (const output of host.pendingOutputs) {
  builder.addOutput(output);
}
debugOwnMutableOutputs('after-pending-outputs');

}
