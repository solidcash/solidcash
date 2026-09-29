import AstTraversal from '../ast/AstTraversal.js';
import {
  AssignNode,
  AssignmentExpressionNode,
  BlockNode,
  BoolLiteralNode,
  BranchNode,
  ExpressionNode,
  FunctionDefinitionNode,
  IdentifierNode,
  Node,
  StatementNode,
  TupleAssignmentNode,
  UnaryOpNode,
  UncheckedNode,
  VariableDefinitionNode,
} from '../ast/AST.js';
import { UnaryOperator } from '../ast/Operator.js';

/**
 * Drops the arm a branch never runs when its condition is a boolean constant: a literal, or a local declared once
 * with a literal and never assigned, which is what an inline site leaves for a helper's parameter
 * (`_refund(jobId, false)`). A write in a dead arm would still reach the entry's write analysis. A branch that keeps
 * an arm keeps its node, so later passes see the shape they expect, and a compiler-owned flush whose absent arm must
 * stay physically inactive is left alone.
 */
export default class FoldConstantBoolBranches extends AstTraversal {
  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    if (node.body) foldBlock(node.body, constantLocals(node.body));
    return node;
  }
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

/** The locals a body declares exactly once, with a boolean literal, and never assigns. */
function constantLocals(body: BlockNode): Map<string, boolean> {
  const declared = new Map<string, number>();
  const literal = new Map<string, boolean>();
  const assigned = new Set<string>();
  walk(body, (node) => {
    if (node instanceof VariableDefinitionNode) {
      declared.set(node.name, (declared.get(node.name) ?? 0) + 1);
      if (node.expression instanceof BoolLiteralNode) literal.set(node.name, node.expression.value);
    } else if (node instanceof AssignNode) {
      assigned.add(node.identifier.name);
    } else if (node instanceof AssignmentExpressionNode) {
      assigned.add(node.assign.identifier.name);
    } else if (node instanceof TupleAssignmentNode) {
      for (const element of node.elements) if (element.name) assigned.add(element.name);
    }
  });
  for (const name of [...literal.keys()]) {
    if (declared.get(name) !== 1 || assigned.has(name)) literal.delete(name);
  }
  return literal;
}

/** The value a condition always has, when it is a constant. */
function constantValue(condition: ExpressionNode, locals: ReadonlyMap<string, boolean>): boolean | undefined {
  if (condition instanceof BoolLiteralNode) return condition.value;
  if (condition instanceof IdentifierNode) return locals.get(condition.name);
  if (condition instanceof UnaryOpNode && condition.operator === UnaryOperator.NOT) {
    const inner = constantValue(condition.expression, locals);
    return inner === undefined ? undefined : !inner;
  }
  return undefined;
}

function foldBlock(block: BlockNode, locals: ReadonlyMap<string, boolean>): void {
  const kept: StatementNode[] = [];
  for (const statement of block.statements ?? []) {
    if (statement instanceof BranchNode) {
      const taken = statement.preserveConditionalEntryWrites === true
        ? undefined : constantValue(statement.condition, locals);
      if (taken === false && statement.elseBlock === undefined) continue;
      if (taken === false) {
        const negated = new UnaryOpNode(UnaryOperator.NOT, statement.condition);
        negated.location = statement.condition.location;
        statement.condition = negated;
        statement.ifBlock = statement.elseBlock!;
        statement.elseBlock = undefined;
      } else if (taken === true) {
        statement.elseBlock = undefined;
      }
      foldBlock(statement.ifBlock, locals);
      if (statement.elseBlock) foldBlock(statement.elseBlock, locals);
    } else if (statement instanceof BlockNode) {
      foldBlock(statement, locals);
    } else if (statement instanceof UncheckedNode) {
      foldBlock(statement.block, locals);
    }
    kept.push(statement);
  }
  block.statements = kept;
}
