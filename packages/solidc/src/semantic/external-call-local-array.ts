import { ArrayType } from '@solidcash/utils';
import {
  ArrayAssignNode, ArrayDeleteNode, ArrayPopNode, ArrayPushNode, AssignNode, BlockNode,
  BranchNode, BreakNode, ContinueNode, DeleteLocalNode, ExpressionNode, ExternalCallExpression, ExternalCallStatement,
  IdentifierNode, Node, ReturnNode, StatementNode, UncheckedNode, VariableDefinitionNode, WhileNode,
} from '../ast/AST.js';
import { createDefaultValueExpression } from '../ast/defaults.js';

const backReferences = new Set([
  'location', 'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
  'referencedContract', 'stateVariable', 'collection', 'sourceCallNode',
]);

function walk(node: Node, visit: (node: Node) => void, seen = new Set<Node>()): void {
  if (seen.has(node)) return;
  seen.add(node);
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (backReferences.has(key)) continue;
    if (value instanceof Node) walk(value, visit, seen);
    else if (Array.isArray(value)) {
      for (const child of value) if (child instanceof Node) walk(child, visit, seen);
    }
  }
}

/** Struct field writes are lowered to whole-local rebuilds; array writes keep their local target. */
export function hasLocalAggregateMutation(target: IdentifierNode, prior: readonly StatementNode[]): boolean {
  let found = false;
  const inspect = (child: Node): void => {
    if ((child instanceof AssignNode && child.identifier.name === target.name)
      || (child instanceof ArrayAssignNode && child.name === target.name)) found = true;
  };
  for (const statement of prior) walk(statement, inspect);
  return found;
}

/** Snapshot a local memory aggregate at an external call, including writes through inlined helper aliases.
 * The dependency slice is a local program, not initializer substitution: scalar temporaries and indices
 * must be read at the write's program point, and aliases must share the same array within that frame.
 * An unsupported mutation fails closed instead of publishing the allocation's stale default contents.
 */
