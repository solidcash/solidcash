import { Type, PrimitiveType, StructType, EnumType } from '@solidcash/utils';
import {
  IdentifierNode,
  FunctionDefinitionNode,
  VariableDefinitionNode,
  ParameterNode,
  Node,
  FunctionCallNode,
  BinaryOpNode,
  UnaryOpNode,
  TimeOpNode,
  CastNode,
  AssignNode,
  BranchNode,
  ArrayNode,
  TupleIndexOpNode,
  RequireNode,
  InstantiationNode,
  StatementNode,
  ContractNode,
  ExpressionNode,
  SliceNode,
  IntLiteralNode,
  StateAccessNode,
  StateAssignNode,
  StateVariableNode,
  MappingAccessNode,
  MappingAssignNode,
  MappingDeleteNode,
  CollectionIterationNode,
  AbiDecodeAtNode,
  StructDefinitionNode,
  FieldAccessNode,
  EventDefinitionNode,
  ErrorDefinitionNode,
  EmitStatementNode,
  TokenContainerMethodStatementNode,
  ReturnNode,
  FunctionCallStatementNode,
  ConstantDefinitionNode,
  EnumDefinitionNode,
  TypeDefinitionNode,
  ModifierDefinitionNode,
  TernaryOpNode,
  AssemblyStatementNode,
  InterfaceNode,
  RevertNode,
} from './ast/AST.js';
import { Symbol, SymbolType } from './ast/SymbolTable.js';
import { Location } from './ast/Location.js';
import { BinaryOperator } from './ast/Operator.js';

export class SolidCashError extends Error {
  node: Node;

  constructor(
    node: Node,
    message: string,
  ) {
    if (node.location) {
      message += ` at ${node.location.start}`;
    }

    super(message);
    this.name = this.constructor.name;
    this.node = node;
  }
}

export class ParseError extends Error {
  constructor(
    message: string,
    public location?: Location,
  ) {
    if (location) {
      message += ` at ${location.start}`;
    }

    super(message);
    this.name = this.constructor.name;
  }
}

export class UndefinedReferenceError extends SolidCashError {
  constructor(
    public node: IdentifierNode,
  ) {
    super(node, `Undefined reference to symbol ${node.name}`);
  }
}

export class InvalidSymbolTypeError extends SolidCashError {
  constructor(
    public node: IdentifierNode,
    public expected: SymbolType,
  ) {
    super(node, `Found symbol ${node.name} with type ${node.definition?.symbolType} where type ${expected} was expected`);
  }
}

export class RedefinitionError extends SolidCashError { }

export class FunctionRedefinitionError extends RedefinitionError {
  constructor(
    public node: FunctionDefinitionNode,
    paramTypes?: string,
  ) {
    const suffix = paramTypes ? ` with signature (${paramTypes})` : '';
    super(node, `Redefinition of function ${node.name}${suffix}`);
  }
}

export class FunctionSelectorCollisionError extends RedefinitionError {
  constructor(
    public node: FunctionDefinitionNode,
    public existing: FunctionDefinitionNode,
    public selectorHex: string,
  ) {
    super(node, `Function '${node.name}' has the same 4-byte selector (0x${selectorHex}) as function '${existing.name}'`);
  }
}

export class VariableRedefinitionError extends RedefinitionError {
  constructor(
    public node: VariableDefinitionNode | ParameterNode | ConstantDefinitionNode,
  ) {
    super(node, `Redefinition of variable ${node.name}`);
  }
}

export class UnusedVariableError extends SolidCashError {
  constructor(
    public symbol: Symbol,
  ) {
    super(symbol.definition as Node, `Unused variable ${symbol.name}`);
  }
}

export class EmptyContractError extends SolidCashError {
  constructor(
    public node: ContractNode,
  ) {
    super(node, `Contract ${node.name} contains no functions`);
  }
}

export class TransferInStatelessContractError extends SolidCashError {
  constructor(
    public node: FunctionDefinitionNode,
  ) {
    super(
      node,
      'satoshi transfers (this.transfer()/address.transfer()/address.send()) require a stateful contract '
      + '(one with state variables): a stateless contract has no covenant block to enforce the transfer outputs',
    );
  }
}

export class EmptyFunctionError extends SolidCashError {
  constructor(
    public node: FunctionDefinitionNode,
  ) {
    super(node, `Function ${node.name} contains no statements`);
  }
}

