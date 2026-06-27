// Generated from src/grammar/SolidCash.g4 by ANTLR 4.13.2
// noinspection ES6UnusedImports,JSUnusedGlobalSymbols,JSUnusedLocalSymbols

import {
	ATN,
	ATNDeserializer, DecisionState, DFA, FailedPredicateException,
	RecognitionException, NoViableAltException, BailErrorStrategy,
	Parser, ParserATNSimulator,
	RuleContext, ParserRuleContext, PredictionMode, PredictionContextCache,
	TerminalNode, RuleNode,
	Token, TokenStream,
	Interval, IntervalSet
} from 'antlr4';
import SolidCashVisitor from "./SolidCashVisitor.js";

// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;

export default class SolidCashParser extends Parser {
	public static readonly T__0 = 1;
	public static readonly T__1 = 2;
	public static readonly T__2 = 3;
	public static readonly T__3 = 4;
	public static readonly T__4 = 5;
	public static readonly T__5 = 6;
	public static readonly T__6 = 7;
	public static readonly T__7 = 8;
	public static readonly T__8 = 9;
	public static readonly T__9 = 10;
	public static readonly T__10 = 11;
	public static readonly T__11 = 12;
	public static readonly T__12 = 13;
	public static readonly T__13 = 14;
	public static readonly T__14 = 15;
	public static readonly T__15 = 16;
	public static readonly T__16 = 17;
	public static readonly T__17 = 18;
	public static readonly T__18 = 19;
	public static readonly T__19 = 20;
	public static readonly T__20 = 21;
	public static readonly T__21 = 22;
	public static readonly T__22 = 23;
	public static readonly T__23 = 24;
	public static readonly T__24 = 25;
	public static readonly T__25 = 26;
	public static readonly T__26 = 27;
	public static readonly T__27 = 28;
	public static readonly T__28 = 29;
	public static readonly T__29 = 30;
	public static readonly T__30 = 31;
	public static readonly T__31 = 32;
	public static readonly T__32 = 33;
	public static readonly T__33 = 34;
	public static readonly T__34 = 35;
	public static readonly T__35 = 36;
	public static readonly T__36 = 37;
	public static readonly T__37 = 38;
	public static readonly T__38 = 39;
	public static readonly T__39 = 40;
	public static readonly T__40 = 41;
	public static readonly T__41 = 42;
	public static readonly T__42 = 43;
	public static readonly T__43 = 44;
	public static readonly T__44 = 45;
	public static readonly T__45 = 46;
	public static readonly T__46 = 47;
	public static readonly T__47 = 48;
	public static readonly T__48 = 49;
	public static readonly T__49 = 50;
	public static readonly T__50 = 51;
	public static readonly T__51 = 52;
	public static readonly T__52 = 53;
	public static readonly T__53 = 54;
	public static readonly T__54 = 55;
	public static readonly T__55 = 56;
	public static readonly T__56 = 57;
	public static readonly T__57 = 58;
	public static readonly T__58 = 59;
	public static readonly T__59 = 60;
	public static readonly T__60 = 61;
	public static readonly T__61 = 62;
	public static readonly T__62 = 63;
	public static readonly T__63 = 64;
	public static readonly T__64 = 65;
	public static readonly T__65 = 66;
	public static readonly T__66 = 67;
	public static readonly T__67 = 68;
	public static readonly T__68 = 69;
	public static readonly T__69 = 70;
	public static readonly T__70 = 71;
	public static readonly T__71 = 72;
	public static readonly T__72 = 73;
	public static readonly T__73 = 74;
	public static readonly T__74 = 75;
	public static readonly T__75 = 76;
	public static readonly T__76 = 77;
	public static readonly T__77 = 78;
	public static readonly T__78 = 79;
	public static readonly T__79 = 80;
	public static readonly T__80 = 81;
	public static readonly T__81 = 82;
	public static readonly T__82 = 83;
	public static readonly T__83 = 84;
	public static readonly T__84 = 85;
	public static readonly T__85 = 86;
	public static readonly T__86 = 87;
	public static readonly T__87 = 88;
	public static readonly T__88 = 89;
	public static readonly T__89 = 90;
	public static readonly T__90 = 91;
	public static readonly T__91 = 92;
	public static readonly T__92 = 93;
	public static readonly T__93 = 94;
	public static readonly T__94 = 95;
	public static readonly T__95 = 96;
	public static readonly T__96 = 97;
	public static readonly T__97 = 98;
	public static readonly T__98 = 99;
	public static readonly T__99 = 100;
	public static readonly T__100 = 101;
	public static readonly T__101 = 102;
	public static readonly T__102 = 103;
	public static readonly T__103 = 104;
	public static readonly T__104 = 105;
	public static readonly T__105 = 106;
	public static readonly T__106 = 107;
	public static readonly T__107 = 108;
	public static readonly T__108 = 109;
	public static readonly T__109 = 110;
	public static readonly T__110 = 111;
	public static readonly T__111 = 112;
	public static readonly T__112 = 113;
	public static readonly T__113 = 114;
	public static readonly T__114 = 115;
	public static readonly T__115 = 116;
	public static readonly T__116 = 117;
	public static readonly T__117 = 118;
	public static readonly T__118 = 119;
	public static readonly T__119 = 120;
	public static readonly T__120 = 121;
	public static readonly T__121 = 122;
	public static readonly T__122 = 123;
	public static readonly T__123 = 124;
	public static readonly T__124 = 125;
	public static readonly T__125 = 126;
	public static readonly T__126 = 127;
	public static readonly T__127 = 128;
	public static readonly T__128 = 129;
	public static readonly T__129 = 130;
	public static readonly T__130 = 131;
	public static readonly T__131 = 132;
	public static readonly T__132 = 133;
	public static readonly T__133 = 134;
	public static readonly T__134 = 135;
	public static readonly T__135 = 136;
	public static readonly T__136 = 137;
	public static readonly T__137 = 138;
	public static readonly T__138 = 139;
	public static readonly T__139 = 140;
	public static readonly T__140 = 141;
	public static readonly T__141 = 142;
	public static readonly T__142 = 143;
	public static readonly T__143 = 144;
	public static readonly T__144 = 145;
	public static readonly T__145 = 146;
	public static readonly T__146 = 147;
	public static readonly T__147 = 148;
	public static readonly T__148 = 149;
	public static readonly T__149 = 150;
	public static readonly T__150 = 151;
	public static readonly T__151 = 152;
	public static readonly VersionLiteral = 153;
	public static readonly BooleanLiteral = 154;
	public static readonly NumberUnit = 155;
	public static readonly BchUnit = 156;
	public static readonly DecimalLiteral = 157;
	public static readonly NumberLiteral = 158;
	public static readonly PrimitiveType = 159;
	public static readonly CryptoType = 160;
	public static readonly UnboundedBytes = 161;
	public static readonly BoundedBytes = 162;
	public static readonly Bound = 163;
	public static readonly StringLiteral = 164;
	public static readonly DateLiteral = 165;
	public static readonly HexLiteral = 166;
	public static readonly TxVar = 167;
	public static readonly UnsafeCast = 168;
	public static readonly BoundedSignedInt = 169;
	public static readonly BoundedUnsignedInt = 170;
	public static readonly BoundedSignedFixed = 171;
	public static readonly BoundedUnsignedFixed = 172;
	public static readonly NullaryOp = 173;
	public static readonly UnicodeLiteral = 174;
	public static readonly HexStringLiteral = 175;
	public static readonly Identifier = 176;
	public static readonly WHITESPACE = 177;
	public static readonly COMMENT = 178;
	public static readonly LINE_COMMENT = 179;
	public static override readonly EOF = Token.EOF;
	public static readonly RULE_sourceFile = 0;
	public static readonly RULE_importDirective = 1;
	public static readonly RULE_importBinding = 2;
	public static readonly RULE_freeFunctionDefinition = 3;
	public static readonly RULE_usingForDirective = 4;
	public static readonly RULE_usingFunctionBinding = 5;
	public static readonly RULE_userDefinableOperator = 6;
	public static readonly RULE_anyIdentifier = 7;
	public static readonly RULE_pragmaDirective = 8;
	public static readonly RULE_pragmaName = 9;
	public static readonly RULE_pragmaValue = 10;
	public static readonly RULE_versionConstraint = 11;
	public static readonly RULE_versionOperator = 12;
	public static readonly RULE_interfaceDefinition = 13;
	public static readonly RULE_interfaceCollection = 14;
	public static readonly RULE_interfaceStateVariable = 15;
	public static readonly RULE_interfaceStateVariableVisibility = 16;
	public static readonly RULE_interfaceFunction = 17;
	public static readonly RULE_libraryDefinition = 18;
	public static readonly RULE_contractDefinition = 19;
	public static readonly RULE_inheritanceSpecifier = 20;
	public static readonly RULE_abstractFunctionDefinition = 21;
	public static readonly RULE_eventDefinition = 22;
	public static readonly RULE_eventParameter = 23;
	public static readonly RULE_errorDefinition = 24;
	public static readonly RULE_errorParameter = 25;
	public static readonly RULE_structDefinition = 26;
	public static readonly RULE_structField = 27;
	public static readonly RULE_enumDefinition = 28;
	public static readonly RULE_enumMember = 29;
	public static readonly RULE_typeDefinition = 30;
	public static readonly RULE_constantDefinition = 31;
	public static readonly RULE_constructorDefinition = 32;
	public static readonly RULE_fallbackDefinition = 33;
	public static readonly RULE_fallbackModifier = 34;
	public static readonly RULE_receiveDefinition = 35;
	public static readonly RULE_parentInvocation = 36;
	public static readonly RULE_stateVariableDeclaration = 37;
	public static readonly RULE_collectionModifier = 38;
	public static readonly RULE_stateVariableVisibility = 39;
	public static readonly RULE_mappingType = 40;
	public static readonly RULE_arrayType = 41;
	public static readonly RULE_modifierDefinition = 42;
	public static readonly RULE_modifierStatement = 43;
	public static readonly RULE_placeholderStatement = 44;
	public static readonly RULE_functionDefinition = 45;
	public static readonly RULE_customModifierInvocation = 46;
	public static readonly RULE_functionModifier = 47;
	public static readonly RULE_overrideSpecifier = 48;
	public static readonly RULE_unsafeModifier = 49;
	public static readonly RULE_returnType = 50;
	public static readonly RULE_returnParam = 51;
	public static readonly RULE_parameterList = 52;
	public static readonly RULE_parameter = 53;
	public static readonly RULE_block = 54;
	public static readonly RULE_statement = 55;
	public static readonly RULE_transferStatement = 56;
	public static readonly RULE_tokenContainerMethodStatement = 57;
	public static readonly RULE_returnStatement = 58;
	public static readonly RULE_functionCallStatement = 59;
	public static readonly RULE_addressMethodStatement = 60;
	public static readonly RULE_selfdestructStatement = 61;
	public static readonly RULE_emitStatement = 62;
	public static readonly RULE_assignmentStatement = 63;
	public static readonly RULE_mappingDeleteStatement = 64;
	public static readonly RULE_variableDefinition = 65;
	public static readonly RULE_tupleAssignment = 66;
	public static readonly RULE_tupleSlot = 67;
	public static readonly RULE_assignStatement = 68;
	public static readonly RULE_arrayPushStatement = 69;
	public static readonly RULE_arrayPopStatement = 70;
	public static readonly RULE_arrayDeleteStatement = 71;
	public static readonly RULE_stateArrayPushStatement = 72;
	public static readonly RULE_stateArrayPopStatement = 73;
	public static readonly RULE_deleteStatement = 74;
	public static readonly RULE_timeOpStatement = 75;
	public static readonly RULE_requireStatement = 76;
	public static readonly RULE_ifStatement = 77;
	public static readonly RULE_loopStatement = 78;
	public static readonly RULE_forOfEntriesStatement = 79;
	public static readonly RULE_forInStatement = 80;
	public static readonly RULE_forOfStatement = 81;
	public static readonly RULE_forStatement = 82;
	public static readonly RULE_forInit = 83;
	public static readonly RULE_forCondition = 84;
	public static readonly RULE_forUpdate = 85;
	public static readonly RULE_doWhileStatement = 86;
	public static readonly RULE_whileStatement = 87;
	public static readonly RULE_consoleStatement = 88;
	public static readonly RULE_assemblyStatement = 89;
	public static readonly RULE_assemblyToken = 90;
	public static readonly RULE_uncheckedStatement = 91;
	public static readonly RULE_switchStatement = 92;
	public static readonly RULE_switchCase = 93;
	public static readonly RULE_switchDefault = 94;
	public static readonly RULE_tryCatchStatement = 95;
	public static readonly RULE_tryReturns = 96;
	public static readonly RULE_catchClause = 97;
	public static readonly RULE_breakStatement = 98;
	public static readonly RULE_continueStatement = 99;
	public static readonly RULE_requireMessage = 100;
	public static readonly RULE_revertStatement = 101;
	public static readonly RULE_assertStatement = 102;
	public static readonly RULE_consoleParameter = 103;
	public static readonly RULE_consoleParameterList = 104;
	public static readonly RULE_functionCall = 105;
	public static readonly RULE_namedArg = 106;
	public static readonly RULE_expressionList = 107;
	public static readonly RULE_callOptions = 108;
	public static readonly RULE_callOption = 109;
	public static readonly RULE_typeList = 110;
	public static readonly RULE_expression = 111;
	public static readonly RULE_memberName = 112;
	public static readonly RULE_modifier = 113;
	public static readonly RULE_literal = 114;
	public static readonly RULE_numberLiteral = 115;
	public static readonly RULE_decimalLiteral = 116;
	public static readonly RULE_typeName = 117;
	public static readonly RULE_typeCast = 118;
	public static readonly literalNames: (string | null)[] = [ null, "'import'", 
                                                            "';'", "'as'", 
                                                            "'{'", "','", 
                                                            "'}'", "'function'", 
                                                            "'using'", "'for'", 
                                                            "'*'", "'global'", 
                                                            "'.'", "'+'", 
                                                            "'-'", "'/'", 
                                                            "'%'", "'**'", 
                                                            "'=='", "'!='", 
                                                            "'<'", "'<='", 
                                                            "'>'", "'>='", 
                                                            "'&'", "'|'", 
                                                            "'^'", "'~'", 
                                                            "'deploy'", 
                                                            "'delegate'", 
                                                            "'upgrade'", 
                                                            "'selfdestruct'", 
                                                            "'unsafe'", 
                                                            "'packed'", 
                                                            "'entries'", 
                                                            "'error'", "'revert'", 
                                                            "'pragma'", 
                                                            "'solidcash'", 
                                                            "'solidity'", 
                                                            "'='", "'interface'", 
                                                            "'is'", "'public'", 
                                                            "'external'", 
                                                            "'library'", 
                                                            "'abstract'", 
                                                            "'contract'", 
                                                            "'event'", "'('", 
                                                            "')'", "'anonymous'", 
                                                            "'indexed'", 
                                                            "'struct'", 
                                                            "'enum'", "'type'", 
                                                            "'constant'", 
                                                            "'constructor'", 
                                                            "'internal'", 
                                                            "'payable'", 
                                                            "'fallback'", 
                                                            "'virtual'", 
                                                            "'receive'", 
                                                            "'private'", 
                                                            "'mapping'", 
                                                            "'=>'", "'['", 
                                                            "']'", "'modifier'", 
                                                            "'_'", "'pure'", 
                                                            "'view'", "'override'", 
                                                            "'returns'", 
                                                            "'this'", "'return'", 
                                                            "'emit'", "'+='", 
                                                            "'-='", "'*='", 
                                                            "'/='", "'%='", 
                                                            "'&='", "'|='", 
                                                            "'^='", "'<<='", 
                                                            "'>>='", "'++'", 
                                                            "'--'", "'.delete'", 
                                                            "'.push'", "'.pop'", 
                                                            "'delete'", 
                                                            "'require'", 
                                                            "'if'", "'else'", 
                                                            "'of'", "'in'", 
                                                            "'do'", "'while'", 
                                                            "'console.log'", 
                                                            "'assembly'", 
                                                            "'unchecked'", 
                                                            "'switch'", 
                                                            "'case'", "':'", 
                                                            "'default'", 
                                                            "'try'", "'catch'", 
                                                            "'break'", "'continue'", 
                                                            "'assert'", 
                                                            "'new'", "'abi.encode'", 
                                                            "'abi.encodePacked'", 
                                                            "'abi.encodeWithSelector'", 
                                                            "'abi.encodeWithSignature'", 
                                                            "'abi.encodeCall'", 
                                                            "'bytes.concat'", 
                                                            "'string.concat'", 
                                                            "'abi.decode'", 
                                                            "'abi.decodeAt'", 
                                                            "'tx.outputs'", 
                                                            "'.value'", 
                                                            "'.lockingBytecode'", 
                                                            "'.tokenCategory'", 
                                                            "'.nftCommitment'", 
                                                            "'.tokenAmount'", 
                                                            "'tx.inputs'", 
                                                            "'.outpointTransactionHash'", 
                                                            "'.outpointIndex'", 
                                                            "'.unlockingBytecode'", 
                                                            "'.sequenceNumber'", 
                                                            "'.reverse()'", 
                                                            "'.length'", 
                                                            "'.split'", 
                                                            "'.slice'", 
                                                            "'!'", "'>>'", 
                                                            "'<<'", "'&&'", 
                                                            "'||'", "'?'", 
                                                            "'.code'", "'.codehash'", 
                                                            "'memory'", 
                                                            "'calldata'", 
                                                            "'storage'", 
                                                            "'immutable'", 
                                                            "'transient'", 
                                                            "'address'", 
                                                            "'fixed'", "'ufixed'", 
                                                            null, null, 
                                                            null, null, 
                                                            null, null, 
                                                            null, null, 
                                                            "'bytes'" ];
	public static readonly symbolicNames: (string | null)[] = [ null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, "VersionLiteral", 
                                                             "BooleanLiteral", 
                                                             "NumberUnit", 
                                                             "BchUnit", 
                                                             "DecimalLiteral", 
                                                             "NumberLiteral", 
                                                             "PrimitiveType", 
                                                             "CryptoType", 
                                                             "UnboundedBytes", 
                                                             "BoundedBytes", 
                                                             "Bound", "StringLiteral", 
                                                             "DateLiteral", 
                                                             "HexLiteral", 
                                                             "TxVar", "UnsafeCast", 
                                                             "BoundedSignedInt", 
                                                             "BoundedUnsignedInt", 
                                                             "BoundedSignedFixed", 
                                                             "BoundedUnsignedFixed", 
                                                             "NullaryOp", 
                                                             "UnicodeLiteral", 
                                                             "HexStringLiteral", 
                                                             "Identifier", 
                                                             "WHITESPACE", 
                                                             "COMMENT", 
                                                             "LINE_COMMENT" ];
	// tslint:disable:no-trailing-whitespace
	public static readonly ruleNames: string[] = [
		"sourceFile", "importDirective", "importBinding", "freeFunctionDefinition", 
		"usingForDirective", "usingFunctionBinding", "userDefinableOperator", 
		"anyIdentifier", "pragmaDirective", "pragmaName", "pragmaValue", "versionConstraint", 
		"versionOperator", "interfaceDefinition", "interfaceCollection", "interfaceStateVariable", 
		"interfaceStateVariableVisibility", "interfaceFunction", "libraryDefinition", 
		"contractDefinition", "inheritanceSpecifier", "abstractFunctionDefinition", 
		"eventDefinition", "eventParameter", "errorDefinition", "errorParameter", 
		"structDefinition", "structField", "enumDefinition", "enumMember", "typeDefinition", 
		"constantDefinition", "constructorDefinition", "fallbackDefinition", "fallbackModifier", 
		"receiveDefinition", "parentInvocation", "stateVariableDeclaration", "collectionModifier", 
		"stateVariableVisibility", "mappingType", "arrayType", "modifierDefinition", 
		"modifierStatement", "placeholderStatement", "functionDefinition", "customModifierInvocation", 
		"functionModifier", "overrideSpecifier", "unsafeModifier", "returnType", 
		"returnParam", "parameterList", "parameter", "block", "statement", "transferStatement", 
		"tokenContainerMethodStatement", "returnStatement", "functionCallStatement", 
		"addressMethodStatement", "selfdestructStatement", "emitStatement", "assignmentStatement", 
		"mappingDeleteStatement", "variableDefinition", "tupleAssignment", "tupleSlot", 
		"assignStatement", "arrayPushStatement", "arrayPopStatement", "arrayDeleteStatement", 
		"stateArrayPushStatement", "stateArrayPopStatement", "deleteStatement", 
		"timeOpStatement", "requireStatement", "ifStatement", "loopStatement", 
		"forOfEntriesStatement", "forInStatement", "forOfStatement", "forStatement", 
		"forInit", "forCondition", "forUpdate", "doWhileStatement", "whileStatement", 
		"consoleStatement", "assemblyStatement", "assemblyToken", "uncheckedStatement", 
		"switchStatement", "switchCase", "switchDefault", "tryCatchStatement", 
		"tryReturns", "catchClause", "breakStatement", "continueStatement", "requireMessage", 
		"revertStatement", "assertStatement", "consoleParameter", "consoleParameterList", 
		"functionCall", "namedArg", "expressionList", "callOptions", "callOption", 
		"typeList", "expression", "memberName", "modifier", "literal", "numberLiteral", 
		"decimalLiteral", "typeName", "typeCast",
	];
	public get grammarFileName(): string { return "SolidCash.g4"; }
	public get literalNames(): (string | null)[] { return SolidCashParser.literalNames; }
	public get symbolicNames(): (string | null)[] { return SolidCashParser.symbolicNames; }
	public get ruleNames(): string[] { return SolidCashParser.ruleNames; }
	public get serializedATN(): number[] { return SolidCashParser._serializedATN; }

	protected createFailedPredicateException(predicate?: string, message?: string): FailedPredicateException {
		return new FailedPredicateException(this, predicate, message);
	}

