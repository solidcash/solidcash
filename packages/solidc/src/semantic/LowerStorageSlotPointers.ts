import {
  StructType, MappingType, IntType, AddressType, BytesType, ArrayType, PrimitiveType, Type,
} from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import {
  Node, SourceFileNode, ContractNode, FunctionDefinitionNode, AssemblyStatementNode, VariableDefinitionNode,
  AssignNode, FieldAccessNode, IdentifierNode, FunctionCallNode, ExpressionNode, CastNode, BlockNode,
  MappingAccessNode, MappingAssignNode, MappingFieldAssignNode, ArrayAccessNode, CollectionNode,
  StateVariableNode, StateAccessNode, StateAssignNode, StateVariableVisibility, InstantiationNode,
} from '../ast/AST.js';
import { Class } from '../ast/Globals.js';
import { cloneNode } from '../ast/clone.js';
import { Location } from '../ast/Location.js';
import { YulAssignmentNode, YulPathNode, YulLiteralNode } from '../ast/YulAST.js';

// The OpenZeppelin StorageSlot idiom (write-to-any-slot). Two factory shapes:
//   PARAM factory:  `f(bytes32 slot) returns (XSlot storage r) { assembly { r.slot := slot } }`  (runtime slot)
//   CONST factory:  `f()            returns (S storage $)      { assembly { $.slot := CONST } }`  (ERC-7201)
// A PARAM factory yields a pointer to an arbitrary EVM slot: `XSlot storage x = f(slot); x.value = v` / `x.value`
// lower to the synthesized __evm_storage register `__evm_storage[slot]`. A CONST factory is the ERC-7201
// namespaced-storage idiom over a FIXED struct: each field is PROMOTED to hidden packed contract state, routed
// to its correct 128-byte-aware substrate (scalar value -> register StateVariableNode; mapping -> CollectionNode;
// this is AstBuilder.buildFlattenedStructField's mapping). Promotion is the only sound semantic - a mapping
// field cannot be a single `__evm_storage[base+i]` slot. `_getX().f` / `S storage $ = _getX(); $.f` (read + the
// struct-rebuild write) rewrite to the promoted state. Runs pre-semantic (before SymbolTableTraversal, so the
// injected vars pack; the factory's assembly is consumed here, never reaching LowerInlineAssembly).
// See docs/evm-storage-parity.md.

const UINT256 = new IntType(false, 256);
const UINT160 = new IntType(false, 160);
const EVM_STORAGE = '__evm_storage';

// PARAM factory carries the slot param index; CONST factory (ERC-7201) sets isConst and promotes the struct.
// SLOT-ALIAS factory (`r.slot := store.slot`, OZ StorageSlot.getStringSlot/getBytesSlot) aliases the return
// pointer to ANOTHER storage reference's slot, so `getXSlot(ref).value = v` is just `ref = v` - a direct write of
// the aliased storage reference (a string/bytes state var routes through the native dynamic-storage path, not the
// word-granular __evm_storage register that a raw-slot PARAM factory uses).
interface Factory { struct: StructType; slotParamIdx: number; isConst?: boolean; isSlotAlias?: boolean; }
interface Alias { slot?: ExpressionNode; struct: StructType; isConst?: boolean; aliasRef?: ExpressionNode; }

// The hidden state name a promoted struct field lands on (mirrors AstBuilder's `<var>__<field>` flattening).
function promotedName(struct: StructType, field: string): string {
  return `${struct.name}__${field}`;
}

export default class LowerStorageSlotPointers extends AstTraversal {
  private factories = new Map<string, Factory>();
  private aliases = new Map<string, Alias>();
  private used = false;
  // CONST-factory structs already promoted into the contract (dedupe: one struct type -> one field set).
  private promotedStructs = new Set<string>();
  // CONST-factory structs actually USED (aliased or inline), collected during the visit, promoted after it.
  private constStructsToPromote = new Map<string, StructType>();