export class FinalRequireStatementError extends SolidCashError {
  constructor(
    public node: StatementNode,
  ) {
    super(node, 'Final statement is expected to be a require() statement');
  }
}

export class TypeError extends SolidCashError {
  constructor(
    node: Node,
    public actual?: Type | Type[],
    public expected?: Type | Type[],
    message?: string,
  ) {
    super(node, message ?? `Found type '${actual}' where type '${expected}' was expected`);
  }
}

export class InvalidParameterTypeError extends TypeError {
  constructor(
    node: FunctionCallNode | RequireNode | InstantiationNode,
    actual: Type[],
    expected: Type[],
  ) {
    const name = node instanceof RequireNode ? 'require' : node.identifier.name;
    super(
      node, actual, expected,
      `Found parameters (${actual}) in call to function '${name}' where parameters (${expected}) were expected`,
    );
  }
}

export class UnequalTypeError extends TypeError {
  constructor(
    node: BinaryOpNode,
  ) {
    const left = node.left.type;
    const right = node.right.type;
    super(node, left, right, `Tried to apply operator '${node.operator}' to unequal types '${left}' and '${right}'`);
  }
}

export class TernaryTypeMismatchError extends TypeError {
  constructor(node: TernaryOpNode) {
    const ifTrue = node.ifTrue.type;
    const ifFalse = node.ifFalse.type;
    super(node, ifTrue, ifFalse, `Ternary branches have incompatible types '${ifTrue}' and '${ifFalse}'`);
  }
}

export class InvalidAssemblyError extends SolidCashError {
  constructor(node: AssemblyStatementNode, detail: string) {
    super(node, `Invalid inline assembly: ${detail}`);
  }
}

export class BreakOutsideLoopError extends SolidCashError {
  constructor(node: Node) {
    super(node, '\'break\' statement must be inside a loop');
  }
}

export class ContinueOutsideLoopError extends SolidCashError {
  constructor(node: Node) {
    super(node, '\'continue\' statement must be inside a loop');
  }
}

export class UnsupportedTypeError extends TypeError {
  constructor(
    node: BinaryOpNode | UnaryOpNode | TimeOpNode | TupleIndexOpNode | SliceNode,
    actual?: Type,
    expected?: Type,
  ) {
    if (node instanceof BinaryOpNode && node.operator.startsWith('.')) {
      if (expected === PrimitiveType.BIGINT) {
        super(node, actual, expected, `Tried to call member 'split' with unsupported parameter type '${actual}'`);
      } else {
        super(node, actual, expected, `Tried to call member 'split' on unsupported type '${actual}'`);
      }
    } else if (node instanceof SliceNode) {
      super(node, actual, expected, `Tried to call member 'slice' on unsupported type '${actual}'`);
    } else if (node instanceof BinaryOpNode) {
      super(node, actual, expected, `Tried to apply operator '${node.operator}' to unsupported type '${actual}'`);
    } else if (node instanceof UnaryOpNode && node.operator.startsWith('.')) {
      super(node, actual, expected, `Tried to access member '${node.operator}' on unsupported type '${actual}'`);
    } else if (node instanceof UnaryOpNode && node.operator.includes('[i]')) {
      const [scope] = node.operator.split('[i]');
      super(node, actual, expected, `Tried to index '${scope}''with unsupported type '${actual}'`);
    } else if (node instanceof UnaryOpNode) {
      super(node, actual, expected, `Tried to apply operator '${node.operator}' to unsupported type '${actual}'`);
    } else if (node instanceof TimeOpNode) {
      super(node, actual, expected, `Tried to apply operator '>=' on unsupported type '${actual}'`);
    } else if (node instanceof TupleIndexOpNode) {
      super(node, actual, expected, `Tried to index unsupported type '${actual}'`);
    } else {
      super(node, actual, expected);
    }
  }
}

export class CastTypeError extends TypeError {
  constructor(
    node: CastNode,
  ) {
    super(node, node.expression.type, node.type, `Type '${node.expression.type}' is not castable to type '${node.type}'`);
  }
}

export class InvalidFixedPointError extends SolidCashError {}

