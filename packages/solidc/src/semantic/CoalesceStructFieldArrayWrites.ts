import { ArrayType } from '@solidcash/utils';
import {
  Node,
  StatementNode,
  BlockNode,
  VariableDefinitionNode,
  ArrayAssignNode,
  AssignNode,
  FunctionCallNode,
  FieldAccessNode,
  IdentifierNode,
  ArrayNode,
  ExpressionNode,
  IntLiteralNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/**
 * Coalesce a run of consecutive element writes to the SAME fixed-array FIELD of the SAME `memory` struct local.
 *
 *   escrow.split[0]=a; escrow.split[1]=b; escrow.split[2]=c; escrow.split[3]=d;
 *
 * The front end (AstBuilder for same-file structs, RedesugarImportedStructFieldWrites for imported ones) desugars
 * each element write into its own read-modify-REBUILD triple - read the whole field into a temp, write one element,
 * then rebuild the WHOLE struct via its constructor. So N element writes = N whole-struct reconstructions, all but
 * the last immediately overwritten. This pass collapses the run to ONE read + N element writes + ONE rebuild, and
 * when the writes are constant-indexed and tile the whole array (no self-read) to a single array-literal rebuild
 * with no field read at all. See docs/coalesce-struct-field-array-writes.md.
 *
 * Runs after RedesugarImportedStructFieldWrites (imported triples exist) and before LowerMemoryModel.
 */
export default class CoalesceStructFieldArrayWrites extends AstTraversal {
  private counter = 0;

  visitBlock(node: BlockNode): Node {
    if (node.statements) node.statements = this.coalesce(node.statements);
    return super.visitBlock(node); // recurse into nested blocks / branch bodies
  }

  private coalesce(statements: StatementNode[]): StatementNode[] {
    const out: StatementNode[] = [];
    let i = 0;
    while (i < statements.length) {
      const first = this.matchUnit(statements, i);
      if (!first) { out.push(statements[i]); i += 1; continue; }
      // Extend the run over consecutive units on the same (base, field).
      const run: MatchedUnit[] = [first];
      let j = i + first.consumed;
      while (j < statements.length) {
        const u = this.matchUnit(statements, j);
        if (!u || u.base !== first.base || u.field !== first.field) break;
        run.push(u);
        j += u.consumed;
      }
      if (run.length >= 2) {
        out.push(this.build(run));
      } else {
        for (let k = i; k < j; k += 1) out.push(statements[k]);
      }
      i = j;
    }
    return out;
  }

  // Emit the coalesced replacement for a run: one field read + all element writes + one rebuild, wrapped in a
  // block. Falls to a single array-literal rebuild (no read) when the run tiles the whole array with constants and
  // no value reads the field.
  private build(run: MatchedUnit[]): StatementNode {
    const last = run[run.length - 1];
    const loc = run[0].loc;
    const id = (n: string): IdentifierNode => { const x = new IdentifierNode(n); x.location = loc; return x; };

    const tmp = `__csf_${this.counter++}`;
    // Rewrite each value's reads of the field-being-written to the running temp: both `base.FIELD` (source-level
    // self-read) and the unit's OWN read temp (a compound/postfix write's value reads `__nlv_k[i]`). Both denote
    // the current field value, which the running temp accumulates; preserves cross-index self-reads.
    const writes = run.map((u) => this.rewriteArrayReads(cloneNode(u.value) as ExpressionNode, u.base, u.field, u.tmp, tmp));
    const anySelfRead = writes.some((w) => w.changed);

    if (!anySelfRead && this.tilesWholeArray(run, last.arrayType)) {
      // W2: single array-literal rebuild in index order, no field read.
      const ordered = [...run].sort((a, b) => Number((a.index as IntLiteralNode).value - (b.index as IntLiteralNode).value));
      const literal = new ArrayNode(ordered.map((u) => cloneNode(u.value) as ExpressionNode));
      literal.location = loc;
      const rebuild = this.rebuildWith(last, literal, id);
      return this.wrap([rebuild], loc);
    }

    // W1: read once, write each element into the temp, rebuild once.
    const stmts: StatementNode[] = [];
    const decl = new VariableDefinitionNode(last.arrayType, [], tmp,
      this.fieldAccess(last.base, last.field, loc));
    decl.location = loc;
    stmts.push(decl);
    for (let k = 0; k < run.length; k += 1) {
      const w = new ArrayAssignNode(tmp, cloneNode(run[k].index) as ExpressionNode, writes[k].expr);
      w.location = run[k].loc;
      stmts.push(w);
    }
    stmts.push(this.rebuildWith(last, id(tmp), id));
    return this.wrap(stmts, loc);
  }

  private wrap(stmts: StatementNode[], loc: Node['location']): BlockNode {
    const block = new BlockNode(stmts);
    block.location = loc;
    return block;
  }

  // The run's rebuild, using the LAST unit's constructor with the FIELD argument replaced by `fieldValue`.
  private rebuildWith(last: MatchedUnit, fieldValue: ExpressionNode, id: (n: string) => IdentifierNode): AssignNode {
    const ctor = cloneNode(last.ctor) as FunctionCallNode;
    ctor.parameters[last.fieldPos] = fieldValue;
    const assign = new AssignNode(id(last.base), ctor);
    assign.location = last.loc;
    return assign;
  }

  private fieldAccess(base: string, field: string, loc: Node['location']): FieldAccessNode {
    const b = new IdentifierNode(base); b.location = loc;
    const fa = new FieldAccessNode(b, field); fa.location = loc;
    return fa;
  }

  // Indices are distinct integer literals covering exactly {0 .. bound-1} of the fixed array.
  private tilesWholeArray(run: MatchedUnit[], arrayType: ArrayType): boolean {
    const bound = arrayType.bound;
    if (typeof bound !== 'number' || bound <= 0 || run.length !== bound) return false;
    const seen = new Set<number>();
    for (const u of run) {
      if (!(u.index instanceof IntLiteralNode)) return false;
      const n = Number(u.index.value);
      if (!Number.isInteger(n) || n < 0 || n >= bound || seen.has(n)) return false;
      seen.add(n);
    }
    return seen.size === bound;
  }

  // Match a struct-field array-element-write unit at `statements[i]`: either the BlockNode-wrapped triple (imported
  // structs) or the flat 3-statement triple (same-file structs). Returns the unit + how many statements it spans.
  private matchUnit(statements: StatementNode[], i: number): MatchedUnit | null {
    const s0 = statements[i];
    if (s0 instanceof BlockNode && !s0.scoped && s0.statements?.length === 3) {
      const u = this.matchTriple(s0.statements[0], s0.statements[1], s0.statements[2]);
      if (u) return { ...u, consumed: 1 };
    }
    if (i + 2 < statements.length) {
      const u = this.matchTriple(statements[i], statements[i + 1], statements[i + 2]);
      if (u) return { ...u, consumed: 3 };
    }
    return null;
  }

  // The read-modify-rebuild triple: `tmp = base.FIELD; tmp[idx] = val; base = Struct(tmp at fieldPos, base.other..)`.
  private matchTriple(a: StatementNode, b: StatementNode, c: StatementNode): Omit<MatchedUnit, 'consumed'> | null {
    if (!(a instanceof VariableDefinitionNode) || !(a.type instanceof ArrayType)) return null;
    // Fixed-size array fields only (bound is a positive integer). Dynamic array fields (uint[]) are excluded -
    // their rebuild has length-dependent subtleties and they are not the coalescing target.
    if (typeof a.type.bound !== 'number' || a.type.bound <= 0) return null;
    if (!isTemp(a.name) || !(a.expression instanceof FieldAccessNode)) return null;
    const fieldRead = a.expression;
    if (!(fieldRead.expression instanceof IdentifierNode)) return null;
    const base = fieldRead.expression.name;
    const field = fieldRead.name;
    const tmp = a.name;

    if (!(b instanceof ArrayAssignNode) || b.name !== tmp) return null;

    if (!(c instanceof AssignNode) || !(c.identifier instanceof IdentifierNode) || c.identifier.name !== base) return null;
    if (!(c.expression instanceof FunctionCallNode)) return null;
    const ctor = c.expression;
    let fieldPos = -1;
    for (let k = 0; k < ctor.parameters.length; k += 1) {
      const p = ctor.parameters[k];
      if (p instanceof IdentifierNode && p.name === tmp) {
        if (fieldPos !== -1) return null; // temp must appear exactly once
        fieldPos = k;
      } else if (!(p instanceof FieldAccessNode && p.expression instanceof IdentifierNode && p.expression.name === base)) {
        return null; // every other arg must be a pure base.field read
      }
    }
    if (fieldPos === -1) return null;

    return { base, field, tmp, fieldPos, index: b.index, value: b.value, ctor, arrayType: a.type, loc: a.location };
  }

  // Clone-and-rewrite: replace every read of `base.FIELD` and every read of the unit's own temp `unitTmp` with
  // `Identifier(dest)`; report whether any were found (a self-read of the field being written).
  private rewriteArrayReads(
    expr: ExpressionNode, base: string, field: string, unitTmp: string, dest: string,
  ): { expr: ExpressionNode; changed: boolean } {
    let changed = false;
    const walk = (n: Node): Node => {
      if (n instanceof IdentifierNode && n.name === unitTmp) {
        changed = true;
        const rep = new IdentifierNode(dest); rep.location = n.location;
        return rep;
      }
      if (n instanceof FieldAccessNode && n.name === field
        && n.expression instanceof IdentifierNode && n.expression.name === base) {
        changed = true;
        const rep = new IdentifierNode(dest); rep.location = n.location;
        return rep;
      }
      for (const k of Object.keys(n)) {
        if (k === 'location' || k === 'type' || k === 'symbolTable' || k === 'definition') continue;
        const v = (n as unknown as Record<string, unknown>)[k];
        if (v instanceof Node) (n as unknown as Record<string, unknown>)[k] = walk(v);
        else if (Array.isArray(v)) for (let x = 0; x < v.length; x += 1) if (v[x] instanceof Node) v[x] = walk(v[x] as Node);
      }
      return n;
    };
    const rewritten = walk(expr) as ExpressionNode;
    return { expr: rewritten, changed };
  }
}

interface MatchedUnit {
  base: string;
  field: string;
  tmp: string;
  fieldPos: number;
  index: ExpressionNode;
  value: ExpressionNode;
  ctor: FunctionCallNode;
  arrayType: ArrayType;
  loc: Node['location'];
  consumed: number;
}

// A fresh front-end lvalue temp: `__nlv_*` (same-file struct) or `__inlv_*` (imported struct).
function isTemp(name: string): boolean {
  return /^__i?nlv_\d+$/.test(name);
}
