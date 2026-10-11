import { MappingType, PrimitiveType } from '@solidcash/utils';
import {
  Node,
  SourceFileNode,
  ContractNode,
  BlockNode,
  StatementNode,
  FunctionDefinitionNode,
  VariableDefinitionNode,
  AssignNode,
  StateAssignNode,
  ArrayAssignNode,
  ArrayAccessNode,
  MappingAccessNode,
  MappingAssignNode,
  IdentifierNode,
  TernaryOpNode,
  BranchNode,
  ExpressionNode,
} from '../ast/AST.js';
import { Modifier } from '../ast/Globals.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

// A mapping-storage-pointer local aliased to a mapping, a SUB-mapping reached by fixed keys (`m[k]`), or a
// conditional choice of two. `a`/`b` are the underlying mapping names and `keysA`/`keysB` the fixed key prefix
// that reaches the aliased sub-mapping; `cond` (a captured bool local) selects between them when present.
interface MapAlias { cond?: ExpressionNode; a: string; b?: string; keysA?: ExpressionNode[]; keysB?: ExpressionNode[]; }

/**
 * Lowers a raw `mapping(..) storage` local bound to another mapping - the `returns (mapping storage)` idiom,
 * after InlineStoragePointerCalls has inlined the returning function into a bare mapping or a ternary of two:
 *
 *   mapping(K=>V) storage m = x;         // m aliases x
 *   mapping(K=>V) storage m = x[i];      // m aliases the sub-mapping x[i] (fixed key prefix)
 *   mapping(K=>V) storage m = c ? a : b; // m conditionally aliases a or b
 *
 * A storage pointer has no runtime value, so every indexed use of `m` is rewritten to the underlying mapping and
 * the declaration dropped (a `bool` temp captures the condition once):
 *   m[k]      (read, ArrayAccess)  -> x[k]        |  c ? a[k] : b[k]
 *   m[k] = v  (write, ArrayAssign) -> x[k] = v    |  if (c) { a[k] = v; } else { b[k] = v; }
 * With a key prefix the reads/writes become the multi-key mapping forms (`x[i][k]` / `x[i][k] = v`).
 * Only a bare-mapping, a fixed-key sub-mapping, or a ternary of those initializers is handled; any other shape (a
 * reassigned pointer, a whole-mapping use) is left untouched for a later pass to reject. Runs after
 * InlineStoragePointerCalls and before the symbol table.
 */
export default class LowerMappingStorageAlias extends AstTraversal {
  private aliases = new Map<string, MapAlias>();
  private counter = 0;
  private loweredConditionalAlias = false;

