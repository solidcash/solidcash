import {
  ContractNode,
  FunctionDefinitionNode,
  SourceFileNode,
  Node,
  StatementNode,
  BlockNode,
  ExpressionNode,
  BranchNode,
  WhileNode,
  DoWhileNode,
  UncheckedNode,
  SwitchNode,
  TryCatchNode,
  StateArrayPushNode,
  StateArrayPopNode,
  StateArrayAssignNode,
  StateArrayDeleteNode,
  DeleteStateNode,
  DeleteLocalNode,
  ArrayPushNode,
  ArrayPopNode,
  ArrayAssignNode,
  ArrayDeleteNode,
  MappingAccessNode,
  StateAccessNode,
  ArrayAccessNode,
  MappingAssignNode,
  IdentifierNode,
  VariableDefinitionNode,
  StateAssignNode,
  StateVariableNode,
  ReturnNode,
  AssignNode,
  BoolLiteralNode,
} from '../ast/AST.js';
import { ArrayType, PrimitiveType, isDynamicStorageType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * A dynamic-storage (chunk-backed) state array cannot be written inside a loop: the pending-value write
 * model emits the write once at codegen but the loop runs it N times, so the on-stack value desyncs (it
 * fails codegen with "Expected variable ... does not exist"). Local array ops, by contrast, update an
 * on-stack slot in place and are stack-neutral, so they work in loops.
 *
 * This pass desugars "dynamic array mutated in a loop" into the read-once / mutate-local / write-once form
 * that already works:
 *
 * ```
 * function f() { for (..) { arr.push(x); } }
 * ->
 * function f() { T[] __dlcache_arr = arr; for (..) { __dlcache_arr.push(x); } arr = __dlcache_arr; }
 * ```
 *
 * For each dynamic array V written inside a loop in a function: every access to V in that function is
 * redirected to a fresh local `__dlcache_V` (state-array write statements become local array statements;
 * index reads / `.length` / bare reads are MappingAccess/Identifier nodes that resolve to the local by name
 * after the rename). A cache read `V` is prepended and a flush `V = __dlcache_V` appended. The flush is
 * gated on `__dlcache_dirty_V`: a message-bus route also invokes handlers that write V through the journal,
 * and an unconditional flush of the untouched snapshot publishes that pre-call blob over the handler's
 * update. Runs before semantic analysis so the renamed accesses resolve as a local array.
 */
const PREFIX = '__dlcache_';

export default class CacheDynamicArrayInLoop extends AstTraversal {
  private dynArrays: Map<string, StateVariableNode> = new Map();

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.dynArrays = new Map();
    for (const sv of node.stateVariables) {
      // Unbounded bytes/string (isDynamicStorageType) have the same chunk-backed pending-value write model as a
      // dynamic array: `b = b + x` (the desugared `b.push(x)`) inside a loop emits the write once but runs it N
      // times. Arrays are marked isDynamic at parse time; bytes/string are not until a later pass, so match on the
      // type directly for them.
      if ((sv.isDynamic && sv.type instanceof ArrayType) || isDynamicStorageType(sv.type)) {
        this.dynArrays.set(sv.name, sv);
      }
    }
    if (this.dynArrays.size === 0) return node;

    for (const fn of [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef]) {
      if (fn?.body) this.transformFunction(fn);
    }
    return node;
  }

  private transformFunction(fn: FunctionDefinitionNode): void {
    const writtenInLoop = new Set<string>();
    this.collectLoopWrites(fn.body.statements ?? [], false, writtenInLoop);
    if (writtenInLoop.size === 0) return;

    for (const name of writtenInLoop) {
      const sv = this.dynArrays.get(name)!;
      const local = `${PREFIX}${name}`;
      const dirty = `${PREFIX}dirty_${name}`;
      // Convert write statements (state -> local) and rename reads (state name -> local name) throughout.
      fn.body.statements = this.convertWrites(fn.body.statements ?? [], name, local, dirty);
      this.renameReads(fn.body, name, local);
      // Cache read prepended (reads the persisted V once); flush written back on every exit path.
      // Built after the rename so they keep the state-var name V.
      const cacheInit = new IdentifierNode(name);
      cacheInit.location = fn.body.location;
      const cache = new VariableDefinitionNode(sv.type, [], local, cacheInit);
      cache.location = fn.body.location;
      const dirtyInit = new BoolLiteralNode(false);
      dirtyInit.location = fn.body.location;
      const dirtyLocal = new VariableDefinitionNode(PrimitiveType.BOOL, [], dirty, dirtyInit);
      dirtyLocal.location = fn.body.location;
      // The flush writes the cache back to state and must run before EVERY return (else an early return
      // skips it and the state array is silently never written) and at the fall-through end. It must
      // precede each `return` so the return stays that path's terminal statement.
      let stmts = this.insertFlushesBeforeReturns(
        fn.body.statements ?? [], name, local, dirty, fn.body.location,
      );
      if (stmts.length === 0 || !(stmts[stmts.length - 1] instanceof ReturnNode)) {
        stmts = [...stmts, this.makeFlush(name, local, dirty, fn.body.location)];
      }
      fn.body.statements = [cache, dirtyLocal, ...stmts];
    }
  }

  private markDirty(dirty: string, loc: Node['location']): AssignNode {
    const identifier = new IdentifierNode(dirty);
    identifier.location = loc;
    const value = new BoolLiteralNode(true);
    value.location = loc;
    const assign = new AssignNode(identifier, value);
    assign.location = loc;
    return assign;
  }

  private makeFlush(name: string, local: string, dirty: string, loc: Node['location']): BranchNode {
    const rhs = new IdentifierNode(local);
    rhs.location = loc;
    const flush = new StateAssignNode(name, rhs);
    flush.location = loc;
    const flushBlock = new BlockNode([flush]);
    flushBlock.location = loc;
    const condition = new IdentifierNode(dirty);
    condition.location = loc;
    const branch = new BranchNode(condition, flushBlock);
    branch.location = loc;
    // The clean arm is a no-op. If-converting it would still republish the snapshot and its chunk NFTs,
    // over a handler that already wrote the array through the journal.
    branch.preserveConditionalEntryWrites = true;
    return branch;
  }

  // Insert a `V = __dlcache_V` flush immediately before every `return`, recursing into if/else, switch
  // cases, try/catch and blocks (NOT loops: in-loop returns were already rewritten to flag+break by
  // DesugarReturnInLoop, and a flush inside a loop body would write on every iteration). Each exit path
  // thus flushes the final local value. (EarlyReturnTransformation already routes the fall-through flush
  // for switch/try tails, so those recursions are defensive; the if/else one is load-bearing - that pass
  // nests the trailing flush into a synthesized else, which the return-taken path would otherwise skip.)
  private insertFlushesBeforeReturns(
    stmts: StatementNode[], name: string, local: string, dirty: string, loc: Node['location'],
  ): StatementNode[] {
    const out: StatementNode[] = [];
    for (const stmt of stmts) {
      if (stmt instanceof ReturnNode) {
        out.push(this.makeFlush(name, local, dirty, loc));
        out.push(stmt);
        continue;
      }
      if (stmt instanceof BranchNode) {
        stmt.ifBlock.statements = this.insertFlushesBeforeReturns(
          stmt.ifBlock.statements ?? [], name, local, dirty, loc,
        );
        if (stmt.elseBlock) {
          stmt.elseBlock.statements = this.insertFlushesBeforeReturns(
            stmt.elseBlock.statements ?? [], name, local, dirty, loc,
          );
        }
      } else if (stmt instanceof SwitchNode) {
        for (const c of stmt.cases) {
          c.body.statements = this.insertFlushesBeforeReturns(c.body.statements ?? [], name, local, dirty, loc);
        }
        if (stmt.defaultCase) {
          stmt.defaultCase.statements = this.insertFlushesBeforeReturns(
            stmt.defaultCase.statements ?? [], name, local, dirty, loc,
          );
        }
      } else if (stmt instanceof TryCatchNode) {
        stmt.tryBlock.statements = this.insertFlushesBeforeReturns(
          stmt.tryBlock.statements ?? [], name, local, dirty, loc,
        );
        for (const cc of stmt.catchClauses) {
          cc.block.statements = this.insertFlushesBeforeReturns(
            cc.block.statements ?? [], name, local, dirty, loc,
          );
        }
      } else if (stmt instanceof UncheckedNode) {
        stmt.block.statements = this.insertFlushesBeforeReturns(
          stmt.block.statements ?? [], name, local, dirty, loc,
        );
      } else if (stmt instanceof BlockNode) {
        stmt.statements = this.insertFlushesBeforeReturns(stmt.statements ?? [], name, local, dirty, loc);
      }
      out.push(stmt);
    }
    return out;
  }

  // Walk statement lists tracking whether we are inside a CONDITIONALLY-executed context (a loop OR an if/else
  // branch); record the names of dynamic arrays written (push/pop/assign/delete) there. A branch runs its write
  // 0-or-1 times, so - exactly like a loop's 0-or-N - the codegen pending-value model (which emits the write
  // once at the function epilogue) desyncs and fails "Expected variable ... does not exist"; caching fixes both.
  private collectLoopWrites(stmts: StatementNode[], inCond: boolean, out: Set<string>): void {
    for (const stmt of stmts) {
      if (inCond && this.writeTargetName(stmt) !== undefined) out.add(this.writeTargetName(stmt)!);
      if (stmt instanceof WhileNode || stmt instanceof DoWhileNode) {
        this.collectLoopWrites(stmt.block.statements ?? [], true, out);
      } else if (stmt instanceof BranchNode) {
        this.collectLoopWrites(stmt.ifBlock.statements ?? [], true, out);
        if (stmt.elseBlock) this.collectLoopWrites(stmt.elseBlock.statements ?? [], true, out);
      } else if (stmt instanceof UncheckedNode) {
        this.collectLoopWrites(stmt.block.statements ?? [], inCond, out);
      } else if (stmt instanceof BlockNode) {
        this.collectLoopWrites(stmt.statements ?? [], inCond, out);
      }
    }
  }

  // The dynamic-storage name written by a write statement, else undefined. A bare `arr[i] = x` parses to an
  // ArrayAssignNode (state-or-local resolved by name in semantic), while `arr.push/pop` and `this.arr[i]=`
  // are the StateArray* nodes - so both shapes are write targets when the name is a dynamic array. A whole-value
  // `StateAssignNode` is how `bytes/string` append (`b = b + x`, desugared from `b.push(x)`) and whole
  // `this.arr = expr` both reach codegen.
  private writeTargetName(stmt: StatementNode): string | undefined {
    if ((stmt instanceof StateArrayPushNode || stmt instanceof StateArrayPopNode
      || stmt instanceof StateArrayAssignNode || stmt instanceof StateArrayDeleteNode
      || stmt instanceof ArrayPushNode || stmt instanceof ArrayPopNode
      || stmt instanceof ArrayAssignNode || stmt instanceof ArrayDeleteNode)
      && this.dynArrays.has(stmt.name)) {
      return stmt.name;
    }
    if (stmt instanceof StateAssignNode && this.dynArrays.has(stmt.name)) return stmt.name;
    return undefined;
  }

  // Replace state-array write statements for `name` with the equivalent local array statements for `local`,
  // recursing into nested blocks. Index/value sub-expressions are renamed later by renameReads.
  private convertWrites(
    stmts: StatementNode[], name: string, local: string, dirty: string,
  ): StatementNode[] {
    const marked = (stmt: StatementNode): StatementNode[] => [this.markDirty(dirty, stmt.location), stmt];
    return stmts.flatMap((stmt) => {
      if (stmt instanceof StateArrayPushNode && stmt.name === name) {
        const push = new ArrayPushNode(local, stmt.value);
        push.noArg = stmt.noArg; // preserve no-arg push (its value is a placeholder, defaulted at type-check)
        return marked(this.copyLoc(push, stmt));
      }
      if (stmt instanceof StateArrayPopNode && stmt.name === name) {
        return marked(this.copyLoc(new ArrayPopNode(local), stmt));
      }
      if (stmt instanceof StateArrayAssignNode && stmt.name === name) {
        return marked(this.copyLoc(new ArrayAssignNode(local, stmt.index, stmt.value), stmt));
      }
      if (stmt instanceof StateArrayDeleteNode && stmt.name === name) {
        return marked(this.copyLoc(new ArrayDeleteNode(local, stmt.index), stmt));
      }
      // X167. WHOLE-array `delete arr` (StateArrayDeleteNode above is the ELEMENT delete `delete arr[i]`).
      // The cache read is prepended at function top and the flush appended, so a state-level delete left
      // between them is overwritten by the flush of the PRE-delete contents. `d2 = d1` desugars to
      // `delete d2; while (..) d2.push(..)`, so the delete was neutralized and the copy APPENDED. Reset the
      // local instead, which the flush then writes back.
      if (stmt instanceof DeleteStateNode && stmt.name === name) {
        const ident = new IdentifierNode(local);
        ident.location = stmt.location;
        return marked(this.copyLoc(new DeleteLocalNode(ident), stmt));
      }
      // X171. WHOLE-array ASSIGN `this.arr = <expr>`, the delete's sibling. Same neutralization: the flush of
      // the PRE-assign cache overwrites it, so the assigned value is dropped and the old contents kept.
      // Assign the local instead, which the flush then writes back.
      if (stmt instanceof StateAssignNode && stmt.name === name) {
        const ident = new IdentifierNode(local);
        ident.location = stmt.location;
        return marked(this.copyLoc(new AssignNode(ident, stmt.expression), stmt));
      }
      // A bare `arr[i] = x` parses as the local Array* node (only `this.arr[i] = x` is the StateArray*
      // form above) and renameReads rewrites its name to the cache. Mark the rename dirty too: otherwise a
      // conditional element re-write whose enclosing loop wrote nothing else never flushes.
      if ((stmt instanceof ArrayPushNode || stmt instanceof ArrayPopNode
        || stmt instanceof ArrayAssignNode || stmt instanceof ArrayDeleteNode)
        && stmt.name === name) {
        return marked(stmt);
      }
      if (stmt instanceof WhileNode || stmt instanceof DoWhileNode) {
        stmt.block.statements = this.convertWrites(stmt.block.statements ?? [], name, local, dirty);
      } else if (stmt instanceof BranchNode) {
        stmt.ifBlock.statements = this.convertWrites(stmt.ifBlock.statements ?? [], name, local, dirty);
        if (stmt.elseBlock) {
          stmt.elseBlock.statements = this.convertWrites(stmt.elseBlock.statements ?? [], name, local, dirty);
        }
      } else if (stmt instanceof UncheckedNode) {
        stmt.block.statements = this.convertWrites(stmt.block.statements ?? [], name, local, dirty);
      } else if (stmt instanceof BlockNode) {
        stmt.statements = this.convertWrites(stmt.statements ?? [], name, local, dirty);
      }
      return [stmt];
    });
  }

  private copyLoc(to: StatementNode, from: StatementNode): StatementNode {
    to.location = from.location;
    return to;
  }

  // Rename every read reference to state array `name` (bare identifier, `name[i]` index, `name.length`,
  // which is a FieldAccess over the identifier) to the local `local`. State write nodes were already
  // converted to local ones above; their index/value sub-expressions are covered here.
  private renameReads(root: Node, name: string, local: string): void {
    this.replaceIndexedReads(root, name, local);
    this.walk(root, (n) => {
      const named = n as unknown as { name?: unknown };
      if (typeof named.name !== 'string' || named.name !== name) return;
      // Rename name-resolved accesses (bare identifier / index read+write / push/pop/delete) to the local.
      // StateArray* writes were already converted to local Array* nodes above; FieldAccess.name is a field
      // (e.g. `.length`) not an array name, so it is left alone (its inner identifier is renamed instead).
      if (n instanceof IdentifierNode || n instanceof MappingAssignNode
        || n instanceof ArrayAssignNode || n instanceof ArrayPushNode || n instanceof ArrayPopNode
        || n instanceof ArrayDeleteNode) {
        named.name = local;
      }
    });
  }

  // The parser represents a state-array read as MappingAccessNode (indexed) or StateAccessNode (bare, which is
  // what `.length` reads through) until semantic resolution. Once this pass redirects that state array to a
  // local cache, retaining only the state spelling is insufficient: SymbolTableTraversal resolves it against the
  // persisted collection, which the cache has not been flushed to yet, so the read observes the pre-write array
  // (a bare `.length` after a cached `push()` still reports the old count). Rebuild the exact read as local
  // ArrayAccess / identifier nodes while the source keys and locations are still available. This is structural
  // and also covers nodes exposed by handler cloning.
  private replaceIndexedReads(root: Node, name: string, local: string): void {
    const replace = (node: Node): Node => {
      for (const key of Object.keys(node)) {
        if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
        const value = (node as unknown as Record<string, unknown>)[key];
        if (value instanceof Node) {
          (node as unknown as Record<string, unknown>)[key] = replace(value);
        } else if (Array.isArray(value)) {
          for (let index = 0; index < value.length; index += 1) {
            if (value[index] instanceof Node) value[index] = replace(value[index]);
          }
        }
      }
      if (!(node instanceof StateAccessNode || node instanceof MappingAccessNode) || node.name !== name) {
        return node;
      }
      // A storage-pointer-only access selects a slot rather than reading the value (`x.slot` inline assembly), so
      // it has to keep addressing the state variable instead of the compiler-owned cache local.
      if (node instanceof StateAccessNode && node.storagePointerOnly === true) return node;
      const identifier = new IdentifierNode(local);
      identifier.location = node.location;
      // A bare read (no index) means the whole array: `.length` and any direct use. Only an INDEXED read has to
      // be rebuilt as the equivalent local ArrayAccess chain.
      if (node instanceof StateAccessNode || node.keys.length === 0) return identifier;
      let expression: ExpressionNode = identifier;
      for (const index of node.keys) {
        const access = new ArrayAccessNode(expression, index);
        access.location = node.location;
        expression = access;
      }
      return expression;
    };
    replace(root);
  }

  // Pre-order walk over child Nodes (and Node arrays); skips Type/symbol-table fields.
  private walk(node: Node | undefined, visit: (n: Node) => void): void {
    if (!node) return;
    visit(node);
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      if (v instanceof Node) this.walk(v, visit);
      else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) this.walk(it, visit);
    }
  }
}
