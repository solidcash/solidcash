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
			} while (_la===7 || _la===64 || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 74980871) !== 0));
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
			this.state = 635;
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
			case 3:
				{
				this.state = 634;
				this.mappingType();
				}
				break;
			}
			this.state = 637;
			this.anyIdentifier();
			this.state = 638;
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
			this.state = 640;
			this.match(SolidCashParser.T__53);
			this.state = 641;
			this.match(SolidCashParser.Identifier);
			this.state = 642;
			this.match(SolidCashParser.T__3);
			this.state = 643;
			this.enumMember();
			this.state = 648;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 58, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 644;
					this.match(SolidCashParser.T__4);
					this.state = 645;
					this.enumMember();
					}
					}
				}
				this.state = 650;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 58, this._ctx);
			}
			this.state = 652;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 651;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 654;
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
			this.state = 656;
			this.match(SolidCashParser.Identifier);
			this.state = 659;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 657;
				this.match(SolidCashParser.T__39);
				this.state = 658;
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
			this.state = 661;
			this.match(SolidCashParser.T__54);
			this.state = 662;
			this.match(SolidCashParser.Identifier);
			this.state = 663;
			this.match(SolidCashParser.T__41);
			this.state = 664;
			this.typeName();
			this.state = 665;
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
			this.state = 667;
			this.typeName();
			this.state = 668;
			this.match(SolidCashParser.T__55);
			this.state = 669;
			this.match(SolidCashParser.Identifier);
			this.state = 670;
			this.match(SolidCashParser.T__39);
			this.state = 671;
			this.expression(0);
			this.state = 672;
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
			this.state = 674;
			this.match(SolidCashParser.T__56);
			this.state = 675;
			this.parameterList();
			this.state = 679;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 98307) !== 0)) {
				{
				{
				this.state = 676;
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
				this.state = 681;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 685;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===176) {
				{
				{
				this.state = 682;
				this.parentInvocation();
				}
				}
				this.state = 687;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 688;
			this.match(SolidCashParser.T__3);
			this.state = 692;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
				{
				{
				this.state = 689;
				this.statement();
				}
				}
				this.state = 694;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 695;
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
			this.state = 697;
			this.match(SolidCashParser.T__59);
			this.state = 698;
			this.parameterList();
			this.state = 699;
			this.match(SolidCashParser.T__43);
			this.state = 703;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 8197) !== 0)) {
				{
				{
				this.state = 700;
				this.fallbackModifier();
				}
				}
				this.state = 705;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 709;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===176) {
				{
				{
				this.state = 706;
				this.customModifierInvocation();
				}
				}
				this.state = 711;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 712;
			this.match(SolidCashParser.T__3);
			this.state = 716;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
				{
				{
				this.state = 713;
				this.statement();
				}
				}
				this.state = 718;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 719;
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
			this.state = 724;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 59:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 721;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 722;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 723;
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
			this.state = 726;
			this.match(SolidCashParser.T__61);
			this.state = 727;
			this.match(SolidCashParser.T__48);
			this.state = 728;
			this.match(SolidCashParser.T__49);
			this.state = 729;
			this.match(SolidCashParser.T__43);
			this.state = 730;
			this.match(SolidCashParser.T__58);
			this.state = 731;
			this.match(SolidCashParser.T__3);
			this.state = 735;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
				{
				{
				this.state = 732;
				this.statement();
				}
				}
				this.state = 737;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 738;
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
			this.state = 740;
			this.match(SolidCashParser.Identifier);
			this.state = 741;
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
			this.state = 805;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 79, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 744;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 743;
					this.stateVariableVisibility();
					}
				}

				this.state = 746;
				this.typeName();
				this.state = 750;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 31) !== 0)) {
					{
					{
					this.state = 747;
					this.modifier();
					}
					}
					this.state = 752;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 753;
				this.match(SolidCashParser.Identifier);
				this.state = 756;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 754;
					this.match(SolidCashParser.T__39);
					this.state = 755;
					this.expression(0);
					}
				}

				this.state = 758;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 760;
				this.typeName();
				this.state = 761;
				this.stateVariableVisibility();
				this.state = 765;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 31) !== 0)) {
					{
					{
					this.state = 762;
					this.modifier();
					}
					}
					this.state = 767;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 768;
				this.match(SolidCashParser.Identifier);
				this.state = 771;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 769;
					this.match(SolidCashParser.T__39);
					this.state = 770;
					this.expression(0);
					}
				}

				this.state = 773;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 776;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 775;
					this.stateVariableVisibility();
					}
				}

				this.state = 778;
				this.mappingType();
				this.state = 782;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 31) !== 0)) {
					{
					{
					this.state = 779;
					this.collectionModifier();
					}
					}
					this.state = 784;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 785;
				this.match(SolidCashParser.Identifier);
				this.state = 786;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 789;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 788;
					this.stateVariableVisibility();
					}
				}

				this.state = 791;
				this.arrayType(0);
				this.state = 795;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 31) !== 0)) {
					{
					{
					this.state = 792;
					this.collectionModifier();
					}
					}
					this.state = 797;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 798;
				this.match(SolidCashParser.Identifier);
				this.state = 801;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 799;
					this.match(SolidCashParser.T__39);
					this.state = 800;
					this.expression(0);
					}
				}

				this.state = 803;
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
			this.state = 809;
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
				this.state = 807;
				this.modifier();
				}
				break;
			case 43:
			case 44:
			case 58:
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 808;
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
			this.state = 811;
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
			this.state = 849;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 86, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 813;
				this.match(SolidCashParser.T__63);
				this.state = 814;
				this.match(SolidCashParser.T__48);
				this.state = 815;
				this.typeName();
				this.state = 817;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 816;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 819;
				this.match(SolidCashParser.T__64);
				this.state = 820;
				this.typeName();
				this.state = 822;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 821;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 824;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 826;
				this.match(SolidCashParser.T__63);
				this.state = 827;
				this.match(SolidCashParser.T__48);
				this.state = 828;
				this.typeName();
				this.state = 830;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 829;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 832;
				this.match(SolidCashParser.T__64);
				this.state = 833;
				this.mappingType();
				this.state = 834;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 836;
				this.match(SolidCashParser.T__63);
				this.state = 837;
				this.match(SolidCashParser.T__48);
				this.state = 838;
				this.typeName();
				this.state = 840;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 839;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 842;
				this.match(SolidCashParser.T__64);
				this.state = 843;
				this.arrayType(0);
				this.state = 845;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 844;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 847;
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
			this.state = 861;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 87, this._ctx) ) {
			case 1:
				{
				this.state = 852;
				this.typeName();
				this.state = 853;
				this.match(SolidCashParser.T__65);
				this.state = 854;
				_la = this._input.LA(1);
				if(!(_la===158 || _la===176)) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 855;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 2:
				{
				this.state = 857;
				this.typeName();
				this.state = 858;
				this.match(SolidCashParser.T__65);
				this.state = 859;
				this.match(SolidCashParser.T__66);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 872;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 89, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 870;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 88, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 863;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 864;
						this.match(SolidCashParser.T__65);
						this.state = 865;
						_la = this._input.LA(1);
						if(!(_la===158 || _la===176)) {
						this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 866;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 867;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 868;
						this.match(SolidCashParser.T__65);
						this.state = 869;
						this.match(SolidCashParser.T__66);
						}
						break;
					}
					}
				}
				this.state = 874;
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
			this.state = 875;
			this.match(SolidCashParser.T__67);
			this.state = 876;
			this.match(SolidCashParser.Identifier);
			this.state = 878;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 877;
				this.parameterList();
				}
			}

			this.state = 880;
			this.match(SolidCashParser.T__3);
			this.state = 884;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
				{
				{
				this.state = 881;
				this.modifierStatement();
				}
				}
				this.state = 886;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 887;
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
			this.state = 891;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 69:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 889;
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
				this.state = 890;
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
			this.state = 893;
			this.match(SolidCashParser.T__68);
			this.state = 894;
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
			this.state = 896;
			this.match(SolidCashParser.T__6);
			this.state = 897;
			this.anyIdentifier();
			this.state = 898;
			this.parameterList();
			this.state = 902;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 899;
				this.functionModifier();
				}
				}
				this.state = 904;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 908;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===176) {
				{
				{
				this.state = 905;
				this.customModifierInvocation();
				}
				}
				this.state = 910;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 912;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 911;
				this.returnType();
				}
			}

			this.state = 914;
			this.match(SolidCashParser.T__3);
			this.state = 918;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
				{
				{
				this.state = 915;
				this.statement();
				}
				}
				this.state = 920;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 921;
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
			this.state = 923;
			this.match(SolidCashParser.Identifier);
			this.state = 925;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 924;
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
			this.state = 941;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 70:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 927;
				this.match(SolidCashParser.T__69);
				}
				break;
			case 71:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 928;
				this.match(SolidCashParser.T__70);
				}
				break;
			case 58:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 929;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 44:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 930;
				this.match(SolidCashParser.T__43);
				}
				break;
			case 43:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 931;
				this.match(SolidCashParser.T__42);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 932;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 59:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 933;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 934;
				this.overrideSpecifier();
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 935;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 936;
				this.unsafeModifier();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 937;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 938;
				this.match(SolidCashParser.T__27);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 939;
				this.match(SolidCashParser.T__30);
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 940;
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
			this.state = 943;
			this.match(SolidCashParser.T__71);
			this.state = 954;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 944;
				this.match(SolidCashParser.T__48);
				this.state = 945;
				this.match(SolidCashParser.Identifier);
				this.state = 950;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 946;
					this.match(SolidCashParser.T__4);
					this.state = 947;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 952;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 953;
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
			this.state = 956;
			this.match(SolidCashParser.T__31);
			this.state = 960;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 957;
				this.match(SolidCashParser.T__48);
				this.state = 958;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 959;
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
			this.state = 962;
			this.match(SolidCashParser.T__72);
			this.state = 963;
			this.match(SolidCashParser.T__48);
			this.state = 964;
			this.returnParam();
			this.state = 969;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 102, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 965;
					this.match(SolidCashParser.T__4);
					this.state = 966;
					this.returnParam();
					}
					}
				}
				this.state = 971;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 102, this._ctx);
			}
			this.state = 973;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 972;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 975;
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
			this.state = 997;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 108, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 977;
				this.typeName();
				this.state = 981;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 104, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 978;
						this.modifier();
						}
						}
					}
					this.state = 983;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 104, this._ctx);
				}
				this.state = 985;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 156)) & ~0x1F) === 0 && ((1 << (_la - 156)) & 1048593) !== 0)) {
					{
					this.state = 984;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 987;
				this.arrayType(0);
				this.state = 991;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 106, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 988;
						this.modifier();
						}
						}
					}
					this.state = 993;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 106, this._ctx);
				}
				this.state = 995;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 156)) & ~0x1F) === 0 && ((1 << (_la - 156)) & 1048593) !== 0)) {
					{
					this.state = 994;
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
			this.state = 999;
			this.match(SolidCashParser.T__48);
			this.state = 1011;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 74980871) !== 0)) {
				{
				this.state = 1000;
				this.parameter();
				this.state = 1005;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 109, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1001;
						this.match(SolidCashParser.T__4);
						this.state = 1002;
						this.parameter();
						}
						}
					}
					this.state = 1007;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 109, this._ctx);
				}
				this.state = 1009;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1008;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1013;
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
			this.state = 1045;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 118, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1015;
				this.typeName();
				this.state = 1019;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 112, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1016;
						this.modifier();
						}
						}
					}
					this.state = 1021;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 112, this._ctx);
				}
				this.state = 1023;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 156)) & ~0x1F) === 0 && ((1 << (_la - 156)) & 1048593) !== 0)) {
					{
					this.state = 1022;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1025;
				this.arrayType(0);
				this.state = 1029;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 114, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1026;
						this.modifier();
						}
						}
					}
					this.state = 1031;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 114, this._ctx);
				}
				this.state = 1033;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 156)) & ~0x1F) === 0 && ((1 << (_la - 156)) & 1048593) !== 0)) {
					{
					this.state = 1032;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1035;
				this.mappingType();
				this.state = 1039;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 116, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1036;
						this.modifier();
						}
						}
					}
					this.state = 1041;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 116, this._ctx);
				}
				this.state = 1043;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 156)) & ~0x1F) === 0 && ((1 << (_la - 156)) & 1048593) !== 0)) {
					{
					this.state = 1042;
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
			this.state = 1056;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1047;
				this.match(SolidCashParser.T__3);
				this.state = 1051;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
					{
					{
					this.state = 1048;
					this.statement();
					}
					}
					this.state = 1053;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1054;
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
				this.state = 1055;
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
			this.state = 1089;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 121, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1058;
				this.variableDefinition();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1059;
				this.tupleAssignment();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1060;
				this.arrayPushStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1061;
				this.arrayPopStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1062;
				this.arrayDeleteStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1063;
				this.stateArrayPushStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1064;
				this.stateArrayPopStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1065;
				this.assignStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1066;
				this.assignmentStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1067;
				this.mappingDeleteStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1068;
				this.timeOpStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1069;
				this.requireStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1070;
				this.ifStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1071;
				this.loopStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1072;
				this.consoleStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1073;
				this.emitStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1074;
				this.transferStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1075;
				this.tokenContainerMethodStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1076;
				this.returnStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1077;
				this.functionCallStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1078;
				this.addressMethodStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1079;
				this.selfdestructStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1080;
				this.assemblyStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1081;
				this.tryCatchStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1082;
				this.revertStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1083;
				this.assertStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1084;
				this.deleteStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1085;
				this.uncheckedStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1086;
				this.switchStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1087;
				this.breakStatement();
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 31);
				{
				this.state = 1088;
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
			this.state = 1091;
			this.match(SolidCashParser.T__73);
			this.state = 1092;
			this.match(SolidCashParser.T__11);
			this.state = 1093;
			this.match(SolidCashParser.Identifier);
			this.state = 1094;
			this.match(SolidCashParser.T__48);
			this.state = 1095;
			this.expression(0);
			this.state = 1096;
			this.match(SolidCashParser.T__4);
			this.state = 1097;
			this.expression(0);
			this.state = 1098;
			this.match(SolidCashParser.T__49);
			this.state = 1099;
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
			this.state = 1101;
			this.match(SolidCashParser.T__73);
			this.state = 1102;
			this.match(SolidCashParser.T__11);
			this.state = 1103;
			this.match(SolidCashParser.Identifier);
			this.state = 1104;
			this.match(SolidCashParser.T__65);
			this.state = 1105;
			this.expression(0);
			this.state = 1106;
			this.match(SolidCashParser.T__66);
			this.state = 1107;
			this.match(SolidCashParser.T__11);
			this.state = 1108;
			this.match(SolidCashParser.Identifier);
			this.state = 1109;
			this.match(SolidCashParser.T__48);
			this.state = 1110;
			this.expression(0);
			this.state = 1115;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1111;
				this.match(SolidCashParser.T__4);
				this.state = 1112;
				this.expression(0);
				}
				}
				this.state = 1117;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1118;
			this.match(SolidCashParser.T__49);
			this.state = 1119;
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
			this.state = 1150;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 126, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1121;
				this.match(SolidCashParser.T__74);
				this.state = 1122;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1123;
				this.match(SolidCashParser.T__74);
				this.state = 1124;
				this.expression(0);
				this.state = 1129;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1125;
					this.match(SolidCashParser.T__4);
					this.state = 1126;
					this.expression(0);
					}
					}
					this.state = 1131;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1132;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1134;
				this.match(SolidCashParser.T__74);
				this.state = 1135;
				this.match(SolidCashParser.T__48);
				this.state = 1136;
				this.expression(0);
				this.state = 1141;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 124, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1137;
						this.match(SolidCashParser.T__4);
						this.state = 1138;
						this.expression(0);
						}
						}
					}
					this.state = 1143;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 124, this._ctx);
				}
				this.state = 1145;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1144;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1147;
				this.match(SolidCashParser.T__49);
				this.state = 1148;
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
			this.state = 1197;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 132, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1152;
				this.match(SolidCashParser.Identifier);
				this.state = 1155;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1153;
					this.match(SolidCashParser.T__11);
					this.state = 1154;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1157;
				this.match(SolidCashParser.T__48);
				this.state = 1158;
				this.match(SolidCashParser.T__3);
				this.state = 1170;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 1159;
					this.namedArg();
					this.state = 1164;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 128, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1160;
							this.match(SolidCashParser.T__4);
							this.state = 1161;
							this.namedArg();
							}
							}
						}
						this.state = 1166;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 128, this._ctx);
					}
					this.state = 1168;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1167;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1172;
				this.match(SolidCashParser.T__5);
				this.state = 1173;
				this.match(SolidCashParser.T__49);
				this.state = 1174;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1175;
				this.match(SolidCashParser.Identifier);
				this.state = 1176;
				this.expressionList();
				this.state = 1177;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1179;
				this.match(SolidCashParser.Identifier);
				this.state = 1180;
				this.match(SolidCashParser.T__11);
				this.state = 1181;
				this.match(SolidCashParser.Identifier);
				this.state = 1182;
				this.expressionList();
				this.state = 1183;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1185;
				this.match(SolidCashParser.Identifier);
				this.state = 1186;
				this.expressionList();
				this.state = 1187;
				this.match(SolidCashParser.T__11);
				this.state = 1188;
				this.match(SolidCashParser.Identifier);
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
			this.state = 1199;
			this.expression(0);
			this.state = 1200;
			this.match(SolidCashParser.T__11);
			this.state = 1201;
			this.match(SolidCashParser.Identifier);
			this.state = 1203;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===4) {
				{
				this.state = 1202;
				this.callOptions();
				}
			}

			this.state = 1205;
			this.expressionList();
			this.state = 1206;
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
			this.state = 1208;
			this.match(SolidCashParser.T__30);
			this.state = 1209;
			this.match(SolidCashParser.T__48);
			this.state = 1210;
			this.expression(0);
			this.state = 1211;
			this.match(SolidCashParser.T__49);
			this.state = 1212;
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
			this.state = 1247;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 139, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1214;
				this.match(SolidCashParser.T__75);
				this.state = 1215;
				this.match(SolidCashParser.Identifier);
				this.state = 1218;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1216;
					this.match(SolidCashParser.T__11);
					this.state = 1217;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1220;
				this.match(SolidCashParser.T__48);
				this.state = 1221;
				this.match(SolidCashParser.T__3);
				this.state = 1233;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 1222;
					this.namedArg();
					this.state = 1227;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 135, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1223;
							this.match(SolidCashParser.T__4);
							this.state = 1224;
							this.namedArg();
							}
							}
						}
						this.state = 1229;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 135, this._ctx);
					}
					this.state = 1231;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1230;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1235;
				this.match(SolidCashParser.T__5);
				this.state = 1236;
				this.match(SolidCashParser.T__49);
				this.state = 1237;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1238;
				this.match(SolidCashParser.T__75);
				this.state = 1239;
				this.match(SolidCashParser.Identifier);
				this.state = 1242;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1240;
					this.match(SolidCashParser.T__11);
					this.state = 1241;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1244;
				this.expressionList();
				this.state = 1245;
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
			this.state = 1373;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 154, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1249;
				this.match(SolidCashParser.T__73);
				this.state = 1250;
				this.match(SolidCashParser.T__11);
				this.state = 1251;
				this.match(SolidCashParser.Identifier);
				this.state = 1260;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===66) {
					{
					this.state = 1256;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1252;
						this.match(SolidCashParser.T__65);
						this.state = 1253;
						this.expression(0);
						this.state = 1254;
						this.match(SolidCashParser.T__66);
						}
						}
						this.state = 1258;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===66);
					}
				}

				this.state = 1266;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12) {
					{
					{
					this.state = 1262;
					this.match(SolidCashParser.T__11);
					this.state = 1263;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1268;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1269;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1270;
				this.expression(0);
				this.state = 1271;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1273;
				this.match(SolidCashParser.Identifier);
				this.state = 1278;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1274;
					this.match(SolidCashParser.T__65);
					this.state = 1275;
					this.expression(0);
					this.state = 1276;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1280;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1286;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12) {
					{
					{
					this.state = 1282;
					this.match(SolidCashParser.T__11);
					this.state = 1283;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1288;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
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
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1293;
				this.match(SolidCashParser.Identifier);
				this.state = 1296;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1294;
					this.match(SolidCashParser.T__11);
					this.state = 1295;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1298;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1300;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1301;
				this.expression(0);
				this.state = 1302;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1304;
				this.match(SolidCashParser.Identifier);
				this.state = 1307;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1305;
					this.match(SolidCashParser.T__11);
					this.state = 1306;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1309;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1315;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1311;
					this.match(SolidCashParser.T__65);
					this.state = 1312;
					this.expression(0);
					this.state = 1313;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1317;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1319;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1320;
				this.expression(0);
				this.state = 1321;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1323;
				this.match(SolidCashParser.T__73);
				this.state = 1324;
				this.match(SolidCashParser.T__11);
				this.state = 1325;
				this.match(SolidCashParser.Identifier);
				this.state = 1334;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===66) {
					{
					this.state = 1330;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1326;
						this.match(SolidCashParser.T__65);
						this.state = 1327;
						this.expression(0);
						this.state = 1328;
						this.match(SolidCashParser.T__66);
						}
						}
						this.state = 1332;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===66);
					}
				}

				this.state = 1340;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12) {
					{
					{
					this.state = 1336;
					this.match(SolidCashParser.T__11);
					this.state = 1337;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1342;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1343;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1344;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1345;
				this.match(SolidCashParser.Identifier);
				this.state = 1350;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1346;
					this.match(SolidCashParser.T__65);
					this.state = 1347;
					this.expression(0);
					this.state = 1348;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1352;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1358;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12) {
					{
					{
					this.state = 1354;
					this.match(SolidCashParser.T__11);
					this.state = 1355;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1360;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1361;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1362;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1364;
				this.match(SolidCashParser.Identifier);
				this.state = 1367;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1365;
					this.match(SolidCashParser.T__11);
					this.state = 1366;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1369;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1371;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1372;
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
			this.state = 1375;
			this.match(SolidCashParser.T__73);
			this.state = 1376;
			this.match(SolidCashParser.T__11);
			this.state = 1377;
			this.match(SolidCashParser.Identifier);
			this.state = 1384;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===66) {
				{
				{
				this.state = 1378;
				this.match(SolidCashParser.T__65);
				this.state = 1379;
				this.expression(0);
				this.state = 1380;
				this.match(SolidCashParser.T__66);
				}
				}
				this.state = 1386;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1387;
			this.match(SolidCashParser.T__88);
			this.state = 1388;
			this.match(SolidCashParser.T__48);
			this.state = 1389;
			this.expression(0);
			this.state = 1390;
			this.match(SolidCashParser.T__49);
			this.state = 1391;
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
			this.state = 1421;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 160, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1393;
				this.typeName();
				this.state = 1397;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 156, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1394;
						this.modifier();
						}
						}
					}
					this.state = 1399;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 156, this._ctx);
				}
				this.state = 1400;
				this.anyIdentifier();
				this.state = 1403;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1401;
					this.match(SolidCashParser.T__39);
					this.state = 1402;
					this.expression(0);
					}
				}

				this.state = 1405;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1407;
				this.arrayType(0);
				this.state = 1411;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 158, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1408;
						this.modifier();
						}
						}
					}
					this.state = 1413;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 158, this._ctx);
				}
				this.state = 1414;
				this.anyIdentifier();
				this.state = 1417;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1415;
					this.match(SolidCashParser.T__39);
					this.state = 1416;
					this.expression(0);
					}
				}

				this.state = 1419;
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
			this.state = 1471;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 165, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1423;
				this.typeName();
				this.state = 1424;
				this.match(SolidCashParser.Identifier);
				this.state = 1429;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1425;
					this.match(SolidCashParser.T__4);
					this.state = 1426;
					this.typeName();
					this.state = 1427;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1431;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1433;
				this.match(SolidCashParser.T__39);
				this.state = 1434;
				this.expression(0);
				this.state = 1435;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1437;
				this.match(SolidCashParser.T__48);
				this.state = 1438;
				this.tupleSlot();
				this.state = 1441;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1439;
					this.match(SolidCashParser.T__4);
					this.state = 1440;
					this.tupleSlot();
					}
					}
					this.state = 1443;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1445;
				this.match(SolidCashParser.T__49);
				this.state = 1446;
				this.match(SolidCashParser.T__39);
				this.state = 1447;
				this.match(SolidCashParser.T__48);
				this.state = 1448;
				this.expression(0);
				this.state = 1451;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1449;
					this.match(SolidCashParser.T__4);
					this.state = 1450;
					this.expression(0);
					}
					}
					this.state = 1453;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1455;
				this.match(SolidCashParser.T__49);
				this.state = 1456;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1458;
				this.match(SolidCashParser.T__48);
				this.state = 1459;
				this.tupleSlot();
				this.state = 1462;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1460;
					this.match(SolidCashParser.T__4);
					this.state = 1461;
					this.tupleSlot();
					}
					}
					this.state = 1464;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1466;
				this.match(SolidCashParser.T__49);
				this.state = 1467;
				this.match(SolidCashParser.T__39);
				this.state = 1468;
				this.expression(0);
				this.state = 1469;
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
			this.state = 1484;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 167, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1473;
				this.typeName();
				this.state = 1477;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 31) !== 0)) {
					{
					{
					this.state = 1474;
					this.modifier();
					}
					}
					this.state = 1479;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1480;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1482;
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
			this.state = 1497;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 168, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1486;
				this.match(SolidCashParser.Identifier);
				this.state = 1487;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1488;
				this.expression(0);
				this.state = 1489;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1491;
				this.match(SolidCashParser.Identifier);
				this.state = 1492;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1493;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1494;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1495;
				this.match(SolidCashParser.Identifier);
				this.state = 1496;
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
			this.state = 1499;
			this.match(SolidCashParser.Identifier);
			this.state = 1500;
			this.match(SolidCashParser.T__89);
			this.state = 1501;
			this.match(SolidCashParser.T__48);
			this.state = 1502;
			this.expression(0);
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
	public arrayPopStatement(): ArrayPopStatementContext {
		let localctx: ArrayPopStatementContext = new ArrayPopStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 140, SolidCashParser.RULE_arrayPopStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1506;
			this.match(SolidCashParser.Identifier);
			this.state = 1507;
			this.match(SolidCashParser.T__90);
			this.state = 1508;
			this.match(SolidCashParser.T__48);
			this.state = 1509;
			this.match(SolidCashParser.T__49);
			this.state = 1510;
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
			this.state = 1512;
			this.match(SolidCashParser.Identifier);
			this.state = 1513;
			this.match(SolidCashParser.T__88);
			this.state = 1514;
			this.match(SolidCashParser.T__48);
			this.state = 1515;
			this.expression(0);
			this.state = 1516;
			this.match(SolidCashParser.T__49);
			this.state = 1517;
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
			this.state = 1519;
			this.match(SolidCashParser.T__73);
			this.state = 1520;
			this.match(SolidCashParser.T__11);
			this.state = 1521;
			this.match(SolidCashParser.Identifier);
			this.state = 1522;
			this.match(SolidCashParser.T__89);
			this.state = 1523;
			this.match(SolidCashParser.T__48);
			this.state = 1524;
			this.expression(0);
			this.state = 1525;
			this.match(SolidCashParser.T__49);
			this.state = 1526;
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
			this.state = 1528;
			this.match(SolidCashParser.T__73);
			this.state = 1529;
			this.match(SolidCashParser.T__11);
			this.state = 1530;
			this.match(SolidCashParser.Identifier);
			this.state = 1531;
			this.match(SolidCashParser.T__90);
			this.state = 1532;
			this.match(SolidCashParser.T__48);
			this.state = 1533;
			this.match(SolidCashParser.T__49);
			this.state = 1534;
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
			this.state = 1570;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 171, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1536;
				this.match(SolidCashParser.T__91);
				this.state = 1537;
				this.match(SolidCashParser.Identifier);
				this.state = 1538;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1539;
				this.match(SolidCashParser.T__91);
				this.state = 1540;
				this.match(SolidCashParser.T__73);
				this.state = 1541;
				this.match(SolidCashParser.T__11);
				this.state = 1542;
				this.match(SolidCashParser.Identifier);
				this.state = 1543;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1544;
				this.match(SolidCashParser.T__91);
				this.state = 1545;
				this.match(SolidCashParser.T__73);
				this.state = 1546;
				this.match(SolidCashParser.T__11);
				this.state = 1547;
				this.match(SolidCashParser.Identifier);
				this.state = 1552;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1548;
					this.match(SolidCashParser.T__65);
					this.state = 1549;
					this.expression(0);
					this.state = 1550;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1554;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1556;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1558;
				this.match(SolidCashParser.T__91);
				this.state = 1559;
				this.match(SolidCashParser.Identifier);
				this.state = 1564;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1560;
					this.match(SolidCashParser.T__65);
					this.state = 1561;
					this.expression(0);
					this.state = 1562;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1566;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1568;
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
			this.state = 1572;
			this.match(SolidCashParser.T__92);
			this.state = 1573;
			this.match(SolidCashParser.T__48);
			this.state = 1574;
			this.match(SolidCashParser.TxVar);
			this.state = 1575;
			this.match(SolidCashParser.T__22);
			this.state = 1576;
			this.expression(0);
			this.state = 1579;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1577;
				this.match(SolidCashParser.T__4);
				this.state = 1578;
				this.requireMessage();
				}
			}

			this.state = 1581;
			this.match(SolidCashParser.T__49);
			this.state = 1582;
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
			this.state = 1584;
			this.match(SolidCashParser.T__92);
			this.state = 1585;
			this.match(SolidCashParser.T__48);
			this.state = 1586;
			this.expression(0);
			this.state = 1589;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1587;
				this.match(SolidCashParser.T__4);
				this.state = 1588;
				this.requireMessage();
				}
			}

			this.state = 1591;
			this.match(SolidCashParser.T__49);
			this.state = 1592;
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
			this.state = 1594;
			this.match(SolidCashParser.T__93);
			this.state = 1595;
			this.match(SolidCashParser.T__48);
			this.state = 1596;
			this.expression(0);
			this.state = 1597;
			this.match(SolidCashParser.T__49);
			this.state = 1598;
			localctx._ifBlock = this.block();
			this.state = 1601;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 174, this._ctx) ) {
			case 1:
				{
				this.state = 1599;
				this.match(SolidCashParser.T__94);
				this.state = 1600;
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
			this.state = 1609;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 175, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1603;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1604;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1605;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1606;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1607;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1608;
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
			this.state = 1611;
			this.match(SolidCashParser.T__8);
			this.state = 1612;
			this.match(SolidCashParser.T__48);
			this.state = 1613;
			this.typeName();
			this.state = 1614;
			this.match(SolidCashParser.Identifier);
			this.state = 1615;
			this.match(SolidCashParser.T__4);
			this.state = 1616;
			this.typeName();
			this.state = 1617;
			this.match(SolidCashParser.Identifier);
			this.state = 1618;
			this.match(SolidCashParser.T__95);
			this.state = 1619;
			this.match(SolidCashParser.T__73);
			this.state = 1620;
			this.match(SolidCashParser.T__11);
			this.state = 1621;
			this.match(SolidCashParser.Identifier);
			this.state = 1622;
			this.match(SolidCashParser.T__11);
			this.state = 1623;
			this.match(SolidCashParser.T__33);
			this.state = 1624;
			this.match(SolidCashParser.T__49);
			this.state = 1625;
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
			this.state = 1627;
			this.match(SolidCashParser.T__8);
			this.state = 1628;
			this.match(SolidCashParser.T__48);
			this.state = 1629;
			this.typeName();
			this.state = 1630;
			this.match(SolidCashParser.Identifier);
			this.state = 1631;
			this.match(SolidCashParser.T__96);
			this.state = 1632;
			this.match(SolidCashParser.T__73);
			this.state = 1633;
			this.match(SolidCashParser.T__11);
			this.state = 1634;
			this.match(SolidCashParser.Identifier);
			this.state = 1635;
			this.match(SolidCashParser.T__49);
			this.state = 1636;
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
			this.state = 1638;
			this.match(SolidCashParser.T__8);
			this.state = 1639;
			this.match(SolidCashParser.T__48);
			this.state = 1640;
			this.typeName();
			this.state = 1641;
			this.match(SolidCashParser.Identifier);
			this.state = 1642;
			this.match(SolidCashParser.T__95);
			this.state = 1643;
			this.match(SolidCashParser.T__73);
			this.state = 1644;
			this.match(SolidCashParser.T__11);
			this.state = 1645;
			this.match(SolidCashParser.Identifier);
			this.state = 1646;
			this.match(SolidCashParser.T__49);
			this.state = 1647;
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
			this.state = 1649;
			this.match(SolidCashParser.T__8);
			this.state = 1650;
			this.match(SolidCashParser.T__48);
			this.state = 1651;
			this.forInit();
			this.state = 1652;
			this.forCondition();
			this.state = 1654;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===176) {
				{
				this.state = 1653;
				this.forUpdate();
				}
			}

			this.state = 1656;
			this.match(SolidCashParser.T__49);
			this.state = 1657;
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
			this.state = 1659;
			this.typeName();
			this.state = 1663;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===33 || _la===56 || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 31) !== 0)) {
				{
				{
				this.state = 1660;
				this.modifier();
				}
				}
				this.state = 1665;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1666;
			this.match(SolidCashParser.Identifier);
			this.state = 1669;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 1667;
				this.match(SolidCashParser.T__39);
				this.state = 1668;
				this.expression(0);
				}
			}

			this.state = 1671;
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
			this.state = 1673;
			this.expression(0);
			this.state = 1674;
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
			this.state = 1681;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 179, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1676;
				this.match(SolidCashParser.Identifier);
				this.state = 1677;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1678;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1679;
				this.match(SolidCashParser.Identifier);
				this.state = 1680;
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
			this.state = 1683;
			this.match(SolidCashParser.T__97);
			this.state = 1684;
			this.block();
			this.state = 1685;
			this.match(SolidCashParser.T__98);
			this.state = 1686;
			this.match(SolidCashParser.T__48);
			this.state = 1687;
			this.expression(0);
			this.state = 1688;
			this.match(SolidCashParser.T__49);
			this.state = 1689;
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
			this.state = 1691;
			this.match(SolidCashParser.T__98);
			this.state = 1692;
			this.match(SolidCashParser.T__48);
			this.state = 1693;
			this.expression(0);
			this.state = 1694;
			this.match(SolidCashParser.T__49);
			this.state = 1695;
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
			this.state = 1697;
			this.match(SolidCashParser.T__99);
			this.state = 1698;
			this.consoleParameterList();
			this.state = 1699;
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
			this.state = 1701;
			this.match(SolidCashParser.T__100);
			this.state = 1702;
			this.match(SolidCashParser.T__3);
			this.state = 1706;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 158)) & ~0x1F) === 0 && ((1 << (_la - 158)) & 262401) !== 0)) {
				{
				{
				this.state = 1703;
				this.assemblyToken();
				}
				}
				this.state = 1708;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1709;
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
			this.state = 1711;
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
			this.state = 1713;
			this.match(SolidCashParser.T__101);
			this.state = 1714;
			this.match(SolidCashParser.T__3);
			this.state = 1718;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
				{
				{
				this.state = 1715;
				this.statement();
				}
				}
				this.state = 1720;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1721;
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
			this.state = 1723;
			this.match(SolidCashParser.T__102);
			this.state = 1724;
			this.match(SolidCashParser.T__48);
			this.state = 1725;
			this.expression(0);
			this.state = 1726;
			this.match(SolidCashParser.T__49);
			this.state = 1727;
			this.match(SolidCashParser.T__3);
			this.state = 1731;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===104) {
				{
				{
				this.state = 1728;
				this.switchCase();
				}
				}
				this.state = 1733;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1735;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===106) {
				{
				this.state = 1734;
				this.switchDefault();
				}
			}

			this.state = 1737;
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
			this.state = 1739;
			this.match(SolidCashParser.T__103);
			this.state = 1740;
			this.expression(0);
			this.state = 1741;
			this.match(SolidCashParser.T__104);
			this.state = 1745;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
				{
				{
				this.state = 1742;
				this.statement();
				}
				}
				this.state = 1747;
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
			this.state = 1748;
			this.match(SolidCashParser.T__105);
			this.state = 1749;
			this.match(SolidCashParser.T__104);
			this.state = 1753;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4291950819) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2147746319) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 67039211) !== 0)) {
				{
				{
				this.state = 1750;
				this.statement();
				}
				}
				this.state = 1755;
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
			this.state = 1756;
			this.match(SolidCashParser.T__106);
			this.state = 1757;
			this.expression(0);
			this.state = 1759;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 1758;
				this.tryReturns();
				}
			}

			this.state = 1761;
			localctx._tryBlock = this.block();
			this.state = 1763;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1762;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1765;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 187, this._ctx);
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
			this.state = 1767;
			this.match(SolidCashParser.T__72);
			this.state = 1768;
			this.match(SolidCashParser.T__48);
			this.state = 1780;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 74980871) !== 0)) {
				{
				this.state = 1769;
				this.parameter();
				this.state = 1774;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 188, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1770;
						this.match(SolidCashParser.T__4);
						this.state = 1771;
						this.parameter();
						}
						}
					}
					this.state = 1776;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 188, this._ctx);
				}
				this.state = 1778;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1777;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1782;
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
			this.state = 1784;
			this.match(SolidCashParser.T__107);
			this.state = 1786;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 191, this._ctx) ) {
			case 1:
				{
				this.state = 1785;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 1803;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 195, this._ctx) ) {
			case 1:
				{
				this.state = 1788;
				this.match(SolidCashParser.T__48);
				this.state = 1800;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || _la===64 || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 74980871) !== 0)) {
					{
					this.state = 1789;
					this.parameter();
					this.state = 1794;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 192, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1790;
							this.match(SolidCashParser.T__4);
							this.state = 1791;
							this.parameter();
							}
							}
						}
						this.state = 1796;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 192, this._ctx);
					}
					this.state = 1798;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1797;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1802;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
			this.state = 1805;
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
			this.state = 1807;
			this.match(SolidCashParser.T__108);
			this.state = 1808;
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
			this.state = 1810;
			this.match(SolidCashParser.T__109);
			this.state = 1811;
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
			this.state = 1816;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 164:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1813;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 176:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1814;
				this.match(SolidCashParser.Identifier);
				this.state = 1815;
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
			this.state = 1860;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 202, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1818;
				this.match(SolidCashParser.T__35);
				this.state = 1819;
				this.match(SolidCashParser.Identifier);
				this.state = 1822;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1820;
					this.match(SolidCashParser.T__11);
					this.state = 1821;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1824;
				this.match(SolidCashParser.T__48);
				this.state = 1825;
				this.match(SolidCashParser.T__3);
				this.state = 1837;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 1826;
					this.namedArg();
					this.state = 1831;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 198, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1827;
							this.match(SolidCashParser.T__4);
							this.state = 1828;
							this.namedArg();
							}
							}
						}
						this.state = 1833;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 198, this._ctx);
					}
					this.state = 1835;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1834;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1839;
				this.match(SolidCashParser.T__5);
				this.state = 1840;
				this.match(SolidCashParser.T__49);
				this.state = 1841;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1842;
				this.match(SolidCashParser.T__35);
				this.state = 1843;
				this.match(SolidCashParser.Identifier);
				this.state = 1846;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1844;
					this.match(SolidCashParser.T__11);
					this.state = 1845;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1848;
				this.expressionList();
				this.state = 1849;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1851;
				this.match(SolidCashParser.T__35);
				this.state = 1852;
				this.match(SolidCashParser.T__48);
				this.state = 1853;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1854;
				this.match(SolidCashParser.T__49);
				this.state = 1855;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1856;
				this.match(SolidCashParser.T__35);
				this.state = 1857;
				this.match(SolidCashParser.T__48);
				this.state = 1858;
				this.match(SolidCashParser.T__49);
				this.state = 1859;
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
			this.state = 1862;
			this.match(SolidCashParser.T__110);
			this.state = 1863;
			this.match(SolidCashParser.T__48);
			this.state = 1864;
			this.expression(0);
			this.state = 1865;
			this.match(SolidCashParser.T__49);
			this.state = 1866;
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
			this.state = 1870;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 176:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1868;
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
				this.state = 1869;
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
			this.state = 1872;
			this.match(SolidCashParser.T__48);
			this.state = 1884;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 154)) & ~0x1F) === 0 && ((1 << (_la - 154)) & 7347225) !== 0)) {
				{
				this.state = 1873;
				this.consoleParameter();
				this.state = 1878;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 204, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1874;
						this.match(SolidCashParser.T__4);
						this.state = 1875;
						this.consoleParameter();
						}
						}
					}
					this.state = 1880;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 204, this._ctx);
				}
				this.state = 1882;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1881;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1886;
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
			this.state = 1912;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 210, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1888;
				this.match(SolidCashParser.Identifier);
				this.state = 1889;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1890;
				this.match(SolidCashParser.Identifier);
				this.state = 1891;
				this.match(SolidCashParser.T__11);
				this.state = 1892;
				this.match(SolidCashParser.Identifier);
				this.state = 1893;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1894;
				this.match(SolidCashParser.Identifier);
				this.state = 1895;
				this.match(SolidCashParser.T__48);
				this.state = 1896;
				this.match(SolidCashParser.T__3);
				this.state = 1908;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 1897;
					this.namedArg();
					this.state = 1902;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 207, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1898;
							this.match(SolidCashParser.T__4);
							this.state = 1899;
							this.namedArg();
							}
							}
						}
						this.state = 1904;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 207, this._ctx);
					}
					this.state = 1906;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1905;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1910;
				this.match(SolidCashParser.T__5);
				this.state = 1911;
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
			this.state = 1914;
			this.match(SolidCashParser.Identifier);
			this.state = 1915;
			this.match(SolidCashParser.T__104);
			this.state = 1916;
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
			this.state = 1918;
			this.match(SolidCashParser.T__48);
			this.state = 1930;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 112)) & ~0x1F) === 0 && ((1 << (_la - 112)) & 33622015) !== 0) || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 134078423) !== 0)) {
				{
				this.state = 1919;
				this.expression(0);
				this.state = 1924;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 211, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1920;
						this.match(SolidCashParser.T__4);
						this.state = 1921;
						this.expression(0);
						}
						}
					}
					this.state = 1926;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 211, this._ctx);
				}
				this.state = 1928;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1927;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1932;
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
			this.state = 1934;
			this.match(SolidCashParser.T__3);
			this.state = 1935;
			this.callOption();
			this.state = 1940;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 214, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1936;
					this.match(SolidCashParser.T__4);
					this.state = 1937;
					this.callOption();
					}
					}
				}
				this.state = 1942;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 214, this._ctx);
			}
			this.state = 1944;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1943;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1946;
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
			this.state = 1948;
			this.match(SolidCashParser.Identifier);
			this.state = 1949;
			this.match(SolidCashParser.T__104);
			this.state = 1950;
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
			this.state = 1952;
			this.match(SolidCashParser.T__48);
			this.state = 1953;
			this.typeName();
			this.state = 1958;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 216, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1954;
					this.match(SolidCashParser.T__4);
					this.state = 1955;
					this.typeName();
					}
					}
				}
				this.state = 1960;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 216, this._ctx);
			}
			this.state = 1962;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1961;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1964;
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
			this.state = 2111;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 225, this._ctx) ) {
			case 1:
				{
				localctx = new AssignmentExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 1967;
				this.match(SolidCashParser.T__48);
				this.state = 1968;
				this.match(SolidCashParser.Identifier);
				this.state = 1969;
				(localctx as AssignmentExpressionContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    (localctx as AssignmentExpressionContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1970;
				this.expression(0);
				this.state = 1971;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1973;
				this.match(SolidCashParser.T__48);
				this.state = 1974;
				this.expression(0);
				this.state = 1975;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				{
				localctx = new TupleExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1977;
				this.match(SolidCashParser.T__48);
				this.state = 1978;
				this.expression(0);
				this.state = 1981;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1979;
					this.match(SolidCashParser.T__4);
					this.state = 1980;
					this.expression(0);
					}
					}
					this.state = 1983;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1985;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 4:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1987;
				this.typeCast();
				this.state = 1988;
				this.match(SolidCashParser.T__48);
				this.state = 1989;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 1991;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1990;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1993;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 5:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1995;
				this.functionCall();
				}
				break;
			case 6:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1996;
				this.match(SolidCashParser.T__111);
				this.state = 1997;
				this.match(SolidCashParser.Identifier);
				this.state = 1999;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1998;
					this.callOptions();
					}
				}

				this.state = 2001;
				this.expressionList();
				}
				break;
			case 7:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2002;
				this.match(SolidCashParser.T__111);
				this.state = 2003;
				this.typeName();
				this.state = 2004;
				this.match(SolidCashParser.T__65);
				this.state = 2005;
				this.match(SolidCashParser.T__66);
				this.state = 2006;
				this.match(SolidCashParser.T__48);
				this.state = 2007;
				this.expression(0);
				this.state = 2008;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 8:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2010;
				this.match(SolidCashParser.T__54);
				this.state = 2011;
				this.match(SolidCashParser.T__48);
				this.state = 2012;
				this.typeName();
				this.state = 2013;
				this.match(SolidCashParser.T__49);
				this.state = 2014;
				this.match(SolidCashParser.T__11);
				this.state = 2015;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 9:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2017;
				this.match(SolidCashParser.T__112);
				this.state = 2018;
				this.expressionList();
				}
				break;
			case 10:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2019;
				this.match(SolidCashParser.T__113);
				this.state = 2020;
				this.expressionList();
				}
				break;
			case 11:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2021;
				this.match(SolidCashParser.T__114);
				this.state = 2022;
				this.expressionList();
				}
				break;
			case 12:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2023;
				this.match(SolidCashParser.T__115);
				this.state = 2024;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2025;
				this.match(SolidCashParser.T__116);
				this.state = 2026;
				this.match(SolidCashParser.T__48);
				this.state = 2027;
				this.match(SolidCashParser.Identifier);
				this.state = 2028;
				this.match(SolidCashParser.T__11);
				this.state = 2029;
				this.match(SolidCashParser.Identifier);
				this.state = 2030;
				this.match(SolidCashParser.T__4);
				this.state = 2031;
				this.expressionList();
				this.state = 2032;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 14:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2034;
				this.match(SolidCashParser.T__117);
				this.state = 2035;
				this.expressionList();
				}
				break;
			case 15:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2036;
				this.match(SolidCashParser.T__118);
				this.state = 2037;
				this.expressionList();
				}
				break;
			case 16:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2038;
				this.match(SolidCashParser.T__119);
				this.state = 2039;
				this.match(SolidCashParser.T__48);
				this.state = 2040;
				this.expression(0);
				this.state = 2041;
				this.match(SolidCashParser.T__4);
				this.state = 2042;
				this.typeList();
				this.state = 2043;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 17:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2045;
				this.match(SolidCashParser.T__120);
				this.state = 2046;
				this.match(SolidCashParser.T__48);
				this.state = 2047;
				this.expression(0);
				this.state = 2048;
				this.match(SolidCashParser.T__4);
				this.state = 2049;
				this.typeList();
				this.state = 2050;
				this.match(SolidCashParser.T__4);
				this.state = 2051;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 2052;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 18:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2054;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__121);
				this.state = 2055;
				this.match(SolidCashParser.T__65);
				this.state = 2056;
				this.expression(0);
				this.state = 2057;
				this.match(SolidCashParser.T__66);
				this.state = 2058;
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
				this.state = 2060;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__127);
				this.state = 2061;
				this.match(SolidCashParser.T__65);
				this.state = 2062;
				this.expression(0);
				this.state = 2063;
				this.match(SolidCashParser.T__66);
				this.state = 2064;
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
				this.state = 2066;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===137)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2067;
				this.expression(21);
				}
				break;
			case 21:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2068;
				this.match(SolidCashParser.T__65);
				this.state = 2080;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 112)) & ~0x1F) === 0 && ((1 << (_la - 112)) & 33622015) !== 0) || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 134078423) !== 0)) {
					{
					this.state = 2069;
					this.expression(0);
					this.state = 2074;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 221, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2070;
							this.match(SolidCashParser.T__4);
							this.state = 2071;
							this.expression(0);
							}
							}
						}
						this.state = 2076;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 221, this._ctx);
					}
					this.state = 2078;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2077;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2082;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 22:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2083;
				this.match(SolidCashParser.T__73);
				this.state = 2084;
				this.match(SolidCashParser.T__11);
				this.state = 2085;
				this.match(SolidCashParser.Identifier);
				this.state = 2086;
				this.match(SolidCashParser.T__11);
				this.state = 2087;
				this.match(SolidCashParser.Identifier);
				this.state = 2088;
				this.match(SolidCashParser.T__65);
				this.state = 2089;
				this.expression(0);
				this.state = 2090;
				this.match(SolidCashParser.T__66);
				this.state = 2091;
				this.memberName();
				}
				break;
			case 23:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2093;
				this.match(SolidCashParser.T__73);
				this.state = 2094;
				this.match(SolidCashParser.T__11);
				this.state = 2095;
				this.match(SolidCashParser.Identifier);
				this.state = 2100;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2096;
						this.match(SolidCashParser.T__65);
						this.state = 2097;
						this.expression(0);
						this.state = 2098;
						this.match(SolidCashParser.T__66);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2102;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 224, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 24:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2104;
				this.match(SolidCashParser.T__73);
				this.state = 2105;
				this.match(SolidCashParser.T__11);
				this.state = 2106;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 25:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2107;
				this.match(SolidCashParser.T__73);
				}
				break;
			case 26:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2108;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 27:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2109;
				this.anyIdentifier();
				}
				break;
			case 28:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2110;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2218;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 232, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2216;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 231, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2113;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 2114;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 2115;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2116;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 2117;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2118;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2119;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 2120;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2121;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2122;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 2123;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===138 || _la===139)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2124;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2125;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 2126;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2127;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2128;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2129;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2130;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2131;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2132;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2133;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2134;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2135;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2136;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2137;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2138;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2139;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2140;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2141;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__139);
						this.state = 2142;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2143;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2144;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__140);
						this.state = 2145;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2146;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 2147;
						this.match(SolidCashParser.T__141);
						this.state = 2148;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 2149;
						this.match(SolidCashParser.T__104);
						this.state = 2150;
						(localctx as TernaryOpContext)._ifFalse = this.expression(9);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2152;
						if (!(this.precpred(this._ctx, 32))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 32)");
						}
						this.state = 2153;
						this.match(SolidCashParser.T__65);
						this.state = 2154;
						(localctx as IndexRangeSliceContext)._start = this.expression(0);
						this.state = 2155;
						this.match(SolidCashParser.T__104);
						this.state = 2156;
						(localctx as IndexRangeSliceContext)._end = this.expression(0);
						this.state = 2157;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2159;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 2160;
						this.match(SolidCashParser.T__65);
						this.state = 2161;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2162;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2163;
						if (!(this.precpred(this._ctx, 30))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 30)");
						}
						this.state = 2164;
						this.match(SolidCashParser.T__65);
						this.state = 2165;
						this.expression(0);
						this.state = 2166;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2168;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2169;
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
						this.state = 2170;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2171;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__134);
						this.state = 2172;
						this.match(SolidCashParser.T__48);
						this.state = 2173;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2174;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2176;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2177;
						this.match(SolidCashParser.T__135);
						this.state = 2178;
						this.match(SolidCashParser.T__48);
						this.state = 2179;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2180;
						this.match(SolidCashParser.T__4);
						this.state = 2181;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2182;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2184;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2185;
						this.match(SolidCashParser.T__11);
						this.state = 2186;
						this.match(SolidCashParser.Identifier);
						this.state = 2188;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2187;
							this.callOptions();
							}
						}

						this.state = 2190;
						this.match(SolidCashParser.T__48);
						this.state = 2191;
						this.match(SolidCashParser.T__3);
						this.state = 2203;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===176) {
							{
							this.state = 2192;
							this.namedArg();
							this.state = 2197;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 227, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2193;
									this.match(SolidCashParser.T__4);
									this.state = 2194;
									this.namedArg();
									}
									}
								}
								this.state = 2199;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 227, this._ctx);
							}
							this.state = 2201;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2200;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2205;
						this.match(SolidCashParser.T__5);
						this.state = 2206;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 20:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2207;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2208;
						this.match(SolidCashParser.T__11);
						this.state = 2209;
						this.match(SolidCashParser.Identifier);
						this.state = 2211;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2210;
							this.callOptions();
							}
						}

						this.state = 2213;
						this.expressionList();
						}
						break;
					case 21:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2214;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 2215;
						this.memberName();
						}
						break;
					}
					}
				}
				this.state = 2220;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 232, this._ctx);
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
			this.state = 2234;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2221;
				this.match(SolidCashParser.T__11);
				this.state = 2222;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 123:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2223;
				this.match(SolidCashParser.T__122);
				}
				break;
			case 124:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2224;
				this.match(SolidCashParser.T__123);
				}
				break;
			case 125:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2225;
				this.match(SolidCashParser.T__124);
				}
				break;
			case 126:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2226;
				this.match(SolidCashParser.T__125);
				}
				break;
			case 127:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2227;
				this.match(SolidCashParser.T__126);
				}
				break;
			case 129:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2228;
				this.match(SolidCashParser.T__128);
				}
				break;
			case 130:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2229;
				this.match(SolidCashParser.T__129);
				}
				break;
			case 131:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2230;
				this.match(SolidCashParser.T__130);
				}
				break;
			case 132:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2231;
				this.match(SolidCashParser.T__131);
				}
				break;
			case 143:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2232;
				this.match(SolidCashParser.T__142);
				}
				break;
			case 144:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2233;
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
			this.state = 2236;
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
			this.state = 2252;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 154:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2238;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 158:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2239;
				this.numberLiteral();
				}
				break;
			case 157:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2240;
				this.decimalLiteral();
				}
				break;
			case 164:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2241;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2245;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 234, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2242;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2247;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 234, this._ctx);
				}
				}
				break;
			case 174:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2248;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 175:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2249;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 165:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2250;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 166:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2251;
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
			this.state = 2254;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2256;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 236, this._ctx) ) {
			case 1:
				{
				this.state = 2255;
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
			this.state = 2258;
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
			this.state = 2304;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 241, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2260;
				this.match(SolidCashParser.T__149);
				this.state = 2261;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2262;
				this.match(SolidCashParser.T__149);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2263;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2264;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2265;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2266;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2267;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2268;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2269;
				this.match(SolidCashParser.T__150);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2270;
				this.match(SolidCashParser.T__151);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2271;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2272;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2273;
				this.match(SolidCashParser.T__6);
				this.state = 2274;
				this.match(SolidCashParser.T__48);
				this.state = 2283;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 74980871) !== 0)) {
					{
					this.state = 2275;
					this.typeName();
					this.state = 2280;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2276;
						this.match(SolidCashParser.T__4);
						this.state = 2277;
						this.typeName();
						}
						}
						this.state = 2282;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2285;
				this.match(SolidCashParser.T__49);
				this.state = 2298;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===73) {
					{
					this.state = 2286;
					this.match(SolidCashParser.T__72);
					this.state = 2287;
					this.match(SolidCashParser.T__48);
					this.state = 2288;
					this.typeName();
					this.state = 2293;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2289;
						this.match(SolidCashParser.T__4);
						this.state = 2290;
						this.typeName();
						}
						}
						this.state = 2295;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2296;
					this.match(SolidCashParser.T__49);
					}
				}

				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2300;
				this.match(SolidCashParser.Identifier);
				this.state = 2301;
				this.match(SolidCashParser.T__11);
				this.state = 2302;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 2303;
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
			this.state = 2306;
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

	public static readonly _serializedATN: number[] = [4,1,179,2309,2,0,7,0,
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
	1,26,1,27,1,27,1,27,3,27,636,8,27,1,27,1,27,1,27,1,28,1,28,1,28,1,28,1,
	28,1,28,5,28,647,8,28,10,28,12,28,650,9,28,1,28,3,28,653,8,28,1,28,1,28,
	1,29,1,29,1,29,3,29,660,8,29,1,30,1,30,1,30,1,30,1,30,1,30,1,31,1,31,1,
	31,1,31,1,31,1,31,1,31,1,32,1,32,1,32,5,32,678,8,32,10,32,12,32,681,9,32,
	1,32,5,32,684,8,32,10,32,12,32,687,9,32,1,32,1,32,5,32,691,8,32,10,32,12,
	32,694,9,32,1,32,1,32,1,33,1,33,1,33,1,33,5,33,702,8,33,10,33,12,33,705,
	9,33,1,33,5,33,708,8,33,10,33,12,33,711,9,33,1,33,1,33,5,33,715,8,33,10,
	33,12,33,718,9,33,1,33,1,33,1,34,1,34,1,34,3,34,725,8,34,1,35,1,35,1,35,
	1,35,1,35,1,35,1,35,5,35,734,8,35,10,35,12,35,737,9,35,1,35,1,35,1,36,1,
	36,1,36,1,37,3,37,745,8,37,1,37,1,37,5,37,749,8,37,10,37,12,37,752,9,37,
	1,37,1,37,1,37,3,37,757,8,37,1,37,1,37,1,37,1,37,1,37,5,37,764,8,37,10,
	37,12,37,767,9,37,1,37,1,37,1,37,3,37,772,8,37,1,37,1,37,1,37,3,37,777,
	8,37,1,37,1,37,5,37,781,8,37,10,37,12,37,784,9,37,1,37,1,37,1,37,1,37,3,
	37,790,8,37,1,37,1,37,5,37,794,8,37,10,37,12,37,797,9,37,1,37,1,37,1,37,
	3,37,802,8,37,1,37,1,37,3,37,806,8,37,1,38,1,38,3,38,810,8,38,1,39,1,39,
	1,40,1,40,1,40,1,40,3,40,818,8,40,1,40,1,40,1,40,3,40,823,8,40,1,40,1,40,
	1,40,1,40,1,40,1,40,3,40,831,8,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,
	40,3,40,841,8,40,1,40,1,40,1,40,3,40,846,8,40,1,40,1,40,3,40,850,8,40,1,
	41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,3,41,862,8,41,1,41,1,41,
	1,41,1,41,1,41,1,41,1,41,5,41,871,8,41,10,41,12,41,874,9,41,1,42,1,42,1,
	42,3,42,879,8,42,1,42,1,42,5,42,883,8,42,10,42,12,42,886,9,42,1,42,1,42,
	1,43,1,43,3,43,892,8,43,1,44,1,44,1,44,1,45,1,45,1,45,1,45,5,45,901,8,45,
	10,45,12,45,904,9,45,1,45,5,45,907,8,45,10,45,12,45,910,9,45,1,45,3,45,
	913,8,45,1,45,1,45,5,45,917,8,45,10,45,12,45,920,9,45,1,45,1,45,1,46,1,
	46,3,46,926,8,46,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,
	1,47,1,47,1,47,3,47,942,8,47,1,48,1,48,1,48,1,48,1,48,5,48,949,8,48,10,
	48,12,48,952,9,48,1,48,3,48,955,8,48,1,49,1,49,1,49,1,49,3,49,961,8,49,
	1,50,1,50,1,50,1,50,1,50,5,50,968,8,50,10,50,12,50,971,9,50,1,50,3,50,974,
	8,50,1,50,1,50,1,51,1,51,5,51,980,8,51,10,51,12,51,983,9,51,1,51,3,51,986,
	8,51,1,51,1,51,5,51,990,8,51,10,51,12,51,993,9,51,1,51,3,51,996,8,51,3,
	51,998,8,51,1,52,1,52,1,52,1,52,5,52,1004,8,52,10,52,12,52,1007,9,52,1,
	52,3,52,1010,8,52,3,52,1012,8,52,1,52,1,52,1,53,1,53,5,53,1018,8,53,10,
	53,12,53,1021,9,53,1,53,3,53,1024,8,53,1,53,1,53,5,53,1028,8,53,10,53,12,
	53,1031,9,53,1,53,3,53,1034,8,53,1,53,1,53,5,53,1038,8,53,10,53,12,53,1041,
	9,53,1,53,3,53,1044,8,53,3,53,1046,8,53,1,54,1,54,5,54,1050,8,54,10,54,
	12,54,1053,9,54,1,54,1,54,3,54,1057,8,54,1,55,1,55,1,55,1,55,1,55,1,55,
	1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,
	55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,3,55,1090,8,55,1,56,
	1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,57,1,57,1,57,1,57,1,57,1,
	57,1,57,1,57,1,57,1,57,1,57,1,57,5,57,1114,8,57,10,57,12,57,1117,9,57,1,
	57,1,57,1,57,1,58,1,58,1,58,1,58,1,58,1,58,5,58,1128,8,58,10,58,12,58,1131,
	9,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,5,58,1140,8,58,10,58,12,58,1143,
	9,58,1,58,3,58,1146,8,58,1,58,1,58,1,58,3,58,1151,8,58,1,59,1,59,1,59,3,
	59,1156,8,59,1,59,1,59,1,59,1,59,1,59,5,59,1163,8,59,10,59,12,59,1166,9,
	59,1,59,3,59,1169,8,59,3,59,1171,8,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,
	1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,3,59,1193,
	8,59,1,59,1,59,1,59,3,59,1198,8,59,1,60,1,60,1,60,1,60,3,60,1204,8,60,1,
	60,1,60,1,60,1,61,1,61,1,61,1,61,1,61,1,61,1,62,1,62,1,62,1,62,3,62,1219,
	8,62,1,62,1,62,1,62,1,62,1,62,5,62,1226,8,62,10,62,12,62,1229,9,62,1,62,
	3,62,1232,8,62,3,62,1234,8,62,1,62,1,62,1,62,1,62,1,62,1,62,1,62,3,62,1243,
	8,62,1,62,1,62,1,62,3,62,1248,8,62,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,
	63,1257,8,63,11,63,12,63,1258,3,63,1261,8,63,1,63,1,63,5,63,1265,8,63,10,
	63,12,63,1268,9,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1279,
	8,63,11,63,12,63,1280,1,63,1,63,5,63,1285,8,63,10,63,12,63,1288,9,63,1,
	63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1297,8,63,11,63,12,63,1298,1,63,1,
	63,1,63,1,63,1,63,1,63,1,63,4,63,1308,8,63,11,63,12,63,1309,1,63,1,63,1,
	63,1,63,4,63,1316,8,63,11,63,12,63,1317,1,63,1,63,1,63,1,63,1,63,1,63,1,
	63,1,63,1,63,1,63,1,63,4,63,1331,8,63,11,63,12,63,1332,3,63,1335,8,63,1,
	63,1,63,5,63,1339,8,63,10,63,12,63,1342,9,63,1,63,1,63,1,63,1,63,1,63,1,
	63,1,63,4,63,1351,8,63,11,63,12,63,1352,1,63,1,63,5,63,1357,8,63,10,63,
	12,63,1360,9,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1368,8,63,11,63,12,63,
	1369,1,63,1,63,3,63,1374,8,63,1,64,1,64,1,64,1,64,1,64,1,64,1,64,5,64,1383,
	8,64,10,64,12,64,1386,9,64,1,64,1,64,1,64,1,64,1,64,1,64,1,65,1,65,5,65,
	1396,8,65,10,65,12,65,1399,9,65,1,65,1,65,1,65,3,65,1404,8,65,1,65,1,65,
	1,65,1,65,5,65,1410,8,65,10,65,12,65,1413,9,65,1,65,1,65,1,65,3,65,1418,
	8,65,1,65,1,65,3,65,1422,8,65,1,66,1,66,1,66,1,66,1,66,1,66,4,66,1430,8,
	66,11,66,12,66,1431,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,4,66,1442,8,
	66,11,66,12,66,1443,1,66,1,66,1,66,1,66,1,66,1,66,4,66,1452,8,66,11,66,
	12,66,1453,1,66,1,66,1,66,1,66,1,66,1,66,1,66,4,66,1463,8,66,11,66,12,66,
	1464,1,66,1,66,1,66,1,66,1,66,3,66,1472,8,66,1,67,1,67,5,67,1476,8,67,10,
	67,12,67,1479,9,67,1,67,1,67,1,67,1,67,3,67,1485,8,67,1,68,1,68,1,68,1,
	68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,3,68,1498,8,68,1,69,1,69,1,69,1,69,
	1,69,1,69,1,69,1,70,1,70,1,70,1,70,1,70,1,70,1,71,1,71,1,71,1,71,1,71,1,
	71,1,71,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,73,1,73,1,73,1,73,
	1,73,1,73,1,73,1,73,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,
	74,1,74,1,74,1,74,1,74,1,74,4,74,1553,8,74,11,74,12,74,1554,1,74,1,74,1,
	74,1,74,1,74,1,74,1,74,1,74,4,74,1565,8,74,11,74,12,74,1566,1,74,1,74,3,
	74,1571,8,74,1,75,1,75,1,75,1,75,1,75,1,75,1,75,3,75,1580,8,75,1,75,1,75,
	1,75,1,76,1,76,1,76,1,76,1,76,3,76,1590,8,76,1,76,1,76,1,76,1,77,1,77,1,
	77,1,77,1,77,1,77,1,77,3,77,1602,8,77,1,78,1,78,1,78,1,78,1,78,1,78,3,78,
	1610,8,78,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,
	79,1,79,1,79,1,79,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,
	1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,82,1,82,1,82,1,
	82,1,82,3,82,1655,8,82,1,82,1,82,1,82,1,83,1,83,5,83,1662,8,83,10,83,12,
	83,1665,9,83,1,83,1,83,1,83,3,83,1670,8,83,1,83,1,83,1,84,1,84,1,84,1,85,
	1,85,1,85,1,85,1,85,3,85,1682,8,85,1,86,1,86,1,86,1,86,1,86,1,86,1,86,1,
	86,1,87,1,87,1,87,1,87,1,87,1,87,1,88,1,88,1,88,1,88,1,89,1,89,1,89,5,89,
	1705,8,89,10,89,12,89,1708,9,89,1,89,1,89,1,90,1,90,1,91,1,91,1,91,5,91,
	1717,8,91,10,91,12,91,1720,9,91,1,91,1,91,1,92,1,92,1,92,1,92,1,92,1,92,
	5,92,1730,8,92,10,92,12,92,1733,9,92,1,92,3,92,1736,8,92,1,92,1,92,1,93,
	1,93,1,93,1,93,5,93,1744,8,93,10,93,12,93,1747,9,93,1,94,1,94,1,94,5,94,
	1752,8,94,10,94,12,94,1755,9,94,1,95,1,95,1,95,3,95,1760,8,95,1,95,1,95,
	4,95,1764,8,95,11,95,12,95,1765,1,96,1,96,1,96,1,96,1,96,5,96,1773,8,96,
	10,96,12,96,1776,9,96,1,96,3,96,1779,8,96,3,96,1781,8,96,1,96,1,96,1,97,
	1,97,3,97,1787,8,97,1,97,1,97,1,97,1,97,5,97,1793,8,97,10,97,12,97,1796,
	9,97,1,97,3,97,1799,8,97,3,97,1801,8,97,1,97,3,97,1804,8,97,1,97,1,97,1,
	98,1,98,1,98,1,99,1,99,1,99,1,100,1,100,1,100,3,100,1817,8,100,1,101,1,
	101,1,101,1,101,3,101,1823,8,101,1,101,1,101,1,101,1,101,1,101,5,101,1830,
	8,101,10,101,12,101,1833,9,101,1,101,3,101,1836,8,101,3,101,1838,8,101,
	1,101,1,101,1,101,1,101,1,101,1,101,1,101,3,101,1847,8,101,1,101,1,101,
	1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,3,101,1861,
	8,101,1,102,1,102,1,102,1,102,1,102,1,102,1,103,1,103,3,103,1871,8,103,
	1,104,1,104,1,104,1,104,5,104,1877,8,104,10,104,12,104,1880,9,104,1,104,
	3,104,1883,8,104,3,104,1885,8,104,1,104,1,104,1,105,1,105,1,105,1,105,1,
	105,1,105,1,105,1,105,1,105,1,105,1,105,1,105,5,105,1901,8,105,10,105,12,
	105,1904,9,105,1,105,3,105,1907,8,105,3,105,1909,8,105,1,105,1,105,3,105,
	1913,8,105,1,106,1,106,1,106,1,106,1,107,1,107,1,107,1,107,5,107,1923,8,
	107,10,107,12,107,1926,9,107,1,107,3,107,1929,8,107,3,107,1931,8,107,1,
	107,1,107,1,108,1,108,1,108,1,108,5,108,1939,8,108,10,108,12,108,1942,9,
	108,1,108,3,108,1945,8,108,1,108,1,108,1,109,1,109,1,109,1,109,1,110,1,
	110,1,110,1,110,5,110,1957,8,110,10,110,12,110,1960,9,110,1,110,3,110,1963,
	8,110,1,110,1,110,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,4,111,1982,8,111,11,111,12,111,1983,
	1,111,1,111,1,111,1,111,1,111,1,111,3,111,1992,8,111,1,111,1,111,1,111,
	1,111,1,111,1,111,3,111,2000,8,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,5,111,2073,8,111,10,111,12,111,2076,9,111,
	1,111,3,111,2079,8,111,3,111,2081,8,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,4,111,2101,8,111,11,111,12,111,2102,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,3,111,2112,8,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,3,111,2189,8,111,1,111,1,
	111,1,111,1,111,1,111,5,111,2196,8,111,10,111,12,111,2199,9,111,1,111,3,
	111,2202,8,111,3,111,2204,8,111,1,111,1,111,1,111,1,111,1,111,1,111,3,111,
	2212,8,111,1,111,1,111,1,111,5,111,2217,8,111,10,111,12,111,2220,9,111,
	1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,
	1,112,3,112,2235,8,112,1,113,1,113,1,114,1,114,1,114,1,114,1,114,5,114,
	2244,8,114,10,114,12,114,2247,9,114,1,114,1,114,1,114,1,114,3,114,2253,
	8,114,1,115,1,115,3,115,2257,8,115,1,116,1,116,1,117,1,117,1,117,1,117,
	1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,
	1,117,1,117,5,117,2279,8,117,10,117,12,117,2282,9,117,3,117,2284,8,117,
	1,117,1,117,1,117,1,117,1,117,1,117,5,117,2292,8,117,10,117,12,117,2295,
	9,117,1,117,1,117,3,117,2299,8,117,1,117,1,117,1,117,1,117,3,117,2305,8,
	117,1,118,1,118,1,118,0,2,82,222,119,0,2,4,6,8,10,12,14,16,18,20,22,24,
	26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,
	74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,110,112,114,
	116,118,120,122,124,126,128,130,132,134,136,138,140,142,144,146,148,150,
	152,154,156,158,160,162,164,166,168,170,172,174,176,178,180,182,184,186,
	188,190,192,194,196,198,200,202,204,206,208,210,212,214,216,218,220,222,
	224,226,228,230,232,234,236,0,23,2,0,10,10,13,27,5,0,11,11,28,36,156,156,
	160,160,176,176,1,0,38,39,3,0,20,23,26,27,40,40,1,0,43,44,2,0,43,44,58,
	59,3,0,43,44,58,58,63,63,2,0,158,158,176,176,2,0,40,40,77,86,1,0,87,88,
	3,0,158,158,166,166,176,176,1,0,123,127,2,0,123,127,129,132,3,0,14,14,27,
	27,137,137,2,0,10,10,15,16,1,0,13,14,1,0,138,139,1,0,20,23,1,0,18,19,1,
	0,133,134,3,0,33,33,56,56,145,149,1,0,155,156,4,0,59,59,150,152,159,162,
	168,172,2599,0,241,1,0,0,0,2,293,1,0,0,0,4,295,1,0,0,0,6,300,1,0,0,0,8,
	356,1,0,0,0,10,358,1,0,0,0,12,367,1,0,0,0,14,369,1,0,0,0,16,371,1,0,0,0,
	18,376,1,0,0,0,20,378,1,0,0,0,22,383,1,0,0,0,24,387,1,0,0,0,26,389,1,0,
	0,0,28,428,1,0,0,0,30,430,1,0,0,0,32,435,1,0,0,0,34,437,1,0,0,0,36,451,
	1,0,0,0,38,505,1,0,0,0,40,545,1,0,0,0,42,549,1,0,0,0,44,569,1,0,0,0,46,
	593,1,0,0,0,48,600,1,0,0,0,50,619,1,0,0,0,52,622,1,0,0,0,54,635,1,0,0,0,
	56,640,1,0,0,0,58,656,1,0,0,0,60,661,1,0,0,0,62,667,1,0,0,0,64,674,1,0,
	0,0,66,697,1,0,0,0,68,724,1,0,0,0,70,726,1,0,0,0,72,740,1,0,0,0,74,805,
	1,0,0,0,76,809,1,0,0,0,78,811,1,0,0,0,80,849,1,0,0,0,82,861,1,0,0,0,84,
	875,1,0,0,0,86,891,1,0,0,0,88,893,1,0,0,0,90,896,1,0,0,0,92,923,1,0,0,0,
	94,941,1,0,0,0,96,943,1,0,0,0,98,956,1,0,0,0,100,962,1,0,0,0,102,997,1,
	0,0,0,104,999,1,0,0,0,106,1045,1,0,0,0,108,1056,1,0,0,0,110,1089,1,0,0,
	0,112,1091,1,0,0,0,114,1101,1,0,0,0,116,1150,1,0,0,0,118,1197,1,0,0,0,120,
	1199,1,0,0,0,122,1208,1,0,0,0,124,1247,1,0,0,0,126,1373,1,0,0,0,128,1375,
	1,0,0,0,130,1421,1,0,0,0,132,1471,1,0,0,0,134,1484,1,0,0,0,136,1497,1,0,
	0,0,138,1499,1,0,0,0,140,1506,1,0,0,0,142,1512,1,0,0,0,144,1519,1,0,0,0,
	146,1528,1,0,0,0,148,1570,1,0,0,0,150,1572,1,0,0,0,152,1584,1,0,0,0,154,
	1594,1,0,0,0,156,1609,1,0,0,0,158,1611,1,0,0,0,160,1627,1,0,0,0,162,1638,
	1,0,0,0,164,1649,1,0,0,0,166,1659,1,0,0,0,168,1673,1,0,0,0,170,1681,1,0,
	0,0,172,1683,1,0,0,0,174,1691,1,0,0,0,176,1697,1,0,0,0,178,1701,1,0,0,0,
	180,1711,1,0,0,0,182,1713,1,0,0,0,184,1723,1,0,0,0,186,1739,1,0,0,0,188,
	1748,1,0,0,0,190,1756,1,0,0,0,192,1767,1,0,0,0,194,1784,1,0,0,0,196,1807,
	1,0,0,0,198,1810,1,0,0,0,200,1816,1,0,0,0,202,1860,1,0,0,0,204,1862,1,0,
	0,0,206,1870,1,0,0,0,208,1872,1,0,0,0,210,1912,1,0,0,0,212,1914,1,0,0,0,
	214,1918,1,0,0,0,216,1934,1,0,0,0,218,1948,1,0,0,0,220,1952,1,0,0,0,222,
	2111,1,0,0,0,224,2234,1,0,0,0,226,2236,1,0,0,0,228,2252,1,0,0,0,230,2254,
	1,0,0,0,232,2258,1,0,0,0,234,2304,1,0,0,0,236,2306,1,0,0,0,238,240,3,16,
	8,0,239,238,1,0,0,0,240,243,1,0,0,0,241,239,1,0,0,0,241,242,1,0,0,0,242,
	247,1,0,0,0,243,241,1,0,0,0,244,246,3,2,1,0,245,244,1,0,0,0,246,249,1,0,
	0,0,247,245,1,0,0,0,247,248,1,0,0,0,248,262,1,0,0,0,249,247,1,0,0,0,250,
	261,3,62,31,0,251,261,3,56,28,0,252,261,3,52,26,0,253,261,3,60,30,0,254,
	261,3,8,4,0,255,261,3,48,24,0,256,261,3,26,13,0,257,261,3,6,3,0,258,261,
	3,36,18,0,259,261,3,38,19,0,260,250,1,0,0,0,260,251,1,0,0,0,260,252,1,0,
	0,0,260,253,1,0,0,0,260,254,1,0,0,0,260,255,1,0,0,0,260,256,1,0,0,0,260,
	257,1,0,0,0,260,258,1,0,0,0,260,259,1,0,0,0,261,264,1,0,0,0,262,260,1,0,
	0,0,262,263,1,0,0,0,263,265,1,0,0,0,264,262,1,0,0,0,265,266,5,0,0,1,266,
	1,1,0,0,0,267,268,5,1,0,0,268,269,5,164,0,0,269,294,5,2,0,0,270,271,5,1,
	0,0,271,272,5,164,0,0,272,273,5,3,0,0,273,274,5,176,0,0,274,294,5,2,0,0,
	275,276,5,1,0,0,276,277,5,4,0,0,277,282,3,4,2,0,278,279,5,5,0,0,279,281,
	3,4,2,0,280,278,1,0,0,0,281,284,1,0,0,0,282,280,1,0,0,0,282,283,1,0,0,0,
	283,286,1,0,0,0,284,282,1,0,0,0,285,287,5,5,0,0,286,285,1,0,0,0,286,287,
	1,0,0,0,287,288,1,0,0,0,288,289,5,6,0,0,289,290,5,176,0,0,290,291,5,164,
	0,0,291,292,5,2,0,0,292,294,1,0,0,0,293,267,1,0,0,0,293,270,1,0,0,0,293,
	275,1,0,0,0,294,3,1,0,0,0,295,298,5,176,0,0,296,297,5,3,0,0,297,299,5,176,
	0,0,298,296,1,0,0,0,298,299,1,0,0,0,299,5,1,0,0,0,300,301,5,7,0,0,301,302,
	3,14,7,0,302,306,3,104,52,0,303,305,3,94,47,0,304,303,1,0,0,0,305,308,1,
	0,0,0,306,304,1,0,0,0,306,307,1,0,0,0,307,310,1,0,0,0,308,306,1,0,0,0,309,
	311,3,100,50,0,310,309,1,0,0,0,310,311,1,0,0,0,311,312,1,0,0,0,312,316,
	5,4,0,0,313,315,3,110,55,0,314,313,1,0,0,0,315,318,1,0,0,0,316,314,1,0,
	0,0,316,317,1,0,0,0,317,319,1,0,0,0,318,316,1,0,0,0,319,320,5,6,0,0,320,
	7,1,0,0,0,321,322,5,8,0,0,322,323,5,176,0,0,323,326,5,9,0,0,324,327,3,234,
	117,0,325,327,5,10,0,0,326,324,1,0,0,0,326,325,1,0,0,0,327,329,1,0,0,0,
	328,330,5,11,0,0,329,328,1,0,0,0,329,330,1,0,0,0,330,331,1,0,0,0,331,357,
	5,2,0,0,332,333,5,8,0,0,333,334,5,4,0,0,334,339,3,10,5,0,335,336,5,5,0,
	0,336,338,3,10,5,0,337,335,1,0,0,0,338,341,1,0,0,0,339,337,1,0,0,0,339,
	340,1,0,0,0,340,343,1,0,0,0,341,339,1,0,0,0,342,344,5,5,0,0,343,342,1,0,
	0,0,343,344,1,0,0,0,344,345,1,0,0,0,345,346,5,6,0,0,346,349,5,9,0,0,347,
	350,3,234,117,0,348,350,5,10,0,0,349,347,1,0,0,0,349,348,1,0,0,0,350,352,
	1,0,0,0,351,353,5,11,0,0,352,351,1,0,0,0,352,353,1,0,0,0,353,354,1,0,0,
	0,354,355,5,2,0,0,355,357,1,0,0,0,356,321,1,0,0,0,356,332,1,0,0,0,357,9,
	1,0,0,0,358,361,5,176,0,0,359,360,5,12,0,0,360,362,5,176,0,0,361,359,1,
	0,0,0,361,362,1,0,0,0,362,365,1,0,0,0,363,364,5,3,0,0,364,366,3,12,6,0,
	365,363,1,0,0,0,365,366,1,0,0,0,366,11,1,0,0,0,367,368,7,0,0,0,368,13,1,
	0,0,0,369,370,7,1,0,0,370,15,1,0,0,0,371,372,5,37,0,0,372,373,3,18,9,0,
	373,374,3,20,10,0,374,375,5,2,0,0,375,17,1,0,0,0,376,377,7,2,0,0,377,19,
	1,0,0,0,378,380,3,22,11,0,379,381,3,22,11,0,380,379,1,0,0,0,380,381,1,0,
	0,0,381,21,1,0,0,0,382,384,3,24,12,0,383,382,1,0,0,0,383,384,1,0,0,0,384,
	385,1,0,0,0,385,386,5,153,0,0,386,23,1,0,0,0,387,388,7,3,0,0,388,25,1,0,
	0,0,389,390,5,41,0,0,390,400,5,176,0,0,391,392,5,42,0,0,392,397,5,176,0,
	0,393,394,5,5,0,0,394,396,5,176,0,0,395,393,1,0,0,0,396,399,1,0,0,0,397,
	395,1,0,0,0,397,398,1,0,0,0,398,401,1,0,0,0,399,397,1,0,0,0,400,391,1,0,
	0,0,400,401,1,0,0,0,401,402,1,0,0,0,402,413,5,4,0,0,403,412,3,56,28,0,404,
	412,3,52,26,0,405,412,3,60,30,0,406,412,3,44,22,0,407,412,3,48,24,0,408,
	412,3,30,15,0,409,412,3,28,14,0,410,412,3,34,17,0,411,403,1,0,0,0,411,404,
	1,0,0,0,411,405,1,0,0,0,411,406,1,0,0,0,411,407,1,0,0,0,411,408,1,0,0,0,
	411,409,1,0,0,0,411,410,1,0,0,0,412,415,1,0,0,0,413,411,1,0,0,0,413,414,
	1,0,0,0,414,416,1,0,0,0,415,413,1,0,0,0,416,417,5,6,0,0,417,27,1,0,0,0,
	418,419,3,32,16,0,419,420,3,80,40,0,420,421,5,176,0,0,421,422,5,2,0,0,422,
	429,1,0,0,0,423,424,3,32,16,0,424,425,3,82,41,0,425,426,5,176,0,0,426,427,
	5,2,0,0,427,429,1,0,0,0,428,418,1,0,0,0,428,423,1,0,0,0,429,29,1,0,0,0,
	430,431,3,32,16,0,431,432,3,234,117,0,432,433,5,176,0,0,433,434,5,2,0,0,
	434,31,1,0,0,0,435,436,7,4,0,0,436,33,1,0,0,0,437,438,5,7,0,0,438,439,5,
	176,0,0,439,443,3,104,52,0,440,442,3,94,47,0,441,440,1,0,0,0,442,445,1,
	0,0,0,443,441,1,0,0,0,443,444,1,0,0,0,444,447,1,0,0,0,445,443,1,0,0,0,446,
	448,3,100,50,0,447,446,1,0,0,0,447,448,1,0,0,0,448,449,1,0,0,0,449,450,
	5,2,0,0,450,35,1,0,0,0,451,452,5,45,0,0,452,453,5,176,0,0,453,457,5,4,0,
	0,454,456,3,56,28,0,455,454,1,0,0,0,456,459,1,0,0,0,457,455,1,0,0,0,457,
	458,1,0,0,0,458,463,1,0,0,0,459,457,1,0,0,0,460,462,3,52,26,0,461,460,1,
	0,0,0,462,465,1,0,0,0,463,461,1,0,0,0,463,464,1,0,0,0,464,469,1,0,0,0,465,
	463,1,0,0,0,466,468,3,60,30,0,467,466,1,0,0,0,468,471,1,0,0,0,469,467,1,
	0,0,0,469,470,1,0,0,0,470,475,1,0,0,0,471,469,1,0,0,0,472,474,3,44,22,0,
	473,472,1,0,0,0,474,477,1,0,0,0,475,473,1,0,0,0,475,476,1,0,0,0,476,481,
	1,0,0,0,477,475,1,0,0,0,478,480,3,48,24,0,479,478,1,0,0,0,480,483,1,0,0,
	0,481,479,1,0,0,0,481,482,1,0,0,0,482,487,1,0,0,0,483,481,1,0,0,0,484,486,
	3,62,31,0,485,484,1,0,0,0,486,489,1,0,0,0,487,485,1,0,0,0,487,488,1,0,0,
	0,488,493,1,0,0,0,489,487,1,0,0,0,490,492,3,8,4,0,491,490,1,0,0,0,492,495,
	1,0,0,0,493,491,1,0,0,0,493,494,1,0,0,0,494,499,1,0,0,0,495,493,1,0,0,0,
	496,498,3,6,3,0,497,496,1,0,0,0,498,501,1,0,0,0,499,497,1,0,0,0,499,500,
	1,0,0,0,500,502,1,0,0,0,501,499,1,0,0,0,502,503,5,6,0,0,503,37,1,0,0,0,
	504,506,5,46,0,0,505,504,1,0,0,0,505,506,1,0,0,0,506,507,1,0,0,0,507,508,
	5,47,0,0,508,510,5,176,0,0,509,511,3,104,52,0,510,509,1,0,0,0,510,511,1,
	0,0,0,511,521,1,0,0,0,512,513,5,42,0,0,513,518,3,40,20,0,514,515,5,5,0,
	0,515,517,3,40,20,0,516,514,1,0,0,0,517,520,1,0,0,0,518,516,1,0,0,0,518,
	519,1,0,0,0,519,522,1,0,0,0,520,518,1,0,0,0,521,512,1,0,0,0,521,522,1,0,
	0,0,522,523,1,0,0,0,523,540,5,4,0,0,524,539,3,56,28,0,525,539,3,52,26,0,
	526,539,3,60,30,0,527,539,3,44,22,0,528,539,3,48,24,0,529,539,3,62,31,0,
	530,539,3,8,4,0,531,539,3,74,37,0,532,539,3,84,42,0,533,539,3,64,32,0,534,
	539,3,90,45,0,535,539,3,42,21,0,536,539,3,66,33,0,537,539,3,70,35,0,538,
	524,1,0,0,0,538,525,1,0,0,0,538,526,1,0,0,0,538,527,1,0,0,0,538,528,1,0,
	0,0,538,529,1,0,0,0,538,530,1,0,0,0,538,531,1,0,0,0,538,532,1,0,0,0,538,
	533,1,0,0,0,538,534,1,0,0,0,538,535,1,0,0,0,538,536,1,0,0,0,538,537,1,0,
	0,0,539,542,1,0,0,0,540,538,1,0,0,0,540,541,1,0,0,0,541,543,1,0,0,0,542,
	540,1,0,0,0,543,544,5,6,0,0,544,39,1,0,0,0,545,547,5,176,0,0,546,548,3,
	214,107,0,547,546,1,0,0,0,547,548,1,0,0,0,548,41,1,0,0,0,549,550,5,7,0,
	0,550,551,3,14,7,0,551,555,3,104,52,0,552,554,3,94,47,0,553,552,1,0,0,0,
	554,557,1,0,0,0,555,553,1,0,0,0,555,556,1,0,0,0,556,561,1,0,0,0,557,555,
	1,0,0,0,558,560,3,92,46,0,559,558,1,0,0,0,560,563,1,0,0,0,561,559,1,0,0,
	0,561,562,1,0,0,0,562,565,1,0,0,0,563,561,1,0,0,0,564,566,3,100,50,0,565,
	564,1,0,0,0,565,566,1,0,0,0,566,567,1,0,0,0,567,568,5,2,0,0,568,43,1,0,
	0,0,569,570,5,48,0,0,570,571,5,176,0,0,571,583,5,49,0,0,572,577,3,46,23,
	0,573,574,5,5,0,0,574,576,3,46,23,0,575,573,1,0,0,0,576,579,1,0,0,0,577,
	575,1,0,0,0,577,578,1,0,0,0,578,581,1,0,0,0,579,577,1,0,0,0,580,582,5,5,
	0,0,581,580,1,0,0,0,581,582,1,0,0,0,582,584,1,0,0,0,583,572,1,0,0,0,583,
	584,1,0,0,0,584,585,1,0,0,0,585,587,5,50,0,0,586,588,5,51,0,0,587,586,1,
	0,0,0,587,588,1,0,0,0,588,589,1,0,0,0,589,590,5,2,0,0,590,45,1,0,0,0,591,
	594,3,234,117,0,592,594,3,82,41,0,593,591,1,0,0,0,593,592,1,0,0,0,594,596,
	1,0,0,0,595,597,5,52,0,0,596,595,1,0,0,0,596,597,1,0,0,0,597,598,1,0,0,
	0,598,599,5,176,0,0,599,47,1,0,0,0,600,601,5,35,0,0,601,602,5,176,0,0,602,
	614,5,49,0,0,603,608,3,50,25,0,604,605,5,5,0,0,605,607,3,50,25,0,606,604,
	1,0,0,0,607,610,1,0,0,0,608,606,1,0,0,0,608,609,1,0,0,0,609,612,1,0,0,0,
	610,608,1,0,0,0,611,613,5,5,0,0,612,611,1,0,0,0,612,613,1,0,0,0,613,615,
	1,0,0,0,614,603,1,0,0,0,614,615,1,0,0,0,615,616,1,0,0,0,616,617,5,50,0,
	0,617,618,5,2,0,0,618,49,1,0,0,0,619,620,3,234,117,0,620,621,5,176,0,0,
	621,51,1,0,0,0,622,623,5,53,0,0,623,624,5,176,0,0,624,626,5,4,0,0,625,627,
	3,54,27,0,626,625,1,0,0,0,627,628,1,0,0,0,628,626,1,0,0,0,628,629,1,0,0,
	0,629,630,1,0,0,0,630,631,5,6,0,0,631,53,1,0,0,0,632,636,3,234,117,0,633,
	636,3,82,41,0,634,636,3,80,40,0,635,632,1,0,0,0,635,633,1,0,0,0,635,634,
	1,0,0,0,636,637,1,0,0,0,637,638,3,14,7,0,638,639,5,2,0,0,639,55,1,0,0,0,
	640,641,5,54,0,0,641,642,5,176,0,0,642,643,5,4,0,0,643,648,3,58,29,0,644,
	645,5,5,0,0,645,647,3,58,29,0,646,644,1,0,0,0,647,650,1,0,0,0,648,646,1,
	0,0,0,648,649,1,0,0,0,649,652,1,0,0,0,650,648,1,0,0,0,651,653,5,5,0,0,652,
	651,1,0,0,0,652,653,1,0,0,0,653,654,1,0,0,0,654,655,5,6,0,0,655,57,1,0,
	0,0,656,659,5,176,0,0,657,658,5,40,0,0,658,660,5,158,0,0,659,657,1,0,0,
	0,659,660,1,0,0,0,660,59,1,0,0,0,661,662,5,55,0,0,662,663,5,176,0,0,663,
	664,5,42,0,0,664,665,3,234,117,0,665,666,5,2,0,0,666,61,1,0,0,0,667,668,
	3,234,117,0,668,669,5,56,0,0,669,670,5,176,0,0,670,671,5,40,0,0,671,672,
	3,222,111,0,672,673,5,2,0,0,673,63,1,0,0,0,674,675,5,57,0,0,675,679,3,104,
	52,0,676,678,7,5,0,0,677,676,1,0,0,0,678,681,1,0,0,0,679,677,1,0,0,0,679,
	680,1,0,0,0,680,685,1,0,0,0,681,679,1,0,0,0,682,684,3,72,36,0,683,682,1,
	0,0,0,684,687,1,0,0,0,685,683,1,0,0,0,685,686,1,0,0,0,686,688,1,0,0,0,687,
	685,1,0,0,0,688,692,5,4,0,0,689,691,3,110,55,0,690,689,1,0,0,0,691,694,
	1,0,0,0,692,690,1,0,0,0,692,693,1,0,0,0,693,695,1,0,0,0,694,692,1,0,0,0,
	695,696,5,6,0,0,696,65,1,0,0,0,697,698,5,60,0,0,698,699,3,104,52,0,699,
	703,5,44,0,0,700,702,3,68,34,0,701,700,1,0,0,0,702,705,1,0,0,0,703,701,
	1,0,0,0,703,704,1,0,0,0,704,709,1,0,0,0,705,703,1,0,0,0,706,708,3,92,46,
	0,707,706,1,0,0,0,708,711,1,0,0,0,709,707,1,0,0,0,709,710,1,0,0,0,710,712,
	1,0,0,0,711,709,1,0,0,0,712,716,5,4,0,0,713,715,3,110,55,0,714,713,1,0,
	0,0,715,718,1,0,0,0,716,714,1,0,0,0,716,717,1,0,0,0,717,719,1,0,0,0,718,
	716,1,0,0,0,719,720,5,6,0,0,720,67,1,0,0,0,721,725,5,59,0,0,722,725,5,61,
	0,0,723,725,3,96,48,0,724,721,1,0,0,0,724,722,1,0,0,0,724,723,1,0,0,0,725,
	69,1,0,0,0,726,727,5,62,0,0,727,728,5,49,0,0,728,729,5,50,0,0,729,730,5,
	44,0,0,730,731,5,59,0,0,731,735,5,4,0,0,732,734,3,110,55,0,733,732,1,0,
	0,0,734,737,1,0,0,0,735,733,1,0,0,0,735,736,1,0,0,0,736,738,1,0,0,0,737,
	735,1,0,0,0,738,739,5,6,0,0,739,71,1,0,0,0,740,741,5,176,0,0,741,742,3,
	214,107,0,742,73,1,0,0,0,743,745,3,78,39,0,744,743,1,0,0,0,744,745,1,0,
	0,0,745,746,1,0,0,0,746,750,3,234,117,0,747,749,3,226,113,0,748,747,1,0,
	0,0,749,752,1,0,0,0,750,748,1,0,0,0,750,751,1,0,0,0,751,753,1,0,0,0,752,
	750,1,0,0,0,753,756,5,176,0,0,754,755,5,40,0,0,755,757,3,222,111,0,756,
	754,1,0,0,0,756,757,1,0,0,0,757,758,1,0,0,0,758,759,5,2,0,0,759,806,1,0,
	0,0,760,761,3,234,117,0,761,765,3,78,39,0,762,764,3,226,113,0,763,762,1,
	0,0,0,764,767,1,0,0,0,765,763,1,0,0,0,765,766,1,0,0,0,766,768,1,0,0,0,767,
	765,1,0,0,0,768,771,5,176,0,0,769,770,5,40,0,0,770,772,3,222,111,0,771,
	769,1,0,0,0,771,772,1,0,0,0,772,773,1,0,0,0,773,774,5,2,0,0,774,806,1,0,
	0,0,775,777,3,78,39,0,776,775,1,0,0,0,776,777,1,0,0,0,777,778,1,0,0,0,778,
	782,3,80,40,0,779,781,3,76,38,0,780,779,1,0,0,0,781,784,1,0,0,0,782,780,
	1,0,0,0,782,783,1,0,0,0,783,785,1,0,0,0,784,782,1,0,0,0,785,786,5,176,0,
	0,786,787,5,2,0,0,787,806,1,0,0,0,788,790,3,78,39,0,789,788,1,0,0,0,789,
	790,1,0,0,0,790,791,1,0,0,0,791,795,3,82,41,0,792,794,3,76,38,0,793,792,
	1,0,0,0,794,797,1,0,0,0,795,793,1,0,0,0,795,796,1,0,0,0,796,798,1,0,0,0,
	797,795,1,0,0,0,798,801,5,176,0,0,799,800,5,40,0,0,800,802,3,222,111,0,
	801,799,1,0,0,0,801,802,1,0,0,0,802,803,1,0,0,0,803,804,5,2,0,0,804,806,
	1,0,0,0,805,744,1,0,0,0,805,760,1,0,0,0,805,776,1,0,0,0,805,789,1,0,0,0,
	806,75,1,0,0,0,807,810,3,226,113,0,808,810,3,78,39,0,809,807,1,0,0,0,809,
	808,1,0,0,0,810,77,1,0,0,0,811,812,7,6,0,0,812,79,1,0,0,0,813,814,5,64,
	0,0,814,815,5,49,0,0,815,817,3,234,117,0,816,818,5,176,0,0,817,816,1,0,
	0,0,817,818,1,0,0,0,818,819,1,0,0,0,819,820,5,65,0,0,820,822,3,234,117,
	0,821,823,5,176,0,0,822,821,1,0,0,0,822,823,1,0,0,0,823,824,1,0,0,0,824,
	825,5,50,0,0,825,850,1,0,0,0,826,827,5,64,0,0,827,828,5,49,0,0,828,830,
	3,234,117,0,829,831,5,176,0,0,830,829,1,0,0,0,830,831,1,0,0,0,831,832,1,
	0,0,0,832,833,5,65,0,0,833,834,3,80,40,0,834,835,5,50,0,0,835,850,1,0,0,
	0,836,837,5,64,0,0,837,838,5,49,0,0,838,840,3,234,117,0,839,841,5,176,0,
	0,840,839,1,0,0,0,840,841,1,0,0,0,841,842,1,0,0,0,842,843,5,65,0,0,843,
	845,3,82,41,0,844,846,5,176,0,0,845,844,1,0,0,0,845,846,1,0,0,0,846,847,
	1,0,0,0,847,848,5,50,0,0,848,850,1,0,0,0,849,813,1,0,0,0,849,826,1,0,0,
	0,849,836,1,0,0,0,850,81,1,0,0,0,851,852,6,41,-1,0,852,853,3,234,117,0,
	853,854,5,66,0,0,854,855,7,7,0,0,855,856,5,67,0,0,856,862,1,0,0,0,857,858,
	3,234,117,0,858,859,5,66,0,0,859,860,5,67,0,0,860,862,1,0,0,0,861,851,1,
	0,0,0,861,857,1,0,0,0,862,872,1,0,0,0,863,864,10,2,0,0,864,865,5,66,0,0,
	865,866,7,7,0,0,866,871,5,67,0,0,867,868,10,1,0,0,868,869,5,66,0,0,869,
	871,5,67,0,0,870,863,1,0,0,0,870,867,1,0,0,0,871,874,1,0,0,0,872,870,1,
	0,0,0,872,873,1,0,0,0,873,83,1,0,0,0,874,872,1,0,0,0,875,876,5,68,0,0,876,
	878,5,176,0,0,877,879,3,104,52,0,878,877,1,0,0,0,878,879,1,0,0,0,879,880,
	1,0,0,0,880,884,5,4,0,0,881,883,3,86,43,0,882,881,1,0,0,0,883,886,1,0,0,
	0,884,882,1,0,0,0,884,885,1,0,0,0,885,887,1,0,0,0,886,884,1,0,0,0,887,888,
	5,6,0,0,888,85,1,0,0,0,889,892,3,88,44,0,890,892,3,110,55,0,891,889,1,0,
	0,0,891,890,1,0,0,0,892,87,1,0,0,0,893,894,5,69,0,0,894,895,5,2,0,0,895,
	89,1,0,0,0,896,897,5,7,0,0,897,898,3,14,7,0,898,902,3,104,52,0,899,901,
	3,94,47,0,900,899,1,0,0,0,901,904,1,0,0,0,902,900,1,0,0,0,902,903,1,0,0,
	0,903,908,1,0,0,0,904,902,1,0,0,0,905,907,3,92,46,0,906,905,1,0,0,0,907,
	910,1,0,0,0,908,906,1,0,0,0,908,909,1,0,0,0,909,912,1,0,0,0,910,908,1,0,
	0,0,911,913,3,100,50,0,912,911,1,0,0,0,912,913,1,0,0,0,913,914,1,0,0,0,
	914,918,5,4,0,0,915,917,3,110,55,0,916,915,1,0,0,0,917,920,1,0,0,0,918,
	916,1,0,0,0,918,919,1,0,0,0,919,921,1,0,0,0,920,918,1,0,0,0,921,922,5,6,
	0,0,922,91,1,0,0,0,923,925,5,176,0,0,924,926,3,214,107,0,925,924,1,0,0,
	0,925,926,1,0,0,0,926,93,1,0,0,0,927,942,5,70,0,0,928,942,5,71,0,0,929,
	942,5,58,0,0,930,942,5,44,0,0,931,942,5,43,0,0,932,942,5,63,0,0,933,942,
	5,59,0,0,934,942,3,96,48,0,935,942,5,61,0,0,936,942,3,98,49,0,937,942,5,
	30,0,0,938,942,5,28,0,0,939,942,5,31,0,0,940,942,5,29,0,0,941,927,1,0,0,
	0,941,928,1,0,0,0,941,929,1,0,0,0,941,930,1,0,0,0,941,931,1,0,0,0,941,932,
	1,0,0,0,941,933,1,0,0,0,941,934,1,0,0,0,941,935,1,0,0,0,941,936,1,0,0,0,
	941,937,1,0,0,0,941,938,1,0,0,0,941,939,1,0,0,0,941,940,1,0,0,0,942,95,
	1,0,0,0,943,954,5,72,0,0,944,945,5,49,0,0,945,950,5,176,0,0,946,947,5,5,
	0,0,947,949,5,176,0,0,948,946,1,0,0,0,949,952,1,0,0,0,950,948,1,0,0,0,950,
	951,1,0,0,0,951,953,1,0,0,0,952,950,1,0,0,0,953,955,5,50,0,0,954,944,1,
	0,0,0,954,955,1,0,0,0,955,97,1,0,0,0,956,960,5,32,0,0,957,958,5,49,0,0,
	958,959,5,158,0,0,959,961,5,50,0,0,960,957,1,0,0,0,960,961,1,0,0,0,961,
	99,1,0,0,0,962,963,5,73,0,0,963,964,5,49,0,0,964,969,3,102,51,0,965,966,
	5,5,0,0,966,968,3,102,51,0,967,965,1,0,0,0,968,971,1,0,0,0,969,967,1,0,
	0,0,969,970,1,0,0,0,970,973,1,0,0,0,971,969,1,0,0,0,972,974,5,5,0,0,973,
	972,1,0,0,0,973,974,1,0,0,0,974,975,1,0,0,0,975,976,5,50,0,0,976,101,1,
	0,0,0,977,981,3,234,117,0,978,980,3,226,113,0,979,978,1,0,0,0,980,983,1,
	0,0,0,981,979,1,0,0,0,981,982,1,0,0,0,982,985,1,0,0,0,983,981,1,0,0,0,984,
	986,3,14,7,0,985,984,1,0,0,0,985,986,1,0,0,0,986,998,1,0,0,0,987,991,3,
	82,41,0,988,990,3,226,113,0,989,988,1,0,0,0,990,993,1,0,0,0,991,989,1,0,
	0,0,991,992,1,0,0,0,992,995,1,0,0,0,993,991,1,0,0,0,994,996,3,14,7,0,995,
	994,1,0,0,0,995,996,1,0,0,0,996,998,1,0,0,0,997,977,1,0,0,0,997,987,1,0,
	0,0,998,103,1,0,0,0,999,1011,5,49,0,0,1000,1005,3,106,53,0,1001,1002,5,
	5,0,0,1002,1004,3,106,53,0,1003,1001,1,0,0,0,1004,1007,1,0,0,0,1005,1003,
	1,0,0,0,1005,1006,1,0,0,0,1006,1009,1,0,0,0,1007,1005,1,0,0,0,1008,1010,
	5,5,0,0,1009,1008,1,0,0,0,1009,1010,1,0,0,0,1010,1012,1,0,0,0,1011,1000,
	1,0,0,0,1011,1012,1,0,0,0,1012,1013,1,0,0,0,1013,1014,5,50,0,0,1014,105,
	1,0,0,0,1015,1019,3,234,117,0,1016,1018,3,226,113,0,1017,1016,1,0,0,0,1018,
	1021,1,0,0,0,1019,1017,1,0,0,0,1019,1020,1,0,0,0,1020,1023,1,0,0,0,1021,
	1019,1,0,0,0,1022,1024,3,14,7,0,1023,1022,1,0,0,0,1023,1024,1,0,0,0,1024,
	1046,1,0,0,0,1025,1029,3,82,41,0,1026,1028,3,226,113,0,1027,1026,1,0,0,
	0,1028,1031,1,0,0,0,1029,1027,1,0,0,0,1029,1030,1,0,0,0,1030,1033,1,0,0,
	0,1031,1029,1,0,0,0,1032,1034,3,14,7,0,1033,1032,1,0,0,0,1033,1034,1,0,
	0,0,1034,1046,1,0,0,0,1035,1039,3,80,40,0,1036,1038,3,226,113,0,1037,1036,
	1,0,0,0,1038,1041,1,0,0,0,1039,1037,1,0,0,0,1039,1040,1,0,0,0,1040,1043,
	1,0,0,0,1041,1039,1,0,0,0,1042,1044,3,14,7,0,1043,1042,1,0,0,0,1043,1044,
	1,0,0,0,1044,1046,1,0,0,0,1045,1015,1,0,0,0,1045,1025,1,0,0,0,1045,1035,
	1,0,0,0,1046,107,1,0,0,0,1047,1051,5,4,0,0,1048,1050,3,110,55,0,1049,1048,
	1,0,0,0,1050,1053,1,0,0,0,1051,1049,1,0,0,0,1051,1052,1,0,0,0,1052,1054,
	1,0,0,0,1053,1051,1,0,0,0,1054,1057,5,6,0,0,1055,1057,3,110,55,0,1056,1047,
	1,0,0,0,1056,1055,1,0,0,0,1057,109,1,0,0,0,1058,1090,3,130,65,0,1059,1090,
	3,132,66,0,1060,1090,3,138,69,0,1061,1090,3,140,70,0,1062,1090,3,142,71,
	0,1063,1090,3,144,72,0,1064,1090,3,146,73,0,1065,1090,3,136,68,0,1066,1090,
	3,126,63,0,1067,1090,3,128,64,0,1068,1090,3,150,75,0,1069,1090,3,152,76,
	0,1070,1090,3,154,77,0,1071,1090,3,156,78,0,1072,1090,3,176,88,0,1073,1090,
	3,124,62,0,1074,1090,3,112,56,0,1075,1090,3,114,57,0,1076,1090,3,116,58,
	0,1077,1090,3,118,59,0,1078,1090,3,120,60,0,1079,1090,3,122,61,0,1080,1090,
	3,178,89,0,1081,1090,3,190,95,0,1082,1090,3,202,101,0,1083,1090,3,204,102,
	0,1084,1090,3,148,74,0,1085,1090,3,182,91,0,1086,1090,3,184,92,0,1087,1090,
	3,196,98,0,1088,1090,3,198,99,0,1089,1058,1,0,0,0,1089,1059,1,0,0,0,1089,
	1060,1,0,0,0,1089,1061,1,0,0,0,1089,1062,1,0,0,0,1089,1063,1,0,0,0,1089,
	1064,1,0,0,0,1089,1065,1,0,0,0,1089,1066,1,0,0,0,1089,1067,1,0,0,0,1089,
	1068,1,0,0,0,1089,1069,1,0,0,0,1089,1070,1,0,0,0,1089,1071,1,0,0,0,1089,
	1072,1,0,0,0,1089,1073,1,0,0,0,1089,1074,1,0,0,0,1089,1075,1,0,0,0,1089,
	1076,1,0,0,0,1089,1077,1,0,0,0,1089,1078,1,0,0,0,1089,1079,1,0,0,0,1089,
	1080,1,0,0,0,1089,1081,1,0,0,0,1089,1082,1,0,0,0,1089,1083,1,0,0,0,1089,
	1084,1,0,0,0,1089,1085,1,0,0,0,1089,1086,1,0,0,0,1089,1087,1,0,0,0,1089,
	1088,1,0,0,0,1090,111,1,0,0,0,1091,1092,5,74,0,0,1092,1093,5,12,0,0,1093,
	1094,5,176,0,0,1094,1095,5,49,0,0,1095,1096,3,222,111,0,1096,1097,5,5,0,
	0,1097,1098,3,222,111,0,1098,1099,5,50,0,0,1099,1100,5,2,0,0,1100,113,1,
	0,0,0,1101,1102,5,74,0,0,1102,1103,5,12,0,0,1103,1104,5,176,0,0,1104,1105,
	5,66,0,0,1105,1106,3,222,111,0,1106,1107,5,67,0,0,1107,1108,5,12,0,0,1108,
	1109,5,176,0,0,1109,1110,5,49,0,0,1110,1115,3,222,111,0,1111,1112,5,5,0,
	0,1112,1114,3,222,111,0,1113,1111,1,0,0,0,1114,1117,1,0,0,0,1115,1113,1,
	0,0,0,1115,1116,1,0,0,0,1116,1118,1,0,0,0,1117,1115,1,0,0,0,1118,1119,5,
	50,0,0,1119,1120,5,2,0,0,1120,115,1,0,0,0,1121,1122,5,75,0,0,1122,1151,
	5,2,0,0,1123,1124,5,75,0,0,1124,1129,3,222,111,0,1125,1126,5,5,0,0,1126,
	1128,3,222,111,0,1127,1125,1,0,0,0,1128,1131,1,0,0,0,1129,1127,1,0,0,0,
	1129,1130,1,0,0,0,1130,1132,1,0,0,0,1131,1129,1,0,0,0,1132,1133,5,2,0,0,
	1133,1151,1,0,0,0,1134,1135,5,75,0,0,1135,1136,5,49,0,0,1136,1141,3,222,
	111,0,1137,1138,5,5,0,0,1138,1140,3,222,111,0,1139,1137,1,0,0,0,1140,1143,
	1,0,0,0,1141,1139,1,0,0,0,1141,1142,1,0,0,0,1142,1145,1,0,0,0,1143,1141,
	1,0,0,0,1144,1146,5,5,0,0,1145,1144,1,0,0,0,1145,1146,1,0,0,0,1146,1147,
	1,0,0,0,1147,1148,5,50,0,0,1148,1149,5,2,0,0,1149,1151,1,0,0,0,1150,1121,
	1,0,0,0,1150,1123,1,0,0,0,1150,1134,1,0,0,0,1151,117,1,0,0,0,1152,1155,
	5,176,0,0,1153,1154,5,12,0,0,1154,1156,5,176,0,0,1155,1153,1,0,0,0,1155,
	1156,1,0,0,0,1156,1157,1,0,0,0,1157,1158,5,49,0,0,1158,1170,5,4,0,0,1159,
	1164,3,212,106,0,1160,1161,5,5,0,0,1161,1163,3,212,106,0,1162,1160,1,0,
	0,0,1163,1166,1,0,0,0,1164,1162,1,0,0,0,1164,1165,1,0,0,0,1165,1168,1,0,
	0,0,1166,1164,1,0,0,0,1167,1169,5,5,0,0,1168,1167,1,0,0,0,1168,1169,1,0,
	0,0,1169,1171,1,0,0,0,1170,1159,1,0,0,0,1170,1171,1,0,0,0,1171,1172,1,0,
	0,0,1172,1173,5,6,0,0,1173,1174,5,50,0,0,1174,1198,5,2,0,0,1175,1176,5,
	176,0,0,1176,1177,3,214,107,0,1177,1178,5,2,0,0,1178,1198,1,0,0,0,1179,
	1180,5,176,0,0,1180,1181,5,12,0,0,1181,1182,5,176,0,0,1182,1183,3,214,107,
	0,1183,1184,5,2,0,0,1184,1198,1,0,0,0,1185,1186,5,176,0,0,1186,1187,3,214,
	107,0,1187,1188,5,12,0,0,1188,1189,5,176,0,0,1189,1190,5,12,0,0,1190,1192,
	5,176,0,0,1191,1193,3,216,108,0,1192,1191,1,0,0,0,1192,1193,1,0,0,0,1193,
	1194,1,0,0,0,1194,1195,3,214,107,0,1195,1196,5,2,0,0,1196,1198,1,0,0,0,
	1197,1152,1,0,0,0,1197,1175,1,0,0,0,1197,1179,1,0,0,0,1197,1185,1,0,0,0,
	1198,119,1,0,0,0,1199,1200,3,222,111,0,1200,1201,5,12,0,0,1201,1203,5,176,
	0,0,1202,1204,3,216,108,0,1203,1202,1,0,0,0,1203,1204,1,0,0,0,1204,1205,
	1,0,0,0,1205,1206,3,214,107,0,1206,1207,5,2,0,0,1207,121,1,0,0,0,1208,1209,
	5,31,0,0,1209,1210,5,49,0,0,1210,1211,3,222,111,0,1211,1212,5,50,0,0,1212,
	1213,5,2,0,0,1213,123,1,0,0,0,1214,1215,5,76,0,0,1215,1218,5,176,0,0,1216,
	1217,5,12,0,0,1217,1219,5,176,0,0,1218,1216,1,0,0,0,1218,1219,1,0,0,0,1219,
	1220,1,0,0,0,1220,1221,5,49,0,0,1221,1233,5,4,0,0,1222,1227,3,212,106,0,
	1223,1224,5,5,0,0,1224,1226,3,212,106,0,1225,1223,1,0,0,0,1226,1229,1,0,
	0,0,1227,1225,1,0,0,0,1227,1228,1,0,0,0,1228,1231,1,0,0,0,1229,1227,1,0,
	0,0,1230,1232,5,5,0,0,1231,1230,1,0,0,0,1231,1232,1,0,0,0,1232,1234,1,0,
	0,0,1233,1222,1,0,0,0,1233,1234,1,0,0,0,1234,1235,1,0,0,0,1235,1236,5,6,
	0,0,1236,1237,5,50,0,0,1237,1248,5,2,0,0,1238,1239,5,76,0,0,1239,1242,5,
	176,0,0,1240,1241,5,12,0,0,1241,1243,5,176,0,0,1242,1240,1,0,0,0,1242,1243,
	1,0,0,0,1243,1244,1,0,0,0,1244,1245,3,214,107,0,1245,1246,5,2,0,0,1246,
	1248,1,0,0,0,1247,1214,1,0,0,0,1247,1238,1,0,0,0,1248,125,1,0,0,0,1249,
	1250,5,74,0,0,1250,1251,5,12,0,0,1251,1260,5,176,0,0,1252,1253,5,66,0,0,
	1253,1254,3,222,111,0,1254,1255,5,67,0,0,1255,1257,1,0,0,0,1256,1252,1,
	0,0,0,1257,1258,1,0,0,0,1258,1256,1,0,0,0,1258,1259,1,0,0,0,1259,1261,1,
	0,0,0,1260,1256,1,0,0,0,1260,1261,1,0,0,0,1261,1266,1,0,0,0,1262,1263,5,
	12,0,0,1263,1265,5,176,0,0,1264,1262,1,0,0,0,1265,1268,1,0,0,0,1266,1264,
	1,0,0,0,1266,1267,1,0,0,0,1267,1269,1,0,0,0,1268,1266,1,0,0,0,1269,1270,
	7,8,0,0,1270,1271,3,222,111,0,1271,1272,5,2,0,0,1272,1374,1,0,0,0,1273,
	1278,5,176,0,0,1274,1275,5,66,0,0,1275,1276,3,222,111,0,1276,1277,5,67,
	0,0,1277,1279,1,0,0,0,1278,1274,1,0,0,0,1279,1280,1,0,0,0,1280,1278,1,0,
	0,0,1280,1281,1,0,0,0,1281,1286,1,0,0,0,1282,1283,5,12,0,0,1283,1285,5,
	176,0,0,1284,1282,1,0,0,0,1285,1288,1,0,0,0,1286,1284,1,0,0,0,1286,1287,
	1,0,0,0,1287,1289,1,0,0,0,1288,1286,1,0,0,0,1289,1290,7,8,0,0,1290,1291,
	3,222,111,0,1291,1292,5,2,0,0,1292,1374,1,0,0,0,1293,1296,5,176,0,0,1294,
	1295,5,12,0,0,1295,1297,5,176,0,0,1296,1294,1,0,0,0,1297,1298,1,0,0,0,1298,
	1296,1,0,0,0,1298,1299,1,0,0,0,1299,1300,1,0,0,0,1300,1301,7,8,0,0,1301,
	1302,3,222,111,0,1302,1303,5,2,0,0,1303,1374,1,0,0,0,1304,1307,5,176,0,
	0,1305,1306,5,12,0,0,1306,1308,5,176,0,0,1307,1305,1,0,0,0,1308,1309,1,
	0,0,0,1309,1307,1,0,0,0,1309,1310,1,0,0,0,1310,1315,1,0,0,0,1311,1312,5,
	66,0,0,1312,1313,3,222,111,0,1313,1314,5,67,0,0,1314,1316,1,0,0,0,1315,
	1311,1,0,0,0,1316,1317,1,0,0,0,1317,1315,1,0,0,0,1317,1318,1,0,0,0,1318,
	1319,1,0,0,0,1319,1320,7,8,0,0,1320,1321,3,222,111,0,1321,1322,5,2,0,0,
	1322,1374,1,0,0,0,1323,1324,5,74,0,0,1324,1325,5,12,0,0,1325,1334,5,176,
	0,0,1326,1327,5,66,0,0,1327,1328,3,222,111,0,1328,1329,5,67,0,0,1329,1331,
	1,0,0,0,1330,1326,1,0,0,0,1331,1332,1,0,0,0,1332,1330,1,0,0,0,1332,1333,
	1,0,0,0,1333,1335,1,0,0,0,1334,1330,1,0,0,0,1334,1335,1,0,0,0,1335,1340,
	1,0,0,0,1336,1337,5,12,0,0,1337,1339,5,176,0,0,1338,1336,1,0,0,0,1339,1342,
	1,0,0,0,1340,1338,1,0,0,0,1340,1341,1,0,0,0,1341,1343,1,0,0,0,1342,1340,
	1,0,0,0,1343,1344,7,9,0,0,1344,1374,5,2,0,0,1345,1350,5,176,0,0,1346,1347,
	5,66,0,0,1347,1348,3,222,111,0,1348,1349,5,67,0,0,1349,1351,1,0,0,0,1350,
	1346,1,0,0,0,1351,1352,1,0,0,0,1352,1350,1,0,0,0,1352,1353,1,0,0,0,1353,
	1358,1,0,0,0,1354,1355,5,12,0,0,1355,1357,5,176,0,0,1356,1354,1,0,0,0,1357,
	1360,1,0,0,0,1358,1356,1,0,0,0,1358,1359,1,0,0,0,1359,1361,1,0,0,0,1360,
	1358,1,0,0,0,1361,1362,7,9,0,0,1362,1363,5,2,0,0,1363,1374,1,0,0,0,1364,
	1367,5,176,0,0,1365,1366,5,12,0,0,1366,1368,5,176,0,0,1367,1365,1,0,0,0,
	1368,1369,1,0,0,0,1369,1367,1,0,0,0,1369,1370,1,0,0,0,1370,1371,1,0,0,0,
	1371,1372,7,9,0,0,1372,1374,5,2,0,0,1373,1249,1,0,0,0,1373,1273,1,0,0,0,
	1373,1293,1,0,0,0,1373,1304,1,0,0,0,1373,1323,1,0,0,0,1373,1345,1,0,0,0,
	1373,1364,1,0,0,0,1374,127,1,0,0,0,1375,1376,5,74,0,0,1376,1377,5,12,0,
	0,1377,1384,5,176,0,0,1378,1379,5,66,0,0,1379,1380,3,222,111,0,1380,1381,
	5,67,0,0,1381,1383,1,0,0,0,1382,1378,1,0,0,0,1383,1386,1,0,0,0,1384,1382,
	1,0,0,0,1384,1385,1,0,0,0,1385,1387,1,0,0,0,1386,1384,1,0,0,0,1387,1388,
	5,89,0,0,1388,1389,5,49,0,0,1389,1390,3,222,111,0,1390,1391,5,50,0,0,1391,
	1392,5,2,0,0,1392,129,1,0,0,0,1393,1397,3,234,117,0,1394,1396,3,226,113,
	0,1395,1394,1,0,0,0,1396,1399,1,0,0,0,1397,1395,1,0,0,0,1397,1398,1,0,0,
	0,1398,1400,1,0,0,0,1399,1397,1,0,0,0,1400,1403,3,14,7,0,1401,1402,5,40,
	0,0,1402,1404,3,222,111,0,1403,1401,1,0,0,0,1403,1404,1,0,0,0,1404,1405,
	1,0,0,0,1405,1406,5,2,0,0,1406,1422,1,0,0,0,1407,1411,3,82,41,0,1408,1410,
	3,226,113,0,1409,1408,1,0,0,0,1410,1413,1,0,0,0,1411,1409,1,0,0,0,1411,
	1412,1,0,0,0,1412,1414,1,0,0,0,1413,1411,1,0,0,0,1414,1417,3,14,7,0,1415,
	1416,5,40,0,0,1416,1418,3,222,111,0,1417,1415,1,0,0,0,1417,1418,1,0,0,0,
	1418,1419,1,0,0,0,1419,1420,5,2,0,0,1420,1422,1,0,0,0,1421,1393,1,0,0,0,
	1421,1407,1,0,0,0,1422,131,1,0,0,0,1423,1424,3,234,117,0,1424,1429,5,176,
	0,0,1425,1426,5,5,0,0,1426,1427,3,234,117,0,1427,1428,5,176,0,0,1428,1430,
	1,0,0,0,1429,1425,1,0,0,0,1430,1431,1,0,0,0,1431,1429,1,0,0,0,1431,1432,
	1,0,0,0,1432,1433,1,0,0,0,1433,1434,5,40,0,0,1434,1435,3,222,111,0,1435,
	1436,5,2,0,0,1436,1472,1,0,0,0,1437,1438,5,49,0,0,1438,1441,3,134,67,0,
	1439,1440,5,5,0,0,1440,1442,3,134,67,0,1441,1439,1,0,0,0,1442,1443,1,0,
	0,0,1443,1441,1,0,0,0,1443,1444,1,0,0,0,1444,1445,1,0,0,0,1445,1446,5,50,
	0,0,1446,1447,5,40,0,0,1447,1448,5,49,0,0,1448,1451,3,222,111,0,1449,1450,
	5,5,0,0,1450,1452,3,222,111,0,1451,1449,1,0,0,0,1452,1453,1,0,0,0,1453,
	1451,1,0,0,0,1453,1454,1,0,0,0,1454,1455,1,0,0,0,1455,1456,5,50,0,0,1456,
	1457,5,2,0,0,1457,1472,1,0,0,0,1458,1459,5,49,0,0,1459,1462,3,134,67,0,
	1460,1461,5,5,0,0,1461,1463,3,134,67,0,1462,1460,1,0,0,0,1463,1464,1,0,
	0,0,1464,1462,1,0,0,0,1464,1465,1,0,0,0,1465,1466,1,0,0,0,1466,1467,5,50,
	0,0,1467,1468,5,40,0,0,1468,1469,3,222,111,0,1469,1470,5,2,0,0,1470,1472,
	1,0,0,0,1471,1423,1,0,0,0,1471,1437,1,0,0,0,1471,1458,1,0,0,0,1472,133,
	1,0,0,0,1473,1477,3,234,117,0,1474,1476,3,226,113,0,1475,1474,1,0,0,0,1476,
	1479,1,0,0,0,1477,1475,1,0,0,0,1477,1478,1,0,0,0,1478,1480,1,0,0,0,1479,
	1477,1,0,0,0,1480,1481,5,176,0,0,1481,1485,1,0,0,0,1482,1485,5,176,0,0,
	1483,1485,1,0,0,0,1484,1473,1,0,0,0,1484,1482,1,0,0,0,1484,1483,1,0,0,0,
	1485,135,1,0,0,0,1486,1487,5,176,0,0,1487,1488,7,8,0,0,1488,1489,3,222,
	111,0,1489,1490,5,2,0,0,1490,1498,1,0,0,0,1491,1492,5,176,0,0,1492,1493,
	7,9,0,0,1493,1498,5,2,0,0,1494,1495,7,9,0,0,1495,1496,5,176,0,0,1496,1498,
	5,2,0,0,1497,1486,1,0,0,0,1497,1491,1,0,0,0,1497,1494,1,0,0,0,1498,137,
	1,0,0,0,1499,1500,5,176,0,0,1500,1501,5,90,0,0,1501,1502,5,49,0,0,1502,
	1503,3,222,111,0,1503,1504,5,50,0,0,1504,1505,5,2,0,0,1505,139,1,0,0,0,
	1506,1507,5,176,0,0,1507,1508,5,91,0,0,1508,1509,5,49,0,0,1509,1510,5,50,
	0,0,1510,1511,5,2,0,0,1511,141,1,0,0,0,1512,1513,5,176,0,0,1513,1514,5,
	89,0,0,1514,1515,5,49,0,0,1515,1516,3,222,111,0,1516,1517,5,50,0,0,1517,
	1518,5,2,0,0,1518,143,1,0,0,0,1519,1520,5,74,0,0,1520,1521,5,12,0,0,1521,
	1522,5,176,0,0,1522,1523,5,90,0,0,1523,1524,5,49,0,0,1524,1525,3,222,111,
	0,1525,1526,5,50,0,0,1526,1527,5,2,0,0,1527,145,1,0,0,0,1528,1529,5,74,
	0,0,1529,1530,5,12,0,0,1530,1531,5,176,0,0,1531,1532,5,91,0,0,1532,1533,
	5,49,0,0,1533,1534,5,50,0,0,1534,1535,5,2,0,0,1535,147,1,0,0,0,1536,1537,
	5,92,0,0,1537,1538,5,176,0,0,1538,1571,5,2,0,0,1539,1540,5,92,0,0,1540,
	1541,5,74,0,0,1541,1542,5,12,0,0,1542,1543,5,176,0,0,1543,1571,5,2,0,0,
	1544,1545,5,92,0,0,1545,1546,5,74,0,0,1546,1547,5,12,0,0,1547,1552,5,176,
	0,0,1548,1549,5,66,0,0,1549,1550,3,222,111,0,1550,1551,5,67,0,0,1551,1553,
	1,0,0,0,1552,1548,1,0,0,0,1553,1554,1,0,0,0,1554,1552,1,0,0,0,1554,1555,
	1,0,0,0,1555,1556,1,0,0,0,1556,1557,5,2,0,0,1557,1571,1,0,0,0,1558,1559,
	5,92,0,0,1559,1564,5,176,0,0,1560,1561,5,66,0,0,1561,1562,3,222,111,0,1562,
	1563,5,67,0,0,1563,1565,1,0,0,0,1564,1560,1,0,0,0,1565,1566,1,0,0,0,1566,
	1564,1,0,0,0,1566,1567,1,0,0,0,1567,1568,1,0,0,0,1568,1569,5,2,0,0,1569,
	1571,1,0,0,0,1570,1536,1,0,0,0,1570,1539,1,0,0,0,1570,1544,1,0,0,0,1570,
	1558,1,0,0,0,1571,149,1,0,0,0,1572,1573,5,93,0,0,1573,1574,5,49,0,0,1574,
	1575,5,167,0,0,1575,1576,5,23,0,0,1576,1579,3,222,111,0,1577,1578,5,5,0,
	0,1578,1580,3,200,100,0,1579,1577,1,0,0,0,1579,1580,1,0,0,0,1580,1581,1,
	0,0,0,1581,1582,5,50,0,0,1582,1583,5,2,0,0,1583,151,1,0,0,0,1584,1585,5,
	93,0,0,1585,1586,5,49,0,0,1586,1589,3,222,111,0,1587,1588,5,5,0,0,1588,
	1590,3,200,100,0,1589,1587,1,0,0,0,1589,1590,1,0,0,0,1590,1591,1,0,0,0,
	1591,1592,5,50,0,0,1592,1593,5,2,0,0,1593,153,1,0,0,0,1594,1595,5,94,0,
	0,1595,1596,5,49,0,0,1596,1597,3,222,111,0,1597,1598,5,50,0,0,1598,1601,
	3,108,54,0,1599,1600,5,95,0,0,1600,1602,3,108,54,0,1601,1599,1,0,0,0,1601,
	1602,1,0,0,0,1602,155,1,0,0,0,1603,1610,3,172,86,0,1604,1610,3,174,87,0,
	1605,1610,3,164,82,0,1606,1610,3,158,79,0,1607,1610,3,160,80,0,1608,1610,
	3,162,81,0,1609,1603,1,0,0,0,1609,1604,1,0,0,0,1609,1605,1,0,0,0,1609,1606,
	1,0,0,0,1609,1607,1,0,0,0,1609,1608,1,0,0,0,1610,157,1,0,0,0,1611,1612,
	5,9,0,0,1612,1613,5,49,0,0,1613,1614,3,234,117,0,1614,1615,5,176,0,0,1615,
	1616,5,5,0,0,1616,1617,3,234,117,0,1617,1618,5,176,0,0,1618,1619,5,96,0,
	0,1619,1620,5,74,0,0,1620,1621,5,12,0,0,1621,1622,5,176,0,0,1622,1623,5,
	12,0,0,1623,1624,5,34,0,0,1624,1625,5,50,0,0,1625,1626,3,108,54,0,1626,
	159,1,0,0,0,1627,1628,5,9,0,0,1628,1629,5,49,0,0,1629,1630,3,234,117,0,
	1630,1631,5,176,0,0,1631,1632,5,97,0,0,1632,1633,5,74,0,0,1633,1634,5,12,
	0,0,1634,1635,5,176,0,0,1635,1636,5,50,0,0,1636,1637,3,108,54,0,1637,161,
	1,0,0,0,1638,1639,5,9,0,0,1639,1640,5,49,0,0,1640,1641,3,234,117,0,1641,
	1642,5,176,0,0,1642,1643,5,96,0,0,1643,1644,5,74,0,0,1644,1645,5,12,0,0,
	1645,1646,5,176,0,0,1646,1647,5,50,0,0,1647,1648,3,108,54,0,1648,163,1,
	0,0,0,1649,1650,5,9,0,0,1650,1651,5,49,0,0,1651,1652,3,166,83,0,1652,1654,
	3,168,84,0,1653,1655,3,170,85,0,1654,1653,1,0,0,0,1654,1655,1,0,0,0,1655,
	1656,1,0,0,0,1656,1657,5,50,0,0,1657,1658,3,108,54,0,1658,165,1,0,0,0,1659,
	1663,3,234,117,0,1660,1662,3,226,113,0,1661,1660,1,0,0,0,1662,1665,1,0,
	0,0,1663,1661,1,0,0,0,1663,1664,1,0,0,0,1664,1666,1,0,0,0,1665,1663,1,0,
	0,0,1666,1669,5,176,0,0,1667,1668,5,40,0,0,1668,1670,3,222,111,0,1669,1667,
	1,0,0,0,1669,1670,1,0,0,0,1670,1671,1,0,0,0,1671,1672,5,2,0,0,1672,167,
	1,0,0,0,1673,1674,3,222,111,0,1674,1675,5,2,0,0,1675,169,1,0,0,0,1676,1677,
	5,176,0,0,1677,1678,7,8,0,0,1678,1682,3,222,111,0,1679,1680,5,176,0,0,1680,
	1682,7,9,0,0,1681,1676,1,0,0,0,1681,1679,1,0,0,0,1682,171,1,0,0,0,1683,
	1684,5,98,0,0,1684,1685,3,108,54,0,1685,1686,5,99,0,0,1686,1687,5,49,0,
	0,1687,1688,3,222,111,0,1688,1689,5,50,0,0,1689,1690,5,2,0,0,1690,173,1,
	0,0,0,1691,1692,5,99,0,0,1692,1693,5,49,0,0,1693,1694,3,222,111,0,1694,
	1695,5,50,0,0,1695,1696,3,108,54,0,1696,175,1,0,0,0,1697,1698,5,100,0,0,
	1698,1699,3,208,104,0,1699,1700,5,2,0,0,1700,177,1,0,0,0,1701,1702,5,101,
	0,0,1702,1706,5,4,0,0,1703,1705,3,180,90,0,1704,1703,1,0,0,0,1705,1708,
	1,0,0,0,1706,1704,1,0,0,0,1706,1707,1,0,0,0,1707,1709,1,0,0,0,1708,1706,
	1,0,0,0,1709,1710,5,6,0,0,1710,179,1,0,0,0,1711,1712,7,10,0,0,1712,181,
	1,0,0,0,1713,1714,5,102,0,0,1714,1718,5,4,0,0,1715,1717,3,110,55,0,1716,
	1715,1,0,0,0,1717,1720,1,0,0,0,1718,1716,1,0,0,0,1718,1719,1,0,0,0,1719,
	1721,1,0,0,0,1720,1718,1,0,0,0,1721,1722,5,6,0,0,1722,183,1,0,0,0,1723,
	1724,5,103,0,0,1724,1725,5,49,0,0,1725,1726,3,222,111,0,1726,1727,5,50,
	0,0,1727,1731,5,4,0,0,1728,1730,3,186,93,0,1729,1728,1,0,0,0,1730,1733,
	1,0,0,0,1731,1729,1,0,0,0,1731,1732,1,0,0,0,1732,1735,1,0,0,0,1733,1731,
	1,0,0,0,1734,1736,3,188,94,0,1735,1734,1,0,0,0,1735,1736,1,0,0,0,1736,1737,
	1,0,0,0,1737,1738,5,6,0,0,1738,185,1,0,0,0,1739,1740,5,104,0,0,1740,1741,
	3,222,111,0,1741,1745,5,105,0,0,1742,1744,3,110,55,0,1743,1742,1,0,0,0,
	1744,1747,1,0,0,0,1745,1743,1,0,0,0,1745,1746,1,0,0,0,1746,187,1,0,0,0,
	1747,1745,1,0,0,0,1748,1749,5,106,0,0,1749,1753,5,105,0,0,1750,1752,3,110,
	55,0,1751,1750,1,0,0,0,1752,1755,1,0,0,0,1753,1751,1,0,0,0,1753,1754,1,
	0,0,0,1754,189,1,0,0,0,1755,1753,1,0,0,0,1756,1757,5,107,0,0,1757,1759,
	3,222,111,0,1758,1760,3,192,96,0,1759,1758,1,0,0,0,1759,1760,1,0,0,0,1760,
	1761,1,0,0,0,1761,1763,3,108,54,0,1762,1764,3,194,97,0,1763,1762,1,0,0,
	0,1764,1765,1,0,0,0,1765,1763,1,0,0,0,1765,1766,1,0,0,0,1766,191,1,0,0,
	0,1767,1768,5,73,0,0,1768,1780,5,49,0,0,1769,1774,3,106,53,0,1770,1771,
	5,5,0,0,1771,1773,3,106,53,0,1772,1770,1,0,0,0,1773,1776,1,0,0,0,1774,1772,
	1,0,0,0,1774,1775,1,0,0,0,1775,1778,1,0,0,0,1776,1774,1,0,0,0,1777,1779,
	5,5,0,0,1778,1777,1,0,0,0,1778,1779,1,0,0,0,1779,1781,1,0,0,0,1780,1769,
	1,0,0,0,1780,1781,1,0,0,0,1781,1782,1,0,0,0,1782,1783,5,50,0,0,1783,193,
	1,0,0,0,1784,1786,5,108,0,0,1785,1787,5,176,0,0,1786,1785,1,0,0,0,1786,
	1787,1,0,0,0,1787,1803,1,0,0,0,1788,1800,5,49,0,0,1789,1794,3,106,53,0,
	1790,1791,5,5,0,0,1791,1793,3,106,53,0,1792,1790,1,0,0,0,1793,1796,1,0,
	0,0,1794,1792,1,0,0,0,1794,1795,1,0,0,0,1795,1798,1,0,0,0,1796,1794,1,0,
	0,0,1797,1799,5,5,0,0,1798,1797,1,0,0,0,1798,1799,1,0,0,0,1799,1801,1,0,
	0,0,1800,1789,1,0,0,0,1800,1801,1,0,0,0,1801,1802,1,0,0,0,1802,1804,5,50,
	0,0,1803,1788,1,0,0,0,1803,1804,1,0,0,0,1804,1805,1,0,0,0,1805,1806,3,108,
	54,0,1806,195,1,0,0,0,1807,1808,5,109,0,0,1808,1809,5,2,0,0,1809,197,1,
	0,0,0,1810,1811,5,110,0,0,1811,1812,5,2,0,0,1812,199,1,0,0,0,1813,1817,
	5,164,0,0,1814,1815,5,176,0,0,1815,1817,3,214,107,0,1816,1813,1,0,0,0,1816,
	1814,1,0,0,0,1817,201,1,0,0,0,1818,1819,5,36,0,0,1819,1822,5,176,0,0,1820,
	1821,5,12,0,0,1821,1823,5,176,0,0,1822,1820,1,0,0,0,1822,1823,1,0,0,0,1823,
	1824,1,0,0,0,1824,1825,5,49,0,0,1825,1837,5,4,0,0,1826,1831,3,212,106,0,
	1827,1828,5,5,0,0,1828,1830,3,212,106,0,1829,1827,1,0,0,0,1830,1833,1,0,
	0,0,1831,1829,1,0,0,0,1831,1832,1,0,0,0,1832,1835,1,0,0,0,1833,1831,1,0,
	0,0,1834,1836,5,5,0,0,1835,1834,1,0,0,0,1835,1836,1,0,0,0,1836,1838,1,0,
	0,0,1837,1826,1,0,0,0,1837,1838,1,0,0,0,1838,1839,1,0,0,0,1839,1840,5,6,
	0,0,1840,1841,5,50,0,0,1841,1861,5,2,0,0,1842,1843,5,36,0,0,1843,1846,5,
	176,0,0,1844,1845,5,12,0,0,1845,1847,5,176,0,0,1846,1844,1,0,0,0,1846,1847,
	1,0,0,0,1847,1848,1,0,0,0,1848,1849,3,214,107,0,1849,1850,5,2,0,0,1850,
	1861,1,0,0,0,1851,1852,5,36,0,0,1852,1853,5,49,0,0,1853,1854,5,164,0,0,
	1854,1855,5,50,0,0,1855,1861,5,2,0,0,1856,1857,5,36,0,0,1857,1858,5,49,
	0,0,1858,1859,5,50,0,0,1859,1861,5,2,0,0,1860,1818,1,0,0,0,1860,1842,1,
	0,0,0,1860,1851,1,0,0,0,1860,1856,1,0,0,0,1861,203,1,0,0,0,1862,1863,5,
	111,0,0,1863,1864,5,49,0,0,1864,1865,3,222,111,0,1865,1866,5,50,0,0,1866,
	1867,5,2,0,0,1867,205,1,0,0,0,1868,1871,5,176,0,0,1869,1871,3,228,114,0,
	1870,1868,1,0,0,0,1870,1869,1,0,0,0,1871,207,1,0,0,0,1872,1884,5,49,0,0,
	1873,1878,3,206,103,0,1874,1875,5,5,0,0,1875,1877,3,206,103,0,1876,1874,
	1,0,0,0,1877,1880,1,0,0,0,1878,1876,1,0,0,0,1878,1879,1,0,0,0,1879,1882,
	1,0,0,0,1880,1878,1,0,0,0,1881,1883,5,5,0,0,1882,1881,1,0,0,0,1882,1883,
	1,0,0,0,1883,1885,1,0,0,0,1884,1873,1,0,0,0,1884,1885,1,0,0,0,1885,1886,
	1,0,0,0,1886,1887,5,50,0,0,1887,209,1,0,0,0,1888,1889,5,176,0,0,1889,1913,
	3,214,107,0,1890,1891,5,176,0,0,1891,1892,5,12,0,0,1892,1893,5,176,0,0,
	1893,1913,3,214,107,0,1894,1895,5,176,0,0,1895,1896,5,49,0,0,1896,1908,
	5,4,0,0,1897,1902,3,212,106,0,1898,1899,5,5,0,0,1899,1901,3,212,106,0,1900,
	1898,1,0,0,0,1901,1904,1,0,0,0,1902,1900,1,0,0,0,1902,1903,1,0,0,0,1903,
	1906,1,0,0,0,1904,1902,1,0,0,0,1905,1907,5,5,0,0,1906,1905,1,0,0,0,1906,
	1907,1,0,0,0,1907,1909,1,0,0,0,1908,1897,1,0,0,0,1908,1909,1,0,0,0,1909,
	1910,1,0,0,0,1910,1911,5,6,0,0,1911,1913,5,50,0,0,1912,1888,1,0,0,0,1912,
	1890,1,0,0,0,1912,1894,1,0,0,0,1913,211,1,0,0,0,1914,1915,5,176,0,0,1915,
	1916,5,105,0,0,1916,1917,3,222,111,0,1917,213,1,0,0,0,1918,1930,5,49,0,
	0,1919,1924,3,222,111,0,1920,1921,5,5,0,0,1921,1923,3,222,111,0,1922,1920,
	1,0,0,0,1923,1926,1,0,0,0,1924,1922,1,0,0,0,1924,1925,1,0,0,0,1925,1928,
	1,0,0,0,1926,1924,1,0,0,0,1927,1929,5,5,0,0,1928,1927,1,0,0,0,1928,1929,
	1,0,0,0,1929,1931,1,0,0,0,1930,1919,1,0,0,0,1930,1931,1,0,0,0,1931,1932,
	1,0,0,0,1932,1933,5,50,0,0,1933,215,1,0,0,0,1934,1935,5,4,0,0,1935,1940,
	3,218,109,0,1936,1937,5,5,0,0,1937,1939,3,218,109,0,1938,1936,1,0,0,0,1939,
	1942,1,0,0,0,1940,1938,1,0,0,0,1940,1941,1,0,0,0,1941,1944,1,0,0,0,1942,
	1940,1,0,0,0,1943,1945,5,5,0,0,1944,1943,1,0,0,0,1944,1945,1,0,0,0,1945,
	1946,1,0,0,0,1946,1947,5,6,0,0,1947,217,1,0,0,0,1948,1949,5,176,0,0,1949,
	1950,5,105,0,0,1950,1951,3,222,111,0,1951,219,1,0,0,0,1952,1953,5,49,0,
	0,1953,1958,3,234,117,0,1954,1955,5,5,0,0,1955,1957,3,234,117,0,1956,1954,
	1,0,0,0,1957,1960,1,0,0,0,1958,1956,1,0,0,0,1958,1959,1,0,0,0,1959,1962,
	1,0,0,0,1960,1958,1,0,0,0,1961,1963,5,5,0,0,1962,1961,1,0,0,0,1962,1963,
	1,0,0,0,1963,1964,1,0,0,0,1964,1965,5,50,0,0,1965,221,1,0,0,0,1966,1967,
	6,111,-1,0,1967,1968,5,49,0,0,1968,1969,5,176,0,0,1969,1970,7,8,0,0,1970,
	1971,3,222,111,0,1971,1972,5,50,0,0,1972,2112,1,0,0,0,1973,1974,5,49,0,
	0,1974,1975,3,222,111,0,1975,1976,5,50,0,0,1976,2112,1,0,0,0,1977,1978,
	5,49,0,0,1978,1981,3,222,111,0,1979,1980,5,5,0,0,1980,1982,3,222,111,0,
	1981,1979,1,0,0,0,1982,1983,1,0,0,0,1983,1981,1,0,0,0,1983,1984,1,0,0,0,
	1984,1985,1,0,0,0,1985,1986,5,50,0,0,1986,2112,1,0,0,0,1987,1988,3,236,
	118,0,1988,1989,5,49,0,0,1989,1991,3,222,111,0,1990,1992,5,5,0,0,1991,1990,
	1,0,0,0,1991,1992,1,0,0,0,1992,1993,1,0,0,0,1993,1994,5,50,0,0,1994,2112,
	1,0,0,0,1995,2112,3,210,105,0,1996,1997,5,112,0,0,1997,1999,5,176,0,0,1998,
	2000,3,216,108,0,1999,1998,1,0,0,0,1999,2000,1,0,0,0,2000,2001,1,0,0,0,
	2001,2112,3,214,107,0,2002,2003,5,112,0,0,2003,2004,3,234,117,0,2004,2005,
	5,66,0,0,2005,2006,5,67,0,0,2006,2007,5,49,0,0,2007,2008,3,222,111,0,2008,
	2009,5,50,0,0,2009,2112,1,0,0,0,2010,2011,5,55,0,0,2011,2012,5,49,0,0,2012,
	2013,3,234,117,0,2013,2014,5,50,0,0,2014,2015,5,12,0,0,2015,2016,5,176,
	0,0,2016,2112,1,0,0,0,2017,2018,5,113,0,0,2018,2112,3,214,107,0,2019,2020,
	5,114,0,0,2020,2112,3,214,107,0,2021,2022,5,115,0,0,2022,2112,3,214,107,
	0,2023,2024,5,116,0,0,2024,2112,3,214,107,0,2025,2026,5,117,0,0,2026,2027,
	5,49,0,0,2027,2028,5,176,0,0,2028,2029,5,12,0,0,2029,2030,5,176,0,0,2030,
	2031,5,5,0,0,2031,2032,3,214,107,0,2032,2033,5,50,0,0,2033,2112,1,0,0,0,
	2034,2035,5,118,0,0,2035,2112,3,214,107,0,2036,2037,5,119,0,0,2037,2112,
	3,214,107,0,2038,2039,5,120,0,0,2039,2040,5,49,0,0,2040,2041,3,222,111,
	0,2041,2042,5,5,0,0,2042,2043,3,220,110,0,2043,2044,5,50,0,0,2044,2112,
	1,0,0,0,2045,2046,5,121,0,0,2046,2047,5,49,0,0,2047,2048,3,222,111,0,2048,
	2049,5,5,0,0,2049,2050,3,220,110,0,2050,2051,5,5,0,0,2051,2052,5,158,0,
	0,2052,2053,5,50,0,0,2053,2112,1,0,0,0,2054,2055,5,122,0,0,2055,2056,5,
	66,0,0,2056,2057,3,222,111,0,2057,2058,5,67,0,0,2058,2059,7,11,0,0,2059,
	2112,1,0,0,0,2060,2061,5,128,0,0,2061,2062,5,66,0,0,2062,2063,3,222,111,
	0,2063,2064,5,67,0,0,2064,2065,7,12,0,0,2065,2112,1,0,0,0,2066,2067,7,13,
	0,0,2067,2112,3,222,111,21,2068,2080,5,66,0,0,2069,2074,3,222,111,0,2070,
	2071,5,5,0,0,2071,2073,3,222,111,0,2072,2070,1,0,0,0,2073,2076,1,0,0,0,
	2074,2072,1,0,0,0,2074,2075,1,0,0,0,2075,2078,1,0,0,0,2076,2074,1,0,0,0,
	2077,2079,5,5,0,0,2078,2077,1,0,0,0,2078,2079,1,0,0,0,2079,2081,1,0,0,0,
	2080,2069,1,0,0,0,2080,2081,1,0,0,0,2081,2082,1,0,0,0,2082,2112,5,67,0,
	0,2083,2084,5,74,0,0,2084,2085,5,12,0,0,2085,2086,5,176,0,0,2086,2087,5,
	12,0,0,2087,2088,5,176,0,0,2088,2089,5,66,0,0,2089,2090,3,222,111,0,2090,
	2091,5,67,0,0,2091,2092,3,224,112,0,2092,2112,1,0,0,0,2093,2094,5,74,0,
	0,2094,2095,5,12,0,0,2095,2100,5,176,0,0,2096,2097,5,66,0,0,2097,2098,3,
	222,111,0,2098,2099,5,67,0,0,2099,2101,1,0,0,0,2100,2096,1,0,0,0,2101,2102,
	1,0,0,0,2102,2100,1,0,0,0,2102,2103,1,0,0,0,2103,2112,1,0,0,0,2104,2105,
	5,74,0,0,2105,2106,5,12,0,0,2106,2112,5,176,0,0,2107,2112,5,74,0,0,2108,
	2112,5,173,0,0,2109,2112,3,14,7,0,2110,2112,3,228,114,0,2111,1966,1,0,0,
	0,2111,1973,1,0,0,0,2111,1977,1,0,0,0,2111,1987,1,0,0,0,2111,1995,1,0,0,
	0,2111,1996,1,0,0,0,2111,2002,1,0,0,0,2111,2010,1,0,0,0,2111,2017,1,0,0,
	0,2111,2019,1,0,0,0,2111,2021,1,0,0,0,2111,2023,1,0,0,0,2111,2025,1,0,0,
	0,2111,2034,1,0,0,0,2111,2036,1,0,0,0,2111,2038,1,0,0,0,2111,2045,1,0,0,
	0,2111,2054,1,0,0,0,2111,2060,1,0,0,0,2111,2066,1,0,0,0,2111,2068,1,0,0,
	0,2111,2083,1,0,0,0,2111,2093,1,0,0,0,2111,2104,1,0,0,0,2111,2107,1,0,0,
	0,2111,2108,1,0,0,0,2111,2109,1,0,0,0,2111,2110,1,0,0,0,2112,2218,1,0,0,
	0,2113,2114,10,20,0,0,2114,2115,5,17,0,0,2115,2217,3,222,111,20,2116,2117,
	10,19,0,0,2117,2118,7,14,0,0,2118,2217,3,222,111,20,2119,2120,10,18,0,0,
	2120,2121,7,15,0,0,2121,2217,3,222,111,19,2122,2123,10,17,0,0,2123,2124,
	7,16,0,0,2124,2217,3,222,111,18,2125,2126,10,16,0,0,2126,2127,7,17,0,0,
	2127,2217,3,222,111,17,2128,2129,10,15,0,0,2129,2130,7,18,0,0,2130,2217,
	3,222,111,16,2131,2132,10,14,0,0,2132,2133,5,24,0,0,2133,2217,3,222,111,
	15,2134,2135,10,13,0,0,2135,2136,5,26,0,0,2136,2217,3,222,111,14,2137,2138,
	10,12,0,0,2138,2139,5,25,0,0,2139,2217,3,222,111,13,2140,2141,10,11,0,0,
	2141,2142,5,140,0,0,2142,2217,3,222,111,12,2143,2144,10,10,0,0,2144,2145,
	5,141,0,0,2145,2217,3,222,111,11,2146,2147,10,9,0,0,2147,2148,5,142,0,0,
	2148,2149,3,222,111,0,2149,2150,5,105,0,0,2150,2151,3,222,111,9,2151,2217,
	1,0,0,0,2152,2153,10,32,0,0,2153,2154,5,66,0,0,2154,2155,3,222,111,0,2155,
	2156,5,105,0,0,2156,2157,3,222,111,0,2157,2158,5,67,0,0,2158,2217,1,0,0,
	0,2159,2160,10,31,0,0,2160,2161,5,66,0,0,2161,2162,5,158,0,0,2162,2217,
	5,67,0,0,2163,2164,10,30,0,0,2164,2165,5,66,0,0,2165,2166,3,222,111,0,2166,
	2167,5,67,0,0,2167,2217,1,0,0,0,2168,2169,10,27,0,0,2169,2217,7,19,0,0,
	2170,2171,10,26,0,0,2171,2172,5,135,0,0,2172,2173,5,49,0,0,2173,2174,3,
	222,111,0,2174,2175,5,50,0,0,2175,2217,1,0,0,0,2176,2177,10,25,0,0,2177,
	2178,5,136,0,0,2178,2179,5,49,0,0,2179,2180,3,222,111,0,2180,2181,5,5,0,
	0,2181,2182,3,222,111,0,2182,2183,5,50,0,0,2183,2217,1,0,0,0,2184,2185,
	10,24,0,0,2185,2186,5,12,0,0,2186,2188,5,176,0,0,2187,2189,3,216,108,0,
	2188,2187,1,0,0,0,2188,2189,1,0,0,0,2189,2190,1,0,0,0,2190,2191,5,49,0,
	0,2191,2203,5,4,0,0,2192,2197,3,212,106,0,2193,2194,5,5,0,0,2194,2196,3,
	212,106,0,2195,2193,1,0,0,0,2196,2199,1,0,0,0,2197,2195,1,0,0,0,2197,2198,
	1,0,0,0,2198,2201,1,0,0,0,2199,2197,1,0,0,0,2200,2202,5,5,0,0,2201,2200,
	1,0,0,0,2201,2202,1,0,0,0,2202,2204,1,0,0,0,2203,2192,1,0,0,0,2203,2204,
	1,0,0,0,2204,2205,1,0,0,0,2205,2206,5,6,0,0,2206,2217,5,50,0,0,2207,2208,
	10,23,0,0,2208,2209,5,12,0,0,2209,2211,5,176,0,0,2210,2212,3,216,108,0,
	2211,2210,1,0,0,0,2211,2212,1,0,0,0,2212,2213,1,0,0,0,2213,2217,3,214,107,
	0,2214,2215,10,22,0,0,2215,2217,3,224,112,0,2216,2113,1,0,0,0,2216,2116,
	1,0,0,0,2216,2119,1,0,0,0,2216,2122,1,0,0,0,2216,2125,1,0,0,0,2216,2128,
	1,0,0,0,2216,2131,1,0,0,0,2216,2134,1,0,0,0,2216,2137,1,0,0,0,2216,2140,
	1,0,0,0,2216,2143,1,0,0,0,2216,2146,1,0,0,0,2216,2152,1,0,0,0,2216,2159,
	1,0,0,0,2216,2163,1,0,0,0,2216,2168,1,0,0,0,2216,2170,1,0,0,0,2216,2176,
	1,0,0,0,2216,2184,1,0,0,0,2216,2207,1,0,0,0,2216,2214,1,0,0,0,2217,2220,
	1,0,0,0,2218,2216,1,0,0,0,2218,2219,1,0,0,0,2219,223,1,0,0,0,2220,2218,
	1,0,0,0,2221,2222,5,12,0,0,2222,2235,5,176,0,0,2223,2235,5,123,0,0,2224,
	2235,5,124,0,0,2225,2235,5,125,0,0,2226,2235,5,126,0,0,2227,2235,5,127,
	0,0,2228,2235,5,129,0,0,2229,2235,5,130,0,0,2230,2235,5,131,0,0,2231,2235,
	5,132,0,0,2232,2235,5,143,0,0,2233,2235,5,144,0,0,2234,2221,1,0,0,0,2234,
	2223,1,0,0,0,2234,2224,1,0,0,0,2234,2225,1,0,0,0,2234,2226,1,0,0,0,2234,
	2227,1,0,0,0,2234,2228,1,0,0,0,2234,2229,1,0,0,0,2234,2230,1,0,0,0,2234,
	2231,1,0,0,0,2234,2232,1,0,0,0,2234,2233,1,0,0,0,2235,225,1,0,0,0,2236,
	2237,7,20,0,0,2237,227,1,0,0,0,2238,2253,5,154,0,0,2239,2253,3,230,115,
	0,2240,2253,3,232,116,0,2241,2245,5,164,0,0,2242,2244,5,164,0,0,2243,2242,
	1,0,0,0,2244,2247,1,0,0,0,2245,2243,1,0,0,0,2245,2246,1,0,0,0,2246,2253,
	1,0,0,0,2247,2245,1,0,0,0,2248,2253,5,174,0,0,2249,2253,5,175,0,0,2250,
	2253,5,165,0,0,2251,2253,5,166,0,0,2252,2238,1,0,0,0,2252,2239,1,0,0,0,
	2252,2240,1,0,0,0,2252,2241,1,0,0,0,2252,2248,1,0,0,0,2252,2249,1,0,0,0,
	2252,2250,1,0,0,0,2252,2251,1,0,0,0,2253,229,1,0,0,0,2254,2256,5,158,0,
	0,2255,2257,7,21,0,0,2256,2255,1,0,0,0,2256,2257,1,0,0,0,2257,231,1,0,0,
	0,2258,2259,5,157,0,0,2259,233,1,0,0,0,2260,2261,5,150,0,0,2261,2305,5,
	59,0,0,2262,2305,5,150,0,0,2263,2305,5,159,0,0,2264,2305,5,160,0,0,2265,
	2305,5,162,0,0,2266,2305,5,161,0,0,2267,2305,5,169,0,0,2268,2305,5,170,
	0,0,2269,2305,5,151,0,0,2270,2305,5,152,0,0,2271,2305,5,171,0,0,2272,2305,
	5,172,0,0,2273,2274,5,7,0,0,2274,2283,5,49,0,0,2275,2280,3,234,117,0,2276,
	2277,5,5,0,0,2277,2279,3,234,117,0,2278,2276,1,0,0,0,2279,2282,1,0,0,0,
	2280,2278,1,0,0,0,2280,2281,1,0,0,0,2281,2284,1,0,0,0,2282,2280,1,0,0,0,
	2283,2275,1,0,0,0,2283,2284,1,0,0,0,2284,2285,1,0,0,0,2285,2298,5,50,0,
	0,2286,2287,5,73,0,0,2287,2288,5,49,0,0,2288,2293,3,234,117,0,2289,2290,
	5,5,0,0,2290,2292,3,234,117,0,2291,2289,1,0,0,0,2292,2295,1,0,0,0,2293,
	2291,1,0,0,0,2293,2294,1,0,0,0,2294,2296,1,0,0,0,2295,2293,1,0,0,0,2296,
	2297,5,50,0,0,2297,2299,1,0,0,0,2298,2286,1,0,0,0,2298,2299,1,0,0,0,2299,
	2305,1,0,0,0,2300,2301,5,176,0,0,2301,2302,5,12,0,0,2302,2305,5,176,0,0,
	2303,2305,5,176,0,0,2304,2260,1,0,0,0,2304,2262,1,0,0,0,2304,2263,1,0,0,
	0,2304,2264,1,0,0,0,2304,2265,1,0,0,0,2304,2266,1,0,0,0,2304,2267,1,0,0,
	0,2304,2268,1,0,0,0,2304,2269,1,0,0,0,2304,2270,1,0,0,0,2304,2271,1,0,0,
	0,2304,2272,1,0,0,0,2304,2273,1,0,0,0,2304,2300,1,0,0,0,2304,2303,1,0,0,
	0,2305,235,1,0,0,0,2306,2307,7,22,0,0,2307,237,1,0,0,0,242,241,247,260,
	262,282,286,293,298,306,310,316,326,329,339,343,349,352,356,361,365,380,
	383,397,400,411,413,428,443,447,457,463,469,475,481,487,493,499,505,510,
	518,521,538,540,547,555,561,565,577,581,583,587,593,596,608,612,614,628,
	635,648,652,659,679,685,692,703,709,716,724,735,744,750,756,765,771,776,
	782,789,795,801,805,809,817,822,830,840,845,849,861,870,872,878,884,891,
	902,908,912,918,925,941,950,954,960,969,973,981,985,991,995,997,1005,1009,
	1011,1019,1023,1029,1033,1039,1043,1045,1051,1056,1089,1115,1129,1141,1145,
	1150,1155,1164,1168,1170,1192,1197,1203,1218,1227,1231,1233,1242,1247,1258,
	1260,1266,1280,1286,1298,1309,1317,1332,1334,1340,1352,1358,1369,1373,1384,
	1397,1403,1411,1417,1421,1431,1443,1453,1464,1471,1477,1484,1497,1554,1566,
	1570,1579,1589,1601,1609,1654,1663,1669,1681,1706,1718,1731,1735,1745,1753,
	1759,1765,1774,1778,1780,1786,1794,1798,1800,1803,1816,1822,1831,1835,1837,
	1846,1860,1870,1878,1882,1884,1902,1906,1908,1912,1924,1928,1930,1940,1944,
	1958,1962,1983,1991,1999,2074,2078,2080,2102,2111,2188,2197,2201,2203,2211,
	2216,2218,2234,2245,2252,2256,2280,2283,2293,2298,2304];

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
	public mappingType(): MappingTypeContext {
		return this.getTypedRuleContext(MappingTypeContext, 0) as MappingTypeContext;
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
	public mappingType(): MappingTypeContext {
		return this.getTypedRuleContext(MappingTypeContext, 0) as MappingTypeContext;
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
