/**
 * phase-boundary extract: STB class-body extract — rebind late value-suffix absolute coordinates after
 * non-covenant insertion, and reconcile materialized value-chunk continuation witnesses.
 */

import type { AbiFunction } from '@solidcash/utils';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript } from '../utils.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { ownsCapturedValueChunkOutputBase } from './value-chunk-base-writer-select.js';
import { isP2sh32LockScript } from './value-chunk-band-helpers.js';
import {
  coherentAuthenticatedValueChunkRun,
  settlement,
  valueChunkIndexFromCommitment,
  type AuthenticatedValueChunk,
  type DerivedChunkOutputObservation,
} from './value-chunk-persist.js';

export interface LateValueSuffixRebindHost {
  derivedChunkOutputs: Map<number, DerivedChunkOutputObservation>;
  externalCallEntryOutputsByIndex: Map<number, { categoryId: string; commitment: string }>;
  builtReturnEventOutputIndices: Map<string, number>;
  readonly externalCallUtxoGroups: ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly categoryId: string;
  getBuiltExternalCallReturnEventOutputIndex(groupIdx: number): number;
  syncRefreshedCarrierMasters(
    builder: TransactionBuilder,
    carriers: ReadonlySet<ExternalCallUtxoGroup>,
  ): void;
}

/**
 * Rebase absolute output coordinates when a final, non-covenant output is inserted before the
 * authenticated suffix. Reverse-indexed suffix checks remain valid after the insertion, but composed
 * continuation writers can also receive an absolute `__internal__valueChunkOutputBase` witness. Keep the
 * recovered-output cache and every carrier of that witness aligned with the shifted physical outputs.
 *
 * This is intentionally separate from probe-only suffix insertions: derivation adds a temporary remainder
 * to an ephemeral builder and must not advance persistent coordinates on every probe iteration.
 */
