/**
 * phase-boundary extract: SC _createBuilder extract — construct StatefulTransactionBuilder and
 * register master-unlocker refreshers through builder-created.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  type AbiFunction,
  type FunctionBlockLayout,
  type StateLayout,
  encodeChunkableValueTail,
  parseArrayTypeString,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { batchPredecessorCommitment, isPendingBatchPredecessor } from '../message-bus/pending-batch-predecessor.js';
import { callRecordHashesResult } from './call-record.js';
import { isDisposableAlignmentPad } from './value-chunk-band-helpers.js';
import { materializeInternalFunctionArgument } from './kernel-journal-helpers.js';
import { groupIndexForExternalCallSlot } from './physical-external-call.js';
import type { ResolvedLogicalIdentity } from './logical-identity.js';
import { usesOrdinarySelfIdentity } from './ordinary-self-identity.js';
import {
  compilerRouteUsesPhysicalWrapper,
  selectedMessageBusResourceMetadata,
} from './message-bus-resource-routing.js';
import { resolveDynamicChunkInputBase } from './return-abi-plan.js';
import { resolveMaterializedDynamicWriteOutputBase } from './stb-reconcile-dynamic-chunk-output-witnesses.js';
import type { MessageBusRuntimeAbiFunction } from './sc-batch-raw.js';
import type { ExternalCallUtxoGroup, EntryNftInfo, TokenContainerInfo } from './external-call-utxo-group.js';
import {
  StatefulTransactionBuilder,
  type RuntimeLoopTransferOutput,
} from './StatefulTransactionBuilder.js';
import type { ValueChunkWriteStagingSession } from './value-chunk-persist.js';

export type ConstructCreateBuilderTransactionBuilderHost = {
  readonly categoryId: string;
  readonly inner: any;
};

export type ConstructCreateBuilderTransactionBuilderResult = {
  builder: StatefulTransactionBuilder;
  finalArgs: FunctionArgument[];
  firstRootDynamicChunk: UnlockableUtxo | undefined;
  refreshTopLevelReturnWitnesses: (materialized?: TransactionBuilder) => boolean;
};

/**
 * After transported productions: debug dumps, msg.sender materialize, construct
 * the STB options bag, and register assembly-pass unlocker refreshers.
 */
