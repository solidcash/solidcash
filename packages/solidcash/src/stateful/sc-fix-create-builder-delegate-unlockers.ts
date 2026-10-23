/**
 * phase-boundary extract: SC _createBuilder extract — fix low-level/delegate data-NFT unlockers
 * and encode synthetic args for each co-spent implementation group.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AbiFunction, Artifact, ExternalCallAbi } from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo } from '../interfaces.js';
import { createDataNftUnlocker, delegateImplMsgSenderCategory } from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  externalReturnParamSlot,
  groupIndexForExternalCallSlot,
  isSdkResolvedExternalCallTopologyWitness,
  isSdkResolvedParticipantStorageWitness,
  physicalExternalCallSelectorHex,
  participantGroupForTarget,
  selectorParamSlot,
  vmapBatchWitnessFallback,
} from './physical-external-call.js';
import {
  addressArgumentLockingBytecodeHex, externalCallTargetSourceLockingBytecodeHex,
} from './mapping-key-lookup.js';
import type { MessageBusRuntimeAbiFunction } from './sc-batch-raw.js';
import { logicalReturnGroupIndex } from './value-chunk-geometry.js';
import {
  groupLayoutTrailingBase,
  physicalDelegateSlotOffset,
  resolveAbsolutePredOut,
} from './writer-event-delegate-layout.js';
import { computedStateWriterGroupIndex } from './writer-group-selection.js';

/** True when the callee's caller subject is this contract's physical lock or its CREATE lock. */
export function rootOwnsCallerSubject(
  subjectLockingBytecode: string,
  authenticatedSelfAddress: Uint8Array,
  logicalCreateLock?: Uint8Array,
): boolean {
  const subject = subjectLockingBytecode.toLowerCase();
  if (subject === binToHex(authenticatedSelfAddress).toLowerCase()) return true;
  return logicalCreateLock !== undefined
    && subject === binToHex(logicalCreateLock).toLowerCase();
}

/**
 * Select the optional SCID input which represents a nested call's authenticated caller subject.
 *
 * A category can have both a physical minting master and one or more immutable SCID records. Category presence
 * alone therefore cannot select `msg.sender`: an owner call uses the physical master's locking bytecode even when
 * an SCID for that category is co-spent. A logical caller uses the one anchor whose own locking bytecode is the
 * compiler-resolved subject. Anything else is ambiguous or unauthenticated and must fail closed.
 */
export function callerIdentityAnchorBand(
  callerSubjectLockingBytecode: string,
  physicalCallerLockingBytecode: string,
  anchors: readonly { band: number; lockingBytecode: string }[],
): number | undefined {
  const subject = callerSubjectLockingBytecode.toLowerCase();
  const physical = physicalCallerLockingBytecode.toLowerCase();
  if (subject === physical) return undefined;
  const matches = anchors.filter((anchor) => anchor.lockingBytecode.toLowerCase() === subject);
  if (matches.length !== 1) {
    throw new Error(
      `Nested caller identity requires exactly one SCID anchor for ${subject}; found ${matches.length}.`,
    );
  }
  return matches[0]!.band;
}

/** Compiler-owned bytes witnesses used to fold chunkable array pushes across selected route rows. */
export function isRoutePushValueWitnessName(name: string): boolean {
  return /^__internal__(?:leading|complete)PushValue_\d+$/.test(name);
}

/** Resolve a route-fold witness without relying on its position among other hidden ABI arguments. */
export function resolveDelegatePushValueWitness(
  name: string,
  compilerRouteArgs: Readonly<Record<string, FunctionArgument>> | undefined,
  groupArgs: Readonly<Record<string, FunctionArgument>> | undefined,
  activeEntry: {
    inputs: readonly { name: string }[];
    args: readonly FunctionArgument[];
  } | undefined,
): FunctionArgument {
  const published = compilerRouteArgs?.[name] ?? groupArgs?.[name];
  if (published !== undefined) return published;
  const entryIndex = activeEntry?.inputs.findIndex((input) => input.name === name) ?? -1;
  return entryIndex < 0 ? new Uint8Array() : activeEntry!.args[entryIndex] ?? new Uint8Array();
}

/** Transaction-wide runtime-loop cardinality remainders: one input/output pair per mutated collection. */
export function isRuntimeLoopCardinalityName(name: string): boolean {
  return /^__internal__vmapRuntime(?:Input|Output)Count_/.test(name);
}

/**
 * Resolve a direct delegate build's runtime-loop cardinality by name from the entry frame the builder planned
 * (the summed loop widths a route would receive). Undefined when nothing was planned, so the caller fails closed.
 */
export function resolveDelegateRuntimeCardinality(
  name: string,
  activeEntry: {
    inputs: readonly { name: string }[];
    args: readonly FunctionArgument[];
  } | undefined,
): bigint | undefined {
  if (!isRuntimeLoopCardinalityName(name)) return undefined;
  const entryIndex = activeEntry?.inputs.findIndex((input) => input.name === name) ?? -1;
  const planned = entryIndex < 0 ? undefined : activeEntry!.args[entryIndex];
  return typeof planned === 'bigint' && planned >= 0n ? planned : undefined;
}

export type FixCreateBuilderDelegateUnlockersHost = {
  readonly categoryId: string;
  readonly selfContract: any;
  timing: (label: string) => void;
  resolveNestedIdentityAnchorBands: (...args: any[]) => Promise<{
    anchorBandBySlot: Map<number, any>;
    proxyAnchorSlots: Set<number>;
  }>;
  nestedFullState: (contract: any) => Promise<any>;
  selectProxyForwardInput: (...args: any[]) => FunctionArgument;
  directNestedIdentityWitness: (...args: any[]) => any;
};

/**
 * For each low-level/delegate group, rebuild data-NFT unlockers against the
 * correct master input index and encode synthetic internal args.
 */
