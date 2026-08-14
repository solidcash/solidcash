import { ArrayType } from '@solidcash/utils';
import {
  ArrayAccessNode,
  AssignNode,
  BinaryOpNode,
  BoolLiteralNode,
  CastNode,
  ExpressionNode,
  FieldAccessNode,
  FunctionDefinitionNode,
  IdentifierNode,
  IntLiteralNode,
  KeySourceInfo,
  Node,
  StateAccessNode,
  UnaryOpNode,
  VariableDefinitionNode,
} from '../ast/AST.js';

const LENGTH_MINUS_ONE = /^binop:-\((?:unop:\.length|field:length)\(state:[A-Za-z_][\w]*\),lit:1\)$/;

/** Canonicalize a mapping-key expression for SDK `evalComputedKey`. */
export function canonicalizeUpsertKeyExpression(
  node: ExpressionNode,
  stateVarNames: ReadonlySet<string>,
  resolveLocal?: (name: string) => ExpressionNode | undefined,
  seen = new Set<string>(),
): string | undefined {
  if (node instanceof IdentifierNode) {
    if (stateVarNames.has(node.name)) return `state:${node.name}`;
    if (seen.has(node.name)) return `id:${node.name}`;
    const init = resolveLocal?.(node.name);
    if (init) {
      seen.add(node.name);
      return canonicalizeUpsertKeyExpression(init, stateVarNames, resolveLocal, seen) ?? `id:${node.name}`;
    }
    return `id:${node.name}`;
  }
  if (node instanceof StateAccessNode) return `state:${node.name}`;
  if (node instanceof FieldAccessNode && node.name === 'length') {
    const inner = canonicalizeUpsertKeyExpression(node.expression, stateVarNames, resolveLocal, seen);
    return inner ? `unop:.length(${inner})` : undefined;
  }
  if (node instanceof IntLiteralNode) return `lit:${node.value.toString()}`;
  if (node instanceof BoolLiteralNode) return `lit:${node.value}`;
  if (node instanceof UnaryOpNode) {
    const inner = canonicalizeUpsertKeyExpression(node.expression, stateVarNames, resolveLocal, seen);
    return inner ? `unop:${node.operator}(${inner})` : undefined;
  }
  if (node instanceof BinaryOpNode) {
    const left = canonicalizeUpsertKeyExpression(node.left, stateVarNames, resolveLocal, seen);
    const right = canonicalizeUpsertKeyExpression(node.right, stateVarNames, resolveLocal, seen);
    return left && right ? `binop:${node.operator}(${left},${right})` : undefined;
  }
  if (node instanceof CastNode) {
    const inner = canonicalizeUpsertKeyExpression(node.expression, stateVarNames, resolveLocal, seen);
    return inner ? `cast:${node.type.toString()}(${inner})` : undefined;
  }
  if (node instanceof ArrayAccessNode) {
    const array = canonicalizeUpsertKeyExpression(node.array, stateVarNames, resolveLocal, seen);
    const index = canonicalizeUpsertKeyExpression(node.index, stateVarNames, resolveLocal, seen);
    return array && index ? `arridx(${array},${index})` : undefined;
  }
  return undefined;
}

/** `id = arr.length - 1` (decl initializer or later assignment) as an evalComputedKey label. */
export function findLengthMinusOneKeyCanonical(
  node: Node | undefined,
  stateVarNames: ReadonlySet<string>,
): string | undefined {
  if (!node) return undefined;
  const seen = new WeakSet<object>();
  let found: string | undefined;
  const consider = (expression: ExpressionNode | undefined): void => {
    if (!expression || found) return;
    const canonical = canonicalizeUpsertKeyExpression(expression, stateVarNames);
    if (canonical && LENGTH_MINUS_ONE.test(canonical)) found = canonical;
  };
  const walk = (current: Node): void => {
    if (found || seen.has(current)) return;
    seen.add(current);
    if (current instanceof VariableDefinitionNode) consider(current.expression);
    if (current instanceof AssignNode) consider(current.expression);
    for (const key of Object.keys(current)) {
      if (['location', 'collection', 'symbol', 'type', 'symbolTable'].includes(key)) continue;
      const value = (current as unknown as Record<string, unknown>)[key];
      if (value instanceof Node) walk(value);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
    }
  };
  walk(node);
  return found;
}