export function constructCreateBuilderTransactionBuilder(
  host: ConstructCreateBuilderTransactionBuilderHost,
  params: {
    finalArgs: FunctionArgument[];
    abiFunction: AbiFunction | undefined;
    entryAbiFunction: AbiFunction | undefined;
    physicalAbiFunction: AbiFunction | undefined;
    functionName: string;
    effectiveBlockLayout: FunctionBlockLayout | undefined;
    entryAccesses: any;
    entryNfts: EntryNftInfo[];
    batchTargetPlaceholders: Map<number, string>;
    resolvedMsgSenderCategory: Uint8Array | undefined;
    externalReadUtxos: UnlockableUtxo[];
    overrides: any;
    valueChunkWriteStagingSession: ValueChunkWriteStagingSession;
    unlockableMaster: UnlockableUtxo;
    unlockableDataNfts: UnlockableUtxo[];
    stateLayout: StateLayout;
    requiredNftIndices: readonly number[];
    entryNftLockingBytecodes: Map<string, Uint8Array>;
    dynamicChunkVars: any[];
    dynamicChunkInputs: UnlockableUtxo[];
    trailingDisposalInputs: UnlockableUtxo[];
    loopEntryVars: any[];
    runtimeLoopEventOutputs: any[];
    runtimeLoopTransferOutputs: RuntimeLoopTransferOutput[];
    runtimeLoopTrailingSegments: any[];
    kernelJournalSettlementOutputPlan: any;
    kernelJournalEagerOutputPlan: any;
    tokenContainers: TokenContainerInfo[];
    tokenContainerLockingBytecodes: Map<string, Uint8Array>;
    satoshiContainerUtxo: UnlockableUtxo | undefined;
    satoshiContainerLockingBytecode: Uint8Array | undefined;
    blockhashCoSpendUtxos: UnlockableUtxo[];
    blockInfoCoSpendUtxos?: UnlockableUtxo[];
    delegateBlockInfoOracle?: boolean;
    blockhashCoSpendSlotOrdinals: number[] | undefined;
    keccakComputeCoSpendUtxos: UnlockableUtxo[];
    keccakComputeCommitments: any;
    delegateComputeResources: boolean;
    deferredKeccakCompute: any;
    deferredEcrecoverCompute: any;
    ecrecoverComputeCoSpendUtxos: UnlockableUtxo[];
    ecrecoverComputeRecreates: any[];
    keccakLoopSideCars: UnlockableUtxo[];
    keccakLoopRecreates: any[];
    externalOutStateUtxoGroups: any[];
    externalCallUtxoGroups: ExternalCallUtxoGroup[];
    embeddedFunderUtxos: Map<any, UnlockableUtxo>;
    logicalIdentity: ResolvedLogicalIdentity | undefined;
    identityAnchors: UnlockableUtxo[];
    lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
    activeDelegateGroupIndex: number | undefined;
    lowLevelCallRawInputs: any[];
    compilerRouteDelegateLayout: FunctionBlockLayout | undefined;
    hasDelegatedDynamicReadChunks: boolean;
    delegateReturnEventOffset: number | undefined;
    delegateEventSlots: Array<{ kind: string; offset: number }>;
    lowLevelCallInputBase: number;
    batchPredCommitments: Map<string, any>;
    sortedLoopCommitments: Map<string, any>;
    eventDefs: any[];
    eventNftLockingBytecodes: Map<string, Uint8Array>;
    iterationEntryInputs: UnlockableUtxo[];
    insertLoopPredecessors: any[];
    dynamicReadChunkInputs: UnlockableUtxo[];
    topLevelDynamicChunkArgumentIndex: number;
    topLevelReturnWitnessGroups: number[];
    refreshPhysicalDelegateInputIndex:
    ((builder: StatefulTransactionBuilder, materialized?: TransactionBuilder) => any) | undefined;
    buildStateInputUnlocker: () => any;
    allGroupEcSlots: any[];
    derivationMasterUtxo: Utxo | undefined;
    masterUtxo: Utxo;
    timing?: (label: string) => void;
    [key: string]: any;
  },
): ConstructCreateBuilderTransactionBuilderResult {
  let {
    finalArgs, abiFunction, entryAbiFunction, physicalAbiFunction, functionName,
    effectiveBlockLayout, entryAccesses, entryNfts, batchTargetPlaceholders,
    resolvedMsgSenderCategory, externalReadUtxos, overrides, valueChunkWriteStagingSession,
    unlockableMaster, unlockableDataNfts, stateLayout, requiredNftIndices, entryNftLockingBytecodes,
    dynamicChunkVars, dynamicChunkInputs, trailingDisposalInputs, loopEntryVars,
    runtimeLoopEventOutputs, runtimeLoopTransferOutputs, runtimeLoopTrailingSegments,
    kernelJournalSettlementOutputPlan, kernelJournalEagerOutputPlan, tokenContainers,
    tokenContainerLockingBytecodes, satoshiContainerUtxo, satoshiContainerLockingBytecode,
    blockhashCoSpendUtxos, blockInfoCoSpendUtxos, delegateBlockInfoOracle, blockhashCoSpendSlotOrdinals,
    keccakComputeCoSpendUtxos,
    keccakComputeCommitments, delegateComputeResources, deferredKeccakCompute,
    deferredEcrecoverCompute, ecrecoverComputeCoSpendUtxos, ecrecoverComputeRecreates,
    keccakLoopSideCars, keccakLoopRecreates, externalOutStateUtxoGroups, externalCallUtxoGroups,
    embeddedFunderUtxos, logicalIdentity, identityAnchors, lowLevelCallUtxoGroups,
    activeDelegateGroupIndex, lowLevelCallRawInputs, compilerRouteDelegateLayout,
    hasDelegatedDynamicReadChunks, delegateReturnEventOffset, delegateEventSlots,
    lowLevelCallInputBase, batchPredCommitments, sortedLoopCommitments, eventDefs,
    eventNftLockingBytecodes, iterationEntryInputs, insertLoopPredecessors,
    dynamicReadChunkInputs, topLevelDynamicChunkArgumentIndex, topLevelReturnWitnessGroups,
    refreshPhysicalDelegateInputIndex, buildStateInputUnlocker, allGroupEcSlots,
    derivationMasterUtxo, masterUtxo, timing,
  } = params;

  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ENTRY_PLACEMENT === '1') {
    const layoutEntries = (effectiveBlockLayout?.slots ?? [])
      .filter((slot: any) => slot.kind === 'entry')
      .map((slot: any) => `${slot.offset}:${slot.slotIndex}`);
    console.error('entry-placement', JSON.stringify({
      functionName, abiFunction: abiFunction?.name, entryFunction: entryAbiFunction?.name,
      blockBase: overrides?.blockBase,
      layoutEntries,
      accesses: [...(entryAccesses ?? new Map()).entries()].map(([slotIndex, access]: any) =>
        `${slotIndex}:${access.collection}`),
      nfts: entryNfts.map((nft) => `${nft.slotIndex}:${nft.collection}:${nft.exists ? 'present' : 'absent'}`),
      targets: [...batchTargetPlaceholders.entries()].map(([slotIndex, commitment]) =>
        `${slotIndex}:${commitment.slice(0, 16)}`),
    }));
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_MSG_SENDER_KEY === '1') {
    // Zip the FINAL args with their ABI names: indexing `finalArgs` by the ABI position is unsafe for
    // probe/route frames (hidden args are appended and reordered by name), and that mis-index is what made the
    // earlier reading of this witness wrong. Only a name-keyed dump can be trusted.
    const names = (abiFunction?.inputs ?? []).map((input) => input.name);
    console.error('msg-sender-category-final', JSON.stringify({
      functionName, abiFunction: abiFunction?.name,
      argCount: finalArgs.length, abiCount: names.length,
      args: finalArgs.map((argument, index) => [
        names[index] ?? `#${index}`,
        argument instanceof Uint8Array
          ? `b${argument.length}:${binToHex(argument).slice(0, 32)}` : String(argument),
      ]).filter(([name]) => String(name).startsWith('__internal__')),
      build: {
        returnProbeOnly: overrides?.returnProbeOnly === true,
        compilerRoute: overrides?.compilerRouteSelector !== undefined,
        calls: overrides?.calls?.length ?? 0,
      },
    }));
  }
  if (resolvedMsgSenderCategory !== undefined && abiFunction !== undefined
    && abiFunction.inputs.some((input) => input.name === '__internal__msgSenderCategory')) {
    // Position it by ABI name: appends alone are only correct when every earlier hidden block ran, which a
    // probe (returnProbeOnly) and other partial builds do not guarantee. Write it into the SAME array: the state
    // input unlocker was built before this step and encodes this array, and the master-unlocker refresher below
    // writes its witnesses into it. A fresh copy left the unlocker encoding the arguments as they stood here (a
    // dynamic-chunk base of 0 where the refresher had resolved -1, so a `poolInfo.push` was checked at output 0).
    finalArgs.splice(0, finalArgs.length, ...materializeInternalFunctionArgument(
      finalArgs, abiFunction.inputs, '__internal__msgSenderCategory', resolvedMsgSenderCategory,
    ));
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_MSG_SENDER_KEY === '1' && overrides?.returnProbeOnly === true) {
    // The options the built frame actually receives: a read band of 0 here means the caller carrier never reached
    // this construction, whatever the merge above did.
    console.error('builder-construction', JSON.stringify({
      functionName, externalReadUtxos: externalReadUtxos.length,
    }));
  }
  const builder = new StatefulTransactionBuilder({
    provider: host.inner.provider,
    // A relaxed mock may intentionally execute very large scripts/transactions. At the normal 1 sat/byte
    // relay floor, a valid call can therefore exceed the production-oriented 50k absolute cap. Bound the mock
    // default by its configured maximum transaction size; the per-byte safety cap remains enforced below.
    maximumFeeSatoshis: host.inner.provider.policy?.enforceDust === false
      ? BigInt(host.inner.provider.consensusLimits?.maximumTransactionBytes ?? 10_000_000)
      : 50000n,
    checkMinRelayFee: true,
    valueChunkWriteStagingSession,
    masterUtxo: unlockableMaster,
    dataNftUtxos: unlockableDataNfts,
    stateLayout,
    categoryId: host.categoryId,
    requiredNftIndices: [...requiredNftIndices],
    entryNfts,
    entryAccesses,
    entryNftLockingBytecodes,
    ...(dynamicChunkVars.length > 0 && { dynamicChunkVars }),
    ...(dynamicChunkInputs.length > 0 && { dynamicChunkInputs }),
    ...(trailingDisposalInputs.length > 0 && { trailingDisposalInputs }),
    ...(loopEntryVars.length > 0 && { loopEntryVars }),
    ...(runtimeLoopEventOutputs.length > 0 && { runtimeLoopEventOutputs }),
    ...(runtimeLoopTransferOutputs.length > 0 && { runtimeLoopTransferOutputs }),
    ...(runtimeLoopTrailingSegments.length > 0 && { runtimeLoopTrailingSegments }),
    ...(kernelJournalSettlementOutputPlan && { kernelJournalSettlementOutputPlan }),
    ...(kernelJournalEagerOutputPlan && { kernelJournalEagerOutputPlan }),
    tokenContainers,
    tokenContainerLockingBytecodes,
    ...(satoshiContainerUtxo && { satoshiContainerUtxo, satoshiContainerLockingBytecode }),
    ...(externalReadUtxos.length > 0 && { readOnlyDataNftUtxos: externalReadUtxos }),
    ...(blockhashCoSpendUtxos.length > 0 && { blockhashCoSpendUtxos }),
    ...(blockInfoCoSpendUtxos && blockInfoCoSpendUtxos.length > 0 && { blockInfoCoSpendUtxos }),
    ...(delegateBlockInfoOracle && { delegateBlockInfoOracle: true }),
    ...(blockhashCoSpendSlotOrdinals && { blockhashCoSpendSlotOrdinals }),
    ...(keccakComputeCoSpendUtxos.length > 0 && { keccakComputeCoSpendUtxos, keccakComputeCommitments }),
    ...(delegateComputeResources && { delegateComputeResources: true }),
    ...(deferredKeccakCompute && { deferredKeccakCompute }),
    ...(deferredEcrecoverCompute && { deferredEcrecoverCompute }),
    ...(ecrecoverComputeCoSpendUtxos.length > 0 && { ecrecoverComputeCoSpendUtxos, ecrecoverComputeRecreates }),
    ...(keccakLoopSideCars.length > 0 && { keccakLoopSideCars, keccakLoopRecreates }),
    ...(externalOutStateUtxoGroups.length > 0 && { externalOutStateUtxoGroups }),
    ...(externalCallUtxoGroups.length > 0 && { externalCallUtxoGroups }),
    ...(embeddedFunderUtxos.size > 0 && {
      embeddedFunderUtxos: [...embeddedFunderUtxos.values()],
    }),
    ...(logicalIdentity && {
      logicalIdentityUtxo: { ...logicalIdentity.anchor, unlocker: logicalIdentity.unlocker },
    }),
    ...(identityAnchors.length > 0 && { externalIdentityAnchorUtxos: identityAnchors }),
    ...(lowLevelCallUtxoGroups.length > 0 && { lowLevelCallUtxoGroups }),
    ...(activeDelegateGroupIndex !== undefined && { activeDelegateGroupIndex }),
    ...(lowLevelCallRawInputs.length > 0 && { lowLevelCallRawInputs }),
    ...(lowLevelCallUtxoGroups.some((group) => group.callMode === 'delegatecall')
      && !compilerRouteDelegateLayout
      && { delegateEntriesAfterLowLevel: true }),
    ...(lowLevelCallUtxoGroups.some((group) => group.callMode === 'delegatecall')
      && dynamicChunkVars.some((variable) => variable.delegate === true)
      && !compilerRouteDelegateLayout
      && { delegateDynamicChunksAtSuffix: true }),
    // A compiler-owned delegate route already reserves its dynamic resources in the balanced trailing frame.
    // Legacy delegates have no such frame, so only they use the transaction-wide reverse suffix.
    ...(hasDelegatedDynamicReadChunks && !compilerRouteDelegateLayout
      && { delegateDynamicChunksAtSuffix: true }),
    // X56. Only when the co-spent implementation BOTH emits and returns: its event resolves to the index the
    // forwarder had reserved for the return channel, so the return channel has to follow the events.
    ...(delegateReturnEventOffset !== undefined && delegateEventSlots.some((s: any) => s.kind === 'event')
      && { delegateReturnEventAfterEvents: true }),
    ...(lowLevelCallUtxoGroups.some((group) => group.callMode === 'delegatecall')
      && { lowLevelCallInputBase }),
    ...(compilerRouteDelegateLayout && { compilerRouteDelegateBlock: true }),
    ...(overrides?.omitLocalFeeTail && { preserveBlockLayoutWidth: true }),
    ...(delegateEventSlots.some((slot: any) => slot.kind === 'entry') && { preserveBlockLayoutWidth: true }),
    ...((batchPredCommitments.size > 0 || sortedLoopCommitments.size > 0
      || runtimeLoopEventOutputs.length > 0 || runtimeLoopTransferOutputs.length > 0)
      // A compiler-owned delegate block preserves its dynamic chunks at the published trailing base;
      // sorted entry creations in that same block follow the chunks.
      && !(compilerRouteDelegateLayout && dynamicChunkVars.length > 0)
      && { loopEntriesBeforeDynamicChunks: true }),
    ...(eventDefs.length > 0 && { eventDefinitions: eventDefs }),
    ...(eventNftLockingBytecodes.size > 0 && { eventNftLockingBytecodes }),
    ...(iterationEntryInputs.length > 0 && { iterationEntryInputs }),
    ...(insertLoopPredecessors.length > 0 && { insertLoopPredecessorInputs: insertLoopPredecessors }),
    ...(effectiveBlockLayout && { blockLayout: effectiveBlockLayout }),
    ...(overrides?.omitLocalFeeTail === true && {
      composedParticipant: true,
      ...(overrides?.blockBase !== undefined && { composedBlockBase: overrides.blockBase }),
    }),
    ...((entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)?.messageBusConvention && {
      messageBusConvention:
        (entryAbiFunction as MessageBusRuntimeAbiFunction).messageBusConvention,
    }),
  });
  const firstRootDynamicChunk = dynamicReadChunkInputs[0] ?? dynamicChunkInputs[0];
  const selfIdentityArgumentIndex = abiFunction?.inputs.findIndex((input) =>
    input.name === '__internal__graphSelfIdentityInput') ?? -1;
  const refreshTopLevelSelfIdentityInput = selfIdentityArgumentIndex < 0 || !usesOrdinarySelfIdentity(abiFunction)
    || compilerRouteUsesPhysicalWrapper(overrides?.compilerRouteSelector, physicalAbiFunction, abiFunction)
    ? undefined
    : (materialized?: TransactionBuilder): void => {
      if (logicalIdentity === undefined) {
        finalArgs[selfIdentityArgumentIndex] = -1n;
        return;
      }
      const target = logicalIdentity.anchor;
      const localIndex = materialized
        ? materialized.inputs.findIndex((input) => input.txid.toLowerCase() === target.txid.toLowerCase()
          && input.vout === target.vout)
        : builder.findInputIndexByOutpoint(target);
      if (localIndex < 0) throw new Error('Selected own CREATE identity anchor is absent from the finalized transaction');
      finalArgs[selfIdentityArgumentIndex] = BigInt(localIndex + (overrides?.blockBase ?? 0));
    };
  const dynamicOutputArgumentIndex = abiFunction?.inputs.findIndex((input) =>
    input.name === '__internal__dynamicChunkOutputBase') ?? -1;
  const refreshTopLevelDynamicChunkOutputBase = dynamicOutputArgumentIndex < 0
    || overrides?.omitLocalFeeTail === true
    || compilerRouteUsesPhysicalWrapper(overrides?.compilerRouteSelector, physicalAbiFunction, abiFunction)
    ? undefined
    : (materialized?: TransactionBuilder): void => {
      if (materialized === undefined || abiFunction === undefined) return;
      // A returned event can precede a later void callee. The complete materialized run, rather than the
      // return index or the old input coordinate, identifies the root's rewritten chunks.
      finalArgs[dynamicOutputArgumentIndex] = BigInt(resolveMaterializedDynamicWriteOutputBase({
        route: abiFunction, stateLayout, contract: host.inner, categoryId: host.categoryId,
        outputs: materialized.outputs, start: 0, end: materialized.outputs.length,
        allowProvisionalChunks: true,
        selectedDynamicWrites: new Set(abiFunction.dynamicWrites ?? []),
      }));
    };
  const selectedRows = (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)?.messageBusRowArguments;
  const dynamicWriteActive = selectedRows === undefined
    ? dynamicChunkVars.length > 0 || (abiFunction?.dynamicWrites?.length ?? 0) > 0
    : selectedMessageBusResourceMetadata(selectedRows).dynamicWrites.length > 0;
  const refreshTopLevelDynamicChunkInputBase = topLevelDynamicChunkArgumentIndex < 0
    || compilerRouteUsesPhysicalWrapper(
      overrides?.compilerRouteSelector, physicalAbiFunction, abiFunction,
    )
    ? undefined
    : (materialized?: TransactionBuilder): void => {
      const target = firstRootDynamicChunk;
      const localIndex = target === undefined ? -1 : materialized
        ? materialized.inputs.findIndex((input) => input.txid.toLowerCase() === target.txid.toLowerCase()
          && input.vout === target.vout)
        : builder.findInputIndexByOutpoint(target);
      if (target !== undefined && localIndex < 0) {
        throw new Error('Selected root dynamic-storage chunk input is absent from the finalized transaction');
      }
      // Published witnesses always use aggregate coordinates, including when the absolute index would happen
      // to fit in this participant's local frame. buildParticipantProbeProgram performs the inverse conversion
      // only in generated probe bytecode, without changing these shared final-transaction arguments.
      finalArgs[topLevelDynamicChunkArgumentIndex] = resolveDynamicChunkInputBase(
        localIndex, overrides?.blockBase ?? 0, dynamicWriteActive,
      );
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_DYNAMIC_CHUNK_ORDER === '1') {
        console.error('dynamic-chunk-root-base', JSON.stringify({
          functionName,
          blockBase: overrides?.blockBase ?? 0,
          localIndex,
          frameLength: materialized?.inputs.length,
          target: target === undefined ? undefined : `${target.txid.slice(0, 12)}:${target.vout}`,
          value: String(finalArgs[topLevelDynamicChunkArgumentIndex]),
          readChunks: dynamicReadChunkInputs.length,
          writeChunks: dynamicChunkInputs.length,
          // Identify the materialization boundary without changing its published coordinate convention.
          stack: new Error('dynamic-chunk-root-base').stack?.split('\n').slice(2, 5)
            .map((line) => line.trim().replace(/.*\/packages\//, 'packages/')),
        }));
      }
    };
  const refreshTopLevelExternalCallInputIndices = (): boolean => {
    if (!abiFunction || externalCallUtxoGroups.length === 0) return false;
    const groupByCallsite = new Map<number, number>();
    for (const [groupIndex, group] of externalCallUtxoGroups.entries()) {
      if (group.sourceCallsiteId !== undefined && !groupByCallsite.has(group.sourceCallsiteId)) {
        groupByCallsite.set(group.sourceCallsiteId, groupIndex);
      }
    }
    let changed = false;
    for (const [position, input] of abiFunction.inputs.entries()) {
      if (position >= finalArgs.length) break;
      const masterWitness = /^__internal__extcallMasterIdx(\d*)$/.exec(input.name);
      if (masterWitness === null) continue;
      const slot = masterWitness[1] === '' ? 0 : Number(masterWitness[1]);
      const groupIndex = groupIndexForExternalCallSlot({
        slot, externalCalls: abiFunction.externalCalls, groupByCallsite,
        compactGroups: externalCallUtxoGroups.map((_, index) => index),
      });
      const group = groupIndex === undefined ? undefined : externalCallUtxoGroups[groupIndex];
      if (group === undefined) continue;
      const index = builder.findMaterializedMasterInput(group.sharedGroupIndex ?? groupIndex!);
      if (index < 0 || finalArgs[position] === BigInt(index)) continue;
      finalArgs[position] = BigInt(index);
      changed = true;
    }
    const basePosition = abiFunction.inputs.findIndex((input) =>
      input.name === '__internal__externalCallInputBase');
    if (basePosition >= 0 && basePosition < finalArgs.length) {
      const firstGroup = externalCallUtxoGroups[0];
      const index = builder.findMaterializedMasterInput(firstGroup.sharedGroupIndex ?? 0);
      if (index >= 0 && finalArgs[basePosition] !== BigInt(index)) {
        finalArgs[basePosition] = BigInt(index);
        changed = true;
      }
    }
    return changed;
  };
  // The compiled covenant reads a callee's return event at `__internal__externalReturnOutputIdxN`, so that witness
  // and the assembled transaction must name the same output. The planned coordinate is written before the builder
  // places its own outputs, and a callee's block (with the event's slot) can still move afterwards - a shared
  // participant publishes the event in the writer's in-block slot, not its own. Re-read every returning group's
  // physical coordinate from the builder on each assembly pass instead of freezing the plan.
  const topLevelReturnWitnessNames = (abiFunction?.inputs ?? [])
    .map((input) => input.name)
    .filter((name) => /^__internal__externalReturnOutputIdx\d*$/.test(name))
    .sort((left, right) => Number(/(\d*)$/.exec(left)?.[1] ?? 0)
      - Number(/(\d*)$/.exec(right)?.[1] ?? 0));
  const refreshTopLevelReturnWitnesses = (materialized?: TransactionBuilder): boolean => {
    if (topLevelReturnWitnessNames.length === 0 || topLevelReturnWitnessGroups.length === 0) return false;
    // The refresher runs from the builder's own assembly pass, so the recorded coordinates are current.
    void materialized;
    let changed = false;
    for (const [ordinal, groupIdx] of topLevelReturnWitnessGroups.entries()) {
      if (groupIdx < 0) continue;
      const name = topLevelReturnWitnessNames[ordinal];
      if (name === undefined) break;
      const position = abiFunction!.inputs.findIndex((input) => input.name === name);
      if (position < 0 || position >= finalArgs.length) continue;
      const preimageName = name.replace('externalReturnOutputIdx', 'externalReturnPreimage');
      const preimagePosition = abiFunction!.inputs.findIndex((input) => input.name === preimageName);
      const preimage = builder.getExternalCallReturnPreimage(groupIdx);
      if (preimagePosition >= 0 && preimage && callRecordHashesResult(preimage)
        && (!(finalArgs[preimagePosition] instanceof Uint8Array)
          || binToHex(finalArgs[preimagePosition] as Uint8Array) !== binToHex(preimage))) {
        finalArgs[preimagePosition] = preimage.slice();
        changed = true;
      }
      const built = builder.getBuiltExternalCallReturnEventOutputIndex(groupIdx);
      const authoritative = built >= 0 ? built : builder.getExternalCallReturnEventOutputIndex(groupIdx);
      if (authoritative < 0) continue;
      if (finalArgs[position] === BigInt(authoritative)) continue;
      finalArgs[position] = BigInt(authoritative);
      changed = true;
    }
    return changed;
  };
  // The batch covenant reads `output[__internal__vmapBatchPredOut_<slot>].lockingBytecode` and requires it to
  // equal the locking bytecode of the input its proof coordinate names. The plan computes the output coordinate as
  // `master + trailingBase` - before the entry outputs moved into their declared block slots - so it can name an
  // unrelated output. Only a coordinate that PROVABLY fails that covenant equality is rewritten: the planned index
  // is kept whenever its output already carries the authenticated lock, which leaves every passing lane untouched.
  const refreshTopLevelPredOutWitnesses = (materialized?: TransactionBuilder): boolean => {
    if (!abiFunction || materialized === undefined) return false;
    const masterOutpoint = derivationMasterUtxo ?? masterUtxo;
    const masterIndex = materialized.inputs.findIndex((input) => (
      input.txid.toLowerCase() === masterOutpoint.txid.toLowerCase() && input.vout === masterOutpoint.vout
    ));
    if (masterIndex < 0) return false;
    const lockedBytecodeAt = (index: number): Uint8Array | undefined => {
      const input = materialized.inputs[index] as { unlocker?: { generateLockingBytecode?: () => Uint8Array } };
      return input?.unlocker?.generateLockingBytecode?.();
    };
    const outputLock = (index: number): Uint8Array | undefined => {
      const output = materialized.outputs[index] as { to?: Uint8Array | string };
      return output?.to instanceof Uint8Array ? output.to : undefined;
    };
    const sameLock = (left: Uint8Array | undefined, right: Uint8Array | undefined): boolean =>
      left !== undefined && right !== undefined && left.length === right.length
      && left.every((byte, offset) => byte === right[offset]);
    const linearBatchSlots = new Set((abiFunction.sortedBatchInfo ?? [])
      .filter((batch) => batch.linear === true).flatMap((batch) => batch.slotIndices));
    let changed = false;
    for (const input of abiFunction.inputs) {
      const match = /^__internal__vmapBatchPredOut_(\d+)$/.exec(input.name);
      if (match === null) continue;
      const slot = match[1];
      const position = abiFunction.inputs.findIndex((candidate) => candidate.name === input.name);
      const proofPosition = abiFunction.inputs.findIndex((candidate) =>
        candidate.name === `__internal__vmapBatchProof_${slot}`);
      if (position < 0 || position >= finalArgs.length || proofPosition < 0) continue;
      const current = finalArgs[position];
      const proofOffset = finalArgs[proofPosition];
      // An active INSERT can retain the provisional -1 until its exact predecessor output is materialized.
      // Inactive rows (-2), and ordinary update/read lanes with -1, remain topology sentinels.
      if (typeof current !== 'bigint' || current === -2n) continue;
      // A linear batch's covenant requires -1 of an update and of an insert whose predecessor an earlier row
      // republishes; it never stands for a coordinate still to be found.
      if (current === -1n && linearBatchSlots.has(Number(slot))) continue;
      if (typeof proofOffset !== 'bigint' || proofOffset < 0n) continue;
      const required = lockedBytecodeAt(masterIndex + Number(proofOffset));
      if (required === undefined) continue;
      // Lock equality alone cannot accept the planned coordinate: an insert's P' and its NEW node are published
      // at the SAME collection address (measured: both at the `escrows` entry covenant), and the covenant
      // verifies the P' by CONTENT - `pred.slot || target || pred.value`. Accept the plan only when the output
      // there carries exactly that commitment.
      const commitmentOf = (index: number): string | undefined => {
        const token = (materialized.outputs[index] as {
          token?: { nft?: { commitment?: Uint8Array | string } };
        } | undefined)?.token;
        const commitment = token?.nft?.commitment;
        return commitment === undefined ? undefined
          : typeof commitment === 'string' ? commitment : binToHex(commitment);
      };
      const slotPosition = abiFunction.inputs.findIndex((candidate) =>
        candidate.name === `__internal__vmapBatchSlot_${slot}`);
      const targetSlot = slotPosition < 0 || slotPosition >= finalArgs.length
        ? undefined : finalArgs[slotPosition];
      const predecessorCommitment = (() => {
        const token = (materialized.inputs[masterIndex + Number(proofOffset)] as {
          token?: { nft?: { commitment?: Uint8Array | string } };
        } | undefined)?.token;
        const commitment = token?.nft?.commitment;
        return commitment === undefined ? undefined
          : typeof commitment === 'string' ? commitment : binToHex(commitment);
      })();
      const expectedPredOut = predecessorCommitment === undefined ? undefined
        : batchPredecessorCommitment(abiFunction, finalArgs, Number(slot), predecessorCommitment)
        ?? (targetSlot instanceof Uint8Array && targetSlot.length === 32
        && predecessorCommitment !== undefined && predecessorCommitment.length >= 128
          ? `${predecessorCommitment.slice(0, 64)}${binToHex(targetSlot)}${predecessorCommitment.slice(128)}`
          : undefined);
      // A proof shared with another active target is recreated by that target's fixed output, not a separate P'.
      // Preserve its sentinel even if the current target is absent; otherwise the structural fallback below
      // invents an extra predecessor and the compiler's exact collection cardinality must reject the transaction.
      if (current < 0n && !isPendingBatchPredecessor(
        abiFunction, finalArgs, Number(slot), predecessorCommitment ?? '',
      )) continue;
      // DS-6: a lent delete of the node's own key (-3) naming this proof may have run on it: the planned relink then
      // carries the value type's default tail in place of the node's own. Chunkable kinds (bytes/string) relink at
      // `len4(0)`; scalar kinds keep no tail.
      const argOf = (name: string): unknown => finalArgs[abiFunction.inputs.findIndex((c) => c.name === name)];
      const deletedBatch = (abiFunction.sortedBatchInfo ?? []).find((batch) =>
        batch.slotIndices.includes(Number(slot)));
      const deletedCollection = deletedBatch === undefined ? undefined
        : stateLayout.collections?.find((collection) => collection.name === deletedBatch.collection);
      // Mirrors `defaultSortedEntryValueTail`: unbounded bytes/string nullify to `len4(0)`, while an unbounded
      // ARRAY nullifies to the pushdata-encoded empty array (`OP_0`, one byte) framed as `len4(1) || 0x00`. Using
      // the bytes/string tail for an array makes the planned predecessor look different from the materialized one,
      // so the P'-search below misses it and mints a duplicate predecessor output.
      const deletedArray = deletedCollection === undefined
        ? undefined : parseArrayTypeString(deletedCollection.valueType);
      const deletedDefaultTail = deletedCollection === undefined || deletedCollection.chunkableValue !== true
        ? ''
        : deletedArray !== undefined && deletedArray.bound === undefined
          ? binToHex(encodeChunkableValueTail(new Uint8Array([0x00])))
          : '00000000';
      const deletedPredOut = expectedPredOut !== undefined && (abiFunction.sortedBatchInfo ?? []).some((batch) => (
        batch.slotIndices.includes(Number(slot)) && batch.slotIndices.some((other) => {
          const deleted = argOf(`__internal__vmapBatchSlot_${other}`);
          return argOf(`__internal__vmapBatchPredOut_${other}`) === -3n
            && argOf(`__internal__vmapBatchProof_${other}`) === proofOffset && deleted instanceof Uint8Array
            && binToHex(deleted) === expectedPredOut.slice(0, 64).toLowerCase();
        }))) ? `${expectedPredOut.slice(0, 128)}${deletedDefaultTail}`.toLowerCase() : undefined;
      if (current >= 0n && sameLock(outputLock(Number(current)), required)
        && (expectedPredOut === undefined
          || commitmentOf(Number(current))?.toLowerCase() === expectedPredOut.toLowerCase()
          || (deletedPredOut !== undefined && commitmentOf(Number(current))?.toLowerCase() === deletedPredOut))) continue;
      // The P' is materialized elsewhere in this frame: find the output that carries it, requiring both the
      // authenticated lock and the exact content so a same-address NEW node can never be substituted.
      if (expectedPredOut !== undefined) {
        const found = materialized.outputs.findIndex((_output, index) =>
          sameLock(outputLock(index), required)
          && (commitmentOf(index)?.toLowerCase() === expectedPredOut.toLowerCase()
            || (deletedPredOut !== undefined && commitmentOf(index)?.toLowerCase() === deletedPredOut)));
        if (found >= 0) {
          finalArgs[position] = BigInt(found);
          changed = true;
          if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
            ?.SOLIDC_DEBUG_RETURN === '1') {
            console.error('predout-witness-rebound', {
              functionName, name: input.name, planned: current.toString(), actual: String(found),
              content: 'pred-new-commitment',
            });
          }
          continue;
        }
      }
      // Prefer the structural answer - the entry output this slot publishes - and accept it only when its content
      // proves it is the collection resource the covenant authenticates. Never fall back to an arbitrary output
      // with a matching lock: the same coordinate is also read for the predecessor's category and commitment.
      const ordinal = builder.getEntryOutputSlotOrder().indexOf(Number(slot));
      const entryOutputBase = builder.getEntryOutputBase();
      const structural = entryOutputBase >= 0 && ordinal >= 0 ? entryOutputBase + ordinal : -1;
      if (structural < 0 || !sameLock(outputLock(structural), required)
        || expectedPredOut === undefined
        || commitmentOf(structural)?.toLowerCase() !== expectedPredOut.toLowerCase()) {
        // A later continuation band can occupy the provisional P' coordinate. Restore the predecessor in a
        // token-free alignment slot after the participant block, using the authenticated proof input's lock and
        // exact slot/next/value commitment. The VM still proves that output against the input and target hash.
        if (expectedPredOut === undefined || !/^[0-9a-f]{128,256}$/i.test(expectedPredOut)) continue;
        const proofInput = materialized.inputs[masterIndex + Number(proofOffset)];
        const category = proofInput?.token?.category;
        if (proofInput?.token?.nft?.capability !== 'mutable'
          || category === undefined || category !== materialized.inputs[masterIndex]?.token?.category) continue;
        const free = materialized.outputs.findIndex((output, index) => (
          index >= masterIndex + (effectiveBlockLayout?.blockSize ?? 1)
          && isDisposableAlignmentPad(output)
          && output.to instanceof Uint8Array && output.to.length === 1 && output.to[0] === 0x51
          && materialized.inputs[index]?.token === undefined
        ));
        // If every balanced pad is already a co-spent token's output, add a distinct mint output only when the
        // transaction has no reverse-indexed OP_RETURN suffix to shift. The final conservation pass funds it.
        if (free < 0 && materialized.outputs.some((output) => output.to instanceof Uint8Array
          && output.to.length === 1 && output.to[0] === 0x6a)) continue;
        const destination = free >= 0 ? free : materialized.outputs.length;
        materialized.outputs[destination] = {
          to: required,
          amount: free >= 0 ? materialized.outputs[free]!.amount : 1200n,
          token: { category, amount: 0n, nft: { capability: 'mutable', commitment: expectedPredOut } },
        };
        finalArgs[position] = BigInt(destination);
        changed = true;
        continue;
      }
      const replacement = structural;
      finalArgs[position] = BigInt(replacement);
      changed = true;
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_RETURN === '1') {
        console.error('predout-witness-rebound', {
          functionName,
          name: input.name,
          planned: current.toString(),
          actual: String(replacement),
        });
      }
    }
    return changed;
  };
  if (refreshPhysicalDelegateInputIndex || refreshTopLevelSelfIdentityInput
    || refreshTopLevelDynamicChunkInputBase || refreshTopLevelDynamicChunkOutputBase
    || topLevelReturnWitnessGroups.length > 0 || abiFunction !== undefined) {
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_FORWARD_ARGS === '1') {
      console.error('physical-input-refresher-registered', {
        functionName,
        delegate: refreshPhysicalDelegateInputIndex !== undefined,
        dynamicChunk: refreshTopLevelDynamicChunkInputBase !== undefined,
        topLevelReturns: topLevelReturnWitnessGroups.length,
      });
    }
    builder._setMasterUnlockerRefresher((materialized) => {
      if (refreshPhysicalDelegateInputIndex) refreshPhysicalDelegateInputIndex(builder, materialized);
      refreshTopLevelSelfIdentityInput?.(materialized);
      refreshTopLevelDynamicChunkInputBase?.(materialized);
      refreshTopLevelDynamicChunkOutputBase?.(materialized);
      refreshTopLevelExternalCallInputIndices();
      refreshTopLevelReturnWitnesses(materialized);
      refreshTopLevelPredOutWitnesses(materialized);
      return buildStateInputUnlocker();
    });
  }
  builder.seedPrecomputedReturnEvents(allGroupEcSlots);
  timing?.('builder-created');

  return {
    builder,
    finalArgs,
    firstRootDynamicChunk,
    refreshTopLevelReturnWitnesses,
  };
}
