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
  ArrayAccessNode,
  ArrayAssignNode,
  ArrayPushNode,
  ArrayPopNode,
  IdentifierNode,
  NullaryOpNode,
  VariableDefinitionNode,
  AssignNode,
} from '../ast/AST.js';
import { NullaryOperator } from '../ast/Operator.js';
import { MappingType, ArrayType, Type } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';

const PREFIX = '__c2cache_';

// A mapping key we can cache on. Only INVARIANT keys qualify: a simple identifier (invariance re-checked via
// assignsName), or a nullary tx-derived address (msg.sender / tx.origin - inherently invariant; nothing reassigns
// them and they read identically every iteration). `for(i) bal[msg.sender] -= amts[i]` (a batch debit from the
// caller - the same-key half of an ERC-20 multiTransfer) is the driving case; its flush is a single msg.sender
// C2 write, which is proven (MsgSenderC2).
type KeyKind = { kind: 'id'; name: string } | { kind: 'nullary'; op: NullaryOperator };

// canon groups accesses of the same entry; null = an unsupported key (arr[i], m[k2], expression) -> not cached, so
// the multi-write / loop write falls through to the fail-closed sorted-codegen path (sound, never a silent skip).
function canonKeyOf(k: Node): { canon: string; key: KeyKind } | null {
  if (k instanceof IdentifierNode) return { canon: `id:${k.name}`, key: { kind: 'id', name: k.name } };
  if (k instanceof NullaryOpNode
    && (k.operator === NullaryOperator.MSG_SENDER || k.operator === NullaryOperator.TX_ORIGIN)) {
    return { canon: `nullary:${k.operator}`, key: { kind: 'nullary', op: k.operator } };
  }
  return null;
}

function buildKeyNode(key: KeyKind, loc: Node['location']): Node {
  const n: Node = key.kind === 'id' ? new IdentifierNode(key.name) : new NullaryOpNode(key.op);
  n.location = loc;
  return n;
}

function keyNodeMatches(k: Node | undefined, key: KeyKind): boolean {
  if (!k) return false;
  if (key.kind === 'id') return k instanceof IdentifierNode && k.name === key.name;
  return k instanceof NullaryOpNode && k.operator === key.op;
}

type EntryInfo = {
  mapping: string; key: KeyKind; count: number; inLoop: boolean; bad: boolean;
  written: boolean; readAfterWrite: boolean; fromModifier?: string;
};

/**
 * A C2 (sorted) mapping ARRAY value cannot be written more than once to the SAME entry in one call: each write is its
 * own emitSortedValueUpsert, which co-spends the entry NFT + emits one output, so two of them double-spend the input
 * and the covenant OP_VERIFYs fail. This is the RUNTIME analog of CacheDynamicArrayInLoop (read-once/mutate-local/
 * write-once for STATE dynamic arrays), extended to a keyed MAPPING ENTRY m[k]. For any entry written via array ops
 * more than once (a loop `for(..) m[k][j]=v`, consecutive `m[k][0]=x; m[k][2]=z`, a conditional, a `.push` fold),
 * the entry is cached FUNCTION-wide:
 *   T[] __c2cache_N = m[k];   <every m[k] access -> __c2cache_N>   m[k] = __c2cache_N;   // flushed before each return
 * The loop stays a RUNTIME loop over the LOCAL array (one covenant body, byte-limit safe); reads of m[k] redirect to
 * the local so read-after-write (`m[k][j]=m[k][j-1]+1`) reads the value being built; the C2 write is a single upsert.
 * Runs pre-semantic so the redirected accesses resolve as a local array (after DesugarReturnInLoop, so in-loop
 * returns are already flag+break). Restricted to be SOUND: single-key array-valued mapping, key `k` a simple
 * identifier NOT reassigned in the function (else the entry differs - the per-iteration sorted-insert case, left to
 * fail closed), and no whole-entry assign / delete of that entry (only element / push / pop writes + reads).
 */
