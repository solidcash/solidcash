import { ArrayType, IntType, BytesType, StructType, PrimitiveType, Type } from '@solidcash/utils';
import {
  Node,
  SourceFileNode,
  ContractNode,
  BlockNode,
  StatementNode,
  FunctionDefinitionNode,
  VariableDefinitionNode,
  AssignNode,
  ArrayAssignNode,
  ArrayAccessNode,
  TupleIndexOpNode,
  FieldAccessNode,
  MappingDeleteNode,
  MappingFieldAssignNode,
  FunctionCallNode,
  BinaryOpNode,
  UnaryOpNode,
  CastNode,
  SliceNode,
  BytesConcatNode,
  NewArrayNode,
  IntLiteralNode,
  HexLiteralNode,
  IdentifierNode,
  ExpressionNode,
} from '../ast/AST.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

// EXPERIMENTAL (flag `experimentalMemoryModel`). Lowers `memory` reference types to integer pointers into a
// per-function linear byte buffer, so a nested lvalue write is an address-chain + a single in-place store that
// COMPOSES across statements (the value-copy read-modify-write re-encodes stale aggregate snapshots and does
// not). See docs/experimental-memory-model.md. Pure desugar to bytes ops (bytes.concat / slice / bytes32/uint
// casts / `new bytes(n)`) - no codegen changes.
//
// This first slice handles a memory DYNAMIC ARRAY of an int/uint element type: `new T[](n)`, `a[i]` read/write,
// `a.length`, and reference aliasing (`T[] memory b = a` shares the buffer). Structs and nested chains build on
// the same primitives (Phase 3). Off by default; the flag gates the whole pass, so the value-copy path is intact.
const WORD = 32n;

export default class LowerMemoryModel extends AstTraversal {
  // Locals that are memory-model pointers (declared as a handled memory dynamic array, initialized by a fresh
  // allocation or an alias). Name -> the array type (element type used for encode/decode).
  private memArrays = new Map<string, ArrayType>();
  // Locals that are memory-model STRUCT pointers (block of 32-byte value-field words). Name -> struct type.
  private memStructs = new Map<string, StructType>();
  // Locals that are memory-model arrays whose ELEMENTS are struct pointers (`T[] memory`, T a value-field
  // struct). Separate track from memArrays so value-element ops stay untouched. Name -> array type.
  private memStructArrays = new Map<string, ArrayType>();
  private usesMemory = false;
  // SAFETY GATE: names the analysis proved safe to convert this function (every use - and every alias-group
  // member's use - is a lowering we support). A candidate not in this set falls through to the value-copy path,
  // so flag-on can never regress. See analyzeConvertible + docs/experimental-memory-model.md SS6.
  private convertible = new Set<string>();
  private counter = 0;

  constructor(private enabled: boolean) {
    super();
  }

  visitSourceFile(node: SourceFileNode): Node {
    if (!this.enabled) return node;
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
    const savedMem = this.memArrays;
    const savedStructs = this.memStructs;
    const savedStructArrays = this.memStructArrays;
    const savedUses = this.usesMemory;
    const savedConv = this.convertible;
    this.memArrays = new Map();
    this.memStructs = new Map();
    this.memStructArrays = new Map();
    this.usesMemory = false;
    this.convertible = node.body ? this.analyzeConvertible(node.body) : new Set();
    if (node.body) {
      // A first pass over the block rewrites decls/writes/reads; if any memory array is allocated, prepend the
      // buffer locals so every `__memory`/`__freeptr` reference resolves.
      node.body = this.visit(node.body) as BlockNode;
      if (this.usesMemory) {
        const memInit = new HexLiteralNode(new Uint8Array(0));
        memInit.type = new BytesType();
        const memDecl = new VariableDefinitionNode(new BytesType(), [], '__memory', memInit);
        const fmpDecl = new VariableDefinitionNode(this.uint(), [], '__freeptr', this.intLit(0n));
        this.at(memDecl, node);
        this.at(fmpDecl, node);
        node.body.statements = [memDecl, fmpDecl, ...(node.body.statements ?? [])];
      }
    }
    this.memArrays = savedMem;
    this.memStructs = savedStructs;
    this.memStructArrays = savedStructArrays;
    this.usesMemory = savedUses;
    this.convertible = savedConv;
    return node;
  }

