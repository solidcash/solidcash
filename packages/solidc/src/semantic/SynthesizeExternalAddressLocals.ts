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
} from '../ast/AST.js';
import { AddressType, StructType } from '@solidcash/utils';
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

export default class SynthesizeExternalAddressLocals extends AstTraversal {
  private stateVarIface: Map<string, string> = new Map(); // interface-typed state var name -> interface name
  private plainAddrStateVars: Set<string> = new Set();    // plain-`address` state var names (no interfaceName)
  private structStateVars: Map<string, StructType> = new Map(); // struct-typed state var name -> its struct type
  private typeNames: Set<string> = new Set();             // interface + contract names usable as a cast target
  // localName -> synthesized decl parts (init reads the self-pinned state; iface = the local's interface type)
  private usedInFn: Map<string, { iface: string; init: ExpressionNode }> = new Map();

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
    this.structStateVars = new Map();
    for (const sv of node.stateVariables) {
      if (sv.type instanceof StructType) { this.structStateVars.set(sv.name, sv.type); continue; }
      if (!(sv.type instanceof AddressType)) continue;
      if (sv.type.interfaceName) this.stateVarIface.set(sv.name, sv.type.interfaceName);
      else this.plainAddrStateVars.add(sv.name);
    }
    if (this.stateVarIface.size > 0 || this.plainAddrStateVars.size > 0 || this.structStateVars.size > 0) {
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
    const structTarget = target ? undefined : this.structFieldTarget(node.object);
    if (target && !ADDRESS_METHODS.has(node.methodName)) {
      const localName = this.markUsed(target.name, target.iface, target.isPlain, node.object);
      const loc = node.object.location;
      node.object = new IdentifierNode(localName);
      node.object.location = loc;
    } else if (structTarget && !ADDRESS_METHODS.has(node.methodName)) {
      // `s.target.m()` where `s` is a struct STATE var and `target` is an interface/contract-typed field:
      // hoist the field read into a local so the audited __extaddr_ dispatch pins the co-spend to it. The
      // field lives in self-pinned state (§4.1), so the read is sound - a caller cannot substitute it.
      const localName = this.markUsedField(structTarget.sv, structTarget.field, structTarget.iface, node.object);
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

  // `s.field` where `s` is a struct STATE var and `field` is an interface/contract-typed member (sound:
  // the field is self-pinned state). Single-level only; nested array/struct chains stay unsupported.
  private structFieldTarget(obj: ExpressionNode): { sv: string; field: string; iface: string } | undefined {
    if (!(obj instanceof FieldAccessNode) || !(obj.expression instanceof IdentifierNode)) return undefined;
    const st = this.structStateVars.get(obj.expression.name);
    if (!st) return undefined;
    const fieldType = st.fields.find((f) => f.name === obj.name)?.type;
    if (fieldType instanceof AddressType && fieldType.interfaceName) {
      return { sv: obj.expression.name, field: obj.name, iface: fieldType.interfaceName };
    }
    return undefined;
  }

  // Record a synthesized `IFace __extaddr_<sv>_<field> = s.field;` local (the init reads self-pinned state).
  private markUsedField(sv: string, field: string, iface: string, fieldAccess: ExpressionNode): string {
    const localName = `${PREFIX}${sv}_${field}`;
    if (!this.usedInFn.has(localName)) {
      this.usedInFn.set(localName, { iface, init: cloneNode(fieldAccess) as ExpressionNode });
    }
    return localName;
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
