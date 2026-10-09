/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — nested LLC commits/event/entry
 * pin tail after entry-NFT INSERT/UPDATE pins (through for-loop body end).
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import {
  Op,
  buildEventNftCovenantScript,
  computeEventNameHash,
  type Artifact,
} from '@solidcash/utils';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { scriptToLockingBytecode } from '../utils.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { usesLegacyJobEventTraceCompatibility } from './legacy-job-event-wire.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import {
  decodeScriptNumber,
  extractCommitmentMapFromTrace,
  extractExpectedOutputCommitmentFromTrace,
  extractFailingValueChunkCommitments,
} from './trace-commitment-helpers.js';
import { preferChunkCommitment } from './value-chunk-band-helpers.js';
import {
  isEmptyValueChunkCommitment,
  selectValueChunkWriteCategory,
  valueChunkIndexFromCommitment,
} from './value-chunk-persist.js';

export type ApplyDeriveFullNestedCommitsEventPinsResult = {
  commitmentProgressDelta: number;
  nestedPinProgressDelta: number;
};

/**
 * Apply OTC commits, failing value-chunk/entry observations, nested event
 * outputs, and declared entry-slot pins for one nested LLC iteration.
 */
export function applyDeriveFullNestedCommitsEventPins(params: {
  stb: StatefulTransactionBuilder;
  probeBuilder2: TransactionBuilder;
  llc: any;
  nestedTrace: any[];
  nestedOutputBase: number;
  implInputIndex: number;
  proxyGroup: ExternalCallUtxoGroup | undefined;
  chunkCategory: string | undefined;
  valueChunkWrites: any[];
  band: any;
  allChunks: any[];
  pin: any;
  [key: string]: any;
}): ApplyDeriveFullNestedCommitsEventPinsResult {
  let commitmentProgressDelta = 0;
  let nestedPinProgressDelta = 0;
  const {
    stb, probeBuilder2, llc, nestedTrace, nestedOutputBase, implInputIndex, proxyGroup,
    chunkCategory, valueChunkWrites, band, allChunks, pin,
  } = params;

  const commits = extractCommitmentMapFromTrace(nestedTrace, { min: 0, max: 64 }, true, true);
  const lastExtractedEmpty = allChunks.length > 0 && (
    isEmptyValueChunkCommitment(allChunks[allChunks.length - 1].commitment)
  || allChunks[allChunks.length - 1].commitment === '050000'
  );
  const allowFailing = allChunks.length > 0 && !!band
  && (band.nNew > allChunks.length || lastExtractedEmpty || band.nNew === allChunks.length);
  const siblingLock = allChunks[0]?.lockingBytecode
  ?? pin?.lockingBytecode
  ?? [...stb.getDerivedChunkOutputs().values()].find((chunk) => chunk.lockingBytecode.length === 35)
    ?.lockingBytecode;
  const describedLock = allChunks[0]?.lockingBytecode ?? pin?.lockingBytecode;
  const writeSelection = selectValueChunkWriteCategory(valueChunkWrites.filter((write: any) => (
    !chunkCategory || write.categoryId.toLowerCase() === chunkCategory.toLowerCase()
  )));
  const exactAuthority = writeSelection.status === 'exact' && band && describedLock
  && (writeSelection.write.outputBase < 0 || writeSelection.write.outputBase === band.start)
    ? { outputBase: band.start, outputCount: band.nNew, lockingBytecode: describedLock }
    : writeSelection.status === 'absent'
      ? undefined
      : null;
  const traceArtifacts = [llc, ...(proxyGroup ? [proxyGroup] : [])].flatMap((group) => [
    group.logicalArtifact,
    group.logicalContract?.inner?.artifact,
    group.externalContract?.inner?.artifact,
  ]).filter((artifact): artifact is Artifact => artifact !== undefined);
  const failingCommits = extractFailingValueChunkCommitments(
    nestedTrace, exactAuthority, usesLegacyJobEventTraceCompatibility(traceArtifacts),
  );
  if ((globalThis as { process?: { env?: Record<string, string> } }).process
    ?.env?.SOLIDC_DEBUG_CHUNK_SCAN === '1') {
    console.error('failing-otc-commits', {
      allowFailing, allChunks: allChunks.length, nNew: band?.nNew,
      lastEmpty: lastExtractedEmpty,
      failing: [...failingCommits.entries()].map(([index, hex]) => ({
        index, hex, len: hex.length,
      })),
    });
  }
  for (const [outputIndex, commitment] of commits) {
    if (commitment.length < 6 || commitment === '00'
    || isEmptyValueChunkCommitment(commitment)) continue;
    const existing = stb.getDerivedChunkOutputs().get(outputIndex);
    if (existing?.commitment === commitment) continue;
    const lock = existing?.lockingBytecode ?? siblingLock;
    if (!lock) continue;
    if (!existing) {
      if (!band || allChunks.length === 0) continue;
      if (outputIndex !== band.start + allChunks.length) continue;
    }
    if (stb.setDerivedChunkOutput(outputIndex, {
      commitment: preferChunkCommitment(existing?.commitment, commitment),
      lockingBytecode: lock,
      categoryId: chunkCategory,
      semanticKind: 'valueChunk',
    })) {
      commitmentProgressDelta += 1;
    }
  }
  for (const [rawIndex, commitment] of failingCommits) {
    if (commitment.length < 6 || isEmptyValueChunkCommitment(commitment)) continue;
    const chunkIndex = valueChunkIndexFromCommitment(commitment);
    const inBand = !!band && rawIndex >= band.start && rawIndex <= band.end;
    const trailingWrite = !!band && rawIndex === band.start - 1 && chunkIndex === undefined;
    const outputIndex = inBand
      ? rawIndex
      : (band && chunkIndex !== undefined && chunkIndex < band.nNew ? band.start + chunkIndex : rawIndex);
    const existing = stb.getDerivedChunkOutputs().get(outputIndex);
    const kept = preferChunkCommitment(existing?.commitment, commitment);
    if (existing?.commitment === kept) continue;
    const lock = trailingWrite
      ? (stb.entryLockNearJobEventsBand() ?? existing?.lockingBytecode ?? siblingLock)
      : (existing?.lockingBytecode ?? siblingLock);
    if (!lock) continue;
    if (!trailingWrite && (!band || outputIndex < band.start || outputIndex > band.end)) continue;
    if (!trailingWrite) {
      const indexPrefix = ((outputIndex - band.start) & 0xff).toString(16).padStart(2, '0');
      if (!kept.toLowerCase().startsWith(indexPrefix)) continue;
    }
    if (stb.setDerivedChunkOutput(outputIndex, {
      commitment: kept,
      lockingBytecode: lock,
      categoryId: chunkCategory,
      semanticKind: trailingWrite ? 'entryPin' : 'valueChunk',
    })) {
      commitmentProgressDelta += 1;
    }
  }
  for (const [rawIndex, commitment] of failingCommits) {
    if (commitment.length < 128 || isEmptyValueChunkCommitment(commitment)) continue;
    if (chunkCategory
    && stb.setExternalCallEntryOutputAt(rawIndex, chunkCategory, commitment)) {
      commitmentProgressDelta += 1;
    }
  }
  const nestedFn = llc.compilerRoute?.abiFunction
  ?? proxyGroup?.compilerRoute?.abiFunction
  ?? llc.externalContract?.inner.artifact.abi.find(
    (candidate: { name: string }) => candidate.name === llc.functionName,
  )
  ?? proxyGroup?.externalContract?.inner.artifact.abi.find(
    (candidate: { name: string }) => candidate.name === (llc.functionName ?? proxyGroup.functionName),
  );
  const nestedEventSlots = (nestedFn?.blockLayout?.slots ?? []).filter(
    (slot: { kind: string }) => slot.kind === 'event',
  );
  const nestedEmits = nestedFn?.emits ?? [];
  if (proxyGroup && nestedEventSlots.length > 0 && nestedEmits.length > 0) {
  // Delegate event opcodes are implementation-executor-relative even when state/value resources are embedded in
  // the owning proxy block. The projected proxy layout reserves the corresponding physical slot, but using the
  // proxy output base here probes a different coordinate and prevents the authenticated event commitment from
  // ever being learned.
    const nestedEventOutputBase = implInputIndex;
    // `commits` is deliberately first-write-wins for computed value chunks: several disjoint covenant
    // families can inspect the same speculative output coordinate while the routed layout converges.
    // An event slot is different. An empty message-bus identity carrier can be preservation-checked at
    // the event's eventual coordinate before the delegate reaches its event covenant; the event check
    // is the later, authoritative write for that coordinate. Reusing the first-write map published the
    // carrier's `SCID` commitment as the event and made the final delegate fail against its real blob.
    const nestedEventCommitments = extractCommitmentMapFromTrace(
      nestedTrace, {
        min: nestedEventOutputBase + nestedEventSlots[0].offset,
        max: nestedEventOutputBase + nestedEventSlots[nestedEventSlots.length - 1].offset + 1,
      }, true, false, true,
    );
    const existingEventOutputs = llc.eventOutputs ?? proxyGroup.eventOutputs;
    const eventOutputs: Array<{
      eventSignature: string; commitment: string; lockingBytecode: Uint8Array;
    } | undefined> = existingEventOutputs
      ? [...existingEventOutputs] : Array(nestedEventSlots.length);
    let eventProgress = false;
    for (let eventIndex = 0; eventIndex < nestedEventSlots.length; eventIndex++) {
      const emitInfo = nestedEmits[eventIndex];
      if (!emitInfo) continue;
      const absoluteIndex = nestedEventOutputBase + nestedEventSlots[eventIndex].offset;
      let commitment = nestedEventCommitments.get(absoluteIndex);
      const materializedCommitment = String(
        probeBuilder2.outputs[absoluteIndex]?.token?.nft?.commitment ?? '',
      );
      // A failing delegate can stop at the event's equality before the broad trace extractor records
      // the write (most commonly when the speculative output still has an empty commitment). The VM's
      // OUTPUTTOKENCOMMITMENT/EQUALVERIFY pair nevertheless authenticates the missing expected value.
      // Recover it exactly as we do for nested entry slots; no event or contract-specific inference is
      // involved.
      if (!commitment || commitment === materializedCommitment) {
        commitment = extractExpectedOutputCommitmentFromTrace(
          nestedTrace, absoluteIndex, materializedCommitment,
        ) ?? commitment;
      }
      if (!commitment) continue;
      const lockingBytecode = eventOutputs[eventIndex]?.lockingBytecode
      ?? scriptToLockingBytecode(
        buildEventNftCovenantScript(
          hexToBin(proxyGroup.categoryId), computeEventNameHash(emitInfo.eventSignature),
        ),
        proxyGroup.externalContract.inner?.addressType ?? 'p2sh32',
      );
      if (eventOutputs[eventIndex]?.commitment === commitment) continue;
      eventOutputs[eventIndex] = {
        eventSignature: emitInfo.eventSignature,
        commitment,
        lockingBytecode,
      };
      eventProgress = true;
    }
    if (eventProgress) {
    // The implementation input is the physical executor of this event check. A logical external-call
    // row can share a different route owner's block, so caching only on that row makes the learned
    // commitment invisible to the delegate event materializer. Keep the executor authoritative and
    // mirror the logical row for callers which inspect route-local derivation state.
      llc.eventOutputs = eventOutputs;
      proxyGroup.eventOutputs = eventOutputs;
      commitmentProgressDelta += 1;
      nestedPinProgressDelta += 1;
    }
  }
  const nestedEntrySlots = (nestedFn?.blockLayout?.slots ?? []).filter(
    (slot: { kind: string; offset: number }) => slot.kind === 'entry',
  );
  if (proxyGroup && nestedEntrySlots.length > 0) {
    const implBand = extractCommitmentMapFromTrace(
      nestedTrace,
      {
        min: Math.max(0, nestedOutputBase - 2),
        max: nestedOutputBase + (nestedFn?.blockLayout?.blockSize ?? 8) + 2,
      },
      true,
    );
    // Only pin declared entry slots — dumping the whole impl band previously
    // cached old entry commitments onto dataNft absolute indices.
    for (const slot of nestedEntrySlots) {
      const absoluteIndex = nestedOutputBase + slot.offset;
      let commitment = implBand.get(absoluteIndex) ?? commits.get(absoluteIndex);
      const rawMaterializedCommitment = probeBuilder2.outputs[absoluteIndex]?.token?.nft?.commitment;
      const materializedCommitment = String(rawMaterializedCommitment ?? '');
      if (!commitment || commitment === materializedCommitment || hexToBin(commitment).length < 64) {
        commitment = extractExpectedOutputCommitmentFromTrace(
          nestedTrace, absoluteIndex, materializedCommitment,
        ) ?? commitment;
      }
      if (!commitment || hexToBin(commitment).length < 64) {
        for (let step = nestedTrace.length - 1; step >= 0; step--) {
          const state = nestedTrace[step];
          if (state.instructions[state.ip]?.opcode !== Op.OP_OUTPUTTOKENCOMMITMENT) continue;
          if (state.stack.length < 2) continue;
          const top = state.stack[state.stack.length - 1];
          const below = state.stack[state.stack.length - 2];
          let outputIndex = Number.NaN;
          let expected: Uint8Array | undefined;
          if (top.length <= 8 && below.length >= 64) {
            outputIndex = Number(decodeScriptNumber(top));
            expected = below;
          } else if (below.length <= 8 && top.length >= 64) {
            outputIndex = Number(decodeScriptNumber(below));
            expected = top;
          }
          if (outputIndex !== absoluteIndex || !expected || expected.length < 64) continue;
          commitment = binToHex(expected);
          break;
        }
      }
      if (commitment && hexToBin(commitment).length >= 64) {
        if (stb.setExternalCallEntryOutput(proxyGroup.categoryId, slot.offset, commitment)) {
          commitmentProgressDelta += 1;
        }
        if (stb.setExternalCallEntryOutputAt(absoluteIndex, proxyGroup.categoryId, commitment)) {
          commitmentProgressDelta += 1;
        }
      }
    }
  }
  return { commitmentProgressDelta, nestedPinProgressDelta };
}
