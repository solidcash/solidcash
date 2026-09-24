/**
 * phase-boundary extract: Compose phase-boundary extract — lifecycle validation, indexes, slots, deployments, assembly runtime.
 */

import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { StatefulContract } from '../stateful/StatefulContract.js';
import { assertAtomicParticipantCapacity } from './capacity.js';
import {
  createComposeAssemblyRuntime,
  type ComposeAssemblyRuntime,
} from './compose-assembly-runtime.js';
import { composeDeploymentSlotEffects } from './compose-deployment-effects.js';
import { resolveComposeLifecycleMaps } from './compose-lifecycle-maps.js';
import { materializeComposeDeployments } from './compose-materialize-deployments.js';
import { resolveComposeParticipantIndexes } from './compose-participant-indexes.js';
import type { CallDescriptor, ComposeAtomicMessageBusOptions } from './compose-prepared-invocation.js';
import { validateComposePreparedCallArguments } from './compose-prepared-call-validation.js';
import { inventoryComposeSlots, type ComposeSlotInventory } from './compose-slot-inventory.js';
import { validateComposeUpgradeTargets } from './compose-upgrade-validation.js';
import {
  finalizeAtomicInvocationGraph,
  type AtomicDeploymentSlotEffect,
  type AtomicEventSlotEffect,
  type AtomicResourceSlotEffect,
  type AtomicSidecarSlotEffect,
  type AtomicTokenSlotEffect,
  type AtomicValueSlotEffect,
} from './graph.js';
import { deriveCompiledGraphPlan } from './worklist.js';

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;
type FinalizedGraph = ReturnType<typeof finalizeAtomicInvocationGraph>;

export interface CreateComposeSettlementContextInput {
  options: ComposeAtomicMessageBusOptions;
  descriptors: readonly CallDescriptor[];
  descriptorWitnesses: readonly Readonly<Record<string, FunctionArgument>>[];
  feeFunder: UnlockableUtxo;
  rootCaller: Uint8Array;
  provider: NetworkProvider;
  upgradeOutputs: ReadonlyMap<string, string>;
  upgradeStateSuffixes: Map<string, Uint8Array>;
  stateOf: (contract: StatefulContract) => Promise<Record<string, unknown>>;
  plan: CompiledGraphPlan;
  returning: CompiledGraphPlan['invocations'];
  preparedResults: Readonly<Record<number, string>>;
  provisionalResults: Readonly<Record<number, string>>;
  byLockingBytecode: Map<string, StatefulContract>;
  descriptorByLockingBytecode: Map<string, CallDescriptor>;
  categories: readonly string[];
  logicalIdentities: Map<number, import('../stateful/logical-identity.js').ResolvedLogicalIdentity>;
  splitByParticipant: ReturnType<typeof resolveComposeLifecycleMaps>['splitByParticipant'];
  mergeByParticipant: ReturnType<typeof resolveComposeLifecycleMaps>['mergeByParticipant'];
  selfdestructByParticipant: ReturnType<typeof resolveComposeLifecycleMaps>['selfdestructByParticipant'];
}

export interface ComposeSettlementContext {
  slots: ComposeSlotInventory;
  selfdestructByParticipant: ReturnType<typeof resolveComposeLifecycleMaps>['selfdestructByParticipant'];
  deploymentEffects: AtomicDeploymentSlotEffect[];
  provisionalEventEffects: AtomicEventSlotEffect[];
  provisionalResourceEffects: AtomicResourceSlotEffect[];
  provisionalValueEffects: AtomicValueSlotEffect[];
  provisionalTokenEffects: AtomicTokenSlotEffect[];
  provisionalSidecarEffects: AtomicSidecarSlotEffect[];
  finalized: FinalizedGraph;
  runtime: ComposeAssemblyRuntime;
}

/**
 * After participant indexes + prepared results are known (and initial result propagation has settled),
 * inventory slots, materialize deployments, seed an empty provisional graph, and build the assembly runtime.
 */
