/**
 * phase-boundary extract: SC _createBuilder extract — nested input/output bases + return indexes.
 */

import type { AbiFunction, FunctionBlockLayout } from '@solidcash/utils';
import type { UnlockableUtxo } from '../interfaces.js';
import { createDataNftUnlocker } from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { groupOwnsInBlockReturnEvent } from './value-chunk-geometry.js';

export type PlanCreateBuilderNestedBasesResult = {
  nestedInputBase: number;
  projectedRouteBlockSize: number;
  nestedOutputBase: number;
  nestedMasterIndices: number[];
  nestedOutputBases: number[];
  delegateReturnOutputBase: number;
  returningExternalGroups: number[];
  returnIndexForGroup: Map<number, number>;
  physicalReturnIndexForGroup: Map<number, number>;
};

/**
 * Compute nested callee input/output bases and logical/physical return-event
 * indexes after low-level input counting completes.
 */
export function planCreateBuilderNestedBases(params: {
  compilerRouteDelegateLayout: FunctionBlockLayout | undefined;
  lowLevelCallInputBase: number;
  allLowLevelInputCount: number;
  hasNestedDelegate: boolean;
  delegatedDynamicSuffix: boolean;
  legacyRouteTrailingBase: number | undefined;
  iterationEntryInputs: readonly UnlockableUtxo[];
  insertLoopPredecessors: readonly unknown[];
  delegatedDynamicWriteChunkCount: number;
  requiredNftIndices: readonly number[];
  delegateInputCount: number;
  externalReadUtxos: readonly unknown[];
  outStateInputCount: number;
  delegatedLoopOutputSurplus: number;
  delegatedLoopOutputCount: number;
  abiFunction: AbiFunction | undefined;
  lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  externalOutStateUtxoGroups: readonly { dataNftUtxos: readonly unknown[]; keccakInputs?: readonly unknown[] }[];
  legacyRouteDelegateFn: AbiFunction | undefined;
  returnEmitOutputIndex: number;
  overrides: { blockBase?: number } | undefined;
  functionName: string;
  allGroupEcSlots: readonly { hasReturnValues?: boolean }[];
  timing?: (label: string) => void;
}): PlanCreateBuilderNestedBasesResult {
  const {
    compilerRouteDelegateLayout, lowLevelCallInputBase, allLowLevelInputCount,
    hasNestedDelegate, delegatedDynamicSuffix, legacyRouteTrailingBase,
    iterationEntryInputs, insertLoopPredecessors, delegatedDynamicWriteChunkCount,
    requiredNftIndices, delegateInputCount, externalReadUtxos, outStateInputCount,
    delegatedLoopOutputSurplus, delegatedLoopOutputCount, abiFunction, lowLevelCallUtxoGroups,
    externalCallUtxoGroups, externalOutStateUtxoGroups, legacyRouteDelegateFn,
    returnEmitOutputIndex, overrides, functionName, allGroupEcSlots, timing,
  } = params;

  let nestedInputBase = compilerRouteDelegateLayout
    ? lowLevelCallInputBase + allLowLevelInputCount
    : hasNestedDelegate && delegatedDynamicSuffix && legacyRouteTrailingBase !== undefined
      // Legacy proxy composition still puts the implementation immediately after the proxy state band, but
      // its fixed block can contain output-only slots. `_buildInputs` pads those slots, then places sorted-loop
      // predecessor proofs before nested callees. Mirror that physical geometry when publishing the callees'
      // hidden absolute input indices.
      ? lowLevelCallInputBase + legacyRouteTrailingBase
        + iterationEntryInputs.length + insertLoopPredecessors.length
        + delegatedDynamicWriteChunkCount
      : hasNestedDelegate
        ? 1 + requiredNftIndices.length + delegateInputCount
        : 1 + requiredNftIndices.length + externalReadUtxos.length
        + outStateInputCount + iterationEntryInputs.length;
  // A sorted INSERT consumes one predecessor but emits the rewritten predecessor plus a new node. The
  // transaction builder balances that output-only expansion with a funder before nested callees; publish the
  // same physical shift in every nested master/output witness assembled below.
  // legacyRouteTrailingBase already covers the impl returnEvent output-only input pad that _buildInputs
  // inserts before upsert HEAD when proxy __forward lacks a returnEvent slot.
  nestedInputBase += delegatedLoopOutputSurplus;
  // Delegate implementation output-only slots are projected into the caller's balanced block below. Nested
  // outputs begin after that expanded block, not after only the caller's original state slots. Compute the same
  // maximum offset here so hidden absolute-output witnesses can be finalized before the builder is created.
  let projectedRouteBlockSize = compilerRouteDelegateLayout?.blockSize
    ?? abiFunction?.blockLayout?.blockSize ?? 0;
  for (const delegate of lowLevelCallUtxoGroups) {
    if (delegate.callMode !== 'delegatecall') continue;
    const delegateFn = (delegate.externalContract.inner.artifact.abi as readonly {
      name: string; blockLayout?: FunctionBlockLayout;
    }[]).find((candidate) => candidate.name === delegate.functionName);
    const extras = (delegateFn?.blockLayout?.slots ?? [])
      .filter((slot) => slot.kind !== 'master' && slot.kind !== 'dataNft');
    if (extras.length === 0
      || !extras.every((slot) => slot.kind === 'event' || slot.kind === 'entry'
        || slot.kind === 'tokenContainer' || slot.kind === 'tcTransfer'
        || slot.kind === 'returnEvent')) continue;
    const existingCallSlot = abiFunction?.blockLayout?.slots.find((slot) => slot.kind === 'lowLevelCall');
    const callOffset = existingCallSlot?.offset ?? (abiFunction?.blockLayout?.blockSize ?? 1);
    projectedRouteBlockSize = Math.max(projectedRouteBlockSize, callOffset + 1);
    const delegateOnly = delegate.externalContract.inner.artifact.delegateOnly === true;
    const dataSlots = (delegateFn?.blockLayout?.slots ?? []).filter((slot) => slot.kind === 'dataNft');
    for (const slot of extras) {
      // The implementation return event moves the caller's already-declared return slot; it is not appended
      // to `delegateEventSlots`, so it does not independently extend the builder's effective block size.
      if (slot.kind === 'returnEvent') continue;
      const below = delegateOnly ? dataSlots.filter((dataSlot) => dataSlot.offset < slot.offset).length : 0;
      projectedRouteBlockSize = Math.max(projectedRouteBlockSize, callOffset + slot.offset - below + 1);
    }
  }
  timing?.('projected-route-size');
  const packedNestedOutputBase = 1 + requiredNftIndices.length + externalReadUtxos.length
    + externalOutStateUtxoGroups.reduce((sum, g) => sum + 1 + g.dataNftUtxos.length
      + (g.keccakInputs?.length ?? 0), 0)
    + iterationEntryInputs.length
    // An active caller return is an output-only root-block slot, so it shifts nested output blocks without
    // shifting their input coordinates.
    + (returnEmitOutputIndex >= 0 ? 1 : 0);
  let nestedOutputBase = Math.max(
    packedNestedOutputBase,
    (overrides?.blockBase ?? 0) + projectedRouteBlockSize,
  ) + delegatedLoopOutputCount + delegatedLoopOutputSurplus
    // RMW write chunks occupy impl+trailing outputs (burned, recreated at the suffix).
    // Without them here, nested output bases sit two slots early once jobs already has chunks.
    + delegatedDynamicWriteChunkCount;
  // Upsert HEAD pads returnEvent + P' + NEW before nested callees. Output count+surplus can
  // over-shift nestedOutputBase relative to that input geometry; keep the bases aligned.
  if (insertLoopPredecessors.length > 0 && !compilerRouteDelegateLayout) {
    nestedOutputBase = nestedInputBase;
  }
  const nestedMasterIndices: number[] = [];
  const nestedOutputBases: number[] = [];
  for (let groupIdx = 0; groupIdx < externalCallUtxoGroups.length; groupIdx++) {
    const child = externalCallUtxoGroups[groupIdx];
    if (child.sharedGroupIndex !== undefined) {
      nestedMasterIndices[groupIdx] = nestedMasterIndices[child.sharedGroupIndex];
      nestedOutputBases[groupIdx] = nestedOutputBases[child.sharedGroupIndex];
      continue;
    }
    nestedMasterIndices[groupIdx] = nestedInputBase;
    nestedOutputBases[groupIdx] = nestedOutputBase;
    const childMasterIndex = nestedInputBase;
    child.dataNftUtxos = child.dataNftUtxos.map((utxo) => ({
      ...utxo,
      unlocker: createDataNftUnlocker(child.externalContract.inner, childMasterIndex, child.categoryId),
    }));
    const childBlockInputCount = child.blockInputs?.length ?? 1 + child.dataNftUtxos.length;
    nestedInputBase += childBlockInputCount + (child.ordinaryDynamicChunkInputs?.length ?? 0);
    nestedOutputBase += childBlockInputCount;
    // Legacy layouts interleave each proxy's implementation. A compiler route has already included the
    // complete implementation band in nestedInputBase, while outputs remain interleaved.
    if (child.delegateCallGroupIndex !== undefined && !child.delegateEmbeddedInBlock) {
      const delegate = lowLevelCallUtxoGroups[child.delegateCallGroupIndex];
      if (delegate?.callMode === 'delegatecall') {
        nestedOutputBase += 1 + delegate.dataNftUtxos.length;
        if (child.compilerRoute) nestedOutputBase += 1 + child.requiredDataNftIndices.length;
        if (!compilerRouteDelegateLayout) nestedInputBase += 1 + delegate.dataNftUtxos.length;
      }
    }
  }

  // Delegate-mode return events are emitted immediately after all ordinary
  // external-call outputs and before the preserved implementation group.
  const externalOutputStart = 1 + requiredNftIndices.length + externalReadUtxos.length
    + externalOutStateUtxoGroups.reduce((sum, g) => sum + 1 + g.dataNftUtxos.length
      + (g.keccakInputs?.length ?? 0), 0)
    + iterationEntryInputs.length;
  // Only the *entry* implementation's own return channel occupies a slot before
  // the nested tail. Nested view impls (MarketplaceData.arbitratorRegistered,
  // meceTags) also have outputs, but those are the tail returns themselves —
  // counting them here shifted updateJobPost's witnesses onto the empty output
  // after the real 0x51 / tag-string returns.
  const delegatedCallerReturnCount = (legacyRouteDelegateFn?.outputs?.length ?? 0) > 0 ? 1 : 0;
  const externalGroupOutputCount = externalCallUtxoGroups.reduce(
    (sum, g) => g.sharedGroupIndex === undefined
      ? sum + (g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length) : sum, 0,
  );
  const associatedDelegateGroups = new Set(externalCallUtxoGroups
    .map((group) => group.delegateCallGroupIndex)
    .filter((index): index is number => index !== undefined));
  const delegateImplOutputCount = lowLevelCallUtxoGroups
    // An associated/embedded delegate is emitted while materializing its external proxy group rather than
    // in the later low-level loop, but it still occupies physical output coordinates before the appended
    // return band. Excluding it made every proxy return witness point one slot early (at the implementation
    // master rather than the first return event).
    .filter((g) => g.callMode === 'delegatecall')
    .reduce((sum: number, g: { dataNftUtxos: readonly unknown[] }) => sum + 1 + g.dataNftUtxos.length, 0);
  let delegateReturnOutputBase = externalOutputStart + externalGroupOutputCount
    + delegateImplOutputCount
    + delegatedCallerReturnCount + delegatedLoopOutputCount
    + delegatedDynamicWriteChunkCount;
  // Match _buildInputs' returnEvent pad before upsert HEAD when the active layout lacks
  // a returnEvent slot but the delegate implementation blockSize still includes one.
  // Without this, nested tail returns land one slot early.
  if (insertLoopPredecessors.length > 0 && !compilerRouteDelegateLayout
    && !(abiFunction?.blockLayout?.slots ?? []).some((slot) => slot.kind === 'returnEvent')
    && (legacyRouteDelegateFn?.blockLayout?.slots ?? []).some((slot) => slot.kind === 'returnEvent')) {
    delegateReturnOutputBase += 1;
  }
  // A no-return writer (updateJobPost / closeJob) already places the nested
  // publishJobEvent impl inside MarketplaceData.__forward's 10-output block,
  // and jobs-chunk pads occupy impl+trailing. The associated-delegate +1 then
  // lands tail witnesses on the empty output after the real 0x51 / tag-string
  // returns. publishJobPost keeps the +1: it has its own return channel and
  // FakeToken in-block returns that re-pack the tail.
  if ((legacyRouteDelegateFn?.outputs?.length ?? 0) === 0
    && delegatedDynamicWriteChunkCount > 0 && associatedDelegateGroups.size > 0) {
    delegateReturnOutputBase -= 1;
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_RETURN === '1') {
    console.error('delegate-return-base', {
      functionName: legacyRouteDelegateFn?.name ?? functionName,
      entryOutputs: legacyRouteDelegateFn?.outputs?.length ?? 0,
      externalOutputStart, externalGroupOutputCount, delegateImplOutputCount,
      delegatedCallerReturnCount, delegatedLoopOutputCount, delegatedDynamicWriteChunkCount,
      delegateReturnOutputBase,
      groups: externalCallUtxoGroups.map((g, i) => ({
        i, fn: g.functionName, shared: g.sharedGroupIndex,
        block: g.blockInputs?.length, data: g.dataNftUtxos.length,
        returnInBlock: g.returnEventInBlock,
      })),
      delegates: lowLevelCallUtxoGroups.map((g, i) => ({
        i, fn: g.functionName, mode: g.callMode, data: g.dataNftUtxos.length,
      })),
    });
  }
  const returningExternalGroups = externalCallUtxoGroups
    .map((_, idx) => idx)
    .filter((idx) => allGroupEcSlots[idx]?.hasReturnValues);
  timing?.('returning-groups-selected');
  let delegateTailReturnRank = 0;
  const returnIndexForGroup = new Map<number, number>();
  const tailReturnRank = (a: number, b: number): number => {
    const name = (idx: number): string => externalCallUtxoGroups[idx]?.functionName ?? '';
    const proxy = (idx: number): number => (name(idx) === '__forward' ? 0 : 1);
    return proxy(a) - proxy(b) || a - b;
  };
  for (const groupIdx of returningExternalGroups) {
    const child = externalCallUtxoGroups[groupIdx];
    const physicalGroupIdx = child.sharedGroupIndex ?? groupIdx;
    const physical = externalCallUtxoGroups[physicalGroupIdx];
    const returnSlot = physical.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent');
    // In-block events don't consume a position in the appended tail. Counting
    // them here shifted every later logical return (for example MarketplaceData
    // userRegistered after an in-block token balanceOf) onto unrelated outputs.
    if (groupOwnsInBlockReturnEvent(externalCallUtxoGroups, groupIdx) && returnSlot) {
      returnIndexForGroup.set(groupIdx, nestedOutputBases[physicalGroupIdx] + returnSlot.offset);
    }
  }
  for (const groupIdx of [...returningExternalGroups].sort(tailReturnRank)) {
    if (returnIndexForGroup.has(groupIdx)) continue;
    const child = externalCallUtxoGroups[groupIdx];
    const width = Math.max(1, child.loopReturnCommitments?.length ?? 1);
    returnIndexForGroup.set(groupIdx, delegateReturnOutputBase + delegateTailReturnRank);
    delegateTailReturnRank += width;
  }
  timing?.('return-indexes-complete');
  // Compiler routes reserve their return event inside the callee's fixed
  // block. Unlike legacy fused calls, no appended return output exists.
  const physicalReturnIndexForGroup = new Map(returnIndexForGroup);
  for (const groupIdx of returningExternalGroups) {
    const child = externalCallUtxoGroups[groupIdx];
    const physicalGroupIdx = child.sharedGroupIndex ?? groupIdx;
    const physical = externalCallUtxoGroups[physicalGroupIdx];
    if (groupOwnsInBlockReturnEvent(externalCallUtxoGroups, groupIdx) && physical.blockLayout) {
      const returnSlot = physical.blockLayout.slots.find((slot) => slot.kind === 'returnEvent');
      if (returnSlot) {
        // An in-block return event is an OUTPUT at that offset of the callee's block. The dense frame made
        // the input and output bases coincide, so the input base served for both; a route block stretches
        // only the input side, and reading it there names an unrelated output (an entry NFT, whose leading
        // zero bytes decode as an empty return value rather than failing outright). Legacy layouts keep the
        // established input-base reading.
        physicalReturnIndexForGroup.set(
          groupIdx,
          (compilerRouteDelegateLayout || delegatedDynamicSuffix
            // The builder balances a full routed block forward to its physical master coordinate. A dense
            // output prefix can therefore be earlier than the master, but never later; use the coordinate
            // the block will actually occupy rather than pointing the return witness into the preceding
            // participant's final slot.
            ? Math.max(nestedOutputBases[physicalGroupIdx], nestedMasterIndices[physicalGroupIdx])
            : nestedMasterIndices[physicalGroupIdx])
          + returnSlot.offset,
        );
      }
    }
  }
  timing?.('physical-return-indexes-complete');

  return {
    nestedInputBase,
    projectedRouteBlockSize,
    nestedOutputBase,
    nestedMasterIndices,
    nestedOutputBases,
    delegateReturnOutputBase,
    returningExternalGroups,
    returnIndexForGroup,
    physicalReturnIndexForGroup,
  };
}
