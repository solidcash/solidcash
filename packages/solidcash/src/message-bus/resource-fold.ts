/**
 * Multi-row state fold planner (Published resource-fold plans).
 *
 * `leadingValue` / complete folded values must be outputs of this fold, not separately
 * reconstructed SDK conventions (`encodeLeadingRouteArrayPushes`).
 *
 * When an artifact publishes `resourceFoldPlans`, that summary is fold authority for
 * step kind / initial source / witness names. Runtime still supplies ordered row elements.
 * Rediscovery remains the legacy fallback only when no published plan list is present.
 *
 * Fold: initial → row1 → row2 → … → final
 */

export type ResourceFoldStepKind = 'push' | 'assign' | 'update';

/**
 * path-effect activation / layout-fold phase 5: fold activation beyond bare bool-param name strings.
 * A plain string remains sugar for `{ kind: 'boolParam', name }`.
 * `and` / `or` match compiler-stamped fixed-chunkable ECE combinations.
 */
/** path-effect activation: relational compare of a handler input against an int/bool literal. */
export type FoldActivationCompareOp = '!=' | '<' | '<=' | '>' | '>=';

export type FoldActivationRecipe =
  | { kind: 'always' }
  | { kind: 'boolParam'; name: string }
  | { kind: 'handlerInput'; inputIndex: number }
  /** path-effect activation: handler input equals an int/bool literal (switch-arm refine). */
  | { kind: 'handlerInputEq'; inputIndex: number; value: string }
  /** path-effect activation: broader predicate — handler input compared to an int/bool literal. */
  | { kind: 'handlerInputCmp'; inputIndex: number; op: FoldActivationCompareOp; value: string }
  /** path-effect activation: cross-input predicate — compare two handler inputs. */
  | {
    kind: 'handlerInputPairCmp';
    leftIndex: number;
    op: FoldActivationCompareOp | '==';
    rightIndex: number;
  }
  /** path-effect activation: non-handler-input side — named bool param equals a bool literal. */
  | { kind: 'boolParamEq'; name: string; value: boolean }
  /** path-effect activation: non-bool non-forward — named input equals/compares to an int literal. */
  | { kind: 'namedInputEq'; name: string; value: string }
  | { kind: 'namedInputCmp'; name: string; op: FoldActivationCompareOp; value: string }
  /** path-effect activation: non-literal sides — compare two named inputs. */
  | {
    kind: 'namedInputPairCmp';
    leftName: string;
    op: FoldActivationCompareOp | '==';
    rightName: string;
  }
  /** path-effect activation: bounded state-side — state field equals/compares to an int/bool literal. */
  | { kind: 'stateEq'; name: string; value: string }
  | { kind: 'stateCmp'; name: string; op: FoldActivationCompareOp; value: string }
  /** path-effect activation: bounded call-side — named call result equals/compares to an int/bool literal. */
  | { kind: 'callEq'; name: string; value: string }
  | { kind: 'callCmp'; name: string; op: FoldActivationCompareOp; value: string }
  /** path-effect activation: nested compound — compare a state field to a call result. */
  | {
    kind: 'stateCallCmp';
    stateName: string;
    op: FoldActivationCompareOp | '==';
    callName: string;
  }
  | { kind: 'not'; of: FoldActivationRecipe }
  | { kind: 'and'; left: FoldActivationRecipe; right: FoldActivationRecipe }
  | { kind: 'or'; left: FoldActivationRecipe; right: FoldActivationRecipe };

/**
 * Structural subset of artifact `ExternalCallExpression` used to stamp fold activations.
 * Kept local so resource-fold stays free of full artifact coupling.
 */
