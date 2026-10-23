/**
 * phase-boundary extract: STB class-body extract — rebind return-index arguments after every output
 * owner has materialized.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { isContractUnlocker } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { returnEventNftCommitment } from './return-event-nft-commitment.js';
import { callRecordHashesResult } from './call-record.js';
import {
  matchMaterializedReturnOutputs,
  type MaterializedReturnExpectation,
} from './scid-minting-return-layout.js';
import { isViewReturnTailOutput } from './value-chunk-band-helpers.js';
import {
  groupOwnsInBlockReturnEvent,
  logicalReturnGroupIndex,
} from './value-chunk-geometry.js';

export type MaterializedReturnPendingEvent = {
  categoryId: string;
  commitment: Uint8Array;
  identity: string;
  provisional?: boolean;
};

export interface MaterializedReturnWitnessReconcileHost {
  readonly externalCallUtxoGroups: ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly pendingReturnEventOutputs: readonly MaterializedReturnPendingEvent[];
  getBuiltExternalCallReturnEventOutputIndex(groupIdx: number): number;
  syncRefreshedCarrierMasters(
    builder: TransactionBuilder,
    carriers: ReadonlySet<ExternalCallUtxoGroup>,
  ): void;
  /** The digest of the call a direct return record answers; none for a routed one. */
  callRecordDigest?(identity: string): Uint8Array | undefined;
}

