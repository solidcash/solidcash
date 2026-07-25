import {
  ContractNode,
  FunctionDefinitionNode,
  SourceFileNode,
  Node,
  BlockNode,
  ReturnNode,
  StateAccessNode,
  ArrayAccessNode,
  FieldAccessNode,
  IdentifierNode,
  ExpressionNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  ExpressionStatementNode,
  ParameterNode,
  TupleAssignmentNode,
  StateVariableVisibility,
  FunctionModifier,
} from '../ast/AST.js';
import {
  MappingType, ArrayType, IntType, BytesType, PrimitiveType, AddressType, StructType, EnumType, FunctionType, Type,
} from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

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
 * the caller resolves + selector-verifies them like any external call. Gated (only Solidity ports that make such
 * external calls want it) - it appends getter functions, which changes the ABI + bytecode, so it is not a silent
 * default; getters-for-reading are provided as SDK sugar (contract.getState().property()) instead.
 */
export default class SynthesizePublicGetters extends AstTraversal {
  constructor(private enabled: boolean) { super(); }

  // Names that are contracts/interfaces (their AddressType placeholder resolves to an address - a getter can
  // return it soundly), as opposed to enums (whose placeholder resolves to an EnumType with a different ABI).
  private contractIfaceNames: Set<string> = new Set();
  private indexedGetterArities: Map<string, number> = new Map();
  private indexedStructGetterFields: Map<string, string[]> = new Map();
  private enumTypes: Map<string, EnumType> = new Map();
  private transientGetterNames: Set<string> = new Set();

  // Synthesizing every otherwise-unused function-pointer getter makes the split address/selector representation
  // observable in contracts that never ask for the getter. Limit this compatibility bridge to Solidity source
  // that actually performs the zero-argument `this.x()` getter call.
  private hasSelfGetterCall(root: Node, name: string): boolean {
    const seen = new WeakSet<object>();
    const scan = (value: unknown): boolean => {
      if (!value || typeof value !== 'object' || seen.has(value as object)) return false;
      seen.add(value as object);
      if (value instanceof FunctionCallNode && value.fromThisCall
        && value.identifier.name === name && value.parameters.length === 0) return true;
      if (Array.isArray(value)) return value.some(scan);
      return Object.entries(value as Record<string, unknown>)
        .some(([key, child]) => key !== 'location' && scan(child));
    };
    return scan(root);
  }

  visitSourceFile(node: SourceFileNode): Node {
    if (!this.enabled) return node;
    this.contractIfaceNames = new Set();
    if (node.contract) this.contractIfaceNames.add(node.contract.name);
    for (const c of node.importedContracts) this.contractIfaceNames.add(c.name);
    for (const i of node.interfaceDefinitions) this.contractIfaceNames.add(i.name);
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    // Secondary contracts in the file (callees, e.g. a `TimeLock` invoked via `timeLock.lockTime(addr)`) need
    // their getters dispatchable too.
    node.importedContracts = node.importedContracts.map((c) => this.visit(c) as ContractNode);
    return node;
  }

  // A contract/interface-typed placeholder (returns an address - a sound getter return), NOT an enum placeholder.
  private isContractAddr(t: Type): boolean {
    return t instanceof AddressType && !!t.interfaceName && this.contractIfaceNames.has(t.interfaceName);
  }

  private isRecursiveStruct(type: StructType, stack: Set<StructType> = new Set()): boolean {
    if (stack.has(type)) return true;
    stack.add(type);
    const recursive = type.fields.some((field) => {
      let child: Type = field.type;
      while (child instanceof ArrayType || child instanceof MappingType) {
        child = child instanceof ArrayType ? child.elementType : child.valueType;
      }
      return child instanceof StructType && this.isRecursiveStruct(child, stack);
    });
    stack.delete(type);
    return recursive;
  }

