/**
 * phase-boundary extract: Prepared atomic invocation identity / rebuild / semantic claim observation.
 * (phase-boundary extract from compose.ts).
 */

import { hexToBin } from '@bitauth/libauth';
import type { Artifact, StateValue } from '@solidcash/utils';
import type { ConstructorArgument, FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo, Unlocker, Utxo } from '../interfaces.js';
import { StatefulContract, StatefulFunctionCall } from '../stateful/StatefulContract.js';
import type { ValueChunkWriteDescriptor } from '../stateful/StatefulTransactionBuilder.js';
import type { PlannedGraphInvocation } from './graph.js';
import {
  canonicalValueChunkProducerPathContext,
  canonicalValueChunkProducerResourceClaim,
  type ValueChunkProducerPathDisposition, type ValueChunkProducerResourceClaim,
} from '../stateful/ValueChunkProducerIdentity.js';


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
} from './compose-recipes.js';
export type { ComputedValueChunkSpanClaim } from './compose-recipes.js';

export interface AtomicMessageBusFunder {
  utxo: Utxo;
  unlocker: Unlocker;
}

export interface ComposeAtomicMessageBusOptions {
  /** Root call followed by the concrete calls reached in compiler-authored depth-first order. */
  calls?: readonly StatefulFunctionCall[];
  /** @internal Resolved calls used by transparent SDK graph promotion. */
  preparedCalls?: readonly PreparedAtomicMessageBusCall[];
  /** @internal Prepared calls came from compiler graph discovery and must carry an exact source tuple. */
  requirePreparedIdentity?: boolean;
  /** The one ordinary fee input. Its unlocker signs only after the messageEnvelope and all blocks are final. */
  funder: AtomicMessageBusFunder | UnlockableUtxo;
  changeAddress: string | Uint8Array;
  feeRate?: number;
  /** One token-free vout-0 genesis input for each selected compiler-published deployment site. */
  childDeployments?: readonly {
    invocationIndex: number;
    siteIndex: number;
    funder: AtomicMessageBusFunder | UnlockableUtxo;
  }[];
  /** Explicit participant-tail funding for one compiler-authenticated split invocation. */
  lifecycleSplits?: readonly {
    invocationIndex: number;
    funders: readonly (AtomicMessageBusFunder | UnlockableUtxo)[];
    /** Positive satoshi value assigned to each created minting master, in participant-relative order. */
    createdValues: readonly bigint[];
  }[];
  /** Exact minting masters consumed by one compiler-authenticated merge invocation. */
  lifecycleMerges?: readonly {
    invocationIndex: number;
    consumedMasters: readonly Utxo[];
  }[];
  /** Recipient locking bytecode for one compiler-authenticated resource-free selfdestruct invocation. */
  lifecycleSelfdestructs?: readonly {
    invocationIndex: number;
    recipient: string | Uint8Array;
  }[];
}

export interface PreparedAtomicMessageBusCall {
  contract: StatefulContract;
  functionName: string;
  /** Exact ABI entry-point selector. Required when `functionName` names distinct overloads. */
  selector?: string;
  args: readonly FunctionArgument[];
  /** @internal Compiler-stable identity of this invocation in its parent function. */
  callsiteId?: number;
  /** @internal Source callsite before physical repeated-owner collapsing. */
  sourceCallsiteId?: number;
  /** @internal Source-ordered row within a collapsed repeated-owner callsite. */
  sourceLogicalIndex?: number;
  /** @internal Reached runtime occurrence of the source callsite or source row. */
  occurrenceIndex?: number;
  /** @internal Compiler-authored program point shared with entry mutations in the parent handler. */
  sourceEffectOrdinal?: number;
  /** @internal Exact compiler outer-loop domain shared by callsites interleaved during graph discovery. */
  topologyOuterDomainKey?: string;
  /** @internal Reached outer induction iteration, before conditional calls are filtered. */
  topologyOuterIteration?: number;
  /** @internal Reached inner induction iteration for a compiler-published two-level call domain. */
  topologyInnerIteration?: number;
  /** @internal This parent's complete child order was reconstructed from compiler source-effect and loop IDs. */
  topologySourceScheduleComplete?: boolean;
  /** @internal Independently derived root-to-invocation compiler source path. */
  producerPath?: ValueChunkProducerPathDisposition;
  /** @internal Exact terminal post-values authenticated while discovering this compiler call edge. */
  valueChunkProductions?: readonly {
    write: ValueChunkWriteDescriptor;
    claim: ValueChunkProducerResourceClaim;
    stateOwner: { categoryId: string; lockingBytecode: string };
    value: Uint8Array;
  }[];
  /** @internal Recompute terminal productions after authenticated sibling results change this call's arguments. */
  resolveValueChunkProductionsFromArgs?: (
    args: readonly FunctionArgument[],
  ) => NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']>;
  /** @internal Refresh a write computed from this invocation's own authenticated child results. */
  resolveValueChunkProductionsFromResults?: (
    args: readonly FunctionArgument[],
    results: ReadonlyMap<number, FunctionArgument>,
  ) => NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']>;
  /** @internal Source-template identity for one runtime row of a collapsed repeated-call batch. */
  batchLogicalIndex?: number;
  /** @internal Source loop occurrence represented by this runtime batch row. */
  batchOccurrenceIndex?: number;
  /** Exact address value evaluated by the parent call expression, encoded as locking-bytecode hex. */
  targetLockingBytecode?: string;
  /** Delegate route artifact executed against `contract`'s state/category. */
  executionArtifact?: Artifact;
  /** Pinned delegate executor co-spent inside this participant's block. */
  executor?: StatefulContract;
  /** Authenticated in-place replacement selected for this participant's upgrade row. */
  upgradeTarget?: {
    artifact: Artifact;
    constructorArgs: readonly ConstructorArgument[];
    appendedState?: Readonly<Record<string, StateValue>>;
  };
  /**
   * Return-event commitment already derived while discovering this call graph. This is only an optimistic
   * fixed-point seed: the composed transaction still has to expose the same result and pass every covenant.
   */
  provisionalResultCommitment?: Uint8Array;
  /** @internal Rebuild arguments from sibling results and the current parent frame, in graph source order. */
  resolveArgsFromResults?: (
    results: ReadonlyMap<number, FunctionArgument>,
    parentArgs?: readonly FunctionArgument[],
  ) => readonly FunctionArgument[] | undefined;
}