	constructor(input: TokenStream) {
		super(input);
		this._interp = new ParserATNSimulator(this, SolidCashParser._ATN, SolidCashParser.DecisionsToDFA, new PredictionContextCache());
	}
	// @RuleVersion(0)
	public sourceFile(): SourceFileContext {
		let localctx: SourceFileContext = new SourceFileContext(this, this._ctx, this.state);
		this.enterRule(localctx, 0, SolidCashParser.RULE_sourceFile);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 241;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===37) {
				{
				{
				this.state = 238;
				this.pragmaDirective();
				}
				}
				this.state = 243;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 247;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===1) {
				{
				{
				this.state = 244;
				this.importDirective();
				}
				}
				this.state = 249;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 262;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1842241) !== 0) || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 74980871) !== 0)) {
				{
				this.state = 260;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 2, this._ctx) ) {
				case 1:
					{
					this.state = 250;
					this.constantDefinition();
					}
					break;
				case 2:
					{
					this.state = 251;
					this.enumDefinition();
					}
					break;
				case 3:
					{
					this.state = 252;
					this.structDefinition();
					}
					break;
				case 4:
					{
					this.state = 253;
					this.typeDefinition();
					}
					break;
				case 5:
					{
					this.state = 254;
					this.usingForDirective();
					}
					break;
				case 6:
					{
					this.state = 255;
					this.errorDefinition();
					}
					break;
				case 7:
					{
					this.state = 256;
					this.interfaceDefinition();
					}
					break;
				case 8:
					{
					this.state = 257;
					this.freeFunctionDefinition();
					}
					break;
				case 9:
					{
					this.state = 258;
					this.libraryDefinition();
					}
					break;
				case 10:
					{
					this.state = 259;
					this.contractDefinition();
					}
					break;
				}
				}
				this.state = 264;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 265;
			this.match(SolidCashParser.EOF);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public importDirective(): ImportDirectiveContext {
		let localctx: ImportDirectiveContext = new ImportDirectiveContext(this, this._ctx, this.state);
		this.enterRule(localctx, 2, SolidCashParser.RULE_importDirective);
		let _la: number;
		try {
			let _alt: number;
			this.state = 293;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 6, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 267;
				this.match(SolidCashParser.T__0);
				this.state = 268;
				this.match(SolidCashParser.StringLiteral);
				this.state = 269;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 270;
				this.match(SolidCashParser.T__0);
				this.state = 271;
				this.match(SolidCashParser.StringLiteral);
				this.state = 272;
				this.match(SolidCashParser.T__2);
				this.state = 273;
				this.match(SolidCashParser.Identifier);
				this.state = 274;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 275;
				this.match(SolidCashParser.T__0);
				this.state = 276;
				this.match(SolidCashParser.T__3);
				this.state = 277;
				this.importBinding();
				this.state = 282;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 278;
						this.match(SolidCashParser.T__4);
						this.state = 279;
						this.importBinding();
						}
						}
					}
					this.state = 284;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				}
				this.state = 286;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 285;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 288;
				this.match(SolidCashParser.T__5);
				this.state = 289;
				this.match(SolidCashParser.Identifier);
				this.state = 290;
				this.match(SolidCashParser.StringLiteral);
				this.state = 291;
				this.match(SolidCashParser.T__1);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public importBinding(): ImportBindingContext {
		let localctx: ImportBindingContext = new ImportBindingContext(this, this._ctx, this.state);
		this.enterRule(localctx, 4, SolidCashParser.RULE_importBinding);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 295;
			this.match(SolidCashParser.Identifier);
			this.state = 298;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 296;
				this.match(SolidCashParser.T__2);
				this.state = 297;
				this.match(SolidCashParser.Identifier);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public freeFunctionDefinition(): FreeFunctionDefinitionContext {
		let localctx: FreeFunctionDefinitionContext = new FreeFunctionDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 6, SolidCashParser.RULE_freeFunctionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 300;
			this.match(SolidCashParser.T__6);
			this.state = 301;
			this.anyIdentifier();
			this.state = 302;
			this.parameterList();
			this.state = 306;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 303;
				this.functionModifier();
				}
				}
				this.state = 308;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 310;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 309;
				this.returnType();
				}
			}

			this.state = 312;
			this.match(SolidCashParser.T__3);
			this.state = 316;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
				{
				{
				this.state = 313;
				this.statement();
				}
				}
				this.state = 318;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 319;
			this.match(SolidCashParser.T__5);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public usingForDirective(): UsingForDirectiveContext {
		let localctx: UsingForDirectiveContext = new UsingForDirectiveContext(this, this._ctx, this.state);
		this.enterRule(localctx, 8, SolidCashParser.RULE_usingForDirective);
		let _la: number;
		try {
			let _alt: number;
			this.state = 356;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 17, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 321;
				this.match(SolidCashParser.T__7);
				this.state = 322;
				this.match(SolidCashParser.Identifier);
				this.state = 323;
				this.match(SolidCashParser.T__8);
				this.state = 326;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 7:
				case 150:
				case 151:
				case 152:
				case 159:
				case 160:
				case 161:
				case 162:
				case 169:
				case 170:
				case 171:
				case 172:
				case 176:
					{
					this.state = 324;
					this.typeName();
					}
					break;
				case 10:
					{
					this.state = 325;
					this.match(SolidCashParser.T__9);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 329;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 328;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 331;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 332;
				this.match(SolidCashParser.T__7);
				this.state = 333;
				this.match(SolidCashParser.T__3);
				this.state = 334;
				this.usingFunctionBinding();
				this.state = 339;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 335;
						this.match(SolidCashParser.T__4);
						this.state = 336;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 341;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				}
				this.state = 343;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 342;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 345;
				this.match(SolidCashParser.T__5);
				this.state = 346;
				this.match(SolidCashParser.T__8);
				this.state = 349;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 7:
				case 150:
				case 151:
				case 152:
				case 159:
				case 160:
				case 161:
				case 162:
				case 169:
				case 170:
				case 171:
				case 172:
				case 176:
					{
					this.state = 347;
					this.typeName();
					}
					break;
				case 10:
					{
					this.state = 348;
					this.match(SolidCashParser.T__9);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 352;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 351;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 354;
				this.match(SolidCashParser.T__1);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public usingFunctionBinding(): UsingFunctionBindingContext {
		let localctx: UsingFunctionBindingContext = new UsingFunctionBindingContext(this, this._ctx, this.state);
		this.enterRule(localctx, 10, SolidCashParser.RULE_usingFunctionBinding);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 358;
			this.match(SolidCashParser.Identifier);
			this.state = 361;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===12) {
				{
				this.state = 359;
				this.match(SolidCashParser.T__11);
				this.state = 360;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 365;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 363;
				this.match(SolidCashParser.T__2);
				this.state = 364;
				this.userDefinableOperator();
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public userDefinableOperator(): UserDefinableOperatorContext {
		let localctx: UserDefinableOperatorContext = new UserDefinableOperatorContext(this, this._ctx, this.state);
		this.enterRule(localctx, 12, SolidCashParser.RULE_userDefinableOperator);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 367;
			_la = this._input.LA(1);
			if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 268428288) !== 0))) {
			this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public anyIdentifier(): AnyIdentifierContext {
		let localctx: AnyIdentifierContext = new AnyIdentifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 14, SolidCashParser.RULE_anyIdentifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 369;
			_la = this._input.LA(1);
			if(!(((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 156)) & ~0x1F) === 0 && ((1 << (_la - 156)) & 1048593) !== 0))) {
			this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public pragmaDirective(): PragmaDirectiveContext {
		let localctx: PragmaDirectiveContext = new PragmaDirectiveContext(this, this._ctx, this.state);
		this.enterRule(localctx, 16, SolidCashParser.RULE_pragmaDirective);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 371;
			this.match(SolidCashParser.T__36);
			this.state = 372;
			this.pragmaName();
			this.state = 373;
			this.pragmaValue();
			this.state = 374;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public pragmaName(): PragmaNameContext {
		let localctx: PragmaNameContext = new PragmaNameContext(this, this._ctx, this.state);
		this.enterRule(localctx, 18, SolidCashParser.RULE_pragmaName);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 376;
			_la = this._input.LA(1);
			if(!(_la===38 || _la===39)) {
			this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public pragmaValue(): PragmaValueContext {
		let localctx: PragmaValueContext = new PragmaValueContext(this, this._ctx, this.state);
		this.enterRule(localctx, 20, SolidCashParser.RULE_pragmaValue);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 378;
			this.versionConstraint();
			this.state = 380;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0) || _la===153) {
				{
				this.state = 379;
				this.versionConstraint();
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public versionConstraint(): VersionConstraintContext {
		let localctx: VersionConstraintContext = new VersionConstraintContext(this, this._ctx, this.state);
		this.enterRule(localctx, 22, SolidCashParser.RULE_versionConstraint);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 383;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0)) {
				{
				this.state = 382;
				this.versionOperator();
				}
			}

			this.state = 385;
			this.match(SolidCashParser.VersionLiteral);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public versionOperator(): VersionOperatorContext {
		let localctx: VersionOperatorContext = new VersionOperatorContext(this, this._ctx, this.state);
		this.enterRule(localctx, 24, SolidCashParser.RULE_versionOperator);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 387;
			_la = this._input.LA(1);
			if(!(((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0))) {
			this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public interfaceDefinition(): InterfaceDefinitionContext {
		let localctx: InterfaceDefinitionContext = new InterfaceDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 26, SolidCashParser.RULE_interfaceDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 389;
			this.match(SolidCashParser.T__40);
			this.state = 390;
			this.match(SolidCashParser.Identifier);
			this.state = 400;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 391;
				this.match(SolidCashParser.T__41);
				this.state = 392;
				this.match(SolidCashParser.Identifier);
				this.state = 397;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 393;
					this.match(SolidCashParser.T__4);
					this.state = 394;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 399;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 402;
			this.match(SolidCashParser.T__3);
			this.state = 413;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1843969) !== 0)) {
				{
				this.state = 411;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 24, this._ctx) ) {
				case 1:
					{
					this.state = 403;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 404;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 405;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 406;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 407;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 408;
					this.interfaceStateVariable();
					}
					break;
				case 7:
					{
					this.state = 409;
					this.interfaceCollection();
					}
					break;
				case 8:
					{
					this.state = 410;
					this.interfaceFunction();
					}
					break;
				}
				}
				this.state = 415;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 416;
			this.match(SolidCashParser.T__5);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public interfaceCollection(): InterfaceCollectionContext {
		let localctx: InterfaceCollectionContext = new InterfaceCollectionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 28, SolidCashParser.RULE_interfaceCollection);
		try {
			this.state = 428;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 26, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 418;
				this.interfaceStateVariableVisibility();
				this.state = 419;
				this.mappingType();
				this.state = 420;
				this.match(SolidCashParser.Identifier);
				this.state = 421;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 423;
				this.interfaceStateVariableVisibility();
				this.state = 424;
				this.arrayType(0);
				this.state = 425;
				this.match(SolidCashParser.Identifier);
				this.state = 426;
				this.match(SolidCashParser.T__1);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public interfaceStateVariable(): InterfaceStateVariableContext {
		let localctx: InterfaceStateVariableContext = new InterfaceStateVariableContext(this, this._ctx, this.state);
		this.enterRule(localctx, 30, SolidCashParser.RULE_interfaceStateVariable);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 430;
			this.interfaceStateVariableVisibility();
			this.state = 431;
			this.typeName();
			this.state = 432;
			this.match(SolidCashParser.Identifier);
			this.state = 433;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public interfaceStateVariableVisibility(): InterfaceStateVariableVisibilityContext {
		let localctx: InterfaceStateVariableVisibilityContext = new InterfaceStateVariableVisibilityContext(this, this._ctx, this.state);
		this.enterRule(localctx, 32, SolidCashParser.RULE_interfaceStateVariableVisibility);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 435;
			_la = this._input.LA(1);
			if(!(_la===43 || _la===44)) {
			this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public interfaceFunction(): InterfaceFunctionContext {
		let localctx: InterfaceFunctionContext = new InterfaceFunctionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 34, SolidCashParser.RULE_interfaceFunction);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 437;
			this.match(SolidCashParser.T__6);
			this.state = 438;
			this.match(SolidCashParser.Identifier);
			this.state = 439;
			this.parameterList();
			this.state = 443;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 440;
				this.functionModifier();
				}
				}
				this.state = 445;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 447;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 446;
				this.returnType();
				}
			}

			this.state = 449;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public libraryDefinition(): LibraryDefinitionContext {
		let localctx: LibraryDefinitionContext = new LibraryDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 36, SolidCashParser.RULE_libraryDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 451;
			this.match(SolidCashParser.T__44);
			this.state = 452;
			this.match(SolidCashParser.Identifier);
			this.state = 453;
			this.match(SolidCashParser.T__3);
			this.state = 457;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===54) {
				{
				{
				this.state = 454;
				this.enumDefinition();
				}
				}
				this.state = 459;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 463;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===53) {
				{
				{
				this.state = 460;
				this.structDefinition();
				}
				}
				this.state = 465;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 469;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===55) {
				{
				{
				this.state = 466;
				this.typeDefinition();
				}
				}
				this.state = 471;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 475;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===48) {
				{
				{
				this.state = 472;
				this.eventDefinition();
				}
				}
				this.state = 477;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 481;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===35) {
				{
				{
				this.state = 478;
				this.errorDefinition();
				}
				}
				this.state = 483;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 487;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 34, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 484;
					this.constantDefinition();
					}
					}
				}
				this.state = 489;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 34, this._ctx);
			}
			this.state = 493;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===8) {
				{
				{
				this.state = 490;
				this.usingForDirective();
				}
				}
				this.state = 495;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 499;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 496;
				this.freeFunctionDefinition();
				}
				}
				this.state = 501;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 502;
			this.match(SolidCashParser.T__5);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public contractDefinition(): ContractDefinitionContext {
		let localctx: ContractDefinitionContext = new ContractDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 38, SolidCashParser.RULE_contractDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 505;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===46) {
				{
				this.state = 504;
				this.match(SolidCashParser.T__45);
				}
			}

			this.state = 507;
			this.match(SolidCashParser.T__46);
			this.state = 508;
			this.match(SolidCashParser.Identifier);
			this.state = 510;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 509;
				this.parameterList();
				}
			}

			this.state = 521;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 512;
				this.match(SolidCashParser.T__41);
				this.state = 513;
				this.inheritanceSpecifier();
				this.state = 518;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 514;
					this.match(SolidCashParser.T__4);
					this.state = 515;
					this.inheritanceSpecifier();
					}
					}
					this.state = 520;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 523;
			this.match(SolidCashParser.T__3);
			this.state = 540;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 268435459) !== 0) || ((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 37411875) !== 0) || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 74980871) !== 0)) {
				{
				this.state = 538;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 41, this._ctx) ) {
				case 1:
					{
					this.state = 524;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 525;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 526;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 527;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 528;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 529;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 530;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 531;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 532;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 533;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 534;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 535;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 536;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 537;
					this.receiveDefinition();
					}
					break;
				}
				}
				this.state = 542;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 543;
			this.match(SolidCashParser.T__5);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public inheritanceSpecifier(): InheritanceSpecifierContext {
		let localctx: InheritanceSpecifierContext = new InheritanceSpecifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 40, SolidCashParser.RULE_inheritanceSpecifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 545;
			this.match(SolidCashParser.Identifier);
			this.state = 547;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 546;
				this.expressionList();
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public abstractFunctionDefinition(): AbstractFunctionDefinitionContext {
		let localctx: AbstractFunctionDefinitionContext = new AbstractFunctionDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 42, SolidCashParser.RULE_abstractFunctionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 549;
			this.match(SolidCashParser.T__6);
			this.state = 550;
			this.anyIdentifier();
			this.state = 551;
			this.parameterList();
			this.state = 555;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 552;
				this.functionModifier();
				}
				}
				this.state = 557;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 561;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===176) {
				{
				{
				this.state = 558;
				this.customModifierInvocation();
				}
				}
				this.state = 563;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 565;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 564;
				this.returnType();
				}
			}

			this.state = 567;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public eventDefinition(): EventDefinitionContext {
		let localctx: EventDefinitionContext = new EventDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 44, SolidCashParser.RULE_eventDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 569;
			this.match(SolidCashParser.T__47);
			this.state = 570;
			this.match(SolidCashParser.Identifier);
			this.state = 571;
			this.match(SolidCashParser.T__48);
			this.state = 583;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 74980871) !== 0)) {
				{
				this.state = 572;
				this.eventParameter();
				this.state = 577;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 47, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 573;
						this.match(SolidCashParser.T__4);
						this.state = 574;
						this.eventParameter();
						}
						}
					}
					this.state = 579;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 47, this._ctx);
				}
				this.state = 581;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 580;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 585;
			this.match(SolidCashParser.T__49);
			this.state = 587;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===51) {
				{
				this.state = 586;
				this.match(SolidCashParser.T__50);
				}
			}

			this.state = 589;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public eventParameter(): EventParameterContext {
		let localctx: EventParameterContext = new EventParameterContext(this, this._ctx, this.state);
		this.enterRule(localctx, 46, SolidCashParser.RULE_eventParameter);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 593;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 51, this._ctx) ) {
			case 1:
				{
				this.state = 591;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 592;
				this.arrayType(0);
				}
				break;
			}
			this.state = 596;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===52) {
				{
				this.state = 595;
				this.match(SolidCashParser.T__51);
				}
			}

			this.state = 598;
			this.match(SolidCashParser.Identifier);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public errorDefinition(): ErrorDefinitionContext {
		let localctx: ErrorDefinitionContext = new ErrorDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 48, SolidCashParser.RULE_errorDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 600;
			this.match(SolidCashParser.T__34);
			this.state = 601;
			this.match(SolidCashParser.Identifier);
			this.state = 602;
			this.match(SolidCashParser.T__48);
			this.state = 614;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 74980871) !== 0)) {
				{
				this.state = 603;
				this.errorParameter();
				this.state = 608;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 53, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 604;
						this.match(SolidCashParser.T__4);
						this.state = 605;
						this.errorParameter();
						}
						}
					}
					this.state = 610;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 53, this._ctx);
				}
				this.state = 612;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 611;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 616;
			this.match(SolidCashParser.T__49);
			this.state = 617;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public errorParameter(): ErrorParameterContext {
		let localctx: ErrorParameterContext = new ErrorParameterContext(this, this._ctx, this.state);
		this.enterRule(localctx, 50, SolidCashParser.RULE_errorParameter);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 619;
			this.typeName();
			this.state = 620;
			this.match(SolidCashParser.Identifier);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public structDefinition(): StructDefinitionContext {
		let localctx: StructDefinitionContext = new StructDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 52, SolidCashParser.RULE_structDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 622;
			this.match(SolidCashParser.T__52);
			this.state = 623;
			this.match(SolidCashParser.Identifier);
			this.state = 624;
			this.match(SolidCashParser.T__3);
			this.state = 626;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 625;
				this.structField();
				}
				}
				this.state = 628;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 74980871) !== 0));
			this.state = 630;
			this.match(SolidCashParser.T__5);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public structField(): StructFieldContext {
		let localctx: StructFieldContext = new StructFieldContext(this, this._ctx, this.state);
		this.enterRule(localctx, 54, SolidCashParser.RULE_structField);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 634;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 57, this._ctx) ) {
			case 1:
				{
				this.state = 632;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 633;
				this.arrayType(0);
				}
				break;
			}
			this.state = 636;
			this.anyIdentifier();
			this.state = 637;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public enumDefinition(): EnumDefinitionContext {
		let localctx: EnumDefinitionContext = new EnumDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 56, SolidCashParser.RULE_enumDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 639;
			this.match(SolidCashParser.T__53);
			this.state = 640;
			this.match(SolidCashParser.Identifier);
			this.state = 641;
			this.match(SolidCashParser.T__3);
			this.state = 642;
			this.enumMember();
			this.state = 647;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 58, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 643;
					this.match(SolidCashParser.T__4);
					this.state = 644;
					this.enumMember();
					}
					}
				}
				this.state = 649;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 58, this._ctx);
			}
			this.state = 651;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 650;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 653;
			this.match(SolidCashParser.T__5);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public enumMember(): EnumMemberContext {
		let localctx: EnumMemberContext = new EnumMemberContext(this, this._ctx, this.state);
		this.enterRule(localctx, 58, SolidCashParser.RULE_enumMember);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 655;
			this.match(SolidCashParser.Identifier);
			this.state = 658;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 656;
				this.match(SolidCashParser.T__39);
				this.state = 657;
				this.match(SolidCashParser.NumberLiteral);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public typeDefinition(): TypeDefinitionContext {
		let localctx: TypeDefinitionContext = new TypeDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 60, SolidCashParser.RULE_typeDefinition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 660;
			this.match(SolidCashParser.T__54);
			this.state = 661;
			this.match(SolidCashParser.Identifier);
			this.state = 662;
			this.match(SolidCashParser.T__41);
			this.state = 663;
			this.typeName();
			this.state = 664;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public constantDefinition(): ConstantDefinitionContext {
		let localctx: ConstantDefinitionContext = new ConstantDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 62, SolidCashParser.RULE_constantDefinition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 666;
			this.typeName();
			this.state = 667;
			this.match(SolidCashParser.T__55);
			this.state = 668;
			this.match(SolidCashParser.Identifier);
			this.state = 669;
			this.match(SolidCashParser.T__39);
			this.state = 670;
			this.expression(0);
			this.state = 671;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public constructorDefinition(): ConstructorDefinitionContext {
		let localctx: ConstructorDefinitionContext = new ConstructorDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 64, SolidCashParser.RULE_constructorDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 673;
			this.match(SolidCashParser.T__56);
			this.state = 674;
			this.parameterList();
			this.state = 678;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 98307) !== 0)) {
				{
				{
				this.state = 675;
				_la = this._input.LA(1);
				if(!(((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 98307) !== 0))) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				}
				this.state = 680;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 684;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===176) {
				{
				{
				this.state = 681;
				this.parentInvocation();
				}
				}
				this.state = 686;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 687;
			this.match(SolidCashParser.T__3);
			this.state = 691;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
				{
				{
				this.state = 688;
				this.statement();
				}
				}
				this.state = 693;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 694;
			this.match(SolidCashParser.T__5);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public fallbackDefinition(): FallbackDefinitionContext {
		let localctx: FallbackDefinitionContext = new FallbackDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 66, SolidCashParser.RULE_fallbackDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 696;
			this.match(SolidCashParser.T__59);
			this.state = 697;
			this.parameterList();
			this.state = 698;
			this.match(SolidCashParser.T__43);
			this.state = 702;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 8197) !== 0)) {
				{
				{
				this.state = 699;
				this.fallbackModifier();
				}
				}
				this.state = 704;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 708;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===176) {
				{
				{
				this.state = 705;
				this.customModifierInvocation();
				}
				}
				this.state = 710;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 711;
			this.match(SolidCashParser.T__3);
			this.state = 715;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
				{
				{
				this.state = 712;
				this.statement();
				}
				}
				this.state = 717;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 718;
			this.match(SolidCashParser.T__5);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public fallbackModifier(): FallbackModifierContext {
		let localctx: FallbackModifierContext = new FallbackModifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 68, SolidCashParser.RULE_fallbackModifier);
		try {
			this.state = 723;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 59:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 720;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 721;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 722;
				this.overrideSpecifier();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public receiveDefinition(): ReceiveDefinitionContext {
		let localctx: ReceiveDefinitionContext = new ReceiveDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 70, SolidCashParser.RULE_receiveDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 725;
			this.match(SolidCashParser.T__61);
			this.state = 726;
			this.match(SolidCashParser.T__48);
			this.state = 727;
			this.match(SolidCashParser.T__49);
			this.state = 728;
			this.match(SolidCashParser.T__43);
			this.state = 729;
			this.match(SolidCashParser.T__58);
			this.state = 730;
			this.match(SolidCashParser.T__3);
			this.state = 734;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
				{
				{
				this.state = 731;
				this.statement();
				}
				}
				this.state = 736;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 737;
			this.match(SolidCashParser.T__5);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public parentInvocation(): ParentInvocationContext {
		let localctx: ParentInvocationContext = new ParentInvocationContext(this, this._ctx, this.state);
		this.enterRule(localctx, 72, SolidCashParser.RULE_parentInvocation);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 739;
			this.match(SolidCashParser.Identifier);
			this.state = 740;
			this.expressionList();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public stateVariableDeclaration(): StateVariableDeclarationContext {
		let localctx: StateVariableDeclarationContext = new StateVariableDeclarationContext(this, this._ctx, this.state);
		this.enterRule(localctx, 74, SolidCashParser.RULE_stateVariableDeclaration);
		let _la: number;
		try {
			this.state = 804;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 79, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 743;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 742;
					this.stateVariableVisibility();
					}
				}

				this.state = 745;
				this.typeName();
				this.state = 749;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 31) !== 0)) {
					{
					{
					this.state = 746;
					this.modifier();
					}
					}
					this.state = 751;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 752;
				this.match(SolidCashParser.Identifier);
				this.state = 755;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 753;
					this.match(SolidCashParser.T__39);
					this.state = 754;
					this.expression(0);
					}
				}

				this.state = 757;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 759;
				this.typeName();
				this.state = 760;
				this.stateVariableVisibility();
				this.state = 764;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 31) !== 0)) {
					{
					{
					this.state = 761;
					this.modifier();
					}
					}
					this.state = 766;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 767;
				this.match(SolidCashParser.Identifier);
				this.state = 770;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 768;
					this.match(SolidCashParser.T__39);
					this.state = 769;
					this.expression(0);
					}
				}

				this.state = 772;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 775;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 774;
					this.stateVariableVisibility();
					}
				}

				this.state = 777;
				this.mappingType();
				this.state = 781;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 31) !== 0)) {
					{
					{
					this.state = 778;
					this.collectionModifier();
					}
					}
					this.state = 783;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 784;
				this.match(SolidCashParser.Identifier);
				this.state = 785;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 788;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 787;
					this.stateVariableVisibility();
					}
				}

				this.state = 790;
				this.arrayType(0);
				this.state = 794;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 31) !== 0)) {
					{
					{
					this.state = 791;
					this.collectionModifier();
					}
					}
					this.state = 796;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 797;
				this.match(SolidCashParser.Identifier);
				this.state = 800;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 798;
					this.match(SolidCashParser.T__39);
					this.state = 799;
					this.expression(0);
					}
				}

				this.state = 802;
				this.match(SolidCashParser.T__1);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public collectionModifier(): CollectionModifierContext {
		let localctx: CollectionModifierContext = new CollectionModifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 76, SolidCashParser.RULE_collectionModifier);
		try {
			this.state = 808;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 33:
			case 56:
			case 145:
			case 146:
			case 147:
			case 148:
			case 149:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 806;
				this.modifier();
				}
				break;
			case 43:
			case 44:
			case 58:
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 807;
				this.stateVariableVisibility();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public stateVariableVisibility(): StateVariableVisibilityContext {
		let localctx: StateVariableVisibilityContext = new StateVariableVisibilityContext(this, this._ctx, this.state);
		this.enterRule(localctx, 78, SolidCashParser.RULE_stateVariableVisibility);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 810;
			_la = this._input.LA(1);
			if(!(((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0))) {
			this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public mappingType(): MappingTypeContext {
		let localctx: MappingTypeContext = new MappingTypeContext(this, this._ctx, this.state);
		this.enterRule(localctx, 80, SolidCashParser.RULE_mappingType);
		let _la: number;
		try {
			this.state = 848;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 86, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 812;
				this.match(SolidCashParser.T__63);
				this.state = 813;
				this.match(SolidCashParser.T__48);
				this.state = 814;
				this.typeName();
				this.state = 816;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 815;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 818;
				this.match(SolidCashParser.T__64);
				this.state = 819;
				this.typeName();
				this.state = 821;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 820;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 823;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 825;
				this.match(SolidCashParser.T__63);
				this.state = 826;
				this.match(SolidCashParser.T__48);
				this.state = 827;
				this.typeName();
				this.state = 829;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 828;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 831;
				this.match(SolidCashParser.T__64);
				this.state = 832;
				this.mappingType();
				this.state = 833;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 835;
				this.match(SolidCashParser.T__63);
				this.state = 836;
				this.match(SolidCashParser.T__48);
				this.state = 837;
				this.typeName();
				this.state = 839;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 838;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 841;
				this.match(SolidCashParser.T__64);
				this.state = 842;
				this.arrayType(0);
				this.state = 844;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 843;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 846;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}

	public arrayType(): ArrayTypeContext;
	public arrayType(_p: number): ArrayTypeContext;
	// @RuleVersion(0)
	public arrayType(_p?: number): ArrayTypeContext {
		if (_p === undefined) {
			_p = 0;
		}

		let _parentctx: ParserRuleContext = this._ctx;
		let _parentState: number = this.state;
		let localctx: ArrayTypeContext = new ArrayTypeContext(this, this._ctx, _parentState);
		let _prevctx: ArrayTypeContext = localctx;
		let _startState: number = 82;
		this.enterRecursionRule(localctx, 82, SolidCashParser.RULE_arrayType, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 860;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 87, this._ctx) ) {
			case 1:
				{
				this.state = 851;
				this.typeName();
				this.state = 852;
				this.match(SolidCashParser.T__65);
				this.state = 853;
				_la = this._input.LA(1);
				if(!(_la===158 || _la===176)) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 854;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 2:
				{
				this.state = 856;
				this.typeName();
				this.state = 857;
				this.match(SolidCashParser.T__65);
				this.state = 858;
				this.match(SolidCashParser.T__66);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 871;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 89, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 869;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 88, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 862;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 863;
						this.match(SolidCashParser.T__65);
						this.state = 864;
						_la = this._input.LA(1);
						if(!(_la===158 || _la===176)) {
						this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 865;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 866;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 867;
						this.match(SolidCashParser.T__65);
						this.state = 868;
						this.match(SolidCashParser.T__66);
						}
						break;
					}
					}
				}
				this.state = 873;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 89, this._ctx);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.unrollRecursionContexts(_parentctx);
		}
		return localctx;
	}
	// @RuleVersion(0)
	public modifierDefinition(): ModifierDefinitionContext {
		let localctx: ModifierDefinitionContext = new ModifierDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 84, SolidCashParser.RULE_modifierDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 874;
			this.match(SolidCashParser.T__67);
			this.state = 875;
			this.match(SolidCashParser.Identifier);
			this.state = 877;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 876;
				this.parameterList();
				}
			}

			this.state = 879;
			this.match(SolidCashParser.T__3);
			this.state = 883;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
				{
				{
				this.state = 880;
				this.modifierStatement();
				}
				}
				this.state = 885;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 886;
			this.match(SolidCashParser.T__5);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public modifierStatement(): ModifierStatementContext {
		let localctx: ModifierStatementContext = new ModifierStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 86, SolidCashParser.RULE_modifierStatement);
		try {
			this.state = 890;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 69:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 888;
				this.placeholderStatement();
				}
				break;
			case 7:
			case 9:
			case 11:
			case 14:
			case 27:
			case 28:
			case 29:
			case 30:
			case 31:
			case 32:
			case 33:
			case 34:
			case 35:
			case 36:
			case 49:
			case 55:
			case 59:
			case 66:
			case 74:
			case 75:
			case 76:
			case 87:
			case 88:
			case 92:
			case 93:
			case 94:
			case 98:
			case 99:
			case 100:
			case 101:
			case 102:
			case 103:
			case 107:
			case 109:
			case 110:
			case 111:
			case 112:
			case 113:
			case 114:
			case 115:
			case 116:
			case 117:
			case 118:
			case 119:
			case 120:
			case 121:
			case 122:
			case 128:
			case 137:
			case 150:
			case 151:
			case 152:
			case 154:
			case 156:
			case 157:
			case 158:
			case 159:
			case 160:
			case 161:
			case 162:
			case 164:
			case 165:
			case 166:
			case 168:
			case 169:
			case 170:
			case 171:
			case 172:
			case 173:
			case 174:
			case 175:
			case 176:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 889;
				this.statement();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public placeholderStatement(): PlaceholderStatementContext {
		let localctx: PlaceholderStatementContext = new PlaceholderStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 88, SolidCashParser.RULE_placeholderStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 892;
			this.match(SolidCashParser.T__68);
			this.state = 893;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public functionDefinition(): FunctionDefinitionContext {
		let localctx: FunctionDefinitionContext = new FunctionDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 90, SolidCashParser.RULE_functionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 895;
			this.match(SolidCashParser.T__6);
			this.state = 896;
			this.anyIdentifier();
			this.state = 897;
			this.parameterList();
			this.state = 901;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 898;
				this.functionModifier();
				}
				}
				this.state = 903;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 907;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===176) {
				{
				{
				this.state = 904;
				this.customModifierInvocation();
				}
				}
				this.state = 909;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 911;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 910;
				this.returnType();
				}
			}

			this.state = 913;
			this.match(SolidCashParser.T__3);
			this.state = 917;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
				{
				{
				this.state = 914;
				this.statement();
				}
				}
				this.state = 919;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 920;
			this.match(SolidCashParser.T__5);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public customModifierInvocation(): CustomModifierInvocationContext {
		let localctx: CustomModifierInvocationContext = new CustomModifierInvocationContext(this, this._ctx, this.state);
		this.enterRule(localctx, 92, SolidCashParser.RULE_customModifierInvocation);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 922;
			this.match(SolidCashParser.Identifier);
			this.state = 924;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 923;
				this.expressionList();
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public functionModifier(): FunctionModifierContext {
		let localctx: FunctionModifierContext = new FunctionModifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 94, SolidCashParser.RULE_functionModifier);
		try {
			this.state = 940;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 70:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 926;
				this.match(SolidCashParser.T__69);
				}
				break;
			case 71:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 927;
				this.match(SolidCashParser.T__70);
				}
				break;
			case 58:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 928;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 44:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 929;
				this.match(SolidCashParser.T__43);
				}
				break;
			case 43:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 930;
				this.match(SolidCashParser.T__42);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 931;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 59:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 932;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 933;
				this.overrideSpecifier();
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 934;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 935;
				this.unsafeModifier();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 936;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 937;
				this.match(SolidCashParser.T__27);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 938;
				this.match(SolidCashParser.T__30);
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 939;
				this.match(SolidCashParser.T__28);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public overrideSpecifier(): OverrideSpecifierContext {
		let localctx: OverrideSpecifierContext = new OverrideSpecifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 96, SolidCashParser.RULE_overrideSpecifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 942;
			this.match(SolidCashParser.T__71);
			this.state = 953;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 943;
				this.match(SolidCashParser.T__48);
				this.state = 944;
				this.match(SolidCashParser.Identifier);
				this.state = 949;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 945;
					this.match(SolidCashParser.T__4);
					this.state = 946;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 951;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 952;
				this.match(SolidCashParser.T__49);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public unsafeModifier(): UnsafeModifierContext {
		let localctx: UnsafeModifierContext = new UnsafeModifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 98, SolidCashParser.RULE_unsafeModifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 955;
			this.match(SolidCashParser.T__31);
			this.state = 959;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 956;
				this.match(SolidCashParser.T__48);
				this.state = 957;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 958;
				this.match(SolidCashParser.T__49);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public returnType(): ReturnTypeContext {
		let localctx: ReturnTypeContext = new ReturnTypeContext(this, this._ctx, this.state);
		this.enterRule(localctx, 100, SolidCashParser.RULE_returnType);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 961;
			this.match(SolidCashParser.T__72);
			this.state = 962;
			this.match(SolidCashParser.T__48);
			this.state = 963;
			this.returnParam();
			this.state = 968;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 102, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 964;
					this.match(SolidCashParser.T__4);
					this.state = 965;
					this.returnParam();
					}
					}
				}
				this.state = 970;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 102, this._ctx);
			}
			this.state = 972;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 971;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 974;
			this.match(SolidCashParser.T__49);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public returnParam(): ReturnParamContext {
		let localctx: ReturnParamContext = new ReturnParamContext(this, this._ctx, this.state);
		this.enterRule(localctx, 102, SolidCashParser.RULE_returnParam);
		let _la: number;
		try {
			let _alt: number;
			this.state = 996;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 108, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 976;
				this.typeName();
				this.state = 980;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 104, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 977;
						this.modifier();
						}
						}
					}
					this.state = 982;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 104, this._ctx);
				}
				this.state = 984;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 156)) & ~0x1F) === 0 && ((1 << (_la - 156)) & 1048593) !== 0)) {
					{
					this.state = 983;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 986;
				this.arrayType(0);
				this.state = 990;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 106, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 987;
						this.modifier();
						}
						}
					}
					this.state = 992;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 106, this._ctx);
				}
				this.state = 994;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 156)) & ~0x1F) === 0 && ((1 << (_la - 156)) & 1048593) !== 0)) {
					{
					this.state = 993;
					this.anyIdentifier();
					}
				}

				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public parameterList(): ParameterListContext {
		let localctx: ParameterListContext = new ParameterListContext(this, this._ctx, this.state);
		this.enterRule(localctx, 104, SolidCashParser.RULE_parameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 998;
			this.match(SolidCashParser.T__48);
			this.state = 1010;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 74980871) !== 0)) {
				{
				this.state = 999;
				this.parameter();
				this.state = 1004;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 109, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1000;
						this.match(SolidCashParser.T__4);
						this.state = 1001;
						this.parameter();
						}
						}
					}
					this.state = 1006;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 109, this._ctx);
				}
				this.state = 1008;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1007;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1012;
			this.match(SolidCashParser.T__49);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public parameter(): ParameterContext {
		let localctx: ParameterContext = new ParameterContext(this, this._ctx, this.state);
		this.enterRule(localctx, 106, SolidCashParser.RULE_parameter);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1034;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 116, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1014;
				this.typeName();
				this.state = 1018;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 112, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1015;
						this.modifier();
						}
						}
					}
					this.state = 1020;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 112, this._ctx);
				}
				this.state = 1022;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 156)) & ~0x1F) === 0 && ((1 << (_la - 156)) & 1048593) !== 0)) {
					{
					this.state = 1021;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1024;
				this.arrayType(0);
				this.state = 1028;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 114, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1025;
						this.modifier();
						}
						}
					}
					this.state = 1030;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 114, this._ctx);
				}
				this.state = 1032;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 156)) & ~0x1F) === 0 && ((1 << (_la - 156)) & 1048593) !== 0)) {
					{
					this.state = 1031;
					this.anyIdentifier();
					}
				}

				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public block(): BlockContext {
		let localctx: BlockContext = new BlockContext(this, this._ctx, this.state);
		this.enterRule(localctx, 108, SolidCashParser.RULE_block);
		let _la: number;
		try {
			this.state = 1045;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1036;
				this.match(SolidCashParser.T__3);
				this.state = 1040;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
					{
					{
					this.state = 1037;
					this.statement();
					}
					}
					this.state = 1042;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1043;
				this.match(SolidCashParser.T__5);
				}
				break;
			case 7:
			case 9:
			case 11:
			case 14:
			case 27:
			case 28:
			case 29:
			case 30:
			case 31:
			case 32:
			case 33:
			case 34:
			case 35:
			case 36:
			case 49:
			case 55:
			case 59:
			case 66:
			case 74:
			case 75:
			case 76:
			case 87:
			case 88:
			case 92:
			case 93:
			case 94:
			case 98:
			case 99:
			case 100:
			case 101:
			case 102:
			case 103:
			case 107:
			case 109:
			case 110:
			case 111:
			case 112:
			case 113:
			case 114:
			case 115:
			case 116:
			case 117:
			case 118:
			case 119:
			case 120:
			case 121:
			case 122:
			case 128:
			case 137:
			case 150:
			case 151:
			case 152:
			case 154:
			case 156:
			case 157:
			case 158:
			case 159:
			case 160:
			case 161:
			case 162:
			case 164:
			case 165:
			case 166:
			case 168:
			case 169:
			case 170:
			case 171:
			case 172:
			case 173:
			case 174:
			case 175:
			case 176:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1044;
				this.statement();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public statement(): StatementContext {
		let localctx: StatementContext = new StatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 110, SolidCashParser.RULE_statement);
		try {
			this.state = 1078;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 119, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1047;
				this.variableDefinition();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1048;
				this.tupleAssignment();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1049;
				this.arrayPushStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1050;
				this.arrayPopStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1051;
				this.arrayDeleteStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1052;
				this.stateArrayPushStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1053;
				this.stateArrayPopStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1054;
				this.assignStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1055;
				this.assignmentStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1056;
				this.mappingDeleteStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1057;
				this.timeOpStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1058;
				this.requireStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1059;
				this.ifStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1060;
				this.loopStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1061;
				this.consoleStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1062;
				this.emitStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1063;
				this.transferStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1064;
				this.tokenContainerMethodStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1065;
				this.returnStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1066;
				this.functionCallStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1067;
				this.addressMethodStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1068;
				this.selfdestructStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1069;
				this.assemblyStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1070;
				this.tryCatchStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1071;
				this.revertStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1072;
				this.assertStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1073;
				this.deleteStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1074;
				this.uncheckedStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1075;
				this.switchStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1076;
				this.breakStatement();
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 31);
				{
				this.state = 1077;
				this.continueStatement();
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public transferStatement(): TransferStatementContext {
		let localctx: TransferStatementContext = new TransferStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 112, SolidCashParser.RULE_transferStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1080;
			this.match(SolidCashParser.T__73);
			this.state = 1081;
			this.match(SolidCashParser.T__11);
			this.state = 1082;
			this.match(SolidCashParser.Identifier);
			this.state = 1083;
			this.match(SolidCashParser.T__48);
			this.state = 1084;
			this.expression(0);
			this.state = 1085;
			this.match(SolidCashParser.T__4);
			this.state = 1086;
			this.expression(0);
			this.state = 1087;
			this.match(SolidCashParser.T__49);
			this.state = 1088;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public tokenContainerMethodStatement(): TokenContainerMethodStatementContext {
		let localctx: TokenContainerMethodStatementContext = new TokenContainerMethodStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 114, SolidCashParser.RULE_tokenContainerMethodStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1090;
			this.match(SolidCashParser.T__73);
			this.state = 1091;
			this.match(SolidCashParser.T__11);
			this.state = 1092;
			this.match(SolidCashParser.Identifier);
			this.state = 1093;
			this.match(SolidCashParser.T__65);
			this.state = 1094;
			this.expression(0);
			this.state = 1095;
			this.match(SolidCashParser.T__66);
			this.state = 1096;
			this.match(SolidCashParser.T__11);
			this.state = 1097;
			this.match(SolidCashParser.Identifier);
			this.state = 1098;
			this.match(SolidCashParser.T__48);
			this.state = 1099;
			this.expression(0);
			this.state = 1104;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1100;
				this.match(SolidCashParser.T__4);
				this.state = 1101;
				this.expression(0);
				}
				}
				this.state = 1106;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1107;
			this.match(SolidCashParser.T__49);
			this.state = 1108;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public returnStatement(): ReturnStatementContext {
		let localctx: ReturnStatementContext = new ReturnStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 116, SolidCashParser.RULE_returnStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1139;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 124, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1110;
				this.match(SolidCashParser.T__74);
				this.state = 1111;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1112;
				this.match(SolidCashParser.T__74);
				this.state = 1113;
				this.expression(0);
				this.state = 1118;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1114;
					this.match(SolidCashParser.T__4);
					this.state = 1115;
					this.expression(0);
					}
					}
					this.state = 1120;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1121;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1123;
				this.match(SolidCashParser.T__74);
				this.state = 1124;
				this.match(SolidCashParser.T__48);
				this.state = 1125;
				this.expression(0);
				this.state = 1130;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 122, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1126;
						this.match(SolidCashParser.T__4);
						this.state = 1127;
						this.expression(0);
						}
						}
					}
					this.state = 1132;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 122, this._ctx);
				}
				this.state = 1134;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1133;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1136;
				this.match(SolidCashParser.T__49);
				this.state = 1137;
				this.match(SolidCashParser.T__1);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public functionCallStatement(): FunctionCallStatementContext {
		let localctx: FunctionCallStatementContext = new FunctionCallStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 118, SolidCashParser.RULE_functionCallStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1186;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 130, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1141;
				this.match(SolidCashParser.Identifier);
				this.state = 1144;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1142;
					this.match(SolidCashParser.T__11);
					this.state = 1143;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1146;
				this.match(SolidCashParser.T__48);
				this.state = 1147;
				this.match(SolidCashParser.T__3);
				this.state = 1159;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 1148;
					this.namedArg();
					this.state = 1153;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 126, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1149;
							this.match(SolidCashParser.T__4);
							this.state = 1150;
							this.namedArg();
							}
							}
						}
						this.state = 1155;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 126, this._ctx);
					}
					this.state = 1157;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1156;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1161;
				this.match(SolidCashParser.T__5);
				this.state = 1162;
				this.match(SolidCashParser.T__49);
				this.state = 1163;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1164;
				this.match(SolidCashParser.Identifier);
				this.state = 1165;
				this.expressionList();
				this.state = 1166;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1168;
				this.match(SolidCashParser.Identifier);
				this.state = 1169;
				this.match(SolidCashParser.T__11);
				this.state = 1170;
				this.match(SolidCashParser.Identifier);
				this.state = 1171;
				this.expressionList();
				this.state = 1172;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1174;
				this.match(SolidCashParser.Identifier);
				this.state = 1175;
				this.expressionList();
				this.state = 1176;
				this.match(SolidCashParser.T__11);
				this.state = 1177;
				this.match(SolidCashParser.Identifier);
				this.state = 1178;
				this.match(SolidCashParser.T__11);
				this.state = 1179;
				this.match(SolidCashParser.Identifier);
				this.state = 1181;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1180;
					this.callOptions();
					}
				}

				this.state = 1183;
				this.expressionList();
				this.state = 1184;
				this.match(SolidCashParser.T__1);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public addressMethodStatement(): AddressMethodStatementContext {
		let localctx: AddressMethodStatementContext = new AddressMethodStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 120, SolidCashParser.RULE_addressMethodStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1188;
			this.expression(0);
			this.state = 1189;
			this.match(SolidCashParser.T__11);
			this.state = 1190;
			this.match(SolidCashParser.Identifier);
			this.state = 1192;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===4) {
				{
				this.state = 1191;
				this.callOptions();
				}
			}

			this.state = 1194;
			this.expressionList();
			this.state = 1195;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public selfdestructStatement(): SelfdestructStatementContext {
		let localctx: SelfdestructStatementContext = new SelfdestructStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 122, SolidCashParser.RULE_selfdestructStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1197;
			this.match(SolidCashParser.T__30);
			this.state = 1198;
			this.match(SolidCashParser.T__48);
			this.state = 1199;
			this.expression(0);
			this.state = 1200;
			this.match(SolidCashParser.T__49);
			this.state = 1201;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public emitStatement(): EmitStatementContext {
		let localctx: EmitStatementContext = new EmitStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 124, SolidCashParser.RULE_emitStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1236;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 137, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1203;
				this.match(SolidCashParser.T__75);
				this.state = 1204;
				this.match(SolidCashParser.Identifier);
				this.state = 1207;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1205;
					this.match(SolidCashParser.T__11);
					this.state = 1206;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1209;
				this.match(SolidCashParser.T__48);
				this.state = 1210;
				this.match(SolidCashParser.T__3);
				this.state = 1222;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 1211;
					this.namedArg();
					this.state = 1216;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 133, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1212;
							this.match(SolidCashParser.T__4);
							this.state = 1213;
							this.namedArg();
							}
							}
						}
						this.state = 1218;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 133, this._ctx);
					}
					this.state = 1220;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1219;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1224;
				this.match(SolidCashParser.T__5);
				this.state = 1225;
				this.match(SolidCashParser.T__49);
				this.state = 1226;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1227;
				this.match(SolidCashParser.T__75);
				this.state = 1228;
				this.match(SolidCashParser.Identifier);
				this.state = 1231;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1229;
					this.match(SolidCashParser.T__11);
					this.state = 1230;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1233;
				this.expressionList();
				this.state = 1234;
				this.match(SolidCashParser.T__1);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public assignmentStatement(): AssignmentStatementContext {
		let localctx: AssignmentStatementContext = new AssignmentStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 126, SolidCashParser.RULE_assignmentStatement);
		let _la: number;
		try {
			this.state = 1343;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 150, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1238;
				this.match(SolidCashParser.T__73);
				this.state = 1239;
				this.match(SolidCashParser.T__11);
				this.state = 1240;
				this.match(SolidCashParser.Identifier);
				this.state = 1249;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===66) {
					{
					this.state = 1245;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1241;
						this.match(SolidCashParser.T__65);
						this.state = 1242;
						this.expression(0);
						this.state = 1243;
						this.match(SolidCashParser.T__66);
						}
						}
						this.state = 1247;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===66);
					}
				}

				this.state = 1255;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12) {
					{
					{
					this.state = 1251;
					this.match(SolidCashParser.T__11);
					this.state = 1252;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1257;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1258;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1259;
				this.expression(0);
				this.state = 1260;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1262;
				this.match(SolidCashParser.Identifier);
				this.state = 1267;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1263;
					this.match(SolidCashParser.T__65);
					this.state = 1264;
					this.expression(0);
					this.state = 1265;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1269;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1275;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12) {
					{
					{
					this.state = 1271;
					this.match(SolidCashParser.T__11);
					this.state = 1272;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1277;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1278;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1279;
				this.expression(0);
				this.state = 1280;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1282;
				this.match(SolidCashParser.Identifier);
				this.state = 1285;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1283;
					this.match(SolidCashParser.T__11);
					this.state = 1284;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1287;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1289;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1290;
				this.expression(0);
				this.state = 1291;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1293;
				this.match(SolidCashParser.T__73);
				this.state = 1294;
				this.match(SolidCashParser.T__11);
				this.state = 1295;
				this.match(SolidCashParser.Identifier);
				this.state = 1304;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===66) {
					{
					this.state = 1300;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1296;
						this.match(SolidCashParser.T__65);
						this.state = 1297;
						this.expression(0);
						this.state = 1298;
						this.match(SolidCashParser.T__66);
						}
						}
						this.state = 1302;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===66);
					}
				}

				this.state = 1310;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12) {
					{
					{
					this.state = 1306;
					this.match(SolidCashParser.T__11);
					this.state = 1307;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1312;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1313;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1314;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1315;
				this.match(SolidCashParser.Identifier);
				this.state = 1320;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1316;
					this.match(SolidCashParser.T__65);
					this.state = 1317;
					this.expression(0);
					this.state = 1318;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1322;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1328;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12) {
					{
					{
					this.state = 1324;
					this.match(SolidCashParser.T__11);
					this.state = 1325;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1330;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1331;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1332;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1334;
				this.match(SolidCashParser.Identifier);
				this.state = 1337;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1335;
					this.match(SolidCashParser.T__11);
					this.state = 1336;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1339;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1341;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1342;
				this.match(SolidCashParser.T__1);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public mappingDeleteStatement(): MappingDeleteStatementContext {
		let localctx: MappingDeleteStatementContext = new MappingDeleteStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 128, SolidCashParser.RULE_mappingDeleteStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1345;
			this.match(SolidCashParser.T__73);
			this.state = 1346;
			this.match(SolidCashParser.T__11);
			this.state = 1347;
			this.match(SolidCashParser.Identifier);
			this.state = 1354;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===66) {
				{
				{
				this.state = 1348;
				this.match(SolidCashParser.T__65);
				this.state = 1349;
				this.expression(0);
				this.state = 1350;
				this.match(SolidCashParser.T__66);
				}
				}
				this.state = 1356;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1357;
			this.match(SolidCashParser.T__88);
			this.state = 1358;
			this.match(SolidCashParser.T__48);
			this.state = 1359;
			this.expression(0);
			this.state = 1360;
			this.match(SolidCashParser.T__49);
			this.state = 1361;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public variableDefinition(): VariableDefinitionContext {
		let localctx: VariableDefinitionContext = new VariableDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 130, SolidCashParser.RULE_variableDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1391;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 156, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1363;
				this.typeName();
				this.state = 1367;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 152, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1364;
						this.modifier();
						}
						}
					}
					this.state = 1369;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 152, this._ctx);
				}
				this.state = 1370;
				this.anyIdentifier();
				this.state = 1373;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1371;
					this.match(SolidCashParser.T__39);
					this.state = 1372;
					this.expression(0);
					}
				}

				this.state = 1375;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1377;
				this.arrayType(0);
				this.state = 1381;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 154, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1378;
						this.modifier();
						}
						}
					}
					this.state = 1383;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 154, this._ctx);
				}
				this.state = 1384;
				this.anyIdentifier();
				this.state = 1387;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1385;
					this.match(SolidCashParser.T__39);
					this.state = 1386;
					this.expression(0);
					}
				}

				this.state = 1389;
				this.match(SolidCashParser.T__1);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public tupleAssignment(): TupleAssignmentContext {
		let localctx: TupleAssignmentContext = new TupleAssignmentContext(this, this._ctx, this.state);
		this.enterRule(localctx, 132, SolidCashParser.RULE_tupleAssignment);
		let _la: number;
		try {
			this.state = 1441;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 161, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1393;
				this.typeName();
				this.state = 1394;
				this.match(SolidCashParser.Identifier);
				this.state = 1399;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1395;
					this.match(SolidCashParser.T__4);
					this.state = 1396;
					this.typeName();
					this.state = 1397;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1401;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1403;
				this.match(SolidCashParser.T__39);
				this.state = 1404;
				this.expression(0);
				this.state = 1405;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1407;
				this.match(SolidCashParser.T__48);
				this.state = 1408;
				this.tupleSlot();
				this.state = 1411;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1409;
					this.match(SolidCashParser.T__4);
					this.state = 1410;
					this.tupleSlot();
					}
					}
					this.state = 1413;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1415;
				this.match(SolidCashParser.T__49);
				this.state = 1416;
				this.match(SolidCashParser.T__39);
				this.state = 1417;
				this.match(SolidCashParser.T__48);
				this.state = 1418;
				this.expression(0);
				this.state = 1421;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1419;
					this.match(SolidCashParser.T__4);
					this.state = 1420;
					this.expression(0);
					}
					}
					this.state = 1423;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1425;
				this.match(SolidCashParser.T__49);
				this.state = 1426;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1428;
				this.match(SolidCashParser.T__48);
				this.state = 1429;
				this.tupleSlot();
				this.state = 1432;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1430;
					this.match(SolidCashParser.T__4);
					this.state = 1431;
					this.tupleSlot();
					}
					}
					this.state = 1434;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1436;
				this.match(SolidCashParser.T__49);
				this.state = 1437;
				this.match(SolidCashParser.T__39);
				this.state = 1438;
				this.expression(0);
				this.state = 1439;
				this.match(SolidCashParser.T__1);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public tupleSlot(): TupleSlotContext {
		let localctx: TupleSlotContext = new TupleSlotContext(this, this._ctx, this.state);
		this.enterRule(localctx, 134, SolidCashParser.RULE_tupleSlot);
		let _la: number;
		try {
			this.state = 1454;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 163, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1443;
				this.typeName();
				this.state = 1447;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 31) !== 0)) {
					{
					{
					this.state = 1444;
					this.modifier();
					}
					}
					this.state = 1449;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1450;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1452;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				// tslint:disable-next-line:no-empty
				{
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public assignStatement(): AssignStatementContext {
		let localctx: AssignStatementContext = new AssignStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 136, SolidCashParser.RULE_assignStatement);
		let _la: number;
		try {
			this.state = 1467;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 164, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1456;
				this.match(SolidCashParser.Identifier);
				this.state = 1457;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1458;
				this.expression(0);
				this.state = 1459;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1461;
				this.match(SolidCashParser.Identifier);
				this.state = 1462;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1463;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1464;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1465;
				this.match(SolidCashParser.Identifier);
				this.state = 1466;
				this.match(SolidCashParser.T__1);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public arrayPushStatement(): ArrayPushStatementContext {
		let localctx: ArrayPushStatementContext = new ArrayPushStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 138, SolidCashParser.RULE_arrayPushStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1469;
			this.match(SolidCashParser.Identifier);
			this.state = 1470;
			this.match(SolidCashParser.T__89);
			this.state = 1471;
			this.match(SolidCashParser.T__48);
			this.state = 1472;
			this.expression(0);
			this.state = 1473;
			this.match(SolidCashParser.T__49);
			this.state = 1474;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public arrayPopStatement(): ArrayPopStatementContext {
		let localctx: ArrayPopStatementContext = new ArrayPopStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 140, SolidCashParser.RULE_arrayPopStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1476;
			this.match(SolidCashParser.Identifier);
			this.state = 1477;
			this.match(SolidCashParser.T__90);
			this.state = 1478;
			this.match(SolidCashParser.T__48);
			this.state = 1479;
			this.match(SolidCashParser.T__49);
			this.state = 1480;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public arrayDeleteStatement(): ArrayDeleteStatementContext {
		let localctx: ArrayDeleteStatementContext = new ArrayDeleteStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 142, SolidCashParser.RULE_arrayDeleteStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1482;
			this.match(SolidCashParser.Identifier);
			this.state = 1483;
			this.match(SolidCashParser.T__88);
			this.state = 1484;
			this.match(SolidCashParser.T__48);
			this.state = 1485;
			this.expression(0);
			this.state = 1486;
			this.match(SolidCashParser.T__49);
			this.state = 1487;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public stateArrayPushStatement(): StateArrayPushStatementContext {
		let localctx: StateArrayPushStatementContext = new StateArrayPushStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 144, SolidCashParser.RULE_stateArrayPushStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1489;
			this.match(SolidCashParser.T__73);
			this.state = 1490;
			this.match(SolidCashParser.T__11);
			this.state = 1491;
			this.match(SolidCashParser.Identifier);
			this.state = 1492;
			this.match(SolidCashParser.T__89);
			this.state = 1493;
			this.match(SolidCashParser.T__48);
			this.state = 1494;
			this.expression(0);
			this.state = 1495;
			this.match(SolidCashParser.T__49);
			this.state = 1496;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public stateArrayPopStatement(): StateArrayPopStatementContext {
		let localctx: StateArrayPopStatementContext = new StateArrayPopStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 146, SolidCashParser.RULE_stateArrayPopStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1498;
			this.match(SolidCashParser.T__73);
			this.state = 1499;
			this.match(SolidCashParser.T__11);
			this.state = 1500;
			this.match(SolidCashParser.Identifier);
			this.state = 1501;
			this.match(SolidCashParser.T__90);
			this.state = 1502;
			this.match(SolidCashParser.T__48);
			this.state = 1503;
			this.match(SolidCashParser.T__49);
			this.state = 1504;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public deleteStatement(): DeleteStatementContext {
		let localctx: DeleteStatementContext = new DeleteStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 148, SolidCashParser.RULE_deleteStatement);
		let _la: number;
		try {
			this.state = 1540;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 167, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1506;
				this.match(SolidCashParser.T__91);
				this.state = 1507;
				this.match(SolidCashParser.Identifier);
				this.state = 1508;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1509;
				this.match(SolidCashParser.T__91);
				this.state = 1510;
				this.match(SolidCashParser.T__73);
				this.state = 1511;
				this.match(SolidCashParser.T__11);
				this.state = 1512;
				this.match(SolidCashParser.Identifier);
				this.state = 1513;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1514;
				this.match(SolidCashParser.T__91);
				this.state = 1515;
				this.match(SolidCashParser.T__73);
				this.state = 1516;
				this.match(SolidCashParser.T__11);
				this.state = 1517;
				this.match(SolidCashParser.Identifier);
				this.state = 1522;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1518;
					this.match(SolidCashParser.T__65);
					this.state = 1519;
					this.expression(0);
					this.state = 1520;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1524;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1526;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1528;
				this.match(SolidCashParser.T__91);
				this.state = 1529;
				this.match(SolidCashParser.Identifier);
				this.state = 1534;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1530;
					this.match(SolidCashParser.T__65);
					this.state = 1531;
					this.expression(0);
					this.state = 1532;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1536;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1538;
				this.match(SolidCashParser.T__1);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public timeOpStatement(): TimeOpStatementContext {
		let localctx: TimeOpStatementContext = new TimeOpStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 150, SolidCashParser.RULE_timeOpStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1542;
			this.match(SolidCashParser.T__92);
			this.state = 1543;
			this.match(SolidCashParser.T__48);
			this.state = 1544;
			this.match(SolidCashParser.TxVar);
			this.state = 1545;
			this.match(SolidCashParser.T__22);
			this.state = 1546;
			this.expression(0);
			this.state = 1549;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1547;
				this.match(SolidCashParser.T__4);
				this.state = 1548;
				this.requireMessage();
				}
			}

			this.state = 1551;
			this.match(SolidCashParser.T__49);
			this.state = 1552;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public requireStatement(): RequireStatementContext {
		let localctx: RequireStatementContext = new RequireStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 152, SolidCashParser.RULE_requireStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1554;
			this.match(SolidCashParser.T__92);
			this.state = 1555;
			this.match(SolidCashParser.T__48);
			this.state = 1556;
			this.expression(0);
			this.state = 1559;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1557;
				this.match(SolidCashParser.T__4);
				this.state = 1558;
				this.requireMessage();
				}
			}

			this.state = 1561;
			this.match(SolidCashParser.T__49);
			this.state = 1562;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public ifStatement(): IfStatementContext {
		let localctx: IfStatementContext = new IfStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 154, SolidCashParser.RULE_ifStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1564;
			this.match(SolidCashParser.T__93);
			this.state = 1565;
			this.match(SolidCashParser.T__48);
			this.state = 1566;
			this.expression(0);
			this.state = 1567;
			this.match(SolidCashParser.T__49);
			this.state = 1568;
			localctx._ifBlock = this.block();
			this.state = 1571;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 170, this._ctx) ) {
			case 1:
				{
				this.state = 1569;
				this.match(SolidCashParser.T__94);
				this.state = 1570;
				localctx._elseBlock = this.block();
				}
				break;
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public loopStatement(): LoopStatementContext {
		let localctx: LoopStatementContext = new LoopStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 156, SolidCashParser.RULE_loopStatement);
		try {
			this.state = 1579;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 171, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1573;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1574;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1575;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1576;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1577;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1578;
				this.forOfStatement();
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public forOfEntriesStatement(): ForOfEntriesStatementContext {
		let localctx: ForOfEntriesStatementContext = new ForOfEntriesStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 158, SolidCashParser.RULE_forOfEntriesStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1581;
			this.match(SolidCashParser.T__8);
			this.state = 1582;
			this.match(SolidCashParser.T__48);
			this.state = 1583;
			this.typeName();
			this.state = 1584;
			this.match(SolidCashParser.Identifier);
			this.state = 1585;
			this.match(SolidCashParser.T__4);
			this.state = 1586;
			this.typeName();
			this.state = 1587;
			this.match(SolidCashParser.Identifier);
			this.state = 1588;
			this.match(SolidCashParser.T__95);
			this.state = 1589;
			this.match(SolidCashParser.T__73);
			this.state = 1590;
			this.match(SolidCashParser.T__11);
			this.state = 1591;
			this.match(SolidCashParser.Identifier);
			this.state = 1592;
			this.match(SolidCashParser.T__11);
			this.state = 1593;
			this.match(SolidCashParser.T__33);
			this.state = 1594;
			this.match(SolidCashParser.T__49);
			this.state = 1595;
			this.block();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public forInStatement(): ForInStatementContext {
		let localctx: ForInStatementContext = new ForInStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 160, SolidCashParser.RULE_forInStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1597;
			this.match(SolidCashParser.T__8);
			this.state = 1598;
			this.match(SolidCashParser.T__48);
			this.state = 1599;
			this.typeName();
			this.state = 1600;
			this.match(SolidCashParser.Identifier);
			this.state = 1601;
			this.match(SolidCashParser.T__96);
			this.state = 1602;
			this.match(SolidCashParser.T__73);
			this.state = 1603;
			this.match(SolidCashParser.T__11);
			this.state = 1604;
			this.match(SolidCashParser.Identifier);
			this.state = 1605;
			this.match(SolidCashParser.T__49);
			this.state = 1606;
			this.block();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public forOfStatement(): ForOfStatementContext {
		let localctx: ForOfStatementContext = new ForOfStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 162, SolidCashParser.RULE_forOfStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1608;
			this.match(SolidCashParser.T__8);
			this.state = 1609;
			this.match(SolidCashParser.T__48);
			this.state = 1610;
			this.typeName();
			this.state = 1611;
			this.match(SolidCashParser.Identifier);
			this.state = 1612;
			this.match(SolidCashParser.T__95);
			this.state = 1613;
			this.match(SolidCashParser.T__73);
			this.state = 1614;
			this.match(SolidCashParser.T__11);
			this.state = 1615;
			this.match(SolidCashParser.Identifier);
			this.state = 1616;
			this.match(SolidCashParser.T__49);
			this.state = 1617;
			this.block();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public forStatement(): ForStatementContext {
		let localctx: ForStatementContext = new ForStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 164, SolidCashParser.RULE_forStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1619;
			this.match(SolidCashParser.T__8);
			this.state = 1620;
			this.match(SolidCashParser.T__48);
			this.state = 1621;
			this.forInit();
			this.state = 1622;
			this.forCondition();
			this.state = 1624;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===176) {
				{
				this.state = 1623;
				this.forUpdate();
				}
			}

			this.state = 1626;
			this.match(SolidCashParser.T__49);
			this.state = 1627;
			this.block();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public forInit(): ForInitContext {
		let localctx: ForInitContext = new ForInitContext(this, this._ctx, this.state);
		this.enterRule(localctx, 166, SolidCashParser.RULE_forInit);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1629;
			this.typeName();
			this.state = 1633;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===33 || _la===56 || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 31) !== 0)) {
				{
				{
				this.state = 1630;
				this.modifier();
				}
				}
				this.state = 1635;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1636;
			this.match(SolidCashParser.Identifier);
			this.state = 1639;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 1637;
				this.match(SolidCashParser.T__39);
				this.state = 1638;
				this.expression(0);
				}
			}

			this.state = 1641;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public forCondition(): ForConditionContext {
		let localctx: ForConditionContext = new ForConditionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 168, SolidCashParser.RULE_forCondition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1643;
			this.expression(0);
			this.state = 1644;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public forUpdate(): ForUpdateContext {
		let localctx: ForUpdateContext = new ForUpdateContext(this, this._ctx, this.state);
		this.enterRule(localctx, 170, SolidCashParser.RULE_forUpdate);
		let _la: number;
		try {
			this.state = 1651;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 175, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1646;
				this.match(SolidCashParser.Identifier);
				this.state = 1647;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1648;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1649;
				this.match(SolidCashParser.Identifier);
				this.state = 1650;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public doWhileStatement(): DoWhileStatementContext {
		let localctx: DoWhileStatementContext = new DoWhileStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 172, SolidCashParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1653;
			this.match(SolidCashParser.T__97);
			this.state = 1654;
			this.block();
			this.state = 1655;
			this.match(SolidCashParser.T__98);
			this.state = 1656;
			this.match(SolidCashParser.T__48);
			this.state = 1657;
			this.expression(0);
			this.state = 1658;
			this.match(SolidCashParser.T__49);
			this.state = 1659;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public whileStatement(): WhileStatementContext {
		let localctx: WhileStatementContext = new WhileStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 174, SolidCashParser.RULE_whileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1661;
			this.match(SolidCashParser.T__98);
			this.state = 1662;
			this.match(SolidCashParser.T__48);
			this.state = 1663;
			this.expression(0);
			this.state = 1664;
			this.match(SolidCashParser.T__49);
			this.state = 1665;
			this.block();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public consoleStatement(): ConsoleStatementContext {
		let localctx: ConsoleStatementContext = new ConsoleStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 176, SolidCashParser.RULE_consoleStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1667;
			this.match(SolidCashParser.T__99);
			this.state = 1668;
			this.consoleParameterList();
			this.state = 1669;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public assemblyStatement(): AssemblyStatementContext {
		let localctx: AssemblyStatementContext = new AssemblyStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 178, SolidCashParser.RULE_assemblyStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1671;
			this.match(SolidCashParser.T__100);
			this.state = 1672;
			this.match(SolidCashParser.T__3);
			this.state = 1676;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 158)) & ~0x1F) === 0 && ((1 << (_la - 158)) & 262401) !== 0)) {
				{
				{
				this.state = 1673;
				this.assemblyToken();
				}
				}
				this.state = 1678;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1679;
			this.match(SolidCashParser.T__5);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public assemblyToken(): AssemblyTokenContext {
		let localctx: AssemblyTokenContext = new AssemblyTokenContext(this, this._ctx, this.state);
		this.enterRule(localctx, 180, SolidCashParser.RULE_assemblyToken);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1681;
			_la = this._input.LA(1);
			if(!(((((_la - 158)) & ~0x1F) === 0 && ((1 << (_la - 158)) & 262401) !== 0))) {
			this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public uncheckedStatement(): UncheckedStatementContext {
		let localctx: UncheckedStatementContext = new UncheckedStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 182, SolidCashParser.RULE_uncheckedStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1683;
			this.match(SolidCashParser.T__101);
			this.state = 1684;
			this.match(SolidCashParser.T__3);
			this.state = 1688;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
				{
				{
				this.state = 1685;
				this.statement();
				}
				}
				this.state = 1690;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1691;
			this.match(SolidCashParser.T__5);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public switchStatement(): SwitchStatementContext {
		let localctx: SwitchStatementContext = new SwitchStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 184, SolidCashParser.RULE_switchStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1693;
			this.match(SolidCashParser.T__102);
			this.state = 1694;
			this.match(SolidCashParser.T__48);
			this.state = 1695;
			this.expression(0);
			this.state = 1696;
			this.match(SolidCashParser.T__49);
			this.state = 1697;
			this.match(SolidCashParser.T__3);
			this.state = 1701;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===104) {
				{
				{
				this.state = 1698;
				this.switchCase();
				}
				}
				this.state = 1703;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1705;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===106) {
				{
				this.state = 1704;
				this.switchDefault();
				}
			}

			this.state = 1707;
			this.match(SolidCashParser.T__5);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public switchCase(): SwitchCaseContext {
		let localctx: SwitchCaseContext = new SwitchCaseContext(this, this._ctx, this.state);
		this.enterRule(localctx, 186, SolidCashParser.RULE_switchCase);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1709;
			this.match(SolidCashParser.T__103);
			this.state = 1710;
			this.expression(0);
			this.state = 1711;
			this.match(SolidCashParser.T__104);
			this.state = 1715;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
				{
				{
				this.state = 1712;
				this.statement();
				}
				}
				this.state = 1717;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public switchDefault(): SwitchDefaultContext {
		let localctx: SwitchDefaultContext = new SwitchDefaultContext(this, this._ctx, this.state);
		this.enterRule(localctx, 188, SolidCashParser.RULE_switchDefault);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1718;
			this.match(SolidCashParser.T__105);
			this.state = 1719;
			this.match(SolidCashParser.T__104);
			this.state = 1723;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
				{
				{
				this.state = 1720;
				this.statement();
				}
				}
				this.state = 1725;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public tryCatchStatement(): TryCatchStatementContext {
		let localctx: TryCatchStatementContext = new TryCatchStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 190, SolidCashParser.RULE_tryCatchStatement);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1726;
			this.match(SolidCashParser.T__106);
			this.state = 1727;
			this.expression(0);
			this.state = 1729;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 1728;
				this.tryReturns();
				}
			}

			this.state = 1731;
			localctx._tryBlock = this.block();
			this.state = 1733;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1732;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1735;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 183, this._ctx);
			} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public tryReturns(): TryReturnsContext {
		let localctx: TryReturnsContext = new TryReturnsContext(this, this._ctx, this.state);
		this.enterRule(localctx, 192, SolidCashParser.RULE_tryReturns);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1737;
			this.match(SolidCashParser.T__72);
			this.state = 1738;
			this.match(SolidCashParser.T__48);
			this.state = 1750;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 74980871) !== 0)) {
				{
				this.state = 1739;
				this.parameter();
				this.state = 1744;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 184, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1740;
						this.match(SolidCashParser.T__4);
						this.state = 1741;
						this.parameter();
						}
						}
					}
					this.state = 1746;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 184, this._ctx);
				}
				this.state = 1748;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1747;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1752;
			this.match(SolidCashParser.T__49);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public catchClause(): CatchClauseContext {
		let localctx: CatchClauseContext = new CatchClauseContext(this, this._ctx, this.state);
		this.enterRule(localctx, 194, SolidCashParser.RULE_catchClause);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1754;
			this.match(SolidCashParser.T__107);
			this.state = 1756;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 187, this._ctx) ) {
			case 1:
				{
				this.state = 1755;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 1773;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 191, this._ctx) ) {
			case 1:
				{
				this.state = 1758;
				this.match(SolidCashParser.T__48);
				this.state = 1770;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 74980871) !== 0)) {
					{
					this.state = 1759;
					this.parameter();
					this.state = 1764;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 188, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1760;
							this.match(SolidCashParser.T__4);
							this.state = 1761;
							this.parameter();
							}
							}
						}
						this.state = 1766;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 188, this._ctx);
					}
					this.state = 1768;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1767;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1772;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
			this.state = 1775;
			localctx._catchBlock = this.block();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public breakStatement(): BreakStatementContext {
		let localctx: BreakStatementContext = new BreakStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 196, SolidCashParser.RULE_breakStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1777;
			this.match(SolidCashParser.T__108);
			this.state = 1778;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public continueStatement(): ContinueStatementContext {
		let localctx: ContinueStatementContext = new ContinueStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 198, SolidCashParser.RULE_continueStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1780;
			this.match(SolidCashParser.T__109);
			this.state = 1781;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public requireMessage(): RequireMessageContext {
		let localctx: RequireMessageContext = new RequireMessageContext(this, this._ctx, this.state);
		this.enterRule(localctx, 200, SolidCashParser.RULE_requireMessage);
		try {
			this.state = 1786;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 164:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1783;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 176:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1784;
				this.match(SolidCashParser.Identifier);
				this.state = 1785;
				this.expressionList();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public revertStatement(): RevertStatementContext {
		let localctx: RevertStatementContext = new RevertStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 202, SolidCashParser.RULE_revertStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1830;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 198, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1788;
				this.match(SolidCashParser.T__35);
				this.state = 1789;
				this.match(SolidCashParser.Identifier);
				this.state = 1792;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1790;
					this.match(SolidCashParser.T__11);
					this.state = 1791;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1794;
				this.match(SolidCashParser.T__48);
				this.state = 1795;
				this.match(SolidCashParser.T__3);
				this.state = 1807;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 1796;
					this.namedArg();
					this.state = 1801;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 194, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1797;
							this.match(SolidCashParser.T__4);
							this.state = 1798;
							this.namedArg();
							}
							}
						}
						this.state = 1803;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 194, this._ctx);
					}
					this.state = 1805;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1804;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1809;
				this.match(SolidCashParser.T__5);
				this.state = 1810;
				this.match(SolidCashParser.T__49);
				this.state = 1811;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1812;
				this.match(SolidCashParser.T__35);
				this.state = 1813;
				this.match(SolidCashParser.Identifier);
				this.state = 1816;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1814;
					this.match(SolidCashParser.T__11);
					this.state = 1815;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1818;
				this.expressionList();
				this.state = 1819;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1821;
				this.match(SolidCashParser.T__35);
				this.state = 1822;
				this.match(SolidCashParser.T__48);
				this.state = 1823;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1824;
				this.match(SolidCashParser.T__49);
				this.state = 1825;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1826;
				this.match(SolidCashParser.T__35);
				this.state = 1827;
				this.match(SolidCashParser.T__48);
				this.state = 1828;
				this.match(SolidCashParser.T__49);
				this.state = 1829;
				this.match(SolidCashParser.T__1);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public assertStatement(): AssertStatementContext {
		let localctx: AssertStatementContext = new AssertStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 204, SolidCashParser.RULE_assertStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1832;
			this.match(SolidCashParser.T__110);
			this.state = 1833;
			this.match(SolidCashParser.T__48);
			this.state = 1834;
			this.expression(0);
			this.state = 1835;
			this.match(SolidCashParser.T__49);
			this.state = 1836;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public consoleParameter(): ConsoleParameterContext {
		let localctx: ConsoleParameterContext = new ConsoleParameterContext(this, this._ctx, this.state);
		this.enterRule(localctx, 206, SolidCashParser.RULE_consoleParameter);
		try {
			this.state = 1840;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 176:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1838;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 154:
			case 157:
			case 158:
			case 164:
			case 165:
			case 166:
			case 174:
			case 175:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1839;
				this.literal();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public consoleParameterList(): ConsoleParameterListContext {
		let localctx: ConsoleParameterListContext = new ConsoleParameterListContext(this, this._ctx, this.state);
		this.enterRule(localctx, 208, SolidCashParser.RULE_consoleParameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1842;
			this.match(SolidCashParser.T__48);
			this.state = 1854;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 154)) & ~0x1F) === 0 && ((1 << (_la - 154)) & 7347225) !== 0)) {
				{
				this.state = 1843;
				this.consoleParameter();
				this.state = 1848;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 200, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1844;
						this.match(SolidCashParser.T__4);
						this.state = 1845;
						this.consoleParameter();
						}
						}
					}
					this.state = 1850;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 200, this._ctx);
				}
				this.state = 1852;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1851;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1856;
			this.match(SolidCashParser.T__49);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public functionCall(): FunctionCallContext {
		let localctx: FunctionCallContext = new FunctionCallContext(this, this._ctx, this.state);
		this.enterRule(localctx, 210, SolidCashParser.RULE_functionCall);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1882;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 206, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1858;
				this.match(SolidCashParser.Identifier);
				this.state = 1859;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1860;
				this.match(SolidCashParser.Identifier);
				this.state = 1861;
				this.match(SolidCashParser.T__11);
				this.state = 1862;
				this.match(SolidCashParser.Identifier);
				this.state = 1863;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1864;
				this.match(SolidCashParser.Identifier);
				this.state = 1865;
				this.match(SolidCashParser.T__48);
				this.state = 1866;
				this.match(SolidCashParser.T__3);
				this.state = 1878;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 1867;
					this.namedArg();
					this.state = 1872;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 203, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1868;
							this.match(SolidCashParser.T__4);
							this.state = 1869;
							this.namedArg();
							}
							}
						}
						this.state = 1874;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 203, this._ctx);
					}
					this.state = 1876;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1875;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1880;
				this.match(SolidCashParser.T__5);
				this.state = 1881;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public namedArg(): NamedArgContext {
		let localctx: NamedArgContext = new NamedArgContext(this, this._ctx, this.state);
		this.enterRule(localctx, 212, SolidCashParser.RULE_namedArg);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1884;
			this.match(SolidCashParser.Identifier);
			this.state = 1885;
			this.match(SolidCashParser.T__104);
			this.state = 1886;
			this.expression(0);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public expressionList(): ExpressionListContext {
		let localctx: ExpressionListContext = new ExpressionListContext(this, this._ctx, this.state);
		this.enterRule(localctx, 214, SolidCashParser.RULE_expressionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1888;
			this.match(SolidCashParser.T__48);
			this.state = 1900;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 112)) & ~0x1F) === 0 && ((1 << (_la - 112)) & 33622015) !== 0) || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 134078423) !== 0)) {
				{
				this.state = 1889;
				this.expression(0);
				this.state = 1894;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 207, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1890;
						this.match(SolidCashParser.T__4);
						this.state = 1891;
						this.expression(0);
						}
						}
					}
					this.state = 1896;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 207, this._ctx);
				}
				this.state = 1898;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1897;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1902;
			this.match(SolidCashParser.T__49);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public callOptions(): CallOptionsContext {
		let localctx: CallOptionsContext = new CallOptionsContext(this, this._ctx, this.state);
		this.enterRule(localctx, 216, SolidCashParser.RULE_callOptions);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1904;
			this.match(SolidCashParser.T__3);
			this.state = 1905;
			this.callOption();
			this.state = 1910;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 210, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1906;
					this.match(SolidCashParser.T__4);
					this.state = 1907;
					this.callOption();
					}
					}
				}
				this.state = 1912;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 210, this._ctx);
			}
			this.state = 1914;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1913;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1916;
			this.match(SolidCashParser.T__5);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public callOption(): CallOptionContext {
		let localctx: CallOptionContext = new CallOptionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 218, SolidCashParser.RULE_callOption);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1918;
			this.match(SolidCashParser.Identifier);
			this.state = 1919;
			this.match(SolidCashParser.T__104);
			this.state = 1920;
			this.expression(0);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public typeList(): TypeListContext {
		let localctx: TypeListContext = new TypeListContext(this, this._ctx, this.state);
		this.enterRule(localctx, 220, SolidCashParser.RULE_typeList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1922;
			this.match(SolidCashParser.T__48);
			this.state = 1923;
			this.typeName();
			this.state = 1928;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 212, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1924;
					this.match(SolidCashParser.T__4);
					this.state = 1925;
					this.typeName();
					}
					}
				}
				this.state = 1930;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 212, this._ctx);
			}
			this.state = 1932;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1931;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1934;
			this.match(SolidCashParser.T__49);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}

	public expression(): ExpressionContext;
	public expression(_p: number): ExpressionContext;
	// @RuleVersion(0)
	public expression(_p?: number): ExpressionContext {
		if (_p === undefined) {
			_p = 0;
		}

		let _parentctx: ParserRuleContext = this._ctx;
		let _parentState: number = this.state;
		let localctx: ExpressionContext = new ExpressionContext(this, this._ctx, _parentState);
		let _prevctx: ExpressionContext = localctx;
		let _startState: number = 222;
		this.enterRecursionRule(localctx, 222, SolidCashParser.RULE_expression, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2081;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 221, this._ctx) ) {
			case 1:
				{
				localctx = new AssignmentExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 1937;
				this.match(SolidCashParser.T__48);
				this.state = 1938;
				this.match(SolidCashParser.Identifier);
				this.state = 1939;
				(localctx as AssignmentExpressionContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    (localctx as AssignmentExpressionContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1940;
				this.expression(0);
				this.state = 1941;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1943;
				this.match(SolidCashParser.T__48);
				this.state = 1944;
				this.expression(0);
				this.state = 1945;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				{
				localctx = new TupleExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1947;
				this.match(SolidCashParser.T__48);
				this.state = 1948;
				this.expression(0);
				this.state = 1951;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1949;
					this.match(SolidCashParser.T__4);
					this.state = 1950;
					this.expression(0);
					}
					}
					this.state = 1953;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1955;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 4:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1957;
				this.typeCast();
				this.state = 1958;
				this.match(SolidCashParser.T__48);
				this.state = 1959;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 1961;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1960;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1963;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 5:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1965;
				this.functionCall();
				}
				break;
			case 6:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1966;
				this.match(SolidCashParser.T__111);
				this.state = 1967;
				this.match(SolidCashParser.Identifier);
				this.state = 1969;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1968;
					this.callOptions();
					}
				}

				this.state = 1971;
				this.expressionList();
				}
				break;
			case 7:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1972;
				this.match(SolidCashParser.T__111);
				this.state = 1973;
				this.typeName();
				this.state = 1974;
				this.match(SolidCashParser.T__65);
				this.state = 1975;
				this.match(SolidCashParser.T__66);
				this.state = 1976;
				this.match(SolidCashParser.T__48);
				this.state = 1977;
				this.expression(0);
				this.state = 1978;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 8:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1980;
				this.match(SolidCashParser.T__54);
				this.state = 1981;
				this.match(SolidCashParser.T__48);
				this.state = 1982;
				this.typeName();
				this.state = 1983;
				this.match(SolidCashParser.T__49);
				this.state = 1984;
				this.match(SolidCashParser.T__11);
				this.state = 1985;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 9:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1987;
				this.match(SolidCashParser.T__112);
				this.state = 1988;
				this.expressionList();
				}
				break;
			case 10:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1989;
				this.match(SolidCashParser.T__113);
				this.state = 1990;
				this.expressionList();
				}
				break;
			case 11:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1991;
				this.match(SolidCashParser.T__114);
				this.state = 1992;
				this.expressionList();
				}
				break;
			case 12:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1993;
				this.match(SolidCashParser.T__115);
				this.state = 1994;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1995;
				this.match(SolidCashParser.T__116);
				this.state = 1996;
				this.match(SolidCashParser.T__48);
				this.state = 1997;
				this.match(SolidCashParser.Identifier);
				this.state = 1998;
				this.match(SolidCashParser.T__11);
				this.state = 1999;
				this.match(SolidCashParser.Identifier);
				this.state = 2000;
				this.match(SolidCashParser.T__4);
				this.state = 2001;
				this.expressionList();
				this.state = 2002;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 14:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2004;
				this.match(SolidCashParser.T__117);
				this.state = 2005;
				this.expressionList();
				}
				break;
			case 15:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2006;
				this.match(SolidCashParser.T__118);
				this.state = 2007;
				this.expressionList();
				}
				break;
			case 16:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2008;
				this.match(SolidCashParser.T__119);
				this.state = 2009;
				this.match(SolidCashParser.T__48);
				this.state = 2010;
				this.expression(0);
				this.state = 2011;
				this.match(SolidCashParser.T__4);
				this.state = 2012;
				this.typeList();
				this.state = 2013;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 17:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2015;
				this.match(SolidCashParser.T__120);
				this.state = 2016;
				this.match(SolidCashParser.T__48);
				this.state = 2017;
				this.expression(0);
				this.state = 2018;
				this.match(SolidCashParser.T__4);
				this.state = 2019;
				this.typeList();
				this.state = 2020;
				this.match(SolidCashParser.T__4);
				this.state = 2021;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 2022;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 18:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2024;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__121);
				this.state = 2025;
				this.match(SolidCashParser.T__65);
				this.state = 2026;
				this.expression(0);
				this.state = 2027;
				this.match(SolidCashParser.T__66);
				this.state = 2028;
				(localctx as UnaryIntrospectionOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 123)) & ~0x1F) === 0 && ((1 << (_la - 123)) & 31) !== 0))) {
				    (localctx as UnaryIntrospectionOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				break;
			case 19:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2030;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__127);
				this.state = 2031;
				this.match(SolidCashParser.T__65);
				this.state = 2032;
				this.expression(0);
				this.state = 2033;
				this.match(SolidCashParser.T__66);
				this.state = 2034;
				(localctx as UnaryIntrospectionOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 123)) & ~0x1F) === 0 && ((1 << (_la - 123)) & 991) !== 0))) {
				    (localctx as UnaryIntrospectionOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				break;
			case 20:
				{
				localctx = new UnaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2036;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===137)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2037;
				this.expression(21);
				}
				break;
			case 21:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2038;
				this.match(SolidCashParser.T__65);
				this.state = 2050;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 112)) & ~0x1F) === 0 && ((1 << (_la - 112)) & 33622015) !== 0) || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 134078423) !== 0)) {
					{
					this.state = 2039;
					this.expression(0);
					this.state = 2044;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 217, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2040;
							this.match(SolidCashParser.T__4);
							this.state = 2041;
							this.expression(0);
							}
							}
						}
						this.state = 2046;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 217, this._ctx);
					}
					this.state = 2048;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2047;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2052;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 22:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2053;
				this.match(SolidCashParser.T__73);
				this.state = 2054;
				this.match(SolidCashParser.T__11);
				this.state = 2055;
				this.match(SolidCashParser.Identifier);
				this.state = 2056;
				this.match(SolidCashParser.T__11);
				this.state = 2057;
				this.match(SolidCashParser.Identifier);
				this.state = 2058;
				this.match(SolidCashParser.T__65);
				this.state = 2059;
				this.expression(0);
				this.state = 2060;
				this.match(SolidCashParser.T__66);
				this.state = 2061;
				this.memberName();
				}
				break;
			case 23:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2063;
				this.match(SolidCashParser.T__73);
				this.state = 2064;
				this.match(SolidCashParser.T__11);
				this.state = 2065;
				this.match(SolidCashParser.Identifier);
				this.state = 2070;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2066;
						this.match(SolidCashParser.T__65);
						this.state = 2067;
						this.expression(0);
						this.state = 2068;
						this.match(SolidCashParser.T__66);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2072;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 220, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 24:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2074;
				this.match(SolidCashParser.T__73);
				this.state = 2075;
				this.match(SolidCashParser.T__11);
				this.state = 2076;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 25:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2077;
				this.match(SolidCashParser.T__73);
				}
				break;
			case 26:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2078;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 27:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2079;
				this.anyIdentifier();
				}
				break;
			case 28:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2080;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2188;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 228, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2186;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 227, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2083;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 2084;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 2085;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2086;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 2087;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2088;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2089;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 2090;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2091;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2092;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 2093;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===138 || _la===139)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2094;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2095;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 2096;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2097;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2098;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2099;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2100;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2101;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2102;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2103;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2104;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2105;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2106;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2107;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2108;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2109;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2110;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2111;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__139);
						this.state = 2112;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2113;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2114;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__140);
						this.state = 2115;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2116;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 2117;
						this.match(SolidCashParser.T__141);
						this.state = 2118;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 2119;
						this.match(SolidCashParser.T__104);
						this.state = 2120;
						(localctx as TernaryOpContext)._ifFalse = this.expression(9);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2122;
						if (!(this.precpred(this._ctx, 32))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 32)");
						}
						this.state = 2123;
						this.match(SolidCashParser.T__65);
						this.state = 2124;
						(localctx as IndexRangeSliceContext)._start = this.expression(0);
						this.state = 2125;
						this.match(SolidCashParser.T__104);
						this.state = 2126;
						(localctx as IndexRangeSliceContext)._end = this.expression(0);
						this.state = 2127;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2129;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 2130;
						this.match(SolidCashParser.T__65);
						this.state = 2131;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2132;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2133;
						if (!(this.precpred(this._ctx, 30))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 30)");
						}
						this.state = 2134;
						this.match(SolidCashParser.T__65);
						this.state = 2135;
						this.expression(0);
						this.state = 2136;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2138;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2139;
						(localctx as UnaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===133 || _la===134)) {
						    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						}
						break;
					case 17:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2140;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2141;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__134);
						this.state = 2142;
						this.match(SolidCashParser.T__48);
						this.state = 2143;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2144;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2146;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2147;
						this.match(SolidCashParser.T__135);
						this.state = 2148;
						this.match(SolidCashParser.T__48);
						this.state = 2149;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2150;
						this.match(SolidCashParser.T__4);
						this.state = 2151;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2152;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2154;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2155;
						this.match(SolidCashParser.T__11);
						this.state = 2156;
						this.match(SolidCashParser.Identifier);
						this.state = 2158;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2157;
							this.callOptions();
							}
						}

						this.state = 2160;
						this.match(SolidCashParser.T__48);
						this.state = 2161;
						this.match(SolidCashParser.T__3);
						this.state = 2173;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===176) {
							{
							this.state = 2162;
							this.namedArg();
							this.state = 2167;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 223, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2163;
									this.match(SolidCashParser.T__4);
									this.state = 2164;
									this.namedArg();
									}
									}
								}
								this.state = 2169;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 223, this._ctx);
							}
							this.state = 2171;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2170;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2175;
						this.match(SolidCashParser.T__5);
						this.state = 2176;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 20:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2177;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2178;
						this.match(SolidCashParser.T__11);
						this.state = 2179;
						this.match(SolidCashParser.Identifier);
						this.state = 2181;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2180;
							this.callOptions();
							}
						}

						this.state = 2183;
						this.expressionList();
						}
						break;
					case 21:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2184;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 2185;
						this.memberName();
						}
						break;
					}
					}
				}
				this.state = 2190;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 228, this._ctx);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.unrollRecursionContexts(_parentctx);
		}
		return localctx;
	}
	// @RuleVersion(0)
	public memberName(): MemberNameContext {
		let localctx: MemberNameContext = new MemberNameContext(this, this._ctx, this.state);
		this.enterRule(localctx, 224, SolidCashParser.RULE_memberName);
		try {
			this.state = 2204;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2191;
				this.match(SolidCashParser.T__11);
				this.state = 2192;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 123:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2193;
				this.match(SolidCashParser.T__122);
				}
				break;
			case 124:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2194;
				this.match(SolidCashParser.T__123);
				}
				break;
			case 125:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2195;
				this.match(SolidCashParser.T__124);
				}
				break;
			case 126:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2196;
				this.match(SolidCashParser.T__125);
				}
				break;
			case 127:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2197;
				this.match(SolidCashParser.T__126);
				}
				break;
			case 129:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2198;
				this.match(SolidCashParser.T__128);
				}
				break;
			case 130:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2199;
				this.match(SolidCashParser.T__129);
				}
				break;
			case 131:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2200;
				this.match(SolidCashParser.T__130);
				}
				break;
			case 132:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2201;
				this.match(SolidCashParser.T__131);
				}
				break;
			case 143:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2202;
				this.match(SolidCashParser.T__142);
				}
				break;
			case 144:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2203;
				this.match(SolidCashParser.T__143);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public modifier(): ModifierContext {
		let localctx: ModifierContext = new ModifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 226, SolidCashParser.RULE_modifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2206;
			_la = this._input.LA(1);
			if(!(_la===33 || _la===56 || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 31) !== 0))) {
			this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public literal(): LiteralContext {
		let localctx: LiteralContext = new LiteralContext(this, this._ctx, this.state);
		this.enterRule(localctx, 228, SolidCashParser.RULE_literal);
		try {
			let _alt: number;
			this.state = 2222;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 154:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2208;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 158:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2209;
				this.numberLiteral();
				}
				break;
			case 157:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2210;
				this.decimalLiteral();
				}
				break;
			case 164:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2211;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2215;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 230, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2212;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2217;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 230, this._ctx);
				}
				}
				break;
			case 174:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2218;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 175:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2219;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 165:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2220;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 166:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2221;
				this.match(SolidCashParser.HexLiteral);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public numberLiteral(): NumberLiteralContext {
		let localctx: NumberLiteralContext = new NumberLiteralContext(this, this._ctx, this.state);
		this.enterRule(localctx, 230, SolidCashParser.RULE_numberLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2224;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2226;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 232, this._ctx) ) {
			case 1:
				{
				this.state = 2225;
				_la = this._input.LA(1);
				if(!(_la===155 || _la===156)) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				break;
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public decimalLiteral(): DecimalLiteralContext {
		let localctx: DecimalLiteralContext = new DecimalLiteralContext(this, this._ctx, this.state);
		this.enterRule(localctx, 232, SolidCashParser.RULE_decimalLiteral);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2228;
			this.match(SolidCashParser.DecimalLiteral);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public typeName(): TypeNameContext {
		let localctx: TypeNameContext = new TypeNameContext(this, this._ctx, this.state);
		this.enterRule(localctx, 234, SolidCashParser.RULE_typeName);
		let _la: number;
		try {
			this.state = 2274;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 237, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2230;
				this.match(SolidCashParser.T__149);
				this.state = 2231;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2232;
				this.match(SolidCashParser.T__149);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2233;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2234;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2235;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2236;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2237;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2238;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2239;
				this.match(SolidCashParser.T__150);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2240;
				this.match(SolidCashParser.T__151);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2241;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2242;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2243;
				this.match(SolidCashParser.T__6);
				this.state = 2244;
				this.match(SolidCashParser.T__48);
				this.state = 2253;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 74980871) !== 0)) {
					{
					this.state = 2245;
					this.typeName();
					this.state = 2250;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2246;
						this.match(SolidCashParser.T__4);
						this.state = 2247;
						this.typeName();
						}
						}
						this.state = 2252;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2255;
				this.match(SolidCashParser.T__49);
				this.state = 2268;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===73) {
					{
					this.state = 2256;
					this.match(SolidCashParser.T__72);
					this.state = 2257;
					this.match(SolidCashParser.T__48);
					this.state = 2258;
					this.typeName();
					this.state = 2263;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2259;
						this.match(SolidCashParser.T__4);
						this.state = 2260;
						this.typeName();
						}
						}
						this.state = 2265;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2266;
					this.match(SolidCashParser.T__49);
					}
				}

				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2270;
				this.match(SolidCashParser.Identifier);
				this.state = 2271;
				this.match(SolidCashParser.T__11);
				this.state = 2272;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 2273;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public typeCast(): TypeCastContext {
		let localctx: TypeCastContext = new TypeCastContext(this, this._ctx, this.state);
		this.enterRule(localctx, 236, SolidCashParser.RULE_typeCast);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2276;
			_la = this._input.LA(1);
			if(!(_la===59 || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 8134151) !== 0))) {
			this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}

	public sempred(localctx: RuleContext, ruleIndex: number, predIndex: number): boolean {
		switch (ruleIndex) {
		case 41:
			return this.arrayType_sempred(localctx as ArrayTypeContext, predIndex);
		case 111:
			return this.expression_sempred(localctx as ExpressionContext, predIndex);
		}
		return true;
	}
	private arrayType_sempred(localctx: ArrayTypeContext, predIndex: number): boolean {
		switch (predIndex) {
		case 0:
			return this.precpred(this._ctx, 2);
		case 1:
			return this.precpred(this._ctx, 1);
		}
		return true;
	}
	private expression_sempred(localctx: ExpressionContext, predIndex: number): boolean {
		switch (predIndex) {
		case 2:
			return this.precpred(this._ctx, 20);
		case 3:
			return this.precpred(this._ctx, 19);
		case 4:
			return this.precpred(this._ctx, 18);
		case 5:
			return this.precpred(this._ctx, 17);
		case 6:
			return this.precpred(this._ctx, 16);
		case 7:
			return this.precpred(this._ctx, 15);
		case 8:
			return this.precpred(this._ctx, 14);
		case 9:
			return this.precpred(this._ctx, 13);
		case 10:
			return this.precpred(this._ctx, 12);
		case 11:
			return this.precpred(this._ctx, 11);
		case 12:
			return this.precpred(this._ctx, 10);
		case 13:
			return this.precpred(this._ctx, 9);
		case 14:
			return this.precpred(this._ctx, 32);
		case 15:
			return this.precpred(this._ctx, 31);
		case 16:
			return this.precpred(this._ctx, 30);
		case 17:
			return this.precpred(this._ctx, 27);
		case 18:
			return this.precpred(this._ctx, 26);
		case 19:
			return this.precpred(this._ctx, 25);
		case 20:
			return this.precpred(this._ctx, 24);
		case 21:
			return this.precpred(this._ctx, 23);
		case 22:
			return this.precpred(this._ctx, 22);
		}
		return true;
	}

	public static readonly _serializedATN: number[] = [4,1,179,2279,2,0,7,0,
	2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,
	2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,
	17,7,17,2,18,7,18,2,19,7,19,2,20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,
	7,24,2,25,7,25,2,26,7,26,2,27,7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,
	31,2,32,7,32,2,33,7,33,2,34,7,34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,
	2,39,7,39,2,40,7,40,2,41,7,41,2,42,7,42,2,43,7,43,2,44,7,44,2,45,7,45,2,
	46,7,46,2,47,7,47,2,48,7,48,2,49,7,49,2,50,7,50,2,51,7,51,2,52,7,52,2,53,
	7,53,2,54,7,54,2,55,7,55,2,56,7,56,2,57,7,57,2,58,7,58,2,59,7,59,2,60,7,
	60,2,61,7,61,2,62,7,62,2,63,7,63,2,64,7,64,2,65,7,65,2,66,7,66,2,67,7,67,
	2,68,7,68,2,69,7,69,2,70,7,70,2,71,7,71,2,72,7,72,2,73,7,73,2,74,7,74,2,
	75,7,75,2,76,7,76,2,77,7,77,2,78,7,78,2,79,7,79,2,80,7,80,2,81,7,81,2,82,
	7,82,2,83,7,83,2,84,7,84,2,85,7,85,2,86,7,86,2,87,7,87,2,88,7,88,2,89,7,
	89,2,90,7,90,2,91,7,91,2,92,7,92,2,93,7,93,2,94,7,94,2,95,7,95,2,96,7,96,
	2,97,7,97,2,98,7,98,2,99,7,99,2,100,7,100,2,101,7,101,2,102,7,102,2,103,
	7,103,2,104,7,104,2,105,7,105,2,106,7,106,2,107,7,107,2,108,7,108,2,109,
	7,109,2,110,7,110,2,111,7,111,2,112,7,112,2,113,7,113,2,114,7,114,2,115,
	7,115,2,116,7,116,2,117,7,117,2,118,7,118,1,0,5,0,240,8,0,10,0,12,0,243,
	9,0,1,0,5,0,246,8,0,10,0,12,0,249,9,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,
	0,1,0,5,0,261,8,0,10,0,12,0,264,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,5,1,281,8,1,10,1,12,1,284,9,1,1,1,3,1,287,8,1,1,
	1,1,1,1,1,1,1,1,1,3,1,294,8,1,1,2,1,2,1,2,3,2,299,8,2,1,3,1,3,1,3,1,3,5,
	3,305,8,3,10,3,12,3,308,9,3,1,3,3,3,311,8,3,1,3,1,3,5,3,315,8,3,10,3,12,
	3,318,9,3,1,3,1,3,1,4,1,4,1,4,1,4,1,4,3,4,327,8,4,1,4,3,4,330,8,4,1,4,1,
	4,1,4,1,4,1,4,1,4,5,4,338,8,4,10,4,12,4,341,9,4,1,4,3,4,344,8,4,1,4,1,4,
	1,4,1,4,3,4,350,8,4,1,4,3,4,353,8,4,1,4,1,4,3,4,357,8,4,1,5,1,5,1,5,3,5,
	362,8,5,1,5,1,5,3,5,366,8,5,1,6,1,6,1,7,1,7,1,8,1,8,1,8,1,8,1,8,1,9,1,9,
	1,10,1,10,3,10,381,8,10,1,11,3,11,384,8,11,1,11,1,11,1,12,1,12,1,13,1,13,
	1,13,1,13,1,13,1,13,5,13,396,8,13,10,13,12,13,399,9,13,3,13,401,8,13,1,
	13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,5,13,412,8,13,10,13,12,13,415,
	9,13,1,13,1,13,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,3,14,429,
	8,14,1,15,1,15,1,15,1,15,1,15,1,16,1,16,1,17,1,17,1,17,1,17,5,17,442,8,
	17,10,17,12,17,445,9,17,1,17,3,17,448,8,17,1,17,1,17,1,18,1,18,1,18,1,18,
	5,18,456,8,18,10,18,12,18,459,9,18,1,18,5,18,462,8,18,10,18,12,18,465,9,
	18,1,18,5,18,468,8,18,10,18,12,18,471,9,18,1,18,5,18,474,8,18,10,18,12,
	18,477,9,18,1,18,5,18,480,8,18,10,18,12,18,483,9,18,1,18,5,18,486,8,18,
	10,18,12,18,489,9,18,1,18,5,18,492,8,18,10,18,12,18,495,9,18,1,18,5,18,
	498,8,18,10,18,12,18,501,9,18,1,18,1,18,1,19,3,19,506,8,19,1,19,1,19,1,
	19,3,19,511,8,19,1,19,1,19,1,19,1,19,5,19,517,8,19,10,19,12,19,520,9,19,
	3,19,522,8,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,
	19,1,19,1,19,1,19,5,19,539,8,19,10,19,12,19,542,9,19,1,19,1,19,1,20,1,20,
	3,20,548,8,20,1,21,1,21,1,21,1,21,5,21,554,8,21,10,21,12,21,557,9,21,1,
	21,5,21,560,8,21,10,21,12,21,563,9,21,1,21,3,21,566,8,21,1,21,1,21,1,22,
	1,22,1,22,1,22,1,22,1,22,5,22,576,8,22,10,22,12,22,579,9,22,1,22,3,22,582,
	8,22,3,22,584,8,22,1,22,1,22,3,22,588,8,22,1,22,1,22,1,23,1,23,3,23,594,
	8,23,1,23,3,23,597,8,23,1,23,1,23,1,24,1,24,1,24,1,24,1,24,1,24,5,24,607,
	8,24,10,24,12,24,610,9,24,1,24,3,24,613,8,24,3,24,615,8,24,1,24,1,24,1,
	24,1,25,1,25,1,25,1,26,1,26,1,26,1,26,4,26,627,8,26,11,26,12,26,628,1,26,
	1,26,1,27,1,27,3,27,635,8,27,1,27,1,27,1,27,1,28,1,28,1,28,1,28,1,28,1,
	28,5,28,646,8,28,10,28,12,28,649,9,28,1,28,3,28,652,8,28,1,28,1,28,1,29,
	1,29,1,29,3,29,659,8,29,1,30,1,30,1,30,1,30,1,30,1,30,1,31,1,31,1,31,1,
	31,1,31,1,31,1,31,1,32,1,32,1,32,5,32,677,8,32,10,32,12,32,680,9,32,1,32,
	5,32,683,8,32,10,32,12,32,686,9,32,1,32,1,32,5,32,690,8,32,10,32,12,32,
	693,9,32,1,32,1,32,1,33,1,33,1,33,1,33,5,33,701,8,33,10,33,12,33,704,9,
	33,1,33,5,33,707,8,33,10,33,12,33,710,9,33,1,33,1,33,5,33,714,8,33,10,33,
	12,33,717,9,33,1,33,1,33,1,34,1,34,1,34,3,34,724,8,34,1,35,1,35,1,35,1,
	35,1,35,1,35,1,35,5,35,733,8,35,10,35,12,35,736,9,35,1,35,1,35,1,36,1,36,
	1,36,1,37,3,37,744,8,37,1,37,1,37,5,37,748,8,37,10,37,12,37,751,9,37,1,
	37,1,37,1,37,3,37,756,8,37,1,37,1,37,1,37,1,37,1,37,5,37,763,8,37,10,37,
	12,37,766,9,37,1,37,1,37,1,37,3,37,771,8,37,1,37,1,37,1,37,3,37,776,8,37,
	1,37,1,37,5,37,780,8,37,10,37,12,37,783,9,37,1,37,1,37,1,37,1,37,3,37,789,
	8,37,1,37,1,37,5,37,793,8,37,10,37,12,37,796,9,37,1,37,1,37,1,37,3,37,801,
	8,37,1,37,1,37,3,37,805,8,37,1,38,1,38,3,38,809,8,38,1,39,1,39,1,40,1,40,
	1,40,1,40,3,40,817,8,40,1,40,1,40,1,40,3,40,822,8,40,1,40,1,40,1,40,1,40,
	1,40,1,40,3,40,830,8,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,3,40,840,
	8,40,1,40,1,40,1,40,3,40,845,8,40,1,40,1,40,3,40,849,8,40,1,41,1,41,1,41,
	1,41,1,41,1,41,1,41,1,41,1,41,1,41,3,41,861,8,41,1,41,1,41,1,41,1,41,1,
	41,1,41,1,41,5,41,870,8,41,10,41,12,41,873,9,41,1,42,1,42,1,42,3,42,878,
	8,42,1,42,1,42,5,42,882,8,42,10,42,12,42,885,9,42,1,42,1,42,1,43,1,43,3,
	43,891,8,43,1,44,1,44,1,44,1,45,1,45,1,45,1,45,5,45,900,8,45,10,45,12,45,
	903,9,45,1,45,5,45,906,8,45,10,45,12,45,909,9,45,1,45,3,45,912,8,45,1,45,
	1,45,5,45,916,8,45,10,45,12,45,919,9,45,1,45,1,45,1,46,1,46,3,46,925,8,
	46,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,
	3,47,941,8,47,1,48,1,48,1,48,1,48,1,48,5,48,948,8,48,10,48,12,48,951,9,
	48,1,48,3,48,954,8,48,1,49,1,49,1,49,1,49,3,49,960,8,49,1,50,1,50,1,50,
	1,50,1,50,5,50,967,8,50,10,50,12,50,970,9,50,1,50,3,50,973,8,50,1,50,1,
	50,1,51,1,51,5,51,979,8,51,10,51,12,51,982,9,51,1,51,3,51,985,8,51,1,51,
	1,51,5,51,989,8,51,10,51,12,51,992,9,51,1,51,3,51,995,8,51,3,51,997,8,51,
	1,52,1,52,1,52,1,52,5,52,1003,8,52,10,52,12,52,1006,9,52,1,52,3,52,1009,
	8,52,3,52,1011,8,52,1,52,1,52,1,53,1,53,5,53,1017,8,53,10,53,12,53,1020,
	9,53,1,53,3,53,1023,8,53,1,53,1,53,5,53,1027,8,53,10,53,12,53,1030,9,53,
	1,53,3,53,1033,8,53,3,53,1035,8,53,1,54,1,54,5,54,1039,8,54,10,54,12,54,
	1042,9,54,1,54,1,54,3,54,1046,8,54,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,
	55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,
	1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,3,55,1079,8,55,1,56,1,56,1,
	56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,57,1,57,1,57,1,57,1,57,1,57,1,57,
	1,57,1,57,1,57,1,57,1,57,5,57,1103,8,57,10,57,12,57,1106,9,57,1,57,1,57,
	1,57,1,58,1,58,1,58,1,58,1,58,1,58,5,58,1117,8,58,10,58,12,58,1120,9,58,
	1,58,1,58,1,58,1,58,1,58,1,58,1,58,5,58,1129,8,58,10,58,12,58,1132,9,58,
	1,58,3,58,1135,8,58,1,58,1,58,1,58,3,58,1140,8,58,1,59,1,59,1,59,3,59,1145,
	8,59,1,59,1,59,1,59,1,59,1,59,5,59,1152,8,59,10,59,12,59,1155,9,59,1,59,
	3,59,1158,8,59,3,59,1160,8,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,
	59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,3,59,1182,8,59,
	1,59,1,59,1,59,3,59,1187,8,59,1,60,1,60,1,60,1,60,3,60,1193,8,60,1,60,1,
	60,1,60,1,61,1,61,1,61,1,61,1,61,1,61,1,62,1,62,1,62,1,62,3,62,1208,8,62,
	1,62,1,62,1,62,1,62,1,62,5,62,1215,8,62,10,62,12,62,1218,9,62,1,62,3,62,
	1221,8,62,3,62,1223,8,62,1,62,1,62,1,62,1,62,1,62,1,62,1,62,3,62,1232,8,
	62,1,62,1,62,1,62,3,62,1237,8,62,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,
	1246,8,63,11,63,12,63,1247,3,63,1250,8,63,1,63,1,63,5,63,1254,8,63,10,63,
	12,63,1257,9,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1268,
	8,63,11,63,12,63,1269,1,63,1,63,5,63,1274,8,63,10,63,12,63,1277,9,63,1,
	63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1286,8,63,11,63,12,63,1287,1,63,1,
	63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1301,8,63,11,63,12,
	63,1302,3,63,1305,8,63,1,63,1,63,5,63,1309,8,63,10,63,12,63,1312,9,63,1,
	63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1321,8,63,11,63,12,63,1322,1,63,1,
	63,5,63,1327,8,63,10,63,12,63,1330,9,63,1,63,1,63,1,63,1,63,1,63,1,63,4,
	63,1338,8,63,11,63,12,63,1339,1,63,1,63,3,63,1344,8,63,1,64,1,64,1,64,1,
	64,1,64,1,64,1,64,5,64,1353,8,64,10,64,12,64,1356,9,64,1,64,1,64,1,64,1,
	64,1,64,1,64,1,65,1,65,5,65,1366,8,65,10,65,12,65,1369,9,65,1,65,1,65,1,
	65,3,65,1374,8,65,1,65,1,65,1,65,1,65,5,65,1380,8,65,10,65,12,65,1383,9,
	65,1,65,1,65,1,65,3,65,1388,8,65,1,65,1,65,3,65,1392,8,65,1,66,1,66,1,66,
	1,66,1,66,1,66,4,66,1400,8,66,11,66,12,66,1401,1,66,1,66,1,66,1,66,1,66,
	1,66,1,66,1,66,4,66,1412,8,66,11,66,12,66,1413,1,66,1,66,1,66,1,66,1,66,
	1,66,4,66,1422,8,66,11,66,12,66,1423,1,66,1,66,1,66,1,66,1,66,1,66,1,66,
	4,66,1433,8,66,11,66,12,66,1434,1,66,1,66,1,66,1,66,1,66,3,66,1442,8,66,
	1,67,1,67,5,67,1446,8,67,10,67,12,67,1449,9,67,1,67,1,67,1,67,1,67,3,67,
	1455,8,67,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,3,68,1468,
	8,68,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,70,1,70,1,70,1,70,1,70,1,70,1,
	71,1,71,1,71,1,71,1,71,1,71,1,71,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,
	1,72,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,74,1,74,1,74,1,74,1,74,1,
	74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,4,74,1523,8,74,11,
	74,12,74,1524,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,4,74,1535,8,74,11,
	74,12,74,1536,1,74,1,74,3,74,1541,8,74,1,75,1,75,1,75,1,75,1,75,1,75,1,
	75,3,75,1550,8,75,1,75,1,75,1,75,1,76,1,76,1,76,1,76,1,76,3,76,1560,8,76,
	1,76,1,76,1,76,1,77,1,77,1,77,1,77,1,77,1,77,1,77,3,77,1572,8,77,1,78,1,
	78,1,78,1,78,1,78,1,78,3,78,1580,8,78,1,79,1,79,1,79,1,79,1,79,1,79,1,79,
	1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,80,1,80,1,80,1,80,1,80,1,
	80,1,80,1,80,1,80,1,80,1,80,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,
	1,81,1,81,1,82,1,82,1,82,1,82,1,82,3,82,1625,8,82,1,82,1,82,1,82,1,83,1,
	83,5,83,1632,8,83,10,83,12,83,1635,9,83,1,83,1,83,1,83,3,83,1640,8,83,1,
	83,1,83,1,84,1,84,1,84,1,85,1,85,1,85,1,85,1,85,3,85,1652,8,85,1,86,1,86,
	1,86,1,86,1,86,1,86,1,86,1,86,1,87,1,87,1,87,1,87,1,87,1,87,1,88,1,88,1,
	88,1,88,1,89,1,89,1,89,5,89,1675,8,89,10,89,12,89,1678,9,89,1,89,1,89,1,
	90,1,90,1,91,1,91,1,91,5,91,1687,8,91,10,91,12,91,1690,9,91,1,91,1,91,1,
	92,1,92,1,92,1,92,1,92,1,92,5,92,1700,8,92,10,92,12,92,1703,9,92,1,92,3,
	92,1706,8,92,1,92,1,92,1,93,1,93,1,93,1,93,5,93,1714,8,93,10,93,12,93,1717,
	9,93,1,94,1,94,1,94,5,94,1722,8,94,10,94,12,94,1725,9,94,1,95,1,95,1,95,
	3,95,1730,8,95,1,95,1,95,4,95,1734,8,95,11,95,12,95,1735,1,96,1,96,1,96,
	1,96,1,96,5,96,1743,8,96,10,96,12,96,1746,9,96,1,96,3,96,1749,8,96,3,96,
	1751,8,96,1,96,1,96,1,97,1,97,3,97,1757,8,97,1,97,1,97,1,97,1,97,5,97,1763,
	8,97,10,97,12,97,1766,9,97,1,97,3,97,1769,8,97,3,97,1771,8,97,1,97,3,97,
	1774,8,97,1,97,1,97,1,98,1,98,1,98,1,99,1,99,1,99,1,100,1,100,1,100,3,100,
	1787,8,100,1,101,1,101,1,101,1,101,3,101,1793,8,101,1,101,1,101,1,101,1,
	101,1,101,5,101,1800,8,101,10,101,12,101,1803,9,101,1,101,3,101,1806,8,
	101,3,101,1808,8,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,3,101,1817,
	8,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,
	1,101,3,101,1831,8,101,1,102,1,102,1,102,1,102,1,102,1,102,1,103,1,103,
	3,103,1841,8,103,1,104,1,104,1,104,1,104,5,104,1847,8,104,10,104,12,104,
	1850,9,104,1,104,3,104,1853,8,104,3,104,1855,8,104,1,104,1,104,1,105,1,
	105,1,105,1,105,1,105,1,105,1,105,1,105,1,105,1,105,1,105,1,105,5,105,1871,
	8,105,10,105,12,105,1874,9,105,1,105,3,105,1877,8,105,3,105,1879,8,105,
	1,105,1,105,3,105,1883,8,105,1,106,1,106,1,106,1,106,1,107,1,107,1,107,
	1,107,5,107,1893,8,107,10,107,12,107,1896,9,107,1,107,3,107,1899,8,107,
	3,107,1901,8,107,1,107,1,107,1,108,1,108,1,108,1,108,5,108,1909,8,108,10,
	108,12,108,1912,9,108,1,108,3,108,1915,8,108,1,108,1,108,1,109,1,109,1,
	109,1,109,1,110,1,110,1,110,1,110,5,110,1927,8,110,10,110,12,110,1930,9,
	110,1,110,3,110,1933,8,110,1,110,1,110,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,4,111,1952,8,
	111,11,111,12,111,1953,1,111,1,111,1,111,1,111,1,111,1,111,3,111,1962,8,
	111,1,111,1,111,1,111,1,111,1,111,1,111,3,111,1970,8,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,5,111,2043,8,111,10,
	111,12,111,2046,9,111,1,111,3,111,2049,8,111,3,111,2051,8,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,4,111,2071,8,111,11,111,12,111,2072,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,3,111,2082,8,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,3,111,
	2159,8,111,1,111,1,111,1,111,1,111,1,111,5,111,2166,8,111,10,111,12,111,
	2169,9,111,1,111,3,111,2172,8,111,3,111,2174,8,111,1,111,1,111,1,111,1,
	111,1,111,1,111,3,111,2182,8,111,1,111,1,111,1,111,5,111,2187,8,111,10,
	111,12,111,2190,9,111,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,
	112,1,112,1,112,1,112,1,112,3,112,2205,8,112,1,113,1,113,1,114,1,114,1,
	114,1,114,1,114,5,114,2214,8,114,10,114,12,114,2217,9,114,1,114,1,114,1,
	114,1,114,3,114,2223,8,114,1,115,1,115,3,115,2227,8,115,1,116,1,116,1,117,
	1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,
	1,117,1,117,1,117,1,117,1,117,5,117,2249,8,117,10,117,12,117,2252,9,117,
	3,117,2254,8,117,1,117,1,117,1,117,1,117,1,117,1,117,5,117,2262,8,117,10,
	117,12,117,2265,9,117,1,117,1,117,3,117,2269,8,117,1,117,1,117,1,117,1,
	117,3,117,2275,8,117,1,118,1,118,1,118,0,2,82,222,119,0,2,4,6,8,10,12,14,
	16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,
	64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,
	110,112,114,116,118,120,122,124,126,128,130,132,134,136,138,140,142,144,
	146,148,150,152,154,156,158,160,162,164,166,168,170,172,174,176,178,180,
	182,184,186,188,190,192,194,196,198,200,202,204,206,208,210,212,214,216,
	218,220,222,224,226,228,230,232,234,236,0,23,2,0,10,10,13,27,5,0,11,11,
	28,36,156,156,160,160,176,176,1,0,38,39,3,0,20,23,26,27,40,40,1,0,43,44,
	2,0,43,44,58,59,3,0,43,44,58,58,63,63,2,0,158,158,176,176,2,0,40,40,77,
	86,1,0,87,88,3,0,158,158,166,166,176,176,1,0,123,127,2,0,123,127,129,132,
	3,0,14,14,27,27,137,137,2,0,10,10,15,16,1,0,13,14,1,0,138,139,1,0,20,23,
	1,0,18,19,1,0,133,134,3,0,33,33,56,56,145,149,1,0,155,156,4,0,59,59,150,
	152,159,162,168,172,2562,0,241,1,0,0,0,2,293,1,0,0,0,4,295,1,0,0,0,6,300,
	1,0,0,0,8,356,1,0,0,0,10,358,1,0,0,0,12,367,1,0,0,0,14,369,1,0,0,0,16,371,
	1,0,0,0,18,376,1,0,0,0,20,378,1,0,0,0,22,383,1,0,0,0,24,387,1,0,0,0,26,
	389,1,0,0,0,28,428,1,0,0,0,30,430,1,0,0,0,32,435,1,0,0,0,34,437,1,0,0,0,
	36,451,1,0,0,0,38,505,1,0,0,0,40,545,1,0,0,0,42,549,1,0,0,0,44,569,1,0,
	0,0,46,593,1,0,0,0,48,600,1,0,0,0,50,619,1,0,0,0,52,622,1,0,0,0,54,634,
	1,0,0,0,56,639,1,0,0,0,58,655,1,0,0,0,60,660,1,0,0,0,62,666,1,0,0,0,64,
	673,1,0,0,0,66,696,1,0,0,0,68,723,1,0,0,0,70,725,1,0,0,0,72,739,1,0,0,0,
	74,804,1,0,0,0,76,808,1,0,0,0,78,810,1,0,0,0,80,848,1,0,0,0,82,860,1,0,
	0,0,84,874,1,0,0,0,86,890,1,0,0,0,88,892,1,0,0,0,90,895,1,0,0,0,92,922,
	1,0,0,0,94,940,1,0,0,0,96,942,1,0,0,0,98,955,1,0,0,0,100,961,1,0,0,0,102,
	996,1,0,0,0,104,998,1,0,0,0,106,1034,1,0,0,0,108,1045,1,0,0,0,110,1078,
	1,0,0,0,112,1080,1,0,0,0,114,1090,1,0,0,0,116,1139,1,0,0,0,118,1186,1,0,
	0,0,120,1188,1,0,0,0,122,1197,1,0,0,0,124,1236,1,0,0,0,126,1343,1,0,0,0,
	128,1345,1,0,0,0,130,1391,1,0,0,0,132,1441,1,0,0,0,134,1454,1,0,0,0,136,
	1467,1,0,0,0,138,1469,1,0,0,0,140,1476,1,0,0,0,142,1482,1,0,0,0,144,1489,
	1,0,0,0,146,1498,1,0,0,0,148,1540,1,0,0,0,150,1542,1,0,0,0,152,1554,1,0,
	0,0,154,1564,1,0,0,0,156,1579,1,0,0,0,158,1581,1,0,0,0,160,1597,1,0,0,0,
	162,1608,1,0,0,0,164,1619,1,0,0,0,166,1629,1,0,0,0,168,1643,1,0,0,0,170,
	1651,1,0,0,0,172,1653,1,0,0,0,174,1661,1,0,0,0,176,1667,1,0,0,0,178,1671,
	1,0,0,0,180,1681,1,0,0,0,182,1683,1,0,0,0,184,1693,1,0,0,0,186,1709,1,0,
	0,0,188,1718,1,0,0,0,190,1726,1,0,0,0,192,1737,1,0,0,0,194,1754,1,0,0,0,
	196,1777,1,0,0,0,198,1780,1,0,0,0,200,1786,1,0,0,0,202,1830,1,0,0,0,204,
	1832,1,0,0,0,206,1840,1,0,0,0,208,1842,1,0,0,0,210,1882,1,0,0,0,212,1884,
	1,0,0,0,214,1888,1,0,0,0,216,1904,1,0,0,0,218,1918,1,0,0,0,220,1922,1,0,
	0,0,222,2081,1,0,0,0,224,2204,1,0,0,0,226,2206,1,0,0,0,228,2222,1,0,0,0,
	230,2224,1,0,0,0,232,2228,1,0,0,0,234,2274,1,0,0,0,236,2276,1,0,0,0,238,
	240,3,16,8,0,239,238,1,0,0,0,240,243,1,0,0,0,241,239,1,0,0,0,241,242,1,
	0,0,0,242,247,1,0,0,0,243,241,1,0,0,0,244,246,3,2,1,0,245,244,1,0,0,0,246,
	249,1,0,0,0,247,245,1,0,0,0,247,248,1,0,0,0,248,262,1,0,0,0,249,247,1,0,
	0,0,250,261,3,62,31,0,251,261,3,56,28,0,252,261,3,52,26,0,253,261,3,60,
	30,0,254,261,3,8,4,0,255,261,3,48,24,0,256,261,3,26,13,0,257,261,3,6,3,
	0,258,261,3,36,18,0,259,261,3,38,19,0,260,250,1,0,0,0,260,251,1,0,0,0,260,
	252,1,0,0,0,260,253,1,0,0,0,260,254,1,0,0,0,260,255,1,0,0,0,260,256,1,0,
	0,0,260,257,1,0,0,0,260,258,1,0,0,0,260,259,1,0,0,0,261,264,1,0,0,0,262,
	260,1,0,0,0,262,263,1,0,0,0,263,265,1,0,0,0,264,262,1,0,0,0,265,266,5,0,
	0,1,266,1,1,0,0,0,267,268,5,1,0,0,268,269,5,164,0,0,269,294,5,2,0,0,270,
	271,5,1,0,0,271,272,5,164,0,0,272,273,5,3,0,0,273,274,5,176,0,0,274,294,
	5,2,0,0,275,276,5,1,0,0,276,277,5,4,0,0,277,282,3,4,2,0,278,279,5,5,0,0,
	279,281,3,4,2,0,280,278,1,0,0,0,281,284,1,0,0,0,282,280,1,0,0,0,282,283,
	1,0,0,0,283,286,1,0,0,0,284,282,1,0,0,0,285,287,5,5,0,0,286,285,1,0,0,0,
	286,287,1,0,0,0,287,288,1,0,0,0,288,289,5,6,0,0,289,290,5,176,0,0,290,291,
	5,164,0,0,291,292,5,2,0,0,292,294,1,0,0,0,293,267,1,0,0,0,293,270,1,0,0,
	0,293,275,1,0,0,0,294,3,1,0,0,0,295,298,5,176,0,0,296,297,5,3,0,0,297,299,
	5,176,0,0,298,296,1,0,0,0,298,299,1,0,0,0,299,5,1,0,0,0,300,301,5,7,0,0,
	301,302,3,14,7,0,302,306,3,104,52,0,303,305,3,94,47,0,304,303,1,0,0,0,305,
	308,1,0,0,0,306,304,1,0,0,0,306,307,1,0,0,0,307,310,1,0,0,0,308,306,1,0,
	0,0,309,311,3,100,50,0,310,309,1,0,0,0,310,311,1,0,0,0,311,312,1,0,0,0,
	312,316,5,4,0,0,313,315,3,110,55,0,314,313,1,0,0,0,315,318,1,0,0,0,316,
	314,1,0,0,0,316,317,1,0,0,0,317,319,1,0,0,0,318,316,1,0,0,0,319,320,5,6,
	0,0,320,7,1,0,0,0,321,322,5,8,0,0,322,323,5,176,0,0,323,326,5,9,0,0,324,
	327,3,234,117,0,325,327,5,10,0,0,326,324,1,0,0,0,326,325,1,0,0,0,327,329,
	1,0,0,0,328,330,5,11,0,0,329,328,1,0,0,0,329,330,1,0,0,0,330,331,1,0,0,
	0,331,357,5,2,0,0,332,333,5,8,0,0,333,334,5,4,0,0,334,339,3,10,5,0,335,
	336,5,5,0,0,336,338,3,10,5,0,337,335,1,0,0,0,338,341,1,0,0,0,339,337,1,
	0,0,0,339,340,1,0,0,0,340,343,1,0,0,0,341,339,1,0,0,0,342,344,5,5,0,0,343,
	342,1,0,0,0,343,344,1,0,0,0,344,345,1,0,0,0,345,346,5,6,0,0,346,349,5,9,
	0,0,347,350,3,234,117,0,348,350,5,10,0,0,349,347,1,0,0,0,349,348,1,0,0,
	0,350,352,1,0,0,0,351,353,5,11,0,0,352,351,1,0,0,0,352,353,1,0,0,0,353,
	354,1,0,0,0,354,355,5,2,0,0,355,357,1,0,0,0,356,321,1,0,0,0,356,332,1,0,
	0,0,357,9,1,0,0,0,358,361,5,176,0,0,359,360,5,12,0,0,360,362,5,176,0,0,
	361,359,1,0,0,0,361,362,1,0,0,0,362,365,1,0,0,0,363,364,5,3,0,0,364,366,
	3,12,6,0,365,363,1,0,0,0,365,366,1,0,0,0,366,11,1,0,0,0,367,368,7,0,0,0,
	368,13,1,0,0,0,369,370,7,1,0,0,370,15,1,0,0,0,371,372,5,37,0,0,372,373,
	3,18,9,0,373,374,3,20,10,0,374,375,5,2,0,0,375,17,1,0,0,0,376,377,7,2,0,
	0,377,19,1,0,0,0,378,380,3,22,11,0,379,381,3,22,11,0,380,379,1,0,0,0,380,
	381,1,0,0,0,381,21,1,0,0,0,382,384,3,24,12,0,383,382,1,0,0,0,383,384,1,
	0,0,0,384,385,1,0,0,0,385,386,5,153,0,0,386,23,1,0,0,0,387,388,7,3,0,0,
	388,25,1,0,0,0,389,390,5,41,0,0,390,400,5,176,0,0,391,392,5,42,0,0,392,
	397,5,176,0,0,393,394,5,5,0,0,394,396,5,176,0,0,395,393,1,0,0,0,396,399,
	1,0,0,0,397,395,1,0,0,0,397,398,1,0,0,0,398,401,1,0,0,0,399,397,1,0,0,0,
	400,391,1,0,0,0,400,401,1,0,0,0,401,402,1,0,0,0,402,413,5,4,0,0,403,412,
	3,56,28,0,404,412,3,52,26,0,405,412,3,60,30,0,406,412,3,44,22,0,407,412,
	3,48,24,0,408,412,3,30,15,0,409,412,3,28,14,0,410,412,3,34,17,0,411,403,
	1,0,0,0,411,404,1,0,0,0,411,405,1,0,0,0,411,406,1,0,0,0,411,407,1,0,0,0,
	411,408,1,0,0,0,411,409,1,0,0,0,411,410,1,0,0,0,412,415,1,0,0,0,413,411,
	1,0,0,0,413,414,1,0,0,0,414,416,1,0,0,0,415,413,1,0,0,0,416,417,5,6,0,0,
	417,27,1,0,0,0,418,419,3,32,16,0,419,420,3,80,40,0,420,421,5,176,0,0,421,
	422,5,2,0,0,422,429,1,0,0,0,423,424,3,32,16,0,424,425,3,82,41,0,425,426,
	5,176,0,0,426,427,5,2,0,0,427,429,1,0,0,0,428,418,1,0,0,0,428,423,1,0,0,
	0,429,29,1,0,0,0,430,431,3,32,16,0,431,432,3,234,117,0,432,433,5,176,0,
	0,433,434,5,2,0,0,434,31,1,0,0,0,435,436,7,4,0,0,436,33,1,0,0,0,437,438,
	5,7,0,0,438,439,5,176,0,0,439,443,3,104,52,0,440,442,3,94,47,0,441,440,
	1,0,0,0,442,445,1,0,0,0,443,441,1,0,0,0,443,444,1,0,0,0,444,447,1,0,0,0,
	445,443,1,0,0,0,446,448,3,100,50,0,447,446,1,0,0,0,447,448,1,0,0,0,448,
	449,1,0,0,0,449,450,5,2,0,0,450,35,1,0,0,0,451,452,5,45,0,0,452,453,5,176,
	0,0,453,457,5,4,0,0,454,456,3,56,28,0,455,454,1,0,0,0,456,459,1,0,0,0,457,
	455,1,0,0,0,457,458,1,0,0,0,458,463,1,0,0,0,459,457,1,0,0,0,460,462,3,52,
	26,0,461,460,1,0,0,0,462,465,1,0,0,0,463,461,1,0,0,0,463,464,1,0,0,0,464,
	469,1,0,0,0,465,463,1,0,0,0,466,468,3,60,30,0,467,466,1,0,0,0,468,471,1,
	0,0,0,469,467,1,0,0,0,469,470,1,0,0,0,470,475,1,0,0,0,471,469,1,0,0,0,472,
	474,3,44,22,0,473,472,1,0,0,0,474,477,1,0,0,0,475,473,1,0,0,0,475,476,1,
	0,0,0,476,481,1,0,0,0,477,475,1,0,0,0,478,480,3,48,24,0,479,478,1,0,0,0,
	480,483,1,0,0,0,481,479,1,0,0,0,481,482,1,0,0,0,482,487,1,0,0,0,483,481,
	1,0,0,0,484,486,3,62,31,0,485,484,1,0,0,0,486,489,1,0,0,0,487,485,1,0,0,
	0,487,488,1,0,0,0,488,493,1,0,0,0,489,487,1,0,0,0,490,492,3,8,4,0,491,490,
	1,0,0,0,492,495,1,0,0,0,493,491,1,0,0,0,493,494,1,0,0,0,494,499,1,0,0,0,
	495,493,1,0,0,0,496,498,3,6,3,0,497,496,1,0,0,0,498,501,1,0,0,0,499,497,
	1,0,0,0,499,500,1,0,0,0,500,502,1,0,0,0,501,499,1,0,0,0,502,503,5,6,0,0,
	503,37,1,0,0,0,504,506,5,46,0,0,505,504,1,0,0,0,505,506,1,0,0,0,506,507,
	1,0,0,0,507,508,5,47,0,0,508,510,5,176,0,0,509,511,3,104,52,0,510,509,1,
	0,0,0,510,511,1,0,0,0,511,521,1,0,0,0,512,513,5,42,0,0,513,518,3,40,20,
	0,514,515,5,5,0,0,515,517,3,40,20,0,516,514,1,0,0,0,517,520,1,0,0,0,518,
	516,1,0,0,0,518,519,1,0,0,0,519,522,1,0,0,0,520,518,1,0,0,0,521,512,1,0,
	0,0,521,522,1,0,0,0,522,523,1,0,0,0,523,540,5,4,0,0,524,539,3,56,28,0,525,
	539,3,52,26,0,526,539,3,60,30,0,527,539,3,44,22,0,528,539,3,48,24,0,529,
	539,3,62,31,0,530,539,3,8,4,0,531,539,3,74,37,0,532,539,3,84,42,0,533,539,
	3,64,32,0,534,539,3,90,45,0,535,539,3,42,21,0,536,539,3,66,33,0,537,539,
	3,70,35,0,538,524,1,0,0,0,538,525,1,0,0,0,538,526,1,0,0,0,538,527,1,0,0,
	0,538,528,1,0,0,0,538,529,1,0,0,0,538,530,1,0,0,0,538,531,1,0,0,0,538,532,
	1,0,0,0,538,533,1,0,0,0,538,534,1,0,0,0,538,535,1,0,0,0,538,536,1,0,0,0,
	538,537,1,0,0,0,539,542,1,0,0,0,540,538,1,0,0,0,540,541,1,0,0,0,541,543,
	1,0,0,0,542,540,1,0,0,0,543,544,5,6,0,0,544,39,1,0,0,0,545,547,5,176,0,
	0,546,548,3,214,107,0,547,546,1,0,0,0,547,548,1,0,0,0,548,41,1,0,0,0,549,
	550,5,7,0,0,550,551,3,14,7,0,551,555,3,104,52,0,552,554,3,94,47,0,553,552,
	1,0,0,0,554,557,1,0,0,0,555,553,1,0,0,0,555,556,1,0,0,0,556,561,1,0,0,0,
	557,555,1,0,0,0,558,560,3,92,46,0,559,558,1,0,0,0,560,563,1,0,0,0,561,559,
	1,0,0,0,561,562,1,0,0,0,562,565,1,0,0,0,563,561,1,0,0,0,564,566,3,100,50,
	0,565,564,1,0,0,0,565,566,1,0,0,0,566,567,1,0,0,0,567,568,5,2,0,0,568,43,
	1,0,0,0,569,570,5,48,0,0,570,571,5,176,0,0,571,583,5,49,0,0,572,577,3,46,
	23,0,573,574,5,5,0,0,574,576,3,46,23,0,575,573,1,0,0,0,576,579,1,0,0,0,
	577,575,1,0,0,0,577,578,1,0,0,0,578,581,1,0,0,0,579,577,1,0,0,0,580,582,
	5,5,0,0,581,580,1,0,0,0,581,582,1,0,0,0,582,584,1,0,0,0,583,572,1,0,0,0,
	583,584,1,0,0,0,584,585,1,0,0,0,585,587,5,50,0,0,586,588,5,51,0,0,587,586,
	1,0,0,0,587,588,1,0,0,0,588,589,1,0,0,0,589,590,5,2,0,0,590,45,1,0,0,0,
	591,594,3,234,117,0,592,594,3,82,41,0,593,591,1,0,0,0,593,592,1,0,0,0,594,
	596,1,0,0,0,595,597,5,52,0,0,596,595,1,0,0,0,596,597,1,0,0,0,597,598,1,
	0,0,0,598,599,5,176,0,0,599,47,1,0,0,0,600,601,5,35,0,0,601,602,5,176,0,
	0,602,614,5,49,0,0,603,608,3,50,25,0,604,605,5,5,0,0,605,607,3,50,25,0,
	606,604,1,0,0,0,607,610,1,0,0,0,608,606,1,0,0,0,608,609,1,0,0,0,609,612,
	1,0,0,0,610,608,1,0,0,0,611,613,5,5,0,0,612,611,1,0,0,0,612,613,1,0,0,0,
	613,615,1,0,0,0,614,603,1,0,0,0,614,615,1,0,0,0,615,616,1,0,0,0,616,617,
	5,50,0,0,617,618,5,2,0,0,618,49,1,0,0,0,619,620,3,234,117,0,620,621,5,176,
	0,0,621,51,1,0,0,0,622,623,5,53,0,0,623,624,5,176,0,0,624,626,5,4,0,0,625,
	627,3,54,27,0,626,625,1,0,0,0,627,628,1,0,0,0,628,626,1,0,0,0,628,629,1,
	0,0,0,629,630,1,0,0,0,630,631,5,6,0,0,631,53,1,0,0,0,632,635,3,234,117,
	0,633,635,3,82,41,0,634,632,1,0,0,0,634,633,1,0,0,0,635,636,1,0,0,0,636,
	637,3,14,7,0,637,638,5,2,0,0,638,55,1,0,0,0,639,640,5,54,0,0,640,641,5,
	176,0,0,641,642,5,4,0,0,642,647,3,58,29,0,643,644,5,5,0,0,644,646,3,58,
	29,0,645,643,1,0,0,0,646,649,1,0,0,0,647,645,1,0,0,0,647,648,1,0,0,0,648,
	651,1,0,0,0,649,647,1,0,0,0,650,652,5,5,0,0,651,650,1,0,0,0,651,652,1,0,
	0,0,652,653,1,0,0,0,653,654,5,6,0,0,654,57,1,0,0,0,655,658,5,176,0,0,656,
	657,5,40,0,0,657,659,5,158,0,0,658,656,1,0,0,0,658,659,1,0,0,0,659,59,1,
	0,0,0,660,661,5,55,0,0,661,662,5,176,0,0,662,663,5,42,0,0,663,664,3,234,
	117,0,664,665,5,2,0,0,665,61,1,0,0,0,666,667,3,234,117,0,667,668,5,56,0,
	0,668,669,5,176,0,0,669,670,5,40,0,0,670,671,3,222,111,0,671,672,5,2,0,
	0,672,63,1,0,0,0,673,674,5,57,0,0,674,678,3,104,52,0,675,677,7,5,0,0,676,
	675,1,0,0,0,677,680,1,0,0,0,678,676,1,0,0,0,678,679,1,0,0,0,679,684,1,0,
	0,0,680,678,1,0,0,0,681,683,3,72,36,0,682,681,1,0,0,0,683,686,1,0,0,0,684,
	682,1,0,0,0,684,685,1,0,0,0,685,687,1,0,0,0,686,684,1,0,0,0,687,691,5,4,
	0,0,688,690,3,110,55,0,689,688,1,0,0,0,690,693,1,0,0,0,691,689,1,0,0,0,
	691,692,1,0,0,0,692,694,1,0,0,0,693,691,1,0,0,0,694,695,5,6,0,0,695,65,
	1,0,0,0,696,697,5,60,0,0,697,698,3,104,52,0,698,702,5,44,0,0,699,701,3,
	68,34,0,700,699,1,0,0,0,701,704,1,0,0,0,702,700,1,0,0,0,702,703,1,0,0,0,
	703,708,1,0,0,0,704,702,1,0,0,0,705,707,3,92,46,0,706,705,1,0,0,0,707,710,
	1,0,0,0,708,706,1,0,0,0,708,709,1,0,0,0,709,711,1,0,0,0,710,708,1,0,0,0,
	711,715,5,4,0,0,712,714,3,110,55,0,713,712,1,0,0,0,714,717,1,0,0,0,715,
	713,1,0,0,0,715,716,1,0,0,0,716,718,1,0,0,0,717,715,1,0,0,0,718,719,5,6,
	0,0,719,67,1,0,0,0,720,724,5,59,0,0,721,724,5,61,0,0,722,724,3,96,48,0,
	723,720,1,0,0,0,723,721,1,0,0,0,723,722,1,0,0,0,724,69,1,0,0,0,725,726,
	5,62,0,0,726,727,5,49,0,0,727,728,5,50,0,0,728,729,5,44,0,0,729,730,5,59,
	0,0,730,734,5,4,0,0,731,733,3,110,55,0,732,731,1,0,0,0,733,736,1,0,0,0,
	734,732,1,0,0,0,734,735,1,0,0,0,735,737,1,0,0,0,736,734,1,0,0,0,737,738,
	5,6,0,0,738,71,1,0,0,0,739,740,5,176,0,0,740,741,3,214,107,0,741,73,1,0,
	0,0,742,744,3,78,39,0,743,742,1,0,0,0,743,744,1,0,0,0,744,745,1,0,0,0,745,
	749,3,234,117,0,746,748,3,226,113,0,747,746,1,0,0,0,748,751,1,0,0,0,749,
	747,1,0,0,0,749,750,1,0,0,0,750,752,1,0,0,0,751,749,1,0,0,0,752,755,5,176,
	0,0,753,754,5,40,0,0,754,756,3,222,111,0,755,753,1,0,0,0,755,756,1,0,0,
	0,756,757,1,0,0,0,757,758,5,2,0,0,758,805,1,0,0,0,759,760,3,234,117,0,760,
	764,3,78,39,0,761,763,3,226,113,0,762,761,1,0,0,0,763,766,1,0,0,0,764,762,
	1,0,0,0,764,765,1,0,0,0,765,767,1,0,0,0,766,764,1,0,0,0,767,770,5,176,0,
	0,768,769,5,40,0,0,769,771,3,222,111,0,770,768,1,0,0,0,770,771,1,0,0,0,
	771,772,1,0,0,0,772,773,5,2,0,0,773,805,1,0,0,0,774,776,3,78,39,0,775,774,
	1,0,0,0,775,776,1,0,0,0,776,777,1,0,0,0,777,781,3,80,40,0,778,780,3,76,
	38,0,779,778,1,0,0,0,780,783,1,0,0,0,781,779,1,0,0,0,781,782,1,0,0,0,782,
	784,1,0,0,0,783,781,1,0,0,0,784,785,5,176,0,0,785,786,5,2,0,0,786,805,1,
	0,0,0,787,789,3,78,39,0,788,787,1,0,0,0,788,789,1,0,0,0,789,790,1,0,0,0,
	790,794,3,82,41,0,791,793,3,76,38,0,792,791,1,0,0,0,793,796,1,0,0,0,794,
	792,1,0,0,0,794,795,1,0,0,0,795,797,1,0,0,0,796,794,1,0,0,0,797,800,5,176,
	0,0,798,799,5,40,0,0,799,801,3,222,111,0,800,798,1,0,0,0,800,801,1,0,0,
	0,801,802,1,0,0,0,802,803,5,2,0,0,803,805,1,0,0,0,804,743,1,0,0,0,804,759,
	1,0,0,0,804,775,1,0,0,0,804,788,1,0,0,0,805,75,1,0,0,0,806,809,3,226,113,
	0,807,809,3,78,39,0,808,806,1,0,0,0,808,807,1,0,0,0,809,77,1,0,0,0,810,
	811,7,6,0,0,811,79,1,0,0,0,812,813,5,64,0,0,813,814,5,49,0,0,814,816,3,
	234,117,0,815,817,5,176,0,0,816,815,1,0,0,0,816,817,1,0,0,0,817,818,1,0,
	0,0,818,819,5,65,0,0,819,821,3,234,117,0,820,822,5,176,0,0,821,820,1,0,
	0,0,821,822,1,0,0,0,822,823,1,0,0,0,823,824,5,50,0,0,824,849,1,0,0,0,825,
	826,5,64,0,0,826,827,5,49,0,0,827,829,3,234,117,0,828,830,5,176,0,0,829,
	828,1,0,0,0,829,830,1,0,0,0,830,831,1,0,0,0,831,832,5,65,0,0,832,833,3,
	80,40,0,833,834,5,50,0,0,834,849,1,0,0,0,835,836,5,64,0,0,836,837,5,49,
	0,0,837,839,3,234,117,0,838,840,5,176,0,0,839,838,1,0,0,0,839,840,1,0,0,
	0,840,841,1,0,0,0,841,842,5,65,0,0,842,844,3,82,41,0,843,845,5,176,0,0,
	844,843,1,0,0,0,844,845,1,0,0,0,845,846,1,0,0,0,846,847,5,50,0,0,847,849,
	1,0,0,0,848,812,1,0,0,0,848,825,1,0,0,0,848,835,1,0,0,0,849,81,1,0,0,0,
	850,851,6,41,-1,0,851,852,3,234,117,0,852,853,5,66,0,0,853,854,7,7,0,0,
	854,855,5,67,0,0,855,861,1,0,0,0,856,857,3,234,117,0,857,858,5,66,0,0,858,
	859,5,67,0,0,859,861,1,0,0,0,860,850,1,0,0,0,860,856,1,0,0,0,861,871,1,
	0,0,0,862,863,10,2,0,0,863,864,5,66,0,0,864,865,7,7,0,0,865,870,5,67,0,
	0,866,867,10,1,0,0,867,868,5,66,0,0,868,870,5,67,0,0,869,862,1,0,0,0,869,
	866,1,0,0,0,870,873,1,0,0,0,871,869,1,0,0,0,871,872,1,0,0,0,872,83,1,0,
	0,0,873,871,1,0,0,0,874,875,5,68,0,0,875,877,5,176,0,0,876,878,3,104,52,
	0,877,876,1,0,0,0,877,878,1,0,0,0,878,879,1,0,0,0,879,883,5,4,0,0,880,882,
	3,86,43,0,881,880,1,0,0,0,882,885,1,0,0,0,883,881,1,0,0,0,883,884,1,0,0,
	0,884,886,1,0,0,0,885,883,1,0,0,0,886,887,5,6,0,0,887,85,1,0,0,0,888,891,
	3,88,44,0,889,891,3,110,55,0,890,888,1,0,0,0,890,889,1,0,0,0,891,87,1,0,
	0,0,892,893,5,69,0,0,893,894,5,2,0,0,894,89,1,0,0,0,895,896,5,7,0,0,896,
	897,3,14,7,0,897,901,3,104,52,0,898,900,3,94,47,0,899,898,1,0,0,0,900,903,
	1,0,0,0,901,899,1,0,0,0,901,902,1,0,0,0,902,907,1,0,0,0,903,901,1,0,0,0,
	904,906,3,92,46,0,905,904,1,0,0,0,906,909,1,0,0,0,907,905,1,0,0,0,907,908,
	1,0,0,0,908,911,1,0,0,0,909,907,1,0,0,0,910,912,3,100,50,0,911,910,1,0,
	0,0,911,912,1,0,0,0,912,913,1,0,0,0,913,917,5,4,0,0,914,916,3,110,55,0,
	915,914,1,0,0,0,916,919,1,0,0,0,917,915,1,0,0,0,917,918,1,0,0,0,918,920,
	1,0,0,0,919,917,1,0,0,0,920,921,5,6,0,0,921,91,1,0,0,0,922,924,5,176,0,
	0,923,925,3,214,107,0,924,923,1,0,0,0,924,925,1,0,0,0,925,93,1,0,0,0,926,
	941,5,70,0,0,927,941,5,71,0,0,928,941,5,58,0,0,929,941,5,44,0,0,930,941,
	5,43,0,0,931,941,5,63,0,0,932,941,5,59,0,0,933,941,3,96,48,0,934,941,5,
	61,0,0,935,941,3,98,49,0,936,941,5,30,0,0,937,941,5,28,0,0,938,941,5,31,
	0,0,939,941,5,29,0,0,940,926,1,0,0,0,940,927,1,0,0,0,940,928,1,0,0,0,940,
	929,1,0,0,0,940,930,1,0,0,0,940,931,1,0,0,0,940,932,1,0,0,0,940,933,1,0,
	0,0,940,934,1,0,0,0,940,935,1,0,0,0,940,936,1,0,0,0,940,937,1,0,0,0,940,
	938,1,0,0,0,940,939,1,0,0,0,941,95,1,0,0,0,942,953,5,72,0,0,943,944,5,49,
	0,0,944,949,5,176,0,0,945,946,5,5,0,0,946,948,5,176,0,0,947,945,1,0,0,0,
	948,951,1,0,0,0,949,947,1,0,0,0,949,950,1,0,0,0,950,952,1,0,0,0,951,949,
	1,0,0,0,952,954,5,50,0,0,953,943,1,0,0,0,953,954,1,0,0,0,954,97,1,0,0,0,
	955,959,5,32,0,0,956,957,5,49,0,0,957,958,5,158,0,0,958,960,5,50,0,0,959,
	956,1,0,0,0,959,960,1,0,0,0,960,99,1,0,0,0,961,962,5,73,0,0,962,963,5,49,
	0,0,963,968,3,102,51,0,964,965,5,5,0,0,965,967,3,102,51,0,966,964,1,0,0,
	0,967,970,1,0,0,0,968,966,1,0,0,0,968,969,1,0,0,0,969,972,1,0,0,0,970,968,
	1,0,0,0,971,973,5,5,0,0,972,971,1,0,0,0,972,973,1,0,0,0,973,974,1,0,0,0,
	974,975,5,50,0,0,975,101,1,0,0,0,976,980,3,234,117,0,977,979,3,226,113,
	0,978,977,1,0,0,0,979,982,1,0,0,0,980,978,1,0,0,0,980,981,1,0,0,0,981,984,
	1,0,0,0,982,980,1,0,0,0,983,985,3,14,7,0,984,983,1,0,0,0,984,985,1,0,0,
	0,985,997,1,0,0,0,986,990,3,82,41,0,987,989,3,226,113,0,988,987,1,0,0,0,
	989,992,1,0,0,0,990,988,1,0,0,0,990,991,1,0,0,0,991,994,1,0,0,0,992,990,
	1,0,0,0,993,995,3,14,7,0,994,993,1,0,0,0,994,995,1,0,0,0,995,997,1,0,0,
	0,996,976,1,0,0,0,996,986,1,0,0,0,997,103,1,0,0,0,998,1010,5,49,0,0,999,
	1004,3,106,53,0,1000,1001,5,5,0,0,1001,1003,3,106,53,0,1002,1000,1,0,0,
	0,1003,1006,1,0,0,0,1004,1002,1,0,0,0,1004,1005,1,0,0,0,1005,1008,1,0,0,
	0,1006,1004,1,0,0,0,1007,1009,5,5,0,0,1008,1007,1,0,0,0,1008,1009,1,0,0,
	0,1009,1011,1,0,0,0,1010,999,1,0,0,0,1010,1011,1,0,0,0,1011,1012,1,0,0,
	0,1012,1013,5,50,0,0,1013,105,1,0,0,0,1014,1018,3,234,117,0,1015,1017,3,
	226,113,0,1016,1015,1,0,0,0,1017,1020,1,0,0,0,1018,1016,1,0,0,0,1018,1019,
	1,0,0,0,1019,1022,1,0,0,0,1020,1018,1,0,0,0,1021,1023,3,14,7,0,1022,1021,
	1,0,0,0,1022,1023,1,0,0,0,1023,1035,1,0,0,0,1024,1028,3,82,41,0,1025,1027,
	3,226,113,0,1026,1025,1,0,0,0,1027,1030,1,0,0,0,1028,1026,1,0,0,0,1028,
	1029,1,0,0,0,1029,1032,1,0,0,0,1030,1028,1,0,0,0,1031,1033,3,14,7,0,1032,
	1031,1,0,0,0,1032,1033,1,0,0,0,1033,1035,1,0,0,0,1034,1014,1,0,0,0,1034,
	1024,1,0,0,0,1035,107,1,0,0,0,1036,1040,5,4,0,0,1037,1039,3,110,55,0,1038,
	1037,1,0,0,0,1039,1042,1,0,0,0,1040,1038,1,0,0,0,1040,1041,1,0,0,0,1041,
	1043,1,0,0,0,1042,1040,1,0,0,0,1043,1046,5,6,0,0,1044,1046,3,110,55,0,1045,
	1036,1,0,0,0,1045,1044,1,0,0,0,1046,109,1,0,0,0,1047,1079,3,130,65,0,1048,
	1079,3,132,66,0,1049,1079,3,138,69,0,1050,1079,3,140,70,0,1051,1079,3,142,
	71,0,1052,1079,3,144,72,0,1053,1079,3,146,73,0,1054,1079,3,136,68,0,1055,
	1079,3,126,63,0,1056,1079,3,128,64,0,1057,1079,3,150,75,0,1058,1079,3,152,
	76,0,1059,1079,3,154,77,0,1060,1079,3,156,78,0,1061,1079,3,176,88,0,1062,
	1079,3,124,62,0,1063,1079,3,112,56,0,1064,1079,3,114,57,0,1065,1079,3,116,
	58,0,1066,1079,3,118,59,0,1067,1079,3,120,60,0,1068,1079,3,122,61,0,1069,
	1079,3,178,89,0,1070,1079,3,190,95,0,1071,1079,3,202,101,0,1072,1079,3,
	204,102,0,1073,1079,3,148,74,0,1074,1079,3,182,91,0,1075,1079,3,184,92,
	0,1076,1079,3,196,98,0,1077,1079,3,198,99,0,1078,1047,1,0,0,0,1078,1048,
	1,0,0,0,1078,1049,1,0,0,0,1078,1050,1,0,0,0,1078,1051,1,0,0,0,1078,1052,
	1,0,0,0,1078,1053,1,0,0,0,1078,1054,1,0,0,0,1078,1055,1,0,0,0,1078,1056,
	1,0,0,0,1078,1057,1,0,0,0,1078,1058,1,0,0,0,1078,1059,1,0,0,0,1078,1060,
	1,0,0,0,1078,1061,1,0,0,0,1078,1062,1,0,0,0,1078,1063,1,0,0,0,1078,1064,
	1,0,0,0,1078,1065,1,0,0,0,1078,1066,1,0,0,0,1078,1067,1,0,0,0,1078,1068,
	1,0,0,0,1078,1069,1,0,0,0,1078,1070,1,0,0,0,1078,1071,1,0,0,0,1078,1072,
	1,0,0,0,1078,1073,1,0,0,0,1078,1074,1,0,0,0,1078,1075,1,0,0,0,1078,1076,
	1,0,0,0,1078,1077,1,0,0,0,1079,111,1,0,0,0,1080,1081,5,74,0,0,1081,1082,
	5,12,0,0,1082,1083,5,176,0,0,1083,1084,5,49,0,0,1084,1085,3,222,111,0,1085,
	1086,5,5,0,0,1086,1087,3,222,111,0,1087,1088,5,50,0,0,1088,1089,5,2,0,0,
	1089,113,1,0,0,0,1090,1091,5,74,0,0,1091,1092,5,12,0,0,1092,1093,5,176,
	0,0,1093,1094,5,66,0,0,1094,1095,3,222,111,0,1095,1096,5,67,0,0,1096,1097,
	5,12,0,0,1097,1098,5,176,0,0,1098,1099,5,49,0,0,1099,1104,3,222,111,0,1100,
	1101,5,5,0,0,1101,1103,3,222,111,0,1102,1100,1,0,0,0,1103,1106,1,0,0,0,
	1104,1102,1,0,0,0,1104,1105,1,0,0,0,1105,1107,1,0,0,0,1106,1104,1,0,0,0,
	1107,1108,5,50,0,0,1108,1109,5,2,0,0,1109,115,1,0,0,0,1110,1111,5,75,0,
	0,1111,1140,5,2,0,0,1112,1113,5,75,0,0,1113,1118,3,222,111,0,1114,1115,
	5,5,0,0,1115,1117,3,222,111,0,1116,1114,1,0,0,0,1117,1120,1,0,0,0,1118,
	1116,1,0,0,0,1118,1119,1,0,0,0,1119,1121,1,0,0,0,1120,1118,1,0,0,0,1121,
	1122,5,2,0,0,1122,1140,1,0,0,0,1123,1124,5,75,0,0,1124,1125,5,49,0,0,1125,
	1130,3,222,111,0,1126,1127,5,5,0,0,1127,1129,3,222,111,0,1128,1126,1,0,
	0,0,1129,1132,1,0,0,0,1130,1128,1,0,0,0,1130,1131,1,0,0,0,1131,1134,1,0,
	0,0,1132,1130,1,0,0,0,1133,1135,5,5,0,0,1134,1133,1,0,0,0,1134,1135,1,0,
	0,0,1135,1136,1,0,0,0,1136,1137,5,50,0,0,1137,1138,5,2,0,0,1138,1140,1,
	0,0,0,1139,1110,1,0,0,0,1139,1112,1,0,0,0,1139,1123,1,0,0,0,1140,117,1,
	0,0,0,1141,1144,5,176,0,0,1142,1143,5,12,0,0,1143,1145,5,176,0,0,1144,1142,
	1,0,0,0,1144,1145,1,0,0,0,1145,1146,1,0,0,0,1146,1147,5,49,0,0,1147,1159,
	5,4,0,0,1148,1153,3,212,106,0,1149,1150,5,5,0,0,1150,1152,3,212,106,0,1151,
	1149,1,0,0,0,1152,1155,1,0,0,0,1153,1151,1,0,0,0,1153,1154,1,0,0,0,1154,
	1157,1,0,0,0,1155,1153,1,0,0,0,1156,1158,5,5,0,0,1157,1156,1,0,0,0,1157,
	1158,1,0,0,0,1158,1160,1,0,0,0,1159,1148,1,0,0,0,1159,1160,1,0,0,0,1160,
	1161,1,0,0,0,1161,1162,5,6,0,0,1162,1163,5,50,0,0,1163,1187,5,2,0,0,1164,
	1165,5,176,0,0,1165,1166,3,214,107,0,1166,1167,5,2,0,0,1167,1187,1,0,0,
	0,1168,1169,5,176,0,0,1169,1170,5,12,0,0,1170,1171,5,176,0,0,1171,1172,
	3,214,107,0,1172,1173,5,2,0,0,1173,1187,1,0,0,0,1174,1175,5,176,0,0,1175,
	1176,3,214,107,0,1176,1177,5,12,0,0,1177,1178,5,176,0,0,1178,1179,5,12,
	0,0,1179,1181,5,176,0,0,1180,1182,3,216,108,0,1181,1180,1,0,0,0,1181,1182,
	1,0,0,0,1182,1183,1,0,0,0,1183,1184,3,214,107,0,1184,1185,5,2,0,0,1185,
	1187,1,0,0,0,1186,1141,1,0,0,0,1186,1164,1,0,0,0,1186,1168,1,0,0,0,1186,
	1174,1,0,0,0,1187,119,1,0,0,0,1188,1189,3,222,111,0,1189,1190,5,12,0,0,
	1190,1192,5,176,0,0,1191,1193,3,216,108,0,1192,1191,1,0,0,0,1192,1193,1,
	0,0,0,1193,1194,1,0,0,0,1194,1195,3,214,107,0,1195,1196,5,2,0,0,1196,121,
	1,0,0,0,1197,1198,5,31,0,0,1198,1199,5,49,0,0,1199,1200,3,222,111,0,1200,
	1201,5,50,0,0,1201,1202,5,2,0,0,1202,123,1,0,0,0,1203,1204,5,76,0,0,1204,
	1207,5,176,0,0,1205,1206,5,12,0,0,1206,1208,5,176,0,0,1207,1205,1,0,0,0,
	1207,1208,1,0,0,0,1208,1209,1,0,0,0,1209,1210,5,49,0,0,1210,1222,5,4,0,
	0,1211,1216,3,212,106,0,1212,1213,5,5,0,0,1213,1215,3,212,106,0,1214,1212,
	1,0,0,0,1215,1218,1,0,0,0,1216,1214,1,0,0,0,1216,1217,1,0,0,0,1217,1220,
	1,0,0,0,1218,1216,1,0,0,0,1219,1221,5,5,0,0,1220,1219,1,0,0,0,1220,1221,
	1,0,0,0,1221,1223,1,0,0,0,1222,1211,1,0,0,0,1222,1223,1,0,0,0,1223,1224,
	1,0,0,0,1224,1225,5,6,0,0,1225,1226,5,50,0,0,1226,1237,5,2,0,0,1227,1228,
	5,76,0,0,1228,1231,5,176,0,0,1229,1230,5,12,0,0,1230,1232,5,176,0,0,1231,
	1229,1,0,0,0,1231,1232,1,0,0,0,1232,1233,1,0,0,0,1233,1234,3,214,107,0,
	1234,1235,5,2,0,0,1235,1237,1,0,0,0,1236,1203,1,0,0,0,1236,1227,1,0,0,0,
	1237,125,1,0,0,0,1238,1239,5,74,0,0,1239,1240,5,12,0,0,1240,1249,5,176,
	0,0,1241,1242,5,66,0,0,1242,1243,3,222,111,0,1243,1244,5,67,0,0,1244,1246,
	1,0,0,0,1245,1241,1,0,0,0,1246,1247,1,0,0,0,1247,1245,1,0,0,0,1247,1248,
	1,0,0,0,1248,1250,1,0,0,0,1249,1245,1,0,0,0,1249,1250,1,0,0,0,1250,1255,
	1,0,0,0,1251,1252,5,12,0,0,1252,1254,5,176,0,0,1253,1251,1,0,0,0,1254,1257,
	1,0,0,0,1255,1253,1,0,0,0,1255,1256,1,0,0,0,1256,1258,1,0,0,0,1257,1255,
	1,0,0,0,1258,1259,7,8,0,0,1259,1260,3,222,111,0,1260,1261,5,2,0,0,1261,
	1344,1,0,0,0,1262,1267,5,176,0,0,1263,1264,5,66,0,0,1264,1265,3,222,111,
	0,1265,1266,5,67,0,0,1266,1268,1,0,0,0,1267,1263,1,0,0,0,1268,1269,1,0,
	0,0,1269,1267,1,0,0,0,1269,1270,1,0,0,0,1270,1275,1,0,0,0,1271,1272,5,12,
	0,0,1272,1274,5,176,0,0,1273,1271,1,0,0,0,1274,1277,1,0,0,0,1275,1273,1,
	0,0,0,1275,1276,1,0,0,0,1276,1278,1,0,0,0,1277,1275,1,0,0,0,1278,1279,7,
	8,0,0,1279,1280,3,222,111,0,1280,1281,5,2,0,0,1281,1344,1,0,0,0,1282,1285,
	5,176,0,0,1283,1284,5,12,0,0,1284,1286,5,176,0,0,1285,1283,1,0,0,0,1286,
	1287,1,0,0,0,1287,1285,1,0,0,0,1287,1288,1,0,0,0,1288,1289,1,0,0,0,1289,
	1290,7,8,0,0,1290,1291,3,222,111,0,1291,1292,5,2,0,0,1292,1344,1,0,0,0,
	1293,1294,5,74,0,0,1294,1295,5,12,0,0,1295,1304,5,176,0,0,1296,1297,5,66,
	0,0,1297,1298,3,222,111,0,1298,1299,5,67,0,0,1299,1301,1,0,0,0,1300,1296,
	1,0,0,0,1301,1302,1,0,0,0,1302,1300,1,0,0,0,1302,1303,1,0,0,0,1303,1305,
	1,0,0,0,1304,1300,1,0,0,0,1304,1305,1,0,0,0,1305,1310,1,0,0,0,1306,1307,
	5,12,0,0,1307,1309,5,176,0,0,1308,1306,1,0,0,0,1309,1312,1,0,0,0,1310,1308,
	1,0,0,0,1310,1311,1,0,0,0,1311,1313,1,0,0,0,1312,1310,1,0,0,0,1313,1314,
	7,9,0,0,1314,1344,5,2,0,0,1315,1320,5,176,0,0,1316,1317,5,66,0,0,1317,1318,
	3,222,111,0,1318,1319,5,67,0,0,1319,1321,1,0,0,0,1320,1316,1,0,0,0,1321,
	1322,1,0,0,0,1322,1320,1,0,0,0,1322,1323,1,0,0,0,1323,1328,1,0,0,0,1324,
	1325,5,12,0,0,1325,1327,5,176,0,0,1326,1324,1,0,0,0,1327,1330,1,0,0,0,1328,
	1326,1,0,0,0,1328,1329,1,0,0,0,1329,1331,1,0,0,0,1330,1328,1,0,0,0,1331,
	1332,7,9,0,0,1332,1333,5,2,0,0,1333,1344,1,0,0,0,1334,1337,5,176,0,0,1335,
	1336,5,12,0,0,1336,1338,5,176,0,0,1337,1335,1,0,0,0,1338,1339,1,0,0,0,1339,
	1337,1,0,0,0,1339,1340,1,0,0,0,1340,1341,1,0,0,0,1341,1342,7,9,0,0,1342,
	1344,5,2,0,0,1343,1238,1,0,0,0,1343,1262,1,0,0,0,1343,1282,1,0,0,0,1343,
	1293,1,0,0,0,1343,1315,1,0,0,0,1343,1334,1,0,0,0,1344,127,1,0,0,0,1345,
	1346,5,74,0,0,1346,1347,5,12,0,0,1347,1354,5,176,0,0,1348,1349,5,66,0,0,
	1349,1350,3,222,111,0,1350,1351,5,67,0,0,1351,1353,1,0,0,0,1352,1348,1,
	0,0,0,1353,1356,1,0,0,0,1354,1352,1,0,0,0,1354,1355,1,0,0,0,1355,1357,1,
	0,0,0,1356,1354,1,0,0,0,1357,1358,5,89,0,0,1358,1359,5,49,0,0,1359,1360,
	3,222,111,0,1360,1361,5,50,0,0,1361,1362,5,2,0,0,1362,129,1,0,0,0,1363,
	1367,3,234,117,0,1364,1366,3,226,113,0,1365,1364,1,0,0,0,1366,1369,1,0,
	0,0,1367,1365,1,0,0,0,1367,1368,1,0,0,0,1368,1370,1,0,0,0,1369,1367,1,0,
	0,0,1370,1373,3,14,7,0,1371,1372,5,40,0,0,1372,1374,3,222,111,0,1373,1371,
	1,0,0,0,1373,1374,1,0,0,0,1374,1375,1,0,0,0,1375,1376,5,2,0,0,1376,1392,
	1,0,0,0,1377,1381,3,82,41,0,1378,1380,3,226,113,0,1379,1378,1,0,0,0,1380,
	1383,1,0,0,0,1381,1379,1,0,0,0,1381,1382,1,0,0,0,1382,1384,1,0,0,0,1383,
	1381,1,0,0,0,1384,1387,3,14,7,0,1385,1386,5,40,0,0,1386,1388,3,222,111,
	0,1387,1385,1,0,0,0,1387,1388,1,0,0,0,1388,1389,1,0,0,0,1389,1390,5,2,0,
	0,1390,1392,1,0,0,0,1391,1363,1,0,0,0,1391,1377,1,0,0,0,1392,131,1,0,0,
	0,1393,1394,3,234,117,0,1394,1399,5,176,0,0,1395,1396,5,5,0,0,1396,1397,
	3,234,117,0,1397,1398,5,176,0,0,1398,1400,1,0,0,0,1399,1395,1,0,0,0,1400,
	1401,1,0,0,0,1401,1399,1,0,0,0,1401,1402,1,0,0,0,1402,1403,1,0,0,0,1403,
	1404,5,40,0,0,1404,1405,3,222,111,0,1405,1406,5,2,0,0,1406,1442,1,0,0,0,
	1407,1408,5,49,0,0,1408,1411,3,134,67,0,1409,1410,5,5,0,0,1410,1412,3,134,
	67,0,1411,1409,1,0,0,0,1412,1413,1,0,0,0,1413,1411,1,0,0,0,1413,1414,1,
	0,0,0,1414,1415,1,0,0,0,1415,1416,5,50,0,0,1416,1417,5,40,0,0,1417,1418,
	5,49,0,0,1418,1421,3,222,111,0,1419,1420,5,5,0,0,1420,1422,3,222,111,0,
	1421,1419,1,0,0,0,1422,1423,1,0,0,0,1423,1421,1,0,0,0,1423,1424,1,0,0,0,
	1424,1425,1,0,0,0,1425,1426,5,50,0,0,1426,1427,5,2,0,0,1427,1442,1,0,0,
	0,1428,1429,5,49,0,0,1429,1432,3,134,67,0,1430,1431,5,5,0,0,1431,1433,3,
	134,67,0,1432,1430,1,0,0,0,1433,1434,1,0,0,0,1434,1432,1,0,0,0,1434,1435,
	1,0,0,0,1435,1436,1,0,0,0,1436,1437,5,50,0,0,1437,1438,5,40,0,0,1438,1439,
	3,222,111,0,1439,1440,5,2,0,0,1440,1442,1,0,0,0,1441,1393,1,0,0,0,1441,
	1407,1,0,0,0,1441,1428,1,0,0,0,1442,133,1,0,0,0,1443,1447,3,234,117,0,1444,
	1446,3,226,113,0,1445,1444,1,0,0,0,1446,1449,1,0,0,0,1447,1445,1,0,0,0,
	1447,1448,1,0,0,0,1448,1450,1,0,0,0,1449,1447,1,0,0,0,1450,1451,5,176,0,
	0,1451,1455,1,0,0,0,1452,1455,5,176,0,0,1453,1455,1,0,0,0,1454,1443,1,0,
	0,0,1454,1452,1,0,0,0,1454,1453,1,0,0,0,1455,135,1,0,0,0,1456,1457,5,176,
	0,0,1457,1458,7,8,0,0,1458,1459,3,222,111,0,1459,1460,5,2,0,0,1460,1468,
	1,0,0,0,1461,1462,5,176,0,0,1462,1463,7,9,0,0,1463,1468,5,2,0,0,1464,1465,
	7,9,0,0,1465,1466,5,176,0,0,1466,1468,5,2,0,0,1467,1456,1,0,0,0,1467,1461,
	1,0,0,0,1467,1464,1,0,0,0,1468,137,1,0,0,0,1469,1470,5,176,0,0,1470,1471,
	5,90,0,0,1471,1472,5,49,0,0,1472,1473,3,222,111,0,1473,1474,5,50,0,0,1474,
	1475,5,2,0,0,1475,139,1,0,0,0,1476,1477,5,176,0,0,1477,1478,5,91,0,0,1478,
	1479,5,49,0,0,1479,1480,5,50,0,0,1480,1481,5,2,0,0,1481,141,1,0,0,0,1482,
	1483,5,176,0,0,1483,1484,5,89,0,0,1484,1485,5,49,0,0,1485,1486,3,222,111,
	0,1486,1487,5,50,0,0,1487,1488,5,2,0,0,1488,143,1,0,0,0,1489,1490,5,74,
	0,0,1490,1491,5,12,0,0,1491,1492,5,176,0,0,1492,1493,5,90,0,0,1493,1494,
	5,49,0,0,1494,1495,3,222,111,0,1495,1496,5,50,0,0,1496,1497,5,2,0,0,1497,
	145,1,0,0,0,1498,1499,5,74,0,0,1499,1500,5,12,0,0,1500,1501,5,176,0,0,1501,
	1502,5,91,0,0,1502,1503,5,49,0,0,1503,1504,5,50,0,0,1504,1505,5,2,0,0,1505,
	147,1,0,0,0,1506,1507,5,92,0,0,1507,1508,5,176,0,0,1508,1541,5,2,0,0,1509,
	1510,5,92,0,0,1510,1511,5,74,0,0,1511,1512,5,12,0,0,1512,1513,5,176,0,0,
	1513,1541,5,2,0,0,1514,1515,5,92,0,0,1515,1516,5,74,0,0,1516,1517,5,12,
	0,0,1517,1522,5,176,0,0,1518,1519,5,66,0,0,1519,1520,3,222,111,0,1520,1521,
	5,67,0,0,1521,1523,1,0,0,0,1522,1518,1,0,0,0,1523,1524,1,0,0,0,1524,1522,
	1,0,0,0,1524,1525,1,0,0,0,1525,1526,1,0,0,0,1526,1527,5,2,0,0,1527,1541,
	1,0,0,0,1528,1529,5,92,0,0,1529,1534,5,176,0,0,1530,1531,5,66,0,0,1531,
	1532,3,222,111,0,1532,1533,5,67,0,0,1533,1535,1,0,0,0,1534,1530,1,0,0,0,
	1535,1536,1,0,0,0,1536,1534,1,0,0,0,1536,1537,1,0,0,0,1537,1538,1,0,0,0,
	1538,1539,5,2,0,0,1539,1541,1,0,0,0,1540,1506,1,0,0,0,1540,1509,1,0,0,0,
	1540,1514,1,0,0,0,1540,1528,1,0,0,0,1541,149,1,0,0,0,1542,1543,5,93,0,0,
	1543,1544,5,49,0,0,1544,1545,5,167,0,0,1545,1546,5,23,0,0,1546,1549,3,222,
	111,0,1547,1548,5,5,0,0,1548,1550,3,200,100,0,1549,1547,1,0,0,0,1549,1550,
	1,0,0,0,1550,1551,1,0,0,0,1551,1552,5,50,0,0,1552,1553,5,2,0,0,1553,151,
	1,0,0,0,1554,1555,5,93,0,0,1555,1556,5,49,0,0,1556,1559,3,222,111,0,1557,
	1558,5,5,0,0,1558,1560,3,200,100,0,1559,1557,1,0,0,0,1559,1560,1,0,0,0,
	1560,1561,1,0,0,0,1561,1562,5,50,0,0,1562,1563,5,2,0,0,1563,153,1,0,0,0,
	1564,1565,5,94,0,0,1565,1566,5,49,0,0,1566,1567,3,222,111,0,1567,1568,5,
	50,0,0,1568,1571,3,108,54,0,1569,1570,5,95,0,0,1570,1572,3,108,54,0,1571,
	1569,1,0,0,0,1571,1572,1,0,0,0,1572,155,1,0,0,0,1573,1580,3,172,86,0,1574,
	1580,3,174,87,0,1575,1580,3,164,82,0,1576,1580,3,158,79,0,1577,1580,3,160,
	80,0,1578,1580,3,162,81,0,1579,1573,1,0,0,0,1579,1574,1,0,0,0,1579,1575,
	1,0,0,0,1579,1576,1,0,0,0,1579,1577,1,0,0,0,1579,1578,1,0,0,0,1580,157,
	1,0,0,0,1581,1582,5,9,0,0,1582,1583,5,49,0,0,1583,1584,3,234,117,0,1584,
	1585,5,176,0,0,1585,1586,5,5,0,0,1586,1587,3,234,117,0,1587,1588,5,176,
	0,0,1588,1589,5,96,0,0,1589,1590,5,74,0,0,1590,1591,5,12,0,0,1591,1592,
	5,176,0,0,1592,1593,5,12,0,0,1593,1594,5,34,0,0,1594,1595,5,50,0,0,1595,
	1596,3,108,54,0,1596,159,1,0,0,0,1597,1598,5,9,0,0,1598,1599,5,49,0,0,1599,
	1600,3,234,117,0,1600,1601,5,176,0,0,1601,1602,5,97,0,0,1602,1603,5,74,
	0,0,1603,1604,5,12,0,0,1604,1605,5,176,0,0,1605,1606,5,50,0,0,1606,1607,
	3,108,54,0,1607,161,1,0,0,0,1608,1609,5,9,0,0,1609,1610,5,49,0,0,1610,1611,
	3,234,117,0,1611,1612,5,176,0,0,1612,1613,5,96,0,0,1613,1614,5,74,0,0,1614,
	1615,5,12,0,0,1615,1616,5,176,0,0,1616,1617,5,50,0,0,1617,1618,3,108,54,
	0,1618,163,1,0,0,0,1619,1620,5,9,0,0,1620,1621,5,49,0,0,1621,1622,3,166,
	83,0,1622,1624,3,168,84,0,1623,1625,3,170,85,0,1624,1623,1,0,0,0,1624,1625,
	1,0,0,0,1625,1626,1,0,0,0,1626,1627,5,50,0,0,1627,1628,3,108,54,0,1628,
	165,1,0,0,0,1629,1633,3,234,117,0,1630,1632,3,226,113,0,1631,1630,1,0,0,
	0,1632,1635,1,0,0,0,1633,1631,1,0,0,0,1633,1634,1,0,0,0,1634,1636,1,0,0,
	0,1635,1633,1,0,0,0,1636,1639,5,176,0,0,1637,1638,5,40,0,0,1638,1640,3,
	222,111,0,1639,1637,1,0,0,0,1639,1640,1,0,0,0,1640,1641,1,0,0,0,1641,1642,
	5,2,0,0,1642,167,1,0,0,0,1643,1644,3,222,111,0,1644,1645,5,2,0,0,1645,169,
	1,0,0,0,1646,1647,5,176,0,0,1647,1648,7,8,0,0,1648,1652,3,222,111,0,1649,
	1650,5,176,0,0,1650,1652,7,9,0,0,1651,1646,1,0,0,0,1651,1649,1,0,0,0,1652,
	171,1,0,0,0,1653,1654,5,98,0,0,1654,1655,3,108,54,0,1655,1656,5,99,0,0,
	1656,1657,5,49,0,0,1657,1658,3,222,111,0,1658,1659,5,50,0,0,1659,1660,5,
	2,0,0,1660,173,1,0,0,0,1661,1662,5,99,0,0,1662,1663,5,49,0,0,1663,1664,
	3,222,111,0,1664,1665,5,50,0,0,1665,1666,3,108,54,0,1666,175,1,0,0,0,1667,
	1668,5,100,0,0,1668,1669,3,208,104,0,1669,1670,5,2,0,0,1670,177,1,0,0,0,
	1671,1672,5,101,0,0,1672,1676,5,4,0,0,1673,1675,3,180,90,0,1674,1673,1,
	0,0,0,1675,1678,1,0,0,0,1676,1674,1,0,0,0,1676,1677,1,0,0,0,1677,1679,1,
	0,0,0,1678,1676,1,0,0,0,1679,1680,5,6,0,0,1680,179,1,0,0,0,1681,1682,7,
	10,0,0,1682,181,1,0,0,0,1683,1684,5,102,0,0,1684,1688,5,4,0,0,1685,1687,
	3,110,55,0,1686,1685,1,0,0,0,1687,1690,1,0,0,0,1688,1686,1,0,0,0,1688,1689,
	1,0,0,0,1689,1691,1,0,0,0,1690,1688,1,0,0,0,1691,1692,5,6,0,0,1692,183,
	1,0,0,0,1693,1694,5,103,0,0,1694,1695,5,49,0,0,1695,1696,3,222,111,0,1696,
	1697,5,50,0,0,1697,1701,5,4,0,0,1698,1700,3,186,93,0,1699,1698,1,0,0,0,
	1700,1703,1,0,0,0,1701,1699,1,0,0,0,1701,1702,1,0,0,0,1702,1705,1,0,0,0,
	1703,1701,1,0,0,0,1704,1706,3,188,94,0,1705,1704,1,0,0,0,1705,1706,1,0,
	0,0,1706,1707,1,0,0,0,1707,1708,5,6,0,0,1708,185,1,0,0,0,1709,1710,5,104,
	0,0,1710,1711,3,222,111,0,1711,1715,5,105,0,0,1712,1714,3,110,55,0,1713,
	1712,1,0,0,0,1714,1717,1,0,0,0,1715,1713,1,0,0,0,1715,1716,1,0,0,0,1716,
	187,1,0,0,0,1717,1715,1,0,0,0,1718,1719,5,106,0,0,1719,1723,5,105,0,0,1720,
	1722,3,110,55,0,1721,1720,1,0,0,0,1722,1725,1,0,0,0,1723,1721,1,0,0,0,1723,
	1724,1,0,0,0,1724,189,1,0,0,0,1725,1723,1,0,0,0,1726,1727,5,107,0,0,1727,
	1729,3,222,111,0,1728,1730,3,192,96,0,1729,1728,1,0,0,0,1729,1730,1,0,0,
	0,1730,1731,1,0,0,0,1731,1733,3,108,54,0,1732,1734,3,194,97,0,1733,1732,
	1,0,0,0,1734,1735,1,0,0,0,1735,1733,1,0,0,0,1735,1736,1,0,0,0,1736,191,
	1,0,0,0,1737,1738,5,73,0,0,1738,1750,5,49,0,0,1739,1744,3,106,53,0,1740,
	1741,5,5,0,0,1741,1743,3,106,53,0,1742,1740,1,0,0,0,1743,1746,1,0,0,0,1744,
	1742,1,0,0,0,1744,1745,1,0,0,0,1745,1748,1,0,0,0,1746,1744,1,0,0,0,1747,
	1749,5,5,0,0,1748,1747,1,0,0,0,1748,1749,1,0,0,0,1749,1751,1,0,0,0,1750,
	1739,1,0,0,0,1750,1751,1,0,0,0,1751,1752,1,0,0,0,1752,1753,5,50,0,0,1753,
	193,1,0,0,0,1754,1756,5,108,0,0,1755,1757,5,176,0,0,1756,1755,1,0,0,0,1756,
	1757,1,0,0,0,1757,1773,1,0,0,0,1758,1770,5,49,0,0,1759,1764,3,106,53,0,
	1760,1761,5,5,0,0,1761,1763,3,106,53,0,1762,1760,1,0,0,0,1763,1766,1,0,
	0,0,1764,1762,1,0,0,0,1764,1765,1,0,0,0,1765,1768,1,0,0,0,1766,1764,1,0,
	0,0,1767,1769,5,5,0,0,1768,1767,1,0,0,0,1768,1769,1,0,0,0,1769,1771,1,0,
	0,0,1770,1759,1,0,0,0,1770,1771,1,0,0,0,1771,1772,1,0,0,0,1772,1774,5,50,
	0,0,1773,1758,1,0,0,0,1773,1774,1,0,0,0,1774,1775,1,0,0,0,1775,1776,3,108,
	54,0,1776,195,1,0,0,0,1777,1778,5,109,0,0,1778,1779,5,2,0,0,1779,197,1,
	0,0,0,1780,1781,5,110,0,0,1781,1782,5,2,0,0,1782,199,1,0,0,0,1783,1787,
	5,164,0,0,1784,1785,5,176,0,0,1785,1787,3,214,107,0,1786,1783,1,0,0,0,1786,
	1784,1,0,0,0,1787,201,1,0,0,0,1788,1789,5,36,0,0,1789,1792,5,176,0,0,1790,
	1791,5,12,0,0,1791,1793,5,176,0,0,1792,1790,1,0,0,0,1792,1793,1,0,0,0,1793,
	1794,1,0,0,0,1794,1795,5,49,0,0,1795,1807,5,4,0,0,1796,1801,3,212,106,0,
	1797,1798,5,5,0,0,1798,1800,3,212,106,0,1799,1797,1,0,0,0,1800,1803,1,0,
	0,0,1801,1799,1,0,0,0,1801,1802,1,0,0,0,1802,1805,1,0,0,0,1803,1801,1,0,
	0,0,1804,1806,5,5,0,0,1805,1804,1,0,0,0,1805,1806,1,0,0,0,1806,1808,1,0,
	0,0,1807,1796,1,0,0,0,1807,1808,1,0,0,0,1808,1809,1,0,0,0,1809,1810,5,6,
	0,0,1810,1811,5,50,0,0,1811,1831,5,2,0,0,1812,1813,5,36,0,0,1813,1816,5,
	176,0,0,1814,1815,5,12,0,0,1815,1817,5,176,0,0,1816,1814,1,0,0,0,1816,1817,
	1,0,0,0,1817,1818,1,0,0,0,1818,1819,3,214,107,0,1819,1820,5,2,0,0,1820,
	1831,1,0,0,0,1821,1822,5,36,0,0,1822,1823,5,49,0,0,1823,1824,5,164,0,0,
	1824,1825,5,50,0,0,1825,1831,5,2,0,0,1826,1827,5,36,0,0,1827,1828,5,49,
	0,0,1828,1829,5,50,0,0,1829,1831,5,2,0,0,1830,1788,1,0,0,0,1830,1812,1,
	0,0,0,1830,1821,1,0,0,0,1830,1826,1,0,0,0,1831,203,1,0,0,0,1832,1833,5,
	111,0,0,1833,1834,5,49,0,0,1834,1835,3,222,111,0,1835,1836,5,50,0,0,1836,
	1837,5,2,0,0,1837,205,1,0,0,0,1838,1841,5,176,0,0,1839,1841,3,228,114,0,
	1840,1838,1,0,0,0,1840,1839,1,0,0,0,1841,207,1,0,0,0,1842,1854,5,49,0,0,
	1843,1848,3,206,103,0,1844,1845,5,5,0,0,1845,1847,3,206,103,0,1846,1844,
	1,0,0,0,1847,1850,1,0,0,0,1848,1846,1,0,0,0,1848,1849,1,0,0,0,1849,1852,
	1,0,0,0,1850,1848,1,0,0,0,1851,1853,5,5,0,0,1852,1851,1,0,0,0,1852,1853,
	1,0,0,0,1853,1855,1,0,0,0,1854,1843,1,0,0,0,1854,1855,1,0,0,0,1855,1856,
	1,0,0,0,1856,1857,5,50,0,0,1857,209,1,0,0,0,1858,1859,5,176,0,0,1859,1883,
	3,214,107,0,1860,1861,5,176,0,0,1861,1862,5,12,0,0,1862,1863,5,176,0,0,
	1863,1883,3,214,107,0,1864,1865,5,176,0,0,1865,1866,5,49,0,0,1866,1878,
	5,4,0,0,1867,1872,3,212,106,0,1868,1869,5,5,0,0,1869,1871,3,212,106,0,1870,
	1868,1,0,0,0,1871,1874,1,0,0,0,1872,1870,1,0,0,0,1872,1873,1,0,0,0,1873,
	1876,1,0,0,0,1874,1872,1,0,0,0,1875,1877,5,5,0,0,1876,1875,1,0,0,0,1876,
	1877,1,0,0,0,1877,1879,1,0,0,0,1878,1867,1,0,0,0,1878,1879,1,0,0,0,1879,
	1880,1,0,0,0,1880,1881,5,6,0,0,1881,1883,5,50,0,0,1882,1858,1,0,0,0,1882,
	1860,1,0,0,0,1882,1864,1,0,0,0,1883,211,1,0,0,0,1884,1885,5,176,0,0,1885,
	1886,5,105,0,0,1886,1887,3,222,111,0,1887,213,1,0,0,0,1888,1900,5,49,0,
	0,1889,1894,3,222,111,0,1890,1891,5,5,0,0,1891,1893,3,222,111,0,1892,1890,
	1,0,0,0,1893,1896,1,0,0,0,1894,1892,1,0,0,0,1894,1895,1,0,0,0,1895,1898,
	1,0,0,0,1896,1894,1,0,0,0,1897,1899,5,5,0,0,1898,1897,1,0,0,0,1898,1899,
	1,0,0,0,1899,1901,1,0,0,0,1900,1889,1,0,0,0,1900,1901,1,0,0,0,1901,1902,
	1,0,0,0,1902,1903,5,50,0,0,1903,215,1,0,0,0,1904,1905,5,4,0,0,1905,1910,
	3,218,109,0,1906,1907,5,5,0,0,1907,1909,3,218,109,0,1908,1906,1,0,0,0,1909,
	1912,1,0,0,0,1910,1908,1,0,0,0,1910,1911,1,0,0,0,1911,1914,1,0,0,0,1912,
	1910,1,0,0,0,1913,1915,5,5,0,0,1914,1913,1,0,0,0,1914,1915,1,0,0,0,1915,
	1916,1,0,0,0,1916,1917,5,6,0,0,1917,217,1,0,0,0,1918,1919,5,176,0,0,1919,
	1920,5,105,0,0,1920,1921,3,222,111,0,1921,219,1,0,0,0,1922,1923,5,49,0,
	0,1923,1928,3,234,117,0,1924,1925,5,5,0,0,1925,1927,3,234,117,0,1926,1924,
	1,0,0,0,1927,1930,1,0,0,0,1928,1926,1,0,0,0,1928,1929,1,0,0,0,1929,1932,
	1,0,0,0,1930,1928,1,0,0,0,1931,1933,5,5,0,0,1932,1931,1,0,0,0,1932,1933,
	1,0,0,0,1933,1934,1,0,0,0,1934,1935,5,50,0,0,1935,221,1,0,0,0,1936,1937,
	6,111,-1,0,1937,1938,5,49,0,0,1938,1939,5,176,0,0,1939,1940,7,8,0,0,1940,
	1941,3,222,111,0,1941,1942,5,50,0,0,1942,2082,1,0,0,0,1943,1944,5,49,0,
	0,1944,1945,3,222,111,0,1945,1946,5,50,0,0,1946,2082,1,0,0,0,1947,1948,
	5,49,0,0,1948,1951,3,222,111,0,1949,1950,5,5,0,0,1950,1952,3,222,111,0,
	1951,1949,1,0,0,0,1952,1953,1,0,0,0,1953,1951,1,0,0,0,1953,1954,1,0,0,0,
	1954,1955,1,0,0,0,1955,1956,5,50,0,0,1956,2082,1,0,0,0,1957,1958,3,236,
	118,0,1958,1959,5,49,0,0,1959,1961,3,222,111,0,1960,1962,5,5,0,0,1961,1960,
	1,0,0,0,1961,1962,1,0,0,0,1962,1963,1,0,0,0,1963,1964,5,50,0,0,1964,2082,
	1,0,0,0,1965,2082,3,210,105,0,1966,1967,5,112,0,0,1967,1969,5,176,0,0,1968,
	1970,3,216,108,0,1969,1968,1,0,0,0,1969,1970,1,0,0,0,1970,1971,1,0,0,0,
	1971,2082,3,214,107,0,1972,1973,5,112,0,0,1973,1974,3,234,117,0,1974,1975,
	5,66,0,0,1975,1976,5,67,0,0,1976,1977,5,49,0,0,1977,1978,3,222,111,0,1978,
	1979,5,50,0,0,1979,2082,1,0,0,0,1980,1981,5,55,0,0,1981,1982,5,49,0,0,1982,
	1983,3,234,117,0,1983,1984,5,50,0,0,1984,1985,5,12,0,0,1985,1986,5,176,
	0,0,1986,2082,1,0,0,0,1987,1988,5,113,0,0,1988,2082,3,214,107,0,1989,1990,
	5,114,0,0,1990,2082,3,214,107,0,1991,1992,5,115,0,0,1992,2082,3,214,107,
	0,1993,1994,5,116,0,0,1994,2082,3,214,107,0,1995,1996,5,117,0,0,1996,1997,
	5,49,0,0,1997,1998,5,176,0,0,1998,1999,5,12,0,0,1999,2000,5,176,0,0,2000,
	2001,5,5,0,0,2001,2002,3,214,107,0,2002,2003,5,50,0,0,2003,2082,1,0,0,0,
	2004,2005,5,118,0,0,2005,2082,3,214,107,0,2006,2007,5,119,0,0,2007,2082,
	3,214,107,0,2008,2009,5,120,0,0,2009,2010,5,49,0,0,2010,2011,3,222,111,
	0,2011,2012,5,5,0,0,2012,2013,3,220,110,0,2013,2014,5,50,0,0,2014,2082,
	1,0,0,0,2015,2016,5,121,0,0,2016,2017,5,49,0,0,2017,2018,3,222,111,0,2018,
	2019,5,5,0,0,2019,2020,3,220,110,0,2020,2021,5,5,0,0,2021,2022,5,158,0,
	0,2022,2023,5,50,0,0,2023,2082,1,0,0,0,2024,2025,5,122,0,0,2025,2026,5,
	66,0,0,2026,2027,3,222,111,0,2027,2028,5,67,0,0,2028,2029,7,11,0,0,2029,
	2082,1,0,0,0,2030,2031,5,128,0,0,2031,2032,5,66,0,0,2032,2033,3,222,111,
	0,2033,2034,5,67,0,0,2034,2035,7,12,0,0,2035,2082,1,0,0,0,2036,2037,7,13,
	0,0,2037,2082,3,222,111,21,2038,2050,5,66,0,0,2039,2044,3,222,111,0,2040,
	2041,5,5,0,0,2041,2043,3,222,111,0,2042,2040,1,0,0,0,2043,2046,1,0,0,0,
	2044,2042,1,0,0,0,2044,2045,1,0,0,0,2045,2048,1,0,0,0,2046,2044,1,0,0,0,
	2047,2049,5,5,0,0,2048,2047,1,0,0,0,2048,2049,1,0,0,0,2049,2051,1,0,0,0,
	2050,2039,1,0,0,0,2050,2051,1,0,0,0,2051,2052,1,0,0,0,2052,2082,5,67,0,
	0,2053,2054,5,74,0,0,2054,2055,5,12,0,0,2055,2056,5,176,0,0,2056,2057,5,
	12,0,0,2057,2058,5,176,0,0,2058,2059,5,66,0,0,2059,2060,3,222,111,0,2060,
	2061,5,67,0,0,2061,2062,3,224,112,0,2062,2082,1,0,0,0,2063,2064,5,74,0,
	0,2064,2065,5,12,0,0,2065,2070,5,176,0,0,2066,2067,5,66,0,0,2067,2068,3,
	222,111,0,2068,2069,5,67,0,0,2069,2071,1,0,0,0,2070,2066,1,0,0,0,2071,2072,
	1,0,0,0,2072,2070,1,0,0,0,2072,2073,1,0,0,0,2073,2082,1,0,0,0,2074,2075,
	5,74,0,0,2075,2076,5,12,0,0,2076,2082,5,176,0,0,2077,2082,5,74,0,0,2078,
	2082,5,173,0,0,2079,2082,3,14,7,0,2080,2082,3,228,114,0,2081,1936,1,0,0,
	0,2081,1943,1,0,0,0,2081,1947,1,0,0,0,2081,1957,1,0,0,0,2081,1965,1,0,0,
	0,2081,1966,1,0,0,0,2081,1972,1,0,0,0,2081,1980,1,0,0,0,2081,1987,1,0,0,
	0,2081,1989,1,0,0,0,2081,1991,1,0,0,0,2081,1993,1,0,0,0,2081,1995,1,0,0,
	0,2081,2004,1,0,0,0,2081,2006,1,0,0,0,2081,2008,1,0,0,0,2081,2015,1,0,0,
	0,2081,2024,1,0,0,0,2081,2030,1,0,0,0,2081,2036,1,0,0,0,2081,2038,1,0,0,
	0,2081,2053,1,0,0,0,2081,2063,1,0,0,0,2081,2074,1,0,0,0,2081,2077,1,0,0,
	0,2081,2078,1,0,0,0,2081,2079,1,0,0,0,2081,2080,1,0,0,0,2082,2188,1,0,0,
	0,2083,2084,10,20,0,0,2084,2085,5,17,0,0,2085,2187,3,222,111,20,2086,2087,
	10,19,0,0,2087,2088,7,14,0,0,2088,2187,3,222,111,20,2089,2090,10,18,0,0,
	2090,2091,7,15,0,0,2091,2187,3,222,111,19,2092,2093,10,17,0,0,2093,2094,
	7,16,0,0,2094,2187,3,222,111,18,2095,2096,10,16,0,0,2096,2097,7,17,0,0,
	2097,2187,3,222,111,17,2098,2099,10,15,0,0,2099,2100,7,18,0,0,2100,2187,
	3,222,111,16,2101,2102,10,14,0,0,2102,2103,5,24,0,0,2103,2187,3,222,111,
	15,2104,2105,10,13,0,0,2105,2106,5,26,0,0,2106,2187,3,222,111,14,2107,2108,
	10,12,0,0,2108,2109,5,25,0,0,2109,2187,3,222,111,13,2110,2111,10,11,0,0,
	2111,2112,5,140,0,0,2112,2187,3,222,111,12,2113,2114,10,10,0,0,2114,2115,
	5,141,0,0,2115,2187,3,222,111,11,2116,2117,10,9,0,0,2117,2118,5,142,0,0,
	2118,2119,3,222,111,0,2119,2120,5,105,0,0,2120,2121,3,222,111,9,2121,2187,
	1,0,0,0,2122,2123,10,32,0,0,2123,2124,5,66,0,0,2124,2125,3,222,111,0,2125,
	2126,5,105,0,0,2126,2127,3,222,111,0,2127,2128,5,67,0,0,2128,2187,1,0,0,
	0,2129,2130,10,31,0,0,2130,2131,5,66,0,0,2131,2132,5,158,0,0,2132,2187,
	5,67,0,0,2133,2134,10,30,0,0,2134,2135,5,66,0,0,2135,2136,3,222,111,0,2136,
	2137,5,67,0,0,2137,2187,1,0,0,0,2138,2139,10,27,0,0,2139,2187,7,19,0,0,
	2140,2141,10,26,0,0,2141,2142,5,135,0,0,2142,2143,5,49,0,0,2143,2144,3,
	222,111,0,2144,2145,5,50,0,0,2145,2187,1,0,0,0,2146,2147,10,25,0,0,2147,
	2148,5,136,0,0,2148,2149,5,49,0,0,2149,2150,3,222,111,0,2150,2151,5,5,0,
	0,2151,2152,3,222,111,0,2152,2153,5,50,0,0,2153,2187,1,0,0,0,2154,2155,
	10,24,0,0,2155,2156,5,12,0,0,2156,2158,5,176,0,0,2157,2159,3,216,108,0,
	2158,2157,1,0,0,0,2158,2159,1,0,0,0,2159,2160,1,0,0,0,2160,2161,5,49,0,
	0,2161,2173,5,4,0,0,2162,2167,3,212,106,0,2163,2164,5,5,0,0,2164,2166,3,
	212,106,0,2165,2163,1,0,0,0,2166,2169,1,0,0,0,2167,2165,1,0,0,0,2167,2168,
	1,0,0,0,2168,2171,1,0,0,0,2169,2167,1,0,0,0,2170,2172,5,5,0,0,2171,2170,
	1,0,0,0,2171,2172,1,0,0,0,2172,2174,1,0,0,0,2173,2162,1,0,0,0,2173,2174,
	1,0,0,0,2174,2175,1,0,0,0,2175,2176,5,6,0,0,2176,2187,5,50,0,0,2177,2178,
	10,23,0,0,2178,2179,5,12,0,0,2179,2181,5,176,0,0,2180,2182,3,216,108,0,
	2181,2180,1,0,0,0,2181,2182,1,0,0,0,2182,2183,1,0,0,0,2183,2187,3,214,107,
	0,2184,2185,10,22,0,0,2185,2187,3,224,112,0,2186,2083,1,0,0,0,2186,2086,
	1,0,0,0,2186,2089,1,0,0,0,2186,2092,1,0,0,0,2186,2095,1,0,0,0,2186,2098,
	1,0,0,0,2186,2101,1,0,0,0,2186,2104,1,0,0,0,2186,2107,1,0,0,0,2186,2110,
	1,0,0,0,2186,2113,1,0,0,0,2186,2116,1,0,0,0,2186,2122,1,0,0,0,2186,2129,
	1,0,0,0,2186,2133,1,0,0,0,2186,2138,1,0,0,0,2186,2140,1,0,0,0,2186,2146,
	1,0,0,0,2186,2154,1,0,0,0,2186,2177,1,0,0,0,2186,2184,1,0,0,0,2187,2190,
	1,0,0,0,2188,2186,1,0,0,0,2188,2189,1,0,0,0,2189,223,1,0,0,0,2190,2188,
	1,0,0,0,2191,2192,5,12,0,0,2192,2205,5,176,0,0,2193,2205,5,123,0,0,2194,
	2205,5,124,0,0,2195,2205,5,125,0,0,2196,2205,5,126,0,0,2197,2205,5,127,
	0,0,2198,2205,5,129,0,0,2199,2205,5,130,0,0,2200,2205,5,131,0,0,2201,2205,
	5,132,0,0,2202,2205,5,143,0,0,2203,2205,5,144,0,0,2204,2191,1,0,0,0,2204,
	2193,1,0,0,0,2204,2194,1,0,0,0,2204,2195,1,0,0,0,2204,2196,1,0,0,0,2204,
	2197,1,0,0,0,2204,2198,1,0,0,0,2204,2199,1,0,0,0,2204,2200,1,0,0,0,2204,
	2201,1,0,0,0,2204,2202,1,0,0,0,2204,2203,1,0,0,0,2205,225,1,0,0,0,2206,
	2207,7,20,0,0,2207,227,1,0,0,0,2208,2223,5,154,0,0,2209,2223,3,230,115,
	0,2210,2223,3,232,116,0,2211,2215,5,164,0,0,2212,2214,5,164,0,0,2213,2212,
	1,0,0,0,2214,2217,1,0,0,0,2215,2213,1,0,0,0,2215,2216,1,0,0,0,2216,2223,
	1,0,0,0,2217,2215,1,0,0,0,2218,2223,5,174,0,0,2219,2223,5,175,0,0,2220,
	2223,5,165,0,0,2221,2223,5,166,0,0,2222,2208,1,0,0,0,2222,2209,1,0,0,0,
	2222,2210,1,0,0,0,2222,2211,1,0,0,0,2222,2218,1,0,0,0,2222,2219,1,0,0,0,
	2222,2220,1,0,0,0,2222,2221,1,0,0,0,2223,229,1,0,0,0,2224,2226,5,158,0,
	0,2225,2227,7,21,0,0,2226,2225,1,0,0,0,2226,2227,1,0,0,0,2227,231,1,0,0,
	0,2228,2229,5,157,0,0,2229,233,1,0,0,0,2230,2231,5,150,0,0,2231,2275,5,
	59,0,0,2232,2275,5,150,0,0,2233,2275,5,159,0,0,2234,2275,5,160,0,0,2235,
	2275,5,162,0,0,2236,2275,5,161,0,0,2237,2275,5,169,0,0,2238,2275,5,170,
	0,0,2239,2275,5,151,0,0,2240,2275,5,152,0,0,2241,2275,5,171,0,0,2242,2275,
	5,172,0,0,2243,2244,5,7,0,0,2244,2253,5,49,0,0,2245,2250,3,234,117,0,2246,
	2247,5,5,0,0,2247,2249,3,234,117,0,2248,2246,1,0,0,0,2249,2252,1,0,0,0,
	2250,2248,1,0,0,0,2250,2251,1,0,0,0,2251,2254,1,0,0,0,2252,2250,1,0,0,0,
	2253,2245,1,0,0,0,2253,2254,1,0,0,0,2254,2255,1,0,0,0,2255,2268,5,50,0,
	0,2256,2257,5,73,0,0,2257,2258,5,49,0,0,2258,2263,3,234,117,0,2259,2260,
	5,5,0,0,2260,2262,3,234,117,0,2261,2259,1,0,0,0,2262,2265,1,0,0,0,2263,
	2261,1,0,0,0,2263,2264,1,0,0,0,2264,2266,1,0,0,0,2265,2263,1,0,0,0,2266,
	2267,5,50,0,0,2267,2269,1,0,0,0,2268,2256,1,0,0,0,2268,2269,1,0,0,0,2269,
	2275,1,0,0,0,2270,2271,5,176,0,0,2271,2272,5,12,0,0,2272,2275,5,176,0,0,
	2273,2275,5,176,0,0,2274,2230,1,0,0,0,2274,2232,1,0,0,0,2274,2233,1,0,0,
	0,2274,2234,1,0,0,0,2274,2235,1,0,0,0,2274,2236,1,0,0,0,2274,2237,1,0,0,
	0,2274,2238,1,0,0,0,2274,2239,1,0,0,0,2274,2240,1,0,0,0,2274,2241,1,0,0,
	0,2274,2242,1,0,0,0,2274,2243,1,0,0,0,2274,2270,1,0,0,0,2274,2273,1,0,0,
	0,2275,235,1,0,0,0,2276,2277,7,22,0,0,2277,237,1,0,0,0,238,241,247,260,
	262,282,286,293,298,306,310,316,326,329,339,343,349,352,356,361,365,380,
	383,397,400,411,413,428,443,447,457,463,469,475,481,487,493,499,505,510,
	518,521,538,540,547,555,561,565,577,581,583,587,593,596,608,612,614,628,
	634,647,651,658,678,684,691,702,708,715,723,734,743,749,755,764,770,775,
	781,788,794,800,804,808,816,821,829,839,844,848,860,869,871,877,883,890,
	901,907,911,917,924,940,949,953,959,968,972,980,984,990,994,996,1004,1008,
	1010,1018,1022,1028,1032,1034,1040,1045,1078,1104,1118,1130,1134,1139,1144,
	1153,1157,1159,1181,1186,1192,1207,1216,1220,1222,1231,1236,1247,1249,1255,
	1269,1275,1287,1302,1304,1310,1322,1328,1339,1343,1354,1367,1373,1381,1387,
	1391,1401,1413,1423,1434,1441,1447,1454,1467,1524,1536,1540,1549,1559,1571,
	1579,1624,1633,1639,1651,1676,1688,1701,1705,1715,1723,1729,1735,1744,1748,
	1750,1756,1764,1768,1770,1773,1786,1792,1801,1805,1807,1816,1830,1840,1848,
	1852,1854,1872,1876,1878,1882,1894,1898,1900,1910,1914,1928,1932,1953,1961,
	1969,2044,2048,2050,2072,2081,2158,2167,2171,2173,2181,2186,2188,2204,2215,
	2222,2226,2250,2253,2263,2268,2274];

	private static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!SolidCashParser.__ATN) {
			SolidCashParser.__ATN = new ATNDeserializer().deserialize(SolidCashParser._serializedATN);
		}

		return SolidCashParser.__ATN;
	}


	static DecisionsToDFA = SolidCashParser._ATN.decisionToState.map( (ds: DecisionState, index: number) => new DFA(ds, index) );

}