function isUnresolvedFixedSource(source: KeySourceInfo, fn: FunctionDefinitionNode): boolean {
  const name = source.kind === 'param' ? source.paramName
    : source.canonical?.startsWith('id:') ? source.canonical.slice(3) : undefined;
  return !!name && !fn.parameters.some((parameter) => parameter.name === name);
}

/** `arr.length-1` when the function writes exactly one known dynamic state array. */
export function inferLengthMinusOneFromDynamicWrites(
  writes: readonly string[] | undefined,
  stateVarNames?: ReadonlySet<string>,
): string | undefined {
  const names = (writes ?? []).filter((name) => !stateVarNames || stateVarNames.has(name));
  if (names.length !== 1) return undefined;
  return `binop:-(unop:.length(state:${names[0]}),lit:1)`;
}

/**
 * Fill `sortedUpsertLoopInfo.fixedKeySources` when route/inline lowering dropped the outer
 * `jobs.length - 1` key. Runs at artifact emission so the ABI matches the body even if codegen
 * recorded the loop on a cloned helper.
 */
export function applyUpsertFixedKeyRecovery(
  fn: FunctionDefinitionNode,
  stateVarNames: ReadonlySet<string>,
): void {
  const infos = fn.sortedUpsertLoopInfo;
  if (!infos || infos.length === 0) return;
  const computed = findLengthMinusOneKeyCanonical(fn.body, stateVarNames)
    ?? inferLengthMinusOneFromDynamicWrites(fn.dynamicWrites, stateVarNames);
  if (!computed) return;
  for (const info of infos) {
    const sources = info.fixedKeySources ?? [];
    const missing = sources.length === 0 || sources.every((source) => isUnresolvedFixedSource(source, fn));
    if (!missing) continue;
    info.fixedKeySources = [{ kind: 'expression', canonical: computed }];
  }
}

type AbiUpsertFn = {
  dynamicWrites?: readonly string[];
  sortedUpsertLoopInfo?: readonly {
    fixedKeySources?: readonly { kind?: string; expressionLabel?: string; canonical?: string }[];
  }[];
};

/** Repair published ABI upsert metadata when the body walk could not see `jobs.length-1`. */
export function patchAbiUpsertFixedKeys(
  abi: readonly AbiUpsertFn[] | undefined,
  stateVarNames?: ReadonlySet<string>,
): void {
  if (!abi) return;
  for (const fn of abi) {
    const infos = fn.sortedUpsertLoopInfo;
    if (!infos?.length) continue;
    const label = inferLengthMinusOneFromDynamicWrites(fn.dynamicWrites, stateVarNames);
    if (!label) continue;
    for (const info of infos) {
      if (info.fixedKeySources?.length) continue;
      (info as { fixedKeySources: { kind: string; expressionLabel: string }[] }).fixedKeySources = [
        { kind: 'expression', expressionLabel: label },
      ];
    }
  }
}

export function patchArtifactUpsertFixedKeys(
  artifact: { abi?: readonly AbiUpsertFn[]; delegateArtifact?: { abi?: readonly AbiUpsertFn[] } },
  stateVarNames?: ReadonlySet<string>,
): void {
  patchAbiUpsertFixedKeys(artifact.abi, stateVarNames);
  if (artifact.delegateArtifact) patchAbiUpsertFixedKeys(artifact.delegateArtifact.abi, stateVarNames);
}

export function contractStateVarNames(collections: { name: string }[], variables: { name: string; type?: unknown }[]):
Set<string> {
  const names = new Set<string>(collections.map((collection) => collection.name));
  for (const variable of variables) {
    names.add(variable.name);
    if (variable.type instanceof ArrayType) names.add(variable.name);
  }
  return names;
}
