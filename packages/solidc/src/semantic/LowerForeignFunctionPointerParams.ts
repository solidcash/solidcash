import {
  Node,
  SourceFileNode,
  ContractNode,
  InterfaceNode,
  InterfaceFunctionNode,
  ParameterNode,
  FunctionDefinitionNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  MethodCallNode,
  MethodCallStatementNode,
  StateAccessNode,
  AssignNode,
  StateAssignNode,
  StateArrayPushNode,
  ArrayPushNode,
  IdentifierNode,
  ExpressionNode,
} from '../ast/AST.js';
import { FunctionType, AddressType, BytesType, ArrayType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * FOREIGN external function-pointer PARAMETERS called through (`function(P) external returns(R) y; ... y(v)`).
 * At the ABI boundary a `function(..) external` value is `(address, selector)`, so a called fn-ptr param is a
 * foreign call. Lowered to an external call on a synthesized interface `__FnPtr_N` (method `__call(P) returns
 * (R)`, for the ABI) with address = the (now `address`-typed) param + a synthetic `bytes4` selector param
 * (`__fnsel_<y>`) threaded as the runtime selector. The callee's block layout is unknown for a generic pointer,
 * so codegen reads the co-spend master by a PER-CALL index the SDK fills (marked via the `__FnPtr_` interface
 * name -> slot.fnPtrCall), not a fixed block offset - unambiguous across many calls.
 */
export default class LowerForeignFunctionPointerParams extends AstTraversal {
  private synthIfaces: InterfaceNode[] = [];
  private counter = 0;
  private rewrites = new Map<string, { iface: string; selParam: string }>();
  // funcName -> the arg positions that receive a SELF-REF (`this.f`, a StateAccess) at some internal call site.
  // A fn-ptr param passed a self-ref stays a functionId (internal OP_INVOKE); only genuinely-foreign params lower.
  private selfRefArgPositions = new Map<string, Set<number>>();
  // Names of the contract's foreign fn-ptr STATE variables; a param STORED into one is a foreign value flow
  // (LowerForeignFunctionPointerStorage flattens the var + calls through it), so it lowers even if never called.
  private fnPtrStateVars = new Set<string>();
  // Names of the contract's foreign fn-ptr ARRAYS (collections); a param PUSHED into one is likewise a foreign
  // value flow (LowerReceivedFnPtrArray flattens the array + dispatches through the stored value).
  private fnPtrArrayNames = new Set<string>();

  visitSourceFile(node: SourceFileNode): Node {
    this.synthIfaces = [];
    this.counter = 0;
    if (node.contract) node.contract = this.visitContract(node.contract) as ContractNode;
    for (const iface of this.synthIfaces) node.interfaceDefinitions.push(iface);
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.selfRefArgPositions = this.collectSelfRefArgs(node);
    this.fnPtrStateVars = new Set(
      node.stateVariables
        .filter((sv) => sv.type instanceof FunctionType && (sv.type as FunctionType).isExternal)
        .map((sv) => sv.name),
    );
    this.fnPtrArrayNames = new Set(
      node.collections
        .filter((c) => c.type instanceof ArrayType && (c.type.elementType instanceof FunctionType)
          && (c.type.elementType as FunctionType).isExternal)
        .map((c) => c.name),
    );
    node.functions = node.functions.map((f) => this.rewriteFn(f));
    return node;
  }

  // Scan every call `F(args)` in the contract; record positions where a StateAccess (`this.f` self-ref) is passed.
  private collectSelfRefArgs(node: ContractNode): Map<string, Set<number>> {
    const map = new Map<string, Set<number>>();
    const walk = (n: Node): void => {
      if (n instanceof FunctionCallNode && n.identifier instanceof IdentifierNode) {
        n.parameters.forEach((a, i) => {
          if (a instanceof StateAccessNode) {
            const set = map.get(n.identifier.name) ?? new Set<number>();
            set.add(i); map.set(n.identifier.name, set);
          }
        });
      }
      for (const key of Object.keys(n)) {
        const val = (n as unknown as Record<string, unknown>)[key];
        if (val instanceof Node) walk(val);
        else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) walk(v);
      }
    };
    for (const fn of node.functions) if (fn.body) walk(fn.body);
    return map;
  }

  private rewriteFn(fn: FunctionDefinitionNode): FunctionDefinitionNode {
    if (!fn.body) return fn;
    const fnPtrParams = fn.parameters.filter(
      (p) => p.type instanceof FunctionType && (p.type as FunctionType).isExternal,
    );
    if (fnPtrParams.length === 0) return fn;

    this.rewrites = new Map();
    const selfRefPositions = this.selfRefArgPositions.get(fn.name) ?? new Set<number>();
    const newParams: ParameterNode[] = [];
    for (let pos = 0; pos < fn.parameters.length; pos++) {
      const p = fn.parameters[pos];
      // A fn-ptr param passed a self-ref (`this.f`) at any internal call site stays a functionId (internal
      // OP_INVOKE); do not lower it to a foreign (address, selector) call - that would break the self-ref path.
      // Lower a genuinely-foreign param that is CALLED here, or STORED into a foreign fn-ptr state var (the
      // storage pass then calls through the stored value).
      if (fnPtrParams.includes(p) && !selfRefPositions.has(pos)
        && (this.isCalled(fn, p.name) || this.isStoredToFnPtrState(fn, p.name)
          || this.isPushedToFnPtrArray(fn, p.name))) {
        const ft = p.type as FunctionType;
        const ifaceName = this.synthInterface(ft);
        const selName = `__fnsel_${p.name}`;
        this.rewrites.set(p.name, { iface: ifaceName, selParam: selName });
        p.type = new AddressType(false);
        newParams.push(p);
        const sel = new ParameterNode(new BytesType(4), selName);
        sel.location = p.location;
        newParams.push(sel);
      } else {
        newParams.push(p);
      }
    }
    if (this.rewrites.size === 0) return fn;
    fn.parameters = newParams;
    fn.body = this.visit(fn.body) as typeof fn.body;
    return fn;
  }

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
    const info = this.rewrites.get(node.identifier.name);
    if (info) {
      const ifaceId = new IdentifierNode(info.iface); ifaceId.location = node.location;
      const yRead = new IdentifierNode(node.identifier.name); yRead.location = node.location;
      const cast = new FunctionCallNode(ifaceId, [yRead]); cast.location = node.location;
      const args = node.parameters.map((a) => this.visit(a) as ExpressionNode);
      const mc = new MethodCallNode(cast, '__call', args); mc.location = node.location;
      const selRead = new IdentifierNode(info.selParam); selRead.location = node.location;
      mc.runtimeSelector = selRead;
      return mc;
    }
    return super.visitFunctionCall(node);
  }

  private synthInterface(ft: FunctionType): string {
    const sig = ft.toString();
    const existing = this.synthIfaces.find((i) => (i as InterfaceNode & { __sig?: string }).__sig === sig);
    if (existing) return existing.name;
    const name = `__FnPtr_${this.counter++}`;
    const params = ft.parameterTypes.map((t, i) => new ParameterNode(t, `p${i}`));
    const method = new InterfaceFunctionNode('__call', params, ft.returnTypes);
    const iface = new InterfaceNode(name, [], [], [method]);
    (iface as InterfaceNode & { __sig?: string }).__sig = sig;
    this.synthIfaces.push(iface);
    return name;
  }

  // True if `name` is assigned to a foreign fn-ptr state var (`stored = name`) anywhere in fn.
  private isStoredToFnPtrState(fn: FunctionDefinitionNode, name: string): boolean {
    let found = false;
    const isNameRead = (e: unknown): boolean => e instanceof IdentifierNode && e.name === name;
    const walk = (n: Node): void => {
      if (found) return;
      if (n instanceof AssignNode && this.fnPtrStateVars.has(n.identifier.name) && isNameRead(n.expression)) {
        found = true; return;
      }
      if (n instanceof StateAssignNode && this.fnPtrStateVars.has(n.name) && isNameRead(n.expression)) {
        found = true; return;
      }
      for (const key of Object.keys(n)) {
        const val = (n as unknown as Record<string, unknown>)[key];
        if (val instanceof Node) walk(val);
        else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) walk(v);
      }
    };
    if (fn.body) walk(fn.body);
    return found;
  }

  // True if `name` is pushed into a foreign fn-ptr array (`fns.push(name)`) anywhere in fn.
  private isPushedToFnPtrArray(fn: FunctionDefinitionNode, name: string): boolean {
    let found = false;
    const isNameRead = (e: unknown): boolean => e instanceof IdentifierNode && e.name === name;
    const walk = (n: Node): void => {
      if (found) return;
      if ((n instanceof StateArrayPushNode || n instanceof ArrayPushNode)
        && this.fnPtrArrayNames.has(n.name) && !n.noArg && isNameRead(n.value)) {
        found = true; return;
      }
      for (const key of Object.keys(n)) {
        const val = (n as unknown as Record<string, unknown>)[key];
        if (val instanceof Node) walk(val);
        else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) walk(v);
      }
    };
    if (fn.body) walk(fn.body);
    return found;
  }

  private isCalled(fn: FunctionDefinitionNode, name: string): boolean {
    let found = false;
    const walk = (n: Node): void => {
      if (found) return;
      if (n instanceof FunctionCallNode && n.identifier instanceof IdentifierNode && n.identifier.name === name) {
        found = true; return;
      }
      for (const key of Object.keys(n)) {
        const val = (n as unknown as Record<string, unknown>)[key];
        if (val instanceof Node) walk(val);
        else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) walk(v);
      }
    };
    if (fn.body) walk(fn.body);
    return found;
  }
}