  // Determine which candidate memory locals are SAFE to convert: every use of the variable, and of every other
  // variable in its alias group, must be a lowering this pass supports. Any unsupported use (pass to a call,
  // return, state assign, abi.encode, reassignment, ...) taints the whole group, which then falls back to
  // value-copy. This is the invariant that makes flag-on non-regressing.
  private analyzeConvertible(body: BlockNode): Set<string> {
    // 1. Candidacy: a handled-type local whose init is `new T[](n)` (root) or an identifier (alias). Alias
    //    candidacy is transitive - resolved to a fixpoint (a chain `a=new; b=a; c=b`).
    const roots = new Set<string>();          // decl with a fresh allocation
    const aliasSrc = new Map<string, string>(); // array decl `T[] b = a` -> b:a
    const structCands = new Map<string, StructType>(); // struct-pointer candidates -> type (no aliasing this phase)
    const structArrayCands = new Map<string, ArrayType>(); // struct-element array candidates -> type
    const collectCandidates = (n: Node): void => {
      if (n instanceof VariableDefinitionNode && this.isHandledMemArray(n.type)) {
        if (n.expression instanceof NewArrayNode && !n.expression.rawBytes) roots.add(n.name);
        else if (n.expression instanceof IdentifierNode) aliasSrc.set(n.name, n.expression.name);
      } else if (n instanceof VariableDefinitionNode && this.isHandledMemStructArray(n.type)
        && n.expression instanceof NewArrayNode && !n.expression.rawBytes) {
        roots.add(n.name);
        structArrayCands.set(n.name, n.type as ArrayType);
      } else if (n instanceof VariableDefinitionNode && this.isHandledMemStruct(n.type)
        && (n.expression === undefined || n.expression instanceof FunctionCallNode)) {
        // A struct built by a constructor or left default. An aliased struct (`S t = s`, ident init) is NOT a
        // candidate here - its ident init taints the source in the walk, so both fall back (aliasing is a later
        // phase). This keeps in-place stores correct (no alias observes new-block-vs-in-place).
        roots.add(n.name);
        structCands.set(n.name, n.type as StructType);
      }
      this.eachChild(n, collectCandidates);
    };
    collectCandidates(body);
    const candidates = new Set<string>(roots);
    for (let changed = true; changed;) {
      changed = false;
      for (const [name, src] of aliasSrc) {
        if (!candidates.has(name) && candidates.has(src)) { candidates.add(name); changed = true; }
      }
    }
    if (candidates.size === 0) return new Set();

    // 2. Union-find over alias edges (only between candidates); a non-candidate alias source cannot happen for a
    //    candidate (it would not have been added above).
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      let r = x;
      while (parent.get(r) !== undefined && parent.get(r) !== r) r = parent.get(r)!;
      return r;
    };
    const union = (a: string, b: string): void => { parent.set(find(a), find(b)); };
    for (const c of candidates) if (!parent.has(c)) parent.set(c, c);
    for (const [name, src] of aliasSrc) if (candidates.has(name) && candidates.has(src)) union(name, src);

