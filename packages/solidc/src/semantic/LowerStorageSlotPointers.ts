import {
  StructType, MappingType, IntType, AddressType, Type,
} from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import {
  Node, SourceFileNode, ContractNode, FunctionDefinitionNode, AssemblyStatementNode, VariableDefinitionNode,
  AssignNode, FieldAccessNode, IdentifierNode, FunctionCallNode, ExpressionNode, CastNode, BlockNode,
  MappingAccessNode, MappingAssignNode, CollectionNode,
} from '../ast/AST.js';
import { cloneNode } from '../ast/clone.js';
import { YulAssignmentNode, YulPathNode } from '../ast/YulAST.js';

// The OpenZeppelin StorageSlot idiom (write-to-any-slot). A `library` function
//   `f(bytes32 slot) internal pure returns (XSlot storage r) { assembly { r.slot := slot } }`
// is a slot-pointer FACTORY: calling it yields a pointer to arbitrary EVM storage slot `slot`. This pass
// lowers `XSlot storage x = f(slot); x.value = v` / `x.value` (read) to the synthesized __evm_storage register:
// `__evm_storage[slot] = <cast v>` / `<cast __evm_storage[slot]>`. Runs pre-semantic (the factory's assembly
// is consumed here, never reaching LowerInlineAssembly). Single-field slot structs (the OZ set: Address/
// Boolean/Bytes32/Uint256) only; the field type drives the value cast. See docs/evm-storage-parity.md.

const UINT256 = new IntType(false, 256);
const UINT160 = new IntType(false, 160);
const EVM_STORAGE = '__evm_storage';

interface Factory { struct: StructType; slotParamIdx: number; }
interface Alias { slot: ExpressionNode; struct: StructType; }

export default class LowerStorageSlotPointers extends AstTraversal {
  private factories = new Map<string, Factory>();
  private aliases = new Map<string, Alias>();
  private used = false;

  visitSourceFile(node: SourceFileNode): Node {
    const contracts = [node.contract, ...(node.importedContracts ?? [])].filter(Boolean) as ContractNode[];
    const allFns = [...(node.freeFunctions ?? []), ...contracts.flatMap((c) => c.functions ?? [])];
    for (const fn of allFns) this.detectFactory(fn);
    if (this.factories.size === 0) return node;

    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    node.importedContracts = node.importedContracts.map((c) => this.visit(c) as ContractNode);
    node.freeFunctions = (node.freeFunctions ?? []).filter((f) => !this.factories.has(f.name));

    if (this.used && node.contract && !node.contract.collections.some((c) => c.name === EVM_STORAGE)) {
      const mapping = new CollectionNode(new MappingType(UINT256, UINT256), EVM_STORAGE);
      mapping.location = node.contract.location;
      node.contract.collections.push(mapping);
    }
    return node;
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
    if (!(yul.value instanceof YulPathNode) || yul.value.members.length > 0) return; // r.slot := <bare param>
    const slotParamIdx = fn.parameters.findIndex((p) => p.name === (yul.value as YulPathNode).base);
    if (slotParamIdx < 0) return;
    this.factories.set(fn.name, { struct: fn.returnTypes[0], slotParamIdx });
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    if (this.factories.has(node.name)) return node; // dropped in visitSourceFile
    this.aliases = new Map();
    return super.visitFunctionDefinition(node);
  }

  // `XSlot storage x = factory(slot)` -> register x as a slot alias; drop the declaration.
  visitVariableDefinition(node: VariableDefinitionNode): Node {
    if (node.expression instanceof FunctionCallNode) {
      const factory = this.factories.get(node.expression.identifier.name);
      if (factory) {
        this.aliases.set(node.name, { slot: node.expression.parameters[factory.slotParamIdx], struct: factory.struct });
        this.used = true;
        const empty = new BlockNode([]);
        empty.location = node.location;
        return empty;
      }
    }
    return super.visitVariableDefinition(node);
  }

  // Desugared struct-field write `x.value = v` -> `x = XSlot(v)` -> `__evm_storage[slot] = <cast v>`.
  visitAssign(node: AssignNode): Node {
    const alias = this.aliases.get(node.identifier.name);
    if (alias && node.expression instanceof FunctionCallNode
      && node.expression.identifier.name === alias.struct.name && node.expression.parameters.length === 1) {
      const write = new MappingAssignNode(
        EVM_STORAGE, [this.keyOf(alias)], this.toUint(node.expression.parameters[0], alias.struct.fields[0].type),
      );
      write.location = node.location;
      return write;
    }
    return super.visitAssign(node);
  }

  // `x.value` (read) -> `<cast __evm_storage[slot]>`; also the inline `factory(slot).value` (no local alias).
  visitFieldAccess(node: FieldAccessNode): Node {
    const alias = node.expression instanceof IdentifierNode ? this.aliases.get(node.expression.name) : undefined;
    if (alias) {
      const read = new MappingAccessNode(EVM_STORAGE, [this.keyOf(alias)]);
      read.location = node.location;
      return this.fromUint(read, alias.struct.fields[0].type);
    }
    if (node.name === 'value' && node.expression instanceof FunctionCallNode) {
      const factory = this.factories.get(node.expression.identifier.name);
      if (factory) {
        this.used = true;
        const read = new MappingAccessNode(EVM_STORAGE, [this.slotKey(node.expression, factory)]);
        read.location = node.location;
        return this.fromUint(read, factory.struct.fields[0].type);
      }
    }
    return super.visitFieldAccess(node);
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
    return this.cast(UINT256, cloneNode(alias.slot), alias.slot.location); // slot (bytes32/uint) -> the key
  }

  // Store the field value as a uint256 word. address -> uint256(uint160(v)); other value types -> uint256(v).
  private toUint(expr: ExpressionNode, fieldType: Type): ExpressionNode {
    if (fieldType instanceof AddressType) return this.cast(UINT256, this.cast(UINT160, expr, expr.location), expr.location);
    return this.cast(UINT256, expr, expr.location);
  }

  // Read the word back as the field type. uint256 word -> address(uint160(w)); other -> fieldType(w).
  private fromUint(expr: ExpressionNode, fieldType: Type): ExpressionNode {
    if (fieldType instanceof AddressType) {
      return this.cast(new AddressType(), this.cast(UINT160, expr, expr.location), expr.location);
    }
    return this.cast(fieldType, expr, expr.location);
  }
}
