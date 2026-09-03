import {
  Node,
  SourceFileNode,
  ContractNode,
  FunctionDefinitionNode,
  StatementNode,
  BlockNode,
  BranchNode,
  WhileNode,
  DoWhileNode,
  UncheckedNode,
  SwitchNode,
  TryCatchNode,
  ReturnNode,
  MappingAccessNode,
  MappingAssignNode,
  MappingDeleteNode,
  MappingFieldAssignNode,
  ArrayAccessNode,
  ArrayAssignNode,
  ArrayPushNode,
  ArrayPopNode,
  IdentifierNode,
  NullaryOpNode,
  VariableDefinitionNode,
  AssignNode,
  FieldAccessNode,
  FunctionCallNode,
  LiteralNode,
  TupleAssignmentNode,
  BoolLiteralNode,
  ExpressionNode,
  CastNode,
  UnaryOpNode,
  BinaryOpNode,
  TernaryOpNode,
  FunctionModifier,
} from '../ast/AST.js';
import { NullaryOperator } from '../ast/Operator.js';
import { MappingType, ArrayType, StructType, Type, PrimitiveType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

const PREFIX = '__vmapcache_';

// A mapping key we can cache on. Only INVARIANT keys qualify: a simple identifier (invariance re-checked via
// assignsName), or a nullary tx-derived address (msg.sender / tx.origin - inherently invariant; nothing reassigns
// them and they read identically every iteration). `for(i) bal[msg.sender] -= amts[i]` (a batch debit from the
// caller - the same-key half of an ERC-20 multiTransfer) is the driving case; its flush is a single msg.sender
// vmap write, which is proven (MsgSenderVMap).
type KeyKind =
  | { kind: 'id'; name: string }
  | { kind: 'nullary'; op: NullaryOperator }
  | { kind: 'literal'; node: LiteralNode; canon: string }
  | { kind: 'expression'; node: ExpressionNode; canon: string };

const PURE_KEY_BUILTINS = new Set([
  'abs', 'min', 'max', 'within', 'addmod', 'mulmod',
  'ripemd160', 'sha1', 'sha256', 'hash160', 'hash256',
  'toPaddedBytes', 'intToString', 'stringToInt',
]);

function literalCanon(k: LiteralNode): string {
  const value = k.value instanceof Uint8Array ? [...k.value].join(',') : String(k.value);
  return `${k.constructor.name}:${value}`;
}

// canon groups accesses of the same entry; null = an unsupported key (arr[i], m[k2], expression) -> not cached, so
// the multi-write / loop write falls through to the fail-closed sorted-codegen path (sound, never a silent skip).
function expressionCanon(k: Node): string | undefined {
  if (k instanceof IdentifierNode) return `id:${k.name}`;
  if (k instanceof LiteralNode) return `literal:${literalCanon(k)}`;
  if (k instanceof NullaryOpNode
    && (k.operator === NullaryOperator.MSG_SENDER || k.operator === NullaryOperator.TX_ORIGIN)) {
    return `nullary:${k.operator}`;
  }
  if (k instanceof CastNode) {
    const inner = expressionCanon(k.expression);
    return inner ? `cast:${k.type.toString()}(${inner})` : undefined;
  }
  if (k instanceof UnaryOpNode) {
    const inner = expressionCanon(k.expression);
    return inner ? `unary:${k.operator}(${inner})` : undefined;
  }
  if (k instanceof BinaryOpNode) {
    const left = expressionCanon(k.left);
    const right = expressionCanon(k.right);
    return left && right ? `binary:${k.operator}(${left},${right})` : undefined;
  }
  if (k instanceof TernaryOpNode) {
    const condition = expressionCanon(k.condition);
    const ifTrue = expressionCanon(k.ifTrue);
    const ifFalse = expressionCanon(k.ifFalse);
    return condition && ifTrue && ifFalse ? `ternary(${condition},${ifTrue},${ifFalse})` : undefined;
  }
  if (k instanceof FieldAccessNode) {
    const inner = expressionCanon(k.expression);
    return inner ? `field:${k.name}(${inner})` : undefined;
  }
  if (k instanceof ArrayAccessNode) {
    const array = expressionCanon(k.array);
    const index = expressionCanon(k.index);
    return array && index ? `index(${array},${index})` : undefined;
  }
  if (k instanceof FunctionCallNode) {
    const pure = PURE_KEY_BUILTINS.has(k.identifier.name)
      || k.resolvedFunction?.modifiers.includes(FunctionModifier.PURE) === true;
    if (!pure) return undefined;
    const args = k.parameters.map(expressionCanon);
    return args.every((arg): arg is string => arg !== undefined)
      ? `call:${k.identifier.name}(${args.join(',')})` : undefined;
  }
  return undefined;
}

function canonKeyOf(k: Node, allowExpression = false): { canon: string; key: KeyKind } | null {
  if (k instanceof IdentifierNode) return { canon: `id:${k.name}`, key: { kind: 'id', name: k.name } };
  if (k instanceof NullaryOpNode
    && (k.operator === NullaryOperator.MSG_SENDER || k.operator === NullaryOperator.TX_ORIGIN)) {
    return { canon: `nullary:${k.operator}`, key: { kind: 'nullary', op: k.operator } };
  }
  if (allowExpression && k instanceof LiteralNode) {
    const canon = literalCanon(k);
    return { canon: `literal:${canon}`, key: { kind: 'literal', node: cloneNode(k), canon } };
  }
  if (allowExpression && k instanceof ExpressionNode) {
    const canon = expressionCanon(k);
    if (canon) return {
      canon: `expression:${canon}`,
      key: { kind: 'expression', node: cloneNode(k), canon },
    };
  }
  return null;
}

function buildKeyNode(key: KeyKind, loc: Node['location']): Node {
  const n: Node = key.kind === 'id'
    ? new IdentifierNode(key.name)
    : key.kind === 'nullary' ? new NullaryOpNode(key.op) : cloneNode(key.node);
  n.location = loc;
  return n;
}

function keyNodeMatches(k: Node | undefined, key: KeyKind): boolean {
  if (!k) return false;
  if (key.kind === 'id') return k instanceof IdentifierNode && k.name === key.name;
  if (key.kind === 'nullary') return k instanceof NullaryOpNode && k.operator === key.op;
  if (key.kind === 'literal') return k instanceof LiteralNode && literalCanon(k) === key.canon;
  return expressionCanon(k) === key.canon;
}

function expressionParameterDependencies(node: Node, out = new Set<string>()): Set<string> {
  if (node instanceof IdentifierNode) out.add(node.name);
  if (node instanceof FunctionCallNode) {
    for (const parameter of node.parameters) expressionParameterDependencies(parameter, out);
    return out;
  }
  for (const [field, value] of Object.entries(node)) {
    if (['location', 'resolvedFunction', 'functionReference', 'definition', 'collection', 'symbolTable',
      'stateVariable', 'type'].includes(field)) continue;
    if (value instanceof Node) expressionParameterDependencies(value, out);
    else if (Array.isArray(value)) {
      for (const item of value) if (item instanceof Node) expressionParameterDependencies(item, out);
    }
  }
  return out;
}

function mutatesExpressionDependency(root: Node, dependencies: ReadonlySet<string>): boolean {
  let mutated = false;
  const scan = (node: Node): void => {
    if (mutated) return;
    if ((node instanceof AssignNode && dependencies.has(node.identifier.name))
      || (node instanceof VariableDefinitionNode && dependencies.has(node.name))
      || (node instanceof ArrayAssignNode && dependencies.has(node.name))
      || (node instanceof ArrayPushNode && dependencies.has(node.name))
      || (node instanceof ArrayPopNode && dependencies.has(node.name))) {
      mutated = true;
      return;
    }
    for (const [field, value] of Object.entries(node)) {
      if (['location', 'resolvedFunction', 'functionReference', 'definition', 'collection', 'symbolTable',
        'stateVariable', 'type'].includes(field)) continue;
      if (value instanceof Node) scan(value);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) scan(item);
    }
  };
  scan(root);
  return mutated;
}

