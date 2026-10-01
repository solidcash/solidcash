/**
 * phase-boundary extract: STB class-body extract — scaled preserve ranges, emit destinations, SCID reserved indices.
 * Free functions over ScaledPreserveEmitHost (extends ChunkableWritePlanningHost).
 */

import type { AbiFunction, FunctionBlockLayout } from '@solidcash/utils';
import type { UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import {
  chunkableValueWriteAbi,
  chunkableValueWriteExecution,
  hasChunkableValueWriteMetadata,
  isInitialChunkableValueWrite,
  isPersistedChunkableValueWriteReady,
  permitsLegacyNamedValueChunkFallbackForGroups,
  type ChunkableWritePlanningHost,
} from './stb-chunkable-write-planning.js';
import { externalCallEventDestinations } from './value-chunk-base-writer-select.js';
import { chunkableWriterEventOutputIndex } from './same-index-twin-emit.js';
import { writerBlockOccupancyEnd } from './persist-predecessor-layout.js';
import { returnWitnessOutputIndices } from './physical-return-layout.js';
import {
  isCompilerDescribedMintingBandWriter,
  scaledInputPreserveExclusiveEnd,
  tokenWriterReturnIndex,
} from './value-chunk-geometry.js';
import { legacyIsPublishJobEventName } from './legacy-planning-heuristics.js';
import { persistAndTokenWriterOccupancy } from './early-value-chunk-helpers.js';

export interface ScaledPreserveEmitHost extends ChunkableWritePlanningHost {
  readonly allInputs: readonly UnlockableUtxo[];
  readonly blockLayout?: FunctionBlockLayout;
  readonly runtimeLoopEventOutputs: readonly unknown[];
  readonly authenticatedOutputLockingBytecodes: ReadonlyMap<number, unknown>;
  readonly mintingOutputSwap?: { from: number; width: number; categoryId: string };
  readonly delegateDynamicChunksAtSuffix: boolean;
  getChunkableValueWriteBand(): { start: number; end: number; nNew: number } | undefined;
  getExternalCallOutputBase(groupIndex: number): number;
  getRuntimeLoopEventOutputIndex(index: number): number;
  findMintingInputIndex(categoryId: string): number;
  dynamicChunkOutputCount(): number;
}

export function scaledPreserveRanges(
  host: ScaledPreserveEmitHost,
): Array<{ start: number; endExclusive: number }> {
  const ranges: Array<{ start: number; endExclusive: number }> = [];
  for (const [llcIndex, group] of host.lowLevelCallUtxoGroups.entries()) {
    if (group.callMode !== 'delegatecall') continue;
    const impl = host.getLowLevelCallMasterInputIndex(llcIndex);
    if (impl < 0) continue;
    const dataNfts = (group.compilerRoute?.abiFunction?.blockLayout?.slots
      ?? group.blockLayout?.slots ?? []).filter((slot) => slot.kind === 'dataNft').length;
    const scale = Math.max(2, 1 + (dataNfts || 4));
    const endExclusive = scaledInputPreserveExclusiveEnd(impl, scale);
    if (endExclusive < 0) continue;
    ranges.push({ start: endExclusive - scale + 1, endExclusive });
  }
  return ranges;
}

export function entryScaledPreserveRange(
  host: ScaledPreserveEmitHost,
): { start: number; endExclusive: number } | undefined {
  const ranges = scaledPreserveRanges(host);
  if (ranges.length === 0) return undefined;
  return ranges.reduce((earliest, range) =>
    (earliest.start < range.start ? earliest : range));
}

export function chunkableValueWriteInputIndex(host: ScaledPreserveEmitHost): number {
  const structural = chunkableValueWriteExecution(host);
  if (structural) return structural.inputIndex;
  if (hasChunkableValueWriteMetadata(host)) return -1;
  if (!permitsLegacyNamedValueChunkFallbackForGroups(host)) return -1;
  // Dest is INPUTINDEX+4 of the earliest executing publishJobEvent. Occupied
  // dests are displaced; do not relocate dest because persist sits at +4. Compatibility only: old artifacts
  // without chunkable-write metadata still identify this executor by their historical ABI function name.
  const candidates: number[] = [];
  for (const [index, input] of host.allInputs.entries()) {
    const name = (input as { unlocker?: { abiFunction?: { name?: string } } })
      .unlocker?.abiFunction?.name ?? '';
    if (legacyIsPublishJobEventName(name)) candidates.push(index);
  }
  for (const [llcIndex, group] of host.lowLevelCallUtxoGroups.entries()) {
    const names = [group.logicalFunctionName, group.functionName, group.compilerRoute?.abiFunction?.name];
    if (!names.some((name) => legacyIsPublishJobEventName(name))) {
      continue;
    }
    const master = host.getLowLevelCallMasterInputIndex(llcIndex);
    if (master >= 0) candidates.push(master);
  }
  if (candidates.length > 0) return Math.min(...candidates);
  return -1;
}

export function scaledEmitOutputIndex(
  host: ScaledPreserveEmitHost,
  outputCount: number,
): number | undefined {
  // First publish already fills Created in the callee walk at layout dest.
  if (!isPersistedChunkableValueWriteReady(host) || isInitialChunkableValueWrite(host)) return undefined;
  const impl = chunkableValueWriteInputIndex(host);
  // No executing publishJobEvent: do not invent dest as preserve-range-1
  // (that clobbered registerArbitrator dest 7 after persist became ready).
  if (impl < 0) return undefined;
  const offset = chunkableValueWriteAbi(host)?.blockLayout?.slots
    .find((slot) => slot.kind === 'event')?.offset ?? 4;
  const dest = chunkableWriterEventOutputIndex(impl, offset);
  if (dest >= 0 && (outputCount <= 0 || dest < outputCount)) return dest;
  return undefined;
}

export function emitDestinationIndices(host: ScaledPreserveEmitHost): number[] {
  // `blockLayout` is the builder's effective physical layout. It can be a
  // compiler-selected message-bus route rather than the public entry ABI,
  // so its root event frame is authoritative even when the executing
  // delegate implementation declares no events of its own.
  const dests = (host.blockLayout?.slots ?? [])
    .filter((slot) => slot.kind === 'event')
    .map((slot) => slot.offset);
  const scaled = scaledEmitOutputIndex(host, host.allInputs.length);
  if (scaled !== undefined && scaled >= 0) dests.push(scaled);
  dests.push(...externalCallEventDestinations(
    host.externalCallUtxoGroups,
    (groupIndex) => host.getExternalCallOutputBase(groupIndex),
  ));
  for (const [llcIndex, llc] of host.lowLevelCallUtxoGroups.entries()) {
    if (llc.callMode !== 'delegatecall') continue;
    const impl = host.getLowLevelCallMasterInputIndex(llcIndex);
    if (impl < 0) continue;
    const fn = llc.compilerRoute?.abiFunction
      ?? llc.externalContract?.inner?.artifact.abi.find((candidate: AbiFunction) => candidate.name === llc.functionName);
    for (const slot of fn?.blockLayout?.slots ?? []) {
      if (slot.kind === 'event') dests.push(impl + slot.offset);
    }
  }
  // Runtime-loop events live in the trailing journal rather than fixed `blockLayout` slots. They are still
  // compiler-owned event destinations: leaving them out lets the generic empty-immutable repair relabel their
  // probe commitments as `SCID`, preventing event derivation (and every interleaved effect after the event).
  for (let index = 0; index < host.runtimeLoopEventOutputs.length; index += 1) {
    dests.push(host.getRuntimeLoopEventOutputIndex(index));
  }
  return dests;
}

export function hasMintingBandTokenWriter(host: ScaledPreserveEmitHost): boolean {
  return host.externalCallUtxoGroups.some((group) =>
    isCompilerDescribedMintingBandWriter(group, true, host.messageBusConvention))
    || host.mintingOutputSwap !== undefined;
}

export function tokenWriterOccupancyForHost(
  host: ScaledPreserveEmitHost,
  tokenMaster: number,
  outputs?: ReadonlyArray<{ token?: { nft?: { commitment?: string } } }>,
): Set<number> {
  return persistAndTokenWriterOccupancy({
    persistReady: isPersistedChunkableValueWriteReady(host),
    firstPublish: isInitialChunkableValueWrite(host),
    hasTokenWriter: hasMintingBandTokenWriter(host),
    implIndex: chunkableValueWriteInputIndex(host),
    band: host.getChunkableValueWriteBand(),
    tokenMaster,
    outputs,
  });
}

export function reassertScaledPreserveOneToOnes(
  host: ScaledPreserveEmitHost,
  builder: TransactionBuilder,
): void {
  if (!isPersistedChunkableValueWriteReady(host) || isInitialChunkableValueWrite(host)) return;
  const emitDests = new Set(emitDestinationIndices(host));
  const emitDest = scaledEmitOutputIndex(host, builder.outputs.length);
  if (emitDest !== undefined) emitDests.add(emitDest);
  const persistBand = host.getChunkableValueWriteBand();
  const returnWitnesses = returnWitnessOutputIndices(host.externalCallUtxoGroups);
  for (const group of host.externalCallUtxoGroups) {
    if (!isCompilerDescribedMintingBandWriter(group, true, host.messageBusConvention)) continue;
    const master = host.findMintingInputIndex(group.categoryId);
    if (master >= 0) {
      returnWitnesses.add(tokenWriterReturnIndex(master, group.blockLayout, persistBand));
    }
  }
  const restore = (start: number, endExclusive: number): void => {
    for (let index = start; index < endExclusive; index++) {
      if (emitDests.has(index)) continue;
      if (returnWitnesses.has(index)) continue;
      if (persistBand && index >= persistBand.start && index <= persistBand.end) continue;
      const input = host.allInputs[index];
      if (!input || !('unlocker' in input) || !input.unlocker || input.token) continue;
      builder.outputs[index] = {
        to: input.unlocker.generateLockingBytecode(),
        amount: input.satoshis,
      };
    }
  };
  const entry = entryScaledPreserveRange(host);
  if (entry) restore(entry.start, entry.endExclusive);
  for (const [index, input] of host.allInputs.entries()) {
    if (input?.token?.nft?.capability !== 'minting') continue;
    const endExclusive = scaledInputPreserveExclusiveEnd(index, 5);
    if (endExclusive <= 0 || endExclusive > builder.outputs.length + 5) continue;
    restore(endExclusive - 4, endExclusive - 1);
  }
}

export function scidReservedIndices(
  host: ScaledPreserveEmitHost,
  outputCount = host.allInputs.length,
): Set<number> {
  const reserved = new Set(emitDestinationIndices(host));
  for (const index of host.authenticatedOutputLockingBytecodes.keys()) reserved.add(index);
  const band = host.getChunkableValueWriteBand();
  if (band) {
    reserved.add(Math.max(0, band.start - 1));
    for (let index = band.start; index <= band.end; index++) reserved.add(index);
  }
  const eventSlot = entryScaledPreserveRange(host);
  if (eventSlot && isPersistedChunkableValueWriteReady(host) && !isInitialChunkableValueWrite(host)) {
    reserved.add(eventSlot.endExclusive - 1);
  }
  for (const [llcIndex, group] of host.lowLevelCallUtxoGroups.entries()) {
    if (group.callMode !== 'delegatecall') continue;
    const impl = host.getLowLevelCallMasterInputIndex(llcIndex);
    if (impl < 0) continue;
    const blockSize = group.compilerRoute?.abiFunction?.blockLayout?.blockSize
      ?? group.blockLayout?.blockSize
      ?? 5;
    for (let offset = 0; offset < blockSize; offset++) reserved.add(impl + offset);
  }
  const occupancyEnd = writerBlockOccupancyEnd(
    host.externalCallUtxoGroups,
    (categoryId) => host.findMintingInputIndex(categoryId),
  );
  for (let index = 0; index < occupancyEnd; index++) {
    const input = host.allInputs[index];
    if (input?.token?.nft?.capability === 'minting' || input?.token?.nft?.capability === 'mutable') {
      reserved.add(index);
    }
  }
  for (const range of scaledPreserveRanges(host)) {
    for (let index = range.start; index < range.endExclusive; index++) reserved.add(index);
  }
  for (const group of host.externalCallUtxoGroups) {
    if (!isCompilerDescribedMintingBandWriter(group, true, host.messageBusConvention)) continue;
    const master = host.findMintingInputIndex(group.categoryId);
    if (master >= 0) reserved.add(tokenWriterReturnIndex(master, group.blockLayout, band));
  }
  const jobsCount = host.delegateDynamicChunksAtSuffix ? host.dynamicChunkOutputCount() : 0;
  if (jobsCount > 0) {
    const suffixStart = Math.max(0, outputCount - jobsCount - 1);
    for (let index = suffixStart; index < outputCount; index++) reserved.add(index);
  }
  return reserved;
}
