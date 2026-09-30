/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — Phase 1 progressive entry / value-chunk probe loop.
 */

import {
  binToHex, encodeTransaction, hexToBin, type AuthenticationProgramStateCommon,
} from '@bitauth/libauth';
import type { AbiFunction } from '@solidcash/utils';
import {
  VALUE_CHUNK_INDEX_SIZE, VALUE_CHUNK_SIZE, VALUE_HEAD_SIZE,
  joinValueChunks, parseValueChunkCommitment, sha256 as sha256Sync,
} from '@solidcash/utils';
import type NetworkProvider from '../network/NetworkProvider.js';
import { generateLibauthSourceOutputs } from '../utils.js';
import {
  isCompleteCollectionValue,
  recoverAuthenticatedArrayValue,
  selectAuthenticatedPreValueWitness,
  storedChunkableValueRoots,
} from './authenticated-collection-value.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { evaluateProbeTrace } from './faithful-probe-trace.js';
import {
  progressiveRouteProbePassLimit,
  routeProbeEntrySlotOffsetForOutput,
  routeProbeRepairableEntryCoordinateCount,
  type RouteProbeObservationHistory,
} from './route-probe-progress.js';
import { entryAccessAt } from './route-expression-key.js';
import { deriveRouteValueChunks } from './route-value-chunk-helpers.js';
import type { MessageBusRuntimeAbiFunction } from './sc-batch-raw.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { extractCommitmentMapFromTrace } from './trace-commitment-helpers.js';
import {
  describeValueChunkWrites,
  physicalExternalCallFunction,
} from './writer-group-selection.js';

export interface DeriveFullPhase1ProgressiveEntriesHost {
  readonly inner: { provider: NetworkProvider };
}

/**
 * Progressively materialize B's sorted-entry / value-chunk outputs from Phase-1 probe traces.
 * No-op when the group has no blockLayout/blockInputs.
 */
