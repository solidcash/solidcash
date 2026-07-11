import {
  Node,
  SourceFileNode,
  ContractNode,
  InterfaceNode,
  StructDefinitionNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  MethodCallNode,
  MethodCallStatementNode,
  FieldAccessNode,
  IdentifierNode,
  ExpressionNode,
} from '../ast/AST.js';
import { FunctionType, AddressType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/**
 * FOREIGN external function-pointer STRUCT FIELDS that hold a fixed method on a runtime address (the nested
 * analogue of LowerForeignFunctionPointerVars). A `struct S { function(P) external fn; ... }` whose every stored
 * value is `IFace(a).method` (same interface + method, varying address) is equivalent to an interface-typed
 * field + the audited struct-field-chain external call:
 *
 *   struct S { function(pubkey,sig) external fn; }        struct S { IFace fn; }
 *   this.s.fn = IFace(a).m;   // -> S(IFace(a).m)    ->    this.s = S(IFace(a));
 *   s.fn(args)                                             s.fn.m(args)         // shipped `s.field.m()`
 *
 * so it reduces to the already-shipped interface-typed struct-field call (SynthesizeExternalAddressLocals hoists
 * `s.fn` to `__extaddr_s_fn`). Sound by reduction to that tested form. Lowered only when a field name maps to a
 * SINGLE consistent (interface, method) across the whole contract (a varying method / received value / ambiguous
 * name is left unclassified for the general blob case - future). v1: fixed-method struct fields.
 */
export default class LowerForeignFunctionPointerStructFields extends AstTraversal {
  private typeNames = new Set<string>();
  private structDefs: StructDefinitionNode[] = [];
  // fn-ptr field name -> its fixed (interface, method) + the owning struct field position(s)
  private lowered = new Map<string, { iface: string; method: string }>();
  // field name -> the positions it occupies in each owning struct (for constructor-arg rewrites)
  private fieldPositions = new Map<string, Set<number>>();

  visitSourceFile(node: SourceFileNode): Node {
    this.typeNames = new Set();
    for (const iface of node.interfaceDefinitions as InterfaceNode[]) this.typeNames.add(iface.name);
    for (const c of node.importedContracts as ContractNode[]) this.typeNames.add(c.name);
    if (node.contract) this.typeNames.add(node.contract.name);
    this.structDefs = [
      ...node.structDefinitions,
      ...(node.contract ? node.contract.structDefinitions : []),
    ];
    if (node.contract) node.contract = this.visitContract(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    // Candidate fn-ptr struct fields, keyed by field name (call sites `x.field(..)` are name-addressed).
    const candidates = new Map<string, { iface: string; method: string } | null>();
    this.fieldPositions = new Map();
    for (const sd of this.structDefs) {
      sd.fields.forEach((f, pos) => {
        if (!(f.type instanceof FunctionType) || !(f.type as FunctionType).isExternal) return;
        if (!candidates.has(f.name)) candidates.set(f.name, undefined as never);
        const set = this.fieldPositions.get(f.name) ?? new Set<number>();
        set.add(pos); this.fieldPositions.set(f.name, set);
      });
    }
    if (candidates.size === 0) return node;

    // Classify each candidate: scan every struct constructor's arg at the field position for a consistent
    // `IFace(a).method`. A mismatch/absence marks the field null (unclassifiable).
    const seen = new Map<string, { iface: string; method: string } | null>();
    const walk = (n: Node): void => {
      if (n instanceof FunctionCallNode && n.identifier instanceof IdentifierNode) {
        const sd = this.structDefs.find((s) => s.name === (n.identifier as IdentifierNode).name);
        if (sd) {
          sd.fields.forEach((f, pos) => {
            if (!this.fieldPositions.has(f.name)) return;
            const arg = n.parameters[pos];
            const m = arg ? this.foreignMember(arg) : undefined;
            if (m) {
              const prev = seen.get(f.name);
              if (prev === null) return;
              if (!prev) seen.set(f.name, m);
              else if (prev.iface !== m.iface || prev.method !== m.method) seen.set(f.name, null);
            } else if (arg && !this.isSameFieldRead(arg, f.name)) {
              // A non-foreignMember, non-preserving value (received ptr, copy from elsewhere) -> not fixed-method.
              seen.set(f.name, null);
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
    const bodies = [node.constructorDef, ...node.functions, node.fallbackDef, node.receiveDef];
    for (const fn of bodies) if (fn?.body) walk(fn.body);

    this.lowered = new Map();
    for (const [name, target] of seen) if (target) this.lowered.set(name, target);
    if (this.lowered.size === 0) return node;

    // Retype each lowered field to its interface-typed address in every struct that declares it.
    for (const sd of this.structDefs) {
      for (const f of sd.fields) {
        const t = this.lowered.get(f.name);
        if (t && f.type instanceof FunctionType) f.type = new AddressType(false, t.iface);
      }
    }

    node.constructorDef = this.rewrite(node.constructorDef);
    node.functions = node.functions.map((f) => this.rewrite(f)!);
    node.fallbackDef = this.rewrite(node.fallbackDef);
    node.receiveDef = this.rewrite(node.receiveDef);
    return node;
  }

  private rewrite<T extends { body?: unknown } | undefined>(fn: T): T {
    if (fn?.body) (fn as { body: unknown }).body = this.visit((fn as { body: Node }).body);
    return fn;
  }

  // `s.field(args)` -> `s.field.method(args)`; a struct constructor's fixed-method arg `IFace(a).m` -> `IFace(a)`.
  visitFunctionCall(node: FunctionCallNode): Node {
    const name = node.identifier.name;
    const dot = name.indexOf('.');
    if (dot > 0) {
      const field = name.slice(dot + 1);
      const t = this.lowered.get(field);
      if (t && field.indexOf('.') < 0) { // single-level `base.field` only (v1)
        const base = new IdentifierNode(name.slice(0, dot)); base.location = node.location;
        const recv = new FieldAccessNode(base, field); recv.location = node.location;
        const args = node.parameters.map((a) => this.visit(a) as ExpressionNode);
        const mc = new MethodCallNode(recv, t.method, args); mc.location = node.location;
        return mc;
      }
    }
    // Struct constructor: drop `.method` off any lowered field arg (the field is now interface-typed).
    const sd = this.structDefs.find((s) => s.name === name);
    if (sd) {
      node.parameters = node.parameters.map((arg, pos) => {
        const f = sd.fields[pos];
        if (f && this.lowered.has(f.name)) {
          const m = this.foreignMember(arg);
          if (m) {
            return cloneNode((arg as FieldAccessNode).expression) as ExpressionNode; // IFace(a).m -> IFace(a)
          }
        }
        return this.visit(arg) as ExpressionNode;
      });
      return node;
    }
    return super.visitFunctionCall(node);
  }

  // A bare `s.field(args);` statement: the rewritten call is a MethodCall, so re-wrap the statement to match.
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

  private foreignMember(expr: ExpressionNode): { iface: string; method: string } | undefined {
    if (!(expr instanceof FieldAccessNode)) return undefined;
    const base = expr.expression;
    if (!(base instanceof FunctionCallNode) || !(base.identifier instanceof IdentifierNode)) return undefined;
    if (base.parameters.length !== 1 || !this.typeNames.has(base.identifier.name)) return undefined;
    return { iface: base.identifier.name, method: expr.name };
  }

  // A constructor arg that reads the SAME struct field (a preserving reconstruction, e.g. `S(this.s.fn, newX)`).
  private isSameFieldRead(expr: ExpressionNode, field: string): boolean {
    return expr instanceof FieldAccessNode && expr.name === field;
  }
}
