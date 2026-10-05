/**
 * phase-boundary extract: STB class-body extract — rebase materialized PredOut witnesses and reassert
 * batch/planned predecessor outputs against final physical masters.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { reassertBatchPredecessorOutputsAtDeclaredSlots } from './mutable-output-reassert.js';
import { materializedPredOutBase } from './writer-event-delegate-layout.js';
import { binToHex } from '@bitauth/libauth';

type MaterializedPredOutFrame = {
  inputs: readonly {
    token?: { nft?: { commitment?: string | Uint8Array } };
    unlocker?: { generateLockingBytecode?: () => Uint8Array };
  }[];
  outputs: readonly {
    to?: string | Uint8Array;
    token?: { nft?: { commitment?: string | Uint8Array } };
  }[];
};

const asHex = (value: string | Uint8Array | undefined): string | undefined => (
  value === undefined ? undefined : typeof value === 'string' ? value : binToHex(value)
);

/**
 * Rebind active INSERT PredOut witnesses only when an output proves both the authenticated collection lock and
 * the exact P' content (`pred.slot || target.slot || pred.value`). Proof coordinates can be frame-absolute or
 * participant-relative, so both interpretations are considered and an ambiguous result is rejected.
 */
export function resolveMaterializedPredOutUpdates(
  internalArgs: Readonly<Record<string, unknown>>,
  frame: MaterializedPredOutFrame,
  participantMasterIndex: number,
): Record<string, bigint> {
  const updates: Record<string, bigint> = {};
  for (const [name, current] of Object.entries(internalArgs)) {
    const match = /^__internal__vmapBatchPredOut_(\d+)$/.exec(name);
    if (match === null || typeof current !== 'bigint' || current < 0n) continue;
    const suffix = match[1];
    const proof = internalArgs[`__internal__vmapBatchProof_${suffix}`];
    const target = internalArgs[`__internal__vmapBatchSlot_${suffix}`];
    if (typeof proof !== 'bigint' || proof < 0n || !(target instanceof Uint8Array) || target.length !== 32) continue;
    const proofIndices = new Set([Number(proof), participantMasterIndex + Number(proof)]);
    const matches = new Set<number>();
    for (const proofIndex of proofIndices) {
      const input = frame.inputs[proofIndex];
      const predecessor = asHex(input?.token?.nft?.commitment);
      const requiredLock = input?.unlocker?.generateLockingBytecode?.();
      if (predecessor === undefined || predecessor.length < 128 || requiredLock === undefined) continue;
      const expected = `${predecessor.slice(0, 64)}${binToHex(target)}${predecessor.slice(128)}`.toLowerCase();
      for (const [outputIndex, output] of frame.outputs.entries()) {
        const outputLock = output.to instanceof Uint8Array ? output.to : undefined;
        if (outputLock === undefined || outputLock.length !== requiredLock.length
          || !outputLock.every((byte, index) => byte === requiredLock[index])) continue;
        if (asHex(output.token?.nft?.commitment)?.toLowerCase() === expected) matches.add(outputIndex);
      }
    }
    if (matches.size !== 1) continue;
    const [resolved] = matches;
    if (resolved !== Number(current)) updates[name] = BigInt(resolved!);
  }
  return updates;
}

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
    const mergedArgs = { ...carrier.compilerRoute?.internalArgs, ...carrier.internalArgs };
    const contentUpdates = resolveMaterializedPredOutUpdates(mergedArgs, builder, masterIndex);
    if (Object.keys(contentUpdates).length > 0) {
      carrier.refreshInternalArgs(contentUpdates, { shiftPredOut: false });
      changedCarriers.add(carrier);
    }
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