export function serializeLocalArraySnapshot(
  target: IdentifierNode,
  prior: readonly StatementNode[],
  serialize: (
    expression: ExpressionNode, locals: ReadonlySet<string>, before: readonly StatementNode[],
  ) => ExternalCallExpression | undefined,
): ExternalCallExpression | undefined {
  const declarations = new Map<string, VariableDefinitionNode>();
  const duplicates = new Set<string>();
  for (const statement of prior) walk(statement, (child) => {
    if (!(child instanceof VariableDefinitionNode)) return;
    if (declarations.has(child.name) && declarations.get(child.name) !== child) duplicates.add(child.name);
    declarations.set(child.name, child);
  });
  const needed = new Set([target.name]);
  const addReferences = (expression: Node): void => walk(expression, (child) => {
    if (child instanceof IdentifierNode && declarations.has(child.name)) needed.add(child.name);
  });
  const writeName = (statement: Node): string | undefined => {
    if (statement instanceof AssignNode || statement instanceof DeleteLocalNode) return statement.identifier.name;
    if (statement instanceof VariableDefinitionNode || statement instanceof ArrayAssignNode
      || statement instanceof ArrayDeleteNode || statement instanceof ArrayPushNode
      || statement instanceof ArrayPopNode) return statement.name;
    return undefined;
  };
  // Close over both reads and memory aliases. An alias can write the selected array even when the final
  // expression reads only the original binding. Scalar assignments, in contrast, are value copies.
  let previousSize = -1;
  while (previousSize !== needed.size) {
    previousSize = needed.size;
    for (const statement of prior) walk(statement, (child) => {
      const name = writeName(child);
      if (name && needed.has(name)) addReferences(child);
      const value = child instanceof VariableDefinitionNode || child instanceof AssignNode
        ? child.expression : undefined;
      if (name && declarations.get(name)?.type instanceof ArrayType
        && value instanceof IdentifierNode && declarations.has(value.name)
        && (needed.has(name) || needed.has(value.name))) {
        needed.add(name);
        needed.add(value.name);
      }
      if (child instanceof BranchNode || child instanceof WhileNode) {
        let affects = false;
        walk(child, (nested) => {
          const nestedName = writeName(nested);
          if (nestedName && needed.has(nestedName)) affects = true;
        });
        if (affects) addReferences(child.condition);
      }
    });
  }
  if (!declarations.has(target.name) || [...needed].some((name) => duplicates.has(name))) return undefined;

  const affects = (statement: Node): boolean => {
    let found = false;
    walk(statement, (child) => {
      const name = writeName(child);
      if (name && needed.has(name)) found = true;
    });
    return found;
  };
  const parameters: string[] = [];
  const args: ExternalCallExpression[] = [];
  // Producer results remain explicit call arguments, where graph dependency discovery and callsite
  // remapping authenticate them. The local program only transforms those already-produced values.
  // Never hoist a conditional producer into an unconditional dependency.
  const bindProducer = (value: ExternalCallExpression, conditional: boolean): ExternalCallExpression | undefined => {
    if (value.kind !== 'producerResult') return value;
    if (conditional) return undefined;
    let name = `__snapshot_result_${parameters.length}`;
    while (declarations.has(name)) name += '_';
    parameters.push(name);
    args.push(value);
    return { kind: 'identifier', name, ...(value.type && { type: value.type }) };
  };
  const block = (
    statements: readonly StatementNode[], ancestors: readonly StatementNode[], conditional = false,
  ): ExternalCallStatement[] | undefined => {
    const result: ExternalCallStatement[] = [];
    const before = [...ancestors];
    for (const statement of statements) {
      // Dropping an early exit would execute writes which the source never reaches.
      let earlyExit = false;
      walk(statement, (child) => {
        if (child instanceof BreakNode || child instanceof ContinueNode || child instanceof ReturnNode) earlyExit = true;
      });
      if (earlyExit) return undefined;
      if (affects(statement)) {
        const expression = (value: ExpressionNode): ExternalCallExpression | undefined => serialize(value, needed, before);
        if (statement instanceof VariableDefinitionNode) {
          const serialized = statement.expression && expression(statement.expression);
          const value = serialized && bindProducer(serialized, conditional);
          if (statement.expression && !value) return undefined;
          result.push({ kind: 'variable', name: statement.name, type: statement.type.toString(),
            ...(value && { expression: value }) });
        } else if (statement instanceof AssignNode) {
          const value = expression(statement.expression);
          if (!value) return undefined;
          result.push({ kind: 'assign', name: statement.identifier.name, expression: value });
        } else if (statement instanceof ArrayAssignNode || statement instanceof ArrayDeleteNode) {
          const index = expression(statement.index);
          const type = declarations.get(statement.name)?.type;
          const value = statement instanceof ArrayAssignNode ? expression(statement.value)
            : type instanceof ArrayType
              ? expression(createDefaultValueExpression(type.elementType, statement.location!)) : undefined;
          if (!index || !value) return undefined;
          result.push({ kind: 'arrayAssign', name: statement.name, index, expression: value });
        } else if (statement instanceof BranchNode) {
          const condition = expression(statement.condition);
          const ifBody = block(statement.ifBlock.statements ?? [], before, true);
          const elseBody = statement.elseBlock ? block(statement.elseBlock.statements ?? [], before, true) : [];
          if (!condition || !ifBody || !elseBody) return undefined;
          result.push({ kind: 'branch', condition, statements: ifBody, elseStatements: elseBody });
        } else if (statement instanceof WhileNode) {
          const condition = expression(statement.condition);
          const body = block(statement.block.statements ?? [], before, true);
          if (!condition || !body) return undefined;
          result.push({ kind: 'while', condition, statements: body });
        } else if (statement instanceof BlockNode || statement instanceof UncheckedNode) {
          const nested = statement instanceof BlockNode ? statement.statements : statement.block.statements;
          const body = block(nested ?? [], before, conditional);
          if (!body) return undefined;
          result.push({ kind: 'block', statements: body });
        } else return undefined;
      }
      before.push(statement);
    }
    return result;
  };
  const statements = block(prior, []);
  if (!statements) return undefined;
  const hasHiddenProducer = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    if (['producerResult', 'externalCall'].includes((value as { kind?: string }).kind ?? '')) return true;
    return Object.values(value).some(hasHiddenProducer);
  };
  if (hasHiddenProducer(statements)) return undefined;
  return { kind: 'call', type: declarations.get(target.name)!.type.toString(), parameters, args,
    statements: [...statements, { kind: 'return', expression: { kind: 'identifier', name: target.name } }] };
}
