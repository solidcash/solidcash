import {
  Node,
  SourceFileNode,
  ContractNode,
  InterfaceNode,
  InterfaceFunctionNode,
  ParameterNode,
  StructDefinitionNode,
  FunctionDefinitionNode,
  BlockNode,
  StatementNode,
  VariableDefinitionNode,
  ReturnNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  MethodCallStatementNode,
  MethodCallNode,
  FieldAccessNode,
  BinaryOpNode,
  TupleIndexOpNode,
  CastNode,
  IntLiteralNode,
  IdentifierNode,
  ExpressionNode,
} from '../ast/AST.js';
import { FunctionType, BytesType } from '@solidcash/utils';
import { BinaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * The general foreign fn-ptr VALUE model: a `function(P) external returns(R)` value that carries its method AT
 * RUNTIME (a RECEIVED value, not a fixed `IFace(a).m`) is represented as a bytes BLOB `selector(4) ++ address`.
 * This pass lowers a fn-ptr STRUCT FIELD holding such a value to a `bytes` field, and a call through it slices
 * the blob and dispatches the audited external call:
 *
 *   struct S { function(uint) external returns(uint) fn; }     struct S { bytes fn; }
 *   s.fn(v)  ->  bytes __b = s.fn; bytes __a = __b.split(4)[1];
 *                __FnPtr_S(__a).__call(v)  with runtime selector bytes4(__b.split(4)[0]) + fnPtrCall
 *
 * A sliced-address LOCAL is an audited external-call target (SynthesizeExternalAddressLocals hoists it), and the
 * runtime selector + per-call master index reuse the param machinery. A param stored into such a field is a
 * blob too (bytes), so the store `s.fn = y` is a plain bytes copy. Runs after the fixed-method struct-field pass
 * (which lowers `s.fn = IFace(a).m` fields to interface-typed) - only received-value fn-ptr fields remain here.
 */
export default class LowerBlobFunctionPointers extends AstTraversal {
  private synthIfaces: InterfaceNode[] = [];
  private counter = 0;
  private structDefs: StructDefinitionNode[] = [];
  // fn-ptr struct field name -> the synth interface for its call ABI
  private blobFields = new Map<string, { iface: string }>();
  // fn name (returns a fn-ptr, not inlined) -> the synth interface for the returned value's call ABI
  private blobReturnFns = new Map<string, { iface: string }>();
  // fn-ptr LOCAL name -> the synth interface for its call ABI (assigned a blob-returning call)
  private blobLocals = new Map<string, { iface: string }>();
  private hoists: StatementNode[] = [];
  private inBlobReturnFn = false;
  private typeNames = new Set<string>();
  // `iface.method` -> the fn-ptr type a cross-contract call returns (received as a blob via the return-event NFT)
  private ifaceFnPtrReturns = new Map<string, FunctionType>();
  // A fn-ptr blob is a FIXED size: selector(4) ++ p2sh32 locking bytecode(35) = 39 bytes. A RETURNED blob uses a
  // BOUNDED bytes type so the return-event NFT encodes/decodes it via the simple length-prefix path (the generic-
  // pushdata path for UNBOUNDED bytes returns is broken cross-contract - see XContractBytesReturn.test.ts).
  private static readonly BLOB_SIZE = 39;

  visitSourceFile(node: SourceFileNode): Node {
    this.synthIfaces = [];
    this.counter = 0;
    this.structDefs = [
      ...node.structDefinitions,
      ...(node.contract ? node.contract.structDefinitions : []),
    ];
    this.typeNames = new Set();
    this.ifaceFnPtrReturns = new Map();
    for (const iface of node.interfaceDefinitions as InterfaceNode[]) {
      this.typeNames.add(iface.name);
      for (const fn of iface.functions) {
        if (fn.returnTypes[0] instanceof FunctionType && (fn.returnTypes[0] as FunctionType).isExternal) {
          // Record the fn-ptr type (for the receiver's synth call) + retype the interface return to the bounded
          // blob, so a cross-contract call to it yields the blob (matching the implementation's blob return).
          this.ifaceFnPtrReturns.set(`${iface.name}.${fn.name}`, fn.returnTypes[0] as FunctionType);
          fn.returnTypes[0] = new BytesType(LowerBlobFunctionPointers.BLOB_SIZE);
        }
      }
    }
    for (const c of node.importedContracts as ContractNode[]) this.typeNames.add(c.name);
    if (node.contract) this.typeNames.add(node.contract.name);
    if (node.contract) node.contract = this.visitContract(node.contract) as ContractNode;
    for (const iface of this.synthIfaces) node.interfaceDefinitions.push(iface);
    return node;
  }

  visitContract(node: ContractNode): Node {
    // Remaining fn-ptr struct fields (the fixed-method ones were already lowered to interface-typed) are the
    // received-value case: represent them as a bytes blob.
    this.blobFields = new Map();
    const blobParams = new Set<string>();
    for (const sd of this.structDefs) {
      for (const f of sd.fields) {
        if (f.type instanceof FunctionType && (f.type as FunctionType).isExternal) {
          const iface = this.synthInterface(f.type as FunctionType);
          this.blobFields.set(f.name, { iface });
          f.type = new BytesType();
        }
      }
    }
    // A fn that RETURNS a fn-ptr (and reached here = not inlined by InlineForeignFunctionPointerReturns) returns
    // a bytes BLOB; a fn-ptr LOCAL assigned such a call is a blob too.
    this.blobReturnFns = new Map();
    for (const fn of node.functions) {
      if (!(fn.returnTypes[0] instanceof FunctionType) || !(fn.returnTypes[0] as FunctionType).isExternal) continue;
      // Only lower a fn whose return is a FOREIGN member `IFace(a).m` to a blob; a self-ref `this.g` stays a
      // functionId (the existing self-ref return path), and a param passthrough is left untouched.
      const stmts = fn.body?.statements ?? [];
      const last = stmts[stmts.length - 1];
      if (!(last instanceof ReturnNode) || last.expressions.length !== 1 || !this.foreignMember(last.expressions[0])) {
        continue;
      }
      this.blobReturnFns.set(fn.name, { iface: this.synthInterface(fn.returnTypes[0] as FunctionType) });
      fn.returnTypes[0] = new BytesType(LowerBlobFunctionPointers.BLOB_SIZE);
    }
    this.blobLocals = new Map();
    for (const fn of node.functions) {
      if (!fn.body) continue;
      this.collectBlobLocals(fn.body);
    }

    if (this.blobFields.size === 0 && this.blobReturnFns.size === 0 && this.blobLocals.size === 0) return node;

    // A param stored into a blob field (a struct constructor arg at a blob-field position) is itself a blob.
    const bodies = [node.constructorDef, ...node.functions, node.fallbackDef, node.receiveDef]
      .filter((f): f is FunctionDefinitionNode => !!f?.body);
    for (const fn of bodies) {
      this.collectBlobParams(fn, blobParams);
    }
    for (const fn of node.functions) {
      for (const p of fn.parameters) {
        if (p.type instanceof FunctionType && (p.type as FunctionType).isExternal && blobParams.has(`${fn.name}.${p.name}`)) {
          p.type = new BytesType();
        }
      }
    }

    node.constructorDef = this.rewrite(node.constructorDef);
    node.functions = node.functions.map((f) => this.rewrite(f)!);
    node.fallbackDef = this.rewrite(node.fallbackDef);
    node.receiveDef = this.rewrite(node.receiveDef);
    return node;
  }

  // Record `<fn>.<param>` for each fn-ptr param passed at a blob-field position of a struct constructor.
  private collectBlobParams(fn: FunctionDefinitionNode, out: Set<string>): void {
    const paramNames = new Set(fn.parameters.map((p) => p.name));
    const walk = (n: Node): void => {
      if (n instanceof FunctionCallNode && n.identifier instanceof IdentifierNode) {
        const sd = this.structDefs.find((s) => s.name === (n.identifier as IdentifierNode).name);
        if (sd) {
          sd.fields.forEach((field, pos) => {
            const arg = n.parameters[pos];
            if (this.blobFields.has(field.name) && arg instanceof IdentifierNode && paramNames.has(arg.name)) {
              out.add(`${fn.name}.${arg.name}`);
            }
          });
        }
      }
      for (const key of Object.keys(n)) {
        const val = (n as unknown as Record<string, unknown>)[key];
        if (val instanceof Node) walk(val);
        else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) walk(v);
      }
    };
    walk(fn.body!);
  }

  private rewrite(fn: FunctionDefinitionNode | undefined): FunctionDefinitionNode | undefined {
    if (fn?.body) {
      this.inBlobReturnFn = this.blobReturnFns.has(fn.name);
      fn.body = this.visit(fn.body) as typeof fn.body;
      this.inBlobReturnFn = false;
    }
    return fn;
  }

  // A fn-ptr LOCAL assigned a blob-returning call is a bytes blob: `p = getPtr(a)` (a same-contract blob-return
  // fn) or `p = IA(a).getPtr(t)` (a CROSS-CONTRACT external call whose interface method returns a fn-ptr).
  private collectBlobLocals(node: Node): void {
    const walk = (n: Node): void => {
      if (n instanceof VariableDefinitionNode && n.type instanceof FunctionType && (n.type as FunctionType).isExternal) {
        let iface: string | undefined;
        if (n.expression instanceof FunctionCallNode && n.expression.identifier instanceof IdentifierNode) {
          iface = this.blobReturnFns.get(n.expression.identifier.name)?.iface;
        } else if (n.expression instanceof MethodCallNode && n.expression.object instanceof FunctionCallNode
            && n.expression.object.identifier instanceof IdentifierNode
            && n.expression.object.parameters.length === 1) {
          const ft = this.ifaceFnPtrReturns.get(`${n.expression.object.identifier.name}.${n.expression.methodName}`);
          if (ft) iface = this.synthInterface(ft);
        }
        if (iface) { this.blobLocals.set(n.name, { iface }); n.type = new BytesType(LowerBlobFunctionPointers.BLOB_SIZE); }
      }
      for (const key of Object.keys(n)) {
        const val = (n as unknown as Record<string, unknown>)[key];
        if (val instanceof Node) walk(val);
        else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) walk(v);
      }
    };
    walk(node);
  }

  // In a blob-returning fn, `return IFace(a).m` -> `return IFace.m.selector + a` (build the blob); a blob
  // local/param return is already bytes.
  visitReturn(node: ReturnNode): Node {
    if (this.inBlobReturnFn && node.expressions.length === 1) {
      const m = this.foreignMember(node.expressions[0]);
      if (m) node.expressions[0] = this.buildBlob(m.iface, m.method, m.address, node);
    }
    node.expressions = node.expressions.map((e) => this.visit(e) as ExpressionNode);
    return node;
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

  // `s.fn(args)` (blob field) / `p(args)` (blob local) -> slice the blob into address + selector locals, dispatch
  // the synth call.
  visitFunctionCall(node: FunctionCallNode): Node {
    const name = node.identifier.name;
    const local = this.blobLocals.get(name);
    if (local) {
      const read = new IdentifierNode(name); read.location = node.location;
      return this.emitBlobCall(read, local.iface, node);
    }
    const dot = name.indexOf('.');
    if (dot > 0) {
      const field = name.slice(dot + 1);
      const info = this.blobFields.get(field);
      if (info && field.indexOf('.') < 0) {
        const base = new IdentifierNode(name.slice(0, dot)); base.location = node.location;
        const fieldRead = new FieldAccessNode(base, field); fieldRead.location = node.location;
        return this.emitBlobCall(fieldRead, info.iface, node);
      }
    }
    return super.visitFunctionCall(node);
  }

  // `IFace(addr).method` -> its parts (used to build the return blob).
  private foreignMember(expr: ExpressionNode): { iface: string; method: string; address: ExpressionNode } | undefined {
    if (!(expr instanceof FieldAccessNode)) return undefined;
    const base = expr.expression;
    if (!(base instanceof FunctionCallNode) || !(base.identifier instanceof IdentifierNode)) return undefined;
    if (base.parameters.length !== 1 || !this.typeNames.has(base.identifier.name)) return undefined;
    return { iface: base.identifier.name, method: expr.name, address: base.parameters[0] };
  }

  // `IFace.method.selector + address` (bytes blob = selector(4) ++ address).
  private buildBlob(iface: string, method: string, address: ExpressionNode, at: Node): ExpressionNode {
    const ifaceId = this.id(iface, at);
    const methodAccess = new FieldAccessNode(ifaceId, method); methodAccess.location = at.location;
    const selector = new FieldAccessNode(methodAccess, 'selector'); selector.location = at.location;
    const cat = new BinaryOpNode(selector, BinaryOperator.PLUS, address); cat.location = at.location;
    // Fix the blob to the bounded size so the return-event NFT uses the simple length-prefix encode/decode.
    const bounded = new CastNode(new BytesType(LowerBlobFunctionPointers.BLOB_SIZE), cat, false);
    bounded.location = at.location;
    return bounded;
  }

  visitFunctionCallStatement(node: FunctionCallStatementNode): Node {
    const result = this.visit(node.call);
    if (result instanceof MethodCallNode) {
      const stmt = new MethodCallStatementNode(result); stmt.location = node.location; return stmt;
    }
    node.call = result as FunctionCallNode;
    return node;
  }

  // Hoist `bytes __b = <blob>; bytes __a = __b.split(4)[1];` and build `__FnPtr(__a).__call(args)` with a runtime
  // selector `bytes4(__b.split(4)[0])` + fnPtrCall (via the __FnPtr_ interface name the collect phase matches).
  private emitBlobCall(blob: ExpressionNode, iface: string, at: Node): MethodCallNode {
    const uniq = `${this.counter}_${this.hoists.length}`;
    const blobName = `__fpblob_${uniq}`;
    const addrName = `__fpaddr_${uniq}`;
    const selName = `__fpsel_${uniq}`;
    const blobDef = new VariableDefinitionNode(new BytesType(), [], blobName, blob);
    blobDef.location = at.location; this.hoists.push(blobDef);
    const addrDef = new VariableDefinitionNode(new BytesType(), [], addrName,
      this.splitIndex(this.id(blobName, at), 1, at));
    addrDef.location = at.location; this.hoists.push(addrDef);
    const selInit = new CastNode(new BytesType(4), this.splitIndex(this.id(blobName, at), 0, at), false);
    selInit.location = at.location;
    const selDef = new VariableDefinitionNode(new BytesType(4), [], selName, selInit);
    selDef.location = at.location; this.hoists.push(selDef);

    const ifaceId = this.id(iface, at);
    const cast = new FunctionCallNode(ifaceId, [this.id(addrName, at)]); cast.location = at.location;
    const args = (at as FunctionCallNode).parameters.map((a) => this.visit(a) as ExpressionNode);
    const mc = new MethodCallNode(cast, '__call', args); mc.location = at.location;
    mc.runtimeSelector = this.id(selName, at);
    return mc;
  }

  // `<expr>.split(4)[index]`
  private splitIndex(expr: ExpressionNode, index: number, at: Node): ExpressionNode {
    const four = new IntLiteralNode(4n); four.location = at.location;
    const split = new BinaryOpNode(expr, BinaryOperator.SPLIT, four); split.location = at.location;
    const idx = new TupleIndexOpNode(split, index); idx.location = at.location;
    return idx;
  }

  private id(name: string, at: Node): IdentifierNode {
    const n = new IdentifierNode(name); n.location = at.location; return n;
  }

  private synthInterface(ft: FunctionType): string {
    const sig = ft.toString();
    const existing = this.synthIfaces.find((i) => (i as InterfaceNode & { __sig?: string }).__sig === sig);
    if (existing) return existing.name;
    const name = `__FnPtr_B${this.counter++}`;
    const params = ft.parameterTypes.map((t, i) => new ParameterNode(t, `p${i}`));
    const method = new InterfaceFunctionNode('__call', params, ft.returnTypes);
    const iface = new InterfaceNode(name, [], [], [method]);
    (iface as InterfaceNode & { __sig?: string }).__sig = sig;
    this.synthIfaces.push(iface);
    return name;
  }
}
