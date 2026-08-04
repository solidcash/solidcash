import {
  Node,
  SourceFileNode,
  ContractNode,
  InterfaceNode,
  StateVariableNode,
  FunctionDefinitionNode,
  VariableDefinitionNode,
  InstantiationNode,
  AssignNode,
  StateAssignNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  MethodCallStatementNode,
  FieldAccessNode,
  MethodCallNode,
  IdentifierNode,
  ExpressionNode,
} from '../ast/AST.js';
import { FunctionType, AddressType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/**
 * FOREIGN external function-pointer STATE VARIABLES that hold a fixed method on a runtime address.
 *
 * A `function(P) external returns(R) x;` whose every assignment is `x = IFace(addr).method` (same interface +
 * method, varying address) is equivalent to storing just the ADDRESS and calling that fixed method:
 *
 *   function(uint) external returns(uint) x;              address x;
 *   x = IFoo(a).addTwo;                          ->       x = a;
 *   x(v)                                                  IFoo(x).addTwo(v)
 *
 * so it lowers to a plain `address` state var + the audited state-address external call (runs BEFORE
 * SynthesizeExternalAddressLocals, which then hoists `IFoo(x).addTwo(v)` to the `__extaddr_` dispatch). Sound by
 * reduction to that tested form. A pointer is lowered only when EVERY assignment matches the same (interface,
 * method) - a self-ref `this.f` (a functionId, handled separately), a varying method, or a param-sourced value
 * (`x = y`) leaves it unclassified (its existing behavior is unchanged). v1: state variables only.
 */
export default class LowerForeignFunctionPointerVars extends AstTraversal {
  private typeNames = new Set<string>();
  // state var name -> the fixed (interfaceName, methodName) it always points at
  private lowered = new Map<string, { iface: string; method: string }>();
  // Per-function: a lowered fn-ptr state var stored FROM a freshly-`new`ed local this same function
  // (`T o = new T(); stored = IFace(o).m;`) -> a same-tx `stored()` call folds into o's deploy genesis. Maps the
  // state var name to the deploy local + method, so `stored()` rewrites to the direct `o.m()` the fold handles.
  private sameFnFold = new Map<string, { local: string; method: string }>();

  visitSourceFile(node: SourceFileNode): Node {
    this.typeNames = new Set();
    for (const iface of node.interfaceDefinitions as InterfaceNode[]) this.typeNames.add(iface.name);
    for (const c of node.importedContracts as ContractNode[]) this.typeNames.add(c.name);
    if (node.contract) this.typeNames.add(node.contract.name);
    if (node.contract) node.contract = this.visitContract(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    const fnPtrVars = node.stateVariables.filter((sv) => sv.type instanceof FunctionType && sv.type.isExternal);
    if (fnPtrVars.length === 0) return node;

    const bodies = [node.constructorDef, ...node.functions, node.fallbackDef, node.receiveDef]
      .filter((f): f is FunctionDefinitionNode => !!f?.body);

    // Classify: a fn-ptr state var is lowerable iff it has >=1 assignment and EVERY assignment is a consistent
    // `IFace(addr).method` foreign member (same interface + method).
    this.lowered = new Map();
    for (const sv of fnPtrVars) {
      let target: { iface: string; method: string } | undefined;
      let ok = true;
      let hasAssign = false;
      for (const fn of bodies) {
        this.forEachAssignTo(fn.body!, sv.name, (rhs) => {
          hasAssign = true;
          const m = this.foreignMember(rhs);
          if (!m) { ok = false; return; }
          if (!target) target = m;
          else if (target.iface !== m.iface || target.method !== m.method) ok = false;
        });
      }
      if (ok && hasAssign && target) this.lowered.set(sv.name, target);
    }
    if (this.lowered.size === 0) return node;

    // Lower each classified var's declared type to `address`, then rewrite its assignments + calls.
    for (const sv of fnPtrVars) {
      if (this.lowered.has(sv.name)) sv.type = new AddressType(false);
    }
    node.constructorDef = this.rewriteBody(node.constructorDef);
    node.functions = node.functions.map((f) => this.rewriteBody(f)!);
    node.fallbackDef = this.rewriteBody(node.fallbackDef);
    node.receiveDef = this.rewriteBody(node.receiveDef);
    return node;
  }

  private rewriteBody(fn: FunctionDefinitionNode | undefined): FunctionDefinitionNode | undefined {
    if (fn?.body) {
      this.sameFnFold = this.scanSameFnFold(fn);
      fn.body = this.visit(fn.body) as typeof fn.body;
      this.sameFnFold = new Map();
    }
    return fn;
  }

  // Detect, within one function, `T o = new T(); ... stored = IFace(o).m;` (stored a lowered fn-ptr var, o a
  // freshly-deployed local). A same-tx `stored()` then reduces to the direct `o.m()` (the deploy-fold form),
  // which is byte-equivalent to the state-address co-spend when o is an existing callee but ALSO lets the deploy
  // fold `o.m()` into o's genesis (o cannot be co-spent as an input of its own deploy tx).
  private scanSameFnFold(fn: FunctionDefinitionNode): Map<string, { local: string; method: string }> {
    const deployLocals = new Set<string>();
    const walk = (n: Node): void => {
      if (n instanceof VariableDefinitionNode && n.expression instanceof InstantiationNode) {
        deployLocals.add(n.name);
      }
      for (const key of Object.keys(n)) {
        const val = (n as unknown as Record<string, unknown>)[key];
        if (val instanceof Node) walk(val);
        else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) walk(v);
      }
    };
    walk(fn.body!);
    const out = new Map<string, { local: string; method: string }>();
    if (deployLocals.size === 0) return out;
    const record = (name: string, rhs: ExpressionNode): void => {
      if (!this.lowered.has(name)) return;
      const m = this.foreignMember(rhs);
      if (!m) return;
      const base = (rhs as FieldAccessNode).expression as FunctionCallNode;
      const addr = base.parameters[0];
      if (addr instanceof IdentifierNode && deployLocals.has(addr.name)) {
        out.set(name, { local: addr.name, method: m.method });
      }
    };
    const walk2 = (n: Node): void => {
      if (n instanceof AssignNode) record(n.identifier.name, n.expression);
      else if (n instanceof StateAssignNode) record(n.name, n.expression);
      for (const key of Object.keys(n)) {
        const val = (n as unknown as Record<string, unknown>)[key];
        if (val instanceof Node) walk2(val);
        else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) walk2(v);
      }
    };
    walk2(fn.body!);
    return out;
  }

  // Rewrite `x = IFace(addr).method` (address stored) and `x(args)` (fixed-method external call).
  visitAssign(node: AssignNode): Node {
    const tgt = this.lowered.get(node.identifier.name);
    if (tgt) {
      const m = this.foreignMember(node.expression);
      if (m) node.expression = cloneNode((node.expression as FieldAccessNode).expression instanceof FunctionCallNode
        ? ((node.expression as FieldAccessNode).expression as FunctionCallNode).parameters[0] : node.expression) as ExpressionNode;
    }
    node.expression = this.visit(node.expression) as ExpressionNode;
    return node;
  }

  visitStateAssign(node: StateAssignNode): Node {
    const tgt = this.lowered.get(node.name);
    if (tgt && this.foreignMember(node.expression)) {
      node.expression = cloneNode(((node.expression as FieldAccessNode).expression as FunctionCallNode).parameters[0]) as ExpressionNode;
    }
    node.expression = this.visit(node.expression) as ExpressionNode;
    return node;
  }

  // A bare `x(args);` statement: the rewritten call is a MethodCall, so re-wrap the statement to match (the
  // FunctionCallStatement.call slot must not hold a MethodCall, or the external-call passes skip it).
  visitFunctionCallStatement(node: FunctionCallStatementNode): Node {
    const result = this.visit(node.call);
    if (result instanceof MethodCallNode) {
      const stmt = new MethodCallStatementNode(result);
      stmt.location = node.location;
      return stmt;
    }
    node.call = result as FunctionCallNode;
    return node;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    // Same-tx call on a pointer stored from a fresh deploy this function: `stored(args)` -> `o.method(args)`
    // (a NAMESPACED FunctionCall `o.method`, the exact form the deploy-fold recognizes). The store `stored = o`
    // still persists for later txs. Byte-equivalent to the state-address co-spend for an existing callee, but
    // lets the fold bake `o.method()` into o's deploy genesis (o cannot be co-spent in its own deploy tx).
    const fold = this.sameFnFold.get(node.identifier.name);
    if (fold) {
      const callId = new IdentifierNode(`${fold.local}.${fold.method}`); callId.location = node.location;
      const args = node.parameters.map((a) => this.visit(a) as ExpressionNode);
      const fc = new FunctionCallNode(callId, args); fc.location = node.location;
      fc.callOptions = node.callOptions;
      return fc;
    }
    const tgt = this.lowered.get(node.identifier.name);
    if (tgt) {
      // `x(args)` -> `IFace(x).method(args)`
      const ifaceId = new IdentifierNode(tgt.iface); ifaceId.location = node.location;
      const xRead = new IdentifierNode(node.identifier.name); xRead.location = node.location;
      const cast = new FunctionCallNode(ifaceId, [xRead]); cast.location = node.location;
      const args = node.parameters.map((a) => this.visit(a) as ExpressionNode);
      const mc = new MethodCallNode(cast, tgt.method, args); mc.location = node.location;
      mc.callOptions = node.callOptions;
      return mc;
    }
    return super.visitFunctionCall(node);
  }

  // `IFace(addr).method` where IFace is a known interface/contract name and the base is a single-arg cast.
  private foreignMember(expr: ExpressionNode): { iface: string; method: string } | undefined {
    if (!(expr instanceof FieldAccessNode)) return undefined;
    const base = expr.expression;
    if (!(base instanceof FunctionCallNode) || !(base.identifier instanceof IdentifierNode)) return undefined;
    if (base.parameters.length !== 1 || !this.typeNames.has(base.identifier.name)) return undefined;
    return { iface: base.identifier.name, method: expr.name };
  }

  // Invoke cb(rhs) for every assignment whose LHS is the bare name `varName` (AssignNode / StateAssignNode).
  private forEachAssignTo(node: Node, varName: string, cb: (rhs: ExpressionNode) => void): void {
    const walk = (n: Node): void => {
      if (n instanceof AssignNode && n.identifier.name === varName) cb(n.expression);
      else if (n instanceof StateAssignNode && n.name === varName) cb(n.expression);
      for (const key of Object.keys(n)) {
        const val = (n as unknown as Record<string, unknown>)[key];
        if (val instanceof Node) walk(val);
        else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) walk(v);
      }
    };
    walk(node);
  }
}
