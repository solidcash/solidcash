/**
 * phase-boundary extract: Compose phase-boundary extract — no-claim final assemble + dynamic-chunk gate + admit.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { ComposeAssemblyRuntime } from './compose-assembly-runtime.js';
import { freezeStaticcallParticipantOutputs } from './compose-participant-helpers.js';
import {
  convergeMessageBusComputedDynamicChunkOutputs,
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
import { deriveCompiledGraphPlan } from './worklist.js';

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;
type FinalizedGraph = ReturnType<typeof finalizeAtomicInvocationGraph>;

export interface AdmitComposeFinalBuilderContext {
  plan: CompiledGraphPlan;
  categories: readonly string[];
  provisionalResults: Readonly<Record<number, string>>;
  provisionalEventEffects: readonly AtomicEventSlotEffect[];
  provisionalResourceEffects: readonly AtomicResourceSlotEffect[];
  provisionalValueEffects: readonly AtomicValueSlotEffect[];
  provisionalTokenEffects: readonly AtomicTokenSlotEffect[];
  provisionalSidecarEffects: readonly AtomicSidecarSlotEffect[];
  deploymentEffects: readonly AtomicDeploymentSlotEffect[];
  finalized: FinalizedGraph;
  runtime: Pick<ComposeAssemblyRuntime, 'assemble' | 'admit' | 'actualSpansMatch'>;
}

/**
 * When the composition has no mutable semantic claims, assemble once (re-assembling if spans compact),
 * refuse leftover dynamic-chunk placeholders, freeze staticcall outputs, and admit.
 */
export async function admitComposeFinalBuilder(
  ctx: AdmitComposeFinalBuilderContext,
): Promise<TransactionBuilder> {
  const {
    plan, categories, provisionalResults, provisionalEventEffects, provisionalResourceEffects,
    provisionalValueEffects, provisionalTokenEffects, provisionalSidecarEffects, deploymentEffects,
    runtime,
  } = ctx;
  let { finalized } = ctx;
  const { assemble, admit, actualSpansMatch } = runtime;

  let assembled = await assemble(finalized, provisionalResults);
  if (!actualSpansMatch(finalized, assembled.actualSizes)) {
    finalized = finalizeAtomicInvocationGraph(
      plan, categories, provisionalResults, provisionalEventEffects, provisionalResourceEffects,
      provisionalValueEffects, provisionalTokenEffects, provisionalSidecarEffects, assembled.actualSizes,
      deploymentEffects,
    );
    assembled = await assemble(finalized, provisionalResults);
    if (!actualSpansMatch(finalized, assembled.actualSizes)) {
      throw new Error('messageBus: participant spans did not converge after compact assembly');
    }
  }
  const finalDynamicChunkConvergence = convergeMessageBusComputedDynamicChunkOutputs(assembled.builder);
  if (dynamicChunkPlaceholdersRemain(
    assembled.builder, finalDynamicChunkConvergence, assembled.incompleteDynamicChunks,
  )) {
    const detail = assembled.incompleteDynamicChunks.map((item) =>
      `${item.participant}:${item.variable} (${item.resolved}/${item.total})`).join(', ');
    throw new Error(`messageBus: final graph retains incomplete dynamic chunks: ${detail}`);
  }
  freezeStaticcallParticipantOutputs(
    assembled.builder, plan, finalized.layout.participantInputs, assembled.actualSizes,
  );
  return admit(assembled.builder);
}
