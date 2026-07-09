import {
  Node,
  SourceFileNode,
  ContractNode,
  ParameterNode,
  VariableDefinitionNode,
  FunctionDefinitionNode,
  AssignNode,
  AssignmentExpressionNode,
  IdentifierNode,
  BranchNode,
  CastNode,
  FunctionCallNode,
  IndirectCallNode,
  UnaryOpNode,
  BinaryOpNode,
  BoolLiteralNode,
  IntLiteralNode,
  DecimalLiteralNode,
  HexLiteralNode,
  StringLiteralNode,
  StatementNode,
  BlockNode,
  TimeOpNode,
  ArrayNode,
  NewArrayNode,
  ArrayAccessNode,
  ArrayPushNode,
  ArrayPopNode,
  ArrayAssignNode,
  ArrayDeleteNode,
  StateArrayPushNode,
  StateArrayPopNode,
  StateArrayAssignNode,
  StateArrayDeleteNode,
  TupleIndexOpNode,
  RequireNode,
  InstantiationNode,
  TupleAssignmentNode,
  NullaryOpNode,
  ConsoleStatementNode,
  ConsoleParameterNode,
  SliceNode,
  TryCatchNode,
  CatchClauseNode,
  DoWhileNode,
  WhileNode,
  AssemblyStatementNode,
  StateVariableNode,
  StateAccessNode,
  StateAssignNode,
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
  StructDefinitionNode,
  EnumDefinitionNode,
  FieldAccessNode,
  TypeDefinitionNode,
  EventDefinitionNode,
  ErrorDefinitionNode,
  EmitStatementNode,
  TransferStatementNode,
  SelfdestructStatementNode,
  TokenContainerMethodStatementNode,
  ReturnNode,
  FunctionCallStatementNode,
  ExpressionStatementNode,
  MethodCallStatementNode,
  ExpressionNode,
  ConstantDefinitionNode,
  TernaryOpNode,
  BreakNode,
  ContinueNode,
  ImportNode,
  ContractReferenceNode,
  InterfaceNode,
  InterfaceStateVariableNode,
  InterfaceFunctionNode,
  InterfaceCollectionNode,
  ExternalStateAccessNode,
  ExternalMappingAccessNode,
  ExternalFunctionCallNode,
  ExternalOutputStateNode,
  ExternalOutputStateAccessNode,
  MethodCallNode,
  RevertNode,
  AssertNode,
  AddressTransferStatementNode,
  AddressSendExpressionNode,
  LowLevelCallNode,
  LowLevelCallStatementNode,
  CollectionIterationNode,
  TypeIntrospectionNode,
  UncheckedNode,
  SwitchNode,
  SwitchCaseNode,
  UsingForDirectiveNode,
} from './AST.js';
import AstVisitor from './AstVisitor.js';

export default class AstTraversal extends AstVisitor<Node> {
  visitSourceFile(node: SourceFileNode): Node {
    node.constantDefinitions = this.visitList(node.constantDefinitions) as ConstantDefinitionNode[];
    node.enumDefinitions = this.visitList(node.enumDefinitions) as EnumDefinitionNode[];
    node.structDefinitions = this.visitList(node.structDefinitions) as StructDefinitionNode[];
    node.typeDefinitions = this.visitList(node.typeDefinitions) as TypeDefinitionNode[];
    node.errorDefinitions = this.visitList(node.errorDefinitions) as ErrorDefinitionNode[];
    node.eventDefinitions = this.visitList(node.eventDefinitions) as EventDefinitionNode[];
    node.interfaceDefinitions = this.visitList(node.interfaceDefinitions) as InterfaceNode[];
    node.freeFunctions = this.visitList(node.freeFunctions) as FunctionDefinitionNode[];
    node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    node.parameters = this.visitList(node.parameters) as ParameterNode[];
    node.enumDefinitions = this.visitList(node.enumDefinitions) as EnumDefinitionNode[];
    node.structDefinitions = this.visitList(node.structDefinitions) as StructDefinitionNode[];
    node.typeDefinitions = this.visitList(node.typeDefinitions) as TypeDefinitionNode[];
    node.eventDefinitions = this.visitList(node.eventDefinitions) as EventDefinitionNode[];
    node.errorDefinitions = this.visitList(node.errorDefinitions) as ErrorDefinitionNode[];
    node.constantDefinitions = this.visitList(node.constantDefinitions) as ConstantDefinitionNode[];
    node.stateVariables = this.visitList(node.stateVariables) as StateVariableNode[];
    node.collections = this.visitList(node.collections) as CollectionNode[];
    if (node.constructorDef) {
      node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    }
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    return node;
  }

