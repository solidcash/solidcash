import { ArrayType, BytesType, MappingType, PrimitiveType, StructType, type Type } from '@solidcash/utils';
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
  MappingAccessNode,
  MappingFieldAssignNode,
  MappingDeleteNode,
  AssignNode,
  ArrayAssignNode,
  StateArrayAssignNode,
  StateArrayDeleteNode,
  ArrayAccessNode,
  ArrayPushNode,
  ArrayPopNode,
  FieldAccessNode,
  FunctionCallNode,
  IdentifierNode,
  StateAccessNode,
  ExpressionNode,
  LiteralNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { createDefaultValueExpression } from '../ast/defaults.js';
import { hasSideEffects, stateChangingFunctionNames } from './sideEffects.js';

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
  private stateStructArrays = new Map<string, StructType>();
  // Mappings whose (innermost) value is an array: name -> { keyCount, valueType }. A `m[k..][i][j]=v` write to a
  // MULTI-dim array value desugars to a whole-value read + local nested write + whole-value write-back.
  private mappings = new Map<string, { keyCount: number; keyTypes: Type[]; valueType: ArrayType }>();
  private mappingStructs = new Map<string, { keyCount: number; keyTypes: Type[]; valueType: StructType }>();
  private stateChanging = new Set<string>();
  // Temp declarations hoisted out of the CURRENT statement's expressions (a 2D array-value READ `m[k][i][j]` becomes
  // `T[][] t = m[k]` hoisted here + an `t[i][j]` local read in place). Flushed before the statement in visitBlock.
  private pendingHoists: StatementNode[] = [];
  private counter = 0;

  constructor(private readonly mappingArrayValueMinIndices = 2) {
    super();
  }

  visitSourceFile(node: SourceFileNode): Node {
    this.stateChanging = stateChangingFunctionNames(node);
    node.importedContracts = this.visitList(node.importedContracts) as ContractNode[];
    node.freeFunctions = this.visitList(node.freeFunctions) as FunctionDefinitionNode[];
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.stateArrays = new Map();
    this.stateStructArrays = new Map();
    for (const sv of node.stateVariables) {
      if (sv.type instanceof ArrayType) this.stateArrays.set(sv.name, sv.type);
      if (sv.type instanceof ArrayType && sv.type.elementType instanceof StructType) {
        this.stateStructArrays.set(sv.name, sv.type.elementType);
      }
    }
    this.mappings = new Map();
    this.mappingStructs = new Map();
    const recordMapping = (name: string, type: Type): void => {
      let vt: Type = type;
      const keyTypes: Type[] = [];
      while (vt instanceof MappingType) { keyTypes.push(vt.keyType); vt = vt.valueType; }
      const keyCount = keyTypes.length;
      if (keyCount > 0 && vt instanceof ArrayType) this.mappings.set(name, { keyCount, keyTypes, valueType: vt });
      if (keyCount > 0 && vt instanceof StructType) {
        this.mappingStructs.set(name, { keyCount, keyTypes, valueType: vt });
      }
    };
    for (const col of node.collections) recordMapping(col.name, col.type);
    for (const sv of node.stateVariables) recordMapping(sv.name, sv.type);
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
    for (const key in node) {
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
          ? (this.tryDesugarMappingArrayStructField(visited)
            ?? this.tryRebuildNestedMappingStructField(visited)
            ?? this.tryDesugarNestedStateStructField(visited)
            ?? this.tryDesugarLocalStructArrayField(visited)
            ?? this.tryDesugarLocalNestedStructArrayField(visited))
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

  // An array-value READ `m[k0..][i]...` (mapping value is an array): reads parse as a nested ArrayAccess
  // chain, or as `MappingAccess[i]` after a `this.m[k]` prefix. Hoist the whole-value read into a temp and
  // index it locally -> `T[] t = m[k0..]; ... t[i] ...`. Default `mappingArrayValueMinIndices` is 2 so the
  // late pass keeps its historical 2D-only hoist; kernel admission uses 1 so `m[k][i]` journals as `m[k]`.
  visitArrayAccess(node: ArrayAccessNode): Node {
    const { base, keys: accessKeys } = this.flattenAccess(node);
    const mappingName = this.mappingArrayValueBaseName(base);
    const info = mappingName === undefined ? undefined : this.mappings.get(mappingName);
    if (mappingName !== undefined && info) {
      const prefixKeys = base instanceof MappingAccessNode ? base.keys : [];
      const keys = [...prefixKeys, ...accessKeys];
      let dims = 0; let t: Type = info.valueType;
      while (t instanceof ArrayType) { dims++; t = t.elementType; }
      const arrIdxCount = keys.length - info.keyCount;
      if (arrIdxCount >= this.mappingArrayValueMinIndices && arrIdxCount <= dims) {
        const visitedKeys = keys.map((k) => this.visit(k) as ExpressionNode);
        const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;
        const mapKeys = visitedKeys.slice(0, info.keyCount);
        const arrIdxs = visitedKeys.slice(info.keyCount);
        let read: ExpressionNode = this.ident(mappingName, node);
        for (const k of mapKeys) {
          const acc = new ArrayAccessNode(read, clone(k));
          acc.location = node.location;
          read = acc;
        }
        const tmpName = `__mar_tmp_${this.counter++}`;
        const decl = new VariableDefinitionNode(info.valueType, [], tmpName, read);
        decl.location = node.location;
        this.locals.set(tmpName, info.valueType);
        this.pendingHoists.push(decl);
        let repl: ExpressionNode = this.ident(tmpName, node);
        for (const idx of arrIdxs) {
          const acc = new ArrayAccessNode(repl, clone(idx));
          acc.location = node.location;
          repl = acc;
        }
        return repl;
      }
    }
    return super.visitArrayAccess(node);
  }

  private mappingArrayValueBaseName(base: ExpressionNode): string | undefined {
    if (base instanceof IdentifierNode && !this.locals.has(base.name)) return base.name;
    if (base instanceof StateAccessNode && !this.locals.has(base.name)) return base.name;
    if (base instanceof MappingAccessNode && !this.locals.has(base.name)) return base.name;
    return undefined;
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
    const { decls, keys } = this.bindKeys(node.keys, [], node);
    const stmts: StatementNode[] = [...decls];
    const tmpNames: string[] = [];
    let currentType: Type = this.stateArrays.get(node.name)!;
    let currentRead: ExpressionNode = this.ident(node.name, node);
    for (let i = 0; i < keys.length; i++) {
      if (!(currentType instanceof ArrayType)) return undefined;
      const elementType: Type = currentType.elementType;
      const tmpName = `__np_tmp_${this.counter++}`;
      const read = new ArrayAccessNode(currentRead, clone(keys[i]));
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

    for (let i = keys.length - 1; i >= 1; i--) {
      const back = new ArrayAssignNode(
        tmpNames[i - 1], clone(keys[i]), this.ident(tmpNames[i], node),
      );
      back.location = node.location;
      stmts.push(back);
    }
    const back = new StateArrayAssignNode(node.name, clone(keys[0]), this.ident(tmpNames[0], node));
    back.location = node.location;
    stmts.push(back);
    return stmts;
  }

  // `m[k].outer.inner = v`: MappingFieldAssign stores one top-level struct field, so rebuild that field's nested
  // struct value while retaining the keyed mapping write.
  private tryRebuildNestedMappingStructField(node: MappingFieldAssignNode): StatementNode[] | undefined {
    if (!node.trailingMembers?.length) return undefined;
    const info = this.mappingStructs.get(node.name);
    if (!info || node.keys.length !== info.keyCount) return undefined;
    const target = info.valueType.fields.find((f) => f.name === node.fieldName);
    if (!(target?.type instanceof StructType)) return undefined;
    const { decls, keys } = this.bindKeys(node.keys, info.keyTypes, node);
    node.keys = keys;
    const mappingRead = new MappingAccessNode(
      node.name, keys.map((k) => cloneNode(k) as ExpressionNode),
    );
    mappingRead.location = node.location;
    const fieldRead = new FieldAccessNode(mappingRead, node.fieldName);
    fieldRead.location = node.location;
    node.expression = this.rebuildStructFieldChain(
      fieldRead, target.type, node.trailingMembers, node.expression, node,
    );
    node.trailingMembers = undefined;
    return [...decls, node];
  }

  // `a[i][j]...[k].field = v` where a is a nested STATE array and the terminal element is a struct. Materialize
  // each containing row, rebuild the selected struct, then write rows back from the inside out.
  private tryDesugarNestedStateStructField(node: MappingFieldAssignNode): StatementNode[] | undefined {
    if (node.keys.length < 2 || node.trailingMembers?.length) return undefined;
    const rootType = !this.locals.has(node.name) ? this.stateArrays.get(node.name) : undefined;
    if (!(rootType instanceof ArrayType)) return undefined;
    let terminal: Type = rootType;
    for (let i = 0; i < node.keys.length; i++) {
      if (!(terminal instanceof ArrayType)) return undefined;
      terminal = terminal.elementType;
    }
    if (!(terminal instanceof StructType) || !terminal.fields.some((f) => f.name === node.fieldName)) {
      return undefined;
    }

    const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;
    const { decls, keys } = this.bindKeys(node.keys, [], node);
    const stmts: StatementNode[] = [...decls];
    const temps: string[] = [];
    let currentType: Type = rootType;
    let currentRead: ExpressionNode = this.ident(node.name, node);
    // The final key selects the struct itself; materialize only its containing array rows.
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(currentType instanceof ArrayType)) return undefined;
      const elementType: Type = currentType.elementType;
      const tmp = `__nsf_tmp_${this.counter++}`;
      const read = new ArrayAccessNode(currentRead, clone(keys[i]));
      read.location = node.location;
      const decl = new VariableDefinitionNode(elementType, [], tmp, read);
      decl.location = node.location;
      stmts.push(decl);
      temps.push(tmp);
      currentType = elementType;
      currentRead = this.ident(tmp, node);
    }
    if (temps.length === 0) return undefined;
    const selected = (): ArrayAccessNode => {
      const read = new ArrayAccessNode(
        this.ident(temps.at(-1)!, node), clone(keys.at(-1)!),
      );
      read.location = node.location;
      return read;
    };
    const ctor = new FunctionCallNode(
      this.ident(terminal.name, node),
      terminal.fields.map((f) => {
        if (f.name === node.fieldName) return node.expression;
        const read = new FieldAccessNode(selected(), f.name);
        read.location = node.location;
        return read;
      }),
    );
    ctor.location = node.location;
    const terminalWrite = new ArrayAssignNode(temps.at(-1)!, clone(keys.at(-1)!), ctor);
    terminalWrite.location = node.location;
    stmts.push(terminalWrite);
    for (let i = temps.length - 1; i >= 1; i--) {
      const back = new ArrayAssignNode(temps[i - 1], clone(keys[i]), this.ident(temps[i], node));
      back.location = node.location;
      stmts.push(back);
    }
    const stateBack = new StateArrayAssignNode(node.name, clone(keys[0]), this.ident(temps[0], node));
    stateBack.location = node.location;
    stmts.push(stateBack);
    return stmts;
  }

  // `m[i].f = v` where m is a LOCAL struct array (`S[] memory`): the parser makes a MappingFieldAssignNode which
  // the symbol table rejects (m is not a state collection). Reads `m[i].f` and whole-element writes `m[i] = S(..)`
  // already work, so rebuild the element with field f replaced: `m[i] = S(m[i].f0, .., v, ..)`. Only a LOCAL
  // struct array fires here - a state struct array handles a simple field write in place.
  private tryDesugarLocalStructArrayField(node: MappingFieldAssignNode): StatementNode[] | undefined {
    if (node.keys.length < 1) return undefined;
    const baseType = this.locals.get(node.name);
    const localStruct = baseType instanceof ArrayType && baseType.elementType instanceof StructType
      ? baseType.elementType : undefined;
    const stateStruct = !localStruct && !this.locals.has(node.name)
      ? this.stateStructArrays.get(node.name) : undefined;
    const struct = localStruct ?? stateStruct;
    if (!struct) return undefined;
    const targetField = struct.fields.find((f) => f.name === node.fieldName);
    if (!targetField) return undefined;
    const { decls, keys } = this.bindKeys(node.keys, [], node);

    const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;
    const elemRead = (field: string): ExpressionNode => {
      const acc = new ArrayAccessNode(this.ident(node.name, node), clone(keys[0]));
      acc.location = node.location;
      const fa = new FieldAccessNode(acc, field);
      fa.location = node.location;
      return fa;
    };

    // `m[i].a[j..] = v`: materialize the aggregate field, perform the indexed local write, then rebuild m[i].
    // The parser flattens every index into MappingFieldAssign.keys, so keys after the first belong to the field.
    if (keys.length > 1) {
      if (!(targetField.type instanceof ArrayType)
        && !(targetField.type instanceof BytesType && targetField.type.bound === undefined)) return undefined;
      const tmpName = `__sa_field_${this.counter++}`;
      const decl = new VariableDefinitionNode(targetField.type, [], tmpName, elemRead(node.fieldName));
      decl.location = node.location;
      const fieldKeys = keys.slice(1).map(clone);
      if (fieldKeys.length === 2 && node.trailingMembers?.length === 1
        && targetField.type instanceof ArrayType && targetField.type.elementType instanceof StructType) {
        const elementStruct = targetField.type.elementType;
        const innerName = node.trailingMembers[0];
        const innerField = elementStruct.fields.find((f) => f.name === innerName);
        if (innerField && (innerField.type instanceof ArrayType
          || (innerField.type instanceof BytesType && innerField.type.bound === undefined))) {
          const selected = (): ArrayAccessNode => {
            const read = new ArrayAccessNode(this.ident(tmpName, node), clone(fieldKeys[0]));
            read.location = node.location;
            return read;
          };
          const innerTmp = `__sa_inner_${this.counter++}`;
          const innerRead = new FieldAccessNode(selected(), innerName);
          innerRead.location = node.location;
          const innerDecl = new VariableDefinitionNode(innerField.type, [], innerTmp, innerRead);
          innerDecl.location = node.location;
          const innerWrite = new ArrayAssignNode(innerTmp, clone(fieldKeys[1]), node.expression);
          innerWrite.location = node.location;
          const elemCtor = new FunctionCallNode(
            this.ident(elementStruct.name, node),
            elementStruct.fields.map((f) => {
              if (f.name === innerName) return this.ident(innerTmp, node);
              const read = new FieldAccessNode(selected(), f.name);
              read.location = node.location;
              return read;
            }),
          );
          elemCtor.location = node.location;
          const outerWrite = new ArrayAssignNode(tmpName, clone(fieldKeys[0]), elemCtor);
          outerWrite.location = node.location;
          const rootCtor = new FunctionCallNode(
            this.ident(struct.name, node),
            struct.fields.map((f) => (f.name === node.fieldName ? this.ident(tmpName, node) : elemRead(f.name))),
          );
          rootCtor.location = node.location;
          const back = stateStruct
            ? new StateArrayAssignNode(node.name, clone(keys[0]), rootCtor)
            : new ArrayAssignNode(node.name, clone(keys[0]), rootCtor);
          back.location = node.location;
          return [...decls, decl, innerDecl, innerWrite, outerWrite, back];
        }
      }
      let indexedValue = node.expression;
      if (fieldKeys.length === 1 && node.trailingMembers?.length
        && targetField.type instanceof ArrayType && targetField.type.elementType instanceof StructType) {
        const selected = new ArrayAccessNode(this.ident(tmpName, node), clone(fieldKeys[0]));
        selected.location = node.location;
        indexedValue = this.rebuildStructFieldChain(
          selected, targetField.type.elementType, node.trailingMembers, node.expression, node,
        );
      }
      let write: StatementNode;
      if (fieldKeys.length === 1) {
        write = new ArrayAssignNode(tmpName, fieldKeys[0], indexedValue);
        write.location = node.location;
      } else {
        const nested = new MappingAssignNode(tmpName, fieldKeys, node.expression);
        nested.location = node.location;
        this.locals.set(tmpName, targetField.type);
        const lowered = this.tryDesugar(nested);
        if (!lowered) return undefined;
        const ctor = new FunctionCallNode(
          this.ident(struct.name, node),
          struct.fields.map((f) => (f.name === node.fieldName ? this.ident(tmpName, node) : elemRead(f.name))),
        );
        ctor.location = node.location;
        const back = stateStruct
          ? new StateArrayAssignNode(node.name, clone(keys[0]), ctor)
          : new ArrayAssignNode(node.name, clone(keys[0]), ctor);
        back.location = node.location;
        return [...decls, decl, ...lowered, back];
      }
      const ctor = new FunctionCallNode(
        this.ident(struct.name, node),
        struct.fields.map((f) => (f.name === node.fieldName ? this.ident(tmpName, node) : elemRead(f.name))),
      );
      ctor.location = node.location;
      const back = stateStruct
        ? new StateArrayAssignNode(node.name, clone(keys[0]), ctor)
        : new ArrayAssignNode(node.name, clone(keys[0]), ctor);
      back.location = node.location;
      return [...decls, decl, write, back];
    }

    const fieldValue = node.trailingMembers?.length && targetField.type instanceof StructType
      ? this.rebuildStructFieldChain(
        elemRead(node.fieldName), targetField.type, node.trailingMembers, node.expression, node,
      )
      : node.expression;
    const ctor = new FunctionCallNode(
      this.ident(struct.name, node),
      struct.fields.map((f) => (f.name === node.fieldName ? fieldValue : elemRead(f.name))),
    );
    ctor.location = node.location;
    const assign = stateStruct
      ? new StateArrayAssignNode(node.name, clone(keys[0]), ctor)
      : new ArrayAssignNode(node.name, clone(keys[0]), ctor);
    assign.location = node.location;
    return [...decls, assign];
  }

  private rebuildStructFieldChain(
    base: ExpressionNode, type: StructType, members: string[], value: ExpressionNode, atNode: Node,
  ): ExpressionNode {
    const head = members[0];
    const target = type.fields.find((f) => f.name === head);
    let replacement = value;
    if (members.length > 1 && target?.type instanceof StructType) {
      const nestedBase = new FieldAccessNode(base, head);
      nestedBase.location = atNode.location;
      replacement = this.rebuildStructFieldChain(
        nestedBase, target.type, members.slice(1), value, atNode,
      );
    }
    const ctor = new FunctionCallNode(
      this.ident(type.name, atNode),
      type.fields.map((f) => {
        if (f.name === head) return replacement;
        const read = new FieldAccessNode(cloneNode(base) as ExpressionNode, f.name);
        read.location = atNode.location;
        return read;
      }),
    );
    ctor.location = atNode.location;
    return ctor;
  }

  // `s.rows[i].items[j] = v` where s is a LOCAL struct and rows is an array of structs. The parser flattens
  // both indices onto a MappingFieldAssign rooted at s; rebuild the two aggregate layers explicitly:
  // rows = s.rows; items = rows[i].items; items[j] = v; rows[i] = T(...items...); s = S(...rows...).
  private tryDesugarLocalNestedStructArrayField(node: MappingFieldAssignNode): StatementNode[] | undefined {
    if ((node.keys.length !== 1 && node.keys.length !== 2) || node.trailingMembers?.length !== 1) {
      return undefined;
    }
    const root = this.locals.get(node.name);
    if (!(root instanceof StructType)) return undefined;
    const outerField = root.fields.find((f) => f.name === node.fieldName);
    if (!(outerField?.type instanceof ArrayType) || !(outerField.type.elementType instanceof StructType)) {
      return undefined;
    }
    const elementStruct = outerField.type.elementType;
    const innerName = node.trailingMembers[0];
    const innerField = elementStruct.fields.find((f) => f.name === innerName);
    if (!innerField) return undefined;
    if (node.keys.length === 2 && !(innerField.type instanceof ArrayType)
      && !(innerField.type instanceof BytesType && innerField.type.bound === undefined)) return undefined;

    const { decls, keys } = this.bindKeys(node.keys, [], node);
    const at = <T extends Node>(x: T): T => { x.location = node.location; return x; };
    const id = (name: string): IdentifierNode => at(new IdentifierNode(name));
    const field = (base: ExpressionNode, name: string): FieldAccessNode => at(new FieldAccessNode(base, name));
    const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;
    const outerTmp = `__sa_outer_${this.counter++}`;
    const innerTmp = `__sa_inner_${this.counter++}`;
    const outerDecl = at(new VariableDefinitionNode(
      outerField.type, [], outerTmp, field(id(node.name), node.fieldName),
    ));
    const selected = (): ArrayAccessNode => at(new ArrayAccessNode(id(outerTmp), clone(keys[0])));
    if (keys.length === 1) {
      const elemCtor = at(new FunctionCallNode(
        id(elementStruct.name),
        elementStruct.fields.map((f) => f.name === innerName ? node.expression : field(selected(), f.name)),
      ));
      const outerWrite = at(new ArrayAssignNode(outerTmp, clone(keys[0]), elemCtor));
      const rootCtor = at(new FunctionCallNode(
        id(root.name),
        root.fields.map((f) => f.name === node.fieldName ? id(outerTmp) : field(id(node.name), f.name)),
      ));
      const rootWrite = at(new AssignNode(id(node.name), rootCtor));
      rootWrite.isReferenceDataWrite = true;
      return [...decls, outerDecl, outerWrite, rootWrite];
    }
    const innerDecl = at(new VariableDefinitionNode(innerField.type, [], innerTmp, field(selected(), innerName)));
    const innerWrite = at(new ArrayAssignNode(innerTmp, clone(keys[1]), node.expression));
    const elemCtor = at(new FunctionCallNode(
      id(elementStruct.name),
      elementStruct.fields.map((f) => f.name === innerName ? id(innerTmp) : field(selected(), f.name)),
    ));
    const outerWrite = at(new ArrayAssignNode(outerTmp, clone(keys[0]), elemCtor));
    const rootCtor = at(new FunctionCallNode(
      id(root.name),
      root.fields.map((f) => f.name === node.fieldName ? id(outerTmp) : field(id(node.name), f.name)),
    ));
    const rootWrite = at(new AssignNode(id(node.name), rootCtor));
    rootWrite.isReferenceDataWrite = true;
    return [...decls, outerDecl, innerDecl, innerWrite, outerWrite, rootWrite];
  }

  // `delete d[k0]..[kn]` where d is a LOCAL or nested STATE array: parses as a MappingDeleteNode the symbol
  // table rejects (d is not a mapping). Solidity resets the element to its type default, so rewrite to
  // `d[k0]..[kn] = <default>` - a single-index write directly, a nested one via the read-modify-write desugar.
  // (A single-index STATE array delete routes to StateArrayDelete before ever reaching here.)
  private tryDesugarLocalArrayDelete(node: MappingDeleteNode): StatementNode[] | undefined {
    const isState = !this.locals.has(node.name) && this.stateArrays.has(node.name);
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
      if (isState) {
        const del = new StateArrayDeleteNode(node.name, cloneNode(node.keys[0]) as ExpressionNode);
        del.location = node.location;
        return [del];
      }
      const assign = new ArrayAssignNode(node.name, cloneNode(node.keys[0]) as ExpressionNode, def);
      assign.location = node.location;
      return [assign];
    }
    // Multi-index `delete d[i][j]` -> `d[i][j] = default` via the nested-array write desugar.
    const write = new MappingAssignNode(node.name, node.keys.map((k) => cloneNode(k) as ExpressionNode), def);
    write.location = node.location;
    return this.tryDesugar(write);
  }

  // `m[k][i].field = v` where m is a mapping whose value is an array of structs: materialize the array
  // entry, rebuild the selected element locally, write the entry back.
  private tryDesugarMappingArrayStructField(node: MappingFieldAssignNode): StatementNode[] | undefined {
    if (this.locals.has(node.name)) return undefined;
    const info = this.mappings.get(node.name);
    if (!info) return undefined;
    const { keyCount, valueType } = info;
    if (!(valueType instanceof ArrayType) || !(valueType.elementType instanceof StructType)) return undefined;
    const arrIdxCount = node.keys.length - keyCount;
    if (arrIdxCount < this.mappingArrayValueMinIndices) return undefined;

    const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;
    const { decls, keys } = this.bindKeys(node.keys, info.keyTypes, node);
    const mapKeys = keys.slice(0, keyCount);
    const arrIdxs = keys.slice(keyCount);
    let read: ExpressionNode = this.ident(node.name, node);
    for (const k of mapKeys) {
      const acc = new ArrayAccessNode(read, clone(k));
      acc.location = node.location;
      read = acc;
    }
    const tmpName = `__ma_sf_${this.counter++}`;
    const decl = new VariableDefinitionNode(valueType, [], tmpName, read);
    decl.location = node.location;
    this.locals.set(tmpName, valueType);
    const local = new MappingFieldAssignNode(
      tmpName, arrIdxs.map(clone), node.fieldName, node.expression,
    );
    local.location = node.location;
    local.trailingMembers = node.trailingMembers;
    const localStmts = this.tryDesugarLocalStructArrayField(local);
    if (!localStmts) return undefined;
    const back = new MappingAssignNode(node.name, mapKeys.map(clone), this.ident(tmpName, node));
    back.location = node.location;
    return [...decls, decl, ...localStmts, back];
  }

  // `m[k0..k_{kc-1}][i][j..] = v` where m is a mapping (kc keys) whose value is an array: the parser makes
  // one MappingAssignNode with all indices. A 1-index scalar-array write (`m[k][i]=v`) already has a native
  // sorted-RMW path after ST separates arrayIndex; a struct-element write needs the whole-entry RMW before
  // kernel admission so the journal sees `m[k]`. A 2+-index write always desugars:
  // `T[][] t = m[k]; t[i][j] = v; m[k] = t;`.
  private tryDesugarMappingArrayValue(node: MappingAssignNode): StatementNode[] | undefined {
    if (node.arrayPush || node.arrayPop) return undefined;
    if (this.locals.has(node.name)) return undefined; // a local shadows the mapping
    const info = this.mappings.get(node.name);
    if (!info) return undefined;
    const { keyCount, valueType } = info;
    let dims = 0; let t: Type = valueType;
    while (t instanceof ArrayType) { dims++; t = t.elementType; }
    // Earlier semantic normalization may already have separated the first array-value index from the mapping
    // keys. It is still part of this whole-entry read/modify/write, not a second physical mapping key.
    const arrIdxCount = node.keys.length - keyCount + (node.arrayIndex ? 1 : 0);
    if (arrIdxCount < this.mappingArrayValueMinIndices || arrIdxCount > dims) return undefined;
    // A normalized scalar-array element write already has a native sorted-RMW lowering. Keep its arrayIndex
    // attached to the MappingAssign so runtime counter-loop metadata can publish the exact `setAt` mutation.
    // Struct elements need the whole-array rewrite: their field update has already become a composite value
    // assignment, which the direct element path cannot journal as one authenticated entry transition.
    if (node.arrayIndex && arrIdxCount === 1 && valueType instanceof ArrayType && dims === 1
      && !(valueType.elementType instanceof StructType)) return undefined;

    const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;
    const { decls, keys } = this.bindKeys(
      [...node.keys, ...(node.arrayIndex ? [node.arrayIndex] : [])], info.keyTypes, node,
    );
    const mapKeys = keys.slice(0, keyCount);
    const arrIdxs = keys.slice(keyCount);

    // 1. Materialize the whole array value: `T[] t = m[k0]..[k_{kc-1}]`.
    let read: ExpressionNode = this.ident(node.name, node);
    for (const k of mapKeys) { const acc = new ArrayAccessNode(read, clone(k)); acc.location = node.location; read = acc; }
    const tmpName = `__ma_tmp_${this.counter++}`;
    const decl = new VariableDefinitionNode(valueType, [], tmpName, read);
    decl.location = node.location;

    // 2. Local write `t[i] = v` (1-index) or nested `t[i][j..] = v` via the existing local desugar.
    this.locals.set(tmpName, valueType);
    let localStmts: StatementNode[] | undefined;
    if (arrIdxCount === 1) {
      const assign = new ArrayAssignNode(tmpName, clone(arrIdxs[0]), node.expression);
      assign.location = node.location;
      localStmts = [assign];
    } else {
      const localWrite = new MappingAssignNode(tmpName, arrIdxs.map((k) => clone(k)), node.expression);
      localWrite.location = node.location;
      localStmts = this.tryDesugar(localWrite);
    }
    if (!localStmts) return undefined;

    // 3. Write the whole array value back: `m[k0]..[k_{kc-1}] = t`.
    const back = new MappingAssignNode(node.name, mapKeys.map((k) => clone(k)), this.ident(tmpName, node));
    back.location = node.location;

    return [...decls, decl, ...localStmts, back];
  }

  // `b[k0]..[kn] = v` on a local nested array -> read-modify-write statements; undefined if not applicable.
  private tryDesugar(node: MappingAssignNode): StatementNode[] | undefined {
    if (node.keys.length < 2) return undefined;
    // A local shadows a state var of the same name; the base is a state array only when no local matches.
    const isState = !this.locals.has(node.name) && this.stateArrays.has(node.name);
    const baseType = this.locals.get(node.name) ?? this.stateArrays.get(node.name);
    if (!(baseType instanceof ArrayType)) return undefined;

    const { decls, keys } = this.bindKeys(node.keys, [], node);
    const m = keys.length;
    const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;

    // Read down to the innermost array: tmp0 = base[k0]; tmp1 = tmp0[k1]; ... typing each temp from the
    // declared element types. Bail if the declared type is not nested enough (let the type checker report it).
    const stmts: StatementNode[] = [...decls];
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

    // An array whose element is a mapping (`mapping(K=>V)[N]`) is not a nested value-array. Its complete
    // `[arrayIndex][mappingKey]` path is one storage collection access and must stay as MappingAssign; attempting
    // the local nested-array RMW would materialize a mapping value, which Solidity storage pointers never do.
    if (!(curType instanceof ArrayType)) return undefined;

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

  // A read-modify-write desugar evaluates each key in the read and again in the write-back. When any key has a
  // side effect, bind every non-literal key to a temp, in order, so each evaluates once. Pure keys are left as they
  // are. `types` gives the leading mapping-key types; an array index binds as bigint.
  private bindKeys(
    keys: ExpressionNode[], types: Type[], at: Node,
  ): { decls: StatementNode[]; keys: ExpressionNode[] } {
    const changesState = (name: string): boolean => this.stateChanging.has(name) || this.locals.has(name);
    if (!keys.some((key) => hasSideEffects(key, changesState))) return { decls: [], keys };
    const decls: StatementNode[] = [];
    const bound = keys.map((key, i) => {
      if (key instanceof LiteralNode) return key;
      const name = `__nk_tmp_${this.counter++}`;
      const decl = new VariableDefinitionNode(types[i] ?? PrimitiveType.BIGINT, [], name, key);
      decl.location = at.location;
      decls.push(decl);
      return this.ident(name, at);
    });
    return { decls, keys: bound };
  }

  private ident(name: string, at: Node): IdentifierNode {
    const id = new IdentifierNode(name);
    id.location = at.location;
    return id;
  }
}
