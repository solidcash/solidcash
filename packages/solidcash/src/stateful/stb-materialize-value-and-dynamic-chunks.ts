/**
 * phase-boundary extract: STB build-phase extract — staged value-chunk and dynamic-chunk output append.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { parseChunkCommitment, type FunctionBlockLayout } from '@solidcash/utils';
import { isContractUnlocker, type Output, type UnlockableUtxo, type Unlocker } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript, calculateDust } from '../utils.js';
import type { DerivedChunkOutputObservation } from './value-chunk-persist.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { claimedFixedContinuationCoverage } from './stb-claimed-fixed-continuations.js';

export interface MaterializeValueAndDynamicChunksHost {
  readonly categoryId: string;
  readonly valueChunkOutputs: readonly Output[];
  readonly derivedChunkOutputs: ReadonlyMap<number, DerivedChunkOutputObservation>;
  readonly dynamicChunkVars: ReadonlyArray<{ name: string; lockingBytecode: Uint8Array }>;
  readonly dynamicChunkInputs: readonly UnlockableUtxo[];
  readonly allInputs: readonly UnlockableUtxo[];
  readonly chunkRawCommitments: ReadonlyMap<string, readonly string[]>;
  readonly blockLayout?: FunctionBlockLayout;
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallRawInputs: readonly UnlockableUtxo[];
  readonly iterationEntryInputs: readonly UnlockableUtxo[];
  readonly pendingOutputs: readonly unknown[];
  readonly externalIdentityAnchorUtxos: readonly UnlockableUtxo[];
  readonly logicalIdentityUtxo?: UnlockableUtxo;
  readonly delegateDynamicChunksAtSuffix: boolean;
  /** Runtime-loop outputs or a composed block base move the run by what the transaction carries. */
  readonly runtimeLoopOrComposed: boolean;
  /** The executing input's current unlocker: its witnesses name the coordinates its covenant reads. */
  masterUnlocker(): Unlocker;
  getChunkableValueWriteBand(): { start: number; end: number; nNew: number } | undefined;
  getValueChunkVars(): Array<{ id: string; lockingBytecode: Uint8Array }>;
  valueChunkRawCommitments: ReadonlyMap<string, readonly string[]>;
  padOutputsToIndex(builder: TransactionBuilder, outputIndex: number): void;
  getChunkOutputBase(): number;
  loopEntryOutputCount(): number;
  valueChunkOutputCount(): number;
  tailReturnEventOutputs(): ReadonlyArray<{ categoryId: string }>;
}

