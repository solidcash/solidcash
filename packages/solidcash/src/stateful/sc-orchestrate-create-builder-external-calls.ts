/**
 * phase-boundary extract: SC _createBuilder extract — external-calls orchestration before LLC:
 * expand/resolve callees, shared funders, nested callee blocks, transitive
 * discovery, bases/unlockers, direct-call arg witnesses, and outState reads.
 */

import { hexToBin } from '@bitauth/libauth';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX,
  encodePushdataValue,
  parseChunkCommitment,
  type AbiFunction,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { groupOwnsInBlockReturnEvent } from './value-chunk-geometry.js';
import { createReadOnlyDynamicChunkUnlocker, getDynamicChunkAddress } from './covenant-helpers.js';
import { defaultInternalFunctionArg } from './kernel-journal-helpers.js';
import type { ExternalGroupMeta } from './stateful-lifecycle-types.js';
import type { ExternalCallInfo } from './StatefulContract.js';
import { isScidIdentityCommitment } from './logical-identity.js';
import { findDeploymentByAddressValue } from './deployment-registry.js';
import {
  type ValueChunkProducerPathDisposition,
} from './ValueChunkProducerIdentity.js';
import {
  expandResolveCreateBuilderExternalCalls as expandResolveCreateBuilderExternalCallsImpl,
} from './sc-expand-resolve-create-builder-external-calls.js';
import {
  allocateCreateBuilderSharedFunders as allocateCreateBuilderSharedFundersImpl,
} from './sc-allocate-create-builder-shared-funders.js';
import {
  loadCreateBuilderNestedCalleePrelude as loadCreateBuilderNestedCalleePreludeImpl,
} from './sc-load-create-builder-nested-callee-prelude.js';
import {
  assembleCreateBuilderNestedCalleeBlockInputs as assembleCreateBuilderNestedCalleeBlockInputsImpl,
} from './sc-assemble-create-builder-nested-callee-block.js';
import {
  appendCreateBuilderNestedCalleeLoopWrites as appendCreateBuilderNestedCalleeLoopWritesImpl,
} from './sc-append-create-builder-nested-callee-loop-writes.js';
import {
  pushCreateBuilderDirectExternalCallGroup as pushCreateBuilderDirectExternalCallGroupImpl,
} from './sc-push-create-builder-direct-external-call-group.js';
import {
  discoverCreateBuilderTransitiveExternalCalls as discoverCreateBuilderTransitiveExternalCallsImpl,
} from './sc-discover-create-builder-transitive-external-calls.js';
import {
  finalizeCreateBuilderNestedBasesUnlockers as finalizeCreateBuilderNestedBasesUnlockersImpl,
} from './sc-finalize-create-builder-nested-bases-unlockers.js';
import {
  fillCreateBuilderDirectCallArgWitnesses as fillCreateBuilderDirectCallArgWitnessesImpl,
} from './sc-fill-create-builder-direct-call-arg-witnesses.js';
import {
  loadCreateBuilderOutStateReads as loadCreateBuilderOutStateReadsImpl,
} from './sc-load-create-builder-out-state-reads.js';

const DUMMY_FUNDER_LOCKING_BYTECODE = hexToBin(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX);
const DUMMY_FUNDER_UNLOCKING_BYTECODE = new Uint8Array([0x01, 0x51]);

export type OrchestrateCreateBuilderExternalCallsHost = {
  readonly categoryId: string;
  readonly inner: any;
  readonly signer: any;
  readonly externalRegistry: Map<string, any>;
  readonly callerContract: any;
  getFullState: () => any;
  resolveExternalArgs: (...args: any[]) => any;
  buildRepeatedExternalBatch: (...args: any[]) => any;
  resolveExternalKeccakSideCars: (...args: any[]) => any;
  keysMatch: (...args: any[]) => any;
  [key: string]: any;
};