export function rebindLateValueSuffixAfterInsertion(
  host: LateValueSuffixRebindHost,
  builder: TransactionBuilder,
  insertAt: number,
): void {
  // Inserting inside a claimed multi-chunk run would split its on-chain index order. Reject before shifting
  // any cache or carrier metadata; a gap between distinct resource bands is the only safe interior insertion.
  for (const carrier of [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]) {
    const currentBase = carrier.valueChunkOutputBase;
    const firstClaim = carrier.continuationResourceClaims?.[0];
    const claimOrigin = currentBase === undefined || firstClaim === undefined
      ? undefined : currentBase - firstClaim.bandOffset;
    for (const claim of carrier.continuationResourceClaims ?? []) {
      if (claimOrigin === undefined) break;
      const start = claimOrigin + claim.bandOffset;
      if (insertAt > start && insertAt < start + claim.chunkCount) {
        throw new Error('Cannot insert an output inside an authenticated continuation band.');
      }
    }
  }
  const debugChangeRebind = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_CHANGE_REBIND === '1';
  if (debugChangeRebind) {
    console.error('change-rebind-before', {
      insertAt,
      outputCount: builder.outputs.length,
      derived: [...host.derivedChunkOutputs.entries()].map(([index, chunk]) => ({
        index, categoryId: chunk.categoryId?.slice(0, 8), fixedIndex: chunk.fixedIndex,
      })),
      bases: [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups].flatMap(
        (carrier) => carrier.valueChunkOutputBase === undefined ? [] : [{
          functionName: carrier.logicalFunctionName ?? carrier.functionName,
          base: carrier.valueChunkOutputBase,
        }],
      ),
    });
  }
  const shiftIndexMap = <T>(values: Map<number, T>): Map<number, T> => new Map(
    [...values.entries()].map(([index, value]) => [index >= insertAt ? index + 1 : index, value]),
  );
  host.derivedChunkOutputs = shiftIndexMap(host.derivedChunkOutputs);
  host.externalCallEntryOutputsByIndex = shiftIndexMap(host.externalCallEntryOutputsByIndex);
  host.builtReturnEventOutputIndices = new Map(
    [...host.builtReturnEventOutputIndices.entries()].map(([identity, index]) => [
      identity, index >= insertAt ? index + 1 : index,
    ]),
  );
  // Keep published return coordinates and unlock witnesses aligned with the shifted outputs.
  // Otherwise a late suffix insert moves the NFT while `__internal__externalReturnOutputIdx*`
  // still names the pre-insert slot (nested view returns decode as empty/false).
  for (const group of host.externalCallUtxoGroups) {
    if (group.returnOutputIndex !== undefined && group.returnOutputIndex >= insertAt) {
      group.returnOutputIndex += 1;
    }
    if (group.plannedReturnOutputIndex !== undefined && group.plannedReturnOutputIndex >= insertAt) {
      group.plannedReturnOutputIndex += 1;
    }
  }

  const changedCarriers = new Set<ExternalCallUtxoGroup>();
  for (const carrier of [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]) {
    const currentBase = carrier.valueChunkOutputBase;
    if (currentBase === undefined) continue;
    if (!ownsCapturedValueChunkOutputBase(carrier)) continue;
    const firstClaim = carrier.continuationResourceClaims?.[0];
    const claimOrigin = firstClaim === undefined ? undefined : currentBase - firstClaim.bandOffset;
    if (carrier.valueChunkWrites?.length) {
      carrier.valueChunkWrites = carrier.valueChunkWrites.map((write) => (
        write.outputBase >= insertAt ? { ...write, outputBase: write.outputBase + 1 } : write
      ));
    }
    if (carrier.continuationResourceClaims?.length) {
      carrier.continuationResourceClaims = Object.freeze(
        carrier.continuationResourceClaims.map((claim) => Object.freeze({
          ...claim,
          bandOffset: claimOrigin !== undefined && claimOrigin + claim.bandOffset >= insertAt
            ? claim.bandOffset + 1 : claim.bandOffset,
        })),
      );
    }
    if (currentBase < insertAt) continue;
    const nextBase = currentBase + 1;
    carrier.valueChunkOutputBase = nextBase;
    carrier.internalArgs = {
      ...carrier.internalArgs,
      __internal__valueChunkOutputBase: BigInt(nextBase),
    };
    carrier.refreshInternalArgs?.(
      { __internal__valueChunkOutputBase: BigInt(nextBase) },
      { shiftPredOut: false },
    );
    changedCarriers.add(carrier);
  }
  for (const carrier of [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]) {
    if (!carrier.returnWitnessGroups || !carrier.refreshInternalArgs) continue;
    const updates: Record<string, bigint> = {};
    for (const [name, groupIdx] of Object.entries(carrier.returnWitnessGroups)) {
      const group = host.externalCallUtxoGroups[groupIdx];
      const returnIndex = group?.returnOutputIndex
        ?? host.getBuiltExternalCallReturnEventOutputIndex(groupIdx);
      if (returnIndex < 0) continue;
      if (carrier.internalArgs?.[name] === BigInt(returnIndex)) continue;
      updates[name] = BigInt(returnIndex);
    }
    if (Object.keys(updates).length === 0) continue;
    carrier.internalArgs = { ...carrier.internalArgs, ...updates };
    carrier.refreshInternalArgs(updates, { shiftPredOut: false });
    changedCarriers.add(carrier);
  }
  if (changedCarriers.size > 0) host.syncRefreshedCarrierMasters(builder, changedCarriers);
  if (debugChangeRebind) {
    console.error('change-rebind-after', {
      derived: [...host.derivedChunkOutputs.keys()],
      bases: [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups].flatMap(
        (carrier) => carrier.valueChunkOutputBase === undefined ? [] : [{
          functionName: carrier.logicalFunctionName ?? carrier.functionName,
          base: carrier.valueChunkOutputBase,
        }],
      ),
    });
  }
}

