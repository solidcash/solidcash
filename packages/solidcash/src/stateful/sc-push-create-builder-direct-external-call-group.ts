/**
 * phase-boundary extract: SC _createBuilder extract — push one direct nested external-call UTXO group.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type {
  AbiFunction,
  Artifact,
  ExternalCallAbi,
  StateLayout,
  StateValue,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { encodeExternalReturnValue } from './external-return-encoding.js';
import { physicalExternalCallGroupIndexByMasterOutpoint } from './physical-external-call.js';
import {
  isRepeatedTypedLoopCallsite,
  repeatedTypedLoopRefusal,
} from './sc-expand-resolve-create-builder-external-calls.js';
import { resolveExternalResultEncoding } from './solidityAbi.js';
import {
  stageValueChunkWrite, valueChunkWriteResourceIdentity, type ValueChunkWriteStagingSession,
} from './value-chunk-persist.js';
import {
  terminalValueChunkProducerClaim, type ValueChunkProducerPathDisposition,
} from './ValueChunkProducerIdentity.js';
import { describeValueChunkWrites } from './writer-group-selection.js';

/**
 * The batch trailing width is the number of DISTINCT non-negative PredOut lanes the batch witnesses name, which
 * is exactly what the covenant's `emitBatchTrailingCountBinding` counts. Several inserts that share one
 * predecessor publish one rewritten predecessor lane, not one per insert; `bPlannedEntryInserts.length` overcounts
 * those shared-gap batches and made the covenant refuse the composed settlement.
 */
export function directVmapBatchTrailingCount(
  internalArgs: Record<string, unknown>,
): bigint {
  const lanes = new Set<bigint>();
  for (const [name, value] of Object.entries(internalArgs)) {
    if (/^__internal__vmapBatchPredOut_\d+$/.test(name)
      && typeof value === 'bigint' && value >= 0n) lanes.add(value);
  }
  return BigInt(lanes.size);
}

export interface PushCreateBuilderDirectExternalCallGroupHost {
  deriveReturnValue(...args: any[]): Promise<unknown>;
  resolveLoopArgs(occurrenceIndex: number): FunctionArgument[] | undefined;
  readonly callerCategoryId: string;
  readonly callerContract: unknown;
  readonly valueChunkWriteStagingSession: ValueChunkWriteStagingSession;
}

export interface PushCreateBuilderDirectExternalCallGroupInput {
  externalCallUtxoGroups: ExternalCallUtxoGroup[];
  compilerRoute: ExternalCallUtxoGroup['compilerRoute'] | undefined;
  bBlockInputs: UnlockableUtxo[] | undefined;
  bBlockLayout: NonNullable<AbiFunction['blockLayout']> | undefined;
  bAbiFunc: AbiFunction | undefined;
  bCompilerInternalArgs: Record<string, FunctionArgument>;
  bPlannedEntryInserts: NonNullable<ExternalCallUtxoGroup['plannedEntryInserts']>;
  bRelativeOutputInternalArgs: Set<string>;
  bState: { masterUtxo: Utxo };
  bStatelayout: StateLayout;
  bDataNfts: UnlockableUtxo[];
  bRequiredNftIndices: number[];
  bReturnEventInBlock: boolean;
  bGraphBlockhashSelections: NonNullable<ExternalCallUtxoGroup['graphBlockhashSelections']> | [];
  bKeccak: { recreates: NonNullable<ExternalCallUtxoGroup['keccakRecreates']> };
  bDynamicChunkInputs: NonNullable<ExternalCallUtxoGroup['ordinaryDynamicChunkInputs']>;
  bDynamicChunkResources: NonNullable<ExternalCallUtxoGroup['dynamicChunkResources']>;
  bEntryLoopCommitments: string[] | undefined;
  bEntryLoopStart: number | undefined;
  bEntryLoopCollection: string | undefined;
  bValueChunkOutputCount: number;
  bDirectChunkValue: Uint8Array | undefined;
  ordinaryProducerPath?: ValueChunkProducerPathDisposition;
  callInfo: {
    functionName: string;
    args: FunctionArgument[];
    externalContract: any;
  };
  ec: ExternalCallAbi & { rawFunctionName?: string; rawSelector?: string; callMode?: string };
  externalCategoryId: string;
  publicSelfIdentity: { categoryId: string; lockingBytecode: string };
  publicSelfAddress: Uint8Array | undefined;
  returnProbeOnly: boolean | undefined;
}

