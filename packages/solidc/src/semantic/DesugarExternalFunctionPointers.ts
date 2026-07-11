import { FunctionType } from '@solidcash/utils';
import {
  Node,
  SourceFileNode,
  ContractNode,
  BlockNode,
  StatementNode,
  FunctionDefinitionNode,
  VariableDefinitionNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  MethodCallNode,
  MethodCallStatementNode,
  ExpressionStatementNode,
  TernaryOpNode,
  FieldAccessNode,
  IdentifierNode,
  ExpressionNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/**
 * FOREIGN external function pointers. A `function(...) external f = IFoo(addr).method` targets ANOTHER contract,
 * so `f(args)` is a cross-contract call. When f is a compile-time alias, desugar it to the external-call form:
 *
 *   FIXED method:           function() external f = IFoo(addr).method;         f(args) -> IFoo(addr).method(args)
 *   SAME-ADDRESS VARYING:   function() external f = cond ? IC(addr).a : IC(addr).b;
 *                           f(args) -> IC(addr).a(args) with a RUNTIME selector `cond ? IC.a.selector : IC.b.selector`
 *
 * The fixed case reduces to the tested external call (sound by reduction). The varying case is ONE co-spend of
 * the target, the covenant asserting the co-spent selector equals the runtime selector (bound to cond) -
 * avoiding the two-slot duplicate co-spend of an if-conversion.
 *
 * Self pointers (`this.f`) are handled earlier as internal OP_INVOKE. A pointer that is reassigned, stored, or
 * passed is left untouched.
 */
export default class DesugarExternalFunctionPointers extends AstTraversal {
  private aliases = new Map<string, ExpressionNode>();

  visitSourceFile(node: SourceFileNode): Node {
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
    const saved = this.aliases;
    this.aliases = new Map();
    if (node.body) {
      this.collectAliases(node.body);
      node.body = this.visit(node.body) as BlockNode;
    }
    this.aliases = saved;
    return node;
  }

  // Collect single-assignment foreign external-pointer aliases. A name defined more than once is dropped.
  private collectAliases(node: Node): void {
    const seen = new Set<string>();
    const walk = (n: Node): void => {
      if (n instanceof VariableDefinitionNode && n.type instanceof FunctionType && n.type.isExternal
          && n.expression && this.isRewritableAlias(n.expression)) {
        if (seen.has(n.name)) this.aliases.delete(n.name);
        else { this.aliases.set(n.name, n.expression); seen.add(n.name); }
      }
      for (const key of Object.keys(n)) {
        const val = (n as unknown as Record<string, unknown>)[key];
        if (val instanceof Node) walk(val);
        else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) walk(v);
      }
    };
    walk(node);
  }

  // A rewritable alias RHS is a foreign interface member `IFoo(addr).method` (FIXED), or a ternary of two
  // members on the SAME interface-cast receiver `cond ? IC(addr).a : IC(addr).b` (SAME-ADDRESS VARYING).
  private isRewritableAlias(expr: ExpressionNode): boolean {
    if (expr instanceof FieldAccessNode) return true;
    if (expr instanceof TernaryOpNode
        && expr.ifTrue instanceof FieldAccessNode && expr.ifFalse instanceof FieldAccessNode) {
      const recv = this.castInterfaceName(expr.ifTrue.expression);
      return recv !== undefined && recv === this.castInterfaceName(expr.ifFalse.expression)
        && this.sameReceiver(expr.ifTrue.expression, expr.ifFalse.expression);
    }
    return false;
  }

  // The interface name of an `IFace(addr)` cast receiver, or undefined if not a plain interface cast.
  private castInterfaceName(expr: ExpressionNode): string | undefined {
    return expr instanceof FunctionCallNode && expr.identifier instanceof IdentifierNode
      ? expr.identifier.name : undefined;
  }

  // Structural equality of two receiver expressions (enough for `IFace(addr)` casts: same identifier + args).
  private sameReceiver(a: ExpressionNode, b: ExpressionNode): boolean {
    if (a instanceof IdentifierNode && b instanceof IdentifierNode) return a.name === b.name;
    if (a instanceof FunctionCallNode && b instanceof FunctionCallNode) {
      return a.identifier instanceof IdentifierNode && b.identifier instanceof IdentifierNode
        && a.identifier.name === b.identifier.name
        && a.parameters.length === b.parameters.length
        && a.parameters.every((p, i) => this.sameReceiver(p, b.parameters[i]));
    }
    return false;
  }

  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      // Drop the alias declaration itself - its calls are rewritten to the external-call form. Guard with
      // has(): an uninitialized local has expression===undefined, which must not match a non-alias name.
      if (stmt instanceof VariableDefinitionNode && this.aliases.has(stmt.name)
          && this.aliases.get(stmt.name) === stmt.expression) continue;
      // A bare `f(args);` statement wraps the call; rewrite the wrapper (MethodCall -> method-call statement).
      if (stmt instanceof FunctionCallStatementNode && this.callAlias(stmt.call)) {
        const rewritten = this.rewriteCall(stmt.call);
        const wrapped = rewritten instanceof MethodCallNode
          ? new MethodCallStatementNode(rewritten)
          : new ExpressionStatementNode(rewritten);
        wrapped.location = stmt.location;
        out.push(wrapped);
        continue;
      }
      out.push(this.visit(stmt) as StatementNode);
    }
    node.statements = out;
    return node;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    // `f(args)` in expression position (e.g. `require(f(z) == z)`) -> the external call.
    if (this.callAlias(node)) return this.rewriteCall(node);
    return super.visitFunctionCall(node);
  }

  // `f.selector` / `f.address` on a foreign fn-ptr alias -> the aliased member's compile-time selector / the
  // interface-cast address (the EVM `function external` value members).
  visitFieldAccess(node: FieldAccessNode): Node {
    if ((node.name === 'selector' || node.name === 'address') && node.expression instanceof IdentifierNode) {
      const rhs = this.aliases.get(node.expression.name);
      const member = rhs instanceof FieldAccessNode ? rhs
        : rhs instanceof TernaryOpNode && rhs.ifTrue instanceof FieldAccessNode ? rhs.ifTrue : undefined;
      if (member) {
        const cast = member.expression;
        if (node.name === 'address' && cast instanceof FunctionCallNode && cast.parameters.length === 1) {
          return cloneNode(cast.parameters[0]) as ExpressionNode; // IFace(a) -> a
        }
        if (node.name === 'selector') {
          if (rhs instanceof TernaryOpNode && rhs.ifFalse instanceof FieldAccessNode) {
            // varying method: the runtime selector `cond ? a.selector : b.selector`.
            const iface = this.castInterfaceName(cast)!;
            const sel = new TernaryOpNode(cloneNode(rhs.condition) as ExpressionNode,
              this.selectorOf(iface, member.name, node), this.selectorOf(iface, rhs.ifFalse.name, node));
            sel.location = node.location;
            return sel;
          }
          const iface = this.castInterfaceName(cast);
          if (iface) return this.selectorOf(iface, member.name, node);
        }
      }
    }
    return super.visitFieldAccess(node);
  }

  private callAlias(node: FunctionCallNode): ExpressionNode | undefined {
    const id = node.identifier;
    return id instanceof IdentifierNode ? this.aliases.get(id.name) : undefined;
  }

  private rewriteCall(node: FunctionCallNode): ExpressionNode {
    const rhs = this.callAlias(node)!;
    const args = node.parameters.map((a) => cloneNode(a) as ExpressionNode);
    if (rhs instanceof FieldAccessNode) {
      const mc = new MethodCallNode(cloneNode(rhs.expression) as ExpressionNode, rhs.name, args);
      mc.location = node.location;
      return mc;
    }
    // SAME-ADDRESS VARYING: one call on the shared receiver + a runtime selector `cond ? m1.sel : m2.sel`.
    const t = rhs as TernaryOpNode;
    const mTrue = t.ifTrue as FieldAccessNode;
    const mFalse = t.ifFalse as FieldAccessNode;
    const iface = this.castInterfaceName(mTrue.expression)!;
    const mc = new MethodCallNode(cloneNode(mTrue.expression) as ExpressionNode, mTrue.name, args);
    mc.runtimeSelector = new TernaryOpNode(
      cloneNode(t.condition) as ExpressionNode,
      this.selectorOf(iface, mTrue.name, node),
      this.selectorOf(iface, mFalse.name, node),
    );
    mc.runtimeSelector.location = node.location;
    mc.location = node.location;
    return mc;
  }

  // `IFace.method.selector` (a bytes4 that folds to the method's compile-time selector).
  private selectorOf(iface: string, method: string, at: Node): FieldAccessNode {
    const id = new IdentifierNode(iface);
    id.location = at.location;
    const methodAccess = new FieldAccessNode(id, method);
    methodAccess.location = at.location;
    const sel = new FieldAccessNode(methodAccess, 'selector');
    sel.location = at.location;
    return sel;
  }
}