/** Whether the function-wide entry cache can evaluate this key once without changing its source meaning. */
export function isFunctionEntryInvariantMappingKey(
  key: Node,
  body: Node,
  publicParameterNames: ReadonlySet<string>,
): boolean {
  if (!canonKeyOf(key, true)) return false;
  if (key instanceof LiteralNode || key instanceof NullaryOpNode) return true;
  const dependencies = expressionParameterDependencies(key);
  return [...dependencies].every((name) => publicParameterNames.has(name))
    && !mutatesExpressionDependency(body, dependencies);
}

type EntryInfo = {
  mapping: string; keys: KeyKind[]; count: number; inLoop: boolean; bad: boolean;
  written: boolean; readAfterWrite: boolean; fromModifier?: string;
};

type ScalarMappingInfo = { valueType: Type; depth: number };

/**
 * A vmap (sorted) mapping ARRAY value cannot be written more than once to the SAME entry in one call: each write is its
 * own emitSortedValueUpsert, which co-spends the entry NFT + emits one output, so two of them double-spend the input
 * and the covenant OP_VERIFYs fail. This is the RUNTIME analog of CacheDynamicArrayInLoop (read-once/mutate-local/
 * write-once for STATE dynamic arrays), extended to a keyed MAPPING ENTRY m[k]. For any entry written via array ops
 * more than once (a loop `for(..) m[k][j]=v`, consecutive `m[k][0]=x; m[k][2]=z`, a conditional, a `.push` fold),
 * the entry is cached FUNCTION-wide:
 *   T[] __vmapcache_N = m[k];   <every m[k] access -> __vmapcache_N>   m[k] = __vmapcache_N;   // flushed before each return
 * The loop stays a RUNTIME loop over the LOCAL array (one covenant body, byte-limit safe); reads of m[k] redirect to
 * the local so read-after-write (`m[k][j]=m[k][j-1]+1`) reads the value being built; the vmap write is a single upsert.
 * Runs pre-semantic so the redirected accesses resolve as a local array (after DesugarReturnInLoop, so in-loop
 * returns are already flag+break). Restricted to be SOUND: single-key array-valued mapping, key `k` a simple
 * identifier NOT reassigned in the function (else the entry differs - the per-iteration sorted-insert case, left to
 * fail closed), and no whole-entry assign / delete of that entry (only element / push / pop writes + reads).
 */