  visitSourceFile(node: SourceFileNode): Node {
    const contracts = [node.contract, ...(node.importedContracts ?? [])].filter(Boolean) as ContractNode[];
    const allFns = [...(node.freeFunctions ?? []), ...contracts.flatMap((c) => c.functions ?? [])];
    for (const fn of allFns) this.detectFactory(fn);
    if (this.factories.size === 0) return node;

    if (node.contract) node.contract = this.dropFactories(this.visit(node.contract) as ContractNode);
    node.importedContracts = node.importedContracts.map((c) => this.dropFactories(this.visit(c) as ContractNode));
    // Drop the consumed factory free functions AND visit the rest: an inline `getXSlot(ref).value = v` write can
    // live in an imported LIBRARY free function (OZ ShortStrings.setWithFallback), which must be rewritten too - not
    // only the contract methods - else the dropped factory call dangles ("Undefined reference to getStringSlot").
    node.freeFunctions = (node.freeFunctions ?? [])
      .filter((f) => !this.factories.has(f.name))
      .map((f) => this.visit(f) as FunctionDefinitionNode);

    if (this.used && node.contract && !node.contract.collections.some((c) => c.name === EVM_STORAGE)) {
      const mapping = new CollectionNode(new MappingType(UINT256, UINT256), EVM_STORAGE);
      mapping.location = node.contract.location;
      node.contract.collections.push(mapping);
    }
    // Promote the fields of every USED CONST-factory struct to hidden packed state on the deployed contract.
    if (node.contract) for (const struct of this.constStructsToPromote.values()) this.promoteStruct(node.contract, struct);
    return node;
  }

  // Drop consumed slot-pointer factory METHODS from a contract (all their call sites were rewritten to the
  // promoted state / __evm_storage, so the factory body - a `$.slot := CONST` assembly - is now dead). Free-fn
  // factories are dropped in visitSourceFile; contract methods (the OZ ERC-7201 `_getXStorage()` shape, and any
  // library fn kept as a method) need this so their assembly body never reaches LowerInlineAssembly.
  private dropFactories(contract: ContractNode): ContractNode {
    contract.functions = (contract.functions ?? []).filter((f) => !this.factories.has(f.name));
    return contract;
  }

  // Inject one hidden state node per field of a CONST-factory (ERC-7201) struct, routed to its 128B-aware
  // substrate: scalar value -> packed register StateVariableNode; mapping -> CollectionNode; dynamic string/
  // bytes/array -> a chunked isDynamic var. Idempotent per struct type. Nested struct fields are deferred.
  private promoteStruct(contract: ContractNode, struct: StructType): void {
    if (this.promotedStructs.has(struct.name)) return;
    this.promotedStructs.add(struct.name);
    for (const field of struct.fields) {
      const name = promotedName(struct, field.name);
      const t = field.type;
      if (t instanceof MappingType) {
        const col = new CollectionNode(t, name);
        col.visibility = StateVariableVisibility.PRIVATE;
        col.location = contract.location;
        contract.collections.push(col);
        continue;
      }
      if (t instanceof StructType) {
        throw new Error(`ERC-7201 storage struct '${struct.name}' has a nested struct field '${field.name}' `
          + '(not yet supported); see docs/evm-storage-parity.md P1.');
      }
      const sv = new StateVariableNode(t, name);
      sv.visibility = StateVariableVisibility.PRIVATE;
      // Unbounded bytes/string/array back their value in chunk UTXOs (docs/dynamic-storage.md), like a declared dynamic var.
      if ((t instanceof BytesType && t.bound === undefined) || (t instanceof ArrayType && t.bound === undefined)) {
        sv.isDynamic = true;
      }
      sv.location = contract.location;
      contract.stateVariables.push(sv);
    }
  }

  // A slot-pointer factory: single AssemblyStatement `<returnName>.slot := <param>`, returns a struct storage ptr.
  private detectFactory(fn: FunctionDefinitionNode): void {
    const stmts = fn.body?.statements ?? [];
    if (stmts.length !== 1 || !(stmts[0] instanceof AssemblyStatementNode)) return;
    const yul = (stmts[0] as AssemblyStatementNode).yulBlock?.statements?.[0];
    if (!(yul instanceof YulAssignmentNode) || !(yul.paths[0] instanceof YulPathNode)) return;
    const path = yul.paths[0];
    if (path.members.join('.') !== 'slot' || path.base !== fn.returnNames[0]) return;
    if (fn.returnTypes.length !== 1 || !(fn.returnTypes[0] instanceof StructType)) return;
    const struct = fn.returnTypes[0];
    const rhs = yul.value;
    if (rhs instanceof YulPathNode && rhs.members.length === 0) {
      // `<r>.slot := <bare name>`: a param name -> PARAM factory; a non-param (a constant) -> ERC-7201 CONST factory.
      const slotParamIdx = fn.parameters.findIndex((p) => p.name === rhs.base);
      if (slotParamIdx >= 0) this.factories.set(fn.name, { struct, slotParamIdx });
      else this.factories.set(fn.name, { struct, slotParamIdx: -1, isConst: true });
      return;
    }
    if (rhs instanceof YulPathNode && rhs.members.join('.') === 'slot') {
      // `<r>.slot := <param>.slot` -> SLOT-ALIAS factory: r points at the same slot as the storage-ref param, so
      // `getXSlot(ref).value` IS `ref` (OZ StorageSlot.getStringSlot/getBytesSlot for the EIP712 name fallback).
      const slotParamIdx = fn.parameters.findIndex((p) => p.name === rhs.base);
      if (slotParamIdx >= 0) this.factories.set(fn.name, { struct, slotParamIdx, isSlotAlias: true });
      return;
    }
    // `<$>.slot := 0x<literal>` -> CONST factory (the constant baked as a literal).
    if (rhs instanceof YulLiteralNode) this.factories.set(fn.name, { struct, slotParamIdx: -1, isConst: true });
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    if (this.factories.has(node.name)) return node; // dropped in visitSourceFile
    this.aliases = new Map();
    return super.visitFunctionDefinition(node);
  }

