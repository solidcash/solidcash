import { FunctionType } from '@solidcash/utils';
import {
  Node,
  SourceFileNode,
  ContractNode,
  InterfaceNode,
  InterfaceFunctionNode,
  ParameterNode,
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
  StateAccessNode,
  ExpressionNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/**
 * FOREIGN external function pointers. A `function(...) external f = IFoo(addr).method` targets ANOTHER contract,
 * so `f(args)` is a cross-contract call. When f is a compile-time alias, desugar it to the external-call form:
 *
 *   FIXED method:           function() external f = IFoo(addr).method;         f(args) -> IFoo(addr).method(args)
 *   VARYING TARGET:         function() external f = cond ? IC(a).m : IC(b).n;
 *                           f(args) -> __FnPtr_Local(cond ? a : b).__call(args) with a RUNTIME selector
 *                           `cond ? IC.m.selector : IC.n.selector`
 *
 * The fixed case reduces to the tested external call (sound by reduction). The varying case is ONE co-spend of
 * the selected target, the covenant asserting both its address and selector equal the selected expressions.
 * A varying receiver is rewritten only when its condition and both addresses are stable values: evaluating the
 * condition once for the address and again for the selector must not repeat an effect or change the choice.
 *
 * Self pointers (`this.f`) are handled earlier as internal OP_INVOKE. A pointer that is reassigned, stored, or
 * passed is left untouched.
 */
export default class DesugarExternalFunctionPointers extends AstTraversal {
  private aliases = new Map<string, ExpressionNode>();
  private aliasTypes = new Map<string, FunctionType>();
  private synthIfaces: InterfaceNode[] = [];
  private usedInterfaceNames = new Set<string>();
  private synthCounter = 0;

  visitSourceFile(node: SourceFileNode): Node {
    this.synthIfaces = [];
    this.usedInterfaceNames = new Set(node.interfaceDefinitions.map((iface) => iface.name));
    this.synthCounter = 0;
    node.importedContracts = this.visitList(node.importedContracts) as ContractNode[];
    node.freeFunctions = this.visitList(node.freeFunctions) as FunctionDefinitionNode[];
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    node.interfaceDefinitions.push(...this.synthIfaces);
    return node;
  }

  visitContract(node: ContractNode): Node {
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const saved = this.aliases;
    const savedTypes = this.aliasTypes;
    this.aliases = new Map();
    this.aliasTypes = new Map();
    if (node.body) {
      this.collectAliases(node.body);
      // This pass runs once before branch normalization and again after pointer-specific lowerings. Preserve
      // aliases captured by the early run: it may erase their declaration after rewriting high-level calls,
      // while LowerInlineAssembly still needs the original member to lower `fp.address`/`fp.selector` in Yul.
      node.externalPointerAliases = {
        ...(node.externalPointerAliases ?? {}),
        ...Object.fromEntries(this.aliases),
      };
      node.body = this.visit(node.body) as BlockNode;
    }
    this.aliases = saved;
    this.aliasTypes = savedTypes;
    return node;
  }

  // Collect single-assignment foreign external-pointer aliases. A name defined more than once is dropped.
  private collectAliases(node: Node): void {
    const seen = new Set<string>();
    const walk = (n: Node): void => {
      if (n instanceof VariableDefinitionNode && n.type instanceof FunctionType && n.type.isExternal
          && n.expression && this.isRewritableAlias(n.expression)) {
        if (seen.has(n.name)) this.aliases.delete(n.name);
        else {
          this.aliases.set(n.name, n.expression);
          this.aliasTypes.set(n.name, n.type);
          seen.add(n.name);
        }
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
  // members on the same interface. Different receivers require stable branch/condition values because the
  // selected address and selector are evaluated independently by the external-call verifier.
  private isRewritableAlias(expr: ExpressionNode): boolean {
    if (expr instanceof FieldAccessNode) return true;
    if (expr instanceof TernaryOpNode
        && expr.ifTrue instanceof FieldAccessNode && expr.ifFalse instanceof FieldAccessNode) {
      const recv = this.castInterfaceName(expr.ifTrue.expression);
      if (recv === undefined || recv !== this.castInterfaceName(expr.ifFalse.expression)) return false;
      if (this.sameReceiver(expr.ifTrue.expression, expr.ifFalse.expression)) return true;
      const trueCast = expr.ifTrue.expression as FunctionCallNode;
      const falseCast = expr.ifFalse.expression as FunctionCallNode;
      return trueCast.parameters.length === 1 && falseCast.parameters.length === 1
        && this.isStableValue(expr.condition)
        && this.isStableValue(trueCast.parameters[0])
        && this.isStableValue(falseCast.parameters[0]);
    }
    return false;
  }

  private isStableValue(expr: ExpressionNode): boolean {
    return expr instanceof IdentifierNode;
  }

  // The interface name of an `IFace(addr)` cast receiver, or undefined if not a plain interface cast.
  private castInterfaceName(expr: ExpressionNode): string | undefined {
    return expr instanceof FunctionCallNode && expr.identifier instanceof IdentifierNode
      ? expr.identifier.name : undefined;
  }

  // Structural equality of two receiver expressions (enough for `IFace(addr)` casts: same identifier + args).
  private sameReceiver(a: ExpressionNode, b: ExpressionNode): boolean {
    if (a instanceof IdentifierNode && b instanceof IdentifierNode) return a.name === b.name;
    // Bare state identifiers are normalized before this pass, so `I(handler).inc : I(handler).dec` carries two
    // separately-cloned StateAccessNodes rather than IdentifierNodes. They still name the same receiver.
    if (a instanceof StateAccessNode && b instanceof StateAccessNode) return a.name === b.name;
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
          if (rhs instanceof TernaryOpNode && rhs.ifFalse instanceof FieldAccessNode
            && !this.sameReceiver(cast, rhs.ifFalse.expression)) {
            const falseCast = rhs.ifFalse.expression as FunctionCallNode;
            const selectedAddress = new TernaryOpNode(
              cloneNode(rhs.condition) as ExpressionNode,
              cloneNode(cast.parameters[0]) as ExpressionNode,
              cloneNode(falseCast.parameters[0]) as ExpressionNode,
            );
            selectedAddress.location = node.location;
            return selectedAddress;
          }
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
      mc.callOptions = node.callOptions;
      mc.location = node.location;
      return mc;
    }
    // One call on the selected receiver + a runtime selector `cond ? m1.sel : m2.sel`.
    const t = rhs as TernaryOpNode;
    const mTrue = t.ifTrue as FieldAccessNode;
    const mFalse = t.ifFalse as FieldAccessNode;
    const iface = this.castInterfaceName(mTrue.expression)!;
    const sameReceiver = this.sameReceiver(mTrue.expression, mFalse.expression);
    let receiver: ExpressionNode;
    let method: string;
    if (sameReceiver) {
      receiver = cloneNode(mTrue.expression) as ExpressionNode;
      method = mTrue.name;
    } else {
      const trueCast = mTrue.expression as FunctionCallNode;
      const falseCast = mFalse.expression as FunctionCallNode;
      const selectedAddress = new TernaryOpNode(
        cloneNode(t.condition) as ExpressionNode,
        cloneNode(trueCast.parameters[0]) as ExpressionNode,
        cloneNode(falseCast.parameters[0]) as ExpressionNode,
      );
      selectedAddress.location = node.location;
      const pointerType = this.aliasTypes.get(node.identifier.name);
      if (!pointerType) throw new Error('Varying external pointer has no declared function type');
      const pointerIface = this.synthInterface(pointerType);
      const pointerId = new IdentifierNode(pointerIface);
      pointerId.location = node.location;
      receiver = new FunctionCallNode(pointerId, [selectedAddress]);
      receiver.location = node.location;
      method = '__call';
    }
    const mc = new MethodCallNode(receiver, method, args);
    mc.callOptions = node.callOptions;
    mc.runtimeSelector = new TernaryOpNode(
      cloneNode(t.condition) as ExpressionNode,
      this.selectorOf(iface, mTrue.name, node),
      this.selectorOf(iface, mFalse.name, node),
    );
    mc.runtimeSelector.location = node.location;
    mc.location = node.location;
    return mc;
  }

  private synthInterface(type: FunctionType): string {
    let name: string;
    do {
      name = `__FnPtr_Local${this.synthCounter++}`;
    } while (this.usedInterfaceNames.has(name));
    this.usedInterfaceNames.add(name);
    const parameters = type.parameterTypes.map((parameter, index) => new ParameterNode(parameter, `p${index}`));
    const method = new InterfaceFunctionNode('__call', parameters, type.returnTypes, type.stateMutability);
    this.synthIfaces.push(new InterfaceNode(name, [], [], [method]));
    return name;
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
