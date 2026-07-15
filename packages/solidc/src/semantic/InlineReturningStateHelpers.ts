import {
  ContractNode,
  FunctionDefinitionNode,
  SourceFileNode,
  Node,
  StatementNode,
  BlockNode,
  VariableDefinitionNode,
  IdentifierNode,
  FieldAccessNode,
  ExpressionNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  ExpressionStatementNode,
  ReturnNode,
  MappingAccessNode,
  ArrayAccessNode,
  AssignNode,
  StateAccessNode,
  StateAssignNode,
  WhileNode,
  DoWhileNode,
  TernaryOpNode,
  BinaryOpNode,
  TupleAssignmentNode,
  LowLevelCallNode,
  LowLevelCallStatementNode,
  MethodCallNode,
  CastNode,
  AbiEncodeCallNode,
} from '../ast/AST.js';
import { collectAmbiguousInlineKeys, inlineKey } from './inlineOverloadGuard.js';
import { AmbiguousInlineOverloadError } from '../Errors.js';
import { StructType, AddressType } from '@solidcash/utils';
import { Modifier } from '../ast/Globals.js';
import { BinaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { substituteInFunction } from './InheritanceExpansionTransformation.js';
import { tagModifierStateAccess } from './ModifierExpansionTransformation.js';

/**
 * Inlines internal/private functions that RETURN a value and READ a state entry (a mapping/collection
 * element). Entry-access input slots live only in an entry-point's block layout, so such a function cannot
 * compile as an OP_INVOKE subroutine ("Block layout not available"). The sibling InlineStoragePointerCalls
 * pass handles the VOID case at statement call sites; this handles the RETURNING case at EXPRESSION call
 * sites by hoisting the callee body before the enclosing statement and replacing the call with a temp:
 *
 * ```
 * function f() external view returns (uint) { return earned[a] + _calc(a); }
 * function _calc(address a) private view returns (uint) { uint s = bal[a]; return s * idx; }
 * ->
 * function f() external view returns (uint) {
 *   address __rh0_a = a; uint __rh0_s = bal[__rh0_a]; uint __rh0__ret = __rh0_s * idx;
 *   return earned[a] + __rh0__ret;
 * }
 * ```
 *
 * Runs pre-semantic (before InlineStoragePointerCalls). Restricted to single-tail-return helpers; hoisting is
 * suppressed at conditionally-evaluated positions (loop conditions, ternary branches, short-circuit right
 * operands) to preserve revert/effect semantics. An un-hoistable call keeps its helper.
 */
const PREFIX = '__rh';

export default class InlineReturningStateHelpers extends AstTraversal {
  private funcByName: Map<string, FunctionDefinitionNode> = new Map();
  private funcByKey: Map<string, FunctionDefinitionNode> = new Map(); // keyed by inlineKey(name, arity) for overloads
  private ambiguousInlineKeys: Set<string> = new Set(); // H8: <name>/<arity> shared by >1 overload.
  private inlinedFns: Set<string> = new Set();
  private collectionNames: Set<string> = new Set();
  private freeFns: FunctionDefinitionNode[] = [];
  private stillCalled: Set<string> = new Set();
  private stateVarNames: Set<string> = new Set();
  private freeFnRefs: Set<string> = new Set(); // names called from within another free-function body
  private keepDefFns: Set<string> = new Set();
  private counter = 0;
  private hoists: StatementNode[] = [];
  private stack: string[] = [];
  private suppress = false;

  visitSourceFile(node: SourceFileNode): Node {
    this.freeFns = node.freeFunctions ?? [];
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    // A struct storage-pointer value helper (`get`/`size`) is inlined at every expression call site and cannot
    // stand alone (its `map__field` accesses are dangling until renamed to the caller's `<arg>__field`), so drop
    // the fully-inlined ones. Kept if a call remained in a suppressed (conditionally-evaluated) position, OR if it
    // is still referenced from another free-function body (freeFnRefs, qualified+bare) - a low-level-call helper in
    // an un-inlined chain (functionCall -> functionCallWithValue) must stay a subroutine there, not dangle.
    node.freeFunctions = (node.freeFunctions ?? [])
      .filter((f) => !this.inlinedFns.has(f.name) || this.stillCalled.has(f.name) || this.freeFnRefs.has(f.name));
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.funcByName = new Map();
    this.funcByKey = new Map();
    for (const fn of [...node.functions, ...this.freeFns]) {
      this.funcByName.set(fn.name, fn);
      this.funcByKey.set(inlineKey(fn.name, fn.parameters.length), fn);
    }
    this.qualifySiblingCalls();
    this.ambiguousInlineKeys = collectAmbiguousInlineKeys([...node.functions, ...this.freeFns]);
    this.collectionNames = new Set(node.collections.map((c) => c.name));
    this.stateVarNames = new Set(node.stateVariables.map((sv) => sv.name));

    this.inlinedFns = new Set();
    this.keepDefFns = new Set();
    // A function used as a VALUE (function pointer) must keep a real definition; exclude such names from
    // the state-touching criteria (its call SITES stay subroutine calls, matching prior behavior).
    const valueReferenced = this.collectValueReferencedNames(node);
    for (const fn of node.functions) {
      if ((this.eligible(fn) && !valueReferenced.has(fn.name)) || this.eligibleStructPtr(fn)) {
        this.inlinedFns.add(fn.name);
      }
    }
    // State-touching returning ENTRY POINTS called internally have the same subroutine problem; inline the
    // internal call sites but keep the definition (still dispatchable).
    for (const fn of node.functions) {
      if (!this.inlinedFns.has(fn.name) && !valueReferenced.has(fn.name) && this.eligibleShape(fn)
        && (this.readsEntry(fn) || this.touchesScalarState(fn))) {
        this.inlinedFns.add(fn.name);
        this.keepDefFns.add(fn.name);
      }
    }
    // The fallback is internally callable via the self low-level-call lowering; a state-touching returning
    // fallback must inline at those call sites (its definition always stays - it is a dispatched entry point).
    if (node.fallbackDef && this.eligibleShape(node.fallbackDef)
      && (this.readsEntry(node.fallbackDef) || this.touchesScalarState(node.fallbackDef))) {
      this.funcByName.set(node.fallbackDef.name, node.fallbackDef);
      this.funcByKey.set(inlineKey(node.fallbackDef.name, node.fallbackDef.parameters.length), node.fallbackDef);
      this.inlinedFns.add(node.fallbackDef.name);
      this.keepDefFns.add(node.fallbackDef.name);
    }
    // Names called from within another free-function body. Free-function bodies are NOT inline-processed, so
    // inlining+dropping a low-level-call helper reached that way (e.g. OZ `functionCall` -> `functionCallWithValue`)
    // would leave a dangling reference in the un-inlined caller. Restrict such inlining to helpers reached only
    // from inlinable sites (contract bodies / using-for), leaving chain helpers to fail as before (not worse).
    this.freeFnRefs = new Set();
    for (const fn of this.freeFns) {
      const dot = fn.name.lastIndexOf('.');
      const libPrefix = dot >= 0 ? fn.name.slice(0, dot + 1) : ''; // e.g. 'Address.'
      this.walk(fn.body, (n) => {
        if (n instanceof FunctionCallNode) {
          const called = n.identifier.name;
          this.freeFnRefs.add(called);
          // A same-library sibling is called unqualified (`functionCallWithValue`); record its qualified form.
          if (libPrefix && !called.includes('.')) this.freeFnRefs.add(libPrefix + called);
        }
      });
    }
    // Library free-functions are inlined here as struct storage-pointer value helpers, or (like OZ Address's
    // `functionCall`) as single-tail-return helpers containing a low-level call; other library functions keep
    // their own (delegate) machinery.
    for (const fn of this.freeFns) {
      if (this.eligibleStructPtr(fn)) this.inlinedFns.add(fn.name);
      else if (this.eligibleShape(fn) && this.transitivelyContainsLowLevelCall(fn)) {
        this.inlinedFns.add(fn.name);
      }
    }
    if (this.inlinedFns.size === 0) return node;

    // The general using-for member dispatch runs later (SymbolTableTraversal), but a low-level-call helper must
    // be inlined HERE (it can't be a subroutine). So pre-desugar `address(EXPR).method(args)` with `using L for
    // address` (L.method an inline-eligible low-level-call helper) to `L.method(address(EXPR), args)` first.
    this.desugarLowLevelUsingForAddressCalls(node);

    const bodies = [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef];
    for (const fn of bodies) {
      if (fn?.body) {
        this.stack = [inlineKey(fn.name, fn.parameters.length)];
        fn.body = this.visit(fn.body) as BlockNode;
      }
    }
    // Drop a helper only if every call site was inlined (none left in a suppressed/un-hoistable position).
    const stillCalled = new Set<string>();
    for (const fn of bodies) {
      if (fn?.body) {
        this.walk(fn.body, (n) => {
          if (n instanceof FunctionCallNode && this.inlinedFns.has(n.identifier.name)) {
            stillCalled.add(n.identifier.name);
          }
        });
      }
    }
    this.stillCalled = stillCalled;
    node.functions = node.functions.filter(
      (fn) => !this.inlinedFns.has(fn.name) || stillCalled.has(fn.name) || this.keepDefFns.has(fn.name),
    );
    return node;
  }

  // The structural half of `eligible`: single-tail-return, no storage params (visibility-agnostic).
  private eligibleShape(fn: FunctionDefinitionNode): boolean {
    if (!fn.body || fn.returnTypes.length < 1) return false;
    if (fn.parameters.some((p) => p.modifier.includes(Modifier.STORAGE))) return false;
    const stmts = fn.body.statements ?? [];
    const last = stmts[stmts.length - 1];
    if (!(last instanceof ReturnNode)) return false;
    // The final return must be 1:1 with the declared return types, so a multi-value helper returns `(a, b)` (each
    // split into a temp) rather than a nested tuple-forward `return g()` which can't be split.
    if (last.expressions.length !== fn.returnTypes.length) return false;
    let returns = 0;
    this.walk(fn.body, (n) => { if (n instanceof ReturnNode) returns += 1; });
    if (returns !== 1) return false; // a mid-body return can't linearize into a hoisted prelude
    return true;
  }

  private eligible(fn: FunctionDefinitionNode): boolean {
    if (!(fn.isFreeFunction || fn.visibility === 'private' || fn.visibility === 'internal')) return false;
    if (!this.eligibleShape(fn)) return false;
    return this.readsEntry(fn) || this.touchesScalarState(fn) || this.containsLowLevelCall(fn)
      || this.containsExternalCall(fn);
  }

  // Contains an EXTERNAL contract call (`unicrow.getEscrow(id)` / `token.balanceOf(a)` / `this.f(x)`): pre-semantic
  // this is a DOTTED FunctionCall whose full name is NOT a known internal/library function (those are in funcByName)
  // - i.e. the receiver is a state var / param / `this`, an interface/contract-typed value. Like a low-level call
  // it injects the external-call covenant param (input index / return slot), threaded only at an entry point, so a
  // subroutine holding one cannot forward it and must inline at its (expression) call site. `super.` inheritance
  // calls are internal (excluded); low-level `.call` is handled by containsLowLevelCall. A cast-receiver form
  // `IFoo(a).m()` parses to a MethodCall, caught too.
  private containsExternalCall(fn: FunctionDefinitionNode): boolean {
    const isLL = (m: string): boolean => m === 'call' || m === 'staticcall' || m === 'delegatecall';
    let found = false;
    this.walk(fn.body, (n) => {
      if (found) return;
      if (n instanceof MethodCallNode && !isLL(n.methodName)) { found = true; return; }
      if (n instanceof FunctionCallNode) {
        const name = n.identifier.name;
        const dot = name.lastIndexOf('.');
        if (dot > 0 && !isLL(name.slice(dot + 1)) && !name.startsWith('super.') && !this.funcByName.has(name)) {
          found = true;
        }
      }
    });
    return found;
  }

  // Contains a low-level call (`a.call(d)`, `a.call{value:}(d)`, static/delegatecall). Such a call injects a
  // synthetic covenant param (__internal__callInputIndex) supplied only in an entry-point body, so a helper
  // holding one cannot compile as an OP_INVOKE subroutine and must inline at its call site (the OZ Address /
  // SafeERC20 `functionCall` shape). Value-returning and single-tail-return, it inlines like a state helper.
  private containsLowLevelCall(fn: FunctionDefinitionNode): boolean {
    const isLL = (m: string): boolean => m === 'call' || m === 'staticcall' || m === 'delegatecall';
    let found = false;
    this.walk(fn.body, (n) => {
      if (found) return;
      if (n instanceof LowLevelCallNode || n instanceof LowLevelCallStatementNode) { found = true; return; }
      // Pre-semantic, `a.call(d)` is a namespaced FunctionCall (`a.call`) and `a.call{value:}(d)` a MethodCall;
      // the dedicated LowLevelCall nodes are synthesized later in SymbolTableTraversal.
      if (n instanceof FunctionCallNode) {
        const dot = n.identifier.name.lastIndexOf('.');
        if (dot > 0 && isLL(n.identifier.name.slice(dot + 1))) found = true;
      } else if (n instanceof MethodCallNode && isLL(n.methodName)) found = true;
    });
    return found;
  }

  // True if a low-level-call helper is referenced from another free-function body (freeFnRefs already records
  // both the as-written and the same-library-qualified call names) - inlining+dropping it would dangle it.
  private referencedFromFreeFn(qualifiedName: string): boolean {
    return this.freeFnRefs.has(qualifiedName);
  }

  // Resolve a call to its exact overload by arity (name-keyed funcByName can't distinguish functionCall/2 from
  // functionCall/3). Undefined when no overload has that arity - the call is then left as-is (not inlinable).
  private lookupOverload(name: string, arity: number): FunctionDefinitionNode | undefined {
    return this.funcByKey.get(inlineKey(name, arity));
  }

  // A same-library sibling call is written unqualified (`functionCallWithValue` inside `Address.functionCall`) but
  // the function is registered qualified (`Address.functionCallWithValue`). Rewrite such calls to the qualified
  // name so detection, overload resolution, inlining and drop-tracking all resolve the real target. Safe: a
  // qualified library call is exactly how the reference resolves in semantic analysis anyway.
  private qualifySiblingCalls(): void {
    for (const fn of this.freeFns) {
      const dot = fn.name.lastIndexOf('.');
      if (dot < 0 || !fn.body) continue;
      const prefix = fn.name.slice(0, dot + 1);
      this.walk(fn.body, (n) => {
        if (n instanceof FunctionCallNode && !n.identifier.name.includes('.')
          && this.funcByName.has(prefix + n.identifier.name)) {
          n.identifier.name = prefix + n.identifier.name;
        }
      });
    }
  }

  // Transitive containsLowLevelCall: a wrapper that only CALLS another eligible-shape helper which (transitively)
  // does a low-level call must inline too, else it stays a subroutine calling a callee that needs the synthetic
  // covenant param it never forwards (OZ Address.functionCall -> ...WithValue -> target.call). Cycle-guarded by
  // name; funcByName resolves the exact overload by arity.
  private transitivelyContainsLowLevelCall(fn: FunctionDefinitionNode, seen: Set<string> = new Set()): boolean {
    if (this.containsLowLevelCall(fn)) return true;
    if (seen.has(fn.name)) return false;
    seen.add(fn.name);
    let found = false;
    this.walk(fn.body, (n) => {
      if (found || !(n instanceof FunctionCallNode)) return;
      const callee = this.lookupOverload(n.identifier.name, n.parameters.length);
      if (callee && callee !== fn && this.eligibleShape(callee)
        && this.transitivelyContainsLowLevelCall(callee, seen)) found = true;
    });
    return found;
  }

  // Rewrite `address(EXPR).method(args)` -> `L.method(address(EXPR), args)` for `using L for address` where
  // L.method is an inline-eligible low-level-call helper, so the returning-helper inliner (which works on
  // FunctionCalls) picks it up. Positional-arg, option-less calls only; the general using-for path (later, in
  // SymbolTableTraversal) still handles every other member-dispatch shape.
  private desugarLowLevelUsingForAddressCalls(node: ContractNode): void {
    const bound = new Map<string, string>(); // method name -> `L.method`
    for (const d of node.usingForDirectives ?? []) {
      if (!d.libraryName || d.targetTypeName !== 'address') continue;
      const prefix = `${d.libraryName}.`;
      for (const fn of this.freeFns) {
        // Transitive: `address(x).functionCall(d)` on OZ Address.functionCall (which only transitively does a
        // low-level call, via functionCallWithValue) must convert too, else it stays a MethodCall the
        // returning-helper inliner cannot pick up and the helper is dropped out from under it.
        if (fn.name.startsWith(prefix) && this.eligibleShape(fn) && this.transitivelyContainsLowLevelCall(fn)) {
          bound.set(fn.name.slice(prefix.length), fn.name);
        }
      }
    }
    if (bound.size === 0) return;
    const bodies = [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef];
    for (const fn of bodies) {
      if (fn?.body) {
        this.transformNodes(fn.body, (n) => {
          if (n instanceof MethodCallNode && !n.callOptions && !n.fieldNames
            && n.object instanceof CastNode && n.object.type instanceof AddressType && bound.has(n.methodName)) {
            const call = new FunctionCallNode(new IdentifierNode(bound.get(n.methodName)!), [n.object, ...n.parameters]);
            call.location = n.location;
            return call;
          }
          return n;
        });
      }
    }
  }

  // In-place child-replacing walk: apply `xform` to each child Node, substituting the returned node when changed.
  private transformNodes(node: Node, xform: (n: Node) => Node): void {
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      if (v instanceof Node) {
        const rep = xform(v);
        (node as unknown as Record<string, unknown>)[key] = rep;
        this.transformNodes(rep, xform);
      } else if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i += 1) {
          if (v[i] instanceof Node) {
            const rep = xform(v[i]);
            v[i] = rep;
            this.transformNodes(rep, xform);
          }
        }
      }
    }
  }

  // Names referenced as VALUES: an IdentifierNode occurrence that is not the identifier of a plain call.
  // Such a function is used as a function pointer and must stay a real (subroutine) definition.
  private collectValueReferencedNames(node: ContractNode): Set<string> {
    const callIdentifiers = new Set<Node>();
    const referenced = new Set<string>();
    const bodies = [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef];
    for (const fn of bodies) {
      if (!fn?.body) continue;
      this.walk(fn.body, (n) => {
        if (n instanceof FunctionCallNode && n.identifier) callIdentifiers.add(n.identifier);
      });
      this.walk(fn.body, (n) => {
        if (n instanceof IdentifierNode && !callIdentifiers.has(n)) referenced.add(n.name);
      });
    }
    return referenced;
  }

  // Reads or writes a plain (scalar) state variable: a `this.x` access/assign OF A DECLARED STATE VAR (a
  // bare `s.x = v` on a named return desugars to a state-assign node that SymbolTable later resolves
  // contextually - the name gate keeps those out), or a bare identifier read/assign of a state-var name
  // that is NOT shadowed by a param/local (a shadowed match would alpha-rename-break the clone). A
  // subroutine's scalar accesses are invisible to the entry traversal's commitment model, so real ones
  // must inline.
  private touchesScalarState(fn: FunctionDefinitionNode): boolean {
    const shadowed = new Set(fn.parameters.map((p) => p.name));
    this.walk(fn.body, (n) => { if (n instanceof VariableDefinitionNode) shadowed.add(n.name); });
    let found = false;
    this.walk(fn.body, (n) => {
      if (found) return;
      if ((n instanceof StateAccessNode || n instanceof StateAssignNode) && this.stateVarNames.has(n.name)) {
        found = true;
      } else if (n instanceof IdentifierNode && this.stateVarNames.has(n.name) && !shadowed.has(n.name)) {
        found = true;
      } else if (n instanceof AssignNode && this.stateVarNames.has(n.identifier.name)
        && !shadowed.has(n.identifier.name)) {
        found = true;
      }
    });
    return found;
  }

  // A single-tail-return value helper taking a STRUCT storage pointer (`get`/`size` on a `Map storage map`). It
  // reads state via the pointer (`map.values[k]` -> the caller's `<arg>__values` collection), so like a plain
  // entry-reading helper it cannot be an OP_INVOKE subroutine and must inline at its expression call site.
  private eligibleStructPtr(fn: FunctionDefinitionNode): boolean {
    if (!fn.body || fn.returnTypes.length < 1) return false;
    if (!fn.parameters.some((p) => p.modifier.includes(Modifier.STORAGE) && p.type instanceof StructType)) return false;
    const stmts = fn.body.statements ?? [];
    const last = stmts[stmts.length - 1];
    if (!(last instanceof ReturnNode)) return false;
    if (last.expressions.length !== fn.returnTypes.length) return false;
    let returns = 0;
    this.walk(fn.body, (n) => { if (n instanceof ReturnNode) returns += 1; });
    return returns === 1;
  }

  // Reads a mapping/collection element (incl. the read half of a compound write) - the access that needs an
  // entry-access input slot from the entry-point block layout.
  private readsEntry(fn: FunctionDefinitionNode): boolean {
    let found = false;
    this.walk(fn.body, (n) => {
      if (found) return;
      if (n instanceof MappingAccessNode && this.collectionNames.has(n.name)) found = true;
      else if (n instanceof ArrayAccessNode && n.array instanceof IdentifierNode
        && this.collectionNames.has(n.array.name)) found = true;
    });
    return found;
  }

  // Per statement: visit it (replacing inlined calls with temps + filling this.hoists), then emit
  // [hoists, statement]. Nested blocks recurse through the standard traversal and flush their own hoists.
  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const saved = this.hoists;
      this.hoists = [];
      const visited = this.visit(stmt) as StatementNode;
      const mine = this.hoists;
      this.hoists = saved;
      out.push(...mine, visited);
    }
    node.statements = out;
    return node;
  }

  // A call STATEMENT whose call gets expression-inlined must not keep the bare temp inside the
  // FunctionCallStatement wrapper (later passes read call.identifier); re-wrap as a dropped expression.
  visitFunctionCallStatement(node: FunctionCallStatementNode): Node {
    const result = this.visit(node.call);
    if (result instanceof FunctionCallNode) {
      node.call = result;
      return node;
    }
    const stmt = new ExpressionStatementNode(result as ExpressionNode);
    stmt.location = node.location;
    return stmt;
  }

  // A using-for named-arg call arrives as `L.f(recv, named...)` with fieldNames naming the tail; inlining
  // substitutes POSITIONALLY, so reorder the tail against the callee's params first.
  private reorderNamedTail(call: FunctionCallNode, callee: FunctionDefinitionNode): void {
    const fieldNames = call.fieldNames;
    if (!fieldNames || call.parameters.length !== callee.parameters.length
      || fieldNames.length !== callee.parameters.length - 1) return;
    const tailParams = callee.parameters.slice(1);
    if (!tailParams.every((p) => fieldNames.includes(p.name))) return;
    call.parameters = [
      call.parameters[0],
      ...tailParams.map((p) => call.parameters[1 + fieldNames.indexOf(p.name)]),
    ];
    call.fieldNames = undefined;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    node.identifier = this.visit(node.identifier) as IdentifierNode;
    node.parameters = this.visitList(node.parameters); // inner calls inlined first
    const name = node.identifier.name;
    const callee = this.lookupOverload(name, node.parameters.length) ?? this.funcByName.get(name);
    if (callee) this.reorderNamedTail(node, callee);
    if (!this.suppress && callee && this.inlinedFns.has(name)
      && !this.stack.includes(inlineKey(name, node.parameters.length))
      && node.parameters.length === callee.parameters.length
      && callee.returnTypes.length === 1) {
      if (this.ambiguousInlineKeys.has(inlineKey(name, node.parameters.length))) {
        throw new AmbiguousInlineOverloadError(node, name, node.parameters.length);
      }
      // A scalar helper inlines at an expression position, replaced by its single return temp. A multi-value
      // helper can't (one temp can't carry >1 value) - it is inlined only at a statement position, below.
      return this.inlineCall(callee, node.parameters as ExpressionNode[])[0];
    }
    return node;
  }

  // Multi-value helpers inline only where the whole call is a statement's value: `return f()` (forward the N
  // temps) and `(a, b) = f()` (per-slot RHS temps). visitBlock flushes the hoisted body before the statement.
  visitReturn(node: ReturnNode): Node {
    const temps = node.expressions.length === 1 ? this.tryInlineMultiValue(node.expressions[0]) : undefined;
    if (temps) { node.expressions = temps; return node; }
    node.expressions = this.visitList(node.expressions) as ExpressionNode[];
    return node;
  }

  visitTupleAssignment(node: TupleAssignmentNode): Node {
    if (!node.tupleExpressions && node.tuple) {
      const temps = this.tryInlineMultiValue(node.tuple);
      if (temps) { node.tupleExpressions = temps; node.tuple = undefined as unknown as ExpressionNode; return node; }
    }
    if (node.tuple) node.tuple = this.visit(node.tuple) as ExpressionNode;
    if (node.tupleExpressions) node.tupleExpressions = this.visitList(node.tupleExpressions) as ExpressionNode[];
    return node;
  }

  private tryInlineMultiValue(expr: ExpressionNode): IdentifierNode[] | undefined {
    if (this.suppress || !(expr instanceof FunctionCallNode)) return undefined;
    const name = expr.identifier.name;
    const callee = this.lookupOverload(name, expr.parameters.length) ?? this.funcByName.get(name);
    if (!callee || !this.inlinedFns.has(name) || this.stack.includes(inlineKey(name, expr.parameters.length))
      || expr.parameters.length !== callee.parameters.length || callee.returnTypes.length < 2) return undefined;
    if (this.ambiguousInlineKeys.has(inlineKey(name, expr.parameters.length))) {
      throw new AmbiguousInlineOverloadError(expr, name, expr.parameters.length);
    }
    expr.parameters = this.visitList(expr.parameters) as ExpressionNode[]; // inline nested scalar calls in args
    return this.inlineCall(callee, expr.parameters as ExpressionNode[]);
  }

  // Suppress hoisting where the call is only conditionally evaluated; hoisting it unconditionally would
  // change revert/side-effect timing. The call is left in place (and the helper kept, not dropped).
  visitWhile(node: WhileNode): Node {
    node.condition = this.withSuppressed(() => this.visit(node.condition));
    node.block = this.visit(node.block) as StatementNode;
    return node;
  }

  visitDoWhile(node: DoWhileNode): Node {
    node.condition = this.withSuppressed(() => this.visit(node.condition));
    node.block = this.visit(node.block) as StatementNode;
    return node;
  }

  visitTernaryOp(node: TernaryOpNode): Node {
    node.condition = this.visit(node.condition); // evaluated unconditionally
    node.ifTrue = this.withSuppressed(() => this.visit(node.ifTrue));
    node.ifFalse = this.withSuppressed(() => this.visit(node.ifFalse));
    return node;
  }

  visitBinaryOp(node: BinaryOpNode): Node {
    node.left = this.visit(node.left);
    if (node.operator === BinaryOperator.AND || node.operator === BinaryOperator.OR) {
      node.right = this.withSuppressed(() => this.visit(node.right)); // short-circuit: right is conditional
    } else {
      node.right = this.visit(node.right);
    }
    return node;
  }

  private withSuppressed<T>(fn: () => T): T {
    const s = this.suppress;
    this.suppress = true;
    const r = fn();
    this.suppress = s;
    return r;
  }

  // Expand one returning-helper call: push [param bindings, body-minus-return, per-value return-temp defs] to
  // this.hoists, return an identifier per return value (one for a scalar helper, N for a multi-value helper).
  private inlineCall(callee: FunctionDefinitionNode, args: ExpressionNode[]): IdentifierNode[] {
    const n = this.counter++;
    const cloned = cloneNode(callee) as FunctionDefinitionNode;

    const rename = new Map<string, string>();
    const subs = new Map<string, ExpressionNode>();
    callee.parameters.forEach((p, i) => {
      if (p.modifier.includes(Modifier.STORAGE)) {
        // A storage pointer is a compile-time reference: alias a bare state-var arg by NAME (so `map__field`
        // renames to the caller's `<arg>__field`), or substitute a complex access path by expression.
        const arg = args[i];
        if (arg instanceof IdentifierNode) rename.set(p.name, arg.name);
        else subs.set(p.name, cloneNode(arg) as ExpressionNode);
      } else {
        rename.set(p.name, `${PREFIX}${n}_${p.name}`);
      }
    });
    this.walk(cloned.body, (node) => {
      if (node instanceof VariableDefinitionNode && !rename.has(node.name) && !subs.has(node.name)) {
        rename.set(node.name, `${PREFIX}${n}_${node.name}`);
      }
      // Tuple-destructured declarations `(bool ok, bytes ret) = ...` hold their names as plain strings in
      // `elements`, not VariableDefinitionNodes; collect the freshly-declared ones so repeated inlines of two
      // helpers that both use `ok`/`ret` do not collide ("Redefinition of variable ok").
      if (node instanceof TupleAssignmentNode) {
        for (const el of node.elements) {
          if (el.name && !el.existing && !el.skip && !rename.has(el.name) && !subs.has(el.name)) {
            rename.set(el.name, `${PREFIX}${n}_${el.name}`);
          }
        }
      }
    });
    this.applyRename(cloned.body, rename);
    substituteInFunction(cloned, subs);
    // An inherited helper's body may legitimately touch its own contract's PRIVATE state; tag the inlined
    // accesses with the defining contract (same mechanism as inlined modifier bodies).
    if (callee.inheritedFrom) tagModifierStateAccess([cloned.body], callee.inheritedFrom);

    const bindings: StatementNode[] = [];
    callee.parameters.forEach((p, i) => {
      if (p.modifier.includes(Modifier.STORAGE)) return; // storage params are substituted, not bound to a value
      const def = new VariableDefinitionNode(p.type, [], rename.get(p.name)!, cloneNode(args[i]) as ExpressionNode);
      def.location = args[i].location ?? callee.location;
      bindings.push(def);
    });

    // Recursively inline nested returning-helper calls within the cloned body (visitBlock flushes their
    // hoists into the statement list). Guard against self-recursion via the stack.
    const savedStack = this.stack;
    this.stack = [...savedStack, inlineKey(callee.name, callee.parameters.length)];
    const processed = (this.visit(cloned.body) as BlockNode).statements ?? [];
    this.stack = savedStack;

    const ret = processed[processed.length - 1] as ReturnNode;
    const retDefs: VariableDefinitionNode[] = [];
    const ids: IdentifierNode[] = [];
    for (let k = 0; k < ret.expressions.length; k++) {
      const retName = `${PREFIX}${n}__ret${k}`;
      const retDef = new VariableDefinitionNode(callee.returnTypes[k], [], retName, ret.expressions[k]);
      retDef.location = callee.location;
      retDefs.push(retDef);
      const id = new IdentifierNode(retName);
      id.location = callee.location;
      ids.push(id);
    }
    this.hoists.push(...bindings, ...processed.slice(0, -1), ...retDefs);
    return ids;
  }

  private applyRename(root: Node, map: Map<string, string>): void {
    // Rename `x` (exact), `x.f` (dotted member), and `x__f` (a struct storage pointer's flattened state field,
    // e.g. `map__values` -> `<arg>__values`) so the inlined body targets the caller's flattened collections.
    const rn = (name: string): string => {
      const dot = name.indexOf('.');
      if (dot > 0 && map.has(name.slice(0, dot))) return map.get(name.slice(0, dot))! + name.slice(dot);
      const us = name.indexOf('__');
      if (us > 0 && map.has(name.slice(0, us))) return map.get(name.slice(0, us))! + name.slice(us);
      return map.get(name) ?? name;
    };
    this.walk(root, (n) => {
      if (n instanceof IdentifierNode) {
        n.name = rn(n.name);
      } else if (n instanceof FieldAccessNode) {
        // n.name is a STRUCT FIELD MEMBER, never a variable - never rename it. The base `expression` is still
        // walked as a child, so a renamed receiver is applied there. Without this guard, an inlined local that
        // shares a struct field's name (Unicrow `uint16 arbitratorFee` vs `arbitrator.arbitratorFee`) corrupts
        // the field access to `arbitrator.__rhN_arbitratorFee` -> "Struct has no field __rhN_arbitratorFee".
      } else if (n instanceof TupleAssignmentNode) {
        // New element objects, not in-place mutation: cloneNode shares the plain-object `elements` across clones,
        // so mutating a name would stomp another inline frame's rename (dangling `__rhN_<slot>`).
        n.elements = n.elements.map((el) => (el.name ? { ...el, name: rn(el.name) } : el));
      } else if (n instanceof AbiEncodeCallNode) {
        // interfaceName is a VARIABLE reference (`abi.encodeCall(token.approve, ..)` - `token` is an inlined
        // param renamed to `__rh0_token`); rename it so the selector resolves. functionName is a fixed interface
        // method (never a local). rn() only maps renamed locals, so a literal `abi.encodeCall(IERC20.approve, ..)`
        // passes through unchanged. OZ SafeERC20.forceApprove is the trigger.
        n.interfaceName = rn(n.interfaceName);
      } else {
        const nm = (n as unknown as { name?: unknown }).name;
        if (typeof nm === 'string') (n as unknown as { name: string }).name = rn(nm);
      }
    });
  }

  // Pre-order walk over child Nodes (and Node arrays); skips Type/symbol-table/location fields. Also descends
  // into callOptions ({value, gas, salt} - a plain object holding ExpressionNodes) so a param referenced in a
  // low-level call's `{value: v}` gets visited (else applyRename misses it -> "Undefined reference to symbol v").
  private walk(node: Node | undefined, visit: (n: Node) => void): void {
    if (!node) return;
    visit(node);
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      if (v instanceof Node) {
        this.walk(v, visit);
      } else if (Array.isArray(v)) {
        for (const it of v) if (it instanceof Node) this.walk(it, visit);
      } else if (key === 'callOptions' && v && typeof v === 'object') {
        for (const opt of Object.values(v as unknown as Record<string, unknown>)) {
          if (opt instanceof Node) this.walk(opt, visit);
        }
      }
    }
  }
}
