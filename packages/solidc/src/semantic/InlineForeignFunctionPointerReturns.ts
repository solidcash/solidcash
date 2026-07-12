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
  // helper name -> { param names, external-fn-ptr param positions, the single returned expression, isPublic }
  private candidates = new Map<string,
    { params: string[]; extPtrParams: Set<number>; returnExpr: ExpressionNode; isPublic: boolean }>();
  private fnPtrStateVars = new Set<string>(); // foreign fn-ptr state vars - sound to beta-reduce as a helper arg

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visitContract(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    const bodies = [node.constructorDef, ...node.functions, node.fallbackDef, node.receiveDef]
      .filter((f): f is FunctionDefinitionNode => !!f?.body);

    this.fnPtrStateVars = new Set(
      node.stateVariables
        .filter((sv) => sv.type instanceof FunctionType && (sv.type as FunctionType).isExternal)
        .map((sv) => sv.name),
    );

    this.candidates = new Map();
    for (const fn of node.functions) {
      // Public helpers are eligible too (`this.eval(x)` is a self-external call to a public fn): inline the
      // internal call sites but keep the public ABI entry (only remove internal/private candidates below).
      const isPublic = fn.visibility !== 'internal' && fn.visibility !== 'private';
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
      // A helper with external fn-ptr params inlines only if EVERY call passes an arg SAFE to beta-reduce for
      // each: a foreign MEMBER (`IFace(a).m`) or a foreign fn-ptr STATE VAR (`x`). A self-ref (`this.g`, a
      // functionId) or any other identifier (a param that could be a self-ref) is NOT - leave those to OP_INVOKE.
      if (extPtrParams.size > 0 && !this.allCallsPassBetaReducible(bodies, fn.name, extPtrParams)) continue;
      this.candidates.set(fn.name, {
        params: fn.parameters.map((p) => p.name), extPtrParams, returnExpr: ret.expressions[0], isPublic,
      });
    }
    if (this.candidates.size === 0) return node;

    node.constructorDef = this.rewrite(node.constructorDef);
    node.functions = node.functions.map((f) => this.rewrite(f)!);
    node.fallbackDef = this.rewrite(node.fallbackDef);
    node.receiveDef = this.rewrite(node.receiveDef);
    // Remove only internal/private candidates (fully inlined); a public candidate keeps its ABI entry.
    node.functions = node.functions.filter((f) => !(this.candidates.get(f.name)?.isPublic === false));
    return node;
  }

  // Every call `name(...)` passes a beta-reducible fn-ptr arg (a foreign member or a foreign fn-ptr state var) at
  // each ext-fn-ptr position.
  private allCallsPassBetaReducible(
    bodies: FunctionDefinitionNode[], name: string, positions: Set<number>,
  ): boolean {
    let ok = true;
    const walk = (n: Node): void => {
      if (n instanceof FunctionCallNode && n.identifier instanceof IdentifierNode && n.identifier.name === name) {
        for (const pos of positions) if (!this.isBetaReducibleArg(n.parameters[pos])) ok = false;
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

  // A foreign member `IFace(a).m`, or a foreign fn-ptr STATE VAR `x` (its call `x(v)` is handled by the storage
  // lowering / deploy fold). NOT a bare param/local identifier (could hold a self-ref functionId).
  private isBetaReducibleArg(expr: ExpressionNode | undefined): boolean {
    if (this.isForeignMember(expr)) return true;
    return expr instanceof IdentifierNode && this.fnPtrStateVars.has(expr.name);
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
      if (target instanceof IdentifierNode) {
        // `cb(args)` where cb -> a fn-ptr state var `x`: reduce to `x(args)` (the storage lowering / deploy fold
        // dispatches it). Gated by isBetaReducibleArg to a foreign fn-ptr state var.
        const fc = new FunctionCallNode(cloneNode(target) as IdentifierNode, args);
        fc.location = expr.location;
        return fc;
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
