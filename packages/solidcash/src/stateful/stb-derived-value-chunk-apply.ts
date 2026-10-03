/**
 * phase-boundary extract: STB class-body extract — apply / relocate / strip derived value-chunk outputs.
 */

import { binToHex } from '@bitauth/libauth';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo } from '../interfaces.js';
import { addressToLockScript, calculateDust } from '../utils.js';
import { BALANCED_SLOT_SATOSHIS } from './balancedBlocks.js';
import { findDisposableValueChunkOutputBase } from './early-value-chunk-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { stripSurplusValueChunkLocks } from './scid-minting-return-layout.js';
import { ownsCapturedValueChunkOutputBase } from './value-chunk-base-writer-select.js';
import {
  isOverwritableValueChunkOccupant,
  isP2sh32LockScript,
} from './value-chunk-band-helpers.js';
import { selectTokenBandRepairOwner } from './value-chunk-geometry.js';
import {
  permitsHeuristicValueChunkRunRelocation,
  valueChunkIndexFromCommitment,
  type DerivedChunkOutputObservation,
} from './value-chunk-persist.js';

export interface DerivedValueChunkApplyHost {
  derivedChunkOutputs: Map<number, DerivedChunkOutputObservation>;
  readonly allInputs: UnlockableUtxo[];
  readonly categoryId: string;
  readonly delegateDynamicChunksAtSuffix: boolean;
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly messageBusConvention?: 'legacy-unroll' | 'kernel-row-loop';
  readonly mintingOutputSwap?: { from: number; width: number; categoryId: string };
  getChunkableValueWriteBand(): { start: number; end: number; nNew: number } | undefined;
  findMintingInputIndex(categoryId: string): number;
  getExternalCallMasterInputIndex(groupIndex: number): number;
  getLowLevelCallMasterInputIndex(llcIndex: number): number;
  isFixedParticipantDataNftOutput(outputIndex: number, categoryId: string): boolean;
  syncRefreshedCarrierMasters(
    builder: TransactionBuilder,
    carriers: Iterable<ExternalCallUtxoGroup>,
  ): void;
}

