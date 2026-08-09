import {
  ContractNode,
  FunctionDefinitionNode,
  SourceFileNode,
  InterfaceNode,
  Node,
  ExpressionNode,
  VariableDefinitionNode,
  IdentifierNode,
  FunctionCallNode,
  MethodCallNode,
  BlockNode,
  FieldAccessNode,
  ArrayAccessNode,
  MappingAccessNode,
  IntLiteralNode,
  TupleIndexOpNode,
  CastNode,
  AssignNode,
  TupleAssignmentNode,
  WhileNode,
  DoWhileNode,
  CollectionIterationNode,
  ContractReferenceNode,
  FunctionModifier,
  StateVariableVisibility,
} from '../ast/AST.js';
import {
  AddressType, StructType, ArrayType, MappingType, Type,
} from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { Modifier } from '../ast/Globals.js';

/**
 * Rewrites an external method call whose target address is read from THIS contract's own (self-pinned) state
 * into a call on a synthesized local, so the audited local-interface-var external-call dispatch handles it
 * unchanged (the dispatch verifies the co-spent callee against the local's value = the address read from
 * self-pinned state; a caller cannot substitute it - see docs/extcall-target-pinning.md).
 *
 * Two shapes:
 *   1. Interface-typed state var:  `IERC20 token; ... token.transferFrom(..)`
 *        -> `IERC20 __extaddr_token = token; __extaddr_token.transferFrom(..)`
 *   2. Plain-`address` state var behind an interface/contract cast:  `address a; ... IFoo(a).m(..)`
 *        -> `IFoo __extaddr_a_IFoo = IFoo(a); __extaddr_a_IFoo.m(..)`  (per-interface local; the same `a`
 *           cast to IBar gets its own `__extaddr_a_IBar`).
 *
 * Runs before semantic analysis so the synthesised decls resolve normally. The constructor is not visited
 * (it sets the state var; the local would read it before assignment). SOUND: the target is the genuine
 * self-pinned state value, never a per-call caller witness - it is NOT lifted to a parameter.
 */
const PREFIX = '__extaddr_';
const ADDRESS_METHODS = new Set(['send', 'call', 'staticcall', 'delegatecall']);
const LOW_LEVEL_CALLS = new Set(['call', 'staticcall', 'delegatecall']);
// Synthetic single-assignment alias locals safe to trace through: `__rh*`/`__inl*` are inliner-created bindings of
// call args (never reassigned); `__extaddr_*` are this pass's own hoists. A user local is deliberately excluded.
const SYNTH_ALIAS = /^(__rh|__inl|__extaddr_)/;

// The element/value type of an array/mapping (for stepping through an access chain), else undefined.
function elementOf(t: Type | undefined): Type | undefined {
  if (t instanceof ArrayType) return t.elementType;
  if (t instanceof MappingType) return t.valueType;
  return undefined;
}

// A state root worth visiting: a struct, or an array/mapping whose element/value is a struct (one step to a
// possible interface-typed field). Over-approximate - the chain resolver does the exact interface-field check.
function holdsStruct(t: Type): boolean {
  return t instanceof StructType || elementOf(t) instanceof StructType;
}

export default class SynthesizeExternalAddressLocals extends AstTraversal {
  private stateVarIface: Map<string, string> = new Map(); // interface-typed state var name -> interface name
  private plainAddrStateVars: Set<string> = new Set();    // plain-`address` state var names (no interfaceName)
  private stateRoots: Map<string, Type> = new Map();      // state var / collection name -> declared type (self-pinned)
  private currentParams: Set<string> = new Set();         // current function's param names (safe at body top)
  private typeNames: Set<string> = new Set();             // interface + contract names usable as a cast target
  // localName -> synthesized decl parts (init reads the self-pinned state; iface = the local's interface type, or
  // undefined for a plain-`address` local hoisted as a low-level-call receiver)
  private usedInFn: Map<string, { iface: string | undefined; init: ExpressionNode }> = new Map();
  // Inlined/user local name -> its initializer expression, in body order. Populated as VariableDefinitions are
  // visited, so a low-level `.call` on `address(<inlined local>)` can trace the local back to a self-pinned state
  // chain (the SafeERC20 `address(token).call` shape, where the inliner binds `token = IERC20(coll[k].field)`).
  private localInits: Map<string, ExpressionNode> = new Map();
  // User locals declared exactly once (with an init) and NEVER reassigned, so their value equals their init at
  // every use - safe to trace through (the Marketplace `IERC20 token = IERC20(job.token)` intermediary). A
  // reassignable local is excluded (it could be rebound to a caller value between decl and the call = forgery).
  private singleAssignLocals: Set<string> = new Set();
  // Storage-reference locals keep pointing at their initializer even when assignments through them update the
  // referenced struct. They are safe provenance aliases despite looking "reassigned" to a generic AST scan.
  private storagePointerLocals: Set<string> = new Set();
  private localStructTypes: Map<string, StructType> = new Map();
  // interface / contract name -> the method names it declares (own + inherited). A target-receiver method that is
  // NOT one of these is a `using L for IFace` library method (`token.safeTransfer(..)`), NOT an external call - it
  // must be left for the using-for resolver, not hoisted into an __extaddr_ address local (which drops the interface
  // type and breaks the using-for dispatch). Only genuine interface method calls are self-pinned external calls.
  private ifaceMethods: Map<string, Set<string>> = new Map();
  private pureInterfaceReturns: Map<string, string> = new Map();
  // Transitive-target decls to insert right BEFORE the current statement (a computed target with a mid-body-only
  // single-assign-local leaf cannot hoist to the body top). Flushed per-statement by visitBlock. A fresh counter
  // names each so repeated uses do not collide.
  private pendingMidbodyDecls: VariableDefinitionNode[] = [];
  private transitiveCounter = 0;
  // Constructor state is initialized in body order, so a state-backed receiver must be captured at its call site
  // rather than in the normal function body-top prologue (which would read it before an earlier assignment).
  private visitingConstructor = false;

