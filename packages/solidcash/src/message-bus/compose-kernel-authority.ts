/**
 * Compose-path kernel authority (items 5–7, 9, 11–12).
 * Called from compose relocatable sync — results are consumed (digest stamped, budgets enforced).
 */

import {
  assertKernelPlanComplete,
  assertWithinKernelBudgets,
  createKernelExecutionPlan,
  digestKernelExecutionPlan,
  encodeKernelExecutionPlanBytecodeCommitment,
  type KernelExecutionPlan,
  type KernelResourceBudget,
} from './kernel-execution-plan.js';
import { requireStableId, stableJoinKey } from './stable-ids.js';
import {
  advancePhase,
  assertGeometryFrozen,
  startPhase,
  type PhaseArtifact,
} from './planning-phases.js';
import { getMaterializationMode } from './materialization-mode.js';

export type ComposeKernelAuthorityResult = {
  plan: KernelExecutionPlan;
  digest: string;
  /** KernelExecutionPlan bytecode commitment: ASM marker `<SCKP||version||digest> OP_DROP` for route bytecode commitment. */
  bytecodeCommitment: string;
  handlerJoinKey: string;
  phase: PhaseArtifact<{
    participant: number;
    handlerId: string;
    claims: number;
    publishedBase: number;
    materializationMode: string;
  }>;
};

/** Last authority results from compose (tests assert these are populated and digests match). */
const lastResults: ComposeKernelAuthorityResult[] = [];

export function clearComposeKernelAuthorityResults(): void {
  lastResults.length = 0;
}

export function getComposeKernelAuthorityResults(): readonly ComposeKernelAuthorityResult[] {
  return lastResults;
}

/**
 * Build + enforce a KernelExecutionPlan for one participant layout sync.
 * Fail-closed on incomplete plans or over-budget envelopes.
 */
export function authorizeComposeParticipantLayout(params: {
  participant: number;
  /** Compiler-stable handler selector (hex), never a diagnostic name. */
  handlerSelector: string;
  handlerDiagnosticName?: string;
  publishedBase: number;
  claimCount: number;
  dynamicWrites?: readonly string[];
  selectedResources?: readonly string[];
  budgets?: KernelResourceBudget;
  /**
   * published resource budgets: when true (kernel-row-loop), `budgets` must be compiler-published `resourceBudgets`.
   * Silent SDK defaults are refuse — missing budgets fail closed.
   */
  requirePublishedBudgets?: boolean;
  /** Physically resolved continuation bands; their widths, not a provisional route hint, set budget usage. */
  valueChunkBands?: readonly { chunkCount: number }[];
  usage?: Partial<KernelResourceBudget>;
}): ComposeKernelAuthorityResult {
  const handlerStable = requireStableId(
    'handler',
    params.handlerSelector,
    params.handlerDiagnosticName,
  );
  if (params.requirePublishedBudgets === true && params.budgets === undefined) {
    throw new Error('kernel-plan: resourceBudgets missing (compiler must publish multi-axis budgets)');
  }
  const plan = createKernelExecutionPlan({
    handlerId: stableJoinKey(handlerStable),
    handlerName: handlerStable.diagnosticName,
    dynamicWrites: params.dynamicWrites ?? [],
    selectedResources: params.selectedResources ?? [],
    budgets: params.budgets ?? {
      maximumParticipants: 32,
      maximumRows: 64,
      maximumDynamicChunks: 256,
      maximumValueContinuationChunks: 256,
    },
  });
  assertKernelPlanComplete(plan);
  const valueContinuationChunks = params.valueChunkBands?.reduce((total, band) => {
    if (!Number.isSafeInteger(band.chunkCount) || band.chunkCount < 1) {
      throw new Error('kernel-plan: invalid resolved value-chunk band width');
    }
    return total + band.chunkCount;
  }, 0);
  assertWithinKernelBudgets(plan, {
    maximumParticipants: (params.usage?.maximumParticipants ?? params.participant) + 1,
    maximumRows: params.usage?.maximumRows ?? 1,
    maximumDynamicChunks: params.usage?.maximumDynamicChunks ?? 0,
    maximumValueContinuationChunks: params.usage?.maximumValueContinuationChunks
      ?? (params.selectedResources?.length ?? 0),
    ...params.usage,
    ...(valueContinuationChunks !== undefined && {
      maximumValueContinuationChunks: valueContinuationChunks,
    }),
  });
  const digest = digestKernelExecutionPlan(plan);
  // KernelExecutionPlan bytecode commitment: transplanting digest metadata
  // without the execution-affecting marker fails closed.
  const bytecodeCommitment = encodeKernelExecutionPlanBytecodeCommitment(digest);
  const mode = getMaterializationMode();
  const phase = advancePhase(
    advancePhase(
      advancePhase(
        startPhase({
          participant: params.participant,
          handlerId: plan.handlerId,
          claims: 0,
          publishedBase: 0,
          materializationMode: mode,
        }),
        'admittedHandlerIr',
        (p) => ({ ...p, handlerId: plan.handlerId }),
      ),
      'symbolicResourcePlan',
      (p) => ({ ...p, claims: params.claimCount }),
    ),
    'absoluteLayout',
    (p) => ({ ...p, publishedBase: params.publishedBase, materializationMode: mode }),
  );
  assertGeometryFrozen(phase.phase);
  const result: ComposeKernelAuthorityResult = {
    plan,
    digest,
    bytecodeCommitment,
    handlerJoinKey: stableJoinKey(handlerStable),
    phase,
  };
  lastResults.push(result);
  return result;
}
