/**
 * phase-boundary extract: SC _createBuilder extract — low-level-calls / nested-cache prelude:
 * shared funder snapshot for LLC, nested identity/state caches + helpers,
 * and hoisted LLC/delegate mutable state before the lowLevelCalls loop.
 */

import { binToHex } from '@bitauth/libauth';
import type { AbiFunction, Artifact, BlockSlotKind } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  logicalIdentityBandKey,
  resolveLogicalIdentity,
} from './logical-identity.js';
import type { PreparedAtomicMessageBusCall } from '../message-bus/compose.js';
import { selectKernelDelegateForwardingGroupIndex } from './KernelDelegateForwarding.js';
import { SortedList } from './SortedList.js';
import type { OnChainState } from './StateReader.js';
import type { StateValue } from '@solidcash/utils';
import { addressToLockScript } from '../utils.js';
import {
  deriveValueChunkProducerChildPath,
  type ValueChunkProducerPathDisposition,
} from './ValueChunkProducerIdentity.js';
import { externalCallTargetSourceLockingBytecodeHex } from './mapping-key-lookup.js';

export type PrepareCreateBuilderLowLevelNestedCachesHost = {
  readonly signer: any;
  readonly inner: any;
  syncMockParticipantOracle: (contract: any) => Promise<void>;
  resolveExternalArgs: (...args: any[]) => any;
};

export type PrepareCreateBuilderLowLevelNestedCachesResult = {
  lowLevelCalls: any;
  lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
  sharedFunderPool: UnlockableUtxo[] | undefined;
  sharedFunderSnapshot: UnlockableUtxo[] | undefined;
  nestedProxyReadCache: Map<string, Promise<StateValue>>;
  nestedFullStateCache: Map<string, Promise<OnChainState>>;
  nestedMasterStateCache: Map<string, Promise<OnChainState>>;
  nestedIdentityCache: Map<string, Promise<any>>;
  resolvedNestedIdentityCache: Map<string, any>;
  nestedAddressUtxoCache: Map<string, Promise<Utxo[]>>;
  nestedSortedListCache: Map<string, SortedList>;
  nestedAddressUtxos: (address: string) => Promise<Utxo[]>;
  nestedIdentity: (address: string) => Promise<any>;
  ensureNestedIdentityAnchorBand: (address: string) => Promise<number | undefined>;
  resolveNestedIdentityAnchorBands: (...args: any[]) => Promise<any>;
  directNestedIdentityWitness: (...args: any[]) => bigint;
  nestedFullState: (contract: any) => Promise<OnChainState>;
  nestedMasterState: (contract: any) => Promise<OnChainState>;
  lowLevelCallRawInputs: UnlockableUtxo[];
  lowLevelCallInputBase: number;
  activeDelegateGroupIndex: number | undefined;
  hasDelegatedDynamicReadChunks: boolean;
  delegateEventSlots: { kind: BlockSlotKind; offset: number; slotIndex?: number }[];
  delegateReturnEventOffset: number | undefined;
  groupProxyMasterIndices: number[];
  delegateExternalGroupIndices: Map<number, number[]>;
  delegateExternalGroupByCallsite: Map<number, Map<number, number>>;
  routeValueChunkProducerEpochByPhysicalGroup: WeakMap<ExternalCallUtxoGroup, number>;
  lateTransitiveGroupIndices: Set<number>;
  nestedDelegateProxyGroupByLowLevel: Map<number, number>;
  selectActiveRootDelegateGroup: () => number | undefined;
  preparedAtomicNodes: any[] | undefined;
  preparedAtomicNodeByExternalGroup: Map<number, number>;
  latestPreparedAtomicNodeByPhysicalGroup: Map<number, number>;
  preparedChildProducerPath: (
    parent: PreparedAtomicMessageBusCall | undefined,
    source: Pick<Parameters<typeof deriveValueChunkProducerChildPath>[0],
    'sourceCallsiteId' | 'sourceLogicalIndex' | 'occurrenceIndex' | 'sourceEffectOrdinal'>,
  ) => ValueChunkProducerPathDisposition;
  nestedFunderIndex: number;
};

