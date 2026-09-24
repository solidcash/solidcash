/**
 * path-effect activation: compose-side consumption of published handler `pathEffectSchedule`.
 *
 * Mirrors solidc path-effect activation evaluation using the shared fold activation recipes
 * so multi-effect activated schedules drive write selection / fold gating on the SDK path.
 */

import type { FunctionArgument } from '../Argument.js';
import {
  evaluateFoldActivation,
  foldActivationFromExternalCallExpression,
  normalizeFoldActivation,
  type FoldActivationEnvironment,
  type FoldActivationExpression,
  type FoldActivationRecipe,
} from './resource-fold.js';

/** Artifact-published path-effect schedule (utils messageBus.handlers[].pathEffectSchedule). */
export type PublishedPathEffectSchedule = {
  version: 1;
  effects: readonly {
    ordinal: number;
    kind: string;
    resultType: string;
    activation?: string | FoldActivationRecipe | FoldActivationExpression;
  }[];
};

/**
 * Path-effect schedule breadth: effect kinds published by `pathEffectScheduleFromHandlerEffects`.
 * Compiler event ordinals use {@link PATH_EFFECT_EVENT_ORDINAL_BASE} + emitIndex;
 * transfer ordinals use {@link PATH_EFFECT_TRANSFER_ORDINAL_BASE} + site index.
 */
export type PathEffectKind = 'stateWrite' | 'event' | 'transfer' | 'childDeployment';

/** Matches solidc handler publish: `1_000_000 + emitIndex`. */
export const PATH_EFFECT_EVENT_ORDINAL_BASE = 1_000_000;
/** Matches solidc handler publish: `2_000_000 + transferIndex`. */
export const PATH_EFFECT_TRANSFER_ORDINAL_BASE = 2_000_000;

export function pathEffectEventOrdinal(emitIndex: number): number {
  return PATH_EFFECT_EVENT_ORDINAL_BASE + emitIndex;
}

export function pathEffectTransferOrdinal(transferIndex: number): number {
  return PATH_EFFECT_TRANSFER_ORDINAL_BASE + transferIndex;
}

export type PathEffectActivationEnvironment = FoldActivationEnvironment;

/** Normalize a published schedule activation into a fold/path-effect recipe. */
export function normalizePathEffectScheduleActivation(
  activation: string | FoldActivationRecipe | FoldActivationExpression | undefined,
): FoldActivationRecipe | undefined {
  if (activation === undefined) return undefined;
  if (typeof activation === 'string') return normalizeFoldActivation(activation);
  if ('kind' in activation && (
    activation.kind === 'always'
    || activation.kind === 'boolParam'
    || activation.kind === 'handlerInput'
    || activation.kind === 'handlerInputEq'
    || activation.kind === 'handlerInputCmp'
    || activation.kind === 'handlerInputPairCmp'
    || activation.kind === 'boolParamEq'
    || activation.kind === 'namedInputEq'
    || activation.kind === 'namedInputCmp'
    || activation.kind === 'namedInputPairCmp'
    || activation.kind === 'stateEq'
    || activation.kind === 'stateCmp'
    || activation.kind === 'callEq'
    || activation.kind === 'callCmp'
    || activation.kind === 'stateCallCmp'
    || activation.kind === 'not'
    || activation.kind === 'and'
    || activation.kind === 'or'
  )) {
    return activation as FoldActivationRecipe;
  }
  return foldActivationFromExternalCallExpression(activation as FoldActivationExpression);
}

/**
 * Build activation env from visible ABI inputs + authenticated row/call args.
 * Bool inputs populate both handlerInputs (by index) and boolParams (by name).
 * All visible args also populate namedInputs for path-effect activation namedInputEq/Cmp.
 */
export function pathEffectActivationEnvironmentFromArgs(
  inputs: readonly { name: string; type: string }[],
  args: readonly FunctionArgument[],
): PathEffectActivationEnvironment {
  const visible = inputs.filter((input) => !input.name.startsWith('__internal__'));
  const handlerInputs: unknown[] = [];
  const boolParams: Record<string, boolean> = {};
  const namedInputs: Record<string, unknown> = {};
  for (let index = 0; index < visible.length; index += 1) {
    const input = visible[index]!;
    const arg = args[index];
    if (input.type === 'bool' || typeof arg === 'boolean') {
      const active = arg === true;
      handlerInputs.push(active);
      boolParams[input.name] = active;
      namedInputs[input.name] = active;
    } else {
      handlerInputs.push(arg);
      namedInputs[input.name] = arg;
    }
  }
  return { handlerInputs, boolParams, namedInputs };
}

/** Active effects under a published path-effect schedule + activation environment. */
export function selectActivePathEffects(
  schedule: PublishedPathEffectSchedule,
  env: PathEffectActivationEnvironment = {},
): PublishedPathEffectSchedule['effects'] {
  if (schedule.version !== 1) return [];
  return schedule.effects.filter((effect) => (
    evaluateFoldActivation(normalizePathEffectScheduleActivation(effect.activation), env)
  ));
}

/** Whether a specific effect ordinal is active under env (absent ordinal ⇒ inactive / fail closed). */
export function isPathEffectOrdinalActive(
  schedule: PublishedPathEffectSchedule,
  effectOrdinal: number,
  env: PathEffectActivationEnvironment = {},
): boolean {
  const effect = schedule.effects.find((candidate) => candidate.ordinal === effectOrdinal);
  if (effect === undefined) return false;
  return evaluateFoldActivation(normalizePathEffectScheduleActivation(effect.activation), env);
}

/**
 * Active ordinals under a published schedule, optionally restricted by effect kind.
 * Effects without activation are always active; activated effects require env truth.
 */
