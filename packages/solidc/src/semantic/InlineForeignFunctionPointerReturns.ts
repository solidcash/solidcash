import {
  Node,
  SourceFileNode,
  ContractNode,
  FunctionDefinitionNode,
  ReturnNode,
  FunctionCallNode,
  MethodCallNode,
  FieldAccessNode,
  IdentifierNode,
  ExpressionNode,
} from '../ast/AST.js';
import { FunctionType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/**
 * Foreign external function pointers flowing through a SIDE-EFFECT-FREE internal/private helper (whole body is
 * one `return <expr>`), inlined by beta-reduction at each call site. Two shapes:
 *
 *   RETURNED:  function make(address a) internal returns (function(uint) external returns(uint)) { return IFoo(a).m; }
 *              function(uint) external returns(uint) p = make(a);   ->   ... p = IFoo(a).m;   (straight-line desugar)
 *   PASSED:    function relay(function(uint) external returns(uint) cb, uint v) internal returns(uint){ return cb(v); }
 *              relay(IFoo(a).m, v)                                   ->   IFoo(a).m(v)         (the external call)
 *
 * DesugarExternalFunctionPointers (the next pass) reduces the returned/aliased member to the audited external
 * call. Sound by reduction: the helper has no side effects. The self-ref/foreign DUALITY is respected - a helper
 * whose external fn-ptr param is ever passed a NON-member (a self-ref `this.g` = a functionId) is NOT inlined
 * (left to the internal OP_INVOKE path). Runs BEFORE the straight-line desugar. A PUBLIC (cross-ABI) fn-ptr
 * return/pass still needs the (address, selector) blob value model (future). v1: single-return helpers.
 */
export default class InlineForeignFunctionPointerReturns extends AstTraversal {
  // helper name -> { param names, external-fn-ptr param positions, the single returned expression }
  private candidates = new Map<string, { params: string[]; extPtrParams: Set<number>; returnExpr: ExpressionNode }>();

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visitContract(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    const bodies = [node.constructorDef, ...node.functions, node.fallbackDef, node.receiveDef]
      .filter((f): f is FunctionDefinitionNode => !!f?.body);

    this.candidates = new Map();
    for (const fn of node.functions) {
      if (fn.visibility !== 'internal' && fn.visibility !== 'private') continue;
      const stmts = fn.body?.statements ?? [];
      if (stmts.length !== 1 || !(stmts[0] instanceof ReturnNode)) continue;
      const ret = stmts[0] as ReturnNode;
      if (ret.expressions.length !== 1) continue;
      const retsPtr = fn.returnTypes[0] instanceof FunctionType && (fn.returnTypes[0] as FunctionType).isExternal;
      const extPtrParams = new Set<number>();
      fn.parameters.forEach((p, i) => {
        if (p.type instanceof FunctionType && (p.type as FunctionType).isExternal) extPtrParams.add(i);
      });
      if (!retsPtr && extPtrParams.size === 0) continue;
      // A helper with external fn-ptr params inlines only if EVERY call passes a foreign MEMBER for each (a
      // self-ref would be a functionId - leave it to the OP_INVOKE path).
      if (extPtrParams.size > 0 && !this.allCallsPassMembers(bodies, fn.name, extPtrParams)) continue;
      this.candidates.set(fn.name, {
        params: fn.parameters.map((p) => p.name), extPtrParams, returnExpr: ret.expressions[0],
      });
    }
    if (this.candidates.size === 0) return node;

    node.constructorDef = this.rewrite(node.constructorDef);
    node.functions = node.functions.map((f) => this.rewrite(f)!);
    node.fallbackDef = this.rewrite(node.fallbackDef);
    node.receiveDef = this.rewrite(node.receiveDef);
    node.functions = node.functions.filter((f) => !this.candidates.has(f.name));
    return node;
  }

  // Every call `name(...)` in the contract passes a foreign member (`IFace(a).m`) at each ext-fn-ptr position.
  private allCallsPassMembers(bodies: FunctionDefinitionNode[], name: string, positions: Set<number>): boolean {
    let ok = true;
    const walk = (n: Node): void => {
      if (n instanceof FunctionCallNode && n.identifier instanceof IdentifierNode && n.identifier.name === name) {
        for (const pos of positions) if (!this.isForeignMember(n.parameters[pos])) ok = false;
      }
      for (const key of Object.keys(n)) {
        const val = (n as unknown as Record<string, unknown>)[key];
        if (val instanceof Node) walk(val);
        else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) walk(v);
      }
    };
    for (const fn of bodies) walk(fn.body!);
    return ok;
  }

  private rewrite(fn: FunctionDefinitionNode | undefined): FunctionDefinitionNode | undefined {
    if (fn?.body && !this.candidates.has(fn.name)) fn.body = this.visit(fn.body) as typeof fn.body;
    return fn;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    if (node.identifier instanceof IdentifierNode) {
      const cand = this.candidates.get(node.identifier.name);
      if (cand && node.parameters.length === cand.params.length) {
        const subst = new Map<string, ExpressionNode>();
        cand.params.forEach((p, i) => subst.set(p, this.visit(node.parameters[i]) as ExpressionNode));
        return this.substExpr(cloneNode(cand.returnExpr) as ExpressionNode, subst);
      }
    }
    return super.visitFunctionCall(node);
  }

  // Substitute helper params with call args; a call THROUGH a substituted fn-ptr param (`cb(args)`) becomes the
  // member's method call (`IFace(a).m(args)`).
  private substExpr(expr: ExpressionNode, subst: Map<string, ExpressionNode>): ExpressionNode {
    if (expr instanceof IdentifierNode && subst.has(expr.name)) {
      return cloneNode(subst.get(expr.name)!) as ExpressionNode;
    }
    if (expr instanceof FunctionCallNode && expr.identifier instanceof IdentifierNode
        && subst.has(expr.identifier.name)) {
      const target = subst.get(expr.identifier.name)!;
      const args = expr.parameters.map((a) => this.substExpr(a, subst));
      if (target instanceof FieldAccessNode) {
        const mc = new MethodCallNode(cloneNode(target.expression) as ExpressionNode, target.name, args);
        mc.location = expr.location;
        return mc;
      }
      throw new Error('unsupported foreign function-pointer argument in an inlined helper call');
    }
    for (const key of Object.keys(expr)) {
      const val = (expr as unknown as Record<string, unknown>)[key];
      if (val instanceof Node) (expr as unknown as Record<string, unknown>)[key] = this.substExpr(val as ExpressionNode, subst);
      else if (Array.isArray(val)) {
        (expr as unknown as Record<string, unknown>)[key] = val.map((v) => v instanceof Node ? this.substExpr(v as ExpressionNode, subst) : v);
      }
    }
    return expr;
  }

  // `IFace(addr).method` (a FieldAccess over a single-arg cast) - the foreign fn-ptr member form.
  private isForeignMember(expr: ExpressionNode | undefined): boolean {
    return expr instanceof FieldAccessNode && expr.expression instanceof FunctionCallNode
      && (expr.expression as FunctionCallNode).identifier instanceof IdentifierNode
      && (expr.expression as FunctionCallNode).parameters.length === 1;
  }
}