  // Build the ABI shape and ordinary expression tree for a public nested array/mapping getter:
  //   mapping(K => V[][]) m -> m(K,uint256,uint256) returns (V)
  //   mapping(K => V)[] a  -> a(uint256,K) returns (V)
  // Using the same nested ArrayAccess tree that parsed `m[k][i]` produces lets the existing symbol/type/codegen
  // paths handle mixed mapping/array storage rather than introducing a second getter-specific access model.
  private buildIndexedGetter(
    name: string, type: Type, loc: ContractNode['location'], allowTerminalStruct = false,
  ): { keys: ParameterNode[]; read: ExpressionNode; returnType: Type } | undefined {
    const keys: ParameterNode[] = [];
    let read: ExpressionNode = Object.assign(new IdentifierNode(name), { location: loc });
    let current = type;
    let index = 0;
    let mappingCount = 0;
    let arrayCount = 0;
    let sawArray = false;
    while (current instanceof MappingType || current instanceof ArrayType) {
      if (current instanceof MappingType) {
        // Array-of-mapping storage is not yet a valid SolidCash state layout. Mapping->mapping->array and
        // mapping->3D-array reads likewise exceed the currently proven mixed-container access lowering.
        if (sawArray) return undefined;
        mappingCount += 1;
      } else {
        sawArray = true;
        arrayCount += 1;
      }
      const keyType = current instanceof MappingType ? current.keyType : new IntType(false, 256);
      const keyName = `__getterKey${index += 1}`;
      const key = Object.assign(new ParameterNode(keyType, keyName), { location: loc });
      const keyRef = Object.assign(new IdentifierNode(keyName), { location: loc });
      keys.push(key);
      read = Object.assign(new ArrayAccessNode(read, keyRef), { location: loc });
      current = current instanceof MappingType ? current.valueType : current.elementType;
    }
    if (arrayCount > 0 && (mappingCount > 1 || (mappingCount > 0 && arrayCount > 2))) return undefined;
    const returnType = this.enumTypes.get(current instanceof AddressType ? current.interfaceName ?? '' : '') ?? current;
    if (!isSafeGetterType(returnType) && !this.isContractAddr(returnType) && !(returnType instanceof EnumType)
      && !(allowTerminalStruct && returnType instanceof StructType)) {
      return undefined;
    }
    return { keys, read, returnType };
  }

  // A Solidity `this.m(keys...)` call to an auto-getter is semantically the same state read as `m[keys...]`,
  // but lowering it as an internal subroutine call would hide the mapping/array witnesses from the caller's
  // entry-access scan. Inline only compiler-synthesized indexed getters back to their ordinary read expression;
  // externally called getters remain real ABI entry points.
  visitFunctionCall(node: FunctionCallNode): Node {
    const visited = super.visitFunctionCall(node) as FunctionCallNode;
    // A transient getter invoked on `this` is a read of this execution's transaction-local value. Keep it in
    // the caller frame rather than dispatching to the synthesized getter (which is independently zero-initialized
    // when called as an entry point).
    if (visited.fromThisCall && visited.parameters.length === 0
      && this.transientGetterNames.has(visited.identifier.name)) {
      const read = new IdentifierNode(visited.identifier.name);
      read.location = visited.location;
      return read;
    }
    const arity = this.indexedGetterArities.get(visited.identifier.name);
    if (!visited.fromThisCall || arity === undefined || visited.parameters.length !== arity) return visited;
    let read: ExpressionNode = Object.assign(new IdentifierNode(visited.identifier.name), { location: visited.location });
    for (const key of visited.parameters) {
      read = Object.assign(new ArrayAccessNode(read, key), { location: visited.location });
    }
    return read;
  }

  // A self-call to a public collection getter whose terminal value is a struct returns the ABI-visible scalar
  // fields as a tuple. Inline each field read into tupleExpressions rather than replacing the whole call with one
  // struct blob: this keeps mapping/array witnesses visible to the caller while preserving Solidity's tuple shape.
  visitTupleAssignment(node: TupleAssignmentNode): Node {
    if (!node.tupleExpressions && node.tuple instanceof FunctionCallNode
      && node.tuple.fromThisCall) {
      const fields = this.indexedStructGetterFields.get(node.tuple.identifier.name);
      const arity = this.indexedGetterArities.get(node.tuple.identifier.name);
      if (fields && arity === node.tuple.parameters.length && fields.length === node.elements.length) {
        let read: ExpressionNode = Object.assign(
          new IdentifierNode(node.tuple.identifier.name), { location: node.tuple.location },
        );
        for (const key of node.tuple.parameters) {
          read = Object.assign(new ArrayAccessNode(read, key), { location: node.tuple.location });
        }
        node.tupleExpressions = fields.map((field) => Object.assign(
          new FieldAccessNode(cloneNode(read), field), { location: node.tuple.location },
        ));
        return super.visitTupleAssignment(node);
      }
    }
    return super.visitTupleAssignment(node);
  }

  visitFunctionCallStatement(node: FunctionCallStatementNode): Node {
    const call = this.visit(node.call);
    if (call instanceof FunctionCallNode) {
      node.call = call;
      return node;
    }
    const statement = new ExpressionStatementNode(call as ExpressionNode);
    statement.location = node.location;
    return statement;
  }