export type FoldActivationExpression = {
  kind: string;
  name?: string;
  operator?: string;
  type?: string;
  value?: string | boolean;
  expression?: FoldActivationExpression;
  left?: FoldActivationExpression;
  right?: FoldActivationExpression;
  source?: { kind?: string; paramIndex?: number; paramName?: string };
  /** State field path / collection name for kind === 'state'. */
  stateName?: string;
  /** Ternary / conditional arms. */
  condition?: FoldActivationExpression;
  consequent?: FoldActivationExpression;
  alternate?: FoldActivationExpression;
  /** Member access: object.property. */
  object?: FoldActivationExpression;
  property?: string;
  /** Array index access: base[index]. */
  base?: FoldActivationExpression;
  index?: FoldActivationExpression | number | string;
  /** Cast target type for kind === 'cast'. */
  castType?: string;
};

/** Normalize legacy string activations and structured recipes. */
export function normalizeFoldActivation(
  activation: string | FoldActivationRecipe | undefined,
): FoldActivationRecipe | undefined {
  if (activation === undefined) return undefined;
  if (typeof activation === 'string') {
    return { kind: 'boolParam', name: activation };
  }
  return activation;
}

/**
 * Map a compiler-stamped fixed-chunkable activation ECE onto a structured fold recipe.
 * Supported: bool literal, identifier/boolParam name, source.forward → handlerInput,
 * unary `!`, binary `&&` / `||`. Unsupported shapes return undefined (caller may fall back).
 */
