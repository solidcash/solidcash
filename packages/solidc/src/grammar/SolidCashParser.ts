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
	public static readonly PrimitiveType = 155;
	public static readonly UnboundedBytes = 156;
	public static readonly BoundedBytes = 157;
	public static readonly Bound = 158;
	public static readonly StringLiteral = 159;
	public static readonly DateLiteral = 160;
	public static readonly HexLiteral = 161;
	public static readonly TxVar = 162;
	public static readonly UnsafeCast = 163;
	public static readonly BoundedSignedInt = 164;
	public static readonly BoundedUnsignedInt = 165;
	public static readonly BoundedSignedFixed = 166;
	public static readonly BoundedUnsignedFixed = 167;
	public static readonly NullaryOp = 168;
	public static readonly UnicodeLiteral = 169;
	public static readonly HexStringLiteral = 170;
	public static readonly Identifier = 171;
	public static readonly WHITESPACE = 172;
	public static readonly COMMENT = 173;
	public static readonly LINE_COMMENT = 174;
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
			this.state = 261;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 3, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					this.state = 259;
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
					}
					}
				}
				this.state = 263;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 3, this._ctx);
			}
			this.state = 266;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 36:
			case 37:
				{
				this.state = 264;
				this.contractDefinition();
				}
				break;
			case 35:
				{
				this.state = 265;
				this.libraryDefinition();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
			this.state = 268;
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
			this.state = 296;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 7, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 270;
				this.match(SolidCashParser.T__0);
				this.state = 271;
				this.match(SolidCashParser.StringLiteral);
				this.state = 272;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 273;
				this.match(SolidCashParser.T__0);
				this.state = 274;
				this.match(SolidCashParser.StringLiteral);
				this.state = 275;
				this.match(SolidCashParser.T__2);
				this.state = 276;
				this.match(SolidCashParser.Identifier);
				this.state = 277;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 278;
				this.match(SolidCashParser.T__0);
				this.state = 279;
				this.match(SolidCashParser.T__3);
				this.state = 280;
				this.importBinding();
				this.state = 285;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 5, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 281;
						this.match(SolidCashParser.T__4);
						this.state = 282;
						this.importBinding();
						}
						}
					}
					this.state = 287;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 5, this._ctx);
				}
				this.state = 289;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 288;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 291;
				this.match(SolidCashParser.T__5);
				this.state = 292;
				this.match(SolidCashParser.Identifier);
				this.state = 293;
				this.match(SolidCashParser.StringLiteral);
				this.state = 294;
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
			this.state = 298;
			this.match(SolidCashParser.Identifier);
			this.state = 301;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 299;
				this.match(SolidCashParser.T__2);
				this.state = 300;
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
			this.state = 303;
			this.match(SolidCashParser.T__6);
			this.state = 304;
			this.match(SolidCashParser.Identifier);
			this.state = 305;
			this.parameterList();
			this.state = 307;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 306;
				this.returnType();
				}
			}

			this.state = 309;
			this.match(SolidCashParser.T__3);
			this.state = 313;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 33519575) !== 0)) {
				{
				{
				this.state = 310;
				this.statement();
				}
				}
				this.state = 315;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 316;
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
			this.state = 353;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 17, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 318;
				this.match(SolidCashParser.T__7);
				this.state = 319;
				this.match(SolidCashParser.Identifier);
				this.state = 320;
				this.match(SolidCashParser.T__8);
				this.state = 323;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 7:
				case 147:
				case 148:
				case 149:
				case 155:
				case 156:
				case 157:
				case 164:
				case 165:
				case 166:
				case 167:
				case 171:
					{
					this.state = 321;
					this.typeName();
					}
					break;
				case 10:
					{
					this.state = 322;
					this.match(SolidCashParser.T__9);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 326;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 325;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 328;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 329;
				this.match(SolidCashParser.T__7);
				this.state = 330;
				this.match(SolidCashParser.T__3);
				this.state = 331;
				this.usingFunctionBinding();
				this.state = 336;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 332;
						this.match(SolidCashParser.T__4);
						this.state = 333;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 338;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				}
				this.state = 340;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 339;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 342;
				this.match(SolidCashParser.T__5);
				this.state = 343;
				this.match(SolidCashParser.T__8);
				this.state = 346;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 7:
				case 147:
				case 148:
				case 149:
				case 155:
				case 156:
				case 157:
				case 164:
				case 165:
				case 166:
				case 167:
				case 171:
					{
					this.state = 344;
					this.typeName();
					}
					break;
				case 10:
					{
					this.state = 345;
					this.match(SolidCashParser.T__9);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 349;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 348;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 351;
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
			this.state = 355;
			this.match(SolidCashParser.Identifier);
			this.state = 358;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===12) {
				{
				this.state = 356;
				this.match(SolidCashParser.T__11);
				this.state = 357;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 362;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 360;
				this.match(SolidCashParser.T__2);
				this.state = 361;
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
			this.state = 364;
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
			this.state = 366;
			this.match(SolidCashParser.T__27);
			this.state = 367;
			this.pragmaName();
			this.state = 368;
			this.pragmaValue();
			this.state = 369;
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
			this.state = 371;
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
			this.state = 373;
			this.versionConstraint();
			this.state = 375;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 1290797056) !== 0) || _la===150) {
				{
				this.state = 374;
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
			this.state = 378;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 1290797056) !== 0)) {
				{
				this.state = 377;
				this.versionOperator();
				}
			}

			this.state = 380;
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
			this.state = 382;
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
			this.state = 384;
			this.match(SolidCashParser.T__30);
			this.state = 385;
			this.match(SolidCashParser.Identifier);
			this.state = 395;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===32) {
				{
				this.state = 386;
				this.match(SolidCashParser.T__31);
				this.state = 387;
				this.match(SolidCashParser.Identifier);
				this.state = 392;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 388;
					this.match(SolidCashParser.T__4);
					this.state = 389;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 394;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 397;
			this.match(SolidCashParser.T__3);
			this.state = 401;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===45) {
				{
				{
				this.state = 398;
				this.enumDefinition();
				}
				}
				this.state = 403;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 407;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===44) {
				{
				{
				this.state = 404;
				this.structDefinition();
				}
				}
				this.state = 409;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 413;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===46) {
				{
				{
				this.state = 410;
				this.typeDefinition();
				}
				}
				this.state = 415;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 419;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===38) {
				{
				{
				this.state = 416;
				this.eventDefinition();
				}
				}
				this.state = 421;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 425;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 28, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 422;
					this.interfaceStateVariable();
					}
					}
				}
				this.state = 427;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 28, this._ctx);
			}
			this.state = 431;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===33 || _la===34) {
				{
				{
				this.state = 428;
				this.interfaceCollection();
				}
				}
				this.state = 433;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 437;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 434;
				this.interfaceFunction();
				}
				}
				this.state = 439;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 440;
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
			this.state = 452;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 31, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 442;
				this.interfaceStateVariableVisibility();
				this.state = 443;
				this.mappingType();
				this.state = 444;
				this.match(SolidCashParser.Identifier);
				this.state = 445;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 447;
				this.interfaceStateVariableVisibility();
				this.state = 448;
				this.arrayType(0);
				this.state = 449;
				this.match(SolidCashParser.Identifier);
				this.state = 450;
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
			this.state = 454;
			this.interfaceStateVariableVisibility();
			this.state = 455;
			this.typeName();
			this.state = 456;
			this.match(SolidCashParser.Identifier);
			this.state = 457;
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
			this.state = 459;
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
			this.state = 461;
			this.match(SolidCashParser.T__6);
			this.state = 462;
			this.match(SolidCashParser.Identifier);
			this.state = 463;
			this.parameterList();
			this.state = 465;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 464;
				this.returnType();
				}
			}

			this.state = 467;
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
			this.state = 469;
			this.match(SolidCashParser.T__34);
			this.state = 470;
			this.match(SolidCashParser.Identifier);
			this.state = 471;
			this.match(SolidCashParser.T__3);
			this.state = 475;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===45) {
				{
				{
				this.state = 472;
				this.enumDefinition();
				}
				}
				this.state = 477;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 481;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===44) {
				{
				{
				this.state = 478;
				this.structDefinition();
				}
				}
				this.state = 483;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 487;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===46) {
				{
				{
				this.state = 484;
				this.typeDefinition();
				}
				}
				this.state = 489;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 493;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===38) {
				{
				{
				this.state = 490;
				this.eventDefinition();
				}
				}
				this.state = 495;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 499;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 37, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 496;
					this.constantDefinition();
					}
					}
				}
				this.state = 501;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 37, this._ctx);
			}
			this.state = 505;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 502;
				this.freeFunctionDefinition();
				}
				}
				this.state = 507;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 508;
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
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 511;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===36) {
				{
				this.state = 510;
				this.match(SolidCashParser.T__35);
				}
			}

			this.state = 513;
			this.match(SolidCashParser.T__36);
			this.state = 514;
			this.match(SolidCashParser.Identifier);
			this.state = 516;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===39) {
				{
				this.state = 515;
				this.parameterList();
				}
			}

			this.state = 527;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===32) {
				{
				this.state = 518;
				this.match(SolidCashParser.T__31);
				this.state = 519;
				this.match(SolidCashParser.Identifier);
				this.state = 524;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 520;
					this.match(SolidCashParser.T__4);
					this.state = 521;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 526;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 529;
			this.match(SolidCashParser.T__3);
			this.state = 546;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 75086883) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 18745095) !== 0)) {
				{
				this.state = 544;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 43, this._ctx) ) {
				case 1:
					{
					this.state = 530;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 531;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 532;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 533;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 534;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 535;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 536;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 537;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 538;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 539;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 540;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 541;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 542;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 543;
					this.receiveDefinition();
					}
					break;
				}
				}
				this.state = 548;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 549;
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
			this.state = 551;
			this.match(SolidCashParser.T__6);
			this.state = 552;
			this.match(SolidCashParser.Identifier);
			this.state = 553;
			this.parameterList();
			this.state = 557;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 4030070787) !== 0) || ((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & 15) !== 0)) {
				{
				{
				this.state = 554;
				this.functionModifier();
				}
				}
				this.state = 559;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 563;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===171) {
				{
				{
				this.state = 560;
				this.customModifierInvocation();
				}
				}
				this.state = 565;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 567;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 566;
				this.returnType();
				}
			}

			this.state = 569;
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
			this.state = 571;
			this.match(SolidCashParser.T__37);
			this.state = 572;
			this.match(SolidCashParser.Identifier);
			this.state = 573;
			this.match(SolidCashParser.T__38);
			this.state = 585;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 18745095) !== 0)) {
				{
				this.state = 574;
				this.eventParameter();
				this.state = 579;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 48, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 575;
						this.match(SolidCashParser.T__4);
						this.state = 576;
						this.eventParameter();
						}
						}
					}
					this.state = 581;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 48, this._ctx);
				}
				this.state = 583;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 582;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 587;
			this.match(SolidCashParser.T__39);
			this.state = 589;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===41) {
				{
				this.state = 588;
				this.match(SolidCashParser.T__40);
				}
			}

			this.state = 591;
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
			this.state = 593;
			this.typeName();
			this.state = 595;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 594;
				this.match(SolidCashParser.T__41);
				}
			}

			this.state = 597;
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
			this.state = 599;
			this.match(SolidCashParser.T__42);
			this.state = 600;
			this.match(SolidCashParser.Identifier);
			this.state = 601;
			this.match(SolidCashParser.T__38);
			this.state = 613;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 18745095) !== 0)) {
				{
				this.state = 602;
				this.errorParameter();
				this.state = 607;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 53, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 603;
						this.match(SolidCashParser.T__4);
						this.state = 604;
						this.errorParameter();
						}
						}
					}
					this.state = 609;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 53, this._ctx);
				}
				this.state = 611;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 610;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 615;
			this.match(SolidCashParser.T__39);
			this.state = 616;
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
			this.state = 618;
			this.typeName();
			this.state = 619;
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
			this.state = 621;
			this.match(SolidCashParser.T__43);
			this.state = 622;
			this.match(SolidCashParser.Identifier);
			this.state = 623;
			this.match(SolidCashParser.T__3);
			this.state = 625;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 624;
				this.structField();
				}
				}
				this.state = 627;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 18745095) !== 0));
			this.state = 629;
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
			this.state = 631;
			this.typeName();
			this.state = 632;
			this.match(SolidCashParser.Identifier);
			this.state = 633;
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
			this.state = 635;
			this.match(SolidCashParser.T__44);
			this.state = 636;
			this.match(SolidCashParser.Identifier);
			this.state = 637;
			this.match(SolidCashParser.T__3);
			this.state = 638;
			this.enumMember();
			this.state = 643;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 57, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 639;
					this.match(SolidCashParser.T__4);
					this.state = 640;
					this.enumMember();
					}
					}
				}
				this.state = 645;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 57, this._ctx);
			}
			this.state = 647;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 646;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 649;
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
			this.state = 651;
			this.match(SolidCashParser.Identifier);
			this.state = 654;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===30) {
				{
				this.state = 652;
				this.match(SolidCashParser.T__29);
				this.state = 653;
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
			this.state = 656;
			this.match(SolidCashParser.T__45);
			this.state = 657;
			this.match(SolidCashParser.Identifier);
			this.state = 658;
			this.match(SolidCashParser.T__31);
			this.state = 659;
			this.typeName();
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
	public constantDefinition(): ConstantDefinitionContext {
		let localctx: ConstantDefinitionContext = new ConstantDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 58, SolidCashParser.RULE_constantDefinition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 662;
			this.typeName();
			this.state = 663;
			this.match(SolidCashParser.T__46);
			this.state = 664;
			this.match(SolidCashParser.Identifier);
			this.state = 665;
			this.match(SolidCashParser.T__29);
			this.state = 666;
			this.expression(0);
			this.state = 667;
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
			this.state = 669;
			this.match(SolidCashParser.T__47);
			this.state = 670;
			this.parameterList();
			this.state = 674;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===171) {
				{
				{
				this.state = 671;
				this.parentInvocation();
				}
				}
				this.state = 676;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 677;
			this.match(SolidCashParser.T__3);
			this.state = 681;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 33519575) !== 0)) {
				{
				{
				this.state = 678;
				this.statement();
				}
				}
				this.state = 683;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 684;
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
			this.state = 686;
			this.match(SolidCashParser.T__48);
			this.state = 687;
			this.parameterList();
			this.state = 688;
			this.match(SolidCashParser.T__33);
			this.state = 692;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 131075) !== 0)) {
				{
				{
				this.state = 689;
				this.fallbackModifier();
				}
				}
				this.state = 694;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 698;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===171) {
				{
				{
				this.state = 695;
				this.customModifierInvocation();
				}
				}
				this.state = 700;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 701;
			this.match(SolidCashParser.T__3);
			this.state = 705;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 33519575) !== 0)) {
				{
				{
				this.state = 702;
				this.statement();
				}
				}
				this.state = 707;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 708;
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
			this.state = 713;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 50:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 710;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 51:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 711;
				this.match(SolidCashParser.T__50);
				}
				break;
			case 67:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 712;
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
			this.state = 715;
			this.match(SolidCashParser.T__51);
			this.state = 716;
			this.match(SolidCashParser.T__38);
			this.state = 717;
			this.match(SolidCashParser.T__39);
			this.state = 718;
			this.match(SolidCashParser.T__33);
			this.state = 719;
			this.match(SolidCashParser.T__49);
			this.state = 720;
			this.match(SolidCashParser.T__3);
			this.state = 724;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 33519575) !== 0)) {
				{
				{
				this.state = 721;
				this.statement();
				}
				}
				this.state = 726;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 727;
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
			this.state = 729;
			this.match(SolidCashParser.Identifier);
			this.state = 730;
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
			this.state = 782;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 74, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 733;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 3145731) !== 0)) {
					{
					this.state = 732;
					this.stateVariableVisibility();
					}
				}

				this.state = 735;
				this.typeName();
				this.state = 739;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 736;
					this.modifier();
					}
					}
					this.state = 741;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 742;
				this.match(SolidCashParser.Identifier);
				this.state = 743;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 745;
				this.typeName();
				this.state = 746;
				this.stateVariableVisibility();
				this.state = 750;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
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
				this.state = 754;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 757;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 3145731) !== 0)) {
					{
					this.state = 756;
					this.stateVariableVisibility();
					}
				}

				this.state = 759;
				this.mappingType();
				this.state = 763;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 3162115) !== 0) || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 760;
					this.collectionModifier();
					}
					}
					this.state = 765;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 766;
				this.match(SolidCashParser.Identifier);
				this.state = 767;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 770;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 3145731) !== 0)) {
					{
					this.state = 769;
					this.stateVariableVisibility();
					}
				}

				this.state = 772;
				this.arrayType(0);
				this.state = 776;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 3162115) !== 0) || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 773;
					this.collectionModifier();
					}
					}
					this.state = 778;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 779;
				this.match(SolidCashParser.Identifier);
				this.state = 780;
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
			this.state = 786;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 47:
			case 143:
			case 144:
			case 145:
			case 146:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 784;
				this.modifier();
				}
				break;
			case 33:
			case 34:
			case 53:
			case 54:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 785;
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
			this.state = 788;
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
			this.state = 826;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 81, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 790;
				this.match(SolidCashParser.T__54);
				this.state = 791;
				this.match(SolidCashParser.T__38);
				this.state = 792;
				this.typeName();
				this.state = 794;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===171) {
					{
					this.state = 793;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 796;
				this.match(SolidCashParser.T__55);
				this.state = 797;
				this.typeName();
				this.state = 799;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===171) {
					{
					this.state = 798;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 801;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 803;
				this.match(SolidCashParser.T__54);
				this.state = 804;
				this.match(SolidCashParser.T__38);
				this.state = 805;
				this.typeName();
				this.state = 807;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===171) {
					{
					this.state = 806;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 809;
				this.match(SolidCashParser.T__55);
				this.state = 810;
				this.mappingType();
				this.state = 811;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 813;
				this.match(SolidCashParser.T__54);
				this.state = 814;
				this.match(SolidCashParser.T__38);
				this.state = 815;
				this.typeName();
				this.state = 817;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===171) {
					{
					this.state = 816;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 819;
				this.match(SolidCashParser.T__55);
				this.state = 820;
				this.arrayType(0);
				this.state = 822;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===171) {
					{
					this.state = 821;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 824;
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
			this.state = 838;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 82, this._ctx) ) {
			case 1:
				{
				this.state = 829;
				this.typeName();
				this.state = 830;
				this.match(SolidCashParser.T__56);
				this.state = 831;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 832;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 2:
				{
				this.state = 834;
				this.typeName();
				this.state = 835;
				this.match(SolidCashParser.T__56);
				this.state = 836;
				this.match(SolidCashParser.T__57);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 849;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 84, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 847;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 83, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 840;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 841;
						this.match(SolidCashParser.T__56);
						this.state = 842;
						this.match(SolidCashParser.NumberLiteral);
						this.state = 843;
						this.match(SolidCashParser.T__57);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 844;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 845;
						this.match(SolidCashParser.T__56);
						this.state = 846;
						this.match(SolidCashParser.T__57);
						}
						break;
					}
					}
				}
				this.state = 851;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 84, this._ctx);
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
			this.state = 852;
			this.match(SolidCashParser.T__58);
			this.state = 853;
			this.match(SolidCashParser.Identifier);
			this.state = 855;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===39) {
				{
				this.state = 854;
				this.parameterList();
				}
			}

			this.state = 857;
			this.match(SolidCashParser.T__3);
			this.state = 861;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2149845121) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 33519575) !== 0)) {
				{
				{
				this.state = 858;
				this.modifierStatement();
				}
				}
				this.state = 863;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 864;
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
			this.state = 868;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 60:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 866;
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
			case 155:
			case 156:
			case 157:
			case 159:
			case 160:
			case 161:
			case 163:
			case 164:
			case 165:
			case 166:
			case 167:
			case 168:
			case 169:
			case 170:
			case 171:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 867;
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
			this.state = 870;
			this.match(SolidCashParser.T__59);
			this.state = 871;
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
			this.state = 873;
			this.match(SolidCashParser.T__6);
			this.state = 874;
			this.match(SolidCashParser.Identifier);
			this.state = 875;
			this.parameterList();
			this.state = 879;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 4030070787) !== 0) || ((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & 15) !== 0)) {
				{
				{
				this.state = 876;
				this.functionModifier();
				}
				}
				this.state = 881;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 885;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===171) {
				{
				{
				this.state = 882;
				this.customModifierInvocation();
				}
				}
				this.state = 887;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 889;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 888;
				this.returnType();
				}
			}

			this.state = 891;
			this.match(SolidCashParser.T__3);
			this.state = 895;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 33519575) !== 0)) {
				{
				{
				this.state = 892;
				this.statement();
				}
				}
				this.state = 897;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 898;
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
			this.state = 900;
			this.match(SolidCashParser.Identifier);
			this.state = 902;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===39) {
				{
				this.state = 901;
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
			this.state = 918;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 61:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 904;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 62:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 905;
				this.match(SolidCashParser.T__61);
				}
				break;
			case 53:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 906;
				this.match(SolidCashParser.T__52);
				}
				break;
			case 34:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 907;
				this.match(SolidCashParser.T__33);
				}
				break;
			case 33:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 908;
				this.match(SolidCashParser.T__32);
				}
				break;
			case 54:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 909;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 50:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 910;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 67:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 911;
				this.overrideSpecifier();
				}
				break;
			case 51:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 912;
				this.match(SolidCashParser.T__50);
				}
				break;
			case 68:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 913;
				this.unsafeModifier();
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 914;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 64:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 915;
				this.match(SolidCashParser.T__63);
				}
				break;
			case 65:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 916;
				this.match(SolidCashParser.T__64);
				}
				break;
			case 66:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 917;
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
			this.state = 920;
			this.match(SolidCashParser.T__66);
			this.state = 931;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===39) {
				{
				this.state = 921;
				this.match(SolidCashParser.T__38);
				this.state = 922;
				this.match(SolidCashParser.Identifier);
				this.state = 927;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 923;
					this.match(SolidCashParser.T__4);
					this.state = 924;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 929;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 930;
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
			this.state = 933;
			this.match(SolidCashParser.T__67);
			this.state = 937;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===39) {
				{
				this.state = 934;
				this.match(SolidCashParser.T__38);
				this.state = 935;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 936;
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
			this.state = 939;
			this.match(SolidCashParser.T__68);
			this.state = 940;
			this.match(SolidCashParser.T__38);
			this.state = 941;
			this.returnParam();
			this.state = 946;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 97, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 942;
					this.match(SolidCashParser.T__4);
					this.state = 943;
					this.returnParam();
					}
					}
				}
				this.state = 948;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 97, this._ctx);
			}
			this.state = 950;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 949;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 952;
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
			this.state = 954;
			this.typeName();
			this.state = 958;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
				{
				{
				this.state = 955;
				this.modifier();
				}
				}
				this.state = 960;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 962;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===171) {
				{
				this.state = 961;
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
			this.state = 964;
			this.match(SolidCashParser.T__38);
			this.state = 976;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 18745095) !== 0)) {
				{
				this.state = 965;
				this.parameter();
				this.state = 970;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 101, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 966;
						this.match(SolidCashParser.T__4);
						this.state = 967;
						this.parameter();
						}
						}
					}
					this.state = 972;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 101, this._ctx);
				}
				this.state = 974;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 973;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 978;
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
			this.state = 998;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 106, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 980;
				this.typeName();
				this.state = 984;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 981;
					this.modifier();
					}
					}
					this.state = 986;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 987;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 989;
				this.arrayType(0);
				this.state = 993;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 990;
					this.modifier();
					}
					}
					this.state = 995;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 996;
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
			this.state = 1009;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1000;
				this.match(SolidCashParser.T__3);
				this.state = 1004;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 33519575) !== 0)) {
					{
					{
					this.state = 1001;
					this.statement();
					}
					}
					this.state = 1006;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1007;
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
			case 155:
			case 156:
			case 157:
			case 159:
			case 160:
			case 161:
			case 163:
			case 164:
			case 165:
			case 166:
			case 167:
			case 168:
			case 169:
			case 170:
			case 171:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1008;
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
			this.state = 1044;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 109, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1011;
				this.variableDefinition();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1012;
				this.tupleAssignment();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1013;
				this.arrayAssignStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1014;
				this.arrayPushStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1015;
				this.arrayPopStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1016;
				this.arrayDeleteStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1017;
				this.stateArrayPushStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1018;
				this.stateArrayPopStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1019;
				this.assignStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1020;
				this.stateAssignStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1021;
				this.mappingFieldAssignStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1022;
				this.mappingAssignStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1023;
				this.mappingDeleteStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1024;
				this.timeOpStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1025;
				this.requireStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1026;
				this.ifStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1027;
				this.loopStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1028;
				this.consoleStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1029;
				this.emitStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1030;
				this.transferStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1031;
				this.tokenContainerMethodStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1032;
				this.returnStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1033;
				this.functionCallStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1034;
				this.addressMethodStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1035;
				this.assemblyStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1036;
				this.tryCatchStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1037;
				this.revertStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1038;
				this.assertStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1039;
				this.deleteStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1040;
				this.uncheckedStatement();
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 31);
				{
				this.state = 1041;
				this.switchStatement();
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 32);
				{
				this.state = 1042;
				this.breakStatement();
				}
				break;
			case 33:
				this.enterOuterAlt(localctx, 33);
				{
				this.state = 1043;
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
			this.state = 1046;
			this.match(SolidCashParser.T__69);
			this.state = 1047;
			this.match(SolidCashParser.T__11);
			this.state = 1048;
			this.match(SolidCashParser.Identifier);
			this.state = 1049;
			this.match(SolidCashParser.T__38);
			this.state = 1050;
			this.expression(0);
			this.state = 1051;
			this.match(SolidCashParser.T__4);
			this.state = 1052;
			this.expression(0);
			this.state = 1053;
			this.match(SolidCashParser.T__39);
			this.state = 1054;
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
			this.state = 1056;
			this.match(SolidCashParser.T__69);
			this.state = 1057;
			this.match(SolidCashParser.T__11);
			this.state = 1058;
			this.match(SolidCashParser.Identifier);
			this.state = 1059;
			this.match(SolidCashParser.T__56);
			this.state = 1060;
			this.expression(0);
			this.state = 1061;
			this.match(SolidCashParser.T__57);
			this.state = 1062;
			this.match(SolidCashParser.T__11);
			this.state = 1063;
			this.match(SolidCashParser.Identifier);
			this.state = 1064;
			this.match(SolidCashParser.T__38);
			this.state = 1065;
			this.expression(0);
			this.state = 1070;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1066;
				this.match(SolidCashParser.T__4);
				this.state = 1067;
				this.expression(0);
				}
				}
				this.state = 1072;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1073;
			this.match(SolidCashParser.T__39);
			this.state = 1074;
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
			this.state = 1105;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 114, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1076;
				this.match(SolidCashParser.T__70);
				this.state = 1077;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1078;
				this.match(SolidCashParser.T__70);
				this.state = 1079;
				this.expression(0);
				this.state = 1084;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1080;
					this.match(SolidCashParser.T__4);
					this.state = 1081;
					this.expression(0);
					}
					}
					this.state = 1086;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1087;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1089;
				this.match(SolidCashParser.T__70);
				this.state = 1090;
				this.match(SolidCashParser.T__38);
				this.state = 1091;
				this.expression(0);
				this.state = 1096;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 112, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1092;
						this.match(SolidCashParser.T__4);
						this.state = 1093;
						this.expression(0);
						}
						}
					}
					this.state = 1098;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 112, this._ctx);
				}
				this.state = 1100;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1099;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1102;
				this.match(SolidCashParser.T__39);
				this.state = 1103;
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
			this.state = 1129;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 116, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1107;
				this.match(SolidCashParser.Identifier);
				this.state = 1108;
				this.expressionList();
				this.state = 1109;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1111;
				this.match(SolidCashParser.Identifier);
				this.state = 1112;
				this.match(SolidCashParser.T__11);
				this.state = 1113;
				this.match(SolidCashParser.Identifier);
				this.state = 1114;
				this.expressionList();
				this.state = 1115;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1117;
				this.match(SolidCashParser.Identifier);
				this.state = 1118;
				this.expressionList();
				this.state = 1119;
				this.match(SolidCashParser.T__11);
				this.state = 1120;
				this.match(SolidCashParser.Identifier);
				this.state = 1121;
				this.match(SolidCashParser.T__11);
				this.state = 1122;
				this.match(SolidCashParser.Identifier);
				this.state = 1124;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1123;
					this.callOptions();
					}
				}

				this.state = 1126;
				this.expressionList();
				this.state = 1127;
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
			this.state = 1131;
			this.expression(0);
			this.state = 1132;
			this.match(SolidCashParser.T__11);
			this.state = 1133;
			this.match(SolidCashParser.Identifier);
			this.state = 1135;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===4) {
				{
				this.state = 1134;
				this.callOptions();
				}
			}

			this.state = 1137;
			this.expressionList();
			this.state = 1138;
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
			this.state = 1140;
			this.match(SolidCashParser.T__71);
			this.state = 1141;
			this.match(SolidCashParser.Identifier);
			this.state = 1142;
			this.expressionList();
			this.state = 1143;
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
			this.state = 1145;
			this.match(SolidCashParser.T__69);
			this.state = 1146;
			this.match(SolidCashParser.T__11);
			this.state = 1147;
			this.match(SolidCashParser.Identifier);
			this.state = 1152;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 1148;
				this.match(SolidCashParser.T__56);
				this.state = 1149;
				this.expression(0);
				this.state = 1150;
				this.match(SolidCashParser.T__57);
				}
				}
				this.state = 1154;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===57);
			this.state = 1156;
			this.match(SolidCashParser.T__29);
			this.state = 1157;
			this.expression(0);
			this.state = 1158;
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
			this.state = 1160;
			this.match(SolidCashParser.T__69);
			this.state = 1161;
			this.match(SolidCashParser.T__11);
			this.state = 1162;
			this.match(SolidCashParser.Identifier);
			this.state = 1167;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 1163;
				this.match(SolidCashParser.T__56);
				this.state = 1164;
				this.expression(0);
				this.state = 1165;
				this.match(SolidCashParser.T__57);
				}
				}
				this.state = 1169;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===57);
			this.state = 1171;
			this.match(SolidCashParser.T__11);
			this.state = 1172;
			this.match(SolidCashParser.Identifier);
			this.state = 1173;
			this.match(SolidCashParser.T__29);
			this.state = 1174;
			this.expression(0);
			this.state = 1175;
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
			this.state = 1177;
			this.match(SolidCashParser.T__69);
			this.state = 1178;
			this.match(SolidCashParser.T__11);
			this.state = 1179;
			this.match(SolidCashParser.Identifier);
			this.state = 1186;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===57) {
				{
				{
				this.state = 1180;
				this.match(SolidCashParser.T__56);
				this.state = 1181;
				this.expression(0);
				this.state = 1182;
				this.match(SolidCashParser.T__57);
				}
				}
				this.state = 1188;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1189;
			this.match(SolidCashParser.T__72);
			this.state = 1190;
			this.match(SolidCashParser.T__38);
			this.state = 1191;
			this.expression(0);
			this.state = 1192;
			this.match(SolidCashParser.T__39);
			this.state = 1193;
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
			this.state = 1195;
			this.match(SolidCashParser.T__69);
			this.state = 1196;
			this.match(SolidCashParser.T__11);
			this.state = 1197;
			this.match(SolidCashParser.Identifier);
			this.state = 1198;
			this.match(SolidCashParser.T__29);
			this.state = 1199;
			this.expression(0);
			this.state = 1200;
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
			this.state = 1228;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 124, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1202;
				this.typeName();
				this.state = 1206;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 1203;
					this.modifier();
					}
					}
					this.state = 1208;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1209;
				this.match(SolidCashParser.Identifier);
				this.state = 1212;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===30) {
					{
					this.state = 1210;
					this.match(SolidCashParser.T__29);
					this.state = 1211;
					this.expression(0);
					}
				}

				this.state = 1214;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1216;
				this.arrayType(0);
				this.state = 1220;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 1217;
					this.modifier();
					}
					}
					this.state = 1222;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1223;
				this.match(SolidCashParser.Identifier);
				this.state = 1224;
				this.match(SolidCashParser.T__29);
				this.state = 1225;
				this.expression(0);
				this.state = 1226;
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
			this.state = 1278;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 129, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1230;
				this.typeName();
				this.state = 1231;
				this.match(SolidCashParser.Identifier);
				this.state = 1236;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1232;
					this.match(SolidCashParser.T__4);
					this.state = 1233;
					this.typeName();
					this.state = 1234;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1238;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1240;
				this.match(SolidCashParser.T__29);
				this.state = 1241;
				this.expression(0);
				this.state = 1242;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1244;
				this.match(SolidCashParser.T__38);
				this.state = 1245;
				this.tupleSlot();
				this.state = 1248;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1246;
					this.match(SolidCashParser.T__4);
					this.state = 1247;
					this.tupleSlot();
					}
					}
					this.state = 1250;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1252;
				this.match(SolidCashParser.T__39);
				this.state = 1253;
				this.match(SolidCashParser.T__29);
				this.state = 1254;
				this.match(SolidCashParser.T__38);
				this.state = 1255;
				this.expression(0);
				this.state = 1258;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1256;
					this.match(SolidCashParser.T__4);
					this.state = 1257;
					this.expression(0);
					}
					}
					this.state = 1260;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1262;
				this.match(SolidCashParser.T__39);
				this.state = 1263;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1265;
				this.match(SolidCashParser.T__38);
				this.state = 1266;
				this.tupleSlot();
				this.state = 1269;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1267;
					this.match(SolidCashParser.T__4);
					this.state = 1268;
					this.tupleSlot();
					}
					}
					this.state = 1271;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1273;
				this.match(SolidCashParser.T__39);
				this.state = 1274;
				this.match(SolidCashParser.T__29);
				this.state = 1275;
				this.expression(0);
				this.state = 1276;
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
			this.state = 1285;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 130, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1280;
				this.typeName();
				this.state = 1281;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1283;
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
			this.state = 1295;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 131, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1287;
				this.match(SolidCashParser.Identifier);
				this.state = 1288;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===30 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1289;
				this.expression(0);
				this.state = 1290;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1292;
				this.match(SolidCashParser.Identifier);
				this.state = 1293;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===84 || _la===85)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1294;
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
			this.state = 1297;
			this.match(SolidCashParser.Identifier);
			this.state = 1298;
			this.match(SolidCashParser.T__85);
			this.state = 1299;
			this.match(SolidCashParser.T__38);
			this.state = 1300;
			this.expression(0);
			this.state = 1301;
			this.match(SolidCashParser.T__39);
			this.state = 1302;
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
			this.state = 1304;
			this.match(SolidCashParser.Identifier);
			this.state = 1305;
			this.match(SolidCashParser.T__86);
			this.state = 1306;
			this.match(SolidCashParser.T__38);
			this.state = 1307;
			this.match(SolidCashParser.T__39);
			this.state = 1308;
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
			this.state = 1310;
			this.match(SolidCashParser.Identifier);
			this.state = 1311;
			this.match(SolidCashParser.T__56);
			this.state = 1312;
			this.expression(0);
			this.state = 1313;
			this.match(SolidCashParser.T__57);
			this.state = 1314;
			this.match(SolidCashParser.T__29);
			this.state = 1315;
			this.expression(0);
			this.state = 1316;
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
			this.state = 1318;
			this.match(SolidCashParser.Identifier);
			this.state = 1319;
			this.match(SolidCashParser.T__72);
			this.state = 1320;
			this.match(SolidCashParser.T__38);
			this.state = 1321;
			this.expression(0);
			this.state = 1322;
			this.match(SolidCashParser.T__39);
			this.state = 1323;
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
			this.state = 1325;
			this.match(SolidCashParser.T__69);
			this.state = 1326;
			this.match(SolidCashParser.T__11);
			this.state = 1327;
			this.match(SolidCashParser.Identifier);
			this.state = 1328;
			this.match(SolidCashParser.T__85);
			this.state = 1329;
			this.match(SolidCashParser.T__38);
			this.state = 1330;
			this.expression(0);
			this.state = 1331;
			this.match(SolidCashParser.T__39);
			this.state = 1332;
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
			this.state = 1334;
			this.match(SolidCashParser.T__69);
			this.state = 1335;
			this.match(SolidCashParser.T__11);
			this.state = 1336;
			this.match(SolidCashParser.Identifier);
			this.state = 1337;
			this.match(SolidCashParser.T__86);
			this.state = 1338;
			this.match(SolidCashParser.T__38);
			this.state = 1339;
			this.match(SolidCashParser.T__39);
			this.state = 1340;
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
			this.state = 1364;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 133, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1342;
				this.match(SolidCashParser.T__87);
				this.state = 1343;
				this.match(SolidCashParser.Identifier);
				this.state = 1344;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1345;
				this.match(SolidCashParser.T__87);
				this.state = 1346;
				this.match(SolidCashParser.T__69);
				this.state = 1347;
				this.match(SolidCashParser.T__11);
				this.state = 1348;
				this.match(SolidCashParser.Identifier);
				this.state = 1349;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1350;
				this.match(SolidCashParser.T__87);
				this.state = 1351;
				this.match(SolidCashParser.T__69);
				this.state = 1352;
				this.match(SolidCashParser.T__11);
				this.state = 1353;
				this.match(SolidCashParser.Identifier);
				this.state = 1358;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1354;
					this.match(SolidCashParser.T__56);
					this.state = 1355;
					this.expression(0);
					this.state = 1356;
					this.match(SolidCashParser.T__57);
					}
					}
					this.state = 1360;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===57);
				this.state = 1362;
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
			this.state = 1366;
			this.match(SolidCashParser.T__88);
			this.state = 1367;
			this.match(SolidCashParser.T__38);
			this.state = 1368;
			this.match(SolidCashParser.TxVar);
			this.state = 1369;
			this.match(SolidCashParser.T__22);
			this.state = 1370;
			this.expression(0);
			this.state = 1373;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1371;
				this.match(SolidCashParser.T__4);
				this.state = 1372;
				this.requireMessage();
				}
			}

			this.state = 1375;
			this.match(SolidCashParser.T__39);
			this.state = 1376;
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
			this.state = 1378;
			this.match(SolidCashParser.T__88);
			this.state = 1379;
			this.match(SolidCashParser.T__38);
			this.state = 1380;
			this.expression(0);
			this.state = 1383;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1381;
				this.match(SolidCashParser.T__4);
				this.state = 1382;
				this.requireMessage();
				}
			}

			this.state = 1385;
			this.match(SolidCashParser.T__39);
			this.state = 1386;
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
			this.state = 1388;
			this.match(SolidCashParser.T__89);
			this.state = 1389;
			this.match(SolidCashParser.T__38);
			this.state = 1390;
			this.expression(0);
			this.state = 1391;
			this.match(SolidCashParser.T__39);
			this.state = 1392;
			localctx._ifBlock = this.block();
			this.state = 1395;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 136, this._ctx) ) {
			case 1:
				{
				this.state = 1393;
				this.match(SolidCashParser.T__90);
				this.state = 1394;
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
			this.state = 1403;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 137, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1397;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1398;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1399;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1400;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1401;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1402;
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
			this.state = 1405;
			this.match(SolidCashParser.T__8);
			this.state = 1406;
			this.match(SolidCashParser.T__38);
			this.state = 1407;
			this.typeName();
			this.state = 1408;
			this.match(SolidCashParser.Identifier);
			this.state = 1409;
			this.match(SolidCashParser.T__4);
			this.state = 1410;
			this.typeName();
			this.state = 1411;
			this.match(SolidCashParser.Identifier);
			this.state = 1412;
			this.match(SolidCashParser.T__91);
			this.state = 1413;
			this.match(SolidCashParser.T__69);
			this.state = 1414;
			this.match(SolidCashParser.T__11);
			this.state = 1415;
			this.match(SolidCashParser.Identifier);
			this.state = 1416;
			this.match(SolidCashParser.T__11);
			this.state = 1417;
			this.match(SolidCashParser.T__92);
			this.state = 1418;
			this.match(SolidCashParser.T__39);
			this.state = 1419;
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
			this.state = 1421;
			this.match(SolidCashParser.T__8);
			this.state = 1422;
			this.match(SolidCashParser.T__38);
			this.state = 1423;
			this.typeName();
			this.state = 1424;
			this.match(SolidCashParser.Identifier);
			this.state = 1425;
			this.match(SolidCashParser.T__93);
			this.state = 1426;
			this.match(SolidCashParser.T__69);
			this.state = 1427;
			this.match(SolidCashParser.T__11);
			this.state = 1428;
			this.match(SolidCashParser.Identifier);
			this.state = 1429;
			this.match(SolidCashParser.T__39);
			this.state = 1430;
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
			this.state = 1432;
			this.match(SolidCashParser.T__8);
			this.state = 1433;
			this.match(SolidCashParser.T__38);
			this.state = 1434;
			this.typeName();
			this.state = 1435;
			this.match(SolidCashParser.Identifier);
			this.state = 1436;
			this.match(SolidCashParser.T__91);
			this.state = 1437;
			this.match(SolidCashParser.T__69);
			this.state = 1438;
			this.match(SolidCashParser.T__11);
			this.state = 1439;
			this.match(SolidCashParser.Identifier);
			this.state = 1440;
			this.match(SolidCashParser.T__39);
			this.state = 1441;
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
			this.state = 1443;
			this.match(SolidCashParser.T__8);
			this.state = 1444;
			this.match(SolidCashParser.T__38);
			this.state = 1445;
			this.forInit();
			this.state = 1446;
			this.forCondition();
			this.state = 1447;
			this.forUpdate();
			this.state = 1448;
			this.match(SolidCashParser.T__39);
			this.state = 1449;
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
			this.state = 1451;
			this.typeName();
			this.state = 1455;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
				{
				{
				this.state = 1452;
				this.modifier();
				}
				}
				this.state = 1457;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1458;
			this.match(SolidCashParser.Identifier);
			this.state = 1459;
			this.match(SolidCashParser.T__29);
			this.state = 1460;
			this.expression(0);
			this.state = 1461;
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
			this.state = 1463;
			this.expression(0);
			this.state = 1464;
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
			this.state = 1471;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 139, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1466;
				this.match(SolidCashParser.Identifier);
				this.state = 1467;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===30 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1468;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1469;
				this.match(SolidCashParser.Identifier);
				this.state = 1470;
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
			this.state = 1473;
			this.match(SolidCashParser.T__94);
			this.state = 1474;
			this.block();
			this.state = 1475;
			this.match(SolidCashParser.T__95);
			this.state = 1476;
			this.match(SolidCashParser.T__38);
			this.state = 1477;
			this.expression(0);
			this.state = 1478;
			this.match(SolidCashParser.T__39);
			this.state = 1479;
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
			this.state = 1481;
			this.match(SolidCashParser.T__95);
			this.state = 1482;
			this.match(SolidCashParser.T__38);
			this.state = 1483;
			this.expression(0);
			this.state = 1484;
			this.match(SolidCashParser.T__39);
			this.state = 1485;
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
			this.state = 1487;
			this.match(SolidCashParser.T__96);
			this.state = 1488;
			this.consoleParameterList();
			this.state = 1489;
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
			this.state = 1491;
			this.match(SolidCashParser.T__97);
			this.state = 1492;
			this.match(SolidCashParser.T__3);
			this.state = 1496;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 154)) & ~0x1F) === 0 && ((1 << (_la - 154)) & 131201) !== 0)) {
				{
				{
				this.state = 1493;
				this.assemblyToken();
				}
				}
				this.state = 1498;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1499;
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
			this.state = 1501;
			_la = this._input.LA(1);
			if(!(((((_la - 154)) & ~0x1F) === 0 && ((1 << (_la - 154)) & 131201) !== 0))) {
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
			this.state = 1503;
			this.match(SolidCashParser.T__98);
			this.state = 1504;
			this.match(SolidCashParser.T__3);
			this.state = 1508;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 33519575) !== 0)) {
				{
				{
				this.state = 1505;
				this.statement();
				}
				}
				this.state = 1510;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1511;
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
			this.state = 1513;
			this.match(SolidCashParser.T__99);
			this.state = 1514;
			this.match(SolidCashParser.T__38);
			this.state = 1515;
			this.expression(0);
			this.state = 1516;
			this.match(SolidCashParser.T__39);
			this.state = 1517;
			this.match(SolidCashParser.T__3);
			this.state = 1521;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===101) {
				{
				{
				this.state = 1518;
				this.switchCase();
				}
				}
				this.state = 1523;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1525;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===103) {
				{
				this.state = 1524;
				this.switchDefault();
				}
			}

			this.state = 1527;
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
			this.state = 1529;
			this.match(SolidCashParser.T__100);
			this.state = 1530;
			this.expression(0);
			this.state = 1531;
			this.match(SolidCashParser.T__101);
			this.state = 1535;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 33519575) !== 0)) {
				{
				{
				this.state = 1532;
				this.statement();
				}
				}
				this.state = 1537;
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
			this.state = 1538;
			this.match(SolidCashParser.T__102);
			this.state = 1539;
			this.match(SolidCashParser.T__101);
			this.state = 1543;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 33519575) !== 0)) {
				{
				{
				this.state = 1540;
				this.statement();
				}
				}
				this.state = 1545;
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
			this.state = 1546;
			this.match(SolidCashParser.T__103);
			this.state = 1547;
			this.expression(0);
			this.state = 1549;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 1548;
				this.tryReturns();
				}
			}

			this.state = 1551;
			localctx._tryBlock = this.block();
			this.state = 1553;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1552;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1555;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 147, this._ctx);
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
			this.state = 1557;
			this.match(SolidCashParser.T__68);
			this.state = 1558;
			this.match(SolidCashParser.T__38);
			this.state = 1570;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 18745095) !== 0)) {
				{
				this.state = 1559;
				this.parameter();
				this.state = 1564;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 148, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1560;
						this.match(SolidCashParser.T__4);
						this.state = 1561;
						this.parameter();
						}
						}
					}
					this.state = 1566;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 148, this._ctx);
				}
				this.state = 1568;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1567;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1572;
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
			this.state = 1574;
			this.match(SolidCashParser.T__104);
			this.state = 1576;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 151, this._ctx) ) {
			case 1:
				{
				this.state = 1575;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 1593;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 155, this._ctx) ) {
			case 1:
				{
				this.state = 1578;
				this.match(SolidCashParser.T__38);
				this.state = 1590;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 18745095) !== 0)) {
					{
					this.state = 1579;
					this.parameter();
					this.state = 1584;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 152, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1580;
							this.match(SolidCashParser.T__4);
							this.state = 1581;
							this.parameter();
							}
							}
						}
						this.state = 1586;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 152, this._ctx);
					}
					this.state = 1588;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1587;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1592;
				this.match(SolidCashParser.T__39);
				}
				break;
			}
			this.state = 1595;
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
			this.state = 1597;
			this.match(SolidCashParser.T__105);
			this.state = 1598;
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
			this.state = 1600;
			this.match(SolidCashParser.T__106);
			this.state = 1601;
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
			this.state = 1606;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 159:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1603;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 171:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1604;
				this.match(SolidCashParser.Identifier);
				this.state = 1605;
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
			this.state = 1622;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 157, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1608;
				this.match(SolidCashParser.T__107);
				this.state = 1609;
				this.match(SolidCashParser.Identifier);
				this.state = 1610;
				this.expressionList();
				this.state = 1611;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1613;
				this.match(SolidCashParser.T__107);
				this.state = 1614;
				this.match(SolidCashParser.T__38);
				this.state = 1615;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1616;
				this.match(SolidCashParser.T__39);
				this.state = 1617;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1618;
				this.match(SolidCashParser.T__107);
				this.state = 1619;
				this.match(SolidCashParser.T__38);
				this.state = 1620;
				this.match(SolidCashParser.T__39);
				this.state = 1621;
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
			this.state = 1624;
			this.match(SolidCashParser.T__108);
			this.state = 1625;
			this.match(SolidCashParser.T__38);
			this.state = 1626;
			this.expression(0);
			this.state = 1627;
			this.match(SolidCashParser.T__39);
			this.state = 1628;
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
			this.state = 1632;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 171:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1630;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 151:
			case 153:
			case 154:
			case 159:
			case 160:
			case 161:
			case 169:
			case 170:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1631;
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
			this.state = 1634;
			this.match(SolidCashParser.T__38);
			this.state = 1646;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 1836813) !== 0)) {
				{
				this.state = 1635;
				this.consoleParameter();
				this.state = 1640;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 159, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1636;
						this.match(SolidCashParser.T__4);
						this.state = 1637;
						this.consoleParameter();
						}
						}
					}
					this.state = 1642;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 159, this._ctx);
				}
				this.state = 1644;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1643;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1648;
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
			this.state = 1674;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 165, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1650;
				this.match(SolidCashParser.Identifier);
				this.state = 1651;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1652;
				this.match(SolidCashParser.Identifier);
				this.state = 1653;
				this.match(SolidCashParser.T__11);
				this.state = 1654;
				this.match(SolidCashParser.Identifier);
				this.state = 1655;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1656;
				this.match(SolidCashParser.Identifier);
				this.state = 1657;
				this.match(SolidCashParser.T__38);
				this.state = 1658;
				this.match(SolidCashParser.T__3);
				this.state = 1670;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===171) {
					{
					this.state = 1659;
					this.namedArg();
					this.state = 1664;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 162, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1660;
							this.match(SolidCashParser.T__4);
							this.state = 1661;
							this.namedArg();
							}
							}
						}
						this.state = 1666;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 162, this._ctx);
					}
					this.state = 1668;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1667;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1672;
				this.match(SolidCashParser.T__5);
				this.state = 1673;
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
			this.state = 1676;
			this.match(SolidCashParser.Identifier);
			this.state = 1677;
			this.match(SolidCashParser.T__101);
			this.state = 1678;
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
			this.state = 1680;
			this.match(SolidCashParser.T__38);
			this.state = 1692;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===14 || _la===27 || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 110)) & ~0x1F) === 0 && ((1 << (_la - 110)) & 33622015) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 33519575) !== 0)) {
				{
				this.state = 1681;
				this.expression(0);
				this.state = 1686;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1682;
						this.match(SolidCashParser.T__4);
						this.state = 1683;
						this.expression(0);
						}
						}
					}
					this.state = 1688;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
				}
				this.state = 1690;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1689;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1694;
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
			this.state = 1696;
			this.match(SolidCashParser.T__3);
			this.state = 1697;
			this.callOption();
			this.state = 1702;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 169, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1698;
					this.match(SolidCashParser.T__4);
					this.state = 1699;
					this.callOption();
					}
					}
				}
				this.state = 1704;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 169, this._ctx);
			}
			this.state = 1706;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1705;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1708;
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
			this.state = 1710;
			this.match(SolidCashParser.Identifier);
			this.state = 1711;
			this.match(SolidCashParser.T__101);
			this.state = 1712;
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
			this.state = 1714;
			this.match(SolidCashParser.T__38);
			this.state = 1715;
			this.typeName();
			this.state = 1720;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 171, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1716;
					this.match(SolidCashParser.T__4);
					this.state = 1717;
					this.typeName();
					}
					}
				}
				this.state = 1722;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 171, this._ctx);
			}
			this.state = 1724;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1723;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1726;
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
			this.state = 1856;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 179, this._ctx) ) {
			case 1:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 1729;
				this.match(SolidCashParser.T__38);
				this.state = 1730;
				this.expression(0);
				this.state = 1731;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 2:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1733;
				this.typeCast();
				this.state = 1734;
				this.match(SolidCashParser.T__38);
				this.state = 1735;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 1737;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1736;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1739;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 3:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1741;
				this.functionCall();
				}
				break;
			case 4:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1742;
				this.match(SolidCashParser.T__109);
				this.state = 1743;
				this.match(SolidCashParser.Identifier);
				this.state = 1745;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1744;
					this.callOptions();
					}
				}

				this.state = 1747;
				this.expressionList();
				}
				break;
			case 5:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1748;
				this.match(SolidCashParser.T__109);
				this.state = 1749;
				this.typeName();
				this.state = 1750;
				this.match(SolidCashParser.T__56);
				this.state = 1751;
				this.match(SolidCashParser.T__57);
				this.state = 1752;
				this.match(SolidCashParser.T__38);
				this.state = 1753;
				this.expression(0);
				this.state = 1754;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 6:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1756;
				this.match(SolidCashParser.T__45);
				this.state = 1757;
				this.match(SolidCashParser.T__38);
				this.state = 1758;
				this.typeName();
				this.state = 1759;
				this.match(SolidCashParser.T__39);
				this.state = 1760;
				this.match(SolidCashParser.T__11);
				this.state = 1761;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 7:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1763;
				this.match(SolidCashParser.T__110);
				this.state = 1764;
				this.expressionList();
				}
				break;
			case 8:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1765;
				this.match(SolidCashParser.T__111);
				this.state = 1766;
				this.expressionList();
				}
				break;
			case 9:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1767;
				this.match(SolidCashParser.T__112);
				this.state = 1768;
				this.expressionList();
				}
				break;
			case 10:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1769;
				this.match(SolidCashParser.T__113);
				this.state = 1770;
				this.expressionList();
				}
				break;
			case 11:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1771;
				this.match(SolidCashParser.T__114);
				this.state = 1772;
				this.match(SolidCashParser.T__38);
				this.state = 1773;
				this.match(SolidCashParser.Identifier);
				this.state = 1774;
				this.match(SolidCashParser.T__11);
				this.state = 1775;
				this.match(SolidCashParser.Identifier);
				this.state = 1776;
				this.match(SolidCashParser.T__4);
				this.state = 1777;
				this.expressionList();
				this.state = 1778;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 12:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1780;
				this.match(SolidCashParser.T__115);
				this.state = 1781;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1782;
				this.match(SolidCashParser.T__116);
				this.state = 1783;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1784;
				this.match(SolidCashParser.T__117);
				this.state = 1785;
				this.match(SolidCashParser.T__38);
				this.state = 1786;
				this.expression(0);
				this.state = 1787;
				this.match(SolidCashParser.T__4);
				this.state = 1788;
				this.typeList();
				this.state = 1789;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 15:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1791;
				this.match(SolidCashParser.T__118);
				this.state = 1792;
				this.match(SolidCashParser.T__38);
				this.state = 1793;
				this.expression(0);
				this.state = 1794;
				this.match(SolidCashParser.T__4);
				this.state = 1795;
				this.typeList();
				this.state = 1796;
				this.match(SolidCashParser.T__4);
				this.state = 1797;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1798;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 16:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1800;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__119);
				this.state = 1801;
				this.match(SolidCashParser.T__56);
				this.state = 1802;
				this.expression(0);
				this.state = 1803;
				this.match(SolidCashParser.T__57);
				this.state = 1804;
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
				this.state = 1806;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__125);
				this.state = 1807;
				this.match(SolidCashParser.T__56);
				this.state = 1808;
				this.expression(0);
				this.state = 1809;
				this.match(SolidCashParser.T__57);
				this.state = 1810;
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
				this.state = 1812;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===135)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1813;
				this.expression(20);
				}
				break;
			case 19:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1814;
				this.match(SolidCashParser.T__56);
				this.state = 1826;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===14 || _la===27 || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2147747969) !== 0) || ((((_la - 110)) & ~0x1F) === 0 && ((1 << (_la - 110)) & 33622015) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 33519575) !== 0)) {
					{
					this.state = 1815;
					this.expression(0);
					this.state = 1820;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 175, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1816;
							this.match(SolidCashParser.T__4);
							this.state = 1817;
							this.expression(0);
							}
							}
						}
						this.state = 1822;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 175, this._ctx);
					}
					this.state = 1824;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1823;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1828;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 20:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1829;
				this.match(SolidCashParser.T__69);
				this.state = 1830;
				this.match(SolidCashParser.T__11);
				this.state = 1831;
				this.match(SolidCashParser.Identifier);
				this.state = 1832;
				this.match(SolidCashParser.T__11);
				this.state = 1833;
				this.match(SolidCashParser.Identifier);
				this.state = 1834;
				this.match(SolidCashParser.T__56);
				this.state = 1835;
				this.expression(0);
				this.state = 1836;
				this.match(SolidCashParser.T__57);
				this.state = 1837;
				this.memberName();
				}
				break;
			case 21:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1839;
				this.match(SolidCashParser.T__69);
				this.state = 1840;
				this.match(SolidCashParser.T__11);
				this.state = 1841;
				this.match(SolidCashParser.Identifier);
				this.state = 1846;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 1842;
						this.match(SolidCashParser.T__56);
						this.state = 1843;
						this.expression(0);
						this.state = 1844;
						this.match(SolidCashParser.T__57);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 1848;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 178, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 22:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1850;
				this.match(SolidCashParser.T__69);
				this.state = 1851;
				this.match(SolidCashParser.T__11);
				this.state = 1852;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 23:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1853;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 24:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1854;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 25:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1855;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 1940;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 182, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 1938;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 181, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1858;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 1859;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 1860;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1861;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 1862;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1863;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1864;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 1865;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1866;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1867;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 1868;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===136 || _la===137)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1869;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1870;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 1871;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1872;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1873;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 1874;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1875;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1876;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 1877;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 1878;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1879;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 1880;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 1881;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1882;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 1883;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 1884;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1885;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 1886;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__137);
						this.state = 1887;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1888;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 1889;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__138);
						this.state = 1890;
						(localctx as BinaryOpContext)._right = this.expression(10);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1891;
						if (!(this.precpred(this._ctx, 8))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 8)");
						}
						this.state = 1892;
						this.match(SolidCashParser.T__139);
						this.state = 1893;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 1894;
						this.match(SolidCashParser.T__101);
						this.state = 1895;
						(localctx as TernaryOpContext)._ifFalse = this.expression(8);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1897;
						if (!(this.precpred(this._ctx, 30))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 30)");
						}
						this.state = 1898;
						this.match(SolidCashParser.T__56);
						this.state = 1899;
						(localctx as IndexRangeSliceContext)._start = this.expression(0);
						this.state = 1900;
						this.match(SolidCashParser.T__101);
						this.state = 1901;
						(localctx as IndexRangeSliceContext)._end = this.expression(0);
						this.state = 1902;
						this.match(SolidCashParser.T__57);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1904;
						if (!(this.precpred(this._ctx, 29))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 29)");
						}
						this.state = 1905;
						this.match(SolidCashParser.T__56);
						this.state = 1906;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 1907;
						this.match(SolidCashParser.T__57);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1908;
						if (!(this.precpred(this._ctx, 28))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 28)");
						}
						this.state = 1909;
						this.match(SolidCashParser.T__56);
						this.state = 1910;
						this.expression(0);
						this.state = 1911;
						this.match(SolidCashParser.T__57);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1913;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 1914;
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
						this.state = 1915;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 1916;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__132);
						this.state = 1917;
						this.match(SolidCashParser.T__38);
						this.state = 1918;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 1919;
						this.match(SolidCashParser.T__39);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1921;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 1922;
						this.match(SolidCashParser.T__133);
						this.state = 1923;
						this.match(SolidCashParser.T__38);
						this.state = 1924;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 1925;
						this.match(SolidCashParser.T__4);
						this.state = 1926;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 1927;
						this.match(SolidCashParser.T__39);
						}
						break;
					case 19:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1929;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 1930;
						this.match(SolidCashParser.T__11);
						this.state = 1931;
						this.match(SolidCashParser.Identifier);
						this.state = 1933;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 1932;
							this.callOptions();
							}
						}

						this.state = 1935;
						this.expressionList();
						}
						break;
					case 20:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1936;
						if (!(this.precpred(this._ctx, 21))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 21)");
						}
						this.state = 1937;
						this.memberName();
						}
						break;
					}
					}
				}
				this.state = 1942;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 182, this._ctx);
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
			this.state = 1956;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1943;
				this.match(SolidCashParser.T__11);
				this.state = 1944;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 121:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1945;
				this.match(SolidCashParser.T__120);
				}
				break;
			case 122:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1946;
				this.match(SolidCashParser.T__121);
				}
				break;
			case 123:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1947;
				this.match(SolidCashParser.T__122);
				}
				break;
			case 124:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1948;
				this.match(SolidCashParser.T__123);
				}
				break;
			case 125:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1949;
				this.match(SolidCashParser.T__124);
				}
				break;
			case 127:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1950;
				this.match(SolidCashParser.T__126);
				}
				break;
			case 128:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1951;
				this.match(SolidCashParser.T__127);
				}
				break;
			case 129:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1952;
				this.match(SolidCashParser.T__128);
				}
				break;
			case 130:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1953;
				this.match(SolidCashParser.T__129);
				}
				break;
			case 141:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1954;
				this.match(SolidCashParser.T__140);
				}
				break;
			case 142:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1955;
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
			this.state = 1958;
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
			this.state = 1974;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 151:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1960;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 154:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1961;
				this.numberLiteral();
				}
				break;
			case 153:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1962;
				this.decimalLiteral();
				}
				break;
			case 159:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1963;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1967;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 184, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1964;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 1969;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 184, this._ctx);
				}
				}
				break;
			case 169:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1970;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 170:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1971;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 160:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1972;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1973;
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
			this.state = 1976;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 1978;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 186, this._ctx) ) {
			case 1:
				{
				this.state = 1977;
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
			this.state = 1980;
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
			this.state = 2022;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 191, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1982;
				this.match(SolidCashParser.T__146);
				this.state = 1983;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1984;
				this.match(SolidCashParser.T__146);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1985;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1986;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1987;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1988;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1989;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1990;
				this.match(SolidCashParser.T__147);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1991;
				this.match(SolidCashParser.T__148);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1992;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1993;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1994;
				this.match(SolidCashParser.T__6);
				this.state = 1995;
				this.match(SolidCashParser.T__38);
				this.state = 2004;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 18745095) !== 0)) {
					{
					this.state = 1996;
					this.typeName();
					this.state = 2001;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 1997;
						this.match(SolidCashParser.T__4);
						this.state = 1998;
						this.typeName();
						}
						}
						this.state = 2003;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2006;
				this.match(SolidCashParser.T__39);
				this.state = 2019;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===69) {
					{
					this.state = 2007;
					this.match(SolidCashParser.T__68);
					this.state = 2008;
					this.match(SolidCashParser.T__38);
					this.state = 2009;
					this.typeName();
					this.state = 2014;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2010;
						this.match(SolidCashParser.T__4);
						this.state = 2011;
						this.typeName();
						}
						}
						this.state = 2016;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2017;
					this.match(SolidCashParser.T__39);
					}
				}

				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2021;
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
			this.state = 2024;
			_la = this._input.LA(1);
			if(!(_la===50 || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 2033415) !== 0))) {
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

	public static readonly _serializedATN: number[] = [4,1,174,2027,2,0,7,0,
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
	0,5,0,260,8,0,10,0,12,0,263,9,0,1,0,1,0,3,0,267,8,0,1,0,1,0,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,5,1,284,8,1,10,1,12,1,287,9,1,1,
	1,3,1,290,8,1,1,1,1,1,1,1,1,1,1,1,3,1,297,8,1,1,2,1,2,1,2,3,2,302,8,2,1,
	3,1,3,1,3,1,3,3,3,308,8,3,1,3,1,3,5,3,312,8,3,10,3,12,3,315,9,3,1,3,1,3,
	1,4,1,4,1,4,1,4,1,4,3,4,324,8,4,1,4,3,4,327,8,4,1,4,1,4,1,4,1,4,1,4,1,4,
	5,4,335,8,4,10,4,12,4,338,9,4,1,4,3,4,341,8,4,1,4,1,4,1,4,1,4,3,4,347,8,
	4,1,4,3,4,350,8,4,1,4,1,4,3,4,354,8,4,1,5,1,5,1,5,3,5,359,8,5,1,5,1,5,3,
	5,363,8,5,1,6,1,6,1,7,1,7,1,7,1,7,1,7,1,8,1,8,1,9,1,9,3,9,376,8,9,1,10,
	3,10,379,8,10,1,10,1,10,1,11,1,11,1,12,1,12,1,12,1,12,1,12,1,12,5,12,391,
	8,12,10,12,12,12,394,9,12,3,12,396,8,12,1,12,1,12,5,12,400,8,12,10,12,12,
	12,403,9,12,1,12,5,12,406,8,12,10,12,12,12,409,9,12,1,12,5,12,412,8,12,
	10,12,12,12,415,9,12,1,12,5,12,418,8,12,10,12,12,12,421,9,12,1,12,5,12,
	424,8,12,10,12,12,12,427,9,12,1,12,5,12,430,8,12,10,12,12,12,433,9,12,1,
	12,5,12,436,8,12,10,12,12,12,439,9,12,1,12,1,12,1,13,1,13,1,13,1,13,1,13,
	1,13,1,13,1,13,1,13,1,13,3,13,453,8,13,1,14,1,14,1,14,1,14,1,14,1,15,1,
	15,1,16,1,16,1,16,1,16,3,16,466,8,16,1,16,1,16,1,17,1,17,1,17,1,17,5,17,
	474,8,17,10,17,12,17,477,9,17,1,17,5,17,480,8,17,10,17,12,17,483,9,17,1,
	17,5,17,486,8,17,10,17,12,17,489,9,17,1,17,5,17,492,8,17,10,17,12,17,495,
	9,17,1,17,5,17,498,8,17,10,17,12,17,501,9,17,1,17,5,17,504,8,17,10,17,12,
	17,507,9,17,1,17,1,17,1,18,3,18,512,8,18,1,18,1,18,1,18,3,18,517,8,18,1,
	18,1,18,1,18,1,18,5,18,523,8,18,10,18,12,18,526,9,18,3,18,528,8,18,1,18,
	1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,5,
	18,545,8,18,10,18,12,18,548,9,18,1,18,1,18,1,19,1,19,1,19,1,19,5,19,556,
	8,19,10,19,12,19,559,9,19,1,19,5,19,562,8,19,10,19,12,19,565,9,19,1,19,
	3,19,568,8,19,1,19,1,19,1,20,1,20,1,20,1,20,1,20,1,20,5,20,578,8,20,10,
	20,12,20,581,9,20,1,20,3,20,584,8,20,3,20,586,8,20,1,20,1,20,3,20,590,8,
	20,1,20,1,20,1,21,1,21,3,21,596,8,21,1,21,1,21,1,22,1,22,1,22,1,22,1,22,
	1,22,5,22,606,8,22,10,22,12,22,609,9,22,1,22,3,22,612,8,22,3,22,614,8,22,
	1,22,1,22,1,22,1,23,1,23,1,23,1,24,1,24,1,24,1,24,4,24,626,8,24,11,24,12,
	24,627,1,24,1,24,1,25,1,25,1,25,1,25,1,26,1,26,1,26,1,26,1,26,1,26,5,26,
	642,8,26,10,26,12,26,645,9,26,1,26,3,26,648,8,26,1,26,1,26,1,27,1,27,1,
	27,3,27,655,8,27,1,28,1,28,1,28,1,28,1,28,1,28,1,29,1,29,1,29,1,29,1,29,
	1,29,1,29,1,30,1,30,1,30,5,30,673,8,30,10,30,12,30,676,9,30,1,30,1,30,5,
	30,680,8,30,10,30,12,30,683,9,30,1,30,1,30,1,31,1,31,1,31,1,31,5,31,691,
	8,31,10,31,12,31,694,9,31,1,31,5,31,697,8,31,10,31,12,31,700,9,31,1,31,
	1,31,5,31,704,8,31,10,31,12,31,707,9,31,1,31,1,31,1,32,1,32,1,32,3,32,714,
	8,32,1,33,1,33,1,33,1,33,1,33,1,33,1,33,5,33,723,8,33,10,33,12,33,726,9,
	33,1,33,1,33,1,34,1,34,1,34,1,35,3,35,734,8,35,1,35,1,35,5,35,738,8,35,
	10,35,12,35,741,9,35,1,35,1,35,1,35,1,35,1,35,1,35,5,35,749,8,35,10,35,
	12,35,752,9,35,1,35,1,35,1,35,1,35,3,35,758,8,35,1,35,1,35,5,35,762,8,35,
	10,35,12,35,765,9,35,1,35,1,35,1,35,1,35,3,35,771,8,35,1,35,1,35,5,35,775,
	8,35,10,35,12,35,778,9,35,1,35,1,35,1,35,3,35,783,8,35,1,36,1,36,3,36,787,
	8,36,1,37,1,37,1,38,1,38,1,38,1,38,3,38,795,8,38,1,38,1,38,1,38,3,38,800,
	8,38,1,38,1,38,1,38,1,38,1,38,1,38,3,38,808,8,38,1,38,1,38,1,38,1,38,1,
	38,1,38,1,38,1,38,3,38,818,8,38,1,38,1,38,1,38,3,38,823,8,38,1,38,1,38,
	3,38,827,8,38,1,39,1,39,1,39,1,39,1,39,1,39,1,39,1,39,1,39,1,39,3,39,839,
	8,39,1,39,1,39,1,39,1,39,1,39,1,39,1,39,5,39,848,8,39,10,39,12,39,851,9,
	39,1,40,1,40,1,40,3,40,856,8,40,1,40,1,40,5,40,860,8,40,10,40,12,40,863,
	9,40,1,40,1,40,1,41,1,41,3,41,869,8,41,1,42,1,42,1,42,1,43,1,43,1,43,1,
	43,5,43,878,8,43,10,43,12,43,881,9,43,1,43,5,43,884,8,43,10,43,12,43,887,
	9,43,1,43,3,43,890,8,43,1,43,1,43,5,43,894,8,43,10,43,12,43,897,9,43,1,
	43,1,43,1,44,1,44,3,44,903,8,44,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,
	1,45,1,45,1,45,1,45,1,45,1,45,3,45,919,8,45,1,46,1,46,1,46,1,46,1,46,5,
	46,926,8,46,10,46,12,46,929,9,46,1,46,3,46,932,8,46,1,47,1,47,1,47,1,47,
	3,47,938,8,47,1,48,1,48,1,48,1,48,1,48,5,48,945,8,48,10,48,12,48,948,9,
	48,1,48,3,48,951,8,48,1,48,1,48,1,49,1,49,5,49,957,8,49,10,49,12,49,960,
	9,49,1,49,3,49,963,8,49,1,50,1,50,1,50,1,50,5,50,969,8,50,10,50,12,50,972,
	9,50,1,50,3,50,975,8,50,3,50,977,8,50,1,50,1,50,1,51,1,51,5,51,983,8,51,
	10,51,12,51,986,9,51,1,51,1,51,1,51,1,51,5,51,992,8,51,10,51,12,51,995,
	9,51,1,51,1,51,3,51,999,8,51,1,52,1,52,5,52,1003,8,52,10,52,12,52,1006,
	9,52,1,52,1,52,3,52,1010,8,52,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,
	53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,
	1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,3,53,1045,8,53,1,54,1,
	54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,55,1,55,1,55,1,55,1,55,1,55,
	1,55,1,55,1,55,1,55,1,55,1,55,5,55,1069,8,55,10,55,12,55,1072,9,55,1,55,
	1,55,1,55,1,56,1,56,1,56,1,56,1,56,1,56,5,56,1083,8,56,10,56,12,56,1086,
	9,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,5,56,1095,8,56,10,56,12,56,1098,
	9,56,1,56,3,56,1101,8,56,1,56,1,56,1,56,3,56,1106,8,56,1,57,1,57,1,57,1,
	57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,3,57,
	1125,8,57,1,57,1,57,1,57,3,57,1130,8,57,1,58,1,58,1,58,1,58,3,58,1136,8,
	58,1,58,1,58,1,58,1,59,1,59,1,59,1,59,1,59,1,60,1,60,1,60,1,60,1,60,1,60,
	1,60,4,60,1153,8,60,11,60,12,60,1154,1,60,1,60,1,60,1,60,1,61,1,61,1,61,
	1,61,1,61,1,61,1,61,4,61,1168,8,61,11,61,12,61,1169,1,61,1,61,1,61,1,61,
	1,61,1,61,1,62,1,62,1,62,1,62,1,62,1,62,1,62,5,62,1185,8,62,10,62,12,62,
	1188,9,62,1,62,1,62,1,62,1,62,1,62,1,62,1,63,1,63,1,63,1,63,1,63,1,63,1,
	63,1,64,1,64,5,64,1205,8,64,10,64,12,64,1208,9,64,1,64,1,64,1,64,3,64,1213,
	8,64,1,64,1,64,1,64,1,64,5,64,1219,8,64,10,64,12,64,1222,9,64,1,64,1,64,
	1,64,1,64,1,64,3,64,1229,8,64,1,65,1,65,1,65,1,65,1,65,1,65,4,65,1237,8,
	65,11,65,12,65,1238,1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,65,4,65,1249,8,
	65,11,65,12,65,1250,1,65,1,65,1,65,1,65,1,65,1,65,4,65,1259,8,65,11,65,
	12,65,1260,1,65,1,65,1,65,1,65,1,65,1,65,1,65,4,65,1270,8,65,11,65,12,65,
	1271,1,65,1,65,1,65,1,65,1,65,3,65,1279,8,65,1,66,1,66,1,66,1,66,1,66,3,
	66,1286,8,66,1,67,1,67,1,67,1,67,1,67,1,67,1,67,1,67,3,67,1296,8,67,1,68,
	1,68,1,68,1,68,1,68,1,68,1,68,1,69,1,69,1,69,1,69,1,69,1,69,1,70,1,70,1,
	70,1,70,1,70,1,70,1,70,1,70,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,72,1,72,
	1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,
	73,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,
	1,74,1,74,4,74,1359,8,74,11,74,12,74,1360,1,74,1,74,3,74,1365,8,74,1,75,
	1,75,1,75,1,75,1,75,1,75,1,75,3,75,1374,8,75,1,75,1,75,1,75,1,76,1,76,1,
	76,1,76,1,76,3,76,1384,8,76,1,76,1,76,1,76,1,77,1,77,1,77,1,77,1,77,1,77,
	1,77,3,77,1396,8,77,1,78,1,78,1,78,1,78,1,78,1,78,3,78,1404,8,78,1,79,1,
	79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,
	1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,81,1,81,1,81,1,
	81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,82,1,82,1,82,1,82,1,82,1,82,1,82,
	1,82,1,83,1,83,5,83,1454,8,83,10,83,12,83,1457,9,83,1,83,1,83,1,83,1,83,
	1,83,1,84,1,84,1,84,1,85,1,85,1,85,1,85,1,85,3,85,1472,8,85,1,86,1,86,1,
	86,1,86,1,86,1,86,1,86,1,86,1,87,1,87,1,87,1,87,1,87,1,87,1,88,1,88,1,88,
	1,88,1,89,1,89,1,89,5,89,1495,8,89,10,89,12,89,1498,9,89,1,89,1,89,1,90,
	1,90,1,91,1,91,1,91,5,91,1507,8,91,10,91,12,91,1510,9,91,1,91,1,91,1,92,
	1,92,1,92,1,92,1,92,1,92,5,92,1520,8,92,10,92,12,92,1523,9,92,1,92,3,92,
	1526,8,92,1,92,1,92,1,93,1,93,1,93,1,93,5,93,1534,8,93,10,93,12,93,1537,
	9,93,1,94,1,94,1,94,5,94,1542,8,94,10,94,12,94,1545,9,94,1,95,1,95,1,95,
	3,95,1550,8,95,1,95,1,95,4,95,1554,8,95,11,95,12,95,1555,1,96,1,96,1,96,
	1,96,1,96,5,96,1563,8,96,10,96,12,96,1566,9,96,1,96,3,96,1569,8,96,3,96,
	1571,8,96,1,96,1,96,1,97,1,97,3,97,1577,8,97,1,97,1,97,1,97,1,97,5,97,1583,
	8,97,10,97,12,97,1586,9,97,1,97,3,97,1589,8,97,3,97,1591,8,97,1,97,3,97,
	1594,8,97,1,97,1,97,1,98,1,98,1,98,1,99,1,99,1,99,1,100,1,100,1,100,3,100,
	1607,8,100,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,
	1,101,1,101,1,101,1,101,3,101,1623,8,101,1,102,1,102,1,102,1,102,1,102,
	1,102,1,103,1,103,3,103,1633,8,103,1,104,1,104,1,104,1,104,5,104,1639,8,
	104,10,104,12,104,1642,9,104,1,104,3,104,1645,8,104,3,104,1647,8,104,1,
	104,1,104,1,105,1,105,1,105,1,105,1,105,1,105,1,105,1,105,1,105,1,105,1,
	105,1,105,5,105,1663,8,105,10,105,12,105,1666,9,105,1,105,3,105,1669,8,
	105,3,105,1671,8,105,1,105,1,105,3,105,1675,8,105,1,106,1,106,1,106,1,106,
	1,107,1,107,1,107,1,107,5,107,1685,8,107,10,107,12,107,1688,9,107,1,107,
	3,107,1691,8,107,3,107,1693,8,107,1,107,1,107,1,108,1,108,1,108,1,108,5,
	108,1701,8,108,10,108,12,108,1704,9,108,1,108,3,108,1707,8,108,1,108,1,
	108,1,109,1,109,1,109,1,109,1,110,1,110,1,110,1,110,5,110,1719,8,110,10,
	110,12,110,1722,9,110,1,110,3,110,1725,8,110,1,110,1,110,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,3,111,1738,8,111,1,111,1,111,1,
	111,1,111,1,111,1,111,3,111,1746,8,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,5,111,1819,8,111,10,111,12,111,1822,9,
	111,1,111,3,111,1825,8,111,3,111,1827,8,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,4,111,1847,8,111,11,111,12,111,1848,1,111,1,111,1,111,1,111,1,111,
	1,111,3,111,1857,8,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,3,111,1934,8,111,1,111,1,111,
	1,111,5,111,1939,8,111,10,111,12,111,1942,9,111,1,112,1,112,1,112,1,112,
	1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,3,112,1957,8,112,
	1,113,1,113,1,114,1,114,1,114,1,114,1,114,5,114,1966,8,114,10,114,12,114,
	1969,9,114,1,114,1,114,1,114,1,114,3,114,1975,8,114,1,115,1,115,3,115,1979,
	8,115,1,116,1,116,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,
	1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,5,117,2000,8,117,10,117,
	12,117,2003,9,117,3,117,2005,8,117,1,117,1,117,1,117,1,117,1,117,1,117,
	5,117,2013,8,117,10,117,12,117,2016,9,117,1,117,1,117,3,117,2020,8,117,
	1,117,3,117,2023,8,117,1,118,1,118,1,118,0,2,78,222,119,0,2,4,6,8,10,12,
	14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,
	62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,
	108,110,112,114,116,118,120,122,124,126,128,130,132,134,136,138,140,142,
	144,146,148,150,152,154,156,158,160,162,164,166,168,170,172,174,176,178,
	180,182,184,186,188,190,192,194,196,198,200,202,204,206,208,210,212,214,
	216,218,220,222,224,226,228,230,232,234,236,0,18,2,0,10,10,13,27,3,0,20,
	23,26,27,30,30,1,0,33,34,2,0,33,34,53,54,2,0,30,30,74,83,1,0,84,85,3,0,
	154,154,161,161,171,171,1,0,121,125,2,0,121,125,127,130,3,0,14,14,27,27,
	135,135,2,0,10,10,15,16,1,0,13,14,1,0,136,137,1,0,20,23,1,0,18,19,1,0,131,
	132,2,0,47,47,143,146,4,0,50,50,147,149,155,157,163,167,2245,0,241,1,0,
	0,0,2,296,1,0,0,0,4,298,1,0,0,0,6,303,1,0,0,0,8,353,1,0,0,0,10,355,1,0,
	0,0,12,364,1,0,0,0,14,366,1,0,0,0,16,371,1,0,0,0,18,373,1,0,0,0,20,378,
	1,0,0,0,22,382,1,0,0,0,24,384,1,0,0,0,26,452,1,0,0,0,28,454,1,0,0,0,30,
	459,1,0,0,0,32,461,1,0,0,0,34,469,1,0,0,0,36,511,1,0,0,0,38,551,1,0,0,0,
	40,571,1,0,0,0,42,593,1,0,0,0,44,599,1,0,0,0,46,618,1,0,0,0,48,621,1,0,
	0,0,50,631,1,0,0,0,52,635,1,0,0,0,54,651,1,0,0,0,56,656,1,0,0,0,58,662,
	1,0,0,0,60,669,1,0,0,0,62,686,1,0,0,0,64,713,1,0,0,0,66,715,1,0,0,0,68,
	729,1,0,0,0,70,782,1,0,0,0,72,786,1,0,0,0,74,788,1,0,0,0,76,826,1,0,0,0,
	78,838,1,0,0,0,80,852,1,0,0,0,82,868,1,0,0,0,84,870,1,0,0,0,86,873,1,0,
	0,0,88,900,1,0,0,0,90,918,1,0,0,0,92,920,1,0,0,0,94,933,1,0,0,0,96,939,
	1,0,0,0,98,954,1,0,0,0,100,964,1,0,0,0,102,998,1,0,0,0,104,1009,1,0,0,0,
	106,1044,1,0,0,0,108,1046,1,0,0,0,110,1056,1,0,0,0,112,1105,1,0,0,0,114,
	1129,1,0,0,0,116,1131,1,0,0,0,118,1140,1,0,0,0,120,1145,1,0,0,0,122,1160,
	1,0,0,0,124,1177,1,0,0,0,126,1195,1,0,0,0,128,1228,1,0,0,0,130,1278,1,0,
	0,0,132,1285,1,0,0,0,134,1295,1,0,0,0,136,1297,1,0,0,0,138,1304,1,0,0,0,
	140,1310,1,0,0,0,142,1318,1,0,0,0,144,1325,1,0,0,0,146,1334,1,0,0,0,148,
	1364,1,0,0,0,150,1366,1,0,0,0,152,1378,1,0,0,0,154,1388,1,0,0,0,156,1403,
	1,0,0,0,158,1405,1,0,0,0,160,1421,1,0,0,0,162,1432,1,0,0,0,164,1443,1,0,
	0,0,166,1451,1,0,0,0,168,1463,1,0,0,0,170,1471,1,0,0,0,172,1473,1,0,0,0,
	174,1481,1,0,0,0,176,1487,1,0,0,0,178,1491,1,0,0,0,180,1501,1,0,0,0,182,
	1503,1,0,0,0,184,1513,1,0,0,0,186,1529,1,0,0,0,188,1538,1,0,0,0,190,1546,
	1,0,0,0,192,1557,1,0,0,0,194,1574,1,0,0,0,196,1597,1,0,0,0,198,1600,1,0,
	0,0,200,1606,1,0,0,0,202,1622,1,0,0,0,204,1624,1,0,0,0,206,1632,1,0,0,0,
	208,1634,1,0,0,0,210,1674,1,0,0,0,212,1676,1,0,0,0,214,1680,1,0,0,0,216,
	1696,1,0,0,0,218,1710,1,0,0,0,220,1714,1,0,0,0,222,1856,1,0,0,0,224,1956,
	1,0,0,0,226,1958,1,0,0,0,228,1974,1,0,0,0,230,1976,1,0,0,0,232,1980,1,0,
	0,0,234,2022,1,0,0,0,236,2024,1,0,0,0,238,240,3,14,7,0,239,238,1,0,0,0,
	240,243,1,0,0,0,241,239,1,0,0,0,241,242,1,0,0,0,242,247,1,0,0,0,243,241,
	1,0,0,0,244,246,3,2,1,0,245,244,1,0,0,0,246,249,1,0,0,0,247,245,1,0,0,0,
	247,248,1,0,0,0,248,261,1,0,0,0,249,247,1,0,0,0,250,260,3,58,29,0,251,260,
	3,52,26,0,252,260,3,48,24,0,253,260,3,56,28,0,254,260,3,8,4,0,255,260,3,
	44,22,0,256,260,3,24,12,0,257,260,3,6,3,0,258,260,3,34,17,0,259,250,1,0,
	0,0,259,251,1,0,0,0,259,252,1,0,0,0,259,253,1,0,0,0,259,254,1,0,0,0,259,
	255,1,0,0,0,259,256,1,0,0,0,259,257,1,0,0,0,259,258,1,0,0,0,260,263,1,0,
	0,0,261,259,1,0,0,0,261,262,1,0,0,0,262,266,1,0,0,0,263,261,1,0,0,0,264,
	267,3,36,18,0,265,267,3,34,17,0,266,264,1,0,0,0,266,265,1,0,0,0,267,268,
	1,0,0,0,268,269,5,0,0,1,269,1,1,0,0,0,270,271,5,1,0,0,271,272,5,159,0,0,
	272,297,5,2,0,0,273,274,5,1,0,0,274,275,5,159,0,0,275,276,5,3,0,0,276,277,
	5,171,0,0,277,297,5,2,0,0,278,279,5,1,0,0,279,280,5,4,0,0,280,285,3,4,2,
	0,281,282,5,5,0,0,282,284,3,4,2,0,283,281,1,0,0,0,284,287,1,0,0,0,285,283,
	1,0,0,0,285,286,1,0,0,0,286,289,1,0,0,0,287,285,1,0,0,0,288,290,5,5,0,0,
	289,288,1,0,0,0,289,290,1,0,0,0,290,291,1,0,0,0,291,292,5,6,0,0,292,293,
	5,171,0,0,293,294,5,159,0,0,294,295,5,2,0,0,295,297,1,0,0,0,296,270,1,0,
	0,0,296,273,1,0,0,0,296,278,1,0,0,0,297,3,1,0,0,0,298,301,5,171,0,0,299,
	300,5,3,0,0,300,302,5,171,0,0,301,299,1,0,0,0,301,302,1,0,0,0,302,5,1,0,
	0,0,303,304,5,7,0,0,304,305,5,171,0,0,305,307,3,100,50,0,306,308,3,96,48,
	0,307,306,1,0,0,0,307,308,1,0,0,0,308,309,1,0,0,0,309,313,5,4,0,0,310,312,
	3,106,53,0,311,310,1,0,0,0,312,315,1,0,0,0,313,311,1,0,0,0,313,314,1,0,
	0,0,314,316,1,0,0,0,315,313,1,0,0,0,316,317,5,6,0,0,317,7,1,0,0,0,318,319,
	5,8,0,0,319,320,5,171,0,0,320,323,5,9,0,0,321,324,3,234,117,0,322,324,5,
	10,0,0,323,321,1,0,0,0,323,322,1,0,0,0,324,326,1,0,0,0,325,327,5,11,0,0,
	326,325,1,0,0,0,326,327,1,0,0,0,327,328,1,0,0,0,328,354,5,2,0,0,329,330,
	5,8,0,0,330,331,5,4,0,0,331,336,3,10,5,0,332,333,5,5,0,0,333,335,3,10,5,
	0,334,332,1,0,0,0,335,338,1,0,0,0,336,334,1,0,0,0,336,337,1,0,0,0,337,340,
	1,0,0,0,338,336,1,0,0,0,339,341,5,5,0,0,340,339,1,0,0,0,340,341,1,0,0,0,
	341,342,1,0,0,0,342,343,5,6,0,0,343,346,5,9,0,0,344,347,3,234,117,0,345,
	347,5,10,0,0,346,344,1,0,0,0,346,345,1,0,0,0,347,349,1,0,0,0,348,350,5,
	11,0,0,349,348,1,0,0,0,349,350,1,0,0,0,350,351,1,0,0,0,351,352,5,2,0,0,
	352,354,1,0,0,0,353,318,1,0,0,0,353,329,1,0,0,0,354,9,1,0,0,0,355,358,5,
	171,0,0,356,357,5,12,0,0,357,359,5,171,0,0,358,356,1,0,0,0,358,359,1,0,
	0,0,359,362,1,0,0,0,360,361,5,3,0,0,361,363,3,12,6,0,362,360,1,0,0,0,362,
	363,1,0,0,0,363,11,1,0,0,0,364,365,7,0,0,0,365,13,1,0,0,0,366,367,5,28,
	0,0,367,368,3,16,8,0,368,369,3,18,9,0,369,370,5,2,0,0,370,15,1,0,0,0,371,
	372,5,29,0,0,372,17,1,0,0,0,373,375,3,20,10,0,374,376,3,20,10,0,375,374,
	1,0,0,0,375,376,1,0,0,0,376,19,1,0,0,0,377,379,3,22,11,0,378,377,1,0,0,
	0,378,379,1,0,0,0,379,380,1,0,0,0,380,381,5,150,0,0,381,21,1,0,0,0,382,
	383,7,1,0,0,383,23,1,0,0,0,384,385,5,31,0,0,385,395,5,171,0,0,386,387,5,
	32,0,0,387,392,5,171,0,0,388,389,5,5,0,0,389,391,5,171,0,0,390,388,1,0,
	0,0,391,394,1,0,0,0,392,390,1,0,0,0,392,393,1,0,0,0,393,396,1,0,0,0,394,
	392,1,0,0,0,395,386,1,0,0,0,395,396,1,0,0,0,396,397,1,0,0,0,397,401,5,4,
	0,0,398,400,3,52,26,0,399,398,1,0,0,0,400,403,1,0,0,0,401,399,1,0,0,0,401,
	402,1,0,0,0,402,407,1,0,0,0,403,401,1,0,0,0,404,406,3,48,24,0,405,404,1,
	0,0,0,406,409,1,0,0,0,407,405,1,0,0,0,407,408,1,0,0,0,408,413,1,0,0,0,409,
	407,1,0,0,0,410,412,3,56,28,0,411,410,1,0,0,0,412,415,1,0,0,0,413,411,1,
	0,0,0,413,414,1,0,0,0,414,419,1,0,0,0,415,413,1,0,0,0,416,418,3,40,20,0,
	417,416,1,0,0,0,418,421,1,0,0,0,419,417,1,0,0,0,419,420,1,0,0,0,420,425,
	1,0,0,0,421,419,1,0,0,0,422,424,3,28,14,0,423,422,1,0,0,0,424,427,1,0,0,
	0,425,423,1,0,0,0,425,426,1,0,0,0,426,431,1,0,0,0,427,425,1,0,0,0,428,430,
	3,26,13,0,429,428,1,0,0,0,430,433,1,0,0,0,431,429,1,0,0,0,431,432,1,0,0,
	0,432,437,1,0,0,0,433,431,1,0,0,0,434,436,3,32,16,0,435,434,1,0,0,0,436,
	439,1,0,0,0,437,435,1,0,0,0,437,438,1,0,0,0,438,440,1,0,0,0,439,437,1,0,
	0,0,440,441,5,6,0,0,441,25,1,0,0,0,442,443,3,30,15,0,443,444,3,76,38,0,
	444,445,5,171,0,0,445,446,5,2,0,0,446,453,1,0,0,0,447,448,3,30,15,0,448,
	449,3,78,39,0,449,450,5,171,0,0,450,451,5,2,0,0,451,453,1,0,0,0,452,442,
	1,0,0,0,452,447,1,0,0,0,453,27,1,0,0,0,454,455,3,30,15,0,455,456,3,234,
	117,0,456,457,5,171,0,0,457,458,5,2,0,0,458,29,1,0,0,0,459,460,7,2,0,0,
	460,31,1,0,0,0,461,462,5,7,0,0,462,463,5,171,0,0,463,465,3,100,50,0,464,
	466,3,96,48,0,465,464,1,0,0,0,465,466,1,0,0,0,466,467,1,0,0,0,467,468,5,
	2,0,0,468,33,1,0,0,0,469,470,5,35,0,0,470,471,5,171,0,0,471,475,5,4,0,0,
	472,474,3,52,26,0,473,472,1,0,0,0,474,477,1,0,0,0,475,473,1,0,0,0,475,476,
	1,0,0,0,476,481,1,0,0,0,477,475,1,0,0,0,478,480,3,48,24,0,479,478,1,0,0,
	0,480,483,1,0,0,0,481,479,1,0,0,0,481,482,1,0,0,0,482,487,1,0,0,0,483,481,
	1,0,0,0,484,486,3,56,28,0,485,484,1,0,0,0,486,489,1,0,0,0,487,485,1,0,0,
	0,487,488,1,0,0,0,488,493,1,0,0,0,489,487,1,0,0,0,490,492,3,40,20,0,491,
	490,1,0,0,0,492,495,1,0,0,0,493,491,1,0,0,0,493,494,1,0,0,0,494,499,1,0,
	0,0,495,493,1,0,0,0,496,498,3,58,29,0,497,496,1,0,0,0,498,501,1,0,0,0,499,
	497,1,0,0,0,499,500,1,0,0,0,500,505,1,0,0,0,501,499,1,0,0,0,502,504,3,6,
	3,0,503,502,1,0,0,0,504,507,1,0,0,0,505,503,1,0,0,0,505,506,1,0,0,0,506,
	508,1,0,0,0,507,505,1,0,0,0,508,509,5,6,0,0,509,35,1,0,0,0,510,512,5,36,
	0,0,511,510,1,0,0,0,511,512,1,0,0,0,512,513,1,0,0,0,513,514,5,37,0,0,514,
	516,5,171,0,0,515,517,3,100,50,0,516,515,1,0,0,0,516,517,1,0,0,0,517,527,
	1,0,0,0,518,519,5,32,0,0,519,524,5,171,0,0,520,521,5,5,0,0,521,523,5,171,
	0,0,522,520,1,0,0,0,523,526,1,0,0,0,524,522,1,0,0,0,524,525,1,0,0,0,525,
	528,1,0,0,0,526,524,1,0,0,0,527,518,1,0,0,0,527,528,1,0,0,0,528,529,1,0,
	0,0,529,546,5,4,0,0,530,545,3,52,26,0,531,545,3,48,24,0,532,545,3,56,28,
	0,533,545,3,40,20,0,534,545,3,44,22,0,535,545,3,58,29,0,536,545,3,8,4,0,
	537,545,3,70,35,0,538,545,3,80,40,0,539,545,3,60,30,0,540,545,3,86,43,0,
	541,545,3,38,19,0,542,545,3,62,31,0,543,545,3,66,33,0,544,530,1,0,0,0,544,
	531,1,0,0,0,544,532,1,0,0,0,544,533,1,0,0,0,544,534,1,0,0,0,544,535,1,0,
	0,0,544,536,1,0,0,0,544,537,1,0,0,0,544,538,1,0,0,0,544,539,1,0,0,0,544,
	540,1,0,0,0,544,541,1,0,0,0,544,542,1,0,0,0,544,543,1,0,0,0,545,548,1,0,
	0,0,546,544,1,0,0,0,546,547,1,0,0,0,547,549,1,0,0,0,548,546,1,0,0,0,549,
	550,5,6,0,0,550,37,1,0,0,0,551,552,5,7,0,0,552,553,5,171,0,0,553,557,3,
	100,50,0,554,556,3,90,45,0,555,554,1,0,0,0,556,559,1,0,0,0,557,555,1,0,
	0,0,557,558,1,0,0,0,558,563,1,0,0,0,559,557,1,0,0,0,560,562,3,88,44,0,561,
	560,1,0,0,0,562,565,1,0,0,0,563,561,1,0,0,0,563,564,1,0,0,0,564,567,1,0,
	0,0,565,563,1,0,0,0,566,568,3,96,48,0,567,566,1,0,0,0,567,568,1,0,0,0,568,
	569,1,0,0,0,569,570,5,2,0,0,570,39,1,0,0,0,571,572,5,38,0,0,572,573,5,171,
	0,0,573,585,5,39,0,0,574,579,3,42,21,0,575,576,5,5,0,0,576,578,3,42,21,
	0,577,575,1,0,0,0,578,581,1,0,0,0,579,577,1,0,0,0,579,580,1,0,0,0,580,583,
	1,0,0,0,581,579,1,0,0,0,582,584,5,5,0,0,583,582,1,0,0,0,583,584,1,0,0,0,
	584,586,1,0,0,0,585,574,1,0,0,0,585,586,1,0,0,0,586,587,1,0,0,0,587,589,
	5,40,0,0,588,590,5,41,0,0,589,588,1,0,0,0,589,590,1,0,0,0,590,591,1,0,0,
	0,591,592,5,2,0,0,592,41,1,0,0,0,593,595,3,234,117,0,594,596,5,42,0,0,595,
	594,1,0,0,0,595,596,1,0,0,0,596,597,1,0,0,0,597,598,5,171,0,0,598,43,1,
	0,0,0,599,600,5,43,0,0,600,601,5,171,0,0,601,613,5,39,0,0,602,607,3,46,
	23,0,603,604,5,5,0,0,604,606,3,46,23,0,605,603,1,0,0,0,606,609,1,0,0,0,
	607,605,1,0,0,0,607,608,1,0,0,0,608,611,1,0,0,0,609,607,1,0,0,0,610,612,
	5,5,0,0,611,610,1,0,0,0,611,612,1,0,0,0,612,614,1,0,0,0,613,602,1,0,0,0,
	613,614,1,0,0,0,614,615,1,0,0,0,615,616,5,40,0,0,616,617,5,2,0,0,617,45,
	1,0,0,0,618,619,3,234,117,0,619,620,5,171,0,0,620,47,1,0,0,0,621,622,5,
	44,0,0,622,623,5,171,0,0,623,625,5,4,0,0,624,626,3,50,25,0,625,624,1,0,
	0,0,626,627,1,0,0,0,627,625,1,0,0,0,627,628,1,0,0,0,628,629,1,0,0,0,629,
	630,5,6,0,0,630,49,1,0,0,0,631,632,3,234,117,0,632,633,5,171,0,0,633,634,
	5,2,0,0,634,51,1,0,0,0,635,636,5,45,0,0,636,637,5,171,0,0,637,638,5,4,0,
	0,638,643,3,54,27,0,639,640,5,5,0,0,640,642,3,54,27,0,641,639,1,0,0,0,642,
	645,1,0,0,0,643,641,1,0,0,0,643,644,1,0,0,0,644,647,1,0,0,0,645,643,1,0,
	0,0,646,648,5,5,0,0,647,646,1,0,0,0,647,648,1,0,0,0,648,649,1,0,0,0,649,
	650,5,6,0,0,650,53,1,0,0,0,651,654,5,171,0,0,652,653,5,30,0,0,653,655,5,
	154,0,0,654,652,1,0,0,0,654,655,1,0,0,0,655,55,1,0,0,0,656,657,5,46,0,0,
	657,658,5,171,0,0,658,659,5,32,0,0,659,660,3,234,117,0,660,661,5,2,0,0,
	661,57,1,0,0,0,662,663,3,234,117,0,663,664,5,47,0,0,664,665,5,171,0,0,665,
	666,5,30,0,0,666,667,3,222,111,0,667,668,5,2,0,0,668,59,1,0,0,0,669,670,
	5,48,0,0,670,674,3,100,50,0,671,673,3,68,34,0,672,671,1,0,0,0,673,676,1,
	0,0,0,674,672,1,0,0,0,674,675,1,0,0,0,675,677,1,0,0,0,676,674,1,0,0,0,677,
	681,5,4,0,0,678,680,3,106,53,0,679,678,1,0,0,0,680,683,1,0,0,0,681,679,
	1,0,0,0,681,682,1,0,0,0,682,684,1,0,0,0,683,681,1,0,0,0,684,685,5,6,0,0,
	685,61,1,0,0,0,686,687,5,49,0,0,687,688,3,100,50,0,688,692,5,34,0,0,689,
	691,3,64,32,0,690,689,1,0,0,0,691,694,1,0,0,0,692,690,1,0,0,0,692,693,1,
	0,0,0,693,698,1,0,0,0,694,692,1,0,0,0,695,697,3,88,44,0,696,695,1,0,0,0,
	697,700,1,0,0,0,698,696,1,0,0,0,698,699,1,0,0,0,699,701,1,0,0,0,700,698,
	1,0,0,0,701,705,5,4,0,0,702,704,3,106,53,0,703,702,1,0,0,0,704,707,1,0,
	0,0,705,703,1,0,0,0,705,706,1,0,0,0,706,708,1,0,0,0,707,705,1,0,0,0,708,
	709,5,6,0,0,709,63,1,0,0,0,710,714,5,50,0,0,711,714,5,51,0,0,712,714,3,
	92,46,0,713,710,1,0,0,0,713,711,1,0,0,0,713,712,1,0,0,0,714,65,1,0,0,0,
	715,716,5,52,0,0,716,717,5,39,0,0,717,718,5,40,0,0,718,719,5,34,0,0,719,
	720,5,50,0,0,720,724,5,4,0,0,721,723,3,106,53,0,722,721,1,0,0,0,723,726,
	1,0,0,0,724,722,1,0,0,0,724,725,1,0,0,0,725,727,1,0,0,0,726,724,1,0,0,0,
	727,728,5,6,0,0,728,67,1,0,0,0,729,730,5,171,0,0,730,731,3,214,107,0,731,
	69,1,0,0,0,732,734,3,74,37,0,733,732,1,0,0,0,733,734,1,0,0,0,734,735,1,
	0,0,0,735,739,3,234,117,0,736,738,3,226,113,0,737,736,1,0,0,0,738,741,1,
	0,0,0,739,737,1,0,0,0,739,740,1,0,0,0,740,742,1,0,0,0,741,739,1,0,0,0,742,
	743,5,171,0,0,743,744,5,2,0,0,744,783,1,0,0,0,745,746,3,234,117,0,746,750,
	3,74,37,0,747,749,3,226,113,0,748,747,1,0,0,0,749,752,1,0,0,0,750,748,1,
	0,0,0,750,751,1,0,0,0,751,753,1,0,0,0,752,750,1,0,0,0,753,754,5,171,0,0,
	754,755,5,2,0,0,755,783,1,0,0,0,756,758,3,74,37,0,757,756,1,0,0,0,757,758,
	1,0,0,0,758,759,1,0,0,0,759,763,3,76,38,0,760,762,3,72,36,0,761,760,1,0,
	0,0,762,765,1,0,0,0,763,761,1,0,0,0,763,764,1,0,0,0,764,766,1,0,0,0,765,
	763,1,0,0,0,766,767,5,171,0,0,767,768,5,2,0,0,768,783,1,0,0,0,769,771,3,
	74,37,0,770,769,1,0,0,0,770,771,1,0,0,0,771,772,1,0,0,0,772,776,3,78,39,
	0,773,775,3,72,36,0,774,773,1,0,0,0,775,778,1,0,0,0,776,774,1,0,0,0,776,
	777,1,0,0,0,777,779,1,0,0,0,778,776,1,0,0,0,779,780,5,171,0,0,780,781,5,
	2,0,0,781,783,1,0,0,0,782,733,1,0,0,0,782,745,1,0,0,0,782,757,1,0,0,0,782,
	770,1,0,0,0,783,71,1,0,0,0,784,787,3,226,113,0,785,787,3,74,37,0,786,784,
	1,0,0,0,786,785,1,0,0,0,787,73,1,0,0,0,788,789,7,3,0,0,789,75,1,0,0,0,790,
	791,5,55,0,0,791,792,5,39,0,0,792,794,3,234,117,0,793,795,5,171,0,0,794,
	793,1,0,0,0,794,795,1,0,0,0,795,796,1,0,0,0,796,797,5,56,0,0,797,799,3,
	234,117,0,798,800,5,171,0,0,799,798,1,0,0,0,799,800,1,0,0,0,800,801,1,0,
	0,0,801,802,5,40,0,0,802,827,1,0,0,0,803,804,5,55,0,0,804,805,5,39,0,0,
	805,807,3,234,117,0,806,808,5,171,0,0,807,806,1,0,0,0,807,808,1,0,0,0,808,
	809,1,0,0,0,809,810,5,56,0,0,810,811,3,76,38,0,811,812,5,40,0,0,812,827,
	1,0,0,0,813,814,5,55,0,0,814,815,5,39,0,0,815,817,3,234,117,0,816,818,5,
	171,0,0,817,816,1,0,0,0,817,818,1,0,0,0,818,819,1,0,0,0,819,820,5,56,0,
	0,820,822,3,78,39,0,821,823,5,171,0,0,822,821,1,0,0,0,822,823,1,0,0,0,823,
	824,1,0,0,0,824,825,5,40,0,0,825,827,1,0,0,0,826,790,1,0,0,0,826,803,1,
	0,0,0,826,813,1,0,0,0,827,77,1,0,0,0,828,829,6,39,-1,0,829,830,3,234,117,
	0,830,831,5,57,0,0,831,832,5,154,0,0,832,833,5,58,0,0,833,839,1,0,0,0,834,
	835,3,234,117,0,835,836,5,57,0,0,836,837,5,58,0,0,837,839,1,0,0,0,838,828,
	1,0,0,0,838,834,1,0,0,0,839,849,1,0,0,0,840,841,10,2,0,0,841,842,5,57,0,
	0,842,843,5,154,0,0,843,848,5,58,0,0,844,845,10,1,0,0,845,846,5,57,0,0,
	846,848,5,58,0,0,847,840,1,0,0,0,847,844,1,0,0,0,848,851,1,0,0,0,849,847,
	1,0,0,0,849,850,1,0,0,0,850,79,1,0,0,0,851,849,1,0,0,0,852,853,5,59,0,0,
	853,855,5,171,0,0,854,856,3,100,50,0,855,854,1,0,0,0,855,856,1,0,0,0,856,
	857,1,0,0,0,857,861,5,4,0,0,858,860,3,82,41,0,859,858,1,0,0,0,860,863,1,
	0,0,0,861,859,1,0,0,0,861,862,1,0,0,0,862,864,1,0,0,0,863,861,1,0,0,0,864,
	865,5,6,0,0,865,81,1,0,0,0,866,869,3,84,42,0,867,869,3,106,53,0,868,866,
	1,0,0,0,868,867,1,0,0,0,869,83,1,0,0,0,870,871,5,60,0,0,871,872,5,2,0,0,
	872,85,1,0,0,0,873,874,5,7,0,0,874,875,5,171,0,0,875,879,3,100,50,0,876,
	878,3,90,45,0,877,876,1,0,0,0,878,881,1,0,0,0,879,877,1,0,0,0,879,880,1,
	0,0,0,880,885,1,0,0,0,881,879,1,0,0,0,882,884,3,88,44,0,883,882,1,0,0,0,
	884,887,1,0,0,0,885,883,1,0,0,0,885,886,1,0,0,0,886,889,1,0,0,0,887,885,
	1,0,0,0,888,890,3,96,48,0,889,888,1,0,0,0,889,890,1,0,0,0,890,891,1,0,0,
	0,891,895,5,4,0,0,892,894,3,106,53,0,893,892,1,0,0,0,894,897,1,0,0,0,895,
	893,1,0,0,0,895,896,1,0,0,0,896,898,1,0,0,0,897,895,1,0,0,0,898,899,5,6,
	0,0,899,87,1,0,0,0,900,902,5,171,0,0,901,903,3,214,107,0,902,901,1,0,0,
	0,902,903,1,0,0,0,903,89,1,0,0,0,904,919,5,61,0,0,905,919,5,62,0,0,906,
	919,5,53,0,0,907,919,5,34,0,0,908,919,5,33,0,0,909,919,5,54,0,0,910,919,
	5,50,0,0,911,919,3,92,46,0,912,919,5,51,0,0,913,919,3,94,47,0,914,919,5,
	63,0,0,915,919,5,64,0,0,916,919,5,65,0,0,917,919,5,66,0,0,918,904,1,0,0,
	0,918,905,1,0,0,0,918,906,1,0,0,0,918,907,1,0,0,0,918,908,1,0,0,0,918,909,
	1,0,0,0,918,910,1,0,0,0,918,911,1,0,0,0,918,912,1,0,0,0,918,913,1,0,0,0,
	918,914,1,0,0,0,918,915,1,0,0,0,918,916,1,0,0,0,918,917,1,0,0,0,919,91,
	1,0,0,0,920,931,5,67,0,0,921,922,5,39,0,0,922,927,5,171,0,0,923,924,5,5,
	0,0,924,926,5,171,0,0,925,923,1,0,0,0,926,929,1,0,0,0,927,925,1,0,0,0,927,
	928,1,0,0,0,928,930,1,0,0,0,929,927,1,0,0,0,930,932,5,40,0,0,931,921,1,
	0,0,0,931,932,1,0,0,0,932,93,1,0,0,0,933,937,5,68,0,0,934,935,5,39,0,0,
	935,936,5,154,0,0,936,938,5,40,0,0,937,934,1,0,0,0,937,938,1,0,0,0,938,
	95,1,0,0,0,939,940,5,69,0,0,940,941,5,39,0,0,941,946,3,98,49,0,942,943,
	5,5,0,0,943,945,3,98,49,0,944,942,1,0,0,0,945,948,1,0,0,0,946,944,1,0,0,
	0,946,947,1,0,0,0,947,950,1,0,0,0,948,946,1,0,0,0,949,951,5,5,0,0,950,949,
	1,0,0,0,950,951,1,0,0,0,951,952,1,0,0,0,952,953,5,40,0,0,953,97,1,0,0,0,
	954,958,3,234,117,0,955,957,3,226,113,0,956,955,1,0,0,0,957,960,1,0,0,0,
	958,956,1,0,0,0,958,959,1,0,0,0,959,962,1,0,0,0,960,958,1,0,0,0,961,963,
	5,171,0,0,962,961,1,0,0,0,962,963,1,0,0,0,963,99,1,0,0,0,964,976,5,39,0,
	0,965,970,3,102,51,0,966,967,5,5,0,0,967,969,3,102,51,0,968,966,1,0,0,0,
	969,972,1,0,0,0,970,968,1,0,0,0,970,971,1,0,0,0,971,974,1,0,0,0,972,970,
	1,0,0,0,973,975,5,5,0,0,974,973,1,0,0,0,974,975,1,0,0,0,975,977,1,0,0,0,
	976,965,1,0,0,0,976,977,1,0,0,0,977,978,1,0,0,0,978,979,5,40,0,0,979,101,
	1,0,0,0,980,984,3,234,117,0,981,983,3,226,113,0,982,981,1,0,0,0,983,986,
	1,0,0,0,984,982,1,0,0,0,984,985,1,0,0,0,985,987,1,0,0,0,986,984,1,0,0,0,
	987,988,5,171,0,0,988,999,1,0,0,0,989,993,3,78,39,0,990,992,3,226,113,0,
	991,990,1,0,0,0,992,995,1,0,0,0,993,991,1,0,0,0,993,994,1,0,0,0,994,996,
	1,0,0,0,995,993,1,0,0,0,996,997,5,171,0,0,997,999,1,0,0,0,998,980,1,0,0,
	0,998,989,1,0,0,0,999,103,1,0,0,0,1000,1004,5,4,0,0,1001,1003,3,106,53,
	0,1002,1001,1,0,0,0,1003,1006,1,0,0,0,1004,1002,1,0,0,0,1004,1005,1,0,0,
	0,1005,1007,1,0,0,0,1006,1004,1,0,0,0,1007,1010,5,6,0,0,1008,1010,3,106,
	53,0,1009,1000,1,0,0,0,1009,1008,1,0,0,0,1010,105,1,0,0,0,1011,1045,3,128,
	64,0,1012,1045,3,130,65,0,1013,1045,3,140,70,0,1014,1045,3,136,68,0,1015,
	1045,3,138,69,0,1016,1045,3,142,71,0,1017,1045,3,144,72,0,1018,1045,3,146,
	73,0,1019,1045,3,134,67,0,1020,1045,3,126,63,0,1021,1045,3,122,61,0,1022,
	1045,3,120,60,0,1023,1045,3,124,62,0,1024,1045,3,150,75,0,1025,1045,3,152,
	76,0,1026,1045,3,154,77,0,1027,1045,3,156,78,0,1028,1045,3,176,88,0,1029,
	1045,3,118,59,0,1030,1045,3,108,54,0,1031,1045,3,110,55,0,1032,1045,3,112,
	56,0,1033,1045,3,114,57,0,1034,1045,3,116,58,0,1035,1045,3,178,89,0,1036,
	1045,3,190,95,0,1037,1045,3,202,101,0,1038,1045,3,204,102,0,1039,1045,3,
	148,74,0,1040,1045,3,182,91,0,1041,1045,3,184,92,0,1042,1045,3,196,98,0,
	1043,1045,3,198,99,0,1044,1011,1,0,0,0,1044,1012,1,0,0,0,1044,1013,1,0,
	0,0,1044,1014,1,0,0,0,1044,1015,1,0,0,0,1044,1016,1,0,0,0,1044,1017,1,0,
	0,0,1044,1018,1,0,0,0,1044,1019,1,0,0,0,1044,1020,1,0,0,0,1044,1021,1,0,
	0,0,1044,1022,1,0,0,0,1044,1023,1,0,0,0,1044,1024,1,0,0,0,1044,1025,1,0,
	0,0,1044,1026,1,0,0,0,1044,1027,1,0,0,0,1044,1028,1,0,0,0,1044,1029,1,0,
	0,0,1044,1030,1,0,0,0,1044,1031,1,0,0,0,1044,1032,1,0,0,0,1044,1033,1,0,
	0,0,1044,1034,1,0,0,0,1044,1035,1,0,0,0,1044,1036,1,0,0,0,1044,1037,1,0,
	0,0,1044,1038,1,0,0,0,1044,1039,1,0,0,0,1044,1040,1,0,0,0,1044,1041,1,0,
	0,0,1044,1042,1,0,0,0,1044,1043,1,0,0,0,1045,107,1,0,0,0,1046,1047,5,70,
	0,0,1047,1048,5,12,0,0,1048,1049,5,171,0,0,1049,1050,5,39,0,0,1050,1051,
	3,222,111,0,1051,1052,5,5,0,0,1052,1053,3,222,111,0,1053,1054,5,40,0,0,
	1054,1055,5,2,0,0,1055,109,1,0,0,0,1056,1057,5,70,0,0,1057,1058,5,12,0,
	0,1058,1059,5,171,0,0,1059,1060,5,57,0,0,1060,1061,3,222,111,0,1061,1062,
	5,58,0,0,1062,1063,5,12,0,0,1063,1064,5,171,0,0,1064,1065,5,39,0,0,1065,
	1070,3,222,111,0,1066,1067,5,5,0,0,1067,1069,3,222,111,0,1068,1066,1,0,
	0,0,1069,1072,1,0,0,0,1070,1068,1,0,0,0,1070,1071,1,0,0,0,1071,1073,1,0,
	0,0,1072,1070,1,0,0,0,1073,1074,5,40,0,0,1074,1075,5,2,0,0,1075,111,1,0,
	0,0,1076,1077,5,71,0,0,1077,1106,5,2,0,0,1078,1079,5,71,0,0,1079,1084,3,
	222,111,0,1080,1081,5,5,0,0,1081,1083,3,222,111,0,1082,1080,1,0,0,0,1083,
	1086,1,0,0,0,1084,1082,1,0,0,0,1084,1085,1,0,0,0,1085,1087,1,0,0,0,1086,
	1084,1,0,0,0,1087,1088,5,2,0,0,1088,1106,1,0,0,0,1089,1090,5,71,0,0,1090,
	1091,5,39,0,0,1091,1096,3,222,111,0,1092,1093,5,5,0,0,1093,1095,3,222,111,
	0,1094,1092,1,0,0,0,1095,1098,1,0,0,0,1096,1094,1,0,0,0,1096,1097,1,0,0,
	0,1097,1100,1,0,0,0,1098,1096,1,0,0,0,1099,1101,5,5,0,0,1100,1099,1,0,0,
	0,1100,1101,1,0,0,0,1101,1102,1,0,0,0,1102,1103,5,40,0,0,1103,1104,5,2,
	0,0,1104,1106,1,0,0,0,1105,1076,1,0,0,0,1105,1078,1,0,0,0,1105,1089,1,0,
	0,0,1106,113,1,0,0,0,1107,1108,5,171,0,0,1108,1109,3,214,107,0,1109,1110,
	5,2,0,0,1110,1130,1,0,0,0,1111,1112,5,171,0,0,1112,1113,5,12,0,0,1113,1114,
	5,171,0,0,1114,1115,3,214,107,0,1115,1116,5,2,0,0,1116,1130,1,0,0,0,1117,
	1118,5,171,0,0,1118,1119,3,214,107,0,1119,1120,5,12,0,0,1120,1121,5,171,
	0,0,1121,1122,5,12,0,0,1122,1124,5,171,0,0,1123,1125,3,216,108,0,1124,1123,
	1,0,0,0,1124,1125,1,0,0,0,1125,1126,1,0,0,0,1126,1127,3,214,107,0,1127,
	1128,5,2,0,0,1128,1130,1,0,0,0,1129,1107,1,0,0,0,1129,1111,1,0,0,0,1129,
	1117,1,0,0,0,1130,115,1,0,0,0,1131,1132,3,222,111,0,1132,1133,5,12,0,0,
	1133,1135,5,171,0,0,1134,1136,3,216,108,0,1135,1134,1,0,0,0,1135,1136,1,
	0,0,0,1136,1137,1,0,0,0,1137,1138,3,214,107,0,1138,1139,5,2,0,0,1139,117,
	1,0,0,0,1140,1141,5,72,0,0,1141,1142,5,171,0,0,1142,1143,3,214,107,0,1143,
	1144,5,2,0,0,1144,119,1,0,0,0,1145,1146,5,70,0,0,1146,1147,5,12,0,0,1147,
	1152,5,171,0,0,1148,1149,5,57,0,0,1149,1150,3,222,111,0,1150,1151,5,58,
	0,0,1151,1153,1,0,0,0,1152,1148,1,0,0,0,1153,1154,1,0,0,0,1154,1152,1,0,
	0,0,1154,1155,1,0,0,0,1155,1156,1,0,0,0,1156,1157,5,30,0,0,1157,1158,3,
	222,111,0,1158,1159,5,2,0,0,1159,121,1,0,0,0,1160,1161,5,70,0,0,1161,1162,
	5,12,0,0,1162,1167,5,171,0,0,1163,1164,5,57,0,0,1164,1165,3,222,111,0,1165,
	1166,5,58,0,0,1166,1168,1,0,0,0,1167,1163,1,0,0,0,1168,1169,1,0,0,0,1169,
	1167,1,0,0,0,1169,1170,1,0,0,0,1170,1171,1,0,0,0,1171,1172,5,12,0,0,1172,
	1173,5,171,0,0,1173,1174,5,30,0,0,1174,1175,3,222,111,0,1175,1176,5,2,0,
	0,1176,123,1,0,0,0,1177,1178,5,70,0,0,1178,1179,5,12,0,0,1179,1186,5,171,
	0,0,1180,1181,5,57,0,0,1181,1182,3,222,111,0,1182,1183,5,58,0,0,1183,1185,
	1,0,0,0,1184,1180,1,0,0,0,1185,1188,1,0,0,0,1186,1184,1,0,0,0,1186,1187,
	1,0,0,0,1187,1189,1,0,0,0,1188,1186,1,0,0,0,1189,1190,5,73,0,0,1190,1191,
	5,39,0,0,1191,1192,3,222,111,0,1192,1193,5,40,0,0,1193,1194,5,2,0,0,1194,
	125,1,0,0,0,1195,1196,5,70,0,0,1196,1197,5,12,0,0,1197,1198,5,171,0,0,1198,
	1199,5,30,0,0,1199,1200,3,222,111,0,1200,1201,5,2,0,0,1201,127,1,0,0,0,
	1202,1206,3,234,117,0,1203,1205,3,226,113,0,1204,1203,1,0,0,0,1205,1208,
	1,0,0,0,1206,1204,1,0,0,0,1206,1207,1,0,0,0,1207,1209,1,0,0,0,1208,1206,
	1,0,0,0,1209,1212,5,171,0,0,1210,1211,5,30,0,0,1211,1213,3,222,111,0,1212,
	1210,1,0,0,0,1212,1213,1,0,0,0,1213,1214,1,0,0,0,1214,1215,5,2,0,0,1215,
	1229,1,0,0,0,1216,1220,3,78,39,0,1217,1219,3,226,113,0,1218,1217,1,0,0,
	0,1219,1222,1,0,0,0,1220,1218,1,0,0,0,1220,1221,1,0,0,0,1221,1223,1,0,0,
	0,1222,1220,1,0,0,0,1223,1224,5,171,0,0,1224,1225,5,30,0,0,1225,1226,3,
	222,111,0,1226,1227,5,2,0,0,1227,1229,1,0,0,0,1228,1202,1,0,0,0,1228,1216,
	1,0,0,0,1229,129,1,0,0,0,1230,1231,3,234,117,0,1231,1236,5,171,0,0,1232,
	1233,5,5,0,0,1233,1234,3,234,117,0,1234,1235,5,171,0,0,1235,1237,1,0,0,
	0,1236,1232,1,0,0,0,1237,1238,1,0,0,0,1238,1236,1,0,0,0,1238,1239,1,0,0,
	0,1239,1240,1,0,0,0,1240,1241,5,30,0,0,1241,1242,3,222,111,0,1242,1243,
	5,2,0,0,1243,1279,1,0,0,0,1244,1245,5,39,0,0,1245,1248,3,132,66,0,1246,
	1247,5,5,0,0,1247,1249,3,132,66,0,1248,1246,1,0,0,0,1249,1250,1,0,0,0,1250,
	1248,1,0,0,0,1250,1251,1,0,0,0,1251,1252,1,0,0,0,1252,1253,5,40,0,0,1253,
	1254,5,30,0,0,1254,1255,5,39,0,0,1255,1258,3,222,111,0,1256,1257,5,5,0,
	0,1257,1259,3,222,111,0,1258,1256,1,0,0,0,1259,1260,1,0,0,0,1260,1258,1,
	0,0,0,1260,1261,1,0,0,0,1261,1262,1,0,0,0,1262,1263,5,40,0,0,1263,1264,
	5,2,0,0,1264,1279,1,0,0,0,1265,1266,5,39,0,0,1266,1269,3,132,66,0,1267,
	1268,5,5,0,0,1268,1270,3,132,66,0,1269,1267,1,0,0,0,1270,1271,1,0,0,0,1271,
	1269,1,0,0,0,1271,1272,1,0,0,0,1272,1273,1,0,0,0,1273,1274,5,40,0,0,1274,
	1275,5,30,0,0,1275,1276,3,222,111,0,1276,1277,5,2,0,0,1277,1279,1,0,0,0,
	1278,1230,1,0,0,0,1278,1244,1,0,0,0,1278,1265,1,0,0,0,1279,131,1,0,0,0,
	1280,1281,3,234,117,0,1281,1282,5,171,0,0,1282,1286,1,0,0,0,1283,1286,5,
	171,0,0,1284,1286,1,0,0,0,1285,1280,1,0,0,0,1285,1283,1,0,0,0,1285,1284,
	1,0,0,0,1286,133,1,0,0,0,1287,1288,5,171,0,0,1288,1289,7,4,0,0,1289,1290,
	3,222,111,0,1290,1291,5,2,0,0,1291,1296,1,0,0,0,1292,1293,5,171,0,0,1293,
	1294,7,5,0,0,1294,1296,5,2,0,0,1295,1287,1,0,0,0,1295,1292,1,0,0,0,1296,
	135,1,0,0,0,1297,1298,5,171,0,0,1298,1299,5,86,0,0,1299,1300,5,39,0,0,1300,
	1301,3,222,111,0,1301,1302,5,40,0,0,1302,1303,5,2,0,0,1303,137,1,0,0,0,
	1304,1305,5,171,0,0,1305,1306,5,87,0,0,1306,1307,5,39,0,0,1307,1308,5,40,
	0,0,1308,1309,5,2,0,0,1309,139,1,0,0,0,1310,1311,5,171,0,0,1311,1312,5,
	57,0,0,1312,1313,3,222,111,0,1313,1314,5,58,0,0,1314,1315,5,30,0,0,1315,
	1316,3,222,111,0,1316,1317,5,2,0,0,1317,141,1,0,0,0,1318,1319,5,171,0,0,
	1319,1320,5,73,0,0,1320,1321,5,39,0,0,1321,1322,3,222,111,0,1322,1323,5,
	40,0,0,1323,1324,5,2,0,0,1324,143,1,0,0,0,1325,1326,5,70,0,0,1326,1327,
	5,12,0,0,1327,1328,5,171,0,0,1328,1329,5,86,0,0,1329,1330,5,39,0,0,1330,
	1331,3,222,111,0,1331,1332,5,40,0,0,1332,1333,5,2,0,0,1333,145,1,0,0,0,
	1334,1335,5,70,0,0,1335,1336,5,12,0,0,1336,1337,5,171,0,0,1337,1338,5,87,
	0,0,1338,1339,5,39,0,0,1339,1340,5,40,0,0,1340,1341,5,2,0,0,1341,147,1,
	0,0,0,1342,1343,5,88,0,0,1343,1344,5,171,0,0,1344,1365,5,2,0,0,1345,1346,
	5,88,0,0,1346,1347,5,70,0,0,1347,1348,5,12,0,0,1348,1349,5,171,0,0,1349,
	1365,5,2,0,0,1350,1351,5,88,0,0,1351,1352,5,70,0,0,1352,1353,5,12,0,0,1353,
	1358,5,171,0,0,1354,1355,5,57,0,0,1355,1356,3,222,111,0,1356,1357,5,58,
	0,0,1357,1359,1,0,0,0,1358,1354,1,0,0,0,1359,1360,1,0,0,0,1360,1358,1,0,
	0,0,1360,1361,1,0,0,0,1361,1362,1,0,0,0,1362,1363,5,2,0,0,1363,1365,1,0,
	0,0,1364,1342,1,0,0,0,1364,1345,1,0,0,0,1364,1350,1,0,0,0,1365,149,1,0,
	0,0,1366,1367,5,89,0,0,1367,1368,5,39,0,0,1368,1369,5,162,0,0,1369,1370,
	5,23,0,0,1370,1373,3,222,111,0,1371,1372,5,5,0,0,1372,1374,3,200,100,0,
	1373,1371,1,0,0,0,1373,1374,1,0,0,0,1374,1375,1,0,0,0,1375,1376,5,40,0,
	0,1376,1377,5,2,0,0,1377,151,1,0,0,0,1378,1379,5,89,0,0,1379,1380,5,39,
	0,0,1380,1383,3,222,111,0,1381,1382,5,5,0,0,1382,1384,3,200,100,0,1383,
	1381,1,0,0,0,1383,1384,1,0,0,0,1384,1385,1,0,0,0,1385,1386,5,40,0,0,1386,
	1387,5,2,0,0,1387,153,1,0,0,0,1388,1389,5,90,0,0,1389,1390,5,39,0,0,1390,
	1391,3,222,111,0,1391,1392,5,40,0,0,1392,1395,3,104,52,0,1393,1394,5,91,
	0,0,1394,1396,3,104,52,0,1395,1393,1,0,0,0,1395,1396,1,0,0,0,1396,155,1,
	0,0,0,1397,1404,3,172,86,0,1398,1404,3,174,87,0,1399,1404,3,164,82,0,1400,
	1404,3,158,79,0,1401,1404,3,160,80,0,1402,1404,3,162,81,0,1403,1397,1,0,
	0,0,1403,1398,1,0,0,0,1403,1399,1,0,0,0,1403,1400,1,0,0,0,1403,1401,1,0,
	0,0,1403,1402,1,0,0,0,1404,157,1,0,0,0,1405,1406,5,9,0,0,1406,1407,5,39,
	0,0,1407,1408,3,234,117,0,1408,1409,5,171,0,0,1409,1410,5,5,0,0,1410,1411,
	3,234,117,0,1411,1412,5,171,0,0,1412,1413,5,92,0,0,1413,1414,5,70,0,0,1414,
	1415,5,12,0,0,1415,1416,5,171,0,0,1416,1417,5,12,0,0,1417,1418,5,93,0,0,
	1418,1419,5,40,0,0,1419,1420,3,104,52,0,1420,159,1,0,0,0,1421,1422,5,9,
	0,0,1422,1423,5,39,0,0,1423,1424,3,234,117,0,1424,1425,5,171,0,0,1425,1426,
	5,94,0,0,1426,1427,5,70,0,0,1427,1428,5,12,0,0,1428,1429,5,171,0,0,1429,
	1430,5,40,0,0,1430,1431,3,104,52,0,1431,161,1,0,0,0,1432,1433,5,9,0,0,1433,
	1434,5,39,0,0,1434,1435,3,234,117,0,1435,1436,5,171,0,0,1436,1437,5,92,
	0,0,1437,1438,5,70,0,0,1438,1439,5,12,0,0,1439,1440,5,171,0,0,1440,1441,
	5,40,0,0,1441,1442,3,104,52,0,1442,163,1,0,0,0,1443,1444,5,9,0,0,1444,1445,
	5,39,0,0,1445,1446,3,166,83,0,1446,1447,3,168,84,0,1447,1448,3,170,85,0,
	1448,1449,5,40,0,0,1449,1450,3,104,52,0,1450,165,1,0,0,0,1451,1455,3,234,
	117,0,1452,1454,3,226,113,0,1453,1452,1,0,0,0,1454,1457,1,0,0,0,1455,1453,
	1,0,0,0,1455,1456,1,0,0,0,1456,1458,1,0,0,0,1457,1455,1,0,0,0,1458,1459,
	5,171,0,0,1459,1460,5,30,0,0,1460,1461,3,222,111,0,1461,1462,5,2,0,0,1462,
	167,1,0,0,0,1463,1464,3,222,111,0,1464,1465,5,2,0,0,1465,169,1,0,0,0,1466,
	1467,5,171,0,0,1467,1468,7,4,0,0,1468,1472,3,222,111,0,1469,1470,5,171,
	0,0,1470,1472,7,5,0,0,1471,1466,1,0,0,0,1471,1469,1,0,0,0,1472,171,1,0,
	0,0,1473,1474,5,95,0,0,1474,1475,3,104,52,0,1475,1476,5,96,0,0,1476,1477,
	5,39,0,0,1477,1478,3,222,111,0,1478,1479,5,40,0,0,1479,1480,5,2,0,0,1480,
	173,1,0,0,0,1481,1482,5,96,0,0,1482,1483,5,39,0,0,1483,1484,3,222,111,0,
	1484,1485,5,40,0,0,1485,1486,3,104,52,0,1486,175,1,0,0,0,1487,1488,5,97,
	0,0,1488,1489,3,208,104,0,1489,1490,5,2,0,0,1490,177,1,0,0,0,1491,1492,
	5,98,0,0,1492,1496,5,4,0,0,1493,1495,3,180,90,0,1494,1493,1,0,0,0,1495,
	1498,1,0,0,0,1496,1494,1,0,0,0,1496,1497,1,0,0,0,1497,1499,1,0,0,0,1498,
	1496,1,0,0,0,1499,1500,5,6,0,0,1500,179,1,0,0,0,1501,1502,7,6,0,0,1502,
	181,1,0,0,0,1503,1504,5,99,0,0,1504,1508,5,4,0,0,1505,1507,3,106,53,0,1506,
	1505,1,0,0,0,1507,1510,1,0,0,0,1508,1506,1,0,0,0,1508,1509,1,0,0,0,1509,
	1511,1,0,0,0,1510,1508,1,0,0,0,1511,1512,5,6,0,0,1512,183,1,0,0,0,1513,
	1514,5,100,0,0,1514,1515,5,39,0,0,1515,1516,3,222,111,0,1516,1517,5,40,
	0,0,1517,1521,5,4,0,0,1518,1520,3,186,93,0,1519,1518,1,0,0,0,1520,1523,
	1,0,0,0,1521,1519,1,0,0,0,1521,1522,1,0,0,0,1522,1525,1,0,0,0,1523,1521,
	1,0,0,0,1524,1526,3,188,94,0,1525,1524,1,0,0,0,1525,1526,1,0,0,0,1526,1527,
	1,0,0,0,1527,1528,5,6,0,0,1528,185,1,0,0,0,1529,1530,5,101,0,0,1530,1531,
	3,222,111,0,1531,1535,5,102,0,0,1532,1534,3,106,53,0,1533,1532,1,0,0,0,
	1534,1537,1,0,0,0,1535,1533,1,0,0,0,1535,1536,1,0,0,0,1536,187,1,0,0,0,
	1537,1535,1,0,0,0,1538,1539,5,103,0,0,1539,1543,5,102,0,0,1540,1542,3,106,
	53,0,1541,1540,1,0,0,0,1542,1545,1,0,0,0,1543,1541,1,0,0,0,1543,1544,1,
	0,0,0,1544,189,1,0,0,0,1545,1543,1,0,0,0,1546,1547,5,104,0,0,1547,1549,
	3,222,111,0,1548,1550,3,192,96,0,1549,1548,1,0,0,0,1549,1550,1,0,0,0,1550,
	1551,1,0,0,0,1551,1553,3,104,52,0,1552,1554,3,194,97,0,1553,1552,1,0,0,
	0,1554,1555,1,0,0,0,1555,1553,1,0,0,0,1555,1556,1,0,0,0,1556,191,1,0,0,
	0,1557,1558,5,69,0,0,1558,1570,5,39,0,0,1559,1564,3,102,51,0,1560,1561,
	5,5,0,0,1561,1563,3,102,51,0,1562,1560,1,0,0,0,1563,1566,1,0,0,0,1564,1562,
	1,0,0,0,1564,1565,1,0,0,0,1565,1568,1,0,0,0,1566,1564,1,0,0,0,1567,1569,
	5,5,0,0,1568,1567,1,0,0,0,1568,1569,1,0,0,0,1569,1571,1,0,0,0,1570,1559,
	1,0,0,0,1570,1571,1,0,0,0,1571,1572,1,0,0,0,1572,1573,5,40,0,0,1573,193,
	1,0,0,0,1574,1576,5,105,0,0,1575,1577,5,171,0,0,1576,1575,1,0,0,0,1576,
	1577,1,0,0,0,1577,1593,1,0,0,0,1578,1590,5,39,0,0,1579,1584,3,102,51,0,
	1580,1581,5,5,0,0,1581,1583,3,102,51,0,1582,1580,1,0,0,0,1583,1586,1,0,
	0,0,1584,1582,1,0,0,0,1584,1585,1,0,0,0,1585,1588,1,0,0,0,1586,1584,1,0,
	0,0,1587,1589,5,5,0,0,1588,1587,1,0,0,0,1588,1589,1,0,0,0,1589,1591,1,0,
	0,0,1590,1579,1,0,0,0,1590,1591,1,0,0,0,1591,1592,1,0,0,0,1592,1594,5,40,
	0,0,1593,1578,1,0,0,0,1593,1594,1,0,0,0,1594,1595,1,0,0,0,1595,1596,3,104,
	52,0,1596,195,1,0,0,0,1597,1598,5,106,0,0,1598,1599,5,2,0,0,1599,197,1,
	0,0,0,1600,1601,5,107,0,0,1601,1602,5,2,0,0,1602,199,1,0,0,0,1603,1607,
	5,159,0,0,1604,1605,5,171,0,0,1605,1607,3,214,107,0,1606,1603,1,0,0,0,1606,
	1604,1,0,0,0,1607,201,1,0,0,0,1608,1609,5,108,0,0,1609,1610,5,171,0,0,1610,
	1611,3,214,107,0,1611,1612,5,2,0,0,1612,1623,1,0,0,0,1613,1614,5,108,0,
	0,1614,1615,5,39,0,0,1615,1616,5,159,0,0,1616,1617,5,40,0,0,1617,1623,5,
	2,0,0,1618,1619,5,108,0,0,1619,1620,5,39,0,0,1620,1621,5,40,0,0,1621,1623,
	5,2,0,0,1622,1608,1,0,0,0,1622,1613,1,0,0,0,1622,1618,1,0,0,0,1623,203,
	1,0,0,0,1624,1625,5,109,0,0,1625,1626,5,39,0,0,1626,1627,3,222,111,0,1627,
	1628,5,40,0,0,1628,1629,5,2,0,0,1629,205,1,0,0,0,1630,1633,5,171,0,0,1631,
	1633,3,228,114,0,1632,1630,1,0,0,0,1632,1631,1,0,0,0,1633,207,1,0,0,0,1634,
	1646,5,39,0,0,1635,1640,3,206,103,0,1636,1637,5,5,0,0,1637,1639,3,206,103,
	0,1638,1636,1,0,0,0,1639,1642,1,0,0,0,1640,1638,1,0,0,0,1640,1641,1,0,0,
	0,1641,1644,1,0,0,0,1642,1640,1,0,0,0,1643,1645,5,5,0,0,1644,1643,1,0,0,
	0,1644,1645,1,0,0,0,1645,1647,1,0,0,0,1646,1635,1,0,0,0,1646,1647,1,0,0,
	0,1647,1648,1,0,0,0,1648,1649,5,40,0,0,1649,209,1,0,0,0,1650,1651,5,171,
	0,0,1651,1675,3,214,107,0,1652,1653,5,171,0,0,1653,1654,5,12,0,0,1654,1655,
	5,171,0,0,1655,1675,3,214,107,0,1656,1657,5,171,0,0,1657,1658,5,39,0,0,
	1658,1670,5,4,0,0,1659,1664,3,212,106,0,1660,1661,5,5,0,0,1661,1663,3,212,
	106,0,1662,1660,1,0,0,0,1663,1666,1,0,0,0,1664,1662,1,0,0,0,1664,1665,1,
	0,0,0,1665,1668,1,0,0,0,1666,1664,1,0,0,0,1667,1669,5,5,0,0,1668,1667,1,
	0,0,0,1668,1669,1,0,0,0,1669,1671,1,0,0,0,1670,1659,1,0,0,0,1670,1671,1,
	0,0,0,1671,1672,1,0,0,0,1672,1673,5,6,0,0,1673,1675,5,40,0,0,1674,1650,
	1,0,0,0,1674,1652,1,0,0,0,1674,1656,1,0,0,0,1675,211,1,0,0,0,1676,1677,
	5,171,0,0,1677,1678,5,102,0,0,1678,1679,3,222,111,0,1679,213,1,0,0,0,1680,
	1692,5,39,0,0,1681,1686,3,222,111,0,1682,1683,5,5,0,0,1683,1685,3,222,111,
	0,1684,1682,1,0,0,0,1685,1688,1,0,0,0,1686,1684,1,0,0,0,1686,1687,1,0,0,
	0,1687,1690,1,0,0,0,1688,1686,1,0,0,0,1689,1691,5,5,0,0,1690,1689,1,0,0,
	0,1690,1691,1,0,0,0,1691,1693,1,0,0,0,1692,1681,1,0,0,0,1692,1693,1,0,0,
	0,1693,1694,1,0,0,0,1694,1695,5,40,0,0,1695,215,1,0,0,0,1696,1697,5,4,0,
	0,1697,1702,3,218,109,0,1698,1699,5,5,0,0,1699,1701,3,218,109,0,1700,1698,
	1,0,0,0,1701,1704,1,0,0,0,1702,1700,1,0,0,0,1702,1703,1,0,0,0,1703,1706,
	1,0,0,0,1704,1702,1,0,0,0,1705,1707,5,5,0,0,1706,1705,1,0,0,0,1706,1707,
	1,0,0,0,1707,1708,1,0,0,0,1708,1709,5,6,0,0,1709,217,1,0,0,0,1710,1711,
	5,171,0,0,1711,1712,5,102,0,0,1712,1713,3,222,111,0,1713,219,1,0,0,0,1714,
	1715,5,39,0,0,1715,1720,3,234,117,0,1716,1717,5,5,0,0,1717,1719,3,234,117,
	0,1718,1716,1,0,0,0,1719,1722,1,0,0,0,1720,1718,1,0,0,0,1720,1721,1,0,0,
	0,1721,1724,1,0,0,0,1722,1720,1,0,0,0,1723,1725,5,5,0,0,1724,1723,1,0,0,
	0,1724,1725,1,0,0,0,1725,1726,1,0,0,0,1726,1727,5,40,0,0,1727,221,1,0,0,
	0,1728,1729,6,111,-1,0,1729,1730,5,39,0,0,1730,1731,3,222,111,0,1731,1732,
	5,40,0,0,1732,1857,1,0,0,0,1733,1734,3,236,118,0,1734,1735,5,39,0,0,1735,
	1737,3,222,111,0,1736,1738,5,5,0,0,1737,1736,1,0,0,0,1737,1738,1,0,0,0,
	1738,1739,1,0,0,0,1739,1740,5,40,0,0,1740,1857,1,0,0,0,1741,1857,3,210,
	105,0,1742,1743,5,110,0,0,1743,1745,5,171,0,0,1744,1746,3,216,108,0,1745,
	1744,1,0,0,0,1745,1746,1,0,0,0,1746,1747,1,0,0,0,1747,1857,3,214,107,0,
	1748,1749,5,110,0,0,1749,1750,3,234,117,0,1750,1751,5,57,0,0,1751,1752,
	5,58,0,0,1752,1753,5,39,0,0,1753,1754,3,222,111,0,1754,1755,5,40,0,0,1755,
	1857,1,0,0,0,1756,1757,5,46,0,0,1757,1758,5,39,0,0,1758,1759,3,234,117,
	0,1759,1760,5,40,0,0,1760,1761,5,12,0,0,1761,1762,5,171,0,0,1762,1857,1,
	0,0,0,1763,1764,5,111,0,0,1764,1857,3,214,107,0,1765,1766,5,112,0,0,1766,
	1857,3,214,107,0,1767,1768,5,113,0,0,1768,1857,3,214,107,0,1769,1770,5,
	114,0,0,1770,1857,3,214,107,0,1771,1772,5,115,0,0,1772,1773,5,39,0,0,1773,
	1774,5,171,0,0,1774,1775,5,12,0,0,1775,1776,5,171,0,0,1776,1777,5,5,0,0,
	1777,1778,3,214,107,0,1778,1779,5,40,0,0,1779,1857,1,0,0,0,1780,1781,5,
	116,0,0,1781,1857,3,214,107,0,1782,1783,5,117,0,0,1783,1857,3,214,107,0,
	1784,1785,5,118,0,0,1785,1786,5,39,0,0,1786,1787,3,222,111,0,1787,1788,
	5,5,0,0,1788,1789,3,220,110,0,1789,1790,5,40,0,0,1790,1857,1,0,0,0,1791,
	1792,5,119,0,0,1792,1793,5,39,0,0,1793,1794,3,222,111,0,1794,1795,5,5,0,
	0,1795,1796,3,220,110,0,1796,1797,5,5,0,0,1797,1798,5,154,0,0,1798,1799,
	5,40,0,0,1799,1857,1,0,0,0,1800,1801,5,120,0,0,1801,1802,5,57,0,0,1802,
	1803,3,222,111,0,1803,1804,5,58,0,0,1804,1805,7,7,0,0,1805,1857,1,0,0,0,
	1806,1807,5,126,0,0,1807,1808,5,57,0,0,1808,1809,3,222,111,0,1809,1810,
	5,58,0,0,1810,1811,7,8,0,0,1811,1857,1,0,0,0,1812,1813,7,9,0,0,1813,1857,
	3,222,111,20,1814,1826,5,57,0,0,1815,1820,3,222,111,0,1816,1817,5,5,0,0,
	1817,1819,3,222,111,0,1818,1816,1,0,0,0,1819,1822,1,0,0,0,1820,1818,1,0,
	0,0,1820,1821,1,0,0,0,1821,1824,1,0,0,0,1822,1820,1,0,0,0,1823,1825,5,5,
	0,0,1824,1823,1,0,0,0,1824,1825,1,0,0,0,1825,1827,1,0,0,0,1826,1815,1,0,
	0,0,1826,1827,1,0,0,0,1827,1828,1,0,0,0,1828,1857,5,58,0,0,1829,1830,5,
	70,0,0,1830,1831,5,12,0,0,1831,1832,5,171,0,0,1832,1833,5,12,0,0,1833,1834,
	5,171,0,0,1834,1835,5,57,0,0,1835,1836,3,222,111,0,1836,1837,5,58,0,0,1837,
	1838,3,224,112,0,1838,1857,1,0,0,0,1839,1840,5,70,0,0,1840,1841,5,12,0,
	0,1841,1846,5,171,0,0,1842,1843,5,57,0,0,1843,1844,3,222,111,0,1844,1845,
	5,58,0,0,1845,1847,1,0,0,0,1846,1842,1,0,0,0,1847,1848,1,0,0,0,1848,1846,
	1,0,0,0,1848,1849,1,0,0,0,1849,1857,1,0,0,0,1850,1851,5,70,0,0,1851,1852,
	5,12,0,0,1852,1857,5,171,0,0,1853,1857,5,168,0,0,1854,1857,5,171,0,0,1855,
	1857,3,228,114,0,1856,1728,1,0,0,0,1856,1733,1,0,0,0,1856,1741,1,0,0,0,
	1856,1742,1,0,0,0,1856,1748,1,0,0,0,1856,1756,1,0,0,0,1856,1763,1,0,0,0,
	1856,1765,1,0,0,0,1856,1767,1,0,0,0,1856,1769,1,0,0,0,1856,1771,1,0,0,0,
	1856,1780,1,0,0,0,1856,1782,1,0,0,0,1856,1784,1,0,0,0,1856,1791,1,0,0,0,
	1856,1800,1,0,0,0,1856,1806,1,0,0,0,1856,1812,1,0,0,0,1856,1814,1,0,0,0,
	1856,1829,1,0,0,0,1856,1839,1,0,0,0,1856,1850,1,0,0,0,1856,1853,1,0,0,0,
	1856,1854,1,0,0,0,1856,1855,1,0,0,0,1857,1940,1,0,0,0,1858,1859,10,19,0,
	0,1859,1860,5,17,0,0,1860,1939,3,222,111,19,1861,1862,10,18,0,0,1862,1863,
	7,10,0,0,1863,1939,3,222,111,19,1864,1865,10,17,0,0,1865,1866,7,11,0,0,
	1866,1939,3,222,111,18,1867,1868,10,16,0,0,1868,1869,7,12,0,0,1869,1939,
	3,222,111,17,1870,1871,10,15,0,0,1871,1872,7,13,0,0,1872,1939,3,222,111,
	16,1873,1874,10,14,0,0,1874,1875,7,14,0,0,1875,1939,3,222,111,15,1876,1877,
	10,13,0,0,1877,1878,5,24,0,0,1878,1939,3,222,111,14,1879,1880,10,12,0,0,
	1880,1881,5,26,0,0,1881,1939,3,222,111,13,1882,1883,10,11,0,0,1883,1884,
	5,25,0,0,1884,1939,3,222,111,12,1885,1886,10,10,0,0,1886,1887,5,138,0,0,
	1887,1939,3,222,111,11,1888,1889,10,9,0,0,1889,1890,5,139,0,0,1890,1939,
	3,222,111,10,1891,1892,10,8,0,0,1892,1893,5,140,0,0,1893,1894,3,222,111,
	0,1894,1895,5,102,0,0,1895,1896,3,222,111,8,1896,1939,1,0,0,0,1897,1898,
	10,30,0,0,1898,1899,5,57,0,0,1899,1900,3,222,111,0,1900,1901,5,102,0,0,
	1901,1902,3,222,111,0,1902,1903,5,58,0,0,1903,1939,1,0,0,0,1904,1905,10,
	29,0,0,1905,1906,5,57,0,0,1906,1907,5,154,0,0,1907,1939,5,58,0,0,1908,1909,
	10,28,0,0,1909,1910,5,57,0,0,1910,1911,3,222,111,0,1911,1912,5,58,0,0,1912,
	1939,1,0,0,0,1913,1914,10,25,0,0,1914,1939,7,15,0,0,1915,1916,10,24,0,0,
	1916,1917,5,133,0,0,1917,1918,5,39,0,0,1918,1919,3,222,111,0,1919,1920,
	5,40,0,0,1920,1939,1,0,0,0,1921,1922,10,23,0,0,1922,1923,5,134,0,0,1923,
	1924,5,39,0,0,1924,1925,3,222,111,0,1925,1926,5,5,0,0,1926,1927,3,222,111,
	0,1927,1928,5,40,0,0,1928,1939,1,0,0,0,1929,1930,10,22,0,0,1930,1931,5,
	12,0,0,1931,1933,5,171,0,0,1932,1934,3,216,108,0,1933,1932,1,0,0,0,1933,
	1934,1,0,0,0,1934,1935,1,0,0,0,1935,1939,3,214,107,0,1936,1937,10,21,0,
	0,1937,1939,3,224,112,0,1938,1858,1,0,0,0,1938,1861,1,0,0,0,1938,1864,1,
	0,0,0,1938,1867,1,0,0,0,1938,1870,1,0,0,0,1938,1873,1,0,0,0,1938,1876,1,
	0,0,0,1938,1879,1,0,0,0,1938,1882,1,0,0,0,1938,1885,1,0,0,0,1938,1888,1,
	0,0,0,1938,1891,1,0,0,0,1938,1897,1,0,0,0,1938,1904,1,0,0,0,1938,1908,1,
	0,0,0,1938,1913,1,0,0,0,1938,1915,1,0,0,0,1938,1921,1,0,0,0,1938,1929,1,
	0,0,0,1938,1936,1,0,0,0,1939,1942,1,0,0,0,1940,1938,1,0,0,0,1940,1941,1,
	0,0,0,1941,223,1,0,0,0,1942,1940,1,0,0,0,1943,1944,5,12,0,0,1944,1957,5,
	171,0,0,1945,1957,5,121,0,0,1946,1957,5,122,0,0,1947,1957,5,123,0,0,1948,
	1957,5,124,0,0,1949,1957,5,125,0,0,1950,1957,5,127,0,0,1951,1957,5,128,
	0,0,1952,1957,5,129,0,0,1953,1957,5,130,0,0,1954,1957,5,141,0,0,1955,1957,
	5,142,0,0,1956,1943,1,0,0,0,1956,1945,1,0,0,0,1956,1946,1,0,0,0,1956,1947,
	1,0,0,0,1956,1948,1,0,0,0,1956,1949,1,0,0,0,1956,1950,1,0,0,0,1956,1951,
	1,0,0,0,1956,1952,1,0,0,0,1956,1953,1,0,0,0,1956,1954,1,0,0,0,1956,1955,
	1,0,0,0,1957,225,1,0,0,0,1958,1959,7,16,0,0,1959,227,1,0,0,0,1960,1975,
	5,151,0,0,1961,1975,3,230,115,0,1962,1975,3,232,116,0,1963,1967,5,159,0,
	0,1964,1966,5,159,0,0,1965,1964,1,0,0,0,1966,1969,1,0,0,0,1967,1965,1,0,
	0,0,1967,1968,1,0,0,0,1968,1975,1,0,0,0,1969,1967,1,0,0,0,1970,1975,5,169,
	0,0,1971,1975,5,170,0,0,1972,1975,5,160,0,0,1973,1975,5,161,0,0,1974,1960,
	1,0,0,0,1974,1961,1,0,0,0,1974,1962,1,0,0,0,1974,1963,1,0,0,0,1974,1970,
	1,0,0,0,1974,1971,1,0,0,0,1974,1972,1,0,0,0,1974,1973,1,0,0,0,1975,229,
	1,0,0,0,1976,1978,5,154,0,0,1977,1979,5,152,0,0,1978,1977,1,0,0,0,1978,
	1979,1,0,0,0,1979,231,1,0,0,0,1980,1981,5,153,0,0,1981,233,1,0,0,0,1982,
	1983,5,147,0,0,1983,2023,5,50,0,0,1984,2023,5,147,0,0,1985,2023,5,155,0,
	0,1986,2023,5,157,0,0,1987,2023,5,156,0,0,1988,2023,5,164,0,0,1989,2023,
	5,165,0,0,1990,2023,5,148,0,0,1991,2023,5,149,0,0,1992,2023,5,166,0,0,1993,
	2023,5,167,0,0,1994,1995,5,7,0,0,1995,2004,5,39,0,0,1996,2001,3,234,117,
	0,1997,1998,5,5,0,0,1998,2000,3,234,117,0,1999,1997,1,0,0,0,2000,2003,1,
	0,0,0,2001,1999,1,0,0,0,2001,2002,1,0,0,0,2002,2005,1,0,0,0,2003,2001,1,
	0,0,0,2004,1996,1,0,0,0,2004,2005,1,0,0,0,2005,2006,1,0,0,0,2006,2019,5,
	40,0,0,2007,2008,5,69,0,0,2008,2009,5,39,0,0,2009,2014,3,234,117,0,2010,
	2011,5,5,0,0,2011,2013,3,234,117,0,2012,2010,1,0,0,0,2013,2016,1,0,0,0,
	2014,2012,1,0,0,0,2014,2015,1,0,0,0,2015,2017,1,0,0,0,2016,2014,1,0,0,0,
	2017,2018,5,40,0,0,2018,2020,1,0,0,0,2019,2007,1,0,0,0,2019,2020,1,0,0,
	0,2020,2023,1,0,0,0,2021,2023,5,171,0,0,2022,1982,1,0,0,0,2022,1984,1,0,
	0,0,2022,1985,1,0,0,0,2022,1986,1,0,0,0,2022,1987,1,0,0,0,2022,1988,1,0,
	0,0,2022,1989,1,0,0,0,2022,1990,1,0,0,0,2022,1991,1,0,0,0,2022,1992,1,0,
	0,0,2022,1993,1,0,0,0,2022,1994,1,0,0,0,2022,2021,1,0,0,0,2023,235,1,0,
	0,0,2024,2025,7,17,0,0,2025,237,1,0,0,0,192,241,247,259,261,266,285,289,
	296,301,307,313,323,326,336,340,346,349,353,358,362,375,378,392,395,401,
	407,413,419,425,431,437,452,465,475,481,487,493,499,505,511,516,524,527,
	544,546,557,563,567,579,583,585,589,595,607,611,613,627,643,647,654,674,
	681,692,698,705,713,724,733,739,750,757,763,770,776,782,786,794,799,807,
	817,822,826,838,847,849,855,861,868,879,885,889,895,902,918,927,931,937,
	946,950,958,962,970,974,976,984,993,998,1004,1009,1044,1070,1084,1096,1100,
	1105,1124,1129,1135,1154,1169,1186,1206,1212,1220,1228,1238,1250,1260,1271,
	1278,1285,1295,1360,1364,1373,1383,1395,1403,1455,1471,1496,1508,1521,1525,
	1535,1543,1549,1555,1564,1568,1570,1576,1584,1588,1590,1593,1606,1622,1632,
	1640,1644,1646,1664,1668,1670,1674,1686,1690,1692,1702,1706,1720,1724,1737,
	1745,1820,1824,1826,1848,1856,1933,1938,1940,1956,1967,1974,1978,2001,2004,
	2014,2019,2022];

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
