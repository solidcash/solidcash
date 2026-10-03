/**
 * phase-boundary extract: Compose phase-boundary extract — assembly/admit/derive runtime closures for `_build`.
 */

import type { Output, UnlockableUtxo, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { StatefulContract } from '../stateful/StatefulContract.js';
import type { ResolvedLogicalIdentity } from '../stateful/logical-identity.js';
import {
  assembleAtomicComposition,
  type AssembleAtomicCompositionContext,
} from './compose-assemble.js';
import {
  deriveReturnResults as deriveComposeReturnResults,
  type DeriveReturnResultsContext,
} from './compose-derive-return-results.js';
import {
  admitCompositionBuilder,
} from './compose-admit.js';
import type { ComposeSlotInventory } from './compose-slot-inventory.js';
import {
  rebalanceFeeTail as rebalanceComposeFeeTail,
  eventCandidates as composeEventCandidates,
  eventLockingBytecodes as composeEventLockingBytecodes,
  eventLockingBytecodeAtOffset as composeEventLockingBytecodeAtOffset,
  eventLockingBytecodeForCommitment as composeEventLockingBytecodeForCommitment,
  type ComposeEventHelpersContext,
} from './compose-event-helpers.js';
import type { CallDescriptor, ComposeAtomicMessageBusOptions } from './compose-prepared-invocation.js';
import type { MaterializedComposeDeployment } from './compose-materialize-deployments.js';
import {
  finalizeAtomicInvocationGraph,
  type AtomicSidecarSlotEffect,
} from './graph.js';
import { deriveCompiledGraphPlan } from './worklist.js';
import {
  participantReturnBlob as composeParticipantReturnBlob,
  participantReturnCommitment as composeParticipantReturnCommitment,
} from './compose-return-blobs.js';

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;
type FinalizedGraph = ReturnType<typeof finalizeAtomicInvocationGraph>;
type PlanParticipant = CompiledGraphPlan['participants'][number];

export interface CreateComposeAssemblyRuntimeInput {
  options: ComposeAtomicMessageBusOptions;
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
  preparedResults: Readonly<Record<number, string>>;
  logicalIdentities: Map<number, ResolvedLogicalIdentity>;
  runtimeEventSlots: Map<number, Array<{
    participant: number; offset: number; runtimeRow: number; eventSignature: string;
  }>>;
  sidecarSlots: readonly {
    participant: number; offset: number; kind: AtomicSidecarSlotEffect['kind'];
  }[];
  materializedDeployments: readonly MaterializedComposeDeployment[];
  /** settle-time ExecutionContext: full slot inventory for admit-time effect-plan coverage checks. */
  slotInventory?: ComposeSlotInventory;
}

export interface ComposeAssemblyRuntime {
  rebalanceFeeTail: (builder: TransactionBuilder, subject: string) => void;
  eventCandidates: (participant: PlanParticipant) => ReturnType<typeof composeEventCandidates>;
  eventLockingBytecodes: (participant: PlanParticipant) => string[];
  eventLockingBytecodeAtOffset: (participant: PlanParticipant, offset: number) => string | undefined;
  eventLockingBytecodeForCommitment: (
    participant: PlanParticipant, commitment: string,
  ) => string | undefined;
  assemble: (
    graph: FinalizedGraph,
    results: Readonly<Record<number, string>>,
  ) => Promise<{
    builder: TransactionBuilder;
    actualSizes: readonly number[];
    incompleteDynamicChunks: readonly {
      participant: number; variable: string; resolved: number; total: number;
    }[];
  }>;
  admit: (builder: TransactionBuilder) => TransactionBuilder;
  actualSpansMatch: (graph: FinalizedGraph, sizes: readonly number[]) => boolean;
  deriveReturnResults: (
    graph: FinalizedGraph,
    provisional: TransactionBuilder,
    priorResults: Readonly<Record<number, string>>,
    missingParticipants: Set<number>,
  ) => Record<number, string>;
  participantReturnBlob: (
    participant: number, results: Readonly<Record<number, string>>,
  ) => Uint8Array | undefined;
  participantReturnCommitment: (blob: Uint8Array | undefined) => Uint8Array | undefined;
}

/**
 * Build the assemble/admit/derive closures and fee/event helpers used by the semantic claim loop.
 */
export function createComposeAssemblyRuntime(
  input: CreateComposeAssemblyRuntimeInput,
): ComposeAssemblyRuntime {
  const participantReturnBlob = (
    participant: number, results: Readonly<Record<number, string>>,
  ): Uint8Array | undefined => composeParticipantReturnBlob(input.plan, participant, results);
  const participantReturnCommitment = (
    blob: Uint8Array | undefined,
  ): Uint8Array | undefined => composeParticipantReturnCommitment(blob);

  // Computed side-cars can depend on values which only exist in the complete atomic transaction. Once learned,
  // their fixed participant slots are independent of the graph's semantic claim pass, so retain them rather than
  // re-running the recovery/keccak witness synthesis every time a verifier claim changes.
  const deferredComputeCache = new Map<number, {
    graphKey: string;
    resources: ReadonlyMap<number, { input: UnlockableUtxo; output: Output }>;
  }>();

  const eventHelpersContext = (): ComposeEventHelpersContext => ({
    feeRate: input.options.feeRate,
    plan: input.plan,
    byLockingBytecode: input.byLockingBytecode,
    categories: input.categories,
  });
  const rebalanceFeeTail = (builder: TransactionBuilder, subject: string): void => {
    rebalanceComposeFeeTail(eventHelpersContext(), builder, subject);
  };
  const eventCandidates = (
    participant: PlanParticipant,
  ): ReturnType<typeof composeEventCandidates> => composeEventCandidates(eventHelpersContext(), participant);
  const eventLockingBytecodes = (
    participant: PlanParticipant,
  ): string[] => composeEventLockingBytecodes(eventHelpersContext(), participant);
  const eventLockingBytecodeAtOffset = (
    participant: PlanParticipant, offset: number,
  ): string | undefined => composeEventLockingBytecodeAtOffset(
    eventHelpersContext(), participant, offset,
  );
  const eventLockingBytecodeForCommitment = (
    participant: PlanParticipant, commitment: string,
  ): string | undefined => composeEventLockingBytecodeForCommitment(
    eventHelpersContext(), participant, commitment,
  );

  // PredOut preflight claims: PredOut physical claims collected during assemble, threaded into default preflight.
  const predOutClaimsSlot: AssembleAtomicCompositionContext['predOutClaimsSlot'] = {
    current: undefined,
  };
  let assembledPredOutClaimsByParticipant: AssembleAtomicCompositionContext['predOutClaimsSlot']['current'];
  const assembleContext = (): AssembleAtomicCompositionContext => ({
    options: input.options,
    descriptors: input.descriptors,
    feeFunder: input.feeFunder,
    rootCaller: input.rootCaller,
    provider: input.provider,
    upgradeStateSuffixes: input.upgradeStateSuffixes,
    stateOf: input.stateOf,
    plan: input.plan,
    splitByParticipant: input.splitByParticipant,
    mergeByParticipant: input.mergeByParticipant,
    selfdestructByParticipant: input.selfdestructByParticipant,
    byLockingBytecode: input.byLockingBytecode,
    descriptorByLockingBytecode: input.descriptorByLockingBytecode,
    categories: input.categories,
    logicalIdentities: input.logicalIdentities,
    runtimeEventSlots: input.runtimeEventSlots,
    sidecarSlots: input.sidecarSlots,
    materializedDeployments: input.materializedDeployments,
    participantReturnBlob,
    participantReturnCommitment,
    deferredComputeCache,
    rebalanceFeeTail,
    eventLockingBytecodes,
    predOutClaimsSlot,
  });
  const assemble = async (
    graph: FinalizedGraph,
    results: Readonly<Record<number, string>>,
  ): Promise<{
    builder: TransactionBuilder;
    actualSizes: readonly number[];
    incompleteDynamicChunks: readonly {
      participant: number; variable: string; resolved: number; total: number;
    }[];
  }> => {
    const assembled = await assembleAtomicComposition(assembleContext(), graph, results);
    assembledPredOutClaimsByParticipant = predOutClaimsSlot.current;
    return assembled;
  };
  const admit = (builder: TransactionBuilder): TransactionBuilder => (
    admitCompositionBuilder(
      {
        options: input.options,
        assembledPredOutClaimsByParticipant,
        ...(input.slotInventory !== undefined && { slotInventory: input.slotInventory }),
      },
      builder,
    )
  );
  const actualSpansMatch = (
    graph: FinalizedGraph, sizes: readonly number[],
  ): boolean => {
    for (let participant = 0; participant < sizes.length; participant += 1) {
      if (sizes[participant] !== graph.callManifest.participants[participant].actualSize) return false;
    }
    return true;
  };
  const deriveReturnResultsContext = (): DeriveReturnResultsContext => ({
    plan: input.plan,
    byLockingBytecode: input.byLockingBytecode,
    preparedResults: input.preparedResults,
    participantReturnBlob,
    participantReturnCommitment,
    rebalanceFeeTail,
  });
  const deriveReturnResults = (
    graph: FinalizedGraph, provisional: TransactionBuilder,
    priorResults: Readonly<Record<number, string>>, missingParticipants: Set<number>,
  ): Record<number, string> => deriveComposeReturnResults(
    deriveReturnResultsContext(), graph, provisional, priorResults, missingParticipants,
  );

  return {
    rebalanceFeeTail,
    eventCandidates,
    eventLockingBytecodes,
    eventLockingBytecodeAtOffset,
    eventLockingBytecodeForCommitment,
    assemble,
    admit,
    actualSpansMatch,
    deriveReturnResults,
    participantReturnBlob,
    participantReturnCommitment,
  };
}