  visitConstantDefinition(node: ConstantDefinitionNode): Node {
    node.expression = this.visit(node.expression);
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    node.parameters = this.visitList(node.parameters) as ParameterNode[];
    node.body = this.visit(node.body) as BlockNode;
    return node;
  }

  visitParameter(node: ParameterNode): Node {
    return node;
  }

  visitStateVariable(node: StateVariableNode): Node {
    return node;
  }

  visitStateAccess(node: StateAccessNode): Node {
    return node;
  }

  visitStateAssign(node: StateAssignNode): Node {
    node.expression = this.visit(node.expression);
    return node;
  }

  visitCollection(node: CollectionNode): Node {
    return node;
  }

  visitMappingAccess(node: MappingAccessNode): Node {
    node.keys = this.visitList(node.keys);
    if (node.arrayIndex) {
      node.arrayIndex = this.visit(node.arrayIndex) as ExpressionNode;
    }
    return node;
  }

  visitMappingAssign(node: MappingAssignNode): Node {
    node.keys = this.visitList(node.keys);
    if (node.arrayIndex) {
      node.arrayIndex = this.visit(node.arrayIndex) as ExpressionNode;
    }
    node.expression = this.visit(node.expression);
    return node;
  }

  visitMappingFieldAssign(node: MappingFieldAssignNode): Node {
    node.keys = this.visitList(node.keys);
    node.expression = this.visit(node.expression);
    return node;
  }

  visitDeleteLocal(node: DeleteLocalNode): Node {
    node.identifier = this.visit(node.identifier) as IdentifierNode;
    return node;
  }

  visitDeleteState(node: DeleteStateNode): Node {
    return node;
  }

  visitMappingDelete(node: MappingDeleteNode): Node {
    node.keys = this.visitList(node.keys);
    return node;
  }

  visitVariableDefinition(node: VariableDefinitionNode): Node {
    if (node.expression) node.expression = this.visit(node.expression);
    return node;
  }

  visitTupleAssignment(node: TupleAssignmentNode): Node {
    if (node.tupleExpressions) {
      node.tupleExpressions = node.tupleExpressions.map((e) => this.visit(e) as ExpressionNode);
    } else {
      node.tuple = this.visit(node.tuple);
    }
    return node;
  }

  visitAssign(node: AssignNode): Node {
    node.identifier = this.visit(node.identifier) as IdentifierNode;
    node.expression = this.visit(node.expression);
    return node;
  }

  visitAssignmentExpression(node: AssignmentExpressionNode): Node {
    node.assign = this.visit(node.assign) as AssignNode;
    return node;
  }

  visitTimeOp(node: TimeOpNode): Node {
    node.expression = this.visit(node.expression);
    return node;
  }

  visitRequire(node: RequireNode): Node {
    node.expression = this.visit(node.expression);
    return node;
  }

  visitBranch(node: BranchNode): Node {
    node.condition = this.visit(node.condition);
    node.ifBlock = this.visit(node.ifBlock) as StatementNode;
    node.elseBlock = this.visitOptional(node.elseBlock) as StatementNode;
    return node;
  }

  visitTryCatch(node: TryCatchNode): Node {
    node.expression = this.visit(node.expression);
    node.tryBlock = this.visit(node.tryBlock) as BlockNode;
    node.catchClauses = this.visitList(node.catchClauses) as CatchClauseNode[];
    return node;
  }

  visitCatchClause(node: CatchClauseNode): Node {
    node.block = this.visit(node.block) as BlockNode;
    return node;
  }

  visitDoWhile(node: DoWhileNode): Node {
    node.condition = this.visit(node.condition);
    node.block = this.visit(node.block) as StatementNode;
    return node;
  }

  visitWhile(node: WhileNode): Node {
    node.condition = this.visit(node.condition);
    node.block = this.visit(node.block) as StatementNode;
    return node;
  }

  visitAssemblyStatement(node: AssemblyStatementNode): Node {
    return node;
  }

  visitBlock(node: BlockNode): Node {
    node.statements = this.visitOptionalList(node.statements) as StatementNode[];
    return node;
  }

