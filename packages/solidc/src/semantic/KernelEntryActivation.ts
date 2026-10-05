import {
  AssignNode, BinaryOpNode, DeleteLocalNode, FunctionDefinitionNode, IdentifierNode, IntLiteralNode, UnaryOpNode,
  Node, TupleAssignmentNode, VariableDefinitionNode, type ExpressionNode, type ExternalCallExpression,
} from '../ast/AST.js';
import { PrimitiveType } from '@solidcash/utils';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';

const COMPARISON_OPERATORS = new Set<BinaryOperator>([
  BinaryOperator.EQ, BinaryOperator.NE, BinaryOperator.LT, BinaryOperator.LE,
  BinaryOperator.GT, BinaryOperator.GE,
]);

/** A name is replayable only if it denotes one immutable local copy of an immutable row argument. */
export function stableKernelArgumentIndices(fn: FunctionDefinitionNode): ReadonlyMap<string, number> {
  const declarations = new Map<string, VariableDefinitionNode[]>();
  const topLevelDeclarations = new Set((fn.body?.statements ?? [])
    .filter((statement): statement is VariableDefinitionNode => statement instanceof VariableDefinitionNode));
  const mutated = new Set<string>();
  const seen = new Set<Node>();
  const walk = (node: Node): void => {
    if (seen.has(node)) return;
    seen.add(node);
    if (node instanceof VariableDefinitionNode) {
      const group = declarations.get(node.name) ?? [];
      group.push(node);
      declarations.set(node.name, group);
    }
    if (node instanceof AssignNode || node instanceof DeleteLocalNode) mutated.add(node.identifier.name);
    if (node instanceof TupleAssignmentNode) {
      for (const element of node.elements) if (element.existing && element.name) mutated.add(element.name);
    }
    for (const [field, value] of Object.entries(node)) {
      if (['location', 'resolvedFunction', 'functionReference', 'definition', 'collection', 'symbolTable',
        'stateVariable', 'type'].includes(field)) continue;
      if (value instanceof Node) walk(value);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
    }
  };
  if (fn.body) walk(fn.body);
  const parameterIndices = new Map(fn.parameters.map((parameter, index) => [parameter.name, index] as const)
    .filter(([name]) => !name.startsWith('__internal__')));
  const resolved = new Map<string, number>();
  const resolve = (name: string, visiting = new Set<string>()): number | undefined => {
    if (mutated.has(name) || visiting.has(name)) return undefined;
    const parameter = parameterIndices.get(name);
    if (parameter !== undefined) return declarations.has(name) ? undefined : parameter;
    const definitions = declarations.get(name);
    if (definitions?.length !== 1 || !topLevelDeclarations.has(definitions[0]!)
      || !(definitions[0]?.expression instanceof IdentifierNode)) return undefined;
    const nested = new Set(visiting);
    nested.add(name);
    return resolve(definitions[0].expression.name, nested);
  };
  for (const name of [...parameterIndices.keys(), ...declarations.keys()]) {
    const index = resolve(name);
    if (index !== undefined) resolved.set(name, index);
  }
  return resolved;
}

export function kernelBooleanArgumentIndices(fn: FunctionDefinitionNode): ReadonlySet<number> {
  return new Set(fn.parameters.flatMap((parameter, index) => parameter.type === PrimitiveType.BOOL ? [index] : []));
}

export function kernelArgumentConditionActivation(
  expression: ExpressionNode, argumentIndices: ReadonlyMap<string, number>,
  booleanArgumentIndices: ReadonlySet<number>,
): ExternalCallExpression | undefined {
  if (expression instanceof IdentifierNode) {
    const index = argumentIndices.get(expression.name);
    return index !== undefined && booleanArgumentIndices.has(index)
      ? { kind: 'source', source: { kind: 'forward', paramIndex: index } } : undefined;
  }
  if (expression instanceof UnaryOpNode && expression.operator === UnaryOperator.NOT) {
    const inner = kernelArgumentConditionActivation(expression.expression, argumentIndices, booleanArgumentIndices);
    return inner === undefined ? undefined : { kind: 'unary', operator: '!', expression: inner };
  }
  if (expression instanceof BinaryOpNode
    && (expression.operator === BinaryOperator.AND || expression.operator === BinaryOperator.OR)) {
    const left = kernelArgumentConditionActivation(expression.left, argumentIndices, booleanArgumentIndices);
    const right = kernelArgumentConditionActivation(expression.right, argumentIndices, booleanArgumentIndices);
    return left === undefined || right === undefined ? undefined
      : { kind: 'binary', operator: expression.operator, left, right };
  }
  if (!(expression instanceof BinaryOpNode) || !COMPARISON_OPERATORS.has(expression.operator)) return undefined;
  const operand = (node: ExpressionNode): ExternalCallExpression | undefined => {
    if (node instanceof IdentifierNode) {
      const index = argumentIndices.get(node.name);
      return index === undefined ? undefined
        : { kind: 'source', source: { kind: 'forward', paramIndex: index } };
    }
    return node instanceof IntLiteralNode
      ? { kind: 'literal', type: 'bigint', value: node.value.toString() } : undefined;
  };
  const left = operand(expression.left);
  const right = operand(expression.right);
  if (!left || !right || left.kind === right.kind) return undefined;
  return { kind: 'binary', operator: expression.operator, left, right };
}