export class AssignTypeError extends TypeError {
  constructor(
    node: AssignNode | VariableDefinitionNode,
  ) {
    const expected = node instanceof AssignNode ? node.identifier.type : node.type;
    // Only raised for an actual initializer mismatch, so expression is present.
    const actual = node.expression!.type;
    super(node, actual, expected, `Type '${actual}' can not be assigned to variable of type '${expected}'`);
  }
}

export class TupleAssignmentError extends SolidCashError {
  constructor(
    node: ExpressionNode,
  ) {
    super(node, 'Expression must return a tuple to use destructuring');
  }
}

export class TupleMixedSlotsError extends SolidCashError {
  constructor(
    node: Node,
  ) {
    super(node, 'Cannot mix new declarations and existing variables in a single tuple assignment');
  }
}

export class FunctionTypeNotEncodableError extends SolidCashError {
  constructor(node: Node, context: string) {
    super(node, `Function types cannot be used as ${context}`);
  }
}

export class ConstantModificationError extends SolidCashError {
  constructor(
    node: VariableDefinitionNode | ConstantDefinitionNode,
  ) {
    super(node, `Tried to modify immutable variable '${node.name}'`);
  }
}

export class ArrayElementError extends SolidCashError {
  constructor(
    node: ArrayNode,
  ) {
    super(node, 'Incorrect elements in array');
  }
}

export class IndexOutOfBoundsError extends SolidCashError {
  constructor(
    node: TupleIndexOpNode | BinaryOpNode | SliceNode,
  ) {
    if (node instanceof TupleIndexOpNode) {
      super(node, `Index ${node.index} out of bounds`);
    } else if (
      node instanceof BinaryOpNode && node.operator === BinaryOperator.SPLIT && node.right instanceof IntLiteralNode
    ) {
      const splitIndex = Number(node.right.value);
      super(node, `Split index ${splitIndex} out of bounds for type ${node.left.type}`);
    } else if (node instanceof SliceNode) {
      const start = node.start instanceof IntLiteralNode ? Number(node.start.value) : 'start';
      const end = node.end instanceof IntLiteralNode ? Number(node.end.value) : 'end';
      super(node, `Slice indexes (${start}, ${end}) out of bounds for type ${node.element.type}`);
    } else {
      super(node, 'Index out of bounds');
    }
  }
}

export class BitshiftBitcountNegativeError extends SolidCashError {
  constructor(
    node: BinaryOpNode,
    bitcount: number,
  ) {
    super(node, `Bitshift bitcount cannot be negative: ${bitcount}`);
  }
}

export class VersionError extends Error {
  constructor(
    actual: string,
    constraint: string,
  ) {
    const message = `solidc version ${actual} does not satisfy version constraint ${constraint}`;
    super(message);

    this.name = this.constructor.name;
  }
}

export class SignedExponentError extends SolidCashError {
  constructor(
    public node: Node,
    public exponentType: string,
  ) {
    super(node, `Exponent type '${exponentType}' must be unsigned. Use an unsigned type (e.g. uint8, uint16) or unbounded int`);
  }
}

export class UnsupportedStateTypeError extends SolidCashError {
  constructor(
    public node: StateVariableNode,
  ) {
    super(node, `Type '${node.type}' is not supported for state variables`);
  }
}

export class StateVariableNameCollisionError extends ParseError {
  constructor(
    name: string,
    location: Location,
  ) {
    super(`State variable name '${name}' collides with built-in 'this.${name}'`, location);
  }
}

export class UndefinedStateVariableError extends SolidCashError {
  constructor(
    public node: StateAccessNode | StateAssignNode,
  ) {
    super(node, `Undefined state variable '${node.name}'`);
  }
}

export class StateAssignTypeError extends TypeError {
  constructor(
    node: StateAssignNode,
    actual?: Type,
    expected?: Type,
  ) {
    super(node, actual, expected, `Type '${actual}' can not be assigned to state variable of type '${expected}'`);
  }
}

export class AbiEncodeEmptyError extends SolidCashError {
  constructor(node: Node) {
    super(node, 'abi.encode/abi.encodePacked requires at least 1 argument');
  }
}

export class AbiEncodeCallUndefinedInterfaceError extends SolidCashError {
  constructor(node: Node, name: string) {
    super(node, `Interface '${name}' referenced in abi.encodeCall is not defined`);
  }
}

export class AbiEncodeCallUndefinedFunctionError extends SolidCashError {
  constructor(node: Node, iface: string, func: string) {
    super(node, `Function '${func}' not found in interface '${iface}'`);
  }
}

