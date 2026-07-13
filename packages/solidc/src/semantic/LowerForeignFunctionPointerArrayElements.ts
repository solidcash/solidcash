import {
  Node,
  SourceFileNode,
  ContractNode,
  InterfaceNode,
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
} from '../ast/AST.js';
import { ArrayType, FunctionType, AddressType, BytesType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { FnPtrArrayLoweringError } from '../Errors.js';

const SELECTOR_ARRAY_PREFIX = '__fnsel_';

type ArrayClassification = { kind: 'fixed' | 'varying' | 'none'; iface: string; method: string };
type TableInfo = { kind: 'fixed' | 'varying'; iface: string; method: string; returns: boolean };

/**
 * FOREIGN external function-pointer ARRAYS whose every written value is an inline `IFace(a).method` (a dispatch
 * table of callbacks). A `function(P) external[] fns;` lowers to a plain `address[]` state array (the co-spend
 * targets); a varying-method table (same interface, differing methods) also gets a parallel `bytes[]`
 * `__fnsel_<name>` selector array, each write recording its element's method selector. Received values are
 * handled later by LowerReceivedFnPtrArray.
 *
 * Call semantics (Solidity parity):
 * - `fns[idx](args)` OUTSIDE a loop calls ONLY element idx: hoists `address __fnelem = fns[idx];` (+ a
 *   `bytes4 __fnelemsel = bytes4(__fnsel_fns[idx]);` runtime selector for a varying table) and emits the
 *   single computed-receiver call `IFace(__fnelem).m(args)`. Value-returning calls work here.
 * - `fns[i](args)` INSIDE a loop is the notify-all idiom and maps to the BROADCAST covenant: the epilogue
 *   co-spends + verifies + calls EVERY element (the source loop is harmless iteration; the receiver is
 *   rewritten to the index-independent `fns[0]` since the covenant reads the whole array). A broadcast cannot
 *   return a value (rejected).
 *
 * Mutations stay in LOCKSTEP with the selector array: a varying table's element assign / pop / delete rewrites
 * to a two-statement block mutating both arrays; classification scans pushes AND element assigns.
 */
export default class LowerForeignFunctionPointerArrayElements extends AstTraversal {
  private typeNames = new Set<string>();
  private tables = new Map<string, TableInfo>();
  private loopDepth = 0;
  private hoistCounter = 0;
  private hoists: StatementNode[] = [];

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

    // Classify each array from ALL its writes (pushes + element assigns): every value must be a same-interface
    // `IFace(a).method`. Same method -> fixed table; differing -> varying table (parallel selector array).
    this.tables = new Map();
    for (const coll of fnPtrArrays) {
      if (!(coll.type instanceof ArrayType)) continue;
      const c = this.classifyArray(coll.name, bodies);
      if (c.kind === 'none') continue;
      const ft = coll.type.elementType as FunctionType;
      this.tables.set(coll.name, {
        kind: c.kind, iface: c.iface, method: c.method, returns: (ft.returnTypes ?? []).length > 0,
      });
    }
    if (this.tables.size === 0) return node;

    // A plain-`address[]` array is registered as a dynamic-array STATE VARIABLE (not a collection), so MOVE each
    // classified fn-ptr array out of collections into a plain `address[]` state var (+ the parallel `bytes[]`
    // selector array for a varying table; framed elements so each decodes like the address element).
    for (const coll of fnPtrArrays) {
      const t = this.tables.get(coll.name);
      if (!t || !(coll.type instanceof ArrayType)) continue;
      const sv = new StateVariableNode(new ArrayType(new AddressType(false), coll.type.bound), coll.name);
      sv.isDynamic = true;
      sv.visibility = coll.visibility;
      sv.location = coll.location;
      node.stateVariables.push(sv);
      if (t.kind === 'varying') {
        const selSv = new StateVariableNode(new ArrayType(new BytesType(), coll.type.bound), this.selArrayName(coll.name));
        selSv.isDynamic = true;
        selSv.location = coll.location;
        node.stateVariables.push(selSv);
      }
    }
    node.collections = node.collections.filter((c) => !this.tables.has(c.name));

    node.constructorDef = this.rewrite(node.constructorDef);
    node.functions = node.functions.map((f) => this.rewrite(f)!);
    node.fallbackDef = this.rewrite(node.fallbackDef);
    node.receiveDef = this.rewrite(node.receiveDef);
    return node;
  }

  private classifyArray(name: string, bodies: FunctionDefinitionNode[]): ArrayClassification {
    const written: Array<{ iface: string; method: string } | undefined> = [];
    for (const fn of bodies) this.forEachWriteTo(fn.body!, name, (val) => written.push(this.foreignMember(val)));
    if (written.length === 0 || written.some((p) => !p)) return { kind: 'none', iface: '', method: '' };
    const members = written as { iface: string; method: string }[];
    const { iface, method } = members[0];
    if (members.some((p) => p.iface !== iface)) return { kind: 'none', iface: '', method: '' };
    const varying = members.some((p) => p.method !== method);
    return { kind: varying ? 'varying' : 'fixed', iface, method };
  }

  private rewrite(fn: FunctionDefinitionNode | undefined): FunctionDefinitionNode | undefined {
    if (fn?.body) fn.body = this.visit(fn.body) as typeof fn.body;
    return fn;
  }

  // Hoisted statements (element/selector locals for a single-element call) land BEFORE the statement that
  // produced them - the LowerBlobFunctionPointers pattern.
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

  // `fns.push(IFace(a).m)` -> push the address (fixed) or the (address, selector) pair (varying). Bare pushes
  // are normalized to the STATE flavor (the array IS a state var after lowering; bare-name parse routing
  // predates it).
  visitStateArrayPush(node: StateArrayPushNode): Node {
    return this.rewritePush(node.name, node.value, node) ?? super.visitStateArrayPush(node);
  }

  visitArrayPush(node: ArrayPushNode): Node {
    return this.rewritePush(node.name, node.value, node) ?? super.visitArrayPush(node);
  }

  private rewritePush(name: string, value: ExpressionNode, at: Node): Node | undefined {
    const t = this.tables.get(name);
    const fm = this.foreignMember(value);
    if (!t || !fm) return undefined;
    const addrPush = this.copyLoc(new StateArrayPushNode(name, this.addressOf(value)), at);
    if (t.kind === 'fixed') return addrPush;
    const selPush = this.copyLoc(new StateArrayPushNode(this.selArrayName(name), this.selectorExpr(fm, at)), at);
    return this.twoStatementBlock(addrPush, selPush, at);
  }

  // `fns[i] = IFace(a).m` -> address element assign (fixed) or the lockstep pair (varying).
  visitStateArrayAssign(node: StateArrayAssignNode): Node {
    return this.rewriteAssign(node.name, node.index, node.value, node) ?? super.visitStateArrayAssign(node);
  }

  visitArrayAssign(node: ArrayAssignNode): Node {
    return this.rewriteAssign(node.name, node.index, node.value, node) ?? super.visitArrayAssign(node);
  }

  private rewriteAssign(name: string, index: ExpressionNode, value: ExpressionNode, at: Node): Node | undefined {
    const t = this.tables.get(name);
    const fm = this.foreignMember(value);
    if (!t || !fm) return undefined;
    const idx = this.visit(index) as ExpressionNode;
    const addrAssign = this.copyLoc(new StateArrayAssignNode(name, idx, this.addressOf(value)), at);
    if (t.kind === 'fixed') return addrAssign;
    const selAssign = this.copyLoc(new StateArrayAssignNode(
      this.selArrayName(name), cloneNode(idx) as ExpressionNode, this.selectorExpr(fm, at),
    ), at);
    return this.twoStatementBlock(addrAssign, selAssign, at);
  }

  // `fns.pop()` / `delete fns[i]` -> lockstep on both arrays for a varying table; state-flavor for a fixed one.
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
    const t = this.tables.get(name);
    if (!t) return undefined;
    const addrPop = this.copyLoc(new StateArrayPopNode(name), at);
    if (t.kind === 'fixed') return addrPop;
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
    const t = this.tables.get(name);
    if (!t) return undefined;
    const idx = this.visit(index) as ExpressionNode;
    const addrDel = this.copyLoc(new StateArrayDeleteNode(name, idx), at);
    if (t.kind === 'fixed') return addrDel;
    const selDel = this.copyLoc(new StateArrayDeleteNode(this.selArrayName(name), cloneNode(idx) as ExpressionNode), at);
    return this.twoStatementBlock(addrDel, selDel, at);
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

  // `fns[idx](args)`: SINGLE element call outside a loop (hoisted element local, runtime selector for varying);
  // BROADCAST inside a loop (index-independent receiver -> the shipped array-element co-spend loop).
  visitIndirectCall(node: IndirectCallNode): Node {
    const callee = node.callee;
    const target = callee instanceof ArrayAccessNode && callee.array instanceof IdentifierNode
      ? { name: callee.array.name, index: callee.index }
      : callee instanceof MappingAccessNode && callee.keys.length === 1
        ? { name: callee.name, index: callee.keys[0] }
        : undefined;
    if (target) {
      const name = target.name;
      const t = this.tables.get(name);
      if (t) {
        const args = node.parameters.map((a) => this.visit(a) as ExpressionNode);
        if (this.loopDepth > 0) {
          if (t.returns) {
            throw new FnPtrArrayLoweringError(node, name,
              'a broadcast call (inside a loop) cannot return a value; call a single element outside a loop');
          }
          // Broadcast: the covenant reads the WHOLE array; the receiver only names it, so use the
          // index-independent fns[0] (the loop variable is not in scope where the receiver is hoisted).
          const arrId = new IdentifierNode(name); arrId.location = node.location;
          const zero = new IntLiteralNode(0n); zero.location = node.location;
          const elem = new ArrayAccessNode(arrId, zero); elem.location = node.location;
          const ifaceId = new IdentifierNode(t.iface); ifaceId.location = node.location;
          const cast = new FunctionCallNode(ifaceId, [elem]); cast.location = node.location;
          const mc = new MethodCallNode(cast, t.method, args); mc.location = node.location;
          if (t.kind === 'varying') mc.selectorArrayVar = this.selArrayName(name);
          return mc;
        }
        // Single element: hoist `address __fnelem_N = fns[idx];` (+ the element's runtime selector for a
        // varying table) and call through the computed receiver - one co-spend, Solidity semantics.
        const idx = this.visit(target.index) as ExpressionNode;
        const n = this.hoistCounter++;
        const elemName = `__fnelem_${n}`;
        const arrId = new IdentifierNode(name); arrId.location = node.location;
        const elemRead = new ArrayAccessNode(arrId, idx); elemRead.location = node.location;
        const elemDef = new VariableDefinitionNode(new AddressType(false), [], elemName, elemRead);
        elemDef.location = node.location;
        this.hoists.push(elemDef);
        const elemId = new IdentifierNode(elemName); elemId.location = node.location;
        const ifaceId = new IdentifierNode(t.iface); ifaceId.location = node.location;
        const cast = new FunctionCallNode(ifaceId, [elemId]); cast.location = node.location;
        const mc = new MethodCallNode(cast, t.method, args); mc.location = node.location;
        if (t.kind === 'varying') {
          const selName = `__fnelemsel_${n}`;
          const selArrId = new IdentifierNode(this.selArrayName(name)); selArrId.location = node.location;
          const selRead = new ArrayAccessNode(selArrId, cloneNode(idx) as ExpressionNode);
          selRead.location = node.location;
          const selCast = new CastNode(new BytesType(4), selRead, false); selCast.location = node.location;
          const selDef = new VariableDefinitionNode(new BytesType(4), [], selName, selCast);
          selDef.location = node.location;
          this.hoists.push(selDef);
          const selId = new IdentifierNode(selName); selId.location = node.location;
          mc.runtimeSelector = selId;
        }
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

  // Invoke cb(value) for every WRITE (push or element assign, either flavor) whose target is `arrName`.
  private forEachWriteTo(node: Node, arrName: string, cb: (val: ExpressionNode) => void): void {
    const walk = (n: Node): void => {
      if (n instanceof StateArrayPushNode && n.name === arrName && !n.noArg) cb(n.value);
      else if (n instanceof ArrayPushNode && n.name === arrName && !n.noArg) cb(n.value);
      else if (n instanceof StateArrayAssignNode && n.name === arrName) cb(n.value);
      else if (n instanceof ArrayAssignNode && n.name === arrName) cb(n.value);
      else if (n instanceof MappingAssignNode && n.name === arrName && n.keys.length === 1
        && !n.arrayPush && !n.arrayPop && !n.arrayIndex && !n.noArg) cb(n.expression);
      for (const key of Object.keys(n)) {
        const val = (n as unknown as Record<string, unknown>)[key];
        if (val instanceof Node) walk(val);
        else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) walk(v);
      }
    };
    walk(node);
  }
}
