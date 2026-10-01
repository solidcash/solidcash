/**
 * Finalized typed effect IR and thin path-effect schedule.
 *
 * Kernel admission must consume expressions whose types are already stamped by the
 * type checker — not invent result types from intrinsic names before the final type pass.
 * The path-effect schedule is a bounded ordered list of finalized effect slots.
 * Structured path-effect activations (`handlerInput` / `not` / …) are expressible beside legacy
 * bool-param name strings; SDK fold evaluation lives in solidcash `resource-fold`.
 */

export type FinalizedTypedEffectKind =
  | 'constructorArg'
  | 'salt'
  | 'value'
  | 'hash'
  | 'concat'
  | 'transfer'
  | 'event'
  | 'stateWrite'
  | 'other';

/**
 * Path-effect / fold activation beyond bare bool-param strings.
 * A plain string remains sugar for `{ kind: 'boolParam', name }`.
 * `and` / `or` match compiler-stamped fixed-chunkable ECE combinations (parity with SDK fold).
 */
/** path-effect activation: relational compare of a handler input against an int/bool literal. */
export type PathEffectCompareOp = '!=' | '<' | '<=' | '>' | '>=';

export type PathEffectActivation =
  | { kind: 'always' }
  | { kind: 'boolParam'; name: string }
  | { kind: 'handlerInput'; inputIndex: number }
  /** path-effect activation: handler input equals an int/bool literal (switch-arm refine). */
  | { kind: 'handlerInputEq'; inputIndex: number; value: string }
  /** path-effect activation: broader predicate — handler input compared to an int/bool literal. */
  | { kind: 'handlerInputCmp'; inputIndex: number; op: PathEffectCompareOp; value: string }
  /** path-effect activation: cross-input predicate — compare two handler inputs. */
  | {
    kind: 'handlerInputPairCmp';
    leftIndex: number;
    op: PathEffectCompareOp | '==';
    rightIndex: number;
  }
  /** path-effect activation: non-handler-input side — named bool param equals a bool literal. */
  | { kind: 'boolParamEq'; name: string; value: boolean }
  /** path-effect activation: non-bool non-forward — named input equals/compares to an int literal. */
  | { kind: 'namedInputEq'; name: string; value: string }
  | { kind: 'namedInputCmp'; name: string; op: PathEffectCompareOp; value: string }
  | {
    kind: 'namedInputPairCmp';
    leftName: string;
    op: PathEffectCompareOp | '==';
    rightName: string;
  }
  | { kind: 'not'; of: PathEffectActivation }
  | { kind: 'and'; left: PathEffectActivation; right: PathEffectActivation }
  | { kind: 'or'; left: PathEffectActivation; right: PathEffectActivation };

/** One ordered, type-final effect in a handler / deployment site. */
export interface FinalizedTypedEffect {
  /** Source-effect ordinal within the owning schedule. */
  ordinal: number;
  kind: FinalizedTypedEffectKind;
  /** ABI / recipe result type string; required and non-empty when finalized. */
  resultType: string;
  /** Optional activation: legacy bool-param name or structured path-effect activation recipe; absent ⇒ always active. */
  activation?: string | PathEffectActivation;
}

/** Thin path-effect schedule (layout-fold phase 5 stub): ordered finalized effects only. */
export interface PathEffectSchedule {
  version: 1;
  effects: readonly FinalizedTypedEffect[];
}

export type FinalizedTypedEffectIrOptions = {
  /**
   * When true (kernel default), expressions without a stamped type cannot invent
   * intrinsic result types (hash / concat surface defaults).
   */
  requireFinalizedTypes?: boolean;
};

/** True when a recipe/expression already carries a non-empty finalized result type string. */
export function hasFinalizedResultType(resultType: string | undefined | null): boolean {
  return typeof resultType === 'string' && resultType.length > 0;
}

/**
 * Fail closed unless every effect has a finalized result type and ordinals are unique + ordered.
 */
