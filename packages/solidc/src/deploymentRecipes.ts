import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  abiTypeString, ArrayType, type ChildDeploymentGenesisEntryAbi, type ChildDeploymentGenesisStateAbi,
  type ChildDeploymentValueRecipe, type CollectionInfo,
  computeCollectionSignature, EnumType, MappingType, PrimitiveType, type StructDefinitionInfo, StructType, type Type,
} from '@solidcash/utils';
import {
  AbiEncodePackedNode, ArrayAccessNode, ArrayNode, AssemblyStatementNode, AssignNode, BinaryOpNode, BlockNode,
  BoolLiteralNode,
  BranchNode, BreakNode,
  BytesConcatNode, CastNode,
  CollectionIterationNode,
  ContinueNode, DeleteLocalNode, DoWhileNode, ExpressionNode, FunctionDefinitionNode, HexLiteralNode, IdentifierNode,
  ExternalFunctionCallNode, FunctionCallNode, FunctionModifier, InstantiationNode, IntLiteralNode, Node,
  ReturnNode, RevertNode, SwitchNode,
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
  NullaryOpNode,
  FieldAccessNode,
  TupleIndexOpNode,
  ArrayAssignNode,
  ArrayDeleteNode,
  ArrayPushNode,
  ArrayPopNode,
  CollectionNode,
  MappingAccessNode,
  MappingAssignNode,
  MappingFieldAssignNode,
  MappingDeleteNode,
} from './ast/AST.js';
import { GlobalFunction } from './ast/Globals.js';
import { BinaryOperator, NullaryOperator, UnaryOperator } from './ast/Operator.js';
import { containsStatefulOperation } from './semantic/EnsureFinalRequireTraversal.js';
import { hasEffectiveCallValue } from './semantic/branchOps.js';
import {
  allowsPreFinalIntrinsicTypes,
  type FinalizedTypedEffectIrOptions,
} from './finalized-typed-effect-ir.js';

/**
 * finalized typed effect IR: analysis-scoped typed-effect policy. Kernel admission defaults to requiring finalized types
 * (no pre-final intrinsic invention). Nested recipe walks read this rather than threading options
 * through every recursive helper.
 */
let activeTypedEffectOptions: FinalizedTypedEffectIrOptions = { requireFinalizedTypes: false };

const withTypedEffectOptions = <T>(
  options: FinalizedTypedEffectIrOptions | undefined,
  run: () => T,
): T => {
  const previous = activeTypedEffectOptions;
  // Default remains allow-pre-final for analysis bridges; kernel publication asserts finalized IR separately.
  activeTypedEffectOptions = {
    requireFinalizedTypes: false,
    ...options,
  };
  try {
    return run();
  } finally {
    activeTypedEffectOptions = previous;
  }
};

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

type ProjectionPath = readonly (string | number)[];
// Tokens carry declaration identity only. Values remain in the source-ordered environment, including branch
// clones/joins; no analysis state is shared between compilations or leaked into the public recipe language.
const projectionTokens = new WeakMap<object, Map<string, object>>();
const projectionToken = (definition: object, path: ProjectionPath): object => {
  let tokens = projectionTokens.get(definition);
  if (!tokens) { tokens = new Map(); projectionTokens.set(definition, tokens); }
  const name = JSON.stringify(path);
  let token = tokens.get(name);
  if (!token) { token = {}; tokens.set(name, token); }
  return token;
};

