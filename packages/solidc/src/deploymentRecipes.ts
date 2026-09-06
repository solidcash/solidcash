import { binToHex } from '@bitauth/libauth';
import {
  abiTypeString, ChildDeploymentGenesisStateAbi, ChildDeploymentValueRecipe, EnumType,
} from '@solidcash/utils';
import {
  AssignNode, BinaryOpNode, BlockNode, BoolLiteralNode, BranchNode, CastNode, CollectionIterationNode,
  DeleteLocalNode, DoWhileNode, ExpressionNode, FunctionDefinitionNode, HexLiteralNode, IdentifierNode,
  InstantiationNode, IntLiteralNode, Node, ReturnNode, SwitchNode, TryCatchNode, TupleAssignmentNode, UnaryOpNode,
  UncheckedNode, VariableDefinitionNode, WhileNode,
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
const fixedRecipeType = /^(?:u?fixed)(?:\d+x\d+)?$/;
// eslint-disable-next-line max-len
const numericRecipeType = /^(?:bigint|u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?)$/;

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
  aliases?: ReadonlyMap<object, ChildDeploymentValueRecipe>,
  aliasDefinitions?: ReadonlyMap<string, object>,
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
  if (expression instanceof CastNode) {
    const operand = childDeploymentValueRecipe(
      expression.expression, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
    );
    return operand && declaredType && materializableCastType.test(declaredType)
      ? { kind: 'cast', resultType: declaredType, operand } : undefined;
  }
  if (expression instanceof UnaryOpNode && unaryOperators.has(expression.operator)) {
    const operand = childDeploymentValueRecipe(
      expression.expression, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
    );
    const resultType = declaredType ?? (expression.operator === UnaryOperator.NOT ? 'bool' : operand?.resultType);
    return operand && resultType && !fixedRecipeType.test(resultType)
      && !(operand.resultType && fixedRecipeType.test(operand.resultType)) ? {
        kind: 'unary', operator: expression.operator as '!' | '-', resultType: resultType!, operand,
      } : undefined;
  }
  if (expression instanceof BinaryOpNode && binaryOperators.has(expression.operator)) {
    const left = childDeploymentValueRecipe(
      expression.left, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
    );
    const right = childDeploymentValueRecipe(
      expression.right, handlerInputs, true, handlerInputTypes, aliases, aliasDefinitions,
    );
    const booleanResult = [BinaryOperator.LT, BinaryOperator.LE, BinaryOperator.GT, BinaryOperator.GE,
      BinaryOperator.EQ, BinaryOperator.NE, BinaryOperator.AND, BinaryOperator.OR].includes(expression.operator);
    const resultType = declaredType ?? (booleanResult ? 'bool' : left?.resultType);
    const equality = expression.operator === BinaryOperator.EQ || expression.operator === BinaryOperator.NE;
    const logical = expression.operator === BinaryOperator.AND || expression.operator === BinaryOperator.OR;
    const supportedOperands = equality || (logical
      ? left?.resultType === 'bool' && right?.resultType === 'bool'
      : !!left?.resultType && !!right?.resultType
        && numericRecipeType.test(left.resultType) && numericRecipeType.test(right.resultType));
    return left && right && resultType && supportedOperands && ![resultType, left.resultType, right.resultType]
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
    const type = abiTypeString(variable.type as never);
    // Dynamic/aggregate state needs chunk/struct-aware recipe encoding. Keep this first slice fixed and scalar.
    // eslint-disable-next-line max-len
    if (!/^(?:bool|bigint|u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|(?:u?fixed)(?:\d+x\d+)?|bytes(?:[1-9]|[12]\d|3[0-2])|address|pubkey|datasig)$/.test(type)) return undefined;
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