  visitContract(node: ContractNode): Node {
    this.indexedGetterArities = new Map();
    this.indexedStructGetterFields = new Map();
    this.transientGetterNames = new Set();
    this.enumTypes = new Map(node.enumDefinitions.map((definition) => [
      definition.name, new EnumType(definition.name, definition.members),
    ]));
    const isPub = (v: StateVariableVisibility): boolean =>
      v === StateVariableVisibility.PUBLIC || v === StateVariableVisibility.EXTERNAL;
    // A retained inherited ABSTRACT declaration does not occupy the implementation slot: a public
    // variable/constant getter with that name is precisely how Solidity permits the declaration to be fulfilled.
    const existing = new Set(node.functions.filter((f) => !f.isAbstract).map((f) => f.name));
    const fallback = node.location;
    const getters: FunctionDefinitionNode[] = [];

    // Public constants have an ABI getter just like public state variables, but their body returns the baked
    // constant identifier rather than reading state. Constants parsed from file-level/dedicated declarations
    // carry no visibility and therefore do not gain a getter.
    for (const constant of node.constantDefinitions) {
      if (!isPub(constant.visibility!) || existing.has(constant.name)
        || (!isSafeGetterType(constant.type) && !this.isContractAddr(constant.type)
          && !(constant.type instanceof EnumType))) continue;
      const loc = constant.location ?? fallback;
      const read = new IdentifierNode(constant.name); read.location = loc;
      const body = new BlockNode([Object.assign(new ReturnNode([read]), { location: loc })]); body.location = loc;
      const fn = new FunctionDefinitionNode(constant.name, [], body);
      fn.returnTypes = [constant.type];
      fn.modifiers = [FunctionModifier.PURE];
      fn.location = loc;
      getters.push(fn);
    }

    for (const sv of node.stateVariables) {
      if (!isPub(sv.visibility) || existing.has(sv.name)) continue;
      const loc = sv.location ?? fallback;
      // A public array's getter takes a uint index and returns the element (`function a(uint i) returns (T)
      // { return this.a[i]; }`), like Solidity. Nested arrays/mappings contribute one ABI key per level.
      if (sv.type instanceof ArrayType) {
        const indexed = this.buildIndexedGetter(sv.name, sv.type, loc, true);
        if (!indexed) continue;
        if (indexed.returnType instanceof StructType) {
          if (this.isRecursiveStruct(indexed.returnType)) continue;
          const kept = (indexed.returnType.fields ?? [])
            .filter((field) => !(field.type instanceof MappingType) && !(field.type instanceof ArrayType));
          if (kept.length === 0 || !kept.every((field) => isSafeGetterType(field.type)
            || this.isContractAddr(field.type) || field.type instanceof EnumType)) continue;
          const reads = kept.map((field) => {
            const read = new FieldAccessNode(cloneNode(indexed.read), field.name);
            read.location = loc;
            return read;
          });
          const body = new BlockNode([Object.assign(new ReturnNode(reads), { location: loc })]);
          body.location = loc;
          const fn = new FunctionDefinitionNode(sv.name, indexed.keys, body);
          fn.returnTypes = kept.map((field) => field.type);
          fn.modifiers = [FunctionModifier.VIEW];
          fn.location = loc;
          getters.push(fn);
          this.indexedGetterArities.set(sv.name, indexed.keys.length);
          this.indexedStructGetterFields.set(sv.name, kept.map((field) => field.name));
          continue;
        }
        const body = Object.assign(new BlockNode([Object.assign(new ReturnNode([indexed.read]), { location: loc })]),
          { location: loc });
        const fn = new FunctionDefinitionNode(sv.name, indexed.keys, body);
        fn.returnTypes = [indexed.returnType];
        fn.modifiers = [FunctionModifier.VIEW];
        fn.location = loc;
        getters.push(fn);
        this.indexedGetterArities.set(sv.name, indexed.keys.length);
        continue;
      }
      // A public struct's getter returns its members except mappings and arrays (Solidity's rule), as field
      // reads on the struct state var. Mapping-bearing structs are flattened to per-field state vars by
      // semantic analysis - skipped here (no whole-struct read exists for them).
      if (sv.type instanceof StructType) {
        if (this.isRecursiveStruct(sv.type)) continue;
        const fields = sv.type.fields ?? [];
        if (fields.some((f) => f.type instanceof MappingType)) continue;
        const kept = fields.filter((f) => !(f.type instanceof ArrayType));
        // Scalar members only: a struct-typed member would make the getter RETURN a struct value from an
        // entry point - unproven machinery a synthesized body must not depend on (declarations that compile
        // fine unused would start failing).
        if (kept.length === 0 || !kept.every((f) => isSafeGetterType(f.type))) continue;
        const reads = kept.map((f) => {
          const stateRead = Object.assign(new StateAccessNode(sv.name), { location: loc });
          return Object.assign(new FieldAccessNode(stateRead, f.name), { location: loc });
        });
        const body = Object.assign(new BlockNode([Object.assign(new ReturnNode(reads), { location: loc })]),
          { location: loc });
        const fn = new FunctionDefinitionNode(sv.name, [], body);
        fn.returnTypes = kept.map((f) => f.type);
        fn.modifiers = [FunctionModifier.VIEW];
        fn.location = loc;
        getters.push(fn);
        continue;
      }
      const scalarType = this.enumTypes.get(sv.type instanceof AddressType ? sv.type.interfaceName ?? '' : '') ?? sv.type;
      const usedExternalFnGetter = scalarType instanceof FunctionType && scalarType.isExternal
        && this.hasSelfGetterCall(node, sv.name);
      if (!isSafeGetterType(scalarType) && !this.isContractAddr(scalarType)
        && !(scalarType instanceof EnumType) && !usedExternalFnGetter) continue;
      const read = new StateAccessNode(sv.name); read.location = loc;
      const body = new BlockNode([Object.assign(new ReturnNode([read]), { location: loc })]); body.location = loc;
      const fn = new FunctionDefinitionNode(sv.name, [], body);
      fn.returnTypes = [scalarType];
      fn.modifiers = [FunctionModifier.VIEW];
      fn.location = loc;
      getters.push(fn);
    }

    // Public transient values have the same zero-argument ABI getter as ordinary scalar state. They are kept
    // off stateVariables because they have no persistent UTXO slot, so synthesize the getter explicitly. Its
    // entry-point body starts from zero, while `this.x()` inside another function is inlined above to that
    // function's transaction-local binding.
    for (const sv of node.transientStateVars) {
      if (!isPub(sv.visibility) || existing.has(sv.name) || !isSafeGetterType(sv.type)) continue;
      const loc = sv.location ?? fallback;
      const read = new IdentifierNode(sv.name); read.location = loc;
      const ret = new ReturnNode([read]); ret.location = loc;
      const body = new BlockNode([ret]); body.location = loc;
      const fn = new FunctionDefinitionNode(sv.name, [], body);
      fn.returnTypes = [sv.type];
      fn.modifiers = [FunctionModifier.VIEW];
      fn.location = loc;
      getters.push(fn);
      this.transientGetterNames.add(sv.name);
    }

    for (const coll of node.collections) {
      if (!isPub(coll.visibility) || existing.has(coll.name)) continue;
      const loc = coll.location ?? fallback;
      const indexed = this.buildIndexedGetter(coll.name, coll.type, loc, true);
      if (!indexed) continue; // complex terminal getter (struct/enum placeholder)
      if (indexed.returnType instanceof StructType) {
        if (this.isRecursiveStruct(indexed.returnType)) continue;
        // Solidity's public mapping-to-struct getter returns the scalar members as a tuple, omitting mapping and
        // array members just like a direct public struct getter.
        const kept = (indexed.returnType.fields ?? [])
          .filter((field) => !(field.type instanceof MappingType) && !(field.type instanceof ArrayType));
        if (kept.length === 0 || !kept.every((field) => isSafeGetterType(field.type)
          || this.isContractAddr(field.type) || field.type instanceof EnumType)) continue;
        const reads = kept.map((field) => {
          const read = new FieldAccessNode(cloneNode(indexed.read), field.name);
          read.location = loc;
          return read;
        });
        const body = new BlockNode([Object.assign(new ReturnNode(reads), { location: loc })]);
        body.location = loc;
        const fn = new FunctionDefinitionNode(coll.name, indexed.keys, body);
        fn.returnTypes = kept.map((field) => field.type);
        fn.modifiers = [FunctionModifier.VIEW];
        fn.location = loc;
        getters.push(fn);
        this.indexedGetterArities.set(coll.name, indexed.keys.length);
        this.indexedStructGetterFields.set(coll.name, kept.map((field) => field.name));
        continue;
      }
      const body = new BlockNode([Object.assign(new ReturnNode([indexed.read]), { location: loc })]); body.location = loc;
      const fn = new FunctionDefinitionNode(coll.name, indexed.keys, body);
      fn.returnTypes = [indexed.returnType];
      fn.modifiers = [FunctionModifier.VIEW];
      fn.location = loc;
      getters.push(fn);
      this.indexedGetterArities.set(coll.name, indexed.keys.length);
    }

    node.functions = [...node.functions, ...getters];
    node.functions = node.functions.map((fn) => this.visit(fn) as FunctionDefinitionNode);
    return node;
  }
}
