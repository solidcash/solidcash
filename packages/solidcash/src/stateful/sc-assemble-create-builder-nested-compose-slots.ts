/**
 * phase-boundary extract: SC _createBuilder extract — nested-compose selectedLayout slot assembly + primary publish.
 */

import { foldRouteStoredValues, type StoredValueMutationRow } from './fold-route-stored-values.js';
import type { StoredValueIncomingEntry } from './sc-encode-stored-element-source.js';
import {
  binToHex, hexToBin, encodeLockingBytecodeP2pkh,
} from '@bitauth/libauth';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX,
  computeCollectionHash,
  encodePushdataValue,
  joinValueChunks,
  parseChunkCommitment,
  parseValueChunkCommitment,
  sha256 as sha256Sync,
  VALUE_CHUNK_SIZE,
  VALUE_HEAD_SIZE,
  VALUE_INLINE_LIMIT,
  type AbiFunction,
  type Artifact,
  type ExternalCallAbi,
  type FunctionBlockLayout,
  type StateLayout,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import type { PreparedAtomicMessageBusCall } from '../message-bus/compose-prepared-invocation.js';
import { addressToLockScript } from '../utils.js';
import { permitsLegacyNamedValueChunkFallback } from './chunkable-value-write-selection.js';
import {
  createDynamicChunkUnlocker,
  createEntryNftUnlocker,
  createReadOnlyDynamicChunkUnlocker,
  getDynamicChunkAddress,
  getEntryNftAddress,
  getValueChunkAddress,
} from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  usesLegacyJobEventCompatibility,
} from './legacy-job-event-wire.js';
import {
  selectedMessageBusResourceMetadata,
  anchorRoutedDynamicResourcesAtOwner,
  rebaseRoutedBatchProofOffsets,
} from './message-bus-resource-routing.js';
import {
  concatenateEncodedArrays,
  deriveChunkableArrayValueChannels,
  foldLeadingRouteArrayPushes,
} from './resource-fold-route.js';
import {
  entryAccessAt,
  parseRowArgsDecodeLabel,
  resolvePreparedProducerEntry,
  resolveRouteRowExpressionKey,
} from './route-expression-key.js';
import type { MessageBusRuntimeAbiFunction } from './sc-batch-raw.js';
import {
  SortedList, getCachedSortedList, bytesToSlotValue, decodeEntryCommitment, keyToSlotMulti,
} from './SortedList.js';
import { isMsgSenderKeySource, providerUnixLocktime } from './soft-state-overlays.js';
import { externalReturnsForCallsites } from './external-returns-for-callsites.js';
import type { OnChainState } from './StateReader.js';
import {
  stageJobEventsValue,
  stageValueChunkWrite,
  ValueChunkWriteStagingSession,
  valueChunkWriteResourceIdentity,
  type ValueChunkWriteDescriptor,
} from './value-chunk-persist.js';
import {
  canonicalValueChunkProducerPathContext,
  terminalValueChunkProducerClaim,
  type ValueChunkProducerPathDisposition,
  type ValueChunkProducerResourceClaim,
} from './ValueChunkProducerIdentity.js';

const DUMMY_FUNDER_LOCKING_BYTECODE = hexToBin(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX);
const DUMMY_FUNDER_UNLOCKING_BYTECODE = new Uint8Array([0x01, 0x51]);

export type AssembleCreateBuilderNestedComposeSlotsHost = {
  readonly inner: { provider: any };
  readonly signer: { getAddress(): string } | undefined;
  readonly logicalNonceSigner: { getAddress(): string } | undefined;
  encodeStoredElementSource: (...args: any[]) => any;
  encodeStoredValueSource: (...args: any[]) => any;
  shiftSharedFunder: () => UnlockableUtxo | undefined;
  markSharedFunder: (utxo: UnlockableUtxo) => void;
  nextNestedFunderIndex: () => number;
  describeValueChunkWrites?: (...args: any[]) => any;
};

export type AssembleCreateBuilderNestedComposeSlotsBags = {
  childBlockInputs: UnlockableUtxo[] | undefined;
  childCompilerInternalArgs: Record<string, FunctionArgument>;
  childValueWitnesses: Map<number, Uint8Array>;
  childStoredValues: Map<number, Uint8Array>;
  childValueChunkSlots: number;
  childBatchTargets: Map<number, Uint8Array>;
  childBatchLists: Map<string, SortedList>;
  childBatchPredecessorOutputs: Array<{
    outputBlockSlot: number; lockingBytecode: Uint8Array; commitment: string;
  }>;
  childDynamicChunkResources: Array<{
    blockSlot: number; name: string; type: string; write: boolean;
  }>;
  childBatchEntryLockingBytecodes: Map<number, Uint8Array>;
  childBatchEntryCommitments: Map<number, string>;
  childPlannedEntryInserts: Array<{
    blockSlot: number; outputBlockSlot: number;
    commitment?: string; newCommitment?: string;
  }>;
  routeValueChunkProducerAliases: ExternalCallUtxoGroup[];
  routeValueChunkProducerPhysicalGroup: ExternalCallUtxoGroup | undefined;
  routeValueChunkProducerEpoch: number | undefined;
  refreshChunkableRouteWitnesses: ((...args: any[]) => any) | undefined;
};

/**
 * Assemble nested-compose selectedLayout block inputs (slot loop + trailing
 * dynamic/value-chunk/batch regions) and publish results onto shared primary /
 * proxy delegate groups when applicable.
 */
