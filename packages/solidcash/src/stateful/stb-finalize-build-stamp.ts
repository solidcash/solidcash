/**
 * phase-boundary extract: STB build-phase extract — final derived-chunk stamp, unlocker sync, view-return ensure.
 */

import { binToHex } from '@bitauth/libauth';
import type { FunctionBlockLayout } from '@solidcash/utils';
import type { UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import type { EntryNftInfo } from './external-call-utxo-group.js';

export interface FinalizeBuildStampHost {
  readonly allInputs: readonly UnlockableUtxo[];
  readonly entryNfts: readonly EntryNftInfo[];
  readonly entryDeletes: ReadonlySet<number>;
  readonly blockLayout?: FunctionBlockLayout;
  readonly pendingOutputs: readonly unknown[];
  readonly externalIdentityAnchorUtxos: readonly UnlockableUtxo[];
  readonly logicalIdentityUtxo?: UnlockableUtxo;
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly funderUtxos: readonly UnlockableUtxo[];
  readonly valueChunkOutputs: readonly unknown[];
  readonly lateValueChunkOutputs: readonly unknown[];
  readonly delegateDynamicChunksAtSuffix: boolean;
  readonly compilerRouteDelegateBlock: boolean;
  readonly delegateEntriesAfterLowLevel: boolean;
  readonly authenticatedViewReturnByGroup: ReadonlyMap<number, { categoryId: string; commitment: string }>;
  applyDerivedValueChunks(builder: TransactionBuilder): boolean | void;
  reassertStagedValueChunkOutputs(builder: TransactionBuilder): void;
  stripSurplusDerivedValueChunkLocks(builder: TransactionBuilder): void;
  stripEmptyDuplicateEntryLocks(builder: TransactionBuilder): void;
  syncBuilderUnlockers(builder: TransactionBuilder): void;
  dynamicChunkOutputCount(): number;
  ensureAuthenticatedViewReturns(builder: TransactionBuilder): boolean;
  reconcileMaterializedReturnWitnesses(builder: TransactionBuilder): boolean;
}

/**
 * Re-apply derived value chunks, sync unlockers, ensure authenticated view returns converge,
 * and emit optional late-build debug dumps.
 */
export function finalizeBuildStamp(
  host: FinalizeBuildStampHost,
  builder: TransactionBuilder,
  debugAtomicOutputStage: (stage: string) => void,
): void {
// earlier derived-chunk pass. Re-apply once at the end so OUTPUTBYTECODE pins stay authoritative.
  host.applyDerivedValueChunks(builder);
  host.reassertStagedValueChunkOutputs(builder);
  host.stripSurplusDerivedValueChunkLocks(builder);
  host.stripEmptyDuplicateEntryLocks(builder);
  // The final output passes above can relocate the balanced input twins which carry dynamic storage chunks.
  // Rebuild the master unlocker against that settled physical input order even when no other witness changed.
  host.syncBuilderUnlockers(builder);
  debugAtomicOutputStage('final');
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1' && (host.blockLayout?.blockSize ?? 0) > 100) {
    console.error('atomic-stateful-output-components', {
      blockSize: host.blockLayout?.blockSize,
      outputCount: builder.outputs.length,
      inputCount: host.allInputs.length,
      entries: host.entryNfts.length,
      entryDeletes: host.entryDeletes.size,
      events: host.blockLayout?.slots.filter((slot) => slot.kind === 'event').length ?? 0,
      trailingCapacity: host.blockLayout?.trailingCapacity ?? 0,
      pendingOutputs: host.pendingOutputs.length,
      externalIdentityAnchors: host.externalIdentityAnchorUtxos.length,
      logicalIdentityAnchor: host.logicalIdentityUtxo !== undefined,
      externalGroups: host.externalCallUtxoGroups.length,
      lowLevelGroups: host.lowLevelCallUtxoGroups.length,
      funders: host.funderUtxos.length,
      dynamicChunks: host.dynamicChunkOutputCount(),
      valueChunks: host.valueChunkOutputs.length,
      lateValueChunks: host.lateValueChunkOutputs.length,
      delegateDynamicChunksAtSuffix: host.delegateDynamicChunksAtSuffix,
      compilerRouteDelegateBlock: host.compilerRouteDelegateBlock,
      delegateEntriesAfterLowLevel: host.delegateEntriesAfterLowLevel,
    });
  }
  // Final stamp: never leave authenticated view returns on OP_RETURN or zero pads.
  // Reconcile can rebind witnesses; re-ensure until stable so Idx cannot stick on 0x6a.
  for (let ensurePass = 0; ensurePass < 3; ensurePass += 1) {
    const stamped = host.ensureAuthenticatedViewReturns(builder);
    const reconciled = host.reconcileMaterializedReturnWitnesses(builder);
    if (stamped || reconciled) host.syncBuilderUnlockers(builder);
    if (!stamped && !reconciled) break;
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
    console.error('ensure-auth-view-returns', {
      cached: [...host.authenticatedViewReturnByGroup.entries()],
      groups: host.externalCallUtxoGroups.map((group, index) => ({
        index,
        fn: group.logicalFunctionName ?? group.functionName,
        ret: group.returnOutputIndex,
        commit: group.returnOutputIndex !== undefined
          ? String(builder.outputs[group.returnOutputIndex]?.token?.nft?.commitment ?? '').slice(0, 66)
          : undefined,
        lock: group.returnOutputIndex !== undefined
        && builder.outputs[group.returnOutputIndex]?.to instanceof Uint8Array
          ? binToHex(builder.outputs[group.returnOutputIndex]!.to as Uint8Array).slice(0, 8)
          : undefined,
      })),
      returnWitnesses: [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]
        .filter((carrier) => carrier.returnWitnessGroups)
        .map((carrier) => ({
          fn: carrier.logicalFunctionName ?? carrier.functionName,
          groups: carrier.returnWitnessGroups,
          args: Object.fromEntries(
            Object.entries(carrier.internalArgs ?? {})
              .filter(([name]) => /ReturnOutputIdx/i.test(name))
              .map(([name, value]) => [name, String(value)]),
          ),
        })),
    });
  }

}