/**
 * Initialize LLC shared funders, nested caches/helpers, and hoisted delegate
 * mutable state. Host continues with the lowLevelCalls materialization loop.
 */
export async function prepareCreateBuilderLowLevelNestedCaches(
  host: PrepareCreateBuilderLowLevelNestedCachesHost,
  params: {
    abiFunction: AbiFunction | undefined;
    physicalAbiFunction: AbiFunction | undefined;
    earlySignerUtxos: Utxo[] | undefined;
    sharedFunderPool: UnlockableUtxo[] | undefined;
    sharedFunderSnapshot: UnlockableUtxo[] | undefined;
    timingEnabled: boolean;
    externalCallUtxoGroups: ExternalCallUtxoGroup[];
    identityAnchors: UnlockableUtxo[];
    identityAnchorBandByAddress: Map<string, number>;
    [key: string]: any;
  },
): Promise<PrepareCreateBuilderLowLevelNestedCachesResult> {
  let sharedFunderPool = params.sharedFunderPool;
  let sharedFunderSnapshot = params.sharedFunderSnapshot;
  const {
    abiFunction, physicalAbiFunction, earlySignerUtxos, timingEnabled,
    externalCallUtxoGroups, identityAnchors, identityAnchorBandByAddress,
  } = params;

  // Handle low-level calls (address.call / address.staticcall)
  const lowLevelCalls = abiFunction?.lowLevelCalls;
  let lowLevelCallUtxoGroups: ExternalCallUtxoGroup[] = [];
  // Nested delegate composition needs the same positional funders as top-level external calls. Previously the
  // shared pool was initialized only by `externalCalls`, so a delegate-only caller minted one mock UTXO at a
  // time while assembling each nested block. Besides being unnecessary indexer mutation, that becomes
  // pathologically expensive for large artifacts under GC pressure. Reuse the already-captured signer snapshot.
  if (!sharedFunderPool && lowLevelCalls && lowLevelCalls.length > 0 && host.signer) {
    const signerUtxos = earlySignerUtxos ?? await host.signer.getUtxos();
    sharedFunderPool = signerUtxos.filter((utxo: Utxo) => !utxo.token).map((utxo: Utxo) => ({
      ...utxo, unlocker: host.signer!.unlockP2PKH(),
    }));
    sharedFunderSnapshot = [...(sharedFunderPool ?? [])];
  }
  const nestedProxyReadCache = new Map<string, Promise<StateValue>>();
  const nestedFullStateCache = new Map<string, Promise<OnChainState>>();
  const nestedMasterStateCache = new Map<string, Promise<OnChainState>>();
  const nestedIdentityCache = new Map<string, Promise<Awaited<ReturnType<typeof resolveLogicalIdentity>> | undefined>>();
  const resolvedNestedIdentityCache = new Map<string, Awaited<ReturnType<typeof resolveLogicalIdentity>>>();
  const nestedAddressUtxoCache = new Map<string, Promise<Utxo[]>>();
  const nestedSortedListCache = new Map<string, SortedList>();
  const nestedAddressUtxos = async (address: string): Promise<Utxo[]> => {
  // Always hit the provider. A same-assembly sibling write (or pad sync) can
  // land entry NFTs after an earlier HEAD-only fetch; caching the first Promise
  // froze INSERT layouts for later nested picks in the same prepare/send.
    const utxos = await host.inner.provider.getUtxos(address);
    nestedAddressUtxoCache.set(address, Promise.resolve(utxos));
    return utxos;
  };
  const nestedIdentity = (address: string): Promise<Awaited<ReturnType<typeof resolveLogicalIdentity>> | undefined> => {
    const bandKey = logicalIdentityBandKey(address);
    let pending = nestedIdentityCache.get(bandKey);
    if (!pending) {
      if (timingEnabled) console.error('nested-identity-fetch-start', { address, bandKey });
      pending = resolveLogicalIdentity(host.inner.provider, address).then((resolved) => {
        resolvedNestedIdentityCache.set(bandKey, resolved);
        if (timingEnabled) console.error('nested-identity-fetch-complete', {
          address, bandKey, txid: resolved.anchor.txid, vout: resolved.anchor.vout,
        });
        return resolved;
      }).catch((error) => {
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
          console.error('nested-identity-miss', address, error instanceof Error ? error.message : error);
        }
        if (!/missing or invalid/.test(error instanceof Error ? error.message : String(error))) throw error;
        // Do not cache a miss: a prefetch can run before the CREATE anchor is indexed.
        nestedIdentityCache.delete(bandKey);
        return undefined;
      });
      nestedIdentityCache.set(bandKey, pending);
    }
    return pending;
  };
  const ensureNestedIdentityAnchorBand = async (address: string): Promise<number | undefined> => {
    const bandKey = logicalIdentityBandKey(address);
    const existing = identityAnchorBandByAddress.get(bandKey);
    if (existing !== undefined) return existing;
    const resolved = resolvedNestedIdentityCache.get(bandKey) ?? await nestedIdentity(address);
    if (!resolved) return undefined;
    const band = identityAnchors.length;
    identityAnchors.push({ ...resolved.anchor, unlocker: resolved.unlocker } as UnlockableUtxo);
    identityAnchorBandByAddress.set(bandKey, band);
    return band;
  };
  const resolveNestedIdentityAnchorBands = async (
    ownerFunction: AbiFunction,
    visibleArgs: readonly FunctionArgument[],
    groupIndexForSlot: (slot: number) => number | undefined,
    ownerContext?: {
      contract: any;
      artifact: Artifact;
      state: Record<string, unknown>;
      executionSelfAddress: FunctionArgument;
    },
  ): Promise<{ anchorBandBySlot: Map<number, number>; proxyAnchorSlots: Set<number> }> => {
    const anchorBandBySlot = new Map<number, number>();
    const proxyAnchorSlots = new Set<number>();
    for (const input of ownerFunction.inputs) {
      const witness = input.name.match(/^__internal__extcallAnchorIdx(\d+)$/);
      if (!witness) continue;
      const slot = Number(witness[1]);
      const nestedGroupIndex = groupIndexForSlot(slot);
      const nestedGroup = nestedGroupIndex === undefined
        ? undefined : externalCallUtxoGroups[nestedGroupIndex];
      const callee = nestedGroup?.externalContract as any | undefined;
      const logicalAddress = callee?._logicalAddress ?? callee?.target ?? callee?.address;
      if (!logicalAddress) continue;
      const logicalLbc = binToHex(addressToLockScript(logicalAddress));
      const spentUnlocker = nestedGroup?.masterUtxo && 'unlocker' in nestedGroup.masterUtxo
        ? nestedGroup.masterUtxo.unlocker : undefined;
      const spentLock = spentUnlocker
        ? binToHex(spentUnlocker.generateLockingBytecode())
        : callee!.inner.lockingBytecode;
      // A source expression that already names the exact spent master needs no CREATE/SCID indirection. The
      // hidden anchor witness exists for both physical and logical address values; select it only for the latter.
      const call = ownerFunction.externalCalls?.[slot];
      const resolvedAddressSource = call?.addressSource && ownerContext
        ? ownerContext.contract._resolveExternalArgs(
          [call.addressSource], [...visibleArgs], ownerContext.artifact, ownerContext.state,
          ownerFunction.inputs, undefined, 0, false, ownerContext.executionSelfAddress,
        )?.[0]
        : call?.addressStateVar && ownerContext
          ? ownerContext.state[call.addressStateVar] as FunctionArgument | undefined
          : undefined;
      const sourceArgumentLock = externalCallTargetSourceLockingBytecodeHex(
        ownerFunction, slot, visibleArgs, resolvedAddressSource,
      );
      if (sourceArgumentLock === spentLock) continue;
      // Direct identity is valid only when the spent master is locked at the Solidity-visible address.
      if (logicalLbc === spentLock) continue;
      const band = await ensureNestedIdentityAnchorBand(logicalAddress);
      if (band === undefined) continue;
      anchorBandBySlot.set(slot, band);
      if (nestedGroup?.functionName === '__forward' || nestedGroup?.delegateCallGroupIndex !== undefined) {
        proxyAnchorSlots.add(slot);
      }
    }
    return { anchorBandBySlot, proxyAnchorSlots };
  };
  const directNestedIdentityWitness = (
    ownerFunction: AbiFunction,
    slot: number,
    nestedGroupIndex: number | undefined,
  ): bigint => {
    const nestedGroup = nestedGroupIndex === undefined
      ? undefined : externalCallUtxoGroups[nestedGroupIndex];
    const physicalGroup = nestedGroup === undefined ? undefined
      : externalCallUtxoGroups[nestedGroup.sharedGroupIndex ?? nestedGroupIndex!];
    const physicalDelegate = physicalGroup?.delegateCallGroupIndex === undefined
      ? undefined : lowLevelCallUtxoGroups[physicalGroup.delegateCallGroupIndex];
    const logicalFunction = ownerFunction.externalCalls?.[slot]?.functionName;
    const selectedFunction = physicalDelegate?.functionName ?? physicalGroup?.functionName;
    return physicalGroup?.compilerRoute || physicalDelegate?.compilerRoute
    || (logicalFunction !== undefined && selectedFunction !== logicalFunction) ? -2n : -1n;
  };
  const nestedFullState = (contract: any): Promise<OnChainState> => {
    let pending = nestedFullStateCache.get(contract.categoryId);
    if (!pending) {
      pending = (async () => {
        await host.syncMockParticipantOracle(contract);
        return contract.getFullState();
      })();
      nestedFullStateCache.set(contract.categoryId, pending);
    }
    return pending;
  };
  const nestedMasterState = (contract: any): Promise<OnChainState> => {
    let pending = nestedMasterStateCache.get(contract.categoryId);
    if (!pending) {
      pending = (async () => {
        await host.syncMockParticipantOracle(contract);
        return contract._getMasterOnlyState();
      })();
      nestedMasterStateCache.set(contract.categoryId, pending);
    }
    return pending;
  };
  let lowLevelCallRawInputs: UnlockableUtxo[] = [];
  let lowLevelCallInputBase = 0; // hoisted: the delegatecall-index auto-fill (below) needs it in this scope
  let activeDelegateGroupIndex: number | undefined;
  let hasDelegatedDynamicReadChunks = false;
  // Output-only (event/transfer) slots contributed by delegatecall'd impls: they are verified at
  // proxyMaster+offset, so they reserve funder inputs + outputs in the PROXY block, shifting the co-spent
  // impl UTXOs after them. Populated once below; drives lowLevelCallInputBase, block layout, and funders.
  let delegateEventSlots: { kind: BlockSlotKind; offset: number; slotIndex?: number }[] = [];
  // X56. Where a delegatecall'd impl that ALSO returns resolves its own return event, once the co-spent
  // implementation is known. The forwarder's reserved returnEvent slot moves here; the impl's event keeps the
  // position the forwarder had reserved for the return.
  let delegateReturnEventOffset: number | undefined;

  // Track per-group proxy master index for delegatecall composability
  const groupProxyMasterIndices: number[] = [];
  // External calls made by a delegate implementation are still independent co-spends:
  // the implementation executes against the proxy's state, but its callees must be
  // materialized in the ordinary external-call section. Keep the child group indices
  // per delegate group so its hidden witnesses can point at the real inputs/outputs.
  const delegateExternalGroupIndices = new Map<number, number[]>();
  const delegateExternalGroupByCallsite = new Map<number, Map<number, number>>();
  /** Latest logical writer allowed to publish producer metadata onto one shared physical call owner. */
  const routeValueChunkProducerEpochByPhysicalGroup = new WeakMap<ExternalCallUtxoGroup, number>();
  const lateTransitiveGroupIndices = new Set<number>();
  const nestedDelegateProxyGroupByLowLevel = new Map<number, number>();
  const selectActiveRootDelegateGroup = (): number | undefined => {
    if (!physicalAbiFunction?.delegateForwarding) return undefined;
    const candidateIndexes = lowLevelCallUtxoGroups.flatMap((group, groupIndex) => (
      group.callMode === 'delegatecall' && !nestedDelegateProxyGroupByLowLevel.has(groupIndex)
        ? [groupIndex] : []
    ));
    if (candidateIndexes.length === 0) return undefined;
    return selectKernelDelegateForwardingGroupIndex({
      forwarding: physicalAbiFunction.delegateForwarding,
      encodedProxyConstructorArgs: host.inner.encodedConstructorArgs,
      groups: lowLevelCallUtxoGroups,
      candidateIndexes,
    });
  };