export async function assembleCreateBuilderNestedComposeSlots(
  host: AssembleCreateBuilderNestedComposeSlotsHost,
  params: {
    nested: ExternalCallAbi;
    selectedFn: AbiFunction | undefined;
    selectedLayout: FunctionBlockLayout | undefined;
    sharedGroupIndex: number;
    childWritesState: boolean;
    preserveFirstConditionalWriter: boolean;
    proxyCallee: any | undefined;
    callee: any;
    childState: OnChainState & { masterUtxo: NonNullable<OnChainState['masterUtxo']> };
    childData: UnlockableUtxo[];
    childRequired: number[];
    childLayout: StateLayout;
    childCompilerRoute: any | undefined;
    childFunctionName: string;
    childFunctionArgs: FunctionArgument[];
    nestedArgs: FunctionArgument[];
    routePlanningArgs: FunctionArgument[];
    proxyImplementationState: OnChainState | undefined;
    delegateCallGroupIndex: number | undefined;
    childExternalGroupIndex: number;
    externalCallUtxoGroups: ExternalCallUtxoGroup[];
    lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
    timingEnabled: boolean;
    bags: AssembleCreateBuilderNestedComposeSlotsBags;
    // Closures / caches from outer nested-compose scope:
    publishRouteValueChunkProducerBinding: (binding: any) => void;
    valueChunkProductionsForPath: (path: any) => readonly any[] | any[];
    nestedSortedListCache: Map<string, SortedList>;
    nestedAddressUtxos: (address: string) => Promise<Utxo[]>;
    evaluateProxyRead?: (...args: any[]) => Promise<any>;
    // Misc outer bindings used deep in the loop:
    [key: string]: any;
  },
): Promise<{
    bags: AssembleCreateBuilderNestedComposeSlotsBags;
    childRelativeOutputInternalArgs: string[];
  }> {
  const {
    nested, selectedLayout, sharedGroupIndex, childWritesState,
    preserveFirstConditionalWriter, proxyCallee, callee, childState, childData,
    childRequired, childLayout, childCompilerRoute,
    routePlanningArgs, proxyImplementationState, delegateCallGroupIndex,
    childExternalGroupIndex, externalCallUtxoGroups, lowLevelCallUtxoGroups, timingEnabled,
    bags, publishRouteValueChunkProducerBinding,
    nestedSortedListCache, nestedAddressUtxos,
  } = params;
  // Outer nested-compose locals (passed through the index signature).
  const selectedFn = params.selectedFn as AbiFunction;
  const delegateCallerIdentity = params.delegateCallerIdentity as {
    lockingBytecode: string;
  };
  const sharedPriorAtomicNode = params.sharedPriorAtomicNode as any;
  const sharedPriorFunctionName = params.sharedPriorFunctionName as string | undefined;
  const sharedPriorFunctionArgs = params.sharedPriorFunctionArgs as FunctionArgument[] | undefined;
  const sharedPriorDelegateFunctionName = params.sharedPriorDelegateFunctionName as
    string | undefined;
  const sharedPriorDelegateFunctionArgs = params.sharedPriorDelegateFunctionArgs as
    FunctionArgument[] | undefined;
  const sharedLogicalArtifact = params.sharedLogicalArtifact as Artifact;
  const directInvocationRows = params.directInvocationRows as any[] | undefined;
  const valueChunkWriteStagingSession = params.valueChunkWriteStagingSession as
    ValueChunkWriteStagingSession;
  const functionName = params.functionName as string;

  // Unpack mutable bags into locals matching the original body names.
  let childBlockInputs = bags.childBlockInputs;
  const childCompilerInternalArgs = bags.childCompilerInternalArgs;
  const childValueWitnesses = bags.childValueWitnesses;
  const childStoredValues = bags.childStoredValues;
  let childValueChunkSlots = bags.childValueChunkSlots;
  const childBatchTargets = bags.childBatchTargets;
  const childBatchLists = bags.childBatchLists;
  const childBatchPredecessorOutputs = bags.childBatchPredecessorOutputs;
  const childDynamicChunkResources = bags.childDynamicChunkResources;
  const childBatchEntryLockingBytecodes = bags.childBatchEntryLockingBytecodes;
  const childBatchEntryCommitments = bags.childBatchEntryCommitments;
  const childPlannedEntryInserts = bags.childPlannedEntryInserts;
  let routeValueChunkProducerAliases = bags.routeValueChunkProducerAliases;
  let routeValueChunkProducerPhysicalGroup = bags.routeValueChunkProducerPhysicalGroup;
  let routeValueChunkProducerEpoch = bags.routeValueChunkProducerEpoch;
  let refreshChunkableRouteWitnesses = bags.refreshChunkableRouteWitnesses;

  // Host aliases used by the body after host. → host. rewrite
  const markSharedFunder = host.markSharedFunder;
  const routeDebugEnabled = (): boolean => {
    const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
    return env?.SOLIDC_DEBUG_ROUTE_CONCISE === '1'
      || env?.SOLIDC_DEBUG_COLLECTION_FETCH === '1';
  };

  if ((sharedGroupIndex < 0 || childWritesState)
    && selectedLayout && selectedLayout.blockSize > 1) {
    childBlockInputs = [];
    let dataIndex = 0;
    // This closure is awaited synchronously and owns the monotonically increasing local counter.
    // eslint-disable-next-line @typescript-eslint/no-loop-func
    const takeFunder = (): UnlockableUtxo => {
      if (timingEnabled && nested.callsiteId === 6) console.error('nested-take-funder', {
        remaining: undefined,
      });
      const funder = host.shiftSharedFunder();
      if (funder) { markSharedFunder(funder); return funder; }
      // MockNetworkProvider can materialize deterministic OP_TRUE
      // funding inputs. This keeps large composed tests focused on
      // covenant behavior without requiring users to pre-split an
      // arbitrary number of wallet UTXOs. Real providers continue
      // to fail closed and request additional funding.
      const provider = host.inner.provider;
      const mockProvider = provider as typeof provider & {
        addUtxo?: (lockingBytecode: string, utxo: Utxo) => Promise<void>;
      };
      if (mockProvider.addUtxo) {
        const dummy: Utxo = {
          txid: (0xe000n + BigInt(host.nextNestedFunderIndex())).toString(16).padStart(64, '0'),
          vout: 0,
          satoshis: 10000n,
        };
        // MockNetworkProvider.addUtxo mutates its in-memory indexer before returning its already-
        // resolved Promise. Do not await it here: funder allocation is a hot synchronous loop, and
        // yielding once per positional slot causes repeated full-heap GC for large artifacts.
        void mockProvider.addUtxo(binToHex(DUMMY_FUNDER_LOCKING_BYTECODE), dummy);
        const dummyFunder: UnlockableUtxo = {
          ...dummy,
          unlocker: {
            generateLockingBytecode: () => DUMMY_FUNDER_LOCKING_BYTECODE,
            generateUnlockingBytecode: () => DUMMY_FUNDER_UNLOCKING_BYTECODE,
          },
        };
        markSharedFunder(dummyFunder);
        return dummyFunder;
      }
      throw new Error(
        `Insufficient funding UTXOs for nested call ${nested.interfaceName}.${nested.functionName}.`,
      );
    };
    for (const slot of selectedLayout.slots) {
      if (timingEnabled && nested.callsiteId === 6) console.error('nested-callsite-slot-start', {
        callsiteId: nested.callsiteId, kind: slot.kind, offset: slot.offset, slotIndex: slot.slotIndex,
      });
      if (slot.kind === 'master') {
        childBlockInputs.push((proxyImplementationState?.masterUtxo
          ?? childState.masterUtxo) as UnlockableUtxo);
      } else if (slot.kind === 'dataNft') {
        if (proxyCallee) {
          childBlockInputs.push(takeFunder());
        } else {
          const data = childData[dataIndex++];
          // A skipped data-NFT slot shifts every later entry left, so
          // transferFrom's _balances[from] lands at offset 3 and offset 4
          // becomes a P2PKH hole (output 30 after the 4-wide minting swap).
          childBlockInputs.push(data ?? takeFunder());
        }
      } else if (slot.kind === 'entry') {
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_INPUTS === '1') {
          console.error('entry-slot-visit', {
            pos: childBlockInputs.length,
            slotIndex: slot.slotIndex,
            conditional: slot.conditional,
            softDelete: slot.softDelete,
          });
        }
        const access = entryAccessAt(selectedFn, slot.slotIndex ?? 0);
        const collection = childLayout.collections?.find(
          (candidate) => candidate.name === access?.collection
            || candidate.signature === access?.collection,
        );
        let entry: Utxo | undefined;
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_INPUTS === '1' && !(access && collection?.sorted)) {
          console.error('entry-pick-SKIP', {
            slotIndex: slot.slotIndex,
            hasAccess: !!access,
            collection: access?.collection,
            sorted: collection?.sorted,
            ops: access?.operations,
          });
        }
        if (access && collection?.sorted) {
          const keySources = access.keySources
            ?? access.keyParams.map((paramName) => ({ kind: 'param' as const, paramName }));
          if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
            ?.SOLIDC_DEBUG_INPUTS === '1') {
            console.error('key-sources', {
              slotIndex: slot.slotIndex,
              collection: access.collection,
              kinds: keySources.map((src) => src.kind).join(','),
              labels: keySources.map((src) => ('expressionLabel' in src
                ? src.expressionLabel : src.paramName) ?? '?').join(' | '),
            });
          }
          let keys = keySources.map((source, keyIndex) => {
            if (isMsgSenderKeySource(source)) {
              const selectedUsesSender = (selectedFn.entryAccesses ?? []).some((candidate: any) =>
                candidate.collection === access.collection
                && (candidate.keySources ?? []).some((candidateSource: any) =>
                  isMsgSenderKeySource(candidateSource)));
              if (childCompilerRoute?.rowArguments && !selectedUsesSender
                && !childCompilerRoute.rowArguments.some(
                  (row: any) => (row.handler.entryAccesses ?? []).some((candidate: any) =>
                    candidate.collection === access.collection
                  && (candidate.keySources ?? []).some((candidateSource: any) =>
                    isMsgSenderKeySource(candidateSource))),
                )) {
                // Sorted-batch planning still needs a deterministic target for every reserved
                // route slot. Use the same canonical inactive address carried by the route ABI;
                // it avoids colliding with an active argument-keyed read of the caller itself.
                return encodeLockingBytecodeP2pkh(new Uint8Array(20));
              }
              // CALL observes the calling contract, while DELEGATECALL preserves the transaction
              // caller. Resolve the same identity carried by _buildRepeatedExternalBatch's route
              // witness or the selected entry and covenant key diverge.
              if (selectedFn.modifiers?.includes('delegate')) {
                const sender = host.signer ?? host.logicalNonceSigner;
                if (!sender) throw new Error(
                  'A delegated message-bus route requires a connected signer to resolve msg.sender',
                );
                return addressToLockScript(sender.getAddress());
              }
              return hexToBin(delegateCallerIdentity.lockingBytecode);
            }
            // A computed key (hash160(pk), keccak256(x), ...) is not a parameter name, so the
            // param lookup below cannot find it and the whole access silently produces no pick -
            // leaving its entry slot funder-filled while the covenant still reads a commitment
            // there. Resolve it from its canonical label first, as the direct path does.
            if (source.kind === 'expression' && 'expressionLabel' in source) {
              const encodedName = source.paramName
                ?? source.expressionLabel
                ?? access.keyParams[keyIndex];
              const perRowHint = encodedName?.match(/_r(\d+)$/);
              const auto = resolveRouteRowExpressionKey({
                expressionLabel: source.expressionLabel,
                collection: access.collection,
                rowArguments: childCompilerRoute?.rowArguments,
                routePlanningArgs,
                routeVisibleInputs: selectedFn.inputs.filter(
                  (input) => !input.name.startsWith('__internal__'),
                ),
                structs: proxyCallee?.implementation.inner.artifact.structs
                  ?? callee.inner.artifact.structs
                  ?? childLayout.structs,
                state: childState.state,
                rowIndexHint: perRowHint ? Number(perRowHint[1]) : undefined,
              });
              if (auto) return auto;
              if (parseRowArgsDecodeLabel(source.expressionLabel)
                && childCompilerRoute?.rowArguments) {
                // No matching active row means this fixed route slot is intentionally inactive.
                return undefined;
              }
            }
            const encodedName = source.paramName
              ?? ('expressionLabel' in source ? source.expressionLabel : undefined)
              ?? access.keyParams[keyIndex];
            // Fixed message-bus routes reserve one witness lane per possible row. Only the handler
            // selected in that row may consume its lane. The unused ABI witnesses are canonical
            // zeroes, and resolving all of them against the sorted list can select the same
            // predecessor repeatedly; the later input de-duplication then keeps an inactive lane
            // and funder-fills the active one which the covenant actually reads.
            const perRowLane = encodedName?.match(/_r(\d+)$/);
            const participatesInSortedBatch = (selectedFn.sortedBatchInfo ?? []).some(
              (batch) => batch.slotIndices.includes(slot.slotIndex ?? -1),
            );
            if (perRowLane && childCompilerRoute?.rowArguments && !participatesInSortedBatch) {
              const row = childCompilerRoute.rowArguments[Number(perRowLane[1])];
              if (!row || !(row.handler.entryAccesses ?? []).some(
                (candidate: any) => candidate.collection === access.collection,
              )) return undefined;
            }
            const paramName = encodedName?.startsWith('id:')
              ? encodedName.slice(3) : encodedName;
            const visibleInputs = selectedFn.inputs
              .filter((input) => !input.name.startsWith('__internal__'));
            const paramIndex = visibleInputs.findIndex((input) => input.name === paramName);
            const value = paramIndex >= 0 ? routePlanningArgs[paramIndex] : undefined;
            if (value === undefined || paramIndex < 0) return undefined;
            const encoded = encodeFunctionArgument(
              value,
              visibleInputs[paramIndex].type,
              proxyCallee?.implementation.inner.artifact.structs
                ?? callee.inner.artifact.structs
                ?? childLayout.structs,
            );
            return encoded instanceof Uint8Array ? encoded : undefined;
          });
          if (keys?.every((key): key is Uint8Array => key !== undefined)) {
            // The entry covenant derives its locking bytecode from
            // the ABI collection identifier (the source name), not
            // the descriptive state-layout signature.
            // A proxy owns the category/state, while its delegate implementation owns the entry
            // covenant bytecode which authenticates that state. Resolve and unlock vmap entries with
            // the implementation contract, retaining the proxy category.
            const entryContract = proxyCallee?.implementation.inner ?? callee.inner;
            if (timingEnabled && nested.callsiteId === 6) console.error('nested-entry-address-start', {
              collection: access.collection,
            });
            const address = getEntryNftAddress(
              entryContract, callee.categoryId, access.collection,
            );
            if (timingEnabled && nested.callsiteId === 6) console.error('nested-entry-address-complete', {
              collection: access.collection,
            });
            const addressUtxos = await nestedAddressUtxos(address);
            if (timingEnabled && nested.callsiteId === 6) console.error('nested-entry-utxos-complete', {
              collection: access.collection, count: addressUtxos.length,
            });
            if (routeDebugEnabled()) {
              console.error('nested-entry-resolution', JSON.stringify({
                collection: access.collection,
                address,
                categoryId: callee.categoryId,
                // The encoded keys matter as much as the slot they hash to: an `address` key has both a
                // 20-byte and a 25-byte (P2PKH) encoding, and two SDK paths disagreeing about which one
                // is authoritative is indistinguishable from a wrong key when only the slot is printed.
                keys: keys.map((key) => binToHex(key)),
                keySlot: binToHex(keyToSlotMulti(keys, collection)),
                slots: addressUtxos.map((utxo) => ({
                  bytes: (utxo.token?.nft?.commitment?.length ?? 0) / 2,
                  commitment: utxo.token?.nft?.commitment,
                })),
              }));
            }
            const list = getCachedSortedList(
              nestedSortedListCache, address, callee.categoryId, addressUtxos,
            );
            if (timingEnabled && nested.callsiteId === 6) console.error('nested-entry-list-complete', {
              collection: access.collection,
            });
            const keySlot = keyToSlotMulti(keys, collection);
            childBatchTargets.set(slot.slotIndex ?? 0, keySlot);
            childBatchLists.set(access.collection, list);
            // P5b: authenticate the value of the exact proof entry selected for this access. An
            // absent target selects its predecessor, whose long value is decoded before membership is
            // decided. The logical stored value remains absent/default; only the hidden witness follows
            // the predecessor.
            if (collection.chunkableValue) {
              const present = list.has(keySlot);
              const proofEntry = present ? list.find(keySlot)! : list.predecessorOf(keySlot);
              const tail = proofEntry.value;
              const storedLength = tail.length >= 4
                ? tail[0] | (tail[1] << 8) | (tail[2] << 16) | (tail[3] << 24) : 0;
              if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                ?.SOLIDC_DEBUG_COLLECTION_FETCH === '1') {
                console.error('nested-chunkable-proof', JSON.stringify({
                  collection: access.collection,
                  present,
                  proofSlot: binToHex(proofEntry.slot),
                  tail: binToHex(tail),
                  storedLength,
                }));
              }
              if (storedLength > 60) {
                const root = tail.slice(4, 36);
                const chunkAddress = getValueChunkAddress(
                  entryContract, callee.categoryId, access.collection, proofEntry.slot, root,
                );
                const expectedChunks = Math.ceil((storedLength - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE);
                const byIndex = new Map<number, { chunkIndex: number; chunkData: Uint8Array }>();
                const chunkUtxos = await host.inner.provider.getUtxos(chunkAddress);
                if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                  ?.SOLIDC_DEBUG_COLLECTION_FETCH === '1') {
                  console.error('nested-value-chunk-fetch', JSON.stringify({
                    collection: access.collection,
                    categoryId: callee.categoryId,
                    slot: binToHex(proofEntry.slot),
                    root: binToHex(root),
                    chunkAddress,
                    expectedChunks,
                    utxos: chunkUtxos.map((utxo: any) => ({
                      category: utxo.token?.category,
                      capability: utxo.token?.nft?.capability,
                      commitment: utxo.token?.nft?.commitment,
                    })),
                  }));
                }
                for (const chunk of chunkUtxos
                  .filter((utxo: any) => utxo.token?.category === callee.categoryId
                    && (utxo.token?.nft?.commitment?.length ?? 0) > 0)
                  .map((utxo: any) => parseValueChunkCommitment(utxo.token!.nft!.commitment))) {
                  if (chunk.chunkIndex < expectedChunks) byIndex.set(chunk.chunkIndex, chunk);
                }
                const joined = joinValueChunks(
                  tail.slice(36, 64),
                  [...byIndex.values()].sort((a, b) => a.chunkIndex - b.chunkIndex),
                  storedLength,
                );
                if (binToHex(sha256Sync(joined)) === binToHex(root)) {
                  childValueWitnesses.set(slot.slotIndex ?? 0, joined);
                  if (present) childStoredValues.set(slot.slotIndex ?? 0, joined);
                }
                if (routeDebugEnabled()) {
                  console.error('nested-value-witness', JSON.stringify({
                    collection: access.collection,
                    routeSlot: slot.slotIndex,
                    present,
                    proofSlot: binToHex(proofEntry.slot),
                    storedLength,
                    rootMatches: binToHex(sha256Sync(joined)) === binToHex(root),
                    head: binToHex(tail.slice(36, 64)),
                    value: binToHex(joined).slice(0, 240),
                  }));
                }
              } else if (present) {
                childStoredValues.set(
                  slot.slotIndex ?? 0,
                  tail.slice(4, 4 + storedLength),
                );
              }
            }
            try {
              const exists = list.has(keySlot);
              const selectedEntry = exists ? list.find(keySlot) : list.predecessorOf(keySlot);
              entry = selectedEntry?.utxo;
              if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                ?.SOLIDC_DEBUG_PROOF_PICK === '1') {
                console.error('nested-proof-pick', JSON.stringify({
                  phase: 'layout',
                  collection: access.collection,
                  routeSlot: slot.slotIndex,
                  blockSlot: childBlockInputs.length,
                  keyParams: access.keyParams,
                  keys: keys.map((key) => key && binToHex(key)),
                  target: binToHex(keySlot),
                  exists,
                  selected: selectedEntry && {
                    slot: binToHex(selectedEntry.slot),
                    next: binToHex(selectedEntry.nextKey),
                    outpoint: `${selectedEntry.utxo.txid}:${selectedEntry.utxo.vout}`,
                  },
                  list: list.all.map((candidate) => ({
                    slot: binToHex(candidate.slot),
                    next: binToHex(candidate.nextKey),
                    outpoint: `${candidate.utxo.txid}:${candidate.utxo.vout}`,
                  })),
                }));
              }
              if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                ?.SOLIDC_DEBUG_INPUTS === '1') {
                console.error('entry-pick-result', {
                  slotIndex: slot.slotIndex,
                  collection: access.collection,
                  exists,
                  gotEntry: entry !== undefined,
                  predecessor: exists ? 'n/a' : (list.predecessorOf(keySlot) ? 'found' : 'NONE'),
                });
              }
              if (!exists && access.operations.includes('write')) {
                const insertPlan = list.planInsert(keySlot);
                childPlannedEntryInserts.push({
                  blockSlot: childBlockInputs.length,
                  outputBlockSlot: -1,
                  commitment: binToHex(insertPlan.predNewCommitment),
                  newCommitment: binToHex(insertPlan.newNodeCommitment),
                });
              }
              if (routeDebugEnabled()) {
                console.error('nested-entry-pick', JSON.stringify({
                  collection: access.collection,
                  blockSlot: childBlockInputs.length,
                  routeSlot: slot.slotIndex,
                  keySlot: binToHex(keySlot).slice(0, 16),
                  exists,
                  picked: entry ? `${entry.txid.slice(0, 12)}:${entry.vout}` : 'NONE',
                }));

              }
            } catch (error) {
              entry = undefined;
              if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
                console.error('nested-entry-pick-threw', {
                  collection: access.collection,
                  blockSlot: childBlockInputs.length,
                  routeSlot: slot.slotIndex,
                  keySlot: binToHex(keySlot).slice(0, 16),
                  reason: (error as Error).message,
                });
              }
            }
          }
        }
        childBlockInputs.push(entry ? {
          ...entry,
          unlocker: createEntryNftUnlocker(
            proxyCallee?.implementation.inner ?? callee.inner,
            0, callee.categoryId, access!.collection,
          ),
        } : takeFunder());
      } else if (slot.kind === 'returnEvent') {
        // Preserve the compiler's fixed block position even though
        // the real return NFT is emitted by the shared return
        // section. The positional input/output keeps all following
        // delegate groups aligned.
        childBlockInputs.push(takeFunder());
      } else if (slot.kind === 'lowLevelCall' || slot.kind === 'deploy') {
        // These slots are managed by their dedicated sections.
      } else {
        childBlockInputs.push(takeFunder());
      }
    }
    const insertBase = selectedLayout.trailingBase ?? selectedLayout.blockSize;
    // A compiler route publishes the union of every handler's dynamic-storage footprint. Its read
    // loops therefore always address the physical union run at trailingBase, even when this envelope
    // selects a handler which does not touch those variables. Materialize the old chunks in the same
    // order as a direct call: read-only variables in ABI order, followed by written variables in state
    // declaration order. Inactive union writes are preservation spends, not write-authorized spends.
    const selectedResources = selectedMessageBusResourceMetadata(childCompilerRoute?.rowArguments);
    const routeDynamicWrites = selectedFn?.dynamicWrites ?? [];
    const routeDynamicNames = [
      ...(selectedFn?.dynamicReads ?? []).filter((name) => !routeDynamicWrites.includes(name)),
      ...(childLayout.variables ?? [])
        .filter((variable) => variable.dynamic && routeDynamicWrites.includes(variable.name))
        .map((variable) => variable.name),
    ];
    let dynamicChunkOffset = insertBase;
    const dynamicContract = proxyCallee?.implementation.inner ?? callee.inner;
    for (const name of routeDynamicNames) {
      const variable = (childLayout.variables ?? []).find((candidate) => (
        candidate.dynamic && candidate.name === name
      ));
      if (!variable) {
        throw new Error(`Nested compiler route references unknown dynamic state '${name}'`);
      }
      const chunkAddress = getDynamicChunkAddress(
        dynamicContract, callee.categoryId, variable.name, variable.type,
      );
      const chunks = (await nestedAddressUtxos(chunkAddress))
        .filter((utxo) => utxo.token?.category === callee.categoryId
          && utxo.token?.nft?.capability === 'mutable'
          && !!utxo.token.nft.commitment && utxo.token.nft.commitment.length > 0)
        .map((utxo) => ({
          utxo,
          chunkIndex: parseChunkCommitment(utxo.token!.nft!.commitment).chunkIndex,
        }))
        .sort((left, right) => left.chunkIndex - right.chunkIndex);
      const activeWrite = selectedResources.dynamicWrites.includes(variable.name);
      for (const { utxo } of chunks) {
        // A balanced compiler route publishes a finite trailing window shared by every participant.
        // Ordinary direct functions have no `trailingCapacity`: their runtime chunk run simply extends
        // past blockSize. Treating an absent capacity as zero rejected the first chunk of every nested
        // dynamic read (for example an external `itemAt()` call after items became non-empty).
        if (selectedLayout.trailingCapacity !== undefined
          && dynamicChunkOffset >= insertBase + selectedLayout.trailingCapacity) {
          throw new Error(
            `Nested dynamic state exceeds balanced trailing capacity for '${selectedFn?.name}'`,
          );
        }
        const unlocker = activeWrite
          ? createDynamicChunkUnlocker(
            dynamicContract, 0, callee.categoryId, variable.name, variable.type,
          )
          : createReadOnlyDynamicChunkUnlocker(
            dynamicContract, 0, callee.categoryId, variable.name, variable.type,
          );
        childBlockInputs[dynamicChunkOffset] = { ...utxo, unlocker };
        childDynamicChunkResources.push({
          blockSlot: dynamicChunkOffset,
          name: variable.name,
          type: variable.type,
          write: activeWrite,
        });
        dynamicChunkOffset += 1;
      }
    }
    // A fixed message-bus route executes each compiled batch journal even when the selected rows do
    // not mutate that collection. Those inactive journals preserve their canonical zero-key entry;
    // they still require the real key hash and an authenticated proof rather than all-zero vmap fields.
    const activeSortedBatches = selectedFn?.sortedBatchInfo ?? [];
    const allBatchSlots = new Set((selectedFn?.sortedBatchInfo ?? [])
      .flatMap((batch) => batch.slotIndices));
    if ((selectedFn?.sortedBatchInfo?.length ?? 0) > 0) {
    // Batch-owned inserts are represented by the batch plan. Generic route-handler inserts retain
    // the leading trailing slots expected by their ordinary single-entry covenants.
      for (let index = childPlannedEntryInserts.length - 1; index >= 0; index--) {
        const routeSlot = selectedLayout.slots[childPlannedEntryInserts[index].blockSlot]?.slotIndex;
        if (routeSlot !== undefined && allBatchSlots.has(routeSlot)) {
          childPlannedEntryInserts.splice(index, 1);
        }
      }
    }
    // A long computed vmap value pins its continuation NFTs at `trailingBase` before the sorted-batch
    // predecessor recreations. Reserve that band up front so later participant masters are shifted
    // together with their outputs and the predecessor's compiler-owned predOut can name the first
    // slot after the chunks. The largest visible structured argument is the conservative source-size
    // estimate used by delegated routes too; internally-constructed values cannot encode smaller than
    // the structured input from which their fields are copied.
    if ((selectedFn?.entryAccesses ?? []).some((access) => {
      const collection = childLayout.collections?.find((candidate) =>
        candidate.name === access.collection || candidate.signature === access.collection);
      return collection?.chunkableValue === true && access.operations.includes('write');
    })) {
      const visibleInputs = selectedFn!.inputs.filter((input) => !input.name.startsWith('__internal__'));
      const structs = (proxyCallee as { implementation?: { inner: { artifact: Artifact } } } | undefined)
        ?.implementation?.inner.artifact.structs
        ?? callee.inner.artifact.structs ?? childLayout.structs;
      const sharedPrimary = sharedGroupIndex >= 0
        ? externalCallUtxoGroups[sharedGroupIndex] : undefined;
      const sharedDelegate = delegateCallGroupIndex !== undefined
        ? lowLevelCallUtxoGroups[delegateCallGroupIndex] : undefined;
      const inheritedRouteInternalArgs = {
        ...(sharedPrimary?.compilerRoute?.internalArgs ?? sharedPrimary?.internalArgs),
        ...(sharedDelegate?.compilerRoute?.internalArgs ?? sharedDelegate?.internalArgs),
      };
      const priorFunctionName = sharedPriorAtomicNode?.functionName
        ?? sharedPriorDelegateFunctionName ?? sharedPriorFunctionName;
      const priorFunctionArgs = sharedPriorAtomicNode?.args
        ?? sharedPriorDelegateFunctionArgs ?? sharedPriorFunctionArgs;
      const sequentialRows = !childCompilerRoute && priorFunctionName
        && priorFunctionArgs && directInvocationRows?.length
        ? (() => {
          const priorHandler = sharedPriorAtomicNode
            ? resolvePreparedProducerEntry([
              ...(sharedPriorAtomicNode.executionArtifact
                ? [sharedPriorAtomicNode.executionArtifact] : []),
              sharedLogicalArtifact,
            ], priorFunctionName, sharedPriorAtomicNode.selector)
            : (sharedLogicalArtifact.abi as readonly AbiFunction[])
              .find((candidate) => candidate.name === priorFunctionName);
          if (!priorHandler || !selectedFn) return undefined;
          return [{
            args: priorFunctionArgs,
            handler: priorHandler,
            selector: sharedPriorAtomicNode?.selector ?? priorHandler.selector,
            sourceCallsiteId: sharedPriorAtomicNode?.sourceCallsiteId,
            sourceLogicalIndex: sharedPriorAtomicNode?.sourceLogicalIndex,
            occurrenceIndex: sharedPriorAtomicNode?.occurrenceIndex,
            sourceEffectOrdinal: sharedPriorAtomicNode?.sourceEffectOrdinal,
            producerPath: sharedPriorAtomicNode?.producerPath,
          }, ...directInvocationRows];
        })() : undefined;
      // A direct nested handler is still one authenticated graph row even when no repeated-owner
      // compiler batch was needed. Keep that exact callsite row available to terminal producer
      // selection: `childCompilerRoute` describes a physical batch, not whether the semantic call
      // exists. The selector resolver and producer path both fail closed for overloaded or
      // incompletely-coordinated edges, so this cannot turn a name-derived SDK guess into authority.
      const discoveredProducerRows = sequentialRows ?? directInvocationRows;
      const valueResultsByPath = new Map<string, ReadonlyMap<number, FunctionArgument>>();
      refreshChunkableRouteWitnesses = (
        rowArguments, finalVisibleArgs,
        refreshStagingSession = new ValueChunkWriteStagingSession(),
        resultUpdate?: { producerPath: ValueChunkProducerPathDisposition; results: ReadonlyMap<number, FunctionArgument> },
      ) => {
        if (resultUpdate?.producerPath.status === 'complete') {
          const key = canonicalValueChunkProducerPathContext(resultUpdate.producerPath.context);
          if (key) valueResultsByPath.set(key, resultUpdate.results);
        }
        const internalArgs: Record<string, FunctionArgument> = {};
        const producerClaims: ValueChunkProducerResourceClaim[] = [];
        const productions: Array<NonNullable<
        PreparedAtomicMessageBusCall['valueChunkProductions']
        >[number]> = [];
        let producerStateOwner: { categoryId: string; lockingBytecode: string } | undefined;
        const effectiveRowArguments = rowArguments ?? discoveredProducerRows?.map((row, index, rows) => (
          index === rows.length - 1 ? { ...row, args: finalVisibleArgs } : row
        ));
        // A whole-route refresh supplies handler arguments, not the physical route's packed
        // argument vector. Estimate each reached row in its own ABI frame.
        const payloadRows: Array<{
          inputs: readonly { type: string }[];
          args: readonly FunctionArgument[];
        }> = effectiveRowArguments?.length
          ? effectiveRowArguments.map((row: { handler: AbiFunction; args: FunctionArgument[] }) => ({
            inputs: row.handler.inputs.filter((input: { name: string }) =>
              !input.name.startsWith('__internal__')),
            args: row.args,
          }))
          : [{ inputs: visibleInputs, args: finalVisibleArgs }];
        const fallbackPayloadBytes = payloadRows.reduce((largest, row) => row.inputs.reduce(
          (rowLargest: number, input: { type: string }, index: number) => {
            const encoded = encodeFunctionArgument(row.args[index], input.type, structs);
            return encoded instanceof Uint8Array ? Math.max(rowLargest, encoded.length) : rowLargest;
          }, largest,
        ), 0);
        let encodedPayloadBytes = 0;
        for (const [routeSlot, access] of (selectedFn?.entryAccesses ?? []).entries()) {
          if (!access.operations.includes('write')) continue;
          const collection = childLayout.collections?.find((candidate) =>
            candidate.name === access.collection || candidate.signature === access.collection);
          if (!collection?.chunkableValue) continue;
          let payloadBytes = fallbackPayloadBytes;
          let nextValue: Uint8Array | undefined;
          if (collection.valueType.endsWith('[]')) {
            const legacyCompatibility = usesLegacyJobEventCompatibility(
              sharedLogicalArtifact, collection.valueType, structs,
            );
            const legacyTimestamp = (() => {
              if (!legacyCompatibility) return undefined;
              const raw = (childState as { state?: Record<string, unknown> })
                ?.state?.__block_timestamp;
              if (typeof raw === 'bigint' && raw > 0n) return raw;
              if (typeof raw === 'number' && raw > 0) return BigInt(raw);
              const providerTime = Number(
                (host.inner.provider as { getBlockTime?: () => number }).getBlockTime?.() ?? 0,
              );
              if (providerTime <= 0) return undefined;
              const appending = [...childStoredValues.values()].some((value) => value.length > 1);
              const plannedLocktime = providerUnixLocktime(
                host.inner.provider as { getBlockTime?: () => number },
              );
              return BigInt(appending ? plannedLocktime ?? providerTime : providerTime);
            })();
            const leadingName = `__internal__leadingPushValue_${routeSlot}`;
            const completeName = `__internal__completePushValue_${routeSlot}`;
            const inheritedLeading = inheritedRouteInternalArgs[leadingName];
            const foldedRoute = effectiveRowArguments
              ? foldLeadingRouteArrayPushes({
                rowArguments: effectiveRowArguments,
                collection: access.collection,
                valueType: collection.valueType,
                structs,
                timestamp: legacyTimestamp,
                legacyJobEventCompatibility: legacyCompatibility,
                resolveElement: (row, rowAccess, elementType) => host.encodeStoredElementSource(
                  rowAccess, elementType, [...row.args], row.handler, sharedLogicalArtifact,
                  (childState as { state?: Record<string, unknown> })?.state,
                ),
              }) : undefined;
            const routeLeading = foldedRoute?.leading;
            const leadingPush = inheritedLeading instanceof Uint8Array
              && inheritedLeading.length > 0 && routeLeading
              ? concatenateEncodedArrays(inheritedLeading, routeLeading)
              : routeLeading ?? (inheritedLeading instanceof Uint8Array
                ? inheritedLeading : undefined);
            if (leadingPush && leadingPush.length > 0) internalArgs[leadingName] = leadingPush;
            if (foldedRoute?.complete && foldedRoute.complete.length > 0) {
              const inheritedComplete = inheritedRouteInternalArgs[completeName];
              internalArgs[completeName] = inheritedComplete instanceof Uint8Array
                && inheritedComplete.length > 0
                ? concatenateEncodedArrays(inheritedComplete, foldedRoute.complete)
                : foldedRoute.complete;
              internalArgs.__internal__completePushValue = internalArgs[completeName];
            }
            const emptyArray = encodePushdataValue([], collection.valueType, structs);
            const storedPreValue = childStoredValues.get(routeSlot) ?? emptyArray;
            const elementType = collection.valueType.slice(0, -2);
            const storedRows = (effectiveRowArguments ?? []).flatMap((row: any) => (
              (row.handler.entryAccesses ?? []).filter((rowAccess: any) => (
                rowAccess.collection === access.collection
                && rowAccess.operations.includes('write')
              )).map((rowAccess: any) => ({ row, rowAccess }))
            ));
            const terminalStored = storedRows.at(-1);
            // The actual terminal write owns the current element. Never skip a recipe-less terminal
            // row and silently reuse an earlier producer for the same collection.
            const currentElement = terminalStored?.rowAccess.arrayMutation === 'push'
              && terminalStored.rowAccess.storedElementSource?.version === 1
              ? host.encodeStoredElementSource(
                terminalStored.rowAccess, elementType, [...terminalStored.row.args],
                terminalStored.row.handler, sharedLogicalArtifact,
                (childState as { state?: Record<string, unknown> })?.state,
              ) : undefined;
            const channels = deriveChunkableArrayValueChannels({
              preValueWitness: childValueWitnesses.get(routeSlot),
              storedPreValue,
              leadingMutation: leadingPush,
              currentElement,
            });
            nextValue = channels.postValue;
            if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
              ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1') {
              console.error('value-chunk-derive', JSON.stringify({
                root: functionName,
                callsiteId: nested.callsiteId,
                routeSlot,
                collection: collection.name,
                rowCount: (effectiveRowArguments ?? []).length,
                rows: (effectiveRowArguments ?? []).map((row: any) => ({
                  sel: row.selector ?? row.handler.selector,
                  cs: row.sourceCallsiteId,
                  occ: row.occurrenceIndex,
                  ord: row.sourceEffectOrdinal,
                })),
                storedPre: storedPreValue.length,
                preWitness: childValueWitnesses.get(routeSlot)?.length,
                leading: leadingPush?.length,
                current: currentElement?.length,
                next: nextValue.length,
                digest: binToHex(sha256Sync(nextValue)).slice(0, 16),
              }));
            }
            payloadBytes = currentElement
              ? nextValue.length
              : nextValue.length + fallbackPayloadBytes + VALUE_CHUNK_SIZE;
          } else {
            const writes = (effectiveRowArguments ?? []).flatMap((row: any) => (
              (row.handler.entryAccesses ?? []).filter((candidate: any) => (
                candidate.collection === access.collection && candidate.operations.includes('write')
              )).map((candidate: any) => ({ row, access: candidate }))
            ));
            const incomingEntries = [...childStoredValues].flatMap(([slotIndex, value]) => {
              const sourceAccess = selectedFn?.entryAccesses?.find((candidate, index) => (
                (candidate.slotIndex ?? index) === slotIndex
              ));
              const sourceCollection = childLayout.collections?.find((candidate) => (
                candidate.name === sourceAccess?.collection || candidate.signature === sourceAccess?.collection
              ));
              const slot = childBatchTargets.get(slotIndex);
              return sourceCollection && slot ? [{ collection: sourceCollection.signature, slot, value }] : [];
            });
            const logRecipe = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
              ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1' ? console.error.bind(console) : undefined;
            const encodeRecipe = (
              terminal: StoredValueMutationRow, entries: readonly StoredValueIncomingEntry[],
            ): Uint8Array | undefined => {
              const recipe = terminal.access.storedValueSource;
              if (!recipe) return undefined;
              const path = terminal.row.producerPath;
              const key = path?.status === 'complete' ? canonicalValueChunkProducerPathContext(path.context) : undefined;
              const externalReturns = externalReturnsForCallsites(
                [{ kind: 'expression', expression: recipe.expression }],
                key ? valueResultsByPath.get(key) ?? new Map() : new Map(),
                terminal.row.handler.externalCalls ?? [],
              );
              const value = host.encodeStoredValueSource(
                terminal.access, collection.valueType, [...terminal.row.args], terminal.row.handler,
                sharedLogicalArtifact, childState.state, externalReturns,
                entries,
              );
              if (logRecipe) {
                logRecipe('value-chunk-whole-recipe', JSON.stringify({
                  collection: collection.name, handler: terminal.row.handler.name,
                  mutationEffectOrdinal: recipe.mutationEffectOrdinal,
                  resultCount: externalReturns.size, valueBytes: value?.length,
                  hasProducerPath: key !== undefined,
                }));
              }
              return value;
            };
            const targetSlot = childBatchTargets.get(access.slotIndex ?? routeSlot);
            nextValue = writes.length === 1 ? encodeRecipe(writes[0], incomingEntries)
              : targetSlot ? foldRouteStoredValues({
                writes, collection, targetSlot, incomingEntries, artifact: sharedLogicalArtifact,
                state: childState.state, encode: encodeRecipe,
              }) : undefined;
            if (nextValue) payloadBytes = nextValue.length;
          }
          // Keep the three authenticated channels distinct. The proof-entry
          // fetch above owns `__internal__valueWitness_N` (pre-handler bytes),
          // `leadingPushValue_N` carries prior selected-row mutations, and this
          // derived `nextValue` owns only continuation output/persistence data.
          if (nextValue && nextValue.length > VALUE_INLINE_LIMIT) {
            const physicalRouteSlot = access.slotIndex ?? routeSlot;
            const blockSlot = selectedLayout.slots.find((slot) =>
              slot.kind === 'entry' && slot.slotIndex === physicalRouteSlot)?.offset;
            const insert = blockSlot === undefined ? undefined
              : childPlannedEntryInserts.find((planned) => planned.blockSlot === blockSlot);
            const commitment = insert?.newCommitment
              ?? (blockSlot === undefined ? undefined
                : childBlockInputs?.[blockSlot]?.token?.nft?.commitment);
            const commitmentBytes = typeof commitment === 'string'
              ? hexToBin(commitment) : commitment;
            // A missing entry's input is its predecessor, not the target key. Fixed route geometry
            // may already have consumed the insertion plan; retain the authenticated key selection.
            const targetKey = childBatchTargets.get(physicalRouteSlot)
              ?? (commitmentBytes && commitmentBytes.length >= 32
                ? decodeEntryCommitment(commitmentBytes).slot : undefined);
            const inserting = targetKey && childBatchLists.get(access.collection)
              ? !childBatchLists.get(access.collection)!.has(targetKey) : insert !== undefined;
            const exactWrite: ValueChunkWriteDescriptor | undefined = targetKey ? {
              categoryId: callee.categoryId,
              collection: collection.name,
              collectionSignature: collection.signature,
              collectionHash: binToHex(computeCollectionHash(collection.signature)),
              keySlot: binToHex(targetKey),
              entryAccessSlot: routeSlot,
              routeSlot: physicalRouteSlot,
              operation: inserting ? 'insert' : 'update',
              outputBase: -1,
              outputCount: 0,
            } : undefined;
            if (exactWrite) {
              const stateOwner = {
                categoryId: callee.categoryId,
                lockingBytecode: callee.inner.lockingBytecode,
              };
              const producerClaim = terminalValueChunkProducerClaim({
                rows: effectiveRowArguments ?? [],
                collectionIdentities: [
                  access.collection, collection.name, collection.signature,
                ],
                fixedChunkableWriteSelectors: (proxyCallee?.implementation.inner.artifact
                  ?? callee.inner.artifact).messageBus?.fixedChunkableWritePolicy?.selectors,
                executionLockingBytecode: proxyCallee?.implementation.inner.lockingBytecode
                  ?? callee.inner.lockingBytecode,
                stateOwnerCategoryId: stateOwner.categoryId,
                stateOwnerLockingBytecode: stateOwner.lockingBytecode,
                resourceIdentity: valueChunkWriteResourceIdentity(exactWrite),
              });
              if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1') {
                console.error('value-chunk-producer-stage', JSON.stringify({
                  resourceIdentity: valueChunkWriteResourceIdentity(exactWrite),
                  valueBytes: nextValue.length,
                  claim: producerClaim?.producer,
                  rows: (effectiveRowArguments ?? []).map((row: any) => ({
                    selector: row.selector ?? row.handler.selector,
                    sourceEffectOrder: row.handler.sourceEffectOrder,
                    mutationEffectOrdinals: row.handler.entryAccesses?.flatMap(
                      (candidate: any) => candidate.mutationEffectOrdinals ?? [],
                    ),
                    producerPath: row.producerPath,
                  })),
                }));
              }
              if (producerClaim) {
                const stagedOwned = refreshStagingSession.stageOwned(
                  exactWrite, producerClaim, stateOwner, nextValue,
                  { supersedeUnowned: true },
                );
                if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
                  ?.SOLIDC_DEBUG_VALUE_CHUNKS === '1') {
                  console.error('value-chunk-producer-stage-result', JSON.stringify({
                    resourceIdentity: valueChunkWriteResourceIdentity(exactWrite),
                    valueBytes: nextValue.length,
                    stagedOwned,
                  }));
                }
                if (!stagedOwned) {
                  throw new Error(
                    'Compiler-authenticated value production conflicts with its staged resource.',
                  );
                }
                producerClaims.push(producerClaim);
                producerStateOwner = stateOwner;
                productions.push({
                  write: exactWrite,
                  claim: producerClaim,
                  stateOwner,
                  value: nextValue.slice(),
                });
              } else {
                stageValueChunkWrite(
                  exactWrite, nextValue, refreshStagingSession,
                );
              }
            } else if (permitsLegacyNamedValueChunkFallback(
              [{
                logicalArtifact: sharedLogicalArtifact,
                externalContract: { inner: { artifact: sharedLogicalArtifact } },
              }],
              (selectedFn as MessageBusRuntimeAbiFunction | undefined)?.messageBusConvention,
            )) {
              stageJobEventsValue(callee.categoryId, nextValue);
            }
          }
          encodedPayloadBytes = Math.max(encodedPayloadBytes, payloadBytes);
        }
        publishRouteValueChunkProducerBinding(
          producerStateOwner && producerClaims.length > 0 ? {
            claims: Object.freeze([...producerClaims]),
            stateOwner: Object.freeze({ ...producerStateOwner }),
            productions: Object.freeze([...productions]),
          } : undefined,
        );
        return { internalArgs, payloadBytes: encodedPayloadBytes };
      };
      const refreshed = refreshChunkableRouteWitnesses(
        childCompilerRoute?.rowArguments ?? discoveredProducerRows,
        routePlanningArgs,
        valueChunkWriteStagingSession,
      );
      Object.assign(childCompilerInternalArgs, refreshed.internalArgs);
      const encodedPayloadBytes = refreshed.payloadBytes;
      childValueChunkSlots = encodedPayloadBytes > VALUE_HEAD_SIZE
        ? Math.ceil((encodedPayloadBytes - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE) : 0;
      if (!proxyCallee) {
        while (childBlockInputs.length < insertBase + childValueChunkSlots) {
          childBlockInputs.push(takeFunder());
        }
      }
    }
    const batchInsertBase = insertBase + childPlannedEntryInserts.length + childValueChunkSlots;
    let childBatchTrailingCount = 0;
    for (const batch of activeSortedBatches) {
      const list = childBatchLists.get(batch.collection);
      if (!list) {
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_BATCH_SNAPSHOT === '1') {
          console.error('nested-batch-snapshot-missing', {
            interfaceName: nested.interfaceName,
            functionName: nested.functionName,
            selectedFunction: selectedFn?.name,
            collection: batch.collection,
            batchSlots: batch.slotIndices,
            loadedCollections: [...childBatchLists.keys()],
            targets: [...childBatchTargets.entries()].map(([slotIndex, target]) => ({
              slotIndex, target: binToHex(target),
            })),
            entrySlots: selectedLayout.slots.filter((slot) => slot.kind === 'entry'),
            entryAccesses: selectedFn?.entryAccesses,
          });
        }
        throw new Error(`Nested vmap batch '${batch.collection}' has no sorted-list snapshot`);
      }
      const canonicalSlots: number[] = [];
      const canonicalByTarget = new Map<string, number>();
      const aliasOwner = new Map<number, number>();
      for (const slotIndex of batch.slotIndices) {
        const target = childBatchTargets.get(slotIndex);
        if (!target) throw new Error(`Nested vmap batch '${batch.collection}' is missing slot ${slotIndex}`);
        const targetHex = binToHex(target);
        const owner = canonicalByTarget.get(targetHex);
        if (owner === undefined) {
          canonicalByTarget.set(targetHex, slotIndex);
          canonicalSlots.push(slotIndex);
        } else {
          aliasOwner.set(slotIndex, owner);
        }
      }
      const writes = canonicalSlots.map((slotIndex) => ({
        slot: childBatchTargets.get(slotIndex)!, value: new Uint8Array(),
      }));
      const plan = list.planBatchUpsert(writes);
      const targets = new Set(writes.map((write) => bytesToSlotValue(write.slot).toString()));
      const predecessorOutputs = plan.outputs.filter(
        (output) => !targets.has(bytesToSlotValue(output.slot).toString()),
      );
      const entryLockingBytecode = createEntryNftUnlocker(
        proxyCallee?.implementation.inner ?? callee.inner,
        0, callee.categoryId, batch.collection,
      ).generateLockingBytecode();
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_INPUTS === '1') {
        console.error('nested-batch-plan', {
          collection: batch.collection,
          slotIndices: batch.slotIndices,
          insertBase,
          childBatchTrailingCount,
          predecessorCount: predecessorOutputs.length,
          entryLockingBytecode: binToHex(entryLockingBytecode),
        });
      }
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
        console.error('nested-batch-entry-lock', {
          collection: batch.collection,
          selected: binToHex(entryLockingBytecode),
          proxy: binToHex(createEntryNftUnlocker(
            callee.inner, 0, callee.categoryId, batch.collection,
          ).generateLockingBytecode()),
          implementation: proxyCallee ? binToHex(createEntryNftUnlocker(
            proxyCallee.implementation.inner, 0, callee.categoryId, batch.collection,
          ).generateLockingBytecode()) : undefined,
        });
      }
      for (const [ordinal, output] of predecessorOutputs.entries()) {
        const outputBlockSlot = batchInsertBase + childBatchTrailingCount + ordinal;
        childBatchPredecessorOutputs.push({
          outputBlockSlot,
          lockingBytecode: entryLockingBytecode,
          commitment: binToHex(output.commitment),
        });
        // Predecessor recreations occupy balanced trailing positions. The builder iterates physical
        // block inputs when materializing outputs, so reserve a paired funder through this slot rather
        // than leaving metadata beyond `childBlockInputs.length` where it can never be emitted.
        while (childBlockInputs.length <= outputBlockSlot) {
          childBlockInputs.push(takeFunder());
        }
      }
      const proofOwnerByOutpoint = new Map<string, number>();
      for (const slotIndex of batch.slotIndices) {
        const alias = aliasOwner.get(slotIndex);
        if (alias !== undefined) {
          const ownerOffset = selectedLayout.slots.find((candidate) =>
            candidate.kind === 'entry' && candidate.slotIndex === alias)?.offset;
          if (ownerOffset === undefined) throw new Error(`Nested vmap alias owner has no block slot ${alias}`);
          childCompilerInternalArgs[`__internal__vmapBatchSlot_${slotIndex}`] =
          childBatchTargets.get(alias)!;
          childCompilerInternalArgs[`__internal__vmapBatchProof_${slotIndex}`] = BigInt(ownerOffset);
          childCompilerInternalArgs[`__internal__vmapBatchNext_${slotIndex}`] = new Uint8Array(32);
          childCompilerInternalArgs[`__internal__vmapBatchPredOut_${slotIndex}`] = -2n;
          continue;
        }
        const target = childBatchTargets.get(slotIndex)!;
        const proof = list.find(target) ?? list.predecessorOf(target);
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_PROOF_PICK === '1') {
          const proofOffset = selectedLayout.slots.find((candidate) =>
            candidate.kind === 'entry' && candidate.slotIndex === slotIndex)?.offset;
          const physical = proofOffset === undefined ? undefined : childBlockInputs[proofOffset];
          console.error('nested-proof-pick', JSON.stringify({
            phase: 'batch',
            collection: batch.collection,
            routeSlot: slotIndex,
            blockSlot: proofOffset,
            target: binToHex(target),
            selected: {
              slot: binToHex(proof.slot),
              next: binToHex(proof.nextKey),
              outpoint: `${proof.utxo.txid}:${proof.utxo.vout}`,
            },
            physical: physical && `${physical.txid}:${physical.vout}`,
          }));
        }
        const outpoint = `${proof.utxo.txid}:${proof.utxo.vout}`;
        let proofOwner = proofOwnerByOutpoint.get(outpoint);
        if (proofOwner === undefined) {
          proofOwner = slotIndex;
          proofOwnerByOutpoint.set(outpoint, slotIndex);
        } else {
          const duplicateOffset = selectedLayout.slots.find((candidate) =>
            candidate.kind === 'entry' && candidate.slotIndex === slotIndex)?.offset;
          if (duplicateOffset !== undefined) {
            childBlockInputs[duplicateOffset] = takeFunder();
            childBatchEntryLockingBytecodes.set(duplicateOffset, entryLockingBytecode);
          }
        }
        const proofOffset = selectedLayout.slots.find((candidate) =>
          candidate.kind === 'entry' && candidate.slotIndex === proofOwner)?.offset;
        if (proofOffset === undefined) throw new Error(`Nested vmap proof owner has no block slot ${proofOwner}`);
        const output = plan.outputs.find(
          (candidate) => bytesToSlotValue(candidate.slot) === bytesToSlotValue(target),
        );
        if (!output) throw new Error(`Nested vmap batch '${batch.collection}' has no target output`);
        const targetOffset = selectedLayout.slots.find((candidate) =>
          candidate.kind === 'entry' && candidate.slotIndex === slotIndex)?.offset;
        if (targetOffset !== undefined) {
          childBatchEntryCommitments.set(targetOffset, binToHex(output.commitment));
          childBatchEntryLockingBytecodes.set(targetOffset, entryLockingBytecode);
        }
        const predecessorOrdinal = predecessorOutputs.findIndex((candidate) =>
          bytesToSlotValue(candidate.slot) === bytesToSlotValue(proof.slot));
        childCompilerInternalArgs[`__internal__vmapBatchSlot_${slotIndex}`] = target;
        childCompilerInternalArgs[`__internal__vmapBatchProof_${slotIndex}`] = BigInt(proofOffset);
        childCompilerInternalArgs[`__internal__vmapBatchNext_${slotIndex}`] =
        decodeEntryCommitment(output.commitment).nextKey;
        childCompilerInternalArgs[`__internal__vmapBatchPredOut_${slotIndex}`] = predecessorOrdinal < 0
          ? -1n : BigInt(batchInsertBase + childBatchTrailingCount + predecessorOrdinal);
      }
      childBatchTrailingCount += predecessorOutputs.length;
    }
    if ((selectedFn?.sortedBatchInfo?.length ?? 0) > 0) {
      childCompilerInternalArgs.__internal__vmapBatchTrailingCount = BigInt(childBatchTrailingCount);
      for (const batch of activeSortedBatches) {
        const rows = batch.slotIndices
          .filter((slotIndex) => childBatchTargets.has(slotIndex)
            && childCompilerInternalArgs[`__internal__vmapBatchPredOut_${slotIndex}`] !== -2n)
          .map((slotIndex) => ({
            slotIndex,
            slot: childBatchTargets.get(slotIndex)!,
            next: childCompilerInternalArgs[`__internal__vmapBatchNext_${slotIndex}`] as Uint8Array
              ?? new Uint8Array(32),
          }))
          .sort((left, right) => (bytesToSlotValue(left.slot) < bytesToSlotValue(right.slot) ? -1 : 1));
        rows.forEach((row, rank) => {
          childCompilerInternalArgs[`__internal__vmapBatchRank_${row.slotIndex}`] = BigInt(rank);
        });
        if (batch.linear) {
          childCompilerInternalArgs[`__internal__vmapBatchRows_${batch.collection}`] = Uint8Array.from(
            rows.flatMap((row) => [...row.slot, ...(row.next ?? new Uint8Array(32))]),
          );
        }
      }
    }
    const childEntryOwnerByOutpoint = new Map<string, number>();
    for (const layoutSlot of selectedLayout.slots) {
      if (layoutSlot.kind !== 'entry') continue;
      const input = childBlockInputs[layoutSlot.offset];
      if (!input?.token?.nft) continue;
      const outpoint = `${input.txid}:${input.vout}`;
      if (childEntryOwnerByOutpoint.has(outpoint)) {
        const routeSlot = layoutSlot.slotIndex;
        const predOut = routeSlot === undefined ? undefined
          : childCompilerInternalArgs[`__internal__vmapBatchPredOut_${routeSlot}`];
        // predOut=-2 is a true same-target runtime alias and deliberately has no target output.
        if (predOut !== -2n && routeSlot !== undefined) {
          const access = entryAccessAt(selectedFn, routeSlot);
          if (access) {
            childBatchEntryLockingBytecodes.set(
              layoutSlot.offset,
              createEntryNftUnlocker(
                proxyCallee?.implementation.inner ?? callee.inner,
                0,
                callee.categoryId,
                access.collection,
              ).generateLockingBytecode(),
            );
          }
        }
        childBlockInputs[layoutSlot.offset] = takeFunder();
      } else {
        childEntryOwnerByOutpoint.set(outpoint, layoutSlot.offset);
      }
    }
    if (timingEnabled && nested.callsiteId === 6) console.error('nested-callsite-entry-dedup-complete');
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_INPUTS === '1') {
      console.error('entry-slots-final', selectedLayout.slots
        .filter((layoutSlot) => layoutSlot.kind === 'entry')
        .map((layoutSlot) => ({
          slotIndex: layoutSlot.slotIndex,
          offset: layoutSlot.offset,
          collection: entryAccessAt(selectedFn, layoutSlot.slotIndex ?? -1)?.collection,
          outpoint: childBlockInputs![layoutSlot.offset]
            ? `${childBlockInputs![layoutSlot.offset].txid}:${childBlockInputs![layoutSlot.offset].vout}`
            : 'NONE',
        })));
    }
    for (const [insertIndex, planned] of childPlannedEntryInserts.entries()) {
      const outputBlockSlot = Math.max(insertBase + insertIndex, childBlockInputs.length);
      planned.outputBlockSlot = outputBlockSlot;
      const routeSlot = selectedLayout.slots[planned.blockSlot]?.slotIndex;
      if (routeSlot !== undefined) {
        childCompilerInternalArgs[`__internal__vmapBatchPredOut_${routeSlot}`] =
          BigInt(outputBlockSlot);
      }
      while (childBlockInputs.length <= outputBlockSlot) {
        childBlockInputs.push(takeFunder());
      }
    }
    if (timingEnabled && nested.callsiteId === 6) console.error('nested-callsite-inserts-complete', {
      planned: childPlannedEntryInserts.length, blockInputs: childBlockInputs.length,
    });
  }
  const childRelativeOutputInternalArgs = Object.entries(childCompilerInternalArgs)
    .filter(([name, value]) => /^__internal__vmapBatchPredOut_\d+$/.test(name)
      && typeof value === 'bigint' && value >= 0n)
    .map(([name]) => name);
  if (proxyCallee && delegateCallGroupIndex !== undefined
    && childWritesState && childBlockInputs && selectedLayout) {
    const delegate = lowLevelCallUtxoGroups[delegateCallGroupIndex];
    delegate.blockInputs = childBlockInputs;
    delegate.blockLayout = selectedLayout;
    delegate.stateLayout = childLayout;
    delegate.returnEventInBlock = selectedLayout.slots
      .some((slot) => slot.kind === 'returnEvent');
    delegate.plannedEntryInserts = childPlannedEntryInserts;
    delegate.batchPredecessorOutputs = childBatchPredecessorOutputs;
    delegate.batchEntryLockingBytecodes = childBatchEntryLockingBytecodes;
    delegate.batchEntryCommitments = childBatchEntryCommitments;
    delegate.relativeOutputInternalArgs = childRelativeOutputInternalArgs;
    delegate.dynamicChunkResources = childDynamicChunkResources;
  }
  if (sharedGroupIndex >= 0 && childWritesState && !preserveFirstConditionalWriter) {
    const primary = externalCallUtxoGroups[sharedGroupIndex];
    const proxyPrefixSize = proxyCallee && childBlockInputs && selectedLayout
      && delegateCallGroupIndex !== undefined ? 1 + childData.length : 0;
    if (proxyPrefixSize > 0) {
      Object.assign(
        childCompilerInternalArgs,
        rebaseRoutedBatchProofOffsets(childCompilerInternalArgs, proxyPrefixSize),
      );
    }
    primary.stateLayout = childLayout;
    primary.masterUtxo = childState.masterUtxo;
    primary.dataNftUtxos = childData;
    primary.requiredDataNftIndices = childRequired;
    if (Object.keys(childCompilerInternalArgs).length > 0) {
      primary.internalArgs = childCompilerInternalArgs;
    }
    primary.relativeOutputInternalArgs = childRelativeOutputInternalArgs;
    if (proxyCallee && childBlockInputs && selectedLayout
      && delegateCallGroupIndex !== undefined) {
      const proxyPrefix = [childState.masterUtxo as UnlockableUtxo, ...childData];
      // Delegate execution follows the proxy's fixed state prefix, but routed dynamic state remains
      // anchored to the authenticated proxy owner plus the compiler-published trailingBase. Move those
      // inputs back across the prefix while keeping the executor-relative source positions balanced.
      const embeddedBlockInputs = anchorRoutedDynamicResourcesAtOwner(
        [...proxyPrefix, ...childBlockInputs], childDynamicChunkResources, proxyPrefix.length,
      );
      const shiftedSlots = selectedLayout.slots.map((slot) => ({
        ...slot,
        offset: slot.offset + proxyPrefix.length,
      }));
      primary.blockInputs = embeddedBlockInputs;
      primary.blockLayout = {
        blockSize: proxyPrefix.length + childBlockInputs.length,
        slots: [
          { kind: 'master', offset: 0 },
          ...childRequired.map((nftIndex, index) => ({
            kind: 'dataNft' as const, offset: 1 + index, nftIndex,
          })),
          ...shiftedSlots,
        ],
        trailingBase: selectedLayout.trailingBase === undefined
          ? undefined : proxyPrefix.length + selectedLayout.trailingBase,
        trailingCapacity: selectedLayout.trailingCapacity,
      };
      primary.delegateEmbeddedInBlock = true;
      primary.plannedEntryInserts = childPlannedEntryInserts.map((planned) => ({
        ...planned,
        blockSlot: planned.blockSlot + proxyPrefix.length,
        outputBlockSlot: planned.outputBlockSlot + proxyPrefix.length,
      }));
      primary.batchPredecessorOutputs = childBatchPredecessorOutputs.map((planned) => ({
        ...planned,
        outputBlockSlot: planned.outputBlockSlot + proxyPrefix.length,
      }));
      primary.batchEntryLockingBytecodes = new Map(
        [...childBatchEntryLockingBytecodes].map(([offset, lockingBytecode]) =>
          [offset + proxyPrefix.length, lockingBytecode]),
      );
      primary.batchEntryCommitments = new Map(
        [...childBatchEntryCommitments].map(([offset, commitment]) =>
          [offset + proxyPrefix.length, commitment]),
      );
      primary.dynamicChunkResources = childDynamicChunkResources;
      primary.returnEventInBlock = selectedLayout.slots
        .some((slot) => slot.kind === 'returnEvent');
    } else if (!proxyCallee) {
      primary.blockInputs = childBlockInputs;
      primary.blockLayout = selectedLayout;
      if (selectedLayout?.slots.some((slot) => slot.kind === 'returnEvent')) {
        primary.returnEventInBlock = true;
      }
      primary.plannedEntryInserts = childPlannedEntryInserts;
      primary.batchPredecessorOutputs = childBatchPredecessorOutputs;
      primary.batchEntryLockingBytecodes = childBatchEntryLockingBytecodes;
      primary.batchEntryCommitments = childBatchEntryCommitments;
      primary.dynamicChunkResources = childDynamicChunkResources;
    }
    if (nested.hasReturnValues) {
      primary.fusedReturnGroupIndex = childExternalGroupIndex;
    }
  }

  // Repack bags
  bags.childBlockInputs = childBlockInputs;
  bags.childValueChunkSlots = childValueChunkSlots;
  bags.routeValueChunkProducerAliases = routeValueChunkProducerAliases;
  bags.routeValueChunkProducerPhysicalGroup = routeValueChunkProducerPhysicalGroup;
  bags.routeValueChunkProducerEpoch = routeValueChunkProducerEpoch;
  bags.refreshChunkableRouteWitnesses = refreshChunkableRouteWitnesses;

  return { bags, childRelativeOutputInternalArgs };
}
