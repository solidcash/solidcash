import {
  ArrayType, BytesType, PrimitiveType, ValueType, isChunkPackableElementType,
} from '@solidcash/utils';
import {
  Node,
  SourceFileNode,
  ContractNode,
  BlockNode,
  StatementNode,
  FunctionDefinitionNode,
  ParameterNode,
  VariableDefinitionNode,
  AssignNode,
  IdentifierNode,
  ArrayAccessNode,
  CastNode,
  StateArrayPushNode,
  DeleteStateNode,
  BinaryOpNode,
  UnaryOpNode,
  IntLiteralNode,
  WhileNode,
  ArrayNode,
  ExpressionNode,
  ArrayAssignNode,
  NewArrayNode,
} from '../ast/AST.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';
import { createDefaultValueExpression } from '../ast/defaults.js';

/**
 * Desugars a whole DYNAMIC state-array copy `data2 = data1` whose element types differ - bytes of differing
 * width (`bytes10[] = bytes8[]`), which is neither implicitly castable nor a same-layout copy (the two arrays
 * pack differently in storage) - into a per-element casting loop:
 *
 *   delete data2;
 *   for (uint __i = 0; __i < data1.length; __i++) data2.push(bytes10(data1[__i]));
 *
 * Runs BEFORE CacheDynamicArrayInLoop so the emitted push-in-loop is local-cached like any other (a push into a
 * dynamic state array inside a loop is otherwise unsupported by codegen). The FIXED case unrolls in the symbol
 * table (no loop); only the dynamic case needs this pre-semantic loop. `data1` is read directly (a cached-source
 * local shifts the pushed-to array's dynamic-write slot tracking and crashes codegen); it is not mutated here.
 */
export default class DesugarDynamicArrayCopyCast extends AstTraversal {
  private stateArrays = new Map<string, ArrayType>();
  private locals = new Set<string>();
  private localArrays = new Map<string, ArrayType>();

  visitSourceFile(node: SourceFileNode): Node {
    node.importedContracts = this.visitList(node.importedContracts) as ContractNode[];
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.stateArrays = new Map(
      node.stateVariables
        .filter((sv) => sv.type instanceof ArrayType && sv.type.bound === undefined)
        .map((sv) => [sv.name, sv.type as ArrayType]),
    );
    if (this.stateArrays.size === 0) return node;
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const saved = this.locals;
    const savedArrays = this.localArrays;
    this.locals = new Set();
    this.localArrays = new Map();
    for (const p of node.parameters) {
      if (!(p instanceof ParameterNode)) continue;
      this.locals.add(p.name);
      if (p.type instanceof ArrayType) this.localArrays.set(p.name, p.type);
    }
    this.collectLocals(node.body);
    if (node.body) node.body = this.visit(node.body) as BlockNode;
    this.locals = saved;
    this.localArrays = savedArrays;
    return node;
  }

