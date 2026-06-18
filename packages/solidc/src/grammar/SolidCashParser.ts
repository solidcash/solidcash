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
	public static readonly VersionLiteral = 150;
	public static readonly BooleanLiteral = 151;
	public static readonly NumberUnit = 152;
	public static readonly DecimalLiteral = 153;
	public static readonly NumberLiteral = 154;
	public static readonly NumberPart = 155;
	public static readonly ExponentPart = 156;
	public static readonly PrimitiveType = 157;
	public static readonly UnboundedBytes = 158;
	public static readonly BoundedBytes = 159;
	public static readonly Bound = 160;
	public static readonly StringLiteral = 161;
	public static readonly DateLiteral = 162;
	public static readonly HexLiteral = 163;
	public static readonly TxVar = 164;
	public static readonly UnsafeCast = 165;
	public static readonly BoundedSignedInt = 166;
	public static readonly BoundedUnsignedInt = 167;
	public static readonly BoundedSignedFixed = 168;
	public static readonly BoundedUnsignedFixed = 169;
	public static readonly NullaryOp = 170;
	public static readonly UnicodeLiteral = 171;
	public static readonly HexStringLiteral = 172;
	public static readonly Identifier = 173;
	public static readonly WHITESPACE = 174;
	public static readonly COMMENT = 175;
	public static readonly LINE_COMMENT = 176;
	public static override readonly EOF = Token.EOF;
	public static readonly RULE_sourceFile = 0;
	public static readonly RULE_importDirective = 1;
	public static readonly RULE_importBinding = 2;
	public static readonly RULE_freeFunctionDefinition = 3;
	public static readonly RULE_usingForDirective = 4;
	public static readonly RULE_usingFunctionBinding = 5;
	public static readonly RULE_userDefinableOperator = 6;
	public static readonly RULE_pragmaDirective = 7;
	public static readonly RULE_pragmaName = 8;
	public static readonly RULE_pragmaValue = 9;
	public static readonly RULE_versionConstraint = 10;
	public static readonly RULE_versionOperator = 11;
	public static readonly RULE_interfaceDefinition = 12;
	public static readonly RULE_interfaceCollection = 13;
	public static readonly RULE_interfaceStateVariable = 14;
	public static readonly RULE_interfaceStateVariableVisibility = 15;
	public static readonly RULE_interfaceFunction = 16;
	public static readonly RULE_libraryDefinition = 17;
	public static readonly RULE_contractDefinition = 18;
	public static readonly RULE_abstractFunctionDefinition = 19;
	public static readonly RULE_eventDefinition = 20;
	public static readonly RULE_eventParameter = 21;
	public static readonly RULE_errorDefinition = 22;
	public static readonly RULE_errorParameter = 23;
	public static readonly RULE_structDefinition = 24;
	public static readonly RULE_structField = 25;
	public static readonly RULE_enumDefinition = 26;
	public static readonly RULE_enumMember = 27;
	public static readonly RULE_typeDefinition = 28;
	public static readonly RULE_constantDefinition = 29;
	public static readonly RULE_constructorDefinition = 30;
	public static readonly RULE_fallbackDefinition = 31;
	public static readonly RULE_fallbackModifier = 32;
	public static readonly RULE_receiveDefinition = 33;
	public static readonly RULE_parentInvocation = 34;
	public static readonly RULE_stateVariableDeclaration = 35;
	public static readonly RULE_collectionModifier = 36;
	public static readonly RULE_stateVariableVisibility = 37;
	public static readonly RULE_mappingType = 38;
	public static readonly RULE_arrayType = 39;
	public static readonly RULE_modifierDefinition = 40;
	public static readonly RULE_modifierStatement = 41;
	public static readonly RULE_placeholderStatement = 42;
	public static readonly RULE_functionDefinition = 43;
	public static readonly RULE_customModifierInvocation = 44;
	public static readonly RULE_functionModifier = 45;
	public static readonly RULE_overrideSpecifier = 46;
	public static readonly RULE_unsafeModifier = 47;
	public static readonly RULE_returnType = 48;
	public static readonly RULE_returnParam = 49;
	public static readonly RULE_parameterList = 50;
	public static readonly RULE_parameter = 51;
	public static readonly RULE_block = 52;
	public static readonly RULE_statement = 53;
	public static readonly RULE_transferStatement = 54;
	public static readonly RULE_tokenContainerMethodStatement = 55;
	public static readonly RULE_returnStatement = 56;
	public static readonly RULE_functionCallStatement = 57;
	public static readonly RULE_addressMethodStatement = 58;
	public static readonly RULE_emitStatement = 59;
	public static readonly RULE_mappingAssignStatement = 60;
	public static readonly RULE_mappingFieldAssignStatement = 61;
	public static readonly RULE_mappingDeleteStatement = 62;
	public static readonly RULE_stateAssignStatement = 63;
	public static readonly RULE_variableDefinition = 64;
	public static readonly RULE_tupleAssignment = 65;
	public static readonly RULE_tupleSlot = 66;
	public static readonly RULE_assignStatement = 67;
	public static readonly RULE_arrayPushStatement = 68;
	public static readonly RULE_arrayPopStatement = 69;
	public static readonly RULE_arrayAssignStatement = 70;
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
                                                            "'pragma'", 
                                                            "'solidcash'", 
                                                            "'='", "'interface'", 
                                                            "'is'", "'public'", 
                                                            "'external'", 
                                                            "'library'", 
                                                            "'abstract'", 
                                                            "'contract'", 
                                                            "'event'", "'('", 
                                                            "')'", "'anonymous'", 
                                                            "'indexed'", 
                                                            "'error'", "'struct'", 
                                                            "'enum'", "'type'", 
                                                            "'constant'", 
                                                            "'constructor'", 
                                                            "'fallback'", 
                                                            "'payable'", 
                                                            "'virtual'", 
                                                            "'receive'", 
                                                            "'internal'", 
                                                            "'private'", 
                                                            "'mapping'", 
                                                            "'=>'", "'['", 
                                                            "']'", "'modifier'", 
                                                            "'_'", "'pure'", 
                                                            "'view'", "'upgrade'", 
                                                            "'deploy'", 
                                                            "'selfdestruct'", 
                                                            "'delegate'", 
                                                            "'override'", 
                                                            "'unsafe'", 
                                                            "'returns'", 
                                                            "'this'", "'return'", 
                                                            "'emit'", "'.delete'", 
                                                            "'+='", "'-='", 
                                                            "'*='", "'/='", 
                                                            "'%='", "'&='", 
                                                            "'|='", "'^='", 
                                                            "'<<='", "'>>='", 
                                                            "'++'", "'--'", 
                                                            "'.push'", "'.pop'", 
                                                            "'delete'", 
                                                            "'require'", 
                                                            "'if'", "'else'", 
                                                            "'of'", "'entries'", 
                                                            "'in'", "'do'", 
                                                            "'while'", "'console.log'", 
                                                            "'assembly'", 
                                                            "'unchecked'", 
                                                            "'switch'", 
                                                            "'case'", "':'", 
                                                            "'default'", 
                                                            "'try'", "'catch'", 
                                                            "'break'", "'continue'", 
                                                            "'revert'", 
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
                                                            "'packed'", 
                                                            "'memory'", 
                                                            "'calldata'", 
                                                            "'immutable'", 
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
                                                             "VersionLiteral", 
                                                             "BooleanLiteral", 
                                                             "NumberUnit", 
                                                             "DecimalLiteral", 
                                                             "NumberLiteral", 
                                                             "NumberPart", 
                                                             "ExponentPart", 
                                                             "PrimitiveType", 
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
		"pragmaDirective", "pragmaName", "pragmaValue", "versionConstraint", "versionOperator", 
		"interfaceDefinition", "interfaceCollection", "interfaceStateVariable", 
		"interfaceStateVariableVisibility", "interfaceFunction", "libraryDefinition", 
		"contractDefinition", "abstractFunctionDefinition", "eventDefinition", 
		"eventParameter", "errorDefinition", "errorParameter", "structDefinition", 
		"structField", "enumDefinition", "enumMember", "typeDefinition", "constantDefinition", 
		"constructorDefinition", "fallbackDefinition", "fallbackModifier", "receiveDefinition", 
		"parentInvocation", "stateVariableDeclaration", "collectionModifier", 
		"stateVariableVisibility", "mappingType", "arrayType", "modifierDefinition", 
		"modifierStatement", "placeholderStatement", "functionDefinition", "customModifierInvocation", 
		"functionModifier", "overrideSpecifier", "unsafeModifier", "returnType", 
		"returnParam", "parameterList", "parameter", "block", "statement", "transferStatement", 
		"tokenContainerMethodStatement", "returnStatement", "functionCallStatement", 
		"addressMethodStatement", "emitStatement", "mappingAssignStatement", "mappingFieldAssignStatement", 
		"mappingDeleteStatement", "stateAssignStatement", "variableDefinition", 
		"tupleAssignment", "tupleSlot", "assignStatement", "arrayPushStatement", 
		"arrayPopStatement", "arrayAssignStatement", "arrayDeleteStatement", "stateArrayPushStatement", 
		"stateArrayPopStatement", "deleteStatement", "timeOpStatement", "requireStatement", 
		"ifStatement", "loopStatement", "forOfEntriesStatement", "forInStatement", 
		"forOfStatement", "forStatement", "forInit", "forCondition", "forUpdate", 
		"doWhileStatement", "whileStatement", "consoleStatement", "assemblyStatement", 
		"assemblyToken", "uncheckedStatement", "switchStatement", "switchCase", 
		"switchDefault", "tryCatchStatement", "tryReturns", "catchClause", "breakStatement", 
		"continueStatement", "requireMessage", "revertStatement", "assertStatement", 
		"consoleParameter", "consoleParameterList", "functionCall", "namedArg", 
		"expressionList", "callOptions", "callOption", "typeList", "expression", 
		"memberName", "modifier", "literal", "numberLiteral", "decimalLiteral", 
		"typeName", "typeCast",
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
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 241;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===28) {
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
			this.state = 253;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 2, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 250;
					this.constantDefinition();
					}
					}
				}
				this.state = 255;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 2, this._ctx);
			}
			this.state = 259;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===45) {
				{
				{
				this.state = 256;
				this.enumDefinition();
				}
				}
				this.state = 261;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 265;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===44) {
				{
				{
				this.state = 262;
				this.structDefinition();
				}
				}
				this.state = 267;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 271;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===46) {
				{
				{
				this.state = 268;
				this.typeDefinition();
				}
				}
				this.state = 273;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 277;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===8) {
				{
				{
				this.state = 274;
				this.usingForDirective();
				}
				}
				this.state = 279;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 283;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===43) {
				{
				{
				this.state = 280;
				this.errorDefinition();
				}
				}
				this.state = 285;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 289;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===31) {
				{
				{
				this.state = 286;
				this.interfaceDefinition();
				}
				}
				this.state = 291;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 295;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 292;
				this.freeFunctionDefinition();
				}
				}
				this.state = 297;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 301;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 10, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 298;
					this.libraryDefinition();
					}
					}
				}
				this.state = 303;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 10, this._ctx);
			}
			this.state = 306;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 36:
			case 37:
				{
				this.state = 304;
				this.contractDefinition();
				}
				break;
			case 35:
				{
				this.state = 305;
				this.libraryDefinition();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
			this.state = 308;
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
			this.state = 336;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 14, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 310;
				this.match(SolidCashParser.T__0);
				this.state = 311;
				this.match(SolidCashParser.StringLiteral);
				this.state = 312;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 313;
				this.match(SolidCashParser.T__0);
				this.state = 314;
				this.match(SolidCashParser.StringLiteral);
				this.state = 315;
				this.match(SolidCashParser.T__2);
				this.state = 316;
				this.match(SolidCashParser.Identifier);
				this.state = 317;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 318;
				this.match(SolidCashParser.T__0);
				this.state = 319;
				this.match(SolidCashParser.T__3);
				this.state = 320;
				this.importBinding();
				this.state = 325;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 12, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 321;
						this.match(SolidCashParser.T__4);
						this.state = 322;
						this.importBinding();
						}
						}
					}
					this.state = 327;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 12, this._ctx);
				}
				this.state = 329;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 328;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 331;
				this.match(SolidCashParser.T__5);
				this.state = 332;
				this.match(SolidCashParser.Identifier);
				this.state = 333;
				this.match(SolidCashParser.StringLiteral);
				this.state = 334;
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
			this.state = 338;
			this.match(SolidCashParser.Identifier);
			this.state = 341;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 339;
				this.match(SolidCashParser.T__2);
				this.state = 340;
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
			this.state = 343;
			this.match(SolidCashParser.T__6);
			this.state = 344;
			this.match(SolidCashParser.Identifier);
			this.state = 345;
			this.parameterList();
			this.state = 347;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 346;
				this.returnType();
				}
			}

			this.state = 349;
			this.match(SolidCashParser.T__3);
			this.state = 353;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				{
				this.state = 350;
				this.statement();
				}
				}
				this.state = 355;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 356;
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
			this.state = 393;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 24, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 358;
				this.match(SolidCashParser.T__7);
				this.state = 359;
				this.match(SolidCashParser.Identifier);
				this.state = 360;
				this.match(SolidCashParser.T__8);
				this.state = 363;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 7:
				case 147:
				case 148:
				case 149:
				case 157:
				case 158:
				case 159:
				case 166:
				case 167:
				case 168:
				case 169:
				case 173:
					{
					this.state = 361;
					this.typeName();
					}
					break;
				case 10:
					{
					this.state = 362;
					this.match(SolidCashParser.T__9);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 366;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 365;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 368;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 369;
				this.match(SolidCashParser.T__7);
				this.state = 370;
				this.match(SolidCashParser.T__3);
				this.state = 371;
				this.usingFunctionBinding();
				this.state = 376;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 20, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 372;
						this.match(SolidCashParser.T__4);
						this.state = 373;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 378;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 20, this._ctx);
				}
				this.state = 380;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 379;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 382;
				this.match(SolidCashParser.T__5);
				this.state = 383;
				this.match(SolidCashParser.T__8);
				this.state = 386;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 7:
				case 147:
				case 148:
				case 149:
				case 157:
				case 158:
				case 159:
				case 166:
				case 167:
				case 168:
				case 169:
				case 173:
					{
					this.state = 384;
					this.typeName();
					}
					break;
				case 10:
					{
					this.state = 385;
					this.match(SolidCashParser.T__9);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 389;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 388;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 391;
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
			this.state = 395;
			this.match(SolidCashParser.Identifier);
			this.state = 398;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===12) {
				{
				this.state = 396;
				this.match(SolidCashParser.T__11);
				this.state = 397;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 402;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 400;
				this.match(SolidCashParser.T__2);
				this.state = 401;
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
			this.state = 404;
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
	public pragmaDirective(): PragmaDirectiveContext {
		let localctx: PragmaDirectiveContext = new PragmaDirectiveContext(this, this._ctx, this.state);
		this.enterRule(localctx, 14, SolidCashParser.RULE_pragmaDirective);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 406;
			this.match(SolidCashParser.T__27);
			this.state = 407;
			this.pragmaName();
			this.state = 408;
			this.pragmaValue();
			this.state = 409;
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
		this.enterRule(localctx, 16, SolidCashParser.RULE_pragmaName);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 411;
			this.match(SolidCashParser.T__28);
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
		this.enterRule(localctx, 18, SolidCashParser.RULE_pragmaValue);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 413;
			this.versionConstraint();
			this.state = 415;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 1290797056) !== 0) || _la===150) {
				{
				this.state = 414;
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
		this.enterRule(localctx, 20, SolidCashParser.RULE_versionConstraint);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 418;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 1290797056) !== 0)) {
				{
				this.state = 417;
				this.versionOperator();
				}
			}

			this.state = 420;
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
		this.enterRule(localctx, 22, SolidCashParser.RULE_versionOperator);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 422;
			_la = this._input.LA(1);
			if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 1290797056) !== 0))) {
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
		this.enterRule(localctx, 24, SolidCashParser.RULE_interfaceDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 424;
			this.match(SolidCashParser.T__30);
			this.state = 425;
			this.match(SolidCashParser.Identifier);
			this.state = 435;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===32) {
				{
				this.state = 426;
				this.match(SolidCashParser.T__31);
				this.state = 427;
				this.match(SolidCashParser.Identifier);
				this.state = 432;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 428;
					this.match(SolidCashParser.T__4);
					this.state = 429;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 434;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 437;
			this.match(SolidCashParser.T__3);
			this.state = 441;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===45) {
				{
				{
				this.state = 438;
				this.enumDefinition();
				}
				}
				this.state = 443;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 447;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===44) {
				{
				{
				this.state = 444;
				this.structDefinition();
				}
				}
				this.state = 449;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 453;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===46) {
				{
				{
				this.state = 450;
				this.typeDefinition();
				}
				}
				this.state = 455;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 459;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===38) {
				{
				{
				this.state = 456;
				this.eventDefinition();
				}
				}
				this.state = 461;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 465;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 35, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 462;
					this.interfaceStateVariable();
					}
					}
				}
				this.state = 467;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 35, this._ctx);
			}
			this.state = 471;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===33 || _la===34) {
				{
				{
				this.state = 468;
				this.interfaceCollection();
				}
				}
				this.state = 473;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 477;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 474;
				this.interfaceFunction();
				}
				}
				this.state = 479;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 480;
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
		this.enterRule(localctx, 26, SolidCashParser.RULE_interfaceCollection);
		try {
			this.state = 492;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 38, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 482;
				this.interfaceStateVariableVisibility();
				this.state = 483;
				this.mappingType();
				this.state = 484;
				this.match(SolidCashParser.Identifier);
				this.state = 485;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 487;
				this.interfaceStateVariableVisibility();
				this.state = 488;
				this.arrayType(0);
				this.state = 489;
				this.match(SolidCashParser.Identifier);
				this.state = 490;
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
		this.enterRule(localctx, 28, SolidCashParser.RULE_interfaceStateVariable);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 494;
			this.interfaceStateVariableVisibility();
			this.state = 495;
			this.typeName();
			this.state = 496;
			this.match(SolidCashParser.Identifier);
			this.state = 497;
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
		this.enterRule(localctx, 30, SolidCashParser.RULE_interfaceStateVariableVisibility);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 499;
			_la = this._input.LA(1);
			if(!(_la===33 || _la===34)) {
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
		this.enterRule(localctx, 32, SolidCashParser.RULE_interfaceFunction);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 501;
			this.match(SolidCashParser.T__6);
			this.state = 502;
			this.match(SolidCashParser.Identifier);
			this.state = 503;
			this.parameterList();
			this.state = 505;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 504;
				this.returnType();
				}
			}

			this.state = 507;
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
		this.enterRule(localctx, 34, SolidCashParser.RULE_libraryDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 509;
			this.match(SolidCashParser.T__34);
			this.state = 510;
			this.match(SolidCashParser.Identifier);
			this.state = 511;
			this.match(SolidCashParser.T__3);
			this.state = 515;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===45) {
				{
				{
				this.state = 512;
				this.enumDefinition();
				}
				}
				this.state = 517;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 521;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===44) {
				{
				{
				this.state = 518;
				this.structDefinition();
				}
				}
				this.state = 523;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 527;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===46) {
				{
				{
				this.state = 524;
				this.typeDefinition();
				}
				}
				this.state = 529;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 533;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===38) {
				{
				{
				this.state = 530;
				this.eventDefinition();
				}
				}
				this.state = 535;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 539;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 44, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 536;
					this.constantDefinition();
					}
					}
				}
				this.state = 541;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 44, this._ctx);
			}
			this.state = 545;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 542;
				this.freeFunctionDefinition();
				}
				}
				this.state = 547;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 548;
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
		this.enterRule(localctx, 36, SolidCashParser.RULE_contractDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 551;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===36) {
				{
				this.state = 550;
				this.match(SolidCashParser.T__35);
				}
			}

			this.state = 553;
			this.match(SolidCashParser.T__36);
			this.state = 554;
			this.match(SolidCashParser.Identifier);
			this.state = 556;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===39) {
				{
				this.state = 555;
				this.parameterList();
				}
			}

			this.state = 567;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===32) {
				{
				this.state = 558;
				this.match(SolidCashParser.T__31);
				this.state = 559;
				this.match(SolidCashParser.Identifier);
				this.state = 564;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 560;
					this.match(SolidCashParser.T__4);
					this.state = 561;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 566;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 569;
			this.match(SolidCashParser.T__3);
			this.state = 573;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===45) {
				{
				{
				this.state = 570;
				this.enumDefinition();
				}
				}
				this.state = 575;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 579;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===44) {
				{
				{
				this.state = 576;
				this.structDefinition();
				}
				}
				this.state = 581;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 585;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===46) {
				{
				{
				this.state = 582;
				this.typeDefinition();
				}
				}
				this.state = 587;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 591;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===38) {
				{
				{
				this.state = 588;
				this.eventDefinition();
				}
				}
				this.state = 593;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 597;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===43) {
				{
				{
				this.state = 594;
				this.errorDefinition();
				}
				}
				this.state = 599;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 603;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 55, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 600;
					this.constantDefinition();
					}
					}
				}
				this.state = 605;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 55, this._ctx);
			}
			this.state = 609;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===8) {
				{
				{
				this.state = 606;
				this.usingForDirective();
				}
				}
				this.state = 611;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 615;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 57, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 612;
					this.stateVariableDeclaration();
					}
					}
				}
				this.state = 617;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 57, this._ctx);
			}
			this.state = 621;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===59) {
				{
				{
				this.state = 618;
				this.modifierDefinition();
				}
				}
				this.state = 623;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 625;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===48) {
				{
				this.state = 624;
				this.constructorDefinition();
				}
			}

			this.state = 631;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				this.state = 629;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 60, this._ctx) ) {
				case 1:
					{
					this.state = 627;
					this.functionDefinition();
					}
					break;
				case 2:
					{
					this.state = 628;
					this.abstractFunctionDefinition();
					}
					break;
				}
				}
				this.state = 633;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 635;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 634;
				this.fallbackDefinition();
				}
			}

			this.state = 638;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===52) {
				{
				this.state = 637;
				this.receiveDefinition();
				}
			}

			this.state = 640;
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
	public abstractFunctionDefinition(): AbstractFunctionDefinitionContext {
		let localctx: AbstractFunctionDefinitionContext = new AbstractFunctionDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 38, SolidCashParser.RULE_abstractFunctionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 642;
			this.match(SolidCashParser.T__6);
			this.state = 643;
			this.match(SolidCashParser.Identifier);
			this.state = 644;
			this.parameterList();
			this.state = 648;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 4030070787) !== 0) || ((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & 15) !== 0)) {
				{
				{
				this.state = 645;
				this.functionModifier();
				}
				}
				this.state = 650;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 654;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===173) {
				{
				{
				this.state = 651;
				this.customModifierInvocation();
				}
				}
				this.state = 656;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 658;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 657;
				this.returnType();
				}
			}

			this.state = 660;
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
		this.enterRule(localctx, 40, SolidCashParser.RULE_eventDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 662;
			this.match(SolidCashParser.T__37);
			this.state = 663;
			this.match(SolidCashParser.Identifier);
			this.state = 664;
			this.match(SolidCashParser.T__38);
			this.state = 676;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 74980359) !== 0)) {
				{
				this.state = 665;
				this.eventParameter();
				this.state = 670;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 67, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 666;
						this.match(SolidCashParser.T__4);
						this.state = 667;
						this.eventParameter();
						}
						}
					}
					this.state = 672;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 67, this._ctx);
				}
				this.state = 674;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 673;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 678;
			this.match(SolidCashParser.T__39);
			this.state = 680;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===41) {
				{
				this.state = 679;
				this.match(SolidCashParser.T__40);
				}
			}

			this.state = 682;
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
		this.enterRule(localctx, 42, SolidCashParser.RULE_eventParameter);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 684;
			this.typeName();
			this.state = 686;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 685;
				this.match(SolidCashParser.T__41);
				}
			}

			this.state = 688;
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
		this.enterRule(localctx, 44, SolidCashParser.RULE_errorDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 690;
			this.match(SolidCashParser.T__42);
			this.state = 691;
			this.match(SolidCashParser.Identifier);
			this.state = 692;
			this.match(SolidCashParser.T__38);
			this.state = 704;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 74980359) !== 0)) {
				{
				this.state = 693;
				this.errorParameter();
				this.state = 698;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 72, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 694;
						this.match(SolidCashParser.T__4);
						this.state = 695;
						this.errorParameter();
						}
						}
					}
					this.state = 700;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 72, this._ctx);
				}
				this.state = 702;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 701;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 706;
			this.match(SolidCashParser.T__39);
			this.state = 707;
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
		this.enterRule(localctx, 46, SolidCashParser.RULE_errorParameter);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 709;
			this.typeName();
			this.state = 710;
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
		this.enterRule(localctx, 48, SolidCashParser.RULE_structDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 712;
			this.match(SolidCashParser.T__43);
			this.state = 713;
			this.match(SolidCashParser.Identifier);
			this.state = 714;
			this.match(SolidCashParser.T__3);
			this.state = 716;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 715;
				this.structField();
				}
				}
				this.state = 718;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 74980359) !== 0));
			this.state = 720;
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
		this.enterRule(localctx, 50, SolidCashParser.RULE_structField);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 722;
			this.typeName();
			this.state = 723;
			this.match(SolidCashParser.Identifier);
			this.state = 724;
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
		this.enterRule(localctx, 52, SolidCashParser.RULE_enumDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 726;
			this.match(SolidCashParser.T__44);
			this.state = 727;
			this.match(SolidCashParser.Identifier);
			this.state = 728;
			this.match(SolidCashParser.T__3);
			this.state = 729;
			this.enumMember();
			this.state = 734;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 76, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 730;
					this.match(SolidCashParser.T__4);
					this.state = 731;
					this.enumMember();
					}
					}
				}
				this.state = 736;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 76, this._ctx);
			}
			this.state = 738;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 737;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 740;
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
		this.enterRule(localctx, 54, SolidCashParser.RULE_enumMember);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 742;
			this.match(SolidCashParser.Identifier);
			this.state = 745;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===30) {
				{
				this.state = 743;
				this.match(SolidCashParser.T__29);
				this.state = 744;
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
		this.enterRule(localctx, 56, SolidCashParser.RULE_typeDefinition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 747;
			this.match(SolidCashParser.T__45);
			this.state = 748;
			this.match(SolidCashParser.Identifier);
			this.state = 749;
			this.match(SolidCashParser.T__31);
			this.state = 750;
			this.typeName();
			this.state = 751;
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
		this.enterRule(localctx, 58, SolidCashParser.RULE_constantDefinition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 753;
			this.typeName();
			this.state = 754;
			this.match(SolidCashParser.T__46);
			this.state = 755;
			this.match(SolidCashParser.Identifier);
			this.state = 756;
			this.match(SolidCashParser.T__29);
			this.state = 757;
			this.expression(0);
			this.state = 758;
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
		this.enterRule(localctx, 60, SolidCashParser.RULE_constructorDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 760;
			this.match(SolidCashParser.T__47);
			this.state = 761;
			this.parameterList();
			this.state = 765;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===173) {
				{
				{
				this.state = 762;
				this.parentInvocation();
				}
				}
				this.state = 767;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 768;
			this.match(SolidCashParser.T__3);
			this.state = 772;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				{
				this.state = 769;
				this.statement();
				}
				}
				this.state = 774;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 775;
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
		this.enterRule(localctx, 62, SolidCashParser.RULE_fallbackDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 777;
			this.match(SolidCashParser.T__48);
			this.state = 778;
			this.parameterList();
			this.state = 779;
			this.match(SolidCashParser.T__33);
			this.state = 783;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 131075) !== 0)) {
				{
				{
				this.state = 780;
				this.fallbackModifier();
				}
				}
				this.state = 785;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 789;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===173) {
				{
				{
				this.state = 786;
				this.customModifierInvocation();
				}
				}
				this.state = 791;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 792;
			this.match(SolidCashParser.T__3);
			this.state = 796;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				{
				this.state = 793;
				this.statement();
				}
				}
				this.state = 798;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 799;
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
		this.enterRule(localctx, 64, SolidCashParser.RULE_fallbackModifier);
		try {
			this.state = 804;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 50:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 801;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 51:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 802;
				this.match(SolidCashParser.T__50);
				}
				break;
			case 67:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 803;
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
		this.enterRule(localctx, 66, SolidCashParser.RULE_receiveDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 806;
			this.match(SolidCashParser.T__51);
			this.state = 807;
			this.match(SolidCashParser.T__38);
			this.state = 808;
			this.match(SolidCashParser.T__39);
			this.state = 809;
			this.match(SolidCashParser.T__33);
			this.state = 810;
			this.match(SolidCashParser.T__49);
			this.state = 811;
			this.match(SolidCashParser.T__3);
			this.state = 815;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				{
				this.state = 812;
				this.statement();
				}
				}
				this.state = 817;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 818;
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
		this.enterRule(localctx, 68, SolidCashParser.RULE_parentInvocation);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 820;
			this.match(SolidCashParser.Identifier);
			this.state = 821;
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
		this.enterRule(localctx, 70, SolidCashParser.RULE_stateVariableDeclaration);
		let _la: number;
		try {
			this.state = 873;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 93, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 824;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 3145731) !== 0)) {
					{
					this.state = 823;
					this.stateVariableVisibility();
					}
				}

				this.state = 826;
				this.typeName();
				this.state = 830;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 827;
					this.modifier();
					}
					}
					this.state = 832;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 833;
				this.match(SolidCashParser.Identifier);
				this.state = 834;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 836;
				this.typeName();
				this.state = 837;
				this.stateVariableVisibility();
				this.state = 841;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 838;
					this.modifier();
					}
					}
					this.state = 843;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 844;
				this.match(SolidCashParser.Identifier);
				this.state = 845;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 848;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 3145731) !== 0)) {
					{
					this.state = 847;
					this.stateVariableVisibility();
					}
				}

				this.state = 850;
				this.mappingType();
				this.state = 854;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 3162115) !== 0) || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 851;
					this.collectionModifier();
					}
					}
					this.state = 856;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 857;
				this.match(SolidCashParser.Identifier);
				this.state = 858;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 861;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 3145731) !== 0)) {
					{
					this.state = 860;
					this.stateVariableVisibility();
					}
				}

				this.state = 863;
				this.arrayType(0);
				this.state = 867;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 3162115) !== 0) || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 864;
					this.collectionModifier();
					}
					}
					this.state = 869;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 870;
				this.match(SolidCashParser.Identifier);
				this.state = 871;
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
		this.enterRule(localctx, 72, SolidCashParser.RULE_collectionModifier);
		try {
			this.state = 877;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 47:
			case 143:
			case 144:
			case 145:
			case 146:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 875;
				this.modifier();
				}
				break;
			case 33:
			case 34:
			case 53:
			case 54:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 876;
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
		this.enterRule(localctx, 74, SolidCashParser.RULE_stateVariableVisibility);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 879;
			_la = this._input.LA(1);
			if(!(((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 3145731) !== 0))) {
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
		this.enterRule(localctx, 76, SolidCashParser.RULE_mappingType);
		let _la: number;
		try {
			this.state = 917;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 100, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 881;
				this.match(SolidCashParser.T__54);
				this.state = 882;
				this.match(SolidCashParser.T__38);
				this.state = 883;
				this.typeName();
				this.state = 885;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===173) {
					{
					this.state = 884;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 887;
				this.match(SolidCashParser.T__55);
				this.state = 888;
				this.typeName();
				this.state = 890;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===173) {
					{
					this.state = 889;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 892;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 894;
				this.match(SolidCashParser.T__54);
				this.state = 895;
				this.match(SolidCashParser.T__38);
				this.state = 896;
				this.typeName();
				this.state = 898;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===173) {
					{
					this.state = 897;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 900;
				this.match(SolidCashParser.T__55);
				this.state = 901;
				this.mappingType();
				this.state = 902;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 904;
				this.match(SolidCashParser.T__54);
				this.state = 905;
				this.match(SolidCashParser.T__38);
				this.state = 906;
				this.typeName();
				this.state = 908;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===173) {
					{
					this.state = 907;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 910;
				this.match(SolidCashParser.T__55);
				this.state = 911;
				this.arrayType(0);
				this.state = 913;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===173) {
					{
					this.state = 912;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 915;
				this.match(SolidCashParser.T__39);
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
		let _startState: number = 78;
		this.enterRecursionRule(localctx, 78, SolidCashParser.RULE_arrayType, _p);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 929;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 101, this._ctx) ) {
			case 1:
				{
				this.state = 920;
				this.typeName();
				this.state = 921;
				this.match(SolidCashParser.T__56);
				this.state = 922;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 923;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 2:
				{
				this.state = 925;
				this.typeName();
				this.state = 926;
				this.match(SolidCashParser.T__56);
				this.state = 927;
				this.match(SolidCashParser.T__57);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 940;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 103, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 938;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 102, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 931;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 932;
						this.match(SolidCashParser.T__56);
						this.state = 933;
						this.match(SolidCashParser.NumberLiteral);
						this.state = 934;
						this.match(SolidCashParser.T__57);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 935;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 936;
						this.match(SolidCashParser.T__56);
						this.state = 937;
						this.match(SolidCashParser.T__57);
						}
						break;
					}
					}
				}
				this.state = 942;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 103, this._ctx);
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
		this.enterRule(localctx, 80, SolidCashParser.RULE_modifierDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 943;
			this.match(SolidCashParser.T__58);
			this.state = 944;
			this.match(SolidCashParser.Identifier);
			this.state = 946;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===39) {
				{
				this.state = 945;
				this.parameterList();
				}
			}

			this.state = 948;
			this.match(SolidCashParser.T__3);
			this.state = 952;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2149845121) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				{
				this.state = 949;
				this.modifierStatement();
				}
				}
				this.state = 954;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 955;
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
		this.enterRule(localctx, 82, SolidCashParser.RULE_modifierStatement);
		try {
			this.state = 959;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 60:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 957;
				this.placeholderStatement();
				}
				break;
			case 7:
			case 9:
			case 14:
			case 27:
			case 39:
			case 46:
			case 50:
			case 57:
			case 70:
			case 71:
			case 72:
			case 88:
			case 89:
			case 90:
			case 95:
			case 96:
			case 97:
			case 98:
			case 99:
			case 100:
			case 104:
			case 106:
			case 107:
			case 108:
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
			case 126:
			case 135:
			case 147:
			case 148:
			case 149:
			case 151:
			case 153:
			case 154:
			case 157:
			case 158:
			case 159:
			case 161:
			case 162:
			case 163:
			case 165:
			case 166:
			case 167:
			case 168:
			case 169:
			case 170:
			case 171:
			case 172:
			case 173:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 958;
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
		this.enterRule(localctx, 84, SolidCashParser.RULE_placeholderStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 961;
			this.match(SolidCashParser.T__59);
			this.state = 962;
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
		this.enterRule(localctx, 86, SolidCashParser.RULE_functionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 964;
			this.match(SolidCashParser.T__6);
			this.state = 965;
			this.match(SolidCashParser.Identifier);
			this.state = 966;
			this.parameterList();
			this.state = 970;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 4030070787) !== 0) || ((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & 15) !== 0)) {
				{
				{
				this.state = 967;
				this.functionModifier();
				}
				}
				this.state = 972;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 976;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===173) {
				{
				{
				this.state = 973;
				this.customModifierInvocation();
				}
				}
				this.state = 978;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 980;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 979;
				this.returnType();
				}
			}

			this.state = 982;
			this.match(SolidCashParser.T__3);
			this.state = 986;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				{
				this.state = 983;
				this.statement();
				}
				}
				this.state = 988;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 989;
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
		this.enterRule(localctx, 88, SolidCashParser.RULE_customModifierInvocation);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 991;
			this.match(SolidCashParser.Identifier);
			this.state = 993;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===39) {
				{
				this.state = 992;
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
		this.enterRule(localctx, 90, SolidCashParser.RULE_functionModifier);
		try {
			this.state = 1009;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 61:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 995;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 62:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 996;
				this.match(SolidCashParser.T__61);
				}
				break;
			case 53:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 997;
				this.match(SolidCashParser.T__52);
				}
				break;
			case 34:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 998;
				this.match(SolidCashParser.T__33);
				}
				break;
			case 33:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 999;
				this.match(SolidCashParser.T__32);
				}
				break;
			case 54:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1000;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 50:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1001;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 67:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1002;
				this.overrideSpecifier();
				}
				break;
			case 51:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1003;
				this.match(SolidCashParser.T__50);
				}
				break;
			case 68:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1004;
				this.unsafeModifier();
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1005;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 64:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1006;
				this.match(SolidCashParser.T__63);
				}
				break;
			case 65:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1007;
				this.match(SolidCashParser.T__64);
				}
				break;
			case 66:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1008;
				this.match(SolidCashParser.T__65);
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
		this.enterRule(localctx, 92, SolidCashParser.RULE_overrideSpecifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1011;
			this.match(SolidCashParser.T__66);
			this.state = 1022;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===39) {
				{
				this.state = 1012;
				this.match(SolidCashParser.T__38);
				this.state = 1013;
				this.match(SolidCashParser.Identifier);
				this.state = 1018;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1014;
					this.match(SolidCashParser.T__4);
					this.state = 1015;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1020;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1021;
				this.match(SolidCashParser.T__39);
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
		this.enterRule(localctx, 94, SolidCashParser.RULE_unsafeModifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1024;
			this.match(SolidCashParser.T__67);
			this.state = 1028;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===39) {
				{
				this.state = 1025;
				this.match(SolidCashParser.T__38);
				this.state = 1026;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1027;
				this.match(SolidCashParser.T__39);
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
		this.enterRule(localctx, 96, SolidCashParser.RULE_returnType);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1030;
			this.match(SolidCashParser.T__68);
			this.state = 1031;
			this.match(SolidCashParser.T__38);
			this.state = 1032;
			this.returnParam();
			this.state = 1037;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 116, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1033;
					this.match(SolidCashParser.T__4);
					this.state = 1034;
					this.returnParam();
					}
					}
				}
				this.state = 1039;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 116, this._ctx);
			}
			this.state = 1041;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1040;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1043;
			this.match(SolidCashParser.T__39);
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
		this.enterRule(localctx, 98, SolidCashParser.RULE_returnParam);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1045;
			this.typeName();
			this.state = 1049;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
				{
				{
				this.state = 1046;
				this.modifier();
				}
				}
				this.state = 1051;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1053;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===173) {
				{
				this.state = 1052;
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
	public parameterList(): ParameterListContext {
		let localctx: ParameterListContext = new ParameterListContext(this, this._ctx, this.state);
		this.enterRule(localctx, 100, SolidCashParser.RULE_parameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1055;
			this.match(SolidCashParser.T__38);
			this.state = 1067;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 74980359) !== 0)) {
				{
				this.state = 1056;
				this.parameter();
				this.state = 1061;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 120, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1057;
						this.match(SolidCashParser.T__4);
						this.state = 1058;
						this.parameter();
						}
						}
					}
					this.state = 1063;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 120, this._ctx);
				}
				this.state = 1065;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1064;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1069;
			this.match(SolidCashParser.T__39);
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
		this.enterRule(localctx, 102, SolidCashParser.RULE_parameter);
		let _la: number;
		try {
			this.state = 1089;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 125, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1071;
				this.typeName();
				this.state = 1075;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 1072;
					this.modifier();
					}
					}
					this.state = 1077;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1078;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1080;
				this.arrayType(0);
				this.state = 1084;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 1081;
					this.modifier();
					}
					}
					this.state = 1086;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1087;
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
	public block(): BlockContext {
		let localctx: BlockContext = new BlockContext(this, this._ctx, this.state);
		this.enterRule(localctx, 104, SolidCashParser.RULE_block);
		let _la: number;
		try {
			this.state = 1100;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1091;
				this.match(SolidCashParser.T__3);
				this.state = 1095;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
					{
					{
					this.state = 1092;
					this.statement();
					}
					}
					this.state = 1097;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1098;
				this.match(SolidCashParser.T__5);
				}
				break;
			case 7:
			case 9:
			case 14:
			case 27:
			case 39:
			case 46:
			case 50:
			case 57:
			case 70:
			case 71:
			case 72:
			case 88:
			case 89:
			case 90:
			case 95:
			case 96:
			case 97:
			case 98:
			case 99:
			case 100:
			case 104:
			case 106:
			case 107:
			case 108:
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
			case 126:
			case 135:
			case 147:
			case 148:
			case 149:
			case 151:
			case 153:
			case 154:
			case 157:
			case 158:
			case 159:
			case 161:
			case 162:
			case 163:
			case 165:
			case 166:
			case 167:
			case 168:
			case 169:
			case 170:
			case 171:
			case 172:
			case 173:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1099;
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
		this.enterRule(localctx, 106, SolidCashParser.RULE_statement);
		try {
			this.state = 1135;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 128, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1102;
				this.variableDefinition();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1103;
				this.tupleAssignment();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1104;
				this.arrayAssignStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1105;
				this.arrayPushStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1106;
				this.arrayPopStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1107;
				this.arrayDeleteStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1108;
				this.stateArrayPushStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1109;
				this.stateArrayPopStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1110;
				this.assignStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1111;
				this.stateAssignStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1112;
				this.mappingFieldAssignStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1113;
				this.mappingAssignStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1114;
				this.mappingDeleteStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1115;
				this.timeOpStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1116;
				this.requireStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1117;
				this.ifStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1118;
				this.loopStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1119;
				this.consoleStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1120;
				this.emitStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1121;
				this.transferStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1122;
				this.tokenContainerMethodStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1123;
				this.returnStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1124;
				this.functionCallStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1125;
				this.addressMethodStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1126;
				this.assemblyStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1127;
				this.tryCatchStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1128;
				this.revertStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1129;
				this.assertStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1130;
				this.deleteStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1131;
				this.uncheckedStatement();
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 31);
				{
				this.state = 1132;
				this.switchStatement();
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 32);
				{
				this.state = 1133;
				this.breakStatement();
				}
				break;
			case 33:
				this.enterOuterAlt(localctx, 33);
				{
				this.state = 1134;
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
		this.enterRule(localctx, 108, SolidCashParser.RULE_transferStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1137;
			this.match(SolidCashParser.T__69);
			this.state = 1138;
			this.match(SolidCashParser.T__11);
			this.state = 1139;
			this.match(SolidCashParser.Identifier);
			this.state = 1140;
			this.match(SolidCashParser.T__38);
			this.state = 1141;
			this.expression(0);
			this.state = 1142;
			this.match(SolidCashParser.T__4);
			this.state = 1143;
			this.expression(0);
			this.state = 1144;
			this.match(SolidCashParser.T__39);
			this.state = 1145;
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
		this.enterRule(localctx, 110, SolidCashParser.RULE_tokenContainerMethodStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1147;
			this.match(SolidCashParser.T__69);
			this.state = 1148;
			this.match(SolidCashParser.T__11);
			this.state = 1149;
			this.match(SolidCashParser.Identifier);
			this.state = 1150;
			this.match(SolidCashParser.T__56);
			this.state = 1151;
			this.expression(0);
			this.state = 1152;
			this.match(SolidCashParser.T__57);
			this.state = 1153;
			this.match(SolidCashParser.T__11);
			this.state = 1154;
			this.match(SolidCashParser.Identifier);
			this.state = 1155;
			this.match(SolidCashParser.T__38);
			this.state = 1156;
			this.expression(0);
			this.state = 1161;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1157;
				this.match(SolidCashParser.T__4);
				this.state = 1158;
				this.expression(0);
				}
				}
				this.state = 1163;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1164;
			this.match(SolidCashParser.T__39);
			this.state = 1165;
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
		this.enterRule(localctx, 112, SolidCashParser.RULE_returnStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1196;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 133, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1167;
				this.match(SolidCashParser.T__70);
				this.state = 1168;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1169;
				this.match(SolidCashParser.T__70);
				this.state = 1170;
				this.expression(0);
				this.state = 1175;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1171;
					this.match(SolidCashParser.T__4);
					this.state = 1172;
					this.expression(0);
					}
					}
					this.state = 1177;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1178;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1180;
				this.match(SolidCashParser.T__70);
				this.state = 1181;
				this.match(SolidCashParser.T__38);
				this.state = 1182;
				this.expression(0);
				this.state = 1187;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 131, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1183;
						this.match(SolidCashParser.T__4);
						this.state = 1184;
						this.expression(0);
						}
						}
					}
					this.state = 1189;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 131, this._ctx);
				}
				this.state = 1191;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1190;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1193;
				this.match(SolidCashParser.T__39);
				this.state = 1194;
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
		this.enterRule(localctx, 114, SolidCashParser.RULE_functionCallStatement);
		let _la: number;
		try {
			this.state = 1220;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 135, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1198;
				this.match(SolidCashParser.Identifier);
				this.state = 1199;
				this.expressionList();
				this.state = 1200;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1202;
				this.match(SolidCashParser.Identifier);
				this.state = 1203;
				this.match(SolidCashParser.T__11);
				this.state = 1204;
				this.match(SolidCashParser.Identifier);
				this.state = 1205;
				this.expressionList();
				this.state = 1206;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1208;
				this.match(SolidCashParser.Identifier);
				this.state = 1209;
				this.expressionList();
				this.state = 1210;
				this.match(SolidCashParser.T__11);
				this.state = 1211;
				this.match(SolidCashParser.Identifier);
				this.state = 1212;
				this.match(SolidCashParser.T__11);
				this.state = 1213;
				this.match(SolidCashParser.Identifier);
				this.state = 1215;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1214;
					this.callOptions();
					}
				}

				this.state = 1217;
				this.expressionList();
				this.state = 1218;
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
		this.enterRule(localctx, 116, SolidCashParser.RULE_addressMethodStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1222;
			this.expression(0);
			this.state = 1223;
			this.match(SolidCashParser.T__11);
			this.state = 1224;
			this.match(SolidCashParser.Identifier);
			this.state = 1226;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===4) {
				{
				this.state = 1225;
				this.callOptions();
				}
			}

			this.state = 1228;
			this.expressionList();
			this.state = 1229;
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
		this.enterRule(localctx, 118, SolidCashParser.RULE_emitStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1231;
			this.match(SolidCashParser.T__71);
			this.state = 1232;
			this.match(SolidCashParser.Identifier);
			this.state = 1233;
			this.expressionList();
			this.state = 1234;
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
	public mappingAssignStatement(): MappingAssignStatementContext {
		let localctx: MappingAssignStatementContext = new MappingAssignStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 120, SolidCashParser.RULE_mappingAssignStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1236;
			this.match(SolidCashParser.T__69);
			this.state = 1237;
			this.match(SolidCashParser.T__11);
			this.state = 1238;
			this.match(SolidCashParser.Identifier);
			this.state = 1243;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 1239;
				this.match(SolidCashParser.T__56);
				this.state = 1240;
				this.expression(0);
				this.state = 1241;
				this.match(SolidCashParser.T__57);
				}
				}
				this.state = 1245;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===57);
			this.state = 1247;
			this.match(SolidCashParser.T__29);
			this.state = 1248;
			this.expression(0);
			this.state = 1249;
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
	public mappingFieldAssignStatement(): MappingFieldAssignStatementContext {
		let localctx: MappingFieldAssignStatementContext = new MappingFieldAssignStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 122, SolidCashParser.RULE_mappingFieldAssignStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1251;
			this.match(SolidCashParser.T__69);
			this.state = 1252;
			this.match(SolidCashParser.T__11);
			this.state = 1253;
			this.match(SolidCashParser.Identifier);
			this.state = 1258;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 1254;
				this.match(SolidCashParser.T__56);
				this.state = 1255;
				this.expression(0);
				this.state = 1256;
				this.match(SolidCashParser.T__57);
				}
				}
				this.state = 1260;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===57);
			this.state = 1262;
			this.match(SolidCashParser.T__11);
			this.state = 1263;
			this.match(SolidCashParser.Identifier);
			this.state = 1264;
			this.match(SolidCashParser.T__29);
			this.state = 1265;
			this.expression(0);
			this.state = 1266;
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
	public mappingDeleteStatement(): MappingDeleteStatementContext {
		let localctx: MappingDeleteStatementContext = new MappingDeleteStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 124, SolidCashParser.RULE_mappingDeleteStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1268;
			this.match(SolidCashParser.T__69);
			this.state = 1269;
			this.match(SolidCashParser.T__11);
			this.state = 1270;
			this.match(SolidCashParser.Identifier);
			this.state = 1277;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===57) {
				{
				{
				this.state = 1271;
				this.match(SolidCashParser.T__56);
				this.state = 1272;
				this.expression(0);
				this.state = 1273;
				this.match(SolidCashParser.T__57);
				}
				}
				this.state = 1279;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1280;
			this.match(SolidCashParser.T__72);
			this.state = 1281;
			this.match(SolidCashParser.T__38);
			this.state = 1282;
			this.expression(0);
			this.state = 1283;
			this.match(SolidCashParser.T__39);
			this.state = 1284;
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
	public stateAssignStatement(): StateAssignStatementContext {
		let localctx: StateAssignStatementContext = new StateAssignStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 126, SolidCashParser.RULE_stateAssignStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1286;
			this.match(SolidCashParser.T__69);
			this.state = 1287;
			this.match(SolidCashParser.T__11);
			this.state = 1288;
			this.match(SolidCashParser.Identifier);
			this.state = 1289;
			this.match(SolidCashParser.T__29);
			this.state = 1290;
			this.expression(0);
			this.state = 1291;
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
		this.enterRule(localctx, 128, SolidCashParser.RULE_variableDefinition);
		let _la: number;
		try {
			this.state = 1317;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 142, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1293;
				this.typeName();
				this.state = 1297;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 1294;
					this.modifier();
					}
					}
					this.state = 1299;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1300;
				this.match(SolidCashParser.Identifier);
				this.state = 1301;
				this.match(SolidCashParser.T__29);
				this.state = 1302;
				this.expression(0);
				this.state = 1303;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1305;
				this.arrayType(0);
				this.state = 1309;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 1306;
					this.modifier();
					}
					}
					this.state = 1311;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1312;
				this.match(SolidCashParser.Identifier);
				this.state = 1313;
				this.match(SolidCashParser.T__29);
				this.state = 1314;
				this.expression(0);
				this.state = 1315;
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
		this.enterRule(localctx, 130, SolidCashParser.RULE_tupleAssignment);
		let _la: number;
		try {
			this.state = 1367;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 147, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1319;
				this.typeName();
				this.state = 1320;
				this.match(SolidCashParser.Identifier);
				this.state = 1325;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1321;
					this.match(SolidCashParser.T__4);
					this.state = 1322;
					this.typeName();
					this.state = 1323;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1327;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1329;
				this.match(SolidCashParser.T__29);
				this.state = 1330;
				this.expression(0);
				this.state = 1331;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1333;
				this.match(SolidCashParser.T__38);
				this.state = 1334;
				this.tupleSlot();
				this.state = 1337;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1335;
					this.match(SolidCashParser.T__4);
					this.state = 1336;
					this.tupleSlot();
					}
					}
					this.state = 1339;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1341;
				this.match(SolidCashParser.T__39);
				this.state = 1342;
				this.match(SolidCashParser.T__29);
				this.state = 1343;
				this.match(SolidCashParser.T__38);
				this.state = 1344;
				this.expression(0);
				this.state = 1347;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1345;
					this.match(SolidCashParser.T__4);
					this.state = 1346;
					this.expression(0);
					}
					}
					this.state = 1349;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1351;
				this.match(SolidCashParser.T__39);
				this.state = 1352;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1354;
				this.match(SolidCashParser.T__38);
				this.state = 1355;
				this.tupleSlot();
				this.state = 1358;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1356;
					this.match(SolidCashParser.T__4);
					this.state = 1357;
					this.tupleSlot();
					}
					}
					this.state = 1360;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1362;
				this.match(SolidCashParser.T__39);
				this.state = 1363;
				this.match(SolidCashParser.T__29);
				this.state = 1364;
				this.expression(0);
				this.state = 1365;
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
		this.enterRule(localctx, 132, SolidCashParser.RULE_tupleSlot);
		try {
			this.state = 1374;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 148, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1369;
				this.typeName();
				this.state = 1370;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1372;
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
		this.enterRule(localctx, 134, SolidCashParser.RULE_assignStatement);
		let _la: number;
		try {
			this.state = 1384;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 149, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1376;
				this.match(SolidCashParser.Identifier);
				this.state = 1377;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===30 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1378;
				this.expression(0);
				this.state = 1379;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1381;
				this.match(SolidCashParser.Identifier);
				this.state = 1382;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===84 || _la===85)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1383;
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
		this.enterRule(localctx, 136, SolidCashParser.RULE_arrayPushStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1386;
			this.match(SolidCashParser.Identifier);
			this.state = 1387;
			this.match(SolidCashParser.T__85);
			this.state = 1388;
			this.match(SolidCashParser.T__38);
			this.state = 1389;
			this.expression(0);
			this.state = 1390;
			this.match(SolidCashParser.T__39);
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
	public arrayPopStatement(): ArrayPopStatementContext {
		let localctx: ArrayPopStatementContext = new ArrayPopStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 138, SolidCashParser.RULE_arrayPopStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1393;
			this.match(SolidCashParser.Identifier);
			this.state = 1394;
			this.match(SolidCashParser.T__86);
			this.state = 1395;
			this.match(SolidCashParser.T__38);
			this.state = 1396;
			this.match(SolidCashParser.T__39);
			this.state = 1397;
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
	public arrayAssignStatement(): ArrayAssignStatementContext {
		let localctx: ArrayAssignStatementContext = new ArrayAssignStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 140, SolidCashParser.RULE_arrayAssignStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1399;
			this.match(SolidCashParser.Identifier);
			this.state = 1400;
			this.match(SolidCashParser.T__56);
			this.state = 1401;
			this.expression(0);
			this.state = 1402;
			this.match(SolidCashParser.T__57);
			this.state = 1403;
			this.match(SolidCashParser.T__29);
			this.state = 1404;
			this.expression(0);
			this.state = 1405;
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
			this.state = 1407;
			this.match(SolidCashParser.Identifier);
			this.state = 1408;
			this.match(SolidCashParser.T__72);
			this.state = 1409;
			this.match(SolidCashParser.T__38);
			this.state = 1410;
			this.expression(0);
			this.state = 1411;
			this.match(SolidCashParser.T__39);
			this.state = 1412;
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
			this.state = 1414;
			this.match(SolidCashParser.T__69);
			this.state = 1415;
			this.match(SolidCashParser.T__11);
			this.state = 1416;
			this.match(SolidCashParser.Identifier);
			this.state = 1417;
			this.match(SolidCashParser.T__85);
			this.state = 1418;
			this.match(SolidCashParser.T__38);
			this.state = 1419;
			this.expression(0);
			this.state = 1420;
			this.match(SolidCashParser.T__39);
			this.state = 1421;
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
			this.state = 1423;
			this.match(SolidCashParser.T__69);
			this.state = 1424;
			this.match(SolidCashParser.T__11);
			this.state = 1425;
			this.match(SolidCashParser.Identifier);
			this.state = 1426;
			this.match(SolidCashParser.T__86);
			this.state = 1427;
			this.match(SolidCashParser.T__38);
			this.state = 1428;
			this.match(SolidCashParser.T__39);
			this.state = 1429;
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
			this.state = 1453;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 151, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1431;
				this.match(SolidCashParser.T__87);
				this.state = 1432;
				this.match(SolidCashParser.Identifier);
				this.state = 1433;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1434;
				this.match(SolidCashParser.T__87);
				this.state = 1435;
				this.match(SolidCashParser.T__69);
				this.state = 1436;
				this.match(SolidCashParser.T__11);
				this.state = 1437;
				this.match(SolidCashParser.Identifier);
				this.state = 1438;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1439;
				this.match(SolidCashParser.T__87);
				this.state = 1440;
				this.match(SolidCashParser.T__69);
				this.state = 1441;
				this.match(SolidCashParser.T__11);
				this.state = 1442;
				this.match(SolidCashParser.Identifier);
				this.state = 1447;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1443;
					this.match(SolidCashParser.T__56);
					this.state = 1444;
					this.expression(0);
					this.state = 1445;
					this.match(SolidCashParser.T__57);
					}
					}
					this.state = 1449;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===57);
				this.state = 1451;
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
			this.state = 1455;
			this.match(SolidCashParser.T__88);
			this.state = 1456;
			this.match(SolidCashParser.T__38);
			this.state = 1457;
			this.match(SolidCashParser.TxVar);
			this.state = 1458;
			this.match(SolidCashParser.T__22);
			this.state = 1459;
			this.expression(0);
			this.state = 1462;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1460;
				this.match(SolidCashParser.T__4);
				this.state = 1461;
				this.requireMessage();
				}
			}

			this.state = 1464;
			this.match(SolidCashParser.T__39);
			this.state = 1465;
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
			this.state = 1467;
			this.match(SolidCashParser.T__88);
			this.state = 1468;
			this.match(SolidCashParser.T__38);
			this.state = 1469;
			this.expression(0);
			this.state = 1472;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1470;
				this.match(SolidCashParser.T__4);
				this.state = 1471;
				this.requireMessage();
				}
			}

			this.state = 1474;
			this.match(SolidCashParser.T__39);
			this.state = 1475;
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
			this.state = 1477;
			this.match(SolidCashParser.T__89);
			this.state = 1478;
			this.match(SolidCashParser.T__38);
			this.state = 1479;
			this.expression(0);
			this.state = 1480;
			this.match(SolidCashParser.T__39);
			this.state = 1481;
			localctx._ifBlock = this.block();
			this.state = 1484;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 154, this._ctx) ) {
			case 1:
				{
				this.state = 1482;
				this.match(SolidCashParser.T__90);
				this.state = 1483;
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
			this.state = 1492;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 155, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1486;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1487;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1488;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1489;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1490;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1491;
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
			this.state = 1494;
			this.match(SolidCashParser.T__8);
			this.state = 1495;
			this.match(SolidCashParser.T__38);
			this.state = 1496;
			this.typeName();
			this.state = 1497;
			this.match(SolidCashParser.Identifier);
			this.state = 1498;
			this.match(SolidCashParser.T__4);
			this.state = 1499;
			this.typeName();
			this.state = 1500;
			this.match(SolidCashParser.Identifier);
			this.state = 1501;
			this.match(SolidCashParser.T__91);
			this.state = 1502;
			this.match(SolidCashParser.T__69);
			this.state = 1503;
			this.match(SolidCashParser.T__11);
			this.state = 1504;
			this.match(SolidCashParser.Identifier);
			this.state = 1505;
			this.match(SolidCashParser.T__11);
			this.state = 1506;
			this.match(SolidCashParser.T__92);
			this.state = 1507;
			this.match(SolidCashParser.T__39);
			this.state = 1508;
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
			this.state = 1510;
			this.match(SolidCashParser.T__8);
			this.state = 1511;
			this.match(SolidCashParser.T__38);
			this.state = 1512;
			this.typeName();
			this.state = 1513;
			this.match(SolidCashParser.Identifier);
			this.state = 1514;
			this.match(SolidCashParser.T__93);
			this.state = 1515;
			this.match(SolidCashParser.T__69);
			this.state = 1516;
			this.match(SolidCashParser.T__11);
			this.state = 1517;
			this.match(SolidCashParser.Identifier);
			this.state = 1518;
			this.match(SolidCashParser.T__39);
			this.state = 1519;
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
			this.state = 1521;
			this.match(SolidCashParser.T__8);
			this.state = 1522;
			this.match(SolidCashParser.T__38);
			this.state = 1523;
			this.typeName();
			this.state = 1524;
			this.match(SolidCashParser.Identifier);
			this.state = 1525;
			this.match(SolidCashParser.T__91);
			this.state = 1526;
			this.match(SolidCashParser.T__69);
			this.state = 1527;
			this.match(SolidCashParser.T__11);
			this.state = 1528;
			this.match(SolidCashParser.Identifier);
			this.state = 1529;
			this.match(SolidCashParser.T__39);
			this.state = 1530;
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
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1532;
			this.match(SolidCashParser.T__8);
			this.state = 1533;
			this.match(SolidCashParser.T__38);
			this.state = 1534;
			this.forInit();
			this.state = 1535;
			this.forCondition();
			this.state = 1536;
			this.forUpdate();
			this.state = 1537;
			this.match(SolidCashParser.T__39);
			this.state = 1538;
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
			this.state = 1540;
			this.typeName();
			this.state = 1544;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
				{
				{
				this.state = 1541;
				this.modifier();
				}
				}
				this.state = 1546;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1547;
			this.match(SolidCashParser.Identifier);
			this.state = 1548;
			this.match(SolidCashParser.T__29);
			this.state = 1549;
			this.expression(0);
			this.state = 1550;
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
			this.state = 1552;
			this.expression(0);
			this.state = 1553;
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
			this.state = 1560;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 157, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1555;
				this.match(SolidCashParser.Identifier);
				this.state = 1556;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===30 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1557;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1558;
				this.match(SolidCashParser.Identifier);
				this.state = 1559;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===84 || _la===85)) {
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
			this.state = 1562;
			this.match(SolidCashParser.T__94);
			this.state = 1563;
			this.block();
			this.state = 1564;
			this.match(SolidCashParser.T__95);
			this.state = 1565;
			this.match(SolidCashParser.T__38);
			this.state = 1566;
			this.expression(0);
			this.state = 1567;
			this.match(SolidCashParser.T__39);
			this.state = 1568;
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
			this.state = 1570;
			this.match(SolidCashParser.T__95);
			this.state = 1571;
			this.match(SolidCashParser.T__38);
			this.state = 1572;
			this.expression(0);
			this.state = 1573;
			this.match(SolidCashParser.T__39);
			this.state = 1574;
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
			this.state = 1576;
			this.match(SolidCashParser.T__96);
			this.state = 1577;
			this.consoleParameterList();
			this.state = 1578;
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
			this.state = 1580;
			this.match(SolidCashParser.T__97);
			this.state = 1581;
			this.match(SolidCashParser.T__3);
			this.state = 1585;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 154)) & ~0x1F) === 0 && ((1 << (_la - 154)) & 524801) !== 0)) {
				{
				{
				this.state = 1582;
				this.assemblyToken();
				}
				}
				this.state = 1587;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1588;
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
			this.state = 1590;
			_la = this._input.LA(1);
			if(!(((((_la - 154)) & ~0x1F) === 0 && ((1 << (_la - 154)) & 524801) !== 0))) {
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
			this.state = 1592;
			this.match(SolidCashParser.T__98);
			this.state = 1593;
			this.match(SolidCashParser.T__3);
			this.state = 1597;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				{
				this.state = 1594;
				this.statement();
				}
				}
				this.state = 1599;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1600;
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
			this.state = 1602;
			this.match(SolidCashParser.T__99);
			this.state = 1603;
			this.match(SolidCashParser.T__38);
			this.state = 1604;
			this.expression(0);
			this.state = 1605;
			this.match(SolidCashParser.T__39);
			this.state = 1606;
			this.match(SolidCashParser.T__3);
			this.state = 1610;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===101) {
				{
				{
				this.state = 1607;
				this.switchCase();
				}
				}
				this.state = 1612;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1614;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===103) {
				{
				this.state = 1613;
				this.switchDefault();
				}
			}

			this.state = 1616;
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
			this.state = 1618;
			this.match(SolidCashParser.T__100);
			this.state = 1619;
			this.expression(0);
			this.state = 1620;
			this.match(SolidCashParser.T__101);
			this.state = 1624;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				{
				this.state = 1621;
				this.statement();
				}
				}
				this.state = 1626;
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
			this.state = 1627;
			this.match(SolidCashParser.T__102);
			this.state = 1628;
			this.match(SolidCashParser.T__101);
			this.state = 1632;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				{
				this.state = 1629;
				this.statement();
				}
				}
				this.state = 1634;
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
			this.state = 1635;
			this.match(SolidCashParser.T__103);
			this.state = 1636;
			this.expression(0);
			this.state = 1638;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 1637;
				this.tryReturns();
				}
			}

			this.state = 1640;
			localctx._tryBlock = this.block();
			this.state = 1642;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1641;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1644;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 165, this._ctx);
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
			this.state = 1646;
			this.match(SolidCashParser.T__68);
			this.state = 1647;
			this.match(SolidCashParser.T__38);
			this.state = 1659;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 74980359) !== 0)) {
				{
				this.state = 1648;
				this.parameter();
				this.state = 1653;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1649;
						this.match(SolidCashParser.T__4);
						this.state = 1650;
						this.parameter();
						}
						}
					}
					this.state = 1655;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
				}
				this.state = 1657;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1656;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1661;
			this.match(SolidCashParser.T__39);
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
			this.state = 1663;
			this.match(SolidCashParser.T__104);
			this.state = 1665;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 169, this._ctx) ) {
			case 1:
				{
				this.state = 1664;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 1682;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 173, this._ctx) ) {
			case 1:
				{
				this.state = 1667;
				this.match(SolidCashParser.T__38);
				this.state = 1679;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 74980359) !== 0)) {
					{
					this.state = 1668;
					this.parameter();
					this.state = 1673;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 170, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1669;
							this.match(SolidCashParser.T__4);
							this.state = 1670;
							this.parameter();
							}
							}
						}
						this.state = 1675;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 170, this._ctx);
					}
					this.state = 1677;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1676;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1681;
				this.match(SolidCashParser.T__39);
				}
				break;
			}
			this.state = 1684;
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
			this.state = 1686;
			this.match(SolidCashParser.T__105);
			this.state = 1687;
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
			this.state = 1689;
			this.match(SolidCashParser.T__106);
			this.state = 1690;
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
			this.state = 1695;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 161:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1692;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 173:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1693;
				this.match(SolidCashParser.Identifier);
				this.state = 1694;
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
		try {
			this.state = 1711;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 175, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1697;
				this.match(SolidCashParser.T__107);
				this.state = 1698;
				this.match(SolidCashParser.Identifier);
				this.state = 1699;
				this.expressionList();
				this.state = 1700;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1702;
				this.match(SolidCashParser.T__107);
				this.state = 1703;
				this.match(SolidCashParser.T__38);
				this.state = 1704;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1705;
				this.match(SolidCashParser.T__39);
				this.state = 1706;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1707;
				this.match(SolidCashParser.T__107);
				this.state = 1708;
				this.match(SolidCashParser.T__38);
				this.state = 1709;
				this.match(SolidCashParser.T__39);
				this.state = 1710;
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
			this.state = 1713;
			this.match(SolidCashParser.T__108);
			this.state = 1714;
			this.match(SolidCashParser.T__38);
			this.state = 1715;
			this.expression(0);
			this.state = 1716;
			this.match(SolidCashParser.T__39);
			this.state = 1717;
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
			this.state = 1721;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 173:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1719;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 151:
			case 153:
			case 154:
			case 161:
			case 162:
			case 163:
			case 171:
			case 172:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1720;
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
			this.state = 1723;
			this.match(SolidCashParser.T__38);
			this.state = 1735;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 7347213) !== 0)) {
				{
				this.state = 1724;
				this.consoleParameter();
				this.state = 1729;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 177, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1725;
						this.match(SolidCashParser.T__4);
						this.state = 1726;
						this.consoleParameter();
						}
						}
					}
					this.state = 1731;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 177, this._ctx);
				}
				this.state = 1733;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1732;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1737;
			this.match(SolidCashParser.T__39);
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
			this.state = 1763;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 183, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1739;
				this.match(SolidCashParser.Identifier);
				this.state = 1740;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1741;
				this.match(SolidCashParser.Identifier);
				this.state = 1742;
				this.match(SolidCashParser.T__11);
				this.state = 1743;
				this.match(SolidCashParser.Identifier);
				this.state = 1744;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1745;
				this.match(SolidCashParser.Identifier);
				this.state = 1746;
				this.match(SolidCashParser.T__38);
				this.state = 1747;
				this.match(SolidCashParser.T__3);
				this.state = 1759;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===173) {
					{
					this.state = 1748;
					this.namedArg();
					this.state = 1753;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 180, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1749;
							this.match(SolidCashParser.T__4);
							this.state = 1750;
							this.namedArg();
							}
							}
						}
						this.state = 1755;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 180, this._ctx);
					}
					this.state = 1757;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1756;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1761;
				this.match(SolidCashParser.T__5);
				this.state = 1762;
				this.match(SolidCashParser.T__39);
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
			this.state = 1765;
			this.match(SolidCashParser.Identifier);
			this.state = 1766;
			this.match(SolidCashParser.T__101);
			this.state = 1767;
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
			this.state = 1769;
			this.match(SolidCashParser.T__38);
			this.state = 1781;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===14 || _la===27 || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 110)) & ~0x1F) === 0 && ((1 << (_la - 110)) & 33622015) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				this.state = 1770;
				this.expression(0);
				this.state = 1775;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 184, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1771;
						this.match(SolidCashParser.T__4);
						this.state = 1772;
						this.expression(0);
						}
						}
					}
					this.state = 1777;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 184, this._ctx);
				}
				this.state = 1779;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1778;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1783;
			this.match(SolidCashParser.T__39);
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
			this.state = 1785;
			this.match(SolidCashParser.T__3);
			this.state = 1786;
			this.callOption();
			this.state = 1791;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 187, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1787;
					this.match(SolidCashParser.T__4);
					this.state = 1788;
					this.callOption();
					}
					}
				}
				this.state = 1793;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 187, this._ctx);
			}
			this.state = 1795;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1794;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1797;
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
			this.state = 1799;
			this.match(SolidCashParser.Identifier);
			this.state = 1800;
			this.match(SolidCashParser.T__101);
			this.state = 1801;
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
			this.state = 1803;
			this.match(SolidCashParser.T__38);
			this.state = 1804;
			this.typeName();
			this.state = 1809;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 189, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1805;
					this.match(SolidCashParser.T__4);
					this.state = 1806;
					this.typeName();
					}
					}
				}
				this.state = 1811;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 189, this._ctx);
			}
			this.state = 1813;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1812;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1815;
			this.match(SolidCashParser.T__39);
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
			this.state = 1945;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 197, this._ctx) ) {
			case 1:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 1818;
				this.match(SolidCashParser.T__38);
				this.state = 1819;
				this.expression(0);
				this.state = 1820;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 2:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1822;
				this.typeCast();
				this.state = 1823;
				this.match(SolidCashParser.T__38);
				this.state = 1824;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 1826;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1825;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1828;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 3:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1830;
				this.functionCall();
				}
				break;
			case 4:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1831;
				this.match(SolidCashParser.T__109);
				this.state = 1832;
				this.match(SolidCashParser.Identifier);
				this.state = 1834;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1833;
					this.callOptions();
					}
				}

				this.state = 1836;
				this.expressionList();
				}
				break;
			case 5:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1837;
				this.match(SolidCashParser.T__109);
				this.state = 1838;
				this.typeName();
				this.state = 1839;
				this.match(SolidCashParser.T__56);
				this.state = 1840;
				this.match(SolidCashParser.T__57);
				this.state = 1841;
				this.match(SolidCashParser.T__38);
				this.state = 1842;
				this.expression(0);
				this.state = 1843;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 6:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1845;
				this.match(SolidCashParser.T__45);
				this.state = 1846;
				this.match(SolidCashParser.T__38);
				this.state = 1847;
				this.typeName();
				this.state = 1848;
				this.match(SolidCashParser.T__39);
				this.state = 1849;
				this.match(SolidCashParser.T__11);
				this.state = 1850;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 7:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1852;
				this.match(SolidCashParser.T__110);
				this.state = 1853;
				this.expressionList();
				}
				break;
			case 8:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1854;
				this.match(SolidCashParser.T__111);
				this.state = 1855;
				this.expressionList();
				}
				break;
			case 9:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1856;
				this.match(SolidCashParser.T__112);
				this.state = 1857;
				this.expressionList();
				}
				break;
			case 10:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1858;
				this.match(SolidCashParser.T__113);
				this.state = 1859;
				this.expressionList();
				}
				break;
			case 11:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1860;
				this.match(SolidCashParser.T__114);
				this.state = 1861;
				this.match(SolidCashParser.T__38);
				this.state = 1862;
				this.match(SolidCashParser.Identifier);
				this.state = 1863;
				this.match(SolidCashParser.T__11);
				this.state = 1864;
				this.match(SolidCashParser.Identifier);
				this.state = 1865;
				this.match(SolidCashParser.T__4);
				this.state = 1866;
				this.expressionList();
				this.state = 1867;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 12:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1869;
				this.match(SolidCashParser.T__115);
				this.state = 1870;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1871;
				this.match(SolidCashParser.T__116);
				this.state = 1872;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1873;
				this.match(SolidCashParser.T__117);
				this.state = 1874;
				this.match(SolidCashParser.T__38);
				this.state = 1875;
				this.expression(0);
				this.state = 1876;
				this.match(SolidCashParser.T__4);
				this.state = 1877;
				this.typeList();
				this.state = 1878;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 15:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1880;
				this.match(SolidCashParser.T__118);
				this.state = 1881;
				this.match(SolidCashParser.T__38);
				this.state = 1882;
				this.expression(0);
				this.state = 1883;
				this.match(SolidCashParser.T__4);
				this.state = 1884;
				this.typeList();
				this.state = 1885;
				this.match(SolidCashParser.T__4);
				this.state = 1886;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1887;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 16:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1889;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__119);
				this.state = 1890;
				this.match(SolidCashParser.T__56);
				this.state = 1891;
				this.expression(0);
				this.state = 1892;
				this.match(SolidCashParser.T__57);
				this.state = 1893;
				(localctx as UnaryIntrospectionOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 121)) & ~0x1F) === 0 && ((1 << (_la - 121)) & 31) !== 0))) {
				    (localctx as UnaryIntrospectionOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				break;
			case 17:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1895;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__125);
				this.state = 1896;
				this.match(SolidCashParser.T__56);
				this.state = 1897;
				this.expression(0);
				this.state = 1898;
				this.match(SolidCashParser.T__57);
				this.state = 1899;
				(localctx as UnaryIntrospectionOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 121)) & ~0x1F) === 0 && ((1 << (_la - 121)) & 991) !== 0))) {
				    (localctx as UnaryIntrospectionOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				break;
			case 18:
				{
				localctx = new UnaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1901;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===135)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1902;
				this.expression(20);
				}
				break;
			case 19:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1903;
				this.match(SolidCashParser.T__56);
				this.state = 1915;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===14 || _la===27 || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 110)) & ~0x1F) === 0 && ((1 << (_la - 110)) & 33622015) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
					{
					this.state = 1904;
					this.expression(0);
					this.state = 1909;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 193, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1905;
							this.match(SolidCashParser.T__4);
							this.state = 1906;
							this.expression(0);
							}
							}
						}
						this.state = 1911;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 193, this._ctx);
					}
					this.state = 1913;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1912;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1917;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 20:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1918;
				this.match(SolidCashParser.T__69);
				this.state = 1919;
				this.match(SolidCashParser.T__11);
				this.state = 1920;
				this.match(SolidCashParser.Identifier);
				this.state = 1921;
				this.match(SolidCashParser.T__11);
				this.state = 1922;
				this.match(SolidCashParser.Identifier);
				this.state = 1923;
				this.match(SolidCashParser.T__56);
				this.state = 1924;
				this.expression(0);
				this.state = 1925;
				this.match(SolidCashParser.T__57);
				this.state = 1926;
				this.memberName();
				}
				break;
			case 21:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1928;
				this.match(SolidCashParser.T__69);
				this.state = 1929;
				this.match(SolidCashParser.T__11);
				this.state = 1930;
				this.match(SolidCashParser.Identifier);
				this.state = 1935;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 1931;
						this.match(SolidCashParser.T__56);
						this.state = 1932;
						this.expression(0);
						this.state = 1933;
						this.match(SolidCashParser.T__57);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 1937;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 196, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 22:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1939;
				this.match(SolidCashParser.T__69);
				this.state = 1940;
				this.match(SolidCashParser.T__11);
				this.state = 1941;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 23:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1942;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 24:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1943;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 25:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1944;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2029;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 200, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2027;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 199, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1947;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 1948;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 1949;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1950;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 1951;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1952;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1953;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 1954;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1955;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1956;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 1957;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===136 || _la===137)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1958;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1959;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 1960;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1961;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1962;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 1963;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1964;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1965;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 1966;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 1967;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1968;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 1969;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 1970;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1971;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 1972;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 1973;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1974;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 1975;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__137);
						this.state = 1976;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1977;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 1978;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__138);
						this.state = 1979;
						(localctx as BinaryOpContext)._right = this.expression(10);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1980;
						if (!(this.precpred(this._ctx, 8))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 8)");
						}
						this.state = 1981;
						this.match(SolidCashParser.T__139);
						this.state = 1982;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 1983;
						this.match(SolidCashParser.T__101);
						this.state = 1984;
						(localctx as TernaryOpContext)._ifFalse = this.expression(8);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1986;
						if (!(this.precpred(this._ctx, 30))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 30)");
						}
						this.state = 1987;
						this.match(SolidCashParser.T__56);
						this.state = 1988;
						(localctx as IndexRangeSliceContext)._start = this.expression(0);
						this.state = 1989;
						this.match(SolidCashParser.T__101);
						this.state = 1990;
						(localctx as IndexRangeSliceContext)._end = this.expression(0);
						this.state = 1991;
						this.match(SolidCashParser.T__57);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1993;
						if (!(this.precpred(this._ctx, 29))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 29)");
						}
						this.state = 1994;
						this.match(SolidCashParser.T__56);
						this.state = 1995;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 1996;
						this.match(SolidCashParser.T__57);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1997;
						if (!(this.precpred(this._ctx, 28))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 28)");
						}
						this.state = 1998;
						this.match(SolidCashParser.T__56);
						this.state = 1999;
						this.expression(0);
						this.state = 2000;
						this.match(SolidCashParser.T__57);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2002;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2003;
						(localctx as UnaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===131 || _la===132)) {
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
						this.state = 2004;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2005;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__132);
						this.state = 2006;
						this.match(SolidCashParser.T__38);
						this.state = 2007;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2008;
						this.match(SolidCashParser.T__39);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2010;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2011;
						this.match(SolidCashParser.T__133);
						this.state = 2012;
						this.match(SolidCashParser.T__38);
						this.state = 2013;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2014;
						this.match(SolidCashParser.T__4);
						this.state = 2015;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2016;
						this.match(SolidCashParser.T__39);
						}
						break;
					case 19:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2018;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 2019;
						this.match(SolidCashParser.T__11);
						this.state = 2020;
						this.match(SolidCashParser.Identifier);
						this.state = 2022;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2021;
							this.callOptions();
							}
						}

						this.state = 2024;
						this.expressionList();
						}
						break;
					case 20:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2025;
						if (!(this.precpred(this._ctx, 21))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 21)");
						}
						this.state = 2026;
						this.memberName();
						}
						break;
					}
					}
				}
				this.state = 2031;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 200, this._ctx);
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
			this.state = 2045;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2032;
				this.match(SolidCashParser.T__11);
				this.state = 2033;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 121:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2034;
				this.match(SolidCashParser.T__120);
				}
				break;
			case 122:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2035;
				this.match(SolidCashParser.T__121);
				}
				break;
			case 123:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2036;
				this.match(SolidCashParser.T__122);
				}
				break;
			case 124:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2037;
				this.match(SolidCashParser.T__123);
				}
				break;
			case 125:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2038;
				this.match(SolidCashParser.T__124);
				}
				break;
			case 127:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2039;
				this.match(SolidCashParser.T__126);
				}
				break;
			case 128:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2040;
				this.match(SolidCashParser.T__127);
				}
				break;
			case 129:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2041;
				this.match(SolidCashParser.T__128);
				}
				break;
			case 130:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2042;
				this.match(SolidCashParser.T__129);
				}
				break;
			case 141:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2043;
				this.match(SolidCashParser.T__140);
				}
				break;
			case 142:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2044;
				this.match(SolidCashParser.T__141);
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
			this.state = 2047;
			_la = this._input.LA(1);
			if(!(_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0))) {
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
			this.state = 2063;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 151:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2049;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 154:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2050;
				this.numberLiteral();
				}
				break;
			case 153:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2051;
				this.decimalLiteral();
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2052;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2056;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 202, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2053;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2058;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 202, this._ctx);
				}
				}
				break;
			case 171:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2059;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 172:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2060;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2061;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2062;
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
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2065;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2067;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 204, this._ctx) ) {
			case 1:
				{
				this.state = 2066;
				this.match(SolidCashParser.NumberUnit);
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
			this.state = 2069;
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
			this.state = 2111;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 209, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2071;
				this.match(SolidCashParser.T__146);
				this.state = 2072;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2073;
				this.match(SolidCashParser.T__146);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2074;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2075;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2076;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2077;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2078;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2079;
				this.match(SolidCashParser.T__147);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2080;
				this.match(SolidCashParser.T__148);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2081;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2082;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2083;
				this.match(SolidCashParser.T__6);
				this.state = 2084;
				this.match(SolidCashParser.T__38);
				this.state = 2093;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 74980359) !== 0)) {
					{
					this.state = 2085;
					this.typeName();
					this.state = 2090;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2086;
						this.match(SolidCashParser.T__4);
						this.state = 2087;
						this.typeName();
						}
						}
						this.state = 2092;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2095;
				this.match(SolidCashParser.T__39);
				this.state = 2108;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===69) {
					{
					this.state = 2096;
					this.match(SolidCashParser.T__68);
					this.state = 2097;
					this.match(SolidCashParser.T__38);
					this.state = 2098;
					this.typeName();
					this.state = 2103;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2099;
						this.match(SolidCashParser.T__4);
						this.state = 2100;
						this.typeName();
						}
						}
						this.state = 2105;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2106;
					this.match(SolidCashParser.T__39);
					}
				}

				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2110;
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
			this.state = 2113;
			_la = this._input.LA(1);
			if(!(_la===50 || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 8133639) !== 0))) {
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
		case 39:
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
			return this.precpred(this._ctx, 19);
		case 3:
			return this.precpred(this._ctx, 18);
		case 4:
			return this.precpred(this._ctx, 17);
		case 5:
			return this.precpred(this._ctx, 16);
		case 6:
			return this.precpred(this._ctx, 15);
		case 7:
			return this.precpred(this._ctx, 14);
		case 8:
			return this.precpred(this._ctx, 13);
		case 9:
			return this.precpred(this._ctx, 12);
		case 10:
			return this.precpred(this._ctx, 11);
		case 11:
			return this.precpred(this._ctx, 10);
		case 12:
			return this.precpred(this._ctx, 9);
		case 13:
			return this.precpred(this._ctx, 8);
		case 14:
			return this.precpred(this._ctx, 30);
		case 15:
			return this.precpred(this._ctx, 29);
		case 16:
			return this.precpred(this._ctx, 28);
		case 17:
			return this.precpred(this._ctx, 25);
		case 18:
			return this.precpred(this._ctx, 24);
		case 19:
			return this.precpred(this._ctx, 23);
		case 20:
			return this.precpred(this._ctx, 22);
		case 21:
			return this.precpred(this._ctx, 21);
		}
		return true;
	}

	public static readonly _serializedATN: number[] = [4,1,176,2116,2,0,7,0,
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
	9,0,1,0,5,0,246,8,0,10,0,12,0,249,9,0,1,0,5,0,252,8,0,10,0,12,0,255,9,0,
	1,0,5,0,258,8,0,10,0,12,0,261,9,0,1,0,5,0,264,8,0,10,0,12,0,267,9,0,1,0,
	5,0,270,8,0,10,0,12,0,273,9,0,1,0,5,0,276,8,0,10,0,12,0,279,9,0,1,0,5,0,
	282,8,0,10,0,12,0,285,9,0,1,0,5,0,288,8,0,10,0,12,0,291,9,0,1,0,5,0,294,
	8,0,10,0,12,0,297,9,0,1,0,5,0,300,8,0,10,0,12,0,303,9,0,1,0,1,0,3,0,307,
	8,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,5,1,324,
	8,1,10,1,12,1,327,9,1,1,1,3,1,330,8,1,1,1,1,1,1,1,1,1,1,1,3,1,337,8,1,1,
	2,1,2,1,2,3,2,342,8,2,1,3,1,3,1,3,1,3,3,3,348,8,3,1,3,1,3,5,3,352,8,3,10,
	3,12,3,355,9,3,1,3,1,3,1,4,1,4,1,4,1,4,1,4,3,4,364,8,4,1,4,3,4,367,8,4,
	1,4,1,4,1,4,1,4,1,4,1,4,5,4,375,8,4,10,4,12,4,378,9,4,1,4,3,4,381,8,4,1,
	4,1,4,1,4,1,4,3,4,387,8,4,1,4,3,4,390,8,4,1,4,1,4,3,4,394,8,4,1,5,1,5,1,
	5,3,5,399,8,5,1,5,1,5,3,5,403,8,5,1,6,1,6,1,7,1,7,1,7,1,7,1,7,1,8,1,8,1,
	9,1,9,3,9,416,8,9,1,10,3,10,419,8,10,1,10,1,10,1,11,1,11,1,12,1,12,1,12,
	1,12,1,12,1,12,5,12,431,8,12,10,12,12,12,434,9,12,3,12,436,8,12,1,12,1,
	12,5,12,440,8,12,10,12,12,12,443,9,12,1,12,5,12,446,8,12,10,12,12,12,449,
	9,12,1,12,5,12,452,8,12,10,12,12,12,455,9,12,1,12,5,12,458,8,12,10,12,12,
	12,461,9,12,1,12,5,12,464,8,12,10,12,12,12,467,9,12,1,12,5,12,470,8,12,
	10,12,12,12,473,9,12,1,12,5,12,476,8,12,10,12,12,12,479,9,12,1,12,1,12,
	1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,3,13,493,8,13,1,14,1,
	14,1,14,1,14,1,14,1,15,1,15,1,16,1,16,1,16,1,16,3,16,506,8,16,1,16,1,16,
	1,17,1,17,1,17,1,17,5,17,514,8,17,10,17,12,17,517,9,17,1,17,5,17,520,8,
	17,10,17,12,17,523,9,17,1,17,5,17,526,8,17,10,17,12,17,529,9,17,1,17,5,
	17,532,8,17,10,17,12,17,535,9,17,1,17,5,17,538,8,17,10,17,12,17,541,9,17,
	1,17,5,17,544,8,17,10,17,12,17,547,9,17,1,17,1,17,1,18,3,18,552,8,18,1,
	18,1,18,1,18,3,18,557,8,18,1,18,1,18,1,18,1,18,5,18,563,8,18,10,18,12,18,
	566,9,18,3,18,568,8,18,1,18,1,18,5,18,572,8,18,10,18,12,18,575,9,18,1,18,
	5,18,578,8,18,10,18,12,18,581,9,18,1,18,5,18,584,8,18,10,18,12,18,587,9,
	18,1,18,5,18,590,8,18,10,18,12,18,593,9,18,1,18,5,18,596,8,18,10,18,12,
	18,599,9,18,1,18,5,18,602,8,18,10,18,12,18,605,9,18,1,18,5,18,608,8,18,
	10,18,12,18,611,9,18,1,18,5,18,614,8,18,10,18,12,18,617,9,18,1,18,5,18,
	620,8,18,10,18,12,18,623,9,18,1,18,3,18,626,8,18,1,18,1,18,5,18,630,8,18,
	10,18,12,18,633,9,18,1,18,3,18,636,8,18,1,18,3,18,639,8,18,1,18,1,18,1,
	19,1,19,1,19,1,19,5,19,647,8,19,10,19,12,19,650,9,19,1,19,5,19,653,8,19,
	10,19,12,19,656,9,19,1,19,3,19,659,8,19,1,19,1,19,1,20,1,20,1,20,1,20,1,
	20,1,20,5,20,669,8,20,10,20,12,20,672,9,20,1,20,3,20,675,8,20,3,20,677,
	8,20,1,20,1,20,3,20,681,8,20,1,20,1,20,1,21,1,21,3,21,687,8,21,1,21,1,21,
	1,22,1,22,1,22,1,22,1,22,1,22,5,22,697,8,22,10,22,12,22,700,9,22,1,22,3,
	22,703,8,22,3,22,705,8,22,1,22,1,22,1,22,1,23,1,23,1,23,1,24,1,24,1,24,
	1,24,4,24,717,8,24,11,24,12,24,718,1,24,1,24,1,25,1,25,1,25,1,25,1,26,1,
	26,1,26,1,26,1,26,1,26,5,26,733,8,26,10,26,12,26,736,9,26,1,26,3,26,739,
	8,26,1,26,1,26,1,27,1,27,1,27,3,27,746,8,27,1,28,1,28,1,28,1,28,1,28,1,
	28,1,29,1,29,1,29,1,29,1,29,1,29,1,29,1,30,1,30,1,30,5,30,764,8,30,10,30,
	12,30,767,9,30,1,30,1,30,5,30,771,8,30,10,30,12,30,774,9,30,1,30,1,30,1,
	31,1,31,1,31,1,31,5,31,782,8,31,10,31,12,31,785,9,31,1,31,5,31,788,8,31,
	10,31,12,31,791,9,31,1,31,1,31,5,31,795,8,31,10,31,12,31,798,9,31,1,31,
	1,31,1,32,1,32,1,32,3,32,805,8,32,1,33,1,33,1,33,1,33,1,33,1,33,1,33,5,
	33,814,8,33,10,33,12,33,817,9,33,1,33,1,33,1,34,1,34,1,34,1,35,3,35,825,
	8,35,1,35,1,35,5,35,829,8,35,10,35,12,35,832,9,35,1,35,1,35,1,35,1,35,1,
	35,1,35,5,35,840,8,35,10,35,12,35,843,9,35,1,35,1,35,1,35,1,35,3,35,849,
	8,35,1,35,1,35,5,35,853,8,35,10,35,12,35,856,9,35,1,35,1,35,1,35,1,35,3,
	35,862,8,35,1,35,1,35,5,35,866,8,35,10,35,12,35,869,9,35,1,35,1,35,1,35,
	3,35,874,8,35,1,36,1,36,3,36,878,8,36,1,37,1,37,1,38,1,38,1,38,1,38,3,38,
	886,8,38,1,38,1,38,1,38,3,38,891,8,38,1,38,1,38,1,38,1,38,1,38,1,38,3,38,
	899,8,38,1,38,1,38,1,38,1,38,1,38,1,38,1,38,1,38,3,38,909,8,38,1,38,1,38,
	1,38,3,38,914,8,38,1,38,1,38,3,38,918,8,38,1,39,1,39,1,39,1,39,1,39,1,39,
	1,39,1,39,1,39,1,39,3,39,930,8,39,1,39,1,39,1,39,1,39,1,39,1,39,1,39,5,
	39,939,8,39,10,39,12,39,942,9,39,1,40,1,40,1,40,3,40,947,8,40,1,40,1,40,
	5,40,951,8,40,10,40,12,40,954,9,40,1,40,1,40,1,41,1,41,3,41,960,8,41,1,
	42,1,42,1,42,1,43,1,43,1,43,1,43,5,43,969,8,43,10,43,12,43,972,9,43,1,43,
	5,43,975,8,43,10,43,12,43,978,9,43,1,43,3,43,981,8,43,1,43,1,43,5,43,985,
	8,43,10,43,12,43,988,9,43,1,43,1,43,1,44,1,44,3,44,994,8,44,1,45,1,45,1,
	45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,3,45,1010,8,45,
	1,46,1,46,1,46,1,46,1,46,5,46,1017,8,46,10,46,12,46,1020,9,46,1,46,3,46,
	1023,8,46,1,47,1,47,1,47,1,47,3,47,1029,8,47,1,48,1,48,1,48,1,48,1,48,5,
	48,1036,8,48,10,48,12,48,1039,9,48,1,48,3,48,1042,8,48,1,48,1,48,1,49,1,
	49,5,49,1048,8,49,10,49,12,49,1051,9,49,1,49,3,49,1054,8,49,1,50,1,50,1,
	50,1,50,5,50,1060,8,50,10,50,12,50,1063,9,50,1,50,3,50,1066,8,50,3,50,1068,
	8,50,1,50,1,50,1,51,1,51,5,51,1074,8,51,10,51,12,51,1077,9,51,1,51,1,51,
	1,51,1,51,5,51,1083,8,51,10,51,12,51,1086,9,51,1,51,1,51,3,51,1090,8,51,
	1,52,1,52,5,52,1094,8,52,10,52,12,52,1097,9,52,1,52,1,52,3,52,1101,8,52,
	1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,
	53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,
	1,53,1,53,1,53,1,53,3,53,1136,8,53,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,
	54,1,54,1,54,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,
	5,55,1160,8,55,10,55,12,55,1163,9,55,1,55,1,55,1,55,1,56,1,56,1,56,1,56,
	1,56,1,56,5,56,1174,8,56,10,56,12,56,1177,9,56,1,56,1,56,1,56,1,56,1,56,
	1,56,1,56,5,56,1186,8,56,10,56,12,56,1189,9,56,1,56,3,56,1192,8,56,1,56,
	1,56,1,56,3,56,1197,8,56,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,
	57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,3,57,1216,8,57,1,57,1,57,1,57,3,57,
	1221,8,57,1,58,1,58,1,58,1,58,3,58,1227,8,58,1,58,1,58,1,58,1,59,1,59,1,
	59,1,59,1,59,1,60,1,60,1,60,1,60,1,60,1,60,1,60,4,60,1244,8,60,11,60,12,
	60,1245,1,60,1,60,1,60,1,60,1,61,1,61,1,61,1,61,1,61,1,61,1,61,4,61,1259,
	8,61,11,61,12,61,1260,1,61,1,61,1,61,1,61,1,61,1,61,1,62,1,62,1,62,1,62,
	1,62,1,62,1,62,5,62,1276,8,62,10,62,12,62,1279,9,62,1,62,1,62,1,62,1,62,
	1,62,1,62,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,64,1,64,5,64,1296,8,64,10,
	64,12,64,1299,9,64,1,64,1,64,1,64,1,64,1,64,1,64,1,64,5,64,1308,8,64,10,
	64,12,64,1311,9,64,1,64,1,64,1,64,1,64,1,64,3,64,1318,8,64,1,65,1,65,1,
	65,1,65,1,65,1,65,4,65,1326,8,65,11,65,12,65,1327,1,65,1,65,1,65,1,65,1,
	65,1,65,1,65,1,65,4,65,1338,8,65,11,65,12,65,1339,1,65,1,65,1,65,1,65,1,
	65,1,65,4,65,1348,8,65,11,65,12,65,1349,1,65,1,65,1,65,1,65,1,65,1,65,1,
	65,4,65,1359,8,65,11,65,12,65,1360,1,65,1,65,1,65,1,65,1,65,3,65,1368,8,
	65,1,66,1,66,1,66,1,66,1,66,3,66,1375,8,66,1,67,1,67,1,67,1,67,1,67,1,67,
	1,67,1,67,3,67,1385,8,67,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,69,1,69,1,
	69,1,69,1,69,1,69,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,71,1,71,1,71,
	1,71,1,71,1,71,1,71,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,73,1,
	73,1,73,1,73,1,73,1,73,1,73,1,73,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,
	1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,4,74,1448,8,74,11,74,12,74,1449,
	1,74,1,74,3,74,1454,8,74,1,75,1,75,1,75,1,75,1,75,1,75,1,75,3,75,1463,8,
	75,1,75,1,75,1,75,1,76,1,76,1,76,1,76,1,76,3,76,1473,8,76,1,76,1,76,1,76,
	1,77,1,77,1,77,1,77,1,77,1,77,1,77,3,77,1485,8,77,1,78,1,78,1,78,1,78,1,
	78,1,78,3,78,1493,8,78,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,
	1,79,1,79,1,79,1,79,1,79,1,79,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,
	80,1,80,1,80,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,82,
	1,82,1,82,1,82,1,82,1,82,1,82,1,82,1,83,1,83,5,83,1543,8,83,10,83,12,83,
	1546,9,83,1,83,1,83,1,83,1,83,1,83,1,84,1,84,1,84,1,85,1,85,1,85,1,85,1,
	85,3,85,1561,8,85,1,86,1,86,1,86,1,86,1,86,1,86,1,86,1,86,1,87,1,87,1,87,
	1,87,1,87,1,87,1,88,1,88,1,88,1,88,1,89,1,89,1,89,5,89,1584,8,89,10,89,
	12,89,1587,9,89,1,89,1,89,1,90,1,90,1,91,1,91,1,91,5,91,1596,8,91,10,91,
	12,91,1599,9,91,1,91,1,91,1,92,1,92,1,92,1,92,1,92,1,92,5,92,1609,8,92,
	10,92,12,92,1612,9,92,1,92,3,92,1615,8,92,1,92,1,92,1,93,1,93,1,93,1,93,
	5,93,1623,8,93,10,93,12,93,1626,9,93,1,94,1,94,1,94,5,94,1631,8,94,10,94,
	12,94,1634,9,94,1,95,1,95,1,95,3,95,1639,8,95,1,95,1,95,4,95,1643,8,95,
	11,95,12,95,1644,1,96,1,96,1,96,1,96,1,96,5,96,1652,8,96,10,96,12,96,1655,
	9,96,1,96,3,96,1658,8,96,3,96,1660,8,96,1,96,1,96,1,97,1,97,3,97,1666,8,
	97,1,97,1,97,1,97,1,97,5,97,1672,8,97,10,97,12,97,1675,9,97,1,97,3,97,1678,
	8,97,3,97,1680,8,97,1,97,3,97,1683,8,97,1,97,1,97,1,98,1,98,1,98,1,99,1,
	99,1,99,1,100,1,100,1,100,3,100,1696,8,100,1,101,1,101,1,101,1,101,1,101,
	1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,3,101,1712,8,101,
	1,102,1,102,1,102,1,102,1,102,1,102,1,103,1,103,3,103,1722,8,103,1,104,
	1,104,1,104,1,104,5,104,1728,8,104,10,104,12,104,1731,9,104,1,104,3,104,
	1734,8,104,3,104,1736,8,104,1,104,1,104,1,105,1,105,1,105,1,105,1,105,1,
	105,1,105,1,105,1,105,1,105,1,105,1,105,5,105,1752,8,105,10,105,12,105,
	1755,9,105,1,105,3,105,1758,8,105,3,105,1760,8,105,1,105,1,105,3,105,1764,
	8,105,1,106,1,106,1,106,1,106,1,107,1,107,1,107,1,107,5,107,1774,8,107,
	10,107,12,107,1777,9,107,1,107,3,107,1780,8,107,3,107,1782,8,107,1,107,
	1,107,1,108,1,108,1,108,1,108,5,108,1790,8,108,10,108,12,108,1793,9,108,
	1,108,3,108,1796,8,108,1,108,1,108,1,109,1,109,1,109,1,109,1,110,1,110,
	1,110,1,110,5,110,1808,8,110,10,110,12,110,1811,9,110,1,110,3,110,1814,
	8,110,1,110,1,110,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	3,111,1827,8,111,1,111,1,111,1,111,1,111,1,111,1,111,3,111,1835,8,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,5,111,1908,
	8,111,10,111,12,111,1911,9,111,1,111,3,111,1914,8,111,3,111,1916,8,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,4,111,1936,8,111,11,111,12,111,1937,
	1,111,1,111,1,111,1,111,1,111,1,111,3,111,1946,8,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	3,111,2023,8,111,1,111,1,111,1,111,5,111,2028,8,111,10,111,12,111,2031,
	9,111,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,
	1,112,1,112,3,112,2046,8,112,1,113,1,113,1,114,1,114,1,114,1,114,1,114,
	5,114,2055,8,114,10,114,12,114,2058,9,114,1,114,1,114,1,114,1,114,3,114,
	2064,8,114,1,115,1,115,3,115,2068,8,115,1,116,1,116,1,117,1,117,1,117,1,
	117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,
	117,1,117,5,117,2089,8,117,10,117,12,117,2092,9,117,3,117,2094,8,117,1,
	117,1,117,1,117,1,117,1,117,1,117,5,117,2102,8,117,10,117,12,117,2105,9,
	117,1,117,1,117,3,117,2109,8,117,1,117,3,117,2112,8,117,1,118,1,118,1,118,
	0,2,78,222,119,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,
	42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,
	90,92,94,96,98,100,102,104,106,108,110,112,114,116,118,120,122,124,126,
	128,130,132,134,136,138,140,142,144,146,148,150,152,154,156,158,160,162,
	164,166,168,170,172,174,176,178,180,182,184,186,188,190,192,194,196,198,
	200,202,204,206,208,210,212,214,216,218,220,222,224,226,228,230,232,234,
	236,0,18,2,0,10,10,13,27,3,0,20,23,26,27,30,30,1,0,33,34,2,0,33,34,53,54,
	2,0,30,30,74,83,1,0,84,85,3,0,154,154,163,163,173,173,1,0,121,125,2,0,121,
	125,127,130,3,0,14,14,27,27,135,135,2,0,10,10,15,16,1,0,13,14,1,0,136,137,
	1,0,20,23,1,0,18,19,1,0,131,132,2,0,47,47,143,146,4,0,50,50,147,149,157,
	159,165,169,2333,0,241,1,0,0,0,2,336,1,0,0,0,4,338,1,0,0,0,6,343,1,0,0,
	0,8,393,1,0,0,0,10,395,1,0,0,0,12,404,1,0,0,0,14,406,1,0,0,0,16,411,1,0,
	0,0,18,413,1,0,0,0,20,418,1,0,0,0,22,422,1,0,0,0,24,424,1,0,0,0,26,492,
	1,0,0,0,28,494,1,0,0,0,30,499,1,0,0,0,32,501,1,0,0,0,34,509,1,0,0,0,36,
	551,1,0,0,0,38,642,1,0,0,0,40,662,1,0,0,0,42,684,1,0,0,0,44,690,1,0,0,0,
	46,709,1,0,0,0,48,712,1,0,0,0,50,722,1,0,0,0,52,726,1,0,0,0,54,742,1,0,
	0,0,56,747,1,0,0,0,58,753,1,0,0,0,60,760,1,0,0,0,62,777,1,0,0,0,64,804,
	1,0,0,0,66,806,1,0,0,0,68,820,1,0,0,0,70,873,1,0,0,0,72,877,1,0,0,0,74,
	879,1,0,0,0,76,917,1,0,0,0,78,929,1,0,0,0,80,943,1,0,0,0,82,959,1,0,0,0,
	84,961,1,0,0,0,86,964,1,0,0,0,88,991,1,0,0,0,90,1009,1,0,0,0,92,1011,1,
	0,0,0,94,1024,1,0,0,0,96,1030,1,0,0,0,98,1045,1,0,0,0,100,1055,1,0,0,0,
	102,1089,1,0,0,0,104,1100,1,0,0,0,106,1135,1,0,0,0,108,1137,1,0,0,0,110,
	1147,1,0,0,0,112,1196,1,0,0,0,114,1220,1,0,0,0,116,1222,1,0,0,0,118,1231,
	1,0,0,0,120,1236,1,0,0,0,122,1251,1,0,0,0,124,1268,1,0,0,0,126,1286,1,0,
	0,0,128,1317,1,0,0,0,130,1367,1,0,0,0,132,1374,1,0,0,0,134,1384,1,0,0,0,
	136,1386,1,0,0,0,138,1393,1,0,0,0,140,1399,1,0,0,0,142,1407,1,0,0,0,144,
	1414,1,0,0,0,146,1423,1,0,0,0,148,1453,1,0,0,0,150,1455,1,0,0,0,152,1467,
	1,0,0,0,154,1477,1,0,0,0,156,1492,1,0,0,0,158,1494,1,0,0,0,160,1510,1,0,
	0,0,162,1521,1,0,0,0,164,1532,1,0,0,0,166,1540,1,0,0,0,168,1552,1,0,0,0,
	170,1560,1,0,0,0,172,1562,1,0,0,0,174,1570,1,0,0,0,176,1576,1,0,0,0,178,
	1580,1,0,0,0,180,1590,1,0,0,0,182,1592,1,0,0,0,184,1602,1,0,0,0,186,1618,
	1,0,0,0,188,1627,1,0,0,0,190,1635,1,0,0,0,192,1646,1,0,0,0,194,1663,1,0,
	0,0,196,1686,1,0,0,0,198,1689,1,0,0,0,200,1695,1,0,0,0,202,1711,1,0,0,0,
	204,1713,1,0,0,0,206,1721,1,0,0,0,208,1723,1,0,0,0,210,1763,1,0,0,0,212,
	1765,1,0,0,0,214,1769,1,0,0,0,216,1785,1,0,0,0,218,1799,1,0,0,0,220,1803,
	1,0,0,0,222,1945,1,0,0,0,224,2045,1,0,0,0,226,2047,1,0,0,0,228,2063,1,0,
	0,0,230,2065,1,0,0,0,232,2069,1,0,0,0,234,2111,1,0,0,0,236,2113,1,0,0,0,
	238,240,3,14,7,0,239,238,1,0,0,0,240,243,1,0,0,0,241,239,1,0,0,0,241,242,
	1,0,0,0,242,247,1,0,0,0,243,241,1,0,0,0,244,246,3,2,1,0,245,244,1,0,0,0,
	246,249,1,0,0,0,247,245,1,0,0,0,247,248,1,0,0,0,248,253,1,0,0,0,249,247,
	1,0,0,0,250,252,3,58,29,0,251,250,1,0,0,0,252,255,1,0,0,0,253,251,1,0,0,
	0,253,254,1,0,0,0,254,259,1,0,0,0,255,253,1,0,0,0,256,258,3,52,26,0,257,
	256,1,0,0,0,258,261,1,0,0,0,259,257,1,0,0,0,259,260,1,0,0,0,260,265,1,0,
	0,0,261,259,1,0,0,0,262,264,3,48,24,0,263,262,1,0,0,0,264,267,1,0,0,0,265,
	263,1,0,0,0,265,266,1,0,0,0,266,271,1,0,0,0,267,265,1,0,0,0,268,270,3,56,
	28,0,269,268,1,0,0,0,270,273,1,0,0,0,271,269,1,0,0,0,271,272,1,0,0,0,272,
	277,1,0,0,0,273,271,1,0,0,0,274,276,3,8,4,0,275,274,1,0,0,0,276,279,1,0,
	0,0,277,275,1,0,0,0,277,278,1,0,0,0,278,283,1,0,0,0,279,277,1,0,0,0,280,
	282,3,44,22,0,281,280,1,0,0,0,282,285,1,0,0,0,283,281,1,0,0,0,283,284,1,
	0,0,0,284,289,1,0,0,0,285,283,1,0,0,0,286,288,3,24,12,0,287,286,1,0,0,0,
	288,291,1,0,0,0,289,287,1,0,0,0,289,290,1,0,0,0,290,295,1,0,0,0,291,289,
	1,0,0,0,292,294,3,6,3,0,293,292,1,0,0,0,294,297,1,0,0,0,295,293,1,0,0,0,
	295,296,1,0,0,0,296,301,1,0,0,0,297,295,1,0,0,0,298,300,3,34,17,0,299,298,
	1,0,0,0,300,303,1,0,0,0,301,299,1,0,0,0,301,302,1,0,0,0,302,306,1,0,0,0,
	303,301,1,0,0,0,304,307,3,36,18,0,305,307,3,34,17,0,306,304,1,0,0,0,306,
	305,1,0,0,0,307,308,1,0,0,0,308,309,5,0,0,1,309,1,1,0,0,0,310,311,5,1,0,
	0,311,312,5,161,0,0,312,337,5,2,0,0,313,314,5,1,0,0,314,315,5,161,0,0,315,
	316,5,3,0,0,316,317,5,173,0,0,317,337,5,2,0,0,318,319,5,1,0,0,319,320,5,
	4,0,0,320,325,3,4,2,0,321,322,5,5,0,0,322,324,3,4,2,0,323,321,1,0,0,0,324,
	327,1,0,0,0,325,323,1,0,0,0,325,326,1,0,0,0,326,329,1,0,0,0,327,325,1,0,
	0,0,328,330,5,5,0,0,329,328,1,0,0,0,329,330,1,0,0,0,330,331,1,0,0,0,331,
	332,5,6,0,0,332,333,5,173,0,0,333,334,5,161,0,0,334,335,5,2,0,0,335,337,
	1,0,0,0,336,310,1,0,0,0,336,313,1,0,0,0,336,318,1,0,0,0,337,3,1,0,0,0,338,
	341,5,173,0,0,339,340,5,3,0,0,340,342,5,173,0,0,341,339,1,0,0,0,341,342,
	1,0,0,0,342,5,1,0,0,0,343,344,5,7,0,0,344,345,5,173,0,0,345,347,3,100,50,
	0,346,348,3,96,48,0,347,346,1,0,0,0,347,348,1,0,0,0,348,349,1,0,0,0,349,
	353,5,4,0,0,350,352,3,106,53,0,351,350,1,0,0,0,352,355,1,0,0,0,353,351,
	1,0,0,0,353,354,1,0,0,0,354,356,1,0,0,0,355,353,1,0,0,0,356,357,5,6,0,0,
	357,7,1,0,0,0,358,359,5,8,0,0,359,360,5,173,0,0,360,363,5,9,0,0,361,364,
	3,234,117,0,362,364,5,10,0,0,363,361,1,0,0,0,363,362,1,0,0,0,364,366,1,
	0,0,0,365,367,5,11,0,0,366,365,1,0,0,0,366,367,1,0,0,0,367,368,1,0,0,0,
	368,394,5,2,0,0,369,370,5,8,0,0,370,371,5,4,0,0,371,376,3,10,5,0,372,373,
	5,5,0,0,373,375,3,10,5,0,374,372,1,0,0,0,375,378,1,0,0,0,376,374,1,0,0,
	0,376,377,1,0,0,0,377,380,1,0,0,0,378,376,1,0,0,0,379,381,5,5,0,0,380,379,
	1,0,0,0,380,381,1,0,0,0,381,382,1,0,0,0,382,383,5,6,0,0,383,386,5,9,0,0,
	384,387,3,234,117,0,385,387,5,10,0,0,386,384,1,0,0,0,386,385,1,0,0,0,387,
	389,1,0,0,0,388,390,5,11,0,0,389,388,1,0,0,0,389,390,1,0,0,0,390,391,1,
	0,0,0,391,392,5,2,0,0,392,394,1,0,0,0,393,358,1,0,0,0,393,369,1,0,0,0,394,
	9,1,0,0,0,395,398,5,173,0,0,396,397,5,12,0,0,397,399,5,173,0,0,398,396,
	1,0,0,0,398,399,1,0,0,0,399,402,1,0,0,0,400,401,5,3,0,0,401,403,3,12,6,
	0,402,400,1,0,0,0,402,403,1,0,0,0,403,11,1,0,0,0,404,405,7,0,0,0,405,13,
	1,0,0,0,406,407,5,28,0,0,407,408,3,16,8,0,408,409,3,18,9,0,409,410,5,2,
	0,0,410,15,1,0,0,0,411,412,5,29,0,0,412,17,1,0,0,0,413,415,3,20,10,0,414,
	416,3,20,10,0,415,414,1,0,0,0,415,416,1,0,0,0,416,19,1,0,0,0,417,419,3,
	22,11,0,418,417,1,0,0,0,418,419,1,0,0,0,419,420,1,0,0,0,420,421,5,150,0,
	0,421,21,1,0,0,0,422,423,7,1,0,0,423,23,1,0,0,0,424,425,5,31,0,0,425,435,
	5,173,0,0,426,427,5,32,0,0,427,432,5,173,0,0,428,429,5,5,0,0,429,431,5,
	173,0,0,430,428,1,0,0,0,431,434,1,0,0,0,432,430,1,0,0,0,432,433,1,0,0,0,
	433,436,1,0,0,0,434,432,1,0,0,0,435,426,1,0,0,0,435,436,1,0,0,0,436,437,
	1,0,0,0,437,441,5,4,0,0,438,440,3,52,26,0,439,438,1,0,0,0,440,443,1,0,0,
	0,441,439,1,0,0,0,441,442,1,0,0,0,442,447,1,0,0,0,443,441,1,0,0,0,444,446,
	3,48,24,0,445,444,1,0,0,0,446,449,1,0,0,0,447,445,1,0,0,0,447,448,1,0,0,
	0,448,453,1,0,0,0,449,447,1,0,0,0,450,452,3,56,28,0,451,450,1,0,0,0,452,
	455,1,0,0,0,453,451,1,0,0,0,453,454,1,0,0,0,454,459,1,0,0,0,455,453,1,0,
	0,0,456,458,3,40,20,0,457,456,1,0,0,0,458,461,1,0,0,0,459,457,1,0,0,0,459,
	460,1,0,0,0,460,465,1,0,0,0,461,459,1,0,0,0,462,464,3,28,14,0,463,462,1,
	0,0,0,464,467,1,0,0,0,465,463,1,0,0,0,465,466,1,0,0,0,466,471,1,0,0,0,467,
	465,1,0,0,0,468,470,3,26,13,0,469,468,1,0,0,0,470,473,1,0,0,0,471,469,1,
	0,0,0,471,472,1,0,0,0,472,477,1,0,0,0,473,471,1,0,0,0,474,476,3,32,16,0,
	475,474,1,0,0,0,476,479,1,0,0,0,477,475,1,0,0,0,477,478,1,0,0,0,478,480,
	1,0,0,0,479,477,1,0,0,0,480,481,5,6,0,0,481,25,1,0,0,0,482,483,3,30,15,
	0,483,484,3,76,38,0,484,485,5,173,0,0,485,486,5,2,0,0,486,493,1,0,0,0,487,
	488,3,30,15,0,488,489,3,78,39,0,489,490,5,173,0,0,490,491,5,2,0,0,491,493,
	1,0,0,0,492,482,1,0,0,0,492,487,1,0,0,0,493,27,1,0,0,0,494,495,3,30,15,
	0,495,496,3,234,117,0,496,497,5,173,0,0,497,498,5,2,0,0,498,29,1,0,0,0,
	499,500,7,2,0,0,500,31,1,0,0,0,501,502,5,7,0,0,502,503,5,173,0,0,503,505,
	3,100,50,0,504,506,3,96,48,0,505,504,1,0,0,0,505,506,1,0,0,0,506,507,1,
	0,0,0,507,508,5,2,0,0,508,33,1,0,0,0,509,510,5,35,0,0,510,511,5,173,0,0,
	511,515,5,4,0,0,512,514,3,52,26,0,513,512,1,0,0,0,514,517,1,0,0,0,515,513,
	1,0,0,0,515,516,1,0,0,0,516,521,1,0,0,0,517,515,1,0,0,0,518,520,3,48,24,
	0,519,518,1,0,0,0,520,523,1,0,0,0,521,519,1,0,0,0,521,522,1,0,0,0,522,527,
	1,0,0,0,523,521,1,0,0,0,524,526,3,56,28,0,525,524,1,0,0,0,526,529,1,0,0,
	0,527,525,1,0,0,0,527,528,1,0,0,0,528,533,1,0,0,0,529,527,1,0,0,0,530,532,
	3,40,20,0,531,530,1,0,0,0,532,535,1,0,0,0,533,531,1,0,0,0,533,534,1,0,0,
	0,534,539,1,0,0,0,535,533,1,0,0,0,536,538,3,58,29,0,537,536,1,0,0,0,538,
	541,1,0,0,0,539,537,1,0,0,0,539,540,1,0,0,0,540,545,1,0,0,0,541,539,1,0,
	0,0,542,544,3,6,3,0,543,542,1,0,0,0,544,547,1,0,0,0,545,543,1,0,0,0,545,
	546,1,0,0,0,546,548,1,0,0,0,547,545,1,0,0,0,548,549,5,6,0,0,549,35,1,0,
	0,0,550,552,5,36,0,0,551,550,1,0,0,0,551,552,1,0,0,0,552,553,1,0,0,0,553,
	554,5,37,0,0,554,556,5,173,0,0,555,557,3,100,50,0,556,555,1,0,0,0,556,557,
	1,0,0,0,557,567,1,0,0,0,558,559,5,32,0,0,559,564,5,173,0,0,560,561,5,5,
	0,0,561,563,5,173,0,0,562,560,1,0,0,0,563,566,1,0,0,0,564,562,1,0,0,0,564,
	565,1,0,0,0,565,568,1,0,0,0,566,564,1,0,0,0,567,558,1,0,0,0,567,568,1,0,
	0,0,568,569,1,0,0,0,569,573,5,4,0,0,570,572,3,52,26,0,571,570,1,0,0,0,572,
	575,1,0,0,0,573,571,1,0,0,0,573,574,1,0,0,0,574,579,1,0,0,0,575,573,1,0,
	0,0,576,578,3,48,24,0,577,576,1,0,0,0,578,581,1,0,0,0,579,577,1,0,0,0,579,
	580,1,0,0,0,580,585,1,0,0,0,581,579,1,0,0,0,582,584,3,56,28,0,583,582,1,
	0,0,0,584,587,1,0,0,0,585,583,1,0,0,0,585,586,1,0,0,0,586,591,1,0,0,0,587,
	585,1,0,0,0,588,590,3,40,20,0,589,588,1,0,0,0,590,593,1,0,0,0,591,589,1,
	0,0,0,591,592,1,0,0,0,592,597,1,0,0,0,593,591,1,0,0,0,594,596,3,44,22,0,
	595,594,1,0,0,0,596,599,1,0,0,0,597,595,1,0,0,0,597,598,1,0,0,0,598,603,
	1,0,0,0,599,597,1,0,0,0,600,602,3,58,29,0,601,600,1,0,0,0,602,605,1,0,0,
	0,603,601,1,0,0,0,603,604,1,0,0,0,604,609,1,0,0,0,605,603,1,0,0,0,606,608,
	3,8,4,0,607,606,1,0,0,0,608,611,1,0,0,0,609,607,1,0,0,0,609,610,1,0,0,0,
	610,615,1,0,0,0,611,609,1,0,0,0,612,614,3,70,35,0,613,612,1,0,0,0,614,617,
	1,0,0,0,615,613,1,0,0,0,615,616,1,0,0,0,616,621,1,0,0,0,617,615,1,0,0,0,
	618,620,3,80,40,0,619,618,1,0,0,0,620,623,1,0,0,0,621,619,1,0,0,0,621,622,
	1,0,0,0,622,625,1,0,0,0,623,621,1,0,0,0,624,626,3,60,30,0,625,624,1,0,0,
	0,625,626,1,0,0,0,626,631,1,0,0,0,627,630,3,86,43,0,628,630,3,38,19,0,629,
	627,1,0,0,0,629,628,1,0,0,0,630,633,1,0,0,0,631,629,1,0,0,0,631,632,1,0,
	0,0,632,635,1,0,0,0,633,631,1,0,0,0,634,636,3,62,31,0,635,634,1,0,0,0,635,
	636,1,0,0,0,636,638,1,0,0,0,637,639,3,66,33,0,638,637,1,0,0,0,638,639,1,
	0,0,0,639,640,1,0,0,0,640,641,5,6,0,0,641,37,1,0,0,0,642,643,5,7,0,0,643,
	644,5,173,0,0,644,648,3,100,50,0,645,647,3,90,45,0,646,645,1,0,0,0,647,
	650,1,0,0,0,648,646,1,0,0,0,648,649,1,0,0,0,649,654,1,0,0,0,650,648,1,0,
	0,0,651,653,3,88,44,0,652,651,1,0,0,0,653,656,1,0,0,0,654,652,1,0,0,0,654,
	655,1,0,0,0,655,658,1,0,0,0,656,654,1,0,0,0,657,659,3,96,48,0,658,657,1,
	0,0,0,658,659,1,0,0,0,659,660,1,0,0,0,660,661,5,2,0,0,661,39,1,0,0,0,662,
	663,5,38,0,0,663,664,5,173,0,0,664,676,5,39,0,0,665,670,3,42,21,0,666,667,
	5,5,0,0,667,669,3,42,21,0,668,666,1,0,0,0,669,672,1,0,0,0,670,668,1,0,0,
	0,670,671,1,0,0,0,671,674,1,0,0,0,672,670,1,0,0,0,673,675,5,5,0,0,674,673,
	1,0,0,0,674,675,1,0,0,0,675,677,1,0,0,0,676,665,1,0,0,0,676,677,1,0,0,0,
	677,678,1,0,0,0,678,680,5,40,0,0,679,681,5,41,0,0,680,679,1,0,0,0,680,681,
	1,0,0,0,681,682,1,0,0,0,682,683,5,2,0,0,683,41,1,0,0,0,684,686,3,234,117,
	0,685,687,5,42,0,0,686,685,1,0,0,0,686,687,1,0,0,0,687,688,1,0,0,0,688,
	689,5,173,0,0,689,43,1,0,0,0,690,691,5,43,0,0,691,692,5,173,0,0,692,704,
	5,39,0,0,693,698,3,46,23,0,694,695,5,5,0,0,695,697,3,46,23,0,696,694,1,
	0,0,0,697,700,1,0,0,0,698,696,1,0,0,0,698,699,1,0,0,0,699,702,1,0,0,0,700,
	698,1,0,0,0,701,703,5,5,0,0,702,701,1,0,0,0,702,703,1,0,0,0,703,705,1,0,
	0,0,704,693,1,0,0,0,704,705,1,0,0,0,705,706,1,0,0,0,706,707,5,40,0,0,707,
	708,5,2,0,0,708,45,1,0,0,0,709,710,3,234,117,0,710,711,5,173,0,0,711,47,
	1,0,0,0,712,713,5,44,0,0,713,714,5,173,0,0,714,716,5,4,0,0,715,717,3,50,
	25,0,716,715,1,0,0,0,717,718,1,0,0,0,718,716,1,0,0,0,718,719,1,0,0,0,719,
	720,1,0,0,0,720,721,5,6,0,0,721,49,1,0,0,0,722,723,3,234,117,0,723,724,
	5,173,0,0,724,725,5,2,0,0,725,51,1,0,0,0,726,727,5,45,0,0,727,728,5,173,
	0,0,728,729,5,4,0,0,729,734,3,54,27,0,730,731,5,5,0,0,731,733,3,54,27,0,
	732,730,1,0,0,0,733,736,1,0,0,0,734,732,1,0,0,0,734,735,1,0,0,0,735,738,
	1,0,0,0,736,734,1,0,0,0,737,739,5,5,0,0,738,737,1,0,0,0,738,739,1,0,0,0,
	739,740,1,0,0,0,740,741,5,6,0,0,741,53,1,0,0,0,742,745,5,173,0,0,743,744,
	5,30,0,0,744,746,5,154,0,0,745,743,1,0,0,0,745,746,1,0,0,0,746,55,1,0,0,
	0,747,748,5,46,0,0,748,749,5,173,0,0,749,750,5,32,0,0,750,751,3,234,117,
	0,751,752,5,2,0,0,752,57,1,0,0,0,753,754,3,234,117,0,754,755,5,47,0,0,755,
	756,5,173,0,0,756,757,5,30,0,0,757,758,3,222,111,0,758,759,5,2,0,0,759,
	59,1,0,0,0,760,761,5,48,0,0,761,765,3,100,50,0,762,764,3,68,34,0,763,762,
	1,0,0,0,764,767,1,0,0,0,765,763,1,0,0,0,765,766,1,0,0,0,766,768,1,0,0,0,
	767,765,1,0,0,0,768,772,5,4,0,0,769,771,3,106,53,0,770,769,1,0,0,0,771,
	774,1,0,0,0,772,770,1,0,0,0,772,773,1,0,0,0,773,775,1,0,0,0,774,772,1,0,
	0,0,775,776,5,6,0,0,776,61,1,0,0,0,777,778,5,49,0,0,778,779,3,100,50,0,
	779,783,5,34,0,0,780,782,3,64,32,0,781,780,1,0,0,0,782,785,1,0,0,0,783,
	781,1,0,0,0,783,784,1,0,0,0,784,789,1,0,0,0,785,783,1,0,0,0,786,788,3,88,
	44,0,787,786,1,0,0,0,788,791,1,0,0,0,789,787,1,0,0,0,789,790,1,0,0,0,790,
	792,1,0,0,0,791,789,1,0,0,0,792,796,5,4,0,0,793,795,3,106,53,0,794,793,
	1,0,0,0,795,798,1,0,0,0,796,794,1,0,0,0,796,797,1,0,0,0,797,799,1,0,0,0,
	798,796,1,0,0,0,799,800,5,6,0,0,800,63,1,0,0,0,801,805,5,50,0,0,802,805,
	5,51,0,0,803,805,3,92,46,0,804,801,1,0,0,0,804,802,1,0,0,0,804,803,1,0,
	0,0,805,65,1,0,0,0,806,807,5,52,0,0,807,808,5,39,0,0,808,809,5,40,0,0,809,
	810,5,34,0,0,810,811,5,50,0,0,811,815,5,4,0,0,812,814,3,106,53,0,813,812,
	1,0,0,0,814,817,1,0,0,0,815,813,1,0,0,0,815,816,1,0,0,0,816,818,1,0,0,0,
	817,815,1,0,0,0,818,819,5,6,0,0,819,67,1,0,0,0,820,821,5,173,0,0,821,822,
	3,214,107,0,822,69,1,0,0,0,823,825,3,74,37,0,824,823,1,0,0,0,824,825,1,
	0,0,0,825,826,1,0,0,0,826,830,3,234,117,0,827,829,3,226,113,0,828,827,1,
	0,0,0,829,832,1,0,0,0,830,828,1,0,0,0,830,831,1,0,0,0,831,833,1,0,0,0,832,
	830,1,0,0,0,833,834,5,173,0,0,834,835,5,2,0,0,835,874,1,0,0,0,836,837,3,
	234,117,0,837,841,3,74,37,0,838,840,3,226,113,0,839,838,1,0,0,0,840,843,
	1,0,0,0,841,839,1,0,0,0,841,842,1,0,0,0,842,844,1,0,0,0,843,841,1,0,0,0,
	844,845,5,173,0,0,845,846,5,2,0,0,846,874,1,0,0,0,847,849,3,74,37,0,848,
	847,1,0,0,0,848,849,1,0,0,0,849,850,1,0,0,0,850,854,3,76,38,0,851,853,3,
	72,36,0,852,851,1,0,0,0,853,856,1,0,0,0,854,852,1,0,0,0,854,855,1,0,0,0,
	855,857,1,0,0,0,856,854,1,0,0,0,857,858,5,173,0,0,858,859,5,2,0,0,859,874,
	1,0,0,0,860,862,3,74,37,0,861,860,1,0,0,0,861,862,1,0,0,0,862,863,1,0,0,
	0,863,867,3,78,39,0,864,866,3,72,36,0,865,864,1,0,0,0,866,869,1,0,0,0,867,
	865,1,0,0,0,867,868,1,0,0,0,868,870,1,0,0,0,869,867,1,0,0,0,870,871,5,173,
	0,0,871,872,5,2,0,0,872,874,1,0,0,0,873,824,1,0,0,0,873,836,1,0,0,0,873,
	848,1,0,0,0,873,861,1,0,0,0,874,71,1,0,0,0,875,878,3,226,113,0,876,878,
	3,74,37,0,877,875,1,0,0,0,877,876,1,0,0,0,878,73,1,0,0,0,879,880,7,3,0,
	0,880,75,1,0,0,0,881,882,5,55,0,0,882,883,5,39,0,0,883,885,3,234,117,0,
	884,886,5,173,0,0,885,884,1,0,0,0,885,886,1,0,0,0,886,887,1,0,0,0,887,888,
	5,56,0,0,888,890,3,234,117,0,889,891,5,173,0,0,890,889,1,0,0,0,890,891,
	1,0,0,0,891,892,1,0,0,0,892,893,5,40,0,0,893,918,1,0,0,0,894,895,5,55,0,
	0,895,896,5,39,0,0,896,898,3,234,117,0,897,899,5,173,0,0,898,897,1,0,0,
	0,898,899,1,0,0,0,899,900,1,0,0,0,900,901,5,56,0,0,901,902,3,76,38,0,902,
	903,5,40,0,0,903,918,1,0,0,0,904,905,5,55,0,0,905,906,5,39,0,0,906,908,
	3,234,117,0,907,909,5,173,0,0,908,907,1,0,0,0,908,909,1,0,0,0,909,910,1,
	0,0,0,910,911,5,56,0,0,911,913,3,78,39,0,912,914,5,173,0,0,913,912,1,0,
	0,0,913,914,1,0,0,0,914,915,1,0,0,0,915,916,5,40,0,0,916,918,1,0,0,0,917,
	881,1,0,0,0,917,894,1,0,0,0,917,904,1,0,0,0,918,77,1,0,0,0,919,920,6,39,
	-1,0,920,921,3,234,117,0,921,922,5,57,0,0,922,923,5,154,0,0,923,924,5,58,
	0,0,924,930,1,0,0,0,925,926,3,234,117,0,926,927,5,57,0,0,927,928,5,58,0,
	0,928,930,1,0,0,0,929,919,1,0,0,0,929,925,1,0,0,0,930,940,1,0,0,0,931,932,
	10,2,0,0,932,933,5,57,0,0,933,934,5,154,0,0,934,939,5,58,0,0,935,936,10,
	1,0,0,936,937,5,57,0,0,937,939,5,58,0,0,938,931,1,0,0,0,938,935,1,0,0,0,
	939,942,1,0,0,0,940,938,1,0,0,0,940,941,1,0,0,0,941,79,1,0,0,0,942,940,
	1,0,0,0,943,944,5,59,0,0,944,946,5,173,0,0,945,947,3,100,50,0,946,945,1,
	0,0,0,946,947,1,0,0,0,947,948,1,0,0,0,948,952,5,4,0,0,949,951,3,82,41,0,
	950,949,1,0,0,0,951,954,1,0,0,0,952,950,1,0,0,0,952,953,1,0,0,0,953,955,
	1,0,0,0,954,952,1,0,0,0,955,956,5,6,0,0,956,81,1,0,0,0,957,960,3,84,42,
	0,958,960,3,106,53,0,959,957,1,0,0,0,959,958,1,0,0,0,960,83,1,0,0,0,961,
	962,5,60,0,0,962,963,5,2,0,0,963,85,1,0,0,0,964,965,5,7,0,0,965,966,5,173,
	0,0,966,970,3,100,50,0,967,969,3,90,45,0,968,967,1,0,0,0,969,972,1,0,0,
	0,970,968,1,0,0,0,970,971,1,0,0,0,971,976,1,0,0,0,972,970,1,0,0,0,973,975,
	3,88,44,0,974,973,1,0,0,0,975,978,1,0,0,0,976,974,1,0,0,0,976,977,1,0,0,
	0,977,980,1,0,0,0,978,976,1,0,0,0,979,981,3,96,48,0,980,979,1,0,0,0,980,
	981,1,0,0,0,981,982,1,0,0,0,982,986,5,4,0,0,983,985,3,106,53,0,984,983,
	1,0,0,0,985,988,1,0,0,0,986,984,1,0,0,0,986,987,1,0,0,0,987,989,1,0,0,0,
	988,986,1,0,0,0,989,990,5,6,0,0,990,87,1,0,0,0,991,993,5,173,0,0,992,994,
	3,214,107,0,993,992,1,0,0,0,993,994,1,0,0,0,994,89,1,0,0,0,995,1010,5,61,
	0,0,996,1010,5,62,0,0,997,1010,5,53,0,0,998,1010,5,34,0,0,999,1010,5,33,
	0,0,1000,1010,5,54,0,0,1001,1010,5,50,0,0,1002,1010,3,92,46,0,1003,1010,
	5,51,0,0,1004,1010,3,94,47,0,1005,1010,5,63,0,0,1006,1010,5,64,0,0,1007,
	1010,5,65,0,0,1008,1010,5,66,0,0,1009,995,1,0,0,0,1009,996,1,0,0,0,1009,
	997,1,0,0,0,1009,998,1,0,0,0,1009,999,1,0,0,0,1009,1000,1,0,0,0,1009,1001,
	1,0,0,0,1009,1002,1,0,0,0,1009,1003,1,0,0,0,1009,1004,1,0,0,0,1009,1005,
	1,0,0,0,1009,1006,1,0,0,0,1009,1007,1,0,0,0,1009,1008,1,0,0,0,1010,91,1,
	0,0,0,1011,1022,5,67,0,0,1012,1013,5,39,0,0,1013,1018,5,173,0,0,1014,1015,
	5,5,0,0,1015,1017,5,173,0,0,1016,1014,1,0,0,0,1017,1020,1,0,0,0,1018,1016,
	1,0,0,0,1018,1019,1,0,0,0,1019,1021,1,0,0,0,1020,1018,1,0,0,0,1021,1023,
	5,40,0,0,1022,1012,1,0,0,0,1022,1023,1,0,0,0,1023,93,1,0,0,0,1024,1028,
	5,68,0,0,1025,1026,5,39,0,0,1026,1027,5,154,0,0,1027,1029,5,40,0,0,1028,
	1025,1,0,0,0,1028,1029,1,0,0,0,1029,95,1,0,0,0,1030,1031,5,69,0,0,1031,
	1032,5,39,0,0,1032,1037,3,98,49,0,1033,1034,5,5,0,0,1034,1036,3,98,49,0,
	1035,1033,1,0,0,0,1036,1039,1,0,0,0,1037,1035,1,0,0,0,1037,1038,1,0,0,0,
	1038,1041,1,0,0,0,1039,1037,1,0,0,0,1040,1042,5,5,0,0,1041,1040,1,0,0,0,
	1041,1042,1,0,0,0,1042,1043,1,0,0,0,1043,1044,5,40,0,0,1044,97,1,0,0,0,
	1045,1049,3,234,117,0,1046,1048,3,226,113,0,1047,1046,1,0,0,0,1048,1051,
	1,0,0,0,1049,1047,1,0,0,0,1049,1050,1,0,0,0,1050,1053,1,0,0,0,1051,1049,
	1,0,0,0,1052,1054,5,173,0,0,1053,1052,1,0,0,0,1053,1054,1,0,0,0,1054,99,
	1,0,0,0,1055,1067,5,39,0,0,1056,1061,3,102,51,0,1057,1058,5,5,0,0,1058,
	1060,3,102,51,0,1059,1057,1,0,0,0,1060,1063,1,0,0,0,1061,1059,1,0,0,0,1061,
	1062,1,0,0,0,1062,1065,1,0,0,0,1063,1061,1,0,0,0,1064,1066,5,5,0,0,1065,
	1064,1,0,0,0,1065,1066,1,0,0,0,1066,1068,1,0,0,0,1067,1056,1,0,0,0,1067,
	1068,1,0,0,0,1068,1069,1,0,0,0,1069,1070,5,40,0,0,1070,101,1,0,0,0,1071,
	1075,3,234,117,0,1072,1074,3,226,113,0,1073,1072,1,0,0,0,1074,1077,1,0,
	0,0,1075,1073,1,0,0,0,1075,1076,1,0,0,0,1076,1078,1,0,0,0,1077,1075,1,0,
	0,0,1078,1079,5,173,0,0,1079,1090,1,0,0,0,1080,1084,3,78,39,0,1081,1083,
	3,226,113,0,1082,1081,1,0,0,0,1083,1086,1,0,0,0,1084,1082,1,0,0,0,1084,
	1085,1,0,0,0,1085,1087,1,0,0,0,1086,1084,1,0,0,0,1087,1088,5,173,0,0,1088,
	1090,1,0,0,0,1089,1071,1,0,0,0,1089,1080,1,0,0,0,1090,103,1,0,0,0,1091,
	1095,5,4,0,0,1092,1094,3,106,53,0,1093,1092,1,0,0,0,1094,1097,1,0,0,0,1095,
	1093,1,0,0,0,1095,1096,1,0,0,0,1096,1098,1,0,0,0,1097,1095,1,0,0,0,1098,
	1101,5,6,0,0,1099,1101,3,106,53,0,1100,1091,1,0,0,0,1100,1099,1,0,0,0,1101,
	105,1,0,0,0,1102,1136,3,128,64,0,1103,1136,3,130,65,0,1104,1136,3,140,70,
	0,1105,1136,3,136,68,0,1106,1136,3,138,69,0,1107,1136,3,142,71,0,1108,1136,
	3,144,72,0,1109,1136,3,146,73,0,1110,1136,3,134,67,0,1111,1136,3,126,63,
	0,1112,1136,3,122,61,0,1113,1136,3,120,60,0,1114,1136,3,124,62,0,1115,1136,
	3,150,75,0,1116,1136,3,152,76,0,1117,1136,3,154,77,0,1118,1136,3,156,78,
	0,1119,1136,3,176,88,0,1120,1136,3,118,59,0,1121,1136,3,108,54,0,1122,1136,
	3,110,55,0,1123,1136,3,112,56,0,1124,1136,3,114,57,0,1125,1136,3,116,58,
	0,1126,1136,3,178,89,0,1127,1136,3,190,95,0,1128,1136,3,202,101,0,1129,
	1136,3,204,102,0,1130,1136,3,148,74,0,1131,1136,3,182,91,0,1132,1136,3,
	184,92,0,1133,1136,3,196,98,0,1134,1136,3,198,99,0,1135,1102,1,0,0,0,1135,
	1103,1,0,0,0,1135,1104,1,0,0,0,1135,1105,1,0,0,0,1135,1106,1,0,0,0,1135,
	1107,1,0,0,0,1135,1108,1,0,0,0,1135,1109,1,0,0,0,1135,1110,1,0,0,0,1135,
	1111,1,0,0,0,1135,1112,1,0,0,0,1135,1113,1,0,0,0,1135,1114,1,0,0,0,1135,
	1115,1,0,0,0,1135,1116,1,0,0,0,1135,1117,1,0,0,0,1135,1118,1,0,0,0,1135,
	1119,1,0,0,0,1135,1120,1,0,0,0,1135,1121,1,0,0,0,1135,1122,1,0,0,0,1135,
	1123,1,0,0,0,1135,1124,1,0,0,0,1135,1125,1,0,0,0,1135,1126,1,0,0,0,1135,
	1127,1,0,0,0,1135,1128,1,0,0,0,1135,1129,1,0,0,0,1135,1130,1,0,0,0,1135,
	1131,1,0,0,0,1135,1132,1,0,0,0,1135,1133,1,0,0,0,1135,1134,1,0,0,0,1136,
	107,1,0,0,0,1137,1138,5,70,0,0,1138,1139,5,12,0,0,1139,1140,5,173,0,0,1140,
	1141,5,39,0,0,1141,1142,3,222,111,0,1142,1143,5,5,0,0,1143,1144,3,222,111,
	0,1144,1145,5,40,0,0,1145,1146,5,2,0,0,1146,109,1,0,0,0,1147,1148,5,70,
	0,0,1148,1149,5,12,0,0,1149,1150,5,173,0,0,1150,1151,5,57,0,0,1151,1152,
	3,222,111,0,1152,1153,5,58,0,0,1153,1154,5,12,0,0,1154,1155,5,173,0,0,1155,
	1156,5,39,0,0,1156,1161,3,222,111,0,1157,1158,5,5,0,0,1158,1160,3,222,111,
	0,1159,1157,1,0,0,0,1160,1163,1,0,0,0,1161,1159,1,0,0,0,1161,1162,1,0,0,
	0,1162,1164,1,0,0,0,1163,1161,1,0,0,0,1164,1165,5,40,0,0,1165,1166,5,2,
	0,0,1166,111,1,0,0,0,1167,1168,5,71,0,0,1168,1197,5,2,0,0,1169,1170,5,71,
	0,0,1170,1175,3,222,111,0,1171,1172,5,5,0,0,1172,1174,3,222,111,0,1173,
	1171,1,0,0,0,1174,1177,1,0,0,0,1175,1173,1,0,0,0,1175,1176,1,0,0,0,1176,
	1178,1,0,0,0,1177,1175,1,0,0,0,1178,1179,5,2,0,0,1179,1197,1,0,0,0,1180,
	1181,5,71,0,0,1181,1182,5,39,0,0,1182,1187,3,222,111,0,1183,1184,5,5,0,
	0,1184,1186,3,222,111,0,1185,1183,1,0,0,0,1186,1189,1,0,0,0,1187,1185,1,
	0,0,0,1187,1188,1,0,0,0,1188,1191,1,0,0,0,1189,1187,1,0,0,0,1190,1192,5,
	5,0,0,1191,1190,1,0,0,0,1191,1192,1,0,0,0,1192,1193,1,0,0,0,1193,1194,5,
	40,0,0,1194,1195,5,2,0,0,1195,1197,1,0,0,0,1196,1167,1,0,0,0,1196,1169,
	1,0,0,0,1196,1180,1,0,0,0,1197,113,1,0,0,0,1198,1199,5,173,0,0,1199,1200,
	3,214,107,0,1200,1201,5,2,0,0,1201,1221,1,0,0,0,1202,1203,5,173,0,0,1203,
	1204,5,12,0,0,1204,1205,5,173,0,0,1205,1206,3,214,107,0,1206,1207,5,2,0,
	0,1207,1221,1,0,0,0,1208,1209,5,173,0,0,1209,1210,3,214,107,0,1210,1211,
	5,12,0,0,1211,1212,5,173,0,0,1212,1213,5,12,0,0,1213,1215,5,173,0,0,1214,
	1216,3,216,108,0,1215,1214,1,0,0,0,1215,1216,1,0,0,0,1216,1217,1,0,0,0,
	1217,1218,3,214,107,0,1218,1219,5,2,0,0,1219,1221,1,0,0,0,1220,1198,1,0,
	0,0,1220,1202,1,0,0,0,1220,1208,1,0,0,0,1221,115,1,0,0,0,1222,1223,3,222,
	111,0,1223,1224,5,12,0,0,1224,1226,5,173,0,0,1225,1227,3,216,108,0,1226,
	1225,1,0,0,0,1226,1227,1,0,0,0,1227,1228,1,0,0,0,1228,1229,3,214,107,0,
	1229,1230,5,2,0,0,1230,117,1,0,0,0,1231,1232,5,72,0,0,1232,1233,5,173,0,
	0,1233,1234,3,214,107,0,1234,1235,5,2,0,0,1235,119,1,0,0,0,1236,1237,5,
	70,0,0,1237,1238,5,12,0,0,1238,1243,5,173,0,0,1239,1240,5,57,0,0,1240,1241,
	3,222,111,0,1241,1242,5,58,0,0,1242,1244,1,0,0,0,1243,1239,1,0,0,0,1244,
	1245,1,0,0,0,1245,1243,1,0,0,0,1245,1246,1,0,0,0,1246,1247,1,0,0,0,1247,
	1248,5,30,0,0,1248,1249,3,222,111,0,1249,1250,5,2,0,0,1250,121,1,0,0,0,
	1251,1252,5,70,0,0,1252,1253,5,12,0,0,1253,1258,5,173,0,0,1254,1255,5,57,
	0,0,1255,1256,3,222,111,0,1256,1257,5,58,0,0,1257,1259,1,0,0,0,1258,1254,
	1,0,0,0,1259,1260,1,0,0,0,1260,1258,1,0,0,0,1260,1261,1,0,0,0,1261,1262,
	1,0,0,0,1262,1263,5,12,0,0,1263,1264,5,173,0,0,1264,1265,5,30,0,0,1265,
	1266,3,222,111,0,1266,1267,5,2,0,0,1267,123,1,0,0,0,1268,1269,5,70,0,0,
	1269,1270,5,12,0,0,1270,1277,5,173,0,0,1271,1272,5,57,0,0,1272,1273,3,222,
	111,0,1273,1274,5,58,0,0,1274,1276,1,0,0,0,1275,1271,1,0,0,0,1276,1279,
	1,0,0,0,1277,1275,1,0,0,0,1277,1278,1,0,0,0,1278,1280,1,0,0,0,1279,1277,
	1,0,0,0,1280,1281,5,73,0,0,1281,1282,5,39,0,0,1282,1283,3,222,111,0,1283,
	1284,5,40,0,0,1284,1285,5,2,0,0,1285,125,1,0,0,0,1286,1287,5,70,0,0,1287,
	1288,5,12,0,0,1288,1289,5,173,0,0,1289,1290,5,30,0,0,1290,1291,3,222,111,
	0,1291,1292,5,2,0,0,1292,127,1,0,0,0,1293,1297,3,234,117,0,1294,1296,3,
	226,113,0,1295,1294,1,0,0,0,1296,1299,1,0,0,0,1297,1295,1,0,0,0,1297,1298,
	1,0,0,0,1298,1300,1,0,0,0,1299,1297,1,0,0,0,1300,1301,5,173,0,0,1301,1302,
	5,30,0,0,1302,1303,3,222,111,0,1303,1304,5,2,0,0,1304,1318,1,0,0,0,1305,
	1309,3,78,39,0,1306,1308,3,226,113,0,1307,1306,1,0,0,0,1308,1311,1,0,0,
	0,1309,1307,1,0,0,0,1309,1310,1,0,0,0,1310,1312,1,0,0,0,1311,1309,1,0,0,
	0,1312,1313,5,173,0,0,1313,1314,5,30,0,0,1314,1315,3,222,111,0,1315,1316,
	5,2,0,0,1316,1318,1,0,0,0,1317,1293,1,0,0,0,1317,1305,1,0,0,0,1318,129,
	1,0,0,0,1319,1320,3,234,117,0,1320,1325,5,173,0,0,1321,1322,5,5,0,0,1322,
	1323,3,234,117,0,1323,1324,5,173,0,0,1324,1326,1,0,0,0,1325,1321,1,0,0,
	0,1326,1327,1,0,0,0,1327,1325,1,0,0,0,1327,1328,1,0,0,0,1328,1329,1,0,0,
	0,1329,1330,5,30,0,0,1330,1331,3,222,111,0,1331,1332,5,2,0,0,1332,1368,
	1,0,0,0,1333,1334,5,39,0,0,1334,1337,3,132,66,0,1335,1336,5,5,0,0,1336,
	1338,3,132,66,0,1337,1335,1,0,0,0,1338,1339,1,0,0,0,1339,1337,1,0,0,0,1339,
	1340,1,0,0,0,1340,1341,1,0,0,0,1341,1342,5,40,0,0,1342,1343,5,30,0,0,1343,
	1344,5,39,0,0,1344,1347,3,222,111,0,1345,1346,5,5,0,0,1346,1348,3,222,111,
	0,1347,1345,1,0,0,0,1348,1349,1,0,0,0,1349,1347,1,0,0,0,1349,1350,1,0,0,
	0,1350,1351,1,0,0,0,1351,1352,5,40,0,0,1352,1353,5,2,0,0,1353,1368,1,0,
	0,0,1354,1355,5,39,0,0,1355,1358,3,132,66,0,1356,1357,5,5,0,0,1357,1359,
	3,132,66,0,1358,1356,1,0,0,0,1359,1360,1,0,0,0,1360,1358,1,0,0,0,1360,1361,
	1,0,0,0,1361,1362,1,0,0,0,1362,1363,5,40,0,0,1363,1364,5,30,0,0,1364,1365,
	3,222,111,0,1365,1366,5,2,0,0,1366,1368,1,0,0,0,1367,1319,1,0,0,0,1367,
	1333,1,0,0,0,1367,1354,1,0,0,0,1368,131,1,0,0,0,1369,1370,3,234,117,0,1370,
	1371,5,173,0,0,1371,1375,1,0,0,0,1372,1375,5,173,0,0,1373,1375,1,0,0,0,
	1374,1369,1,0,0,0,1374,1372,1,0,0,0,1374,1373,1,0,0,0,1375,133,1,0,0,0,
	1376,1377,5,173,0,0,1377,1378,7,4,0,0,1378,1379,3,222,111,0,1379,1380,5,
	2,0,0,1380,1385,1,0,0,0,1381,1382,5,173,0,0,1382,1383,7,5,0,0,1383,1385,
	5,2,0,0,1384,1376,1,0,0,0,1384,1381,1,0,0,0,1385,135,1,0,0,0,1386,1387,
	5,173,0,0,1387,1388,5,86,0,0,1388,1389,5,39,0,0,1389,1390,3,222,111,0,1390,
	1391,5,40,0,0,1391,1392,5,2,0,0,1392,137,1,0,0,0,1393,1394,5,173,0,0,1394,
	1395,5,87,0,0,1395,1396,5,39,0,0,1396,1397,5,40,0,0,1397,1398,5,2,0,0,1398,
	139,1,0,0,0,1399,1400,5,173,0,0,1400,1401,5,57,0,0,1401,1402,3,222,111,
	0,1402,1403,5,58,0,0,1403,1404,5,30,0,0,1404,1405,3,222,111,0,1405,1406,
	5,2,0,0,1406,141,1,0,0,0,1407,1408,5,173,0,0,1408,1409,5,73,0,0,1409,1410,
	5,39,0,0,1410,1411,3,222,111,0,1411,1412,5,40,0,0,1412,1413,5,2,0,0,1413,
	143,1,0,0,0,1414,1415,5,70,0,0,1415,1416,5,12,0,0,1416,1417,5,173,0,0,1417,
	1418,5,86,0,0,1418,1419,5,39,0,0,1419,1420,3,222,111,0,1420,1421,5,40,0,
	0,1421,1422,5,2,0,0,1422,145,1,0,0,0,1423,1424,5,70,0,0,1424,1425,5,12,
	0,0,1425,1426,5,173,0,0,1426,1427,5,87,0,0,1427,1428,5,39,0,0,1428,1429,
	5,40,0,0,1429,1430,5,2,0,0,1430,147,1,0,0,0,1431,1432,5,88,0,0,1432,1433,
	5,173,0,0,1433,1454,5,2,0,0,1434,1435,5,88,0,0,1435,1436,5,70,0,0,1436,
	1437,5,12,0,0,1437,1438,5,173,0,0,1438,1454,5,2,0,0,1439,1440,5,88,0,0,
	1440,1441,5,70,0,0,1441,1442,5,12,0,0,1442,1447,5,173,0,0,1443,1444,5,57,
	0,0,1444,1445,3,222,111,0,1445,1446,5,58,0,0,1446,1448,1,0,0,0,1447,1443,
	1,0,0,0,1448,1449,1,0,0,0,1449,1447,1,0,0,0,1449,1450,1,0,0,0,1450,1451,
	1,0,0,0,1451,1452,5,2,0,0,1452,1454,1,0,0,0,1453,1431,1,0,0,0,1453,1434,
	1,0,0,0,1453,1439,1,0,0,0,1454,149,1,0,0,0,1455,1456,5,89,0,0,1456,1457,
	5,39,0,0,1457,1458,5,164,0,0,1458,1459,5,23,0,0,1459,1462,3,222,111,0,1460,
	1461,5,5,0,0,1461,1463,3,200,100,0,1462,1460,1,0,0,0,1462,1463,1,0,0,0,
	1463,1464,1,0,0,0,1464,1465,5,40,0,0,1465,1466,5,2,0,0,1466,151,1,0,0,0,
	1467,1468,5,89,0,0,1468,1469,5,39,0,0,1469,1472,3,222,111,0,1470,1471,5,
	5,0,0,1471,1473,3,200,100,0,1472,1470,1,0,0,0,1472,1473,1,0,0,0,1473,1474,
	1,0,0,0,1474,1475,5,40,0,0,1475,1476,5,2,0,0,1476,153,1,0,0,0,1477,1478,
	5,90,0,0,1478,1479,5,39,0,0,1479,1480,3,222,111,0,1480,1481,5,40,0,0,1481,
	1484,3,104,52,0,1482,1483,5,91,0,0,1483,1485,3,104,52,0,1484,1482,1,0,0,
	0,1484,1485,1,0,0,0,1485,155,1,0,0,0,1486,1493,3,172,86,0,1487,1493,3,174,
	87,0,1488,1493,3,164,82,0,1489,1493,3,158,79,0,1490,1493,3,160,80,0,1491,
	1493,3,162,81,0,1492,1486,1,0,0,0,1492,1487,1,0,0,0,1492,1488,1,0,0,0,1492,
	1489,1,0,0,0,1492,1490,1,0,0,0,1492,1491,1,0,0,0,1493,157,1,0,0,0,1494,
	1495,5,9,0,0,1495,1496,5,39,0,0,1496,1497,3,234,117,0,1497,1498,5,173,0,
	0,1498,1499,5,5,0,0,1499,1500,3,234,117,0,1500,1501,5,173,0,0,1501,1502,
	5,92,0,0,1502,1503,5,70,0,0,1503,1504,5,12,0,0,1504,1505,5,173,0,0,1505,
	1506,5,12,0,0,1506,1507,5,93,0,0,1507,1508,5,40,0,0,1508,1509,3,104,52,
	0,1509,159,1,0,0,0,1510,1511,5,9,0,0,1511,1512,5,39,0,0,1512,1513,3,234,
	117,0,1513,1514,5,173,0,0,1514,1515,5,94,0,0,1515,1516,5,70,0,0,1516,1517,
	5,12,0,0,1517,1518,5,173,0,0,1518,1519,5,40,0,0,1519,1520,3,104,52,0,1520,
	161,1,0,0,0,1521,1522,5,9,0,0,1522,1523,5,39,0,0,1523,1524,3,234,117,0,
	1524,1525,5,173,0,0,1525,1526,5,92,0,0,1526,1527,5,70,0,0,1527,1528,5,12,
	0,0,1528,1529,5,173,0,0,1529,1530,5,40,0,0,1530,1531,3,104,52,0,1531,163,
	1,0,0,0,1532,1533,5,9,0,0,1533,1534,5,39,0,0,1534,1535,3,166,83,0,1535,
	1536,3,168,84,0,1536,1537,3,170,85,0,1537,1538,5,40,0,0,1538,1539,3,104,
	52,0,1539,165,1,0,0,0,1540,1544,3,234,117,0,1541,1543,3,226,113,0,1542,
	1541,1,0,0,0,1543,1546,1,0,0,0,1544,1542,1,0,0,0,1544,1545,1,0,0,0,1545,
	1547,1,0,0,0,1546,1544,1,0,0,0,1547,1548,5,173,0,0,1548,1549,5,30,0,0,1549,
	1550,3,222,111,0,1550,1551,5,2,0,0,1551,167,1,0,0,0,1552,1553,3,222,111,
	0,1553,1554,5,2,0,0,1554,169,1,0,0,0,1555,1556,5,173,0,0,1556,1557,7,4,
	0,0,1557,1561,3,222,111,0,1558,1559,5,173,0,0,1559,1561,7,5,0,0,1560,1555,
	1,0,0,0,1560,1558,1,0,0,0,1561,171,1,0,0,0,1562,1563,5,95,0,0,1563,1564,
	3,104,52,0,1564,1565,5,96,0,0,1565,1566,5,39,0,0,1566,1567,3,222,111,0,
	1567,1568,5,40,0,0,1568,1569,5,2,0,0,1569,173,1,0,0,0,1570,1571,5,96,0,
	0,1571,1572,5,39,0,0,1572,1573,3,222,111,0,1573,1574,5,40,0,0,1574,1575,
	3,104,52,0,1575,175,1,0,0,0,1576,1577,5,97,0,0,1577,1578,3,208,104,0,1578,
	1579,5,2,0,0,1579,177,1,0,0,0,1580,1581,5,98,0,0,1581,1585,5,4,0,0,1582,
	1584,3,180,90,0,1583,1582,1,0,0,0,1584,1587,1,0,0,0,1585,1583,1,0,0,0,1585,
	1586,1,0,0,0,1586,1588,1,0,0,0,1587,1585,1,0,0,0,1588,1589,5,6,0,0,1589,
	179,1,0,0,0,1590,1591,7,6,0,0,1591,181,1,0,0,0,1592,1593,5,99,0,0,1593,
	1597,5,4,0,0,1594,1596,3,106,53,0,1595,1594,1,0,0,0,1596,1599,1,0,0,0,1597,
	1595,1,0,0,0,1597,1598,1,0,0,0,1598,1600,1,0,0,0,1599,1597,1,0,0,0,1600,
	1601,5,6,0,0,1601,183,1,0,0,0,1602,1603,5,100,0,0,1603,1604,5,39,0,0,1604,
	1605,3,222,111,0,1605,1606,5,40,0,0,1606,1610,5,4,0,0,1607,1609,3,186,93,
	0,1608,1607,1,0,0,0,1609,1612,1,0,0,0,1610,1608,1,0,0,0,1610,1611,1,0,0,
	0,1611,1614,1,0,0,0,1612,1610,1,0,0,0,1613,1615,3,188,94,0,1614,1613,1,
	0,0,0,1614,1615,1,0,0,0,1615,1616,1,0,0,0,1616,1617,5,6,0,0,1617,185,1,
	0,0,0,1618,1619,5,101,0,0,1619,1620,3,222,111,0,1620,1624,5,102,0,0,1621,
	1623,3,106,53,0,1622,1621,1,0,0,0,1623,1626,1,0,0,0,1624,1622,1,0,0,0,1624,
	1625,1,0,0,0,1625,187,1,0,0,0,1626,1624,1,0,0,0,1627,1628,5,103,0,0,1628,
	1632,5,102,0,0,1629,1631,3,106,53,0,1630,1629,1,0,0,0,1631,1634,1,0,0,0,
	1632,1630,1,0,0,0,1632,1633,1,0,0,0,1633,189,1,0,0,0,1634,1632,1,0,0,0,
	1635,1636,5,104,0,0,1636,1638,3,222,111,0,1637,1639,3,192,96,0,1638,1637,
	1,0,0,0,1638,1639,1,0,0,0,1639,1640,1,0,0,0,1640,1642,3,104,52,0,1641,1643,
	3,194,97,0,1642,1641,1,0,0,0,1643,1644,1,0,0,0,1644,1642,1,0,0,0,1644,1645,
	1,0,0,0,1645,191,1,0,0,0,1646,1647,5,69,0,0,1647,1659,5,39,0,0,1648,1653,
	3,102,51,0,1649,1650,5,5,0,0,1650,1652,3,102,51,0,1651,1649,1,0,0,0,1652,
	1655,1,0,0,0,1653,1651,1,0,0,0,1653,1654,1,0,0,0,1654,1657,1,0,0,0,1655,
	1653,1,0,0,0,1656,1658,5,5,0,0,1657,1656,1,0,0,0,1657,1658,1,0,0,0,1658,
	1660,1,0,0,0,1659,1648,1,0,0,0,1659,1660,1,0,0,0,1660,1661,1,0,0,0,1661,
	1662,5,40,0,0,1662,193,1,0,0,0,1663,1665,5,105,0,0,1664,1666,5,173,0,0,
	1665,1664,1,0,0,0,1665,1666,1,0,0,0,1666,1682,1,0,0,0,1667,1679,5,39,0,
	0,1668,1673,3,102,51,0,1669,1670,5,5,0,0,1670,1672,3,102,51,0,1671,1669,
	1,0,0,0,1672,1675,1,0,0,0,1673,1671,1,0,0,0,1673,1674,1,0,0,0,1674,1677,
	1,0,0,0,1675,1673,1,0,0,0,1676,1678,5,5,0,0,1677,1676,1,0,0,0,1677,1678,
	1,0,0,0,1678,1680,1,0,0,0,1679,1668,1,0,0,0,1679,1680,1,0,0,0,1680,1681,
	1,0,0,0,1681,1683,5,40,0,0,1682,1667,1,0,0,0,1682,1683,1,0,0,0,1683,1684,
	1,0,0,0,1684,1685,3,104,52,0,1685,195,1,0,0,0,1686,1687,5,106,0,0,1687,
	1688,5,2,0,0,1688,197,1,0,0,0,1689,1690,5,107,0,0,1690,1691,5,2,0,0,1691,
	199,1,0,0,0,1692,1696,5,161,0,0,1693,1694,5,173,0,0,1694,1696,3,214,107,
	0,1695,1692,1,0,0,0,1695,1693,1,0,0,0,1696,201,1,0,0,0,1697,1698,5,108,
	0,0,1698,1699,5,173,0,0,1699,1700,3,214,107,0,1700,1701,5,2,0,0,1701,1712,
	1,0,0,0,1702,1703,5,108,0,0,1703,1704,5,39,0,0,1704,1705,5,161,0,0,1705,
	1706,5,40,0,0,1706,1712,5,2,0,0,1707,1708,5,108,0,0,1708,1709,5,39,0,0,
	1709,1710,5,40,0,0,1710,1712,5,2,0,0,1711,1697,1,0,0,0,1711,1702,1,0,0,
	0,1711,1707,1,0,0,0,1712,203,1,0,0,0,1713,1714,5,109,0,0,1714,1715,5,39,
	0,0,1715,1716,3,222,111,0,1716,1717,5,40,0,0,1717,1718,5,2,0,0,1718,205,
	1,0,0,0,1719,1722,5,173,0,0,1720,1722,3,228,114,0,1721,1719,1,0,0,0,1721,
	1720,1,0,0,0,1722,207,1,0,0,0,1723,1735,5,39,0,0,1724,1729,3,206,103,0,
	1725,1726,5,5,0,0,1726,1728,3,206,103,0,1727,1725,1,0,0,0,1728,1731,1,0,
	0,0,1729,1727,1,0,0,0,1729,1730,1,0,0,0,1730,1733,1,0,0,0,1731,1729,1,0,
	0,0,1732,1734,5,5,0,0,1733,1732,1,0,0,0,1733,1734,1,0,0,0,1734,1736,1,0,
	0,0,1735,1724,1,0,0,0,1735,1736,1,0,0,0,1736,1737,1,0,0,0,1737,1738,5,40,
	0,0,1738,209,1,0,0,0,1739,1740,5,173,0,0,1740,1764,3,214,107,0,1741,1742,
	5,173,0,0,1742,1743,5,12,0,0,1743,1744,5,173,0,0,1744,1764,3,214,107,0,
	1745,1746,5,173,0,0,1746,1747,5,39,0,0,1747,1759,5,4,0,0,1748,1753,3,212,
	106,0,1749,1750,5,5,0,0,1750,1752,3,212,106,0,1751,1749,1,0,0,0,1752,1755,
	1,0,0,0,1753,1751,1,0,0,0,1753,1754,1,0,0,0,1754,1757,1,0,0,0,1755,1753,
	1,0,0,0,1756,1758,5,5,0,0,1757,1756,1,0,0,0,1757,1758,1,0,0,0,1758,1760,
	1,0,0,0,1759,1748,1,0,0,0,1759,1760,1,0,0,0,1760,1761,1,0,0,0,1761,1762,
	5,6,0,0,1762,1764,5,40,0,0,1763,1739,1,0,0,0,1763,1741,1,0,0,0,1763,1745,
	1,0,0,0,1764,211,1,0,0,0,1765,1766,5,173,0,0,1766,1767,5,102,0,0,1767,1768,
	3,222,111,0,1768,213,1,0,0,0,1769,1781,5,39,0,0,1770,1775,3,222,111,0,1771,
	1772,5,5,0,0,1772,1774,3,222,111,0,1773,1771,1,0,0,0,1774,1777,1,0,0,0,
	1775,1773,1,0,0,0,1775,1776,1,0,0,0,1776,1779,1,0,0,0,1777,1775,1,0,0,0,
	1778,1780,5,5,0,0,1779,1778,1,0,0,0,1779,1780,1,0,0,0,1780,1782,1,0,0,0,
	1781,1770,1,0,0,0,1781,1782,1,0,0,0,1782,1783,1,0,0,0,1783,1784,5,40,0,
	0,1784,215,1,0,0,0,1785,1786,5,4,0,0,1786,1791,3,218,109,0,1787,1788,5,
	5,0,0,1788,1790,3,218,109,0,1789,1787,1,0,0,0,1790,1793,1,0,0,0,1791,1789,
	1,0,0,0,1791,1792,1,0,0,0,1792,1795,1,0,0,0,1793,1791,1,0,0,0,1794,1796,
	5,5,0,0,1795,1794,1,0,0,0,1795,1796,1,0,0,0,1796,1797,1,0,0,0,1797,1798,
	5,6,0,0,1798,217,1,0,0,0,1799,1800,5,173,0,0,1800,1801,5,102,0,0,1801,1802,
	3,222,111,0,1802,219,1,0,0,0,1803,1804,5,39,0,0,1804,1809,3,234,117,0,1805,
	1806,5,5,0,0,1806,1808,3,234,117,0,1807,1805,1,0,0,0,1808,1811,1,0,0,0,
	1809,1807,1,0,0,0,1809,1810,1,0,0,0,1810,1813,1,0,0,0,1811,1809,1,0,0,0,
	1812,1814,5,5,0,0,1813,1812,1,0,0,0,1813,1814,1,0,0,0,1814,1815,1,0,0,0,
	1815,1816,5,40,0,0,1816,221,1,0,0,0,1817,1818,6,111,-1,0,1818,1819,5,39,
	0,0,1819,1820,3,222,111,0,1820,1821,5,40,0,0,1821,1946,1,0,0,0,1822,1823,
	3,236,118,0,1823,1824,5,39,0,0,1824,1826,3,222,111,0,1825,1827,5,5,0,0,
	1826,1825,1,0,0,0,1826,1827,1,0,0,0,1827,1828,1,0,0,0,1828,1829,5,40,0,
	0,1829,1946,1,0,0,0,1830,1946,3,210,105,0,1831,1832,5,110,0,0,1832,1834,
	5,173,0,0,1833,1835,3,216,108,0,1834,1833,1,0,0,0,1834,1835,1,0,0,0,1835,
	1836,1,0,0,0,1836,1946,3,214,107,0,1837,1838,5,110,0,0,1838,1839,3,234,
	117,0,1839,1840,5,57,0,0,1840,1841,5,58,0,0,1841,1842,5,39,0,0,1842,1843,
	3,222,111,0,1843,1844,5,40,0,0,1844,1946,1,0,0,0,1845,1846,5,46,0,0,1846,
	1847,5,39,0,0,1847,1848,3,234,117,0,1848,1849,5,40,0,0,1849,1850,5,12,0,
	0,1850,1851,5,173,0,0,1851,1946,1,0,0,0,1852,1853,5,111,0,0,1853,1946,3,
	214,107,0,1854,1855,5,112,0,0,1855,1946,3,214,107,0,1856,1857,5,113,0,0,
	1857,1946,3,214,107,0,1858,1859,5,114,0,0,1859,1946,3,214,107,0,1860,1861,
	5,115,0,0,1861,1862,5,39,0,0,1862,1863,5,173,0,0,1863,1864,5,12,0,0,1864,
	1865,5,173,0,0,1865,1866,5,5,0,0,1866,1867,3,214,107,0,1867,1868,5,40,0,
	0,1868,1946,1,0,0,0,1869,1870,5,116,0,0,1870,1946,3,214,107,0,1871,1872,
	5,117,0,0,1872,1946,3,214,107,0,1873,1874,5,118,0,0,1874,1875,5,39,0,0,
	1875,1876,3,222,111,0,1876,1877,5,5,0,0,1877,1878,3,220,110,0,1878,1879,
	5,40,0,0,1879,1946,1,0,0,0,1880,1881,5,119,0,0,1881,1882,5,39,0,0,1882,
	1883,3,222,111,0,1883,1884,5,5,0,0,1884,1885,3,220,110,0,1885,1886,5,5,
	0,0,1886,1887,5,154,0,0,1887,1888,5,40,0,0,1888,1946,1,0,0,0,1889,1890,
	5,120,0,0,1890,1891,5,57,0,0,1891,1892,3,222,111,0,1892,1893,5,58,0,0,1893,
	1894,7,7,0,0,1894,1946,1,0,0,0,1895,1896,5,126,0,0,1896,1897,5,57,0,0,1897,
	1898,3,222,111,0,1898,1899,5,58,0,0,1899,1900,7,8,0,0,1900,1946,1,0,0,0,
	1901,1902,7,9,0,0,1902,1946,3,222,111,20,1903,1915,5,57,0,0,1904,1909,3,
	222,111,0,1905,1906,5,5,0,0,1906,1908,3,222,111,0,1907,1905,1,0,0,0,1908,
	1911,1,0,0,0,1909,1907,1,0,0,0,1909,1910,1,0,0,0,1910,1913,1,0,0,0,1911,
	1909,1,0,0,0,1912,1914,5,5,0,0,1913,1912,1,0,0,0,1913,1914,1,0,0,0,1914,
	1916,1,0,0,0,1915,1904,1,0,0,0,1915,1916,1,0,0,0,1916,1917,1,0,0,0,1917,
	1946,5,58,0,0,1918,1919,5,70,0,0,1919,1920,5,12,0,0,1920,1921,5,173,0,0,
	1921,1922,5,12,0,0,1922,1923,5,173,0,0,1923,1924,5,57,0,0,1924,1925,3,222,
	111,0,1925,1926,5,58,0,0,1926,1927,3,224,112,0,1927,1946,1,0,0,0,1928,1929,
	5,70,0,0,1929,1930,5,12,0,0,1930,1935,5,173,0,0,1931,1932,5,57,0,0,1932,
	1933,3,222,111,0,1933,1934,5,58,0,0,1934,1936,1,0,0,0,1935,1931,1,0,0,0,
	1936,1937,1,0,0,0,1937,1935,1,0,0,0,1937,1938,1,0,0,0,1938,1946,1,0,0,0,
	1939,1940,5,70,0,0,1940,1941,5,12,0,0,1941,1946,5,173,0,0,1942,1946,5,170,
	0,0,1943,1946,5,173,0,0,1944,1946,3,228,114,0,1945,1817,1,0,0,0,1945,1822,
	1,0,0,0,1945,1830,1,0,0,0,1945,1831,1,0,0,0,1945,1837,1,0,0,0,1945,1845,
	1,0,0,0,1945,1852,1,0,0,0,1945,1854,1,0,0,0,1945,1856,1,0,0,0,1945,1858,
	1,0,0,0,1945,1860,1,0,0,0,1945,1869,1,0,0,0,1945,1871,1,0,0,0,1945,1873,
	1,0,0,0,1945,1880,1,0,0,0,1945,1889,1,0,0,0,1945,1895,1,0,0,0,1945,1901,
	1,0,0,0,1945,1903,1,0,0,0,1945,1918,1,0,0,0,1945,1928,1,0,0,0,1945,1939,
	1,0,0,0,1945,1942,1,0,0,0,1945,1943,1,0,0,0,1945,1944,1,0,0,0,1946,2029,
	1,0,0,0,1947,1948,10,19,0,0,1948,1949,5,17,0,0,1949,2028,3,222,111,19,1950,
	1951,10,18,0,0,1951,1952,7,10,0,0,1952,2028,3,222,111,19,1953,1954,10,17,
	0,0,1954,1955,7,11,0,0,1955,2028,3,222,111,18,1956,1957,10,16,0,0,1957,
	1958,7,12,0,0,1958,2028,3,222,111,17,1959,1960,10,15,0,0,1960,1961,7,13,
	0,0,1961,2028,3,222,111,16,1962,1963,10,14,0,0,1963,1964,7,14,0,0,1964,
	2028,3,222,111,15,1965,1966,10,13,0,0,1966,1967,5,24,0,0,1967,2028,3,222,
	111,14,1968,1969,10,12,0,0,1969,1970,5,26,0,0,1970,2028,3,222,111,13,1971,
	1972,10,11,0,0,1972,1973,5,25,0,0,1973,2028,3,222,111,12,1974,1975,10,10,
	0,0,1975,1976,5,138,0,0,1976,2028,3,222,111,11,1977,1978,10,9,0,0,1978,
	1979,5,139,0,0,1979,2028,3,222,111,10,1980,1981,10,8,0,0,1981,1982,5,140,
	0,0,1982,1983,3,222,111,0,1983,1984,5,102,0,0,1984,1985,3,222,111,8,1985,
	2028,1,0,0,0,1986,1987,10,30,0,0,1987,1988,5,57,0,0,1988,1989,3,222,111,
	0,1989,1990,5,102,0,0,1990,1991,3,222,111,0,1991,1992,5,58,0,0,1992,2028,
	1,0,0,0,1993,1994,10,29,0,0,1994,1995,5,57,0,0,1995,1996,5,154,0,0,1996,
	2028,5,58,0,0,1997,1998,10,28,0,0,1998,1999,5,57,0,0,1999,2000,3,222,111,
	0,2000,2001,5,58,0,0,2001,2028,1,0,0,0,2002,2003,10,25,0,0,2003,2028,7,
	15,0,0,2004,2005,10,24,0,0,2005,2006,5,133,0,0,2006,2007,5,39,0,0,2007,
	2008,3,222,111,0,2008,2009,5,40,0,0,2009,2028,1,0,0,0,2010,2011,10,23,0,
	0,2011,2012,5,134,0,0,2012,2013,5,39,0,0,2013,2014,3,222,111,0,2014,2015,
	5,5,0,0,2015,2016,3,222,111,0,2016,2017,5,40,0,0,2017,2028,1,0,0,0,2018,
	2019,10,22,0,0,2019,2020,5,12,0,0,2020,2022,5,173,0,0,2021,2023,3,216,108,
	0,2022,2021,1,0,0,0,2022,2023,1,0,0,0,2023,2024,1,0,0,0,2024,2028,3,214,
	107,0,2025,2026,10,21,0,0,2026,2028,3,224,112,0,2027,1947,1,0,0,0,2027,
	1950,1,0,0,0,2027,1953,1,0,0,0,2027,1956,1,0,0,0,2027,1959,1,0,0,0,2027,
	1962,1,0,0,0,2027,1965,1,0,0,0,2027,1968,1,0,0,0,2027,1971,1,0,0,0,2027,
	1974,1,0,0,0,2027,1977,1,0,0,0,2027,1980,1,0,0,0,2027,1986,1,0,0,0,2027,
	1993,1,0,0,0,2027,1997,1,0,0,0,2027,2002,1,0,0,0,2027,2004,1,0,0,0,2027,
	2010,1,0,0,0,2027,2018,1,0,0,0,2027,2025,1,0,0,0,2028,2031,1,0,0,0,2029,
	2027,1,0,0,0,2029,2030,1,0,0,0,2030,223,1,0,0,0,2031,2029,1,0,0,0,2032,
	2033,5,12,0,0,2033,2046,5,173,0,0,2034,2046,5,121,0,0,2035,2046,5,122,0,
	0,2036,2046,5,123,0,0,2037,2046,5,124,0,0,2038,2046,5,125,0,0,2039,2046,
	5,127,0,0,2040,2046,5,128,0,0,2041,2046,5,129,0,0,2042,2046,5,130,0,0,2043,
	2046,5,141,0,0,2044,2046,5,142,0,0,2045,2032,1,0,0,0,2045,2034,1,0,0,0,
	2045,2035,1,0,0,0,2045,2036,1,0,0,0,2045,2037,1,0,0,0,2045,2038,1,0,0,0,
	2045,2039,1,0,0,0,2045,2040,1,0,0,0,2045,2041,1,0,0,0,2045,2042,1,0,0,0,
	2045,2043,1,0,0,0,2045,2044,1,0,0,0,2046,225,1,0,0,0,2047,2048,7,16,0,0,
	2048,227,1,0,0,0,2049,2064,5,151,0,0,2050,2064,3,230,115,0,2051,2064,3,
	232,116,0,2052,2056,5,161,0,0,2053,2055,5,161,0,0,2054,2053,1,0,0,0,2055,
	2058,1,0,0,0,2056,2054,1,0,0,0,2056,2057,1,0,0,0,2057,2064,1,0,0,0,2058,
	2056,1,0,0,0,2059,2064,5,171,0,0,2060,2064,5,172,0,0,2061,2064,5,162,0,
	0,2062,2064,5,163,0,0,2063,2049,1,0,0,0,2063,2050,1,0,0,0,2063,2051,1,0,
	0,0,2063,2052,1,0,0,0,2063,2059,1,0,0,0,2063,2060,1,0,0,0,2063,2061,1,0,
	0,0,2063,2062,1,0,0,0,2064,229,1,0,0,0,2065,2067,5,154,0,0,2066,2068,5,
	152,0,0,2067,2066,1,0,0,0,2067,2068,1,0,0,0,2068,231,1,0,0,0,2069,2070,
	5,153,0,0,2070,233,1,0,0,0,2071,2072,5,147,0,0,2072,2112,5,50,0,0,2073,
	2112,5,147,0,0,2074,2112,5,157,0,0,2075,2112,5,159,0,0,2076,2112,5,158,
	0,0,2077,2112,5,166,0,0,2078,2112,5,167,0,0,2079,2112,5,148,0,0,2080,2112,
	5,149,0,0,2081,2112,5,168,0,0,2082,2112,5,169,0,0,2083,2084,5,7,0,0,2084,
	2093,5,39,0,0,2085,2090,3,234,117,0,2086,2087,5,5,0,0,2087,2089,3,234,117,
	0,2088,2086,1,0,0,0,2089,2092,1,0,0,0,2090,2088,1,0,0,0,2090,2091,1,0,0,
	0,2091,2094,1,0,0,0,2092,2090,1,0,0,0,2093,2085,1,0,0,0,2093,2094,1,0,0,
	0,2094,2095,1,0,0,0,2095,2108,5,40,0,0,2096,2097,5,69,0,0,2097,2098,5,39,
	0,0,2098,2103,3,234,117,0,2099,2100,5,5,0,0,2100,2102,3,234,117,0,2101,
	2099,1,0,0,0,2102,2105,1,0,0,0,2103,2101,1,0,0,0,2103,2104,1,0,0,0,2104,
	2106,1,0,0,0,2105,2103,1,0,0,0,2106,2107,5,40,0,0,2107,2109,1,0,0,0,2108,
	2096,1,0,0,0,2108,2109,1,0,0,0,2109,2112,1,0,0,0,2110,2112,5,173,0,0,2111,
	2071,1,0,0,0,2111,2073,1,0,0,0,2111,2074,1,0,0,0,2111,2075,1,0,0,0,2111,
	2076,1,0,0,0,2111,2077,1,0,0,0,2111,2078,1,0,0,0,2111,2079,1,0,0,0,2111,
	2080,1,0,0,0,2111,2081,1,0,0,0,2111,2082,1,0,0,0,2111,2083,1,0,0,0,2111,
	2110,1,0,0,0,2112,235,1,0,0,0,2113,2114,7,17,0,0,2114,237,1,0,0,0,210,241,
	247,253,259,265,271,277,283,289,295,301,306,325,329,336,341,347,353,363,
	366,376,380,386,389,393,398,402,415,418,432,435,441,447,453,459,465,471,
	477,492,505,515,521,527,533,539,545,551,556,564,567,573,579,585,591,597,
	603,609,615,621,625,629,631,635,638,648,654,658,670,674,676,680,686,698,
	702,704,718,734,738,745,765,772,783,789,796,804,815,824,830,841,848,854,
	861,867,873,877,885,890,898,908,913,917,929,938,940,946,952,959,970,976,
	980,986,993,1009,1018,1022,1028,1037,1041,1049,1053,1061,1065,1067,1075,
	1084,1089,1095,1100,1135,1161,1175,1187,1191,1196,1215,1220,1226,1245,1260,
	1277,1297,1309,1317,1327,1339,1349,1360,1367,1374,1384,1449,1453,1462,1472,
	1484,1492,1544,1560,1585,1597,1610,1614,1624,1632,1638,1644,1653,1657,1659,
	1665,1673,1677,1679,1682,1695,1711,1721,1729,1733,1735,1753,1757,1759,1763,
	1775,1779,1781,1791,1795,1809,1813,1826,1834,1909,1913,1915,1937,1945,2022,
	2027,2029,2045,2056,2063,2067,2090,2093,2103,2108,2111];

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
	public contractDefinition(): ContractDefinitionContext {
		return this.getTypedRuleContext(ContractDefinitionContext, 0) as ContractDefinitionContext;
	}
	public libraryDefinition_list(): LibraryDefinitionContext[] {
		return this.getTypedRuleContexts(LibraryDefinitionContext) as LibraryDefinitionContext[];
	}
	public libraryDefinition(i: number): LibraryDefinitionContext {
		return this.getTypedRuleContext(LibraryDefinitionContext, i) as LibraryDefinitionContext;
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
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public parameterList(): ParameterListContext {
		return this.getTypedRuleContext(ParameterListContext, 0) as ParameterListContext;
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
	public constantDefinition_list(): ConstantDefinitionContext[] {
		return this.getTypedRuleContexts(ConstantDefinitionContext) as ConstantDefinitionContext[];
	}
	public constantDefinition(i: number): ConstantDefinitionContext {
		return this.getTypedRuleContext(ConstantDefinitionContext, i) as ConstantDefinitionContext;
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
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public parameterList(): ParameterListContext {
		return this.getTypedRuleContext(ParameterListContext, 0) as ParameterListContext;
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
	public constructorDefinition(): ConstructorDefinitionContext {
		return this.getTypedRuleContext(ConstructorDefinitionContext, 0) as ConstructorDefinitionContext;
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
	public fallbackDefinition(): FallbackDefinitionContext {
		return this.getTypedRuleContext(FallbackDefinitionContext, 0) as FallbackDefinitionContext;
	}
	public receiveDefinition(): ReceiveDefinitionContext {
		return this.getTypedRuleContext(ReceiveDefinitionContext, 0) as ReceiveDefinitionContext;
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


export class AbstractFunctionDefinitionContext extends ParserRuleContext {
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
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
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
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
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
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
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
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public modifier_list(): ModifierContext[] {
		return this.getTypedRuleContexts(ModifierContext) as ModifierContext[];
	}
	public modifier(i: number): ModifierContext {
		return this.getTypedRuleContext(ModifierContext, i) as ModifierContext;
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
	public arrayAssignStatement(): ArrayAssignStatementContext {
		return this.getTypedRuleContext(ArrayAssignStatementContext, 0) as ArrayAssignStatementContext;
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
	public stateAssignStatement(): StateAssignStatementContext {
		return this.getTypedRuleContext(StateAssignStatementContext, 0) as StateAssignStatementContext;
	}
	public mappingFieldAssignStatement(): MappingFieldAssignStatementContext {
		return this.getTypedRuleContext(MappingFieldAssignStatementContext, 0) as MappingFieldAssignStatementContext;
	}
	public mappingAssignStatement(): MappingAssignStatementContext {
		return this.getTypedRuleContext(MappingAssignStatementContext, 0) as MappingAssignStatementContext;
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


export class EmitStatementContext extends ParserRuleContext {
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


export class MappingAssignStatementContext extends ParserRuleContext {
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
    	return SolidCashParser.RULE_mappingAssignStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitMappingAssignStatement) {
			return visitor.visitMappingAssignStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class MappingFieldAssignStatementContext extends ParserRuleContext {
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
    	return SolidCashParser.RULE_mappingFieldAssignStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitMappingFieldAssignStatement) {
			return visitor.visitMappingFieldAssignStatement(this);
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


export class StateAssignStatementContext extends ParserRuleContext {
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
    	return SolidCashParser.RULE_stateAssignStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitStateAssignStatement) {
			return visitor.visitStateAssignStatement(this);
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
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public modifier_list(): ModifierContext[] {
		return this.getTypedRuleContexts(ModifierContext) as ModifierContext[];
	}
	public modifier(i: number): ModifierContext {
		return this.getTypedRuleContext(ModifierContext, i) as ModifierContext;
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


export class ArrayAssignStatementContext extends ParserRuleContext {
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
    	return SolidCashParser.RULE_arrayAssignStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitArrayAssignStatement) {
			return visitor.visitArrayAssignStatement(this);
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
	public forUpdate(): ForUpdateContext {
		return this.getTypedRuleContext(ForUpdateContext, 0) as ForUpdateContext;
	}
	public block(): BlockContext {
		return this.getTypedRuleContext(BlockContext, 0) as BlockContext;
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
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public modifier_list(): ModifierContext[] {
		return this.getTypedRuleContexts(ModifierContext) as ModifierContext[];
	}
	public modifier(i: number): ModifierContext {
		return this.getTypedRuleContext(ModifierContext, i) as ModifierContext;
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
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
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
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
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
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
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
