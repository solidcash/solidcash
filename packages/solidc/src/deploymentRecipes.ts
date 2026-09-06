import { binToHex } from '@bitauth/libauth';
import { ChildDeploymentValueRecipe } from '@solidcash/utils';
import {
  BinaryOpNode, BoolLiteralNode, CastNode, ExpressionNode, HexLiteralNode, IdentifierNode, IntLiteralNode,
  UnaryOpNode,
} from './ast/AST.js';
import { BinaryOperator, UnaryOperator } from './ast/Operator.js';

const binaryOperators = new Set<BinaryOperator>([
  BinaryOperator.MUL, BinaryOperator.DIV, BinaryOperator.MOD,
  BinaryOperator.PLUS, BinaryOperator.MINUS,
  BinaryOperator.LT, BinaryOperator.LE, BinaryOperator.GT, BinaryOperator.GE,
  BinaryOperator.EQ, BinaryOperator.NE, BinaryOperator.AND, BinaryOperator.OR,
]);
const unaryOperators = new Set<UnaryOperator>([
  UnaryOperator.NOT, UnaryOperator.NEGATE,
]);

const recipeType = (expression: ExpressionNode): string | undefined => {
  const type = expression.type?.toString().replace(/address payable/g, 'address');
  // Collection, tuple, function, and contract-valued expressions require an ABI-aware evaluator. Keep this
  // initial recipe language scalar so every published node has one unambiguous runtime value.
  return type && !/[\[\]()]/.test(type) && !type.startsWith('mapping') ? type : undefined;
};

/** Serialize the deliberately small, pure expression language shared by child constructor args and CREATE2 salt. */
export function childDeploymentValueRecipe(
  expression: ExpressionNode,
  handlerInputs: ReadonlyMap<string, number>,
  nested = false,
  handlerInputTypes?: ReadonlyMap<string, string>,
): ChildDeploymentValueRecipe | undefined {
  if (expression instanceof IdentifierNode) {
    const inputIndex = handlerInputs.get(expression.name);
    const resultType = recipeType(expression) ?? handlerInputTypes?.get(expression.name);
    return inputIndex === undefined ? undefined : {
      kind: 'handlerInput', inputIndex, ...(nested && resultType && { resultType }),
    };
  }
  const declaredType = recipeType(expression);
  if (expression instanceof IntLiteralNode) {
    return declaredType
      ? { kind: 'intLiteral', value: expression.value.toString(), resultType: declaredType } : undefined;
  }
  if (expression instanceof BoolLiteralNode) {
    return declaredType ? { kind: 'boolLiteral', value: expression.value, resultType: declaredType } : undefined;
  }
  if (expression instanceof HexLiteralNode) {
    return declaredType
      ? { kind: 'bytesLiteral', value: binToHex(expression.value), resultType: declaredType } : undefined;
  }
  if (expression instanceof CastNode) {
    const operand = childDeploymentValueRecipe(expression.expression, handlerInputs, true, handlerInputTypes);
    return operand && declaredType ? { kind: 'cast', resultType: declaredType, operand } : undefined;
  }
  if (expression instanceof UnaryOpNode && unaryOperators.has(expression.operator)) {
    const operand = childDeploymentValueRecipe(expression.expression, handlerInputs, true, handlerInputTypes);
    const resultType = declaredType ?? (expression.operator === UnaryOperator.NOT ? 'bool' : operand?.resultType);
    return operand ? {
      kind: 'unary', operator: expression.operator as '!' | '-', resultType: resultType!, operand,
    } : undefined;
  }
  if (expression instanceof BinaryOpNode && binaryOperators.has(expression.operator)) {
    const left = childDeploymentValueRecipe(expression.left, handlerInputs, true, handlerInputTypes);
    const right = childDeploymentValueRecipe(expression.right, handlerInputs, true, handlerInputTypes);
    const booleanResult = [BinaryOperator.LT, BinaryOperator.LE, BinaryOperator.GT, BinaryOperator.GE,
      BinaryOperator.EQ, BinaryOperator.NE, BinaryOperator.AND, BinaryOperator.OR].includes(expression.operator);
    const resultType = declaredType ?? (booleanResult ? 'bool' : left?.resultType);
    return left && right && resultType ? {
      kind: 'binary',
      operator: expression.operator as Extract<ChildDeploymentValueRecipe, { kind: 'binary' }>['operator'],
      resultType,
      left,
      right,
    } : undefined;
  }
  return undefined;
}