  private collectLocals(node: Node | undefined): void {
    if (!node) return;
    if (node instanceof VariableDefinitionNode) {
      this.locals.add(node.name);
      if (node.type instanceof ArrayType) this.localArrays.set(node.name, node.type);
    }
    for (const key of Object.keys(node)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = (node as any)[key];
      if (v instanceof Node) this.collectLocals(v);
      else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) this.collectLocals(it);
    }
  }

  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const visited = this.visit(stmt) as StatementNode;
      const desugared = visited instanceof AssignNode
        ? this.tryDesugar(visited)
        : visited instanceof StateArrayPushNode ? this.tryDesugarNestedPush(visited) : undefined;
      if (desugared) out.push(...desugared);
      else out.push(visited);
    }
    node.statements = out;
    return node;
  }

  private tryDesugar(node: AssignNode): StatementNode[] | undefined {
    if (!(node.expression instanceof IdentifierNode)) return undefined;
    const tgtName = node.identifier.name;
    const srcName = node.expression.name;
    if (tgtName === srcName) return undefined;
    if (this.locals.has(tgtName)) return undefined; // a local shadows the target state array
    const tgt = this.stateArrays.get(tgtName);
    // A calldata/memory/local value array is a valid source too. Prefer its declared type when a local shadows a
    // same-named state array; the loop reads the local directly and pushes cast elements into the state target.
    const src = this.localArrays.get(srcName) ?? this.stateArrays.get(srcName);
    const sameElementType = tgt?.elementType.toString() === src?.elementType.toString();
    if (!tgt || !src || (sameElementType
      && (!(tgt.elementType instanceof ValueType) || !isChunkPackableElementType(tgt.elementType)))) return undefined;

    const loc = node.location;
    const at = <T extends Node>(x: T): T => { x.location = loc; return x; };
    const ident = (n: string): IdentifierNode => at(new IdentifierNode(n));
    const lit = (i: number): IntLiteralNode => at(new IntLiteralNode(BigInt(i)));
    const idxName = `__arrcopy_i_${loc?.start.line ?? 0}_${loc?.start.column ?? 0}`;

    const idxDef = at(new VariableDefinitionNode(PrimitiveType.BIGINT, [], idxName, lit(0)));
    const value = this.convertElement(tgt.elementType, src.elementType, srcName, idxName, node);
    if (!value) return undefined;
    const push = at(new StateArrayPushNode(tgtName, value));
    const update = at(new AssignNode(ident(idxName),
      at(new BinaryOpNode(ident(idxName), BinaryOperator.PLUS, lit(1)))));
    const cond = at(new BinaryOpNode(ident(idxName), BinaryOperator.LT,
      at(new UnaryOpNode(UnaryOperator.SIZE, ident(srcName)))));
    const whileNode = at(new WhileNode(cond, at(new BlockNode([push, update]))));
    return [at(new DeleteStateNode(tgtName)), idxDef, whileNode];
  }

  private tryDesugarNestedPush(node: StateArrayPushNode): StatementNode[] | undefined {
    if (!(node.value instanceof IdentifierNode)) return undefined;
    const outer = this.stateArrays.get(node.name);
    const target = outer?.elementType;
    const source = this.localArrays.get(node.value.name) ?? this.stateArrays.get(node.value.name);
    if (!(target instanceof ArrayType) || !(source instanceof ArrayType)
      || target.bound !== undefined || source.bound !== undefined
      || !(target.elementType instanceof BytesType) || !(source.elementType instanceof BytesType)
      || target.elementType.bound === undefined || source.elementType.bound === undefined
      || source.elementType.bound > target.elementType.bound) return undefined;

    const loc = node.location;
    const at = <T extends Node>(x: T): T => { x.location = loc; return x; };
    const id = (name: string): IdentifierNode => at(new IdentifierNode(name));
    const lit = (i: number): IntLiteralNode => at(new IntLiteralNode(BigInt(i)));
    const suffix = `${loc?.start.line ?? 0}_${loc?.start.column ?? 0}`;
    const tmpName = `__arrpush_copy_${suffix}`;
    const idxName = `__arrpush_i_${suffix}`;
    const length = at(new UnaryOpNode(UnaryOperator.SIZE, id(node.value.name)));
    const allocation = at(new NewArrayNode(target.elementType, length));
    const tmp = at(new VariableDefinitionNode(target, ['memory'], tmpName, allocation));
    const idx = at(new VariableDefinitionNode(PrimitiveType.BIGINT, [], idxName, lit(0)));
    const read = at(new ArrayAccessNode(id(node.value.name), id(idxName)));
    const cast = at(new CastNode(target.elementType, read, false));
    const write = at(new ArrayAssignNode(tmpName, id(idxName), cast));
    const update = at(new AssignNode(id(idxName),
      at(new BinaryOpNode(id(idxName), BinaryOperator.PLUS, lit(1)))));
    const cond = at(new BinaryOpNode(id(idxName), BinaryOperator.LT,
      at(new UnaryOpNode(UnaryOperator.SIZE, id(node.value.name)))));
    const loop = at(new WhileNode(cond, at(new BlockNode([write, update]))));
    return [tmp, idx, loop, at(new StateArrayPushNode(node.name, id(tmpName)))];
  }

  private convertElement(
    target: ArrayType['elementType'], source: ArrayType['elementType'],
    srcName: string, idxName: string, from: Node,
  ): ExpressionNode | undefined {
    const at = <T extends Node>(x: T): T => { x.location = from.location; return x; };
    const id = (name: string): IdentifierNode => at(new IdentifierNode(name));
    const row = (): ArrayAccessNode => at(new ArrayAccessNode(id(srcName), id(idxName)));
    if (target.toString() === source.toString()) return row();
    if (target instanceof BytesType && source instanceof BytesType) {
      return at(new CastNode(target, row(), false));
    }
    if (target instanceof ArrayType && source instanceof ArrayType
      && target.bound !== undefined && source.bound !== undefined
      && target.elementType.toString() === source.elementType.toString()) {
      const elements: ExpressionNode[] = [];
      for (let i = 0; i < target.bound; i += 1) {
        if (i < source.bound) {
          elements.push(at(new ArrayAccessNode(row(), at(new IntLiteralNode(BigInt(i))))));
        } else {
          elements.push(createDefaultValueExpression(target.elementType, from.location!));
        }
      }
      const array = at(new ArrayNode(elements));
      array.blobEncoded = true;
      return array;
    }
    return undefined;
  }
}