export function deriveFullPhase1ProgressiveEntries(
  host: DeriveFullPhase1ProgressiveEntriesHost,
  stb: StatefulTransactionBuilder,
  group: ExternalCallUtxoGroup,
  groupIdx: number,
  bOutputBase: number,
  fullTrace: AuthenticationProgramStateCommon[],
  transaction: Parameters<typeof encodeTransaction>[0],
  bMasterIdx: number,
  valueChunkWitness: unknown,
  debugTargetDerivation: boolean,
): void {
  if (group.blockLayout && group.blockInputs) {
    const bEntryMap = group.compilerRoute
      ? new Map<number, string>()
      : extractCommitmentMapFromTrace(fullTrace,
        { min: bOutputBase, max: bOutputBase + group.blockInputs.length }, true);
    if (debugTargetDerivation && group.functionName === 'approve') {
      console.error('approve-entry-map', {
        bOutputBase,
        blockSize: group.blockInputs.length,
        entries: [...bEntryMap.entries()],
        slots: group.blockLayout.slots.map((slot) => ({ kind: slot.kind, offset: slot.offset })),
      });
    }
    // The initial trace commonly stops at the data-NFT placeholder. Compiler routes derive entry
    // outputs progressively, so begin that process from a fresh transaction after the data commitment
    // above has been installed; otherwise an empty first map terminates the loop before any entry write
    // (for example ERC20 approve's allowance update) can be revealed.
    let entryTrace = fullTrace;
    let entryTransaction = transaction;
    const requiresFreshEntryProbe = group.compilerRoute !== undefined
      || group.delegateEmbeddedInBlock === true || valueChunkWitness !== undefined;
    if (requiresFreshEntryProbe) {
      const entryProbe = stb.build();
      entryTransaction = entryProbe.buildLibauthTransaction();
      if (['SOLIDC_DEBUG_ROUTE_CONCISE', 'SOLIDC_DEBUG_RETURN', 'SOLIDC_DEBUG_CHUNK_SCAN'].some((name) =>
        (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.[name] === '1')) {
        console.error('route-entry-output-window', entryProbe.outputs.slice(38, 50).map((output, offset) => ({
          index: 38 + offset,
          bytecode: typeof output.to === 'string' ? output.to : binToHex(output.to),
          category: output.token?.category,
          commitment: output.token?.nft?.commitment,
        })));
        console.error('route-entry-libauth-output-44', entryTransaction.outputs[44] && {
          bytecode: binToHex(entryTransaction.outputs[44].lockingBytecode),
          category: entryTransaction.outputs[44].token?.category
            ? binToHex(entryTransaction.outputs[44].token!.category) : undefined,
        });
      }
      entryTrace = evaluateProbeTrace(host.inner.provider, {
        inputIndex: bMasterIdx,
        sourceOutputs: generateLibauthSourceOutputs(entryProbe.inputs),
        transaction: entryTransaction,
      });
    }
    const entrySlotCount = group.blockLayout.slots.filter((slot) => slot.kind === 'entry').length;
    const embeddedDelegate = group.delegateCallGroupIndex === undefined
      ? undefined : stb.getLowLevelCallUtxoGroups()[group.delegateCallGroupIndex];
    const repairableEntryCoordinateCount = routeProbeRepairableEntryCoordinateCount(
      group, embeddedDelegate,
    );
    // A covenant stops at the first mismatching entry output, so one
    // trace can reveal only the first pending commitment. Feed each
    // newly revealed commitment back into the probe and continue
    // until every reachable fixed entry slot has been materialized.
    // Probe progress is resource-based, not setter-based. A long value is recovered as one complete run;
    // physical output replacement must never extend its own convergence budget.
    const valueChunkWritesForProbe = group.valueChunkWrites ?? describeValueChunkWrites(group);
    const routeConvention = (physicalExternalCallFunction(group) as MessageBusRuntimeAbiFunction | undefined)
      ?.messageBusConvention
      ?? group.logicalArtifact?.messageBus?.convention
      ?? group.externalContract?.inner.artifact.messageBus?.convention;
    const routeProbeObservations: RouteProbeObservationHistory = new Map();
    const routeProbeTransactions = new Set<string>();
    const routeProbePassLimit = progressiveRouteProbePassLimit(
      repairableEntryCoordinateCount, valueChunkWritesForProbe,
    );
    routeProbeTransactions.add(binToHex(encodeTransaction(entryTransaction)));
    // A direct call can write several mapping entries too (for example, allowance + two balances). Its
    // first faithful trace already reveals the first mismatch, so install that observation and rebuild
    // before entering the same progressive loop used by routed calls. Otherwise the accepted transaction
    // preserves every entry after the first one because the VM cannot reveal later commitments yet.
    if (!requiresFreshEntryProbe && entrySlotCount > 0) {
      let seededInitialEntry = false;
      for (const [outputIndex, commitment] of bEntryMap) {
        const blockSlot = outputIndex - bOutputBase;
        if (group.blockLayout.slots[blockSlot]?.kind !== 'entry'
          || hexToBin(commitment).length < 64 || /^0+$/.test(commitment)) continue;
        stb.setExternalCallEntryOutput(group.categoryId, blockSlot, commitment);
        seededInitialEntry = true;
      }
      if (seededInitialEntry) {
        const entryProbe = stb.build();
        entryTransaction = entryProbe.buildLibauthTransaction();
        entryTrace = evaluateProbeTrace(host.inner.provider, {
          inputIndex: bMasterIdx,
          sourceOutputs: generateLibauthSourceOutputs(entryProbe.inputs),
          transaction: entryTransaction,
        });
        routeProbeTransactions.add(binToHex(encodeTransaction(entryTransaction)));
      }
    }
    for (let pass = 0; entrySlotCount > 0 && pass < routeProbePassLimit; pass++) {
      const revealed = extractCommitmentMapFromTrace(entryTrace,
        { min: bOutputBase, max: bOutputBase + group.blockInputs.length }, true);
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ROUTE_VERBOSE === '1') {
        const aborted = entryTrace.at(-1);
        console.error('progressive-route-entries', {
          groupIdx,
          pass,
          revealed: [...revealed.entries()],
          learned: [...bEntryMap.entries()],
          error: aborted?.error,
          instructionCount: aborted?.instructions.length,
          ip: aborted?.ip,
        });
      }
      let progressed = false;
      const delegateLlc = group.delegateCallGroupIndex === undefined
        ? undefined : stb.getLowLevelCallUtxoGroups()[group.delegateCallGroupIndex];
      const delegateImplIndex = group.delegateCallGroupIndex === undefined
        ? -1 : stb.getLowLevelCallMasterInputIndex(group.delegateCallGroupIndex);
      const delegateImplFn = delegateLlc?.compilerRoute?.abiFunction
        ?? delegateLlc?.externalContract?.inner.artifact.abi.find(
          (candidate: AbiFunction) => candidate.name === delegateLlc.functionName,
        );
      for (const [outputIndex, commitment] of revealed) {
        const previous = bEntryMap.get(outputIndex);
        if (hexToBin(commitment).length < 64 || /^0+$/.test(commitment)) continue;
        // A provisional PredOut witness can still point at the fixed NEW slot. Its later P' comparison then
        // exposes the predecessor commitment at that same output index, even though the compiler plan places
        // P' in the trailing slot. Do not let that second observation erase the already learned NEW node.
        if (group.plannedEntryInserts?.some((planned) => (
          planned.outputBlockSlot !== planned.blockSlot
          && outputIndex === bOutputBase + planned.blockSlot
          && planned.commitment?.toLowerCase() === commitment.toLowerCase()
        ))) continue;
        // bEntryMap records what an authenticated probe observed; it does not prove the current builder
        // has materialized those bytes. In particular, the initial trace can reveal a complete NEW node
        // which an earlier relative-slot seed records while physical compaction still leaves P' at that
        // output. Always offer a valid observation to both materializers and let their actual caches say
        // whether the next transaction changes. String length is not a completeness test: a canonical
        // zero-valued sorted node is exactly 64 bytes.
        if (previous !== commitment) bEntryMap.set(outputIndex, commitment);
        const blockSlot = routeProbeEntrySlotOffsetForOutput(outputIndex, [
          { base: bOutputBase, slots: group.blockLayout.slots },
          { base: delegateImplIndex, slots: delegateImplFn?.blockLayout?.slots },
        ]);
        if (blockSlot !== undefined) {
          progressed = stb.setExternalCallEntryOutput(
            group.categoryId, blockSlot, commitment,
          ) || progressed;
          // The covenant names the physical output index too. Cache that coordinate only after a
          // compiler-published block layout proves it is an entry. The trace window also contains data,
          // event, value-chunk and continuation outputs whose commitments can be entry-sized; accepting
          // those as speculative entries reports progress even when suffix materialization overwrites
          // them. Runtime-loop entries and INSERT nodes are installed by their explicit journal metadata
          // paths, not inferred from this fixed-entry probe.
          if (stb.setExternalCallEntryOutputAt(
            outputIndex, group.categoryId, commitment,
          )) progressed = true;
        }
      }
      const chunkProgress = deriveRouteValueChunks(
        group, bOutputBase, entryTrace, stb, routeProbeObservations, routeConvention,
      );
      if (chunkProgress.changed) progressed = true;
      if (!progressed) break;
      const nextProbe = stb.build();
      const nextTransaction = nextProbe.buildLibauthTransaction();
      const nextFingerprint = binToHex(encodeTransaction(nextTransaction));
      if (routeProbeTransactions.has(nextFingerprint)) {
        // A repeated physical transaction is a FIXED POINT: this pass applied every observation the trace
        // revealed and the built transaction is unchanged, so further probing cannot reveal anything new.
        // Accepting it is what "converged" means; the previous guard treated convergence as failure and
        // told the caller to supply state manually.
        break;
      }
      if (pass + 1 === routeProbePassLimit) {
        throw new Error(
          `Route probe convergence exhausted after ${routeProbePassLimit} passes.`,
        );
      }
      routeProbeTransactions.add(nextFingerprint);
      entryTrace = evaluateProbeTrace(host.inner.provider, {
        inputIndex: bMasterIdx,
        sourceOutputs: generateLibauthSourceOutputs(nextProbe.inputs),
        transaction: nextTransaction,
      });
    }
    if (group.delegateEmbeddedInBlock && group.delegateCallGroupIndex !== undefined) {
      const delegateGroup = stb.getLowLevelCallUtxoGroups()[group.delegateCallGroupIndex];
      const delegateFn = delegateGroup?.compilerRoute?.abiFunction
        ?? delegateGroup?.externalContract.inner.artifact.abi.find(
          (candidate: AbiFunction) => candidate.name === delegateGroup.functionName,
        );
      const witnessInput = delegateFn?.inputs.find((input: { name: string }) =>
        /^__internal__valueWitness_\d+$/.test(input.name));
      const witnessSlot = Number(witnessInput?.name.match(/\d+$/)?.[0] ?? -1);
      const witnessCollection = entryAccessAt(delegateFn, witnessSlot)?.collection;
      const witnessLayout = delegateGroup?.stateLayout
        ?? delegateGroup?.externalContract.inner.stateLayout;
      const witnessValueType = witnessLayout?.collections?.find((collection) =>
        collection.name === witnessCollection || collection.signature === witnessCollection)?.valueType;
      // The computed value and the root authenticating it need not coexist in one VM stack frame. Match
      // across the complete trace: the value is assembled before the witness check, while its expected
      // root is loaded by that later check. This breaks the probe's otherwise circular dependency on the
      // continuation outputs, whose commitments are pinned only after the witness has authenticated.
      const traceRoots = new Set(entryTrace.flatMap((state) => state.stack)
        .filter((item) => item.length === 32).map(binToHex));
      const traceItems = entryTrace.flatMap((state) => state.stack);
      const storedRoots = storedChunkableValueRoots(
        delegateGroup?.blockInputs ?? group.blockInputs,
      );
      let learnedValue = storedRoots.size > 0
        ? selectAuthenticatedPreValueWitness(
          traceItems, storedRoots, witnessValueType, witnessLayout?.structs,
        )
        : undefined;
      if (storedRoots.size > 0) {
        learnedValue ??= recoverAuthenticatedArrayValue(
          traceItems, storedRoots, witnessValueType, witnessLayout?.structs, storedRoots,
        );
      }
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_CHUNK_SCAN === '1') console.error('route-learned-witness', {
        witnessValueType, length: learnedValue?.length,
        rootCount: traceRoots.size, roots: [...traceRoots].slice(0, 20),
      });
      // Computed long writes can mutate bytes beyond the 28-byte inline head (e.g. timestamp stamping),
      // so the complete pre-mutation value on the stack does not match the new root. The chunk pin loop
      // nevertheless leaves each expected `uint16 index || data` commitment in the trace. Reassemble
      // those authenticated pieces with each candidate head and accept only a root-matching result.
      if (!learnedValue) {
        for (const headCandidate of traceItems.filter((item) => item.length > 60 && item.length <= 10_000)) {
          if (!isCompleteCollectionValue(headCandidate, witnessValueType, witnessLayout?.structs)) continue;
          const expectedCount = Math.ceil((headCandidate.length - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE);
          if (expectedCount < 1 || expectedCount > 32) continue;
          const candidates: Array<{ chunkIndex: number; chunkData: Uint8Array }> = [];
          for (let chunkIndex = 0; chunkIndex < expectedCount; chunkIndex++) {
            const expectedDataLength = chunkIndex + 1 < expectedCount
              ? VALUE_CHUNK_SIZE
              : headCandidate.length - VALUE_HEAD_SIZE - VALUE_CHUNK_SIZE * chunkIndex;
            const item = [...traceItems].reverse().find((candidate) =>
              candidate.length === VALUE_CHUNK_INDEX_SIZE + expectedDataLength
              && candidate[0] === (chunkIndex & 0xff)
              && candidate[1] === (chunkIndex >>> 8));
            if (!item) break;
            candidates.push(parseValueChunkCommitment(binToHex(item)));
          }
          if (candidates.length !== expectedCount) continue;
          const joined = joinValueChunks(
            headCandidate.slice(0, VALUE_HEAD_SIZE), candidates, headCandidate.length,
          );
          const digest = binToHex(sha256Sync(joined));
          if (storedRoots.has(digest)) {
            learnedValue = joined;
            break;
          }
        }
      }
      const currentWitness = witnessInput
        ? delegateGroup?.internalArgs?.[witnessInput.name]
          ?? delegateGroup?.compilerRoute?.internalArgs?.[witnessInput.name]
        : undefined;
      if (currentWitness instanceof Uint8Array && currentWitness.length > 60
        && isCompleteCollectionValue(currentWitness, witnessValueType, witnessLayout?.structs)) {
        learnedValue = undefined;
      } else if (currentWitness instanceof Uint8Array
        && storedRoots.has(binToHex(sha256Sync(currentWitness)))
        && (!learnedValue || !storedRoots.has(binToHex(sha256Sync(learnedValue))))) {
        learnedValue = currentWitness;
      }
      if (witnessInput && learnedValue && delegateGroup?.refreshInternalArgs) {
        delegateGroup.refreshInternalArgs({ [witnessInput.name]: learnedValue });
        stb._refreshInputs();
        const witnessProbe = stb.build();
        entryTrace = evaluateProbeTrace(host.inner.provider, {
          inputIndex: bMasterIdx,
          sourceOutputs: generateLibauthSourceOutputs(witnessProbe.inputs),
          transaction: witnessProbe.buildLibauthTransaction(),
        });
        for (const [outputIndex, commitment] of extractCommitmentMapFromTrace(
          entryTrace, { min: bOutputBase, max: bOutputBase + group.blockInputs.length }, true,
        )) {
          bEntryMap.set(outputIndex, commitment);
          const blockSlot = outputIndex - bOutputBase;
          if (group.blockLayout.slots[blockSlot]?.kind === 'entry') {
            stb.setExternalCallEntryOutput(group.categoryId, blockSlot, commitment);
          }
        }
      }
    }
    const bInsertBase = group.blockLayout.trailingBase
      ?? group.blockLayout.blockSize ?? group.blockInputs.length;
    const insertHandles: Array<{ handle: number; newIdx: number; planned: boolean }> = [];
    let insertCount = 0;
    for (let si = 0; si < group.blockLayout.slots.length; si++) {
      if (group.blockLayout.slots[si]?.kind !== 'entry') continue;
      const commit = bEntryMap.get(bOutputBase + si);
      if (commit === undefined) continue;
      stb.setExternalCallEntryOutput(group.categoryId, si, commit);
      // INSERT vs UPDATE: an UPDATE output preserves the co-spent entry's nextKey; an INSERT co-spends the
      // PREDECESSOR and its P' output re-points nextKey (bytes 32..64) to H(k), so out.next != in.next. For an
      // INSERT, mint a placeholder NEW at the entry address so output[bMasterIdx+blockSize+j] exists (else B's
      // OP_OUTPUTBYTECODE for the NEW aborts before revealing its commitment); the 2nd pass fills the real one.
      const input = group.blockInputs[si];
      const inCommit = input?.token?.nft?.commitment;
      const plannedIndex = group.plannedEntryInserts
        ?.findIndex((planned) => planned.blockSlot === si) ?? -1;
      // Linear in-block batches (PredOut=-1, TrailingCount=0) place NEW at a layout entry
      // offset. A shared-proof P' also changes nextKey at the proof co-spend output; that is
      // not a trailing INSERT. Treating it as one clones the collection lock past blockSize
      // and fails the output-cardinality EQUALVERIFY (expected 2, got 3).
      const trailingCountRaw = group.internalArgs?.__internal__vmapBatchTrailingCount
        ?? group.compilerRoute?.internalArgs?.__internal__vmapBatchTrailingCount;
      const trailingCount = typeof trailingCountRaw === 'bigint' ? Number(trailingCountRaw)
        : typeof trailingCountRaw === 'number' ? trailingCountRaw
          : typeof trailingCountRaw === 'string' && trailingCountRaw !== ''
            ? Number(trailingCountRaw)
            : -1;
      const abiFn = group.compilerRoute?.abiFunction
        ?? (group.externalContract?.inner?.artifact?.abi as { name?: string; sortedBatchInfo?: Array<{ linear?: boolean }> }[] | undefined)
          ?.find((candidate) => candidate.name === (group.logicalFunctionName ?? group.functionName));
      const linearInBlock = (abiFn?.sortedBatchInfo?.some((batch) => batch.linear === true) ?? false)
        && trailingCount === 0;
      if (inCommit && inCommit.length >= 128 && commit.length >= 128
        && inCommit.slice(64, 128) !== commit.slice(64, 128)
        && (!group.compilerRoute || plannedIndex >= 0)
        && !(linearInBlock && plannedIndex < 0)) {
        const handle = plannedIndex >= 0
          ? group.plannedEntryInsertHandles![plannedIndex]
          : stb.addExternalCallEntryInsert(
            group.categoryId, input.unlocker.generateLockingBytecode(), commit,
          );
        insertHandles.push({
          handle,
          newIdx: plannedIndex >= 0
            ? bOutputBase + group.plannedEntryInserts![plannedIndex].outputBlockSlot
            : bOutputBase + bInsertBase + insertCount,
          planned: plannedIndex >= 0,
        });
        insertCount++;
      }
    }
    // Second pass for INSERTs: with P' + placeholder NEW(s) now present, re-run B's VM so it reaches each NEW's
    // OP_OUTPUTTOKENCOMMITMENT and pushes the real NEW commitment; extract it and replace the placeholder.
    if (insertHandles.length > 0) {
      const pb2 = stb.build();
      const map2 = extractCommitmentMapFromTrace(evaluateProbeTrace(host.inner.provider, {
        inputIndex: bMasterIdx, sourceOutputs: generateLibauthSourceOutputs(pb2.inputs),
        transaction: pb2.buildLibauthTransaction(),
      }) as AuthenticationProgramStateCommon[]);
      for (const { handle, newIdx, planned } of insertHandles) {
        // A planned insert handle owns the predecessor rewrite P', already computed from the
        // authenticated sorted-list predecessor. The trace can also expose the fixed NEW node's
        // 64-byte link at this coordinate before it reaches the P' comparison; treating that
        // intermediate value as the handle commitment swaps the two nodes and blocks later emits.
        if (planned) continue;
        const newCommit = map2.get(newIdx);
        if (newCommit !== undefined) stb.setExternalCallEntryInsertCommitment(handle, newCommit);
        else stb.removeExternalCallEntryInsert(handle);
      }
    }
  }

}
