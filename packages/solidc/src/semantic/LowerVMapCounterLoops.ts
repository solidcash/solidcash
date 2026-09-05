import {
  AddressSendExpressionNode, AddressTransferStatementNode, ArrayAccessNode, ArrayAssignNode, ArrayDeleteNode,
  ArrayPopNode, ArrayPushNode,
  AssignNode, BinaryOpNode, BlockNode, BoolLiteralNode, BranchNode, BreakNode, CastNode, CollectionNode, ContinueNode,
  ContractNode,
  DoWhileNode,
  EmitStatementNode, ExpressionNode, ExpressionStatementNode, ExternalFunctionCallNode, FunctionCallNode,
  FunctionCallStatementNode,
  FieldAccessNode, FunctionDefinitionNode, IdentifierNode, IntLiteralNode, LiteralNode, MappingAccessNode,
  MappingAssignNode, MappingDeleteNode,
  MappingFieldAssignNode, MethodCallNode, MethodCallStatementNode, NewArrayNode, Node, ParameterNode, RequireNode,
  SourceFileNode,
  ReturnNode,
  StateAccessNode, StateArrayAssignNode, StateArrayDeleteNode, StateArrayPopNode, StateArrayPushNode,
  StateAssignNode, StatementNode, SwitchNode, TernaryOpNode, TokenContainerMethodStatementNode, TransferStatementNode,
  TryCatchNode, TupleIndexOpNode, UnaryOpNode, VariableDefinitionNode, WhileNode, FunctionModifier,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { createDefaultValueExpression } from '../ast/defaults.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
import {
  AddressType, ArrayType, BytesType, FixedType, IntType, PrimitiveType, StructType, Type,
} from '@solidcash/utils';
import {
  isFunctionEntryInvariantMappingKey, VMAP_KEY_SNAPSHOT_PREFIX,
} from './CacheMappingEntryInLoop.js';

export const VMAP_COUNTER_PERM_PREFIX = '__internal__vmapCounterPerm_';
export const VMAP_COUNTER_OLD_PREFIX = '__internal__vmapCounterOld_';
export const VMAP_COUNTER_VALUE_PREFIX = '__internal__vmapCounterValue_';
export const VMAP_COUNTER_INPUT_COUNT_PREFIX = '__internal__vmapCounterInputCount_';
export const VMAP_COUNTER_OUTPUT_COUNT_PREFIX = '__internal__vmapCounterOutputCount_';
export const VMAP_RUNTIME_INPUT_COUNT_PREFIX = '__internal__vmapRuntimeInputCount_';
export const VMAP_RUNTIME_OUTPUT_COUNT_PREFIX = '__internal__vmapRuntimeOutputCount_';
export const vmapRuntimeInputCountName = (collection: string): string =>
  `${VMAP_RUNTIME_INPUT_COUNT_PREFIX}${collection}`;
export const vmapRuntimeOutputCountName = (collection: string): string =>
  `${VMAP_RUNTIME_OUTPUT_COUNT_PREFIX}${collection}`;
const PREFIX = VMAP_COUNTER_PERM_PREFIX;
const MAX_COUNTER_ITERATIONS = 64;
const PURE_COUNTER_VALUE_BUILTINS = new Set([
  'abs', 'min', 'max', 'within', 'addmod', 'mulmod',
  'ripemd160', 'sha1', 'sha256', 'hash160', 'hash256',
  'checkSig', 'checkMultiSig', 'checkDataSig',
  'toPaddedBytes', 'intToString', 'stringToInt', 'blobhash',
]);

/**
 * Lower a vmap counter loop `for (int i=0; i<n; i++) m[…][i] = f(i);` so logical indices execute through an
 * SDK-supplied slot-order permutation. Only mapping/array write keys and values are rewritten to perm[i].
 * Typed calls and other statements stay in source order. Event sites are recorded in a function-local runtime
 * stream and settled after all mapping journals, so they repeat in logical source order without sharing the
 * route's fixed per-row event slots. Nested if/else reachability is serialized when it depends only on SDK-visible
 * inputs, immutable aliases, stable pre-state, and the source counter. Stable switch arms use the same predicates.
 * Nested-loop effect reachability still needs richer runtime effect records. Direct BCH, fungible-token, and NFT
 * transfers use a source-ordered trailing stream alongside events. The canonical pre-test domains
 * `for (int i = constantStart; i < publicBound; i = i + positiveConstantStep)` and
 * `for (int i = constantStart; i > publicBound; i = i - positiveConstantStep)`, plus equivalent post-test
 * domains with constant or replayable runtime steps, lower. A unit post-test domain authenticates
 * `max(publicBound, 1)` entries. Multiple unconditional source-order loops may lower together when their
 * runtime keys are disjoint; each loop receives its own authenticated trailing input/output segment.
 * Finite pre-loop scalar-state assignments merge through if/else and switch into replayable path expressions.
 * Unsupported loop-carried predicates/values, unreplayable counter-derived reads, and nested-loop control still
 * need richer logical-journal or path metadata.
 *
 * The permutation is an untrusted unlocking witness. Generated checks prove it has exactly the canonical domain's
 * number of distinct elements in that domain, hence it is a complete permutation rather than an SDK convention.
 */
export default class LowerVMapCounterLoops extends AstTraversal {
  private collections = new Set<string>();
  private collectionsByName = new Map<string, CollectionNode>();
  private functionsByName = new Map<string, FunctionDefinitionNode[]>();
  private eventfulFunctionNames = new Set<string>();
  private externalTypeNames = new Set<string>();
  private structTypeNames = new Set<string>();
  private serial = 0;

  visitSourceFile(node: SourceFileNode): Node {
    this.externalTypeNames = new Set([
      ...node.interfaceDefinitions.map((definition) => definition.name),
      ...node.importedContracts.map((definition) => definition.name),
      node.contract.name,
    ]);
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.collections = new Set(node.collections.filter((c) => c.sorted).map((c) => c.name));
    this.collectionsByName = new Map(node.collections.map((collection) => [collection.name, collection]));
    this.structTypeNames = new Set(node.structDefinitions.map((definition) => definition.name));
    for (const collection of node.collections) {
      if (collection.innermostValueType instanceof StructType) {
        this.structTypeNames.add(collection.innermostValueType.name);
      }
    }
    this.functionsByName = new Map();
    for (const fn of node.functions) {
      const overloads = this.functionsByName.get(fn.name) ?? [];
      overloads.push(fn);
      this.functionsByName.set(fn.name, overloads);
    }
    // A helper-owned fixed event cannot be interleaved with the caller's runtime event stream. Compute a
    // conservative transitive name set before visiting any function so overloads and forward references behave
    // identically. Such calls remain fenced in a counter-loop handler until event context is threaded through
    // ordinary internal subroutines.
    this.eventfulFunctionNames = new Set();
    const bodyContains = (root: Node | undefined, predicate: (candidate: Node) => boolean): boolean => {
      if (!root) return false;
      let found = false;
      const walk = (candidate: Node): void => {
        if (found || predicate(candidate)) { found = true; return; }
        for (const key of Object.keys(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction') continue;
          const value = (candidate as unknown as Record<string, unknown>)[key];
          if (value instanceof Node) walk(value);
          else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
        }
      };
      walk(root);
      return found;
    };
    for (const fn of node.functions) {
      if (bodyContains(fn.body, (candidate) => candidate instanceof EmitStatementNode)) {
        this.eventfulFunctionNames.add(fn.name);
      }
    }
    let eventfulClosureChanged = true;
    while (eventfulClosureChanged) {
      eventfulClosureChanged = false;
      for (const fn of node.functions) {
        if (this.eventfulFunctionNames.has(fn.name)) continue;
        if (bodyContains(fn.body, (candidate) => candidate instanceof FunctionCallNode
          && this.eventfulFunctionNames.has(candidate.identifier.name))) {
          this.eventfulFunctionNames.add(fn.name);
          eventfulClosureChanged = true;
        }
      }
    }
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const added: ParameterNode[] = [];
    const runtimeCountCollections = new Set<string>();
    const prelude: StatementNode[] = [];
    const keySnapshotPrelude: StatementNode[] = [];
    // The compiler invokes this pass both before speculative admission and, when needed, before final codegen.
    // Hidden parameters are the durable marker that this function was already lowered. Do not inspect or mutate
    // the generated proof statements on the second pass.
    if (node.parameters.some((parameter) => parameter.name.startsWith(PREFIX))) return node;
    type CanonicalLoop = {
      logical: string;
      count: string;
      boundNames: string[];
      boundDefinitions: VariableDefinitionNode[];
      boundAssignments: AssignNode[];
      boundOffset: bigint;
      boundExpression?: ExpressionNode;
      start: bigint;
      step: bigint;
      stepExpression?: ExpressionNode;
      stepNames: string[];
      stepDefinitions: VariableDefinitionNode[];
      stepAssignments: AssignNode[];
      counterType: IntType;
      postTest: boolean;
      exactBound: boolean;
      sourceWhile: boolean;
      counterUpdate?: AssignNode;
      parent: BlockNode;
      pathConditions: Array<{ expression: ExpressionNode; negated: boolean }>;
      pathSupported: boolean;
    };
    const canonicalLoops = new Map<WhileNode | DoWhileNode, CanonicalLoop>();
    // Canonical-loop discovery runs before the general expression-valued ++/-- lowering. In statement position
    // the prefix/postfix result is discarded, so all four identifier forms have exactly the assignment semantics
    // consumed by this pass. Normalize only a requested counter name: increments of mapping values, array
    // elements, or unrelated locals remain for DesugarPostfixExpressions and retain their ordinary evaluation
    // rules.
    const normalizeDiscardedCounterUpdate = (
      statement: StatementNode | undefined, counter: string,
    ): AssignNode | undefined => {
      if (statement instanceof AssignNode) return statement;
      if (!(statement instanceof ExpressionStatementNode)
        || !(statement.expression instanceof UnaryOpNode)
        || !(statement.expression.expression instanceof IdentifierNode)
        || statement.expression.expression.name !== counter
        || ![UnaryOperator.POSTFIX_INCREMENT, UnaryOperator.PREFIX_INCREMENT,
          UnaryOperator.POSTFIX_DECREMENT, UnaryOperator.PREFIX_DECREMENT]
          .includes(statement.expression.operator)) return undefined;
      const unary = statement.expression;
      const increment = unary.operator === UnaryOperator.POSTFIX_INCREMENT
        || unary.operator === UnaryOperator.PREFIX_INCREMENT;
      const target = unary.expression as IdentifierNode;
      const read = new IdentifierNode(target.name);
      read.location = target.location;
      read.type = target.type;
      const one = new IntLiteralNode(1n);
      one.location = unary.location;
      const expression = new BinaryOpNode(
        read, increment ? BinaryOperator.PLUS : BinaryOperator.MINUS, one,
      );
      expression.location = unary.location;
      expression.type = unary.type ?? target.type;
      const identifier = new IdentifierNode(target.name);
      identifier.location = target.location;
      identifier.type = target.type;
      const assignment = new AssignNode(identifier, expression);
      assignment.location = statement.location;
      return assignment;
    };
    const findCanonicalLoops = (
      x: Node,
      pathConditions: Array<{ expression: ExpressionNode; negated: boolean }> = [],
      unsupportedControl = false,
    ): void => {
      if (x instanceof BranchNode) {
        findCanonicalLoops(
          x.ifBlock,
          [...pathConditions, { expression: x.condition, negated: false }],
          unsupportedControl,
        );
        if (x.elseBlock) {
          findCanonicalLoops(
            x.elseBlock,
            [...pathConditions, { expression: x.condition, negated: true }],
            unsupportedControl,
          );
        }
        return;
      }
      if (x instanceof SwitchNode) {
        // A source switch is a finite set of mutually exclusive predicates. Preserve its control decision in
        // the same replayable path metadata used for if/else: each explicit arm is `subject == value`, while
        // the default is the conjunction of all non-matches. Unsupported or mutation-dependent subjects still
        // fail closed later through runtimePathExpressionSupported/dependsOnLoopMutation.
        const matches = x.cases.map((candidate) => {
          const equality = new BinaryOpNode(
            cloneNode(x.expression), BinaryOperator.EQ, cloneNode(candidate.value),
          );
          equality.location = candidate.value.location ?? x.location;
          return equality;
        });
        for (let index = 0; index < x.cases.length; index += 1) {
          findCanonicalLoops(
            x.cases[index].body,
            [...pathConditions, { expression: matches[index], negated: false }],
            unsupportedControl,
          );
        }
        if (x.defaultCase) {
          findCanonicalLoops(
            x.defaultCase,
            [...pathConditions, ...matches.map((expression) => ({ expression, negated: true }))],
            unsupportedControl,
          );
        }
        return;
      }
      if (x instanceof TryCatchNode) {
        // BCH script failure aborts the transaction, so catch clauses are unreachable. Code generation emits
        // only the successful try body; discover counter loops in that same reachable domain.
        findCanonicalLoops(x.tryBlock, pathConditions, unsupportedControl);
        return;
      }
      if (x instanceof BlockNode) {
        const statements = x.statements ?? [];
        for (let index = 1; index < statements.length; index++) {
          const loop = statements[index];
          const variable = statements[index - 1];
          const loopCondition = (loop instanceof WhileNode || loop instanceof DoWhileNode)
            && loop.condition instanceof BinaryOpNode ? loop.condition : undefined;
          const counterOnLeft = variable instanceof VariableDefinitionNode
            && loopCondition?.left instanceof IdentifierNode
            && loopCondition.left.name === variable.name;
          const counterOnRight = variable instanceof VariableDefinitionNode
            && loopCondition?.right instanceof IdentifierNode
            && loopCondition.right.name === variable.name;
          const bound = counterOnLeft ? loopCondition?.right
            : counterOnRight ? loopCondition?.left : undefined;
          const visibleCounts = new Set(node.parameters
            .filter((parameter) => !parameter.name.startsWith('__internal__'))
            .map((parameter) => parameter.name));
          type BoundResolution = {
            count: string;
            countNames: string[];
            definitions: VariableDefinitionNode[];
            assignments: AssignNode[];
            offset: bigint;
            metadataExpression?: ExpressionNode;
          };
          const mutatesLocalName = (candidate: Node, name: string): boolean => {
            if (candidate instanceof AssignNode && candidate.identifier.name === name) return true;
            for (const [key, value] of Object.entries(candidate)) {
              if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
                || key === 'resolvedFunction' || key === 'functionReference' || key === 'collection'
                || key === 'stateVariable') continue;
              if (value instanceof Node && mutatesLocalName(value, name)) return true;
              if (Array.isArray(value)
                && value.some((item) => item instanceof Node && mutatesLocalName(item, name))) return true;
            }
            return false;
          };
          const substituteBoundName = (
            expression: ExpressionNode,
            name: string,
            replacement: ExpressionNode,
          ): ExpressionNode => {
            if (expression instanceof IdentifierNode && expression.name === name) return cloneNode(replacement);
            const expanded = cloneNode(expression) as ExpressionNode;
            for (const key of Object.keys(expanded)) {
              if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
                || key === 'resolvedFunction' || key === 'functionReference' || key === 'collection'
                || key === 'stateVariable' || key === 'identifier') continue;
              const value = (expanded as unknown as Record<string, unknown>)[key];
              if (value instanceof ExpressionNode) {
                (expanded as unknown as Record<string, unknown>)[key] = substituteBoundName(
                  value, name, replacement,
                );
              } else if (Array.isArray(value)) {
                (expanded as unknown as Record<string, unknown>)[key] = value.map((item) =>
                  item instanceof ExpressionNode ? substituteBoundName(item, name, replacement) : item);
              }
            }
            return expanded;
          };
          const resolveBound = (
            expression: ExpressionNode,
            before: number,
            seen = new Set<string>(),
          ): BoundResolution | undefined => {
            if (expression instanceof BinaryOpNode
              && (expression.operator === BinaryOperator.PLUS || expression.operator === BinaryOperator.MINUS)
              && expression.right instanceof IntLiteralNode) {
              const parent = resolveBound(expression.left, before, seen);
              if (!parent) return undefined;
              return {
                ...parent,
                offset: parent.offset + (expression.operator === BinaryOperator.PLUS
                  ? expression.right.value : -expression.right.value),
              };
            }
            if (expression instanceof BinaryOpNode
              && expression.operator === BinaryOperator.PLUS
              && expression.left instanceof IntLiteralNode) {
              const parent = resolveBound(expression.right, before, seen);
              if (!parent) return undefined;
              return { ...parent, offset: parent.offset + expression.left.value };
            }
            if (!(expression instanceof IdentifierNode)) return undefined;
            const { name } = expression;
            const assignments = statements.slice(0, before)
              .map((statement, position) => ({ statement, position }))
              .filter((candidate): candidate is { statement: AssignNode; position: number } =>
                candidate.statement instanceof AssignNode && candidate.statement.identifier.name === name);
            const latestAssignment = assignments.at(-1);
            if (latestAssignment) {
              const parent = resolveBound(
                latestAssignment.statement.expression, latestAssignment.position, seen,
              );
              return parent && {
                ...parent,
                assignments: [...parent.assignments, latestAssignment.statement],
              };
            }
            // A finite branch assignment needs the general expression resolver below so its post-join value is
            // represented as a ternary. Treating the original public parameter as unchanged here would later be
            // caught as a mutation, but would lose the branch expression required to make it admissible.
            if (statements.slice(0, before).some((statement) =>
              statement instanceof BranchNode && mutatesLocalName(statement, name))) return undefined;
            if (visibleCounts.has(name)) return {
              count: name, countNames: [name], definitions: [], assignments: [], offset: 0n,
            };
            if (seen.has(name)) return undefined;
            const definitions = statements.slice(0, before)
              .map((statement, position) => ({ statement, position }))
              .filter((candidate): candidate is { statement: VariableDefinitionNode; position: number } =>
                candidate.statement instanceof VariableDefinitionNode && candidate.statement.name === name);
            if (definitions.length !== 1 || definitions[0].statement.expression === undefined) return undefined;
            const parent = resolveBound(
              definitions[0].statement.expression,
              definitions[0].position,
              new Set(seen).add(name),
            );
            return parent && {
              count: parent.count,
              countNames: parent.countNames,
              definitions: [...parent.definitions, definitions[0].statement],
              assignments: parent.assignments,
              offset: parent.offset,
            };
          };
          const resolveGeneralBound = (
            expression: ExpressionNode,
            before: number,
            seen = new Set<string>(),
          ): {
            expression: ExpressionNode;
            counts: string[];
            definitions: VariableDefinitionNode[];
            assignments: AssignNode[];
          } | undefined => {
            if (expression instanceof IdentifierNode) {
              for (let position = before - 1; position >= 0; position -= 1) {
                const prior = statements[position];
                if (prior instanceof AssignNode && prior.identifier.name === expression.name) {
                  const resolved = resolveGeneralBound(prior.expression, position, seen);
                  return resolved && {
                    ...resolved,
                    assignments: [...resolved.assignments, prior],
                  };
                }
                if (prior instanceof BranchNode && mutatesLocalName(prior, expression.name)) {
                  const incoming = resolveGeneralBound(expression, position, seen);
                  const condition = resolveGeneralBound(prior.condition, position, seen);
                  if (!incoming || !condition) return undefined;
                  const replayArm = (arm: BlockNode | undefined): typeof incoming | undefined => {
                    let current = incoming;
                    for (const armStatement of arm?.statements ?? []) {
                      if (armStatement instanceof AssignNode
                        && armStatement.identifier.name === expression.name) {
                        const rhs = substituteBoundName(
                          armStatement.expression, expression.name, current.expression,
                        );
                        const resolved = resolveGeneralBound(rhs, position, seen);
                        if (!resolved) return undefined;
                        current = {
                          expression: resolved.expression,
                          counts: [...new Set([...current.counts, ...resolved.counts])],
                          definitions: [...new Set([...current.definitions, ...resolved.definitions])],
                          assignments: [...new Set([
                            ...current.assignments, ...resolved.assignments, armStatement,
                          ])],
                        };
                      } else if (mutatesLocalName(armStatement, expression.name)) {
                        return undefined;
                      }
                    }
                    return current;
                  };
                  const ifValue = replayArm(prior.ifBlock);
                  const elseValue = replayArm(prior.elseBlock);
                  if (!ifValue || !elseValue) return undefined;
                  const merged = new TernaryOpNode(
                    condition.expression, ifValue.expression, elseValue.expression,
                  );
                  merged.location = prior.location;
                  merged.type = expression.type ?? ifValue.expression.type ?? elseValue.expression.type;
                  return {
                    expression: merged,
                    counts: [...new Set([...condition.counts, ...ifValue.counts, ...elseValue.counts])],
                    definitions: [...new Set([
                      ...condition.definitions, ...ifValue.definitions, ...elseValue.definitions,
                    ])],
                    assignments: [...new Set([
                      ...condition.assignments, ...ifValue.assignments, ...elseValue.assignments,
                    ])],
                  };
                }
              }
              if (visibleCounts.has(expression.name)) return {
                expression: cloneNode(expression), counts: [expression.name], definitions: [], assignments: [],
              };
              if (seen.has(expression.name)) return undefined;
              const definitions = statements.slice(0, before)
                .map((statement, position) => ({ statement, position }))
                .filter((candidate): candidate is { statement: VariableDefinitionNode; position: number } =>
                  candidate.statement instanceof VariableDefinitionNode
                  && candidate.statement.name === expression.name);
              if (definitions.length !== 1 || definitions[0].statement.expression === undefined) return undefined;
              const resolved = resolveGeneralBound(
                definitions[0].statement.expression,
                definitions[0].position,
                new Set(seen).add(expression.name),
              );
              return resolved && {
                ...resolved, definitions: [...resolved.definitions, definitions[0].statement],
              };
            }
            if (expression instanceof LiteralNode) return {
              expression: cloneNode(expression), counts: [], definitions: [], assignments: [],
            };
            if (expression instanceof CastNode || expression instanceof UnaryOpNode) {
              const resolved = resolveGeneralBound(expression.expression, before, seen);
              if (!resolved) return undefined;
              const expanded = cloneNode(expression);
              expanded.expression = resolved.expression;
              return { ...resolved, expression: expanded };
            }
            if (expression instanceof BinaryOpNode) {
              const left = resolveGeneralBound(expression.left, before, seen);
              const right = resolveGeneralBound(expression.right, before, seen);
              if (!left || !right) return undefined;
              const expanded = cloneNode(expression);
              expanded.left = left.expression;
              expanded.right = right.expression;
              return {
                expression: expanded,
                counts: [...new Set([...left.counts, ...right.counts])],
                definitions: [...new Set([...left.definitions, ...right.definitions])],
                assignments: [...new Set([...left.assignments, ...right.assignments])],
              };
            }
            if (expression instanceof TernaryOpNode) {
              const condition = resolveGeneralBound(expression.condition, before, seen);
              const ifTrue = resolveGeneralBound(expression.ifTrue, before, seen);
              const ifFalse = resolveGeneralBound(expression.ifFalse, before, seen);
              if (!condition || !ifTrue || !ifFalse) return undefined;
              const expanded = cloneNode(expression);
              expanded.condition = condition.expression;
              expanded.ifTrue = ifTrue.expression;
              expanded.ifFalse = ifFalse.expression;
              return {
                expression: expanded,
                counts: [...new Set([...condition.counts, ...ifTrue.counts, ...ifFalse.counts])],
                definitions: [...new Set([
                  ...condition.definitions, ...ifTrue.definitions, ...ifFalse.definitions,
                ])],
                assignments: [...new Set([
                  ...condition.assignments, ...ifTrue.assignments, ...ifFalse.assignments,
                ])],
              };
            }
            return undefined;
          };
          let boundResolution = bound instanceof IdentifierNode
            ? resolveBound(bound, index - 1) : undefined;
          if (!boundResolution && bound instanceof ExpressionNode) {
            const general = resolveGeneralBound(bound, index - 1);
            if (general && general.counts.length > 0) boundResolution = {
              count: general.counts[0],
              countNames: general.counts,
              definitions: general.definitions,
              assignments: general.assignments,
              offset: 0n,
              metadataExpression: general.expression,
            };
          }
          if (!(loop instanceof WhileNode || loop instanceof DoWhileNode)
            || !(variable instanceof VariableDefinitionNode)
            || !(loop.condition instanceof BinaryOpNode)
            || (!counterOnLeft && !counterOnRight)
            || boundResolution === undefined) continue;
          const comparisonOperator = counterOnLeft ? loop.condition.operator : ({
            [BinaryOperator.LT]: BinaryOperator.GT,
            [BinaryOperator.LE]: BinaryOperator.GE,
            [BinaryOperator.GT]: BinaryOperator.LT,
            [BinaryOperator.GE]: BinaryOperator.LE,
            [BinaryOperator.NE]: BinaryOperator.NE,
          } as Partial<Record<BinaryOperator, BinaryOperator>>)[loop.condition.operator];
          if (comparisonOperator === undefined) continue;
          const updateIndex = (loop.block.statements?.length ?? 0) - 1;
          const update = normalizeDiscardedCounterUpdate(
            loop.block.statements?.[updateIndex], variable.name,
          );
          if (update && loop.block.statements && loop.block.statements[updateIndex] !== update) {
            loop.block.statements[updateIndex] = update;
          }
          const updateExpression = update instanceof AssignNode && update.identifier.name === variable.name
            && update.expression instanceof BinaryOpNode ? update.expression : undefined;
          const updateCounterOnLeft = updateExpression?.left instanceof IdentifierNode
            && updateExpression.left.name === variable.name;
          const updateCounterOnRight = updateExpression?.operator === BinaryOperator.PLUS
            && updateExpression.right instanceof IdentifierNode
            && updateExpression.right.name === variable.name;
          const updateOperator = updateExpression
            && (updateExpression.operator === BinaryOperator.PLUS
              || updateExpression.operator === BinaryOperator.MINUS)
            && (updateCounterOnLeft || updateCounterOnRight) ? updateExpression.operator : undefined;
          const updateMagnitude = updateOperator !== undefined && updateExpression
            ? (updateCounterOnLeft ? updateExpression.right : updateExpression.left) : undefined;
          const literalStep = updateMagnitude instanceof IntLiteralNode
            ? (updateOperator === BinaryOperator.PLUS
              ? updateMagnitude.value : -updateMagnitude.value) : undefined;
          const resolvedRuntimeStep = updateMagnitude && !(updateMagnitude instanceof IntLiteralNode)
            ? resolveGeneralBound(updateMagnitude, index) : undefined;
          const runtimeStep = resolvedRuntimeStep && updateOperator !== undefined
            ? (updateOperator === BinaryOperator.PLUS
              ? resolvedRuntimeStep.expression
              : Object.assign(new BinaryOpNode(
                new IntLiteralNode(0n), BinaryOperator.MINUS, resolvedRuntimeStep.expression,
              ), { location: updateExpression?.location }))
            : undefined;
          const directionalStep = literalStep ?? (runtimeStep
            ? (updateOperator === BinaryOperator.PLUS ? 1n : -1n) : undefined);
          const progressionUpdate = literalStep !== undefined && literalStep === variable.loopStepValue;
          const comparisonAdvances = directionalStep !== undefined && (
            (directionalStep > 0n && (comparisonOperator === BinaryOperator.LT
              || comparisonOperator === BinaryOperator.LE || comparisonOperator === BinaryOperator.NE))
            || (directionalStep < 0n && (comparisonOperator === BinaryOperator.GT
              || comparisonOperator === BinaryOperator.GE || comparisonOperator === BinaryOperator.NE))
          );
          const sourceWhile = loop instanceof WhileNode && variable.isLoopVariable !== true
            && loop.forLoopUpdateCount === 0;
          const preTest = loop instanceof WhileNode
            && variable.expression instanceof IntLiteralNode
            && directionalStep !== undefined && directionalStep !== 0n
            && ((variable.isLoopVariable === true && loop.forLoopUpdateCount === 1) || sourceWhile)
            && (runtimeStep !== undefined || progressionUpdate || (sourceWhile && literalStep !== undefined))
            && comparisonAdvances;
          const postTest = loop instanceof DoWhileNode
            && variable.expression instanceof IntLiteralNode
            && directionalStep !== undefined && directionalStep !== 0n && comparisonAdvances;
          if (!preTest && !postTest) continue;
          // The rest of the lowering proves an exclusive half-open progression. Integer `i <= bound` is exactly
          // `i < bound + 1`, and descending `i >= bound` is `i > bound - 1`. Normalize the replayed bound once so
          // the SDK, permutation proof, event worklist, and source loop all describe the same inclusive endpoint.
          const inclusiveAdjustment = comparisonOperator === BinaryOperator.LE ? 1n
            : comparisonOperator === BinaryOperator.GE ? -1n : 0n;
          if (inclusiveAdjustment !== 0n) {
            if (boundResolution.metadataExpression) {
              const adjusted = new BinaryOpNode(
                boundResolution.metadataExpression,
                inclusiveAdjustment > 0n ? BinaryOperator.PLUS : BinaryOperator.MINUS,
                new IntLiteralNode(1n),
              );
              adjusted.location = loop.condition.location;
              boundResolution = { ...boundResolution, metadataExpression: adjusted };
            } else {
              boundResolution = {
                ...boundResolution, offset: boundResolution.offset + inclusiveAdjustment,
              };
            }
          }
          const assignedBoundNames = new Set(boundResolution.assignments.map((assignment) =>
            assignment.identifier.name));
          const boundDefinitions = [...new Set([
            ...boundResolution.definitions,
            ...statements.slice(0, index).filter((statement): statement is VariableDefinitionNode =>
              statement instanceof VariableDefinitionNode && assignedBoundNames.has(statement.name)),
          ])];
          canonicalLoops.set(loop, {
            logical: variable.name,
            count: boundResolution.count,
            boundNames: [
              ...boundResolution.countNames,
              ...boundDefinitions.map((definition) => definition.name),
              ...boundResolution.assignments.map((assignment) => assignment.identifier.name),
            ],
            boundDefinitions,
            boundAssignments: boundResolution.assignments,
            boundOffset: boundResolution.offset,
            ...(boundResolution.metadataExpression
              && { boundExpression: boundResolution.metadataExpression }),
            start: (variable.expression as IntLiteralNode).value,
            step: directionalStep,
            ...(runtimeStep && { stepExpression: runtimeStep }),
            stepNames: resolvedRuntimeStep ? [
              ...resolvedRuntimeStep.counts,
              ...resolvedRuntimeStep.definitions.map((definition) => definition.name),
              ...resolvedRuntimeStep.assignments.map((assignment) => assignment.identifier.name),
            ] : [],
            stepDefinitions: resolvedRuntimeStep?.definitions ?? [],
            stepAssignments: resolvedRuntimeStep?.assignments ?? [],
            counterType: variable.type instanceof IntType ? variable.type : new IntType(true, 256),
            postTest,
            exactBound: comparisonOperator === BinaryOperator.NE,
            sourceWhile,
            counterUpdate: update as AssignNode,
            parent: x,
            pathConditions,
            pathSupported: !unsupportedControl,
          });
        }
      }
      const childUnsupported = unsupportedControl || x instanceof WhileNode || x instanceof DoWhileNode;
      for (const key of Object.keys(x)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
        const value = (x as unknown as Record<string, unknown>)[key];
        if (value instanceof Node) findCanonicalLoops(value, pathConditions, childUnsupported);
        else if (Array.isArray(value)) {
          for (const item of value) if (item instanceof Node) {
            findCanonicalLoops(item, pathConditions, childUnsupported);
          }
        }
      }
    };
    findCanonicalLoops(node.body);
    this.normalizeImmutableDefaultArrayKeys(
      node,
      canonicalLoops,
    );
    const isWrite = (s: Node): s is ArrayAssignNode | ArrayDeleteNode | MappingAssignNode | MappingDeleteNode
    | MappingFieldAssignNode =>
      s instanceof ArrayAssignNode || s instanceof ArrayDeleteNode
      || s instanceof MappingAssignNode || s instanceof MappingDeleteNode
      || s instanceof MappingFieldAssignNode;
    const counterKeyIndex = (
      write: ArrayAssignNode | ArrayDeleteNode | MappingAssignNode | MappingDeleteNode | MappingFieldAssignNode,
      logical: string,
    ): number => {
      if (write instanceof ArrayAssignNode || write instanceof ArrayDeleteNode) {
        return containsIdentifier(write.index, logical) ? 0 : -1;
      }
      return write.keys.findIndex((key) => containsIdentifier(key, logical));
    };
    const hasObservableEffect = (x: Node): boolean => {
      if (x instanceof FunctionCallNode) {
        const overloads = this.functionsByName.get(x.identifier.name);
        const pureContractCall = overloads !== undefined && overloads.length > 0
          && overloads.every((fn) => fn.modifiers.includes(FunctionModifier.PURE));
        // These builtins are total stack computations with no route-owned inputs or outputs. Calls to a
        // contract function are admitted only when every same-name overload is explicitly pure; semantic
        // analysis later enforces that declaration. Unknown, view, side-car and external calls remain fenced.
        const pureBuiltin = overloads === undefined && PURE_COUNTER_VALUE_BUILTINS.has(x.identifier.name);
        const pureStructConstructor = this.structTypeNames.has(x.identifier.name);
        if (!pureContractCall && !pureBuiltin && !pureStructConstructor) return true;
      } else if (x instanceof FunctionCallStatementNode
        || x instanceof MethodCallNode || x instanceof MethodCallStatementNode
        || x instanceof ExternalFunctionCallNode || x instanceof TransferStatementNode
        || x instanceof AddressTransferStatementNode || x instanceof AddressSendExpressionNode
        || x instanceof EmitStatementNode) return true;
      for (const key of Object.keys(x)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
        const v = (x as unknown as Record<string, unknown>)[key];
        if (v instanceof Node && hasObservableEffect(v)) return true;
        if (Array.isArray(v) && v.some((e) => e instanceof Node && hasObservableEffect(e))) return true;
      }
      return false;
    };
    // The message-bus effect frame has one fixed window per OUTER message row. Reaching the same emit/transfer
    // site N times in this inner runtime loop would therefore address one slot N times, while the SDK can only
    // materialize the statically declared site once. Typed external calls are different: their call manifest
    // already carries a runtime occurrence loop, so leave those in source order. Ordinary explicitly-pure
    // helpers and resource-free builtins are also safe, but calls with unknown/effectful bodies fail closed.
    const hasUnjournalledRepeatedEffect = (
      x: Node,
      runtimeEmits: ReadonlySet<EmitStatementNode>,
      runtimeTransfers: ReadonlySet<Node>,
    ): boolean => {
      if (x instanceof TryCatchNode) {
        return hasUnjournalledRepeatedEffect(x.expression, runtimeEmits, runtimeTransfers)
          || hasUnjournalledRepeatedEffect(x.tryBlock, runtimeEmits, runtimeTransfers);
      }
      // The whole typed-call node, including its interface/address projection, is represented by the manifest.
      // Do not descend into that projection: it contains method-call-shaped syntax which is not a direct effect.
      if (x instanceof ExternalFunctionCallNode) return false;
      if (x instanceof MethodCallNode && x.object instanceof FunctionCallNode
        && this.externalTypeNames.has(x.object.identifier.name)) return false;
      if (x instanceof MethodCallStatementNode && (x.expression instanceof ExternalFunctionCallNode
        || (x.call.object instanceof FunctionCallNode
          && this.externalTypeNames.has(x.call.object.identifier.name)))) return false;
      if (x instanceof EmitStatementNode) {
        if (!runtimeEmits.has(x)) return true;
        // Returning helpers are inlined before this pass: their effects and result definition remain immediately
        // before the emit in the source-order physical loop. A surviving effectful call in the argument itself is
        // still unsafe, but consuming the already-computed local does not duplicate or permute that effect.
        return x.args.some((arg) => hasObservableEffect(arg));
      }
      if (x instanceof TransferStatementNode) {
        if (!runtimeTransfers.has(x)) return true;
        return hasObservableEffect(x.lockingBytecode) || hasObservableEffect(x.amount);
      }
      if (x instanceof AddressTransferStatementNode || x instanceof AddressSendExpressionNode
        || x instanceof MethodCallNode || x instanceof MethodCallStatementNode) return true;
      if (x instanceof TokenContainerMethodStatementNode) {
        if (!runtimeTransfers.has(x)
          || (x.methodName !== 'transfer' && x.methodName !== 'transferNft')) return true;
        return x.args.some((arg) => hasObservableEffect(arg))
          || hasObservableEffect(x.tokenContainerKeyExpression);
      }
      if (x instanceof FunctionCallNode) return hasObservableEffect(x);
      if (x instanceof FunctionCallStatementNode) return hasObservableEffect(x);
      for (const key of Object.keys(x)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
          || key === 'resolvedFunction') continue;
        const value = (x as unknown as Record<string, unknown>)[key];
        if (value instanceof Node
          && hasUnjournalledRepeatedEffect(value, runtimeEmits, runtimeTransfers)) return true;
        if (Array.isArray(value)
          && value.some((item) => item instanceof Node
            && hasUnjournalledRepeatedEffect(item, runtimeEmits, runtimeTransfers))) return true;
      }
      return false;
    };
    const keyExpressions = (
      write: ArrayAssignNode | ArrayDeleteNode | MappingAssignNode | MappingDeleteNode | MappingFieldAssignNode,
    ): ExpressionNode[] => write instanceof ArrayAssignNode || write instanceof ArrayDeleteNode
      ? [write.index] : write.keys;
    const containsIdentifier = (x: Node, name: string): boolean => {
      if (x instanceof IdentifierNode && x.name === name) return true;
      for (const key of Object.keys(x)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
        const value = (x as unknown as Record<string, unknown>)[key];
        if (value instanceof Node && containsIdentifier(value, name)) return true;
        if (Array.isArray(value)
          && value.some((item) => item instanceof Node && containsIdentifier(item, name))) return true;
      }
      return false;
    };
    // One physical-order witness can serve multiple collection writes only when all of them hash the same key
    // tuple. Collection identity lives in the entry locking bytecode, not in the slot hash, so `a[i]` + `b[i]`
    // is safe while `a[k][i]` + `b[l][i]` is not. Keep this deliberately structural and conservative: semantic
    // metadata is ignored, but every source-level expression field contributes to the shape.
    const expressionShape = (root: Node): string => {
      const seen = new Set<Node>();
      const valueShape = (value: unknown): string => {
        if (value instanceof Node) return nodeShape(value);
        if (value instanceof Uint8Array) return `bytes:${[...value].join(',')}`;
        if (Array.isArray(value)) return `[${value.map(valueShape).join(',')}]`;
        if (typeof value === 'bigint') return `bigint:${value.toString()}`;
        if (value === null || value === undefined || typeof value === 'string'
          || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
        return typeof value;
      };
      const nodeShape = (value: Node): string => {
        if (seen.has(value)) return `${value.constructor.name}:cycle`;
        seen.add(value);
        const record = value as unknown as Record<string, unknown>;
        const fields = Object.keys(value)
          .filter((key) => key !== 'location' && key !== 'definition' && key !== 'symbol' && key !== 'type'
            && key !== 'collection' && key !== 'stateVariable' && record[key] !== undefined)
          .sort()
          .map((key) => `${key}=${valueShape(record[key])}`);
        seen.delete(value);
        return `${value.constructor.name}{${fields.join(';')}}`;
      };
      return nodeShape(root);
    };
    // Compare source-while continuation updates by their logical delta, not their surface spelling. Addition is
    // commutative (`i = stride + i` and `i = i + stride`), and discarded ++ has already normalized to `i + 1`.
    // Subtraction remains directional: only `i = i - stride` is a canonical counter step.
    const counterUpdateStepShape = (expression: ExpressionNode, counter: string): string | undefined => {
      if (!(expression instanceof BinaryOpNode)) return undefined;
      if (expression.operator === BinaryOperator.PLUS) {
        if (expression.left instanceof IdentifierNode && expression.left.name === counter) {
          return `plus:${expressionShape(expression.right)}`;
        }
        if (expression.right instanceof IdentifierNode && expression.right.name === counter) {
          return `plus:${expressionShape(expression.left)}`;
        }
      }
      if (expression.operator === BinaryOperator.MINUS
        && expression.left instanceof IdentifierNode && expression.left.name === counter) {
        return `minus:${expressionShape(expression.right)}`;
      }
      return undefined;
    };
    const writeKeyShape = (
      write: ArrayAssignNode | ArrayDeleteNode | MappingAssignNode | MappingDeleteNode | MappingFieldAssignNode,
    ): string => keyExpressions(write).map(expressionShape).join('|');
    const isCounterWriteLoop = (loop: WhileNode | DoWhileNode, logical: string): boolean => {
      let found = false;
      const walk = (x: Node): void => {
        if (found || (x !== loop.block && (x instanceof WhileNode || x instanceof DoWhileNode))) return;
        if (isWrite(x) && this.collections.has(x.name) && counterKeyIndex(x, logical) >= 0) {
          found = true;
          return;
        }
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node) walk(value);
          else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
        }
      };
      walk(loop.block);
      return found;
    };
    // Analyze every candidate before mutating the AST. This keeps the lowering transactional: one unsupported
    // loop cannot leak an unused compiler-owned permutation into an otherwise ordinary ABI.
    const counterWriteLoops = [...canonicalLoops].filter(([loop, canonical]) =>
      isCounterWriteLoop(loop, canonical.logical));
    const visibleParameters = node.parameters.filter((parameter) =>
      !parameter.name.startsWith('__internal__'));
    const publicParameterNames = new Set(visibleParameters.map((parameter) => parameter.name));
    const emptyBody = new BlockNode([]);
    const substitutesIdentifier = (
      expression: ExpressionNode,
      name: string,
      replacement: ExpressionNode,
    ): ExpressionNode => {
      if (expression instanceof IdentifierNode && expression.name === name) return cloneNode(replacement);
      const expanded = cloneNode(expression) as ExpressionNode;
      for (const key of Object.keys(expanded)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
          || key === 'resolvedFunction' || key === 'functionReference' || key === 'collection'
          || key === 'stateVariable' || key === 'identifier') continue;
        const value = (expanded as unknown as Record<string, unknown>)[key];
        if (value instanceof ExpressionNode) {
          (expanded as unknown as Record<string, unknown>)[key] = substitutesIdentifier(value, name, replacement);
        } else if (Array.isArray(value)) {
          (expanded as unknown as Record<string, unknown>)[key] = value.map((item) =>
            item instanceof ExpressionNode ? substitutesIdentifier(item, name, replacement) : item);
        }
      }
      return expanded;
    };
    const mutatesIdentifier = (candidate: Node, name: string): boolean => {
      if (candidate instanceof AssignNode && candidate.identifier.name === name) return true;
      for (const key of Object.keys(candidate)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
          || key === 'resolvedFunction' || key === 'functionReference' || key === 'collection'
          || key === 'stateVariable') continue;
        const value = (candidate as unknown as Record<string, unknown>)[key];
        if (value instanceof Node && mutatesIdentifier(value, name)) return true;
        if (Array.isArray(value)
          && value.some((item) => item instanceof Node && mutatesIdentifier(item, name))) return true;
      }
      return false;
    };
    /**
     * Replay a pure expression at a dominating source boundary in terms of function-entry arguments. The latest
     * assignment/definition wins. A finite `if` join is represented as a ternary when each arm contains only
     * straight-line assignments to the requested value; nested control and loop-carried assignments still fail
     * closed because they require a wider path environment.
     */
    const entryExpressionAt = (
      expression: ExpressionNode,
      parent: BlockNode,
      before: number,
      resolving = new Set<string>(),
    ): ExpressionNode | undefined => {
      if (expression instanceof IdentifierNode) {
        const statements = parent.statements ?? [];
        for (let index = before - 1; index >= 0; index -= 1) {
          const statement = statements[index];
          if (statement instanceof BranchNode && mutatesIdentifier(statement, expression.name)) {
            const marker = `${expression.name}@branch:${index}`;
            if (resolving.has(marker)) return undefined;
            const nextResolving = new Set(resolving).add(marker);
            const incoming = entryExpressionAt(expression, parent, index, nextResolving);
            const condition = entryExpressionAt(statement.condition, parent, index, nextResolving);
            if (!incoming || !condition) return undefined;
            const replayArm = (arm: BlockNode | undefined): ExpressionNode | undefined => {
              let current = cloneNode(incoming) as ExpressionNode;
              for (const armStatement of arm?.statements ?? []) {
                if (armStatement instanceof AssignNode && armStatement.identifier.name === expression.name) {
                  const rhs = substitutesIdentifier(armStatement.expression, expression.name, current);
                  const replayed = entryExpressionAt(rhs, parent, index, nextResolving);
                  if (!replayed) return undefined;
                  current = replayed;
                } else if (mutatesIdentifier(armStatement, expression.name)) {
                  return undefined;
                }
              }
              return current;
            };
            const ifValue = replayArm(statement.ifBlock);
            const elseValue = replayArm(statement.elseBlock);
            if (!ifValue || !elseValue) return undefined;
            const merged = new TernaryOpNode(condition, ifValue, elseValue);
            merged.location = statement.location;
            merged.type = expression.type ?? ifValue.type ?? elseValue.type;
            return merged;
          }
          const assigned = statement instanceof AssignNode && statement.identifier.name === expression.name
            ? statement.expression
            : statement instanceof VariableDefinitionNode && statement.name === expression.name
              ? statement.expression : undefined;
          if (!assigned) continue;
          const marker = `${expression.name}@${index}`;
          if (resolving.has(marker)) return undefined;
          return entryExpressionAt(assigned, parent, index, new Set(resolving).add(marker));
        }
        return publicParameterNames.has(expression.name) ? cloneNode(expression) : undefined;
      }
      if (expression instanceof FunctionCallNode) {
        const pure = PURE_COUNTER_VALUE_BUILTINS.has(expression.identifier.name)
          || expression.resolvedFunction?.modifiers.includes(FunctionModifier.PURE) === true;
        if (!pure) return undefined;
        const parameters = expression.parameters.map((parameter) =>
          entryExpressionAt(parameter, parent, before, resolving));
        if (parameters.some((parameter) => parameter === undefined)) return undefined;
        const expanded = cloneNode(expression);
        expanded.parameters = parameters as ExpressionNode[];
        return expanded;
      }
      const expanded = cloneNode(expression);
      for (const key of Object.keys(expanded)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
          || key === 'resolvedFunction' || key === 'functionReference' || key === 'collection'
          || key === 'stateVariable' || key === 'identifier') continue;
        const value = (expanded as unknown as Record<string, unknown>)[key];
        if (value instanceof ExpressionNode) {
          const replacement = entryExpressionAt(value, parent, before, resolving);
          if (!replacement) return undefined;
          (expanded as unknown as Record<string, unknown>)[key] = replacement;
        } else if (Array.isArray(value)) {
          const replacements = value.map((item) => item instanceof ExpressionNode
            ? entryExpressionAt(item, parent, before, resolving) : item);
          if (replacements.some((item) => item === undefined)) return undefined;
          (expanded as unknown as Record<string, unknown>)[key] = replacements;
        }
      }
      return expanded;
    };
    const runtimePathMutatedState = new Set<string>();
    const collectRuntimePathMutations = (candidate: Node): void => {
      if (candidate instanceof StateAssignNode || candidate instanceof StateArrayAssignNode
        || candidate instanceof StateArrayDeleteNode || candidate instanceof StateArrayPopNode
        || candidate instanceof StateArrayPushNode || isWrite(candidate)) {
        runtimePathMutatedState.add(candidate.name);
      }
      for (const [key, value] of Object.entries(candidate)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
          || key === 'resolvedFunction') continue;
        if (value instanceof Node) collectRuntimePathMutations(value);
        else if (Array.isArray(value)) {
          for (const item of value) if (item instanceof Node) collectRuntimePathMutations(item);
        }
      }
    };
    collectRuntimePathMutations(node.body);
    const runtimePathLocalInitializer = (name: string): ExpressionNode | undefined => {
      const definitions: VariableDefinitionNode[] = [];
      let reassigned = false;
      const find = (candidate: Node): void => {
        if (candidate instanceof VariableDefinitionNode && candidate.name === name) {
          definitions.push(candidate);
        } else if (candidate instanceof AssignNode && candidate.identifier.name === name) {
          reassigned = true;
        }
        for (const [key, value] of Object.entries(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction') continue;
          if (value instanceof Node) find(value);
          else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) find(item);
        }
      };
      find(node.body);
      return !reassigned && definitions.length === 1 ? definitions[0].expression : undefined;
    };
    const containsNode = (root: Node, target: Node): boolean => {
      if (root === target) return true;
      for (const [key, value] of Object.entries(root)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
          || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
        if (value instanceof Node && containsNode(value, target)) return true;
        if (Array.isArray(value)
          && value.some((item) => item instanceof Node && containsNode(item, target))) return true;
      }
      return false;
    };
    const dominantStateValues = (target: WhileNode | DoWhileNode): Map<string, ExpressionNode> => {
      const composeStateReads = (
        expression: ExpressionNode,
        current: ReadonlyMap<string, ExpressionNode>,
        resolving = new Set<string>(),
      ): ExpressionNode => {
        if (expression instanceof StateAccessNode && current.has(expression.name)
          && !resolving.has(expression.name)) {
          return composeStateReads(
            cloneNode(current.get(expression.name)!) as ExpressionNode,
            current,
            new Set(resolving).add(expression.name),
          );
        }
        const composed = cloneNode(expression) as ExpressionNode;
        for (const [key, value] of Object.entries(composed)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof ExpressionNode) {
            (composed as unknown as Record<string, unknown>)[key] = composeStateReads(
              value, current, resolving,
            );
          } else if (Array.isArray(value)) {
            (composed as unknown as Record<string, unknown>)[key] = value.map((item) =>
              item instanceof ExpressionNode ? composeStateReads(item, current, resolving) : item);
          }
        }
        return composed;
      };
      const scalarStateMutations = (root: Node): Set<string> => {
        const names = new Set<string>();
        const collect = (candidate: Node): void => {
          if (candidate instanceof StateAssignNode) names.add(candidate.name);
          for (const [key, value] of Object.entries(candidate)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
              || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
            if (value instanceof Node) collect(value);
            else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) collect(item);
          }
        };
        collect(root);
        return names;
      };
      const stateAccess = (name: string, root: Node): StateAccessNode => {
        const access = new StateAccessNode(name);
        const find = (candidate: Node): StateAssignNode | undefined => {
          if (candidate instanceof StateAssignNode && candidate.name === name) return candidate;
          for (const [key, value] of Object.entries(candidate)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
              || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
            if (value instanceof Node) {
              const found = find(value);
              if (found) return found;
            } else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) {
              const found = find(item);
              if (found) return found;
            }
          }
          return undefined;
        };
        const assignment = find(root);
        access.location = assignment?.location ?? root.location;
        access.stateVariable = assignment?.stateVariable;
        access.type = assignment?.stateVariable?.type;
        return access;
      };
      const mutatesNonScalarState = (root: Node, name: string): boolean => {
        if ((root instanceof StateArrayAssignNode || root instanceof StateArrayDeleteNode
          || root instanceof StateArrayPushNode || root instanceof StateArrayPopNode || isWrite(root))
          && root.name === name) return true;
        for (const [key, value] of Object.entries(root)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof Node && mutatesNonScalarState(value, name)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && mutatesNonScalarState(item, name))) return true;
        }
        return false;
      };
      function replayScalarState(
        name: string,
        block: BlockNode | undefined,
        incoming: ReadonlyMap<string, ExpressionNode>,
        source: Node,
      ): ExpressionNode | undefined {
        const current = new Map(incoming);
        if (!current.has(name)) current.set(name, stateAccess(name, source));
        for (const statement of block?.statements ?? []) {
          if (statement instanceof StateAssignNode) {
            current.set(statement.name, composeStateReads(statement.expression, current));
            continue;
          }
          if (statement instanceof BranchNode) {
            if (!scalarStateMutations(statement).has(name)) continue;
            if (mutatesNonScalarState(statement, name)) return undefined;
            const condition = composeStateReads(statement.condition, current);
            const ifValue = replayScalarState(name, statement.ifBlock, current, statement);
            const elseValue = replayScalarState(name, statement.elseBlock, current, statement);
            if (!ifValue || !elseValue) return undefined;
            const merged = new TernaryOpNode(condition, ifValue, elseValue);
            merged.location = statement.location;
            merged.type = ifValue.type ?? elseValue.type;
            current.set(name, merged);
            continue;
          }
          if (statement instanceof SwitchNode) {
            if (!scalarStateMutations(statement).has(name)) continue;
            if (mutatesNonScalarState(statement, name)) return undefined;
            const selected = composeStateReads(statement.expression, current);
            const defaultValue = replayScalarState(name, statement.defaultCase, current, statement);
            if (!defaultValue) return undefined;
            let merged: ExpressionNode = defaultValue;
            for (const arm of [...statement.cases].reverse()) {
              const armValue = replayScalarState(name, arm.body, current, statement);
              if (!armValue) return undefined;
              const condition = new BinaryOpNode(
                cloneNode(selected), BinaryOperator.EQ, cloneNode(arm.value),
              );
              condition.location = arm.value.location ?? statement.location;
              const next = new TernaryOpNode(condition, armValue, merged);
              next.location = statement.location;
              next.type = armValue.type ?? merged.type;
              merged = next;
            }
            current.set(name, merged);
            continue;
          }
          // A value crossing an abrupt or iterative control-flow boundary needs a path phi rather than a
          // straight-line ternary. Leave it unknown until that wider representation exists.
          if ((statement instanceof TryCatchNode || statement instanceof WhileNode || statement instanceof DoWhileNode
            || statement instanceof ReturnNode || statement instanceof BreakNode
            || statement instanceof ContinueNode) && scalarStateMutations(statement).has(name)) return undefined;
          if (mutatesNonScalarState(statement, name)) return undefined;
        }
        return current.get(name);
      }
      const search = (
        root: Node,
        incoming: Map<string, ExpressionNode>,
      ): Map<string, ExpressionNode> | undefined => {
        if (root === target) return new Map(incoming);
        if (root instanceof BlockNode) {
          const current = new Map(incoming);
          for (const statement of root.statements ?? []) {
            if (statement === target) return new Map(current);
            if (containsNode(statement, target)) return search(statement, current);
            if (statement instanceof StateAssignNode) {
              current.set(statement.name, composeStateReads(statement.expression, current));
            } else if (statement instanceof BranchNode) {
              const mutations = scalarStateMutations(statement);
              const branchIncoming = new Map(current);
              const mergedValues = new Map<string, ExpressionNode>();
              for (const name of mutations) {
                if (mutatesNonScalarState(statement, name)) {
                  current.delete(name);
                  continue;
                }
                const condition = composeStateReads(statement.condition, branchIncoming);
                const ifValue = replayScalarState(name, statement.ifBlock, branchIncoming, statement);
                const elseValue = replayScalarState(name, statement.elseBlock, branchIncoming, statement);
                if (!ifValue || !elseValue) {
                  current.delete(name);
                  continue;
                }
                const merged = new TernaryOpNode(condition, ifValue, elseValue);
                merged.location = statement.location;
                merged.type = ifValue.type ?? elseValue.type;
                mergedValues.set(name, merged);
              }
              for (const [name, value] of mergedValues) current.set(name, value);
            } else if (statement instanceof SwitchNode) {
              const mutations = scalarStateMutations(statement);
              const switchIncoming = new Map(current);
              const selected = composeStateReads(statement.expression, switchIncoming);
              const mergedValues = new Map<string, ExpressionNode>();
              for (const name of mutations) {
                if (mutatesNonScalarState(statement, name)) {
                  current.delete(name);
                  continue;
                }
                const defaultValue = replayScalarState(name, statement.defaultCase, switchIncoming, statement);
                if (!defaultValue) {
                  current.delete(name);
                  continue;
                }
                let merged: ExpressionNode = defaultValue;
                let complete = true;
                for (const arm of [...statement.cases].reverse()) {
                  const armValue = replayScalarState(name, arm.body, switchIncoming, statement);
                  if (!armValue) {
                    complete = false;
                    break;
                  }
                  const condition = new BinaryOpNode(
                    cloneNode(selected), BinaryOperator.EQ, cloneNode(arm.value),
                  );
                  condition.location = arm.value.location ?? statement.location;
                  const next = new TernaryOpNode(condition, armValue, merged);
                  next.location = statement.location;
                  next.type = armValue.type ?? merged.type;
                  merged = next;
                }
                if (complete) mergedValues.set(name, merged);
                else current.delete(name);
              }
              for (const [name, value] of mergedValues) current.set(name, value);
            } else if (statement instanceof StateArrayAssignNode || statement instanceof StateArrayDeleteNode
              || statement instanceof StateArrayPushNode || statement instanceof StateArrayPopNode) {
              current.delete(statement.name);
            } else if (statement instanceof TryCatchNode || statement instanceof WhileNode
              || statement instanceof DoWhileNode) {
              for (const name of runtimePathMutatedState) {
                if (containsNode(statement, target)) break;
                let mutates = false;
                const findMutation = (candidate: Node): void => {
                  if (candidate instanceof StateAssignNode && candidate.name === name) mutates = true;
                  for (const [key, value] of Object.entries(candidate)) {
                    if (mutates || key === 'location' || key === 'definition' || key === 'symbol'
                      || key === 'type' || key === 'resolvedFunction' || key === 'collection'
                      || key === 'stateVariable') continue;
                    if (value instanceof Node) findMutation(value);
                    else if (Array.isArray(value)) {
                      for (const item of value) if (item instanceof Node) findMutation(item);
                    }
                  }
                };
                findMutation(statement);
                if (mutates) current.delete(name);
              }
            }
          }
          return undefined;
        }
        for (const [key, value] of Object.entries(root)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof Node && containsNode(value, target)) return search(value, new Map(incoming));
          if (Array.isArray(value)) {
            for (const item of value) if (item instanceof Node && containsNode(item, target)) {
              return search(item, new Map(incoming));
            }
          }
        }
        return undefined;
      };
      return search(node.body, new Map()) ?? new Map();
    };
    const runtimePathExpressionSupported = (
      expression: ExpressionNode,
      counterName?: string,
      resolving = new Set<string>(),
      stateValues: ReadonlyMap<string, ExpressionNode> = new Map(),
      localValues: ReadonlyMap<string, ExpressionNode> = new Map(),
    ): boolean => {
      if (expression instanceof LiteralNode) return true;
      if (expression instanceof StateAccessNode) {
        if (!runtimePathMutatedState.has(expression.name)) return true;
        if (resolving.has(`state:${expression.name}`)) return true;
        const assigned = stateValues.get(expression.name);
        return assigned !== undefined && runtimePathExpressionSupported(
          assigned, counterName, new Set(resolving).add(`state:${expression.name}`), stateValues,
          localValues,
        );
      }
      if (expression instanceof IdentifierNode) {
        if (expression.name === counterName
          || visibleParameters.some((parameter) => parameter.name === expression.name)) return true;
        if (resolving.has(expression.name)) return false;
        const initializer = localValues.get(expression.name) ?? runtimePathLocalInitializer(expression.name);
        return initializer !== undefined
          && runtimePathExpressionSupported(
            initializer, counterName, new Set(resolving).add(expression.name), stateValues, localValues,
          );
      }
      if (expression instanceof CastNode || expression instanceof UnaryOpNode
        || expression instanceof FieldAccessNode) {
        return runtimePathExpressionSupported(
          expression.expression, counterName, resolving, stateValues, localValues,
        );
      }
      if (expression instanceof BinaryOpNode) {
        return runtimePathExpressionSupported(expression.left, counterName, resolving, stateValues, localValues)
          && runtimePathExpressionSupported(expression.right, counterName, resolving, stateValues, localValues);
      }
      if (expression instanceof TernaryOpNode) {
        return runtimePathExpressionSupported(expression.condition, counterName, resolving, stateValues, localValues)
          && runtimePathExpressionSupported(expression.ifTrue, counterName, resolving, stateValues, localValues)
          && runtimePathExpressionSupported(expression.ifFalse, counterName, resolving, stateValues, localValues);
      }
      if (expression instanceof MappingAccessNode) {
        return !runtimePathMutatedState.has(expression.name)
          && expression.keys.every((key) => runtimePathExpressionSupported(
            key, counterName, resolving, stateValues, localValues,
          ));
      }
      if (expression instanceof ArrayAccessNode) {
        return runtimePathExpressionSupported(expression.array, counterName, resolving, stateValues, localValues)
          && runtimePathExpressionSupported(expression.index, counterName, resolving, stateValues, localValues);
      }
      return false;
    };
    const expandRuntimePathExpression = (
      expression: ExpressionNode,
      counterName?: string,
      resolving = new Set<string>(),
      stateValues: ReadonlyMap<string, ExpressionNode> = new Map(),
      localValues: ReadonlyMap<string, ExpressionNode> = new Map(),
    ): ExpressionNode | undefined => {
      if (expression instanceof StateAccessNode && runtimePathMutatedState.has(expression.name)) {
        if (resolving.has(`state:${expression.name}`)) return cloneNode(expression);
        const assigned = stateValues.get(expression.name);
        return assigned && expandRuntimePathExpression(
          cloneNode(assigned), counterName, new Set(resolving).add(`state:${expression.name}`), stateValues,
          localValues,
        );
      }
      if (expression instanceof IdentifierNode
        && expression.name !== counterName
        && !visibleParameters.some((parameter) => parameter.name === expression.name)) {
        if (resolving.has(expression.name)) return undefined;
        const initializer = localValues.get(expression.name) ?? runtimePathLocalInitializer(expression.name);
        return initializer && expandRuntimePathExpression(
          cloneNode(initializer), counterName, new Set(resolving).add(expression.name), stateValues, localValues,
        );
      }
      const expanded = cloneNode(expression);
      for (const key of Object.keys(expanded)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
          || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
        const value = (expanded as unknown as Record<string, unknown>)[key];
        if (value instanceof ExpressionNode) {
          const replacement = expandRuntimePathExpression(
            value, counterName, resolving, stateValues, localValues,
          );
          if (!replacement) return undefined;
          (expanded as unknown as Record<string, unknown>)[key] = replacement;
        } else if (Array.isArray(value)) {
          const replacements = value.map((item) => item instanceof ExpressionNode
            ? expandRuntimePathExpression(item, counterName, resolving, stateValues, localValues) : item);
          if (replacements.some((item) => item === undefined)) return undefined;
          (expanded as unknown as Record<string, unknown>)[key] = replacements;
        }
      }
      return expanded;
    };
    const runtimePathCondition = (
      conditions: readonly { expression: ExpressionNode; negated: boolean }[],
    ): ExpressionNode | undefined => conditions.reduce<ExpressionNode | undefined>((combined, condition) => {
      let next = cloneNode(condition.expression);
      if (condition.negated) {
        const negated = new UnaryOpNode(UnaryOperator.NOT, next);
        negated.location = condition.expression.location;
        next = negated;
      }
      if (!combined) return next;
      const conjunction = new BinaryOpNode(combined, BinaryOperator.AND, next);
      conjunction.location = condition.expression.location;
      return conjunction;
    }, undefined);
    const tryLower = (loop: WhileNode | DoWhileNode, apply: boolean): boolean => {
      const canonical = canonicalLoops.get(loop);
      if (!canonical) return false;
      const {
        logical, count, boundNames, boundDefinitions, boundAssignments, boundOffset, boundExpression,
        start, step, stepExpression, stepNames, stepDefinitions, stepAssignments,
        counterType, postTest, exactBound, sourceWhile, counterUpdate,
        pathConditions, pathSupported,
      } = canonical;
      const serial = apply ? this.serial++ : this.serial;
      const stepSnapshot = apply && stepAssignments.length > 0
        ? `__internal__vmapCounterStep_${serial}` : undefined;
      const stateValues = dominantStateValues(loop);
      const sourcePathCondition = runtimePathCondition(pathConditions);
      if (!pathSupported
        || (sourcePathCondition && !runtimePathExpressionSupported(
          sourcePathCondition, undefined, new Set(), stateValues,
        ))) return false;
      const pathCondition = sourcePathCondition && expandRuntimePathExpression(
        sourcePathCondition, undefined, new Set(), stateValues,
      );
      if (sourcePathCondition && !pathCondition) return false;
      const { block, location } = loop;
      const stepValue = (): ExpressionNode => {
        if (!stepSnapshot) return stepExpression ? cloneNode(stepExpression) : new IntLiteralNode(step);
        const reference = new IdentifierNode(stepSnapshot);
        reference.location = location;
        return reference;
      };
      const unitDomain = !stepExpression && start === 0n && step === 1n;
      const writes: Array<ArrayAssignNode | ArrayDeleteNode | MappingAssignNode | MappingDeleteNode
      | MappingFieldAssignNode> = [];
      const writePaths = new Map<Node, ExpressionNode | undefined>();
      const breakPaths: Array<ExpressionNode | undefined> = [];
      // `undefined` represents logical true, keeping unconditional paths compact. These helpers also simplify
      // the false literals introduced by abrupt control flow so `if (skip) continue; write` publishes `!skip`.
      const isFalse = (expression: ExpressionNode | undefined): boolean =>
        expression instanceof BoolLiteralNode && !expression.value;
      const pathNot = (expression: ExpressionNode | undefined): ExpressionNode | undefined => {
        if (!expression) return new BoolLiteralNode(false);
        if (expression instanceof BoolLiteralNode) return expression.value ? new BoolLiteralNode(false) : undefined;
        const result = new UnaryOpNode(UnaryOperator.NOT, cloneNode(expression));
        result.location = expression.location;
        return result;
      };
      const pathAnd = (
        left: ExpressionNode | undefined,
        right: ExpressionNode | undefined,
      ): ExpressionNode | undefined => {
        if (isFalse(left) || isFalse(right)) return new BoolLiteralNode(false);
        if (!left) return right && cloneNode(right);
        if (!right) return cloneNode(left);
        const result = new BinaryOpNode(cloneNode(left), BinaryOperator.AND, cloneNode(right));
        result.location = right.location;
        return result;
      };
      const pathOr = (
        left: ExpressionNode | undefined,
        right: ExpressionNode | undefined,
      ): ExpressionNode | undefined => {
        if (!left || !right) return undefined;
        if (isFalse(left)) return cloneNode(right);
        if (isFalse(right)) return cloneNode(left);
        const result = new BinaryOpNode(cloneNode(left), BinaryOperator.OR, cloneNode(right));
        result.location = right.location;
        return result;
      };
      const fallthrough = (x: Node): ExpressionNode | undefined => {
        if (x instanceof ContinueNode || x instanceof BreakNode || x instanceof ReturnNode) {
          return new BoolLiteralNode(false);
        }
        if (x instanceof WhileNode || x instanceof DoWhileNode) return undefined;
        if (x instanceof BlockNode) {
          let active: ExpressionNode | undefined;
          for (const statement of x.statements ?? []) active = pathAnd(active, fallthrough(statement));
          return active;
        }
        if (x instanceof BranchNode) {
          const ifFallthrough = fallthrough(x.ifBlock);
          const elseFallthrough = x.elseBlock ? fallthrough(x.elseBlock) : undefined;
          // Both arms (including an absent else) reaching the next statement makes that statement
          // unconditional. Preserve the compact `undefined === true` representation instead of publishing
          // `p || !p`, which is logically true but forces the SDK to replay a spurious effect predicate.
          if (!ifFallthrough && !elseFallthrough) return undefined;
          const ifPath = pathAnd(x.condition, ifFallthrough);
          const elsePath = pathAnd(pathNot(x.condition), elseFallthrough);
          return pathOr(ifPath, elsePath);
        }
        return undefined;
      };
      const collectWrites = (
        x: Node,
        condition?: ExpressionNode,
        breakExitsLoop = true,
      ): void => {
        if (x instanceof WhileNode || x instanceof DoWhileNode) return;
        if (isWrite(x)) {
          // Local memory-array writes can feed a symbolic key recipe, but they do not own an authenticated
          // collection journal. Only state collections participate in physical row settlement.
          if (this.collections.has(x.name)) {
            writes.push(x);
            writePaths.set(x, condition);
          }
          return;
        }
        if ((x instanceof BreakNode && breakExitsLoop) || x instanceof ReturnNode) {
          breakPaths.push(condition); return;
        }
        if (x instanceof BlockNode) {
          let active = condition;
          for (const statement of x.statements ?? []) {
            collectWrites(statement, active, breakExitsLoop);
            active = pathAnd(active, fallthrough(statement));
          }
          return;
        }
        if (x instanceof BranchNode) {
          collectWrites(x.ifBlock, pathAnd(condition, x.condition), breakExitsLoop);
          if (x.elseBlock) {
            collectWrites(x.elseBlock, pathAnd(condition, pathNot(x.condition)), breakExitsLoop);
          }
          return;
        }
        if (x instanceof SwitchNode) {
          const matches = x.cases.map((candidate) => {
            const equality = new BinaryOpNode(
              cloneNode(x.expression), BinaryOperator.EQ, cloneNode(candidate.value),
            );
            equality.location = candidate.value.location ?? x.location;
            return equality;
          });
          x.cases.forEach((candidate, index) => {
            collectWrites(candidate.body, pathAnd(condition, matches[index]), false);
          });
          if (x.defaultCase) {
            const defaultCondition = matches.reduce<ExpressionNode | undefined>(
              (active, match) => pathAnd(active, pathNot(match)), condition,
            );
            collectWrites(x.defaultCase, defaultCondition, false);
          }
          return;
        }
        if (x instanceof TryCatchNode) {
          // Catch clauses are dead on BCH; only writes reached after the successful call can execute.
          collectWrites(x.tryBlock, condition, breakExitsLoop);
          return;
        }
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
          const v = (x as unknown as Record<string, unknown>)[key];
          if (v instanceof Node) collectWrites(v, condition, breakExitsLoop);
          else if (Array.isArray(v)) for (const e of v) if (e instanceof Node) {
            collectWrites(e, condition, breakExitsLoop);
          }
        }
      };
      collectWrites(block);
      // Symbol resolution normally separates a mapping-of-array's final subscript into `arrayIndex`, but this
      // lowering intentionally runs earlier so it can publish the runtime key permutation. Normalize the same
      // shape here: the mapping key selects the physical journal entry while the final index is part of the
      // authenticated whole-array mutation, never part of the sorted slot hash.
      for (const write of writes) {
        if (!(write instanceof MappingAssignNode) || write.arrayPush || write.arrayPop || write.arrayIndex) continue;
        const collection = this.collectionsByName.get(write.name);
        if (collection?.innermostValueType instanceof ArrayType
          && write.keys.length === collection.depth + 1) {
          write.arrayIndex = write.keys.pop();
        }
      }
      const keyed = writes.filter((write) =>
        this.collections.has(write.name) && counterKeyIndex(write, logical) >= 0);
      for (const write of keyed) {
        if (!(write instanceof MappingAssignNode)
          || (!write.arrayPush && !write.arrayPop && write.arrayIndex === undefined)) continue;
        if (!write.arrayPop) write.messageBusRuntimeMutationValueExpression = cloneNode(write.expression);
        if (write.arrayIndex) write.messageBusRuntimeMutationIndexExpression = cloneNode(write.arrayIndex);
      }
      // Collapse an exhaustive top-level local assignment join into the exact value produced for this source
      // iteration. The original branch remains in the executable body; this expression is metadata used wherever
      // physical key sorting requires replaying that value in logical counter order.
      const conditionalAssignmentJoins = new Map<string, Array<{
        statement: AssignNode; index: number; actualAssignments: number;
      }>>();
      const countAssignmentsTo = (root: Node, name: string): number => {
        if (root !== block && (root instanceof WhileNode || root instanceof DoWhileNode)) return 0;
        let assignmentCount = root instanceof AssignNode && root.identifier.name === name ? 1 : 0;
        for (const [key, value] of Object.entries(root)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof Node) assignmentCount += countAssignmentsTo(value, name);
          else if (Array.isArray(value)) {
            for (const item of value) if (item instanceof Node) assignmentCount += countAssignmentsTo(item, name);
          }
        }
        return assignmentCount;
      };
      const assignmentNamesIn = (root: Node, names = new Set<string>()): Set<string> => {
        if (root !== block && (root instanceof WhileNode || root instanceof DoWhileNode)) return names;
        if (root instanceof AssignNode) names.add(root.identifier.name);
        for (const [key, value] of Object.entries(root)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof Node) assignmentNamesIn(value, names);
          else if (Array.isArray(value)) {
            for (const item of value) if (item instanceof Node) assignmentNamesIn(item, names);
          }
        }
        return names;
      };
      const joinedAssignmentValue = (arm: BlockNode, name: string): ExpressionNode | undefined => {
        let result: ExpressionNode | undefined;
        for (const candidate of arm.statements ?? []) {
          const assignments = countAssignmentsTo(candidate, name);
          if (assignments === 0) continue;
          if (result || candidate instanceof WhileNode || candidate instanceof DoWhileNode) return undefined;
          if (candidate instanceof AssignNode && candidate.identifier.name === name && assignments === 1) {
            if (containsIdentifier(candidate.expression, name)) return undefined;
            result = cloneNode(candidate.expression);
            continue;
          }
          if (candidate instanceof BranchNode && candidate.elseBlock) {
            const ifValue = joinedAssignmentValue(candidate.ifBlock, name);
            const elseValue = joinedAssignmentValue(candidate.elseBlock, name);
            if (!ifValue || !elseValue) return undefined;
            const ternary = new TernaryOpNode(cloneNode(candidate.condition), ifValue, elseValue);
            ternary.location = candidate.location;
            ternary.type = ifValue.type ?? elseValue.type;
            result = ternary;
            continue;
          }
          if (candidate instanceof SwitchNode && candidate.defaultCase) {
            const defaultValue = joinedAssignmentValue(candidate.defaultCase, name);
            if (!defaultValue) return undefined;
            let merged: ExpressionNode = defaultValue;
            for (const switchCase of [...candidate.cases].reverse()) {
              const caseValue = joinedAssignmentValue(switchCase.body, name);
              if (!caseValue) return undefined;
              const condition = new BinaryOpNode(
                cloneNode(candidate.expression), BinaryOperator.EQ, cloneNode(switchCase.value),
              );
              condition.location = switchCase.location ?? candidate.location;
              const ternary = new TernaryOpNode(condition, caseValue, merged);
              ternary.location = candidate.location;
              ternary.type = caseValue.type ?? merged.type;
              merged = ternary;
            }
            result = merged;
            continue;
          }
          return undefined;
        }
        return result;
      };
      for (const [index, statement] of (block.statements ?? []).entries()) {
        let names: Set<string>;
        const valueForName = (name: string): ExpressionNode | undefined => {
          if (statement instanceof BranchNode && statement.elseBlock) {
            const ifValue = joinedAssignmentValue(statement.ifBlock, name);
            const elseValue = joinedAssignmentValue(statement.elseBlock, name);
            if (!ifValue || !elseValue) return undefined;
            const expression = new TernaryOpNode(
              cloneNode(statement.condition), ifValue, elseValue,
            );
            expression.location = statement.location;
            expression.type = ifValue.type ?? elseValue.type;
            return expression;
          }
          if (statement instanceof SwitchNode && statement.defaultCase) {
            const defaultValue = joinedAssignmentValue(statement.defaultCase, name);
            if (!defaultValue) return undefined;
            let merged: ExpressionNode = defaultValue;
            for (const switchCase of [...statement.cases].reverse()) {
              const caseValue = joinedAssignmentValue(switchCase.body, name);
              if (!caseValue) return undefined;
              const condition = new BinaryOpNode(
                cloneNode(statement.expression), BinaryOperator.EQ, cloneNode(switchCase.value),
              );
              condition.location = switchCase.location ?? statement.location;
              const expression = new TernaryOpNode(condition, caseValue, merged);
              expression.location = statement.location;
              expression.type = caseValue.type ?? merged.type;
              merged = expression;
            }
            return merged;
          }
          return undefined;
        };
        if (statement instanceof BranchNode && statement.elseBlock) {
          names = assignmentNamesIn(statement.ifBlock);
          const elseNames = assignmentNamesIn(statement.elseBlock);
          names = new Set([...names].filter((name) => elseNames.has(name)));
        } else if (statement instanceof SwitchNode && statement.defaultCase) {
          names = assignmentNamesIn(statement.defaultCase);
          for (const switchCase of statement.cases) {
            const caseNames = assignmentNamesIn(switchCase.body);
            names = new Set([...names].filter((name) => caseNames.has(name)));
          }
        } else continue;
        for (const name of names) {
          const expression = valueForName(name);
          if (!expression) continue;
          const identifier = new IdentifierNode(name);
          identifier.location = statement.location;
          identifier.type = expression.type;
          const collapsed = new AssignNode(identifier, expression);
          collapsed.location = statement.location;
          const joins = conditionalAssignmentJoins.get(name) ?? [];
          joins.push({
            statement: collapsed,
            index,
            actualAssignments: countAssignmentsTo(statement, name),
          });
          conditionalAssignmentJoins.set(name, joins);
        }
      }
      const loopCarriedLocalValues = new Map<string, ExpressionNode>();
      const loopCarriedLocalValuesByStatement = new Map<number, Map<string, ExpressionNode>>();
      const predicateOuterIndex = canonical.parent.statements?.indexOf(loop) ?? -1;
      const predicateOuterInitializers = new Map<string, ExpressionNode>();
      if (predicateOuterIndex >= 0) {
        for (const statement of canonical.parent.statements!.slice(0, predicateOuterIndex)) {
          if (statement instanceof VariableDefinitionNode && statement.expression) {
            predicateOuterInitializers.set(statement.name, statement.expression);
          }
        }
      }
      const topLevelAssignments = new Map<string, Array<{ statement: AssignNode; index: number }>>();
      for (const [index, statement] of (block.statements ?? []).entries()) {
        if (!(statement instanceof AssignNode) || statement === counterUpdate) continue;
        const updates = topLevelAssignments.get(statement.identifier.name) ?? [];
        updates.push({ statement, index });
        topLevelAssignments.set(statement.identifier.name, updates);
      }
      for (const [name, joins] of conditionalAssignmentJoins) {
        const updates = topLevelAssignments.get(name) ?? [];
        updates.push(...joins.map(({ statement, index }) => ({ statement, index })));
        updates.sort((left, right) => left.index - right.index);
        topLevelAssignments.set(name, updates);
      }
      for (const [name, updates] of topLevelAssignments) {
        let allAssignments = 0;
        const countAssignments = (candidate: Node): void => {
          if (candidate !== block && (candidate instanceof WhileNode || candidate instanceof DoWhileNode)) return;
          if (candidate instanceof AssignNode && candidate.identifier.name === name) allAssignments += 1;
          for (const [key, value] of Object.entries(candidate)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
              || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
            if (value instanceof Node) countAssignments(value);
            else if (Array.isArray(value)) {
              for (const item of value) if (item instanceof Node) countAssignments(item);
            }
          }
        };
        countAssignments(block);
        const initializer = predicateOuterInitializers.get(name)
          ?? (visibleParameters.some((parameter) => parameter.name === name)
            ? new IdentifierNode(name) : undefined);
        const collapsedExtras = (conditionalAssignmentJoins.get(name) ?? [])
          .reduce((sum, join) => sum + join.actualAssignments - 1, 0);
        if (allAssignments !== updates.length + collapsedExtras) continue;
        const toggles = updates.every(({ statement }) => {
          const expression = statement.expression;
          return expression instanceof UnaryOpNode && expression.operator === UnaryOperator.NOT
            && expression.expression instanceof IdentifierNode && expression.expression.name === name;
        });
        if (!initializer || keyed.length === 0) continue;
        const writePositions = keyed.map((write) => (block.statements ?? [])
          .findIndex((statement) => containsNode(statement, write)));
        if (writePositions.some((index) => index < 0)) continue;
        const rank = unitDomain
          ? new IdentifierNode(logical)
          : new BinaryOpNode(
            new BinaryOpNode(new IdentifierNode(logical), BinaryOperator.MINUS, new IntLiteralNode(start)),
            BinaryOperator.DIV, stepValue(),
          );
        const locateGenerated = (candidate: Node, seen = new Set<Node>()): void => {
          if (seen.has(candidate)) return;
          seen.add(candidate);
          candidate.location ??= updates[0].statement.location;
          for (const [key, child] of Object.entries(candidate)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
              || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
            if (child instanceof Node) locateGenerated(child, seen);
            else if (Array.isArray(child)) {
              for (const item of child) if (item instanceof Node) locateGenerated(item, seen);
            }
          }
        };
        if (toggles) {
          const togglesBefore = new Set(writePositions.map((writeIndex) =>
            updates.filter(({ index }) => index < writeIndex).length));
          if (togglesBefore.size !== 1) continue;
          const totalToggles = new BinaryOpNode(
            new BinaryOpNode(rank, BinaryOperator.MUL, new IntLiteralNode(BigInt(updates.length))),
            BinaryOperator.PLUS,
            new IntLiteralNode(BigInt([...togglesBefore][0])),
          );
          const even = new BinaryOpNode(
            new BinaryOpNode(totalToggles, BinaryOperator.MOD, new IntLiteralNode(2n)),
            BinaryOperator.EQ,
            new IntLiteralNode(0n),
          );
          const toggled = new UnaryOpNode(UnaryOperator.NOT, cloneNode(initializer));
          const value = new TernaryOpNode(even, cloneNode(initializer), toggled);
          value.location = updates[0].statement.location;
          locateGenerated(value);
          loopCarriedLocalValues.set(name, value);
          continue;
        }

        // Straight-line unconditional assignments which do not read themselves have an exact closed form at every
        // source-order phase. A use after assignment K observes fK(i); a use before the first assignment observes
        // the initializer at rank zero and the final assignment evaluated at i-step thereafter. Preserve one value
        // per statement site: distinct keyed writes may legitimately observe opposite sides of the same update.
        if (updates.some(({ statement }) => containsIdentifier(statement.expression, name))) continue;
        const statements = block.statements ?? [];
        const usePositions = statements.flatMap((statement, index) => (
          !updates.some((update) => update.index === index) && containsIdentifier(statement, name) ? [index] : []
        ));
        if (usePositions.length === 0) continue;
        const phases = new Set(usePositions.map((index) =>
          updates.filter((update) => update.index < index).length));
        if (!runtimePathExpressionSupported(
          initializer, logical, new Set(), stateValues, loopCarriedLocalValues,
        )) continue;
        const expandedInitializer = expandRuntimePathExpression(
          initializer, logical, new Set(), stateValues, loopCarriedLocalValues,
        );
        if (!expandedInitializer) continue;
        const phaseValues = new Map<number, ExpressionNode>();
        let phasesSupported = true;
        for (const phase of phases) {
          const selectedUpdate = phase === 0 ? updates.at(-1)! : updates[phase - 1];
          if (!runtimePathExpressionSupported(
            selectedUpdate.statement.expression, logical, new Set(), stateValues, loopCarriedLocalValues,
          )) { phasesSupported = false; break; }
          const expandedUpdate = expandRuntimePathExpression(
            selectedUpdate.statement.expression, logical, new Set(), stateValues, loopCarriedLocalValues,
          );
          if (!expandedUpdate) { phasesSupported = false; break; }
          let value: ExpressionNode = expandedUpdate;
          if (phase === 0) {
            const previous = cloneNode(expandedUpdate) as ExpressionNode;
            const replaceCounter = (candidate: Node): Node => {
              if (candidate instanceof IdentifierNode && candidate.name === logical) {
                const prior = new BinaryOpNode(
                  new IdentifierNode(logical), BinaryOperator.MINUS, stepValue(),
                );
                prior.location = candidate.location;
                return prior;
              }
              for (const [key, child] of Object.entries(candidate)) {
                if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
                  || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
                if (child instanceof Node) {
                  (candidate as unknown as Record<string, unknown>)[key] = replaceCounter(child);
                } else if (Array.isArray(child)) {
                  (candidate as unknown as Record<string, unknown>)[key] = child.map((item) =>
                    item instanceof Node ? replaceCounter(item) : item);
                }
              }
              return candidate;
            };
            const first = new BinaryOpNode(cloneNode(rank), BinaryOperator.EQ, new IntLiteralNode(0n));
            value = new TernaryOpNode(
              first, cloneNode(expandedInitializer), replaceCounter(previous) as ExpressionNode,
            );
          }
          value.location = updates[0].statement.location;
          locateGenerated(value);
          phaseValues.set(phase, value);
        }
        if (!phasesSupported) continue;
        for (const position of usePositions) {
          const phase = updates.filter((update) => update.index < position).length;
          const value = phaseValues.get(phase)!;
          const siteValues = loopCarriedLocalValuesByStatement.get(position) ?? new Map();
          siteValues.set(name, cloneNode(value));
          loopCarriedLocalValuesByStatement.set(position, siteValues);
        }
        if (phaseValues.size === 1) {
          loopCarriedLocalValues.set(name, cloneNode(phaseValues.values().next().value!));
        }
      }
      // Conditions and mapping values are replayed at their own source statement. This permits a write before an
      // assignment and another after it without conflating the two local values. Runtime effects and abrupt
      // fallthrough use the same position map below; their atomic path terms are expanded before composition.
      for (const write of keyed) {
        const position = (block.statements ?? []).findIndex((statement) => containsNode(statement, write));
        const siteValues = loopCarriedLocalValuesByStatement.get(position);
        if (!siteValues) continue;
        const values = new Map([...loopCarriedLocalValues, ...siteValues]);
        const condition = writePaths.get(write);
        if (condition) {
          const expanded = expandRuntimePathExpression(
            condition, logical, new Set(), stateValues, values,
          );
          if (expanded) writePaths.set(write, expanded);
        }
        const expression = write instanceof ArrayAssignNode ? write.value
          : write instanceof MappingAssignNode ? write.expression : undefined;
        if (!expression || ![...siteValues.keys()].some((name) => containsIdentifier(expression, name))) continue;
        const expanded = expandRuntimePathExpression(
          expression, logical, new Set(), stateValues, values,
        );
        if (!expanded) continue;
        if (write instanceof ArrayAssignNode) write.value = expanded;
        else if (write instanceof MappingAssignNode) write.expression = expanded;
      }
      const loopCarriedValuesAt = (candidate: Node): Map<string, ExpressionNode> => {
        const position = (block.statements ?? []).findIndex((statement) => containsNode(statement, candidate));
        const siteValues = loopCarriedLocalValuesByStatement.get(position);
        return siteValues ? new Map([...loopCarriedLocalValues, ...siteValues]) : loopCarriedLocalValues;
      };
      const conditionAt = (expression: ExpressionNode, site: Node): ExpressionNode =>
        expandRuntimePathExpression(
          expression, logical, new Set(), stateValues, loopCarriedValuesAt(site),
        ) ?? expression;
      const phasedFallthrough = (x: Node): ExpressionNode | undefined => {
        if (x instanceof ContinueNode || x instanceof BreakNode || x instanceof ReturnNode) {
          return new BoolLiteralNode(false);
        }
        if (x instanceof WhileNode || x instanceof DoWhileNode) return undefined;
        if (x instanceof BlockNode) {
          let active: ExpressionNode | undefined;
          for (const statement of x.statements ?? []) active = pathAnd(active, phasedFallthrough(statement));
          return active;
        }
        if (x instanceof BranchNode) {
          const condition = conditionAt(x.condition, x);
          const ifFallthrough = phasedFallthrough(x.ifBlock);
          const elseFallthrough = x.elseBlock ? phasedFallthrough(x.elseBlock) : undefined;
          if (!ifFallthrough && !elseFallthrough) return undefined;
          return pathOr(
            pathAnd(condition, ifFallthrough), pathAnd(pathNot(condition), elseFallthrough),
          );
        }
        return undefined;
      };
      // Rebuild paths after deriving source-position recipes. The discovery traversal above intentionally runs
      // first because those recipes depend on the set and positions of keyed writes. Expanding each atomic branch
      // before composing fallthrough preserves `local` values observed on opposite sides of an assignment.
      writePaths.clear();
      breakPaths.length = 0;
      const collectPhasedPaths = (
        x: Node, condition?: ExpressionNode, breakExitsLoop = true,
      ): void => {
        if (x instanceof WhileNode || x instanceof DoWhileNode) return;
        if (isWrite(x)) {
          if (this.collections.has(x.name)) writePaths.set(x, condition);
          return;
        }
        if ((x instanceof BreakNode && breakExitsLoop) || x instanceof ReturnNode) {
          breakPaths.push(condition); return;
        }
        if (x instanceof BlockNode) {
          let active = condition;
          for (const statement of x.statements ?? []) {
            collectPhasedPaths(statement, active, breakExitsLoop);
            active = pathAnd(active, phasedFallthrough(statement));
          }
          return;
        }
        if (x instanceof BranchNode) {
          const branchCondition = conditionAt(x.condition, x);
          collectPhasedPaths(x.ifBlock, pathAnd(condition, branchCondition), breakExitsLoop);
          if (x.elseBlock) {
            collectPhasedPaths(x.elseBlock, pathAnd(condition, pathNot(branchCondition)), breakExitsLoop);
          }
          return;
        }
        if (x instanceof SwitchNode) {
          const expression = conditionAt(x.expression, x);
          const matches = x.cases.map((candidate) => {
            const equality = new BinaryOpNode(
              cloneNode(expression), BinaryOperator.EQ, cloneNode(candidate.value),
            );
            equality.location = candidate.value.location ?? x.location;
            return equality;
          });
          x.cases.forEach((candidate, index) => {
            collectPhasedPaths(candidate.body, pathAnd(condition, matches[index]), false);
          });
          if (x.defaultCase) {
            const defaultCondition = matches.reduce<ExpressionNode | undefined>(
              (active, match) => pathAnd(active, pathNot(match)), condition,
            );
            collectPhasedPaths(x.defaultCase, defaultCondition, false);
          }
          return;
        }
        if (x instanceof TryCatchNode) { collectPhasedPaths(x.tryBlock, condition, breakExitsLoop); return; }
        for (const [key, value] of Object.entries(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction') continue;
          if (value instanceof Node) collectPhasedPaths(value, condition, breakExitsLoop);
          else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) {
            collectPhasedPaths(item, condition, breakExitsLoop);
          }
        }
      };
      collectPhasedPaths(block);
      // Runtime event cardinality must be derivable before the first VM probe. Nested if/else paths are safe when
      // their predicate can be replayed from SDK-visible inputs and stable pre-state. Switch arms and the reachable
      // try body use those same paths; nested loops still need richer path metadata. This is a construct rule, not
      // a contract/schema allow-list; every
      // event definition and argument expression uses the same record format.
      const runtimeEmits: Array<{ emit: EmitStatementNode; condition?: ExpressionNode }> = [];
      let conditionalRuntimeEmit = false;
      const collectRuntimeEmits = (
        x: Node,
        condition?: ExpressionNode,
      ): void => {
        if (x instanceof EmitStatementNode) {
          const values = loopCarriedValuesAt(x);
          if (condition && !runtimePathExpressionSupported(
            condition, logical, new Set(), stateValues, values,
          )) conditionalRuntimeEmit = true;
          else {
            const expanded = condition && expandRuntimePathExpression(
              condition, logical, new Set(), stateValues, values,
            );
            if (condition && !expanded) conditionalRuntimeEmit = true;
            else runtimeEmits.push({ emit: x, ...(expanded && { condition: expanded }) });
          }
          return;
        }
        if (x instanceof BlockNode) {
          let active = condition;
          for (const statement of x.statements ?? []) {
            collectRuntimeEmits(statement, active);
            active = pathAnd(active, phasedFallthrough(statement));
          }
          return;
        }
        if (x instanceof BranchNode) {
          const branchCondition = conditionAt(x.condition, x);
          collectRuntimeEmits(x.ifBlock, pathAnd(condition, branchCondition));
          if (x.elseBlock) {
            collectRuntimeEmits(x.elseBlock, pathAnd(condition, pathNot(branchCondition)));
          }
          return;
        }
        if (x instanceof SwitchNode) {
          const expression = conditionAt(x.expression, x);
          const matches = x.cases.map((candidate) => {
            const equality = new BinaryOpNode(
              cloneNode(expression), BinaryOperator.EQ, cloneNode(candidate.value),
            );
            equality.location = candidate.value.location ?? x.location;
            return equality;
          });
          x.cases.forEach((candidate, index) => {
            collectRuntimeEmits(candidate.body, pathAnd(condition, matches[index]));
          });
          if (x.defaultCase) {
            const defaultCondition = matches.reduce<ExpressionNode | undefined>(
              (active, match) => pathAnd(active, pathNot(match)), condition,
            );
            collectRuntimeEmits(x.defaultCase, defaultCondition);
          }
          return;
        }
        if (x instanceof TryCatchNode) {
          collectRuntimeEmits(x.tryBlock, condition);
          return;
        }
        if (x !== block && (x instanceof WhileNode || x instanceof DoWhileNode)) {
          let containsEmit = false;
          const findEmit = (candidate: Node): void => {
            if (candidate instanceof EmitStatementNode) { containsEmit = true; return; }
            for (const value of Object.values(candidate)) {
              if (value instanceof Node) findEmit(value);
              else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) findEmit(item);
            }
          };
          findEmit(x);
          conditionalRuntimeEmit ||= containsEmit;
          return;
        }
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node) collectRuntimeEmits(value, condition);
          else if (Array.isArray(value)) {
            for (const item of value) if (item instanceof Node) collectRuntimeEmits(item, condition);
          }
        }
      };
      collectRuntimeEmits(block);
      const runtimeTransfers: Array<{
        transfer: TransferStatementNode | TokenContainerMethodStatementNode; condition?: ExpressionNode;
      }> = [];
      let conditionalRuntimeTransfer = false;
      const collectRuntimeTransfers = (
        x: Node,
        condition?: ExpressionNode,
      ): void => {
        if (x instanceof TransferStatementNode || x instanceof TokenContainerMethodStatementNode) {
          const values = loopCarriedValuesAt(x);
          if (condition && !runtimePathExpressionSupported(
            condition, logical, new Set(), stateValues, values,
          )) conditionalRuntimeTransfer = true;
          else {
            const expanded = condition && expandRuntimePathExpression(
              condition, logical, new Set(), stateValues, values,
            );
            if (condition && !expanded) conditionalRuntimeTransfer = true;
            else runtimeTransfers.push({ transfer: x, ...(expanded && { condition: expanded }) });
          }
          return;
        }
        if (x instanceof BlockNode) {
          let active = condition;
          for (const statement of x.statements ?? []) {
            collectRuntimeTransfers(statement, active);
            active = pathAnd(active, phasedFallthrough(statement));
          }
          return;
        }
        if (x instanceof BranchNode) {
          const branchCondition = conditionAt(x.condition, x);
          collectRuntimeTransfers(x.ifBlock, pathAnd(condition, branchCondition));
          if (x.elseBlock) collectRuntimeTransfers(
            x.elseBlock, pathAnd(condition, pathNot(branchCondition)),
          );
          return;
        }
        if (x instanceof SwitchNode) {
          const expression = conditionAt(x.expression, x);
          const matches = x.cases.map((candidate) => {
            const equality = new BinaryOpNode(
              cloneNode(expression), BinaryOperator.EQ, cloneNode(candidate.value),
            );
            equality.location = candidate.value.location ?? x.location;
            return equality;
          });
          x.cases.forEach((candidate, index) => {
            collectRuntimeTransfers(candidate.body, pathAnd(condition, matches[index]));
          });
          if (x.defaultCase) {
            const defaultCondition = matches.reduce<ExpressionNode | undefined>(
              (active, match) => pathAnd(active, pathNot(match)), condition,
            );
            collectRuntimeTransfers(x.defaultCase, defaultCondition);
          }
          return;
        }
        if (x instanceof TryCatchNode) {
          collectRuntimeTransfers(x.tryBlock, condition);
          return;
        }
        if (x !== block && (x instanceof WhileNode || x instanceof DoWhileNode)) {
          let containsTransfer = false;
          const findTransfer = (candidate: Node): void => {
            if (candidate instanceof TransferStatementNode
              || candidate instanceof TokenContainerMethodStatementNode) { containsTransfer = true; return; }
            for (const value of Object.values(candidate)) {
              if (value instanceof Node) findTransfer(value);
              else if (Array.isArray(value)) {
                for (const item of value) if (item instanceof Node) findTransfer(item);
              }
            }
          };
          findTransfer(x);
          conditionalRuntimeTransfer ||= containsTransfer;
          return;
        }
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node) collectRuntimeTransfers(value, condition);
          else if (Array.isArray(value)) {
            for (const item of value) if (item instanceof Node) collectRuntimeTransfers(item, condition);
          }
        }
      };
      collectRuntimeTransfers(block);
      const runtimeEmitSet = new Set(runtimeEmits.map(({ emit }) => emit));
      const runtimeTransferSet = new Set<Node>(runtimeTransfers.map(({ transfer }) => transfer));
      const keyedSelectionConditions = keyed.map((write) => writePaths.get(write));
      const uniqueDisjunction = (
        conditions: readonly (ExpressionNode | undefined)[],
      ): ExpressionNode | undefined => {
        if (conditions.some((condition) => !condition)) return undefined;
        return [...new Map(conditions.map((condition) => [
          expressionShape(condition!), condition!,
        ])).values()].reduce<ExpressionNode | undefined>((combined, condition) => {
          if (!combined) return cloneNode(condition);
          const disjunction = new BinaryOpNode(combined, BinaryOperator.OR, cloneNode(condition));
          disjunction.location = condition.location;
          return disjunction;
        }, undefined);
      };
      // A row needs one settlement entry whenever any keyed write executes for the source iteration. Preserve that
      // semantics as the disjunction of all write paths. An unconditional write makes the whole domain selected;
      // duplicate paths are removed only to keep the published predicate compact.
      let writeSelectionCondition = uniqueDisjunction(keyedSelectionConditions);
      const breakCondition = breakPaths.length > 0 ? uniqueDisjunction(breakPaths) : undefined;
      // Even an unconditional write needs a selected-domain cursor when the loop can terminate early.
      if (breakPaths.length > 0 && !writeSelectionCondition) {
        writeSelectionCondition = new BoolLiteralNode(true);
      }
      const selectionConditionSupported = keyedSelectionConditions.every((condition) => !condition
          || runtimePathExpressionSupported(
            condition, logical, new Set(), stateValues, loopCarriedLocalValues,
          ))
        && breakPaths.every((condition) => !condition
          || runtimePathExpressionSupported(
            condition, logical, new Set(), stateValues, loopCarriedLocalValues,
          ));
      const sourceContinueUpdates = new Set<AssignNode>();
      const sourceContinueUpdateBlocks = new Map<BlockNode, Set<AssignNode>>();
      const sourceContinues = new Set<ContinueNode>();
      const hasUnexpectedLoopControlMutation = (
        x: Node,
        inspectLogical: boolean,
        inspectBound: boolean,
      ): boolean => {
        if (x instanceof AssignNode
          && ((inspectLogical && x.identifier.name === logical && x !== counterUpdate
            && !sourceContinueUpdates.has(x))
            || (inspectBound && (
              (boundNames.includes(x.identifier.name) && !boundAssignments.includes(x))
              || (stepNames.includes(x.identifier.name) && !stepAssignments.includes(x))
            )))) return true;
        if (x instanceof VariableDefinitionNode
          && ((inspectLogical && x.name === logical)
            || (inspectBound && (
              (boundNames.includes(x.name) && !boundDefinitions.includes(x))
              || (stepNames.includes(x.name) && !stepDefinitions.includes(x))
            )))) return true;
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node
            && hasUnexpectedLoopControlMutation(value, inspectLogical, inspectBound)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node
              && hasUnexpectedLoopControlMutation(item, inspectLogical, inspectBound))) return true;
        }
        return false;
      };
      let sourceContinueValid = true;
      const inspectSourceContinues = (candidate: Node): void => {
        if (!sourceContinueValid) return;
        if (candidate !== block && (candidate instanceof WhileNode || candidate instanceof DoWhileNode)) return;
        if (candidate instanceof BlockNode) {
          for (const [index, statement] of (candidate.statements ?? []).entries()) {
            if (statement instanceof ContinueNode) {
              const update = normalizeDiscardedCounterUpdate(
                candidate.statements?.[index - 1], logical,
              );
              if (!update || update.identifier.name !== logical || !counterUpdate
                || counterUpdateStepShape(update.expression, logical) === undefined
                || counterUpdateStepShape(update.expression, logical)
                  !== counterUpdateStepShape(counterUpdate.expression, logical)) {
                sourceContinueValid = false;
                return;
              }
              if (candidate.statements && candidate.statements[index - 1] !== update) {
                candidate.statements[index - 1] = update;
              }
              sourceContinueUpdates.add(update);
              const updates = sourceContinueUpdateBlocks.get(candidate) ?? new Set<AssignNode>();
              updates.add(update);
              sourceContinueUpdateBlocks.set(candidate, updates);
              sourceContinues.add(statement);
              return;
            }
            inspectSourceContinues(statement);
            if (!sourceContinueValid) return;
          }
          return;
        }
        if (candidate instanceof BranchNode) {
          inspectSourceContinues(candidate.ifBlock);
          if (candidate.elseBlock) inspectSourceContinues(candidate.elseBlock);
          return;
        }
        if (candidate instanceof SwitchNode) {
          for (const arm of candidate.cases) inspectSourceContinues(arm.body);
          if (candidate.defaultCase) inspectSourceContinues(candidate.defaultCase);
          return;
        }
        for (const [key, value] of Object.entries(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction') continue;
          if (value instanceof Node) inspectSourceContinues(value);
          else if (Array.isArray(value)) {
            for (const item of value) if (item instanceof Node) inspectSourceContinues(item);
          }
        }
      };
      if (sourceWhile || postTest) inspectSourceContinues(block);
      if (keyed.length === 0 || !selectionConditionSupported
        || keyed.some((write) => hasObservableEffect(write))
        || conditionalRuntimeEmit
        || conditionalRuntimeTransfer
        || hasUnjournalledRepeatedEffect(block, runtimeEmitSet, runtimeTransferSet)
        // A source while/do-while may continue only after executing the same canonical step. Such a path can be
        // normalized to the desugared-for representation below; every other continue can repeat a logical value
        // and remains outside this progression model.
        || ((sourceWhile || postTest) && !sourceContinueValid)
        // The permutation proof relies on visiting every physical rank exactly once. Apart from the canonical
        // post-test tail update, mutating the counter can shorten, extend, or repeat the loop. Mutating the
        // public bound anywhere in the function similarly disconnects the SDK-derived witness length from the
        // runtime domain, including assignments which occur before the loop.
        || hasUnexpectedLoopControlMutation(block, true, false)
        || hasUnexpectedLoopControlMutation(node.body, false, true)) return false;
      // One counter-dependent component selects the physical cursor. It and every additional counter-dependent
      // component must be replayable from the authenticated logical value so the SDK can derive the complete
      // composite slot before sorting (`m[base + i]`, `m[i + 1][i]`, casts, ternaries, and immutable aliases all
      // use this path).
      if (keyed.some((write) => {
        const keys = keyExpressions(write);
        return keys.some((key) => containsIdentifier(key, logical)
          && !runtimePathExpressionSupported(
            key, logical, new Set(), stateValues, loopCarriedLocalValues,
          ));
      })) return false;
      const keyedSet = new Set<Node>(keyed);
      const invariantWrites = writes.filter((write) => !keyedSet.has(write));
      const keyedCollections = new Set(keyed.map((write) => write.name));
      const containsLogical = (x: Node): boolean => {
        if (x instanceof IdentifierNode && x.name === logical) return true;
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node && containsLogical(value)) return true;
          if (Array.isArray(value) && value.some((item) => item instanceof Node && containsLogical(item))) return true;
        }
        return false;
      };
      // Mutation operands execute in logical source order even though the entry journal is sorted physically.
      // Admit every expression the existing public/state replay model can serialize; effects and collection reads
      // remain outside that model and therefore fail this loop transactionally before any AST rewrite is applied.
      if (keyed.some((write) => write instanceof MappingAssignNode
        && (write.arrayPush || write.arrayIndex !== undefined)
        && (!runtimePathExpressionSupported(
          write.expression, logical, new Set(), stateValues, loopCarriedLocalValues,
        ) || (write.arrayIndex !== undefined && !runtimePathExpressionSupported(
          write.arrayIndex, logical, new Set(), stateValues, loopCarriedLocalValues,
        ))))) return false;
      // Writes whose complete key is independent of the counter keep their ordinary fixed authenticated journal
      // slot and execute in logical source order. A non-direct counter expression (`m[i + 1]`) is not invariant
      // and still needs its own physical permutation recipe.
      if (invariantWrites.some((write) => keyExpressions(write).some(containsLogical))) return false;
      // CacheMappingEntryInLoop turns a repeated invariant scalar entry into one authenticated read/local
      // mutation/write-back. Admit exactly the stable key/value forms that pass can currently lower; merely being
      // counter-independent is insufficient (for example, a nested or computed key would otherwise retain a raw
      // mapping write in the physical loop). This is capability-based rather than tied to a source contract: any
      // depth-one sorted scalar mapping keyed by a public parameter, literal, msg.sender, or tx.origin qualifies.
      const invariantKeyPlans = new Map<MappingAssignNode, ExpressionNode[]>();
      const invariantWriteCacheable = (write: Node): boolean => {
        if (!(write instanceof MappingAssignNode)
          || write.arrayIndex !== undefined || write.arrayPush || write.arrayPop) return false;
        const collection = this.collectionsByName.get(write.name);
        if (!collection?.sorted || write.keys.length !== collection.depth
          || collection.innermostValueType instanceof ArrayType
          || collection.innermostValueType instanceof StructType) return false;
        const loopIndex = canonical.parent.statements?.indexOf(loop) ?? -1;
        if (loopIndex < 0) return false;
        const keys = write.keys.map((key) => {
          if (isFunctionEntryInvariantMappingKey(key, node.body, publicParameterNames)) return cloneNode(key);
          const expanded = entryExpressionAt(key, canonical.parent, loopIndex);
          return expanded && isFunctionEntryInvariantMappingKey(expanded, emptyBody, publicParameterNames)
            ? expanded : undefined;
        });
        if (keys.some((key) => key === undefined)) return false;
        invariantKeyPlans.set(write, keys as ExpressionNode[]);
        return true;
      };
      if (invariantWrites.some((write) => !invariantWriteCacheable(write))) return false;
      const containsKeyedWrite = (x: Node): boolean => {
        if (keyedSet.has(x)) return true;
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node && containsKeyedWrite(value)) return true;
          if (Array.isArray(value) && value.some((item) => item instanceof Node && containsKeyedWrite(item))) return true;
        }
        return false;
      };
      const hasCounterDependentGuard = (x: Node): boolean => {
        if (x instanceof BranchNode && containsKeyedWrite(x)
          && containsLogical(x.condition)) return true;
        if (x instanceof SwitchNode && containsKeyedWrite(x)
          && containsLogical(x.expression)) return true;
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node && hasCounterDependentGuard(value)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && hasCounterDependentGuard(item))) return true;
        }
        return false;
      };
      const collectionAccessOf = (x: Node): { name: string; keys: ExpressionNode[] } | undefined => {
        if (x instanceof MappingAccessNode) return { name: x.name, keys: x.keys };
        if (!(x instanceof ArrayAccessNode)) return undefined;
        const keys: ExpressionNode[] = [];
        let cursor: ExpressionNode = x;
        while (cursor instanceof ArrayAccessNode) {
          keys.unshift(cursor.index);
          cursor = cursor.array;
        }
        return (cursor instanceof IdentifierNode || cursor instanceof StateAccessNode)
          && this.collections.has(cursor.name)
          ? { name: cursor.name, keys } : undefined;
      };
      type RuntimeReadPlan = {
        destination: ArrayAssignNode | MappingAssignNode;
        synthetic: MappingAssignNode;
        witnessParam: string;
        authenticatedReads: ArrayAccessNode[];
        consumerReads: ArrayAccessNode[];
      };
      const runtimeReadPlans: RuntimeReadPlan[] = [];
      const runtimeReadSignatures = new Set<string>();
      // A counter-derived read of another entry can travel as an independent, read-only physical stream. Its key
      // shape may differ from the destination even when both entries share one collection: grouping below assigns
      // each complete recipe its own authenticated permutation and cursor. Represent it as a compiler-owned no-op
      // transition: a present source entry is authenticated
      // and reproduced byte-for-byte; an absent key authenticates the language default against its bracketing
      // predecessor and reproduces that predecessor unchanged. The typed witness vector feeds the destination.
      for (const destination of [...keyed]) {
        if (!(destination instanceof MappingAssignNode || destination instanceof ArrayAssignNode)) continue;
        const destinationCollection = this.collectionsByName.get(destination.name);
        if (!destinationCollection?.sorted) continue;
        const plansByShape = new Map<string, RuntimeReadPlan>();
        const destinationShape = `${destination.name}:${writeKeyShape(destination)}`;
        const rewrite = (candidate: Node): Node => {
          const candidateAccess = collectionAccessOf(candidate);
          const candidateShape = candidateAccess
            ? `${candidateAccess.name}:${candidateAccess.keys.map(expressionShape).join('|')}` : undefined;
          if (candidateAccess && candidateShape !== undefined
            && candidateShape !== destinationShape && containsLogical(candidate)) {
            const sourceCollection = this.collectionsByName.get(candidateAccess.name);
            const valueType = sourceCollection?.innermostValueType;
            const fixedBytes = valueType instanceof BytesType && valueType.bound !== undefined;
            const structuredValue = valueType instanceof StructType || valueType instanceof ArrayType
              || valueType === PrimitiveType.STRING
              || (valueType instanceof BytesType && valueType.bound === undefined);
            const supportedValue = valueType instanceof IntType || valueType instanceof FixedType
              || valueType === PrimitiveType.BOOL || fixedBytes || valueType instanceof AddressType
              || valueType === PrimitiveType.PUBKEY || valueType === PrimitiveType.DATASIG
              || structuredValue;
            if (sourceCollection?.sorted && supportedValue
              && valueType.toString() === destinationCollection.innermostValueType.toString()) {
              runtimeReadSignatures.add(candidateShape);
              const shape = `${candidateAccess.name}\0${candidateAccess.keys.map(expressionShape).join('|')}`;
              let plan = plansByShape.get(shape);
              if (!plan) {
                const witnessParam = `${VMAP_COUNTER_OLD_PREFIX}read_${candidateAccess.name}_${serial}_${runtimeReadPlans.length}`;
                const witness = new IdentifierNode(witnessParam);
                witness.location = candidate.location ?? destination.location;
                witness.type = new ArrayType(valueType);
                const witnessIndex = new IdentifierNode(logical);
                witnessIndex.location = candidate.location ?? destination.location;
                const witnessRead = new ArrayAccessNode(witness, witnessIndex);
                witnessRead.location = candidate.location ?? destination.location;
                witnessRead.type = valueType;
                const synthetic = new MappingAssignNode(
                  candidateAccess.name, candidateAccess.keys.map((key) => cloneNode(key)), witnessRead,
                );
                synthetic.location = candidate.location ?? destination.location;
                synthetic.collection = sourceCollection;
                synthetic.messageBusRuntimeReadOnly = true;
                const authenticatedRead = cloneNode(witnessRead) as ArrayAccessNode;
                synthetic.messageBusRuntimeOldValueWitness = authenticatedRead;
                plan = {
                  destination,
                  synthetic,
                  witnessParam,
                  authenticatedReads: [witnessRead, authenticatedRead],
                  consumerReads: [],
                };
                plansByShape.set(shape, plan);
                runtimeReadPlans.push(plan);
              }
              const witness = new IdentifierNode(plan.witnessParam);
              witness.location = candidate.location ?? destination.location;
              witness.type = new ArrayType(valueType);
              const replacementIndex = new IdentifierNode(logical);
              replacementIndex.location = candidate.location ?? destination.location;
              const replacement = new ArrayAccessNode(witness, replacementIndex);
              replacement.location = candidate.location ?? destination.location;
              replacement.type = valueType;
              plan.consumerReads.push(replacement);
              return replacement;
            }
          }
          for (const [key, value] of Object.entries(candidate)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
              || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
            if (value instanceof Node) {
              (candidate as unknown as Record<string, unknown>)[key] = rewrite(value);
            } else if (Array.isArray(value)) {
              (candidate as unknown as Record<string, unknown>)[key] = value.map((item) =>
                item instanceof Node ? rewrite(item) : item);
            }
          }
          return candidate;
        };
        const expression = destination instanceof MappingAssignNode ? destination.expression : destination.value;
        const rewritten = rewrite(apply ? expression : cloneNode(expression)) as ExpressionNode;
        if (apply) {
          if (destination instanceof MappingAssignNode) destination.expression = rewritten;
          else destination.value = rewritten;
        }
      }
      for (const plan of [...runtimeReadPlans].reverse()) {
        const destinationIndex = keyed.indexOf(plan.destination);
        keyed.splice(Math.max(destinationIndex, 0), 0, plan.synthetic);
        keyedSet.add(plan.synthetic);
        writePaths.set(plan.synthetic, writePaths.get(plan.destination));
      }
      type StructRuntimeRmw = {
        local: string;
        declaration: VariableDefinitionNode;
      };
      const structRuntimeRmws = new Map<ArrayAssignNode | MappingAssignNode, StructRuntimeRmw>();
      // A local whole-struct update is one authenticated entry transition. At this early phase, source
      // `m[i] = value` is still an ArrayAssignNode; SymbolTableTraversal turns it into MappingAssignNode later.
      // Recognize the language-level pattern here so the old value can travel in the same row journal as the write.
      for (const candidate of keyed) {
        if (!(candidate instanceof ArrayAssignNode || candidate instanceof MappingAssignNode)) continue;
        const assigned = candidate instanceof ArrayAssignNode ? candidate.value : candidate.expression;
        if (!(assigned instanceof IdentifierNode)) continue;
        const collection = this.collectionsByName.get(candidate.name);
        if (!(collection?.innermostValueType instanceof StructType)) continue;
        const structType = collection.innermostValueType;
        const local = assigned.name;
        let declaration: VariableDefinitionNode | undefined;
        let declarations = 0;
        let rebuilds = 0;
        let invalid = false;
        const walk = (current: Node, owner?: Node, rebuildValue = false): void => {
          if (current instanceof VariableDefinitionNode && current.name === local) {
            declarations += 1;
            const access = current.expression ? collectionAccessOf(current.expression) : undefined;
            if (access?.name === candidate.name
              && access.keys.map(expressionShape).join('|') === writeKeyShape(candidate)) declaration = current;
            else invalid = true;
          } else if (current instanceof AssignNode && current.identifier.name === local) {
            if (!(current.expression instanceof FunctionCallNode)
              || current.expression.identifier.name !== structType.name) invalid = true;
            else rebuilds += 1;
          } else if (current instanceof IdentifierNode && current.name === local) {
            const isFinalValue = owner === candidate && assigned === current;
            const isAssignmentTarget = owner instanceof AssignNode && owner.identifier === current;
            if (!isFinalValue && !isAssignmentTarget && !rebuildValue) invalid = true;
          }
          for (const key of Object.keys(current)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
              || key === 'resolvedFunction' || key === 'collection') continue;
            const value = (current as unknown as Record<string, unknown>)[key];
            const childRebuild = rebuildValue || (current instanceof AssignNode
              && current.identifier.name === local && key === 'expression'
              && current.expression instanceof FunctionCallNode
              && current.expression.identifier.name === structType.name);
            if (value instanceof Node) walk(value, current, childRebuild);
            else if (Array.isArray(value)) {
              for (const item of value) if (item instanceof Node) walk(item, current, childRebuild);
            }
          }
        };
        walk(block);
        if (!invalid && declaration && declarations === 1 && rebuilds >= 1
          && writePaths.get(candidate) === undefined) {
          structRuntimeRmws.set(candidate, { local, declaration });
        }
      }
      const structRuntimeReads = new Set([...structRuntimeRmws.values()]
        .map(({ declaration }) => declaration.expression)
        .filter((expression): expression is MappingAccessNode => expression instanceof MappingAccessNode));
      const hasSiblingMappingRead = (x: Node): boolean => {
        if (keyedSet.has(x)) return false;
        if (structRuntimeReads.has(x as MappingAccessNode)) return false;
        if (x instanceof MappingAccessNode && keyedCollections.has(x.name)) {
          const signature = `${x.name}:${x.keys.map(expressionShape).join('|')}`;
          if (runtimeReadSignatures.has(signature)) return false;
          // A stable fixed entry can share the collection's ordinary authenticated journal with the runtime
          // stream. Concrete overlap is a topology property: the SDK rejects a runtime slot which aliases this
          // fixed co-spend. Counter-derived reads admitted above use their own authenticated runtime stream;
          // otherwise unreplayable sibling reads remain fenced.
          return x.keys.some((key) => containsLogical(key)
            || !isFunctionEntryInvariantMappingKey(key, node.body, publicParameterNames));
        }
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node && hasSiblingMappingRead(value)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && hasSiblingMappingRead(item))) return true;
        }
        return false;
      };
      // A same-key read nested in its own write is the ordinary `m[i] += amount` transition. Any other mapping
      // read driven by the counter would require a second runtime input cursor and authenticated read journal;
      // the fixed route key witness cannot represent all iterations.
      const hasUnsafeCounterRead = (x: Node, allowed?: string): boolean => {
        if (x instanceof MappingAccessNode && containsLogical(x)) {
          const signature = `${x.name}:${x.keys.map(expressionShape).join('|')}`;
          if (signature !== allowed && !runtimeReadSignatures.has(signature)) return true;
        }
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node && hasUnsafeCounterRead(value, allowed)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && hasUnsafeCounterRead(item, allowed))) return true;
        }
        return false;
      };
      const hasUnsafeRead = (x: Node): boolean => {
        if (structRuntimeReads.has(x as MappingAccessNode)) return false;
        if (keyedSet.has(x)) {
          const write = x as ArrayAssignNode | ArrayDeleteNode | MappingAssignNode | MappingDeleteNode
          | MappingFieldAssignNode;
          return hasUnsafeCounterRead(x, `${write.name}:${writeKeyShape(write)}`);
        }
        if (x instanceof MappingAccessNode && containsLogical(x)) return true;
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node && hasUnsafeRead(value)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && hasUnsafeRead(item))) return true;
        }
        return false;
      };
      const containsCollectionAccess = (x: Node): boolean => {
        if (collectionAccessOf(x)) return true;
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node && containsCollectionAccess(value)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && containsCollectionAccess(item))) return true;
        }
        return false;
      };
      // A general scalar same-entry RMW can evaluate against an authenticated old-value array. Structural/array
      // element writes retain their specialized journal lowerings; reads of another entry remain fenced above.
      const generalOldEntryWrites = new Set<ArrayAssignNode | MappingAssignNode>();
      // Mapping-array element writes and push/pop operations are whole-entry read/modify/write transitions.
      // Give every runtime mutation the same authenticated old-value vector used by general structural RMWs.
      // Code generation applies the array surgery to this witness and verifies it against the co-spent entry (or
      // against the exact empty-array default for an insertion).
      for (const write of keyed) {
        if (write instanceof MappingAssignNode
          && (write.arrayIndex !== undefined || write.arrayPush || write.arrayPop)
          && this.collectionsByName.get(write.name)?.innermostValueType instanceof ArrayType) {
          generalOldEntryWrites.add(write);
        }
      }
      const hasUnsupportedOldEntryExpression = keyed.some((write) => {
        const expression = write instanceof MappingAssignNode ? write.expression
          : write instanceof ArrayAssignNode ? write.value : undefined;
        if (!expression || !containsCollectionAccess(expression)) return false;
        // A fixed read from another collection (`a[i] = b[0]`) already has its ordinary authenticated entry
        // witness. It does not need the destination's row-local old-value vector; reserve that vector only for
        // expressions that actually read the entry being written.
        const readsWrittenEntry = (candidate: Node): boolean => {
          const access = collectionAccessOf(candidate);
          if (access?.name === write.name
            && access.keys.map(expressionShape).join('|') === writeKeyShape(write)) return true;
          for (const key of Object.keys(candidate)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
              || key === 'collection') continue;
            const value = (candidate as unknown as Record<string, unknown>)[key];
            if (value instanceof Node && readsWrittenEntry(value)) return true;
            if (Array.isArray(value) && value.some((item) => item instanceof Node && readsWrittenEntry(item))) {
              return true;
            }
          }
          return false;
        };
        if (!readsWrittenEntry(expression)) return false;
        const collection = this.collectionsByName.get(write.name);
        const valueType = collection?.innermostValueType;
        const numericValue = valueType instanceof IntType || valueType instanceof FixedType;
        const left = expression instanceof BinaryOpNode ? collectionAccessOf(expression.left) : undefined;
        const compact = numericValue && expression instanceof BinaryOpNode
          && (expression.operator === BinaryOperator.PLUS || expression.operator === BinaryOperator.MINUS)
          && !!left && left.name === write.name
          && left.keys.map(expressionShape).join('|') === writeKeyShape(write)
          && !containsCollectionAccess(expression.right);
        if (compact) return false;
        const fixedBytes = valueType instanceof BytesType && valueType.bound !== undefined;
        const rawScalar = fixedBytes || valueType instanceof AddressType
          || valueType === PrimitiveType.PUBKEY || valueType === PrimitiveType.DATASIG;
        const structured = valueType instanceof StructType || valueType instanceof ArrayType
          || valueType === PrimitiveType.STRING
          || (valueType instanceof BytesType && valueType.bound === undefined);
        if (!(write instanceof MappingAssignNode || write instanceof ArrayAssignNode)
          || !collection
          || (!(valueType instanceof IntType) && !(valueType instanceof FixedType)
            && valueType !== PrimitiveType.BOOL && !structured && !rawScalar)) return true;
        generalOldEntryWrites.add(write);
        return false;
      });
      for (const write of structRuntimeRmws.keys()) generalOldEntryWrites.add(write);
      // Do not silently turn a physical loop rank into a logical mapping value through an alias or loop-carried
      // scalar state. Direct uses of `i` inside a write are rewritten to perm[i]; values assigned earlier in the
      // loop are intentionally left in source order, so depending on them would change program semantics.
      const loopAssignedLocals = new Set<string>();
      const loopReassignedLocals = new Set<string>();
      const loopWrittenState = new Set<string>();
      const collectLoopMutations = (x: Node): void => {
        if (x !== block && (x instanceof WhileNode || x instanceof DoWhileNode)) return;
        if (x instanceof VariableDefinitionNode) loopAssignedLocals.add(x.name);
        else if (x instanceof AssignNode) {
          loopAssignedLocals.add(x.identifier.name);
          if (x !== counterUpdate && !sourceContinueUpdates.has(x)) {
            loopReassignedLocals.add(x.identifier.name);
          }
        } else if (x instanceof StateAssignNode || x instanceof StateArrayAssignNode
          || x instanceof StateArrayDeleteNode || x instanceof StateArrayPopNode
          || x instanceof StateArrayPushNode) loopWrittenState.add(x.name);
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node) collectLoopMutations(value);
          else if (Array.isArray(value)) {
            for (const item of value) if (item instanceof Node) collectLoopMutations(item);
          }
        }
      };
      collectLoopMutations(block);
      // Direct, immutable per-iteration definitions are SSA value aliases, not loop-carried state. Mapping values
      // may inline them and then apply the same logical-value permutation as a direct expression. Definitions in
      // branches or with effects/collection reads remain fenced because their reachability/value is not invariant.
      const loopValueDefinitions = new Map<string, ExpressionNode>();
      // A scalar state recurrence must read its pre-loop value, not the value currently being updated by the
      // physical entry order. These snapshots are materialized in the function prelude before the row loop.
      const affineStateValues = new Map<string, ExpressionNode>();
      const affineStateSnapshots = new Map<string, StateAccessNode>();
      for (const statement of block.statements ?? []) {
        if (statement instanceof VariableDefinitionNode && statement.expression
          && !loopReassignedLocals.has(statement.name)
          && !hasObservableEffect(statement.expression)
          && !containsCollectionAccess(statement.expression)) {
          // Returning-helper inlining leaves the helper's effects as separate source-order statements and marks
          // only the result local as originating in a non-pure helper. The result expression itself is safe to
          // replay onto the logical key permutation when it passes the same resource-free checks as any other SSA
          // alias; the original definition and adjacent effects remain in the physical source-order loop.
          loopValueDefinitions.set(statement.name, statement.expression);
        }
      }
      // A straight-line scalar recurrence has one exact source-order value at every logical counter rank. Keep
      // the assignments in the source loop (later local uses still observe them), but let journal values use the
      // affine form so physical key permutation does not turn a source-order local into a physical-rank value.
      // Several top-level `x = x +/- constant` updates compose by summing their deltas. Branches, non-constant
      // deltas, updates after a keyed write, and hidden/nested updates remain under the loop-carried fence below.
      const loopIndex = canonical.parent.statements?.indexOf(loop) ?? -1;
      const outerInitializers = new Map<string, ExpressionNode>();
      if (loopIndex >= 0) {
        for (const statement of canonical.parent.statements!.slice(0, loopIndex)) {
          if (statement instanceof VariableDefinitionNode && statement.expression) {
            outerInitializers.set(statement.name, statement.expression);
          }
        }
      }
      const keyedStatementIndices = new Map<Node, number>();
      for (const [index, statement] of (block.statements ?? []).entries()) {
        if (keyed.includes(statement as typeof keyed[number])) keyedStatementIndices.set(statement, index);
      }
      for (const [name, joins] of conditionalAssignmentJoins) {
        if (joins.length !== 1) continue;
        const join = joins[0];
        const allAssignments = countAssignmentsTo(block, name);
        const writesAfter = [...keyedStatementIndices.values()].every((writeIndex) => writeIndex > join.index);
        if (allAssignments !== join.actualAssignments || !writesAfter
          || !runtimePathExpressionSupported(
            join.statement.expression, logical, new Set(), stateValues, loopCarriedLocalValues,
          )) continue;
        const expanded = expandRuntimePathExpression(
          join.statement.expression, logical, new Set(), stateValues, loopCarriedLocalValues,
        );
        if (expanded) loopValueDefinitions.set(name, expanded);
      }
      for (const [name, initializer] of outerInitializers) {
        const updates = (block.statements ?? []).flatMap((statement, index) => (
          statement instanceof AssignNode && statement.identifier.name === name ? [{ statement, index }] : []
        ));
        if (updates.length === 0) continue;
        let allAssignments = 0;
        const countAssignments = (candidate: Node): void => {
          if (candidate !== block && (candidate instanceof WhileNode || candidate instanceof DoWhileNode)) return;
          if (candidate instanceof AssignNode && candidate.identifier.name === name) allAssignments += 1;
          for (const key of Object.keys(candidate)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
            const value = (candidate as unknown as Record<string, unknown>)[key];
            if (value instanceof Node) countAssignments(value);
            else if (Array.isArray(value)) {
              for (const item of value) if (item instanceof Node) countAssignments(item);
            }
          }
        };
        countAssignments(block);
        if (allAssignments !== updates.length) continue;
        const deltaTerms: ExpressionNode[] = [];
        let valid = true;
        for (const { statement } of updates) {
          const recurrence = statement.expression;
          const parameterDeltaName = recurrence instanceof BinaryOpNode && recurrence.right instanceof IdentifierNode
            ? recurrence.right.name : undefined;
          const parameterDelta = parameterDeltaName !== undefined
            && node.parameters.some((parameter) => parameter.name === parameterDeltaName)
            && !loopReassignedLocals.has(parameterDeltaName);
          if (!(recurrence instanceof BinaryOpNode)
            || !(recurrence.operator === BinaryOperator.PLUS || recurrence.operator === BinaryOperator.MINUS)
            || !(recurrence.left instanceof IdentifierNode)
            || recurrence.left.name !== name
            || !(recurrence.right instanceof IntLiteralNode || parameterDelta)) {
            valid = false;
            break;
          }
          const right = cloneNode(recurrence.right);
          deltaTerms.push(recurrence.operator === BinaryOperator.PLUS
            ? right : new BinaryOpNode(new IntLiteralNode(0n), BinaryOperator.MINUS, right));
        }
        const lastUpdate = updates.at(-1)!;
        const writesAfter = [...keyedStatementIndices.values()].every((writeIndex) => writeIndex > lastUpdate.index);
        if (!valid || !writesAfter) continue;
        const rank = unitDomain
          ? new IdentifierNode(logical)
          : new BinaryOpNode(
            new BinaryOpNode(new IdentifierNode(logical), BinaryOperator.MINUS, new IntLiteralNode(start)),
            BinaryOperator.DIV, stepValue(),
          );
        const occurrence = new BinaryOpNode(rank, BinaryOperator.PLUS, new IntLiteralNode(1n));
        const netDelta = deltaTerms.reduce((sum, term) => sum === undefined
          ? term : new BinaryOpNode(sum, BinaryOperator.PLUS, term), undefined as ExpressionNode | undefined);
        if (!netDelta) continue;
        const scaled = new BinaryOpNode(occurrence, BinaryOperator.MUL, netDelta);
        const affine = new BinaryOpNode(
          cloneNode(initializer), BinaryOperator.PLUS, scaled,
        );
        const stampLocation = (candidate: Node): void => {
          candidate.location = lastUpdate.statement.location;
          for (const key of Object.keys(candidate)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
            const value = (candidate as unknown as Record<string, unknown>)[key];
            if (value instanceof Node) stampLocation(value);
            else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) stampLocation(item);
          }
        };
        stampLocation(affine);
        loopValueDefinitions.set(name, affine);
      }
      for (const name of loopWrittenState) {
        const updates = (block.statements ?? []).flatMap((statement, index) => (
          statement instanceof StateAssignNode && statement.name === name ? [{ statement, index }] : []
        ));
        if (updates.length === 0) continue;
        let allAssignments = 0;
        const countAssignments = (candidate: Node): void => {
          if (candidate !== block && (candidate instanceof WhileNode || candidate instanceof DoWhileNode)) return;
          if (candidate instanceof StateAssignNode && candidate.name === name) allAssignments += 1;
          for (const key of Object.keys(candidate)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
            const value = (candidate as unknown as Record<string, unknown>)[key];
            if (value instanceof Node) countAssignments(value);
            else if (Array.isArray(value)) {
              for (const item of value) if (item instanceof Node) countAssignments(item);
            }
          }
        };
        countAssignments(block);
        if (allAssignments !== updates.length) continue;
        const deltaTerms: ExpressionNode[] = [];
        let source: StateAccessNode | undefined;
        let valid = true;
        for (const { statement } of updates) {
          const recurrence = statement.expression;
          const parameterDeltaName = recurrence instanceof BinaryOpNode && recurrence.right instanceof IdentifierNode
            ? recurrence.right.name : undefined;
          const parameterDelta = parameterDeltaName !== undefined
            && node.parameters.some((parameter) => parameter.name === parameterDeltaName)
            && !loopReassignedLocals.has(parameterDeltaName);
          if (!(recurrence instanceof BinaryOpNode)
            || !(recurrence.operator === BinaryOperator.PLUS || recurrence.operator === BinaryOperator.MINUS)
            || !(recurrence.left instanceof StateAccessNode)
            || recurrence.left.name !== name
            || !(recurrence.right instanceof IntLiteralNode || parameterDelta)) {
            valid = false;
            break;
          }
          source ??= recurrence.left;
          const right = cloneNode(recurrence.right);
          deltaTerms.push(recurrence.operator === BinaryOperator.PLUS
            ? right : new BinaryOpNode(new IntLiteralNode(0n), BinaryOperator.MINUS, right));
        }
        const lastUpdate = updates.at(-1)!;
        const writesAfter = [...keyedStatementIndices.values()].every((writeIndex) => writeIndex > lastUpdate.index);
        if (!valid || !source || !writesAfter) continue;
        const snapshot = `__internal__vmapCounterStateBase_${serial}_${name}`;
        affineStateSnapshots.set(snapshot, cloneNode(source));
        const rank = unitDomain
          ? new IdentifierNode(logical)
          : new BinaryOpNode(
            new BinaryOpNode(new IdentifierNode(logical), BinaryOperator.MINUS, new IntLiteralNode(start)),
            BinaryOperator.DIV, stepValue(),
          );
        const occurrence = new BinaryOpNode(rank, BinaryOperator.PLUS, new IntLiteralNode(1n));
        const netDelta = deltaTerms.reduce((sum, term) => sum === undefined
          ? term : new BinaryOpNode(sum, BinaryOperator.PLUS, term), undefined as ExpressionNode | undefined);
        if (!netDelta) continue;
        const scaled = new BinaryOpNode(occurrence, BinaryOperator.MUL, netDelta);
        const affine = new BinaryOpNode(new IdentifierNode(snapshot), BinaryOperator.PLUS, scaled);
        const stampLocation = (candidate: Node): void => {
          candidate.location = lastUpdate.statement.location;
          for (const key of Object.keys(candidate)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
            const value = (candidate as unknown as Record<string, unknown>)[key];
            if (value instanceof Node) stampLocation(value);
            else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) stampLocation(item);
          }
        };
        stampLocation(affine);
        affineStateValues.set(name, affine);
      }
      const safeLoopValueAlias = (name: string, seen = new Set<string>()): boolean => {
        const expression = loopValueDefinitions.get(name);
        if (!expression || seen.has(name)) return false;
        const next = new Set(seen).add(name);
        let safe = true;
        const walk = (candidate: Node): void => {
          if (!safe) return;
          if (candidate instanceof IdentifierNode && candidate.name !== logical
            && loopAssignedLocals.has(candidate.name)
            && !safeLoopValueAlias(candidate.name, next)) { safe = false; return; }
          if (candidate instanceof StateAccessNode && loopWrittenState.has(candidate.name)) {
            if (!affineStateValues.has(candidate.name)) { safe = false; return; }
          }
          for (const key of Object.keys(candidate)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
            const value = (candidate as unknown as Record<string, unknown>)[key];
            if (value instanceof Node) walk(value);
            else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
          }
        };
        walk(expression);
        return safe;
      };
      const dependsOnLoopMutation = (
        x: Node, resolving = new Set<string>(), allowAffineStateValue = false,
      ): boolean => {
        if (x instanceof IdentifierNode && x.name !== logical && loopAssignedLocals.has(x.name)) {
          if (!safeLoopValueAlias(x.name, resolving)) return true;
          return dependsOnLoopMutation(
            loopValueDefinitions.get(x.name)!, new Set(resolving).add(x.name), allowAffineStateValue,
          );
        }
        if (x instanceof StateAccessNode && loopWrittenState.has(x.name)) {
          return !allowAffineStateValue || !affineStateValues.has(x.name);
        }
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node && dependsOnLoopMutation(value, resolving, allowAffineStateValue)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node
              && dependsOnLoopMutation(item, resolving, allowAffineStateValue))) return true;
        }
        return false;
      };
      const dependsOnPermutedLogical = (x: Node, resolving = new Set<string>()): boolean => {
        if (x instanceof IdentifierNode) {
          if (x.name === logical) return true;
          if (loopValueDefinitions.has(x.name) && !resolving.has(x.name)) {
            return dependsOnPermutedLogical(
              loopValueDefinitions.get(x.name)!, new Set(resolving).add(x.name),
            );
          }
        }
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node && dependsOnPermutedLogical(value, resolving)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node
              && dependsOnPermutedLogical(item, resolving))) return true;
        }
        return false;
      };
      const hasLoopCarriedWriteGuard = (x: Node): boolean => {
        if (x instanceof BranchNode && containsKeyedWrite(x)
          && (dependsOnLoopMutation(x.condition) || dependsOnPermutedLogical(x.condition))) return true;
        if (x instanceof SwitchNode && containsKeyedWrite(x)
          && (dependsOnLoopMutation(x.expression) || dependsOnPermutedLogical(x.expression))) return true;
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node && hasLoopCarriedWriteGuard(value)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && hasLoopCarriedWriteGuard(item))) return true;
        }
        return false;
      };
      type ValueTracePlan = {
        witnessParam: string;
        valueType: Type;
        local: string;
        initial: ExpressionNode;
        updates: Array<{ condition?: ExpressionNode; expression: ExpressionNode }>;
        afterUpdates: Array<{ condition?: ExpressionNode; expression: ExpressionNode }>;
      };
      const valueTracePlans = new Map<MappingAssignNode, ValueTracePlan>();
      const hasAbruptControl = (candidate: Node): boolean => {
        if (candidate instanceof BreakNode || candidate instanceof ContinueNode || candidate instanceof ReturnNode) {
          return true;
        }
        if (candidate !== block && (candidate instanceof WhileNode || candidate instanceof DoWhileNode)) return true;
        for (const [key, value] of Object.entries(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof Node && hasAbruptControl(value)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && hasAbruptControl(item))) return true;
        }
        return false;
      };
      // A physical mapping loop cannot evaluate a loop-carried local in key order without changing the source
      // recurrence. Publish the source-order values instead. The executable loop checks every witness element
      // against the real local before the write; the physical write later addresses that vector by logical rank.
      // This is deliberately a dataflow rule, not a catalogue of conditional shapes: any sequence of pure local
      // assignments under replayable branch/switch predicates is represented by the same ordered update trace.
      if (!hasAbruptControl(block)) {
        for (const [writeIndex, write] of keyed.entries()) {
          if (!(write instanceof MappingAssignNode)
            || !(write.expression instanceof IdentifierNode)) continue;
          const local = write.expression.name;
          if (!loopAssignedLocals.has(local) || safeLoopValueAlias(local)) continue;
          const initial = predicateOuterInitializers.get(local);
          const valueType = this.collectionsByName.get(write.name)?.innermostValueType;
          const reassignedBeforeLoop = predicateOuterIndex >= 0
            && canonical.parent.statements!.slice(0, predicateOuterIndex)
              .some((statement) => countAssignmentsTo(statement, local) > 0);
          if (!initial || !valueType || !runtimePathExpressionSupported(
            initial, logical, new Set(), stateValues, loopCarriedLocalValues,
          ) || reassignedBeforeLoop || valueType instanceof StructType || valueType instanceof ArrayType) continue;
          const statementIndex = (block.statements ?? []).findIndex((statement) => containsNode(statement, write));
          if (statementIndex < 0) continue;
          const collected: Array<{
            index: number; condition?: ExpressionNode; expression: ExpressionNode;
          }> = [];
          let supported = true;
          const collect = (candidate: Node, index: number, condition?: ExpressionNode): void => {
            if (!supported) return;
            if (candidate !== block && (candidate instanceof WhileNode || candidate instanceof DoWhileNode)) {
              supported = false; return;
            }
            if (candidate instanceof AssignNode && candidate.identifier.name === local) {
              collected.push({
                index,
                condition: condition && cloneNode(condition),
                expression: cloneNode(candidate.expression),
              });
              return;
            }
            if (candidate instanceof BlockNode) {
              for (const statement of candidate.statements ?? []) collect(statement, index, condition);
              return;
            }
            if (candidate instanceof BranchNode) {
              collect(candidate.ifBlock, index, pathAnd(condition, candidate.condition));
              if (candidate.elseBlock) collect(
                candidate.elseBlock, index, pathAnd(condition, pathNot(candidate.condition)),
              );
              return;
            }
            if (candidate instanceof SwitchNode) {
              const matches = candidate.cases.map((entry) => {
                const equality = new BinaryOpNode(
                  cloneNode(candidate.expression), BinaryOperator.EQ, cloneNode(entry.value),
                );
                equality.location = entry.location ?? candidate.location;
                return equality;
              });
              candidate.cases.forEach((entry, caseIndex) => collect(
                entry.body, index, pathAnd(condition, matches[caseIndex]),
              ));
              if (candidate.defaultCase) {
                const defaultPath = matches.reduce<ExpressionNode | undefined>(
                  (active, match) => pathAnd(active, pathNot(match)), condition,
                );
                collect(candidate.defaultCase, index, defaultPath);
              }
              return;
            }
            // An assignment hidden in another construct is not a replayable straight-line recurrence.
            if (countAssignmentsTo(candidate, local) > 0) supported = false;
          };
          (block.statements ?? []).forEach((statement, index) => collect(statement, index));
          if (!supported || collected.length === 0
            || collected.length !== countAssignmentsTo(block, local)) continue;
          const substituteLocal = (candidate: Node): Node => {
            if (candidate instanceof IdentifierNode && candidate.name === local) return cloneNode(initial);
            for (const [key, value] of Object.entries(candidate)) {
              if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
                || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
              if (value instanceof Node) {
                (candidate as unknown as Record<string, unknown>)[key] = substituteLocal(value);
              } else if (Array.isArray(value)) {
                (candidate as unknown as Record<string, unknown>)[key] = value.map((item) =>
                  item instanceof Node ? substituteLocal(item) : item);
              }
            }
            return candidate;
          };
          for (const update of collected) {
            if (update.condition && (containsIdentifier(update.condition, local)
              || !runtimePathExpressionSupported(
                update.condition, logical, new Set(), stateValues, loopCarriedLocalValues,
              ))) { supported = false; break; }
            const check = substituteLocal(cloneNode(update.expression));
            if (!runtimePathExpressionSupported(
              check as ExpressionNode, logical, new Set(), stateValues, loopCarriedLocalValues,
            ) || dependsOnLoopMutation(check, new Set(), true)) { supported = false; break; }
          }
          if (!supported) continue;
          valueTracePlans.set(write, {
            witnessParam: `${VMAP_COUNTER_VALUE_PREFIX}${write.name}_${serial}_${writeIndex}`,
            valueType,
            local,
            initial: cloneNode(initial),
            updates: collected.filter((update) => update.index < statementIndex)
              .map(({ condition, expression }) => ({ condition, expression })),
            afterUpdates: collected.filter((update) => update.index > statementIndex)
              .map(({ condition, expression }) => ({ condition, expression })),
          });
        }
      }
      if ((!writeSelectionCondition && hasCounterDependentGuard(block))
        || hasSiblingMappingRead(block) || hasUnsafeRead(block)
        || hasUnsupportedOldEntryExpression
        || (!writeSelectionCondition && hasLoopCarriedWriteGuard(block))
        || keyed.some((write) => !structRuntimeRmws.has(write as ArrayAssignNode | MappingAssignNode)
          && !valueTracePlans.has(write as MappingAssignNode)
          && dependsOnLoopMutation(write, new Set(), true))) return false;

      if (!apply) return true;

      if (stepSnapshot && stepExpression) {
        const snapshot = new VariableDefinitionNode(
          new IntType(true, 256), [], stepSnapshot, cloneNode(stepExpression),
        );
        snapshot.location = location;
        prelude.push(snapshot);
      }

      // Publish the fully resolved progression once this pass has proved the loop canonical. A source do-while
      // counter has no AstBuilder progression metadata, while a for-loop step may still name a local which was
      // reassigned before the loop. External-call planning must replay this point-in-time expression rather than
      // classify the counter as its initializer or serialize the stale source identifier.
      {
        const sourceLoopIndex = canonical.parent.statements?.indexOf(loop) ?? -1;
        const variable = sourceLoopIndex > 0
          ? canonical.parent.statements?.[sourceLoopIndex - 1] : undefined;
        if (variable instanceof VariableDefinitionNode) {
          variable.loopInitialValue = start;
          if (stepExpression) {
            variable.loopStepValue = undefined;
            variable.loopStepExpression = cloneNode(stepExpression);
          } else {
            variable.loopStepValue = step;
            variable.loopStepExpression = undefined;
          }
        }
      }

      // Evaluate replayed invariant keys before any source assignments and use the immutable local for both the
      // physical loop and its function-wide authenticated cache. This preserves `k = f(k); m[g(k)] = ...`
      // without evaluating `f` twice or depending on the physical permutation order.
      const keySnapshotsByShape = new Map<string, IdentifierNode>();
      for (const [write, keys] of invariantKeyPlans) {
        const collection = this.collectionsByName.get(write.name)!;
        write.keys = write.keys.map((key, index) => {
          const expanded = keys[index];
          if (expressionShape(expanded) === expressionShape(key)) return key;
          const type = expanded.type ?? key.type ?? collection.allKeyTypes[index];
          const shape = `${type.toString()}\0${expressionShape(expanded)}`;
          const existing = keySnapshotsByShape.get(shape);
          if (existing) return cloneNode(existing);
          const name = `${VMAP_KEY_SNAPSHOT_PREFIX}${this.serial++}`;
          const definition = new VariableDefinitionNode(
            type, [], name, cloneNode(expanded),
          );
          definition.location = key.location ?? write.location;
          keySnapshotPrelude.push(definition);
          const snapshot = new IdentifierNode(name);
          snapshot.location = key.location ?? write.location;
          snapshot.type = definition.type;
          keySnapshotsByShape.set(shape, snapshot);
          return snapshot;
        });
      }

      const expandedBreakCondition = breakPaths.length > 0 && (breakCondition
        ? expandRuntimePathExpression(
          breakCondition, logical, new Set(), stateValues, loopCarriedLocalValues,
        )
        : new BoolLiteralNode(true));
      if (breakPaths.length > 0 && !expandedBreakCondition) return false;
      const signedComponent = (value: bigint): string => value < 0n ? `n${-value}` : `p${value}`;
      const rangeSuffix = unitDomain
        ? '' : `_from_${signedComponent(start)}_step_${stepExpression
          ? `runtime_${step > 0n ? 'p' : 'n'}` : signedComponent(step)}`;
      const boundSuffix = boundOffset === 0n ? '' : `_bound_${signedComponent(boundOffset)}`;
      const hiddenName = (groupSerial: number): string =>
        `${PREFIX}${count}_${groupSerial}${boundSuffix}${rangeSuffix}${postTest ? '_post' : ''}`;
      const keyedByStream = new Map<string, typeof keyed>();
      for (const write of keyed) {
        const stream = `${write.name}\0${writeKeyShape(write)}`;
        const group = keyedByStream.get(stream) ?? [];
        group.push(write);
        keyedByStream.set(stream, group);
      }
      const permutationGroups = new Map<string, {
        collections: string[];
        collectionWrites: typeof keyed;
        selectionCondition?: ExpressionNode;
      }>();
      for (const [stream, collectionWrites] of keyedByStream) {
        const collection = stream.slice(0, stream.indexOf('\0'));
        let selectionCondition = uniqueDisjunction(collectionWrites.map((write) => writePaths.get(write)));
        // An otherwise-unconditional collection still needs a cursor when `break`/`return` can terminate the
        // domain: the cursor authenticates the consumed prefix and carries the shared break predicate metadata.
        if (breakPaths.length > 0 && !selectionCondition) selectionCondition = new BoolLiteralNode(true);
        const mergeKey = `${writeKeyShape(collectionWrites[0])}\0${selectionCondition
          ? expressionShape(selectionCondition) : 'always'}`;
        const existing = permutationGroups.get(mergeKey);
        if (existing) {
          existing.collections.push(collection);
          existing.collectionWrites.push(...collectionWrites);
        } else {
          permutationGroups.set(mergeKey, {
            collections: [collection], collectionWrites: [...collectionWrites], selectionCondition,
          });
        }
      }
      const groups = [...permutationGroups.values()].map((plan, index) => {
        const groupSerial = index === 0 ? serial : this.serial++;
        const { selectionCondition } = plan;
        const expandedSelectionCondition = selectionCondition
          && expandRuntimePathExpression(
            selectionCondition, logical, new Set(), stateValues, loopCarriedLocalValues,
          );
        return {
          collections: plan.collections,
          writes: new Set<Node>(plan.collectionWrites),
          serial: groupSerial,
          hidden: hiddenName(groupSerial),
          selectionCondition,
          expandedSelectionCondition,
          logicalValue: `__internal__vmapCounterLogical_${groupSerial}`,
          logicalRank: `__internal__vmapCounterRank_${groupSerial}`,
          settlementCursor: `__internal__vmapCounterCursor_${groupSerial}`,
          bit: `__internal__vmapCounterBit_${groupSerial}`,
          mask: `__internal__vmapCounterMask_${groupSerial}`,
          inputCount: undefined as string | undefined,
          outputCount: undefined as string | undefined,
        };
      });
      if (groups.some((group) => group.selectionCondition && !group.expandedSelectionCondition)) return false;
      const collectionStreamCounts = new Map<string, number>();
      for (const group of groups) for (const collection of group.collections) {
        collectionStreamCounts.set(collection, (collectionStreamCounts.get(collection) ?? 0) + 1);
      }
      for (const group of groups) if (group.collections.some(
        (collection) => (collectionStreamCounts.get(collection) ?? 0) > 1,
      )) {
        group.inputCount = `${VMAP_COUNTER_INPUT_COUNT_PREFIX}${group.serial}`;
        group.outputCount = `${VMAP_COUNTER_OUTPUT_COUNT_PREFIX}${group.serial}`;
      }
      const groupByWrite = new Map(groups.flatMap((group) =>
        [...group.writes].map((write) => [write, group] as const)));
      const primaryGroup = groups[0];
      for (const group of groups) {
        (node.runtimeCounterLoopCounters ??= new Map()).set(group.hidden, {
          name: logical, initialValue: start, stepValue: step,
          ...(stepExpression && { stepExpression: cloneNode(stepExpression) }),
          ...(exactBound && { exactBound: true }),
        });
        if (group.inputCount && group.outputCount) {
          (node.runtimeCounterLoopCardinalityParams ??= new Map()).set(group.hidden, {
            input: group.inputCount, output: group.outputCount,
          });
        }
        if (boundExpression) {
          (node.runtimeCounterLoopBounds ??= new Map()).set(group.hidden, cloneNode(boundExpression));
        }
        if (pathCondition) {
          (node.runtimeCounterLoopConditions ??= new Map()).set(group.hidden, cloneNode(pathCondition));
        }
        if (group.expandedSelectionCondition) {
          (node.runtimeCounterLoopIterationConditions ??= new Map()).set(group.hidden, {
            expression: cloneNode(group.expandedSelectionCondition),
            ...(expandedBreakCondition && { breakCondition: cloneNode(expandedBreakCondition) }),
            counter: {
              name: logical, initialValue: start, stepValue: step,
              ...(stepExpression && { stepExpression: cloneNode(stepExpression) }),
            },
          });
        }
      }
      const oldValueHidden = (write: Node & { name: string }): string => {
        const group = groupByWrite.get(write)!;
        return `${VMAP_COUNTER_OLD_PREFIX}${count}_${group.serial}_${write.name}`;
      };
      const rangedIterationCount = `__internal__vmapCounterCount_${serial}`;
      const at = <T extends Node>(value: T): T => { value.location = location; return value; };
      const id = (name: string): IdentifierNode => at(new IdentifierNode(name));
      const lit = (value: bigint): IntLiteralNode => at(new IntLiteralNode(value));
      const binary = (left: ExpressionNode, operator: BinaryOperator, right: ExpressionNode): BinaryOpNode =>
        at(new BinaryOpNode(left, operator, right));
      const proofInt = new IntType(true, 256);
      const asProofInt = (expression: ExpressionNode): ExpressionNode => counterType.signed
        ? expression : at(new CastNode(proofInt, expression, false));
      const proofStepValue = (): ExpressionNode => asProofInt(stepValue());
      const stepMagnitude = (): ExpressionNode => step > 0n
        ? proofStepValue() : binary(lit(0n), BinaryOperator.MINUS, proofStepValue());
      const sourceBoundValue = (): ExpressionNode => boundExpression
        ? cloneNode(boundExpression)
        : boundOffset === 0n ? id(count) : binary(id(count), BinaryOperator.PLUS, lit(boundOffset));
      // A replayable straight-line assignment may mutate the parameter/local named by the source loop condition.
      // The length check is in the function prelude, but range proofs also execute inside the source loop after
      // those assignments. Snapshot the expanded pre-assignment recipe once so both sites authenticate one domain.
      const boundSnapshot = boundAssignments.length > 0
        ? `__internal__vmapCounterBound_${serial}` : undefined;
      if (boundSnapshot) {
        prelude.push(at(new VariableDefinitionNode(
          proofInt, [], boundSnapshot, asProofInt(sourceBoundValue()),
        )));
      }
      for (const [snapshot, source] of affineStateSnapshots) {
        prelude.push(at(new VariableDefinitionNode(
          source.type ?? source.stateVariable?.type ?? new IntType(true, 256), [], snapshot, cloneNode(source),
        )));
      }
      const boundValue = (): ExpressionNode => boundSnapshot
        ? id(boundSnapshot) : asProofInt(sourceBoundValue());
      const exactDistance = (): ExpressionNode => step > 0n
        ? binary(boundValue(), BinaryOperator.MINUS, lit(start))
        : binary(lit(start), BinaryOperator.MINUS, boundValue());
      const positiveIterationCount = (): ExpressionNode => binary(
        binary(binary(
          step > 0n
            ? binary(boundValue(), BinaryOperator.MINUS, lit(start))
            : binary(lit(start), BinaryOperator.MINUS, boundValue()),
          BinaryOperator.MINUS, lit(1n)),
        BinaryOperator.DIV, stepMagnitude()),
        BinaryOperator.PLUS,
        lit(1n),
      );
      const derivedIterationCount = (): ExpressionNode => at(new TernaryOpNode(
        binary(boundValue(), step > 0n ? BinaryOperator.GT : BinaryOperator.LT, lit(start)),
        positiveIterationCount(),
        lit(postTest ? 1n : 0n),
      ));
      const rawIterationCount = (): ExpressionNode => {
        // Preserve the established unit-domain form: it is both smaller and bytecode-compatible with existing
        // counter rows. General progressions pay for the ceiling division only when they actually need it.
        if (unitDomain && !postTest && boundOffset === 0n) return boundValue();
        if (unitDomain) {
          return at(new TernaryOpNode(
            binary(boundValue(), BinaryOperator.GT, lit(0n)), boundValue(), lit(postTest ? 1n : 0n),
          ));
        }
        return id(rangedIterationCount);
      };
      const activePath = (): ExpressionNode => cloneNode(pathCondition!);
      const iterationCount = (): ExpressionNode => pathCondition
        ? at(new TernaryOpNode(activePath(), rawIterationCount(), lit(0n)))
        : rawIterationCount();
      const physical = (group: typeof groups[number]): ExpressionNode => {
        // The source counter remains on its original arithmetic progression so calls and other effects observe
        // source order. Only mapping work indexes the physical permutation, using the counter's zero-based rank.
        if (group.expandedSelectionCondition) return id(group.settlementCursor);
        if (unitDomain) return id(logical);
        return binary(binary(id(logical), BinaryOperator.MINUS, lit(start)), BinaryOperator.DIV, proofStepValue());
      };
      const sourceRank = (): ExpressionNode => unitDomain
        ? id(logical)
        : binary(binary(id(logical), BinaryOperator.MINUS, lit(start)),
          BinaryOperator.DIV, proofStepValue());
      const permRead = (group: typeof groups[number]): ArrayAccessNode => {
        const a = new IdentifierNode(group.hidden); a.location = location;
        const r = new ArrayAccessNode(a, physical(group)); r.location = location; return r;
      };
      const replace = (x: Node, group: typeof groups[number]): Node => {
        // Old-entry witnesses are settlement-position vectors. Their subscript is the physical loop rank (or
        // selected-write cursor), never the permuted logical key. In particular, ranged domains such as 3,5,7
        // cannot soundly use the key itself as an index into a three-element witness.
        if (x instanceof ArrayAccessNode && x.array instanceof IdentifierNode
          && x.array.name.startsWith(VMAP_COUNTER_OLD_PREFIX)) return x;
        if (x instanceof IdentifierNode && x.name === logical) return id(group.logicalValue);
        if (x instanceof IdentifierNode && safeLoopValueAlias(x.name)) {
          return replace(cloneNode(loopValueDefinitions.get(x.name)!), group);
        }
        if (x instanceof StateAccessNode && affineStateValues.has(x.name)) {
          const rewriteLogical = (candidate: Node): Node => {
            if (candidate instanceof IdentifierNode && candidate.name === logical) return id(group.logicalValue);
            for (const key of Object.keys(candidate)) {
              if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
              const value = (candidate as unknown as Record<string, unknown>)[key];
              if (value instanceof Node) (candidate as unknown as Record<string, unknown>)[key] = rewriteLogical(value);
              else if (Array.isArray(value)) {
                (candidate as unknown as Record<string, unknown>)[key] = value.map((item) =>
                  item instanceof Node ? rewriteLogical(item) : item);
              }
            }
            return candidate;
          };
          return rewriteLogical(cloneNode(affineStateValues.get(x.name)!));
        }
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
          const v = (x as unknown as Record<string, unknown>)[key];
          if (v instanceof Node) (x as unknown as Record<string, unknown>)[key] = replace(v, group);
          else if (Array.isArray(v)) {
            (x as unknown as Record<string, unknown>)[key] = v.map((e) =>
              e instanceof Node ? replace(e, group) : e);
          }
        }
        return x;
      };
      const replaceKey = (x: Node, group: typeof groups[number]): Node => {
        // Unlike a value expression, a derived key must retain the hidden permutation array in its canonical
        // recipe so code generation can identify the varying source even when no tuple component is the bare
        // counter (`m[i == 0 ? first : second]`). The logical value and perm[rank] are equal by construction.
        if (x instanceof IdentifierNode && x.name === logical) return permRead(group);
        if (x instanceof IdentifierNode && safeLoopValueAlias(x.name)) {
          return replaceKey(cloneNode(loopValueDefinitions.get(x.name)!), group);
        }
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node) {
            (x as unknown as Record<string, unknown>)[key] = replaceKey(value, group);
          } else if (Array.isArray(value)) {
            (x as unknown as Record<string, unknown>)[key] = value.map((item) =>
              item instanceof Node ? replaceKey(item, group) : item);
          }
        }
        return x;
      };
      const insertBefore = (owner: BlockNode, target: StatementNode, statement: StatementNode): boolean => {
        const index = owner.statements?.indexOf(target) ?? -1;
        if (index >= 0) {
          owner.statements!.splice(index, 0, statement);
          return true;
        }
        for (const child of owner.statements ?? []) {
          if (child instanceof BlockNode && insertBefore(child, target, statement)) return true;
          if (child instanceof BranchNode) {
            if (insertBefore(child.ifBlock, target, statement)) return true;
            if (child.elseBlock && insertBefore(child.elseBlock, target, statement)) return true;
          }
          if (child instanceof SwitchNode) {
            for (const switchCase of child.cases) {
              if (insertBefore(switchCase.body, target, statement)) return true;
            }
            if (child.defaultCase && insertBefore(child.defaultCase, target, statement)) return true;
          }
        }
        return false;
      };
      for (const plan of runtimeReadPlans) {
        const sourceGroup = groupByWrite.get(plan.synthetic);
        const destinationGroup = groupByWrite.get(plan.destination);
        if (!sourceGroup || !destinationGroup) return false;
        const logicalRank = (group: typeof groups[number]): IdentifierNode =>
          id(unitDomain ? group.logicalValue : group.logicalRank);
        // The witness is indexed by source occurrence, not either stream's physical rank. The source permutation
        // authenticates witness[logical(source)] while the destination permutation consumes witness[logical(dest)],
        // allowing independent key recipes such as source[i + 1] -> destination[i].
        for (const read of plan.authenticatedReads) read.index = logicalRank(sourceGroup);
        for (const read of plan.consumerReads) read.index = logicalRank(destinationGroup);
        if (!insertBefore(block, plan.destination, plan.synthetic)) return false;
      }
      for (const write of keyed) {
        const group = groupByWrite.get(write)!;
        const keyRecipe = `${group.hidden}\0${write.name}`;
        const originalKeys = keyExpressions(write);
        const hasDirectCounterComponent = originalKeys.some((key) =>
          key instanceof IdentifierNode && key.name === logical);
        const hasDerivedCounterComponent = originalKeys.some((key) =>
          containsIdentifier(key, logical) && !(key instanceof IdentifierNode && key.name === logical));
        if (hasDerivedCounterComponent && !node.runtimeCounterLoopKeyExpressions?.has(keyRecipe)) {
          (node.runtimeCounterLoopKeyExpressions ??= new Map()).set(
            keyRecipe, originalKeys.map((key) => cloneNode(key)),
          );
        }
        const expression = write instanceof ArrayAssignNode ? write.value
          : write instanceof MappingAssignNode ? write.expression : undefined;
        const valueTrace = write instanceof MappingAssignNode ? valueTracePlans.get(write) : undefined;
        if (valueTrace && expression) {
          const mappingWrite = write as MappingAssignNode;
          const valueType = this.collectionsByName.get(write.name)!.innermostValueType;
          const witness = (): IdentifierNode => {
            const result = id(valueTrace.witnessParam);
            result.type = new ArrayType(valueType);
            return result;
          };
          const readAt = (index: ExpressionNode): ArrayAccessNode => {
            const result = new ArrayAccessNode(witness(), index);
            result.location = write.location ?? location;
            result.type = valueType;
            return result;
          };
          // The source-side authentication executes only when the source write is reached. It therefore indexes
          // the complete trace by source rank, not by this stream's compact selected-write cursor.
          const sourceValue = readAt(sourceRank());
          const check = at(new RequireNode(binary(
            sourceValue, BinaryOperator.EQ, cloneNode(expression),
          ), 'vmap counter value trace mismatch'));
          if (!insertBefore(block, write, check)) return false;
          const permutedRank = unitDomain ? id(group.logicalValue) : id(group.logicalRank);
          mappingWrite.expression = readAt(permutedRank);
          mappingWrite.messageBusRuntimeValueTrace = valueTrace;
        }
        if (expression instanceof BinaryOpNode
          && (expression.operator === BinaryOperator.PLUS || expression.operator === BinaryOperator.MINUS)
          && collectionAccessOf(expression.left) !== undefined) {
          // Admission above proved this direct left operand is the same collection/key and that the right side
          // contains no collection read. Preserve that ownership across the key/value permutation rewrite so the
          // route census does not invent a fixed witness for a value supplied by the runtime journal entry.
          expression.left.messageBusRuntimeLoopTransitionRead = true;
        }
        if (generalOldEntryWrites.has(write as ArrayAssignNode | MappingAssignNode)) {
          const mappingWrite = write as ArrayAssignNode | MappingAssignNode;
          const oldRead = (): ArrayAccessNode => {
            const valueType = this.collectionsByName.get(mappingWrite.name)!.innermostValueType;
            const values = new IdentifierNode(oldValueHidden(mappingWrite)); values.location = location;
            values.type = new ArrayType(valueType);
            const read = new ArrayAccessNode(values, physical(group)); read.location = location;
            read.type = valueType;
            return read;
          };
          const replaceOldEntry = (candidate: Node): Node => {
            const access = candidate instanceof ExpressionNode ? collectionAccessOf(candidate) : undefined;
            if (access?.name === mappingWrite.name
              && access.keys.map(expressionShape).join('|') === writeKeyShape(mappingWrite)) return oldRead();
            for (const property of Object.keys(candidate)) {
              if (property === 'location' || property === 'definition' || property === 'symbol'
                || property === 'type' || property === 'collection') continue;
              const value = (candidate as unknown as Record<string, unknown>)[property];
              if (value instanceof Node) {
                (candidate as unknown as Record<string, unknown>)[property] = replaceOldEntry(value);
              } else if (Array.isArray(value)) {
                (candidate as unknown as Record<string, unknown>)[property] = value.map((item) =>
                  item instanceof Node ? replaceOldEntry(item) : item);
              }
            }
            return candidate;
          };
          if (mappingWrite instanceof MappingAssignNode) {
            mappingWrite.expression = replaceOldEntry(mappingWrite.expression) as ExpressionNode;
          } else {
            mappingWrite.value = replaceOldEntry(mappingWrite.value) as ExpressionNode;
          }
          mappingWrite.messageBusRuntimeOldValueWitness = oldRead();
          const structRmw = structRuntimeRmws.get(mappingWrite);
          if (structRmw) {
            structRmw.declaration.expression = cloneNode(
              mappingWrite.messageBusRuntimeOldValueWitness,
            ) as ExpressionNode;
          }
        }
        if (write instanceof ArrayAssignNode) {
          // Before the symbol pass, a mapping whose value is itself array-like is still represented as an
          // ArrayAssignNode. Its `index` is the complete mapping key expression, not necessarily the bare loop
          // counter. Preserve derived forms such as `m[keys[i]]` and rewrite only their counter dependency to the
          // authenticated permutation; replacing the whole expression with `perm[i]` would store the entry under
          // the logical array index rather than under `keys[perm[i]]`.
          write.index = write.index instanceof IdentifierNode && write.index.name === logical
            ? permRead(group)
            : containsIdentifier(write.index, logical)
              ? (hasDirectCounterComponent ? replace(write.index, group) : replaceKey(write.index, group)) as ExpressionNode
              : write.index;
          write.value = replace(write.value, group) as ExpressionNode;
        } else if (write instanceof ArrayDeleteNode) {
          write.index = write.index instanceof IdentifierNode && write.index.name === logical
            ? permRead(group)
            : containsIdentifier(write.index, logical)
              ? (hasDirectCounterComponent ? replace(write.index, group) : replaceKey(write.index, group)) as ExpressionNode
              : write.index;
        } else if (write instanceof MappingAssignNode || write instanceof MappingFieldAssignNode) {
          write.keys = write.keys.map((key) => key instanceof IdentifierNode && key.name === logical
            ? permRead(group)
            : containsIdentifier(key, logical)
              ? (hasDirectCounterComponent ? replace(key, group) : replaceKey(key, group)) as ExpressionNode
              : key);
          if (write instanceof MappingAssignNode && write.arrayIndex) {
            write.arrayIndex = replace(write.arrayIndex, group) as ExpressionNode;
          }
          write.expression = replace(write.expression, group) as ExpressionNode;
        } else {
          write.keys = write.keys.map((key) => key instanceof IdentifierNode && key.name === logical
            ? permRead(group)
            : containsIdentifier(key, logical)
              ? (hasDirectCounterComponent ? replace(key, group) : replaceKey(key, group)) as ExpressionNode
              : key);
        }
      }
      if (runtimeEmits.length > 0) {
        const eventLoopIndex = node.runtimeLoopEvents?.length ?? 0;
        node.runtimeLoopEvents = [
          ...(node.runtimeLoopEvents ?? []),
          { loopIndex: eventLoopIndex, permutationParam: primaryGroup.hidden },
        ];
        runtimeEmits.forEach(({ emit, condition }, siteIndex) => {
          emit.runtimeLoopEvent = { loopIndex: eventLoopIndex, siteIndex };
          emit.runtimeLoopEventCondition = condition;
          emit.runtimeLoopEventCounter = {
            name: logical, initialValue: start, stepValue: step,
            ...(stepExpression && { stepExpression: cloneNode(stepExpression) }),
          };
        });
      }
      if (runtimeTransfers.length > 0) {
        const transferLoopIndex = node.runtimeLoopTransfers?.length ?? 0;
        node.runtimeLoopTransfers = [
          ...(node.runtimeLoopTransfers ?? []),
          {
            loopIndex: transferLoopIndex,
            permutationParam: primaryGroup.hidden,
            siteKinds: runtimeTransfers.map(({ transfer }) =>
              transfer instanceof TokenContainerMethodStatementNode
                ? (transfer.methodName === 'transferNft' ? 'nft' : 'token') : 'bch'),
          },
        ];
        runtimeTransfers.forEach(({ transfer, condition }, siteIndex) => {
          transfer.runtimeLoopTransfer = { loopIndex: transferLoopIndex, siteIndex };
          transfer.runtimeLoopTransferCondition = condition;
          transfer.runtimeLoopTransferCounter = {
            name: logical, initialValue: start, stepValue: step,
            ...(stepExpression && { stepExpression: cloneNode(stepExpression) }),
          };
        });
        // Admission can revisit an AST which already received fixed transfer ordinals in an earlier semantic
        // rung. Force the later symbol pass to rebuild that frame, excluding the newly runtime-owned sites.
        node.transferInfos = undefined;
      }
      // The balanced route reserves the worst-case output width of every admitted runtime counter loop. One
      // iteration produces one mapping entry per distinct collection plus one record per unconditional event
      // site. Summing here handles sequential loops and multi-collection loops without recognizing a contract
      // schema later in layout planning.
      node.runtimeCounterLoopOutputCapacity = (node.runtimeCounterLoopOutputCapacity ?? 0)
        + MAX_COUNTER_ITERATIONS * (keyedByStream.size + runtimeEmits.length + runtimeTransfers.length);
      const whenLoopActive = (expression: ExpressionNode): ExpressionNode => pathCondition
        ? at(new TernaryOpNode(activePath(), expression, at(new BoolLiteralNode(true))))
        : expression;
      if (stepExpression) {
        prelude.push(at(new RequireNode(whenLoopActive(binary(
          proofStepValue(), step > 0n ? BinaryOperator.GT : BinaryOperator.LT, lit(0n),
        )), 'vmap counter loop runtime step must advance toward its bound')));
      }
      if (exactBound) {
        prelude.push(at(new RequireNode(whenLoopActive(binary(
          exactDistance(), postTest ? BinaryOperator.GT : BinaryOperator.GE, lit(0n),
        )), 'vmap counter loop exact bound must be in the direction of its step')));
        prelude.push(at(new RequireNode(whenLoopActive(binary(
          binary(exactDistance(), BinaryOperator.MOD, stepMagnitude()), BinaryOperator.EQ, lit(0n),
        )), 'vmap counter loop exact bound must be reachable by its step')));
      }
      if (!unitDomain) {
        prelude.push(at(new VariableDefinitionNode(
          new IntType(true, 256), [], rangedIterationCount,
          pathCondition
            ? at(new TernaryOpNode(activePath(), derivedIterationCount(), lit(0n)))
            : derivedIterationCount(),
        )));
      }
      const iterationCountInRange = binary(
        binary(iterationCount(), BinaryOperator.GE, lit(0n)),
        BinaryOperator.AND,
        binary(iterationCount(), BinaryOperator.LE, lit(BigInt(MAX_COUNTER_ITERATIONS))),
      );
      prelude.push(at(new RequireNode(
        iterationCountInRange,
        unitDomain
          ? 'vmap counter loop bound must be between 0 and 64'
          : 'vmap counter loop iteration count must be between 0 and 64',
      )));
      for (const group of groups) {
        const traceParams = [...valueTracePlans.values()]
          .filter((trace) => keyed.some((write) => groupByWrite.get(write) === group
            && write instanceof MappingAssignNode && valueTracePlans.get(write) === trace));
        for (const trace of traceParams) {
          prelude.push(at(new RequireNode(binary(
            at(new UnaryOpNode(UnaryOperator.SIZE, id(trace.witnessParam))),
            BinaryOperator.EQ,
            iterationCount(),
          ), 'vmap counter value trace length mismatch')));
        }
        prelude.push(at(new RequireNode(binary(
          at(new UnaryOpNode(UnaryOperator.SIZE, id(group.hidden))),
          group.expandedSelectionCondition ? BinaryOperator.LE : BinaryOperator.EQ,
          iterationCount(),
        ), 'vmap counter permutation length mismatch')));
        prelude.push(at(new VariableDefinitionNode(
          new IntType(true, 256), [], group.mask, lit(0n),
        )));
        if (group.expandedSelectionCondition) {
          prelude.push(at(new VariableDefinitionNode(
            new IntType(true, 256), [], group.settlementCursor, lit(0n),
          )));
        }
      }

      const logicalAndProofStatements: StatementNode[] = [];
      for (const group of groups) {
        logicalAndProofStatements.push(at(new VariableDefinitionNode(
          counterType, [], group.logicalValue,
          group.expandedSelectionCondition
            ? at(new TernaryOpNode(
              cloneNode(group.expandedSelectionCondition),
              permRead(group),
              lit(0n),
            ))
            : permRead(group),
        )));
        const logicalProofValue = (): ExpressionNode => asProofInt(id(group.logicalValue));
        const rankDefinition = unitDomain ? undefined : at(new VariableDefinitionNode(
          proofInt, [], group.logicalRank,
          binary(binary(logicalProofValue(), BinaryOperator.MINUS, lit(start)),
            BinaryOperator.DIV, proofStepValue()),
        ));
        const rank = (): IdentifierNode => id(unitDomain ? group.logicalValue : group.logicalRank);
        const logicalInRangeExpression = unitDomain ? binary(
          binary(logicalProofValue(), BinaryOperator.GE, lit(0n)),
          BinaryOperator.AND,
          binary(logicalProofValue(), BinaryOperator.LT, iterationCount()),
        ) : binary(
          binary(
            binary(logicalProofValue(), step > 0n ? BinaryOperator.GE : BinaryOperator.LE, lit(start)),
            BinaryOperator.AND,
            binary(rank(), BinaryOperator.LT, iterationCount()),
          ),
          BinaryOperator.AND,
          binary(
            logicalProofValue(),
            BinaryOperator.EQ,
            binary(lit(start), BinaryOperator.PLUS, binary(rank(), BinaryOperator.MUL, proofStepValue())),
          ),
        );
        const proofStatements: StatementNode[] = [
          ...(rankDefinition ? [rankDefinition] : []),
          at(new RequireNode(
            logicalInRangeExpression, 'vmap counter permutation value out of range',
          )),
          at(new VariableDefinitionNode(
            new IntType(true, 256), [], group.bit,
            binary(lit(1n), BinaryOperator.SHIFT_LEFT, rank()),
          )),
          at(new RequireNode(binary(
            binary(id(group.mask), BinaryOperator.BIT_AND, id(group.bit)), BinaryOperator.EQ, lit(0n),
          ), 'vmap counter permutation contains a duplicate')),
          at(new AssignNode(
            id(group.mask), binary(id(group.mask), BinaryOperator.BIT_OR, id(group.bit)),
          )),
        ];
        logicalAndProofStatements.push(...(group.expandedSelectionCondition
          ? [at(new BranchNode(
            cloneNode(group.expandedSelectionCondition), at(new BlockNode(proofStatements)),
          ))]
          : proofStatements));
      }
      const cursorAdvances = groups.flatMap((group): StatementNode[] =>
        group.expandedSelectionCondition
          ? [at(new BranchNode(
            cloneNode(group.expandedSelectionCondition),
            at(new BlockNode([at(new AssignNode(
              id(group.settlementCursor),
              binary(id(group.settlementCursor), BinaryOperator.PLUS, lit(1n)),
            ))])),
          ))]
          : []);
      // Canonical source `while`/`do-while` continues explicitly perform the tail update before jumping.
      // Re-express that as the AST's desugared-for form: BreakContinueTransformation will run the one retained
      // tail update on every continue path, while ordinary fall-through still executes it exactly once.
      if (apply && sourceContinueUpdates.size > 0) {
        for (const [owner, updates] of sourceContinueUpdateBlocks) {
          owner.statements = owner.statements?.flatMap((statement): StatementNode[] => {
            if (updates.has(statement as AssignNode)) return [];
            // A selected write before this jump has already consumed its physical entry. The ordinary tail
            // cursor advance is skipped by `continue`, so mirror it here before BreakContinueTransformation
            // rewrites the jump. Unselected paths evaluate these predicates to false and advance nothing.
            if (sourceContinues.has(statement as ContinueNode)) {
              return [...cursorAdvances.map((advance) => cloneNode(advance)), statement];
            }
            return [statement];
          });
        }
        loop.forLoopUpdateCount = 1;
      }
      const originalStatements = block.statements ?? [];
      const injectBreakAdvances = (target: BlockNode): void => {
        if (cursorAdvances.length === 0) return;
        const statements: StatementNode[] = [];
        for (const statement of target.statements ?? []) {
          if (statement instanceof BreakNode || statement instanceof ReturnNode) {
            statements.push(...cursorAdvances.map((advance) => cloneNode(advance)), statement);
          } else {
            if (statement instanceof BranchNode) {
              injectBreakAdvances(statement.ifBlock);
              if (statement.elseBlock) injectBreakAdvances(statement.elseBlock);
            } else if (statement instanceof BlockNode) injectBreakAdvances(statement);
            statements.push(statement);
          }
        }
        target.statements = statements;
      };
      if (breakPaths.length > 0) {
        for (const statement of originalStatements) {
          if (statement instanceof BranchNode) {
            injectBreakAdvances(statement.ifBlock);
            if (statement.elseBlock) injectBreakAdvances(statement.elseBlock);
          } else if (statement instanceof BlockNode) injectBreakAdvances(statement);
        }
      }
      const sourceStatements = breakPaths.length > 0 && cursorAdvances.length > 0
        ? originalStatements.flatMap((statement) => statement instanceof BreakNode
          || statement instanceof ReturnNode
          ? [...cursorAdvances.map((advance) => cloneNode(advance)), statement] : [statement])
        : originalStatements;
      const updateIndex = counterUpdate ? sourceStatements.indexOf(counterUpdate) : -1;
      const bodyWithCursor = cursorAdvances.length > 0 && updateIndex >= 0
        ? [
          ...sourceStatements.slice(0, updateIndex), ...cursorAdvances,
          ...sourceStatements.slice(updateIndex),
        ]
        : [...sourceStatements, ...cursorAdvances];
      block.statements = [
        ...logicalAndProofStatements,
        // BreakContinueTransformation runs after this pass and nests the tail (including this advance) under the
        // fall-through arm of a source `continue`, so selected iterations consume exactly one physical rank.
        ...bodyWithCursor,
      ];
      const selectedGroups = groups.filter((group) => group.expandedSelectionCondition);
      if (selectedGroups.length > 0) {
        const insertionIndex = canonical.parent.statements?.indexOf(loop) ?? -1;
        if (insertionIndex < 0) return false;
        canonical.parent.statements!.splice(insertionIndex + 1, 0, ...selectedGroups.map((group) =>
          at(new RequireNode(binary(
            id(group.settlementCursor), BinaryOperator.EQ,
            at(new UnaryOpNode(UnaryOperator.SIZE, id(group.hidden))),
          ), 'vmap counter selection length mismatch'))));
      }
      for (const group of groups) {
        const p = new ParameterNode(new ArrayType(counterType), group.hidden);
        p.location = node.location;
        added.push(p);
        if (group.inputCount && group.outputCount) {
          const inputCount = new ParameterNode(new IntType(true, 256), group.inputCount);
          inputCount.location = node.location;
          const outputCount = new ParameterNode(new IntType(true, 256), group.outputCount);
          outputCount.location = node.location;
          added.push(inputCount, outputCount);
        }
      }
      for (const trace of valueTracePlans.values()) {
        const parameter = new ParameterNode(new ArrayType(trace.valueType), trace.witnessParam);
        parameter.location = node.location;
        added.push(parameter);
      }
      for (const plan of runtimeReadPlans) {
        const valueType = this.collectionsByName.get(plan.synthetic.name)!.innermostValueType;
        const parameter = new ParameterNode(new ArrayType(valueType), plan.witnessParam);
        parameter.location = node.location;
        added.push(parameter);
        // The synthetic no-op transition is a physical runtime journal stream just like a write. It is
        // introduced after `keyedCollections` is collected, so enroll its source explicitly in the shared
        // transaction-wide cardinality protocol. Without these remainders an internal route clone falls back to
        // a local address scan, which cannot compose its source stream with the route's other trailing groups.
        runtimeCountCollections.add(plan.synthetic.name);
      }
      if (generalOldEntryWrites.size > 0) {
        const seen = new Set<string>();
        for (const write of generalOldEntryWrites) {
          const oldName = oldValueHidden(write);
          if (seen.has(oldName)) continue;
          seen.add(oldName);
          const old = new ParameterNode(
            new ArrayType(this.collectionsByName.get(write.name)!.innermostValueType), oldName,
          );
          old.location = node.location;
          added.push(old);
        }
      }
      for (const collection of keyedCollections) runtimeCountCollections.add(collection);
      return true;
    };
    const counterWriteLoopSet = new Set(counterWriteLoops.map(([loop]) => loop));
    const allSafe = counterWriteLoops.length > 0
      && counterWriteLoops.every(([loop]) => tryLower(loop, false));
    // Events outside an admitted loop must join the same trailing stream or their fixed output family would move
    // an `emit after` ahead of all repeated records. Serializable nested if/else predicates provide an exact
    // pre-probe count. Stable switch arms are the same finite predicate family. Try/catch, nested-loop sites, and
    // eventful internal helpers remain frozen until the runtime plan carries richer path/call context.
    const outerEmits: Array<{ emit: EmitStatementNode; condition?: ExpressionNode }> = [];
    let unsupportedOuterEvent = false;
    let eventfulHelperCall = false;
    const collectOuterEvents = (
      candidate: Node,
      conditions: readonly { expression: ExpressionNode; negated: boolean }[],
    ): void => {
      if (counterWriteLoopSet.has(candidate as WhileNode | DoWhileNode)) return;
      if (candidate instanceof EmitStatementNode) {
        const condition = runtimePathCondition(conditions);
        if (condition && !runtimePathExpressionSupported(condition)) unsupportedOuterEvent = true;
        else outerEmits.push({ emit: candidate, ...(condition && { condition }) });
        return;
      }
      if (candidate instanceof FunctionCallNode
        && this.eventfulFunctionNames.has(candidate.identifier.name)) eventfulHelperCall = true;
      if (candidate instanceof BranchNode) {
        collectOuterEvents(candidate.ifBlock, [...conditions, { expression: candidate.condition, negated: false }]);
        if (candidate.elseBlock) {
          collectOuterEvents(
            candidate.elseBlock, [...conditions, { expression: candidate.condition, negated: true }],
          );
        }
        return;
      }
      if (candidate instanceof SwitchNode) {
        const matches = candidate.cases.map((arm) => {
          const equality = new BinaryOpNode(
            cloneNode(candidate.expression), BinaryOperator.EQ, cloneNode(arm.value),
          );
          equality.location = arm.value.location ?? candidate.location;
          return equality;
        });
        candidate.cases.forEach((arm, index) => {
          collectOuterEvents(arm.body, [...conditions, { expression: matches[index], negated: false }]);
        });
        if (candidate.defaultCase) {
          collectOuterEvents(candidate.defaultCase, [
            ...conditions,
            ...matches.map((expression) => ({ expression, negated: true })),
          ]);
        }
        return;
      }
      if (candidate instanceof TryCatchNode) {
        collectOuterEvents(candidate.tryBlock, conditions);
        return;
      }
      if (candidate instanceof WhileNode || candidate instanceof DoWhileNode) {
        let containsEmit = false;
        const findEmit = (nested: Node): void => {
          if (nested instanceof EmitStatementNode) { containsEmit = true; return; }
          for (const value of Object.values(nested)) {
            if (value instanceof Node) findEmit(value);
            else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) findEmit(item);
          }
        };
        findEmit(candidate);
        unsupportedOuterEvent ||= containsEmit;
        return;
      }
      for (const key of Object.keys(candidate)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
          || key === 'resolvedFunction') continue;
        const value = (candidate as unknown as Record<string, unknown>)[key];
        if (value instanceof Node) collectOuterEvents(value, conditions);
        else if (Array.isArray(value)) {
          for (const item of value) if (item instanceof Node) collectOuterEvents(item, conditions);
        }
      }
    };
    collectOuterEvents(node.body, []);
    const planStatementIndices = (node.body.statements ?? []).flatMap((statement, index) => {
      if (counterWriteLoopSet.has(statement as WhileNode | DoWhileNode)) return [index];
      let hasOuterEmit = false;
      const findOuterEmit = (candidate: Node): void => {
        if (candidate instanceof EmitStatementNode) { hasOuterEmit = true; return; }
        for (const key of Object.keys(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction') continue;
          const value = (candidate as unknown as Record<string, unknown>)[key];
          if (value instanceof Node) findOuterEmit(value);
          else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) findOuterEmit(item);
        }
      };
      findOuterEmit(statement);
      return hasOuterEmit ? [index] : [];
    });
    const lastPlanStatement = Math.max(-1, ...planStatementIndices);
    let returnBeforePlanEnd = false;
    const containsReturn = (candidate: Node): boolean => {
      if (candidate instanceof ReturnNode) return true;
      for (const key of Object.keys(candidate)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
          || key === 'resolvedFunction') continue;
        const value = (candidate as unknown as Record<string, unknown>)[key];
        if (value instanceof Node && containsReturn(value)) return true;
        if (Array.isArray(value)
          && value.some((item) => item instanceof Node && containsReturn(item))) return true;
      }
      return false;
    };
    for (let index = 0; index < lastPlanStatement; index++) {
      if (containsReturn(node.body.statements![index])) returnBeforePlanEnd = true;
    }
    const orderedEventPlanSafe = !unsupportedOuterEvent && !eventfulHelperCall && !returnBeforePlanEnd;
    // Collection reuse is a runtime topology question, not an AST-shape restriction. The shared cardinality
    // remainder composes disjoint runs over one physical collection; the SDK rejects an actual repeated
    // predecessor as a read-your-writes transition until pending-output planning is available.
    if (allSafe && orderedEventPlanSafe) {
      for (const [loop] of counterWriteLoops) tryLower(loop, true);

      const priorSegments = new Map((node.runtimeLoopEvents ?? [])
        .map((segment) => [segment.loopIndex, segment]));
      const priorTransferSegments = new Map((node.runtimeLoopTransfers ?? [])
        .map((segment) => [segment.loopIndex, segment]));
      const publishEffectOrder = priorSegments.size > 0 && priorTransferSegments.size > 0;
      const outerEventConditions = new Map(outerEmits.map(({ emit, condition }) => [emit, condition]));
      const orderedSegments: typeof node.runtimeLoopEvents = [];
      let effectSequence = 0;
      const appendLoop = (loop: WhileNode | DoWhileNode): void => {
        const effects: Array<EmitStatementNode | TransferStatementNode | TokenContainerMethodStatementNode> = [];
        const collect = (candidate: Node): void => {
          if (candidate !== loop && (candidate instanceof WhileNode || candidate instanceof DoWhileNode)) return;
          if ((candidate instanceof EmitStatementNode && candidate.runtimeLoopEvent)
            || ((candidate instanceof TransferStatementNode
              || candidate instanceof TokenContainerMethodStatementNode) && candidate.runtimeLoopTransfer)) {
            effects.push(candidate);
            return;
          }
          for (const key of Object.keys(candidate)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
              || key === 'resolvedFunction') continue;
            const value = (candidate as unknown as Record<string, unknown>)[key];
            if (value instanceof Node) collect(value);
            else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) collect(item);
          }
        };
        collect(loop.block);
        if (effects.length === 0) return;
        const sequence = effectSequence++;
        if (publishEffectOrder) {
          effects.forEach((effect, order) => { effect.runtimeLoopEffectOrder = order; });
        }
        const emits = effects.filter((effect): effect is EmitStatementNode =>
          effect instanceof EmitStatementNode);
        if (emits.length > 0) {
          const prior = priorSegments.get(emits[0].runtimeLoopEvent!.loopIndex)!;
          const loopIndex = orderedSegments.length;
          emits.forEach((emit, siteIndex) => { emit.runtimeLoopEvent = { loopIndex, siteIndex }; });
          orderedSegments.push({ loopIndex, permutationParam: prior.permutationParam,
            ...(publishEffectOrder && { effectSequence: sequence }) });
        }
        const transfers = effects.filter((effect): effect is TransferStatementNode | TokenContainerMethodStatementNode =>
          effect instanceof TransferStatementNode || effect instanceof TokenContainerMethodStatementNode);
        if (transfers.length > 0) {
          const prior = priorTransferSegments.get(transfers[0].runtimeLoopTransfer!.loopIndex);
          if (prior && publishEffectOrder) prior.effectSequence = sequence;
        }
      };
      const appendOuter = (emit: EmitStatementNode): void => {
        const loopIndex = orderedSegments.length;
        emit.runtimeLoopEvent = { loopIndex, siteIndex: 0 };
        emit.runtimeLoopEventCondition = outerEventConditions.get(emit);
        if (publishEffectOrder) emit.runtimeLoopEffectOrder = 0;
        orderedSegments.push({ loopIndex, repeatCount: 1,
          ...(publishEffectOrder && { effectSequence }) });
        effectSequence += 1;
      };
      const appendInSourceOrder = (candidate: Node): void => {
        if (counterWriteLoopSet.has(candidate as WhileNode | DoWhileNode)) {
          appendLoop(candidate as WhileNode | DoWhileNode);
          return;
        }
        if (candidate instanceof EmitStatementNode) { appendOuter(candidate); return; }
        for (const key of Object.keys(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction') continue;
          const value = (candidate as unknown as Record<string, unknown>)[key];
          if (value instanceof Node) appendInSourceOrder(value);
          else if (Array.isArray(value)) {
            for (const item of value) if (item instanceof Node) appendInSourceOrder(item);
          }
        }
      };
      appendInSourceOrder(node.body);
      node.runtimeLoopEvents = orderedSegments;
      node.runtimeCounterLoopOutputCapacity = (node.runtimeCounterLoopOutputCapacity ?? 0) + outerEmits.length;
    }
    for (const collection of runtimeCountCollections) {
      const inputCount = new ParameterNode(
        new IntType(true, 256), vmapRuntimeInputCountName(collection),
      );
      inputCount.location = node.location;
      const outputCount = new ParameterNode(
        new IntType(true, 256), vmapRuntimeOutputCountName(collection),
      );
      outputCount.location = node.location;
      added.push(inputCount, outputCount);
    }
    if (keySnapshotPrelude.length > 0 || prelude.length > 0) {
      node.body.statements = [...keySnapshotPrelude, ...prelude, ...(node.body.statements ?? [])];
    }
    // Route synthesis appends the physical owner context after every source-derived handler argument. Generated
    // loop witnesses must remain on the source-argument side of that boundary even when this lowering runs on a
    // cloned handler after route ownership was attached; otherwise caller and callee disagree on the OP_INVOKE ABI.
    const ownerIndex = node.parameters.findIndex(
      (parameter) => parameter.name === '__internal__messageBusOwnerInput',
    );
    if (ownerIndex < 0) node.parameters.push(...added);
    else node.parameters.splice(ownerIndex, 0, ...added);
    return node;
  }

  /**
   * Represent a fresh local array at a mapping-key read as its default value plus the straight-line writes which
   * dominate that read. `new T[](n); xs[p] = v; m[xs[i]] = ...` becomes the replayable key
   * `i == p ? v : default(T)`. The original `xs[i]` read remains in a generated equality requirement, preserving
   * bounds checks and authenticating the symbolic form against the source memory value. Straight-line writes in
   * a canonical loop are available to later statements in that same iteration; writes crossing control-flow
   * joins, prior-iteration dependencies, and escaped arrays stay untouched and therefore fail closed at ordinary
   * runtime-key admission. Straight-line push/pop operations advance a symbolic length, so their exact indices
   * participate in the same replay without turning the source array into a route argument. This is type-generic
   * and independent of any contract schema.
   */
  private normalizeImmutableDefaultArrayKeys(
    node: FunctionDefinitionNode,
    canonicalLoops: ReadonlyMap<WhileNode | DoWhileNode, {
      logical: string; start: bigint; step: bigint; stepExpression?: ExpressionNode;
    }> = new Map(),
  ): void {
    if (!node.body || node.messageBusConstructedArrayKeysNormalized) return;
    node.messageBusConstructedArrayKeysNormalized = true;
    const canonicalCounters = new Set([...canonicalLoops.values()].map((loop) => loop.logical));
    type ArrayRecurrence = {
      counter: string;
      start: bigint;
      step: bigint;
      stepExpression?: ExpressionNode;
      baseLength: ExpressionNode;
      pushesPerIteration: number;
    };
    type ArrayWrite = {
      index: ExpressionNode;
      value: ExpressionNode;
      condition?: ExpressionNode;
      recurrence?: ArrayRecurrence & { ordinal: number };
    };
    type ArrayPlan = {
      elementType: Type;
      defaultValue: ExpressionNode;
      /** Symbolic source length at this point. It makes straight-line push/pop indices replayable. */
      length: ExpressionNode;
      writes: ArrayWrite[];
      /** A fixed number of unconditional pushes per canonical source iteration. */
      recurrence?: ArrayRecurrence;
    };
    const plans = new Map<string, ArrayPlan>();
    const walk = (root: Node, visit: (candidate: Node) => void): void => {
      visit(root);
      for (const key of Object.keys(root)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
          || key === 'resolvedFunction') continue;
        const value = (root as unknown as Record<string, unknown>)[key];
        if (value instanceof Node) walk(value, visit);
        else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item, visit);
      }
    };
    const localNewArrayNames = new Set<string>();
    const localTypes = new Map(node.parameters.map((parameter) => [parameter.name, parameter.type]));
    walk(node.body, (candidate) => {
      if (candidate instanceof VariableDefinitionNode && candidate.expression instanceof NewArrayNode) {
        localNewArrayNames.add(candidate.name);
      }
      if (candidate instanceof VariableDefinitionNode) localTypes.set(candidate.name, candidate.type);
    });
    if (localNewArrayNames.size === 0) return;
    const resizedLocalArrayNames = new Set<string>();
    walk(node.body, (candidate) => {
      if ((candidate instanceof ArrayPushNode || candidate instanceof ArrayPopNode)
        && localNewArrayNames.has(candidate.name)) resizedLocalArrayNames.add(candidate.name);
    });

    // Snapshot only assignments which can reach a constructed-array write. Counter-loop lowering also creates
    // temporary arrays, so snapshotting every assignment merely because one exists changes the physical stack
    // frame of otherwise unrelated handlers. Close backwards through assignment RHSs to support chains such as
    // `a = p + 1; b = a * 2; xs[0] = b` without retaining unrelated route counters or journal temporaries.
    const snapshotDependencyNames = new Set<string>();
    const addExpressionIdentifiers = (expression: ExpressionNode): boolean => {
      let changed = false;
      walk(expression, (candidate) => {
        if (candidate instanceof IdentifierNode && !canonicalCounters.has(candidate.name)
          && !snapshotDependencyNames.has(candidate.name)) {
          snapshotDependencyNames.add(candidate.name);
          changed = true;
        }
      });
      return changed;
    };
    walk(node.body, (candidate) => {
      if (candidate instanceof ArrayAssignNode && localNewArrayNames.has(candidate.name)) {
        addExpressionIdentifiers(candidate.index);
        addExpressionIdentifiers(candidate.value);
      }
    });
    const dependencyAssignments: AssignNode[] = [];
    walk(node.body, (candidate) => {
      if (candidate instanceof AssignNode) dependencyAssignments.push(candidate);
    });
    let dependencyChanged = true;
    while (dependencyChanged) {
      dependencyChanged = false;
      for (const assignment of dependencyAssignments) {
        if (snapshotDependencyNames.has(assignment.identifier.name)) {
          dependencyChanged = addExpressionIdentifiers(assignment.expression) || dependencyChanged;
        }
      }
    }

    const mutatedArrays = (root: Node): Set<string> => {
      const result = new Set<string>();
      walk(root, (candidate) => {
        if (candidate instanceof ArrayAssignNode || candidate instanceof ArrayDeleteNode
          || candidate instanceof ArrayPushNode || candidate instanceof ArrayPopNode) result.add(candidate.name);
        if (candidate instanceof AssignNode) result.add(candidate.identifier.name);
        if (candidate instanceof MethodCallNode && candidate.object instanceof IdentifierNode
          && ['push', 'pop'].includes(candidate.methodName)) result.add(candidate.object.name);
      });
      return result;
    };
    const allReassignedNames = new Set<string>();
    walk(node.body, (candidate) => {
      if (candidate instanceof AssignNode) allReassignedNames.add(candidate.identifier.name);
    });
    // Track assignments in traversal order. A later reassignment cannot retroactively change a value already
    // copied into a local array (`xs[0] = key; key = next`), while a write after that reassignment still needs a
    // richer replay expression and remains fenced. Branch traversal is deliberately conservative: an assignment
    // in either arm taints subsequent statements at the join.
    const reassignedNames = new Set<string>();
    const containsReassignedName = (root: Node): boolean => {
      let found = false;
      walk(root, (candidate) => {
        if (candidate instanceof IdentifierNode && reassignedNames.has(candidate.name)
          && !canonicalCounters.has(candidate.name)) found = true;
      });
      return found;
    };
    const containsFutureReassignedName = (root: Node): boolean => {
      let found = false;
      walk(root, (candidate) => {
        if (candidate instanceof IdentifierNode && allReassignedNames.has(candidate.name)
          && !reassignedNames.has(candidate.name) && !canonicalCounters.has(candidate.name)) found = true;
      });
      return found;
    };
    const containsNamedIdentifier = (root: Node, names: ReadonlySet<string>): boolean => {
      let found = false;
      walk(root, (candidate) => {
        if (candidate instanceof IdentifierNode && names.has(candidate.name)) found = true;
      });
      return found;
    };
    const readOnlyArrayParameterCache = new Map<FunctionDefinitionNode, Map<number, boolean>>();
    const readOnlyArrayParameter = (
      fn: FunctionDefinitionNode,
      parameterIndex: number,
      visiting = new Set<FunctionDefinitionNode>(),
    ): boolean => {
      const cached = readOnlyArrayParameterCache.get(fn)?.get(parameterIndex);
      if (cached !== undefined) return cached;
      if (!fn.modifiers.includes(FunctionModifier.PURE) || !fn.body) return false;
      // Overloaded and recursive forwarding is deliberately conservative. At this pre-semantic stage a named
      // call has no resolvedFunction yet, so accepting a cycle or an ambiguous target would turn the source
      // array into an untracked memory alias.
      if (visiting.has(fn)) return false;
      const parameter = fn.parameters[parameterIndex];
      if (!parameter || !(parameter.type instanceof ArrayType)) return false;
      const nextVisiting = new Set(visiting).add(fn);
      let safe = true;
      const scan = (candidate: Node): void => {
        if (!safe) return;
        if ((candidate instanceof ArrayAssignNode || candidate instanceof ArrayDeleteNode
          || candidate instanceof ArrayPushNode || candidate instanceof ArrayPopNode)
          && candidate.name === parameter.name) {
          safe = false;
          return;
        }
        if (candidate instanceof AssignNode && candidate.identifier.name === parameter.name) {
          safe = false;
          return;
        }
        if (candidate instanceof MethodCallNode) {
          // A direct receiver or argument is a memory alias. Element expressions such as f(xs[i]) only pass the
          // selected value and therefore do not escape xs.
          if ((candidate.object instanceof IdentifierNode && candidate.object.name === parameter.name)
            || candidate.parameters.some((argument) =>
              argument instanceof IdentifierNode && argument.name === parameter.name)) {
            safe = false;
            return;
          }
        } else if (candidate instanceof ExternalFunctionCallNode) {
          if (candidate.parameters.some((argument) =>
            argument instanceof IdentifierNode && argument.name === parameter.name)) {
            safe = false;
            return;
          }
        } else if (candidate instanceof FunctionCallNode) {
          candidate.parameters.forEach((argument, argumentIndex) => {
            if (!safe || !(argument instanceof IdentifierNode) || argument.name !== parameter.name) return;
            const targets = (this.functionsByName.get(candidate.identifier.name) ?? [])
              .filter((target) => target.parameters.length === candidate.parameters.length);
            if (targets.length === 0 || targets.some((target) =>
              !readOnlyArrayParameter(target, argumentIndex, nextVisiting))) safe = false;
          });
          if (!safe) return;
        }
        for (const key of Object.keys(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'functionReference' || key === 'collection'
            || key === 'stateVariable') continue;
          const value = (candidate as unknown as Record<string, unknown>)[key];
          if (value instanceof Node) scan(value);
          else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) scan(item);
        }
      };
      scan(fn.body);
      const cachedParameters = readOnlyArrayParameterCache.get(fn) ?? new Map<number, boolean>();
      cachedParameters.set(parameterIndex, safe);
      readOnlyArrayParameterCache.set(fn, cachedParameters);
      return safe;
    };
    const escapedPlanNames = (root: Node, active: Map<string, ArrayPlan>): Set<string> => {
      const escaped = new Set<string>();
      const arrayObjectsPassed = (expression: ExpressionNode): Set<string> => {
        const referenced = new Set<string>();
        const scan = (candidate: Node): void => {
          if (candidate instanceof IdentifierNode && active.has(candidate.name)) {
            referenced.add(candidate.name);
            return;
          }
          // These expressions consume an element/field value. The underlying array object is not passed to the
          // callee. Other wrappers (casts, conditionals, tuples, and unknown expressions) remain conservative.
          if (candidate instanceof ArrayAccessNode || candidate instanceof TupleIndexOpNode
            || candidate instanceof FieldAccessNode) return;
          for (const key of Object.keys(candidate)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
              || key === 'resolvedFunction' || key === 'functionReference' || key === 'collection'
              || key === 'stateVariable') continue;
            const value = (candidate as unknown as Record<string, unknown>)[key];
            if (value instanceof Node) scan(value);
            else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) scan(item);
          }
        };
        scan(expression);
        return referenced;
      };
      walk(root, (candidate) => {
        if (!(candidate instanceof FunctionCallNode || candidate instanceof ExternalFunctionCallNode
          || candidate instanceof MethodCallNode)) return;
        const parameters = candidate instanceof MethodCallNode
          ? [candidate.object, ...candidate.parameters] : candidate.parameters;
        for (let parameterIndex = 0; parameterIndex < parameters.length; parameterIndex += 1) {
          const parameter = parameters[parameterIndex];
          const passedArrays = arrayObjectsPassed(parameter);
          if (passedArrays.size === 0) continue;
          if (candidate instanceof FunctionCallNode && parameter instanceof IdentifierNode
            && passedArrays.size === 1 && passedArrays.has(parameter.name)) {
            const targets = (this.functionsByName.get(candidate.identifier.name) ?? [])
              .filter((target) => target.parameters.length === candidate.parameters.length);
            if (targets.length > 0 && targets.every((target) =>
              readOnlyArrayParameter(target, parameterIndex))) continue;
          }
          for (const name of passedArrays) escaped.add(name);
        }
      });
      return escaped;
    };
    const replaceIdentifier = (
      expression: ExpressionNode, name: string, replacement: ExpressionNode,
    ): ExpressionNode => {
      if (expression instanceof IdentifierNode && expression.name === name) return cloneNode(replacement);
      const replaced = cloneNode(expression) as ExpressionNode;
      for (const key of Object.keys(replaced)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
          || key === 'resolvedFunction' || key === 'functionReference' || key === 'collection'
          || key === 'stateVariable' || key === 'identifier') continue;
        const value = (replaced as unknown as Record<string, unknown>)[key];
        if (value instanceof ExpressionNode) {
          (replaced as unknown as Record<string, unknown>)[key] = replaceIdentifier(value, name, replacement);
        } else if (Array.isArray(value)) {
          (replaced as unknown as Record<string, unknown>)[key] = value.map((item) =>
            item instanceof ExpressionNode ? replaceIdentifier(item, name, replacement) : item);
        }
      }
      return replaced;
    };
    const symbolicRead = (access: ArrayAccessNode, plan: ArrayPlan): ExpressionNode | undefined => {
      let value = cloneNode(plan.defaultValue) as ExpressionNode;
      for (const write of plan.writes) {
        let selectedValue = cloneNode(write.value) as ExpressionNode;
        let matches: ExpressionNode;
        if (write.recurrence) {
          const recurrence = write.recurrence;
          const relative = new BinaryOpNode(
            cloneNode(access.index), BinaryOperator.MINUS, cloneNode(recurrence.baseLength),
          );
          relative.location = access.location;
          const occurrence = recurrence.pushesPerIteration === 1
            ? cloneNode(relative)
            : new BinaryOpNode(
              cloneNode(relative), BinaryOperator.DIV,
              new IntLiteralNode(BigInt(recurrence.pushesPerIteration)),
            );
          occurrence.location = access.location;
          const step = recurrence.stepExpression
            ? cloneNode(recurrence.stepExpression) : new IntLiteralNode(recurrence.step);
          step.location = access.location;
          const logicalStep = new BinaryOpNode(occurrence, BinaryOperator.MUL, step);
          logicalStep.location = access.location;
          const logicalCounter = new BinaryOpNode(
            new IntLiteralNode(recurrence.start), BinaryOperator.PLUS, logicalStep,
          );
          logicalCounter.location = access.location;
          selectedValue = replaceIdentifier(write.value, recurrence.counter, logicalCounter);
          const atOrAfter = new BinaryOpNode(
            cloneNode(access.index), BinaryOperator.GE, cloneNode(recurrence.baseLength),
          );
          atOrAfter.location = access.location;
          const beforeLength = new BinaryOpNode(
            cloneNode(access.index), BinaryOperator.LT, cloneNode(plan.length),
          );
          beforeLength.location = access.location;
          matches = new BinaryOpNode(atOrAfter, BinaryOperator.AND, beforeLength);
          matches.location = access.location;
          if (recurrence.pushesPerIteration > 1) {
            const ordinal = new BinaryOpNode(
              cloneNode(relative), BinaryOperator.MOD,
              new IntLiteralNode(BigInt(recurrence.pushesPerIteration)),
            );
            ordinal.location = access.location;
            const isThisPush = new BinaryOpNode(
              ordinal, BinaryOperator.EQ, new IntLiteralNode(BigInt(recurrence.ordinal)),
            );
            isThisPush.location = access.location;
            const selectedPush = new BinaryOpNode(matches, BinaryOperator.AND, isThisPush);
            selectedPush.location = access.location;
            matches = selectedPush;
          }
        } else {
          matches = new BinaryOpNode(
            cloneNode(access.index), BinaryOperator.EQ, cloneNode(write.index),
          );
        }
        matches.location = access.location;
        if (write.condition) {
          const active = new BinaryOpNode(
            cloneNode(matches), BinaryOperator.AND, cloneNode(write.condition),
          );
          active.location = access.location;
          matches = active;
        }
        const selected = new TernaryOpNode(matches, selectedValue, value);
        selected.location = access.location;
        selected.type = access.type;
        selected.messageBusDeterministicArrayKey = true;
        value = selected;
      }
      return value;
    };
    const replaceArrayReads = (
      expression: ExpressionNode,
      active: Map<string, ArrayPlan>,
      checks: RequireNode[],
    ): ExpressionNode => {
      if (expression instanceof ArrayAccessNode && expression.array instanceof IdentifierNode) {
        const plan = active.get(expression.array.name);
        if (plan) {
          const replacement = symbolicRead(expression, plan);
          if (!replacement) return cloneNode(expression) as ExpressionNode;
          const equality = new BinaryOpNode(
            cloneNode(expression), BinaryOperator.EQ, cloneNode(replacement),
          );
          equality.location = expression.location;
          const check = new RequireNode(equality, 'deterministic local array key mismatch');
          check.location = expression.location;
          checks.push(check);
          return replacement;
        }
      }
      const replaced = cloneNode(expression) as ExpressionNode;
      for (const key of Object.keys(replaced)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
          || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
        const value = (replaced as unknown as Record<string, unknown>)[key];
        if (value instanceof ExpressionNode) {
          (replaced as unknown as Record<string, unknown>)[key] = replaceArrayReads(value, active, checks);
        } else if (Array.isArray(value)) {
          (replaced as unknown as Record<string, unknown>)[key] = value.map((item) =>
            item instanceof ExpressionNode ? replaceArrayReads(item, active, checks) : item);
        }
      }
      return replaced;
    };
    const replaceSnapshots = (
      expression: ExpressionNode,
      snapshots: ReadonlyMap<string, ExpressionNode>,
    ): ExpressionNode => {
      if (expression instanceof IdentifierNode && snapshots.has(expression.name)) {
        return cloneNode(snapshots.get(expression.name)!);
      }
      const replaced = cloneNode(expression) as ExpressionNode;
      for (const key of Object.keys(replaced)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
          || key === 'resolvedFunction' || key === 'functionReference' || key === 'collection'
          || key === 'stateVariable' || key === 'identifier') continue;
        const value = (replaced as unknown as Record<string, unknown>)[key];
        if (value instanceof ExpressionNode) {
          (replaced as unknown as Record<string, unknown>)[key] = replaceSnapshots(value, snapshots);
        } else if (Array.isArray(value)) {
          (replaced as unknown as Record<string, unknown>)[key] = value.map((item) =>
            item instanceof ExpressionNode ? replaceSnapshots(item, snapshots) : item);
        }
      }
      return replaced;
    };
    const rewriteMappingKeys = (
      statement: StatementNode,
      active: Map<string, ArrayPlan>,
    ): RequireNode[] => {
      const checks: RequireNode[] = [];
      if (statement instanceof ArrayAssignNode || statement instanceof ArrayDeleteNode) {
        statement.index = replaceArrayReads(statement.index, active, checks);
      } else if (statement instanceof MappingAssignNode || statement instanceof MappingFieldAssignNode
        || statement instanceof MappingDeleteNode) {
        statement.keys = statement.keys.map((key) => replaceArrayReads(key, active, checks));
      }
      return checks;
    };
    const copyPlans = (source: Map<string, ArrayPlan>): Map<string, ArrayPlan> => new Map(
      [...source].map(([name, plan]) => [name, {
        elementType: plan.elementType,
        defaultValue: cloneNode(plan.defaultValue) as ExpressionNode,
        length: cloneNode(plan.length) as ExpressionNode,
        writes: plan.writes.map((write) => ({
          index: cloneNode(write.index) as ExpressionNode,
          value: cloneNode(write.value) as ExpressionNode,
          ...(write.condition && { condition: cloneNode(write.condition) as ExpressionNode }),
          ...(write.recurrence && { recurrence: {
            ...write.recurrence,
            baseLength: cloneNode(write.recurrence.baseLength) as ExpressionNode,
            ...(write.recurrence.stepExpression && {
              stepExpression: cloneNode(write.recurrence.stepExpression) as ExpressionNode,
            }),
          } }),
        })),
        ...(plan.recurrence && { recurrence: {
          ...plan.recurrence,
          baseLength: cloneNode(plan.recurrence.baseLength) as ExpressionNode,
          ...(plan.recurrence.stepExpression && {
            stepExpression: cloneNode(plan.recurrence.stepExpression) as ExpressionNode,
          }),
        } }),
      }]),
    );
    const branchCondition = (
      condition: ExpressionNode,
      prior: ExpressionNode | undefined,
      negated: boolean,
    ): ExpressionNode => {
      let branch: ExpressionNode = cloneNode(condition);
      if (negated) {
        const not = new UnaryOpNode(UnaryOperator.NOT, branch);
        not.location = condition.location;
        branch = not;
      }
      if (!prior) return branch;
      const combined = new BinaryOpNode(cloneNode(prior), BinaryOperator.AND, branch);
      combined.location = condition.location;
      return combined;
    };
    const mergeBranchPlans = (
      active: Map<string, ArrayPlan>,
      before: ReadonlyMap<string, ArrayPlan>,
      ifPlans: ReadonlyMap<string, ArrayPlan>,
      elsePlans: ReadonlyMap<string, ArrayPlan>,
      condition: ExpressionNode,
    ): void => {
      for (const [name, base] of before) {
        const ifPlan = ifPlans.get(name);
        const elsePlan = elsePlans.get(name);
        if (!ifPlan || !elsePlan
          || ifPlan.writes.length < base.writes.length || elsePlan.writes.length < base.writes.length) {
          active.delete(name);
          continue;
        }
        const merged = copyPlans(new Map([[name, base]])).get(name)!;
        for (const write of ifPlan.writes.slice(base.writes.length)) {
          merged.writes.push({
            index: cloneNode(write.index) as ExpressionNode,
            value: cloneNode(write.value) as ExpressionNode,
            condition: branchCondition(condition, write.condition, false),
          });
        }
        for (const write of elsePlan.writes.slice(base.writes.length)) {
          merged.writes.push({
            index: cloneNode(write.index) as ExpressionNode,
            value: cloneNode(write.value) as ExpressionNode,
            condition: branchCondition(condition, write.condition, true),
          });
        }
        const mergedLength = new TernaryOpNode(
          cloneNode(condition), cloneNode(ifPlan.length), cloneNode(elsePlan.length),
        );
        mergedLength.location = condition.location;
        mergedLength.type = ifPlan.length.type ?? elsePlan.length.type;
        merged.length = mergedLength;
        active.set(name, merged);
      }
    };
    const mergeSwitchPlans = (
      active: Map<string, ArrayPlan>,
      before: ReadonlyMap<string, ArrayPlan>,
      casePlans: readonly ReadonlyMap<string, ArrayPlan>[],
      defaultPlans: ReadonlyMap<string, ArrayPlan>,
      statement: SwitchNode,
      selected: ExpressionNode,
    ): void => {
      const caseConditions = statement.cases.map((candidate) => {
        const condition = new BinaryOpNode(
          cloneNode(selected), BinaryOperator.EQ, cloneNode(candidate.value),
        );
        condition.location = candidate.location ?? statement.location;
        return condition;
      });
      let anyCase: ExpressionNode | undefined;
      for (const condition of caseConditions) {
        if (!anyCase) anyCase = condition;
        else {
          const combined = new BinaryOpNode(anyCase, BinaryOperator.OR, cloneNode(condition));
          combined.location = statement.location;
          anyCase = combined;
        }
      }
      const defaultCondition = anyCase
        ? (() => {
          const condition = new UnaryOpNode(UnaryOperator.NOT, anyCase);
          condition.location = statement.location;
          return condition;
        })()
        : undefined;
      for (const [name, base] of before) {
        const arms = casePlans.map((branchPlans) => branchPlans.get(name));
        const fallback = defaultPlans.get(name);
        if (arms.some((plan) => !plan || plan.writes.length < base.writes.length)
          || !fallback || fallback.writes.length < base.writes.length) {
          active.delete(name);
          continue;
        }
        const merged = copyPlans(new Map([[name, base]])).get(name)!;
        arms.forEach((plan, index) => {
          for (const write of plan!.writes.slice(base.writes.length)) {
            merged.writes.push({
              index: cloneNode(write.index) as ExpressionNode,
              value: cloneNode(write.value) as ExpressionNode,
              condition: branchCondition(caseConditions[index], write.condition, false),
            });
          }
        });
        for (const write of fallback.writes.slice(base.writes.length)) {
          merged.writes.push({
            index: cloneNode(write.index) as ExpressionNode,
            value: cloneNode(write.value) as ExpressionNode,
            ...(defaultCondition && {
              condition: branchCondition(defaultCondition, write.condition, false),
            }),
          });
        }
        let mergedLength = cloneNode(fallback.length) as ExpressionNode;
        for (let index = arms.length - 1; index >= 0; index -= 1) {
          const selectedLength = new TernaryOpNode(
            cloneNode(caseConditions[index]), cloneNode(arms[index]!.length), mergedLength,
          );
          selectedLength.location = statement.location;
          selectedLength.type = arms[index]!.length.type ?? mergedLength.type;
          mergedLength = selectedLength;
        }
        merged.length = mergedLength;
        active.set(name, merged);
      }
    };
    const transformBlock = (
      block: BlockNode,
      active: Map<string, ArrayPlan>,
      snapshots = new Map<string, ExpressionNode>(),
      snapshotAssignments = true,
    ): void => {
      const transformed: StatementNode[] = [];
      for (const statement of block.statements ?? []) {
        if (statement instanceof WhileNode || statement instanceof DoWhileNode) {
          const loopPlans = copyPlans(active);
          const canonical = canonicalLoops.get(statement);
          if (canonical) for (const [name, plan] of loopPlans) {
            const directPushes = (statement.block.statements ?? []).filter((candidate): candidate is ArrayPushNode =>
              candidate instanceof ArrayPushNode && candidate.name === name);
            const directPops = (statement.block.statements ?? []).filter((candidate): candidate is ArrayPopNode =>
              candidate instanceof ArrayPopNode && candidate.name === name);
            let mutationCount = 0;
            let resizeCount = 0;
            const loopAssignedNames = new Set<string>();
            walk(statement.block, (candidate) => {
              if ((candidate instanceof ArrayAssignNode || candidate instanceof ArrayDeleteNode
                || candidate instanceof ArrayPushNode || candidate instanceof ArrayPopNode)
                && candidate.name === name) mutationCount += 1;
              if ((candidate instanceof ArrayPushNode || candidate instanceof ArrayPopNode)
                && candidate.name === name) resizeCount += 1;
              if (candidate instanceof AssignNode) {
                loopAssignedNames.add(candidate.identifier.name);
                if (candidate.identifier.name === name) mutationCount += 1;
              }
            });
            // A fixed number of unconditional same-kind resizes has a closed length recurrence. Pushes additionally
            // publish one value recipe per source site; pops only shorten the already-known prefix. Mixed or nested
            // schedules retain their ordinary array accesses and are refused by admission.
            const directResizeCount = directPushes.length + directPops.length;
            let fixedPushes = directPushes.length > 0 && directPops.length === 0
              && mutationCount === directPushes.length && resizeCount === directPushes.length;
            const fixedPops = directPops.length > 0 && directPushes.length === 0
              && mutationCount === directPops.length && resizeCount === directPops.length;
            // Preinstalling every push recipe lets a read between push sites observe all prior iterations while
            // plan.length excludes later pushes from the current iteration. A push value which depends on another
            // loop-assigned local has no single counter-only recipe, and a self-read would recursively depend on the
            // array being reconstructed, so keep either form fenced.
            const unavailablePushNames = new Set(loopAssignedNames).add(name);
            unavailablePushNames.delete(canonical.logical);
            if (fixedPushes && directPushes.some((push) =>
              containsNamedIdentifier(push.value, unavailablePushNames))) fixedPushes = false;
            if ((!fixedPushes && !fixedPops) || directResizeCount === 0) {
              if (resizeCount > 0) {
                node.messageBusUnboundedConstructedArray = true;
                loopPlans.delete(name);
              }
              continue;
            }
            const counter = new IdentifierNode(canonical.logical);
            counter.location = statement.location;
            const start = new IntLiteralNode(canonical.start);
            start.location = statement.location;
            const delta = new BinaryOpNode(counter, BinaryOperator.MINUS, start);
            delta.location = statement.location;
            const step = canonical.stepExpression
              ? cloneNode(canonical.stepExpression) : new IntLiteralNode(canonical.step);
            step.location = statement.location;
            const occurrence = new BinaryOpNode(delta, BinaryOperator.DIV, step);
            occurrence.location = statement.location;
            const resizeWidth = fixedPushes ? directPushes.length : directPops.length;
            const precedingResizes = resizeWidth === 1
              ? occurrence
              : new BinaryOpNode(
                occurrence, BinaryOperator.MUL, new IntLiteralNode(BigInt(resizeWidth)),
              );
            precedingResizes.location = statement.location;
            const length = new BinaryOpNode(
              cloneNode(plan.length), fixedPushes ? BinaryOperator.PLUS : BinaryOperator.MINUS, precedingResizes,
            );
            length.location = statement.location;
            length.type = plan.length.type;
            if (fixedPushes) {
              plan.recurrence = {
                counter: canonical.logical,
                start: canonical.start,
                step: canonical.step,
                ...(canonical.stepExpression && {
                  stepExpression: cloneNode(canonical.stepExpression) as ExpressionNode,
                }),
                baseLength: cloneNode(plan.length) as ExpressionNode,
                pushesPerIteration: directPushes.length,
              };
              directPushes.forEach((push, ordinal) => {
                const index = ordinal === 0
                  ? cloneNode(length) as ExpressionNode
                  : new BinaryOpNode(
                    cloneNode(length), BinaryOperator.PLUS, new IntLiteralNode(BigInt(ordinal)),
                  );
                index.location = push.location;
                plan.writes.push({
                  index,
                  value: replaceSnapshots(push.value, snapshots),
                  recurrence: {
                    ...plan.recurrence!, ordinal,
                    baseLength: cloneNode(plan.recurrence!.baseLength) as ExpressionNode,
                    ...(plan.recurrence!.stepExpression && {
                      stepExpression: cloneNode(plan.recurrence!.stepExpression) as ExpressionNode,
                    }),
                  },
                });
              });
            }
            plan.length = length;
          }
          // A straight-line write followed by a key read in the same canonical iteration is replayable:
          // `xs[i] = f(i); m[xs[i]] = v` becomes the symbolic `f(i)` key plus the ordinary on-chain equality
          // check against `xs[i]`. Start the loop from the dominating pre-loop plan and let transformBlock add
          // writes as it walks source order. Branches still receive isolated copies and invalidate the outer
          // plan at their join, so a conditionally initialized or prior-iteration array value remains fenced.
          transformBlock(statement.block, loopPlans, new Map(snapshots), false);
          transformed.push(statement);
          for (const name of mutatedArrays(statement)) active.delete(name);
          continue;
        }
        if (statement instanceof BranchNode) {
          const before = copyPlans(active);
          const ifPlans = copyPlans(active);
          const elsePlans = copyPlans(active);
          const ifSnapshots = new Map(snapshots);
          const elseSnapshots = new Map(snapshots);
          transformBlock(statement.ifBlock, ifPlans, ifSnapshots, false);
          if (statement.elseBlock) transformBlock(statement.elseBlock, elsePlans, elseSnapshots, false);
          mergeBranchPlans(active, before, ifPlans, elsePlans, statement.condition);
          // Preserve a finite scalar assignment join for a later constructed-array write. The source branch still
          // performs the assignment normally; this symbolic environment only gives the SDK the same post-branch
          // value (`take ? assigned : incoming`) when deriving the key. Restrict the join to direct assignments in
          // each arm. Nested control/loops are left as reassigned names and keep the existing fail-closed behavior.
          const incomingDefinitions: VariableDefinitionNode[] = [];
          const ensureIncomingSnapshot = (name: string): ExpressionNode => {
            const existing = snapshots.get(name);
            if (existing) return existing;
            const type = localTypes.get(name);
            const snapshotName = `${VMAP_KEY_SNAPSHOT_PREFIX}${this.serial++}`;
            const source = new IdentifierNode(name);
            source.type = type;
            const definition = new VariableDefinitionNode(type!, [], snapshotName, source);
            definition.location = statement.location;
            const identifier = new IdentifierNode(snapshotName);
            identifier.type = type;
            identifier.location = statement.location;
            incomingDefinitions.push(definition);
            snapshots.set(name, identifier);
            return identifier;
          };
          const directArmAssignments = (
            arm: BlockNode | undefined,
            initial: ReadonlyMap<string, ExpressionNode>,
          ): { values: Map<string, ExpressionNode>; assigned: Set<string>; unsupported: Set<string> } => {
            const values = new Map(initial);
            const assigned = new Set<string>();
            const unsupported = new Set<string>();
            const collectNestedAssignments = (candidate: Node): void => {
              if (candidate instanceof AssignNode && snapshotDependencyNames.has(candidate.identifier.name)) {
                unsupported.add(candidate.identifier.name);
                return;
              }
              for (const [key, value] of Object.entries(candidate)) {
                if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
                  || key === 'resolvedFunction' || key === 'functionReference' || key === 'collection'
                  || key === 'stateVariable') continue;
                if (value instanceof Node) collectNestedAssignments(value);
                else if (Array.isArray(value)) {
                  for (const item of value) if (item instanceof Node) collectNestedAssignments(item);
                }
              }
            };
            for (const armStatement of arm?.statements ?? []) {
              if (armStatement instanceof AssignNode
                && snapshotDependencyNames.has(armStatement.identifier.name)) {
                if (!values.has(armStatement.identifier.name)) {
                  values.set(
                    armStatement.identifier.name,
                    ensureIncomingSnapshot(armStatement.identifier.name),
                  );
                }
                values.set(
                  armStatement.identifier.name,
                  replaceSnapshots(armStatement.expression, values),
                );
                assigned.add(armStatement.identifier.name);
              } else {
                collectNestedAssignments(armStatement);
              }
            }
            return { values, assigned, unsupported };
          };
          const ifValues = directArmAssignments(statement.ifBlock, snapshots);
          const elseValues = directArmAssignments(statement.elseBlock, snapshots);
          for (const name of new Set([...ifValues.assigned, ...elseValues.assigned,
            ...ifValues.unsupported, ...elseValues.unsupported])) {
            if (ifValues.unsupported.has(name) || elseValues.unsupported.has(name)) {
              snapshots.delete(name);
              reassignedNames.add(name);
              continue;
            }
            const fallback = new IdentifierNode(name);
            fallback.type = localTypes.get(name);
            const ifValue = ifValues.values.get(name) ?? snapshots.get(name) ?? fallback;
            const elseValue = elseValues.values.get(name) ?? snapshots.get(name) ?? fallback;
            const merged = new TernaryOpNode(
              replaceSnapshots(statement.condition, snapshots),
              cloneNode(ifValue) as ExpressionNode,
              cloneNode(elseValue) as ExpressionNode,
            );
            merged.location = statement.location;
            merged.type = localTypes.get(name) ?? ifValue.type ?? elseValue.type;
            snapshots.set(name, merged);
          }
          transformed.push(...incomingDefinitions, statement);
          continue;
        }
        if (statement instanceof SwitchNode) {
          const before = copyPlans(active);
          const casePlans = statement.cases.map(() => copyPlans(active));
          statement.cases.forEach((candidate, index) => {
            transformBlock(candidate.body, casePlans[index], new Map(snapshots), false);
          });
          const defaultPlans = copyPlans(active);
          if (statement.defaultCase) transformBlock(
            statement.defaultCase, defaultPlans, new Map(snapshots), false,
          );
          mergeSwitchPlans(
            active, before, casePlans, defaultPlans, statement,
            replaceSnapshots(statement.expression, snapshots),
          );
          transformed.push(statement);
          continue;
        }
        if (statement instanceof TryCatchNode) {
          transformBlock(statement.tryBlock, copyPlans(active), new Map(snapshots), false);
          for (const candidate of statement.catchClauses) {
            transformBlock(candidate.block, copyPlans(active), new Map(snapshots), false);
          }
          transformed.push(statement);
          for (const name of mutatedArrays(statement)) active.delete(name);
          continue;
        }

        // Preserve the value of a straight-line assignment in an immutable local. Rewriting the source
        // assignment to that local evaluates its right-hand side exactly once, while later key-array writes can
        // refer to a value whose SDK recipe is still expressed in entry arguments. Chained assignments compose
        // by using the previous snapshot in the next initializer.
        const assignmentSnapshot = snapshotAssignments && statement instanceof AssignNode
          && snapshotDependencyNames.has(statement.identifier.name)
          && !statement.identifier.name.startsWith('__internal__')
          ? (() => {
            const assignedType = statement.expression.type ?? statement.identifier.type
              ?? localTypes.get(statement.identifier.name);
            if (!assignedType) return undefined;
            const name = `${VMAP_KEY_SNAPSHOT_PREFIX}${this.serial++}`;
            const expression = replaceSnapshots(statement.expression, snapshots);
            const definition = new VariableDefinitionNode(
              assignedType, [], name, expression,
            );
            definition.location = statement.location;
            const identifier = new IdentifierNode(name);
            identifier.location = statement.expression.location;
            identifier.type = definition.type;
            statement.expression = cloneNode(identifier);
            snapshots.set(statement.identifier.name, identifier);
            return definition;
          })() : undefined;
        const replayedArrayValue = statement instanceof ArrayAssignNode || statement instanceof ArrayPushNode
          ? replaceSnapshots(statement.value, snapshots) : undefined;
        const replayedArrayIndex = statement instanceof ArrayAssignNode
          ? replaceSnapshots(statement.index, snapshots) : undefined;
        const keySnapshot = (statement instanceof ArrayAssignNode || statement instanceof ArrayPushNode)
          && active.has(statement.name)
          && replayedArrayValue !== undefined && containsFutureReassignedName(replayedArrayValue)
          ? (() => {
            const name = `__internal__vmapKeySnapshot_${this.serial++}`;
            const definition = new VariableDefinitionNode(
              replayedArrayValue.type ?? active.get(statement.name)!.elementType,
              [], name, cloneNode(replayedArrayValue),
            );
            definition.location = statement.location;
            const identifier = new IdentifierNode(name);
            identifier.location = statement.value.location;
            identifier.type = definition.type;
            return { definition, identifier };
          })() : undefined;
        const lengthSnapshot = statement instanceof VariableDefinitionNode
          && statement.expression instanceof NewArrayNode && resizedLocalArrayNames.has(statement.name)
          ? (() => {
            // An allocation captures its size at this statement. Use the same immutable value for both the real
            // allocation and later symbolic push/pop indices, so a subsequent reassignment of a size parameter
            // cannot retroactively move an earlier push.
            const name = `${VMAP_KEY_SNAPSHOT_PREFIX}${this.serial++}`;
            const definition = new VariableDefinitionNode(
              statement.expression.size.type ?? new IntType(true, 256), [], name,
              replaceSnapshots(statement.expression.size, snapshots),
            );
            definition.location = statement.location;
            const identifier = new IdentifierNode(name);
            identifier.location = statement.expression.size.location;
            identifier.type = definition.type;
            statement.expression.size = cloneNode(identifier);
            return { definition, identifier };
          })() : undefined;
        transformed.push(
          ...(assignmentSnapshot ? [assignmentSnapshot] : []),
          ...rewriteMappingKeys(statement, active),
          ...(keySnapshot ? [keySnapshot.definition] : []),
          ...(lengthSnapshot ? [lengthSnapshot.definition] : []), statement,
        );
        const escaped = escapedPlanNames(statement, active);
        if (statement instanceof VariableDefinitionNode && statement.expression instanceof NewArrayNode) {
          active.set(statement.name, {
            elementType: statement.expression.elementType,
            defaultValue: createDefaultValueExpression(
              statement.expression.elementType, statement.location,
            ),
            length: lengthSnapshot?.identifier
              ?? replaceSnapshots(statement.expression.size, snapshots),
            writes: [],
          });
        } else if (statement instanceof ArrayAssignNode && active.has(statement.name)) {
          if (!replayedArrayIndex || !replayedArrayValue
            || containsReassignedName(replayedArrayIndex) || containsReassignedName(replayedArrayValue)) {
            active.delete(statement.name);
          } else {
            active.get(statement.name)!.writes.push({
              index: cloneNode(replayedArrayIndex) as ExpressionNode,
              value: keySnapshot?.identifier ?? cloneNode(replayedArrayValue) as ExpressionNode,
            });
          }
        } else if (statement instanceof ArrayDeleteNode && active.has(statement.name)) {
          active.get(statement.name)!.writes.push({
            index: cloneNode(statement.index) as ExpressionNode,
            value: cloneNode(active.get(statement.name)!.defaultValue) as ExpressionNode,
          });
        } else if (statement instanceof ArrayPushNode && active.has(statement.name)
          && replayedArrayValue !== undefined && !containsReassignedName(replayedArrayValue)) {
          const plan = active.get(statement.name)!;
          if (!plan.recurrence) {
            plan.writes.push({
              index: cloneNode(plan.length) as ExpressionNode,
              value: keySnapshot?.identifier ?? cloneNode(replayedArrayValue) as ExpressionNode,
            });
          }
          const one = new IntLiteralNode(1n);
          one.location = statement.location;
          one.type = plan.length.type ?? new IntType(true, 256);
          const length = new BinaryOpNode(cloneNode(plan.length), BinaryOperator.PLUS, one);
          length.location = statement.location;
          length.type = plan.length.type;
          plan.length = length;
        } else if (statement instanceof ArrayPopNode && active.has(statement.name)) {
          const plan = active.get(statement.name)!;
          const one = new IntLiteralNode(1n);
          one.location = statement.location;
          one.type = plan.length.type ?? new IntType(true, 256);
          const length = new BinaryOpNode(cloneNode(plan.length), BinaryOperator.MINUS, one);
          length.location = statement.location;
          length.type = plan.length.type;
          plan.length = length;
        } else if (statement instanceof ArrayPushNode || statement instanceof ArrayPopNode
          || statement instanceof AssignNode) {
          active.delete(statement instanceof AssignNode ? statement.identifier.name : statement.name);
          if (statement instanceof AssignNode) reassignedNames.add(statement.identifier.name);
        }
        for (const name of escaped) active.delete(name);
      }
      block.statements = transformed;
    };
    transformBlock(node.body, plans);
  }
}