  visitCast(node: CastNode): Node {
    node.expression = this.visit(node.expression);
    return node;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    node.identifier = this.visit(node.identifier) as IdentifierNode;
    node.parameters = this.visitList(node.parameters);
    return node;
  }

  visitIndirectCall(node: IndirectCallNode): Node {
    node.callee = this.visit(node.callee) as ExpressionNode;
    node.parameters = this.visitList(node.parameters);
    return node;
  }

  visitInstantiation(node: InstantiationNode): Node {
    node.identifier = this.visit(node.identifier) as IdentifierNode;
    node.parameters = this.visitList(node.parameters);
    if (node.callOptions?.value) {
      node.callOptions.value = this.visit(node.callOptions.value) as ExpressionNode;
    }
    if (node.callOptions?.salt) {
      node.callOptions.salt = this.visit(node.callOptions.salt) as ExpressionNode;
    }
    return node;
  }

  visitTupleIndexOp(node: TupleIndexOpNode): Node {
    node.tuple = this.visit(node.tuple);
    return node;
  }

  visitSlice(node: SliceNode): Node {
    node.element = this.visit(node.element);
    node.start = this.visit(node.start);
    node.end = this.visit(node.end);
    return node;
  }

  visitBinaryOp(node: BinaryOpNode): Node {
    node.left = this.visit(node.left);
    node.right = this.visit(node.right);
    return node;
  }

  visitUnaryOp(node: UnaryOpNode): Node {
    node.expression = this.visit(node.expression);
    return node;
  }

  visitNullaryOp(node: NullaryOpNode): Node {
    return node;
  }

  visitTernaryOp(node: TernaryOpNode): Node {
    node.condition = this.visit(node.condition);
    node.ifTrue = this.visit(node.ifTrue);
    node.ifFalse = this.visit(node.ifFalse);
    return node;
  }

  visitArray(node: ArrayNode): Node {
    node.elements = this.visitList(node.elements);
    return node;
  }

  visitNewArray(node: NewArrayNode): Node {
    node.size = this.visit(node.size);
    return node;
  }

  visitArrayAccess(node: ArrayAccessNode): Node {
    node.array = this.visit(node.array);
    node.index = this.visit(node.index);
    return node;
  }

  visitArrayPush(node: ArrayPushNode): Node {
    node.value = this.visit(node.value);
    return node;
  }

  visitArrayPop(node: ArrayPopNode): Node {
    return node;
  }

  visitArrayAssign(node: ArrayAssignNode): Node {
    node.index = this.visit(node.index);
    node.value = this.visit(node.value);
    return node;
  }

  visitArrayDelete(node: ArrayDeleteNode): Node {
    node.index = this.visit(node.index);
    return node;
  }

  visitStateArrayPush(node: StateArrayPushNode): Node {
    node.value = this.visit(node.value);
    return node;
  }

  visitStateArrayPop(node: StateArrayPopNode): Node {
    return node;
  }

  visitStateArrayAssign(node: StateArrayAssignNode): Node {
    node.index = this.visit(node.index);
    node.value = this.visit(node.value);
    return node;
  }

  visitStateArrayDelete(node: StateArrayDeleteNode): Node {
    node.index = this.visit(node.index);
    return node;
  }

  visitIdentifier(node: IdentifierNode): Node {
    return node;
  }

  visitBoolLiteral(node: BoolLiteralNode): Node {
    return node;
  }

  visitIntLiteral(node: IntLiteralNode): Node {
    return node;
  }

  visitDecimalLiteral(node: DecimalLiteralNode): Node {
    return node;
  }

  visitStringLiteral(node: StringLiteralNode): Node {
    return node;
  }

  visitHexLiteral(node: HexLiteralNode): Node {
    return node;
  }

  visitAbiEncode(node: AbiEncodeNode): Node {
    node.parameters = this.visitList(node.parameters);
    return node;
  }

  visitAbiEncodePacked(node: AbiEncodePackedNode): Node {
    node.parameters = this.visitList(node.parameters);
    return node;
  }

  visitAbiEncodeWithSelector(node: AbiEncodeWithSelectorNode): Node {
    node.selector = this.visit(node.selector) as ExpressionNode;
    node.parameters = this.visitList(node.parameters);
    return node;
  }

  visitAbiEncodeWithSignature(node: AbiEncodeWithSignatureNode): Node {
    node.signature = this.visit(node.signature) as ExpressionNode;
    node.parameters = this.visitList(node.parameters);
    return node;
  }

