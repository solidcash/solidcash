import {
  AddressSendExpressionNode, AddressTransferStatementNode, ArrayAccessNode, ArrayAssignNode, ArrayDeleteNode,
  AssignNode, BinaryOpNode, BlockNode, BranchNode, BreakNode, ContinueNode, ContractNode, DoWhileNode,
  EmitStatementNode, ExpressionNode, ExternalFunctionCallNode, FunctionCallNode, FunctionCallStatementNode,
  FunctionDefinitionNode, IdentifierNode, IntLiteralNode, MappingAccessNode, MappingAssignNode, MappingDeleteNode,
  MappingFieldAssignNode, MethodCallNode, MethodCallStatementNode, Node, ParameterNode, RequireNode, SourceFileNode,
  ReturnNode,
  StateAccessNode, StateArrayAssignNode, StateArrayDeleteNode, StateArrayPopNode, StateArrayPushNode,
  StateAssignNode, StatementNode, SwitchNode, TernaryOpNode, TokenContainerMethodStatementNode, TransferStatementNode,
  UnaryOpNode, VariableDefinitionNode, WhileNode, FunctionModifier,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
import { ArrayType, IntType } from '@solidcash/utils';

export const VMAP_COUNTER_PERM_PREFIX = '__internal__vmapCounterPerm_';
const PREFIX = VMAP_COUNTER_PERM_PREFIX;
const PURE_COUNTER_VALUE_BUILTINS = new Set([
  'abs', 'min', 'max', 'within', 'addmod', 'mulmod',
  'ripemd160', 'sha1', 'sha256', 'hash160', 'hash256',
  'checkSig', 'checkMultiSig', 'checkDataSig',
  'toPaddedBytes', 'intToString', 'stringToInt', 'blobhash',
]);

/**
 * Lower a vmap counter loop `for (int i=0; i<n; i++) m[…][i] = f(i);` so logical indices execute through an
 * SDK-supplied slot-order permutation. Only mapping/array write keys and values are rewritten to perm[i].
 * Typed calls and other statements stay in source order. Effects backed by fixed output slots (events, BCH
 * transfers, and token-container transfers) cannot repeat at runtime yet: their route frame is row-scoped, not
 * inner-iteration-scoped, so those loops remain unlowered. The canonical pre-test domain
 * `for (int i = 0; i < publicBound; i = i + 1)` and post-test domain
 * `int i = 0; do { ...; i = i + 1; } while (i < publicBound)` lower. The latter authenticates
 * `max(publicBound, 1)` entries. Counter-dependent guards, sibling reads of the mutated mapping,
 * `continue`/`break`, and other domains need a separate logical-journal/physical-settlement phase.
 *
 * The permutation is an untrusted unlocking witness. Generated checks prove it has exactly the canonical domain's
 * number of distinct elements in that domain, hence it is a complete permutation rather than an SDK convention.
 */
export default class LowerVMapCounterLoops extends AstTraversal {
  private collections = new Set<string>();
  private functionsByName = new Map<string, FunctionDefinitionNode[]>();
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
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const added: ParameterNode[] = [];
    const prelude: StatementNode[] = [];
    // The compiler invokes this pass both before speculative admission and, when needed, before final codegen.
    // A hidden parameter is also the durable marker that this function already consumed its one physical cursor.
    let loweredCounterLoop = node.parameters.some((parameter) => parameter.name.startsWith(PREFIX));
    type CanonicalLoop = {
      logical: string;
      count: string;
      boundNames: string[];
      boundDefinitions: VariableDefinitionNode[];
      postTest: boolean;
      counterUpdate?: AssignNode;
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
            || !(loop.condition instanceof BinaryOpNode) || loop.condition.operator !== BinaryOperator.LT
            || !(loop.condition.left instanceof IdentifierNode) || loop.condition.left.name !== variable.name
            || !(bound instanceof IdentifierNode) || boundResolution === undefined) continue;
          const update = loop.block.statements?.at(-1);
          const unitUpdate = update instanceof AssignNode && update.identifier.name === variable.name
            && update.expression instanceof BinaryOpNode && update.expression.operator === BinaryOperator.PLUS
            && update.expression.left instanceof IdentifierNode
            && update.expression.left.name === variable.name
            && update.expression.right instanceof IntLiteralNode && update.expression.right.value === 1n;
          const preTest = loop instanceof WhileNode && variable.isLoopVariable === true
            && variable.loopInitialValue === 0n && variable.loopStepValue === 1n
            && loop.forLoopUpdateCount === 1 && unitUpdate;
          const postTest = loop instanceof DoWhileNode
            && variable.expression instanceof IntLiteralNode && variable.expression.value === 0n
            && unitUpdate;
          if (!preTest && !postTest) continue;
          canonicalLoops.set(loop, {
            logical: variable.name,
            count: boundResolution.count,
            boundNames: [boundResolution.count, ...boundResolution.definitions.map((definition) => definition.name)],
            boundDefinitions: boundResolution.definitions,
            postTest,
            counterUpdate: update as AssignNode,
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
    const hasUnjournalledRepeatedEffect = (x: Node): boolean => {
      // The whole typed-call node, including its interface/address projection, is represented by the manifest.
      // Do not descend into that projection: it contains method-call-shaped syntax which is not a direct effect.
      if (x instanceof ExternalFunctionCallNode) return false;
      if (x instanceof MethodCallStatementNode && (x.expression instanceof ExternalFunctionCallNode
        || (x.call.object instanceof FunctionCallNode
          && this.externalTypeNames.has(x.call.object.identifier.name)))) return false;
      if (x instanceof EmitStatementNode || x instanceof TransferStatementNode
        || x instanceof AddressTransferStatementNode || x instanceof AddressSendExpressionNode
        || x instanceof TokenContainerMethodStatementNode
        || x instanceof MethodCallNode || x instanceof MethodCallStatementNode) return true;
      if (x instanceof FunctionCallNode) return hasObservableEffect(x);
      if (x instanceof FunctionCallStatementNode) return hasObservableEffect(x);
      for (const key of Object.keys(x)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type'
          || key === 'resolvedFunction') continue;
        const value = (x as unknown as Record<string, unknown>)[key];
        if (value instanceof Node && hasUnjournalledRepeatedEffect(value)) return true;
        if (Array.isArray(value)
          && value.some((item) => item instanceof Node && hasUnjournalledRepeatedEffect(item))) return true;
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
    // The current physical settlement frame owns one runtime cursor. Decide this before mutating the AST so a
    // refused two-loop handler does not leak an unused compiler-owned permutation into its ordinary ABI.
    const counterWriteLoops = [...canonicalLoops].filter(([loop, canonical]) =>
      isCounterWriteLoop(loop, canonical.logical));
    const tryLower = (loop: WhileNode | DoWhileNode): void => {
      const canonical = canonicalLoops.get(loop);
      if (!canonical || loweredCounterLoop || counterWriteLoops.length !== 1) return;
      const { logical, count, boundNames, boundDefinitions, postTest, counterUpdate } = canonical;
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
        || hasUnjournalledRepeatedEffect(block)
        // The permutation proof relies on visiting every physical rank exactly once. Apart from the canonical
        // post-test tail update, mutating the counter can shorten, extend, or repeat the loop. Mutating the
        // public bound anywhere in the function similarly disconnects the SDK-derived witness length from the
        // runtime domain, including assignments which occur before the loop.
        || hasUnexpectedLoopControlMutation(block, true, false)
        || hasUnexpectedLoopControlMutation(node.body, false, true)) return;
      // Exactly one key component is the physical cursor. If the counter also occurs in another component
      // (`m[i][i]`, `m[i + 1][i]`), replacing only the settlement key would change the logical tuple.
      if (keyed.some((write) => {
        const keys = keyExpressions(write);
        const at = counterKeyIndex(write, logical);
        return keys.some((key, index) => index !== at && containsIdentifier(key, logical));
      })) return;
      const firstKeyShape = writeKeyShape(keyed[0]);
      if (keyed.some((write) => writeKeyShape(write) !== firstKeyShape)) return;
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
      const loopWrittenState = new Set<string>();
      const collectLoopMutations = (x: Node): void => {
        if (x !== block && (x instanceof WhileNode || x instanceof DoWhileNode)) return;
        if (x instanceof VariableDefinitionNode) loopAssignedLocals.add(x.name);
        else if (x instanceof AssignNode) loopAssignedLocals.add(x.identifier.name);
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
      const dependsOnLoopMutation = (x: Node): boolean => {
        if (x instanceof IdentifierNode && x.name !== logical && loopAssignedLocals.has(x.name)) return true;
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
      const hasLoopCarriedWriteGuard = (x: Node): boolean => {
        if (x instanceof BranchNode && containsKeyedWrite(x)
          && dependsOnLoopMutation(x.condition)) return true;
        if (x instanceof SwitchNode && containsKeyedWrite(x)
          && dependsOnLoopMutation(x.expression)) return true;
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
        || hasLoopCarriedWriteGuard(block) || keyed.some(dependsOnLoopMutation)) return;

      loweredCounterLoop = true;
      const serial = this.serial++;
      const hidden = `${PREFIX}${count}_${serial}${postTest ? '_post' : ''}`;
      const logicalValue = `__internal__vmapCounterLogical_${serial}`;
      const bit = `__internal__vmapCounterBit_${serial}`;
      const mask = `__internal__vmapCounterMask_${serial}`;
      const at = <T extends Node>(value: T): T => { value.location = location; return value; };
      const id = (name: string): IdentifierNode => at(new IdentifierNode(name));
      const lit = (value: bigint): IntLiteralNode => at(new IntLiteralNode(value));
      const binary = (left: ExpressionNode, operator: BinaryOperator, right: ExpressionNode): BinaryOpNode =>
        at(new BinaryOpNode(left, operator, right));
      const iterationCount = (): ExpressionNode => postTest
        ? at(new TernaryOpNode(binary(id(count), BinaryOperator.GT, lit(0n)), id(count), lit(1n)))
        : id(count);
      const physical = (): IdentifierNode => {
        const value = new IdentifierNode(logical); value.location = location; return value;
      };
      const permRead = (): ArrayAccessNode => {
        const a = new IdentifierNode(hidden); a.location = location;
        const r = new ArrayAccessNode(a, physical()); r.location = location; return r;
      };
      const replace = (x: Node): Node => {
        if (x instanceof IdentifierNode && x.name === logical) return id(logicalValue);
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
      const countInRange = binary(
        binary(id(count), BinaryOperator.GE, lit(0n)),
        BinaryOperator.AND,
        binary(id(count), BinaryOperator.LE, lit(64n)),
      );
      prelude.push(at(new RequireNode(countInRange, 'vmap counter loop bound must be between 0 and 64')));
      prelude.push(at(new RequireNode(binary(
        at(new UnaryOpNode(UnaryOperator.SIZE, id(hidden))), BinaryOperator.EQ, iterationCount(),
      ), 'vmap counter permutation length mismatch')));
      prelude.push(at(new VariableDefinitionNode(new IntType(true, 256), [], mask, lit(0n))));

      const logicalDefinition = at(new VariableDefinitionNode(
        new IntType(true, 256), [], logicalValue, permRead(),
      ));
      const logicalInRange = at(new RequireNode(binary(
        binary(id(logicalValue), BinaryOperator.GE, lit(0n)),
        BinaryOperator.AND,
        binary(id(logicalValue), BinaryOperator.LT, iterationCount()),
      ), 'vmap counter permutation value out of range'));
      const bitDefinition = at(new VariableDefinitionNode(
        new IntType(true, 256), [], bit,
        binary(lit(1n), BinaryOperator.SHIFT_LEFT, id(logicalValue)),
      ));
      const unique = at(new RequireNode(binary(
        binary(id(mask), BinaryOperator.BIT_AND, id(bit)), BinaryOperator.EQ, lit(0n),
      ), 'vmap counter permutation contains a duplicate'));
      const markSeen = at(new AssignNode(id(mask), binary(id(mask), BinaryOperator.BIT_OR, id(bit))));
      block.statements = [logicalDefinition, logicalInRange, bitDefinition, unique, markSeen, ...(block.statements ?? [])];
      const p = new ParameterNode(new ArrayType(new IntType(true, 256)), hidden);
      p.location = node.location;
      added.push(p);
    };
    const lower = (n: Node): void => {
      if (n instanceof WhileNode || n instanceof DoWhileNode) tryLower(n);
      for (const key of Object.keys(n)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) lower(v);
        else if (Array.isArray(v)) for (const e of v) if (e instanceof Node) lower(e);
      }
    };
    lower(node.body);
    if (prelude.length > 0) node.body.statements = [...prelude, ...(node.body.statements ?? [])];
    node.parameters.push(...added);
    return node;
  }
}
