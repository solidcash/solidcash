import {
  Node,
  SourceFileNode,
  ContractNode,
  ParameterNode,
  VariableDefinitionNode,
  FunctionDefinitionNode,
  AssignNode,
  IdentifierNode,
  BranchNode,
  CastNode,
  FunctionCallNode,
  UnaryOpNode,
  BinaryOpNode,
  BoolLiteralNode,
  IntLiteralNode,
  DecimalLiteralNode,
  HexLiteralNode,
  StringLiteralNode,
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
  TokenContainerMethodStatementNode,
  ReturnNode,
  FunctionCallStatementNode,
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
  AddressConnectNode,
  MethodCallStatementNode,
  LowLevelCallNode,
  LowLevelCallStatementNode,
  CollectionIterationNode,
  TypeIntrospectionNode,
  UncheckedNode,
  SwitchNode,
  SwitchCaseNode,
  UsingForDirectiveNode,
} from './AST.js';

export default abstract class AstVisitor<T> {
  abstract visitSourceFile(node: SourceFileNode): T;
  abstract visitContract(node: ContractNode): T;
  abstract visitConstantDefinition(node: ConstantDefinitionNode): T;
  abstract visitFunctionDefinition(node: FunctionDefinitionNode): T;
  abstract visitParameter(node: ParameterNode): T;
  abstract visitStateVariable(node: StateVariableNode): T;
  abstract visitStateAccess(node: StateAccessNode): T;
  abstract visitStateAssign(node: StateAssignNode): T;
  abstract visitCollection(node: CollectionNode): T;
  abstract visitMappingAccess(node: MappingAccessNode): T;
  abstract visitMappingAssign(node: MappingAssignNode): T;
  abstract visitMappingFieldAssign(node: MappingFieldAssignNode): T;
  abstract visitDeleteLocal(node: DeleteLocalNode): T;
  abstract visitDeleteState(node: DeleteStateNode): T;
  abstract visitMappingDelete(node: MappingDeleteNode): T;
  abstract visitVariableDefinition(node: VariableDefinitionNode): T;
  abstract visitTupleAssignment(node: TupleAssignmentNode): T;
  abstract visitAssign(node: AssignNode): T;
  abstract visitTimeOp(node: TimeOpNode): T;
  abstract visitRequire(node: RequireNode): T;
  abstract visitBranch(node: BranchNode): T;
  abstract visitTryCatch(node: TryCatchNode): T;
  abstract visitCatchClause(node: CatchClauseNode): T;
  abstract visitDoWhile(node: DoWhileNode): T;
  abstract visitWhile(node: WhileNode): T;
  abstract visitAssemblyStatement(node: AssemblyStatementNode): T;
  abstract visitBlock(node: BlockNode): T;
  abstract visitCast(node: CastNode): T;
  abstract visitFunctionCall(node: FunctionCallNode): T;
  abstract visitInstantiation(node: InstantiationNode): T;
  abstract visitSlice(node: SliceNode): T;
  abstract visitTupleIndexOp(node: TupleIndexOpNode): T;
  abstract visitBinaryOp(node: BinaryOpNode): T;
  abstract visitUnaryOp(node: UnaryOpNode): T;
  abstract visitNullaryOp(node: NullaryOpNode): T;
  abstract visitTernaryOp(node: TernaryOpNode): T;
  abstract visitArray(node: ArrayNode): T;
  abstract visitNewArray(node: NewArrayNode): T;
  abstract visitArrayAccess(node: ArrayAccessNode): T;
  abstract visitArrayPush(node: ArrayPushNode): T;
  abstract visitArrayPop(node: ArrayPopNode): T;
  abstract visitArrayAssign(node: ArrayAssignNode): T;
  abstract visitArrayDelete(node: ArrayDeleteNode): T;
  abstract visitStateArrayPush(node: StateArrayPushNode): T;
  abstract visitStateArrayPop(node: StateArrayPopNode): T;
  abstract visitStateArrayAssign(node: StateArrayAssignNode): T;
  abstract visitStateArrayDelete(node: StateArrayDeleteNode): T;
  abstract visitIdentifier(node: IdentifierNode): T;
  abstract visitBoolLiteral(node: BoolLiteralNode): T;
  abstract visitIntLiteral(node: IntLiteralNode): T;
  abstract visitDecimalLiteral(node: DecimalLiteralNode): T;
  abstract visitStringLiteral(node: StringLiteralNode): T;
  abstract visitHexLiteral(node: HexLiteralNode): T;
  abstract visitAbiEncode(node: AbiEncodeNode): T;
  abstract visitAbiEncodePacked(node: AbiEncodePackedNode): T;
  abstract visitAbiEncodeWithSelector(node: AbiEncodeWithSelectorNode): T;
  abstract visitAbiEncodeWithSignature(node: AbiEncodeWithSignatureNode): T;
  abstract visitAbiEncodeCall(node: AbiEncodeCallNode): T;
  abstract visitBytesConcat(node: BytesConcatNode): T;
  abstract visitStringConcat(node: StringConcatNode): T;
  abstract visitAbiDecode(node: AbiDecodeNode): T;
  abstract visitAbiDecodeAt(node: AbiDecodeAtNode): T;
  abstract visitStructDefinition(node: StructDefinitionNode): T;
  abstract visitEnumDefinition(node: EnumDefinitionNode): T;
  abstract visitTypeDefinition(node: TypeDefinitionNode): T;
  abstract visitUsingForDirective(node: UsingForDirectiveNode): T;
  abstract visitFieldAccess(node: FieldAccessNode): T;
  abstract visitTypeIntrospection(node: TypeIntrospectionNode): T;
  abstract visitConsoleStatement(node: ConsoleStatementNode): T;
  abstract visitEventDefinition(node: EventDefinitionNode): T;
  abstract visitErrorDefinition(node: ErrorDefinitionNode): T;
  abstract visitEmitStatement(node: EmitStatementNode): T;
  abstract visitRevert(node: RevertNode): T;
  abstract visitAssert(node: AssertNode): T;
  abstract visitTransferStatement(node: TransferStatementNode): T;
  abstract visitTokenContainerMethodStatement(node: TokenContainerMethodStatementNode): T;
  abstract visitReturn(node: ReturnNode): T;
  abstract visitFunctionCallStatement(node: FunctionCallStatementNode): T;
  abstract visitMethodCallStatement(node: MethodCallStatementNode): T;
  abstract visitBreak(node: BreakNode): T;
  abstract visitContinue(node: ContinueNode): T;
  abstract visitImport(node: ImportNode): T;
  abstract visitContractReference(node: ContractReferenceNode): T;
  abstract visitInterfaceDefinition(node: InterfaceNode): T;
  abstract visitInterfaceStateVariable(node: InterfaceStateVariableNode): T;
  abstract visitInterfaceCollection(node: InterfaceCollectionNode): T;
  abstract visitInterfaceFunction(node: InterfaceFunctionNode): T;
  abstract visitExternalStateAccess(node: ExternalStateAccessNode): T;
  abstract visitExternalMappingAccess(node: ExternalMappingAccessNode): T;
  abstract visitExternalFunctionCall(node: ExternalFunctionCallNode): T;
  abstract visitExternalOutputState(node: ExternalOutputStateNode): T;
  abstract visitExternalOutputStateAccess(node: ExternalOutputStateAccessNode): T;
  abstract visitMethodCall(node: MethodCallNode): T;
  abstract visitAddressTransferStatement(node: AddressTransferStatementNode): T;
  abstract visitAddressSendExpression(node: AddressSendExpressionNode): T;
  abstract visitAddressConnect(node: AddressConnectNode): T;
  abstract visitLowLevelCall(node: LowLevelCallNode): T;
  abstract visitLowLevelCallStatement(node: LowLevelCallStatementNode): T;
  abstract visitCollectionIteration(node: CollectionIterationNode): T;
  abstract visitUnchecked(node: UncheckedNode): T;
  abstract visitSwitch(node: SwitchNode): T;
  abstract visitSwitchCase(node: SwitchCaseNode): T;

  visit(node: Node): T {
    return node.accept(this);
  }

  visitOptional(node?: Node): T | undefined {
    return node && this.visit(node);
  }

  visitList(nodes: Node[]): T[] {
    return nodes.map((n) => this.visit(n));
  }

  visitOptionalList(nodes?: Node[]): T[] | undefined {
    return nodes && this.visitList(nodes);
  }
}