export function assertFinalizedTypedEffectIr(
  effects: readonly FinalizedTypedEffect[],
): asserts effects is readonly FinalizedTypedEffect[] {
  if (effects.length === 0) {
    throw new Error('finalized-typed-effect-ir: empty effect list is not a kernel admission schedule');
  }
  const seen = new Set<number>();
  let previous = -1;
  for (const [index, effect] of effects.entries()) {
    if (!Number.isInteger(effect.ordinal) || effect.ordinal < 0) {
      throw new Error(
        `finalized-typed-effect-ir: effect[${index}] has invalid ordinal ${String(effect.ordinal)}`,
      );
    }
    if (seen.has(effect.ordinal)) {
      throw new Error(
        `finalized-typed-effect-ir: duplicate ordinal ${effect.ordinal}`,
      );
    }
    if (effect.ordinal < previous) {
      throw new Error(
        `finalized-typed-effect-ir: ordinals must be non-decreasing (saw ${previous} then ${effect.ordinal})`,
      );
    }
    seen.add(effect.ordinal);
    previous = effect.ordinal;
    if (!hasFinalizedResultType(effect.resultType)) {
      throw new Error(
        `finalized-typed-effect-ir: effect[${index}] ordinal ${effect.ordinal} missing finalized resultType`,
      );
    }
  }
}

/** Build a path-effect schedule from already-finalized effects (validates IR). */
export function buildPathEffectSchedule(
  effects: readonly FinalizedTypedEffect[],
): PathEffectSchedule {
  assertFinalizedTypedEffectIr(effects);
  return { version: 1, effects: [...effects] };
}

/** Normalize legacy string activations for path-effect schedules. */
export function normalizePathEffectActivation(
  activation: string | PathEffectActivation | undefined,
): PathEffectActivation | undefined {
  if (activation === undefined) return undefined;
  if (typeof activation === 'string') return { kind: 'boolParam', name: activation };
  return activation;
}

export type PathEffectActivationEnvironment = {
  boolParams?: Readonly<Record<string, boolean>>;
  /** Bool uses === true; handlerInputEq compares String(value) to recipe.value. */
  handlerInputs?: readonly unknown[];
  /** Named visible inputs for namedInputEq/Cmp. */
  namedInputs?: Readonly<Record<string, unknown>>;
};

/**
 * Evaluate a path-effect activation recipe (path-effect activation).
 * Absent ⇒ always active. Unknown boolParam / OOB handlerInput ⇒ inactive.
 */
export function evaluatePathEffectActivation(
  activation: string | PathEffectActivation | undefined,
  env: PathEffectActivationEnvironment = {},
): boolean {
  const recipe = normalizePathEffectActivation(activation);
  if (recipe === undefined || recipe.kind === 'always') return true;
  if (recipe.kind === 'boolParam') return env.boolParams?.[recipe.name] === true;
  if (recipe.kind === 'boolParamEq') return env.boolParams?.[recipe.name] === recipe.value;
  if (recipe.kind === 'namedInputEq') {
    return comparePathEffectInputLiteral(env.namedInputs?.[recipe.name], '==', recipe.value);
  }
  if (recipe.kind === 'namedInputCmp') {
    return comparePathEffectInputLiteral(env.namedInputs?.[recipe.name], recipe.op, recipe.value);
  }
  if (recipe.kind === 'namedInputPairCmp') {
    const right = env.namedInputs?.[recipe.rightName];
    if (right === undefined) return false;
    const rightLiteral = typeof right === 'boolean' ? String(right)
      : (() => {
        try { return BigInt(right as bigint | number | string).toString(); } catch { return String(right); }
      })();
    return comparePathEffectInputLiteral(env.namedInputs?.[recipe.leftName], recipe.op, rightLiteral);
  }
  if (recipe.kind === 'handlerInput') {
    if (!Number.isInteger(recipe.inputIndex) || recipe.inputIndex < 0) return false;
    return env.handlerInputs?.[recipe.inputIndex] === true;
  }
  if (recipe.kind === 'handlerInputEq') {
    if (!Number.isInteger(recipe.inputIndex) || recipe.inputIndex < 0) return false;
    return comparePathEffectInputLiteral(
      env.handlerInputs?.[recipe.inputIndex],
      '==',
      recipe.value,
    );
  }
  if (recipe.kind === 'handlerInputCmp') {
    if (!Number.isInteger(recipe.inputIndex) || recipe.inputIndex < 0) return false;
    return comparePathEffectInputLiteral(
      env.handlerInputs?.[recipe.inputIndex],
      recipe.op,
      recipe.value,
    );
  }
  if (recipe.kind === 'handlerInputPairCmp') {
    if (!Number.isInteger(recipe.leftIndex) || recipe.leftIndex < 0
      || !Number.isInteger(recipe.rightIndex) || recipe.rightIndex < 0) {
      return false;
    }
    const right = env.handlerInputs?.[recipe.rightIndex];
    if (right === undefined) return false;
    const rightLiteral = typeof right === 'boolean' ? String(right)
      : (() => {
        try {
          return BigInt(right as bigint | number | string).toString();
        } catch {
          return String(right);
        }
      })();
    return comparePathEffectInputLiteral(
      env.handlerInputs?.[recipe.leftIndex],
      recipe.op,
      rightLiteral,
    );
  }
  if (recipe.kind === 'not') return !evaluatePathEffectActivation(recipe.of, env);
  if (recipe.kind === 'and') {
    return evaluatePathEffectActivation(recipe.left, env)
      && evaluatePathEffectActivation(recipe.right, env);
  }
  if (recipe.kind === 'or') {
    return evaluatePathEffectActivation(recipe.left, env)
      || evaluatePathEffectActivation(recipe.right, env);
  }
  return false;
}

