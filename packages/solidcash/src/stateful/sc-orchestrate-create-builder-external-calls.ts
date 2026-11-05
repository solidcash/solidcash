/**
 * phase-boundary extract: SC _createBuilder extract — external-calls orchestration before LLC:
 * expand/resolve callees, shared funders, nested callee blocks, transitive
 * discovery, bases/unlockers, direct-call arg witnesses, and outState reads.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX,
  encodePushdataValue,
  parseChunkCommitment,
  type AbiFunction,
  type ExternalCallAbi,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { addressToLockScript } from '../utils.js';
import { signerFundingCoins } from '../framed/deploy/own-coin.js';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import { calleePinsNoRecord, type ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { consolidateDirectCallBatches, planDirectCallBatches } from './direct-call-batch.js';
import { encodeExternalReturnValue } from './external-return-encoding.js';
import { resolveExternalResultEncoding } from './solidityAbi.js';
import { groupOwnsInBlockReturnEvent } from './value-chunk-geometry.js';
import { createReadOnlyDynamicChunkUnlocker, getDynamicChunkAddress } from './covenant-helpers.js';
import { defaultInternalFunctionArg } from './kernel-journal-helpers.js';
import type { ExternalGroupMeta } from './stateful-lifecycle-types.js';
import type { ExternalCallInfo } from './StatefulContract.js';
import { isScidIdentityCommitment } from './logical-identity.js';
import { sortedAddressPairPacked } from './solidityAbi.js';
import { ensureOrdinarySelfIdentityBand } from './ordinary-self-identity.js';
import {
  findDeploymentByAddress, findDeploymentByAddressValue, isCreate2ProjectedAddressValue, listDeployments,
  registeredExecutionLockingBytecode,
} from './deployment-registry.js';
import {
  deriveValueChunkProducerChildPath,
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
import { buildSharedMethodExternalBatch } from './sc-build-shared-method-external-batch.js';
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

/**
 * A raw call into a function that pins no record (D50) plans no carrier, so the caller's return witness stays -1,
 * as late expansion plans it.
 */
