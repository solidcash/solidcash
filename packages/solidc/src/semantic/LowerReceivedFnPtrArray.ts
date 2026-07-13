import {
  Node,
  SourceFileNode,
  ContractNode,
  InterfaceNode,
  InterfaceFunctionNode,
  ParameterNode,
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

/**
 * FOREIGN external function-pointer ARRAYS that hold RECEIVED values (`fns.push(p)` where `p` is a fn-ptr param
 * carrying its method IN the value), NOT inline `fns.push(IFace(a).m)` (which is lowered earlier by
 * LowerForeignFunctionPointerArrayElements). It is the array analogue of LowerForeignFunctionPointerStorage's
 * single received-value state var, and reuses that (address, selector) convention: a lowered fn-ptr value `p`
 * exposes its parts as (`p`, `__fnsel_p`).
 *
 * A `function(P) external[] fns;` is flattened to `address[] fns` (co-spend targets) + a parallel `bytes[]
 * __fnsel_fns` selector array. Each `fns.push(p)` becomes `{ fns.push(p); __fnsel_fns.push(bytes(__fnsel_p)); }`,
 * and `fns[i](args)` becomes the array-element co-spend loop `__FnPtr_A(fns[i]).__call(args)` tagged with
 * selectorArrayVar - the SAME covenant + SDK path as an inline varying-method dispatch table, but the per-element
 * selector is carried by the received value instead of a compile-time `IFace.m.selector`. Because the callee
 * layout is unknown for a received pointer (fnPtrCall), the loop reads each callee's master input index from the
 * SDK-filled `__internal__extcallIdxList` witness (identity-verified per element). Runs AFTER the param lowering
 * (so a received fn-ptr param is already split into address + `__fnsel_`).
 */
const SELECTOR_ARRAY_PREFIX = '__fnsel_';

export default class LowerReceivedFnPtrArray extends AstTraversal {
  private typeNames = new Set<string>();
  private synthIfaces: InterfaceNode[] = [];
  private counter = 0;
  // received-value fn-ptr array name -> its synth interface (for the `__FnPtr_A(fns[i]).__call` dispatch).
  private lowered = new Map<string, string>();
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
    const fnPtrArrays = node.collections.filter(
      (c) => c.type instanceof ArrayType && (c.type.elementType instanceof FunctionType)
        && (c.type.elementType as FunctionType).isExternal,
    );
    if (fnPtrArrays.length === 0) return node;

    const bodies = [node.constructorDef, ...node.functions, node.fallbackDef, node.receiveDef]
      .filter((f): f is FunctionDefinitionNode => !!f?.body);

    // Classify: a received-value array iff it has >=1 push and EVERY push is a fn-ptr VALUE with a selector
    // companion (a lowered param). An inline `IFace(a).m` push is handled earlier, not here.
    this.lowered = new Map();
    for (const coll of fnPtrArrays) {
      if (coll.type instanceof ArrayType && this.isReceivedValueArray(coll.name, bodies)) {
        this.lowered.set(coll.name, this.synthInterface(coll.type.elementType as FunctionType));
      }
    }
    if (this.lowered.size === 0) return node;

    // Retype each classified array to `address[]` + inject a parallel `bytes[] __fnsel_<name>` selector array.
    for (const coll of fnPtrArrays) {
      if (!this.lowered.has(coll.name) || !(coll.type instanceof ArrayType)) continue;
      const sv = new StateVariableNode(new ArrayType(new AddressType(false), coll.type.bound), coll.name);
      sv.isDynamic = true;
      sv.visibility = coll.visibility;
      sv.location = coll.location;
      node.stateVariables.push(sv);
      const selSv = new StateVariableNode(new ArrayType(new BytesType(), coll.type.bound), this.selArrayName(coll.name));
      selSv.isDynamic = true;
      selSv.location = coll.location;
      node.stateVariables.push(selSv);
    }
    node.collections = node.collections.filter((c) => !this.lowered.has(c.name));

    node.constructorDef = this.rewrite(node.constructorDef);
    node.functions = node.functions.map((f) => this.rewrite(f)!);
    node.fallbackDef = this.rewrite(node.fallbackDef);
    node.receiveDef = this.rewrite(node.receiveDef);
    return node;
  }

  private rewrite(fn: FunctionDefinitionNode | undefined): FunctionDefinitionNode | undefined {
    if (fn?.body) {
      this.currentFn = fn;
      fn.body = this.visit(fn.body) as typeof fn.body;
      this.currentFn = undefined;
    }
    return fn;
  }

  // `fns.push(p)` -> `{ fns.push(p); __fnsel_fns.push(bytes(__fnsel_p)); }` (the received value's parts).
  visitStateArrayPush(node: StateArrayPushNode): Node {
    if (this.lowered.has(node.name)) {
      const sel = this.selectorOf(node.value);
      if (sel) {
        const addrPush = this.copyLoc(new StateArrayPushNode(node.name, node.value), node);
        const selPush = this.copyLoc(new StateArrayPushNode(this.selArrayName(node.name), sel), node);
        return this.twoStatementBlock(addrPush, selPush, node);
      }
    }
    return super.visitStateArrayPush(node);
  }

  visitArrayPush(node: ArrayPushNode): Node {
    if (this.lowered.has(node.name)) {
      const sel = this.selectorOf(node.value);
      if (sel) {
        const addrPush = this.copyLoc(new ArrayPushNode(node.name, node.value), node);
        const selPush = this.copyLoc(new ArrayPushNode(this.selArrayName(node.name), sel), node);
        return this.twoStatementBlock(addrPush, selPush, node);
      }
    }
    return super.visitArrayPush(node);
  }

  // `fns[i](args)` -> `__FnPtr_A(fns[i]).__call(args)` tagged with selectorArrayVar (per-element on-chain selector).
  visitIndirectCall(node: IndirectCallNode): Node {
    const callee = node.callee;
    if (callee instanceof ArrayAccessNode && callee.array instanceof IdentifierNode) {
      const iface = this.lowered.get(callee.array.name);
      if (iface) {
        const elem = this.visit(callee) as ExpressionNode;
        const ifaceId = new IdentifierNode(iface); ifaceId.location = node.location;
        const cast = new FunctionCallNode(ifaceId, [elem]); cast.location = node.location;
        const args = node.parameters.map((a) => this.visit(a) as ExpressionNode);
        const mc = new MethodCallNode(cast, '__call', args); mc.location = node.location;
        mc.selectorArrayVar = this.selArrayName(callee.array.name);
        return mc;
      }
    }
    return super.visitIndirectCall(node);
  }

  private selArrayName(name: string): string { return `${SELECTOR_ARRAY_PREFIX}${name}`; }

  private copyLoc<T extends Node>(to: T, from: Node): T { to.location = from.location; return to; }

  private twoStatementBlock(a: StatementNode, b: StatementNode, at: Node): BlockNode {
    const block = new BlockNode([a, b]); block.location = at.location; return block;
  }

  // The selector companion `bytes(__fnsel_p)` of a received fn-ptr value `p`, else undefined.
  private selectorOf(value: ExpressionNode): ExpressionNode | undefined {
    if (!(value instanceof IdentifierNode) || !this.hasSelectorCompanion(value.name)) return undefined;
    const sel = new IdentifierNode(`${SELECTOR_ARRAY_PREFIX}${value.name}`); sel.location = value.location;
    const bounded = new CastNode(new BytesType(), sel, false); bounded.location = value.location;
    return bounded;
  }

  private isReceivedValueArray(name: string, bodies: FunctionDefinitionNode[]): boolean {
    const ok: boolean[] = [];
    for (const fn of bodies) {
      this.currentFn = fn;
      this.forEachPushTo(fn.body!, name, (val) => ok.push(!this.foreignMember(val) && !!this.selectorOf(val)));
    }
    this.currentFn = undefined;
    return ok.length > 0 && ok.every(Boolean);
  }

  // A name has a selector companion if a param `__fnsel_<name>` is in scope (the param lowering's convention).
  private hasSelectorCompanion(name: string): boolean {
    const fn = this.currentFn;
    return !!fn && fn.parameters.some((p) => p.name === `${SELECTOR_ARRAY_PREFIX}${name}`);
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
    // `_A` keeps the `__FnPtr_` prefix the fnPtrCall gate matches, disambiguated from the param/storage forms.
    const iname = `__FnPtr_A${this.counter++}`;
    const params = ft.parameterTypes.map((t, i) => new ParameterNode(t, `p${i}`));
    const method = new InterfaceFunctionNode('__call', params, ft.returnTypes);
    const iface = new InterfaceNode(iname, [], [], [method]);
    (iface as InterfaceNode & { __sig?: string }).__sig = sig;
    this.synthIfaces.push(iface);
    return iname;
  }

  private forEachPushTo(node: Node, name: string, cb: (val: ExpressionNode) => void): void {
    const walk = (n: Node): void => {
      if (n instanceof StateArrayPushNode && n.name === name && !n.noArg) cb(n.value);
      else if (n instanceof ArrayPushNode && n.name === name && !n.noArg) cb(n.value);
      for (const key of Object.keys(n)) {
        const val = (n as unknown as Record<string, unknown>)[key];
        if (val instanceof Node) walk(val);
        else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) walk(v);
      }
    };
    walk(node);
  }
}