  // CONST-alias mapping-field write `$.map[k] = v` arrives as `MappingFieldAssign($, [k], map, v)` (the same
  // shape a state struct's `s.map[k]=v` flattens to `s__map`); route it to the promoted collection.
  visitMappingFieldAssign(node: MappingFieldAssignNode): Node {
    const alias = this.aliases.get(node.name);
    // Deferred inline slot-pointer write `__t.value = v` (imported factory - AstBuilder emitted this MappingFieldAssign
    // because the return struct was unknown per-file). Route by the resolved factory kind.
    if (alias && node.keys.length === 0 && node.fieldName === alias.struct.fields[0]?.name) {
      if (alias.aliasRef) {
        return this.rewriteAliasRefWrite(alias.aliasRef, this.visit(node.expression) as ExpressionNode, node.location);
      }
      if (alias.slot) {
        this.used = true;
        const write = new MappingAssignNode(
          EVM_STORAGE, [this.keyOf(alias)], this.toUint(this.visit(node.expression) as ExpressionNode, alias.struct.fields[0].type),
        );
        write.location = node.location;
        return write;
      }
    }
    if (alias?.isConst && this.isMappingField(alias.struct, node.fieldName)) {
      const write = new MappingAssignNode(
        promotedName(alias.struct, node.fieldName), node.keys.map((k) => this.visit(k) as ExpressionNode),
        this.visit(node.expression) as ExpressionNode,
      );
      write.location = node.location;
      return write;
    }
    return super.visitMappingFieldAssign(node);
  }

  // CONST-alias mapping-field read `$.map[k]` arrives as `ArrayAccess(FieldAccess($, map), k)`; route it to the
  // promoted collection `MappingAccess(S__map, [k])`. (visitFieldAccess leaves a mapping field's `$.map` alone.)
  visitArrayAccess(node: ArrayAccessNode): Node {
    if (node.array instanceof FieldAccessNode && node.array.expression instanceof IdentifierNode) {
      const alias = this.aliases.get(node.array.expression.name);
      if (alias?.isConst && this.isMappingField(alias.struct, node.array.name)) {
        const read = new MappingAccessNode(
          promotedName(alias.struct, node.array.name), [this.visit(node.index) as ExpressionNode],
        );
        read.location = node.location;
        return read;
      }
    }
    return super.visitArrayAccess(node);
  }

  private isMappingField(struct: StructType, field: string): boolean {
    return struct.fields.find((f) => f.name === field)?.type instanceof MappingType;
  }

  // `XSlot storage x = factory(..)` -> register x as an alias; drop the declaration. PARAM factory carries the
  // slot expression (routes to __evm_storage[slot]); CONST factory (ERC-7201) marks the struct for promotion.
  visitVariableDefinition(node: VariableDefinitionNode): Node {
    if (node.expression instanceof FunctionCallNode) {
      const factory = this.factories.get(node.expression.identifier.name);
      if (factory) {
        if (factory.isConst) {
          this.aliases.set(node.name, { struct: factory.struct, isConst: true });
          this.constStructsToPromote.set(factory.struct.name, factory.struct);
        } else if (factory.isSlotAlias) {
          // `S storage d = getXSlot(ref)` -> d aliases `ref` directly (no __evm_storage register).
          this.aliases.set(node.name, { aliasRef: node.expression.parameters[factory.slotParamIdx], struct: factory.struct });
        } else {
          this.aliases.set(node.name, { slot: node.expression.parameters[factory.slotParamIdx], struct: factory.struct });
          this.used = true;
        }
        const empty = new BlockNode([]);
        empty.location = node.location;
        return empty;
      }
    }
    return super.visitVariableDefinition(node);
  }

