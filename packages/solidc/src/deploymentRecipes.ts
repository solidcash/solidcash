import { binToHex } from '@bitauth/libauth';
import {
  abiTypeString, ArrayType, ChildDeploymentGenesisEntryAbi, ChildDeploymentGenesisStateAbi,
  ChildDeploymentValueRecipe, CollectionInfo,
  computeCollectionSignature, EnumType, MappingType, PrimitiveType, StructDefinitionInfo, StructType, Type,
} from '@solidcash/utils';
import {
  AbiEncodePackedNode, ArrayNode, AssemblyStatementNode, AssignNode, BinaryOpNode, BlockNode, BoolLiteralNode,
  BranchNode, BreakNode,
  BytesConcatNode, CastNode,
  CollectionIterationNode,
  ContinueNode, DeleteLocalNode, DoWhileNode, ExpressionNode, FunctionDefinitionNode, HexLiteralNode, IdentifierNode,
  FunctionCallNode, FunctionModifier, InstantiationNode, IntLiteralNode, Node, ReturnNode, RevertNode, SwitchNode,
  TryCatchNode,
  RequireNode, TernaryOpNode, TupleAssignmentNode, UnaryOpNode, UncheckedNode, VariableDefinitionNode, WhileNode,
  TransferStatementNode,
  AddressTransferStatementNode,
  AddressSendExpressionNode,
  StateAccessNode,
  StateAssignNode,
  StateVariableNode,
  StringConcatNode,
  DeleteStateNode,
} from './ast/AST.js';
import { GlobalFunction } from './ast/Globals.js';
import { BinaryOperator, UnaryOperator } from './ast/Operator.js';
import { containsStatefulOperation } from './semantic/EnsureFinalRequireTraversal.js';
import { hasEffectiveCallValue } from './semantic/branchOps.js';

const binaryOperators = new Set<BinaryOperator>([
  BinaryOperator.MUL, BinaryOperator.DIV, BinaryOperator.MOD,
  BinaryOperator.PLUS, BinaryOperator.MINUS,
  BinaryOperator.LT, BinaryOperator.LE, BinaryOperator.GT, BinaryOperator.GE,
  BinaryOperator.EQ, BinaryOperator.NE, BinaryOperator.AND, BinaryOperator.OR,
]);
const unaryOperators = new Set<UnaryOperator>([
  UnaryOperator.NOT, UnaryOperator.NEGATE,
]);

// eslint-disable-next-line max-len
const materializableCastType = /^(?:address|bool|bigint|u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|(?:u?fixed)(?:\d+x\d+)?|bytes(?:[1-9]|[12]\d|3[0-2])?)$/;
// eslint-disable-next-line max-len
const numericRecipeType = /^(?:bigint|u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?)$/;
const concatenableRecipeType = /^(?:bytes(?:[1-9]|[12]\d|3[0-2])?|string)$/;
// Hash opcodes consume one VM stack item. Numeric/fixed/bool values therefore have an exact minimal VM-number
// representation, while signatures, aggregates, collections, and other multi-item values remain fenced.
// eslint-disable-next-line max-len
const hashableRecipeType = /^(?:bool|bigint|u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|(?:u?fixed)(?:\d+x\d+)?|bytes(?:[1-9]|[12]\d|3[0-2])?|string|address|pubkey|datasig)$/;
const pureHashFunctions = new Set<string>([
  GlobalFunction.RIPEMD160, GlobalFunction.SHA1, GlobalFunction.SHA256,
  GlobalFunction.HASH160, GlobalFunction.HASH256,
]);
const pureHashResultType = (algorithm: string): string =>
  algorithm === GlobalFunction.SHA256 || algorithm === GlobalFunction.HASH256 ? 'bytes32' : 'bytes20';
const concatenationResultType = (left: string | undefined, right: string | undefined): string | undefined => {
  if (left === 'string' && right === 'string') return 'string';
  const leftBytes = /^bytes(\d+)?$/.exec(left ?? '');
  const rightBytes = /^bytes(\d+)?$/.exec(right ?? '');
  if (!leftBytes || !rightBytes) return undefined;
  if (!leftBytes[1] || !rightBytes[1]) return 'bytes';
  const width = Number(leftBytes[1]) + Number(rightBytes[1]);
  return width <= 32 ? `bytes${width}` : 'bytes';
};
// eslint-disable-next-line max-len
const materializableGenesisLeafType = /^(?:bool|bigint|u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|(?:u?fixed)(?:\d+x\d+)?|bytes(?:[1-9]|[12]\d|3[0-2])|address|pubkey|datasig)$/;

const physicalRecipeType = (type: { toString(): string }): string =>
  type instanceof EnumType ? 'bigint' : abiTypeString(type as never);

const cloneEquivalentDefinition = (left: object, right: object): boolean => {
  if (left === right) return true;
  const leftNode = left as Node & { name?: string };
  const rightNode = right as Node & { name?: string };
  const leftLocation = leftNode.location;
  const rightLocation = rightNode.location;
  return left.constructor === right.constructor && leftNode.name === rightNode.name
    && leftLocation !== undefined && rightLocation !== undefined
    && leftLocation.start.line === rightLocation.start.line
    && leftLocation.start.column === rightLocation.start.column
    && leftLocation.end.line === rightLocation.end.line
    && leftLocation.end.column === rightLocation.end.column
    && leftLocation.sourceFileId === rightLocation.sourceFileId;
};

const exactHelperSignature = (
  call: FunctionCallNode, candidate: FunctionDefinitionNode,
  handlerInputTypes?: ReadonlyMap<string, string>,
  aliases?: ReadonlyMap<object, ChildDeploymentValueRecipe>,
  aliasDefinitions?: ReadonlyMap<string, object>,
): boolean => candidate.name === call.identifier.name
  && candidate.parameters.length === call.parameters.length
  && call.parameters.every((argument, index) => {
    const linkedDefinition = argument instanceof IdentifierNode ? argument.definition?.definition : undefined;
    const namedDefinition = argument instanceof IdentifierNode ? aliasDefinitions?.get(argument.name) : undefined;
    const aliasedType = (linkedDefinition && aliases?.get(linkedDefinition)?.resultType)
      || (namedDefinition && (!linkedDefinition || cloneEquivalentDefinition(linkedDefinition, namedDefinition))
        && aliases?.get(namedDefinition)?.resultType);
    const argumentType = argument.type?.toString()
      ?? (linkedDefinition as { type?: Type } | undefined)?.type?.toString()
      ?? aliasedType
      ?? (argument instanceof IdentifierNode ? handlerInputTypes?.get(argument.name) : undefined)
      // Early kernel admission precedes the final type pass. Hash intrinsics nevertheless have one fixed result
      // type, so they can select an overload exactly without guessing from its name/arity or argument contents.
      ?? (argument instanceof FunctionCallNode && !argument.resolvedFunction
        && pureHashFunctions.has(argument.identifier.name) && argument.parameters.length === 1
        ? pureHashResultType(argument.identifier.name) : undefined);
    return argumentType !== undefined && argumentType === candidate.parameters[index].type.toString();
  });

/** Resolve only semantic identity or a unique exact argument-type signature; never guess by name and arity. */
const resolvedRecipeHelper = (
  call: FunctionCallNode, helperFunctions: readonly FunctionDefinitionNode[],
  handlerInputTypes?: ReadonlyMap<string, string>,
  aliases?: ReadonlyMap<object, ChildDeploymentValueRecipe>,
  aliasDefinitions?: ReadonlyMap<string, object>,
): FunctionDefinitionNode | undefined => {
  const namedCandidates = helperFunctions.filter((candidate) =>
    candidate.name === call.identifier.name && candidate.parameters.length === call.parameters.length);
  if (call.resolvedFunction
    && call.resolvedFunction.name === call.identifier.name
    && call.resolvedFunction.parameters.length === call.parameters.length) {
    return namedCandidates.find((candidate) =>
      cloneEquivalentDefinition(candidate, call.resolvedFunction!)) ?? call.resolvedFunction;
  }
  const exactCandidates = namedCandidates.filter((candidate) => exactHelperSignature(
    call, candidate, handlerInputTypes, aliases, aliasDefinitions,
  ));
  return exactCandidates.length === 1 ? exactCandidates[0] : undefined;
};

const materializableGenesisType = (type: Type, stack: ReadonlySet<StructType> = new Set()): boolean => {
  if (type instanceof ArrayType) {
    return type.bound !== undefined && Number.isSafeInteger(type.bound) && type.bound >= 0
      && materializableGenesisType(type.elementType, stack);
  }
  if (!(type instanceof StructType)) return materializableGenesisLeafType.test(physicalRecipeType(type));
  if (stack.has(type)) return false;
  const nested = new Set(stack);
  nested.add(type);
  return type.fields.every((field) => materializableGenesisType(field.type, nested));
};

/** Physical definitions reachable from child state, used by both its codec and authenticated layout digest. */
export const childDeploymentStructDefinitions = (
  variables: readonly { type: Type }[],
): StructDefinitionInfo[] => {
  const definitions: StructDefinitionInfo[] = [];
  const seen = new Set<StructType>();
  const visit = (type: Type): void => {
    if (type instanceof ArrayType) {
      visit(type.elementType);
      return;
    }
    if (!(type instanceof StructType) || seen.has(type)) return;
    seen.add(type);
    definitions.push({
      name: type.name,
      fields: type.fields.map((field) => ({ name: field.name, type: physicalRecipeType(field.type) })),
    });
    for (const field of type.fields) visit(field.type);
  };
  for (const variable of variables) visit(variable.type);
  return definitions;
};

