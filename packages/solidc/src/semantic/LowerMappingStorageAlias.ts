import { MappingType, PrimitiveType } from '@solidcash/utils';
import {
  Node,
  SourceFileNode,
  ContractNode,
  BlockNode,
  StatementNode,
  FunctionDefinitionNode,
  VariableDefinitionNode,
  ArrayAssignNode,
  ArrayAccessNode,
  IdentifierNode,
  TernaryOpNode,
  BranchNode,
  ExpressionNode,
} from '../ast/AST.js';
import { Modifier } from '../ast/Globals.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

// A mapping-storage-pointer local aliased to a mapping (or a conditional choice of two). `a`/`b` are the
// underlying mapping names; `cond` (a captured bool local) selects between them when present.
interface MapAlias { cond?: ExpressionNode; a: string; b?: string; }

/**
 * Lowers a raw `mapping(..) storage` local bound to another mapping - the `returns (mapping storage)` idiom,
 * after InlineStoragePointerCalls has inlined the returning function into a bare mapping or a ternary of two:
 *
 *   mapping(K=>V) storage m = x;         // m aliases x
 *   mapping(K=>V) storage m = c ? a : b; // m conditionally aliases a or b
 *
 * A storage pointer has no runtime value, so every indexed use of `m` is rewritten to the underlying mapping and
 * the declaration dropped (a `bool` temp captures the condition once):
 *   m[k]      (read, ArrayAccess)  -> x[k]        |  c ? a[k] : b[k]
 *   m[k] = v  (write, ArrayAssign) -> x[k] = v    |  if (c) { a[k] = v; } else { b[k] = v; }
 * Only a bare-mapping or ternary-of-bare-mappings initializer is handled; any other shape (a reassigned pointer,
 * a whole-mapping use) is left untouched for a later pass to reject. Runs after InlineStoragePointerCalls and
 * before the symbol table.
 */
export default class LowerMappingStorageAlias extends AstTraversal {
  private aliases = new Map<string, MapAlias>();
  private counter = 0;

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
    this.aliases = new Map();
    if (node.body) node.body = this.visit(node.body) as BlockNode;
    this.aliases = saved;
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
    rhs: ExpressionNode, out: StatementNode[], decl: VariableDefinitionNode,
  ): MapAlias | undefined {
    if (rhs instanceof IdentifierNode) return { a: rhs.name };
    if (rhs instanceof TernaryOpNode && rhs.ifTrue instanceof IdentifierNode && rhs.ifFalse instanceof IdentifierNode) {
      // Capture the condition once into a bool local, evaluated in declaration order (before any m use).
      const condName = `__mapcond_${this.counter++}`;
      const condDef = new VariableDefinitionNode(
        PrimitiveType.BOOL, [], condName, cloneNode(rhs.condition) as ExpressionNode,
      );
      condDef.location = decl.location;
      out.push(condDef);
      const condId = new IdentifierNode(condName); condId.location = decl.location;
      return { cond: condId, a: rhs.ifTrue.name, b: rhs.ifFalse.name };
    }
    return undefined;
  }

  private rewriteWrite(node: ArrayAssignNode, alias: MapAlias): StatementNode {
    const idx = this.visit(node.index) as ExpressionNode;
    const val = this.visit(node.value) as ExpressionNode;
    if (!alias.cond) return this.stamp(new ArrayAssignNode(alias.a, idx, val), node.location);
    const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;
    const ifB = this.stamp(new BlockNode([
      this.stamp(new ArrayAssignNode(alias.a, clone(idx), clone(val)), node.location),
    ]), node.location);
    const elseB = this.stamp(new BlockNode([
      this.stamp(new ArrayAssignNode(alias.b!, clone(idx), clone(val)), node.location),
    ]), node.location);
    return this.stamp(new BranchNode(clone(alias.cond), ifB, elseB), node.location);
  }

  private rewriteRead(alias: MapAlias, index: ExpressionNode, loc: Node['location']): ExpressionNode {
    const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;
    const read = (name: string, idx: ExpressionNode): ArrayAccessNode =>
      this.stamp(new ArrayAccessNode(this.stamp(new IdentifierNode(name), loc), idx), loc);
    if (!alias.cond) return read(alias.a, index);
    return this.stamp(new TernaryOpNode(clone(alias.cond), read(alias.a, clone(index)), read(alias.b!, clone(index))), loc);
  }

  private stamp<T extends { location?: Node['location'] }>(n: T, loc: Node['location']): T {
    n.location = loc;
    return n;
  }
}
