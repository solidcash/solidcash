/**
 * phase-boundary extract: SC _createBuilder extract — late-transitive compose layer
 * (expand A→B→C callees discovered after nested compose).
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX,
  type AbiFunction,
  type ExternalCallAbi,
  type StateLayout,
  type StateValue,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import { tryCashAddressToLockScript } from '../utils.js';
import {
  createDataNftUnlocker,
  createEntryNftUnlocker,
  getEntryNftAddress,
} from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { encodeExternalReturnValue } from './external-return-encoding.js';
import { externalReturnsForCallsites } from './external-returns-for-callsites.js';
import {
  createGraphPlanningProducerResultContext,
  memoizeGraphPlanningProducerResult,
} from './graph-planning-producer-result.js';
import {
  findDeploymentByAddress,
  findDeploymentByLockingBytecode,
  findDeploymentByName,
} from './deployment-registry.js';
import {
  entryAccessAt,
  resolvePreparedProducerEntry,
  resolveRouteRowExpressionKey,
} from './route-expression-key.js';
import { resolveExternalResultEncoding } from './solidityAbi.js';
import {
  SortedList, bytesToSlotValue, decodeEntryCommitment, keyToSlotMulti,
} from './SortedList.js';
import { isMsgSenderKeySource } from './soft-state-overlays.js';
import type { OnChainState } from './StateReader.js';
import {
  type ValueChunkProducerPathDisposition,
} from './ValueChunkProducerIdentity.js';
const DUMMY_FUNDER_LOCKING_BYTECODE = hexToBin(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX);
const DUMMY_FUNDER_UNLOCKING_BYTECODE = new Uint8Array([0x01, 0x51]);

export type ExpandCreateBuilderLateTransitiveHost = {
  readonly categoryId: string;
  readonly inner: { provider: any };
  readonly signer: { getAddress(): string } | undefined;
  readonly externalRegistry: { get(name: string): unknown };
  nestedFullState: (contract: any) => Promise<OnChainState>;
  nestedAddressUtxos: (address: string) => Promise<Utxo[]>;
  markSharedFunder: (utxo: UnlockableUtxo) => void;
  shiftSharedFunder: () => UnlockableUtxo | undefined;
  nextNestedFunderIndex: () => number;
  selectProxyForwardInput: (...args: any[]) => FunctionArgument;
  preparedChildProducerPath: (depth: number, row: any) => ValueChunkProducerPathDisposition;
  timing: (label: string) => void;
};

export type ExpandCreateBuilderLateTransitiveBags = {
  allGroupEcSlots: Array<ExternalCallAbi | {
    hasReturnValues?: boolean;
    requiredDataNftIndices: number[];
  }>;
  allGroupParentIndices: number[];
  lateTransitiveGroupIndices: Set<number>;
};

/**
 * After nested compose completes, expand one additional concrete layer of
 * callee-of-callee external calls (A→B→C) onto the physical group graph.
 */