  visitAbiEncodeCall(node: AbiEncodeCallNode): Node {
    node.parameters = this.visitList(node.parameters);
    return node;
  }

  visitBytesConcat(node: BytesConcatNode): Node {
    node.parameters = this.visitList(node.parameters);
    return node;
  }

  visitStringConcat(node: StringConcatNode): Node {
    node.parameters = this.visitList(node.parameters);
    return node;
  }

  visitAbiDecode(node: AbiDecodeNode): Node {
    node.data = this.visit(node.data);
    return node;
  }

  visitAbiDecodeAt(node: AbiDecodeAtNode): Node {
    node.data = this.visit(node.data);
    return node;
  }

  visitStructDefinition(node: StructDefinitionNode): Node {
    return node;
  }

  visitEnumDefinition(node: EnumDefinitionNode): Node {
    return node;
  }

  visitTypeDefinition(node: TypeDefinitionNode): Node {
    return node;
  }

  visitUsingForDirective(node: UsingForDirectiveNode): Node {
    return node;
  }

  visitFieldAccess(node: FieldAccessNode): Node {
    node.expression = this.visit(node.expression);
    return node;
  }

  visitTypeIntrospection(node: TypeIntrospectionNode): Node {
    return node;
  }

  visitConsoleStatement(node: ConsoleStatementNode): Node {
    node.parameters = this.visitList(node.parameters) as ConsoleParameterNode[];
    return node;
  }

  visitEventDefinition(node: EventDefinitionNode): Node {
    return node;
  }

  visitErrorDefinition(node: ErrorDefinitionNode): Node {
    return node;
  }

  visitRevert(node: RevertNode): Node {
    node.args = this.visitList(node.args);
    return node;
  }

  visitAssert(node: AssertNode): Node {
    node.expression = this.visit(node.expression);
    return node;
  }

  visitEmitStatement(node: EmitStatementNode): Node {
    node.args = this.visitList(node.args);
    return node;
  }

  visitTransferStatement(node: TransferStatementNode): Node {
    node.lockingBytecode = this.visit(node.lockingBytecode);
    node.amount = this.visit(node.amount);
    return node;
  }

  visitSelfdestructStatement(node: SelfdestructStatementNode): Node {
    node.recipient = this.visit(node.recipient);
    return node;
  }

  visitTokenContainerMethodStatement(node: TokenContainerMethodStatementNode): Node {
    node.tokenContainerKeyExpression = this.visit(node.tokenContainerKeyExpression);
    node.args = this.visitList(node.args);
    return node;
  }

  visitReturn(node: ReturnNode): Node {
    node.expressions = this.visitList(node.expressions) as ExpressionNode[];
    return node;
  }

  visitFunctionCallStatement(node: FunctionCallStatementNode): Node {
    node.call = this.visit(node.call) as FunctionCallNode;
    return node;
  }

  visitExpressionStatement(node: ExpressionStatementNode): Node {
    node.expression = this.visit(node.expression) as ExpressionNode;
    return node;
  }

  visitMethodCallStatement(node: MethodCallStatementNode): Node {
    // After SymbolTableTraversal, node.expression holds the transformed ExternalFunctionCallNode.
    // Visit the expression if already set (subsequent passes); otherwise visit the original call
    // (first pass / SymbolTableTraversal) to transform it.
    if (node.expression) {
      node.expression = this.visit(node.expression) as any;
    } else {
      node.expression = this.visit(node.call) as any;
    }
    return node;
  }

  visitBreak(node: BreakNode): Node {
    return node;
  }

  visitContinue(node: ContinueNode): Node {
    return node;
  }

  visitImport(node: ImportNode): Node {
    return node;
  }

  visitContractReference(node: ContractReferenceNode): Node {
    node.constructorArgs = this.visitList(node.constructorArgs) as ExpressionNode[];
    return node;
  }

  visitInterfaceDefinition(node: InterfaceNode): Node {
    node.enumDefinitions = this.visitList(node.enumDefinitions) as EnumDefinitionNode[];
    node.structDefinitions = this.visitList(node.structDefinitions) as StructDefinitionNode[];
    node.typeDefinitions = this.visitList(node.typeDefinitions) as TypeDefinitionNode[];
    node.eventDefinitions = this.visitList(node.eventDefinitions) as EventDefinitionNode[];
    node.stateVariables = this.visitList(node.stateVariables) as InterfaceStateVariableNode[];
    node.collections = this.visitList(node.collections) as InterfaceCollectionNode[];
    node.functions = this.visitList(node.functions) as InterfaceFunctionNode[];
    return node;
  }

