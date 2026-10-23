/**
 * phase-boundary extract: SC _createBuilder extract — apply return indexes and complete nested
 * callee unlockers / internal witnesses after pred-out relocate.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AbiFunction, ExternalCallAbi } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  externalReturnParamSlot,
  nestedProxyImplementationInputIndex,
  physicalExternalCallSelectorHex,
  participantGroupForTarget,
  selectorParamSlot,
} from './physical-external-call.js';
import { selectVisibleCallArguments } from './route-expression-key.js';
import {
  addressArgumentLockingBytecodeHex, externalCallTargetSourceLockingBytecodeHex,
} from './mapping-key-lookup.js';
import type { MessageBusRuntimeAbiFunction } from './sc-batch-raw.js';
import { logicalReturnGroupIndex } from './value-chunk-geometry.js';
import {
  groupLayoutTrailingBase,
  resolveAbsolutePredOut,
} from './writer-event-delegate-layout.js';
import { computedStateWriterGroupIndex } from './writer-group-selection.js';
import { resolveOrdinarySelfIdentity, usesOrdinarySelfIdentity } from './ordinary-self-identity.js';
import {
  callerIdentityAnchorBand,
  isRoutePushValueWitnessName,
  resolveDelegatePushValueWitness,
  rootOwnsCallerSubject,
} from './sc-fix-create-builder-delegate-unlockers.js';

/** Resolve compiler-published fold witnesses while completing an ordinary nested callee unlocker. */
export function resolveNestedRoutePushValueWitness(
  name: string,
  compilerRouteArgs: Readonly<Record<string, FunctionArgument>> | undefined,
  groupArgs: Readonly<Record<string, FunctionArgument>> | undefined,
): FunctionArgument | undefined {
  if (!isRoutePushValueWitnessName(name)) return undefined;
  return resolveDelegatePushValueWitness(name, compilerRouteArgs, groupArgs, undefined);
}

export type CompleteCreateBuilderNestedUnlockersHost = {
  readonly categoryId: string;
  timing: (label: string) => void;
  resolveNestedIdentityAnchorBands: (...args: any[]) => Promise<{
    anchorBandBySlot: Map<number, any>;
    proxyAnchorSlots: Set<number>;
  }>;
  nestedFullState: (contract: any) => Promise<any>;
  ensureNestedIdentityAnchorBand: (address: string) => Promise<number | undefined>;
  selectProxyForwardInput: (...args: any[]) => FunctionArgument;
  directNestedIdentityWitness: (...args: any[]) => any;
};

/**
 * Stamp physical returnOutputIndex onto returning/transitive groups and complete
 * each nested callee's unlockers, absolute witnesses, and internal args.
 */
