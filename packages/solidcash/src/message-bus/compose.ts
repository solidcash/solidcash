import type { TransactionDetails } from '../interfaces.js';
import { TransactionBuilder } from '../TransactionBuilder.js';
import { StatefulFunctionCall } from '../stateful/StatefulContract.js';
import {
  clearComposeKernelAuthorityResults,
} from './compose-kernel-authority.js';

export {
  canSeedComputedValueChunkClaim,
  canOwnTransportedContinuationSlot,
  evaluateChildDeploymentRecipe,
  materializeFixedBchTransfer,
  materializeChildDeploymentEntryScalar,
  materializeChildDeploymentEntryValue,
  provisionalInvocationResult,
  evmInvocationResultLength,
  minimumActualSizeForComputedValueChunkClaims,
  stickyKernelLeftoverScalarWrites,
} from './compose-recipes.js';
export type { ComputedValueChunkSpanClaim } from './compose-recipes.js';

export {
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
  type ComposeAtomicMessageBusOptions,
  type PreparedAtomicMessageBusCall,
} from './compose-prepared-invocation.js';

export {
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
import {
  propagateResultDependentArguments as propagateComposeResultDependentArguments,
} from './compose-result-propagation.js';
import {
  runComposeSemanticClaimLoop,
} from './compose-semantic-claim-loop.js';
import {
  admitComposeFinalBuilder,
} from './compose-final-admit.js';
import {
  deriveComposeInvocationPlan,
} from './compose-plan-graph.js';
import {
  prepareComposeDescriptors,
} from './compose-prepare-descriptors.js';
import {
  createComposeSettlementContext,
  resolveComposeValidatedIndexes,
} from './compose-settlement-context.js';


/** One atomic message bus transaction, still mutable only through its explicit build/send methods. */
export class AtomicMessageBusComposition {
  public constructor(
    private readonly options: ComposeAtomicMessageBusOptions,
    private readonly resultPropagationDepth = 0,
  ) {}

  private async _build(): Promise<TransactionBuilder> {
    const {
      descriptors,
      feeFunder,
      rootCaller,
      provider,
      upgradeOutputs,
      upgradeStateSuffixes,
      stateOf,
      descriptorWitnesses,
    } = await prepareComposeDescriptors(this.options);
    const { plan } = deriveComposeInvocationPlan({
      descriptors,
      descriptorWitnesses,
      rootCaller,
      upgradeOutputs,
      requirePreparedIdentity: this.options.requirePreparedIdentity === true,
      hasPreparedCalls: this.options.preparedCalls !== undefined,
    });
    const {
      splitByParticipant,
      mergeByParticipant,
      selfdestructByParticipant,
      byLockingBytecode,
      descriptorByLockingBytecode,
      categories,
      logicalIdentities,
      returning,
      preparedResults,
      provisionalResults,
    } = await resolveComposeValidatedIndexes(
      plan, descriptors, descriptorWitnesses, rootCaller, upgradeOutputs, provider, this.options,
    );
    const propagateResultDependentArguments = (
      results: Readonly<Record<number, string>>,
    ): { propagated: boolean; calls: PreparedAtomicMessageBusCall[] } => (
      propagateComposeResultDependentArguments(
        { plan, descriptors, returning },
        results,
      )
    );
    // A graph-discovery seed is already semantically available on the first atomic pass. Rebuild expressions
    // which consume it before assembling the call manifest; waiting for the VM to discover a *different* result
    // leaves an unchanged seed permanently paired with the stale pre-discovery argument bytes.
    // Only explicit/precomputed results are available before the first VM discovery pass. Synthetic empty/true
    // seeds exist solely to let the route advance; feeding them into sibling arguments changes source semantics
    // before any covenant has authenticated the value.
    const initialPropagation = propagateResultDependentArguments(preparedResults);
    if (initialPropagation.propagated) {
      if (this.resultPropagationDepth >= descriptors.length) {
        throw new Error('messageBus: authenticated result arguments did not converge');
      }
      return new AtomicMessageBusComposition(
        { ...this.options, preparedCalls: initialPropagation.calls },
        this.resultPropagationDepth + 1,
      )._build();
    }
    const settlement = createComposeSettlementContext({
      options: this.options,
      descriptors,
      descriptorWitnesses,
      feeFunder,
      rootCaller,
      provider,
      upgradeOutputs,
      upgradeStateSuffixes,
      stateOf,
      plan,
      returning,
      preparedResults,
      provisionalResults,
      byLockingBytecode,
      descriptorByLockingBytecode,
      categories,
      logicalIdentities,
      splitByParticipant,
      mergeByParticipant,
      selfdestructByParticipant,
    });
    const {
      slots,
      deploymentEffects,
      provisionalEventEffects,
      provisionalResourceEffects,
      provisionalValueEffects,
      provisionalTokenEffects,
      provisionalSidecarEffects,
      finalized,
      runtime,
    } = settlement;
    const {
      fixedEventSlots,
      eventSlots,
      hasRuntimeLoopEvents,
      resourceSlots,
      valueSlots,
      tokenSlots,
      sidecarSlots,
      hasComputedValueChunks,
    } = slots;

    if (returning.length > 0 || fixedEventSlots.length > 0 || hasRuntimeLoopEvents
      || resourceSlots.length > 0 || hasComputedValueChunks
      || valueSlots.length > 0 || tokenSlots.length > 0 || sidecarSlots.length > 0) {
      return runComposeSemanticClaimLoop(
        {
          plan,
          categories,
          provider,
          byLockingBytecode,
          returning,
          provisionalResults,
          provisionalEventEffects,
          provisionalResourceEffects,
          provisionalValueEffects,
          provisionalTokenEffects,
          provisionalSidecarEffects,
          deploymentEffects,
          fixedEventSlots,
          hasRuntimeLoopEvents,
          resourceSlots,
          valueSlots,
          tokenSlots,
          sidecarSlots,
          hasComputedValueChunks,
          eventSlots,
          selfdestructByParticipant,
          descriptorsLength: descriptors.length,
          resultPropagationDepth: this.resultPropagationDepth,
          runtime,
          propagateResultDependentArguments,
        },
        (calls) => new AtomicMessageBusComposition(
          { ...this.options, preparedCalls: calls },
          this.resultPropagationDepth + 1,
        )._build(),
      );
    }
    return admitComposeFinalBuilder({
      plan,
      categories,
      provisionalResults,
      provisionalEventEffects,
      provisionalResourceEffects,
      provisionalValueEffects,
      provisionalTokenEffects,
      provisionalSidecarEffects,
      deploymentEffects,
      finalized,
      runtime,
    });
  }

  /** Build the complete transaction without broadcasting; all signatures are generated from this final shape. */
  build(): Promise<TransactionBuilder> { return this._build(); }

  async send(): Promise<TransactionDetails> { return (await this._build()).send() as Promise<TransactionDetails>; }
}

/**
 * Composition is deferred, so its public inputs must not retain caller-owned mutable arrays, byte vectors, or
 * plain struct records. Preserve class instances (contracts, unlockers, signature templates) by identity: they
 * are capabilities rather than ABI values and cloning them would change their behavior. The resulting private
 * snapshot is never exposed, so copied Uint8Arrays cannot subsequently be mutated by the caller.
 */
const snapshotCompositionValue = <T>(value: T): T => {
  if (value instanceof Uint8Array) return Uint8Array.from(value) as T;
  if (Array.isArray(value)) return Object.freeze(value.map(snapshotCompositionValue)) as T;
  if (!value || typeof value !== 'object') return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  return Object.freeze(Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .map(([key, child]) => [key, snapshotCompositionValue(child)]))) as T;
};

const snapshotPreparedCall = (call: PreparedAtomicMessageBusCall): PreparedAtomicMessageBusCall =>
  snapshotCompositionValue(call);

export function compose(options: ComposeAtomicMessageBusOptions): AtomicMessageBusComposition {
  // Capture StatefulFunctionCall descriptors immediately. A prepared call is a value-level graph statement;
  // retaining the call object deferred both its externally-owned ABI args and any later imperative mutation.
  if (!options.calls && !options.preparedCalls) {
    throw new Error('messageBus: composition requires calls or preparedCalls');
  }
  clearComposeKernelAuthorityResults();
  const preparedCalls = options.preparedCalls
    ?? options.calls!.map((call) => call._messageBusCompositionDescriptor());
  const { calls: _calls, preparedCalls: _preparedCalls, ...rest } = options;
  return new AtomicMessageBusComposition(Object.freeze({
    ...snapshotCompositionValue(rest),
    requirePreparedIdentity: options.preparedCalls !== undefined,
    preparedCalls: Object.freeze(preparedCalls.map(snapshotPreparedCall)),
  }));
}
