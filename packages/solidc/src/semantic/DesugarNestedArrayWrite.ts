import { ArrayType, StructType, Type, isChunkPackableElementType } from '@solidcash/utils';
import {
  Node,
  SourceFileNode,
  ContractNode,
  BlockNode,
  StatementNode,
  FunctionDefinitionNode,
  ParameterNode,
  VariableDefinitionNode,
  MappingAssignNode,
  MappingFieldAssignNode,
  ArrayAssignNode,
  StateArrayAssignNode,
  ArrayAccessNode,
  ArrayPushNode,
  ArrayPopNode,
  FieldAccessNode,
  FunctionCallNode,
  IdentifierNode,
  ExpressionNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/**
 * Lowers a write to a NESTED local (memory) array element, e.g. `b[i][j] = v` where `b` is a local/param
 * `T[][]`. The parser makes a MappingAssignNode with >1 key (indistinguishable from a nested mapping write at
 * parse time), which the symbol table would reject as an undefined mapping. Reads `b[i][j]` already work (an
 * ArrayAccess chain) and single-level writes `b[i] = x` work (ArrayAssignNode); a nested write desugars into a
 * read-modify-write over those working forms:
 *
 *   b[i][j] = v   ->   T tmp = b[i];  tmp[j] = v;  b[i] = tmp;
 *
 * Generalises to any depth by reading down to the innermost array, writing the last index, then writing each
 * intermediate array back up the chain. Only fires when the base is a known LOCAL/param array (nested mappings
 * are state vars, never locals, so a state `m[a][b]=v` is left untouched). Runs pre-semantic; each temp is typed
 * from the base's DECLARED element type (syntactically known), so the emitted temps type-check normally.
 */
export default class DesugarNestedArrayWrite extends AstTraversal {
  private locals = new Map<string, Type>();
  // Fixed-inner nested state arrays (`uint256[N][]`): chunk-packed, so `a[i]` is a whole-row state read/write.
  // A nested write `a[i][j] = v` desugars like the local case, but the base write-back is a StateArrayAssign.
  private stateArrays = new Map<string, Type>();
  private counter = 0;

  visitSourceFile(node: SourceFileNode): Node {
    node.importedContracts = this.visitList(node.importedContracts) as ContractNode[];
    node.freeFunctions = this.visitList(node.freeFunctions) as FunctionDefinitionNode[];
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.stateArrays = new Map();
    for (const sv of node.stateVariables) {
      if (sv.type instanceof ArrayType && sv.type.elementType instanceof ArrayType
        && isChunkPackableElementType(sv.type.elementType)) {
        this.stateArrays.set(sv.name, sv.type);
      }
    }
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const saved = this.locals;
    this.locals = new Map();
    for (const p of node.parameters) if (p instanceof ParameterNode) this.locals.set(p.name, p.type);
    this.collectLocals(node.body);
    node.body = this.visit(node.body) as BlockNode;
    this.locals = saved;
    return node;
  }

  // Record every local declaration's declared type so a nested write can be typed + recognised.
  private collectLocals(node: Node): void {
    if (node instanceof VariableDefinitionNode) this.locals.set(node.name, node.type);
    for (const key of Object.keys(node)) {
      const val = (node as any)[key];
      if (val instanceof Node) this.collectLocals(val);
      else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) this.collectLocals(v);
    }
  }

  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const visited = this.visit(stmt) as StatementNode;
      const desugared = visited instanceof MappingAssignNode
        ? (this.tryDesugar(visited) ?? this.tryDesugarNestedPushPop(visited))
        : visited instanceof MappingFieldAssignNode
          ? this.tryDesugarLocalStructArrayField(visited)
          : undefined;
      if (desugared) out.push(...desugared);
      else out.push(visited);
    }
    node.statements = out;
    return node;
  }

  // `a[i].push(v)` / `a[i].pop()` on a nested state array (`uint256[][]`): a read-modify-write of row i via a
  // local push/pop -> `T[] t = a[i]; t.push(v); a[i] = t;`. Returns undefined if not applicable.
  private tryDesugarNestedPushPop(node: MappingAssignNode): StatementNode[] | undefined {
    if (!(node.arrayPush || node.arrayPop) || node.keys.length !== 1) return undefined;
    const isState = !this.locals.has(node.name) && this.stateArrays.has(node.name);
    if (!isState) return undefined;
    const rowType = (this.stateArrays.get(node.name) as ArrayType).elementType;
    if (!(rowType instanceof ArrayType)) return undefined; // only nested (element is itself an array)

    const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;
    const tmpName = `__np_tmp_${this.counter++}`;
    const read = new ArrayAccessNode(this.ident(node.name, node), clone(node.keys[0]));
    read.location = node.location;
    const decl = new VariableDefinitionNode(rowType, [], tmpName, read);
    decl.location = node.location;

    let op: StatementNode;
    if (node.arrayPush) {
      const push = new ArrayPushNode(tmpName, node.expression);
      push.noArg = node.noArg;
      op = push;
    } else {
      op = new ArrayPopNode(tmpName);
    }
    op.location = node.location;

    const back = new StateArrayAssignNode(node.name, clone(node.keys[0]), this.ident(tmpName, node));
    back.location = node.location;
    return [decl, op, back];
  }

  // `m[i].f = v` where m is a LOCAL struct array (`S[] memory`): the parser makes a MappingFieldAssignNode which
  // the symbol table rejects (m is not a state collection). Reads `m[i].f` and whole-element writes `m[i] = S(..)`
  // already work, so rebuild the element with field f replaced: `m[i] = S(m[i].f0, .., v, ..)`. Only a LOCAL
  // struct array fires here - a state struct array handles a simple field write in place.
  private tryDesugarLocalStructArrayField(node: MappingFieldAssignNode): StatementNode[] | undefined {
    if (node.keys.length !== 1) return undefined;
    const baseType = this.locals.get(node.name);
    if (!(baseType instanceof ArrayType) || !(baseType.elementType instanceof StructType)) return undefined;
    const struct = baseType.elementType;
    if (!struct.fields.some((f) => f.name === node.fieldName)) return undefined;

    const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;
    const elemRead = (field: string): ExpressionNode => {
      const acc = new ArrayAccessNode(this.ident(node.name, node), clone(node.keys[0]));
      acc.location = node.location;
      const fa = new FieldAccessNode(acc, field);
      fa.location = node.location;
      return fa;
    };
    const ctor = new FunctionCallNode(
      this.ident(struct.name, node),
      struct.fields.map((f) => (f.name === node.fieldName ? node.expression : elemRead(f.name))),
    );
    ctor.location = node.location;
    const assign = new ArrayAssignNode(node.name, clone(node.keys[0]), ctor);
    assign.location = node.location;
    return [assign];
  }

  // `b[k0]..[kn] = v` on a local nested array -> read-modify-write statements; undefined if not applicable.
  private tryDesugar(node: MappingAssignNode): StatementNode[] | undefined {
    if (node.keys.length < 2) return undefined;
    // A local shadows a state var of the same name; the base is a state array only when no local matches.
    const isState = !this.locals.has(node.name) && this.stateArrays.has(node.name);
    const baseType = this.locals.get(node.name) ?? this.stateArrays.get(node.name);
    if (!(baseType instanceof ArrayType)) return undefined;

    const keys = node.keys;
    const m = keys.length;
    const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;

    // Read down to the innermost array: tmp0 = base[k0]; tmp1 = tmp0[k1]; ... typing each temp from the
    // declared element types. Bail if the declared type is not nested enough (let the type checker report it).
    const stmts: StatementNode[] = [];
    const tmpNames: string[] = [];
    let curType: Type = baseType;
    let curRead: ExpressionNode = this.ident(node.name, node);
    for (let i = 0; i < m - 1; i++) {
      if (!(curType instanceof ArrayType)) return undefined;
      const elemType: Type = curType.elementType;
      const tmpName = `__na_tmp_${this.counter++}`;
      const access = new ArrayAccessNode(curRead, clone(keys[i]));
      access.location = node.location;
      const decl = new VariableDefinitionNode(elemType, [], tmpName, access);
      decl.location = node.location;
      stmts.push(decl);
      tmpNames.push(tmpName);
      curType = elemType;
      curRead = this.ident(tmpName, node);
    }

    // Write the last index into the innermost temp.
    const lastWrite = new ArrayAssignNode(tmpNames[m - 2], clone(keys[m - 1]), node.expression);
    lastWrite.location = node.location;
    stmts.push(lastWrite);

    // Write each intermediate temp back up the chain, then the base.
    for (let i = m - 2; i >= 1; i--) {
      const back = new ArrayAssignNode(tmpNames[i - 1], clone(keys[i]), this.ident(tmpNames[i], node));
      back.location = node.location;
      stmts.push(back);
    }
    // The base write-back is a state element write for a state array (`a[i] = tmp`), a local write otherwise.
    const baseWrite = isState
      ? new StateArrayAssignNode(node.name, clone(keys[0]), this.ident(tmpNames[0], node))
      : new ArrayAssignNode(node.name, clone(keys[0]), this.ident(tmpNames[0], node));
    baseWrite.location = node.location;
    stmts.push(baseWrite);

    return stmts;
  }

  private ident(name: string, at: Node): IdentifierNode {
    const id = new IdentifierNode(name);
    id.location = at.location;
    return id;
  }
}
