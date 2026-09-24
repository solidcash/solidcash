/**
 * phase-boundary extract: STB class-body extract — ensure authenticated view-return outputs are stamped
 * and return-witness args refreshed.
 */

import type { FunctionBlockLayout } from '@solidcash/utils';
import { binToHex } from '@bitauth/libauth';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  isInsertBandDustToken,
  isOpReturnLockingBytecode,
  movePostOpReturnBeforeJobsSuffix,
} from './mutable-output-reassert.js';
import {
  isDisposableAlignmentPad,
  isViewReturnTailOutput,
} from './value-chunk-band-helpers.js';
import {
  groupOwnsInBlockReturnEvent,
  isAllZeroCommitment,
  parseExternalCallReturnCoordinate,
} from './value-chunk-geometry.js';

export type AuthenticatedViewReturnEvent = {
  categoryId: string;
  commitment: Uint8Array;
  identity: string;
  provisional?: boolean;
};

export type AuthenticatedViewDynamicChunkVar = {
  name: string;
  type: string;
  lockingBytecode: Uint8Array;
  delegate?: boolean;
  delegateSuffix?: boolean;
};

export interface AuthenticatedViewReturnHost {
  readonly allInputs: readonly UnlockableUtxo[];
  readonly externalCallUtxoGroups: ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly authenticatedViewReturnByGroup: ReadonlyMap<number, { categoryId: string; commitment: string }>;
  readonly builtReturnEventOutputIndices: Map<string, number>;
  readonly categoryId: string;
  readonly delegateDynamicChunksAtSuffix: boolean;
  readonly dynamicChunkVars: readonly AuthenticatedViewDynamicChunkVar[];
  readonly blockLayout?: FunctionBlockLayout;
  tailReturnEventOutputs(): readonly AuthenticatedViewReturnEvent[];
  getDynamicChunkVars(): readonly AuthenticatedViewDynamicChunkVar[];
  dynamicChunkOutputCount(): number;
  syncRefreshedCarrierMasters(
    builder: TransactionBuilder,
    carriers: ReadonlySet<ExternalCallUtxoGroup>,
  ): void;
}