  visitSourceFile(node: SourceFileNode): Node {
    this.typeNames = new Set();
    this.ifaceMethods = new Map();
    this.pureInterfaceReturns = new Map();
    const ifaces = node.interfaceDefinitions as InterfaceNode[];
    const ifaceByName = new Map(ifaces.map((i) => [i.name, i]));
    const methodsOf = (name: string, seen = new Set<string>()): Set<string> => {
      const out = new Set<string>();
      if (seen.has(name)) return out;
      seen.add(name);
      const iface = ifaceByName.get(name);
      if (!iface) return out;
      for (const fn of iface.functions) out.add(fn.name);
      for (const p of iface.parents ?? []) for (const mm of methodsOf(p, seen)) out.add(mm);
      return out;
    };
    for (const iface of ifaces) { this.typeNames.add(iface.name); this.ifaceMethods.set(iface.name, methodsOf(iface.name)); }
    const contractMethods = (contract: ContractNode): Set<string> => new Set([
      ...(contract.functions ?? []).map((f) => f.name),
      ...contract.stateVariables
        .filter((sv) => sv.visibility === StateVariableVisibility.PUBLIC
          || sv.visibility === StateVariableVisibility.EXTERNAL)
        .map((sv) => sv.name),
      ...contract.collections
        .filter((collection) => collection.visibility === StateVariableVisibility.PUBLIC
          || collection.visibility === StateVariableVisibility.EXTERNAL)
        .map((collection) => collection.name),
    ]);
    for (const c of node.importedContracts as ContractNode[]) {
      this.typeNames.add(c.name);
      this.ifaceMethods.set(c.name, contractMethods(c));
    }
    if (node.contract) {
      this.typeNames.add(node.contract.name);
      this.ifaceMethods.set(node.contract.name, contractMethods(node.contract));
    }
    for (const fn of node.freeFunctions ?? []) {
      const ret = fn.returnTypes?.length === 1 ? fn.returnTypes[0] : undefined;
      if (fn.modifiers.includes(FunctionModifier.PURE)
        && ret instanceof AddressType && ret.interfaceName && this.typeNames.has(ret.interfaceName)) {
        this.pureInterfaceReturns.set(fn.name, ret.interfaceName);
      }
    }
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  // True when `method` is a genuine method of interface/contract `iface` - hoist it as an external call. False for a
  // using-for library method bound onto the type (leave it for the using-for resolver).
  private isInterfaceMethod(iface: string | undefined, method: string): boolean {
    return !!iface && (this.ifaceMethods.get(iface)?.has(method) ?? false);
  }

  visitContract(node: ContractNode): Node {
    this.stateVarIface = new Map();
    this.plainAddrStateVars = new Set();
    this.stateRoots = new Map();
    for (const sv of node.stateVariables) {
      this.stateRoots.set(sv.name, sv.type);
      if (!(sv.type instanceof AddressType)) continue;
      if (sv.type.interfaceName) this.stateVarIface.set(sv.name, sv.type.interfaceName);
      else this.plainAddrStateVars.add(sv.name);
    }
    for (const c of node.collections) this.stateRoots.set(c.name, c.type);
    // A state root can hold an interface-typed field directly (struct var) or one step down (struct array
    // element / struct mapping value) - visit the functions if any does, so a `s.field.m()` chain is hoisted.
    // A param-rooted cast target `IFoo(param.field).m()` (castParamFieldTarget) is also caught here; it needs a
    // struct root in practice (the shape appears alongside struct state), so no extra gate term - keeping the
    // gate tight avoids visiting fn-ptr-array-only contracts whose broadcast lowering must stay untouched.
    const hasStructRoot = [...this.stateRoots.values()].some((t) => holdsStruct(t));
    const hasInterfaceCollection = [...this.stateRoots.values()].some((t) => {
      const elem = elementOf(t);
      return elem instanceof AddressType && !!elem.interfaceName;
    });
    // A COMPUTED cast target `IFoo(pairFor(..)).m()` needs the pass even with no state var (params-only contract).
    // Detect it cheaply (a MethodCall on an `IFoo(<non-identifier>)` cast) so the gate stays otherwise tight.
    const hasComputedTarget = this.hasComputedCastTarget(node);
    if (this.stateVarIface.size > 0 || this.plainAddrStateVars.size > 0
      || hasStructRoot || hasInterfaceCollection || hasComputedTarget) {
      node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
      if (node.constructorDef) {
        this.visitingConstructor = true;
        node.constructorDef = this.visitFunctionDefinition(node.constructorDef) as FunctionDefinitionNode;
        this.visitingConstructor = false;
      }
      // fallback/receive are external entry points like any function (e.g. a re-entrancy fallback that calls
      // back into another contract); visit them too. The state var is already set by the time they run.
      if (node.fallbackDef) node.fallbackDef = this.visitFunctionDefinition(node.fallbackDef) as FunctionDefinitionNode;
      if (node.receiveDef) node.receiveDef = this.visitFunctionDefinition(node.receiveDef) as FunctionDefinitionNode;
    }
    return node;
  }

  // Cheap gate pre-scan: does any function make a method call on an interface-CAST of a non-identifier
  // (`IFoo(pairFor(..)).m()`)? Such a computed target needs this pass even in a state-var-less contract.
  private hasComputedCastTarget(node: ContractNode): boolean {
    let found = false;
    const walk = (n: unknown): void => {
      if (found || !n || typeof n !== 'object') return;
      if (n instanceof MethodCallNode && n.inlinedOperatorReceiver && n.object instanceof FunctionCallNode
        && this.pureInterfaceReturns.has(n.object.identifier.name)) {
        found = true;
        return;
      }
      if (n instanceof MethodCallNode && n.object instanceof FunctionCallNode
        && n.object.parameters.length === 1 && this.typeNames.has(n.object.identifier.name)) {
        // Unwrap cast wrappers to match castComputedTarget: `IFoo(address(uint(keccak256(..))))` wraps the
        // computed call in numeric/address casts (the create2 address form).
        let inner: Node = n.object.parameters[0];
        while (inner instanceof CastNode) inner = inner.expression;
        if (inner instanceof FunctionCallNode) { found = true; return; }
      }
      for (const k of Object.keys(n)) {
        if (k === 'type' || k === 'symbolTable' || k === 'location') continue;
        const v = (n as Record<string, unknown>)[k];
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === 'object') walk(v);
      }
    };
    for (const fn of node.functions) walk(fn.body);
    return found;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    if (!node.body) return node;
    this.usedInFn = new Map();
    this.pendingMidbodyDecls = [];
    this.localInits = new Map();
    this.storagePointerLocals = new Set();
    this.localStructTypes = new Map();
    // Pre-populate from the WHOLE body (not just bindings visited so far): a computed target is recognised mid-visit
    // (castComputedTarget) and must resolve an inliner alias (`__rh<N>_factory`) whose binding a deeply-nested inline
    // may place in a traversal position not yet reached. Sound: only single-assignment aliases (SYNTH_ALIAS /
    // singleAssignLocals) are ever traced, so their value is position-independent. Router02 UniswapV2Library.getReserves.
    this.collectLocalInitsUpfront(node.body);
    this.singleAssignLocals = this.computeSingleAssignLocals(node.body);
    this.currentParams = new Set(node.parameters.map((p) => p.name));
    node.body = this.visit(node.body) as BlockNode;
    if (this.usedInFn.size > 0) {
      const decls = [...this.usedInFn.entries()].map(([localName, { iface, init }]) => {
        if (!init.location) init.location = node.location; // fresh IdentifierNode init has none
        const def = new VariableDefinitionNode(new AddressType(false, iface), [], localName, init);
        def.location = node.location;
        return def;
      });
      node.body.statements = [...decls, ...(node.body.statements ?? [])];
    }
    return node;
  }

  // Flush transitive-target decls (castTransitiveTarget) right before the statement whose visit produced them, so the
  // computed target reads its mid-body-only single-assign local where it is live. A nested block visited during a
  // statement manages its own (save/restore), so an outer statement only picks up its DIRECT decls.
  visitBlock(node: BlockNode): Node {
    const out: Node[] = [];
    for (const stmt of node.statements ?? []) {
      const before = this.pendingMidbodyDecls;
      this.pendingMidbodyDecls = [];
      const visited = this.visit(stmt) as Node;
      out.push(...this.pendingMidbodyDecls, visited);
      this.pendingMidbodyDecls = before;
    }
    node.statements = out as never;
    return node;
  }

