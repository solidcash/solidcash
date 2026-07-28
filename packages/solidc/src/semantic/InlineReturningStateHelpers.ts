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
  MappingAssignNode,
  StateArrayAssignNode,
  MappingFieldAssignNode,
  BranchNode,
  WhileNode,
  DoWhileNode,
  UncheckedNode,
  TernaryOpNode,
  BinaryOpNode,
  UnaryOpNode,
  TupleAssignmentNode,
  LowLevelCallNode,
  LowLevelCallStatementNode,
  MethodCallNode,
  CastNode,
  AbiEncodeCallNode,
  FunctionModifier,
} from '../ast/AST.js';
import { collectAmbiguousInlineKeys, inlineKey } from './inlineOverloadGuard.js';
import {
  AmbiguousInlineOverloadError, OperatorOverloadSignatureError, UsingForInvalidFunctionReferenceError,
} from '../Errors.js';
import {
  StructType, AddressType, MappingType, ArrayType, Type, ValueType, PrimitiveType,
} from '@solidcash/utils';
import { Modifier } from '../ast/Globals.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
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
  private overloadsByKey: Map<string, FunctionDefinitionNode[]> = new Map(); // ALL overloads per (name, arity)
  private ambiguousInlineKeys: Set<string> = new Set(); // H8: <name>/<arity> shared by >1 overload.
  private inlinedFns: Set<string> = new Set();
  private collectionNames: Set<string> = new Set();
  private mappingNames: Set<string> = new Set();
  private freeFns: FunctionDefinitionNode[] = [];
  private stillCalled: Set<string> = new Set();
  private stateVarNames: Set<string> = new Set();
  private freeFnRefs: Set<string> = new Set(); // names called from within another free-function body
  private rawSlotFreeFns: Set<string> = new Set();
  private keepDefFns: Set<string> = new Set();
  private usingBoundFns: Set<string> = new Set();
  private operatorBindings: Map<string, string> = new Map(); // `${UDVT}/${operator}/${arity}` -> helper name
  private operatorFns: Set<string> = new Set();
  private counter = 0;
  private hoists: StatementNode[] = [];
  private stack: string[] = [];
  private suppress = false;
  private stateValueTypes: Map<string, Type> = new Map();
  private currentValueTypes: Map<string, Type> = new Map();

  constructor(private solidityImportCompat = false) {
    super();
  }

  visitSourceFile(node: SourceFileNode): Node {
    this.freeFns = node.freeFunctions ?? [];
    if (this.solidityImportCompat) {
      const functionCounts = new Map<string, number>();
      for (const fn of this.freeFns) {
        functionCounts.set(fn.name, (functionCounts.get(fn.name) ?? 0) + 1);
      }
      for (const directive of [
        ...(node.usingForDirectives ?? []),
        ...node.importedContracts.flatMap((contract) => contract.usingForDirectives ?? []),
        ...(node.contract.usingForDirectives ?? []),
      ]) {
        for (const binding of directive.functionBindings ?? []) {
          if (functionCounts.get(binding.funcName) !== 1) {
            throw new UsingForInvalidFunctionReferenceError(directive, binding.funcName);
          }
        }
      }
    }
    this.usingBoundFns = new Set((node.usingForDirectives ?? [])
      .flatMap((directive) => directive.functionBindings?.map((binding) => binding.funcName) ?? []));
    this.operatorBindings = new Map();
    this.operatorFns = new Set();
    this.validatePreloweredOperators(node);
    for (const directive of node.usingForDirectives ?? []) {
      if (!directive.isGlobal || !directive.targetTypeName) continue;
      for (const binding of directive.functionBindings ?? []) {
        if (!binding.operator) continue;
        const fn = (node.freeFunctions ?? []).find((candidate) => candidate.name === binding.funcName);
        if (!fn) continue;
        // Only the computed-pure-helper receiver shape needs its retained definition removed: semantic external-
        // call analysis would otherwise add covenant parameters to that standalone operator subroutine. Keep every
        // other operator definition so Solidity-negative body diagnostics (deploy/event/error/non-pure effects)
        // are still checked normally.
        if (this.containsPureInterfaceHelperReceiver(fn, node.freeFunctions ?? [])) {
          this.operatorBindings.set(
            `${directive.targetTypeName}/${binding.operator}/${fn.parameters.length}`, binding.funcName,
          );
          this.operatorFns.add(binding.funcName);
        }
      }
    }
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    // A storage-pointer value helper (`get`/`size`) is inlined at every expression call site and cannot
    // stand alone (its `map__field` accesses are dangling until renamed to the caller's `<arg>__field`), so drop
    // the fully-inlined ones. Kept if a call remained in a suppressed (conditionally-evaluated) position, OR if it
    // is still referenced from another free-function body (freeFnRefs, qualified+bare) - a low-level-call helper in
    // an un-inlined chain (functionCall -> functionCallWithValue) must stay a subroutine there, not dangle.
    node.freeFunctions = (node.freeFunctions ?? [])
      .filter((f) => !this.inlinedFns.has(f.name) || this.stillCalled.has(f.name)
        || (this.usingBoundFns.has(f.name) && !this.operatorFns.has(f.name))
        || (this.freeFnRefs.has(f.name) && !this.rawSlotFreeFns.has(f.name)));
    const remaining = new Set(node.freeFunctions.map((f) => f.name));
    for (const directive of node.usingForDirectives ?? []) {
      if (!directive.functionBindings) continue;
      directive.functionBindings = directive.functionBindings.filter(
        (binding) => !binding.operator || remaining.has(binding.funcName),
      );
    }
    node.usingForDirectives = (node.usingForDirectives ?? []).filter(
      (directive) => directive.libraryName || !directive.functionBindings || directive.functionBindings.length > 0,
    );
    return node;
  }

  // Pre-lowered operator helpers are removed before SymbolTableTraversal, so preserve the declaration checks that
  // pass would otherwise perform. This is intentionally the same signature subset: global UDVT target, pure
  // free-function implementation, correct unary/binary arity and matching parameter/return types.
  private validatePreloweredOperators(node: SourceFileNode): void {
    for (const directive of node.usingForDirectives ?? []) {
      if (!directive.isGlobal || !directive.targetTypeName) continue; // semantic pass validates other directives
      const targetName = directive.targetTypeName;
      const seen = new Map<string, string>();
      for (const binding of directive.functionBindings ?? []) {
        if (!binding.operator) continue;
        const fn = (node.freeFunctions ?? []).find((candidate) => candidate.name === binding.funcName);
        if (!fn) continue; // semantic pass reports the undefined binding
        const params = fn.parameters.filter((p) => !p.name.startsWith('__internal__'));
        const unary = params.length === 1;
        const binary = params.length === 2;
        if ((!unary && !binary) || (unary && binding.operator !== '-' && binding.operator !== '~')) {
          throw new OperatorOverloadSignatureError(
            directive, binding.funcName, `invalid parameter count ${params.length} for '${binding.operator}'`,
          );
        }
        if (!fn.isFreeFunction || !fn.modifiers.includes(FunctionModifier.PURE)) {
          throw new OperatorOverloadSignatureError(
            directive, binding.funcName, 'operator implementations must be pure free functions',
          );
        }
        if (params.some((p) => !(p.type instanceof ValueType) || p.type.toString() !== targetName)) {
          throw new OperatorOverloadSignatureError(
            directive, binding.funcName, `all parameters must be '${targetName}'`,
          );
        }
        const comparison = ['==', '!=', '<', '<=', '>', '>='].includes(binding.operator);
        const ret = fn.returnTypes[0];
        const validReturn = comparison ? ret === PrimitiveType.BOOL
          : ret instanceof ValueType && ret.toString() === targetName;
        if (!validReturn) {
          throw new OperatorOverloadSignatureError(
            directive, binding.funcName, `invalid return type '${ret?.toString() ?? 'void'}'`,
          );
        }
        const key = `${binding.operator}/${unary ? 1 : 2}`;
        const existingDefinition = seen.get(key);
        if (existingDefinition && existingDefinition !== binding.funcName) {
          throw new OperatorOverloadSignatureError(
            directive, binding.funcName, `operator '${binding.operator}' already has a definition`,
          );
        }
        seen.set(key, binding.funcName);
      }
    }
  }

  private containsPureInterfaceHelperReceiver(
    fn: FunctionDefinitionNode, freeFns: FunctionDefinitionNode[],
  ): boolean {
    const pureIfaceHelpers = new Set(freeFns.filter((candidate) =>
      candidate.modifiers.includes(FunctionModifier.PURE)
      && candidate.returnTypes.length === 1
      && candidate.returnTypes[0] instanceof AddressType
      && candidate.returnTypes[0].interfaceName).map((candidate) => candidate.name));
    let found = false;
    this.walk(fn.body, (n) => {
      if (n instanceof MethodCallNode && n.object instanceof FunctionCallNode
        && pureIfaceHelpers.has(n.object.identifier.name)) found = true;
    });
    return found;
  }

  visitContract(node: ContractNode): Node {
    this.funcByName = new Map();
    this.funcByKey = new Map();
    this.overloadsByKey = new Map();
    for (const fn of [...node.functions, ...this.freeFns]) {
      this.funcByName.set(fn.name, fn);
      this.funcByKey.set(inlineKey(fn.name, fn.parameters.length), fn);
      const key = inlineKey(fn.name, fn.parameters.length);
      (this.overloadsByKey.get(key) ?? this.overloadsByKey.set(key, []).get(key)!).push(fn);
    }
    this.qualifySiblingCalls();
    // Canonicalize the common single early-return tail before testing inline eligibility:
    // `if (c) return a; return b;` -> `return c ? a : b;`. This is evaluation-equivalent and lets a helper that
    // transitively performs a low-level/external call inline into its entry point instead of becoming an
    // OP_INVOKE subroutine with covenant parameters that no call site can supply (benchmark verifier shape).
    for (const fn of [...node.functions, ...this.freeFns]) {
      if (this.transitivelyContainsLowLevelCall(fn) || this.transitivelyContainsExternalCall(fn)) {
        this.normalizeSimpleEarlyReturn(fn);
      }
    }
    this.ambiguousInlineKeys = collectAmbiguousInlineKeys([...node.functions, ...this.freeFns]);
    this.collectionNames = new Set(node.collections.map((c) => c.name));
    this.mappingNames = new Set(node.collections.filter((c) => c.type instanceof MappingType).map((c) => c.name));
    this.stateVarNames = new Set(node.stateVariables.map((sv) => sv.name));
    this.stateValueTypes = new Map(node.stateVariables.map((sv) => [sv.name, sv.type]));

    this.inlinedFns = new Set();
    this.rawSlotFreeFns = new Set();
    this.keepDefFns = new Set();
    // A function used as a VALUE (function pointer) must keep a real definition; exclude such names from
    // the state-touching criteria (its call SITES stay subroutine calls, matching prior behavior).
    const valueReferenced = this.collectValueReferencedNames(node);
    for (const fn of node.functions) {
      if ((this.eligible(fn) && !valueReferenced.has(fn.name)) || this.eligibleStoragePtr(fn)) {
        this.inlinedFns.add(fn.name);
      }
    }
    // State-touching returning ENTRY POINTS called internally have the same subroutine problem; inline the
    // internal call sites but keep the definition (still dispatchable). A PUBLIC/external returning helper that
    // makes a LOW-LEVEL or EXTERNAL call is the same case: the covenant param it injects is threaded only at an
    // entry, so it cannot be an OP_INVOKE subroutine - an internal call to it must inline (Multicall2 `tryAggregate`
    // called by `tryBlockAndAggregate`). The public definition still stands as its own dispatched entry.
    for (const fn of node.functions) {
      if (!this.inlinedFns.has(fn.name) && !valueReferenced.has(fn.name) && this.eligibleShape(fn)
        && (this.readsEntry(fn) || this.touchesScalarState(fn)
          || this.transitivelyContainsLowLevelCall(fn) || this.transitivelyContainsExternalCall(fn))) {
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
    // Library free-functions are inlined here as storage-pointer value helpers, or (like OZ Address's
    // `functionCall`) as single-tail-return helpers containing a low-level call; other library functions keep
    // their own (delegate) machinery.
    for (const fn of this.freeFns) {
      if (this.eligibleStoragePtr(fn)) this.inlinedFns.add(fn.name);
      else if (this.eligibleShape(fn) && this.transitivelyTouchesRawEvmStorage(fn)) {
        // A file-level assembly helper lowered to __evm_storage has the same block-layout constraint as any
        // returning mapping helper. Inline the complete wrapper chain into the entry point; definitions in that
        // chain can then be dropped even when they reference one another.
        this.inlinedFns.add(fn.name);
        this.rawSlotFreeFns.add(fn.name);
      }
      // A returning library helper that makes an EXTERNAL call (`UniswapV2Library.getReserves` ->
      // `IPair(..).getReserves()`) must inline like a low-level-call one: the external-call covenant param is only
      // threaded at an entry point, so a subroutine holding it surfaces phantom params at the call site. Transitive
      // so a helper reaching the external call only through another inlined helper inlines too.
      else if (this.eligibleShape(fn)
        && (this.transitivelyContainsLowLevelCall(fn) || this.transitivelyContainsExternalCall(fn))) {
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
        this.currentValueTypes = new Map(this.stateValueTypes);
        for (const p of fn.parameters) this.currentValueTypes.set(p.name, p.type);
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

  // A lone `unchecked { .. }` body is transparent for linearization: BCH integers are arbitrary-precision BigInts
  // with no fixed-width overflow, so the wrapper never changes the arithmetic of the hoisted prelude. Treating its
  // inner statements as the body lets `unchecked { __t = m[k]; m[k] = __t+1; return __t; }` (OZ Nonces `_useNonce`,
  // the save-old lowering of `return m[k]++`) inline like a bare-return state-reading helper.
  private effectiveStmts(stmts: StatementNode[]): StatementNode[] {
    if (stmts.length === 1 && stmts[0] instanceof UncheckedNode) return (stmts[0] as UncheckedNode).block.statements ?? [];
    return stmts;
  }

  private normalizeSimpleEarlyReturn(fn: FunctionDefinitionNode): void {
    if (!fn.body || fn.returnTypes.length !== 1) return;
    const stmts = fn.body.statements ?? [];
    if (stmts.length < 2) return;
    const branch = stmts[stmts.length - 2];
    const tail = stmts[stmts.length - 1];
    if (!(branch instanceof BranchNode) || branch.elseBlock || !(tail instanceof ReturnNode)
      || tail.expressions.length !== 1) return;
    const arm = branch.ifBlock.statements ?? [];
    if (arm.length !== 1 || !(arm[0] instanceof ReturnNode) || arm[0].expressions.length !== 1) return;
    const conditional = new TernaryOpNode(branch.condition, arm[0].expressions[0], tail.expressions[0]);
    conditional.location = branch.location;
    const ret = new ReturnNode([conditional]);
    ret.location = tail.location;
    fn.body.statements = [...stmts.slice(0, -2), ret];
  }

  // The structural half of `eligible`: single-tail-return, no storage params (visibility-agnostic).
  private eligibleShape(fn: FunctionDefinitionNode): boolean {
    if (!fn.body || fn.returnTypes.length < 1) return false;
    if (fn.parameters.some((p) => p.modifier.includes(Modifier.STORAGE))) return false;
    const stmts = this.effectiveStmts(fn.body.statements ?? []);
    const last = stmts[stmts.length - 1];
    if (!(last instanceof ReturnNode)) return false;
    if (last.expressions.length !== fn.returnTypes.length) return false;
    let returns = 0;
    this.walk(fn.body, (n) => { if (n instanceof ReturnNode) returns += 1; });
    return returns === 1;
  }

  private eligible(fn: FunctionDefinitionNode): boolean {
    if (!(fn.isFreeFunction || fn.visibility === 'private' || fn.visibility === 'internal')) return false;
    if (!this.eligibleShape(fn)) return false;
    return this.readsEntry(fn) || this.touchesScalarState(fn) || this.containsLowLevelCall(fn)
      || this.transitivelyContainsExternalCall(fn);
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

  // Disambiguate an inline of an overloaded (name, arity) by RETURN arity: an expression-position inline needs the
  // 1-return overload, a K-tuple inline needs the K-return overload (RebaseLibrary.add - `(t,b)=t.add(x,true)` picks
  // the 2-return overload, `t=t.add(x,y)` the 1-return one). Returns the UNIQUE overload with `want` return values,
  // or undefined when zero/several match (stay ambiguous - fail closed). `want<0` means "any multi-value" (>=2).
  private pickOverloadByReturnArity(
    name: string, arity: number, want: number, args?: ExpressionNode[],
  ): FunctionDefinitionNode | undefined {
    const all = this.overloadsByKey.get(inlineKey(name, arity)) ?? [];
    // Only overloads this pass can actually inline participate. A declaration/body that has the requested
    // return arity but no linearizable tail return is not a competing candidate (e.g. an empty bytes32 overload
    // beside a reducible uint storage-pointer helper).
    let matches = all.filter((f) => (this.eligible(f) || this.eligibleStoragePtr(f))
      && (want < 0 ? f.returnTypes.length >= 2 : f.returnTypes.length === want));
    if (args) {
      const typed = matches.filter((f) => args.every((arg, i) => {
        if (!(arg instanceof IdentifierNode)) return true;
        const actual = this.currentValueTypes.get(arg.name);
        return !actual || actual.toString() === f.parameters[i]?.type.toString();
      }));
      if (typed.length > 0) matches = typed;
    }
    return matches.length === 1 ? matches[0] : undefined;
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

  // Like transitivelyContainsLowLevelCall for EXTERNAL calls: fn contains one directly, or calls an inline-eligible
  // helper that (transitively) does. Once that helper inlines, fn holds the external call and its covenant param, so
  // fn cannot be a subroutine either - it must inline at its own call site (SushiRoll `_addLiquidity` -> library
  // `getReserves` -> `IPair(..).getReserves()`). Cycle-guarded by `seen`; only follows eligible-shape callees.
  private transitivelyContainsExternalCall(fn: FunctionDefinitionNode, seen: Set<string> = new Set()): boolean {
    if (this.containsExternalCall(fn)) return true;
    if (seen.has(fn.name)) return false;
    seen.add(fn.name);
    let found = false;
    this.walk(fn.body, (n) => {
      if (found || !(n instanceof FunctionCallNode)) return;
      const callee = this.lookupOverload(n.identifier.name, n.parameters.length);
      if (callee && callee !== fn && this.eligibleShape(callee)
        && this.transitivelyContainsExternalCall(callee, seen)) found = true;
    });
    return found;
  }

  private transitivelyTouchesRawEvmStorage(fn: FunctionDefinitionNode, seen: Set<string> = new Set()): boolean {
    let direct = false;
    this.walk(fn.body, (n) => {
      if (n instanceof MappingAccessNode && n.name === '__evm_storage') direct = true;
    });
    if (direct) return true;
    const key = inlineKey(fn.name, fn.parameters.length);
    if (seen.has(key)) return false;
    seen.add(key);
    let found = false;
    this.walk(fn.body, (n) => {
      if (found || !(n instanceof FunctionCallNode)) return;
      const callee = this.lookupOverload(n.identifier.name, n.parameters.length);
      if (callee && callee !== fn && this.eligibleShape(callee)
        && this.transitivelyTouchesRawEvmStorage(callee, seen)) found = true;
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

  // A single-tail-return value helper taking a struct, mapping, or array storage pointer. Struct pointers rewrite
  // flattened fields (`map.values[k]` -> the caller's `<arg>__values`); mapping pointers rewrite direct element
  // accesses (`m[k]` -> `<arg>[k]`). Neither has an on-stack value representation, so the helper must inline.
  // Mapping support is deliberately scoped to internal/private contract helpers: library and public mapping
  // helpers use separate dispatch/lowering paths, and intercepting them here changes existing call semantics.
  // Fixed arrays containing mappings use the same name-substitution scheme as mappings: their full
  // `(arrayIndex, mappingKey, ...)` path is one collection key path, with no runtime pointer value.
  private eligibleStoragePtr(fn: FunctionDefinitionNode): boolean {
    if (!fn.body || fn.returnTypes.length < 1) return false;
    const storageParams = fn.parameters.filter((p) => p.modifier.includes(Modifier.STORAGE));
    const hasStruct = storageParams.some((p) => p.type instanceof StructType);
    const hasMapping = storageParams.some((p) => p.type instanceof MappingType);
    const hasArray = storageParams.some((p) => p.type instanceof ArrayType);
    if (!hasStruct && !((hasMapping || hasArray) && !fn.isFreeFunction
      && (fn.visibility === 'internal' || fn.visibility === 'private'))) return false;
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
    const arity = node.parameters.length;
    // An expression-position inline uses the 1-return overload. For an ambiguous (name, arity) - RebaseLibrary.add
    // has a 1-return and a 2-return arity-3 overload - resolve to it UP FRONT: lookupOverload returns an arbitrary
    // overload, and a wrong (2-return) pick would fail the `returnTypes.length === 1` gate before disambiguation.
    let callee = this.lookupOverload(name, arity) ?? this.funcByName.get(name);
    if (callee && this.inlinedFns.has(name) && this.ambiguousInlineKeys.has(inlineKey(name, arity))) {
      callee = this.pickOverloadByReturnArity(name, arity, 1, node.parameters as ExpressionNode[]) ?? callee;
    }
    if (callee) this.reorderNamedTail(node, callee);
    if (!this.suppress && callee && this.inlinedFns.has(name)
      && !this.stack.includes(inlineKey(name, arity))
      && arity === callee.parameters.length
      && callee.returnTypes.length === 1) {
      if (this.ambiguousInlineKeys.has(inlineKey(name, arity))
        && !this.pickOverloadByReturnArity(name, arity, 1, node.parameters as ExpressionNode[])) {
        throw new AmbiguousInlineOverloadError(node, name, arity);
      }
      // A scalar helper inlines at an expression position, replaced by its single return temp. A multi-value
      // helper can't (one temp can't carry >1 value) - it is inlined only at a statement position, below.
      const result = this.inlineCall(callee, node.parameters as ExpressionNode[])[0];
      if (node.fromThisCall) result.fromExternalSelfCall = true;
      return result;
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
    const arity = expr.parameters.length;
    // A tuple-position inline needs the multi-value overload; resolve it UP FRONT for an ambiguous (name, arity)
    // so the `returnTypes.length < 2` gate below sees it (lookupOverload may return the 1-return sibling).
    let callee = this.lookupOverload(name, arity) ?? this.funcByName.get(name);
    if (callee && this.inlinedFns.has(name) && this.ambiguousInlineKeys.has(inlineKey(name, arity))) {
      callee = this.pickOverloadByReturnArity(name, arity, -1) ?? callee;
    }
    if (!callee || !this.inlinedFns.has(name) || this.stack.includes(inlineKey(name, arity))
      || arity !== callee.parameters.length || callee.returnTypes.length < 2) return undefined;
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
    const type = this.expressionValueType(node.left);
    const helper = type instanceof ValueType
      ? this.operatorBindings.get(`${type.toString()}/${node.operator}/2`) : undefined;
    if (helper) {
      if (!this.suppress) {
        const call = new FunctionCallNode(new IdentifierNode(helper), [node.left, node.right]);
        call.location = node.location;
        return this.visitFunctionCall(call);
      }
    }
    return node;
  }

  visitUnaryOp(node: UnaryOpNode): Node {
    node.expression = this.visit(node.expression);
    const spelling = node.operator === UnaryOperator.NEGATE ? '-'
      : node.operator === UnaryOperator.INVERT ? '~' : undefined;
    const type = spelling ? this.expressionValueType(node.expression) : undefined;
    const helper = type instanceof ValueType
      ? this.operatorBindings.get(`${type.toString()}/${spelling}/1`) : undefined;
    if (helper) {
      if (!this.suppress) {
        const call = new FunctionCallNode(new IdentifierNode(helper), [node.expression]);
        call.location = node.location;
        return this.visitFunctionCall(call);
      }
    }
    return node;
  }

  private expressionValueType(node: ExpressionNode): Type | undefined {
    if (node.type) return node.type;
    if (node instanceof IdentifierNode) return this.currentValueTypes.get(node.name) ?? node.definition?.type;
    if (node instanceof FunctionCallNode) return node.resolvedFunction?.returnTypes?.[0];
    return undefined;
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
    if (this.operatorFns.has(callee.name)) {
      this.walk(cloned.body, (node) => {
        if (node instanceof MethodCallNode && node.object instanceof FunctionCallNode) {
          node.inlinedOperatorReceiver = true;
        }
      });
    }

    const rename = new Map<string, string>();
    const subs = new Map<string, ExpressionNode>();
    const rmwPrologue: StatementNode[] = [];
    const rmwEpilogue: StatementNode[] = [];
    callee.parameters.forEach((p, i) => {
      if (p.modifier.includes(Modifier.STORAGE)) {
        // A storage pointer is a compile-time reference: alias a bare state-var arg by NAME (so `map__field`
        // renames to the caller's `<arg>__field`), or substitute a complex access path by expression.
        const arg = args[i];
        // A struct storage-pointer bound to a MAPPING/ARRAY element (or bare state struct var) that the body
        // WRITES cannot be substituted (the write lowers to an lvalue expression substitution can't rewrite into
        // a mapping/array-element assign). Read-modify-write instead: `S t = m[k]; <body>; m[k] = t;` (this covers
        // BentoBox `totals[k].addElastic(x)` - a returning storage-pointer write-helper). Matches the same fix in
        // InlineStoragePointerCalls; gated on the body actually WRITING so read-only get/size helpers are unchanged.
        const acc = this.elementAccess(arg);
        if (p.type instanceof StructType && acc && this.isWritten(callee.body, p.name)) {
          const local = `${PREFIX}${n}_${p.name}`;
          rename.set(p.name, local);
          const decl = new VariableDefinitionNode(p.type, [], local, acc.read);
          decl.location = arg.location ?? callee.location;
          rmwPrologue.push(decl as StatementNode);
          rmwEpilogue.push(acc.writeBack(local));
        } else if (arg instanceof IdentifierNode) {
          rename.set(p.name, arg.name);
        } else {
          subs.set(p.name, cloneNode(arg) as ExpressionNode);
        }
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
    const processed = this.effectiveStmts((this.visit(cloned.body) as BlockNode).statements ?? []);
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
    this.hoists.push(...bindings, ...rmwPrologue, ...processed.slice(0, -1), ...retDefs, ...rmwEpilogue);
    return ids;
  }

  // Normalized element READ node + write-back builder for a struct storage-pointer bound to a mapping/array
  // element or bare state struct var. Handles BOTH `this.m[k]` (MappingAccessNode) and bare `m[k]`
  // (ArrayAccessNode on the mapping-name identifier, how Solidity without `this.` parses) - the bare mapping form
  // must resolve via the collection, so its read is rebuilt as a MappingAccessNode. Undefined for other shapes.
  private elementAccess(arg: Node): { read: ExpressionNode; writeBack: (local: string) => StatementNode } | undefined {
    const loc = arg.location;
    const at = (s: StatementNode): StatementNode => { s.location = loc; return s; };
    const id = (l: string): IdentifierNode => { const x = new IdentifierNode(l); x.location = loc; return x; };
    const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;
    if (arg instanceof MappingAccessNode) {
      const keys = (): ExpressionNode[] => arg.keys.map(clone);
      if (this.mappingNames.has(arg.name)) {
        return { read: clone(arg), writeBack: (l) => at(new MappingAssignNode(arg.name, keys(), id(l))) };
      }
      if ((this.stateVarNames.has(arg.name) || this.collectionNames.has(arg.name)) && arg.keys.length === 1) {
        return { read: clone(arg), writeBack: (l) => at(new StateArrayAssignNode(arg.name, keys()[0], id(l))) };
      }
      return undefined;
    }
    if (arg instanceof ArrayAccessNode && arg.array instanceof IdentifierNode) {
      const name = arg.array.name;
      if (this.mappingNames.has(name)) {
        const read = new MappingAccessNode(name, [clone(arg.index)]);
        read.location = loc;
        return { read, writeBack: (l) => at(new MappingAssignNode(name, [clone(arg.index)], id(l))) };
      }
      if (this.stateVarNames.has(name) || this.collectionNames.has(name)) {
        return { read: clone(arg), writeBack: (l) => at(new StateArrayAssignNode(name, clone(arg.index), id(l))) };
      }
      return undefined;
    }
    if (arg instanceof StateAccessNode && this.stateVarNames.has(arg.name)) {
      return { read: clone(arg), writeBack: (l) => at(new StateAssignNode(arg.name, id(l))) };
    }
    return undefined;
  }

  // The body writes storage pointer `name` (an AssignNode target, or a state/mapping/array/field assign on it).
  private isWritten(body: Node | undefined, name: string): boolean {
    let found = false;
    this.walk(body, (n) => {
      if (found) return;
      if (n instanceof AssignNode && n.identifier.name === name) found = true;
      else if ((n instanceof StateAssignNode || n instanceof MappingAssignNode || n instanceof StateArrayAssignNode
        || n instanceof MappingFieldAssignNode) && n.name === name) found = true;
    });
    return found;
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