export function ensureAuthenticatedViewReturns(
  host: AuthenticatedViewReturnHost,
  builder: TransactionBuilder,
): boolean {
  let changed = false;
  const changedCarriers = new Set<ExternalCallUtxoGroup>();
  const byGroup = new Map<number, { categoryId: string; commitment: string; identity: string }>();
  for (const [groupIdx, cached] of host.authenticatedViewReturnByGroup) {
    byGroup.set(groupIdx, { ...cached, identity: `external-call:${groupIdx}` });
  }
  for (const event of host.tailReturnEventOutputs()) {
    const coordinate = parseExternalCallReturnCoordinate(event.identity);
    if (!coordinate || coordinate.part !== 0) continue;
    const raw = binToHex(event.commitment);
    if (raw === '' || isAllZeroCommitment(raw) || raw === '0101') continue;
    byGroup.set(coordinate.groupIndex, {
      categoryId: event.categoryId,
      commitment: raw,
      identity: event.identity,
    });
  }
  for (const [groupIdx, group] of host.externalCallUtxoGroups.entries()) {
    if (byGroup.has(groupIdx) || groupOwnsInBlockReturnEvent(host.externalCallUtxoGroups, groupIdx)) {
      continue;
    }
    const fallback = group.precomputedReturnCommitment ?? group.loopReturnCommitments?.[0];
    if (fallback === undefined) continue;
    const raw = typeof fallback === 'string' ? fallback : binToHex(fallback);
    if (raw === '' || isAllZeroCommitment(raw) || raw === '0101') continue;
    byGroup.set(groupIdx, {
      categoryId: group.categoryId,
      commitment: raw,
      identity: `external-call:${groupIdx}`,
    });
  }
  for (const [groupIdx, pending] of byGroup) {
    if (groupOwnsInBlockReturnEvent(host.externalCallUtxoGroups, groupIdx)) continue;
    const group = host.externalCallUtxoGroups[groupIdx];
    const lockOf = (index: number): Uint8Array | string | undefined => {
      const to = builder.outputs[index]?.to;
      return to instanceof Uint8Array || typeof to === 'string' ? to : undefined;
    };
    const witnessArgHosts: number[] = [];
    for (const carrier of [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]) {
      if (!carrier.returnWitnessGroups) continue;
      for (const [name, owner] of Object.entries(carrier.returnWitnessGroups)) {
        if (owner !== groupIdx) continue;
        const rawIdx = carrier.internalArgs?.[name]
          ?? carrier.compilerRoute?.internalArgs?.[name];
        const index = typeof rawIdx === 'bigint' ? Number(rawIdx)
          : typeof rawIdx === 'number' ? rawIdx : -1;
        if (index >= 0) witnessArgHosts.push(index);
      }
    }
    let returnHost = group?.returnOutputIndex
      ?? group?.plannedReturnOutputIndex
      ?? witnessArgHosts[0]
      ?? host.builtReturnEventOutputIndices.get(pending.identity)
      ?? host.builtReturnEventOutputIndices.get(`${pending.identity}:0`);
    // Insert-band reserves INPUTINDEX+3 as THIS contract's returnEvent output-only slot.
    // Only same-category returns may occupy it: stamping an external view (foreign category)
    // breaks UTXO/OUTPUT category EQUALVERIFY against the dust input twin.
    const insertBandReturnSlot = host.allInputs.findIndex((input) => (
      isInsertBandDustToken(input.token, host.categoryId)
    ));
    const sameCategoryReturn = pending.categoryId === host.categoryId;
    if (returnHost === undefined || returnHost < 0) {
      if (!(insertBandReturnSlot >= 0 && sameCategoryReturn)) continue;
      returnHost = insertBandReturnSlot;
    }
    while (returnHost >= builder.outputs.length) {
      builder.addOutput({ to: Uint8Array.of(0x51), amount: 800n });
    }
    // Jobs suffix is `TXOUTPUTCOUNT - 1 - nNew` with exactly one trailer. View returns after
    // that trailer (or inside the chunk run) make the covenant read empty chunk commitments.
    if (host.delegateDynamicChunksAtSuffix) {
      const suffixVar = host.getDynamicChunkVars().find((variable) => variable.delegateSuffix === true)
        ?? host.dynamicChunkVars[0];
      movePostOpReturnBeforeJobsSuffix(builder.outputs, suffixVar?.lockingBytecode);
    }
    const jobsCount = host.delegateDynamicChunksAtSuffix ? host.dynamicChunkOutputCount() : 0;
    const liveOpReturn = builder.outputs.findIndex((output) => isOpReturnLockingBytecode(
      output?.to instanceof Uint8Array || typeof output?.to === 'string' ? output.to : undefined,
    ));
    // Reverse-index math is only safe once the unique OP_RETURN trailer exists. Before that,
    // `length - jobsCount - 1` lands inside the contract block (Marketplace whitelist punched
    // output 6 into a token-free OP_TRUE and OUTPUTTOKENCATEGORY(6) failed closed).
    const jobsSuffixStart = liveOpReturn >= 0 && jobsCount > 0
      ? Math.max(0, liveOpReturn - jobsCount)
      : liveOpReturn >= 0 ? liveOpReturn : builder.outputs.length;
    const blockOccupancyEnd = Math.max(
      host.blockLayout?.blockSize ?? 0,
      host.blockLayout?.trailingBase ?? 0,
    );
    if (insertBandReturnSlot >= 0 && sameCategoryReturn
      && !isAllZeroCommitment(pending.commitment)
      && pending.commitment !== '0101') {
      const slotOut = builder.outputs[insertBandReturnSlot];
      const slotCommit = String(slotOut?.token?.nft?.commitment ?? '');
      if (!slotOut || isInsertBandDustToken(slotOut.token, host.categoryId)
        || isDisposableAlignmentPad(slotOut)
        || (isViewReturnTailOutput(slotOut)
          && (isAllZeroCommitment(slotCommit) || slotCommit === '0101'))) {
        returnHost = insertBandReturnSlot;
      }
    }
    const onOrAfterJobsSuffix = returnHost >= jobsSuffixStart
      || isOpReturnLockingBytecode(lockOf(returnHost));
    if (onOrAfterJobsSuffix && jobsSuffixStart >= blockOccupancyEnd
      && jobsSuffixStart <= builder.outputs.length) {
      const pad: Output = {
        to: Uint8Array.of(0x51),
        amount: 800n,
        token: {
          amount: 0n,
          category: pending.categoryId,
          nft: { capability: 'none', commitment: pending.commitment },
        },
      };
      builder.outputs.splice(jobsSuffixStart, 0, pad);
      returnHost = jobsSuffixStart;
    }
    const existing = String(builder.outputs[returnHost]?.token?.nft?.commitment ?? '');
    if (existing.toLowerCase() === pending.commitment.toLowerCase()
      && isViewReturnTailOutput(builder.outputs[returnHost])) {
      if (group && group.returnOutputIndex !== returnHost) {
        group.returnOutputIndex = returnHost;
        changed = true;
      }
      for (const carrier of [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]) {
        if (!carrier.returnWitnessGroups || !carrier.refreshInternalArgs) continue;
        const updates: Record<string, bigint> = {};
        for (const [name, owner] of Object.entries(carrier.returnWitnessGroups)) {
          if (owner !== groupIdx) continue;
          if (carrier.internalArgs?.[name] === BigInt(returnHost)) continue;
          updates[name] = BigInt(returnHost);
        }
        if (Object.keys(updates).length === 0) continue;
        carrier.refreshInternalArgs(updates, { shiftPredOut: false });
        changedCarriers.add(carrier);
        changed = true;
      }
      continue;
    }
    if (!(isViewReturnTailOutput(builder.outputs[returnHost])
      || isDisposableAlignmentPad(builder.outputs[returnHost])
      || !builder.outputs[returnHost]?.token)) {
      continue;
    }
    builder.outputs[returnHost] = {
      to: Uint8Array.of(0x51),
      amount: 800n,
      token: {
        amount: 0n,
        category: pending.categoryId,
        nft: { capability: 'none', commitment: pending.commitment },
      },
    };
    host.builtReturnEventOutputIndices.set(pending.identity, returnHost);
    host.builtReturnEventOutputIndices.set(`${pending.identity}:0`, returnHost);
    if (group) group.returnOutputIndex = returnHost;
    // Force unlockers that name this group to read the stamped returnHost — reconcile
    // alone can keep a stale returnOutputIdx from an earlier OP_RETURN slot.
    for (const carrier of [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]) {
      if (!carrier.returnWitnessGroups || !carrier.refreshInternalArgs) continue;
      const updates: Record<string, bigint> = {};
      for (const [name, owner] of Object.entries(carrier.returnWitnessGroups)) {
        if (owner !== groupIdx) continue;
        if (carrier.internalArgs?.[name] === BigInt(returnHost)) continue;
        updates[name] = BigInt(returnHost);
      }
      if (Object.keys(updates).length === 0) continue;
      carrier.refreshInternalArgs(updates, { shiftPredOut: false });
      changedCarriers.add(carrier);
    }
    changed = true;
  }
  if (changedCarriers.size > 0) {
    host.syncRefreshedCarrierMasters(builder, changedCarriers);
  }
  return changed;
}