export class AbiEncodeCallArgCountError extends SolidCashError {
  constructor(node: Node, expected: number, actual: number) {
    super(node, `abi.encodeCall expected ${expected} arguments but got ${actual}`);
  }
}

export class AbiDecodeIndexError extends SolidCashError {
  constructor(node: AbiDecodeAtNode) {
    super(node, `Index ${node.index} is out of bounds for schema of length ${node.schema.length}`);
  }
}

export class UndefinedCollectionError extends SolidCashError {
  constructor(
    public node: MappingAccessNode | MappingAssignNode | MappingDeleteNode | CollectionIterationNode,
  ) {
    const name = node instanceof CollectionIterationNode ? node.collectionName : node.name;
    super(node, `Undefined mapping '${name}'`);
  }
}

export class MappingKeyMustBeParameterError extends SolidCashError {
  constructor(
    public node: MappingAccessNode | MappingAssignNode | MappingDeleteNode,
  ) {
    super(node, `Mapping key for '${node.name}' must be a function parameter (not an expression)`);
  }
}

export class MappingAccessInConstructorError extends SolidCashError {
  constructor(
    public node: MappingAccessNode | MappingAssignNode | MappingDeleteNode,
  ) {
    super(node, `Mapping access 'this.${node.name}' is not allowed in the constructor`);
  }
}

export class MappingAssignTypeError extends TypeError {
  constructor(
    node: MappingAssignNode,
    actual?: Type,
    expected?: Type,
  ) {
    super(node, actual, expected, `Type '${actual}' can not be assigned to mapping value of type '${expected}'`);
  }
}

export class UnsupportedMappingKeyTypeError extends SolidCashError {
  constructor(node: Node, keyType: Type) {
    super(node, `Type '${keyType}' is not supported as a mapping key type`);
  }
}

export class UnsupportedMappingValueTypeError extends SolidCashError {
  constructor(node: Node, valueType: Type) {
    super(node, `Type '${valueType}' is not supported as a mapping value type`);
  }
}

export class UnsupportedArrayElementTypeError extends SolidCashError {
  constructor(node: Node, elementType: Type) {
    super(node, `Unsupported array element type '${elementType}'`);
  }
}

export class InvalidArrayBoundError extends SolidCashError {
  constructor(node: Node) {
    super(node, 'Array bound must be a positive integer.');
  }
}

export class PackedArrayUnsupportedTypeError extends SolidCashError {
  constructor(node: Node, elementType: Type) {
    super(node, `Cannot use 'packed' modifier with variable-width element type '${elementType}'. Use a bounded type (e.g. bytes32, int<64>) instead.`);
  }
}

export class UndefinedStructFieldError extends SolidCashError {
  constructor(node: FieldAccessNode, structType: StructType) {
    super(node, `Struct '${structType.name}' has no field '${node.name}'`);
  }
}

export class StructFieldCountError extends SolidCashError {
  constructor(node: Node, expected: number, actual: number) {
    super(node, `Struct constructor expects ${expected} arguments but got ${actual}`);
  }
}

export class StructDuplicateFieldError extends SolidCashError {
  constructor(node: Node, structName: string, fieldName: string) {
    super(node, `Duplicate field '${fieldName}' in struct '${structName}' initialization`);
  }
}

export class StructUnknownFieldError extends SolidCashError {
  constructor(node: Node, structName: string, fieldName: string) {
    super(node, `Unknown field '${fieldName}' in struct '${structName}' initialization`);
  }
}

export class StructMissingFieldError extends SolidCashError {
  constructor(node: Node, structName: string, missingFields: string[]) {
    super(node, `Missing field(s) ${missingFields.map((f) => `'${f}'`).join(', ')} in struct '${structName}' initialization`);
  }
}

export class StructRedefinitionError extends RedefinitionError {
  constructor(node: StructDefinitionNode) {
    super(node, `Redefinition of struct ${node.name}`);
  }
}

export class TypeDefinitionRedefinitionError extends RedefinitionError {
  constructor(node: TypeDefinitionNode) {
    super(node, `Redefinition of type ${node.name}`);
  }
}

export class UnsupportedStructFieldTypeError extends SolidCashError {
  constructor(node: Node, fieldType: Type) {
    super(node, `Type '${fieldType}' is not supported as a struct field type`);
  }
}