    // 3. Taint: walk every use; anything that is not a supported consumer of a candidate taints that candidate.
    const tainted = new Set<string>();
    // A VALUE-element array candidate (index r/w yields a value): a candidate that is not a struct/struct-array.
    const isValueArr = (e: unknown): e is IdentifierNode =>
      e instanceof IdentifierNode && candidates.has(e.name)
      && !structArrayCands.has(e.name) && !structCands.has(e.name);
    // The base identifier of `arr[i]` (ArrayAccess or numeric-literal TupleIndexOp), if it is a struct-array cand.
    const structArrBase = (e: unknown): string | undefined => {
      if (e instanceof ArrayAccessNode && e.array instanceof IdentifierNode && structArrayCands.has(e.array.name)) {
        return e.array.name;
      }
      if (e instanceof TupleIndexOpNode && e.tuple instanceof IdentifierNode && structArrayCands.has(e.tuple.name)) {
        return e.tuple.name;
      }
      return undefined;
    };
    const walk = (n: Node | undefined): void => {
      if (!n) return;
      if (n instanceof ArrayAccessNode && isValueArr(n.array)) { walk(n.index); return; }
      if (n instanceof TupleIndexOpNode && isValueArr(n.tuple)) return; // numeric-literal index
      if (n instanceof UnaryOpNode && n.operator === UnaryOperator.SIZE && n.expression instanceof IdentifierNode
        && candidates.has(n.expression.name)) return; // .length (only arrays have it; value or struct element)
      if (n instanceof ArrayAssignNode && isValueArr(new IdentifierNode(n.name))) { walk(n.index); walk(n.value); return; }
      // `arr[i] = T(..)` struct-element construct (only a struct ctor value is handled).
      if (n instanceof ArrayAssignNode && structArrayCands.has(n.name)
        && n.value instanceof FunctionCallNode
        && n.value.identifier.name === structArrayCands.get(n.name)!.elementType.toString()) {
        walk(n.index); walk(n.value); return;
      }
      if (n instanceof MappingDeleteNode && candidates.has(n.name) && n.keys.length === 1) { walk(n.keys[0]); return; }
      // `arr[i].f = v` struct-element field write (single key).
      if (n instanceof MappingFieldAssignNode && structArrayCands.has(n.name) && n.keys.length === 1) {
        walk(n.keys[0]); walk(n.expression); return;
      }
      // `arr[i].f` struct-element field read: FieldAccess over a struct-array index. Walk only the index (a
      // numeric-literal TupleIndexOp has no index expression to walk).
      if (n instanceof FieldAccessNode && structArrBase(n.expression) !== undefined) {
        if (n.expression instanceof ArrayAccessNode) walk(n.expression.index);
        return;
      }
      // Struct member read `s.f` (handled) - its candidate expression is not a use to taint.
      if (n instanceof FieldAccessNode && n.expression instanceof IdentifierNode
        && structCands.has(n.expression.name)) return;
      // Struct field write / reassign `s = S(..)` (handled) - only a genuine constructor call for s's own struct
      // type; `s = someFn()` is not handled and must taint. Walk the ctor args (member reads), keep the LHS.
      if (n instanceof AssignNode && n.identifier instanceof IdentifierNode && structCands.has(n.identifier.name)
        && n.expression instanceof FunctionCallNode
        && n.expression.identifier.name === structCands.get(n.identifier.name)!.name) { walk(n.expression); return; }
      if (n instanceof VariableDefinitionNode && candidates.has(n.name)) {
        if (n.expression instanceof NewArrayNode) walk(n.expression.size); // array alias-ident init: the edge
        else if (n.expression instanceof FunctionCallNode) walk(n.expression); // struct ctor args
        return;
      }
      // Any OTHER reference to a candidate - a bare identifier read, or a name-keyed operation the pass does not
      // handle (push/pop/delete/nested/mapping/state write) - taints it. Name-keyed nodes carry the variable in a
      // string `name` field (not as an IdentifierNode child), so catch both. FieldAccessNode.name is a member
      // name, never a variable, so exclude it (its candidate expression, if any, is caught as a child).
      const nm = (n as unknown as { name?: unknown }).name;
      if (typeof nm === 'string' && candidates.has(nm) && !(n instanceof FieldAccessNode)) tainted.add(nm);
      if (n instanceof IdentifierNode) return;
      this.eachChild(n, walk);
    };
    walk(body);