const scalarProjections = (type: Type): { path: ProjectionPath; type: Type }[] => {
  const leaves: { path: ProjectionPath; type: Type }[] = [];
  let budget = 256;
  const visit = (current: Type, path: ProjectionPath, parents: ReadonlySet<Type>): void => {
    budget -= 1;
    if (budget < 0 || parents.has(current)) return;
    if (current instanceof StructType) {
      const nested = new Set(parents).add(current);
      for (const field of current.fields) visit(field.type, [...path, field.name], nested);
    } else if (current instanceof ArrayType) {
      if (current.bound === undefined || current.bound > budget) return;
      const nested = new Set(parents).add(current);
      for (let index = 0; index < current.bound; index += 1) visit(current.elementType, [...path, index], nested);
    } else if (materializableGenesisLeafType.test(physicalRecipeType(current))) {
      leaves.push({ path, type: current });
    }
  };
  visit(type, [], new Set());
  return budget < 0 ? [] : leaves;
};

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
    const definitionType = (linkedDefinition as { type?: Type } | undefined)?.type;
    // An identifier's declaration is the source type authority. Before overload resolution completes, the
    // expression node can temporarily carry the parameter type of a traversal-order overload candidate.
    const typedArgument = argument instanceof IdentifierNode
      ? definitionType : argument.type ?? definitionType;
    const argumentType = aliasedType
      ?? (argument instanceof IdentifierNode ? handlerInputTypes?.get(argument.name) : undefined)
      ?? (typedArgument ? abiTypeString(typedArgument) : undefined)
      // finalized typed effect IR: pre-final hash intrinsic invention only when finalized types are not required.
      ?? (allowsPreFinalIntrinsicTypes(activeTypedEffectOptions)
        && argument instanceof FunctionCallNode && !argument.resolvedFunction
        && pureHashFunctions.has(argument.identifier.name) && argument.parameters.length === 1
        ? pureHashResultType(argument.identifier.name) : undefined);
    return argumentType !== undefined && argumentType === abiTypeString(candidate.parameters[index].type);
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
  const exactCandidates = namedCandidates.filter((candidate) => exactHelperSignature(
    call, candidate, handlerInputTypes, aliases, aliasDefinitions,
  ));
  // Prefer a unique typed signature over an early symbol-table link. Same-arity overloads are not finalized until
  // type checking, so a pre-semantic link can still name the traversal-order candidate rather than the overload
  // selected by the source argument types.
  if (exactCandidates.length === 1) return exactCandidates[0];
  if (call.resolvedFunction
    && call.resolvedFunction.name === call.identifier.name
    && call.resolvedFunction.parameters.length === call.parameters.length) {
    return namedCandidates.find((candidate) =>
      cloneEquivalentDefinition(candidate, call.resolvedFunction!)) ?? call.resolvedFunction;
  }
  return undefined;
};