// SDK-owned provenance for results learned during a provisional composition pass. Keep this symbol private:
// a caller-provided commitment must never be able to opt out of the strict prepared-result comparison. It is
// enumerable only so internal descriptor spreads retain the mark across a result-dependent graph rebuild;
// compose() snapshots caller objects via string-keyed entries and strips any caller-owned symbols.
const transientConvergenceResultSeed = Symbol('transientConvergenceResultSeed');

export function hasTransientConvergenceResultSeed(call: PreparedAtomicMessageBusCall): boolean {
  return (call as PreparedAtomicMessageBusCall & {
    [transientConvergenceResultSeed]?: boolean;
  })[transientConvergenceResultSeed] === true;
}

export interface CallDescriptor extends PreparedAtomicMessageBusCall {
  artifact: Artifact;
}

/** Stable JSON for semantic equality of args / layout fragments (bigint → string). */
export const semanticJson = (value: unknown): string => JSON.stringify(
  value, (_key, field) => typeof field === 'bigint' ? field.toString() : field,
);

/** Validate one prepared compiler edge against the planner's canonical producer occurrence. */
export function assertPreparedInvocationIdentity(
  descriptor: PreparedAtomicMessageBusCall,
  invocation: PlannedGraphInvocation,
  index: number,
): void {
  const preparedPath = descriptor.producerPath;
  const plannedPath = invocation.producerPath;
  const preparedPathKey = preparedPath?.status === 'complete'
    ? canonicalValueChunkProducerPathContext(preparedPath.context)
    : preparedPath?.status === 'unavailable' ? 'unavailable' : undefined;
  const plannedPathKey = plannedPath.status === 'complete'
    ? canonicalValueChunkProducerPathContext(plannedPath.context)
    : 'unavailable';
  if (preparedPathKey === undefined || preparedPathKey !== plannedPathKey) {
    throw new Error(`messageBus: prepared invocation ${index} producer path disagrees with the compiled graph`
      + ` (${semanticJson({
        function: descriptor.functionName,
        prepared: descriptor.producerPath,
        compiled: invocation.producerPath,
      })})`);
  }
  // A transported selector authorizes a producer effect domain, so it must be the graph's own dispatch target.
  // The prepared side may legitimately withhold a selector (runtime-dispatched edges carry none), but a
  // selector it does transport can never be a name-derived guess at a different overload.
  if (descriptor.selector !== undefined
    && descriptor.selector.toLowerCase() !== invocation.selectorHex.toLowerCase()) {
    throw new Error(`messageBus: prepared invocation ${index} selector disagrees with the compiled graph`);
  }
  for (const production of descriptor.valueChunkProductions ?? []) {
    const claim = canonicalValueChunkProducerResourceClaim(production.claim);
    const claimPath = claim && canonicalValueChunkProducerPathContext({
      version: 1, sourcePath: claim.producer.sourcePath,
    });
    if (!claim || preparedPathKey === undefined || preparedPathKey === 'unavailable'
      || claimPath !== preparedPathKey) {
      throw new Error(
        `messageBus: prepared invocation ${index} value production disagrees with its producer path`,
      );
    }
  }
  if (index === 0) return;
  if (descriptor.callsiteId === undefined) {
    throw new Error(`messageBus: prepared invocation ${index} omits its physical callsite identity`);
  }
  if (descriptor.sourceLogicalIndex !== undefined && descriptor.batchLogicalIndex !== undefined
    && descriptor.sourceLogicalIndex !== descriptor.batchLogicalIndex) {
    throw new Error(`messageBus: prepared invocation ${index} has conflicting logical row identities`);
  }
  if (descriptor.occurrenceIndex !== undefined && descriptor.batchOccurrenceIndex !== undefined
    && descriptor.occurrenceIndex !== descriptor.batchOccurrenceIndex) {
    throw new Error(`messageBus: prepared invocation ${index} has conflicting occurrence identities`);
  }
  const isBatched = invocation.sourceLogicalIndex !== undefined
    || descriptor.sourceLogicalIndex !== undefined
    || descriptor.batchLogicalIndex !== undefined;
  if (isBatched) {
    // Batched edges must carry the full four-tuple; never invent source identity from the physical lane.
    if (descriptor.sourceCallsiteId === undefined) {
      throw new Error(`messageBus: prepared invocation ${index} omits its source callsite identity`);
    }
    if (descriptor.sourceLogicalIndex === undefined && descriptor.batchLogicalIndex === undefined) {
      throw new Error(`messageBus: prepared invocation ${index} omits its source logical row`);
    }
    if (descriptor.occurrenceIndex === undefined && descriptor.batchOccurrenceIndex === undefined) {
      throw new Error(`messageBus: prepared invocation ${index} omits its source occurrence`);
    }
  }
  const sourceCallsiteId = isBatched
    ? descriptor.sourceCallsiteId!
    : (descriptor.sourceCallsiteId ?? descriptor.callsiteId);
  const sourceLogicalIndex = descriptor.sourceLogicalIndex ?? descriptor.batchLogicalIndex;
  const occurrenceIndex = isBatched
    ? (descriptor.occurrenceIndex ?? descriptor.batchOccurrenceIndex)!
    : (descriptor.occurrenceIndex ?? descriptor.batchOccurrenceIndex ?? 0);
  if (descriptor.callsiteId !== invocation.consumerCallsiteId) {
    throw new Error(`messageBus: prepared invocation ${index} physical callsite disagrees with the compiled graph`);
  }
  if (sourceCallsiteId !== invocation.sourceCallsiteId) {
    throw new Error(`messageBus: prepared invocation ${index} source callsite disagrees with the compiled graph`);
  }
  if (sourceLogicalIndex !== invocation.sourceLogicalIndex) {
    throw new Error(`messageBus: prepared invocation ${index} source logical row disagrees with the compiled graph`);
  }
  if (occurrenceIndex !== invocation.occurrenceIndex) {
    throw new Error(`messageBus: prepared invocation ${index} source occurrence disagrees with the compiled graph`);
  }
  if (descriptor.sourceEffectOrdinal !== invocation.sourceEffectOrdinal) {
    throw new Error(`messageBus: prepared invocation ${index} source-effect ordinal disagrees with the graph`);
  }
}

