import {
  AssignNode, BinaryOpNode, IdentifierNode, IntLiteralNode, Node, VariableDefinitionNode, WhileNode,
} from '../ast/AST.js';
import { BinaryOperator } from '../ast/Operator.js';

/** Exact trip count of the canonical desugared literal `for` loop, or undefined for every other shape. */
export const fixedForMaximum = (
  initializer: Node | undefined, loop: WhileNode,
): number | undefined => {
  if (!(initializer instanceof VariableDefinitionNode) || !initializer.isLoopVariable
    || !(initializer.expression instanceof IntLiteralNode)
    || !(loop.condition instanceof BinaryOpNode)
    || !(loop.condition.left instanceof IdentifierNode)
    || loop.condition.left.name !== initializer.name
    || !(loop.condition.right instanceof IntLiteralNode)
    || ![BinaryOperator.LT, BinaryOperator.LE].includes(loop.condition.operator)
    || loop.forLoopUpdateCount !== 1) return undefined;
  const update = loop.block.statements?.[loop.block.statements.length - 1];
  if (!(update instanceof AssignNode) || update.identifier.name !== initializer.name
    || !(update.expression instanceof BinaryOpNode)
    || update.expression.operator !== BinaryOperator.PLUS
    || !(update.expression.left instanceof IdentifierNode)
    || update.expression.left.name !== initializer.name
    || !(update.expression.right instanceof IntLiteralNode)
    || update.expression.right.value !== 1n) return undefined;
  const count = loop.condition.right.value - initializer.expression.value
    + (loop.condition.operator === BinaryOperator.LE ? 1n : 0n);
  if (count < 0n || count > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
  return Number(count);
};