    // 4. A group is convertible iff no member is tainted.
    const taintedRoots = new Set([...tainted].map(find));
    return new Set([...candidates].filter((c) => !taintedRoots.has(find(c))));
  }

  private eachChild(node: Node, fn: (n: Node) => void): void {
    for (const key of Object.keys(node)) {
      const val = (node as unknown as Record<string, unknown>)[key];
      if (val instanceof Node) fn(val);
      else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) fn(v);
    }
  }

  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const expanded = stmt instanceof VariableDefinitionNode ? this.tryLowerDecl(stmt) : undefined;
      if (expanded) { out.push(...expanded); continue; }
      // `delete d[i]` on a memory array -> store the element default (0) in place.
      if (stmt instanceof MappingDeleteNode && this.memArrays.has(stmt.name) && stmt.keys.length === 1) {
        const arrT = this.memArrays.get(stmt.name)!;
        const addr = this.elemAddr(new IdentifierNode(stmt.name), this.visit(stmt.keys[0]) as ExpressionNode);
        out.push(this.at(this.mstore(addr, this.intLit(0n), arrT.elementType), stmt));
        continue;
      }
      // `s = S(..)` on a memory struct (a field write `s.f=v` desugars to this) -> store each arg in place. Only a
      // genuine constructor for s's struct type (guarded identically in the gate, so a non-ctor assign falls back).
      if (stmt instanceof AssignNode && stmt.identifier instanceof IdentifierNode
        && this.memStructs.has(stmt.identifier.name) && stmt.expression instanceof FunctionCallNode
        && stmt.expression.identifier.name === this.memStructs.get(stmt.identifier.name)!.name) {
        const structT = this.memStructs.get(stmt.identifier.name)!;
        out.push(...this.storeStructArgs(stmt.identifier, stmt.expression, structT, stmt));
        continue;
      }
      // `arr[i] = T(..)` on a struct-element array -> allocate a T block, store its pointer at arr[i].
      if (stmt instanceof ArrayAssignNode && this.memStructArrays.has(stmt.name)
        && stmt.value instanceof FunctionCallNode) {
        const structT = this.memStructArrays.get(stmt.name)!.elementType as StructType;
        if (stmt.value.identifier.name === structT.name) {
          const sp = `__sp_${this.counter++}`;
          out.push(...this.allocStructBlock(sp, structT, stmt.value, stmt));
          const addr = this.elemAddr(new IdentifierNode(stmt.name), this.visit(stmt.index) as ExpressionNode);
          out.push(this.at(this.mstore(addr, new IdentifierNode(sp), this.uint()), stmt));
          continue;
        }
      }
      // `arr[i].f = v` on a struct-element array -> single in-place store at (arr[i] ptr) + 32*fieldIndex.
      if (stmt instanceof MappingFieldAssignNode && this.memStructArrays.has(stmt.name) && stmt.keys.length === 1) {
        const structT = this.memStructArrays.get(stmt.name)!.elementType as StructType;
        const fi = this.fieldIndex(structT, stmt.fieldName);
        if (fi >= 0) {
          const elemPtr = this.structElemPtr(stmt.name, this.visit(stmt.keys[0]) as ExpressionNode);
          const addr = this.fieldAddr(elemPtr, fi);
          out.push(this.at(this.mstore(addr, this.visit(stmt.expression) as ExpressionNode, structT.fields[fi].type), stmt));
          continue;
        }
      }
      out.push(this.visit(stmt) as StatementNode);
    }
    node.statements = out;
    return node;
  }

  // `T[] memory a = new T[](n)` -> allocate a length-prefixed block in `__memory`; `T[] memory b = a` -> pointer
  // copy (alias). Returns the replacement statements, or undefined if this decl is not a handled memory array.
  private tryLowerDecl(node: VariableDefinitionNode): StatementNode[] | undefined {
    const t = node.type;
    if (!this.convertible.has(node.name)) return undefined;
    if (this.isHandledMemStruct(t)) return this.lowerStructDecl(node, t as StructType);
    const isStructArr = this.isHandledMemStructArray(t);
    if (!this.isHandledMemArray(t) && !isStructArr) return undefined;
    const arrT = t as ArrayType;

    // Alias: `T[] memory b = a` where a is already a pointer -> `uint b = a` (share the buffer). Value arrays only.
    if (!isStructArr && node.expression instanceof IdentifierNode && this.memArrays.has(node.expression.name)) {
      this.usesMemory = true;
      this.memArrays.set(node.name, arrT);
      return [this.at(new VariableDefinitionNode(this.uint(), [], node.name, node.expression), node)];
    }

    // Allocation: `T[] memory a = new T[](n)`. Struct-element arrays use the same length-prefixed block (elements
    // are pointer words, zero = null); only the tracking map differs.
    if (node.expression instanceof NewArrayNode && !node.expression.rawBytes) {
      this.usesMemory = true;
      if (isStructArr) this.memStructArrays.set(node.name, arrT);
      else this.memArrays.set(node.name, arrT);
      const n = node.expression.size;
      const ptr = new IdentifierNode(node.name);
      // uint a = __freeptr;
      const decl = this.at(new VariableDefinitionNode(this.uint(), [], node.name, this.mem('__freeptr')), node);
      // __freeptr = __freeptr + 32 + n*32;
      const bump = this.at(this.assign('__freeptr',
        this.add(this.mem('__freeptr'), this.blockBytes(this.clone(n)))), node);
      // __memory = bytes.concat(__memory, new bytes(32 + n*32));   (grow by the block size, zero-filled)
      const grow = this.at(this.assign('__memory',
        new BytesConcatNode([this.mem('__memory'), this.rawBytes(this.blockBytes(this.clone(n)))])), node);
      // __memory = <store n at a>;   (the length word)
      const setLen = this.at(this.mstore(this.at(this.clone(ptr), node), this.clone(n), arrT.elementType), node);
      return [decl, bump, grow, setLen];
    }

    return undefined;
  }

  // `S memory s = S(a0,..)` / `S memory s;` -> malloc(32*k) a zero-filled block, then store each constructor arg
  // (an uninitialized struct leaves the zeros = all fields default). No alias case (aliased structs fall back).
  private lowerStructDecl(node: VariableDefinitionNode, structT: StructType): StatementNode[] {
    this.memStructs.set(node.name, structT);
    const ctor = node.expression instanceof FunctionCallNode ? node.expression : undefined;
    return this.allocStructBlock(node.name, structT, ctor, node);
  }

  // Allocate a struct block at `ptrName = __freeptr` (bump + grow), then store the constructor args (if any).
  // Used by both a named struct decl and an anonymous struct-array element block.
  private allocStructBlock(ptrName: string, structT: StructType, ctor: FunctionCallNode | undefined, src: Node):
  StatementNode[] {
    this.usesMemory = true;
    const size = BigInt(32 * structT.fields.length);
    const decl = this.at(new VariableDefinitionNode(this.uint(), [], ptrName, this.mem('__freeptr')), src);
    const bump = this.at(this.assign('__freeptr', this.add(this.mem('__freeptr'), this.intLit(size))), src);
    const grow = this.at(this.assign('__memory',
      new BytesConcatNode([this.mem('__memory'), this.rawBytes(this.intLit(size))])), src);
    const out: StatementNode[] = [decl, bump, grow];
    if (ctor) out.push(...this.storeStructArgs(new IdentifierNode(ptrName), ctor, structT, src));
    return out;
  }

  // Store each constructor argument at its field slot (`s + 32*i`). Reads ALL args into temps first, then stores,
  // so a self-referential rebuild (`s = S(s.f1, s.f0)`, or the `s.f=v` field-write desugar `s = S(s.f0,v,s.f2)`)
  // matches value-copy's read-old-then-write semantics regardless of arg/field ordering.
  private storeStructArgs(ptr: IdentifierNode, ctor: FunctionCallNode, structT: StructType, src: Node): StatementNode[] {
    const temps: StatementNode[] = [];
    const stores: StatementNode[] = [];
    ctor.parameters.forEach((arg, i) => {
      const tmp = `__ms_${this.counter++}`;
      const fieldT = structT.fields[i].type;
      temps.push(this.at(new VariableDefinitionNode(fieldT, [], tmp, this.visit(arg) as ExpressionNode), src));
      stores.push(this.at(this.mstore(this.fieldAddr(this.clone(ptr), i), new IdentifierNode(tmp), fieldT), src));
    });
    return [...temps, ...stores];
  }

  // `a[i] = v` on a memory array -> single in-place store at `a + 32 + i*32`.
  visitArrayAssign(node: ArrayAssignNode): Node {
    const arrT = this.memArrays.get(node.name);
    if (!arrT) return super.visitArrayAssign(node);
    const addr = this.elemAddr(new IdentifierNode(node.name), this.visit(node.index) as ExpressionNode);
    return this.at(this.mstore(addr, this.visit(node.value) as ExpressionNode, arrT.elementType), node);
  }

  // `a[i]` read (variable index) on a memory array -> load at `a + 32 + i*32`.
  visitArrayAccess(node: ArrayAccessNode): Node {
    if (node.array instanceof IdentifierNode && this.memArrays.has(node.array.name)) {
      const arrT = this.memArrays.get(node.array.name)!;
      const addr = this.elemAddr(new IdentifierNode(node.array.name), this.visit(node.index) as ExpressionNode);
      return this.at(this.mload(addr, arrT.elementType), node);
    }
    return super.visitArrayAccess(node);
  }

  // `a[0]` read (numeric-literal index) parses as a tuple index, not an ArrayAccess -> same load.
  visitTupleIndexOp(node: TupleIndexOpNode): Node {
    if (node.tuple instanceof IdentifierNode && this.memArrays.has(node.tuple.name)) {
      const arrT = this.memArrays.get(node.tuple.name)!;
      const addr = this.elemAddr(new IdentifierNode(node.tuple.name), this.intLit(BigInt(node.index)));
      return this.at(this.mload(addr, arrT.elementType), node);
    }
    return super.visitTupleIndexOp(node);
  }

  // `a.length` parses as the SIZE unary op -> the length word at `a`. Value-copy `.length` is BIGINT (coerces
  // with int and uint); match it so surrounding comparisons type-check identically.
  visitUnaryOp(node: UnaryOpNode): Node {
    if (node.operator === UnaryOperator.SIZE && node.expression instanceof IdentifierNode
      && (this.memArrays.has(node.expression.name) || this.memStructArrays.has(node.expression.name))) {
      const len = this.mload(new IdentifierNode(node.expression.name), this.uint());
      return this.at(new CastNode(PrimitiveType.BIGINT, len, false), node);
    }
    return super.visitUnaryOp(node);
  }

  // `s.f` member read on a memory struct -> load the field word at `s + 32*fieldIndex`.
  visitFieldAccess(node: FieldAccessNode): Node {
    if (node.expression instanceof IdentifierNode && this.memStructs.has(node.expression.name)) {
      const structT = this.memStructs.get(node.expression.name)!;
      const i = this.fieldIndex(structT, node.name);
      if (i >= 0) {
        return this.at(this.mload(this.fieldAddr(new IdentifierNode(node.expression.name), i),
          structT.fields[i].type), node);
      }
    }
    // `arr[i].f` member read on a struct-element array -> load (arr[i] ptr) + 32*fieldIndex.
    const saElem = this.structArrayElem(node.expression);
    if (saElem) {
      const fi = this.fieldIndex(saElem.structT, node.name);
      if (fi >= 0) {
        return this.at(this.mload(this.fieldAddr(saElem.elemPtr, fi), saElem.structT.fields[fi].type), node);
      }
    }
    return super.visitFieldAccess(node);
  }

  // If `expr` is `arr[i]` on a struct-element array, return the element struct type + its pointer expression.
  private structArrayElem(expr: ExpressionNode): { structT: StructType, elemPtr: ExpressionNode } | undefined {
    let name: string | undefined;
    let index: ExpressionNode | undefined;
    if (expr instanceof ArrayAccessNode && expr.array instanceof IdentifierNode
      && this.memStructArrays.has(expr.array.name)) {
      name = expr.array.name;
      index = this.visit(expr.index) as ExpressionNode;
    } else if (expr instanceof TupleIndexOpNode && expr.tuple instanceof IdentifierNode
      && this.memStructArrays.has(expr.tuple.name)) {
      name = expr.tuple.name;
      index = this.intLit(BigInt(expr.index));
    }
    if (name === undefined || index === undefined) return undefined;
    const structT = this.memStructArrays.get(name)!.elementType as StructType;
    return { structT, elemPtr: this.structElemPtr(name, index) };
  }

  // ---- desugar building blocks (all normal AST that type-checks + codegens) ----

  // mstore(addr, word): __memory = bytes.concat(__memory[0:addr], bytes32(word), __memory[addr+32:]).
  private mstore(addr: ExpressionNode, word: ExpressionNode, elemType: Type): AssignNode {
    const head = new SliceNode(this.mem('__memory'), this.intLit(0n), this.clone(addr));
    const tail = new SliceNode(this.mem('__memory'), this.add(this.clone(addr), this.intLit(WORD)),
      new UnaryOpNode(UnaryOperator.SIZE, this.mem('__memory')));
    const encoded = this.encodeWord(word, elemType);
    return this.assign('__memory', new BytesConcatNode([head, encoded, tail]));
  }

  // mload(addr): decode the 32-byte word at [addr : addr+32] back to the element type.
  private mload(addr: ExpressionNode, elemType: Type): ExpressionNode {
    const slice = new SliceNode(this.mem('__memory'), this.clone(addr),
      this.add(this.clone(addr), this.intLit(WORD)));
    return this.decodeWord(slice, elemType);
  }

  private encodeWord(word: ExpressionNode, _elemType: Type): ExpressionNode {
    return new CastNode(new BytesType(32), word, false); // bytes32(word) - 32-byte big-endian word
  }

  private decodeWord(slice: ExpressionNode, elemType: Type): ExpressionNode {
    const b32 = new CastNode(new BytesType(32), slice, false);
    return new CastNode(this.decodeType(elemType), b32, false);
  }

  // Decode target = the (256-bit) element type, so the read type-checks exactly like the value-copy element read.
  private decodeType(elemType: Type): Type {
    return elemType instanceof IntType ? elemType : this.uint();
  }

  // &a[i] = a + 32 + i*32
  private elemAddr(ptr: ExpressionNode, index: ExpressionNode): ExpressionNode {
    return this.add(this.add(ptr, this.intLit(WORD)), new BinaryOpNode(index, BinaryOperator.MUL, this.intLit(WORD)));
  }

  // &s.field_i = s + 32*i (struct block has no length header)
  private fieldAddr(ptr: ExpressionNode, i: number): ExpressionNode {
    return i === 0 ? ptr : this.add(ptr, this.intLit(BigInt(32 * i)));
  }

  // 32 + n*32: the byte size of a length-prefixed n-element block.
  private blockBytes(n: ExpressionNode): ExpressionNode {
    return this.add(this.intLit(WORD), new BinaryOpNode(n, BinaryOperator.MUL, this.intLit(WORD)));
  }

  // Handled today: an unbounded array of a 256-bit int (`uint`/`int`). 32-byte words store the value exactly, so
  // there is no narrowing/wraparound divergence from value-copy. Narrower ints (`uint8[]`) and other element
  // types fall back until their packed encoding is handled (P6).
  private isHandledMemArray(t: Type | undefined): boolean {
    return t instanceof ArrayType && t.bound === undefined
      && t.elementType instanceof IntType && t.elementType.bits === 256;
  }

  // Handled today: a struct whose fields are all 256-bit ints (value-field words). Structs with reference fields
  // (arrays/structs/bytes) - needed for the nested `s.ts[j].y` chain - are P5b and fall back for now.
  private isHandledMemStruct(t: Type | undefined): boolean {
    return t instanceof StructType
      && t.fields.every((f) => f.type instanceof IntType && f.type.bits === 256);
  }

  // An unbounded array whose elements are handled value-field structs (`T[] memory`). Elements are POINTERS.
  private isHandledMemStructArray(t: Type | undefined): boolean {
    return t instanceof ArrayType && t.bound === undefined && this.isHandledMemStruct(t.elementType);
  }

  // The struct-pointer stored at `arr[i]` = mload(arr + 32 + i*32).
  private structElemPtr(arrName: string, index: ExpressionNode): ExpressionNode {
    return this.mload(this.elemAddr(new IdentifierNode(arrName), index), this.uint());
  }

  // The field index of `f` in a struct type, or -1.
  private fieldIndex(structT: StructType, f: string): number {
    return structT.fields.findIndex((fld) => fld.name === f);
  }

  private uint(): IntType { return new IntType(false, 256); }
  private intLit(v: bigint): IntLiteralNode { return new IntLiteralNode(v); }
  private mem(name: string): IdentifierNode { return new IdentifierNode(name); }
  private add(l: ExpressionNode, r: ExpressionNode): ExpressionNode { return new BinaryOpNode(l, BinaryOperator.PLUS, r); }
  private assign(name: string, expr: ExpressionNode): AssignNode { return new AssignNode(new IdentifierNode(name), expr); }
  private clone(e: ExpressionNode): ExpressionNode { return cloneNode(e) as ExpressionNode; }
  private rawBytes(size: ExpressionNode): NewArrayNode {
    const arr = new NewArrayNode(new BytesType(1), size);
    arr.rawBytes = true;
    arr.type = new BytesType();
    return arr;
  }

  // Stamp the whole freshly-built tree with the source location (codegen source maps + the optimizer need every
  // node to carry a location). Nodes that already have one - cloned user expressions - keep theirs.
  private at<T extends Node>(node: T, src: Node): T {
    this.stampTree(node, src.location);
    return node;
  }

  private stampTree(node: Node, loc: Node['location']): void {
    if (!node.location) node.location = loc;
    for (const key of Object.keys(node)) {
      const val = (node as unknown as Record<string, unknown>)[key];
      if (val instanceof Node) this.stampTree(val, loc);
      else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) this.stampTree(v, loc);
    }
  }
}