export class EventRedefinitionError extends RedefinitionError {
  constructor(node: EventDefinitionNode) {
    super(node, `Redefinition of event ${node.name}`);
  }
}

export class UndefinedEventError extends SolidCashError {
  constructor(node: EmitStatementNode) {
    super(node, `Undefined event '${node.eventName}'`);
  }
}

export class EmitArgumentCountError extends SolidCashError {
  constructor(node: EmitStatementNode, expected: number, actual: number) {
    super(node, `Event '${node.eventName}' expects ${expected} arguments but got ${actual}`);
  }
}

export class EmitArgumentTypeError extends TypeError {
  constructor(node: EmitStatementNode, paramName: string, actual?: Type, expected?: Type) {
    super(node, actual, expected, `Type '${actual}' cannot be used for event parameter '${paramName}' of type '${expected}'`);
  }
}

export class UnsupportedEventParamTypeError extends SolidCashError {
  constructor(node: EventDefinitionNode, paramType: Type) {
    super(node, `Type '${paramType}' is not supported as an event parameter type`);
  }
}

export class ErrorRedefinitionError extends RedefinitionError {
  constructor(node: ErrorDefinitionNode) {
    super(node, `Redefinition of error ${node.name}`);
  }
}

export class UndefinedErrorError extends SolidCashError {
  constructor(node: RevertNode | RequireNode) {
    super(node, `Undefined error '${node.errorName}'`);
  }
}

export class RevertArgumentCountError extends SolidCashError {
  constructor(node: RevertNode | RequireNode, expected: number, actual: number) {
    super(node, `Error '${node.errorName}' expects ${expected} arguments but got ${actual}`);
  }
}

export class RevertArgumentTypeError extends TypeError {
  constructor(node: RevertNode | RequireNode, paramName: string, actual?: Type, expected?: Type) {
    super(node, actual, expected, `Type '${actual}' cannot be used for error parameter '${paramName}' of type '${expected}'`);
  }
}

// Named call argument error (unknown/duplicate/missing/overloaded). Message is built by the caller.
export class NamedArgumentError extends SolidCashError {}

export class TransferArgumentTypeError extends TypeError {
  constructor(node: Node, argName: string, actual?: Type, expected?: Type) {
    super(node, actual, expected, `this.transfer() argument '${argName}' has type '${actual}' but expected '${expected}'`);
  }
}

export class TokenContainerKeyMustBeParameterError extends SolidCashError {
  constructor(node: Node) {
    super(node, 'Token container key for \'this.tokens\' must be a function parameter (not an expression)');
  }
}

export class TokenContainerKeyTypeError extends SolidCashError {
  constructor(node: Node, actual?: Type) {
    super(node, `Token container key parameter must be of type 'bytes32' but found '${actual}'`);
  }
}

export class TokenContainerTransferInConstructorError extends SolidCashError {
  constructor(node: Node) {
    super(node, 'Token container access is not allowed in the constructor');
  }
}

export class TokenContainerMethodArgumentError extends TypeError {
  constructor(node: TokenContainerMethodStatementNode, argName: string, actual?: Type, expected?: Type) {
    super(node, actual, expected, `this.tokens[...].${node.methodName}() argument '${argName}' has type '${actual}' but expected '${expected}'`);
  }
}

export class UndefinedTokenContainerFieldError extends SolidCashError {
  constructor(node: FieldAccessNode, fieldName: string) {
    super(node, `Token container access has no field '${fieldName}', expected 'tokenAmount', 'tokenCategory', or 'nftCommitment'`);
  }
}

export class TokenContainerAccessInConstructorError extends SolidCashError {
  constructor(node: Node) {
    super(node, 'Token container access \'this.tokens[...]\' is not allowed in the constructor');
  }
}

export class UnbalancedBranchError extends SolidCashError {
  constructor(node: BranchNode, operation: string, ifCount: number, elseCount: number) {
    super(node, `Both branches of if/else must have the same number of ${operation} operations (if: ${ifCount}, else: ${elseCount})`);
  }
}

export class InvalidModifierCombinationError extends SolidCashError {
  constructor(node: FunctionDefinitionNode, message: string) {
    super(node, `Invalid modifier combination on function '${node.name}': ${message}`);
  }
}

