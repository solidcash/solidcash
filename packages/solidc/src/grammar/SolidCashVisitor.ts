// Generated from src/grammar/SolidCash.g4 by ANTLR 4.13.2

import {ParseTreeVisitor} from 'antlr4';


import { SourceFileContext } from "./SolidCashParser.js";
import { WildcardImportContext } from "./SolidCashParser.js";
import { NamespaceImportContext } from "./SolidCashParser.js";
import { SelectiveImportContext } from "./SolidCashParser.js";
import { ImportBindingContext } from "./SolidCashParser.js";
import { FreeFunctionDefinitionContext } from "./SolidCashParser.js";
import { UsingLibraryForContext } from "./SolidCashParser.js";
import { UsingFunctionsForContext } from "./SolidCashParser.js";
import { UsingFunctionBindingContext } from "./SolidCashParser.js";
import { UserDefinableOperatorContext } from "./SolidCashParser.js";
import { AnyIdentifierContext } from "./SolidCashParser.js";
import { PragmaDirectiveContext } from "./SolidCashParser.js";
import { PragmaNameContext } from "./SolidCashParser.js";
import { PragmaValueContext } from "./SolidCashParser.js";
import { VersionConstraintContext } from "./SolidCashParser.js";
import { VersionOperatorContext } from "./SolidCashParser.js";
import { InterfaceDefinitionContext } from "./SolidCashParser.js";
import { InterfaceCollectionContext } from "./SolidCashParser.js";
import { InterfaceStateVariableContext } from "./SolidCashParser.js";
import { InterfaceStateVariableVisibilityContext } from "./SolidCashParser.js";
import { InterfaceFunctionContext } from "./SolidCashParser.js";
import { LibraryDefinitionContext } from "./SolidCashParser.js";
import { ContractDefinitionContext } from "./SolidCashParser.js";
import { InheritanceSpecifierContext } from "./SolidCashParser.js";
import { AbstractFunctionDefinitionContext } from "./SolidCashParser.js";
import { EventDefinitionContext } from "./SolidCashParser.js";
import { EventParameterContext } from "./SolidCashParser.js";
import { ErrorDefinitionContext } from "./SolidCashParser.js";
import { ErrorParameterContext } from "./SolidCashParser.js";
import { StructDefinitionContext } from "./SolidCashParser.js";
import { StructFieldContext } from "./SolidCashParser.js";
import { EnumDefinitionContext } from "./SolidCashParser.js";
import { EnumMemberContext } from "./SolidCashParser.js";
import { TypeDefinitionContext } from "./SolidCashParser.js";
import { ConstantDefinitionContext } from "./SolidCashParser.js";
import { ConstructorDefinitionContext } from "./SolidCashParser.js";
import { FallbackDefinitionContext } from "./SolidCashParser.js";
import { FallbackModifierContext } from "./SolidCashParser.js";
import { ReceiveDefinitionContext } from "./SolidCashParser.js";
import { ReceiveModifierContext } from "./SolidCashParser.js";
import { ParentInvocationContext } from "./SolidCashParser.js";
import { StateVariableDeclarationContext } from "./SolidCashParser.js";
import { CollectionModifierContext } from "./SolidCashParser.js";
import { StateVariableVisibilityContext } from "./SolidCashParser.js";
import { MappingTypeContext } from "./SolidCashParser.js";
import { ArrayTypeContext } from "./SolidCashParser.js";
import { ModifierDefinitionContext } from "./SolidCashParser.js";
import { ModifierStatementContext } from "./SolidCashParser.js";
import { PlaceholderStatementContext } from "./SolidCashParser.js";
import { FunctionDefinitionContext } from "./SolidCashParser.js";
import { CustomModifierInvocationContext } from "./SolidCashParser.js";
import { FunctionModifierContext } from "./SolidCashParser.js";
import { OverrideSpecifierContext } from "./SolidCashParser.js";
import { UnsafeModifierContext } from "./SolidCashParser.js";
import { ReturnTypeContext } from "./SolidCashParser.js";
import { ReturnParamContext } from "./SolidCashParser.js";
import { ParameterListContext } from "./SolidCashParser.js";
import { ParameterContext } from "./SolidCashParser.js";
import { BlockContext } from "./SolidCashParser.js";
import { StatementContext } from "./SolidCashParser.js";
import { ExpressionStatementContext } from "./SolidCashParser.js";
import { PrefixIncDecStatementContext } from "./SolidCashParser.js";
import { ReturnStatementContext } from "./SolidCashParser.js";
import { SelfdestructStatementContext } from "./SolidCashParser.js";
import { EmitStatementContext } from "./SolidCashParser.js";
import { VariableDefinitionContext } from "./SolidCashParser.js";
import { TupleAssignmentContext } from "./SolidCashParser.js";
import { TupleSlotContext } from "./SolidCashParser.js";
import { PushArgumentContext } from "./SolidCashParser.js";
import { DeleteLocalContext } from "./SolidCashParser.js";
import { DeleteStateContext } from "./SolidCashParser.js";
import { DeleteMappingEntryContext } from "./SolidCashParser.js";
import { DeleteIndexedContext } from "./SolidCashParser.js";
import { DeleteMemberEntryContext } from "./SolidCashParser.js";
import { DeleteMemberContext } from "./SolidCashParser.js";
import { TimeOpStatementContext } from "./SolidCashParser.js";
import { RequireStatementContext } from "./SolidCashParser.js";
import { IfStatementContext } from "./SolidCashParser.js";
import { LoopStatementContext } from "./SolidCashParser.js";
import { ForOfEntriesStatementContext } from "./SolidCashParser.js";
import { ForInStatementContext } from "./SolidCashParser.js";
import { ForOfStatementContext } from "./SolidCashParser.js";
import { ForStatementContext } from "./SolidCashParser.js";
import { ForInitContext } from "./SolidCashParser.js";
import { ForConditionContext } from "./SolidCashParser.js";
import { ForUpdateContext } from "./SolidCashParser.js";
import { DoWhileStatementContext } from "./SolidCashParser.js";
import { WhileStatementContext } from "./SolidCashParser.js";
import { ConsoleStatementContext } from "./SolidCashParser.js";
import { AssemblyStatementContext } from "./SolidCashParser.js";
import { YulBlockContext } from "./SolidCashParser.js";
import { YulNestedBlockStmtContext } from "./SolidCashParser.js";
import { YulVarDeclStmtContext } from "./SolidCashParser.js";
import { YulAssignStmtContext } from "./SolidCashParser.js";
import { YulIfStmtContext } from "./SolidCashParser.js";
import { YulSwitchStmtContext } from "./SolidCashParser.js";
import { YulForStmtContext } from "./SolidCashParser.js";
import { YulFunctionDefStmtContext } from "./SolidCashParser.js";
import { YulBreakStmtContext } from "./SolidCashParser.js";
import { YulContinueStmtContext } from "./SolidCashParser.js";
import { YulLeaveStmtContext } from "./SolidCashParser.js";
import { YulCallStmtContext } from "./SolidCashParser.js";
import { YulPathStmtContext } from "./SolidCashParser.js";
import { YulLiteralStmtContext } from "./SolidCashParser.js";
import { YulVariableDeclarationContext } from "./SolidCashParser.js";
import { YulAssignmentContext } from "./SolidCashParser.js";
import { YulIfContext } from "./SolidCashParser.js";
import { YulSwitchContext } from "./SolidCashParser.js";
import { YulCaseContext } from "./SolidCashParser.js";
import { YulDefaultContext } from "./SolidCashParser.js";
import { YulForLoopContext } from "./SolidCashParser.js";
import { YulFunctionDefinitionContext } from "./SolidCashParser.js";
import { YulExpressionContext } from "./SolidCashParser.js";
import { YulFunctionCallContext } from "./SolidCashParser.js";
import { YulFunctionNameContext } from "./SolidCashParser.js";
import { YulPathContext } from "./SolidCashParser.js";
import { YulLiteralContext } from "./SolidCashParser.js";
import { UncheckedStatementContext } from "./SolidCashParser.js";
import { SwitchStatementContext } from "./SolidCashParser.js";
import { SwitchCaseContext } from "./SolidCashParser.js";
import { SwitchDefaultContext } from "./SolidCashParser.js";
import { TryCatchStatementContext } from "./SolidCashParser.js";
import { TryReturnsContext } from "./SolidCashParser.js";
import { CatchClauseContext } from "./SolidCashParser.js";
import { BreakStatementContext } from "./SolidCashParser.js";
import { ContinueStatementContext } from "./SolidCashParser.js";
import { RequireMessageContext } from "./SolidCashParser.js";
import { RevertStatementContext } from "./SolidCashParser.js";
import { AssertStatementContext } from "./SolidCashParser.js";
import { ConsoleParameterContext } from "./SolidCashParser.js";
import { ConsoleParameterListContext } from "./SolidCashParser.js";
import { FunctionCallContext } from "./SolidCashParser.js";
import { NamedArgContext } from "./SolidCashParser.js";
import { ExpressionListContext } from "./SolidCashParser.js";
import { CallOptionsContext } from "./SolidCashParser.js";
import { CallOptionContext } from "./SolidCashParser.js";
import { TypeListContext } from "./SolidCashParser.js";
import { TypeListItemContext } from "./SolidCashParser.js";
import { CastContext } from "./SolidCashParser.js";
import { AbiEncodeContext } from "./SolidCashParser.js";
import { TypeIntrospectionContext } from "./SolidCashParser.js";
import { OutStateMappingFieldAccessContext } from "./SolidCashParser.js";
import { TupleExpressionContext } from "./SolidCashParser.js";
import { AbiDecodeAtContext } from "./SolidCashParser.js";
import { MethodCallContext } from "./SolidCashParser.js";
import { FunctionCallExpressionContext } from "./SolidCashParser.js";
import { ArrayAccessContext } from "./SolidCashParser.js";
import { IdentifierContext } from "./SolidCashParser.js";
import { AssignmentExpressionContext } from "./SolidCashParser.js";
import { InstantiationWithOptionsContext } from "./SolidCashParser.js";
import { AbiEncodeWithSignatureContext } from "./SolidCashParser.js";
import { MappingAccessContext } from "./SolidCashParser.js";
import { InstantiationContext } from "./SolidCashParser.js";
import { AbiEncodeWithSelectorContext } from "./SolidCashParser.js";
import { ThisExprContext } from "./SolidCashParser.js";
import { NullaryOpContext } from "./SolidCashParser.js";
import { AbiDecodeContext } from "./SolidCashParser.js";
import { BinaryOpContext } from "./SolidCashParser.js";
import { UnaryIntrospectionOpContext } from "./SolidCashParser.js";
import { StringConcatContext } from "./SolidCashParser.js";
import { UnaryOpContext } from "./SolidCashParser.js";
import { PostfixOpContext } from "./SolidCashParser.js";
import { LiteralExpressionContext } from "./SolidCashParser.js";
import { BytesConcatContext } from "./SolidCashParser.js";
import { IndexRangeSliceContext } from "./SolidCashParser.js";
import { NewDynamicBytesContext } from "./SolidCashParser.js";
import { TernaryOpContext } from "./SolidCashParser.js";
import { ArrayContext } from "./SolidCashParser.js";
import { StateAccessContext } from "./SolidCashParser.js";
import { NewArrayContext } from "./SolidCashParser.js";
import { SliceContext } from "./SolidCashParser.js";
import { TupleIndexOpContext } from "./SolidCashParser.js";
import { MethodCallNamedContext } from "./SolidCashParser.js";
import { FieldAccessContext } from "./SolidCashParser.js";
import { AbiEncodePackedContext } from "./SolidCashParser.js";
import { AbiEncodeCallContext } from "./SolidCashParser.js";
import { ParenthesisedContext } from "./SolidCashParser.js";
import { PrefixOpContext } from "./SolidCashParser.js";
import { MemberNameContext } from "./SolidCashParser.js";
import { ModifierContext } from "./SolidCashParser.js";
import { LiteralContext } from "./SolidCashParser.js";
import { NumberLiteralContext } from "./SolidCashParser.js";
import { DecimalLiteralContext } from "./SolidCashParser.js";
import { TypeNameContext } from "./SolidCashParser.js";
import { TypeCastContext } from "./SolidCashParser.js";