/** Append staged value-chunk outputs (band-relative or trailing). */
export function appendValueChunks(
  host: MaterializeValueAndDynamicChunksHost,
  builder: TransactionBuilder,
): void {
  const band = host.getChunkableValueWriteBand();
  const claimed = claimedFixedContinuationCoverage({
    staged: host.valueChunkOutputs,
    derived: host.derivedChunkOutputs,
    groups: [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups],
    blockLayout: host.blockLayout,
  });
  const fixedBandPins = band
    ? [...host.derivedChunkOutputs.entries()].filter(([index, chunk]) => (
      chunk.fixedIndex === true
      && index >= band.start
      && index <= band.end
      && chunk.lockingBytecode.length === 35
      && chunk.commitment.length >= 3
      && chunk.commitment !== '00'
    ))
    : [];
  const isFixedContinuation = (lockingBytecode: Uint8Array, category: string, commitment: string): boolean => (
    claimed.tuples.has(JSON.stringify([category.toLowerCase(), binToHex(lockingBytecode), commitment.toLowerCase()]))
    || fixedBandPins.some(([, chunk]) => (chunk.categoryId ?? host.categoryId).toLowerCase() === category.toLowerCase()
      && binToHex(chunk.lockingBytecode) === binToHex(lockingBytecode) && chunk.commitment === commitment)
  );
  const unpinnedOutputs = host.valueChunkOutputs.filter((output, index) => !claimed.stagedIndices.has(index) && !(
    output.token?.nft?.capability === 'mutable'
      && isFixedContinuation(
        output.to instanceof Uint8Array ? output.to : addressToLockScript(output.to),
        output.token.category, output.token.nft.commitment,
      )
  ));
  // Only place a staged run into an unoccupied selected band. A fixed pin can own a different
  // resource: suppress its exact duplicate, not every other staged or trace-derived continuation.
  const wouldAppendBeforeBand = !!band
    && fixedBandPins.length === 0
    && unpinnedOutputs.length > 0
    && builder.outputs.length < band.start;
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1' && host.valueChunkOutputs.length > 0) {
    console.error('append-value-chunks', JSON.stringify({
      count: host.valueChunkOutputs.length,
      beforeOutputs: builder.outputs.length,
      bandStart: band?.start,
      fixedBandPins: fixedBandPins.length,
      wouldAppendBeforeBand,
      locks: host.valueChunkOutputs.map((output) => {
        const lock = output.to instanceof Uint8Array ? output.to : undefined;
        return lock ? binToHex(lock).slice(0, 20) : String(output.to).slice(0, 20);
      }),
    }));
  }
  if (wouldAppendBeforeBand && band) {
    for (const [offset, vco] of unpinnedOutputs.entries()) {
      if (offset >= band.nNew) break;
      const outputIndex = band.start + offset;
      host.padOutputsToIndex(builder, outputIndex);
      const chunkOutput = { ...vco };
      chunkOutput.amount = BigInt(Math.max(1200, calculateDust(chunkOutput)));
      if (builder.outputs.length === outputIndex) builder.addOutput(chunkOutput);
      else builder.outputs[outputIndex] = chunkOutput;
    }
  } else {
    for (const vco of unpinnedOutputs) {
      const chunkOutput = { ...vco };
      chunkOutput.amount = BigInt(Math.max(1200, calculateDust(chunkOutput)));
      builder.addOutput(chunkOutput);
    }
  }
  for (const { id, lockingBytecode } of host.getValueChunkVars()) {
    for (const commitment of host.valueChunkRawCommitments.get(id) ?? []) {
      if (!isFixedContinuation(lockingBytecode, host.categoryId, commitment)) {
        const chunkOutput = {
          to: lockingBytecode, amount: 1200n,
          token: { amount: 0n, category: host.categoryId,
            nft: { capability: 'mutable' as const, commitment } },
        };
        chunkOutput.amount = BigInt(Math.max(1200, calculateDust(chunkOutput)));
        builder.addOutput(chunkOutput);
      }
    }
  }
}

/**
 * The output a direct covenant reads its first new dynamic chunk at when a returning call ran: one past the highest
 * return index that ran, then the co-spent iteration entries and the sorted batch's trailing predecessors (the
 * compiler's `emitDynamicWriteRunCoordinate`). Undefined when none ran or the covenant locates the run otherwise.
 */
export function returningCallChunkRunBase(
  unlocker: Unlocker, writes: readonly string[], iterationEntryCount: number,
): number | undefined {
  if (!isContractUnlocker(unlocker)) return undefined;
  const { abiFunction: fn, params } = unlocker;
  if (params.length !== fn.inputs.length || unlocker.contract.artifact.composition !== undefined
    || fn.name.startsWith('__message_bus') || !writes.every((name) => fn.dynamicWrites?.includes(name))
    || fn.inputs.some((input) => input.name.startsWith('__internal__vmapCounterPerm_'))) return undefined;
  const valueOf = (name: string): bigint | undefined => {
    const value = params[fn.inputs.findIndex((input) => input.name === name)];
    return typeof value === 'bigint' ? value : undefined;
  };
  // Artifacts publishing an output coordinate locate the completed physical run, including during their
  // first provisional build. Only legacy artifacts without that witness use the return-event anchor.
  if (fn.inputs.some((input) => input.name === '__internal__dynamicChunkOutputBase')) return undefined;
  // Witness suffixes count every returning call; loop-nested ones never anchor the run.
  const anchors = (fn.externalCalls ?? []).filter((call) => call.hasReturnValues)
    .map((call, ordinal) => ({ call, ordinal }))
    .filter(({ call }) => call.occurrence !== 'loop' && call.loopArrayVar === undefined);
  const ran = anchors.reduce((last, { ordinal }) => {
    const index = valueOf(anchors.length === 1
      ? '__internal__externalReturnOutputIdx' : `__internal__externalReturnOutputIdx${ordinal}`);
    return index !== undefined && index > last ? index : last;
  }, -1n);
  if (ran < 0n) return undefined;
  return Number(ran) + 1 + iterationEntryCount + Number(valueOf('__internal__vmapBatchTrailingCount') ?? 0n);
}

