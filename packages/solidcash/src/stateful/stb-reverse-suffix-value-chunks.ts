/**
 * phase-boundary extract: STB class-body extract — staged value-chunk reassert + reverse-suffix
 * jobs finalize / pin helpers.
 */

import { binToHex } from '@bitauth/libauth';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import { addressToLockScript, calculateDust } from '../utils.js';
import { BALANCED_SLOT_SATOSHIS } from './balancedBlocks.js';
import { moveLateOutputsBeforeReverseSuffix } from './mutable-output-reassert.js';
import { cloneToken } from './stb-output-utils.js';
import type { DerivedChunkOutputObservation } from './value-chunk-persist.js';

export type StagedValueChunkOutput = {
  to: string | Uint8Array;
  amount: bigint;
  token?: Utxo['token'];
};

export type DynamicChunkVar = {
  name: string;
  lockingBytecode: Uint8Array;
  delegateSuffix?: boolean;
};

export interface ReverseSuffixValueChunkHost {
  readonly valueChunkOutputs: readonly StagedValueChunkOutput[];
  readonly allInputs: readonly UnlockableUtxo[];
  readonly categoryId: string;
  readonly delegateDynamicChunksAtSuffix: boolean;
  readonly dynamicChunkVars: readonly DynamicChunkVar[];
  readonly chunkRawCommitments: ReadonlyMap<string, readonly string[]>;
  readonly derivedChunkOutputs: ReadonlyMap<number, DerivedChunkOutputObservation>;
  getChunkableValueWriteBand(): { start: number; end: number; nNew: number } | undefined;
  setChunkRawCommitments(name: string, commitments: string[]): void;
  dynamicChunkOutputCount(): number;
  padOutputsToIndex(builder: TransactionBuilder, index: number): void;
}

export function reassertStagedValueChunkOutputs(
  host: ReverseSuffixValueChunkHost,
  builder: TransactionBuilder,
): number {
  if (host.valueChunkOutputs.length === 0) return 0;
  const lockHex = (to: string | Uint8Array | undefined): string | undefined => {
    if (to instanceof Uint8Array) return binToHex(to);
    if (typeof to === 'string') {
      try { return binToHex(addressToLockScript(to)); } catch { return undefined; }
    }
    return undefined;
  };
  const band = host.getChunkableValueWriteBand();
  // Only relocate when a prior append parked staged chunk locks before the band
  // (publishJobEvent dataNft slots). Do not rewrite a healthy full-width layout.
  const stagedLocks = new Set(
    host.valueChunkOutputs.map((staged) => lockHex(staged.to)).filter((hex): hex is string => !!hex),
  );
  const earlyFalseAppends: number[] = [];
  if (band) {
    for (let index = 0; index < band.start && index < builder.outputs.length; index += 1) {
      const hex = lockHex(builder.outputs[index]?.to);
      if (!hex || !stagedLocks.has(hex)) continue;
      if (builder.outputs[index]?.token?.nft?.capability !== 'mutable') continue;
      earlyFalseAppends.push(index);
    }
  }
  if (band && earlyFalseAppends.length > 0) {
    let added = 0;
    for (const [offset, staged] of host.valueChunkOutputs.entries()) {
      if (offset >= band.nNew) break;
      const outputIndex = band.start + offset;
      host.padOutputsToIndex(builder, outputIndex);
      const chunkOutput = { ...staged };
      chunkOutput.amount = BigInt(Math.max(1200, calculateDust(chunkOutput)));
      if (builder.outputs.length === outputIndex) builder.addOutput(chunkOutput);
      else builder.outputs[outputIndex] = chunkOutput;
      added += 1;
    }
    for (const index of earlyFalseAppends) {
      const occupant = host.allInputs[index];
      builder.outputs[index] = occupant?.unlocker
        ? {
          to: occupant.unlocker.generateLockingBytecode(),
          amount: occupant.satoshis,
          ...(occupant.token ? { token: cloneToken(occupant.token) } : {}),
        }
        : { to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS };
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1') {
      console.error('reassert-staged-value-chunks', JSON.stringify({
        mode: 'relocate-early-appends',
        bandStart: band.start,
        earlyFalseAppends,
        staged: host.valueChunkOutputs.length,
        added,
        outputCount: builder.outputs.length,
      }));
    }
    return added;
  }
  const present = new Map<string, number>();
  for (const output of builder.outputs) {
    const hex = lockHex(output.to);
    if (!hex) continue;
    present.set(hex, (present.get(hex) ?? 0) + 1);
  }
  const needed = new Map<string, Array<typeof host.valueChunkOutputs[number]>>();
  for (const staged of host.valueChunkOutputs) {
    const hex = lockHex(staged.to);
    if (!hex) continue;
    const group = needed.get(hex) ?? [];
    group.push(staged);
    needed.set(hex, group);
  }
  let added = 0;
  for (const [hex, staged] of needed) {
    const missing = staged.length - (present.get(hex) ?? 0);
    for (let index = 0; index < missing; index += 1) {
      const template = staged[Math.min(index, staged.length - 1)];
      const chunkOutput = { ...template };
      chunkOutput.amount = BigInt(Math.max(1200, calculateDust(chunkOutput)));
      builder.addOutput(chunkOutput);
      added += 1;
    }
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1') {
    const after = new Map<string, number>();
    for (const output of builder.outputs) {
      const hex = lockHex(output.to);
      if (!hex) continue;
      after.set(hex, (after.get(hex) ?? 0) + 1);
    }
    console.error('reassert-staged-value-chunks', JSON.stringify({
      staged: host.valueChunkOutputs.length,
      added,
      outputCount: builder.outputs.length,
      needed: [...needed.entries()].map(([hex, group]) => ({
        lock: hex.slice(0, 20),
        want: group.length,
        before: present.get(hex) ?? 0,
        after: after.get(hex) ?? 0,
      })),
    }));
  }
  return added;
}
/**
 * Final send() only: repair reverse-suffix jobs after late value-chunk appends.
 * Probe builds keep the append-time order so derivation does not thrash.
 */