  visitVariableDefinition(node: VariableDefinitionNode): Node {
    if (node.expression) this.localInits.set(node.name, node.expression);
    return super.visitVariableDefinition(node) as Node;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    const name = node.identifier.name;
    const dot = name.indexOf('.');
    if (dot > 0) {
      const varName = name.slice(0, dot);
      const method = name.slice(dot + 1);
      if (LOW_LEVEL_CALLS.has(method) && this.plainAddrStateVars.has(varName)) {
        const localName = `${PREFIX}ll_${varName}`;
        if (!this.usedInFn.has(localName)) {
          this.usedInFn.set(localName, { iface: undefined, init: new IdentifierNode(varName) });
        }
        const loc = node.identifier.location;
        node.identifier = new IdentifierNode(`${localName}.${method}`);
        node.identifier.location = loc;
      } else if (this.stateVarIface.has(varName) && !ADDRESS_METHODS.has(method)
        // Sibling-contract member indexes can be pruned before this pass in a constructor. The state variable's
        // declared contract type still proves this is a contract receiver; capture it at the call site and let
        // semantic member resolution validate the method. Ordinary functions keep the using-for-safe method gate.
        && (this.visitingConstructor || this.isInterfaceMethod(this.stateVarIface.get(varName), method))) {
        const iface = this.stateVarIface.get(varName)!;
        const init = new IdentifierNode(varName);
        init.location = node.identifier.location;
        const localName = this.visitingConstructor
          ? this.captureAtCallSite(iface, init, node)
          : this.markUsed(varName, iface, false, undefined);
        const loc = node.identifier.location;
        node.identifier = new IdentifierNode(`${localName}.${method}`);
        node.identifier.location = loc;
      } else if (!ADDRESS_METHODS.has(varName) && !ADDRESS_METHODS.has(method)
        && this.singleAssignLocals.has(varName) && this.localInits.has(varName)) {
        // A SINGLE-ASSIGNMENT local aliasing an interface-cast target (`IUnicrow unicrow = IUnicrow(unicrowAddress);
        // unicrow.pay(..)`, EACC Marketplace). The interface local is not materialized (the cast is a no-op), so
        // sourcing it in codegen fails "variable 'unicrow' does not exist on the stack". Resolve the init to the
        // underlying state-var / self-pinned chain and hoist THAT, rewriting the call to the __extaddr_ local.
        const local = this.hoistTargetLocalFor(this.localInits.get(varName)!);
        if (local) {
          const loc = node.identifier.location;
          node.identifier = new IdentifierNode(`${local}.${method}`);
          node.identifier.location = loc;
        }
      }
    }
    node.parameters = this.visitList(node.parameters) as ExpressionNode[];
    return node;
  }

  // `token.method{value:}(..)` (interface-typed state var) or `IFoo(a).method(..)` (plain-`address` state var
  // behind an interface cast): rewrite the object to the synthesized __extaddr_ local.
  visitMethodCall(node: MethodCallNode): Node {
    const directStateTarget = node.object instanceof IdentifierNode && this.stateVarIface.has(node.object.name)
      ? {
        name: node.object.name,
        iface: this.stateVarIface.get(node.object.name)!,
        isPlain: false,
      } : undefined;
    const target = this.externalTargetStateVar(node.object) ?? directStateTarget;
    const cachedField = target ? undefined : this.localStructFieldTarget(node.object);
    const chain = target || cachedField ? undefined : this.chainTarget(node.object);
    const castChain = target || cachedField || chain ? undefined : this.castChainTarget(node.object);
    const paramField = target || cachedField || chain || castChain ? undefined : this.castParamFieldTarget(node.object);
    const localCastField = target || cachedField || chain || castChain || paramField
      ? undefined : this.castLocalStructFieldTarget(node.object);
    const computed = target || cachedField || chain || castChain || paramField || localCastField
      ? undefined : this.castComputedTarget(node.object);
    const transitive = target || cachedField || chain || castChain || paramField || localCastField || computed
      ? undefined : this.castTransitiveTarget(node.object);
    const pureCallIface = node.inlinedOperatorReceiver && node.object instanceof FunctionCallNode
      ? this.pureInterfaceReturns.get(node.object.identifier.name) : undefined;
    if (target && !ADDRESS_METHODS.has(node.methodName) && this.isInterfaceMethod(target.iface, node.methodName)) {
      const localName = this.visitingConstructor
        ? this.captureAtCallSite(target.iface, node.object, node)
        : this.markUsed(target.name, target.iface, target.isPlain, node.object);
      const loc = node.object.location;
      node.object = new IdentifierNode(localName);
      node.object.location = loc;
    } else if (cachedField && !ADDRESS_METHODS.has(node.methodName)
      && this.isInterfaceMethod(cachedField.iface, node.methodName)) {
      // C2's function-local mapping-entry cache is mutable and declared after the body-top prologue, so capture
      // its current interface field immediately before the call rather than tracing back to the initial state
      // read. The external-call covenant then pins the co-spent target to exactly that runtime field value.
      const localName = `${PREFIX}cache${this.transitiveCounter}_${cachedField.iface}`;
      this.transitiveCounter += 1;
      const def = new VariableDefinitionNode(
        new AddressType(false, cachedField.iface), [], localName, cloneNode(node.object) as ExpressionNode,
      );
      def.location = node.object.location ?? node.location;
      this.pendingMidbodyDecls.push(def);
      const loc = node.object.location;
      node.object = new IdentifierNode(localName);
      node.object.location = loc;
    } else if (chain && !ADDRESS_METHODS.has(node.methodName) && this.isInterfaceMethod(chain.iface, node.methodName)) {
      // `s.field.m()` / `ss[i].field.m()` / `ms[k].field.m()` / `s.a.b.m()`: the target is an interface-typed
      // field reached through a chain of self-pinned STATE (struct fields, array elements, mapping values). Hoist
      // the whole field read into a local so the audited __extaddr_ dispatch pins the co-spend to it - a caller
      // cannot substitute a self-pinned value (extcall-target-pinning.md). Indices are params/literals, so the
      // hoisted decl is valid at the function-body top.
      const localName = this.visitingConstructor
        ? this.captureAtCallSite(chain.iface, chain.init, node)
        : chain.localName;
      if (!this.visitingConstructor && !this.usedInFn.has(localName)) {
        this.usedInFn.set(localName, { iface: chain.iface, init: chain.init });
      }
      const loc = node.object.location;
      node.object = new IdentifierNode(localName);
      node.object.location = loc;
    } else if (castChain && !ADDRESS_METHODS.has(node.methodName)
      && this.isInterfaceMethod(castChain.iface, node.methodName)) {
      // `IFoo(s.field).m()` / `IFoo(ss[i].field).m()` / `IFoo(ms[k].field).m()`: a plain-`address` field reached
      // through self-pinned STATE, cast to an interface (the cast supplies the callee ABI). Same soundness as the
      // chain case - the value is self-pinned state, never a caller witness. Hoist the whole `IFoo(chain)` cast
      // (preserving the interface type) into a local. `Job storage job = jobs[id]; IFoo(job.token).m()` reaches
      // here too: AstBuilder already inlines the storage pointer, so `job.token` is `jobs[id].token`.
      if (!this.usedInFn.has(castChain.localName)) {
        this.usedInFn.set(castChain.localName, { iface: castChain.iface, init: cloneNode(node.object) as ExpressionNode });
      }
      const loc = node.object.location;
      node.object = new IdentifierNode(castChain.localName);
      node.object.location = loc;
    } else if (paramField && !ADDRESS_METHODS.has(node.methodName)
      && this.isInterfaceMethod(paramField.iface, node.methodName)) {
      // `IFoo(param.field).m()` / `IFoo(param[i].field).m()`: the target is a field/element of a FUNCTION PARAM,
      // cast to an interface. The base is caller-supplied, so this is the sound "caller chooses whom to call"
      // shape (extcall-target-pinning.md: a param target is sound because the caller IS the party choosing) - it
      // is NOT an author-fixed/self-pinned value being lifted, so no forgery. Hoist `IFoo(param.field)` into a
      // local; the param root is in scope at the body top.
      if (!this.usedInFn.has(paramField.localName)) {
        this.usedInFn.set(paramField.localName, { iface: paramField.iface, init: cloneNode(node.object) as ExpressionNode });
      }
      const loc = node.object.location;
      node.object = new IdentifierNode(paramField.localName);
      node.object.location = loc;
    } else if (localCastField && !ADDRESS_METHODS.has(node.methodName)
      && this.isInterfaceMethod(localCastField.iface, node.methodName)) {
      // `IFoo(local.addr).m()` where `local` is a single-assignment struct value (including an inliner-created
      // binding of a struct parameter). Capture at the call site: the local is live here and its actual value is
      // deterministically pinned by the script, while a body-top hoist could precede its declaration.
      const localName = `${PREFIX}lf${this.transitiveCounter}_${localCastField.iface}`;
      this.transitiveCounter += 1;
      const def = new VariableDefinitionNode(
        new AddressType(false, localCastField.iface), [], localName, localCastField.init,
      );
      def.location = node.object.location ?? node.location;
      this.pendingMidbodyDecls.push(def);
      const loc = node.object.location;
      node.object = new IdentifierNode(localName);
      node.object.location = loc;
    } else if (computed && !ADDRESS_METHODS.has(node.methodName)
      && this.isInterfaceMethod(computed.iface, node.methodName)) {
      // `IFoo(pairFor(factory, a, b)).m()`: an author-written COMPUTED target rooted in params/self-pinned state.
      // Hoist the alias-substituted `IFoo(<computed>)` cast (built + validated by castComputedTarget) into an
      // __extaddr_ local so the body-top decl reads params/state directly and the co-spend pins the computed address.
      if (!this.usedInFn.has(computed.localName)) {
        this.usedInFn.set(computed.localName, { iface: computed.iface, init: computed.init });
      }
      const loc = node.object.location;
      node.object = new IdentifierNode(computed.localName);
      node.object.location = loc;
    } else if (transitive && !ADDRESS_METHODS.has(node.methodName)
      && this.isInterfaceMethod(transitive.iface, node.methodName)) {
      // A TRANSITIVE computed target (a leaf is a mid-body single-assign local, e.g. a pinned call-return). Emit the
      // decl right BEFORE this statement (visitBlock flushes pendingMidbodyDecls) so the local is live; the co-spend
      // epilogue PICKs it by name, position-independently. A fresh name per use avoids collisions.
      const localName = `${PREFIX}t${this.transitiveCounter}_${transitive.iface}`;
      this.transitiveCounter += 1;
      const def = new VariableDefinitionNode(new AddressType(false, transitive.iface), [], localName, transitive.init);
      def.location = node.object.location ?? node.location;
      this.pendingMidbodyDecls.push(def);
      const loc = node.object.location;
      node.object = new IdentifierNode(localName);
      node.object.location = loc;
    } else if (LOW_LEVEL_CALLS.has(node.methodName) && node.object instanceof IdentifierNode
      && this.plainAddrStateVars.has(node.object.name)) {
      // A bare plain-address STATE receiver (`target.call(data)`) is not a caller/function parameter. Hoist it
      // just like an interface-typed state receiver so the external-call epilogue pins the co-spent callee to
      // the authenticated state value. `resolveLlReceiver` intentionally leaves bare identifiers alone because
      // bare PARAM receivers already work; this state-rooted form must not be confused with that caller witness.
      const localName = `${PREFIX}${node.object.name}`;
      if (!this.usedInFn.has(localName)) {
        this.usedInFn.set(localName, { iface: undefined, init: cloneNode(node.object) as ExpressionNode });
      }
      const loc = node.object.location;
      node.object = new IdentifierNode(localName);
      node.object.location = loc;
    } else if (pureCallIface && !ADDRESS_METHODS.has(node.methodName)
      && this.isInterfaceMethod(pureCallIface, node.methodName)) {
      const localName = this.captureAtCallSite(pureCallIface, node.object, node);
      const loc = node.object.location;
      node.object = new IdentifierNode(localName);
      node.object.location = loc;
    } else if (LOW_LEVEL_CALLS.has(node.methodName) && this.resolveLlReceiver(node.object)) {
      // `<recv>.call/staticcall/delegatecall(..)` where `<recv>` resolves to an address that is a self-pinned state
      // chain OR a param-rooted field. A bare-identifier receiver already sources in codegen; a field/element
      // receiver did not ("external call target must be a parameter"). Two forms reach here:
      //   - DIRECT: `t.dest.call(x)` - `t.dest` is a struct field / element of self-pinned state (or a param).
      //   - THROUGH INLINING: `address(__rh0_token).call(data)` where the SafeERC20/Address chain inlined
      //     `token = IERC20(jobs[id].token)` into a local - the receiver traces (through casts + inliner-local
      //     aliases) back to the same self-pinned state chain `jobs[id].token` (OZ forceApprove's
      //     `_callOptionalReturnBool` does a direct `address(token).call`).
      // Both hoist the resolved ROOT (the state/param chain, NOT the inlined-local receiver, which is not valid at
      // the body top) into a plain-`address` local. The pinned value is byte-identical to the shipped-sound direct
      // form `IFoo(jobs[id].token).call(data)`; the data arg keeps its form (codegen sources that).
      const resolved = this.resolveLlReceiver(node.object)!;
      if (!this.usedInFn.has(resolved.localName)) {
        this.usedInFn.set(resolved.localName, { iface: undefined, init: cloneNode(resolved.init) as ExpressionNode });
      }
      const loc = node.object.location;
      node.object = new IdentifierNode(resolved.localName);
      node.object.location = loc;
    } else {
      node.object = this.visit(node.object) as ExpressionNode;
    }
    node.parameters = this.visitList(node.parameters) as ExpressionNode[];
    if (node.callOptions?.value) node.callOptions.value = this.visit(node.callOptions.value) as ExpressionNode;
    if (node.callOptions?.gas) node.callOptions.gas = this.visit(node.callOptions.gas) as ExpressionNode;
    return node;
  }

