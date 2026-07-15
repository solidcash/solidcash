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
} from '../ast/AST.js';
import {
  AddressType, StructType, ArrayType, MappingType, Type,
} from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

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

  visitSourceFile(node: SourceFileNode): Node {
    this.typeNames = new Set();
    for (const iface of node.interfaceDefinitions as InterfaceNode[]) this.typeNames.add(iface.name);
    for (const c of node.importedContracts as ContractNode[]) this.typeNames.add(c.name);
    if (node.contract) this.typeNames.add(node.contract.name);
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
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
    if (this.stateVarIface.size > 0 || this.plainAddrStateVars.size > 0 || hasStructRoot) {
      node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
      // fallback/receive are external entry points like any function (e.g. a re-entrancy fallback that calls
      // back into another contract); visit them too. The state var is already set by the time they run.
      if (node.fallbackDef) node.fallbackDef = this.visitFunctionDefinition(node.fallbackDef) as FunctionDefinitionNode;
      if (node.receiveDef) node.receiveDef = this.visitFunctionDefinition(node.receiveDef) as FunctionDefinitionNode;
    }
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    if (!node.body) return node;
    this.usedInFn = new Map();
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

  visitFunctionCall(node: FunctionCallNode): Node {
    const name = node.identifier.name;
    const dot = name.indexOf('.');
    if (dot > 0) {
      const varName = name.slice(0, dot);
      const method = name.slice(dot + 1);
      if (this.stateVarIface.has(varName) && !ADDRESS_METHODS.has(method)) {
        this.markUsed(varName, this.stateVarIface.get(varName)!, false, undefined);
        const loc = node.identifier.location;
        node.identifier = new IdentifierNode(`${PREFIX}${varName}.${method}`);
        node.identifier.location = loc;
      }
    }
    node.parameters = this.visitList(node.parameters) as ExpressionNode[];
    return node;
  }

  // `token.method{value:}(..)` (interface-typed state var) or `IFoo(a).method(..)` (plain-`address` state var
  // behind an interface cast): rewrite the object to the synthesized __extaddr_ local.
  visitMethodCall(node: MethodCallNode): Node {
    const target = this.externalTargetStateVar(node.object);
    const chain = target ? undefined : this.chainTarget(node.object);
    const castChain = target || chain ? undefined : this.castChainTarget(node.object);
    const paramField = target || chain || castChain ? undefined : this.castParamFieldTarget(node.object);
    if (target && !ADDRESS_METHODS.has(node.methodName)) {
      const localName = this.markUsed(target.name, target.iface, target.isPlain, node.object);
      const loc = node.object.location;
      node.object = new IdentifierNode(localName);
      node.object.location = loc;
    } else if (chain && !ADDRESS_METHODS.has(node.methodName)) {
      // `s.field.m()` / `ss[i].field.m()` / `ms[k].field.m()` / `s.a.b.m()`: the target is an interface-typed
      // field reached through a chain of self-pinned STATE (struct fields, array elements, mapping values). Hoist
      // the whole field read into a local so the audited __extaddr_ dispatch pins the co-spend to it - a caller
      // cannot substitute a self-pinned value (extcall-target-pinning.md). Indices are params/literals, so the
      // hoisted decl is valid at the function-body top.
      if (!this.usedInFn.has(chain.localName)) {
        this.usedInFn.set(chain.localName, { iface: chain.iface, init: cloneNode(node.object) as ExpressionNode });
      }
      const loc = node.object.location;
      node.object = new IdentifierNode(chain.localName);
      node.object.location = loc;
    } else if (castChain && !ADDRESS_METHODS.has(node.methodName)) {
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
    } else if (paramField && !ADDRESS_METHODS.has(node.methodName)) {
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
    } else if (LOW_LEVEL_CALLS.has(node.methodName) && this.llReceiverTarget(node.object)) {
      // `<recv>.call/staticcall/delegatecall(..)` where `<recv>` is a struct field / element resolving to an
      // address (self-pinned state chain OR a param-rooted field). A bare-identifier receiver already sources in
      // codegen; a field/element receiver did not ("external call target must be a parameter"). Hoist it into a
      // plain-`address` local (`t.dest.call(x)` -> `address __extaddr_ll_t_dest = t.dest; __extaddr_ll_...call(x)`),
      // same soundness as the interface-target hoist. The data arg keeps its field form (codegen sources that).
      const localName = this.llReceiverTarget(node.object)!;
      if (!this.usedInFn.has(localName)) {
        this.usedInFn.set(localName, { iface: undefined, init: cloneNode(node.object) as ExpressionNode });
      }
      const loc = node.object.location;
      node.object = new IdentifierNode(localName);
      node.object.location = loc;
    } else {
      node.object = this.visit(node.object) as ExpressionNode;
    }
    node.parameters = this.visitList(node.parameters) as ExpressionNode[];
    if (node.callOptions?.value) node.callOptions.value = this.visit(node.callOptions.value) as ExpressionNode;
    if (node.callOptions?.gas) node.callOptions.gas = this.visit(node.callOptions.gas) as ExpressionNode;
    return node;
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

  // `obj` is an interface/contract-typed field reached through a chain of self-pinned STATE - a struct field,
  // array element, or mapping value, possibly nested (`s.field`, `ss[i].field`, `ms[k].field`, `s.a.b`). Returns
  // the interface + a stable local name (from the chain shape, so identical chains dedup). Returns undefined
  // unless the whole chain is state-rooted with param/literal indices (sound + valid at the body top).
  private chainTarget(obj: ExpressionNode): { iface: string; localName: string } | undefined {
    if (!(obj instanceof FieldAccessNode)) return undefined;
    const base = this.resolveChainType(obj.expression);
    if (!(base instanceof StructType)) return undefined;
    const fieldType = base.fields.find((f) => f.name === obj.name)?.type;
    if (!(fieldType instanceof AddressType) || !fieldType.interfaceName) return undefined;
    const key = this.chainKey(obj);
    if (!key) return undefined;
    return { iface: fieldType.interfaceName, localName: `${PREFIX}${key}` };
  }

  // `IFoo(<chain>)` where <chain> is an `address`-typed value reached through self-pinned STATE (a struct field,
  // array element, or mapping value) and IFoo is a known interface/contract - the cast supplies the callee ABI.
  // The state-var `IFoo(a)` cast (externalTargetStateVar, isPlain) generalized to a state ACCESS CHAIN. Returns
  // the interface + a stable per-(chain, iface) local name; undefined unless the whole chain is state-rooted with
  // param/literal indices (so the hoisted `IFoo(chain)` decl is sound + valid at the body top).
  private castChainTarget(obj: ExpressionNode): { iface: string; localName: string } | undefined {
    if (!(obj instanceof FunctionCallNode) || obj.parameters.length !== 1) return undefined;
    const iface = obj.identifier.name;
    if (!this.typeNames.has(iface)) return undefined;
    const arg = obj.parameters[0];
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

  // A low-level-call receiver worth hoisting into a plain-`address` local: a struct field / element (NOT a bare
  // identifier - those already source in codegen) that is either a self-pinned state chain resolving to an
  // `address`, or a param-rooted access. Returns a stable per-chain local name, else undefined.
  private llReceiverTarget(obj: ExpressionNode): string | undefined {
    if (obj instanceof IdentifierNode) return undefined; // bare local/param receiver already works
    if (!(this.resolveChainType(obj) instanceof AddressType) && !this.isParamRooted(obj)) return undefined;
    const key = this.chainKey(obj);
    return key ? `${PREFIX}ll_${key}` : undefined;
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
      const arg = obj.parameters[0];
      const castName = obj.identifier.name;
      if (arg instanceof IdentifierNode) {
        // redundant same-interface cast on an interface-typed state var
        if (this.stateVarIface.get(arg.name) === castName) {
          return { name: arg.name, iface: castName, isPlain: false };
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
