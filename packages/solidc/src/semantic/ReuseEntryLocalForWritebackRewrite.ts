import { ArrayType, StructType } from '@solidcash/utils';
import {
  Node,
  BlockNode,
  StatementNode,
  VariableDefinitionNode,
  MappingFieldAssignNode,
  MappingAssignNode,
  ArrayAccessNode,
  MappingAccessNode,
  FunctionCallNode,
  FieldAccessNode,
  IdentifierNode,
  ExpressionNode,
  AssignNode,
  BranchNode,
  WhileNode,
  DoWhileNode,
  CollectionIterationNode,
} from '../ast/AST.js';
import { cloneNode } from '../ast/clone.js';

/**
 * The pure rewrite step of `ReuseEntryLocalForWriteback`, factored out so the correctness invariant can be tested
 * without compiling bytecode or depending on a tree's byte-size baseline:
 *
 *   Escrow e = escrows[id];
 *   e.split = a; e.consensus = b;
 *   escrows[id].split = e.split; escrows[id].consensus = e.consensus; escrows[id].claimed = 1;
 *     -> Escrow e = escrows[id]; e.split = a; e.consensus = b;
 *        escrows[id] = Escrow(e.participant, e.releaser, e.amount, e.split, e.consensus, 1);
 *
 * Each successful fold replaces the field-write run (or the kernel's already-coalesced `__mefw` snapshot write)
 * with one whole-struct write sourced from the already-taken local, eliding exactly one entry re-read. The result
 * is byte-identical to the hand-written whole-struct write-back, so the unit test pins `elidedReads === 1` plus
 * byte-identity, never an absolute handler size.
 */
export type WritebackMapping = { keyCount: number; struct: StructType };

export interface RewriteStatementsResult {
  rewritten: StatementNode[];
  elidedReads: number;
}

type Read = { name: string; keys: ExpressionNode[]; struct: StructType; local: string };

export function rewriteStatements(
  statements: StatementNode[],
  mappings: Map<string, WritebackMapping>,
): RewriteStatementsResult {
  const out: StatementNode[] = [];
  let elidedReads = 0;
  let i = 0;
  while (i < statements.length) {
    const read = matchRead(statements[i], mappings);
    if (!read) { out.push(statements[i]); i += 1; continue; }

    // Forward-scan: track the write-back of `m[k]` and every field of `e` modified before it. The write-back is
    // either the un-coalesced field-write run (`m[k].f = ..`) or, under the kernel's early
    // CoalesceMappingEntryFieldWrites(true), an already-folded whole-struct write reading a `__mefw` snapshot.
    const run: MappingFieldAssignNode[] = [];
    const modified = new Set<string>();
    let runStart = -1;
    let runEnd = -1;
    let coalesced: { snapshot: string; write: MappingAssignNode } | undefined;
    let j = i + 1;
    let sound = true;
    while (j < statements.length && sound) {
      const stmt = statements[j];
      if (run.length > 0) {
        // The run has started; only consecutive run writes extend it.
        if (stmt instanceof MappingFieldAssignNode && isRunWrite(stmt, read)) {
          run.push(stmt);
          runEnd = j;
        } else {
          break;
        }
      } else if (stmt instanceof MappingFieldAssignNode && isRunWrite(stmt, read)) {
        run.push(stmt);
        runStart = j;
        runEnd = j;
      } else if (stmt instanceof AssignNode && stmt.identifier instanceof IdentifierNode
        && stmt.identifier.name === read.local) {
        // `e.x = v` desugars to a whole-struct rebuild `e = S(e.f0, .., v, ..)`; track the modified field. Any
        // other whole assignment (`e = other`) invalidates the snapshot.
        const field = modifiedLocalField(stmt, read);
        if (field !== undefined) modified.add(field);
        else sound = false;
      } else if (stmt instanceof BlockNode) {
        // `e.arr[i] = v` desugars to a BlockNode: snapshot the array field into a temp, mutate the temp, then
        // rebuild `e = S(.., temp, ..)`. Otherwise, a BlockNode may be the already-coalesced whole-struct
        // write-back (snapshot + whole write), which this pass re-targets at the local.
        const field = modifiedLocalFieldBlock(stmt, read);
        if (field !== undefined) {
          modified.add(field);
        } else {
          const folded = matchCoalescedWriteback(stmt, read);
          if (folded) { coalesced = folded; runStart = j; runEnd = j; break; }
          sound = false;
        }
      } else if (stmt instanceof VariableDefinitionNode && stmt.name === read.local) {
        sound = false; // redeclaration
      } else if (escapesLocal(stmt, read) || isControlFlow(stmt)
        || writesEntry(stmt, read.name, read.keys)) {
        sound = false;
      }
      j += 1;
    }

    if (!sound) { out.push(statements[i]); i += 1; continue; }

    let built: StatementNode | undefined;
    if (coalesced) {
      const written = writtenFieldsOfCoalesced(coalesced.write, coalesced.snapshot, read);
      if (!subset(modified, written)) { out.push(statements[i]); i += 1; continue; }
      built = buildCoalesced(coalesced, read);
    } else {
      const written = new Set(run.map((entry) => entry.fieldName));
      if (run.length < 2 || !subset(modified, written)) { out.push(statements[i]); i += 1; continue; }
      built = build(run, read);
    }
    if (!built) { out.push(statements[i]); i += 1; continue; }

    // Keep the entry-read declaration and the `e.f = v` modifications (they make `e` the desired final value),
    // drop the write-back (run or folded snapshot), and append the single whole-struct write.
    for (let k = i; k < runStart; k += 1) out.push(statements[k]);
    out.push(built);
    elidedReads += 1;
    i = runEnd + 1;
  }
  return { rewritten: out, elidedReads };
}

