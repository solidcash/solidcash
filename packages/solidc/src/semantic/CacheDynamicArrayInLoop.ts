import {
  ContractNode,
  FunctionDefinitionNode,
  SourceFileNode,
  Node,
  StatementNode,
  BlockNode,
  BranchNode,
  WhileNode,
  DoWhileNode,
  UncheckedNode,
  StateArrayPushNode,
  StateArrayPopNode,
  StateArrayAssignNode,
  StateArrayDeleteNode,
  ArrayPushNode,
  ArrayPopNode,
  ArrayAssignNode,
  ArrayDeleteNode,
  MappingAccessNode,
  MappingAssignNode,
  IdentifierNode,
  VariableDefinitionNode,
  StateAssignNode,
  StateVariableNode,
} from '../ast/AST.js';
import { ArrayType } from '@solidcash/utils';
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
 * after the rename). A cache read `V` is prepended and a flush `V = __dlcache_V` appended. Runs before
 * semantic analysis so the renamed accesses resolve as a local array.
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
      if (sv.isDynamic && sv.type instanceof ArrayType) this.dynArrays.set(sv.name, sv);
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
      // Convert write statements (state -> local) and rename reads (state name -> local name) throughout.
      fn.body.statements = this.convertWrites(fn.body.statements ?? [], name, local);
      this.renameReads(fn.body, name, local);
      // Cache read prepended (reads the persisted V once); flush appended (writes the final local back once).
      // Built after the rename so they keep the state-var name V.
      const cacheInit = new IdentifierNode(name);
      cacheInit.location = fn.body.location;
      const cache = new VariableDefinitionNode(sv.type, [], local, cacheInit);
      cache.location = fn.body.location;
      const flushRhs = new IdentifierNode(local);
      flushRhs.location = fn.body.location;
      const flush = new StateAssignNode(name, flushRhs);
      flush.location = fn.body.location;
      fn.body.statements = [cache, ...fn.body.statements, flush];
    }
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

  // The dynamic-array name written by a write statement, else undefined. A bare `arr[i] = x` parses to an
  // ArrayAssignNode (state-or-local resolved by name in semantic), while `arr.push/pop` and `this.arr[i]=`
  // are the StateArray* nodes - so both shapes are write targets when the name is a dynamic array.
  private writeTargetName(stmt: StatementNode): string | undefined {
    if ((stmt instanceof StateArrayPushNode || stmt instanceof StateArrayPopNode
      || stmt instanceof StateArrayAssignNode || stmt instanceof StateArrayDeleteNode
      || stmt instanceof ArrayPushNode || stmt instanceof ArrayPopNode
      || stmt instanceof ArrayAssignNode || stmt instanceof ArrayDeleteNode)
      && this.dynArrays.has(stmt.name)) {
      return stmt.name;
    }
    return undefined;
  }

  // Replace state-array write statements for `name` with the equivalent local array statements for `local`,
  // recursing into nested blocks. Index/value sub-expressions are renamed later by renameReads.
  private convertWrites(stmts: StatementNode[], name: string, local: string): StatementNode[] {
    return stmts.map((stmt) => {
      if (stmt instanceof StateArrayPushNode && stmt.name === name) {
        const push = new ArrayPushNode(local, stmt.value);
        push.noArg = stmt.noArg; // preserve no-arg push (its value is a placeholder, defaulted at type-check)
        return this.copyLoc(push, stmt);
      }
      if (stmt instanceof StateArrayPopNode && stmt.name === name) {
        return this.copyLoc(new ArrayPopNode(local), stmt);
      }
      if (stmt instanceof StateArrayAssignNode && stmt.name === name) {
        return this.copyLoc(new ArrayAssignNode(local, stmt.index, stmt.value), stmt);
      }
      if (stmt instanceof StateArrayDeleteNode && stmt.name === name) {
        return this.copyLoc(new ArrayDeleteNode(local, stmt.index), stmt);
      }
      if (stmt instanceof WhileNode || stmt instanceof DoWhileNode) {
        stmt.block.statements = this.convertWrites(stmt.block.statements ?? [], name, local);
      } else if (stmt instanceof BranchNode) {
        stmt.ifBlock.statements = this.convertWrites(stmt.ifBlock.statements ?? [], name, local);
        if (stmt.elseBlock) stmt.elseBlock.statements = this.convertWrites(stmt.elseBlock.statements ?? [], name, local);
      } else if (stmt instanceof UncheckedNode) {
        stmt.block.statements = this.convertWrites(stmt.block.statements ?? [], name, local);
      } else if (stmt instanceof BlockNode) {
        stmt.statements = this.convertWrites(stmt.statements ?? [], name, local);
      }
      return stmt;
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
    this.walk(root, (n) => {
      const named = n as unknown as { name?: unknown };
      if (typeof named.name !== 'string' || named.name !== name) return;
      // Rename name-resolved accesses (bare identifier / index read+write / push/pop/delete) to the local.
      // StateArray* writes were already converted to local Array* nodes above; FieldAccess.name is a field
      // (e.g. `.length`) not an array name, so it is left alone (its inner identifier is renamed instead).
      if (n instanceof IdentifierNode || n instanceof MappingAccessNode || n instanceof MappingAssignNode
        || n instanceof ArrayAssignNode || n instanceof ArrayPushNode || n instanceof ArrayPopNode
        || n instanceof ArrayDeleteNode) {
        named.name = local;
      }
    });
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