  private captureAtCallSite(iface: string, init: ExpressionNode, call: Node): string {
    const localName = `${PREFIX}ctor${this.transitiveCounter}_${iface}`;
    this.transitiveCounter += 1;
    const def = new VariableDefinitionNode(
      new AddressType(false, iface), [], localName, cloneNode(init) as ExpressionNode,
    );
    def.location = init.location ?? call.location;
    this.pendingMidbodyDecls.push(def);
    return localName;
  }

  // Record a synthesized local for (stateVar, interface); returns its name. Interface-typed state vars keep the
  // `__extaddr_<sv>` name + a bare read (byte-identical to before); a plain-address cast target uses a
  // per-interface `__extaddr_<sv>_<iface>` name and re-casts to preserve the interface type.
  private markUsed(sv: string, iface: string, isPlain: boolean, castObj: ExpressionNode | undefined): string {
    const localName = isPlain ? `${PREFIX}${sv}_${iface}` : `${PREFIX}${sv}`;
    if (!this.usedInFn.has(localName)) {
      const init = isPlain && castObj
        ? cloneNode(castObj) as ExpressionNode           // `IFoo(a)` - preserves the interface type
        : new IdentifierNode(sv);                          // bare read of the interface-typed state var
      this.usedInFn.set(localName, { iface, init });
    }
    return localName;
  }

  // Hoist the underlying target of an interface-cast init expression (`IUnicrow(unicrowAddress)` / `IFoo(s.field)` /
  // `IFoo(param.field)`) into an __extaddr_ local, reusing the state-var / self-pinned-chain / param-field resolvers,
  // and return the local name. Undefined when the init is not a recognized (self-pinned or caller-witness) target.
  private hoistTargetLocalFor(init: ExpressionNode): string | undefined {
    const sv = this.externalTargetStateVar(init);
    if (sv) return this.markUsed(sv.name, sv.iface, sv.isPlain, init);
    const castChain = this.castChainTarget(init);
    const paramField = castChain ? undefined : this.castParamFieldTarget(init);
    const resolved = castChain ?? paramField;
    if (resolved) {
      if (!this.usedInFn.has(resolved.localName)) {
        this.usedInFn.set(resolved.localName, { iface: resolved.iface, init: cloneNode(init) as ExpressionNode });
      }
      return resolved.localName;
    }
    return undefined;
  }