export type OrchestrateCreateBuilderExternalCallsResult = {
  rootProducerPath: ValueChunkProducerPathDisposition;
  externalCalls: any;
  externalCallUtxoGroups: ExternalCallUtxoGroup[];
  allGroupEcSlots: any[];
  allGroupParentIndices: number[];
  sharedFunderPool: UnlockableUtxo[] | undefined;
  sharedFunderSnapshot: UnlockableUtxo[] | undefined;
  consumedSharedFunders: Set<string>;
  embeddedFunderUtxos: Map<string, UnlockableUtxo>;
  markSharedFunder: (utxo: UnlockableUtxo) => void;
  identityAnchors: UnlockableUtxo[];
  identityAnchorBandByAddress: Map<string, number>;
  externalCallAnchorIndices: Map<number, bigint>;
  finalArgs: any[];
  pendingAnchorFills: any[];
  pendingExternalCallInputFills: any[];
  pendingTokenCallInputFills: any[];
  pendingDelegateInputFills: any[];
  pendingDynamicChunkInputFills: any[];
  topLevelAnchorFillPositions: {
    argIndex: number; band?: number; categoryId?: string; proxyRoute: boolean;
  }[];
  topLevelReturnWitnessPlan: bigint[];
  topLevelReturnWitnessGroups: number[];
  externalOutStateUtxoGroups: ExternalCallUtxoGroup[];
  outStateInputCount: number;
  maxBhLocktime: number;
};

/**
 * Expand and materialize external-call groups (direct + transitive), fill
 * direct-call arg witnesses, and load outState reads. Returns the bag LLC/caches
 * and later createBuilder phases consume.
 */