/** Collection geometry embedded in a child layout digest; entries remain separate NFTs, never inline state. */
export const childDeploymentCollectionDefinitions = (
  collections: readonly { name: string; type: ArrayType | MappingType; keyType: Type; innermostValueType: Type;
    immutable: boolean; sorted: boolean; enumerable: boolean }[],
): CollectionInfo[] => collections.map((collection) => ({
  name: collection.name,
  signature: computeCollectionSignature(collection.name, collection.type.toString()),
  kind: collection.type instanceof ArrayType ? 'array' : 'mapping',
  keyType: abiTypeString(collection.keyType),
  valueType: abiTypeString(collection.innermostValueType),
  ...(collection.type instanceof ArrayType && {
    elementType: abiTypeString(collection.type.elementType),
    ...(collection.type.bound !== undefined && { bound: collection.type.bound }),
  }),
  ...(collection.immutable && { immutable: true }),
  // Every mapping uses the verified sorted-entry backend. Canonicalize that mandatory property from the
  // collection type itself: early kernel admission runs before the later normalization pass stamps `.sorted`,
  // and layout authentication must be phase-independent.
  ...((collection.type instanceof MappingType || collection.sorted) && { sorted: true }),
  ...(collection.enumerable && { enumerable: true }),
}));

const fixedRecipeDecimals = (type: string | undefined): number | undefined => {
  if (!type) return undefined;
  const match = /^(?:u?fixed)(?:\d+x(\d+))?$/.exec(type);
  return match ? Number(match[1] ?? 18) : undefined;
};