export function activeOrdinalsFromPathEffectSchedule(
  schedule: PublishedPathEffectSchedule,
  env: PathEffectActivationEnvironment = {},
  kind?: PathEffectKind | string,
): readonly number[] {
  return selectActivePathEffects(schedule, env)
    .filter((effect) => kind === undefined || effect.kind === kind)
    .map((effect) => effect.ordinal);
}

/** Active stateWrite ordinals under a published schedule. */
export function activeStateWriteOrdinalsFromPathEffectSchedule(
  schedule: PublishedPathEffectSchedule,
  env: PathEffectActivationEnvironment = {},
): readonly number[] {
  return activeOrdinalsFromPathEffectSchedule(schedule, env, 'stateWrite');
}

/** Active event ordinals under a published schedule. */
export function activeEventOrdinalsFromPathEffectSchedule(
  schedule: PublishedPathEffectSchedule,
  env: PathEffectActivationEnvironment = {},
): readonly number[] {
  return activeOrdinalsFromPathEffectSchedule(schedule, env, 'event');
}

/** Active transfer ordinals under a published schedule. */
export function activeTransferOrdinalsFromPathEffectSchedule(
  schedule: PublishedPathEffectSchedule,
  env: PathEffectActivationEnvironment = {},
): readonly number[] {
  return activeOrdinalsFromPathEffectSchedule(schedule, env, 'transfer');
}

/**
 * Prefer published pathEffectSchedule for a kind-tagged effect activity.
 * When the candidate ordinals appear in the schedule for `kind`, schedule authority decides.
 * Otherwise fall back to `fallbackActive`.
 */
export function pathEffectScheduleAllowsEffect(params: {
  schedule: PublishedPathEffectSchedule | undefined;
  kind: PathEffectKind | string;
  effectOrdinals: readonly number[] | undefined;
  env: PathEffectActivationEnvironment;
  fallbackActive: () => boolean;
}): boolean {
  const { schedule, kind, effectOrdinals, env, fallbackActive } = params;
  if (schedule === undefined || schedule.version !== 1 || effectOrdinals === undefined
    || effectOrdinals.length === 0) {
    return fallbackActive();
  }
  const scheduledOrdinals = effectOrdinals.filter((ordinal) => (
    schedule.effects.some((effect) => effect.kind === kind && effect.ordinal === ordinal)
  ));
  if (scheduledOrdinals.length === 0) return fallbackActive();
  return scheduledOrdinals.every((ordinal) => isPathEffectOrdinalActive(schedule, ordinal, env));
}

/**
 * Prefer published pathEffectSchedule for fixed-chunkable write activity.
 * When the access's mutation ordinals appear in the schedule, schedule authority decides.
 * Otherwise fall back to `fallbackActive` (legacy ECE evaluateFixedEffectPredicate).
 */
export function pathEffectScheduleAllowsWrite(params: {
  schedule: PublishedPathEffectSchedule | undefined;
  mutationEffectOrdinals: readonly number[] | undefined;
  env: PathEffectActivationEnvironment;
  fallbackActive: () => boolean;
}): boolean {
  return pathEffectScheduleAllowsEffect({
    schedule: params.schedule,
    kind: 'stateWrite',
    effectOrdinals: params.mutationEffectOrdinals,
    env: params.env,
    fallbackActive: params.fallbackActive,
  });
}

/**
 * Filter handler emits by published event path-effect activations.
 * Uses compiler ordinal encoding `PATH_EFFECT_EVENT_ORDINAL_BASE + emitIndex`.
 * Absent schedule / no event effects ⇒ all emits pass through (legacy).
 *
 * Optional `activeEventOrdinals` overrides schedule evaluation (settle-time ExecutionContext: ExecutionContext
 * supplies the active set when a settle-time context is bound).
 */
export function filterEmitsUnderPathEffectSchedule<T extends { emitIndex: number }>(
  emits: readonly T[],
  schedule: PublishedPathEffectSchedule | undefined,
  env: PathEffectActivationEnvironment = {},
  activeEventOrdinals?: readonly number[],
): readonly T[] {
  if (schedule === undefined || schedule.version !== 1) return emits;
  const eventEffects = schedule.effects.filter((effect) => effect.kind === 'event');
  if (eventEffects.length === 0) return emits;
  const active = new Set(
    activeEventOrdinals
      ?? activeEventOrdinalsFromPathEffectSchedule(schedule, env),
  );
  return emits.filter((emitted) => active.has(pathEffectEventOrdinal(emitted.emitIndex)));
}

/**
 * Filter fixed transfer sites by published transfer path-effect activations.
 * Uses compiler ordinal encoding `PATH_EFFECT_TRANSFER_ORDINAL_BASE + transferIndex`.
 * Optional `activeTransferOrdinals` overrides schedule evaluation (settle-time ExecutionContext ExecutionContext).
 */
export function filterTransfersUnderPathEffectSchedule<T extends { transferIndex: number }>(
  transfers: readonly T[],
  schedule: PublishedPathEffectSchedule | undefined,
  env: PathEffectActivationEnvironment = {},
  activeTransferOrdinals?: readonly number[],
): readonly T[] {
  if (schedule === undefined || schedule.version !== 1) return transfers;
  const transferEffects = schedule.effects.filter((effect) => effect.kind === 'transfer');
  if (transferEffects.length === 0) return transfers;
  const active = new Set(
    activeTransferOrdinals
      ?? activeTransferOrdinalsFromPathEffectSchedule(schedule, env),
  );
  return transfers.filter((site) => active.has(pathEffectTransferOrdinal(site.transferIndex)));
}
