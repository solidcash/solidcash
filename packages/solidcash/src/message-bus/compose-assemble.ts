
/**
 * phase-boundary extract: Compose phase-boundary extract — AtomicMessageBusComposition._build nested `assemble`.
 */

import { bigIntToVmNumber, binToHex, binToUtf8, hexToBin, sha1, utf8ToBin, vmNumberToBigInt } from '@bitauth/libauth';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX, decodePushdataValue, encodePushdataValue, scriptToBytecode,
  MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN, sha256, ripemd160, hash160, hash256, buildEventNftCovenantScript,
  buildAnonymousEventNftCovenantScript, computeEventNameHash, parseArrayTypeString,
  buildEntryCommitment, buildInitialStateCommitments, buildPushdataCommitment, bytecodeToScript, scriptToAsm,
  AddressType, BytesType, FixedType, IntType,
  parsePushdataCommitment, parseTypeStrict, PrimitiveType,
  childStateLayoutDigest,
  validateChildDeploymentGenesisState,
  getDefaultStateValue,
} from '@solidcash/utils';
import type {
  Artifact, ChildDeploymentValueRecipe, ExternalResultEncoding, FixedBchTransferAbi, StateLayout, StateValue,
  StructDefinitionInfo,
} from '@solidcash/utils';
import type { ConstructorArgument, FunctionArgument } from '../Argument.js';
import type {
  ContractUnlocker, Output, TokenDetails, TransactionDetails, UnlockableUtxo, Unlocker, Utxo,
} from '../interfaces.js';
import { isContractUnlocker } from '../interfaces.js';
import { TransactionBuilder } from '../TransactionBuilder.js';
import { Contract } from '../Contract.js';
import { addressToLockScript, scriptToLockingBytecode } from '../utils.js';
import {
  decodeAuthenticatedProducerResultVector, evalComputedKey, isCanonicalEvmScalarReturnVector,
  StatefulContract, StatefulFunctionCall,
} from '../stateful/StatefulContract.js';
import {
  chunksFromValue, persistValueChunkLock, valueChunkIndexFromCommitment,
  valueChunkWriteResourceIdentity, type ValueChunkWriteDescriptor,
} from '../stateful/StatefulTransactionBuilder.js';
import { artifactUsesSolidityAbi, resolveExternalResultEncoding } from '../stateful/solidityAbi.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import {
  resolveLogicalIdentity, type ResolvedLogicalIdentity,
} from '../stateful/logical-identity.js';
import { canApplyRepairedNftCommitment } from '../stateful/computed-output-repair.js';
import { tryParseEventCommitment } from '../stateful/StateReader.js';
import {
  createDestroyDataNftUnlocker, createMessageBusVerifierUnlocker, getDataNftAddress,
  getEntryNftLockingBytecode, getMessageBusVerifierLockingBytecodeForArtifact,
} from '../stateful/covenant-helpers.js';
import { encodeAtomicMessageBusCallManifest, encodeAtomicMessageEnvelope } from './atomic.js';
import { peekBuilderBuildId } from '../stateful/StatefulContract.js';
import { assertAtomicParticipantCapacity } from './capacity.js';
import {
  finalizeAtomicInvocationGraph, graphInvocationCallerIdentity, selectedGraphEventOffsets,
  type AtomicDeploymentSlotEffect, type AtomicEventSlotEffect, type AtomicResourceSlotEffect,
  type AtomicSidecarSlotEffect, type AtomicTokenSlotEffect, type AtomicValueSlotEffect,
  type PlannedGraphInvocation,
} from './graph.js';
import {
  encodeMessageBatch, preparedCallMatchesPlanInvocation,
  resolveMessageBusAbiFunction, resolveMessageBusHandler,
} from './message-bus.js';
import {
  convergeMessageBusComputedResourceOutputs, finalizedByteGateOptionsForProvider, preflightMessageBusTransaction,
} from './preflight.js';
import { convergeMessageBusComputedValueChunkOutputs } from './computed-value-chunks.js';
import {
  convergeMessageBusComputedDynamicChunkOutputs,
  dynamicChunkPlaceholdersRemain,
} from './computed-dynamic-chunks.js';
import { deriveCompiledGraphPlan, type WorklistParticipant } from './worklist.js';
import {
  applyParticipantAbsoluteWitnesses,
  resolveComposeTransactionLayoutAuthority,
  trailingCapacityExcludingFixedSuffix,
  type ComposeParticipantLayoutClaims,
  type SymbolicParticipantLayout,
} from './layout-resolver.js';
import {
  authorizeComposeParticipantLayout,
  clearComposeKernelAuthorityResults,
} from './compose-kernel-authority.js';
import {
  findMessageBusHandlerForInvocation,
} from './graph-handler-join.js';
import { layoutInvariantError } from './diagnostics.js';
import { layoutWitnessIsActiveCoordinate } from './layout-sentinels.js';
import { allowsDeferredComputeVmDiscovery } from './materialization-mode.js';
import {
  finalizeMonotonePass,
  MonotoneCell,
  recordMonotonePass,
} from './monotone-lattice.js';
import { recordActiveConstraintPass } from '../stateful/value-chunk-persist.js';
import {
  buildTransportedContinuationResourceClaim,
  canonicalValueChunkProducerIdentity, canonicalValueChunkProducerPathContext,
  canonicalValueChunkProducerResourceClaim,
  canonicalValueChunkProducerResourceIdentity, canonicalValueChunkStateOwner,
  orderTransportedContinuationResourceClaims,
  type TransportedContinuationResourceClaim,
  type ValueChunkProducerPathDisposition, type ValueChunkProducerResourceClaim,
} from '../stateful/ValueChunkProducerIdentity.js';
import {
  canSeedComputedValueChunkClaim,
  canOwnTransportedContinuationSlot,
  evaluateChildDeploymentRecipe,
  materializeFixedBchTransfer,
  materializeChildDeploymentEntryScalar,
  materializeChildDeploymentEntryValue,
  provisionalInvocationResult,
  stickyKernelLeftoverScalarWrites,
  minimumActualSizeForComputedValueChunkClaims,
  evmInvocationResultLength,
  // Internal helpers still used by AtomicMessageBusComposition orchestration:
  fixedVmNumber,
  concatBytes,
  canonicalNativeResultField,
  preparedInvocationResult,
} from './compose-recipes.js';
import type { ComputedValueChunkSpanClaim } from './compose-recipes.js';
import {
  type AtomicMessageBusFunder,
  type ComposeAtomicMessageBusOptions,
  type PreparedAtomicMessageBusCall,
  type CallDescriptor,
  type SemanticClaimObservation,
  semanticJson,
  assertPreparedInvocationIdentity,
  rebuildPreparedInvocation,
  applySemanticClaimObservationPass,
} from './compose-prepared-invocation.js';
import {
  ownerParticipantArtifact,
  delegateParticipantArtifact,
  funderUtxo,
  freezeStaticcallParticipantOutputs,
  participantOf,
  concat,
  uint16,
  framed,
  hasDynamicStateMember,
  appendOnlyStateSuffix,
  graphRouteContext,
  type DeferredComputeController,
  type ComputedValueChunkClaim,
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
    participant: number; offset: number; runtimeRow: number; eventSignature: string;
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
  rebalanceFeeTail: (builder: TransactionBuilder, subject: string) => void;
  eventLockingBytecodes: (participant: PlanParticipant) => string[];
  /** Written by assemble; read by outer _build after the last assemble call. */
  predOutClaimsSlot: { current?: AssemblePredOutClaimsByParticipant };
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
    sidecarSlots,
    materializedDeployments,
    participantReturnBlob,
    participantReturnCommitment,
    deferredComputeCache,
    rebalanceFeeTail,
    eventLockingBytecodes,
    predOutClaimsSlot,
  } = ctx;

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
    const actualSizes: number[] = [];
    const incompleteDynamicChunks: Array<{
      participant: number; variable: string; resolved: number; total: number;
    }> = [];
    const aggregateOutpoints = new Map<string, { participant: number; localIndex: number }>();
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
    // Deferred multi-claim batch layout resolve: defer layout resolve+apply until every participant's claims are known, then one batch resolve.
    const deferredLayoutClaims: ComposeParticipantLayoutClaims[] = [];
    const deferredLayoutApplies: Array<{
      participant: number;
      inputs: readonly { name: string }[];
      params: unknown[];
      syncEncodedArgsFromParams?: (onlyIndices?: readonly number[]) => void;
      publishedRelocations: Array<{ name: string; from: string; to: string }>;
      resyncedIndices: number[];
    }> = [];
    let deferredTransactionParticipants: readonly SymbolicParticipantLayout[] | undefined;

    // Resource locks each participant's own build published, tagged by resource family. A stall diagnostic
    // attributes an introspected aggregate coordinate in the TAIL - which lies beyond every participant
    // block - by the lock its owner published, since no block layout can label it.
    const resourceLocksByParticipant = new Map<number, ReadonlyArray<readonly [string, string]>>();
    for (const participant of plan.participants) {
      const contract = byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
      const descriptor = descriptorByLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
      const blockSize = participant.lifecycle?.balancedSpan ?? participant.blockLayout!.blockSize;
      const returnBlob = participantReturnBlob(participant.participant, results);
      const returnCommitment = participantReturnCommitment(returnBlob);
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
      // One storage resource written by several batched rows of the same route accumulates a chain of
      // productions: the first row's claim is the value after row 1, the next row's claim the value after
      // row 2, and so on. Only the terminal write persists, so keep the highest mutation ordinal per resource
      // and drop the intermediate lanes: the routed builder accepts exactly one terminal claim per resource
      // (selectSingletonValueChunkProducer), and a superseded lane's value would never be observable.
      const terminalProducerByResource = new Map<string, string>();
      const terminalOrdinalByResource = new Map<string, number>();
      for (const production of valueChunkProductions.values()) {
        const resource = valueChunkWriteResourceIdentity(production.write);
        const ordinal = production.claim.producer.mutationSourceEffectOrdinal;
        const producer = canonicalValueChunkProducerIdentity(production.claim.producer);
        if (producer === undefined) continue;
        if ((terminalOrdinalByResource.get(resource) ?? -1) > ordinal) continue;
        terminalOrdinalByResource.set(resource, ordinal);
        terminalProducerByResource.set(resource, producer);
      }
      for (const [identity, production] of [...valueChunkProductions]) {
        const resource = valueChunkWriteResourceIdentity(production.write);
        const producer = canonicalValueChunkProducerIdentity(production.claim.producer);
        if (terminalProducerByResource.get(resource) !== producer) valueChunkProductions.delete(identity);
      }
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
        const lockingBytecode = persistValueChunkLock(
          production.stateOwner.categoryId, production.value, production.write,
        );
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
      const selectedValueChunkSlots = transportedChunkCount === 0
        ? [] : valueChunkSlots.slice(-transportedChunkCount);
      if (selectedValueChunkSlots.some((slot, index) => index > 0
        && slot.offset !== selectedValueChunkSlots[index - 1]!.offset + 1)) {
        throw new Error('messageBus: transported continuation slots are not one consecutive trailing run');
      }
      const participantInputBase = graph.layout.participantInputs[participant.participant];
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
      const orderedContinuationClaims = continuationResourceClaims.length === 0
        ? [] : orderTransportedContinuationResourceClaims(continuationResourceClaims);
      if (continuationResourceClaims.length > 0 && orderedContinuationClaims === undefined) {
        throw new Error('messageBus: transported continuation resource claims are not an ordered band list');
      }
      // Defer absolute valueChunk/dyn/PredOut to ONE resolveParticipantAbsoluteWitnesses pass after the
      // local frame exists (PredOut content-match needs outputs). Pass the participant-local slot offset
      // here so `_batchRaw` can build; the unlocker sync below rebases every absolute from that single result.
      const valueChunkSlotOffset = transportedChunkCount > 0
        ? selectedValueChunkSlots[0]!.offset : undefined;
      const pendingValueChunkClaim = valueChunkSlotOffset === undefined ? undefined : {
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
            const descriptor = descriptors[invocationIndex];
            const caller = planned?.caller === null || planned?.caller === undefined
              ? undefined : plan.participants[planned.caller];
            const resolved = graphCallers[rowIndex];
            return {
              function: descriptor?.functionName,
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
        participant.batch.blob,
        participant.batch.routeWitnesses as FunctionArgument[],
        internalRouteWitnesses,
        graph.layout.participantInputs[participant.participant],
        returnBlob !== undefined,
        returnCommitment,
        true,
        descriptor.executor ? { artifact: descriptor.artifact, executor: descriptor.executor } : undefined,
        participant.invocations.map((invocationIndex) => {
          const invocation = descriptors[invocationIndex];
          const plannedInvocation = plan.invocations[invocationIndex];
          const published = findMessageBusHandlerForInvocation(participant.artifact, {
            function: invocation.functionName,
            selectorHex: plannedInvocation.selectorHex,
          });
          const selector = (published?.selector ?? plannedInvocation.selectorHex).toLowerCase();
          // compose selector-first handler join: ABI join is selector-first under kernel; diagnostic name is not authority.
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
        }),
        logicalIdentities.get(participant.participant),
        Object.freeze([...valueChunkProductions.values()]),
        frameCaller === undefined ? undefined : hexToBin(frameCaller.lockingBytecode),
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
        for (const transfer of handler?.transfers ?? []) {
          if (transfer.condition === null) {
            throw new Error(
              `messageBus: BCH transfer predicate in '${invocation.function}' is not a canonical recipe`,
            );
          }
          if (transfer.condition !== undefined && !(await contract._resolveCompilerEffectPredicate(
            transfer.condition, supplied.args, handler!, supplied.executionArtifact ?? participant.artifact,
            authenticatedState,
          ))) continue;
          const executionArtifact = supplied.executionArtifact ?? participant.artifact;
          const inputTypes = handler!.inputs.map((input) => input.type);
          const logicalCaller = invocation.caller === null
            ? rootCaller : hexToBin(graphInvocationCallerIdentity(
              plan.participants, plan.invocations, invocation,
            ).lockingBytecode);
          const materialized = materializeFixedBchTransfer(
            transfer, supplied.args, inputTypes, executionArtifact, provider,
            authenticatedState, logicalCaller,
          );
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
      let transportedChunkIndex = 0;
      for (const candidate of transportedValueChunks) {
        for (const chunk of candidate.chunks) {
          const slot = selectedValueChunkSlots[transportedChunkIndex++];
          if (!slot) throw new Error('messageBus: transported continuation slot allocation overflowed');
          const input = local.inputs[slot.offset];
          const chunkCategoryId = chunk.categoryId ?? candidate.production.stateOwner.categoryId;
          if (!canOwnTransportedContinuationSlot(input, {
            categoryId: chunkCategoryId, commitment: chunk.commitment,
          })) {
            throw new Error('messageBus: transported continuation output does not own a balanced trailing slot');
          }
          local.outputs[slot.offset] = {
            to: chunk.lockingBytecode,
            amount: input!.satoshis,
            token: {
              category: chunkCategoryId,
              amount: 0n,
              nft: { capability: 'mutable', commitment: chunk.commitment },
            },
          };
        }
      }
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
        for (const consumed of merge.consumedMasters) {
          if (consumed.token?.category.toLowerCase() !== categories[participant.participant].toLowerCase()
            || consumed.token.nft?.capability !== 'minting') {
            throw new Error(
              `messageBus: merge participant ${participant.participant} input is not one exact category master`,
            );
          }
          mergedTokenAmount += consumed.token.amount ?? 0n;
          local.addInput(consumed, routeUnlocker);
          local.addOutput({ to: options.changeAddress, amount: consumed.satoshis });
        }
        local.outputs[0] = {
          ...masterOutput,
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
      // Runtime event occurrences occupy compiler-owned trailing slots, so they cannot appear as fixed
      // `blockLayout.kind === event` coordinates. Preserve the exact row, schema, and physical offset published
      // by the participant builder; later graph passes turn only these observed occurrences into kind-2 rows.
      // This is resource geometry, independent of contract/function/event names.
      const runtimeEvents = (local as TransactionBuilder & {
        __messageBusRuntimeLoopEvents?: readonly {
          eventSignature: string; rowIndex: number; offset: number;
        }[];
      }).__messageBusRuntimeLoopEvents ?? [];
      runtimeEventSlots.set(participant.participant,
        runtimeEvents.map((event) => ({
          participant: participant.participant,
          offset: event.offset,
          runtimeRow: event.rowIndex,
          eventSignature: event.eventSignature,
        })));
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
        const input = local.inputs[local.outputs.length];
        local.addOutput({
          to: Uint8Array.of(0x51),
          amount: input.satoshis,
        });
      }
      if (local.inputs.length !== blockSize || local.outputs.length !== blockSize) {
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
          const describeInput = (input: typeof local.inputs[number], index: number) => ({
            index,
            lockingBytecode: binToHex(input.unlocker.generateLockingBytecode()),
            category: input.token?.category,
            commitment: input.token?.nft?.commitment,
          });
          const describeOutput = (output: typeof local.outputs[number], index: number) => ({
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
      const fixedSize = transportedChunkCount > 0
        ? participant.blockLayout!.trailingBase ?? blockSize
        : participant.blockLayout!.fixedSuffix
        ? blockSize : participant.blockLayout!.trailingBase ?? blockSize;
      const computedValueChunkMetadata = local as TransactionBuilder & {
        __messageBusComputedValueChunkSpanClaims?: readonly ComputedValueChunkSpanClaim[];
        __messageBusComputedValueChunks?: readonly ComputedValueChunkSpanClaim[];
      };
      const computedValueChunkClaims = [
        ...(computedValueChunkMetadata.__messageBusComputedValueChunkSpanClaims ?? []),
        ...(computedValueChunkMetadata.__messageBusComputedValueChunks ?? []),
      ];
      const computedMinimumActualSize = minimumActualSizeForComputedValueChunkClaims(
        participant.participant,
        graph.layout.participantInputs[participant.participant],
        fixedSize,
        blockSize,
        computedValueChunkClaims,
      );
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
        // The aggregate publishes this participant's block at `base`, so an absolute input coordinate witness
        // must be relocated by it. The participant's own build resolves such witnesses against its LOCAL frame
        // (measured: the root dynamic-chunk base is the local index 23), and `addInputs` below copies that
        // unlocker verbatim - so the published bytecode addresses an unrelated input.
        const publishedBase = graph.layout.participantInputs[participant.participant] ?? 0;
        const masterUnlocker = local.inputs[0]?.unlocker as {
          abiFunction?: { name?: string; inputs?: readonly { name: string }[] };
          params?: unknown[];
          syncEncodedArgsFromParams?: (onlyIndices?: readonly number[]) => void;
        } | undefined;
        const chunkIndex = masterUnlocker?.abiFunction?.inputs?.findIndex(
          (input) => input.name === '__internal__dynamicChunkInputBase',
        ) ?? -1;
        const localChunkBase = chunkIndex < 0 ? undefined : masterUnlocker?.params?.[chunkIndex];
        // The participant resolved these witnesses against its own frame, but the aggregate publishes that frame
        // at `publishedBase`, so a witness the covenant addresses in TRANSACTION coordinates must be relocated.
        // The unlocker documents `syncEncodedArgsFromParams` for exactly this: it re-encodes the mutated slot and
        // drops the cached unlocking bytecode. Without the resync the edit is invisible and the published script
        // keeps addressing the participant-local coordinate.
        //   `__internal__dynamicChunkInputBase`  - read with OP_UTXOBYTECODE (measured: a funder instead of the
        //                                          chunk NFT).
        //   `__internal__vmapBatchPredOut_<slot>` - read with OP_OUTPUTBYTECODE (measured: the displaced
        //                                          predecessor's P' output instead of this participant's).
        // layout-sentinel / PredOut: tagged absent/inactive sentinels stay untouched — only active coordinates relocate.
        // A value outside this frame's extent cannot be a participant-local coordinate.
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
            if (!layoutWitnessIsActiveCoordinate(value) || value >= BigInt(candidate.limit)) continue;
            dynLocalBase = Number(value);
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
          const pendingInsert = value === -1n && targetSlot !== undefined
            && predecessorCommitment.length >= 64
            && predecessorCommitment.slice(0, 64).toLowerCase() !== targetSlot.toLowerCase();
          // A route INSERT can retain -1 until its P' output exists in this physical frame. Other negative
          // sentinels remain inactive; non-negative witnesses must still address the participant-local frame.
          if ((!layoutWitnessIsActiveCoordinate(value) && !pendingInsert)
            || (layoutWitnessIsActiveCoordinate(value) && value >= BigInt(candidate.limit))) continue;
          let physicalLocalOffset: number | undefined;
          if (targetSlot !== undefined && predecessorCommitment.length >= 128) {
            const plannedPredecessor = `${predecessorCommitment.slice(0, 64)}${targetSlot}`
              + predecessorCommitment.slice(128);
            const found = local.outputs.findIndex((output) => output.token?.category === participantCategory
              && commitmentHex(output.token?.nft?.commitment).toLowerCase() === plannedPredecessor.toLowerCase());
            if (found >= 0) physicalLocalOffset = found;
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
            ...predOutPhysical.map((pred) => pred.physicalLocalOffset + 1),
          );
          // transaction layout authority: exactly one resolve per participant covering dyn + entry NEW + valueChunk + PredOut.
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
            claimCount: predOutPhysical.length + (pendingValueChunkClaim ? 1 : 0),
            dynamicWrites: pendingValueChunkClaim?.collection
              ? [pendingValueChunkClaim.collection] : [],
            selectedResources: pendingValueChunkClaim?.collection
              ? [pendingValueChunkClaim.collection] : [],
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
            usage: {
              maximumValueContinuationChunks: pendingValueChunkClaim?.chunkCount ?? 0,
            },
          });
          // Stamp digest into relocation log so dropping authorizeComposeParticipantLayout breaks sync metadata.
          publishedRelocations.push({
            name: `__kernel_plan_digest__${kernelAuthority.handlerJoinKey}`,
            from: kernelAuthority.phase.payload.materializationMode,
            to: kernelAuthority.digest,
          });
          // KernelExecutionPlan bytecode commitment: also stamp the bytecode commitment marker ASM so plan digests cannot be transplanted alone.
          publishedRelocations.push({
            name: `__kernel_plan_bytecode__${kernelAuthority.handlerJoinKey}`,
            from: 'SCKP',
            to: kernelAuthority.bytecodeCommitment,
          });
          // Deferred multi-claim batch layout resolve: collect claims for one deferred multi-claim batch resolve after every participant
          // frame is inspected. Transaction-global packing stays shared; claims are merged once.
          const transactionParticipants = plan.participants.map((entry) => ({
            participant: entry.participant,
            contractName: entry.artifact.contractName,
            blockLayout: entry.blockLayout === undefined ? undefined : {
              blockSize: entry.lifecycle?.balancedSpan ?? entry.blockLayout.blockSize,
              trailingBase: entry.blockLayout.trailingBase,
              trailingCapacity: entry.blockLayout.trailingCapacity,
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
            ...(pendingValueChunkClaim === undefined ? [] : [{
              participant: participant.participant,
              carrier: 'valueChunk' as const,
              collection: pendingValueChunkClaim.collection,
              roles: {
                outputSlot: publishedBase + pendingValueChunkClaim.localSlotOffset,
              },
              rangeWidth: Math.max(1, pendingValueChunkClaim.chunkCount),
            }]),
            ...predOutPhysical.map((pred) => ({
              participant: participant.participant,
              carrier: 'sortedBatch' as const,
              collection: pred.witnessName,
              roles: {
                outputSlot: publishedBase + pred.physicalLocalOffset,
              },
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
            valueChunkBandOffset: pendingValueChunkClaim === undefined
              ? undefined
              : pendingValueChunkClaim.localSlotOffset - routeTrailingBase,
            valueChunkCollection: pendingValueChunkClaim?.collection,
            valueChunkCount: pendingValueChunkClaim?.chunkCount,
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
      // ahead-of-time compose coverage/I4: sticky scalar post-state immediately before publish. Proxy `__forward` / message-bus
      // shells can leave fixed data NFTs at input commitment or a wrong leftover +1; apply after
      // local rewrites/mirrors so recipe converge does not need extract-from-failed-VM.
      // Writer metadata for proxy+executionArtifact must come from the impl (ping), while the NFT
      // commitments live on the proxy participant layout/artifact.
      if (participant.blockLayout && participant.artifact.stateLayout) {
        const writingRows = (participant.invocations ?? []).flatMap((invocationIndex) => {
          const descriptor = descriptors[invocationIndex];
          const planned = plan.invocations[invocationIndex];
          if (!descriptor || planned?.selectorHex === undefined) return [];
          const handlerArtifact = descriptor.executionArtifact ?? participant.artifact;
          const published = findMessageBusHandlerForInvocation(handlerArtifact, {
            function: descriptor.functionName,
            selectorHex: planned.selectorHex,
          });
          const selector = (published?.selector ?? planned.selectorHex).toLowerCase();
          const handler = handlerArtifact.abi.find((candidate) =>
            candidate.selector?.toLowerCase() === selector)
            ?? handlerArtifact.abi.find((candidate) => candidate.name === descriptor.functionName);
          if (!handler || handler.writesState === false) return [];
          const modifiers = handler.modifiers ?? [];
          if (modifiers.includes('view') || modifiers.includes('pure')) return [];
          return [{ handler, args: descriptor.args }];
        });
        stickyKernelLeftoverScalarWrites(
          local, participant.artifact, participant.blockLayout, writingRows,
        );
      }
      for (let localIndex = 0; localIndex < local.inputs.length; localIndex++) {
        const input = local.inputs[localIndex];
        registerAggregateInput(input, participant.participant, localIndex, 'participant block');
      }
      aggregate.addInputs(local.inputs);
      aggregate.addOutputs(local.outputs as Output[]);
    }

    // Deferred multi-claim batch layout resolve: one deferred multi-claim batch resolve for every collected participant, then validate-all-then-write apply.
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
    const messageEnvelope = encodeAtomicMessageEnvelope(graph.callManifest);
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
      const batchBlob = participant.batch.blob;
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
          .map((input, index) => ({ input, value: participant.batch.routeWitnesses[index] }))
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
          throw new Error(
            'materialization: recipe mode forbids deferred-compute VM discovery as planner authority; '
            + `unresolved participant(s) ${unresolvedUnderRecipe.map((block) => block.participant).join(', ')} `
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
        recordActiveConstraintPass('deferred-compute', discoveryState, deferredCycle);
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
          // executor. Probing only the executor left the compute reads unreached (measured on the marketplace
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
            const describe = (item: { token?: { category?: string; nft?: { capability?: string; commitment?: string } } } | undefined, index: number): unknown => ({
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
                if (opcode >= 1 && opcode <= 75) { lengths.push(opcode); cursor += 1 + opcode; }
                else if (opcode === 0x4c && cursor + 1 < unlocking.length) {
                  const size = unlocking[cursor + 1]; lengths.push(size); cursor += 2 + size;
                } else if (opcode === 0x00) { lengths.push(0); cursor += 1; }
                else break;
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
          `messageBus: deferred compute resources did not converge for participant(s) `
          + unresolved.map((block) => block.participant).join(', '),
        );
      }
    }
    return { builder: aggregate, actualSizes, incompleteDynamicChunks };
}