export function finalizeReverseSuffixJobsLayout(
  host: ReverseSuffixValueChunkHost,
  builder: TransactionBuilder,
): number {
  if (!host.delegateDynamicChunksAtSuffix) return 0;
  // Probe-derived commitments can be absent on the final builder while
  // derivedChunkOutputs / spent chunk inputs still know the jobs run width
  // (second publishJobPost growth). Seed raw commitments before counting.
  for (const dv of host.dynamicChunkVars) {
    const existing = host.chunkRawCommitments.get(dv.name) ?? [];
    if (existing.some((commitment) => commitment.length > 0 && commitment !== '00')) continue;
    const wanted = binToHex(dv.lockingBytecode);
    const fromDerived = [...host.derivedChunkOutputs.entries()]
      .filter(([, chunk]) => (chunk.categoryId ?? host.categoryId) === host.categoryId
        && binToHex(chunk.lockingBytecode) === wanted)
      .sort(([left], [right]) => left - right)
      .map(([, chunk]) => chunk.commitment)
      .filter((commitment) => commitment.length > 0);
    if (fromDerived.length > 0) {
      host.setChunkRawCommitments(dv.name, fromDerived);
    }
  }
  const jobsCount = host.dynamicChunkOutputCount();
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_CHUNK_LAYOUT === '1') {
    console.error('finalize-reverse-suffix-jobs', {
      jobsCount,
      outputCount: builder.outputs.length,
      vars: host.dynamicChunkVars.map((dv) => ({
        name: dv.name,
        commitments: (host.chunkRawCommitments.get(dv.name) ?? []).map((c) => c.slice(0, 24)),
      })),
      derived: [...host.derivedChunkOutputs.entries()].map(([index, chunk]) => ({
        index,
        cat: (chunk.categoryId ?? '').slice(0, 8),
        commit: chunk.commitment.slice(0, 24),
        semanticKind: chunk.semanticKind,
        resourcePart: chunk.resourcePart,
      })),
      tail: builder.outputs.slice(-5).map((output, offset) => ({
        i: builder.outputs.length - 5 + offset,
        lock: output.to instanceof Uint8Array ? binToHex(output.to).slice(0, 20) : String(output.to ?? ''),
        commit: String(output.token?.nft?.commitment ?? '').slice(0, 24),
      })),
    });
  }
  if (jobsCount <= 0) return 0;
  const suffixVar = host.dynamicChunkVars.find((variable) => variable.delegateSuffix === true)
    ?? host.dynamicChunkVars[host.dynamicChunkVars.length - 1];
  if (!suffixVar) return 0;
  let changed = moveLateOutputsBeforeReverseSuffix(
    builder.outputs, suffixVar.lockingBytecode, jobsCount,
  );
  changed += reassertReverseSuffixDynamicChunks(host, builder, { stripSurplus: true });
  return changed;
}
/**
 * Pin reverse-suffix dynamic-array chunks (Marketplace.jobs) at TXOUTPUTCOUNT-1-nNew.
 * Empty-whitelist posts were leaving chunk0/chunk1 swapped or missing on that window after
 * late layout growth, so final preflight EQUALVERIFYd the wrong commitment then the wrong lock.
 *
 * When `stripSurplus` is set (final send layout only), demote earlier same-lock mutable copies
 * left behind by late value-chunk appends so TXOUTPUTCOUNT-1-nNew is the unique jobs window.
 * Do not enable during probe builds — stripping there thrash-hangs derivation.
 */
