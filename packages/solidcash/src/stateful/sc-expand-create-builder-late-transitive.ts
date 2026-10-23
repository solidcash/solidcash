/**
 * phase-boundary extract: SC _createBuilder extract — late-transitive compose layer
 * (expand A→B→C callees discovered after nested compose).
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX,
  type AbiFunction,
  type ArgSource,
  type ExternalCallAbi,
  type ExternalCallExpression,
  type StateValue,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import { projectMessageBusHandlerArguments } from '../message-bus/message-bus.js';
import { MessageBusDiagnosticError } from '../message-bus/diagnostics.js';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import { addressToLockScript } from '../utils.js';
import { resolveOrdinarySelfIdentity } from './ordinary-self-identity.js';
import {
  createDataNftUnlocker,
  createEntryNftUnlocker,
  createSatoshiContainerUnlocker,
  getEntryNftAddress,
  getSatoshiContainerAddress,
} from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  assertAcyclicExternalCallPath,
  snapshotExternalCallFrontier,
  visitExpandingExternalCallGroups,
  wouldCreateExternalCallParentCycle,
} from './external-call-graph-frontier.js';
import { externalCallIterationIndices } from './external-call-iteration-domain.js';
import { encodeExternalReturnValue } from './external-return-encoding.js';
import { externalReturnsForCallsites } from './external-returns-for-callsites.js';
import {
  createGraphPlanningProducerResultContext,
  memoizeGraphPlanningProducerResult,
} from './graph-planning-producer-result.js';
import {
  connectedContractMatchesExactAddress,
  exactAddressLockingBytecodeHex,
  findDeploymentByAddressValue,
  findDeploymentByName,
  registeredAddressValueLockingBytecode,
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
import { hydrateExternalPredicateState } from './sc-hydrate-external-predicate-state.js';
import type { OnChainState } from './StateReader.js';
import {
  type ValueChunkProducerPathDisposition,
} from './ValueChunkProducerIdentity.js';
const DUMMY_FUNDER_LOCKING_BYTECODE = hexToBin(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX);
const DUMMY_FUNDER_UNLOCKING_BYTECODE = new Uint8Array([0x01, 0x51]);
// The deployed graph envelope supports root depth zero through descendant depth seven.
const MAX_LATE_TRANSITIVE_DEPTH = 7;

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
 * Close the concrete callee graph after nested compose. Keep logical invocation frames separate from
 * mutable physical carriers: a later writer can take ownership of an earlier call's master input.
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
    externalCallUtxoGroups, preparedAtomicNodes,
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
  // Graph discovery follows logical invocations, while the physical carrier arrays below may be
  // retargeted to a later writer. Keep ancestry and callsites aligned with the immutable frames.
  const {
    groups: expansionGroups, parents: expansionParents, callsites: expansionCallsites,
  } = snapshotExternalCallFrontier(externalCallUtxoGroups, allGroupParentIndices, allGroupEcSlots);
  const expansionDepths = expansionGroups.map((_, groupIndex) => {
    const atomicIndex = preparedAtomicNodeByExternalGroup.get(groupIndex);
    const seen = new Set<number>();
    let index: number | null | undefined = atomicIndex ?? groupIndex;
    let depth = atomicIndex === undefined ? 1 : 0;
    while (index !== undefined && index !== null && index >= 0) {
      if (seen.has(index)) throw new MessageBusDiagnosticError(
        'L3_RECURSIVE_CLOSURE', 'late call preparation contains a cyclic parent chain', {},
      );
      seen.add(index);
      index = atomicIndex === undefined
        ? expansionParents[index] : preparedAtomicNodes?.[index]?.parent;
      if (index !== undefined && index !== null && index >= 0) depth += 1;
    }
    return depth;
  });
  await visitExpandingExternalCallGroups(expansionGroups, async (parent, parentGroupIndex) => {
    const parentContract = parent.externalContract as any;
    const logicalParentContract = (parent.logicalContract ?? parentContract) as any;
    const logicalParentArtifact = parent.logicalArtifact ?? logicalParentContract.inner.artifact;
    // This layer expands an outgoing CALL made by `parent`. A delegate executor authenticates the code and
    // physical resources which produced that call, but Solidity-visible `address(this)` and the callee's
    // `msg.sender` are the authenticated state owner. Keep that owner as one indivisible pair throughout
    // argument resolution and route witness planning.
    const logicalParentFunctionName = parent.logicalFunctionName ?? parent.functionName;
    const logicalParentArgs = parent.logicalFunctionArgs ?? parent.functionArgs;
    const selectedSelfAbi = !parent.compilerRoute && logicalParentArtifact === logicalParentContract.inner.artifact
      ? logicalParentContract._resolveCallAbi?.(logicalParentFunctionName, logicalParentArgs) : undefined;
    const ordinarySelfIdentity = await resolveOrdinarySelfIdentity(logicalParentContract, selectedSelfAbi);
    const parentCallerIdentity = Object.freeze({
      categoryId: parentContract.categoryId,
      lockingBytecode: ordinarySelfIdentity ? binToHex(ordinarySelfIdentity.unlocker.generateLockingBytecode())
        : logicalParentArtifact.messageBus?.route.inputs.some(
          (input: { name: string }) => input.name === '__internal__graphSelfIdentityInput',
        ) ? binToHex(addressToLockScript(parentContract.target)) : parentContract.inner.lockingBytecode,
    });
    const parentOutgoingSelfAddress = hexToBin(parentCallerIdentity.lockingBytecode);
    // Expressions inside this invocation observe its incoming caller, not its own outgoing identity
    // and not the transaction signer.
    const parentIncomingCallerAddress = parent.callerIdentity
      ? hexToBin(parent.callerIdentity.lockingBytecode) : undefined;
    const parentAtomicNode = preparedAtomicNodeByExternalGroup.get(parentGroupIndex);
    const graphParentArgsRaw = parentAtomicNode === undefined
      ? logicalParentArgs : preparedAtomicNodes?.[parentAtomicNode]?.args ?? logicalParentArgs;
    const parentFn = (logicalParentArtifact.abi as readonly AbiFunction[])
      .find((candidate) => candidate.name === logicalParentFunctionName);
    if (!parentFn?.externalCalls?.length) return;
    const graphParentArgs = projectMessageBusHandlerArguments(
      logicalParentArtifact, parentFn.name, parentFn.selector, graphParentArgsRaw,
    );
    const graphPlanningResults = createGraphPlanningProducerResultContext();
    const parentState = await logicalParentContract.getState() as Record<string, StateValue>;
    // Collection entries are not part of scalar getState(). Resolve compiler-described reads from the
    // logical invocation's authenticated collection before choosing a late edge or preparing its arguments.
    const hydrateState = async (
      expressions: readonly (ExternalCallExpression | undefined)[],
      iterationIndex = 0,
    ): Promise<void> => {
      const hydrated = await hydrateExternalPredicateState({
        evaluateExternalExpression: (
          expression, args, artifact, state, inputs, returns, occurrenceIndex, priorWrites, self,
          bindings, deltas, strict,
        ) => logicalParentContract._evaluateExternalExpression(
          expression, args, artifact, state, inputs, returns, occurrenceIndex, priorWrites, self,
          bindings, deltas, strict, parentIncomingCallerAddress,
        ),
        getEntries: (...args: any[]) => logicalParentContract.getEntries(...args),
      }, expressions, logicalParentArgs, logicalParentArtifact, parentState, parentFn.inputs,
      parentOutgoingSelfAddress, [iterationIndex]);
      Object.assign(parentState, hydrated);
    };
    const expressionReturns = (
      sources: readonly ArgSource[] | undefined,
      args: FunctionArgument[],
      allowProvisional: boolean,
      iterationIndex = 0,
      conditionCallsite?: ExternalCallAbi,
    ): Promise<Map<string, FunctionArgument> | undefined> => sources?.some((source) => source.kind === 'expression')
      ? logicalParentContract._resolveExternalExpressionReturns(
        sources, args, logicalParentContract, parentState, parentFn.inputs,
        parentOutgoingSelfAddress, parentFn.externalCalls, allowProvisional, graphPlanningResults,
        conditionCallsite && {
          callsiteId: conditionCallsite.callsiteId, resultConsumers: parentFn.resultConsumers, lane: 'condition',
        }, iterationIndex, parentIncomingCallerAddress,
      ) : Promise.resolve(undefined);
    const frames: Array<{ nested: ExternalCallAbi; iterationIndex: number; occurrenceIndex: number }> = [];
    for (const nested of parentFn.externalCalls) {
      let alreadyPublished = false;
      for (let index = 0; index < expansionParents.length; index++) {
        if (expansionParents[index] === parentGroupIndex
          && (expansionCallsites[index] as ExternalCallAbi | undefined)?.callsiteId === nested.callsiteId) {
          alreadyPublished = true;
          break;
        }
      }
      if (alreadyPublished) continue;
      let iterationIndices = [0];
      if (nested.occurrence === 'loop') {
        const domain = nested.iterationDomain;
        if (!domain) throw new Error(`Late external callsite ${nested.callsiteId} has no exact iteration domain`);
        await hydrateState([domain.initialValue, domain.stepValue, domain.continueCondition]);
        const domainReturns = await expressionReturns(
          [domain.initialValue, domain.stepValue, domain.continueCondition]
            .map((expression) => ({ kind: 'expression', expression })), logicalParentArgs, false,
        );
        iterationIndices = externalCallIterationIndices(domain, (expression, bindings) =>
          logicalParentContract._evaluateExternalExpression(
            expression, logicalParentArgs, logicalParentArtifact, parentState, parentFn.inputs,
            domainReturns, 0, false, parentOutgoingSelfAddress, bindings,
            undefined, false, parentIncomingCallerAddress,
          ));
      }
      let occurrenceIndex = 0;
      for (const iterationIndex of iterationIndices) {
        if (nested.condition) {
          await hydrateState([nested.condition], iterationIndex);
          const conditionReturns = await expressionReturns(
            [{ kind: 'expression', expression: nested.condition }], logicalParentArgs, false,
            iterationIndex, nested,
          );
          const active = logicalParentContract._evaluateExternalExpression(
            nested.condition, logicalParentArgs, logicalParentArtifact, parentState, parentFn.inputs,
            conditionReturns, iterationIndex, false, parentOutgoingSelfAddress,
            undefined, undefined, false, parentIncomingCallerAddress,
          );
          if (typeof active !== 'boolean') throw new Error(
            `Could not resolve runtime predicate for late external callsite ${nested.callsiteId}`,
          );
          if (!active) continue;
        }
        // Legacy compact return carriers are addressed by source iteration. Dense reached rows can reuse
        // that coordinate, but filtering an earlier iteration separates it from the graph occurrence.
        // Do not publish a compact result at a coordinate the generated caller will not read.
        if (nested.hasReturnValues && iterationIndex !== occurrenceIndex) throw new Error(
          `Late external callsite ${nested.callsiteId} return metadata has no per-occurrence source identity`,
        );
        frames.push({ nested, iterationIndex, occurrenceIndex });
        occurrenceIndex += 1;
      }
    }
    for (const { nested, iterationIndex, occurrenceIndex } of frames) {
      await hydrateState([
        ...(nested.addressSource ? [nested.addressSource] : []), ...(nested.argSources ?? []),
      ].map((source) => ({ kind: 'source', source })), iterationIndex);
      const addressReturns = await expressionReturns(
        nested.addressSource ? [nested.addressSource] : undefined, logicalParentArgs, preparedAtomicNodes !== undefined,
        iterationIndex,
      );
      const addressParamIndex = nested.addressParam === undefined ? -1
        : parentFn.inputs.filter((input) => !input.name.startsWith('__internal__'))
          .findIndex((input) => input.name === nested.addressParam);
      const resolvedAddressTarget = nested.addressSource
        ? logicalParentContract._resolveExternalArgs(
          [nested.addressSource], logicalParentArgs, logicalParentArtifact, parentState,
          parentFn.inputs, addressReturns, iterationIndex, false, parentOutgoingSelfAddress,
          parentIncomingCallerAddress,
        )?.[0]
        : nested.addressStateVar !== undefined
          ? parentState[nested.addressStateVar] as FunctionArgument | undefined
          : nested.addressLiteral !== undefined
            ? nested.addressLiteral
            : addressParamIndex >= 0
              ? logicalParentArgs[addressParamIndex]
              : undefined;
      const hasPublishedTarget = nested.addressSource !== undefined
        || nested.addressStateVar !== undefined || nested.addressLiteral !== undefined
        || nested.addressParam !== undefined;
      const typedAddressTarget = typeof resolvedAddressTarget === 'string'
        || resolvedAddressTarget instanceof Uint8Array ? resolvedAddressTarget : undefined;
      const exactTargetLockHex = typedAddressTarget === undefined ? undefined
        : exactAddressLockingBytecodeHex(typedAddressTarget);
      const deployment = typedAddressTarget === undefined ? undefined
        : findDeploymentByAddressValue(host.inner.provider, typedAddressTarget);
      const resolvedTargetLockingBytecode = typedAddressTarget === undefined ? undefined
        : registeredAddressValueLockingBytecode(host.inner.provider, typedAddressTarget)
          ?? (exactTargetLockHex === undefined ? undefined : hexToBin(exactTargetLockHex));
      const connectedCandidates = [
        logicalParentContract._externalRegistry.get(nested.interfaceName),
        parentContract._externalRegistry.get(nested.interfaceName),
        host.externalRegistry.get(nested.interfaceName),
        findDeploymentByName(host.inner.provider, nested.interfaceName)?.contract,
        /^I[A-Z]/.test(nested.interfaceName)
          ? findDeploymentByName(host.inner.provider, nested.interfaceName.slice(1))?.contract : undefined,
      ];
      let registered = deployment?.contract ?? connectedCandidates.find((candidate) => candidate !== undefined
        && (!hasPublishedTarget || (typedAddressTarget !== undefined
          && connectedContractMatchesExactAddress(candidate, typedAddressTarget))));
      // A lowered Address/SafeERC20 edge deliberately has no source interface name. Resolve it from the
      // authenticated computed address first, then from an already co-spent deployment advertising the
      // compiler-decoded selector. Skipping this edge leaves the parent's extcall/return witnesses at -1;
      // guessing by `__raw__` in the registry can instead redirect the call to an unrelated deployment.
      if (!registered && nested.interfaceName === '__raw__') {
        registered = externalCallUtxoGroups
          .map((candidate) => candidate.externalContract as any)
          .find((candidate) => {
            if (hasPublishedTarget && (typedAddressTarget === undefined
              || !connectedContractMatchesExactAddress(candidate, typedAddressTarget))) return false;
            return (candidate.inner.artifact.abi as readonly AbiFunction[]).some((fn) => (
              (nested.rawFunctionName !== undefined && fn.name === nested.rawFunctionName)
              || (nested.rawSelector !== undefined && fn.selector === nested.rawSelector)
            ));
          });
      }
      if (!registered && typedAddressTarget !== undefined && hasPublishedTarget) {
        throw new Error(`Late external callsite ${nested.callsiteId ?? '?'} published target `
          + `${exactTargetLockHex ?? String(typedAddressTarget)} `
          + `does not match a connected ${nested.interfaceName} callee.`);
      }
      if (!registered) continue;
      const registeredCallee = registered as unknown as any | {
        proxy: any;
        implementation: any;
        forward: (name: string, args: FunctionArgument[]) => any;
      };
      const proxyCallee = 'implementation' in registeredCallee ? registeredCallee : undefined;
      const callee = (proxyCallee?.proxy ?? registeredCallee) as any;
      const graphChildSources = nested.rawArgSources ?? nested.argSources;
      if (preparedAtomicNodes && parentFn.resultConsumers) {
        // Validate the compiler's argument lanes before speculative probing; authenticated result refreshes
        // below use the same source/consumer identity, never a function-name match.
        externalReturnsForCallsites(graphChildSources, new Map(), parentFn.externalCalls,
          nested.callsiteId === undefined ? undefined : {
            callsiteId: nested.callsiteId, resultConsumers: parentFn.resultConsumers,
          });
      }
      const childReturns = await expressionReturns(
        graphChildSources, logicalParentArgs, preparedAtomicNodes !== undefined, iterationIndex,
      );
      const childArgs = logicalParentContract._resolveExternalArgs(
        graphChildSources,
        logicalParentArgs, logicalParentArtifact, parentState,
        parentFn.inputs, childReturns, iterationIndex, false, parentOutgoingSelfAddress,
        parentIncomingCallerAddress,
      );
      if (childArgs === undefined) continue;
      const graphChildReturns = preparedAtomicNodes
        ? await expressionReturns(graphChildSources, [...graphParentArgs], true, iterationIndex) : childReturns;
      const graphChildArgs = logicalParentContract._resolveExternalArgs(
        graphChildSources,
        [...graphParentArgs], logicalParentArtifact, parentState,
        parentFn.inputs, graphChildReturns, iterationIndex, false, parentOutgoingSelfAddress,
        parentIncomingCallerAddress,
      ) ?? childArgs;
      const resolveGraphChildArgs = preparedAtomicNodes && graphChildSources
        ? (results: ReadonlyMap<number, FunctionArgument>, parentArgs?: readonly FunctionArgument[]):
        FunctionArgument[] | undefined => {
          const externalReturns = externalReturnsForCallsites(
            graphChildSources, results, parentFn.externalCalls ?? [],
            nested.callsiteId === undefined ? undefined : {
              callsiteId: nested.callsiteId,
              resultConsumers: parentFn.resultConsumers,
            },
          );
          if (externalReturns.size === 0 && parentArgs === undefined) return undefined;
          return logicalParentContract._resolveExternalArgs(
            graphChildSources, [...(parentArgs ?? graphParentArgs)], logicalParentArtifact, parentState,
            parentFn.inputs, externalReturns, iterationIndex, false, parentOutgoingSelfAddress,
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
      // A raw call into a function that returns nothing answers with no record, so no return carrier is planned.
      const groupSlot = nested.interfaceName === '__raw__' && nested.hasReturnValues
        && (selectedFn.outputs?.length ?? 0) === 0 ? { ...nested, hasReturnValues: false } : nested;
      // Recursion is a property of the discovered logical call path. A shared physical NFT carrier can be
      // retargeted from release to setClaimed and then to sendEscrowShare while a claim loop is expanded;
      // reading that mutable owner here would mistake the second sibling share call for recursion.
      assertAcyclicExternalCallPath(
        expansionGroups, expansionParents, parentGroupIndex,
        callee.categoryId, selectedFn.name,
      );
      const childDepth = expansionDepths[parentGroupIndex] + 1;
      if (childDepth > MAX_LATE_TRANSITIVE_DEPTH) throw new MessageBusDiagnosticError(
        'L3_GRAPH_DEPTH_LIMIT',
        `late call preparation would append depth ${childDepth}, exceeding the deployed `
          + `${MAX_LATE_TRANSITIVE_DEPTH}-depth bound`,
        { measured: childDepth, limit: MAX_LATE_TRANSITIVE_DEPTH, callsiteId: nested.callsiteId },
      );
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
      if (!childState.masterUtxo) {
        // Every frame here is a reached occurrence: the loop above already dropped the ones whose guard is false.
        // A reached occurrence has to co-spend its callee's master, so skipping this quietly composed a
        // transaction with no callee input that the generated route then refuses at spend time. The ordinary
        // transitive discovery path already refuses this condition; name the callsite and occurrence here too.
        throw new Error(
          `Late external callsite ${nested.callsiteId ?? '?'} occurrence ${occurrenceIndex} has no master UTXO `
          + `for ${nested.interfaceName} (category ${callee.categoryId}).`,
        );
      }
      const requiredDataNftIndices = [...new Set(selectedFn.requiredNftIndices
        ?? (selectedFn.blockLayout?.slots ?? []).filter((slot) => slot.kind === 'dataNft')
          .map((slot) => slot.nftIndex ?? 0))];
      const dataNftUtxos = requiredDataNftIndices.map((nftIndex) => {
        const utxo = childState.dataNftUtxos[nftIndex];
        if (!utxo) throw new Error(`Late external data NFT at index ${nftIndex} is missing for the selected handler.`);
        return {
          ...utxo,
          unlocker: createDataNftUnlocker(callee.inner, 0, callee.categoryId),
        };
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
            if (slot.kind === 'satoshiContainer') {
              const address = getSatoshiContainerAddress(callee.inner, callee.categoryId);
              const container = (await nestedAddressUtxos(address)).find((utxo) => !utxo.token);
              // Keep the fixed slot even when no container is present, matching direct nested assembly.
              // A conditional transfer can leave it inactive; active transfers remain covenant-checked.
              lateBlockInputs.push(container ? {
                ...container,
                unlocker: createSatoshiContainerUnlocker(callee.inner, 0, callee.categoryId),
              } : makeLateFunder());
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
              // A proxied callee's entries bind its proxy master's lock, not the implementation's.
              const entryAddress = getEntryNftAddress(callee.inner, callee.categoryId, access.collection);
              const list = SortedList.fromUtxos((await nestedAddressUtxos(entryAddress)).filter((utxo) => (
                utxo.token?.category === callee.categoryId
                  && utxo.token?.nft?.capability === 'mutable'
                  && !!utxo.token.nft.commitment
              )));
              const targetSlot = keyToSlotMulti(encodedKeys, collection);
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
                unlocker: createEntryNftUnlocker(callee.inner, blockOffset, callee.categoryId, access.collection),
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
            if (['event', 'eventChunk', 'returnEvent', 'transfer', 'tcTransfer'].includes(slot.kind)) {
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
              callee.inner, 0, callee.categoryId, batch.collection,
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
        // The replacement ABI, arguments and execution context are one frame. Downstream identity and
        // witness planning must not read the earlier reader's logical arguments with the writer's ABI.
        // expansionGroups retains the old call separately so its unvisited descendants still expand.
        physicalOwner.logicalFunctionName = rawFunctionName ?? nested.functionName;
        physicalOwner.logicalFunctionArgs = childArgs;
        physicalOwner.logicalContract = selectedContract;
        physicalOwner.logicalArtifact = selectedContract.inner.artifact;
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
        allGroupEcSlots[physicalOwnerIndex] = groupSlot;
        // A -> B -> A' is a legitimate callback when A' shares A's physical NFT. The newly appended
        // A' logical group records B as its parent; moving A's earlier carrier under B would instead
        // turn the ancestry into A -> B -> A and make later graph discovery falsely recursive.
        if (!wouldCreateExternalCallParentCycle(
          allGroupParentIndices, physicalOwnerIndex, parentGroupIndex,
        )) {
          allGroupParentIndices[physicalOwnerIndex] = parentGroupIndex;
        }
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
            typedAddressTarget ?? callee.categoryId,
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
        logicalFunctionArgs: childArgs,
        logicalContract: selectedContract,
        logicalArtifact: selectedContract.inner.artifact,
        ...(Object.keys(lateInternalArgs).length > 0 && { internalArgs: lateInternalArgs }),
        ...(lateRelativeOutputInternalArgs.size > 0 && {
          relativeOutputInternalArgs: [...lateRelativeOutputInternalArgs],
        }),
        ...(lateBlockInputs && {
          blockInputs: lateBlockInputs,
          blockLayout: lateLayout,
          // Late-discovered callees own the same compiler-declared return slot as
          // eagerly prepared callees. Keep ownership with the physical block so
          // materialization and both producer/consumer witnesses use that slot.
          returnEventInBlock: lateLayout?.slots.some((slot) => slot.kind === 'returnEvent'),
        }),
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
      expansionGroups.push({ ...externalCallUtxoGroups[childGroupIndex] });
      expansionParents.push(parentGroupIndex);
      expansionCallsites.push(nested);
      expansionDepths.push(childDepth);
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
              occurrenceIndex,
            }),
            producerPath: preparedChildProducerPath(parentAtomicNode, {
              sourceCallsiteId: nested.callsiteId,
              occurrenceIndex,
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
      allGroupEcSlots = [...allGroupEcSlots, groupSlot];
      allGroupParentIndices = [...allGroupParentIndices, parentGroupIndex];
      lateTransitiveGroupIndices.add(childGroupIndex);
    }
  });

  return { allGroupEcSlots, allGroupParentIndices, lateTransitiveGroupIndices };
}