/** Active effects under a path-effect activation environment. */
export function selectActivePathEffects(
  schedule: PathEffectSchedule,
  env: PathEffectActivationEnvironment = {},
): readonly FinalizedTypedEffect[] {
  return schedule.effects.filter((effect) => evaluatePathEffectActivation(effect.activation, env));
}

/**
 * Whether pre-final intrinsic type invention is allowed.
 * Analysis may pass `requireFinalizedTypes: true` to refuse invention; publication always
 * asserts finalized resultTypes via `pathEffectScheduleFromChildDeployments`.
 */
export function allowsPreFinalIntrinsicTypes(
  options?: FinalizedTypedEffectIrOptions,
): boolean {
  return options?.requireFinalizedTypes !== true;
}

/** Minimal published child-deployment site shape used for finalized typed effect IR publication checks. */
export type PublishedChildDeploymentSite = {
  constructorArgs?: ReadonlyArray<{ kind?: string; resultType?: string } | undefined>;
  salt?: { kind?: string; resultType?: string };
  /** Either a direct recipe or a transfer wrapper with `amount` recipe. */
  value?: {
    kind?: string;
    resultType?: string;
    amount?: { kind?: string; resultType?: string };
  };
};

const recipeKindToEffectKind = (kind: string | undefined): FinalizedTypedEffectKind => {
  if (kind === 'hash') return 'hash';
  if (kind === 'concat') return 'concat';
  return 'constructorArg';
};

/**
 * finalized typed effect IR: build a path-effect schedule from published child-deployment recipes.
 * Fails closed if any published recipe is missing a finalized resultType.
 * This is the kernel admission gate on artifact IR (analysis may still use pre-final bridges).
 */
export function pathEffectScheduleFromChildDeployments(
  sites: readonly PublishedChildDeploymentSite[] | undefined,
): PathEffectSchedule | undefined {
  if (sites === undefined || sites.length === 0) return undefined;
  const effects: FinalizedTypedEffect[] = [];
  let ordinal = 0;
  for (const site of sites) {
    for (const arg of site.constructorArgs ?? []) {
      if (arg === undefined) {
        throw new Error('finalized-typed-effect-ir: published constructorArg is undefined');
      }
      if (!hasFinalizedResultType(arg.resultType)) {
        throw new Error(
          `finalized-typed-effect-ir: published constructorArg missing resultType (kind=${arg.kind ?? '?'})`,
        );
      }
      effects.push({
        ordinal: ordinal++,
        kind: recipeKindToEffectKind(arg.kind),
        resultType: arg.resultType!,
      });
    }
    if (site.salt !== undefined) {
      if (!hasFinalizedResultType(site.salt.resultType)) {
        throw new Error('finalized-typed-effect-ir: published salt missing resultType');
      }
      effects.push({
        ordinal: ordinal++,
        kind: 'salt',
        resultType: site.salt.resultType!,
      });
    }
    if (site.value !== undefined) {
      const valueRecipe = site.value.amount ?? site.value;
      if (!hasFinalizedResultType(valueRecipe.resultType)) {
        throw new Error('finalized-typed-effect-ir: published value missing resultType');
      }
      effects.push({
        ordinal: ordinal++,
        kind: 'value',
        resultType: valueRecipe.resultType!,
      });
    }
  }
  if (effects.length === 0) return undefined;
  return buildPathEffectSchedule(effects);
}

/** Assert every published child-deployment site carries finalized typed effect IR. */
export function assertPublishedChildDeploymentEffectIr(
  sites: readonly PublishedChildDeploymentSite[] | undefined,
): PathEffectSchedule | undefined {
  return pathEffectScheduleFromChildDeployments(sites);
}

/**
 * Structural subset of artifact ExternalCallExpression used to stamp path-effect activations.
 * Mirrors solidcash foldActivationFromExternalCallExpression (path-effect parity).
 */
