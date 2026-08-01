import {
  Node,
  SourceFileNode,
  ContractNode,
  InterfaceNode,
  InterfaceFunctionNode,
  ParameterNode,
  StateVariableNode,
  FunctionDefinitionNode,
  AssignNode,
  StateAssignNode,
  BlockNode,
  StatementNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  MethodCallStatementNode,
  MethodCallNode,
  FieldAccessNode,
  IdentifierNode,
  ExpressionNode,
} from '../ast/AST.js';
import { FunctionType, AddressType, BytesType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/**
 * FOREIGN external function-pointer STATE VARIABLES that hold a RECEIVED value (`x = y`, not a fixed
 * `x = IFace(a).method`). The fixed-method case is lowered earlier (LowerForeignFunctionPointerVars, drops to a
 * plain `address`); what remains is the general case where the method is carried IN the value (a fn-ptr param, or
 * another fn-ptr state var), so the selector is not known syntactically at the call site.
 *
 * A `function(P) external returns(R) x;` is flattened to TWO state fields - an `address x` (the callee locking
 * bytecode) plus a companion `bytes4 __fnsel_x` (the runtime selector). A store copies both parts; a call
 * dispatches through the same synthesized `__FnPtr_N` interface + per-call master index the PARAM lowering uses
 * (slot.fnPtrCall), with the runtime selector sourced from the companion field. So `x(args)` reduces to the
 * audited state-address external call `__FnPtr_N(x).__call(args)` with a runtime selector - the proven co-spend.
 *
 * A foreign fn-ptr VALUE `v` (a lowered param `y` or a lowered state var `z`) exposes its (address, selector) as
 * (`v`, `__fnsel_v`) by convention (the PARAM lowering names the selector param `__fnsel_<param>`; this pass names
 * the companion field `__fnsel_<statevar>`). Runs AFTER LowerForeignFunctionPointerParams (so params are split)
 * and BEFORE SynthesizeExternalAddressLocals (which hoists `__FnPtr_N(x)` to the `__extaddr_` dispatch).
 */
export default class LowerForeignFunctionPointerStorage extends AstTraversal {
  private typeNames = new Set<string>();
  private synthIfaces: InterfaceNode[] = [];
  private counter = 0;
  // fn-ptr state var name -> its synth interface + companion selector field name
  private lowered = new Map<string, { iface: string; selVar: string }>();
  // companion selector assignments to append after the current statement (visitBlock drains this)
  private appends: StatementNode[] = [];
  private currentFn: FunctionDefinitionNode | undefined;

  visitSourceFile(node: SourceFileNode): Node {
    this.typeNames = new Set();
    this.synthIfaces = [];
    this.counter = 0;
    for (const iface of node.interfaceDefinitions as InterfaceNode[]) this.typeNames.add(iface.name);
    for (const c of node.importedContracts as ContractNode[]) this.typeNames.add(c.name);
    if (node.contract) this.typeNames.add(node.contract.name);
    if (node.contract) node.contract = this.visitContract(node.contract) as ContractNode;
    for (const iface of this.synthIfaces) node.interfaceDefinitions.push(iface);
    return node;
  }

  visitContract(node: ContractNode): Node {
    const fnPtrVars = node.stateVariables.filter(
      (sv) => sv.type instanceof FunctionType && (sv.type as FunctionType).isExternal,
    );
    if (fnPtrVars.length === 0) return node;

    const bodies = [node.constructorDef, ...node.functions, node.fallbackDef, node.receiveDef]
      .filter((f): f is FunctionDefinitionNode => !!f?.body);

    // Classify: a fn-ptr state var is FOREIGN-received (flatten) iff it has >=1 assignment and EVERY assignment
    // stores a foreign VALUE this pass can fully split (a lowered fn-ptr param / another foreign fn-ptr var). A
    // self-ref (functionId) assignment leaves it unclassified for the self-ref handling (behavior unchanged).
    const foreignVars = new Set<string>();
    for (const sv of fnPtrVars) {
      let ok = true;
      let hasAssign = false;
      for (const fn of bodies) {
        this.currentFn = fn;
        // The callback is invoked synchronously before this loop advances.
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        this.forEachAssignTo(fn.body!, sv.name, (rhs) => {
          hasAssign = true;
          if (!this.valueSources(rhs)) ok = false;
        });
      }
      this.currentFn = undefined;
      if (ok && hasAssign) foreignVars.add(sv.name);
    }
    if (foreignVars.size === 0) return node;

    this.lowered = new Map();
    for (const sv of fnPtrVars) {
      if (!foreignVars.has(sv.name)) continue;
      const iface = this.synthInterface(sv.type as FunctionType);
      this.lowered.set(sv.name, { iface, selVar: `__fnsel_${sv.name}` });
    }

    // Retype each fn-ptr var to `address` and inject its companion `bytes4 __fnsel_<name>` field right after it.
    const newStateVars: StateVariableNode[] = [];
    for (const sv of node.stateVariables) {
      const info = this.lowered.get(sv.name);
      if (info) {
        sv.type = new AddressType(false);
        newStateVars.push(sv);
        const sel = new StateVariableNode(new BytesType(4), info.selVar);
        sel.location = sv.location;
        newStateVars.push(sel);
      } else {
        newStateVars.push(sv);
      }
    }
    node.stateVariables = newStateVars;

    node.constructorDef = this.rewriteBody(node.constructorDef);
    node.functions = node.functions.map((f) => this.rewriteBody(f)!);
    node.fallbackDef = this.rewriteBody(node.fallbackDef);
    node.receiveDef = this.rewriteBody(node.receiveDef);
    return node;
  }

  private rewriteBody(fn: FunctionDefinitionNode | undefined): FunctionDefinitionNode | undefined {
    if (fn?.body) {
      this.currentFn = fn;
      fn.body = this.visit(fn.body) as typeof fn.body;
      this.currentFn = undefined;
    }
    return fn;
  }

  // Statement expansion: a fn-ptr store `x = rhs` also writes the companion `__fnsel_x = <selector>` (appended
  // after the store, so both fields land together).
  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const saved = this.appends;
      this.appends = [];
      const visited = this.visit(stmt) as StatementNode;
      out.push(visited, ...this.appends);
      this.appends = saved;
    }
    node.statements = out;
    return node;
  }

  visitAssign(node: AssignNode): Node {
    const info = this.lowered.get(node.identifier.name);
    if (info) {
      const src = this.valueSources(node.expression);
      if (src) {
        node.expression = src.addr;
        const selAssign = new AssignNode(this.id(info.selVar, node), src.sel);
        selAssign.location = node.location;
        this.appends.push(selAssign);
        return node;
      }
    }
    node.expression = this.visit(node.expression) as ExpressionNode;
    return node;
  }

  visitStateAssign(node: StateAssignNode): Node {
    const info = this.lowered.get(node.name);
    if (info) {
      const src = this.valueSources(node.expression);
      if (src) {
        node.expression = src.addr;
        const selAssign = new StateAssignNode(info.selVar, src.sel);
        selAssign.location = node.location;
        this.appends.push(selAssign);
        return node;
      }
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
    const info = this.lowered.get(node.identifier.name);
    if (info) {
      const ifaceId = new IdentifierNode(info.iface); ifaceId.location = node.location;
      const xRead = new IdentifierNode(node.identifier.name); xRead.location = node.location;
      const cast = new FunctionCallNode(ifaceId, [xRead]); cast.location = node.location;
      const args = node.parameters.map((a) => this.visit(a) as ExpressionNode);
      const mc = new MethodCallNode(cast, '__call', args); mc.location = node.location;
      const selRead = new IdentifierNode(info.selVar); selRead.location = node.location;
      mc.runtimeSelector = selRead;
      return mc;
    }
    return super.visitFunctionCall(node);
  }

  // The (address, selector) parts of a foreign fn-ptr VALUE assigned to a fn-ptr state var.
  private valueSources(rhs: ExpressionNode): { addr: ExpressionNode; sel: ExpressionNode } | undefined {
    // `IFace(a).method` -> not handled here: a var assigned ONLY fixed methods is lowered earlier. A MIXED var
    // (fixed + received) reaching this pass with a fixed-method assignment is not yet supported (needs the ABI
    // selector constant); leave it for the type checker to reject rather than miscompile.
    if (this.foreignMember(rhs)) return undefined;
    // `y` where a selector companion `__fnsel_y` exists (a lowered param or a lowered fn-ptr state var).
    if (rhs instanceof IdentifierNode && this.hasSelectorCompanion(rhs.name)) {
      const sel = new IdentifierNode(`__fnsel_${rhs.name}`); sel.location = rhs.location;
      return { addr: cloneNode(rhs) as ExpressionNode, sel };
    }
    return undefined;
  }

  // A name has a selector companion if it is a lowered fn-ptr state var, or a param `__fnsel_<name>` is in scope
  // (the PARAM lowering's convention for a foreign fn-ptr param).
  private hasSelectorCompanion(name: string): boolean {
    if (this.lowered.has(name)) return true;
    const fn = this.currentFn;
    return !!fn && fn.parameters.some((p) => p.name === `__fnsel_${name}`);
  }

  private foreignMember(expr: ExpressionNode): { iface: string; method: string } | undefined {
    if (!(expr instanceof FieldAccessNode)) return undefined;
    const base = expr.expression;
    if (!(base instanceof FunctionCallNode) || !(base.identifier instanceof IdentifierNode)) return undefined;
    if (base.parameters.length !== 1 || !this.typeNames.has(base.identifier.name)) return undefined;
    return { iface: base.identifier.name, method: expr.name };
  }

  private synthInterface(ft: FunctionType): string {
    const sig = ft.toString();
    const existing = this.synthIfaces.find((i) => (i as InterfaceNode & { __sig?: string }).__sig === sig);
    if (existing) return existing.name;
    // `_S` disambiguates from the PARAM lowering's `__FnPtr_<n>` while keeping the `__FnPtr_` prefix the
    // fnPtrCall gate (collectExternalCalls) matches.
    const name = `__FnPtr_S${this.counter++}`;
    const params = ft.parameterTypes.map((t, i) => new ParameterNode(t, `p${i}`));
    const method = new InterfaceFunctionNode('__call', params, ft.returnTypes);
    const iface = new InterfaceNode(name, [], [], [method]);
    (iface as InterfaceNode & { __sig?: string }).__sig = sig;
    this.synthIfaces.push(iface);
    return name;
  }

  private id(name: string, at: Node): IdentifierNode {
    const n = new IdentifierNode(name); n.location = at.location; return n;
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