/** Append dynamic-storage chunk recreations (suffix-recovered or named vars). */
export function appendDynamicChunks(
  host: MaterializeValueAndDynamicChunksHost,
  builder: TransactionBuilder,
): void {
  if (host.delegateDynamicChunksAtSuffix) {
    const recovered = [...host.derivedChunkOutputs.entries()]
      .filter(([, chunk]) => (chunk.categoryId ?? host.categoryId) === host.categoryId)
      .sort(([left], [right]) => left - right);
    if (recovered.length > 0) {
      for (const [, chunk] of recovered) {
        const chunkOutput = {
          to: chunk.lockingBytecode,
          amount: 1200n,
          token: {
            amount: 0n,
            category: chunk.categoryId ?? host.categoryId,
            nft: { capability: 'mutable' as const, commitment: chunk.commitment },
          },
        };
        chunkOutput.amount = BigInt(Math.max(1200, calculateDust(chunkOutput)));
        builder.addOutput(chunkOutput);
      }
      return;
    }
  }
  // Each written var's run follows the runs of the vars declared before it.
  const runBase = host.delegateDynamicChunksAtSuffix || host.runtimeLoopOrComposed ? undefined
    : returningCallChunkRunBase(host.masterUnlocker(), host.dynamicChunkVars.map((dv) => dv.name),
      host.iterationEntryInputs.length);
  let priorRunChunks = 0;
  for (const dv of host.dynamicChunkVars) {
    const commitments = host.chunkRawCommitments.get(dv.name) ?? [];
    const chunkLock = binToHex(dv.lockingBytecode);
    const oldChunks = host.dynamicChunkInputs.filter((input) => (
      input.token?.category === host.categoryId
      && binToHex(input.unlocker.generateLockingBytecode()) === chunkLock
    ));
    // A read-modify-write can co-spend its old chunks before an external callee. Its published dynamic base
    // points to those inputs. Replace the old prefix there; growth uses balanced pads immediately after it.
    // Appending the entire new run after the callee leaves stale chunks at the authenticated output base.
    const inPlaceIndices = oldChunks.map((input) => host.allInputs.findIndex((candidate) => (
      candidate.txid === input.txid && candidate.vout === input.vout
    )));
    const base = inPlaceIndices[0] ?? -1;
    const hasCanonicalIndex = (commitment: string, index: number): boolean => {
      try { return parseChunkCommitment(commitment).chunkIndex === index; } catch { return false; }
    };
    const inPlace = oldChunks.length > 0
      && commitments.every(hasCanonicalIndex)
      && oldChunks.every((input, index) => hasCanonicalIndex(input.token?.nft?.commitment ?? '', index))
      && inPlaceIndices.every((index, ordinal) => index === base + ordinal
        && index < builder.outputs.length
        && builder.outputs[index]?.token?.category === host.categoryId
        && binToHex(builder.outputs[index]!.to instanceof Uint8Array
          ? builder.outputs[index]!.to as Uint8Array : addressToLockScript(builder.outputs[index]!.to as string))
          === chunkLock)
      && commitments.slice(oldChunks.length).every((_, offset) => {
        const index = base + oldChunks.length + offset;
        const occupant = builder.outputs[index];
        const neutralInput = host.allInputs[index];
        const occupantLock = occupant?.to instanceof Uint8Array ? occupant.to
          : occupant?.to !== undefined ? addressToLockScript(occupant.to) : undefined;
        return occupant?.token === undefined && neutralInput?.token === undefined
          && occupantLock !== undefined
          && binToHex(occupantLock) === binToHex(neutralInput.unlocker.generateLockingBytecode());
      });
    const debugChunkLayout = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_CHUNK_LAYOUT === '1';
    const computedBase = host.getChunkOutputBase();
    if (debugChunkLayout && commitments.length > 0 && builder.outputs.length !== computedBase) {
      console.error('dynamic-chunk-layout-mismatch', {
        name: dv.name, outputBase: builder.outputs.length, computedBase, count: commitments.length,
      });
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1' && commitments.length > 0) {
      console.error('append-dynamic-chunks', {
        name: dv.name,
        lockingBytecode: binToHex(dv.lockingBytecode),
        outputBase: builder.outputs.length,
        computedBase,
        baseParts: {
          layoutTrailingBase: host.blockLayout?.trailingBase,
          layoutBlockSize: host.blockLayout?.blockSize,
          externalCallOutputs: host.externalCallUtxoGroups.map((group) => ({
            shared: group.sharedGroupIndex,
            blockInputs: group.blockInputs?.length,
            fallback: 1 + group.dataNftUtxos.length,
          })),
          externalReturns: host.tailReturnEventOutputs()
            .filter((returnEvent) => returnEvent.categoryId !== host.categoryId).length,
          lowLevelGroups: host.lowLevelCallUtxoGroups.map((group) => 1 + group.dataNftUtxos.length),
          lowLevelRaw: host.lowLevelCallRawInputs.length,
          iterationEntries: host.iterationEntryInputs.length,
          loopEntries: host.loopEntryOutputCount(),
          valueChunks: host.valueChunkOutputCount(),
          pendingOutputs: host.pendingOutputs.length,
          identityAnchors: host.externalIdentityAnchorUtxos.length + (host.logicalIdentityUtxo ? 1 : 0),
        },
        count: commitments.length,
      });
    }
    // A returning call that ran puts the run at the coordinate its covenant reads; whatever sits there moves to the
    // end. Without readable witnesses, an OP_TRUE at the old chunk index puts the replacement one output later.
    const ranAt = inPlace || runBase === undefined ? undefined : runBase + priorRunChunks;
    priorRunChunks += commitments.length;
    const baseOutput = base >= 0 ? builder.outputs[base] : undefined;
    const baseLock = baseOutput?.to instanceof Uint8Array ? baseOutput.to : undefined;
    const tombstoneAtBase = baseLock?.length === 1 && baseLock[0] === 0x51;
    const followsReturnEvent = ranAt === undefined && !inPlace && tombstoneAtBase && commitments.length > 0
      && commitments.every((_commitment, offset) => {
        const occupant = builder.outputs[base + 1 + offset];
        return occupant !== undefined && occupant.token === undefined;
      });
    for (const [chunkIndex, commitment] of commitments.entries()) {
      const chunkOutput = {
        to: dv.lockingBytecode,
        amount: 1200n,
        token: {
          amount: 0n,
          category: host.categoryId,
          nft: { capability: 'mutable' as const, commitment },
        },
      };
      chunkOutput.amount = BigInt(Math.max(1200, calculateDust(chunkOutput)));
      if (inPlace) builder.outputs[base + chunkIndex] = chunkOutput;
      else if (ranAt !== undefined || followsReturnEvent) {
        const outputIndex = (ranAt ?? base + 1) + chunkIndex;
        if (outputIndex > builder.outputs.length) host.padOutputsToIndex(builder, outputIndex);
        const displaced = builder.outputs[outputIndex];
        if (displaced === undefined) builder.addOutput(chunkOutput);
        else {
          builder.outputs[outputIndex] = chunkOutput;
          builder.addOutput(displaced);
        }
      } else builder.addOutput(chunkOutput);
    }
    if (inPlace) {
      // A shrinking write consumes every old chunk, but only the new prefix may remain at this
      // collection address. Keep the balanced output coordinates for later participants while
      // removing the retired NFTs from the chunk namespace.
      for (let chunkIndex = commitments.length; chunkIndex < oldChunks.length; chunkIndex++) {
        builder.outputs[base + chunkIndex] = {
          to: Uint8Array.of(0x51), amount: oldChunks[chunkIndex].satoshis,
        };
      }
    }
  }
}
