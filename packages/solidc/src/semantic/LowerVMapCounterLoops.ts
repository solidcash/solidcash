import {
  AddressSendExpressionNode, AddressTransferStatementNode, ArrayAccessNode, ArrayAssignNode, ArrayDeleteNode,
  ArrayPopNode, ArrayPushNode,
  AssignNode, BinaryOpNode, BlockNode, BoolLiteralNode, BranchNode, BreakNode, CastNode, CollectionNode, ContinueNode,
  ContractNode,
  DoWhileNode,
  DeleteLocalNode,
  EmitStatementNode, ExpressionNode, ExpressionStatementNode, ExternalFunctionCallNode, FunctionCallNode,
  FunctionCallStatementNode,
  FieldAccessNode, FunctionDefinitionNode, IdentifierNode, IntLiteralNode, LiteralNode, MappingAccessNode,
  MappingAssignNode, MappingDeleteNode,
  MappingFieldAssignNode, MethodCallNode, MethodCallStatementNode, NewArrayNode, Node, ParameterNode, RequireNode,
  SourceFileNode,
  ReturnNode,
  StateAccessNode, StateArrayAssignNode, StateArrayDeleteNode, StateArrayPopNode, StateArrayPushNode,
  StateAssignNode, StatementNode, SwitchNode, TernaryOpNode, TokenContainerMethodStatementNode, TransferStatementNode,
  TryCatchNode, TupleAssignmentNode, TupleIndexOpNode, UnaryOpNode, VariableDefinitionNode, WhileNode, FunctionModifier,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { createDefaultValueExpression } from '../ast/defaults.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
import { canonicalizeUpsertKeyExpression } from '../generation/upsertKeySources.js';
import {
  AddressType, ArrayType, BytesType, FixedType, IntType, PrimitiveType, StructType, Type,
} from '@solidcash/utils';
import {
  isFunctionEntryInvariantMappingKey, VMAP_KEY_SNAPSHOT_PREFIX,
} from './CacheMappingEntryInLoop.js';

export const VMAP_COUNTER_PERM_PREFIX = '__internal__vmapCounterPerm_';
export const VMAP_COUNTER_OLD_PREFIX = '__internal__vmapCounterOld_';
export const VMAP_COUNTER_VALUE_PREFIX = '__internal__vmapCounterValue_';
export const VMAP_COUNTER_PREFIX_COUNT_PREFIX = '__internal__vmapCounterPrefixCount_';
export const VMAP_COUNTER_SOURCE_INDEX_PREFIX = '__internal__vmapCounterSourceIndex_';
export const VMAP_COUNTER_INPUT_COUNT_PREFIX = '__internal__vmapCounterInputCount_';
export const VMAP_COUNTER_OUTPUT_COUNT_PREFIX = '__internal__vmapCounterOutputCount_';
export const VMAP_RUNTIME_INPUT_COUNT_PREFIX = '__internal__vmapRuntimeInputCount_';
export const VMAP_RUNTIME_OUTPUT_COUNT_PREFIX = '__internal__vmapRuntimeOutputCount_';
/** One compact `0x06` access program per runtime journal stream in this selected row. */
export const KERNEL_JOURNAL_ACCESS_STREAMS = '__internal__kernelJournalAccessStreams';
/** Transaction-wide truthful initial `0x05` records selected by the compact access programs. */
export const KERNEL_JOURNAL_RECORDS = '__internal__kernelJournalRecords';
export class CounterLoopReadWriteConflictError extends Error {
  constructor(collection: string) {
    super(
      `Counter-loop requirement cannot read collection '${collection}' while the same loop writes it; `
      + 'pending cross-iteration mapping reads are unsupported',
    );
    this.name = this.constructor.name;
  }
}
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
  constructor(private readonly publishJournalAccessStreams = false) {
    super();
  }

  private collections = new Set<string>();
  private collectionsByName = new Map<string, CollectionNode>();
  private stateTypes = new Map<string, Type>();
  private functionsByName = new Map<string, FunctionDefinitionNode[]>();
  private eventfulFunctionNames = new Set<string>();
  private externalTypeNames = new Set<string>();
  private structTypeNames = new Set<string>();
  private serial = 0;
  private readonly constructedArrayPrefixCountTraces = new WeakMap<WhileNode | DoWhileNode, Array<{
    witnessParam: string;
    condition: ExpressionNode;
  }>>();

  private readonly constructedArrayPrefixCountOriginalKeys = new WeakMap<StatementNode, ExpressionNode[]>();
  private readonly constructedArrayPrefixCountChecks = new WeakSet<RequireNode>();
  private readonly constructedArrayPrefixCountUses = new WeakMap<StatementNode, Array<{
    witnessParam: string;
    condition: ExpressionNode;
  }>>();

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
    this.stateTypes = new Map(node.stateVariables.map((state) => [state.name, state.type]));
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
    // Returning event helpers with a linearizable tail are beta-reduced before this pass, so their emits already
    // appear at their exact caller positions and participate in the ordinary runtime stream. A surviving
    // helper-owned fixed event cannot be interleaved soundly (for example, a short-circuited call which must not
    // be hoisted). Compute a conservative transitive set before visiting any function and keep only those
    // non-linearizable calls fenced.
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
    const normalizedMutableEventCounters = new WeakMap<WhileNode | DoWhileNode, {
      counter: string; bound: ExpressionNode;
    }>();
    /**
     * A parameter can itself be the source counter (`while (remaining > 0) { emit E(remaining); remaining--; }`).
     * Preserve that source mutation, but expose the finite domain through a compiler-owned rank initialized at
     * zero. This is a semantic normalization, not an application-shaped special case: the ordinary canonical
     * counter machinery still owns cardinality, event ordering, and the 64-iteration proof. Only strict unit-step
     * progressions with one trailing counter mutation are normalized. In particular, a continue or a second
     * mutation could bypass/double the step and therefore remains fail-closed.
     */
    const normalizeMutableParameterEventLoops = (root: BlockNode): void => {
      const visibleParameters = new Map(node.parameters
        .filter((parameter) => !parameter.name.startsWith('__internal__'))
        .map((parameter) => [parameter.name, parameter]));
      const contains = (candidate: Node, predicate: (value: Node) => boolean): boolean => {
        if (predicate(candidate)) return true;
        for (const [key, value] of Object.entries(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'functionReference') continue;
          if (value instanceof Node && contains(value, predicate)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && contains(item, predicate))) return true;
        }
        return false;
      };
      const boundarySupported = (expression: ExpressionNode, counter: string): boolean => {
        if (expression instanceof IntLiteralNode) return true;
        if (expression instanceof IdentifierNode) {
          return expression.name !== counter && visibleParameters.has(expression.name);
        }
        if (expression instanceof CastNode || expression instanceof UnaryOpNode) {
          return expression instanceof CastNode || expression.operator === UnaryOperator.NEGATE
            ? boundarySupported(expression.expression, counter) : false;
        }
        return expression instanceof BinaryOpNode
          && (expression.operator === BinaryOperator.PLUS || expression.operator === BinaryOperator.MINUS)
          && boundarySupported(expression.left, counter) && boundarySupported(expression.right, counter);
      };
      const writesAnyIdentifier = (candidate: Node, names: ReadonlySet<string>): boolean => {
        if (candidate instanceof AssignNode || candidate instanceof DeleteLocalNode) {
          return names.has(candidate.identifier.name);
        }
        if (candidate instanceof TupleAssignmentNode) {
          return candidate.elements.some((element) => element.name !== undefined && names.has(element.name));
        }
        return candidate instanceof UnaryOpNode
          && candidate.expression instanceof IdentifierNode
          && names.has(candidate.expression.name)
          && [UnaryOperator.POSTFIX_INCREMENT, UnaryOperator.PREFIX_INCREMENT,
            UnaryOperator.POSTFIX_DECREMENT, UnaryOperator.PREFIX_DECREMENT]
            .includes(candidate.operator);
      };
      for (let index = 0; index < (root.statements?.length ?? 0); index += 1) {
        const statement = root.statements![index];
        if (!(statement instanceof WhileNode || statement instanceof DoWhileNode)
          || !(statement.condition instanceof BinaryOpNode)
          || !contains(statement.block, (candidate) => candidate instanceof EmitStatementNode)) {
          if (statement instanceof BlockNode) normalizeMutableParameterEventLoops(statement);
          else if (statement instanceof BranchNode) {
            normalizeMutableParameterEventLoops(statement.ifBlock);
            if (statement.elseBlock) normalizeMutableParameterEventLoops(statement.elseBlock);
          } else if (statement instanceof SwitchNode) {
            for (const arm of statement.cases) normalizeMutableParameterEventLoops(arm.body);
            if (statement.defaultCase) normalizeMutableParameterEventLoops(statement.defaultCase);
          }
          continue;
        }
        const condition = statement.condition;
        const body = statement.block.statements ?? [];
        const candidateNames = [condition.left, condition.right]
          .filter((candidate): candidate is IdentifierNode => candidate instanceof IdentifierNode
            && visibleParameters.has(candidate.name))
          .map((candidate) => candidate.name);
        const counter = candidateNames.find((name) => {
          const update = normalizeDiscardedCounterUpdate(body.at(-1), name);
          return update?.identifier.name === name;
        });
        if (!counter) continue;
        const leftCounter = condition.left instanceof IdentifierNode && condition.left.name === counter;
        const rightCounter = condition.right instanceof IdentifierNode && condition.right.name === counter;
        if (leftCounter === rightCounter) continue;
        const boundary = leftCounter ? condition.right : condition.left;
        const comparison = leftCounter ? condition.operator : ({
          [BinaryOperator.LT]: BinaryOperator.GT,
          [BinaryOperator.GT]: BinaryOperator.LT,
        } as Partial<Record<BinaryOperator, BinaryOperator>>)[condition.operator];
        if ((comparison !== BinaryOperator.LT && comparison !== BinaryOperator.GT)
          || !boundarySupported(boundary, counter)
          || contains(statement.block, (candidate) => candidate instanceof ContinueNode
            || (candidate !== statement.block
              && (candidate instanceof WhileNode || candidate instanceof DoWhileNode)))) continue;
        const sourceUpdate = normalizeDiscardedCounterUpdate(body.at(-1), counter);
        const expression = sourceUpdate?.expression;
        const counterOnLeft = expression instanceof BinaryOpNode
          && expression.left instanceof IdentifierNode && expression.left.name === counter;
        const magnitude = counterOnLeft && expression.right instanceof IntLiteralNode
          ? expression.right.value : undefined;
        const sourceStep = expression instanceof BinaryOpNode && magnitude === 1n
          ? expression.operator === BinaryOperator.PLUS ? 1n
            : expression.operator === BinaryOperator.MINUS ? -1n : undefined
          : undefined;
        const advances = (comparison === BinaryOperator.LT && sourceStep === 1n)
          || (comparison === BinaryOperator.GT && sourceStep === -1n);
        const counterWriteCount = (() => {
          let count = 0;
          contains(statement.block, (candidate) => {
            if (writesAnyIdentifier(candidate, new Set([counter]))) count += 1;
            return false;
          });
          return count;
        })();
        const boundaryNames = new Set<string>();
        contains(boundary, (candidate) => {
          if (candidate instanceof IdentifierNode) boundaryNames.add(candidate.name);
          return false;
        });
        const priorMutatesDomain = root.statements!.slice(0, index).some((candidate) =>
          contains(candidate, (value) => writesAnyIdentifier(value, new Set([counter, ...boundaryNames]))));
        const bodyMutatesBoundary = contains(statement.block,
          (candidate) => writesAnyIdentifier(candidate, boundaryNames));
        if (!advances || counterWriteCount !== 1 || !sourceUpdate
          || sourceUpdate !== body.at(-1) || priorMutatesDomain) continue;
        if (bodyMutatesBoundary) continue;

        const serial = this.serial++;
        const countName = `__internal__mutableCounterCount_${serial}`;
        const rankName = `__internal__mutableCounterRank_${serial}`;
        const counterRead = new IdentifierNode(counter);
        counterRead.location = condition.location;
        counterRead.type = visibleParameters.get(counter)?.type;
        const positiveDifference = comparison === BinaryOperator.LT
          ? new BinaryOpNode(cloneNode(boundary), BinaryOperator.MINUS, counterRead)
          : new BinaryOpNode(counterRead, BinaryOperator.MINUS, cloneNode(boundary));
        positiveDifference.location = condition.location;
        positiveDifference.type = visibleParameters.get(counter)?.type;
        // The snapshot is evaluated before the source pre-test. Guard the subtraction so an unsigned counter
        // which already lies outside the loop domain still has the source's zero iterations rather than an
        // eager underflow. A do-while consumes one occurrence from this zero bound by the ordinary post-test rule.
        const tripCount = new TernaryOpNode(cloneNode(condition), positiveDifference, new IntLiteralNode(0n));
        tripCount.location = condition.location;
        tripCount.type = visibleParameters.get(counter)?.type;
        const counterType = visibleParameters.get(counter)?.type instanceof IntType
          ? visibleParameters.get(counter)!.type : new IntType(true, 256);
        const countDefinition = new VariableDefinitionNode(counterType, [], countName, tripCount);
        countDefinition.location = statement.location;
        countDefinition.allowUnused = true;
        const rankDefinition = new VariableDefinitionNode(
          counterType, [], rankName, new IntLiteralNode(0n),
        );
        rankDefinition.location = statement.location;
        rankDefinition.allowUnused = true;
        const rankCondition = new BinaryOpNode(
          new IdentifierNode(rankName), BinaryOperator.LT, new IdentifierNode(countName),
        );
        rankCondition.location = condition.location;
        rankCondition.type = condition.type;
        statement.condition = rankCondition;
        body[body.length - 1] = sourceUpdate;
        const rankUpdate = new AssignNode(
          new IdentifierNode(rankName),
          new BinaryOpNode(
            new IdentifierNode(rankName), BinaryOperator.PLUS, new IntLiteralNode(1n),
          ),
        );
        rankUpdate.location = sourceUpdate.location;
        body.push(rankUpdate);
        statement.block.statements = body;
        root.statements!.splice(index, 0, countDefinition, rankDefinition);
        index += 2;
        normalizedMutableEventCounters.set(statement, { counter, bound: cloneNode(tripCount) });
      }
    };
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
    normalizeMutableParameterEventLoops(node.body);
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
            ].filter((name) => name !== normalizedMutableEventCounters.get(loop)?.counter),
            boundDefinitions,
            boundAssignments: boundResolution.assignments,
            boundOffset: boundResolution.offset,
            ...((normalizedMutableEventCounters.get(loop)?.bound ?? boundResolution.metadataExpression)
              && { boundExpression: normalizedMutableEventCounters.get(loop)?.bound
                ?? boundResolution.metadataExpression }),
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
    const rollbackConstructedArrayPrefixCounts = (): void => {
      const restore = (block: BlockNode): void => {
        const statements: StatementNode[] = [];
        for (const statement of block.statements ?? []) {
          if (statement instanceof RequireNode
            && this.constructedArrayPrefixCountChecks.has(statement)) continue;
          const original = this.constructedArrayPrefixCountOriginalKeys.get(statement);
          if (original) {
            if (statement instanceof ArrayAssignNode || statement instanceof ArrayDeleteNode) {
              statement.index = cloneNode(original[0]);
            } else if (statement instanceof MappingAssignNode || statement instanceof MappingDeleteNode
              || statement instanceof MappingFieldAssignNode) {
              statement.keys = original.map((key) => cloneNode(key));
            }
          }
          if (statement instanceof WhileNode || statement instanceof DoWhileNode) restore(statement.block);
          else if (statement instanceof BranchNode) {
            restore(statement.ifBlock);
            if (statement.elseBlock) restore(statement.elseBlock);
          } else if (statement instanceof SwitchNode) {
            for (const switchCase of statement.cases) restore(switchCase.body);
            if (statement.defaultCase) restore(statement.defaultCase);
          } else if (statement instanceof BlockNode) restore(statement);
          statements.push(statement);
        }
        block.statements = statements;
      };
      restore(node.body);
    };
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
        if (!runtimeEmits.has(x) && !x.runtimeLoopEvent) return true;
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
    const counterLoopWork = (loop: WhileNode | DoWhileNode, logical: string): {
      counterWrite: boolean; event: boolean; readRequirement: boolean;
    } => {
      let counterWrite = false;
      let event = false;
      const containsCounterMappingRead = (candidate: Node): boolean => {
        if (candidate instanceof MappingAccessNode && candidate.keys.some((key) =>
          containsIdentifier(key, logical))) return true;
        if (candidate instanceof ArrayAccessNode) {
          const keys: ExpressionNode[] = [];
          let root: ExpressionNode = candidate;
          while (root instanceof ArrayAccessNode) {
            keys.unshift(root.index);
            root = root.array;
          }
          if ((root instanceof IdentifierNode || root instanceof StateAccessNode)
            && this.collections.has(root.name)
            && keys.some((key) => containsIdentifier(key, logical))) return true;
        }
        return Object.entries(candidate).some(([key, value]) => {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') return false;
          if (value instanceof Node) return containsCounterMappingRead(value);
          return Array.isArray(value)
            && value.some((item) => item instanceof Node && containsCounterMappingRead(item));
        });
      };
      const containsReadRequirement = (statement: StatementNode): boolean => {
        if (statement instanceof RequireNode) return containsCounterMappingRead(statement.expression);
        if (statement instanceof BlockNode) return (statement.statements ?? []).some(containsReadRequirement);
        if (statement instanceof BranchNode) return containsReadRequirement(statement.ifBlock)
          || (!!statement.elseBlock && containsReadRequirement(statement.elseBlock));
        return statement instanceof SwitchNode && (statement.cases.some((arm) =>
          containsReadRequirement(arm.body))
          || (!!statement.defaultCase && containsReadRequirement(statement.defaultCase)));
      };
      const readRequirement = (loop.block.statements ?? []).some(containsReadRequirement);
      const walk = (x: Node): void => {
        if (x !== loop.block && (x instanceof WhileNode || x instanceof DoWhileNode)) return;
        if (isWrite(x) && this.collections.has(x.name) && counterKeyIndex(x, logical) >= 0) {
          counterWrite = true;
        }
        // A preceding semantic pass may already own this exact occurrence domain (notably affine recursion).
        // Such a site still participates in source-order assembly below, but must not be enrolled in a second
        // counter permutation or reserve its 64 outputs twice.
        if (x instanceof EmitStatementNode && !x.runtimeLoopEvent) event = true;
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node) walk(value);
          else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
        }
      };
      walk(loop.block);
      return { counterWrite, event, readRequirement };
    };
    // Analyze every candidate before mutating the AST. This keeps the lowering transactional: one unsupported
    // loop cannot leak an unused compiler-owned permutation into an otherwise ordinary ABI.
    // An event-only canonical loop still needs an authenticated exact domain even though it has no mapping stream
    // to sort. Give it the same bounded hidden counter witness used by mapping/event loops; the SDK already derives
    // that witness from the encoded pre/post-test domain, including the zero-iteration pre-test case. Other
    // effect-only loops remain outside this pass until their own typed recipe lowering enrolls them explicitly.
    const counterWorkLoops = [...canonicalLoops].filter(([loop, canonical]) => {
      const work = counterLoopWork(loop, canonical.logical);
      return work.counterWrite || work.event || work.readRequirement;
    });
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
      if (expression instanceof IdentifierNode && expression.name !== counterName
        && localValues.has(expression.name)) {
        if (resolving.has(expression.name)) return undefined;
        const remainingLocals = new Map(localValues);
        remainingLocals.delete(expression.name);
        return expandRuntimePathExpression(
          cloneNode(localValues.get(expression.name)!), counterName,
          new Set(resolving).add(expression.name), stateValues, remainingLocals,
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
      // A direct source-order requirement can consume an authenticated counter-derived mapping value without
      // owning a destination write. Detect it before the ordinary "no keyed work" exit; the read-only stream is
      // materialized transactionally below after its type and key recipe have been proven.
      type RuntimeReadRequirement = { requirement: RequireNode; condition?: ExpressionNode };
      const directRuntimeReadRequirements: RuntimeReadRequirement[] = [];
      const collectRuntimeReadRequirements = (statement: StatementNode, condition?: ExpressionNode): void => {
        if (statement instanceof RequireNode) {
          directRuntimeReadRequirements.push({ requirement: statement, condition });
          return;
        }
        if (statement instanceof BlockNode) {
          for (const nested of statement.statements ?? []) collectRuntimeReadRequirements(nested, condition);
          return;
        }
        if (statement instanceof BranchNode) {
          collectRuntimeReadRequirements(statement.ifBlock, pathAnd(condition, statement.condition));
          if (statement.elseBlock) collectRuntimeReadRequirements(
            statement.elseBlock, pathAnd(condition, pathNot(statement.condition)),
          );
          return;
        }
        if (statement instanceof SwitchNode) {
          let unmatched = condition;
          for (const arm of statement.cases) {
            const match = new BinaryOpNode(
              cloneNode(statement.expression), BinaryOperator.EQ, cloneNode(arm.value),
            );
            match.location = arm.location ?? statement.location;
            collectRuntimeReadRequirements(arm.body, pathAnd(unmatched, match));
            unmatched = pathAnd(unmatched, pathNot(match));
          }
          if (statement.defaultCase) collectRuntimeReadRequirements(statement.defaultCase, unmatched);
        }
      };
      const containsRuntimeCollectionRead = (candidate: Node): boolean => {
        if (candidate instanceof MappingAccessNode && this.collections.has(candidate.name)
          && candidate.keys.some((key) => containsIdentifier(key, logical))) return true;
        if (candidate instanceof ArrayAccessNode) {
          const keys: ExpressionNode[] = [];
          let root: ExpressionNode = candidate;
          while (root instanceof ArrayAccessNode) {
            keys.unshift(root.index);
            root = root.array;
          }
          if ((root instanceof IdentifierNode || root instanceof StateAccessNode)
            && this.collections.has(root.name)
            && keys.some((key) => containsIdentifier(key, logical))) return true;
        }
        return Object.entries(candidate).some(([key, value]) => {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') return false;
          if (value instanceof Node) return containsRuntimeCollectionRead(value);
          return Array.isArray(value)
            && value.some((item) => item instanceof Node && containsRuntimeCollectionRead(item));
        });
      };
      for (const statement of block.statements ?? []) collectRuntimeReadRequirements(statement);
      if (loop.sourceAuthoredLoop && keyed.length > 0 && directRuntimeReadRequirements.length > 0) {
        const writtenCollections = new Set(keyed.map((write) => write.name));
        const conflictingReadCollection = (candidate: Node): string | undefined => {
          if (candidate instanceof MappingAccessNode
            && writtenCollections.has(candidate.name)
            && candidate.keys.some((key) => containsIdentifier(key, logical))) return candidate.name;
          if (candidate instanceof ArrayAccessNode) {
            const keys: ExpressionNode[] = [];
            let root: ExpressionNode = candidate;
            while (root instanceof ArrayAccessNode) {
              keys.unshift(root.index);
              root = root.array;
            }
            if ((root instanceof IdentifierNode || root instanceof StateAccessNode)
              && writtenCollections.has(root.name)
              && keys.some((key) => containsIdentifier(key, logical))) return root.name;
          }
          for (const [key, value] of Object.entries(candidate)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
              || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
            if (value instanceof Node) {
              const conflict = conflictingReadCollection(value);
              if (conflict) return conflict;
            }
            if (Array.isArray(value)) for (const item of value) if (item instanceof Node) {
              const conflict = conflictingReadCollection(item);
              if (conflict) return conflict;
            }
          }
          return undefined;
        };
        const conflict = directRuntimeReadRequirements.map(({ requirement }) =>
          conflictingReadCollection(requirement.expression)).find((collection) => collection !== undefined);
        if (conflict) {
          throw new CounterLoopReadWriteConflictError(conflict);
        }
      }
      const prefixCountTraces = [...new Map(keyed.flatMap((write) =>
        (this.constructedArrayPrefixCountUses.get(write) ?? []).map((trace) => [trace.witnessParam, trace]))).values()];
      if (keyed.some((write) => (this.constructedArrayPrefixCountUses.get(write)?.length ?? 0) > 1)) return false;
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
      const predicateOuterTypes = new Map<string, Type>();
      if (predicateOuterIndex >= 0) {
        for (const statement of canonical.parent.statements!.slice(0, predicateOuterIndex)) {
          if (statement instanceof VariableDefinitionNode && statement.expression) {
            predicateOuterInitializers.set(statement.name, statement.expression);
            predicateOuterTypes.set(statement.name, statement.type);
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
      const hasOuterContinue = (candidate: Node): boolean => {
        if (candidate instanceof ContinueNode) return true;
        if (candidate !== block && (candidate instanceof WhileNode || candidate instanceof DoWhileNode)) return false;
        for (const [key, value] of Object.entries(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof Node && hasOuterContinue(value)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && hasOuterContinue(item))) return true;
        }
        return false;
      };
      const recurrenceCrossesContinue = hasOuterContinue(block);
      const containsLocalAssignment = (candidate: Node, name: string): boolean => {
        if (candidate instanceof AssignNode && candidate.identifier.name === name) return true;
        for (const [key, value] of Object.entries(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof Node && containsLocalAssignment(value, name)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && containsLocalAssignment(item, name))) return true;
        }
        return false;
      };
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
        const reassignedBeforeLoop = predicateOuterIndex >= 0
          && canonical.parent.statements!.slice(0, predicateOuterIndex)
            .some((statement) => containsLocalAssignment(statement, name));
        const collapsedExtras = (conditionalAssignmentJoins.get(name) ?? [])
          .reduce((sum, join) => sum + join.actualAssignments - 1, 0);
        if (allAssignments !== updates.length + collapsedExtras
          || reassignedBeforeLoop || recurrenceCrossesContinue) continue;
        const toggles = updates.every(({ statement }) => {
          const expression = statement.expression;
          return expression instanceof UnaryOpNode && expression.operator === UnaryOperator.NOT
            && expression.expression instanceof IdentifierNode && expression.expression.name === name;
        });
        if (!initializer) continue;
        // Recurrence consumers are not limited to collection writes. Event-only counter loops need the same
        // source-position recipe so their commitments can be planned before the VM trace exists. Keep this
        // statement-based (rather than naming effect kinds): any replayable consumer contributes an observation,
        // while the effect collector below decides whether that expression is actually publishable.
        const observationPositions = (block.statements ?? []).flatMap((statement, index) => (
          !updates.some((update) => update.index === index) && containsIdentifier(statement, name) ? [index] : []
        ));
        if (observationPositions.length === 0) continue;
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
          const valuesByPhase = new Map<number, ExpressionNode>();
          for (const position of observationPositions) {
            const phase = updates.filter(({ index }) => index < position).length;
            let value = valuesByPhase.get(phase);
            if (!value) {
              const totalToggles = new BinaryOpNode(
                new BinaryOpNode(rank, BinaryOperator.MUL, new IntLiteralNode(BigInt(updates.length))),
                BinaryOperator.PLUS,
                new IntLiteralNode(BigInt(phase)),
              );
              const even = new BinaryOpNode(
                new BinaryOpNode(totalToggles, BinaryOperator.MOD, new IntLiteralNode(2n)),
                BinaryOperator.EQ,
                new IntLiteralNode(0n),
              );
              const toggled = new UnaryOpNode(UnaryOperator.NOT, cloneNode(initializer));
              value = new TernaryOpNode(even, cloneNode(initializer), toggled);
              value.location = updates[0].statement.location;
              locateGenerated(value);
              valuesByPhase.set(phase, value);
            }
            const siteValues = loopCarriedLocalValuesByStatement.get(position) ?? new Map();
            siteValues.set(name, cloneNode(value));
            loopCarriedLocalValuesByStatement.set(position, siteValues);
          }
          if (valuesByPhase.size === 1) {
            loopCarriedLocalValues.set(name, cloneNode(valuesByPhase.values().next().value!));
          }
          continue;
        }

        // A straight-line affine self recurrence has the same closed form as the scalar-state recurrence below.
        // This notably covers a public parameter used as its own source counter after the normalization above,
        // but remains name- and role-independent: any local `x = x +/- invariant` observed by an event can use
        // the authenticated logical rank. Counter-dependent, coupled, conditional, and continue-skipped deltas
        // are deliberately excluded here rather than approximated.
        const recurrenceDeltas: ExpressionNode[] = [];
        let affineRecurrence = updates.length > 0;
        for (const { statement } of updates) {
          const expression = statement.expression;
          if (!(expression instanceof BinaryOpNode)
            || !(expression.operator === BinaryOperator.PLUS || expression.operator === BinaryOperator.MINUS)
            || !(expression.left instanceof IdentifierNode) || expression.left.name !== name
            || containsIdentifier(expression.right, logical)
            || [...topLevelAssignments.keys()].some((assigned) => assigned !== name
              && containsIdentifier(expression.right, assigned))
            || !runtimePathExpressionSupported(
              expression.right, logical, new Set(), stateValues, loopCarriedLocalValues,
            )) {
            affineRecurrence = false;
            break;
          }
          const delta = expandRuntimePathExpression(
            expression.right, logical, new Set(), stateValues, loopCarriedLocalValues,
          );
          if (!delta) { affineRecurrence = false; break; }
          recurrenceDeltas.push(expression.operator === BinaryOperator.PLUS
            ? delta : new BinaryOpNode(new IntLiteralNode(0n), BinaryOperator.MINUS, delta));
        }
        if (affineRecurrence && !recurrenceCrossesContinue) {
          const normalizedSourceCounter = normalizedMutableEventCounters.get(loop)?.counter === name
            && initializer instanceof IdentifierNode && initializer.name === name;
          const expandedInitializer = normalizedSourceCounter
            ? cloneNode(initializer)
            : runtimePathExpressionSupported(
              initializer, logical, new Set(), stateValues, loopCarriedLocalValues,
            ) && expandRuntimePathExpression(
              initializer, logical, new Set(), stateValues, loopCarriedLocalValues,
            );
          if (expandedInitializer) {
            const netDelta = recurrenceDeltas.reduce<ExpressionNode | undefined>((sum, delta) =>
              sum ? new BinaryOpNode(sum, BinaryOperator.PLUS, cloneNode(delta)) : cloneNode(delta), undefined);
            for (const position of observationPositions) {
              const phase = updates.filter((update) => update.index < position).length;
              let value: ExpressionNode = cloneNode(expandedInitializer);
              if (netDelta) {
                value = new BinaryOpNode(
                  value, BinaryOperator.PLUS,
                  new BinaryOpNode(cloneNode(rank), BinaryOperator.MUL, cloneNode(netDelta)),
                );
              }
              for (const delta of recurrenceDeltas.slice(0, phase)) {
                value = new BinaryOpNode(value, BinaryOperator.PLUS, cloneNode(delta));
              }
              value.location = updates[0].statement.location;
              locateGenerated(value);
              const siteValues = loopCarriedLocalValuesByStatement.get(position) ?? new Map();
              siteValues.set(name, value);
              loopCarriedLocalValuesByStatement.set(position, siteValues);
            }
            continue;
          }
        }

        // Straight-line unconditional assignments which do not read themselves have an exact closed form at every
        // source-order phase. A use after assignment K observes fK(i); a use before the first assignment observes
        // the initializer at rank zero and the final assignment evaluated at i-step thereafter. Preserve one value
        // per statement site: distinct keyed writes may legitimately observe opposite sides of the same update.
        if (updates.some(({ statement }) => containsIdentifier(statement.expression, name))) continue;
        const usePositions = observationPositions;
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
      const loopCarriedStateValuesByStatement = new Map<number, Map<string, ExpressionNode>>();
      const containsStateAccess = (candidate: Node, name: string): boolean => {
        if (candidate instanceof StateAccessNode && candidate.name === name) return true;
        for (const [key, value] of Object.entries(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof Node && containsStateAccess(value, name)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && containsStateAccess(item, name))) return true;
        }
        return false;
      };
      const countStateAssignmentsTo = (candidate: Node, name: string): number => {
        if (candidate !== block && (candidate instanceof WhileNode || candidate instanceof DoWhileNode)) return 0;
        let assignmentCount = candidate instanceof StateAssignNode && candidate.name === name ? 1 : 0;
        for (const [key, value] of Object.entries(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof Node) assignmentCount += countStateAssignmentsTo(value, name);
          else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) {
            assignmentCount += countStateAssignmentsTo(item, name);
          }
        }
        return assignmentCount;
      };
      const topLevelStateAssignments = new Map<string, Array<{ statement: StateAssignNode; index: number }>>();
      for (const [index, statement] of (block.statements ?? []).entries()) {
        if (!(statement instanceof StateAssignNode)) continue;
        const updates = topLevelStateAssignments.get(statement.name) ?? [];
        updates.push({ statement, index });
        topLevelStateAssignments.set(statement.name, updates);
      }
      const readsLoopAssignedState = (candidate: Node): boolean => {
        if (candidate instanceof StateAccessNode
          && countStateAssignmentsTo(block, candidate.name) > 0) return true;
        for (const [key, value] of Object.entries(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof Node && readsLoopAssignedState(value)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && readsLoopAssignedState(item))) return true;
        }
        return false;
      };
      const containsLocalDefinition = (candidate: Node, name: string): boolean => {
        if (candidate !== block && (candidate instanceof WhileNode || candidate instanceof DoWhileNode)) {
          return false;
        }
        if (candidate instanceof VariableDefinitionNode && candidate.name === name) return true;
        for (const [key, value] of Object.entries(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof Node && containsLocalDefinition(value, name)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && containsLocalDefinition(item, name))) return true;
        }
        return false;
      };
      const readsLoopAssignedLocal = (candidate: Node): boolean => {
        if (candidate instanceof IdentifierNode
          && candidate.name !== logical
          && (countAssignmentsTo(block, candidate.name) > 0
            || containsLocalDefinition(block, candidate.name))) return true;
        for (const [key, value] of Object.entries(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof Node && readsLoopAssignedLocal(value)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && readsLoopAssignedLocal(item))) return true;
        }
        return false;
      };
      const readsCollection = (candidate: Node): boolean => {
        if (candidate instanceof MappingAccessNode) return true;
        for (const [key, value] of Object.entries(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof Node && readsCollection(value)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && readsCollection(item))) return true;
        }
        return false;
      };
      const readsState = (candidate: Node): boolean => {
        if (candidate instanceof StateAccessNode) return true;
        for (const [key, value] of Object.entries(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof Node && readsState(value)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && readsState(item))) return true;
        }
        return false;
      };
      const containsTruncatingArithmetic = (candidate: Node): boolean => {
        if (candidate instanceof BinaryOpNode
          && [BinaryOperator.DIV, BinaryOperator.MOD, BinaryOperator.POW].includes(candidate.operator)) return true;
        for (const [key, value] of Object.entries(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof Node && containsTruncatingArithmetic(value)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && containsTruncatingArithmetic(item))) return true;
        }
        return false;
      };
      const hasOuterBreak = (candidate: Node): boolean => {
        if (candidate instanceof BreakNode) return true;
        if (candidate !== block && (candidate instanceof WhileNode || candidate instanceof DoWhileNode)) {
          return false;
        }
        for (const [key, value] of Object.entries(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof Node && hasOuterBreak(value)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && hasOuterBreak(item))) return true;
        }
        return false;
      };
      const recurrenceCrossesBreak = hasOuterBreak(block);
      const definitionCounts = new Map<string, number>();
      const countDefinitions = (candidate: Node): void => {
        if (candidate !== block && (candidate instanceof WhileNode || candidate instanceof DoWhileNode)) return;
        if (candidate instanceof VariableDefinitionNode) {
          definitionCounts.set(candidate.name, (definitionCounts.get(candidate.name) ?? 0) + 1);
        }
        for (const [key, value] of Object.entries(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof Node) countDefinitions(value);
          else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) {
            countDefinitions(item);
          }
        }
      };
      countDefinitions(block);
      // Prefixing an affine recurrence regroups its additions into rank products. Restrict newly replayed
      // loop-carried locals and their target state to arbitrary-precision integers: a bounded checked source can
      // execute safely while an equivalent regrouping overflows (or vice versa), which would reject a valid call.
      const independentAffineLocal = (name: string): boolean => {
        const updates = topLevelAssignments.get(name) ?? [];
        const initializer = predicateOuterInitializers.get(name)
          ?? (visibleParameters.some((parameter) => parameter.name === name)
            ? new IdentifierNode(name) : undefined);
        if (!initializer || updates.length === 0
          || countAssignmentsTo(block, name) !== updates.length
          || updates.some((update) => !(block.statements ?? []).includes(update.statement))
          || hasObservableEffect(initializer)
          || readsState(initializer)
          || readsCollection(initializer)
          || containsTruncatingArithmetic(initializer)
          || readsLoopAssignedLocal(initializer)) return false;
        return updates.every(({ statement }) => {
          const expression = statement.expression;
          const localType = predicateOuterTypes.get(name)
            ?? visibleParameters.find((parameter) => parameter.name === name)?.type;
          return localType === PrimitiveType.BIGINT
            && expression instanceof BinaryOpNode
            && (expression.operator === BinaryOperator.PLUS || expression.operator === BinaryOperator.MINUS)
            && expression.left instanceof IdentifierNode && expression.left.name === name
            && !containsIdentifier(expression.right, logical)
            && !hasObservableEffect(expression.right)
            && !readsState(expression.right)
            && !readsCollection(expression.right)
            && !containsTruncatingArithmetic(expression.right)
            && !readsLoopAssignedLocal(expression.right);
        });
      };
      // A direct per-iteration definition is an SSA alias when it has one source site, is never reassigned, and
      // depends only on the counter, public/invariant locals, and earlier aliases from this same iteration. Keep a
      // source-position environment so an update cannot see a later or conditionally defined value.
      const deterministicAliasesAt = new Map<number, Map<string, ExpressionNode>>();
      const activeAliases = new Map<string, ExpressionNode>();
      for (const [index, statement] of (block.statements ?? []).entries()) {
        deterministicAliasesAt.set(index, new Map(activeAliases));
        if (!(statement instanceof VariableDefinitionNode) || !statement.expression
          || definitionCounts.get(statement.name) !== 1
          || countAssignmentsTo(block, statement.name) !== 0
          || statement.inlinedReturningHelperPure === false
          || hasObservableEffect(statement.expression)
          || readsCollection(statement.expression)
          || readsState(statement.expression)
          || containsTruncatingArithmetic(statement.expression)) continue;
        let readsUnavailableLoopLocal = false;
        const inspectDependencies = (candidate: Node): void => {
          if (candidate instanceof IdentifierNode && candidate.name !== logical
            && (definitionCounts.get(candidate.name) ?? 0) > 0
            && !activeAliases.has(candidate.name)) readsUnavailableLoopLocal = true;
          for (const [key, value] of Object.entries(candidate)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
              || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
            if (value instanceof Node) inspectDependencies(value);
            else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) {
              inspectDependencies(item);
            }
          }
        };
        inspectDependencies(statement.expression);
        if (readsUnavailableLoopLocal || !runtimePathExpressionSupported(
          statement.expression, logical, new Set(), stateValues,
          new Map([...loopCarriedLocalValues, ...activeAliases]),
        )) continue;
        const expanded = expandRuntimePathExpression(
          statement.expression, logical, new Set(), stateValues,
          new Map([...loopCarriedLocalValues, ...activeAliases]),
        );
        if (expanded) activeAliases.set(statement.name, expanded);
      }
      const unsupportedLoopAlias = (
        candidate: Node, aliases: ReadonlyMap<string, ExpressionNode>,
      ): boolean => {
        if (candidate instanceof IdentifierNode && candidate.name !== logical
          && (countAssignmentsTo(block, candidate.name) > 0
            || (definitionCounts.get(candidate.name) ?? 0) > 0)
          && !aliases.has(candidate.name)) return true;
        for (const [key, value] of Object.entries(candidate)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
          if (value instanceof Node && unsupportedLoopAlias(value, aliases)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && unsupportedLoopAlias(item, aliases))) return true;
        }
        return false;
      };
      const isScalarRecurrenceRank = (candidate: ExpressionNode): boolean => {
        if (unitDomain) return candidate instanceof IdentifierNode && candidate.name === logical;
        return !stepExpression
          && candidate instanceof BinaryOpNode && candidate.operator === BinaryOperator.DIV
          && candidate.left instanceof BinaryOpNode && candidate.left.operator === BinaryOperator.MINUS
          && candidate.left.left instanceof IdentifierNode && candidate.left.left.name === logical
          && candidate.left.right instanceof IntLiteralNode && candidate.left.right.value === start
          && candidate.right instanceof IntLiteralNode && candidate.right.value === step;
      };
      type CounterPolynomial = {
        quadratic?: ExpressionNode;
        slope?: ExpressionNode;
        intercept?: ExpressionNode;
      };
      const addAffineTerm = (
        left: ExpressionNode | undefined, right: ExpressionNode | undefined, operator = BinaryOperator.PLUS,
      ): ExpressionNode | undefined => {
        if (!left) return right && (operator === BinaryOperator.MINUS
          ? new BinaryOpNode(new IntLiteralNode(0n), BinaryOperator.MINUS, cloneNode(right))
          : cloneNode(right));
        if (!right) return cloneNode(left);
        return new BinaryOpNode(cloneNode(left), operator, cloneNode(right));
      };
      const combinePolynomial = (
        left: CounterPolynomial, right: CounterPolynomial, operator: BinaryOperator.PLUS | BinaryOperator.MINUS,
      ): CounterPolynomial => ({
        quadratic: addAffineTerm(left.quadratic, right.quadratic, operator),
        slope: addAffineTerm(left.slope, right.slope, operator),
        intercept: addAffineTerm(left.intercept, right.intercept, operator),
      });
      const multiplyAffineTerm = (
        left: ExpressionNode | undefined, right: ExpressionNode | undefined,
      ): ExpressionNode | undefined => {
        if (!left || !right || (left instanceof IntLiteralNode && left.value === 0n)
          || (right instanceof IntLiteralNode && right.value === 0n)) return undefined;
        if (left instanceof IntLiteralNode && left.value === 1n) return cloneNode(right);
        if (right instanceof IntLiteralNode && right.value === 1n) return cloneNode(left);
        return new BinaryOpNode(cloneNode(left), BinaryOperator.MUL, cloneNode(right));
      };
      const scalePolynomial = (polynomial: CounterPolynomial, factor: ExpressionNode): CounterPolynomial => ({
        quadratic: multiplyAffineTerm(polynomial.quadratic, factor),
        slope: multiplyAffineTerm(polynomial.slope, factor),
        intercept: multiplyAffineTerm(polynomial.intercept, factor),
      });
      // Decompose only expressions which are provably quadratic in the canonical iteration rank. A direct
      // logical-counter read is `start + step * rank`; recognizing the exact generated rank expression also lets
      // a source-position local recurrence feed this same algebra on non-unit domains. Integer
      // division/modulo, casts, calls, and products above degree two remain fenced: their per-iteration
      // truncation, width, or other semantics need not equal a polynomial prefix. Counter-free subexpressions
      // remain opaque replayable coefficients/constants.
      const counterPolynomial = (candidate: ExpressionNode): CounterPolynomial | undefined => {
        if (!containsIdentifier(candidate, logical)) return { intercept: cloneNode(candidate) };
        if (isScalarRecurrenceRank(candidate)) return { slope: new IntLiteralNode(1n) };
        if (candidate instanceof IdentifierNode && candidate.name === logical) {
          return {
            slope: stepValue(),
            ...(start !== 0n && { intercept: new IntLiteralNode(start) }),
          };
        }
        if (candidate instanceof UnaryOpNode && candidate.operator === UnaryOperator.NEGATE) {
          const inner = counterPolynomial(candidate.expression);
          return inner && scalePolynomial(inner, new IntLiteralNode(-1n));
        }
        if (!(candidate instanceof BinaryOpNode)) return undefined;
        if (candidate.operator === BinaryOperator.PLUS || candidate.operator === BinaryOperator.MINUS) {
          const left = counterPolynomial(candidate.left);
          const right = counterPolynomial(candidate.right);
          return left && right && combinePolynomial(left, right, candidate.operator);
        }
        if (candidate.operator !== BinaryOperator.MUL) return undefined;
        const leftDepends = containsIdentifier(candidate.left, logical);
        const rightDepends = containsIdentifier(candidate.right, logical);
        if (!leftDepends || !rightDepends) {
          const dependent = counterPolynomial(leftDepends ? candidate.left : candidate.right);
          return dependent && scalePolynomial(dependent, leftDepends ? candidate.right : candidate.left);
        }
        const left = counterPolynomial(candidate.left);
        const right = counterPolynomial(candidate.right);
        // Two counter-dependent factors are safe only when both are affine; otherwise their product exceeds the
        // closed-form degree admitted here. (a*i+b)*(c*i+d) is reconstructed coefficient-wise.
        if (!left || !right || left.quadratic || right.quadratic) return undefined;
        return {
          quadratic: multiplyAffineTerm(left.slope, right.slope),
          slope: addAffineTerm(
            multiplyAffineTerm(left.slope, right.intercept),
            multiplyAffineTerm(left.intercept, right.slope),
          ),
          intercept: multiplyAffineTerm(left.intercept, right.intercept),
        };
      };
      for (const [name, updates] of topLevelStateAssignments) {
        if (countStateAssignmentsTo(block, name) !== updates.length) continue;
        const observationPositions = (block.statements ?? []).flatMap((statement, index) => (
          !updates.some((update) => update.index === index) && containsStateAccess(statement, name) ? [index] : []
        ));
        // A multiplicative recurrence is expanded as a bounded, rank-selected chain of the original source
        // multiplications. This deliberately does not rewrite it as `base * factor ** rank`: preserving each
        // multiplication and selecting lazily preserves checked-overflow behavior even for zero bases and runtime
        // factors. Every factor must be invariant and resource-free; mixed additive/geometric updates, division,
        // modulo, powers, loop-carried factors, and state-derived factors remain fenced.
        const geometricFactors: ExpressionNode[] = [];
        let geometricBase: ExpressionNode | undefined;
        let geometric = updates.length > 0 && !recurrenceCrossesContinue;
        for (const { statement } of updates) {
          const recurrence = statement.expression;
          if (!(recurrence instanceof BinaryOpNode)
            || recurrence.operator !== BinaryOperator.MUL
            || !(recurrence.left instanceof StateAccessNode) || recurrence.left.name !== name
            || containsIdentifier(recurrence.right, logical)
            || !runtimePathExpressionSupported(recurrence.right, logical, new Set(), stateValues,
              loopCarriedLocalValues)
            || readsLoopAssignedLocal(recurrence.right)
            || readsLoopAssignedState(recurrence.right)
            || readsState(recurrence.right)
            || readsCollection(recurrence.right)
            || containsTruncatingArithmetic(recurrence.right)) {
            geometric = false;
            break;
          }
          geometricBase ??= cloneNode(stateValues.get(name) ?? recurrence.left);
          const factor = expandRuntimePathExpression(
            recurrence.right, logical, new Set(), stateValues, loopCarriedLocalValues,
          );
          if (!factor) { geometric = false; break; }
          geometricFactors.push(factor);
        }
        if (geometric && geometricBase && geometricFactors.length > 0
          && observationPositions.length > 0) {
          const rank = unitDomain
            ? new IdentifierNode(logical)
            : new BinaryOpNode(
              new BinaryOpNode(new IdentifierNode(logical), BinaryOperator.MINUS, new IntLiteralNode(start)),
              BinaryOperator.DIV, stepValue(),
            );
          let selected = cloneNode(geometricBase) as ExpressionNode;
          // Build F(k) = rank == k ? base : F(k + 1) * factors, from the maximum authenticated rank
          // backwards. Unlike materializing every power as a separate branch, this stays linear in the 64-rank
          // proof bound while retaining one lazy, source-ordered multiplication chain on the selected path.
          for (let occurrence = MAX_COUNTER_ITERATIONS - 1; occurrence >= 0; occurrence -= 1) {
            let next = selected;
            for (const factor of geometricFactors) {
              next = new BinaryOpNode(next, BinaryOperator.MUL, cloneNode(factor));
            }
            const atOccurrence = new BinaryOpNode(
              cloneNode(rank), BinaryOperator.EQ, new IntLiteralNode(BigInt(occurrence)),
            );
            selected = new TernaryOpNode(atOccurrence, cloneNode(geometricBase), next);
          }
          for (const position of observationPositions) {
            const phase = updates.filter((update) => update.index < position).length;
            let value = cloneNode(selected) as ExpressionNode;
            for (const factor of geometricFactors.slice(0, phase)) {
              value = new BinaryOpNode(value, BinaryOperator.MUL, cloneNode(factor));
            }
            value.location = updates[0].statement.location;
            const siteValues = loopCarriedStateValuesByStatement.get(position) ?? new Map();
            siteValues.set(name, value);
            loopCarriedStateValuesByStatement.set(position, siteValues);
          }
          continue;
        }
        const deltas: CounterPolynomial[] = [];
        let base: ExpressionNode | undefined;
        let supported = true;
        let usesDeterministicAlias = false;
        let usesIndependentRecurrence = false;
        for (const { statement, index } of updates) {
          const recurrence = statement.expression;
          const aliases = deterministicAliasesAt.get(index) ?? new Map<string, ExpressionNode>();
          const statementLocals = loopCarriedValuesAt(statement);
          const localValues = new Map([...statementLocals, ...aliases]);
          const referencedCarriedLocals = new Set<string>();
          const collectCarriedLocals = (candidate: Node): void => {
            if (candidate instanceof IdentifierNode && candidate.name !== logical
              && (countAssignmentsTo(block, candidate.name) > 0
                || (definitionCounts.get(candidate.name) ?? 0) > 0)
              && !aliases.has(candidate.name)) referencedCarriedLocals.add(candidate.name);
            for (const [key, value] of Object.entries(candidate)) {
              if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
                || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
              if (value instanceof Node) collectCarriedLocals(value);
              else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) {
                collectCarriedLocals(item);
              }
            }
          };
          if (recurrence instanceof BinaryOpNode) collectCarriedLocals(recurrence.right);
          const independentRecurrence = referencedCarriedLocals.size <= 1
            && [...referencedCarriedLocals].every((local) => {
              return statementLocals.has(local)
                && independentAffineLocal(local);
            });
          if (!(recurrence instanceof BinaryOpNode)
            || !(recurrence.operator === BinaryOperator.PLUS || recurrence.operator === BinaryOperator.MINUS)
            || !(recurrence.left instanceof StateAccessNode) || recurrence.left.name !== name
            || !independentRecurrence
            || (referencedCarriedLocals.size > 0
              && this.stateTypes.get(name) !== PrimitiveType.BIGINT)
            || !runtimePathExpressionSupported(recurrence.right, logical, new Set(), stateValues,
              localValues)
            || unsupportedLoopAlias(recurrence.right, new Map([...aliases, ...statementLocals]))
            || readsLoopAssignedState(recurrence.right)
            || readsCollection(recurrence.right)) {
            supported = false;
            break;
          }
          // The recurrence begins from the value which actually dominates the loop. A preceding scalar assignment
          // (including one expressed in terms of pre-state) must not silently collapse back to contract pre-state.
          base ??= cloneNode(stateValues.get(name) ?? recurrence.left);
          const expandedDelta = expandRuntimePathExpression(
            recurrence.right, logical, new Set(), stateValues, localValues,
          );
          usesDeterministicAlias ||= [...aliases.keys()].some((alias) =>
            containsIdentifier(recurrence.right, alias));
          usesIndependentRecurrence ||= referencedCarriedLocals.size > 0;
          const delta = expandedDelta && counterPolynomial(expandedDelta);
          if (!delta) { supported = false; break; }
          deltas.push(recurrence.operator === BinaryOperator.PLUS
            ? delta : scalePolynomial(delta, new IntLiteralNode(-1n)));
        }
        if (!supported || !base || deltas.length === 0 || recurrenceCrossesContinue
          || ((usesDeterministicAlias || usesIndependentRecurrence) && recurrenceCrossesBreak)) continue;
        const netDelta = deltas.reduce(
          (sum, delta) => combinePolynomial(sum, delta, BinaryOperator.PLUS),
          {} as CounterPolynomial,
        );
        const rank = unitDomain
          ? new IdentifierNode(logical)
          : new BinaryOpNode(
            new BinaryOpNode(new IdentifierNode(logical), BinaryOperator.MINUS, new IntLiteralNode(start)),
            BinaryOperator.DIV, stepValue(),
          );
        const triangularRank = new BinaryOpNode(
          new BinaryOpNode(
            cloneNode(rank), BinaryOperator.MUL,
            new BinaryOpNode(cloneNode(rank), BinaryOperator.MINUS, new IntLiteralNode(1n)),
          ),
          BinaryOperator.DIV,
          new IntLiteralNode(2n),
        );
        const squareRankPrefix = new BinaryOpNode(
          new BinaryOpNode(
            cloneNode(rank), BinaryOperator.MUL,
            new BinaryOpNode(cloneNode(rank), BinaryOperator.MINUS, new IntLiteralNode(1n)),
          ),
          BinaryOperator.MUL,
          new BinaryOpNode(
            new BinaryOpNode(new IntLiteralNode(2n), BinaryOperator.MUL, cloneNode(rank)),
            BinaryOperator.MINUS,
            new IntLiteralNode(1n),
          ),
        );
        const normalizedSquareRankPrefix = new BinaryOpNode(
          squareRankPrefix, BinaryOperator.DIV, new IntLiteralNode(6n),
        );
        const prefixValue = (delta: CounterPolynomial): ExpressionNode | undefined => addAffineTerm(
          multiplyAffineTerm(delta.quadratic, normalizedSquareRankPrefix),
          addAffineTerm(
            multiplyAffineTerm(delta.slope, triangularRank),
            multiplyAffineTerm(delta.intercept, rank),
          ),
        );
        const currentValue = (delta: CounterPolynomial): ExpressionNode | undefined => addAffineTerm(
          multiplyAffineTerm(
            delta.quadratic,
            new BinaryOpNode(cloneNode(rank), BinaryOperator.MUL, cloneNode(rank)),
          ),
          addAffineTerm(
            multiplyAffineTerm(delta.slope, rank),
            delta.intercept,
          ),
        );
        for (const position of observationPositions) {
          const phase = updates.filter((update) => update.index < position).length;
          const priorIterations = prefixValue(netDelta);
          const phaseDelta = deltas.slice(0, phase).reduce((sum, delta) => addAffineTerm(
            sum, currentValue(delta),
          ),
          undefined as ExpressionNode | undefined);
          let value: ExpressionNode = priorIterations
            ? new BinaryOpNode(cloneNode(base), BinaryOperator.PLUS, priorIterations)
            : cloneNode(base);
          if (phaseDelta) value = new BinaryOpNode(value, BinaryOperator.PLUS, phaseDelta);
          value.location = updates[0].statement.location;
          const siteValues = loopCarriedStateValuesByStatement.get(position) ?? new Map();
          siteValues.set(name, value);
          loopCarriedStateValuesByStatement.set(position, siteValues);
        }
      }
      const stateValuesAt = (candidate: Node): Map<string, ExpressionNode> => {
        const position = (block.statements ?? []).findIndex((statement) => containsNode(statement, candidate));
        const siteValues = loopCarriedStateValuesByStatement.get(position);
        return siteValues ? new Map([...stateValues, ...siteValues]) : stateValues;
      };
      const conditionAt = (expression: ExpressionNode, site: Node): ExpressionNode =>
        expandRuntimePathExpression(
          expression, logical, new Set(), stateValuesAt(site), loopCarriedValuesAt(site),
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
      const runtimeEmits: Array<{
        emit: EmitStatementNode; condition?: ExpressionNode; staticArguments?: ExpressionNode[];
        metadataArguments?: ExpressionNode[];
      }> = [];
      let conditionalRuntimeEmit = false;
      const collectRuntimeEmits = (
        x: Node,
        condition?: ExpressionNode,
      ): void => {
        if (x instanceof EmitStatementNode) {
          if (x.runtimeLoopEvent) return;
          const values = loopCarriedValuesAt(x);
          const effectStateValues = stateValuesAt(x);
          const position = (block.statements ?? []).findIndex((statement) => containsNode(statement, x));
          const replayedStateNames = loopCarriedStateValuesByStatement.get(position);
          const replayedLocalNames = loopCarriedLocalValuesByStatement.get(position);
          const staticArguments = keyed.length === 0 ? x.args.map((argument) =>
            runtimePathExpressionSupported(argument, logical, new Set(), effectStateValues, values)
              ? expandRuntimePathExpression(argument, logical, new Set(), effectStateValues, values)
              : undefined) : undefined;
          if (condition && !runtimePathExpressionSupported(
            condition, logical, new Set(), effectStateValues, values,
          ) || staticArguments?.some((argument) => argument === undefined)) conditionalRuntimeEmit = true;
          else {
            const expanded = condition && expandRuntimePathExpression(
              condition, logical, new Set(), effectStateValues, values,
            );
            if (condition && !expanded) conditionalRuntimeEmit = true;
            else runtimeEmits.push({
              emit: x,
              ...(expanded && { condition: expanded }),
              ...(staticArguments && { staticArguments: staticArguments as ExpressionNode[] }),
              ...(staticArguments && ((replayedStateNames && x.args.some((argument) =>
                [...replayedStateNames.keys()].some((name) => containsStateAccess(argument, name))))
                || (replayedLocalNames && x.args.some((argument) =>
                  [...replayedLocalNames.keys()].some((name) => containsIdentifier(argument, name))))) && {
                metadataArguments: staticArguments as ExpressionNode[],
              }),
            });
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
      // The first prefix-count protocol authenticates one count for every canonical source iteration. A compact
      // selected permutation or an early break has a different occurrence domain, so keep those combinations
      // frozen until the artifact carries an explicit full source-domain descriptor for the trace.
      if (prefixCountTraces.length > 0 && (writeSelectionCondition || breakPaths.length > 0)) return false;
      const selectionConditionSupported = keyedSelectionConditions.every((condition) => !condition
          || runtimePathExpressionSupported(
            condition, logical, new Set(), stateValues, loopCarriedLocalValues,
          ))
        && directRuntimeReadRequirements.every(({ requirement, condition }) => !condition
          || !containsRuntimeCollectionRead(requirement.expression)
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
      if ((keyed.length === 0 && runtimeEmits.length === 0 && directRuntimeReadRequirements.length === 0)
        || !selectionConditionSupported
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
        destination?: ArrayAssignNode | MappingAssignNode;
        consumer: StatementNode;
        sourceOrderConsumer: boolean;
        condition?: ExpressionNode;
        synthetic: MappingAssignNode;
        witnessParam: string;
        sourceIndexParam?: string;
        authenticatedReads: ArrayAccessNode[];
        consumerReads: ArrayAccessNode[];
      };
      const runtimeReadPlans: RuntimeReadPlan[] = [];
      // Authorization is deliberately occurrence-specific. A shape such as `m[i]` can appear both in an
      // admitted consumer and in an unsupported predicate/event; authorizing the textual shape would let the
      // latter evade the fail-closed scan without ever being rewritten to an authenticated witness.
      const authorizedRuntimeReads = new Set<Node>();
      const authorizePlannedReads = (root: Node, plans: ReadonlyMap<string, RuntimeReadPlan>): void => {
        const visit = (candidate: Node): void => {
          const access = collectionAccessOf(candidate);
          const shape = access ? `${access.name}\0${access.keys.map(expressionShape).join('|')}` : undefined;
          if (shape !== undefined && plans.has(shape) && containsLogical(candidate)) {
            authorizedRuntimeReads.add(candidate);
          }
          for (const [key, value] of Object.entries(candidate)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
              || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
            if (value instanceof Node) visit(value);
            else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) visit(item);
          }
        };
        visit(root);
      };
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
              authorizedRuntimeReads.add(candidate);
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
                  consumer: destination,
                  sourceOrderConsumer: false,
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
        if (!apply) authorizePlannedReads(expression, plansByShape);
        if (apply) {
          if (destination instanceof MappingAssignNode) destination.expression = rewritten;
          else destination.value = rewritten;
        }
      }
      // Unlike a write value, a requirement remains in logical source order. Its counter-derived reads still
      // travel as ordinary authenticated read-only streams. An unconditional requirement consumes one value at
      // each source rank; a nested requirement consumes the compact selected-domain witness at its path cursor.
      for (const { requirement, condition } of directRuntimeReadRequirements) {
        const plansByShape = new Map<string, RuntimeReadPlan>();
        const rewrite = (candidate: Node): Node => {
          const candidateAccess = candidate instanceof MappingAccessNode
            ? collectionAccessOf(candidate) : undefined;
          const candidateShape = candidateAccess
            ? `${candidateAccess.name}:${candidateAccess.keys.map(expressionShape).join('|')}` : undefined;
          if (candidateAccess && candidateShape !== undefined && containsLogical(candidate)) {
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
            if (sourceCollection?.sorted && supportedValue) {
              authorizedRuntimeReads.add(candidate);
              const shape = `${candidateAccess.name}\0${candidateAccess.keys.map(expressionShape).join('|')}`;
              let plan = plansByShape.get(shape);
              if (!plan) {
                const witnessParam = `${VMAP_COUNTER_OLD_PREFIX}read_${candidateAccess.name}_${serial}_${runtimeReadPlans.length}`;
                const witness = new IdentifierNode(witnessParam);
                witness.location = candidate.location ?? requirement.location;
                witness.type = new ArrayType(valueType);
                const witnessIndex = new IdentifierNode(logical);
                witnessIndex.location = candidate.location ?? requirement.location;
                const witnessRead = new ArrayAccessNode(witness, witnessIndex);
                witnessRead.location = candidate.location ?? requirement.location;
                witnessRead.type = valueType;
                const synthetic = new MappingAssignNode(
                  candidateAccess.name, candidateAccess.keys.map((key) => cloneNode(key)), witnessRead,
                );
                synthetic.location = candidate.location ?? requirement.location;
                synthetic.collection = sourceCollection;
                synthetic.messageBusRuntimeReadOnly = true;
                if (condition) synthetic.messageBusRuntimeOldValueWitnessDomain = 'selected-source';
                const authenticatedRead = cloneNode(witnessRead) as ArrayAccessNode;
                synthetic.messageBusRuntimeOldValueWitness = authenticatedRead;
                plan = {
                  consumer: requirement,
                  sourceOrderConsumer: true,
                  condition,
                  synthetic,
                  witnessParam,
                  ...(condition && {
                    sourceIndexParam: `${VMAP_COUNTER_SOURCE_INDEX_PREFIX}${serial}_${runtimeReadPlans.length}`,
                  }),
                  authenticatedReads: [witnessRead, authenticatedRead],
                  consumerReads: [],
                };
                plansByShape.set(shape, plan);
                runtimeReadPlans.push(plan);
              }
              const witness = new IdentifierNode(plan.witnessParam);
              witness.location = candidate.location ?? requirement.location;
              witness.type = new ArrayType(valueType);
              const replacementIndex = new IdentifierNode(logical);
              replacementIndex.location = candidate.location ?? requirement.location;
              const replacement = new ArrayAccessNode(witness, replacementIndex);
              replacement.location = candidate.location ?? requirement.location;
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
        const rewritten = rewrite(
          apply ? requirement.expression : cloneNode(requirement.expression),
        ) as ExpressionNode;
        if (!apply) authorizePlannedReads(requirement.expression, plansByShape);
        if (apply) requirement.expression = rewritten;
      }
      for (const plan of [...runtimeReadPlans].reverse()) {
        const destinationIndex = plan.destination ? keyed.indexOf(plan.destination) : -1;
        if (destinationIndex >= 0) keyed.splice(destinationIndex, 0, plan.synthetic);
        else keyed.push(plan.synthetic);
        keyedSet.add(plan.synthetic);
        writePaths.set(plan.synthetic, plan.destination ? writePaths.get(plan.destination) : plan.condition);
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
          if (authorizedRuntimeReads.has(x)) return false;
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
          if (signature !== allowed && !authorizedRuntimeReads.has(x)) return true;
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
        if (x instanceof MappingAccessNode && containsLogical(x)) {
          return !authorizedRuntimeReads.has(x);
        }
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
      const unsupportedCounterGuard = !writeSelectionCondition && hasCounterDependentGuard(block);
      const unsupportedSiblingRead = hasSiblingMappingRead(block);
      const unsupportedRead = hasUnsafeRead(block);
      const unsupportedCarriedGuard = !writeSelectionCondition && hasLoopCarriedWriteGuard(block);
      const unsupportedMutation = keyed.some((write) =>
        !structRuntimeRmws.has(write as ArrayAssignNode | MappingAssignNode)
          && !valueTracePlans.has(write as MappingAssignNode)
          && dependsOnLoopMutation(write, new Set(), true));
      if (unsupportedCounterGuard || unsupportedSiblingRead || unsupportedRead
        || hasUnsupportedOldEntryExpression || unsupportedCarriedGuard || unsupportedMutation) {
        return false;
      }

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
        domainOnly: boolean;
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
            domainOnly: false,
          });
        }
      }
      if (permutationGroups.size === 0 && runtimeEmits.length > 0) {
        // No physical collection consumes this permutation. It is nevertheless covenant-authenticated below and
        // is the exact repeat source for the runtime event stream. Keeping an empty collection/write projection
        // prevents event-only loops from manufacturing a fake mapping resource or a journal cardinality remainder.
        permutationGroups.set('__event_domain__', {
          collections: [], collectionWrites: [], selectionCondition: undefined, domainOnly: true,
        });
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
          sourceIndexParam: undefined as string | undefined,
          domainOnly: plan.domainOnly,
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
      for (const group of groups) {
        const selectedReadPlans = runtimeReadPlans.filter((plan) =>
          group.writes.has(plan.synthetic) && plan.sourceIndexParam !== undefined);
        if (selectedReadPlans.length === 0) continue;
        group.sourceIndexParam = selectedReadPlans[0].sourceIndexParam;
        for (const plan of selectedReadPlans) plan.sourceIndexParam = group.sourceIndexParam;
        (node.runtimeCounterLoopSourceOrderIndices ??= new Map()).set(
          group.hidden, group.sourceIndexParam!,
        );
      }
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
      const boundSnapshot = (boundAssignments.length > 0 || normalizedMutableEventCounters.has(loop))
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
      const prefixCountRead = (
        trace: (typeof prefixCountTraces)[number], index: ExpressionNode,
      ): ArrayAccessNode => {
        const witness = id(trace.witnessParam);
        witness.type = new ArrayType(new IntType(true, 256));
        const read = new ArrayAccessNode(witness, index);
        read.location = location;
        read.type = new IntType(true, 256);
        return read;
      };
      const permReadAt = (
        group: typeof groups[number], index: ExpressionNode,
      ): ArrayAccessNode => {
        const a = new IdentifierNode(group.hidden); a.location = location;
        a.type = new ArrayType(counterType);
        const r = new ArrayAccessNode(a, index); r.location = location; r.type = counterType; return r;
      };
      const permRead = (group: typeof groups[number]): ArrayAccessNode =>
        permReadAt(group, physical(group));
      const sourceIndexRead = (group: typeof groups[number]): ArrayAccessNode => {
        const inverse = id(group.sourceIndexParam!);
        inverse.type = new ArrayType(proofInt);
        const read = new ArrayAccessNode(inverse, id(group.settlementCursor));
        read.location = location;
        read.type = proofInt;
        return read;
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
        const destinationGroup = plan.destination ? groupByWrite.get(plan.destination) : undefined;
        if (!sourceGroup || (!plan.sourceOrderConsumer && !destinationGroup)) return false;
        const logicalRank = (group: typeof groups[number]): IdentifierNode =>
          id(unitDomain ? group.logicalValue : group.logicalRank);
        // A full-domain witness is indexed by source occurrence, not either stream's physical rank. The source
        // permutation authenticates witness[logical(source)] while an independent destination consumes
        // witness[logical(destination)]. A selected source-order consumer instead uses its compact path cursor.
        // A selected stream's physical keys and old-value witness are slot ordered. Its authenticated inverse
        // permutation maps each selected source occurrence to that physical rank for the source-order consumer.
        for (const read of plan.authenticatedReads) {
          read.index = plan.sourceOrderConsumer && sourceGroup.expandedSelectionCondition
            ? id(sourceGroup.settlementCursor) : logicalRank(sourceGroup);
        }
        for (const read of plan.consumerReads) {
          if (plan.sourceIndexParam) {
            const inverse = id(plan.sourceIndexParam);
            inverse.type = new ArrayType(new IntType(true, 256));
            read.index = at(new ArrayAccessNode(inverse, id(sourceGroup.settlementCursor)));
          } else read.index = plan.sourceOrderConsumer && sourceGroup.expandedSelectionCondition
            ? id(sourceGroup.settlementCursor)
            : plan.sourceOrderConsumer ? sourceRank() : logicalRank(destinationGroup!);
        }
        if (!insertBefore(block, plan.consumer, plan.synthetic)) return false;
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
        const prefixCountTrace = this.constructedArrayPrefixCountUses.get(write)?.[0];
        if (prefixCountTrace) {
          (node.runtimeCounterLoopPrefixCountTraces ??= new Map()).set(keyRecipe, {
            witnessParam: prefixCountTrace.witnessParam,
            condition: cloneNode(prefixCountTrace.condition),
          });
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
          {
            loopIndex: eventLoopIndex,
            permutationParam: primaryGroup.hidden,
            ...(primaryGroup.domainOnly && { staticArguments: true as const }),
            ...(primaryGroup.domainOnly && expandedBreakCondition && {
              iterationBreakCondition: cloneNode(expandedBreakCondition),
            }),
          },
        ];
        runtimeEmits.forEach(({ emit, condition, staticArguments, metadataArguments }, siteIndex) => {
          if (staticArguments && !metadataArguments) emit.args = staticArguments;
          if (metadataArguments) emit.runtimeLoopEventArguments = metadataArguments;
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
      // iteration produces one mapping entry per distinct stream plus one record per unconditional event site.
      // Each mapping stream may also displace one predecessor while linking its complete insertion batch, so
      // reserve that single endpoint independently of the 64 operation slots. Summing here handles sequential
      // loops and multiple streams without recognizing a contract schema later in layout planning.
      node.runtimeCounterLoopOutputCapacity = (node.runtimeCounterLoopOutputCapacity ?? 0)
        + MAX_COUNTER_ITERATIONS * (keyedByStream.size + runtimeEmits.length + runtimeTransfers.length)
        + keyedByStream.size;
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
      for (const trace of prefixCountTraces) {
        prelude.push(at(new RequireNode(binary(
          at(new UnaryOpNode(UnaryOperator.SIZE, id(trace.witnessParam))),
          BinaryOperator.EQ,
          binary(iterationCount(), BinaryOperator.PLUS, lit(1n)),
        ), 'vmap counter prefix-count trace length mismatch')));
        prelude.push(at(new RequireNode(binary(
          prefixCountRead(trace, lit(0n)), BinaryOperator.EQ, lit(0n),
        ), 'vmap counter prefix-count trace must start at zero')));
      }
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
        if (group.sourceIndexParam) {
          prelude.push(at(new RequireNode(binary(
            at(new UnaryOpNode(UnaryOperator.SIZE, id(group.sourceIndexParam))),
            BinaryOperator.EQ,
            at(new UnaryOpNode(UnaryOperator.SIZE, id(group.hidden))),
          ), 'vmap counter source index length mismatch')));
        }
        if (group.domainOnly) continue;
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
      for (const trace of prefixCountTraces) {
        const rank = sourceRank();
        const selected = at(new TernaryOpNode(
          cloneNode(trace.condition), lit(1n), lit(0n),
        ));
        logicalAndProofStatements.push(at(new RequireNode(binary(
          prefixCountRead(trace, binary(cloneNode(rank), BinaryOperator.PLUS, lit(1n))),
          BinaryOperator.EQ,
          binary(prefixCountRead(trace, rank), BinaryOperator.PLUS, selected),
        ), 'vmap counter prefix-count trace mismatch')));
      }
      for (const group of groups) {
        // Domain-only event loops consume only the authenticated witness length. Their arguments derive the
        // logical source counter from the iteration ordinal, so witness elements are intentionally irrelevant.
        if (group.domainOnly) continue;
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
          ...(group.sourceIndexParam ? [
            at(new RequireNode(binary(
              binary(sourceIndexRead(group), BinaryOperator.GE, lit(0n)),
              BinaryOperator.AND,
              binary(
                sourceIndexRead(group), BinaryOperator.LT,
                at(new UnaryOpNode(UnaryOperator.SIZE, id(group.hidden))),
              ),
            ), 'vmap counter source index out of range')),
            at(new RequireNode(binary(
              permReadAt(group, sourceIndexRead(group)), BinaryOperator.EQ, id(logical),
            ), 'vmap counter source index mismatch')),
          ] : []),
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
      for (const trace of prefixCountTraces) {
        const parameter = new ParameterNode(
          new ArrayType(new IntType(true, 256)), trace.witnessParam,
        );
        parameter.location = node.location;
        added.push(parameter);
      }
      for (const plan of runtimeReadPlans) {
        if (plan.sourceIndexParam && !added.some((parameter) => parameter.name === plan.sourceIndexParam)) {
          const sourceIndex = new ParameterNode(new ArrayType(proofInt), plan.sourceIndexParam);
          sourceIndex.location = node.location;
          added.push(sourceIndex);
        }
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
    const counterWorkLoopSet = new Set(counterWorkLoops.map(([loop]) => loop));
    const allSafe = counterWorkLoops.length > 0
      && counterWorkLoops.every(([loop]) => tryLower(loop, false));
    if (!allSafe) rollbackConstructedArrayPrefixCounts();
    // Events outside an admitted loop must join the same trailing stream or their fixed output family would move
    // an `emit after` ahead of all repeated records. Serializable nested if/else predicates provide an exact
    // pre-probe count. Stable switch arms are the same finite predicate family. Try/catch, nested-loop sites, and
    // non-linearizable eventful internal helpers remain frozen until the runtime plan carries richer call context.
    const outerEmits: Array<{ emit: EmitStatementNode; condition?: ExpressionNode }> = [];
    let unsupportedOuterEvent = false;
    let eventfulHelperCall = false;
    const collectOuterEvents = (
      candidate: Node,
      conditions: readonly { expression: ExpressionNode; negated: boolean }[],
    ): void => {
      if (counterWorkLoopSet.has(candidate as WhileNode | DoWhileNode)) return;
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
      if (counterWorkLoopSet.has(statement as WhileNode | DoWhileNode)) return [index];
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
      for (const [loop] of counterWorkLoops) tryLower(loop, true);

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
          orderedSegments.push({ loopIndex,
            ...(prior.permutationParam !== undefined && { permutationParam: prior.permutationParam }),
            ...(prior.repeatCount !== undefined && { repeatCount: prior.repeatCount }),
            ...(prior.iterationDomain !== undefined && { iterationDomain: prior.iterationDomain }),
            ...(prior.staticArguments && { staticArguments: true as const }),
            ...(prior.iterationBreakCondition && {
              iterationBreakCondition: prior.iterationBreakCondition,
            }),
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
        if (counterWorkLoopSet.has(candidate as WhileNode | DoWhileNode)) {
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
    if (this.publishJournalAccessStreams && runtimeCountCollections.size > 0
      && !node.parameters.some((parameter) => parameter.name === KERNEL_JOURNAL_ACCESS_STREAMS)) {
      const accesses = new ParameterNode(new ArrayType(new BytesType()), KERNEL_JOURNAL_ACCESS_STREAMS);
      accesses.location = node.location;
      const records = new ParameterNode(new ArrayType(new BytesType()), KERNEL_JOURNAL_RECORDS);
      records.location = node.location;
      added.push(accesses, records);
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
      logical: string;
      count: string;
      boundOffset: bigint;
      boundExpression?: ExpressionNode;
      start: bigint;
      step: bigint;
      stepExpression?: ExpressionNode;
      postTest: boolean;
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
      pushesPerIterationExpression?: ExpressionNode;
    };
    type ArrayWrite = {
      index: ExpressionNode;
      value: ExpressionNode;
      condition?: ExpressionNode;
      recurrence?: ArrayRecurrence & { ordinal: number; ordinalExpression?: ExpressionNode };
    };
    type ArrayPlan = {
      elementType: Type;
      defaultValue: ExpressionNode;
      /** Symbolic source length at this point. It makes straight-line push/pop indices replayable. */
      length: ExpressionNode;
      /** Allocation prefix source which no observed pop has shortened. */
      stablePrefixSource?: ExpressionNode;
      /** An append history may be opaque while reads of this counter remain inside the stable prefix. */
      opaqueSuffixCounter?: string;
      writes: ArrayWrite[];
      /** A fixed number of unconditional pushes per canonical source iteration. */
      recurrence?: ArrayRecurrence;
      /** Exact N+1 prefix-boundary count witness for a conditional pop recurrence. */
      prefixCountTrace?: { witnessParam: string; condition: ExpressionNode };
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
    const constantOffsetForm = (
      expression: ExpressionNode,
    ): { base: string; offset: bigint } | undefined => {
      if (expression instanceof BinaryOpNode && expression.right instanceof IntLiteralNode
        && (expression.operator === BinaryOperator.PLUS
          || expression.operator === BinaryOperator.MINUS)) {
        const inner = constantOffsetForm(expression.left);
        if (!inner) return undefined;
        return {
          base: inner.base,
          offset: inner.offset + (expression.operator === BinaryOperator.PLUS
            ? expression.right.value : -expression.right.value),
        };
      }
      if (expression instanceof BinaryOpNode && expression.operator === BinaryOperator.PLUS
        && expression.left instanceof IntLiteralNode) {
        const inner = constantOffsetForm(expression.right);
        if (!inner) return undefined;
        return { base: inner.base, offset: inner.offset + expression.left.value };
      }
      const base = canonicalizeUpsertKeyExpression(expression, new Set());
      return base ? { base, offset: 0n } : undefined;
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
            if (targets.length > 0 && targets.every((target) => {
              const targetParameter = target.parameters[parameterIndex];
              // Only an explicit memory parameter aliases the caller's local array. The language's ordinary
              // array parameter is value-copied, so even a mutating helper cannot invalidate the caller plan.
              return targetParameter.type instanceof ArrayType
                && (!targetParameter.modifier.includes('memory')
                  || readOnlyArrayParameter(target, parameterIndex));
            })) continue;
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
      if (plan.opaqueSuffixCounter !== undefined
        && (!(access.index instanceof IdentifierNode)
          || access.index.name !== plan.opaqueSuffixCounter)) return undefined;
      let value = cloneNode(plan.defaultValue) as ExpressionNode;
      for (const write of plan.writes) {
        let selectedValue = cloneNode(write.value) as ExpressionNode;
        let selectedCondition = write.condition
          ? cloneNode(write.condition) as ExpressionNode : undefined;
        let matches: ExpressionNode;
        if (write.recurrence) {
          const recurrence = write.recurrence;
          const relative = new BinaryOpNode(
            cloneNode(access.index), BinaryOperator.MINUS, cloneNode(recurrence.baseLength),
          );
          relative.location = access.location;
          const selectedRecurrenceWidth = recurrence.pushesPerIterationExpression
            ? cloneNode(recurrence.pushesPerIterationExpression) as ExpressionNode
            : new IntLiteralNode(BigInt(recurrence.pushesPerIteration));
          selectedRecurrenceWidth.location = access.location;
          // An invariant conditional schedule may select a zero-width arm. That arm cannot contribute a matching
          // pushed element, but the symbolic read still constructs its rank expression before the write predicate
          // excludes it. Use one solely as the arithmetic denominator; plan.length and the site predicate retain
          // the real selected width, so this cannot manufacture an element for the zero-width arm.
          const recurrenceWidth = recurrence.pushesPerIterationExpression
            ? (() => {
              const nonzero = new BinaryOpNode(
                cloneNode(selectedRecurrenceWidth), BinaryOperator.NE, new IntLiteralNode(0n),
              );
              nonzero.location = access.location;
              const safe = new TernaryOpNode(
                nonzero, cloneNode(selectedRecurrenceWidth), new IntLiteralNode(1n),
              );
              safe.location = access.location;
              return safe;
            })()
            : selectedRecurrenceWidth;
          const occurrence = !recurrence.pushesPerIterationExpression
            && recurrence.pushesPerIteration === 1
            ? cloneNode(relative)
            : new BinaryOpNode(
              cloneNode(relative), BinaryOperator.DIV, cloneNode(recurrenceWidth),
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
          if (write.condition) {
            selectedCondition = replaceIdentifier(
              write.condition, recurrence.counter, logicalCounter,
            );
          }
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
          if (recurrence.pushesPerIterationExpression || recurrence.pushesPerIteration > 1) {
            const ordinal = new BinaryOpNode(
              cloneNode(relative), BinaryOperator.MOD, recurrenceWidth,
            );
            ordinal.location = access.location;
            const isThisPush = new BinaryOpNode(
              ordinal, BinaryOperator.EQ,
              recurrence.ordinalExpression
                ? cloneNode(recurrence.ordinalExpression)
                : new IntLiteralNode(BigInt(recurrence.ordinal)),
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
        if (selectedCondition) {
          const active = new BinaryOpNode(
            cloneNode(matches), BinaryOperator.AND, selectedCondition,
          );
          active.location = selectedCondition.location ?? access.location;
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
      if (expression instanceof TupleIndexOpNode && expression.tuple instanceof IdentifierNode) {
        const plan = active.get(expression.tuple.name);
        if (plan) {
          const index = new IntLiteralNode(BigInt(expression.index));
          index.location = expression.location;
          const access = new ArrayAccessNode(cloneNode(expression.tuple), index);
          access.location = expression.location;
          access.type = expression.type;
          const replacement = symbolicRead(access, plan);
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
      const originalKeys = statement instanceof ArrayAssignNode || statement instanceof ArrayDeleteNode
        ? [cloneNode(statement.index) as ExpressionNode]
        : statement instanceof MappingAssignNode || statement instanceof MappingFieldAssignNode
          || statement instanceof MappingDeleteNode
          ? statement.keys.map((key) => cloneNode(key) as ExpressionNode) : undefined;
      const prefixCountUses = new Map<string, { witnessParam: string; condition: ExpressionNode }>();
      for (const key of originalKeys ?? []) walk(key, (candidate) => {
        const arrayName = candidate instanceof ArrayAccessNode && candidate.array instanceof IdentifierNode
          ? candidate.array.name
          : candidate instanceof TupleIndexOpNode && candidate.tuple instanceof IdentifierNode
            ? candidate.tuple.name : undefined;
        const trace = arrayName === undefined ? undefined : active.get(arrayName)?.prefixCountTrace;
        if (trace) prefixCountUses.set(trace.witnessParam, trace);
      });
      if (statement instanceof ArrayAssignNode || statement instanceof ArrayDeleteNode) {
        statement.index = replaceArrayReads(statement.index, active, checks);
      } else if (statement instanceof MappingAssignNode || statement instanceof MappingFieldAssignNode
        || statement instanceof MappingDeleteNode) {
        statement.keys = statement.keys.map((key) => replaceArrayReads(key, active, checks));
      }
      if (prefixCountUses.size > 0 && originalKeys) {
        this.constructedArrayPrefixCountOriginalKeys.set(statement, originalKeys);
        this.constructedArrayPrefixCountUses.set(statement, [...prefixCountUses.values()]);
        for (const check of checks) this.constructedArrayPrefixCountChecks.add(check);
      }
      return checks;
    };
    const copyPlans = (source: Map<string, ArrayPlan>): Map<string, ArrayPlan> => new Map(
      [...source].map(([name, plan]) => [name, {
        elementType: plan.elementType,
        defaultValue: cloneNode(plan.defaultValue) as ExpressionNode,
        length: cloneNode(plan.length) as ExpressionNode,
        ...(plan.stablePrefixSource && {
          stablePrefixSource: cloneNode(plan.stablePrefixSource) as ExpressionNode,
        }),
        ...(plan.opaqueSuffixCounter !== undefined && {
          opaqueSuffixCounter: plan.opaqueSuffixCounter,
        }),
        writes: plan.writes.map((write) => ({
          index: cloneNode(write.index) as ExpressionNode,
          value: cloneNode(write.value) as ExpressionNode,
          ...(write.condition && { condition: cloneNode(write.condition) as ExpressionNode }),
          ...(write.recurrence && { recurrence: {
            ...write.recurrence,
            baseLength: cloneNode(write.recurrence.baseLength) as ExpressionNode,
            ...(write.recurrence.pushesPerIterationExpression && {
              pushesPerIterationExpression: cloneNode(
                write.recurrence.pushesPerIterationExpression,
              ) as ExpressionNode,
            }),
            ...(write.recurrence.ordinalExpression && {
              ordinalExpression: cloneNode(write.recurrence.ordinalExpression) as ExpressionNode,
            }),
            ...(write.recurrence.stepExpression && {
              stepExpression: cloneNode(write.recurrence.stepExpression) as ExpressionNode,
            }),
          } }),
        })),
        ...(plan.recurrence && { recurrence: {
          ...plan.recurrence,
          baseLength: cloneNode(plan.recurrence.baseLength) as ExpressionNode,
          ...(plan.recurrence.pushesPerIterationExpression && {
            pushesPerIterationExpression: cloneNode(
              plan.recurrence.pushesPerIterationExpression,
            ) as ExpressionNode,
          }),
          ...(plan.recurrence.stepExpression && {
            stepExpression: cloneNode(plan.recurrence.stepExpression) as ExpressionNode,
          }),
        } }),
        ...(plan.prefixCountTrace && { prefixCountTrace: {
          witnessParam: plan.prefixCountTrace.witnessParam,
          condition: cloneNode(plan.prefixCountTrace.condition) as ExpressionNode,
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
      type ScheduledPush = {
        push: ArrayPushNode;
        value: ExpressionNode;
        ordinal: number;
        ordinalExpression?: ExpressionNode;
        condition?: ExpressionNode;
      };
      type FixedPushSchedule = {
        width: number;
        widthExpression?: ExpressionNode;
        pushes: ScheduledPush[];
        values: Map<string, ExpressionNode>;
        assigned: Set<string>;
      };
      const fixedPushSchedule = (
        candidate: BlockNode,
        arrayName: string,
        values = new Map<string, ExpressionNode>(),
      ): FixedPushSchedule | undefined => {
        let width = 0;
        let widthExpression: ExpressionNode | undefined;
        const pushes: ScheduledPush[] = [];
        const assigned = new Set<string>();
        const expressionFor = (
          schedule: Pick<FixedPushSchedule, 'width' | 'widthExpression'>,
          location: Node,
        ): ExpressionNode => {
          if (schedule.widthExpression) return cloneNode(schedule.widthExpression) as ExpressionNode;
          const literal = new IntLiteralNode(BigInt(schedule.width));
          literal.location = location.location;
          return literal;
        };
        const addExpressions = (
          left: ExpressionNode,
          right: ExpressionNode,
          location: Node,
        ): ExpressionNode => {
          const sum = new BinaryOpNode(left, BinaryOperator.PLUS, right);
          sum.location = location.location;
          return sum;
        };
        const currentWidthExpression = (location: Node): ExpressionNode => expressionFor(
          { width, ...(widthExpression && { widthExpression }) }, location,
        );
        const appendWidth = (
          addition: Pick<FixedPushSchedule, 'width' | 'widthExpression'>,
          location: Node,
        ): void => {
          if (!widthExpression && !addition.widthExpression) {
            width += addition.width;
            return;
          }
          widthExpression = addExpressions(
            currentWidthExpression(location), expressionFor(addition, location), location,
          );
          width = 0;
        };
        const appendArm = (
          arm: FixedPushSchedule,
          condition: ExpressionNode,
          negated = false,
        ): void => {
          const base = currentWidthExpression(condition);
          for (const scheduled of arm.pushes) {
            const localOrdinal = scheduled.ordinalExpression
              ? cloneNode(scheduled.ordinalExpression) as ExpressionNode
              : (() => {
                const literal = new IntLiteralNode(BigInt(scheduled.ordinal));
                literal.location = scheduled.push.location;
                return literal;
              })();
            pushes.push({
              push: scheduled.push,
              value: cloneNode(scheduled.value) as ExpressionNode,
              ordinal: width + scheduled.ordinal,
              ...((widthExpression || scheduled.ordinalExpression) && {
                ordinalExpression: addExpressions(
                  cloneNode(base) as ExpressionNode, localOrdinal, scheduled.push,
                ),
              }),
              condition: branchCondition(condition, scheduled.condition, negated),
            });
          }
        };
        for (const statement of candidate.statements ?? []) {
          if (statement instanceof ArrayPushNode && statement.name === arrayName) {
            pushes.push({
              push: statement,
              value: replaceSnapshots(statement.value, values),
              ordinal: width,
              ...(widthExpression && {
                ordinalExpression: currentWidthExpression(statement),
              }),
            });
            appendWidth({ width: 1 }, statement);
            continue;
          }
          if (statement instanceof VariableDefinitionNode && statement.expression) {
            values.set(statement.name, replaceSnapshots(statement.expression, values));
            assigned.add(statement.name);
            continue;
          }
          if (statement instanceof AssignNode && statement.identifier.name !== arrayName) {
            values.set(
              statement.identifier.name,
              replaceSnapshots(statement.expression, values),
            );
            assigned.add(statement.identifier.name);
            continue;
          }
          if (statement instanceof BranchNode) {
            const branchPredicate = replaceSnapshots(statement.condition, values);
            const ifArm = fixedPushSchedule(statement.ifBlock, arrayName, new Map(values));
            const elseArm = statement.elseBlock
              ? fixedPushSchedule(statement.elseBlock, arrayName, new Map(values))
              : {
                width: 0, pushes: [], values: new Map(values), assigned: new Set<string>(),
              };
            if (!ifArm || !elseArm) return undefined;
            appendArm(ifArm, branchPredicate);
            appendArm(elseArm, branchPredicate, true);
            const equalConstant = !ifArm.widthExpression && !elseArm.widthExpression
              && ifArm.width === elseArm.width;
            if (equalConstant) appendWidth(ifArm, statement);
            else {
              const selected = new TernaryOpNode(
                cloneNode(branchPredicate),
                expressionFor(ifArm, statement), expressionFor(elseArm, statement),
              );
              selected.location = statement.location;
              appendWidth({
                width: 0,
                widthExpression: selected,
              }, statement);
            }
            for (const name of new Set([...ifArm.assigned, ...elseArm.assigned])) {
              const ifValue = ifArm.values.get(name);
              const elseValue = elseArm.values.get(name);
              if (!ifValue || !elseValue) {
                values.delete(name);
                assigned.add(name);
                continue;
              }
              const selected = new TernaryOpNode(
                cloneNode(branchPredicate), cloneNode(ifValue), cloneNode(elseValue),
              );
              selected.location = statement.location;
              selected.type = ifValue.type ?? elseValue.type;
              values.set(name, selected);
              assigned.add(name);
            }
            continue;
          }
          if (statement instanceof SwitchNode) {
            const selectedValue = replaceSnapshots(statement.expression, values);
            const arms = statement.cases.map((switchCase) =>
              fixedPushSchedule(switchCase.body, arrayName, new Map(values)));
            const fallback = statement.defaultCase
              ? fixedPushSchedule(statement.defaultCase, arrayName, new Map(values))
              : {
                width: 0, pushes: [], values: new Map(values), assigned: new Set<string>(),
              };
            if (!fallback || arms.some((arm) => !arm)) return undefined;
            const caseConditions = statement.cases.map((switchCase) => {
              const condition = new BinaryOpNode(
                cloneNode(selectedValue), BinaryOperator.EQ, cloneNode(switchCase.value),
              );
              condition.location = switchCase.location ?? statement.location;
              return condition;
            });
            let anyCase: ExpressionNode | undefined;
            for (const condition of caseConditions) {
              if (!anyCase) anyCase = cloneNode(condition);
              else {
                const combined = new BinaryOpNode(anyCase, BinaryOperator.OR, cloneNode(condition));
                combined.location = statement.location;
                anyCase = combined;
              }
            }
            arms.forEach((arm, index) => appendArm(arm!, caseConditions[index]));
            if (fallback.pushes.length > 0) {
              if (!anyCase) return undefined;
              appendArm(fallback, anyCase, true);
            }
            const equalConstant = !fallback.widthExpression
              && arms.every((arm) => !arm!.widthExpression && arm!.width === fallback.width);
            if (equalConstant) appendWidth(fallback, statement);
            else {
              let selectedWidth = expressionFor(fallback, statement);
              for (let index = arms.length - 1; index >= 0; index -= 1) {
                const selected = new TernaryOpNode(
                  cloneNode(caseConditions[index]), expressionFor(arms[index]!, statement), selectedWidth,
                );
                selected.location = statement.location;
                selectedWidth = selected;
              }
              appendWidth({
                width: 0,
                widthExpression: selectedWidth,
              }, statement);
            }
            const assignedInArms = new Set([
              ...fallback.assigned, ...arms.flatMap((arm) => [...arm!.assigned]),
            ]);
            for (const name of assignedInArms) {
              const fallbackValue = fallback.values.get(name);
              if (!fallbackValue || arms.some((arm) => !arm!.values.has(name))) {
                values.delete(name);
                assigned.add(name);
                continue;
              }
              let mergedValue: ExpressionNode = cloneNode(fallbackValue) as ExpressionNode;
              for (let index = arms.length - 1; index >= 0; index -= 1) {
                const selected: ExpressionNode = new TernaryOpNode(
                  cloneNode(caseConditions[index]), cloneNode(arms[index]!.values.get(name)!), mergedValue,
                );
                selected.location = statement.location;
                selected.type = arms[index]!.values.get(name)!.type ?? mergedValue.type;
                mergedValue = selected;
              }
              values.set(name, mergedValue);
              assigned.add(name);
            }
            continue;
          }
          if (mutatedArrays(statement).has(arrayName)) return undefined;
        }
        return {
          width, ...(widthExpression && { widthExpression }), pushes, values, assigned,
        };
      };
      const fixedPopSchedule = (
        candidate: BlockNode,
        arrayName: string,
      ): { width: number; widthExpression?: ExpressionNode; sites: number } | undefined => {
        let width = 0;
        let widthExpression: ExpressionNode | undefined;
        let sites = 0;
        const expressionFor = (
          schedule: { width: number; widthExpression?: ExpressionNode },
          location: Node,
        ): ExpressionNode => {
          if (schedule.widthExpression) return cloneNode(schedule.widthExpression) as ExpressionNode;
          const literal = new IntLiteralNode(BigInt(schedule.width));
          literal.location = location.location;
          return literal;
        };
        const appendWidth = (addition: number | ExpressionNode, location: Node): void => {
          if (typeof addition === 'number' && !widthExpression) {
            width += addition;
            return;
          }
          const left = widthExpression ?? (() => {
            const literal = new IntLiteralNode(BigInt(width));
            literal.location = location.location;
            return literal;
          })();
          const right = typeof addition === 'number' ? (() => {
            const literal = new IntLiteralNode(BigInt(addition));
            literal.location = location.location;
            return literal;
          })() : addition;
          const sum = new BinaryOpNode(left, BinaryOperator.PLUS, right);
          sum.location = location.location;
          width = 0;
          widthExpression = sum;
        };
        for (const statement of candidate.statements ?? []) {
          if (statement instanceof ArrayPopNode && statement.name === arrayName) {
            appendWidth(1, statement);
            sites += 1;
            continue;
          }
          if (statement instanceof BranchNode) {
            const ifArm = fixedPopSchedule(statement.ifBlock, arrayName);
            const elseArm = statement.elseBlock
              ? fixedPopSchedule(statement.elseBlock, arrayName) : { width: 0, sites: 0 };
            if (!ifArm || !elseArm) return undefined;
            if (!ifArm.widthExpression && !elseArm.widthExpression && ifArm.width === elseArm.width) {
              appendWidth(ifArm.width, statement);
            } else {
              const selected = new TernaryOpNode(
                cloneNode(statement.condition),
                expressionFor(ifArm, statement),
                expressionFor(elseArm, statement),
              );
              selected.location = statement.location;
              appendWidth(selected, statement);
            }
            sites += ifArm.sites + elseArm.sites;
            continue;
          }
          if (statement instanceof SwitchNode) {
            const arms = statement.cases.map((switchCase) =>
              fixedPopSchedule(switchCase.body, arrayName));
            const fallback = statement.defaultCase
              ? fixedPopSchedule(statement.defaultCase, arrayName) : { width: 0, sites: 0 };
            if (!fallback || arms.some((arm) => !arm)) return undefined;
            const allConstantEqual = !fallback.widthExpression
              && arms.every((arm) => !arm!.widthExpression && arm!.width === fallback.width);
            if (allConstantEqual) appendWidth(fallback.width, statement);
            else {
              let selectedWidth = expressionFor(fallback, statement);
              for (let index = statement.cases.length - 1; index >= 0; index -= 1) {
                const condition = new BinaryOpNode(
                  cloneNode(statement.expression), BinaryOperator.EQ,
                  cloneNode(statement.cases[index].value),
                );
                condition.location = statement.cases[index].location ?? statement.location;
                const selected = new TernaryOpNode(
                  condition, expressionFor(arms[index]!, statement), selectedWidth,
                );
                selected.location = statement.location;
                selectedWidth = selected;
              }
              appendWidth(selectedWidth, statement);
            }
            sites += fallback.sites + arms.reduce((sum, arm) => sum + arm!.sites, 0);
            continue;
          }
          if (mutatedArrays(statement).has(arrayName)) return undefined;
        }
        return { width, ...(widthExpression && { widthExpression }), sites };
      };
      /**
       * Prove that every path through one finite source block restores an array to its entry length without ever
       * popping an element which existed at block entry. Such a schedule may freely expose newly-pushed values to
       * statements between its resize sites, but it leaves no cross-iteration memory recurrence: the ordinary
       * source-order transform below can therefore replay it independently for every logical counter value.
       */
      const balancedResizeSchedule = (
        candidate: BlockNode,
        arrayName: string,
      ): { delta: number; minimum: number; sites: number } | undefined => {
        let delta = 0;
        let minimum = 0;
        let sites = 0;
        const append = (summary: { delta: number; minimum: number; sites: number }): void => {
          minimum = Math.min(minimum, delta + summary.minimum);
          delta += summary.delta;
          sites += summary.sites;
        };
        for (const statement of candidate.statements ?? []) {
          if (statement instanceof ArrayPushNode && statement.name === arrayName) {
            append({ delta: 1, minimum: 0, sites: 1 });
            continue;
          }
          if (statement instanceof ArrayPopNode && statement.name === arrayName) {
            append({ delta: -1, minimum: -1, sites: 1 });
            continue;
          }
          if ((statement instanceof ArrayAssignNode || statement instanceof ArrayDeleteNode)
            && statement.name === arrayName) return undefined;
          if (statement instanceof AssignNode && statement.identifier.name === arrayName) return undefined;
          if (statement instanceof BranchNode) {
            const ifArm = balancedResizeSchedule(statement.ifBlock, arrayName);
            const elseArm = statement.elseBlock
              ? balancedResizeSchedule(statement.elseBlock, arrayName)
              : { delta: 0, minimum: 0, sites: 0 };
            if (!ifArm || !elseArm || ifArm.delta !== elseArm.delta) return undefined;
            append({
              delta: ifArm.delta,
              minimum: Math.min(ifArm.minimum, elseArm.minimum),
              sites: ifArm.sites + elseArm.sites,
            });
            continue;
          }
          if (statement instanceof SwitchNode) {
            const arms = statement.cases.map((switchCase) =>
              balancedResizeSchedule(switchCase.body, arrayName));
            const fallback = statement.defaultCase
              ? balancedResizeSchedule(statement.defaultCase, arrayName)
              : { delta: 0, minimum: 0, sites: 0 };
            if (!fallback || arms.some((arm) => !arm)
              || arms.some((arm) => arm!.delta !== fallback.delta)) return undefined;
            append({
              delta: fallback.delta,
              minimum: Math.min(fallback.minimum, ...arms.map((arm) => arm!.minimum)),
              sites: fallback.sites + arms.reduce((sum, arm) => sum + arm!.sites, 0),
            });
            continue;
          }
          if (mutatedArrays(statement).has(arrayName)) return undefined;
        }
        return { delta, minimum, sites };
      };
      /**
       * Recognize a fixed-width tail replacement performed independently on every canonical iteration:
       *
       *     xs.pop(); ...; xs.push(value);
       *
       * All pops must be the leading statements and all later array mutations must be pushes. Requiring the
       * widths to match means the source length is restored at the iteration boundary. More importantly, the
       * complete old suffix is discarded before any intervening statement can observe it, so values pushed by a
       * previous iteration cannot feed this iteration. The ordinary source-order block transform can therefore
       * replay reads from the surviving allocation prefix and the current iteration's replacement values without
       * introducing a cross-iteration array recurrence.
       */
      const replacedTailResizeSchedule = (
        candidate: BlockNode,
        arrayName: string,
        variantNames: ReadonlySet<string>,
      ): boolean => {
        type TailPath = {
          pops: number;
          pushes: number;
          observedBeforePop: boolean;
          observedAfterPop: boolean;
        };
        const MAX_TAIL_PATH_STATES = 256;
        let sawReplacement = false;
        const deduplicate = (paths: TailPath[]): TailPath[] | undefined => {
          if (paths.length > MAX_TAIL_PATH_STATES) return undefined;
          const unique = new Map<string, TailPath>();
          for (const path of paths) {
            unique.set(
              `${path.pops}:${path.pushes}:${path.observedBeforePop ? 1 : 0}:${path.observedAfterPop ? 1 : 0}`,
              path,
            );
          }
          return [...unique.values()];
        };
        const observesArray = (root: Node): boolean => {
          let observed = false;
          walk(root, (value) => {
            if (value instanceof IdentifierNode && value.name === arrayName) observed = true;
          });
          return observed;
        };
        const invariantSelector = (root: Node): boolean => {
          let invariant = true;
          walk(root, (value) => {
            if (value instanceof IdentifierNode && variantNames.has(value.name)) invariant = false;
            if (value instanceof StateAccessNode || value instanceof MappingAccessNode
              || value instanceof ExternalFunctionCallNode || value instanceof FunctionCallNode
              || value instanceof MethodCallNode) invariant = false;
          });
          return invariant;
        };
        const advance = (
          sourceBlock: BlockNode,
          incoming: TailPath[],
        ): TailPath[] | undefined => {
          let paths = incoming;
          for (const statement of sourceBlock.statements ?? []) {
            if (statement instanceof ArrayPopNode && statement.name === arrayName) {
              const next: TailPath[] = [];
              for (const path of paths) {
                // Once replacement values are installed, a later pop could expose one from a prior logical
                // iteration on the next pass. Keep the proof to one discard phase followed by one rebuild phase.
                if (path.pushes > 0 || path.observedBeforePop || path.observedAfterPop) return undefined;
                next.push({ ...path, pops: path.pops + 1, observedAfterPop: false });
              }
              paths = next;
              continue;
            }
            if (statement instanceof ArrayPushNode && statement.name === arrayName) {
              const next: TailPath[] = [];
              for (const path of paths) {
                if (path.pops === 0 || path.pushes >= path.pops) return undefined;
                next.push({ ...path, pushes: path.pushes + 1 });
              }
              paths = next;
              continue;
            }
            if ((statement instanceof ArrayAssignNode || statement instanceof ArrayDeleteNode)
              && statement.name === arrayName) return undefined;
            if (statement instanceof AssignNode && statement.identifier.name === arrayName) return undefined;
            if (statement instanceof BranchNode) {
              if (!invariantSelector(statement.condition)) return undefined;
              const conditioned = paths.map((path) => ({
                ...path,
                observedBeforePop: path.observedBeforePop
                  || (path.pops === 0 && observesArray(statement.condition)),
                observedAfterPop: path.observedAfterPop
                  || (path.pops > 0 && observesArray(statement.condition)),
              }));
              const ifPaths = advance(statement.ifBlock, conditioned);
              const elsePaths = statement.elseBlock
                ? advance(statement.elseBlock, conditioned) : conditioned;
              if (!ifPaths || !elsePaths) return undefined;
              const merged = deduplicate([...ifPaths, ...elsePaths]);
              if (!merged) return undefined;
              paths = merged;
              continue;
            }
            if (statement instanceof SwitchNode) {
              if (!invariantSelector(statement.expression)) return undefined;
              const conditioned = paths.map((path) => ({
                ...path,
                observedBeforePop: path.observedBeforePop
                  || (path.pops === 0 && observesArray(statement.expression)),
                observedAfterPop: path.observedAfterPop
                  || (path.pops > 0 && observesArray(statement.expression)),
              }));
              const arms: TailPath[] = [];
              for (const arm of statement.cases) {
                if (observesArray(arm.value)) return undefined;
                const armPaths = advance(arm.body, conditioned);
                if (!armPaths) return undefined;
                arms.push(...armPaths);
              }
              if (statement.defaultCase) {
                const fallback = advance(statement.defaultCase, conditioned);
                if (!fallback) return undefined;
                arms.push(...fallback);
              } else arms.push(...conditioned);
              const merged = deduplicate(arms);
              if (!merged) return undefined;
              paths = merged;
              continue;
            }
            if (statement instanceof BreakNode || statement instanceof ContinueNode
              || statement instanceof ReturnNode) return undefined;
            if (mutatedArrays(statement).has(arrayName)) return undefined;
            if (observesArray(statement)) {
              paths = paths.map((path) => ({
                ...path,
                observedBeforePop: path.observedBeforePop || path.pops === 0,
                observedAfterPop: path.observedAfterPop || path.pops > 0,
              }));
            }
          }
          return paths;
        };
        const paths = advance(candidate, [{
          pops: 0, pushes: 0, observedBeforePop: false, observedAfterPop: false,
        }]);
        if (!paths) return false;
        for (const path of paths) {
          if (path.pops === 0 && path.pushes === 0) continue;
          sawReplacement = true;
          if (path.observedBeforePop || path.pops !== path.pushes) return false;
        }
        return sawReplacement;
      };
      const replayFiniteArrayHelper = (
        statement: StatementNode,
      ): Set<string> => {
        const replayed = new Set<string>();
        const call = statement instanceof FunctionCallStatementNode
          ? statement.call
          : (statement instanceof VariableDefinitionNode || statement instanceof AssignNode)
            && statement.expression instanceof FunctionCallNode
            ? statement.expression : undefined;
        if (!call) return replayed;
        const targets = (this.functionsByName.get(call.identifier.name) ?? [])
          .filter((candidate) => candidate.parameters.length === call.parameters.length);
        if (targets.length !== 1) return replayed;
        const target = targets[0];
        if (!target.body || !target.modifiers.includes(FunctionModifier.PURE)) return replayed;
        const arrayParameters = target.parameters.map((parameter, index) => ({ parameter, index }))
          .filter(({ parameter, index }) => parameter.type instanceof ArrayType
            && parameter.modifier.includes('memory')
            && call.parameters[index] instanceof IdentifierNode
            && active.has((call.parameters[index] as IdentifierNode).name));
        if (arrayParameters.length === 0) return replayed;
        // Canonicalize formal parameters which receive the same caller array onto one plan. Every mutation then
        // advances their shared history at its exact source point, matching memory-reference alias semantics.
        const arrayNames = new Set(target.parameters
          .filter((candidate) => candidate.type instanceof ArrayType).map((candidate) => candidate.name));
        const planNamesByParameter = new Map<string, string>();
        const planNamesByCaller = new Map<string, string>();
        const callerNamesByPlan = new Map<string, string>();
        const initialPlans = new Map<string, ArrayPlan>();
        for (const { parameter, index } of arrayParameters) {
          const callerArray = call.parameters[index] as IdentifierNode;
          const sourcePlan = active.get(callerArray.name)!;
          if (sourcePlan.recurrence) return new Set();
          const planName = planNamesByCaller.get(callerArray.name) ?? parameter.name;
          planNamesByCaller.set(callerArray.name, planName);
          planNamesByParameter.set(parameter.name, planName);
          callerNamesByPlan.set(planName, callerArray.name);
          if (!initialPlans.has(planName)) initialPlans.set(planName, copyPlans(
            new Map([[planName, sourcePlan]]),
          ).get(planName)!);
        }
        const initialValues = new Map<string, ExpressionNode>();
        target.parameters.forEach((candidate, index) => {
          if (candidate.type instanceof ArrayType) return;
          initialValues.set(candidate.name, replaceSnapshots(call.parameters[index], snapshots));
        });
        const clonePlan = (name: string, plan: ArrayPlan): ArrayPlan => copyPlans(
          new Map([[name, plan]]),
        ).get(name)!;
        const mergePlan = (
          name: string,
          base: ArrayPlan,
          arms: readonly { plan: ArrayPlan; condition?: ExpressionNode }[],
        ): ArrayPlan => {
          const merged = clonePlan(name, base);
          for (const { plan, condition } of arms) {
            for (const write of plan.writes.slice(base.writes.length)) {
              merged.writes.push({
                index: cloneNode(write.index) as ExpressionNode,
                value: cloneNode(write.value) as ExpressionNode,
                ...(condition && { condition: branchCondition(condition, write.condition, false) }),
                ...(!condition && write.condition && {
                  condition: cloneNode(write.condition) as ExpressionNode,
                }),
              });
            }
          }
          let length = cloneNode(arms[arms.length - 1].plan.length) as ExpressionNode;
          for (let index = arms.length - 2; index >= 0; index -= 1) {
            const selected = new TernaryOpNode(
              cloneNode(arms[index].condition!), cloneNode(arms[index].plan.length), length,
            );
            selected.location = arms[index].condition!.location;
            selected.type = arms[index].plan.length.type ?? length.type;
            length = selected;
          }
          merged.length = length;
          return merged;
        };
        const mergeValues = (
          base: ReadonlyMap<string, ExpressionNode>,
          arms: readonly { values: ReadonlyMap<string, ExpressionNode>; condition?: ExpressionNode }[],
        ): Map<string, ExpressionNode> => {
          const merged = new Map<string, ExpressionNode>();
          const names = new Set([
            ...base.keys(),
            ...[...arms[0].values.keys()].filter((name) =>
              arms.every((arm) => arm.values.has(name))),
          ]);
          for (const name of names) {
            const fallback = arms[arms.length - 1].values.get(name) ?? base.get(name);
            if (!fallback) continue;
            let value = cloneNode(fallback) as ExpressionNode;
            for (let index = arms.length - 2; index >= 0; index -= 1) {
              const armValue = arms[index].values.get(name) ?? base.get(name);
              if (!armValue) continue;
              const selected = new TernaryOpNode(
                cloneNode(arms[index].condition!), cloneNode(armValue), value,
              );
              selected.location = arms[index].condition!.location;
              selected.type = armValue.type ?? value.type;
              value = selected;
            }
            merged.set(name, value);
          }
          return merged;
        };
        type HelperSummary = {
          plans: Map<string, ArrayPlan>;
          values: Map<string, ExpressionNode>;
          returnValues?: ExpressionNode[];
          loopControl?: 'break' | 'continue';
          /** Paths which break the immediately enclosing literal-bounded helper loop. */
          breakCondition?: ExpressionNode;
          /** Paths which continue the immediately enclosing literal-bounded helper loop. */
          continueCondition?: ExpressionNode;
        };
        type HelperScope = {
          arrayNames: ReadonlySet<string>;
          planNamesByParameter: ReadonlyMap<string, string>;
        };
        const initialScope: HelperScope = { arrayNames, planNamesByParameter };
        const replayExpression = (
          expression: ExpressionNode,
          values: ReadonlyMap<string, ExpressionNode>,
          helperPlans: ReadonlyMap<string, ArrayPlan>,
          scope: HelperScope,
        ): ExpressionNode | undefined => {
          const planFor = (parameterName: string): ArrayPlan | undefined => {
            const planName = scope.planNamesByParameter.get(parameterName);
            return planName === undefined ? undefined : helperPlans.get(planName);
          };
          const resolve = (candidate: ExpressionNode): ExpressionNode | undefined => {
            // Numeric-literal indexing parses as tuple extraction before type resolution, including for arrays.
            // Normalize that representation into the same symbolic array read used by runtime indices.
            if (candidate instanceof TupleIndexOpNode && candidate.tuple instanceof IdentifierNode
              && scope.arrayNames.has(candidate.tuple.name)) {
              const plan = planFor(candidate.tuple.name);
              if (!plan) return undefined;
              const index = new IntLiteralNode(BigInt(candidate.index));
              index.location = candidate.location;
              const access = new ArrayAccessNode(cloneNode(candidate.tuple), index);
              access.location = candidate.location;
              access.type = candidate.type;
              return symbolicRead(access, plan);
            }
            if (candidate instanceof ArrayAccessNode && candidate.array instanceof IdentifierNode
              && scope.arrayNames.has(candidate.array.name)) {
              const plan = planFor(candidate.array.name);
              if (!plan) return undefined;
              const index = resolve(candidate.index);
              if (!index) return undefined;
              const access = cloneNode(candidate) as ArrayAccessNode;
              access.index = index;
              return symbolicRead(access, plan);
            }
            if (candidate instanceof UnaryOpNode && candidate.operator === UnaryOperator.SIZE
              && candidate.expression instanceof IdentifierNode
              && scope.arrayNames.has(candidate.expression.name)) {
              const plan = planFor(candidate.expression.name);
              return plan ? cloneNode(plan.length) as ExpressionNode : undefined;
            }
            if (candidate instanceof FieldAccessNode && candidate.name === 'length'
              && candidate.expression instanceof IdentifierNode
              && scope.arrayNames.has(candidate.expression.name)) {
              const plan = planFor(candidate.expression.name);
              return plan ? cloneNode(plan.length) as ExpressionNode : undefined;
            }
            if (candidate instanceof IdentifierNode && scope.arrayNames.has(candidate.name)) return undefined;
            const replaced = cloneNode(candidate) as ExpressionNode;
            for (const key of Object.keys(replaced)) {
              if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
                || key === 'resolvedFunction' || key === 'functionReference' || key === 'collection'
                || key === 'stateVariable' || key === 'identifier') continue;
              const value = (replaced as unknown as Record<string, unknown>)[key];
              if (value instanceof ExpressionNode) {
                const child = resolve(value);
                if (!child) return undefined;
                (replaced as unknown as Record<string, unknown>)[key] = child;
              } else if (Array.isArray(value)) {
                const children: unknown[] = [];
                for (const item of value) {
                  if (!(item instanceof ExpressionNode)) { children.push(item); continue; }
                  const child = resolve(item);
                  if (!child) return undefined;
                  children.push(child);
                }
                (replaced as unknown as Record<string, unknown>)[key] = children;
              }
            }
            return replaced;
          };
          return resolve(replaceSnapshots(expression, values));
        };
        // Fixed helper loops are replayed symbolically rather than rewritten in the executable AST. Keep a
        // shared budget across nested helper calls/loops so a source with many small nested bounds cannot turn
        // admission into an exponential compile-time expansion.
        let fixedHelperIterationBudget = 256;
        const summarize = (
          helperBlock: BlockNode,
          source: HelperSummary,
          scope: HelperScope,
          visiting: ReadonlySet<FunctionDefinitionNode>,
        ): HelperSummary | undefined => {
          let helperPlans = copyPlans(source.plans);
          let values = new Map(source.values);
          const replay = (expression: ExpressionNode): ExpressionNode | undefined =>
            replayExpression(expression, values, helperPlans, scope);
          const literalValue = (expression: ExpressionNode): bigint | boolean | undefined => {
            if (expression instanceof IntLiteralNode) return expression.value;
            if (expression instanceof BoolLiteralNode) return expression.value;
            if (expression instanceof CastNode) return literalValue(expression.expression);
            if (expression instanceof UnaryOpNode) {
              const value = literalValue(expression.expression);
              if (expression.operator === UnaryOperator.NOT && typeof value === 'boolean') return !value;
              if (expression.operator === UnaryOperator.NEGATE && typeof value === 'bigint') return -value;
              return undefined;
            }
            if (!(expression instanceof BinaryOpNode)) return undefined;
            const left = literalValue(expression.left);
            const right = literalValue(expression.right);
            if (left === undefined || right === undefined) return undefined;
            if (expression.operator === BinaryOperator.EQ) return left === right;
            if (expression.operator === BinaryOperator.NE) return left !== right;
            if (typeof left === 'boolean' && typeof right === 'boolean') {
              if (expression.operator === BinaryOperator.AND) return left && right;
              if (expression.operator === BinaryOperator.OR) return left || right;
              return undefined;
            }
            if (typeof left !== 'bigint' || typeof right !== 'bigint') return undefined;
            if (expression.operator === BinaryOperator.LT) return left < right;
            if (expression.operator === BinaryOperator.LE) return left <= right;
            if (expression.operator === BinaryOperator.GT) return left > right;
            if (expression.operator === BinaryOperator.GE) return left >= right;
            if (expression.operator === BinaryOperator.PLUS) return left + right;
            if (expression.operator === BinaryOperator.MINUS) return left - right;
            if (expression.operator === BinaryOperator.MUL) return left * right;
            if (expression.operator === BinaryOperator.DIV && right !== 0n) return left / right;
            if (expression.operator === BinaryOperator.MOD && right !== 0n) return left % right;
            return undefined;
          };
          const finishAfterConditionalBreak = (
            candidate: HelperSummary,
            tail: BlockNode,
            location: Node['location'],
          ): {
            summary: HelperSummary;
            breaksAlways: boolean;
            breakCondition?: ExpressionNode;
          } | undefined => {
            if (!candidate.breakCondition) return undefined;
            const breakCondition = cloneNode(candidate.breakCondition) as ExpressionNode;
            const fallthrough = new UnaryOpNode(UnaryOperator.NOT, cloneNode(breakCondition));
            fallthrough.location = location;
            const completed = summarize(
              tail, { ...candidate, breakCondition: undefined }, scope, visiting,
            );
            if (!completed || completed.returnValues) return undefined;
            const pathArms = [
              { ...completed, condition: fallthrough as ExpressionNode },
              { ...candidate, breakCondition: undefined, condition: breakCondition },
            ];
            const mergedPlans = new Map([...candidate.plans].map(([name, plan]) => [
              name,
              mergePlan(name, plan, pathArms.map((arm) => ({
                plan: arm.plans.get(name)!, condition: arm.condition,
              }))),
            ]));
            const summary: HelperSummary = {
              plans: mergedPlans,
              values: mergeValues(candidate.values, pathArms),
            };
            if (completed.loopControl === 'break') return { summary, breaksAlways: true };
            let combinedBreak = breakCondition;
            if (completed.breakCondition) {
              const laterBreak = new BinaryOpNode(
                cloneNode(fallthrough), BinaryOperator.AND,
                cloneNode(completed.breakCondition),
              );
              laterBreak.location = location;
              const combined = new BinaryOpNode(combinedBreak, BinaryOperator.OR, laterBreak);
              combined.location = location;
              combinedBreak = combined;
            }
            return { summary, breaksAlways: false, breakCondition: combinedBreak };
          };
          const finishAfterConditionalContinue = (
            candidate: HelperSummary,
            tail: BlockNode,
            location: Node['location'],
          ): {
            summary: HelperSummary;
            continuesAlways: boolean;
            continueCondition?: ExpressionNode;
          } | undefined => {
            if (!candidate.continueCondition) return undefined;
            const continueCondition = cloneNode(candidate.continueCondition) as ExpressionNode;
            const fallthrough = new UnaryOpNode(UnaryOperator.NOT, cloneNode(continueCondition));
            fallthrough.location = location;
            const completed = summarize(
              tail, { ...candidate, continueCondition: undefined }, scope, visiting,
            );
            if (!completed || completed.returnValues || completed.loopControl === 'break'
              || completed.breakCondition) return undefined;
            const pathArms = [
              { ...completed, condition: fallthrough as ExpressionNode },
              { ...candidate, continueCondition: undefined, condition: continueCondition },
            ];
            const mergedPlans = new Map([...candidate.plans].map(([name, plan]) => [
              name,
              mergePlan(name, plan, pathArms.map((arm) => ({
                plan: arm.plans.get(name)!, condition: arm.condition,
              }))),
            ]));
            const summary: HelperSummary = {
              plans: mergedPlans,
              values: mergeValues(candidate.values, pathArms),
            };
            if (completed.loopControl === 'continue') return { summary, continuesAlways: true };
            let combinedContinue = continueCondition;
            if (completed.continueCondition) {
              const laterContinue = new BinaryOpNode(
                cloneNode(fallthrough), BinaryOperator.AND,
                cloneNode(completed.continueCondition),
              );
              laterContinue.location = location;
              const combined = new BinaryOpNode(
                combinedContinue, BinaryOperator.OR, laterContinue,
              );
              combined.location = location;
              combinedContinue = combined;
            }
            return {
              summary,
              continuesAlways: false,
              continueCondition: combinedContinue,
            };
          };
          const replayNestedCall = (nestedCall: FunctionCallNode): HelperSummary | undefined => {
            const nestedTargets = (this.functionsByName.get(nestedCall.identifier.name) ?? [])
              .filter((candidate) => candidate.parameters.length === nestedCall.parameters.length);
            if (nestedTargets.length !== 1) return undefined;
            const nestedTarget = nestedTargets[0];
            if (!nestedTarget.body || !nestedTarget.modifiers.includes(FunctionModifier.PURE)
              || visiting.has(nestedTarget)) return undefined;
            const nestedArrayNames = new Set(nestedTarget.parameters
              .filter((candidate) => candidate.type instanceof ArrayType)
              .map((candidate) => candidate.name));
            const nestedPlanNames = new Map<string, string>();
            const nestedValues = new Map<string, ExpressionNode>();
            const nestedSourcePlans = copyPlans(helperPlans);
            const propagatedPlanNames = new Set(helperPlans.keys());
            for (let parameterIndex = 0;
              parameterIndex < nestedTarget.parameters.length; parameterIndex += 1) {
              const parameter = nestedTarget.parameters[parameterIndex];
              const argument = nestedCall.parameters[parameterIndex];
              if (parameter.type instanceof ArrayType) {
                if (!(argument instanceof IdentifierNode)) return undefined;
                const callerPlanName = scope.planNamesByParameter.get(argument.name);
                const callerPlan = callerPlanName === undefined
                  ? undefined : helperPlans.get(callerPlanName);
                if (callerPlanName === undefined || !callerPlan) return undefined;
                if (parameter.modifier.includes('memory')) {
                  nestedPlanNames.set(parameter.name, callerPlanName);
                } else {
                  // A value parameter starts with the caller's current contents but owns an isolated history.
                  // Its mutations remain available to reads inside this call without leaking into the caller.
                  const copiedPlanName = `__internal__kernelHelperCopy_${this.serial++}`;
                  nestedPlanNames.set(parameter.name, copiedPlanName);
                  nestedSourcePlans.set(copiedPlanName, clonePlan(copiedPlanName, callerPlan));
                }
                continue;
              }
              const nestedValue = replay(argument);
              if (!nestedValue) return undefined;
              nestedValues.set(parameter.name, nestedValue);
            }
            // Nested formals reuse the caller's canonical plan names. Forwarding the same array more than once
            // therefore preserves reference aliasing and advances one source-ordered mutation history.
            const nestedSummary = summarize(
              nestedTarget.body,
              { plans: nestedSourcePlans, values: nestedValues },
              { arrayNames: nestedArrayNames, planNamesByParameter: nestedPlanNames },
              new Set(visiting).add(nestedTarget),
            );
            if (!nestedSummary) return undefined;
            return {
              ...nestedSummary,
              plans: new Map([...propagatedPlanNames].map((planName) => [
                planName, nestedSummary.plans.get(planName)!,
              ])),
            };
          };
          const body = helperBlock.statements ?? [];
          for (let index = 0; index < body.length; index += 1) {
            const helperStatement = body[index];
            if (helperStatement instanceof VariableDefinitionNode && !helperStatement.expression
              && !(helperStatement.type instanceof ArrayType)) {
              values.set(helperStatement.name, createDefaultValueExpression(
                helperStatement.type, helperStatement.location,
              ));
              continue;
            }
            if (helperStatement instanceof VariableDefinitionNode && helperStatement.expression) {
              if (helperStatement.expression instanceof FunctionCallNode) {
                const nestedSummary = replayNestedCall(helperStatement.expression);
                if (!nestedSummary || nestedSummary.returnValues?.length !== 1) return undefined;
                helperPlans = nestedSummary.plans;
                values.set(helperStatement.name, nestedSummary.returnValues[0]);
                continue;
              }
              const expression = replay(helperStatement.expression);
              if (!expression) return undefined;
              values.set(helperStatement.name, expression);
              continue;
            }
            if (helperStatement instanceof AssignNode
              && scope.arrayNames.has(helperStatement.identifier.name)) return undefined;
            if (helperStatement instanceof AssignNode) {
              if (helperStatement.expression instanceof FunctionCallNode) {
                const nestedSummary = replayNestedCall(helperStatement.expression);
                if (!nestedSummary || nestedSummary.returnValues?.length !== 1) return undefined;
                helperPlans = nestedSummary.plans;
                values.set(helperStatement.identifier.name, nestedSummary.returnValues[0]);
                continue;
              }
              const expression = replay(helperStatement.expression);
              if (!expression) return undefined;
              values.set(helperStatement.identifier.name, expression);
              continue;
            }
            if (helperStatement instanceof ArrayAssignNode && scope.arrayNames.has(helperStatement.name)) {
              const planName = scope.planNamesByParameter.get(helperStatement.name);
              const plan = planName === undefined ? undefined : helperPlans.get(planName);
              if (!plan) return undefined;
              const assignedIndex = replay(helperStatement.index);
              const assignedValue = replay(helperStatement.value);
              if (!assignedIndex || !assignedValue) return undefined;
              plan.writes.push({ index: assignedIndex, value: assignedValue });
              continue;
            }
            if (helperStatement instanceof ArrayDeleteNode && scope.arrayNames.has(helperStatement.name)) {
              const planName = scope.planNamesByParameter.get(helperStatement.name);
              const plan = planName === undefined ? undefined : helperPlans.get(planName);
              if (!plan) return undefined;
              const deletedIndex = replay(helperStatement.index);
              if (!deletedIndex) return undefined;
              plan.writes.push({
                index: deletedIndex,
                value: cloneNode(plan.defaultValue) as ExpressionNode,
              });
              continue;
            }
            if (helperStatement instanceof ArrayPushNode && scope.arrayNames.has(helperStatement.name)) {
              const planName = scope.planNamesByParameter.get(helperStatement.name);
              const plan = planName === undefined ? undefined : helperPlans.get(planName);
              if (!plan) return undefined;
              const pushedValue = replay(helperStatement.value);
              if (!pushedValue) return undefined;
              plan.writes.push({
                index: cloneNode(plan.length) as ExpressionNode,
                value: pushedValue,
              });
              const one = new IntLiteralNode(1n);
              one.location = helperStatement.location;
              one.type = plan.length.type ?? new IntType(true, 256);
              const length = new BinaryOpNode(cloneNode(plan.length), BinaryOperator.PLUS, one);
              length.location = helperStatement.location;
              length.type = plan.length.type;
              plan.length = length;
              continue;
            }
            if (helperStatement instanceof ArrayPopNode && scope.arrayNames.has(helperStatement.name)) {
              const planName = scope.planNamesByParameter.get(helperStatement.name);
              const plan = planName === undefined ? undefined : helperPlans.get(planName);
              if (!plan) return undefined;
              const one = new IntLiteralNode(1n);
              one.location = helperStatement.location;
              one.type = plan.length.type ?? new IntType(true, 256);
              const length = new BinaryOpNode(cloneNode(plan.length), BinaryOperator.MINUS, one);
              length.location = helperStatement.location;
              length.type = plan.length.type;
              plan.length = length;
              continue;
            }
            if (helperStatement instanceof WhileNode || helperStatement instanceof DoWhileNode) {
              const condition = helperStatement.condition;
              const statements = helperStatement.block.statements ?? [];
              const update = statements[statements.length - 1];
              if (!(condition instanceof BinaryOpNode)
                || !(update instanceof AssignNode)
                || !(update.expression instanceof BinaryOpNode)) return undefined;
              const counterName = update.identifier.name;
              const counterOnLeft = condition.left instanceof IdentifierNode
                && condition.left.name === counterName;
              const counterOnRight = condition.right instanceof IdentifierNode
                && condition.right.name === counterName;
              if (counterOnLeft === counterOnRight) return undefined;
              const counterNode = (counterOnLeft ? condition.left : condition.right) as IdentifierNode;
              const boundExpression = counterOnLeft ? condition.right : condition.left;
              const bound = replay(boundExpression);
              const boundValue = bound ? literalValue(bound) : undefined;
              if (typeof boundValue !== 'bigint') return undefined;
              const comparison = counterOnLeft ? condition.operator : ({
                [BinaryOperator.LT]: BinaryOperator.GT,
                [BinaryOperator.LE]: BinaryOperator.GE,
                [BinaryOperator.GT]: BinaryOperator.LT,
                [BinaryOperator.GE]: BinaryOperator.LE,
                [BinaryOperator.NE]: BinaryOperator.NE,
              } as Partial<Record<BinaryOperator, BinaryOperator>>)[condition.operator];
              if (comparison === undefined) return undefined;
              const initial = values.get(counterName);
              const addedOnLeft = update.expression.operator === BinaryOperator.PLUS
                && update.expression.left instanceof IdentifierNode
                && update.expression.left.name === counterName
                ? update.expression.right : undefined;
              const addedOnRight = update.expression.operator === BinaryOperator.PLUS
                && update.expression.right instanceof IdentifierNode
                && update.expression.right.name === counterName
                ? update.expression.left : undefined;
              const subtracted = update.expression.operator === BinaryOperator.MINUS
                && update.expression.left instanceof IdentifierNode
                && update.expression.left.name === counterName
                ? update.expression.right : undefined;
              const magnitudeExpression = addedOnLeft ?? addedOnRight ?? subtracted;
              const magnitude = magnitudeExpression ? replay(magnitudeExpression) : undefined;
              const magnitudeValue = magnitude ? literalValue(magnitude) : undefined;
              if (typeof magnitudeValue !== 'bigint') return undefined;
              const step = subtracted ? -magnitudeValue : magnitudeValue;
              const progressionNames = new Set<string>();
              walk(boundExpression, (candidate) => {
                if (candidate instanceof IdentifierNode) progressionNames.add(candidate.name);
              });
              walk(magnitudeExpression!, (candidate) => {
                if (candidate instanceof IdentifierNode) progressionNames.add(candidate.name);
              });
              let progressionMutated = false;
              walk(helperStatement.block, (candidate) => {
                if (candidate === update) return;
                if ((candidate instanceof AssignNode || candidate instanceof DeleteLocalNode)
                  && progressionNames.has(candidate.identifier.name)) progressionMutated = true;
                if (candidate instanceof TupleAssignmentNode
                  && candidate.elements.some((element) => element.name !== undefined
                    && progressionNames.has(element.name))) progressionMutated = true;
                if (candidate instanceof UnaryOpNode && candidate.expression instanceof IdentifierNode
                  && progressionNames.has(candidate.expression.name)
                  && [UnaryOperator.POSTFIX_INCREMENT, UnaryOperator.PREFIX_INCREMENT,
                    UnaryOperator.POSTFIX_DECREMENT, UnaryOperator.PREFIX_DECREMENT]
                    .includes(candidate.operator)) progressionMutated = true;
              });
              const ascending = comparison === BinaryOperator.LT || comparison === BinaryOperator.LE;
              const descending = comparison === BinaryOperator.GT || comparison === BinaryOperator.GE;
              if (!(initial instanceof IntLiteralNode) || step === undefined || step === 0n
                || progressionMutated
                || (ascending && step < 0n) || (descending && step > 0n)
                || (!ascending && !descending && comparison !== BinaryOperator.NE)) return undefined;
              const loopBody = new BlockNode(statements.slice(0, -1));
              loopBody.location = helperStatement.block.location;
              let loopPlans = copyPlans(helperPlans);
              let loopValues = new Map(values);
              let counter = initial.value;
              let stoppedCondition: ExpressionNode | undefined;
              const conditionalExits: { condition: ExpressionNode; counter: IntLiteralNode }[] = [];
              const continues = (): boolean => {
                if (comparison === BinaryOperator.LT) return counter < boundValue;
                if (comparison === BinaryOperator.LE) return counter <= boundValue;
                if (comparison === BinaryOperator.GT) return counter > boundValue;
                if (comparison === BinaryOperator.GE) return counter >= boundValue;
                return counter !== boundValue;
              };
              let firstPostTestIteration = helperStatement instanceof DoWhileNode;
              while (firstPostTestIteration || continues()) {
                firstPostTestIteration = false;
                fixedHelperIterationBudget -= 1;
                if (fixedHelperIterationBudget < 0) return undefined;
                const counterValue = new IntLiteralNode(counter);
                counterValue.location = counterNode.location;
                counterValue.type = counterNode.type ?? new IntType(true, 256);
                loopValues.set(counterName, counterValue);
                const iteration = summarize(
                  loopBody,
                  { plans: loopPlans, values: loopValues },
                  scope,
                  visiting,
                );
                if (!iteration) return undefined;
                if (iteration.returnValues) return iteration;
                if (stoppedCondition) {
                  const activeCondition = new UnaryOpNode(
                    UnaryOperator.NOT, cloneNode(stoppedCondition),
                  );
                  activeCondition.location = helperStatement.location;
                  const guardedArms = [
                    {
                      plans: iteration.plans,
                      values: iteration.values,
                      condition: activeCondition as ExpressionNode,
                    },
                    {
                      plans: loopPlans,
                      values: loopValues,
                      condition: cloneNode(stoppedCondition) as ExpressionNode,
                    },
                  ];
                  loopPlans = new Map([...loopPlans].map(([name, plan]) => [name, mergePlan(
                    name,
                    plan,
                    guardedArms.map((arm) => ({
                      plan: arm.plans.get(name)!, condition: arm.condition,
                    })),
                  )]));
                  loopValues = mergeValues(loopValues, guardedArms);
                  if (iteration.breakCondition) {
                    const newlyStopped = new BinaryOpNode(
                      cloneNode(activeCondition), BinaryOperator.AND,
                      cloneNode(iteration.breakCondition),
                    );
                    newlyStopped.location = helperStatement.location;
                    conditionalExits.push({ condition: newlyStopped, counter: counterValue });
                    const combined = new BinaryOpNode(
                      stoppedCondition, BinaryOperator.OR, cloneNode(newlyStopped),
                    );
                    combined.location = helperStatement.location;
                    stoppedCondition = combined;
                  }
                } else {
                  loopPlans = iteration.plans;
                  loopValues = iteration.values;
                  if (iteration.breakCondition) {
                    stoppedCondition = cloneNode(iteration.breakCondition) as ExpressionNode;
                    conditionalExits.push({
                      condition: cloneNode(iteration.breakCondition) as ExpressionNode,
                      counter: counterValue,
                    });
                  }
                }
                if (iteration.loopControl === 'break') break;
                counter += step;
              }
              let finalCounter: ExpressionNode = new IntLiteralNode(counter);
              finalCounter.location = counterNode.location;
              finalCounter.type = counterNode.type ?? new IntType(true, 256);
              for (let exitIndex = conditionalExits.length - 1; exitIndex >= 0; exitIndex -= 1) {
                const exit = conditionalExits[exitIndex];
                const selected = new TernaryOpNode(
                  cloneNode(exit.condition), cloneNode(exit.counter), finalCounter,
                );
                selected.location = helperStatement.location;
                selected.type = exit.counter.type ?? finalCounter.type;
                finalCounter = selected;
              }
              loopValues.set(counterName, finalCounter);
              helperPlans = loopPlans;
              values = loopValues;
              continue;
            }
            if (helperStatement instanceof BranchNode) {
              const condition = replay(helperStatement.condition);
              if (!condition) return undefined;
              const base: HelperSummary = { plans: copyPlans(helperPlans), values: new Map(values) };
              const selected = literalValue(condition);
              if (typeof selected === 'boolean') {
                const selectedSummary = selected
                  ? summarize(helperStatement.ifBlock, base, scope, visiting)
                  : helperStatement.elseBlock
                    ? summarize(helperStatement.elseBlock, base, scope, visiting) : base;
                if (!selectedSummary) return undefined;
                if (selectedSummary.loopControl || selectedSummary.returnValues) return selectedSummary;
                if (selectedSummary.breakCondition) {
                  const tail = new BlockNode(body.slice(index + 1));
                  tail.location = helperBlock.location;
                  const completed = finishAfterConditionalBreak(
                    selectedSummary, tail, helperStatement.location,
                  );
                  if (!completed) return undefined;
                  return completed.breaksAlways
                    ? { ...completed.summary, loopControl: 'break' }
                    : { ...completed.summary, breakCondition: completed.breakCondition };
                }
                if (selectedSummary.continueCondition) {
                  const tail = new BlockNode(body.slice(index + 1));
                  tail.location = helperBlock.location;
                  const completed = finishAfterConditionalContinue(
                    selectedSummary, tail, helperStatement.location,
                  );
                  if (!completed) return undefined;
                  return completed.continuesAlways
                    ? { ...completed.summary, loopControl: 'continue' }
                    : { ...completed.summary, continueCondition: completed.continueCondition };
                }
                helperPlans = selectedSummary.plans;
                values = selectedSummary.values;
                continue;
              }
              const ifSummary = summarize(helperStatement.ifBlock, base, scope, visiting);
              const elseSummary = helperStatement.elseBlock
                ? summarize(helperStatement.elseBlock, base, scope, visiting) : base;
              if (!ifSummary || !elseSummary) return undefined;
              const otherwise = new UnaryOpNode(UnaryOperator.NOT, cloneNode(condition));
              otherwise.location = condition.location;
              if (ifSummary.returnValues || elseSummary.returnValues) {
                if (ifSummary.loopControl || elseSummary.loopControl
                  || ifSummary.breakCondition || elseSummary.breakCondition
                  || ifSummary.continueCondition || elseSummary.continueCondition) return undefined;
                const tail = new BlockNode(body.slice(index + 1));
                tail.location = helperBlock.location;
                const finishReturn = (candidate: HelperSummary): HelperSummary | undefined =>
                  candidate.returnValues ? candidate : summarize(tail, candidate, scope, visiting);
                const completedIf = finishReturn(ifSummary);
                const completedElse = finishReturn(elseSummary);
                if (!completedIf?.returnValues || !completedElse?.returnValues
                  || completedIf.loopControl || completedElse.loopControl
                  || completedIf.breakCondition || completedElse.breakCondition
                  || completedIf.returnValues.length !== completedElse.returnValues.length) {
                  return undefined;
                }
                const completedArms = [
                  { ...completedIf, condition },
                  { ...completedElse, condition: otherwise as ExpressionNode },
                ];
                const mergedPlans = new Map([...base.plans].map(([name, plan]) => [name, mergePlan(
                  name,
                  plan,
                  completedArms.map((arm) => ({
                    plan: arm.plans.get(name)!, condition: arm.condition,
                  })),
                )]));
                const returnValues = completedIf.returnValues.map((ifValue, returnIndex) => {
                  const selectedReturn = new TernaryOpNode(
                    cloneNode(condition), cloneNode(ifValue),
                    cloneNode(completedElse.returnValues![returnIndex]),
                  );
                  selectedReturn.location = helperStatement.location;
                  selectedReturn.type = ifValue.type ?? completedElse.returnValues![returnIndex].type;
                  return selectedReturn as ExpressionNode;
                });
                return {
                  plans: mergedPlans,
                  values: mergeValues(base.values, completedArms),
                  returnValues,
                };
              }
              if (ifSummary.loopControl === 'break' || elseSummary.loopControl === 'break'
                || ifSummary.breakCondition || elseSummary.breakCondition) {
                if (ifSummary.loopControl === 'continue' || elseSummary.loopControl === 'continue') {
                  return undefined;
                }
                if (ifSummary.continueCondition || elseSummary.continueCondition) return undefined;
                const tail = new BlockNode(body.slice(index + 1));
                tail.location = helperBlock.location;
                const finishPath = (candidate: HelperSummary): {
                  summary: HelperSummary;
                  breaksAlways: boolean;
                  breakCondition?: ExpressionNode;
                } | undefined => {
                  if (candidate.loopControl === 'break') {
                    return { summary: { ...candidate, loopControl: undefined }, breaksAlways: true };
                  }
                  if (candidate.breakCondition) {
                    return finishAfterConditionalBreak(candidate, tail, helperStatement.location);
                  }
                  const completed = summarize(tail, candidate, scope, visiting);
                  if (!completed || completed.returnValues) return undefined;
                  return {
                    summary: {
                      ...completed, loopControl: undefined, breakCondition: undefined,
                    },
                    breaksAlways: completed.loopControl === 'break',
                    ...(completed.breakCondition && {
                      breakCondition: cloneNode(completed.breakCondition) as ExpressionNode,
                    }),
                  };
                };
                const completedIf = finishPath(ifSummary);
                const completedElse = finishPath(elseSummary);
                if (!completedIf || !completedElse) return undefined;
                const completedArms = [
                  { ...completedIf.summary, condition },
                  { ...completedElse.summary, condition: otherwise as ExpressionNode },
                ];
                const mergedPlans = new Map([...base.plans].map(([name, plan]) => [name, mergePlan(
                  name,
                  plan,
                  completedArms.map((arm) => ({
                    plan: arm.plans.get(name)!, condition: arm.condition,
                  })),
                )]));
                if (completedIf.breaksAlways && completedElse.breaksAlways) {
                  return {
                    plans: mergedPlans,
                    values: mergeValues(base.values, completedArms),
                    loopControl: 'break',
                  };
                }
                const conditionalBreak = (
                  path: typeof completedIf,
                  pathCondition: ExpressionNode,
                ): ExpressionNode | undefined => {
                  if (path.breaksAlways) return cloneNode(pathCondition) as ExpressionNode;
                  if (!path.breakCondition) return undefined;
                  const selectedBreak = new BinaryOpNode(
                    cloneNode(pathCondition), BinaryOperator.AND,
                    cloneNode(path.breakCondition),
                  );
                  selectedBreak.location = helperStatement.location;
                  return selectedBreak;
                };
                const ifBreak = conditionalBreak(completedIf, condition);
                const elseBreak = conditionalBreak(completedElse, otherwise);
                if (!ifBreak && !elseBreak) return undefined;
                let breakCondition = ifBreak ?? elseBreak!;
                if (ifBreak && elseBreak) {
                  const combined = new BinaryOpNode(ifBreak, BinaryOperator.OR, elseBreak);
                  combined.location = helperStatement.location;
                  breakCondition = combined;
                }
                return {
                  plans: mergedPlans,
                  values: mergeValues(base.values, completedArms),
                  breakCondition,
                };
              }
              if (ifSummary.loopControl === 'continue' || elseSummary.loopControl === 'continue'
                || ifSummary.continueCondition || elseSummary.continueCondition) {
                // A runtime-selected continue has a finite join at the next fixed iteration. Replay the
                // remainder only for arms which fall through, then merge both completed iteration histories.
                // A selected break/return changes the future iteration domain and remains fenced separately.
                const tail = new BlockNode(body.slice(index + 1));
                tail.location = helperBlock.location;
                const finishIteration = (candidate: HelperSummary): {
                  summary: HelperSummary;
                  continuesAlways: boolean;
                  continueCondition?: ExpressionNode;
                } | undefined => {
                  if (candidate.loopControl === 'continue') {
                    return {
                      summary: { ...candidate, loopControl: undefined }, continuesAlways: true,
                    };
                  }
                  if (candidate.continueCondition) {
                    return finishAfterConditionalContinue(candidate, tail, helperStatement.location);
                  }
                  const completed = summarize(tail, candidate, scope, visiting);
                  if (!completed || completed.returnValues || completed.loopControl === 'break'
                    || completed.breakCondition) return undefined;
                  return {
                    summary: {
                      ...completed, loopControl: undefined, continueCondition: undefined,
                    },
                    continuesAlways: completed.loopControl === 'continue',
                    ...(completed.continueCondition && {
                      continueCondition: cloneNode(completed.continueCondition) as ExpressionNode,
                    }),
                  };
                };
                const completedIf = finishIteration(ifSummary);
                const completedElse = finishIteration(elseSummary);
                if (!completedIf || !completedElse) return undefined;
                const completedArms = [
                  { ...completedIf.summary, condition },
                  { ...completedElse.summary, condition: otherwise as ExpressionNode },
                ];
                const mergedPlans = new Map([...base.plans].map(([name, plan]) => [name, mergePlan(
                  name,
                  plan,
                  completedArms.map((arm) => ({
                    plan: arm.plans.get(name)!, condition: arm.condition,
                  })),
                )]));
                const conditionalContinue = (
                  path: typeof completedIf,
                  pathCondition: ExpressionNode,
                ): ExpressionNode | undefined => {
                  if (path.continuesAlways) return cloneNode(pathCondition) as ExpressionNode;
                  if (!path.continueCondition) return undefined;
                  const selectedContinue = new BinaryOpNode(
                    cloneNode(pathCondition), BinaryOperator.AND,
                    cloneNode(path.continueCondition),
                  );
                  selectedContinue.location = helperStatement.location;
                  return selectedContinue;
                };
                if (completedIf.continuesAlways && completedElse.continuesAlways) {
                  return {
                    plans: mergedPlans,
                    values: mergeValues(base.values, completedArms),
                    loopControl: 'continue',
                  };
                }
                const ifContinue = conditionalContinue(completedIf, condition);
                const elseContinue = conditionalContinue(completedElse, otherwise);
                if (!ifContinue && !elseContinue) return undefined;
                let continueCondition = ifContinue ?? elseContinue!;
                if (ifContinue && elseContinue) {
                  const combined = new BinaryOpNode(
                    ifContinue, BinaryOperator.OR, elseContinue,
                  );
                  combined.location = helperStatement.location;
                  continueCondition = combined;
                }
                return {
                  plans: mergedPlans,
                  values: mergeValues(base.values, completedArms),
                  continueCondition,
                };
              }
              if (ifSummary.loopControl || elseSummary.loopControl
                || ifSummary.breakCondition || elseSummary.breakCondition
                || ifSummary.continueCondition || elseSummary.continueCondition) return undefined;
              const arms = [
                { ...ifSummary, condition },
                { ...elseSummary, condition: otherwise as ExpressionNode },
              ];
              helperPlans = new Map([...base.plans].map(([name, plan]) => [name, mergePlan(
                name,
                plan,
                arms.map((arm) => ({ plan: arm.plans.get(name)!, condition: arm.condition })),
              )]));
              values = mergeValues(base.values, arms);
              continue;
            }
            if (helperStatement instanceof SwitchNode) {
              const selectedValue = replay(helperStatement.expression);
              if (!selectedValue) return undefined;
              const base: HelperSummary = { plans: copyPlans(helperPlans), values: new Map(values) };
              const conditions: ExpressionNode[] = [];
              const caseValues: ExpressionNode[] = [];
              for (const candidate of helperStatement.cases) {
                const caseValue = replay(candidate.value);
                if (!caseValue) return undefined;
                caseValues.push(caseValue);
                const condition = new BinaryOpNode(
                  cloneNode(selectedValue), BinaryOperator.EQ, caseValue,
                );
                condition.location = candidate.location ?? helperStatement.location;
                conditions.push(condition);
              }
              let anyCase: ExpressionNode | undefined;
              for (const condition of conditions) {
                const combined = anyCase
                  ? new BinaryOpNode(anyCase, BinaryOperator.OR, cloneNode(condition)) : condition;
                combined.location = helperStatement.location;
                anyCase = combined;
              }
              const selectedLiteral = literalValue(selectedValue);
              if (selectedLiteral !== undefined) {
                const selectedIndex = caseValues.findIndex((candidate) =>
                  literalValue(candidate) === selectedLiteral);
                const selectedBody = selectedIndex >= 0
                  ? helperStatement.cases[selectedIndex]?.body : helperStatement.defaultCase;
                const selectedSummary = selectedBody
                  ? summarize(selectedBody, base, scope, visiting) : base;
                if (!selectedSummary) return undefined;
                if (selectedSummary.loopControl === 'continue'
                  || selectedSummary.returnValues) return selectedSummary;
                // A break (including a conditional break nested beneath a branch) is local to the
                // selected switch case. A continue still targets the enclosing helper loop.
                helperPlans = selectedSummary.plans;
                values = selectedSummary.values;
                if (selectedSummary.continueCondition) {
                  const tail = new BlockNode(body.slice(index + 1));
                  tail.location = helperBlock.location;
                  const completed = finishAfterConditionalContinue(
                    {
                      plans: helperPlans,
                      values,
                      continueCondition: selectedSummary.continueCondition,
                    },
                    tail,
                    helperStatement.location,
                  );
                  if (!completed) return undefined;
                  return completed.continuesAlways
                    ? { ...completed.summary, loopControl: 'continue' }
                    : { ...completed.summary, continueCondition: completed.continueCondition };
                }
                continue;
              }
              const fallbackCondition = new UnaryOpNode(UnaryOperator.NOT, anyCase!);
              fallbackCondition.location = helperStatement.location;
              const summaries = helperStatement.cases.map((candidate) =>
                summarize(candidate.body, base, scope, visiting));
              const fallback = helperStatement.defaultCase
                ? summarize(helperStatement.defaultCase, base, scope, visiting) : base;
              if (!fallback || fallback.returnValues
                || summaries.some((candidate) => !candidate || candidate.returnValues)) return undefined;
              if (fallback.loopControl === 'continue' || fallback.continueCondition
                || summaries.some((candidate) => candidate!.loopControl === 'continue'
                  || candidate!.continueCondition)) {
                const tail = new BlockNode(body.slice(index + 1));
                tail.location = helperBlock.location;
                const finishIteration = (candidate: HelperSummary): {
                  summary: HelperSummary;
                  continuesAlways: boolean;
                  continueCondition?: ExpressionNode;
                } | undefined => {
                  if (candidate.loopControl === 'continue') {
                    return {
                      summary: {
                        ...candidate,
                        loopControl: undefined,
                        breakCondition: undefined,
                      },
                      continuesAlways: true,
                    };
                  }
                  if (candidate.continueCondition) {
                    return finishAfterConditionalContinue(
                      { ...candidate, loopControl: undefined, breakCondition: undefined },
                      tail,
                      helperStatement.location,
                    );
                  }
                  // A case-level break exits this switch and therefore reaches the enclosing block tail.
                  const completed = summarize(
                    tail, {
                      ...candidate,
                      loopControl: undefined,
                      breakCondition: undefined,
                    }, scope, visiting,
                  );
                  if (!completed || completed.returnValues || completed.loopControl === 'break'
                    || completed.breakCondition) return undefined;
                  return {
                    summary: {
                      ...completed,
                      loopControl: undefined,
                      continueCondition: undefined,
                    },
                    continuesAlways: completed.loopControl === 'continue',
                    ...(completed.continueCondition && {
                      continueCondition: cloneNode(completed.continueCondition) as ExpressionNode,
                    }),
                  };
                };
                const completedSummaries = summaries.map((candidate) => finishIteration(candidate!));
                const completedFallback = finishIteration(fallback);
                if (!completedFallback || completedSummaries.some((candidate) => !candidate)) {
                  return undefined;
                }
                const completedArms = [
                  ...completedSummaries.map((completed, armIndex) => ({
                    ...completed!.summary, condition: conditions[armIndex] as ExpressionNode,
                  })),
                  { ...completedFallback.summary, condition: fallbackCondition as ExpressionNode },
                ];
                const mergedPlans = new Map([...base.plans].map(([name, plan]) => [name, mergePlan(
                  name,
                  plan,
                  completedArms.map((arm) => ({
                    plan: arm.plans.get(name)!, condition: arm.condition,
                  })),
                )]));
                if (completedFallback.continuesAlways
                  && completedSummaries.every((candidate) => candidate!.continuesAlways)) {
                  return {
                    plans: mergedPlans,
                    values: mergeValues(base.values, completedArms),
                    loopControl: 'continue',
                  };
                }
                const selectedContinue = (
                  completed: NonNullable<typeof completedFallback>,
                  armCondition: ExpressionNode,
                ): ExpressionNode | undefined => {
                  if (completed.continuesAlways) return cloneNode(armCondition) as ExpressionNode;
                  if (!completed.continueCondition) return undefined;
                  const condition = new BinaryOpNode(
                    cloneNode(armCondition), BinaryOperator.AND,
                    cloneNode(completed.continueCondition),
                  );
                  condition.location = helperStatement.location;
                  return condition;
                };
                const continueConditions = [
                  ...completedSummaries.map((completed, armIndex) => selectedContinue(
                    completed!, conditions[armIndex],
                  )),
                  selectedContinue(completedFallback, fallbackCondition),
                ].filter((candidate): candidate is ExpressionNode => candidate !== undefined);
                if (continueConditions.length === 0) return undefined;
                let continueCondition = continueConditions[0];
                for (let conditionIndex = 1;
                  conditionIndex < continueConditions.length; conditionIndex += 1) {
                  const combined = new BinaryOpNode(
                    continueCondition,
                    BinaryOperator.OR,
                    continueConditions[conditionIndex],
                  );
                  combined.location = helperStatement.location;
                  continueCondition = combined;
                }
                return {
                  plans: mergedPlans,
                  values: mergeValues(base.values, completedArms),
                  continueCondition,
                };
              }
              const normalizedSummaries = summaries.map((candidate) => ({
                ...candidate!, loopControl: undefined, breakCondition: undefined,
              }));
              const normalizedFallback = {
                ...fallback, loopControl: undefined, breakCondition: undefined,
              };
              const arms = [
                ...normalizedSummaries.map((summary, armIndex) => ({
                  ...summary!, condition: conditions[armIndex] as ExpressionNode,
                })),
                { ...normalizedFallback, condition: fallbackCondition as ExpressionNode },
              ];
              helperPlans = new Map([...base.plans].map(([name, plan]) => [name, mergePlan(
                name,
                plan,
                arms.map((arm) => ({ plan: arm.plans.get(name)!, condition: arm.condition })),
              )]));
              values = mergeValues(base.values, arms);
              continue;
            }
            if (helperStatement instanceof FunctionCallStatementNode) {
              const nestedSummary = replayNestedCall(helperStatement.call);
              if (!nestedSummary) return undefined;
              helperPlans = nestedSummary.plans;
              continue;
            }
            if (helperStatement instanceof RequireNode) continue;
            if (helperStatement instanceof ContinueNode) {
              return { plans: helperPlans, values, loopControl: 'continue' };
            }
            if (helperStatement instanceof BreakNode) {
              return { plans: helperPlans, values, loopControl: 'break' };
            }
            if (helperStatement instanceof ReturnNode) {
              const returnValues = helperStatement.expressions.map(replay);
              if (returnValues.some((value) => value === undefined)) return undefined;
              return { plans: helperPlans, values, returnValues: returnValues as ExpressionNode[] };
            }
            return undefined;
          }
          return { plans: helperPlans, values };
        };
        const summary = summarize(
          target.body,
          { plans: initialPlans, values: initialValues },
          initialScope,
          new Set([target]),
        );
        if (!summary) return new Set();
        for (const [planName, plan] of summary.plans) {
          const callerName = callerNamesByPlan.get(planName)!;
          active.set(callerName, plan);
          replayed.add(callerName);
        }
        return replayed;
      };
      const transformed: StatementNode[] = [];
      for (const statement of block.statements ?? []) {
        if (statement instanceof WhileNode || statement instanceof DoWhileNode) {
          const loopPlans = copyPlans(active);
          const canonical = canonicalLoops.get(statement);
          if (canonical) for (const [name, plan] of loopPlans) {
            const pushSchedule = fixedPushSchedule(statement.block, name);
            const popSchedule = fixedPopSchedule(statement.block, name);
            const balancedSchedule = balancedResizeSchedule(statement.block, name);
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
            const runtimeStepMutated = canonical.stepExpression !== undefined
              && containsNamedIdentifier(canonical.stepExpression, loopAssignedNames);
            const replacedTailSchedule = !runtimeStepMutated && replacedTailResizeSchedule(
              statement.block,
              name,
              new Set(loopAssignedNames).add(canonical.logical),
            );
            // A fixed number of same-kind resizes has a closed length recurrence. An invariant conditional width is
            // closed too: occurrence * (condition ? A : B). Pushes additionally publish a symbolic ordinal and one
            // conditionally selected value recipe per source site; pops only shorten the already-known prefix. A
            // mixed schedule is also closed when every finite path restores the entry length and never reaches into
            // its pre-existing prefix: only transient values exist, so no prior-iteration recurrence is required.
            const scheduledPushCount = pushSchedule?.pushes.length ?? 0;
            const scheduledPopCount = popSchedule?.sites ?? 0;
            const directResizeCount = scheduledPushCount + scheduledPopCount;
            let fixedPushes = !!pushSchedule
              && (pushSchedule.width > 0 || pushSchedule.widthExpression !== undefined)
              && popSchedule === undefined
              && mutationCount === scheduledPushCount && resizeCount === scheduledPushCount;
            let fixedPops = !!popSchedule
              && (popSchedule.width > 0 || popSchedule.widthExpression !== undefined)
              && pushSchedule === undefined
              && mutationCount === scheduledPopCount && resizeCount === scheduledPopCount;
            // Preinstalling every push recipe lets a read between push sites observe all prior iterations while
            // plan.length excludes later pushes from the current iteration. Straight-line and finite exhaustive
            // local assignments have already been substituted into the scheduled value. Any loop-assigned name
            // which remains has no closed counter-only recipe; a self-read would recursively depend on the array
            // being reconstructed, so keep either form fenced.
            const unavailablePushNames = new Set(loopAssignedNames).add(name);
            unavailablePushNames.delete(canonical.logical);
            if (fixedPushes && pushSchedule!.pushes.some(({ value, condition }) =>
              containsNamedIdentifier(value, unavailablePushNames)
              || (condition !== undefined
                && containsNamedIdentifier(condition, unavailablePushNames)))) fixedPushes = false;
            const unavailablePushWidthNames = new Set(loopAssignedNames).add(name).add(canonical.logical);
            if (fixedPushes && pushSchedule!.widthExpression
              && containsNamedIdentifier(
                pushSchedule!.widthExpression, unavailablePushWidthNames,
              )) fixedPushes = false;
            // A variable pop width normally has a closed recurrence only when it is invariant across logical
            // iterations. Literal monotone thresholds retain their compact closed form. A monotone comparison
            // against an immutable public threshold instead uses an authenticated prefix-boundary trace:
            // this avoids subtraction/division around an untrusted runtime boundary while preserving the exact
            // source predicate. Runtime steps and loop-carried thresholds remain fenced.
            const unavailablePopNames = new Set(loopAssignedNames).add(name).add(canonical.logical);
            const conditionalPopShape = (() => {
              if (!fixedPops || !popSchedule!.widthExpression || canonical.stepExpression) return undefined;
              const unwrapZeroSum = (expression: ExpressionNode): ExpressionNode => {
                if (expression instanceof BinaryOpNode && expression.operator === BinaryOperator.PLUS) {
                  if (expression.left instanceof IntLiteralNode && expression.left.value === 0n) {
                    return unwrapZeroSum(expression.right);
                  }
                  if (expression.right instanceof IntLiteralNode && expression.right.value === 0n) {
                    return unwrapZeroSum(expression.left);
                  }
                }
                return expression;
              };
              const selected = unwrapZeroSum(popSchedule!.widthExpression);
              if (!(selected instanceof TernaryOpNode)
                || !(selected.ifTrue instanceof IntLiteralNode) || selected.ifTrue.value !== 1n
                || !(selected.ifFalse instanceof IntLiteralNode) || selected.ifFalse.value !== 0n
                || !(selected.condition instanceof BinaryOpNode)) return undefined;
              const condition = selected.condition;
              const direct = condition.left instanceof IdentifierNode
                && condition.left.name === canonical.logical;
              const reversed = condition.right instanceof IdentifierNode
                && condition.right.name === canonical.logical;
              if (!direct && !reversed) return undefined;
              const thresholdExpression = direct ? condition.right : condition.left;
              const operator = direct ? condition.operator : (() => {
                if (condition.operator === BinaryOperator.GT) return BinaryOperator.LT;
                if (condition.operator === BinaryOperator.GE) return BinaryOperator.LE;
                if (condition.operator === BinaryOperator.LT) return BinaryOperator.GT;
                if (condition.operator === BinaryOperator.LE) return BinaryOperator.GE;
                return condition.operator;
              })();
              const monotone = canonical.step > 0n
                ? operator === BinaryOperator.GT || operator === BinaryOperator.GE
                : operator === BinaryOperator.LT || operator === BinaryOperator.LE;
              if (!monotone) return undefined;
              if (thresholdExpression instanceof IntLiteralNode) return {
                condition: cloneNode(condition) as ExpressionNode,
                operator,
                threshold: thresholdExpression.value,
              };
              if (thresholdExpression instanceof IdentifierNode
                && node.parameters.some((parameter) => !parameter.name.startsWith('__internal__')
                  && parameter.name === thresholdExpression.name)
                && !allReassignedNames.has(thresholdExpression.name)) return {
                condition: cloneNode(condition) as ExpressionNode,
                operator,
                runtimeThreshold: true as const,
              };
              return undefined;
            })();
            const conditionalPopFirstOccurrence = (() => {
              if (!conditionalPopShape || conditionalPopShape.runtimeThreshold
                || conditionalPopShape.threshold === undefined) return undefined;
              const threshold = conditionalPopShape.threshold;
              const operator = conditionalPopShape.operator;
              if (canonical.step > 0n) {
                if (operator === BinaryOperator.GT) return canonical.start > threshold
                  ? 0n : (threshold - canonical.start) / canonical.step + 1n;
                return canonical.start >= threshold
                  ? 0n : (threshold - canonical.start + canonical.step - 1n) / canonical.step;
              }
              const magnitude = -canonical.step;
              if (operator === BinaryOperator.LT) return canonical.start < threshold
                ? 0n : (canonical.start - threshold) / magnitude + 1n;
              return canonical.start <= threshold
                ? 0n : (canonical.start - threshold + magnitude - 1n) / magnitude;
            })();
            const conditionalPopPrefixTrace = conditionalPopShape?.runtimeThreshold ? (() => {
              const witnessParam = `${VMAP_COUNTER_PREFIX_COUNT_PREFIX}${this.serial++}`;
              const trace = {
                witnessParam,
                condition: replaceSnapshots(conditionalPopShape.condition, snapshots),
              };
              const traces = this.constructedArrayPrefixCountTraces.get(statement) ?? [];
              traces.push(trace);
              this.constructedArrayPrefixCountTraces.set(statement, traces);
              return trace;
            })() : undefined;
            if (fixedPops && popSchedule!.widthExpression
              && containsNamedIdentifier(popSchedule!.widthExpression, unavailablePopNames)
              && conditionalPopFirstOccurrence === undefined
              && !conditionalPopPrefixTrace) fixedPops = false;
            const balancedResizes = !!balancedSchedule && balancedSchedule.sites > 0
              && balancedSchedule.delta === 0 && balancedSchedule.minimum >= 0;
            if (balancedResizes || replacedTailSchedule) continue;
            // Appends never alter the array's pre-existing prefix. Even when their per-iteration width depends on
            // the counter and therefore has no invertible suffix recurrence, a canonical ascending pre-test loop
            // may still read its counter from that prefix when the allocation size is the loop's exclusive bound.
            // Keep this as a structural range proof: arbitrary suffix reads remain opaque and fail closed.
            const exclusiveBound = canonical.boundExpression
              ? cloneNode(canonical.boundExpression) as ExpressionNode
              : (() => {
                const count = new IdentifierNode(canonical.count);
                count.location = statement.location;
                if (canonical.boundOffset === 0n) return count;
                const offset = new IntLiteralNode(canonical.boundOffset < 0n
                  ? -canonical.boundOffset : canonical.boundOffset);
                offset.location = statement.location;
                const adjusted = new BinaryOpNode(
                  count,
                  canonical.boundOffset > 0n ? BinaryOperator.PLUS : BinaryOperator.MINUS,
                  offset,
                );
                adjusted.location = statement.location;
                return adjusted;
              })();
            const appendOnlySchedule = !!pushSchedule && popSchedule === undefined
              && mutationCount === scheduledPushCount && resizeCount === scheduledPushCount;
            const stablePrefix = plan.stablePrefixSource
              ? constantOffsetForm(plan.stablePrefixSource) : undefined;
            const exclusiveLimit = constantOffsetForm(exclusiveBound);
            const stablePrefixContainsDomain = stablePrefix !== undefined && exclusiveLimit !== undefined
              && stablePrefix.base === exclusiveLimit.base
              && stablePrefix.offset >= exclusiveLimit.offset;
            if (!fixedPushes && appendOnlySchedule && stablePrefixContainsDomain
              && canonical.stepExpression === undefined && canonical.step > 0n
              && canonical.start >= 0n && !canonical.postTest) {
              plan.opaqueSuffixCounter = canonical.logical;
              continue;
            }
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
            const resizeWidth = fixedPushes ? pushSchedule!.width : popSchedule!.width;
            const symbolicResizeWidth = fixedPushes
              ? pushSchedule!.widthExpression : popSchedule!.widthExpression;
            const resizeWidthExpression = symbolicResizeWidth
              ? replaceSnapshots(symbolicResizeWidth, snapshots)
              : new IntLiteralNode(BigInt(resizeWidth));
            resizeWidthExpression.location = statement.location;
            const precedingResizes = conditionalPopPrefixTrace
              ? (() => {
                const witness = new IdentifierNode(conditionalPopPrefixTrace.witnessParam);
                witness.location = statement.location;
                witness.type = new ArrayType(new IntType(true, 256));
                const read = new ArrayAccessNode(witness, cloneNode(occurrence));
                read.location = statement.location;
                read.type = new IntType(true, 256);
                return read;
              })()
              : conditionalPopFirstOccurrence !== undefined
                ? (() => {
                  const first = new IntLiteralNode(conditionalPopFirstOccurrence);
                  const afterThreshold = new BinaryOpNode(
                    cloneNode(occurrence), BinaryOperator.GT, cloneNode(first),
                  );
                  afterThreshold.location = statement.location;
                  const prior = new BinaryOpNode(
                    cloneNode(occurrence), BinaryOperator.MINUS, first,
                  );
                  prior.location = statement.location;
                  const selected = new TernaryOpNode(afterThreshold, prior, new IntLiteralNode(0n));
                  selected.location = statement.location;
                  return selected;
                })()
                : !symbolicResizeWidth && resizeWidth === 1
                  ? occurrence
                  : new BinaryOpNode(
                    occurrence, BinaryOperator.MUL, resizeWidthExpression,
                  );
            precedingResizes.location = statement.location;
            const length = new BinaryOpNode(
              cloneNode(plan.length), fixedPushes ? BinaryOperator.PLUS : BinaryOperator.MINUS, precedingResizes,
            );
            length.location = statement.location;
            length.type = plan.length.type;
            if (conditionalPopPrefixTrace) plan.prefixCountTrace = conditionalPopPrefixTrace;
            if (fixedPushes) {
              plan.recurrence = {
                counter: canonical.logical,
                start: canonical.start,
                step: canonical.step,
                ...(canonical.stepExpression && {
                  stepExpression: cloneNode(canonical.stepExpression) as ExpressionNode,
                }),
                baseLength: cloneNode(plan.length) as ExpressionNode,
                pushesPerIteration: pushSchedule!.width,
                ...(pushSchedule!.widthExpression && {
                  pushesPerIterationExpression: replaceSnapshots(
                    pushSchedule!.widthExpression, snapshots,
                  ),
                }),
              };
              pushSchedule!.pushes.forEach(({ push, value, ordinal, ordinalExpression, condition }) => {
                const replayedOrdinal = ordinalExpression
                  ? replaceSnapshots(ordinalExpression, snapshots) : undefined;
                const index = !replayedOrdinal && ordinal === 0
                  ? cloneNode(length) as ExpressionNode
                  : new BinaryOpNode(
                    cloneNode(length), BinaryOperator.PLUS,
                    replayedOrdinal ?? new IntLiteralNode(BigInt(ordinal)),
                  );
                index.location = push.location;
                plan.writes.push({
                  index,
                  value: replaceSnapshots(value, snapshots),
                  recurrence: {
                    ...plan.recurrence!, ordinal,
                    baseLength: cloneNode(plan.recurrence!.baseLength) as ExpressionNode,
                    ...(plan.recurrence!.pushesPerIterationExpression && {
                      pushesPerIterationExpression: cloneNode(
                        plan.recurrence!.pushesPerIterationExpression,
                      ) as ExpressionNode,
                    }),
                    ...(replayedOrdinal && {
                      ordinalExpression: cloneNode(replayedOrdinal) as ExpressionNode,
                    }),
                    ...(plan.recurrence!.stepExpression && {
                      stepExpression: cloneNode(plan.recurrence!.stepExpression) as ExpressionNode,
                    }),
                  },
                  ...(condition && {
                    condition: replaceSnapshots(condition, snapshots),
                  }),
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
          ? replaceArrayReads(replaceSnapshots(statement.value, snapshots), active, []) : undefined;
        const replayedArrayIndex = statement instanceof ArrayAssignNode
          ? replaceArrayReads(replaceSnapshots(statement.index, snapshots), active, []) : undefined;
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
        const replayedHelperArrays = replayFiniteArrayHelper(statement);
        const escaped = escapedPlanNames(statement, active);
        for (const name of replayedHelperArrays) escaped.delete(name);
        if (statement instanceof VariableDefinitionNode && statement.expression instanceof NewArrayNode) {
          const stablePrefixSource = lengthSnapshot?.definition.expression
            ?? replaceSnapshots(statement.expression.size, snapshots);
          active.set(statement.name, {
            elementType: statement.expression.elementType,
            defaultValue: createDefaultValueExpression(
              statement.expression.elementType, statement.location,
            ),
            length: lengthSnapshot?.identifier
              ?? replaceSnapshots(statement.expression.size, snapshots),
            stablePrefixSource: cloneNode(stablePrefixSource) as ExpressionNode,
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
          && replayedArrayValue !== undefined
          && (active.get(statement.name)!.recurrence !== undefined
            || !containsReassignedName(replayedArrayValue))) {
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
          delete plan.stablePrefixSource;
          delete plan.opaqueSuffixCounter;
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
