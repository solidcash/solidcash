/**
 * phase-boundary extract: Compose phase-boundary extract — semantic claim derivation loop with result-propagation rebuild.
 * constraint fixpoint: claim-pass progression uses the same MonotoneCell lattice as resource/chunk converges.
 */

import type NetworkProvider from '../network/NetworkProvider.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { StatefulContract } from '../stateful/StatefulContract.js';
import type { ComposeAssemblyRuntime } from './compose-assembly-runtime.js';
import type { ComputedValueChunkClaim } from './compose-participant-helpers.js';
import {
  applySemanticClaimObservationPass,
  semanticJson,
  type PreparedAtomicMessageBusCall,
} from './compose-prepared-invocation.js';
import {
  observeComposeSemanticEffects,
  type ComposeSemanticEffectClaims,
} from './compose-semantic-effects.js';
import { seedComposeComputedClaims } from './compose-seed-computed-claims.js';
import { freezeStaticcallParticipantOutputs } from './compose-participant-helpers.js';
import {
  dynamicChunkPlaceholdersRemain,
} from './computed-dynamic-chunks.js';
import {
  finalizeAtomicInvocationGraph,
  type AtomicDeploymentSlotEffect,
  type AtomicEventSlotEffect,
  type AtomicResourceSlotEffect,
  type AtomicSidecarSlotEffect,
  type AtomicTokenSlotEffect,
  type AtomicValueSlotEffect,
} from './graph.js';
import {
  MonotoneCell,
  finalizeMonotonePass,
  recordMonotonePass,
} from './monotone-lattice.js';
import { deriveCompiledGraphPlan } from './worklist.js';
import { recordActiveConstraintPass } from '../stateful/value-chunk-persist.js';

/**
 * Record one non-final semantic claim fingerprint on the monotone lattice.
 * Repeated non-final states refuse (cycle), matching resource/chunk converge.
 */
export function recordSemanticClaimPass(
  lattice: MonotoneCell<string>,
  seen: Set<string>,
  claimState: string,
): void {
  // constraint fixpoint: semantic-claim passes share the same recordMonotonePass helper as
  // resource / value-chunk / dynamic-chunk / deferred-compute converges.
  const cycleMessage = 'messageBus: semantic derivation entered a repeated non-final claim state';
  recordMonotonePass(lattice, seen, claimState, cycleMessage);
  // Also fingerprint onto the settlement multi-domain fixpoint session.
  recordActiveConstraintPass('semantic-claim', claimState, cycleMessage);
}

/** Resolve the claim lattice when the graph is admitted stable. */
export function finalizeSemanticClaimLattice(
  lattice: MonotoneCell<string>,
  claimState: string,
): void {
  finalizeMonotonePass(lattice, claimState);
}

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;
type FinalizedGraph = ReturnType<typeof finalizeAtomicInvocationGraph>;

export interface RunComposeSemanticClaimLoopContext {
  plan: CompiledGraphPlan;
  categories: readonly string[];
  provider: NetworkProvider;
  byLockingBytecode: Map<string, StatefulContract>;
  returning: CompiledGraphPlan['invocations'];
  provisionalResults: Readonly<Record<number, string>>;
  provisionalEventEffects: readonly AtomicEventSlotEffect[];
  provisionalResourceEffects: readonly AtomicResourceSlotEffect[];
  provisionalValueEffects: readonly AtomicValueSlotEffect[];
  provisionalTokenEffects: readonly AtomicTokenSlotEffect[];
  provisionalSidecarEffects: readonly AtomicSidecarSlotEffect[];
  deploymentEffects: readonly AtomicDeploymentSlotEffect[];
  fixedEventSlots: readonly { participant: number; offset: number }[];
  hasRuntimeLoopEvents: boolean;
  resourceSlots: readonly { participant: number; offset: number; kind: string }[];
  valueSlots: readonly { participant: number; offset: number }[];
  tokenSlots: readonly { participant: number; offset: number }[];
  sidecarSlots: readonly { participant: number; offset: number; kind: AtomicSidecarSlotEffect['kind'] }[];
  hasComputedValueChunks: boolean;
  eventSlots: () => readonly {
    participant: number; offset: number; runtimeRow?: number; eventSignature?: string;
  }[];
  selfdestructByParticipant: ReadonlyMap<number, unknown>;
  descriptorsLength: number;
  resultPropagationDepth: number;
  runtime: Pick<
    ComposeAssemblyRuntime,
    | 'rebalanceFeeTail'
    | 'eventLockingBytecodes'
    | 'eventLockingBytecodeAtOffset'
    | 'eventLockingBytecodeForCommitment'
    | 'assemble'
    | 'admit'
    | 'actualSpansMatch'
    | 'deriveReturnResults'
  >;
  propagateResultDependentArguments: (
    results: Readonly<Record<number, string>>,
  ) => { propagated: boolean; calls: PreparedAtomicMessageBusCall[] };
}