export function applyDerivedValueChunks(
  host: DerivedValueChunkApplyHost,
  builder: TransactionBuilder,
): boolean {
  const band = host.getChunkableValueWriteBand();
  const repairOwner = selectTokenBandRepairOwner(
    host.externalCallUtxoGroups,
    (categoryId) => host.findMintingInputIndex(categoryId),
    band,
    host.messageBusConvention,
  );
  const tokenWriterPresent = repairOwner.status !== 'absent'
    || host.mintingOutputSwap !== undefined;
  if (band && host.messageBusConvention !== 'kernel-row-loop'
    && !tokenWriterPresent && host.derivedChunkOutputs.size > 0) {
    const keys = [...host.derivedChunkOutputs.entries()]
      .filter(([, chunk]) => !chunk.fixedIndex)
      .map(([index]) => index)
      .sort((left, right) => left - right);
    const offBand = keys.some((index) => index < band.start || index > band.end);
    if (offBand) {
      const chunks = keys.map((index) => host.derivedChunkOutputs.get(index)!);
      for (const index of keys) host.derivedChunkOutputs.delete(index);
      for (const [offset, chunk] of chunks.entries()) {
        if (offset >= band.nNew) break;
        host.derivedChunkOutputs.set(band.start + offset, chunk);
      }
    }
  }
  const protectedMasters = new Set<number>();
  for (const [llcIndex, llc] of host.lowLevelCallUtxoGroups.entries()) {
    if (llc.callMode !== 'delegatecall') continue;
    const implIndex = host.getLowLevelCallMasterInputIndex(llcIndex);
    if (implIndex >= 0) protectedMasters.add(implIndex);
  }
  for (const [groupIndex, group] of host.externalCallUtxoGroups.entries()) {
    if (group.delegateCallGroupIndex === undefined) continue;
    const masterIndex = host.getExternalCallMasterInputIndex(groupIndex);
    if (masterIndex >= 0) protectedMasters.add(masterIndex);
  }
  const tokenWriterCategory = host.mintingOutputSwap?.categoryId
    ?? (repairOwner.status === 'exact' ? repairOwner.categoryId : undefined);
  for (const [index, input] of host.allInputs.entries()) {
    if (input?.token?.nft?.capability === 'minting') protectedMasters.add(index);
    if (tokenWriterCategory && input?.token?.category === tokenWriterCategory) {
      protectedMasters.add(index);
    }
  }
  let changed = false;
  for (const outputIndex of [...host.derivedChunkOutputs.keys()].sort((left, right) => left - right)) {
    const chunk = host.derivedChunkOutputs.get(outputIndex);
    if (!chunk) continue;
    // Only the caller's own suffix chunks are skipped here. Compiler-described nested chunks are normalized
    // to their writer category when learned, so an absent category can never silently become the caller.
    if (host.delegateDynamicChunksAtSuffix && chunk.categoryId === host.categoryId) continue;
    if (protectedMasters.has(outputIndex)) continue;
    // Never materialise a fixed entry pin onto a compiler-declared participant data-NFT slot.
    // Value-chunk commitments (uint16 index < 32) are not entry pins even at 256 hex chars.
    const derivedValueChunkIndex = valueChunkIndexFromCommitment(chunk.commitment);
    if (chunk.fixedIndex && derivedValueChunkIndex === undefined && chunk.commitment.length >= 128
      && host.isFixedParticipantDataNftOutput(
        outputIndex, chunk.categoryId ?? host.categoryId,
      )) {
      continue;
    }
    const existing = builder.outputs[outputIndex];
    if (existing) {
      // A minting 1:1 recreation is not an old value-chunk digest. Every
      // P2SH32 used to match `existingIsChunkAddress`, so a participant minting
      // lock could be replaced by a value chunk.
      if (existing.token?.nft?.capability === 'minting') continue;
      const existingCategory = existing.token?.category?.toLowerCase();
      const chunkCategory = (chunk.categoryId ?? host.categoryId).toLowerCase();
      // Never rewrite another participant's EntryNft/data outputs as value chunks.
      if (existingCategory && existingCategory !== chunkCategory
        && existing.token?.nft?.capability === 'mutable') continue;
      const commitHex = String(existing.token?.nft?.commitment ?? '');
      const commitBytes = commitHex.length / 2;
      const existingLock = existing.to instanceof Uint8Array
        ? existing.to
        : existing.to !== undefined ? addressToLockScript(existing.to) : undefined;
      const existingIsChunkAddress = !!existingLock
        && existingLock.length === 35
        && existingLock[0] === 0xaa && existingLock[1] === 0x20
        && existingLock[34] === 0x87;
      // Old digest chunks carry uint16||data up to 128 bytes (VALUE_CHUNK_SIZE+2).
      // A 64-byte cutoff left e607 occupants in place against recovered cc56 pins.
      const valueChunkOccupant = existing.token?.nft?.capability === 'mutable'
        && commitBytes >= 3 && commitBytes <= 128
        && (existingIsChunkAddress || !existing.token?.nft?.commitment);
      const emptyOccupant = !existing.token?.nft || commitHex === '' || commitHex === '00';
      const oldDigestOccupant = existingIsChunkAddress
        && binToHex(existingLock!) !== binToHex(chunk.lockingBytecode);
      const funderOccupant = !existing.token;
      const viewTailOccupant = isOverwritableValueChunkOccupant(existing);
      // Fixed-band value-chunk pins must win over same-category mutable placeholders
      // (OP_TRUE twins, stale entry-shaped P2SH32) so OUTPUTTOKENCOMMITMENT matches.
      const fixedValueChunkPin = chunk.fixedIndex === true && derivedValueChunkIndex !== undefined
        && (!existingCategory || existingCategory === chunkCategory);
      if (!valueChunkOccupant && !emptyOccupant && !oldDigestOccupant
        && !funderOccupant && !viewTailOccupant && !fixedValueChunkPin) continue;
    }
    while (builder.outputs.length < outputIndex) {
      builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
    }
    const next = {
      to: chunk.lockingBytecode,
      amount: 1200n,
      token: {
        amount: 0n,
        category: chunk.categoryId ?? host.categoryId,
        nft: { capability: 'mutable' as const, commitment: chunk.commitment },
      },
    };
    // A derived continuation may replace an incoming value chunk at the same
    // balanced coordinate. Its covenant requires the satoshi value to be
    // preserved even when the digest changes its locking bytecode.
    const predecessor = host.allInputs[outputIndex];
    const predecessorIsValueChunk = chunk.semanticKind !== 'entryPin'
      && derivedValueChunkIndex !== undefined
      && predecessor?.token?.nft?.capability === 'mutable'
      && predecessor.token.category.toLowerCase() === next.token.category.toLowerCase()
      && valueChunkIndexFromCommitment(predecessor.token.nft.commitment) !== undefined;
    next.amount = predecessorIsValueChunk
      ? predecessor.satoshis
      : BigInt(Math.max(1200, calculateDust(next)));
    const existingLock = existing?.to instanceof Uint8Array
      ? existing.to
      : existing?.to !== undefined ? addressToLockScript(existing.to) : undefined;
    const same = existing !== undefined
      && existingLock !== undefined
      && binToHex(existingLock) === binToHex(chunk.lockingBytecode)
      && existing.token?.nft?.commitment === chunk.commitment
      && existing.token?.category === next.token.category;
    if (same) continue;
    if (builder.outputs.length === outputIndex) builder.addOutput(next);
    else builder.outputs[outputIndex] = next;
    changed = true;
  }
  return changed;
}

