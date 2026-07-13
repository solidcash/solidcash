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
  BlockNode,
  CastNode,
  StatementNode,
} from '../ast/AST.js';
import { ArrayType, FunctionType, AddressType, BytesType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

const SELECTOR_ARRAY_PREFIX = '__fnsel_';

type ArrayClassification = { kind: 'fixed' | 'varying' | 'none'; iface: string; method: string };

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
  // varying-method dispatch table: array name -> its (interface, an-arbitrary method for the ABI shape). Every
  // push is a same-interface `IFace(a).m` but the methods DIFFER, so each element carries its own selector in a
  // parallel `bytes4[]` selector array and the co-spend loop verifies the per-element selector.
  private varying = new Map<string, { iface: string; method: string }>();

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

    // Classify each array: every pushed value must be a same-interface `IFace(a).method`. If every push also uses
    // the SAME method it is a fixed-method table (`lowered`); if methods DIFFER it is a varying-method table
    // (`varying`) that additionally gets a parallel `bytes[]` selector array.
    this.lowered = new Map();
    this.varying = new Map();
    for (const coll of fnPtrArrays) {
      const c = this.classifyArray(coll.name, bodies);
      if (c.kind === 'fixed') this.lowered.set(coll.name, { iface: c.iface, method: c.method });
      else if (c.kind === 'varying') this.varying.set(coll.name, { iface: c.iface, method: c.method });
    }
    if (this.lowered.size === 0 && this.varying.size === 0) return node;

    // A plain-`address[]` array is registered as a dynamic-array STATE VARIABLE (not a collection), so MOVE each
    // classified fn-ptr array out of collections into a plain `address[]` state var + call through the explicit
    // `IFace(fns[i]).m(..)` cast - the exact shape the shipped array-element co-spend loop handles. A
    // varying-method table also gets a parallel `bytes4[]` selector array `__fnsel_<name>`.
    for (const coll of fnPtrArrays) {
      const isFixed = this.lowered.has(coll.name);
      const isVarying = this.varying.has(coll.name);
      if ((!isFixed && !isVarying) || !(coll.type instanceof ArrayType)) continue;
      const sv = new StateVariableNode(new ArrayType(new AddressType(false), coll.type.bound), coll.name);
      sv.isDynamic = true;
      sv.visibility = coll.visibility;
      sv.location = coll.location;
      node.stateVariables.push(sv);
      if (isVarying) {
        // A `bytes[]` (framed, variable-width) selector array so each element decodes with the SAME framed
        // pushdata read as the parallel address element (uniform loop decode, no packed-width assumption).
        const selSv = new StateVariableNode(new ArrayType(new BytesType(), coll.type.bound), this.selArrayName(coll.name));
        selSv.isDynamic = true;
        selSv.location = coll.location;
        node.stateVariables.push(selSv);
      }
    }
    node.collections = node.collections.filter((c) => !this.lowered.has(c.name) && !this.varying.has(c.name));

    node.constructorDef = this.rewrite(node.constructorDef);
    node.functions = node.functions.map((f) => this.rewrite(f)!);
    node.fallbackDef = this.rewrite(node.fallbackDef);
    node.receiveDef = this.rewrite(node.receiveDef);
    return node;
  }

  // Classify a fn-ptr array by its pushes: 'fixed' (all same `IFace(a).m`), 'varying' (same interface, differing
  // methods), or 'none' (no pushes, mixed interfaces, or a non-`IFace(a).m` value). `method` is an arbitrary
  // pushed method (the ABI-shape placeholder for a varying table).
  private classifyArray(name: string, bodies: FunctionDefinitionNode[]): ArrayClassification {
    const pushed: Array<{ iface: string; method: string } | undefined> = [];
    for (const fn of bodies) this.forEachPushTo(fn.body!, name, (val) => pushed.push(this.foreignMember(val)));
    if (pushed.length === 0 || pushed.some((p) => !p)) return { kind: 'none', iface: '', method: '' };
    const members = pushed as { iface: string; method: string }[];
    const { iface, method } = members[0];
    if (members.some((p) => p.iface !== iface)) return { kind: 'none', iface: '', method: '' };
    const varying = members.some((p) => p.method !== method);
    return { kind: varying ? 'varying' : 'fixed', iface, method };
  }

  private rewrite(fn: FunctionDefinitionNode | undefined): FunctionDefinitionNode | undefined {
    if (fn?.body) fn.body = this.visit(fn.body) as typeof fn.body;
    return fn;
  }

  // `fns.push(IFace(a).m)` -> `fns.push(a)` (fixed table) or, for a varying table, a block that ALSO pushes the
  // method selector into the parallel selector array: `{ fns.push(a); __fnsel_fns.push(bytes4(IFace.m.selector)); }`.
  visitStateArrayPush(node: StateArrayPushNode): Node {
    const fm = this.foreignMember(node.value);
    if (this.lowered.has(node.name) && fm) { node.value = this.addressOf(node.value); return node; }
    if (this.varying.has(node.name) && fm) {
      const addrPush = this.copyLoc(new StateArrayPushNode(node.name, this.addressOf(node.value)), node);
      const selPush = this.copyLoc(new StateArrayPushNode(this.selArrayName(node.name), this.selectorExpr(fm, node)), node);
      return this.twoStatementBlock(addrPush, selPush, node);
    }
    return super.visitStateArrayPush(node);
  }

  visitArrayPush(node: ArrayPushNode): Node {
    const fm = this.foreignMember(node.value);
    if (this.lowered.has(node.name) && fm) { node.value = this.addressOf(node.value); return node; }
    if (this.varying.has(node.name) && fm) {
      const addrPush = this.copyLoc(new ArrayPushNode(node.name, this.addressOf(node.value)), node);
      const selPush = this.copyLoc(new ArrayPushNode(this.selArrayName(node.name), this.selectorExpr(fm, node)), node);
      return this.twoStatementBlock(addrPush, selPush, node);
    }
    return super.visitArrayPush(node);
  }

  private selArrayName(name: string): string { return `${SELECTOR_ARRAY_PREFIX}${name}`; }

  private copyLoc<T extends Node>(to: T, from: Node): T { to.location = from.location; return to; }

  private twoStatementBlock(a: StatementNode, b: StatementNode, at: Node): BlockNode {
    const block = new BlockNode([a, b]); block.location = at.location; return block;
  }

  // `bytes(IFace.method.selector)` for the parallel selector array element (framed `bytes[]` element).
  private selectorExpr(fm: { iface: string; method: string }, at: Node): ExpressionNode {
    const ifaceId = new IdentifierNode(fm.iface); ifaceId.location = at.location;
    const methodAccess = new FieldAccessNode(ifaceId, fm.method); methodAccess.location = at.location;
    const selector = new FieldAccessNode(methodAccess, 'selector'); selector.location = at.location;
    const bounded = new CastNode(new BytesType(), selector, false); bounded.location = at.location;
    return bounded;
  }

  // The address arg `a` of a `IFace(a).method` foreignMember.
  private addressOf(fm: ExpressionNode): ExpressionNode {
    return cloneNode(((fm as FieldAccessNode).expression as FunctionCallNode).parameters[0]) as ExpressionNode;
  }

  // `fns[i](args)` -> `IFace(fns[i]).m(args)` (the shipped array-element co-spend loop shape). For a varying
  // table the method is an arbitrary same-signature placeholder and the call carries selectorArrayVar so the
  // loop verifies each co-spent callee against its own on-chain selector instead of a single broadcast method.
  visitIndirectCall(node: IndirectCallNode): Node {
    const callee = node.callee;
    if (callee instanceof ArrayAccessNode && callee.array instanceof IdentifierNode) {
      const t = this.lowered.get(callee.array.name) ?? this.varying.get(callee.array.name);
      if (t) {
        const elem = this.visit(callee) as ExpressionNode;
        const ifaceId = new IdentifierNode(t.iface); ifaceId.location = node.location;
        const cast = new FunctionCallNode(ifaceId, [elem]); cast.location = node.location;
        const args = node.parameters.map((a) => this.visit(a) as ExpressionNode);
        const mc = new MethodCallNode(cast, t.method, args); mc.location = node.location;
        if (this.varying.has(callee.array.name)) mc.selectorArrayVar = this.selArrayName(callee.array.name);
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