export function createComposeSettlementContext(
  input: CreateComposeSettlementContextInput,
): ComposeSettlementContext {
  const slots = inventoryComposeSlots(input.plan);
  const suppliedDeployments = input.options.childDeployments ?? [];
  const usedDeployments = new Set<number>();
  const materializedDeployments = materializeComposeDeployments({
    plan: input.plan,
    descriptors: input.descriptors,
    byLockingBytecode: input.byLockingBytecode,
    suppliedDeployments,
    usedDeployments,
    provider: input.provider,
  });
  if (usedDeployments.size !== suppliedDeployments.length) {
    throw new Error('messageBus: child genesis input does not name a selected compiler-published deployment site');
  }
  const deploymentEffects: AtomicDeploymentSlotEffect[] = composeDeploymentSlotEffects(
    materializedDeployments,
  );
  const provisionalEventEffects: AtomicEventSlotEffect[] = [];
  const provisionalResourceEffects: AtomicResourceSlotEffect[] = [];
  const provisionalValueEffects: AtomicValueSlotEffect[] = [];
  const provisionalTokenEffects: AtomicTokenSlotEffect[] = [];
  const provisionalSidecarEffects: AtomicSidecarSlotEffect[] = [];
  const finalized = finalizeAtomicInvocationGraph(
    input.plan, input.categories, input.provisionalResults, provisionalEventEffects, provisionalResourceEffects,
    provisionalValueEffects,
    provisionalTokenEffects,
    provisionalSidecarEffects,
    undefined,
    deploymentEffects,
  );
  const runtime = createComposeAssemblyRuntime({
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
    runtimeEventSlots: slots.runtimeEventSlots,
    sidecarSlots: slots.sidecarSlots,
    materializedDeployments,
    // settle-time ExecutionContext: thread full slot inventory into admit for effect-plan coverage.
    slotInventory: slots,
  });
  return {
    slots,
    selfdestructByParticipant: input.selfdestructByParticipant,
    deploymentEffects,
    provisionalEventEffects,
    provisionalResourceEffects,
    provisionalValueEffects,
    provisionalTokenEffects,
    provisionalSidecarEffects,
    finalized,
    runtime,
  };
}

/**
 * Validate lifecycle maps / upgrade targets / prepared-call args and resolve participant indexes.
 */
export async function resolveComposeValidatedIndexes(
  plan: CompiledGraphPlan,
  descriptors: readonly CallDescriptor[],
  descriptorWitnesses: readonly Readonly<Record<string, FunctionArgument>>[],
  rootCaller: Uint8Array,
  upgradeOutputs: ReadonlyMap<string, string>,
  provider: NetworkProvider,
  options: ComposeAtomicMessageBusOptions,
): Promise<{
  splitByParticipant: ReturnType<typeof resolveComposeLifecycleMaps>['splitByParticipant'];
  mergeByParticipant: ReturnType<typeof resolveComposeLifecycleMaps>['mergeByParticipant'];
  selfdestructByParticipant: ReturnType<typeof resolveComposeLifecycleMaps>['selfdestructByParticipant'];
  byLockingBytecode: Map<string, StatefulContract>;
  descriptorByLockingBytecode: Map<string, CallDescriptor>;
  categories: string[];
  logicalIdentities: Map<number, import('../stateful/logical-identity.js').ResolvedLogicalIdentity>;
  returning: CompiledGraphPlan['invocations'];
  preparedResults: Record<number, string>;
  provisionalResults: Record<number, string>;
}> {
  const lifecycle = resolveComposeLifecycleMaps(plan, options);
  validateComposeUpgradeTargets(plan, descriptors, upgradeOutputs);
  assertAtomicParticipantCapacity(plan.participants.length);
  validateComposePreparedCallArguments(plan, descriptors, descriptorWitnesses, rootCaller);
  const indexes = await resolveComposeParticipantIndexes(plan, descriptors, provider);
  return { ...lifecycle, ...indexes };
}