/** Rebuild a prepared call after authenticated producer results change its arguments, retaining edge identity. */
export function rebuildPreparedInvocation(
  descriptor: PreparedAtomicMessageBusCall,
  args: readonly FunctionArgument[],
  provisionalResultHex?: string,
  options: { refreshValueProductions?: boolean } = {},
): PreparedAtomicMessageBusCall {
  const argsChanged = semanticJson(args) !== semanticJson(descriptor.args);
  if (argsChanged && descriptor.valueChunkProductions?.length
    && !descriptor.resolveValueChunkProductionsFromArgs) {
    throw new Error('messageBus: changed producer arguments have no value-production refresher');
  }
  const valueChunkProductions = (argsChanged || options.refreshValueProductions === true)
    ? descriptor.resolveValueChunkProductionsFromArgs?.(args)
    : descriptor.valueChunkProductions;
  const strictlyPrepared = descriptor.provisionalResultCommitment !== undefined
    && !hasTransientConvergenceResultSeed(descriptor);
  const rebuilt: PreparedAtomicMessageBusCall = {
    ...descriptor,
    args,
    valueChunkProductions,
    ...(!strictlyPrepared && provisionalResultHex !== undefined && {
      provisionalResultCommitment: hexToBin(provisionalResultHex),
    }),
  };
  if (!strictlyPrepared && (provisionalResultHex !== undefined
    || hasTransientConvergenceResultSeed(descriptor))) {
    Object.defineProperty(rebuilt, transientConvergenceResultSeed, { value: true, enumerable: true });
  }
  return rebuilt;
}

export interface SemanticClaimObservation<T = unknown> {
  previous: T;
  observed: T;
  apply: (observed: T) => void;
}

/** Apply every independently derived semantic class before deciding whether the graph needs another pass. */
export function applySemanticClaimObservationPass(
  observations: readonly SemanticClaimObservation[],
): boolean {
  let changed = false;
  for (const observation of observations) {
    if (semanticJson(observation.previous) === semanticJson(observation.observed)) continue;
    observation.apply(observation.observed);
    changed = true;
  }
  return changed;
}