type PreparedAtomicNode = PreparedAtomicMessageBusCall & {
  parent: number | null;
  callsiteId?: number;
  active: boolean;
  producerPath: ValueChunkProducerPathDisposition;
  /** Re-evaluate complete argument expressions after sibling return commitments are authenticated. */
  resolveArgsFromResults?: (
    results: ReadonlyMap<number, FunctionArgument>,
  ) => FunctionArgument[] | undefined;
  /** Apply authenticated sibling returns to this physical legacy call group. */
  refreshArgsFromResults?: (
    results: ReadonlyMap<number, FunctionArgument>,
  ) => boolean;
  /**
   * Re-derive this row's terminal chunkable-value productions against a complete route row list.
   *
   * A row discovery only sees its own callsite, so a resource written by several reached rows would publish a
   * value that stops at the row planned last. The compiled program chunks the post-state after every row it
   * executes, so the promotion pass re-runs this derivation over the owner's whole row list.
   */
  deriveRouteValueChunkProductions?: (
    rows: readonly any[],
  ) => NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']>;
};
let preparedAtomicNodes: PreparedAtomicNode[] | undefined;
const preparedAtomicNodeByExternalGroup = new Map<number, number>();
// Logical aliases retain their own node index for convergence. Reused physical groups separately point at the
// latest reached callsite, so a later sequential row is copied wholly from one stable node rather than mixing
// mutable physical arguments with the selector/path of the first call that happened to allocate the group.
const latestPreparedAtomicNodeByPhysicalGroup = new Map<number, number>();
const preparedChildProducerPath: PrepareCreateBuilderLowLevelNestedCachesResult['preparedChildProducerPath'] = (
  parent,
  source,
) => {
  if (!parent?.producerPath) return Object.freeze({ status: 'unavailable' });
  return deriveValueChunkProducerChildPath({
    parent: parent.producerPath,
    parentExecutionLockingBytecode: parent.executor?.inner.lockingBytecode
      ?? parent.contract.inner.lockingBytecode,
    parentSelector: parent.selector,
    sourceCallsiteId: source.sourceCallsiteId,
    ...(source.sourceLogicalIndex !== undefined && {
      sourceLogicalIndex: source.sourceLogicalIndex,
    }),
    occurrenceIndex: source.occurrenceIndex,
    sourceEffectOrdinal: source.sourceEffectOrdinal,
  });
};
let nestedFunderIndex = 0;