function build(
  run: MappingFieldAssignNode[],
  read: Read,
): StatementNode | undefined {
  const { struct } = read;
  for (const { expression } of run) {
    if (hasCall(expression)) return undefined;
  }
  const written = new Map(run.map((stmt) => [stmt.fieldName, stmt.expression]));
  const ctorArgs = struct.fields.map((field) => {
    const value = written.get(field.name);
    if (value) return cloneNode(value) as ExpressionNode;
    const fa = new FieldAccessNode(ident(read.local, run[0].location), field.name);
    fa.location = run[0].location;
    return fa;
  });
  const ctor = new FunctionCallNode(ident(struct.name, run[0].location), ctorArgs);
  ctor.location = run[0].location;
  const write = new MappingAssignNode(read.name, read.keys.map((key) => cloneNode(key) as ExpressionNode), ctor);
  write.location = run[0].location;
  return write;
}

/**
 * The fields a folded whole-struct write-back explicitly computes: every struct field whose constructor argument
 * is NOT the snapshot's own field read. The snapshot field reads are the carried-over fields, which the local
 * must not have been modified in for the swap to be sound.
 */
function writtenFieldsOfCoalesced(
  write: MappingAssignNode,
  snapshot: string,
  read: { struct: StructType },
): Set<string> {
  const ctor = write.expression;
  const written = new Set<string>();
  if (!(ctor instanceof FunctionCallNode)) return written;
  ctor.parameters.forEach((arg, idx) => {
    const field = read.struct.fields[idx];
    if (!field) return;
    const carried = arg instanceof FieldAccessNode && arg.expression instanceof IdentifierNode
      && arg.expression.name === snapshot && arg.name === field.name;
    if (!carried) written.add(field.name);
  });
  return written;
}

