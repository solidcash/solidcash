import {
  PrimitiveType,
  explicitlyCastable,
  implicitlyCastable,
  implicitlyCastableSignature,
  arrayType,
  ArrayType,
  TupleType,
  BytesType,
  IntType,
  FixedType,
  Type,
  StructType,
  EnumType,
  ValueType,
  TokenContainerType,
  AddressType,
  FunctionType,
  MappingType,
  Op,
} from '@solidcash/utils';
import {
  AssignNode,
  AssignmentExpressionNode,
  BranchNode,
  CastNode,
  FunctionCallNode,
  UnaryOpNode,
  BinaryOpNode,
  IdentifierNode,
  TimeOpNode,
  ExpressionNode,
  VariableDefinitionNode,
  ArrayNode,
  TupleIndexOpNode,
  RequireNode,
  Node,
  InstantiationNode,
  TupleAssignmentNode,
  NullaryOpNode,
  SliceNode,
  IntLiteralNode,
  HexLiteralNode,
  DecimalLiteralNode,
  DoWhileNode,
  WhileNode,
  AssemblyStatementNode,
  StateVariableNode,
  StateAccessNode,
  StateAssignNode,
  ContractNode,
  FunctionDefinitionNode,
  CollectionNode,
  MappingAccessNode,
  MappingAssignNode,
  MappingFieldAssignNode,
  DeleteLocalNode,
  DeleteStateNode,
  MappingDeleteNode,
  AbiEncodeNode,
  AbiEncodePackedNode,
  AbiEncodeWithSelectorNode,
  AbiEncodeWithSignatureNode,
  AbiEncodeCallNode,
  BytesConcatNode,
  StringConcatNode,
  AbiDecodeNode,
  AbiDecodeAtNode,
  FieldAccessNode,
  StructDefinitionNode,
  EventDefinitionNode,
  EmitStatementNode,
  TransferStatementNode,
  TokenContainerMethodStatementNode,
  BlockNode,
  StatementNode,
  ParameterNode,
  ReturnNode,
  FunctionCallStatementNode,
  MethodCallStatementNode,
  ConstantDefinitionNode,
  SourceFileNode,
  TernaryOpNode,
  ArrayAccessNode,
  NewArrayNode,
  ArrayPushNode,
  ArrayPopNode,
  ArrayAssignNode,
  ArrayDeleteNode,
  ContractReferenceNode,
  RevertNode,
  AssertNode,
  AddressTransferStatementNode,
  AddressSendExpressionNode,
  LowLevelCallNode,
  LowLevelCallStatementNode,
  ExternalFunctionCallNode,
  CollectionIterationNode,
  CollectionIterationMode,
  TypeIntrospectionNode,
  SwitchNode,
  StateArrayPushNode,
  StateArrayPopNode,
  StateArrayAssignNode,
  StateArrayDeleteNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import {
  InvalidParameterTypeError,
  UnequalTypeError,
  SignedExponentError,
  UnsupportedTypeError,
  CastTypeError,
  TypeError,
  AssignTypeError,
  ArrayElementError,
  IndexOutOfBoundsError,
  TupleAssignmentError,
  BitshiftBitcountNegativeError,
  UnsupportedStateTypeError,
  StateAssignTypeError,
  AbiEncodeEmptyError,
  AbiDecodeIndexError,
  UnsupportedMappingKeyTypeError,
  UnsupportedMappingValueTypeError,
  MappingAssignTypeError,
  UnsupportedArrayElementTypeError,
  InvalidArrayBoundError,
  UndefinedStructFieldError,
  UndefinedEnumMemberError,
  UnsupportedStructFieldTypeError,
  EmitArgumentCountError,
  EmitArgumentTypeError,
  UnsupportedEventParamTypeError,
  UndefinedEventError,
  TransferArgumentTypeError,
  TokenContainerKeyTypeError,
  TokenContainerMethodArgumentError,
  UndefinedTokenContainerFieldError,
  ReturnTypeMismatchError,
  TernaryTypeMismatchError,
  InvalidAssemblyError,
  NoMatchingOverloadError,
  AmbiguousOverloadError,
  InternalCallToExternalError,
  ContractConstructorArgTypeError,
  RevertArgumentCountError,
  RevertArgumentTypeError,
  PackedArrayUnsupportedTypeError,
} from '../Errors.js';
import { BinaryOperator, NullaryOperator, UnaryOperator } from '../ast/Operator.js';
import { Symbol } from '../ast/SymbolTable.js';
import { GlobalFunction, Modifier } from '../ast/Globals.js';
import { isNumericType, resultingTypeForBinaryOp } from '../utils.js';
import { getStackEffect } from '../asmStackEffects.js';

export default class TypeCheckTraversal extends AstTraversal {
  private currentFunction: FunctionDefinitionNode;
  private functionDefinitions: Map<string, FunctionDefinitionNode[]> = new Map();

  constructor(private solidityImportCompat: boolean = false) {
    super();
  }

  visitSourceFile(node: SourceFileNode): Node {
    node.constantDefinitions.forEach((cd) => this.visitConstantDefinition(cd));

    // Build function definitions map from free functions
    for (const func of node.freeFunctions) {
      const existing = this.functionDefinitions.get(func.name) ?? [];
      existing.push(func);
      this.functionDefinitions.set(func.name, existing);
    }

    for (const func of node.freeFunctions) {
      this.visitFunctionDefinition(func);
    }
    node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    node.parameters = this.visitList(node.parameters) as any[];
    node.structDefinitions.forEach((sd) => this.visitStructDefinition(sd));
    node.eventDefinitions.forEach((ev) => this.visitEventDefinition(ev));
    node.constantDefinitions.forEach((cd) => this.visitConstantDefinition(cd));
    node.stateVariables.forEach((sv) => this.visitStateVariable(sv));
    node.collections.forEach((coll) => this.visitCollection(coll));

    // Build function definitions map from contract functions
    for (const func of node.functions) {
      const existing = this.functionDefinitions.get(func.name) ?? [];
      existing.push(func);
      this.functionDefinitions.set(func.name, existing);
    }

    if (node.constructorDef) {
      node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    }
    node.functions = this.visitList(node.functions) as any[];
    if (node.fallbackDef) {
      // Validate: at most 1 user-facing parameter of type 'bytes' (unbounded)
      // Synthetic parameters (prefixed with _) injected by SymbolTableTraversal are excluded
      const userParams = node.fallbackDef.parameters.filter((p) => !p.name.startsWith('__internal__'));
      if (userParams.length > 1) {
        throw new TypeError(node.fallbackDef, [], [],
          "Fallback function can have at most one parameter of type 'bytes'");
      }
      if (userParams.length === 1) {
        const param = userParams[0];
        if (!(param.type instanceof BytesType) || param.type.bound !== undefined) {
          throw new TypeError(node.fallbackDef, [param.type], [new BytesType()],
            "Fallback function parameter must be of type 'bytes'");
        }
      }
      node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    }
    if (node.receiveDef) {
      node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    }
    return node;
  }

  visitConstantDefinition(node: ConstantDefinitionNode): Node {
    node.expression = this.visit(node.expression);
    node.expression = this.maybeCoerceHexToInt(node.expression, node.type);
    node.expression = this.maybeCoerceZeroToBytes(node.expression, node.type);
    expectAssignable(
      new VariableDefinitionNode(node.type, [], node.name, node.expression),
      node.expression.type,
      node.type,
    );
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    // Abstract functions have no body - skip type checking
    if (node.isAbstract) return node;

    this.currentFunction = node;
    node.parameters = this.visitList(node.parameters) as ParameterNode[];
    node.body = this.visit(node.body) as BlockNode;

    // Patch emitInfos signatures that were deferred during SymbolTableTraversal
    if (node.emitInfos) {
      this.patchEmitSignatures(node.body, node.emitInfos);
    }

    return node;
  }

  private patchEmitSignatures(node: Node, emitInfos: { eventSignature: string; emitIndex: number }[]): void {
    if (node instanceof EmitStatementNode && node.eventDefinition) {
      const info = emitInfos.find((ei) => ei.emitIndex === node.emitIndex);
      if (info && !info.eventSignature) {
        info.eventSignature = node.eventDefinition.signature;
      }
    }
    if ('statements' in node && Array.isArray((node as any).statements)) {
      for (const stmt of (node as any).statements) {
        this.patchEmitSignatures(stmt, emitInfos);
      }
    }
    if ('body' in node && (node as any).body) {
      this.patchEmitSignatures((node as any).body, emitInfos);
    }
    if ('block' in node && (node as any).block) {
      this.patchEmitSignatures((node as any).block, emitInfos);
    }
  }

  visitEventDefinition(node: EventDefinitionNode): Node {
    for (const param of node.parameters) {
      if (!isValidEventParamType(param.type)) {
        throw new UnsupportedEventParamTypeError(node, param.type);
      }
    }
    return node;
  }

  visitEmitStatement(node: EmitStatementNode): Node {
    node.args = this.visitList(node.args);

    // Resolve overloaded events by matching argument types
    if (node.eventCandidates && node.eventCandidates.length > 1) {
      const match = node.eventCandidates.find((candidate) => (
        candidate.parameters.length === node.args.length
        && candidate.parameters.every((param, i) => {
          const argType = node.args[i].type;
          return argType !== undefined && implicitlyCastable(argType, param.type);
        })
      ));
      if (!match) {
        throw new UndefinedEventError(node);
      }
      node.eventDefinition = match;
      node.eventCandidates = undefined;
    }

    if (node.eventDefinition) {
      const eventDef = node.eventDefinition;
      if (node.args.length !== eventDef.parameters.length) {
        throw new EmitArgumentCountError(node, eventDef.parameters.length, node.args.length);
      }
      for (let i = 0; i < node.args.length; i++) {
        const paramType = eventDef.parameters[i].type;
        node.args[i] = this.maybeCoerceZeroToBytes(node.args[i], paramType);
        const argType = node.args[i].type;
        if (argType && !implicitlyCastable(argType, paramType)) {
          throw new EmitArgumentTypeError(node, eventDef.parameters[i].name, argType, paramType);
        }
      }
    }
    return node;
  }

  visitTokenContainerMethodStatement(node: TokenContainerMethodStatementNode): Node {
    node.tokenContainerKeyExpression = this.visit(node.tokenContainerKeyExpression);
    node.args = this.visitList(node.args);

    // Validate key type is bytes32
    const keyType = node.tokenContainerKeyExpression.type;
    if (keyType && !(keyType instanceof BytesType && keyType.bound === 32)) {
      throw new TokenContainerKeyTypeError(node, keyType);
    }

    if (node.methodName === 'transfer') {
      // transfer(to, amount): to -> bytes, amount -> int
      const toType = node.args[0]?.type;
      if (toType && !implicitlyCastable(toType, new BytesType())) {
        throw new TokenContainerMethodArgumentError(node, 'to', toType, new BytesType());
      }
      const amountType = node.args[1]?.type;
      if (amountType && !implicitlyCastable(amountType, PrimitiveType.BIGINT)) {
        throw new TokenContainerMethodArgumentError(node, 'amount', amountType, PrimitiveType.BIGINT);
      }
    } else if (node.methodName === 'transferNft') {
      // transferNft(to, commitment, capability): to -> bytes, commitment -> bytes, capability -> int
      const toType = node.args[0]?.type;
      if (toType && !implicitlyCastable(toType, new BytesType())) {
        throw new TokenContainerMethodArgumentError(node, 'to', toType, new BytesType());
      }
      const commitmentType = node.args[1]?.type;
      if (commitmentType && !implicitlyCastable(commitmentType, new BytesType())) {
        throw new TokenContainerMethodArgumentError(node, 'commitment', commitmentType, new BytesType());
      }
      const capabilityType = node.args[2]?.type;
      if (capabilityType && !implicitlyCastable(capabilityType, PrimitiveType.BIGINT)) {
        throw new TokenContainerMethodArgumentError(node, 'capability', capabilityType, PrimitiveType.BIGINT);
      }
    }

    return node;
  }

  visitTransferStatement(node: TransferStatementNode): Node {
    node.lockingBytecode = this.visit(node.lockingBytecode);
    node.amount = this.visit(node.amount);

    if (node.lockingBytecode.type && !implicitlyCastable(node.lockingBytecode.type, new BytesType())) {
      throw new TransferArgumentTypeError(node, 'lockingBytecode', node.lockingBytecode.type, new BytesType());
    }
    if (node.amount.type && !implicitlyCastable(node.amount.type, PrimitiveType.BIGINT)) {
      throw new TransferArgumentTypeError(node, 'amount', node.amount.type, PrimitiveType.BIGINT);
    }

    return node;
  }

  visitAddressTransferStatement(node: AddressTransferStatementNode): Node {
    node.addressExpression = this.visit(node.addressExpression);
    node.amount = this.visit(node.amount);

    const addrType = node.addressExpression.type;
    if (!(addrType instanceof AddressType && addrType.payable)) {
      throw new TransferArgumentTypeError(
        node, 'address', addrType!, new AddressType(true),
      );
    }
    if (node.amount.type && !implicitlyCastable(node.amount.type, PrimitiveType.BIGINT)) {
      throw new TransferArgumentTypeError(node, 'amount', node.amount.type, PrimitiveType.BIGINT);
    }
    return node;
  }

  visitAddressSendExpression(node: AddressSendExpressionNode): Node {
    node.addressExpression = this.visit(node.addressExpression);
    node.amount = this.visit(node.amount);

    const addrType = node.addressExpression.type;
    if (!(addrType instanceof AddressType && addrType.payable)) {
      throw new TransferArgumentTypeError(
        node, 'address', addrType!, new AddressType(true),
      );
    }
    if (node.amount.type && !implicitlyCastable(node.amount.type, PrimitiveType.BIGINT)) {
      throw new TransferArgumentTypeError(node, 'amount', node.amount.type, PrimitiveType.BIGINT);
    }
    node.type = PrimitiveType.BOOL;
    return node;
  }

  visitLowLevelCall(node: LowLevelCallNode): Node {
    // Don't type-check targetExpression - it may be an unresolved interface/contract ref
    node.data = this.visit(node.data);
    if (node.data.type && !implicitlyCastable(node.data.type, new BytesType())) {
      throw new TypeError(node, node.data.type, new BytesType());
    }
    if (node.callOptions?.value) {
      node.callOptions.value = this.visit(node.callOptions.value);
      if (node.callOptions.value.type && !implicitlyCastable(node.callOptions.value.type, PrimitiveType.BIGINT)) {
        throw new TypeError(node, node.callOptions.value.type, PrimitiveType.BIGINT);
      }
    }
    if (node.callOptions?.gas) {
      node.callOptions.gas = this.visit(node.callOptions.gas);
    }
    return node;
  }

  visitLowLevelCallStatement(node: LowLevelCallStatementNode): Node {
    // Don't type-check targetExpression
    node.data = this.visit(node.data);
    if (node.data.type && !implicitlyCastable(node.data.type, new BytesType())) {
      throw new TypeError(node, node.data.type, new BytesType());
    }
    if (node.callOptions?.value) {
      node.callOptions.value = this.visit(node.callOptions.value);
      if (node.callOptions.value.type && !implicitlyCastable(node.callOptions.value.type, PrimitiveType.BIGINT)) {
        throw new TypeError(node, node.callOptions.value.type, PrimitiveType.BIGINT);
      }
    }
    if (node.callOptions?.gas) {
      node.callOptions.gas = this.visit(node.callOptions.gas);
    }
    return node;
  }

  visitExternalFunctionCall(node: ExternalFunctionCallNode): Node {
    node.addressExpression = this.visit(node.addressExpression);
    node.parameters = this.visitList(node.parameters);
    if (node.callOptions?.value) {
      node.callOptions.value = this.visit(node.callOptions.value);
      if (node.callOptions.value.type && !implicitlyCastable(node.callOptions.value.type, PrimitiveType.BIGINT)) {
        throw new TypeError(node, node.callOptions.value.type, PrimitiveType.BIGINT);
      }
    }
    if (node.callOptions?.gas) {
      node.callOptions.gas = this.visit(node.callOptions.gas);
    }
    return node;
  }

  visitCollection(node: CollectionNode): Node {
    if (node.type instanceof ArrayType) {
      // Validate element type is a valid state type
      if (node.type.elementType instanceof StructType) {
        // Validate each field of the struct
        for (const field of node.type.elementType.fields) {
          if (!isValidStateType(field.type)) {
            throw new UnsupportedStructFieldTypeError(node, field.type);
          }
        }
      } else if (!isValidStateType(node.type.elementType)) {
        throw new UnsupportedArrayElementTypeError(node, node.type.elementType);
      }
      // Validate bound is positive if static
      if (node.type.bound !== undefined && node.type.bound <= 0) {
        throw new InvalidArrayBoundError(node);
      }
    } else {
      // Validate ALL key types in nested mappings
      for (const keyType of node.allKeyTypes) {
        if (!isValidMappingKeyType(keyType)) {
          throw new UnsupportedMappingKeyTypeError(node, keyType);
        }
      }
      // Allow StructType as value type; validate each field individually
      const innerValue = node.innermostValueType;
      if (innerValue instanceof StructType) {
        for (const field of innerValue.fields) {
          if (!isValidStateType(field.type)) {
            throw new UnsupportedStructFieldTypeError(node, field.type);
          }
        }
      } else if (!isValidStateType(innerValue)) {
        throw new UnsupportedMappingValueTypeError(node, innerValue);
      }
    }
    return node;
  }

  visitMappingAccess(node: MappingAccessNode): Node {
    node.keys = this.visitList(node.keys);

    // Handle packed state array access: this.scores[index]
    if (node.isPackedStateArrayAccess && node.packedStateVariable) {
      const keyType = node.keys[0]?.type;
      if (keyType) {
        expectInt(node as any, keyType);
      }
      // Type already set by SymbolTableTraversal
      return node;
    }

    // Handle token container access: this.tokens[category]
    if (node.isTokenContainerAccess) {
      // Validate key type is bytes32
      const keyType = node.keys[0]?.type;
      if (keyType && !(keyType instanceof BytesType && keyType.bound === 32)) {
        throw new TokenContainerKeyTypeError(node, keyType);
      }
      node.type = new TokenContainerType();
      return node;
    }

    if (node.collection) {
      const allKeyTypes = node.collection.allKeyTypes;
      // Each key must type-check against its corresponding level
      for (let i = 0; i < node.keys.length; i++) {
        if (node.keys[i].type && !implicitlyCastable(node.keys[i].type, allKeyTypes[i])) {
          throw new TypeError(node, node.keys[i].type, allKeyTypes[i]);
        }
      }
      if (node.arrayIndex) {
        // Array element access: validate index is int, result type is element type
        node.arrayIndex = this.visit(node.arrayIndex);
        if (node.arrayIndex.type && !implicitlyCastable(node.arrayIndex.type, PrimitiveType.BIGINT)) {
          throw new TypeError(node, node.arrayIndex.type, PrimitiveType.BIGINT);
        }
        const arrType = node.collection.innermostValueType as ArrayType;
        node.type = arrType.elementType;
      } else {
        node.type = node.collection.innermostValueType;
      }
    }
    return node;
  }

  visitMappingAssign(node: MappingAssignNode): Node {
    node.keys = this.visitList(node.keys);
    if (node.arrayIndex) {
      node.arrayIndex = this.visit(node.arrayIndex);
    }
    node.expression = this.visit(node.expression);
    if (node.collection) {
      const expectedValueType = node.arrayIndex
        ? (node.collection.innermostValueType as ArrayType).elementType
        : node.collection.innermostValueType;
      node.expression = this.maybeCoerceHexToInt(node.expression, expectedValueType);
      node.expression = this.maybeCoerceZeroToBytes(node.expression, expectedValueType);
      const allKeyTypes = node.collection.allKeyTypes;
      for (let i = 0; i < node.keys.length; i++) {
        if (node.keys[i].type && !implicitlyCastable(node.keys[i].type, allKeyTypes[i])) {
          throw new TypeError(node, node.keys[i].type, allKeyTypes[i]);
        }
      }
      if (node.arrayIndex) {
        // Array element assign: validate index is int, expression matches element type
        if (node.arrayIndex.type && !implicitlyCastable(node.arrayIndex.type, PrimitiveType.BIGINT)) {
          throw new TypeError(node, node.arrayIndex.type, PrimitiveType.BIGINT);
        }
        const arrType = node.collection.innermostValueType as ArrayType;
        if (node.expression.type && !implicitlyCastable(node.expression.type, arrType.elementType)) {
          throw new MappingAssignTypeError(node, node.expression.type, arrType.elementType);
        }
      } else {
        if (node.expression.type && !implicitlyCastable(node.expression.type, node.collection.innermostValueType)) {
          throw new MappingAssignTypeError(node, node.expression.type, node.collection.innermostValueType);
        }
      }
    }
    return node;
  }

  visitMappingFieldAssign(node: MappingFieldAssignNode): Node {
    node.keys = this.visitList(node.keys);
    node.expression = this.visit(node.expression);
    if (node.collection) {
      const allKeyTypes = node.collection.allKeyTypes;
      for (let i = 0; i < node.keys.length; i++) {
        if (node.keys[i].type && !implicitlyCastable(node.keys[i].type, allKeyTypes[i])) {
          throw new TypeError(node, node.keys[i].type, allKeyTypes[i]);
        }
      }
      const valueType = node.collection.innermostValueType;
      if (!(valueType instanceof StructType)) {
        throw new MappingAssignTypeError(node as unknown as MappingAssignNode,
          node.expression.type, valueType);
      }
      const field = valueType.fields.find((f) => f.name === node.fieldName);
      if (!field) {
        throw new TypeError(node, node.expression.type, valueType);
      }
      if (node.expression.type && !implicitlyCastable(node.expression.type, field.type)) {
        throw new TypeError(node, node.expression.type, field.type);
      }
    }
    return node;
  }

  visitMappingDelete(node: MappingDeleteNode): Node {
    node.keys = this.visitList(node.keys);
    if (node.collection) {
      const allKeyTypes = node.collection.allKeyTypes;
      for (let i = 0; i < node.keys.length; i++) {
        if (node.keys[i].type && !implicitlyCastable(node.keys[i].type, allKeyTypes[i])) {
          throw new TypeError(node, node.keys[i].type, allKeyTypes[i]);
        }
      }
    }
    return node;
  }

  visitStructDefinition(node: StructDefinitionNode): Node {
    for (const field of node.fields) {
      // A mapping field is permitted: a mapping-bearing struct is flattened to per-field state when used as a
      // state variable (it has no value form, so it cannot be a local/param).
      if (field.type instanceof MappingType) continue;
      if (!isValidStateType(field.type)) {
        throw new UnsupportedStructFieldTypeError(node, field.type);
      }
    }
    return node;
  }

  visitFieldAccess(node: FieldAccessNode): Node {
    node.expression = this.visit(node.expression);

    // Handle token container field access: this.tokens[cat].tokenAmount etc.
    if (node.expression instanceof MappingAccessNode && node.expression.isTokenContainerAccess) {
      // outState token container accesses only support aggregate fields
      if (node.expression.isOutStateTokenContainerAccess) {
        const validOutStateFields: Record<string, Type> = {
          tokenAmount: PrimitiveType.BIGINT,
          nftCount: PrimitiveType.BIGINT,
        };
        const fieldType = validOutStateFields[node.name];
        if (!fieldType) {
          throw new UndefinedTokenContainerFieldError(node, node.name);
        }
        node.type = fieldType;
        return node;
      }

      const validFields: Record<string, Type> = {
        tokenAmount: PrimitiveType.BIGINT,
        tokenCategory: new BytesType(),
        nftCommitment: new BytesType(),
        nftCount: PrimitiveType.BIGINT,
      };
      const fieldType = validFields[node.name];
      if (!fieldType) {
        throw new UndefinedTokenContainerFieldError(node, node.name);
      }
      node.type = fieldType;
      return node;
    }

    const exprType = node.expression.type;

    // Handle .balance on address/connected address types
    if ((exprType instanceof AddressType)
        && node.name === 'balance') {
      node.type = PrimitiveType.BIGINT;
      return node;
    }

    // Handle .codehash on address types -> bytes (20 or 32 depending on P2SH type, checked at runtime)
    if ((exprType instanceof AddressType)
        && node.name === 'codehash') {
      node.type = new BytesType();
      return node;
    }

    // Handle .code on address types -> bytes (the redeem script)
    if ((exprType instanceof AddressType)
        && node.name === 'code') {
      node.type = new BytesType();
      return node;
    }

    // Handle enum member access: Color.Red
    if (exprType instanceof EnumType) {
      const member = exprType.members.find((m) => m.name === node.name);
      if (!member) {
        throw new UndefinedEnumMemberError(node, exprType);
      }
      node.type = PrimitiveType.BIGINT;
      node.enumType = exprType;
      return node;
    }

    if (!(exprType instanceof StructType)) {
      throw new UndefinedStructFieldError(node, new StructType('(non-struct)', []));
    }

    const field = exprType.fields.find((f) => f.name === node.name);
    if (!field) {
      throw new UndefinedStructFieldError(node, exprType);
    }

    node.type = field.type;
    node.structType = exprType;
    return node;
  }

  visitTypeIntrospection(node: TypeIntrospectionNode): Node {
    if (node.property === 'min' || node.property === 'max') {
      if (node.resolvedType instanceof IntType) {
        node.type = node.resolvedType;
      } else if (node.resolvedType instanceof FixedType) {
        node.type = node.resolvedType;
      } else if (node.resolvedType instanceof EnumType) {
        node.type = PrimitiveType.BIGINT;
      }
    } else if (node.property === 'interfaceId') {
      node.type = new BytesType(4);
    } else if (node.property === 'name') {
      node.type = PrimitiveType.STRING;
    } else if (node.property === 'creationCode' || node.property === 'runtimeCode') {
      node.type = new BytesType();
    }
    return node;
  }

  visitStateVariable(node: StateVariableNode): Node {
    // Packed state arrays are allowed (stored as blob in data NFT)
    if (node.isPacked && node.type instanceof ArrayType) {
      return node;
    }
    // Chunk-packed fixed-width arrays (phase-2 scaffold): a dense dynamic array stored across chunk UTXOs.
    if (node.isDynamic && node.type instanceof ArrayType) {
      return node;
    }
    if (!(node.type instanceof StructType) && !isValidStateType(node.type)) {
      throw new UnsupportedStateTypeError(node);
    }
    // Unbounded arrays cannot be scalar state variables (bin-packing requires fixed max size)
    if (node.type instanceof ArrayType && node.type.bound === undefined) {
      throw new UnsupportedStateTypeError(node);
    }
    return node;
  }

  visitStateAccess(node: StateAccessNode): Node {
    // this.balance - special built-in (when no state variable named 'balance'), returns int
    if (node.name === 'balance' && !node.stateVariable) {
      node.type = PrimitiveType.BIGINT;
      return node;
    }
    // this.outState - special built-in (used as this.outState.balance)
    // Typed as AddressType so .balance is valid on it via visitFieldAccess
    if (node.name === 'outState' && !node.stateVariable) {
      node.type = new AddressType(false);
      return node;
    }
    if (node.stateVariable) {
      node.type = node.stateVariable.type;
    }
    return node;
  }

  visitStateAssign(node: StateAssignNode): Node {
    // Propagate FixedType to decimal literals before visiting
    if (node.stateVariable?.type instanceof FixedType && node.expression instanceof DecimalLiteralNode) {
      node.expression.type = node.stateVariable.type;
    }
    // Chunk-packed array write: encode an array literal RHS as a blob (pushdata(count) ++ tight_elements)
    // so the codegen can strip the count prefix and store only the tight blob in chunks. See docs/arrays.md.
    if (node.stateVariable?.isDynamic && node.stateVariable.type instanceof ArrayType
      && node.expression instanceof ArrayNode) {
      node.expression.blobEncoded = true;
      if (node.expression.elements.length === 0) {
        node.expression.type = node.stateVariable.type;
      }
    }
    node.expression = this.visit(node.expression);
    node.expression = this.maybeCoerceHexToInt(node.expression, node.stateVariable?.type);
    node.expression = this.maybeCoerceZeroToBytes(node.expression, node.stateVariable?.type);
    if (node.stateVariable && node.expression.type) {
      if (!implicitlyCastable(node.expression.type, node.stateVariable.type)) {
        throw new StateAssignTypeError(node, node.expression.type, node.stateVariable.type);
      }
    }
    return node;
  }

  visitVariableDefinition(node: VariableDefinitionNode): Node {
    // For array type variables with an array literal, set blobEncoded before visiting
    // so that visitArray can handle empty arrays correctly
    if (node.type instanceof ArrayType && node.expression instanceof ArrayNode) {
      node.expression.blobEncoded = true;
      if (node.expression.elements.length === 0) {
        node.expression.type = node.type;
      }
    }
    // Propagate FixedType to decimal literals before visiting
    if (node.type instanceof FixedType && node.expression instanceof DecimalLiteralNode) {
      node.expression.type = node.type;
    }
    // Uninitialized declaration (`int x;`): no initializer to type-check; codegen emits the zero value.
    if (node.expression) {
      node.expression = this.visit(node.expression);
      node.expression = this.maybeCoerceHexToInt(node.expression, node.type);
      node.expression = this.maybeCoerceZeroToBytes(node.expression, node.type);
      expectAssignable(node, node.expression.type, node.type);
    }

    // Coerce an array literal to the declared array type so codegen packs at the declared element width
    // (e.g. int256), not the literals' inferred variable-width INT. Else `int[] a = [1,2,3]` is built
    // variable-width but a[i] reads fixed-width. Empty arrays handled above (before visiting).
    if (node.type instanceof ArrayType && node.expression instanceof ArrayNode && node.expression.elements.length > 0) {
      node.expression.type = node.type;
    }

    // Validate 'packed' modifier: only valid for arrays with fixed-width element types.
    // For fixed-width types, packed encoding is already automatic - the modifier is documentation only.
    if (node.type instanceof ArrayType && node.modifier.includes(Modifier.PACKED)) {
      const elemType = node.type.elementType;
      if (!this.isPackableType(elemType)) {
        throw new PackedArrayUnsupportedTypeError(node, elemType);
      }
    }

    return node;
  }

  // Check if a type is fixed-width and therefore suitable for packed array encoding.
  private isPackableType(type: Type): boolean {
    if (type === PrimitiveType.BOOL) return true;
    if (type === PrimitiveType.PUBKEY) return true;
    if (type instanceof BytesType && type.bound !== undefined) return true;
    if (type instanceof IntType) return true;
    if (type instanceof FixedType) return true;
    if (type instanceof StructType) {
      return type.fields.every((f) => this.isPackableType(f.type));
    }
    return false;
  }

  visitTupleAssignment(node: TupleAssignmentNode): Node {
    if (node.tupleExpressions) {
      // `(x, y) = (a, b)`: each RHS expression maps to one slot; the combined type is their tuple.
      node.tupleExpressions = node.tupleExpressions.map((e) => this.visit(e));
      const rhsTuple = new TupleType(node.tupleExpressions.map((e) => e.type!));
      const elementTypes = node.elements.map((e, i) => (e.skip ? rhsTuple.elements[i] : e.type!));
      const assignmentType = new TupleType(elementTypes);
      if (!implicitlyCastable(rhsTuple, assignmentType)) {
        const firstNamed = node.elements.find((e) => !e.skip);
        const synthetic = new VariableDefinitionNode(assignmentType, [], firstNamed?.name ?? '_', node.tupleExpressions[0]);
        synthetic.location = node.location;
        throw new AssignTypeError(synthetic);
      }
      return node;
    }

    node.tuple = this.visit(node.tuple);

    const rhsType = node.tuple.type;
    // Skipped slots accept whatever the RHS provides at that position (the value is dropped).
    const elementTypes: Type[] = node.elements.map((e, i) => {
      if (e.skip) return rhsType instanceof TupleType ? rhsType.elements[i] : PrimitiveType.ANY;
      return e.type!;
    });
    const assignmentType = new TupleType(elementTypes);

    // For 2-element tuples, the expression must be a split operation or abi.decode
    // For N-element tuples (N > 2), the expression must produce a matching TupleType
    if (node.elements.length === 2) {
      if (!(rhsType instanceof TupleType)) {
        throw new TupleAssignmentError(node.tuple);
      }
    }

    if (!implicitlyCastable(rhsType, assignmentType)) {
      const firstNamed = node.elements.find((e) => !e.skip);
      const syntheticAssignment = new VariableDefinitionNode(assignmentType, [], firstNamed?.name ?? '_', node.tuple);
      syntheticAssignment.location = node.location;
      throw new AssignTypeError(syntheticAssignment);
    }
    return node;
  }

  visitAssign(node: AssignNode): Node {
    node.identifier = this.visit(node.identifier) as IdentifierNode;
    // Propagate FixedType to decimal literals before visiting
    if (node.identifier.type instanceof FixedType && node.expression instanceof DecimalLiteralNode) {
      node.expression.type = node.identifier.type;
    }
    node.expression = this.visit(node.expression);
    node.expression = this.maybeCoerceHexToInt(node.expression, node.identifier.type);
    node.expression = this.maybeCoerceZeroToBytes(node.expression, node.identifier.type);
    expectAssignable(node, node.expression.type, node.identifier.type);
    return node;
  }

  // `(x op= rhs)` as an expression yields x's (new) value, so its type is x's type.
  visitAssignmentExpression(node: AssignmentExpressionNode): Node {
    node.assign = this.visit(node.assign) as AssignNode;
    node.type = node.assign.identifier.type;
    return node;
  }

  visitDeleteLocal(node: DeleteLocalNode): Node {
    node.identifier = this.visit(node.identifier) as IdentifierNode;
    return node;
  }

  visitDeleteState(node: DeleteStateNode): Node {
    return node;
  }

  visitTimeOp(node: TimeOpNode): Node {
    node.expression = this.visit(node.expression);
    expectInt(node, node.expression.type);
    return node;
  }

  visitBlock(node: BlockNode): Node {
    // Visits statements sequentially so bytes types narrowed by require(x.length == N) checks
    // apply to the following statements. Mutates statements in place.
    this.visitStatementsRecursively(node.statements ?? []);
    return node;
  }

  // Remaining statements are visited inside executeWithNarrowedTypes so the narrowed types are
  // automatically restored when the recursion unwinds.
  private visitStatementsRecursively(statements: StatementNode[], index: number = 0): void {
    if (index >= statements.length) return;

    statements[index] = this.visit(statements[index]) as StatementNode;

    if (statements[index] instanceof RequireNode) {
      const narrowings = extractBytesNarrowings((statements[index] as RequireNode).expression);
      executeWithNarrowedTypes(narrowings, () => this.visitStatementsRecursively(statements, index + 1));
    } else {
      this.visitStatementsRecursively(statements, index + 1);
    }
  }

  visitRequire(node: RequireNode): Node {
    node.expression = this.visit(node.expression);
    const parameters = node.expression.type ? [node.expression.type] : [];
    expectParameters(node, parameters, [PrimitiveType.BOOL]);

    // require(cond, CustomError(args)): type-check the error arguments like a revert.
    node.args = this.visitList(node.args);
    if (node.errorDefinition) {
      const errorDef = node.errorDefinition;
      if (node.args.length !== errorDef.parameters.length) {
        throw new RevertArgumentCountError(node, errorDef.parameters.length, node.args.length);
      }
      for (let i = 0; i < node.args.length; i++) {
        const argType = node.args[i].type;
        const paramType = errorDef.parameters[i].type;
        if (argType && !implicitlyCastable(argType, paramType)) {
          throw new RevertArgumentTypeError(node, errorDef.parameters[i].name, argType, paramType);
        }
      }
    }
    return node;
  }

  visitRevert(node: RevertNode): Node {
    node.args = this.visitList(node.args);

    if (node.errorDefinition) {
      const errorDef = node.errorDefinition;
      if (node.args.length !== errorDef.parameters.length) {
        throw new RevertArgumentCountError(node, errorDef.parameters.length, node.args.length);
      }
      for (let i = 0; i < node.args.length; i++) {
        const argType = node.args[i].type;
        const paramType = errorDef.parameters[i].type;
        if (argType && !implicitlyCastable(argType, paramType)) {
          throw new RevertArgumentTypeError(node, errorDef.parameters[i].name, argType, paramType);
        }
      }
    }
    return node;
  }

  visitAssert(node: AssertNode): Node {
    node.expression = this.visit(node.expression);
    if (node.expression.type && !implicitlyCastable(node.expression.type, PrimitiveType.BOOL)) {
      throw new TypeError(node, node.expression.type, PrimitiveType.BOOL);
    }
    return node;
  }

  visitBranch(node: BranchNode): Node {
    node.condition = this.visit(node.condition);

    // Branches are now allowed to contain restricted operations (validated by SymbolTableTraversal)
    // Narrow bytes types inside the if-block based on x.length == N checks in the condition
    const narrowings = extractBytesNarrowings(node.condition);
    executeWithNarrowedTypes(narrowings, () => { node.ifBlock = this.visit(node.ifBlock); });
    node.elseBlock = this.visitOptional(node.elseBlock);

    if (!implicitlyCastable(node.condition.type, PrimitiveType.BOOL)) {
      throw new TypeError(node, node.condition.type, PrimitiveType.BOOL);
    }

    return node;
  }

  visitSwitch(node: SwitchNode): Node {
    node.expression = this.visit(node.expression);

    for (const c of node.cases) {
      c.value = this.visit(c.value);
      if (!resultingTypeForBinaryOp(BinaryOperator.EQ, node.expression.type!, c.value.type!)) {
        throw new TypeError(c, c.value.type, node.expression.type,
          `Switch case type '${c.value.type}' is not comparable with switch expression type '${node.expression.type}'`);
      }
      c.body = this.visit(c.body);
    }

    if (node.defaultCase) {
      node.defaultCase = this.visit(node.defaultCase);
    }

    return node;
  }

  visitDoWhile(node: DoWhileNode): Node {
    node.condition = this.visit(node.condition);
    node.block = this.visit(node.block);

    if (!implicitlyCastable(node.condition.type, PrimitiveType.BOOL)) {
      throw new TypeError(node, node.condition.type, PrimitiveType.BOOL);
    }

    return node;
  }

  visitWhile(node: WhileNode): Node {
    node.condition = this.visit(node.condition);
    node.block = this.visit(node.block);

    if (!implicitlyCastable(node.condition.type, PrimitiveType.BOOL)) {
      throw new TypeError(node, node.condition.type, PrimitiveType.BOOL);
    }

    return node;
  }

  visitAssemblyStatement(node: AssemblyStatementNode): Node {
    if (node.assemblyBody.trim().length === 0) return node;

    // Opcodes that can corrupt the stack or alter script execution flow in ways
    // that bypass the compiler's stack tracking and require() enforcement.
    const dangerousOpcodes = new Set([
      'OP_RETURN', 'OP_CODESEPARATOR', 'OP_RESERVED', 'OP_RESERVED1', 'OP_RESERVED2',
      'OP_VER', 'OP_VERIF', 'OP_VERNOTIF',
    ]);

    const tokens = node.assemblyBody.split(/\s+/).filter((t) => t.length > 0);
    for (const token of tokens) {
      if (token.startsWith('OP_')) {
        const opcode = Op[token as keyof typeof Op];
        if (opcode === undefined) {
          throw new InvalidAssemblyError(node, `unknown opcode '${token}'`);
        }
        if (dangerousOpcodes.has(token)) {
          throw new InvalidAssemblyError(
            node,
            `opcode '${token}' is not allowed in assembly blocks as it can corrupt script execution`,
          );
        }
        if (getStackEffect(opcode as number) === undefined) {
          throw new InvalidAssemblyError(
            node,
            `opcode '${token}' cannot be used in an assembly block: its stack effect is not `
            + 'statically trackable (it is a control-flow, data-dependent, or disabled opcode)',
          );
        }
      } else if (/^(0[xX])?[0-9a-fA-F]*$/.test(token)) {
        // Valid hex data (with or without 0x prefix)
      } else {
        throw new InvalidAssemblyError(node, `invalid token '${token}'`);
      }
    }

    const loc = node.location ? ` at line ${node.location.start.line}` : '';
    console.log(`Warning: inline assembly used${loc}. Raw opcodes bypass type checking; you are responsible for the correctness of the emitted script.`);
    return node;
  }

  visitCast(node: CastNode): Node {
    node.expression = this.visit(node.expression);

    // For payable() cast, determine the correct target type based on source type
    if (node.type instanceof AddressType && node.type.payable) {
      const sourceType = node.expression.type;
      if (sourceType instanceof AddressType) {
        // payable(addr) -> AddressType(payable=true)
        node.type = new AddressType(true);
      }
      // Otherwise fall through to the generic check which will fail
    }

    if (!explicitlyCastable(node.expression.type, node.type)) {
      throw new CastTypeError(node);
    }

    // Solidity-compat `bytes20(address)` / `uint160(address)`: narrows the variable-length address to its
    // embedded 20-byte hash (see compileCast). Lossy, so warn once at the cast site.
    if (node.expression.type instanceof AddressType
      && ((node.type instanceof BytesType && node.type.bound === 20) || node.type instanceof IntType)) {
      const loc = node.location ? ` at line ${node.location.start.line}` : '';
      console.log(`Warning: ${node.type}(address)${loc} narrows a variable-length BCH address (a locking `
        + 'bytecode) to its embedded 20-byte hash; this is lossy and differs from a fixed-width EVM address.');
    }

    // The reverse: `address(bytes20)` / `address(uint160)`. A BCH address is a variable-length locking bytecode,
    // not a fixed 20-byte hash, so treating a 20-byte value AS an address is incorrect (the raw hash is not a valid
    // locking bytecode). Wrap it explicitly instead, e.g. `new LockingBytecodeP2PKH(hash)`. Unbounded `bytes` (a
    // full locking bytecode) is not warned. Warn once at the cast site.
    if (node.type instanceof AddressType && !(node.expression.type instanceof AddressType)
      && ((node.expression.type instanceof BytesType && node.expression.type.bound === 20)
        || node.expression.type instanceof IntType)) {
      const loc = node.location ? ` at line ${node.location.start.line}` : '';
      console.log(`Warning: address(${node.expression.type})${loc} treats a fixed 20-byte value as an address, but `
        + 'a BCH address is a variable-length locking bytecode, not a 20-byte hash; this does not yield a valid '
        + 'address (wrap the hash explicitly, e.g. new LockingBytecodeP2PKH(hash)).');
    }

    // Warn if integer literal exceeds target type's range
    if (node.expression instanceof IntLiteralNode) {
      const litValue = node.expression.value;
      if (node.type instanceof IntType) {
        if (litValue < node.type.minValue || litValue > node.type.maxValue) {
          const loc = node.location ? ` at line ${node.location.start.line}` : '';
          console.log(
            `Warning: integer literal ${litValue}${loc} exceeds `
            + `${node.type.toString()} range (${node.type.minValue} to ${node.type.maxValue}).`,
          );
        }
      } else if (node.type instanceof BytesType && node.type.bound !== undefined) {
        const maxVal = (1n << (BigInt(node.type.bound) * 8n)) - 1n;
        const absVal = litValue < 0n ? -litValue : litValue;
        if (absVal > maxVal) {
          const loc = node.location ? ` at line ${node.location.start.line}` : '';
          console.log(
            `Warning: integer literal ${litValue}${loc} exceeds `
            + `bytes${node.type.bound} range (max ${maxVal}).`,
          );
        }
      }
    }

    return node;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    node.identifier = this.visit(node.identifier) as IdentifierNode;
    node.parameters = this.visitList(node.parameters);

    // Solidity's ecrecover(hash, v, r, s) (4 args): accepted for porting but NOT emulated - BCH cannot recover a
    // public key. It always evaluates to the zero address (0x), so signature checks fail closed. Warn and point
    // to the 3-arg form. The 3-arg ecrecover(hash, sig, pubKey) falls through to normal resolution.
    if (node.identifier.name === GlobalFunction.ECRECOVER && node.parameters.length === 4) {
      const loc = node.location ? ` at line ${node.location.start.line}` : '';
      console.log(`Warning: ecrecover(hash, v, r, s)${loc} performs ECDSA public-key recovery, which Bitcoin `
        + 'Cash cannot do; it always returns the zero address (0x), so any check against it fails. Use '
        + 'ecrecover(hash, sig, pubKey) - verify a supplied public key. See docs/ecrecover.md.');
      node.type = new AddressType();
      return node;
    }

    // Indirect call through a function-typed value: check args against the signature, result is its returns.
    if (node.identifier.type instanceof FunctionType && !this.functionDefinitions.has(node.identifier.name)) {
      const ft = node.identifier.type;
      node.parameters = this.coerceHexArgs(node.parameters, ft.parameterTypes);
      expectParameters(node, node.parameters.map((p) => p.type!), ft.parameterTypes);
      node.type = ft.returnTypes.length === 1 ? ft.returnTypes[0]
        : ft.returnTypes.length > 1 ? new TupleType(ft.returnTypes) : PrimitiveType.VOID;
      return node;
    }

    // Handle overload resolution for user-defined functions
    const overloads = this.functionDefinitions.get(node.identifier.name);
    if (overloads && overloads.length > 1 && !node.resolvedFunction) {
      const argTypes = node.parameters.map((p) => p.type!);
      const matches = overloads.filter((f) => {
        const funcParamTypes = f.parameters.map((p) => p.type);
        return implicitlyCastableSignature(argTypes, funcParamTypes);
      });

      if (matches.length === 0) {
        throw new NoMatchingOverloadError(node);
      } else if (matches.length === 1) {
        node.resolvedFunction = matches[0];
      } else {
        // Try exact match (no implicit casting needed)
        const exactMatches = matches.filter((f) => {
          const funcParamTypes = f.parameters.map((p) => p.type);
          return argTypes.length === funcParamTypes.length
            && argTypes.every((argType, i) => argType?.toString() === funcParamTypes[i]?.toString());
        });
        if (exactMatches.length === 1) {
          node.resolvedFunction = exactMatches[0];
        } else {
          throw new AmbiguousOverloadError(node);
        }
      }

      // Check visibility of resolved overload
      if (node.resolvedFunction.visibility === 'external' && !node.resolvedFunction.isFreeFunction) {
        throw new InternalCallToExternalError(node);
      }

      // Set return type from resolved function
      const resolvedReturnType = node.resolvedFunction.returnTypes.length === 1
        ? node.resolvedFunction.returnTypes[0]
        : node.resolvedFunction.returnTypes.length > 1
          ? new TupleType(node.resolvedFunction.returnTypes)
          : PrimitiveType.VOID;
      node.type = resolvedReturnType;

      // Validate parameter types against the resolved overload
      this.forwardInternalReturnOutputIdx(node, node.resolvedFunction);
      const resolvedParamTypes = node.resolvedFunction.parameters.map((p) => p.type);
      node.parameters = this.coerceHexArgs(node.parameters, resolvedParamTypes);
      expectParameters(node, node.parameters.map((p) => p.type!), resolvedParamTypes);

      return node;
    }

    // Single overload resolved from SymbolTableTraversal - validate params
    if (node.resolvedFunction) {
      this.forwardInternalReturnOutputIdx(node, node.resolvedFunction);
      const resolvedParamTypes = node.resolvedFunction.parameters.map((p) => p.type);
      node.parameters = this.coerceHexArgs(node.parameters, resolvedParamTypes);
      const argTypes = node.parameters.map((p) => p.type!);
      expectParameters(node, argTypes, resolvedParamTypes);

      const resolvedReturnType = node.resolvedFunction.returnTypes.length === 1
        ? node.resolvedFunction.returnTypes[0]
        : node.resolvedFunction.returnTypes.length > 1
          ? new TupleType(node.resolvedFunction.returnTypes)
          : PrimitiveType.VOID;
      node.type = resolvedReturnType;
      return node;
    }

    const { definition, type } = node.identifier;
    if (!definition || !definition.parameters) return node; // already checked in symbol table

    node.parameters = this.coerceHexArgs(node.parameters, definition.parameters);
    const parameterTypes = node.parameters.map((p) => p.type!);
    expectParameters(node, parameterTypes, definition.parameters);

    // Additional array length check for checkMultiSig
    if (node.identifier.name === GlobalFunction.CHECKMULTISIG) {
      const sigs = node.parameters[0] as ArrayNode;
      const pks = node.parameters[1] as ArrayNode;
      if (sigs.elements.length > pks.elements.length) {
        throw new ArrayElementError(pks);
      }
    }

    node.type = type;

    // Infer the type of the toPaddedBytes function (depends on the second parameter)
    if (node.identifier.name === GlobalFunction.TO_PADDED_BYTES) {
      node.type = inferPaddedBytesType(node);
    }

    // Preserve bounded int return types for abs/min/max
    if (node.identifier.name === GlobalFunction.ABS) {
      const argType = node.parameters[0].type;
      if (argType instanceof IntType) node.type = argType;
    }
    if (node.identifier.name === GlobalFunction.MIN || node.identifier.name === GlobalFunction.MAX) {
      const t0 = node.parameters[0].type;
      const t1 = node.parameters[1].type;
      if (t0 instanceof IntType && t1 instanceof IntType) {
        node.type = t0.bits >= t1.bits ? t0 : t1;
      }
    }

    // Struct constructor: type is the StructType itself
    if (type instanceof StructType) {
      node.type = type;
      // Array-typed struct fields: mark an array-literal arg blobEncoded and coerce it to the field's array
      // type so codegen builds a framed blob at the declared element width (mirrors the typed array assign
      // path). Positional args line up with fields in declaration order.
      type.fields.forEach((field, i) => {
        const arg = node.parameters[i];
        if (field.type instanceof ArrayType && arg instanceof ArrayNode) {
          arg.blobEncoded = true;
          arg.type = field.type;
        }
      });
    }

    return node;
  }

  visitReturn(node: ReturnNode): Node {
    node.expressions = this.visitList(node.expressions);
    // Type check return values against enclosing function's declared return types
    if (this.currentFunction && this.currentFunction.returnTypes.length > 0) {
      const expectedTypes = this.currentFunction.returnTypes;
      const soleType = node.expressions.length === 1 ? node.expressions[0].type : undefined;
      let actualTypes: Type[];
      if (soleType instanceof TupleType && expectedTypes.length > 1) {
        // `return f()` where f returns a tuple: forward the tuple's component types (Solidity tuple
        // forwarding) instead of treating the whole tuple as one return value.
        actualTypes = soleType.elements;
      } else {
        node.expressions = node.expressions.map(
          (e, i) => this.maybeCoerceZeroToBytes(this.maybeCoerceHexToInt(e, expectedTypes[i]), expectedTypes[i]),
        );
        actualTypes = node.expressions.map((e) => e.type!);
      }
      if (actualTypes.length !== expectedTypes.length) {
        throw new ReturnTypeMismatchError(node, expectedTypes, actualTypes);
      }
      for (let i = 0; i < actualTypes.length; i++) {
        if (actualTypes[i] && !implicitlyCastable(actualTypes[i], expectedTypes[i])) {
          throw new ReturnTypeMismatchError(node, expectedTypes, actualTypes);
        }
      }
    }
    return node;
  }

  visitFunctionCallStatement(node: FunctionCallStatementNode): Node {
    // For multi-overload functions where resolution is deferred, handle here
    const overloads = this.functionDefinitions.get(node.call.identifier.name);
    if (overloads && overloads.length > 1 && !node.call.resolvedFunction) {
      // Visit identifier and params first so types are available
      node.call.identifier = this.visit(node.call.identifier) as IdentifierNode;
      node.call.parameters = this.visitList(node.call.parameters);

      const argTypes = node.call.parameters.map((p) => p.type!);
      const matches = overloads.filter((f) => {
        const funcParamTypes = f.parameters.map((p) => p.type);
        return implicitlyCastableSignature(argTypes, funcParamTypes);
      });

      if (matches.length === 0) {
        throw new NoMatchingOverloadError(node);
      } else if (matches.length === 1) {
        node.call.resolvedFunction = matches[0];
      } else {
        const exactMatches = matches.filter((f) => {
          const funcParamTypes = f.parameters.map((p) => p.type);
          return argTypes.length === funcParamTypes.length
            && argTypes.every((argType, i) => argType?.toString() === funcParamTypes[i]?.toString());
        });
        if (exactMatches.length === 1) {
          node.call.resolvedFunction = exactMatches[0];
        } else {
          throw new AmbiguousOverloadError(node);
        }
      }

      if (node.call.resolvedFunction.visibility === 'external' && !node.call.resolvedFunction.isFreeFunction) {
        throw new InternalCallToExternalError(node);
      }

      return node;
    }

    node.call = this.visit(node.call) as FunctionCallNode;
    return node;
  }

  visitMethodCallStatement(node: MethodCallStatementNode): Node {
    // After semantic analysis, the inner MethodCallNode was already transformed
    // to an ExternalFunctionCallNode. Just visit the expression if present.
    if (node.expression) {
      this.visit(node.expression);
    }
    return node;
  }

  visitInstantiation(node: InstantiationNode): Node {
    if (node.referencedContract) {
      // Contract deployment: type-check constructor args
      node.parameters = this.visitList(node.parameters);
      const parameterTypes = node.parameters.map((p) => p.type!);
      // Solidity `constructor(args)` carries the deploy params on constructorDef, not the (solidcash)
      // contract-level parameters; use whichever has them.
      const ctorParams = node.referencedContract.parameters.length > 0
        ? node.referencedContract.parameters : (node.referencedContract.constructorDef?.parameters ?? []);
      const expectedTypes = ctorParams.map((p) => p.type);
      expectParameters(node, parameterTypes, expectedTypes);

      // Deploy-then-call fold: type the per-field genesis expressions (param-substituted clones of the
      // folded callee's body) so the deploy covenant codegen has operand types. See tryFoldDeployCall.
      if (node.foldedStateInit) {
        for (const [field, expr] of node.foldedStateInit) {
          node.foldedStateInit.set(field, this.visit(expr) as ExpressionNode);
        }
      }

      if (node.callOptions?.value) {
        node.callOptions.value = this.visit(node.callOptions.value);
        expectInt(node as any, node.callOptions.value.type);
      }
      if (node.callOptions?.salt) {
        node.callOptions.salt = this.visit(node.callOptions.salt);
        expectBytes(node as any, node.callOptions.salt.type);
      }

      node.type = new BytesType();
      return node;
    }

    // Built-in class instantiation (LockingBytecodeP2PKH, etc.)
    node.identifier = this.visit(node.identifier) as IdentifierNode;
    node.parameters = this.visitList(node.parameters);

    const { definition, type } = node.identifier;
    if (!definition || !definition.parameters) return node; // already checked in symbol table

    node.parameters = this.coerceHexArgs(node.parameters, definition.parameters);
    const parameterTypes = node.parameters.map((p) => p.type!);
    expectParameters(node, parameterTypes, definition.parameters);

    node.type = type;
    return node;
  }

  visitTupleIndexOp(node: TupleIndexOpNode): Node {
    node.tuple = this.visit(node.tuple);

    // bytes[k] with a literal index parses as a tuple-index op: a single byte (Solidity bytes1).
    if (node.tuple.type instanceof BytesType) {
      node.type = new BytesType(1);
      return node;
    }

    // Handle constant-index array access (arr[5] where 5 is a NumberLiteral)
    if (node.tuple.type instanceof ArrayType) {
      // Bounds check for bounded arrays with constant index
      if (node.tuple.type.bound !== undefined) {
        if (node.index < 0 || node.index >= node.tuple.type.bound) {
          throw new IndexOutOfBoundsError(node);
        }
      }
      node.type = node.tuple.type.elementType;
      return node;
    }

    expectTuple(node, node.tuple.type);

    if (node.index !== 0 && node.index !== 1) {
      throw new IndexOutOfBoundsError(node);
    }

    node.type = node.index === 0 ? (node.tuple.type as TupleType).leftType : (node.tuple.type as TupleType).rightType;
    return node;
  }

  visitSlice(node: SliceNode): Node {
    node.element = this.visit(node.element);
    node.start = this.visit(node.start);
    node.end = this.visit(node.end);

    expectAnyOfTypes(node, node.element.type, [new BytesType(), PrimitiveType.STRING]);
    expectInt(node, node.start.type);
    expectInt(node, node.end.type);

    node.type = inferSliceType(node);
    return node;
  }

  visitDecimalLiteral(node: DecimalLiteralNode): Node {
    // If type was not propagated from context, default to fixed128x18
    if (!node.type) {
      node.type = new FixedType(true, 128, 18);
    }
    return node;
  }

  // Reinterpret a Solidity hex number literal as its big-endian integer value (the bytes are stored in
  // source order). Returns an IntLiteralNode so codegen emits a proper Script number, not a byte string.
  private hexLiteralToInt(lit: HexLiteralNode): IntLiteralNode {
    let value = 0n;
    for (const b of lit.value) value = (value << 8n) + BigInt(b);
    const intNode = new IntLiteralNode(value);
    intNode.location = lit.location;
    intNode.type = PrimitiveType.INT;
    return intNode;
  }

  private isIntegerType(t?: Type): boolean {
    return t === PrimitiveType.INT || t === PrimitiveType.BIGINT || t instanceof IntType;
  }

  // Solidity treats a `0x..` literal as a big-endian NUMBER whose concrete type is context-driven: in an
  // integer context it is that integer value (Solidity docs: "Conversions between Literals and Elementary
  // Types"). SolidCash natively types `0x..` as a bytes value (the deliberate inverse), so under
  // solidityImportCompat reinterpret it as an int when the target type is integral. Non-integer targets
  // (bytesN etc.) keep the native bytes literal.
  private maybeCoerceHexToInt(expr: ExpressionNode, expected?: Type): ExpressionNode {
    if (!this.solidityImportCompat) return expr;
    if (expr instanceof HexLiteralNode && this.isIntegerType(expected)) return this.hexLiteralToInt(expr);
    return expr;
  }

  // Solidity allows the integer literal `0` (and only 0) to implicitly convert to any bytesN (all-zero bytes),
  // a common idiom (`bytes32 constant SLOT = 0`, EVM storage-slot zero). Coerce it to an N-zero-byte literal so
  // it type-checks + codegen emits the right width; non-zero int literals still error (matches Solidity).
  private maybeCoerceZeroToBytes(expr: ExpressionNode, expected?: Type): ExpressionNode {
    if (expr instanceof IntLiteralNode && expr.value === 0n
      && expected instanceof BytesType && expected.bound !== undefined) {
      const hex = new HexLiteralNode(new Uint8Array(expected.bound));
      hex.type = expected;
      hex.location = expr.location;
      return hex;
    }
    return expr;
  }

  // Coerce each `0x..` / literal-0 argument against its target parameter type (the call-site analogue).
  private coerceHexArgs(args: ExpressionNode[], expected: (Type | undefined)[]): ExpressionNode[] {
    if (!this.solidityImportCompat) return args;
    return args.map((a, i) => this.maybeCoerceZeroToBytes(this.maybeCoerceHexToInt(a, expected[i]), expected[i]));
  }

  // An internal call to a `public` function that RETURNS a value targets the function's internal-call
  // subroutine, which still carries the injected `__internal__returnOutputIdx` param. The Solidity-source call
  // site can't know about it, so auto-supply -1 (the internal subroutine produces no return event - the value
  // stays on the stack). Only fires when the user passed exactly the user-visible args and returnOutputIdx is
  // the sole synthetic param; transitive cases (msg.sender / external-call params) are left to fail.
  private forwardInternalReturnOutputIdx(node: FunctionCallNode, fn: FunctionDefinitionNode): void {
    const synthetic = fn.parameters.filter((p) => p.name.startsWith('__internal__'));
    if (synthetic.length === 0) return;
    // Only auto-forward when the call site passed exactly the user-visible args (synthetic params are never
    // written at the call site).
    if (node.parameters.length !== fn.parameters.length - synthetic.length) return;
    // Forward only synthetic params that propagate unchanged across an internal call: returnOutputIdx (the
    // subroutine emits no return event -> -1), and the tx-level msg.sender category / blockhash input index
    // (msg.sender and the co-spend indices are identical throughout an internal call, so reference the caller's
    // own same-named param). Bail on anything else (e.g. external-call selector/index params) so the normal
    // arity check still fires.
    const FORWARDABLE = new Set(['__internal__msgSenderCategory', '__internal__blockhashInputIndex']);
    if (!synthetic.every((p) => p.name === '__internal__returnOutputIdx' || FORWARDABLE.has(p.name))) return;
    for (const p of synthetic) {
      if (p.name === '__internal__returnOutputIdx') {
        const minusOne = new IntLiteralNode(-1n);
        minusOne.location = node.location;
        minusOne.type = PrimitiveType.INT;
        node.parameters.push(minusOne);
      } else {
        const ref = new IdentifierNode(p.name);
        ref.location = node.location;
        ref.type = p.type;
        node.parameters.push(ref);
      }
    }
  }

  visitBinaryOp(node: BinaryOpNode): Node {
    // Visit non-decimal side first so its type is available for propagation
    const leftIsDecimal = node.left instanceof DecimalLiteralNode;
    const rightIsDecimal = node.right instanceof DecimalLiteralNode;

    if (leftIsDecimal && !rightIsDecimal) {
      // Visit right first, then propagate its type to the decimal literal on the left
      node.right = this.visit(node.right);
      if (!node.left.type && node.right.type instanceof FixedType) {
        node.left.type = node.right.type;
      }
      node.left = this.visit(node.left);
    } else if (rightIsDecimal && !leftIsDecimal) {
      // Visit left first, then propagate its type to the decimal literal on the right
      node.left = this.visit(node.left);
      if (!node.right.type && node.left.type instanceof FixedType) {
        node.right.type = node.left.type;
      }
      node.right = this.visit(node.right);
    } else {
      // Both or neither are decimals - default propagation
      if (leftIsDecimal && rightIsDecimal) {
        if (!node.left.type) node.left.type = new FixedType(true, 128, 18);
        if (!node.right.type) node.right.type = new FixedType(true, 128, 18);
      }
      node.left = this.visit(node.left);
      node.right = this.visit(node.right);
    }

    // Solidity hex number literals (`0x100...`) are big-endian integers, not byte strings. On a hex-vs-int
    // pairing (e.g. `x >= 0x100000000000000000000000000000000`), reinterpret the literal as its integer
    // value. Only fires on that pairing, which would otherwise be a type error, so it never changes working code.
    if (this.solidityImportCompat) {
      if (node.left instanceof HexLiteralNode && this.isIntegerType(node.right.type)) {
        node.left = this.hexLiteralToInt(node.left);
      } else if (node.right instanceof HexLiteralNode && this.isIntegerType(node.left.type)) {
        node.right = this.hexLiteralToInt(node.right);
      }
    }

    const resType = resultingTypeForBinaryOp(node.operator, node.left.type!, node.right.type!);
    if (!resType) {
      throw new UnequalTypeError(node);
    }

    switch (node.operator) {
      case BinaryOperator.PLUS:
        expectNumericOrConcat(node, resType);
        node.type = resType;
        // Infer new bounded bytes type if both operands are bounded bytes types
        if (node.left.type instanceof BytesType && node.right.type instanceof BytesType) {
          if (node.left.type.bound && node.right.type.bound) {
            node.type = new BytesType(node.left.type.bound + node.right.type.bound);
          }
        }
        return node;
      case BinaryOperator.POW: {
        expectNumeric(node, resType);
        // Solidity: exponent must be unsigned. Reject signed bounded int types
        // and fixed-point types. Unbounded int is allowed (runtime non-negative check).
        const expType = node.right.type!;
        if (expType instanceof IntType && expType.signed) {
          throw new SignedExponentError(node, expType.toString());
        }
        if (expType instanceof FixedType) {
          throw new SignedExponentError(node, expType.toString());
        }
        node.type = resType;
        return node;
      }
      case BinaryOperator.MUL:
      case BinaryOperator.DIV:
      case BinaryOperator.MOD:
      case BinaryOperator.MINUS:
        expectNumeric(node, resType);
        node.type = resType;
        return node;
      case BinaryOperator.LT:
      case BinaryOperator.LE:
      case BinaryOperator.GT:
      case BinaryOperator.GE:
        // bytesN ordering: equal-width fixed bytes compare as unsigned big-endian (Solidity semantics).
        if (node.left.type instanceof BytesType && node.right.type instanceof BytesType
            && node.left.type.bound !== undefined && node.left.type.bound === node.right.type.bound) {
          node.type = PrimitiveType.BOOL;
          return node;
        }
        expectNumeric(node, resType);
        node.type = PrimitiveType.BOOL;
        return node;
      case BinaryOperator.EQ:
      case BinaryOperator.NE:
        node.type = PrimitiveType.BOOL;
        return node;
      case BinaryOperator.AND:
      case BinaryOperator.OR:
        expectBool(node, resType);
        node.type = PrimitiveType.BOOL;
        return node;
      case BinaryOperator.BIT_AND:
      case BinaryOperator.BIT_OR:
      case BinaryOperator.BIT_XOR: {
        // Integer bitwise (fixed-width two's-complement) when at least one operand is a bounded int.
        const lt = node.left.type;
        const rt = node.right.type;
        const lInt = lt === PrimitiveType.BIGINT || lt instanceof IntType;
        const rInt = rt === PrimitiveType.BIGINT || rt instanceof IntType;
        if (lInt && rInt) {
          const bounded = lt instanceof IntType ? lt : (rt instanceof IntType ? rt : undefined);
          if (!bounded) {
            // Unbounded `int` has no fixed width; require intN/uintN for bitwise.
            throw new UnsupportedTypeError(node as any, lt, new IntType(false, 256));
          }
          if (lt instanceof IntType && rt instanceof IntType
              && (lt.bits !== bounded.bits || rt.bits !== bounded.bits || lt.signed !== rt.signed)) {
            throw new TypeError(node, rt, lt);
          }
          node.type = bounded;
          return node;
        }
        expectSameSizeBytes(node, node.left.type, node.right.type);
        node.type = node.left.type;
        return node;
      }
      case BinaryOperator.SHIFT_LEFT:
      case BinaryOperator.SHIFT_RIGHT:
        expectAnyOfTypes(node, node.left.type, [new BytesType(), PrimitiveType.BIGINT]);
        expectInt(node, node.right.type);
        if (node.right instanceof IntLiteralNode && Number(node.right.value) < 0) {
          throw new BitshiftBitcountNegativeError(node, Number(node.right.value));
        }
        node.type = node.left.type;
        return node;
      case BinaryOperator.SPLIT:
        expectAnyOfTypes(node, node.left.type, [new BytesType(), PrimitiveType.STRING]);
        expectInt(node, node.right.type);
        node.type = inferTupleType(node);
        return node;
      default:
        return node;
    }
  }

  visitUnaryOp(node: UnaryOpNode): Node {
    node.expression = this.visit(node.expression);

    switch (node.operator) {
      case UnaryOperator.NOT:
        expectBool(node, node.expression.type);
        node.type = PrimitiveType.BOOL;
        return node;
      case UnaryOperator.NEGATE:
        if (node.expression.type instanceof FixedType) {
          node.type = node.expression.type;
        } else {
          expectInt(node, node.expression.type);
          node.type = node.expression.type instanceof IntType ? node.expression.type : PrimitiveType.BIGINT;
        }
        return node;
      case UnaryOperator.INVERT:
        // Integer bitwise-not on a bounded int (~a = mask - a); else bytes.
        if (node.expression.type instanceof IntType) {
          node.type = node.expression.type;
          return node;
        }
        expectBytes(node, node.expression.type);
        node.type = node.expression.type;
        return node;
      case UnaryOperator.SIZE:
        if (node.expression.type instanceof ArrayType) {
          node.type = PrimitiveType.BIGINT;
          return node;
        }
        expectAnyOfTypes(node, node.expression.type, [new BytesType(), PrimitiveType.STRING]);
        node.type = PrimitiveType.BIGINT;
        return node;
      case UnaryOperator.REVERSE:
        expectAnyOfTypes(node, node.expression.type, [new BytesType(), PrimitiveType.STRING]);
        // Type is preserved
        node.type = node.expression.type;
        return node;
      case UnaryOperator.INPUT_VALUE:
      case UnaryOperator.INPUT_OUTPOINT_INDEX:
      case UnaryOperator.INPUT_SEQUENCE_NUMBER:
      case UnaryOperator.OUTPUT_VALUE:
      case UnaryOperator.INPUT_TOKEN_AMOUNT:
      case UnaryOperator.OUTPUT_TOKEN_AMOUNT:
        expectInt(node, node.expression.type);
        node.type = PrimitiveType.BIGINT;
        return node;
      case UnaryOperator.INPUT_LOCKING_BYTECODE:
      case UnaryOperator.INPUT_UNLOCKING_BYTECODE:
      case UnaryOperator.OUTPUT_LOCKING_BYTECODE:
      case UnaryOperator.INPUT_NFT_COMMITMENT:
      case UnaryOperator.OUTPUT_NFT_COMMITMENT:
      case UnaryOperator.INPUT_TOKEN_CATEGORY:
      case UnaryOperator.OUTPUT_TOKEN_CATEGORY:
        expectInt(node, node.expression.type);
        node.type = new BytesType();
        return node;
      case UnaryOperator.INPUT_OUTPOINT_HASH:
        expectInt(node, node.expression.type);
        node.type = new BytesType(32);
        return node;
      default:
        return node;
    }
  }

  visitNullaryOp(node: NullaryOpNode): Node {
    switch (node.operator) {
      case NullaryOperator.INPUT_INDEX:
      case NullaryOperator.INPUT_COUNT:
      case NullaryOperator.OUTPUT_COUNT:
      case NullaryOperator.VERSION:
      case NullaryOperator.LOCKTIME:
      case NullaryOperator.MSG_VALUE:
        node.type = PrimitiveType.BIGINT;
        return node;
      case NullaryOperator.BYTECODE:
        node.type = new BytesType();
        return node;
      case NullaryOperator.CATEGORY_ID:
        node.type = new BytesType();
        return node;
      case NullaryOperator.MSG_SIG:
        node.type = new BytesType(4);
        return node;
      case NullaryOperator.CHAIN_ID:
        // block.chainid is uint256 (Solidity parity). The network-selector value is still a minimal 1-byte
        // number on-stack (0/1/2 -> <=1 byte, regtest -1 -> 0x81), so typing it as a number costs nothing.
        node.type = new IntType(false, 256);
        return node;
      case NullaryOperator.BLOCK_PREVRANDAO:
        // uint256 (a non-negative hash-derived value); see block-and-transaction-properties.md
        node.type = new IntType(false, 256);
        return node;
      case NullaryOperator.TX_GASPRICE:
        node.type = new IntType(false, 32); // uint (sat/KB fee rate), same nominal type as block.basefee
        return node;
      case NullaryOperator.MSG_DATA:
        node.type = new BytesType();
        return node;
      case NullaryOperator.MSG_SENDER:
      case NullaryOperator.TX_ORIGIN:
        node.type = new AddressType();
        return node;
      default:
        return node;
    }
  }

  visitAbiEncode(node: AbiEncodeNode): Node {
    node.parameters = this.visitList(node.parameters);
    if (node.parameters.length === 0) {
      throw new AbiEncodeEmptyError(node);
    }
    node.type = new BytesType();
    return node;
  }

  visitAbiEncodePacked(node: AbiEncodePackedNode): Node {
    node.parameters = this.visitList(node.parameters);
    if (node.parameters.length === 0) {
      throw new AbiEncodeEmptyError(node);
    }
    node.type = new BytesType();
    return node;
  }

  visitAbiEncodeWithSelector(node: AbiEncodeWithSelectorNode): Node {
    node.selector = this.visit(node.selector) as ExpressionNode;
    if (!(node.selector.type instanceof BytesType) || node.selector.type.bound !== 4) {
      throw new TypeError(node, node.selector.type, new BytesType(4));
    }
    node.parameters = this.visitList(node.parameters);
    node.type = new BytesType();
    return node;
  }

  visitAbiEncodeWithSignature(node: AbiEncodeWithSignatureNode): Node {
    node.signature = this.visit(node.signature) as ExpressionNode;
    if (node.signature.type !== PrimitiveType.STRING) {
      throw new TypeError(node, node.signature.type, PrimitiveType.STRING);
    }
    node.parameters = this.visitList(node.parameters);
    node.type = new BytesType();
    return node;
  }

  visitAbiEncodeCall(node: AbiEncodeCallNode): Node {
    node.parameters = this.visitList(node.parameters);
    if (node.resolvedParamTypes) {
      node.parameters.forEach((param, i) => {
        const expected = node.resolvedParamTypes![i];
        if (!implicitlyCastable(param.type, expected)) {
          throw new TypeError(node, param.type, expected);
        }
      });
    }
    node.type = new BytesType();
    return node;
  }

  visitBytesConcat(node: BytesConcatNode): Node {
    node.parameters = this.visitList(node.parameters);
    for (const param of node.parameters) {
      if (!(param.type instanceof BytesType) && param.type !== PrimitiveType.STRING) {
        throw new TypeError(node, param.type, new BytesType(), `bytes.concat() expects bytes or string arguments but found '${param.type}'`);
      }
    }
    node.type = new BytesType();
    return node;
  }

  visitStringConcat(node: StringConcatNode): Node {
    node.parameters = this.visitList(node.parameters);
    for (const param of node.parameters) {
      if (!(param.type instanceof BytesType) && param.type !== PrimitiveType.STRING) {
        throw new TypeError(node, param.type, PrimitiveType.STRING, `string.concat() expects string or bytes arguments but found '${param.type}'`);
      }
    }
    node.type = PrimitiveType.STRING;
    return node;
  }

  visitAbiDecode(node: AbiDecodeNode): Node {
    node.data = this.visit(node.data);
    // A single-type decode yields that type directly (Solidity `abi.decode(d, (T))` returns T); 2+ -> tuple.
    node.type = node.schema.length === 1 ? node.schema[0] : new TupleType(node.schema);
    return node;
  }

  visitAbiDecodeAt(node: AbiDecodeAtNode): Node {
    node.data = this.visit(node.data);
    if (node.index < 0 || node.index >= node.schema.length) {
      throw new AbiDecodeIndexError(node);
    }
    node.type = node.schema[node.index];
    return node;
  }

  visitArray(node: ArrayNode): Node {
    // Propagate blobEncoded to inner ArrayNode elements (for multi-dimensional arrays)
    if (node.blobEncoded) {
      for (const elem of node.elements) {
        if (elem instanceof ArrayNode) {
          elem.blobEncoded = true;
        }
      }
    }

    node.elements = this.visitList(node.elements);

    // Empty blob-encoded arrays get their type from the variable declaration
    if (node.blobEncoded && node.elements.length === 0) {
      // Type was already set by visitVariableDefinition
      return node;
    }

    const elementTypes = node.elements.map((e) => {
      if (!e.type) throw new ArrayElementError(node);
      return e.type;
    });

    const elementType = arrayType(elementTypes);

    if (!elementType) {
      throw new ArrayElementError(node);
    }

    node.type = new ArrayType(elementType);
    return node;
  }

  visitNewArray(node: NewArrayNode): Node {
    node.size = this.visit(node.size);
    node.type = new ArrayType(node.elementType);
    return node;
  }

  visitArrayAccess(node: ArrayAccessNode): Node {
    node.array = this.visit(node.array);
    node.index = this.visit(node.index);

    // bytes[k] / bytesN[k]: index a single byte (Solidity returns bytes1).
    if (node.array.type instanceof BytesType) {
      expectInt(node as any, node.index.type);
      node.type = new BytesType(1);
      return node;
    }

    if (!(node.array.type instanceof ArrayType)) {
      throw new UnsupportedTypeError(node as any, node.array.type, new ArrayType(PrimitiveType.BIGINT));
    }

    expectInt(node as any, node.index.type);
    node.type = node.array.type.elementType;
    return node;
  }

  visitArrayPush(node: ArrayPushNode): Node {
    // Ensure array literal values are blob-encoded (needed for multi-dimensional arrays)
    if (node.value instanceof ArrayNode) {
      node.value.blobEncoded = true;
    }
    node.value = this.visit(node.value);
    // Require variable to be an array type
    if (!node.arrayType) {
      throw new UnsupportedTypeError(node as any);
    }
    // Forbid push on bounded arrays
    if (node.arrayType.bound !== undefined) {
      throw new UnsupportedTypeError(node as any, node.arrayType, new ArrayType(node.arrayType.elementType));
    }
    // Validate element type compatibility
    if (!implicitlyCastable(node.value.type, node.arrayType.elementType)) {
      throw new TypeError(node as any, node.value.type, node.arrayType.elementType);
    }
    return node;
  }

  visitArrayPop(node: ArrayPopNode): Node {
    // Require variable to be an array type
    if (!node.arrayType) {
      throw new UnsupportedTypeError(node as any);
    }
    // Forbid pop on bounded arrays
    if (node.arrayType.bound !== undefined) {
      throw new UnsupportedTypeError(node as any, node.arrayType, new ArrayType(node.arrayType.elementType));
    }
    return node;
  }

  visitArrayAssign(node: ArrayAssignNode): Node {
    node.index = this.visit(node.index);
    // Ensure array literal values are blob-encoded (needed for multi-dimensional arrays)
    if (node.value instanceof ArrayNode) {
      node.value.blobEncoded = true;
    }
    node.value = this.visit(node.value);
    expectInt(node as any, node.index.type);
    // Require variable to be an array type
    if (!node.arrayType) {
      throw new UnsupportedTypeError(node as any);
    }
    // Validate element type compatibility
    if (!implicitlyCastable(node.value.type, node.arrayType.elementType)) {
      throw new TypeError(node as any, node.value.type, node.arrayType.elementType);
    }
    return node;
  }

  visitArrayDelete(node: ArrayDeleteNode): Node {
    node.index = this.visit(node.index);
    expectInt(node as any, node.index.type);
    // Require variable to be an array type
    if (!node.arrayType) {
      throw new UnsupportedTypeError(node as any);
    }
    // Forbid delete on bounded arrays
    if (node.arrayType.bound !== undefined) {
      throw new UnsupportedTypeError(node as any, node.arrayType, new ArrayType(node.arrayType.elementType));
    }
    return node;
  }

  visitStateArrayPush(node: StateArrayPushNode): Node {
    node.value = this.visit(node.value);
    const sv = node.stateVariable!;
    const arrType = sv.type as ArrayType;
    if (!implicitlyCastable(node.value.type, arrType.elementType)) {
      throw new StateAssignTypeError(node as any, node.value.type, arrType.elementType);
    }
    return node;
  }

  visitStateArrayPop(node: StateArrayPopNode): Node {
    return node;
  }

  visitStateArrayAssign(node: StateArrayAssignNode): Node {
    node.index = this.visit(node.index);
    node.value = this.visit(node.value);
    const sv = node.stateVariable!;
    const arrType = sv.type as ArrayType;
    node.value = this.maybeCoerceZeroToBytes(node.value, arrType.elementType);
    expectInt(node as any, node.index.type);
    if (!implicitlyCastable(node.value.type, arrType.elementType)) {
      throw new StateAssignTypeError(node as any, node.value.type, arrType.elementType);
    }
    return node;
  }

  visitStateArrayDelete(node: StateArrayDeleteNode): Node {
    node.index = this.visit(node.index);
    expectInt(node as any, node.index.type);
    return node;
  }

  visitTernaryOp(node: TernaryOpNode): Node {
    node.condition = this.visit(node.condition);
    node.ifTrue = this.visit(node.ifTrue);
    node.ifFalse = this.visit(node.ifFalse);

    if (!implicitlyCastable(node.condition.type, PrimitiveType.BOOL)) {
      throw new UnsupportedTypeError(node as any, node.condition.type, PrimitiveType.BOOL);
    }

    if (!node.ifTrue.type || !node.ifFalse.type) {
      return node;
    }

    if (implicitlyCastable(node.ifTrue.type, node.ifFalse.type)) {
      node.type = node.ifFalse.type;
    } else if (implicitlyCastable(node.ifFalse.type, node.ifTrue.type)) {
      node.type = node.ifTrue.type;
    } else {
      throw new TernaryTypeMismatchError(node);
    }

    return node;
  }

  visitIdentifier(node: IdentifierNode): Node {
    // Function pointer value: type is the target's signature, not its return type.
    if (node.functionReference) {
      node.type = new FunctionType(
        node.functionReference.parameters.map((p) => p.type),
        node.functionReference.returnTypes,
      );
      return node;
    }
    if (!node.definition) return node;
    node.type = node.definition.type;
    return node;
  }

  visitContractReference(node: ContractReferenceNode): Node {
    for (let i = 0; i < node.constructorArgs.length; i++) {
      node.constructorArgs[i] = this.visit(node.constructorArgs[i]);
      const expected = node.referencedContract.parameters[i].type;
      const actual = node.constructorArgs[i].type;
      if (actual && !implicitlyCastable(actual, expected)) {
        throw new ContractConstructorArgTypeError(node, node.contractName, i, actual, expected);
      }
    }
    node.type = new BytesType();
    return node;
  }

  visitCollectionIteration(node: CollectionIterationNode): Node {
    const coll = node.collection!;

    if (node.keyType && node.mode !== CollectionIterationMode.VALUES) {
      const expectedKeyType = coll.keyType;
      if (!implicitlyCastable(node.keyType, expectedKeyType)) {
        throw new TypeError(node, node.keyType, expectedKeyType);
      }
    }

    if (node.valueType && node.mode !== CollectionIterationMode.KEYS) {
      const expectedValueType = coll.innermostValueType;
      if (!implicitlyCastable(node.valueType, expectedValueType)) {
        throw new TypeError(node, node.valueType, expectedValueType);
      }
    }

    node.body = this.visit(node.body) as BlockNode;
    return node;
  }
}

type ExpectedNode = BinaryOpNode | UnaryOpNode | TimeOpNode | TupleIndexOpNode | SliceNode;
function expectAnyOfTypes(node: ExpectedNode, actual?: Type, expectedTypes?: Type[]): void {
  if (!expectedTypes || expectedTypes.length === 0) return;
  if (expectedTypes.find((expected) => implicitlyCastable(actual, expected))) return;

  throw new UnsupportedTypeError(node, actual, expectedTypes[0]);
}

function expectBool(node: ExpectedNode, actual?: Type): void {
  expectAnyOfTypes(node, actual, [PrimitiveType.BOOL]);
}

function expectInt(node: ExpectedNode, actual?: Type): void {
  expectAnyOfTypes(node, actual, [PrimitiveType.BIGINT]);
}

function expectNumeric(node: ExpectedNode, actual?: Type): void {
  if (!isNumericType(actual)) {
    throw new UnsupportedTypeError(node, actual, PrimitiveType.BIGINT);
  }
}

function expectNumericOrConcat(node: ExpectedNode, actual?: Type): void {
  // Bool is excluded from numeric addition - use int() cast first
  if (actual !== PrimitiveType.BOOL && isNumericType(actual)) return;
  if (implicitlyCastable(actual, PrimitiveType.BIGINT)) return;
  if (implicitlyCastable(actual, PrimitiveType.STRING)) return;
  if (implicitlyCastable(actual, new BytesType())) return;
  throw new UnsupportedTypeError(node, actual, PrimitiveType.BIGINT);
}

function expectBytes(node: ExpectedNode, actual?: Type): void {
  expectAnyOfTypes(node, actual, [new BytesType()]);
}

function expectSameSizeBytes(node: BinaryOpNode, left?: Type, right?: Type): void {
  if (!(left instanceof BytesType) || !(right instanceof BytesType)) {
    throw new UnsupportedTypeError(node, left, new BytesType());
  }

  if (left.bound !== right.bound) {
    throw new UnequalTypeError(node);
  }
}

function expectTuple(node: ExpectedNode, actual?: Type): void {
  if (!(actual instanceof TupleType)) {
    // We use a placeholder tuple to indicate that we're expecting *any* tuple at all
    const placeholderTuple = new TupleType([new BytesType(), new BytesType()]);
    throw new UnsupportedTypeError(node, actual, placeholderTuple);
  }
}

type AssigningNode = AssignNode | VariableDefinitionNode;
function expectAssignable(node: AssigningNode, actual?: Type, expected?: Type): void {
  if (!implicitlyCastable(actual, expected)) {
    throw new AssignTypeError(node);
  }
}

type NodeWithParameters = FunctionCallNode | RequireNode | InstantiationNode;
function expectParameters(node: NodeWithParameters, actual: Type[], expected: Type[]): void {
  if (!implicitlyCastableSignature(actual, expected)) {
    throw new InvalidParameterTypeError(node, actual, expected);
  }
}

// We only call this function for the split operator, so we assume that the node.op is SPLIT
function inferTupleType(node: BinaryOpNode): Type {
  if (node.right instanceof IntLiteralNode && Number(node.right.value) < 0) {
    throw new IndexOutOfBoundsError(node);
  }

  // string.split() -> string, string
  if (node.left.type === PrimitiveType.STRING) {
    return new TupleType([PrimitiveType.STRING, PrimitiveType.STRING]);
  }

  // If the expression is not a bytes type, then it must be a different compatible type (e.g. sig/pubkey)
  // We treat this as an unbounded bytes type for the purposes of splitting
  const expressionType = node.left.type instanceof BytesType ? node.left.type : new BytesType();

  // bytes.split(variable) -> bytes, bytes
  if (!(node.right instanceof IntLiteralNode)) {
    return new TupleType([new BytesType(), new BytesType()]);
  }

  const splitIndex = Number(node.right.value);

  // bytes.split(NumberLiteral) -> bytes(NumberLiteral), bytes
  if (expressionType.bound === undefined) {
    return new TupleType([new BytesType(splitIndex), new BytesType()]);
  }

  if (splitIndex > expressionType.bound) {
    throw new IndexOutOfBoundsError(node);
  }

  // bytesX.split(NumberLiteral) -> bytes(NumberLiteral), bytes(X - NumberLiteral)
  return new TupleType([
    new BytesType(splitIndex),
    new BytesType(expressionType.bound! - splitIndex),
  ]);
}

function inferSliceType(node: SliceNode): Type {
  if (node.start instanceof IntLiteralNode && Number(node.start.value) < 0) {
    throw new IndexOutOfBoundsError(node);
  }

  if (node.end instanceof IntLiteralNode && Number(node.end.value) < 0) {
    throw new IndexOutOfBoundsError(node);
  }

  // string.slice() -> string
  if (node.element.type === PrimitiveType.STRING) {
    return PrimitiveType.STRING;
  }

  // If the expression is not a bytes type, then it must be a different compatible type (e.g. sig/pubkey)
  const expressionType = node.element.type instanceof BytesType ? node.element.type : new BytesType();

  if (expressionType.bound !== undefined) {
    if (node.start instanceof IntLiteralNode && Number(node.start.value) >= expressionType.bound) {
      throw new IndexOutOfBoundsError(node);
    }

    if (node.end instanceof IntLiteralNode && Number(node.end.value) > expressionType.bound) {
      throw new IndexOutOfBoundsError(node);
    }
  }

  // bytes.slice(variable, variable) -> bytes
  // bytes.slice(NumberLiteral, variable) -> bytes
  // bytes.slice(variable, NumberLiteral) -> bytes
  if (!(node.start instanceof IntLiteralNode) || !(node.end instanceof IntLiteralNode)) {
    return new BytesType();
  }

  const start = Number(node.start.value);
  const end = Number(node.end.value);

  if (start > end) {
    throw new IndexOutOfBoundsError(node);
  }

  // bytes.slice(NumberLiteral start, NumberLiteral end) -> bytes(end - start)
  return new BytesType(end - start);
}

const inferPaddedBytesType = (node: FunctionCallNode): Type => {
  if (node.parameters[1] instanceof IntLiteralNode) {
    return new BytesType(Number(node.parameters[1].value));
  }

  return new BytesType();
};

function isValidStateType(type: Type): boolean {
  if (type === PrimitiveType.BIGINT || type === PrimitiveType.BOOL) return true;
  if (type === PrimitiveType.STRING) return true;
  if (type === PrimitiveType.PUBKEY) return true;
  if (type === PrimitiveType.SIG) return true;
  if (type === PrimitiveType.DATASIG) return true;
  // Function pointers store as their integer functionId (immutable per covenant bytecode).
  if (type instanceof FunctionType) return true;
  if (type instanceof IntType) return true;
  if (type instanceof FixedType) return true;
  if (type instanceof BytesType) return true;
  if (type instanceof AddressType) return true;
  if (type instanceof EnumType) return true; // int-backed: stored as the underlying integer
  if (type instanceof ValueType) return isValidStateType(type.underlyingType);
  if (type instanceof StructType) return type.fields.every((f) => isValidStateType(f.type));
  if (type instanceof ArrayType) return isValidStateType(type.elementType);
  return false;
}

function isValidMappingKeyType(type: Type): boolean {
  if (type === PrimitiveType.BIGINT || type === PrimitiveType.BOOL) return true;
  if (type === PrimitiveType.STRING) return true;
  if (type === PrimitiveType.PUBKEY) return true;
  if (type instanceof IntType) return true;
  if (type instanceof BytesType) return true;
  if (type instanceof AddressType) return true;
  if (type instanceof ValueType) return isValidMappingKeyType(type.underlyingType);
  return false;
}

function isValidEventParamType(type: Type): boolean {
  // int, bool, string, pubkey are valid
  if (type === PrimitiveType.BIGINT || type === PrimitiveType.BOOL) return true;
  // Bounded int types are valid
  if (type instanceof IntType) return true;
  if (type === PrimitiveType.STRING || type === PrimitiveType.PUBKEY) return true;
  // All bytes types (bounded and unbounded) are valid
  if (type instanceof BytesType) return true;
  // address is bytes-backed (locking bytecode), serialized like bytes
  if (type instanceof AddressType) return true;
  // Structs are valid (serialized via pushdata encoding)
  if (type instanceof StructType) return true;
  // Arrays are valid when their element type is. The emit writes the on-stack array blob verbatim (count push +
  // fixed-width or framed elements); the SDK reads it back via decodePackedEventArray.
  if (type instanceof ArrayType) return isValidEventParamType(type.elementType);
  // sig and datasig are NOT valid event parameter types
  return false;
}

type Narrowing = { symbol: Symbol, bound: number };

// Temporarily narrows each symbol's type to BytesType(bound), calls fn, then restores in reverse.
function executeWithNarrowedTypes(narrowings: Narrowing[], fn: () => void): void {
  if (narrowings.length === 0) {
    fn();
    return;
  }

  const [{ symbol, bound }, ...rest] = narrowings;
  const originalType = symbol.type;
  symbol.type = new BytesType(bound);
  executeWithNarrowedTypes(rest, fn);
  symbol.type = originalType;
}

function isSizeOp(node: Node): node is UnaryOpNode {
  return node instanceof UnaryOpNode && node.operator === UnaryOperator.SIZE;
}

// Matches `x.length == N` or `N == x.length`, returning the size and literal nodes.
function matchSizeLiteral(expr: BinaryOpNode): { sizeNode: UnaryOpNode, literalNode: IntLiteralNode } | undefined {
  if (isSizeOp(expr.left) && expr.right instanceof IntLiteralNode) {
    return { sizeNode: expr.left, literalNode: expr.right };
  }

  if (isSizeOp(expr.right) && expr.left instanceof IntLiteralNode) {
    return { sizeNode: expr.right, literalNode: expr.left };
  }

  return undefined;
}

// Extracts type narrowings from expressions like x.length == 20, including through && chains.
function extractBytesNarrowings(expr: ExpressionNode): Narrowing[] {
  if (!(expr instanceof BinaryOpNode)) return [];

  // Both sides of && must be true, so all narrowings apply
  if (expr.operator === BinaryOperator.AND) {
    return [...extractBytesNarrowings(expr.left), ...extractBytesNarrowings(expr.right)];
  }

  const narrowing = extractSingleBytesNarrowing(expr);
  return narrowing ? [narrowing] : [];
}

// Matches x.length == N where x is an unbounded bytes variable.
function extractSingleBytesNarrowing(expr: BinaryOpNode): Narrowing | undefined {
  if (expr.operator !== BinaryOperator.EQ) return undefined;

  const match = matchSizeLiteral(expr);
  if (!match) return undefined;

  const { sizeNode, literalNode } = match;
  if (!(sizeNode.expression instanceof IdentifierNode)) return undefined;

  const { definition } = sizeNode.expression;
  if (!definition || !(definition.type instanceof BytesType) || definition.type.bound !== undefined) return undefined;

  const bound = Number(literalNode.value);
  if (bound <= 0) return undefined;

  return { symbol: definition, bound };
}