function directGroupEcSlot(ec: ExternalCallAbi, group: ExternalCallUtxoGroup | undefined): ExternalCallAbi {
  if (ec.interfaceName !== '__raw__' || !ec.hasReturnValues || !group || group.compilerRoute) return ec;
  return calleePinsNoRecord(group) ? { ...ec, hasReturnValues: false } : ec;
}

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
  resolveExternalBlockhashCoSpends: (...args: any[]) => any;
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
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_EXTCALL === '1') {
    console.error('extcall-enter', JSON.stringify({ name: params.abiFunction?.name, calls: (params.abiFunction as any)?.externalCalls?.length }));
  }
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
  // The root co-spends a coin of its own pool at its block-info slot; a nested reader of that pool shares it.
  const sharedBlockOraclePools = new Set<string>();
  if (host.inner.oraclePool !== undefined
    && abiFunction?.blockLayout?.slots.some((slot) => slot.kind === 'blockInfoOracle')) {
    sharedBlockOraclePools.add(host.inner.oraclePool);
  }


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

  // A computed loop target (`IFoo(pairFor(.., path[i], ..)).m()`) is rewritten by the compiler to a synthesized
  // `__internal__loopTargets<n>[i]` witness the SDK fills from the interface's registered instances. A legacy
  // caller (an original EVM test, a plain `getContractAt` user) never calls registerExternalArray, so without a
  // fallback the witness stays empty and every reached iteration fails its bounds check with an opaque
  // `OP_VERIFY`. Derive the candidates from the computed shape itself: a factory-created pair's CREATE2 salt is
  // `keccak256(sort(tokenA, tokenB))`, so each adjacent pair of the loop's source array names exactly one child.
  // Selecting by salt (rather than "every pair ever deployed") keeps a session with several factories and pairs
  // from silently feeding a later test's loop with an earlier test's pairs.
  // The loop's source array: the iteration domain's continue condition measures the forwarded `path`. Fall back to
  // the only `address[]` input when the domain is elided.
  const forwardedParams = new Set<number>();
  const collectForwardedParams = (value: unknown, depth = 0): void => {
    if (depth > 8 || !value || typeof value !== 'object') return;
    const record = value as { kind?: unknown; paramIndex?: unknown; [key: string]: unknown };
    if (record.kind === 'forward' && typeof record.paramIndex === 'number') {
      forwardedParams.add(record.paramIndex);
    }
    for (const [key, child] of Object.entries(record)) {
      if (key === 'kind') continue;
      if (Array.isArray(child)) child.forEach((entry) => collectForwardedParams(entry, depth + 1));
      else if (child && typeof child === 'object') collectForwardedParams(child, depth + 1);
    }
  };
  const addressArrayInputs = (abiFunction?.inputs ?? [])
    .map((input, index) => ({ input, index }))
    .filter(({ input }) => String(input.type).replace(/\s/gu, '').startsWith('address[]'));
  for (const loopSlot of abiFunction?.externalCalls ?? []) {
    if (!loopSlot.loopArrayVar?.startsWith('__internal__loopTargets')
      || host.inner.getExternalTargetEntriesByInterface(loopSlot.interfaceName).length > 0) continue;
    const iface = host.inner.artifact?.externalInterfaces?.find(
      (entry: { name?: string }) => entry.name === loopSlot.interfaceName,
    );
    const required = new Set<string>((iface?.abi ?? [])
      .map((fn: { selector?: string }) => fn.selector)
      .filter((selector: string | undefined): selector is string => typeof selector === 'string'));
    if (required.size === 0) continue;
    const implementsInterface = (deployment: (ReturnType<typeof listDeployments>)[number]): boolean => {
      const instance = deployment.contract as {
        inner?: { artifact?: { abi?: Array<{ selector?: string }> } };
      } | undefined;
      const available = new Set((instance?.inner?.artifact?.abi ?? [])
        .map((fn) => fn.selector)
        .filter((selector): selector is string => typeof selector === 'string'));
      return [...required].every((selector) => available.has(selector));
    };
    const deployments = listDeployments(host.inner.provider)
      .filter((deployment) => deployment.parentAddress !== undefined && implementsInterface(deployment));

    // Adjacent pairs of the source array, in path order, are the order the compiler indexes the witness by.
    forwardedParams.clear();
    collectForwardedParams(loopSlot.iterationDomain);
    const sourceInput = addressArrayInputs.find(({ index }) => forwardedParams.has(index))
      ?? (addressArrayInputs.length === 1 ? addressArrayInputs[0] : undefined);
    const sourceValues = sourceInput === undefined ? undefined : args?.[sourceInput.index];
    const nativeLock = (value: unknown): Uint8Array | undefined => {
      if (value instanceof Uint8Array) return value;
      if (typeof value !== 'string') return undefined;
      // A Solidity `address` argument minted from a contract handle names that deployment's LOGICAL identity. The
      // factory hashed the callee's execution lock when it salted the child (the scalar address encoder resolves
      // the handle the same way), so use the registered execution lock here rather than the identity lock the
      // cashaddr string spells.
      const deployment = findDeploymentByAddress(host.inner.provider, value);
      const execution = deployment === undefined ? undefined : registeredExecutionLockingBytecode(deployment);
      if (execution !== undefined) return hexToBin(execution.replace(/^0x/iu, ''));
      try {
        return /^(bchtest|bitcoincash|bchreg|chipnet):/iu.test(value)
          ? addressToLockScript(value) : hexToBin(value.replace(/^0x/iu, ''));
      } catch {
        return undefined;
      }
    };
    const pairSaltSets: Set<string>[] | undefined = (() => {
      if (!Array.isArray(sourceValues) || sourceValues.length < 2) return undefined;
      const locks = sourceValues.map(nativeLock);
      if (locks.some((lock) => lock === undefined)) return undefined;
      const sets: Set<string>[] = [];
      for (let index = 0; index + 1 < locks.length; index += 1) {
        const left = locks[index]!;
        const right = locks[index + 1]!;
        const salts = new Set<string>();
        // `createPair` salts `keccak256(abi.encodePacked(token0, token1))`. The covenant sorts the native
        // addresses and packs them by the factory artifact's address form; try both forms so this resolution does
        // not have to guess which factory variant deployed the child.
        for (const hashAddresses of [true, false]) {
          const packed = sortedAddressPairPacked(left, right, hashAddresses);
          if (packed !== undefined) salts.add(binToHex(keccak_256(packed)));
        }
        sets.push(salts);
      }
      return sets;
    })();

    const bySalt = new Map<string, (typeof deployments)[number]>();
    for (const deployment of deployments) {
      const salt = deployment.salt?.replace(/^0x/iu, '').toLowerCase();
      if (salt !== undefined) bySalt.set(salt, deployment);
    }
    const ordered = pairSaltSets?.map((salts) => {
      for (const salt of salts) {
        const deployment = bySalt.get(salt);
        if (deployment !== undefined) return deployment;
      }
      return undefined;
    }).filter((deployment): deployment is (typeof deployments)[number] => deployment !== undefined)
      ?? [];
    const candidates = pairSaltSets === undefined || ordered.length === 0 ? deployments : ordered;

    const seenLocks = new Set<string>();
    const instances: unknown[] = [];
    for (const deployment of candidates) {
      const instance = deployment.contract as {
        inner?: { lockingBytecode?: Uint8Array | string };
      } | undefined;
      const lock = instance?.inner?.lockingBytecode;
      const lockHex = typeof lock === 'string'
        ? lock
        : lock === undefined ? deployment.lockingBytecode : binToHex(lock);
      if (lockHex === undefined || seenLocks.has(lockHex)) continue;
      seenLocks.add(lockHex);
      instances.push(instance);
    }
    if (instances.length > 0) {
      host.callerContract.registerExternalArray(loopSlot.interfaceName, instances as never);
    }
  }

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
      isCreate2ProjectedAddressValue: (value) =>
        isCreate2ProjectedAddressValue(host.inner.provider, value),
      getFullState: () => host.getFullState(),
      probeRawCallee: host.probeRawCallee === undefined
        ? undefined : (...a: any[]) => host.probeRawCallee!(...a),
    },
    abiFunction,
    args,
    host.inner.artifact,
    publicSelfAddress,
    overrides?.externalCalls,
    overrides?.returnProbeOnly === true,
  );
  let externalCalls = expandedExternal.externalCalls;
  const absentCalleeSlots = expandedExternal.absentCalleeSlots;
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_EXTCALL === '1') {
    console.error('extcall-expanded', JSON.stringify({
      calls: externalCalls?.length, resolved: expandedExternal.resolvedExternalCalls?.length,
      resolvedKeys: expandedExternal.resolvedExternalCalls?.map((c: any) => c && Object.keys(c).slice(0, 6)),
      overridesCalls: params.overrides?.externalCalls?.length,
    }));
  }
  const loopIdxRanges = expandedExternal.loopIdxRanges;
  let callerStateSnapshot = expandedExternal.callerStateSnapshot;
  let resolvedExternalCalls = expandedExternal.resolvedExternalCalls as ExternalCallInfo[] | undefined;
  // A direct caller's grouped calls run as frames of one multi-call spend of their callee, in execution order.
  const directBatches = await planDirectCallBatches(
    {
      planExternalCallOccurrences: (call, frame) => host.callerContract._planExternalCallOccurrences(call, frame),
      resolveExternalExpressionReturns: (sources, functionArgs, state, callerInputs, self, producerCalls) =>
        host.callerContract._resolveExternalExpressionReturns(
          sources, functionArgs, host.callerContract, state, callerInputs, self, producerCalls, false,
        ),
      evaluateExternalExpression: (...a: any[]) => host.callerContract._evaluateExternalExpression(...a),
      hydrateExternalPredicateState: (...a: any[]) => host.callerContract._hydrateExternalPredicateState(...a),
      getFullState: () => host.getFullState(),
    },
    {
      abiFunction,
      args,
      artifact: host.inner.artifact,
      externalCalls,
      resolvedExternalCalls: resolvedExternalCalls as any,
      callerState: callerStateSnapshot,
      publicSelfAddress,
    },
  );
  externalCalls = directBatches.externalCalls;
  resolvedExternalCalls = directBatches.resolvedExternalCalls as ExternalCallInfo[] | undefined;
  callerStateSnapshot = directBatches.callerState;

  // A published callsite that the planner reaches but cannot pin has no co-spendable callee. Building anyway
  // leaves its topology witnesses at their defaults (every master index 0), which the caller covenant rejects
  // with an unrelated `OP_VERIFY`. A probe intentionally tolerates unresolved groups; a real build must not.
  if (externalCalls && externalCalls.length > 0 && !resolvedExternalCalls) {
    const reached = externalCalls.filter((call) => call.occurrence !== 'conditional');
    if (reached.length > 0) {
      const names = reached.slice(0, 4).map((call) => `${call.interfaceName}.${call.functionName}`).join(', ');
      throw new Error(
        `External call planning could not pin the callee for ${names}`
        + `${reached.length > 4 ? ` and ${reached.length - 4} more` : ''}. Each callee needs a live, `
        + 'co-spendable deployment whose locking bytecode projects to the published address; a target created '
        + 'in this same transaction has no spendable UTXO yet, and an EVM CREATE2 identity has no BCH lock '
        + 'projection. Supply the callees with withExternalCall() only when a real co-spend exists.',
      );
    }
  }

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

  // A raw call with no co-spent callee still publishes witnesses (its negative sentinels and, for a value
  // transfer, the transfer's output coordinate), so the witness fill must run even when no group exists.
  const hasAbsentCalleeSlots = (absentCalleeSlots?.size ?? 0) > 0;
  if (externalCalls && (externalCalls.length > 0 || hasAbsentCalleeSlots) && resolvedExternalCalls) {

    // Count total funders needed across all B blocks and snapshot the signer pool once.
    if (host.signer) {
      const allocated = await allocateCreateBuilderSharedFundersImpl(
        {
          getSignerUtxos: () => signerFundingCoins(host.signer!),
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
        bKeccak,
        bDynamicChunkInputs,
      } = nestedPrelude;
      const bSc = nestedPrelude.bSc as unknown as any;
      let bDirectChunkValue = nestedPrelude.bDirectChunkValue;
      let bValueChunkOutputCount = nestedPrelude.bValueChunkOutputCount;

      // Build B's full block inputs when B's function has entries/events/transfers
      let bBlockInputs: UnlockableUtxo[] | undefined;
      let bStreamedEventPlan: ExternalCallUtxoGroup['streamedEventPlan'];
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
      const bBatchEntryLockingBytecodes = new Map<number, Uint8Array>();

      if (bBlockLayout && callInfo) {
        const nestedBlockCtx = {
          bBlockInputs,
          bStreamedEventPlan,
          bReturnEventInBlock,
          bCompilerInternalArgs,
          bPlannedEntryInserts,
          bRelativeOutputInternalArgs,
          bBatchEntryLockingBytecodes,
          bBlockLayout,
          bHasLoop,
          bSc,
          bAbiFunc,
          bState,
          bDataNfts,
          bStatelayout,
          bRequiredNftIndices,
          bValueChunkOutputCount,
          bDirectChunkValue,
          bKeccak,
          compilerRoute,
          callInfo,
          externalCategoryId,
          slotIndex,
          loopIdxRanges,
          publicSelfIdentity,
        };
        await assembleCreateBuilderNestedCalleeBlockInputsImpl(
          {
            getUtxos: (address: string) => host.inner.provider.getUtxos(address),
            keysMatch: (...a: any[]) => host.keysMatch(...a),
            encodeStoredElementSource: (...a: any[]) => host.callerContract._encodeStoredElementSource(...a),
            sharedBlockOraclePools,
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
        bStreamedEventPlan = nestedBlockCtx.bStreamedEventPlan;
        bDirectChunkValue = nestedBlockCtx.bDirectChunkValue;
        bValueChunkOutputCount = nestedBlockCtx.bValueChunkOutputCount;
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
            // The loop's published domain, with the results it reads from earlier calls (`size() - offset`).
            // An unresolved domain leaves the count unknown: the group then keeps its one-record plan.
            planLoopOccurrenceCount: async (call: ExternalCallAbi): Promise<number | undefined> => {
              const domain = call.iterationDomain;
              if (!domain) return undefined;
              try {
                const state = callerStateSnapshot ?? (await host.getFullState()).state;
                const externalReturns = await host.callerContract._resolveExternalExpressionReturns(
                  [domain.initialValue, domain.stepValue, domain.continueCondition]
                    .map((expression) => ({ kind: 'expression', expression })),
                  args, host.callerContract, state, abiFunction?.inputs, publicSelfAddress,
                  abiFunction?.externalCalls ?? [], false,
                );
                const occurrences = await host.callerContract._planExternalCallOccurrences(call, {
                  functionArgs: args,
                  artifact: host.inner.artifact,
                  state,
                  callerInputs: abiFunction?.inputs,
                  executionSelfAddress: publicSelfAddress,
                  externalReturns,
                });
                return occurrences.length;
              } catch {
                return undefined;
              }
            },
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
            ordinaryProducerPath: !compilerRoute && !ec.batchInvocations
              && (ec.occurrence === 'once' || (ec.occurrence === 'conditional' && ec.maximumOccurrences === 1))
              ? deriveValueChunkProducerChildPath({
                parent: rootProducerPath,
                parentExecutionLockingBytecode: host.inner.lockingBytecode,
                parentSelector: abiFunction?.selector,
                sourceCallsiteId: ec.callsiteId,
                occurrenceIndex: 0,
                sourceEffectOrdinal: ec.sourceEffectOrdinal,
              }) : undefined,
            callInfo,
            ec,
            externalCategoryId,
            publicSelfIdentity,
            publicSelfAddress,
            returnProbeOnly: overrides?.returnProbeOnly,
          } as any,
        );
        const materializedGroup = externalCallUtxoGroups[externalCallUtxoGroups.length - 1];
        if (bStreamedEventPlan && materializedGroup.sharedGroupIndex === undefined) {
          materializedGroup.streamedEventPlan = bStreamedEventPlan;
        }
        // Keyed by offsets of this exact block, so only the group owning these inputs may carry it.
        const blockOwner = materializedGroup.sharedGroupIndex === undefined
          ? materializedGroup : externalCallUtxoGroups[materializedGroup.sharedGroupIndex];
        if (bBatchEntryLockingBytecodes.size > 0 && blockOwner?.blockInputs === bBlockInputs) {
          blockOwner.batchEntryLockingBytecodes = bBatchEntryLockingBytecodes;
        }
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

    await consolidateDirectCallBatches({
      deriveFrameResult: async (group, frameFunction, frameArgs) => {
        const callee = group.externalContract;
        const calleeArtifact = callee.inner.artifact;
        const output = frameFunction.outputs?.length === 1 ? frameFunction.outputs[0]! : undefined;
        if (output === undefined) {
          throw new Error(`A multi-call frame of ${calleeArtifact.contractName}.${frameFunction.name}() must return `
            + 'one value');
        }
        const value = await callee._deriveReturnValue(
          frameFunction.name, [...frameArgs], undefined, frameFunction, undefined,
          publicSelfAddress, host.categoryId, host.callerContract,
        );
        return encodeExternalReturnValue(
          value, output.type, calleeArtifact.structs ?? calleeArtifact.stateLayout?.structs,
          resolveExternalResultEncoding(
            frameFunction.resultEncoding, calleeArtifact, [output.type], `function '${frameFunction.name}' result`,
          ) === 'evm-abi-v1',
          calleeArtifact.enums,
        );
      },
    }, externalCallUtxoGroups);

    // Track per-group metadata (direct + transitive)
    const groupMetas: ExternalGroupMeta[] = [];
    const directGroupCount = externalCallUtxoGroups.length;

    // Build metadata for direct groups
    for (let i = 0; i < directGroupCount; i++) {
      groupMetas.push({
        ecSlot: directGroupEcSlot(externalCalls[i], externalCallUtxoGroups[i]),
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
      async (shared, next, callee) => buildSharedMethodExternalBatch(
        { buildRepeatedExternalBatch: (...a: any[]) => host.buildRepeatedExternalBatch(...a) },
        shared,
        next,
        callee,
        {
          artifact: host.inner.artifact,
          state: callerStateSnapshot ?? onChainState?.state,
          inputs: abiFunction?.inputs ?? [],
          selfAddress: publicSelfAddress,
          identity: publicSelfIdentity,
        },
      ),
    );

    // _externalCallInputBase: runtime param (needed for mutual A<->B calls)
    // When the function reads a dynamic-storage array, its chunk run precedes the callees only in the legacy
    // (layout-less) input order or when the caller's block reserves trailing slots for it; the base then advances
    // by the chunk count. Dense placement otherwise keeps the caller's complete block first and appends the
    // callee blocks ahead of the run (see buildInputs), so the run does not shift them. The assembled
    // transaction rebinds the base and every framedee index afterwards; this plan only has to agree with it.
    const chunkRunPrecedesCallees = abiFunction?.blockLayout === undefined
      || abiFunction.blockLayout.slots.some((slot) => slot.kind === 'trailing');
    const chunkRunBeforeCallees = chunkRunPrecedesCallees ? iterationEntryInputs.length : 0;
    let externalCallInputBase = 1 + requiredNftIndices.length + externalReadUtxos.length + outStateInputCount;
    // message-bus batch reserves the complete oracle row band before its callees. Active reads are sparse; count the
    // physical width, not the number of resolved oracle UTXOs, when assigning the first participant base.
    externalCallInputBase += abiFunction?.graphBlockhashOracle?.slotCount ?? 0;
    externalCallInputBase += chunkRunBeforeCallees;
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
      if (inp.name.startsWith('__internal__loopTargetStride')) {
        // One occurrence's physical input width: a pair's getReserves() co-spends its master and the data NFT that
        // holds the reserves, so the next occurrence's master is this far past the previous one. The compiler cannot
        // see a callee's private state footprint, so it multiplies the loop index by this witness instead.
        const witnessName = `__internal__loopTargets${inp.name.slice('__internal__loopTargetStride'.length)}`;
        const wSlot = abiFunction?.externalCalls?.find((ec) => ec.loopArrayVar === witnessName);
        const callsiteGroups = wSlot?.callsiteId === undefined ? []
          : externalCallUtxoGroups.filter((group) => group.sourceCallsiteId === wSlot.callsiteId);
        const candidate = callsiteGroups.find((group) => (group.blockInputs?.length ?? 0) > 0)
          ?? callsiteGroups[0];
        const physical = candidate?.sharedGroupIndex === undefined ? candidate
          : externalCallUtxoGroups[candidate.sharedGroupIndex] ?? candidate;
        const stride = physical === undefined
          ? 1 + (wSlot?.requiredDataNftIndices?.length ?? 0)
          : physical.blockInputs ? physical.blockInputs.length
            : 1 + physical.dataNftUtxos.length;
        finalArgs = [...finalArgs, BigInt(stride)];
        continue;
      }
      if (inp.name.startsWith('__internal__computedCallTarget')) {
        // A straight-line computed target (`IFoo(pairFor(..)).m()`) evaluates on-chain to an EVM identity (a keccak
        // CREATE2 address for pairFor), which no BCH locking bytecode projects to. The compiler therefore pins the
        // co-spent callee against this witness; supply the resolved deployment's exact lock. The callee itself was
        // resolved from the same callsite's address source above, so this is the deployment the call names.
        const slotIndex = Number(inp.name.slice('__internal__computedCallTarget'.length));
        const ec = abiFunction?.externalCalls?.[slotIndex];
        const group = ec?.callsiteId === undefined ? undefined
          : externalCallUtxoGroups.find((candidate) => candidate.sourceCallsiteId === ec.callsiteId);
        const physical = group?.sharedGroupIndex === undefined ? group
          : externalCallUtxoGroups[group.sharedGroupIndex] ?? group;
        const lock = physical?.externalContract?.inner?.lockingBytecode;
        finalArgs = [...finalArgs, typeof lock === 'string' ? hexToBin(lock)
          : lock instanceof Uint8Array ? lock : new Uint8Array()];
        continue;
      }
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
        (sum, g) => sum + 1 + g.dataNftUtxos.length + (g.blockhashCoSpendRecreates?.length ?? 0)
          + (g.keccakRecreates?.length ?? 0), 0,
      );
      // Fixed block slots realized as outputs between the caller's data NFTs and the participant region: a keccak
      // side-car recreation, an ecrecover side-car, and the caller's own return event. The master + data-NFT
      // prefix below does not count them, so a caller that hashes before its external calls used to place the
      // callee blocks - and the planned return-event index - early enough to collide with a callee's data NFT.
      // A void entry's returnEvent slot is its call record, which a plain send compacts.
      const returnsValues = (abiFunction?.outputs?.length ?? 0) > 0;
      const fixedExtraBlockSlotCount = (abiFunction?.blockLayout?.slots ?? []).filter((slot) => (
        slot.kind === 'keccakSideCar' || slot.kind === 'ecrecoverSideCar'
        || (slot.kind === 'returnEvent' && returnsValues)
      )).length;
      const baseOutputOffset = 1 + requiredNftIndices.length
      + externalReadUtxos.length + outStateOutputCount + externalCallOutputCount + lowLevelCallOutputCount
      + fixedExtraBlockSlotCount;
      returnEventOutputBase = baseOutputOffset + entryOutputCount + iterationEntryInputs.length
      + satoshiContainerOutputCount + transferCount + tokenContainerTransferCount + emitCount;
      externalCallOutputStart = 1 + requiredNftIndices.length + externalReadUtxos.length
      + outStateOutputCount + chunkRunBeforeCallees + fixedExtraBlockSlotCount;
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
      // A multi-call unit reads its frame's record in the batch block of the unit spending the callee master.
      const batchCursors = new Map<number, number>();
      for (let i = 0; i < externalCallUtxoGroups.length; i++) {
        const g = externalCallUtxoGroups[i];
        const offset = g.blockLayout?.slots.find((s) => s.kind === 'returnEvent')?.offset;
        if (g.callBatch !== undefined) batchCursors.set(i, cursor);
        const batchUnit = g.callBatchUnit;
        const batchPhysical = batchUnit?.physical === undefined ? undefined : externalCallUtxoGroups[batchUnit.physical];
        if (batchUnit !== undefined && batchPhysical?.callBatch !== undefined
          && batchCursors.has(batchUnit.physical!)) {
          returnEventIndexMap.set(i, batchCursors.get(batchUnit.physical!)! + batchPhysical.callBatch.recordOffset
            + batchUnit.witnessOffset);
        } else if (groupMetas[i].ecSlot.hasReturnValues) {
          // A callee that pins no record carries none, even though a raw call's slot declares
          // `(bool, bytes)`. State the absent coordinate so the caller reads empty returndata; it must not claim
          // a tail slot another group's carrier occupies.
          if (calleePinsNoRecord(g)) returnEventIndexMap.set(i, -1);
          else {
            returnEventIndexMap.set(i, isInBlockGroup(i) && offset !== undefined
              ? cursor + offset
              : returnEventOutputBase + tailRank++);
          }
        }
        cursor += g.blockInputs ? g.blockInputs.length : 1 + g.dataNftUtxos.length;
      }
    }

    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_EXTCALL === '1') {
      console.error('extcall-groups', JSON.stringify({
        externalCallOutputStart, returnEventOutputBase,
        groups: externalCallUtxoGroups.map((g, i) => ({
          i, name: g.functionName, hasReturn: groupMetas[i]?.ecSlot.hasReturnValues,
          inBlock: isInBlockGroup(i), offset: g.blockLayout?.slots.find((s) => s.kind === 'returnEvent')?.offset,
        })),
        map: [...returnEventIndexMap.entries()],
      }));
    }
    const nestedBasesUnlockers = await finalizeCreateBuilderNestedBasesUnlockersImpl(
      {
        provider: host.inner.provider,
        physicalRootLockingBytecode: params.physicalSelfAddress,
        rootLogicalAddress: params.rootLogicalAddress,
        blockOracle: host.inner.oraclePool !== undefined
          && abiFunction?.blockLayout?.slots.some((slot) => slot.kind === 'blockInfoOracle')
          ? { pool: host.inner.oraclePool,
            inputIndex: (overrides?.blockBase ?? 0)
              + abiFunction.blockLayout.slots.find((slot) => slot.kind === 'blockInfoOracle')!.offset }
          : undefined,
        pendingAnchorFills,
        ensureOrdinarySelfIdentityBand: (contract, selected) => ensureOrdinarySelfIdentityBand(
          contract, selected, identityAnchors, identityAnchorBandByAddress,
        ),
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
        absentCalleeSlots,
      },
    );
  }

  {
    const outStateResult = await loadCreateBuilderOutStateReadsImpl(
      {
        categoryId: host.categoryId,
        resolveExternalKeccakSideCars: (...a: any[]) => host.resolveExternalKeccakSideCars(...a),
        resolveExternalBlockhashCoSpends: (...a: any[]) => host.resolveExternalBlockhashCoSpends(...a),
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
    maxBhLocktime = Math.max(maxBhLocktime, outStateResult.maxBhLocktime);
  }


  // F1: tag each co-spent call with its caller and the slot it occupies in that caller, so the builder pins each
  // caller's edge in the caller's own category. A top-level call's slot is its group index (groups map 1:1 to the
  // entry's external-call slots); a nested call's slot is its position among its parent's co-spent callees.
  {
    const siblingSlot = new Map<number, number>();
    for (let i = 0; i < externalCallUtxoGroups.length; i++) {
      const parent = allGroupParentIndices[i] ?? -1;
      externalCallUtxoGroups[i].edgeParentIndex = parent;
      if (parent < 0) {
        externalCallUtxoGroups[i].edgeEcSlot = i;
      } else {
        const next = siblingSlot.get(parent) ?? 0;
        externalCallUtxoGroups[i].edgeEcSlot = next;
        siblingSlot.set(parent, next + 1);
      }
    }
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
