
/**
 * phase-boundary extract: Compose phase-boundary extract — AtomicMessageBusComposition._build nested `assemble`.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { utf8ToBin } from '@bitauth/libauth/build/lib/format/utf8.js';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX, MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN,
  sha256, buildChunkCommitment, splitValueIntoChunks,
} from '@solidcash/utils';
import type { AbiFunction, ExternalCallExpression } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { ContractUnlocker, Output, UnlockableUtxo, Unlocker, Utxo } from '../interfaces.js';
import { isContractUnlocker } from '../interfaces.js';
import { TransactionBuilder } from '../TransactionBuilder.js';
import { withCompilerRouteMessageEnvelope, withProxyForwardMessageEnvelope } from '../Contract.js';
import { addressToLockScript, calculateDust } from '../utils.js';
import {
  decodeAuthenticatedProducerResultVector, StatefulContract, StatefulFunctionCall,
} from '../stateful/StatefulContract.js';
import { reassertRoutedReadOnlyDynamicChunkTwins } from '../stateful/mutable-output-reassert.js';
import { resolveMaterializedDynamicWriteOutputBase } from '../stateful/stb-reconcile-dynamic-chunk-output-witnesses.js';
import { resolvePhysicalPredOutWitnesses } from './compose-predout-witness.js';
import { shareBlockOracleInput } from './compose-block-oracle.js';
import {
  chunksFromValue, persistValueChunkLock, valueChunkIndexFromCommitment, valueChunkWriteResourceIdentity,
  type ValueChunkWriteDescriptor,
} from '../stateful/StatefulTransactionBuilder.js';
import { isValidComputedValueChunkCommitmentEncoding } from '../stateful/computed-value-chunk-pin.js';
import { artifactUsesSolidityAbi } from '../stateful/solidityAbi.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { isScidIdentityCommitment, type ResolvedLogicalIdentity } from '../stateful/logical-identity.js';
import {
  createDestroyDataNftUnlocker, createMessageBusVerifierUnlocker,
  getDynamicChunkAddress, getMessageBusEnvelopeTransport,
  getMessageBusVerifierLockingBytecodeForArtifact,
} from '../stateful/covenant-helpers.js';
import { encodeAtomicMessageBusCallManifest, encodeAtomicMessageEnvelope, type AtomicRow } from './atomic.js';
import { peekBuilderBuildId } from '../stateful/StatefulContract.js';
import type { ExecutionContextLifecycle } from './execution-context.js';
import {
  finalizeAtomicInvocationGraph, graphInvocationCallerIdentity, type AtomicSidecarSlotEffect,
} from './graph.js';
import {
  materializeTransportedContinuations,
  selectTransportedContinuationResourceSlots,
  transportedContinuationSpanClaims,
  type MaterializedContinuationClaim,
} from './materialize-transported-continuations.js';
import { deriveCompiledGraphPlan } from './worklist.js';
import {
  applyParticipantAbsoluteWitnesses,
  resolveComposeTransactionLayoutAuthority,
  terminalConditionalReturnBase,
  trailingCapacityExcludingFixedSuffix,
  type ComposeParticipantLayoutClaims,
  type SymbolicParticipantLayout,
} from './layout-resolver.js';
import { authorizeComposeParticipantLayout } from './compose-kernel-authority.js';
import {
  findMessageBusHandlerForInvocation,
} from './graph-handler-join.js';
import { layoutInvariantError } from './diagnostics.js';
import { layoutWitnessIsActiveCoordinate } from './layout-sentinels.js';
import { isPendingBatchPredecessor } from './pending-batch-predecessor.js';
import { retainTerminalValueChunkProductions } from './terminal-value-chunk-productions.js';
import { allowsDeferredComputeVmDiscovery } from './materialization-mode.js';
import {
  evaluateArgs4RecoveryArgument,
  evaluateComputeRecipeExpression,
  evaluateSignature65RecoveryArgument,
  PendingComputeProducerResult,
  UnusableComputeSignature,
} from './compute-recipe-evaluator.js';
import { deriveDirectCollectionLengthResult } from './compute-recipe-producer-state.js';
import {
  probeEarlySourceRevertBeforeDeferredCompute,
  unresolvedComputeOffsetsForEarlyRevert,
} from './deferred-compute-early-revert.js';
import {
  finalizeMonotonePass,
  MonotoneCell,
  recordMonotonePass,
} from './monotone-lattice.js';
import { recordActiveConstraintPass } from '../stateful/value-chunk-persist.js';
import { bindBuilderConstraintFixpoint, type ConstraintFixpointSession } from './constraint-fixpoint-session.js';
import {
  buildTransportedContinuationResourceClaim,
  canonicalValueChunkProducerIdentity,
  canonicalValueChunkProducerResourceClaim,
  canonicalValueChunkProducerResourceIdentity, canonicalValueChunkStateOwner,
  orderTransportedContinuationResourceClaims,
  type TransportedContinuationResourceClaim,
} from '../stateful/ValueChunkProducerIdentity.js';
import {
  evaluateChildDeploymentRecipe,
  materializeFixedBchTransfer,
  minimumActualSizeForComputedValueChunkClaims,
  fixedVmNumber,
} from './compose-recipes.js';
import type { ComputedValueChunkSpanClaim } from './compose-recipes.js';
import { loadFixedEffectEntries } from './fixed-effect-entries.js';
import {
  type ComposeAtomicMessageBusOptions,
  type PreparedAtomicMessageBusCall,
  type CallDescriptor,
} from './compose-prepared-invocation.js';
import {
  concat,
  uint16,
  graphRouteContext,
  type DeferredComputeController,
  type DeferredComputeBuilder,
} from './compose-participant-helpers.js';

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;
type PlanParticipant = CompiledGraphPlan['participants'][number];

export type AssemblePredOutClaimsByParticipant = ReadonlyMap<number, ReadonlyArray<{
  witnessName: string;
  physicalLocalOffset: number;
  concreteLocalSlot?: number;
}>>;

export interface AssembleAtomicCompositionContext {
  executionContexts: ExecutionContextLifecycle;
  constraintFixpoint: ConstraintFixpointSession;
  options: Pick<ComposeAtomicMessageBusOptions, 'changeAddress' | 'feeRate' | 'preparedCalls'>;
  descriptors: readonly CallDescriptor[];
  feeFunder: UnlockableUtxo;
  rootCaller: Uint8Array;
  provider: NetworkProvider;
  upgradeStateSuffixes: Map<string, Uint8Array>;
  stateOf: (contract: StatefulContract) => Promise<Record<string, unknown>>;
  plan: CompiledGraphPlan;
  splitByParticipant: Map<number, {
    invocationIndex: number; funders: readonly UnlockableUtxo[]; createdValues: readonly bigint[];
  }>;
  mergeByParticipant: Map<number, {
    invocationIndex: number; consumedMasters: readonly Utxo[];
  }>;
  selfdestructByParticipant: Map<number, {
    invocationIndex: number; recipient: string | Uint8Array;
  }>;
  byLockingBytecode: Map<string, StatefulContract>;
  descriptorByLockingBytecode: Map<string, CallDescriptor>;
  categories: readonly string[];
  logicalIdentities: Map<number, ResolvedLogicalIdentity>;
  runtimeEventSlots: Map<number, Array<{
    participant: number; offset: number; runtimeRow: number; eventSignature: string; chunked?: true;
  }>>;
  sidecarSlots: readonly {
    participant: number; offset: number; kind: AtomicSidecarSlotEffect['kind'];
  }[];
  materializedDeployments: ReadonlyArray<
  | {
    participant: number;
    active: false;
    outputs: readonly Output[];
  }
  | {
    participant: number;
    active: true;
    slotOffset: number;
    genesis: UnlockableUtxo;
    outputs: readonly Output[];
    valueTransfer?: {
      outputSlot: number;
      lockingBytecode: Uint8Array;
      amount: bigint;
    };
  }
  >;
  participantReturnBlob: (
    participant: number, results: Readonly<Record<number, string>>,
  ) => Uint8Array | undefined;
  participantReturnCommitment: (blob: Uint8Array | undefined) => Uint8Array | undefined;
  deferredComputeCache: Map<number, {
    graphKey: string;
    resources: ReadonlyMap<number, { input: UnlockableUtxo; output: Output }>;
  }>;
  /** Exact caller-prepared producer candidates; never schema-shaped provisional results. */
  preparedResults: Readonly<Record<number, string>>;
  rebalanceFeeTail: (builder: TransactionBuilder, subject: string) => void;
  eventLockingBytecodes: (participant: PlanParticipant) => string[];
  /** Written by assemble; read by outer _build after the last assemble call. */
  predOutClaimsSlot: { current?: AssemblePredOutClaimsByParticipant };
}

export interface UnpairedBlockInput {
  satoshis: bigint;
  token?: Output['token'];
  unlocker: { generateLockingBytecode(): Uint8Array };
}

/**
 * SDKCORE-1. An unpaired block slot is alignment padding. Only the balanced dummy funder is recreated
 * at OP_TRUE, which the later trim drops. Any other input is recreated at its own lock, value, and token.
 * Paying that input's full value to OP_TRUE would let anyone sweep it.
 */
export function outputForUnpairedBlockInput(input: UnpairedBlockInput): Output {
  const lock = input.unlocker.generateLockingBytecode();
  if (input.token === undefined && binToHex(lock) === BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX) {
    return { to: Uint8Array.of(0x51), amount: input.satoshis };
  }
  const token = input.token;
  return {
    to: lock,
    amount: input.satoshis,
    ...(token === undefined ? {} : {
      token: {
        ...token,
        ...(token.nft === undefined ? {} : { nft: { ...token.nft } }),
      },
    }),
  };
}

/** Index of an output that already recreates `input`'s SCID identity anchor: same lock and token. */
function recreatedIdentityAnchorIndex(input: UnpairedBlockInput, outputs: readonly Output[]): number | undefined {
  const token = input.token;
  const nft = token?.nft;
  if (token === undefined || nft?.capability !== 'none' || !isScidIdentityCommitment(nft.commitment)) {
    return undefined;
  }
  const lock = binToHex(input.unlocker.generateLockingBytecode());
  const index = outputs.findIndex((output) => output.token?.nft?.capability === 'none'
    && output.token.category.toLowerCase() === token.category.toLowerCase()
    && output.token.nft.commitment.toLowerCase() === nft.commitment.toLowerCase()
    && output.token.amount === token.amount
    && binToHex(typeof output.to === 'string' ? addressToLockScript(output.to) : output.to) === lock);
  return index < 0 ? undefined : index;
}

/**
 * Pad the next unpaired block input. An SCID identity anchor the local build already recreated at an earlier slot
 * is not minted again: it moves to its own slot and that slot takes its input's pad, or, if that input holds a
 * token, it stays and its own slot keeps only the value.
 */
export function padUnpairedBlockInput(local: {
  readonly inputs: readonly UnpairedBlockInput[];
  outputs: Output[];
  addOutput(output: Output): unknown;
}): void {
  const input = local.inputs[local.outputs.length];
  const replica = recreatedIdentityAnchorIndex(input, local.outputs);
  if (replica === undefined) {
    local.addOutput(outputForUnpairedBlockInput(input));
    return;
  }
  const displaced = local.inputs[replica];
  if (displaced.token === undefined) {
    local.outputs[replica] = outputForUnpairedBlockInput(displaced);
    local.addOutput(outputForUnpairedBlockInput(input));
  } else {
    local.addOutput({ to: input.unlocker.generateLockingBytecode(), amount: input.satoshis });
  }
}

/**
 * Lock of one transported value-chunk production. The record master's locking bytecode (a delegate's proxy) is the
 * only authority: a missing or non-35-byte lock does not fall back to the category-only walk.
 */
export function publishedTransportedValueChunkLock(
  production: {
    stateOwner: { categoryId: string };
    value: Uint8Array;
    write: ValueChunkWriteDescriptor | null | undefined;
  },
  masterLockingBytecode: string,
): Uint8Array | undefined {
  const masterLock = hexToBin(masterLockingBytecode);
  if (masterLock.length !== 35) return undefined;
  return persistValueChunkLock(
    production.stateOwner.categoryId, production.value, production.write, masterLock,
  );
}

/**
 * Feed authenticated kind-2 stream-record claims back into the runtime event records the participant builder
 * planned at the same offset under the same lock. The route stops at the first record it cannot match, so
 * without this every pass restarts at the stream's first record and no later check (a return output included)
 * is ever probed. A compact record always takes its claim. A chunked record keeps what its builder learned; an
 * unlearned (empty) one takes the claim, as an isolated builder probe cannot reach a final-transaction stream.
 */
export function feedBackRuntimeEventClaims(
  outputs: Output[],
  runtimeEvents: readonly { offset: number; chunked?: true }[],
  builtEventOffsets: ReadonlyMap<number, number>,
  rows: readonly Pick<AtomicRow, 'kind' | 'owner' | 'mode' | 'targetOffset' | 'subjectHex' | 'effectHex'>[],
  participant: number,
): void {
  const offsets = new Set(runtimeEvents.map((event) => event.offset));
  const chunkedOffsets = new Set(runtimeEvents.filter((event) => event.chunked).map((event) => event.offset));
  for (const row of rows) {
    if (row.kind !== 2 || row.owner !== participant || row.mode !== 1 || !offsets.has(row.targetOffset)) continue;
    const builtOffset = builtEventOffsets.get(row.targetOffset);
    const planned = builtOffset === undefined ? undefined : outputs[builtOffset];
    const plannedLock = planned === undefined ? undefined
      : typeof planned.to === 'string' ? addressToLockScript(planned.to) : planned.to;
    if (builtOffset === undefined || planned?.token?.nft?.capability !== 'none' || plannedLock === undefined
      || binToHex(plannedLock) !== row.subjectHex.toLowerCase()) continue;
    if (chunkedOffsets.has(row.targetOffset) && planned.token.nft.commitment !== '') continue;
    outputs[builtOffset] = {
      ...planned, token: { ...planned.token, nft: { ...planned.token.nft, commitment: row.effectHex } },
    };
  }
}

