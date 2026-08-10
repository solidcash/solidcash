import { MappingType, StructType, Type } from '@solidcash/utils';
import {
  Node,
  SourceFileNode,
  ContractNode,
  BlockNode,
  StatementNode,
  FunctionDefinitionNode,
  VariableDefinitionNode,
  MappingFieldAssignNode,
  MappingAssignNode,
  MappingAccessNode,
  ArrayAccessNode,
  FunctionCallNode,
  InstantiationNode,
  IndirectCallNode,
  AssignmentExpressionNode,
  FieldAccessNode,
  IdentifierNode,
  IntLiteralNode,
  BoolLiteralNode,
  HexLiteralNode,
  StringLiteralNode,
  CastNode,
  ExpressionNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/**
 * Coalesce consecutive whole-field writes to the SAME struct-valued vmap mapping entry into one entry read + one
 * whole-struct write:
 *
 *   escrows[id].split = a; escrows[id].consensus = b; escrows[id].claimed = 1;
 *     -> S __mefw = escrows[id]; escrows[id] = Escrow(__mefw.f0, .., a, b, .., 1, ..);
 *
 * Each `m[k].f = v` on a sorted (vmap) mapping is a full entry read-modify-upsert; the vmap path does NOT chain
 * consecutive field writes (the default backend does, via pendingEntryWrites), so N field writes = N whole upserts.
 * Reading once and writing the finished struct back once replaces that with 1 read + 1 upsert. Emits only a
 * VariableDefinitionNode + a whole-struct MappingAssignNode (both lowered by every pipeline). See
 * docs/coalesce-mapping-entry-field-writes.md.
 *
 * Conservative gates keep the struct-field-order rebuild sound: same collection + structurally-equal, side-effect-free
 * keys; whole-field writes only (keys.length == keyCount); no value reads the same entry; no value has side effects.
 */
export default class CoalesceMappingEntryFieldWrites extends AstTraversal {
  private counter = 0;
  private mappings = new Map<string, { keyCount: number; struct: StructType }>();

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.mappings = new Map();
    for (const col of node.collections) {
      if (!col.sorted || !(col.type instanceof MappingType)) continue;
      let vt: Type = col.type;
      let keyCount = 0;
      while (vt instanceof MappingType) { keyCount++; vt = vt.valueType; }
      if (vt instanceof StructType) this.mappings.set(col.name, { keyCount, struct: vt });
    }
    if (this.mappings.size === 0) return node;
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    return node;
  }

  visitBlock(node: BlockNode): Node {
    if (node.statements) node.statements = this.coalesce(node.statements);
    return super.visitBlock(node);
  }

  private coalesce(statements: StatementNode[]): StatementNode[] {
    const out: StatementNode[] = [];
    let i = 0;
    while (i < statements.length) {
      const first = this.matchWrite(statements[i]);
      if (!first) { out.push(statements[i]); i += 1; continue; }
      const run: MappingFieldAssignNode[] = [statements[i] as MappingFieldAssignNode];
      let j = i + 1;
      while (j < statements.length) {
        const u = this.matchWrite(statements[j]);
        if (!u || u.name !== first.name || !this.keysEqual(u.keys, first.keys)) break;
        run.push(statements[j] as MappingFieldAssignNode);
        j += 1;
      }
      const built = run.length >= 2 ? this.build(run, first) : undefined;
      if (built) out.push(built);
      else for (let k = i; k < j; k += 1) out.push(statements[k]);
      i = j;
    }
    return out;
  }

  // A whole-field write to a sorted struct mapping entry: `m[k..].field = v`, keys.length == the mapping's key count
  // (an array-ELEMENT write has an extra key), no deeper member chain, and the field is a real struct field.
  private matchWrite(stmt: StatementNode): { name: string; keys: ExpressionNode[]; struct: StructType } | null {
    if (!(stmt instanceof MappingFieldAssignNode)) return null;
    if (stmt.trailingMembers && stmt.trailingMembers.length > 0) return null;
    const info = this.mappings.get(stmt.name);
    if (!info || stmt.keys.length !== info.keyCount) return null;
    if (!info.struct.fields.some((f) => f.name === stmt.fieldName)) return null;
    if (!stmt.keys.every((k) => this.isPure(k))) return null;
    return { name: stmt.name, keys: stmt.keys, struct: info.struct };
  }

  private build(
    run: MappingFieldAssignNode[], first: { struct: StructType; keys: ExpressionNode[] },
  ): StatementNode | undefined {
    const { struct } = first;
    // Gate: no value reads the same entry, and no value has side effects (so a struct-field-order rebuild is a
    // sound reorder of the per-statement writes).
    for (const w of run) {
      if (this.readsEntry(w.expression, w.name, w.keys) || this.hasSideEffects(w.expression)) return undefined;
    }
    // Last write wins per field.
    const written = new Map<string, ExpressionNode>();
    for (const w of run) written.set(w.fieldName, w.expression);

    const loc = run[0].location;
    const stmts: StatementNode[] = [];
    const allWritten = struct.fields.every((f) => written.has(f.name));

    let tmpName: string | undefined;
    if (!allWritten) {
      tmpName = `__mefw_${this.counter++}`;
      const decl = new VariableDefinitionNode(struct, [], tmpName, this.entryRead(run[0].name, run[0].keys, loc));
      decl.location = loc;
      stmts.push(decl);
    }

    const ctorArgs = struct.fields.map((f) => {
      const v = written.get(f.name);
      if (v) return cloneNode(v) as ExpressionNode;
      const fa = new FieldAccessNode(this.ident(tmpName!, loc), f.name);
      fa.location = loc;
      return fa;
    });
    const ctor = new FunctionCallNode(this.ident(struct.name, loc), ctorArgs);
    ctor.location = loc;
    const write = new MappingAssignNode(run[0].name, run[0].keys.map((k) => cloneNode(k) as ExpressionNode), ctor);
    write.location = loc;
    stmts.push(write);

    const block = new BlockNode(stmts);
    block.location = loc;
    return block;
  }

  // `m[k0]..[kn]` as a nested ArrayAccess read (resolved to a mapping read downstream).
  private entryRead(name: string, keys: ExpressionNode[], loc: Node['location']): ExpressionNode {
    let read: ExpressionNode = this.ident(name, loc);
    for (const k of keys) {
      const acc = new ArrayAccessNode(read, cloneNode(k) as ExpressionNode);
      acc.location = loc;
      read = acc;
    }
    return read;
  }

  // Does `expr` read the same mapping entry `name[keys]` (any `m[keys]` access, incl. as the base of `m[keys].f`)?
  private readsEntry(expr: ExpressionNode, name: string, keys: ExpressionNode[]): boolean {
    let found = false;
    const walk = (n: Node): void => {
      if (found) return;
      if (n instanceof ArrayAccessNode || n instanceof MappingAccessNode) {
        const { base, accessKeys } = this.flatten(n);
        if (base instanceof IdentifierNode && base.name === name && this.keysEqual(accessKeys, keys)) {
          found = true;
          return;
        }
      }
      for (const k of Object.keys(n)) {
        if (k === 'location' || k === 'type' || k === 'symbolTable' || k === 'definition' || k === 'collection') continue;
        const v = (n as unknown as Record<string, unknown>)[k];
        if (v instanceof Node) walk(v);
        else if (Array.isArray(v)) for (const x of v) if (x instanceof Node) walk(x);
      }
    };
    walk(expr);
    return found;
  }

  private flatten(node: ExpressionNode): { base: ExpressionNode; accessKeys: ExpressionNode[] } {
    const accessKeys: ExpressionNode[] = [];
    let cur: ExpressionNode = node;
    while (cur instanceof ArrayAccessNode) { accessKeys.unshift(cur.index); cur = cur.array; }
    if (cur instanceof MappingAccessNode) {
      return { base: this.ident(cur.name, node.location), accessKeys: [...cur.keys, ...accessKeys] };
    }
    return { base: cur, accessKeys };
  }

  // A side effect that field-order evaluation could reorder: a call (function / instantiation / indirect) or an
  // embedded assignment. Pure reads / arithmetic / casts / literals are order-independent.
  private hasSideEffects(expr: ExpressionNode): boolean {
    let found = false;
    const walk = (n: Node): void => {
      if (found) return;
      if (n instanceof FunctionCallNode || n instanceof InstantiationNode
        || n instanceof IndirectCallNode || n instanceof AssignmentExpressionNode) { found = true; return; }
      for (const k of Object.keys(n)) {
        if (k === 'location' || k === 'type' || k === 'symbolTable' || k === 'definition' || k === 'collection') continue;
        const v = (n as unknown as Record<string, unknown>)[k];
        if (v instanceof Node) walk(v);
        else if (Array.isArray(v)) for (const x of v) if (x instanceof Node) walk(x);
      }
    };
    walk(expr);
    return found;
  }

  // A key that can be evaluated twice (at the read and the write) with no observable difference.
  private isPure(expr: ExpressionNode): boolean {
    if (expr instanceof IdentifierNode || expr instanceof IntLiteralNode || expr instanceof BoolLiteralNode
      || expr instanceof HexLiteralNode || expr instanceof StringLiteralNode) return true;
    if (expr instanceof FieldAccessNode) return this.isPure(expr.expression);
    if (expr instanceof CastNode) return this.isPure(expr.expression);
    if (expr instanceof ArrayAccessNode) return this.isPure(expr.array) && this.isPure(expr.index);
    return false;
  }

  private keysEqual(a: ExpressionNode[], b: ExpressionNode[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((k, i) => this.exprEqual(k, b[i]));
  }

  private exprEqual(a: ExpressionNode, b: ExpressionNode): boolean {
    if (a instanceof IdentifierNode && b instanceof IdentifierNode) return a.name === b.name;
    if (a instanceof IntLiteralNode && b instanceof IntLiteralNode) return a.value === b.value;
    if (a instanceof BoolLiteralNode && b instanceof BoolLiteralNode) return a.value === b.value;
    if (a instanceof FieldAccessNode && b instanceof FieldAccessNode) {
      return a.name === b.name && this.exprEqual(a.expression, b.expression);
    }
    if (a instanceof CastNode && b instanceof CastNode) return this.exprEqual(a.expression, b.expression);
    if (a instanceof ArrayAccessNode && b instanceof ArrayAccessNode) {
      return this.exprEqual(a.array, b.array) && this.exprEqual(a.index, b.index);
    }
    return false;
  }

  private ident(name: string, loc: Node['location']): IdentifierNode {
    const id = new IdentifierNode(name);
    id.location = loc;
    return id;
  }
}