  // `obj` is an interface/contract-typed field reached through a chain of self-pinned STATE - a struct field,
  // array element, or mapping value, possibly nested (`s.field`, `ss[i].field`, `ms[k].field`, `s.a.b`). Returns
  // the interface + a stable local name (from the chain shape, so identical chains dedup). Returns undefined
  // unless the whole chain is state-rooted with param/literal indices (sound + valid at the body top).
  private chainTarget(obj: ExpressionNode):
  { iface: string; localName: string; init: ExpressionNode } | undefined {
    // A direct interface-valued collection read (`strategies[token].exit(..)`) is the same self-pinned target
    // shape as an interface field reached through a collection. Hoist parameter/literal-indexed elements too.
    // Loop-local indices remain excluded by resolveChainType/indexSafe and continue through the per-iteration
    // array dispatch machinery.
    if (!(obj instanceof FieldAccessNode || obj instanceof MappingAccessNode
      || obj instanceof ArrayAccessNode || obj instanceof TupleIndexOpNode)) return undefined;
    // A single-assignment storage pointer is the same self-pinned chain (`S storage s = m[k]; s.target`).
    // Normalize its base before checking provenance and use the normalized chain as the body-top initializer.
    const normalized = this.inlineStoragePtrBases(cloneNode(obj) as ExpressionNode);
    const targetType = this.resolveChainType(normalized);
    if (!(targetType instanceof AddressType) || !targetType.interfaceName) return undefined;
    const key = this.chainKey(normalized);
    if (!key) return undefined;
    return { iface: targetType.interfaceName, localName: `${PREFIX}${key}`, init: normalized };
  }

  private localStructFieldTarget(obj: ExpressionNode): { iface: string } | undefined {
    if (!(obj instanceof FieldAccessNode) || !(obj.expression instanceof IdentifierNode)) return undefined;
    const localName = obj.expression.name;
    if (!localName.startsWith('__c2cache_') && !this.singleAssignLocals.has(localName)) return undefined;
    const init = this.localInits.get(localName);
    const structType = this.localStructTypes.get(localName)
      ?? (init ? this.resolveChainType(init) : undefined);
    if (!(structType instanceof StructType)) return undefined;
    const fieldType = structType.fields.find((field) => field.name === obj.name)?.type;
    return fieldType instanceof AddressType && fieldType.interfaceName ? { iface: fieldType.interfaceName } : undefined;
  }

  // `IFoo(<chain>)` where <chain> is an `address`-typed value reached through self-pinned STATE (a struct field,
  // array element, or mapping value) and IFoo is a known interface/contract - the cast supplies the callee ABI.
  // The state-var `IFoo(a)` cast (externalTargetStateVar, isPlain) generalized to a state ACCESS CHAIN. Returns
  // the interface + a stable per-(chain, iface) local name; undefined unless the whole chain is state-rooted with
  // param/literal indices (so the hoisted `IFoo(chain)` decl is sound + valid at the body top).
  private castChainTarget(obj: ExpressionNode): { iface: string; localName: string } | undefined {
    const iface = obj instanceof FunctionCallNode ? obj.identifier.name
      : obj instanceof ContractReferenceNode ? obj.contractName : undefined;
    const args = obj instanceof FunctionCallNode ? obj.parameters
      : obj instanceof ContractReferenceNode ? obj.constructorArgs : undefined;
    if (!iface || !args || args.length !== 1) return undefined;
    if (!this.typeNames.has(iface)) return undefined;
    const arg = args[0];
    if (arg instanceof IdentifierNode) return undefined; // bare state var / param - externalTargetStateVar's job
    if (!(this.resolveChainType(arg) instanceof AddressType)) return undefined;
    const key = this.chainKey(arg);
    if (!key) return undefined;
    return { iface, localName: `${PREFIX}${key}_${iface}` };
  }

  // `IFoo(<param-rooted access>)` - a field/element of a FUNCTION PARAM cast to an interface. Caller-supplied,
  // so a sound caller-witness target (extcall-target-pinning.md's param row), distinct from the self-pinned
  // state chain (castChainTarget). Only a param root qualifies - a plain local could be state-derived (its
  // author intent unknown), so those are left to fail closed rather than risk lifting a self-pinned value.
  private castParamFieldTarget(obj: ExpressionNode): { iface: string; localName: string } | undefined {
    if (!(obj instanceof FunctionCallNode) || obj.parameters.length !== 1) return undefined;
    const iface = obj.identifier.name;
    if (!this.typeNames.has(iface)) return undefined;
    const arg = obj.parameters[0];
    if (arg instanceof IdentifierNode) return undefined; // bare param already works in codegen
    if (!this.isParamRooted(arg)) return undefined;
    const key = this.chainKey(arg);
    if (!key) return undefined;
    return { iface, localName: `${PREFIX}${key}_${iface}` };
  }

  private castLocalStructFieldTarget(obj: ExpressionNode):
  { iface: string; init: ExpressionNode } | undefined {
    if (!(obj instanceof FunctionCallNode) || obj.parameters.length !== 1) return undefined;
    const iface = obj.identifier.name;
    if (!this.typeNames.has(iface)) return undefined;
    const arg = obj.parameters[0];
    if (!(arg instanceof FieldAccessNode) || !(arg.expression instanceof IdentifierNode)) return undefined;
    const localName = arg.expression.name;
    if (!SYNTH_ALIAS.test(localName) && !this.singleAssignLocals.has(localName)) return undefined;
    const init = this.localInits.get(localName);
    const structType = this.localStructTypes.get(localName)
      ?? (init ? this.resolveChainType(init) : undefined);
    if (!(structType instanceof StructType)) return undefined;
    const fieldType = structType.fields.find((field) => field.name === arg.name)?.type;
    if (!(fieldType instanceof AddressType)) return undefined;
    return { iface, init: cloneNode(obj) as ExpressionNode };
  }