export async function orchestrateCreateBuilderExternalCalls(
  host: OrchestrateCreateBuilderExternalCallsHost,
  params: {
    abiFunction: AbiFunction | undefined;
    args: any[];
    finalArgs: any[];
    overrides: any;
    onChainState: any;
    requiredNftIndices: readonly number[];
    externalReadUtxos: readonly any[];
    outStateInputCount: number;
    externalOutStateUtxoGroups: ExternalCallUtxoGroup[];
    earlySignerUtxos: Utxo[] | undefined;
    publicSelfAddress: any;
    publicSelfIdentity: any;
    physicalSelfAddress: Uint8Array;
    rootLogicalAddress?: string;
    timing: (label: string) => void;
    valueChunkWriteStagingSession: any;
    iterationEntryInputs: readonly any[];
    entryNfts: readonly any[];
    condSoftDeleteSlots: Set<number> | ReadonlySet<number>;
    entryDeleteSlots: Set<number> | ReadonlySet<number>;
    selectorParamSlot: any;
    isComputedBlockhashKey: (...args: any[]) => boolean;
    maxBhLocktime: number;
    [key: string]: any;
  },
): Promise<OrchestrateCreateBuilderExternalCallsResult> {
  let {
    finalArgs,
    outStateInputCount,
    maxBhLocktime,
  } = params;
  const {
    abiFunction,
    args,
    overrides,
    onChainState,
    requiredNftIndices,
    externalReadUtxos,
    earlySignerUtxos,
    publicSelfAddress,
    publicSelfIdentity,
    timing,
    valueChunkWriteStagingSession,
    iterationEntryInputs,
    entryNfts,
    condSoftDeleteSlots,
    entryDeleteSlots,
    selectorParamSlot,
    isComputedBlockhashKey,
  } = params;
  const externalOutStateUtxoGroups = params.externalOutStateUtxoGroups;

  // Handle external function calls (cross-contract calls via interfaces)
  const rootProducerPath: ValueChunkProducerPathDisposition = Object.freeze({
    status: 'complete',
    context: Object.freeze({ version: 1, sourcePath: Object.freeze([]) }),
  });
  // Direct-group index -> co-spent logical-identity anchor input index, for callees whose Solidity-visible
  // address is a logical CREATE address rather than their physical covenant. Absent entries fall back to -1
  // (direct identity proof), which is every ordinary contract.
  const externalCallAnchorIndices = new Map<number, bigint>();
  // Callee identity anchors co-spent by this call, in band order, plus the deferred witness fills that name
  // them. The band is stable; the absolute input index is not known until the builder assembles its inputs.
  const identityAnchors: UnlockableUtxo[] = (overrides?.callerIdentityUtxos ?? []).filter((utxo: UnlockableUtxo) =>
    isScidIdentityCommitment(utxo.token?.nft?.commitment));
  const identityAnchorBandByAddress = new Map<string, number>();
  const pendingAnchorFills: {
    group: {
      masterUtxo?: unknown;
      refreshInternalArgs?: (updates: Record<string, FunctionArgument>) => void;
      externalContract: { inner: { unlock: Record<string, ((...a: never[]) => unknown) | undefined> } };
    };
    functionName: string;
    encodedArgs: any[];
    positions: {
      argIndex: number; name: string; band?: number; categoryId?: string; proxyRoute: boolean;
    }[];
  }[] = [];
  // A caller's dynamic entry band can grow while the transaction is assembled. Any nested master positions
  // computed before that final layout are provisional; retain their ABI names and categories so the concrete
  // minting-input positions can be written into the implementation unlocker after funding/layout completes.
  const pendingExternalCallInputFills: {
    group: {
      refreshInternalArgs?: (updates: Record<string, FunctionArgument>) => void;
      mintingInputWitnessCategories?: Record<string, string>;
      internalArgs?: Record<string, FunctionArgument>;
    };
    positions: { name: string; categoryId: string }[];
  }[] = [];
  const pendingDelegateInputFills: {
    group: {
      refreshInternalArgs?: (updates: Record<string, FunctionArgument>) => void;
      internalArgs?: Record<string, FunctionArgument>;
    };
    name: string;
    categoryId: string;
  }[] = [];
  const pendingDynamicChunkInputFills: {
    group: {
      refreshInternalArgs?: (updates: Record<string, FunctionArgument>) => void;
      internalArgs?: Record<string, FunctionArgument>;
      blockInputs?: UnlockableUtxo[];
      dynamicChunkResources?: Array<{ blockSlot: number }>;
    };
    target?: UnlockableUtxo;
    root: boolean;
  }[] = [];
  const topLevelAnchorFillPositions: {
    argIndex: number; band?: number; categoryId?: string; proxyRoute: boolean;
  }[] = [];
  // Planned external-call return-event coordinates for this build, in returning-group order. The trailing ABI
  // frame is filled positionally, so these are re-placed by parameter NAME once the frame is complete.
  const topLevelReturnWitnessPlan: bigint[] = [];
  // The group each planned witness belongs to, index-aligned with the plan, so a late assembly pass can re-read
  // that group's physical return coordinate without re-deriving which group a witness slot came from.
  const topLevelReturnWitnessGroups: number[] = [];
  const pendingTokenCallInputFills: {
    group: { refreshInternalArgs?: (updates: Record<string, FunctionArgument>) => void };
    encodedArgs: FunctionArgument[];
    positions: number[];
    returnPositions: number[];
    returnWidths: number[];
    tokenGroup?: ExternalCallUtxoGroup;
    categoryId: string;
  }[] = [];

  const expandedExternal = await expandResolveCreateBuilderExternalCallsImpl(
    {
      getExternalTargetEntriesByInterface: (interfaceName) =>
        host.inner.getExternalTargetEntriesByInterface(interfaceName),
      resolveExternalArgs: (...a: any[]) => host.resolveExternalArgs(...a),
      evaluateExternalExpression: (...a: any[]) => host.callerContract._evaluateExternalExpression(...a),
      resolveExternalExpressionReturns: (
        sources, functionArgs, state, callerInputs, executionSelfAddress, producerCalls,
      ) => host.callerContract._resolveExternalExpressionReturns(
        sources, functionArgs, host.callerContract, state, callerInputs,
        executionSelfAddress, producerCalls, false,
      ),
      hydrateExternalPredicateState: (...a: any[]) => host.callerContract._hydrateExternalPredicateState(...a),
      getExternalRegistryEntry: (interfaceName) => host.externalRegistry.get(interfaceName),
      getExternalDeploymentByAddressValue: (value) =>
        findDeploymentByAddressValue(host.inner.provider, value)?.contract,
      getFullState: () => host.getFullState(),
    },
    abiFunction,
    args,
    host.inner.artifact,
    publicSelfAddress,
    overrides?.externalCalls,
  );
  let externalCalls = expandedExternal.externalCalls;
  const loopIdxRanges = expandedExternal.loopIdxRanges;
  let callerStateSnapshot = expandedExternal.callerStateSnapshot;
  let resolvedExternalCalls = expandedExternal.resolvedExternalCalls as ExternalCallInfo[] | undefined;

  let externalCallUtxoGroups: ExternalCallUtxoGroup[] = [];
  // Total return event count including transitive chains (updated in external call block)
  // Combined metadata for all groups (direct + transitive); used by _deriveFullTransactionState
  let allGroupEcSlots: { hasReturnValues?: boolean; requiredDataNftIndices: number[] }[] = [
    ...(externalCalls ?? []),
  ];
  let allGroupParentIndices: number[] = (externalCalls ?? []).map(() => -1);

  // Pre-allocate signer UTXOs for B's block funders (shared pool across all external calls)
  let sharedFunderPool: UnlockableUtxo[] | undefined;
  let sharedFunderSnapshot: UnlockableUtxo[] | undefined;
  const consumedSharedFunders = new Set<string>();
  // These funders are already positioned inside nested participant blocks. Retain their exact outpoints for
  // value/change accounting by the aggregate builder without adding them to its local placement pool again.
  const embeddedFunderUtxos = new Map<string, UnlockableUtxo>();
  const markSharedFunder = (utxo: UnlockableUtxo): void => {
    const key = `${utxo.txid.toLowerCase()}:${utxo.vout}`;
    consumedSharedFunders.add(key);
    embeddedFunderUtxos.set(key, utxo);
  };

  if (externalCalls && externalCalls.length > 0 && resolvedExternalCalls) {

    // Count total funders needed across all B blocks and snapshot the signer pool once.
    if (host.signer) {
      const allocated = await allocateCreateBuilderSharedFundersImpl(
        {
          getSignerUtxos: () => host.signer!.getUtxos(),
          unlockP2PKH: () => host.signer!.unlockP2PKH(),
        },
        externalCalls,
        resolvedExternalCalls,
        earlySignerUtxos,
      );
      sharedFunderPool = allocated.sharedFunderPool;
      sharedFunderSnapshot = allocated.sharedFunderSnapshot;
    }

    for (let slotIndex = 0; slotIndex < externalCalls.length; slotIndex++) {
      const ec = externalCalls[slotIndex];
      const callInfo = resolvedExternalCalls[slotIndex];

      const nestedPrelude = await loadCreateBuilderNestedCalleePreludeImpl(
        {
          buildRepeatedExternalBatch: (...a: any[]) => host.buildRepeatedExternalBatch(...a),
          resolveExternalKeccakSideCars: (...a: any[]) => host.resolveExternalKeccakSideCars(...a),
          lockingBytecode: host.inner.lockingBytecode,
        },
        slotIndex,
        ec,
        callInfo as any,
        args,
        host.inner.artifact,
        abiFunction,
        callerStateSnapshot,
        publicSelfAddress,
        publicSelfIdentity,
        rootProducerPath,
      );
      const {
        externalCategoryId,
        compilerRoute,
        bGraphBlockhashSelections,
        bState,
        bStatelayout,
        bRequiredNftIndices,
        bDataNfts,
        bAbiFunc,
        bBlockLayout,
        bHasLoop,
        bDirectChunkValue,
        bValueChunkOutputCount,
        bKeccak,
        bDynamicChunkInputs,
      } = nestedPrelude;
      const bSc = nestedPrelude.bSc as unknown as any;

      // Build B's full block inputs when B's function has entries/events/transfers
      let bBlockInputs: UnlockableUtxo[] | undefined;
      // X13: set once B's block is confirmed to carry a funding input at its published returnEvent offset.
      let bReturnEventInBlock = false;
      const bCompilerInternalArgs: Record<string, FunctionArgument> = {};
      // Cross-contract callee LOOP write metadata (docs/deferrals.md #1): populated after the block build below.
      let bEntryLoopCommitments: string[] | undefined;
      let bEntryLoopStart: number | undefined;
      let bEntryLoopCollection: string | undefined;
      const bPlannedEntryInserts: Array<{
        slotIndex: number; blockSlot: number; outputBlockSlot: number;
        commitment: string; newCommitment: string;
      }> = [];
      const bRelativeOutputInternalArgs = new Set<string>();

      if (bBlockLayout && callInfo) {
        const nestedBlockCtx = {
          bBlockInputs,
          bReturnEventInBlock,
          bCompilerInternalArgs,
          bPlannedEntryInserts,
          bRelativeOutputInternalArgs,
          bBlockLayout,
          bHasLoop,
          bSc,
          bAbiFunc,
          bState,
          bDataNfts,
          bStatelayout,
          bRequiredNftIndices,
          bValueChunkOutputCount,
          bKeccak,
          compilerRoute,
          callInfo,
          externalCategoryId,
          slotIndex,
          loopIdxRanges,
          publicSelfAddress,
        };
        await assembleCreateBuilderNestedCalleeBlockInputsImpl(
          {
            getUtxos: (address: string) => host.inner.provider.getUtxos(address),
            keysMatch: (...a: any[]) => host.keysMatch(...a),
            hasSigner: Boolean(host.signer),
            hasSharedFunder: () => Boolean(sharedFunderPool && sharedFunderPool.length > 0),
            shiftSharedFunder: () => sharedFunderPool?.shift(),
            markSharedFunder: (utxo: UnlockableUtxo) => markSharedFunder(utxo),
            addUtxo: (lockingBytecodeHex: string, utxo: Utxo) => {
              if ((host.inner.provider as any).addUtxo) {
                return (host.inner.provider as any).addUtxo(lockingBytecodeHex, utxo);
              }
            },
            currentGroupCount: () => externalCallUtxoGroups.length,
            dummyFunderLockingBytecode: DUMMY_FUNDER_LOCKING_BYTECODE,
            dummyFunderUnlockingBytecode: DUMMY_FUNDER_UNLOCKING_BYTECODE,
          },
          nestedBlockCtx as any,
        );
        bBlockInputs = nestedBlockCtx.bBlockInputs;
        bReturnEventInBlock = nestedBlockCtx.bReturnEventInBlock;
      }

      // A direct view callee must co-spend the chunks it reads after its published block. The
      // callee covenant authenticates their address and order; omitting them leaves its hidden
      // dynamic-input base pointing into another participant's inputs.
      const bDynamicChunkResources: NonNullable<ExternalCallUtxoGroup['dynamicChunkResources']> = [];
      if (bBlockInputs !== undefined && bAbiFunc !== undefined && compilerRoute === undefined) {
        const written = new Set(bAbiFunc.dynamicWrites ?? []);
        for (const name of bAbiFunc.dynamicReads ?? []) {
          if (written.has(name)) continue;
          const variable = bStatelayout.variables.find((candidate) => candidate.name === name && candidate.dynamic);
          if (variable === undefined) continue;
          const address = getDynamicChunkAddress(
            callInfo!.externalContract.inner, externalCategoryId, name, variable.type,
          );
          const chunks = (await host.inner.provider.getUtxos(address))
            .filter((utxo: Utxo) => utxo.token?.category === externalCategoryId
              && utxo.token.nft?.capability === 'mutable'
              && utxo.token.nft.commitment.length > 0)
            .map((utxo: Utxo) => ({
              utxo, index: parseChunkCommitment(utxo.token!.nft!.commitment).chunkIndex,
            }))
            .sort((left: { index: number }, right: { index: number }) => left.index - right.index);
          for (const { utxo } of chunks) {
            bBlockInputs.push({
              ...utxo,
              unlocker: createReadOnlyDynamicChunkUnlocker(
                callInfo!.externalContract.inner, 0, externalCategoryId, name, variable.type,
              ),
            });
            bDynamicChunkResources.push({
              blockSlot: bBlockInputs.length - 1, name, type: variable.type, write: false,
            });
          }
        }
      }

      // Cross-contract callee LOOP write (docs/deferrals.md #1): B's function loops `for(i) this.m[ks[i]] (+)= vs[i]`
      // (sortedUpsertLoopInfo). B's block has NO fixed entry slot for these - the entries are trailing (read by B's
      // covenant at master+blockSize+counter). Co-spend each EXISTING entry (UPDATE-only; an absent key = insert =
      // fail-closed) and SDK-compute its updated commitment; the STB mints B's trailing outputs and B's covenant
      // verifies. Sound by fail-closed: a wrong commitment reverts (B pins output==coSlot|coNext|newValue), a
      // misplaced input trips B's per-iteration coSlot==Hk check. INT values, one collection, no dup keys.
      if (bBlockInputs && bHasLoop && bSc) {
        const loopWrites = await appendCreateBuilderNestedCalleeLoopWritesImpl(
          { getUtxos: (address) => host.inner.provider.getUtxos(address) },
          {
            bBlockInputs,
            bAbiFunc: bAbiFunc!,
            bBlockLayout,
            bStatelayout,
            bSc,
            callInfoArgs: callInfo.args,
            externalCategoryId,
          },
        );
        bBlockInputs = loopWrites.bBlockInputs;
        bEntryLoopCommitments = loopWrites.bEntryLoopCommitments;
        bEntryLoopStart = loopWrites.bEntryLoopStart;
        bEntryLoopCollection = loopWrites.bEntryLoopCollection;
      }

      if (callInfo) {
        await pushCreateBuilderDirectExternalCallGroupImpl(
          {
            deriveReturnValue: (...a: any[]) => (callInfo.externalContract as any)._deriveReturnValue(...a),
            resolveLoopArgs: (occurrenceIndex: number) => host.resolveExternalArgs(
              ec.argSources, args, host.inner.artifact, callerStateSnapshot, abiFunction?.inputs,
              undefined, occurrenceIndex, false, publicSelfAddress,
            ),
            callerCategoryId: host.categoryId,
            callerContract: host.callerContract,
            valueChunkWriteStagingSession,
          },
          {
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
            callInfo,
            ec,
            externalCategoryId,
            publicSelfIdentity,
            publicSelfAddress,
            returnProbeOnly: overrides?.returnProbeOnly,
          } as any,
        );
        if (bDynamicChunkResources.length > 0 && bBlockInputs !== undefined) {
          const first = [...bDynamicChunkResources].sort((left, right) => left.blockSlot - right.blockSlot)[0]!;
          pendingDynamicChunkInputFills.push({
            group: externalCallUtxoGroups[externalCallUtxoGroups.length - 1],
            root: false,
            target: bBlockInputs[first.blockSlot],
          });
        }
      }
    }

    // Track per-group metadata (direct + transitive)
    const groupMetas: ExternalGroupMeta[] = [];
    const directGroupCount = externalCallUtxoGroups.length;

    // Build metadata for direct groups
    for (let i = 0; i < directGroupCount; i++) {
      groupMetas.push({
        ecSlot: externalCalls[i],
        callerCategoryId: externalCallUtxoGroups[i].callerIdentity?.categoryId ?? host.categoryId,
        parentGroupIndex: -1,
      });
    }

    // Discover and build transitive external call groups (B->C chains).
    // For each direct group, check if B's called function also has external calls.
    // If so, resolve B's external calls from B's connect-time registry and add them.
    await discoverCreateBuilderTransitiveExternalCallsImpl(
      host.categoryId,
      externalCallUtxoGroups,
      groupMetas,
      directGroupCount,
    );

    // _externalCallInputBase: runtime param (needed for mutual A<->B calls)
    // When the function reads a dynamic-storage array (loop external calls over arr[i]), the
    // chunk run sits right after the block (read at blockSize+i); the callees are appended
    // AFTER that chunk run, so the base advances by the chunk count.
    let externalCallInputBase = 1 + requiredNftIndices.length + externalReadUtxos.length + outStateInputCount;
    // message-bus batch reserves the complete oracle row band before its callees. Active reads are sparse; count the
    // physical width, not the number of resolved oracle UTXOs, when assigning the first participant base.
    externalCallInputBase += abiFunction?.graphBlockhashOracle?.slotCount ?? 0;
    if (iterationEntryInputs.length > 0) externalCallInputBase += iterationEntryInputs.length;
    const externalCallInputBasePosition = abiFunction?.inputs.findIndex((input) =>
      input.name === '__internal__externalCallInputBase') ?? -1;
    if (externalCallInputBasePosition >= 0) {
    // Compiler-owned witnesses are not always adjacent: a chunkable vmap write can inject a leading-value
    // witness between its batch/value proofs and the external-call region. Fill any intervening ABI slots by
    // declared type before placing the base, otherwise every later witness silently shifts left.
      while (finalArgs.length < externalCallInputBasePosition) {
        const input = abiFunction!.inputs[finalArgs.length];
        if (!input.name.startsWith('__internal__')) {
          throw new Error(
            `Internal error: missing user argument '${input.name}' before external-call witnesses.`,
          );
        }
        finalArgs = [...finalArgs, defaultInternalFunctionArg(input)];
      }
      for (let position = 0; position < externalCallInputBasePosition; position++) {
        const input = abiFunction!.inputs[position];
        if (!input.name.startsWith('__internal__leadingPushValue_')) continue;
        const value = finalArgs[position];
        if (!(value instanceof Uint8Array) && typeof value !== 'string') {
          finalArgs[position] = defaultInternalFunctionArg(input);
        }
      }
      if (finalArgs.length === externalCallInputBasePosition) {
        finalArgs = [...finalArgs, BigInt(externalCallInputBase)];
      } else {
        finalArgs[externalCallInputBasePosition] = BigInt(externalCallInputBase);
      }
    }

    // Fill each synthesized `__internal__loopTargets<n>` witness (a per-iteration COMPUTED target
    // `IFoo(pairFor(.., path[i], ..)).m()` the compiler rewrote to read a witness address[] param) with the
    // co-spent target addresses: the registered instances for that slot's interface, in co-spend order. The
    // co-spend itself is the array-slot expansion above (registered via registerExternalArray); a state/param
    // target array is read on-chain, but this synthesized witness is a param the SDK derives and fills here.
    // Ordered by the ABI (externalCallInputBase then loopTargets<n> then selectors), matching the covenant.
    for (const inp of abiFunction?.inputs ?? []) {
      if (!inp.name.startsWith('__internal__loopTargets')) continue;
      const wSlot = abiFunction?.externalCalls?.find((ec) => ec.loopArrayVar === inp.name);
      const wEntries = wSlot ? host.inner.getExternalTargetEntriesByInterface(wSlot.interfaceName) : [];
      // entry.address is the callee's locking bytecode hex (inst.inner.lockingBytecode) - the same value the
      // covenant compares each co-spent input against, so the witness fill matches the co-spend order exactly.
      const wAddrs = wEntries.map((e: any) => hexToBin(e.address));
      finalArgs = [...finalArgs, encodePushdataValue(wAddrs, 'address[]')];
    }

    // Count all returning call groups (direct + transitive) for return event output computation
    const allReturningGroupIndices: number[] = [];
    for (let i = 0; i < externalCallUtxoGroups.length; i++) {
      if (groupMetas[i].ecSlot.hasReturnValues) {
        allReturningGroupIndices.push(i);
      }
    }
    // Update wider-scoped variables for use outside this block
    allGroupEcSlots = groupMetas.map((m) => m.ecSlot);
    allGroupParentIndices = groupMetas.map((m) => m.parentGroupIndex);

    // Pre-compute return event output base - needed for return output index assignment
    let returnEventOutputBase = -1;
    // Where the co-spent callees' own output blocks begin (X13: a callee's return event lives inside its block).
    let externalCallOutputStart = -1;
    if (allReturningGroupIndices.length > 0) {
      const externalCallOutputCount = externalCallUtxoGroups.reduce(
        (sum, g) => sum + (g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length), 0,
      );

      // Pre-compute low-level call output count (LLC outputs sit between external calls and entries)
      const llcCalls = abiFunction?.lowLevelCalls;
      let lowLevelCallOutputCount = 0;
      if (llcCalls && llcCalls.length > 0) {
        const resolvedLlcCalls = overrides?.calls ?? [];
        for (let i = 0; i < llcCalls.length; i++) {
          const callInfo = resolvedLlcCalls[i];
          if (!callInfo) continue;
          if (callInfo.type === 'stateful') {
            lowLevelCallOutputCount += 1 + callInfo.contract.inner.stateLayout!.dataNftCount;
          } else {
            lowLevelCallOutputCount += 1;
          }
        }
      }

      const entryOutputCount = entryNfts.filter((e) => {
      // A conditional soft-delete slot produces an output only when the entry exists (existence-gated); an
      // absent key is a no-op with no output.
        if (condSoftDeleteSlots.has(e.slotIndex)) return !!e.exists;
        return (!e.exists || e.utxo) && !entryDeleteSlots.has(e.slotIndex);
      }).length;
      const transferCount = abiFunction?.transferCount ?? 0;
      const satoshiContainerOutputCount = transferCount > 0 ? 1 : 0;
      const tokenContainerTransferCount = abiFunction?.tokenContainerAccesses
        ? abiFunction.tokenContainerAccesses.reduce((count, a) => {
          const ftCount = a.transferCount ?? (a.operations.includes('transfer') ? 1 : 0);
          const nftCount = a.transferNftCount ?? (a.operations.includes('transferNft') ? 1 : 0);
          return count + ftCount + nftCount;
        }, 0)
        : 0;
      const emitCount = abiFunction?.emits?.length ?? 0;

      const outStateOutputCount = externalOutStateUtxoGroups.reduce(
        (sum, g) => sum + 1 + g.dataNftUtxos.length + (g.keccakRecreates?.length ?? 0), 0,
      );
      const baseOutputOffset = 1 + requiredNftIndices.length
      + externalReadUtxos.length + outStateOutputCount + externalCallOutputCount + lowLevelCallOutputCount;
      returnEventOutputBase = baseOutputOffset + entryOutputCount + iterationEntryInputs.length
      + satoshiContainerOutputCount + transferCount + tokenContainerTransferCount + emitCount;
      externalCallOutputStart = 1 + requiredNftIndices.length + externalReadUtxos.length
      + outStateOutputCount + iterationEntryInputs.length;
    }

    // Build return-event-index map: groupIndex -> return event output index.
    // X13: the compiler publishes each callee's return event as a slot INSIDE that callee's own block. A callee
    // whose FULL block was assembled carries a paired funding input at that slot, so its return event belongs at
    // (that callee's output base + slot offset). A callee without a full block (a transitive A->B->C leaf) has no
    // such input, so it keeps the legacy tail position appended after the participant region.
    const returnEventIndexMap = new Map<number, number>();
    const isInBlockGroup = (i: number): boolean => groupOwnsInBlockReturnEvent(externalCallUtxoGroups, i);
    if (externalCallOutputStart >= 0) {
      let cursor = externalCallOutputStart;
      let tailRank = 0;
      for (let i = 0; i < externalCallUtxoGroups.length; i++) {
        const g = externalCallUtxoGroups[i];
        const offset = g.blockLayout?.slots.find((s) => s.kind === 'returnEvent')?.offset;
        if (groupMetas[i].ecSlot.hasReturnValues) {
          returnEventIndexMap.set(i, isInBlockGroup(i) && offset !== undefined
            ? cursor + offset
            : returnEventOutputBase + tailRank++);
        }
        cursor += g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length;
      }
    }

    const nestedBasesUnlockers = await finalizeCreateBuilderNestedBasesUnlockersImpl(
      {
        provider: host.inner.provider,
        physicalRootLockingBytecode: params.physicalSelfAddress,
        rootLogicalAddress: params.rootLogicalAddress,
        pendingAnchorFills,
        selectorParamSlot,
        isComputedBlockhashKey,
        noteBhLocktime: (locktime) => { maxBhLocktime = Math.max(maxBhLocktime, locktime); },
        extractGraphBlockhashRead: (contract, ...a) => contract._extractGraphBlockhashRead(...a),
        paramBlockhashN: (contract, ...a) => contract.paramBlockhashN(...a),
      },
      externalCallUtxoGroups,
      groupMetas,
      externalCallInputBase,
      returnEventIndexMap,
      timing,
    );
    const groupMasterIndices = nestedBasesUnlockers.groupMasterIndices;

    finalArgs = await fillCreateBuilderDirectCallArgWitnessesImpl(
      {
        inner: host.inner as any,
        resolveExternalArgs: (...a: any[]) => host.resolveExternalArgs(...a),
      },
      {
        abiFunction: abiFunction!,
        args,
        finalArgs,
        externalCallUtxoGroups,
        groupMetas,
        directGroupCount,
        loopIdxRanges,
        groupMasterIndices,
        externalCalls,
        returnEventOutputBase,
        returnEventIndexMap,
        callerStateSnapshot,
        onChainState,
        publicSelfAddress,
        identityAnchors,
        identityAnchorBandByAddress,
        externalCallAnchorIndices,
        topLevelAnchorFillPositions,
        topLevelReturnWitnessPlan,
        topLevelReturnWitnessGroups,
      },
    );
  }

  {
    const outStateResult = await loadCreateBuilderOutStateReadsImpl(
      {
        categoryId: host.categoryId,
        resolveExternalKeccakSideCars: (...a: any[]) => host.resolveExternalKeccakSideCars(...a),
      },
      {
        abiFunction,
        externalCalls,
        outStateOverrideCalls: overrides?.externalCalls as any,
        externalOutStateUtxoGroups,
        requiredNftIndices,
        externalReadUtxos,
        finalArgs,
      },
    );
    finalArgs = outStateResult.finalArgs;
    outStateInputCount = outStateResult.outStateInputCount;
  }


  return {
    rootProducerPath,
    externalCalls,
    externalCallUtxoGroups,
    allGroupEcSlots,
    allGroupParentIndices,
    sharedFunderPool,
    sharedFunderSnapshot,
    consumedSharedFunders,
    embeddedFunderUtxos,
    markSharedFunder,
    identityAnchors,
    identityAnchorBandByAddress,
    externalCallAnchorIndices,
    finalArgs,
    pendingAnchorFills,
    pendingExternalCallInputFills,
    pendingTokenCallInputFills,
    pendingDelegateInputFills,
    pendingDynamicChunkInputFills,
    topLevelAnchorFillPositions,
    topLevelReturnWitnessPlan,
    topLevelReturnWitnessGroups,
    externalOutStateUtxoGroups,
    outStateInputCount,
    maxBhLocktime,
  };
}