export default class CacheMappingEntryInLoop extends AstTraversal {
  private arrayMappings: Map<string, Type> = new Map(); // single-key array-valued mapping name -> array value type
  // Single-key vmap (sorted) SCALAR mapping name -> value type. A scalar vmap entry written more than once / in a loop
  // to the SAME key (`for(i) balance[k] -= amts[i]`) hits the same wall as arrays: each `m[k]=v` is its own upsert
  // that co-spends the entry NFT + emits one output, so a second one double-spends the (already-spent) input and
  // reverts. Read-once/mutate-local/write-once (a single upsert) fixes it. Gated on `sorted` (the default entry
  // model has its own write-in-loop handling); depth 1 only.
  private scalarMappings: Map<string, ScalarMappingInfo> = new Map();
  private structMappings: Map<string, StructType> = new Map();
  private counter = 0;

  constructor(private routeSnapshotKeysOnly = false) { super(); }

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.arrayMappings = new Map();
    this.scalarMappings = new Map();
    this.structMappings = new Map();
    for (const col of node.collections) {
      if (col.type instanceof MappingType) {
        if (col.depth === 1 && col.innermostValueType instanceof ArrayType) {
          this.arrayMappings.set(col.name, col.innermostValueType);
        } else if (col.depth === 1 && col.sorted && col.innermostValueType instanceof StructType) {
          this.structMappings.set(col.name, col.innermostValueType);
        } else if (col.sorted && !(col.innermostValueType instanceof ArrayType)
          && !(col.innermostValueType instanceof StructType)) {
          this.scalarMappings.set(col.name, { valueType: col.innermostValueType, depth: col.depth });
        }
      }
    }
    if (this.arrayMappings.size === 0 && this.scalarMappings.size === 0 && this.structMappings.size === 0) return node;
    for (const fn of [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef]) {
      // Collection-journal handlers are deliberately storage-free value
      // functions. Their original semantic metadata may still reference the
      // pre-lowered body until the next symbol pass; never synthesize physical
      // entry caching inside that handler.
      if (fn?.body && !fn.collectionJournal) this.transformFunction(fn);
    }
    return node;
  }

  private transformFunction(fn: FunctionDefinitionNode): void {
    for (const e of this.collectCacheableEntries(fn.body)) {
      if (this.routeSnapshotKeysOnly && e.keys.length === 1
        && !e.keys.some((key) => key.kind === 'expression')) continue;
      const local = `${PREFIX}${e.mapping}_${this.counter++}`;
      const dirty = `${local}_dirty`;
      new EntryRedirect(e.mapping, e.keys, local, dirty, e.valueType).visit(fn.body);
      const cacheRead = new MappingAccessNode(
        e.mapping,
        e.keys.map((key) => buildKeyNode(key, fn.body.location) as ExpressionNode),
      ); // T local = m[k1][k2];
      cacheRead.fromModifier = e.fromModifier;
      cacheRead.location = fn.body.location;
      const cache = new VariableDefinitionNode(e.valueType, [], local, cacheRead);
      cache.location = fn.body.location;
      const dirtyInit = new BoolLiteralNode(false);
      dirtyInit.location = fn.body.location;
      const dirtyLocal = new VariableDefinitionNode(PrimitiveType.BOOL, [], dirty, dirtyInit);
      dirtyLocal.location = fn.body.location;
      let stmts = this.insertFlushesBeforeReturns(fn.body.statements ?? [], e.mapping, e.keys, local, dirty);
      if (stmts.length === 0 || !(stmts[stmts.length - 1] instanceof ReturnNode)) {
        stmts = [...stmts, this.makeFlush(e.mapping, e.keys, local, dirty, fn.body.location, e.fromModifier)];
      }
      fn.body.statements = [cache, dirtyLocal, ...stmts];
    }
  }

  // Entries m[k] written via array ops (element/push/pop) more than once OR inside a loop, with an INVARIANT key
  // (identifier not reassigned, or msg.sender/tx.origin) and no whole-entry assign/delete. Those need
  // read-once/mutate-local/write-once.
  private collectCacheableEntries(
    body: Node,
  ): Array<{ mapping: string; keys: KeyKind[]; valueType: Type; fromModifier?: string }> {
    const info = new Map<string, EntryInfo>();
    const get = (mapping: string, rawKeys: Node | Node[], allowExpression = false): EntryInfo | null => {
      const keys = Array.isArray(rawKeys) ? rawKeys : [rawKeys];
      const canonical = keys.map((key) => canonKeyOf(key, allowExpression));
      if (canonical.some((key) => key === null)) return null;
      const resolved = canonical as { canon: string; key: KeyKind }[];
      const ek = `${mapping}|${resolved.map((key) => key.canon).join('|')}`;
      let e = info.get(ek);
      if (!e) {
        e = {
          mapping, keys: resolved.map((key) => key.key), count: 0, inLoop: false, bad: false,
          written: false, readAfterWrite: false,
        };
        info.set(ek, e);
      }
      return e;
    };
    const scan = (n: Node, inLoop: boolean): void => {
      if (!n) return;
      // Before symbol resolution, source-level `m[k] = value` is still represented as ArrayAssignNode. Account for
      // that form here; the MappingAssignNode arm handles nodes synthesized by earlier lowering passes.
      if (n instanceof ArrayAssignNode && this.scalarMappings.has(n.name)) {
        const e = get(n.name, n.index, true);
        if (e) {
          e.fromModifier ??= n.fromModifier;
          e.count += 1;
          e.written = true;
          if (inLoop) e.inLoop = true;
        }
      }
      if (n instanceof ArrayAccessNode && n.array instanceof IdentifierNode
        && this.scalarMappings.has(n.array.name)) {
        const e = get(n.array.name, n.index, true);
        if (e?.written) e.readAfterWrite = true;
      }
      // X19: the same read written `this.m[k]` (or produced by an earlier lowering pass) is a MappingAccessNode,
      // not an ArrayAccessNode. Without this arm the two spellings of one read-modify-write lowered differently -
      // the bare one read-once/mutate-local/write-once, the dotted one in place - and published different
      // bytecode and a different entry-access order for byte-identical source intent.
      if (n instanceof MappingAccessNode && this.scalarMappings.has(n.name)
        && n.keys.length === this.scalarMappings.get(n.name)!.depth) {
        const e = get(n.name, n.keys, true);
        if (e?.written) e.readAfterWrite = true;
      }
      if (n instanceof MappingAssignNode && this.arrayMappings.has(n.name)) {
        const k0 = n.keys[0];
        // element write `m[k][j]=v` is keys=[k,j] pre-semantic; push/pop are keys=[k] + flag; whole assign is keys=[k].
        const isElementWrite = n.arrayIndex !== undefined || (n.keys.length === 2 && !n.arrayPush && !n.arrayPop);
        // canonKeyOf accepts stable identifiers and compile-time literal keys. Both identify one invariant entry
        // across the loop; literal string keys are common after inlining `Lib.set(data["abc"])`.
        const elementType = (this.arrayMappings.get(n.name) as ArrayType).elementType;
        const e = get(n.name, k0, !(elementType instanceof StructType));
        if (e) {
          if (n.arrayPush || n.arrayPop || isElementWrite) {
            e.count += 1;
            if (inLoop) e.inLoop = true;
          } else {
            e.bad = true; // whole-entry assign m[k]=v: cache reassign not handled -> do not cache this entry
          }
        }
      }
      if (n instanceof MappingDeleteNode && this.arrayMappings.has(n.name)) {
        const elementType = (this.arrayMappings.get(n.name) as ArrayType).elementType;
        const e = get(n.name, n.keys[0], !(elementType instanceof StructType)); if (e) e.bad = true;
      }
      // Scalar vmap mapping: a WHOLE-entry write `m[k] = expr` (an RMW `m[k] -= v` desugars to this) to an INVARIANT
      // key (identifier or msg.sender/tx.origin) is the cacheable form (read once -> mutate local -> one upsert). A
      // delete marks it bad (needs nullify, not a plain reassign). Any array-op on a scalar mapping should not occur;
      // if it does, mark bad (be safe).
      if (n instanceof MappingAssignNode && this.scalarMappings.has(n.name)) {
        const mapping = this.scalarMappings.get(n.name)!;
        const e = n.keys.length === mapping.depth ? get(n.name, n.keys, true) : null;
        if (e) {
          e.fromModifier ??= n.fromModifier;
          if (n.arrayIndex === undefined && !n.arrayPush && !n.arrayPop) {
            e.count += 1;
            e.written = true;
            if (inLoop) e.inLoop = true;
          } else {
            e.bad = true;
          }
        }
      }
      if (n instanceof MappingDeleteNode && this.scalarMappings.has(n.name)) {
        const mapping = this.scalarMappings.get(n.name)!;
        const e = n.keys.length === mapping.depth ? get(n.name, n.keys, true) : null;
        if (e) e.bad = true;
      }
      if (n instanceof MappingFieldAssignNode && this.structMappings.has(n.name)) {
        const e = get(n.name, n.keys[0]);
        if (e) {
          e.fromModifier ??= n.fromModifier;
          e.count += 1;
          e.written = true;
          if (inLoop) e.inLoop = true;
        }
      }
      const nowLoop = inLoop || n instanceof WhileNode || n instanceof DoWhileNode;
      for (const key of Object.keys(n)) {
        // Semantic metadata contains back-references into function definitions,
        // symbol tables, and collection declarations. Those are not executable
        // children of this function body; following them can attribute a
        // callee's or an earlier pre-lowered body's storage operations to the
        // current function and synthesize phantom cache reads/writes.
        if (['location', 'resolvedFunction', 'functionReference', 'definition',
          'collection', 'symbolTable', 'stateVariable'].includes(key)) continue;
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) scan(v, nowLoop);
        else if (Array.isArray(v)) for (const el of v) if (el instanceof Node) scan(el, nowLoop);
      }
    };
    scan(body, false);
    const out: Array<{ mapping: string; keys: KeyKind[]; valueType: Type; fromModifier?: string }> = [];
    for (const e of info.values()) {
      // A struct entry needs the local rebuild path for even one field write, but a read-only struct access must
      // stay read-only. Treating every struct entry as cacheable synthesized an unconditional whole-entry flush
      // for plain reads, widening their ABI operation from `read` to `read,write` and requiring phantom outputs.
      if (e.bad || !(e.inLoop || e.count >= 2 || e.readAfterWrite
        || (e.written && this.structMappings.has(e.mapping)))) continue;
      // key must be invariant across the function: an identifier must not be reassigned; nullary keys always are.
      if (e.keys.some((key) => key.kind === 'id'
        && (this.assignsName(body, key.name) || this.declaresNameInsideLoop(body, key.name)))) continue;
      const expressionKeys = e.keys.filter((key): key is Extract<KeyKind, { kind: 'expression' }> =>
        key.kind === 'expression');
      if (expressionKeys.length > 0) {
        const dependencies = new Set(expressionKeys.flatMap((key) =>
          [...expressionParameterDependencies(key.node)]));
        // Expression keys are hoisted to the function entry, so every runtime dependency must already be in
        // scope there and remain immutable for the complete invocation. In practice these are public arguments;
        // local aliases can be supported later by moving this cache to the loop boundary rather than pretending
        // they exist at function entry.
        if (mutatesExpressionDependency(body, dependencies)) continue;
      }
      out.push({
        mapping: e.mapping, keys: e.keys,
        valueType: (this.arrayMappings.get(e.mapping) ?? this.scalarMappings.get(e.mapping)?.valueType
          ?? this.structMappings.get(e.mapping))!,
        fromModifier: e.fromModifier,
      });
    }
    return out;
  }

  /**
   * A tuple/local declared inside the loop is a fresh per-iteration value even when no AssignNode reassigns it.
   * Treating that identifier as invariant hoists `m[key]` before the loop, outside the declaration's lexical
   * scope (Kashi cook's `(share, address to, ...) = abi.decode(datas[i], ...)` became a function-top
   * `userCollateralShare[to]` read and failed as an undefined reference).
   */
  private declaresNameInsideLoop(root: Node, name: string): boolean {
    let found = false;
    const walk = (node: Node, inLoop: boolean): void => {
      if (found) return;
      const nowLoop = inLoop || node instanceof WhileNode || node instanceof DoWhileNode;
      if (nowLoop && node instanceof VariableDefinitionNode && node.name === name) { found = true; return; }
      if (nowLoop && node instanceof TupleAssignmentNode
        && node.elements.some((element) => !element.skip && !element.existing && element.name === name)) {
        found = true; return;
      }
      for (const key of Object.keys(node)) {
        if (['location', 'resolvedFunction', 'functionReference', 'definition',
          'collection', 'symbolTable', 'stateVariable'].includes(key)) continue;
        const child = (node as unknown as Record<string, unknown>)[key];
        if (child instanceof Node) walk(child, nowLoop);
        else if (Array.isArray(child)) for (const item of child) if (item instanceof Node) walk(item, nowLoop);
      }
    };
    walk(root, false);
    return found;
  }

  private makeFlush(
    mapping: string, keys: KeyKind[], local: string, dirty: string, loc: Node['location'], fromModifier?: string,
  ): BranchNode {
    const rhs = new IdentifierNode(local);
    rhs.location = loc;
    const keyNodes = keys.map((key) => buildKeyNode(key, loc) as ExpressionNode);
    const flush = new MappingAssignNode(mapping, keyNodes, rhs); // m[k1][k2] = local
    flush.fromModifier = fromModifier;
    flush.location = loc;
    const flushBlock = new BlockNode([flush]);
    flushBlock.location = loc;
    const condition = new IdentifierNode(dirty);
    condition.location = loc;
    const branch = new BranchNode(condition, flushBlock);
    branch.location = loc;
    // The not-dirty arm is a physical no-op. If-converting it to a preserve write would still consume and recreate
    // chunk-backed resources, defeating the dirty bit and forcing outputs for paths which never changed the entry.
    branch.preserveConditionalEntryWrites = true;
    return branch;
  }

  // Insert a `m[k] = local` flush before every return (recursing into if/switch/try/blocks, NOT loops - in-loop
  // returns were already rewritten to flag+break by DesugarReturnInLoop). Mirrors CacheDynamicArrayInLoop.
  private insertFlushesBeforeReturns(
    stmts: StatementNode[], mapping: string, keys: KeyKind[], local: string, dirty: string,
  ): StatementNode[] {
    const rec = (s: StatementNode[]): StatementNode[] =>
      this.insertFlushesBeforeReturns(s ?? [], mapping, keys, local, dirty);
    const out: StatementNode[] = [];
    for (const stmt of stmts) {
      if (stmt instanceof ReturnNode) {
        out.push(this.makeFlush(mapping, keys, local, dirty, stmt.location));
        out.push(stmt);
        continue;
      }
      if (stmt instanceof BranchNode) {
        stmt.ifBlock.statements = rec(stmt.ifBlock.statements ?? []);
        if (stmt.elseBlock) stmt.elseBlock.statements = rec(stmt.elseBlock.statements ?? []);
      } else if (stmt instanceof SwitchNode) {
        for (const c of stmt.cases) c.body.statements = rec(c.body.statements ?? []);
        if (stmt.defaultCase) stmt.defaultCase.statements = rec(stmt.defaultCase.statements ?? []);
      } else if (stmt instanceof TryCatchNode) {
        stmt.tryBlock.statements = rec(stmt.tryBlock.statements ?? []);
        for (const cc of stmt.catchClauses) cc.block.statements = rec(cc.block.statements ?? []);
      } else if (stmt instanceof UncheckedNode) {
        stmt.block.statements = rec(stmt.block.statements ?? []);
      } else if (stmt instanceof BlockNode) {
        stmt.statements = rec(stmt.statements ?? []);
      }
      out.push(stmt);
    }
    return out;
  }

  // Does `node` contain an assignment / declaration that writes the identifier `name` (so the key is not invariant)?
  private assignsName(node: Node, name: string): boolean {
    let found = false;
    const scan = (n: Node): void => {
      if (!n || found) return;
      if (n instanceof AssignNode && n.identifier instanceof IdentifierNode && n.identifier.name === name) found = true;
      if (n instanceof VariableDefinitionNode && n.name === name) found = true;
      for (const key of Object.keys(n)) {
        if (found || ['location', 'resolvedFunction', 'functionReference', 'definition',
          'collection', 'symbolTable', 'stateVariable'].includes(key)) continue;
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) scan(v);
        else if (Array.isArray(v)) for (const e of v) if (e instanceof Node) scan(e);
      }
    };
    scan(node);
    return found;
  }
}