  // PARAM: desugared `x.value = v` -> `x = XSlot(v)` -> `__evm_storage[slot] = <cast v>`. CONST: desugared
  // `$.f = v` -> `$ = S(.., v, ..)` (struct rebuild) -> per-scalar-field `StateAssign(S__f, ..)` (unchanged
  // fields, passed back as `$.f`, are skipped). Field order == constructor arg order.
  visitAssign(node: AssignNode): Node {
    const alias = this.aliases.get(node.identifier.name);
    if (alias && node.expression instanceof FunctionCallNode
      && node.expression.identifier.name === alias.struct.name) {
      const args = node.expression.parameters;
      if (alias.isConst) {
        const stmts: StateAssignNode[] = [];
        alias.struct.fields.forEach((f, i) => {
          if (f.type instanceof MappingType || args[i] === undefined) return; // mappings aren't rebuilt via the ctor
          if (this.isSelfFieldRead(args[i], node.identifier.name, f.name)) return; // unchanged field
          const write = new StateAssignNode(promotedName(alias.struct, f.name), this.visit(args[i]) as ExpressionNode);
          write.location = node.location;
          stmts.push(write);
        });
        // A single write returns bare (containsStatefulOperation does not recurse a bare BlockNode); multiple
        // writes go in a BlockNode whose recursion is added to containsStatefulOperation for MVP-2.
        if (stmts.length === 1) return stmts[0];
        const block = new BlockNode(stmts);
        block.location = node.location;
        return block;
      }
      if (alias.aliasRef && args.length === 1) {
        // Slot-alias `d.value = v` (arrives as `d = S(v)`) -> write the aliased storage reference directly: `ref = v`.
        // A string/bytes ref routes through the native dynamic-storage write, so no uint cast (the register path).
        return this.rewriteAliasRefWrite(alias.aliasRef, this.visit(args[0]) as ExpressionNode, node.location);
      }
      if (args.length === 1) {
        const write = new MappingAssignNode(
          EVM_STORAGE, [this.keyOf(alias)], this.toUint(args[0], alias.struct.fields[0].type),
        );
        write.location = node.location;
        return write;
      }
    }
    return super.visitAssign(node);
  }

  // Slot-alias `d.value = v` / inline `getXSlot(ref).value = v` -> a direct write of the aliased storage ref.
  // The ref is the arg passed to the factory (an identifier state var / storage param in the OZ StorageSlot idiom);
  // `ref = v` resolves to a StateAssign for a state var (a string/bytes ref uses the native dynamic-storage write).
  private rewriteAliasRefWrite(ref: ExpressionNode, value: ExpressionNode, loc: Location): Node {
    const target = cloneNode(ref) as ExpressionNode;
    if (target instanceof IdentifierNode) {
      const write = new AssignNode(target, value);
      write.location = loc;
      return write;
    }
    const write = new AssignNode(target as unknown as IdentifierNode, value); // non-identifier ref: best-effort
    write.location = loc;
    return write;
  }

  // PARAM: `x.value` -> `<cast __evm_storage[slot]>`. CONST: `$.f` / inline `factory().f` -> the promoted state
  // read (scalar -> `StateAccess(S__f)`). Also the inline `factory(slot).value` (no local alias) for PARAM.
  visitFieldAccess(node: FieldAccessNode): Node {
    const alias = node.expression instanceof IdentifierNode ? this.aliases.get(node.expression.name) : undefined;
    if (alias) {
      // A mapping field's bare `$.map` is only meaningful when indexed (`$.map[k]`), handled by visitArrayAccess.
      if (alias.isConst) {
        return this.isMappingField(alias.struct, node.name)
          ? super.visitFieldAccess(node) : this.promotedRead(alias.struct, node.name, node.location);
      }
      if (alias.aliasRef) return this.visit(cloneNode(alias.aliasRef) as ExpressionNode); // slot-alias `d.value` -> ref
      const read = new MappingAccessNode(EVM_STORAGE, [this.keyOf(alias)]);
      read.location = node.location;
      return this.fromUint(read, alias.struct.fields[0].type);
    }
    if (node.expression instanceof FunctionCallNode) {
      const factory = this.factories.get(node.expression.identifier.name);
      if (factory?.isConst && !this.isMappingField(factory.struct, node.name)) {
        this.constStructsToPromote.set(factory.struct.name, factory.struct);
        return this.promotedRead(factory.struct, node.name, node.location);
      }
      if (factory?.isSlotAlias && node.name === 'value') {
        // inline `getXSlot(ref).value` (no local) -> the aliased storage ref directly.
        return this.visit(cloneNode(node.expression.parameters[factory.slotParamIdx]) as ExpressionNode);
      }
      if (factory && node.name === 'value') {
        this.used = true;
        const read = new MappingAccessNode(EVM_STORAGE, [this.slotKey(node.expression, factory)]);
        read.location = node.location;
        return this.fromUint(read, factory.struct.fields[0].type);
      }
    }
    return super.visitFieldAccess(node);
  }