export class SourceFileContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public EOF(): TerminalNode {
		return this.getToken(SolidCashParser.EOF, 0);
	}
	public pragmaDirective_list(): PragmaDirectiveContext[] {
		return this.getTypedRuleContexts(PragmaDirectiveContext) as PragmaDirectiveContext[];
	}
	public pragmaDirective(i: number): PragmaDirectiveContext {
		return this.getTypedRuleContext(PragmaDirectiveContext, i) as PragmaDirectiveContext;
	}
	public importDirective_list(): ImportDirectiveContext[] {
		return this.getTypedRuleContexts(ImportDirectiveContext) as ImportDirectiveContext[];
	}
	public importDirective(i: number): ImportDirectiveContext {
		return this.getTypedRuleContext(ImportDirectiveContext, i) as ImportDirectiveContext;
	}
	public constantDefinition_list(): ConstantDefinitionContext[] {
		return this.getTypedRuleContexts(ConstantDefinitionContext) as ConstantDefinitionContext[];
	}
	public constantDefinition(i: number): ConstantDefinitionContext {
		return this.getTypedRuleContext(ConstantDefinitionContext, i) as ConstantDefinitionContext;
	}
	public enumDefinition_list(): EnumDefinitionContext[] {
		return this.getTypedRuleContexts(EnumDefinitionContext) as EnumDefinitionContext[];
	}
	public enumDefinition(i: number): EnumDefinitionContext {
		return this.getTypedRuleContext(EnumDefinitionContext, i) as EnumDefinitionContext;
	}
	public structDefinition_list(): StructDefinitionContext[] {
		return this.getTypedRuleContexts(StructDefinitionContext) as StructDefinitionContext[];
	}
	public structDefinition(i: number): StructDefinitionContext {
		return this.getTypedRuleContext(StructDefinitionContext, i) as StructDefinitionContext;
	}
	public typeDefinition_list(): TypeDefinitionContext[] {
		return this.getTypedRuleContexts(TypeDefinitionContext) as TypeDefinitionContext[];
	}
	public typeDefinition(i: number): TypeDefinitionContext {
		return this.getTypedRuleContext(TypeDefinitionContext, i) as TypeDefinitionContext;
	}
	public usingForDirective_list(): UsingForDirectiveContext[] {
		return this.getTypedRuleContexts(UsingForDirectiveContext) as UsingForDirectiveContext[];
	}
	public usingForDirective(i: number): UsingForDirectiveContext {
		return this.getTypedRuleContext(UsingForDirectiveContext, i) as UsingForDirectiveContext;
	}
	public errorDefinition_list(): ErrorDefinitionContext[] {
		return this.getTypedRuleContexts(ErrorDefinitionContext) as ErrorDefinitionContext[];
	}
	public errorDefinition(i: number): ErrorDefinitionContext {
		return this.getTypedRuleContext(ErrorDefinitionContext, i) as ErrorDefinitionContext;
	}
	public interfaceDefinition_list(): InterfaceDefinitionContext[] {
		return this.getTypedRuleContexts(InterfaceDefinitionContext) as InterfaceDefinitionContext[];
	}
	public interfaceDefinition(i: number): InterfaceDefinitionContext {
		return this.getTypedRuleContext(InterfaceDefinitionContext, i) as InterfaceDefinitionContext;
	}
	public freeFunctionDefinition_list(): FreeFunctionDefinitionContext[] {
		return this.getTypedRuleContexts(FreeFunctionDefinitionContext) as FreeFunctionDefinitionContext[];
	}
	public freeFunctionDefinition(i: number): FreeFunctionDefinitionContext {
		return this.getTypedRuleContext(FreeFunctionDefinitionContext, i) as FreeFunctionDefinitionContext;
	}
	public libraryDefinition_list(): LibraryDefinitionContext[] {
		return this.getTypedRuleContexts(LibraryDefinitionContext) as LibraryDefinitionContext[];
	}
	public libraryDefinition(i: number): LibraryDefinitionContext {
		return this.getTypedRuleContext(LibraryDefinitionContext, i) as LibraryDefinitionContext;
	}
	public contractDefinition_list(): ContractDefinitionContext[] {
		return this.getTypedRuleContexts(ContractDefinitionContext) as ContractDefinitionContext[];
	}
	public contractDefinition(i: number): ContractDefinitionContext {
		return this.getTypedRuleContext(ContractDefinitionContext, i) as ContractDefinitionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_sourceFile;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitSourceFile) {
			return visitor.visitSourceFile(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ImportDirectiveContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_importDirective;
	}
	public override copyFrom(ctx: ImportDirectiveContext): void {
		super.copyFrom(ctx);
	}
}
export class SelectiveImportContext extends ImportDirectiveContext {
	constructor(parser: SolidCashParser, ctx: ImportDirectiveContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public importBinding_list(): ImportBindingContext[] {
		return this.getTypedRuleContexts(ImportBindingContext) as ImportBindingContext[];
	}
	public importBinding(i: number): ImportBindingContext {
		return this.getTypedRuleContext(ImportBindingContext, i) as ImportBindingContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public StringLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.StringLiteral, 0);
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitSelectiveImport) {
			return visitor.visitSelectiveImport(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class WildcardImportContext extends ImportDirectiveContext {
	constructor(parser: SolidCashParser, ctx: ImportDirectiveContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public StringLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.StringLiteral, 0);
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitWildcardImport) {
			return visitor.visitWildcardImport(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class NamespaceImportContext extends ImportDirectiveContext {
	constructor(parser: SolidCashParser, ctx: ImportDirectiveContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public StringLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.StringLiteral, 0);
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitNamespaceImport) {
			return visitor.visitNamespaceImport(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ImportBindingContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_importBinding;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitImportBinding) {
			return visitor.visitImportBinding(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FreeFunctionDefinitionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
	}
	public parameterList(): ParameterListContext {
		return this.getTypedRuleContext(ParameterListContext, 0) as ParameterListContext;
	}
	public functionModifier_list(): FunctionModifierContext[] {
		return this.getTypedRuleContexts(FunctionModifierContext) as FunctionModifierContext[];
	}
	public functionModifier(i: number): FunctionModifierContext {
		return this.getTypedRuleContext(FunctionModifierContext, i) as FunctionModifierContext;
	}
	public returnType(): ReturnTypeContext {
		return this.getTypedRuleContext(ReturnTypeContext, 0) as ReturnTypeContext;
	}
	public statement_list(): StatementContext[] {
		return this.getTypedRuleContexts(StatementContext) as StatementContext[];
	}
	public statement(i: number): StatementContext {
		return this.getTypedRuleContext(StatementContext, i) as StatementContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_freeFunctionDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitFreeFunctionDefinition) {
			return visitor.visitFreeFunctionDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class UsingForDirectiveContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_usingForDirective;
	}
	public override copyFrom(ctx: UsingForDirectiveContext): void {
		super.copyFrom(ctx);
	}
}
export class UsingFunctionsForContext extends UsingForDirectiveContext {
	constructor(parser: SolidCashParser, ctx: UsingForDirectiveContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public usingFunctionBinding_list(): UsingFunctionBindingContext[] {
		return this.getTypedRuleContexts(UsingFunctionBindingContext) as UsingFunctionBindingContext[];
	}
	public usingFunctionBinding(i: number): UsingFunctionBindingContext {
		return this.getTypedRuleContext(UsingFunctionBindingContext, i) as UsingFunctionBindingContext;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitUsingFunctionsFor) {
			return visitor.visitUsingFunctionsFor(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class UsingLibraryForContext extends UsingForDirectiveContext {
	constructor(parser: SolidCashParser, ctx: UsingForDirectiveContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitUsingLibraryFor) {
			return visitor.visitUsingLibraryFor(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class UsingFunctionBindingContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public userDefinableOperator(): UserDefinableOperatorContext {
		return this.getTypedRuleContext(UserDefinableOperatorContext, 0) as UserDefinableOperatorContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_usingFunctionBinding;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitUsingFunctionBinding) {
			return visitor.visitUsingFunctionBinding(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class UserDefinableOperatorContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_userDefinableOperator;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitUserDefinableOperator) {
			return visitor.visitUserDefinableOperator(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class AnyIdentifierContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public CryptoType(): TerminalNode {
		return this.getToken(SolidCashParser.CryptoType, 0);
	}
	public BchUnit(): TerminalNode {
		return this.getToken(SolidCashParser.BchUnit, 0);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_anyIdentifier;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitAnyIdentifier) {
			return visitor.visitAnyIdentifier(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PragmaDirectiveContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public pragmaName(): PragmaNameContext {
		return this.getTypedRuleContext(PragmaNameContext, 0) as PragmaNameContext;
	}
	public pragmaValue(): PragmaValueContext {
		return this.getTypedRuleContext(PragmaValueContext, 0) as PragmaValueContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_pragmaDirective;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitPragmaDirective) {
			return visitor.visitPragmaDirective(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PragmaNameContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_pragmaName;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitPragmaName) {
			return visitor.visitPragmaName(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PragmaValueContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public versionConstraint_list(): VersionConstraintContext[] {
		return this.getTypedRuleContexts(VersionConstraintContext) as VersionConstraintContext[];
	}
	public versionConstraint(i: number): VersionConstraintContext {
		return this.getTypedRuleContext(VersionConstraintContext, i) as VersionConstraintContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_pragmaValue;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitPragmaValue) {
			return visitor.visitPragmaValue(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class VersionConstraintContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public VersionLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.VersionLiteral, 0);
	}
	public versionOperator(): VersionOperatorContext {
		return this.getTypedRuleContext(VersionOperatorContext, 0) as VersionOperatorContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_versionConstraint;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitVersionConstraint) {
			return visitor.visitVersionConstraint(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class VersionOperatorContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_versionOperator;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitVersionOperator) {
			return visitor.visitVersionOperator(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class InterfaceDefinitionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public enumDefinition_list(): EnumDefinitionContext[] {
		return this.getTypedRuleContexts(EnumDefinitionContext) as EnumDefinitionContext[];
	}
	public enumDefinition(i: number): EnumDefinitionContext {
		return this.getTypedRuleContext(EnumDefinitionContext, i) as EnumDefinitionContext;
	}
	public structDefinition_list(): StructDefinitionContext[] {
		return this.getTypedRuleContexts(StructDefinitionContext) as StructDefinitionContext[];
	}
	public structDefinition(i: number): StructDefinitionContext {
		return this.getTypedRuleContext(StructDefinitionContext, i) as StructDefinitionContext;
	}
	public typeDefinition_list(): TypeDefinitionContext[] {
		return this.getTypedRuleContexts(TypeDefinitionContext) as TypeDefinitionContext[];
	}
	public typeDefinition(i: number): TypeDefinitionContext {
		return this.getTypedRuleContext(TypeDefinitionContext, i) as TypeDefinitionContext;
	}
	public eventDefinition_list(): EventDefinitionContext[] {
		return this.getTypedRuleContexts(EventDefinitionContext) as EventDefinitionContext[];
	}
	public eventDefinition(i: number): EventDefinitionContext {
		return this.getTypedRuleContext(EventDefinitionContext, i) as EventDefinitionContext;
	}
	public errorDefinition_list(): ErrorDefinitionContext[] {
		return this.getTypedRuleContexts(ErrorDefinitionContext) as ErrorDefinitionContext[];
	}
	public errorDefinition(i: number): ErrorDefinitionContext {
		return this.getTypedRuleContext(ErrorDefinitionContext, i) as ErrorDefinitionContext;
	}
	public interfaceStateVariable_list(): InterfaceStateVariableContext[] {
		return this.getTypedRuleContexts(InterfaceStateVariableContext) as InterfaceStateVariableContext[];
	}
	public interfaceStateVariable(i: number): InterfaceStateVariableContext {
		return this.getTypedRuleContext(InterfaceStateVariableContext, i) as InterfaceStateVariableContext;
	}
	public interfaceCollection_list(): InterfaceCollectionContext[] {
		return this.getTypedRuleContexts(InterfaceCollectionContext) as InterfaceCollectionContext[];
	}
	public interfaceCollection(i: number): InterfaceCollectionContext {
		return this.getTypedRuleContext(InterfaceCollectionContext, i) as InterfaceCollectionContext;
	}
	public interfaceFunction_list(): InterfaceFunctionContext[] {
		return this.getTypedRuleContexts(InterfaceFunctionContext) as InterfaceFunctionContext[];
	}
	public interfaceFunction(i: number): InterfaceFunctionContext {
		return this.getTypedRuleContext(InterfaceFunctionContext, i) as InterfaceFunctionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_interfaceDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitInterfaceDefinition) {
			return visitor.visitInterfaceDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class InterfaceCollectionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public interfaceStateVariableVisibility(): InterfaceStateVariableVisibilityContext {
		return this.getTypedRuleContext(InterfaceStateVariableVisibilityContext, 0) as InterfaceStateVariableVisibilityContext;
	}
	public mappingType(): MappingTypeContext {
		return this.getTypedRuleContext(MappingTypeContext, 0) as MappingTypeContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public arrayType(): ArrayTypeContext {
		return this.getTypedRuleContext(ArrayTypeContext, 0) as ArrayTypeContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_interfaceCollection;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitInterfaceCollection) {
			return visitor.visitInterfaceCollection(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class InterfaceStateVariableContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public interfaceStateVariableVisibility(): InterfaceStateVariableVisibilityContext {
		return this.getTypedRuleContext(InterfaceStateVariableVisibilityContext, 0) as InterfaceStateVariableVisibilityContext;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_interfaceStateVariable;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitInterfaceStateVariable) {
			return visitor.visitInterfaceStateVariable(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class InterfaceStateVariableVisibilityContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_interfaceStateVariableVisibility;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitInterfaceStateVariableVisibility) {
			return visitor.visitInterfaceStateVariableVisibility(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class InterfaceFunctionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public parameterList(): ParameterListContext {
		return this.getTypedRuleContext(ParameterListContext, 0) as ParameterListContext;
	}
	public functionModifier_list(): FunctionModifierContext[] {
		return this.getTypedRuleContexts(FunctionModifierContext) as FunctionModifierContext[];
	}
	public functionModifier(i: number): FunctionModifierContext {
		return this.getTypedRuleContext(FunctionModifierContext, i) as FunctionModifierContext;
	}
	public returnType(): ReturnTypeContext {
		return this.getTypedRuleContext(ReturnTypeContext, 0) as ReturnTypeContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_interfaceFunction;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitInterfaceFunction) {
			return visitor.visitInterfaceFunction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class LibraryDefinitionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public enumDefinition_list(): EnumDefinitionContext[] {
		return this.getTypedRuleContexts(EnumDefinitionContext) as EnumDefinitionContext[];
	}
	public enumDefinition(i: number): EnumDefinitionContext {
		return this.getTypedRuleContext(EnumDefinitionContext, i) as EnumDefinitionContext;
	}
	public structDefinition_list(): StructDefinitionContext[] {
		return this.getTypedRuleContexts(StructDefinitionContext) as StructDefinitionContext[];
	}
	public structDefinition(i: number): StructDefinitionContext {
		return this.getTypedRuleContext(StructDefinitionContext, i) as StructDefinitionContext;
	}
	public typeDefinition_list(): TypeDefinitionContext[] {
		return this.getTypedRuleContexts(TypeDefinitionContext) as TypeDefinitionContext[];
	}
	public typeDefinition(i: number): TypeDefinitionContext {
		return this.getTypedRuleContext(TypeDefinitionContext, i) as TypeDefinitionContext;
	}
	public eventDefinition_list(): EventDefinitionContext[] {
		return this.getTypedRuleContexts(EventDefinitionContext) as EventDefinitionContext[];
	}
	public eventDefinition(i: number): EventDefinitionContext {
		return this.getTypedRuleContext(EventDefinitionContext, i) as EventDefinitionContext;
	}
	public errorDefinition_list(): ErrorDefinitionContext[] {
		return this.getTypedRuleContexts(ErrorDefinitionContext) as ErrorDefinitionContext[];
	}
	public errorDefinition(i: number): ErrorDefinitionContext {
		return this.getTypedRuleContext(ErrorDefinitionContext, i) as ErrorDefinitionContext;
	}
	public constantDefinition_list(): ConstantDefinitionContext[] {
		return this.getTypedRuleContexts(ConstantDefinitionContext) as ConstantDefinitionContext[];
	}
	public constantDefinition(i: number): ConstantDefinitionContext {
		return this.getTypedRuleContext(ConstantDefinitionContext, i) as ConstantDefinitionContext;
	}
	public usingForDirective_list(): UsingForDirectiveContext[] {
		return this.getTypedRuleContexts(UsingForDirectiveContext) as UsingForDirectiveContext[];
	}
	public usingForDirective(i: number): UsingForDirectiveContext {
		return this.getTypedRuleContext(UsingForDirectiveContext, i) as UsingForDirectiveContext;
	}
	public freeFunctionDefinition_list(): FreeFunctionDefinitionContext[] {
		return this.getTypedRuleContexts(FreeFunctionDefinitionContext) as FreeFunctionDefinitionContext[];
	}
	public freeFunctionDefinition(i: number): FreeFunctionDefinitionContext {
		return this.getTypedRuleContext(FreeFunctionDefinitionContext, i) as FreeFunctionDefinitionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_libraryDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitLibraryDefinition) {
			return visitor.visitLibraryDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ContractDefinitionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public parameterList(): ParameterListContext {
		return this.getTypedRuleContext(ParameterListContext, 0) as ParameterListContext;
	}
	public inheritanceSpecifier_list(): InheritanceSpecifierContext[] {
		return this.getTypedRuleContexts(InheritanceSpecifierContext) as InheritanceSpecifierContext[];
	}
	public inheritanceSpecifier(i: number): InheritanceSpecifierContext {
		return this.getTypedRuleContext(InheritanceSpecifierContext, i) as InheritanceSpecifierContext;
	}
	public enumDefinition_list(): EnumDefinitionContext[] {
		return this.getTypedRuleContexts(EnumDefinitionContext) as EnumDefinitionContext[];
	}
	public enumDefinition(i: number): EnumDefinitionContext {
		return this.getTypedRuleContext(EnumDefinitionContext, i) as EnumDefinitionContext;
	}
	public structDefinition_list(): StructDefinitionContext[] {
		return this.getTypedRuleContexts(StructDefinitionContext) as StructDefinitionContext[];
	}
	public structDefinition(i: number): StructDefinitionContext {
		return this.getTypedRuleContext(StructDefinitionContext, i) as StructDefinitionContext;
	}
	public typeDefinition_list(): TypeDefinitionContext[] {
		return this.getTypedRuleContexts(TypeDefinitionContext) as TypeDefinitionContext[];
	}
	public typeDefinition(i: number): TypeDefinitionContext {
		return this.getTypedRuleContext(TypeDefinitionContext, i) as TypeDefinitionContext;
	}
	public eventDefinition_list(): EventDefinitionContext[] {
		return this.getTypedRuleContexts(EventDefinitionContext) as EventDefinitionContext[];
	}
	public eventDefinition(i: number): EventDefinitionContext {
		return this.getTypedRuleContext(EventDefinitionContext, i) as EventDefinitionContext;
	}
	public errorDefinition_list(): ErrorDefinitionContext[] {
		return this.getTypedRuleContexts(ErrorDefinitionContext) as ErrorDefinitionContext[];
	}
	public errorDefinition(i: number): ErrorDefinitionContext {
		return this.getTypedRuleContext(ErrorDefinitionContext, i) as ErrorDefinitionContext;
	}
	public constantDefinition_list(): ConstantDefinitionContext[] {
		return this.getTypedRuleContexts(ConstantDefinitionContext) as ConstantDefinitionContext[];
	}
	public constantDefinition(i: number): ConstantDefinitionContext {
		return this.getTypedRuleContext(ConstantDefinitionContext, i) as ConstantDefinitionContext;
	}
	public usingForDirective_list(): UsingForDirectiveContext[] {
		return this.getTypedRuleContexts(UsingForDirectiveContext) as UsingForDirectiveContext[];
	}
	public usingForDirective(i: number): UsingForDirectiveContext {
		return this.getTypedRuleContext(UsingForDirectiveContext, i) as UsingForDirectiveContext;
	}
	public stateVariableDeclaration_list(): StateVariableDeclarationContext[] {
		return this.getTypedRuleContexts(StateVariableDeclarationContext) as StateVariableDeclarationContext[];
	}
	public stateVariableDeclaration(i: number): StateVariableDeclarationContext {
		return this.getTypedRuleContext(StateVariableDeclarationContext, i) as StateVariableDeclarationContext;
	}
	public modifierDefinition_list(): ModifierDefinitionContext[] {
		return this.getTypedRuleContexts(ModifierDefinitionContext) as ModifierDefinitionContext[];
	}
	public modifierDefinition(i: number): ModifierDefinitionContext {
		return this.getTypedRuleContext(ModifierDefinitionContext, i) as ModifierDefinitionContext;
	}
	public constructorDefinition_list(): ConstructorDefinitionContext[] {
		return this.getTypedRuleContexts(ConstructorDefinitionContext) as ConstructorDefinitionContext[];
	}
	public constructorDefinition(i: number): ConstructorDefinitionContext {
		return this.getTypedRuleContext(ConstructorDefinitionContext, i) as ConstructorDefinitionContext;
	}
	public functionDefinition_list(): FunctionDefinitionContext[] {
		return this.getTypedRuleContexts(FunctionDefinitionContext) as FunctionDefinitionContext[];
	}
	public functionDefinition(i: number): FunctionDefinitionContext {
		return this.getTypedRuleContext(FunctionDefinitionContext, i) as FunctionDefinitionContext;
	}
	public abstractFunctionDefinition_list(): AbstractFunctionDefinitionContext[] {
		return this.getTypedRuleContexts(AbstractFunctionDefinitionContext) as AbstractFunctionDefinitionContext[];
	}
	public abstractFunctionDefinition(i: number): AbstractFunctionDefinitionContext {
		return this.getTypedRuleContext(AbstractFunctionDefinitionContext, i) as AbstractFunctionDefinitionContext;
	}
	public fallbackDefinition_list(): FallbackDefinitionContext[] {
		return this.getTypedRuleContexts(FallbackDefinitionContext) as FallbackDefinitionContext[];
	}
	public fallbackDefinition(i: number): FallbackDefinitionContext {
		return this.getTypedRuleContext(FallbackDefinitionContext, i) as FallbackDefinitionContext;
	}
	public receiveDefinition_list(): ReceiveDefinitionContext[] {
		return this.getTypedRuleContexts(ReceiveDefinitionContext) as ReceiveDefinitionContext[];
	}
	public receiveDefinition(i: number): ReceiveDefinitionContext {
		return this.getTypedRuleContext(ReceiveDefinitionContext, i) as ReceiveDefinitionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_contractDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitContractDefinition) {
			return visitor.visitContractDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class InheritanceSpecifierContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_inheritanceSpecifier;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitInheritanceSpecifier) {
			return visitor.visitInheritanceSpecifier(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class AbstractFunctionDefinitionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
	}
	public parameterList(): ParameterListContext {
		return this.getTypedRuleContext(ParameterListContext, 0) as ParameterListContext;
	}
	public functionModifier_list(): FunctionModifierContext[] {
		return this.getTypedRuleContexts(FunctionModifierContext) as FunctionModifierContext[];
	}
	public functionModifier(i: number): FunctionModifierContext {
		return this.getTypedRuleContext(FunctionModifierContext, i) as FunctionModifierContext;
	}
	public customModifierInvocation_list(): CustomModifierInvocationContext[] {
		return this.getTypedRuleContexts(CustomModifierInvocationContext) as CustomModifierInvocationContext[];
	}
	public customModifierInvocation(i: number): CustomModifierInvocationContext {
		return this.getTypedRuleContext(CustomModifierInvocationContext, i) as CustomModifierInvocationContext;
	}
	public returnType(): ReturnTypeContext {
		return this.getTypedRuleContext(ReturnTypeContext, 0) as ReturnTypeContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_abstractFunctionDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitAbstractFunctionDefinition) {
			return visitor.visitAbstractFunctionDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class EventDefinitionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public eventParameter_list(): EventParameterContext[] {
		return this.getTypedRuleContexts(EventParameterContext) as EventParameterContext[];
	}
	public eventParameter(i: number): EventParameterContext {
		return this.getTypedRuleContext(EventParameterContext, i) as EventParameterContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_eventDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitEventDefinition) {
			return visitor.visitEventDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class EventParameterContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public arrayType(): ArrayTypeContext {
		return this.getTypedRuleContext(ArrayTypeContext, 0) as ArrayTypeContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_eventParameter;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitEventParameter) {
			return visitor.visitEventParameter(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ErrorDefinitionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public errorParameter_list(): ErrorParameterContext[] {
		return this.getTypedRuleContexts(ErrorParameterContext) as ErrorParameterContext[];
	}
	public errorParameter(i: number): ErrorParameterContext {
		return this.getTypedRuleContext(ErrorParameterContext, i) as ErrorParameterContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_errorDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitErrorDefinition) {
			return visitor.visitErrorDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ErrorParameterContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_errorParameter;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitErrorParameter) {
			return visitor.visitErrorParameter(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StructDefinitionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public structField_list(): StructFieldContext[] {
		return this.getTypedRuleContexts(StructFieldContext) as StructFieldContext[];
	}
	public structField(i: number): StructFieldContext {
		return this.getTypedRuleContext(StructFieldContext, i) as StructFieldContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_structDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitStructDefinition) {
			return visitor.visitStructDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StructFieldContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public arrayType(): ArrayTypeContext {
		return this.getTypedRuleContext(ArrayTypeContext, 0) as ArrayTypeContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_structField;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitStructField) {
			return visitor.visitStructField(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class EnumDefinitionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public enumMember_list(): EnumMemberContext[] {
		return this.getTypedRuleContexts(EnumMemberContext) as EnumMemberContext[];
	}
	public enumMember(i: number): EnumMemberContext {
		return this.getTypedRuleContext(EnumMemberContext, i) as EnumMemberContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_enumDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitEnumDefinition) {
			return visitor.visitEnumDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class EnumMemberContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public NumberLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.NumberLiteral, 0);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_enumMember;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitEnumMember) {
			return visitor.visitEnumMember(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TypeDefinitionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_typeDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitTypeDefinition) {
			return visitor.visitTypeDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ConstantDefinitionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_constantDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitConstantDefinition) {
			return visitor.visitConstantDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ConstructorDefinitionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public parameterList(): ParameterListContext {
		return this.getTypedRuleContext(ParameterListContext, 0) as ParameterListContext;
	}
	public parentInvocation_list(): ParentInvocationContext[] {
		return this.getTypedRuleContexts(ParentInvocationContext) as ParentInvocationContext[];
	}
	public parentInvocation(i: number): ParentInvocationContext {
		return this.getTypedRuleContext(ParentInvocationContext, i) as ParentInvocationContext;
	}
	public statement_list(): StatementContext[] {
		return this.getTypedRuleContexts(StatementContext) as StatementContext[];
	}
	public statement(i: number): StatementContext {
		return this.getTypedRuleContext(StatementContext, i) as StatementContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_constructorDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitConstructorDefinition) {
			return visitor.visitConstructorDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FallbackDefinitionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public parameterList(): ParameterListContext {
		return this.getTypedRuleContext(ParameterListContext, 0) as ParameterListContext;
	}
	public fallbackModifier_list(): FallbackModifierContext[] {
		return this.getTypedRuleContexts(FallbackModifierContext) as FallbackModifierContext[];
	}
	public fallbackModifier(i: number): FallbackModifierContext {
		return this.getTypedRuleContext(FallbackModifierContext, i) as FallbackModifierContext;
	}
	public customModifierInvocation_list(): CustomModifierInvocationContext[] {
		return this.getTypedRuleContexts(CustomModifierInvocationContext) as CustomModifierInvocationContext[];
	}
	public customModifierInvocation(i: number): CustomModifierInvocationContext {
		return this.getTypedRuleContext(CustomModifierInvocationContext, i) as CustomModifierInvocationContext;
	}
	public statement_list(): StatementContext[] {
		return this.getTypedRuleContexts(StatementContext) as StatementContext[];
	}
	public statement(i: number): StatementContext {
		return this.getTypedRuleContext(StatementContext, i) as StatementContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_fallbackDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitFallbackDefinition) {
			return visitor.visitFallbackDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FallbackModifierContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public overrideSpecifier(): OverrideSpecifierContext {
		return this.getTypedRuleContext(OverrideSpecifierContext, 0) as OverrideSpecifierContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_fallbackModifier;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitFallbackModifier) {
			return visitor.visitFallbackModifier(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ReceiveDefinitionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public statement_list(): StatementContext[] {
		return this.getTypedRuleContexts(StatementContext) as StatementContext[];
	}
	public statement(i: number): StatementContext {
		return this.getTypedRuleContext(StatementContext, i) as StatementContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_receiveDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitReceiveDefinition) {
			return visitor.visitReceiveDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ParentInvocationContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_parentInvocation;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitParentInvocation) {
			return visitor.visitParentInvocation(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StateVariableDeclarationContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public stateVariableVisibility(): StateVariableVisibilityContext {
		return this.getTypedRuleContext(StateVariableVisibilityContext, 0) as StateVariableVisibilityContext;
	}
	public modifier_list(): ModifierContext[] {
		return this.getTypedRuleContexts(ModifierContext) as ModifierContext[];
	}
	public modifier(i: number): ModifierContext {
		return this.getTypedRuleContext(ModifierContext, i) as ModifierContext;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public mappingType(): MappingTypeContext {
		return this.getTypedRuleContext(MappingTypeContext, 0) as MappingTypeContext;
	}
	public collectionModifier_list(): CollectionModifierContext[] {
		return this.getTypedRuleContexts(CollectionModifierContext) as CollectionModifierContext[];
	}
	public collectionModifier(i: number): CollectionModifierContext {
		return this.getTypedRuleContext(CollectionModifierContext, i) as CollectionModifierContext;
	}
	public arrayType(): ArrayTypeContext {
		return this.getTypedRuleContext(ArrayTypeContext, 0) as ArrayTypeContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_stateVariableDeclaration;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitStateVariableDeclaration) {
			return visitor.visitStateVariableDeclaration(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class CollectionModifierContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public modifier(): ModifierContext {
		return this.getTypedRuleContext(ModifierContext, 0) as ModifierContext;
	}
	public stateVariableVisibility(): StateVariableVisibilityContext {
		return this.getTypedRuleContext(StateVariableVisibilityContext, 0) as StateVariableVisibilityContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_collectionModifier;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitCollectionModifier) {
			return visitor.visitCollectionModifier(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StateVariableVisibilityContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_stateVariableVisibility;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitStateVariableVisibility) {
			return visitor.visitStateVariableVisibility(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class MappingTypeContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName_list(): TypeNameContext[] {
		return this.getTypedRuleContexts(TypeNameContext) as TypeNameContext[];
	}
	public typeName(i: number): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, i) as TypeNameContext;
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public mappingType(): MappingTypeContext {
		return this.getTypedRuleContext(MappingTypeContext, 0) as MappingTypeContext;
	}
	public arrayType(): ArrayTypeContext {
		return this.getTypedRuleContext(ArrayTypeContext, 0) as ArrayTypeContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_mappingType;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitMappingType) {
			return visitor.visitMappingType(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ArrayTypeContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public NumberLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.NumberLiteral, 0);
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public arrayType(): ArrayTypeContext {
		return this.getTypedRuleContext(ArrayTypeContext, 0) as ArrayTypeContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_arrayType;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitArrayType) {
			return visitor.visitArrayType(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ModifierDefinitionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public parameterList(): ParameterListContext {
		return this.getTypedRuleContext(ParameterListContext, 0) as ParameterListContext;
	}
	public modifierStatement_list(): ModifierStatementContext[] {
		return this.getTypedRuleContexts(ModifierStatementContext) as ModifierStatementContext[];
	}
	public modifierStatement(i: number): ModifierStatementContext {
		return this.getTypedRuleContext(ModifierStatementContext, i) as ModifierStatementContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_modifierDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitModifierDefinition) {
			return visitor.visitModifierDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ModifierStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public placeholderStatement(): PlaceholderStatementContext {
		return this.getTypedRuleContext(PlaceholderStatementContext, 0) as PlaceholderStatementContext;
	}
	public statement(): StatementContext {
		return this.getTypedRuleContext(StatementContext, 0) as StatementContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_modifierStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitModifierStatement) {
			return visitor.visitModifierStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PlaceholderStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_placeholderStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitPlaceholderStatement) {
			return visitor.visitPlaceholderStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FunctionDefinitionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
	}
	public parameterList(): ParameterListContext {
		return this.getTypedRuleContext(ParameterListContext, 0) as ParameterListContext;
	}
	public functionModifier_list(): FunctionModifierContext[] {
		return this.getTypedRuleContexts(FunctionModifierContext) as FunctionModifierContext[];
	}
	public functionModifier(i: number): FunctionModifierContext {
		return this.getTypedRuleContext(FunctionModifierContext, i) as FunctionModifierContext;
	}
	public customModifierInvocation_list(): CustomModifierInvocationContext[] {
		return this.getTypedRuleContexts(CustomModifierInvocationContext) as CustomModifierInvocationContext[];
	}
	public customModifierInvocation(i: number): CustomModifierInvocationContext {
		return this.getTypedRuleContext(CustomModifierInvocationContext, i) as CustomModifierInvocationContext;
	}
	public returnType(): ReturnTypeContext {
		return this.getTypedRuleContext(ReturnTypeContext, 0) as ReturnTypeContext;
	}
	public statement_list(): StatementContext[] {
		return this.getTypedRuleContexts(StatementContext) as StatementContext[];
	}
	public statement(i: number): StatementContext {
		return this.getTypedRuleContext(StatementContext, i) as StatementContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_functionDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitFunctionDefinition) {
			return visitor.visitFunctionDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class CustomModifierInvocationContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_customModifierInvocation;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitCustomModifierInvocation) {
			return visitor.visitCustomModifierInvocation(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FunctionModifierContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public overrideSpecifier(): OverrideSpecifierContext {
		return this.getTypedRuleContext(OverrideSpecifierContext, 0) as OverrideSpecifierContext;
	}
	public unsafeModifier(): UnsafeModifierContext {
		return this.getTypedRuleContext(UnsafeModifierContext, 0) as UnsafeModifierContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_functionModifier;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitFunctionModifier) {
			return visitor.visitFunctionModifier(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class OverrideSpecifierContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_overrideSpecifier;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitOverrideSpecifier) {
			return visitor.visitOverrideSpecifier(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class UnsafeModifierContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public NumberLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.NumberLiteral, 0);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_unsafeModifier;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitUnsafeModifier) {
			return visitor.visitUnsafeModifier(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ReturnTypeContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public returnParam_list(): ReturnParamContext[] {
		return this.getTypedRuleContexts(ReturnParamContext) as ReturnParamContext[];
	}
	public returnParam(i: number): ReturnParamContext {
		return this.getTypedRuleContext(ReturnParamContext, i) as ReturnParamContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_returnType;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitReturnType) {
			return visitor.visitReturnType(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ReturnParamContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public modifier_list(): ModifierContext[] {
		return this.getTypedRuleContexts(ModifierContext) as ModifierContext[];
	}
	public modifier(i: number): ModifierContext {
		return this.getTypedRuleContext(ModifierContext, i) as ModifierContext;
	}
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
	}
	public arrayType(): ArrayTypeContext {
		return this.getTypedRuleContext(ArrayTypeContext, 0) as ArrayTypeContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_returnParam;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitReturnParam) {
			return visitor.visitReturnParam(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ParameterListContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public parameter_list(): ParameterContext[] {
		return this.getTypedRuleContexts(ParameterContext) as ParameterContext[];
	}
	public parameter(i: number): ParameterContext {
		return this.getTypedRuleContext(ParameterContext, i) as ParameterContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_parameterList;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitParameterList) {
			return visitor.visitParameterList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ParameterContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public modifier_list(): ModifierContext[] {
		return this.getTypedRuleContexts(ModifierContext) as ModifierContext[];
	}
	public modifier(i: number): ModifierContext {
		return this.getTypedRuleContext(ModifierContext, i) as ModifierContext;
	}
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
	}
	public arrayType(): ArrayTypeContext {
		return this.getTypedRuleContext(ArrayTypeContext, 0) as ArrayTypeContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_parameter;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitParameter) {
			return visitor.visitParameter(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class BlockContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public statement_list(): StatementContext[] {
		return this.getTypedRuleContexts(StatementContext) as StatementContext[];
	}
	public statement(i: number): StatementContext {
		return this.getTypedRuleContext(StatementContext, i) as StatementContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_block;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitBlock) {
			return visitor.visitBlock(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public variableDefinition(): VariableDefinitionContext {
		return this.getTypedRuleContext(VariableDefinitionContext, 0) as VariableDefinitionContext;
	}
	public tupleAssignment(): TupleAssignmentContext {
		return this.getTypedRuleContext(TupleAssignmentContext, 0) as TupleAssignmentContext;
	}
	public arrayPushStatement(): ArrayPushStatementContext {
		return this.getTypedRuleContext(ArrayPushStatementContext, 0) as ArrayPushStatementContext;
	}
	public arrayPopStatement(): ArrayPopStatementContext {
		return this.getTypedRuleContext(ArrayPopStatementContext, 0) as ArrayPopStatementContext;
	}
	public arrayDeleteStatement(): ArrayDeleteStatementContext {
		return this.getTypedRuleContext(ArrayDeleteStatementContext, 0) as ArrayDeleteStatementContext;
	}
	public stateArrayPushStatement(): StateArrayPushStatementContext {
		return this.getTypedRuleContext(StateArrayPushStatementContext, 0) as StateArrayPushStatementContext;
	}
	public stateArrayPopStatement(): StateArrayPopStatementContext {
		return this.getTypedRuleContext(StateArrayPopStatementContext, 0) as StateArrayPopStatementContext;
	}
	public assignStatement(): AssignStatementContext {
		return this.getTypedRuleContext(AssignStatementContext, 0) as AssignStatementContext;
	}
	public assignmentStatement(): AssignmentStatementContext {
		return this.getTypedRuleContext(AssignmentStatementContext, 0) as AssignmentStatementContext;
	}
	public mappingDeleteStatement(): MappingDeleteStatementContext {
		return this.getTypedRuleContext(MappingDeleteStatementContext, 0) as MappingDeleteStatementContext;
	}
	public timeOpStatement(): TimeOpStatementContext {
		return this.getTypedRuleContext(TimeOpStatementContext, 0) as TimeOpStatementContext;
	}
	public requireStatement(): RequireStatementContext {
		return this.getTypedRuleContext(RequireStatementContext, 0) as RequireStatementContext;
	}
	public ifStatement(): IfStatementContext {
		return this.getTypedRuleContext(IfStatementContext, 0) as IfStatementContext;
	}
	public loopStatement(): LoopStatementContext {
		return this.getTypedRuleContext(LoopStatementContext, 0) as LoopStatementContext;
	}
	public consoleStatement(): ConsoleStatementContext {
		return this.getTypedRuleContext(ConsoleStatementContext, 0) as ConsoleStatementContext;
	}
	public emitStatement(): EmitStatementContext {
		return this.getTypedRuleContext(EmitStatementContext, 0) as EmitStatementContext;
	}
	public transferStatement(): TransferStatementContext {
		return this.getTypedRuleContext(TransferStatementContext, 0) as TransferStatementContext;
	}
	public tokenContainerMethodStatement(): TokenContainerMethodStatementContext {
		return this.getTypedRuleContext(TokenContainerMethodStatementContext, 0) as TokenContainerMethodStatementContext;
	}
	public returnStatement(): ReturnStatementContext {
		return this.getTypedRuleContext(ReturnStatementContext, 0) as ReturnStatementContext;
	}
	public functionCallStatement(): FunctionCallStatementContext {
		return this.getTypedRuleContext(FunctionCallStatementContext, 0) as FunctionCallStatementContext;
	}
	public addressMethodStatement(): AddressMethodStatementContext {
		return this.getTypedRuleContext(AddressMethodStatementContext, 0) as AddressMethodStatementContext;
	}
	public selfdestructStatement(): SelfdestructStatementContext {
		return this.getTypedRuleContext(SelfdestructStatementContext, 0) as SelfdestructStatementContext;
	}
	public assemblyStatement(): AssemblyStatementContext {
		return this.getTypedRuleContext(AssemblyStatementContext, 0) as AssemblyStatementContext;
	}
	public tryCatchStatement(): TryCatchStatementContext {
		return this.getTypedRuleContext(TryCatchStatementContext, 0) as TryCatchStatementContext;
	}
	public revertStatement(): RevertStatementContext {
		return this.getTypedRuleContext(RevertStatementContext, 0) as RevertStatementContext;
	}
	public assertStatement(): AssertStatementContext {
		return this.getTypedRuleContext(AssertStatementContext, 0) as AssertStatementContext;
	}
	public deleteStatement(): DeleteStatementContext {
		return this.getTypedRuleContext(DeleteStatementContext, 0) as DeleteStatementContext;
	}
	public uncheckedStatement(): UncheckedStatementContext {
		return this.getTypedRuleContext(UncheckedStatementContext, 0) as UncheckedStatementContext;
	}
	public switchStatement(): SwitchStatementContext {
		return this.getTypedRuleContext(SwitchStatementContext, 0) as SwitchStatementContext;
	}
	public breakStatement(): BreakStatementContext {
		return this.getTypedRuleContext(BreakStatementContext, 0) as BreakStatementContext;
	}
	public continueStatement(): ContinueStatementContext {
		return this.getTypedRuleContext(ContinueStatementContext, 0) as ContinueStatementContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_statement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitStatement) {
			return visitor.visitStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TransferStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_transferStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitTransferStatement) {
			return visitor.visitTransferStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TokenContainerMethodStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_tokenContainerMethodStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitTokenContainerMethodStatement) {
			return visitor.visitTokenContainerMethodStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ReturnStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_returnStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitReturnStatement) {
			return visitor.visitReturnStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FunctionCallStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public namedArg_list(): NamedArgContext[] {
		return this.getTypedRuleContexts(NamedArgContext) as NamedArgContext[];
	}
	public namedArg(i: number): NamedArgContext {
		return this.getTypedRuleContext(NamedArgContext, i) as NamedArgContext;
	}
	public expressionList_list(): ExpressionListContext[] {
		return this.getTypedRuleContexts(ExpressionListContext) as ExpressionListContext[];
	}
	public expressionList(i: number): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, i) as ExpressionListContext;
	}
	public callOptions(): CallOptionsContext {
		return this.getTypedRuleContext(CallOptionsContext, 0) as CallOptionsContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_functionCallStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitFunctionCallStatement) {
			return visitor.visitFunctionCallStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class AddressMethodStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
	public callOptions(): CallOptionsContext {
		return this.getTypedRuleContext(CallOptionsContext, 0) as CallOptionsContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_addressMethodStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitAddressMethodStatement) {
			return visitor.visitAddressMethodStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SelfdestructStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_selfdestructStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitSelfdestructStatement) {
			return visitor.visitSelfdestructStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class EmitStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public namedArg_list(): NamedArgContext[] {
		return this.getTypedRuleContexts(NamedArgContext) as NamedArgContext[];
	}
	public namedArg(i: number): NamedArgContext {
		return this.getTypedRuleContext(NamedArgContext, i) as NamedArgContext;
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_emitStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitEmitStatement) {
			return visitor.visitEmitStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class AssignmentStatementContext extends ParserRuleContext {
	public _op!: Token;
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_assignmentStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitAssignmentStatement) {
			return visitor.visitAssignmentStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class MappingDeleteStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_mappingDeleteStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitMappingDeleteStatement) {
			return visitor.visitMappingDeleteStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class VariableDefinitionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
	}
	public modifier_list(): ModifierContext[] {
		return this.getTypedRuleContexts(ModifierContext) as ModifierContext[];
	}
	public modifier(i: number): ModifierContext {
		return this.getTypedRuleContext(ModifierContext, i) as ModifierContext;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public arrayType(): ArrayTypeContext {
		return this.getTypedRuleContext(ArrayTypeContext, 0) as ArrayTypeContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_variableDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitVariableDefinition) {
			return visitor.visitVariableDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TupleAssignmentContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName_list(): TypeNameContext[] {
		return this.getTypedRuleContexts(TypeNameContext) as TypeNameContext[];
	}
	public typeName(i: number): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, i) as TypeNameContext;
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
	public tupleSlot_list(): TupleSlotContext[] {
		return this.getTypedRuleContexts(TupleSlotContext) as TupleSlotContext[];
	}
	public tupleSlot(i: number): TupleSlotContext {
		return this.getTypedRuleContext(TupleSlotContext, i) as TupleSlotContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_tupleAssignment;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitTupleAssignment) {
			return visitor.visitTupleAssignment(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TupleSlotContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public modifier_list(): ModifierContext[] {
		return this.getTypedRuleContexts(ModifierContext) as ModifierContext[];
	}
	public modifier(i: number): ModifierContext {
		return this.getTypedRuleContext(ModifierContext, i) as ModifierContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_tupleSlot;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitTupleSlot) {
			return visitor.visitTupleSlot(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class AssignStatementContext extends ParserRuleContext {
	public _op!: Token;
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_assignStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitAssignStatement) {
			return visitor.visitAssignStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ArrayPushStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_arrayPushStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitArrayPushStatement) {
			return visitor.visitArrayPushStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ArrayPopStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_arrayPopStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitArrayPopStatement) {
			return visitor.visitArrayPopStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ArrayDeleteStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_arrayDeleteStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitArrayDeleteStatement) {
			return visitor.visitArrayDeleteStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StateArrayPushStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_stateArrayPushStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitStateArrayPushStatement) {
			return visitor.visitStateArrayPushStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StateArrayPopStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_stateArrayPopStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitStateArrayPopStatement) {
			return visitor.visitStateArrayPopStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class DeleteStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_deleteStatement;
	}
	public override copyFrom(ctx: DeleteStatementContext): void {
		super.copyFrom(ctx);
	}
}
export class DeleteStateContext extends DeleteStatementContext {
	constructor(parser: SolidCashParser, ctx: DeleteStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitDeleteState) {
			return visitor.visitDeleteState(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class DeleteIndexedContext extends DeleteStatementContext {
	constructor(parser: SolidCashParser, ctx: DeleteStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitDeleteIndexed) {
			return visitor.visitDeleteIndexed(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class DeleteMappingEntryContext extends DeleteStatementContext {
	constructor(parser: SolidCashParser, ctx: DeleteStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitDeleteMappingEntry) {
			return visitor.visitDeleteMappingEntry(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class DeleteLocalContext extends DeleteStatementContext {
	constructor(parser: SolidCashParser, ctx: DeleteStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitDeleteLocal) {
			return visitor.visitDeleteLocal(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TimeOpStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public TxVar(): TerminalNode {
		return this.getToken(SolidCashParser.TxVar, 0);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public requireMessage(): RequireMessageContext {
		return this.getTypedRuleContext(RequireMessageContext, 0) as RequireMessageContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_timeOpStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitTimeOpStatement) {
			return visitor.visitTimeOpStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class RequireStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public requireMessage(): RequireMessageContext {
		return this.getTypedRuleContext(RequireMessageContext, 0) as RequireMessageContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_requireStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitRequireStatement) {
			return visitor.visitRequireStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class IfStatementContext extends ParserRuleContext {
	public _ifBlock!: BlockContext;
	public _elseBlock!: BlockContext;
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public block_list(): BlockContext[] {
		return this.getTypedRuleContexts(BlockContext) as BlockContext[];
	}
	public block(i: number): BlockContext {
		return this.getTypedRuleContext(BlockContext, i) as BlockContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_ifStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitIfStatement) {
			return visitor.visitIfStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class LoopStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public doWhileStatement(): DoWhileStatementContext {
		return this.getTypedRuleContext(DoWhileStatementContext, 0) as DoWhileStatementContext;
	}
	public whileStatement(): WhileStatementContext {
		return this.getTypedRuleContext(WhileStatementContext, 0) as WhileStatementContext;
	}
	public forStatement(): ForStatementContext {
		return this.getTypedRuleContext(ForStatementContext, 0) as ForStatementContext;
	}
	public forOfEntriesStatement(): ForOfEntriesStatementContext {
		return this.getTypedRuleContext(ForOfEntriesStatementContext, 0) as ForOfEntriesStatementContext;
	}
	public forInStatement(): ForInStatementContext {
		return this.getTypedRuleContext(ForInStatementContext, 0) as ForInStatementContext;
	}
	public forOfStatement(): ForOfStatementContext {
		return this.getTypedRuleContext(ForOfStatementContext, 0) as ForOfStatementContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_loopStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitLoopStatement) {
			return visitor.visitLoopStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ForOfEntriesStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName_list(): TypeNameContext[] {
		return this.getTypedRuleContexts(TypeNameContext) as TypeNameContext[];
	}
	public typeName(i: number): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, i) as TypeNameContext;
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public block(): BlockContext {
		return this.getTypedRuleContext(BlockContext, 0) as BlockContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_forOfEntriesStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitForOfEntriesStatement) {
			return visitor.visitForOfEntriesStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ForInStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public block(): BlockContext {
		return this.getTypedRuleContext(BlockContext, 0) as BlockContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_forInStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitForInStatement) {
			return visitor.visitForInStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ForOfStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public block(): BlockContext {
		return this.getTypedRuleContext(BlockContext, 0) as BlockContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_forOfStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitForOfStatement) {
			return visitor.visitForOfStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ForStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public forInit(): ForInitContext {
		return this.getTypedRuleContext(ForInitContext, 0) as ForInitContext;
	}
	public forCondition(): ForConditionContext {
		return this.getTypedRuleContext(ForConditionContext, 0) as ForConditionContext;
	}
	public block(): BlockContext {
		return this.getTypedRuleContext(BlockContext, 0) as BlockContext;
	}
	public forUpdate(): ForUpdateContext {
		return this.getTypedRuleContext(ForUpdateContext, 0) as ForUpdateContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_forStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitForStatement) {
			return visitor.visitForStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ForInitContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public modifier_list(): ModifierContext[] {
		return this.getTypedRuleContexts(ModifierContext) as ModifierContext[];
	}
	public modifier(i: number): ModifierContext {
		return this.getTypedRuleContext(ModifierContext, i) as ModifierContext;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_forInit;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitForInit) {
			return visitor.visitForInit(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ForConditionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_forCondition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitForCondition) {
			return visitor.visitForCondition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ForUpdateContext extends ParserRuleContext {
	public _op!: Token;
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_forUpdate;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitForUpdate) {
			return visitor.visitForUpdate(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class DoWhileStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public block(): BlockContext {
		return this.getTypedRuleContext(BlockContext, 0) as BlockContext;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_doWhileStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitDoWhileStatement) {
			return visitor.visitDoWhileStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class WhileStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public block(): BlockContext {
		return this.getTypedRuleContext(BlockContext, 0) as BlockContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_whileStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitWhileStatement) {
			return visitor.visitWhileStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ConsoleStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public consoleParameterList(): ConsoleParameterListContext {
		return this.getTypedRuleContext(ConsoleParameterListContext, 0) as ConsoleParameterListContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_consoleStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitConsoleStatement) {
			return visitor.visitConsoleStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class AssemblyStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public assemblyToken_list(): AssemblyTokenContext[] {
		return this.getTypedRuleContexts(AssemblyTokenContext) as AssemblyTokenContext[];
	}
	public assemblyToken(i: number): AssemblyTokenContext {
		return this.getTypedRuleContext(AssemblyTokenContext, i) as AssemblyTokenContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_assemblyStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitAssemblyStatement) {
			return visitor.visitAssemblyStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class AssemblyTokenContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public HexLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.HexLiteral, 0);
	}
	public NumberLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.NumberLiteral, 0);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_assemblyToken;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitAssemblyToken) {
			return visitor.visitAssemblyToken(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class UncheckedStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public statement_list(): StatementContext[] {
		return this.getTypedRuleContexts(StatementContext) as StatementContext[];
	}
	public statement(i: number): StatementContext {
		return this.getTypedRuleContext(StatementContext, i) as StatementContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_uncheckedStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitUncheckedStatement) {
			return visitor.visitUncheckedStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SwitchStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public switchCase_list(): SwitchCaseContext[] {
		return this.getTypedRuleContexts(SwitchCaseContext) as SwitchCaseContext[];
	}
	public switchCase(i: number): SwitchCaseContext {
		return this.getTypedRuleContext(SwitchCaseContext, i) as SwitchCaseContext;
	}
	public switchDefault(): SwitchDefaultContext {
		return this.getTypedRuleContext(SwitchDefaultContext, 0) as SwitchDefaultContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_switchStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitSwitchStatement) {
			return visitor.visitSwitchStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SwitchCaseContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public statement_list(): StatementContext[] {
		return this.getTypedRuleContexts(StatementContext) as StatementContext[];
	}
	public statement(i: number): StatementContext {
		return this.getTypedRuleContext(StatementContext, i) as StatementContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_switchCase;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitSwitchCase) {
			return visitor.visitSwitchCase(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SwitchDefaultContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public statement_list(): StatementContext[] {
		return this.getTypedRuleContexts(StatementContext) as StatementContext[];
	}
	public statement(i: number): StatementContext {
		return this.getTypedRuleContext(StatementContext, i) as StatementContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_switchDefault;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitSwitchDefault) {
			return visitor.visitSwitchDefault(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TryCatchStatementContext extends ParserRuleContext {
	public _tryBlock!: BlockContext;
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public block(): BlockContext {
		return this.getTypedRuleContext(BlockContext, 0) as BlockContext;
	}
	public tryReturns(): TryReturnsContext {
		return this.getTypedRuleContext(TryReturnsContext, 0) as TryReturnsContext;
	}
	public catchClause_list(): CatchClauseContext[] {
		return this.getTypedRuleContexts(CatchClauseContext) as CatchClauseContext[];
	}
	public catchClause(i: number): CatchClauseContext {
		return this.getTypedRuleContext(CatchClauseContext, i) as CatchClauseContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_tryCatchStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitTryCatchStatement) {
			return visitor.visitTryCatchStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TryReturnsContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public parameter_list(): ParameterContext[] {
		return this.getTypedRuleContexts(ParameterContext) as ParameterContext[];
	}
	public parameter(i: number): ParameterContext {
		return this.getTypedRuleContext(ParameterContext, i) as ParameterContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_tryReturns;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitTryReturns) {
			return visitor.visitTryReturns(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class CatchClauseContext extends ParserRuleContext {
	public _catchBlock!: BlockContext;
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public block(): BlockContext {
		return this.getTypedRuleContext(BlockContext, 0) as BlockContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public parameter_list(): ParameterContext[] {
		return this.getTypedRuleContexts(ParameterContext) as ParameterContext[];
	}
	public parameter(i: number): ParameterContext {
		return this.getTypedRuleContext(ParameterContext, i) as ParameterContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_catchClause;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitCatchClause) {
			return visitor.visitCatchClause(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class BreakStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_breakStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitBreakStatement) {
			return visitor.visitBreakStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ContinueStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_continueStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitContinueStatement) {
			return visitor.visitContinueStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class RequireMessageContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public StringLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.StringLiteral, 0);
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_requireMessage;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitRequireMessage) {
			return visitor.visitRequireMessage(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class RevertStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public namedArg_list(): NamedArgContext[] {
		return this.getTypedRuleContexts(NamedArgContext) as NamedArgContext[];
	}
	public namedArg(i: number): NamedArgContext {
		return this.getTypedRuleContext(NamedArgContext, i) as NamedArgContext;
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
	public StringLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.StringLiteral, 0);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_revertStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitRevertStatement) {
			return visitor.visitRevertStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class AssertStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_assertStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitAssertStatement) {
			return visitor.visitAssertStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ConsoleParameterContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public literal(): LiteralContext {
		return this.getTypedRuleContext(LiteralContext, 0) as LiteralContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_consoleParameter;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitConsoleParameter) {
			return visitor.visitConsoleParameter(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ConsoleParameterListContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public consoleParameter_list(): ConsoleParameterContext[] {
		return this.getTypedRuleContexts(ConsoleParameterContext) as ConsoleParameterContext[];
	}
	public consoleParameter(i: number): ConsoleParameterContext {
		return this.getTypedRuleContext(ConsoleParameterContext, i) as ConsoleParameterContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_consoleParameterList;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitConsoleParameterList) {
			return visitor.visitConsoleParameterList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FunctionCallContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
	public namedArg_list(): NamedArgContext[] {
		return this.getTypedRuleContexts(NamedArgContext) as NamedArgContext[];
	}
	public namedArg(i: number): NamedArgContext {
		return this.getTypedRuleContext(NamedArgContext, i) as NamedArgContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_functionCall;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitFunctionCall) {
			return visitor.visitFunctionCall(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class NamedArgContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_namedArg;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitNamedArg) {
			return visitor.visitNamedArg(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExpressionListContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_expressionList;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitExpressionList) {
			return visitor.visitExpressionList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class CallOptionsContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public callOption_list(): CallOptionContext[] {
		return this.getTypedRuleContexts(CallOptionContext) as CallOptionContext[];
	}
	public callOption(i: number): CallOptionContext {
		return this.getTypedRuleContext(CallOptionContext, i) as CallOptionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_callOptions;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitCallOptions) {
			return visitor.visitCallOptions(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class CallOptionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_callOption;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitCallOption) {
			return visitor.visitCallOption(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TypeListContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName_list(): TypeNameContext[] {
		return this.getTypedRuleContexts(TypeNameContext) as TypeNameContext[];
	}
	public typeName(i: number): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, i) as TypeNameContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_typeList;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitTypeList) {
			return visitor.visitTypeList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExpressionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_expression;
	}
	public override copyFrom(ctx: ExpressionContext): void {
		super.copyFrom(ctx);
	}
}
export class CastContext extends ExpressionContext {
	public _castable!: ExpressionContext;
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public typeCast(): TypeCastContext {
		return this.getTypedRuleContext(TypeCastContext, 0) as TypeCastContext;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitCast) {
			return visitor.visitCast(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AbiEncodeContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitAbiEncode) {
			return visitor.visitAbiEncode(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class TypeIntrospectionContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitTypeIntrospection) {
			return visitor.visitTypeIntrospection(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class OutStateMappingFieldAccessContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public memberName(): MemberNameContext {
		return this.getTypedRuleContext(MemberNameContext, 0) as MemberNameContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitOutStateMappingFieldAccess) {
			return visitor.visitOutStateMappingFieldAccess(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class TupleExpressionContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitTupleExpression) {
			return visitor.visitTupleExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AbiDecodeAtContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public typeList(): TypeListContext {
		return this.getTypedRuleContext(TypeListContext, 0) as TypeListContext;
	}
	public NumberLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.NumberLiteral, 0);
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitAbiDecodeAt) {
			return visitor.visitAbiDecodeAt(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class MethodCallContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
	public callOptions(): CallOptionsContext {
		return this.getTypedRuleContext(CallOptionsContext, 0) as CallOptionsContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitMethodCall) {
			return visitor.visitMethodCall(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class FunctionCallExpressionContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public functionCall(): FunctionCallContext {
		return this.getTypedRuleContext(FunctionCallContext, 0) as FunctionCallContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitFunctionCallExpression) {
			return visitor.visitFunctionCallExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ArrayAccessContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitArrayAccess) {
			return visitor.visitArrayAccess(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class IdentifierContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitIdentifier) {
			return visitor.visitIdentifier(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AssignmentExpressionContext extends ExpressionContext {
	public _op!: Token;
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitAssignmentExpression) {
			return visitor.visitAssignmentExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AbiEncodeWithSignatureContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitAbiEncodeWithSignature) {
			return visitor.visitAbiEncodeWithSignature(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class MappingAccessContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitMappingAccess) {
			return visitor.visitMappingAccess(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class InstantiationContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
	public callOptions(): CallOptionsContext {
		return this.getTypedRuleContext(CallOptionsContext, 0) as CallOptionsContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitInstantiation) {
			return visitor.visitInstantiation(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AbiEncodeWithSelectorContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitAbiEncodeWithSelector) {
			return visitor.visitAbiEncodeWithSelector(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ThisExprContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitThisExpr) {
			return visitor.visitThisExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class NullaryOpContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public NullaryOp(): TerminalNode {
		return this.getToken(SolidCashParser.NullaryOp, 0);
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitNullaryOp) {
			return visitor.visitNullaryOp(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AbiDecodeContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public typeList(): TypeListContext {
		return this.getTypedRuleContext(TypeListContext, 0) as TypeListContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitAbiDecode) {
			return visitor.visitAbiDecode(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class BinaryOpContext extends ExpressionContext {
	public _left!: ExpressionContext;
	public _op!: Token;
	public _right!: ExpressionContext;
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitBinaryOp) {
			return visitor.visitBinaryOp(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class UnaryIntrospectionOpContext extends ExpressionContext {
	public _scope!: Token;
	public _op!: Token;
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitUnaryIntrospectionOp) {
			return visitor.visitUnaryIntrospectionOp(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class StringConcatContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitStringConcat) {
			return visitor.visitStringConcat(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class UnaryOpContext extends ExpressionContext {
	public _op!: Token;
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitUnaryOp) {
			return visitor.visitUnaryOp(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class LiteralExpressionContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public literal(): LiteralContext {
		return this.getTypedRuleContext(LiteralContext, 0) as LiteralContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitLiteralExpression) {
			return visitor.visitLiteralExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class BytesConcatContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitBytesConcat) {
			return visitor.visitBytesConcat(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class IndexRangeSliceContext extends ExpressionContext {
	public _element!: ExpressionContext;
	public _start!: ExpressionContext;
	public _end!: ExpressionContext;
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitIndexRangeSlice) {
			return visitor.visitIndexRangeSlice(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class TernaryOpContext extends ExpressionContext {
	public _condition!: ExpressionContext;
	public _ifTrue!: ExpressionContext;
	public _ifFalse!: ExpressionContext;
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitTernaryOp) {
			return visitor.visitTernaryOp(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ArrayContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitArray) {
			return visitor.visitArray(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class StateAccessContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitStateAccess) {
			return visitor.visitStateAccess(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class NewArrayContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitNewArray) {
			return visitor.visitNewArray(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class SliceContext extends ExpressionContext {
	public _element!: ExpressionContext;
	public _start!: ExpressionContext;
	public _end!: ExpressionContext;
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitSlice) {
			return visitor.visitSlice(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class TupleIndexOpContext extends ExpressionContext {
	public _index!: Token;
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public NumberLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.NumberLiteral, 0);
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitTupleIndexOp) {
			return visitor.visitTupleIndexOp(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class MethodCallNamedContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public callOptions(): CallOptionsContext {
		return this.getTypedRuleContext(CallOptionsContext, 0) as CallOptionsContext;
	}
	public namedArg_list(): NamedArgContext[] {
		return this.getTypedRuleContexts(NamedArgContext) as NamedArgContext[];
	}
	public namedArg(i: number): NamedArgContext {
		return this.getTypedRuleContext(NamedArgContext, i) as NamedArgContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitMethodCallNamed) {
			return visitor.visitMethodCallNamed(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class FieldAccessContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public memberName(): MemberNameContext {
		return this.getTypedRuleContext(MemberNameContext, 0) as MemberNameContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitFieldAccess) {
			return visitor.visitFieldAccess(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AbiEncodePackedContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitAbiEncodePacked) {
			return visitor.visitAbiEncodePacked(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AbiEncodeCallContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitAbiEncodeCall) {
			return visitor.visitAbiEncodeCall(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ParenthesisedContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitParenthesised) {
			return visitor.visitParenthesised(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class MemberNameContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_memberName;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitMemberName) {
			return visitor.visitMemberName(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ModifierContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_modifier;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitModifier) {
			return visitor.visitModifier(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class LiteralContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public BooleanLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.BooleanLiteral, 0);
	}
	public numberLiteral(): NumberLiteralContext {
		return this.getTypedRuleContext(NumberLiteralContext, 0) as NumberLiteralContext;
	}
	public decimalLiteral(): DecimalLiteralContext {
		return this.getTypedRuleContext(DecimalLiteralContext, 0) as DecimalLiteralContext;
	}
	public StringLiteral_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.StringLiteral);
	}
	public StringLiteral(i: number): TerminalNode {
		return this.getToken(SolidCashParser.StringLiteral, i);
	}
	public UnicodeLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.UnicodeLiteral, 0);
	}
	public HexStringLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.HexStringLiteral, 0);
	}
	public DateLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.DateLiteral, 0);
	}
	public HexLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.HexLiteral, 0);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_literal;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitLiteral) {
			return visitor.visitLiteral(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class NumberLiteralContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public NumberLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.NumberLiteral, 0);
	}
	public NumberUnit(): TerminalNode {
		return this.getToken(SolidCashParser.NumberUnit, 0);
	}
	public BchUnit(): TerminalNode {
		return this.getToken(SolidCashParser.BchUnit, 0);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_numberLiteral;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitNumberLiteral) {
			return visitor.visitNumberLiteral(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class DecimalLiteralContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public DecimalLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.DecimalLiteral, 0);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_decimalLiteral;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitDecimalLiteral) {
			return visitor.visitDecimalLiteral(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TypeNameContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public PrimitiveType(): TerminalNode {
		return this.getToken(SolidCashParser.PrimitiveType, 0);
	}
	public CryptoType(): TerminalNode {
		return this.getToken(SolidCashParser.CryptoType, 0);
	}
	public BoundedBytes(): TerminalNode {
		return this.getToken(SolidCashParser.BoundedBytes, 0);
	}
	public UnboundedBytes(): TerminalNode {
		return this.getToken(SolidCashParser.UnboundedBytes, 0);
	}
	public BoundedSignedInt(): TerminalNode {
		return this.getToken(SolidCashParser.BoundedSignedInt, 0);
	}
	public BoundedUnsignedInt(): TerminalNode {
		return this.getToken(SolidCashParser.BoundedUnsignedInt, 0);
	}
	public BoundedSignedFixed(): TerminalNode {
		return this.getToken(SolidCashParser.BoundedSignedFixed, 0);
	}
	public BoundedUnsignedFixed(): TerminalNode {
		return this.getToken(SolidCashParser.BoundedUnsignedFixed, 0);
	}
	public typeName_list(): TypeNameContext[] {
		return this.getTypedRuleContexts(TypeNameContext) as TypeNameContext[];
	}
	public typeName(i: number): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, i) as TypeNameContext;
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_typeName;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitTypeName) {
			return visitor.visitTypeName(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TypeCastContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public PrimitiveType(): TerminalNode {
		return this.getToken(SolidCashParser.PrimitiveType, 0);
	}
	public CryptoType(): TerminalNode {
		return this.getToken(SolidCashParser.CryptoType, 0);
	}
	public UnboundedBytes(): TerminalNode {
		return this.getToken(SolidCashParser.UnboundedBytes, 0);
	}
	public BoundedBytes(): TerminalNode {
		return this.getToken(SolidCashParser.BoundedBytes, 0);
	}
	public UnsafeCast(): TerminalNode {
		return this.getToken(SolidCashParser.UnsafeCast, 0);
	}
	public BoundedSignedInt(): TerminalNode {
		return this.getToken(SolidCashParser.BoundedSignedInt, 0);
	}
	public BoundedUnsignedInt(): TerminalNode {
		return this.getToken(SolidCashParser.BoundedUnsignedInt, 0);
	}
	public BoundedSignedFixed(): TerminalNode {
		return this.getToken(SolidCashParser.BoundedSignedFixed, 0);
	}
	public BoundedUnsignedFixed(): TerminalNode {
		return this.getToken(SolidCashParser.BoundedUnsignedFixed, 0);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_typeCast;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitTypeCast) {
			return visitor.visitTypeCast(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