// Redirects every access of the entry m[k] (mapping, simple key identifier) to the local array `local`: WRITES
// m[k][j]=v / .push / .pop are MappingAssignNodes -> local array ops; READS m[k] / m[k][j] are ArrayAccessNodes
// (bottoming out at IdentifierNode(m)) -> local / local[j].
class EntryRedirect extends AstTraversal {
  constructor(
    private mapping: string, private keys: KeyKind[], private local: string, private dirty: string,
    private valueType: Type,
  ) { super(); }

  private withDirty(write: StatementNode, loc: Node['location']): BlockNode {
    const dirty = new IdentifierNode(this.dirty);
    dirty.location = loc;
    const value = new BoolLiteralNode(true);
    value.location = loc;
    const mark = new AssignNode(dirty, value);
    mark.location = loc;
    const block = new BlockNode([write, mark]);
    block.location = loc;
    return block;
  }

  private entryIndex(node: MappingAccessNode | MappingAssignNode): Node | undefined {
    if (node.arrayIndex) return node.arrayIndex;
    if (node.keys.length > this.keys.length) return node.keys[this.keys.length];
    return undefined;
  }

  private matches(name: string, keys: Node[]): boolean {
    return name === this.mapping && keys.length >= this.keys.length
      && this.keys.every((key, index) => keyNodeMatches(keys[index], key));
  }

