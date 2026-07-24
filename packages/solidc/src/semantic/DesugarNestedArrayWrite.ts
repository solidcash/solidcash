import { ArrayType, MappingType, StructType, Type, isChunkPackableElementType } from '@solidcash/utils';
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
  MappingDeleteNode,
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
import { createDefaultValueExpression } from '../ast/defaults.js';

/**
 * Lowers a write to a NESTED local (memory) array element, e.g. `b[i][j] = v` where `b` is a local/param
 * `T[][]`. The parser makes a MappingAssignNode with >1 key (indistinguishable from a nested mapping write),
 * which the symbol table would reject as an undefined mapping. Reads `b[i][j]` and single-level writes
 * `b[i] = x` already work; a nested write desugars to a read-modify-write over those:
 *
 *   b[i][j] = v   ->   T tmp = b[i];  tmp[j] = v;  b[i] = tmp;
 *
 * Generalises to any depth by reading down to the innermost array, writing the last index, then writing each
 * intermediate array back up the chain. Only fires when the base is a known LOCAL/param array (nested mappings
 * are state vars, so a state `m[a][b]=v` is left untouched). Runs pre-semantic; each temp is typed from the
 * base's DECLARED element type, so the emitted temps type-check normally.
 */
export default class DesugarNestedArrayWrite extends AstTraversal {
  private locals = new Map<string, Type>();
  // Fixed-inner nested state arrays (`uint256[N][]`): chunk-packed, so `a[i]` is a whole-row state read/write.
  // A nested write `a[i][j] = v` desugars like the local case, but the base write-back is a StateArrayAssign.
  private stateArrays = new Map<string, Type>();
  // Mappings whose (innermost) value is an array: name -> { keyCount, valueType }. A `m[k..][i][j]=v` write to a
  // MULTI-dim array value desugars to a whole-value read + local nested write + whole-value write-back.
  private mappings = new Map<string, { keyCount: number; valueType: ArrayType }>();
  // Temp declarations hoisted out of the CURRENT statement's expressions (a 2D array-value READ `m[k][i][j]` becomes
  // `T[][] t = m[k]` hoisted here + an `t[i][j]` local read in place). Flushed before the statement in visitBlock.
  private pendingHoists: StatementNode[] = [];
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
    this.mappings = new Map();
    for (const col of node.collections) {
      let vt: Type = col.type;
      let keyCount = 0;
      while (vt instanceof MappingType) { keyCount++; vt = vt.valueType; }
      if (keyCount > 0 && vt instanceof ArrayType) this.mappings.set(col.name, { keyCount, valueType: vt });
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
    const savedHoists = this.pendingHoists;
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      this.pendingHoists = [];
      const visited = this.visit(stmt) as StatementNode;
      const myHoists = this.pendingHoists; // 2D array-value reads hoisted out of THIS statement
      const desugared = visited instanceof MappingAssignNode
        ? (this.tryDesugarNestedPushPop(visited) ?? this.tryDesugar(visited)
          ?? this.tryDesugarMappingArrayValue(visited))
        : visited instanceof MappingFieldAssignNode
          ? this.tryDesugarLocalStructArrayField(visited)
          : visited instanceof MappingDeleteNode
            ? this.tryDesugarLocalArrayDelete(visited)
            : undefined;
      out.push(...myHoists); // hoisted read temps evaluate before the statement that uses them
      if (desugared) out.push(...desugared);
      else out.push(visited);
    }
    this.pendingHoists = savedHoists;
    node.statements = out;
    return node;
  }

  // A 2D+ array-value READ `m[k0..][i][j]` (mapping value is a multi-dim array): reads parse as a nested
  // ArrayAccess chain (SymbolTable flattens it to a MappingAccess only later). Hoist the whole-value read into a
  // temp and index it locally -> `T[][] t = m[k0..]; ... t[i][j] ...`. Reuses the proven whole-value read + local
  // nested read. Short-circuits (does not recurse into the inner chain) so the inner accesses are not double-processed.
  visitArrayAccess(node: ArrayAccessNode): Node {
    const { base, keys } = this.flattenAccess(node);
    if (base instanceof IdentifierNode && !this.locals.has(base.name)) {
      const info = this.mappings.get(base.name);
      if (info) {
        let dims = 0; let t: Type = info.valueType;
        while (t instanceof ArrayType) { dims++; t = t.elementType; }
        const arrIdxCount = keys.length - info.keyCount;
        if (arrIdxCount >= 2 && arrIdxCount <= dims) {
          const visitedKeys = keys.map((k) => this.visit(k) as ExpressionNode);
          const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;
          const mapKeys = visitedKeys.slice(0, info.keyCount);
          const arrIdxs = visitedKeys.slice(info.keyCount);
          let read: ExpressionNode = this.ident(base.name, node);
          for (const k of mapKeys) { const acc = new ArrayAccessNode(read, clone(k)); acc.location = node.location; read = acc; }
          const tmpName = `__mar_tmp_${this.counter++}`;
          const decl = new VariableDefinitionNode(info.valueType, [], tmpName, read);
          decl.location = node.location;
          this.locals.set(tmpName, info.valueType);
          this.pendingHoists.push(decl);
          let repl: ExpressionNode = this.ident(tmpName, node);
          for (const idx of arrIdxs) { const acc = new ArrayAccessNode(repl, clone(idx)); acc.location = node.location; repl = acc; }
          return repl;
        }
      }
    }
    return super.visitArrayAccess(node);
  }

  private flattenAccess(node: ArrayAccessNode): { base: ExpressionNode; keys: ExpressionNode[] } {
    const keys: ExpressionNode[] = [];
    let cur: ExpressionNode = node;
    while (cur instanceof ArrayAccessNode) { keys.unshift(cur.index); cur = cur.array; }
    return { base: cur, keys };
  }

  // `a[i]...[j].push(v)` / `.pop()` on a nested state array: read the target array through locals, mutate it,
  // then rebuild every containing row. For one key this is `T[] t = a[i]; t.push(v); a[i] = t`; deeper keys
  // repeat the same read/write-back shape for each dimension.
  private tryDesugarNestedPushPop(node: MappingAssignNode): StatementNode[] | undefined {
    if (!(node.arrayPush || node.arrayPop) || node.keys.length < 1) return undefined;
    const isState = !this.locals.has(node.name) && this.stateArrays.has(node.name);
    if (!isState) return undefined;

    const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;
    const stmts: StatementNode[] = [];
    const tmpNames: string[] = [];
    let currentType: Type = this.stateArrays.get(node.name)!;
    let currentRead: ExpressionNode = this.ident(node.name, node);
    for (let i = 0; i < node.keys.length; i++) {
      if (!(currentType instanceof ArrayType)) return undefined;
      const elementType = currentType.elementType;
      const tmpName = `__np_tmp_${this.counter++}`;
      const read = new ArrayAccessNode(currentRead, clone(node.keys[i]));
      read.location = node.location;
      const decl = new VariableDefinitionNode(elementType, [], tmpName, read);
      decl.location = node.location;
      stmts.push(decl);
      tmpNames.push(tmpName);
      currentType = elementType;
      currentRead = this.ident(tmpName, node);
    }
    if (!(currentType instanceof ArrayType)) return undefined;

    let op: StatementNode;
    if (node.arrayPush) {
      const push = new ArrayPushNode(tmpNames.at(-1)!, node.expression);
      push.noArg = node.noArg;
      op = push;
    } else {
      op = new ArrayPopNode(tmpNames.at(-1)!);
    }
    op.location = node.location;
    stmts.push(op);

    for (let i = node.keys.length - 1; i >= 1; i--) {
      const back = new ArrayAssignNode(
        tmpNames[i - 1], clone(node.keys[i]), this.ident(tmpNames[i], node),
      );
      back.location = node.location;
      stmts.push(back);
    }
    const back = new StateArrayAssignNode(node.name, clone(node.keys[0]), this.ident(tmpNames[0], node));
    back.location = node.location;
    stmts.push(back);
    return stmts;
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

  // `delete d[k0]..[kn]` where d is a LOCAL or nested STATE array: parses as a MappingDeleteNode the symbol
  // table rejects (d is not a mapping). Solidity resets the element to its type default, so rewrite to
  // `d[k0]..[kn] = <default>` - a single-index write directly, a nested one via the read-modify-write desugar.
  // (A single-index STATE array delete routes to StateArrayDelete before ever reaching here.)
  private tryDesugarLocalArrayDelete(node: MappingDeleteNode): StatementNode[] | undefined {
    const baseType = this.locals.get(node.name) ?? this.stateArrays.get(node.name);
    if (!(baseType instanceof ArrayType)) return undefined;
    // Element type after node.keys.length index levels; bail (report at type-check) if not nested enough.
    let elemType: Type = baseType;
    for (let i = 0; i < node.keys.length; i++) {
      if (!(elemType instanceof ArrayType)) return undefined;
      elemType = elemType.elementType;
    }
    const def = createDefaultValueExpression(elemType, node.location!);
    if (node.keys.length === 1) {
      const assign = new ArrayAssignNode(node.name, cloneNode(node.keys[0]) as ExpressionNode, def);
      assign.location = node.location;
      return [assign];
    }
    // Multi-index `delete d[i][j]` -> `d[i][j] = default` via the nested-array write desugar.
    const write = new MappingAssignNode(node.name, node.keys.map((k) => cloneNode(k) as ExpressionNode), def);
    write.location = node.location;
    return this.tryDesugar(write);
  }

  // `m[k0..k_{kc-1}][i][j..] = v` where m is a mapping (kc keys) whose value is a MULTI-dim array: the parser makes
  // one MappingAssignNode with all indices. A 1-index array write (`m[k][i]=v`) already works (symbol table pops the
  // lone arrayIndex); a 2+-index write reads the whole array value into a local, does the nested local write, then
  // writes the value back: `T[][] t = m[k]; t[i][j] = v; m[k] = t;`. Reuses the proven whole-value RW + local desugar.
  private tryDesugarMappingArrayValue(node: MappingAssignNode): StatementNode[] | undefined {
    if (node.arrayPush || node.arrayPop) return undefined;
    if (this.locals.has(node.name)) return undefined; // a local shadows the mapping
    const info = this.mappings.get(node.name);
    if (!info) return undefined;
    const { keyCount, valueType } = info;
    let dims = 0; let t: Type = valueType;
    while (t instanceof ArrayType) { dims++; t = t.elementType; }
    const arrIdxCount = node.keys.length - keyCount;
    if (arrIdxCount < 2 || arrIdxCount > dims) return undefined; // only the multi-index element write

    const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;
    const mapKeys = node.keys.slice(0, keyCount);
    const arrIdxs = node.keys.slice(keyCount);

    // 1. Materialize the whole array value: `T[][] t = m[k0]..[k_{kc-1}]`.
    let read: ExpressionNode = this.ident(node.name, node);
    for (const k of mapKeys) { const acc = new ArrayAccessNode(read, clone(k)); acc.location = node.location; read = acc; }
    const tmpName = `__ma_tmp_${this.counter++}`;
    const decl = new VariableDefinitionNode(valueType, [], tmpName, read);
    decl.location = node.location;

    // 2. Nested local write `t[i][j..] = v` via the existing local desugar (t is now a known local array).
    this.locals.set(tmpName, valueType);
    const localWrite = new MappingAssignNode(tmpName, arrIdxs.map((k) => clone(k)), node.expression);
    localWrite.location = node.location;
    const localStmts = this.tryDesugar(localWrite);
    if (!localStmts) return undefined;

    // 3. Write the whole array value back: `m[k0]..[k_{kc-1}] = t`.
    const back = new MappingAssignNode(node.name, mapKeys.map((k) => clone(k)), this.ident(tmpName, node));
    back.location = node.location;

    return [decl, ...localStmts, back];
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