export class InternalCallToExternalError extends SolidCashError {
  constructor(node: FunctionCallNode | FunctionCallStatementNode) {
    const name = node instanceof FunctionCallNode ? node.identifier.name : node.call.identifier.name;
    super(node, `Cannot call external function '${name}' from within another function`);
  }
}

export class ReturnTypeMismatchError extends SolidCashError {
  constructor(node: ReturnNode, expected: Type[], actual: Type[]) {
    super(node, `Return type mismatch: expected (${expected.join(', ')}) but found (${actual.join(', ')})`);
  }
}

export class MissingReturnError extends SolidCashError {
  constructor(node: FunctionDefinitionNode) {
    super(node, `Function '${node.name}' must return a value on all code paths`);
  }
}

export class ReturnInExternalFunctionError extends SolidCashError {
  constructor(node: ReturnNode) {
    super(node, 'Return statements are only allowed in functions with a return type declaration');
  }
}

export class NonCompileTimeExpressionError extends SolidCashError {
  constructor(node: ConstantDefinitionNode) {
    super(node, `Constant '${node.name}' must be initialized with a compile-time expression`);
  }
}

export class EnumRedefinitionError extends RedefinitionError {
  constructor(node: EnumDefinitionNode) {
    super(node, `Redefinition of enum ${node.name}`);
  }
}

export class UndefinedEnumMemberError extends SolidCashError {
  constructor(node: FieldAccessNode, enumType: EnumType) {
    super(node, `Enum '${enumType.name}' has no member '${node.name}'`);
  }
}

export class InvalidTypeIntrospectionPropertyError extends SolidCashError {
  constructor(node: Node, typeName: string, property: string, validProperties: string[]) {
    super(
      node,
      `Property '${property}' is not valid for type '${typeName}' in type() introspection. `
      + `Valid properties: ${validProperties.join(', ')}`,
    );
  }
}

export class InvalidTypeForIntrospectionError extends SolidCashError {
  constructor(node: Node, typeName: string) {
    super(
      node,
      `Type '${typeName}' does not support type() introspection. `
      + 'Only bounded integer types, fixed-point types, enums, interfaces, and contracts are supported.',
    );
  }
}

export class ModifierRedefinitionError extends RedefinitionError {
  constructor(public node: ModifierDefinitionNode) {
    super(node, `Redefinition of modifier ${node.name}`);
  }
}

export class UndefinedModifierError extends SolidCashError {
  constructor(node: Node, name: string) {
    super(node, `Undefined modifier '${name}'`);
  }
}

export class ModifierPlaceholderError extends SolidCashError {
  constructor(public node: ModifierDefinitionNode, message: string) {
    super(node, message);
  }
}

export class NoMatchingOverloadError extends SolidCashError {
  constructor(node: FunctionCallNode | FunctionCallStatementNode) {
    const name = node instanceof FunctionCallNode ? node.identifier.name : node.call.identifier.name;
    const args = node instanceof FunctionCallNode ? node.parameters : node.call.parameters;
    const argTypes = args.map((p) => p.type?.toString() ?? '?').join(', ');
    super(node, `No overload of function '${name}' matches argument types (${argTypes})`);
  }
}

export class AmbiguousOverloadError extends SolidCashError {
  constructor(node: FunctionCallNode | FunctionCallStatementNode) {
    const name = node instanceof FunctionCallNode ? node.identifier.name : node.call.identifier.name;
    super(node, `Ambiguous call to overloaded function '${name}': multiple overloads match`);
  }
}

export class CircularImportError extends Error {
  constructor(filePath: string) {
    super(`Circular import detected: ${filePath}`);
    this.name = this.constructor.name;
  }
}

export class UnresolvedImportError extends Error {
  constructor(importPath: string, fromFile: string) {
    super(`Cannot resolve import '${importPath}' from '${fromFile}'`);
    this.name = this.constructor.name;
  }
}

export class ImportSymbolNotFoundError extends Error {
  constructor(symbolName: string, importPath: string) {
    super(`Symbol '${symbolName}' not found in '${importPath}'`);
    this.name = this.constructor.name;
  }
}

export class UnsafeImportPathError extends Error {
  constructor(importPath: string, fromFile: string) {
    super(`Unsafe import path '${importPath}' from '${fromFile}': path traversal detected`);
    this.name = this.constructor.name;
  }
}