export async function completeCreateBuilderNestedUnlockers(
  host: CompleteCreateBuilderNestedUnlockersHost,
  params: {
    externalCallUtxoGroups: ExternalCallUtxoGroup[];
    lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
    returningExternalGroups: readonly number[];
    physicalReturnIndexForGroup: Map<number, number>;
    nestedMasterIndices: number[];
    nestedOutputBases: number[];
    relocatedPredOutBase: Map<number, number>;
    allGroupParentIndices: number[];
    allGroupEcSlots: Array<ExternalCallAbi | { hasReturnValues?: boolean; requiredDataNftIndices: number[] }>;
    delegateExternalGroupIndices: Map<number, number[]>;
    delegateExternalGroupByCallsite: Map<number, Map<number, number>>;
    lateTransitiveGroupIndices: Set<number>;
    [key: string]: any;
  },
): Promise<void> {
  const {
    externalCallUtxoGroups, lowLevelCallUtxoGroups, returningExternalGroups,
    physicalReturnIndexForGroup, nestedMasterIndices,
    relocatedPredOutBase, allGroupParentIndices, allGroupEcSlots,
    delegateExternalGroupIndices, delegateExternalGroupByCallsite,
    lateTransitiveGroupIndices,
  } = params;
  const resolveNestedIdentityAnchorBands = host.resolveNestedIdentityAnchorBands;
  const nestedFullState = host.nestedFullState;
  const selectProxyForwardInput = host.selectProxyForwardInput;
  const directNestedIdentityWitness = host.directNestedIdentityWitness;
  const pendingDelegateInputFills = params.pendingDelegateInputFills as any[];
  const pendingAnchorFills = params.pendingAnchorFills as any[];
  const pendingExternalCallInputFills = params.pendingExternalCallInputFills as any[];
  const entryAbiFunction = params.entryAbiFunction as AbiFunction | undefined;
  const identityAnchors = params.identityAnchors as UnlockableUtxo[];
  const publicSelfAddress = params.publicSelfAddress as Uint8Array;
  const authenticatedSelfAddress = params.authenticatedSelfAddress as Uint8Array | undefined
    ?? publicSelfAddress;

  for (const groupIdx of returningExternalGroups) {
    const child = externalCallUtxoGroups[groupIdx];
    const placed = physicalReturnIndexForGroup.get(
      logicalReturnGroupIndex(externalCallUtxoGroups, groupIdx),
    );
    if (placed !== undefined) child.returnOutputIndex = placed;
  }
  for (const groupIdx of new Set([
    ...delegateExternalGroupIndices.values()].flat().concat([...lateTransitiveGroupIndices]))) {
    const child = externalCallUtxoGroups[groupIdx];
    child.returnOutputIndex = physicalReturnIndexForGroup.get(
      logicalReturnGroupIndex(externalCallUtxoGroups, groupIdx),
    );
    const childFn = (child.delegateCallGroupIndex === undefined
      ? child.compilerRoute?.abiFunction : undefined)
      ?? (child.externalContract.inner.artifact.abi as readonly AbiFunction[])
        .find((f) => f.name === child.functionName);
    if (!childFn) continue;
    const childSelfIdentity = !child.compilerRoute
      ? await resolveOrdinarySelfIdentity(child.externalContract, childFn) : undefined;
    const childSelfIdentityBand = childSelfIdentity === undefined ? undefined
      : await host.ensureNestedIdentityAnchorBand(childSelfIdentity.logicalAddress);
    let visible = 0;
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_ROUTE === '1') {
      console.error('nested-route-internal-args', child.functionName,
        child.compilerRoute?.internalArgs ?? child.internalArgs, child.plannedEntryInserts);
    }
    const childExternalCallInputPositions: { name: string; categoryId: string }[] = [];
    const childNestedGroups = child.delegateCallGroupIndex === undefined
      ? allGroupParentIndices.flatMap((parent, index) => (parent === groupIdx ? [index] : []))
      : delegateExternalGroupIndices.get(child.delegateCallGroupIndex) ?? [];
    const childNestedGroupIndexForSlot = (slot: number): number | undefined => {
      const call = childFn.externalCalls?.[slot];
      const delegateGroupIndex = child.delegateCallGroupIndex;
      if (call?.callsiteId === undefined) return childNestedGroups[slot];
      if (delegateGroupIndex !== undefined) {
        return delegateExternalGroupByCallsite.get(delegateGroupIndex)?.get(call.callsiteId);
      }
      return childNestedGroups.find((index) => (
        (allGroupEcSlots[index] as ExternalCallAbi | undefined)?.callsiteId === call.callsiteId
      ));
    };
    const {
      anchorBandBySlot: childAnchorBandBySlot,
      proxyAnchorSlots: childProxyAnchorSlots,
    } = await resolveNestedIdentityAnchorBands(
      childFn,
      child.logicalFunctionArgs ?? child.functionArgs,
      childNestedGroupIndexForSlot,
      await (async () => {
        const contract = (child.logicalContract ?? child.externalContract) as any;
        return {
          contract,
          artifact: child.logicalArtifact ?? child.externalContract.inner.artifact,
          state: (await nestedFullState(contract)).state,
          executionSelfAddress: childSelfIdentity?.unlocker.generateLockingBytecode()
            ?? hexToBin(child.externalContract.inner.lockingBytecode),
        };
      })(),
    );
    const childAnchorFillPositions: {
      argIndex: number; name: string; band?: number; categoryId?: string; proxyRoute: boolean; required?: boolean;
    }[] = [];
    const childParentGroupIndex = allGroupParentIndices[groupIdx];
    const childCallerCategoryId = child.callerIdentity?.categoryId
      ?? (childParentGroupIndex !== undefined && childParentGroupIndex >= 0
        ? externalCallUtxoGroups[childParentGroupIndex]?.categoryId ?? host.categoryId
        : host.categoryId);
    const childPhysicalCallerLockingBytecode = childParentGroupIndex !== undefined
      && childParentGroupIndex >= 0
      ? externalCallUtxoGroups[childParentGroupIndex]?.externalContract.inner.lockingBytecode
        ?? binToHex(publicSelfAddress)
      : binToHex(publicSelfAddress);
    const childCallerSubjectLockingBytecode = child.callerIdentity?.lockingBytecode
      ?? childPhysicalCallerLockingBytecode;
    const needsMsgSenderAnchor = childFn.inputs.some((input) => input.name === '__internal__msgSenderAnchorIdx')
      && childCallerSubjectLockingBytecode.toLowerCase() !== childPhysicalCallerLockingBytecode.toLowerCase();
    const rootLogicalCaller = needsMsgSenderAnchor
      && (childParentGroupIndex === undefined || childParentGroupIndex < 0)
      && rootOwnsCallerSubject(
        childCallerSubjectLockingBytecode, authenticatedSelfAddress, params.logicalCreateLock,
      );
    if (needsMsgSenderAnchor && !rootLogicalCaller) {
      // A callback can retarget an earlier physical carrier without moving that carrier beneath
      // its own descendant in the logical graph. In that case the physical parent is not the
      // caller subject: locate the co-spent caller by its authenticated category and exact lock.
      const caller = externalCallUtxoGroups.find((group) => (
        group.categoryId.toLowerCase() === childCallerCategoryId.toLowerCase()
        && (addressArgumentLockingBytecodeHex(group.externalContract.target)
          ?? group.externalContract.inner.lockingBytecode).toLowerCase()
          === childCallerSubjectLockingBytecode.toLowerCase()
      ))?.externalContract;
      if (caller) await host.ensureNestedIdentityAnchorBand(caller.target);
    }
    const childMsgSenderAnchorBand = needsMsgSenderAnchor && !rootLogicalCaller
      ? callerIdentityAnchorBand(
        childCallerSubjectLockingBytecode,
        childPhysicalCallerLockingBytecode,
        identityAnchors.map((anchor, band) => ({
          band,
          lockingBytecode: binToHex(anchor.unlocker.generateLockingBytecode()),
        })),
      ) : undefined;
    const encoded = childFn.inputs.map((input, inputIndex) => {
      if (!input.name.startsWith('__internal__')) {
        // A compiler route has its own visible ABI (`batchBlob` plus route witnesses), distinct from the
        // logical handler arguments retained on the group for graph metadata. Use the route's exact vector;
        // selecting by coincidental arity can shift a handler amount into an address witness.
        const visibleArgs = child.compilerRoute?.args ?? selectVisibleCallArguments(
          childFn.inputs, child.logicalFunctionArgs, child.functionArgs,
        );
        const value = visibleArgs[visible++];
        if (child.functionName === '__forward' && input.type === 'bytes') {
          const logicalSelector = ((child.logicalArtifact ?? child.externalContract.inner.artifact)
            .abi as readonly AbiFunction[])
            .find((fn) => fn.name === child.logicalFunctionName)?.selector;
          return selectProxyForwardInput(
            logicalSelector, child.functionArgs,
            child.delegateCallGroupIndex !== undefined
              && lowLevelCallUtxoGroups[child.delegateCallGroupIndex]?.compilerRoute !== undefined,
          );
        }
        return value;
      }
      if (input.name === '__internal__returnOutputIdx') {
        return BigInt(physicalReturnIndexForGroup.get(
          logicalReturnGroupIndex(externalCallUtxoGroups, groupIdx),
        ) ?? -1);
      }
      if (input.name === '__internal__valueChunkOutputBase') {
        return child.compilerRoute?.internalArgs?.[input.name]
          ?? child.internalArgs?.[input.name]
          ?? -1n;
      }
      if (input.name === '__internal__dynamicChunkInputBase') {
        // The exact input coordinate is patched after the builder places selected continuation UTXOs.
        // A negative sentinel is the canonical provisional value for an empty/non-chunked state value.
        return child.compilerRoute?.internalArgs?.[input.name]
          ?? child.internalArgs?.[input.name]
          ?? -1n;
      }
      if (input.name === '__internal__dynamicChunkOutputBase') {
        return child.compilerRoute?.internalArgs?.[input.name]
          ?? child.internalArgs?.[input.name]
          ?? -1n;
      }
      const routePushValue = resolveNestedRoutePushValueWitness(
        input.name,
        child.compilerRoute?.internalArgs,
        child.internalArgs,
      );
      if (routePushValue !== undefined) return routePushValue;
      if (!child.compilerRoute && usesOrdinarySelfIdentity(childFn)
        && input.name === '__internal__graphSelfIdentityInput') {
        if (childSelfIdentityBand !== undefined) childAnchorFillPositions.push({
          argIndex: inputIndex, name: input.name, band: childSelfIdentityBand, proxyRoute: false, required: true,
        });
        return -1n;
      }
      if (['__internal__activeVerifierIndex', '__internal__participantBlockSize', '__internal__graphFixedSize',
        '__internal__graphSelfIdentityInput',
        '__internal__graphBlockSize', '__internal__graphSettlementBoundary',
        '__internal__blockhashInputIndex', '__internal__graphEmissions',
        '__internal__graphCallers', '__internal__graphCompletionPositions',
        '__internal__graphSettlementTable'].includes(input.name)) {
        // This unlocker exists only for ordinary graph discovery. If the completed graph requires atomic
        // execution, send() rebuilds it from PreparedAtomicMessageBusCall and the composer supplies the
        // finalized verifier/manifest values. Preserve the compiler route's typed provisional values here
        // so discovery cannot silently fall back to a direct handler outside OP_INVOKE.
        const provisional = child.compilerRoute?.internalArgs?.[input.name];
        if (provisional !== undefined) return provisional;
        if (['__internal__graphEmissions', '__internal__graphCallers',
          '__internal__graphCompletionPositions', '__internal__graphSettlementTable']
          .includes(input.name)) return new Uint8Array();
        return -1n;
      }
      if (input.name === '__internal__msgSenderCategory') {
        // OP_UTXOTOKENCATEGORY exposes the transaction-hash bytes in wire
        // order, opposite the canonical category-id string used by the SDK.
        // A transitive call is made by its immediate parent group, not the
        // root contract whose StatefulFunctionCall is building the graph.
        return hexToBin(childCallerCategoryId).reverse();
      }
      // The ABI position takes the no-anchor sentinel the deploy derivation passes, unless the logical caller
      // differs from the physical one: that anchor is recorded here and filled once the bands are placed.
      if (input.name === '__internal__msgSenderAnchorIdx') {
        if (rootLogicalCaller) {
          childAnchorFillPositions.push({
            argIndex: inputIndex, name: input.name, categoryId: childCallerCategoryId,
            proxyRoute: false,
          });
        } else if (childMsgSenderAnchorBand !== undefined) {
          childAnchorFillPositions.push({
            argIndex: inputIndex, name: input.name, band: childMsgSenderAnchorBand,
            proxyRoute: false,
          });
        }
        return -1n;
      }
      if (input.name === '__internal__delegateInputIndex') {
        const delegateGroup = child.delegateCallGroupIndex;
        if (delegateGroup === undefined) return -1n;
        const physicalGroupIndex = child.sharedGroupIndex ?? groupIdx;
        const physicalChild = externalCallUtxoGroups[physicalGroupIndex];
        const physicalMaster = nestedMasterIndices[physicalGroupIndex];
        if (physicalMaster === undefined || physicalMaster < 0) return -1n;
        const implCategoryId = lowLevelCallUtxoGroups[delegateGroup]?.categoryId;
        if (implCategoryId) {
          pendingDelegateInputFills.push({
            group: physicalChild,
            name: '__internal__delegateInputIndex',
            categoryId: implCategoryId,
          });
        }
        return BigInt(nestedProxyImplementationInputIndex(
          physicalMaster,
          physicalChild.dataNftUtxos.length,
        ));
      }
      if (input.name === '__internal__proxyMasterIndex') {
        // `childFn` may be the implementation ABI selected for a physical proxy group. Its state operations
        // remain rooted at that proxy group's master, not at the co-spent implementation input.
        const physicalGroupIndex = child.sharedGroupIndex ?? groupIdx;
        return BigInt(nestedMasterIndices[physicalGroupIndex]);
      }
      if (input.name === '__internal__externalCallInputBase') {
        const firstNestedGroupIndex = childNestedGroupIndexForSlot(0);
        if (firstNestedGroupIndex !== undefined) {
          const nested = externalCallUtxoGroups[firstNestedGroupIndex];
          const physical = externalCallUtxoGroups[nested.sharedGroupIndex ?? firstNestedGroupIndex];
          childExternalCallInputPositions.push({ name: input.name, categoryId: physical.categoryId });
          return BigInt(nestedMasterIndices[firstNestedGroupIndex]);
        }
        const physicalGroupIndex = child.sharedGroupIndex ?? groupIdx;
        const childBlockSize = externalCallUtxoGroups[physicalGroupIndex].blockInputs?.length
          ?? externalCallUtxoGroups[physicalGroupIndex].blockLayout?.blockSize
          ?? 1 + externalCallUtxoGroups[physicalGroupIndex].dataNftUtxos.length;
        return BigInt(nestedMasterIndices[physicalGroupIndex] + childBlockSize);
      }
      const masterWitness = input.name.match(/^__internal__extcallMasterIdx(\d*)$/);
      if (masterWitness) {
        const slot = masterWitness[1] === '' ? 0 : Number(masterWitness[1]);
        const nestedGroupIndex = childNestedGroupIndexForSlot(slot);
        if (nestedGroupIndex === undefined) return -1n;
        const nested = externalCallUtxoGroups[nestedGroupIndex];
        const physicalGroupIndex = nested.sharedGroupIndex ?? nestedGroupIndex;
        childExternalCallInputPositions.push({
          name: input.name,
          categoryId: externalCallUtxoGroups[physicalGroupIndex].categoryId,
        });
        return BigInt(nestedMasterIndices[physicalGroupIndex]);
      }
      const selectorWitness = input.name.match(/^__internal__externalCallSelector(\d*)$/);
      if (selectorWitness) {
        const slot = selectorParamSlot(input.name, childFn.externalCalls);
        const call = childFn.externalCalls?.[slot];
        const nestedGroupIndex = childNestedGroupIndexForSlot(slot);
        // Pin the selector on the physical co-spend. Shared logical calls inherit the first group's proxy
        // delegate, and a compiler-batched delegate unlocks with the route selector (`SCB1`), not a row selector.
        const selected = physicalExternalCallSelectorHex(
          externalCallUtxoGroups, lowLevelCallUtxoGroups, nestedGroupIndex,
        );
        if (selected) return hexToBin(selected);
        const interfaces = (child.externalContract.inner.artifact.externalInterfaces ?? []) as readonly {
          name: string;
          abi: readonly { name: string; selector?: string }[];
        }[];
        const target = interfaces.find((candidate) => candidate.name === call?.interfaceName)
          ?.abi.find((candidate) => candidate.name === call?.functionName);
        return target?.selector ? hexToBin(target.selector) : new Uint8Array(4);
      }
      const returnWitness = input.name.match(/^__internal__externalReturnOutputIdx(\d*)$/);
      if (returnWitness) {
        const slot = externalReturnParamSlot(input.name, childFn.externalCalls);
        if (slot === undefined) return -1n;
        const nestedGroupIndex = childNestedGroupIndexForSlot(slot);
        const occurrence = childFn.externalCalls?.[slot]?.occurrence;
        if (nestedGroupIndex === undefined) return -1n;
        if (occurrence && occurrence !== 'once' && nestedGroupIndex === undefined) return -1n;
        const returnGroupIndex = logicalReturnGroupIndex(
          externalCallUtxoGroups, nestedGroupIndex,
        );
        child.returnWitnessGroups = {
          ...child.returnWitnessGroups,
          [input.name]: returnGroupIndex,
        };
        return BigInt(physicalReturnIndexForGroup.get(returnGroupIndex) ?? -1);
      }
      const returnPreimageWitness = input.name.match(/^__internal__externalReturnPreimage(\d*)$/);
      if (returnPreimageWitness) {
        const outputIndexName = input.name.replace('externalReturnPreimage', 'externalReturnOutputIdx');
        const slot = externalReturnParamSlot(outputIndexName, childFn.externalCalls);
        const nestedGroupIndex = slot === undefined ? undefined : childNestedGroupIndexForSlot(slot);
        if (nestedGroupIndex === undefined) return new Uint8Array();
        const returnGroupIndex = logicalReturnGroupIndex(externalCallUtxoGroups, nestedGroupIndex);
        child.returnPreimageWitnessGroups = {
          ...child.returnPreimageWitnessGroups, [input.name]: returnGroupIndex,
        };
        return externalCallUtxoGroups[returnGroupIndex]?.precomputedReturnCommitment
          ?? new Uint8Array();
      }
      const callInputWitness = input.name.match(/^__internal__callInputIndex(\d*)$/);
      if (callInputWitness) {
        const callIndex = callInputWitness[1] === '' ? 0 : Number(callInputWitness[1]);
        const lowLevelCall = childFn.lowLevelCalls?.[callIndex] as {
          target?: { kind?: string; name?: string };
          targetSource?: { kind?: string; paramIndex?: number };
        } | undefined;
        const nestedGroups = childNestedGroups;
        const targetName = lowLevelCall?.target?.name;
        const targetSlot = targetName === undefined ? -1 : (childFn.externalCalls ?? [])
          .findIndex((call) => call.addressParam === targetName
            || call.addressParam?.endsWith(`_${targetName}`));
        const visibleArgs = child.compilerRoute?.args ?? selectVisibleCallArguments(
          childFn.inputs, child.logicalFunctionArgs, child.functionArgs,
        );
        const targetLock = lowLevelCall?.targetSource?.kind === 'forward'
          && lowLevelCall.targetSource.paramIndex !== undefined
          ? addressArgumentLockingBytecodeHex(visibleArgs[lowLevelCall.targetSource.paramIndex])
          : targetSlot < 0 ? undefined
            : externalCallTargetSourceLockingBytecodeHex(childFn, targetSlot, visibleArgs);
        const explicitTarget = participantGroupForTarget(
          externalCallUtxoGroups, nestedGroups, targetLock,
        );
        const computedTarget = lowLevelCall?.target?.kind === 'computed'
          ? computedStateWriterGroupIndex(
            externalCallUtxoGroups, nestedGroups,
            (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)?.messageBusConvention,
          )
          : undefined;
        const nestedGroupIndex = explicitTarget ?? computedTarget
          ?? (targetSlot >= 0 ? childNestedGroupIndexForSlot(targetSlot) : nestedGroups[callIndex]);
        if (nestedGroupIndex === undefined) return -1n;
        const nested = externalCallUtxoGroups[nestedGroupIndex];
        const physicalGroupIndex = nested.sharedGroupIndex ?? nestedGroupIndex;
        childExternalCallInputPositions.push({
          name: input.name,
          categoryId: externalCallUtxoGroups[physicalGroupIndex].categoryId,
        });
        return BigInt(nestedMasterIndices[physicalGroupIndex]);
      }
      if (input.name.startsWith('__internal__vmapBatch')
        || input.name.startsWith('__internal__valueWitness_')) {
        const value = child.compilerRoute?.internalArgs?.[input.name] ?? child.internalArgs?.[input.name];
        if (value !== undefined) {
          // Proof positions remain callee-master-relative: the covenant adds OP_INPUTINDEX. Predecessor
          // outputs are read directly with OP_OUTPUT*, so nested composition must publish their absolute
          // transaction index. Shared logical calls use the physical group's single output block.
          if (/^__internal__vmapBatchPredOut_\d+$/.test(input.name)
            && typeof value === 'bigint' && value >= 0n) {
            const physicalGroupIndex = child.sharedGroupIndex ?? groupIdx;
            const physical = externalCallUtxoGroups[physicalGroupIndex];
            const trailingBase = groupLayoutTrailingBase(physical ?? child);
            const master = nestedMasterIndices[physicalGroupIndex] ?? 0;
            return resolveAbsolutePredOut(
              value,
              master,
              trailingBase,
              relocatedPredOutBase.get(physicalGroupIndex) ?? physical?.relocatedPredOutBase,
            );
          }
          return value;
        }
        if (input.name.startsWith('__internal__valueWitness_')) return new Uint8Array();
        if (/^__internal__vmapBatchRank_\d+$/.test(input.name)) return 0n;
        if (input.name.startsWith('__internal__vmapBatchRows_')) return new Uint8Array();
        if (/^__internal__vmapBatchSlot_\d+$/.test(input.name)) return new Uint8Array(32);
        if (/^__internal__vmapBatchNext_\d+$/.test(input.name)) return new Uint8Array(32);
        if (/^__internal__vmapBatchProof_\d+$/.test(input.name)) return -1n;
        if (/^__internal__vmapBatchPredOut_\d+$/.test(input.name)) return -2n;
        if (input.name === '__internal__vmapBatchTrailingCount') return 0n;
      }
      const anchorWitness = input.name.match(/^__internal__extcallAnchorIdx(\d+)$/);
      if (anchorWitness) {
        const slot = Number(anchorWitness[1]);
        const band = childAnchorBandBySlot.get(slot);
        if (band === undefined) {
          return directNestedIdentityWitness(childFn, slot, childNestedGroupIndexForSlot(slot));
        }
        childAnchorFillPositions.push({
          argIndex: inputIndex,
          name: input.name,
          band,
          proxyRoute: childProxyAnchorSlots.has(slot),
        });
        return -1n; // patched once the builder materializes input positions
      }
      throw new Error(
        `Unsupported SDK-filled nested delegate callee parameter '${input.name}' on ${child.functionName}.`,
      );
    });
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_NESTED_PAY === '1' && child.functionName === 'pay') {
      console.error('nested-pay-args', childFn.inputs.map((input, index) => ({
        name: input.name,
        value: encoded[index] instanceof Uint8Array ? binToHex(encoded[index]) : String(encoded[index]),
      })), {
        groupIdx,
        delegateGroupIndex: child.delegateCallGroupIndex,
        nestedGroups: child.delegateCallGroupIndex === undefined ? []
          : delegateExternalGroupIndices.get(child.delegateCallGroupIndex),
        masters: nestedMasterIndices,
        returns: [...physicalReturnIndexForGroup],
        groups: externalCallUtxoGroups.map((group, index) => ({
          index,
          categoryId: group.categoryId.slice(0, 16),
          functionName: group.functionName,
          sharedGroupIndex: group.sharedGroupIndex,
          delegateCallGroupIndex: group.delegateCallGroupIndex,
          ec: (allGroupEcSlots[index] as ExternalCallAbi | undefined)?.functionName,
          callsiteId: (allGroupEcSlots[index] as ExternalCallAbi | undefined)?.callsiteId,
          parent: allGroupParentIndices[index],
        })),
      });
    }
    // For a proxied callee, compilerRoute describes the co-spent implementation and the proxy master still
    // executes its ordinary __forward entry. The implementation group below owns the route unlocker.
    const childUnlocker = child.compilerRoute && child.delegateCallGroupIndex === undefined
      ? child.externalContract.inner.createCompilerRouteUnlocker(
        child.compilerRoute.abiFunction, child.compilerRoute.selector,
      )(...encoded)
      : child.externalContract.inner.unlock[child.functionName]!(...encoded);
    child.masterUtxo = { ...child.masterUtxo, unlocker: childUnlocker } as UnlockableUtxo;
    if (child.blockInputs) {
      let childDataIndex = 0;
      for (const slot of child.blockLayout?.slots ?? []) {
        if (slot.kind === 'master' && slot.offset === 0) {
          child.blockInputs[slot.offset] = child.masterUtxo as UnlockableUtxo;
        } else if (slot.kind === 'dataNft'
          && slot.offset > 0 && slot.offset <= child.dataNftUtxos.length) {
          child.blockInputs[slot.offset] = child.dataNftUtxos[childDataIndex++];
        }
      }
    }
    const capturedChildArgs = encoded;
    child.internalArgNames = Object.freeze(childFn.inputs.map((input) => input.name));
    child.refreshInternalArgs = (updates, options) => {
      child.internalArgs = { ...child.internalArgs, ...updates };
      const returnIdx = childFn.inputs.findIndex((input) => input.name === '__internal__returnOutputIdx');
      const previousReturn = returnIdx >= 0 && typeof capturedChildArgs[returnIdx] === 'bigint'
        ? Number(capturedChildArgs[returnIdx]) : undefined;
      for (const [name, value] of Object.entries(updates)) {
        const index = childFn.inputs.findIndex((input) => input.name === name);
        if (index >= 0) capturedChildArgs[index] = value;
      }
      if (options?.shiftPredOut !== false
        && previousReturn !== undefined && typeof updates.__internal__returnOutputIdx === 'bigint') {
        const delta = Number(updates.__internal__returnOutputIdx) - previousReturn;
        if (delta !== 0) {
          for (const [index, input] of childFn.inputs.entries()) {
            if (!/PredOut/.test(input.name) || typeof capturedChildArgs[index] !== 'bigint') continue;
            if (capturedChildArgs[index] < 0n) continue;
            if (updates[input.name] !== undefined) continue;
            capturedChildArgs[index] = (capturedChildArgs[index] as bigint) + BigInt(delta);
          }
        }
      }
      if (child.relocatedPredOutBase !== undefined) {
        const trailingBase = BigInt(groupLayoutTrailingBase(child));
        const predBase = BigInt(child.relocatedPredOutBase);
        let trailing = 0n;
        for (const [index, input] of childFn.inputs.entries()) {
          if (!/PredOut/.test(input.name) || typeof capturedChildArgs[index] !== 'bigint') continue;
          if (capturedChildArgs[index] < 0n) continue;
          if ((capturedChildArgs[index] as bigint) < trailingBase) continue;
          if ((capturedChildArgs[index] as bigint) >= predBase) continue;
          if (updates[input.name] !== undefined) continue;
          capturedChildArgs[index] = predBase + trailing;
          trailing += 1n;
        }
      }
      const unlocker = child.compilerRoute && child.delegateCallGroupIndex === undefined
        ? child.externalContract.inner.createCompilerRouteUnlocker(
          child.compilerRoute.abiFunction, child.compilerRoute.selector,
        )(...capturedChildArgs)
        : child.externalContract.inner.unlock[child.functionName]!(...capturedChildArgs);
      child.masterUtxo = { ...child.masterUtxo, unlocker } as UnlockableUtxo;
      if (child.blockInputs && child.blockLayout) {
        const masterOffset = child.blockLayout.slots.find((slot) => slot.kind === 'master')?.offset ?? 0;
        if (child.blockInputs[masterOffset]) {
          child.blockInputs[masterOffset] = child.masterUtxo as UnlockableUtxo;
        }
      }
    };
    child.refreshFunctionArgs = (nextArgs) => {
      const visibleInputs = childFn.inputs.filter((input) => !input.name.startsWith('__internal__'));
      if (visibleInputs.length !== nextArgs.length) {
        throw new Error(
          `Cannot refresh ${child.functionName}: expected ${visibleInputs.length} visible arguments, `
          + `received ${nextArgs.length}.`,
        );
      }
      child.functionArgs = [...nextArgs];
      let nextIndex = 0;
      for (const [inputIndex, input] of childFn.inputs.entries()) {
        if (input.name.startsWith('__internal__')) continue;
        capturedChildArgs[inputIndex] = nextArgs[nextIndex++];
      }
      child.refreshInternalArgs?.({});
    };
    if (childAnchorFillPositions.length > 0) {
      pendingAnchorFills.push({
        group: child,
        functionName: child.functionName,
        encodedArgs: encoded,
        positions: childAnchorFillPositions,
      });
    }
    if (childExternalCallInputPositions.length > 0) {
      child.mintingInputWitnessCategories = Object.fromEntries(
        childExternalCallInputPositions.map(({ name, categoryId }) => [name, categoryId]),
      );
      pendingExternalCallInputFills.push({
        group: child,
        positions: childExternalCallInputPositions,
      });
    }
  }
  host.timing('nested-unlockers-complete');

}