/** Swap a folded write-back's `__mefw.f` snapshot reads for the local's fields and drop the snapshot decl. */
function buildCoalesced(
  folded: { snapshot: string; write: MappingAssignNode },
  read: { struct: StructType; local: string },
): StatementNode | undefined {
  const ctor = folded.write.expression;
  if (!(ctor instanceof FunctionCallNode)) return undefined;
  const rewritten = cloneNode(ctor);
  rewriteSnapshotReads(rewritten, folded.snapshot, read.local);
  const write = new MappingAssignNode(
    folded.write.name,
    folded.write.keys.map((key) => cloneNode(key) as ExpressionNode),
    rewritten,
  );
  write.location = folded.write.location;
  return write;
}

/**
 * Replace `snapshot.f` field reads with `local.f` on an already-cloned tree. In-place is safe here because the
 * tree is a fresh `cloneNode` copy.
 */
function rewriteSnapshotReads(node: Node, snapshot: string, local: string): Node {
  if (node instanceof FieldAccessNode && node.expression instanceof IdentifierNode
    && node.expression.name === snapshot) {
    const fa = new FieldAccessNode(ident(local, node.location), node.name);
    fa.location = node.location;
    return fa;
  }
  for (const key of Object.keys(node)) {
    if (key === 'location' || key === 'type' || key === 'symbolTable') continue;
    const value = (node as unknown as Record<string, unknown>)[key];
    if (value instanceof Node) {
      (node as unknown as Record<string, unknown>)[key] = rewriteSnapshotReads(value, snapshot, local);
    } else if (Array.isArray(value)) {
      for (let idx = 0; idx < value.length; idx += 1) {
        const item = value[idx];
        if (item instanceof Node) {
          value[idx] = rewriteSnapshotReads(item, snapshot, local);
        }
      }
    }
  }
  return node;
}

function matchCoalescedWriteback(
  stmt: BlockNode,
  read: { name: string; keys: ExpressionNode[]; struct: StructType },
): { snapshot: string; write: MappingAssignNode } | undefined {
  const stmts = stmt.statements ?? [];
  if (stmts.length !== 2) return undefined;
  const [snapDecl, write] = stmts;
  if (!(snapDecl instanceof VariableDefinitionNode) || !(snapDecl.type instanceof StructType)) return undefined;
  const entry = flattenRead(snapDecl.expression);
  if (!entry || entry.name !== read.name || !keysEqual(entry.keys, read.keys)) return undefined;
  if (!(write instanceof MappingAssignNode) || write.name !== read.name
    || !keysEqual(write.keys, read.keys)) return undefined;
  if (!(write.expression instanceof FunctionCallNode)
    || !(write.expression.identifier instanceof IdentifierNode)
    || write.expression.identifier.name !== read.struct.name) return undefined;
  return { snapshot: snapDecl.name, write };
}

function matchRead(
  stmt: StatementNode,
  mappings: Map<string, WritebackMapping>,
): Read | undefined {
  if (!(stmt instanceof VariableDefinitionNode) || !(stmt.type instanceof StructType)) return undefined;
  const entry = flattenRead(stmt.expression);
  if (!entry) return undefined;
  const info = mappings.get(entry.name);
  if (!info || entry.keys.length !== info.keyCount) return undefined;
  return { name: entry.name, keys: entry.keys, struct: info.struct, local: stmt.name };
}

function flattenRead(
  expr: ExpressionNode | undefined,
): { name: string; keys: ExpressionNode[] } | undefined {
  if (!expr) return undefined;
  const keys: ExpressionNode[] = [];
  let cur: ExpressionNode = expr;
  while (cur instanceof ArrayAccessNode) { keys.unshift(cur.index); cur = cur.array; }
  if (cur instanceof MappingAccessNode) {
    return { name: cur.name, keys: [...cur.keys, ...keys] };
  }
  if (cur instanceof IdentifierNode) return { name: cur.name, keys };
  return undefined;
}

function isRunWrite(
  stmt: MappingFieldAssignNode,
  read: { name: string; keys: ExpressionNode[] },
): boolean {
  return stmt.name === read.name && (stmt.trailingMembers?.length ?? 0) === 0
    && keysEqual(stmt.keys, read.keys) && isPure(stmt.keys);
}

