import { ArrayType, MappingType } from '@solidcash/utils';
import {
  ArrayAccessNode, ArrayAssignNode, AssignNode, BinaryOpNode, BranchNode, ContractNode,
  FunctionDefinitionNode, FunctionModifier, IdentifierNode, IntLiteralNode, NewArrayNode,
  RequireNode, ReturnNode, TernaryOpNode, UnaryOpNode, VariableDefinitionNode, WhileNode,
} from '../ast/AST.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';

const named = (value: unknown, name: string): boolean =>
  value instanceof IdentifierNode && value.name === name;

const binary = (value: unknown, operator: BinaryOperator, left: string, right: string): boolean =>
  value instanceof BinaryOpNode && value.operator === operator
    && named(value.left, left) && named(value.right, right);

const zero = (value: unknown): boolean => value instanceof IntLiteralNode && value.value === 0n;
const one = (value: unknown): boolean => value instanceof IntLiteralNode && value.value === 1n;

/**
 * Publish a pagination hint only for a complete, side-effect-free dense copy. The SDK may use the hint to
 * prefetch one mapping entry and serve `page(key, index, limit)` from it, so a partial resemblance is not enough:
 * changing the source index, loop bound, branch, or body must erase the proof rather than silently advertising a
 * different slice. This runs before semantic lowering, which rewrites the mapping and array operations.
 */
export default function detectMappingArrayPagination(contract: ContractNode): void {
  for (const fn of contract.functions) {
    fn.mappingArrayPagination = proveDenseSlice(contract, fn);
  }
}

function proveDenseSlice(
  contract: ContractNode, fn: FunctionDefinitionNode,
): FunctionDefinitionNode['mappingArrayPagination'] {
  if (!fn.modifiers.includes(FunctionModifier.VIEW) || fn.parameters.length !== 3
    || fn.returnTypes.length !== 1 || !fn.body || fn.body.statements?.length !== 9) return undefined;
  const [arrayLength, bounds, span, zeroLimit, clamp, result, counter, loop, returned] = fn.body.statements;
  if (!(arrayLength instanceof VariableDefinitionNode)
    || !(arrayLength.expression instanceof UnaryOpNode)
    || arrayLength.expression.operator !== UnaryOperator.SIZE
    || !(arrayLength.expression.expression instanceof ArrayAccessNode)) return undefined;

  const mappingRead = arrayLength.expression.expression;
  if (!(mappingRead.array instanceof IdentifierNode) || !(mappingRead.index instanceof IdentifierNode)) return undefined;
  const collectionName = mappingRead.array.name;
  const collection = contract.collections.find((candidate) => candidate.name === collectionName);
  if (!(collection?.type instanceof MappingType) || !(collection.type.valueType instanceof ArrayType)
    || collection.type.valueType.bound !== undefined) return undefined;
  const keyParam = mappingRead.index.name;
  const [key, index, limit] = fn.parameters.map((parameter) => parameter.name);
  if (keyParam !== key || !key || !index || !limit || new Set([key, index, limit]).size !== 3) return undefined;
  if (!(fn.returnTypes[0] instanceof ArrayType)
    || fn.returnTypes[0].toString() !== collection.type.valueType.toString()) return undefined;

  const lengthName = arrayLength.name;
  if (!(bounds instanceof RequireNode)
    || !binary(bounds.expression, BinaryOperator.LT, index, lengthName)
    || !(span instanceof VariableDefinitionNode)
    || !binary(span.expression, BinaryOperator.MINUS, lengthName, index)) return undefined;
  const spanName = span.name;
  if (new Set([key, index, limit, lengthName, spanName]).size !== 5) return undefined;

  if (!(zeroLimit instanceof BranchNode) || zeroLimit.elseBlock
    || !(zeroLimit.condition instanceof BinaryOpNode)
    || zeroLimit.condition.operator !== BinaryOperator.EQ
    || !((named(zeroLimit.condition.left, limit) && zero(zeroLimit.condition.right))
      || (zero(zeroLimit.condition.left) && named(zeroLimit.condition.right, limit)))
    || zeroLimit.ifBlock.statements?.length !== 1) return undefined;
  const fillLimit = zeroLimit.ifBlock.statements[0];
  if (!(fillLimit instanceof AssignNode) || fillLimit.identifier.name !== limit
    || !named(fillLimit.expression, spanName)) return undefined;

  if (!(clamp instanceof AssignNode) || clamp.identifier.name !== spanName
    || !(clamp.expression instanceof TernaryOpNode)
    || !binary(clamp.expression.condition, BinaryOperator.GT, spanName, limit)
    || !named(clamp.expression.ifTrue, limit)
    || !named(clamp.expression.ifFalse, spanName)) return undefined;
  if (!(result instanceof VariableDefinitionNode) || !(result.expression instanceof NewArrayNode)
    || result.type.toString() !== fn.returnTypes[0].toString()
    || !named(result.expression.size, spanName)) return undefined;
  const resultName = result.name;

  if (!(counter instanceof VariableDefinitionNode) || !zero(counter.expression)
    || !(loop instanceof WhileNode) || loop.forLoopUpdateCount !== 1
    || !binary(loop.condition, BinaryOperator.LT, counter.name, spanName)
    || loop.block.statements?.length !== 2) return undefined;
  const [copy, step] = loop.block.statements;
  if (!(copy instanceof ArrayAssignNode) || copy.name !== resultName || !named(copy.index, counter.name)
    || !(copy.value instanceof ArrayAccessNode)
    || !(copy.value.array instanceof ArrayAccessNode)
    || !named(copy.value.array.array, collection.name)
    || !named(copy.value.array.index, key)
    || !(copy.value.index instanceof BinaryOpNode)
    || copy.value.index.operator !== BinaryOperator.PLUS
    || !((named(copy.value.index.left, counter.name) && named(copy.value.index.right, index))
      || (named(copy.value.index.left, index) && named(copy.value.index.right, counter.name)))
    || !(step instanceof AssignNode) || step.identifier.name !== counter.name
    || !(step.expression instanceof BinaryOpNode)
    || step.expression.operator !== BinaryOperator.PLUS
    || !named(step.expression.left, counter.name) || !one(step.expression.right)) return undefined;
  if (!(returned instanceof ReturnNode) || returned.expressions.length !== 1
    || !named(returned.expressions[0], resultName)) return undefined;

  return { collection: collection.name, keyParams: [key], indexParam: index, limitParam: limit };
}