/** Rebind return-index arguments after every output owner has materialized. */
export function reconcileMaterializedReturnWitnesses(
  host: MaterializedReturnWitnessReconcileHost,
  builder: TransactionBuilder,
): boolean {
  const resolved = new Map<number, number>();
  const tailExpectations: MaterializedReturnExpectation[] = [];
  for (const [groupIdx, group] of host.externalCallUtxoGroups.entries()) {
    if (groupOwnsInBlockReturnEvent(host.externalCallUtxoGroups, groupIdx)) {
      // A writer block can grow after the compiler layout is emitted (for
      // example, a materialized predecessor slot). Prefer the already-bound
      // coordinate when final output content proves it; the static
      // master+returnSlot fallback can then be one position early.
      const matchesWriterReturn = (index: number): boolean => {
        const output = builder.outputs[index];
        return index >= 0
          && isViewReturnTailOutput(output)
          && output.token?.category.toLowerCase() === group.categoryId.toLowerCase();
      };
      const actual = [
        group.returnOutputIndex,
        host.getBuiltExternalCallReturnEventOutputIndex(groupIdx),
      ].find((index): index is number => index !== undefined && matchesWriterReturn(index));
      if (actual !== undefined) resolved.set(groupIdx, actual);
      continue;
    }
    const identityIndices = new Set([
      groupIdx,
      logicalReturnGroupIndex(host.externalCallUtxoGroups, groupIdx),
      group.fusedReturnGroupIndex,
    ].filter((index): index is number => index !== undefined));
    const pending = host.pendingReturnEventOutputs.find((event) => [...identityIndices].some((index) => (
      event.identity === `external-call:${index}`
        || event.identity === `external-call:${index}:0`
    )));
    const commitment = pending?.commitment
      ?? group.precomputedReturnCommitment
      ?? group.loopReturnCommitments?.[0];
    if (commitment === undefined) continue;
    const digest = host.callRecordDigest?.(pending?.identity ?? `external-call:${groupIdx}`);
    tailExpectations.push({
      groupIndex: groupIdx,
      categoryId: pending?.categoryId ?? group.categoryId,
      commitment,
      ...(digest === undefined ? {} : { digest }),
      currentIndex: group.returnOutputIndex,
      builtIndex: host.getBuiltExternalCallReturnEventOutputIndex(groupIdx),
    });
  }
  for (const [groupIdx, outputIndex] of matchMaterializedReturnOutputs(
    builder.outputs, tailExpectations,
  )) resolved.set(groupIdx, outputIndex);

  let changed = false;
  for (const [groupIdx, outputIndex] of resolved) {
    const group = host.externalCallUtxoGroups[groupIdx];
    if (!group || group.returnOutputIndex === outputIndex) continue;
    group.returnOutputIndex = outputIndex;
    changed = true;
  }
  const changedCarriers = new Set<ExternalCallUtxoGroup>();
  for (const carrier of [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]) {
    if (!carrier.refreshInternalArgs
      || (!carrier.returnWitnessGroups && !carrier.returnPreimageWitnessGroups)) continue;
    const updates: Record<string, bigint | Uint8Array> = {};
    for (const [name, groupIdx] of Object.entries(carrier.returnPreimageWitnessGroups ?? {})) {
      const identity = `external-call:${logicalReturnGroupIndex(host.externalCallUtxoGroups, groupIdx)}`;
      const exact = host.pendingReturnEventOutputs.find((event) => event.identity === identity);
      const first = host.pendingReturnEventOutputs.find((event) => event.identity === `${identity}:0`);
      const event = exact?.provisional && first ? first : exact ?? first;
      const raw = event?.commitment ?? host.externalCallUtxoGroups[groupIdx]?.precomputedReturnCommitment;
      if (raw && raw.length > 128
        && (!(carrier.internalArgs?.[name] instanceof Uint8Array)
          || binToHex(carrier.internalArgs[name] as Uint8Array) !== binToHex(raw))) {
        updates[name] = raw.slice();
      }
    }
    for (const [name, groupIdx] of Object.entries(carrier.returnWitnessGroups ?? {})) {
      const outputIndex = resolved.get(groupIdx);
      if (outputIndex === undefined || carrier.internalArgs?.[name] === BigInt(outputIndex)) continue;
      updates[name] = BigInt(outputIndex);
    }
    if (Object.keys(updates).length === 0) continue;
    carrier.refreshInternalArgs(updates, { shiftPredOut: false });
    changedCarriers.add(carrier);
    changed = true;
  }
  // A long return's NFT contains only SHA256(raw). Every caller that decodes it carries raw as a hidden
  // witness, and its covenant verifies the digest before using those bytes. Bind that witness from the
  // materialized return output rather than from a guessed graph ordinal (which can differ for transitive
  // and delegate groups).
  for (const input of builder.inputs) {
    const unlocker = input.unlocker;
    if (!isContractUnlocker(unlocker)) continue;
    const refreshed: number[] = [];
    for (const [paramIndex, param] of unlocker.abiFunction.inputs.entries()) {
      const suffix = /^__internal__externalReturnPreimage(\d*)$/.exec(param.name)?.[1];
      if (suffix === undefined) continue;
      const indexName = `__internal__externalReturnOutputIdx${suffix}`;
      const indexPosition = unlocker.abiFunction.inputs.findIndex((candidate) => candidate.name === indexName);
      if (indexPosition < 0) continue;
      const outputIndex = Number(unlocker.params[indexPosition]);
      const output = builder.outputs[outputIndex];
      const token = output?.token;
      if (!token?.nft) continue;
      const actual = token.nft.commitment.toLowerCase();
      // A result recorded by its SHA256 (past 95 bytes in a call record, past 128 otherwise) rides in the witness.
      const raw = host.pendingReturnEventOutputs.find((event) => {
        if (event.categoryId.toLowerCase() !== token.category.toLowerCase()) return false;
        const digest = host.callRecordDigest?.(event.identity);
        if (digest !== undefined) {
          return callRecordHashesResult(event.commitment)
            && returnEventNftCommitment(event.commitment, digest) === actual;
        }
        return event.commitment.length > 128
          && (returnEventNftCommitment(event.commitment) === actual || binToHex(event.commitment) === actual);
      })?.commitment;
      if (!raw || unlocker.params[paramIndex] instanceof Uint8Array
        && binToHex(unlocker.params[paramIndex] as Uint8Array) === binToHex(raw)) continue;
      unlocker.params[paramIndex] = raw.slice();
      refreshed.push(paramIndex);
    }
    if (refreshed.length > 0) {
      unlocker.syncEncodedArgsFromParams?.(refreshed);
      changed = true;
    }
  }
  if (!changed) return false;

  // refreshInternalArgs replaces the carrier's master UTXO object. Preserve
  // physical input order and update only the matching final input unlocker.
  host.syncRefreshedCarrierMasters(builder, changedCarriers);
  return true;
}
