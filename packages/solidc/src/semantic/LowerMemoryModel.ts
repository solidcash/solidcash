import { ArrayType, IntType, BytesType, Type } from '@solidcash/utils';
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
  private usesMemory = false;

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
    const savedUses = this.usesMemory;
    this.memArrays = new Map();
    this.usesMemory = false;
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
    this.usesMemory = savedUses;
    return node;
  }

  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const expanded = stmt instanceof VariableDefinitionNode ? this.tryLowerDecl(stmt) : undefined;
      if (expanded) { out.push(...expanded); continue; }
      out.push(this.visit(stmt) as StatementNode);
    }
    node.statements = out;
    return node;
  }

  // `T[] memory a = new T[](n)` -> allocate a length-prefixed block in `__memory`; `T[] memory b = a` -> pointer
  // copy (alias). Returns the replacement statements, or undefined if this decl is not a handled memory array.
  private tryLowerDecl(node: VariableDefinitionNode): StatementNode[] | undefined {
    const t = node.type;
    if (!this.isHandledMemArray(t)) return undefined;
    const arrT = t as ArrayType;

    // Alias: `T[] memory b = a` where a is already a pointer -> `uint b = a` (share the buffer).
    if (node.expression instanceof IdentifierNode && this.memArrays.has(node.expression.name)) {
      this.usesMemory = true;
      this.memArrays.set(node.name, arrT);
      return [this.at(new VariableDefinitionNode(this.uint(), [], node.name, node.expression), node)];
    }

    // Allocation: `T[] memory a = new T[](n)`.
    if (node.expression instanceof NewArrayNode && !node.expression.rawBytes) {
      this.usesMemory = true;
      this.memArrays.set(node.name, arrT);
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

  // `a.length` parses as the SIZE unary op -> the length word at `a` (a count, decoded as uint).
  visitUnaryOp(node: UnaryOpNode): Node {
    if (node.operator === UnaryOperator.SIZE && node.expression instanceof IdentifierNode
      && this.memArrays.has(node.expression.name)) {
      return this.at(this.mload(new IdentifierNode(node.expression.name), this.uint()), node);
    }
    return super.visitUnaryOp(node);
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

  // Decode target: the element type for a 256-bit int; else uint256 (widen; narrower ints round-trip through it).
  private decodeType(elemType: Type): Type {
    if (elemType instanceof IntType && elemType.bits === 256) return elemType;
    return this.uint();
  }

  // &a[i] = a + 32 + i*32
  private elemAddr(ptr: ExpressionNode, index: ExpressionNode): ExpressionNode {
    return this.add(this.add(ptr, this.intLit(WORD)), new BinaryOpNode(index, BinaryOperator.MUL, this.intLit(WORD)));
  }

  // 32 + n*32: the byte size of a length-prefixed n-element block.
  private blockBytes(n: ExpressionNode): ExpressionNode {
    return this.add(this.intLit(WORD), new BinaryOpNode(n, BinaryOperator.MUL, this.intLit(WORD)));
  }

  private isHandledMemArray(t: Type | undefined): boolean {
    return t instanceof ArrayType && t.bound === undefined && t.elementType instanceof IntType;
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
