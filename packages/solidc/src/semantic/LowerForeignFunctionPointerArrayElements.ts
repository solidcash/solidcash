import {
  Node,
  SourceFileNode,
  ContractNode,
  InterfaceNode,
  StateVariableNode,
  FunctionDefinitionNode,
  StateArrayPushNode,
  ArrayPushNode,
  IndirectCallNode,
  ArrayAccessNode,
  MethodCallNode,
  FunctionCallNode,
  FieldAccessNode,
  IdentifierNode,
  ExpressionNode,
} from '../ast/AST.js';
import { ArrayType, FunctionType, AddressType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/**
 * FOREIGN external function-pointer ARRAY ELEMENTS that hold a fixed method on a runtime address (a dispatch
 * table of callbacks). A `function(P) external[] fns;` whose every pushed value is `IFace(a).method` (same
 * interface + method, varying address) lowers to an interface-typed array + the shipped array-element external
 * call:
 *
 *   function(pubkey,sig) external[] fns;                  IFace[] fns;
 *   fns.push(IFace(a).m);                          ->     fns.push(IFace(a));
 *   fns[i](args)                                          fns[i].m(args)      // shipped IFace(arr[i]).m() loop
 *
 * so it reduces to the already-shipped array-element co-spend loop (loopArrayVar). Sound by reduction. Lowered
 * only when every push of a given array is a consistent (interface, method); a received value / varying method
 * stays unclassified for the general blob case (future). v1: state-array collections, push-built tables.
 *
 * Semantics: like the shipped `IFace(arr[i]).m()`, the array call BROADCASTS - the covenant co-spends + verifies
 * + calls the method on EVERY element (a single `fns[i](args)` is enough; no explicit `for` loop needed, and an
 * explicit loop around the call is redundant + currently rejected by codegen - fails closed, never miscompiles).
 */
export default class LowerForeignFunctionPointerArrayElements extends AstTraversal {
  private typeNames = new Set<string>();
  // fn-ptr array collection name -> its fixed (interface, method)
  private lowered = new Map<string, { iface: string; method: string }>();

  visitSourceFile(node: SourceFileNode): Node {
    this.typeNames = new Set();
    for (const iface of node.interfaceDefinitions as InterfaceNode[]) this.typeNames.add(iface.name);
    for (const c of node.importedContracts as ContractNode[]) this.typeNames.add(c.name);
    if (node.contract) this.typeNames.add(node.contract.name);
    if (node.contract) node.contract = this.visitContract(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    const fnPtrArrays = node.collections.filter(
      (c) => c.type instanceof ArrayType && (c.type.elementType instanceof FunctionType)
        && (c.type.elementType as FunctionType).isExternal,
    );
    if (fnPtrArrays.length === 0) return node;

    const bodies = [node.constructorDef, ...node.functions, node.fallbackDef, node.receiveDef]
      .filter((f): f is FunctionDefinitionNode => !!f?.body);

    // Classify each array: every pushed value must be a consistent `IFace(a).method`.
    this.lowered = new Map();
    for (const coll of fnPtrArrays) {
      let target: { iface: string; method: string } | undefined;
      let ok = true;
      let hasPush = false;
      for (const fn of bodies) {
        this.forEachPushTo(fn.body!, coll.name, (val) => {
          hasPush = true;
          const m = this.foreignMember(val);
          if (!m) { ok = false; return; }
          if (!target) target = m;
          else if (target.iface !== m.iface || target.method !== m.method) ok = false;
        });
      }
      if (ok && hasPush && target) this.lowered.set(coll.name, target);
    }
    if (this.lowered.size === 0) return node;

    // A plain-`address[]` array is registered as a dynamic-array STATE VARIABLE (not a collection), so MOVE each
    // classified fn-ptr array out of collections into a plain `address[]` state var + call through the explicit
    // `IFace(fns[i]).m(..)` cast - the exact shape the shipped array-element co-spend loop handles.
    for (const coll of fnPtrArrays) {
      const t = this.lowered.get(coll.name);
      if (!t || !(coll.type instanceof ArrayType)) continue;
      const sv = new StateVariableNode(new ArrayType(new AddressType(false), coll.type.bound), coll.name);
      sv.isDynamic = true;
      sv.visibility = coll.visibility;
      sv.location = coll.location;
      node.stateVariables.push(sv);
    }
    node.collections = node.collections.filter((c) => !this.lowered.has(c.name));

    node.constructorDef = this.rewrite(node.constructorDef);
    node.functions = node.functions.map((f) => this.rewrite(f)!);
    node.fallbackDef = this.rewrite(node.fallbackDef);
    node.receiveDef = this.rewrite(node.receiveDef);
    return node;
  }

  private rewrite(fn: FunctionDefinitionNode | undefined): FunctionDefinitionNode | undefined {
    if (fn?.body) fn.body = this.visit(fn.body) as typeof fn.body;
    return fn;
  }

  // `fns.push(IFace(a).m)` -> `fns.push(a)` (plain address element).
  visitStateArrayPush(node: StateArrayPushNode): Node {
    if (this.lowered.has(node.name) && this.foreignMember(node.value)) {
      node.value = this.addressOf(node.value); return node;
    }
    return super.visitStateArrayPush(node);
  }

  visitArrayPush(node: ArrayPushNode): Node {
    if (this.lowered.has(node.name) && this.foreignMember(node.value)) {
      node.value = this.addressOf(node.value); return node;
    }
    return super.visitArrayPush(node);
  }

  // The address arg `a` of a `IFace(a).method` foreignMember.
  private addressOf(fm: ExpressionNode): ExpressionNode {
    return cloneNode(((fm as FieldAccessNode).expression as FunctionCallNode).parameters[0]) as ExpressionNode;
  }

  // `fns[i](args)` -> `IFace(fns[i]).m(args)` (the shipped array-element co-spend loop shape).
  visitIndirectCall(node: IndirectCallNode): Node {
    const callee = node.callee;
    if (callee instanceof ArrayAccessNode && callee.array instanceof IdentifierNode) {
      const t = this.lowered.get(callee.array.name);
      if (t) {
        const elem = this.visit(callee) as ExpressionNode;
        const ifaceId = new IdentifierNode(t.iface); ifaceId.location = node.location;
        const cast = new FunctionCallNode(ifaceId, [elem]); cast.location = node.location;
        const args = node.parameters.map((a) => this.visit(a) as ExpressionNode);
        const mc = new MethodCallNode(cast, t.method, args); mc.location = node.location;
        return mc;
      }
    }
    return super.visitIndirectCall(node);
  }

  private foreignMember(expr: ExpressionNode): { iface: string; method: string } | undefined {
    if (!(expr instanceof FieldAccessNode)) return undefined;
    const base = expr.expression;
    if (!(base instanceof FunctionCallNode) || !(base.identifier instanceof IdentifierNode)) return undefined;
    if (base.parameters.length !== 1 || !this.typeNames.has(base.identifier.name)) return undefined;
    return { iface: base.identifier.name, method: expr.name };
  }

  // Invoke cb(value) for every push (`this.arr.push(v)` / `arr.push(v)`) whose target is `arrName`.
  private forEachPushTo(node: Node, arrName: string, cb: (val: ExpressionNode) => void): void {
    const walk = (n: Node): void => {
      if (n instanceof StateArrayPushNode && n.name === arrName && !n.noArg) cb(n.value);
      else if (n instanceof ArrayPushNode && n.name === arrName && !n.noArg) cb(n.value);
      for (const key of Object.keys(n)) {
        const val = (n as unknown as Record<string, unknown>)[key];
        if (val instanceof Node) walk(val);
        else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) walk(v);
      }
    };
    walk(node);
  }
}
