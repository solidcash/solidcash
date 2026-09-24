/**
 * phase-boundary extract: STB class-body extract — rebase materialized PredOut witnesses and reassert
 * batch/planned predecessor outputs against final physical masters.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { reassertBatchPredecessorOutputsAtDeclaredSlots } from './mutable-output-reassert.js';
import { materializedPredOutBase } from './writer-event-delegate-layout.js';

export interface MaterializedPredOutReconcileHost {
  readonly allInputs: readonly UnlockableUtxo[];
  readonly externalCallUtxoGroups: ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  syncRefreshedCarrierMasters(
    builder: TransactionBuilder,
    carriers: ReadonlySet<ExternalCallUtxoGroup>,
  ): void;
}

/** Rebase absolute predecessor-output witnesses from each participant's final physical master coordinate. */
export function reconcileMaterializedPredOutWitnesses(
  host: MaterializedPredOutReconcileHost,
  builder: TransactionBuilder,
): boolean {
  const changedCarriers = new Set<ExternalCallUtxoGroup>();
  for (const carrier of [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]) {
    if (!carrier.refreshInternalArgs) continue;
    const predOutArgs = Object.entries({
      ...carrier.compilerRoute?.internalArgs,
      ...carrier.internalArgs,
    }).filter(([name, value]) => /^__internal__vmapBatchPredOut_\d+$/.test(name)
      && typeof value === 'bigint' && value >= 0n);
    if ((carrier.batchPredecessorOutputs?.length ?? 0) === 0 && predOutArgs.length === 0) continue;
    const master = carrier.masterUtxo as UnlockableUtxo | undefined;
    if (!master) continue;
    const masterIndex = host.allInputs.findIndex((input) => (
      input.txid.toLowerCase() === master.txid.toLowerCase() && input.vout === master.vout
    ));
    if (masterIndex < 0) continue;
    const nextBase = materializedPredOutBase(carrier, masterIndex);
    if (carrier.relocatedPredOutBase === nextBase) continue;
    carrier.relocatedPredOutBase = nextBase;
    carrier.refreshInternalArgs({}, { shiftPredOut: false });
    changedCarriers.add(carrier);
  }
  if (changedCarriers.size === 0) return false;
  host.syncRefreshedCarrierMasters(builder, changedCarriers);
  return true;
}

/** Reconcile materialized predecessor outputs with the same final physical masters as their witnesses. */
export function reassertMaterializedBatchPredecessorOutputs(
  host: MaterializedPredOutReconcileHost,
  builder: TransactionBuilder,
): boolean {
  let changed = 0;
  const carriers = [
    ...host.externalCallUtxoGroups.map((carrier) => ({ carrier, directParticipant: true })),
    ...host.lowLevelCallUtxoGroups.map((carrier) => ({ carrier, directParticipant: false })),
  ];
  for (const { carrier, directParticipant } of carriers) {
    if (!carrier.categoryId) continue;
    const master = carrier.masterUtxo as UnlockableUtxo | undefined;
    if (!master) continue;
    const masterIndex = host.allInputs.findIndex((input) => (
      input.txid.toLowerCase() === master.txid.toLowerCase() && input.vout === master.vout
    ));
    // Direct participant INSERTs place NEW at the fixed entry slot and P' at the declared trailing slot.
    // A delegate's compiler uses its co-spent fixed slot for P' and the trailing slot for NEW, so its planned
    // insertion must remain trace-derived and must not use this direct-participant reassertion.
    const plannedPredecessors = (directParticipant && carrier.delegateCallGroupIndex === undefined
      ? carrier.plannedEntryInserts ?? [] : [])
      .flatMap((planned) => {
      const input = carrier.blockInputs?.[planned.blockSlot];
      if (!input?.unlocker || planned.outputBlockSlot < 0 || planned.commitment === undefined) return [];
      return [{
        outputBlockSlot: planned.outputBlockSlot,
        lockingBytecode: input.unlocker.generateLockingBytecode(),
        commitment: planned.commitment,
      }];
      });
    // Same minting-master gate as token-insert repair: a stale masterIndex writes
    // P' before the real FakeToken block (post two @12) and leaves a balances clone.
    const masterOut = masterIndex >= 0 ? builder.outputs[masterIndex] : undefined;
    const masterIsMinting = masterOut?.token?.category === carrier.categoryId
      && masterOut.token?.nft?.capability === 'minting';
    if (!masterIsMinting) continue;
    if ((carrier.batchPredecessorOutputs?.length ?? 0) > 0) {
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_TOKEN_INSERT === '1') {
        console.error('materialized-pred-reassert', {
          fn: carrier.logicalFunctionName ?? carrier.functionName,
          categoryId: carrier.categoryId.slice(0, 16),
          masterIndex,
          slots: carrier.batchPredecessorOutputs!.map((p) => p.outputBlockSlot),
          dests: carrier.batchPredecessorOutputs!.map((p) => masterIndex + p.outputBlockSlot),
        });
      }
      changed += reassertBatchPredecessorOutputsAtDeclaredSlots(
        builder.outputs,
        masterIndex,
        carrier.categoryId,
        carrier.batchPredecessorOutputs!,
      );
    }
    if (plannedPredecessors.length > 0) {
      changed += reassertBatchPredecessorOutputsAtDeclaredSlots(
        builder.outputs,
        masterIndex,
        carrier.categoryId,
        plannedPredecessors,
        true,
      );
    }
  }
  return changed > 0;
}