export type PathEffectActivationExpression = {
  kind: string;
  name?: string;
  operator?: string;
  type?: string;
  value?: string | boolean;
  expression?: PathEffectActivationExpression;
  left?: PathEffectActivationExpression;
  right?: PathEffectActivationExpression;
  source?: { kind?: string; paramIndex?: number; paramName?: string };
};

/** Map compiler ECE onto a structured path-effect activation recipe. */
export function pathEffectActivationFromExpression(
  expression: PathEffectActivationExpression | undefined,
): PathEffectActivation | undefined {
  if (expression === undefined) return undefined;
  if (expression.kind === 'literal' && expression.type === 'bool') {
    return expression.value === true ? { kind: 'always' } : { kind: 'not', of: { kind: 'always' } };
  }
  if (expression.kind === 'identifier' && typeof expression.name === 'string' && expression.name.length > 0) {
    return { kind: 'boolParam', name: expression.name };
  }
  if (expression.kind === 'source' && expression.source?.kind === 'forward') {
    if (typeof expression.source.paramName === 'string' && expression.source.paramName.length > 0) {
      return { kind: 'boolParam', name: expression.source.paramName };
    }
    if (Number.isInteger(expression.source.paramIndex) && (expression.source.paramIndex ?? -1) >= 0) {
      return { kind: 'handlerInput', inputIndex: expression.source.paramIndex! };
    }
    return undefined;
  }
  if (expression.kind === 'unary' && expression.operator === '!' && expression.expression) {
    const inner = pathEffectActivationFromExpression(expression.expression);
    return inner === undefined ? undefined : { kind: 'not', of: inner };
  }
  if (expression.kind === 'binary' && expression.left && expression.right
    && (expression.operator === '&&' || expression.operator === '||')) {
    const left = pathEffectActivationFromExpression(expression.left);
    const right = pathEffectActivationFromExpression(expression.right);
    if (left === undefined || right === undefined) return undefined;
    return expression.operator === '&&'
      ? { kind: 'and', left, right }
      : { kind: 'or', left, right };
  }
  // path-effect activation: handlerInput == / != / <> int/bool literal, or cross-input compares.
  if (expression.kind === 'binary' && expression.left && expression.right
    && (expression.operator === '==' || expression.operator === '!='
      || expression.operator === '<' || expression.operator === '<='
      || expression.operator === '>' || expression.operator === '>=')) {
    const left = expression.left;
    const right = expression.right;
    const op = expression.operator;
    if (left.kind === 'source' && left.source?.kind === 'forward'
      && right.kind === 'source' && right.source?.kind === 'forward'
      && Number.isInteger(left.source.paramIndex) && (left.source.paramIndex ?? -1) >= 0
      && Number.isInteger(right.source.paramIndex) && (right.source.paramIndex ?? -1) >= 0) {
      return {
        kind: 'handlerInputPairCmp',
        leftIndex: left.source.paramIndex!,
        op: op as PathEffectCompareOp | '==',
        rightIndex: right.source.paramIndex!,
      };
    }
    if (left.kind === 'identifier' && right.kind === 'identifier'
      && typeof left.name === 'string' && left.name.length > 0
      && typeof right.name === 'string' && right.name.length > 0) {
      return {
        kind: 'namedInputPairCmp',
        leftName: left.name,
        op: op as PathEffectCompareOp | '==',
        rightName: right.name,
      };
    }
    if (op === '==' || op === '!=') {
      const asBoolParamEq = (
        nameSide: PathEffectActivationExpression,
        literalSide: PathEffectActivationExpression,
      ): PathEffectActivation | undefined => {
        const name = nameSide.kind === 'identifier' && typeof nameSide.name === 'string'
          ? nameSide.name
          : (nameSide.kind === 'source' && nameSide.source?.kind === 'forward'
            && typeof nameSide.source.paramName === 'string'
            ? nameSide.source.paramName
            : undefined);
        if (name === undefined || name.length === 0) return undefined;
        if (literalSide.kind !== 'literal' || literalSide.type !== 'bool'
          || typeof literalSide.value !== 'boolean') {
          return undefined;
        }
        const eq: PathEffectActivation = {
          kind: 'boolParamEq',
          name,
          value: literalSide.value,
        };
        return op === '!=' ? { kind: 'not', of: eq } : eq;
      };
      const boolParamEq = asBoolParamEq(left, right) ?? asBoolParamEq(right, left);
      if (boolParamEq !== undefined) return boolParamEq;
    }
    {
      const namedSideName = (side: PathEffectActivationExpression): string | undefined => {
        if (side.kind === 'identifier' && typeof side.name === 'string' && side.name.length > 0) {
          return side.name;
        }
        if (side.kind === 'source' && side.source?.kind === 'forward'
          && typeof side.source.paramName === 'string' && side.source.paramName.length > 0) {
          return side.source.paramName;
        }
        return undefined;
      };
      const asNamed = (
        nameSide: PathEffectActivationExpression,
        literalSide: PathEffectActivationExpression,
        compareOp: string,
        flipped: boolean,
      ): PathEffectActivation | undefined => {
        const name = namedSideName(nameSide);
        if (name === undefined) return undefined;
        if (literalSide.kind !== 'literal' || literalSide.type !== 'bigint'
          || literalSide.value === undefined) {
          return undefined;
        }
        const value = String(literalSide.value);
        if (compareOp === '==') return { kind: 'namedInputEq', name, value };
        if (compareOp === '!=') return { kind: 'namedInputCmp', name, op: '!=', value };
        const relational = flipped
          ? ({ '<': '>', '<=': '>=', '>': '<', '>=': '<=' } as const)[compareOp as '<' | '<=' | '>' | '>=']
          : compareOp;
        if (relational === '<' || relational === '<=' || relational === '>' || relational === '>=') {
          return { kind: 'namedInputCmp', name, op: relational, value };
        }
        return undefined;
      };
      const named = asNamed(left, right, op, false) ?? asNamed(right, left, op, true);
      if (named !== undefined) return named;
    }
    const asCompare = (
      inputSide: PathEffectActivationExpression,
      literalSide: PathEffectActivationExpression,
      compareOp: string,
      flipped: boolean,
    ): PathEffectActivation | undefined => {
      if (inputSide.kind !== 'source' || inputSide.source?.kind !== 'forward') return undefined;
      if (!Number.isInteger(inputSide.source.paramIndex) || (inputSide.source.paramIndex ?? -1) < 0) {
        return undefined;
      }
      let literalValue: string | undefined;
      if (literalSide.kind === 'literal' && literalSide.type === 'bigint'
        && literalSide.value !== undefined) {
        literalValue = String(literalSide.value);
      } else if (literalSide.kind === 'literal' && literalSide.type === 'bool'
        && typeof literalSide.value === 'boolean') {
        if (compareOp !== '==' && compareOp !== '!=') return undefined;
        literalValue = String(literalSide.value);
      }
      if (literalValue === undefined) return undefined;
      const inputIndex = inputSide.source.paramIndex!;
      if (compareOp === '==') return { kind: 'handlerInputEq', inputIndex, value: literalValue };
      if (compareOp === '!=') {
        return { kind: 'handlerInputCmp', inputIndex, op: '!=', value: literalValue };
      }
      const relational = flipped
        ? ({ '<': '>', '<=': '>=', '>': '<', '>=': '<=' } as const)[compareOp as '<' | '<=' | '>' | '>=']
        : compareOp;
      if (relational === '<' || relational === '<=' || relational === '>' || relational === '>=') {
        return { kind: 'handlerInputCmp', inputIndex, op: relational, value: literalValue };
      }
      return undefined;
    };
    return asCompare(left, right, op, false) ?? asCompare(right, left, op, true);
  }
  return undefined;
}