export async function fixCreateBuilderDelegateUnlockers(
  host: FixCreateBuilderDelegateUnlockersHost,
  params: {
    lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
    externalCallUtxoGroups: ExternalCallUtxoGroup[];
    nestedDelegateProxyGroupByLowLevel: ReadonlyMap<number, number>;
    lowLevelCallInputBase: number;
    delegateExternalGroupIndices: Map<number, number[]>;
    delegateExternalGroupByCallsite: Map<number, Map<number, number>>;
    allGroupEcSlots: Array<ExternalCallAbi | { hasReturnValues?: boolean; requiredDataNftIndices: number[] }>;
    allGroupParentIndices: number[];
    physicalReturnIndexForGroup: Map<number, number>;
    nestedMasterIndices: number[];
    nestedOutputBases: number[];
    relocatedPredOutBase: Map<number, number>;
    pendingDelegateInputFills: any[];
    pendingAnchorFills: any[];
    pendingExternalCallInputFills: any[];
    entryAbiFunction: AbiFunction | undefined;
    timingEnabled: boolean;
    [key: string]: any;
  },
): Promise<void> {
  const {
    lowLevelCallUtxoGroups, externalCallUtxoGroups, nestedDelegateProxyGroupByLowLevel,
    lowLevelCallInputBase, delegateExternalGroupIndices, delegateExternalGroupByCallsite,
    allGroupEcSlots, allGroupParentIndices, physicalReturnIndexForGroup,
    nestedMasterIndices, nestedOutputBases,
    pendingDelegateInputFills, pendingAnchorFills, pendingExternalCallInputFills,
    entryAbiFunction,
  } = params;
  const resolveNestedIdentityAnchorBands = host.resolveNestedIdentityAnchorBands;
  const nestedFullState = host.nestedFullState;
  const directNestedIdentityWitness = host.directNestedIdentityWitness;
  const timingEnabled = params.timingEnabled;
  const publicSelfAddress = params.publicSelfAddress;
  const authenticatedSelfAddress = params.authenticatedSelfAddress as Uint8Array | undefined
    ?? publicSelfAddress;
  const compilerRouteDelegateLayout = params.compilerRouteDelegateLayout;
  const returnEmitOutputIndex = params.returnEmitOutputIndex as number;
  const groupProxyMasterIndices = params.groupProxyMasterIndices as any;
  const overrides = params.overrides as { blockBase?: number } | undefined;
  const entryBatchWitnesses = params.entryBatchWitnesses as any;
  const entryValueWitnesses = params.entryValueWitnesses as any;
  const pendingDynamicChunkInputFills = params.pendingDynamicChunkInputFills as any[];
  const pendingTokenCallInputFills = params.pendingTokenCallInputFills as any[];
  const identityAnchors = params.identityAnchors as UnlockableUtxo[];
  const entryArgs = params.entryArgs as FunctionArgument[];
  const entryArtifact = params.entryArtifact as Artifact;
  // Keep debug lookups live without capturing mutable globals in the per-group argument mapper.
  const debugEnv = (): Record<string, string> | undefined =>
    (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
  const debugLog = (...args: unknown[]): void => { console.error(...args); };

  // Fix data NFT unlockers with correct master input index
  let currentBase = lowLevelCallInputBase;
  for (let groupLocalIdx = 0; groupLocalIdx < lowLevelCallUtxoGroups.length; groupLocalIdx++) {
    const group = lowLevelCallUtxoGroups[groupLocalIdx];
    if (timingEnabled) console.error('delegate-unlocker-group-start', {
      groupLocalIdx,
      functionName: group.functionName,
      route: group.compilerRoute?.abiFunction.name,
      routeRows: group.compilerRoute?.rowArguments?.length,
      routeBlobBytes: group.compilerRoute?.blob.length,
      routeArgs: group.compilerRoute?.args.length,
    });
    const delegateProxyExternalGroup = nestedDelegateProxyGroupByLowLevel.get(groupLocalIdx);
    const proxyPhysicalSize = delegateProxyExternalGroup === undefined ? 0
      : (externalCallUtxoGroups[delegateProxyExternalGroup].blockInputs?.length
        ?? 1 + externalCallUtxoGroups[delegateProxyExternalGroup].dataNftUtxos.length);
    // A route block lays every implementation out contiguously right after the block, ahead of the callee
    // band, so `currentBase` already names this one. Only the legacy interleaved layout puts a nested
    // proxy's implementation after that proxy's own block.
    const delegateProxyGroup = delegateProxyExternalGroup === undefined
      ? undefined : externalCallUtxoGroups[delegateProxyExternalGroup];
    const delegateOutgoingSelfAddress = delegateProxyGroup === undefined
      ? publicSelfAddress
      : hexToBin(delegateProxyGroup.externalContract.inner.lockingBytecode);
    const embeddedDelegateOffset = delegateProxyGroup?.delegateEmbeddedInBlock
      ? delegateProxyGroup.blockInputs?.findIndex((input) => input !== undefined
        && input.txid.toLowerCase() === group.masterUtxo!.txid.toLowerCase()
        && input.vout === group.masterUtxo!.vout)
      : undefined;
    const masterInputIndex = embeddedDelegateOffset !== undefined && embeddedDelegateOffset >= 0
      ? nestedMasterIndices[delegateProxyExternalGroup!] + embeddedDelegateOffset
      : delegateProxyExternalGroup === undefined || compilerRouteDelegateLayout
        ? currentBase : nestedMasterIndices[delegateProxyExternalGroup] + proxyPhysicalSize;
    group.dataNftUtxos = group.dataNftUtxos.map((nftUtxo) => ({
      ...nftUtxo,
      unlocker: createDataNftUnlocker(
        group.externalContract.inner, masterInputIndex, group.categoryId,
      ),
    }));

    // Create master UTXO unlocker with function args
    const bArt = group.externalContract.inner.artifact;
    type BAbiEntry = { name: string; selector?: string; inputs: readonly { name: string; type: string }[] };
    const bAbi = bArt.abi as readonly BAbiEntry[];
    // Pick the overload by visible arity, matching how Contract.unlock dispatches. Taking the first
    // same-name entry would compute the synthetic-arg injection from a different overload than the one the
    // unlocker then selects.
    const bSameName = bAbi.filter((f) => f.name === group.functionName);
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
      console.error('delegate-function-selection', {
        groupLocalIdx, contract: bArt.contractName, functionName: group.functionName,
        functionArgCount: group.functionArgs.length,
        compilerRouteArgCount: group.compilerRoute?.args.length,
        candidates: bSameName.map((f) => f.inputs
          .filter((inp) => !inp.name.startsWith('__internal__')).length),
      });
    }
    const bFunc = group.compilerRoute?.abiFunction ?? bSameName.find((f) => f.inputs
      .filter((inp) => !inp.name.startsWith('__internal__')).length === group.functionArgs.length)
      ?? bSameName[0];
    if (bFunc) {
      const batchProofInputOffset = (offset: bigint): bigint => BigInt(masterInputIndex
        + physicalDelegateSlotOffset(
          (bFunc as AbiFunction).blockLayout, Number(offset), bArt.delegateOnly === true,
        ));
      const activeEntryDelegate = entryAbiFunction?.name === group.functionName
        && (group.logicalArtifact ?? bArt).contractName === entryArtifact.contractName
        ? { inputs: entryAbiFunction.inputs, args: entryArgs }
        : undefined;
      // Persist UPDATE can seed compilerRoute.args from the last stored JobEvent
      // (Closed). Compiler-published argSources / logicalFunctionArgs are the emit
      // identity (withdrawCollateral type 16, not closeJob type 7).
      const visibleFunctionArgs = ((group.logicalFunctionArgs?.length ?? 0) > 0
        ? group.logicalFunctionArgs
        : (group.functionArgs?.length ?? 0) > 0
          ? group.functionArgs
          : group.compilerRoute?.args) ?? [];
      let visibleIndex = 0;
      let delegateReturnWitnessIndex = 0;
      let delegateCallInputWitnessIndex = 0;
      const tokenCallInputPositions: number[] = [];
      const tokenReturnPositions: number[] = [];
      const tokenReturnWidths: number[] = [];
      const externalCallInputPositions: { name: string; categoryId: string }[] = [];
      let tokenCallInputCategory: string | undefined;
      let tokenCallGroup: typeof externalCallUtxoGroups[number] | undefined;
      const nestedGroups = delegateExternalGroupIndices.get(groupLocalIdx) ?? [];
      // Conditional callsites are omitted from `nestedGroups`, so its compact position is not necessarily the
      // compiler's stable callsite/hidden-witness suffix. Prefer the callsite map and retain positional lookup
      // only for older artifacts which did not publish callsite IDs.
      const nestedGroupIndexForSlot = (slot: number): number | undefined => (
        groupIndexForExternalCallSlot({
          slot,
          externalCalls: (bFunc as AbiFunction).externalCalls,
          groupByCallsite: delegateExternalGroupByCallsite.get(groupLocalIdx),
          compactGroups: nestedGroups,
        })
      );
      // Resolve logical-to-physical identity once for every nested call shape. The absolute anchor input
      // index remains deferred until the builder has materialized all layout bands.
      const { anchorBandBySlot, proxyAnchorSlots } = await resolveNestedIdentityAnchorBands(
        bFunc as AbiFunction,
        visibleFunctionArgs,
        nestedGroupIndexForSlot,
        await (async () => {
          const contract = (delegateProxyGroup?.logicalContract
            ?? delegateProxyGroup?.externalContract ?? host.selfContract) as any;
          return {
            contract,
            artifact: (group.logicalArtifact ?? bArt) as Artifact,
            state: (await nestedFullState(contract)).state,
            executionSelfAddress: delegateOutgoingSelfAddress,
          };
        })(),
      );
      const anchorFillPositions: {
        argIndex: number; name: string; band?: number; categoryId?: string; proxyRoute: boolean;
      }[] = [];
      if (timingEnabled) console.error('delegate-args-map-start', {
        groupLocalIdx, inputs: bFunc.inputs.length, visibleArgs: visibleFunctionArgs.length,
      });
      const encodeVisibleArg = (value: unknown, type: string): any => {
        if (typeof value === 'string'
          && (type === 'address' || type === 'address payable' || type.startsWith('address '))) {
          return encodeFunctionArgument(value, type, bArt.structs);
        }
        return value;
      };
      const encodedArgs: any[] = bFunc.inputs.map((inp, inpIndex) => {
        if (inp.name === '__internal__messageBusOwnerBandInput') {
          // A delegated route's owner band names the physical proxy state block, not its implementation
          // executor. Resolve it from the finalized input layout just like __internal__proxyMasterIndex.
          const proxyExternalGroup = nestedDelegateProxyGroupByLowLevel.get(groupLocalIdx);
          return BigInt(proxyExternalGroup === undefined
            ? groupProxyMasterIndices[groupLocalIdx] ?? masterInputIndex
            : nestedMasterIndices[proxyExternalGroup] ?? masterInputIndex);
        }
        if (/^__internal__externalReturnPreimage\d*$/.test(inp.name)) {
          const outputIndexName = inp.name.replace('externalReturnPreimage', 'externalReturnOutputIdx');
          const slot = externalReturnParamSlot(outputIndexName, (bFunc as AbiFunction).externalCalls);
          const nestedGroup = slot === undefined ? undefined : nestedGroupIndexForSlot(slot);
          if (nestedGroup === undefined) return new Uint8Array();
          group.returnPreimageWitnessGroups = {
            ...group.returnPreimageWitnessGroups, [inp.name]: nestedGroup,
          };
          return externalCallUtxoGroups[nestedGroup]?.precomputedReturnCommitment
            ?? new Uint8Array();
        }
        if (/^__internal__externalReturnOutputIdx\d*$/.test(inp.name)) {
          const nestedReturning = nestedGroups.filter((idx) => allGroupEcSlots[idx]?.hasReturnValues);
          const returnOrdinal = delegateReturnWitnessIndex;
          const slot = externalReturnParamSlot(inp.name, (bFunc as AbiFunction).externalCalls);
          const publishedCallsite = slot === undefined
            ? undefined : (bFunc as AbiFunction).externalCalls?.[slot]?.callsiteId;
          const occurrence = slot === undefined
            ? undefined : (bFunc as AbiFunction).externalCalls?.[slot]?.occurrence;
          const nestedGroup = (slot === undefined ? undefined : nestedGroupIndexForSlot(slot))
            ?? (publishedCallsite === undefined
              ? nestedReturning[returnOrdinal] : undefined);
          delegateReturnWitnessIndex += 1;
          // Omitted conditionals must not inherit a probe/graph return index.
          // Decrease updateJobPost left idx2 at 20, so the return pin EQUALVERIFYed
          // a jobEvents chunk (mutable leftover 0x01) against an empty capability.
          if (nestedGroup === undefined && occurrence && occurrence !== 'once') {
            if (debugEnv()?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
              debugLog('omit-conditional-return', { input: inp.name, slot, occurrence });
            }
            return -1n;
          }
          if (debugEnv()?.SOLIDC_DEBUG_RETURN === '1') {
            debugLog('external-return-witness-fill', {
              input: inp.name,
              groupLocalIdx,
              nestedGroups,
              nestedReturning,
              nestedGroup,
              physicalReturnIndex: nestedGroup === undefined
                ? undefined : physicalReturnIndexForGroup.get(nestedGroup),
              calls: nestedGroups.map((idx) => ({ idx,
                returns: allGroupEcSlots[idx]?.hasReturnValues })),
            });
          }
          if (nestedGroup !== undefined) {
            tokenReturnPositions.push(inpIndex);
            tokenReturnWidths.push(Math.max(
              1,
              externalCallUtxoGroups[nestedGroup].loopReturnCommitments?.length ?? 1,
            ));
            // Always the logical group. assignedReturns is keyed per callsite; storing the
            // a fused writer refreshed one participant's first index onto another's commitment.
            group.returnWitnessGroups = {
              ...group.returnWitnessGroups,
              [inp.name]: nestedGroup,
            };
            const planned = physicalReturnIndexForGroup.get(
              logicalReturnGroupIndex(externalCallUtxoGroups, nestedGroup),
            );
            if (planned !== undefined) return BigInt(planned);
          }
          const graphOwned = group.compilerRoute?.internalArgs?.[inp.name]
            ?? group.compilerRoute?.args[inpIndex];
          if (graphOwned !== undefined) return graphOwned;
          return -1n;
        }
        const graphFixedSize = group.compilerRoute?.internalArgs?.__internal__graphFixedSize;
        // Repeated routes are first built with a -1 graph sentinel while the SDK discovers their call tree.
        // Only the atomic composer publishes a non-negative fixed size and a complete ABI-positioned frame.
        // Before that point, resolve visible and storage witnesses through the ordinary compact route path.
        const graphCompilerRoute = typeof graphFixedSize === 'bigint' && graphFixedSize >= 0n;
        if (graphCompilerRoute
          && !isSdkResolvedExternalCallTopologyWitness(inp.name)
          && !isSdkResolvedParticipantStorageWitness(inp.name)) {
          // Atomic routes already carry a complete ABI-positioned argument vector. Treating it as the
          // visible-only argument list shifts every non-internal witness following the first graph field
          // (an address key then receives a bigint). Graph-owned internal values may be refreshed by name;
          // every other position remains exactly compilerRoute.args[inpIndex].
          // Compiler-route args retain the compact visible-only frame during graph discovery. Consume every
          // visible argument sequentially; graph-owned internal values are addressed by name below. Treating
          // the compact frame as ABI-positioned shifts the first route witness by the graph-field count.
          if (!inp.name.startsWith('__internal__')) {
            return encodeVisibleArg(visibleFunctionArgs[visibleIndex++], inp.type);
          }
          // Graph composition publishes a complete fallback vector, but state/resource witnesses are derived
          // from the materialized participant block and live on the physical group. Prefer those newer values
          // by name; otherwise inactive route defaults overwrite authenticated vmap and chunk witnesses.
          // Physical external-call coordinates are excluded above and retain their late-layout resolver.
          const owned = group.internalArgs?.[inp.name]
            ?? group.compilerRoute?.internalArgs?.[inp.name]
            ?? group.compilerRoute?.args[inpIndex];
          return inp.name.startsWith('__internal__') ? owned : encodeVisibleArg(owned, inp.type);
        }
        if (!inp.name.startsWith('__internal__')) {
          return encodeVisibleArg(visibleFunctionArgs[visibleIndex++], inp.type);
        }
        const compilerOwnedWitness = group.compilerRoute?.internalArgs?.[inp.name];
        if (compilerOwnedWitness !== undefined
          && inp.name !== '__internal__graphSelfIdentityInput'
          && !isSdkResolvedExternalCallTopologyWitness(inp.name)
          && !isSdkResolvedParticipantStorageWitness(inp.name)) return compilerOwnedWitness;
        if (inp.name === '__internal__returnOutputIdx') {
          const proxyExternalGroup = nestedDelegateProxyGroupByLowLevel.get(groupLocalIdx);
          return BigInt(proxyExternalGroup === undefined
            ? returnEmitOutputIndex
            : physicalReturnIndexForGroup.get(proxyExternalGroup) ?? -1);
        }
        if (inp.name === '__internal__valueChunkOutputBase') {
          const proxyExternalGroup = nestedDelegateProxyGroupByLowLevel.get(groupLocalIdx);
          if (proxyExternalGroup === undefined) return -1n;
          const physical = externalCallUtxoGroups[
            externalCallUtxoGroups[proxyExternalGroup]?.sharedGroupIndex ?? proxyExternalGroup
          ];
          const base = physical?.valueChunkOutputBase
            ?? physical?.internalArgs?.__internal__valueChunkOutputBase;
          if (typeof base === 'number' && base >= 0) return BigInt(base);
          if (typeof base === 'bigint' && base >= 0n) return base;
          return -1n;
        }
        // Finalized after the builder has placed the exact selected chunk UTXOs. A sentinel is safe for an
        // empty persisted value because the generated loop performs no transaction introspection.
        if (inp.name === '__internal__dynamicChunkInputBase') return -1n;
        if (inp.name === '__internal__dynamicChunkOutputBase') return -1n;
        // Standalone route execution has no atomic verifier region. The compiler uses the same negative
        // sentinel as _batchRaw to skip its optional verifier binder; graph composition replaces it with
        // the finalized verifier input through the complete compiler-owned argument vector above.
        if (inp.name === '__internal__activeVerifierIndex' || inp.name === '__internal__participantBlockSize') {
          return -1n;
        }
        if (inp.name === '__internal__msgSenderCategory') {
          // A top-level `call` / `staticcall` runs the callee as itself, called BY this contract, so its msg.sender is
          // this contract: the one co-spent minting master of this category. Only a delegatecall keeps its caller's.
          if (group.callMode !== 'delegatecall' && !nestedDelegateProxyGroupByLowLevel.has(groupLocalIdx)) {
            return hexToBin(host.categoryId).reverse();
          }
          const nestedProxyGroup = nestedDelegateProxyGroupByLowLevel.has(groupLocalIdx)
            ? externalCallUtxoGroups[nestedDelegateProxyGroupByLowLevel.get(groupLocalIdx)!]
            : undefined;
          return delegateImplMsgSenderCategory(
            nestedProxyGroup?.categoryId,
            nestedProxyGroup?.callerIdentity?.categoryId ?? host.categoryId,
          );
        }
        if (inp.name === '__internal__msgSenderAnchorIdx') {
          const nestedProxyGroupIndex = nestedDelegateProxyGroupByLowLevel.get(groupLocalIdx);
          // A root proxy implementation preserves tx.origin, so it needs no SCID witness. A nested proxy
          // preserves its caller's logical identity across the delegate boundary; authenticate that exact
          // subject only when it differs from the physical parent which is already co-spent.
          if (nestedProxyGroupIndex === undefined) return -1n;
          const nestedProxyGroup = externalCallUtxoGroups[nestedProxyGroupIndex];
          const parentGroupIndex = allGroupParentIndices[nestedProxyGroupIndex];
          const physicalCallerLockingBytecode = parentGroupIndex !== undefined && parentGroupIndex >= 0
            ? externalCallUtxoGroups[parentGroupIndex]?.externalContract.inner.lockingBytecode
              ?? binToHex(publicSelfAddress)
            : binToHex(publicSelfAddress);
          const callerSubjectLockingBytecode = nestedProxyGroup.callerIdentity?.lockingBytecode
            ?? physicalCallerLockingBytecode;
          const needsAnchor = callerSubjectLockingBytecode.toLowerCase()
            !== physicalCallerLockingBytecode.toLowerCase();
          const rootLogicalCaller = needsAnchor
            && (parentGroupIndex === undefined || parentGroupIndex < 0)
            && rootOwnsCallerSubject(
              callerSubjectLockingBytecode, authenticatedSelfAddress, params.logicalCreateLock,
            );
          const band = needsAnchor && !rootLogicalCaller
            ? callerIdentityAnchorBand(
              callerSubjectLockingBytecode,
              physicalCallerLockingBytecode,
              identityAnchors.map((anchor, anchorBand) => ({
                band: anchorBand,
                lockingBytecode: binToHex(anchor.unlocker.generateLockingBytecode()),
              })),
            ) : undefined;
          if (rootLogicalCaller) {
            anchorFillPositions.push({
              argIndex: inpIndex, name: inp.name,
              categoryId: nestedProxyGroup.callerIdentity?.categoryId ?? host.categoryId,
              proxyRoute: false,
            });
          } else if (band !== undefined) {
            anchorFillPositions.push({
              argIndex: inpIndex, name: inp.name, band, proxyRoute: false,
            });
          }
          return -1n;
        }
        if (inp.name === '__internal__proxyMasterIndex') {
          const proxyExternalGroup = nestedDelegateProxyGroupByLowLevel.get(groupLocalIdx);
          const resolvedProxyMaster = proxyExternalGroup === undefined
            ? groupProxyMasterIndices[groupLocalIdx] ?? 0
            : nestedMasterIndices[proxyExternalGroup];
          const proxyCategoryId = proxyExternalGroup === undefined ? undefined
            : externalCallUtxoGroups[
              externalCallUtxoGroups[proxyExternalGroup]?.sharedGroupIndex ?? proxyExternalGroup
            ]?.categoryId;
          if (proxyCategoryId) {
            pendingDelegateInputFills.push({
              group,
              name: '__internal__proxyMasterIndex',
              categoryId: proxyCategoryId,
            });
            pendingDelegateInputFills.push({
              group,
              name: '__internal__proxyMasterOutputIndex',
              categoryId: proxyCategoryId,
            });
          }
          if (debugEnv()?.SOLIDC_DEBUG_PROXY_BASE === '1') {
            debugLog('delegate-proxy-master-context', {
              groupLocalIdx,
              contract: bArt.contractName,
              functionName: group.functionName,
              mappedProxyExternalGroup: proxyExternalGroup,
              resolvedProxyMaster,
              groupProxyMasterIndex: groupProxyMasterIndices[groupLocalIdx],
              candidates: externalCallUtxoGroups.flatMap((candidate, candidateIndex) => (
                candidate.delegateCallGroupIndex === groupLocalIdx
                  ? [{
                    logicalGroup: candidateIndex,
                    physicalGroup: candidate.sharedGroupIndex ?? candidateIndex,
                    contract: candidate.externalContract.inner.artifact.contractName,
                    functionName: candidate.functionName,
                    categoryId: candidate.categoryId,
                    nestedMasterIndex: nestedMasterIndices[candidate.sharedGroupIndex ?? candidateIndex],
                    nestedOutputBase: nestedOutputBases[candidate.sharedGroupIndex ?? candidateIndex],
                  }]
                  : []
              )),
            });
          }
          return BigInt(resolvedProxyMaster);
        }
        if (inp.name === '__internal__proxyMasterOutputIndex') {
          const proxyExternalGroup = nestedDelegateProxyGroupByLowLevel.get(groupLocalIdx);
          if (debugEnv()?.SOLIDC_DEBUG_VMAP_PROOF === '1') {
            debugLog('proxy-master-output-context', {
              groupLocalIdx, compilerRoute: !!compilerRouteDelegateLayout,
              blockBase: overrides?.blockBase,
              proxyExternalGroup,
              nestedOutputBases,
            });
          }
          if (proxyExternalGroup !== undefined) {
            const proxyGroup = externalCallUtxoGroups[proxyExternalGroup];
            const physicalProxyGroup = proxyGroup.sharedGroupIndex ?? proxyExternalGroup;
            // Return channels belong to logical calls and may be fused or relocated independently of the
            // physical state block. Deriving the proxy base as `returnIndex - returnOffset` can therefore
            // point a nested implementation at the root block. The materialized physical group base is the
            // authoritative coordinate for every fixed proxy-state output.
            return BigInt(nestedOutputBases[physicalProxyGroup]);
          }
          // A compiler-route delegate is the implementation of THIS builder's proxy block. Its balanced
          // state outputs are rooted at the caller-supplied physical block base, not at any nested external
          // group which happens to carry one of the route's logical calls.
          if (compilerRouteDelegateLayout) {
            return BigInt(overrides?.blockBase ?? nestedOutputBases[0] ?? 0);
          }
          return BigInt(groupProxyMasterIndices[groupLocalIdx] ?? 0);
        }
        if (inp.name === '__internal__externalCallInputBase') {
          const firstNested = nestedGroups[0];
          if (firstNested !== undefined) {
            const nested = externalCallUtxoGroups[firstNested];
            const physical = externalCallUtxoGroups[nested.sharedGroupIndex ?? firstNested];
            externalCallInputPositions.push({ name: inp.name, categoryId: physical.categoryId });
          }
          // A lone conditional call with no co-spent callee was not made; its call site refuses a reached -1.
          const calls = ((bFunc as AbiFunction).externalCalls ?? []) as readonly (
            ExternalCallAbi & { occurrence?: string }
          )[];
          const skippedLone = calls.length === 1 && calls[0].occurrence === 'conditional' && !calls[0].loopArrayVar;
          return BigInt(firstNested === undefined
            ? skippedLone ? -1 : masterInputIndex + 1 + group.dataNftUtxos.length
            : nestedMasterIndices[firstNested]);
        }
        if (/^__internal__extcallMasterIdx\d*$/.test(inp.name)) {
          const suffix = inp.name.slice('__internal__extcallMasterIdx'.length);
          const slot = suffix === '' ? 0 : Number(suffix);
          const nestedGroup = nestedGroupIndexForSlot(slot);
          const call = (bFunc as AbiFunction).externalCalls?.[slot] as (
            ExternalCallAbi & { occurrence?: string }
          ) | undefined;
          if (nestedGroup !== undefined) {
            const nested = externalCallUtxoGroups[nestedGroup];
            const physical = externalCallUtxoGroups[nested.sharedGroupIndex ?? nestedGroup];
            externalCallInputPositions.push({ name: inp.name, categoryId: physical.categoryId });
          }
          return BigInt(nestedGroup === undefined
            ? call?.occurrence && call.occurrence !== 'once'
              ? -1 : masterInputIndex + 1 + group.dataNftUtxos.length
            : nestedMasterIndices[nestedGroup]);
        }
        const selectorWitness = inp.name.match(/^__internal__externalCallSelector(\d*)$/);
        if (selectorWitness) {
          // Single-call functions retain the historical unsuffixed name; multi-call functions use N.
          // The unsuffixed name is the unique needsSelectorVerification slot, not always 0.
          const slot = selectorParamSlot(inp.name, (bFunc as AbiFunction).externalCalls);
          const call = (bFunc as AbiFunction).externalCalls?.[slot];
          const nestedGroupIndex = call?.callsiteId === undefined ? undefined
            : delegateExternalGroupByCallsite.get(groupLocalIdx)?.get(call.callsiteId);
          // Multiple logical calls to one category share a single physical
          // covenant input. A later state-writing call can replace an earlier
          // view call as that input's selected function, so pin the selector
          // actually present in the composed input. Upgrade proxies select on
          // their co-spent delegate; direct stateful contracts select on the
          // shared external group itself.
          const physicalSelector = physicalExternalCallSelectorHex(
            externalCallUtxoGroups, lowLevelCallUtxoGroups, nestedGroupIndex,
          );
          if (physicalSelector) return hexToBin(physicalSelector);
          const interfaces = (bArt.externalInterfaces ?? []) as readonly {
            name: string;
            abi: readonly { name: string; selector?: string }[];
          }[];
          const iface = interfaces.find((candidate) => candidate.name === call?.interfaceName);
          const target = iface?.abi.find((candidate) => candidate.name === call?.functionName);
          return target?.selector ? hexToBin(target.selector) : new Uint8Array(4);
        }
        if (inp.name.startsWith('__internal__vmapBatch')) {
          // Atomic graph routes are first compiled with placeholder storage proofs. Only standalone routes
          // can own these values; graph participants resolve them from the final materialized UTXO block.
          const compilerRouteValue = graphCompilerRoute
            ? undefined
            : group.compilerRoute?.internalArgs?.[inp.name];
          if (compilerRouteValue !== undefined) {
            // Route batch proof offsets stay proxy-master-relative: the covenant adds its authenticated
            // proxy input index. Predecessor outputs are consumed directly by OP_OUTPUT*, so convert their
            // block-relative trailing offsets to absolute transaction output indices here.
            if (/^__internal__vmapBatchPredOut_\d+$/.test(inp.name)
              && typeof compilerRouteValue === 'bigint' && compilerRouteValue >= 0n) {
              // PredOut is an OP_OUTPUT* index. Proofs stay proxy-relative because the
              // covenant adds INPUTINDEX; predecessor outputs do not. Use the implementation
              // implementation master, not the proxy minting UTXO.
              const outputBase = masterInputIndex;
              const trailingBase = groupLayoutTrailingBase(group);
              return resolveAbsolutePredOut(
                compilerRouteValue,
                outputBase,
                trailingBase,
                group.relocatedPredOutBase,
              );
            }
            return compilerRouteValue;
          }
          // An ordinary nested callee owns its own batch witnesses. Do not consume the enclosing
          // contract's `entryBatchWitnesses`: those describe a different block (and can coincidentally
          // provide a valid-looking relative output such as slot 4). Proof inputs remain relative because
          // the generated covenant adds the authenticated participant master. Predecessor outputs are read
          // directly by OP_OUTPUT*, so only those are converted to absolute transaction coordinates.
          const groupInternalValue = group.internalArgs?.[inp.name];
          if (groupInternalValue !== undefined) {
            if (!graphCompilerRoute && /^__internal__vmapBatchProof_\d+$/.test(inp.name)
              && typeof groupInternalValue === 'bigint' && groupInternalValue >= 0n) {
              return batchProofInputOffset(groupInternalValue);
            }
            if (/^__internal__vmapBatchPredOut_\d+$/.test(inp.name)
              && typeof groupInternalValue === 'bigint' && groupInternalValue >= 0n) {
              return resolveAbsolutePredOut(
                groupInternalValue,
                masterInputIndex,
                groupLayoutTrailingBase(group),
                group.relocatedPredOutBase,
              );
            }
            return groupInternalValue;
          }
          const value = entryBatchWitnesses.get(inp.name);
          if (value !== undefined) {
            // The compiler adds the participant master to proof offsets. PredOut is the exception: its
            // OP_OUTPUT* consumers take an absolute coordinate and therefore require SDK-side resolution.
            if (!graphCompilerRoute && /^__internal__vmapBatchProof_\d+$/.test(inp.name)
              && typeof value === 'bigint' && value >= 0n) {
              return batchProofInputOffset(value);
            }
            if (/^__internal__vmapBatchPredOut_\d+$/.test(inp.name)
              && typeof value === 'bigint' && value >= 0n) {
              // This contract's own batch plan counts its outputs from the block base it was given, so the value
              // less that base is the trailing ordinal past this block, never an output already absolute.
              return resolveAbsolutePredOut(
                value - BigInt(overrides?.blockBase ?? 0),
                masterInputIndex,
                groupLayoutTrailingBase(group),
                group.relocatedPredOutBase,
                true,
              );
            }
            return value;
          }
          // Nested callees already publish these sentinels. A proxy-dispatched handler such as
          // registerUser can emit `__internal__vmapBatchTrailingCount` without sortedBatchInfo
          // (its mapping write is an entryLoopWrite); without a fallback the delegate encoder throws.
          const fallback = vmapBatchWitnessFallback(inp.name);
          if (fallback !== undefined) return fallback;
        }
        const witness = inp.name.match(/^__internal__valueWitness_(\d+)$/);
        if (witness) {
          // The numeric suffix is the entry-slot identity the witness was recorded under, so read the map by
          // that ordinal. A positional list would slide every value onto the parameter of the slot before it
          // whenever a preceding slot publishes no chunkable value.
          const valueWitness = entryValueWitnesses.get(Number(witness[1])) ?? new Uint8Array();
          // A route reads the CALLEE's collections, so its chunkable-value witnesses are the callee's, not
          // this caller's. The block composition resolves them from the callee's chunk UTXOs and publishes
          // them on the route's internalArgs; `entryValueWitnesses` stays the fallback for an ordinary
          // delegate, whose entries really are the caller's.
          // A probe-learned witness is persisted on the physical delegate group. It is newer than the
          // compiler-route seed (often the empty/default value), so preserve it across later input refreshes.
          const routeWitness = group.internalArgs?.[inp.name]
            ?? (graphCompilerRoute ? undefined : group.compilerRoute?.internalArgs?.[inp.name]);
          if (routeWitness !== undefined) return routeWitness;
          if (['SOLIDC_DEBUG_COLLECTION_FETCH', 'SOLIDC_DEBUG_VALUE_WITNESS'].some((name) =>
            debugEnv()?.[name] === '1')) {
            debugLog('delegate-value-witness-fill', {
              functionName: group.functionName, input: inp.name,
              length: valueWitness instanceof Uint8Array ? valueWitness.length : valueWitness.length,
              head: valueWitness instanceof Uint8Array ? binToHex(valueWitness.slice(0, 64)) : '<chunks>',
            });
          }
          return valueWitness;
        }
        if (isRoutePushValueWitnessName(inp.name)) {
          return resolveDelegatePushValueWitness(
            inp.name,
            group.compilerRoute?.internalArgs,
            group.internalArgs,
            activeEntryDelegate,
          );
        }
        const anchorWitness = inp.name.match(/^__internal__extcallAnchorIdx(\d+)$/);
        if (anchorWitness) {
          const slot = Number(anchorWitness[1]);
          const band = anchorBandBySlot.get(slot);
          if (band === undefined) {
            const nestedGroupIndex = nestedGroupIndexForSlot(slot);
            return directNestedIdentityWitness(bFunc as AbiFunction, slot, nestedGroupIndex);
          }
          anchorFillPositions.push({
            argIndex: inpIndex,
            name: inp.name,
            band,
            proxyRoute: proxyAnchorSlots.has(slot),
          });
          return -1n; // patched once the builder materializes input positions
        }
        if (/^__internal__callInputIndex\d*$/.test(inp.name)) {
          const callIndex = delegateCallInputWitnessIndex++;
          const lowLevelCall = (bFunc as AbiFunction).lowLevelCalls?.[callIndex] as {
            target?: { kind?: string; name?: string };
            targetSource?: { kind?: string; paramIndex?: number };
          } | undefined;
          const targetName = lowLevelCall?.target?.name;
          const rawSlot = targetName === undefined ? -1 : ((bFunc as AbiFunction).externalCalls ?? [])
            .findIndex((call) => call.interfaceName === '__raw__'
              && (call.addressParam === targetName || call.addressParam?.endsWith(`_${targetName}`)));
          const typedSlot = targetName === undefined ? -1 : ((bFunc as AbiFunction).externalCalls ?? [])
            .findIndex((call) => call.addressParam === targetName);
          const targetSlot = rawSlot >= 0 ? rawSlot : typedSlot;
          const targetLock = lowLevelCall?.targetSource?.kind === 'forward'
            && lowLevelCall.targetSource.paramIndex !== undefined
            ? addressArgumentLockingBytecodeHex(visibleFunctionArgs[lowLevelCall.targetSource.paramIndex])
            : targetSlot < 0 ? undefined
              : externalCallTargetSourceLockingBytecodeHex(bFunc as AbiFunction, targetSlot, visibleFunctionArgs);
          const explicitTarget = participantGroupForTarget(
            externalCallUtxoGroups, nestedGroups, targetLock,
          );
          const tokenNested = lowLevelCall?.target?.kind === 'computed'
            ? computedStateWriterGroupIndex(
              externalCallUtxoGroups, nestedGroups,
              (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)?.messageBusConvention,
            ) : undefined;
          const nestedGroup = explicitTarget ?? (tokenNested !== undefined ? tokenNested
            : targetSlot >= 0 ? nestedGroups[targetSlot] : nestedGroups[callIndex]);
          const callInputIndex = BigInt(nestedGroup === undefined
            ? masterInputIndex + 1 + group.dataNftUtxos.length
            : nestedMasterIndices[nestedGroup]);
          if (tokenNested !== undefined) {
            tokenCallInputPositions.push(inpIndex);
            const tokenCategory = externalCallUtxoGroups[tokenNested]?.categoryId;
            if (tokenCategory) tokenCallInputCategory = tokenCategory;
            tokenCallGroup = externalCallUtxoGroups[tokenNested];
          }
          return callInputIndex;
        }
        const runtimeCardinality = resolveDelegateRuntimeCardinality(inp.name, activeEntryDelegate);
        if (runtimeCardinality !== undefined) return runtimeCardinality;
        if (inp.name === '__internal__blockOracleInputIndex') {
          // The oracle rides the implementation band at its slot, like a delegated keccak side-car.
          const info = (bFunc as AbiFunction).blockLayout?.slots.find((slot) => slot.kind === 'blockInfoOracle');
          return info === undefined ? -1n : batchProofInputOffset(BigInt(info.offset));
        }
        if (inp.name === '__internal__graphSelfIdentityInput') {
          // Only a forwarding proxy presents its CREATE lock as address(this). A delegate of the same
          // contract keeps -1 so hash160(self) still matches the input that is executing.
          const logicalCreateLock = params.logicalCreateLock as Uint8Array | undefined;
          const implementationLock = group.externalContract.inner.lockingBytecode;
          const proxyFacade = logicalCreateLock !== undefined
            && implementationLock.toLowerCase() !== binToHex(publicSelfAddress).toLowerCase();
          if (proxyFacade) {
            anchorFillPositions.push({
              argIndex: inpIndex, name: inp.name, categoryId: host.categoryId, proxyRoute: false,
            });
          }
          return -1n;
        }
        throw new Error(`Unsupported SDK-filled delegate parameter '${inp.name}' on ${group.functionName}.`);
      });
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_FORWARD_ARGS === '1' && group.compilerRoute) {
        const proxyMasterIndex = bFunc.inputs.findIndex((input) =>
          input.name === '__internal__proxyMasterIndex');
        console.error('delegate-route-proxy-master', {
          groupLocalIdx, functionName: group.functionName, masterInputIndex,
          compilerOwned: group.compilerRoute.internalArgs?.__internal__proxyMasterIndex,
          encoded: proxyMasterIndex < 0 ? undefined : encodedArgs[proxyMasterIndex],
        });
      }
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
        const topology = bFunc.inputs.flatMap((input, index) => (
          /^__internal__(?:externalReturnOutputIdx|extcallMasterIdx|callInputIndex)/.test(input.name)
            ? [{ name: input.name, value: encodedArgs[index] instanceof Uint8Array
              ? binToHex(encodedArgs[index]) : String(encodedArgs[index]) }]
            : []
        ));
        if (topology.length > 0) console.error('delegate-external-topology-args', {
          groupLocalIdx,
          functionName: group.functionName,
          nestedGroups,
          topology,
        });
      }
      if (timingEnabled) console.error('delegate-args-map-complete', { groupLocalIdx });
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_VMAP_PROOF === '1' && group.compilerRoute) {
        console.error('delegate-lowlevel-route-final-args', {
          contract: bArt.contractName,
          bytecodeLength: bArt.bytecode.length,
          delegateBytecodeLength: bArt.delegateArtifact?.bytecode.length,
          function: group.functionName,
          inputs: bFunc.inputs.flatMap((input, index) => (
            input.name === 'batchBlob'
            || input.name === '__internal__msgSenderCategory'
            || input.name === '__internal__proxyMasterOutputIndex'
            || input.name === '__internal__proxyMasterIndex'
            || input.name.includes('userRatings')
            || input.name.includes('vmapBatchProof')
            || input.name.includes('vmapBatchSlot')
            || input.name.includes('vmapBatchPredOut')
            || input.name.includes('returnOutputIdx')
              ? [{
                name: input.name,
                value: encodedArgs[index] instanceof Uint8Array
                  ? binToHex(encodedArgs[index]) : encodedArgs[index],
              }] : []
          )),
        });
      }
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
        console.error('delegate-encoded-args', {
          groupLocalIdx,
          functionName: group.functionName,
          masterInputIndex,
          inputs: bFunc.inputs.map((input, index) => ({
            name: input.name,
            type: input.type,
            value: encodedArgs[index] instanceof Uint8Array
              ? binToHex(encodedArgs[index]) : encodedArgs[index],
          })),
        });
      }
      group.internalArgNames = Object.freeze(bFunc.inputs.map((input) => input.name));
      // Final-layout reconciliation operates on the carrier rather than this closure's private argument array.
      // Publish the initially encoded batch frame just like later refreshes do, otherwise an unchanged INSERT
      // witness is invisible and its absolute predecessor-output coordinate can never be rebound.
      group.internalArgs = {
        ...group.internalArgs,
        ...Object.fromEntries(bFunc.inputs.flatMap((input, index) => (
          input.name.startsWith('__internal__vmapBatch')
            ? [[input.name, encodedArgs[index]!] as const]
            : []
        ))),
      };
      group.refreshInternalArgs = (updates) => {
        group.internalArgs = { ...group.internalArgs, ...updates };
        // Probe-learned witnesses must survive later geometry/anchor refreshes. Keeping them only in this
        // invocation's temporary argument list caused the next refresh({}) to silently restore the original
        // empty witness before final preflight.
        for (const [name, value] of Object.entries(updates)) {
          const index = bFunc.inputs.findIndex((input) => input.name === name);
          if (index >= 0) encodedArgs[index] = value;
        }
        group.masterUtxo = {
          ...(group.masterUtxo as UnlockableUtxo),
          unlocker: group.compilerRoute
            ? group.externalContract.inner.createCompilerRouteUnlocker(
              group.compilerRoute.abiFunction, group.compilerRoute.selector,
            )(...encodedArgs)
            : group.externalContract.inner.unlock[group.functionName]!(...encodedArgs),
        };
        if (group.blockInputs && group.blockLayout) {
          const masterOffset = group.blockLayout.slots.find((slot) => slot.kind === 'master')?.offset ?? 0;
          if (group.blockInputs[masterOffset]) {
            group.blockInputs[masterOffset] = group.masterUtxo as UnlockableUtxo;
          }
        }
        for (const externalGroup of externalCallUtxoGroups) {
          if (!externalGroup.delegateEmbeddedInBlock
            || externalGroup.delegateCallGroupIndex !== groupLocalIdx
            || !externalGroup.blockInputs) continue;
          const master = group.masterUtxo as UnlockableUtxo;
          const embeddedIndex = externalGroup.blockInputs.findIndex((input) => input !== undefined
            && input.txid.toLowerCase() === master.txid.toLowerCase() && input.vout === master.vout);
          if (embeddedIndex >= 0) externalGroup.blockInputs[embeddedIndex] = master;
        }
      };
      group.refreshFunctionArgs = (nextArgs) => {
        const visibleInputs = bFunc.inputs.filter((input) => !input.name.startsWith('__internal__'));
        if (visibleInputs.length !== nextArgs.length) {
          throw new Error(
            `Cannot refresh ${group.functionName}: expected ${visibleInputs.length} visible arguments, `
            + `received ${nextArgs.length}.`,
          );
        }
        group.functionArgs = [...nextArgs];
        let nextIndex = 0;
        for (const [inputIndex, input] of bFunc.inputs.entries()) {
          if (input.name.startsWith('__internal__')) continue;
          encodedArgs[inputIndex] = encodeVisibleArg(nextArgs[nextIndex++], input.type);
        }
        group.refreshInternalArgs?.({});
      };
      if (timingEnabled) console.error('delegate-refresh-start', { groupLocalIdx });
      group.refreshInternalArgs({});
      if (timingEnabled) console.error('delegate-refresh-complete', { groupLocalIdx });
      if (anchorFillPositions.length > 0) {
        pendingAnchorFills.push({ group, functionName: group.functionName, encodedArgs, positions: anchorFillPositions });
      }
      if (externalCallInputPositions.length > 0) {
        group.mintingInputWitnessCategories = Object.fromEntries(
          externalCallInputPositions.map(({ name, categoryId }) => [name, categoryId]),
        );
        pendingExternalCallInputFills.push({ group, positions: externalCallInputPositions });
      }
      if (bFunc.inputs.some((input) => input.name === '__internal__dynamicChunkInputBase')) {
        const resources = group.dynamicChunkResources ?? delegateProxyGroup?.dynamicChunkResources ?? [];
        const first = [...resources].sort((left, right) => left.blockSlot - right.blockSlot)[0];
        pendingDynamicChunkInputFills.push({
          group,
          root: delegateProxyExternalGroup === undefined,
          ...(first !== undefined && group.blockInputs?.[first.blockSlot]
            ? { target: group.blockInputs[first.blockSlot] } : {}),
        });
      }
      if (tokenCallInputPositions.length > 0 && tokenCallInputCategory) {
        pendingTokenCallInputFills.push({
          group,
          encodedArgs,
          positions: tokenCallInputPositions,
          returnPositions: tokenReturnPositions,
          returnWidths: tokenReturnWidths,
          tokenGroup: tokenCallGroup,
          categoryId: tokenCallInputCategory,
        });
      }
    }

    if (delegateProxyExternalGroup === undefined) currentBase += 1 + group.dataNftUtxos.length;
    if (timingEnabled) console.error('delegate-unlocker-group-complete', { groupLocalIdx });
  }
  host.timing('delegate-unlockers-complete');
}
