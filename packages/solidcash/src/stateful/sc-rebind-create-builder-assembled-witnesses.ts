/**
 * phase-boundary extract: SC _createBuilder extract — post-fills physical return rewrite plus
 * top-level identity/master/input-base/vmap-proof witness rebinds.
 * Mutates bag.finalArgs / bag.stateInputUnlocker; escapes
 * refreshTopLevelIdentityAnchorWitnesses for the derivation loop.
 */

import { binToHex } from '@bitauth/libauth';
import type { AbiFunction } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { groupIndexForExternalCallSlot } from './physical-external-call.js';
import { assignPhysicalReturnIndices } from './physical-return-layout.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import {
  groupOwnsInBlockReturnEvent,
  viewTailOccupancyCap,
} from './value-chunk-geometry.js';
import {
  inheritWriterBatchPlan,
  isWriterBatchWitnessName,
  materializedPredOutBase,
  writerBatchPlanMatchesPhysicalCarrier,
} from './writer-event-delegate-layout.js';

export type AssembledWitnessBag = {
  finalArgs: any[];
  stateInputUnlocker: any;
};

export type RebindCreateBuilderAssembledWitnessesResult = {
  refreshTopLevelIdentityAnchorWitnesses: () => boolean;
};

/**
 * Rewrite nested return indices from physical minting coordinates, then rebind
 * top-level return/identity/master/base/vmap witnesses against the assembled tx.
 */