/** Compare a handler input value to a literal string under a relational op (path-effect activation). */
export function comparePathEffectInputLiteral(
  actual: unknown,
  op: PathEffectCompareOp | '==',
  expected: string,
): boolean {
  if (actual === undefined) return false;
  if (typeof actual === 'boolean') {
    const left = String(actual);
    if (op === '==') return left === expected;
    if (op === '!=') return left !== expected;
    return false;
  }
  let left: bigint;
  let right: bigint;
  try {
    left = BigInt(actual as bigint | number | string);
    right = BigInt(expected);
  } catch {
    const leftStr = String(actual);
    if (op === '==') return leftStr === expected;
    if (op === '!=') return leftStr !== expected;
    return false;
  }
  if (op === '==') return left === right;
  if (op === '!=') return left !== right;
  if (op === '<') return left < right;
  if (op === '<=') return left <= right;
  if (op === '>') return left > right;
  if (op === '>=') return left >= right;
  return false;
}

/** One handler state-write / collection mutation for a multi-effect path-effect program. */
export type HandlerPathEffectStateWrite = {
  effectOrdinal: number;
  resultType: string;
  collection?: string;
  activation?: string | PathEffectActivation | PathEffectActivationExpression;
};

/** One emit site in a handler path-effect program. */
export type HandlerPathEffectEvent = {
  effectOrdinal: number;
  /** Finalized event payload / signature type string. */
  resultType: string;
  eventName?: string;
  activation?: string | PathEffectActivation | PathEffectActivationExpression;
};