export async function assembleAtomicComposition(
  ctx: AssembleAtomicCompositionContext,
  graph: ReturnType<typeof finalizeAtomicInvocationGraph>,
  results: Readonly<Record<number, string>>,
): Promise<{
    builder: TransactionBuilder;
    actualSizes: readonly number[];
    incompleteDynamicChunks: readonly {
      participant: number; variable: string; resolved: number; total: number;
    }[];
  }> {
  const {
    options,
    descriptors,
    feeFunder,
    rootCaller,
    provider,
    upgradeStateSuffixes,
    stateOf,
    plan,
    splitByParticipant,
    mergeByParticipant,
    selfdestructByParticipant,
    byLockingBytecode,
    descriptorByLockingBytecode,
    categories,
    logicalIdentities,
    runtimeEventSlots,
    materializedDeployments,
    participantReturnBlob,
    participantReturnCommitment,
    deferredComputeCache,
    preparedResults,
    rebalanceFeeTail,
    eventLockingBytecodes,
    predOutClaimsSlot,
  } = ctx;

  const envelopeTransports = plan.participants
    .filter((participant) => participant.authority !== 'direct')
    .map((participant) => getMessageBusEnvelopeTransport(participant.artifact));
  const envelopeTransport = envelopeTransports[0];
  if (envelopeTransport === undefined || envelopeTransports.some((value) => value !== envelopeTransport)) {
    throw new Error('messageBus: all participants must use the same canonical envelope transport');
  }
  const rootMessageEnvelope = envelopeTransport === 'root-route' || envelopeTransport === 'proxy-forward'
    ? encodeAtomicMessageEnvelope(graph.callManifest) : undefined;
  if (rootMessageEnvelope && graph.layout.participantInputs[0] !== 0) {
    throw new Error('messageBus: V5 root envelope requires participant 0 at input 0');
  }

  // A computed argument may read any authenticated graph value: nested return bytes, an effect output,
  // participant span, or an absolute transaction coordinate. Cache only within the exact finalized graph
  // transcript; participant identity alone would retain witnesses learned from provisional semantic claims.
  const deferredComputeGraphKey = binToHex(sha256(graph.bytes));
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_GRAPH_RESULTS === '1') {
    console.error('atomic-graph-results', graph.callManifest.rows.flatMap((row, index) => row.kind === 0 ? [{
      index,
      function: graph.plan.invocations[index]?.function,
      owner: row.owner,
      consumer: row.consumer,
      resultHex: row.resultHex,
    }] : []));
  }
  // Resource delete rows authorize exact NFT disappearance at participant-owned slots; the generated
  // covenants still reject any unlisted burn through endpoint cardinality and commitment checks.
  const aggregate = new TransactionBuilder({
    provider, allowImplicitNftBurn: true, skipAutomaticCoSpends: true,
  });
  bindBuilderConstraintFixpoint(aggregate, ctx.constraintFixpoint);
  const actualSizes: number[] = [];
  const incompleteDynamicChunks: Array<{
    participant: number; variable: string; resolved: number; total: number;
  }> = [];
  const aggregateOutpoints = new Map<string, { participant: number; localIndex: number }>();
  // Block-oracle lock -> the one aggregate input every reader slices (see compose-block-oracle.ts).
  const keptBlockOracleInputs = new Map<string, number>();
  const registerAggregateInput = (
    input: Pick<Utxo, 'txid' | 'vout'>, participant: number, localIndex: number, role: string,
  ): void => {
    const outpoint = `${input.txid.toLowerCase()}:${input.vout}`;
    const prior = aggregateOutpoints.get(outpoint);
    if (prior) {
      throw new Error(
        `messageBus: duplicate input outpoint ${outpoint} at ${role}; `
          + `already used by participant ${prior.participant} input ${prior.localIndex}`,
      );
    }
    aggregateOutpoints.set(outpoint, { participant, localIndex });
  };
  const deferredBlocks: Array<{
    participant: number;
    inputBase: number;
    executionInput: number;
    local: TransactionBuilder;
    controller: DeferredComputeController;
    offsets: readonly number[];
  }> = [];
  // Defer layout resolution until every participant's claims are known, then resolve the batch once.
  const deferredLayoutClaims: ComposeParticipantLayoutClaims[] = [];
  const deferredLayoutApplies: Array<{
    participant: number;
    inputs: readonly { name: string }[];
    params: unknown[];
    syncEncodedArgsFromParams?: (onlyIndices?: readonly number[]) => void;
    publishedRelocations: Array<{ name: string; from: string; to: string }>;
    resyncedIndices: number[];
  }> = [];
  const pendingDynamicOutputWitnesses: Array<{
    unlocker: ContractUnlocker;
    index: number;
    absolute: bigint;
  }> = [];
  const pendingPredOutWitnesses: Array<{
    unlocker: ContractUnlocker;
    index: number;
    absolute: bigint;
  }> = [];
  const recordPhysicalPredOutWitnesses = (
    routeInputOffset: number,
    inputs: readonly UnlockableUtxo[],
    outputs: readonly Output[],
    categoryId: string,
    physicalOutputBase: number,
  ): void => {
    const input = inputs[routeInputOffset];
    if (!input || !isContractUnlocker(input.unlocker)) return;
    const unlocker = input.unlocker;
    for (const { index, localOutputIndex } of resolvePhysicalPredOutWitnesses({
      routeInputs: unlocker.abiFunction.inputs,
      params: unlocker.params,
      routeInputOffset,
      inputs,
      outputs,
      categoryId,
    })) {
      pendingPredOutWitnesses.push({
        unlocker, index, absolute: BigInt(physicalOutputBase + localOutputIndex),
      });
    }
  };
  const recordPhysicalDynamicOutputWitness = (
    input: UnlockableUtxo | undefined,
    recordOwner: ContractUnlocker['contract'],
    outputs: readonly Output[],
    categoryId: string,
    physicalOutputBase: number,
    trailingBase: number | undefined,
    selectedDynamicWrites?: ReadonlySet<string>,
  ): void => {
    if (!input || !isContractUnlocker(input.unlocker)) return;
    const unlocker = input.unlocker;
    const route = unlocker.abiFunction;
    const witnessIndex = route.inputs.findIndex((parameter) =>
      parameter.name === '__internal__dynamicChunkOutputBase');
    if (witnessIndex < 0) return;
    const routeLayout = unlocker.contract.artifact.stateLayout;
    if (!routeLayout) throw new Error(`messageBus: dynamic-output route ${route.name} has no state layout`);
    const localOutputBase = resolveMaterializedDynamicWriteOutputBase({
      route,
      stateLayout: routeLayout,
      // A chunk lock binds the record master's lock: a delegate's proxy, not the executing implementation.
      contract: recordOwner,
      categoryId,
      outputs,
      // The compiler owns the dynamic writer's trailing band. Restrict provisional commitment
      // locations to that band so a read-only preserved twin cannot become the write base.
      start: trailingBase,
      allowProvisionalChunks: trailingBase !== undefined,
      selectedDynamicWrites,
    });
    pendingDynamicOutputWitnesses.push({
      unlocker,
      index: witnessIndex,
      absolute: BigInt(localOutputBase < 0 ? -1 : physicalOutputBase + localOutputBase),
    });
  };
  let deferredTransactionParticipants: readonly SymbolicParticipantLayout[] | undefined;

  // Resource locks each participant's own build published, tagged by resource family. A stall diagnostic
  // attributes an introspected aggregate coordinate in the TAIL - which lies beyond every participant
  // block - by the lock its owner published, since no block layout can label it.
  const resourceLocksByParticipant = new Map<number, ReadonlyArray<readonly [string, string]>>();
  for (const participant of plan.participants) {
    const contract = byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
    const descriptor = descriptorByLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
    const blockSize = participant.lifecycle?.balancedSpan ?? participant.blockLayout!.blockSize;
    if (participant.authority === 'direct') {
      const invocationIndex = participant.invocations[0];
      const invocation = plan.invocations[invocationIndex];
      const selected = descriptors[invocationIndex];
      const abiFunction = participant.artifact.abi.find((candidate) =>
        candidate.selector?.toLowerCase() === invocation.selectorHex.toLowerCase());
      if (!selected || !abiFunction || selected.args.length !== 1
          || graph.callManifest.participants[participant.participant].authority !== 'direct') {
        throw new Error(`messageBus: direct participant ${participant.participant} has no V5 ABI frame`);
      }
      const base = graph.layout.participantInputs[participant.participant];
      const localCall = new StatefulFunctionCall(
        () => contract._createBuilder(selected.functionName, [...selected.args], {
          abiFunction, blockBase: base, omitLocalFeeTail: true,
        }),
        contract, selected.functionName, [...selected.args],
        { abiFunction, blockBase: base, omitLocalFeeTail: true },
        invocation.selectorHex,
      );
      const local = await localCall.build();
      if (local.inputs.length !== blockSize || local.outputs.length !== blockSize) {
        throw new Error(
          `messageBus: direct participant ${participant.participant} built ${local.inputs.length}/`
            + `${local.outputs.length} slots, expected fixed V5 block ${blockSize}`,
        );
      }
      const masterUnlocker = local.inputs[0]?.unlocker;
      if (!masterUnlocker || !isContractUnlocker(masterUnlocker)) {
        throw new Error(`messageBus: direct participant ${participant.participant} lacks a contract master input`);
      }
      const hiddenIndices = masterUnlocker.abiFunction.inputs.flatMap((input, index) =>
        input.name === '__internal__callInputIndex' ? [index] : []);
      if (hiddenIndices.length > 1 || (hiddenIndices.length === 1 && !masterUnlocker.syncEncodedArgsFromParams)) {
        throw new Error(`messageBus: direct participant ${participant.participant} has a non-canonical call-index witness`);
      }
      if (hiddenIndices.length === 1) {
        masterUnlocker.params[hiddenIndices[0]] = BigInt(graph.layout.totalSlots);
        masterUnlocker.syncEncodedArgsFromParams!(hiddenIndices);
      }
      actualSizes.push(blockSize);
      recordPhysicalDynamicOutputWitness(
        local.inputs[0], contract.inner, local.outputs, categories[participant.participant],
        aggregate.outputs.length, participant.blockLayout?.trailingBase,
      );
      const directBlock = await shareBlockOracleInput(
        provider, local, aggregate.inputs.length, keptBlockOracleInputs,
      );
      for (let localIndex = 0; localIndex < directBlock.inputs.length; localIndex += 1) {
        registerAggregateInput(
          directBlock.inputs[localIndex], participant.participant, localIndex, 'direct participant block',
        );
      }
      aggregate.addInputs(directBlock.inputs);
      aggregate.addOutputs(directBlock.outputs);
      continue;
    }
    const returnBlob = participantReturnBlob(participant.participant, results);
    const returnCommitment = participantReturnCommitment(returnBlob);
    const routeRows = participant.invocations.map((invocationIndex) => {
      const invocation = descriptors[invocationIndex];
      const plannedInvocation = plan.invocations[invocationIndex];
      const published = findMessageBusHandlerForInvocation(participant.artifact, {
        function: invocation.functionName,
        selectorHex: plannedInvocation.selectorHex,
      });
      const selector = (published?.selector ?? plannedInvocation.selectorHex).toLowerCase();
      // Kernel dispatch joins by selector; the diagnostic function name is not authority.
      const handler = participant.artifact.abi.find((candidate) =>
        candidate.selector?.toLowerCase() === selector)
          ?? (participant.artifact.messageBus?.convention === 'kernel-row-loop'
            ? undefined
            : participant.artifact.abi.find((candidate) => candidate.name === invocation.functionName));
      if (!handler) {
        throw new Error(`messageBus: handler ABI '${invocation.functionName}' is missing`);
      }
      return {
        args: invocation.args,
        handler,
        sourceCallsiteId: plannedInvocation.sourceCallsiteId,
        sourceLogicalIndex: plannedInvocation.sourceLogicalIndex,
        occurrenceIndex: plannedInvocation.occurrenceIndex,
        sourceEffectOrdinal: plannedInvocation.sourceEffectOrdinal,
        producerPath: plannedInvocation.producerPath,
      };
    });
    const valueChunkProductions = new Map<
    string, NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']>[number]
    >();
    for (const invocationIndex of participant.invocations) {
      for (const production of descriptors[invocationIndex].valueChunkProductions ?? []) {
        const claim = canonicalValueChunkProducerResourceClaim(production.claim);
        const resourceIdentity = claim?.resourceIdentity;
        const writeResourceIdentity = canonicalValueChunkProducerResourceIdentity(
          valueChunkWriteResourceIdentity(production.write),
        );
        const producerIdentity = claim && canonicalValueChunkProducerIdentity(claim.producer);
        const stateOwner = canonicalValueChunkStateOwner(production.stateOwner);
        const producerStateOwner = claim && canonicalValueChunkStateOwner(claim.producer.stateOwner);
        if (!resourceIdentity || resourceIdentity !== writeResourceIdentity
            || !producerIdentity || !stateOwner || stateOwner !== producerStateOwner) {
          throw new Error(
            `messageBus: invocation ${invocationIndex} carries an invalid value-chunk production identity`,
          );
        }
        const identity = JSON.stringify([resourceIdentity, producerIdentity]);
        const shape = JSON.stringify([
          production.write.categoryId.toLowerCase(), production.write.collection,
          production.write.collectionSignature, production.write.collectionHash.toLowerCase(),
          production.write.keySlot.toLowerCase(), production.write.entryAccessSlot,
          production.write.routeSlot, production.write.operation, production.write.outputBase,
          production.write.outputCount, stateOwner, binToHex(production.value),
        ]);
        const prior = valueChunkProductions.get(identity);
        if (prior) {
          const priorShape = JSON.stringify([
            prior.write.categoryId.toLowerCase(), prior.write.collection,
            prior.write.collectionSignature, prior.write.collectionHash.toLowerCase(),
            prior.write.keySlot.toLowerCase(), prior.write.entryAccessSlot, prior.write.routeSlot,
            prior.write.operation, prior.write.outputBase, prior.write.outputCount,
            canonicalValueChunkStateOwner(prior.stateOwner), binToHex(prior.value),
          ]);
          if (priorShape !== shape) {
            throw new Error(
              `messageBus: conflicting value-chunk productions for invocation ${invocationIndex}`,
            );
          }
          continue;
        }
        valueChunkProductions.set(identity, production);
      }
    }
    const executionLockingBytecode = descriptor.executor?.inner.lockingBytecode
      ?? contract.inner.lockingBytecode;
    // A delegate executor writes its proxy's chunks, which bind the proxy master's lock, not the executor's.
    const recordLockingBytecode = contract.inner.lockingBytecode;
    retainTerminalValueChunkProductions(valueChunkProductions, {
      rows: routeRows,
      executionLockingBytecode,
      fixedChunkableWriteSelectors: participant.artifact.messageBus?.fixedChunkableWritePolicy?.selectors,
    });
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1' && valueChunkProductions.size > 0) {
      console.error('atomic-transported-value-productions', {
        participant: participant.participant,
        count: valueChunkProductions.size,
        resources: [...valueChunkProductions.values()].map((production) => (
          valueChunkWriteResourceIdentity(production.write)
        )),
      });
    }
    const valueChunkSlots = participant.blockLayout!.slots
      .filter((slot) => slot.kind === 'trailing')
      .sort((left, right) => left.offset - right.offset);
    const transportedValueChunks = [...valueChunkProductions.values()].map((production) => {
      const lockingBytecode = publishedTransportedValueChunkLock(production, recordLockingBytecode);
      if (!lockingBytecode) {
        throw new Error('messageBus: transported value production has no continuation covenant');
      }
      return {
        production,
        chunks: chunksFromValue(production.value, {
          lockingBytecode, write: production.write, categoryId: production.stateOwner.categoryId,
        }),
      };
    });
    const transportedChunkCount = transportedValueChunks.reduce(
      (count, candidate) => count + candidate.chunks.length, 0,
    );
    if (transportedChunkCount > valueChunkSlots.length) {
      throw new Error(
        `messageBus: participant ${participant.participant} needs ${transportedChunkCount} continuation `
          + `slots but publishes ${valueChunkSlots.length}`,
      );
    }
    // After terminal-per-resource selection, each distinct storage resource contributes one lane. Multiple
    // lanes are packed as consecutive trailing bands under one owner; the scalar
    // `__internal__valueChunkOutputBase` remains band[0], and ordered continuationResourceClaims authenticate
    // every later band. Multi-owner productions on one carrier remain refused downstream.
    const ownerKeys = new Set(transportedValueChunks.map((candidate) => (
      canonicalValueChunkStateOwner(candidate.production.stateOwner)
    )));
    if (ownerKeys.has(undefined) || ownerKeys.size > 1) {
      throw new Error('One routed execution carrier cannot own value productions from multiple state owners.');
    }
    // Begin with the canonical trailing placement. Once the participant's local outputs are known, select
    // the latest genuinely unowned band: local writes can use the same trailing slots.
    let selectedValueChunkSlots = transportedChunkCount === 0
      ? [] : valueChunkSlots.slice(-transportedChunkCount);
    if (selectedValueChunkSlots.some((slot, index) => index > 0
        && slot.offset !== selectedValueChunkSlots[index - 1]!.offset + 1)) {
      throw new Error('messageBus: transported continuation slots are not one consecutive trailing run');
    }
    const participantInputBase = graph.layout.participantInputs[participant.participant];
    const placeTransportedBands = (): readonly TransportedContinuationResourceClaim[] => {
      let bandCursor = 0;
      const continuationResourceClaims: TransportedContinuationResourceClaim[] = [];
      for (const candidate of transportedValueChunks) {
        const chunkCount = candidate.chunks.length;
        if (chunkCount === 0) {
          throw new Error('messageBus: transported value production published an empty continuation band');
        }
        const bandOffset = selectedValueChunkSlots[bandCursor]!.offset;
        const absoluteBase = participantInputBase + bandOffset;
        const write = {
          ...candidate.production.write,
          outputBase: absoluteBase,
          outputCount: chunkCount,
        };
        // Productions arriving from graph promotion are frozen; replace the map entry rather than mutate.
        const nextProduction = Object.freeze({
          ...candidate.production,
          write: Object.freeze({ ...write }),
        });
        const producerIdentity = canonicalValueChunkProducerIdentity(nextProduction.claim.producer);
        const resourceIdentity = canonicalValueChunkProducerResourceIdentity(
          valueChunkWriteResourceIdentity(write),
        );
        if (!producerIdentity || !resourceIdentity) {
          throw new Error('messageBus: transported continuation production lost its canonical identity');
        }
        valueChunkProductions.set(JSON.stringify([resourceIdentity, producerIdentity]), nextProduction);
        candidate.production = nextProduction;
        const claim = buildTransportedContinuationResourceClaim({
          owner: nextProduction.stateOwner,
          collectionSignature: write.collectionSignature,
          collectionHash: write.collectionHash,
          keySlot: write.keySlot,
          digest: binToHex(sha256(nextProduction.value)),
          chunkCount,
          bandOffset,
          producerClaim: nextProduction.claim,
        });
        if (!claim) {
          throw new Error('messageBus: transported continuation resource claim is not canonical');
        }
        continuationResourceClaims.push(claim);
        bandCursor += chunkCount;
      }
      const ordered = continuationResourceClaims.length === 0
        ? [] : orderTransportedContinuationResourceClaims(continuationResourceClaims);
      if (continuationResourceClaims.length > 0 && ordered === undefined) {
        throw new Error('messageBus: transported continuation resource claims are not an ordered band list');
      }
      return ordered ?? [];
    };
    let orderedContinuationClaims = placeTransportedBands();
    // Defer absolute valueChunk/dyn/PredOut to ONE resolveParticipantAbsoluteWitnesses pass after the
    // local frame exists (PredOut content-match needs outputs). Pass the participant-local slot offset
    // here so `_batchRaw` can build; the unlocker sync below rebases every absolute from that single result.
    const valueChunkSlotOffset = transportedChunkCount > 0
      ? selectedValueChunkSlots[0]!.offset : undefined;
    let pendingValueChunkClaim = valueChunkSlotOffset === undefined ? undefined : {
      localSlotOffset: valueChunkSlotOffset,
      chunkCount: transportedChunkCount,
      collection: transportedValueChunks[0]?.production.write.collectionSignature ?? 'valueChunk',
    };
    const internalRouteWitnesses = {
      ...graphRouteContext(graph, participant.participant, upgradeStateSuffixes),
      ...(pendingValueChunkClaim !== undefined && {
        __internal__valueChunkOutputBase: BigInt(pendingValueChunkClaim.localSlotOffset),
      }),
    };
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
      console.error('atomic-lane-bind', JSON.stringify({
        participant: participant.participant,
        transportedChunkCount,
        valueChunkSlots: valueChunkSlots.length,
        selected: selectedValueChunkSlots.map((slot) => slot.offset),
        claims: (orderedContinuationClaims ?? []).map((claim) => ({
          resource: claim.producerClaim.resourceIdentity,
          bandOffset: claim.bandOffset,
          chunkCount: claim.chunkCount,
          digest: claim.digest.slice(0, 16),
        })),
        transported: transportedValueChunks.map((candidate) => ({
          bytes: candidate.production.value.length,
          chunks: candidate.chunks.length,
          digest: binToHex(sha256(candidate.production.value)).slice(0, 16),
          outputBase: candidate.production.write.outputBase,
        })),
        base: transportedChunkCount > 0
          ? participantInputBase + selectedValueChunkSlots[0]!.offset
          : undefined,
      }));
    }
    // Each row's `msg.sender` is the compiler-published caller identity of the participant that CALLS that
    // row - never the transaction origin, and never inferred from proxy/delegate executor geometry. The
    // `__internal__graphCallers` stream already carries per-row subjects from finalization; the frame probe
    // annotation below uses the shared subject only when every local row publishes the same one.
    const graphCallers = participant.invocations.map((invocationIndex) => {
      const planned = plan.invocations[invocationIndex];
      if (planned === undefined || planned.caller === null) return undefined;
      return planned.callerIdentity
          ?? graphInvocationCallerIdentity(plan.participants, plan.invocations, planned);
    });
    const sharedCallerLocks = [...new Set(graphCallers
      .filter((identity): identity is NonNullable<typeof identity> => identity !== undefined)
      .map((identity) => identity.lockingBytecode.toLowerCase()))];
    const frameInvocation = plan.invocations[participant.invocations[0]!];
    const frameCaller = sharedCallerLocks.length === 1
      ? graphCallers.find((identity) => identity !== undefined)
      : undefined;
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_PARTICIPANT_ROWS === '1') {
      // One participant frame batches several rows, and each row's `msg.sender` is the identity of the
      // participant that called THAT row - a frame-level caller is only valid when every row agrees.
      console.error('participant-rows', JSON.stringify({
        participant: participant.participant,
        contract: participant.artifact.contractName,
        frameCaller: frameCaller === undefined ? undefined
          : `${frameInvocation?.caller === null ? 'root' : plan.participants[frameInvocation!.caller!]
            ?.artifact.contractName}:${frameCaller.lockingBytecode.slice(0, 16)}`,
        rows: participant.invocations.map((invocationIndex, rowIndex) => {
          const planned = plan.invocations[invocationIndex];
          const invocationDescriptor = descriptors[invocationIndex];
          const caller = planned?.caller === null || planned?.caller === undefined
            ? undefined : plan.participants[planned.caller];
          const resolved = graphCallers[rowIndex];
          return {
            function: invocationDescriptor?.functionName,
            localRow: planned?.localRow,
            caller: caller?.artifact.contractName,
            callerLock: resolved?.lockingBytecode.slice(0, 16),
            callerRole: resolved?.role,
            authOffset: resolved?.authOffset,
          };
        }),
      }));
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ENTRY_COUNTS === '1') {
      // The hidden witnesses ARE the coordinates a frame computes its block slots from. Printing the band each
      // participant's own batch receives is the only way to tell a frame that was handed another participant's
      // base from one whose own slot offset is wrong.
      const band = (name: string): string => {
        const value = (internalRouteWitnesses as Record<string, unknown>)[name];
        return value instanceof Uint8Array
          ? `${value.length}b:${binToHex(value).slice(0, 24)}` : String(value);
      };
      console.error('participant-witness-band', JSON.stringify({
        participant: participant.participant,
        contract: participant.artifact.contractName,
        executionKind: participant.executionKind,
        base: graph.layout.participantInputs[participant.participant],
        executorOffset: participant.executorOffset,
        proxyMasterIndex: band('__internal__proxyMasterIndex'),
        activeVerifierIndex: band('__internal__activeVerifierIndex'),
        returnOutputIdx: band('__internal__returnOutputIdx'),
        dynamicChunkInputBase: band('__internal__dynamicChunkInputBase'),
        calls: participant.invocations.map((invocationIndex) => ({
          function: plan.invocations[invocationIndex]?.function,
          callee: plan.invocations[invocationIndex]?.callee,
        })),
      }));
    }
    const localCall = contract._batchRaw(
      participant.batch!.blob,
      participant.batch!.routeWitnesses as FunctionArgument[],
      internalRouteWitnesses,
      graph.layout.participantInputs[participant.participant],
      returnBlob !== undefined,
      returnCommitment,
      true,
      descriptor.executor ? { artifact: descriptor.artifact, executor: descriptor.executor } : undefined,
      routeRows,
      logicalIdentities.get(participant.participant),
      Object.freeze([...valueChunkProductions.values()]),
      frameCaller === undefined ? undefined : hexToBin(frameCaller.lockingBytecode),
      { lifecycle: ctx.executionContexts, participantIndex: participant.participant },
    );
      // `_withChildDeployment` / `_withCompilerTransfer*` below force `StatefulFunctionCall._applyOverrides` to
      // REBUILD the frame, and that rebuild carries the call object's identity - so record it on the call too,
      // not only in the initial build above.
      // The category of the participant that CALLS this frame (the compiler resolves `msg.sender` from it).
    if (frameCaller !== undefined) {
      const callerParticipant = frameInvocation?.caller === null || frameInvocation?.caller === undefined
        ? undefined : plan.participants[frameInvocation.caller];
      const callerDescriptor = callerParticipant === undefined
        ? undefined : descriptors[callerParticipant.invocations[0]!];
      localCall.withCallerIdentity(
        hexToBin(frameCaller.lockingBytecode),
        callerDescriptor?.contract.categoryId,
      );
    }
    for (const deployment of materializedDeployments) {
      if (deployment.participant !== participant.participant || !deployment.active
          || !('genesis' in deployment)) continue;
      localCall._withChildDeployment(
        deployment.slotOffset, deployment.genesis, deployment.outputs,
      );
      if (deployment.valueTransfer) {
        localCall._withCompilerTransfer(
          deployment.valueTransfer.outputSlot,
          deployment.valueTransfer.lockingBytecode,
          deployment.valueTransfer.amount,
        );
      }
    }
    // A participant probe is built in isolation while its covenant addresses outputs in the final graph's
    // absolute coordinate space. Forward/literal BCH transfers are already compiler-authenticated in the
    // invocation manifest, so materialize them directly instead of asking the isolated probe to discover an
    // output at a shifted absolute index. The final covenant still verifies recipient and amount in-place.
    const occupiedCompilerTransferSlots = new Set<number>();
    for (const invocationIndex of participant.invocations) {
      const invocation = plan.invocations[invocationIndex];
      const handler = findMessageBusHandlerForInvocation(participant.artifact, invocation);
      const supplied = descriptors[invocationIndex];
      const authenticatedState = await stateOf(contract) as Readonly<Record<string, FunctionArgument>>;
      if ((globalThis as { process?: { env?: Record<string, string> } }).process
        ?.env?.SOLIDC_DEBUG_PARTICIPANT_STATE === '1') {
        // Address-typed state fields are the identities a graph row publishes: the contract reads them from its
        // own cache lane and the plan builds the expected emission rows from the same values. Printing the plan's
        // values per participant is what decides whether a mismatching row lane is a plan defect or a read defect.
        const stateLayout = participant.artifact.stateLayout;
        const addressFields = (stateLayout?.variables ?? []).filter(
          (variable) => /address|bytes20|bytes32/.test(String(variable.type)),
        );
        console.error('participant-state', JSON.stringify({
          participant: participant.participant,
          contract: participant.artifact.contractName,
          fields: addressFields.map((variable) => ({
            name: variable.name,
            type: String(variable.type),
            nftIndex: variable.nftIndex,
            fieldIndex: variable.fieldIndex,
            value: String(authenticatedState[variable.name] ?? '(undefined)').slice(0, 80),
          })),
        }));
      }
      const executionArtifact = supplied.executionArtifact ?? participant.artifact;
      const logicalCaller = invocation.caller === null
        ? rootCaller : hexToBin(graphInvocationCallerIdentity(
          plan.participants, plan.invocations, invocation,
        ).lockingBytecode);
      const entryResolver = await loadFixedEffectEntries((handler?.transfers ?? []).flatMap((transfer) => [
        transfer.recipientRecipe, transfer.amountRecipe, transfer.condition?.fixedEffectRecipe,
      ]), executionArtifact, contract);
      for (const transfer of handler?.transfers ?? []) {
        if (transfer.condition === null) {
          throw new Error(
            `messageBus: BCH transfer predicate in '${invocation.function}' is not a canonical recipe`,
          );
        }
        if (transfer.condition !== undefined && !(await contract._resolveCompilerEffectPredicate(
          transfer.condition, supplied.args, handler!, supplied.executionArtifact ?? participant.artifact,
          authenticatedState, entryResolver, logicalCaller,
        ))) continue;
        const inputTypes = handler!.inputs.map((input) => input.type);
        const materialized = materializeFixedBchTransfer(
          transfer, supplied.args, inputTypes, executionArtifact, provider,
          authenticatedState, logicalCaller, entryResolver,
        );
        // A zero-valued compiler recipe leaves its conditional output slot inactive. Do not ask the public
        // positive-payment API to materialize it; final VM preflight still checks any executing transfer path.
        if (materialized.amount === 0n) continue;
        const transferSlots = participant.blockLayout!.slots
          .filter((slot) => slot.kind === 'transfer' && slot.slotIndex !== undefined);
        const maximumRows = participant.artifact.messageBus?.maximumRows ?? 0;
        const frameWidth = maximumRows > 0 && transferSlots.length % maximumRows === 0
          ? transferSlots.length / maximumRows : 0;
        const outputSlot = invocation.localRow * frameWidth + transfer.transferIndex;
        if (frameWidth < 1 || transfer.transferIndex < 0 || transfer.transferIndex >= frameWidth
            || !transferSlots.some((slot) => slot.slotIndex === outputSlot)) {
          throw new Error(`messageBus: BCH transfer in '${invocation.function}' has no canonical slot`);
        }
        if (occupiedCompilerTransferSlots.has(outputSlot)) {
          throw new Error(
            `messageBus: multiple BCH transfer recipes selected physical slot ${outputSlot}`,
          );
        }
        occupiedCompilerTransferSlots.add(outputSlot);
        localCall._withCompilerTransfer(
          outputSlot, materialized.lockingBytecode, materialized.amount,
        );
      }
    }
    let local: TransactionBuilder;
    try {
      local = await localCall.build();
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
        console.error('atomic-local-placement', JSON.stringify({
          participant: participant.participant,
          contract: participant.artifact.contractName,
          base: graph.layout.participantInputs[participant.participant],
          outputs: local.outputs.map((output, index) => ({
            index,
            lock: typeof output.to === 'string' ? output.to : binToHex(output.to as Uint8Array),
            commitment: output.token?.nft?.commitment,
            capability: output.token?.nft?.capability,
          })),
        }));
      }
      const publishedLocks = (local as {
        __messageBusResourceLocks?: ReadonlyArray<readonly [string, string]>;
      }).__messageBusResourceLocks;
      if (publishedLocks && publishedLocks.length > 0) {
        resourceLocksByParticipant.set(participant.participant, publishedLocks);
      }
    } catch (error) {
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ATOMIC_PROMOTION === '1') {
        console.error('atomic-participant-build-error', error);
      }
      throw new Error(
        `messageBus: participant ${participant.participant} '${participant.artifact.contractName}' `
          + `failed to build its balanced block: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    // A straight-line dynamic write may publish an exact typed value recipe. Evaluate it against the
    // authenticated incoming state and selected call arguments before VM preflight; the VM then validates
    // the commitment, rather than serving as the source of a repair for a failed frame.
    const applyDynamicWriteRecipes = async (target: TransactionBuilder): Promise<void> => {
      if (participant.invocations.length !== 1) return;
      const invocationIndex = participant.invocations[0]!;
      const supplied = descriptors[invocationIndex];
      const executionArtifact = supplied.executionArtifact ?? participant.artifact;
      const handler = executionArtifact.abi.find((entry) => entry.name === supplied.functionName);
      if (handler?.dynamicWriteRecipes) {
        const incomingState = await stateOf(contract) as Readonly<Record<string, FunctionArgument>>;
        for (const [name, recipe] of Object.entries(handler.dynamicWriteRecipes)) {
          const variable = executionArtifact.stateLayout?.variables.find((entry) => entry.name === name);
          if (!variable?.dynamic) continue;
          const value = evaluateChildDeploymentRecipe(
            recipe, supplied.args, handler.inputs.map((input) => input.type),
            artifactUsesSolidityAbi(executionArtifact), incomingState,
          );
          const bytes = value instanceof Uint8Array ? value
            : typeof value === 'string' ? utf8ToBin(value) : undefined;
          if (!bytes) continue;
          const commitments = splitValueIntoChunks(bytes).map((chunk, index) =>
            buildChunkCommitment(index, chunk, provider.consensusLimits?.maximumNftCommitmentBytes));
          const chunkLock = addressToLockScript(getDynamicChunkAddress(
            contract.inner, categories[participant.participant], name, variable.type,
          ));
          const slots = target.outputs.flatMap((output, index) => {
            const lock = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
            return output.token?.category === categories[participant.participant]
                && output.token.nft?.capability === 'mutable'
                && binToHex(lock) === binToHex(chunkLock) ? [index] : [];
          });
          if (slots.length < commitments.length || slots.some((slot, index) => index > 0
            && slot !== slots[index - 1]! + 1)) continue;
          const surplus = slots.slice(commitments.length);
          const trailingOffsets = new Set(participant.blockLayout!.slots.filter((slot) =>
            slot.kind === 'trailing').map((slot) => slot.offset));
          // A proxy route may reserve more output-only continuation lanes than this selected handler needs.
          // Retire only unused compiler-owned placeholders funded by token-free dummy inputs. A real old chunk,
          // a non-placeholder commitment, or a non-trailing output is not a recipe-owned spare lane.
          if (surplus.some((slot) => {
            const input = target.inputs[slot];
            const output = target.outputs[slot];
            return !trailingOffsets.has(slot) || input?.token !== undefined
              || !input || binToHex(input.unlocker.generateLockingBytecode())
                !== BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX
              || !output || output.token?.amount !== 0n
              || (output.token?.nft?.commitment !== '00'
                && output.token?.nft?.commitment !== '');
          })) continue;
          for (const slot of surplus) {
            const output = target.outputs[slot]!;
            target.outputs[slot] = { to: Uint8Array.of(0x51), amount: output.amount };
          }
          slots.slice(0, commitments.length).forEach((slot, index) => {
            target.outputs[slot]!.token!.nft!.commitment = commitments[index]!;
          });
        }
      }
    };
    await applyDynamicWriteRecipes(local);
    let localComputedChunkMetadata = local as TransactionBuilder & {
      __messageBusComputedValueChunkSpanClaims?: readonly ComputedValueChunkSpanClaim[];
      __messageBusComputedValueChunks?: readonly MaterializedContinuationClaim[];
    };
    if (transportedChunkCount > 0) {
      const physicalResources = transportedValueChunks.map((candidate) => ({
        chunks: candidate.chunks.map((chunk) => ({
          ...chunk,
          categoryId: chunk.categoryId ?? candidate.production.stateOwner.categoryId,
          resourceIdentity: valueChunkWriteResourceIdentity(candidate.production.write),
        })),
      }));
      const selectedBands = selectTransportedContinuationResourceSlots(
        local, valueChunkSlots.map((slot) => slot.offset), physicalResources,
        [
          ...(localComputedChunkMetadata.__messageBusComputedValueChunkSpanClaims ?? []),
          ...(localComputedChunkMetadata.__messageBusComputedValueChunks ?? []),
        ], participantInputBase,
      );
      if (selectedBands === undefined) {
        throw new Error(
          `messageBus: participant ${participant.participant} has no owned continuation band for every resource`,
        );
      }
      const selectedOffsets = selectedBands.flat();
      if (selectedOffsets.some((offset, index) => offset !== selectedValueChunkSlots[index]?.offset)) {
        selectedValueChunkSlots = selectedOffsets.map((offset) => ({ kind: 'trailing' as const, offset }));
        orderedContinuationClaims = placeTransportedBands();
        if (pendingValueChunkClaim) pendingValueChunkClaim.localSlotOffset = selectedOffsets[0]!;
        localCall._withTransportedValueChunkProductions(
          Object.freeze([...valueChunkProductions.values()]), selectedOffsets[0]!,
        );
        local = await localCall.build();
        await applyDynamicWriteRecipes(local);
        localComputedChunkMetadata = local as typeof localComputedChunkMetadata;
        const rebuiltClaims = [
          ...(localComputedChunkMetadata.__messageBusComputedValueChunkSpanClaims ?? []),
          ...(localComputedChunkMetadata.__messageBusComputedValueChunks ?? []),
        ];
        for (const [resourceIndex, band] of selectedBands.entries()) {
          const expected = physicalResources[resourceIndex]!.chunks;
          for (const [chunkIndex, offset] of band.entries()) {
            if (!rebuiltClaims.some((claim) => claim.offset === participantInputBase + offset
              && claim.resourceIdentity === expected[chunkIndex]!.resourceIdentity
              && claim.resourcePart === `chunk:${chunkIndex}`)) {
              throw new Error('messageBus: rebuilt continuation lost its final per-resource slot claim');
            }
          }
        }
      }
    }
    let transportedChunkIndex = 0;
    materializeTransportedContinuations(local, valueChunkSlots.map((slot) => slot.offset),
      transportedValueChunks.flatMap((candidate) => candidate.chunks.map((chunk) => {
        const slot = selectedValueChunkSlots[transportedChunkIndex++];
        if (!slot) throw new Error('messageBus: transported continuation slot allocation overflowed');
        const chunkCategoryId = chunk.categoryId ?? candidate.production.stateOwner.categoryId;
        return {
          ...chunk, offset: slot.offset, categoryId: chunkCategoryId,
          resourceIdentity: valueChunkWriteResourceIdentity(candidate.production.write),
        };
      })), localComputedChunkMetadata.__messageBusComputedValueChunks ?? [], participantInputBase);
    const split = splitByParticipant.get(participant.participant);
    if (split) {
      local.addInputs([...split.funders]);
      for (const value of split.createdValues) {
        local.addOutput({
          to: hexToBin(participant.lockingBytecode), amount: value,
          token: {
            category: categories[participant.participant], amount: 0n,
            nft: { capability: 'minting', commitment: '' },
          },
        });
      }
    }
    const merge = mergeByParticipant.get(participant.participant);
    if (merge) {
      const routeUnlocker = local.inputs[0]?.unlocker;
      const masterOutput = local.outputs[0];
      if (!routeUnlocker || !masterOutput?.token?.nft
          || masterOutput.token.nft.capability !== 'minting') {
        throw new Error(`messageBus: merge participant ${participant.participant} lacks its survivor`);
      }
      let mergedTokenAmount = masterOutput.token.amount;
      // Audit MERGE-1: the survivor carries every consumed master's satoshis; the consumed tail slots stay as
      // tokenless placeholders so output indexes keep matching input indexes for the route's lifecycle checks.
      let mergedValue = masterOutput.amount;
      for (const consumed of merge.consumedMasters) {
        if (consumed.token?.category.toLowerCase() !== categories[participant.participant].toLowerCase()
            || consumed.token.nft?.capability !== 'minting') {
          throw new Error(
            `messageBus: merge participant ${participant.participant} input is not one exact category master`,
          );
        }
        mergedTokenAmount += consumed.token.amount ?? 0n;
        mergedValue += consumed.satoshis;
        local.addInput(consumed, routeUnlocker);
        // Audit MERGE-1: the consumed tail keeps a tokenless output slot at its input index, but its value is
        // pinned to the survivor. A zero-sat output is below the relay dust floor, and BCHN relays at most one
        // OP_RETURN output, so the slot is a dust-paying output funded from the fee tail's change.
        local.addOutput({
          to: options.changeAddress,
          amount: BigInt(calculateDust({ to: options.changeAddress, amount: 0n })),
        });
      }
      local.outputs[0] = {
        ...masterOutput,
        amount: mergedValue,
        token: { ...masterOutput.token, amount: mergedTokenAmount },
      };
    }
    const retired = selfdestructByParticipant.get(participant.participant);
    if (retired) {
      const masterInput = local.inputs[0];
      if (!masterInput?.token?.nft || masterInput.token.nft.capability !== 'minting'
          || masterInput.token.category.toLowerCase() !== categories[participant.participant].toLowerCase()) {
        throw new Error(
          `messageBus: selfdestruct participant ${participant.participant} lacks its retired master`,
        );
      }
      local.outputs[0] = { to: retired.recipient, amount: masterInput.satoshis };
      const dataNftCount = participant.artifact.stateLayout?.dataNftCount ?? 0;
      const publishedBase = graph.layout.participantInputs[participant.participant] ?? 0;
      if (!isContractUnlocker(masterInput.unlocker)) {
        throw new Error(
          `messageBus: selfdestruct participant ${participant.participant} master unlocker is not a contract unlocker`,
        );
      }
      const masterContract = masterInput.unlocker.contract;
      for (let nftOffset = 1; nftOffset <= dataNftCount; nftOffset += 1) {
        const nftInput = local.inputs[nftOffset];
        if (!nftInput || nftInput.token?.nft?.capability !== 'mutable'
            || nftInput.token.category.toLowerCase() !== categories[participant.participant].toLowerCase()) {
          throw new Error(
            `messageBus: selfdestruct participant ${participant.participant} lacks dataNft ${nftOffset - 1}`,
          );
        }
        local.outputs[nftOffset] = { to: retired.recipient, amount: nftInput.satoshis };
        // Preserve unlockers require category recreation; retirement pads are token-free.
        local.inputs[nftOffset] = {
          ...nftInput,
          unlocker: createDestroyDataNftUnlocker(
            masterContract, publishedBase, categories[participant.participant],
          ),
        };
      }
    }
    const authenticatedOutputLockingBytecode = participant.outputLockingBytecode?.toLowerCase();
    if (authenticatedOutputLockingBytecode !== undefined) {
      const masterInput = local.inputs[0];
      const masterOutput = local.outputs[0];
      if (!masterInput || !masterOutput || !masterInput.token || !masterOutput.token
          || masterInput.token.category !== masterOutput.token.category
          || masterInput.token.amount !== masterOutput.token.amount
          || masterInput.token.nft?.capability !== masterOutput.token.nft?.capability
          || masterInput.token.nft?.commitment !== masterOutput.token.nft?.commitment
          || masterInput.satoshis !== masterOutput.amount) {
        throw new Error(
          `messageBus: participant ${participant.participant} master geometry is not preserved across upgrade`,
        );
      }
      local.outputs[0] = { ...masterOutput, to: hexToBin(authenticatedOutputLockingBytecode) };
      const suffix = upgradeStateSuffixes.get(participant.lockingBytecode.toLowerCase())
          ?? new Uint8Array();
      if (suffix.length > 0) {
        const dataNftCount = participant.artifact.stateLayout?.dataNftCount ?? 0;
        const tailOffset = dataNftCount;
        const tailInput = local.inputs[tailOffset];
        const tailOutput = local.outputs[tailOffset];
        const prefixHex = tailOutput?.token?.nft?.commitment;
        if (!tailInput?.token?.nft || !tailOutput?.token?.nft || prefixHex === undefined
            || tailInput.token.category !== tailOutput.token.category
            || tailInput.token.amount !== tailOutput.token.amount
            || tailInput.token.nft.capability !== tailOutput.token.nft.capability
            || tailInput.satoshis !== tailOutput.amount) {
          throw new Error(
            `messageBus: participant ${participant.participant} final data NFT geometry is not preserved`,
          );
        }
        const prefix = hexToBin(prefixHex);
        const limit = participant.artifact.stateLayout?.commitmentLimit ?? 128;
        if (prefix.length + suffix.length > limit) {
          throw new Error(
            `messageBus: appended state exceeds the ${limit}-byte final NFT commitment limit`,
          );
        }
        local.outputs[tailOffset] = {
          ...tailOutput,
          token: {
            ...tailOutput.token!,
            nft: { ...tailOutput.token!.nft!, commitment: binToHex(concat(prefix, suffix)) },
          },
        };
      }
    }
    // Embedded delegates can move selected read-only chunks into the state owner's trailing band after the
    // nested builder placed outputs. The union ABI may supply write-mode unlockers for these inputs, so use
    // selected handler effects (not the unlocker flag) to identify which unchanged twins must be restored.
    const selectedHandlers = participant.invocations.map((index) => {
      const selected = findMessageBusHandlerForInvocation(participant.artifact, plan.invocations[index]);
      return selected === undefined ? undefined : participant.artifact.abi.find((handler) =>
        handler.selector?.toLowerCase() === selected.selector.toLowerCase());
    });
    const selectedDynamicWrites = new Set(selectedHandlers.flatMap((handler) => handler?.dynamicWrites ?? []));
    if (selectedHandlers.every((handler) => handler !== undefined) && selectedDynamicWrites.size === 0) {
      // A union route can own writers which this authenticated batch never selects. Preserve its readable
      // dynamic inputs while disabling the route-wide write settlement, including in a delegated executor.
      for (const input of local.inputs) {
        if (!isContractUnlocker(input.unlocker)
          || input.unlocker.abiFunction.name !== participant.artifact.messageBus?.route.name) continue;
        const baseIndex = input.unlocker.abiFunction.inputs.findIndex((parameter) =>
          parameter.name === '__internal__dynamicChunkInputBase');
        const value = baseIndex < 0 ? undefined : input.unlocker.params[baseIndex];
        if (!layoutWitnessIsActiveCoordinate(value)) continue;
        input.unlocker.params[baseIndex] = -(value + 3n);
        input.unlocker.syncEncodedArgsFromParams?.([baseIndex]);
      }
    }
    const selectedReadOnlyDynamicLocks = (participant.artifact.stateLayout?.variables ?? []).flatMap((variable) => {
      if (!variable.dynamic || selectedDynamicWrites.has(variable.name)) return [];
      return [addressToLockScript(getDynamicChunkAddress(
        contract.inner, categories[participant.participant], variable.name, variable.type,
      ))];
    });
    // Runtime event occurrences occupy compiler-owned trailing slots, so they cannot appear as fixed
    // `blockLayout.kind === event` coordinates. Preserve the exact row, schema, and physical offset published
    // by the participant builder; later graph passes turn only these observed occurrences into kind-2 rows.
    // This is resource geometry, independent of contract/function/event names.
    const builtRuntimeEvents = (local as TransactionBuilder & {
      __messageBusRuntimeLoopEvents?: readonly {
        eventSignature: string; rowIndex: number; offset: number; chunked?: true;
      }[];
    }).__messageBusRuntimeLoopEvents ?? [];
    // The read-only twins restored below lead the band and the stream follows them, as its verifier counts:
    // publish each record where that restoration leaves it, and feed claims back at the built coordinate.
    const settledOutputs = [...local.outputs];
    reassertRoutedReadOnlyDynamicChunkTwins(settledOutputs, local.inputs, selectedReadOnlyDynamicLocks);
    const runtimeEvents = builtRuntimeEvents.map((event) => {
      const offset = settledOutputs.indexOf(local.outputs[event.offset]!);
      return offset < 0 ? event : { ...event, offset };
    });
    const builtEventOffsets = new Map(runtimeEvents.map((event, index) => [
      event.offset, builtRuntimeEvents[index]!.offset,
    ]));
    runtimeEventSlots.set(participant.participant,
      runtimeEvents.map((event) => ({
        participant: participant.participant,
        offset: event.offset,
        runtimeRow: event.rowIndex,
        eventSignature: event.eventSignature,
        ...(event.chunked && { chunked: true as const }),
      })));
    feedBackRuntimeEventClaims(
      local.outputs, runtimeEvents, builtEventOffsets, graph.callManifest.rows, participant.participant,
    );
    // Event effects are fixed-point claims just like return values and mutable resources. Once a prior pass
    // has authenticated an event commitment, feed it back into the exact compiler-published participant slot;
    // otherwise every assembly pass recreates the empty probe placeholder and convergence can never advance
    // past the handler's OUTPUTTOKENCOMMITMENT equality.
    const fixedEventOffsets = participant.blockLayout!.slots
      .filter((slot) => slot.kind === 'event').map((slot) => slot.offset);
    const eventClaims = graph.callManifest.rows.filter((row) =>
      row.kind === 2 && row.owner === participant.participant && row.mode === 1
        && fixedEventOffsets.includes(row.targetOffset));
    if (eventClaims.length > 0) {
      const eventOffsets = participant.blockLayout!.slots
        .filter((slot) => slot.kind === 'event').map((slot) => slot.offset);
      const eventLocks = eventLockingBytecodes(participant);
      const eventLockSet = new Set(eventLocks);
      const templateOffsets = local.outputs.flatMap((output, offset) => {
        const lockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
        return output.token?.nft?.capability === 'none'
            && eventLockSet.has(binToHex(lockingBytecode))
          ? [offset] : [];
      });
        // The participant builder materializes one event output per compiler-published site, so every reserved
        // slot already carries the event covenant's lock and the site's satoshi value; only its commitment
        // identifies an occurrence. A token-less slot is therefore NOT the normal blank template - derive the
        // canonical blank frame from a published site (identical lock/value, empty commitment) and only fall
        // back to a token-less slot when this participant published no site at all. Requiring a token-less slot
        // rejected a correct frame whose union slots were all already materialized.
      const plainEventTemplate = (): (typeof local.outputs)[number] | undefined => {
        const site = [...eventClaims].reverse()
          .map((row) => local.outputs[row.targetOffset])
          .find((output) => output?.token?.nft?.capability === 'none');
        if (!site) return undefined;
        return { ...site, token: { ...site.token!, nft: { ...site.token!.nft!, commitment: '' } } };
      };
      const inactive = eventOffsets.map((offset) => local.outputs[offset]).find((output) => !output?.token)
          ?? plainEventTemplate();
      if (!inactive) {
        throw new Error(
          `messageBus: participant ${participant.participant} cannot materialize its authenticated event frame`,
        );
      }
      // Save the compiler-built site templates before clearing the union frame: a previously authenticated
      // graph row is the authority for identity and payload even when the consumer artifact lacks a redundant
      // event-schema table.
      const claimTemplates = new Map(eventClaims.map((row) => [row.targetOffset, local.outputs[row.targetOffset]]));
      for (const offset of new Set([...eventOffsets, ...templateOffsets])) local.outputs[offset] = { ...inactive };
      eventClaims.forEach((row) => {
        const template = claimTemplates.get(row.targetOffset) ?? inactive;
        local.outputs[row.targetOffset] = {
          to: hexToBin(row.subjectHex),
          amount: template.amount,
          token: {
            category: categories[participant.participant], amount: 0n,
            nft: { capability: 'none', commitment: row.effectHex },
          },
        };
      });
    }
    const publishedComputeOffsets = participant.blockLayout!.slots
      .filter((slot) => slot.kind === 'keccakSideCar' || slot.kind === 'ecrecoverSideCar')
      .map((slot) => slot.offset);
      // A route publishes the union of every eligible handler's compute coordinates. Only slots carrying a
      // mutable sidecar in this selected batch participate in deferred resolution; inactive union slots are
      // balanced funders and intentionally have no kind-6 manifest row.
    const computeOffsets = publishedComputeOffsets.filter((offset) =>
      local.inputs[offset]?.token?.nft?.capability === 'mutable');
      // deferred-compute recipe gate: recipe-once — do not apply deferred-compute VM-discovery cache as planner authority.
    const allowDeferredComputeDiscovery = allowsDeferredComputeVmDiscovery();
    const cachedCompute = allowDeferredComputeDiscovery
      ? deferredComputeCache.get(participant.participant)
      : undefined;
    if (cachedCompute?.graphKey === deferredComputeGraphKey) {
      for (const [offset, resource] of cachedCompute.resources) {
        local.inputs[offset] = resource.input;
        local.outputs[offset] = resource.output;
      }
    } else {
      const controller = (local as DeferredComputeBuilder).__messageBusDeferredCompute;
      if (controller?.hasUnresolved()) {
        // The route carries a selected handler per logical row, while its compute slots are physical and
        // ordered across those rows. Replay only compiler-published operands. A producer leaf can use a
        // caller-prepared exact candidate or a provider read shaped by a compiler-proven pre-state expression;
        // the final graph VM proves that candidate against the exact selected producer. Schema-shaped
        // provisional graph results and failed aggregate traces never become compute operands.
        const keccakPreimages: Array<Uint8Array | null> = [];
        const recoveryArguments: Array<Uint8Array | null> = [];
        for (let rowIndex = 0; rowIndex < routeRows.length; rowIndex += 1) {
          const { handler, args } = routeRows[rowIndex];
          const invocationIndex = participant.invocations[rowIndex];
          const recipes = handler.computeSideCarRecipes;
          const keccakCount = handler.keccakPreimageParams?.length ?? 0;
          const recoveryCount = handler.ecrecoverEvmFlags?.length
            ?? handler.ecrecoverArgParams?.length ?? 0;
          if (recipes !== undefined && (recipes.version !== 1
            || recipes.keccak.length !== keccakCount
            || recipes.ecrecover.length !== recoveryCount)) {
            throw new Error(`messageBus: handler ${handler.name} publishes mismatched compute recipe ordinals`);
          }
          const producerLeaves: ExternalCallExpression[] = [];
          const visit = (expression: ExternalCallExpression): void => {
            if (expression.kind === 'producerResult') producerLeaves.push(expression);
            for (const child of [expression.target, expression.expression, expression.left,
              expression.right, expression.condition, expression.ifTrue, expression.ifFalse,
              ...(expression.args ?? [])]) {
              if (child) visit(child);
            }
          };
          for (const expression of recipes?.keccak ?? []) visit(expression);
          for (const recipe of recipes?.ecrecover ?? []) {
            if (recipe.kind === 'signature65') {
              visit(recipe.hash);
              visit(recipe.signature);
            } else recipe.args.forEach(visit);
          }
          const producerValues = new Map<string, FunctionArgument>();
          for (const leaf of producerLeaves) {
            const leafKey = JSON.stringify([
              leaf.callsiteId, leaf.sourceCallsiteId ?? null, leaf.resultIndex,
            ]);
            if (producerValues.has(leafKey)) continue;
            const matches = plan.invocations.filter((candidate) =>
              candidate.parent === invocationIndex
              && candidate.consumerCallsiteId === leaf.callsiteId
              && (leaf.sourceCallsiteId === undefined
                || candidate.sourceCallsiteId === leaf.sourceCallsiteId));
            if (matches.length !== 1) {
              throw new Error(`messageBus: compute recipe producer ${String(leaf.callsiteId)} `
                + `has ${matches.length} selected source occurrences`);
            }
            const producer = matches[0];
            const resultIndex = leaf.resultIndex;
            if (resultIndex === undefined || resultIndex < 0
              || resultIndex >= producer.resultTypes.length) {
              throw new Error('messageBus: compute recipe selects an invalid producer result component');
            }
            const prepared = preparedResults[producer.index];
            let values: readonly FunctionArgument[] | undefined;
            if (prepared !== undefined) {
              if (results[producer.index] !== prepared) {
                throw new Error('messageBus: compute recipe prepared producer differs from graph result');
              }
              const producerArtifact = plan.participants[producer.callee].artifact;
              values = decodeAuthenticatedProducerResultVector(
                hexToBin(prepared), producer.resultTypes,
                producerArtifact.structs ?? producerArtifact.stateLayout?.structs,
                producer.resultEncoding === 'evm-abi-v1', producerArtifact.enums,
              ) as readonly FunctionArgument[] | undefined;
            } else {
              const producerArtifact = plan.participants[producer.callee].artifact;
              const producerAbi = producerArtifact.abi.find((candidate) =>
                candidate.selector?.toLowerCase() === producer.selectorHex.toLowerCase());
              const selected = descriptors[producer.index];
              if (producerAbi && selected) {
                const hasPriorOwnerWrite = plan.invocations.some((candidate) => {
                  if (candidate.index >= producer.index || candidate.callee !== producer.callee) return false;
                  const priorAbi = producerArtifact.abi.find((entry) =>
                    entry.selector?.toLowerCase() === candidate.selectorHex.toLowerCase());
                  return priorAbi?.writesState !== false;
                });
                const length = await deriveDirectCollectionLengthResult({
                  artifact: producerArtifact,
                  abiFunction: producerAbi,
                  args: selected.args,
                  owner: selected.contract,
                  ...(selected.executor && { executor: selected.executor }),
                  hasPriorOwnerWrite,
                });
                if (length !== undefined) values = [length];
              }
            }
            if (values?.[resultIndex] !== undefined) {
              producerValues.set(leafKey, values[resultIndex]);
            }
          }
          const recipeContext = {
            artifact: participant.artifact,
            args,
            inputTypes: handler.inputs.filter((input) => !input.name.startsWith('__internal__'))
              .map((input) => input.type),
            producerResult: (leaf: ExternalCallExpression): FunctionArgument | undefined =>
              producerValues.get(JSON.stringify([
                leaf.callsiteId, leaf.sourceCallsiteId ?? null, leaf.resultIndex,
              ])),
          };
          const candidate = (expression: ExternalCallExpression): Uint8Array | null => {
            try {
              const value = evaluateComputeRecipeExpression(expression, recipeContext);
              if (!(value instanceof Uint8Array)) {
                throw new Error('messageBus: compute recipe keccak preimage is not bytes');
              }
              return value;
            } catch (error) {
              if (error instanceof PendingComputeProducerResult) return null;
              throw error;
            }
          };
          for (let ordinal = 0; ordinal < keccakCount; ordinal += 1) {
            const recipe = recipes?.keccak[ordinal];
            keccakPreimages.push(recipe ? candidate(recipe) : null);
          }
          for (let ordinal = 0; ordinal < recoveryCount; ordinal += 1) {
            const recipe = recipes?.ecrecover[ordinal];
            if (!recipe) {
              recoveryArguments.push(null);
              continue;
            }
            try {
              recoveryArguments.push(recipe.kind === 'signature65'
                ? evaluateSignature65RecoveryArgument(recipe.hash, recipe.signature, recipeContext)
                : evaluateArgs4RecoveryArgument(recipe.args, recipeContext));
            } catch (error) {
              if (error instanceof PendingComputeProducerResult
                || error instanceof UnusableComputeSignature) recoveryArguments.push(null);
              else throw error;
            }
          }
        }
        if (keccakPreimages.length > 0 || recoveryArguments.length > 0) {
          controller.resolveRecipes?.(keccakPreimages, recoveryArguments);
          const refreshed = controller.refresh();
          for (const offset of computeOffsets) {
            const input = refreshed.inputs[offset];
            const output = refreshed.outputs[offset];
            if (!input || !output) {
              throw new Error(`messageBus: participant ${participant.participant} lost recipe side-car slot ${offset}`);
            }
            local.inputs[offset] = input;
            local.outputs[offset] = output;
          }
        }
      }
      if (controller?.hasUnresolved()) {
        const inputBase = graph.layout.participantInputs[participant.participant];
        const executionInput = participant.executionKind === 1 && participant.executorOffset !== null
          ? inputBase + participant.executorOffset : inputBase;
        deferredBlocks.push({
          participant: participant.participant,
          inputBase,
          executionInput,
          local,
          controller,
          offsets: computeOffsets,
        });
      }
    }
    if (publishedComputeOffsets.length > 0
        && (globalThis as { process?: { env?: Record<string, string> } }).process
          ?.env?.SOLIDC_DEBUG_ECRECOVER_READINESS === '1') {
      // Which participant block owns the compute side-car slots, what the composer decided about them, and
      // what actually sits there. `deferredBlocks` staying empty is only meaningful together with these: a
      // cache hit refreshes the slots without consulting the controller, while an empty `computeOffsets` or a
      // non-mutable input means nothing was ever placed at the offsets the program reads.
      console.error('composer-compute-slots', {
        participant: participant.participant,
        cacheHit: cachedCompute?.graphKey === deferredComputeGraphKey,
        controllerDefined: (local as DeferredComputeBuilder).__messageBusDeferredCompute !== undefined,
        publishedComputeOffsets,
        computeOffsets,
        slots: publishedComputeOffsets.map((offset) => ({
          offset,
          inputCapability: local.inputs[offset]?.token?.nft?.capability ?? null,
          inputCategory: String(local.inputs[offset]?.token?.category ?? '').slice(0, 16),
          outputCapability: local.outputs[offset]?.token?.nft?.capability ?? null,
          outputCategory: String(local.outputs[offset]?.token?.category ?? '').slice(0, 16),
        })),
      });
    }
    // Diagnostic (`SOLIDC_DEBUG_SLOT_LOCKS=1`): every slot whose input and output locking bytecode disagree.
    // A covenant-equality check inside the program compares a slot with its preserved copy and fails when the
    // two locks differ only in an address embedded in both, so the mismatching slots are the whole evidence.
    // Only mismatches print, and the printed windows straddle the first differing byte.
    if ((globalThis as { process?: { env?: Record<string, string> } }).process
      ?.env?.SOLIDC_DEBUG_SLOT_LOCKS === '1') {
      const mismatches = (participant.blockLayout?.slots ?? []).flatMap((slot) => {
        const inputLock = local.inputs[slot.offset]?.unlocker?.generateLockingBytecode?.();
        const output = local.outputs[slot.offset];
        if (!inputLock || !(output?.to instanceof Uint8Array)) return [];
        const inputHex = binToHex(inputLock);
        const outputHex = binToHex(output.to);
        if (inputHex === outputHex) return [];
        const firstDifference = [...inputHex].findIndex((nibble, index) => nibble !== outputHex[index]);
        return [{
          kind: slot.kind,
          offset: slot.offset,
          slotIndex: slot.slotIndex,
          inputBytes: inputLock.length,
          outputBytes: output.to.length,
          firstDifference,
          inputSlice: firstDifference < 0 ? inputHex.slice(0, 96)
            : inputHex.slice(Math.max(0, firstDifference - 40), firstDifference + 56),
          outputSlice: firstDifference < 0 ? outputHex.slice(0, 96)
            : outputHex.slice(Math.max(0, firstDifference - 40), firstDifference + 56),
        }];
      });
      if (mismatches.length > 0) {
        console.error('composer-slot-lock-mismatch', {
          participant: participant.participant,
          slots: mismatches.slice(0, 12),
        });
      }
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_RETURN_LAYOUT === '1') {
      const returnSlot = participant.blockLayout!.slots.find((slot) => slot.kind === 'returnEvent');
      const returnOutput = returnSlot ? local.outputs[returnSlot.offset] : undefined;
      const returnLock = returnOutput?.to;
      console.error('atomic-local-return-layout', JSON.stringify({
        participant: participant.participant,
        contract: participant.artifact.contractName,
        returnSlot,
        suppliedBlob: returnBlob && binToHex(returnBlob),
        suppliedCommitment: returnCommitment && binToHex(returnCommitment),
        atSlot: returnOutput && {
          lockingBytecode: binToHex(typeof returnLock === 'string'
            ? addressToLockScript(returnLock) : returnLock!),
          category: returnOutput.token?.category,
          capability: returnOutput.token?.nft?.capability,
          commitment: returnOutput.token?.nft?.commitment,
        },
        immutableCandidates: local.outputs.flatMap((output, index) =>
          output.token?.nft?.capability === 'none' ? [{
            index,
            lockingBytecode: binToHex(typeof output.to === 'string'
              ? addressToLockScript(output.to) : output.to),
            category: output.token.category,
            commitment: output.token.nft.commitment,
          }] : []),
      }));
    }
    const localIncomplete = (local as TransactionBuilder & {
      __messageBusIncompleteDynamicChunks?: readonly {
        variable: string; resolved: number; total: number;
      }[];
    }).__messageBusIncompleteDynamicChunks ?? [];
    for (const variable of localIncomplete) {
      incompleteDynamicChunks.push({
        participant: participant.participant,
        ...variable,
      });
    }
    if (participant.executionKind === 1 && participant.executorOffset !== null) {
      const executorInput = local.inputs[participant.executorOffset];
      if (!executorInput) throw new Error('messageBus: delegate executor input is absent from its published slot');
      local.outputs[participant.executorOffset] = {
        to: executorInput.unlocker.generateLockingBytecode(),
        amount: executorInput.satoshis,
        ...(executorInput.token && { token: executorInput.token }),
      };
    }
    // Stateful builders normally stamp the provider's current Unix time, but a selected blockhash row can
    // require height-mode CLTV (< 500M). Taking a numeric maximum silently changes the height requirement
    // into timestamp mode and makes the otherwise valid oracle spend fail by type. Preserve a concrete
    // height-mode requirement over ambient timestamp defaults. If another participant genuinely requires a
    // timestamp lock as well, final VM preflight still rejects the inherently incompatible composition.
    const aggregateIsHeight = aggregate.locktime > 0 && aggregate.locktime < 500_000_000;
    const localIsHeight = local.locktime > 0 && local.locktime < 500_000_000;
    if (local.locktime > 0) {
      if (localIsHeight && !aggregateIsHeight) aggregate.locktime = local.locktime;
      else if (localIsHeight === aggregateIsHeight) {
        aggregate.locktime = Math.max(aggregate.locktime, local.locktime);
      }
    }
    while (local.outputs.length < blockSize && local.outputs.length < local.inputs.length) {
      padUnpairedBlockInput(local);
    }
    if (local.inputs.length !== blockSize || local.outputs.length !== blockSize) {
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
        const describeInput = (input: typeof local.inputs[number], index: number): Record<string, unknown> => ({
          index,
          lockingBytecode: binToHex(input.unlocker.generateLockingBytecode()),
          category: input.token?.category,
          commitment: input.token?.nft?.commitment,
        });
        const describeOutput = (output: typeof local.outputs[number], index: number): Record<string, unknown> => ({
          index,
          lockingBytecode: binToHex(typeof output.to === 'string'
            ? addressToLockScript(output.to) : output.to),
          category: output.token?.category,
          commitment: output.token?.nft?.commitment,
        });
        console.error('atomic-local-block-suffix', {
          inputTail: local.inputs.slice(Math.max(0, blockSize - 8)).map((input, index) =>
            describeInput(input, Math.max(0, blockSize - 8) + index)),
          outputTail: local.outputs.slice(Math.max(0, blockSize - 8), blockSize + 8)
            .map((output, index) => describeOutput(output, Math.max(0, blockSize - 8) + index)),
          overflowOutputs: local.outputs.slice(blockSize).map((output, index) =>
            describeOutput(output, blockSize + index)),
        });
        console.error('atomic-local-block-mismatch', {
          participant: participant.participant,
          executionKind: participant.executionKind,
          expected: blockSize,
          layout: participant.blockLayout,
          inputs: local.inputs.map((input, index) => ({
            index, lockingBytecode: binToHex(input.unlocker.generateLockingBytecode()),
            category: input.token?.category, commitment: input.token?.nft?.commitment,
          })),
          outputs: local.outputs.map((output, index) => ({
            index, lockingBytecode: binToHex(typeof output.to === 'string'
              ? addressToLockScript(output.to) : output.to),
            category: output.token?.category, commitment: output.token?.nft?.commitment,
          })),
        });
      }
      throw new Error(
        `messageBus: participant ${participant.participant} built ${local.inputs.length}/${local.outputs.length} `
          + `slots, expected balanced block size ${blockSize}`,
      );
    }
    // Settle unchanged chunk twins before deriving physical output claims. Restoring them only before
    // publication can displace a predecessor after its layout-resolver claim has already been frozen.
    reassertRoutedReadOnlyDynamicChunkTwins(local.outputs, local.inputs, selectedReadOnlyDynamicLocks);
    // `fixedSuffix` prevents compaction of the participant, but it does not erase the compiler-published
    // trailing band. Computed chunk claims are validated against that band before `minimumActualSize` is forced
    // back to the full block below; using blockSize here turns the valid range into an empty interval.
    const fixedSize = Math.min(participant.blockLayout!.trailingBase ?? blockSize,
      terminalConditionalReturnBase(participant.blockLayout!) ?? blockSize);
    // A concrete route can materialize its own value chunks without a graph-transported production. Its
    // provisional absolute witness and the complete physical chunk run are then the layout claim; relying only
    // on transported productions left an active witness with no band in the transaction-global resolver.
    if (pendingValueChunkClaim === undefined) {
      const unlocker = local.inputs[0]?.unlocker as {
        abiFunction?: { inputs?: readonly { name: string }[] }; params?: readonly unknown[];
      } | undefined;
      const witnessIndex = unlocker?.abiFunction?.inputs?.findIndex(
        (input) => input.name === '__internal__valueChunkOutputBase',
      ) ?? -1;
      const witness = witnessIndex < 0 ? undefined : unlocker?.params?.[witnessIndex];
      if (layoutWitnessIsActiveCoordinate(witness)) {
        // A pooled row can grow past the inline value limit only after its second invocation. Its local
        // builder then publishes the concrete chunk (including resource identity, lock, category and
        // commitment), while the route's provisional base still names the pre-growth placeholder. Accept
        // that exact materialization as another candidate coordinate; the physical run check below remains
        // the authority and rejects competing bands.
        const materializedStarts = (localComputedChunkMetadata.__messageBusComputedValueChunks ?? [])
          .flatMap((claim) => {
            if (claim.resourcePart !== 'chunk:0' || claim.categoryId === undefined
              || claim.commitment === undefined || claim.lockingBytecode === undefined) return [];
            const offset = claim.offset - participantInputBase;
            const output = local.outputs[offset];
            const lock = output === undefined ? undefined
              : typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
            return output?.token?.category?.toLowerCase() === claim.categoryId.toLowerCase()
              && output.token.nft?.commitment?.toLowerCase() === claim.commitment.toLowerCase()
              && lock !== undefined && binToHex(lock) === binToHex(claim.lockingBytecode)
              ? [offset] : [];
          });
        const startCandidates = [...new Set([
          Number(witness), Number(witness) - participantInputBase, ...materializedStarts,
        ])].filter((offset) => Number.isSafeInteger(offset)
          && offset >= fixedSize && offset < blockSize && valueChunkSlots.some((slot) => slot.offset === offset));
        const category = local.inputs[0]?.token?.category?.toLowerCase();
        const candidateRuns = startCandidates.flatMap((start) => {
          const first = local.outputs[start];
          const lock = first === undefined ? undefined
            : typeof first.to === 'string' ? addressToLockScript(first.to) : first.to;
          if (category === undefined || lock?.length !== 35 || lock[0] !== 0xaa || lock[1] !== 0x20
            || lock[34] !== 0x87) return [];
          let count = 0;
          for (let offset = start; offset < blockSize; offset += 1) {
            const output = local.outputs[offset];
            const outputLock = output === undefined ? undefined
              : typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
            const commitment = output?.token?.nft?.commitment;
            if (!valueChunkSlots.some((slot) => slot.offset === offset)
              || output?.token?.category?.toLowerCase() !== category || output.token.amount !== 0n
              || output.token.nft?.capability !== 'mutable' || commitment === undefined
              || !isValidComputedValueChunkCommitmentEncoding(commitment)
              || valueChunkIndexFromCommitment(commitment) !== count
              || outputLock === undefined || binToHex(outputLock) !== binToHex(lock)) break;
            count += 1;
          }
          return count === 0 ? [] : [{ start, count }];
        });
        if (candidateRuns.length === 1) {
          pendingValueChunkClaim = {
            localSlotOffset: candidateRuns[0]!.start,
            chunkCount: candidateRuns[0]!.count,
            collection: 'valueChunk',
          };
        }
      }
    }
    const computedValueChunkMetadata = localComputedChunkMetadata;
    const observedContinuationClaims = orderedContinuationClaims.flatMap((claim) => Array.from(
      { length: claim.chunkCount }, (_, chunkIndex) => ({
        offset: participantInputBase + claim.bandOffset + chunkIndex,
        resourceIdentity: claim.producerClaim.resourceIdentity,
        resourcePart: `chunk:${chunkIndex}`,
      }),
    ));
    const computedValueChunkClaims = transportedContinuationSpanClaims([
      ...(computedValueChunkMetadata.__messageBusComputedValueChunkSpanClaims ?? []),
      ...(computedValueChunkMetadata.__messageBusComputedValueChunks ?? []),
    ], observedContinuationClaims);
    const computedMinimumActualSize = Math.max(minimumActualSizeForComputedValueChunkClaims(
      participant.participant,
      graph.layout.participantInputs[participant.participant],
      fixedSize,
      blockSize,
      computedValueChunkClaims,
    ), pendingValueChunkClaim === undefined ? 0
      : pendingValueChunkClaim.localSlotOffset + pendingValueChunkClaim.chunkCount);
    const minimumActualSize = participant.blockLayout!.fixedSuffix
      ? blockSize : computedMinimumActualSize;
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1'
        && (computedValueChunkClaims.length > 0 || participant.routeInputs.some(
          (input) => input.name === '__internal__valueChunkOutputBase',
        ))) {
      console.error('atomic-computed-value-chunk-span', {
        participant: participant.participant,
        participantBase: graph.layout.participantInputs[participant.participant],
        fixedSize,
        maximumSize: blockSize,
        minimumActualSize,
        spanClaimCount: computedValueChunkMetadata.__messageBusComputedValueChunkSpanClaims?.length ?? 0,
        materializedClaimCount: computedValueChunkMetadata.__messageBusComputedValueChunks?.length ?? 0,
        claims: computedValueChunkClaims.map((claim) => ({
          offset: claim.offset,
          resourceIdentity: claim.resourceIdentity,
          resourcePart: claim.resourcePart,
        })),
      });
    }
    let actualSize = blockSize;
    while (actualSize > minimumActualSize) {
      const input = local.inputs[actualSize - 1];
      const output = local.outputs[actualSize - 1];
      const outputLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
      if (input.token !== undefined || output.token !== undefined
          || binToHex(input.unlocker.generateLockingBytecode()) !== BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX
          || binToHex(outputLockingBytecode) !== '51') break;
      actualSize -= 1;
    }
    if (actualSize < blockSize) {
      local.inputs.splice(actualSize, blockSize - actualSize);
      local.outputs.splice(actualSize, blockSize - actualSize);
    }
    const stateInputUnlocker = local.inputs[0].unlocker as Unlocker & {
      abiFunction?: { blockLayout?: NonNullable<typeof participant.blockLayout> };
    };
    if (stateInputUnlocker.abiFunction?.blockLayout !== undefined) {
      const effectiveLayout = participant.blockLayout!;
      const effectiveSlots = effectiveLayout.slots
        .filter((slot) => slot.offset < actualSize)
        .map((slot) => slot.kind === 'returnEvent' && returnBlob === undefined
          ? { ...slot, conditional: true }
          : slot);
      const lifecycleTailCount = split?.funders.length ?? merge?.consumedMasters.length ?? 0;
      const lifecyclePrefix = participant.lifecycle === undefined ? 0
        : (effectiveLayout.slots.filter((slot) =>
          slot.kind === 'dataNft' || slot.kind === 'readOnlyDataNft').length);
      const lifecycleTrailingBase = 1 + lifecyclePrefix;
      const lifecycleTailSlots = Array.from(
        { length: lifecycleTailCount }, (_, index) => ({
          kind: merge === undefined ? 'trailing' as const : 'lifecycleMaster' as const,
          offset: lifecycleTrailingBase + index,
        }),
      );
        // Identity anchors / executor suffixes live in fixedSuffix after the runtime trailing band.
        // Capacity must not absorb those slots: `actualSize - fixedSize` alone folds a +1 identity
        // anchor into trailing (measured FakeToken 87→88, capacity 64→65) and the OUTPUTBYTECODE
        // lock loop then EQUALVERIFYs the SCID identity lock against a trailing/chunk expectation.
      const fixedSuffix = effectiveLayout.fixedSuffix ?? 0;
      const trailingCapacity = trailingCapacityExcludingFixedSuffix({
        blockSize: actualSize,
        trailingBase: fixedSize,
        fixedSuffix,
      });
      stateInputUnlocker.abiFunction = {
        ...stateInputUnlocker.abiFunction,
        blockLayout: {
          ...effectiveLayout,
          blockSize: actualSize,
          slots: [...effectiveSlots, ...lifecycleTailSlots],
          ...(lifecycleTailCount === 0 ? {} : { trailingBase: lifecycleTrailingBase }),
          trailingCapacity,
          fixedSuffix,
        },
      };
    }
    actualSizes.push(actualSize);
    {
      // The participant publishes dynamic-input witnesses in aggregate coordinates. Convert them back to
      // local offsets for layout claims; the layout authority below publishes the resolved absolute values.
      const publishedBase = graph.layout.participantInputs[participant.participant] ?? 0;
      const masterUnlocker = local.inputs[0]?.unlocker as {
        abiFunction?: AbiFunction;
        params?: unknown[];
        syncEncodedArgsFromParams?: (onlyIndices?: readonly number[]) => void;
      } | undefined;
      const chunkIndex = masterUnlocker?.abiFunction?.inputs?.findIndex(
        (input) => input.name === '__internal__dynamicChunkInputBase',
      ) ?? -1;
      const localChunkBase = chunkIndex < 0 ? undefined : masterUnlocker?.params?.[chunkIndex];
      // Layout claims use local resource offsets; their resolved witnesses name aggregate coordinates.
      // The unlocker documents `syncEncodedArgsFromParams` for exactly this: it re-encodes the mutated slot and
      // drops the cached unlocking bytecode. Without the resync the edit is invisible and the published script
      // keeps addressing the participant-local coordinate.
      //   `__internal__dynamicChunkInputBase`  - read with OP_UTXOBYTECODE (measured: a funder instead of the
      //                                          chunk NFT).
      //   `__internal__vmapBatchPredOut_<slot>` - read with OP_OUTPUTBYTECODE (measured: the displaced
      //                                          predecessor's P' output instead of this participant's).
      // Tagged absent/inactive sentinels stay untouched. Dynamic-input witnesses already include publishedBase;
      // provisional PredOut witnesses still need their exact local resource output resolved below.
      const relocatable: Array<{ index: number; name: string; limit: number }> = [];
      if (chunkIndex >= 0) relocatable.push({ index: chunkIndex, name: 'dynamicChunkInputBase', limit: local.inputs.length });
      for (const [index, input] of (masterUnlocker?.abiFunction?.inputs ?? []).entries()) {
        if (/^__internal__vmapBatchPredOut_\d+$/.test(input.name)) {
          relocatable.push({ index, name: input.name.replace('__internal__', ''), limit: local.outputs.length });
        }
      }
      const publishedRelocations: Array<{ name: string; from: string; to: string }> = [];
      const resyncedIndices: number[] = [];
      // A `PredOut` witness names the output carrying the re-pointed predecessor (P') of an inserted node. The
      // batch planner publishes it in the CONCRETE callsite's coordinate space (measured: `approve` declares 4,
      // the first slot after its own four-slot block) while the covenant reads `tx.outputs[PredOut]` in the
      // PHYSICAL route frame, where the same P' is materialized in the route's trailing band (measured: block
      // offset 23). Absolute assignment goes through ONE canonical layout-resolver pass per participant so
      // dyn / PredOut / value-chunk absolutes cannot drift (historical 203 vs 222; MDV1 pad 163 vs entry 161).
      const commitmentHex = (value: unknown): string => value instanceof Uint8Array ? binToHex(value)
        : typeof value === 'string' ? value : '';
      const predOutIndexByName = new Map<string, number>();
      for (const [index, input] of (masterUnlocker?.abiFunction?.inputs ?? []).entries()) {
        if (/^__internal__vmapBatchProof_\d+$/.test(input.name)) {
          predOutIndexByName.set(input.name, index);
        }
      }
      const participantCategory = participant.artifact.stateLayout === undefined
        ? undefined : (local.inputs[0]?.token?.category ?? undefined);
        // Physical route trailing band (not concrete handler layout). Prefer the layout already
        // applied to this participant frame (see effectiveLayout sync above).
      const routeTrailingBase = participant.blockLayout?.trailingBase;
      const routeTrailingCapacity = participant.blockLayout?.trailingCapacity;
      const predOutPhysical: Array<{
        index: number;
        name: string;
        witnessName: string;
        physicalLocalOffset: number;
      }> = [];
      let dynLocalBase: number | undefined;
      for (const candidate of relocatable) {
        const value = masterUnlocker?.params?.[candidate.index];
        // Discover claims for every publishedBase including 0 (participant 0 / atomic physical layout).
        if (masterUnlocker?.params === undefined) continue;
        if (candidate.name === 'dynamicChunkInputBase') {
          if (!layoutWitnessIsActiveCoordinate(value)) continue;
          const localIndex = value - BigInt(publishedBase);
          if (localIndex < 0n || localIndex >= BigInt(candidate.limit)) {
            throw layoutInvariantError({
              invariantId: 'dynamic-chunk-input-outside-participant',
              participant: participant.participant,
              resource: candidate.name,
              message: 'Published dynamic-storage input does not belong to its participant block',
            });
          }
          dynLocalBase = Number(localIndex);
          continue;
        }
        const slot = /(\d+)$/.exec(candidate.name)?.[1];
        const proofIndex = slot === undefined ? undefined : predOutIndexByName.get(`__internal__vmapBatchProof_${slot}`);
        const proof = proofIndex === undefined ? undefined : masterUnlocker.params[proofIndex];
        const targetSlot = (() => {
          const name = `__internal__vmapBatchSlot_${slot}`;
          const at = masterUnlocker.abiFunction?.inputs?.findIndex((input) => input.name === name) ?? -1;
          return at < 0 ? undefined : commitmentHex(masterUnlocker.params?.[at]);
        })();
        const predecessor = typeof proof === 'bigint' && proof >= 0n && proof < BigInt(local.inputs.length)
          ? local.inputs[Number(proof)] : undefined;
        const predecessorCommitment = commitmentHex(predecessor?.token?.nft?.commitment);
        const pendingInsert = masterUnlocker.abiFunction !== undefined && slot !== undefined
            && isPendingBatchPredecessor(
              masterUnlocker.abiFunction, masterUnlocker.params, Number(slot), predecessorCommitment,
            );
          // A route INSERT can retain -1 until its P' output exists in this physical frame. Other negative
          // sentinels remain inactive; non-negative witnesses must still address the participant-local frame.
        // The provisional witness can already be transaction-absolute after a preceding compose pass. Validate
        // both coordinate conventions against this participant's output span; content matching below remains the
        // authority for the final physical output, so an in-range hint never chooses its own destination.
        const localCoordinate = layoutWitnessIsActiveCoordinate(value)
          && value < BigInt(candidate.limit);
        const absoluteCoordinate = layoutWitnessIsActiveCoordinate(value)
          && value >= BigInt(publishedBase)
          && value < BigInt(publishedBase + candidate.limit);
        if ((!layoutWitnessIsActiveCoordinate(value) && !pendingInsert)
          || (layoutWitnessIsActiveCoordinate(value) && !localCoordinate && !absoluteCoordinate)) {
          // A published PredOut that is neither participant-local nor inside the published aggregate span cannot
          // name an output this participant frame carries: the frame compacts away the unused trailing pads, so a
          // coordinate past the compacted size has no output to read. Name the geometry instead of failing blind.
          if ((globalThis as { process?: { env?: Record<string, string> } }).process
            ?.env?.SOLIDC_DEBUG_PREDOUT === '1' && /vmapBatchPredOut_\d+$/.test(candidate.name)) {
            console.error('predout-skip', JSON.stringify({
              participant: participant.participant,
              contractName: participant.artifact.contractName,
              abiFunction: masterUnlocker.abiFunction?.name,
              name: candidate.name, value: String(value),
              active: layoutWitnessIsActiveCoordinate(value), pendingInsert,
              localCoordinate, absoluteCoordinate,
              localLimit: candidate.limit, publishedBase, routeTrailingBase,
              localInputs: local.inputs.length, localOutputs: local.outputs.length,
              planBlockSize: participant.blockLayout?.blockSize,
            }));
          }
          continue;
        }
        let physicalLocalOffset: number | undefined;
        const predecessorLock = predecessor === undefined ? ''
          : binToHex(predecessor.unlocker.generateLockingBytecode()).toLowerCase();
        const samePredecessorLock = (output: Output): boolean =>
          binToHex(typeof output.to === 'string' ? addressToLockScript(output.to) : output.to)
            .toLowerCase() === predecessorLock;
        if (targetSlot !== undefined && predecessorCommitment.length >= 128) {
          const plannedPredecessor = `${predecessorCommitment.slice(0, 64)}${targetSlot}`
              + predecessorCommitment.slice(128);
          const found = local.outputs.findIndex((output) => output.token?.category === participantCategory
              && samePredecessorLock(output)
              && commitmentHex(output.token?.nft?.commitment).toLowerCase() === plannedPredecessor.toLowerCase());
          if (found >= 0) physicalLocalOffset = found;
        }
        if (physicalLocalOffset === undefined && predecessorCommitment.length >= 128) {
          // Several inserted targets can share one old gap. Its single rewritten predecessor points to the
          // first sorted target, not necessarily this witness's target, so the exact-next lookup above cannot
          // resolve later targets. Match the preserved predecessor identity (entry bytecode, old slot, value)
          // while allowing only its next pointer to change. The bytecode separates collections sharing a master.
          const matches = local.outputs.flatMap((output, index) => {
            const commitment = commitmentHex(output.token?.nft?.commitment).toLowerCase();
            return output.token?.category === participantCategory
              && samePredecessorLock(output)
              && commitment.length === predecessorCommitment.length
              && commitment.slice(0, 64) === predecessorCommitment.slice(0, 64).toLowerCase()
              && commitment.slice(128) === predecessorCommitment.slice(128).toLowerCase()
              ? [index] : [];
          });
          if (matches.length === 1) physicalLocalOffset = matches[0];
        }
        if (physicalLocalOffset === undefined && routeTrailingBase !== undefined) {
          physicalLocalOffset = routeTrailingBase;
        }
        if (physicalLocalOffset === undefined) {
          // transaction layout authority: never invent PredOut as concreteLocal+publishedBase — fail closed.
          throw layoutInvariantError({
            invariantId: 'pred-out-physical-unresolved',
            message: `PredOut '${candidate.name}' has no physical trailing offset for participant `
                + `${participant.participant}`,
            participant: participant.participant,
            resource: candidate.name,
            expectedOutput: routeTrailingBase,
            actualOutput: Number(value),
          });
        }
        // R5/layout-sentinel / PredOut: physicalLocalOffset is the only PredOut authority; do not thread unlocker
        // concrete values as a parallel concreteLocalSlot into resolve.
        predOutPhysical.push({
          index: candidate.index,
          name: candidate.name,
          witnessName: `__internal__${candidate.name}`,
          physicalLocalOffset,
        });
      }
      // A batch can produce its continuation chunks inside its own physical frame, without a
      // graph-transported production. In that case the local builder publishes exact output claims;
      // feed those same physical bands to the transaction layout authority. Never infer a band from
      // the provisional ABI coordinate alone.
      const valueChunkParamIndex = masterUnlocker?.abiFunction?.inputs?.findIndex(
        (input) => input.name === '__internal__valueChunkOutputBase',
      ) ?? -1;
      const valueChunkParam = valueChunkParamIndex < 0
        ? undefined : masterUnlocker?.params?.[valueChunkParamIndex];
      const localValueChunkBands: Array<{
        bandOffset: number; chunkCount: number; resourceIdentity: string;
      }> = [];
      if (pendingValueChunkClaim === undefined && layoutWitnessIsActiveCoordinate(valueChunkParam)
        && (dynLocalBase !== undefined || predOutPhysical.length > 0)) {
        const byResource = new Map<string, Array<{ index: number; offset: number }>>();
        for (const claim of computedValueChunkMetadata.__messageBusComputedValueChunks ?? []) {
          const identity = claim.resourceIdentity === undefined
            ? undefined : canonicalValueChunkProducerResourceIdentity(claim.resourceIdentity);
          const part = /^chunk:(0|[1-9][0-9]*)$/.exec(claim.resourcePart ?? '');
          if (identity === undefined || identity !== claim.resourceIdentity || part === null
            || claim.categoryId === undefined || claim.commitment === undefined
            || claim.lockingBytecode === undefined) {
            throw layoutInvariantError({
              invariantId: 'local-value-chunk-claim-incomplete', participant: participant.participant,
              resource: 'valueChunkOutputBase',
              message: 'Active local value-chunk witness lacks a complete physical output claim',
            });
          }
          const offset = claim.offset - publishedBase;
          const output = local.outputs[offset];
          const outputLock = output === undefined ? undefined
            : typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
          if (output?.token?.category.toLowerCase() !== claim.categoryId.toLowerCase()
            || output.token.nft?.capability !== 'mutable'
            || output.token.nft.commitment.toLowerCase() !== claim.commitment.toLowerCase()
            || outputLock === undefined || binToHex(outputLock) !== binToHex(claim.lockingBytecode)) {
            throw layoutInvariantError({
              invariantId: 'local-value-chunk-output-mismatch', participant: participant.participant,
              resource: identity,
              message: 'Local value-chunk claim does not match its physical output',
            });
          }
          const rows = byResource.get(identity) ?? [];
          rows.push({ index: Number(part[1]), offset });
          byResource.set(identity, rows);
        }
        for (const [resourceIdentity, rows] of byResource) {
          rows.sort((a, b) => a.index - b.index);
          if (rows.some((row, index) => row.index !== index
            || row.offset !== rows[0]!.offset + index)) {
            throw layoutInvariantError({
              invariantId: 'local-value-chunk-band-invalid', participant: participant.participant,
              resource: resourceIdentity,
              message: 'Local value-chunk outputs are not a complete contiguous band',
            });
          }
          localValueChunkBands.push({
            bandOffset: rows[0]!.offset, chunkCount: rows.length, resourceIdentity,
          });
        }
        localValueChunkBands.sort((a, b) => a.bandOffset - b.bandOffset);
        // The route's provisional coordinate can name its concrete handler band, which need not be
        // the physical continuation band after batch packing. The authenticated outputs above, and
        // the shared layout resolve below, are the authority for the absolute witness.
      }
      const valueChunkBands = pendingValueChunkClaim === undefined
        ? localValueChunkBands : orderedContinuationClaims.length > 0
          ? orderedContinuationClaims.map((claim) => ({
            bandOffset: claim.bandOffset,
            chunkCount: claim.chunkCount,
            resourceIdentity: claim.producerClaim.resourceIdentity,
          }))
          // A local continuation has no transported resource claim. The validated physical run above
          // is nevertheless an owned band and must participate in the same absolute layout resolve.
          : [{
            bandOffset: pendingValueChunkClaim.localSlotOffset,
            chunkCount: pendingValueChunkClaim.chunkCount,
            resourceIdentity: pendingValueChunkClaim.collection,
          }];
      const firstValueChunkBand = valueChunkBands[0];
      if (
        masterUnlocker?.params !== undefined
          && routeTrailingBase !== undefined
          && (
            dynLocalBase !== undefined
            || predOutPhysical.length > 0
            || pendingValueChunkClaim !== undefined
          )
      ) {
        const frameBlockSize = Math.max(
          participant.blockLayout?.blockSize ?? 0,
          local.outputs.length,
          local.inputs.length,
          routeTrailingBase + 1,
          pendingValueChunkClaim?.localSlotOffset !== undefined
            ? pendingValueChunkClaim.localSlotOffset + (pendingValueChunkClaim.chunkCount || 1)
            : 0,
          ...valueChunkBands.map((band) => band.bandOffset + band.chunkCount),
          ...predOutPhysical.map((pred) => pred.physicalLocalOffset + 1),
        );
        // Resolve each participant's dynamic, entry, value-chunk, and PredOut layout together.
        const inferredDynCount = dynLocalBase === undefined ? undefined
          : (() => {
            const nextOccupied = predOutPhysical[0]?.physicalLocalOffset
                ?? pendingValueChunkClaim?.localSlotOffset;
            return nextOccupied === undefined
              ? 0
              : Math.max(0, nextOccupied - routeTrailingBase);
          })();
          // Items 5–7/11–12: stable selector id + plan digest + budgets + phase freeze (results consumed).
        const eligibleHandler = participant.artifact.messageBus?.handlers?.find((h) => h.eligible);
        const handlerSelector = eligibleHandler?.selector
            ?? participant.artifact.messageBus?.selector
            ?? `participant:${participant.participant}`;
        const publishedBudgets = participant.artifact.messageBus?.resourceBudgets;
        const kernelAuthority = authorizeComposeParticipantLayout({
          participant: participant.participant,
          handlerSelector,
          handlerDiagnosticName: eligibleHandler?.name ?? participant.artifact.contractName,
          publishedBase,
          claimCount: predOutPhysical.length + orderedContinuationClaims.length,
          dynamicWrites: orderedContinuationClaims.length > 1
            ? orderedContinuationClaims.map((claim) => claim.collectionSignature)
            : pendingValueChunkClaim?.collection ? [pendingValueChunkClaim.collection] : [],
          selectedResources: orderedContinuationClaims.length > 1
            ? orderedContinuationClaims.map((claim) => claim.producerClaim.resourceIdentity)
            : pendingValueChunkClaim?.collection ? [pendingValueChunkClaim.collection] : [],
          // published resource budgets: prefer compiler-published multi-axis budgets; kernel fails closed if absent.
          requirePublishedBudgets:
              participant.artifact.messageBus?.convention === 'kernel-row-loop',
          budgets: publishedBudgets === undefined ? undefined : {
            maximumRows: publishedBudgets.maximumRows,
            maximumParticipants: publishedBudgets.maximumParticipants,
            maximumBlobBytes: publishedBudgets.maximumBlobBytes,
            maximumDynamicChunks: publishedBudgets.maximumDynamicChunks,
            maximumValueContinuationChunks: publishedBudgets.maximumValueContinuationChunks,
            maximumJournalRecords: publishedBudgets.maximumJournalRecords,
            maximumEvents: publishedBudgets.maximumEvents,
            maximumTransfers: publishedBudgets.maximumTransfers,
            maximumReturnCarriers: publishedBudgets.maximumReturnCarriers,
            maximumExternalEdges: publishedBudgets.maximumExternalEdges,
          },
          valueChunkBands,
        });
          // Stamp digest into relocation log so dropping authorizeComposeParticipantLayout breaks sync metadata.
        publishedRelocations.push({
          name: `__kernel_plan_digest__${kernelAuthority.handlerJoinKey}`,
          from: kernelAuthority.phase.payload.materializationMode,
          to: kernelAuthority.digest,
        });
        // Stamp the KernelExecutionPlan bytecode marker ASM so plan digests cannot be transplanted alone.
        publishedRelocations.push({
          name: `__kernel_plan_bytecode__${kernelAuthority.handlerJoinKey}`,
          from: 'SCKP',
          to: kernelAuthority.bytecodeCommitment,
        });
        // Collect claims after every participant frame is inspected, then resolve once with shared packing.
        const transactionParticipants = plan.participants.map((entry) => ({
          participant: entry.participant,
          contractName: entry.artifact.contractName,
          blockLayout: entry.blockLayout === undefined ? undefined : {
            // The graph manifest, not the compiler's maximum block, defines this pass's physical bases.
            // A repeated owner can compact before a later participant: packing its maximum here shifts
            // every later absolute witness even though the aggregate already uses the compacted span.
            blockSize: graph.callManifest.participants[entry.participant]!.actualSize,
            trailingBase: entry.blockLayout.trailingBase,
            trailingCapacity: trailingCapacityExcludingFixedSuffix({
              blockSize: graph.callManifest.participants[entry.participant]!.actualSize,
              trailingBase: entry.blockLayout.trailingBase,
              fixedSuffix: entry.blockLayout.fixedSuffix,
            }),
            fixedSuffix: entry.blockLayout.fixedSuffix,
            slots: entry.blockLayout.slots ?? [],
          },
        }));
        deferredTransactionParticipants = transactionParticipants;
        const ownershipClaims = [
          ...(inferredDynCount !== undefined && inferredDynCount > 0 ? [{
            participant: participant.participant,
            carrier: 'dynamicState' as const,
            roles: {
              consumeInput: publishedBase + routeTrailingBase,
              produceOutput: publishedBase + routeTrailingBase,
              outputSlot: publishedBase + routeTrailingBase,
            },
            rangeWidth: Math.max(1, inferredDynCount),
          }] : []),
          ...valueChunkBands.map((band) => ({
            participant: participant.participant,
            carrier: 'valueChunk' as const,
            collection: valueChunkBands.length > 1
              ? band.resourceIdentity : pendingValueChunkClaim?.collection ?? band.resourceIdentity,
            roles: { outputSlot: publishedBase + band.bandOffset },
            rangeWidth: band.chunkCount,
          })),
          ...predOutPhysical.map((pred) => ({
            participant: participant.participant,
            carrier: 'sortedBatch' as const,
            collection: pred.witnessName,
            // PredOut references the already-produced P' output; it does not produce a second resource at
            // that coordinate. The paired predOuts claim below retains the exact physical offset authority
            // and participant-boundary validation without colliding with the resource which owns the output.
            roles: {},
          })),
        ];
        deferredLayoutClaims.push({
          participant: participant.participant,
          contractName: participant.artifact.contractName,
          publishedBase,
          blockSize: frameBlockSize,
          trailingBase: routeTrailingBase,
          trailingCapacity: routeTrailingCapacity,
          dynChunkCount: inferredDynCount,
          entryNews: inferredDynCount === undefined ? undefined : [{ entryIndex: 0 }],
          valueChunkBandOffset: firstValueChunkBand === undefined
            ? undefined : firstValueChunkBand.bandOffset - routeTrailingBase,
          valueChunkCollection: pendingValueChunkClaim?.collection ?? firstValueChunkBand?.resourceIdentity,
          valueChunkCount: valueChunkBands.length === 0 ? undefined
            : valueChunkBands.reduce((count, band) => count + band.chunkCount, 0),
          valueChunkBands: valueChunkBands.length > 1 ? valueChunkBands : undefined,
          predOuts: predOutPhysical.map((pred) => ({
            witnessName: pred.witnessName,
            physicalLocalOffset: pred.physicalLocalOffset,
          })),
          ownership: ownershipClaims,
        });
        deferredLayoutApplies.push({
          participant: participant.participant,
          inputs: masterUnlocker.abiFunction?.inputs ?? [],
          params: masterUnlocker.params,
          syncEncodedArgsFromParams: masterUnlocker.syncEncodedArgsFromParams?.bind(masterUnlocker),
          publishedRelocations,
          resyncedIndices,
        });
      } else if (
        masterUnlocker?.params !== undefined
          && routeTrailingBase === undefined
          && (
            dynLocalBase !== undefined
            || predOutPhysical.length > 0
            || pendingValueChunkClaim !== undefined
          )
      ) {
        // Claims exist but trailing geometry is missing — fail closed rather than inventing absolutes.
        throw layoutInvariantError({
          invariantId: 'layout-trailing-missing',
          message: `participant ${participant.participant} needs trailingBase to resolve layout witnesses`,
          participant: participant.participant,
          resource: 'trailingBase',
        });
      }
      if (resyncedIndices.length > 0) masterUnlocker?.syncEncodedArgsFromParams?.(resyncedIndices);
      const rebased = publishedRelocations.find((entry) => entry.name === 'dynamicChunkInputBase')?.to;
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
        console.error('atomic-published-unlocker', JSON.stringify({
          participant: participant.participant,
          contract: participant.artifact.contractName,
          base: publishedBase,
          fn: masterUnlocker?.abiFunction?.name,
          localChunkBase: localChunkBase === undefined ? undefined : String(localChunkBase),
          localFrameLength: local.inputs.length,
          params: masterUnlocker?.params?.length,
          selector: participant.artifact.messageBus?.selector,
          constructorInputs: participant.artifact.constructorInputs.length,
          rebased,
          relocations: publishedRelocations,
          resynced: resyncedIndices.length > 0,
        }));
      }
    }
    // I5 / void `.staticcall()`: message-bus callees are full compilerRoute participants, so STB's
    // plain-staticcall early preserve path is skipped. When every row for this participant is
    // staticcall, the verifier requires a byte-for-byte input→output snapshot (except returnEvent).
    // Apply the mirror after all local rewrites above and immediately before publishing into the aggregate.
    const participantInvocationModes = (participant.invocations ?? [])
      .map((invocationIndex) => graph.plan.invocations[invocationIndex]?.callMode);
    const allStaticcall = participantInvocationModes.length > 0
        && participantInvocationModes.every((mode) => mode === 'staticcall');
    if (allStaticcall) {
      const returnOffsets = new Set(
        (participant.blockLayout?.slots ?? [])
          .filter((slot) => slot.kind === 'returnEvent')
          .map((slot) => slot.offset),
      );
      const limit = Math.min(local.inputs.length, local.outputs.length);
      for (let index = 0; index < limit; index += 1) {
        if (returnOffsets.has(index)) continue;
        const input = local.inputs[index];
        if (!input) continue;
        local.outputs[index] = {
          to: input.unlocker.generateLockingBytecode(),
          amount: input.satoshis,
          ...(input.token && {
            token: {
              ...input.token,
              ...(input.token.nft && { nft: { ...input.token.nft } }),
            },
          }),
        };
      }
    }
    if (envelopeTransport === 'root-route' && participant.participant === 0) {
      const rootInput = local.inputs[0];
      if (!rootInput || !isContractUnlocker(rootInput.unlocker)) {
        throw new Error('messageBus: V5 root participant has no compiler-route master unlocker');
      }
      rootInput.unlocker = withCompilerRouteMessageEnvelope(
        rootInput.unlocker, rootMessageEnvelope!, provider.consensusLimits?.maximumInputBytes ?? 10_000,
      );
    } else if (envelopeTransport === 'proxy-forward' && participant.participant === 0) {
      const executorOffset = participant.executionKind === 1 ? participant.executorOffset : null;
      const proxyInput = local.inputs[0];
      const executorInput = executorOffset === null ? undefined : local.inputs[executorOffset];
      if (executorOffset === null || executorOffset < 1
          || !proxyInput || !isContractUnlocker(proxyInput.unlocker)
          || !executorInput || !isContractUnlocker(executorInput.unlocker)) {
        throw new Error('messageBus: V5 proxy-forward root requires a proxy master and SCB1 executor');
      }
      const maximumInputBytes = provider.consensusLimits?.maximumInputBytes ?? 10_000;
      executorInput.unlocker = withCompilerRouteMessageEnvelope(
        executorInput.unlocker, rootMessageEnvelope!, maximumInputBytes, executorOffset,
      );
      proxyInput.unlocker = withProxyForwardMessageEnvelope(
        proxyInput.unlocker, rootMessageEnvelope!, maximumInputBytes, executorOffset,
      );
    }
    // Restore the selected read-only twins at their input coordinates, as the stream slots above assumed.
    reassertRoutedReadOnlyDynamicChunkTwins(local.outputs, local.inputs, selectedReadOnlyDynamicLocks);
    const routeInputOffset = participant.executionKind === 1 ? participant.executorOffset : 0;
    const routeInput = routeInputOffset === null ? undefined : local.inputs[routeInputOffset];
    recordPhysicalDynamicOutputWitness(
      routeInput, contract.inner, local.outputs, categories[participant.participant], aggregate.outputs.length,
      participant.blockLayout?.trailingBase, selectedDynamicWrites,
    );
    if (participant.executionKind === 1 && routeInputOffset !== null) {
      recordPhysicalPredOutWitnesses(
        routeInputOffset, local.inputs, local.outputs,
        categories[participant.participant], aggregate.outputs.length,
      );
    }
    const block = await shareBlockOracleInput(provider, local, aggregate.inputs.length, keptBlockOracleInputs);
    for (let localIndex = 0; localIndex < block.inputs.length; localIndex++) {
      const input = block.inputs[localIndex];
      registerAggregateInput(input, participant.participant, localIndex, 'participant block');
    }
    aggregate.addInputs(block.inputs);
    aggregate.addOutputs(block.outputs);
  }

  // Resolve all collected claims together, then validate every write before applying any.
  // Unlockers are already on the aggregate by reference — apply+sync mutates the same objects.
  if (deferredLayoutClaims.length > 0) {
    if (deferredTransactionParticipants === undefined) {
      throw new Error('messageBus: deferred layout claims missing transactionParticipants');
    }
    let batchWitnesses: ReturnType<typeof resolveComposeTransactionLayoutAuthority>;
    try {
      batchWitnesses = resolveComposeTransactionLayoutAuthority({
        participants: deferredLayoutClaims,
        transactionParticipants: deferredTransactionParticipants,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw layoutInvariantError({
        invariantId: 'layout-witness-batch-resolve-failed',
        message,
        resource: 'layout-witnesses',
      });
    }
    for (const pending of deferredLayoutApplies) {
      const witnesses = batchWitnesses.witnessesByParticipant.get(pending.participant);
      if (witnesses === undefined) {
        throw layoutInvariantError({
          invariantId: 'layout-witness-batch-projection-missing',
          message: `participant ${pending.participant} missing from batch witness projection`,
          participant: pending.participant,
          resource: 'layout-witnesses',
        });
      }
      try {
        const applied = applyParticipantAbsoluteWitnesses({
          inputs: pending.inputs,
          params: pending.params,
          witnesses,
          participant: pending.participant,
        });
        for (const entry of applied.written) {
          pending.resyncedIndices.push(entry.index);
          pending.publishedRelocations.push({
            name: entry.name, from: entry.from, to: entry.to,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw layoutInvariantError({
          invariantId: 'layout-witness-apply-failed',
          message,
          participant: pending.participant,
          resource: 'layout-witnesses',
        });
      }
      if (pending.resyncedIndices.length > 0) {
        pending.syncEncodedArgsFromParams?.(pending.resyncedIndices);
      }
    }
  }
  const publishedDynamicOutputByUnlocker = new Map<ContractUnlocker, bigint>();
  for (const proof of pendingDynamicOutputWitnesses) {
    const prior = publishedDynamicOutputByUnlocker.get(proof.unlocker);
    if (prior !== undefined && prior !== proof.absolute) {
      throw new Error(`messageBus: conflicting physical dynamic-output bases for ${proof.unlocker.abiFunction.name}`);
    }
    publishedDynamicOutputByUnlocker.set(proof.unlocker, proof.absolute);
    if (proof.unlocker.params[proof.index] === proof.absolute) continue;
    if (!proof.unlocker.syncEncodedArgsFromParams) {
      throw new Error(`messageBus: dynamic-output route ${proof.unlocker.abiFunction.name} cannot resync its witness`);
    }
    proof.unlocker.params[proof.index] = proof.absolute;
    proof.unlocker.syncEncodedArgsFromParams([proof.index]);
  }
  for (const proof of pendingPredOutWitnesses) {
    if (proof.unlocker.params[proof.index] === proof.absolute) continue;
    if (!proof.unlocker.syncEncodedArgsFromParams) {
      throw new Error(`messageBus: predecessor route ${proof.unlocker.abiFunction.name} cannot resync its witness`);
    }
    proof.unlocker.params[proof.index] = proof.absolute;
    proof.unlocker.syncEncodedArgsFromParams([proof.index]);
  }

  // PredOut preflight claims: publish compose PredOut claims for the default preflight layout assert.
  const predOutMap = new Map<number, ReadonlyArray<{
    witnessName: string;
    physicalLocalOffset: number;
    concreteLocalSlot?: number;
  }>>();
  for (const claim of deferredLayoutClaims) {
    if (claim.predOuts !== undefined && claim.predOuts.length > 0) {
      predOutMap.set(claim.participant, claim.predOuts);
    }
  }
  predOutClaimsSlot.current = predOutMap.size > 0 ? predOutMap : undefined;

  const spansMatch = actualSizes.every(
    (size, participant) => size === graph.callManifest.participants[participant].actualSize,
  );
  if (!spansMatch) return { builder: aggregate, actualSizes, incompleteDynamicChunks };

  const verifierDomain = binToHex(MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN);
  const messageEnvelope = rootMessageEnvelope ?? encodeAtomicMessageEnvelope(graph.callManifest);
  const callManifest = encodeAtomicMessageBusCallManifest(graph.callManifest);
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_RETURN_VECTOR === '1') {
    console.error('atomic-graph-summary', JSON.stringify({
      participants: graph.callManifest.participants.map((entry, participant) => ({
        participant,
        base: graph.layout.participantInputs[participant],
        lockingBytecode: entry.lockingBytecode,
        outputLockingBytecode: entry.outputLockingBytecode,
        fixedSize: entry.fixedSize,
        actualSize: entry.actualSize,
        maximumSize: entry.maximumSize,
        lifecycle: entry.lifecycle,
      })),
      rows: graph.callManifest.rows.map((row, index) => ({
        index,
        kind: row.kind,
        mode: row.mode,
        owner: row.owner,
        consumer: row.consumer,
        sourceOffset: row.sourceOffset,
        targetOffset: row.targetOffset,
        subjectHex: row.subjectHex,
        selectorHex: row.selectorHex,
        parent: row.parent,
        depth: row.depth,
        subtreeEnd: row.subtreeEnd,
      })),
    }));
  }
  for (const participant of plan.participants) {
    if (participant.authority === 'direct') continue;
    const contract = byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
    const verifierLock = getMessageBusVerifierLockingBytecodeForArtifact(
      participant.artifact, provider.consensusLimits?.maximumInputBytes ?? 10_000,
    );
    const verifier = (await provider.getUtxosForLockingBytecode(verifierLock)).find((utxo) =>
      utxo.token?.category.toLowerCase() === categories[participant.participant].toLowerCase()
        && utxo.token.nft?.capability === 'mutable'
        && utxo.token.nft.commitment.toLowerCase().startsWith(verifierDomain));
    if (!verifier) {
      throw new Error(
        `messageBus: participant ${participant.participant} has no deployed verifier covenant; `
          + 'deploy with messageBusVerificationInputCount >= 1',
      );
    }
    const verifierProgram = participant.artifact.messageBus!.verifierProgram!;
    // A direct route carries the blob in master param 0, but a proxy master carries only the forwarded
    // selector while its implementation unlocker owns the route arguments. The compiler-planned participant
    // batch is the common canonical source used to build either shape and is what the verifier must bind.
    const batchBlob = participant.batch!.blob;
    const routeContext = graphRouteContext(graph, participant.participant, upgradeStateSuffixes);
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_GRAPH_EMISSIONS === '1') {
      const lengths = Object.fromEntries(Object.entries(routeContext).map(([key, value]) => [
        key, value instanceof Uint8Array ? value.length
          : typeof value === 'bigint' ? value.toString() : typeof value,
      ]));
      console.error('verifier-route-context', JSON.stringify({
        participant: participant.participant, lengths,
      }));
      // The verifier compares each row's manifest arguments against a slice of THIS blob
      // (`require(rowArguments == localBatch.slice(batchArgsStart, batchArgsStart + batchArgsLength))`), so the
      // blob's own row layout must be inspected next to the manifest rows when that comparison fails.
      const blobHex = binToHex(batchBlob);
      console.error('verifier-batch-blob', JSON.stringify({
        participant: participant.participant, bytes: batchBlob.length,
      }));
      for (let offset = 0; offset < blobHex.length; offset += 400) {
        console.error('verifier-batch-blob-hex', `${participant.participant}:${offset / 2}:${blobHex.slice(offset, offset + 400)}`);
      }
      for (const [rowIndex, row] of graph.callManifest.rows.entries()) {
        if (row.owner !== participant.participant && row.consumer !== participant.participant) continue;
        console.error('verifier-manifest-row', JSON.stringify({
          rowIndex, kind: row.kind, owner: row.owner, consumer: row.consumer, mode: row.mode,
          slot: row.slot, sourceOffset: row.sourceOffset, targetOffset: row.targetOffset,
          position: row.position, parent: row.parent, depth: row.depth, subtreeEnd: row.subtreeEnd,
          selectorHex: row.selectorHex,
          subjectHex: row.subjectHex, argsHex: row.argsHex, resultHex: row.resultHex, effectHex: row.effectHex,
        }));
      }
    }
    const verifierGraphArgumentNames = [
      '__internal__graphFixedSize', '__internal__graphBlockSize', '__internal__graphEmissions',
      '__internal__graphCallers', '__internal__graphSettlementBoundary',
      '__internal__graphCompletionPositions', '__internal__graphSettlementTable',
    ] as const;
    const graphInputNames = new Map<string, typeof verifierGraphArgumentNames[number]>([
      ['suppliedFixedSize', '__internal__graphFixedSize'],
      ['suppliedBlockSize', '__internal__graphBlockSize'],
      ['suppliedEmissions', '__internal__graphEmissions'],
      ['suppliedCallers', '__internal__graphCallers'],
      ['suppliedSettlementBoundary', '__internal__graphSettlementBoundary'],
      ['suppliedCompletionPositions', '__internal__graphCompletionPositions'],
      ['suppliedSettlementTable', '__internal__graphSettlementTable'],
    ]);
    const fixedVerifierArguments: Readonly<Record<string, FunctionArgument>> = {
      activeInputIndex: BigInt(graph.layout.participantInputs[participant.participant]),
      expectedLocalRows: BigInt(batchBlob[6]),
      localBatch: batchBlob,
    };
    const verifierArgs = verifierProgram.inputs.map((input): FunctionArgument => {
      const graphName = graphInputNames.get(input.name);
      const argument = graphName === undefined
        ? fixedVerifierArguments[input.name] ?? routeContext[input.name]
        : routeContext[graphName];
      if (argument === undefined) {
        throw new Error(`messageBus: verifier argument '${input.name}' has no compiler-authored value`);
      }
      return argument;
    });
      // The compiler's binding digest has one stable graph-field order. Lifecycle targets are independently
      // bound by the V2 participant output identity and therefore intentionally do not enter this digest.
    const graphArguments = verifierProgram.inputs.flatMap((input, index) =>
      graphInputNames.has(input.name) ? [verifierArgs[index]] : []);
    const bindingDigestParts = [
      sha256(callManifest),
      uint16(graph.layout.participantInputs[participant.participant]),
      uint16(batchBlob[6]),
      sha256(batchBlob),
    ];
    for (const argument of graphArguments) {
      bindingDigestParts.push(typeof argument === 'bigint'
        ? uint16(Number(argument))
        : sha256(argument as Uint8Array));
    }
    // A verifier with no graph arguments binds the participant's physical size instead, which a bound route
    // supplies as `__internal__participantBlockSize`.
    if (graphArguments.length === 0) {
      bindingDigestParts.push(uint16(graph.callManifest.participants[participant.participant].actualSize));
    }
    const bindingDigest = sha256(concat(...bindingDigestParts));
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_RETURN_VECTOR === '1') {
      console.error('atomic-binding-digest', JSON.stringify({
        participant: participant.participant,
        callManifest: { length: callManifest.length, hash: binToHex(sha256(callManifest)) },
        activeInputIndex: graph.layout.participantInputs[participant.participant],
        localRows: batchBlob[6],
        localBatch: { length: batchBlob.length, hash: binToHex(sha256(batchBlob)) },
        graphArguments: graphArguments.map((argument) => typeof argument === 'bigint'
          ? argument.toString()
          : argument instanceof Uint8Array
            ? { length: argument.length, hash: binToHex(sha256(argument)) }
            : String(argument)),
        digest: binToHex(bindingDigest),
      }));
    }
    // Report the verifier arguments by their DECLARED names and actual values. Positional decoding of the
    // unlocking bytecode cannot do this: the script carries non-ABI items too, and a positional mapping
    // mislabelled the 21-byte batch blob as `expectedLocalRows` (ROUND 119's reading was wrong for that
    // reason). This is the only place where the names and the values are both known.
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ENTRY_COUNTS === '1') {
      const describe = (argument: FunctionArgument | undefined): unknown => {
        if (argument === undefined) return null;
        if (typeof argument === 'bigint') return argument.toString();
        const bytes = argument as Uint8Array;
        return { bytes: bytes.length, hex: binToHex(bytes).slice(0, 32) };
      };
      console.error('verifier-arguments', JSON.stringify({
        buildId: peekBuilderBuildId(),
        participant: participant.participant,
        batchBlob: { bytes: batchBlob.length, hex: binToHex(batchBlob).slice(0, 32) },
        arguments: verifierProgram.inputs.map((input, index) => ({
          name: input.name, value: describe(verifierArgs[index]),
        })),
      }));
    }
    const verifierUnlocker = createMessageBusVerifierUnlocker(
      contract.inner, categories[participant.participant], messageEnvelope, verifierArgs, participant.artifact,
    );
    registerAggregateInput(
      verifier, participant.participant, aggregate.inputs.length, 'participant verifier',
    );
    aggregate.addInput(verifier, verifierUnlocker);
    aggregate.addOutput({
      to: verifierLock,
      amount: verifier.satoshis,
      token: {
        category: verifier.token!.category,
        amount: verifier.token!.amount ?? 0n,
        nft: {
          ...verifier.token!.nft!,
          commitment: `${verifier.token!.nft!.commitment.slice(0, 12)}${binToHex(bindingDigest)}`
              + (verifierProgram.lifecycle === true || verifierProgram.splitLifecycle === true
                ? (() => {
                  // Prefer explicit compose supply for retirement: graph planning can omit lifecycle on a
                  // nested callee while lifecycleSelfdestructs still names this participant.
                  const code = selfdestructByParticipant.has(participant.participant)
                    || participant.lifecycle?.kind === 'selfdestruct'
                    ? -32767n
                    : participant.lifecycle?.kind === 'merge'
                      ? -BigInt(participant.lifecycle.count) : BigInt(participant.lifecycle?.count ?? 0);
                  return binToHex(fixedVmNumber(code, 2));
                })()
                : ''),
        },
      },
    });
  }
  registerAggregateInput(feeFunder, -1, aggregate.inputs.length, 'fee funder');
  aggregate.addInputs([feeFunder]);
  aggregate.addBchChangeOutputIfNeeded({
    to: options.changeAddress,
    feeRate: options.feeRate ?? 1,
  });
  if (aggregate.inputs.length !== graph.layout.totalSlots
      || aggregate.outputs.length !== graph.layout.totalSlots) {
    throw new Error(
      'messageBus: composed transaction is not balanced at the fee tail '
        + `(${aggregate.inputs.length} inputs, ${aggregate.outputs.length} outputs)`,
    );
  }

  // The first semantic pass intentionally carries placeholder sidecars so their exact endpoints can be
  // admitted as kind-6 rows. Before those rows exist, the route verifier stops before the compute call and
  // no complete-graph argument can be observed. Resolve only blocks whose sidecar slots are already present
  // in the authenticated manifest; the ordinary effect pass below will add them and rebuild this assembly.
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ENTRY_COUNTS === '1') {
    const needle = 'bac4afa31b5925f5';
    const commitments = aggregate.inputs.map((input) =>
      String(input?.token?.nft?.commitment ?? '').toLowerCase());
    console.error('entry-cospend', JSON.stringify({
      calls: (options.preparedCalls ?? []).map((call) => {
        const described = call as unknown as {
          functionName?: string; logicalFunctionName?: string; selectorHex?: string;
        };
        return described.logicalFunctionName ?? described.functionName
            ?? described.selectorHex ?? '?';
      }).slice(0, 6),
      inputCount: aggregate.inputs.length,
      whitelistEntryInputs: commitments.flatMap((commitment, index) =>
        commitment.includes(needle) ? [index] : []),
      entryLikeInputs: commitments.filter((commitment) => commitment.length >= 128).length,
      entryLikeOutputs: aggregate.outputs.filter((output) =>
        String(output?.token?.nft?.commitment ?? '').length >= 128).length,
    }));
  }
  const resolvableDeferredBlocks = deferredBlocks.filter((block) => block.offsets.every((offset) =>
    graph.callManifest.rows.some((row) => row.kind === 6
        && row.owner === block.participant && row.sourceOffset === offset)));
  if (deferredBlocks.length > 0
      && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ECRECOVER_READINESS === '1') {
    console.error('atomic-deferred-compute-readiness', {
      deferred: deferredBlocks.map((block) => ({
        participant: block.participant,
        offsets: block.offsets,
        executionInput: block.executionInput,
        inputBase: block.inputBase,
        computeRouteArguments: (() => {
          const relativeExecution = block.executionInput - block.inputBase;
          const unlocker = block.local.inputs[relativeExecution]?.unlocker as {
            abiFunction?: { inputs?: readonly { name: string }[] };
            params?: readonly FunctionArgument[];
          } | undefined;
          return unlocker?.abiFunction?.inputs?.flatMap((input, index) => (
            /(?:ecrecover|keccak|InputIndex)/i.test(input.name)
              ? [{ name: input.name, value: String(unlocker.params?.[index]) }] : []
          ));
        })(),
        routedUnlockers: block.local.inputs.flatMap((input, localIndex) => {
          const unlocker = input.unlocker as {
            abiFunction?: { name?: string; inputs?: readonly { name: string }[] };
            params?: readonly FunctionArgument[];
          };
          if (!unlocker.abiFunction) return [];
          return [{
            localIndex,
            function: unlocker.abiFunction.name,
            arguments: unlocker.abiFunction.inputs?.flatMap((argument, index) =>
              /(?:ecrecover|keccak|InputIndex)/i.test(argument.name)
                ? [{ name: argument.name, value: String(unlocker.params?.[index]) }] : []),
          }];
        }),
        mutableInputs: block.local.inputs.flatMap((input, index) =>
          input.token?.nft?.capability === 'mutable' ? [index] : []),
      })),
      rows: graph.callManifest.rows.filter((row) => row.kind === 6).map((row) => ({
        participant: row.owner,
        offset: row.sourceOffset,
        mode: row.mode,
      })),
      invocations: graph.callManifest.rows.filter((row) => row.kind === 0).map((row) => ({
        owner: row.owner,
        consumer: row.consumer,
        mode: row.mode,
        selector: row.selectorHex,
        sourceOffset: row.sourceOffset,
        targetOffset: row.targetOffset,
        subject: row.subjectHex,
        args: row.argsHex,
        result: row.resultHex,
      })),
      keyWitnesses: plan.participants.flatMap((participant) => participant.routeInputs
        .filter((input) => input.name !== 'batchBlob' && !input.name.startsWith('__internal__'))
        .map((input, index) => ({ input, value: participant.batch!.routeWitnesses[index] }))
        .map(({ input, value }) => ({
          participant: participant.participant,
          name: input.name,
          value: value instanceof Uint8Array ? binToHex(value)
            : typeof value === 'bigint' ? value.toString() : value,
        }))),
      participantOneEntries: plan.participants[1]?.blockLayout?.slots
        .filter((slot) => slot.kind === 'entry')
        .map((slot) => {
          const absolute = graph.layout.participantInputs[1] + slot.offset;
          return {
            offset: slot.offset,
            slotIndex: slot.slotIndex,
            commitment: aggregate.inputs[absolute]?.token?.nft?.commitment?.slice(0, 160),
          };
        }),
      participant0Effects: graph.callManifest.rows.filter((row) => row.kind !== 0 && row.owner === 0)
        .map((row) => ({
          kind: row.kind,
          mode: row.mode,
          sourceOffset: row.sourceOffset,
          targetOffset: row.targetOffset,
          subject: row.subjectHex.slice(0, 80),
        })),
      probe54: aggregate.inputs[54] && aggregate.outputs[54] ? {
        slot: plan.participants[0]?.blockLayout?.slots.find((slot) => slot.offset === 54),
        inputLock: binToHex(aggregate.inputs[54].unlocker.generateLockingBytecode()),
        outputLock: binToHex(typeof aggregate.outputs[54].to === 'string'
          ? addressToLockScript(aggregate.outputs[54].to as string) : aggregate.outputs[54].to),
        inputCategory: aggregate.inputs[54].token?.category,
        outputCategory: aggregate.outputs[54].token?.category,
      } : undefined,
      resolvable: resolvableDeferredBlocks.map((block) => block.participant),
    });
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_PARTICIPANT_SLOTS === '1') {
    // Which state/entry slots each participant publishes for THIS composition. An external call's write can
    // only land if the CALLEE participant declares that slot here; otherwise the compiler never lowered the
    // effect for this transaction and the missing write is a lowering gap, not a promotion gap.
    console.error('participant-slots', JSON.stringify(plan.participants.map((candidate) => ({
      participant: candidate.participant,
      base: graph.layout.participantInputs[candidate.participant],
      executionKind: candidate.executionKind,
      slots: (candidate.blockLayout?.slots ?? [])
        .filter((slot) => /entry|state/i.test(slot.kind))
        .map((slot) => ({ kind: slot.kind, offset: slot.offset })),
    }))));
  }
  if (resolvableDeferredBlocks.length > 0) {
    // deferred-compute recipe gate: under recipe, deferred-compute VM discovery is not planner authority. If sidecars are
    // still unresolved, fail closed rather than probing the incomplete graph for witnesses.
    if (!allowsDeferredComputeVmDiscovery()) {
      const unresolvedUnderRecipe = resolvableDeferredBlocks
        .filter((block) => block.controller.hasUnresolved());
      if (unresolvedUnderRecipe.length > 0) {
        const earlyRevert = probeEarlySourceRevertBeforeDeferredCompute(
          aggregate,
          ctx.provider,
          unresolvedUnderRecipe.map((block) => ({
            inputIndex: block.executionInput,
            inputBase: block.inputBase,
            offsets: unresolvedComputeOffsetsForEarlyRevert(
              block.offsets,
              plan.participants[block.participant].blockLayout?.slots ?? [],
              block.controller.remaining?.(),
            ),
          })),
        );
        if (earlyRevert !== undefined) throw earlyRevert;
        const detail = unresolvedUnderRecipe.map((block) => {
          const counts = block.controller.remaining?.();
          if (counts === undefined) return String(block.participant);
          return `${block.participant} (keccak ${counts.keccakUnresolved}/${counts.keccakTotal}, `
            + `ecrecover ${counts.ecrecoverUnresolved}/${counts.ecrecoverTotal})`;
        }).join(', ');
        throw new Error(
          'materialization: recipe mode forbids deferred-compute VM discovery as planner authority; '
            + `unresolved participant(s) ${detail} `
            + '(opt into materializationMode=devOracle for diagnostic discovery)',
        );
      }
    }
    const maximumRounds = resolvableDeferredBlocks.reduce((sum, block) => sum + block.offsets.length, 0) + 1;
    // constraint fixpoint / item-10: deferred-compute discovery (devOracle) progresses on the same monotone lattice
    // as resource/chunk/semantic-claim converges — refuse oscillating unresolved sets.
    const deferredDiscoveryLattice = new MonotoneCell<string>();
    const seenDeferredDiscoveryStates = new Set<string>();
    for (let round = 0; round < maximumRounds; round += 1) {
      if (!allowsDeferredComputeVmDiscovery()) break;
      const unresolved = resolvableDeferredBlocks.filter((block) => block.controller.hasUnresolved());
      if (unresolved.length === 0) {
        finalizeMonotonePass(deferredDiscoveryLattice, 'deferred-compute:resolved');
        break;
      }
      const discoveryState = unresolved
        .map((block) => `${block.participant}@${[...block.offsets].sort((a, b) => a - b).join(',')}`)
        .sort()
        .join('|');
      const deferredCycle = 'messageBus: deferred-compute discovery entered a repeated unresolved state';
      recordMonotonePass(
        deferredDiscoveryLattice,
        seenDeferredDiscoveryStates,
        discoveryState,
        deferredCycle,
      );
      recordActiveConstraintPass('deferred-compute', discoveryState, deferredCycle, ctx.constraintFixpoint);
      const program = aggregate.buildLibauthProgram();
      let progressed = false;
      for (const block of unresolved) {
        const candidateExecutions = plan.participants.map((candidate) => {
          const base = graph.layout.participantInputs[candidate.participant];
          return candidate.executionKind === 1 && candidate.executorOffset !== null
            ? base + candidate.executorOffset : base;
        });
          // The deferred-argument probe can only learn from an input whose SCRIPT executes the read site, and a
          // kernel participant publishes more than one such input: its block's master/logical identity and its
          // identity anchor run the participant's own row/verifier bodies, while `base + executorOffset` runs the
          // executor. Probing only the executor left the compute reads unreached (measured on a large
          // corpus: participant 0's executor executes 955 steps and never enters the 2408-instruction row body
          // that carries both keccak preimage reads, while its own block input executes a 155-instruction body for
          // 957 steps). Try every block input that can execute participant code; a trace that teaches nothing is
          // discarded by the resolver, and a learned value is re-checked against the authenticated expectation.
        const ownedBlockExecutions = plan.participants.flatMap((candidate) => {
          const base = graph.layout.participantInputs[candidate.participant];
          const offsets = new Set<number>([0]);
          for (const slot of candidate.blockLayout?.slots ?? []) {
            if (slot.kind === 'master' || slot.kind === 'identityAnchor'
                || slot.kind === 'lowLevelCall') offsets.add(slot.offset);
          }
          return [...offsets].map((offset) => base + offset);
        });
        for (const owned of ownedBlockExecutions) {
          if (!candidateExecutions.includes(owned)) candidateExecutions.push(owned);
        }
        if (!block.controller.resolve(
          program, block.executionInput, block.inputBase, candidateExecutions,
        )) continue;
        progressed = true;
        const refreshed = block.controller.refresh();
        for (const offset of block.offsets) {
          const input = refreshed.inputs[offset];
          const output = refreshed.outputs[offset];
          if (!input || !output) {
            throw new Error(
              `messageBus: participant ${block.participant} lost compute resource slot ${offset} while resolving`,
            );
          }
          block.local.inputs[offset] = input;
          block.local.outputs[offset] = output;
          aggregate.inputs[block.inputBase + offset] = input;
          aggregate.outputs[block.inputBase + offset] = output;
        }
        // deferred-compute recipe gate: recipe-once — never memoize VM-discovered compute into the deferred cache.
        if (!block.controller.hasUnresolved() && allowsDeferredComputeVmDiscovery()) {
          deferredComputeCache.set(block.participant, {
            graphKey: deferredComputeGraphKey,
            resources: new Map(block.offsets.map((offset) => [offset, {
              input: refreshed.inputs[offset], output: refreshed.outputs[offset],
            }])),
          });
        }
      }
      if (!progressed) {
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_ENTRY_COUNTS === '1') {
          // The EXECUTOR frame's own calldata, as raw pushes. The stalled participant's route context is not
          // enough: a delegate participant's block belongs to the proxy while its rows run in the
          // implementation's input, so coordinates such as `__internal__proxyMasterIndex` are relative to that
          // owner - and a base that resolves to the executor input instead is invisible in every other dump.
          // Deliberately NOT mapped onto declared route inputs: a delegate frame does not pack its arguments
          // one-for-one with the route ABI (measured: the first push is the 4-byte message-bus magic, not the
          // blob), so a positional name table would be a guess. Small numeric pushes are printed as values
          // because that is how compiler-owned coordinates travel.
          const executorCalldata = resolvableDeferredBlocks.map((block) => {
            const unlocking = program.transaction.inputs[block.executionInput]?.unlockingBytecode
                ?? new Uint8Array();
            const pushes: string[] = [];
            for (let cursor = 0; cursor < unlocking.length && pushes.length < 64;) {
              const opcode = unlocking[cursor];
              let width = 0;
              let length = 0;
              if (opcode >= 1 && opcode <= 75) { width = 1; length = opcode; } else if (opcode === 0x4c) {
                width = 2; length = unlocking[cursor + 1] ?? 0;
              } else if (opcode === 0x4d) {
                width = 3; length = (unlocking[cursor + 1] ?? 0) | ((unlocking[cursor + 2] ?? 0) << 8);
              } else if (opcode === 0x00) { width = 1; length = 0; } else break;
              const payload = unlocking.slice(cursor + width, cursor + width + length);
              const numeric = length === 0 ? '0'
                : opcode >= 0x51 && opcode <= 0x60 ? String(opcode - 0x50)
                  : length === 1 && payload[0] <= 16 ? String(payload[0])
                    : undefined;
              pushes.push(`${cursor}:${length}b${numeric === undefined
                ? `:${binToHex(payload).slice(0, 24)}` : `=${numeric}`}`);
              cursor += width + length;
            }
            return { participant: block.participant, executionInput: block.executionInput,
              inputBase: block.inputBase, bytes: unlocking.length, pushes };
          });
          console.error('deferred-stall-executor-calldata', JSON.stringify(executorCalldata));
          const needle = 'bac4afa31b5925f5';
          const commitments = aggregate.inputs.map((input) =>
            String(input?.token?.nft?.commitment ?? '').toLowerCase());
          const lockOf = (item: unknown): string => {
            const input = item as { unlocker?: { generateLockingBytecode: () => Uint8Array } } | undefined;
            return input?.unlocker ? binToHex(input.unlocker.generateLockingBytecode()) : '';
          };
          const p2pkhBefore = aggregate.inputs.flatMap((input, index) => {
            const lock = lockOf(input);
            return lock.startsWith('76a914') && index <= graph.layout.feeInput ? [{ index, lock }] : [];
          });
            // A runtime coordinate is only attributable when the lock an ACTUAL input carries can be matched to the
            // participant that published it. Every owner publishes a distinct set: the physical owner lock, the
            // logical identity lock and the delegate executor lock - which differ exactly when the block belongs to
            // a proxy while the rows execute in its implementation.
          console.error('deferred-stall-identities', JSON.stringify({
            participants: plan.participants.map((candidate) => ({
              participant: candidate.participant,
              contract: candidate.artifact.contractName,
              executionKind: candidate.executionKind,
              base: graph.layout.participantInputs[candidate.participant],
              blockSize: candidate.blockLayout?.blockSize,
              logicalIdentityOffset: candidate.logicalIdentityOffset,
              executorOffset: candidate.executorOffset,
              executorInputIndex: candidate.executorInputIndex,
              lock: candidate.lockingBytecode.slice(0, 40),
              logicalLock: candidate.logicalLockingBytecode?.slice(0, 40),
              executorLock: candidate.executorLockingBytecode.slice(0, 40),
            })),
            inputLocks: aggregate.inputs.map((input, index) => {
              const lock = lockOf(input);
              const category = (input as { token?: { category?: string } })?.token?.category ?? '';
              return `${index}:${lock.slice(0, 14)}:${category.slice(0, 12)}`;
            }),
            // A frame authenticates its callee against the call expression's address, while the block it reads
            // is the CALLEE PARTICIPANT's. When those two disagree the check can never pass, and the pair is
            // only comparable here, where both the prepared descriptors and the finalized plan are in scope.
            invocations: plan.invocations.map((invocation) => ({
              function: invocation.function,
              caller: invocation.caller,
              callee: invocation.callee,
              target: invocation.targetLockingBytecode.slice(0, 40),
              calleeContract: plan.participants[invocation.callee]?.artifact.contractName,
              calleeLock: plan.participants[invocation.callee]?.lockingBytecode.slice(0, 40),
              argsBytes: invocation.argsHex.length / 2,
            })),
            prepared: descriptors.map((descriptor) => ({
              function: descriptor.functionName,
              contract: descriptor.contract.inner.artifact.contractName,
              inner: descriptor.contract.inner.lockingBytecode.slice(0, 40),
              target: descriptor.targetLockingBytecode?.slice(0, 40),
            })),
          }));
          const describe = (
            item: { token?: { category?: string; nft?: { capability?: string; commitment?: string } } } | undefined,
            index: number,
          ): unknown => ({
            index,
            cat: item?.token?.category?.slice(0, 10),
            cap: item?.token?.nft?.capability,
            commitBytes: (item?.token?.nft?.commitment?.length ?? 0) / 2,
          });
          const sidecarSlots = plan.participants.flatMap((candidate) => {
            const base = graph.layout.participantInputs[candidate.participant];
            return (candidate.blockLayout?.slots ?? [])
              .filter((slot) => slot.kind === 'ecrecoverSideCar' || slot.kind === 'keccakSideCar')
              .map((slot) => ({
                participant: candidate.participant,
                kind: slot.kind,
                offset: slot.offset,
                input: describe(aggregate.inputs[base + slot.offset] as never, base + slot.offset),
                output: describe(aggregate.outputs[base + slot.offset] as never, base + slot.offset),
              }));
          });
          console.error('deferred-stall-band', JSON.stringify({
            buildId: peekBuilderBuildId(),
            participants: plan.participants.map((candidate) => {
              const artifact = candidate.artifact as {
                messageBus?: { route?: { graphEffectFrame?: Record<string, unknown> } };
              };
              const slots = candidate.blockLayout?.slots ?? [];
              return {
                participant: candidate.participant,
                slots: slots.map((slot) => [slot.offset, slot.kind, slot.slotIndex, slot.nftIndex,
                  slot.conditional === true ? 1 : 0]),
                frame: artifact.messageBus?.route?.graphEffectFrame,
              };
            }),
          }));
          // A stall is reported by ONE participant's builder, but the program that runs is the atomic verifier,
          // which addresses every participant's outputs. Label each aggregate coordinate with its owner and
          // block slot so an aborting read can be attributed without recomputing any participant's addresses.
          const slotLabels = aggregate.outputs.map((_output, index) => {
            for (const candidate of plan.participants) {
              const base = graph.layout.participantInputs[candidate.participant];
              const slot = (candidate.blockLayout?.slots ?? [])
                .find((entry) => base + entry.offset === index);
              if (slot) {
                return `p${candidate.participant}:${slot.kind}`
                    + (slot.slotIndex !== undefined ? `#${slot.slotIndex}` : '');
              }
            }
            return 'other';
          });
          const resourceKinds = new Map<string, string>();
          for (const [participantIndex, published] of resourceLocksByParticipant) {
            for (const [lock, kind] of published) {
              if (!resourceKinds.has(lock)) resourceKinds.set(lock, `p${participantIndex}:${kind}`);
            }
          }
          const tailKinds = aggregate.outputs.flatMap((output, index) => {
            if (slotLabels[index] !== 'other') return [];
            const lock = output.to instanceof Uint8Array ? binToHex(output.to).toLowerCase() : '';
            const commitment = output.token?.nft?.commitment;
            return [`${index}:${resourceKinds.get(lock) ?? 'unknown'}:${(commitment?.length ?? 0) / 2}`];
          });
            // How much of each participant's trailing run was actually PUBLISHED (token-bearing). The
            // range-splice chain walk addresses output[master + blockSize + 1 + counter], so a mismatch between
            // this count and the counter the covenant reached in the SDK's read window is the chain-length
            // mismatch itself, visible without another round of instrumentation.
          const trailingPublished = plan.participants.map((candidate) => {
            const base = graph.layout.participantInputs[candidate.participant];
            const trailing = (candidate.blockLayout?.slots ?? [])
              .filter((slot) => slot.kind === 'trailing').map((slot) => slot.offset).sort((a, b) => a - b);
            const published = trailing.filter((offset) =>
              aggregate.outputs[base + offset]?.token?.nft !== undefined);
            return `p${candidate.participant}:${published.length}/${trailing.length}`
                + `[${published.slice(0, 6).join(',')}]`;
          });
            // The published sorted-chain nodes carry `slot(32) || nextKey(32) || value`; the covenant's
            // range-splice walk follows `nextKey` until it reaches the predecessor's old successor, so the LAST
            // node's nextKey is what terminates the walk. Print both sides' commitment heads so the chain links
            // can be compared directly (input = the co-spent resource, output = the published node).
          const trailingCommitments = plan.participants.flatMap((candidate) => {
            const base = graph.layout.participantInputs[candidate.participant];
            return (candidate.blockLayout?.slots ?? [])
              .filter((slot) => slot.kind === 'trailing')
              .map((slot) => ({ participant: candidate.participant, offset: slot.offset }))
              .filter(({ offset }) => aggregate.outputs[base + offset]?.token?.nft !== undefined)
              .map(({ participant, offset }) => {
                const input = aggregate.inputs[base + offset]?.token?.nft?.commitment ?? '';
                const output = aggregate.outputs[base + offset]?.token?.nft?.commitment ?? '';
                return `p${participant}@${offset} in=${String(input).slice(0, 80)}`
                    + ` out=${String(output).slice(0, 80)}`;
              });
          });
            // The participant's ROUTE arguments, named from the route ABI. The program is fully built here, so
            // the master input's unlocking bytecode is the packed ABI argument vector - and unlike the
            // verifier's script it is packed exactly as declared, so a positional mapping is sound. An EMPTY
            // item names the route parameter the covenant computed an empty address from.
          const routeArguments = plan.participants.map((candidate) => {
            const base = graph.layout.participantInputs[candidate.participant];
            const declared = (candidate.artifact.messageBus as {
              route?: { inputs?: Array<{ name?: string }> };
            } | undefined)?.route?.inputs ?? [];
            const unlocking = program.transaction.inputs[base]?.unlockingBytecode ?? new Uint8Array();
            const lengths: number[] = [];
            for (let cursor = 0; cursor < unlocking.length && lengths.length <= declared.length;) {
              const opcode = unlocking[cursor];
              if (opcode >= 1 && opcode <= 75) {
                lengths.push(opcode); cursor += 1 + opcode;
              } else if (opcode === 0x4c && cursor + 1 < unlocking.length) {
                const size = unlocking[cursor + 1]; lengths.push(size); cursor += 2 + size;
              } else if (opcode === 0x00) { lengths.push(0); cursor += 1; } else break;
            }
            // Full name=length table, not just the empty entries: the failing comparison reads a witness by
            // its ABI position, so the table lets the empty COMPUTED operands be matched to the parameter that
            // produced them.
            const table = lengths.slice(0, declared.length).map((length, index) =>
              `${declared[index]?.name ?? index}=${length}`);
            const empty = lengths.map((length, index) => ({ length, index }))
              .filter((item) => item.length === 0)
              .map((item) => declared[item.index]?.name ?? `<${item.index}>`);
            return `p${candidate.participant}:empty[${empty.join(',')}]:${table.join(' ')}`;
          });
          console.error('deferred-stall-io-full', JSON.stringify({
            routeArguments,
            buildId: peekBuilderBuildId(),
            labels: slotLabels,
            trailingPublished,
            trailingCommitments,
            tailKinds,
            out: aggregate.outputs.map((item, index) => {
              const lock = item?.to instanceof Uint8Array ? binToHex(item.to).slice(0, 10) : '';
              return item?.token?.nft
                ? `${index}:${item.token.category?.slice(0, 8)}:${(item.token.nft.commitment?.length ?? 0) / 2}:${lock}`
                : `${index}:-:${lock}`;
            }),
            in: aggregate.inputs.map((item, index) => item?.token?.nft
              ? `${index}:${item.token.category?.slice(0, 8)}:${(item.token.nft.commitment?.length ?? 0) / 2}`
              : `${index}:-`),
          }));
          console.error('deferred-stall-io', JSON.stringify({
            buildId: peekBuilderBuildId(),
            inputs: aggregate.inputs.slice(0, 24).map((item, index) => ({
              index,
              cat: item?.token?.category?.slice(0, 10),
              cap: item?.token?.nft?.capability,
              commitBytes: (item?.token?.nft?.commitment?.length ?? 0) / 2,
              lock: (() => {
                const unlocker = (item as { unlocker?: { generateLockingBytecode: () => Uint8Array } })
                  ?.unlocker;
                return unlocker ? binToHex(unlocker.generateLockingBytecode()).slice(0, 12) : '';
              })(),
            })),
          }));
          console.error('deferred-stall-outputs', JSON.stringify({
            buildId: peekBuilderBuildId(),
            outputs: aggregate.outputs.slice(0, 24).map((output, index) => ({
              index,
              cat: output.token?.category?.slice(0, 10),
              cap: output.token?.nft?.capability,
              commitBytes: (output.token?.nft?.commitment?.length ?? 0) / 2,
              lock: (output.to instanceof Uint8Array ? binToHex(output.to) : String(output.to)).slice(0, 12),
            })),
          }));
          console.error('deferred-stall-sidecars', JSON.stringify({
            buildId: peekBuilderBuildId(),
            slots: sidecarSlots.slice(0, 8),
            tokenlessOutputs: sidecarSlots.filter((slot) =>
              (slot.output as { cat?: string }).cat === undefined).length,
          }));
          console.error('deferred-stall-composition', JSON.stringify({
            lastBuildId: peekBuilderBuildId(),
            firstP2pkh: p2pkhBefore[0],
            p2pkhCount: p2pkhBefore.length,
            feeInputLock: lockOf(aggregate.inputs[graph.layout.feeInput]),
            calls: (options.preparedCalls ?? []).map((call) => {
              const described = call as unknown as {
                functionName?: string; logicalFunctionName?: string; selectorHex?: string;
              };
              return described.logicalFunctionName ?? described.functionName
                  ?? described.selectorHex ?? '?';
            }).slice(0, 8),
            inputCount: aggregate.inputs.length,
            whitelistEntryInputs: commitments.flatMap((commitment, index) =>
              commitment.includes(needle) ? [index] : []),
            entryLikeInputs: commitments.filter((commitment) => commitment.length >= 128).length,
          }));
        }
        // "No progress" alone cannot distinguish a keccak preimage the trace never exposed from an ecrecover
        // argument that stayed a placeholder, and the two have different causes. The builder already counts
        // both, so name them in the failure.
        const stalled = resolvableDeferredBlocks.filter((block) => block.controller.hasUnresolved())
          .map((block) => {
            const counter = block.controller.remaining?.();
            return counter === undefined ? `participant ${block.participant}`
              : `participant ${block.participant}: keccak ${counter.keccakUnresolved}/`
                  + `${counter.keccakTotal} unresolved, ecrecover ${counter.ecrecoverUnresolved}/`
                  + `${counter.ecrecoverTotal} unresolved`;
          });
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_ENTRY_COUNTS === '1') {
          // Whether the probe program is layout-COMPLETE: every participant's block is placed from the plan, so
          // if the aggregate is smaller than the plan's own spans, every absolute coordinate baked into a row
          // body (callee indices, entry offsets, executor-relative families) addresses an input that does not
          // exist yet, and the probe aborts before the compute read sites it exists to observe.
          console.error('deferred-stall-plan-size', JSON.stringify({
            probeInputs: aggregate.inputs.length,
            probeOutputs: aggregate.outputs.length,
            participants: plan.participants.map((candidate) => ({
              participant: candidate.participant,
              base: graph.layout.participantInputs[candidate.participant],
              blockSize: candidate.blockLayout?.blockSize ?? 0,
              executionKind: candidate.executionKind,
              executorOffset: candidate.executorOffset ?? null,
              invocationCount: candidate.invocations.length,
            })),
          }));
        }
        throw new Error(
          'messageBus: complete graph did not expose arguments for all deferred compute resources'
            + (stalled.length > 0 ? ` (${stalled.join('; ')})` : '')
            // The probe is built from this aggregate, and its own coordinate space is what a generated read
            // addresses. A coordinate past the end aborts the probe before the compute read sites - which is
            // indistinguishable from "the graph did not expose the arguments" without these counts.
            + ` [probe program: ${aggregate.inputs.length} inputs, ${aggregate.outputs.length} outputs]`,
        );
      }
      rebalanceFeeTail(aggregate, 'resolved compute-sidecar witnesses');
    }
    const unresolved = resolvableDeferredBlocks.filter((block) => block.controller.hasUnresolved());
    if (unresolved.length > 0) {
      throw new Error(
        'messageBus: deferred compute resources did not converge for participant(s) '
          + unresolved.map((block) => block.participant).join(', '),
      );
    }
  }
  return { builder: aggregate, actualSizes, incompleteDynamicChunks };
}