export class ContractConstructorArgCountError extends SolidCashError {
  constructor(node: Node, contractName: string, expected: number, actual: number) {
    super(node, `Contract '${contractName}' expects ${expected} constructor arguments but got ${actual}`);
  }
}

export class ContractConstructorArgTypeError extends SolidCashError {
  constructor(node: Node, contractName: string, index: number, actual?: Type, expected?: Type) {
    super(node, `Contract '${contractName}' constructor argument ${index} has type '${actual}' but expected '${expected}'`);
  }
}

export class CircularContractReferenceError extends Error {
  constructor(contractName: string) {
    super(`Circular contract reference detected involving '${contractName}'`);
    this.name = this.constructor.name;
  }
}

export class ContractNoArgsRequiredError extends SolidCashError {
  constructor(node: Node, contractName: string) {
    super(node, `Contract '${contractName}' requires constructor arguments; use '${contractName}(args).lockingBytecode' instead`);
  }
}

export class InterfaceRedefinitionError extends RedefinitionError {
  constructor(public node: InterfaceNode) {
    super(node, `Redefinition of interface ${node.name}`);
  }
}

export class UndefinedInterfaceError extends SolidCashError {
  constructor(public node: Node, interfaceName: string) {
    super(node, `Undefined interface '${interfaceName}'`);
  }
}

export class CircularInterfaceInheritanceError extends SolidCashError {
  constructor(public node: InterfaceNode) {
    super(node, `Circular inheritance detected for interface '${node.name}'`);
  }
}

export class InterfaceComplianceError extends SolidCashError {
  constructor(public node: ContractNode, message: string) {
    super(node, message);
  }
}

export class CircularContractInheritanceError extends SolidCashError {
  constructor(public node: ContractNode) {
    super(node, `Circular inheritance detected for contract '${node.name}'`);
  }
}

export class C3LinearizationError extends SolidCashError {
  constructor(public node: ContractNode) {
    super(node, `Inconsistent inheritance hierarchy for contract '${node.name}': cannot compute a C3 linearization`);
  }
}

export class NonVirtualOverrideError extends SolidCashError {
  constructor(node: Node, functionName: string, parentName: string) {
    super(node, `Cannot override '${functionName}': '${parentName}' did not mark it 'virtual'`);
  }
}

export class OverrideBaseListError extends SolidCashError {
  constructor(node: Node, functionName: string, baseName: string) {
    super(node, `override(${baseName}) on '${functionName}': '${baseName}' is not a base contract that declares it`);
  }
}

export class InheritanceNameCollisionError extends SolidCashError {
  constructor(public node: ContractNode, kind: string, name: string, parentName: string) {
    super(node, `${kind} '${name}' is already defined in parent contract '${parentName}'`);
  }
}

export class MissingOverrideError extends SolidCashError {
  constructor(public node: ContractNode, funcName: string, parentName: string) {
    super(node, `Function '${funcName}' in '${node.name}' conflicts with '${parentName}'. Use 'override' to replace it.`);
  }
}

export class DiamondInheritanceError extends SolidCashError {
  constructor(public node: ContractNode, kind: string, name: string, parent1: string, parent2: string) {
    super(node, `Diamond inheritance conflict: ${kind} '${name}' is inherited from both '${parent1}' and '${parent2}'. Use 'override' to resolve the ambiguity.`);
  }
}

export class AbstractContractNotCompilableError extends Error {
  constructor(contractName: string) {
    super(`Cannot compile abstract contract '${contractName}' - abstract contracts do not produce artifacts. Extend it with a concrete contract instead.`);
    this.name = this.constructor.name;
  }
}

export class AbstractFunctionInConcreteContractError extends SolidCashError {
  constructor(public node: Node, funcName: string) {
    super(node, `Function '${funcName}' has no body but contract is not abstract. Either add a body or mark the contract as abstract.`);
  }
}

export class UnimplementedAbstractFunctionError extends SolidCashError {
  constructor(public node: ContractNode, funcName: string, parentName: string) {
    super(node, `Concrete contract '${node.name}' must implement abstract function '${funcName}' from '${parentName}'.`);
  }
}

export class StatefulContractDeploymentError extends SolidCashError {
  constructor(public node: Node, contractName: string) {
    super(node, `Cannot use 'new ${contractName}(...)' for stateful contracts outside a 'deploy' function. Use the 'deploy' modifier on the enclosing function.`);
  }
}