export function reassertReverseSuffixDynamicChunks(
  host: ReverseSuffixValueChunkHost,
  builder: TransactionBuilder,
  options?: { stripSurplus?: boolean },
): number {
  if (!host.delegateDynamicChunksAtSuffix) return 0;
  if (builder.outputs.length < 2) return 0;
  let placed = 0;
  let stripped = 0;
  let cursor = builder.outputs.length - 1; // trailer (OP_RETURN / sidecar)
  const authoritative = new Set<number>();
  for (let varIndex = host.dynamicChunkVars.length - 1; varIndex >= 0; varIndex -= 1) {
    const dv = host.dynamicChunkVars[varIndex]!;
    const commitments = host.chunkRawCommitments.get(dv.name) ?? [];
    if (commitments.length === 0) continue;
    // Keep placeholder slots in the width so TXOUTPUTCOUNT-1-nNew stays aligned.
    const base = cursor - commitments.length;
    if (base < 0) continue;
    for (const [offset, commitment] of commitments.entries()) {
      if (commitment.length === 0) continue;
      const outputIndex = base + offset;
      authoritative.add(outputIndex);
      const next = {
        to: dv.lockingBytecode,
        amount: 1200n,
        token: {
          amount: 0n,
          category: host.categoryId,
          nft: { capability: 'mutable' as const, commitment },
        },
      };
      next.amount = BigInt(Math.max(1200, calculateDust(next)));
      const existing = builder.outputs[outputIndex];
      const existingLock = existing?.to instanceof Uint8Array
        ? existing.to
        : existing?.to !== undefined ? addressToLockScript(existing.to) : undefined;
      const same = existing !== undefined
        && existingLock !== undefined
        && binToHex(existingLock) === binToHex(dv.lockingBytecode)
        && existing.token?.nft?.commitment === commitment
        && existing.token?.category === host.categoryId;
      if (!same) {
        host.padOutputsToIndex(builder, outputIndex);
        if (builder.outputs.length === outputIndex) builder.addOutput(next);
        else builder.outputs[outputIndex] = next;
        placed += 1;
      }
    }
    cursor = base;
  }
  if (options?.stripSurplus === true && authoritative.size > 0) {
    const jobsLocks = new Set(
      host.dynamicChunkVars.map((dv) => binToHex(dv.lockingBytecode)),
    );
    for (let index = 0; index < builder.outputs.length; index += 1) {
      if (authoritative.has(index)) continue;
      const output = builder.outputs[index];
      const lock = output?.to instanceof Uint8Array
        ? output.to
        : output?.to !== undefined ? addressToLockScript(output.to) : undefined;
      if (!lock || lock.length !== 35 || lock[0] !== 0xaa) continue;
      if (!jobsLocks.has(binToHex(lock))) continue;
      if (output?.token?.nft?.capability !== 'mutable') continue;
      if (output.token?.category !== host.categoryId) continue;
      // Token-free OP_TRUE keeps TXOUTPUTCOUNT stable without a second jobs run.
      builder.outputs[index] = { to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS };
      stripped += 1;
    }
  }
  if ((placed > 0 || stripped > 0) && (globalThis as { process?: { env?: Record<string, string> } })
    .process?.env?.SOLIDC_DEBUG_CHUNK_LAYOUT === '1') {
    console.error('reassert-reverse-suffix-dynamic-chunks', {
      placed,
      stripped,
      outputCount: builder.outputs.length,
      vars: host.dynamicChunkVars.map((dv) => ({
        name: dv.name,
        commitments: (host.chunkRawCommitments.get(dv.name) ?? []).length,
      })),
    });
  }
  return placed + stripped;
}