/**
 * Drive claim-bounded assemble → return-derive → seed → observe passes until the graph is stable,
 * admitting the provisional builder. When authenticated results rewrite prepared arguments, invoke
 * `rebuildWithPreparedCalls` so the caller can recurse through a fresh composition.
 */
export async function runComposeSemanticClaimLoop(
  ctx: RunComposeSemanticClaimLoopContext,
  rebuildWithPreparedCalls: (
    calls: PreparedAtomicMessageBusCall[],
  ) => Promise<TransactionBuilder>,
): Promise<TransactionBuilder> {
  const {
    plan, categories, provider, byLockingBytecode, returning,
    provisionalResults, provisionalEventEffects, provisionalResourceEffects,
    provisionalValueEffects, provisionalTokenEffects, provisionalSidecarEffects,
    deploymentEffects, fixedEventSlots, hasRuntimeLoopEvents, resourceSlots, valueSlots,
    tokenSlots, sidecarSlots, hasComputedValueChunks, eventSlots, selfdestructByParticipant,
    descriptorsLength, resultPropagationDepth, runtime, propagateResultDependentArguments,
  } = ctx;
  const {
    rebalanceFeeTail, eventLockingBytecodes, eventLockingBytecodeAtOffset,
    eventLockingBytecodeForCommitment, assemble, admit, actualSpansMatch, deriveReturnResults,
  } = runtime;

  let claimedResults: Readonly<Record<number, string>> = provisionalResults;
  let claimedEventEffects: readonly AtomicEventSlotEffect[] = provisionalEventEffects;
  let claimedResourceEffects: readonly AtomicResourceSlotEffect[] = provisionalResourceEffects;
  let claimedValueEffects: readonly AtomicValueSlotEffect[] = provisionalValueEffects;
  let claimedTokenEffects: readonly AtomicTokenSlotEffect[] = provisionalTokenEffects;
  let claimedSidecarEffects: readonly AtomicSidecarSlotEffect[] = provisionalSidecarEffects;
  let claimedComputedValueChunks: readonly ComputedValueChunkClaim[] = [];
  // Every value below is a claim which can feed a later assembly pass. Usage is one discovery pass per
  // mutable claim plus a confirmation pass (`mutableClaimCount + 2`). published semantic-derivation ceiling: the compiler publishes
  // `resourceBudgets.maximumSemanticDerivationPasses` as the worst-case ceiling — refuse when usage
  // would exceed that plan-published bound (replaces the old undocumented `invocations + 5` class).
  const mutableClaimCount = returning.length + fixedEventSlots.length + resourceSlots.length
    + (hasRuntimeLoopEvents ? 1 : 0)
    + valueSlots.length + tokenSlots.length + sidecarSlots.length + (hasComputedValueChunks ? 1 : 0);
  const maximumPasses = mutableClaimCount + 2;
  const publishedPassCeiling = plan.participants
    .map((entry) => entry.artifact.messageBus?.resourceBudgets?.maximumSemanticDerivationPasses)
    .find((ceiling): ceiling is number => typeof ceiling === 'number');
  if (publishedPassCeiling !== undefined && maximumPasses > publishedPassCeiling) {
    throw new Error(
      `messageBus: semantic derivation needs ${maximumPasses} passes but resourceBudgets `
      + `maximumSemanticDerivationPasses is ${publishedPassCeiling}`,
    );
  }
  const seenClaimStates = new Set<string>();
  const claimLattice = new MonotoneCell<string>();
  let finalized: FinalizedGraph;
  let latestClaimState = '';
  for (let pass = 0; pass < maximumPasses; pass += 1) {
    const claimState = semanticJson({
      results: claimedResults,
      events: claimedEventEffects,
      resources: claimedResourceEffects,
      values: claimedValueEffects,
      tokens: claimedTokenEffects,
      sidecars: claimedSidecarEffects,
      computedValueChunks: claimedComputedValueChunks,
    });
    latestClaimState = claimState;
    recordSemanticClaimPass(claimLattice, seenClaimStates, claimState);
    finalized = finalizeAtomicInvocationGraph(
      plan, categories, claimedResults, claimedEventEffects, claimedResourceEffects, claimedValueEffects,
      claimedTokenEffects,
      claimedSidecarEffects,
      undefined,
      deploymentEffects,
    );
    let assembled = await assemble(finalized, claimedResults);
    if (!actualSpansMatch(finalized, assembled.actualSizes)) {
      finalized = finalizeAtomicInvocationGraph(
        plan, categories, claimedResults, claimedEventEffects, claimedResourceEffects, claimedValueEffects,
        claimedTokenEffects, claimedSidecarEffects, assembled.actualSizes,
        deploymentEffects,
      );
      assembled = await assemble(finalized, claimedResults);
      if (!actualSpansMatch(finalized, assembled.actualSizes)) {
        throw new Error('messageBus: participant spans did not converge after compact assembly');
      }
    }
    const provisional = assembled.builder;
    // A fresh local assembly can contain resource placeholders even when the preceding semantic pass already
    // established their exact commitments. Restore those claims before probing returns: an earlier entry or
    // chunk check can otherwise hide the completed return forever, including on an apparently stable pass.
    const {
      valueChunkConvergence,
      dynamicChunkConvergence,
    } = seedComposeComputedClaims({
      provisional,
      finalized,
      plan,
      provider,
      resourceSlots,
      claimedResourceEffects,
      claimedComputedValueChunks,
      rebalanceFeeTail,
    });
    // Return values are upstream of state/resource derivation. If a pass discovers a new return vector,
    // rebuild immediately before validating outputs which may still contain unresolved chunk placeholders.
    const incompleteParticipants = new Set(
      assembled.incompleteDynamicChunks.map((item) => item.participant),
    );
    const missingReturnParticipants = new Set<number>();
    const derivedResults = deriveReturnResults(
      finalized, provisional, claimedResults, missingReturnParticipants,
    );
    if (returning.some((invocation) =>
      derivedResults[invocation.index] !== claimedResults[invocation.index])) {
      // Some compiler-authored arguments contain an earlier invocation's result inside a larger expression
      // (for example a struct field or abi.encodePacked). Once the VM exposes an updated authenticated result,
      // rebuild those complete expressions and restart planning: argsHex, route-key witnesses, participant
      // batches, and the call manifest all depend on the argument bytes and must change atomically.
      const propagation = propagateResultDependentArguments(derivedResults);
      if (propagation.propagated) {
        if (resultPropagationDepth >= descriptorsLength) {
          throw new Error('messageBus: authenticated result arguments did not converge');
        }
        return rebuildWithPreparedCalls(propagation.calls);
      }
      claimedResults = derivedResults;
      continue;
    }
    // Independent semantic effects share one complete-graph observation pass. Record mutations monotonically,
    // but do not restart until fixed resource/value/token/sidecar/event observations have also been collected;
    // otherwise an earlier provisional class can permanently starve a later class which it needs to pass.
    const semanticEffectClaims: ComposeSemanticEffectClaims = {
      get computedValueChunks() { return claimedComputedValueChunks; },
      set computedValueChunks(value) { claimedComputedValueChunks = value; },
      get resourceEffects() { return claimedResourceEffects; },
      set resourceEffects(value) { claimedResourceEffects = value; },
      get valueEffects() { return claimedValueEffects; },
      set valueEffects(value) { claimedValueEffects = value; },
      get tokenEffects() { return claimedTokenEffects; },
      set tokenEffects(value) { claimedTokenEffects = value; },
      get sidecarEffects() { return claimedSidecarEffects; },
      set sidecarEffects(value) { claimedSidecarEffects = value; },
      get eventEffects() { return claimedEventEffects; },
      set eventEffects(value) { claimedEventEffects = value; },
    };
    const {
      semanticObservations,
      derivedEventEffects,
      derivedResourceEffects,
      derivedValueEffects,
      derivedTokenEffects,
      derivedSidecarEffects,
    } = observeComposeSemanticEffects(
      {
        provisional,
        finalized,
        plan,
        categories,
        byLockingBytecode,
        resourceSlots,
        valueSlots,
        tokenSlots,
        sidecarSlots,
        eventSlots,
        incompleteParticipants,
        valueChunkConvergence,
        eventLockingBytecodes,
        eventLockingBytecodeAtOffset,
        eventLockingBytecodeForCommitment,
        rebalanceFeeTail,
        selfdestructByParticipant,
      },
      semanticEffectClaims,
    );
    const semanticClaimsChanged = applySemanticClaimObservationPass(semanticObservations);
    let stable = !semanticClaimsChanged;
    if (JSON.stringify(derivedEventEffects) !== JSON.stringify(claimedEventEffects)) stable = false;
    if (stable) {
      if (missingReturnParticipants.size > 0) {
        throw new Error(
          `messageBus: stable graph did not expose return vectors for participant(s) `
          + [...missingReturnParticipants].join(', '),
        );
      }
      // Local builders freeze `00` placeholders; complete-graph OTC convergence above may already have
      // replaced them. Only fail closed when a placeholder still remains on the owned trailing chunk run.
      if (dynamicChunkPlaceholdersRemain(
        provisional, dynamicChunkConvergence, assembled.incompleteDynamicChunks,
      )) {
        const detail = assembled.incompleteDynamicChunks.map((item) =>
          `${item.participant}:${item.variable} (${item.resolved}/${item.total})`).join(', ');
        throw new Error(`messageBus: stable graph retains incomplete dynamic chunks: ${detail}`);
      }
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
        console.error('atomic-composed-layout', {
          participantInputs: finalized.layout.participantInputs,
          actualSizes: assembled.actualSizes,
          participants: plan.participants.map((participant) => ({
            participant: participant.participant,
            lockingBytecode: participant.lockingBytecode,
            invocations: participant.invocations.map((invocation) =>
              plan.invocations[invocation].function),
            maximumSize: participant.blockLayout?.blockSize,
            trailingBase: participant.blockLayout?.trailingBase,
          })),
        });
      }
      freezeStaticcallParticipantOutputs(
        provisional, plan, finalized.layout.participantInputs, assembled.actualSizes,
      );
      finalizeSemanticClaimLattice(claimLattice, latestClaimState);
      return admit(provisional);
    }
    claimedResults = derivedResults;
    claimedEventEffects = derivedEventEffects;
    claimedResourceEffects = derivedResourceEffects;
    claimedValueEffects = derivedValueEffects;
    claimedTokenEffects = derivedTokenEffects;
    claimedSidecarEffects = derivedSidecarEffects;
  }
  throw new Error(
    `messageBus: semantic derivation did not converge after ${maximumPasses} claim-bounded passes`,
  );
}
