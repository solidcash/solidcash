/**
 * phase-boundary extract: STB build-phase extract — late value-chunk suffix, trailer, and derived-output repairs.
 */

import { binToHex } from '@bitauth/libauth';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript, calculateDust } from '../utils.js';
import type { DerivedChunkOutputObservation } from './value-chunk-persist.js';

export interface FinalizeBuildDerivedSuffixHost {
  readonly lateValueChunkOutputs: readonly Output[];
  readonly sidecarUtxo?: UnlockableUtxo;
  readonly delegateDynamicChunksAtSuffix: boolean;
  readonly mintingOutputSwap?: { from: number; width: number; categoryId: string };
  readonly dynamicChunkVars: readonly unknown[];
  readonly allInputs: readonly UnlockableUtxo[];
  readonly derivedChunkOutputs: ReadonlyMap<number, DerivedChunkOutputObservation>;
  readonly externalCallEntryOutputsByIndex: ReadonlyMap<number, { commitment: string }>;
  dynamicChunkOutputCount(): number;
  fillSwappedTokenEntryHoles(builder: TransactionBuilder): void;
  applyDerivedValueChunks(builder: TransactionBuilder): void;
  applyDerivedEntryOutputs(builder: TransactionBuilder): void;
  constrainParticipantImmutableOutputs(builder: TransactionBuilder): void;
  restoreSwappedTokenFunderSlots(builder: TransactionBuilder): void;
  reassertReverseSuffixDynamicChunks(builder: TransactionBuilder): void;
}

/**
 * Emit late value chunks + sidecar/OP_RETURN trailer, then apply derived chunk/entry repairs and
 * reverse-suffix dynamic-chunk reassert before conservation repairs.
 */
export function finalizeBuildDerivedSuffix(
  host: FinalizeBuildDerivedSuffixHost,
  builder: TransactionBuilder,
  debugAtomicOutputStage: (stage: string) => void,
): void {
  for (const vco of host.lateValueChunkOutputs) {
    const chunkOutput = { ...vco };
    chunkOutput.amount = BigInt(Math.max(1200, calculateDust(chunkOutput)));
    builder.addOutput(chunkOutput);
  }

  // Reverse-suffix chunk indexing requires exactly ONE output after the late chunk region in every build,
  // including covenant-only probes and direct build() calls. A sidecar must be last for its self-preservation
  // covenant; otherwise use a zero-value OP_RETURN anchor. send() inserts any fee change BEFORE this suffix.
  const hasAuthenticatedChunkSuffix = host.lateValueChunkOutputs.length > 0
    || (host.delegateDynamicChunksAtSuffix && host.dynamicChunkOutputCount() > 0);
  if (hasAuthenticatedChunkSuffix) {
    if (host.sidecarUtxo) {
      builder.addOutput({
        to: host.sidecarUtxo.unlocker.generateLockingBytecode(),
        amount: host.sidecarUtxo.satoshis,
      });
    } else {
      builder.addOutput({ to: new Uint8Array([0x6a]), amount: 0n }); // OP_RETURN suffix anchor
    }
  }
  if (host.mintingOutputSwap) {
    host.fillSwappedTokenEntryHoles(builder);
  }
  // Absolute continuation-output witnesses are already bound at this point. Keep the remaining layout
  // append-only: deleting an earlier alignment cell would shift every later fixed-index value-chunk run into
  // the authenticated suffix. A harmless balanced pad is preferable to invalidating those coordinates.
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_CHUNK_SCAN === '1'
    && host.dynamicChunkVars.length > 0) {
    console.error('authenticated-chunk-suffix', {
      delegateDynamicChunksAtSuffix: host.delegateDynamicChunksAtSuffix,
      dynamicCount: host.dynamicChunkOutputCount(),
      lateCount: host.lateValueChunkOutputs.length,
      hasAuthenticatedChunkSuffix,
      outputCount: builder.outputs.length,
    });
  }
  // The final unused funder input of a bounded balanced layout remains after
  // the owner block; the outer transaction builder pairs it with change.

  // Last write: recovered chunk pins beat every later same-index recreation of the
  // previous digest (nested mutable mirror, empty-entry restore, dynamic suffix).
  host.applyDerivedValueChunks(builder);
  if (host.mintingOutputSwap) host.fillSwappedTokenEntryHoles(builder);
  host.applyDerivedEntryOutputs(builder);
  host.constrainParticipantImmutableOutputs(builder);
  host.restoreSwappedTokenFunderSlots(builder);
  // Reverse-suffix jobs (TXOUTPUTCOUNT-1-nNew) must be the last covenant outputs before
  // the trailer. Late value-chunks / derived pins can displace or reorder them — pin the
  // authenticated commitments back onto that window in declaration order.
  host.reassertReverseSuffixDynamicChunks(builder);
  debugAtomicOutputStage('derived-output-repairs');
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_CHUNK_SCAN === '1' && host.externalCallEntryOutputsByIndex.size > 0) {
    console.error('derived-entry-outputs', [...host.externalCallEntryOutputsByIndex.entries()].map(
      ([index, placed]) => ({
        index,
        placed: placed.commitment.slice(0, 24),
        actual: String(builder.outputs[index]?.token?.nft?.commitment ?? '').slice(0, 24),
        cat: builder.outputs[index]?.token?.category?.slice(0, 8),
      }),
    ));
  }
  if (host.mintingOutputSwap && (globalThis as { process?: { env?: Record<string, string> } }).process
    ?.env?.SOLIDC_DEBUG_CHUNK_SCAN === '1') {
    console.error('swap-output-count', {
      swap: host.mintingOutputSwap,
      outputs: builder.outputs.length,
      inputs: host.allInputs.length,
      tail: builder.outputs.slice(28).map((output, offset) => ({
        i: 28 + offset,
        cat: output.token?.category?.slice(0, 8)
          ?? (output.to instanceof Uint8Array ? binToHex(output.to).slice(0, 8) : 'addr'),
        cap: output.token?.nft?.capability ?? '-',
      })),
    });
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_CHUNK_SCAN === '1') {
    const dumpIndex = (index: number): Record<string, unknown> => {
      const output = builder.outputs[index];
      const lock = output?.to instanceof Uint8Array
        ? output.to
        : output?.to !== undefined ? addressToLockScript(output.to) : undefined;
      return {
        index,
        lock: lock ? binToHex(lock).slice(0, 16) : undefined,
        cap: output?.token?.nft?.capability,
        commit: String(output?.token?.nft?.commitment ?? '').slice(0, 16),
        derived: host.derivedChunkOutputs.has(index)
          ? binToHex(host.derivedChunkOutputs.get(index)!.lockingBytecode).slice(0, 16)
          : undefined,
      };
    };
    console.error('derived-chunk-final', {
      pins: [...host.derivedChunkOutputs.entries()].map(([index, chunk]) => ({
        index, lock: binToHex(chunk.lockingBytecode).slice(0, 16), commit: chunk.commitment.slice(0, 16),
        semanticKind: chunk.semanticKind, resourceIdentity: chunk.resourceIdentity,
        resourcePart: chunk.resourcePart,
      })),
      outputs: [18, 19, 20, 21, 22, 23].map(dumpIndex),
    });
  }
}