/**
 * Final state/resource preservation can legitimately reclaim a provisional continuation coordinate. Move only
 * compiler-derived, self-describing runs, and only into token-free balanced slots; fixed pins remain immovable.
 */
export function relocateCollidingDerivedValueChunkRuns(
  host: DerivedValueChunkApplyHost,
  builder: TransactionBuilder,
): boolean {
  type DerivedChunk = DerivedChunkOutputObservation;
  const outputMatches = (index: number, chunk: DerivedChunk): boolean => {
    const output = builder.outputs[index];
    const lock = output?.to instanceof Uint8Array
      ? output.to : output?.to !== undefined ? addressToLockScript(output.to) : undefined;
    return lock !== undefined
      && binToHex(lock) === binToHex(chunk.lockingBytecode)
      && output.token?.category === (chunk.categoryId ?? host.categoryId)
      && output.token?.nft?.capability === 'mutable'
      && output.token.nft.commitment === chunk.commitment;
  };
  const groups = new Map<string, Array<{ index: number; chunkIndex: number; chunk: DerivedChunk }>>();
  for (const [index, chunk] of host.derivedChunkOutputs) {
    const chunkIndex = valueChunkIndexFromCommitment(chunk.commitment);
    // `fixedIndex` also marks probe-authenticated continuation pins. Stable resource ownership permits those
    // pins to move atomically with their carrier; descriptor-free fixed entry/layout pins remain immovable.
    if ((chunk.fixedIndex && !chunk.resourceIdentity)
      || chunkIndex === undefined || !isP2sh32LockScript(chunk.lockingBytecode)) continue;
    const key = chunk.resourceIdentity
      ? `resource:${chunk.resourceIdentity}`
      : `shape:${chunk.categoryId ?? host.categoryId}:${binToHex(chunk.lockingBytecode)}`;
    const group = groups.get(key) ?? [];
    group.push({ index, chunkIndex, chunk });
    groups.set(key, group);
  }
  let changed = false;
  const changedCarriers = new Set<ExternalCallUtxoGroup>();
  const reserved = new Set<number>([...host.derivedChunkOutputs.entries()].flatMap(([index, chunk]) => (
    chunk.fixedIndex ? [index] : []
  )));
  for (const group of groups.values()) {
    group.sort((left, right) => left.chunkIndex - right.chunkIndex);
    if (group.length === 0 || group.some((entry, offset) => entry.chunkIndex !== offset)) continue;
    if (!permitsHeuristicValueChunkRunRelocation(group[0].chunk.resourceIdentity)) {
      for (const entry of group) reserved.add(entry.index);
      continue;
    }
    const materialized = group.every((entry) => outputMatches(entry.index, entry.chunk));
    if (materialized) {
      for (const entry of group) reserved.add(entry.index);
      continue;
    }
    const base = findDisposableValueChunkOutputBase(builder.outputs, host.allInputs, group.length, reserved);
    if (base === undefined) continue;
    const oldBase = group[0].index;
    for (const entry of group) host.derivedChunkOutputs.delete(entry.index);
    for (const [offset, entry] of group.entries()) {
      const index = base + offset;
      const next = {
        to: entry.chunk.lockingBytecode,
        amount: 1200n,
        token: {
          amount: 0n,
          category: entry.chunk.categoryId ?? host.categoryId,
          nft: { capability: 'mutable' as const, commitment: entry.chunk.commitment },
        },
      };
      next.amount = BigInt(Math.max(1200, calculateDust(next)));
      builder.outputs[index] = next;
      host.derivedChunkOutputs.set(index, { ...entry.chunk, fixedIndex: true });
      reserved.add(index);
    }
    for (const carrier of [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups]) {
      if (carrier.valueChunkOutputBase !== oldBase) continue;
      if (!ownsCapturedValueChunkOutputBase(carrier)) continue;
      carrier.valueChunkOutputBase = base;
      carrier.internalArgs = {
        ...carrier.internalArgs,
        __internal__valueChunkOutputBase: BigInt(base),
      };
      carrier.refreshInternalArgs?.(
        { __internal__valueChunkOutputBase: BigInt(base) },
        { shiftPredOut: false },
      );
      changedCarriers.add(carrier);
    }
    changed = true;
  }
  if (changedCarriers.size > 0) host.syncRefreshedCarrierMasters(builder, changedCarriers);
  return changed;
}

