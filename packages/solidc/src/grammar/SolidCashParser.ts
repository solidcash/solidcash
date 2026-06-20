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
	public static readonly VersionLiteral = 151;
	public static readonly BooleanLiteral = 152;
	public static readonly NumberUnit = 153;
	public static readonly DecimalLiteral = 154;
	public static readonly NumberLiteral = 155;
	public static readonly PrimitiveType = 156;
	public static readonly UnboundedBytes = 157;
	public static readonly BoundedBytes = 158;
	public static readonly Bound = 159;
	public static readonly StringLiteral = 160;
	public static readonly DateLiteral = 161;
	public static readonly HexLiteral = 162;
	public static readonly TxVar = 163;
	public static readonly UnsafeCast = 164;
	public static readonly BoundedSignedInt = 165;
	public static readonly BoundedUnsignedInt = 166;
	public static readonly BoundedSignedFixed = 167;
	public static readonly BoundedUnsignedFixed = 168;
	public static readonly NullaryOp = 169;
	public static readonly UnicodeLiteral = 170;
	public static readonly HexStringLiteral = 171;
	public static readonly Identifier = 172;
	public static readonly WHITESPACE = 173;
	public static readonly COMMENT = 174;
	public static readonly LINE_COMMENT = 175;
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
                                                            "'error'", "'struct'", 
                                                            "'enum'", "'type'", 
                                                            "'constant'", 
                                                            "'constructor'", 
                                                            "'internal'", 
                                                            "'fallback'", 
                                                            "'payable'", 
                                                            "'virtual'", 
                                                            "'receive'", 
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
                                                            "'emit'", "'+='", 
                                                            "'-='", "'*='", 
                                                            "'/='", "'%='", 
                                                            "'&='", "'|='", 
                                                            "'^='", "'<<='", 
                                                            "'>>='", "'.delete'", 
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
                                                             null, "VersionLiteral", 
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
			case 37:
			case 38:
				{
				this.state = 264;
				this.contractDefinition();
				}
				break;
			case 36:
				{
				this.state = 265;
				this.libraryDefinition();
				}
				break;
			case -1:
				break;
			default:
				break;
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
			this.state = 309;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 4029480963) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 15) !== 0)) {
				{
				{
				this.state = 306;
				this.functionModifier();
				}
				}
				this.state = 311;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 313;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===70) {
				{
				this.state = 312;
				this.returnType();
				}
			}

			this.state = 315;
			this.match(SolidCashParser.T__3);
			this.state = 319;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 316;
				this.statement();
				}
				}
				this.state = 321;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 322;
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
			this.state = 359;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 18, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 324;
				this.match(SolidCashParser.T__7);
				this.state = 325;
				this.match(SolidCashParser.Identifier);
				this.state = 326;
				this.match(SolidCashParser.T__8);
				this.state = 329;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 7:
				case 148:
				case 149:
				case 150:
				case 156:
				case 157:
				case 158:
				case 165:
				case 166:
				case 167:
				case 168:
				case 172:
					{
					this.state = 327;
					this.typeName();
					}
					break;
				case 10:
					{
					this.state = 328;
					this.match(SolidCashParser.T__9);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 332;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 331;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 334;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 335;
				this.match(SolidCashParser.T__7);
				this.state = 336;
				this.match(SolidCashParser.T__3);
				this.state = 337;
				this.usingFunctionBinding();
				this.state = 342;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 14, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 338;
						this.match(SolidCashParser.T__4);
						this.state = 339;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 344;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 14, this._ctx);
				}
				this.state = 346;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 345;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 348;
				this.match(SolidCashParser.T__5);
				this.state = 349;
				this.match(SolidCashParser.T__8);
				this.state = 352;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 7:
				case 148:
				case 149:
				case 150:
				case 156:
				case 157:
				case 158:
				case 165:
				case 166:
				case 167:
				case 168:
				case 172:
					{
					this.state = 350;
					this.typeName();
					}
					break;
				case 10:
					{
					this.state = 351;
					this.match(SolidCashParser.T__9);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 355;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 354;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 357;
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
			this.state = 361;
			this.match(SolidCashParser.Identifier);
			this.state = 364;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===12) {
				{
				this.state = 362;
				this.match(SolidCashParser.T__11);
				this.state = 363;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 368;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 366;
				this.match(SolidCashParser.T__2);
				this.state = 367;
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
			this.state = 370;
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
			this.state = 372;
			this.match(SolidCashParser.T__27);
			this.state = 373;
			this.pragmaName();
			this.state = 374;
			this.pragmaValue();
			this.state = 375;
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
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 377;
			_la = this._input.LA(1);
			if(!(_la===29 || _la===30)) {
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
		this.enterRule(localctx, 18, SolidCashParser.RULE_pragmaValue);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 379;
			this.versionConstraint();
			this.state = 381;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 2364538880) !== 0) || _la===151) {
				{
				this.state = 380;
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
			this.state = 384;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 2364538880) !== 0)) {
				{
				this.state = 383;
				this.versionOperator();
				}
			}

			this.state = 386;
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
			this.state = 388;
			_la = this._input.LA(1);
			if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 2364538880) !== 0))) {
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
			this.state = 390;
			this.match(SolidCashParser.T__31);
			this.state = 391;
			this.match(SolidCashParser.Identifier);
			this.state = 401;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===33) {
				{
				this.state = 392;
				this.match(SolidCashParser.T__32);
				this.state = 393;
				this.match(SolidCashParser.Identifier);
				this.state = 398;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 394;
					this.match(SolidCashParser.T__4);
					this.state = 395;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 400;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 403;
			this.match(SolidCashParser.T__3);
			this.state = 407;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===46) {
				{
				{
				this.state = 404;
				this.enumDefinition();
				}
				}
				this.state = 409;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 413;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===45) {
				{
				{
				this.state = 410;
				this.structDefinition();
				}
				}
				this.state = 415;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 419;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===47) {
				{
				{
				this.state = 416;
				this.typeDefinition();
				}
				}
				this.state = 421;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 425;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===39) {
				{
				{
				this.state = 422;
				this.eventDefinition();
				}
				}
				this.state = 427;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 431;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 29, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 428;
					this.interfaceStateVariable();
					}
					}
				}
				this.state = 433;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 29, this._ctx);
			}
			this.state = 437;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===34 || _la===35) {
				{
				{
				this.state = 434;
				this.interfaceCollection();
				}
				}
				this.state = 439;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 443;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 440;
				this.interfaceFunction();
				}
				}
				this.state = 445;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 446;
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
			this.state = 458;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 32, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 448;
				this.interfaceStateVariableVisibility();
				this.state = 449;
				this.mappingType();
				this.state = 450;
				this.match(SolidCashParser.Identifier);
				this.state = 451;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 453;
				this.interfaceStateVariableVisibility();
				this.state = 454;
				this.arrayType(0);
				this.state = 455;
				this.match(SolidCashParser.Identifier);
				this.state = 456;
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
			this.state = 460;
			this.interfaceStateVariableVisibility();
			this.state = 461;
			this.typeName();
			this.state = 462;
			this.match(SolidCashParser.Identifier);
			this.state = 463;
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
			this.state = 465;
			_la = this._input.LA(1);
			if(!(_la===34 || _la===35)) {
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
			this.state = 467;
			this.match(SolidCashParser.T__6);
			this.state = 468;
			this.match(SolidCashParser.Identifier);
			this.state = 469;
			this.parameterList();
			this.state = 473;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 4029480963) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 15) !== 0)) {
				{
				{
				this.state = 470;
				this.functionModifier();
				}
				}
				this.state = 475;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 477;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===70) {
				{
				this.state = 476;
				this.returnType();
				}
			}

			this.state = 479;
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
			this.state = 481;
			this.match(SolidCashParser.T__35);
			this.state = 482;
			this.match(SolidCashParser.Identifier);
			this.state = 483;
			this.match(SolidCashParser.T__3);
			this.state = 487;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===46) {
				{
				{
				this.state = 484;
				this.enumDefinition();
				}
				}
				this.state = 489;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 493;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===45) {
				{
				{
				this.state = 490;
				this.structDefinition();
				}
				}
				this.state = 495;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 499;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===47) {
				{
				{
				this.state = 496;
				this.typeDefinition();
				}
				}
				this.state = 501;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 505;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===39) {
				{
				{
				this.state = 502;
				this.eventDefinition();
				}
				}
				this.state = 507;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 511;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===44) {
				{
				{
				this.state = 508;
				this.errorDefinition();
				}
				}
				this.state = 513;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 517;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 40, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 514;
					this.constantDefinition();
					}
					}
				}
				this.state = 519;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 40, this._ctx);
			}
			this.state = 523;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===8) {
				{
				{
				this.state = 520;
				this.usingForDirective();
				}
				}
				this.state = 525;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 529;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 526;
				this.freeFunctionDefinition();
				}
				}
				this.state = 531;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 532;
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
			this.state = 535;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===37) {
				{
				this.state = 534;
				this.match(SolidCashParser.T__36);
				}
			}

			this.state = 537;
			this.match(SolidCashParser.T__37);
			this.state = 538;
			this.match(SolidCashParser.Identifier);
			this.state = 540;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 539;
				this.parameterList();
				}
			}

			this.state = 551;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===33) {
				{
				this.state = 542;
				this.match(SolidCashParser.T__32);
				this.state = 543;
				this.match(SolidCashParser.Identifier);
				this.state = 548;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 544;
					this.match(SolidCashParser.T__4);
					this.state = 545;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 550;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 553;
			this.match(SolidCashParser.T__3);
			this.state = 570;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 74693667) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
				{
				this.state = 568;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 47, this._ctx) ) {
				case 1:
					{
					this.state = 554;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 555;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 556;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 557;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 558;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 559;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 560;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 561;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 562;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 563;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 564;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 565;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 566;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 567;
					this.receiveDefinition();
					}
					break;
				}
				}
				this.state = 572;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 573;
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
			this.state = 575;
			this.match(SolidCashParser.T__6);
			this.state = 576;
			this.match(SolidCashParser.Identifier);
			this.state = 577;
			this.parameterList();
			this.state = 581;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 4029480963) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 15) !== 0)) {
				{
				{
				this.state = 578;
				this.functionModifier();
				}
				}
				this.state = 583;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 587;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===172) {
				{
				{
				this.state = 584;
				this.customModifierInvocation();
				}
				}
				this.state = 589;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 591;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===70) {
				{
				this.state = 590;
				this.returnType();
				}
			}

			this.state = 593;
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
			this.state = 595;
			this.match(SolidCashParser.T__38);
			this.state = 596;
			this.match(SolidCashParser.Identifier);
			this.state = 597;
			this.match(SolidCashParser.T__39);
			this.state = 609;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
				{
				this.state = 598;
				this.eventParameter();
				this.state = 603;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 52, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 599;
						this.match(SolidCashParser.T__4);
						this.state = 600;
						this.eventParameter();
						}
						}
					}
					this.state = 605;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 52, this._ctx);
				}
				this.state = 607;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 606;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 611;
			this.match(SolidCashParser.T__40);
			this.state = 613;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 612;
				this.match(SolidCashParser.T__41);
				}
			}

			this.state = 615;
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
			this.state = 617;
			this.typeName();
			this.state = 619;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===43) {
				{
				this.state = 618;
				this.match(SolidCashParser.T__42);
				}
			}

			this.state = 621;
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
			this.state = 623;
			this.match(SolidCashParser.T__43);
			this.state = 624;
			this.match(SolidCashParser.Identifier);
			this.state = 625;
			this.match(SolidCashParser.T__39);
			this.state = 637;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
				{
				this.state = 626;
				this.errorParameter();
				this.state = 631;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 57, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 627;
						this.match(SolidCashParser.T__4);
						this.state = 628;
						this.errorParameter();
						}
						}
					}
					this.state = 633;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 57, this._ctx);
				}
				this.state = 635;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 634;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 639;
			this.match(SolidCashParser.T__40);
			this.state = 640;
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
			this.state = 642;
			this.typeName();
			this.state = 643;
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
			this.state = 645;
			this.match(SolidCashParser.T__44);
			this.state = 646;
			this.match(SolidCashParser.Identifier);
			this.state = 647;
			this.match(SolidCashParser.T__3);
			this.state = 649;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 648;
				this.structField();
				}
				}
				this.state = 651;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0));
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
	public structField(): StructFieldContext {
		let localctx: StructFieldContext = new StructFieldContext(this, this._ctx, this.state);
		this.enterRule(localctx, 50, SolidCashParser.RULE_structField);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 655;
			this.typeName();
			this.state = 656;
			this.match(SolidCashParser.Identifier);
			this.state = 657;
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
			this.state = 659;
			this.match(SolidCashParser.T__45);
			this.state = 660;
			this.match(SolidCashParser.Identifier);
			this.state = 661;
			this.match(SolidCashParser.T__3);
			this.state = 662;
			this.enumMember();
			this.state = 667;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 61, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 663;
					this.match(SolidCashParser.T__4);
					this.state = 664;
					this.enumMember();
					}
					}
				}
				this.state = 669;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 61, this._ctx);
			}
			this.state = 671;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 670;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 673;
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
			this.state = 675;
			this.match(SolidCashParser.Identifier);
			this.state = 678;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===31) {
				{
				this.state = 676;
				this.match(SolidCashParser.T__30);
				this.state = 677;
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
			this.state = 680;
			this.match(SolidCashParser.T__46);
			this.state = 681;
			this.match(SolidCashParser.Identifier);
			this.state = 682;
			this.match(SolidCashParser.T__32);
			this.state = 683;
			this.typeName();
			this.state = 684;
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
			this.state = 686;
			this.typeName();
			this.state = 687;
			this.match(SolidCashParser.T__47);
			this.state = 688;
			this.match(SolidCashParser.Identifier);
			this.state = 689;
			this.match(SolidCashParser.T__30);
			this.state = 690;
			this.expression(0);
			this.state = 691;
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
			this.state = 693;
			this.match(SolidCashParser.T__48);
			this.state = 694;
			this.parameterList();
			this.state = 696;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 65539) !== 0)) {
				{
				this.state = 695;
				_la = this._input.LA(1);
				if(!(((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 65539) !== 0))) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
			}

			this.state = 701;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===172) {
				{
				{
				this.state = 698;
				this.parentInvocation();
				}
				}
				this.state = 703;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 704;
			this.match(SolidCashParser.T__3);
			this.state = 708;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 705;
				this.statement();
				}
				}
				this.state = 710;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 711;
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
			this.state = 713;
			this.match(SolidCashParser.T__50);
			this.state = 714;
			this.parameterList();
			this.state = 715;
			this.match(SolidCashParser.T__34);
			this.state = 719;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 52)) & ~0x1F) === 0 && ((1 << (_la - 52)) & 65539) !== 0)) {
				{
				{
				this.state = 716;
				this.fallbackModifier();
				}
				}
				this.state = 721;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 725;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===172) {
				{
				{
				this.state = 722;
				this.customModifierInvocation();
				}
				}
				this.state = 727;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 728;
			this.match(SolidCashParser.T__3);
			this.state = 732;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 729;
				this.statement();
				}
				}
				this.state = 734;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 735;
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
			this.state = 740;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 52:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 737;
				this.match(SolidCashParser.T__51);
				}
				break;
			case 53:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 738;
				this.match(SolidCashParser.T__52);
				}
				break;
			case 68:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 739;
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
			this.state = 742;
			this.match(SolidCashParser.T__53);
			this.state = 743;
			this.match(SolidCashParser.T__39);
			this.state = 744;
			this.match(SolidCashParser.T__40);
			this.state = 745;
			this.match(SolidCashParser.T__34);
			this.state = 746;
			this.match(SolidCashParser.T__51);
			this.state = 747;
			this.match(SolidCashParser.T__3);
			this.state = 751;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 748;
				this.statement();
				}
				}
				this.state = 753;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 754;
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
			this.state = 756;
			this.match(SolidCashParser.Identifier);
			this.state = 757;
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
			this.state = 809;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 79, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 760;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 2162691) !== 0)) {
					{
					this.state = 759;
					this.stateVariableVisibility();
					}
				}

				this.state = 762;
				this.typeName();
				this.state = 766;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 763;
					this.modifier();
					}
					}
					this.state = 768;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 769;
				this.match(SolidCashParser.Identifier);
				this.state = 770;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 772;
				this.typeName();
				this.state = 773;
				this.stateVariableVisibility();
				this.state = 777;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 774;
					this.modifier();
					}
					}
					this.state = 779;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 780;
				this.match(SolidCashParser.Identifier);
				this.state = 781;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 784;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 2162691) !== 0)) {
					{
					this.state = 783;
					this.stateVariableVisibility();
					}
				}

				this.state = 786;
				this.mappingType();
				this.state = 790;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 2179075) !== 0) || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 787;
					this.collectionModifier();
					}
					}
					this.state = 792;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 793;
				this.match(SolidCashParser.Identifier);
				this.state = 794;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 797;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 2162691) !== 0)) {
					{
					this.state = 796;
					this.stateVariableVisibility();
					}
				}

				this.state = 799;
				this.arrayType(0);
				this.state = 803;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 2179075) !== 0) || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 800;
					this.collectionModifier();
					}
					}
					this.state = 805;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 806;
				this.match(SolidCashParser.Identifier);
				this.state = 807;
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
			this.state = 813;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 48:
			case 144:
			case 145:
			case 146:
			case 147:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 811;
				this.modifier();
				}
				break;
			case 34:
			case 35:
			case 50:
			case 55:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 812;
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
			this.state = 815;
			_la = this._input.LA(1);
			if(!(((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 2162691) !== 0))) {
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
			this.state = 853;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 86, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 817;
				this.match(SolidCashParser.T__55);
				this.state = 818;
				this.match(SolidCashParser.T__39);
				this.state = 819;
				this.typeName();
				this.state = 821;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 820;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 823;
				this.match(SolidCashParser.T__56);
				this.state = 824;
				this.typeName();
				this.state = 826;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 825;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 828;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 830;
				this.match(SolidCashParser.T__55);
				this.state = 831;
				this.match(SolidCashParser.T__39);
				this.state = 832;
				this.typeName();
				this.state = 834;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 833;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 836;
				this.match(SolidCashParser.T__56);
				this.state = 837;
				this.mappingType();
				this.state = 838;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 840;
				this.match(SolidCashParser.T__55);
				this.state = 841;
				this.match(SolidCashParser.T__39);
				this.state = 842;
				this.typeName();
				this.state = 844;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 843;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 846;
				this.match(SolidCashParser.T__56);
				this.state = 847;
				this.arrayType(0);
				this.state = 849;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 848;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 851;
				this.match(SolidCashParser.T__40);
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
			this.state = 865;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 87, this._ctx) ) {
			case 1:
				{
				this.state = 856;
				this.typeName();
				this.state = 857;
				this.match(SolidCashParser.T__57);
				this.state = 858;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 859;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				{
				this.state = 861;
				this.typeName();
				this.state = 862;
				this.match(SolidCashParser.T__57);
				this.state = 863;
				this.match(SolidCashParser.T__58);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 876;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 89, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 874;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 88, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 867;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 868;
						this.match(SolidCashParser.T__57);
						this.state = 869;
						this.match(SolidCashParser.NumberLiteral);
						this.state = 870;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 871;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 872;
						this.match(SolidCashParser.T__57);
						this.state = 873;
						this.match(SolidCashParser.T__58);
						}
						break;
					}
					}
				}
				this.state = 878;
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
		this.enterRule(localctx, 80, SolidCashParser.RULE_modifierDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 879;
			this.match(SolidCashParser.T__59);
			this.state = 880;
			this.match(SolidCashParser.Identifier);
			this.state = 882;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 881;
				this.parameterList();
				}
			}

			this.state = 884;
			this.match(SolidCashParser.T__3);
			this.state = 888;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2149847169) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 885;
				this.modifierStatement();
				}
				}
				this.state = 890;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 891;
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
			this.state = 895;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 61:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 893;
				this.placeholderStatement();
				}
				break;
			case 7:
			case 9:
			case 14:
			case 27:
			case 40:
			case 47:
			case 52:
			case 58:
			case 71:
			case 72:
			case 73:
			case 89:
			case 90:
			case 91:
			case 96:
			case 97:
			case 98:
			case 99:
			case 100:
			case 101:
			case 105:
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
			case 121:
			case 127:
			case 136:
			case 148:
			case 149:
			case 150:
			case 152:
			case 154:
			case 155:
			case 156:
			case 157:
			case 158:
			case 160:
			case 161:
			case 162:
			case 164:
			case 165:
			case 166:
			case 167:
			case 168:
			case 169:
			case 170:
			case 171:
			case 172:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 894;
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
			this.state = 897;
			this.match(SolidCashParser.T__60);
			this.state = 898;
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
			this.state = 900;
			this.match(SolidCashParser.T__6);
			this.state = 901;
			this.match(SolidCashParser.Identifier);
			this.state = 902;
			this.parameterList();
			this.state = 906;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 4029480963) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 15) !== 0)) {
				{
				{
				this.state = 903;
				this.functionModifier();
				}
				}
				this.state = 908;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 912;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===172) {
				{
				{
				this.state = 909;
				this.customModifierInvocation();
				}
				}
				this.state = 914;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 916;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===70) {
				{
				this.state = 915;
				this.returnType();
				}
			}

			this.state = 918;
			this.match(SolidCashParser.T__3);
			this.state = 922;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 919;
				this.statement();
				}
				}
				this.state = 924;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 925;
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
			this.state = 927;
			this.match(SolidCashParser.Identifier);
			this.state = 929;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 928;
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
			this.state = 945;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 62:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 931;
				this.match(SolidCashParser.T__61);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 932;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 50:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 933;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 35:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 934;
				this.match(SolidCashParser.T__34);
				}
				break;
			case 34:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 935;
				this.match(SolidCashParser.T__33);
				}
				break;
			case 55:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 936;
				this.match(SolidCashParser.T__54);
				}
				break;
			case 52:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 937;
				this.match(SolidCashParser.T__51);
				}
				break;
			case 68:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 938;
				this.overrideSpecifier();
				}
				break;
			case 53:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 939;
				this.match(SolidCashParser.T__52);
				}
				break;
			case 69:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 940;
				this.unsafeModifier();
				}
				break;
			case 64:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 941;
				this.match(SolidCashParser.T__63);
				}
				break;
			case 65:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 942;
				this.match(SolidCashParser.T__64);
				}
				break;
			case 66:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 943;
				this.match(SolidCashParser.T__65);
				}
				break;
			case 67:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 944;
				this.match(SolidCashParser.T__66);
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
			this.state = 947;
			this.match(SolidCashParser.T__67);
			this.state = 958;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 948;
				this.match(SolidCashParser.T__39);
				this.state = 949;
				this.match(SolidCashParser.Identifier);
				this.state = 954;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 950;
					this.match(SolidCashParser.T__4);
					this.state = 951;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 956;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 957;
				this.match(SolidCashParser.T__40);
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
			this.state = 960;
			this.match(SolidCashParser.T__68);
			this.state = 964;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 961;
				this.match(SolidCashParser.T__39);
				this.state = 962;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 963;
				this.match(SolidCashParser.T__40);
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
			this.state = 966;
			this.match(SolidCashParser.T__69);
			this.state = 967;
			this.match(SolidCashParser.T__39);
			this.state = 968;
			this.returnParam();
			this.state = 973;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 102, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 969;
					this.match(SolidCashParser.T__4);
					this.state = 970;
					this.returnParam();
					}
					}
				}
				this.state = 975;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 102, this._ctx);
			}
			this.state = 977;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 976;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 979;
			this.match(SolidCashParser.T__40);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 981;
			this.typeName();
			this.state = 985;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
				{
				{
				this.state = 982;
				this.modifier();
				}
				}
				this.state = 987;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 989;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===172) {
				{
				this.state = 988;
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
			this.state = 991;
			this.match(SolidCashParser.T__39);
			this.state = 1003;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
				{
				this.state = 992;
				this.parameter();
				this.state = 997;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 106, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 993;
						this.match(SolidCashParser.T__4);
						this.state = 994;
						this.parameter();
						}
						}
					}
					this.state = 999;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 106, this._ctx);
				}
				this.state = 1001;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1000;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1005;
			this.match(SolidCashParser.T__40);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1025;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 111, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1007;
				this.typeName();
				this.state = 1011;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 1008;
					this.modifier();
					}
					}
					this.state = 1013;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1014;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1016;
				this.arrayType(0);
				this.state = 1020;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 1017;
					this.modifier();
					}
					}
					this.state = 1022;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1023;
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
			this.state = 1036;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1027;
				this.match(SolidCashParser.T__3);
				this.state = 1031;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
					{
					{
					this.state = 1028;
					this.statement();
					}
					}
					this.state = 1033;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1034;
				this.match(SolidCashParser.T__5);
				}
				break;
			case 7:
			case 9:
			case 14:
			case 27:
			case 40:
			case 47:
			case 52:
			case 58:
			case 71:
			case 72:
			case 73:
			case 89:
			case 90:
			case 91:
			case 96:
			case 97:
			case 98:
			case 99:
			case 100:
			case 101:
			case 105:
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
			case 121:
			case 127:
			case 136:
			case 148:
			case 149:
			case 150:
			case 152:
			case 154:
			case 155:
			case 156:
			case 157:
			case 158:
			case 160:
			case 161:
			case 162:
			case 164:
			case 165:
			case 166:
			case 167:
			case 168:
			case 169:
			case 170:
			case 171:
			case 172:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1035;
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
			this.state = 1071;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 114, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1038;
				this.variableDefinition();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1039;
				this.tupleAssignment();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1040;
				this.arrayAssignStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1041;
				this.arrayPushStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1042;
				this.arrayPopStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1043;
				this.arrayDeleteStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1044;
				this.stateArrayPushStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1045;
				this.stateArrayPopStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1046;
				this.assignStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1047;
				this.stateAssignStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1048;
				this.mappingFieldAssignStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1049;
				this.mappingAssignStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1050;
				this.mappingDeleteStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1051;
				this.timeOpStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1052;
				this.requireStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1053;
				this.ifStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1054;
				this.loopStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1055;
				this.consoleStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1056;
				this.emitStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1057;
				this.transferStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1058;
				this.tokenContainerMethodStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1059;
				this.returnStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1060;
				this.functionCallStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1061;
				this.addressMethodStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1062;
				this.assemblyStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1063;
				this.tryCatchStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1064;
				this.revertStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1065;
				this.assertStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1066;
				this.deleteStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1067;
				this.uncheckedStatement();
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 31);
				{
				this.state = 1068;
				this.switchStatement();
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 32);
				{
				this.state = 1069;
				this.breakStatement();
				}
				break;
			case 33:
				this.enterOuterAlt(localctx, 33);
				{
				this.state = 1070;
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
			this.state = 1073;
			this.match(SolidCashParser.T__70);
			this.state = 1074;
			this.match(SolidCashParser.T__11);
			this.state = 1075;
			this.match(SolidCashParser.Identifier);
			this.state = 1076;
			this.match(SolidCashParser.T__39);
			this.state = 1077;
			this.expression(0);
			this.state = 1078;
			this.match(SolidCashParser.T__4);
			this.state = 1079;
			this.expression(0);
			this.state = 1080;
			this.match(SolidCashParser.T__40);
			this.state = 1081;
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
			this.state = 1083;
			this.match(SolidCashParser.T__70);
			this.state = 1084;
			this.match(SolidCashParser.T__11);
			this.state = 1085;
			this.match(SolidCashParser.Identifier);
			this.state = 1086;
			this.match(SolidCashParser.T__57);
			this.state = 1087;
			this.expression(0);
			this.state = 1088;
			this.match(SolidCashParser.T__58);
			this.state = 1089;
			this.match(SolidCashParser.T__11);
			this.state = 1090;
			this.match(SolidCashParser.Identifier);
			this.state = 1091;
			this.match(SolidCashParser.T__39);
			this.state = 1092;
			this.expression(0);
			this.state = 1097;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1093;
				this.match(SolidCashParser.T__4);
				this.state = 1094;
				this.expression(0);
				}
				}
				this.state = 1099;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1100;
			this.match(SolidCashParser.T__40);
			this.state = 1101;
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
			this.state = 1132;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 119, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1103;
				this.match(SolidCashParser.T__71);
				this.state = 1104;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1105;
				this.match(SolidCashParser.T__71);
				this.state = 1106;
				this.expression(0);
				this.state = 1111;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1107;
					this.match(SolidCashParser.T__4);
					this.state = 1108;
					this.expression(0);
					}
					}
					this.state = 1113;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1114;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1116;
				this.match(SolidCashParser.T__71);
				this.state = 1117;
				this.match(SolidCashParser.T__39);
				this.state = 1118;
				this.expression(0);
				this.state = 1123;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 117, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1119;
						this.match(SolidCashParser.T__4);
						this.state = 1120;
						this.expression(0);
						}
						}
					}
					this.state = 1125;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 117, this._ctx);
				}
				this.state = 1127;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1126;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1129;
				this.match(SolidCashParser.T__40);
				this.state = 1130;
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
			let _alt: number;
			this.state = 1179;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 125, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1134;
				this.match(SolidCashParser.Identifier);
				this.state = 1137;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1135;
					this.match(SolidCashParser.T__11);
					this.state = 1136;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1139;
				this.match(SolidCashParser.T__39);
				this.state = 1140;
				this.match(SolidCashParser.T__3);
				this.state = 1152;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 1141;
					this.namedArg();
					this.state = 1146;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 121, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1142;
							this.match(SolidCashParser.T__4);
							this.state = 1143;
							this.namedArg();
							}
							}
						}
						this.state = 1148;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 121, this._ctx);
					}
					this.state = 1150;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1149;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1154;
				this.match(SolidCashParser.T__5);
				this.state = 1155;
				this.match(SolidCashParser.T__40);
				this.state = 1156;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1157;
				this.match(SolidCashParser.Identifier);
				this.state = 1158;
				this.expressionList();
				this.state = 1159;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1161;
				this.match(SolidCashParser.Identifier);
				this.state = 1162;
				this.match(SolidCashParser.T__11);
				this.state = 1163;
				this.match(SolidCashParser.Identifier);
				this.state = 1164;
				this.expressionList();
				this.state = 1165;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1167;
				this.match(SolidCashParser.Identifier);
				this.state = 1168;
				this.expressionList();
				this.state = 1169;
				this.match(SolidCashParser.T__11);
				this.state = 1170;
				this.match(SolidCashParser.Identifier);
				this.state = 1171;
				this.match(SolidCashParser.T__11);
				this.state = 1172;
				this.match(SolidCashParser.Identifier);
				this.state = 1174;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1173;
					this.callOptions();
					}
				}

				this.state = 1176;
				this.expressionList();
				this.state = 1177;
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
			this.state = 1181;
			this.expression(0);
			this.state = 1182;
			this.match(SolidCashParser.T__11);
			this.state = 1183;
			this.match(SolidCashParser.Identifier);
			this.state = 1185;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===4) {
				{
				this.state = 1184;
				this.callOptions();
				}
			}

			this.state = 1187;
			this.expressionList();
			this.state = 1188;
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
		let _la: number;
		try {
			let _alt: number;
			this.state = 1223;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 132, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1190;
				this.match(SolidCashParser.T__72);
				this.state = 1191;
				this.match(SolidCashParser.Identifier);
				this.state = 1194;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1192;
					this.match(SolidCashParser.T__11);
					this.state = 1193;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1196;
				this.match(SolidCashParser.T__39);
				this.state = 1197;
				this.match(SolidCashParser.T__3);
				this.state = 1209;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 1198;
					this.namedArg();
					this.state = 1203;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 128, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1199;
							this.match(SolidCashParser.T__4);
							this.state = 1200;
							this.namedArg();
							}
							}
						}
						this.state = 1205;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 128, this._ctx);
					}
					this.state = 1207;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1206;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1211;
				this.match(SolidCashParser.T__5);
				this.state = 1212;
				this.match(SolidCashParser.T__40);
				this.state = 1213;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1214;
				this.match(SolidCashParser.T__72);
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
				this.expressionList();
				this.state = 1221;
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
	public mappingAssignStatement(): MappingAssignStatementContext {
		let localctx: MappingAssignStatementContext = new MappingAssignStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 120, SolidCashParser.RULE_mappingAssignStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1225;
			this.match(SolidCashParser.T__70);
			this.state = 1226;
			this.match(SolidCashParser.T__11);
			this.state = 1227;
			this.match(SolidCashParser.Identifier);
			this.state = 1232;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 1228;
				this.match(SolidCashParser.T__57);
				this.state = 1229;
				this.expression(0);
				this.state = 1230;
				this.match(SolidCashParser.T__58);
				}
				}
				this.state = 1234;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===58);
			this.state = 1236;
			localctx._op = this._input.LT(1);
			_la = this._input.LA(1);
			if(!(_la===31 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
			    localctx._op = this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			this.state = 1237;
			this.expression(0);
			this.state = 1238;
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
			this.state = 1240;
			this.match(SolidCashParser.T__70);
			this.state = 1241;
			this.match(SolidCashParser.T__11);
			this.state = 1242;
			this.match(SolidCashParser.Identifier);
			this.state = 1247;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 1243;
				this.match(SolidCashParser.T__57);
				this.state = 1244;
				this.expression(0);
				this.state = 1245;
				this.match(SolidCashParser.T__58);
				}
				}
				this.state = 1249;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===58);
			this.state = 1251;
			this.match(SolidCashParser.T__11);
			this.state = 1252;
			this.match(SolidCashParser.Identifier);
			this.state = 1253;
			localctx._op = this._input.LT(1);
			_la = this._input.LA(1);
			if(!(_la===31 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
			    localctx._op = this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			this.state = 1254;
			this.expression(0);
			this.state = 1255;
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
			this.state = 1257;
			this.match(SolidCashParser.T__70);
			this.state = 1258;
			this.match(SolidCashParser.T__11);
			this.state = 1259;
			this.match(SolidCashParser.Identifier);
			this.state = 1266;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===58) {
				{
				{
				this.state = 1260;
				this.match(SolidCashParser.T__57);
				this.state = 1261;
				this.expression(0);
				this.state = 1262;
				this.match(SolidCashParser.T__58);
				}
				}
				this.state = 1268;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1269;
			this.match(SolidCashParser.T__83);
			this.state = 1270;
			this.match(SolidCashParser.T__39);
			this.state = 1271;
			this.expression(0);
			this.state = 1272;
			this.match(SolidCashParser.T__40);
			this.state = 1273;
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
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1275;
			this.match(SolidCashParser.T__70);
			this.state = 1276;
			this.match(SolidCashParser.T__11);
			this.state = 1277;
			this.match(SolidCashParser.Identifier);
			this.state = 1278;
			localctx._op = this._input.LT(1);
			_la = this._input.LA(1);
			if(!(_la===31 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
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
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1308;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 139, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1282;
				this.typeName();
				this.state = 1286;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 1283;
					this.modifier();
					}
					}
					this.state = 1288;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1289;
				this.match(SolidCashParser.Identifier);
				this.state = 1292;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===31) {
					{
					this.state = 1290;
					this.match(SolidCashParser.T__30);
					this.state = 1291;
					this.expression(0);
					}
				}

				this.state = 1294;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1296;
				this.arrayType(0);
				this.state = 1300;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 1297;
					this.modifier();
					}
					}
					this.state = 1302;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1303;
				this.match(SolidCashParser.Identifier);
				this.state = 1304;
				this.match(SolidCashParser.T__30);
				this.state = 1305;
				this.expression(0);
				this.state = 1306;
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
			this.state = 1358;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 144, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1310;
				this.typeName();
				this.state = 1311;
				this.match(SolidCashParser.Identifier);
				this.state = 1316;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1312;
					this.match(SolidCashParser.T__4);
					this.state = 1313;
					this.typeName();
					this.state = 1314;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1318;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1320;
				this.match(SolidCashParser.T__30);
				this.state = 1321;
				this.expression(0);
				this.state = 1322;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1324;
				this.match(SolidCashParser.T__39);
				this.state = 1325;
				this.tupleSlot();
				this.state = 1328;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1326;
					this.match(SolidCashParser.T__4);
					this.state = 1327;
					this.tupleSlot();
					}
					}
					this.state = 1330;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1332;
				this.match(SolidCashParser.T__40);
				this.state = 1333;
				this.match(SolidCashParser.T__30);
				this.state = 1334;
				this.match(SolidCashParser.T__39);
				this.state = 1335;
				this.expression(0);
				this.state = 1338;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1336;
					this.match(SolidCashParser.T__4);
					this.state = 1337;
					this.expression(0);
					}
					}
					this.state = 1340;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1342;
				this.match(SolidCashParser.T__40);
				this.state = 1343;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1345;
				this.match(SolidCashParser.T__39);
				this.state = 1346;
				this.tupleSlot();
				this.state = 1349;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1347;
					this.match(SolidCashParser.T__4);
					this.state = 1348;
					this.tupleSlot();
					}
					}
					this.state = 1351;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1353;
				this.match(SolidCashParser.T__40);
				this.state = 1354;
				this.match(SolidCashParser.T__30);
				this.state = 1355;
				this.expression(0);
				this.state = 1356;
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
			this.state = 1365;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 145, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1360;
				this.typeName();
				this.state = 1361;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1363;
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
			this.state = 1375;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 146, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1367;
				this.match(SolidCashParser.Identifier);
				this.state = 1368;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===31 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1369;
				this.expression(0);
				this.state = 1370;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1372;
				this.match(SolidCashParser.Identifier);
				this.state = 1373;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===85 || _la===86)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1374;
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
			this.state = 1377;
			this.match(SolidCashParser.Identifier);
			this.state = 1378;
			this.match(SolidCashParser.T__86);
			this.state = 1379;
			this.match(SolidCashParser.T__39);
			this.state = 1380;
			this.expression(0);
			this.state = 1381;
			this.match(SolidCashParser.T__40);
			this.state = 1382;
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
			this.state = 1384;
			this.match(SolidCashParser.Identifier);
			this.state = 1385;
			this.match(SolidCashParser.T__87);
			this.state = 1386;
			this.match(SolidCashParser.T__39);
			this.state = 1387;
			this.match(SolidCashParser.T__40);
			this.state = 1388;
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
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1390;
			this.match(SolidCashParser.Identifier);
			this.state = 1391;
			this.match(SolidCashParser.T__57);
			this.state = 1392;
			this.expression(0);
			this.state = 1393;
			this.match(SolidCashParser.T__58);
			this.state = 1394;
			localctx._op = this._input.LT(1);
			_la = this._input.LA(1);
			if(!(_la===31 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
			    localctx._op = this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			this.state = 1395;
			this.expression(0);
			this.state = 1396;
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
			this.state = 1398;
			this.match(SolidCashParser.Identifier);
			this.state = 1399;
			this.match(SolidCashParser.T__83);
			this.state = 1400;
			this.match(SolidCashParser.T__39);
			this.state = 1401;
			this.expression(0);
			this.state = 1402;
			this.match(SolidCashParser.T__40);
			this.state = 1403;
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
			this.state = 1405;
			this.match(SolidCashParser.T__70);
			this.state = 1406;
			this.match(SolidCashParser.T__11);
			this.state = 1407;
			this.match(SolidCashParser.Identifier);
			this.state = 1408;
			this.match(SolidCashParser.T__86);
			this.state = 1409;
			this.match(SolidCashParser.T__39);
			this.state = 1410;
			this.expression(0);
			this.state = 1411;
			this.match(SolidCashParser.T__40);
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
	public stateArrayPopStatement(): StateArrayPopStatementContext {
		let localctx: StateArrayPopStatementContext = new StateArrayPopStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 146, SolidCashParser.RULE_stateArrayPopStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1414;
			this.match(SolidCashParser.T__70);
			this.state = 1415;
			this.match(SolidCashParser.T__11);
			this.state = 1416;
			this.match(SolidCashParser.Identifier);
			this.state = 1417;
			this.match(SolidCashParser.T__87);
			this.state = 1418;
			this.match(SolidCashParser.T__39);
			this.state = 1419;
			this.match(SolidCashParser.T__40);
			this.state = 1420;
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
			this.state = 1444;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 148, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1422;
				this.match(SolidCashParser.T__88);
				this.state = 1423;
				this.match(SolidCashParser.Identifier);
				this.state = 1424;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1425;
				this.match(SolidCashParser.T__88);
				this.state = 1426;
				this.match(SolidCashParser.T__70);
				this.state = 1427;
				this.match(SolidCashParser.T__11);
				this.state = 1428;
				this.match(SolidCashParser.Identifier);
				this.state = 1429;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1430;
				this.match(SolidCashParser.T__88);
				this.state = 1431;
				this.match(SolidCashParser.T__70);
				this.state = 1432;
				this.match(SolidCashParser.T__11);
				this.state = 1433;
				this.match(SolidCashParser.Identifier);
				this.state = 1438;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1434;
					this.match(SolidCashParser.T__57);
					this.state = 1435;
					this.expression(0);
					this.state = 1436;
					this.match(SolidCashParser.T__58);
					}
					}
					this.state = 1440;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===58);
				this.state = 1442;
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
			this.state = 1446;
			this.match(SolidCashParser.T__89);
			this.state = 1447;
			this.match(SolidCashParser.T__39);
			this.state = 1448;
			this.match(SolidCashParser.TxVar);
			this.state = 1449;
			this.match(SolidCashParser.T__22);
			this.state = 1450;
			this.expression(0);
			this.state = 1453;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1451;
				this.match(SolidCashParser.T__4);
				this.state = 1452;
				this.requireMessage();
				}
			}

			this.state = 1455;
			this.match(SolidCashParser.T__40);
			this.state = 1456;
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
			this.state = 1458;
			this.match(SolidCashParser.T__89);
			this.state = 1459;
			this.match(SolidCashParser.T__39);
			this.state = 1460;
			this.expression(0);
			this.state = 1463;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1461;
				this.match(SolidCashParser.T__4);
				this.state = 1462;
				this.requireMessage();
				}
			}

			this.state = 1465;
			this.match(SolidCashParser.T__40);
			this.state = 1466;
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
			this.state = 1468;
			this.match(SolidCashParser.T__90);
			this.state = 1469;
			this.match(SolidCashParser.T__39);
			this.state = 1470;
			this.expression(0);
			this.state = 1471;
			this.match(SolidCashParser.T__40);
			this.state = 1472;
			localctx._ifBlock = this.block();
			this.state = 1475;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 151, this._ctx) ) {
			case 1:
				{
				this.state = 1473;
				this.match(SolidCashParser.T__91);
				this.state = 1474;
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
			this.state = 1483;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 152, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1477;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1478;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1479;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1480;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1481;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1482;
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
			this.state = 1485;
			this.match(SolidCashParser.T__8);
			this.state = 1486;
			this.match(SolidCashParser.T__39);
			this.state = 1487;
			this.typeName();
			this.state = 1488;
			this.match(SolidCashParser.Identifier);
			this.state = 1489;
			this.match(SolidCashParser.T__4);
			this.state = 1490;
			this.typeName();
			this.state = 1491;
			this.match(SolidCashParser.Identifier);
			this.state = 1492;
			this.match(SolidCashParser.T__92);
			this.state = 1493;
			this.match(SolidCashParser.T__70);
			this.state = 1494;
			this.match(SolidCashParser.T__11);
			this.state = 1495;
			this.match(SolidCashParser.Identifier);
			this.state = 1496;
			this.match(SolidCashParser.T__11);
			this.state = 1497;
			this.match(SolidCashParser.T__93);
			this.state = 1498;
			this.match(SolidCashParser.T__40);
			this.state = 1499;
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
			this.state = 1501;
			this.match(SolidCashParser.T__8);
			this.state = 1502;
			this.match(SolidCashParser.T__39);
			this.state = 1503;
			this.typeName();
			this.state = 1504;
			this.match(SolidCashParser.Identifier);
			this.state = 1505;
			this.match(SolidCashParser.T__94);
			this.state = 1506;
			this.match(SolidCashParser.T__70);
			this.state = 1507;
			this.match(SolidCashParser.T__11);
			this.state = 1508;
			this.match(SolidCashParser.Identifier);
			this.state = 1509;
			this.match(SolidCashParser.T__40);
			this.state = 1510;
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
			this.state = 1512;
			this.match(SolidCashParser.T__8);
			this.state = 1513;
			this.match(SolidCashParser.T__39);
			this.state = 1514;
			this.typeName();
			this.state = 1515;
			this.match(SolidCashParser.Identifier);
			this.state = 1516;
			this.match(SolidCashParser.T__92);
			this.state = 1517;
			this.match(SolidCashParser.T__70);
			this.state = 1518;
			this.match(SolidCashParser.T__11);
			this.state = 1519;
			this.match(SolidCashParser.Identifier);
			this.state = 1520;
			this.match(SolidCashParser.T__40);
			this.state = 1521;
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
			this.state = 1523;
			this.match(SolidCashParser.T__8);
			this.state = 1524;
			this.match(SolidCashParser.T__39);
			this.state = 1525;
			this.forInit();
			this.state = 1526;
			this.forCondition();
			this.state = 1527;
			this.forUpdate();
			this.state = 1528;
			this.match(SolidCashParser.T__40);
			this.state = 1529;
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
			this.state = 1531;
			this.typeName();
			this.state = 1535;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
				{
				{
				this.state = 1532;
				this.modifier();
				}
				}
				this.state = 1537;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1538;
			this.match(SolidCashParser.Identifier);
			this.state = 1539;
			this.match(SolidCashParser.T__30);
			this.state = 1540;
			this.expression(0);
			this.state = 1541;
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
			this.state = 1543;
			this.expression(0);
			this.state = 1544;
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
			this.state = 1551;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 154, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1546;
				this.match(SolidCashParser.Identifier);
				this.state = 1547;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===31 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1548;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1549;
				this.match(SolidCashParser.Identifier);
				this.state = 1550;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===85 || _la===86)) {
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
			this.state = 1553;
			this.match(SolidCashParser.T__95);
			this.state = 1554;
			this.block();
			this.state = 1555;
			this.match(SolidCashParser.T__96);
			this.state = 1556;
			this.match(SolidCashParser.T__39);
			this.state = 1557;
			this.expression(0);
			this.state = 1558;
			this.match(SolidCashParser.T__40);
			this.state = 1559;
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
			this.state = 1561;
			this.match(SolidCashParser.T__96);
			this.state = 1562;
			this.match(SolidCashParser.T__39);
			this.state = 1563;
			this.expression(0);
			this.state = 1564;
			this.match(SolidCashParser.T__40);
			this.state = 1565;
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
			this.state = 1567;
			this.match(SolidCashParser.T__97);
			this.state = 1568;
			this.consoleParameterList();
			this.state = 1569;
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
			this.state = 1571;
			this.match(SolidCashParser.T__98);
			this.state = 1572;
			this.match(SolidCashParser.T__3);
			this.state = 1576;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 155)) & ~0x1F) === 0 && ((1 << (_la - 155)) & 131201) !== 0)) {
				{
				{
				this.state = 1573;
				this.assemblyToken();
				}
				}
				this.state = 1578;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1579;
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
			this.state = 1581;
			_la = this._input.LA(1);
			if(!(((((_la - 155)) & ~0x1F) === 0 && ((1 << (_la - 155)) & 131201) !== 0))) {
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
			this.state = 1583;
			this.match(SolidCashParser.T__99);
			this.state = 1584;
			this.match(SolidCashParser.T__3);
			this.state = 1588;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 1585;
				this.statement();
				}
				}
				this.state = 1590;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1591;
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
			this.state = 1593;
			this.match(SolidCashParser.T__100);
			this.state = 1594;
			this.match(SolidCashParser.T__39);
			this.state = 1595;
			this.expression(0);
			this.state = 1596;
			this.match(SolidCashParser.T__40);
			this.state = 1597;
			this.match(SolidCashParser.T__3);
			this.state = 1601;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===102) {
				{
				{
				this.state = 1598;
				this.switchCase();
				}
				}
				this.state = 1603;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1605;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===104) {
				{
				this.state = 1604;
				this.switchDefault();
				}
			}

			this.state = 1607;
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
			this.state = 1609;
			this.match(SolidCashParser.T__101);
			this.state = 1610;
			this.expression(0);
			this.state = 1611;
			this.match(SolidCashParser.T__102);
			this.state = 1615;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 1612;
				this.statement();
				}
				}
				this.state = 1617;
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
			this.state = 1618;
			this.match(SolidCashParser.T__103);
			this.state = 1619;
			this.match(SolidCashParser.T__102);
			this.state = 1623;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 1620;
				this.statement();
				}
				}
				this.state = 1625;
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
			this.state = 1626;
			this.match(SolidCashParser.T__104);
			this.state = 1627;
			this.expression(0);
			this.state = 1629;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===70) {
				{
				this.state = 1628;
				this.tryReturns();
				}
			}

			this.state = 1631;
			localctx._tryBlock = this.block();
			this.state = 1633;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1632;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1635;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 162, this._ctx);
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
			this.state = 1637;
			this.match(SolidCashParser.T__69);
			this.state = 1638;
			this.match(SolidCashParser.T__39);
			this.state = 1650;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
				{
				this.state = 1639;
				this.parameter();
				this.state = 1644;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 163, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1640;
						this.match(SolidCashParser.T__4);
						this.state = 1641;
						this.parameter();
						}
						}
					}
					this.state = 1646;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 163, this._ctx);
				}
				this.state = 1648;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1647;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1652;
			this.match(SolidCashParser.T__40);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1654;
			this.match(SolidCashParser.T__105);
			this.state = 1656;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 166, this._ctx) ) {
			case 1:
				{
				this.state = 1655;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 1673;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 170, this._ctx) ) {
			case 1:
				{
				this.state = 1658;
				this.match(SolidCashParser.T__39);
				this.state = 1670;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
					{
					this.state = 1659;
					this.parameter();
					this.state = 1664;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 167, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1660;
							this.match(SolidCashParser.T__4);
							this.state = 1661;
							this.parameter();
							}
							}
						}
						this.state = 1666;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 167, this._ctx);
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
				this.match(SolidCashParser.T__40);
				}
				break;
			}
			this.state = 1675;
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
			this.state = 1677;
			this.match(SolidCashParser.T__106);
			this.state = 1678;
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
			this.state = 1680;
			this.match(SolidCashParser.T__107);
			this.state = 1681;
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
			this.state = 1686;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 160:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1683;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 172:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1684;
				this.match(SolidCashParser.Identifier);
				this.state = 1685;
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
			this.state = 1730;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 177, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1688;
				this.match(SolidCashParser.T__108);
				this.state = 1689;
				this.match(SolidCashParser.Identifier);
				this.state = 1692;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1690;
					this.match(SolidCashParser.T__11);
					this.state = 1691;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1694;
				this.match(SolidCashParser.T__39);
				this.state = 1695;
				this.match(SolidCashParser.T__3);
				this.state = 1707;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 1696;
					this.namedArg();
					this.state = 1701;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 173, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1697;
							this.match(SolidCashParser.T__4);
							this.state = 1698;
							this.namedArg();
							}
							}
						}
						this.state = 1703;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 173, this._ctx);
					}
					this.state = 1705;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1704;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1709;
				this.match(SolidCashParser.T__5);
				this.state = 1710;
				this.match(SolidCashParser.T__40);
				this.state = 1711;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1712;
				this.match(SolidCashParser.T__108);
				this.state = 1713;
				this.match(SolidCashParser.Identifier);
				this.state = 1716;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1714;
					this.match(SolidCashParser.T__11);
					this.state = 1715;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1718;
				this.expressionList();
				this.state = 1719;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1721;
				this.match(SolidCashParser.T__108);
				this.state = 1722;
				this.match(SolidCashParser.T__39);
				this.state = 1723;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1724;
				this.match(SolidCashParser.T__40);
				this.state = 1725;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1726;
				this.match(SolidCashParser.T__108);
				this.state = 1727;
				this.match(SolidCashParser.T__39);
				this.state = 1728;
				this.match(SolidCashParser.T__40);
				this.state = 1729;
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
			this.state = 1732;
			this.match(SolidCashParser.T__109);
			this.state = 1733;
			this.match(SolidCashParser.T__39);
			this.state = 1734;
			this.expression(0);
			this.state = 1735;
			this.match(SolidCashParser.T__40);
			this.state = 1736;
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
			this.state = 1740;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 172:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1738;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 152:
			case 154:
			case 155:
			case 160:
			case 161:
			case 162:
			case 170:
			case 171:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1739;
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
			this.state = 1742;
			this.match(SolidCashParser.T__39);
			this.state = 1754;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 152)) & ~0x1F) === 0 && ((1 << (_la - 152)) & 1836813) !== 0)) {
				{
				this.state = 1743;
				this.consoleParameter();
				this.state = 1748;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 179, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1744;
						this.match(SolidCashParser.T__4);
						this.state = 1745;
						this.consoleParameter();
						}
						}
					}
					this.state = 1750;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 179, this._ctx);
				}
				this.state = 1752;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1751;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1756;
			this.match(SolidCashParser.T__40);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1782;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 185, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1758;
				this.match(SolidCashParser.Identifier);
				this.state = 1759;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1760;
				this.match(SolidCashParser.Identifier);
				this.state = 1761;
				this.match(SolidCashParser.T__11);
				this.state = 1762;
				this.match(SolidCashParser.Identifier);
				this.state = 1763;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1764;
				this.match(SolidCashParser.Identifier);
				this.state = 1765;
				this.match(SolidCashParser.T__39);
				this.state = 1766;
				this.match(SolidCashParser.T__3);
				this.state = 1778;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 1767;
					this.namedArg();
					this.state = 1772;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 182, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1768;
							this.match(SolidCashParser.T__4);
							this.state = 1769;
							this.namedArg();
							}
							}
						}
						this.state = 1774;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 182, this._ctx);
					}
					this.state = 1776;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1775;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1780;
				this.match(SolidCashParser.T__5);
				this.state = 1781;
				this.match(SolidCashParser.T__40);
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
			this.state = 1784;
			this.match(SolidCashParser.Identifier);
			this.state = 1785;
			this.match(SolidCashParser.T__102);
			this.state = 1786;
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
			this.state = 1788;
			this.match(SolidCashParser.T__39);
			this.state = 1800;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===14 || _la===27 || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 111)) & ~0x1F) === 0 && ((1 << (_la - 111)) & 33622015) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				this.state = 1789;
				this.expression(0);
				this.state = 1794;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 186, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1790;
						this.match(SolidCashParser.T__4);
						this.state = 1791;
						this.expression(0);
						}
						}
					}
					this.state = 1796;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 186, this._ctx);
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
			this.match(SolidCashParser.T__40);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1804;
			this.match(SolidCashParser.T__3);
			this.state = 1805;
			this.callOption();
			this.state = 1810;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 189, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1806;
					this.match(SolidCashParser.T__4);
					this.state = 1807;
					this.callOption();
					}
					}
				}
				this.state = 1812;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 189, this._ctx);
			}
			this.state = 1814;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1813;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1816;
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
			this.state = 1818;
			this.match(SolidCashParser.Identifier);
			this.state = 1819;
			this.match(SolidCashParser.T__102);
			this.state = 1820;
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
			this.state = 1822;
			this.match(SolidCashParser.T__39);
			this.state = 1823;
			this.typeName();
			this.state = 1828;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 191, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1824;
					this.match(SolidCashParser.T__4);
					this.state = 1825;
					this.typeName();
					}
					}
				}
				this.state = 1830;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 191, this._ctx);
			}
			this.state = 1832;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1831;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1834;
			this.match(SolidCashParser.T__40);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
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
			this.state = 1965;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 199, this._ctx) ) {
			case 1:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 1837;
				this.match(SolidCashParser.T__39);
				this.state = 1838;
				this.expression(0);
				this.state = 1839;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 2:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1841;
				this.typeCast();
				this.state = 1842;
				this.match(SolidCashParser.T__39);
				this.state = 1843;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 1845;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1844;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1847;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 3:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1849;
				this.functionCall();
				}
				break;
			case 4:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1850;
				this.match(SolidCashParser.T__110);
				this.state = 1851;
				this.match(SolidCashParser.Identifier);
				this.state = 1853;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1852;
					this.callOptions();
					}
				}

				this.state = 1855;
				this.expressionList();
				}
				break;
			case 5:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1856;
				this.match(SolidCashParser.T__110);
				this.state = 1857;
				this.typeName();
				this.state = 1858;
				this.match(SolidCashParser.T__57);
				this.state = 1859;
				this.match(SolidCashParser.T__58);
				this.state = 1860;
				this.match(SolidCashParser.T__39);
				this.state = 1861;
				this.expression(0);
				this.state = 1862;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 6:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1864;
				this.match(SolidCashParser.T__46);
				this.state = 1865;
				this.match(SolidCashParser.T__39);
				this.state = 1866;
				this.typeName();
				this.state = 1867;
				this.match(SolidCashParser.T__40);
				this.state = 1868;
				this.match(SolidCashParser.T__11);
				this.state = 1869;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 7:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1871;
				this.match(SolidCashParser.T__111);
				this.state = 1872;
				this.expressionList();
				}
				break;
			case 8:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1873;
				this.match(SolidCashParser.T__112);
				this.state = 1874;
				this.expressionList();
				}
				break;
			case 9:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1875;
				this.match(SolidCashParser.T__113);
				this.state = 1876;
				this.expressionList();
				}
				break;
			case 10:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1877;
				this.match(SolidCashParser.T__114);
				this.state = 1878;
				this.expressionList();
				}
				break;
			case 11:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1879;
				this.match(SolidCashParser.T__115);
				this.state = 1880;
				this.match(SolidCashParser.T__39);
				this.state = 1881;
				this.match(SolidCashParser.Identifier);
				this.state = 1882;
				this.match(SolidCashParser.T__11);
				this.state = 1883;
				this.match(SolidCashParser.Identifier);
				this.state = 1884;
				this.match(SolidCashParser.T__4);
				this.state = 1885;
				this.expressionList();
				this.state = 1886;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 12:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1888;
				this.match(SolidCashParser.T__116);
				this.state = 1889;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1890;
				this.match(SolidCashParser.T__117);
				this.state = 1891;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1892;
				this.match(SolidCashParser.T__118);
				this.state = 1893;
				this.match(SolidCashParser.T__39);
				this.state = 1894;
				this.expression(0);
				this.state = 1895;
				this.match(SolidCashParser.T__4);
				this.state = 1896;
				this.typeList();
				this.state = 1897;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 15:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1899;
				this.match(SolidCashParser.T__119);
				this.state = 1900;
				this.match(SolidCashParser.T__39);
				this.state = 1901;
				this.expression(0);
				this.state = 1902;
				this.match(SolidCashParser.T__4);
				this.state = 1903;
				this.typeList();
				this.state = 1904;
				this.match(SolidCashParser.T__4);
				this.state = 1905;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1906;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 16:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1908;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__120);
				this.state = 1909;
				this.match(SolidCashParser.T__57);
				this.state = 1910;
				this.expression(0);
				this.state = 1911;
				this.match(SolidCashParser.T__58);
				this.state = 1912;
				(localctx as UnaryIntrospectionOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 122)) & ~0x1F) === 0 && ((1 << (_la - 122)) & 31) !== 0))) {
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
				this.state = 1914;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__126);
				this.state = 1915;
				this.match(SolidCashParser.T__57);
				this.state = 1916;
				this.expression(0);
				this.state = 1917;
				this.match(SolidCashParser.T__58);
				this.state = 1918;
				(localctx as UnaryIntrospectionOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 122)) & ~0x1F) === 0 && ((1 << (_la - 122)) & 991) !== 0))) {
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
				this.state = 1920;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===136)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1921;
				this.expression(21);
				}
				break;
			case 19:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1922;
				this.match(SolidCashParser.T__57);
				this.state = 1934;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===14 || _la===27 || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 111)) & ~0x1F) === 0 && ((1 << (_la - 111)) & 33622015) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
					{
					this.state = 1923;
					this.expression(0);
					this.state = 1928;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 195, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1924;
							this.match(SolidCashParser.T__4);
							this.state = 1925;
							this.expression(0);
							}
							}
						}
						this.state = 1930;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 195, this._ctx);
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

					}
				}

				this.state = 1936;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 20:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1937;
				this.match(SolidCashParser.T__70);
				this.state = 1938;
				this.match(SolidCashParser.T__11);
				this.state = 1939;
				this.match(SolidCashParser.Identifier);
				this.state = 1940;
				this.match(SolidCashParser.T__11);
				this.state = 1941;
				this.match(SolidCashParser.Identifier);
				this.state = 1942;
				this.match(SolidCashParser.T__57);
				this.state = 1943;
				this.expression(0);
				this.state = 1944;
				this.match(SolidCashParser.T__58);
				this.state = 1945;
				this.memberName();
				}
				break;
			case 21:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1947;
				this.match(SolidCashParser.T__70);
				this.state = 1948;
				this.match(SolidCashParser.T__11);
				this.state = 1949;
				this.match(SolidCashParser.Identifier);
				this.state = 1954;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 1950;
						this.match(SolidCashParser.T__57);
						this.state = 1951;
						this.expression(0);
						this.state = 1952;
						this.match(SolidCashParser.T__58);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 1956;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 198, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 22:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1958;
				this.match(SolidCashParser.T__70);
				this.state = 1959;
				this.match(SolidCashParser.T__11);
				this.state = 1960;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 23:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1961;
				this.match(SolidCashParser.T__70);
				}
				break;
			case 24:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1962;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 25:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1963;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 26:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1964;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2072;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 206, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2070;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 205, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1967;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 1968;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 1969;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1970;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 1971;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1972;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1973;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 1974;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1975;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1976;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 1977;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===137 || _la===138)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1978;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1979;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 1980;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1981;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1982;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 1983;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1984;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1985;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 1986;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 1987;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1988;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 1989;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 1990;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1991;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 1992;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 1993;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1994;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 1995;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__138);
						this.state = 1996;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1997;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 1998;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__139);
						this.state = 1999;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2000;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 2001;
						this.match(SolidCashParser.T__140);
						this.state = 2002;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 2003;
						this.match(SolidCashParser.T__102);
						this.state = 2004;
						(localctx as TernaryOpContext)._ifFalse = this.expression(9);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2006;
						if (!(this.precpred(this._ctx, 32))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 32)");
						}
						this.state = 2007;
						this.match(SolidCashParser.T__57);
						this.state = 2008;
						(localctx as IndexRangeSliceContext)._start = this.expression(0);
						this.state = 2009;
						this.match(SolidCashParser.T__102);
						this.state = 2010;
						(localctx as IndexRangeSliceContext)._end = this.expression(0);
						this.state = 2011;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2013;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 2014;
						this.match(SolidCashParser.T__57);
						this.state = 2015;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2016;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2017;
						if (!(this.precpred(this._ctx, 30))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 30)");
						}
						this.state = 2018;
						this.match(SolidCashParser.T__57);
						this.state = 2019;
						this.expression(0);
						this.state = 2020;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2022;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2023;
						(localctx as UnaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===132 || _la===133)) {
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
						this.state = 2024;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2025;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__133);
						this.state = 2026;
						this.match(SolidCashParser.T__39);
						this.state = 2027;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2028;
						this.match(SolidCashParser.T__40);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2030;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2031;
						this.match(SolidCashParser.T__134);
						this.state = 2032;
						this.match(SolidCashParser.T__39);
						this.state = 2033;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2034;
						this.match(SolidCashParser.T__4);
						this.state = 2035;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2036;
						this.match(SolidCashParser.T__40);
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2038;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2039;
						this.match(SolidCashParser.T__11);
						this.state = 2040;
						this.match(SolidCashParser.Identifier);
						this.state = 2042;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2041;
							this.callOptions();
							}
						}

						this.state = 2044;
						this.match(SolidCashParser.T__39);
						this.state = 2045;
						this.match(SolidCashParser.T__3);
						this.state = 2057;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===172) {
							{
							this.state = 2046;
							this.namedArg();
							this.state = 2051;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 201, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2047;
									this.match(SolidCashParser.T__4);
									this.state = 2048;
									this.namedArg();
									}
									}
								}
								this.state = 2053;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 201, this._ctx);
							}
							this.state = 2055;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2054;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2059;
						this.match(SolidCashParser.T__5);
						this.state = 2060;
						this.match(SolidCashParser.T__40);
						}
						break;
					case 20:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2061;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2062;
						this.match(SolidCashParser.T__11);
						this.state = 2063;
						this.match(SolidCashParser.Identifier);
						this.state = 2065;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2064;
							this.callOptions();
							}
						}

						this.state = 2067;
						this.expressionList();
						}
						break;
					case 21:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2068;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 2069;
						this.memberName();
						}
						break;
					}
					}
				}
				this.state = 2074;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 206, this._ctx);
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
			this.state = 2088;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2075;
				this.match(SolidCashParser.T__11);
				this.state = 2076;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 122:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2077;
				this.match(SolidCashParser.T__121);
				}
				break;
			case 123:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2078;
				this.match(SolidCashParser.T__122);
				}
				break;
			case 124:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2079;
				this.match(SolidCashParser.T__123);
				}
				break;
			case 125:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2080;
				this.match(SolidCashParser.T__124);
				}
				break;
			case 126:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2081;
				this.match(SolidCashParser.T__125);
				}
				break;
			case 128:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2082;
				this.match(SolidCashParser.T__127);
				}
				break;
			case 129:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2083;
				this.match(SolidCashParser.T__128);
				}
				break;
			case 130:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2084;
				this.match(SolidCashParser.T__129);
				}
				break;
			case 131:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2085;
				this.match(SolidCashParser.T__130);
				}
				break;
			case 142:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2086;
				this.match(SolidCashParser.T__141);
				}
				break;
			case 143:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2087;
				this.match(SolidCashParser.T__142);
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
			this.state = 2090;
			_la = this._input.LA(1);
			if(!(_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0))) {
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
			this.state = 2106;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 152:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2092;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 155:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2093;
				this.numberLiteral();
				}
				break;
			case 154:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2094;
				this.decimalLiteral();
				}
				break;
			case 160:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2095;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2099;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 208, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2096;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2101;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 208, this._ctx);
				}
				}
				break;
			case 170:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2102;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 171:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2103;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2104;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2105;
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
			this.state = 2108;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2110;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 210, this._ctx) ) {
			case 1:
				{
				this.state = 2109;
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
			this.state = 2112;
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
			this.state = 2157;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 215, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2114;
				this.match(SolidCashParser.T__147);
				this.state = 2115;
				this.match(SolidCashParser.T__51);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2116;
				this.match(SolidCashParser.T__147);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2117;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2118;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2119;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2120;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2121;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2122;
				this.match(SolidCashParser.T__148);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2123;
				this.match(SolidCashParser.T__149);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2124;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2125;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2126;
				this.match(SolidCashParser.T__6);
				this.state = 2127;
				this.match(SolidCashParser.T__39);
				this.state = 2136;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
					{
					this.state = 2128;
					this.typeName();
					this.state = 2133;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2129;
						this.match(SolidCashParser.T__4);
						this.state = 2130;
						this.typeName();
						}
						}
						this.state = 2135;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2138;
				this.match(SolidCashParser.T__40);
				this.state = 2151;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===70) {
					{
					this.state = 2139;
					this.match(SolidCashParser.T__69);
					this.state = 2140;
					this.match(SolidCashParser.T__39);
					this.state = 2141;
					this.typeName();
					this.state = 2146;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2142;
						this.match(SolidCashParser.T__4);
						this.state = 2143;
						this.typeName();
						}
						}
						this.state = 2148;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2149;
					this.match(SolidCashParser.T__40);
					}
				}

				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2153;
				this.match(SolidCashParser.Identifier);
				this.state = 2154;
				this.match(SolidCashParser.T__11);
				this.state = 2155;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2156;
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
			this.state = 2159;
			_la = this._input.LA(1);
			if(!(_la===52 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 2033415) !== 0))) {
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

	public static readonly _serializedATN: number[] = [4,1,175,2162,2,0,7,0,
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
	3,1,3,1,3,1,3,5,3,308,8,3,10,3,12,3,311,9,3,1,3,3,3,314,8,3,1,3,1,3,5,3,
	318,8,3,10,3,12,3,321,9,3,1,3,1,3,1,4,1,4,1,4,1,4,1,4,3,4,330,8,4,1,4,3,
	4,333,8,4,1,4,1,4,1,4,1,4,1,4,1,4,5,4,341,8,4,10,4,12,4,344,9,4,1,4,3,4,
	347,8,4,1,4,1,4,1,4,1,4,3,4,353,8,4,1,4,3,4,356,8,4,1,4,1,4,3,4,360,8,4,
	1,5,1,5,1,5,3,5,365,8,5,1,5,1,5,3,5,369,8,5,1,6,1,6,1,7,1,7,1,7,1,7,1,7,
	1,8,1,8,1,9,1,9,3,9,382,8,9,1,10,3,10,385,8,10,1,10,1,10,1,11,1,11,1,12,
	1,12,1,12,1,12,1,12,1,12,5,12,397,8,12,10,12,12,12,400,9,12,3,12,402,8,
	12,1,12,1,12,5,12,406,8,12,10,12,12,12,409,9,12,1,12,5,12,412,8,12,10,12,
	12,12,415,9,12,1,12,5,12,418,8,12,10,12,12,12,421,9,12,1,12,5,12,424,8,
	12,10,12,12,12,427,9,12,1,12,5,12,430,8,12,10,12,12,12,433,9,12,1,12,5,
	12,436,8,12,10,12,12,12,439,9,12,1,12,5,12,442,8,12,10,12,12,12,445,9,12,
	1,12,1,12,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,3,13,459,8,
	13,1,14,1,14,1,14,1,14,1,14,1,15,1,15,1,16,1,16,1,16,1,16,5,16,472,8,16,
	10,16,12,16,475,9,16,1,16,3,16,478,8,16,1,16,1,16,1,17,1,17,1,17,1,17,5,
	17,486,8,17,10,17,12,17,489,9,17,1,17,5,17,492,8,17,10,17,12,17,495,9,17,
	1,17,5,17,498,8,17,10,17,12,17,501,9,17,1,17,5,17,504,8,17,10,17,12,17,
	507,9,17,1,17,5,17,510,8,17,10,17,12,17,513,9,17,1,17,5,17,516,8,17,10,
	17,12,17,519,9,17,1,17,5,17,522,8,17,10,17,12,17,525,9,17,1,17,5,17,528,
	8,17,10,17,12,17,531,9,17,1,17,1,17,1,18,3,18,536,8,18,1,18,1,18,1,18,3,
	18,541,8,18,1,18,1,18,1,18,1,18,5,18,547,8,18,10,18,12,18,550,9,18,3,18,
	552,8,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,
	18,1,18,1,18,5,18,569,8,18,10,18,12,18,572,9,18,1,18,1,18,1,19,1,19,1,19,
	1,19,5,19,580,8,19,10,19,12,19,583,9,19,1,19,5,19,586,8,19,10,19,12,19,
	589,9,19,1,19,3,19,592,8,19,1,19,1,19,1,20,1,20,1,20,1,20,1,20,1,20,5,20,
	602,8,20,10,20,12,20,605,9,20,1,20,3,20,608,8,20,3,20,610,8,20,1,20,1,20,
	3,20,614,8,20,1,20,1,20,1,21,1,21,3,21,620,8,21,1,21,1,21,1,22,1,22,1,22,
	1,22,1,22,1,22,5,22,630,8,22,10,22,12,22,633,9,22,1,22,3,22,636,8,22,3,
	22,638,8,22,1,22,1,22,1,22,1,23,1,23,1,23,1,24,1,24,1,24,1,24,4,24,650,
	8,24,11,24,12,24,651,1,24,1,24,1,25,1,25,1,25,1,25,1,26,1,26,1,26,1,26,
	1,26,1,26,5,26,666,8,26,10,26,12,26,669,9,26,1,26,3,26,672,8,26,1,26,1,
	26,1,27,1,27,1,27,3,27,679,8,27,1,28,1,28,1,28,1,28,1,28,1,28,1,29,1,29,
	1,29,1,29,1,29,1,29,1,29,1,30,1,30,1,30,3,30,697,8,30,1,30,5,30,700,8,30,
	10,30,12,30,703,9,30,1,30,1,30,5,30,707,8,30,10,30,12,30,710,9,30,1,30,
	1,30,1,31,1,31,1,31,1,31,5,31,718,8,31,10,31,12,31,721,9,31,1,31,5,31,724,
	8,31,10,31,12,31,727,9,31,1,31,1,31,5,31,731,8,31,10,31,12,31,734,9,31,
	1,31,1,31,1,32,1,32,1,32,3,32,741,8,32,1,33,1,33,1,33,1,33,1,33,1,33,1,
	33,5,33,750,8,33,10,33,12,33,753,9,33,1,33,1,33,1,34,1,34,1,34,1,35,3,35,
	761,8,35,1,35,1,35,5,35,765,8,35,10,35,12,35,768,9,35,1,35,1,35,1,35,1,
	35,1,35,1,35,5,35,776,8,35,10,35,12,35,779,9,35,1,35,1,35,1,35,1,35,3,35,
	785,8,35,1,35,1,35,5,35,789,8,35,10,35,12,35,792,9,35,1,35,1,35,1,35,1,
	35,3,35,798,8,35,1,35,1,35,5,35,802,8,35,10,35,12,35,805,9,35,1,35,1,35,
	1,35,3,35,810,8,35,1,36,1,36,3,36,814,8,36,1,37,1,37,1,38,1,38,1,38,1,38,
	3,38,822,8,38,1,38,1,38,1,38,3,38,827,8,38,1,38,1,38,1,38,1,38,1,38,1,38,
	3,38,835,8,38,1,38,1,38,1,38,1,38,1,38,1,38,1,38,1,38,3,38,845,8,38,1,38,
	1,38,1,38,3,38,850,8,38,1,38,1,38,3,38,854,8,38,1,39,1,39,1,39,1,39,1,39,
	1,39,1,39,1,39,1,39,1,39,3,39,866,8,39,1,39,1,39,1,39,1,39,1,39,1,39,1,
	39,5,39,875,8,39,10,39,12,39,878,9,39,1,40,1,40,1,40,3,40,883,8,40,1,40,
	1,40,5,40,887,8,40,10,40,12,40,890,9,40,1,40,1,40,1,41,1,41,3,41,896,8,
	41,1,42,1,42,1,42,1,43,1,43,1,43,1,43,5,43,905,8,43,10,43,12,43,908,9,43,
	1,43,5,43,911,8,43,10,43,12,43,914,9,43,1,43,3,43,917,8,43,1,43,1,43,5,
	43,921,8,43,10,43,12,43,924,9,43,1,43,1,43,1,44,1,44,3,44,930,8,44,1,45,
	1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,3,45,946,
	8,45,1,46,1,46,1,46,1,46,1,46,5,46,953,8,46,10,46,12,46,956,9,46,1,46,3,
	46,959,8,46,1,47,1,47,1,47,1,47,3,47,965,8,47,1,48,1,48,1,48,1,48,1,48,
	5,48,972,8,48,10,48,12,48,975,9,48,1,48,3,48,978,8,48,1,48,1,48,1,49,1,
	49,5,49,984,8,49,10,49,12,49,987,9,49,1,49,3,49,990,8,49,1,50,1,50,1,50,
	1,50,5,50,996,8,50,10,50,12,50,999,9,50,1,50,3,50,1002,8,50,3,50,1004,8,
	50,1,50,1,50,1,51,1,51,5,51,1010,8,51,10,51,12,51,1013,9,51,1,51,1,51,1,
	51,1,51,5,51,1019,8,51,10,51,12,51,1022,9,51,1,51,1,51,3,51,1026,8,51,1,
	52,1,52,5,52,1030,8,52,10,52,12,52,1033,9,52,1,52,1,52,3,52,1037,8,52,1,
	53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,
	1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,
	53,1,53,1,53,1,53,3,53,1072,8,53,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,
	1,54,1,54,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,5,
	55,1096,8,55,10,55,12,55,1099,9,55,1,55,1,55,1,55,1,56,1,56,1,56,1,56,1,
	56,1,56,5,56,1110,8,56,10,56,12,56,1113,9,56,1,56,1,56,1,56,1,56,1,56,1,
	56,1,56,5,56,1122,8,56,10,56,12,56,1125,9,56,1,56,3,56,1128,8,56,1,56,1,
	56,1,56,3,56,1133,8,56,1,57,1,57,1,57,3,57,1138,8,57,1,57,1,57,1,57,1,57,
	1,57,5,57,1145,8,57,10,57,12,57,1148,9,57,1,57,3,57,1151,8,57,3,57,1153,
	8,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,
	57,1,57,1,57,1,57,1,57,1,57,1,57,3,57,1175,8,57,1,57,1,57,1,57,3,57,1180,
	8,57,1,58,1,58,1,58,1,58,3,58,1186,8,58,1,58,1,58,1,58,1,59,1,59,1,59,1,
	59,3,59,1195,8,59,1,59,1,59,1,59,1,59,1,59,5,59,1202,8,59,10,59,12,59,1205,
	9,59,1,59,3,59,1208,8,59,3,59,1210,8,59,1,59,1,59,1,59,1,59,1,59,1,59,1,
	59,3,59,1219,8,59,1,59,1,59,1,59,3,59,1224,8,59,1,60,1,60,1,60,1,60,1,60,
	1,60,1,60,4,60,1233,8,60,11,60,12,60,1234,1,60,1,60,1,60,1,60,1,61,1,61,
	1,61,1,61,1,61,1,61,1,61,4,61,1248,8,61,11,61,12,61,1249,1,61,1,61,1,61,
	1,61,1,61,1,61,1,62,1,62,1,62,1,62,1,62,1,62,1,62,5,62,1265,8,62,10,62,
	12,62,1268,9,62,1,62,1,62,1,62,1,62,1,62,1,62,1,63,1,63,1,63,1,63,1,63,
	1,63,1,63,1,64,1,64,5,64,1285,8,64,10,64,12,64,1288,9,64,1,64,1,64,1,64,
	3,64,1293,8,64,1,64,1,64,1,64,1,64,5,64,1299,8,64,10,64,12,64,1302,9,64,
	1,64,1,64,1,64,1,64,1,64,3,64,1309,8,64,1,65,1,65,1,65,1,65,1,65,1,65,4,
	65,1317,8,65,11,65,12,65,1318,1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,65,4,
	65,1329,8,65,11,65,12,65,1330,1,65,1,65,1,65,1,65,1,65,1,65,4,65,1339,8,
	65,11,65,12,65,1340,1,65,1,65,1,65,1,65,1,65,1,65,1,65,4,65,1350,8,65,11,
	65,12,65,1351,1,65,1,65,1,65,1,65,1,65,3,65,1359,8,65,1,66,1,66,1,66,1,
	66,1,66,3,66,1366,8,66,1,67,1,67,1,67,1,67,1,67,1,67,1,67,1,67,3,67,1376,
	8,67,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,69,1,69,1,69,1,69,1,69,1,69,1,
	70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,71,1,71,1,71,1,71,1,71,1,71,1,71,
	1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,73,1,73,1,73,1,73,1,73,1,
	73,1,73,1,73,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,
	1,74,1,74,1,74,1,74,4,74,1439,8,74,11,74,12,74,1440,1,74,1,74,3,74,1445,
	8,74,1,75,1,75,1,75,1,75,1,75,1,75,1,75,3,75,1454,8,75,1,75,1,75,1,75,1,
	76,1,76,1,76,1,76,1,76,3,76,1464,8,76,1,76,1,76,1,76,1,77,1,77,1,77,1,77,
	1,77,1,77,1,77,3,77,1476,8,77,1,78,1,78,1,78,1,78,1,78,1,78,3,78,1484,8,
	78,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,
	1,79,1,79,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,81,1,
	81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,82,1,82,1,82,1,82,1,82,
	1,82,1,82,1,82,1,83,1,83,5,83,1534,8,83,10,83,12,83,1537,9,83,1,83,1,83,
	1,83,1,83,1,83,1,84,1,84,1,84,1,85,1,85,1,85,1,85,1,85,3,85,1552,8,85,1,
	86,1,86,1,86,1,86,1,86,1,86,1,86,1,86,1,87,1,87,1,87,1,87,1,87,1,87,1,88,
	1,88,1,88,1,88,1,89,1,89,1,89,5,89,1575,8,89,10,89,12,89,1578,9,89,1,89,
	1,89,1,90,1,90,1,91,1,91,1,91,5,91,1587,8,91,10,91,12,91,1590,9,91,1,91,
	1,91,1,92,1,92,1,92,1,92,1,92,1,92,5,92,1600,8,92,10,92,12,92,1603,9,92,
	1,92,3,92,1606,8,92,1,92,1,92,1,93,1,93,1,93,1,93,5,93,1614,8,93,10,93,
	12,93,1617,9,93,1,94,1,94,1,94,5,94,1622,8,94,10,94,12,94,1625,9,94,1,95,
	1,95,1,95,3,95,1630,8,95,1,95,1,95,4,95,1634,8,95,11,95,12,95,1635,1,96,
	1,96,1,96,1,96,1,96,5,96,1643,8,96,10,96,12,96,1646,9,96,1,96,3,96,1649,
	8,96,3,96,1651,8,96,1,96,1,96,1,97,1,97,3,97,1657,8,97,1,97,1,97,1,97,1,
	97,5,97,1663,8,97,10,97,12,97,1666,9,97,1,97,3,97,1669,8,97,3,97,1671,8,
	97,1,97,3,97,1674,8,97,1,97,1,97,1,98,1,98,1,98,1,99,1,99,1,99,1,100,1,
	100,1,100,3,100,1687,8,100,1,101,1,101,1,101,1,101,3,101,1693,8,101,1,101,
	1,101,1,101,1,101,1,101,5,101,1700,8,101,10,101,12,101,1703,9,101,1,101,
	3,101,1706,8,101,3,101,1708,8,101,1,101,1,101,1,101,1,101,1,101,1,101,1,
	101,3,101,1717,8,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,
	101,1,101,1,101,1,101,3,101,1731,8,101,1,102,1,102,1,102,1,102,1,102,1,
	102,1,103,1,103,3,103,1741,8,103,1,104,1,104,1,104,1,104,5,104,1747,8,104,
	10,104,12,104,1750,9,104,1,104,3,104,1753,8,104,3,104,1755,8,104,1,104,
	1,104,1,105,1,105,1,105,1,105,1,105,1,105,1,105,1,105,1,105,1,105,1,105,
	1,105,5,105,1771,8,105,10,105,12,105,1774,9,105,1,105,3,105,1777,8,105,
	3,105,1779,8,105,1,105,1,105,3,105,1783,8,105,1,106,1,106,1,106,1,106,1,
	107,1,107,1,107,1,107,5,107,1793,8,107,10,107,12,107,1796,9,107,1,107,3,
	107,1799,8,107,3,107,1801,8,107,1,107,1,107,1,108,1,108,1,108,1,108,5,108,
	1809,8,108,10,108,12,108,1812,9,108,1,108,3,108,1815,8,108,1,108,1,108,
	1,109,1,109,1,109,1,109,1,110,1,110,1,110,1,110,5,110,1827,8,110,10,110,
	12,110,1830,9,110,1,110,3,110,1833,8,110,1,110,1,110,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,3,111,1846,8,111,1,111,1,111,1,111,
	1,111,1,111,1,111,3,111,1854,8,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,5,111,1927,8,111,10,111,12,111,1930,9,111,
	1,111,3,111,1933,8,111,3,111,1935,8,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,4,111,1955,8,111,11,111,12,111,1956,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,3,111,1966,8,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,3,111,2043,8,111,1,111,1,
	111,1,111,1,111,1,111,5,111,2050,8,111,10,111,12,111,2053,9,111,1,111,3,
	111,2056,8,111,3,111,2058,8,111,1,111,1,111,1,111,1,111,1,111,1,111,3,111,
	2066,8,111,1,111,1,111,1,111,5,111,2071,8,111,10,111,12,111,2074,9,111,
	1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,
	1,112,3,112,2089,8,112,1,113,1,113,1,114,1,114,1,114,1,114,1,114,5,114,
	2098,8,114,10,114,12,114,2101,9,114,1,114,1,114,1,114,1,114,3,114,2107,
	8,114,1,115,1,115,3,115,2111,8,115,1,116,1,116,1,117,1,117,1,117,1,117,
	1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,
	1,117,5,117,2132,8,117,10,117,12,117,2135,9,117,3,117,2137,8,117,1,117,
	1,117,1,117,1,117,1,117,1,117,5,117,2145,8,117,10,117,12,117,2148,9,117,
	1,117,1,117,3,117,2152,8,117,1,117,1,117,1,117,1,117,3,117,2158,8,117,1,
	118,1,118,1,118,0,2,78,222,119,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,
	30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,
	78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,110,112,114,116,118,
	120,122,124,126,128,130,132,134,136,138,140,142,144,146,148,150,152,154,
	156,158,160,162,164,166,168,170,172,174,176,178,180,182,184,186,188,190,
	192,194,196,198,200,202,204,206,208,210,212,214,216,218,220,222,224,226,
	228,230,232,234,236,0,20,2,0,10,10,13,27,1,0,29,30,3,0,20,23,26,27,31,31,
	1,0,34,35,2,0,34,35,50,50,3,0,34,35,50,50,55,55,2,0,31,31,74,83,1,0,85,
	86,3,0,155,155,162,162,172,172,1,0,122,126,2,0,122,126,128,131,3,0,14,14,
	27,27,136,136,2,0,10,10,15,16,1,0,13,14,1,0,137,138,1,0,20,23,1,0,18,19,
	1,0,132,133,2,0,48,48,144,147,4,0,52,52,148,150,156,158,164,168,2410,0,
	241,1,0,0,0,2,296,1,0,0,0,4,298,1,0,0,0,6,303,1,0,0,0,8,359,1,0,0,0,10,
	361,1,0,0,0,12,370,1,0,0,0,14,372,1,0,0,0,16,377,1,0,0,0,18,379,1,0,0,0,
	20,384,1,0,0,0,22,388,1,0,0,0,24,390,1,0,0,0,26,458,1,0,0,0,28,460,1,0,
	0,0,30,465,1,0,0,0,32,467,1,0,0,0,34,481,1,0,0,0,36,535,1,0,0,0,38,575,
	1,0,0,0,40,595,1,0,0,0,42,617,1,0,0,0,44,623,1,0,0,0,46,642,1,0,0,0,48,
	645,1,0,0,0,50,655,1,0,0,0,52,659,1,0,0,0,54,675,1,0,0,0,56,680,1,0,0,0,
	58,686,1,0,0,0,60,693,1,0,0,0,62,713,1,0,0,0,64,740,1,0,0,0,66,742,1,0,
	0,0,68,756,1,0,0,0,70,809,1,0,0,0,72,813,1,0,0,0,74,815,1,0,0,0,76,853,
	1,0,0,0,78,865,1,0,0,0,80,879,1,0,0,0,82,895,1,0,0,0,84,897,1,0,0,0,86,
	900,1,0,0,0,88,927,1,0,0,0,90,945,1,0,0,0,92,947,1,0,0,0,94,960,1,0,0,0,
	96,966,1,0,0,0,98,981,1,0,0,0,100,991,1,0,0,0,102,1025,1,0,0,0,104,1036,
	1,0,0,0,106,1071,1,0,0,0,108,1073,1,0,0,0,110,1083,1,0,0,0,112,1132,1,0,
	0,0,114,1179,1,0,0,0,116,1181,1,0,0,0,118,1223,1,0,0,0,120,1225,1,0,0,0,
	122,1240,1,0,0,0,124,1257,1,0,0,0,126,1275,1,0,0,0,128,1308,1,0,0,0,130,
	1358,1,0,0,0,132,1365,1,0,0,0,134,1375,1,0,0,0,136,1377,1,0,0,0,138,1384,
	1,0,0,0,140,1390,1,0,0,0,142,1398,1,0,0,0,144,1405,1,0,0,0,146,1414,1,0,
	0,0,148,1444,1,0,0,0,150,1446,1,0,0,0,152,1458,1,0,0,0,154,1468,1,0,0,0,
	156,1483,1,0,0,0,158,1485,1,0,0,0,160,1501,1,0,0,0,162,1512,1,0,0,0,164,
	1523,1,0,0,0,166,1531,1,0,0,0,168,1543,1,0,0,0,170,1551,1,0,0,0,172,1553,
	1,0,0,0,174,1561,1,0,0,0,176,1567,1,0,0,0,178,1571,1,0,0,0,180,1581,1,0,
	0,0,182,1583,1,0,0,0,184,1593,1,0,0,0,186,1609,1,0,0,0,188,1618,1,0,0,0,
	190,1626,1,0,0,0,192,1637,1,0,0,0,194,1654,1,0,0,0,196,1677,1,0,0,0,198,
	1680,1,0,0,0,200,1686,1,0,0,0,202,1730,1,0,0,0,204,1732,1,0,0,0,206,1740,
	1,0,0,0,208,1742,1,0,0,0,210,1782,1,0,0,0,212,1784,1,0,0,0,214,1788,1,0,
	0,0,216,1804,1,0,0,0,218,1818,1,0,0,0,220,1822,1,0,0,0,222,1965,1,0,0,0,
	224,2088,1,0,0,0,226,2090,1,0,0,0,228,2106,1,0,0,0,230,2108,1,0,0,0,232,
	2112,1,0,0,0,234,2157,1,0,0,0,236,2159,1,0,0,0,238,240,3,14,7,0,239,238,
	1,0,0,0,240,243,1,0,0,0,241,239,1,0,0,0,241,242,1,0,0,0,242,247,1,0,0,0,
	243,241,1,0,0,0,244,246,3,2,1,0,245,244,1,0,0,0,246,249,1,0,0,0,247,245,
	1,0,0,0,247,248,1,0,0,0,248,261,1,0,0,0,249,247,1,0,0,0,250,260,3,58,29,
	0,251,260,3,52,26,0,252,260,3,48,24,0,253,260,3,56,28,0,254,260,3,8,4,0,
	255,260,3,44,22,0,256,260,3,24,12,0,257,260,3,6,3,0,258,260,3,34,17,0,259,
	250,1,0,0,0,259,251,1,0,0,0,259,252,1,0,0,0,259,253,1,0,0,0,259,254,1,0,
	0,0,259,255,1,0,0,0,259,256,1,0,0,0,259,257,1,0,0,0,259,258,1,0,0,0,260,
	263,1,0,0,0,261,259,1,0,0,0,261,262,1,0,0,0,262,266,1,0,0,0,263,261,1,0,
	0,0,264,267,3,36,18,0,265,267,3,34,17,0,266,264,1,0,0,0,266,265,1,0,0,0,
	266,267,1,0,0,0,267,268,1,0,0,0,268,269,5,0,0,1,269,1,1,0,0,0,270,271,5,
	1,0,0,271,272,5,160,0,0,272,297,5,2,0,0,273,274,5,1,0,0,274,275,5,160,0,
	0,275,276,5,3,0,0,276,277,5,172,0,0,277,297,5,2,0,0,278,279,5,1,0,0,279,
	280,5,4,0,0,280,285,3,4,2,0,281,282,5,5,0,0,282,284,3,4,2,0,283,281,1,0,
	0,0,284,287,1,0,0,0,285,283,1,0,0,0,285,286,1,0,0,0,286,289,1,0,0,0,287,
	285,1,0,0,0,288,290,5,5,0,0,289,288,1,0,0,0,289,290,1,0,0,0,290,291,1,0,
	0,0,291,292,5,6,0,0,292,293,5,172,0,0,293,294,5,160,0,0,294,295,5,2,0,0,
	295,297,1,0,0,0,296,270,1,0,0,0,296,273,1,0,0,0,296,278,1,0,0,0,297,3,1,
	0,0,0,298,301,5,172,0,0,299,300,5,3,0,0,300,302,5,172,0,0,301,299,1,0,0,
	0,301,302,1,0,0,0,302,5,1,0,0,0,303,304,5,7,0,0,304,305,5,172,0,0,305,309,
	3,100,50,0,306,308,3,90,45,0,307,306,1,0,0,0,308,311,1,0,0,0,309,307,1,
	0,0,0,309,310,1,0,0,0,310,313,1,0,0,0,311,309,1,0,0,0,312,314,3,96,48,0,
	313,312,1,0,0,0,313,314,1,0,0,0,314,315,1,0,0,0,315,319,5,4,0,0,316,318,
	3,106,53,0,317,316,1,0,0,0,318,321,1,0,0,0,319,317,1,0,0,0,319,320,1,0,
	0,0,320,322,1,0,0,0,321,319,1,0,0,0,322,323,5,6,0,0,323,7,1,0,0,0,324,325,
	5,8,0,0,325,326,5,172,0,0,326,329,5,9,0,0,327,330,3,234,117,0,328,330,5,
	10,0,0,329,327,1,0,0,0,329,328,1,0,0,0,330,332,1,0,0,0,331,333,5,11,0,0,
	332,331,1,0,0,0,332,333,1,0,0,0,333,334,1,0,0,0,334,360,5,2,0,0,335,336,
	5,8,0,0,336,337,5,4,0,0,337,342,3,10,5,0,338,339,5,5,0,0,339,341,3,10,5,
	0,340,338,1,0,0,0,341,344,1,0,0,0,342,340,1,0,0,0,342,343,1,0,0,0,343,346,
	1,0,0,0,344,342,1,0,0,0,345,347,5,5,0,0,346,345,1,0,0,0,346,347,1,0,0,0,
	347,348,1,0,0,0,348,349,5,6,0,0,349,352,5,9,0,0,350,353,3,234,117,0,351,
	353,5,10,0,0,352,350,1,0,0,0,352,351,1,0,0,0,353,355,1,0,0,0,354,356,5,
	11,0,0,355,354,1,0,0,0,355,356,1,0,0,0,356,357,1,0,0,0,357,358,5,2,0,0,
	358,360,1,0,0,0,359,324,1,0,0,0,359,335,1,0,0,0,360,9,1,0,0,0,361,364,5,
	172,0,0,362,363,5,12,0,0,363,365,5,172,0,0,364,362,1,0,0,0,364,365,1,0,
	0,0,365,368,1,0,0,0,366,367,5,3,0,0,367,369,3,12,6,0,368,366,1,0,0,0,368,
	369,1,0,0,0,369,11,1,0,0,0,370,371,7,0,0,0,371,13,1,0,0,0,372,373,5,28,
	0,0,373,374,3,16,8,0,374,375,3,18,9,0,375,376,5,2,0,0,376,15,1,0,0,0,377,
	378,7,1,0,0,378,17,1,0,0,0,379,381,3,20,10,0,380,382,3,20,10,0,381,380,
	1,0,0,0,381,382,1,0,0,0,382,19,1,0,0,0,383,385,3,22,11,0,384,383,1,0,0,
	0,384,385,1,0,0,0,385,386,1,0,0,0,386,387,5,151,0,0,387,21,1,0,0,0,388,
	389,7,2,0,0,389,23,1,0,0,0,390,391,5,32,0,0,391,401,5,172,0,0,392,393,5,
	33,0,0,393,398,5,172,0,0,394,395,5,5,0,0,395,397,5,172,0,0,396,394,1,0,
	0,0,397,400,1,0,0,0,398,396,1,0,0,0,398,399,1,0,0,0,399,402,1,0,0,0,400,
	398,1,0,0,0,401,392,1,0,0,0,401,402,1,0,0,0,402,403,1,0,0,0,403,407,5,4,
	0,0,404,406,3,52,26,0,405,404,1,0,0,0,406,409,1,0,0,0,407,405,1,0,0,0,407,
	408,1,0,0,0,408,413,1,0,0,0,409,407,1,0,0,0,410,412,3,48,24,0,411,410,1,
	0,0,0,412,415,1,0,0,0,413,411,1,0,0,0,413,414,1,0,0,0,414,419,1,0,0,0,415,
	413,1,0,0,0,416,418,3,56,28,0,417,416,1,0,0,0,418,421,1,0,0,0,419,417,1,
	0,0,0,419,420,1,0,0,0,420,425,1,0,0,0,421,419,1,0,0,0,422,424,3,40,20,0,
	423,422,1,0,0,0,424,427,1,0,0,0,425,423,1,0,0,0,425,426,1,0,0,0,426,431,
	1,0,0,0,427,425,1,0,0,0,428,430,3,28,14,0,429,428,1,0,0,0,430,433,1,0,0,
	0,431,429,1,0,0,0,431,432,1,0,0,0,432,437,1,0,0,0,433,431,1,0,0,0,434,436,
	3,26,13,0,435,434,1,0,0,0,436,439,1,0,0,0,437,435,1,0,0,0,437,438,1,0,0,
	0,438,443,1,0,0,0,439,437,1,0,0,0,440,442,3,32,16,0,441,440,1,0,0,0,442,
	445,1,0,0,0,443,441,1,0,0,0,443,444,1,0,0,0,444,446,1,0,0,0,445,443,1,0,
	0,0,446,447,5,6,0,0,447,25,1,0,0,0,448,449,3,30,15,0,449,450,3,76,38,0,
	450,451,5,172,0,0,451,452,5,2,0,0,452,459,1,0,0,0,453,454,3,30,15,0,454,
	455,3,78,39,0,455,456,5,172,0,0,456,457,5,2,0,0,457,459,1,0,0,0,458,448,
	1,0,0,0,458,453,1,0,0,0,459,27,1,0,0,0,460,461,3,30,15,0,461,462,3,234,
	117,0,462,463,5,172,0,0,463,464,5,2,0,0,464,29,1,0,0,0,465,466,7,3,0,0,
	466,31,1,0,0,0,467,468,5,7,0,0,468,469,5,172,0,0,469,473,3,100,50,0,470,
	472,3,90,45,0,471,470,1,0,0,0,472,475,1,0,0,0,473,471,1,0,0,0,473,474,1,
	0,0,0,474,477,1,0,0,0,475,473,1,0,0,0,476,478,3,96,48,0,477,476,1,0,0,0,
	477,478,1,0,0,0,478,479,1,0,0,0,479,480,5,2,0,0,480,33,1,0,0,0,481,482,
	5,36,0,0,482,483,5,172,0,0,483,487,5,4,0,0,484,486,3,52,26,0,485,484,1,
	0,0,0,486,489,1,0,0,0,487,485,1,0,0,0,487,488,1,0,0,0,488,493,1,0,0,0,489,
	487,1,0,0,0,490,492,3,48,24,0,491,490,1,0,0,0,492,495,1,0,0,0,493,491,1,
	0,0,0,493,494,1,0,0,0,494,499,1,0,0,0,495,493,1,0,0,0,496,498,3,56,28,0,
	497,496,1,0,0,0,498,501,1,0,0,0,499,497,1,0,0,0,499,500,1,0,0,0,500,505,
	1,0,0,0,501,499,1,0,0,0,502,504,3,40,20,0,503,502,1,0,0,0,504,507,1,0,0,
	0,505,503,1,0,0,0,505,506,1,0,0,0,506,511,1,0,0,0,507,505,1,0,0,0,508,510,
	3,44,22,0,509,508,1,0,0,0,510,513,1,0,0,0,511,509,1,0,0,0,511,512,1,0,0,
	0,512,517,1,0,0,0,513,511,1,0,0,0,514,516,3,58,29,0,515,514,1,0,0,0,516,
	519,1,0,0,0,517,515,1,0,0,0,517,518,1,0,0,0,518,523,1,0,0,0,519,517,1,0,
	0,0,520,522,3,8,4,0,521,520,1,0,0,0,522,525,1,0,0,0,523,521,1,0,0,0,523,
	524,1,0,0,0,524,529,1,0,0,0,525,523,1,0,0,0,526,528,3,6,3,0,527,526,1,0,
	0,0,528,531,1,0,0,0,529,527,1,0,0,0,529,530,1,0,0,0,530,532,1,0,0,0,531,
	529,1,0,0,0,532,533,5,6,0,0,533,35,1,0,0,0,534,536,5,37,0,0,535,534,1,0,
	0,0,535,536,1,0,0,0,536,537,1,0,0,0,537,538,5,38,0,0,538,540,5,172,0,0,
	539,541,3,100,50,0,540,539,1,0,0,0,540,541,1,0,0,0,541,551,1,0,0,0,542,
	543,5,33,0,0,543,548,5,172,0,0,544,545,5,5,0,0,545,547,5,172,0,0,546,544,
	1,0,0,0,547,550,1,0,0,0,548,546,1,0,0,0,548,549,1,0,0,0,549,552,1,0,0,0,
	550,548,1,0,0,0,551,542,1,0,0,0,551,552,1,0,0,0,552,553,1,0,0,0,553,570,
	5,4,0,0,554,569,3,52,26,0,555,569,3,48,24,0,556,569,3,56,28,0,557,569,3,
	40,20,0,558,569,3,44,22,0,559,569,3,58,29,0,560,569,3,8,4,0,561,569,3,70,
	35,0,562,569,3,80,40,0,563,569,3,60,30,0,564,569,3,86,43,0,565,569,3,38,
	19,0,566,569,3,62,31,0,567,569,3,66,33,0,568,554,1,0,0,0,568,555,1,0,0,
	0,568,556,1,0,0,0,568,557,1,0,0,0,568,558,1,0,0,0,568,559,1,0,0,0,568,560,
	1,0,0,0,568,561,1,0,0,0,568,562,1,0,0,0,568,563,1,0,0,0,568,564,1,0,0,0,
	568,565,1,0,0,0,568,566,1,0,0,0,568,567,1,0,0,0,569,572,1,0,0,0,570,568,
	1,0,0,0,570,571,1,0,0,0,571,573,1,0,0,0,572,570,1,0,0,0,573,574,5,6,0,0,
	574,37,1,0,0,0,575,576,5,7,0,0,576,577,5,172,0,0,577,581,3,100,50,0,578,
	580,3,90,45,0,579,578,1,0,0,0,580,583,1,0,0,0,581,579,1,0,0,0,581,582,1,
	0,0,0,582,587,1,0,0,0,583,581,1,0,0,0,584,586,3,88,44,0,585,584,1,0,0,0,
	586,589,1,0,0,0,587,585,1,0,0,0,587,588,1,0,0,0,588,591,1,0,0,0,589,587,
	1,0,0,0,590,592,3,96,48,0,591,590,1,0,0,0,591,592,1,0,0,0,592,593,1,0,0,
	0,593,594,5,2,0,0,594,39,1,0,0,0,595,596,5,39,0,0,596,597,5,172,0,0,597,
	609,5,40,0,0,598,603,3,42,21,0,599,600,5,5,0,0,600,602,3,42,21,0,601,599,
	1,0,0,0,602,605,1,0,0,0,603,601,1,0,0,0,603,604,1,0,0,0,604,607,1,0,0,0,
	605,603,1,0,0,0,606,608,5,5,0,0,607,606,1,0,0,0,607,608,1,0,0,0,608,610,
	1,0,0,0,609,598,1,0,0,0,609,610,1,0,0,0,610,611,1,0,0,0,611,613,5,41,0,
	0,612,614,5,42,0,0,613,612,1,0,0,0,613,614,1,0,0,0,614,615,1,0,0,0,615,
	616,5,2,0,0,616,41,1,0,0,0,617,619,3,234,117,0,618,620,5,43,0,0,619,618,
	1,0,0,0,619,620,1,0,0,0,620,621,1,0,0,0,621,622,5,172,0,0,622,43,1,0,0,
	0,623,624,5,44,0,0,624,625,5,172,0,0,625,637,5,40,0,0,626,631,3,46,23,0,
	627,628,5,5,0,0,628,630,3,46,23,0,629,627,1,0,0,0,630,633,1,0,0,0,631,629,
	1,0,0,0,631,632,1,0,0,0,632,635,1,0,0,0,633,631,1,0,0,0,634,636,5,5,0,0,
	635,634,1,0,0,0,635,636,1,0,0,0,636,638,1,0,0,0,637,626,1,0,0,0,637,638,
	1,0,0,0,638,639,1,0,0,0,639,640,5,41,0,0,640,641,5,2,0,0,641,45,1,0,0,0,
	642,643,3,234,117,0,643,644,5,172,0,0,644,47,1,0,0,0,645,646,5,45,0,0,646,
	647,5,172,0,0,647,649,5,4,0,0,648,650,3,50,25,0,649,648,1,0,0,0,650,651,
	1,0,0,0,651,649,1,0,0,0,651,652,1,0,0,0,652,653,1,0,0,0,653,654,5,6,0,0,
	654,49,1,0,0,0,655,656,3,234,117,0,656,657,5,172,0,0,657,658,5,2,0,0,658,
	51,1,0,0,0,659,660,5,46,0,0,660,661,5,172,0,0,661,662,5,4,0,0,662,667,3,
	54,27,0,663,664,5,5,0,0,664,666,3,54,27,0,665,663,1,0,0,0,666,669,1,0,0,
	0,667,665,1,0,0,0,667,668,1,0,0,0,668,671,1,0,0,0,669,667,1,0,0,0,670,672,
	5,5,0,0,671,670,1,0,0,0,671,672,1,0,0,0,672,673,1,0,0,0,673,674,5,6,0,0,
	674,53,1,0,0,0,675,678,5,172,0,0,676,677,5,31,0,0,677,679,5,155,0,0,678,
	676,1,0,0,0,678,679,1,0,0,0,679,55,1,0,0,0,680,681,5,47,0,0,681,682,5,172,
	0,0,682,683,5,33,0,0,683,684,3,234,117,0,684,685,5,2,0,0,685,57,1,0,0,0,
	686,687,3,234,117,0,687,688,5,48,0,0,688,689,5,172,0,0,689,690,5,31,0,0,
	690,691,3,222,111,0,691,692,5,2,0,0,692,59,1,0,0,0,693,694,5,49,0,0,694,
	696,3,100,50,0,695,697,7,4,0,0,696,695,1,0,0,0,696,697,1,0,0,0,697,701,
	1,0,0,0,698,700,3,68,34,0,699,698,1,0,0,0,700,703,1,0,0,0,701,699,1,0,0,
	0,701,702,1,0,0,0,702,704,1,0,0,0,703,701,1,0,0,0,704,708,5,4,0,0,705,707,
	3,106,53,0,706,705,1,0,0,0,707,710,1,0,0,0,708,706,1,0,0,0,708,709,1,0,
	0,0,709,711,1,0,0,0,710,708,1,0,0,0,711,712,5,6,0,0,712,61,1,0,0,0,713,
	714,5,51,0,0,714,715,3,100,50,0,715,719,5,35,0,0,716,718,3,64,32,0,717,
	716,1,0,0,0,718,721,1,0,0,0,719,717,1,0,0,0,719,720,1,0,0,0,720,725,1,0,
	0,0,721,719,1,0,0,0,722,724,3,88,44,0,723,722,1,0,0,0,724,727,1,0,0,0,725,
	723,1,0,0,0,725,726,1,0,0,0,726,728,1,0,0,0,727,725,1,0,0,0,728,732,5,4,
	0,0,729,731,3,106,53,0,730,729,1,0,0,0,731,734,1,0,0,0,732,730,1,0,0,0,
	732,733,1,0,0,0,733,735,1,0,0,0,734,732,1,0,0,0,735,736,5,6,0,0,736,63,
	1,0,0,0,737,741,5,52,0,0,738,741,5,53,0,0,739,741,3,92,46,0,740,737,1,0,
	0,0,740,738,1,0,0,0,740,739,1,0,0,0,741,65,1,0,0,0,742,743,5,54,0,0,743,
	744,5,40,0,0,744,745,5,41,0,0,745,746,5,35,0,0,746,747,5,52,0,0,747,751,
	5,4,0,0,748,750,3,106,53,0,749,748,1,0,0,0,750,753,1,0,0,0,751,749,1,0,
	0,0,751,752,1,0,0,0,752,754,1,0,0,0,753,751,1,0,0,0,754,755,5,6,0,0,755,
	67,1,0,0,0,756,757,5,172,0,0,757,758,3,214,107,0,758,69,1,0,0,0,759,761,
	3,74,37,0,760,759,1,0,0,0,760,761,1,0,0,0,761,762,1,0,0,0,762,766,3,234,
	117,0,763,765,3,226,113,0,764,763,1,0,0,0,765,768,1,0,0,0,766,764,1,0,0,
	0,766,767,1,0,0,0,767,769,1,0,0,0,768,766,1,0,0,0,769,770,5,172,0,0,770,
	771,5,2,0,0,771,810,1,0,0,0,772,773,3,234,117,0,773,777,3,74,37,0,774,776,
	3,226,113,0,775,774,1,0,0,0,776,779,1,0,0,0,777,775,1,0,0,0,777,778,1,0,
	0,0,778,780,1,0,0,0,779,777,1,0,0,0,780,781,5,172,0,0,781,782,5,2,0,0,782,
	810,1,0,0,0,783,785,3,74,37,0,784,783,1,0,0,0,784,785,1,0,0,0,785,786,1,
	0,0,0,786,790,3,76,38,0,787,789,3,72,36,0,788,787,1,0,0,0,789,792,1,0,0,
	0,790,788,1,0,0,0,790,791,1,0,0,0,791,793,1,0,0,0,792,790,1,0,0,0,793,794,
	5,172,0,0,794,795,5,2,0,0,795,810,1,0,0,0,796,798,3,74,37,0,797,796,1,0,
	0,0,797,798,1,0,0,0,798,799,1,0,0,0,799,803,3,78,39,0,800,802,3,72,36,0,
	801,800,1,0,0,0,802,805,1,0,0,0,803,801,1,0,0,0,803,804,1,0,0,0,804,806,
	1,0,0,0,805,803,1,0,0,0,806,807,5,172,0,0,807,808,5,2,0,0,808,810,1,0,0,
	0,809,760,1,0,0,0,809,772,1,0,0,0,809,784,1,0,0,0,809,797,1,0,0,0,810,71,
	1,0,0,0,811,814,3,226,113,0,812,814,3,74,37,0,813,811,1,0,0,0,813,812,1,
	0,0,0,814,73,1,0,0,0,815,816,7,5,0,0,816,75,1,0,0,0,817,818,5,56,0,0,818,
	819,5,40,0,0,819,821,3,234,117,0,820,822,5,172,0,0,821,820,1,0,0,0,821,
	822,1,0,0,0,822,823,1,0,0,0,823,824,5,57,0,0,824,826,3,234,117,0,825,827,
	5,172,0,0,826,825,1,0,0,0,826,827,1,0,0,0,827,828,1,0,0,0,828,829,5,41,
	0,0,829,854,1,0,0,0,830,831,5,56,0,0,831,832,5,40,0,0,832,834,3,234,117,
	0,833,835,5,172,0,0,834,833,1,0,0,0,834,835,1,0,0,0,835,836,1,0,0,0,836,
	837,5,57,0,0,837,838,3,76,38,0,838,839,5,41,0,0,839,854,1,0,0,0,840,841,
	5,56,0,0,841,842,5,40,0,0,842,844,3,234,117,0,843,845,5,172,0,0,844,843,
	1,0,0,0,844,845,1,0,0,0,845,846,1,0,0,0,846,847,5,57,0,0,847,849,3,78,39,
	0,848,850,5,172,0,0,849,848,1,0,0,0,849,850,1,0,0,0,850,851,1,0,0,0,851,
	852,5,41,0,0,852,854,1,0,0,0,853,817,1,0,0,0,853,830,1,0,0,0,853,840,1,
	0,0,0,854,77,1,0,0,0,855,856,6,39,-1,0,856,857,3,234,117,0,857,858,5,58,
	0,0,858,859,5,155,0,0,859,860,5,59,0,0,860,866,1,0,0,0,861,862,3,234,117,
	0,862,863,5,58,0,0,863,864,5,59,0,0,864,866,1,0,0,0,865,855,1,0,0,0,865,
	861,1,0,0,0,866,876,1,0,0,0,867,868,10,2,0,0,868,869,5,58,0,0,869,870,5,
	155,0,0,870,875,5,59,0,0,871,872,10,1,0,0,872,873,5,58,0,0,873,875,5,59,
	0,0,874,867,1,0,0,0,874,871,1,0,0,0,875,878,1,0,0,0,876,874,1,0,0,0,876,
	877,1,0,0,0,877,79,1,0,0,0,878,876,1,0,0,0,879,880,5,60,0,0,880,882,5,172,
	0,0,881,883,3,100,50,0,882,881,1,0,0,0,882,883,1,0,0,0,883,884,1,0,0,0,
	884,888,5,4,0,0,885,887,3,82,41,0,886,885,1,0,0,0,887,890,1,0,0,0,888,886,
	1,0,0,0,888,889,1,0,0,0,889,891,1,0,0,0,890,888,1,0,0,0,891,892,5,6,0,0,
	892,81,1,0,0,0,893,896,3,84,42,0,894,896,3,106,53,0,895,893,1,0,0,0,895,
	894,1,0,0,0,896,83,1,0,0,0,897,898,5,61,0,0,898,899,5,2,0,0,899,85,1,0,
	0,0,900,901,5,7,0,0,901,902,5,172,0,0,902,906,3,100,50,0,903,905,3,90,45,
	0,904,903,1,0,0,0,905,908,1,0,0,0,906,904,1,0,0,0,906,907,1,0,0,0,907,912,
	1,0,0,0,908,906,1,0,0,0,909,911,3,88,44,0,910,909,1,0,0,0,911,914,1,0,0,
	0,912,910,1,0,0,0,912,913,1,0,0,0,913,916,1,0,0,0,914,912,1,0,0,0,915,917,
	3,96,48,0,916,915,1,0,0,0,916,917,1,0,0,0,917,918,1,0,0,0,918,922,5,4,0,
	0,919,921,3,106,53,0,920,919,1,0,0,0,921,924,1,0,0,0,922,920,1,0,0,0,922,
	923,1,0,0,0,923,925,1,0,0,0,924,922,1,0,0,0,925,926,5,6,0,0,926,87,1,0,
	0,0,927,929,5,172,0,0,928,930,3,214,107,0,929,928,1,0,0,0,929,930,1,0,0,
	0,930,89,1,0,0,0,931,946,5,62,0,0,932,946,5,63,0,0,933,946,5,50,0,0,934,
	946,5,35,0,0,935,946,5,34,0,0,936,946,5,55,0,0,937,946,5,52,0,0,938,946,
	3,92,46,0,939,946,5,53,0,0,940,946,3,94,47,0,941,946,5,64,0,0,942,946,5,
	65,0,0,943,946,5,66,0,0,944,946,5,67,0,0,945,931,1,0,0,0,945,932,1,0,0,
	0,945,933,1,0,0,0,945,934,1,0,0,0,945,935,1,0,0,0,945,936,1,0,0,0,945,937,
	1,0,0,0,945,938,1,0,0,0,945,939,1,0,0,0,945,940,1,0,0,0,945,941,1,0,0,0,
	945,942,1,0,0,0,945,943,1,0,0,0,945,944,1,0,0,0,946,91,1,0,0,0,947,958,
	5,68,0,0,948,949,5,40,0,0,949,954,5,172,0,0,950,951,5,5,0,0,951,953,5,172,
	0,0,952,950,1,0,0,0,953,956,1,0,0,0,954,952,1,0,0,0,954,955,1,0,0,0,955,
	957,1,0,0,0,956,954,1,0,0,0,957,959,5,41,0,0,958,948,1,0,0,0,958,959,1,
	0,0,0,959,93,1,0,0,0,960,964,5,69,0,0,961,962,5,40,0,0,962,963,5,155,0,
	0,963,965,5,41,0,0,964,961,1,0,0,0,964,965,1,0,0,0,965,95,1,0,0,0,966,967,
	5,70,0,0,967,968,5,40,0,0,968,973,3,98,49,0,969,970,5,5,0,0,970,972,3,98,
	49,0,971,969,1,0,0,0,972,975,1,0,0,0,973,971,1,0,0,0,973,974,1,0,0,0,974,
	977,1,0,0,0,975,973,1,0,0,0,976,978,5,5,0,0,977,976,1,0,0,0,977,978,1,0,
	0,0,978,979,1,0,0,0,979,980,5,41,0,0,980,97,1,0,0,0,981,985,3,234,117,0,
	982,984,3,226,113,0,983,982,1,0,0,0,984,987,1,0,0,0,985,983,1,0,0,0,985,
	986,1,0,0,0,986,989,1,0,0,0,987,985,1,0,0,0,988,990,5,172,0,0,989,988,1,
	0,0,0,989,990,1,0,0,0,990,99,1,0,0,0,991,1003,5,40,0,0,992,997,3,102,51,
	0,993,994,5,5,0,0,994,996,3,102,51,0,995,993,1,0,0,0,996,999,1,0,0,0,997,
	995,1,0,0,0,997,998,1,0,0,0,998,1001,1,0,0,0,999,997,1,0,0,0,1000,1002,
	5,5,0,0,1001,1000,1,0,0,0,1001,1002,1,0,0,0,1002,1004,1,0,0,0,1003,992,
	1,0,0,0,1003,1004,1,0,0,0,1004,1005,1,0,0,0,1005,1006,5,41,0,0,1006,101,
	1,0,0,0,1007,1011,3,234,117,0,1008,1010,3,226,113,0,1009,1008,1,0,0,0,1010,
	1013,1,0,0,0,1011,1009,1,0,0,0,1011,1012,1,0,0,0,1012,1014,1,0,0,0,1013,
	1011,1,0,0,0,1014,1015,5,172,0,0,1015,1026,1,0,0,0,1016,1020,3,78,39,0,
	1017,1019,3,226,113,0,1018,1017,1,0,0,0,1019,1022,1,0,0,0,1020,1018,1,0,
	0,0,1020,1021,1,0,0,0,1021,1023,1,0,0,0,1022,1020,1,0,0,0,1023,1024,5,172,
	0,0,1024,1026,1,0,0,0,1025,1007,1,0,0,0,1025,1016,1,0,0,0,1026,103,1,0,
	0,0,1027,1031,5,4,0,0,1028,1030,3,106,53,0,1029,1028,1,0,0,0,1030,1033,
	1,0,0,0,1031,1029,1,0,0,0,1031,1032,1,0,0,0,1032,1034,1,0,0,0,1033,1031,
	1,0,0,0,1034,1037,5,6,0,0,1035,1037,3,106,53,0,1036,1027,1,0,0,0,1036,1035,
	1,0,0,0,1037,105,1,0,0,0,1038,1072,3,128,64,0,1039,1072,3,130,65,0,1040,
	1072,3,140,70,0,1041,1072,3,136,68,0,1042,1072,3,138,69,0,1043,1072,3,142,
	71,0,1044,1072,3,144,72,0,1045,1072,3,146,73,0,1046,1072,3,134,67,0,1047,
	1072,3,126,63,0,1048,1072,3,122,61,0,1049,1072,3,120,60,0,1050,1072,3,124,
	62,0,1051,1072,3,150,75,0,1052,1072,3,152,76,0,1053,1072,3,154,77,0,1054,
	1072,3,156,78,0,1055,1072,3,176,88,0,1056,1072,3,118,59,0,1057,1072,3,108,
	54,0,1058,1072,3,110,55,0,1059,1072,3,112,56,0,1060,1072,3,114,57,0,1061,
	1072,3,116,58,0,1062,1072,3,178,89,0,1063,1072,3,190,95,0,1064,1072,3,202,
	101,0,1065,1072,3,204,102,0,1066,1072,3,148,74,0,1067,1072,3,182,91,0,1068,
	1072,3,184,92,0,1069,1072,3,196,98,0,1070,1072,3,198,99,0,1071,1038,1,0,
	0,0,1071,1039,1,0,0,0,1071,1040,1,0,0,0,1071,1041,1,0,0,0,1071,1042,1,0,
	0,0,1071,1043,1,0,0,0,1071,1044,1,0,0,0,1071,1045,1,0,0,0,1071,1046,1,0,
	0,0,1071,1047,1,0,0,0,1071,1048,1,0,0,0,1071,1049,1,0,0,0,1071,1050,1,0,
	0,0,1071,1051,1,0,0,0,1071,1052,1,0,0,0,1071,1053,1,0,0,0,1071,1054,1,0,
	0,0,1071,1055,1,0,0,0,1071,1056,1,0,0,0,1071,1057,1,0,0,0,1071,1058,1,0,
	0,0,1071,1059,1,0,0,0,1071,1060,1,0,0,0,1071,1061,1,0,0,0,1071,1062,1,0,
	0,0,1071,1063,1,0,0,0,1071,1064,1,0,0,0,1071,1065,1,0,0,0,1071,1066,1,0,
	0,0,1071,1067,1,0,0,0,1071,1068,1,0,0,0,1071,1069,1,0,0,0,1071,1070,1,0,
	0,0,1072,107,1,0,0,0,1073,1074,5,71,0,0,1074,1075,5,12,0,0,1075,1076,5,
	172,0,0,1076,1077,5,40,0,0,1077,1078,3,222,111,0,1078,1079,5,5,0,0,1079,
	1080,3,222,111,0,1080,1081,5,41,0,0,1081,1082,5,2,0,0,1082,109,1,0,0,0,
	1083,1084,5,71,0,0,1084,1085,5,12,0,0,1085,1086,5,172,0,0,1086,1087,5,58,
	0,0,1087,1088,3,222,111,0,1088,1089,5,59,0,0,1089,1090,5,12,0,0,1090,1091,
	5,172,0,0,1091,1092,5,40,0,0,1092,1097,3,222,111,0,1093,1094,5,5,0,0,1094,
	1096,3,222,111,0,1095,1093,1,0,0,0,1096,1099,1,0,0,0,1097,1095,1,0,0,0,
	1097,1098,1,0,0,0,1098,1100,1,0,0,0,1099,1097,1,0,0,0,1100,1101,5,41,0,
	0,1101,1102,5,2,0,0,1102,111,1,0,0,0,1103,1104,5,72,0,0,1104,1133,5,2,0,
	0,1105,1106,5,72,0,0,1106,1111,3,222,111,0,1107,1108,5,5,0,0,1108,1110,
	3,222,111,0,1109,1107,1,0,0,0,1110,1113,1,0,0,0,1111,1109,1,0,0,0,1111,
	1112,1,0,0,0,1112,1114,1,0,0,0,1113,1111,1,0,0,0,1114,1115,5,2,0,0,1115,
	1133,1,0,0,0,1116,1117,5,72,0,0,1117,1118,5,40,0,0,1118,1123,3,222,111,
	0,1119,1120,5,5,0,0,1120,1122,3,222,111,0,1121,1119,1,0,0,0,1122,1125,1,
	0,0,0,1123,1121,1,0,0,0,1123,1124,1,0,0,0,1124,1127,1,0,0,0,1125,1123,1,
	0,0,0,1126,1128,5,5,0,0,1127,1126,1,0,0,0,1127,1128,1,0,0,0,1128,1129,1,
	0,0,0,1129,1130,5,41,0,0,1130,1131,5,2,0,0,1131,1133,1,0,0,0,1132,1103,
	1,0,0,0,1132,1105,1,0,0,0,1132,1116,1,0,0,0,1133,113,1,0,0,0,1134,1137,
	5,172,0,0,1135,1136,5,12,0,0,1136,1138,5,172,0,0,1137,1135,1,0,0,0,1137,
	1138,1,0,0,0,1138,1139,1,0,0,0,1139,1140,5,40,0,0,1140,1152,5,4,0,0,1141,
	1146,3,212,106,0,1142,1143,5,5,0,0,1143,1145,3,212,106,0,1144,1142,1,0,
	0,0,1145,1148,1,0,0,0,1146,1144,1,0,0,0,1146,1147,1,0,0,0,1147,1150,1,0,
	0,0,1148,1146,1,0,0,0,1149,1151,5,5,0,0,1150,1149,1,0,0,0,1150,1151,1,0,
	0,0,1151,1153,1,0,0,0,1152,1141,1,0,0,0,1152,1153,1,0,0,0,1153,1154,1,0,
	0,0,1154,1155,5,6,0,0,1155,1156,5,41,0,0,1156,1180,5,2,0,0,1157,1158,5,
	172,0,0,1158,1159,3,214,107,0,1159,1160,5,2,0,0,1160,1180,1,0,0,0,1161,
	1162,5,172,0,0,1162,1163,5,12,0,0,1163,1164,5,172,0,0,1164,1165,3,214,107,
	0,1165,1166,5,2,0,0,1166,1180,1,0,0,0,1167,1168,5,172,0,0,1168,1169,3,214,
	107,0,1169,1170,5,12,0,0,1170,1171,5,172,0,0,1171,1172,5,12,0,0,1172,1174,
	5,172,0,0,1173,1175,3,216,108,0,1174,1173,1,0,0,0,1174,1175,1,0,0,0,1175,
	1176,1,0,0,0,1176,1177,3,214,107,0,1177,1178,5,2,0,0,1178,1180,1,0,0,0,
	1179,1134,1,0,0,0,1179,1157,1,0,0,0,1179,1161,1,0,0,0,1179,1167,1,0,0,0,
	1180,115,1,0,0,0,1181,1182,3,222,111,0,1182,1183,5,12,0,0,1183,1185,5,172,
	0,0,1184,1186,3,216,108,0,1185,1184,1,0,0,0,1185,1186,1,0,0,0,1186,1187,
	1,0,0,0,1187,1188,3,214,107,0,1188,1189,5,2,0,0,1189,117,1,0,0,0,1190,1191,
	5,73,0,0,1191,1194,5,172,0,0,1192,1193,5,12,0,0,1193,1195,5,172,0,0,1194,
	1192,1,0,0,0,1194,1195,1,0,0,0,1195,1196,1,0,0,0,1196,1197,5,40,0,0,1197,
	1209,5,4,0,0,1198,1203,3,212,106,0,1199,1200,5,5,0,0,1200,1202,3,212,106,
	0,1201,1199,1,0,0,0,1202,1205,1,0,0,0,1203,1201,1,0,0,0,1203,1204,1,0,0,
	0,1204,1207,1,0,0,0,1205,1203,1,0,0,0,1206,1208,5,5,0,0,1207,1206,1,0,0,
	0,1207,1208,1,0,0,0,1208,1210,1,0,0,0,1209,1198,1,0,0,0,1209,1210,1,0,0,
	0,1210,1211,1,0,0,0,1211,1212,5,6,0,0,1212,1213,5,41,0,0,1213,1224,5,2,
	0,0,1214,1215,5,73,0,0,1215,1218,5,172,0,0,1216,1217,5,12,0,0,1217,1219,
	5,172,0,0,1218,1216,1,0,0,0,1218,1219,1,0,0,0,1219,1220,1,0,0,0,1220,1221,
	3,214,107,0,1221,1222,5,2,0,0,1222,1224,1,0,0,0,1223,1190,1,0,0,0,1223,
	1214,1,0,0,0,1224,119,1,0,0,0,1225,1226,5,71,0,0,1226,1227,5,12,0,0,1227,
	1232,5,172,0,0,1228,1229,5,58,0,0,1229,1230,3,222,111,0,1230,1231,5,59,
	0,0,1231,1233,1,0,0,0,1232,1228,1,0,0,0,1233,1234,1,0,0,0,1234,1232,1,0,
	0,0,1234,1235,1,0,0,0,1235,1236,1,0,0,0,1236,1237,7,6,0,0,1237,1238,3,222,
	111,0,1238,1239,5,2,0,0,1239,121,1,0,0,0,1240,1241,5,71,0,0,1241,1242,5,
	12,0,0,1242,1247,5,172,0,0,1243,1244,5,58,0,0,1244,1245,3,222,111,0,1245,
	1246,5,59,0,0,1246,1248,1,0,0,0,1247,1243,1,0,0,0,1248,1249,1,0,0,0,1249,
	1247,1,0,0,0,1249,1250,1,0,0,0,1250,1251,1,0,0,0,1251,1252,5,12,0,0,1252,
	1253,5,172,0,0,1253,1254,7,6,0,0,1254,1255,3,222,111,0,1255,1256,5,2,0,
	0,1256,123,1,0,0,0,1257,1258,5,71,0,0,1258,1259,5,12,0,0,1259,1266,5,172,
	0,0,1260,1261,5,58,0,0,1261,1262,3,222,111,0,1262,1263,5,59,0,0,1263,1265,
	1,0,0,0,1264,1260,1,0,0,0,1265,1268,1,0,0,0,1266,1264,1,0,0,0,1266,1267,
	1,0,0,0,1267,1269,1,0,0,0,1268,1266,1,0,0,0,1269,1270,5,84,0,0,1270,1271,
	5,40,0,0,1271,1272,3,222,111,0,1272,1273,5,41,0,0,1273,1274,5,2,0,0,1274,
	125,1,0,0,0,1275,1276,5,71,0,0,1276,1277,5,12,0,0,1277,1278,5,172,0,0,1278,
	1279,7,6,0,0,1279,1280,3,222,111,0,1280,1281,5,2,0,0,1281,127,1,0,0,0,1282,
	1286,3,234,117,0,1283,1285,3,226,113,0,1284,1283,1,0,0,0,1285,1288,1,0,
	0,0,1286,1284,1,0,0,0,1286,1287,1,0,0,0,1287,1289,1,0,0,0,1288,1286,1,0,
	0,0,1289,1292,5,172,0,0,1290,1291,5,31,0,0,1291,1293,3,222,111,0,1292,1290,
	1,0,0,0,1292,1293,1,0,0,0,1293,1294,1,0,0,0,1294,1295,5,2,0,0,1295,1309,
	1,0,0,0,1296,1300,3,78,39,0,1297,1299,3,226,113,0,1298,1297,1,0,0,0,1299,
	1302,1,0,0,0,1300,1298,1,0,0,0,1300,1301,1,0,0,0,1301,1303,1,0,0,0,1302,
	1300,1,0,0,0,1303,1304,5,172,0,0,1304,1305,5,31,0,0,1305,1306,3,222,111,
	0,1306,1307,5,2,0,0,1307,1309,1,0,0,0,1308,1282,1,0,0,0,1308,1296,1,0,0,
	0,1309,129,1,0,0,0,1310,1311,3,234,117,0,1311,1316,5,172,0,0,1312,1313,
	5,5,0,0,1313,1314,3,234,117,0,1314,1315,5,172,0,0,1315,1317,1,0,0,0,1316,
	1312,1,0,0,0,1317,1318,1,0,0,0,1318,1316,1,0,0,0,1318,1319,1,0,0,0,1319,
	1320,1,0,0,0,1320,1321,5,31,0,0,1321,1322,3,222,111,0,1322,1323,5,2,0,0,
	1323,1359,1,0,0,0,1324,1325,5,40,0,0,1325,1328,3,132,66,0,1326,1327,5,5,
	0,0,1327,1329,3,132,66,0,1328,1326,1,0,0,0,1329,1330,1,0,0,0,1330,1328,
	1,0,0,0,1330,1331,1,0,0,0,1331,1332,1,0,0,0,1332,1333,5,41,0,0,1333,1334,
	5,31,0,0,1334,1335,5,40,0,0,1335,1338,3,222,111,0,1336,1337,5,5,0,0,1337,
	1339,3,222,111,0,1338,1336,1,0,0,0,1339,1340,1,0,0,0,1340,1338,1,0,0,0,
	1340,1341,1,0,0,0,1341,1342,1,0,0,0,1342,1343,5,41,0,0,1343,1344,5,2,0,
	0,1344,1359,1,0,0,0,1345,1346,5,40,0,0,1346,1349,3,132,66,0,1347,1348,5,
	5,0,0,1348,1350,3,132,66,0,1349,1347,1,0,0,0,1350,1351,1,0,0,0,1351,1349,
	1,0,0,0,1351,1352,1,0,0,0,1352,1353,1,0,0,0,1353,1354,5,41,0,0,1354,1355,
	5,31,0,0,1355,1356,3,222,111,0,1356,1357,5,2,0,0,1357,1359,1,0,0,0,1358,
	1310,1,0,0,0,1358,1324,1,0,0,0,1358,1345,1,0,0,0,1359,131,1,0,0,0,1360,
	1361,3,234,117,0,1361,1362,5,172,0,0,1362,1366,1,0,0,0,1363,1366,5,172,
	0,0,1364,1366,1,0,0,0,1365,1360,1,0,0,0,1365,1363,1,0,0,0,1365,1364,1,0,
	0,0,1366,133,1,0,0,0,1367,1368,5,172,0,0,1368,1369,7,6,0,0,1369,1370,3,
	222,111,0,1370,1371,5,2,0,0,1371,1376,1,0,0,0,1372,1373,5,172,0,0,1373,
	1374,7,7,0,0,1374,1376,5,2,0,0,1375,1367,1,0,0,0,1375,1372,1,0,0,0,1376,
	135,1,0,0,0,1377,1378,5,172,0,0,1378,1379,5,87,0,0,1379,1380,5,40,0,0,1380,
	1381,3,222,111,0,1381,1382,5,41,0,0,1382,1383,5,2,0,0,1383,137,1,0,0,0,
	1384,1385,5,172,0,0,1385,1386,5,88,0,0,1386,1387,5,40,0,0,1387,1388,5,41,
	0,0,1388,1389,5,2,0,0,1389,139,1,0,0,0,1390,1391,5,172,0,0,1391,1392,5,
	58,0,0,1392,1393,3,222,111,0,1393,1394,5,59,0,0,1394,1395,7,6,0,0,1395,
	1396,3,222,111,0,1396,1397,5,2,0,0,1397,141,1,0,0,0,1398,1399,5,172,0,0,
	1399,1400,5,84,0,0,1400,1401,5,40,0,0,1401,1402,3,222,111,0,1402,1403,5,
	41,0,0,1403,1404,5,2,0,0,1404,143,1,0,0,0,1405,1406,5,71,0,0,1406,1407,
	5,12,0,0,1407,1408,5,172,0,0,1408,1409,5,87,0,0,1409,1410,5,40,0,0,1410,
	1411,3,222,111,0,1411,1412,5,41,0,0,1412,1413,5,2,0,0,1413,145,1,0,0,0,
	1414,1415,5,71,0,0,1415,1416,5,12,0,0,1416,1417,5,172,0,0,1417,1418,5,88,
	0,0,1418,1419,5,40,0,0,1419,1420,5,41,0,0,1420,1421,5,2,0,0,1421,147,1,
	0,0,0,1422,1423,5,89,0,0,1423,1424,5,172,0,0,1424,1445,5,2,0,0,1425,1426,
	5,89,0,0,1426,1427,5,71,0,0,1427,1428,5,12,0,0,1428,1429,5,172,0,0,1429,
	1445,5,2,0,0,1430,1431,5,89,0,0,1431,1432,5,71,0,0,1432,1433,5,12,0,0,1433,
	1438,5,172,0,0,1434,1435,5,58,0,0,1435,1436,3,222,111,0,1436,1437,5,59,
	0,0,1437,1439,1,0,0,0,1438,1434,1,0,0,0,1439,1440,1,0,0,0,1440,1438,1,0,
	0,0,1440,1441,1,0,0,0,1441,1442,1,0,0,0,1442,1443,5,2,0,0,1443,1445,1,0,
	0,0,1444,1422,1,0,0,0,1444,1425,1,0,0,0,1444,1430,1,0,0,0,1445,149,1,0,
	0,0,1446,1447,5,90,0,0,1447,1448,5,40,0,0,1448,1449,5,163,0,0,1449,1450,
	5,23,0,0,1450,1453,3,222,111,0,1451,1452,5,5,0,0,1452,1454,3,200,100,0,
	1453,1451,1,0,0,0,1453,1454,1,0,0,0,1454,1455,1,0,0,0,1455,1456,5,41,0,
	0,1456,1457,5,2,0,0,1457,151,1,0,0,0,1458,1459,5,90,0,0,1459,1460,5,40,
	0,0,1460,1463,3,222,111,0,1461,1462,5,5,0,0,1462,1464,3,200,100,0,1463,
	1461,1,0,0,0,1463,1464,1,0,0,0,1464,1465,1,0,0,0,1465,1466,5,41,0,0,1466,
	1467,5,2,0,0,1467,153,1,0,0,0,1468,1469,5,91,0,0,1469,1470,5,40,0,0,1470,
	1471,3,222,111,0,1471,1472,5,41,0,0,1472,1475,3,104,52,0,1473,1474,5,92,
	0,0,1474,1476,3,104,52,0,1475,1473,1,0,0,0,1475,1476,1,0,0,0,1476,155,1,
	0,0,0,1477,1484,3,172,86,0,1478,1484,3,174,87,0,1479,1484,3,164,82,0,1480,
	1484,3,158,79,0,1481,1484,3,160,80,0,1482,1484,3,162,81,0,1483,1477,1,0,
	0,0,1483,1478,1,0,0,0,1483,1479,1,0,0,0,1483,1480,1,0,0,0,1483,1481,1,0,
	0,0,1483,1482,1,0,0,0,1484,157,1,0,0,0,1485,1486,5,9,0,0,1486,1487,5,40,
	0,0,1487,1488,3,234,117,0,1488,1489,5,172,0,0,1489,1490,5,5,0,0,1490,1491,
	3,234,117,0,1491,1492,5,172,0,0,1492,1493,5,93,0,0,1493,1494,5,71,0,0,1494,
	1495,5,12,0,0,1495,1496,5,172,0,0,1496,1497,5,12,0,0,1497,1498,5,94,0,0,
	1498,1499,5,41,0,0,1499,1500,3,104,52,0,1500,159,1,0,0,0,1501,1502,5,9,
	0,0,1502,1503,5,40,0,0,1503,1504,3,234,117,0,1504,1505,5,172,0,0,1505,1506,
	5,95,0,0,1506,1507,5,71,0,0,1507,1508,5,12,0,0,1508,1509,5,172,0,0,1509,
	1510,5,41,0,0,1510,1511,3,104,52,0,1511,161,1,0,0,0,1512,1513,5,9,0,0,1513,
	1514,5,40,0,0,1514,1515,3,234,117,0,1515,1516,5,172,0,0,1516,1517,5,93,
	0,0,1517,1518,5,71,0,0,1518,1519,5,12,0,0,1519,1520,5,172,0,0,1520,1521,
	5,41,0,0,1521,1522,3,104,52,0,1522,163,1,0,0,0,1523,1524,5,9,0,0,1524,1525,
	5,40,0,0,1525,1526,3,166,83,0,1526,1527,3,168,84,0,1527,1528,3,170,85,0,
	1528,1529,5,41,0,0,1529,1530,3,104,52,0,1530,165,1,0,0,0,1531,1535,3,234,
	117,0,1532,1534,3,226,113,0,1533,1532,1,0,0,0,1534,1537,1,0,0,0,1535,1533,
	1,0,0,0,1535,1536,1,0,0,0,1536,1538,1,0,0,0,1537,1535,1,0,0,0,1538,1539,
	5,172,0,0,1539,1540,5,31,0,0,1540,1541,3,222,111,0,1541,1542,5,2,0,0,1542,
	167,1,0,0,0,1543,1544,3,222,111,0,1544,1545,5,2,0,0,1545,169,1,0,0,0,1546,
	1547,5,172,0,0,1547,1548,7,6,0,0,1548,1552,3,222,111,0,1549,1550,5,172,
	0,0,1550,1552,7,7,0,0,1551,1546,1,0,0,0,1551,1549,1,0,0,0,1552,171,1,0,
	0,0,1553,1554,5,96,0,0,1554,1555,3,104,52,0,1555,1556,5,97,0,0,1556,1557,
	5,40,0,0,1557,1558,3,222,111,0,1558,1559,5,41,0,0,1559,1560,5,2,0,0,1560,
	173,1,0,0,0,1561,1562,5,97,0,0,1562,1563,5,40,0,0,1563,1564,3,222,111,0,
	1564,1565,5,41,0,0,1565,1566,3,104,52,0,1566,175,1,0,0,0,1567,1568,5,98,
	0,0,1568,1569,3,208,104,0,1569,1570,5,2,0,0,1570,177,1,0,0,0,1571,1572,
	5,99,0,0,1572,1576,5,4,0,0,1573,1575,3,180,90,0,1574,1573,1,0,0,0,1575,
	1578,1,0,0,0,1576,1574,1,0,0,0,1576,1577,1,0,0,0,1577,1579,1,0,0,0,1578,
	1576,1,0,0,0,1579,1580,5,6,0,0,1580,179,1,0,0,0,1581,1582,7,8,0,0,1582,
	181,1,0,0,0,1583,1584,5,100,0,0,1584,1588,5,4,0,0,1585,1587,3,106,53,0,
	1586,1585,1,0,0,0,1587,1590,1,0,0,0,1588,1586,1,0,0,0,1588,1589,1,0,0,0,
	1589,1591,1,0,0,0,1590,1588,1,0,0,0,1591,1592,5,6,0,0,1592,183,1,0,0,0,
	1593,1594,5,101,0,0,1594,1595,5,40,0,0,1595,1596,3,222,111,0,1596,1597,
	5,41,0,0,1597,1601,5,4,0,0,1598,1600,3,186,93,0,1599,1598,1,0,0,0,1600,
	1603,1,0,0,0,1601,1599,1,0,0,0,1601,1602,1,0,0,0,1602,1605,1,0,0,0,1603,
	1601,1,0,0,0,1604,1606,3,188,94,0,1605,1604,1,0,0,0,1605,1606,1,0,0,0,1606,
	1607,1,0,0,0,1607,1608,5,6,0,0,1608,185,1,0,0,0,1609,1610,5,102,0,0,1610,
	1611,3,222,111,0,1611,1615,5,103,0,0,1612,1614,3,106,53,0,1613,1612,1,0,
	0,0,1614,1617,1,0,0,0,1615,1613,1,0,0,0,1615,1616,1,0,0,0,1616,187,1,0,
	0,0,1617,1615,1,0,0,0,1618,1619,5,104,0,0,1619,1623,5,103,0,0,1620,1622,
	3,106,53,0,1621,1620,1,0,0,0,1622,1625,1,0,0,0,1623,1621,1,0,0,0,1623,1624,
	1,0,0,0,1624,189,1,0,0,0,1625,1623,1,0,0,0,1626,1627,5,105,0,0,1627,1629,
	3,222,111,0,1628,1630,3,192,96,0,1629,1628,1,0,0,0,1629,1630,1,0,0,0,1630,
	1631,1,0,0,0,1631,1633,3,104,52,0,1632,1634,3,194,97,0,1633,1632,1,0,0,
	0,1634,1635,1,0,0,0,1635,1633,1,0,0,0,1635,1636,1,0,0,0,1636,191,1,0,0,
	0,1637,1638,5,70,0,0,1638,1650,5,40,0,0,1639,1644,3,102,51,0,1640,1641,
	5,5,0,0,1641,1643,3,102,51,0,1642,1640,1,0,0,0,1643,1646,1,0,0,0,1644,1642,
	1,0,0,0,1644,1645,1,0,0,0,1645,1648,1,0,0,0,1646,1644,1,0,0,0,1647,1649,
	5,5,0,0,1648,1647,1,0,0,0,1648,1649,1,0,0,0,1649,1651,1,0,0,0,1650,1639,
	1,0,0,0,1650,1651,1,0,0,0,1651,1652,1,0,0,0,1652,1653,5,41,0,0,1653,193,
	1,0,0,0,1654,1656,5,106,0,0,1655,1657,5,172,0,0,1656,1655,1,0,0,0,1656,
	1657,1,0,0,0,1657,1673,1,0,0,0,1658,1670,5,40,0,0,1659,1664,3,102,51,0,
	1660,1661,5,5,0,0,1661,1663,3,102,51,0,1662,1660,1,0,0,0,1663,1666,1,0,
	0,0,1664,1662,1,0,0,0,1664,1665,1,0,0,0,1665,1668,1,0,0,0,1666,1664,1,0,
	0,0,1667,1669,5,5,0,0,1668,1667,1,0,0,0,1668,1669,1,0,0,0,1669,1671,1,0,
	0,0,1670,1659,1,0,0,0,1670,1671,1,0,0,0,1671,1672,1,0,0,0,1672,1674,5,41,
	0,0,1673,1658,1,0,0,0,1673,1674,1,0,0,0,1674,1675,1,0,0,0,1675,1676,3,104,
	52,0,1676,195,1,0,0,0,1677,1678,5,107,0,0,1678,1679,5,2,0,0,1679,197,1,
	0,0,0,1680,1681,5,108,0,0,1681,1682,5,2,0,0,1682,199,1,0,0,0,1683,1687,
	5,160,0,0,1684,1685,5,172,0,0,1685,1687,3,214,107,0,1686,1683,1,0,0,0,1686,
	1684,1,0,0,0,1687,201,1,0,0,0,1688,1689,5,109,0,0,1689,1692,5,172,0,0,1690,
	1691,5,12,0,0,1691,1693,5,172,0,0,1692,1690,1,0,0,0,1692,1693,1,0,0,0,1693,
	1694,1,0,0,0,1694,1695,5,40,0,0,1695,1707,5,4,0,0,1696,1701,3,212,106,0,
	1697,1698,5,5,0,0,1698,1700,3,212,106,0,1699,1697,1,0,0,0,1700,1703,1,0,
	0,0,1701,1699,1,0,0,0,1701,1702,1,0,0,0,1702,1705,1,0,0,0,1703,1701,1,0,
	0,0,1704,1706,5,5,0,0,1705,1704,1,0,0,0,1705,1706,1,0,0,0,1706,1708,1,0,
	0,0,1707,1696,1,0,0,0,1707,1708,1,0,0,0,1708,1709,1,0,0,0,1709,1710,5,6,
	0,0,1710,1711,5,41,0,0,1711,1731,5,2,0,0,1712,1713,5,109,0,0,1713,1716,
	5,172,0,0,1714,1715,5,12,0,0,1715,1717,5,172,0,0,1716,1714,1,0,0,0,1716,
	1717,1,0,0,0,1717,1718,1,0,0,0,1718,1719,3,214,107,0,1719,1720,5,2,0,0,
	1720,1731,1,0,0,0,1721,1722,5,109,0,0,1722,1723,5,40,0,0,1723,1724,5,160,
	0,0,1724,1725,5,41,0,0,1725,1731,5,2,0,0,1726,1727,5,109,0,0,1727,1728,
	5,40,0,0,1728,1729,5,41,0,0,1729,1731,5,2,0,0,1730,1688,1,0,0,0,1730,1712,
	1,0,0,0,1730,1721,1,0,0,0,1730,1726,1,0,0,0,1731,203,1,0,0,0,1732,1733,
	5,110,0,0,1733,1734,5,40,0,0,1734,1735,3,222,111,0,1735,1736,5,41,0,0,1736,
	1737,5,2,0,0,1737,205,1,0,0,0,1738,1741,5,172,0,0,1739,1741,3,228,114,0,
	1740,1738,1,0,0,0,1740,1739,1,0,0,0,1741,207,1,0,0,0,1742,1754,5,40,0,0,
	1743,1748,3,206,103,0,1744,1745,5,5,0,0,1745,1747,3,206,103,0,1746,1744,
	1,0,0,0,1747,1750,1,0,0,0,1748,1746,1,0,0,0,1748,1749,1,0,0,0,1749,1752,
	1,0,0,0,1750,1748,1,0,0,0,1751,1753,5,5,0,0,1752,1751,1,0,0,0,1752,1753,
	1,0,0,0,1753,1755,1,0,0,0,1754,1743,1,0,0,0,1754,1755,1,0,0,0,1755,1756,
	1,0,0,0,1756,1757,5,41,0,0,1757,209,1,0,0,0,1758,1759,5,172,0,0,1759,1783,
	3,214,107,0,1760,1761,5,172,0,0,1761,1762,5,12,0,0,1762,1763,5,172,0,0,
	1763,1783,3,214,107,0,1764,1765,5,172,0,0,1765,1766,5,40,0,0,1766,1778,
	5,4,0,0,1767,1772,3,212,106,0,1768,1769,5,5,0,0,1769,1771,3,212,106,0,1770,
	1768,1,0,0,0,1771,1774,1,0,0,0,1772,1770,1,0,0,0,1772,1773,1,0,0,0,1773,
	1776,1,0,0,0,1774,1772,1,0,0,0,1775,1777,5,5,0,0,1776,1775,1,0,0,0,1776,
	1777,1,0,0,0,1777,1779,1,0,0,0,1778,1767,1,0,0,0,1778,1779,1,0,0,0,1779,
	1780,1,0,0,0,1780,1781,5,6,0,0,1781,1783,5,41,0,0,1782,1758,1,0,0,0,1782,
	1760,1,0,0,0,1782,1764,1,0,0,0,1783,211,1,0,0,0,1784,1785,5,172,0,0,1785,
	1786,5,103,0,0,1786,1787,3,222,111,0,1787,213,1,0,0,0,1788,1800,5,40,0,
	0,1789,1794,3,222,111,0,1790,1791,5,5,0,0,1791,1793,3,222,111,0,1792,1790,
	1,0,0,0,1793,1796,1,0,0,0,1794,1792,1,0,0,0,1794,1795,1,0,0,0,1795,1798,
	1,0,0,0,1796,1794,1,0,0,0,1797,1799,5,5,0,0,1798,1797,1,0,0,0,1798,1799,
	1,0,0,0,1799,1801,1,0,0,0,1800,1789,1,0,0,0,1800,1801,1,0,0,0,1801,1802,
	1,0,0,0,1802,1803,5,41,0,0,1803,215,1,0,0,0,1804,1805,5,4,0,0,1805,1810,
	3,218,109,0,1806,1807,5,5,0,0,1807,1809,3,218,109,0,1808,1806,1,0,0,0,1809,
	1812,1,0,0,0,1810,1808,1,0,0,0,1810,1811,1,0,0,0,1811,1814,1,0,0,0,1812,
	1810,1,0,0,0,1813,1815,5,5,0,0,1814,1813,1,0,0,0,1814,1815,1,0,0,0,1815,
	1816,1,0,0,0,1816,1817,5,6,0,0,1817,217,1,0,0,0,1818,1819,5,172,0,0,1819,
	1820,5,103,0,0,1820,1821,3,222,111,0,1821,219,1,0,0,0,1822,1823,5,40,0,
	0,1823,1828,3,234,117,0,1824,1825,5,5,0,0,1825,1827,3,234,117,0,1826,1824,
	1,0,0,0,1827,1830,1,0,0,0,1828,1826,1,0,0,0,1828,1829,1,0,0,0,1829,1832,
	1,0,0,0,1830,1828,1,0,0,0,1831,1833,5,5,0,0,1832,1831,1,0,0,0,1832,1833,
	1,0,0,0,1833,1834,1,0,0,0,1834,1835,5,41,0,0,1835,221,1,0,0,0,1836,1837,
	6,111,-1,0,1837,1838,5,40,0,0,1838,1839,3,222,111,0,1839,1840,5,41,0,0,
	1840,1966,1,0,0,0,1841,1842,3,236,118,0,1842,1843,5,40,0,0,1843,1845,3,
	222,111,0,1844,1846,5,5,0,0,1845,1844,1,0,0,0,1845,1846,1,0,0,0,1846,1847,
	1,0,0,0,1847,1848,5,41,0,0,1848,1966,1,0,0,0,1849,1966,3,210,105,0,1850,
	1851,5,111,0,0,1851,1853,5,172,0,0,1852,1854,3,216,108,0,1853,1852,1,0,
	0,0,1853,1854,1,0,0,0,1854,1855,1,0,0,0,1855,1966,3,214,107,0,1856,1857,
	5,111,0,0,1857,1858,3,234,117,0,1858,1859,5,58,0,0,1859,1860,5,59,0,0,1860,
	1861,5,40,0,0,1861,1862,3,222,111,0,1862,1863,5,41,0,0,1863,1966,1,0,0,
	0,1864,1865,5,47,0,0,1865,1866,5,40,0,0,1866,1867,3,234,117,0,1867,1868,
	5,41,0,0,1868,1869,5,12,0,0,1869,1870,5,172,0,0,1870,1966,1,0,0,0,1871,
	1872,5,112,0,0,1872,1966,3,214,107,0,1873,1874,5,113,0,0,1874,1966,3,214,
	107,0,1875,1876,5,114,0,0,1876,1966,3,214,107,0,1877,1878,5,115,0,0,1878,
	1966,3,214,107,0,1879,1880,5,116,0,0,1880,1881,5,40,0,0,1881,1882,5,172,
	0,0,1882,1883,5,12,0,0,1883,1884,5,172,0,0,1884,1885,5,5,0,0,1885,1886,
	3,214,107,0,1886,1887,5,41,0,0,1887,1966,1,0,0,0,1888,1889,5,117,0,0,1889,
	1966,3,214,107,0,1890,1891,5,118,0,0,1891,1966,3,214,107,0,1892,1893,5,
	119,0,0,1893,1894,5,40,0,0,1894,1895,3,222,111,0,1895,1896,5,5,0,0,1896,
	1897,3,220,110,0,1897,1898,5,41,0,0,1898,1966,1,0,0,0,1899,1900,5,120,0,
	0,1900,1901,5,40,0,0,1901,1902,3,222,111,0,1902,1903,5,5,0,0,1903,1904,
	3,220,110,0,1904,1905,5,5,0,0,1905,1906,5,155,0,0,1906,1907,5,41,0,0,1907,
	1966,1,0,0,0,1908,1909,5,121,0,0,1909,1910,5,58,0,0,1910,1911,3,222,111,
	0,1911,1912,5,59,0,0,1912,1913,7,9,0,0,1913,1966,1,0,0,0,1914,1915,5,127,
	0,0,1915,1916,5,58,0,0,1916,1917,3,222,111,0,1917,1918,5,59,0,0,1918,1919,
	7,10,0,0,1919,1966,1,0,0,0,1920,1921,7,11,0,0,1921,1966,3,222,111,21,1922,
	1934,5,58,0,0,1923,1928,3,222,111,0,1924,1925,5,5,0,0,1925,1927,3,222,111,
	0,1926,1924,1,0,0,0,1927,1930,1,0,0,0,1928,1926,1,0,0,0,1928,1929,1,0,0,
	0,1929,1932,1,0,0,0,1930,1928,1,0,0,0,1931,1933,5,5,0,0,1932,1931,1,0,0,
	0,1932,1933,1,0,0,0,1933,1935,1,0,0,0,1934,1923,1,0,0,0,1934,1935,1,0,0,
	0,1935,1936,1,0,0,0,1936,1966,5,59,0,0,1937,1938,5,71,0,0,1938,1939,5,12,
	0,0,1939,1940,5,172,0,0,1940,1941,5,12,0,0,1941,1942,5,172,0,0,1942,1943,
	5,58,0,0,1943,1944,3,222,111,0,1944,1945,5,59,0,0,1945,1946,3,224,112,0,
	1946,1966,1,0,0,0,1947,1948,5,71,0,0,1948,1949,5,12,0,0,1949,1954,5,172,
	0,0,1950,1951,5,58,0,0,1951,1952,3,222,111,0,1952,1953,5,59,0,0,1953,1955,
	1,0,0,0,1954,1950,1,0,0,0,1955,1956,1,0,0,0,1956,1954,1,0,0,0,1956,1957,
	1,0,0,0,1957,1966,1,0,0,0,1958,1959,5,71,0,0,1959,1960,5,12,0,0,1960,1966,
	5,172,0,0,1961,1966,5,71,0,0,1962,1966,5,169,0,0,1963,1966,5,172,0,0,1964,
	1966,3,228,114,0,1965,1836,1,0,0,0,1965,1841,1,0,0,0,1965,1849,1,0,0,0,
	1965,1850,1,0,0,0,1965,1856,1,0,0,0,1965,1864,1,0,0,0,1965,1871,1,0,0,0,
	1965,1873,1,0,0,0,1965,1875,1,0,0,0,1965,1877,1,0,0,0,1965,1879,1,0,0,0,
	1965,1888,1,0,0,0,1965,1890,1,0,0,0,1965,1892,1,0,0,0,1965,1899,1,0,0,0,
	1965,1908,1,0,0,0,1965,1914,1,0,0,0,1965,1920,1,0,0,0,1965,1922,1,0,0,0,
	1965,1937,1,0,0,0,1965,1947,1,0,0,0,1965,1958,1,0,0,0,1965,1961,1,0,0,0,
	1965,1962,1,0,0,0,1965,1963,1,0,0,0,1965,1964,1,0,0,0,1966,2072,1,0,0,0,
	1967,1968,10,20,0,0,1968,1969,5,17,0,0,1969,2071,3,222,111,20,1970,1971,
	10,19,0,0,1971,1972,7,12,0,0,1972,2071,3,222,111,20,1973,1974,10,18,0,0,
	1974,1975,7,13,0,0,1975,2071,3,222,111,19,1976,1977,10,17,0,0,1977,1978,
	7,14,0,0,1978,2071,3,222,111,18,1979,1980,10,16,0,0,1980,1981,7,15,0,0,
	1981,2071,3,222,111,17,1982,1983,10,15,0,0,1983,1984,7,16,0,0,1984,2071,
	3,222,111,16,1985,1986,10,14,0,0,1986,1987,5,24,0,0,1987,2071,3,222,111,
	15,1988,1989,10,13,0,0,1989,1990,5,26,0,0,1990,2071,3,222,111,14,1991,1992,
	10,12,0,0,1992,1993,5,25,0,0,1993,2071,3,222,111,13,1994,1995,10,11,0,0,
	1995,1996,5,139,0,0,1996,2071,3,222,111,12,1997,1998,10,10,0,0,1998,1999,
	5,140,0,0,1999,2071,3,222,111,11,2000,2001,10,9,0,0,2001,2002,5,141,0,0,
	2002,2003,3,222,111,0,2003,2004,5,103,0,0,2004,2005,3,222,111,9,2005,2071,
	1,0,0,0,2006,2007,10,32,0,0,2007,2008,5,58,0,0,2008,2009,3,222,111,0,2009,
	2010,5,103,0,0,2010,2011,3,222,111,0,2011,2012,5,59,0,0,2012,2071,1,0,0,
	0,2013,2014,10,31,0,0,2014,2015,5,58,0,0,2015,2016,5,155,0,0,2016,2071,
	5,59,0,0,2017,2018,10,30,0,0,2018,2019,5,58,0,0,2019,2020,3,222,111,0,2020,
	2021,5,59,0,0,2021,2071,1,0,0,0,2022,2023,10,27,0,0,2023,2071,7,17,0,0,
	2024,2025,10,26,0,0,2025,2026,5,134,0,0,2026,2027,5,40,0,0,2027,2028,3,
	222,111,0,2028,2029,5,41,0,0,2029,2071,1,0,0,0,2030,2031,10,25,0,0,2031,
	2032,5,135,0,0,2032,2033,5,40,0,0,2033,2034,3,222,111,0,2034,2035,5,5,0,
	0,2035,2036,3,222,111,0,2036,2037,5,41,0,0,2037,2071,1,0,0,0,2038,2039,
	10,24,0,0,2039,2040,5,12,0,0,2040,2042,5,172,0,0,2041,2043,3,216,108,0,
	2042,2041,1,0,0,0,2042,2043,1,0,0,0,2043,2044,1,0,0,0,2044,2045,5,40,0,
	0,2045,2057,5,4,0,0,2046,2051,3,212,106,0,2047,2048,5,5,0,0,2048,2050,3,
	212,106,0,2049,2047,1,0,0,0,2050,2053,1,0,0,0,2051,2049,1,0,0,0,2051,2052,
	1,0,0,0,2052,2055,1,0,0,0,2053,2051,1,0,0,0,2054,2056,5,5,0,0,2055,2054,
	1,0,0,0,2055,2056,1,0,0,0,2056,2058,1,0,0,0,2057,2046,1,0,0,0,2057,2058,
	1,0,0,0,2058,2059,1,0,0,0,2059,2060,5,6,0,0,2060,2071,5,41,0,0,2061,2062,
	10,23,0,0,2062,2063,5,12,0,0,2063,2065,5,172,0,0,2064,2066,3,216,108,0,
	2065,2064,1,0,0,0,2065,2066,1,0,0,0,2066,2067,1,0,0,0,2067,2071,3,214,107,
	0,2068,2069,10,22,0,0,2069,2071,3,224,112,0,2070,1967,1,0,0,0,2070,1970,
	1,0,0,0,2070,1973,1,0,0,0,2070,1976,1,0,0,0,2070,1979,1,0,0,0,2070,1982,
	1,0,0,0,2070,1985,1,0,0,0,2070,1988,1,0,0,0,2070,1991,1,0,0,0,2070,1994,
	1,0,0,0,2070,1997,1,0,0,0,2070,2000,1,0,0,0,2070,2006,1,0,0,0,2070,2013,
	1,0,0,0,2070,2017,1,0,0,0,2070,2022,1,0,0,0,2070,2024,1,0,0,0,2070,2030,
	1,0,0,0,2070,2038,1,0,0,0,2070,2061,1,0,0,0,2070,2068,1,0,0,0,2071,2074,
	1,0,0,0,2072,2070,1,0,0,0,2072,2073,1,0,0,0,2073,223,1,0,0,0,2074,2072,
	1,0,0,0,2075,2076,5,12,0,0,2076,2089,5,172,0,0,2077,2089,5,122,0,0,2078,
	2089,5,123,0,0,2079,2089,5,124,0,0,2080,2089,5,125,0,0,2081,2089,5,126,
	0,0,2082,2089,5,128,0,0,2083,2089,5,129,0,0,2084,2089,5,130,0,0,2085,2089,
	5,131,0,0,2086,2089,5,142,0,0,2087,2089,5,143,0,0,2088,2075,1,0,0,0,2088,
	2077,1,0,0,0,2088,2078,1,0,0,0,2088,2079,1,0,0,0,2088,2080,1,0,0,0,2088,
	2081,1,0,0,0,2088,2082,1,0,0,0,2088,2083,1,0,0,0,2088,2084,1,0,0,0,2088,
	2085,1,0,0,0,2088,2086,1,0,0,0,2088,2087,1,0,0,0,2089,225,1,0,0,0,2090,
	2091,7,18,0,0,2091,227,1,0,0,0,2092,2107,5,152,0,0,2093,2107,3,230,115,
	0,2094,2107,3,232,116,0,2095,2099,5,160,0,0,2096,2098,5,160,0,0,2097,2096,
	1,0,0,0,2098,2101,1,0,0,0,2099,2097,1,0,0,0,2099,2100,1,0,0,0,2100,2107,
	1,0,0,0,2101,2099,1,0,0,0,2102,2107,5,170,0,0,2103,2107,5,171,0,0,2104,
	2107,5,161,0,0,2105,2107,5,162,0,0,2106,2092,1,0,0,0,2106,2093,1,0,0,0,
	2106,2094,1,0,0,0,2106,2095,1,0,0,0,2106,2102,1,0,0,0,2106,2103,1,0,0,0,
	2106,2104,1,0,0,0,2106,2105,1,0,0,0,2107,229,1,0,0,0,2108,2110,5,155,0,
	0,2109,2111,5,153,0,0,2110,2109,1,0,0,0,2110,2111,1,0,0,0,2111,231,1,0,
	0,0,2112,2113,5,154,0,0,2113,233,1,0,0,0,2114,2115,5,148,0,0,2115,2158,
	5,52,0,0,2116,2158,5,148,0,0,2117,2158,5,156,0,0,2118,2158,5,158,0,0,2119,
	2158,5,157,0,0,2120,2158,5,165,0,0,2121,2158,5,166,0,0,2122,2158,5,149,
	0,0,2123,2158,5,150,0,0,2124,2158,5,167,0,0,2125,2158,5,168,0,0,2126,2127,
	5,7,0,0,2127,2136,5,40,0,0,2128,2133,3,234,117,0,2129,2130,5,5,0,0,2130,
	2132,3,234,117,0,2131,2129,1,0,0,0,2132,2135,1,0,0,0,2133,2131,1,0,0,0,
	2133,2134,1,0,0,0,2134,2137,1,0,0,0,2135,2133,1,0,0,0,2136,2128,1,0,0,0,
	2136,2137,1,0,0,0,2137,2138,1,0,0,0,2138,2151,5,41,0,0,2139,2140,5,70,0,
	0,2140,2141,5,40,0,0,2141,2146,3,234,117,0,2142,2143,5,5,0,0,2143,2145,
	3,234,117,0,2144,2142,1,0,0,0,2145,2148,1,0,0,0,2146,2144,1,0,0,0,2146,
	2147,1,0,0,0,2147,2149,1,0,0,0,2148,2146,1,0,0,0,2149,2150,5,41,0,0,2150,
	2152,1,0,0,0,2151,2139,1,0,0,0,2151,2152,1,0,0,0,2152,2158,1,0,0,0,2153,
	2154,5,172,0,0,2154,2155,5,12,0,0,2155,2158,5,172,0,0,2156,2158,5,172,0,
	0,2157,2114,1,0,0,0,2157,2116,1,0,0,0,2157,2117,1,0,0,0,2157,2118,1,0,0,
	0,2157,2119,1,0,0,0,2157,2120,1,0,0,0,2157,2121,1,0,0,0,2157,2122,1,0,0,
	0,2157,2123,1,0,0,0,2157,2124,1,0,0,0,2157,2125,1,0,0,0,2157,2126,1,0,0,
	0,2157,2153,1,0,0,0,2157,2156,1,0,0,0,2158,235,1,0,0,0,2159,2160,7,19,0,
	0,2160,237,1,0,0,0,216,241,247,259,261,266,285,289,296,301,309,313,319,
	329,332,342,346,352,355,359,364,368,381,384,398,401,407,413,419,425,431,
	437,443,458,473,477,487,493,499,505,511,517,523,529,535,540,548,551,568,
	570,581,587,591,603,607,609,613,619,631,635,637,651,667,671,678,696,701,
	708,719,725,732,740,751,760,766,777,784,790,797,803,809,813,821,826,834,
	844,849,853,865,874,876,882,888,895,906,912,916,922,929,945,954,958,964,
	973,977,985,989,997,1001,1003,1011,1020,1025,1031,1036,1071,1097,1111,1123,
	1127,1132,1137,1146,1150,1152,1174,1179,1185,1194,1203,1207,1209,1218,1223,
	1234,1249,1266,1286,1292,1300,1308,1318,1330,1340,1351,1358,1365,1375,1440,
	1444,1453,1463,1475,1483,1535,1551,1576,1588,1601,1605,1615,1623,1629,1635,
	1644,1648,1650,1656,1664,1668,1670,1673,1686,1692,1701,1705,1707,1716,1730,
	1740,1748,1752,1754,1772,1776,1778,1782,1794,1798,1800,1810,1814,1828,1832,
	1845,1853,1928,1932,1934,1956,1965,2042,2051,2055,2057,2065,2070,2072,2088,
	2099,2106,2110,2133,2136,2146,2151,2157];

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
	public contractDefinition(): ContractDefinitionContext {
		return this.getTypedRuleContext(ContractDefinitionContext, 0) as ContractDefinitionContext;
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


export class MappingAssignStatementContext extends ParserRuleContext {
	public _op!: Token;
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
	public _op!: Token;
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
