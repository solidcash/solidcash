import {
  AddressSendExpressionNode, AddressTransferStatementNode, ArrayAccessNode, ArrayAssignNode, ArrayDeleteNode,
  AssignNode, BinaryOpNode, BlockNode, BoolLiteralNode, BranchNode, BreakNode, CastNode, CollectionNode, ContinueNode,
  ContractNode,
  DoWhileNode,
  EmitStatementNode, ExpressionNode, ExternalFunctionCallNode, FunctionCallNode, FunctionCallStatementNode,
  FieldAccessNode, FunctionDefinitionNode, IdentifierNode, IntLiteralNode, LiteralNode, MappingAccessNode,
  MappingAssignNode, MappingDeleteNode,
  MappingFieldAssignNode, MethodCallNode, MethodCallStatementNode, Node, ParameterNode, RequireNode, SourceFileNode,
  ReturnNode,
  StateAccessNode, StateArrayAssignNode, StateArrayDeleteNode, StateArrayPopNode, StateArrayPushNode,
  StateAssignNode, StatementNode, SwitchNode, TernaryOpNode, TokenContainerMethodStatementNode, TransferStatementNode,
  TryCatchNode, UnaryOpNode, VariableDefinitionNode, WhileNode, FunctionModifier,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
import { ArrayType, IntType } from '@solidcash/utils';

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
 * Try/catch and nested-loop event reachability, BCH transfers, and token-container transfers still need richer runtime
 * effect records. The canonical pre-test domains
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
    // The compiler invokes this pass both before speculative admission and, when needed, before final codegen.
    // Hidden parameters are the durable marker that this function was already lowered. Do not inspect or mutate
    // the generated proof statements on the second pass.
    if (node.parameters.some((parameter) => parameter.name.startsWith(PREFIX))) return node;
    type CanonicalLoop = {
      logical: string;
      count: string;
      boundNames: string[];
      boundDefinitions: VariableDefinitionNode[];
      boundOffset: bigint;
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
          const resolveBound = (
            expression: ExpressionNode,
            before: number,
            seen = new Set<string>(),
          ): { count: string; definitions: VariableDefinitionNode[]; offset: bigint } | undefined => {
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
            if (visibleCounts.has(name)) return { count: name, definitions: [], offset: 0n };
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
              definitions: [...parent.definitions, definitions[0].statement],
              offset: parent.offset,
            };
          };
          const boundResolution = bound instanceof IdentifierNode
            ? resolveBound(bound, index - 1) : undefined;
          if (!(loop instanceof WhileNode || loop instanceof DoWhileNode)
            || !(variable instanceof VariableDefinitionNode)
            || !(loop.condition instanceof BinaryOpNode)
            || !(loop.condition.left instanceof IdentifierNode) || loop.condition.left.name !== variable.name
            || !(bound instanceof IdentifierNode) || boundResolution === undefined) continue;
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
            && variable.expression instanceof IntLiteralNode && variable.expression.value === 0n
            && updateStep === 1n;
          if (!preTest && !postTest) continue;
          canonicalLoops.set(loop, {
            logical: variable.name,
            count: boundResolution.count,
            boundNames: [boundResolution.count, ...boundResolution.definitions.map((definition) => definition.name)],
            boundDefinitions: boundResolution.definitions,
            boundOffset: boundResolution.offset,
            start: preTest ? variable.loopInitialValue! : 0n,
            step: preTest ? variable.loopStepValue! : 1n,
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
        return write.index instanceof IdentifierNode && write.index.name === logical ? 0 : -1;
      }
      return write.keys.findIndex((key) => key instanceof IdentifierNode && key.name === logical);
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
        if (!pureContractCall && !pureBuiltin) return true;
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
      impureInlineResults: ReadonlySet<string>,
    ): boolean => {
      if (x instanceof TryCatchNode) {
        return hasUnjournalledRepeatedEffect(x.expression, runtimeEmits, impureInlineResults)
          || hasUnjournalledRepeatedEffect(x.tryBlock, runtimeEmits, impureInlineResults);
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
      if (x instanceof TransferStatementNode
        || x instanceof AddressTransferStatementNode || x instanceof AddressSendExpressionNode
        || x instanceof TokenContainerMethodStatementNode
        || x instanceof MethodCallNode || x instanceof MethodCallStatementNode) return true;
      if (x instanceof FunctionCallNode) return hasObservableEffect(x);
      if (x instanceof FunctionCallStatementNode) return hasObservableEffect(x);
      for (const key of Object.keys(x)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
          || key === 'resolvedFunction') continue;
        const value = (x as unknown as Record<string, unknown>)[key];
        if (value instanceof Node
          && hasUnjournalledRepeatedEffect(value, runtimeEmits, impureInlineResults)) return true;
        if (Array.isArray(value)
          && value.some((item) => item instanceof Node
            && hasUnjournalledRepeatedEffect(item, runtimeEmits, impureInlineResults))) return true;
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
    const runtimePathExpressionSupported = (
      expression: ExpressionNode,
      counterName?: string,
      resolving = new Set<string>(),
    ): boolean => {
      if (expression instanceof LiteralNode) return true;
      if (expression instanceof StateAccessNode) return !runtimePathMutatedState.has(expression.name);
      if (expression instanceof IdentifierNode) {
        if (expression.name === counterName
          || visibleParameters.some((parameter) => parameter.name === expression.name)) return true;
        if (resolving.has(expression.name)) return false;
        const initializer = runtimePathLocalInitializer(expression.name);
        return initializer !== undefined
          && runtimePathExpressionSupported(initializer, counterName, new Set(resolving).add(expression.name));
      }
      if (expression instanceof CastNode || expression instanceof UnaryOpNode
        || expression instanceof FieldAccessNode) {
        return runtimePathExpressionSupported(expression.expression, counterName, resolving);
      }
      if (expression instanceof BinaryOpNode) {
        return runtimePathExpressionSupported(expression.left, counterName, resolving)
          && runtimePathExpressionSupported(expression.right, counterName, resolving);
      }
      if (expression instanceof TernaryOpNode) {
        return runtimePathExpressionSupported(expression.condition, counterName, resolving)
          && runtimePathExpressionSupported(expression.ifTrue, counterName, resolving)
          && runtimePathExpressionSupported(expression.ifFalse, counterName, resolving);
      }
      if (expression instanceof MappingAccessNode) {
        return !runtimePathMutatedState.has(expression.name)
          && expression.keys.every((key) => runtimePathExpressionSupported(key, counterName, resolving));
      }
      if (expression instanceof ArrayAccessNode) {
        return runtimePathExpressionSupported(expression.array, counterName, resolving)
          && runtimePathExpressionSupported(expression.index, counterName, resolving);
      }
      return false;
    };
    const expandRuntimePathExpression = (
      expression: ExpressionNode,
      counterName?: string,
      resolving = new Set<string>(),
    ): ExpressionNode | undefined => {
      if (expression instanceof IdentifierNode
        && expression.name !== counterName
        && !visibleParameters.some((parameter) => parameter.name === expression.name)) {
        if (resolving.has(expression.name)) return undefined;
        const initializer = runtimePathLocalInitializer(expression.name);
        return initializer && expandRuntimePathExpression(
          cloneNode(initializer), counterName, new Set(resolving).add(expression.name),
        );
      }
      const expanded = cloneNode(expression);
      for (const key of Object.keys(expanded)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
          || key === 'resolvedFunction' || key === 'collection' || key === 'stateVariable') continue;
        const value = (expanded as unknown as Record<string, unknown>)[key];
        if (value instanceof ExpressionNode) {
          const replacement = expandRuntimePathExpression(value, counterName, resolving);
          if (!replacement) return undefined;
          (expanded as unknown as Record<string, unknown>)[key] = replacement;
        } else if (Array.isArray(value)) {
          const replacements = value.map((item) => item instanceof ExpressionNode
            ? expandRuntimePathExpression(item, counterName, resolving) : item);
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
        logical, count, boundNames, boundDefinitions, boundOffset, start, step, counterType, postTest, counterUpdate,
        pathConditions, pathSupported,
      } = canonical;
      const sourcePathCondition = runtimePathCondition(pathConditions);
      if (!pathSupported
        || (sourcePathCondition && !runtimePathExpressionSupported(sourcePathCondition))) return false;
      const pathCondition = sourcePathCondition && expandRuntimePathExpression(sourcePathCondition);
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
          const ifPath = pathAnd(x.condition, fallthrough(x.ifBlock));
          const elsePath = pathAnd(pathNot(x.condition), x.elseBlock
            ? fallthrough(x.elseBlock) : undefined);
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
        if (isWrite(x)) { writes.push(x); writePaths.set(x, condition); return; }
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
          if (condition && !runtimePathExpressionSupported(condition, logical)) conditionalRuntimeEmit = true;
          else runtimeEmits.push({ emit: x, ...(condition && { condition }) });
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
      const keyed = writes.filter((write) =>
        this.collections.has(write.name) && counterKeyIndex(write, logical) >= 0);
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
          || runtimePathExpressionSupported(condition, logical))
        && breakPaths.every((condition) => !condition
          || runtimePathExpressionSupported(condition, logical));
      const hasUnexpectedLoopControlMutation = (
        x: Node,
        inspectLogical: boolean,
        inspectBound: boolean,
      ): boolean => {
        if (x instanceof AssignNode
          && ((inspectLogical && x.identifier.name === logical && x !== counterUpdate)
            || (inspectBound && boundNames.includes(x.identifier.name)))) return true;
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
      if (keyed.length === 0 || keyed.length !== writes.length || !selectionConditionSupported
        || keyed.some((write) => hasObservableEffect(write))
        || conditionalRuntimeEmit
        || hasUnjournalledRepeatedEffect(block, runtimeEmitSet, impureInlineResults)
        // The permutation proof relies on visiting every physical rank exactly once. Apart from the canonical
        // post-test tail update, mutating the counter can shorten, extend, or repeat the loop. Mutating the
        // public bound anywhere in the function similarly disconnects the SDK-derived witness length from the
        // runtime domain, including assignments which occur before the loop.
        || hasUnexpectedLoopControlMutation(block, true, false)
        || hasUnexpectedLoopControlMutation(node.body, false, true)) return false;
      // Exactly one key component is the physical cursor. If the counter also occurs in another component
      // (`m[i][i]`, `m[i + 1][i]`), replacing only the settlement key would change the logical tuple.
      if (keyed.some((write) => {
        const keys = keyExpressions(write);
        const at = counterKeyIndex(write, logical);
        return keys.some((key, index) => index !== at && containsIdentifier(key, logical));
      })) return false;
      const firstKeyShape = writeKeyShape(keyed[0]);
      if (keyed.some((write) => writeKeyShape(write) !== firstKeyShape)) return false;
      const keyedSet = new Set<Node>(keyed);
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
      const hasSiblingMappingRead = (x: Node): boolean => {
        if (keyedSet.has(x)) return false;
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
      const collectionAccessOf = (x: Node): { name: string; keys: ExpressionNode[] } | undefined => {
        if (x instanceof MappingAccessNode) return { name: x.name, keys: x.keys };
        if (!(x instanceof ArrayAccessNode)) return undefined;
        const keys: ExpressionNode[] = [];
        let cursor: ExpressionNode = x;
        while (cursor instanceof ArrayAccessNode) {
          keys.unshift(cursor.index);
          cursor = cursor.array;
        }
        return cursor instanceof IdentifierNode && this.collections.has(cursor.name)
          ? { name: cursor.name, keys } : undefined;
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
      for (const statement of block.statements ?? []) {
        if (statement instanceof VariableDefinitionNode && statement.expression
          && statement.inlinedReturningHelperPure !== false
          && !loopReassignedLocals.has(statement.name)
          && !hasObservableEffect(statement.expression)
          && !containsCollectionAccess(statement.expression)) {
          loopValueDefinitions.set(statement.name, statement.expression);
        }
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
            safe = false; return;
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
      const dependsOnLoopMutation = (x: Node, resolving = new Set<string>()): boolean => {
        if (x instanceof IdentifierNode && x.name !== logical && loopAssignedLocals.has(x.name)) {
          if (!safeLoopValueAlias(x.name, resolving)) return true;
          return dependsOnLoopMutation(loopValueDefinitions.get(x.name)!, new Set(resolving).add(x.name));
        }
        if (x instanceof StateAccessNode && loopWrittenState.has(x.name)) return true;
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node && dependsOnLoopMutation(value)) return true;
          if (Array.isArray(value)
            && value.some((item) => item instanceof Node && dependsOnLoopMutation(item))) return true;
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
        || keyed.some((write) => dependsOnLoopMutation(write))) return false;

      if (!apply) return true;

      const expandedWriteSelectionCondition = writeSelectionCondition
        && expandRuntimePathExpression(writeSelectionCondition, logical);
      if (writeSelectionCondition && !expandedWriteSelectionCondition) return false;
      const expandedBreakCondition = breakPaths.length > 0 && (breakCondition
        ? expandRuntimePathExpression(breakCondition, logical) : new BoolLiteralNode(true));
      if (breakPaths.length > 0 && !expandedBreakCondition) return false;
      const serial = this.serial++;
      const signedComponent = (value: bigint): string => value < 0n ? `n${-value}` : `p${value}`;
      const rangeSuffix = start === 0n && step === 1n
        ? '' : `_from_${signedComponent(start)}_step_${signedComponent(step)}`;
      const boundSuffix = boundOffset === 0n ? '' : `_bound_${signedComponent(boundOffset)}`;
      const hidden = `${PREFIX}${count}_${serial}${boundSuffix}${rangeSuffix}${postTest ? '_post' : ''}`;
      if (pathCondition) {
        (node.runtimeCounterLoopConditions ??= new Map()).set(hidden, cloneNode(pathCondition));
      }
      if (expandedWriteSelectionCondition) {
        (node.runtimeCounterLoopIterationConditions ??= new Map()).set(hidden, {
          expression: cloneNode(expandedWriteSelectionCondition),
          ...(expandedBreakCondition && { breakCondition: cloneNode(expandedBreakCondition) }),
          counter: { name: logical, initialValue: start, stepValue: step },
        });
      }
      const oldValueHidden = (collection: string): string =>
        `${VMAP_COUNTER_OLD_PREFIX}${count}_${serial}_${collection}`;
      const logicalValue = `__internal__vmapCounterLogical_${serial}`;
      const logicalRank = `__internal__vmapCounterRank_${serial}`;
      const settlementCursor = `__internal__vmapCounterCursor_${serial}`;
      const rangedIterationCount = `__internal__vmapCounterCount_${serial}`;
      const unitDomain = start === 0n && step === 1n;
      const bit = `__internal__vmapCounterBit_${serial}`;
      const mask = `__internal__vmapCounterMask_${serial}`;
      const at = <T extends Node>(value: T): T => { value.location = location; return value; };
      const id = (name: string): IdentifierNode => at(new IdentifierNode(name));
      const lit = (value: bigint): IntLiteralNode => at(new IntLiteralNode(value));
      const binary = (left: ExpressionNode, operator: BinaryOperator, right: ExpressionNode): BinaryOpNode =>
        at(new BinaryOpNode(left, operator, right));
      const proofInt = new IntType(true, 256);
      const asProofInt = (expression: ExpressionNode): ExpressionNode => counterType.signed
        ? expression : at(new CastNode(proofInt, expression, false));
      const sourceBoundValue = (): ExpressionNode => boundOffset === 0n
        ? id(count) : binary(id(count), BinaryOperator.PLUS, lit(boundOffset));
      const boundValue = (): ExpressionNode => asProofInt(sourceBoundValue());
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
      const physical = (): ExpressionNode => {
        // The source counter remains on its original arithmetic progression so calls and other effects observe
        // source order. Only mapping work indexes the physical permutation, using the counter's zero-based rank.
        if (expandedWriteSelectionCondition) return id(settlementCursor);
        if (unitDomain) return id(logical);
        return binary(binary(id(logical), BinaryOperator.MINUS, lit(start)), BinaryOperator.DIV, lit(step));
      };
      const permRead = (): ArrayAccessNode => {
        const a = new IdentifierNode(hidden); a.location = location;
        const r = new ArrayAccessNode(a, physical()); r.location = location; return r;
      };
      const replace = (x: Node): Node => {
        if (x instanceof IdentifierNode && x.name === logical) return id(logicalValue);
        if (x instanceof IdentifierNode && safeLoopValueAlias(x.name)) {
          return replace(cloneNode(loopValueDefinitions.get(x.name)!));
        }
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
          const v = (x as unknown as Record<string, unknown>)[key];
          if (v instanceof Node) (x as unknown as Record<string, unknown>)[key] = replace(v);
          else if (Array.isArray(v)) {
            (x as unknown as Record<string, unknown>)[key] = v.map((e) => e instanceof Node ? replace(e) : e);
          }
        }
        return x;
      };
      for (const write of keyed) {
        const keyIndex = counterKeyIndex(write, logical);
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
            const read = new ArrayAccessNode(values, physical()); read.location = location;
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
        }
        if (write instanceof ArrayAssignNode) {
          write.index = permRead();
          write.value = replace(write.value) as ExpressionNode;
        } else if (write instanceof ArrayDeleteNode) {
          write.index = permRead();
        } else if (write instanceof MappingAssignNode || write instanceof MappingFieldAssignNode) {
          write.keys[keyIndex] = permRead();
          write.expression = replace(write.expression) as ExpressionNode;
        } else {
          write.keys[keyIndex] = permRead();
        }
      }
      if (runtimeEmits.length > 0) {
        const loopIndex = node.runtimeLoopEvents?.length ?? 0;
        node.runtimeLoopEvents = [
          ...(node.runtimeLoopEvents ?? []),
          { loopIndex, permutationParam: hidden },
        ];
        runtimeEmits.forEach(({ emit, condition }, siteIndex) => {
          emit.runtimeLoopEvent = { loopIndex, siteIndex };
          emit.runtimeLoopEventCondition = condition;
          emit.runtimeLoopEventCounter = { name: logical, initialValue: start, stepValue: step };
        });
      }
      // The balanced route reserves the worst-case output width of every admitted runtime counter loop. One
      // iteration produces one mapping entry per distinct collection plus one record per unconditional event
      // site. Summing here handles sequential loops and multi-collection loops without recognizing a contract
      // schema later in layout planning.
      node.runtimeCounterLoopOutputCapacity = (node.runtimeCounterLoopOutputCapacity ?? 0)
        + MAX_COUNTER_ITERATIONS * (keyedCollections.size + runtimeEmits.length);
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
      prelude.push(at(new RequireNode(binary(
        at(new UnaryOpNode(UnaryOperator.SIZE, id(hidden))),
        expandedWriteSelectionCondition ? BinaryOperator.LE : BinaryOperator.EQ,
        iterationCount(),
      ), 'vmap counter permutation length mismatch')));
      prelude.push(at(new VariableDefinitionNode(new IntType(true, 256), [], mask, lit(0n))));
      if (expandedWriteSelectionCondition) {
        prelude.push(at(new VariableDefinitionNode(
          new IntType(true, 256), [], settlementCursor, lit(0n),
        )));
      }

      const logicalDefinition = at(new VariableDefinitionNode(
        counterType, [], logicalValue,
        expandedWriteSelectionCondition
          ? at(new TernaryOpNode(
            cloneNode(expandedWriteSelectionCondition),
            permRead(),
            lit(0n),
          ))
          : permRead(),
      ));
      const logicalProofValue = (): ExpressionNode => asProofInt(id(logicalValue));
      const rankDefinition = unitDomain ? undefined : at(new VariableDefinitionNode(
        proofInt, [], logicalRank,
        binary(binary(logicalProofValue(), BinaryOperator.MINUS, lit(start)), BinaryOperator.DIV, lit(step)),
      ));
      const rank = (): IdentifierNode => id(unitDomain ? logicalValue : logicalRank);
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
      const logicalInRange = at(new RequireNode(
        logicalInRangeExpression, 'vmap counter permutation value out of range',
      ));
      const bitDefinition = at(new VariableDefinitionNode(
        new IntType(true, 256), [], bit,
        binary(lit(1n), BinaryOperator.SHIFT_LEFT, rank()),
      ));
      const unique = at(new RequireNode(binary(
        binary(id(mask), BinaryOperator.BIT_AND, id(bit)), BinaryOperator.EQ, lit(0n),
      ), 'vmap counter permutation contains a duplicate'));
      const markSeen = at(new AssignNode(id(mask), binary(id(mask), BinaryOperator.BIT_OR, id(bit))));
      const proofStatements: StatementNode[] = [
        ...(rankDefinition ? [rankDefinition] : []),
        logicalInRange, bitDefinition, unique, markSeen,
      ];
      const cursorAdvance = expandedWriteSelectionCondition
        ? at(new BranchNode(
          cloneNode(expandedWriteSelectionCondition),
          at(new BlockNode([at(new AssignNode(
            id(settlementCursor), binary(id(settlementCursor), BinaryOperator.PLUS, lit(1n)),
          ))])),
        ))
        : undefined;
      const originalStatements = block.statements ?? [];
      const injectBreakAdvances = (target: BlockNode): void => {
        if (!cursorAdvance) return;
        const statements: StatementNode[] = [];
        for (const statement of target.statements ?? []) {
          if (statement instanceof BreakNode || statement instanceof ReturnNode) {
            statements.push(cloneNode(cursorAdvance), statement);
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
      const sourceStatements = breakPaths.length > 0 && cursorAdvance
        ? originalStatements.flatMap((statement) => statement instanceof BreakNode
          || statement instanceof ReturnNode
          ? [cloneNode(cursorAdvance), statement] : [statement])
        : originalStatements;
      const updateIndex = counterUpdate ? sourceStatements.indexOf(counterUpdate) : -1;
      const bodyWithCursor = cursorAdvance && updateIndex >= 0
        ? [
          ...sourceStatements.slice(0, updateIndex), cursorAdvance,
          ...sourceStatements.slice(updateIndex),
        ]
        : [...sourceStatements, ...(cursorAdvance ? [cursorAdvance] : [])];
      block.statements = [
        logicalDefinition,
        ...(expandedWriteSelectionCondition ? [at(new BranchNode(
          cloneNode(expandedWriteSelectionCondition), at(new BlockNode(proofStatements)),
        ))] : proofStatements),
        // BreakContinueTransformation runs after this pass and nests the tail (including this advance) under the
        // fall-through arm of a source `continue`, so selected iterations consume exactly one physical rank.
        ...bodyWithCursor,
      ];
      if (expandedWriteSelectionCondition) {
        const loopIndex = canonical.parent.statements?.indexOf(loop) ?? -1;
        if (loopIndex < 0) return false;
        canonical.parent.statements!.splice(loopIndex + 1, 0, at(new RequireNode(binary(
          id(settlementCursor), BinaryOperator.EQ,
          at(new UnaryOpNode(UnaryOperator.SIZE, id(hidden))),
        ), 'vmap counter selection length mismatch')));
      }
      const p = new ParameterNode(new ArrayType(counterType), hidden);
      p.location = node.location;
      added.push(p);
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
      const outerEventConditions = new Map(outerEmits.map(({ emit, condition }) => [emit, condition]));
      const orderedSegments: typeof node.runtimeLoopEvents = [];
      const appendLoop = (loop: WhileNode | DoWhileNode): void => {
        const emits: EmitStatementNode[] = [];
        const collect = (candidate: Node): void => {
          if (candidate !== loop && (candidate instanceof WhileNode || candidate instanceof DoWhileNode)) return;
          if (candidate instanceof EmitStatementNode && candidate.runtimeLoopEvent) {
            emits.push(candidate);
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
        if (emits.length === 0) return;
        const prior = priorSegments.get(emits[0].runtimeLoopEvent!.loopIndex)!;
        const loopIndex = orderedSegments.length;
        emits.forEach((emit, siteIndex) => { emit.runtimeLoopEvent = { loopIndex, siteIndex }; });
        orderedSegments.push({ loopIndex, permutationParam: prior.permutationParam });
      };
      const appendOuter = (emit: EmitStatementNode): void => {
        const loopIndex = orderedSegments.length;
        emit.runtimeLoopEvent = { loopIndex, siteIndex: 0 };
        emit.runtimeLoopEventCondition = outerEventConditions.get(emit);
        orderedSegments.push({ loopIndex, repeatCount: 1 });
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
    if (prelude.length > 0) node.body.statements = [...prelude, ...(node.body.statements ?? [])];
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
}
