import { AddressType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import {
  AssemblyStatementNode,
  AssignNode,
  AssignmentExpressionNode,
  BinaryOpNode,
  BlockNode,
  BoolLiteralNode,
  BranchNode,
  CastNode,
  DeleteLocalNode,
  ExpressionNode,
  FunctionDefinitionNode,
  IdentifierNode,
  IntLiteralNode,
  Node,
  StatementNode,
  TupleAssignmentNode,
  UnaryOpNode,
  UncheckedNode,
  VariableDefinitionNode,
} from '../ast/AST.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';

/**
 * Drops the arm a branch never runs when its condition is constant: a boolean literal, or a local declared once with
 * one and never assigned, which is what an inline site leaves for a helper's parameter (`_refund(jobId, false)`); an
 * equality of two equal literals (an integer, a boolean, the zero address) where an inliner's parameter binding
 * carries one (`_update(address(0), to, v)` decides `from == address(0)`); or a zero-address comparison of an
 * immutable address that an enclosing zero-address guard has already decided. A write in a dead arm would still
 * reach the entry's write analysis. A branch that keeps an arm keeps its node, so later passes see the shape they
 * expect, and a compiler-owned flush whose absent arm must stay physically inactive is left alone.
 */
export default class FoldConstantBoolBranches extends AstTraversal {
  /** `literals` adds the literal-equality and zero-address rules; without it only boolean constants fold. */
  constructor(private readonly literals = false) {
    super();
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    if (node.body) foldBlock(node.body, functionFacts(node, this.literals));
    return node;
  }
}

/** What a body's constant analysis knows at one point. */
interface Facts {
  /** The literal-equality and zero-address rules apply. */
  readonly literals: boolean;
  /** Constant constructions of locals: once-declared literal booleans, and literal inliner bindings. */
  readonly constants: ReadonlyMap<string, string>;
  /** Locals and parameters that never change, each mapped to the immutable binding it copies (or itself). */
  readonly immutable: ReadonlyMap<string, string>;
  /** Immutable addresses an enclosing guard has proved nonzero. */
  readonly nonZero: ReadonlySet<string>;
}

/** Visits every node under `root`, children before siblings. */
function walk(root: Node, visit: (node: Node) => void): void {
  visit(root);
  for (const key of Object.keys(root)) {
    if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
    const child = (root as unknown as Record<string, unknown>)[key];
    if (child instanceof Node) walk(child, visit);
    else if (Array.isArray(child)) for (const item of child) if (item instanceof Node) walk(item, visit);
  }
}

/** The parameter bindings a helper inliner makes at an inline site; each is declared once and owned by the pass. */
const isInlinedBinding = (name: string): boolean => /^__(?:sp|rh)\d+_/.test(name);

const INCREMENTS = new Set<UnaryOperator>([
  UnaryOperator.POSTFIX_INCREMENT, UnaryOperator.POSTFIX_DECREMENT,
  UnaryOperator.PREFIX_INCREMENT, UnaryOperator.PREFIX_DECREMENT,
]);

function functionFacts(node: FunctionDefinitionNode, literals: boolean): Facts {
  const declared = new Map<string, number>();
  const definitions = new Map<string, ExpressionNode | undefined>();
  const assigned = new Set<string>();
  let hasAssembly = false;
  walk(node.body!, (child) => {
    if (child instanceof VariableDefinitionNode) {
      declared.set(child.name, (declared.get(child.name) ?? 0) + 1);
      definitions.set(child.name, child.expression);
    } else if (child instanceof AssignNode) {
      assigned.add(child.identifier.name);
    } else if (child instanceof AssignmentExpressionNode) {
      assigned.add(child.assign.identifier.name);
    } else if (child instanceof TupleAssignmentNode) {
      for (const element of child.elements) if (element.name) assigned.add(element.name);
    } else if (child instanceof DeleteLocalNode) {
      assigned.add(child.identifier.name);
    } else if (child instanceof UnaryOpNode && INCREMENTS.has(child.operator)
      && child.expression instanceof IdentifierNode) {
      assigned.add(child.expression.name);
    } else if (child instanceof AssemblyStatementNode) {
      hasAssembly = true;
    }
  });
  const once = (name: string): boolean => declared.get(name) === 1 && !assigned.has(name);
  const constants = new Map<string, string>();
  for (const [name, expression] of definitions) {
    if (once(name) && expression instanceof BoolLiteralNode) constants.set(name, `bool:${expression.value}`);
  }
  const immutable = new Map<string, string>();
  // A Yul assignment can change a local without an AssignNode, so the literal and address facts stay off there.
  if (literals && !hasAssembly) {
    const bindings = [...definitions].filter(([name]) => isInlinedBinding(name) && once(name));
    for (let changed = true; changed;) {
      changed = false;
      for (const [name, expression] of bindings) {
        if (constants.has(name) || !expression) continue;
        const value = constantKey(expression, constants);
        if (value !== undefined) {
          constants.set(name, value);
          changed = true;
        }
      }
    }
    for (const parameter of node.parameters) {
      if (!declared.has(parameter.name) && !assigned.has(parameter.name)) immutable.set(parameter.name, parameter.name);
    }
    for (const name of definitions.keys()) if (once(name)) immutable.set(name, name);
    for (const [name, expression] of definitions) {
      if (immutable.has(name) && expression instanceof IdentifierNode && immutable.has(expression.name)) {
        immutable.set(name, expression.name);
      }
    }
  }
  return { literals, constants, immutable, nonZero: new Set() };
}

/** A literal construction's identity: only exact, total constructions qualify (`address(0)`, not other casts). */
function constantKey(expression: ExpressionNode, constants: ReadonlyMap<string, string>): string | undefined {
  if (expression instanceof IntLiteralNode) return `int:${expression.value}`;
  if (expression instanceof BoolLiteralNode) return `bool:${expression.value}`;
  if (expression instanceof IdentifierNode) return constants.get(expression.name);
  if (expression instanceof UnaryOpNode && expression.operator === UnaryOperator.NEGATE) {
    const inner = constantKey(expression.expression, constants);
    return inner?.startsWith('int:') ? `int:${-BigInt(inner.slice(4))}` : undefined;
  }
  if (expression instanceof CastNode && !expression.isUnsafe && expression.type instanceof AddressType
    && expression.expression instanceof IntLiteralNode && expression.expression.value === 0n) {
    return `address-zero:${expression.type.toString()}`;
  }
  return undefined;
}

/** The immutable binding an identifier finally copies. */
function canonical(name: string, facts: Facts): string | undefined {
  const seen = new Set<string>();
  let current = facts.immutable.get(name);
  while (current !== undefined && facts.immutable.get(current) !== current && !seen.has(current)) {
    seen.add(current);
    current = facts.immutable.get(current);
  }
  return current;
}

/** `x == address(0)` or `x != address(0)` on an immutable address `x`. */
function zeroComparison(condition: ExpressionNode, facts: Facts): { key: string; equalsZero: boolean } | undefined {
  if (!facts.literals || !(condition instanceof BinaryOpNode)
    || (condition.operator !== BinaryOperator.EQ && condition.operator !== BinaryOperator.NE)) return undefined;
  const isZero = (side: ExpressionNode): boolean => constantKey(side, facts.constants)?.startsWith('address-zero:')
    === true;
  const operand = isZero(condition.right) ? condition.left : isZero(condition.left) ? condition.right : undefined;
  const key = operand instanceof IdentifierNode ? canonical(operand.name, facts) : undefined;
  return key === undefined ? undefined : { key, equalsZero: condition.operator === BinaryOperator.EQ };
}

const carriesBinding = (expression: ExpressionNode, facts: Facts): boolean => (
  expression instanceof IdentifierNode ? isInlinedBinding(expression.name) && facts.constants.has(expression.name)
    : expression instanceof CastNode || expression instanceof UnaryOpNode
      ? carriesBinding(expression.expression, facts)
      : expression instanceof BinaryOpNode
        ? carriesBinding(expression.left, facts) || carriesBinding(expression.right, facts) : false);

/** The value a condition always has, when it is a constant. */
function constantValue(condition: ExpressionNode, facts: Facts): boolean | undefined {
  const zero = zeroComparison(condition, facts);
  if (zero && facts.nonZero.has(zero.key)) return !zero.equalsZero;
  if (condition instanceof BoolLiteralNode) return condition.value;
  if (condition instanceof IdentifierNode) {
    const value = facts.constants.get(condition.name);
    return value === 'bool:true' ? true : value === 'bool:false' ? false : undefined;
  }
  if (condition instanceof UnaryOpNode && condition.operator === UnaryOperator.NOT) {
    const inner = constantValue(condition.expression, facts);
    return inner === undefined ? undefined : !inner;
  }
  // Equal literal constructions are equal; distinct ones are not assumed unequal (a cast can fold two literals).
  if (facts.literals && condition instanceof BinaryOpNode && carriesBinding(condition, facts)
    && (condition.operator === BinaryOperator.EQ || condition.operator === BinaryOperator.NE)) {
    const left = constantKey(condition.left, facts.constants);
    const right = constantKey(condition.right, facts.constants);
    if (left === undefined || left !== right) return undefined;
    return condition.operator === BinaryOperator.EQ;
  }
  return undefined;
}

/** `facts` with `key` proved nonzero. */
const withNonZero = (facts: Facts, key: string): Facts => ({ ...facts, nonZero: new Set([...facts.nonZero, key]) });

function foldBlock(block: BlockNode, facts: Facts): void {
  const kept: StatementNode[] = [];
  for (const statement of block.statements ?? []) {
    if (statement instanceof BranchNode) {
      const taken = statement.preserveConditionalEntryWrites === true
        ? undefined : constantValue(statement.condition, facts);
      if (taken === false && statement.elseBlock === undefined) continue;
      const zero = taken === undefined ? zeroComparison(statement.condition, facts) : undefined;
      if (taken === false) {
        const negated = new UnaryOpNode(UnaryOperator.NOT, statement.condition);
        negated.location = statement.condition.location;
        statement.condition = negated;
        statement.ifBlock = statement.elseBlock!;
        statement.elseBlock = undefined;
      } else if (taken === true) {
        statement.elseBlock = undefined;
      }
      // A zero-address guard proves its address nonzero in the arm where the comparison says so.
      foldBlock(statement.ifBlock, zero && !zero.equalsZero ? withNonZero(facts, zero.key) : facts);
      if (statement.elseBlock) {
        foldBlock(statement.elseBlock, zero?.equalsZero ? withNonZero(facts, zero.key) : facts);
      }
    } else if (statement instanceof BlockNode) {
      foldBlock(statement, facts);
    } else if (statement instanceof UncheckedNode) {
      foldBlock(statement.block, facts);
    }
    kept.push(statement);
  }
  block.statements = kept;
}