  // A READ `m[k]` is ArrayAccessNode(IdentifierNode(m), <key>); `m[k][j]` nests it. Recurse first (inner
  // m[k] -> local), then collapse m[k] to `local`; the outer m[k][j] falls out as a local element read local[j].
  visitArrayAccess(node: ArrayAccessNode): Node {
    const visited = super.visitArrayAccess(node) as ArrayAccessNode;
    if (this.keys.length === 1 && visited instanceof ArrayAccessNode
      && visited.array instanceof IdentifierNode && (visited.array as IdentifierNode).name === this.mapping
      && keyNodeMatches(visited.index, this.keys[0])) {
      const id = new IdentifierNode(this.local);
      id.location = visited.location;
      return id;
    }
    return visited;
  }

  visitMappingAccess(node: MappingAccessNode): Node {
    const visited = super.visitMappingAccess(node) as MappingAccessNode;
    if (visited instanceof MappingAccessNode && this.matches(visited.name, visited.keys)) {
      const idx = this.entryIndex(visited);
      if (idx) { const acc = new MappingAccessNode(this.local, [idx]); acc.location = visited.location; return acc; }
      const id = new IdentifierNode(this.local); id.location = visited.location; return id;
    }
    return visited;
  }

  visitMappingAssign(node: MappingAssignNode): Node {
    const visited = super.visitMappingAssign(node) as MappingAssignNode;
    if (visited instanceof MappingAssignNode && this.matches(visited.name, visited.keys)) {
      if (visited.arrayPush) {
        const p = new ArrayPushNode(this.local, visited.expression);
        p.noArg = visited.noArg;
        p.location = visited.location;
        return this.withDirty(p, visited.location);
      }
      if (visited.arrayPop) {
        const p = new ArrayPopNode(this.local);
        p.location = visited.location;
        return this.withDirty(p, visited.location);
      }
      const idx = this.entryIndex(visited);
      if (idx) {
        const a = new ArrayAssignNode(this.local, idx, visited.expression);
        a.location = visited.location;
        return this.withDirty(a, visited.location);
      }
      // Whole-entry write `m[k] = expr` -> `local = expr`. Only fires for a CACHED SCALAR entry: an array entry with
      // a whole write is marked `bad` (never cached), so an array EntryRedirect never reaches here for its own m[k].
      const id = new IdentifierNode(this.local); id.location = visited.location;
      const asgn = new AssignNode(id, visited.expression);
      asgn.location = visited.location;
      return this.withDirty(asgn, visited.location);
    }
    return visited;
  }

