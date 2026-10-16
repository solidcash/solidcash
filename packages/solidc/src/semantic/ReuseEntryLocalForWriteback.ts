import { MappingType, StructType, type Type } from '@solidcash/utils';
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
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/**
 * Reuse an entry-read local for a whole-struct write-back (Unicrow `refund`):
 *
 *   Escrow e = escrows[id];
 *   e.split = a; e.consensus = b;
 *   escrows[id].split = e.split; escrows[id].consensus = e.consensus; escrows[id].claimed = 1;
 *     -> Escrow e = escrows[id]; e.split = a; e.consensus = b;
 *        escrows[id] = Escrow(e.participant, e.releaser, e.amount, e.split, e.consensus, 1);
 *
 * `CoalesceMappingEntryFieldWrites` already folds the field-write run into one whole-struct write, but it reads
 * the entry AGAIN into a fresh snapshot for the untouched fields. When the entry was already read into a local
 * `e`, that local still holds the same snapshot (the write-back run writes every field `e` was modified in), so
 * the fresh read is redundant. This pass runs BEFORE CoalesceMappingEntryFieldWrites and pre-empts an eligible run
 * with a whole-struct write whose untouched fields come from `e`.
 *
 * Conservative gates (fail closed = keep the original statements): a straight-line region only (no control flow),
 * `e` is never whole-reassigned or passed to a call, no write to the entry before the run, and every field of `e`
 * modified in that region is written by the run (so untouched fields still equal storage).
 */