// `e.x = v` parses to a whole-struct rebuild `e = S(e.f0, .., v, ..)`. Return the modified field, or undefined
// when the assignment is not exactly that single-field rebuild shape.
function modifiedLocalField(
  stmt: AssignNode,
  read: { local: string; struct: StructType },
): string | undefined {
  if (!(stmt.expression instanceof FunctionCallNode)
    || !(stmt.expression.identifier instanceof IdentifierNode)
    || stmt.expression.identifier.name !== read.struct.name) return undefined;
  const args = stmt.expression.parameters;
  if (args.length !== read.struct.fields.length) return undefined;
  let modified: string | undefined;
  for (let idx = 0; idx < args.length; idx += 1) {
    const arg = args[idx];
    const field = read.struct.fields[idx];
    if (arg instanceof FieldAccessNode && arg.expression instanceof IdentifierNode
      && arg.expression.name === read.local && arg.name === field.name) continue;
    if (modified !== undefined) return undefined; // more than one changed field
    modified = field.name;
  }
  return modified;
}

/**
 * The modified field of the `e.arr[i] = v` desugar, else undefined. The parser lowers that write to a BlockNode
 * whose last statement is the whole-struct rebuild `e = S(..)` (the field-copy `modifiedLocalField` recognises),
 * preceded by a temp snapshot of the array field and element writes to that temp. The temp statements must not
 * otherwise escape the local.
 */
function modifiedLocalFieldBlock(
  stmt: BlockNode,
  read: { local: string; struct: StructType },
): string | undefined {
  const stmts = stmt.statements ?? [];
  const last = stmts[stmts.length - 1];
  if (!(last instanceof AssignNode)) return undefined;
  const field = modifiedLocalField(last, read);
  if (field === undefined) return undefined;
  for (const prior of stmts.slice(0, -1)) {
    if (escapesLocal(prior, read)) return undefined;
  }
  return field;
}

function escapesLocal(
  stmt: StatementNode,
  read: { local: string; struct: StructType },
): boolean {
  let found = false;
  const walk = (n: Node): void => {
    if (found) return;
    if (n instanceof FunctionCallNode) {
      // The struct constructor is the value-copy rebuild the pass tracks (`e = S(e.f0, .., v, ..)`); it cannot
      // mutate the local, so it is not an escape. Any OTHER call escapes when it receives the local by reference.
      if (n.identifier instanceof IdentifierNode && n.identifier.name === read.struct.name) return;
      for (const arg of n.parameters ?? []) {
        if (passesLocalByReference(arg, read)) { found = true; return; }
      }
    }
    for (const [key, value] of Object.entries(n)) {
      if (key === 'location' || key === 'type' || key === 'symbolTable') continue;
      if (value instanceof Node) walk(value);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
    }
  };
  walk(stmt);
  return found;
}

/**
 * Whether a call argument hands the local to the callee in a way the callee could mutate it: the whole struct,
 * a reference-typed field (`e.arr`), or a reference-typed element of a field (`e.items[i]` where `items` is
 * `T[]`). A value-typed member (`e.buyer`, `e.consensus[i]` with an int element) is copied, so it cannot mutate
 * the local. A FieldAccess/ArrayAccess base chain rooted at the local is resolved against the struct's fields.
 */