  visitMappingFieldAssign(node: MappingFieldAssignNode): Node {
    const visited = super.visitMappingFieldAssign(node) as MappingFieldAssignNode;
    if (!(visited instanceof MappingFieldAssignNode) || !this.matches(visited.name, visited.keys)) return visited;
    if (!(this.valueType instanceof StructType) || (visited.trailingMembers?.length ?? 0) > 0) return visited;
    const args = this.valueType.fields.map((field) => {
      if (field.name === visited.fieldName) return cloneNode(visited.expression) as typeof visited.expression;
      const base = new IdentifierNode(this.local); base.location = visited.location;
      const read = new FieldAccessNode(base, field.name); read.location = visited.location;
      return read;
    });
    const ctorName = new IdentifierNode(this.valueType.name); ctorName.location = visited.location;
    const rebuilt = new FunctionCallNode(ctorName, args); rebuilt.location = visited.location;
    const local = new IdentifierNode(this.local); local.location = visited.location;
    const write = new AssignNode(local, rebuilt); write.location = visited.location;
    return this.withDirty(write, visited.location);
  }

  visitArrayAssign(node: ArrayAssignNode): Node {
    const visited = super.visitArrayAssign(node) as ArrayAssignNode;
    if (this.keys.length === 1 && visited instanceof ArrayAssignNode
      && visited.name === this.mapping && keyNodeMatches(visited.index, this.keys[0])) {
      const id = new IdentifierNode(this.local); id.location = visited.location;
      const asgn = new AssignNode(id, visited.value);
      asgn.location = visited.location;
      return this.withDirty(asgn, visited.location);
    }
    return visited;
  }
}
