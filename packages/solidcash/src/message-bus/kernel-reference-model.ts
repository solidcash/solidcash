/**
 * kernel reference model: independent kernel reference model (metamorphic / differential oracle).
 *
 * Re-derives plan digests and acceptance without calling compose or STB.
 * Uses a separate canonicalization from `digestKernelExecutionPlan` so agreement
 * is a real cross-check, not a tautology against the same helper.
 *
 * Also re-packs participant bases from symbolic layout input independently of
 * `resolveTransactionLayout`'s internal loop (same packing rule, separate code).
 */

import { sha256 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import {
  KERNEL_PLAN_VERSION,
  type KernelExecutionPlan,
  type KernelResourceBudget,
} from './kernel-execution-plan.js';
import type {
  LayoutResolverInput,
  SymbolicParticipantLayout,
} from './layout-resolver.js';

/** Length-prefixed UTF-8 field for reference digests (not JSON.stringify). */
function refField(label: string, value: string): Uint8Array {
  const enc = new TextEncoder();
  const lab = enc.encode(label);
  const val = enc.encode(value);
  const out = new Uint8Array(2 + lab.length + 4 + val.length);
  out[0] = (lab.length >> 8) & 0xff;
  out[1] = lab.length & 0xff;
  out.set(lab, 2);
  const vo = 2 + lab.length;
  out[vo] = (val.length >> 24) & 0xff;
  out[vo + 1] = (val.length >> 16) & 0xff;
  out[vo + 2] = (val.length >> 8) & 0xff;
  out[vo + 3] = val.length & 0xff;
  out.set(val, vo + 4);
  return out;
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Independent digest of execution-affecting plan fields.
 * Field set mirrors production digest; encoding is length-prefixed records, not JSON.
 */
export function referenceDigestKernelExecutionPlan(plan: KernelExecutionPlan): string {
  const reads = [...(plan.dynamicReads ?? [])].sort();
  const writes = [...(plan.dynamicWrites ?? [])].sort();
  const resources = [...(plan.selectedResources ?? [])];
  const bands = plan.symbolicBands ?? [];
  const features = plan.requiredFeatureBits ?? {};
  const budgets = plan.budgets ?? {};
  const budgetKeys = Object.keys(budgets).sort() as (keyof KernelResourceBudget)[];
  const parts = [
    refField('kernelPlanVersion', String(plan.kernelPlanVersion)),
    refField('handlerId', plan.handlerId),
    refField('selectedResources', resources.join('\0')),
    refField(
      'symbolicBands',
      bands.map((b) => `${b.kind}:${b.localBase}:${b.capacity}`).join(';'),
    ),
    refField('ownershipClaimCount', String(plan.ownershipClaimCount ?? 0)),
    refField('journalDispositionDigest', plan.journalDispositionDigest ?? ''),
    refField('dynamicReads', reads.join('\0')),
    refField('dynamicWrites', writes.join('\0')),
    refField('dynamicWritesPublished', plan.dynamicWritesPublished === true ? '1' : '0'),
    refField('effectLanes', (plan.effectLanes ?? []).join('\0')),
    refField('resultLanes', (plan.resultLanes ?? []).join('\0')),
    refField(
      'requiredFeatureBits',
      Object.keys(features).sort()
        .map((key) => `${key}=${String((features as Record<string, unknown>)[key])}`)
        .join(';'),
    ),
    refField('minimumSdkReaderVersion', String(plan.minimumSdkReaderVersion ?? 1)),
    refField(
      'budgets',
      budgetKeys.map((key) => `${key}=${String(budgets[key])}`).join(';'),
    ),
  ];
  return binToHex(sha256.hash(concatBytes(parts)));
}

export type ReferencePlanEvaluation = {
  complete: boolean;
  withinBudgets: boolean;
  /** Reference digest (independent encoding). */
  referenceDigest: string;
  refusalReasons: readonly string[];
};

/**
 * Independent acceptance check for a kernel execution plan + usage envelope.
 * Does not call `assertKernelPlanComplete` / `assertWithinKernelBudgets`.
 */
export function referenceEvaluateKernelPlan(
  plan: KernelExecutionPlan,
  usage: Partial<KernelResourceBudget> = {},
): ReferencePlanEvaluation {
  const refusalReasons: string[] = [];
  if (plan.kernelPlanVersion !== KERNEL_PLAN_VERSION) {
    refusalReasons.push(`unsupported-version:${String(plan.kernelPlanVersion)}`);
  }
  if (!plan.handlerId) {
    refusalReasons.push('missing-handlerId');
  }
  if (plan.dynamicWritesPublished !== true) {
    refusalReasons.push('dynamicWrites-not-published');
  }
  if (plan.dynamicWrites === undefined) {
    refusalReasons.push('dynamicWrites-missing');
  }
  const complete = refusalReasons.length === 0;

  const budgets = plan.budgets ?? {};
  for (const key of Object.keys(usage) as (keyof KernelResourceBudget)[]) {
    const used = usage[key];
    const limit = budgets[key];
    if (used === undefined || limit === undefined) continue;
    if (used > limit) {
      refusalReasons.push(`budget-${key}:${used}>${limit}`);
    }
  }
  const withinBudgets = !refusalReasons.some((reason) => reason.startsWith('budget-'));

  return {
    complete,
    withinBudgets,
    referenceDigest: referenceDigestKernelExecutionPlan(plan),
    refusalReasons,
  };
}

export type ReferenceParticipantBases = {
  participant: number;
  inputBase: number;
  outputBase: number;
  blockSize: number;
};

/**
 * Independent packing of participant inputBase/outputBase from symbolic layouts.
 * Same aggregate rule as production (prefix + cumulative blockSize), separate implementation.
 */
export function referenceResolveParticipantBases(
  participants: readonly SymbolicParticipantLayout[],
  nonParticipantInputPrefix = 0,
  nonParticipantOutputPrefix = 0,
): readonly ReferenceParticipantBases[] {
  if (!Number.isInteger(nonParticipantInputPrefix) || nonParticipantInputPrefix < 0
    || !Number.isInteger(nonParticipantOutputPrefix) || nonParticipantOutputPrefix < 0) {
    throw new Error('reference-model: invalid non-participant prefix');
  }
  let inputCursor = nonParticipantInputPrefix;
  let outputCursor = nonParticipantOutputPrefix;
  const result: ReferenceParticipantBases[] = [];
  for (const participant of participants) {
    const blockSize = participant.blockLayout?.blockSize
      ?? Math.max(1, ...(participant.bands ?? []).map((band) => band.localBase + band.capacity), 1);
    if (!Number.isInteger(blockSize) || blockSize <= 0) {
      throw new Error(`reference-model: invalid blockSize for participant ${participant.participant}`);
    }
    result.push({
      participant: participant.participant,
      inputBase: inputCursor,
      outputBase: outputCursor,
      blockSize,
    });
    inputCursor += blockSize;
    outputCursor += blockSize;
  }
  return result;
}

/** Compare reference packing to a production-resolved layout's participant bases. */
export function referenceAgreesWithResolvedBases(
  input: LayoutResolverInput,
  resolvedParticipants: readonly { participant: number; inputBase: number; outputBase: number }[],
): boolean {
  const reference = referenceResolveParticipantBases(
    input.participants,
    input.nonParticipantInputPrefix ?? 0,
    input.nonParticipantOutputPrefix ?? 0,
  );
  if (reference.length !== resolvedParticipants.length) return false;
  for (let index = 0; index < reference.length; index += 1) {
    const left = reference[index]!;
    const right = resolvedParticipants.find((entry) => entry.participant === left.participant);
    if (right === undefined) return false;
    if (right.inputBase !== left.inputBase || right.outputBase !== left.outputBase) return false;
  }
  return true;
}
