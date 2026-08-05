import { IntType } from '@solidcash/utils';
import {
  AssignNode,
  AssignmentExpressionNode,
  BinaryOpNode,
  CastNode,
  FunctionDefinitionNode,
  FunctionModifier,
  IdentifierNode,
  IntLiteralNode,
  RequireNode,
  SourceFileNode,
} from '../ast/AST.js';
import { BinaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';

type NativeCheckedMath = NonNullable<FunctionDefinitionNode['nativeCheckedMath']>;

const identifier = (value: unknown, name: string): boolean =>
  value instanceof IdentifierNode && value.name === name;

const assignedBinary = (
  value: unknown, result: string, left: string, operator: BinaryOperator, right: string,
): boolean => value instanceof AssignmentExpressionNode
  && value.assign instanceof AssignNode
  && identifier(value.assign.identifier, result)
  && value.assign.expression instanceof BinaryOpNode
  && identifier(value.assign.expression.left, left)
  && value.assign.expression.operator === operator
  && identifier(value.assign.expression.right, right);

/**
 * Prove the exact pre-NamedReturn shape used by Solidity <0.8 checked-math wrappers. The proof is structural,
 * not name-based: arbitrary libraries receive the optimization only when their body has precisely the same
 * success/failure relation as SolidCash's native checked bounded operation.
 */
export default class MarkLegacyCheckedMath extends AstTraversal {
  visitSourceFile(node: SourceFileNode): SourceFileNode {
    for (const fn of node.freeFunctions) fn.nativeCheckedMath = this.match(fn);
    return node;
  }

  private match(fn: FunctionDefinitionNode): NativeCheckedMath | undefined {
    if (!fn.body || !fn.modifiers.includes(FunctionModifier.PURE)
      || fn.returnTypes.length !== 1 || fn.returnNames.length !== 1
      || !(fn.returnTypes[0] instanceof IntType)) return undefined;
    const result = fn.returnNames[0];
    const statements = fn.body.statements ?? [];

    if (fn.parameters.length === 2
      && fn.parameters[0].type instanceof IntType && fn.parameters[1].type instanceof IntType
      && fn.parameters[0].type.toString() === fn.returnTypes[0].toString()
      && fn.parameters[1].type.toString() === fn.returnTypes[0].toString()
      && statements.length === 1 && statements[0] instanceof RequireNode) {
      const [a, b] = fn.parameters.map((parameter) => parameter.name);
      const condition = statements[0].expression;
      if (condition instanceof BinaryOpNode
        && condition.operator === BinaryOperator.GE
        && assignedBinary(condition.left, result, a, BinaryOperator.PLUS, b)
        && identifier(condition.right, b)) return '+';
      if (condition instanceof BinaryOpNode
        && condition.operator === BinaryOperator.LE
        && assignedBinary(condition.left, result, a, BinaryOperator.MINUS, b)
        && identifier(condition.right, a)) return '-';
      if (condition instanceof BinaryOpNode && condition.operator === BinaryOperator.OR
        && condition.left instanceof BinaryOpNode && condition.left.operator === BinaryOperator.EQ
        && identifier(condition.left.left, b)
        && condition.left.right instanceof IntLiteralNode && condition.left.right.value === 0n
        && condition.right instanceof BinaryOpNode && condition.right.operator === BinaryOperator.EQ
        && identifier(condition.right.right, a)
        && condition.right.left instanceof BinaryOpNode
        && condition.right.left.operator === BinaryOperator.DIV
        && assignedBinary(condition.right.left.left, result, a, BinaryOperator.MUL, b)
        && identifier(condition.right.left.right, b)) return '*';
    }

    if (fn.parameters.length !== 1 || statements.length !== 2
      || !(fn.parameters[0].type instanceof IntType) || fn.parameters[0].type.signed
      || (fn.returnTypes[0] as IntType).signed
      || !(statements[0] instanceof RequireNode) || !(statements[1] instanceof AssignNode)) return undefined;
    const [parameter] = fn.parameters;
    const condition = statements[0].expression;
    const assignment = statements[1];
    if (!(condition instanceof BinaryOpNode) || condition.operator !== BinaryOperator.LE
      || !identifier(condition.left, parameter.name)
      || !(condition.right instanceof CastNode)
      || condition.right.type.toString() !== fn.returnTypes[0].toString()
      || !(condition.right.expression instanceof IntLiteralNode) || condition.right.expression.value !== -1n
      || !identifier(assignment.identifier, result)
      || !(assignment.expression instanceof CastNode)
      || assignment.expression.type.toString() !== fn.returnTypes[0].toString()
      || !identifier(assignment.expression.expression, parameter.name)) return undefined;
    return 'cast';
  }
}
