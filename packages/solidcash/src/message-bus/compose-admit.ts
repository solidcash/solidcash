/**
 * phase-boundary extract: Compose phase-boundary extract — final admit / preflight gate for a converged builder.
 */

import { binToHex } from '@bitauth/libauth';
import { sha256 } from '@solidcash/utils';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { ConstraintFixpointSession } from './constraint-fixpoint-session.js';
import {
  convergeMessageBusComputedResourceOutputs,
  finalizedByteGateOptionsForProvider,
  preflightMessageBusTransaction,
} from './preflight.js';
import { convergeMessageBusComputedValueChunkOutputs } from './computed-value-chunks.js';
import { convergeMessageBusComputedDynamicChunkOutputs } from './computed-dynamic-chunks.js';
import type { ComposeAtomicMessageBusOptions } from './compose-prepared-invocation.js';
import type { AssemblePredOutClaimsByParticipant } from './compose-assemble.js';
import {
  assertComposeSlotsCoverEffectPlans,
  pruneComposeSlotInventoryByEffectPlans,
  type ComposeSlotInventory,
} from './compose-slot-inventory.js';
import {
  assertAndSettleExecutionContexts,
  planEffectsUnderLifecycle,
  type ExecutionContextLifecycle,
} from './execution-context.js';
import {
  finalizeActiveConstraintFixpoint,
  runActiveConstraintSpeculative,
  settlement,
} from '../stateful/value-chunk-persist.js';

export interface AdmitCompositionContext {
  executionContexts: ExecutionContextLifecycle;
  constraintFixpoint: ConstraintFixpointSession;
  options: Pick<ComposeAtomicMessageBusOptions, 'preparedCalls'>;
  assembledPredOutClaimsByParticipant?: AssemblePredOutClaimsByParticipant;
  /** settle-time ExecutionContext: when present, effect plans are checked against published slot capacity. */
  slotInventory?: ComposeSlotInventory;
}

export function admitCompositionBuilder(
  ctx: AdmitCompositionContext,
  builder: TransactionBuilder,
): TransactionBuilder {
  // constraint fixpoint: speculative admit-path — cycle/throw during converge restores joint fixpoint snapshot.
  const {
    convergence,
    valueChunkConvergence,
    dynamicChunkConvergence,
  } = runActiveConstraintSpeculative(() => ({
    convergence: convergeMessageBusComputedResourceOutputs(builder),
    valueChunkConvergence: convergeMessageBusComputedValueChunkOutputs(builder),
    dynamicChunkConvergence: convergeMessageBusComputedDynamicChunkOutputs(builder),
  }), ctx.constraintFixpoint);
  if (convergence.repairs > 0 || valueChunkConvergence.repairs > 0
    || dynamicChunkConvergence.repairs > 0) {
    throw new Error(
      'messageBus: mutable resources changed after semantic-manifest convergence; refusing a stale manifest',
    );
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_FINAL_OUTPUTS === '1') {
    console.error('message-bus-final-outputs', JSON.stringify(builder.outputs.map((output, index) => ({
      index,
      lock: typeof output.to === 'string' ? output.to.slice(0, 24) : binToHex(output.to).slice(0, 24),
      commitment: (output.token?.nft as { commitment?: string } | undefined)?.commitment,
    })).slice(120, 230)));
  }
  preflightMessageBusTransaction(builder, {
    ...finalizedByteGateOptionsForProvider(builder.provider),
    // PredOut preflight claims: PredOut physical claims from assemble — default preflight is no longer compose-only.
    ...(ctx.assembledPredOutClaimsByParticipant !== undefined && {
      predOutClaimsByParticipant: ctx.assembledPredOutClaimsByParticipant,
    }),
  });
  // settle-time ExecutionContext: materialize effect plans, prune inactive slots, persist, cover-assert.
  const executionEffectPlans = planEffectsUnderLifecycle(ctx.executionContexts);
  settlement().executionEffectPlans = executionEffectPlans;
  if (ctx.slotInventory !== undefined) {
    const pruned = pruneComposeSlotInventoryByEffectPlans(ctx.slotInventory, executionEffectPlans);
    assertComposeSlotsCoverEffectPlans(pruned, executionEffectPlans);
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_EXECUTION_CONTEXT_PLAN === '1'
    && executionEffectPlans.length > 0) {
    console.error('execution-context-effect-plans', JSON.stringify(executionEffectPlans.map((plan) => ({
      journalKey: plan.journalKey,
      writes: plan.activeWrites,
      events: plan.activeEvents,
      transfers: plan.activeTransfers,
    }))));
  }
  // path-effect activation/settle-time ExecutionContext: settle-time ExecutionContext lifecycle (no-op when none registered).
  assertAndSettleExecutionContexts(ctx.executionContexts);
  // constraint fixpoint: resolve multi-domain converge fingerprints recorded during admit.
  finalizeActiveConstraintFixpoint(ctx.constraintFixpoint);
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
    const digests = (ctx.options.preparedCalls ?? []).flatMap((call) =>
      (call.valueChunkProductions ?? []).map((production) => ({
        call: call.functionName,
        bytes: production.value.length,
        digest: binToHex(sha256(production.value)),
      })));
    const commitments = builder.outputs.map((output) => {
      const raw = (output.token?.nft as { commitment?: string } | undefined)?.commitment;
      return typeof raw === 'string' ? raw : undefined;
    });
    console.error('atomic-production-digests', JSON.stringify(digests));
    console.error('atomic-production-output-hits', JSON.stringify(digests.map((entry) => ({
      call: entry.call,
      digest: entry.digest.slice(0, 16),
      outputs: commitments.flatMap((commitment, index) =>
        commitment?.includes(entry.digest) ? [index] : []),
    }))));
  }
  return builder;
}
