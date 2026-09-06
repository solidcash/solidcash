import { binToHex } from '@bitauth/libauth';
import {
  abiTypeString, ChildDeploymentGenesisStateAbi, ChildDeploymentValueRecipe, EnumType,
} from '@solidcash/utils';
import {
  BinaryOpNode, BoolLiteralNode, CastNode, ExpressionNode, HexLiteralNode, IdentifierNode,
  IntLiteralNode, UnaryOpNode,
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

const materializableCastType = /^(?:bool|bigint|u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|(?:u?fixed)(?:\d+x\d+)?|bytes(?:[1-9]|[12]\d|3[0-2])?)$/;
const fixedRecipeType = /^(?:u?fixed)(?:\d+x\d+)?$/;

const recipeType = (expression: ExpressionNode): string | undefined => {
  if (expression.type instanceof EnumType) return undefined;
  const type = expression.type ? abiTypeString(expression.type) : undefined;
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
    return operand && declaredType && materializableCastType.test(declaredType)
      ? { kind: 'cast', resultType: declaredType, operand } : undefined;
  }
  if (expression instanceof UnaryOpNode && unaryOperators.has(expression.operator)) {
    const operand = childDeploymentValueRecipe(expression.expression, handlerInputs, true, handlerInputTypes);
    const resultType = declaredType ?? (expression.operator === UnaryOperator.NOT ? 'bool' : operand?.resultType);
    return operand && resultType && !fixedRecipeType.test(resultType)
      && !(operand.resultType && fixedRecipeType.test(operand.resultType)) ? {
      kind: 'unary', operator: expression.operator as '!' | '-', resultType: resultType!, operand,
    } : undefined;
  }
  if (expression instanceof BinaryOpNode && binaryOperators.has(expression.operator)) {
    const left = childDeploymentValueRecipe(expression.left, handlerInputs, true, handlerInputTypes);
    const right = childDeploymentValueRecipe(expression.right, handlerInputs, true, handlerInputTypes);
    const booleanResult = [BinaryOperator.LT, BinaryOperator.LE, BinaryOperator.GT, BinaryOperator.GE,
      BinaryOperator.EQ, BinaryOperator.NE, BinaryOperator.AND, BinaryOperator.OR].includes(expression.operator);
    const resultType = declaredType ?? (booleanResult ? 'bool' : left?.resultType);
    return left && right && resultType && ![resultType, left.resultType, right.resultType]
      .some((type) => type !== undefined && fixedRecipeType.test(type)) ? {
      kind: 'binary',
      operator: expression.operator as Extract<ChildDeploymentValueRecipe, { kind: 'binary' }>['operator'],
      resultType,
      left,
      right,
    } : undefined;
  }
  return undefined;
}

/** Serialize a complete constructor-only folded state transition. */
export function childDeploymentGenesisState(
  foldedState: ReadonlyMap<string, ExpressionNode> | undefined,
  variables: readonly { name: string; type: { toString(): string }; nftIndex?: number; fieldIndex?: number }[],
  handlerInputs: ReadonlyMap<string, number>,
  handlerInputTypes?: ReadonlyMap<string, string>,
  allowUnpackedLayout = false,
): ChildDeploymentGenesisStateAbi | undefined {
  const fields: ChildDeploymentGenesisStateAbi['fields'][number][] = [];
  for (const [name, expression] of foldedState ?? []) {
    const variable = variables.find((candidate) => candidate.name === name);
    if (!variable || (!allowUnpackedLayout
      && (variable.nftIndex === undefined || variable.fieldIndex === undefined))) return undefined;
    const type = abiTypeString(variable.type as never);
    // Dynamic/aggregate state needs chunk/struct-aware recipe encoding. Keep this first slice fixed and scalar.
    if (!/^(?:bool|bigint|u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|(?:u?fixed)(?:\d+x\d+)?|bytes(?:[1-9]|[12]\d|3[0-2])|address|pubkey|datasig)$/.test(type)) return undefined;
    const value = childDeploymentValueRecipe(expression, handlerInputs, false, handlerInputTypes);
    if (!value) return undefined;
    fields.push({
      name, type, nftIndex: variable.nftIndex ?? 0,
      fieldIndex: variable.fieldIndex ?? variables.indexOf(variable), value,
    });
  }
  fields.sort((left, right) => left.nftIndex - right.nftIndex || left.fieldIndex - right.fieldIndex);
  return { kind: 'constructor', fields };
}