  visitInterfaceStateVariable(node: InterfaceStateVariableNode): Node {
    return node;
  }

  visitInterfaceCollection(node: InterfaceCollectionNode): Node {
    return node;
  }

  visitInterfaceFunction(node: InterfaceFunctionNode): Node {
    return node;
  }

  visitExternalStateAccess(node: ExternalStateAccessNode): Node {
    node.addressExpression = this.visit(node.addressExpression);
    return node;
  }

  visitExternalMappingAccess(node: ExternalMappingAccessNode): Node {
    node.addressExpression = this.visit(node.addressExpression);
    node.keys = this.visitList(node.keys);
    return node;
  }

  visitExternalFunctionCall(node: ExternalFunctionCallNode): Node {
    node.addressExpression = this.visit(node.addressExpression);
    node.parameters = this.visitList(node.parameters);
    if (node.callOptions?.value) node.callOptions.value = this.visit(node.callOptions.value) as ExpressionNode;
    if (node.callOptions?.gas) node.callOptions.gas = this.visit(node.callOptions.gas) as ExpressionNode;
    return node;
  }

  visitExternalOutputState(node: ExternalOutputStateNode): Node {
    node.addressExpression = this.visit(node.addressExpression);
    return node;
  }

  visitExternalOutputStateAccess(node: ExternalOutputStateAccessNode): Node {
    node.outStateNode = this.visit(node.outStateNode) as ExternalOutputStateNode;
    return node;
  }

  visitMethodCall(node: MethodCallNode): Node {
    node.object = this.visit(node.object);
    node.parameters = this.visitList(node.parameters);
    if (node.callOptions?.value) node.callOptions.value = this.visit(node.callOptions.value) as ExpressionNode;
    if (node.callOptions?.gas) node.callOptions.gas = this.visit(node.callOptions.gas) as ExpressionNode;
    return node;
  }

  visitAddressTransferStatement(node: AddressTransferStatementNode): Node {
    node.addressExpression = this.visit(node.addressExpression);
    node.amount = this.visit(node.amount);
    return node;
  }

  visitAddressSendExpression(node: AddressSendExpressionNode): Node {
    node.addressExpression = this.visit(node.addressExpression);
    node.amount = this.visit(node.amount);
    return node;
  }

  visitLowLevelCall(node: LowLevelCallNode): Node {
    node.targetExpression = this.visit(node.targetExpression) as ExpressionNode;
    node.data = this.visit(node.data) as ExpressionNode;
    if (node.callOptions?.value) node.callOptions.value = this.visit(node.callOptions.value) as ExpressionNode;
    if (node.callOptions?.gas) node.callOptions.gas = this.visit(node.callOptions.gas) as ExpressionNode;
    return node;
  }

  visitLowLevelCallStatement(node: LowLevelCallStatementNode): Node {
    node.targetExpression = this.visit(node.targetExpression) as ExpressionNode;
    node.data = this.visit(node.data) as ExpressionNode;
    if (node.callOptions?.value) node.callOptions.value = this.visit(node.callOptions.value) as ExpressionNode;
    if (node.callOptions?.gas) node.callOptions.gas = this.visit(node.callOptions.gas) as ExpressionNode;
    return node;
  }

  visitCollectionIteration(node: CollectionIterationNode): Node {
    node.body = this.visit(node.body) as BlockNode;
    return node;
  }

  visitUnchecked(node: UncheckedNode): Node {
    node.block = this.visit(node.block) as BlockNode;
    return node;
  }

  visitSwitch(node: SwitchNode): Node {
    node.expression = this.visit(node.expression) as ExpressionNode;
    node.cases = node.cases.map((c) => this.visit(c) as SwitchCaseNode);
    if (node.defaultCase) {
      node.defaultCase = this.visit(node.defaultCase) as BlockNode;
    }
    return node;
  }

  visitSwitchCase(node: SwitchCaseNode): Node {
    node.value = this.visit(node.value) as ExpressionNode;
    node.body = this.visit(node.body) as BlockNode;
    return node;
  }
}