/**
 * Rebind an absolute continuation witness when a participant-owned output is materialized after the route
 * probe selected its append coordinate. The continuation itself is self-describing: a contiguous run of
 * mutable P2SH32 outputs in the participant category, with uint16-le indices 0..n-1. Only search forward from
 * the authenticated provisional base, so an older chunk run cannot be mistaken for the new write.
 */
export function reconcileMaterializedValueChunkWitnesses(
  host: LateValueSuffixRebindHost,
  builder: TransactionBuilder,
): boolean {
  const carriers = [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups];
  const occupiedBases = new Set(carriers.flatMap((carrier) => (
    carrier.valueChunkOutputBase === undefined ? [] : [carrier.valueChunkOutputBase]
  )));
  const changedCarriers = new Set<ExternalCallUtxoGroup>();
  const expectedRuns = new Map<ExternalCallUtxoGroup, AuthenticatedValueChunk[] | undefined>();
  const outputCategoryIds = new Map<ExternalCallUtxoGroup, string>();
  for (const [carrierIndex, carrier] of carriers.entries()) {
    const lowLevelIndex = carrierIndex - host.externalCallUtxoGroups.length;
    const delegatedProxy = lowLevelIndex < 0 ? undefined : host.externalCallUtxoGroups.find(
      (group) => group.delegateCallGroupIndex === lowLevelIndex,
    );
    const outputCategoryId = carrier.callMode === 'delegatecall'
      ? delegatedProxy?.categoryId ?? host.categoryId
      : carrier.categoryId;
    outputCategoryIds.set(carrier, outputCategoryId);

    // The derived pin at the provisional coordinate remains authoritative even if a later state materializer
    // legitimately replaced that output. Its root-addressed lock distinguishes this computed-value run from a
    // dynamic-state run, whose commitments also begin with little-endian indices 0, 1, ... .
    const provisional = carrier.valueChunkOutputBase;
    const provisionalChunk = provisional === undefined
      ? undefined : host.derivedChunkOutputs.get(provisional);
    let expected = provisionalChunk
      && (provisionalChunk.categoryId ?? host.categoryId) === outputCategoryId
      ? coherentAuthenticatedValueChunkRun([...host.derivedChunkOutputs.entries()]
        .filter(([, chunk]) => (chunk.categoryId ?? host.categoryId) === outputCategoryId
          && binToHex(chunk.lockingBytecode) === binToHex(provisionalChunk.lockingBytecode))
        .sort(([left], [right]) => left - right)
        .map(([, chunk]) => chunk))
      : [];

    if (expected.length === 0) {
      const abiFunction = carrier.compilerRoute?.abiFunction
        ?? (carrier.externalContract?.inner.artifact.abi as readonly AbiFunction[] | undefined)
          ?.find((candidate) => candidate.name === carrier.functionName);
      const observedRuns = (abiFunction?.entryAccesses ?? []).flatMap((access) => {
        if (!access.operations.includes('write')) return [];
        const collection = carrier.stateLayout.collections?.find((candidate) => (
          candidate.name === access.collection || candidate.signature === access.collection
        ));
        if (collection?.chunkableValue !== true || !collection.valueType.endsWith('[]')) return [];
        const run = coherentAuthenticatedValueChunkRun(settlement().observedValueChunksByCollection.get(
          `${outputCategoryId.toLowerCase()}:${access.collection}`,
        ) ?? []);
        return run.length > 0 ? [run] : [];
      });
      const uniqueRuns = new Map(observedRuns.map((run) => [
        run.map((chunk) => `${binToHex(chunk.lockingBytecode)}:${chunk.commitment}`).join('|'), run,
      ]));
      if (uniqueRuns.size === 1) expected = [...uniqueRuns.values()][0];
    }
    expectedRuns.set(carrier, expected.length > 0 ? expected : undefined);
  }
  const runIdentity = (carrier: ExternalCallUtxoGroup): string | undefined => {
    const expected = expectedRuns.get(carrier);
    if (!expected) return undefined;
    return `${outputCategoryIds.get(carrier)}:${expected
      .map((chunk) => `${binToHex(chunk.lockingBytecode)}:${chunk.commitment}`).join('|')}`;
  };
  const isRun = (carrier: ExternalCallUtxoGroup, start: number): boolean => {
    const expected = expectedRuns.get(carrier);
    const count = expected?.length ?? carrier.valueChunkOutputCount ?? 1;
    if (count <= 0) return false;
    let runLock: string | undefined;
    for (let offset = 0; offset < count; offset += 1) {
      const output = builder.outputs[start + offset];
      const token = output?.token;
      const nft = token?.nft;
      const lock = output?.to instanceof Uint8Array
        ? output.to : output?.to !== undefined ? addressToLockScript(output.to) : undefined;
      if (!isP2sh32LockScript(lock)
        || token?.category !== outputCategoryIds.get(carrier)
        || nft?.capability !== 'mutable'
        || valueChunkIndexFromCommitment(nft.commitment) !== offset) return false;
      const lockHex = binToHex(lock);
      const expectedChunk = expected?.[offset];
      if (expectedChunk && (lockHex !== binToHex(expectedChunk.lockingBytecode)
        || nft.commitment !== expectedChunk.commitment)) return false;
      if (runLock !== undefined && lockHex !== runLock) return false;
      runLock = lockHex;
    }
    return true;
  };

  for (const carrier of carriers) {
    const currentBase = carrier.valueChunkOutputBase;
    if (currentBase === undefined || isRun(carrier, currentBase)) continue;
    let materializedBase = -1;
    const provisionalResource = host.derivedChunkOutputs.get(currentBase)?.resourceIdentity;
    const exactResourceStarts = provisionalResource === undefined ? [] : [...host.derivedChunkOutputs.entries()]
      .filter(([, chunk]) => chunk.resourceIdentity === provisionalResource && chunk.resourcePart === 'chunk:0')
      .map(([index]) => index);
    // Descriptor-free compatibility runs may only move forward: an older same-shaped run is not authenticated
    // as this write. An exact compiler-owned resource can move in either direction because chunk:0 names the
    // unique physical start independently of a stale provisional coordinate.
    const candidates = exactResourceStarts.length === 1
      ? exactResourceStarts
      : Array.from(
        { length: Math.max(0, builder.outputs.length - currentBase - 1) },
        (_, offset) => currentBase + offset + 1,
      );
    for (const candidate of candidates) {
      if (occupiedBases.has(candidate) || !isRun(carrier, candidate)) continue;
      materializedBase = candidate;
      break;
    }
    if (materializedBase < 0) continue;
    occupiedBases.delete(currentBase);
    occupiedBases.add(materializedBase);
    const identity = runIdentity(carrier);
    // Proxy and delegate records can carry the same physical witness. Rebind only aliases proven to describe
    // this exact authenticated run; unrelated writers that happened to share a provisional coordinate remain
    // independent and will resolve against their own root lock.
    const aliases = (identity === undefined ? [carrier] : carriers.filter((candidate) => (
      candidate.valueChunkOutputBase === currentBase && runIdentity(candidate) === identity
    ))).filter(ownsCapturedValueChunkOutputBase);
    for (const alias of aliases) {
      alias.valueChunkOutputBase = materializedBase;
      alias.internalArgs = {
        ...alias.internalArgs,
        __internal__valueChunkOutputBase: BigInt(materializedBase),
      };
      alias.refreshInternalArgs?.(
        { __internal__valueChunkOutputBase: BigInt(materializedBase) },
        { shiftPredOut: false },
      );
      changedCarriers.add(alias);
    }
  }
  if (changedCarriers.size === 0) return false;
  host.syncRefreshedCarrierMasters(builder, changedCarriers);
  return true;
}
