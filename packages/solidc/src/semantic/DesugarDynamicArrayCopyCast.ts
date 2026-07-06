import { ArrayType, BytesType, PrimitiveType } from '@solidcash/utils';
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
} from '../ast/AST.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';

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

  visitSourceFile(node: SourceFileNode): Node {
    node.importedContracts = this.visitList(node.importedContracts) as ContractNode[];
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.stateArrays = new Map(
      node.stateVariables
        .filter((sv) => sv.type instanceof ArrayType && sv.type.bound === undefined
          && sv.type.elementType instanceof BytesType)
        .map((sv) => [sv.name, sv.type as ArrayType]),
    );
    if (this.stateArrays.size === 0) return node;
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const saved = this.locals;
    this.locals = new Set();
    for (const p of node.parameters) if (p instanceof ParameterNode) this.locals.add(p.name);
    this.collectLocals(node.body);
    if (node.body) node.body = this.visit(node.body) as BlockNode;
    this.locals = saved;
    return node;
  }

  private collectLocals(node: Node | undefined): void {
    if (!node) return;
    if (node instanceof VariableDefinitionNode) this.locals.add(node.name);
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
      const desugared = visited instanceof AssignNode ? this.tryDesugar(visited) : undefined;
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
    if (this.locals.has(tgtName) || this.locals.has(srcName)) return undefined; // a local shadows the state array
    const tgt = this.stateArrays.get(tgtName);
    const src = this.stateArrays.get(srcName);
    if (!tgt || !src || tgt.elementType.toString() === src.elementType.toString()) return undefined;

    const loc = node.location;
    const at = <T extends Node>(x: T): T => { x.location = loc; return x; };
    const ident = (n: string): IdentifierNode => at(new IdentifierNode(n));
    const lit = (i: number): IntLiteralNode => at(new IntLiteralNode(BigInt(i)));
    const idxName = `__arrcopy_i_${loc?.start.line ?? 0}_${loc?.start.column ?? 0}`;

    const idxDef = at(new VariableDefinitionNode(PrimitiveType.BIGINT, [], idxName, lit(0)));
    const cast = at(new CastNode(tgt.elementType, at(new ArrayAccessNode(ident(srcName), ident(idxName))), false));
    const push = at(new StateArrayPushNode(tgtName, cast));
    const update = at(new AssignNode(ident(idxName),
      at(new BinaryOpNode(ident(idxName), BinaryOperator.PLUS, lit(1)))));
    const cond = at(new BinaryOpNode(ident(idxName), BinaryOperator.LT,
      at(new UnaryOpNode(UnaryOperator.SIZE, ident(srcName)))));
    const whileNode = at(new WhileNode(cond, at(new BlockNode([push, update]))));
    return [at(new DeleteStateNode(tgtName)), idxDef, whileNode];
  }
}
