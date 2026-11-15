import { ArrayType } from '@solidcash/utils';
import {
  ArrayAccessNode,
  AssignNode,
  BinaryOpNode,
  BoolLiteralNode,
  CastNode,
  ExpressionNode,
  FieldAccessNode,
  HexLiteralNode,
  IdentifierNode,
  IntLiteralNode,
  Node,
  NullaryOpNode,
  StateAccessNode,
  StringLiteralNode,
  TupleIndexOpNode,
  UnaryOpNode,
  VariableDefinitionNode,
} from '../ast/AST.js';

const LENGTH_MINUS_ONE = /^binop:-\((?:unop:\.length|field:length)\(state:[A-Za-z_][\w]*\),lit:1\)$/;

/**
 * Whether two key expressions of one statement are the same expression: equal node by node, over the forms that read
 * no state and have no effect (names, literals, element and field reads, operators, casts, msg.sender). Two such keys
 * evaluate to one value. Any other form, a call among them, compares unequal, so a caller never treats two evaluations
 * that could differ as one key. `resolve` may first replace a node by the expression a binding gives it.
 */
export function sameKeyExpression(
  leftNode: ExpressionNode, rightNode: ExpressionNode,
  resolve: (node: ExpressionNode) => ExpressionNode = (node) => node, depth = 0,
): boolean {
  if (depth > 32) return false;
  const left = resolve(leftNode);
  const right = resolve(rightNode);
  const same = (a: ExpressionNode, b: ExpressionNode): boolean => sameKeyExpression(a, b, resolve, depth + 1);
  if (left.constructor !== right.constructor) return false;
  if (left instanceof IdentifierNode) return left.name === (right as IdentifierNode).name;
  if (left instanceof StateAccessNode) return left.name === (right as StateAccessNode).name;
  if (left instanceof IntLiteralNode || left instanceof BoolLiteralNode || left instanceof StringLiteralNode) {
    return left.value === (right as IntLiteralNode | BoolLiteralNode | StringLiteralNode).value;
  }
  if (left instanceof HexLiteralNode) {
    const other = (right as HexLiteralNode).value;
    return left.value.length === other.length && left.value.every((byte, index) => byte === other[index]);
  }
  if (left instanceof NullaryOpNode) return left.operator === (right as NullaryOpNode).operator;
  if (left instanceof ArrayAccessNode) {
    const other = right as ArrayAccessNode;
    return same(left.array, other.array) && same(left.index, other.index);
  }
  if (left instanceof FieldAccessNode) {
    const other = right as FieldAccessNode;
    return left.name === other.name && same(left.expression, other.expression);
  }
  if (left instanceof TupleIndexOpNode) {
    const other = right as TupleIndexOpNode;
    return left.index === other.index && same(left.tuple, other.tuple);
  }
  if (left instanceof UnaryOpNode) {
    const other = right as UnaryOpNode;
    return left.operator === other.operator && same(left.expression, other.expression);
  }
  if (left instanceof BinaryOpNode) {
    const other = right as BinaryOpNode;
    return left.operator === other.operator && same(left.left, other.left) && same(left.right, other.right);
  }
  if (left instanceof CastNode) {
    const other = right as CastNode;
    return left.isUnsafe === other.isUnsafe && left.type.toString() === other.type.toString()
      && same(left.expression, other.expression);
  }
  return false;
}

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
  const found = new Set<string>();
  const consider = (expression: ExpressionNode | undefined): void => {
    if (!expression) return;
    const canonical = canonicalizeUpsertKeyExpression(expression, stateVarNames);
    if (canonical && LENGTH_MINUS_ONE.test(canonical)) found.add(canonical);
  };
  const walk = (current: Node): void => {
    if (seen.has(current)) return;
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
  return found.size === 1 ? [...found][0] : undefined;
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