export default class CacheMappingEntryInLoop extends AstTraversal {
  private arrayMappings: Map<string, Type> = new Map(); // single-key array-valued mapping name -> array value type
  // Single-key C2 (sorted) SCALAR mapping name -> value type. A scalar C2 entry written more than once / in a loop
  // to the SAME key (`for(i) balance[k] -= amts[i]`) hits the same wall as arrays: each `m[k]=v` is its own upsert
  // that co-spends the entry NFT + emits one output, so a second one double-spends the (already-spent) input and
  // reverts. Read-once/mutate-local/write-once (a single upsert) fixes it. Gated on `sorted` (the default entry
  // model has its own write-in-loop handling); depth 1 only.
  private scalarMappings: Map<string, Type> = new Map();
  private counter = 0;

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.arrayMappings = new Map();
    this.scalarMappings = new Map();
    for (const col of node.collections) {
      if (col.type instanceof MappingType && col.depth === 1) {
        if (col.innermostValueType instanceof ArrayType) this.arrayMappings.set(col.name, col.innermostValueType);
        else if (col.sorted) this.scalarMappings.set(col.name, col.innermostValueType);
      }
    }
    if (this.arrayMappings.size === 0 && this.scalarMappings.size === 0) return node;
    for (const fn of [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef]) {
      if (fn?.body) this.transformFunction(fn);
    }
    return node;
  }

  private transformFunction(fn: FunctionDefinitionNode): void {
    for (const e of this.collectCacheableEntries(fn.body)) {
      const local = `${PREFIX}${e.mapping}_${this.counter++}`;
      new EntryRedirect(e.mapping, e.key, local).visit(fn.body);
      const cacheRead = new MappingAccessNode(e.mapping, [buildKeyNode(e.key, fn.body.location)]); // T[] local = m[k];
      cacheRead.fromModifier = e.fromModifier;
      cacheRead.location = fn.body.location;
      const cache = new VariableDefinitionNode(e.valueType, [], local, cacheRead);
      cache.location = fn.body.location;
      let stmts = this.insertFlushesBeforeReturns(fn.body.statements ?? [], e.mapping, e.key, local);
      if (stmts.length === 0 || !(stmts[stmts.length - 1] instanceof ReturnNode)) {
        stmts = [...stmts, this.makeFlush(e.mapping, e.key, local, fn.body.location, e.fromModifier)];
      }
      fn.body.statements = [cache, ...stmts];
    }
  }

  // Entries m[k] written via array ops (element/push/pop) more than once OR inside a loop, with an INVARIANT key
  // (identifier not reassigned, or msg.sender/tx.origin) and no whole-entry assign/delete. Those need
  // read-once/mutate-local/write-once.
  private collectCacheableEntries(
    body: Node,
  ): Array<{ mapping: string; key: KeyKind; valueType: Type; fromModifier?: string }> {
    const info = new Map<string, EntryInfo>();
    const get = (mapping: string, k: Node): EntryInfo | null => {
      const ck = canonKeyOf(k);
      if (!ck) return null;
      const ek = `${mapping}|${ck.canon}`;
      let e = info.get(ek);
      if (!e) {
        e = {
          mapping, key: ck.key, count: 0, inLoop: false, bad: false, written: false, readAfterWrite: false,
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
        const e = get(n.name, n.index);
        if (e) {
          e.fromModifier ??= n.fromModifier;
          e.count += 1;
          e.written = true;
          if (inLoop) e.inLoop = true;
        }
      }
      if (n instanceof ArrayAccessNode && n.array instanceof IdentifierNode
        && this.scalarMappings.has(n.array.name)) {
        const e = get(n.array.name, n.index);
        if (e?.written) e.readAfterWrite = true;
      }
      if (n instanceof MappingAssignNode && this.arrayMappings.has(n.name)) {
        const k0 = n.keys[0];
        // element write `m[k][j]=v` is keys=[k,j] pre-semantic; push/pop are keys=[k] + flag; whole assign is keys=[k].
        const isElementWrite = n.arrayIndex !== undefined || (n.keys.length === 2 && !n.arrayPush && !n.arrayPop);
        if (k0 instanceof IdentifierNode) { // array entries: identifier key only (single msg.sender array write unproven)
          const e = get(n.name, k0);
          if (e) {
            if (n.arrayPush || n.arrayPop || isElementWrite) {
              e.count += 1;
              if (inLoop) e.inLoop = true;
            } else {
              e.bad = true; // whole-entry assign m[k]=v: cache reassign not handled -> do not cache this entry
            }
          }
        }
      }
      if (n instanceof MappingDeleteNode && this.arrayMappings.has(n.name) && n.keys[0] instanceof IdentifierNode) {
        const e = get(n.name, n.keys[0]); if (e) e.bad = true;
      }
      // Scalar C2 mapping: a WHOLE-entry write `m[k] = expr` (an RMW `m[k] -= v` desugars to this) to an INVARIANT
      // key (identifier or msg.sender/tx.origin) is the cacheable form (read once -> mutate local -> one upsert). A
      // delete marks it bad (needs nullify, not a plain reassign). Any array-op on a scalar mapping should not occur;
      // if it does, mark bad (be safe).
      if (n instanceof MappingAssignNode && this.scalarMappings.has(n.name)) {
        const e = get(n.name, n.keys[0]);
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
        const e = get(n.name, n.keys[0]); if (e) e.bad = true;
      }
      const nowLoop = inLoop || n instanceof WhileNode || n instanceof DoWhileNode;
      for (const key of Object.keys(n)) {
        if (key === 'location') continue;
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) scan(v, nowLoop);
        else if (Array.isArray(v)) for (const el of v) if (el instanceof Node) scan(el, nowLoop);
      }
    };
    scan(body, false);
    const out: Array<{ mapping: string; key: KeyKind; valueType: Type; fromModifier?: string }> = [];
    for (const e of info.values()) {
      if (e.bad || !(e.inLoop || e.count >= 2 || e.readAfterWrite)) continue;
      // key must be invariant across the function: an identifier must not be reassigned; nullary keys always are.
      if (e.key.kind === 'id' && this.assignsName(body, e.key.name)) continue;
      out.push({
        mapping: e.mapping, key: e.key,
        valueType: (this.arrayMappings.get(e.mapping) ?? this.scalarMappings.get(e.mapping))!,
        fromModifier: e.fromModifier,
      });
    }
    return out;
  }

  private makeFlush(
    mapping: string, key: KeyKind, local: string, loc: Node['location'], fromModifier?: string,
  ): MappingAssignNode {
    const rhs = new IdentifierNode(local);
    rhs.location = loc;
    const keyNode = buildKeyNode(key, loc);
    const flush = new MappingAssignNode(mapping, [keyNode], rhs); // m[k] = local
    flush.fromModifier = fromModifier;
    flush.location = loc;
    return flush;
  }

  // Insert a `m[k] = local` flush before every return (recursing into if/switch/try/blocks, NOT loops - in-loop
  // returns were already rewritten to flag+break by DesugarReturnInLoop). Mirrors CacheDynamicArrayInLoop.
  private insertFlushesBeforeReturns(
    stmts: StatementNode[], mapping: string, key: KeyKind, local: string,
  ): StatementNode[] {
    const rec = (s: StatementNode[]): StatementNode[] => this.insertFlushesBeforeReturns(s ?? [], mapping, key, local);
    const out: StatementNode[] = [];
    for (const stmt of stmts) {
      if (stmt instanceof ReturnNode) {
        out.push(this.makeFlush(mapping, key, local, stmt.location));
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
        if (key === 'location' || found) continue;
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
  constructor(private mapping: string, private key: KeyKind, private local: string) { super(); }

  private entryIndex(node: MappingAccessNode | MappingAssignNode): Node | undefined {
    if (node.arrayIndex) return node.arrayIndex;
    if (node.keys.length === 2) return node.keys[1];
    return undefined;
  }

  private matches(name: string, keys: Node[]): boolean {
    return name === this.mapping && keys.length >= 1 && keyNodeMatches(keys[0], this.key);
  }

  // A READ `m[k]` is ArrayAccessNode(IdentifierNode(m), <key>); `m[k][j]` nests it. Recurse first (inner
  // m[k] -> local), then collapse m[k] to `local`; the outer m[k][j] falls out as a local element read local[j].
  visitArrayAccess(node: ArrayAccessNode): Node {
    const visited = super.visitArrayAccess(node) as ArrayAccessNode;
    if (visited instanceof ArrayAccessNode
      && visited.array instanceof IdentifierNode && (visited.array as IdentifierNode).name === this.mapping
      && keyNodeMatches(visited.index, this.key)) {
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
        return p;
      }
      if (visited.arrayPop) {
        const p = new ArrayPopNode(this.local);
        p.location = visited.location;
        return p;
      }
      const idx = this.entryIndex(visited);
      if (idx) {
        const a = new ArrayAssignNode(this.local, idx, visited.expression);
        a.location = visited.location;
        return a;
      }
      // Whole-entry write `m[k] = expr` -> `local = expr`. Only fires for a CACHED SCALAR entry: an array entry with
      // a whole write is marked `bad` (never cached), so an array EntryRedirect never reaches here for its own m[k].
      const id = new IdentifierNode(this.local); id.location = visited.location;
      const asgn = new AssignNode(id, visited.expression);
      asgn.location = visited.location;
      return asgn;
    }
    return visited;
  }

  visitArrayAssign(node: ArrayAssignNode): Node {
    const visited = super.visitArrayAssign(node) as ArrayAssignNode;
    if (visited instanceof ArrayAssignNode && visited.name === this.mapping && keyNodeMatches(visited.index, this.key)) {
      const id = new IdentifierNode(this.local); id.location = visited.location;
      const asgn = new AssignNode(id, visited.value);
      asgn.location = visited.location;
      return asgn;
    }
    return visited;
  }
}