export function foldActivationFromExternalCallExpression(
  expression: FoldActivationExpression | undefined,
): FoldActivationRecipe | undefined {
  if (expression === undefined) return undefined;
  if (expression.kind === 'literal' && expression.type === 'bool') {
    return expression.value === true ? { kind: 'always' } : {
      kind: 'not',
      of: { kind: 'always' },
    };
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
    const inner = foldActivationFromExternalCallExpression(expression.expression);
    return inner === undefined ? undefined : { kind: 'not', of: inner };
  }
  // path-effect activation: ternary → (cond && then) || (!cond && else)
  if ((expression.kind === 'ternary' || expression.kind === 'conditional')
    && expression.condition && expression.consequent && expression.alternate) {
    const cond = foldActivationFromExternalCallExpression(expression.condition);
    const thenArm = foldActivationFromExternalCallExpression(expression.consequent);
    const elseArm = foldActivationFromExternalCallExpression(expression.alternate);
    if (cond === undefined || thenArm === undefined || elseArm === undefined) return undefined;
    return {
      kind: 'or',
      left: { kind: 'and', left: cond, right: thenArm },
      right: { kind: 'and', left: { kind: 'not', of: cond }, right: elseArm },
    };
  }
  // path-effect activation: member access as named state path for later compare mapping.
  if (expression.kind === 'member' && expression.object && typeof expression.property === 'string'
    && expression.property.length > 0) {
    const objectName = expression.object.kind === 'identifier' && typeof expression.object.name === 'string'
      ? expression.object.name
      : (expression.object.kind === 'state'
        ? (expression.object.stateName ?? expression.object.name)
        : undefined);
    if (typeof objectName === 'string' && objectName.length > 0) {
      return undefined; // bare member is not a bool recipe; compare arms handle member below
    }
  }
  if (expression.kind === 'binary' && expression.left && expression.right
    && (expression.operator === '&&' || expression.operator === '||')) {
    const left = foldActivationFromExternalCallExpression(expression.left);
    const right = foldActivationFromExternalCallExpression(expression.right);
    if (left === undefined || right === undefined) return undefined;
    return expression.operator === '&&'
      ? { kind: 'and', left, right }
      : { kind: 'or', left, right };
  }
  if (expression.kind === 'binary' && expression.left && expression.right
    && (expression.operator === '==' || expression.operator === '!='
      || expression.operator === '<' || expression.operator === '<='
      || expression.operator === '>' || expression.operator === '>=')) {
    const left = expression.left;
    const right = expression.right;
    const op = expression.operator;
    // path-effect activation: cross-input — both sides are handler inputs.
    if (left.kind === 'source' && left.source?.kind === 'forward'
      && right.kind === 'source' && right.source?.kind === 'forward'
      && Number.isInteger(left.source.paramIndex) && (left.source.paramIndex ?? -1) >= 0
      && Number.isInteger(right.source.paramIndex) && (right.source.paramIndex ?? -1) >= 0) {
      return {
        kind: 'handlerInputPairCmp',
        leftIndex: left.source.paramIndex!,
        op: op as FoldActivationCompareOp | '==',
        rightIndex: right.source.paramIndex!,
      };
    }
    // path-effect activation: non-literal named sides — identifier vs identifier.
    if (left.kind === 'identifier' && right.kind === 'identifier'
      && typeof left.name === 'string' && left.name.length > 0
      && typeof right.name === 'string' && right.name.length > 0) {
      return {
        kind: 'namedInputPairCmp',
        leftName: left.name,
        op: op as FoldActivationCompareOp | '==',
        rightName: right.name,
      };
    }
    // path-effect activation: bounded state / call side vs literal.
    {
      const asNamedSide = (
        side: FoldActivationExpression,
        literalSide: FoldActivationExpression,
        compareOp: string,
        flipped: boolean,
        kind: 'state' | 'call',
      ): FoldActivationRecipe | undefined => {
        if (side.kind !== kind) return undefined;
        const name = kind === 'state' && typeof side.stateName === 'string' && side.stateName.length > 0
          ? side.stateName
          : (typeof side.name === 'string' && side.name.length > 0 ? side.name : undefined);
        if (name === undefined) return undefined;
        let value: string | undefined;
        if (literalSide.kind === 'literal' && literalSide.type === 'bigint'
          && literalSide.value !== undefined) {
          value = String(literalSide.value);
        } else if (literalSide.kind === 'literal' && literalSide.type === 'bool'
          && typeof literalSide.value === 'boolean') {
          if (compareOp !== '==' && compareOp !== '!=') return undefined;
          value = String(literalSide.value);
        }
        if (value === undefined) return undefined;
        if (kind === 'state') {
          if (compareOp === '==') return { kind: 'stateEq', name, value };
          if (compareOp === '!=') return { kind: 'stateCmp', name, op: '!=', value };
          const relational = flipped
            ? ({ '<': '>', '<=': '>=', '>': '<', '>=': '<=' } as const)[compareOp as '<' | '<=' | '>' | '>=']
            : compareOp;
          if (relational === '<' || relational === '<=' || relational === '>' || relational === '>=') {
            return { kind: 'stateCmp', name, op: relational, value };
          }
        } else {
          if (compareOp === '==') return { kind: 'callEq', name, value };
          if (compareOp === '!=') return { kind: 'callCmp', name, op: '!=', value };
          const relational = flipped
            ? ({ '<': '>', '<=': '>=', '>': '<', '>=': '<=' } as const)[compareOp as '<' | '<=' | '>' | '>=']
            : compareOp;
          if (relational === '<' || relational === '<=' || relational === '>' || relational === '>=') {
            return { kind: 'callCmp', name, op: relational, value };
          }
        }
        return undefined;
      };
      const stateOrCall = asNamedSide(left, right, op, false, 'state')
        ?? asNamedSide(right, left, op, true, 'state')
        ?? asNamedSide(left, right, op, false, 'call')
        ?? asNamedSide(right, left, op, true, 'call');
      if (stateOrCall !== undefined) return stateOrCall;
      // path-effect activation: nested compound — state field vs call result.
      const asStateCall = (
        stateSide: FoldActivationExpression,
        callSide: FoldActivationExpression,
        compareOp: string,
        flipped: boolean,
      ): FoldActivationRecipe | undefined => {
        if (stateSide.kind !== 'state' || callSide.kind !== 'call') return undefined;
        const stateName = (typeof stateSide.stateName === 'string' && stateSide.stateName.length > 0)
          ? stateSide.stateName
          : (typeof stateSide.name === 'string' ? stateSide.name : undefined);
        const callName = typeof callSide.name === 'string' ? callSide.name : undefined;
        if (!stateName || !callName) return undefined;
        const relational = flipped && compareOp !== '==' && compareOp !== '!='
          ? ({ '<': '>', '<=': '>=', '>': '<', '>=': '<=' } as const)[compareOp as '<' | '<=' | '>' | '>=']
          : compareOp;
        if (relational === '==' || relational === '!=' || relational === '<'
          || relational === '<=' || relational === '>' || relational === '>=') {
          return {
            kind: 'stateCallCmp',
            stateName,
            op: relational,
            callName,
          };
        }
        return undefined;
      };
      const stateCall = asStateCall(left, right, op, false) ?? asStateCall(right, left, op, true);
      if (stateCall !== undefined) return stateCall;
    }
    // path-effect activation: non-handler-input — identifier/paramName vs bool or int literal.
    const namedSideName = (side: FoldActivationExpression): string | undefined => {
      if (side.kind === 'identifier' && typeof side.name === 'string' && side.name.length > 0) {
        return side.name;
      }
      if (side.kind === 'source' && side.source?.kind === 'forward'
        && typeof side.source.paramName === 'string' && side.source.paramName.length > 0) {
        return side.source.paramName;
      }
      // path-effect activation: member access → dotted state path for named/state compares.
      if (side.kind === 'member' && side.object && typeof side.property === 'string'
        && side.property.length > 0) {
        const objectName = side.object.kind === 'identifier' && typeof side.object.name === 'string'
          ? side.object.name
          : (side.object.kind === 'state'
            ? (side.object.stateName ?? side.object.name)
            : undefined);
        if (typeof objectName === 'string' && objectName.length > 0) {
          return `${objectName}.${side.property}`;
        }
      }
      // path-effect activation: array index → base[index] dotted/bracket path.
      if (side.kind === 'index' || side.kind === 'arrayIndex') {
        const baseName = side.base?.kind === 'identifier' && typeof side.base.name === 'string'
          ? side.base.name
          : (side.base?.kind === 'state' ? (side.base.stateName ?? side.base.name) : undefined);
        let indexLabel: string | undefined;
        if (typeof side.index === 'number' || typeof side.index === 'string') {
          indexLabel = String(side.index);
        } else if (side.index && typeof side.index === 'object') {
          if (side.index.kind === 'literal' && side.index.value !== undefined) {
            indexLabel = String(side.index.value);
          } else if (side.index.kind === 'identifier' && typeof side.index.name === 'string') {
            indexLabel = side.index.name;
          }
        }
        if (typeof baseName === 'string' && baseName.length > 0 && indexLabel !== undefined) {
          return `${baseName}[${indexLabel}]`;
        }
      }
      // path-effect activation: cast → underlying expression name, preferring castType suffix.
      if (side.kind === 'cast' && side.expression) {
        const inner = namedSideName(side.expression);
        if (inner !== undefined) {
          return typeof side.castType === 'string' && side.castType.length > 0
            ? `${inner} as ${side.castType}`
            : inner;
        }
      }
      return undefined;
    };
    if (op === '==' || op === '!=') {
      const asBoolParamEq = (
        nameSide: FoldActivationExpression,
        literalSide: FoldActivationExpression,
      ): FoldActivationRecipe | undefined => {
        const name = namedSideName(nameSide);
        if (name === undefined) return undefined;
        if (literalSide.kind !== 'literal' || literalSide.type !== 'bool'
          || typeof literalSide.value !== 'boolean') {
          return undefined;
        }
        const eq: FoldActivationRecipe = {
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
      const asNamed = (
        nameSide: FoldActivationExpression,
        literalSide: FoldActivationExpression,
        compareOp: string,
        flipped: boolean,
      ): FoldActivationRecipe | undefined => {
        const name = namedSideName(nameSide);
        if (name === undefined) return undefined;
        if (literalSide.kind !== 'literal' || literalSide.type !== 'bigint'
          || literalSide.value === undefined) {
          return undefined;
        }
        const value = String(literalSide.value);
        if (compareOp === '==') return { kind: 'namedInputEq', name, value };
        if (compareOp === '!=') {
          return { kind: 'namedInputCmp', name, op: '!=', value };
        }
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
      inputSide: FoldActivationExpression,
      literalSide: FoldActivationExpression,
      compareOp: string,
      flipped: boolean,
    ): FoldActivationRecipe | undefined => {
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
        // Ordering compares are int-only; bool only admits == / !=.
        if (compareOp !== '==' && compareOp !== '!=') return undefined;
        literalValue = String(literalSide.value);
      }
      if (literalValue === undefined) return undefined;
      const inputIndex = inputSide.source.paramIndex!;
      if (compareOp === '==') return { kind: 'handlerInputEq', inputIndex, value: literalValue };
      if (compareOp === '!=') {
        return { kind: 'handlerInputCmp', inputIndex, op: '!=', value: literalValue };
      }
      // Flip relational ops when the literal was on the left (3 < x ⇒ x > 3).
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
export function compareHandlerInputLiteral(
  actual: unknown,
  op: FoldActivationCompareOp | '==',
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

export type FoldActivationEnvironment = {
  /** Named bool params / recipe ids (legacy string activations). */
  boolParams?: Readonly<Record<string, boolean>>;
  /**
   * ABI-visible handler inputs by index.
   * Bool path uses === true; handlerInputEq compares String/BigInt form to recipe.value.
   */
  handlerInputs?: readonly unknown[];
  /** Named visible inputs (path-effect activation namedInputEq/Cmp for non-forward identifier sides). */
  namedInputs?: Readonly<Record<string, unknown>>;
  /** Named state field values for path-effect activation stateEq/Cmp (bounded state-side activations). */
  stateValues?: Readonly<Record<string, unknown>>;
  /** Named call-result values for path-effect activation callEq/Cmp (bounded call-side activations). */
  callResults?: Readonly<Record<string, unknown>>;
};

/**
 * Evaluate a fold/path-effect activation recipe.
 * Absent activation ⇒ always active. Unknown boolParam / OOB handlerInput ⇒ inactive (fail closed).
 */
export function evaluateFoldActivation(
  activation: string | FoldActivationRecipe | undefined,
  env: FoldActivationEnvironment = {},
): boolean {
  const recipe = normalizeFoldActivation(activation);
  if (recipe === undefined || recipe.kind === 'always') return true;
  if (recipe.kind === 'boolParam') {
    return env.boolParams?.[recipe.name] === true;
  }
  if (recipe.kind === 'boolParamEq') {
    return env.boolParams?.[recipe.name] === recipe.value;
  }
  if (recipe.kind === 'namedInputEq') {
    return compareHandlerInputLiteral(
      env.namedInputs?.[recipe.name] ?? env.stateValues?.[recipe.name],
      '==',
      recipe.value,
    );
  }
  if (recipe.kind === 'namedInputCmp') {
    return compareHandlerInputLiteral(
      env.namedInputs?.[recipe.name] ?? env.stateValues?.[recipe.name],
      recipe.op,
      recipe.value,
    );
  }
  if (recipe.kind === 'namedInputPairCmp') {
    const right = env.namedInputs?.[recipe.rightName];
    if (right === undefined) return false;
    const rightLiteral = typeof right === 'boolean' ? String(right)
      : (() => {
        try {
          return BigInt(right as bigint | number | string).toString();
        } catch {
          return String(right);
        }
      })();
    return compareHandlerInputLiteral(env.namedInputs?.[recipe.leftName], recipe.op, rightLiteral);
  }
  if (recipe.kind === 'stateEq') {
    return compareHandlerInputLiteral(env.stateValues?.[recipe.name], '==', recipe.value);
  }
  if (recipe.kind === 'stateCmp') {
    return compareHandlerInputLiteral(env.stateValues?.[recipe.name], recipe.op, recipe.value);
  }
  if (recipe.kind === 'callEq') {
    return compareHandlerInputLiteral(env.callResults?.[recipe.name], '==', recipe.value);
  }
  if (recipe.kind === 'callCmp') {
    return compareHandlerInputLiteral(env.callResults?.[recipe.name], recipe.op, recipe.value);
  }
  if (recipe.kind === 'stateCallCmp') {
    const right = env.callResults?.[recipe.callName];
    if (right === undefined) return false;
    const rightLiteral = typeof right === 'boolean' ? String(right)
      : (() => {
        try {
          return BigInt(right as bigint | number | string).toString();
        } catch {
          return String(right);
        }
      })();
    return compareHandlerInputLiteral(env.stateValues?.[recipe.stateName], recipe.op, rightLiteral);
  }
  if (recipe.kind === 'handlerInput') {
    if (!Number.isInteger(recipe.inputIndex) || recipe.inputIndex < 0) return false;
    return env.handlerInputs?.[recipe.inputIndex] === true;
  }
  if (recipe.kind === 'handlerInputEq') {
    if (!Number.isInteger(recipe.inputIndex) || recipe.inputIndex < 0) return false;
    return compareHandlerInputLiteral(
      env.handlerInputs?.[recipe.inputIndex],
      '==',
      recipe.value,
    );
  }
  if (recipe.kind === 'handlerInputCmp') {
    if (!Number.isInteger(recipe.inputIndex) || recipe.inputIndex < 0) return false;
    return compareHandlerInputLiteral(
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
    return compareHandlerInputLiteral(
      env.handlerInputs?.[recipe.leftIndex],
      recipe.op,
      rightLiteral,
    );
  }
  if (recipe.kind === 'not') {
    return !evaluateFoldActivation(recipe.of, env);
  }
  if (recipe.kind === 'and') {
    return evaluateFoldActivation(recipe.left, env) && evaluateFoldActivation(recipe.right, env);
  }
  if (recipe.kind === 'or') {
    return evaluateFoldActivation(recipe.left, env) || evaluateFoldActivation(recipe.right, env);
  }
  return false;
}

/** One ordered mutating row against a shared chunkable resource. */
export interface ResourceFoldStep {
  /** Logical row / selector identity. */
  rowSelector?: string;
  /** Effect ordinal within the handler source-effect schedule. */
  effectOrdinal?: number;
  kind: ResourceFoldStepKind;
  /**
   * Optional activation: legacy bool-param name string, or structured path-effect activation recipe.
   * Absent ⇒ always active.
   */
  activation?: string | FoldActivationRecipe;
  /** Opaque element / value recipe evaluated in the row's ABI environment. */
  elementRecipeId?: string;
}

/** Compiler-published fold plan for one chunkable collection+key domain. */
export interface ResourceFoldPlan {
  collection: string;
  collectionHash?: string;
  keyDomainId?: string;
  /** Prior commitment / empty initial source. */
  initialSource: 'empty' | 'prior-commitment' | 'leading-witness';
  steps: readonly ResourceFoldStep[];
  /** Witness name for the mid-fold leading value (earlier rows only). */
  leadingWitness?: string;
  /** Witness name for the complete folded value after all active steps. */
  completeWitness?: string;
}

/**
 * Compiler-published per-effect fold activations (path-effect activation schedule beyond child-deploy-only typed effect IR).
 * Effect ordinals match handler `mutationEffectOrdinals` / fixed-chunkable resources.
 * `activation` may be a structured recipe or a structural ECE (converted at instantiate).
 */
export interface PublishedFoldActivationSchedule {
  version: 1;
  effects: readonly {
    effectOrdinal: number;
    activation?: string | FoldActivationRecipe | FoldActivationExpression;
  }[];
}

/**
 * Compact artifact `messageBus.resourceFoldPlans[]` entry (compiler publish shape).
 * Steps themselves are runtime-selected; kind/initial/witnesses come from this summary.
 * Optional `activationSchedule` is fold authority for step activations when shells omit them.
 */
export interface PublishedResourceFoldPlanSummary {
  collection: string;
  collectionSignature?: string;
  initialSource: 'empty' | 'prior-commitment' | 'leading-witness';
  leadingWitness?: string;
  completeWitness?: string;
  stepKind: ResourceFoldStepKind;
  /** path-effect activation: published per-effect activations; instantiate fills missing step activations. */
  activationSchedule?: PublishedFoldActivationSchedule;
}

export interface ResourceFoldEnvironment {
  /**
   * Evaluate whether a step's activation is true for this compose.
   * When omitted, `activationEnv` + `evaluateFoldActivation` are used (path-effect activation structured recipes).
   */
  isActive?: (step: ResourceFoldStep) => boolean;
  /** Bool-param / handler-input environment for structured fold activations. */
  activationEnv?: FoldActivationEnvironment;
  /** Evaluate one step's element bytes in the row environment. */
  resolveElement: (step: ResourceFoldStep) => Uint8Array | undefined;
  /** Append element onto an encoded array value (same wire rule as SDK array push). */
  appendElement: (encoded: Uint8Array, element: Uint8Array) => Uint8Array;
  /**
   * Apply an `update` step. Required when any active step has `kind: 'update'`;
   * absent applicator fails closed rather than silently appending.
   */
  updateElement?: (
    encoded: Uint8Array,
    element: Uint8Array,
    step: ResourceFoldStep,
  ) => Uint8Array;
  /** Empty encoded value for the collection's value type. */
  emptyValue: () => Uint8Array;
  /** Optional prior commitment decoded to the starting encoded value. */
  priorValue?: () => Uint8Array | undefined;
}

export interface ResourceFoldResult {
  /** Encoded value after all but the last active step (undefined if fewer than 2 active steps). */
  leading?: Uint8Array;
  /** Encoded value after every active step. */
  complete: Uint8Array;
  activeSteps: readonly ResourceFoldStep[];
}

/** Look up a published fold summary by collection name or signature. */
export function findPublishedResourceFoldPlan(
  plans: readonly PublishedResourceFoldPlanSummary[] | undefined,
  collection: string,
): PublishedResourceFoldPlanSummary | undefined {
  if (plans === undefined) return undefined;
  return plans.find((plan) => (
    plan.collection === collection || plan.collectionSignature === collection
  ));
}

/**
 * Resolve a published schedule activation into a fold recipe.
 * Strings / recipes pass through normalize; structural ECE is converted.
 */
export function resolvePublishedFoldActivation(
  activation: string | FoldActivationRecipe | FoldActivationExpression | undefined,
): FoldActivationRecipe | undefined {
  if (activation === undefined) return undefined;
  if (typeof activation === 'string') return normalizeFoldActivation(activation);
  if ('kind' in activation && (
    activation.kind === 'always'
    || activation.kind === 'boolParam'
    || activation.kind === 'handlerInput'
    || activation.kind === 'not'
    || activation.kind === 'and'
    || activation.kind === 'or'
  )) {
    return activation as FoldActivationRecipe;
  }
  return foldActivationFromExternalCallExpression(activation as FoldActivationExpression);
}

/**
 * Instantiate a runtime `ResourceFoldPlan` from a published summary + ordered step shells.
 * Every step inherits the published `stepKind` (compiler authority).
 * When a shell omits `activation`, the published `activationSchedule` entry for its
 * `effectOrdinal` (else first schedule entry) fills it.
 * Optional `pathEffectSchedule` (handler multi-effect program) is secondary authority by ordinal.
 */
export function instantiateResourceFoldPlan(
  published: PublishedResourceFoldPlanSummary,
  steps: readonly Omit<ResourceFoldStep, 'kind'>[],
  pathEffectSchedule?: {
    version: 1;
    effects: readonly {
      ordinal: number;
      kind: string;
      activation?: string | FoldActivationRecipe | FoldActivationExpression;
    }[];
  },
): ResourceFoldPlan {
  const schedule = published.activationSchedule?.version === 1
    ? published.activationSchedule.effects
    : undefined;
  const pathEffects = pathEffectSchedule?.version === 1
    ? pathEffectSchedule.effects.filter((effect) => effect.kind === 'stateWrite')
    : undefined;
  return {
    collection: published.collection,
    collectionHash: published.collectionSignature,
    initialSource: published.initialSource,
    leadingWitness: published.leadingWitness,
    completeWitness: published.completeWitness,
    steps: steps.map((step) => {
      let activation = resolvePublishedFoldActivation(
        step.activation as string | FoldActivationRecipe | FoldActivationExpression | undefined,
      );
      if (activation === undefined && schedule !== undefined && schedule.length > 0) {
        const byOrdinal = step.effectOrdinal !== undefined
          ? schedule.find((effect) => effect.effectOrdinal === step.effectOrdinal)
          : undefined;
        activation = resolvePublishedFoldActivation(
          byOrdinal?.activation ?? schedule[0]?.activation,
        );
      }
      if (activation === undefined && pathEffects !== undefined && pathEffects.length > 0) {
        const byOrdinal = step.effectOrdinal !== undefined
          ? pathEffects.find((effect) => effect.ordinal === step.effectOrdinal)
          : undefined;
        activation = resolvePublishedFoldActivation(
          byOrdinal?.activation ?? pathEffects[0]?.activation,
        );
      }
      return {
        ...step,
        kind: published.stepKind,
        ...(activation !== undefined && { activation }),
      };
    }),
  };
}

/**
 * Apply one fold transition honestly:
 * - push → append
 * - assign → replace
 * - update → env.updateElement (fail closed if missing)
 */
export function applyResourceFoldStep(
  encoded: Uint8Array,
  step: ResourceFoldStep,
  element: Uint8Array,
  env: Pick<ResourceFoldEnvironment, 'appendElement' | 'updateElement'>,
): Uint8Array {
  if (step.kind === 'push') {
    return env.appendElement(encoded, element);
  }
  if (step.kind === 'assign') {
    return element;
  }
  if (step.kind === 'update') {
    if (env.updateElement === undefined) {
      throw new Error(
        'resource-fold: update step requires updateElement applicator '
          + `(selector=${step.rowSelector ?? '?'})`,
      );
    }
    return env.updateElement(encoded, element, step);
  }
  throw new Error(
    `resource-fold: unsupported step kind '${String((step as ResourceFoldStep).kind)}'`,
  );
}

/**
 * Fold active steps into leading + complete values.
 * Fail-closed when any active step cannot resolve its element or uses an unsupported transition.
 */
export function foldChunkableResource(
  plan: ResourceFoldPlan,
  env: ResourceFoldEnvironment,
): ResourceFoldResult {
  const activeSteps = plan.steps.filter((step) => {
    if (env.isActive !== undefined) return env.isActive(step) !== false;
    return evaluateFoldActivation(step.activation, env.activationEnv);
  });
  if (activeSteps.length === 0) {
    const prior = plan.initialSource === 'prior-commitment' || plan.initialSource === 'leading-witness'
      ? env.priorValue?.()
      : undefined;
    return { complete: prior ?? env.emptyValue(), activeSteps };
  }

  let encoded: Uint8Array;
  if (plan.initialSource === 'empty') {
    encoded = env.emptyValue();
  } else {
    // prior-commitment / leading-witness both start from an explicit prior when provided.
    encoded = env.priorValue?.() ?? env.emptyValue();
  }

  let leading: Uint8Array | undefined;
  for (let index = 0; index < activeSteps.length; index += 1) {
    const step = activeSteps[index]!;
    // Leading is the value before the final active step (earlier rows only).
    if (index === activeSteps.length - 1 && activeSteps.length >= 2) {
      leading = encoded;
    }
    const element = env.resolveElement(step);
    if (element === undefined) {
      throw new Error(
        `resource-fold: cannot evaluate element for collection '${plan.collection}' `
          + `step ${index} (selector=${step.rowSelector ?? '?'}, kind=${step.kind})`,
      );
    }
    encoded = applyResourceFoldStep(encoded, step, element, env);
  }
  return { leading, complete: encoded, activeSteps };
}
