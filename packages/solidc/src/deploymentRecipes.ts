import { binToHex } from '@bitauth/libauth';
import {
  abiTypeString, ChildDeploymentGenesisStateAbi, ChildDeploymentValueRecipe, EnumType, StructDefinitionInfo,
  StructType, Type,
} from '@solidcash/utils';
import {
  AssignNode, BinaryOpNode, BlockNode, BoolLiteralNode, BranchNode, BreakNode, CastNode, CollectionIterationNode,
  ContinueNode, DeleteLocalNode, DoWhileNode, ExpressionNode, FunctionDefinitionNode, HexLiteralNode, IdentifierNode,
  FunctionCallNode, InstantiationNode, IntLiteralNode, Node, ReturnNode, RevertNode, SwitchNode, TryCatchNode,
  TupleAssignmentNode, UnaryOpNode, UncheckedNode, VariableDefinitionNode, WhileNode, TransferStatementNode,
  AddressTransferStatementNode,
  AddressSendExpressionNode,
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

// eslint-disable-next-line max-len
const materializableCastType = /^(?:bool|bigint|u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|(?:u?fixed)(?:\d+x\d+)?|bytes(?:[1-9]|[12]\d|3[0-2])?)$/;
// eslint-disable-next-line max-len
const numericRecipeType = /^(?:bigint|u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?)$/;
// eslint-disable-next-line max-len
const materializableGenesisLeafType = /^(?:bool|bigint|u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|(?:u?fixed)(?:\d+x\d+)?|bytes(?:[1-9]|[12]\d|3[0-2])|address|pubkey|datasig)$/;

const physicalRecipeType = (type: { toString(): string }): string =>
  type instanceof EnumType ? 'bigint' : abiTypeString(type as never);

/** Physical definitions reachable from child state, used by both its codec and authenticated layout digest. */
export const childDeploymentStructDefinitions = (
  variables: readonly { type: Type }[],
): StructDefinitionInfo[] => {
  const definitions: StructDefinitionInfo[] = [];
  const seen = new Set<StructType>();
  const visit = (type: Type): void => {
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
  structStack: ReadonlySet<StructType> = new Set(),
): ChildDeploymentValueRecipe | undefined {
  if (expression instanceof IdentifierNode) {
    const definition = expression.definition?.definition ?? aliasDefinitions?.get(expression.name);
    if (definition && aliases) return aliases.get(definition);
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
  if (expression instanceof FunctionCallNode && expression.type instanceof StructType
    && expression.identifier.name === expression.type.name && !expression.resolvedFunction) {
    const structType = expression.type;
    if (structStack.has(structType) || expression.parameters.length !== structType.fields.length) return undefined;
    const nestedStructStack = new Set(structStack);
    nestedStructStack.add(structType);
    const elements = expression.parameters.map((parameter, index) => {
      const fieldType = structType.fields[index].type;
      if (!(fieldType instanceof StructType)
        && !materializableGenesisLeafType.test(physicalRecipeType(fieldType))) return undefined;
      let element = childDeploymentValueRecipe(
        parameter, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions, nestedStructStack,
      );
      const targetType = physicalRecipeType(fieldType);
      const sourceType = element?.resultType ?? recipeType(parameter);
      if (element && sourceType && sourceType !== targetType) {
        if (fieldType instanceof StructType) return undefined;
        if (!materializableCastType.test(targetType)) return undefined;
        element = { kind: 'cast', resultType: targetType, operand: element };
      }
      return element;
    });
    return elements.every((element) => element !== undefined)
      ? { kind: 'aggregate', resultType: structType.name, elements: elements as ChildDeploymentValueRecipe[] }
      : undefined;
  }
  if (expression instanceof CastNode) {
    const operand = childDeploymentValueRecipe(
      expression.expression, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions, structStack,
    );
    return operand && declaredType && materializableCastType.test(declaredType)
      ? { kind: 'cast', resultType: declaredType, operand } : undefined;
  }
  if (expression instanceof UnaryOpNode && unaryOperators.has(expression.operator)) {
    const operand = childDeploymentValueRecipe(
      expression.expression, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions, structStack,
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
      expression.left, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions, structStack,
    );
    const right = childDeploymentValueRecipe(
      expression.right, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions, structStack,
    );
    const booleanResult = [BinaryOperator.LT, BinaryOperator.LE, BinaryOperator.GT, BinaryOperator.GE,
      BinaryOperator.EQ, BinaryOperator.NE, BinaryOperator.AND, BinaryOperator.OR].includes(expression.operator);
    const fixedBooleanResult = [BinaryOperator.LT, BinaryOperator.LE, BinaryOperator.GT, BinaryOperator.GE,
      BinaryOperator.EQ, BinaryOperator.NE].includes(expression.operator);
    const resultType = declaredType ?? (booleanResult ? 'bool' : left?.resultType);
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

const definitionOf = (identifier: IdentifierNode): object | undefined => identifier.definition?.definition;

const bindRecipe = (
  expression: ExpressionNode,
  targetType: string,
  handlerInputs: ReadonlyMap<string, number>,
  handlerInputTypes: ReadonlyMap<string, string>,
  aliases: ReadonlyMap<object, ChildDeploymentValueRecipe>,
  aliasDefinitions: ReadonlyMap<string, object>,
): ChildDeploymentValueRecipe | undefined => {
  let recipe = childDeploymentValueRecipe(
    expression, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
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

type FixedBchEffectNode = TransferStatementNode | AddressTransferStatementNode | AddressSendExpressionNode;

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
): WeakMap<FixedBchEffectNode, FixedBchEffectRecipeAnalysis> {
  const visibleInputs = fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
  const handlerInputs = new Map(visibleInputs.map((parameter, index) => [parameter.name, index]));
  const handlerInputTypes = new Map(visibleInputs.map((parameter) => [parameter.name, abiTypeString(parameter.type)]));
  const initialAliases = new Map<object, ChildDeploymentValueRecipe>(visibleInputs.map((parameter, inputIndex) => [
    parameter,
    { kind: 'handlerInput', inputIndex, resultType: abiTypeString(parameter.type) } as ChildDeploymentValueRecipe,
  ]));
  const initialDefinitions = new Map<string, object>(visibleInputs.map((parameter) => [parameter.name, parameter]));
  const result = new WeakMap<FixedBchEffectNode, FixedBchEffectRecipeAnalysis>();
  type Environment = {
    aliases: Map<object, ChildDeploymentValueRecipe>;
    definitions: Map<string, object>;
  };
  const cloneEnvironment = (environment: Environment): Environment => ({
    aliases: new Map(environment.aliases), definitions: new Map(environment.definitions),
  });
  const recipe = (expression: ExpressionNode, environment: Environment): ChildDeploymentValueRecipe | undefined =>
    childDeploymentValueRecipe(
      expression, handlerInputs, true, handlerInputTypes, environment.aliases, environment.definitions,
    );
  const negate = (operand: ChildDeploymentValueRecipe): ChildDeploymentValueRecipe => ({
    kind: 'unary', operator: '!', resultType: 'bool', operand,
  });
  const conjunction = (
    outer: ChildDeploymentValueRecipe | undefined, inner: ChildDeploymentValueRecipe,
  ): ChildDeploymentValueRecipe => outer === undefined ? inner : ({
    kind: 'binary', operator: '&&', resultType: 'bool', left: outer, right: inner,
  });
  const sameRecipe = (
    left: ChildDeploymentValueRecipe, right: ChildDeploymentValueRecipe,
  ): boolean => JSON.stringify(left) === JSON.stringify(right);
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
    for (const definition of environment.definitions.values()) {
      const trueRecipe = whenTrue.aliases.get(definition);
      const falseRecipe = whenFalse.aliases.get(definition);
      const merged = trueRecipe && falseRecipe && (sameRecipe(trueRecipe, falseRecipe)
        ? trueRecipe : condition && mergeConditionalRecipe(condition, trueRecipe, falseRecipe));
      if (merged) environment.aliases.set(definition, merged);
      else environment.aliases.delete(definition);
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
      if (value instanceof BreakNode || value instanceof ContinueNode
        || value instanceof ReturnNode || value instanceof RevertNode) return true;
      return Object.entries(value).some(([key, child]) => ![
        'definition', 'referencedContract', 'resolvedFunction', 'symbolTable',
      ].includes(key) && containsAbruptExit(child, seen));
    };
    return !containsAbruptExit(block);
  };
  const resolvedDefinition = (identifier: IdentifierNode, environment: Environment): object | undefined =>
    identifier.definition?.definition ?? environment.definitions.get(identifier.name);
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
    } else if (value instanceof DeleteLocalNode) {
      const definition = resolvedDefinition(value.identifier, environment);
      if (definition) environment.aliases.delete(definition);
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
      || value instanceof AddressTransferStatementNode || value instanceof AddressSendExpressionNode) {
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
  const processBlock = (
    block: BlockNode, environment: Environment,
    activation?: ChildDeploymentValueRecipe, activationSupported = true, unsafe = false,
  ): void => {
    for (const statement of block.statements ?? []) {
      if (statement instanceof VariableDefinitionNode) {
        if (statement.expression) snapshotEffects(
          statement.expression, environment, activation, activationSupported, unsafe,
        );
        const key = statement as object;
        const bound = !unsafe && statement.expression
          ? bindRecipe(
            statement.expression, abiTypeString(statement.type), handlerInputs, handlerInputTypes,
            environment.aliases, environment.definitions,
          ) : undefined;
        if (bound) environment.aliases.set(key, bound); else environment.aliases.delete(key);
        environment.definitions.set(statement.name, key);
        continue;
      }
      if (statement instanceof AssignNode) {
        snapshotEffects(statement.expression, environment, activation, activationSupported, unsafe);
        const key = resolvedDefinition(statement.identifier, environment);
        const targetType = key && (key as { type?: { toString(): string } }).type;
        const bound = !unsafe && key && targetType
          ? bindRecipe(
            statement.expression, abiTypeString(targetType as never), handlerInputs, handlerInputTypes,
            environment.aliases, environment.definitions,
          ) : undefined;
        if (key && bound) environment.aliases.set(key, bound);
        else if (key) environment.aliases.delete(key);
        continue;
      }
      if (statement instanceof BranchNode) {
        snapshotEffects(statement.condition, environment, activation, activationSupported, unsafe);
        const condition = !unsafe ? recipe(statement.condition, environment) : undefined;
        const branchSupported = activationSupported && condition !== undefined;
        const ifEnvironment = cloneEnvironment(environment);
        processBlock(
          statement.ifBlock, ifEnvironment,
          condition ? conjunction(activation, condition) : undefined, branchSupported, unsafe,
        );
        const elseEnvironment = cloneEnvironment(environment);
        if (statement.elseBlock) {
          processBlock(
            statement.elseBlock, elseEnvironment,
            condition ? conjunction(activation, negate(condition)) : undefined, branchSupported, unsafe,
          );
        }
        mergeBranchAliases(environment, ifEnvironment, elseEnvironment, condition);
        continue;
      }
      if (statement instanceof SwitchNode) {
        snapshotEffects(statement.expression, environment, activation, activationSupported, unsafe);
        const discriminant = !unsafe ? recipe(statement.expression, environment) : undefined;
        let unmatched: ChildDeploymentValueRecipe | undefined;
        let switchSupported = activationSupported && discriminant !== undefined;
        const armEnvironments: Environment[] = [];
        const matchesByArm: ChildDeploymentValueRecipe[] = [];
        for (const arm of statement.cases) {
          const armValue = !unsafe ? recipe(arm.value, environment) : undefined;
          switchSupported &&= armValue !== undefined && switchArmJoinSafe(arm.body);
          const matches = discriminant && armValue ? {
            kind: 'binary', operator: '==', resultType: 'bool', left: discriminant, right: armValue,
          } as ChildDeploymentValueRecipe : undefined;
          const firstMatch = matches && unmatched ? conjunction(unmatched, matches) : matches;
          const armEnvironment = cloneEnvironment(environment);
          processBlock(
            arm.body, armEnvironment,
            firstMatch ? conjunction(activation, firstMatch) : undefined, switchSupported, unsafe,
          );
          armEnvironments.push(armEnvironment);
          if (matches) {
            matchesByArm.push(matches);
            unmatched = conjunction(unmatched, negate(matches));
          }
        }
        const defaultEnvironment = cloneEnvironment(environment);
        if (statement.defaultCase) {
          switchSupported &&= switchArmJoinSafe(statement.defaultCase);
          processBlock(
            statement.defaultCase, defaultEnvironment,
            unmatched ? conjunction(activation, unmatched) : activation, switchSupported, unsafe,
          );
        }
        if (!switchSupported || matchesByArm.length !== statement.cases.length) {
          invalidateAssignments(statement, environment);
          continue;
        }
        let joined = defaultEnvironment;
        for (let index = armEnvironments.length - 1; index >= 0; index -= 1) {
          const next = cloneEnvironment(environment);
          mergeBranchAliases(next, armEnvironments[index], joined, matchesByArm[index]);
          joined = next;
        }
        environment.aliases = joined.aliases;
        continue;
      }
      if (statement instanceof TryCatchNode) {
        snapshotEffects(statement.expression, environment, activation, activationSupported, unsafe);
        processBlock(statement.tryBlock, environment, activation, activationSupported, unsafe);
        invalidateAssignments(statement.expression, environment);
        invalidateAssignments(statement.tryBlock, environment);
        continue;
      }
      if (statement instanceof UncheckedNode) {
        processBlock(
          statement.block, cloneEnvironment(environment), activation, activationSupported, true,
        );
        invalidateAssignments(statement, environment);
        continue;
      }
      if (statement instanceof BlockNode) {
        const scoped = { aliases: environment.aliases, definitions: new Map(environment.definitions) };
        processBlock(statement, scoped, activation, activationSupported, unsafe);
        continue;
      }
      const repeated = statement instanceof WhileNode || statement instanceof DoWhileNode
        || statement instanceof CollectionIterationNode;
      snapshotEffects(statement, environment, activation, activationSupported, unsafe || repeated);
      invalidateAssignments(statement, environment);
    }
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
): WeakMap<InstantiationNode, ChildDeploymentRecipeAnalysis> {
  const visibleInputs = fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
  const handlerInputs = new Map(visibleInputs.map((parameter, index) => [parameter.name, index]));
  const handlerInputTypes = new Map(visibleInputs.map((parameter) => [parameter.name, abiTypeString(parameter.type)]));
  const aliases = new Map<object, ChildDeploymentValueRecipe>(visibleInputs.map((parameter, inputIndex) => [
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

  const snapshotExpression = (value: unknown, unsafe: boolean, seen = new WeakSet<object>()): void => {
    if (Array.isArray(value)) { value.forEach((item) => snapshotExpression(item, unsafe, seen)); return; }
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    if (value instanceof InstantiationNode) {
      const siteAliases = new Map(aliases);
      const siteAliasDefinitions = new Map(aliasDefinitions);
      const constructorArgs = value.parameters.map((parameter) => (unsafe ? undefined
        : childDeploymentValueRecipe(
          parameter, handlerInputs, false, handlerInputTypes, siteAliases, siteAliasDefinitions,
        )));
      const salt = value.callOptions?.salt && !unsafe
        ? childDeploymentValueRecipe(
          value.callOptions.salt, handlerInputs, false, handlerInputTypes, siteAliases, siteAliasDefinitions,
        )
        : undefined;
      const callValue = value.callOptions?.value && !unsafe
        ? childDeploymentValueRecipe(
          value.callOptions.value, handlerInputs, false, handlerInputTypes, siteAliases, siteAliasDefinitions,
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
      const definition = definitionOf(value.identifier) ?? aliasDefinitions.get(value.identifier.name);
      if (definition) aliases.delete(definition);
    } else if (value instanceof DeleteLocalNode) {
      const definition = definitionOf(value.identifier) ?? aliasDefinitions.get(value.identifier.name);
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
            aliasDefinitions,
          );
          if (recipe) aliases.set(key, recipe); else aliases.delete(key);
        } else aliases.delete(key);
        aliasDefinitions.set(statement.name, key);
        continue;
      }
      if (statement instanceof AssignNode) {
        snapshotExpression(statement.expression, statementUnsafe);
        invalidateAssignments(statement.expression);
        const key = definitionOf(statement.identifier) ?? aliasDefinitions.get(statement.identifier.name);
        if (key && !statementUnsafe) {
          const targetType = abiTypeString((key as { type?: unknown }).type as never);
          const recipe = bindRecipe(
            statement.expression, targetType, handlerInputs, handlerInputTypes, aliases, aliasDefinitions,
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
        // The branch predicate is authenticated separately as a deployment activation recipe. A `new` in an
        // arm may still use immutable row inputs and dominating aliases; do not poison those value recipes merely
        // because their physical occurrence is conditional. Branch-local aliases and joined assignments remain
        // unresolved here and therefore fail closed as before.
        snapshotExpression(statement.condition, statementUnsafe);
        snapshotExpression(statement.ifBlock, statementUnsafe);
        if (statement.elseBlock) snapshotExpression(statement.elseBlock, statementUnsafe);
        invalidateAssignments(statement);
        priorReturn ||= containsReturn(statement);
        continue;
      }
      if (statement instanceof SwitchNode) {
        // Arm activation is authenticated separately. Sites may use row inputs and aliases which dominate the
        // switch, but assignments made by any arm cannot escape the join as a single value recipe.
        snapshotExpression(statement.expression, statementUnsafe);
        for (const arm of statement.cases) snapshotExpression(arm.body, statementUnsafe);
        if (statement.defaultCase) snapshotExpression(statement.defaultCase, statementUnsafe);
        invalidateAssignments(statement);
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
  variables: readonly { name: string; type: { toString(): string }; nftIndex?: number; fieldIndex?: number }[],
  handlerInputs: ReadonlyMap<string, number>,
  handlerInputTypes?: ReadonlyMap<string, string>,
  allowUnpackedLayout = false,
  aliases?: ReadonlyMap<object, ChildDeploymentValueRecipe>,
  aliasDefinitions?: ReadonlyMap<string, object>,
): ChildDeploymentGenesisStateAbi | undefined {
  const fields: ChildDeploymentGenesisStateAbi['fields'][number][] = [];
  for (const [name, expression] of foldedState ?? []) {
    const variable = variables.find((candidate) => candidate.name === name);
    if (!variable || (!allowUnpackedLayout
      && (variable.nftIndex === undefined || variable.fieldIndex === undefined))) return undefined;
    const type = physicalRecipeType(variable.type);
    // Flat fixed-layout structs are materialized as ordered aggregate recipes; dynamic or nested layouts remain
    // fenced until their chunk topology and recursive encoding can be authenticated explicitly.
    if (!(variable.type instanceof StructType) && !materializableGenesisLeafType.test(type)) return undefined;
    const value = childDeploymentValueRecipe(
      expression, handlerInputs, false, handlerInputTypes, aliases, aliasDefinitions,
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