export class DeployValueInNonStatefulError extends SolidCashError {
  constructor(public node: Node, contractName: string) {
    super(node, `'new ${contractName}{value: ...}' can only be used in stateful contracts that have covenant verification.`);
  }
}

export class LibraryNotCompilableError extends Error {
  constructor(libraryName: string) {
    super(`Cannot compile library '${libraryName}' - libraries do not produce artifacts. Import library functions into a contract instead.`);
    this.name = this.constructor.name;
  }
}

export class ParentInvocationArgCountError extends SolidCashError {
  constructor(node: Node, parentName: string, expected: number, actual: number) {
    super(node, `Parent constructor invocation '${parentName}' expects ${expected} arguments but got ${actual}`);
  }
}

export class UndefinedParentInvocationError extends SolidCashError {
  constructor(node: Node, parentName: string) {
    super(node, `Parent invocation references '${parentName}' which is not a parent contract`);
  }
}

export class DuplicateParentInvocationError extends SolidCashError {
  constructor(node: Node, parentName: string) {
    super(node, `Duplicate parent constructor invocation for '${parentName}'`);
  }
}

export class PrivateStateVariableAccessError extends SolidCashError {
  constructor(node: Node, varName: string, parentName: string) {
    super(node, `Cannot access private state variable '${varName}' inherited from '${parentName}'`);
  }
}

export class PrivateCollectionAccessError extends SolidCashError {
  constructor(node: Node, collName: string, parentName: string) {
    super(node, `Cannot access private collection '${collName}' inherited from '${parentName}'`);
  }
}

export class UndefinedExternalStateVariableError extends SolidCashError {
  constructor(node: Node, interfaceName: string, varName: string) {
    super(node, `Interface '${interfaceName}' does not declare state variable or collection '${varName}'`);
  }
}

export class ExternalReadArgCountError extends SolidCashError {
  constructor(node: Node, interfaceName: string, got: number) {
    super(node, `Interface instantiation '${interfaceName}(...)' expects 1 or 2 arguments (category[, lbc]), got ${got}`);
  }
}

export class UndefinedInterfaceFunctionError extends SolidCashError {
  constructor(node: Node, interfaceName: string, functionName: string) {
    super(node, `Interface '${interfaceName}' does not declare function '${functionName}'`);
  }
}

export class MethodCallNotSupportedError extends SolidCashError {
  constructor(node: Node) {
    super(node, 'Method calls are only supported on interface or contract instances (e.g. ICounter(category).functionName())');
  }
}

export class UsingForUndefinedLibraryError extends SolidCashError {
  constructor(node: Node, libraryName: string) {
    super(node, `Library '${libraryName}' referenced in 'using for' directive is not defined or imported`);
  }
}

export class UsingForUndefinedFunctionError extends SolidCashError {
  constructor(node: Node, functionName: string) {
    super(node, `Function '${functionName}' referenced in 'using for' directive is not defined or imported`);
  }
}

export class OperatorOverloadNonUDVTError extends SolidCashError {
  constructor(node: Node, operator: string, typeName: string) {
    super(node, `Operator '${operator}' overloading is only allowed on user-defined value types, but '${typeName}' is not a UDVT`);
  }
}

export class OperatorOverloadSignatureError extends SolidCashError {
  constructor(node: Node, funcName: string, reason: string) {
    super(node, `Invalid operator overload function '${funcName}': ${reason}`);
  }
}

export class ImmutableStateVariableAssignmentError extends SolidCashError {
  constructor(node: Node, name: string) {
    super(node, `Cannot assign to immutable state variable '${name}' outside of constructor`);
  }
}

export class UnknownContractTypeError extends SolidCashError {
  constructor(node: Node, typeName: string) {
    super(node, `Unknown contract or interface type '${typeName}'`);
  }
}

export class ExternalAccessOnUnconnectedError extends SolidCashError {
  constructor(node: Node, interfaceName: string, memberName: string) {
    super(node, `Cannot access '${memberName}' on unconnected '${interfaceName}(0x, lbc)' - provide a category`);
  }
}

export class ContractTypeConstructorArgCountError extends SolidCashError {
  constructor(node: Node, typeName: string) {
    super(node, `Contract type constructor '${typeName}()' expects 1 or 2 arguments (locking bytecode[, address])`);
  }
}