export async function expandCreateBuilderLateTransitive(
  host: ExpandCreateBuilderLateTransitiveHost,
  params: {
    externalCallUtxoGroups: ExternalCallUtxoGroup[];
    lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
    preparedAtomicNodes: any[] | undefined;
    preparedAtomicNodeByExternalGroup: Map<number, number>;
    publicSelfAddress: FunctionArgument;
    bags: ExpandCreateBuilderLateTransitiveBags;
    [key: string]: any;
  },
): Promise<ExpandCreateBuilderLateTransitiveBags> {
  const {
    externalCallUtxoGroups, lowLevelCallUtxoGroups, preparedAtomicNodes,
    preparedAtomicNodeByExternalGroup, publicSelfAddress, bags,
  } = params;

  let allGroupEcSlots = bags.allGroupEcSlots;
  let allGroupParentIndices = bags.allGroupParentIndices;
  const lateTransitiveGroupIndices = bags.lateTransitiveGroupIndices;
  const nestedFullState = host.nestedFullState;
  const nestedAddressUtxos = host.nestedAddressUtxos;
  const markSharedFunder = host.markSharedFunder;
  const selectProxyForwardInput = host.selectProxyForwardInput;
  const preparedChildProducerPath = host.preparedChildProducerPath;
  const delegateComposedGroupCount = externalCallUtxoGroups.length;
  for (let parentGroupIndex = 0; parentGroupIndex < delegateComposedGroupCount; parentGroupIndex++) {
    const parent = externalCallUtxoGroups[parentGroupIndex];
    const parentContract = parent.externalContract as any;
    const logicalParentContract = (parent.logicalContract ?? parentContract) as any;
    // This layer expands an outgoing CALL made by `parent`. A delegate executor authenticates the code and
    // physical resources which produced that call, but Solidity-visible `address(this)` and the callee's
    // `msg.sender` are the authenticated state owner. Keep that owner as one indivisible pair throughout
    // argument resolution and route witness planning.
    const parentCallerIdentity = Object.freeze({
      categoryId: parentContract.categoryId,
      lockingBytecode: parentContract.inner.lockingBytecode,
    });
    const parentOutgoingSelfAddress = hexToBin(parentCallerIdentity.lockingBytecode);
    // Expressions inside this invocation observe its incoming caller, not its own outgoing identity
    // and not the transaction signer.
    const parentIncomingCallerAddress = parent.callerIdentity
      ? hexToBin(parent.callerIdentity.lockingBytecode) : undefined;
    const logicalParentArtifact = parent.logicalArtifact ?? logicalParentContract.inner.artifact;
    const logicalParentFunctionName = parent.logicalFunctionName ?? parent.functionName;
    const logicalParentArgs = parent.logicalFunctionArgs ?? parent.functionArgs;
    const parentAtomicNode = preparedAtomicNodeByExternalGroup.get(parentGroupIndex);
    const graphParentArgs = parentAtomicNode === undefined
      ? logicalParentArgs : preparedAtomicNodes?.[parentAtomicNode]?.args ?? logicalParentArgs;
    const parentFn = (logicalParentArtifact.abi as readonly AbiFunction[])
      .find((candidate) => candidate.name === logicalParentFunctionName);
    if (!parentFn?.externalCalls?.length) continue;
    const graphPlanningResults = createGraphPlanningProducerResultContext();
    const parentState = await logicalParentContract.getState() as Record<string, StateValue>;
    for (const nested of parentFn.externalCalls) {
      if (allGroupParentIndices.some((candidate, index) => candidate === parentGroupIndex
        && (allGroupEcSlots[index] as ExternalCallAbi | undefined)?.callsiteId === nested.callsiteId)) {
        continue;
      }
      const resolvedAddressTarget = nested.addressSource
        ? logicalParentContract._resolveExternalArgs(
          [nested.addressSource], logicalParentArgs, logicalParentArtifact, parentState,
          parentFn.inputs, undefined, 0, false, parentOutgoingSelfAddress,
          parentIncomingCallerAddress,
        )?.[0]
        : nested.addressStateVar
          ? parentState[nested.addressStateVar] as FunctionArgument | undefined
          : undefined;
      const resolvedTargetLockingBytecode = tryCashAddressToLockScript(resolvedAddressTarget);
      let registered = logicalParentContract._externalRegistry.get(nested.interfaceName)
        ?? parentContract._externalRegistry.get(nested.interfaceName)
        ?? host.externalRegistry.get(nested.interfaceName)
        ?? findDeploymentByName(host.inner.provider, nested.interfaceName)?.contract
        ?? (/^I[A-Z]/.test(nested.interfaceName)
          ? findDeploymentByName(host.inner.provider, nested.interfaceName.slice(1))?.contract : undefined);
      if (!registered && resolvedAddressTarget !== undefined) {
        const targetHex = resolvedAddressTarget instanceof Uint8Array
          ? binToHex(resolvedAddressTarget) : undefined;
        registered = targetHex
          ? findDeploymentByLockingBytecode(host.inner.provider, targetHex)?.contract
          : typeof resolvedAddressTarget === 'string'
            ? (findDeploymentByAddress(host.inner.provider, resolvedAddressTarget)
              ?? findDeploymentByLockingBytecode(host.inner.provider, resolvedAddressTarget))?.contract
            : undefined;
      }
      // A lowered Address/SafeERC20 edge deliberately has no source interface name. Resolve it from the
      // authenticated computed address first, then from an already co-spent deployment advertising the
      // compiler-decoded selector. Skipping this edge leaves the parent's extcall/return witnesses at -1;
      // guessing by `__raw__` in the registry can instead redirect the call to an unrelated deployment.
      if (!registered && nested.interfaceName === '__raw__') {
        const rawTarget = resolvedAddressTarget;
        const rawTargetHex = rawTarget instanceof Uint8Array ? binToHex(rawTarget) : undefined;
        const deployment = rawTargetHex
          ? findDeploymentByLockingBytecode(host.inner.provider, rawTargetHex)?.contract
          : typeof rawTarget === 'string'
            ? (findDeploymentByAddress(host.inner.provider, rawTarget)
              ?? findDeploymentByLockingBytecode(host.inner.provider, rawTarget))?.contract : undefined;
        registered = deployment ?? externalCallUtxoGroups
          .map((candidate) => candidate.externalContract as any)
          .find((candidate) => {
            if (rawTargetHex && candidate.inner.lockingBytecode !== rawTargetHex) return false;
            return (candidate.inner.artifact.abi as readonly AbiFunction[]).some((fn) => (
              (nested.rawFunctionName !== undefined && fn.name === nested.rawFunctionName)
              || (nested.rawSelector !== undefined && fn.selector === nested.rawSelector)
            ));
          });
      }
      if (!registered) continue;
      const registeredCallee = registered as unknown as any | {
        proxy: any;
        implementation: any;
        forward: (name: string, args: FunctionArgument[]) => any;
      };
      const proxyCallee = 'implementation' in registeredCallee ? registeredCallee : undefined;
      const callee = (proxyCallee?.proxy ?? registeredCallee) as any;
      const childArgs = logicalParentContract._resolveExternalArgs(
        nested.rawArgSources ?? nested.argSources,
        logicalParentArgs, logicalParentArtifact, parentState,
        parentFn.inputs, undefined, 0, false, parentOutgoingSelfAddress,
        parentIncomingCallerAddress,
      );
      if (childArgs === undefined) continue;
      const graphChildArgs = graphParentArgs === logicalParentArgs
        ? childArgs
        : logicalParentContract._resolveExternalArgs(
          nested.rawArgSources ?? nested.argSources,
          [...graphParentArgs], logicalParentArtifact, parentState,
          parentFn.inputs, undefined, 0, false, parentOutgoingSelfAddress,
          parentIncomingCallerAddress,
        ) ?? childArgs;
      const graphChildSources = nested.rawArgSources ?? nested.argSources;
      const resolveGraphChildArgs = preparedAtomicNodes && graphChildSources
        ? (results: ReadonlyMap<number, FunctionArgument>): FunctionArgument[] | undefined => {
          const externalReturns = externalReturnsForCallsites(
            graphChildSources, results, parentFn.externalCalls ?? [],
            nested.callsiteId === undefined ? undefined : {
              callsiteId: nested.callsiteId,
              resultConsumers: parentFn.resultConsumers,
            },
          );
          if (externalReturns.size === 0) return undefined;
          return logicalParentContract._resolveExternalArgs(
            graphChildSources, [...graphParentArgs], logicalParentArtifact, parentState,
            parentFn.inputs, externalReturns, 0, false, parentOutgoingSelfAddress,
            parentIncomingCallerAddress,
          );
        }
        : undefined;
      const selectedContract = proxyCallee?.implementation ?? callee;
      const rawFunctionName = nested.interfaceName === '__raw__'
        ? nested.rawFunctionName ?? (selectedContract.inner.artifact.abi as readonly AbiFunction[])
          .find((candidate) => candidate.selector === nested.rawSelector)?.name
        : undefined;
      const selectedFn = (selectedContract.inner.artifact.abi as readonly AbiFunction[])
        .find((candidate) => candidate.name === (rawFunctionName ?? nested.functionName));
      if (!selectedFn) continue;
      // As in direct expansion: the name match above drives layout, while producer identity is taken only
      // from the compiler-published selector for this edge, or from a name that resolves to one selector.
      // A late transitive edge publishes no selector of its own, so an overloaded name fails closed here.
      const producerSelector = resolvePreparedProducerEntry(
        proxyCallee
          ? [selectedContract.inner.artifact, callee.inner.artifact]
          : [selectedContract.inner.artifact],
        rawFunctionName ?? nested.functionName,
        nested.rawSelector,
      )?.selector;
      const childState = await nestedFullState(callee);
      if (!childState.masterUtxo) continue;
      const requiredDataNftIndices = [...new Set(
        (selectedFn.blockLayout?.slots ?? [])
          .filter((slot) => slot.kind === 'dataNft' && slot.nftIndex !== undefined)
          .map((slot) => slot.nftIndex!),
      )];
      const dataNftUtxos = requiredDataNftIndices.flatMap((nftIndex) => {
        const utxo = childState.dataNftUtxos[nftIndex];
        return utxo ? [{
          ...utxo,
          unlocker: createDataNftUnlocker(callee.inner, 0, callee.categoryId),
        }] : [];
      });
      const existingPhysicalIndex = externalCallUtxoGroups.findIndex(
        (candidate) => candidate.categoryId === callee.categoryId,
      );
      const physicalOwnerIndex = existingPhysicalIndex < 0 ? -1
        : (externalCallUtxoGroups[existingPhysicalIndex].sharedGroupIndex ?? existingPhysicalIndex);
      const physicalOwner = physicalOwnerIndex < 0
        ? undefined : externalCallUtxoGroups[physicalOwnerIndex];
      const physicalOwnerFn = physicalOwner === undefined ? undefined
        : (physicalOwner.externalContract.inner.artifact.abi as readonly AbiFunction[])
          .find((candidate) => candidate.name === physicalOwner.functionName);
      const physicalRouteCoversCall = selectedFn.selector !== undefined
        && physicalOwner?.compilerRoute?.logicalSelectors.includes(selectedFn.selector) === true;
      // Late graph expansion discovers callees of already-composed callees (A -> B -> C). If C's master
      // was provisionally owned by an earlier read or conditional alternative, the state-writing edge is
      // the physical transition which must execute. Apply the same ownership rule as direct composition:
      // repeated conditional alternatives selecting one handler keep their first carrier, while a distinct
      // writer replaces an ordinary (non-routed) carrier. A compiler route already owns all selectors it
      // advertises and must not be dismantled here.
      const preserveConditionalOwner = nested.occurrence === 'conditional'
        && selectedFn.writesState === true
        && physicalOwnerFn?.selector === selectedFn.selector
        && physicalOwnerFn?.writesState === true;
      const retargetPhysicalOwner = physicalOwner !== undefined
        && selectedFn.writesState === true
        && physicalOwner.compilerRoute === undefined
        && !physicalRouteCoversCall
        && !preserveConditionalOwner;
      const lateInternalArgs: Record<string, FunctionArgument> = {};
      const lateRelativeOutputInternalArgs = new Set<string>();
      const latePlannedEntryInserts: Array<{
        slotIndex: number; blockSlot: number; outputBlockSlot: number;
        commitment: string; newCommitment: string;
      }> = [];
      const lateBatchTargets = new Map<number, Uint8Array>();
      const lateBatchLists = new Map<string, SortedList>();
      const lateBatchPredecessorOutputs: Array<{
        outputBlockSlot: number; lockingBytecode: Uint8Array; commitment: string;
      }> = [];
      const lateBatchEntryLockingBytecodes = new Map<number, Uint8Array>();
      let lateBlockInputs: UnlockableUtxo[] | undefined;
      const lateLayout = selectedFn.blockLayout;
      if ((existingPhysicalIndex < 0 || retargetPhysicalOwner) && !proxyCallee && lateLayout) {
        const needsDenseBlock = lateLayout.slots.some((slot) => (
          slot.kind !== 'master' && slot.kind !== 'dataNft'
        ));
        if (needsDenseBlock) {
          lateBlockInputs = [];
          const dataByNftIndex = new Map(requiredDataNftIndices.map(
            (nftIndex, index) => [nftIndex, dataNftUtxos[index]] as const,
          ));
          const makeLateFunder = (): UnlockableUtxo => {
            const pooled = host.shiftSharedFunder();
            if (pooled) {
              markSharedFunder(pooled);
              return pooled;
            }
            if (host.signer) {
              throw new Error(
                `Insufficient funding UTXOs for nested call ${nested.interfaceName}.${nested.functionName}.`,
              );
            }
            const provider = host.inner.provider as typeof host.inner.provider & {
              addUtxo?: (lockingBytecode: string, utxo: Utxo) => Promise<void>;
            };
            if (!provider.addUtxo) {
              throw new Error(
                `Nested call ${nested.interfaceName}.${nested.functionName} requires a funding UTXO.`,
              );
            }
            const dummy: Utxo = {
              txid: (0xf000n + BigInt(host.nextNestedFunderIndex())).toString(16).padStart(64, '0'),
              vout: 0,
              satoshis: 10000n,
            };
            // MockNetworkProvider mutates its index synchronously. Avoid yielding in this hot block loop.
            void provider.addUtxo(binToHex(DUMMY_FUNDER_LOCKING_BYTECODE), dummy);
            const funder: UnlockableUtxo = {
              ...dummy,
              unlocker: {
                generateLockingBytecode: () => DUMMY_FUNDER_LOCKING_BYTECODE,
                generateUnlockingBytecode: () => DUMMY_FUNDER_UNLOCKING_BYTECODE,
              },
            };
            markSharedFunder(funder);
            return funder;
          };
          const visibleInputs = selectedFn.inputs.filter((input) => !input.name.startsWith('__internal__'));
          for (const slot of lateLayout.slots) {
            if (slot.kind === 'master') {
              lateBlockInputs.push(childState.masterUtxo as UnlockableUtxo);
              continue;
            }
            if (slot.kind === 'dataNft') {
              const data = slot.nftIndex === undefined ? undefined : dataByNftIndex.get(slot.nftIndex);
              if (!data) {
                throw new Error(
                  `Nested call ${nested.interfaceName}.${nested.functionName} is missing data NFT `
                  + `${slot.nftIndex ?? '(unknown)'}.`,
                );
              }
              lateBlockInputs.push(data);
              continue;
            }
            if (slot.kind === 'entry') {
              const routeSlot = slot.slotIndex ?? 0;
              const access = entryAccessAt(selectedFn, routeSlot);
              const collection = callee.inner.stateLayout?.collections?.find((candidate: any) => (
                candidate.name === access?.collection || candidate.signature === access?.collection
              ));
              if (!access || !collection?.sorted) {
                throw new Error(
                  `Nested call ${nested.interfaceName}.${nested.functionName} has an unsupported `
                  + `entry resource at slot ${routeSlot}.`,
                );
              }
              const keySources = access.keySources
                ?? access.keyParams.map((paramName) => ({ kind: 'param' as const, paramName }));
              const encodedKeys = keySources.map((source, keyIndex) => {
                if (isMsgSenderKeySource(source)) {
                  return hexToBin(parentCallerIdentity.lockingBytecode);
                }
                if (source.kind === 'expression' && 'expressionLabel' in source) {
                  const resolved = resolveRouteRowExpressionKey({
                    expressionLabel: source.expressionLabel,
                    collection: access.collection,
                    routePlanningArgs: childArgs,
                    routeVisibleInputs: visibleInputs,
                    structs: selectedContract.inner.artifact.structs
                      ?? selectedContract.inner.stateLayout?.structs,
                    state: childState.state,
                  });
                  if (resolved) return resolved;
                }
                const paramName = source.paramName ?? access.keyParams[keyIndex];
                const inputIndex = visibleInputs.findIndex((input) => input.name === paramName);
                const input = visibleInputs[inputIndex];
                const value = childArgs[inputIndex];
                if (!input || value === undefined) {
                  throw new Error(
                    `Nested call ${nested.interfaceName}.${nested.functionName} cannot resolve entry key `
                    + `'${paramName ?? keyIndex}'.`,
                  );
                }
                const encoded = encodeFunctionArgument(
                  value, input.type,
                  selectedContract.inner.artifact.structs ?? selectedContract.inner.stateLayout?.structs,
                );
                if (!(encoded instanceof Uint8Array)) {
                  throw new Error(
                    `Nested call ${nested.interfaceName}.${nested.functionName} produced a non-byte entry key.`,
                  );
                }
                return encoded;
              });
              const entryAddress = getEntryNftAddress(
                selectedContract.inner, callee.categoryId, access.collection,
              );
              const list = SortedList.fromUtxos((await nestedAddressUtxos(entryAddress)).filter((utxo) => (
                utxo.token?.category === callee.categoryId
                  && utxo.token?.nft?.capability === 'mutable'
                  && !!utxo.token.nft.commitment
              )));
              const targetSlot = keyToSlotMulti(encodedKeys);
              lateBatchTargets.set(routeSlot, targetSlot);
              lateBatchLists.set(access.collection, list);
              const exact = list.find(targetSlot);
              const proof = exact ?? list.predecessorOf(targetSlot);
              if (!proof) {
                throw new Error(
                  `Nested call ${nested.interfaceName}.${nested.functionName} has no authenticated `
                  + `predecessor for entry slot ${routeSlot}.`,
                );
              }
              const blockOffset = lateBlockInputs.length;
              lateBlockInputs.push({
                ...proof.utxo,
                unlocker: createEntryNftUnlocker(
                  selectedContract.inner, blockOffset, callee.categoryId, access.collection,
                ),
              });
              const batchOwned = selectedFn.sortedBatchInfo
                ?.some((batch) => batch.slotIndices.includes(routeSlot)) === true;
              if (!batchOwned && access.operations.includes('write') && !exact) {
                const plan = list.planInsert(targetSlot);
                latePlannedEntryInserts.push({
                  slotIndex: routeSlot,
                  blockSlot: blockOffset,
                  outputBlockSlot: -1,
                  commitment: binToHex(plan.predNewCommitment),
                  newCommitment: binToHex(plan.newNodeCommitment),
                });
              }
              if (batchOwned) {
                lateInternalArgs[`__internal__vmapBatchSlot_${routeSlot}`] = targetSlot;
                lateInternalArgs[`__internal__vmapBatchProof_${routeSlot}`] = BigInt(blockOffset);
                if (exact) {
                  lateInternalArgs[`__internal__vmapBatchNext_${routeSlot}`] = exact.nextKey;
                  lateInternalArgs[`__internal__vmapBatchPredOut_${routeSlot}`] = -1n;
                }
              }
              continue;
            }
            if (['event', 'returnEvent', 'transfer', 'tcTransfer'].includes(slot.kind)) {
              lateBlockInputs.push(makeLateFunder());
              continue;
            }
            throw new Error(
              `Nested call ${nested.interfaceName}.${nested.functionName} requires unsupported late `
              + `resource '${slot.kind}'.`,
            );
          }
          const batchInsertBase = lateLayout.trailingBase ?? lateLayout.blockSize;
          let batchTrailingCount = 0;
          for (const batch of selectedFn.sortedBatchInfo ?? []) {
            const list = lateBatchLists.get(batch.collection);
            if (!list) throw new Error(
              `Nested vmap batch '${batch.collection}' has no sorted-list snapshot`,
            );
            const canonicalSlots: number[] = [];
            const canonicalByTarget = new Map<string, number>();
            const aliasOwner = new Map<number, number>();
            for (const slotIndex of batch.slotIndices) {
              const target = lateBatchTargets.get(slotIndex);
              if (!target) throw new Error(
                `Nested vmap batch '${batch.collection}' is missing slot ${slotIndex}`,
              );
              const prior = canonicalByTarget.get(binToHex(target));
              if (prior === undefined) {
                canonicalByTarget.set(binToHex(target), slotIndex);
                canonicalSlots.push(slotIndex);
              } else {
                aliasOwner.set(slotIndex, prior);
              }
            }
            const writes = canonicalSlots.map((slotIndex) => ({
              slot: lateBatchTargets.get(slotIndex)!, value: new Uint8Array(),
            }));
            const plan = list.planBatchUpsert(writes);
            const targets = new Set(writes.map((write) => bytesToSlotValue(write.slot).toString()));
            const predecessorOutputs = plan.outputs.filter(
              (output) => !targets.has(bytesToSlotValue(output.slot).toString()),
            );
            const lockingBytecode = createEntryNftUnlocker(
              selectedContract.inner, 0, callee.categoryId, batch.collection,
            ).generateLockingBytecode();
            for (const [ordinal, output] of predecessorOutputs.entries()) {
              const outputBlockSlot = batchInsertBase + batchTrailingCount + ordinal;
              lateBatchPredecessorOutputs.push({
                outputBlockSlot,
                lockingBytecode,
                commitment: binToHex(output.commitment),
              });
              while (lateBlockInputs.length <= outputBlockSlot) {
                lateBlockInputs.push(makeLateFunder());
              }
            }
            const proofOwnerByOutpoint = new Map<string, number>();
            for (const slotIndex of batch.slotIndices) {
              const alias = aliasOwner.get(slotIndex);
              if (alias !== undefined) {
                const ownerOffset = lateLayout.slots.find((candidate) =>
                  candidate.kind === 'entry' && candidate.slotIndex === alias)?.offset;
                if (ownerOffset === undefined) throw new Error(
                  `Nested vmap alias owner has no block slot ${alias}`,
                );
                lateInternalArgs[`__internal__vmapBatchSlot_${slotIndex}`] = lateBatchTargets.get(alias)!;
                lateInternalArgs[`__internal__vmapBatchProof_${slotIndex}`] = BigInt(ownerOffset);
                lateInternalArgs[`__internal__vmapBatchNext_${slotIndex}`] = new Uint8Array(32);
                lateInternalArgs[`__internal__vmapBatchPredOut_${slotIndex}`] = -2n;
                continue;
              }
              const target = lateBatchTargets.get(slotIndex)!;
              const proof = list.find(target) ?? list.predecessorOf(target);
              if (!proof) throw new Error(
                `Nested vmap batch '${batch.collection}' has no proof for slot ${slotIndex}`,
              );
              const outpoint = `${proof.utxo.txid}:${proof.utxo.vout}`;
              let proofOwner = proofOwnerByOutpoint.get(outpoint);
              if (proofOwner === undefined) {
                proofOwner = slotIndex;
                proofOwnerByOutpoint.set(outpoint, slotIndex);
              } else {
                const duplicateOffset = lateLayout.slots.find((candidate) =>
                  candidate.kind === 'entry' && candidate.slotIndex === slotIndex)?.offset;
                if (duplicateOffset !== undefined) {
                  lateBlockInputs[duplicateOffset] = makeLateFunder();
                  lateBatchEntryLockingBytecodes.set(duplicateOffset, lockingBytecode);
                }
              }
              const proofOffset = lateLayout.slots.find((candidate) =>
                candidate.kind === 'entry' && candidate.slotIndex === proofOwner)?.offset;
              if (proofOffset === undefined) throw new Error(
                `Nested vmap proof owner has no block slot ${proofOwner}`,
              );
              const output = plan.outputs.find(
                (candidate) => bytesToSlotValue(candidate.slot) === bytesToSlotValue(target),
              );
              if (!output) throw new Error(
                `Nested vmap batch '${batch.collection}' has no target output`,
              );
              const predecessorOrdinal = predecessorOutputs.findIndex((candidate) =>
                bytesToSlotValue(candidate.slot) === bytesToSlotValue(proof.slot));
              const predOutName = `__internal__vmapBatchPredOut_${slotIndex}`;
              lateInternalArgs[`__internal__vmapBatchSlot_${slotIndex}`] = target;
              lateInternalArgs[`__internal__vmapBatchProof_${slotIndex}`] = BigInt(proofOffset);
              lateInternalArgs[`__internal__vmapBatchNext_${slotIndex}`] =
                decodeEntryCommitment(output.commitment).nextKey;
              lateInternalArgs[predOutName] = predecessorOrdinal < 0
                ? -1n : BigInt(batchInsertBase + batchTrailingCount + predecessorOrdinal);
              if (predecessorOrdinal >= 0) lateRelativeOutputInternalArgs.add(predOutName);
            }
            batchTrailingCount += predecessorOutputs.length;
            const rows = batch.slotIndices
              .filter((slotIndex) => lateInternalArgs[`__internal__vmapBatchPredOut_${slotIndex}`] !== -2n)
              .map((slotIndex) => ({
                slotIndex,
                slot: lateBatchTargets.get(slotIndex)!,
                next: lateInternalArgs[`__internal__vmapBatchNext_${slotIndex}`] as Uint8Array
                  ?? new Uint8Array(32),
              }))
              .sort((left, right) => bytesToSlotValue(left.slot) < bytesToSlotValue(right.slot) ? -1 : 1);
            rows.forEach((row, rank) => {
              lateInternalArgs[`__internal__vmapBatchRank_${row.slotIndex}`] = BigInt(rank);
            });
            if (batch.linear) {
              lateInternalArgs[`__internal__vmapBatchRows_${batch.collection}`] = Uint8Array.from(
                rows.flatMap((row) => [...row.slot, ...row.next]),
              );
            }
          }
          for (const planned of latePlannedEntryInserts) {
            planned.outputBlockSlot = Math.max(lateBlockInputs.length, lateLayout.blockSize);
            while (lateBlockInputs.length < planned.outputBlockSlot) {
              lateBlockInputs.push(makeLateFunder());
            }
            lateBlockInputs.push(makeLateFunder());
          }
          if (selectedFn.sortedBatchInfo?.length) {
            lateInternalArgs.__internal__vmapBatchTrailingCount = BigInt(batchTrailingCount);
          }
        }
      }
      if (retargetPhysicalOwner && physicalOwner) {
        physicalOwner.stateLayout = callee.inner.stateLayout!;
        physicalOwner.masterUtxo = childState.masterUtxo;
        physicalOwner.dataNftUtxos = dataNftUtxos;
        physicalOwner.requiredDataNftIndices = requiredDataNftIndices;
        physicalOwner.functionName = proxyCallee ? '__forward' : (rawFunctionName ?? nested.functionName);
        physicalOwner.functionArgs = proxyCallee && selectedFn.selector
          ? [selectProxyForwardInput(selectedFn.selector)] : childArgs;
        physicalOwner.callMode = nested.callMode;
        physicalOwner.internalArgs = lateInternalArgs;
        physicalOwner.relativeOutputInternalArgs = [...lateRelativeOutputInternalArgs];
        physicalOwner.blockInputs = lateBlockInputs;
        physicalOwner.blockLayout = lateLayout;
        physicalOwner.plannedEntryInserts = latePlannedEntryInserts;
        physicalOwner.batchPredecessorOutputs = lateBatchPredecessorOutputs;
        physicalOwner.batchEntryLockingBytecodes = lateBatchEntryLockingBytecodes;
        physicalOwner.callerIdentity = parentCallerIdentity;
        physicalOwner.returnEventInBlock = lateLayout?.slots
          .some((slot) => slot.kind === 'returnEvent');
        // Hidden sender identity is derived from the physical edge's parent. Once a later writer owns the
        // carrier, retaining the provisional edge would make C observe A as msg.sender in A -> B -> C.
        allGroupEcSlots[physicalOwnerIndex] = nested;
        allGroupParentIndices[physicalOwnerIndex] = parentGroupIndex;
      }
      let precomputedReturnCommitment: Uint8Array | undefined;
      if (nested.hasReturnValues && selectedFn.writesState !== true && selectedFn.outputs?.length === 1) {
        const evaluateReturn = (): Promise<FunctionArgument | undefined> => proxyCallee
          ? proxyCallee.forward(nested.functionName, childArgs).staticCall() as Promise<FunctionArgument>
          : callee._deriveReturnValue(nested.functionName, childArgs, undefined, undefined, undefined,
            publicSelfAddress, host.categoryId) as Promise<FunctionArgument>;
        const value = nested.callsiteId === undefined
          ? await evaluateReturn()
          : await memoizeGraphPlanningProducerResult(
            graphPlanningResults,
            nested.callsiteId,
            childArgs,
            undefined,
            false,
            evaluateReturn,
          );
        if (value === undefined) {
          throw new Error(`Could not precompute return for graph callsite ${nested.callsiteId}.`);
        }
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_RETURN === '1') {
          // A caller that compares a call's result inside `require` depends on this value exactly: the covenant
          // reads the return event commitment, so a wrong or zero precompute silently fails the caller's check.
          console.error('nested-return-precompute', {
            callee: selectedContract.inner.artifact.contractName,
            functionName: nested.functionName,
            callsiteId: nested.callsiteId,
            value: typeof value === 'object' && value !== null
              ? `bytes:${binToHex(value as Uint8Array).slice(0, 24)}` : String(value),
          });
        }
        const returnType = selectedFn.outputs[0].type;
        const returnArtifact = proxyCallee
          ? proxyCallee.implementation.inner.artifact : selectedContract.inner.artifact;
        precomputedReturnCommitment = encodeExternalReturnValue(
          value as StateValue,
          returnType,
          returnArtifact.structs ?? returnArtifact.stateLayout?.structs,
          resolveExternalResultEncoding(
            selectedFn.resultEncoding,
            returnArtifact,
            selectedFn.outputs.map((output) => output.type),
            `function '${selectedFn.name}' result`,
          ) === 'evm-abi-v1',
          returnArtifact.enums,
        );
      }
      const childGroupIndex = externalCallUtxoGroups.length;
      externalCallUtxoGroups.push({
        categoryId: callee.categoryId,
        stateLayout: callee.inner.stateLayout!,
        masterUtxo: childState.masterUtxo,
        dataNftUtxos,
        requiredDataNftIndices,
        functionName: proxyCallee ? '__forward' : (rawFunctionName ?? nested.functionName),
        functionArgs: proxyCallee && selectedFn.selector
          ? [selectProxyForwardInput(selectedFn.selector)] : childArgs,
        externalContract: callee,
        callerIdentity: parentCallerIdentity,
        logicalFunctionName: rawFunctionName ?? nested.functionName,
        ...(Object.keys(lateInternalArgs).length > 0 && { internalArgs: lateInternalArgs }),
        ...(lateRelativeOutputInternalArgs.size > 0 && {
          relativeOutputInternalArgs: [...lateRelativeOutputInternalArgs],
        }),
        ...(lateBlockInputs && { blockInputs: lateBlockInputs, blockLayout: lateLayout }),
        ...(latePlannedEntryInserts.length > 0 && {
          plannedEntryInserts: latePlannedEntryInserts,
        }),
        ...(lateBatchPredecessorOutputs.length > 0 && {
          batchPredecessorOutputs: lateBatchPredecessorOutputs,
        }),
        ...(lateBatchEntryLockingBytecodes.size > 0 && {
          batchEntryLockingBytecodes: lateBatchEntryLockingBytecodes,
        }),
        ...(nested.callMode && { callMode: nested.callMode }),
        ...(existingPhysicalIndex >= 0 && {
          sharedGroupIndex: externalCallUtxoGroups[existingPhysicalIndex].sharedGroupIndex
            ?? existingPhysicalIndex,
          blockInputs: [] as UnlockableUtxo[],
        }),
        ...(precomputedReturnCommitment && { precomputedReturnCommitment }),
      });
      if (preparedAtomicNodes) {
        if (parentAtomicNode !== undefined) {
          const atomicNodeIndex = preparedAtomicNodes.length;
          preparedAtomicNodes.push({
            contract: callee,
            functionName: rawFunctionName ?? nested.functionName,
            ...(producerSelector !== undefined && { selector: producerSelector }),
            args: graphChildArgs,
            ...(resolvedTargetLockingBytecode && {
              targetLockingBytecode: binToHex(resolvedTargetLockingBytecode),
            }),
            ...(proxyCallee && {
              executionArtifact: proxyCallee.implementation.inner.artifact,
              executor: proxyCallee.implementation,
            }),
            parent: parentAtomicNode,
            ...(nested.callsiteId !== undefined && { callsiteId: nested.callsiteId }),
            ...(nested.sourceEffectOrdinal !== undefined && {
              sourceEffectOrdinal: nested.sourceEffectOrdinal,
            }),
            ...(nested.callsiteId !== undefined && {
              sourceCallsiteId: nested.callsiteId,
              ...((nested.occurrence ?? 'once') !== 'loop' && { occurrenceIndex: 0 }),
            }),
            producerPath: preparedChildProducerPath(parentAtomicNode, {
              sourceCallsiteId: nested.callsiteId,
              ...((nested.occurrence ?? 'once') !== 'loop' && { occurrenceIndex: 0 }),
              sourceEffectOrdinal: nested.sourceEffectOrdinal,
            }),
            ...(resolveGraphChildArgs && { resolveArgsFromResults: resolveGraphChildArgs }),
            active: true,
          });
          if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
            ?.SOLIDC_DEBUG_ATOMIC_PUSH === '1') {
            const pushedIndex = preparedAtomicNodes.length - 1;
            console.error('atomic-node-push', JSON.stringify({
              site: 'LATE', nodeIndex: pushedIndex,
              functionName: nested.functionName, callsiteId: nested.callsiteId,
              parent: parentAtomicNode,
              hasChildSources: graphChildSources !== undefined,
              hasResolver: preparedAtomicNodes[pushedIndex]!.resolveArgsFromResults !== undefined,
            }));
          }
          preparedAtomicNodeByExternalGroup.set(childGroupIndex, atomicNodeIndex);
        }
      }
      allGroupEcSlots = [...allGroupEcSlots, nested];
      allGroupParentIndices = [...allGroupParentIndices, parentGroupIndex];
      lateTransitiveGroupIndices.add(childGroupIndex);
    }
  }

  return { allGroupEcSlots, allGroupParentIndices, lateTransitiveGroupIndices };
}