  visitSourceFile(node: SourceFileNode): Node {
    node.importedContracts = this.visitList(node.importedContracts) as ContractNode[];
    node.freeFunctions = this.visitList(node.freeFunctions) as FunctionDefinitionNode[];
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const saved = this.aliases;
    const savedConditionalAlias = this.loweredConditionalAlias;
    this.aliases = new Map();
    this.loweredConditionalAlias = false;
    if (node.body) node.body = this.visit(node.body) as BlockNode;
    // Source-effect ordinals were assigned before pointer-returning helpers were inlined. A conditional
    // mapping alias lowers to a real branch/ternary here, so its writes have no total reached order even
    // though the original call expression looked linear to that earlier pass.
    if (this.loweredConditionalAlias) node.sourceEffectOrder = 'unsupported-flow';
    this.aliases = saved;
    this.loweredConditionalAlias = savedConditionalAlias;
    return node;
  }

  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      // `mapping(..) storage m = <RHS>`: record the alias, drop the declaration (a conditional one leaves a
      // captured `bool` temp in its place).
      if (stmt instanceof VariableDefinitionNode && stmt.type instanceof MappingType
        && stmt.modifier.includes(Modifier.STORAGE) && stmt.expression) {
        const alias = this.aliasFromRhs(stmt.expression, out, stmt);
        if (alias) { this.aliases.set(stmt.name, alias); continue; }
      }
      // A storage pointer can be rebound; it still has no runtime value. Update the compile-time alias from this
      // point onward and drop the assignment just like the original declaration.
      if (stmt instanceof AssignNode && stmt.identifier instanceof IdentifierNode
        && this.aliases.has(stmt.identifier.name)) {
        const alias = this.aliasFromRhs(stmt.expression, out, stmt);
        if (alias) { this.aliases.set(stmt.identifier.name, alias); continue; }
      }
      if (stmt instanceof StateAssignNode && this.aliases.has(stmt.name)) {
        const alias = this.aliasFromRhs(stmt.expression, out, stmt);
        if (alias) { this.aliases.set(stmt.name, alias); continue; }
      }
      // `m[k] = v` on an aliased pointer -> underlying write (branched when conditional).
      if (stmt instanceof ArrayAssignNode && this.aliases.has(stmt.name)) {
        out.push(this.rewriteWrite(stmt, this.aliases.get(stmt.name)!));
        continue;
      }
      out.push(this.visit(stmt) as StatementNode); // rewrites `m[k]` reads via visitArrayAccess
    }
    node.statements = out;
    return node;
  }

  // `m[k]` read on an aliased pointer -> `x[k]` / `c ? a[k] : b[k]`.
  visitArrayAccess(node: ArrayAccessNode): Node {
    node.index = this.visit(node.index) as ExpressionNode;
    node.array = this.visit(node.array) as ExpressionNode;
    if (node.array instanceof IdentifierNode && this.aliases.has(node.array.name)) {
      return this.rewriteRead(this.aliases.get(node.array.name)!, node.index, node.location);
    }
    // Direct index of an inlined ternary-of-mappings: `Lib.choose(a, b, c)[k]` -> `(c ? a : b)[k]` -> `c ? a[k] : b[k]`.
    if (node.array instanceof TernaryOpNode && node.array.ifTrue instanceof IdentifierNode
      && node.array.ifFalse instanceof IdentifierNode) {
      const alias: MapAlias = { cond: node.array.condition, a: node.array.ifTrue.name, b: node.array.ifFalse.name };
      return this.rewriteRead(alias, node.index, node.location);
    }
    return node;
  }

  private aliasFromRhs(
    rhs: ExpressionNode, out: StatementNode[], decl: VariableDefinitionNode | AssignNode | StateAssignNode,
  ): MapAlias | undefined {
    const direct = this.pathOf(rhs);
    if (direct) return { a: direct.name, keysA: direct.keys };
    if (rhs instanceof TernaryOpNode) {
      const ifTrue = this.pathOf(rhs.ifTrue);
      const ifFalse = this.pathOf(rhs.ifFalse);
      if (!ifTrue || !ifFalse) return undefined;
      // Capture the condition once into a bool local, evaluated in declaration order (before any m use).
      const condName = `__mapcond_${this.counter++}`;
      const condDef = new VariableDefinitionNode(
        PrimitiveType.BOOL, [], condName, cloneNode(rhs.condition) as ExpressionNode,
      );
      condDef.location = decl.location;
      out.push(condDef);
      const condId = new IdentifierNode(condName); condId.location = decl.location;
      return { cond: condId, a: ifTrue.name, keysA: ifTrue.keys, b: ifFalse.name, keysB: ifFalse.keys };
    }
    return undefined;
  }

  // The underlying mapping name and the fixed key prefix of a storage path: a bare identifier `x` (no keys) or a
  // chain of fixed-key accesses `x[i][j]` (keys `[i, j]`). Anything else (a call, a computed base) is undefined.
  private pathOf(expr: ExpressionNode): { name: string; keys: ExpressionNode[] } | undefined {
    const keys: ExpressionNode[] = [];
    let current: ExpressionNode = expr;
    while (current instanceof ArrayAccessNode) {
      keys.unshift(current.index);
      current = current.array;
    }
    return current instanceof IdentifierNode ? { name: current.name, keys } : undefined;
  }

  private rewriteWrite(node: ArrayAssignNode, alias: MapAlias): StatementNode {
    const idx = this.visit(node.index) as ExpressionNode;
    const val = this.visit(node.value) as ExpressionNode;
    if (!alias.cond) return this.writePath(alias, 'a', idx, val, node.location);
    this.loweredConditionalAlias = true;
    const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;
    const ifB = this.stamp(new BlockNode([
      this.writePath(alias, 'a', clone(idx), clone(val), node.location),
    ]), node.location);
    const elseB = this.stamp(new BlockNode([
      this.writePath(alias, 'b', clone(idx), clone(val), node.location),
    ]), node.location);
    return this.stamp(new BranchNode(clone(alias.cond), ifB, elseB), node.location);
  }

  // The underlying write for one side of an alias: `x[idx] = val` (no key prefix) or `x[..keys][idx] = val`.
  private writePath(
    alias: MapAlias, side: 'a' | 'b', idx: ExpressionNode, val: ExpressionNode, loc: Node['location'],
  ): StatementNode {
    const name = side === 'a' ? alias.a : alias.b!;
    const keys = (side === 'a' ? alias.keysA : alias.keysB) ?? [];
    if (keys.length === 0) return this.stamp(new ArrayAssignNode(name, idx, val), loc);
    return this.stamp(new MappingAssignNode(name, [...keys.map((key) => cloneNode(key) as ExpressionNode), idx], val), loc);
  }

  private rewriteRead(alias: MapAlias, index: ExpressionNode, loc: Node['location']): ExpressionNode {
    if (!alias.cond) return this.readPath(alias, 'a', index, loc);
    this.loweredConditionalAlias = true;
    const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;
    return this.stamp(new TernaryOpNode(
      clone(alias.cond), this.readPath(alias, 'a', clone(index), loc), this.readPath(alias, 'b', clone(index), loc),
    ), loc);
  }

  // The underlying read for one side of an alias: `x[index]` (no key prefix) or `x[..keys][index]`.
  private readPath(alias: MapAlias, side: 'a' | 'b', index: ExpressionNode, loc: Node['location']): ExpressionNode {
    const name = side === 'a' ? alias.a : alias.b!;
    const keys = (side === 'a' ? alias.keysA : alias.keysB) ?? [];
    if (keys.length === 0) {
      return this.stamp(new ArrayAccessNode(this.stamp(new IdentifierNode(name), loc), index), loc);
    }
    return this.stamp(new MappingAccessNode(name, [...keys.map((key) => cloneNode(key) as ExpressionNode), index]), loc);
  }

  private stamp<T extends { location?: Node['location'] }>(n: T, loc: Node['location']): T {
    n.location = loc;
    return n;
  }
}