const recipeType = (expression: ExpressionNode): string | undefined => {
  // Enum values have the same runtime/commitment representation as `bigint`. Keep the nominal name in the
  // public function ABI, but publish the executable recipe in the primitive type understood by the SDK.
  if (expression.type instanceof EnumType) return 'bigint';
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
  aliases?: ReadonlyMap<object, ChildDeploymentValueRecipe>,
  aliasDefinitions?: ReadonlyMap<string, object>,
  expectedType?: Type,
  structStack: ReadonlySet<StructType> = new Set(),
  helperFunctions: readonly FunctionDefinitionNode[] = [],
  helperStack: ReadonlySet<FunctionDefinitionNode> = new Set(),
): ChildDeploymentValueRecipe | undefined {
  if (expression instanceof IdentifierNode) {
    const linkedDefinition = expression.definition?.definition;
    const namedDefinition = aliasDefinitions?.get(expression.name);
    if (aliases) {
      const linked = linkedDefinition && aliases.get(linkedDefinition);
      if (linked) return linked;
      // Early route preparation can clone a pure subexpression without cloning the lexical environment which
      // owns it. Use the currently scoped name binding only when the linked declaration is not tracked in this
      // environment; this preserves shadowing while repairing clone-stale declaration identities.
      if (namedDefinition && (!linkedDefinition
        || cloneEquivalentDefinition(linkedDefinition, namedDefinition))) return aliases.get(namedDefinition);
    }
    const inputIndex = handlerInputs.get(expression.name);
    const resultType = recipeType(expression) ?? handlerInputTypes?.get(expression.name);
    return inputIndex === undefined ? undefined : {
      kind: 'handlerInput', inputIndex, ...(nested && resultType && { resultType }),
    };
  }
  if (expression instanceof StateAccessNode && aliases && aliasDefinitions) {
    return aliases.get(aliasDefinitions.get(`this.${expression.name}`) ?? expression.stateVariable as object);
  }
  const declaredType = recipeType(expression);
  if (expression instanceof IntLiteralNode) {
    const resultType = declaredType ?? (expectedType ? physicalRecipeType(expectedType) : 'int');
    return { kind: 'intLiteral', value: expression.value.toString(), resultType };
  }
  if (expression instanceof BoolLiteralNode) {
    const resultType = declaredType ?? (expectedType ? physicalRecipeType(expectedType) : 'bool');
    return { kind: 'boolLiteral', value: expression.value, resultType };
  }
  if (expression instanceof HexLiteralNode) {
    const resultType = declaredType ?? (expectedType ? physicalRecipeType(expectedType) : undefined);
    return resultType
      ? { kind: 'bytesLiteral', value: binToHex(expression.value), resultType } : undefined;
  }
  if (expression instanceof BytesConcatNode || expression instanceof StringConcatNode) {
    // The surface builtins deliberately accept bytes/string mixtures, but the recipe evaluator exposes a typed
    // value rather than an untyped stack item. Admit only homogeneous calls so reproducing the value cannot depend
    // on an implicit bytes/string interpretation at the child ABI boundary. The AST's own result type is
    // authoritative: bytes.concat is always dynamic bytes, while string.concat is always string; operand bytesN
    // widths remain attached to their nested recipes.
    // Early kernel admission runs before TypeCheckTraversal has stamped the node, so use the intrinsic's fixed
    // surface result in that phase. Later analyses retain the identical type from the typed AST.
    const resultType = declaredType ?? (expression instanceof BytesConcatNode ? 'bytes' : 'string');
    if (expression.parameters.length === 0) return undefined;
    const operands = expression.parameters.map((parameter) => childDeploymentValueRecipe(
      parameter, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
      undefined, structStack, helperFunctions, helperStack,
    ));
    const operandTypeSupported = expression instanceof BytesConcatNode
      ? (type: string | undefined): boolean => /^bytes(?:[1-9]|[12]\d|3[0-2])?$/.test(type ?? '')
      : (type: string | undefined): boolean => type === 'string';
    return operands.every((operand) => operand && operandTypeSupported(operand.resultType))
      ? { kind: 'concat', resultType, operands: operands as ChildDeploymentValueRecipe[] }
      : undefined;
  }
  if (expression instanceof AbiEncodePackedNode) {
    const operands = expression.parameters.map((parameter) => childDeploymentValueRecipe(
      parameter, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
      undefined, structStack, helperFunctions, helperStack,
    ));
    // For byte/string operands, packed ABI encoding is exactly their unframed concatenation. Numeric and
    // aggregate packed widths need a distinct encoder recipe and remain fenced.
    return operands.length > 0 && operands.every((operand) => operand
      && concatenableRecipeType.test(operand.resultType ?? ''))
      ? { kind: 'concat', resultType: 'bytes', operands: operands as ChildDeploymentValueRecipe[] }
      : undefined;
  }
  if (expression instanceof FunctionCallNode && pureHashFunctions.has(expression.identifier.name)
    && !expression.resolvedFunction && expression.parameters.length === 1) {
    const operand = childDeploymentValueRecipe(
      expression.parameters[0], handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
      undefined, structStack, helperFunctions, helperStack,
    );
    const resultType = declaredType ?? (expectedType ? physicalRecipeType(expectedType) : undefined)
      ?? pureHashResultType(expression.identifier.name);
    return operand && resultType && hashableRecipeType.test(operand.resultType ?? '') ? {
      kind: 'hash',
      algorithm: expression.identifier.name as Extract<ChildDeploymentValueRecipe, { kind: 'hash' }>['algorithm'],
      resultType,
      operand,
    } : undefined;
  }
  if (expression instanceof ArrayNode
    && (expectedType instanceof ArrayType || expression.type instanceof ArrayType)) {
    const arrayType = expectedType instanceof ArrayType ? expectedType : expression.type as ArrayType;
    if (arrayType.bound === undefined || expression.elements.length !== arrayType.bound
      || !materializableGenesisType(arrayType, structStack)) return undefined;
    const elements = expression.elements.map((elementExpression) => {
      let element = childDeploymentValueRecipe(
        elementExpression, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
        arrayType.elementType, structStack, helperFunctions, helperStack,
      );
      const targetType = physicalRecipeType(arrayType.elementType);
      const sourceType = element?.resultType ?? recipeType(elementExpression);
      if (element && sourceType && sourceType !== targetType) {
        if (arrayType.elementType instanceof StructType || arrayType.elementType instanceof ArrayType
          || !materializableCastType.test(targetType)) return undefined;
        element = { kind: 'cast', resultType: targetType, operand: element };
      }
      return element;
    });
    return elements.every((element) => element !== undefined)
      ? { kind: 'aggregate', resultType: arrayType.toString(), elements: elements as ChildDeploymentValueRecipe[] }
      : undefined;
  }
  if (expression instanceof FunctionCallNode && expression.type instanceof StructType
    && expression.identifier.name === expression.type.name && !expression.resolvedFunction) {
    const structType = expression.type;
    if (structStack.has(structType) || expression.parameters.length !== structType.fields.length) return undefined;
    const nestedStructStack = new Set(structStack);
    nestedStructStack.add(structType);
    const elements = expression.parameters.map((parameter, index) => {
      const fieldType = structType.fields[index].type;
      if (!materializableGenesisType(fieldType, nestedStructStack)) return undefined;
      let element = childDeploymentValueRecipe(
        parameter, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
        fieldType, nestedStructStack, helperFunctions, helperStack,
      );
      const targetType = physicalRecipeType(fieldType);
      const sourceType = element?.resultType ?? recipeType(parameter);
      if (element && sourceType && sourceType !== targetType) {
        if (fieldType instanceof StructType || fieldType instanceof ArrayType) return undefined;
        if (!materializableCastType.test(targetType)) return undefined;
        element = { kind: 'cast', resultType: targetType, operand: element };
      }
      return element;
    });
    return elements.every((element) => element !== undefined)
      ? { kind: 'aggregate', resultType: structType.name, elements: elements as ChildDeploymentValueRecipe[] }
      : undefined;
  }
  if (expression instanceof FunctionCallNode) {
    const helper = resolvedRecipeHelper(
      expression, helperFunctions, handlerInputTypes, aliases, aliasDefinitions,
    );
    if (!helper) return undefined;
    if (!helper.modifiers.includes(FunctionModifier.PURE)
      || !(helper.modifiers.includes(FunctionModifier.INTERNAL)
        || helper.modifiers.includes(FunctionModifier.PRIVATE))
      || helper.returnTypes.length !== 1 || helperStack.has(helper)) return undefined;
    const statements = helper.body?.statements ?? [];
    if (statements.length === 0) return undefined;
    const helperAliases = new Map(aliases);
    const helperDefinitions = new Map(aliasDefinitions);
    const nestedHelperStack = new Set(helperStack);
    nestedHelperStack.add(helper);
    for (const [index, parameter] of helper.parameters.entries()) {
      const argument = childDeploymentValueRecipe(
        expression.parameters[index], handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
        parameter.type, structStack, helperFunctions, nestedHelperStack,
      );
      if (!argument) return undefined;
      helperAliases.set(parameter, argument);
      helperDefinitions.set(parameter.name, parameter);
    }
    for (const [index, statement] of statements.entries()) {
      const last = index === statements.length - 1;
      if (statement instanceof VariableDefinitionNode && statement.expression && !last) {
        let value = childDeploymentValueRecipe(
          statement.expression, handlerInputs, true, handlerInputTypes, helperAliases, helperDefinitions,
          statement.type, structStack, helperFunctions, nestedHelperStack,
        );
        const targetType = physicalRecipeType(statement.type);
        if (!value) return undefined;
        if (value.resultType !== targetType) {
          if (!materializableCastType.test(targetType)) return undefined;
          value = { kind: 'cast', resultType: targetType, operand: value };
        }
        helperAliases.set(statement, value);
        helperDefinitions.set(statement.name, statement);
        continue;
      }
      if (last && statement instanceof ReturnNode && statement.expressions.length === 1) {
        let value = childDeploymentValueRecipe(
          statement.expressions[0], handlerInputs, true, handlerInputTypes, helperAliases, helperDefinitions,
          helper.returnTypes[0], structStack, helperFunctions, nestedHelperStack,
        );
        const targetType = physicalRecipeType(helper.returnTypes[0]);
        if (!value) return undefined;
        if (value.resultType !== targetType) {
          if (!materializableCastType.test(targetType)) return undefined;
          value = { kind: 'cast', resultType: targetType, operand: value };
        }
        return value;
      }
      return undefined;
    }
  }
  if (expression instanceof TernaryOpNode) {
    const condition = childDeploymentValueRecipe(
      expression.condition, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
      PrimitiveType.BOOL, structStack, helperFunctions, helperStack,
    );
    const resultValueType = expectedType ?? expression.type;
    if (!resultValueType || !materializableGenesisType(resultValueType, structStack)) return undefined;
    const ifTrue = childDeploymentValueRecipe(
      expression.ifTrue, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
      resultValueType, structStack, helperFunctions, helperStack,
    );
    const ifFalse = childDeploymentValueRecipe(
      expression.ifFalse, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
      resultValueType, structStack, helperFunctions, helperStack,
    );
    const resultType = physicalRecipeType(resultValueType);
    if (!condition || condition.resultType !== 'bool' || !ifTrue || !ifFalse
      || ifTrue.resultType !== resultType || ifFalse.resultType !== resultType) return undefined;
    return { kind: 'conditional', resultType, condition, ifTrue, ifFalse };
  }
  if (expression instanceof CastNode) {
    const operand = childDeploymentValueRecipe(
      expression.expression, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
      undefined, structStack, helperFunctions, helperStack,
    );
    return operand && declaredType && materializableCastType.test(declaredType)
      ? { kind: 'cast', resultType: declaredType, operand } : undefined;
  }
  if (expression instanceof UnaryOpNode && unaryOperators.has(expression.operator)) {
    const operand = childDeploymentValueRecipe(
      expression.expression, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
      undefined, structStack, helperFunctions, helperStack,
    );
    const resultType = declaredType ?? (expression.operator === UnaryOperator.NOT ? 'bool' : operand?.resultType);
    const operandFixedDecimals = fixedRecipeDecimals(operand?.resultType);
    const resultFixedDecimals = fixedRecipeDecimals(resultType);
    const fixedSupported = operandFixedDecimals === undefined && resultFixedDecimals === undefined
      || expression.operator === UnaryOperator.NEGATE
        && operandFixedDecimals !== undefined && operandFixedDecimals === resultFixedDecimals;
    return operand && resultType && fixedSupported ? {
      kind: 'unary', operator: expression.operator as '!' | '-', resultType: resultType!, operand,
    } : undefined;
  }
  if (expression instanceof BinaryOpNode && binaryOperators.has(expression.operator)) {
    const left = childDeploymentValueRecipe(
      expression.left, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
      undefined, structStack, helperFunctions, helperStack,
    );
    const right = childDeploymentValueRecipe(
      expression.right, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
      undefined, structStack, helperFunctions, helperStack,
    );
    const booleanResult = [BinaryOperator.LT, BinaryOperator.LE, BinaryOperator.GT, BinaryOperator.GE,
      BinaryOperator.EQ, BinaryOperator.NE, BinaryOperator.AND, BinaryOperator.OR].includes(expression.operator);
    const fixedBooleanResult = [BinaryOperator.LT, BinaryOperator.LE, BinaryOperator.GT, BinaryOperator.GE,
      BinaryOperator.EQ, BinaryOperator.NE].includes(expression.operator);
    const resultType = declaredType ?? (expectedType ? physicalRecipeType(expectedType) : undefined)
      ?? (booleanResult ? 'bool' : expression.operator === BinaryOperator.PLUS
        ? concatenationResultType(left?.resultType, right?.resultType) ?? left?.resultType : left?.resultType);
    if (expression.operator === BinaryOperator.PLUS && left && right && resultType
      && concatenableRecipeType.test(left.resultType ?? '')
      && concatenableRecipeType.test(right.resultType ?? '')
      && concatenableRecipeType.test(resultType)) {
      return { kind: 'concat', resultType, operands: [left, right] };
    }
    const equality = expression.operator === BinaryOperator.EQ || expression.operator === BinaryOperator.NE;
    const logical = expression.operator === BinaryOperator.AND || expression.operator === BinaryOperator.OR;
    let supportedOperands = equality || (logical
      ? left?.resultType === 'bool' && right?.resultType === 'bool'
      : !!left?.resultType && !!right?.resultType
        && numericRecipeType.test(left.resultType) && numericRecipeType.test(right.resultType));
    const leftFixedDecimals = fixedRecipeDecimals(left?.resultType);
    const rightFixedDecimals = fixedRecipeDecimals(right?.resultType);
    const resultFixedDecimals = fixedRecipeDecimals(resultType);
    if (leftFixedDecimals !== undefined || rightFixedDecimals !== undefined || resultFixedDecimals !== undefined) {
      const fixedOperandsShareScale = leftFixedDecimals !== undefined && leftFixedDecimals === rightFixedDecimals;
      supportedOperands = fixedOperandsShareScale && (fixedBooleanResult
        ? resultType === 'bool'
        : !logical && resultFixedDecimals === leftFixedDecimals);
    }
    return left && right && resultType && supportedOperands ? {
      kind: 'binary',
      operator: expression.operator as Extract<ChildDeploymentValueRecipe, { kind: 'binary' }>['operator'],
      resultType,
      left,
      right,
    } : undefined;
  }
  return undefined;
}

export interface ChildDeploymentRecipeAnalysis {
  aliases: ReadonlyMap<object, ChildDeploymentValueRecipe>;
  aliasDefinitions: ReadonlyMap<string, object>;
  constructorArgs: readonly (ChildDeploymentValueRecipe | undefined)[];
  salt?: ChildDeploymentValueRecipe;
  value?: ChildDeploymentValueRecipe;
  supported: boolean;
}

/** Publish the finite collection subset whose constructor effects have an exact parent-row replay. */
export function childDeploymentGenesisEntries(
  entries: InstantiationNode['foldedCollectionEntries'],
  handlerInputs: ReadonlyMap<string, number>,
  handlerInputTypes: ReadonlyMap<string, string>,
  aliases?: ReadonlyMap<object, ChildDeploymentValueRecipe>,
  aliasDefinitions?: ReadonlyMap<string, object>,
): ChildDeploymentGenesisEntryAbi[] | undefined {
  if (!entries) return [];
  const result: ChildDeploymentGenesisEntryAbi[] = [];
  for (const entry of entries) {
    const collection = entry.collection;
    const arrayType = collection.type instanceof ArrayType && collection.type.bound !== undefined
      && !(collection.type.elementType instanceof ArrayType)
      && !(collection.type.elementType instanceof MappingType)
      && materializableGenesisType(collection.type.elementType) ? collection.type : undefined;
    const mappingType = collection.type instanceof MappingType
      && !(collection.type.valueType instanceof ArrayType)
      && !(collection.type.valueType instanceof MappingType)
      && materializableGenesisType(collection.type.valueType) ? collection.type : undefined;
    if (!arrayType && !mappingType) return undefined;
    const keyType = arrayType ? PrimitiveType.BIGINT : mappingType!.keyType;
    const valueType = arrayType ? arrayType.elementType : mappingType!.valueType;
    if (!materializableGenesisType(keyType) || !materializableGenesisType(valueType)) return undefined;
    const key = childDeploymentValueRecipe(
      entry.key, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions, keyType,
    );
    const value = childDeploymentValueRecipe(
      entry.value, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
      valueType,
    );
    if (!key || !materializableGenesisLeafType.test(key.resultType ?? '') || !value) return undefined;
    result.push({
      collection: collection.name,
      collectionSignature: computeCollectionSignature(collection.name, collection.type.toString()),
      keyType: physicalRecipeType(keyType),
      valueType: physicalRecipeType(valueType),
      key,
      value,
    });
  }
  return result;
}

