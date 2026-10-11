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
  StateArrayPopNode,
  ArrayPopNode,
  StateArrayAssignNode,
  ArrayAssignNode,
  StateArrayDeleteNode,
  ArrayDeleteNode,
  IndirectCallNode,
  ArrayAccessNode,
  MappingAccessNode,
  MappingAssignNode,
  MappingDeleteNode,
  MethodCallStatementNode,
  ExpressionStatementNode,
  MethodCallNode,
  FunctionCallNode,
  FieldAccessNode,
  IdentifierNode,
  IntLiteralNode,
  VariableDefinitionNode,
  ExpressionNode,
  BlockNode,
  CastNode,
  StatementNode,
  WhileNode,
  DoWhileNode,
  AssignNode,
  BinaryOpNode,
  AssignmentExpressionNode,
  StateAssignNode,
  StateAccessNode,
} from '../ast/AST.js';
import { ArrayType, FunctionType, AddressType, BytesType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { BinaryOperator } from '../ast/Operator.js';
import { FnPtrArrayLoweringError } from '../Errors.js';

const SELECTOR_ARRAY_PREFIX = '__fnsel_';

const NEVER_WRITTEN = 'it is never written in contract code, so its element selectors cannot be established; push or '
  + 'assign IFace(addr).method or received function-pointer values';
const UNSUPPORTED_VALUE = 'an unsupported value is written to it; each pushed/assigned value must be IFace(addr).method '
  + 'or a function-pointer param / state variable carrying its selector';
const UNSUPPORTED_COPY = 'a whole-array value assigned to it carries no element selectors; only a copy of another '
  + 'storage function-pointer array of the same function type and length is supported';
const LENGTH_ONLY = 'a push, pop or whole delete of it is kept only as a length change, so its copied elements '
  + 'would not follow';
const DROPPED_PUSH = 'a push onto it is kept only as a length change and its pushed value would be dropped';

/**
 * FOREIGN external function-pointer ARRAYS holding RECEIVED values (`fns.push(p)` where `p` is a fn-ptr param
 * or a lowered fn-ptr state var, method carried IN the value) - and MIXED tables where inline `IFace(a).m`
 * writes coexist with received ones. The all-inline case is claimed earlier by
 * LowerForeignFunctionPointerArrayElements; whatever fn-ptr array remains UNCLASSIFIABLE after this pass gets a
 * specific FnPtrArrayLoweringError instead of the misleading downstream "Undefined state variable".
 *
 * Lowering: `address[] fns` + a parallel `bytes[] __fnsel_<name>` selector array; every write records the
 * value's selector - `bytes(__fnsel_p)` for a received value (the (address, selector) convention shared with
 * the param/storage passes), `bytes(IFace.m.selector)` for an inline one. Calls dispatch through a synthesized
 * `__FnPtr_A<n>` interface (fnPtrCall):
 * - `fns[idx](args)` OUTSIDE a loop calls ONLY element idx (Solidity semantics): hoists the element address +
 *   its bytes4 selector into locals and emits ONE computed-receiver call with a runtime selector and an
 *   SDK-filled witness master index. Value-returning calls work here.
 * - `fns[i](args)` INSIDE a loop is the notify-all idiom -> the BROADCAST covenant (selectorArrayVar + the
 *   `__internal__extcallIdxList` witness); the source loop is harmless iteration and a broadcast cannot return
 *   a value (rejected).
 * Mutations (element assign / pop / delete) rewrite to lockstep two-statement blocks on both arrays.
 * A whole copy `b = a` between tables of this pass copies the selector array (and an unbounded table's `$len`
 * length authority) with it, so `b` holds exactly `a`'s targets. A table with no write at all holds none: it
 * lowers as an empty table whose element reads, and so calls, revert.
 * Runs AFTER the param + storage lowerings (so received values already expose `__fnsel_<name>` companions).
 */
export default class LowerReceivedFnPtrArray extends AstTraversal {
  private typeNames = new Set<string>();
  private stateVarNames = new Set<string>();
  private synthIfaces: InterfaceNode[] = [];
  private counter = 0;
  private hoistCounter = 0;
  private hoists: StatementNode[] = [];
  private loopDepth = 0;
  // received/mixed fn-ptr array name -> its synth interface + whether the fn type returns values.
  private lowered = new Map<string, { iface: string; returns: boolean }>();
  private currentFn: FunctionDefinitionNode | undefined;
  // Every fn-ptr array this pass classifies, by name (copy sources must be among them).
  private tables = new Map<string, ArrayType>();
  private localNames = new WeakMap<FunctionDefinitionNode, Set<string>>();

  /**
   * `graphMode` only affects a broadcast (in-loop) receiver: a message-bus graph handler reconstructs one
   * authoritative row per reached iteration and needs the live element plus its live selector, while the
   * ordinary broadcast covenant verifies the whole table in its epilogue and must stay index-independent.
   */
  constructor(private readonly graphMode = false) {
    super();
  }

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

    this.stateVarNames = new Set(node.stateVariables.map((sv) => sv.name));
    const bodies = [node.constructorDef, ...node.functions, node.fallbackDef, node.receiveDef]
      .filter((f): f is FunctionDefinitionNode => !!f?.body);

    // Classify: every write (push or element assign) must be a RECOGNIZED fn-ptr value - a received value with
    // a `__fnsel_` companion (param or lowered state var) or an inline `IFace(a).m` - and every whole-array
    // assignment must copy another table of this pass. Anything else is unclassifiable and gets a specific error
    // below (fail closed with a reason, not "Undefined state variable").
    this.lowered = new Map();
    this.tables = new Map();
    for (const coll of fnPtrArrays) if (coll.type instanceof ArrayType) this.tables.set(coll.name, coll.type);
    const refusals = new Map<string, string>();
    const copied = new Map<string, Set<string>>();
    for (const coll of fnPtrArrays) {
      if (!(coll.type instanceof ArrayType)) continue;
      const writes = this.collectWrites(coll.name, bodies);
      if (writes.some((w) => !w.recognized)) {
        refusals.set(coll.name, UNSUPPORTED_VALUE);
        continue;
      }
      const sources = this.collectCopies(coll.name, bodies);
      // The parser keeps only the `<name>$len` bump of a push onto an unbounded collection array, not its value,
      // so a table written only by pushes looks unwritten here: refuse it rather than drop those elements.
      if (writes.length === 0 && this.writesLengthAuthority(coll.name, bodies)) {
        refusals.set(coll.name, sources.length === 0 ? NEVER_WRITTEN : LENGTH_ONLY);
        continue;
      }
      // The same holds beside element writes: a push's value is never stored, only its length bump.
      if (this.incrementsLengthAuthority(coll.name, bodies)) {
        refusals.set(coll.name, DROPPED_PUSH);
        continue;
      }
      if (sources.some((s) => s === undefined)) {
        refusals.set(coll.name, UNSUPPORTED_COPY);
        continue;
      }
      copied.set(coll.name, new Set(sources as string[]));
    }
    // A copy holds its source's targets, so a table copying a refused table is refused too.
    for (let changed = true; changed;) {
      changed = false;
      for (const [name, sources] of copied) {
        const refused = [...sources].find((s) => refusals.has(s));
        if (refused === undefined || refusals.has(name)) continue;
        refusals.set(name, `it copies '${refused}', whose element selectors cannot be established`);
        changed = true;
      }
    }
    for (const coll of fnPtrArrays) {
      if (!(coll.type instanceof ArrayType)) continue;
      const refusal = refusals.get(coll.name);
      if (refusal) throw new FnPtrArrayLoweringError(coll, coll.name, refusal);
      const ft = coll.type.elementType as FunctionType;
      this.lowered.set(coll.name, {
        iface: this.synthInterface(ft), returns: (ft.returnTypes ?? []).length > 0,
      });
    }

    // Retype each classified array to `address[]` + inject the parallel `bytes[]` selector array.
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

  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const saved = this.hoists;
      this.hoists = [];
      const visited = this.visit(stmt) as StatementNode;
      out.push(...this.hoists, visited);
      this.hoists = saved;
    }
    node.statements = out;
    return node;
  }

  // A rewritten indirect call is an external MethodCall; its STATEMENT must be a MethodCallStatement (the
  // canonical external-call statement form) - inside a bare ExpressionStatement the generic expression path
  // would evaluate the receiver and consume the hoisted element local before the epilogue reads it.
  visitExpressionStatement(node: ExpressionStatementNode): Node {
    const result = this.visit(node.expression);
    if (result instanceof MethodCallNode) {
      const stmt = new MethodCallStatementNode(result);
      stmt.location = node.location;
      return stmt;
    }
    node.expression = result as ExpressionNode;
    return node;
  }

  visitWhile(node: WhileNode): Node {
    this.loopDepth += 1;
    const r = super.visitWhile(node);
    this.loopDepth -= 1;
    return r;
  }

  visitDoWhile(node: DoWhileNode): Node {
    this.loopDepth += 1;
    const r = super.visitDoWhile(node);
    this.loopDepth -= 1;
    return r;
  }

  // `fns.push(v)` -> `{ fns.push(<addr>); __fnsel_fns.push(<selector>); }` for either write kind.
  visitStateArrayPush(node: StateArrayPushNode): Node {
    return this.rewritePush(node.name, node.value, node) ?? super.visitStateArrayPush(node);
  }

  visitArrayPush(node: ArrayPushNode): Node {
    return this.rewritePush(node.name, node.value, node) ?? super.visitArrayPush(node);
  }

  private rewritePush(name: string, value: ExpressionNode, at: Node): Node | undefined {
    if (!this.lowered.has(name)) return undefined;
    const parts = this.valueParts(value);
    if (!parts) return undefined;
    const addrPush = this.copyLoc(new StateArrayPushNode(name, parts.addr), at);
    const selPush = this.copyLoc(new StateArrayPushNode(this.selArrayName(name), parts.sel), at);
    return this.twoStatementBlock(addrPush, selPush, at);
  }

  visitStateArrayAssign(node: StateArrayAssignNode): Node {
    return this.rewriteAssign(node.name, node.index, node.value, node) ?? super.visitStateArrayAssign(node);
  }

  visitArrayAssign(node: ArrayAssignNode): Node {
    return this.rewriteAssign(node.name, node.index, node.value, node) ?? super.visitArrayAssign(node);
  }

  private rewriteAssign(name: string, index: ExpressionNode, value: ExpressionNode, at: Node): Node | undefined {
    if (!this.lowered.has(name)) return undefined;
    const parts = this.valueParts(value);
    if (!parts) return undefined;
    const idx = this.visit(index) as ExpressionNode;
    const addrAssign = this.copyLoc(new StateArrayAssignNode(name, idx, parts.addr), at);
    const selAssign = this.copyLoc(new StateArrayAssignNode(
      this.selArrayName(name), cloneNode(idx) as ExpressionNode, parts.sel,
    ), at);
    return this.twoStatementBlock(addrAssign, selAssign, at);
  }

  // `b = a` -> `{ b = a; __fnsel_b = __fnsel_a; b$len = a$len; }` (the length authority only when unbounded).
  visitAssign(node: AssignNode): Node {
    return this.rewriteCopy(node.identifier.name, node.expression, node, true) ?? super.visitAssign(node);
  }

  visitStateAssign(node: StateAssignNode): Node {
    return this.rewriteCopy(node.name, node.expression, node, false) ?? super.visitStateAssign(node);
  }

  private rewriteCopy(
    name: string, value: ExpressionNode, at: AssignNode | StateAssignNode, mayBeLocal: boolean,
  ): Node | undefined {
    if (!this.lowered.has(name) || (mayBeLocal && this.isLocal(name))) return undefined;
    const src = this.copySource(name, value);
    if (src === undefined) throw new FnPtrArrayLoweringError(at, name, UNSUPPORTED_COPY);
    const flags = { fromModifier: at.fromModifier, qualifiedBaseAccess: at.qualifiedBaseAccess };
    const selRead = this.copyLoc(new IdentifierNode(this.selArrayName(src)), at);
    const statements: StatementNode[] = [
      at,
      Object.assign(this.copyLoc(new StateAssignNode(this.selArrayName(name), selRead), at), flags),
    ];
    if (this.tables.get(name)!.bound === undefined) {
      const lenRead = this.copyLoc(new StateAccessNode(`${src}$len`), at);
      statements.push(Object.assign(this.copyLoc(new StateAssignNode(`${name}$len`, lenRead), at), flags));
    }
    const block = new BlockNode(statements);
    block.location = at.location;
    return block;
  }

  // `this.fns[i] = v` / `delete fns[i]` parse MAPPING-flavored while the array is still a collection;
  // convert single-key forms to the state-array lockstep rewrites.
  visitMappingAssign(node: MappingAssignNode): Node {
    if (node.keys.length === 1 && !node.arrayPush && !node.arrayPop && !node.arrayIndex) {
      const r = this.rewriteAssign(node.name, node.keys[0], node.expression, node);
      if (r) return r;
    }
    return super.visitMappingAssign(node);
  }

  visitMappingDelete(node: MappingDeleteNode): Node {
    if (node.keys.length === 1) {
      const r = this.rewriteDelete(node.name, node.keys[0], node);
      if (r) return r;
    }
    return super.visitMappingDelete(node);
  }

  visitStateArrayPop(node: StateArrayPopNode): Node {
    return this.rewritePop(node.name, node) ?? super.visitStateArrayPop(node);
  }

  visitArrayPop(node: ArrayPopNode): Node {
    return this.rewritePop(node.name, node) ?? super.visitArrayPop(node);
  }

  private rewritePop(name: string, at: Node): Node | undefined {
    if (!this.lowered.has(name)) return undefined;
    const addrPop = this.copyLoc(new StateArrayPopNode(name), at);
    const selPop = this.copyLoc(new StateArrayPopNode(this.selArrayName(name)), at);
    return this.twoStatementBlock(addrPop, selPop, at);
  }

  visitStateArrayDelete(node: StateArrayDeleteNode): Node {
    return this.rewriteDelete(node.name, node.index, node) ?? super.visitStateArrayDelete(node);
  }

  visitArrayDelete(node: ArrayDeleteNode): Node {
    return this.rewriteDelete(node.name, node.index, node) ?? super.visitArrayDelete(node);
  }

  private rewriteDelete(name: string, index: ExpressionNode, at: Node): Node | undefined {
    if (!this.lowered.has(name)) return undefined;
    const idx = this.visit(index) as ExpressionNode;
    const addrDel = this.copyLoc(new StateArrayDeleteNode(name, idx), at);
    const selDel = this.copyLoc(new StateArrayDeleteNode(this.selArrayName(name), cloneNode(idx) as ExpressionNode), at);
    return this.twoStatementBlock(addrDel, selDel, at);
  }

  // `fns[idx](args)`: SINGLE element call outside a loop (hoisted element + selector locals, one co-spend);
  // BROADCAST inside a loop (index-independent receiver -> selectorArrayVar loop covenant).
  visitIndirectCall(node: IndirectCallNode): Node {
    const callee = node.callee;
    const target = callee instanceof ArrayAccessNode && callee.array instanceof IdentifierNode
      ? { name: callee.array.name, index: callee.index }
      : callee instanceof MappingAccessNode && callee.keys.length === 1
        ? { name: callee.name, index: callee.keys[0] }
        : undefined;
    if (target) {
      const name = target.name;
      const info = this.lowered.get(name);
      if (info) {
        const args = node.parameters.map((a) => this.visit(a) as ExpressionNode);
        if (this.loopDepth > 0) {
          if (info.returns) {
            throw new FnPtrArrayLoweringError(node, name,
              'a broadcast call (inside a loop) cannot return a value; call a single element outside a loop');
          }
          const arrId = new IdentifierNode(name); arrId.location = node.location;
          // The ordinary broadcast covenant verifies the whole table in its epilogue, so its receiver stays
          // index-independent (fns[0]); the loop variable is not in scope where the receiver is hoisted. A
          // graph handler executes this callsite once per reached iteration and must reconstruct that row's
          // exact target and selector from state, so it keeps the live index.
          const liveIndex = this.graphMode
            ? this.visit(target.index) as ExpressionNode
            : Object.assign(new IntLiteralNode(0n), { location: node.location });
          const elem = new ArrayAccessNode(arrId, cloneNode(liveIndex) as ExpressionNode);
          elem.location = node.location;
          const ifaceId = new IdentifierNode(info.iface); ifaceId.location = node.location;
          const cast = new FunctionCallNode(ifaceId, [elem]); cast.location = node.location;
          const mc = new MethodCallNode(cast, '__call', args); mc.location = node.location;
          mc.callOptions = node.callOptions;
          mc.pointerTableBroadcast = true;
          mc.selectorArrayVar = this.selArrayName(name);
          if (this.graphMode) {
            const selectorArray = new IdentifierNode(this.selArrayName(name));
            selectorArray.location = node.location;
            const selectorRead = new ArrayAccessNode(
              selectorArray, cloneNode(liveIndex) as ExpressionNode,
            );
            selectorRead.location = node.location;
            const selectorCast = new CastNode(new BytesType(4), selectorRead, false);
            selectorCast.location = node.location;
            mc.runtimeSelector = selectorCast;
          }
          return mc;
        }
        const idx = this.visit(target.index) as ExpressionNode;
        const n = this.hoistCounter++;
        const elemName = `__fnelem_r${n}`;
        const selName = `__fnelemsel_r${n}`;
        const arrId = new IdentifierNode(name); arrId.location = node.location;
        const elemRead = new ArrayAccessNode(arrId, idx); elemRead.location = node.location;
        const elemDef = new VariableDefinitionNode(new AddressType(false), [], elemName, elemRead);
        elemDef.location = node.location;
        this.hoists.push(elemDef);
        const selArrId = new IdentifierNode(this.selArrayName(name)); selArrId.location = node.location;
        const selRead = new ArrayAccessNode(selArrId, cloneNode(idx) as ExpressionNode);
        selRead.location = node.location;
        const selCast = new CastNode(new BytesType(4), selRead, false); selCast.location = node.location;
        const selDef = new VariableDefinitionNode(new BytesType(4), [], selName, selCast);
        selDef.location = node.location;
        this.hoists.push(selDef);
        const elemId = new IdentifierNode(elemName); elemId.location = node.location;
        const ifaceId = new IdentifierNode(info.iface); ifaceId.location = node.location;
        const cast = new FunctionCallNode(ifaceId, [elemId]); cast.location = node.location;
        const mc = new MethodCallNode(cast, '__call', args); mc.location = node.location;
        mc.callOptions = node.callOptions;
        const selId = new IdentifierNode(selName); selId.location = node.location;
        mc.runtimeSelector = selId;
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

  // The (address, framed selector) parts of a written fn-ptr value: a received value with a `__fnsel_`
  // companion (param or lowered state var), or an inline `IFace(a).method` (compile-time selector).
  private valueParts(value: ExpressionNode): { addr: ExpressionNode; sel: ExpressionNode } | undefined {
    const fm = this.foreignMember(value);
    if (fm) {
      const addr = cloneNode((value as FieldAccessNode).expression as Node) as FunctionCallNode;
      return { addr: addr.parameters[0], sel: this.inlineSelectorExpr(fm, value) };
    }
    if (value instanceof IdentifierNode && this.hasSelectorCompanion(value.name)) {
      const sel = new IdentifierNode(`${SELECTOR_ARRAY_PREFIX}${value.name}`); sel.location = value.location;
      const bounded = new CastNode(new BytesType(), sel, false); bounded.location = value.location;
      return { addr: cloneNode(value) as ExpressionNode, sel: bounded };
    }
    return undefined;
  }

  private inlineSelectorExpr(fm: { iface: string; method: string }, at: Node): ExpressionNode {
    const ifaceId = new IdentifierNode(fm.iface); ifaceId.location = at.location;
    const methodAccess = new FieldAccessNode(ifaceId, fm.method); methodAccess.location = at.location;
    const selector = new FieldAccessNode(methodAccess, 'selector'); selector.location = at.location;
    const bounded = new CastNode(new BytesType(), selector, false); bounded.location = at.location;
    return bounded;
  }

  private collectWrites(name: string, bodies: FunctionDefinitionNode[]): { recognized: boolean }[] {
    const out: { recognized: boolean }[] = [];
    for (const fn of bodies) {
      this.currentFn = fn;
      this.forEachWriteTo(fn.body!, name, (val) => out.push({ recognized: !!this.valueParts(val) }));
    }
    this.currentFn = undefined;
    return out;
  }

  // The table each whole-array assignment to `name` copies; undefined for a value with no tracked selectors (a
  // literal, `new`, a memory/calldata array, a call result) or an assignment a same-named local may receive.
  private collectCopies(name: string, bodies: FunctionDefinitionNode[]): Array<string | undefined> {
    const out: Array<string | undefined> = [];
    for (const fn of bodies) {
      this.currentFn = fn;
      this.walk(fn.body!, (n) => {
        if (n instanceof AssignmentExpressionNode && n.assign.identifier.name === name) out.push(undefined);
        else if (n instanceof AssignNode && n.identifier.name === name) {
          out.push(this.isLocal(name) ? undefined : this.copySource(name, n.expression));
        } else if (n instanceof StateAssignNode && n.name === name) out.push(this.copySource(name, n.expression));
      });
    }
    this.currentFn = undefined;
    return out;
  }

  // A copy source is another table of this pass whose function type converts to the destination's (same
  // parameters and returns, mutability no weaker) and whose length kind matches.
  private copySource(name: string, value: ExpressionNode): string | undefined {
    const src = value instanceof StateAccessNode ? value.name
      : value instanceof IdentifierNode && !this.isLocal(value.name) ? value.name : undefined;
    const to = this.tables.get(name);
    const from = src === undefined ? undefined : this.tables.get(src);
    if (!to || !from || to.bound !== from.bound) return undefined;
    const toFt = to.elementType as FunctionType;
    const fromFt = from.elementType as FunctionType;
    if (toFt.toString() !== fromFt.toString()) return undefined;
    const converts = fromFt.stateMutability === toFt.stateMutability || toFt.stateMutability === 'nonpayable'
      || (toFt.stateMutability === 'view' && fromFt.stateMutability === 'pure');
    return converts ? src : undefined;
  }

  // A param, named return or local of the current function with this name.
  private isLocal(name: string): boolean {
    const fn = this.currentFn;
    if (!fn) return false;
    let names = this.localNames.get(fn);
    if (!names) {
      const found = new Set<string>([...fn.parameters.map((p) => p.name), ...(fn.returnNames ?? [])]);
      if (fn.body) this.walk(fn.body, (n) => { if (n instanceof VariableDefinitionNode) found.add(n.name); });
      this.localNames.set(fn, found);
      names = found;
    }
    return names.has(name);
  }

  // Any statement writing the `<name>$len` length authority (or an inner `<name>$len$<level>`): a push, pop or
  // whole delete of the unbounded collection array.
  private writesLengthAuthority(name: string, bodies: FunctionDefinitionNode[]): boolean {
    const authority = `${name}$len`;
    const writes: string[] = [];
    const visit = (n: Node): void => {
      if (!(n instanceof StatementNode) || n instanceof VariableDefinitionNode) return;
      const target = n instanceof AssignNode ? n.identifier.name : (n as { name?: unknown }).name;
      if (typeof target === 'string') writes.push(target);
    };
    for (const fn of bodies) this.walk(fn.body!, visit);
    return writes.some((t) => t === authority || t.startsWith(`${authority}$`));
  }

  // `<name>$len = <length> + n`: the bump the parser keeps of a push whose value it dropped (a pop subtracts and a
  // whole delete assigns zero, so an addition into the length authority is a push).
  private incrementsLengthAuthority(name: string, bodies: FunctionDefinitionNode[]): boolean {
    const authority = `${name}$len`;
    let found = false;
    const visit = (n: Node): void => {
      const target = n instanceof AssignNode ? n.identifier.name : n instanceof StateAssignNode ? n.name : undefined;
      if (target !== authority) return;
      const e = (n as AssignNode | StateAssignNode).expression;
      if (e instanceof BinaryOpNode && e.operator === BinaryOperator.PLUS) found = true;
    };
    for (const fn of bodies) this.walk(fn.body!, visit);
    return found;
  }

  // A name has a selector companion if a param `__fnsel_<name>` is in scope (the param lowering's convention)
  // or a state var `__fnsel_<name>` exists (the storage lowering's convention for received state pointers).
  private hasSelectorCompanion(name: string): boolean {
    if (this.stateVarNames.has(`${SELECTOR_ARRAY_PREFIX}${name}`)) return true;
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
    const method = new InterfaceFunctionNode('__call', params, ft.returnTypes, ft.stateMutability);
    const iface = new InterfaceNode(iname, [], [], [method]);
    (iface as InterfaceNode & { __sig?: string }).__sig = sig;
    this.synthIfaces.push(iface);
    return iname;
  }

  private forEachWriteTo(node: Node, name: string, cb: (val: ExpressionNode) => void): void {
    this.walk(node, (n) => {
      if (n instanceof StateArrayPushNode && n.name === name && !n.noArg) cb(n.value);
      else if (n instanceof ArrayPushNode && n.name === name && !n.noArg) cb(n.value);
      else if (n instanceof StateArrayAssignNode && n.name === name) cb(n.value);
      else if (n instanceof ArrayAssignNode && n.name === name) cb(n.value);
      else if (n instanceof MappingAssignNode && n.name === name && n.keys.length === 1
        && !n.arrayPush && !n.arrayPop && !n.arrayIndex && !n.noArg) cb(n.expression);
    });
  }

  // Pre-order visit of every node reachable through a node's own fields.
  private walk(n: Node, cb: (n: Node) => void): void {
    cb(n);
    for (const key of Object.keys(n)) {
      const val = (n as unknown as Record<string, unknown>)[key];
      if (val instanceof Node) this.walk(val, cb);
      else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) this.walk(v, cb);
    }
  }
}