export function rebindCreateBuilderAssembledWitnesses(
  bag: AssembledWitnessBag,
  params: {
    builder: StatefulTransactionBuilder;
    abiFunction: AbiFunction | undefined;
    externalCallUtxoGroups: ExternalCallUtxoGroup[];
    lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
    topLevelAnchorFillPositions: readonly any[];
    topLevelVmapProofUtxos: Map<number, any> | ReadonlyMap<number, any>;
    masterUtxo: any;
    derivationMasterUtxo: any;
    buildStateInputUnlocker: () => any;
    refreshTopLevelReturnWitnesses: () => boolean;
    [key: string]: any;
  },
): RebindCreateBuilderAssembledWitnessesResult {
  const {
    builder,
    abiFunction,
    externalCallUtxoGroups,
    lowLevelCallUtxoGroups,
    topLevelAnchorFillPositions,
    topLevelVmapProofUtxos,
    masterUtxo,
    derivationMasterUtxo,
    buildStateInputUnlocker,
    refreshTopLevelReturnWitnesses,
  } = params;
  const finalArgs = bag.finalArgs;

  // Masters are rebound from findMintingInputIndex after assembly, but return
  // witnesses are still the pre-rotation tail ranks (a repeated writer encodes
  // a nested participant after another participant's block). Rewrite every
  // returning group from the physical minting coordinates and refresh both
  // nested callees and the delegate that reads them.
  {
    for (const group of externalCallUtxoGroups) {
      if (group.plannedReturnOutputIndex === undefined && group.returnOutputIndex !== undefined) {
        group.plannedReturnOutputIndex = group.returnOutputIndex;
      }
    }
    const plannedViewTails = externalCallUtxoGroups
      .map((group, index) => (
        group.returnOutputIndex !== undefined
        && !groupOwnsInBlockReturnEvent(externalCallUtxoGroups, index)
          ? (group.plannedReturnOutputIndex ?? group.returnOutputIndex) : -1
      ))
      .filter((index) => index >= 0);
    const plannedJobEventsOccupancy = viewTailOccupancyCap(
      plannedViewTails,
      builder.getChunkableValueWriteBand(),
    );
    const assignedReturns = assignPhysicalReturnIndices(
      externalCallUtxoGroups,
      (categoryId) => builder.findMintingInputIndex(categoryId),
      plannedJobEventsOccupancy,
      builder.viewTailPackOptions(),
    );
    const returnCarriers = [...externalCallUtxoGroups, ...lowLevelCallUtxoGroups];
    let returnWitnessesChanged = false;
    for (const [groupIdx, returnIndex] of assignedReturns) {
      const group = externalCallUtxoGroups[groupIdx];
      if (!group) continue;
      if (group.returnOutputIndex !== returnIndex) {
        group.returnOutputIndex = returnIndex;
        returnWitnessesChanged = true;
      }
      if (group.plannedReturnOutputIndex === undefined) {
        group.plannedReturnOutputIndex = group.returnOutputIndex ?? returnIndex;
      }
    }
    // Trailing INSERT P' is part of the token planner's physical output block.
    for (const [groupIdx, group] of externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined) continue;
      const writers = externalCallUtxoGroups.filter((candidate, index) =>
        (candidate.sharedGroupIndex ?? index) === groupIdx
      && ((candidate.batchPredecessorOutputs?.length ?? 0) > 0
        || (candidate.plannedEntryInserts?.length ?? 0) > 0
        || Object.entries({ ...candidate.compilerRoute?.internalArgs, ...candidate.internalArgs })
          .some(([name]) => isWriterBatchWitnessName(name))));
      for (const writer of writers) {
        if (!writerBatchPlanMatchesPhysicalCarrier(group, writer)) continue;
        inheritWriterBatchPlan(group, writer);
      }
      const hasPred = (group.batchPredecessorOutputs?.length ?? 0) > 0
      || Object.entries({ ...group.internalArgs, ...group.compilerRoute?.internalArgs })
        .some(([name, value]) => /^__internal__vmapBatchPredOut_\d+$/.test(name)
          && typeof value === 'bigint' && value >= 0n)
      || writers.some((writer) => Object.entries({
        ...writer.internalArgs, ...writer.compilerRoute?.internalArgs,
      }).some(([name, value]) => /^__internal__vmapBatchPredOut_\d+$/.test(name)
        && typeof value === 'bigint' && value >= 0n));
      if (!hasPred) continue;
      const master = builder.findMintingInputIndex(group.categoryId);
      if (master < 0) continue;
      group.relocatedPredOutBase = materializedPredOutBase(group, master);
      group.refreshInternalArgs?.({}, { shiftPredOut: false });
      returnWitnessesChanged = true;
    }
    // A shared physical group is often the first logical callsite (a view) and
    // the unlocker for a later writer. The view tail and the writer's in-block
    // slot are different outputs; only the writer index may retarget the
    // callee's `__internal__returnOutputIdx`.
    for (const [groupIdx, group] of externalCallUtxoGroups.entries()) {
      if (group.sharedGroupIndex !== undefined || !group.refreshInternalArgs) continue;
      const writerIdx = externalCallUtxoGroups.findIndex((candidate, index) => (
        (candidate.sharedGroupIndex ?? index) === groupIdx
      && groupOwnsInBlockReturnEvent(externalCallUtxoGroups, index)
      ));
      const physicalReturn = (writerIdx >= 0
        ? assignedReturns.get(writerIdx)
        : assignedReturns.get(groupIdx));
      if (physicalReturn === undefined) continue;
      group.refreshInternalArgs(
        { __internal__returnOutputIdx: BigInt(physicalReturn) },
        { shiftPredOut: false },
      );
      returnWitnessesChanged = true;
    }
    for (const carrier of returnCarriers) {
      if (!carrier.returnWitnessGroups || !carrier.refreshInternalArgs) continue;
      const updates: Record<string, FunctionArgument> = {};
      for (const [name, groupIdx] of Object.entries(carrier.returnWitnessGroups)) {
        const returnIndex = assignedReturns.get(groupIdx);
        if (returnIndex === undefined) continue;
        if (carrier.internalArgs?.[name] === BigInt(returnIndex)) continue;
        updates[name] = BigInt(returnIndex);
      }
      if (Object.keys(updates).length === 0) continue;
      carrier.refreshInternalArgs(updates);
      returnWitnessesChanged = true;
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
      console.error('assigned-physical-returns', {
        assigned: [...assignedReturns],
        predBases: externalCallUtxoGroups.map((group) => group.relocatedPredOutBase),
        transferBase: builder.getTransferOutputBase(),
        groups: externalCallUtxoGroups.map((group, index) => ({
          index,
          functionName: group.functionName,
          logicalFunctionName: group.logicalFunctionName,
          mintingInputIndex: builder.findMintingInputIndex(group.categoryId),
          blockSize: group.blockLayout?.blockSize,
          blockInputs: group.blockInputs?.length,
          dataNfts: group.dataNftUtxos?.length,
          shared: group.sharedGroupIndex,
          fused: group.fusedReturnGroupIndex,
          ownsInBlock: groupOwnsInBlockReturnEvent(externalCallUtxoGroups, index),
          returnOutputIndex: group.returnOutputIndex,
          loopWidth: group.loopReturnCommitments?.length,
          precomputed: group.precomputedReturnCommitment
            ? binToHex(group.precomputedReturnCommitment)
            : undefined,
        })),
        pendingReturns: builder.getReturnEventOutputs().map((event) => ({
          identity: event.identity,
          commitment: binToHex(event.commitment),
        })),
        carriers: returnCarriers
          .filter((carrier) => carrier.returnWitnessGroups)
          .map((carrier) => ({
            functionName: carrier.functionName,
            returnWitnessGroups: carrier.returnWitnessGroups,
            internalReturnIdxs: Object.fromEntries(
              Object.entries(carrier.internalArgs ?? {})
                .filter(([name]) => /ReturnOutputIdx/.test(name)),
            ),
          })),
        band: builder.getChunkableValueWriteBand(),
        packOptions: builder.viewTailPackOptions(),
      });
    }
    if (returnWitnessesChanged) builder._refreshInputs();
  }
  // A callee's return event is read twice: by the covenant, through `__internal__externalReturnOutputIdx*`, and
  // by the SDK's own derivation, through `builder.getExternalCallReturnEventOutputIndex`. Both must name the same
  // output. The witness coordinates above are planned from group widths before the builder has placed its own
  // outputs (entry events, value chunks, funding pads), so a plan can drift onto an unrelated output. Reading a
  // 64-byte value chunk as a single ABI word yields a >2^256 integer, which aborts the caller's own integer bounds
  // check instead of merely returning a wrong value. The assembled transaction is the only authority here, so
  // retarget every return witness onto the builder's answer once the layout is materialized.
  const returnWitnessTargetsChanged = refreshTopLevelReturnWitnesses();
  const refreshTopLevelIdentityAnchorWitnesses = (): boolean => {
    let changed = false;
    for (const position of topLevelAnchorFillPositions) {
      const next = BigInt(position.categoryId === undefined
        ? builder.getIdentityAnchorInputIndex(position.band)
        : builder.getIdentityAnchorInputIndexByCategory(position.categoryId))
      + (position.proxyRoute ? 1_000_000n : 0n);
      if (finalArgs[position.argIndex] === next) continue;
      finalArgs[position.argIndex] = next;
      changed = true;
    }
    if (changed || returnWitnessTargetsChanged) {
      bag.stateInputUnlocker = buildStateInputUnlocker();
      builder._setMasterUnlocker(bag.stateInputUnlocker);
    }
    return changed;
  };
  refreshTopLevelIdentityAnchorWitnesses();

  // The `__internal__extcallMasterIdx<slot>` witness names the INPUT that carries the callee's master, and the
  // caller's own identity check reads that input's locking bytecode (`OP_UTXOBYTECODE` against the compiled call
  // target). The planned coordinate is reconstructed from dense band widths, which do not hold for a layout whose
  // implementation bands interleave with nested callees, so a stale coordinate fails the spend with a bare
  // `OP_VERIFY` before anything else in the frame can run. Rebind it from the assembled transaction.
  if (abiFunction && externalCallUtxoGroups.length > 0) {
    let masterWitnessesChanged = false;
    const groupByCallsite = new Map<number, number>();
    for (const [groupIndex, group] of externalCallUtxoGroups.entries()) {
      if (group.sourceCallsiteId !== undefined && !groupByCallsite.has(group.sourceCallsiteId)) {
        groupByCallsite.set(group.sourceCallsiteId, groupIndex);
      }
    }
    for (const input of abiFunction.inputs) {
      const masterWitness = /^__internal__extcallMasterIdx(\d*)$/.exec(input.name);
      if (masterWitness === null) continue;
      const slot = masterWitness[1] === '' ? 0 : Number(masterWitness[1]);
      const groupIndex = groupIndexForExternalCallSlot({
        slot, externalCalls: abiFunction.externalCalls, groupByCallsite,
        compactGroups: externalCallUtxoGroups.map((_, index) => index),
      });
      if (groupIndex === undefined) continue;
      const group = externalCallUtxoGroups[groupIndex];
      if (group === undefined) continue;
      const position = abiFunction.inputs.findIndex((candidate) => candidate.name === input.name);
      if (position < 0 || position >= finalArgs.length) continue;
      // The materialized master is the authority: the caller's own identity check reads THAT input's locking
      // bytecode against the compiled call target. An identity ANCHOR is a different co-spent resource (a
      // permissionless logical-identity entry, not the callee's master), so it may only stand in when the
      // callee master itself is not part of this transaction - otherwise the check authenticates the anchor's
      // bytecode and aborts with a bare OP_VERIFY. A proxied anchor carries the `+1_000_000` implementation
      // marker instead of an index and is skipped.
      const anchorPosition = abiFunction.inputs.findIndex((candidate) =>
        candidate.name === `__internal__extcallAnchorIdx${slot}`
      || candidate.name === '__internal__extcallAnchorIdx');
      const anchorValue = anchorPosition < 0 ? undefined : finalArgs[anchorPosition];
      const anchorIndex = typeof anchorValue === 'bigint'
      && anchorValue >= 0n && anchorValue < 1_000_000n ? Number(anchorValue) : -1;
      const materializedMaster = builder.findMaterializedMasterInput(group.sharedGroupIndex ?? groupIndex);
      const authoritative = materializedMaster >= 0 ? materializedMaster : anchorIndex;
      if (authoritative < 0 || finalArgs[position] === BigInt(authoritative)) continue;
      finalArgs[position] = BigInt(authoritative);
      masterWitnessesChanged = true;
    }
    if (masterWitnessesChanged) {
      bag.stateInputUnlocker = buildStateInputUnlocker();
      builder._setMasterUnlocker(bag.stateInputUnlocker);
    }
  }

  // `__internal__externalCallInputBase` tells the covenant where the co-spent participant region begins: the
  // compiler adds each slot's compile-time offset to it. The plan counts only the caller's own data-NFT slots,
  // so an assembled frame with additional input-consuming slots before the participants (the caller's own entry
  // NFT, an output-only slot's funder) shifts the region and every identity check then authenticates the wrong
  // input. The assembled transaction is the authority, exactly as for the return and anchor witnesses.
  if (abiFunction) {
    const basePosition = abiFunction.inputs.findIndex((input) =>
      input.name === '__internal__externalCallInputBase');
    if (basePosition >= 0 && basePosition < finalArgs.length && externalCallUtxoGroups.length > 0) {
      const firstGroup = externalCallUtxoGroups[0];
      const firstParticipant = firstGroup === undefined ? -1
        : builder.findMaterializedMasterInput(firstGroup.sharedGroupIndex ?? 0);
      if (firstParticipant >= 0 && finalArgs[basePosition] !== BigInt(firstParticipant)) {
        finalArgs[basePosition] = BigInt(firstParticipant);
        bag.stateInputUnlocker = buildStateInputUnlocker();
        builder._setMasterUnlocker(bag.stateInputUnlocker);
      }
    }
  }

  // A sorted-mapping proof witness publishes the distance from the executing master input to the co-spent entry
  // NFT that brackets the written key, and the covenant reads the proof input at `masterInputIndex + offset`. The
  // plan derives that distance from the collection's block slot, which equals the physical distance only while the
  // input frame is dense - an assembled participant region can interleave callee blocks before the entry NFT. The
  // covenant then authenticates the locking bytecode of whatever input the arithmetic names and aborts on
  // `OP_EQUALVERIFY`, so the assembled outpoints are the only authority for the distance.
  if (abiFunction && topLevelVmapProofUtxos.size > 0) {
    let proofWitnessesChanged = false;
    const masterInputIndex = builder.findInputIndexByOutpoint(masterUtxo) >= 0
      ? builder.findInputIndexByOutpoint(masterUtxo)
      : builder.findInputIndexByOutpoint(derivationMasterUtxo);
    if (masterInputIndex >= 0) {
      for (const input of abiFunction.inputs) {
        const proofWitness = /^__internal__vmapBatchProof_(\d+)$/.exec(input.name);
        if (proofWitness === null) continue;
        const proofUtxo = topLevelVmapProofUtxos.get(Number(proofWitness[1]));
        if (proofUtxo === undefined) continue;
        const position = abiFunction.inputs.findIndex((candidate) => candidate.name === input.name);
        if (position < 0 || position >= finalArgs.length) continue;
        const proofInputIndex = builder.findInputIndexByOutpoint(proofUtxo);
        const offset = proofInputIndex < 0 ? -1 : proofInputIndex - masterInputIndex;
        if (offset < 0 || finalArgs[position] === BigInt(offset)) continue;
        finalArgs[position] = BigInt(offset);
        proofWitnessesChanged = true;
      }
    }
    if (proofWitnessesChanged) {
      bag.stateInputUnlocker = buildStateInputUnlocker();
      builder._setMasterUnlocker(bag.stateInputUnlocker);
    }
  }

  return { refreshTopLevelIdentityAnchorWitnesses };
}