/** One fixed BCH transfer site in a handler path-effect program. */
export type HandlerPathEffectTransfer = {
  effectOrdinal: number;
  resultType: string;
  activation?: string | PathEffectActivation | PathEffectActivationExpression;
};

export type HandlerPathEffectProgramInput = {
  stateWrites?: readonly HandlerPathEffectStateWrite[];
  events?: readonly HandlerPathEffectEvent[];
  transfers?: readonly HandlerPathEffectTransfer[];
  /** Flattened into the same ordinal space after handler-local effects when provided. */
  childDeployments?: readonly PublishedChildDeploymentSite[];
};

function resolveHandlerPathEffectActivation(
  activation: string | PathEffectActivation | PathEffectActivationExpression | undefined,
): PathEffectActivation | undefined {
  if (activation === undefined) return undefined;
  if (typeof activation === 'string') return normalizePathEffectActivation(activation);
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
    || activation.kind === 'not'
    || activation.kind === 'and'
    || activation.kind === 'or'
  )) {
    return activation as PathEffectActivation;
  }
  return pathEffectActivationFromExpression(activation as PathEffectActivationExpression);
}

/**
 * Build a multi-effect path-effect schedule from handler-local writes, events, and transfers
 * (and optional child-deployment recipes). Effect ordinals must be unique across the combined program.
 */
export function pathEffectScheduleFromHandlerEffects(
  input: HandlerPathEffectProgramInput,
): PathEffectSchedule | undefined {
  const effects: FinalizedTypedEffect[] = [];
  const seen = new Set<number>();
  const pushEffect = (effect: FinalizedTypedEffect): void => {
    if (seen.has(effect.ordinal)) {
      throw new Error(
        `finalized-typed-effect-ir: handler path-effect duplicate ordinal ${effect.ordinal}`,
      );
    }
    seen.add(effect.ordinal);
    effects.push(effect);
  };

  for (const write of input.stateWrites ?? []) {
    if (!hasFinalizedResultType(write.resultType)) {
      throw new Error(
        `finalized-typed-effect-ir: stateWrite ordinal ${write.effectOrdinal} missing resultType`,
      );
    }
    const activation = resolveHandlerPathEffectActivation(write.activation);
    pushEffect({
      ordinal: write.effectOrdinal,
      kind: 'stateWrite',
      resultType: write.resultType,
      ...(activation !== undefined && { activation }),
    });
  }
  for (const event of input.events ?? []) {
    if (!hasFinalizedResultType(event.resultType)) {
      throw new Error(
        `finalized-typed-effect-ir: event ordinal ${event.effectOrdinal} missing resultType`,
      );
    }
    const activation = resolveHandlerPathEffectActivation(event.activation);
    pushEffect({
      ordinal: event.effectOrdinal,
      kind: 'event',
      resultType: event.resultType,
      ...(activation !== undefined && { activation }),
    });
  }
  for (const transfer of input.transfers ?? []) {
    if (!hasFinalizedResultType(transfer.resultType)) {
      throw new Error(
        `finalized-typed-effect-ir: transfer ordinal ${transfer.effectOrdinal} missing resultType`,
      );
    }
    const activation = resolveHandlerPathEffectActivation(transfer.activation);
    pushEffect({
      ordinal: transfer.effectOrdinal,
      kind: 'transfer',
      resultType: transfer.resultType,
      ...(activation !== undefined && { activation }),
    });
  }

  const childSchedule = pathEffectScheduleFromChildDeployments(input.childDeployments);
  if (childSchedule !== undefined) {
    // Child-deploy effects append after handler-local ordinals using a dense offset past the max local ordinal.
    const localMax = effects.reduce((max, effect) => Math.max(max, effect.ordinal), -1);
    const offset = localMax + 1;
    for (const child of childSchedule.effects) {
      pushEffect({
        ...child,
        ordinal: offset + child.ordinal,
      });
    }
  }

  if (effects.length === 0) return undefined;
  effects.sort((left, right) => left.ordinal - right.ordinal);
  return buildPathEffectSchedule(effects);
}