function passesLocalByReference(
  node: Node,
  read: { local: string; struct: StructType },
): boolean {
  if (node instanceof IdentifierNode) return node.name === read.local;
  if (node instanceof FieldAccessNode) {
    if (!(node.expression instanceof IdentifierNode) || node.expression.name !== read.local) {
      return passesLocalByReference(node.expression, read);
    }
    const field = read.struct.fields.find((f) => f.name === node.name);
    return field !== undefined && (field.type instanceof ArrayType || field.type instanceof StructType);
  }
  if (node instanceof ArrayAccessNode) {
    const base = node.array;
    if (base instanceof FieldAccessNode && base.expression instanceof IdentifierNode
      && base.expression.name === read.local) {
      const field = read.struct.fields.find((f) => f.name === base.name);
      const elementType = field?.type instanceof ArrayType ? field.type.elementType : undefined;
      return elementType !== undefined && (elementType instanceof ArrayType || elementType instanceof StructType);
    }
    return passesLocalByReference(base, read);
  }
  // A non-member expression containing the local (`e + x`) still passes a value snapshot; a cast of a member is
  // a copy too. Only an expression that is literally the whole local is a reference.
  let mentions = false;
  const walk = (n: Node): void => {
    if (mentions) return;
    if (n instanceof IdentifierNode && n.name === read.local) { mentions = true; return; }
    for (const [key, value] of Object.entries(n)) {
      if (key === 'location' || key === 'type' || key === 'symbolTable') continue;
      if (value instanceof Node) walk(value);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
    }
  };
  walk(node);
  return mentions;
}

function writesEntry(stmt: StatementNode, name: string, keys: ExpressionNode[]): boolean {
  if (stmt instanceof MappingAssignNode) return stmt.name === name && keysEqual(stmt.keys, keys);
  let found = false;
  const walk = (n: Node): void => {
    if (found) return;
    if (n instanceof MappingFieldAssignNode && n.name === name && keysEqual(n.keys, keys)) {
      found = true; return;
    }
    for (const [key, value] of Object.entries(n)) {
      if (key === 'location' || key === 'type' || key === 'symbolTable') continue;
      if (value instanceof Node) walk(value);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
    }
  };
  walk(stmt);
  return found;
}

function isControlFlow(stmt: StatementNode): boolean {
  return stmt instanceof BranchNode || stmt instanceof WhileNode || stmt instanceof DoWhileNode
    || stmt instanceof CollectionIterationNode;
}

function hasCall(expr: ExpressionNode): boolean {
  if (expr instanceof FunctionCallNode) return true;
  for (const [key, value] of Object.entries(expr)) {
    if (key === 'location' || key === 'type' || key === 'symbolTable') continue;
    if (value instanceof Node && hasCall(value as ExpressionNode)) return true;
    if (Array.isArray(value)) {
      for (const item of value) if (item instanceof Node && hasCall(item as ExpressionNode)) return true;
    }
  }
  return false;
}

function subset(a: Set<string>, b: Set<string>): boolean {
  for (const name of a) if (!b.has(name)) return false;
  return true;
}

function keysEqual(a: ExpressionNode[], b: ExpressionNode[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((key, i) => exprEqual(key, b[i]));
}

function exprEqual(a: ExpressionNode, b: ExpressionNode): boolean {
  if (a instanceof IdentifierNode && b instanceof IdentifierNode) return a.name === b.name;
  if (a.constructor.name !== b.constructor.name) return false;
  if (a instanceof ArrayAccessNode && b instanceof ArrayAccessNode) {
    return exprEqual(a.array, b.array) && exprEqual(a.index, b.index);
  }
  if (a instanceof FieldAccessNode && b instanceof FieldAccessNode) {
    return a.name === b.name && exprEqual(a.expression, b.expression);
  }
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

function strip(node: Node): unknown {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'location' || key === 'type' || key === 'symbolTable' || key === 'definition') continue;
    if (value instanceof Node) out[key] = strip(value);
    else if (Array.isArray(value)) out[key] = value.map((item) => (item instanceof Node ? strip(item) : item));
    else out[key] = value;
  }
  return out;
}

function isPure(keys: ExpressionNode[]): boolean {
  return keys.every((key) => !hasCall(key));
}

function ident(name: string, loc: Node['location']): IdentifierNode {
  const id = new IdentifierNode(name);
  id.location = loc;
  return id;
}