/**
 * This interface defines a complete generic visitor for a parse tree produced
 * by `SolidCashParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export default class SolidCashVisitor<Result> extends ParseTreeVisitor<Result> {
	/**
	 * Visit a parse tree produced by `SolidCashParser.sourceFile`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSourceFile?: (ctx: SourceFileContext) => Result;
	/**
	 * Visit a parse tree produced by the `WildcardImport`
	 * labeled alternative in `SolidCashParser.importDirective`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitWildcardImport?: (ctx: WildcardImportContext) => Result;
	/**
	 * Visit a parse tree produced by the `NamespaceImport`
	 * labeled alternative in `SolidCashParser.importDirective`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNamespaceImport?: (ctx: NamespaceImportContext) => Result;
	/**
	 * Visit a parse tree produced by the `SelectiveImport`
	 * labeled alternative in `SolidCashParser.importDirective`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSelectiveImport?: (ctx: SelectiveImportContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.importBinding`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitImportBinding?: (ctx: ImportBindingContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.freeFunctionDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFreeFunctionDefinition?: (ctx: FreeFunctionDefinitionContext) => Result;
	/**
	 * Visit a parse tree produced by the `UsingLibraryFor`
	 * labeled alternative in `SolidCashParser.usingForDirective`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitUsingLibraryFor?: (ctx: UsingLibraryForContext) => Result;
	/**
	 * Visit a parse tree produced by the `UsingFunctionsFor`
	 * labeled alternative in `SolidCashParser.usingForDirective`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitUsingFunctionsFor?: (ctx: UsingFunctionsForContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.usingFunctionBinding`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitUsingFunctionBinding?: (ctx: UsingFunctionBindingContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.userDefinableOperator`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitUserDefinableOperator?: (ctx: UserDefinableOperatorContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.anyIdentifier`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAnyIdentifier?: (ctx: AnyIdentifierContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.pragmaDirective`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPragmaDirective?: (ctx: PragmaDirectiveContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.pragmaName`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPragmaName?: (ctx: PragmaNameContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.pragmaValue`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPragmaValue?: (ctx: PragmaValueContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.versionConstraint`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitVersionConstraint?: (ctx: VersionConstraintContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.versionOperator`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitVersionOperator?: (ctx: VersionOperatorContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.interfaceDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitInterfaceDefinition?: (ctx: InterfaceDefinitionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.interfaceCollection`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitInterfaceCollection?: (ctx: InterfaceCollectionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.interfaceStateVariable`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitInterfaceStateVariable?: (ctx: InterfaceStateVariableContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.interfaceStateVariableVisibility`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitInterfaceStateVariableVisibility?: (ctx: InterfaceStateVariableVisibilityContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.interfaceFunction`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitInterfaceFunction?: (ctx: InterfaceFunctionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.libraryDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLibraryDefinition?: (ctx: LibraryDefinitionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.contractDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitContractDefinition?: (ctx: ContractDefinitionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.inheritanceSpecifier`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitInheritanceSpecifier?: (ctx: InheritanceSpecifierContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.abstractFunctionDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAbstractFunctionDefinition?: (ctx: AbstractFunctionDefinitionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.eventDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitEventDefinition?: (ctx: EventDefinitionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.eventParameter`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitEventParameter?: (ctx: EventParameterContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.errorDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitErrorDefinition?: (ctx: ErrorDefinitionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.errorParameter`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitErrorParameter?: (ctx: ErrorParameterContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.structDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStructDefinition?: (ctx: StructDefinitionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.structField`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStructField?: (ctx: StructFieldContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.enumDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitEnumDefinition?: (ctx: EnumDefinitionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.enumMember`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitEnumMember?: (ctx: EnumMemberContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.typeDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeDefinition?: (ctx: TypeDefinitionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.constantDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitConstantDefinition?: (ctx: ConstantDefinitionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.constructorDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitConstructorDefinition?: (ctx: ConstructorDefinitionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.fallbackDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFallbackDefinition?: (ctx: FallbackDefinitionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.fallbackModifier`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFallbackModifier?: (ctx: FallbackModifierContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.receiveDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReceiveDefinition?: (ctx: ReceiveDefinitionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.receiveModifier`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReceiveModifier?: (ctx: ReceiveModifierContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.parentInvocation`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitParentInvocation?: (ctx: ParentInvocationContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.stateVariableDeclaration`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStateVariableDeclaration?: (ctx: StateVariableDeclarationContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.collectionModifier`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCollectionModifier?: (ctx: CollectionModifierContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.stateVariableVisibility`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStateVariableVisibility?: (ctx: StateVariableVisibilityContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.mappingType`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMappingType?: (ctx: MappingTypeContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.arrayType`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitArrayType?: (ctx: ArrayTypeContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.modifierDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitModifierDefinition?: (ctx: ModifierDefinitionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.modifierStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitModifierStatement?: (ctx: ModifierStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.placeholderStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPlaceholderStatement?: (ctx: PlaceholderStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.functionDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFunctionDefinition?: (ctx: FunctionDefinitionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.customModifierInvocation`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCustomModifierInvocation?: (ctx: CustomModifierInvocationContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.functionModifier`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFunctionModifier?: (ctx: FunctionModifierContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.overrideSpecifier`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitOverrideSpecifier?: (ctx: OverrideSpecifierContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.unsafeModifier`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitUnsafeModifier?: (ctx: UnsafeModifierContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.returnType`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReturnType?: (ctx: ReturnTypeContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.returnParam`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReturnParam?: (ctx: ReturnParamContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.parameterList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitParameterList?: (ctx: ParameterListContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.parameter`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitParameter?: (ctx: ParameterContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.block`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBlock?: (ctx: BlockContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.statement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStatement?: (ctx: StatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.expressionStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExpressionStatement?: (ctx: ExpressionStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.prefixIncDecStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPrefixIncDecStatement?: (ctx: PrefixIncDecStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.returnStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReturnStatement?: (ctx: ReturnStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.selfdestructStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSelfdestructStatement?: (ctx: SelfdestructStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.emitStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitEmitStatement?: (ctx: EmitStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.variableDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitVariableDefinition?: (ctx: VariableDefinitionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.tupleAssignment`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTupleAssignment?: (ctx: TupleAssignmentContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.tupleSlot`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTupleSlot?: (ctx: TupleSlotContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.pushArgument`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPushArgument?: (ctx: PushArgumentContext) => Result;
	/**
	 * Visit a parse tree produced by the `DeleteLocal`
	 * labeled alternative in `SolidCashParser.deleteStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDeleteLocal?: (ctx: DeleteLocalContext) => Result;
	/**
	 * Visit a parse tree produced by the `DeleteState`
	 * labeled alternative in `SolidCashParser.deleteStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDeleteState?: (ctx: DeleteStateContext) => Result;
	/**
	 * Visit a parse tree produced by the `DeleteMappingEntry`
	 * labeled alternative in `SolidCashParser.deleteStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDeleteMappingEntry?: (ctx: DeleteMappingEntryContext) => Result;
	/**
	 * Visit a parse tree produced by the `DeleteIndexed`
	 * labeled alternative in `SolidCashParser.deleteStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDeleteIndexed?: (ctx: DeleteIndexedContext) => Result;
	/**
	 * Visit a parse tree produced by the `DeleteMemberEntry`
	 * labeled alternative in `SolidCashParser.deleteStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDeleteMemberEntry?: (ctx: DeleteMemberEntryContext) => Result;
	/**
	 * Visit a parse tree produced by the `DeleteMember`
	 * labeled alternative in `SolidCashParser.deleteStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDeleteMember?: (ctx: DeleteMemberContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.timeOpStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTimeOpStatement?: (ctx: TimeOpStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.requireStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitRequireStatement?: (ctx: RequireStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.ifStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitIfStatement?: (ctx: IfStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.loopStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLoopStatement?: (ctx: LoopStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.forOfEntriesStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitForOfEntriesStatement?: (ctx: ForOfEntriesStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.forInStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitForInStatement?: (ctx: ForInStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.forOfStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitForOfStatement?: (ctx: ForOfStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.forStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitForStatement?: (ctx: ForStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.forInit`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitForInit?: (ctx: ForInitContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.forCondition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitForCondition?: (ctx: ForConditionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.forUpdate`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitForUpdate?: (ctx: ForUpdateContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.doWhileStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDoWhileStatement?: (ctx: DoWhileStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.whileStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitWhileStatement?: (ctx: WhileStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.consoleStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitConsoleStatement?: (ctx: ConsoleStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.assemblyStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAssemblyStatement?: (ctx: AssemblyStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.yulBlock`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulBlock?: (ctx: YulBlockContext) => Result;
	/**
	 * Visit a parse tree produced by the `YulNestedBlockStmt`
	 * labeled alternative in `SolidCashParser.yulStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulNestedBlockStmt?: (ctx: YulNestedBlockStmtContext) => Result;
	/**
	 * Visit a parse tree produced by the `YulVarDeclStmt`
	 * labeled alternative in `SolidCashParser.yulStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulVarDeclStmt?: (ctx: YulVarDeclStmtContext) => Result;
	/**
	 * Visit a parse tree produced by the `YulAssignStmt`
	 * labeled alternative in `SolidCashParser.yulStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulAssignStmt?: (ctx: YulAssignStmtContext) => Result;
	/**
	 * Visit a parse tree produced by the `YulIfStmt`
	 * labeled alternative in `SolidCashParser.yulStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulIfStmt?: (ctx: YulIfStmtContext) => Result;
	/**
	 * Visit a parse tree produced by the `YulSwitchStmt`
	 * labeled alternative in `SolidCashParser.yulStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulSwitchStmt?: (ctx: YulSwitchStmtContext) => Result;
	/**
	 * Visit a parse tree produced by the `YulForStmt`
	 * labeled alternative in `SolidCashParser.yulStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulForStmt?: (ctx: YulForStmtContext) => Result;
	/**
	 * Visit a parse tree produced by the `YulFunctionDefStmt`
	 * labeled alternative in `SolidCashParser.yulStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulFunctionDefStmt?: (ctx: YulFunctionDefStmtContext) => Result;
	/**
	 * Visit a parse tree produced by the `YulBreakStmt`
	 * labeled alternative in `SolidCashParser.yulStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulBreakStmt?: (ctx: YulBreakStmtContext) => Result;
	/**
	 * Visit a parse tree produced by the `YulContinueStmt`
	 * labeled alternative in `SolidCashParser.yulStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulContinueStmt?: (ctx: YulContinueStmtContext) => Result;
	/**
	 * Visit a parse tree produced by the `YulLeaveStmt`
	 * labeled alternative in `SolidCashParser.yulStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulLeaveStmt?: (ctx: YulLeaveStmtContext) => Result;
	/**
	 * Visit a parse tree produced by the `YulCallStmt`
	 * labeled alternative in `SolidCashParser.yulStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulCallStmt?: (ctx: YulCallStmtContext) => Result;
	/**
	 * Visit a parse tree produced by the `YulPathStmt`
	 * labeled alternative in `SolidCashParser.yulStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulPathStmt?: (ctx: YulPathStmtContext) => Result;
	/**
	 * Visit a parse tree produced by the `YulLiteralStmt`
	 * labeled alternative in `SolidCashParser.yulStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulLiteralStmt?: (ctx: YulLiteralStmtContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.yulVariableDeclaration`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulVariableDeclaration?: (ctx: YulVariableDeclarationContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.yulAssignment`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulAssignment?: (ctx: YulAssignmentContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.yulIf`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulIf?: (ctx: YulIfContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.yulSwitch`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulSwitch?: (ctx: YulSwitchContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.yulCase`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulCase?: (ctx: YulCaseContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.yulDefault`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulDefault?: (ctx: YulDefaultContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.yulForLoop`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulForLoop?: (ctx: YulForLoopContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.yulFunctionDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulFunctionDefinition?: (ctx: YulFunctionDefinitionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.yulExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulExpression?: (ctx: YulExpressionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.yulFunctionCall`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulFunctionCall?: (ctx: YulFunctionCallContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.yulFunctionName`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulFunctionName?: (ctx: YulFunctionNameContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.yulPath`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulPath?: (ctx: YulPathContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.yulLiteral`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitYulLiteral?: (ctx: YulLiteralContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.uncheckedStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitUncheckedStatement?: (ctx: UncheckedStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.switchStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSwitchStatement?: (ctx: SwitchStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.switchCase`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSwitchCase?: (ctx: SwitchCaseContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.switchDefault`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSwitchDefault?: (ctx: SwitchDefaultContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.tryCatchStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTryCatchStatement?: (ctx: TryCatchStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.tryReturns`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTryReturns?: (ctx: TryReturnsContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.catchClause`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCatchClause?: (ctx: CatchClauseContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.breakStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBreakStatement?: (ctx: BreakStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.continueStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitContinueStatement?: (ctx: ContinueStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.requireMessage`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitRequireMessage?: (ctx: RequireMessageContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.revertStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitRevertStatement?: (ctx: RevertStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.assertStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAssertStatement?: (ctx: AssertStatementContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.consoleParameter`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitConsoleParameter?: (ctx: ConsoleParameterContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.consoleParameterList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitConsoleParameterList?: (ctx: ConsoleParameterListContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.functionCall`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFunctionCall?: (ctx: FunctionCallContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.namedArg`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNamedArg?: (ctx: NamedArgContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.expressionList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExpressionList?: (ctx: ExpressionListContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.callOptions`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCallOptions?: (ctx: CallOptionsContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.callOption`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCallOption?: (ctx: CallOptionContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.typeList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeList?: (ctx: TypeListContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.typeListItem`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeListItem?: (ctx: TypeListItemContext) => Result;
	/**
	 * Visit a parse tree produced by the `Cast`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCast?: (ctx: CastContext) => Result;
	/**
	 * Visit a parse tree produced by the `AbiEncode`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAbiEncode?: (ctx: AbiEncodeContext) => Result;
	/**
	 * Visit a parse tree produced by the `TypeIntrospection`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeIntrospection?: (ctx: TypeIntrospectionContext) => Result;
	/**
	 * Visit a parse tree produced by the `OutStateMappingFieldAccess`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitOutStateMappingFieldAccess?: (ctx: OutStateMappingFieldAccessContext) => Result;
	/**
	 * Visit a parse tree produced by the `TupleExpression`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTupleExpression?: (ctx: TupleExpressionContext) => Result;
	/**
	 * Visit a parse tree produced by the `AbiDecodeAt`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAbiDecodeAt?: (ctx: AbiDecodeAtContext) => Result;
	/**
	 * Visit a parse tree produced by the `MethodCall`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMethodCall?: (ctx: MethodCallContext) => Result;
	/**
	 * Visit a parse tree produced by the `FunctionCallExpression`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFunctionCallExpression?: (ctx: FunctionCallExpressionContext) => Result;
	/**
	 * Visit a parse tree produced by the `ArrayAccess`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitArrayAccess?: (ctx: ArrayAccessContext) => Result;
	/**
	 * Visit a parse tree produced by the `Identifier`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitIdentifier?: (ctx: IdentifierContext) => Result;
	/**
	 * Visit a parse tree produced by the `AssignmentExpression`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAssignmentExpression?: (ctx: AssignmentExpressionContext) => Result;
	/**
	 * Visit a parse tree produced by the `InstantiationWithOptions`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitInstantiationWithOptions?: (ctx: InstantiationWithOptionsContext) => Result;
	/**
	 * Visit a parse tree produced by the `AbiEncodeWithSignature`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAbiEncodeWithSignature?: (ctx: AbiEncodeWithSignatureContext) => Result;
	/**
	 * Visit a parse tree produced by the `MappingAccess`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMappingAccess?: (ctx: MappingAccessContext) => Result;
	/**
	 * Visit a parse tree produced by the `Instantiation`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitInstantiation?: (ctx: InstantiationContext) => Result;
	/**
	 * Visit a parse tree produced by the `AbiEncodeWithSelector`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAbiEncodeWithSelector?: (ctx: AbiEncodeWithSelectorContext) => Result;
	/**
	 * Visit a parse tree produced by the `ThisExpr`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitThisExpr?: (ctx: ThisExprContext) => Result;
	/**
	 * Visit a parse tree produced by the `NullaryOp`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNullaryOp?: (ctx: NullaryOpContext) => Result;
	/**
	 * Visit a parse tree produced by the `AbiDecode`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAbiDecode?: (ctx: AbiDecodeContext) => Result;
	/**
	 * Visit a parse tree produced by the `BinaryOp`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBinaryOp?: (ctx: BinaryOpContext) => Result;
	/**
	 * Visit a parse tree produced by the `UnaryIntrospectionOp`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitUnaryIntrospectionOp?: (ctx: UnaryIntrospectionOpContext) => Result;
	/**
	 * Visit a parse tree produced by the `StringConcat`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStringConcat?: (ctx: StringConcatContext) => Result;
	/**
	 * Visit a parse tree produced by the `UnaryOp`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitUnaryOp?: (ctx: UnaryOpContext) => Result;
	/**
	 * Visit a parse tree produced by the `PostfixOp`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPostfixOp?: (ctx: PostfixOpContext) => Result;
	/**
	 * Visit a parse tree produced by the `LiteralExpression`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLiteralExpression?: (ctx: LiteralExpressionContext) => Result;
	/**
	 * Visit a parse tree produced by the `BytesConcat`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBytesConcat?: (ctx: BytesConcatContext) => Result;
	/**
	 * Visit a parse tree produced by the `IndexRangeSlice`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitIndexRangeSlice?: (ctx: IndexRangeSliceContext) => Result;
	/**
	 * Visit a parse tree produced by the `NewDynamicBytes`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNewDynamicBytes?: (ctx: NewDynamicBytesContext) => Result;
	/**
	 * Visit a parse tree produced by the `TernaryOp`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTernaryOp?: (ctx: TernaryOpContext) => Result;
	/**
	 * Visit a parse tree produced by the `Array`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitArray?: (ctx: ArrayContext) => Result;
	/**
	 * Visit a parse tree produced by the `StateAccess`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStateAccess?: (ctx: StateAccessContext) => Result;
	/**
	 * Visit a parse tree produced by the `NewArray`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNewArray?: (ctx: NewArrayContext) => Result;
	/**
	 * Visit a parse tree produced by the `Slice`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSlice?: (ctx: SliceContext) => Result;
	/**
	 * Visit a parse tree produced by the `TupleIndexOp`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTupleIndexOp?: (ctx: TupleIndexOpContext) => Result;
	/**
	 * Visit a parse tree produced by the `MethodCallNamed`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMethodCallNamed?: (ctx: MethodCallNamedContext) => Result;
	/**
	 * Visit a parse tree produced by the `FieldAccess`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFieldAccess?: (ctx: FieldAccessContext) => Result;
	/**
	 * Visit a parse tree produced by the `AbiEncodePacked`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAbiEncodePacked?: (ctx: AbiEncodePackedContext) => Result;
	/**
	 * Visit a parse tree produced by the `AbiEncodeCall`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAbiEncodeCall?: (ctx: AbiEncodeCallContext) => Result;
	/**
	 * Visit a parse tree produced by the `Parenthesised`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitParenthesised?: (ctx: ParenthesisedContext) => Result;
	/**
	 * Visit a parse tree produced by the `PrefixOp`
	 * labeled alternative in `SolidCashParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPrefixOp?: (ctx: PrefixOpContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.memberName`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMemberName?: (ctx: MemberNameContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.modifier`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitModifier?: (ctx: ModifierContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.literal`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLiteral?: (ctx: LiteralContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.numberLiteral`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNumberLiteral?: (ctx: NumberLiteralContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.decimalLiteral`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDecimalLiteral?: (ctx: DecimalLiteralContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.typeName`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeName?: (ctx: TypeNameContext) => Result;
	/**
	 * Visit a parse tree produced by `SolidCashParser.typeCast`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeCast?: (ctx: TypeCastContext) => Result;
}

