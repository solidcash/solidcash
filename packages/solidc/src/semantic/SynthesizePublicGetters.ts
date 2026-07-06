import {
  ContractNode,
  FunctionDefinitionNode,
  SourceFileNode,
  Node,
  BlockNode,
  ReturnNode,
  StateAccessNode,
  MappingAccessNode,
  ArrayAccessNode,
  IdentifierNode,
  ParameterNode,
  StateVariableVisibility,
} from '../ast/AST.js';
import { MappingType, ArrayType, IntType, BytesType, PrimitiveType, AddressType, Type } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';

// Only synthesize getters for types whose declared type resolves byte-identically to `this.x` during semantic
// analysis. Enum/contract state vars are stored as AddressType placeholders (interfaceName set) pre-semantic but
// resolve to EnumType/contract addresses later, so a placeholder-typed getter trips ReturnTypeMismatch;
// struct/array getters have different ABI shapes. Restrict to plain value types + a GENUINE address (no
// interfaceName - a real `address`, not an enum/contract placeholder) to stay sound.
const SAFE_PRIMS = new Set<unknown>([
  PrimitiveType.BOOL, PrimitiveType.STRING, PrimitiveType.BIGINT, PrimitiveType.INT,
  PrimitiveType.PUBKEY, PrimitiveType.SIG, PrimitiveType.DATASIG,
]);
const isSafeGetterType = (t: Type): boolean =>
  t instanceof IntType || t instanceof BytesType || SAFE_PRIMS.has(t)
  || (t instanceof AddressType && !t.interfaceName);

/**
 * Solidity auto-generates an external getter for every `public` state variable / mapping:
 *   `T x`                      -> `function x() returns (T) { return this.x; }`
 *   `mapping(K1=>..=>V) m`     -> `function m(K1,..) returns (V) { return this.m[k1]..[kn]; }`
 * solidcash does not (native code reads cross-contract state via `IFoo(category).stateVar`), so a ported
 * contract whose callee is invoked via such a getter (e.g. `timeLock.lockTime(addr)`) has no dispatchable
 * target. This pass synthesizes those getters as real entry-point functions so the callee dispatches them and
 * the caller resolves + selector-verifies them like any external call. Gated on solidityImportCompat (only
 * Solidity ports want it); skipped for native solidcash so the external-read model is untouched.
 */
export default class SynthesizePublicGetters extends AstTraversal {
  constructor(private enabled: boolean) { super(); }

  visitSourceFile(node: SourceFileNode): Node {
    if (!this.enabled) return node;
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    // Secondary contracts in the file (callees, e.g. a `TimeLock` invoked via `timeLock.lockTime(addr)`) need
    // their getters dispatchable too.
    node.importedContracts = node.importedContracts.map((c) => this.visit(c) as ContractNode);
    return node;
  }

  visitContract(node: ContractNode): Node {
    const isPub = (v: StateVariableVisibility): boolean =>
      v === StateVariableVisibility.PUBLIC || v === StateVariableVisibility.EXTERNAL;
    const existing = new Set(node.functions.map((f) => f.name));
    const fallback = node.location;
    const getters: FunctionDefinitionNode[] = [];

    for (const sv of node.stateVariables) {
      if (!isPub(sv.visibility) || existing.has(sv.name)) continue;
      const loc = sv.location ?? fallback;
      // A public array's getter takes a uint index and returns the element (`function a(uint i) returns (T)
      // { return this.a[i]; }`), like Solidity. Value-element only (struct/nested/enum-placeholder elements
      // keep the whole-array read model, same restriction as scalars/mappings).
      if (sv.type instanceof ArrayType) {
        if (!isSafeGetterType(sv.type.elementType)) continue;
        const idxName = '__getterIndex';
        const key = Object.assign(new ParameterNode(new IntType(false, 256), idxName), { location: loc });
        const stateRead = Object.assign(new StateAccessNode(sv.name), { location: loc });
        const read = Object.assign(new ArrayAccessNode(stateRead, Object.assign(new IdentifierNode(idxName),
          { location: loc })), { location: loc });
        const body = Object.assign(new BlockNode([Object.assign(new ReturnNode([read]), { location: loc })]),
          { location: loc });
        const fn = new FunctionDefinitionNode(sv.name, [key], body);
        fn.returnTypes = [sv.type.elementType];
        fn.location = loc;
        getters.push(fn);
        continue;
      }
      if (!isSafeGetterType(sv.type)) continue;
      const read = new StateAccessNode(sv.name); read.location = loc;
      const body = new BlockNode([Object.assign(new ReturnNode([read]), { location: loc })]); body.location = loc;
      const fn = new FunctionDefinitionNode(sv.name, [], body);
      fn.returnTypes = [sv.type];
      fn.location = loc;
      getters.push(fn);
    }

    for (const coll of node.collections) {
      if (!isPub(coll.visibility) || existing.has(coll.name)) continue;
      if (!(coll.type instanceof MappingType)) continue;
      const loc = coll.location ?? fallback;
      const keys: ParameterNode[] = [];
      const keyArgs: IdentifierNode[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let t: any = coll.type;
      let i = 0;
      while (t instanceof MappingType) {
        const kn = `__getterKey${i += 1}`;
        keys.push(Object.assign(new ParameterNode(t.keyType, kn), { location: loc }));
        keyArgs.push(Object.assign(new IdentifierNode(kn), { location: loc }));
        t = t.valueType;
      }
      if (!isSafeGetterType(t)) continue; // complex value getter (struct/array/enum/address)
      const read = new MappingAccessNode(coll.name, keyArgs); read.location = loc;
      const body = new BlockNode([Object.assign(new ReturnNode([read]), { location: loc })]); body.location = loc;
      const fn = new FunctionDefinitionNode(coll.name, keys, body);
      fn.returnTypes = [t];
      fn.location = loc;
      getters.push(fn);
    }

    node.functions = [...node.functions, ...getters];
    return node;
  }
}