const definitionOf = (identifier: IdentifierNode): object | undefined => identifier.definition?.definition;

const bindRecipe = (
  expression: ExpressionNode,
  targetType: string,
  handlerInputs: ReadonlyMap<string, number>,
  handlerInputTypes: ReadonlyMap<string, string>,
  aliases: ReadonlyMap<object, ChildDeploymentValueRecipe>,
  aliasDefinitions: ReadonlyMap<string, object>,
  helperFunctions: readonly FunctionDefinitionNode[] = [],
  expectedType?: Type,
): ChildDeploymentValueRecipe | undefined => {
  let recipe = childDeploymentValueRecipe(
    expression, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
    expectedType, new Set(), helperFunctions,
  );
  if (!recipe) return undefined;
  const sourceType = recipe.resultType ?? recipeType(expression);
  if (!sourceType) return undefined;
  if (sourceType !== targetType) {
    if (!materializableCastType.test(targetType)) return undefined;
    recipe = { kind: 'cast', resultType: targetType, operand: recipe };
  } else if (recipe.kind === 'handlerInput' && recipe.resultType === undefined) {
    recipe = { ...recipe, resultType: targetType };
  }
  return recipe;
};

type FixedBchEffectNode = TransferStatementNode | AddressTransferStatementNode | AddressSendExpressionNode
| InstantiationNode;

export interface FixedBchEffectRecipeAnalysis {
  recipient?: ChildDeploymentValueRecipe;
  amount?: ChildDeploymentValueRecipe;
  /** Undefined for an unconditional effect; activationSupported distinguishes that from an opaque predicate. */
  activation?: ChildDeploymentValueRecipe;
  activationSupported: boolean;
}

/**
 * Snapshot pure fixed-BCH-effect operands and reachability at their exact source position. This is deliberately
 * SSA-like rather than a function-wide "was this name ever assigned" test: a dominating straight-line update is
 * reproducible from the authenticated row, while a loop-carried value or a value escaping a branch join is not.
 * Bindings are keyed by declarations so shadowed locals cannot borrow one another's recipes.
 */