/** True only when a recipe helper call is bound by semantic identity or one unique exact parameter signature. */
export const hasExactRecipeHelperIdentity = (
  call: FunctionCallNode, helperFunctions: readonly FunctionDefinitionNode[],
  handlerInputTypes?: ReadonlyMap<string, string>,
): boolean => resolvedRecipeHelper(call, helperFunctions, handlerInputTypes) !== undefined;

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
    immutable: boolean; enumerable: boolean }[],
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
  // Every collection, array or mapping, uses the verified sorted-entry backend. Kernel admission digests a child
  // before the normalization pass stamps `.sorted`, so the mandatory property is canonical, not read.
  sorted: true,
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
  if (expression instanceof FieldAccessNode || expression instanceof ArrayAccessNode
    || expression instanceof TupleIndexOpNode || expression instanceof MappingAccessNode) {
    const resolve = (value: ExpressionNode): ChildDeploymentValueRecipe | undefined => childDeploymentValueRecipe(
      value, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
      undefined, structStack, helperFunctions, helperStack,
    );
    const project = (
      value: ExpressionNode, path: ProjectionPath, type: Type | undefined = value.type,
    ): ChildDeploymentValueRecipe | undefined => {
      if (value instanceof FieldAccessNode) return project(
        value.expression, [value.name, ...path], value.structType ?? value.expression.type,
      );
      if (value instanceof ArrayAccessNode) {
        if (!(value.index instanceof IntLiteralNode) || value.index.value < 0n
          || value.index.value > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
        return project(value.array, [Number(value.index.value), ...path]);
      }
      if (value instanceof TupleIndexOpNode) return Number.isSafeInteger(value.index) && value.index >= 0
        ? project(value.tuple, [value.index, ...path]) : undefined;
      if (value instanceof MappingAccessNode) {
        const collection = aliasDefinitions?.get(`entry.${value.name}`);
        if (!(collection instanceof CollectionNode) || !(collection.type instanceof MappingType)
          || !aliases?.has(collection) || value.keys.length !== collection.allKeyTypes.length) return undefined;
        let selectedType = collection.innermostValueType;
        let selectedPath = path;
        if (value.arrayIndex) {
          if (!(value.arrayIndex instanceof IntLiteralNode) || value.arrayIndex.value < 0n
            || value.arrayIndex.value > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
          selectedPath = [Number(value.arrayIndex.value), ...path];
        }
        for (const segment of selectedPath) {
          if (selectedType instanceof StructType && typeof segment === 'string') {
            const field = selectedType.fields.find((candidate) => candidate.name === segment);
            if (!field) return undefined;
            selectedType = field.type;
          } else if (selectedType instanceof ArrayType && typeof segment === 'number'
            && selectedType.bound !== undefined && segment >= 0 && segment < selectedType.bound) {
            selectedType = selectedType.elementType;
          } else return undefined;
        }
        const resultType = physicalRecipeType(selectedType);
        if (!materializableGenesisLeafType.test(resultType)) return undefined;
        const keys = value.keys.map((key, index) => bindRecipe(
          key, physicalRecipeType(collection.allKeyTypes[index]), handlerInputs, handlerInputTypes ?? new Map(),
          aliases, aliasDefinitions!, helperFunctions, collection.allKeyTypes[index],
        ));
        return keys.every((key) => key !== undefined) ? {
          kind: 'entry', collection: computeCollectionSignature(collection.name, collection.type.toString()),
          keys: keys as ChildDeploymentValueRecipe[], path: selectedPath, resultType,
        } : undefined;
      }
      if (path.length === 0) return resolve(value);
      if (value instanceof IdentifierNode) {
        const linked = value.definition?.definition;
        const named = aliasDefinitions?.get(value.name);
        const definition = named && (!linked || cloneEquivalentDefinition(linked, named)) ? named : linked;
        return definition ? aliases?.get(projectionToken(definition, path)) : undefined;
      }
      const [head, ...tail] = path;
      if (value instanceof FunctionCallNode && type instanceof StructType
        && value.identifier.name === type.name && !value.resolvedFunction) {
        const index = type.fields.findIndex((field) => field.name === head);
        return index >= 0 && value.parameters[index]
          ? project(value.parameters[index], tail, type.fields[index].type) : undefined;
      }
      if (value instanceof ArrayNode && typeof head === 'number') {
        return value.elements[head] ? project(value.elements[head], tail) : undefined;
      }
      if (value instanceof TernaryOpNode) {
        const condition = resolve(value.condition);
        const ifTrue = project(value.ifTrue, path);
        const ifFalse = project(value.ifFalse, path);
        return condition?.resultType === 'bool' && ifTrue?.resultType && ifTrue.resultType === ifFalse?.resultType
          ? { kind: 'conditional', resultType: ifTrue.resultType, condition, ifTrue, ifFalse } : undefined;
      }
      return undefined;
    };
    return project(expression, []);
  }
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
    // finalized typed effect IR: prefer stamped AST type. Pre-final intrinsic surface defaults only when allowed.
    const resultType = declaredType
      ?? (allowsPreFinalIntrinsicTypes(activeTypedEffectOptions)
        ? (expression instanceof BytesConcatNode ? 'bytes' : 'string')
        : undefined);
    if (resultType === undefined) return undefined;
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
    // finalized typed effect IR: finalized typed IR — do not invent hash result types when requireFinalizedTypes is on.
    const resultType = declaredType ?? (expectedType ? physicalRecipeType(expectedType) : undefined)
      ?? (allowsPreFinalIntrinsicTypes(activeTypedEffectOptions)
        ? pureHashResultType(expression.identifier.name) : undefined);
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
    // A view helper is replayable only when every statement below reduces to the same closed recipe language.
    // State reads therefore resolve solely when the caller supplied an authenticated, source-ordered alias;
    // transaction reads, effects, control flow, and unknown calls still fail closed.
    if (!(helper.modifiers.includes(FunctionModifier.PURE) || helper.modifiers.includes(FunctionModifier.VIEW))
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
  // A Yul word builtin (BinaryOpNode.yulBuiltin) has EVM semantics no recipe operator states.
  if (expression instanceof BinaryOpNode && binaryOperators.has(expression.operator) && !expression.yulBuiltin) {
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
| ExternalFunctionCallNode | InstantiationNode;

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
  collections: readonly CollectionNode[] = [],
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
  for (const variable of stateVariables) {
    const resultType = physicalRecipeType(variable.type);
    if (!materializableGenesisLeafType.test(resultType) || resultType === 'sig') continue;
    const definition = stateDefinition(variable.name);
    initialAliases.set(definition, { kind: 'state', name: variable.name, resultType });
    initialDefinitions.set(`this.${variable.name}`, definition);
  }
  for (const collection of collections) {
    if (!(collection.type instanceof MappingType)) continue;
    initialDefinitions.set(`entry.${collection.name}`, collection);
    initialAliases.set(collection, { kind: 'boolLiteral', value: true, resultType: 'bool' });
    stateKeys.add(collection);
  }
  // Rebind cloned direct reads to the scalar roots seeded above. Subsequent source-ordered writes and stateful
  // calls update or delete these aliases below, so a transfer can never silently reuse stale pre-state.
  // Mapping entry authorization is seeded separately above; transaction signatures remain excluded.
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
  const escapedProjections = new WeakMap<object, ProjectionPath[]>();
  const includesPath = (prefix: ProjectionPath, path: ProjectionPath): boolean => prefix.length <= path.length
    && prefix.every((segment, index) => segment === path[index]);
  const escapeProjection = (definition: object, path: ProjectionPath, environment: Environment): void => {
    const paths = escapedProjections.get(definition) ?? [];
    if (!paths.some((prefix) => includesPath(prefix, path))) {
      escapedProjections.set(definition, [...paths.filter((prefix) => !includesPath(path, prefix)), path]);
    }
    environment.aliases.delete(definition);
    for (const [encoded, token] of projectionTokens.get(definition) ?? []) {
      if (includesPath(path, JSON.parse(encoded) as ProjectionPath)) environment.aliases.delete(token);
    }
  };
  const invalidateDefinition = (definition: object, environment: Environment): void => {
    environment.aliases.delete(definition);
    for (const token of projectionTokens.get(definition)?.values() ?? []) environment.aliases.delete(token);
  };
  const aggregateReference = (
    expression: ExpressionNode, environment: Environment,
  ): { definition: object; type: Type; path: ProjectionPath } | undefined => {
    if (expression instanceof IdentifierNode) {
      const named = environment.definitions.get(expression.name);
      const linked = expression.definition?.definition;
      const definition = named && (!linked || cloneEquivalentDefinition(linked, named)) ? named : linked;
      const type = (definition as { type?: Type } | undefined)?.type;
      return definition && type ? { definition, type, path: [] } : undefined;
    }
    if (expression instanceof FieldAccessNode) {
      const parent = aggregateReference(expression.expression, environment);
      const type = parent?.type instanceof StructType
        ? parent.type.fields.find((field) => field.name === expression.name)?.type : undefined;
      return parent && type ? { definition: parent.definition, type, path: [...parent.path, expression.name] } : undefined;
    }
    if (expression instanceof ArrayAccessNode || expression instanceof TupleIndexOpNode) {
      const parent = aggregateReference(
        expression instanceof ArrayAccessNode ? expression.array : expression.tuple, environment,
      );
      const index = expression instanceof TupleIndexOpNode ? expression.index
        : expression.index instanceof IntLiteralNode ? Number(expression.index.value) : undefined;
      return parent?.type instanceof ArrayType ? {
        definition: parent.definition, type: parent.type.elementType,
        // An unknown index may alias any element, but cannot mutate a sibling outside this array.
        path: index !== undefined && Number.isSafeInteger(index) && index >= 0 ? [...parent.path, index] : parent.path,
      } : undefined;
    }
    return undefined;
  };
  const bindProjections = (
    definition: object, type: Type, expression: ExpressionNode | undefined, environment: Environment,
  ): void => {
    if (!(type instanceof StructType) && !(type instanceof ArrayType)) return;
    // Aggregate-to-aggregate memory assignment may alias. Until its alias group is modeled, do not publish a
    // snapshot for either side which could survive a mutation through the other reference.
    const reference = expression && aggregateReference(expression, environment);
    if (reference) {
      escapeProjection(reference.definition, reference.path, environment);
      escapeProjection(definition, [], environment);
      return;
    }
    const invalidateEmbeddedAliases = (value: ExpressionNode, expected: Type, path: ProjectionPath = []): void => {
      if (!(expected instanceof StructType) && !(expected instanceof ArrayType)) return;
      const embedded = aggregateReference(value, environment);
      if (embedded) {
        // A lowered field update rebuilds its own aggregate. Other references embedded in a constructor can
        // outlive this statement and alias future writes; fence both owners, including later reassignments.
        if (embedded.definition !== definition || JSON.stringify(embedded.path) !== JSON.stringify(path)) {
          escapeProjection(embedded.definition, embedded.path, environment);
          escapeProjection(definition, path, environment);
        }
      } else if (value instanceof FunctionCallNode && expected instanceof StructType
        && value.identifier.name === expected.name && !value.resolvedFunction) {
        value.parameters.forEach((argument, index) => {
          const field = expected.fields[index];
          if (field) invalidateEmbeddedAliases(argument, field.type, [...path, field.name]);
        });
      } else if (value instanceof ArrayNode && expected instanceof ArrayType) {
        value.elements.forEach((element, index) =>
          invalidateEmbeddedAliases(element, expected.elementType, [...path, index]));
      }
    };
    if (expression) invalidateEmbeddedAliases(expression, type);
    const bindings = scalarProjections(type).map((leaf) => {
      if (escapedProjections.get(definition)?.some((prefix) => includesPath(prefix, leaf.path))) {
        return [projectionToken(definition, leaf.path), undefined] as const;
      }
      let selected = expression;
      let selectedType: Type = type;
      for (const segment of leaf.path) {
        if (!selected) break;
        if (typeof segment === 'string' && selectedType instanceof StructType) {
          const field = new FieldAccessNode(selected, segment);
          field.structType = selectedType;
          selectedType = selectedType.fields.find((candidate) => candidate.name === segment)!.type;
          selected = field;
        } else if (typeof segment === 'number' && selectedType instanceof ArrayType) {
          selected = new ArrayAccessNode(selected, new IntLiteralNode(BigInt(segment)));
          selectedType = selectedType.elementType;
        } else return [projectionToken(definition, leaf.path), undefined] as const;
        selected.type = selectedType;
      }
      if (selected) selected.type = leaf.type;
      return [projectionToken(definition, leaf.path), selected && bindRecipe(
        selected, physicalRecipeType(leaf.type), handlerInputs, handlerInputTypes,
        environment.aliases, environment.definitions, helperFunctions, leaf.type,
      )] as const;
    });
    // Every RHS sees the old environment, even for a compiler-lowered reconstruction of this same struct.
    for (const token of projectionTokens.get(definition)?.values() ?? []) environment.aliases.delete(token);
    for (const [token, bound] of bindings) if (bound) environment.aliases.set(token, bound);
  };
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
    // Graph lowering replaces msg.sender with this compiler-owned row local before final artifact analysis.
    // Both spellings name the manifest-authenticated logical caller, not a user-controlled ABI input.
    if ((expression instanceof NullaryOpNode && expression.operator === NullaryOperator.MSG_SENDER)
      || (expression instanceof IdentifierNode && expression.name === '__message_bus_graph_caller')) {
      return { kind: 'logicalCaller', resultType: 'address' };
    }
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
    for (const definition of [...definitions]) {
      for (const token of projectionTokens.get(definition)?.values() ?? []) definitions.add(token);
    }
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
      if (definition) invalidateDefinition(definition, environment);
    } else if (value instanceof StateAssignNode) {
      environment.aliases.delete(stateDefinition(value.name));
    } else if (value instanceof DeleteLocalNode) {
      const definition = resolvedDefinition(value.identifier, environment);
      if (definition) invalidateDefinition(definition, environment);
    } else if (value instanceof DeleteStateNode) {
      environment.aliases.delete(stateDefinition(value.name));
    } else if (value instanceof ArrayAssignNode || value instanceof ArrayDeleteNode
      || value instanceof ArrayPushNode || value instanceof ArrayPopNode) {
      const definition = environment.definitions.get(value.name);
      if (definition) invalidateDefinition(definition, environment);
      const collection = environment.definitions.get(`entry.${value.name}`);
      if (collection) environment.aliases.delete(collection);
    } else if (value instanceof MappingAssignNode || value instanceof MappingFieldAssignNode
      || value instanceof MappingDeleteNode) {
      const collection = environment.definitions.get(`entry.${value.name}`);
      if (collection) environment.aliases.delete(collection);
    } else if (value instanceof TupleAssignmentNode) {
      for (const element of value.elements) {
        if (element.skip || !element.name) continue;
        const definition = environment.definitions.get(element.name);
        if (definition) invalidateDefinition(definition, environment);
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (['definition', 'referencedContract', 'resolvedFunction', 'symbolTable'].includes(key)) continue;
      invalidateAssignments(child, environment, seen);
    }
  };
  const invalidateStatefulCalls = (
    value: unknown, environment: Environment, seen = new WeakSet<object>(),
    expectedType?: Type,
  ): void => {
    if (Array.isArray(value)) {
      value.forEach((item) => invalidateStatefulCalls(item, environment, seen));
      return;
    }
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    const constructorType = value instanceof FunctionCallNode
      ? value.type instanceof StructType ? value.type : expectedType : undefined;
    if (value instanceof FunctionCallNode && constructorType instanceof StructType
      && value.identifier.name === constructorType.name && !value.resolvedFunction) {
      value.parameters.forEach((argument, index) => invalidateStatefulCalls(
        argument, environment, seen, constructorType.fields[index]?.type,
      ));
      return;
    }
    if (value instanceof FunctionCallNode) {
      for (const argument of value.parameters) {
        const reference = aggregateReference(argument, environment);
        if (reference && (reference.type instanceof StructType || reference.type instanceof ArrayType)) {
          escapeProjection(reference.definition, reference.path, environment);
        }
      }
    }
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
      || (value instanceof ExternalFunctionCallNode && value.interfaceName === '__raw__'
        && value.valueTransferIndex >= 0 && hasEffectiveCallValue(value.callOptions?.value))
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
      const amountExpression = value instanceof ExternalFunctionCallNode
        ? value.callOptions!.value! : value.amount;
      const amount = !unsafe ? recipe(amountExpression, environment) : undefined;
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
        if (statement.expression) invalidateStatefulCalls(
          statement.expression, environment, new WeakSet(), statement.type,
        );
        if (statement.expression) snapshotEffects(
          statement.expression, environment, continuationActivation, continuationSupported, unsafe,
        );
        const key = statement as object;
        const bound = !unsafe && statement.expression
          ? bindRecipe(
            statement.expression, abiTypeString(statement.type), handlerInputs, handlerInputTypes,
            environment.aliases, environment.definitions, helperFunctions, statement.type,
          ) : undefined;
        bindProjections(key, statement.type, !unsafe ? statement.expression : undefined, environment);
        if (bound) environment.aliases.set(key, bound); else environment.aliases.delete(key);
        environment.definitions.set(statement.name, key);
        continue;
      }
      if (statement instanceof AssignNode) {
        const key = resolvedDefinition(statement.identifier, environment);
        const targetType = key && (key as { type?: { toString(): string } }).type;
        invalidateStatefulCalls(statement.expression, environment, new WeakSet(), targetType as Type | undefined);
        snapshotEffects(statement.expression, environment, continuationActivation, continuationSupported, unsafe);
        const bound = !unsafe && key && targetType
          ? bindRecipe(
            statement.expression, abiTypeString(targetType as never), handlerInputs, handlerInputTypes,
            environment.aliases, environment.definitions, helperFunctions, targetType as Type,
          ) : undefined;
        if (key && targetType) bindProjections(
          key, targetType as Type, !unsafe ? statement.expression : undefined, environment,
        );
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
        // A require has no successful false continuation: the VM rejects the entire transaction. It is not
        // an optional transfer-selection branch and need not be replayed by the SDK (e.g. a signature check
        // or authenticated external result). Still snapshot effects in its expression and invalidate any
        // stateful helper calls above. Retain the existing narrowing optimization for replayable guards, but
        // an opaque precondition cannot make a previously known success-path activation opaque.
        const condition = !unsafe ? recipe(statement.expression, environment) : undefined;
        if (condition?.resultType === 'bool') {
          continuationActivation = conjunction(continuationActivation, condition);
        }
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
  typedEffectOptions?: FinalizedTypedEffectIrOptions,
): WeakMap<InstantiationNode, ChildDeploymentRecipeAnalysis> {
  return withTypedEffectOptions(typedEffectOptions, () => {
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
  });
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