/**
 * Validate route entry uniqueness, optionally precompute a probe return, push the
 * direct ExternalCallUtxoGroup, and promote shared physical blocks / stage chunk writes.
 */
export async function pushCreateBuilderDirectExternalCallGroup(
  host: PushCreateBuilderDirectExternalCallGroupHost,
  input: PushCreateBuilderDirectExternalCallGroupInput,
): Promise<void> {
  const {
    externalCallUtxoGroups,
    compilerRoute,
    bBlockInputs,
    bBlockLayout,
    bAbiFunc,
    bCompilerInternalArgs,
    bPlannedEntryInserts,
    bRelativeOutputInternalArgs,
    bState,
    bStatelayout,
    bDataNfts,
    bRequiredNftIndices,
    bReturnEventInBlock,
    bGraphBlockhashSelections,
    bKeccak,
    bDynamicChunkInputs,
    bDynamicChunkResources,
    bEntryLoopCommitments,
    bEntryLoopStart,
    bEntryLoopCollection,
    bValueChunkOutputCount,
    bDirectChunkValue,
    ordinaryProducerPath,
    callInfo,
    ec,
    externalCategoryId,
    publicSelfIdentity,
    publicSelfAddress,
    returnProbeOnly,
  } = input;

  if (compilerRoute && bBlockInputs && bBlockLayout) {
    const seenEntries = new Map<string, number>();
    for (const slot of bBlockLayout.slots) {
      if (slot.kind !== 'entry') continue;
      const entryInput = bBlockInputs[slot.offset];
      if (!entryInput?.token?.nft) continue;
      const outpoint = `${entryInput.txid}:${entryInput.vout}`;
      const owner = seenEntries.get(outpoint);
      if (owner !== undefined) {
        throw new Error(
          `External message-bus batch resource shape aliases entry slots ${owner} and ${slot.slotIndex}; `
          + 'this physical alias is not supported by the advertised route',
        );
      }
      seenEntries.set(outpoint, slot.slotIndex ?? 0);
    }
  }

  if ((bAbiFunc?.sortedBatchInfo?.length ?? 0) > 0
    && !Object.prototype.hasOwnProperty.call(
      bCompilerInternalArgs, '__internal__vmapBatchTrailingCount',
    )) {
    bCompilerInternalArgs.__internal__vmapBatchTrailingCount = directVmapBatchTrailingCount(
      bCompilerInternalArgs,
    );
  }

  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_ROUTE === '1') {
    console.error('external-route-vmap-args', callInfo.functionName, bAbiFunc?.name,
      bAbiFunc?.sortedBatchInfo, bCompilerInternalArgs);
  }
  // Several source callsites can target one stateful participant. Keep a logical group for every
  // callsite (selectors, arguments and return witnesses remain slot-stable), but let only the first
  // group own the participant's physical input block. Transitive graph expansion already represents
  // this distinction with `sharedGroupIndex`; direct calls must do the same or the same master UTXO is
  // appended once per callsite. Use the exact live master outpoint rather than a source/interface name:
  // category IDs describe state ownership, while the outpoint is the resource actually consumed.
  const directSharedGroupIndex = physicalExternalCallGroupIndexByMasterOutpoint(
    externalCallUtxoGroups, bState.masterUtxo,
  );
  const sharedPhysical = directSharedGroupIndex < 0
    ? undefined : externalCallUtxoGroups[directSharedGroupIndex];
  // A direct caller can share a physical block with a view/writer pair, but two distinct returning methods
  // cannot both execute from its one master input unless the compiler published one authenticated batch route.
  // Without that route the second return output is only a placeholder, and deriving it would turn an invalid
  // transaction into a late VM failure (or, for some schemas, an ambiguous provisional result).
  if (!returnProbeOnly && ec.hasReturnValues && sharedPhysical
    && sharedPhysical.functionName !== callInfo.functionName
    && !compilerRoute && !sharedPhysical.compilerRoute) {
    const priorAbi = (sharedPhysical.externalContract?.inner?.artifact?.abi as readonly AbiFunction[] | undefined)
      ?.find((candidate) => candidate.name === sharedPhysical.functionName);
    if ((priorAbi?.outputs?.length ?? 0) > 0) {
      throw new Error(
        `Direct external calls to ${sharedPhysical.functionName} and ${callInfo.functionName} share one state owner `
        + 'but both return values. Use messageBus.compose() to authenticate both logical invocations.',
      );
    }
  }
  // A return probe evaluates ONLY the contract input, so a callee's covenant never executes and its return
  // event would keep the neutral placeholder the builder seeds (`setReturnEventOutput`). Derive the actual
  // value where possible, but never infer `true` merely from a bool result: a read-only callee may genuinely
  // return false, and `writesState` is only the negation of a read-only proof, not proof of a successful write.
  // A broadcast transaction executes its callees and must not precompute.
  let directPrecomputedReturn: Uint8Array | undefined;
  let resolveLoopReturnValue: ((occurrenceIndex: number) => Promise<StateValue>) | undefined;
  let resolveLoopReturnCommitment: ((occurrenceIndex: number) => Promise<Uint8Array>) | undefined;
  if (returnProbeOnly === true && bReturnEventInBlock) {
    const precomputeArtifact = callInfo.externalContract.inner.artifact as Artifact;
    const rawCall = ec as { rawFunctionName?: string; rawSelector?: string };
    const precomputeName = callInfo.functionName === '__raw__'
      ? rawCall.rawFunctionName ?? (precomputeArtifact.abi as readonly AbiFunction[])
        .find((candidate) => rawCall.rawSelector !== undefined
          && candidate.selector?.toLowerCase() === rawCall.rawSelector.toLowerCase())?.name
      : callInfo.functionName;
    // The callee artifact's own entry, not `_resolveCallAbi`: the latter matches by argument shape, which a
    // raw callsite's decoded argument vector need not satisfy.
    const precomputeAbi = precomputeName === undefined ? undefined
      : (precomputeArtifact.abi as readonly AbiFunction[])
        .find((candidate) => candidate.name === precomputeName);
    if (precomputeAbi?.outputs?.length === 1 && precomputeName !== undefined) {
      const encode = (value: StateValue): Uint8Array => encodeExternalReturnValue(
        value,
        precomputeAbi.outputs![0].type,
        precomputeArtifact.structs ?? precomputeArtifact.stateLayout?.structs,
        resolveExternalResultEncoding(
          precomputeAbi.resultEncoding,
          precomputeArtifact,
          precomputeAbi.outputs!.map((output) => output.type),
          `function '${precomputeAbi.name}' result`,
        ) === 'evm-abi-v1',
        precomputeArtifact.enums,
      );
      try {
        // This frame is the CALLER of `callInfo.externalContract`, so the callee's `msg.sender` is exactly
        // this frame's authenticated identity. Without it the nested probe keys every `msg.sender`-derived
        // mapping slot on the transaction origin (measured: a `transferFrom` allowance probe pinned the
        // signer-keyed slot while the composed transaction reads the caller-keyed one), and the returned
        // value the composition reuses describes a frame the transaction never builds.
        const precomputeValue = await host.deriveReturnValue(
          precomputeName, callInfo.args, undefined, precomputeAbi, undefined,
          publicSelfAddress, host.callerCategoryId, host.callerContract,
        );
        if (precomputeValue !== undefined) directPrecomputedReturn = encode(precomputeValue as StateValue);
      } catch {
        directPrecomputedReturn = undefined;
      }
      if (ec.occurrence === 'loop' && ec.resultArrayOutput !== undefined) {
        resolveLoopReturnValue = async (occurrenceIndex: number): Promise<StateValue> => {
          const occurrenceArgs = host.resolveLoopArgs(occurrenceIndex);
          if (!occurrenceArgs) {
            throw new Error(
              `Could not resolve arguments for occurrence ${occurrenceIndex} of `
              + `${ec.interfaceName}.${ec.functionName}`,
            );
          }
          return host.deriveReturnValue(
            precomputeName, occurrenceArgs, undefined, precomputeAbi, undefined,
            publicSelfAddress, host.callerCategoryId, host.callerContract,
          ) as Promise<StateValue>;
        };
        resolveLoopReturnCommitment = async (occurrenceIndex: number): Promise<Uint8Array> => (
          occurrenceIndex === 0 && directPrecomputedReturn !== undefined
            ? directPrecomputedReturn
            : encode(await resolveLoopReturnValue!(occurrenceIndex))
        );
      }
    }
  }
  // A return probe admits a repeated typed loop only because this group resolves each occurrence's result;
  // without that resolver every row of the result array would decode iteration 0's value.
  if (returnProbeOnly === true && isRepeatedTypedLoopCallsite(ec) && resolveLoopReturnCommitment === undefined) {
    throw repeatedTypedLoopRefusal(ec);
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_RETURN === '1') {
    console.error('direct-call-precompute', {
      functionName: callInfo.functionName,
      probeOnly: returnProbeOnly === true,
      inBlock: bReturnEventInBlock,
      sharedGroupIndex: directSharedGroupIndex,
      precomputedHex: directPrecomputedReturn ? binToHex(directPrecomputedReturn) : undefined,
    });
  }
  externalCallUtxoGroups.push({
    categoryId: externalCategoryId,
    stateLayout: bStatelayout,
    masterUtxo: bState.masterUtxo,
    dataNftUtxos: bDataNfts,
    requiredDataNftIndices: bRequiredNftIndices,
    functionName: callInfo.functionName,
    functionArgs: callInfo.args,
    ...(!compilerRoute && ec.readonlyReturnBinding?.version === 1
      && bAbiFunc?.writesState === false && bAbiFunc.selector !== undefined
      && ec.readonlyReturnBinding.selector.toLowerCase() === bAbiFunc.selector.toLowerCase()
      && (bAbiFunc.outputs?.length ?? 0) > 0 && callInfo.args.length === 0
      && (ec.callMode === undefined || ec.callMode === 'staticcall')
      && !ec.condition && (ec.occurrence === undefined || ec.occurrence === 'once')
      && { readonlyReturnSelector: bAbiFunc.selector.toLowerCase() }),
    ...(ec.callsiteId !== undefined && { sourceCallsiteId: ec.callsiteId }),
    externalContract: callInfo.externalContract,
    callerIdentity: publicSelfIdentity,
    logicalFunctionName: callInfo.functionName,
    ...(Object.keys(bCompilerInternalArgs).length > 0 && { internalArgs: bCompilerInternalArgs }),
    ...(bRelativeOutputInternalArgs.size > 0 && {
      relativeOutputInternalArgs: [...bRelativeOutputInternalArgs],
    }),
    ...(compilerRoute && {
      compilerRoute: {
        ...compilerRoute,
        ...((bAbiFunc?.sortedBatchInfo?.length ?? 0) > 0 && {
          internalArgs: {
            ...bCompilerInternalArgs,
            __internal__vmapBatchTrailingCount: directVmapBatchTrailingCount(
              bCompilerInternalArgs,
            ),
          },
        }),
      },
    }),
    ...(bGraphBlockhashSelections.length > 0 && {
      graphBlockhashSelections: bGraphBlockhashSelections,
    }),
    ...(ec.callMode && { callMode: ec.callMode }),
    ...(bPlannedEntryInserts.length > 0 && { plannedEntryInserts: bPlannedEntryInserts }),
    ...(bBlockInputs && { blockInputs: bBlockInputs, blockLayout: bBlockLayout }),
    ...(bDynamicChunkResources.length > 0 && { dynamicChunkResources: bDynamicChunkResources }),
    ...(directSharedGroupIndex >= 0 && {
      sharedGroupIndex: directSharedGroupIndex,
      // An explicit empty block makes all input-count/layout reducers consume zero physical slots for
      // this logical alias while retaining the callsite's own ABI/layout metadata.
      blockInputs: [] as UnlockableUtxo[],
    }),
    ...(bReturnEventInBlock && { returnEventInBlock: true }),
    ...(directPrecomputedReturn !== undefined
      && { precomputedReturnCommitment: directPrecomputedReturn }),
    ...(resolveLoopReturnCommitment && {
      loopResultArrayOutput: ec.resultArrayOutput,
      ...(ec.maximumOccurrences !== undefined && { loopMaximumOccurrences: ec.maximumOccurrences }),
      resolveLoopReturnCommitment,
      resolveLoopReturnValue,
      resolveLoopFunctionArgs: (occurrenceIndex: number) => host.resolveLoopArgs(occurrenceIndex),
    }),
    ...(bKeccak.recreates.length > 0 && { keccakRecreates: bKeccak.recreates }),
    ...(bDynamicChunkInputs.length > 0 && { ordinaryDynamicChunkInputs: bDynamicChunkInputs }),
    ...(bEntryLoopCommitments && {
      entryLoopCommitments: bEntryLoopCommitments,
      entryLoopStart: bEntryLoopStart,
      entryLoopCollection: bEntryLoopCollection,
    }),
    ...(bValueChunkOutputCount > 0 && { valueChunkOutputCount: bValueChunkOutputCount }),
    ...(() => {
      const values: Record<string, StateValue> = {};
      for (const name of bAbiFunc?.dynamicWrites ?? []) {
        const variable = bStatelayout.variables.find((candidate) => candidate.name === name);
        if (!variable) continue;
        const candidates = bAbiFunc!.inputs
          .map((abiInput, index) => ({ abiInput, index }))
          .filter(({ abiInput }) => !abiInput.name.startsWith('__internal__')
            && abiInput.type === variable.type);
        if (candidates.length !== 1) continue;
        const value = callInfo.args[candidates[0].index];
        if (typeof value === 'string' || value instanceof Uint8Array) values[name] = value;
      }
      return Object.keys(values).length > 0 ? { dynamicStateValues: values } : {};
    })(),
  });
  const directGroup = externalCallUtxoGroups[externalCallUtxoGroups.length - 1];
  directGroup.valueChunkWrites = describeValueChunkWrites(directGroup);
  // Several callsites can claim one callee master UTXO (commonly a view first, then the writer). They share
  // ONE physical block: the caller's covenant verifies the writer's callsite against the writer's own ABI
  // layout, and the sorted-batch planner addresses that callsite's predecessor/NEW inputs relative to it. A
  // denser writer block must therefore replace the shape an earlier callsite contributed - otherwise the
  // physical block keeps the narrower layout, the writer's planned inserts name block offsets that do not
  // exist, and derivation aborts before any participant state is resolved.
  if (directSharedGroupIndex >= 0 && bBlockInputs !== undefined && bBlockLayout !== undefined) {
    const physicalOwner = externalCallUtxoGroups[directSharedGroupIndex];
    if (physicalOwner !== undefined
      && bBlockLayout.slots.length > (physicalOwner.blockLayout?.slots.length ?? 0)) {
      physicalOwner.blockInputs = bBlockInputs;
      physicalOwner.blockLayout = bBlockLayout;
      physicalOwner.dataNftUtxos = bDataNfts;
      physicalOwner.requiredDataNftIndices = bRequiredNftIndices;
      if (bReturnEventInBlock) physicalOwner.returnEventInBlock = true;
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_RETURN === '1') {
        console.error('shared-block-promotion', {
          physical: physicalOwner.logicalFunctionName ?? physicalOwner.functionName,
          writer: callInfo.functionName,
          slots: bBlockLayout.slots.map((slot) => `${slot.kind}@${slot.offset}`),
          inputs: bBlockInputs.length,
        });
      }
    }
  }
  if (directSharedGroupIndex >= 0 && bBlockInputs !== undefined && bBlockLayout !== undefined) {
    directGroup.blockInputs = [] as UnlockableUtxo[];
  }
  if (bDirectChunkValue && directGroup.valueChunkWrites.length === 1) {
    const write = directGroup.valueChunkWrites[0]!;
    const access = bAbiFunc?.entryAccesses?.[write.entryAccessSlot];
    const owner = { categoryId: externalCategoryId, lockingBytecode: callInfo.externalContract.inner.lockingBytecode };
    const claim = !compilerRoute && bAbiFunc && access?.arrayMutation === 'push'
      && access.storedElementSource?.version === 1 && ordinaryProducerPath?.status === 'complete'
      ? terminalValueChunkProducerClaim({
        rows: [{ handler: bAbiFunc, selector: bAbiFunc.selector, producerPath: ordinaryProducerPath }],
        collectionIdentities: [write.collection, write.collectionSignature],
        executionLockingBytecode: callInfo.externalContract.inner.lockingBytecode,
        stateOwnerCategoryId: owner.categoryId,
        stateOwnerLockingBytecode: owner.lockingBytecode,
        resourceIdentity: valueChunkWriteResourceIdentity(write),
      }) : undefined;
    if (claim) {
      directGroup.valueChunkStateOwner = owner;
      directGroup.valueChunkProducerClaims = Object.freeze([claim]);
      if (!host.valueChunkWriteStagingSession.stageOwned(write, claim, owner, bDirectChunkValue)) {
        throw new Error('Ordinary value-chunk producer conflicts with an existing staged write.');
      }
    } else {
      stageValueChunkWrite(write, bDirectChunkValue, host.valueChunkWriteStagingSession);
    }
  }
}