export default class ReuseEntryLocalForWriteback extends AstTraversal {
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
      while (vt instanceof MappingType) { keyCount += 1; vt = vt.valueType; }
      if (vt instanceof StructType) this.mappings.set(col.name, { keyCount, struct: vt });
    }
    if (this.mappings.size === 0) return node;
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    return super.visitFunctionDefinition(node);
  }

  visitBlock(node: BlockNode): Node {
    if (node.statements) node.statements = this.rewrite(node.statements);
    return super.visitBlock(node);
  }

  private rewrite(statements: StatementNode[]): StatementNode[] {
    const out: StatementNode[] = [];
    let i = 0;
    while (i < statements.length) {
      const read = this.matchRead(statements[i]);
      if (!read) { out.push(statements[i]); i += 1; continue; }

      // Forward-scan: track the write-back run of `m[k].f = ..` and every field of `e` modified before it.
      const run: MappingFieldAssignNode[] = [];
      const modified = new Set<string>();
      let runStart = -1;
      let runEnd = -1;
      let j = i + 1;
      let sound = true;
      while (j < statements.length && sound) {
        const stmt = statements[j];
        if (run.length > 0) {
          // The run has started; only consecutive run writes extend it.
          if (stmt instanceof MappingFieldAssignNode && this.isRunWrite(stmt, read)) {
            run.push(stmt);
            runEnd = j;
          } else {
            break;
          }
        } else if (stmt instanceof MappingFieldAssignNode && this.isRunWrite(stmt, read)) {
          run.push(stmt);
          runStart = j;
          runEnd = j;
        } else if (stmt instanceof AssignNode && stmt.identifier instanceof IdentifierNode
          && stmt.identifier.name === read.local) {
          // `e.x = v` desugars to a whole-struct rebuild `e = S(e.f0, .., v, ..)`; track the modified field. Any
          // other whole assignment (`e = other`) invalidates the snapshot.
          const field = this.modifiedLocalField(stmt, read);
          if (field !== undefined) modified.add(field);
          else sound = false;
        } else if (stmt instanceof VariableDefinitionNode && stmt.name === read.local) {
          sound = false; // redeclaration
        } else if (this.escapesLocal(stmt, read.local) || this.isControlFlow(stmt)
          || this.writesEntry(stmt, read.name, read.keys)) {
          sound = false;
        }
        j += 1;
      }

      const written = new Set(run.map((entry) => entry.fieldName));
      if (!sound || run.length < 2 || !this.subset(modified, written)) {
        out.push(statements[i]);
        i += 1;
        continue;
      }
      const built = this.build(run, read);
      if (!built) { out.push(statements[i]); i += 1; continue; }

      // Keep the entry-read declaration and the `e.f = v` modifications (they make `e` the desired final value),
      // drop the write-back run, and append the single whole-struct write.
      for (let k = i; k < runStart; k += 1) out.push(statements[k]);
      out.push(built);
      i = runEnd + 1;
    }
    return out;
  }

  private build(
    run: MappingFieldAssignNode[],
    read: { name: string; keys: ExpressionNode[]; struct: StructType; local: string },
  ): StatementNode | undefined {
    const { struct } = read;
    for (const { expression } of run) {
      if (this.hasCall(expression)) return undefined;
    }
    const written = new Map(run.map((stmt) => [stmt.fieldName, stmt.expression]));
    const ctorArgs = struct.fields.map((field) => {
      const value = written.get(field.name);
      if (value) return cloneNode(value) as ExpressionNode;
      const fa = new FieldAccessNode(this.ident(read.local, run[0].location), field.name);
      fa.location = run[0].location;
      return fa;
    });
    const ctor = new FunctionCallNode(this.ident(struct.name, run[0].location), ctorArgs);
    ctor.location = run[0].location;
    const write = new MappingAssignNode(read.name, read.keys.map((key) => cloneNode(key) as ExpressionNode), ctor);
    write.location = run[0].location;
    return write;
  }

  private matchRead(
    stmt: StatementNode,
  ): { name: string; keys: ExpressionNode[]; struct: StructType; local: string } | undefined {
    if (!(stmt instanceof VariableDefinitionNode) || !(stmt.type instanceof StructType)) return undefined;
    const entry = this.flattenRead(stmt.expression);
    if (!entry) return undefined;
    const info = this.mappings.get(entry.name);
    if (!info || entry.keys.length !== info.keyCount) return undefined;
    return { name: entry.name, keys: entry.keys, struct: info.struct, local: stmt.name };
  }

  private flattenRead(
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

  private isRunWrite(
    stmt: MappingFieldAssignNode,
    read: { name: string; keys: ExpressionNode[] },
  ): boolean {
    return stmt.name === read.name && (stmt.trailingMembers?.length ?? 0) === 0
      && this.keysEqual(stmt.keys, read.keys) && this.isPure(stmt.keys);
  }

  // `e.x = v` parses to a whole-struct rebuild `e = S(e.f0, .., v, ..)`. Return the modified field, or undefined
  // when the assignment is not exactly that single-field rebuild shape.
  private modifiedLocalField(
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

  private escapesLocal(stmt: StatementNode, local: string): boolean {
    let found = false;
    const walk = (n: Node): void => {
      if (found) return;
      if (n instanceof FunctionCallNode && this.readsName(n, local)) { found = true; return; }
      for (const [key, value] of Object.entries(n)) {
        if (key === 'location' || key === 'type' || key === 'symbolTable') continue;
        if (value instanceof Node) walk(value);
        else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
      }
    };
    walk(stmt);
    return found;
  }

  private readsName(node: Node, name: string): boolean {
    if (node instanceof IdentifierNode && node.name === name) return true;
    let found = false;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'location' || key === 'type' || key === 'symbolTable') continue;
      if (value instanceof Node) {
        if (this.readsName(value, name)) { found = true; break; }
      } else if (Array.isArray(value)) {
        for (const item of value) if (item instanceof Node && this.readsName(item, name)) { found = true; break; }
      }
    }
    return found;
  }

  private writesEntry(stmt: StatementNode, name: string, keys: ExpressionNode[]): boolean {
    if (stmt instanceof MappingAssignNode) return stmt.name === name && this.keysEqual(stmt.keys, keys);
    let found = false;
    const walk = (n: Node): void => {
      if (found) return;
      if (n instanceof MappingFieldAssignNode && n.name === name && this.keysEqual(n.keys, keys)) {
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

  private isControlFlow(stmt: StatementNode): boolean {
    return stmt instanceof BranchNode || stmt instanceof WhileNode || stmt instanceof DoWhileNode
      || stmt instanceof CollectionIterationNode;
  }

  private hasCall(expr: ExpressionNode): boolean {
    if (expr instanceof FunctionCallNode) return true;
    for (const [key, value] of Object.entries(expr)) {
      if (key === 'location' || key === 'type' || key === 'symbolTable') continue;
      if (value instanceof Node && this.hasCall(value as ExpressionNode)) return true;
      if (Array.isArray(value)) {
        for (const item of value) if (item instanceof Node && this.hasCall(item as ExpressionNode)) return true;
      }
    }
    return false;
  }

  private subset(a: Set<string>, b: Set<string>): boolean {
    for (const name of a) if (!b.has(name)) return false;
    return true;
  }

  private keysEqual(a: ExpressionNode[], b: ExpressionNode[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((key, i) => this.exprEqual(key, b[i]));
  }

  private exprEqual(a: ExpressionNode, b: ExpressionNode): boolean {
    if (a instanceof IdentifierNode && b instanceof IdentifierNode) return a.name === b.name;
    if (a.constructor.name !== b.constructor.name) return false;
    if (a instanceof ArrayAccessNode && b instanceof ArrayAccessNode) {
      return this.exprEqual(a.array, b.array) && this.exprEqual(a.index, b.index);
    }
    if (a instanceof FieldAccessNode && b instanceof FieldAccessNode) {
      return a.name === b.name && this.exprEqual(a.expression, b.expression);
    }
    return JSON.stringify(this.strip(a)) === JSON.stringify(this.strip(b));
  }

  private strip(node: Node): unknown {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === 'location' || key === 'type' || key === 'symbolTable' || key === 'definition') continue;
      if (value instanceof Node) out[key] = this.strip(value);
      else if (Array.isArray(value)) out[key] = value.map((item) => (item instanceof Node ? this.strip(item) : item));
      else out[key] = value;
    }
    return out;
  }

  private isPure(keys: ExpressionNode[]): boolean {
    return keys.every((key) => !this.hasCall(key));
  }

  private ident(name: string, loc: Node['location']): IdentifierNode {
    const id = new IdentifierNode(name);
    id.location = loc;
    return id;
  }
}
