import {
  Node,
  SourceFileNode,
  ContractNode,
  FunctionDefinitionNode,
  ReturnNode,
  FunctionCallNode,
  IdentifierNode,
  ExpressionNode,
} from '../ast/AST.js';
import { FunctionType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/**
 * A foreign external function pointer RETURNED from an internal/private helper. A `function(P) external`
 * value has no first-class representation, so it cannot escape a function via a plain return; but a
 * side-effect-free helper whose whole body is `return <fn-ptr expr>` can be INLINED (beta-reduced) at its call
 * sites:
 *
 *   function make(address a) internal returns (function(uint) external returns(uint)) { return IFoo(a).m; }
 *   function use(address a, uint v) { function(uint) external returns(uint) p = make(a); return p(v); }
 *        ->  function use(..) { function(uint) external returns(uint) p = IFoo(a).m; return p(v); }
 *
 * which DesugarExternalFunctionPointers (the next pass) then reduces to the audited external call. Sound by
 * reduction: the helper has no side effects (body is exactly one return), so substituting its return expression
 * (params -> call args) at the call site is behaviour-preserving. Runs BEFORE the straight-line desugar. A
 * PUBLIC (cross-ABI) fn-ptr return still needs the (address, selector) blob value model (future). v1: single
 * return, internal/private helpers.
 */
export default class InlineForeignFunctionPointerReturns extends AstTraversal {
  // helper name -> { param names, the single returned expression }
  private candidates = new Map<string, { params: string[]; returnExpr: ExpressionNode }>();

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visitContract(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.candidates = new Map();
    for (const fn of node.functions) {
      if (fn.visibility !== 'internal' && fn.visibility !== 'private') continue;
      if (!(fn.returnTypes[0] instanceof FunctionType) || !(fn.returnTypes[0] as FunctionType).isExternal) continue;
      const stmts = fn.body?.statements ?? [];
      if (stmts.length !== 1 || !(stmts[0] instanceof ReturnNode)) continue;
      const ret = stmts[0] as ReturnNode;
      if (ret.expressions.length !== 1) continue;
      this.candidates.set(fn.name, { params: fn.parameters.map((p) => p.name), returnExpr: ret.expressions[0] });
    }
    if (this.candidates.size === 0) return node;

    node.constructorDef = this.rewrite(node.constructorDef);
    node.functions = node.functions.map((f) => this.rewrite(f)!);
    node.fallbackDef = this.rewrite(node.fallbackDef);
    node.receiveDef = this.rewrite(node.receiveDef);
    // Drop the now-inlined helpers (their un-representable fn-ptr return would not compile on its own).
    node.functions = node.functions.filter((f) => !this.candidates.has(f.name));
    return node;
  }

  private rewrite(fn: FunctionDefinitionNode | undefined): FunctionDefinitionNode | undefined {
    if (fn?.body && !this.candidates.has(fn.name)) fn.body = this.visit(fn.body) as typeof fn.body;
    return fn;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    if (node.identifier instanceof IdentifierNode) {
      const cand = this.candidates.get(node.identifier.name);
      if (cand && node.parameters.length === cand.params.length) {
        return this.betaReduce(cand, node.parameters.map((a) => this.visit(a) as ExpressionNode));
      }
    }
    return super.visitFunctionCall(node);
  }

  private betaReduce(
    cand: { params: string[]; returnExpr: ExpressionNode },
    args: ExpressionNode[],
  ): ExpressionNode {
    const subst = new Map<string, ExpressionNode>();
    cand.params.forEach((p, i) => subst.set(p, args[i]));
    const expr = cloneNode(cand.returnExpr) as ExpressionNode;
    if (expr instanceof IdentifierNode && subst.has(expr.name)) return cloneNode(subst.get(expr.name)!) as ExpressionNode;
    this.substitute(expr, subst);
    return expr;
  }

  // Replace every IdentifierNode child whose name is a helper param with the corresponding (cloned) call arg.
  private substitute(node: Node, subst: Map<string, ExpressionNode>): void {
    for (const key of Object.keys(node)) {
      const val = (node as unknown as Record<string, unknown>)[key];
      if (val instanceof IdentifierNode && subst.has(val.name)) {
        (node as unknown as Record<string, unknown>)[key] = cloneNode(subst.get(val.name)!);
      } else if (val instanceof Node) {
        this.substitute(val, subst);
      } else if (Array.isArray(val)) {
        val.forEach((v, i) => {
          if (v instanceof IdentifierNode && subst.has(v.name)) val[i] = cloneNode(subst.get(v.name)!);
          else if (v instanceof Node) this.substitute(v, subst);
        });
      }
    }
  }
}
