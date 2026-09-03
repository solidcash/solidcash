import {
  AddressSendExpressionNode, AddressTransferStatementNode, ArrayAccessNode, ArrayAssignNode, ArrayDeleteNode,
  AssignNode, BinaryOpNode, BlockNode, BranchNode, BreakNode, ContinueNode, ContractNode, DoWhileNode,
  EmitStatementNode, ExpressionNode, ExternalFunctionCallNode, FunctionCallNode, FunctionCallStatementNode,
  FunctionDefinitionNode, IdentifierNode, IntLiteralNode, MappingAccessNode, MappingAssignNode, MappingDeleteNode,
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
 * Typed calls and other statements stay in source order. Unconditionally reached event sites are recorded in a
 * function-local runtime stream and settled after all mapping journals, so they repeat in logical source order
 * without sharing the route's fixed per-row event slots. Conditional/nested event reachability, BCH transfers,
 * and token-container transfers still need their own runtime effect records. The canonical pre-test domains
 * `for (int i = constantStart; i < publicBound; i = i + positiveConstantStep)` and
 * `for (int i = constantStart; i > publicBound; i = i - positiveConstantStep)`, plus the post-test domain
 * `int i = 0; do { ...; i = i + 1; } while (i < publicBound)` lower. The latter authenticates
 * `max(publicBound, 1)` entries. Multiple unconditional source-order loops may lower together when their
 * runtime keys are disjoint; each loop receives its own authenticated trailing input/output segment.
 * Counter-dependent guards, sibling reads of the mutated mapping,
 * `continue`/`break`, and other domains need a separate logical-journal/physical-settlement phase.
 *
 * The permutation is an untrusted unlocking witness. Generated checks prove it has exactly the canonical domain's
 * number of distinct elements in that domain, hence it is a complete permutation rather than an SDK convention.
 */
export default class LowerVMapCounterLoops extends AstTraversal {
  private collections = new Set<string>();
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
      start: bigint;
      step: bigint;
      postTest: boolean;
      counterUpdate?: AssignNode;
      parent: BlockNode;
    };
    const canonicalLoops = new Map<WhileNode | DoWhileNode, CanonicalLoop>();
    const findCanonicalLoops = (x: Node): void => {
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
            name: string,
            before: number,
            seen = new Set<string>(),
          ): { count: string; definitions: VariableDefinitionNode[] } | undefined => {
            if (visibleCounts.has(name)) return { count: name, definitions: [] };
            if (seen.has(name)) return undefined;
            const definitions = statements.slice(0, before)
              .map((statement, position) => ({ statement, position }))
              .filter((candidate): candidate is { statement: VariableDefinitionNode; position: number } =>
                candidate.statement instanceof VariableDefinitionNode && candidate.statement.name === name);
            if (definitions.length !== 1 || !(definitions[0].statement.expression instanceof IdentifierNode)) {
              return undefined;
            }
            const parent = resolveBound(
              definitions[0].statement.expression.name,
              definitions[0].position,
              new Set(seen).add(name),
            );
            return parent && {
              count: parent.count,
              definitions: [...parent.definitions, definitions[0].statement],
            };
          };
          const boundResolution = bound instanceof IdentifierNode
            ? resolveBound(bound.name, index - 1) : undefined;
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
            start: preTest ? variable.loopInitialValue! : 0n,
            step: preTest ? variable.loopStepValue! : 1n,
            postTest,
            counterUpdate: update as AssignNode,
            parent: x,
          });
        }
      }
      for (const key of Object.keys(x)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
        const value = (x as unknown as Record<string, unknown>)[key];
        if (value instanceof Node) findCanonicalLoops(value);
        else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) findCanonicalLoops(item);
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
    const hasJump = (x: Node): boolean => {
      if (x instanceof ContinueNode || x instanceof BreakNode || x instanceof ReturnNode) return true;
      for (const key of Object.keys(x)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
        const v = (x as unknown as Record<string, unknown>)[key];
        if (v instanceof Node && hasJump(v)) return true;
        if (Array.isArray(v) && v.some((e) => e instanceof Node && hasJump(e))) return true;
      }
      return false;
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
      // The whole typed-call node, including its interface/address projection, is represented by the manifest.
      // Do not descend into that projection: it contains method-call-shaped syntax which is not a direct effect.
      if (x instanceof ExternalFunctionCallNode) return false;
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
    const tryLower = (loop: WhileNode | DoWhileNode, apply: boolean): boolean => {
      const canonical = canonicalLoops.get(loop);
      if (!canonical) return false;
      const { logical, count, boundNames, boundDefinitions, start, step, postTest, counterUpdate } = canonical;
      const { block, location } = loop;
      const writes: Array<ArrayAssignNode | ArrayDeleteNode | MappingAssignNode | MappingDeleteNode
      | MappingFieldAssignNode> = [];
      const collectWrites = (x: Node): void => {
        if (x instanceof WhileNode || x instanceof DoWhileNode) return;
        if (isWrite(x)) { writes.push(x); return; }
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
          const v = (x as unknown as Record<string, unknown>)[key];
          if (v instanceof Node) collectWrites(v);
          else if (Array.isArray(v)) for (const e of v) if (e instanceof Node) collectWrites(e);
        }
      };
      collectWrites(block);
      // Runtime event cardinality must be derivable before the first VM probe. For now that means the event is
      // reached exactly once per loop iteration: transparent lexical blocks are fine, while a branch, switch,
      // try/catch, or nested loop would make the output count path-dependent. This is a construct rule, not a
      // contract/schema allow-list; every event definition and argument expression uses the same record format.
      const runtimeEmits: EmitStatementNode[] = [];
      let conditionalRuntimeEmit = false;
      const collectRuntimeEmits = (x: Node, conditional: boolean): void => {
        if (x instanceof EmitStatementNode) {
          if (conditional) conditionalRuntimeEmit = true;
          else runtimeEmits.push(x);
          return;
        }
        const childConditional = conditional || x instanceof BranchNode || x instanceof SwitchNode
          || x instanceof TryCatchNode
          || (x !== block && (x instanceof WhileNode || x instanceof DoWhileNode));
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
            || key === 'resolvedFunction') continue;
          const value = (x as unknown as Record<string, unknown>)[key];
          if (value instanceof Node) collectRuntimeEmits(value, childConditional);
          else if (Array.isArray(value)) {
            for (const item of value) if (item instanceof Node) collectRuntimeEmits(item, childConditional);
          }
        }
      };
      collectRuntimeEmits(block, false);
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
      const runtimeEmitSet = new Set(runtimeEmits);
      const keyed = writes.filter((write) =>
        this.collections.has(write.name) && counterKeyIndex(write, logical) >= 0);
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
      if (keyed.length === 0 || keyed.length !== writes.length
        || hasJump(block) || keyed.some((write) => hasObservableEffect(write))
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
      // The compact old-entry transition has exactly one supported shape: `m[key] +/- rhs`, with all mapping
      // state confined to the left operand. Other operators need the old value in a general expression journal;
      // rewriting them onto the permutation would otherwise let codegen mistake (for example) `* 2` for `+ 2`.
      const hasUnsupportedOldEntryExpression = keyed.some((write) => {
        const expression = write instanceof MappingAssignNode ? write.expression
          : write instanceof ArrayAssignNode ? write.value : undefined;
        if (!expression || !containsCollectionAccess(expression)) return false;
        const left = expression instanceof BinaryOpNode ? collectionAccessOf(expression.left) : undefined;
        if (!(expression instanceof BinaryOpNode)
          || (expression.operator !== BinaryOperator.PLUS && expression.operator !== BinaryOperator.MINUS)
          || !left
          || left.name !== write.name
          || left.keys.map(expressionShape).join('|') !== writeKeyShape(write)
          || containsCollectionAccess(expression.right)) return true;
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
        }
        else if (x instanceof StateAssignNode || x instanceof StateArrayAssignNode
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
      if (hasCounterDependentGuard(block) || hasSiblingMappingRead(block) || hasUnsafeRead(block)
        || hasUnsupportedOldEntryExpression
        || hasLoopCarriedWriteGuard(block) || keyed.some((write) => dependsOnLoopMutation(write))) return false;

      if (!apply) return true;

      const serial = this.serial++;
      const signedComponent = (value: bigint): string => value < 0n ? `n${-value}` : `p${value}`;
      const rangeSuffix = start === 0n && step === 1n
        ? '' : `_from_${signedComponent(start)}_step_${signedComponent(step)}`;
      const hidden = `${PREFIX}${count}_${serial}${rangeSuffix}${postTest ? '_post' : ''}`;
      const logicalValue = `__internal__vmapCounterLogical_${serial}`;
      const logicalRank = `__internal__vmapCounterRank_${serial}`;
      const rangedIterationCount = `__internal__vmapCounterCount_${serial}`;
      const unitDomain = start === 0n && step === 1n;
      const bit = `__internal__vmapCounterBit_${serial}`;
      const mask = `__internal__vmapCounterMask_${serial}`;
      const at = <T extends Node>(value: T): T => { value.location = location; return value; };
      const id = (name: string): IdentifierNode => at(new IdentifierNode(name));
      const lit = (value: bigint): IntLiteralNode => at(new IntLiteralNode(value));
      const binary = (left: ExpressionNode, operator: BinaryOperator, right: ExpressionNode): BinaryOpNode =>
        at(new BinaryOpNode(left, operator, right));
      const positiveIterationCount = (): ExpressionNode => binary(
        binary(binary(
          step > 0n
            ? binary(id(count), BinaryOperator.MINUS, lit(start))
            : binary(lit(start), BinaryOperator.MINUS, id(count)),
          BinaryOperator.MINUS, lit(1n)),
        BinaryOperator.DIV, lit(step > 0n ? step : -step)),
        BinaryOperator.PLUS,
        lit(1n),
      );
      const derivedIterationCount = (): ExpressionNode => at(new TernaryOpNode(
        binary(id(count), step > 0n ? BinaryOperator.GT : BinaryOperator.LT, lit(start)),
        positiveIterationCount(),
        lit(postTest ? 1n : 0n),
      ));
      const iterationCount = (): ExpressionNode => {
        // Preserve the established unit-domain form: it is both smaller and bytecode-compatible with existing
        // counter rows. General progressions pay for the ceiling division only when they actually need it.
        if (unitDomain && !postTest) return id(count);
        if (unitDomain) {
          return at(new TernaryOpNode(
            binary(id(count), BinaryOperator.GT, lit(0n)), id(count), lit(1n),
          ));
        }
        return id(rangedIterationCount);
      };
      const physical = (): ExpressionNode => {
        // The source counter remains on its original arithmetic progression so calls and other effects observe
        // source order. Only mapping work indexes the physical permutation, using the counter's zero-based rank.
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
        runtimeEmits.forEach((emit, siteIndex) => {
          emit.runtimeLoopEvent = { loopIndex, siteIndex };
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
          new IntType(true, 256), [], rangedIterationCount, derivedIterationCount(),
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
        at(new UnaryOpNode(UnaryOperator.SIZE, id(hidden))), BinaryOperator.EQ, iterationCount(),
      ), 'vmap counter permutation length mismatch')));
      prelude.push(at(new VariableDefinitionNode(new IntType(true, 256), [], mask, lit(0n))));

      const logicalDefinition = at(new VariableDefinitionNode(
        new IntType(true, 256), [], logicalValue, permRead(),
      ));
      const rankDefinition = unitDomain ? undefined : at(new VariableDefinitionNode(
        new IntType(true, 256), [], logicalRank,
        binary(binary(id(logicalValue), BinaryOperator.MINUS, lit(start)), BinaryOperator.DIV, lit(step)),
      ));
      const rank = (): IdentifierNode => id(unitDomain ? logicalValue : logicalRank);
      const logicalInRangeExpression = unitDomain ? binary(
        binary(id(logicalValue), BinaryOperator.GE, lit(0n)),
        BinaryOperator.AND,
        binary(id(logicalValue), BinaryOperator.LT, iterationCount()),
      ) : binary(
        binary(
          binary(id(logicalValue), step > 0n ? BinaryOperator.GE : BinaryOperator.LE, lit(start)),
          BinaryOperator.AND,
          binary(rank(), BinaryOperator.LT, iterationCount()),
        ),
        BinaryOperator.AND,
        binary(
          id(logicalValue),
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
      block.statements = [
        logicalDefinition, ...(rankDefinition ? [rankDefinition] : []),
        logicalInRange, bitDefinition, unique, markSeen,
        ...(block.statements ?? []),
      ];
      const p = new ParameterNode(new ArrayType(new IntType(true, 256)), hidden);
      p.location = node.location;
      added.push(p);
      for (const collection of keyedCollections) runtimeCountCollections.add(collection);
      return true;
    };
    const counterWriteLoopSet = new Set(counterWriteLoops.map(([loop]) => loop));
    const allSafe = counterWriteLoops.length > 0
      // Runtime journals must be unconditional peers in source order. A branch/nesting-aware plan needs
      // reachability metadata in the SDK even for one loop; otherwise it materializes outputs for an inactive
      // path. Keep the invariant uniform instead of special-casing the first loop.
      && counterWriteLoops.every(([, canonical]) => canonical.parent === node.body)
      && counterWriteLoops.every(([loop]) => tryLower(loop, false));
    // Events outside an admitted loop must join the same trailing stream or their fixed output family would move
    // an `emit after` ahead of all repeated records. Only unconditionally reached source sites have an exact
    // pre-probe count. Conditional/nested sites and eventful internal helpers therefore keep the whole lowering
    // frozen until the runtime plan carries path/call context.
    const outerEmits: EmitStatementNode[] = [];
    let unsupportedOuterEvent = false;
    let eventfulHelperCall = false;
    const collectOuterEvents = (candidate: Node, conditional: boolean): void => {
      if (counterWriteLoopSet.has(candidate as WhileNode | DoWhileNode)) return;
      if (candidate instanceof EmitStatementNode) {
        if (conditional) unsupportedOuterEvent = true;
        else outerEmits.push(candidate);
        return;
      }
      if (candidate instanceof FunctionCallNode
        && this.eventfulFunctionNames.has(candidate.identifier.name)) eventfulHelperCall = true;
      const childConditional = conditional || candidate instanceof BranchNode || candidate instanceof SwitchNode
        || candidate instanceof TryCatchNode || candidate instanceof WhileNode || candidate instanceof DoWhileNode;
      for (const key of Object.keys(candidate)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
          || key === 'resolvedFunction') continue;
        const value = (candidate as unknown as Record<string, unknown>)[key];
        if (value instanceof Node) collectOuterEvents(value, childConditional);
        else if (Array.isArray(value)) {
          for (const item of value) if (item instanceof Node) collectOuterEvents(item, childConditional);
        }
      }
    };
    collectOuterEvents(node.body, false);
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
