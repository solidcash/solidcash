import {
  AddressSendExpressionNode, AddressTransferStatementNode, ArrayAccessNode, ArrayAssignNode, ArrayDeleteNode,
  ArrayPopNode, ArrayPushNode,
  AssignNode, BinaryOpNode, BlockNode, BoolLiteralNode, BranchNode, BreakNode, CastNode, CollectionNode, ContinueNode,
  ContractNode,
  DoWhileNode,
  EmitStatementNode, ExpressionNode, ExternalFunctionCallNode, FunctionCallNode, FunctionCallStatementNode,
  FieldAccessNode, FunctionDefinitionNode, IdentifierNode, IntLiteralNode, LiteralNode, MappingAccessNode,
  MappingAssignNode, MappingDeleteNode,
  MappingFieldAssignNode, MethodCallNode, MethodCallStatementNode, NewArrayNode, Node, ParameterNode, RequireNode,
  SourceFileNode,
  ReturnNode,
  StateAccessNode, StateArrayAssignNode, StateArrayDeleteNode, StateArrayPopNode, StateArrayPushNode,
  StateAssignNode, StatementNode, SwitchNode, TernaryOpNode, TokenContainerMethodStatementNode, TransferStatementNode,
  TryCatchNode, UnaryOpNode, VariableDefinitionNode, WhileNode, FunctionModifier,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { createDefaultValueExpression } from '../ast/defaults.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
import {
  ArrayType, IntType, StructType, Type,
} from '@solidcash/utils';
import {
  isFunctionEntryInvariantMappingKey, VMAP_KEY_SNAPSHOT_PREFIX,
} from './CacheMappingEntryInLoop.js';

export const VMAP_COUNTER_PERM_PREFIX = '__internal__vmapCounterPerm_';
export const VMAP_COUNTER_OLD_PREFIX = '__internal__vmapCounterOld_';
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
 * Try/catch and nested-loop effect reachability and token-container transfers still need richer runtime effect
 * records. Direct BCH transfers use a source-ordered trailing stream alongside events. The canonical pre-test domains
 * `for (int i = constantStart; i < publicBound; i = i + positiveConstantStep)` and
 * `for (int i = constantStart; i > publicBound; i = i - positiveConstantStep)`, plus the post-test domain
 * `int i = 0; do { ...; i = i + 1; } while (i < publicBound)` lower. The latter authenticates
 * `max(publicBound, 1)` entries. Multiple unconditional source-order loops may lower together when their
 * runtime keys are disjoint; each loop receives its own authenticated trailing input/output segment.
 * Loop-carried predicates/values, sibling reads of the mutated mapping, and nested loops
 * control still need richer logical-journal or path metadata.
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
      counterType: IntType;
      postTest: boolean;
      counterUpdate?: AssignNode;
      parent: BlockNode;
      pathConditions: Array<{ expression: ExpressionNode; negated: boolean }>;
      pathSupported: boolean;
    };
    const canonicalLoops = new Map<WhileNode | DoWhileNode, CanonicalLoop>();
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
          const bound = (loop instanceof WhileNode || loop instanceof DoWhileNode)
            && loop.condition instanceof BinaryOpNode
            ? loop.condition.right : undefined;
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
            || !(loop.condition.left instanceof IdentifierNode) || loop.condition.left.name !== variable.name
            || boundResolution === undefined) continue;
          const update = loop.block.statements?.at(-1);
          const updateStep = update instanceof AssignNode && update.identifier.name === variable.name
            && update.expression instanceof BinaryOpNode
            && (update.expression.operator === BinaryOperator.PLUS
              || update.expression.operator === BinaryOperator.MINUS)
            && update.expression.left instanceof IdentifierNode
            && update.expression.left.name === variable.name
            && update.expression.right instanceof IntLiteralNode
            ? (update.expression.operator === BinaryOperator.PLUS
              ? update.expression.right.value : -update.expression.right.value) : undefined;
          const progressionUpdate = updateStep !== undefined && updateStep === variable.loopStepValue;
          const preTest = loop instanceof WhileNode && variable.isLoopVariable === true
            && variable.loopInitialValue !== undefined && variable.loopStepValue !== undefined
            && variable.loopStepValue !== 0n && loop.forLoopUpdateCount === 1 && progressionUpdate
            && ((variable.loopStepValue > 0n && loop.condition.operator === BinaryOperator.LT)
              || (variable.loopStepValue < 0n && loop.condition.operator === BinaryOperator.GT));
          const postTest = loop instanceof DoWhileNode
            && variable.expression instanceof IntLiteralNode
            && updateStep !== undefined && updateStep !== 0n
            && ((updateStep > 0n && loop.condition.operator === BinaryOperator.LT)
              || (updateStep < 0n && loop.condition.operator === BinaryOperator.GT));
          if (!preTest && !postTest) continue;
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
            start: preTest ? variable.loopInitialValue! : (variable.expression as IntLiteralNode).value,
            step: preTest ? variable.loopStepValue! : updateStep!,
            counterType: variable.type instanceof IntType ? variable.type : new IntType(true, 256),
            postTest,
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
      new Set([...canonicalLoops.values()].map((loop) => loop.logical)),
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
      impureInlineResults: ReadonlySet<string>,
    ): boolean => {
      if (x instanceof TryCatchNode) {
        return hasUnjournalledRepeatedEffect(x.expression, runtimeEmits, runtimeTransfers, impureInlineResults)
          || hasUnjournalledRepeatedEffect(x.tryBlock, runtimeEmits, runtimeTransfers, impureInlineResults);
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
        // The runtime event record journals the emit itself, not arbitrary effects used to compute its payload.
        // Evaluate pure arguments in source order, but fail closed if an argument calls an effectful helper (or
        // otherwise contains an observable operation) which would execute once per physical loop iteration.
        return x.args.some((arg) => hasObservableEffect(arg)
          || [...impureInlineResults].some((name) => containsIdentifier(arg, name)));
      }
      if (x instanceof TransferStatementNode) {
        if (!runtimeTransfers.has(x)) return true;
        return hasObservableEffect(x.lockingBytecode) || hasObservableEffect(x.amount)
          || [...impureInlineResults].some((name) =>
            containsIdentifier(x.lockingBytecode, name) || containsIdentifier(x.amount, name));
      }
      if (x instanceof AddressTransferStatementNode || x instanceof AddressSendExpressionNode
        || x instanceof MethodCallNode || x instanceof MethodCallStatementNode) return true;
      if (x instanceof TokenContainerMethodStatementNode) {
        if (!runtimeTransfers.has(x) || x.methodName !== 'transfer') return true;
        return x.args.some((arg) => hasObservableEffect(arg))
          || hasObservableEffect(x.tokenContainerKeyExpression)
          || [...impureInlineResults].some((name) => x.args.some((arg) => containsIdentifier(arg, name))
            || containsIdentifier(x.tokenContainerKeyExpression, name));
      }
      if (x instanceof FunctionCallNode) return hasObservableEffect(x);
      if (x instanceof FunctionCallStatementNode) return hasObservableEffect(x);
      for (const key of Object.keys(x)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
          || key === 'resolvedFunction') continue;
        const value = (x as unknown as Record<string, unknown>)[key];
        if (value instanceof Node
          && hasUnjournalledRepeatedEffect(value, runtimeEmits, runtimeTransfers, impureInlineResults)) return true;
        if (Array.isArray(value)
          && value.some((item) => item instanceof Node
            && hasUnjournalledRepeatedEffect(item, runtimeEmits, runtimeTransfers, impureInlineResults))) return true;
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
        const fields = Object.keys(value)
          .filter((key) => key !== 'location' && key !== 'definition' && key !== 'symbol' && key !== 'type'
            && key !== 'collection' && key !== 'stateVariable')
          .sort()
          .map((key) => `${key}=${valueShape((value as unknown as Record<string, unknown>)[key])}`);
        seen.delete(value);
        return `${value.constructor.name}{${fields.join(';')}}`;
      };
      return nodeShape(root);
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
            } else if (statement instanceof StateArrayAssignNode || statement instanceof StateArrayDeleteNode
              || statement instanceof StateArrayPushNode || statement instanceof StateArrayPopNode) {
              current.delete(statement.name);
            } else if (statement instanceof BranchNode || statement instanceof SwitchNode
              || statement instanceof TryCatchNode || statement instanceof WhileNode
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
        start, step, counterType, postTest, counterUpdate,
        pathConditions, pathSupported,
      } = canonical;
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
      const keyed = writes.filter((write) =>
        this.collections.has(write.name) && counterKeyIndex(write, logical) >= 0);
      const loopCarriedLocalValues = new Map<string, ExpressionNode>();
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
        if (allAssignments !== updates.length) continue;
        const toggles = updates.every(({ statement }) => {
          const expression = statement.expression;
          return expression instanceof UnaryOpNode && expression.operator === UnaryOperator.NOT
            && expression.expression instanceof IdentifierNode && expression.expression.name === name;
        });
        if (!initializer || keyed.length === 0) continue;
        const writePositions = keyed.map((write) => (block.statements ?? [])
          .findIndex((statement) => containsNode(statement, write)));
        if (writePositions.some((index) => index < 0)) continue;
        const rank = step === 1n && start === 0n
          ? new IdentifierNode(logical)
          : new BinaryOpNode(
            new BinaryOpNode(new IdentifierNode(logical), BinaryOperator.MINUS, new IntLiteralNode(start)),
            BinaryOperator.DIV, new IntLiteralNode(step),
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
        // the initializer at rank zero and the final assignment evaluated at i-step thereafter. All uses must share
        // one phase: one serialized expression cannot represent different values on opposite sides of an update.
        if (updates.some(({ statement }) => containsIdentifier(statement.expression, name))) continue;
        const statements = block.statements ?? [];
        const usePositions = statements.flatMap((statement, index) => (
          !updates.some((update) => update.index === index) && containsIdentifier(statement, name) ? [index] : []
        ));
        if (usePositions.length === 0) continue;
        const phases = new Set(usePositions.map((index) =>
          updates.filter((update) => update.index < index).length));
        if (phases.size !== 1) continue;
        const phase = [...phases][0];
        const selectedUpdate = phase === 0 ? updates.at(-1)! : updates[phase - 1];
        if (!runtimePathExpressionSupported(
          initializer, logical, new Set(), stateValues, loopCarriedLocalValues,
        ) || !runtimePathExpressionSupported(
          selectedUpdate.statement.expression, logical, new Set(), stateValues, loopCarriedLocalValues,
        )) continue;
        const expandedInitializer = expandRuntimePathExpression(
          initializer, logical, new Set(), stateValues, loopCarriedLocalValues,
        );
        const expandedUpdate = expandRuntimePathExpression(
          selectedUpdate.statement.expression, logical, new Set(), stateValues, loopCarriedLocalValues,
        );
        if (!expandedInitializer || !expandedUpdate) continue;
        let value: ExpressionNode = expandedUpdate;
        if (phase === 0) {
          const previous = cloneNode(expandedUpdate) as ExpressionNode;
          const replaceCounter = (candidate: Node): Node => {
            if (candidate instanceof IdentifierNode && candidate.name === logical) {
              const prior = new BinaryOpNode(
                new IdentifierNode(logical), BinaryOperator.MINUS, new IntLiteralNode(step),
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
            first, expandedInitializer, replaceCounter(previous) as ExpressionNode,
          );
        }
        value.location = updates[0].statement.location;
        locateGenerated(value);
        loopCarriedLocalValues.set(name, value);
      }
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
          if (condition && !runtimePathExpressionSupported(
            condition, logical, new Set(), stateValues, loopCarriedLocalValues,
          )) conditionalRuntimeEmit = true;
          else {
            const expanded = condition && expandRuntimePathExpression(
              condition, logical, new Set(), stateValues, loopCarriedLocalValues,
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
            active = pathAnd(active, fallthrough(statement));
          }
          return;
        }
        if (x instanceof BranchNode) {
          collectRuntimeEmits(x.ifBlock, pathAnd(condition, x.condition));
          if (x.elseBlock) {
            collectRuntimeEmits(x.elseBlock, pathAnd(condition, pathNot(x.condition)));
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
        if (x instanceof TransferStatementNode
          || (x instanceof TokenContainerMethodStatementNode && x.methodName === 'transfer')) {
          if (condition && !runtimePathExpressionSupported(
            condition, logical, new Set(), stateValues, loopCarriedLocalValues,
          )) conditionalRuntimeTransfer = true;
          else {
            const expanded = condition && expandRuntimePathExpression(
              condition, logical, new Set(), stateValues, loopCarriedLocalValues,
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
            active = pathAnd(active, fallthrough(statement));
          }
          return;
        }
        if (x instanceof BranchNode) {
          collectRuntimeTransfers(x.ifBlock, pathAnd(condition, x.condition));
          if (x.elseBlock) collectRuntimeTransfers(x.elseBlock, pathAnd(condition, pathNot(x.condition)));
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
      const impureInlineResults = new Set<string>();
      const collectImpureInlineResults = (x: Node): void => {
        if (x instanceof VariableDefinitionNode && x.inlinedReturningHelperPure === false) {
          impureInlineResults.add(x.name);
        }
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node) collectImpureInlineResults(value);
          else if (Array.isArray(value)) {
            for (const item of value) if (item instanceof Node) collectImpureInlineResults(item);
          }
        }
      };
      collectImpureInlineResults(block);
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
      const hasUnexpectedLoopControlMutation = (
        x: Node,
        inspectLogical: boolean,
        inspectBound: boolean,
      ): boolean => {
        if (x instanceof AssignNode
          && ((inspectLogical && x.identifier.name === logical && x !== counterUpdate)
            || (inspectBound && boundNames.includes(x.identifier.name) && !boundAssignments.includes(x)))) return true;
        if (x instanceof VariableDefinitionNode
          && ((inspectLogical && x.name === logical)
            || (inspectBound && boundNames.includes(x.name) && !boundDefinitions.includes(x)))) return true;
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
      if (keyed.length === 0 || !selectionConditionSupported
        || keyed.some((write) => hasObservableEffect(write))
        || conditionalRuntimeEmit
        || conditionalRuntimeTransfer
        || hasUnjournalledRepeatedEffect(block, runtimeEmitSet, runtimeTransferSet, impureInlineResults)
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
      // One collection currently owns one physical entry stream per iteration, but different collections need
      // not share their invariant key components. `a[left][i]` and `b[right][i]` therefore receive independently
      // sortable authenticated permutations below. Two distinct tuples in the SAME collection still need a wider
      // per-iteration stream and remain fenced here.
      const keyShapeByCollection = new Map<string, string>();
      for (const write of keyed) {
        const shape = writeKeyShape(write);
        const prior = keyShapeByCollection.get(write.name);
        if (prior !== undefined && prior !== shape) return false;
        keyShapeByCollection.set(write.name, shape);
      }
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
        if (x instanceof MappingAccessNode && keyedCollections.has(x.name)) return true;
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
          if (signature !== allowed) return true;
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
      const hasUnsupportedOldEntryExpression = keyed.some((write) => {
        const expression = write instanceof MappingAssignNode ? write.expression
          : write instanceof ArrayAssignNode ? write.value : undefined;
        if (!expression || !containsCollectionAccess(expression)) return false;
        // A fixed read from another collection (`a[i] = b[0]`) already has its ordinary authenticated entry
        // witness. It does not need the destination's row-local old-value vector; reserve that vector only for
        // expressions that actually read the entry being written.
        const readsWrittenCollection = (candidate: Node): boolean => {
          const access = collectionAccessOf(candidate);
          if (access?.name === write.name) return true;
          for (const key of Object.keys(candidate)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
              || key === 'collection') continue;
            const value = (candidate as unknown as Record<string, unknown>)[key];
            if (value instanceof Node && readsWrittenCollection(value)) return true;
            if (Array.isArray(value) && value.some((item) => item instanceof Node && readsWrittenCollection(item))) {
              return true;
            }
          }
          return false;
        };
        if (!readsWrittenCollection(expression)) return false;
        const left = expression instanceof BinaryOpNode ? collectionAccessOf(expression.left) : undefined;
        const compact = expression instanceof BinaryOpNode
          && (expression.operator === BinaryOperator.PLUS || expression.operator === BinaryOperator.MINUS)
          && !!left && left.name === write.name
          && left.keys.map(expressionShape).join('|') === writeKeyShape(write)
          && !containsCollectionAccess(expression.right);
        if (compact) return false;
        const collection = this.collectionsByName.get(write.name);
        if (!(write instanceof MappingAssignNode || write instanceof ArrayAssignNode)
          || (write instanceof MappingAssignNode && (write.arrayIndex !== undefined
            || write.arrayPush || write.arrayPop)) || !collection
          || !(collection.innermostValueType instanceof IntType)) return true;
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
          if (x !== counterUpdate) loopReassignedLocals.add(x.identifier.name);
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
          && statement.inlinedReturningHelperPure !== false
          && !loopReassignedLocals.has(statement.name)
          && !hasObservableEffect(statement.expression)
          && !containsCollectionAccess(statement.expression)) {
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
        const rank = step === 1n && start === 0n
          ? new IdentifierNode(logical)
          : new BinaryOpNode(
            new BinaryOpNode(new IdentifierNode(logical), BinaryOperator.MINUS, new IntLiteralNode(start)),
            BinaryOperator.DIV, new IntLiteralNode(step),
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
        const snapshot = `__internal__vmapCounterStateBase_${this.serial}_${name}`;
        affineStateSnapshots.set(snapshot, cloneNode(source));
        const rank = step === 1n && start === 0n
          ? new IdentifierNode(logical)
          : new BinaryOpNode(
            new BinaryOpNode(new IdentifierNode(logical), BinaryOperator.MINUS, new IntLiteralNode(start)),
            BinaryOperator.DIV, new IntLiteralNode(step),
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
      if ((!writeSelectionCondition && hasCounterDependentGuard(block))
        || hasSiblingMappingRead(block) || hasUnsafeRead(block)
        || hasUnsupportedOldEntryExpression
        || (!writeSelectionCondition && hasLoopCarriedWriteGuard(block))
        || keyed.some((write) => !structRuntimeRmws.has(write as ArrayAssignNode | MappingAssignNode)
          && dependsOnLoopMutation(write, new Set(), true))) return false;

      if (!apply) return true;

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
      const serial = this.serial++;
      const signedComponent = (value: bigint): string => value < 0n ? `n${-value}` : `p${value}`;
      const rangeSuffix = start === 0n && step === 1n
        ? '' : `_from_${signedComponent(start)}_step_${signedComponent(step)}`;
      const boundSuffix = boundOffset === 0n ? '' : `_bound_${signedComponent(boundOffset)}`;
      const hiddenName = (groupSerial: number): string =>
        `${PREFIX}${count}_${groupSerial}${boundSuffix}${rangeSuffix}${postTest ? '_post' : ''}`;
      const keyedByCollection = new Map<string, typeof keyed>();
      for (const write of keyed) {
        const group = keyedByCollection.get(write.name) ?? [];
        group.push(write);
        keyedByCollection.set(write.name, group);
      }
      const permutationGroups = new Map<string, {
        collections: string[];
        collectionWrites: typeof keyed;
        selectionCondition?: ExpressionNode;
      }>();
      for (const [collection, collectionWrites] of keyedByCollection) {
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
        };
      });
      if (groups.some((group) => group.selectionCondition && !group.expandedSelectionCondition)) return false;
      const groupByCollection = new Map(groups.flatMap((group) =>
        group.collections.map((collection) => [collection, group] as const)));
      const primaryGroup = groups[0];
      for (const group of groups) {
        (node.runtimeCounterLoopCounters ??= new Map()).set(group.hidden, {
          name: logical, initialValue: start, stepValue: step,
        });
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
            counter: { name: logical, initialValue: start, stepValue: step },
          });
        }
      }
      const oldValueHidden = (collection: string): string => {
        const group = groupByCollection.get(collection)!;
        return `${VMAP_COUNTER_OLD_PREFIX}${count}_${group.serial}_${collection}`;
      };
      const rangedIterationCount = `__internal__vmapCounterCount_${serial}`;
      const unitDomain = start === 0n && step === 1n;
      const at = <T extends Node>(value: T): T => { value.location = location; return value; };
      const id = (name: string): IdentifierNode => at(new IdentifierNode(name));
      const lit = (value: bigint): IntLiteralNode => at(new IntLiteralNode(value));
      const binary = (left: ExpressionNode, operator: BinaryOperator, right: ExpressionNode): BinaryOpNode =>
        at(new BinaryOpNode(left, operator, right));
      const proofInt = new IntType(true, 256);
      const asProofInt = (expression: ExpressionNode): ExpressionNode => counterType.signed
        ? expression : at(new CastNode(proofInt, expression, false));
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
      const positiveIterationCount = (): ExpressionNode => binary(
        binary(binary(
          step > 0n
            ? binary(boundValue(), BinaryOperator.MINUS, lit(start))
            : binary(lit(start), BinaryOperator.MINUS, boundValue()),
          BinaryOperator.MINUS, lit(1n)),
        BinaryOperator.DIV, lit(step > 0n ? step : -step)),
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
        return binary(binary(id(logical), BinaryOperator.MINUS, lit(start)), BinaryOperator.DIV, lit(step));
      };
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
      for (const write of keyed) {
        const group = groupByCollection.get(write.name)!;
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
            const values = new IdentifierNode(oldValueHidden(mappingWrite.name)); values.location = location;
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
          write.index = permRead(group);
          write.value = replace(write.value, group) as ExpressionNode;
        } else if (write instanceof ArrayDeleteNode) {
          write.index = permRead(group);
        } else if (write instanceof MappingAssignNode || write instanceof MappingFieldAssignNode) {
          write.keys = write.keys.map((key) => key instanceof IdentifierNode && key.name === logical
            ? permRead(group)
            : containsIdentifier(key, logical)
              ? (hasDirectCounterComponent ? replace(key, group) : replaceKey(key, group)) as ExpressionNode
              : key);
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
          emit.runtimeLoopEventCounter = { name: logical, initialValue: start, stepValue: step };
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
              transfer instanceof TokenContainerMethodStatementNode ? 'token' : 'bch'),
          },
        ];
        runtimeTransfers.forEach(({ transfer, condition }, siteIndex) => {
          transfer.runtimeLoopTransfer = { loopIndex: transferLoopIndex, siteIndex };
          transfer.runtimeLoopTransferCondition = condition;
          transfer.runtimeLoopTransferCounter = { name: logical, initialValue: start, stepValue: step };
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
        + MAX_COUNTER_ITERATIONS * (keyedCollections.size + runtimeEmits.length + runtimeTransfers.length);
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
          binary(binary(logicalProofValue(), BinaryOperator.MINUS, lit(start)), BinaryOperator.DIV, lit(step)),
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
            binary(lit(start), BinaryOperator.PLUS, binary(rank(), BinaryOperator.MUL, lit(step))),
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
      }
      if (generalOldEntryWrites.size > 0) {
        const seen = new Set<string>();
        for (const write of generalOldEntryWrites) {
          if (seen.has(write.name)) continue;
          seen.add(write.name);
          const old = new ParameterNode(
            new ArrayType(this.collectionsByName.get(write.name)!.innermostValueType), oldValueHidden(write.name),
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
   * runtime-key admission. This is type-generic and independent of any contract schema.
   */
  private normalizeImmutableDefaultArrayKeys(
    node: FunctionDefinitionNode,
    canonicalCounters: ReadonlySet<string> = new Set(),
  ): void {
    if (!node.body) return;
    type ArrayWrite = { index: ExpressionNode; value: ExpressionNode; condition?: ExpressionNode };
    type ArrayPlan = { elementType: Type; defaultValue: ExpressionNode; writes: ArrayWrite[] };
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
    const escapedPlanNames = (root: Node, active: Map<string, ArrayPlan>): Set<string> => {
      const escaped = new Set<string>();
      walk(root, (candidate) => {
        if (!(candidate instanceof FunctionCallNode || candidate instanceof ExternalFunctionCallNode
          || candidate instanceof MethodCallNode)) return;
        const parameters = candidate instanceof MethodCallNode
          ? [candidate.object, ...candidate.parameters] : candidate.parameters;
        for (const parameter of parameters) {
          walk(parameter, (part) => {
            if (part instanceof IdentifierNode && active.has(part.name)) escaped.add(part.name);
          });
        }
      });
      return escaped;
    };
    const symbolicRead = (access: ArrayAccessNode, plan: ArrayPlan): ExpressionNode => {
      let value = cloneNode(plan.defaultValue) as ExpressionNode;
      for (const write of plan.writes) {
        let matches: ExpressionNode = new BinaryOpNode(
          cloneNode(access.index), BinaryOperator.EQ, cloneNode(write.index),
        );
        matches.location = access.location;
        if (write.condition) {
          const active = new BinaryOpNode(
            cloneNode(matches), BinaryOperator.AND, cloneNode(write.condition),
          );
          active.location = access.location;
          matches = active;
        }
        const selected = new TernaryOpNode(matches, cloneNode(write.value), value);
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
        writes: plan.writes.map((write) => ({
          index: cloneNode(write.index) as ExpressionNode,
          value: cloneNode(write.value) as ExpressionNode,
          ...(write.condition && { condition: cloneNode(write.condition) as ExpressionNode }),
        })),
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
          for (const candidate of statement.cases) {
            transformBlock(candidate.body, copyPlans(active), new Map(snapshots), false);
          }
          if (statement.defaultCase) {
            transformBlock(statement.defaultCase, copyPlans(active), new Map(snapshots), false);
          }
          transformed.push(statement);
          for (const name of mutatedArrays(statement)) active.delete(name);
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
        const replayedArrayValue = statement instanceof ArrayAssignNode
          ? replaceSnapshots(statement.value, snapshots) : undefined;
        const replayedArrayIndex = statement instanceof ArrayAssignNode
          ? replaceSnapshots(statement.index, snapshots) : undefined;
        const keySnapshot = statement instanceof ArrayAssignNode && active.has(statement.name)
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
        transformed.push(
          ...(assignmentSnapshot ? [assignmentSnapshot] : []),
          ...rewriteMappingKeys(statement, active),
          ...(keySnapshot ? [keySnapshot.definition] : []), statement,
        );
        const escaped = escapedPlanNames(statement, active);
        if (statement instanceof VariableDefinitionNode && statement.expression instanceof NewArrayNode) {
          active.set(statement.name, {
            elementType: statement.expression.elementType,
            defaultValue: createDefaultValueExpression(
              statement.expression.elementType, statement.location,
            ),
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