return {
  lowLevelCalls,
  lowLevelCallUtxoGroups,
  sharedFunderPool,
  sharedFunderSnapshot,
  nestedProxyReadCache,
  nestedFullStateCache,
  nestedMasterStateCache,
  nestedIdentityCache,
  resolvedNestedIdentityCache,
  nestedAddressUtxoCache,
  nestedSortedListCache,
  nestedAddressUtxos,
  nestedIdentity,
  ensureNestedIdentityAnchorBand,
  resolveNestedIdentityAnchorBands,
  directNestedIdentityWitness,
  nestedFullState,
  nestedMasterState,
  lowLevelCallRawInputs,
  lowLevelCallInputBase,
  activeDelegateGroupIndex,
  hasDelegatedDynamicReadChunks,
  delegateEventSlots,
  delegateReturnEventOffset,
  groupProxyMasterIndices,
  delegateExternalGroupIndices,
  delegateExternalGroupByCallsite,
  routeValueChunkProducerEpochByPhysicalGroup,
  lateTransitiveGroupIndices,
  nestedDelegateProxyGroupByLowLevel,
  selectActiveRootDelegateGroup,
  preparedAtomicNodes,
  preparedAtomicNodeByExternalGroup,
  latestPreparedAtomicNodeByPhysicalGroup,
  preparedChildProducerPath,
  nestedFunderIndex,
};
}