  // After alias substitution, every leaf of a candidate body-top init must be a param or self-pinned state root -
  // any leftover identifier is an un-inlined local (would be an undeclared body-top reference), and any MethodCall
  // or value-prefixed dotted call (`__extaddr_router.factory()`) is an external call whose result is not a pure
  // body-top value (the transitive-extcall-target case is separate). Conservative: unknown shapes fail closed.
  // True if the subtree contains an external call: a MethodCallNode, or a dotted FunctionCallNode whose prefix is a
  // var (param / state / inliner alias) - `router.factory()` lowers to the latter (`__extaddr_router.factory`).
  // Used to keep a call-return alias as a materialised leaf in the transitive case, not inline the non-body-top call.
  private containsExternalCall(node: Node): boolean {
    let found = false;
    const walk = (n: unknown): void => {
      if (found || !n || typeof n !== 'object') return;
      if (n instanceof MethodCallNode) { found = true; return; }
      if (n instanceof FunctionCallNode) {
        const dot = n.identifier.name.lastIndexOf('.');
        if (dot > 0) {
          const prefix = n.identifier.name.slice(0, dot);
          if (this.currentParams.has(prefix) || this.stateRoots.has(prefix) || SYNTH_ALIAS.test(prefix)) {
            found = true; return;
          }
        }
      }
      for (const k of Object.keys(n)) {
        if (k === 'type' || k === 'symbolTable' || k === 'location') continue;
        const v = (n as Record<string, unknown>)[k];
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === 'object') walk(v);
      }
    };
    walk(node);
    return found;
  }

  // allowSingleAssign (transitive mid-body case): also accept a single-assign local leaf - a materialised value live
  // at the call site (a pinned call-return / param-derived local). SOUND: at-most-param-permissive (the covenant
  // still computes + pins the target from it), and the decl is placed right before the use where the local is live.
  private allLeavesBodyTop(node: Node, allowSingleAssign = false): boolean {
    let ok = true;
    const walk = (n: unknown): void => {
      if (!ok || !n || typeof n !== 'object') return;
      if (n instanceof MethodCallNode) { ok = false; return; }
      if (n instanceof IdentifierNode) {
        if (!this.currentParams.has(n.name) && !this.stateRoots.has(n.name)
          && !(allowSingleAssign && this.singleAssignLocals.has(n.name))) ok = false;
        return;
      }
      if (n instanceof FunctionCallNode) {
        const dot = n.identifier.name.lastIndexOf('.');
        if (dot > 0) {
          const prefix = n.identifier.name.slice(0, dot);
          if (this.currentParams.has(prefix) || this.stateRoots.has(prefix) || SYNTH_ALIAS.test(prefix)
            || (allowSingleAssign && this.singleAssignLocals.has(prefix))) {
            ok = false;
            return;
          }
        }
        n.parameters.forEach(walk); // the callee name is a fn/type, not a leaf; validate only the args
        return;
      }
      if (n instanceof MappingAccessNode) {
        if (!this.currentParams.has(n.name) && !this.stateRoots.has(n.name)) { ok = false; return; }
        n.keys.forEach(walk);
        return;
      }
      for (const k of Object.keys(n)) {
        if (k === 'type' || k === 'symbolTable' || k === 'location') continue;
        const v = (n as Record<string, unknown>)[k];
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === 'object') walk(v);
      }
    };
    walk(node);
    return ok;
  }

  // `IFoo(<computed>).m()` where <computed> is an author-written COMPUTED address rooted in params + self-pinned
  // state (`IUniswapV2Pair(pairFor(factory, tokenA, tokenB)).getReserves()`) - not a bare param, state var, state
  // chain, or param-field (those are handled by the recognizers before this). Hoist the whole `IFoo(<computed>)`
  // into an __extaddr_ local so the audited dispatch pins the co-spend to the runtime-computed target. SOUND: the
  // bytecode computes <computed> deterministically, so the identity check `input.lbc == <computed>` is real - the
  // caller supplies the inputs, never the target directly, so it is at most as permissive as the accepted param
  // form (extcall-target-pinning.md), and the author wrote the computed target (no silent fixed->caller lift).
  // Substitutes the inliner's SSA aliases then requires ALL leaves to be body-top-safe, so a partially-resolvable
  // (or external-call-containing) target fails closed rather than hoisting a broken/unsound decl.
  private castComputedTarget(obj: ExpressionNode): { iface: string; localName: string; init: ExpressionNode } | undefined {
    if (!(obj instanceof FunctionCallNode) || obj.parameters.length !== 1) return undefined;
    const iface = obj.identifier.name;
    if (!this.typeNames.has(iface)) return undefined;
    const arg = obj.parameters[0];
    // Only a COMPUTED call result `IFoo(pairFor(..))` - a bare param, a state var, a state/param chain, and an
    // array/field element (`IFoo(fns[i])`, the fn-ptr-array broadcast / loopArrayVar cases) are all handled by the
    // recognizers before this or by the array co-spend loop; hoisting those here would break their machinery. The
    // create2 address form `IFoo(address(uint(keccak256(..))))` wraps the computed call in numeric/address casts;
    // unwrap them so the wrapped call still qualifies (a cast over a bare param/state/chain stays excluded).
    let inner: ExpressionNode = arg;
    while (inner instanceof CastNode) inner = inner.expression;
    if (!(inner instanceof FunctionCallNode)) return undefined;
    const key = this.chainKey(arg);
    if (!key) return undefined;
    const init = cloneNode(obj) as ExpressionNode;
    this.substituteAliasesInPlace(init);
    if (!this.allLeavesBodyTop(init)) return undefined;
    return { iface, localName: `${PREFIX}${key}_${iface}`, init };
  }

  // A TRANSITIVE computed target `IFoo(pairFor(factory, a, b))` where a leaf `factory` is a single-assign local that
  // only exists MID-BODY (a pinned external-call return: `factory = IUniswapV2Factory(router.factory())`). Resolve
  // ONLY inliner aliases, KEEPING an alias whose init contains an external call as a materialised leaf, then require
  // every leaf to be a param / self-pinned state / single-assign local. Returns the cast to place as a decl RIGHT
  // BEFORE the use (visitBlock), where the local is live - a body-top hoist would read it before its definition.
  // SOUND: single-assign locals are computed from params/state/pinned-returns (at-most-param-permissive). SushiRoll.
  private castTransitiveTarget(obj: ExpressionNode): { iface: string; init: ExpressionNode } | undefined {
    if (!(obj instanceof FunctionCallNode) || obj.parameters.length !== 1) return undefined;
    const iface = obj.identifier.name;
    if (!this.typeNames.has(iface)) return undefined;
    let inner: ExpressionNode = obj.parameters[0];
    while (inner instanceof CastNode) inner = inner.expression;
    if (!(inner instanceof FunctionCallNode)) return undefined;
    if (!this.chainKey(obj.parameters[0])) return undefined;
    const init = cloneNode(obj) as ExpressionNode;
    this.substituteAliasesInPlace(init, true); // inlineOnly: keep user/call-return single-assign locals as leaves
    if (this.allLeavesBodyTop(init)) return undefined;        // pure body-top target -> castComputedTarget's job
    if (!this.allLeavesBodyTop(init, true)) return undefined; // a leaf is not param/state/single-assign -> fail closed
    return { iface, init };
  }

  // In-place: replace every synthetic SSA alias / single-assignment local identifier in `node` with a clone of its
  // (recursively resolved) init, so a hoisted computed target reads params/self-pinned state directly - valid at the
  // body top, where the inliner's `__rh*` locals are not yet declared. Mutates a CLONE only (never the original AST).
  private substituteAliasesInPlace(node: Node, inlineOnly = false): void {
    const resolve = (id: IdentifierNode): Node | undefined => {
      if (!this.localInits.has(id.name)) return undefined;
      // inlineOnly (transitive case): resolve ONLY inliner SSA aliases, keeping a user single-assign local intact.
      if (!(SYNTH_ALIAS.test(id.name) || (!inlineOnly && this.singleAssignLocals.has(id.name)))) return undefined;
      const clone = cloneNode(this.localInits.get(id.name)!) as Node;
      // Transitive case: an alias whose init contains an external call (`__rh_factory = IFactory(router.factory())`)
      // is a MATERIALISED call-return on the stack - keep the alias as a live leaf instead of inlining the (non-body-
      // top) call. It is a single-assign local, so the mid-body gate (allLeavesBodyTop, allowSingleAssign) accepts it.
      if (inlineOnly && this.containsExternalCall(clone)) return undefined;
      // The init may itself be a bare alias identifier (`__rh5_x = __rh3_x = ... = x`, chained across inline levels);
      // follow the chain, else substituteAliasesInPlace (which only rewrites CHILD identifiers, never the top-level
      // node) would leave the first link unresolved. Router02 getAmountsOut -> getReserves -> pairFor(__rh_tokenA).
      if (clone instanceof IdentifierNode) { const chained = resolve(clone); if (chained) return chained; }
      this.substituteAliasesInPlace(clone, inlineOnly);
      return clone;
    };
    for (const k of Object.keys(node)) {
      if (k === 'type' || k === 'symbolTable' || k === 'location') continue;
      const rec = node as unknown as Record<string, unknown>;
      const v = rec[k];
      if (v instanceof IdentifierNode) {
        const r = resolve(v); if (r) rec[k] = r; else this.substituteAliasesInPlace(v, inlineOnly);
      } else if (v instanceof Node) this.substituteAliasesInPlace(v, inlineOnly);
      else if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i += 1) {
          if (v[i] instanceof IdentifierNode) {
            const r = resolve(v[i] as IdentifierNode);
            if (r) v[i] = r; else this.substituteAliasesInPlace(v[i] as Node, inlineOnly);
          } else if (v[i] instanceof Node) this.substituteAliasesInPlace(v[i] as Node, inlineOnly);
        }
      }
    }
  }

  // The access chain is rooted at a function param (base identifier is a param), stepping only through fields
  // and param/literal indices - entirely caller-supplied and valid at the body top. NOT true for a state root
  // (that is castChainTarget's self-pinned job) or a plain local.
  private isParamRooted(expr: ExpressionNode): boolean {
    if (expr instanceof IdentifierNode) return this.currentParams.has(expr.name);
    if (expr instanceof FieldAccessNode) return this.isParamRooted(expr.expression);
    if (expr instanceof ArrayAccessNode) return this.indexSafe(expr.index) && this.isParamRooted(expr.array);
    if (expr instanceof TupleIndexOpNode) return this.isParamRooted(expr.tuple);
    if (expr instanceof MappingAccessNode) {
      return this.currentParams.has(expr.name) && expr.keys.every((k) => this.indexSafe(k));
    }
    return false;
  }

  // Trace a low-level-call receiver to its provenance ROOT, unwrapping `address(..)` / interface casts and
  // following SYNTHETIC single-assignment alias locals (`__rh*` / `__inl*` from the inliner, `__extaddr_*` from
  // this pass) through their recorded initializers. A user local is NOT followed (it may be reassigned - only the
  // inliner's SSA-style bindings are safe to trace), so this stays scoped to the SafeERC20/Address inline chain
  // and never re-interprets user-visible aliasing. Returns the deepest expression reached.
  private llReceiverRoot(expr: ExpressionNode, depth = 0): ExpressionNode {
    if (depth > 24) return expr; // guard against a pathological init cycle
    if (expr instanceof CastNode) return this.llReceiverRoot(expr.expression, depth + 1);
    if (expr instanceof FunctionCallNode && expr.parameters.length === 1 && this.typeNames.has(expr.identifier.name)) {
      return this.llReceiverRoot(expr.parameters[0], depth + 1); // interface/contract cast `IFoo(x)` -> x
    }
    if (expr instanceof IdentifierNode && this.localInits.has(expr.name)
      && (SYNTH_ALIAS.test(expr.name) || this.singleAssignLocals.has(expr.name))) {
      return this.llReceiverRoot(this.localInits.get(expr.name)!, depth + 1);
    }
    return expr;
  }

  // Names safe to trace through as value-equal-to-init aliases: declared exactly once WITH an initializer and
  // never the target of a later assignment (plain `x = ..` or an `existing` tuple slot) nor re-declared. A
  // reassignable local is EXCLUDED - tracing it could pin a value the caller later rebinds (the forgery
  // extcall-target-pinning.md forbids). Inliner locals (`__rh*`/`__inl*`) are SSA and handled separately.
  // Populate localInits from every `VariableDefinition name = init` in the body, up front, so alias resolution
  // (substituteAliasesInPlace) is independent of the mid-visit order (visitVariableDefinition still refreshes an
  // entry when it reaches it). Only single-assignment aliases are ever traced, so a whole-body view is sound.
  private collectLocalInitsUpfront(body: BlockNode): void {
    const seen = new WeakSet<object>();
    const scan = (node: unknown): void => {
      if (!node || typeof node !== 'object' || seen.has(node)) return;
      seen.add(node);
      if (node instanceof VariableDefinitionNode && node.expression) {
        this.localInits.set(node.name, node.expression);
        if (node.type instanceof StructType) this.localStructTypes.set(node.name, node.type);
        if (node.modifier.includes(Modifier.STORAGE)
          // Earlier storage desugaring can erase the source modifier while retaining the self-pinned initializer.
          // A struct local initialized directly from a state mapping/array element is necessarily that reference
          // shape; ordinary memory copies do not read a state container as their initializer.
          || (node.type instanceof StructType && this.resolveChainType(node.expression) instanceof StructType)) {
          this.storagePointerLocals.add(node.name);
        }
      }
      // A tuple-destructured declaration `(address input, address output) = (path[i], path[i+1])` (swap loops) or
      // `(address t0, address t1) = sortTokens(a, b)` (pairFor): map each NEW element to its per-slot RHS (a tuple
      // literal element) or the i-th value of the tuple-returning call, so it resolves like any single-assign local.
      if (node instanceof TupleAssignmentNode) {
        node.elements.forEach((el, i) => {
          if (!el.name || el.existing || el.skip) return;
          const rhs = node.tupleExpressions?.[i]
            ?? (node.tuple ? new TupleIndexOpNode(node.tuple, i) : undefined);
          if (rhs) this.localInits.set(el.name, rhs);
        });
      }
      for (const key of Object.keys(node as Record<string, unknown>)) {
        const v = (node as Record<string, unknown>)[key];
        if (Array.isArray(v)) v.forEach(scan);
        else if (v instanceof Node) scan(v);
      }
    };
    scan(body);
  }

  private computeSingleAssignLocals(body: BlockNode): Set<string> {
    const declCount = new Map<string, number>();
    const reassigned = new Set<string>();
    const seen = new WeakSet<object>();
    const scan = (node: unknown, loopDepth: number): void => {
      if (!node || typeof node !== 'object' || seen.has(node)) return;
      seen.add(node);
      // A var declared / tuple-bound INSIDE a loop re-runs each iteration, so its value is position-DEPENDENT, not a
      // single fixed value - it must NOT count as single-assign (otherwise a computed target `IFoo(pairFor(.., arr[i],
      // ..))` would resolve arr[i] to a fixed index and hoist to the body top, losing the per-iteration index). Router02.
      const inLoop = loopDepth > 0;
      if (node instanceof VariableDefinitionNode) {
        if (inLoop) reassigned.add(node.name);
        else {
          declCount.set(node.name, (declCount.get(node.name) ?? 0) + (node.expression ? 1 : 0));
          if (!node.expression) reassigned.add(node.name); // uninit decl -> assigned elsewhere, not traceable
        }
      } else if (node instanceof AssignNode) {
        reassigned.add(node.identifier.name);
      } else if (node instanceof TupleAssignmentNode) {
        for (const el of node.elements) {
          if (el.existing && el.name) reassigned.add(el.name);
          else if (el.name && !el.skip) {
            if (inLoop) reassigned.add(el.name);
            else declCount.set(el.name, (declCount.get(el.name) ?? 0) + 1);
          }
        }
      }
      const childDepth = (node instanceof WhileNode || node instanceof DoWhileNode
        || node instanceof CollectionIterationNode) ? loopDepth + 1 : loopDepth;
      for (const key of Object.keys(node as Record<string, unknown>)) {
        const v = (node as Record<string, unknown>)[key];
        if (Array.isArray(v)) v.forEach((x) => scan(x, childDepth));
        else if (v instanceof Node) scan(v, childDepth);
      }
    };
    scan(body, 0);
    const safe = new Set<string>();
    for (const [name, count] of declCount) if (count === 1 && !reassigned.has(name)) safe.add(name);
    return safe;
  }

  // A low-level-call receiver worth hoisting into a plain-`address` local, resolved to its provenance root: a
  // self-pinned state chain (`t.dest` == `txs[id].dest`, or `address(__rh0_token)` traced back to `jobs[id].token`)
  // OR a param-rooted access. A bare PARAM receiver already sources in codegen; a bare STATE receiver must still
  // be hoisted because the external-call epilogue runs after the body and can only name a surviving local.
  // Returns a stable per-root local name + the ROOT to hoist as its init (valid at the body top), else undefined.
  private resolveLlReceiver(obj: ExpressionNode): { localName: string; init: ExpressionNode } | undefined {
    if (obj instanceof IdentifierNode && this.llReceiverRoot(obj) === obj
      && !this.stateRoots.has(obj.name)) return undefined; // bare parameter/local receiver works
    // Resolve the receiver to its provenance root, then inline any single-assignment storage-pointer local at the
    // base of the resulting chain (`JobPost storage job = jobs[id]; job.token` -> `jobs[id].token`) - the AstBuilder
    // usually inlines the storage alias, but not always (EACC Marketplace takeJob), so do it here for the target.
    const root = this.inlineStoragePtrBases(cloneNode(this.llReceiverRoot(obj)) as ExpressionNode);
    if (!(this.resolveChainType(root) instanceof AddressType) && !this.isParamRooted(root)) return undefined;
    const key = this.chainKey(root);
    return key ? { localName: `${PREFIX}ll_${key}`, init: root } : undefined;
  }

  // Replace a single-assignment STORAGE-POINTER local at the base of an access chain with its initializer, so
  // `job.token` (where `JobPost storage job = jobs[id]`) becomes the self-pinned state chain `jobs[id].token`.
  // Sound: a storage pointer is an alias to the same slots, and the local is single-assignment. Mutates in place
  // (the caller passes a clone); indices in the reached chain are params/literals (resolveChainType re-validates).
  private inlineStoragePtrBases(expr: ExpressionNode, depth = 0): ExpressionNode {
    if (depth > 24) return expr;
    if (expr instanceof IdentifierNode
      && (this.singleAssignLocals.has(expr.name) || this.storagePointerLocals.has(expr.name))
      && this.localInits.has(expr.name)) {
      return this.inlineStoragePtrBases(cloneNode(this.localInits.get(expr.name)!) as ExpressionNode, depth + 1);
    }
    if (expr instanceof FieldAccessNode) {
      expr.expression = this.inlineStoragePtrBases(expr.expression, depth + 1);
    } else if (expr instanceof ArrayAccessNode) {
      expr.array = this.inlineStoragePtrBases(expr.array, depth + 1);
    }
    return expr;
  }

  // The declared type of a state-rooted access chain (self-pinned): a state var / collection identifier, a
  // struct field of one, or an array element / mapping value (indexed only by a param or literal, so the read
  // stays valid when hoisted to the body top). Returns undefined for anything else (a local, an unsafe index).
  private resolveChainType(expr: ExpressionNode): Type | undefined {
    if (expr instanceof IdentifierNode) return this.stateRoots.get(expr.name);
    if (expr instanceof FieldAccessNode) {
      const base = this.resolveChainType(expr.expression);
      return base instanceof StructType ? base.fields.find((f) => f.name === expr.name)?.type : undefined;
    }
    if (expr instanceof MappingAccessNode) { // pre-semantic `x[i]` (array-vs-mapping not yet resolved)
      if (!expr.keys.every((k) => this.indexSafe(k))) return undefined;
      return elementOf(this.stateRoots.get(expr.name));
    }
    if (expr instanceof ArrayAccessNode) {
      if (!this.indexSafe(expr.index)) return undefined;
      return elementOf(this.resolveChainType(expr.array));
    }
    if (expr instanceof TupleIndexOpNode) { // a numeric-literal array index (`ss[0]`) parses as this; always safe
      return elementOf(this.resolveChainType(expr.tuple));
    }
    return undefined;
  }

  // An index safe to evaluate at the function-body top: a literal, or a param (params are in scope there); NOT
  // a local (declared later) - hoisting a local-indexed read would reference an undeclared name.
  private indexSafe(e: ExpressionNode): boolean {
    return e instanceof IntLiteralNode
      || (e instanceof IdentifierNode && (this.currentParams.has(e.name) || this.stateRoots.has(e.name)));
  }

  // A stable underscore-joined name fragment for an access chain (root + fields + literal/param indices), so two
  // syntactically-identical chains map to the same synthesized local. Undefined if any part is not name-able.
  private chainKey(expr: ExpressionNode): string | undefined {
    if (expr instanceof IdentifierNode) return expr.name;
    if (expr instanceof IntLiteralNode) return String(expr.value);
    if (expr instanceof FieldAccessNode) {
      const base = this.chainKey(expr.expression);
      return base && `${base}_${expr.name}`;
    }
    if (expr instanceof MappingAccessNode) {
      const keys = expr.keys.map((k) => this.chainKey(k));
      return keys.every((k) => k) ? `${expr.name}_${keys.join('_')}` : undefined;
    }
    if (expr instanceof ArrayAccessNode) {
      const arr = this.chainKey(expr.array); const idx = this.chainKey(expr.index);
      return arr && idx ? `${arr}_${idx}` : undefined;
    }
    if (expr instanceof TupleIndexOpNode) {
      const t = this.chainKey(expr.tuple);
      return t ? `${t}_${expr.index}` : undefined;
    }
    // A computed target `IFoo(pairFor(factory, a, b))` - key off the (internal/library) call name + arg keys so
    // identical computed targets dedup to one hoisted local; a cast `IFoo(x)` keys off its inner expression.
    if (expr instanceof FunctionCallNode) {
      const args = expr.parameters.map((p) => this.chainKey(p as ExpressionNode));
      return args.every((a) => a) ? `${expr.identifier.name.replace(/\./g, '_')}_${args.join('_')}` : undefined;
    }
    if (expr instanceof CastNode) return this.chainKey(expr.expression);
    return undefined;
  }

  // The state-var external target of `obj`, if any:
  //   - bare `pool` where pool is an interface-typed state var;
  //   - `IFace(pool)` where pool is interface-typed and IFace is its (redundant, no-op) interface;
  //   - `IFoo(a)` where a is a plain-`address` state var and IFoo is a known interface/contract (the cast
  //     supplies the callee ABI). isPlain distinguishes the plain-address case (needs the re-cast init).
  private externalTargetStateVar(obj: ExpressionNode): { name: string; iface: string; isPlain: boolean } | undefined {
    if (obj instanceof IdentifierNode && this.stateVarIface.has(obj.name)) {
      return { name: obj.name, iface: this.stateVarIface.get(obj.name)!, isPlain: false };
    }
    if (obj instanceof FunctionCallNode && obj.parameters.length === 1) {
      let arg = obj.parameters[0] as ExpressionNode;
      // `I(address(child)).m()` is the same identity cast as `I(child).m()`. Contract-typed state variables are
      // represented by AddressType(interfaceName=Contract), so preserve the outer interface cast in the hoisted
      // initializer while tracing through any address/contract identity wrappers to the self-pinned state root.
      while (arg instanceof CastNode && arg.type instanceof AddressType) arg = arg.expression;
      const castName = obj.identifier.name;
      if (arg instanceof IdentifierNode) {
        // redundant same-interface cast on an interface-typed state var
        if (this.stateVarIface.get(arg.name) === castName) {
          return { name: arg.name, iface: castName, isPlain: false };
        }
        // contract/interface-typed state var exposed through a different interface ABI
        if (this.stateVarIface.has(arg.name) && this.typeNames.has(castName)) {
          return { name: arg.name, iface: castName, isPlain: true };
        }
        // interface/contract cast on a plain-`address` state var
        if (this.plainAddrStateVars.has(arg.name) && this.typeNames.has(castName)) {
          return { name: arg.name, iface: castName, isPlain: true };
        }
      }
    }
    return undefined;
  }
}