export function analyzeFixedBchEffectRecipes(
  fn: FunctionDefinitionNode,
  helperFunctions: readonly FunctionDefinitionNode[] = [],
  stateVariables: readonly StateVariableNode[] = [],
): WeakMap<FixedBchEffectNode, FixedBchEffectRecipeAnalysis> {
  const visibleInputs = fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
  const handlerInputs = new Map(visibleInputs.map((parameter, index) => [parameter.name, index]));
  const handlerInputTypes = new Map(visibleInputs.map((parameter) => [parameter.name, abiTypeString(parameter.type)]));
  const initialAliases = new Map<object, ChildDeploymentValueRecipe>(visibleInputs.map((parameter, inputIndex) => [
    parameter,
    { kind: 'handlerInput', inputIndex, resultType: physicalRecipeType(parameter.type) } as ChildDeploymentValueRecipe,
  ]));
  const initialDefinitions = new Map<string, object>(visibleInputs.map((parameter) => [parameter.name, parameter]));
  const transactionSignatureInputs = new Set(visibleInputs.flatMap((parameter, inputIndex) =>
    /^sig(?:\[.*\])?$/.test(abiTypeString(parameter.type)) ? [inputIndex] : []));
  const stateDefinitions = new Map<string, object>();
  const stateKeys = new Set<object>();
  const stateDefinition = (name: string): object => {
    let definition = stateDefinitions.get(name);
    if (!definition) {
      definition = {};
      stateDefinitions.set(name, definition);
      stateKeys.add(definition);
    }
    return definition;
  };
  const stateVariableTypes = new Map(stateVariables.map((variable) => [variable.name, variable.type]));
  // Seed only direct scalar reads from the authenticated incoming state. Subsequent source-ordered writes and
  // stateful calls update or delete these aliases below, so a transfer can never silently reuse stale pre-state.
  // Collections and transaction signatures are deliberately absent from the executable recipe language.
  const collectPreState = (value: unknown, seen = new WeakSet<object>()): void => {
    if (Array.isArray(value)) {
      value.forEach((item) => collectPreState(item, seen));
      return;
    }
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    if (value instanceof StateAccessNode) {
      const stateType = value.type ?? value.stateVariable?.type ?? stateVariableTypes.get(value.name);
      const resultType = stateType ? physicalRecipeType(stateType) : undefined;
      if (resultType && materializableGenesisLeafType.test(resultType) && resultType !== 'sig') {
        const definition = stateDefinition(value.name);
        initialAliases.set(definition, { kind: 'state', name: value.name, resultType });
        initialDefinitions.set(`this.${value.name}`, definition);
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (['definition', 'referencedContract', 'resolvedFunction', 'symbolTable'].includes(key)) continue;
      collectPreState(child, seen);
    }
  };
  collectPreState(fn.body);
  const result = new WeakMap<FixedBchEffectNode, FixedBchEffectRecipeAnalysis>();
  type Environment = {
    aliases: Map<object, ChildDeploymentValueRecipe>;
    definitions: Map<string, object>;
  };
  const cloneEnvironment = (environment: Environment): Environment => ({
    aliases: new Map(environment.aliases), definitions: new Map(environment.definitions),
  });
  const recipeUsesTransactionSignature = (
    value: ChildDeploymentValueRecipe, seen = new WeakSet<object>(),
  ): boolean => {
    if (value.kind === 'handlerInput') return transactionSignatureInputs.has(value.inputIndex);
    if (seen.has(value)) return false;
    seen.add(value);
    return Object.values(value).some((child) => child instanceof Object
      && (Array.isArray(child)
        ? child.some((item) => item instanceof Object
          && recipeUsesTransactionSignature(item as ChildDeploymentValueRecipe, seen))
        : 'kind' in child && recipeUsesTransactionSignature(child as ChildDeploymentValueRecipe, seen)));
  };
  const recipe = (expression: ExpressionNode, environment: Environment): ChildDeploymentValueRecipe | undefined => {
    const resolved = childDeploymentValueRecipe(
      expression, handlerInputs, true, handlerInputTypes, environment.aliases, environment.definitions,
      undefined, new Set(), helperFunctions,
    );
    // A transaction signature commits the transaction containing the transfer output. Reusing it to derive that
    // output would create a circular fixed-effect recipe even when the kernel carries the signature separately as
    // a row witness. Data signatures are intentionally unaffected: they do not commit the spending transaction.
    return resolved && !recipeUsesTransactionSignature(resolved) ? resolved : undefined;
  };
  const negate = (operand: ChildDeploymentValueRecipe): ChildDeploymentValueRecipe => ({
    kind: 'unary', operator: '!', resultType: 'bool', operand,
  });
  const conjunction = (
    outer: ChildDeploymentValueRecipe | undefined, inner: ChildDeploymentValueRecipe,
  ): ChildDeploymentValueRecipe => outer === undefined ? inner : ({
    kind: 'binary', operator: '&&', resultType: 'bool', left: outer, right: inner,
  });
  const disjunction = (
    left: ChildDeploymentValueRecipe | undefined, right: ChildDeploymentValueRecipe | undefined,
  ): ChildDeploymentValueRecipe | undefined => {
    if (left === undefined || right === undefined) return undefined;
    if (JSON.stringify(left) === JSON.stringify(right)) return left;
    return { kind: 'binary', operator: '||', resultType: 'bool', left, right };
  };
  const sameRecipe = (
    left: ChildDeploymentValueRecipe, right: ChildDeploymentValueRecipe,
  ): boolean => JSON.stringify(left) === JSON.stringify(right);
  const sameOptionalRecipe = (
    left: ChildDeploymentValueRecipe | undefined, right: ChildDeploymentValueRecipe | undefined,
  ): boolean => left === undefined || right === undefined ? left === right : sameRecipe(left, right);
  const mergeConditionalRecipe = (
    condition: ChildDeploymentValueRecipe,
    whenTrue: ChildDeploymentValueRecipe,
    whenFalse: ChildDeploymentValueRecipe,
  ): ChildDeploymentValueRecipe | undefined => {
    if (sameRecipe(whenTrue, whenFalse)) return whenTrue;
    if (condition.resultType !== 'bool' || !whenTrue.resultType
      || whenTrue.resultType !== whenFalse.resultType) {
      return undefined;
    }
    // Typed pure phi. Recipe operands are restricted to authenticated handler inputs, literals, casts, and pure
    // scalar operators, so replaying this in the SDK neither observes state written by an arm nor repeats an
    // effectful source expression.
    return {
      kind: 'conditional', resultType: whenTrue.resultType,
      condition, ifTrue: whenTrue, ifFalse: whenFalse,
    };
  };
  const mergeBranchAliases = (
    environment: Environment,
    whenTrue: Environment,
    whenFalse: Environment,
    condition: ChildDeploymentValueRecipe | undefined,
  ): void => {
    // Only declarations visible before the branch can escape its lexical join. A missing recipe in either arm
    // remains unknown; differing pure values use the typed conditional recipe shared with the SDK.
    const definitions = new Set<object>(environment.definitions.values());
    // State declarations are contract-scoped, so a value assigned independently in every reachable arm may
    // join even when no replayable pre-branch value existed. Locals declared inside an arm remain excluded.
    for (const definition of whenTrue.aliases.keys()) if (stateKeys.has(definition)) definitions.add(definition);
    for (const definition of whenFalse.aliases.keys()) if (stateKeys.has(definition)) definitions.add(definition);
    for (const definition of definitions) {
      const trueRecipe = whenTrue.aliases.get(definition);
      const falseRecipe = whenFalse.aliases.get(definition);
      const merged = trueRecipe && falseRecipe && (sameRecipe(trueRecipe, falseRecipe)
        ? trueRecipe : condition && mergeConditionalRecipe(condition, trueRecipe, falseRecipe));
      if (merged) environment.aliases.set(definition, merged);
      else environment.aliases.delete(definition);
    }
    for (const [name, definition] of stateDefinitions) {
      environment.definitions.set(`this.${name}`, definition);
    }
  };
  const switchArmJoinSafe = (block: BlockNode): boolean => {
    const statements = block.statements ?? [];
    const permittedBreak = statements.at(-1) instanceof BreakNode ? statements.at(-1) : undefined;
    const containsAbruptExit = (value: unknown, seen = new WeakSet<object>()): boolean => {
      if (Array.isArray(value)) return value.some((item) => containsAbruptExit(item, seen));
      if (!(value instanceof Node) || seen.has(value)) return false;
      seen.add(value);
      if (value === permittedBreak) return false;
      if (value instanceof BreakNode || value instanceof ContinueNode) return true;
      return Object.entries(value).some(([key, child]) => ![
        'definition', 'referencedContract', 'resolvedFunction', 'symbolTable',
      ].includes(key) && containsAbruptExit(child, seen));
    };
    return !containsAbruptExit(block);
  };
  const resolvedDefinition = (identifier: IdentifierNode, environment: Environment): object | undefined =>
    (identifier.definition?.definition && environment.aliases.has(identifier.definition.definition)
      ? identifier.definition.definition
      : (() => {
        const named = environment.definitions.get(identifier.name);
        const linked = identifier.definition?.definition;
        return named && (!linked || cloneEquivalentDefinition(linked, named)) ? named : undefined;
      })());
  const singlePassWhileCondition = (
    statement: WhileNode, environment: Environment,
  ): ChildDeploymentValueRecipe | undefined => {
    if (!(statement.condition instanceof IdentifierNode)) return undefined;
    const conditionDefinition = resolvedDefinition(statement.condition, environment);
    const statements = statement.block.statements ?? [];
    const terminal = statements.at(-1);
    if (!conditionDefinition || !(terminal instanceof AssignNode)
      || resolvedDefinition(terminal.identifier, environment) !== conditionDefinition
      || !(terminal.expression instanceof BoolLiteralNode) || terminal.expression.value !== false) return undefined;
    // The terminal false assignment proves at most one iteration only when every successful path reaches it.
    // Keep this recognizer intentionally structural: nested control flow, abrupt exits, and another loop would
    // need their own dominance proof rather than inheriting this straight-line one.
    const unsafeControl = (value: unknown, seen = new WeakSet<object>()): boolean => {
      if (Array.isArray(value)) return value.some((item) => unsafeControl(item, seen));
      if (!(value instanceof Node) || seen.has(value)) return false;
      seen.add(value);
      if (value !== statement && (value instanceof BranchNode || value instanceof WhileNode
        || value instanceof DoWhileNode || value instanceof SwitchNode || value instanceof TryCatchNode
        || value instanceof UncheckedNode || value instanceof CollectionIterationNode
        || value instanceof BreakNode || value instanceof ContinueNode || value instanceof ReturnNode
        || value instanceof RevertNode || value instanceof AssemblyStatementNode)) return true;
      return Object.entries(value).some(([key, child]) => ![
        'definition', 'referencedContract', 'resolvedFunction', 'symbolTable',
      ].includes(key) && unsafeControl(child, seen));
    };
    if (unsafeControl(statement.block)) return undefined;
    const condition = recipe(statement.condition, environment);
    return condition?.resultType === 'bool' ? condition : undefined;
  };
  const invalidateAssignments = (
    value: unknown, environment: Environment, seen = new WeakSet<object>(),
  ): void => {
    if (Array.isArray(value)) {
      value.forEach((item) => invalidateAssignments(item, environment, seen));
      return;
    }
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    if (value instanceof AssignNode) {
      const definition = resolvedDefinition(value.identifier, environment);
      if (definition) environment.aliases.delete(definition);
    } else if (value instanceof StateAssignNode) {
      environment.aliases.delete(stateDefinition(value.name));
    } else if (value instanceof DeleteLocalNode) {
      const definition = resolvedDefinition(value.identifier, environment);
      if (definition) environment.aliases.delete(definition);
    } else if (value instanceof DeleteStateNode) {
      environment.aliases.delete(stateDefinition(value.name));
    } else if (value instanceof TupleAssignmentNode) {
      for (const element of value.elements) {
        if (element.skip || !element.name) continue;
        const definition = environment.definitions.get(element.name);
        if (definition) environment.aliases.delete(definition);
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (['definition', 'referencedContract', 'resolvedFunction', 'symbolTable'].includes(key)) continue;
      invalidateAssignments(child, environment, seen);
    }
  };
  const invalidateStatefulCalls = (
    value: unknown, environment: Environment, seen = new WeakSet<object>(),
  ): void => {
    if (Array.isArray(value)) {
      value.forEach((item) => invalidateStatefulCalls(item, environment, seen));
      return;
    }
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    if (value instanceof FunctionCallNode && value.resolvedFunction
      && containsStatefulOperation(value.resolvedFunction.body?.statements)) {
      // Scalar-journal helpers deliberately remain behind OP_INVOKE. Their post-call state is authenticated by
      // the VM, but it is not a pure function of this handler row which the SDK can independently replay. Drop
      // every tracked scalar alias rather than publishing a stale pre-call transfer recipe.
      for (const definition of stateKeys) environment.aliases.delete(definition);
    }
    for (const [key, child] of Object.entries(value)) {
      if (['definition', 'referencedContract', 'resolvedFunction', 'symbolTable'].includes(key)) continue;
      invalidateStatefulCalls(child, environment, seen);
    }
  };
  const snapshotEffects = (
    value: unknown, environment: Environment, activation: ChildDeploymentValueRecipe | undefined,
    activationSupported: boolean, unsafe: boolean, seen = new WeakSet<object>(),
  ): void => {
    if (Array.isArray(value)) {
      value.forEach((item) => snapshotEffects(
        item, environment, activation, activationSupported, unsafe, seen,
      ));
      return;
    }
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    if ((value instanceof TransferStatementNode && value.runtimeLoopTransfer === undefined)
      || value instanceof AddressTransferStatementNode || value instanceof AddressSendExpressionNode
      || (value instanceof InstantiationNode && value.referencedContract
        && !value.isStatefulDeploy && hasEffectiveCallValue(value.callOptions?.value))) {
      if (value instanceof InstantiationNode) {
        const amount = !unsafe ? recipe(value.callOptions!.value!, environment) : undefined;
        result.set(value, {
          ...(amount && { amount }),
          ...(!unsafe && activationSupported && activation && { activation }),
          activationSupported: !unsafe && activationSupported,
        });
        return;
      }
      const recipientExpression = value instanceof TransferStatementNode
        ? value.lockingBytecode : value.addressExpression;
      const recipient = !unsafe ? recipe(recipientExpression, environment) : undefined;
      const amount = !unsafe ? recipe(value.amount, environment) : undefined;
      result.set(value, {
        ...(recipient && { recipient }),
        ...(amount && { amount }),
        ...(!unsafe && activationSupported && activation && { activation }),
        activationSupported: !unsafe && activationSupported,
      });
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (['definition', 'referencedContract', 'resolvedFunction', 'symbolTable'].includes(key)) continue;
      snapshotEffects(child, environment, activation, activationSupported, unsafe, seen);
    }
  };
  type Flow = {
    fallsThrough: boolean;
    activation?: ChildDeploymentValueRecipe;
    activationSupported: boolean;
  };
  const processBlock = (
    block: BlockNode, environment: Environment,
    activation?: ChildDeploymentValueRecipe, activationSupported = true, unsafe = false,
  ): Flow => {
    let continuationActivation = activation;
    let continuationSupported = activationSupported;
    for (const statement of block.statements ?? []) {
      if (statement instanceof VariableDefinitionNode) {
        if (statement.expression) invalidateStatefulCalls(statement.expression, environment);
        if (statement.expression) snapshotEffects(
          statement.expression, environment, continuationActivation, continuationSupported, unsafe,
        );
        const key = statement as object;
        const bound = !unsafe && statement.expression
          ? bindRecipe(
            statement.expression, abiTypeString(statement.type), handlerInputs, handlerInputTypes,
            environment.aliases, environment.definitions, helperFunctions, statement.type,
          ) : undefined;
        if (bound) environment.aliases.set(key, bound); else environment.aliases.delete(key);
        environment.definitions.set(statement.name, key);
        continue;
      }
      if (statement instanceof AssignNode) {
        invalidateStatefulCalls(statement.expression, environment);
        snapshotEffects(statement.expression, environment, continuationActivation, continuationSupported, unsafe);
        const key = resolvedDefinition(statement.identifier, environment);
        const targetType = key && (key as { type?: { toString(): string } }).type;
        const bound = !unsafe && key && targetType
          ? bindRecipe(
            statement.expression, abiTypeString(targetType as never), handlerInputs, handlerInputTypes,
            environment.aliases, environment.definitions, helperFunctions, targetType as Type,
          ) : undefined;
        if (key && bound) environment.aliases.set(key, bound);
        else if (key) environment.aliases.delete(key);
        continue;
      }
      if (statement instanceof StateAssignNode) {
        invalidateStatefulCalls(statement.expression, environment);
        snapshotEffects(statement.expression, environment, continuationActivation, continuationSupported, unsafe);
        const key = stateDefinition(statement.name);
        environment.definitions.set(`this.${statement.name}`, key);
        const targetType = statement.stateVariable?.type;
        const bound = !unsafe && targetType ? bindRecipe(
          statement.expression, physicalRecipeType(targetType), handlerInputs, handlerInputTypes,
          environment.aliases, environment.definitions, helperFunctions, targetType,
        ) : !unsafe ? recipe(statement.expression, environment) : undefined;
        if (bound) environment.aliases.set(key, bound);
        else environment.aliases.delete(key);
        continue;
      }
      if (statement instanceof RequireNode) {
        invalidateStatefulCalls(statement.expression, environment);
        snapshotEffects(
          statement.expression, environment, continuationActivation, continuationSupported, unsafe,
        );
        const condition = !unsafe ? recipe(statement.expression, environment) : undefined;
        continuationSupported = continuationSupported && condition?.resultType === 'bool';
        continuationActivation = condition ? conjunction(continuationActivation, condition) : undefined;
        continue;
      }
      if (statement instanceof BranchNode) {
        invalidateStatefulCalls(statement.condition, environment);
        snapshotEffects(
          statement.condition, environment, continuationActivation, continuationSupported, unsafe,
        );
        const condition = !unsafe ? recipe(statement.condition, environment) : undefined;
        const branchSupported = continuationSupported && condition?.resultType === 'bool';
        const ifEnvironment = cloneEnvironment(environment);
        const ifActivation = condition ? conjunction(continuationActivation, condition) : undefined;
        const ifFlow = processBlock(
          statement.ifBlock, ifEnvironment,
          ifActivation, branchSupported, unsafe,
        );
        const elseEnvironment = cloneEnvironment(environment);
        const elseActivation = condition ? conjunction(continuationActivation, negate(condition)) : undefined;
        let elseFlow: Flow = {
          fallsThrough: true, activation: elseActivation, activationSupported: branchSupported,
        };
        if (statement.elseBlock) {
          elseFlow = processBlock(
            statement.elseBlock, elseEnvironment,
            elseActivation, branchSupported, unsafe,
          );
        }
        if (!ifFlow.fallsThrough && !elseFlow.fallsThrough) {
          return { fallsThrough: false, activationSupported: branchSupported };
        }
        if (ifFlow.fallsThrough && elseFlow.fallsThrough) {
          mergeBranchAliases(environment, ifEnvironment, elseEnvironment, condition);
          const armsUnrefined = sameOptionalRecipe(ifFlow.activation, ifActivation)
            && sameOptionalRecipe(elseFlow.activation, elseActivation);
          continuationActivation = armsUnrefined
            ? continuationActivation : disjunction(ifFlow.activation, elseFlow.activation);
          continuationSupported = ifFlow.activationSupported && elseFlow.activationSupported
            && (armsUnrefined || continuationActivation !== undefined);
        } else {
          const survivingEnvironment = ifFlow.fallsThrough ? ifEnvironment : elseEnvironment;
          environment.aliases = new Map(survivingEnvironment.aliases);
          continuationActivation = ifFlow.fallsThrough ? ifFlow.activation : elseFlow.activation;
          continuationSupported = ifFlow.fallsThrough
            ? ifFlow.activationSupported : elseFlow.activationSupported;
        }
        for (const [name, definition] of stateDefinitions) {
          environment.definitions.set(`this.${name}`, definition);
        }
        continue;
      }
      if (statement instanceof SwitchNode) {
        invalidateStatefulCalls(statement.expression, environment);
        snapshotEffects(
          statement.expression, environment, continuationActivation, continuationSupported, unsafe,
        );
        const discriminant = !unsafe ? recipe(statement.expression, environment) : undefined;
        const armValues = statement.cases.map((arm) => !unsafe ? recipe(arm.value, environment) : undefined);
        let unmatched: ChildDeploymentValueRecipe | undefined;
        const switchSupported = continuationSupported && discriminant !== undefined
          && armValues.every((armValue) => armValue !== undefined)
          && statement.cases.every((arm) => switchArmJoinSafe(arm.body))
          && (!statement.defaultCase || switchArmJoinSafe(statement.defaultCase));
        const arms: { environment: Environment; flow: Flow; entry?: ChildDeploymentValueRecipe }[] = [];
        const matchesByArm: ChildDeploymentValueRecipe[] = [];
        for (const [index, arm] of statement.cases.entries()) {
          const armValue = armValues[index];
          const matches = discriminant && armValue ? {
            kind: 'binary', operator: '==', resultType: 'bool', left: discriminant, right: armValue,
          } as ChildDeploymentValueRecipe : undefined;
          const firstMatch = matches && unmatched ? conjunction(unmatched, matches) : matches;
          const armEnvironment = cloneEnvironment(environment);
          const entry = firstMatch ? conjunction(continuationActivation, firstMatch) : undefined;
          const flow = processBlock(
            arm.body, armEnvironment,
            entry, switchSupported, unsafe,
          );
          arms.push({ environment: armEnvironment, flow, entry });
          if (matches) {
            matchesByArm.push(matches);
            unmatched = conjunction(unmatched, negate(matches));
          }
        }
        const defaultEnvironment = cloneEnvironment(environment);
        const defaultEntry = unmatched ? conjunction(continuationActivation, unmatched) : continuationActivation;
        let defaultFlow: Flow = {
          fallsThrough: true, activation: defaultEntry, activationSupported: switchSupported,
        };
        if (statement.defaultCase) {
          defaultFlow = processBlock(
            statement.defaultCase, defaultEnvironment,
            defaultEntry, switchSupported, unsafe,
          );
        }
        if (!switchSupported || matchesByArm.length !== statement.cases.length) {
          invalidateAssignments(statement, environment);
          continuationActivation = undefined;
          continuationSupported = false;
          continue;
        }
        let joined = defaultEnvironment;
        let joinedFlow = defaultFlow;
        for (let index = arms.length - 1; index >= 0; index -= 1) {
          const arm = arms[index];
          if (!arm.flow.fallsThrough) continue;
          if (!joinedFlow.fallsThrough) {
            joined = arm.environment;
            joinedFlow = arm.flow;
            continue;
          }
          const next = cloneEnvironment(environment);
          mergeBranchAliases(next, arm.environment, joined, matchesByArm[index]);
          joined = next;
          joinedFlow = {
            fallsThrough: true,
            activation: disjunction(arm.flow.activation, joinedFlow.activation),
            activationSupported: arm.flow.activationSupported && joinedFlow.activationSupported,
          };
        }
        if (!joinedFlow.fallsThrough) return { fallsThrough: false, activationSupported: switchSupported };
        environment.aliases = joined.aliases;
        const everyArmFallsThroughUnrefined = arms.every((arm) => arm.flow.fallsThrough
          && sameOptionalRecipe(arm.flow.activation, arm.entry))
          && defaultFlow.fallsThrough && sameOptionalRecipe(defaultFlow.activation, defaultEntry);
        continuationActivation = everyArmFallsThroughUnrefined
          ? continuationActivation : joinedFlow.activation;
        continuationSupported = joinedFlow.activationSupported
          && (everyArmFallsThroughUnrefined || continuationActivation !== undefined);
        for (const [name, definition] of stateDefinitions) {
          environment.definitions.set(`this.${name}`, definition);
        }
        continue;
      }
      if (statement instanceof TryCatchNode) {
        invalidateStatefulCalls(statement.expression, environment);
        snapshotEffects(
          statement.expression, environment, continuationActivation, continuationSupported, unsafe,
        );
        const tryFlow = processBlock(
          statement.tryBlock, environment, continuationActivation, continuationSupported, unsafe,
        );
        invalidateAssignments(statement.expression, environment);
        invalidateAssignments(statement.tryBlock, environment);
        // Bitcoin Script cannot recover from opcode failure, so catch clauses are dead. Among successful spends,
        // the try body is the only continuation and its reachability result is exact.
        if (!tryFlow.fallsThrough) return tryFlow;
        continuationActivation = tryFlow.activation;
        continuationSupported = tryFlow.activationSupported;
        continue;
      }
      if (statement instanceof UncheckedNode) {
        const uncheckedFlow = processBlock(
          statement.block, cloneEnvironment(environment), continuationActivation, continuationSupported, true,
        );
        invalidateAssignments(statement, environment);
        if (!uncheckedFlow.fallsThrough) return uncheckedFlow;
        continuationActivation = uncheckedFlow.activation;
        continuationSupported = false;
        continue;
      }
      if (statement instanceof BlockNode) {
        const scoped = { aliases: environment.aliases, definitions: new Map(environment.definitions) };
        const blockFlow = processBlock(
          statement, scoped, continuationActivation, continuationSupported, unsafe,
        );
        environment.aliases = scoped.aliases;
        if (!blockFlow.fallsThrough) return blockFlow;
        continuationActivation = blockFlow.activation;
        continuationSupported = blockFlow.activationSupported;
        continue;
      }
      if (statement instanceof WhileNode && !unsafe) {
        const condition = singlePassWhileCondition(statement, environment);
        if (condition) {
          snapshotEffects(
            statement.condition, environment, continuationActivation, continuationSupported, false,
          );
          const bodyEnvironment = cloneEnvironment(environment);
          const bodyEntry = conjunction(continuationActivation, condition);
          const bodyFlow = processBlock(
            statement.block, bodyEnvironment, bodyEntry, continuationSupported, false,
          );
          const skippedEnvironment = cloneEnvironment(environment);
          if (bodyFlow.fallsThrough) {
            mergeBranchAliases(environment, bodyEnvironment, skippedEnvironment, condition);
            const bodyUnrefined = sameOptionalRecipe(bodyFlow.activation, bodyEntry);
            continuationActivation = bodyUnrefined
              ? continuationActivation
              : disjunction(bodyFlow.activation, conjunction(continuationActivation, negate(condition)));
            continuationSupported = bodyFlow.activationSupported
              && (bodyUnrefined || continuationActivation !== undefined);
          } else {
            environment.aliases = skippedEnvironment.aliases;
            continuationActivation = conjunction(continuationActivation, negate(condition));
          }
          continue;
        }
      }
      const repeated = statement instanceof WhileNode || statement instanceof DoWhileNode
        || statement instanceof CollectionIterationNode;
      invalidateStatefulCalls(statement, environment);
      snapshotEffects(
        statement, environment, continuationActivation, continuationSupported, unsafe || repeated,
      );
      invalidateAssignments(statement, environment);
      if (statement instanceof ReturnNode || statement instanceof RevertNode) {
        return { fallsThrough: false, activationSupported: continuationSupported };
      }
    }
    return {
      fallsThrough: true, activation: continuationActivation, activationSupported: continuationSupported,
    };
  };
  processBlock(fn.body, { aliases: initialAliases, definitions: initialDefinitions });
  return result;
}

/**
 * Compute source-ordered, site-specific SSA recipes for deployment expressions. Bindings are keyed by their
 * resolved declaration nodes, so lexical shadowing cannot redirect an alias. Control-flow joins are deliberately
 * not interpreted: sites beneath them and bindings assigned by them fail closed.
 */
export function analyzeChildDeploymentRecipes(
  fn: FunctionDefinitionNode,
  helperFunctions: readonly FunctionDefinitionNode[] = [],
): WeakMap<InstantiationNode, ChildDeploymentRecipeAnalysis> {
  const visibleInputs = fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
  const handlerInputs = new Map(visibleInputs.map((parameter, index) => [parameter.name, index]));
  const handlerInputTypes = new Map(visibleInputs.map((parameter) => [parameter.name, abiTypeString(parameter.type)]));
  let aliases = new Map<object, ChildDeploymentValueRecipe>(visibleInputs.map((parameter, inputIndex) => [
    parameter,
    { kind: 'handlerInput', inputIndex, resultType: abiTypeString(parameter.type) } as ChildDeploymentValueRecipe,
  ]));
  let aliasDefinitions = new Map<string, object>(visibleInputs.map((parameter) => [parameter.name, parameter]));
  const result = new WeakMap<InstantiationNode, ChildDeploymentRecipeAnalysis>();
  const containsReturn = (value: unknown, seen = new WeakSet<object>()): boolean => {
    if (Array.isArray(value)) return value.some((item) => containsReturn(item, seen));
    if (!(value instanceof Node) || seen.has(value)) return false;
    seen.add(value);
    if (value instanceof ReturnNode) return true;
    for (const [key, child] of Object.entries(value)) {
      if (['definition', 'referencedContract', 'resolvedFunction', 'symbolTable'].includes(key)) continue;
      if (containsReturn(child, seen)) return true;
    }
    return false;
  };
  const childControlArmJoinSafe = (block: BlockNode): boolean => {
    const statements = block.statements ?? [];
    const permittedBreak = statements.at(-1) instanceof BreakNode ? statements.at(-1) : undefined;
    const containsAbruptExit = (value: unknown, seen = new WeakSet<object>()): boolean => {
      if (Array.isArray(value)) return value.some((item) => containsAbruptExit(item, seen));
      if (!(value instanceof Node) || seen.has(value)) return false;
      seen.add(value);
      if (value === permittedBreak) return false;
      if (value instanceof BreakNode || value instanceof ContinueNode
        || value instanceof ReturnNode || value instanceof RevertNode) return true;
      return Object.entries(value).some(([key, child]) => ![
        'definition', 'referencedContract', 'resolvedFunction', 'symbolTable',
      ].includes(key) && containsAbruptExit(child, seen));
    };
    return !containsAbruptExit(block);
  };
  const joinedRecipe = (
    condition: ChildDeploymentValueRecipe,
    whenTrue: ChildDeploymentValueRecipe | undefined,
    whenFalse: ChildDeploymentValueRecipe | undefined,
  ): ChildDeploymentValueRecipe | undefined => {
    if (!whenTrue || !whenFalse) return undefined;
    if (JSON.stringify(whenTrue) === JSON.stringify(whenFalse)) return whenTrue;
    if (condition.resultType !== 'bool' || !whenTrue.resultType
      || whenTrue.resultType !== whenFalse.resultType) return undefined;
    return {
      kind: 'conditional', resultType: whenTrue.resultType,
      condition, ifTrue: whenTrue, ifFalse: whenFalse,
    };
  };

  const snapshotExpression = (value: unknown, unsafe: boolean, seen = new WeakSet<object>()): void => {
    if (Array.isArray(value)) { value.forEach((item) => snapshotExpression(item, unsafe, seen)); return; }
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    if (value instanceof InstantiationNode) {
      const siteAliases = new Map(aliases);
      const siteAliasDefinitions = new Map(aliasDefinitions);
      const constructorParameters = value.referencedContract?.parameters.length
        ? value.referencedContract.parameters : value.referencedContract?.constructorDef?.parameters ?? [];
      const constructorArgs = value.parameters.map((parameter, index) => (unsafe ? undefined
        : childDeploymentValueRecipe(
          parameter, handlerInputs, false, handlerInputTypes, siteAliases, siteAliasDefinitions,
          constructorParameters[index]?.type, new Set(), helperFunctions,
        )));
      const salt = value.callOptions?.salt && !unsafe
        ? childDeploymentValueRecipe(
          value.callOptions.salt, handlerInputs, false, handlerInputTypes, siteAliases, siteAliasDefinitions,
          undefined, new Set(), helperFunctions,
        )
        : undefined;
      const callValue = value.callOptions?.value && !unsafe
        ? childDeploymentValueRecipe(
          value.callOptions.value, handlerInputs, false, handlerInputTypes, siteAliases, siteAliasDefinitions,
          undefined, new Set(), helperFunctions,
        )
        : undefined;
      result.set(value, {
        aliases: siteAliases,
        aliasDefinitions: siteAliasDefinitions,
        constructorArgs,
        ...(salt && { salt }),
        ...(callValue && { value: callValue }),
        supported: !unsafe && constructorArgs.every((recipe) => recipe !== undefined)
          && (!value.callOptions?.salt || salt !== undefined)
          && (!value.callOptions?.value || callValue !== undefined),
      });
    }
    for (const [key, child] of Object.entries(value)) {
      if (['definition', 'referencedContract', 'resolvedFunction', 'symbolTable'].includes(key)) continue;
      snapshotExpression(child, unsafe, seen);
    }
  };

  const invalidateAssignments = (value: unknown, seen = new WeakSet<object>()): void => {
    if (Array.isArray(value)) { value.forEach((item) => invalidateAssignments(item, seen)); return; }
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    if (value instanceof AssignNode) {
      const linked = definitionOf(value.identifier);
      const named = aliasDefinitions.get(value.identifier.name);
      const definition = linked && aliases.has(linked) ? linked
        : named && (!linked || cloneEquivalentDefinition(linked, named)) ? named : undefined;
      if (definition) aliases.delete(definition);
    } else if (value instanceof DeleteLocalNode) {
      const linked = definitionOf(value.identifier);
      const named = aliasDefinitions.get(value.identifier.name);
      const definition = linked && aliases.has(linked) ? linked
        : named && (!linked || cloneEquivalentDefinition(linked, named)) ? named : undefined;
      if (definition) aliases.delete(definition);
    } else if (value instanceof TupleAssignmentNode) {
      for (const element of value.elements) {
        if (element.skip || !element.name) continue;
        const definition = aliasDefinitions.get(element.name);
        if (definition) aliases.delete(definition);
        if (!element.existing) aliasDefinitions.set(element.name, element);
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (['definition', 'referencedContract', 'resolvedFunction', 'symbolTable'].includes(key)) continue;
      invalidateAssignments(child, seen);
    }
  };

  const processBlock = (block: BlockNode, unsafe = false): void => {
    let priorReturn = false;
    for (const statement of block.statements ?? []) {
      const statementUnsafe = unsafe || priorReturn;
      if (statement instanceof VariableDefinitionNode) {
        if (statement.expression) {
          snapshotExpression(statement.expression, statementUnsafe);
          invalidateAssignments(statement.expression);
        }
        const key = statement as object;
        if (!statementUnsafe && statement.expression) {
          const recipe = bindRecipe(
            statement.expression, abiTypeString(statement.type), handlerInputs, handlerInputTypes, aliases,
            aliasDefinitions, helperFunctions, statement.type,
          );
          if (recipe) aliases.set(key, recipe); else aliases.delete(key);
        } else aliases.delete(key);
        aliasDefinitions.set(statement.name, key);
        continue;
      }
      if (statement instanceof AssignNode) {
        snapshotExpression(statement.expression, statementUnsafe);
        invalidateAssignments(statement.expression);
        const linked = definitionOf(statement.identifier);
        const named = aliasDefinitions.get(statement.identifier.name);
        const key = linked && aliases.has(linked) ? linked
          : named && (!linked || cloneEquivalentDefinition(linked, named)) ? named : undefined;
        if (key && !statementUnsafe) {
          const targetType = abiTypeString((key as { type?: unknown }).type as never);
          const recipe = bindRecipe(
            statement.expression, targetType, handlerInputs, handlerInputTypes, aliases, aliasDefinitions,
            helperFunctions, (key as { type?: Type }).type,
          );
          if (recipe) aliases.set(key, recipe); else aliases.delete(key);
        } else if (key) aliases.delete(key);
        continue;
      }
      if (statement instanceof BlockNode && statement.scoped) {
        const outerDefinitions = aliasDefinitions;
        aliasDefinitions = new Map(aliasDefinitions);
        processBlock(statement, statementUnsafe);
        aliasDefinitions = outerDefinitions;
        priorReturn ||= containsReturn(statement);
        continue;
      }
      if (statement instanceof BranchNode) {
        snapshotExpression(statement.condition, statementUnsafe);
        const incomingAliases = new Map(aliases);
        const incomingDefinitions = new Map(aliasDefinitions);
        const condition = !statementUnsafe ? childDeploymentValueRecipe(
          statement.condition, handlerInputs, true, handlerInputTypes, incomingAliases, incomingDefinitions,
          undefined, new Set(), helperFunctions,
        ) : undefined;
        const branchSupported = condition?.resultType === 'bool'
          && childControlArmJoinSafe(statement.ifBlock)
          && (!statement.elseBlock || childControlArmJoinSafe(statement.elseBlock));
        // These callbacks execute synchronously and cannot escape this analysis iteration.
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        const processArm = (armBlock: BlockNode): Map<object, ChildDeploymentValueRecipe> => {
          aliases = new Map(incomingAliases);
          aliasDefinitions = new Map(incomingDefinitions);
          processBlock(armBlock, statementUnsafe || !branchSupported);
          return new Map(aliases);
        };
        const trueAliases = processArm(statement.ifBlock);
        const falseAliases = statement.elseBlock ? processArm(statement.elseBlock) : incomingAliases;
        aliases = new Map(incomingAliases);
        aliasDefinitions = incomingDefinitions;
        if (!branchSupported) {
          invalidateAssignments(statement);
          priorReturn ||= containsReturn(statement);
          continue;
        }
        const joined = new Map<object, ChildDeploymentValueRecipe>();
        for (const definition of incomingDefinitions.values()) {
          const recipe = joinedRecipe(condition, trueAliases.get(definition), falseAliases.get(definition));
          if (recipe) joined.set(definition, recipe);
        }
        aliases = joined;
        priorReturn ||= containsReturn(statement);
        continue;
      }
      if (statement instanceof SwitchNode) {
        snapshotExpression(statement.expression, statementUnsafe);
        const incomingAliases = new Map(aliases);
        const incomingDefinitions = new Map(aliasDefinitions);
        const discriminant = !statementUnsafe ? childDeploymentValueRecipe(
          statement.expression, handlerInputs, true, handlerInputTypes, incomingAliases, incomingDefinitions,
          undefined, new Set(), helperFunctions,
        ) : undefined;
        const matches = statement.cases.map((arm) => {
          const armValue = !statementUnsafe ? childDeploymentValueRecipe(
            arm.value, handlerInputs, true, handlerInputTypes, incomingAliases, incomingDefinitions,
            undefined, new Set(), helperFunctions,
          ) : undefined;
          return discriminant && armValue ? {
            kind: 'binary', operator: '==', resultType: 'bool', left: discriminant, right: armValue,
          } as ChildDeploymentValueRecipe : undefined;
        });
        const switchSupported = discriminant !== undefined
          && matches.every((match) => match !== undefined)
          && statement.cases.every((arm) => childControlArmJoinSafe(arm.body))
          && (!statement.defaultCase || childControlArmJoinSafe(statement.defaultCase));
        // Invoked synchronously for each arm; no callback escapes this switch-analysis iteration.
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        const processArm = (armBlock: BlockNode): Map<object, ChildDeploymentValueRecipe> => {
          aliases = new Map(incomingAliases);
          aliasDefinitions = new Map(incomingDefinitions);
          processBlock(armBlock, statementUnsafe || !switchSupported);
          return new Map(aliases);
        };
        const armAliases = statement.cases.map((arm) => processArm(arm.body));
        const defaultAliases = statement.defaultCase ? processArm(statement.defaultCase) : incomingAliases;
        aliases = new Map(incomingAliases);
        aliasDefinitions = incomingDefinitions;
        if (!switchSupported) {
          invalidateAssignments(statement);
          priorReturn ||= containsReturn(statement);
          continue;
        }
        let joined = new Map(defaultAliases);
        for (let index = armAliases.length - 1; index >= 0; index -= 1) {
          const next = new Map<object, ChildDeploymentValueRecipe>();
          for (const definition of incomingDefinitions.values()) {
            const recipe = joinedRecipe(matches[index]!, armAliases[index].get(definition), joined.get(definition));
            if (recipe) next.set(definition, recipe);
          }
          joined = next;
        }
        aliases = joined;
        priorReturn ||= containsReturn(statement);
        continue;
      }
      if (statement instanceof TryCatchNode) {
        // Script failure is fatal on BCH. A successful transaction executes the operation and try body; catch
        // clauses are dead and must neither publish sites nor invalidate aliases.
        snapshotExpression(statement.expression, statementUnsafe);
        snapshotExpression(statement.tryBlock, statementUnsafe);
        invalidateAssignments(statement.expression);
        invalidateAssignments(statement.tryBlock);
        priorReturn ||= containsReturn(statement.tryBlock);
        continue;
      }
      const controlFlow = statement instanceof BranchNode || statement instanceof WhileNode
        || statement instanceof DoWhileNode || statement instanceof SwitchNode || statement instanceof TryCatchNode
        || statement instanceof UncheckedNode || statement instanceof CollectionIterationNode;
      snapshotExpression(statement, statementUnsafe || controlFlow);
      invalidateAssignments(statement);
      priorReturn ||= containsReturn(statement);
    }
  };
  // Early-return lowering can wrap later statements in synthetic control flow. Only a return-capable construct
  // preceding a deployment makes that site unsafe; a terminal return after the site does not change its execution.
  processBlock(fn.body);
  return result;
}

/** Serialize a complete constructor-only folded state transition. */
export function childDeploymentGenesisState(
  foldedState: ReadonlyMap<string, ExpressionNode> | undefined,
  variables: readonly { name: string; type: Type; nftIndex?: number; fieldIndex?: number }[],
  handlerInputs: ReadonlyMap<string, number>,
  handlerInputTypes?: ReadonlyMap<string, string>,
  allowUnpackedLayout = false,
  aliases?: ReadonlyMap<object, ChildDeploymentValueRecipe>,
  aliasDefinitions?: ReadonlyMap<string, object>,
  helperFunctions: readonly FunctionDefinitionNode[] = [],
): ChildDeploymentGenesisStateAbi | undefined {
  const fields: ChildDeploymentGenesisStateAbi['fields'][number][] = [];
  for (const [name, expression] of foldedState ?? []) {
    const variable = variables.find((candidate) => candidate.name === name);
    if (!variable || (!allowUnpackedLayout
      && (variable.nftIndex === undefined || variable.fieldIndex === undefined))) return undefined;
    const type = physicalRecipeType(variable.type);
    // Finite fixed-layout structs and arrays are materialized as ordered aggregate recipes. Dynamic or cyclic
    // layouts remain fenced until their chunk topology and recursive encoding can be authenticated explicitly.
    if (!materializableGenesisType(variable.type)) return undefined;
    const value = childDeploymentValueRecipe(
      expression, handlerInputs, false, handlerInputTypes, aliases, aliasDefinitions, variable.type,
      new Set(), helperFunctions,
    );
    if (!value) return undefined;
    fields.push({
      name, type, nftIndex: variable.nftIndex ?? 0,
      fieldIndex: variable.fieldIndex ?? variables.indexOf(variable), value,
    });
  }
  fields.sort((left, right) => left.nftIndex - right.nftIndex || left.fieldIndex - right.fieldIndex);
  return { kind: 'constructor', fields };
}
