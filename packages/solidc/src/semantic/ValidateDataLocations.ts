import {
  ArrayType, BytesType, FunctionType, MappingType, PrimitiveType, StructType, Type,
} from '@solidcash/utils';
import {
  AbiDecodeNode, ArrayAccessNode, AssignNode, BranchNode, ContractNode, ExpressionNode, FunctionCallNode,
  FunctionDefinitionNode, FunctionModifier, IdentifierNode, Node, NullaryOpNode, SliceNode, SourceFileNode,
  StateAssignNode, TupleAssignmentNode, ReturnNode, TupleIndexOpNode, VariableDefinitionNode, TryCatchNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { Modifier } from '../ast/Globals.js';
import { NullaryOperator } from '../ast/Operator.js';
import {
  ImmutableStateVariableAssignmentError, InvalidDataLocationError, InvalidImmutableTypeError,
  InvalidModifierCombinationError,
  UnsupportedAbiV1TypeError,
} from '../Errors.js';

type Context = 'parameter' | 'return' | 'local';

/** Validate Solidity data-location and function-modifier rules before any lowering erases storage pointers. */
export default class ValidateDataLocations extends AstTraversal {
  private currentFunction?: FunctionDefinitionNode;
  private currentContractIsAbstract = false;
  private bindingLocations = new Map<string, string>();
  private bindingTypes = new Map<string, Type>();
  private stateTypes = new Map<string, Type>();
  private calldataLocals = new Set<string>();
  private initializedCalldataLocals = new Set<string>();
  private immutableStateNames = new Set<string>();
  private functionDefinitions = new Map<string, FunctionDefinitionNode[]>();

  constructor(private solidityImportCompat = false) {
    super();
  }

  visitSourceFile(node: SourceFileNode): Node {
    if (node.abiCoderVersion === 'v1') this.validateAbiV1Source(node);
    for (const fn of [
      ...node.freeFunctions,
      ...node.contract.functions,
      ...node.importedContracts.flatMap((contract) => contract.functions),
    ]) {
      const definitions = this.functionDefinitions.get(fn.name) ?? [];
      definitions.push(fn);
      this.functionDefinitions.set(fn.name, definitions);
    }
    node.freeFunctions = this.visitList(node.freeFunctions) as FunctionDefinitionNode[];
    node.importedContracts = this.visitList(node.importedContracts) as ContractNode[];
    node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  private validateAbiV1Source(node: SourceFileNode): void {
    const validateTypes = (owner: Node, types: Type[]): void => {
      const unsupported = types.find((type) => this.isUnsupportedAbiV1Type(type));
      if (unsupported) throw new UnsupportedAbiV1TypeError(owner, unsupported.toString());
    };
    const validateEventsAndErrors = (
      events: Array<{ parameters: Array<{ type: Type }> }>,
      errors: Array<{ parameters: Array<{ type: Type }> }>,
    ): void => {
      for (const event of events) validateTypes(event as unknown as Node, event.parameters.map((p) => p.type));
      for (const error of errors) validateTypes(error as unknown as Node, error.parameters.map((p) => p.type));
    };
    const validateContract = (contract: ContractNode): void => {
      // An abstract contract's constructor is never itself ABI-decoded; a concrete derived constructor supplies
      // its arguments internally, so Solidity permits ABI-v2-only shapes here even under an explicit v1 coder.
      if (contract.constructorDef && !contract.isAbstract) validateTypes(contract.constructorDef,
        contract.constructorDef.parameters.map((parameter) => parameter.type));
      for (const fn of contract.functions) {
        if (!fn.isEntryPoint) continue;
        validateTypes(fn, [
          ...fn.parameters.map((parameter) => parameter.type),
          ...fn.returnTypes,
        ]);
      }
      validateEventsAndErrors(contract.eventDefinitions, contract.errorDefinitions);
    };

    validateTypes(node.contract, []);
    validateContract(node.contract);
    node.importedContracts.forEach(validateContract);
    validateEventsAndErrors(node.eventDefinitions, node.errorDefinitions);
    for (const iface of node.interfaceDefinitions) {
      for (const fn of iface.functions) {
        validateTypes(fn, [
          ...fn.parameters.map((parameter) => parameter.type),
          ...fn.returnTypes,
        ]);
      }
      validateEventsAndErrors(iface.eventDefinitions, iface.errorDefinitions);
    }
  }

  private isUnsupportedAbiV1Type(type: Type): boolean {
    if (type instanceof StructType || type instanceof MappingType) return true;
    if (!(type instanceof ArrayType)) return false;
    const element = type.elementType;
    return element instanceof ArrayType
      || element instanceof StructType
      || element instanceof MappingType
      || (element instanceof BytesType && element.bound === undefined)
      || element === PrimitiveType.STRING
      || this.isUnsupportedAbiV1Type(element);
  }

  visitContract(node: ContractNode): Node {
    const previousAbstract = this.currentContractIsAbstract;
    const previousImmutableStateNames = this.immutableStateNames;
    const previousStateTypes = this.stateTypes;
    this.currentContractIsAbstract = node.isAbstract;
    if (this.solidityImportCompat) {
      for (const state of node.stateVariables) {
        const nonValueType = state.type instanceof ArrayType
          || state.type instanceof MappingType
          || state.type instanceof StructType
          || (state.type instanceof FunctionType && state.type.isExternal)
          || state.type === PrimitiveType.STRING
          || (state.type instanceof BytesType && state.type.bound === undefined);
        if (state.immutable && nonValueType) {
          throw new InvalidImmutableTypeError(
            state,
            state.type instanceof FunctionType && state.type.isExternal,
          );
        }
      }
      for (const collection of node.collections) {
        if (collection.immutable) {
          throw new InvalidImmutableTypeError(collection);
        }
      }
    }
    this.immutableStateNames = new Set(node.stateVariables.filter((state) => state.immutable).map((state) => state.name));
    this.stateTypes = new Map([
      ...node.stateVariables.map((state) => [state.name, state.type] as const),
      ...node.collections.map((collection) => [collection.name, collection.type] as const),
    ]);
    for (const modifier of node.modifierDefinitions) {
      for (const parameter of modifier.parameters) {
        this.validateLocation(parameter.type, parameter.modifier, parameter, 'parameter', 'internal');
      }
      const visitStatement = (statement: Node): void => {
        if (statement instanceof ReturnNode && statement.expressions.length > 0) {
          throw new InvalidDataLocationError(statement, 'Return arguments are not allowed in modifiers');
        }
        for (const value of Object.values(statement)) {
          if (value instanceof Node) visitStatement(value);
          else if (Array.isArray(value)) {
            for (const item of value) if (item instanceof Node) visitStatement(item);
          }
        }
      };
      for (const statement of modifier.statements) visitStatement(statement);
    }
    if (node.constructorDef) {
      this.validateConstructorVisibility(node.constructorDef);
      node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    }
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    this.currentContractIsAbstract = previousAbstract;
    this.immutableStateNames = previousImmutableStateNames;
    this.stateTypes = previousStateTypes;
    return node;
  }

  private validateConstructorVisibility(node: FunctionDefinitionNode): void {
    if (!this.solidityImportCompat) return;
    if (node.modifiers.includes(FunctionModifier.EXTERNAL)) {
      throw new InvalidModifierCombinationError(node, 'constructor cannot have external visibility');
    }
    if (node.modifiers.includes(FunctionModifier.INTERNAL) && !this.currentContractIsAbstract) {
      throw new InvalidModifierCombinationError(node, 'non-abstract contracts cannot have internal constructors');
    }
    if (node.modifiers.includes(FunctionModifier.PUBLIC) && this.currentContractIsAbstract) {
      throw new InvalidModifierCombinationError(node, 'abstract contracts cannot have public constructors');
    }
  }

  visitStateAssign(node: StateAssignNode): Node {
    if (this.immutableStateNames.has(node.name) && this.currentFunction?.name !== '__construct') {
      throw new ImmutableStateVariableAssignmentError(node, node.name);
    }
    return super.visitStateAssign(node);
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    this.validateFunctionModifiers(node);
    const isConstructor = node.name === '__construct';
    if (this.solidityImportCompat && isConstructor && !this.currentContractIsAbstract) {
      const internalPointer = node.parameters.find((parameter) =>
        parameter.type instanceof FunctionType && !parameter.type.isExternal);
      if (internalPointer) {
        throw new InvalidDataLocationError(
          internalPointer,
          'Internal function type is not allowed in a concrete constructor parameter',
        );
      }
    }
    // File-level and library-inline functions are internal unless explicitly made public/external. The generic
    // AST visibility getter defaults an unmarked function to public because that is correct for contract members.
    const visibility = node.isFreeFunction
      && !node.modifiers.includes(FunctionModifier.PUBLIC) && !node.modifiers.includes(FunctionModifier.EXTERNAL)
      ? 'internal' : node.visibility;
    for (const parameter of node.parameters) {
      this.validateLocation(parameter.type, parameter.modifier, parameter, 'parameter', visibility, isConstructor,
        node.isLibraryFunction, isConstructor && this.currentContractIsAbstract);
    }
    node.returnTypes.forEach((type, i) => {
      this.validateLocation(type, node.returnModifiers[i] ?? [], node, 'return', visibility, false,
        node.isLibraryFunction);
    });
    const previous = this.currentFunction;
    const previousLocations = this.bindingLocations;
    const previousTypes = this.bindingTypes;
    const previousCalldataLocals = this.calldataLocals;
    const previousInitializedCalldataLocals = this.initializedCalldataLocals;
    this.currentFunction = node;
    this.bindingLocations = new Map(node.parameters.map((parameter) => [
      parameter.name,
      this.locations(parameter.modifier)[0],
    ]));
    this.bindingTypes = new Map(node.parameters.map((parameter) => [parameter.name, parameter.type]));
    this.calldataLocals = new Set();
    this.initializedCalldataLocals = new Set();
    node.body = this.visit(node.body) as typeof node.body;
    this.currentFunction = previous;
    this.bindingLocations = previousLocations;
    this.bindingTypes = previousTypes;
    this.calldataLocals = previousCalldataLocals;
    this.initializedCalldataLocals = previousInitializedCalldataLocals;
    return node;
  }

  visitNullaryOp(node: NullaryOpNode): Node {
    if (this.solidityImportCompat && this.currentFunction?.isReceive
      && node.operator === NullaryOperator.MSG_DATA) {
      throw new InvalidDataLocationError(node, "'msg.data' cannot be used inside a receive function");
    }
    return super.visitNullaryOp(node);
  }

  visitVariableDefinition(node: VariableDefinitionNode): Node {
    this.validateLocation(node.type, node.modifier, node, 'local', this.currentFunction?.visibility, false);
    const location = this.locations(node.modifier)[0];
    if (location === Modifier.CALLDATA && node.expression instanceof IdentifierNode
      && this.bindingLocations.get(node.expression.name) !== Modifier.CALLDATA) {
      throw new InvalidDataLocationError(node,
        `cannot initialize calldata local '${node.name}' from non-calldata binding '${node.expression.name}'`);
    }
    const visited = super.visitVariableDefinition(node) as VariableDefinitionNode;
    this.bindingLocations.set(node.name, location);
    this.bindingTypes.set(node.name, node.type);
    if (location === Modifier.CALLDATA) {
      this.calldataLocals.add(node.name);
      if (node.expression) this.initializedCalldataLocals.add(node.name);
    }
    return visited;
  }

  visitTryCatch(node: TryCatchNode): Node {
    if (this.solidityImportCompat) {
      for (const parameter of node.returnParameters ?? []) {
        // Try-return bindings mirror an external return ABI and cannot introduce storage pointers.
        this.validateLocation(parameter.type, parameter.modifier, parameter, 'parameter', 'external');
      }
    }
    return super.visitTryCatch(node);
  }

  visitAbiDecode(node: AbiDecodeNode): Node {
    if (this.solidityImportCompat && node.schema.some((type) => this.isTooLargeForMemory(type))) {
      throw new InvalidDataLocationError(node, 'Type too large for memory');
    }
    return super.visitAbiDecode(node);
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    // An explicit `this.f(memoryValue)` is an external ABI boundary in Solidity: the value is encoded into fresh
    // calldata. SolidCash lowers that call to a direct subroutine and marks it with fromThisCall, but source-level
    // location validation must retain the external-call conversion.
    if (this.solidityImportCompat && !node.fromThisCall) {
      const candidates = this.functionDefinitions.get(node.identifier.name)
        ?.filter((candidate) => candidate.parameters.length === node.parameters.length) ?? [];
      if (candidates.length === 1) {
        const callee = candidates[0];
        for (let index = 0; index < callee.parameters.length; index += 1) {
          const expectedLocation = this.locations(callee.parameters[index].modifier)[0];
          if (expectedLocation !== Modifier.CALLDATA) continue;
          const actualLocation = this.sliceSourceLocation(node.parameters[index]);
          if (actualLocation !== undefined && actualLocation !== Modifier.CALLDATA) {
            throw new InvalidDataLocationError(
              node.parameters[index],
              `cannot pass ${actualLocation} reference to calldata parameter '${callee.parameters[index].name}'`,
            );
          }
        }
      }
    }
    return super.visitFunctionCall(node);
  }

  visitSlice(node: SliceNode): Node {
    if (node.isSolidityIndexRange) {
      const sourceType = this.sliceSourceType(node.element);
      const dynamicArray = (sourceType instanceof ArrayType && sourceType.bound === undefined)
        || (sourceType instanceof BytesType && sourceType.bound === undefined)
        || sourceType === PrimitiveType.STRING
        // Nested calldata arrays retain their location through indexing. Their inner bound is normalized later,
        // so source-level validation keys on the indexed calldata root and lets ordinary type checking validate
        // that the selected inner value is itself sliceable.
        || node.element instanceof ArrayAccessNode
        || node.element instanceof TupleIndexOpNode;
      if (!dynamicArray || this.sliceSourceLocation(node.element) !== Modifier.CALLDATA) {
        throw new InvalidDataLocationError(node,
          'Index range access is only supported for dynamic calldata arrays');
      }
    }
    return super.visitSlice(node);
  }

  private sliceSourceType(node: ExpressionNode): Type | undefined {
    if (node instanceof NullaryOpNode && node.operator === NullaryOperator.MSG_DATA) return new BytesType();
    if (node instanceof IdentifierNode) return this.bindingTypes.get(node.name) ?? this.stateTypes.get(node.name);
    if (node instanceof ArrayAccessNode) {
      const parent = this.sliceSourceType(node.array);
      return parent instanceof ArrayType ? parent.elementType : undefined;
    }
    if (node instanceof TupleIndexOpNode) {
      const parent = this.sliceSourceType(node.tuple);
      return parent instanceof ArrayType ? parent.elementType : undefined;
    }
    if (node instanceof SliceNode) {
      const parent = this.sliceSourceType(node.element);
      return parent instanceof ArrayType ? new ArrayType(parent.elementType) : parent;
    }
    return undefined;
  }

  private sliceSourceLocation(node: ExpressionNode): string | undefined {
    if (node instanceof NullaryOpNode && node.operator === NullaryOperator.MSG_DATA) return Modifier.CALLDATA;
    if (node instanceof IdentifierNode) {
      return this.bindingLocations.get(node.name) ?? (this.stateTypes.has(node.name) ? Modifier.STORAGE : undefined);
    }
    if (node instanceof ArrayAccessNode) return this.sliceSourceLocation(node.array);
    if (node instanceof TupleIndexOpNode) return this.sliceSourceLocation(node.tuple);
    if (node instanceof SliceNode) return this.sliceSourceLocation(node.element);
    return undefined;
  }

  visitAssign(node: AssignNode): Node {
    // Bare state writes are still AssignNodes at this pre-semantic stage. Reject immutable writes here before
    // internal-function inlining can move one into a constructor and erase the source-level function boundary.
    if (this.immutableStateNames.has(node.identifier.name) && !this.bindingLocations.has(node.identifier.name)
      && this.currentFunction?.name !== '__construct') {
      throw new ImmutableStateVariableAssignmentError(node, node.identifier.name);
    }
    if (this.bindingLocations.get(node.identifier.name) === Modifier.CALLDATA
      && node.expression instanceof IdentifierNode
      && this.bindingLocations.get(node.expression.name) !== Modifier.CALLDATA) {
      throw new InvalidDataLocationError(node,
        `cannot rebind calldata local '${node.identifier.name}' from non-calldata binding '${node.expression.name}'`);
    }
    node.expression = this.visit(node.expression);
    if (this.calldataLocals.has(node.identifier.name)) {
      this.initializedCalldataLocals.add(node.identifier.name);
    } else {
      node.identifier = this.visit(node.identifier) as IdentifierNode;
    }
    return node;
  }

  visitTupleAssignment(node: TupleAssignmentNode): Node {
    const visited = super.visitTupleAssignment(node) as TupleAssignmentNode;
    for (const element of node.elements) {
      if (element.existing && element.name && this.calldataLocals.has(element.name)) {
        this.initializedCalldataLocals.add(element.name);
      }
    }
    return visited;
  }

  visitIdentifier(node: IdentifierNode): Node {
    if (this.calldataLocals.has(node.name) && !this.initializedCalldataLocals.has(node.name)) {
      throw new InvalidDataLocationError(node,
        `calldata local '${node.name}' may be read before it is initialized`);
    }
    return node;
  }

  visitBranch(node: BranchNode): Node {
    node.condition = this.visit(node.condition);
    const localsBefore = new Set(this.calldataLocals);
    const initializedBefore = new Set(this.initializedCalldataLocals);
    node.ifBlock = this.visit(node.ifBlock) as typeof node.ifBlock;
    const initializedIf = new Set(this.initializedCalldataLocals);

    this.calldataLocals = new Set(localsBefore);
    this.initializedCalldataLocals = new Set(initializedBefore);
    if (node.elseBlock) node.elseBlock = this.visit(node.elseBlock) as typeof node.elseBlock;
    const initializedElse = new Set(this.initializedCalldataLocals);

    this.calldataLocals = localsBefore;
    this.initializedCalldataLocals = new Set(
      [...initializedIf].filter((name) => initializedElse.has(name)),
    );
    return node;
  }

  private isReferenceType(type: Type): boolean {
    return type instanceof ArrayType || type instanceof MappingType || type instanceof StructType
      || (type instanceof BytesType && type.bound === undefined) || type === PrimitiveType.STRING;
  }

  private containsMapping(type: Type): boolean {
    return type instanceof MappingType
      || (type instanceof ArrayType && this.containsMapping(type.elementType));
  }

  private locations(modifiers: string[]): string[] {
    return modifiers.filter((m) => m === Modifier.MEMORY || m === Modifier.CALLDATA || m === Modifier.STORAGE);
  }

  private validateLocation(type: Type, modifiers: string[], node: Node, context: Context, visibility?: string,
    isConstructor = false, isLibraryFunction = false, isAbstractConstructor = false): void {
    const locations = this.locations(modifiers);
    if (locations.length === 0) {
      return;
    }
    if (locations.length > 1) {
      throw new InvalidDataLocationError(node, `multiple data locations specified (${locations.join(', ')})`);
    }
    const location = locations[0];
    if (this.solidityImportCompat && location === Modifier.MEMORY && this.isTooLargeForMemory(type)) {
      throw new InvalidDataLocationError(node, 'Type too large for memory');
    }
    if (!this.isReferenceType(type)) {
      throw new InvalidDataLocationError(node,
        `data location '${location}' is only valid for reference types, not '${type}'`);
    }
    if (context === 'local') {
      if (this.containsMapping(type) && location !== Modifier.STORAGE) {
        throw new InvalidDataLocationError(node, "mapping-containing locals must have 'storage' location");
      }
      return;
    }
    if (context === 'return') {
      if (location === Modifier.STORAGE && !isLibraryFunction
        && visibility !== 'internal' && visibility !== 'private') {
        throw new InvalidDataLocationError(node,
          "'storage' return parameters are only valid on internal or private functions");
      }
      if (this.containsMapping(type) && location !== Modifier.STORAGE) {
        throw new InvalidDataLocationError(node, "mapping-containing return parameters must have 'storage' location");
      }
      return;
    }
    if (isConstructor && location === Modifier.CALLDATA) {
      throw new InvalidDataLocationError(node, "constructor parameters cannot have 'calldata' location");
    }
    if (location === Modifier.STORAGE && !isLibraryFunction && !isAbstractConstructor
      && visibility !== 'internal' && visibility !== 'private') {
      throw new InvalidDataLocationError(node,
        "'storage' parameters are only valid on internal or private functions");
    }
    if (this.containsMapping(type) && location !== Modifier.STORAGE) {
      throw new InvalidDataLocationError(node, "mapping-containing parameters must have 'storage' location");
    }
  }

  // Solidity's memory type layout uses 32-byte words and rejects a statically materializable component whose
  // head exceeds the 32-bit memory-size limit. Dynamic members occupy one pointer word in their parent, but their
  // element type must itself be representable because decoding/allocating one element can materialize it.
  private isTooLargeForMemory(type: Type): boolean {
    const maxMemoryBytes = 0xffff_ffffn;
    const size = (candidate: Type, seen: Set<string>): bigint => {
      if (candidate instanceof ArrayType) {
        const elementSize = size(candidate.elementType, seen);
        if (elementSize > maxMemoryBytes) return elementSize;
        if (candidate.bound === undefined) return 32n;
        if (!Number.isFinite(candidate.bound) || candidate.bound < 0) return maxMemoryBytes + 1n;
        return BigInt(Math.trunc(candidate.bound)) * elementSize;
      }
      if (candidate instanceof StructType) {
        if (seen.has(candidate.name)) return 32n;
        const next = new Set(seen).add(candidate.name);
        let total = 0n;
        for (const field of candidate.fields) {
          const fieldSize = size(field.type, next);
          if (fieldSize > maxMemoryBytes) return fieldSize;
          total += fieldSize;
          if (total > maxMemoryBytes) return total;
        }
        return total;
      }
      // Dynamic bytes/string, mappings (which are rejected separately), and scalar values occupy one memory word
      // in a containing aggregate's head.
      return 32n;
    };
    return size(type, new Set()) > maxMemoryBytes;
  }

  private validateFunctionModifiers(node: FunctionDefinitionNode): void {
    const seen = new Set<FunctionModifier>();
    for (const modifier of node.modifiers) {
      if (seen.has(modifier)) {
        throw new InvalidModifierCombinationError(node, `modifier '${modifier}' specified more than once`);
      }
      seen.add(modifier);
    }
    const visibility = [FunctionModifier.PUBLIC, FunctionModifier.EXTERNAL,
      FunctionModifier.INTERNAL, FunctionModifier.PRIVATE].filter((m) => seen.has(m));
    if (visibility.length > 1) {
      throw new InvalidModifierCombinationError(node,
        `multiple visibility modifiers specified (${visibility.join(', ')})`);
    }
    const mutability = [FunctionModifier.PURE, FunctionModifier.VIEW, FunctionModifier.PAYABLE]
      .filter((m) => seen.has(m));
    if (mutability.length > 1) {
      throw new InvalidModifierCombinationError(node,
        `multiple state mutability modifiers specified (${mutability.join(', ')})`);
    }
    if (node.isLibraryFunction && seen.has(FunctionModifier.PAYABLE)) {
      throw new InvalidModifierCombinationError(node, 'library functions cannot be payable');
    }
    // Solidity retains a legacy exception for externally callable functions named `this`, `super`, or `_`
    // (their ABI selectors are unambiguous), but reserves those names for internal/private functions.
    if (['_', 'super', 'this'].includes(node.name)
      && (node.visibility === 'internal' || node.visibility === 'private')) {
      throw new InvalidModifierCombinationError(
        node,
        `function name '${node.name}' is reserved for internal/private functions`,
      );
    }
  }
}