/**
 * Enforce the cardinality of each authenticated, contiguous value-chunk run.
 * Late state/preservation materializers can replay a predecessor outside the
 * derived run after its first cleanup. The compiler counts outputs by redeem
 * lock, so even an exact duplicate at an unowned coordinate is observable.
 */
export function stripSurplusDerivedValueChunkLocks(
  host: DerivedValueChunkApplyHost,
  builder: TransactionBuilder,
): number {
  // A converged write may be observed first at a provisional coordinate and later at its physical band.
  // One compiler-described resource part owns one output. Reconcile identical duplicate observations before
  // counting redeem locks; conflicting bytes or an occupied predecessor coordinate remain hard failures.
  const parts = new Map<string, { index: number; chunk: DerivedChunkOutputObservation }>();
  let stripped = 0;
  for (const [index, chunk] of [...host.derivedChunkOutputs].sort(([left], [right]) => left - right)) {
    if (chunk.semanticKind !== 'valueChunk' || !chunk.resourceIdentity || !chunk.resourcePart) continue;
    const key = JSON.stringify([chunk.resourceIdentity, chunk.resourcePart]);
    const prior = parts.get(key);
    if (!prior) {
      parts.set(key, { index, chunk });
      continue;
    }
    if (binToHex(prior.chunk.lockingBytecode) !== binToHex(chunk.lockingBytecode)
      || prior.chunk.commitment !== chunk.commitment
      || (prior.chunk.categoryId ?? host.categoryId) !== (chunk.categoryId ?? host.categoryId)) {
      throw new Error(`Conflicting derived value-chunk resource part '${key}'.`);
    }
    if (prior.chunk.fixedIndex === true || chunk.fixedIndex === true) {
      throw new Error(`Duplicate fixed value-chunk resource part '${key}'.`);
    }
    const spent = host.allInputs[index];
    if (spent?.token?.nft?.capability === 'mutable' || spent?.token?.nft?.capability === 'minting') {
      throw new Error(`Duplicate value-chunk resource part occupies a token predecessor at output ${index}.`);
    }
    const output = builder.outputs[index];
    const lock = output?.to instanceof Uint8Array ? output.to
      : output?.to !== undefined ? addressToLockScript(output.to) : undefined;
    if (!output || !lock || binToHex(lock) !== binToHex(chunk.lockingBytecode)
      || output.token?.category !== (chunk.categoryId ?? host.categoryId)
      || output.token?.nft?.commitment !== chunk.commitment) {
      throw new Error(`Duplicate value-chunk resource part has a conflicting output at ${index}.`);
    }
    host.derivedChunkOutputs.delete(index);
    builder.outputs[index] = { to: Uint8Array.of(0x51), amount: output.amount };
    stripped += 1;
  }
  const runs = new Map<string, { lockingBytecode: Uint8Array; indices: number[] }>();
  for (const [outputIndex, chunk] of host.derivedChunkOutputs) {
    if (!isP2sh32LockScript(chunk.lockingBytecode)
      || valueChunkIndexFromCommitment(chunk.commitment) === undefined) continue;
    const lockHex = binToHex(chunk.lockingBytecode);
    const run = runs.get(lockHex) ?? { lockingBytecode: chunk.lockingBytecode, indices: [] };
    run.indices.push(outputIndex);
    runs.set(lockHex, run);
  }
  for (const run of runs.values()) {
    run.indices.sort((left, right) => left - right);
    const start = run.indices[0];
    if (start === undefined || run.indices.some((index, offset) => index !== start + offset)) continue;
    stripped += stripSurplusValueChunkLocks(
      builder.outputs,
      { start, nNew: run.indices.length },
      run.lockingBytecode,
      host.allInputs,
    );
  }
  return stripped;
}