  // A promoted scalar field read `<factory>().<field>` / `$.<field>` -> `StateAccess(S__field)`.
  private promotedRead(struct: StructType, field: string, loc: FieldAccessNode['location']): Node {
    const read = new StateAccessNode(promotedName(struct, field));
    read.location = loc;
    return read;
  }

  // True when `expr` is `<aliasName>.<field>` - the unchanged-field read a struct rebuild passes back.
  private isSelfFieldRead(expr: ExpressionNode, aliasName: string, field: string): boolean {
    return expr instanceof FieldAccessNode && expr.expression instanceof IdentifierNode
      && expr.expression.name === aliasName && expr.name === field;
  }

  // The uint256 storage key for a factory call `factory(.., slot, ..)`.
  private slotKey(call: FunctionCallNode, factory: Factory): ExpressionNode {
    const slot = call.parameters[factory.slotParamIdx];
    return this.cast(UINT256, cloneNode(slot), slot.location);
  }

  private cast(type: Type, expr: ExpressionNode, loc: ExpressionNode['location']): CastNode {
    const c = new CastNode(type, expr, false);
    c.location = loc ?? expr.location;
    return c;
  }

  private keyOf(alias: Alias): ExpressionNode {
    const slot = alias.slot!; // only PARAM aliases reach keyOf; CONST aliases have no slot (promoted state)
    return this.cast(UINT256, cloneNode(slot), slot.location); // slot (bytes32/uint) -> the key
  }

  // Store the field value as a uint256 word. address -> uint256(uint160(v)); other value types -> uint256(v).
  private toUint(expr: ExpressionNode, fieldType: Type): ExpressionNode {
    if (fieldType instanceof AddressType) return this.cast(UINT256, this.cast(UINT160, expr, expr.location), expr.location);
    return this.cast(UINT256, expr, expr.location);
  }

  // Read the word back as the field type. X117: the write above stores the field's bytes as a NON-NEGATIVE
  // script number (BytesType -> unsigned IntType sign-pads a 0x00 high byte), so the inverse has to re-encode
  // one byte WIDER and drop that byte. A bare `bytesN(word)` is `NUM2BIN(N)`, which ABORTS for every value
  // whose top byte has the high bit set (`OP_NUM2BIN operation with an insufficient byte length`).
  //
  // A BCH address is a variable-length locking bytecode, not a fixed 20-byte value, and `address(uint160(w))`
  // is the deliberate no-op cast TypeCheckTraversal warns about - it left the raw script number on the stack
  // where a locking bytecode was expected, so the value never read back (`OP_SPLIT` out of range on the
  // 20-byte narrowing, or a failed comparison). Rebuild the P2PKH wrapper the write narrowed away instead.
  private fromUint(expr: ExpressionNode, fieldType: Type): ExpressionNode {
    if (fieldType instanceof AddressType) {
      const build = new InstantiationNode(
        this.at(new IdentifierNode(Class.LOCKING_BYTECODE_P2PKH), expr), [this.exactBytes(expr, 20)],
      );
      build.location = expr.location;
      return build;
    }
    if (fieldType instanceof BytesType && fieldType.bound !== undefined) {
      return this.exactBytes(expr, fieldType.bound);
    }
    return this.cast(fieldType, expr, expr.location);
  }

  // A stored word -> EXACTLY `width` bytes: re-encode at width+1 so a high-bit-set top byte still fits, then
  // keep the leftmost `width` bytes (NUM2BIN is little-endian, so the sign byte is the one dropped).
  private exactBytes(expr: ExpressionNode, width: number): ExpressionNode {
    const wide = this.cast(new BytesType(width + 1), cloneNode(expr) as ExpressionNode, expr.location);
    return this.cast(new BytesType(width), wide, expr.location);
  }

  private at<T extends Node>(node: T, source: Node): T {
    node.location = source.location;
    return node;
  }
}
