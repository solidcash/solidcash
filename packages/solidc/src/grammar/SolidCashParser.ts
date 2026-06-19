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
			if (_la===70) {
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
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
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
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 371;
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
			this.state = 373;
			this.versionConstraint();
			this.state = 375;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 2364538880) !== 0) || _la===151) {
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
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 2364538880) !== 0)) {
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
			this.state = 384;
			this.match(SolidCashParser.T__31);
			this.state = 385;
			this.match(SolidCashParser.Identifier);
			this.state = 395;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===33) {
				{
				this.state = 386;
				this.match(SolidCashParser.T__32);
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
			while (_la===46) {
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
			while (_la===45) {
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
			while (_la===47) {
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
			while (_la===39) {
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
			while (_la===34 || _la===35) {
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
			this.state = 461;
			this.match(SolidCashParser.T__6);
			this.state = 462;
			this.match(SolidCashParser.Identifier);
			this.state = 463;
			this.parameterList();
			this.state = 465;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===70) {
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
			this.match(SolidCashParser.T__35);
			this.state = 470;
			this.match(SolidCashParser.Identifier);
			this.state = 471;
			this.match(SolidCashParser.T__3);
			this.state = 475;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===46) {
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
			while (_la===45) {
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
			while (_la===47) {
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
			while (_la===39) {
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
			if (_la===37) {
				{
				this.state = 510;
				this.match(SolidCashParser.T__36);
				}
			}

			this.state = 513;
			this.match(SolidCashParser.T__37);
			this.state = 514;
			this.match(SolidCashParser.Identifier);
			this.state = 516;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 515;
				this.parameterList();
				}
			}

			this.state = 527;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===33) {
				{
				this.state = 518;
				this.match(SolidCashParser.T__32);
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
			while (_la===7 || _la===8 || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 74693667) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
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
			while (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 4029480963) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 15) !== 0)) {
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
			while (_la===172) {
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
			if (_la===70) {
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
			this.match(SolidCashParser.T__38);
			this.state = 572;
			this.match(SolidCashParser.Identifier);
			this.state = 573;
			this.match(SolidCashParser.T__39);
			this.state = 585;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
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
			this.match(SolidCashParser.T__40);
			this.state = 589;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 588;
				this.match(SolidCashParser.T__41);
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
			if (_la===43) {
				{
				this.state = 594;
				this.match(SolidCashParser.T__42);
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
			this.match(SolidCashParser.T__43);
			this.state = 600;
			this.match(SolidCashParser.Identifier);
			this.state = 601;
			this.match(SolidCashParser.T__39);
			this.state = 613;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
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
			this.match(SolidCashParser.T__40);
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
			this.match(SolidCashParser.T__44);
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
			} while (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0));
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
			this.match(SolidCashParser.T__45);
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
			if (_la===31) {
				{
				this.state = 652;
				this.match(SolidCashParser.T__30);
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
			this.match(SolidCashParser.T__46);
			this.state = 657;
			this.match(SolidCashParser.Identifier);
			this.state = 658;
			this.match(SolidCashParser.T__32);
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
			this.match(SolidCashParser.T__47);
			this.state = 664;
			this.match(SolidCashParser.Identifier);
			this.state = 665;
			this.match(SolidCashParser.T__30);
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
			this.match(SolidCashParser.T__48);
			this.state = 670;
			this.parameterList();
			this.state = 672;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 65539) !== 0)) {
				{
				this.state = 671;
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

			this.state = 677;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===172) {
				{
				{
				this.state = 674;
				this.parentInvocation();
				}
				}
				this.state = 679;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 680;
			this.match(SolidCashParser.T__3);
			this.state = 684;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 681;
				this.statement();
				}
				}
				this.state = 686;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 687;
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
			this.state = 689;
			this.match(SolidCashParser.T__50);
			this.state = 690;
			this.parameterList();
			this.state = 691;
			this.match(SolidCashParser.T__34);
			this.state = 695;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 52)) & ~0x1F) === 0 && ((1 << (_la - 52)) & 65539) !== 0)) {
				{
				{
				this.state = 692;
				this.fallbackModifier();
				}
				}
				this.state = 697;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 701;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===172) {
				{
				{
				this.state = 698;
				this.customModifierInvocation();
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
	public fallbackModifier(): FallbackModifierContext {
		let localctx: FallbackModifierContext = new FallbackModifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 64, SolidCashParser.RULE_fallbackModifier);
		try {
			this.state = 716;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 52:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 713;
				this.match(SolidCashParser.T__51);
				}
				break;
			case 53:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 714;
				this.match(SolidCashParser.T__52);
				}
				break;
			case 68:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 715;
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
			this.state = 718;
			this.match(SolidCashParser.T__53);
			this.state = 719;
			this.match(SolidCashParser.T__39);
			this.state = 720;
			this.match(SolidCashParser.T__40);
			this.state = 721;
			this.match(SolidCashParser.T__34);
			this.state = 722;
			this.match(SolidCashParser.T__51);
			this.state = 723;
			this.match(SolidCashParser.T__3);
			this.state = 727;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 724;
				this.statement();
				}
				}
				this.state = 729;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 730;
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
			this.state = 732;
			this.match(SolidCashParser.Identifier);
			this.state = 733;
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
			this.state = 785;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 75, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 736;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 2162691) !== 0)) {
					{
					this.state = 735;
					this.stateVariableVisibility();
					}
				}

				this.state = 738;
				this.typeName();
				this.state = 742;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 739;
					this.modifier();
					}
					}
					this.state = 744;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 745;
				this.match(SolidCashParser.Identifier);
				this.state = 746;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 748;
				this.typeName();
				this.state = 749;
				this.stateVariableVisibility();
				this.state = 753;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 750;
					this.modifier();
					}
					}
					this.state = 755;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 756;
				this.match(SolidCashParser.Identifier);
				this.state = 757;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
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
				this.mappingType();
				this.state = 766;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 2179075) !== 0) || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 763;
					this.collectionModifier();
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
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 773;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 2162691) !== 0)) {
					{
					this.state = 772;
					this.stateVariableVisibility();
					}
				}

				this.state = 775;
				this.arrayType(0);
				this.state = 779;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 2179075) !== 0) || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 776;
					this.collectionModifier();
					}
					}
					this.state = 781;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 782;
				this.match(SolidCashParser.Identifier);
				this.state = 783;
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
			this.state = 789;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 48:
			case 144:
			case 145:
			case 146:
			case 147:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 787;
				this.modifier();
				}
				break;
			case 34:
			case 35:
			case 50:
			case 55:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 788;
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
			this.state = 791;
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
			this.state = 829;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 82, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 793;
				this.match(SolidCashParser.T__55);
				this.state = 794;
				this.match(SolidCashParser.T__39);
				this.state = 795;
				this.typeName();
				this.state = 797;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 796;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 799;
				this.match(SolidCashParser.T__56);
				this.state = 800;
				this.typeName();
				this.state = 802;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 801;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 804;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 806;
				this.match(SolidCashParser.T__55);
				this.state = 807;
				this.match(SolidCashParser.T__39);
				this.state = 808;
				this.typeName();
				this.state = 810;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 809;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 812;
				this.match(SolidCashParser.T__56);
				this.state = 813;
				this.mappingType();
				this.state = 814;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 816;
				this.match(SolidCashParser.T__55);
				this.state = 817;
				this.match(SolidCashParser.T__39);
				this.state = 818;
				this.typeName();
				this.state = 820;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 819;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 822;
				this.match(SolidCashParser.T__56);
				this.state = 823;
				this.arrayType(0);
				this.state = 825;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 824;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 827;
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
			this.state = 841;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 83, this._ctx) ) {
			case 1:
				{
				this.state = 832;
				this.typeName();
				this.state = 833;
				this.match(SolidCashParser.T__57);
				this.state = 834;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 835;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				{
				this.state = 837;
				this.typeName();
				this.state = 838;
				this.match(SolidCashParser.T__57);
				this.state = 839;
				this.match(SolidCashParser.T__58);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 852;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 85, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 850;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 84, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 843;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 844;
						this.match(SolidCashParser.T__57);
						this.state = 845;
						this.match(SolidCashParser.NumberLiteral);
						this.state = 846;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 847;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 848;
						this.match(SolidCashParser.T__57);
						this.state = 849;
						this.match(SolidCashParser.T__58);
						}
						break;
					}
					}
				}
				this.state = 854;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 85, this._ctx);
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
			this.state = 855;
			this.match(SolidCashParser.T__59);
			this.state = 856;
			this.match(SolidCashParser.Identifier);
			this.state = 858;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 857;
				this.parameterList();
				}
			}

			this.state = 860;
			this.match(SolidCashParser.T__3);
			this.state = 864;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2149847169) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 861;
				this.modifierStatement();
				}
				}
				this.state = 866;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 867;
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
			this.state = 871;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 61:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 869;
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
				this.state = 870;
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
			this.state = 873;
			this.match(SolidCashParser.T__60);
			this.state = 874;
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
			this.state = 876;
			this.match(SolidCashParser.T__6);
			this.state = 877;
			this.match(SolidCashParser.Identifier);
			this.state = 878;
			this.parameterList();
			this.state = 882;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 4029480963) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 15) !== 0)) {
				{
				{
				this.state = 879;
				this.functionModifier();
				}
				}
				this.state = 884;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 888;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===172) {
				{
				{
				this.state = 885;
				this.customModifierInvocation();
				}
				}
				this.state = 890;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 892;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===70) {
				{
				this.state = 891;
				this.returnType();
				}
			}

			this.state = 894;
			this.match(SolidCashParser.T__3);
			this.state = 898;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 895;
				this.statement();
				}
				}
				this.state = 900;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 901;
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
			this.state = 903;
			this.match(SolidCashParser.Identifier);
			this.state = 905;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 904;
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
			this.state = 921;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 62:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 907;
				this.match(SolidCashParser.T__61);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 908;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 50:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 909;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 35:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 910;
				this.match(SolidCashParser.T__34);
				}
				break;
			case 34:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 911;
				this.match(SolidCashParser.T__33);
				}
				break;
			case 55:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 912;
				this.match(SolidCashParser.T__54);
				}
				break;
			case 52:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 913;
				this.match(SolidCashParser.T__51);
				}
				break;
			case 68:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 914;
				this.overrideSpecifier();
				}
				break;
			case 53:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 915;
				this.match(SolidCashParser.T__52);
				}
				break;
			case 69:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 916;
				this.unsafeModifier();
				}
				break;
			case 64:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 917;
				this.match(SolidCashParser.T__63);
				}
				break;
			case 65:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 918;
				this.match(SolidCashParser.T__64);
				}
				break;
			case 66:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 919;
				this.match(SolidCashParser.T__65);
				}
				break;
			case 67:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 920;
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
			this.state = 923;
			this.match(SolidCashParser.T__67);
			this.state = 934;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 924;
				this.match(SolidCashParser.T__39);
				this.state = 925;
				this.match(SolidCashParser.Identifier);
				this.state = 930;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 926;
					this.match(SolidCashParser.T__4);
					this.state = 927;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 932;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 933;
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
			this.state = 936;
			this.match(SolidCashParser.T__68);
			this.state = 940;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 937;
				this.match(SolidCashParser.T__39);
				this.state = 938;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 939;
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
			this.state = 942;
			this.match(SolidCashParser.T__69);
			this.state = 943;
			this.match(SolidCashParser.T__39);
			this.state = 944;
			this.returnParam();
			this.state = 949;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 98, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 945;
					this.match(SolidCashParser.T__4);
					this.state = 946;
					this.returnParam();
					}
					}
				}
				this.state = 951;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 98, this._ctx);
			}
			this.state = 953;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 952;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 955;
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
			this.state = 957;
			this.typeName();
			this.state = 961;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
				{
				{
				this.state = 958;
				this.modifier();
				}
				}
				this.state = 963;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 965;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===172) {
				{
				this.state = 964;
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
			this.state = 967;
			this.match(SolidCashParser.T__39);
			this.state = 979;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
				{
				this.state = 968;
				this.parameter();
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
						this.parameter();
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

				}
			}

			this.state = 981;
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
			this.state = 1001;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 107, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 983;
				this.typeName();
				this.state = 987;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 984;
					this.modifier();
					}
					}
					this.state = 989;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 990;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 992;
				this.arrayType(0);
				this.state = 996;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 993;
					this.modifier();
					}
					}
					this.state = 998;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 999;
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
			this.state = 1012;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1003;
				this.match(SolidCashParser.T__3);
				this.state = 1007;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
					{
					{
					this.state = 1004;
					this.statement();
					}
					}
					this.state = 1009;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1010;
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
				this.state = 1011;
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
			this.state = 1047;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 110, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1014;
				this.variableDefinition();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1015;
				this.tupleAssignment();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1016;
				this.arrayAssignStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1017;
				this.arrayPushStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1018;
				this.arrayPopStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1019;
				this.arrayDeleteStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1020;
				this.stateArrayPushStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1021;
				this.stateArrayPopStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1022;
				this.assignStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1023;
				this.stateAssignStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1024;
				this.mappingFieldAssignStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1025;
				this.mappingAssignStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1026;
				this.mappingDeleteStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1027;
				this.timeOpStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1028;
				this.requireStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1029;
				this.ifStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1030;
				this.loopStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1031;
				this.consoleStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1032;
				this.emitStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1033;
				this.transferStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1034;
				this.tokenContainerMethodStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1035;
				this.returnStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1036;
				this.functionCallStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1037;
				this.addressMethodStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1038;
				this.assemblyStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1039;
				this.tryCatchStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1040;
				this.revertStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1041;
				this.assertStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1042;
				this.deleteStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1043;
				this.uncheckedStatement();
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 31);
				{
				this.state = 1044;
				this.switchStatement();
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 32);
				{
				this.state = 1045;
				this.breakStatement();
				}
				break;
			case 33:
				this.enterOuterAlt(localctx, 33);
				{
				this.state = 1046;
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
			this.state = 1049;
			this.match(SolidCashParser.T__70);
			this.state = 1050;
			this.match(SolidCashParser.T__11);
			this.state = 1051;
			this.match(SolidCashParser.Identifier);
			this.state = 1052;
			this.match(SolidCashParser.T__39);
			this.state = 1053;
			this.expression(0);
			this.state = 1054;
			this.match(SolidCashParser.T__4);
			this.state = 1055;
			this.expression(0);
			this.state = 1056;
			this.match(SolidCashParser.T__40);
			this.state = 1057;
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
			this.state = 1059;
			this.match(SolidCashParser.T__70);
			this.state = 1060;
			this.match(SolidCashParser.T__11);
			this.state = 1061;
			this.match(SolidCashParser.Identifier);
			this.state = 1062;
			this.match(SolidCashParser.T__57);
			this.state = 1063;
			this.expression(0);
			this.state = 1064;
			this.match(SolidCashParser.T__58);
			this.state = 1065;
			this.match(SolidCashParser.T__11);
			this.state = 1066;
			this.match(SolidCashParser.Identifier);
			this.state = 1067;
			this.match(SolidCashParser.T__39);
			this.state = 1068;
			this.expression(0);
			this.state = 1073;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1069;
				this.match(SolidCashParser.T__4);
				this.state = 1070;
				this.expression(0);
				}
				}
				this.state = 1075;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1076;
			this.match(SolidCashParser.T__40);
			this.state = 1077;
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
			this.state = 1108;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 115, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1079;
				this.match(SolidCashParser.T__71);
				this.state = 1080;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1081;
				this.match(SolidCashParser.T__71);
				this.state = 1082;
				this.expression(0);
				this.state = 1087;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1083;
					this.match(SolidCashParser.T__4);
					this.state = 1084;
					this.expression(0);
					}
					}
					this.state = 1089;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1090;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1092;
				this.match(SolidCashParser.T__71);
				this.state = 1093;
				this.match(SolidCashParser.T__39);
				this.state = 1094;
				this.expression(0);
				this.state = 1099;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 113, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1095;
						this.match(SolidCashParser.T__4);
						this.state = 1096;
						this.expression(0);
						}
						}
					}
					this.state = 1101;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 113, this._ctx);
				}
				this.state = 1103;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1102;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1105;
				this.match(SolidCashParser.T__40);
				this.state = 1106;
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
			this.state = 1132;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 117, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1110;
				this.match(SolidCashParser.Identifier);
				this.state = 1111;
				this.expressionList();
				this.state = 1112;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1114;
				this.match(SolidCashParser.Identifier);
				this.state = 1115;
				this.match(SolidCashParser.T__11);
				this.state = 1116;
				this.match(SolidCashParser.Identifier);
				this.state = 1117;
				this.expressionList();
				this.state = 1118;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1120;
				this.match(SolidCashParser.Identifier);
				this.state = 1121;
				this.expressionList();
				this.state = 1122;
				this.match(SolidCashParser.T__11);
				this.state = 1123;
				this.match(SolidCashParser.Identifier);
				this.state = 1124;
				this.match(SolidCashParser.T__11);
				this.state = 1125;
				this.match(SolidCashParser.Identifier);
				this.state = 1127;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1126;
					this.callOptions();
					}
				}

				this.state = 1129;
				this.expressionList();
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
	public addressMethodStatement(): AddressMethodStatementContext {
		let localctx: AddressMethodStatementContext = new AddressMethodStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 116, SolidCashParser.RULE_addressMethodStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1134;
			this.expression(0);
			this.state = 1135;
			this.match(SolidCashParser.T__11);
			this.state = 1136;
			this.match(SolidCashParser.Identifier);
			this.state = 1138;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===4) {
				{
				this.state = 1137;
				this.callOptions();
				}
			}

			this.state = 1140;
			this.expressionList();
			this.state = 1141;
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
			this.state = 1143;
			this.match(SolidCashParser.T__72);
			this.state = 1144;
			this.match(SolidCashParser.Identifier);
			this.state = 1145;
			this.expressionList();
			this.state = 1146;
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
			this.state = 1148;
			this.match(SolidCashParser.T__70);
			this.state = 1149;
			this.match(SolidCashParser.T__11);
			this.state = 1150;
			this.match(SolidCashParser.Identifier);
			this.state = 1155;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 1151;
				this.match(SolidCashParser.T__57);
				this.state = 1152;
				this.expression(0);
				this.state = 1153;
				this.match(SolidCashParser.T__58);
				}
				}
				this.state = 1157;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===58);
			this.state = 1159;
			this.match(SolidCashParser.T__30);
			this.state = 1160;
			this.expression(0);
			this.state = 1161;
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
			this.state = 1163;
			this.match(SolidCashParser.T__70);
			this.state = 1164;
			this.match(SolidCashParser.T__11);
			this.state = 1165;
			this.match(SolidCashParser.Identifier);
			this.state = 1170;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 1166;
				this.match(SolidCashParser.T__57);
				this.state = 1167;
				this.expression(0);
				this.state = 1168;
				this.match(SolidCashParser.T__58);
				}
				}
				this.state = 1172;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===58);
			this.state = 1174;
			this.match(SolidCashParser.T__11);
			this.state = 1175;
			this.match(SolidCashParser.Identifier);
			this.state = 1176;
			this.match(SolidCashParser.T__30);
			this.state = 1177;
			this.expression(0);
			this.state = 1178;
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
			this.state = 1180;
			this.match(SolidCashParser.T__70);
			this.state = 1181;
			this.match(SolidCashParser.T__11);
			this.state = 1182;
			this.match(SolidCashParser.Identifier);
			this.state = 1189;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===58) {
				{
				{
				this.state = 1183;
				this.match(SolidCashParser.T__57);
				this.state = 1184;
				this.expression(0);
				this.state = 1185;
				this.match(SolidCashParser.T__58);
				}
				}
				this.state = 1191;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1192;
			this.match(SolidCashParser.T__73);
			this.state = 1193;
			this.match(SolidCashParser.T__39);
			this.state = 1194;
			this.expression(0);
			this.state = 1195;
			this.match(SolidCashParser.T__40);
			this.state = 1196;
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
			this.state = 1198;
			this.match(SolidCashParser.T__70);
			this.state = 1199;
			this.match(SolidCashParser.T__11);
			this.state = 1200;
			this.match(SolidCashParser.Identifier);
			this.state = 1201;
			this.match(SolidCashParser.T__30);
			this.state = 1202;
			this.expression(0);
			this.state = 1203;
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
			this.state = 1231;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 125, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1205;
				this.typeName();
				this.state = 1209;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 1206;
					this.modifier();
					}
					}
					this.state = 1211;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1212;
				this.match(SolidCashParser.Identifier);
				this.state = 1215;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===31) {
					{
					this.state = 1213;
					this.match(SolidCashParser.T__30);
					this.state = 1214;
					this.expression(0);
					}
				}

				this.state = 1217;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1219;
				this.arrayType(0);
				this.state = 1223;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 1220;
					this.modifier();
					}
					}
					this.state = 1225;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1226;
				this.match(SolidCashParser.Identifier);
				this.state = 1227;
				this.match(SolidCashParser.T__30);
				this.state = 1228;
				this.expression(0);
				this.state = 1229;
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
			this.state = 1281;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 130, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1233;
				this.typeName();
				this.state = 1234;
				this.match(SolidCashParser.Identifier);
				this.state = 1239;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1235;
					this.match(SolidCashParser.T__4);
					this.state = 1236;
					this.typeName();
					this.state = 1237;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1241;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1243;
				this.match(SolidCashParser.T__30);
				this.state = 1244;
				this.expression(0);
				this.state = 1245;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1247;
				this.match(SolidCashParser.T__39);
				this.state = 1248;
				this.tupleSlot();
				this.state = 1251;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1249;
					this.match(SolidCashParser.T__4);
					this.state = 1250;
					this.tupleSlot();
					}
					}
					this.state = 1253;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1255;
				this.match(SolidCashParser.T__40);
				this.state = 1256;
				this.match(SolidCashParser.T__30);
				this.state = 1257;
				this.match(SolidCashParser.T__39);
				this.state = 1258;
				this.expression(0);
				this.state = 1261;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1259;
					this.match(SolidCashParser.T__4);
					this.state = 1260;
					this.expression(0);
					}
					}
					this.state = 1263;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1265;
				this.match(SolidCashParser.T__40);
				this.state = 1266;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1268;
				this.match(SolidCashParser.T__39);
				this.state = 1269;
				this.tupleSlot();
				this.state = 1272;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1270;
					this.match(SolidCashParser.T__4);
					this.state = 1271;
					this.tupleSlot();
					}
					}
					this.state = 1274;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1276;
				this.match(SolidCashParser.T__40);
				this.state = 1277;
				this.match(SolidCashParser.T__30);
				this.state = 1278;
				this.expression(0);
				this.state = 1279;
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
			this.state = 1288;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 131, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1283;
				this.typeName();
				this.state = 1284;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1286;
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
			this.state = 1298;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 132, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1290;
				this.match(SolidCashParser.Identifier);
				this.state = 1291;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===31 || ((((_la - 75)) & ~0x1F) === 0 && ((1 << (_la - 75)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1292;
				this.expression(0);
				this.state = 1293;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1295;
				this.match(SolidCashParser.Identifier);
				this.state = 1296;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===85 || _la===86)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1297;
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
			this.state = 1300;
			this.match(SolidCashParser.Identifier);
			this.state = 1301;
			this.match(SolidCashParser.T__86);
			this.state = 1302;
			this.match(SolidCashParser.T__39);
			this.state = 1303;
			this.expression(0);
			this.state = 1304;
			this.match(SolidCashParser.T__40);
			this.state = 1305;
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
			this.state = 1307;
			this.match(SolidCashParser.Identifier);
			this.state = 1308;
			this.match(SolidCashParser.T__87);
			this.state = 1309;
			this.match(SolidCashParser.T__39);
			this.state = 1310;
			this.match(SolidCashParser.T__40);
			this.state = 1311;
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
			this.state = 1313;
			this.match(SolidCashParser.Identifier);
			this.state = 1314;
			this.match(SolidCashParser.T__57);
			this.state = 1315;
			this.expression(0);
			this.state = 1316;
			this.match(SolidCashParser.T__58);
			this.state = 1317;
			this.match(SolidCashParser.T__30);
			this.state = 1318;
			this.expression(0);
			this.state = 1319;
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
			this.state = 1321;
			this.match(SolidCashParser.Identifier);
			this.state = 1322;
			this.match(SolidCashParser.T__73);
			this.state = 1323;
			this.match(SolidCashParser.T__39);
			this.state = 1324;
			this.expression(0);
			this.state = 1325;
			this.match(SolidCashParser.T__40);
			this.state = 1326;
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
			this.state = 1328;
			this.match(SolidCashParser.T__70);
			this.state = 1329;
			this.match(SolidCashParser.T__11);
			this.state = 1330;
			this.match(SolidCashParser.Identifier);
			this.state = 1331;
			this.match(SolidCashParser.T__86);
			this.state = 1332;
			this.match(SolidCashParser.T__39);
			this.state = 1333;
			this.expression(0);
			this.state = 1334;
			this.match(SolidCashParser.T__40);
			this.state = 1335;
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
			this.state = 1337;
			this.match(SolidCashParser.T__70);
			this.state = 1338;
			this.match(SolidCashParser.T__11);
			this.state = 1339;
			this.match(SolidCashParser.Identifier);
			this.state = 1340;
			this.match(SolidCashParser.T__87);
			this.state = 1341;
			this.match(SolidCashParser.T__39);
			this.state = 1342;
			this.match(SolidCashParser.T__40);
			this.state = 1343;
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
			this.state = 1367;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 134, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1345;
				this.match(SolidCashParser.T__88);
				this.state = 1346;
				this.match(SolidCashParser.Identifier);
				this.state = 1347;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1348;
				this.match(SolidCashParser.T__88);
				this.state = 1349;
				this.match(SolidCashParser.T__70);
				this.state = 1350;
				this.match(SolidCashParser.T__11);
				this.state = 1351;
				this.match(SolidCashParser.Identifier);
				this.state = 1352;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1353;
				this.match(SolidCashParser.T__88);
				this.state = 1354;
				this.match(SolidCashParser.T__70);
				this.state = 1355;
				this.match(SolidCashParser.T__11);
				this.state = 1356;
				this.match(SolidCashParser.Identifier);
				this.state = 1361;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1357;
					this.match(SolidCashParser.T__57);
					this.state = 1358;
					this.expression(0);
					this.state = 1359;
					this.match(SolidCashParser.T__58);
					}
					}
					this.state = 1363;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===58);
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
	public timeOpStatement(): TimeOpStatementContext {
		let localctx: TimeOpStatementContext = new TimeOpStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 150, SolidCashParser.RULE_timeOpStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1369;
			this.match(SolidCashParser.T__89);
			this.state = 1370;
			this.match(SolidCashParser.T__39);
			this.state = 1371;
			this.match(SolidCashParser.TxVar);
			this.state = 1372;
			this.match(SolidCashParser.T__22);
			this.state = 1373;
			this.expression(0);
			this.state = 1376;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1374;
				this.match(SolidCashParser.T__4);
				this.state = 1375;
				this.requireMessage();
				}
			}

			this.state = 1378;
			this.match(SolidCashParser.T__40);
			this.state = 1379;
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
			this.state = 1381;
			this.match(SolidCashParser.T__89);
			this.state = 1382;
			this.match(SolidCashParser.T__39);
			this.state = 1383;
			this.expression(0);
			this.state = 1386;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1384;
				this.match(SolidCashParser.T__4);
				this.state = 1385;
				this.requireMessage();
				}
			}

			this.state = 1388;
			this.match(SolidCashParser.T__40);
			this.state = 1389;
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
			this.state = 1391;
			this.match(SolidCashParser.T__90);
			this.state = 1392;
			this.match(SolidCashParser.T__39);
			this.state = 1393;
			this.expression(0);
			this.state = 1394;
			this.match(SolidCashParser.T__40);
			this.state = 1395;
			localctx._ifBlock = this.block();
			this.state = 1398;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 137, this._ctx) ) {
			case 1:
				{
				this.state = 1396;
				this.match(SolidCashParser.T__91);
				this.state = 1397;
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
			this.state = 1406;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 138, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1400;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1401;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1402;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1403;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1404;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1405;
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
			this.state = 1408;
			this.match(SolidCashParser.T__8);
			this.state = 1409;
			this.match(SolidCashParser.T__39);
			this.state = 1410;
			this.typeName();
			this.state = 1411;
			this.match(SolidCashParser.Identifier);
			this.state = 1412;
			this.match(SolidCashParser.T__4);
			this.state = 1413;
			this.typeName();
			this.state = 1414;
			this.match(SolidCashParser.Identifier);
			this.state = 1415;
			this.match(SolidCashParser.T__92);
			this.state = 1416;
			this.match(SolidCashParser.T__70);
			this.state = 1417;
			this.match(SolidCashParser.T__11);
			this.state = 1418;
			this.match(SolidCashParser.Identifier);
			this.state = 1419;
			this.match(SolidCashParser.T__11);
			this.state = 1420;
			this.match(SolidCashParser.T__93);
			this.state = 1421;
			this.match(SolidCashParser.T__40);
			this.state = 1422;
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
			this.state = 1424;
			this.match(SolidCashParser.T__8);
			this.state = 1425;
			this.match(SolidCashParser.T__39);
			this.state = 1426;
			this.typeName();
			this.state = 1427;
			this.match(SolidCashParser.Identifier);
			this.state = 1428;
			this.match(SolidCashParser.T__94);
			this.state = 1429;
			this.match(SolidCashParser.T__70);
			this.state = 1430;
			this.match(SolidCashParser.T__11);
			this.state = 1431;
			this.match(SolidCashParser.Identifier);
			this.state = 1432;
			this.match(SolidCashParser.T__40);
			this.state = 1433;
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
			this.state = 1435;
			this.match(SolidCashParser.T__8);
			this.state = 1436;
			this.match(SolidCashParser.T__39);
			this.state = 1437;
			this.typeName();
			this.state = 1438;
			this.match(SolidCashParser.Identifier);
			this.state = 1439;
			this.match(SolidCashParser.T__92);
			this.state = 1440;
			this.match(SolidCashParser.T__70);
			this.state = 1441;
			this.match(SolidCashParser.T__11);
			this.state = 1442;
			this.match(SolidCashParser.Identifier);
			this.state = 1443;
			this.match(SolidCashParser.T__40);
			this.state = 1444;
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
			this.state = 1446;
			this.match(SolidCashParser.T__8);
			this.state = 1447;
			this.match(SolidCashParser.T__39);
			this.state = 1448;
			this.forInit();
			this.state = 1449;
			this.forCondition();
			this.state = 1450;
			this.forUpdate();
			this.state = 1451;
			this.match(SolidCashParser.T__40);
			this.state = 1452;
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
			this.state = 1454;
			this.typeName();
			this.state = 1458;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
				{
				{
				this.state = 1455;
				this.modifier();
				}
				}
				this.state = 1460;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1461;
			this.match(SolidCashParser.Identifier);
			this.state = 1462;
			this.match(SolidCashParser.T__30);
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
	public forCondition(): ForConditionContext {
		let localctx: ForConditionContext = new ForConditionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 168, SolidCashParser.RULE_forCondition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1466;
			this.expression(0);
			this.state = 1467;
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
			this.state = 1474;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 140, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1469;
				this.match(SolidCashParser.Identifier);
				this.state = 1470;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===31 || ((((_la - 75)) & ~0x1F) === 0 && ((1 << (_la - 75)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1471;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1472;
				this.match(SolidCashParser.Identifier);
				this.state = 1473;
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
			this.state = 1476;
			this.match(SolidCashParser.T__95);
			this.state = 1477;
			this.block();
			this.state = 1478;
			this.match(SolidCashParser.T__96);
			this.state = 1479;
			this.match(SolidCashParser.T__39);
			this.state = 1480;
			this.expression(0);
			this.state = 1481;
			this.match(SolidCashParser.T__40);
			this.state = 1482;
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
			this.state = 1484;
			this.match(SolidCashParser.T__96);
			this.state = 1485;
			this.match(SolidCashParser.T__39);
			this.state = 1486;
			this.expression(0);
			this.state = 1487;
			this.match(SolidCashParser.T__40);
			this.state = 1488;
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
			this.state = 1490;
			this.match(SolidCashParser.T__97);
			this.state = 1491;
			this.consoleParameterList();
			this.state = 1492;
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
			this.state = 1494;
			this.match(SolidCashParser.T__98);
			this.state = 1495;
			this.match(SolidCashParser.T__3);
			this.state = 1499;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 155)) & ~0x1F) === 0 && ((1 << (_la - 155)) & 131201) !== 0)) {
				{
				{
				this.state = 1496;
				this.assemblyToken();
				}
				}
				this.state = 1501;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1502;
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
			this.state = 1504;
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
			this.state = 1506;
			this.match(SolidCashParser.T__99);
			this.state = 1507;
			this.match(SolidCashParser.T__3);
			this.state = 1511;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 1508;
				this.statement();
				}
				}
				this.state = 1513;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1514;
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
			this.state = 1516;
			this.match(SolidCashParser.T__100);
			this.state = 1517;
			this.match(SolidCashParser.T__39);
			this.state = 1518;
			this.expression(0);
			this.state = 1519;
			this.match(SolidCashParser.T__40);
			this.state = 1520;
			this.match(SolidCashParser.T__3);
			this.state = 1524;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===102) {
				{
				{
				this.state = 1521;
				this.switchCase();
				}
				}
				this.state = 1526;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1528;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===104) {
				{
				this.state = 1527;
				this.switchDefault();
				}
			}

			this.state = 1530;
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
			this.state = 1532;
			this.match(SolidCashParser.T__101);
			this.state = 1533;
			this.expression(0);
			this.state = 1534;
			this.match(SolidCashParser.T__102);
			this.state = 1538;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 1535;
				this.statement();
				}
				}
				this.state = 1540;
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
			this.state = 1541;
			this.match(SolidCashParser.T__103);
			this.state = 1542;
			this.match(SolidCashParser.T__102);
			this.state = 1546;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 1543;
				this.statement();
				}
				}
				this.state = 1548;
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
			this.state = 1549;
			this.match(SolidCashParser.T__104);
			this.state = 1550;
			this.expression(0);
			this.state = 1552;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===70) {
				{
				this.state = 1551;
				this.tryReturns();
				}
			}

			this.state = 1554;
			localctx._tryBlock = this.block();
			this.state = 1556;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1555;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1558;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 148, this._ctx);
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
			this.state = 1560;
			this.match(SolidCashParser.T__69);
			this.state = 1561;
			this.match(SolidCashParser.T__39);
			this.state = 1573;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
				{
				this.state = 1562;
				this.parameter();
				this.state = 1567;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 149, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1563;
						this.match(SolidCashParser.T__4);
						this.state = 1564;
						this.parameter();
						}
						}
					}
					this.state = 1569;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 149, this._ctx);
				}
				this.state = 1571;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1570;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1575;
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
			this.state = 1577;
			this.match(SolidCashParser.T__105);
			this.state = 1579;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 152, this._ctx) ) {
			case 1:
				{
				this.state = 1578;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 1596;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 156, this._ctx) ) {
			case 1:
				{
				this.state = 1581;
				this.match(SolidCashParser.T__39);
				this.state = 1593;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
					{
					this.state = 1582;
					this.parameter();
					this.state = 1587;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 153, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1583;
							this.match(SolidCashParser.T__4);
							this.state = 1584;
							this.parameter();
							}
							}
						}
						this.state = 1589;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 153, this._ctx);
					}
					this.state = 1591;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1590;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1595;
				this.match(SolidCashParser.T__40);
				}
				break;
			}
			this.state = 1598;
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
	public continueStatement(): ContinueStatementContext {
		let localctx: ContinueStatementContext = new ContinueStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 198, SolidCashParser.RULE_continueStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1603;
			this.match(SolidCashParser.T__107);
			this.state = 1604;
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
			this.state = 1609;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 160:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1606;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 172:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1607;
				this.match(SolidCashParser.Identifier);
				this.state = 1608;
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
			this.state = 1625;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 158, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1611;
				this.match(SolidCashParser.T__108);
				this.state = 1612;
				this.match(SolidCashParser.Identifier);
				this.state = 1613;
				this.expressionList();
				this.state = 1614;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1616;
				this.match(SolidCashParser.T__108);
				this.state = 1617;
				this.match(SolidCashParser.T__39);
				this.state = 1618;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1619;
				this.match(SolidCashParser.T__40);
				this.state = 1620;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1621;
				this.match(SolidCashParser.T__108);
				this.state = 1622;
				this.match(SolidCashParser.T__39);
				this.state = 1623;
				this.match(SolidCashParser.T__40);
				this.state = 1624;
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
			this.state = 1627;
			this.match(SolidCashParser.T__109);
			this.state = 1628;
			this.match(SolidCashParser.T__39);
			this.state = 1629;
			this.expression(0);
			this.state = 1630;
			this.match(SolidCashParser.T__40);
			this.state = 1631;
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
			this.state = 1635;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 172:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1633;
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
				this.state = 1634;
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
			this.state = 1637;
			this.match(SolidCashParser.T__39);
			this.state = 1649;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 152)) & ~0x1F) === 0 && ((1 << (_la - 152)) & 1836813) !== 0)) {
				{
				this.state = 1638;
				this.consoleParameter();
				this.state = 1643;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 160, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1639;
						this.match(SolidCashParser.T__4);
						this.state = 1640;
						this.consoleParameter();
						}
						}
					}
					this.state = 1645;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 160, this._ctx);
				}
				this.state = 1647;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1646;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1651;
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
			this.state = 1677;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 166, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1653;
				this.match(SolidCashParser.Identifier);
				this.state = 1654;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1655;
				this.match(SolidCashParser.Identifier);
				this.state = 1656;
				this.match(SolidCashParser.T__11);
				this.state = 1657;
				this.match(SolidCashParser.Identifier);
				this.state = 1658;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1659;
				this.match(SolidCashParser.Identifier);
				this.state = 1660;
				this.match(SolidCashParser.T__39);
				this.state = 1661;
				this.match(SolidCashParser.T__3);
				this.state = 1673;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 1662;
					this.namedArg();
					this.state = 1667;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 163, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1663;
							this.match(SolidCashParser.T__4);
							this.state = 1664;
							this.namedArg();
							}
							}
						}
						this.state = 1669;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 163, this._ctx);
					}
					this.state = 1671;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1670;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1675;
				this.match(SolidCashParser.T__5);
				this.state = 1676;
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
			this.state = 1679;
			this.match(SolidCashParser.Identifier);
			this.state = 1680;
			this.match(SolidCashParser.T__102);
			this.state = 1681;
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
			this.state = 1683;
			this.match(SolidCashParser.T__39);
			this.state = 1695;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===14 || _la===27 || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 111)) & ~0x1F) === 0 && ((1 << (_la - 111)) & 33622015) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				this.state = 1684;
				this.expression(0);
				this.state = 1689;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 167, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1685;
						this.match(SolidCashParser.T__4);
						this.state = 1686;
						this.expression(0);
						}
						}
					}
					this.state = 1691;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 167, this._ctx);
				}
				this.state = 1693;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1692;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1697;
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
			this.state = 1699;
			this.match(SolidCashParser.T__3);
			this.state = 1700;
			this.callOption();
			this.state = 1705;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 170, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1701;
					this.match(SolidCashParser.T__4);
					this.state = 1702;
					this.callOption();
					}
					}
				}
				this.state = 1707;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 170, this._ctx);
			}
			this.state = 1709;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1708;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1711;
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
			this.state = 1713;
			this.match(SolidCashParser.Identifier);
			this.state = 1714;
			this.match(SolidCashParser.T__102);
			this.state = 1715;
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
			this.state = 1717;
			this.match(SolidCashParser.T__39);
			this.state = 1718;
			this.typeName();
			this.state = 1723;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 172, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1719;
					this.match(SolidCashParser.T__4);
					this.state = 1720;
					this.typeName();
					}
					}
				}
				this.state = 1725;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 172, this._ctx);
			}
			this.state = 1727;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1726;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1729;
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
			this.state = 1860;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 180, this._ctx) ) {
			case 1:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 1732;
				this.match(SolidCashParser.T__39);
				this.state = 1733;
				this.expression(0);
				this.state = 1734;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 2:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1736;
				this.typeCast();
				this.state = 1737;
				this.match(SolidCashParser.T__39);
				this.state = 1738;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 1740;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1739;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1742;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 3:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1744;
				this.functionCall();
				}
				break;
			case 4:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1745;
				this.match(SolidCashParser.T__110);
				this.state = 1746;
				this.match(SolidCashParser.Identifier);
				this.state = 1748;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1747;
					this.callOptions();
					}
				}

				this.state = 1750;
				this.expressionList();
				}
				break;
			case 5:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1751;
				this.match(SolidCashParser.T__110);
				this.state = 1752;
				this.typeName();
				this.state = 1753;
				this.match(SolidCashParser.T__57);
				this.state = 1754;
				this.match(SolidCashParser.T__58);
				this.state = 1755;
				this.match(SolidCashParser.T__39);
				this.state = 1756;
				this.expression(0);
				this.state = 1757;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 6:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1759;
				this.match(SolidCashParser.T__46);
				this.state = 1760;
				this.match(SolidCashParser.T__39);
				this.state = 1761;
				this.typeName();
				this.state = 1762;
				this.match(SolidCashParser.T__40);
				this.state = 1763;
				this.match(SolidCashParser.T__11);
				this.state = 1764;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 7:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1766;
				this.match(SolidCashParser.T__111);
				this.state = 1767;
				this.expressionList();
				}
				break;
			case 8:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1768;
				this.match(SolidCashParser.T__112);
				this.state = 1769;
				this.expressionList();
				}
				break;
			case 9:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1770;
				this.match(SolidCashParser.T__113);
				this.state = 1771;
				this.expressionList();
				}
				break;
			case 10:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1772;
				this.match(SolidCashParser.T__114);
				this.state = 1773;
				this.expressionList();
				}
				break;
			case 11:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1774;
				this.match(SolidCashParser.T__115);
				this.state = 1775;
				this.match(SolidCashParser.T__39);
				this.state = 1776;
				this.match(SolidCashParser.Identifier);
				this.state = 1777;
				this.match(SolidCashParser.T__11);
				this.state = 1778;
				this.match(SolidCashParser.Identifier);
				this.state = 1779;
				this.match(SolidCashParser.T__4);
				this.state = 1780;
				this.expressionList();
				this.state = 1781;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 12:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1783;
				this.match(SolidCashParser.T__116);
				this.state = 1784;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1785;
				this.match(SolidCashParser.T__117);
				this.state = 1786;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1787;
				this.match(SolidCashParser.T__118);
				this.state = 1788;
				this.match(SolidCashParser.T__39);
				this.state = 1789;
				this.expression(0);
				this.state = 1790;
				this.match(SolidCashParser.T__4);
				this.state = 1791;
				this.typeList();
				this.state = 1792;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 15:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1794;
				this.match(SolidCashParser.T__119);
				this.state = 1795;
				this.match(SolidCashParser.T__39);
				this.state = 1796;
				this.expression(0);
				this.state = 1797;
				this.match(SolidCashParser.T__4);
				this.state = 1798;
				this.typeList();
				this.state = 1799;
				this.match(SolidCashParser.T__4);
				this.state = 1800;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1801;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 16:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1803;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__120);
				this.state = 1804;
				this.match(SolidCashParser.T__57);
				this.state = 1805;
				this.expression(0);
				this.state = 1806;
				this.match(SolidCashParser.T__58);
				this.state = 1807;
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
				this.state = 1809;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__126);
				this.state = 1810;
				this.match(SolidCashParser.T__57);
				this.state = 1811;
				this.expression(0);
				this.state = 1812;
				this.match(SolidCashParser.T__58);
				this.state = 1813;
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
				this.state = 1815;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===136)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1816;
				this.expression(21);
				}
				break;
			case 19:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1817;
				this.match(SolidCashParser.T__57);
				this.state = 1829;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===14 || _la===27 || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 111)) & ~0x1F) === 0 && ((1 << (_la - 111)) & 33622015) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
					{
					this.state = 1818;
					this.expression(0);
					this.state = 1823;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 176, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1819;
							this.match(SolidCashParser.T__4);
							this.state = 1820;
							this.expression(0);
							}
							}
						}
						this.state = 1825;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 176, this._ctx);
					}
					this.state = 1827;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1826;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1831;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 20:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1832;
				this.match(SolidCashParser.T__70);
				this.state = 1833;
				this.match(SolidCashParser.T__11);
				this.state = 1834;
				this.match(SolidCashParser.Identifier);
				this.state = 1835;
				this.match(SolidCashParser.T__11);
				this.state = 1836;
				this.match(SolidCashParser.Identifier);
				this.state = 1837;
				this.match(SolidCashParser.T__57);
				this.state = 1838;
				this.expression(0);
				this.state = 1839;
				this.match(SolidCashParser.T__58);
				this.state = 1840;
				this.memberName();
				}
				break;
			case 21:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1842;
				this.match(SolidCashParser.T__70);
				this.state = 1843;
				this.match(SolidCashParser.T__11);
				this.state = 1844;
				this.match(SolidCashParser.Identifier);
				this.state = 1849;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 1845;
						this.match(SolidCashParser.T__57);
						this.state = 1846;
						this.expression(0);
						this.state = 1847;
						this.match(SolidCashParser.T__58);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 1851;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 179, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 22:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1853;
				this.match(SolidCashParser.T__70);
				this.state = 1854;
				this.match(SolidCashParser.T__11);
				this.state = 1855;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 23:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1856;
				this.match(SolidCashParser.T__70);
				}
				break;
			case 24:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1857;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 25:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1858;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 26:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1859;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 1944;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 183, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 1942;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 182, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1862;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 1863;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 1864;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1865;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 1866;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1867;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1868;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 1869;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1870;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1871;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 1872;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===137 || _la===138)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1873;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1874;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 1875;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1876;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1877;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 1878;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1879;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1880;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 1881;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 1882;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1883;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 1884;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 1885;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1886;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 1887;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 1888;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1889;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 1890;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__138);
						this.state = 1891;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1892;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 1893;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__139);
						this.state = 1894;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1895;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 1896;
						this.match(SolidCashParser.T__140);
						this.state = 1897;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 1898;
						this.match(SolidCashParser.T__102);
						this.state = 1899;
						(localctx as TernaryOpContext)._ifFalse = this.expression(9);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1901;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 1902;
						this.match(SolidCashParser.T__57);
						this.state = 1903;
						(localctx as IndexRangeSliceContext)._start = this.expression(0);
						this.state = 1904;
						this.match(SolidCashParser.T__102);
						this.state = 1905;
						(localctx as IndexRangeSliceContext)._end = this.expression(0);
						this.state = 1906;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1908;
						if (!(this.precpred(this._ctx, 30))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 30)");
						}
						this.state = 1909;
						this.match(SolidCashParser.T__57);
						this.state = 1910;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 1911;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1912;
						if (!(this.precpred(this._ctx, 29))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 29)");
						}
						this.state = 1913;
						this.match(SolidCashParser.T__57);
						this.state = 1914;
						this.expression(0);
						this.state = 1915;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1917;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 1918;
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
						this.state = 1919;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 1920;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__133);
						this.state = 1921;
						this.match(SolidCashParser.T__39);
						this.state = 1922;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 1923;
						this.match(SolidCashParser.T__40);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1925;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 1926;
						this.match(SolidCashParser.T__134);
						this.state = 1927;
						this.match(SolidCashParser.T__39);
						this.state = 1928;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 1929;
						this.match(SolidCashParser.T__4);
						this.state = 1930;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 1931;
						this.match(SolidCashParser.T__40);
						}
						break;
					case 19:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1933;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 1934;
						this.match(SolidCashParser.T__11);
						this.state = 1935;
						this.match(SolidCashParser.Identifier);
						this.state = 1937;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 1936;
							this.callOptions();
							}
						}

						this.state = 1939;
						this.expressionList();
						}
						break;
					case 20:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1940;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 1941;
						this.memberName();
						}
						break;
					}
					}
				}
				this.state = 1946;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 183, this._ctx);
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
			this.state = 1960;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1947;
				this.match(SolidCashParser.T__11);
				this.state = 1948;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 122:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1949;
				this.match(SolidCashParser.T__121);
				}
				break;
			case 123:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1950;
				this.match(SolidCashParser.T__122);
				}
				break;
			case 124:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1951;
				this.match(SolidCashParser.T__123);
				}
				break;
			case 125:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1952;
				this.match(SolidCashParser.T__124);
				}
				break;
			case 126:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1953;
				this.match(SolidCashParser.T__125);
				}
				break;
			case 128:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1954;
				this.match(SolidCashParser.T__127);
				}
				break;
			case 129:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1955;
				this.match(SolidCashParser.T__128);
				}
				break;
			case 130:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1956;
				this.match(SolidCashParser.T__129);
				}
				break;
			case 131:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1957;
				this.match(SolidCashParser.T__130);
				}
				break;
			case 142:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1958;
				this.match(SolidCashParser.T__141);
				}
				break;
			case 143:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1959;
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
			this.state = 1962;
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
			this.state = 1978;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 152:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1964;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 155:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1965;
				this.numberLiteral();
				}
				break;
			case 154:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1966;
				this.decimalLiteral();
				}
				break;
			case 160:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1967;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1971;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 185, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1968;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 1973;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 185, this._ctx);
				}
				}
				break;
			case 170:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1974;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 171:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1975;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1976;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1977;
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
			this.state = 1980;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 1982;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 187, this._ctx) ) {
			case 1:
				{
				this.state = 1981;
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
			this.state = 1984;
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
			this.state = 2029;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 192, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1986;
				this.match(SolidCashParser.T__147);
				this.state = 1987;
				this.match(SolidCashParser.T__51);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1988;
				this.match(SolidCashParser.T__147);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1989;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1990;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1991;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1992;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1993;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1994;
				this.match(SolidCashParser.T__148);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1995;
				this.match(SolidCashParser.T__149);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1996;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1997;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1998;
				this.match(SolidCashParser.T__6);
				this.state = 1999;
				this.match(SolidCashParser.T__39);
				this.state = 2008;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
					{
					this.state = 2000;
					this.typeName();
					this.state = 2005;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2001;
						this.match(SolidCashParser.T__4);
						this.state = 2002;
						this.typeName();
						}
						}
						this.state = 2007;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2010;
				this.match(SolidCashParser.T__40);
				this.state = 2023;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===70) {
					{
					this.state = 2011;
					this.match(SolidCashParser.T__69);
					this.state = 2012;
					this.match(SolidCashParser.T__39);
					this.state = 2013;
					this.typeName();
					this.state = 2018;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2014;
						this.match(SolidCashParser.T__4);
						this.state = 2015;
						this.typeName();
						}
						}
						this.state = 2020;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2021;
					this.match(SolidCashParser.T__40);
					}
				}

				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2025;
				this.match(SolidCashParser.Identifier);
				this.state = 2026;
				this.match(SolidCashParser.T__11);
				this.state = 2027;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2028;
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
			this.state = 2031;
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
			return this.precpred(this._ctx, 31);
		case 15:
			return this.precpred(this._ctx, 30);
		case 16:
			return this.precpred(this._ctx, 29);
		case 17:
			return this.precpred(this._ctx, 26);
		case 18:
			return this.precpred(this._ctx, 25);
		case 19:
			return this.precpred(this._ctx, 24);
		case 20:
			return this.precpred(this._ctx, 23);
		case 21:
			return this.precpred(this._ctx, 22);
		}
		return true;
	}

	public static readonly _serializedATN: number[] = [4,1,175,2034,2,0,7,0,
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
	1,29,1,29,1,30,1,30,1,30,3,30,673,8,30,1,30,5,30,676,8,30,10,30,12,30,679,
	9,30,1,30,1,30,5,30,683,8,30,10,30,12,30,686,9,30,1,30,1,30,1,31,1,31,1,
	31,1,31,5,31,694,8,31,10,31,12,31,697,9,31,1,31,5,31,700,8,31,10,31,12,
	31,703,9,31,1,31,1,31,5,31,707,8,31,10,31,12,31,710,9,31,1,31,1,31,1,32,
	1,32,1,32,3,32,717,8,32,1,33,1,33,1,33,1,33,1,33,1,33,1,33,5,33,726,8,33,
	10,33,12,33,729,9,33,1,33,1,33,1,34,1,34,1,34,1,35,3,35,737,8,35,1,35,1,
	35,5,35,741,8,35,10,35,12,35,744,9,35,1,35,1,35,1,35,1,35,1,35,1,35,5,35,
	752,8,35,10,35,12,35,755,9,35,1,35,1,35,1,35,1,35,3,35,761,8,35,1,35,1,
	35,5,35,765,8,35,10,35,12,35,768,9,35,1,35,1,35,1,35,1,35,3,35,774,8,35,
	1,35,1,35,5,35,778,8,35,10,35,12,35,781,9,35,1,35,1,35,1,35,3,35,786,8,
	35,1,36,1,36,3,36,790,8,36,1,37,1,37,1,38,1,38,1,38,1,38,3,38,798,8,38,
	1,38,1,38,1,38,3,38,803,8,38,1,38,1,38,1,38,1,38,1,38,1,38,3,38,811,8,38,
	1,38,1,38,1,38,1,38,1,38,1,38,1,38,1,38,3,38,821,8,38,1,38,1,38,1,38,3,
	38,826,8,38,1,38,1,38,3,38,830,8,38,1,39,1,39,1,39,1,39,1,39,1,39,1,39,
	1,39,1,39,1,39,3,39,842,8,39,1,39,1,39,1,39,1,39,1,39,1,39,1,39,5,39,851,
	8,39,10,39,12,39,854,9,39,1,40,1,40,1,40,3,40,859,8,40,1,40,1,40,5,40,863,
	8,40,10,40,12,40,866,9,40,1,40,1,40,1,41,1,41,3,41,872,8,41,1,42,1,42,1,
	42,1,43,1,43,1,43,1,43,5,43,881,8,43,10,43,12,43,884,9,43,1,43,5,43,887,
	8,43,10,43,12,43,890,9,43,1,43,3,43,893,8,43,1,43,1,43,5,43,897,8,43,10,
	43,12,43,900,9,43,1,43,1,43,1,44,1,44,3,44,906,8,44,1,45,1,45,1,45,1,45,
	1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,3,45,922,8,45,1,46,1,
	46,1,46,1,46,1,46,5,46,929,8,46,10,46,12,46,932,9,46,1,46,3,46,935,8,46,
	1,47,1,47,1,47,1,47,3,47,941,8,47,1,48,1,48,1,48,1,48,1,48,5,48,948,8,48,
	10,48,12,48,951,9,48,1,48,3,48,954,8,48,1,48,1,48,1,49,1,49,5,49,960,8,
	49,10,49,12,49,963,9,49,1,49,3,49,966,8,49,1,50,1,50,1,50,1,50,5,50,972,
	8,50,10,50,12,50,975,9,50,1,50,3,50,978,8,50,3,50,980,8,50,1,50,1,50,1,
	51,1,51,5,51,986,8,51,10,51,12,51,989,9,51,1,51,1,51,1,51,1,51,5,51,995,
	8,51,10,51,12,51,998,9,51,1,51,1,51,3,51,1002,8,51,1,52,1,52,5,52,1006,
	8,52,10,52,12,52,1009,9,52,1,52,1,52,3,52,1013,8,52,1,53,1,53,1,53,1,53,
	1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,
	53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,
	3,53,1048,8,53,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,55,1,
	55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,5,55,1072,8,55,10,
	55,12,55,1075,9,55,1,55,1,55,1,55,1,56,1,56,1,56,1,56,1,56,1,56,5,56,1086,
	8,56,10,56,12,56,1089,9,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,5,56,1098,
	8,56,10,56,12,56,1101,9,56,1,56,3,56,1104,8,56,1,56,1,56,1,56,3,56,1109,
	8,56,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,
	57,1,57,1,57,1,57,3,57,1128,8,57,1,57,1,57,1,57,3,57,1133,8,57,1,58,1,58,
	1,58,1,58,3,58,1139,8,58,1,58,1,58,1,58,1,59,1,59,1,59,1,59,1,59,1,60,1,
	60,1,60,1,60,1,60,1,60,1,60,4,60,1156,8,60,11,60,12,60,1157,1,60,1,60,1,
	60,1,60,1,61,1,61,1,61,1,61,1,61,1,61,1,61,4,61,1171,8,61,11,61,12,61,1172,
	1,61,1,61,1,61,1,61,1,61,1,61,1,62,1,62,1,62,1,62,1,62,1,62,1,62,5,62,1188,
	8,62,10,62,12,62,1191,9,62,1,62,1,62,1,62,1,62,1,62,1,62,1,63,1,63,1,63,
	1,63,1,63,1,63,1,63,1,64,1,64,5,64,1208,8,64,10,64,12,64,1211,9,64,1,64,
	1,64,1,64,3,64,1216,8,64,1,64,1,64,1,64,1,64,5,64,1222,8,64,10,64,12,64,
	1225,9,64,1,64,1,64,1,64,1,64,1,64,3,64,1232,8,64,1,65,1,65,1,65,1,65,1,
	65,1,65,4,65,1240,8,65,11,65,12,65,1241,1,65,1,65,1,65,1,65,1,65,1,65,1,
	65,1,65,4,65,1252,8,65,11,65,12,65,1253,1,65,1,65,1,65,1,65,1,65,1,65,4,
	65,1262,8,65,11,65,12,65,1263,1,65,1,65,1,65,1,65,1,65,1,65,1,65,4,65,1273,
	8,65,11,65,12,65,1274,1,65,1,65,1,65,1,65,1,65,3,65,1282,8,65,1,66,1,66,
	1,66,1,66,1,66,3,66,1289,8,66,1,67,1,67,1,67,1,67,1,67,1,67,1,67,1,67,3,
	67,1299,8,67,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,69,1,69,1,69,1,69,1,69,
	1,69,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,71,1,71,1,71,1,71,1,71,1,
	71,1,71,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,73,1,73,1,73,1,73,
	1,73,1,73,1,73,1,73,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,
	74,1,74,1,74,1,74,1,74,1,74,4,74,1362,8,74,11,74,12,74,1363,1,74,1,74,3,
	74,1368,8,74,1,75,1,75,1,75,1,75,1,75,1,75,1,75,3,75,1377,8,75,1,75,1,75,
	1,75,1,76,1,76,1,76,1,76,1,76,3,76,1387,8,76,1,76,1,76,1,76,1,77,1,77,1,
	77,1,77,1,77,1,77,1,77,3,77,1399,8,77,1,78,1,78,1,78,1,78,1,78,1,78,3,78,
	1407,8,78,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,
	79,1,79,1,79,1,79,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,
	1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,82,1,82,1,82,1,
	82,1,82,1,82,1,82,1,82,1,83,1,83,5,83,1457,8,83,10,83,12,83,1460,9,83,1,
	83,1,83,1,83,1,83,1,83,1,84,1,84,1,84,1,85,1,85,1,85,1,85,1,85,3,85,1475,
	8,85,1,86,1,86,1,86,1,86,1,86,1,86,1,86,1,86,1,87,1,87,1,87,1,87,1,87,1,
	87,1,88,1,88,1,88,1,88,1,89,1,89,1,89,5,89,1498,8,89,10,89,12,89,1501,9,
	89,1,89,1,89,1,90,1,90,1,91,1,91,1,91,5,91,1510,8,91,10,91,12,91,1513,9,
	91,1,91,1,91,1,92,1,92,1,92,1,92,1,92,1,92,5,92,1523,8,92,10,92,12,92,1526,
	9,92,1,92,3,92,1529,8,92,1,92,1,92,1,93,1,93,1,93,1,93,5,93,1537,8,93,10,
	93,12,93,1540,9,93,1,94,1,94,1,94,5,94,1545,8,94,10,94,12,94,1548,9,94,
	1,95,1,95,1,95,3,95,1553,8,95,1,95,1,95,4,95,1557,8,95,11,95,12,95,1558,
	1,96,1,96,1,96,1,96,1,96,5,96,1566,8,96,10,96,12,96,1569,9,96,1,96,3,96,
	1572,8,96,3,96,1574,8,96,1,96,1,96,1,97,1,97,3,97,1580,8,97,1,97,1,97,1,
	97,1,97,5,97,1586,8,97,10,97,12,97,1589,9,97,1,97,3,97,1592,8,97,3,97,1594,
	8,97,1,97,3,97,1597,8,97,1,97,1,97,1,98,1,98,1,98,1,99,1,99,1,99,1,100,
	1,100,1,100,3,100,1610,8,100,1,101,1,101,1,101,1,101,1,101,1,101,1,101,
	1,101,1,101,1,101,1,101,1,101,1,101,1,101,3,101,1626,8,101,1,102,1,102,
	1,102,1,102,1,102,1,102,1,103,1,103,3,103,1636,8,103,1,104,1,104,1,104,
	1,104,5,104,1642,8,104,10,104,12,104,1645,9,104,1,104,3,104,1648,8,104,
	3,104,1650,8,104,1,104,1,104,1,105,1,105,1,105,1,105,1,105,1,105,1,105,
	1,105,1,105,1,105,1,105,1,105,5,105,1666,8,105,10,105,12,105,1669,9,105,
	1,105,3,105,1672,8,105,3,105,1674,8,105,1,105,1,105,3,105,1678,8,105,1,
	106,1,106,1,106,1,106,1,107,1,107,1,107,1,107,5,107,1688,8,107,10,107,12,
	107,1691,9,107,1,107,3,107,1694,8,107,3,107,1696,8,107,1,107,1,107,1,108,
	1,108,1,108,1,108,5,108,1704,8,108,10,108,12,108,1707,9,108,1,108,3,108,
	1710,8,108,1,108,1,108,1,109,1,109,1,109,1,109,1,110,1,110,1,110,1,110,
	5,110,1722,8,110,10,110,12,110,1725,9,110,1,110,3,110,1728,8,110,1,110,
	1,110,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,3,111,1741,
	8,111,1,111,1,111,1,111,1,111,1,111,1,111,3,111,1749,8,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,5,111,1822,8,111,
	10,111,12,111,1825,9,111,1,111,3,111,1828,8,111,3,111,1830,8,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,4,111,1850,8,111,11,111,12,111,1851,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,3,111,1861,8,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	3,111,1938,8,111,1,111,1,111,1,111,5,111,1943,8,111,10,111,12,111,1946,
	9,111,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,
	1,112,1,112,3,112,1961,8,112,1,113,1,113,1,114,1,114,1,114,1,114,1,114,
	5,114,1970,8,114,10,114,12,114,1973,9,114,1,114,1,114,1,114,1,114,3,114,
	1979,8,114,1,115,1,115,3,115,1983,8,115,1,116,1,116,1,117,1,117,1,117,1,
	117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,
	117,1,117,5,117,2004,8,117,10,117,12,117,2007,9,117,3,117,2009,8,117,1,
	117,1,117,1,117,1,117,1,117,1,117,5,117,2017,8,117,10,117,12,117,2020,9,
	117,1,117,1,117,3,117,2024,8,117,1,117,1,117,1,117,1,117,3,117,2030,8,117,
	1,118,1,118,1,118,0,2,78,222,119,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,
	30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,
	78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,110,112,114,116,118,
	120,122,124,126,128,130,132,134,136,138,140,142,144,146,148,150,152,154,
	156,158,160,162,164,166,168,170,172,174,176,178,180,182,184,186,188,190,
	192,194,196,198,200,202,204,206,208,210,212,214,216,218,220,222,224,226,
	228,230,232,234,236,0,20,2,0,10,10,13,27,1,0,29,30,3,0,20,23,26,27,31,31,
	1,0,34,35,2,0,34,35,50,50,3,0,34,35,50,50,55,55,2,0,31,31,75,84,1,0,85,
	86,3,0,155,155,162,162,172,172,1,0,122,126,2,0,122,126,128,131,3,0,14,14,
	27,27,136,136,2,0,10,10,15,16,1,0,13,14,1,0,137,138,1,0,20,23,1,0,18,19,
	1,0,132,133,2,0,48,48,144,147,4,0,52,52,148,150,156,158,164,168,2255,0,
	241,1,0,0,0,2,296,1,0,0,0,4,298,1,0,0,0,6,303,1,0,0,0,8,353,1,0,0,0,10,
	355,1,0,0,0,12,364,1,0,0,0,14,366,1,0,0,0,16,371,1,0,0,0,18,373,1,0,0,0,
	20,378,1,0,0,0,22,382,1,0,0,0,24,384,1,0,0,0,26,452,1,0,0,0,28,454,1,0,
	0,0,30,459,1,0,0,0,32,461,1,0,0,0,34,469,1,0,0,0,36,511,1,0,0,0,38,551,
	1,0,0,0,40,571,1,0,0,0,42,593,1,0,0,0,44,599,1,0,0,0,46,618,1,0,0,0,48,
	621,1,0,0,0,50,631,1,0,0,0,52,635,1,0,0,0,54,651,1,0,0,0,56,656,1,0,0,0,
	58,662,1,0,0,0,60,669,1,0,0,0,62,689,1,0,0,0,64,716,1,0,0,0,66,718,1,0,
	0,0,68,732,1,0,0,0,70,785,1,0,0,0,72,789,1,0,0,0,74,791,1,0,0,0,76,829,
	1,0,0,0,78,841,1,0,0,0,80,855,1,0,0,0,82,871,1,0,0,0,84,873,1,0,0,0,86,
	876,1,0,0,0,88,903,1,0,0,0,90,921,1,0,0,0,92,923,1,0,0,0,94,936,1,0,0,0,
	96,942,1,0,0,0,98,957,1,0,0,0,100,967,1,0,0,0,102,1001,1,0,0,0,104,1012,
	1,0,0,0,106,1047,1,0,0,0,108,1049,1,0,0,0,110,1059,1,0,0,0,112,1108,1,0,
	0,0,114,1132,1,0,0,0,116,1134,1,0,0,0,118,1143,1,0,0,0,120,1148,1,0,0,0,
	122,1163,1,0,0,0,124,1180,1,0,0,0,126,1198,1,0,0,0,128,1231,1,0,0,0,130,
	1281,1,0,0,0,132,1288,1,0,0,0,134,1298,1,0,0,0,136,1300,1,0,0,0,138,1307,
	1,0,0,0,140,1313,1,0,0,0,142,1321,1,0,0,0,144,1328,1,0,0,0,146,1337,1,0,
	0,0,148,1367,1,0,0,0,150,1369,1,0,0,0,152,1381,1,0,0,0,154,1391,1,0,0,0,
	156,1406,1,0,0,0,158,1408,1,0,0,0,160,1424,1,0,0,0,162,1435,1,0,0,0,164,
	1446,1,0,0,0,166,1454,1,0,0,0,168,1466,1,0,0,0,170,1474,1,0,0,0,172,1476,
	1,0,0,0,174,1484,1,0,0,0,176,1490,1,0,0,0,178,1494,1,0,0,0,180,1504,1,0,
	0,0,182,1506,1,0,0,0,184,1516,1,0,0,0,186,1532,1,0,0,0,188,1541,1,0,0,0,
	190,1549,1,0,0,0,192,1560,1,0,0,0,194,1577,1,0,0,0,196,1600,1,0,0,0,198,
	1603,1,0,0,0,200,1609,1,0,0,0,202,1625,1,0,0,0,204,1627,1,0,0,0,206,1635,
	1,0,0,0,208,1637,1,0,0,0,210,1677,1,0,0,0,212,1679,1,0,0,0,214,1683,1,0,
	0,0,216,1699,1,0,0,0,218,1713,1,0,0,0,220,1717,1,0,0,0,222,1860,1,0,0,0,
	224,1960,1,0,0,0,226,1962,1,0,0,0,228,1978,1,0,0,0,230,1980,1,0,0,0,232,
	1984,1,0,0,0,234,2029,1,0,0,0,236,2031,1,0,0,0,238,240,3,14,7,0,239,238,
	1,0,0,0,240,243,1,0,0,0,241,239,1,0,0,0,241,242,1,0,0,0,242,247,1,0,0,0,
	243,241,1,0,0,0,244,246,3,2,1,0,245,244,1,0,0,0,246,249,1,0,0,0,247,245,
	1,0,0,0,247,248,1,0,0,0,248,261,1,0,0,0,249,247,1,0,0,0,250,260,3,58,29,
	0,251,260,3,52,26,0,252,260,3,48,24,0,253,260,3,56,28,0,254,260,3,8,4,0,
	255,260,3,44,22,0,256,260,3,24,12,0,257,260,3,6,3,0,258,260,3,34,17,0,259,
	250,1,0,0,0,259,251,1,0,0,0,259,252,1,0,0,0,259,253,1,0,0,0,259,254,1,0,
	0,0,259,255,1,0,0,0,259,256,1,0,0,0,259,257,1,0,0,0,259,258,1,0,0,0,260,
	263,1,0,0,0,261,259,1,0,0,0,261,262,1,0,0,0,262,266,1,0,0,0,263,261,1,0,
	0,0,264,267,3,36,18,0,265,267,3,34,17,0,266,264,1,0,0,0,266,265,1,0,0,0,
	267,268,1,0,0,0,268,269,5,0,0,1,269,1,1,0,0,0,270,271,5,1,0,0,271,272,5,
	160,0,0,272,297,5,2,0,0,273,274,5,1,0,0,274,275,5,160,0,0,275,276,5,3,0,
	0,276,277,5,172,0,0,277,297,5,2,0,0,278,279,5,1,0,0,279,280,5,4,0,0,280,
	285,3,4,2,0,281,282,5,5,0,0,282,284,3,4,2,0,283,281,1,0,0,0,284,287,1,0,
	0,0,285,283,1,0,0,0,285,286,1,0,0,0,286,289,1,0,0,0,287,285,1,0,0,0,288,
	290,5,5,0,0,289,288,1,0,0,0,289,290,1,0,0,0,290,291,1,0,0,0,291,292,5,6,
	0,0,292,293,5,172,0,0,293,294,5,160,0,0,294,295,5,2,0,0,295,297,1,0,0,0,
	296,270,1,0,0,0,296,273,1,0,0,0,296,278,1,0,0,0,297,3,1,0,0,0,298,301,5,
	172,0,0,299,300,5,3,0,0,300,302,5,172,0,0,301,299,1,0,0,0,301,302,1,0,0,
	0,302,5,1,0,0,0,303,304,5,7,0,0,304,305,5,172,0,0,305,307,3,100,50,0,306,
	308,3,96,48,0,307,306,1,0,0,0,307,308,1,0,0,0,308,309,1,0,0,0,309,313,5,
	4,0,0,310,312,3,106,53,0,311,310,1,0,0,0,312,315,1,0,0,0,313,311,1,0,0,
	0,313,314,1,0,0,0,314,316,1,0,0,0,315,313,1,0,0,0,316,317,5,6,0,0,317,7,
	1,0,0,0,318,319,5,8,0,0,319,320,5,172,0,0,320,323,5,9,0,0,321,324,3,234,
	117,0,322,324,5,10,0,0,323,321,1,0,0,0,323,322,1,0,0,0,324,326,1,0,0,0,
	325,327,5,11,0,0,326,325,1,0,0,0,326,327,1,0,0,0,327,328,1,0,0,0,328,354,
	5,2,0,0,329,330,5,8,0,0,330,331,5,4,0,0,331,336,3,10,5,0,332,333,5,5,0,
	0,333,335,3,10,5,0,334,332,1,0,0,0,335,338,1,0,0,0,336,334,1,0,0,0,336,
	337,1,0,0,0,337,340,1,0,0,0,338,336,1,0,0,0,339,341,5,5,0,0,340,339,1,0,
	0,0,340,341,1,0,0,0,341,342,1,0,0,0,342,343,5,6,0,0,343,346,5,9,0,0,344,
	347,3,234,117,0,345,347,5,10,0,0,346,344,1,0,0,0,346,345,1,0,0,0,347,349,
	1,0,0,0,348,350,5,11,0,0,349,348,1,0,0,0,349,350,1,0,0,0,350,351,1,0,0,
	0,351,352,5,2,0,0,352,354,1,0,0,0,353,318,1,0,0,0,353,329,1,0,0,0,354,9,
	1,0,0,0,355,358,5,172,0,0,356,357,5,12,0,0,357,359,5,172,0,0,358,356,1,
	0,0,0,358,359,1,0,0,0,359,362,1,0,0,0,360,361,5,3,0,0,361,363,3,12,6,0,
	362,360,1,0,0,0,362,363,1,0,0,0,363,11,1,0,0,0,364,365,7,0,0,0,365,13,1,
	0,0,0,366,367,5,28,0,0,367,368,3,16,8,0,368,369,3,18,9,0,369,370,5,2,0,
	0,370,15,1,0,0,0,371,372,7,1,0,0,372,17,1,0,0,0,373,375,3,20,10,0,374,376,
	3,20,10,0,375,374,1,0,0,0,375,376,1,0,0,0,376,19,1,0,0,0,377,379,3,22,11,
	0,378,377,1,0,0,0,378,379,1,0,0,0,379,380,1,0,0,0,380,381,5,151,0,0,381,
	21,1,0,0,0,382,383,7,2,0,0,383,23,1,0,0,0,384,385,5,32,0,0,385,395,5,172,
	0,0,386,387,5,33,0,0,387,392,5,172,0,0,388,389,5,5,0,0,389,391,5,172,0,
	0,390,388,1,0,0,0,391,394,1,0,0,0,392,390,1,0,0,0,392,393,1,0,0,0,393,396,
	1,0,0,0,394,392,1,0,0,0,395,386,1,0,0,0,395,396,1,0,0,0,396,397,1,0,0,0,
	397,401,5,4,0,0,398,400,3,52,26,0,399,398,1,0,0,0,400,403,1,0,0,0,401,399,
	1,0,0,0,401,402,1,0,0,0,402,407,1,0,0,0,403,401,1,0,0,0,404,406,3,48,24,
	0,405,404,1,0,0,0,406,409,1,0,0,0,407,405,1,0,0,0,407,408,1,0,0,0,408,413,
	1,0,0,0,409,407,1,0,0,0,410,412,3,56,28,0,411,410,1,0,0,0,412,415,1,0,0,
	0,413,411,1,0,0,0,413,414,1,0,0,0,414,419,1,0,0,0,415,413,1,0,0,0,416,418,
	3,40,20,0,417,416,1,0,0,0,418,421,1,0,0,0,419,417,1,0,0,0,419,420,1,0,0,
	0,420,425,1,0,0,0,421,419,1,0,0,0,422,424,3,28,14,0,423,422,1,0,0,0,424,
	427,1,0,0,0,425,423,1,0,0,0,425,426,1,0,0,0,426,431,1,0,0,0,427,425,1,0,
	0,0,428,430,3,26,13,0,429,428,1,0,0,0,430,433,1,0,0,0,431,429,1,0,0,0,431,
	432,1,0,0,0,432,437,1,0,0,0,433,431,1,0,0,0,434,436,3,32,16,0,435,434,1,
	0,0,0,436,439,1,0,0,0,437,435,1,0,0,0,437,438,1,0,0,0,438,440,1,0,0,0,439,
	437,1,0,0,0,440,441,5,6,0,0,441,25,1,0,0,0,442,443,3,30,15,0,443,444,3,
	76,38,0,444,445,5,172,0,0,445,446,5,2,0,0,446,453,1,0,0,0,447,448,3,30,
	15,0,448,449,3,78,39,0,449,450,5,172,0,0,450,451,5,2,0,0,451,453,1,0,0,
	0,452,442,1,0,0,0,452,447,1,0,0,0,453,27,1,0,0,0,454,455,3,30,15,0,455,
	456,3,234,117,0,456,457,5,172,0,0,457,458,5,2,0,0,458,29,1,0,0,0,459,460,
	7,3,0,0,460,31,1,0,0,0,461,462,5,7,0,0,462,463,5,172,0,0,463,465,3,100,
	50,0,464,466,3,96,48,0,465,464,1,0,0,0,465,466,1,0,0,0,466,467,1,0,0,0,
	467,468,5,2,0,0,468,33,1,0,0,0,469,470,5,36,0,0,470,471,5,172,0,0,471,475,
	5,4,0,0,472,474,3,52,26,0,473,472,1,0,0,0,474,477,1,0,0,0,475,473,1,0,0,
	0,475,476,1,0,0,0,476,481,1,0,0,0,477,475,1,0,0,0,478,480,3,48,24,0,479,
	478,1,0,0,0,480,483,1,0,0,0,481,479,1,0,0,0,481,482,1,0,0,0,482,487,1,0,
	0,0,483,481,1,0,0,0,484,486,3,56,28,0,485,484,1,0,0,0,486,489,1,0,0,0,487,
	485,1,0,0,0,487,488,1,0,0,0,488,493,1,0,0,0,489,487,1,0,0,0,490,492,3,40,
	20,0,491,490,1,0,0,0,492,495,1,0,0,0,493,491,1,0,0,0,493,494,1,0,0,0,494,
	499,1,0,0,0,495,493,1,0,0,0,496,498,3,58,29,0,497,496,1,0,0,0,498,501,1,
	0,0,0,499,497,1,0,0,0,499,500,1,0,0,0,500,505,1,0,0,0,501,499,1,0,0,0,502,
	504,3,6,3,0,503,502,1,0,0,0,504,507,1,0,0,0,505,503,1,0,0,0,505,506,1,0,
	0,0,506,508,1,0,0,0,507,505,1,0,0,0,508,509,5,6,0,0,509,35,1,0,0,0,510,
	512,5,37,0,0,511,510,1,0,0,0,511,512,1,0,0,0,512,513,1,0,0,0,513,514,5,
	38,0,0,514,516,5,172,0,0,515,517,3,100,50,0,516,515,1,0,0,0,516,517,1,0,
	0,0,517,527,1,0,0,0,518,519,5,33,0,0,519,524,5,172,0,0,520,521,5,5,0,0,
	521,523,5,172,0,0,522,520,1,0,0,0,523,526,1,0,0,0,524,522,1,0,0,0,524,525,
	1,0,0,0,525,528,1,0,0,0,526,524,1,0,0,0,527,518,1,0,0,0,527,528,1,0,0,0,
	528,529,1,0,0,0,529,546,5,4,0,0,530,545,3,52,26,0,531,545,3,48,24,0,532,
	545,3,56,28,0,533,545,3,40,20,0,534,545,3,44,22,0,535,545,3,58,29,0,536,
	545,3,8,4,0,537,545,3,70,35,0,538,545,3,80,40,0,539,545,3,60,30,0,540,545,
	3,86,43,0,541,545,3,38,19,0,542,545,3,62,31,0,543,545,3,66,33,0,544,530,
	1,0,0,0,544,531,1,0,0,0,544,532,1,0,0,0,544,533,1,0,0,0,544,534,1,0,0,0,
	544,535,1,0,0,0,544,536,1,0,0,0,544,537,1,0,0,0,544,538,1,0,0,0,544,539,
	1,0,0,0,544,540,1,0,0,0,544,541,1,0,0,0,544,542,1,0,0,0,544,543,1,0,0,0,
	545,548,1,0,0,0,546,544,1,0,0,0,546,547,1,0,0,0,547,549,1,0,0,0,548,546,
	1,0,0,0,549,550,5,6,0,0,550,37,1,0,0,0,551,552,5,7,0,0,552,553,5,172,0,
	0,553,557,3,100,50,0,554,556,3,90,45,0,555,554,1,0,0,0,556,559,1,0,0,0,
	557,555,1,0,0,0,557,558,1,0,0,0,558,563,1,0,0,0,559,557,1,0,0,0,560,562,
	3,88,44,0,561,560,1,0,0,0,562,565,1,0,0,0,563,561,1,0,0,0,563,564,1,0,0,
	0,564,567,1,0,0,0,565,563,1,0,0,0,566,568,3,96,48,0,567,566,1,0,0,0,567,
	568,1,0,0,0,568,569,1,0,0,0,569,570,5,2,0,0,570,39,1,0,0,0,571,572,5,39,
	0,0,572,573,5,172,0,0,573,585,5,40,0,0,574,579,3,42,21,0,575,576,5,5,0,
	0,576,578,3,42,21,0,577,575,1,0,0,0,578,581,1,0,0,0,579,577,1,0,0,0,579,
	580,1,0,0,0,580,583,1,0,0,0,581,579,1,0,0,0,582,584,5,5,0,0,583,582,1,0,
	0,0,583,584,1,0,0,0,584,586,1,0,0,0,585,574,1,0,0,0,585,586,1,0,0,0,586,
	587,1,0,0,0,587,589,5,41,0,0,588,590,5,42,0,0,589,588,1,0,0,0,589,590,1,
	0,0,0,590,591,1,0,0,0,591,592,5,2,0,0,592,41,1,0,0,0,593,595,3,234,117,
	0,594,596,5,43,0,0,595,594,1,0,0,0,595,596,1,0,0,0,596,597,1,0,0,0,597,
	598,5,172,0,0,598,43,1,0,0,0,599,600,5,44,0,0,600,601,5,172,0,0,601,613,
	5,40,0,0,602,607,3,46,23,0,603,604,5,5,0,0,604,606,3,46,23,0,605,603,1,
	0,0,0,606,609,1,0,0,0,607,605,1,0,0,0,607,608,1,0,0,0,608,611,1,0,0,0,609,
	607,1,0,0,0,610,612,5,5,0,0,611,610,1,0,0,0,611,612,1,0,0,0,612,614,1,0,
	0,0,613,602,1,0,0,0,613,614,1,0,0,0,614,615,1,0,0,0,615,616,5,41,0,0,616,
	617,5,2,0,0,617,45,1,0,0,0,618,619,3,234,117,0,619,620,5,172,0,0,620,47,
	1,0,0,0,621,622,5,45,0,0,622,623,5,172,0,0,623,625,5,4,0,0,624,626,3,50,
	25,0,625,624,1,0,0,0,626,627,1,0,0,0,627,625,1,0,0,0,627,628,1,0,0,0,628,
	629,1,0,0,0,629,630,5,6,0,0,630,49,1,0,0,0,631,632,3,234,117,0,632,633,
	5,172,0,0,633,634,5,2,0,0,634,51,1,0,0,0,635,636,5,46,0,0,636,637,5,172,
	0,0,637,638,5,4,0,0,638,643,3,54,27,0,639,640,5,5,0,0,640,642,3,54,27,0,
	641,639,1,0,0,0,642,645,1,0,0,0,643,641,1,0,0,0,643,644,1,0,0,0,644,647,
	1,0,0,0,645,643,1,0,0,0,646,648,5,5,0,0,647,646,1,0,0,0,647,648,1,0,0,0,
	648,649,1,0,0,0,649,650,5,6,0,0,650,53,1,0,0,0,651,654,5,172,0,0,652,653,
	5,31,0,0,653,655,5,155,0,0,654,652,1,0,0,0,654,655,1,0,0,0,655,55,1,0,0,
	0,656,657,5,47,0,0,657,658,5,172,0,0,658,659,5,33,0,0,659,660,3,234,117,
	0,660,661,5,2,0,0,661,57,1,0,0,0,662,663,3,234,117,0,663,664,5,48,0,0,664,
	665,5,172,0,0,665,666,5,31,0,0,666,667,3,222,111,0,667,668,5,2,0,0,668,
	59,1,0,0,0,669,670,5,49,0,0,670,672,3,100,50,0,671,673,7,4,0,0,672,671,
	1,0,0,0,672,673,1,0,0,0,673,677,1,0,0,0,674,676,3,68,34,0,675,674,1,0,0,
	0,676,679,1,0,0,0,677,675,1,0,0,0,677,678,1,0,0,0,678,680,1,0,0,0,679,677,
	1,0,0,0,680,684,5,4,0,0,681,683,3,106,53,0,682,681,1,0,0,0,683,686,1,0,
	0,0,684,682,1,0,0,0,684,685,1,0,0,0,685,687,1,0,0,0,686,684,1,0,0,0,687,
	688,5,6,0,0,688,61,1,0,0,0,689,690,5,51,0,0,690,691,3,100,50,0,691,695,
	5,35,0,0,692,694,3,64,32,0,693,692,1,0,0,0,694,697,1,0,0,0,695,693,1,0,
	0,0,695,696,1,0,0,0,696,701,1,0,0,0,697,695,1,0,0,0,698,700,3,88,44,0,699,
	698,1,0,0,0,700,703,1,0,0,0,701,699,1,0,0,0,701,702,1,0,0,0,702,704,1,0,
	0,0,703,701,1,0,0,0,704,708,5,4,0,0,705,707,3,106,53,0,706,705,1,0,0,0,
	707,710,1,0,0,0,708,706,1,0,0,0,708,709,1,0,0,0,709,711,1,0,0,0,710,708,
	1,0,0,0,711,712,5,6,0,0,712,63,1,0,0,0,713,717,5,52,0,0,714,717,5,53,0,
	0,715,717,3,92,46,0,716,713,1,0,0,0,716,714,1,0,0,0,716,715,1,0,0,0,717,
	65,1,0,0,0,718,719,5,54,0,0,719,720,5,40,0,0,720,721,5,41,0,0,721,722,5,
	35,0,0,722,723,5,52,0,0,723,727,5,4,0,0,724,726,3,106,53,0,725,724,1,0,
	0,0,726,729,1,0,0,0,727,725,1,0,0,0,727,728,1,0,0,0,728,730,1,0,0,0,729,
	727,1,0,0,0,730,731,5,6,0,0,731,67,1,0,0,0,732,733,5,172,0,0,733,734,3,
	214,107,0,734,69,1,0,0,0,735,737,3,74,37,0,736,735,1,0,0,0,736,737,1,0,
	0,0,737,738,1,0,0,0,738,742,3,234,117,0,739,741,3,226,113,0,740,739,1,0,
	0,0,741,744,1,0,0,0,742,740,1,0,0,0,742,743,1,0,0,0,743,745,1,0,0,0,744,
	742,1,0,0,0,745,746,5,172,0,0,746,747,5,2,0,0,747,786,1,0,0,0,748,749,3,
	234,117,0,749,753,3,74,37,0,750,752,3,226,113,0,751,750,1,0,0,0,752,755,
	1,0,0,0,753,751,1,0,0,0,753,754,1,0,0,0,754,756,1,0,0,0,755,753,1,0,0,0,
	756,757,5,172,0,0,757,758,5,2,0,0,758,786,1,0,0,0,759,761,3,74,37,0,760,
	759,1,0,0,0,760,761,1,0,0,0,761,762,1,0,0,0,762,766,3,76,38,0,763,765,3,
	72,36,0,764,763,1,0,0,0,765,768,1,0,0,0,766,764,1,0,0,0,766,767,1,0,0,0,
	767,769,1,0,0,0,768,766,1,0,0,0,769,770,5,172,0,0,770,771,5,2,0,0,771,786,
	1,0,0,0,772,774,3,74,37,0,773,772,1,0,0,0,773,774,1,0,0,0,774,775,1,0,0,
	0,775,779,3,78,39,0,776,778,3,72,36,0,777,776,1,0,0,0,778,781,1,0,0,0,779,
	777,1,0,0,0,779,780,1,0,0,0,780,782,1,0,0,0,781,779,1,0,0,0,782,783,5,172,
	0,0,783,784,5,2,0,0,784,786,1,0,0,0,785,736,1,0,0,0,785,748,1,0,0,0,785,
	760,1,0,0,0,785,773,1,0,0,0,786,71,1,0,0,0,787,790,3,226,113,0,788,790,
	3,74,37,0,789,787,1,0,0,0,789,788,1,0,0,0,790,73,1,0,0,0,791,792,7,5,0,
	0,792,75,1,0,0,0,793,794,5,56,0,0,794,795,5,40,0,0,795,797,3,234,117,0,
	796,798,5,172,0,0,797,796,1,0,0,0,797,798,1,0,0,0,798,799,1,0,0,0,799,800,
	5,57,0,0,800,802,3,234,117,0,801,803,5,172,0,0,802,801,1,0,0,0,802,803,
	1,0,0,0,803,804,1,0,0,0,804,805,5,41,0,0,805,830,1,0,0,0,806,807,5,56,0,
	0,807,808,5,40,0,0,808,810,3,234,117,0,809,811,5,172,0,0,810,809,1,0,0,
	0,810,811,1,0,0,0,811,812,1,0,0,0,812,813,5,57,0,0,813,814,3,76,38,0,814,
	815,5,41,0,0,815,830,1,0,0,0,816,817,5,56,0,0,817,818,5,40,0,0,818,820,
	3,234,117,0,819,821,5,172,0,0,820,819,1,0,0,0,820,821,1,0,0,0,821,822,1,
	0,0,0,822,823,5,57,0,0,823,825,3,78,39,0,824,826,5,172,0,0,825,824,1,0,
	0,0,825,826,1,0,0,0,826,827,1,0,0,0,827,828,5,41,0,0,828,830,1,0,0,0,829,
	793,1,0,0,0,829,806,1,0,0,0,829,816,1,0,0,0,830,77,1,0,0,0,831,832,6,39,
	-1,0,832,833,3,234,117,0,833,834,5,58,0,0,834,835,5,155,0,0,835,836,5,59,
	0,0,836,842,1,0,0,0,837,838,3,234,117,0,838,839,5,58,0,0,839,840,5,59,0,
	0,840,842,1,0,0,0,841,831,1,0,0,0,841,837,1,0,0,0,842,852,1,0,0,0,843,844,
	10,2,0,0,844,845,5,58,0,0,845,846,5,155,0,0,846,851,5,59,0,0,847,848,10,
	1,0,0,848,849,5,58,0,0,849,851,5,59,0,0,850,843,1,0,0,0,850,847,1,0,0,0,
	851,854,1,0,0,0,852,850,1,0,0,0,852,853,1,0,0,0,853,79,1,0,0,0,854,852,
	1,0,0,0,855,856,5,60,0,0,856,858,5,172,0,0,857,859,3,100,50,0,858,857,1,
	0,0,0,858,859,1,0,0,0,859,860,1,0,0,0,860,864,5,4,0,0,861,863,3,82,41,0,
	862,861,1,0,0,0,863,866,1,0,0,0,864,862,1,0,0,0,864,865,1,0,0,0,865,867,
	1,0,0,0,866,864,1,0,0,0,867,868,5,6,0,0,868,81,1,0,0,0,869,872,3,84,42,
	0,870,872,3,106,53,0,871,869,1,0,0,0,871,870,1,0,0,0,872,83,1,0,0,0,873,
	874,5,61,0,0,874,875,5,2,0,0,875,85,1,0,0,0,876,877,5,7,0,0,877,878,5,172,
	0,0,878,882,3,100,50,0,879,881,3,90,45,0,880,879,1,0,0,0,881,884,1,0,0,
	0,882,880,1,0,0,0,882,883,1,0,0,0,883,888,1,0,0,0,884,882,1,0,0,0,885,887,
	3,88,44,0,886,885,1,0,0,0,887,890,1,0,0,0,888,886,1,0,0,0,888,889,1,0,0,
	0,889,892,1,0,0,0,890,888,1,0,0,0,891,893,3,96,48,0,892,891,1,0,0,0,892,
	893,1,0,0,0,893,894,1,0,0,0,894,898,5,4,0,0,895,897,3,106,53,0,896,895,
	1,0,0,0,897,900,1,0,0,0,898,896,1,0,0,0,898,899,1,0,0,0,899,901,1,0,0,0,
	900,898,1,0,0,0,901,902,5,6,0,0,902,87,1,0,0,0,903,905,5,172,0,0,904,906,
	3,214,107,0,905,904,1,0,0,0,905,906,1,0,0,0,906,89,1,0,0,0,907,922,5,62,
	0,0,908,922,5,63,0,0,909,922,5,50,0,0,910,922,5,35,0,0,911,922,5,34,0,0,
	912,922,5,55,0,0,913,922,5,52,0,0,914,922,3,92,46,0,915,922,5,53,0,0,916,
	922,3,94,47,0,917,922,5,64,0,0,918,922,5,65,0,0,919,922,5,66,0,0,920,922,
	5,67,0,0,921,907,1,0,0,0,921,908,1,0,0,0,921,909,1,0,0,0,921,910,1,0,0,
	0,921,911,1,0,0,0,921,912,1,0,0,0,921,913,1,0,0,0,921,914,1,0,0,0,921,915,
	1,0,0,0,921,916,1,0,0,0,921,917,1,0,0,0,921,918,1,0,0,0,921,919,1,0,0,0,
	921,920,1,0,0,0,922,91,1,0,0,0,923,934,5,68,0,0,924,925,5,40,0,0,925,930,
	5,172,0,0,926,927,5,5,0,0,927,929,5,172,0,0,928,926,1,0,0,0,929,932,1,0,
	0,0,930,928,1,0,0,0,930,931,1,0,0,0,931,933,1,0,0,0,932,930,1,0,0,0,933,
	935,5,41,0,0,934,924,1,0,0,0,934,935,1,0,0,0,935,93,1,0,0,0,936,940,5,69,
	0,0,937,938,5,40,0,0,938,939,5,155,0,0,939,941,5,41,0,0,940,937,1,0,0,0,
	940,941,1,0,0,0,941,95,1,0,0,0,942,943,5,70,0,0,943,944,5,40,0,0,944,949,
	3,98,49,0,945,946,5,5,0,0,946,948,3,98,49,0,947,945,1,0,0,0,948,951,1,0,
	0,0,949,947,1,0,0,0,949,950,1,0,0,0,950,953,1,0,0,0,951,949,1,0,0,0,952,
	954,5,5,0,0,953,952,1,0,0,0,953,954,1,0,0,0,954,955,1,0,0,0,955,956,5,41,
	0,0,956,97,1,0,0,0,957,961,3,234,117,0,958,960,3,226,113,0,959,958,1,0,
	0,0,960,963,1,0,0,0,961,959,1,0,0,0,961,962,1,0,0,0,962,965,1,0,0,0,963,
	961,1,0,0,0,964,966,5,172,0,0,965,964,1,0,0,0,965,966,1,0,0,0,966,99,1,
	0,0,0,967,979,5,40,0,0,968,973,3,102,51,0,969,970,5,5,0,0,970,972,3,102,
	51,0,971,969,1,0,0,0,972,975,1,0,0,0,973,971,1,0,0,0,973,974,1,0,0,0,974,
	977,1,0,0,0,975,973,1,0,0,0,976,978,5,5,0,0,977,976,1,0,0,0,977,978,1,0,
	0,0,978,980,1,0,0,0,979,968,1,0,0,0,979,980,1,0,0,0,980,981,1,0,0,0,981,
	982,5,41,0,0,982,101,1,0,0,0,983,987,3,234,117,0,984,986,3,226,113,0,985,
	984,1,0,0,0,986,989,1,0,0,0,987,985,1,0,0,0,987,988,1,0,0,0,988,990,1,0,
	0,0,989,987,1,0,0,0,990,991,5,172,0,0,991,1002,1,0,0,0,992,996,3,78,39,
	0,993,995,3,226,113,0,994,993,1,0,0,0,995,998,1,0,0,0,996,994,1,0,0,0,996,
	997,1,0,0,0,997,999,1,0,0,0,998,996,1,0,0,0,999,1000,5,172,0,0,1000,1002,
	1,0,0,0,1001,983,1,0,0,0,1001,992,1,0,0,0,1002,103,1,0,0,0,1003,1007,5,
	4,0,0,1004,1006,3,106,53,0,1005,1004,1,0,0,0,1006,1009,1,0,0,0,1007,1005,
	1,0,0,0,1007,1008,1,0,0,0,1008,1010,1,0,0,0,1009,1007,1,0,0,0,1010,1013,
	5,6,0,0,1011,1013,3,106,53,0,1012,1003,1,0,0,0,1012,1011,1,0,0,0,1013,105,
	1,0,0,0,1014,1048,3,128,64,0,1015,1048,3,130,65,0,1016,1048,3,140,70,0,
	1017,1048,3,136,68,0,1018,1048,3,138,69,0,1019,1048,3,142,71,0,1020,1048,
	3,144,72,0,1021,1048,3,146,73,0,1022,1048,3,134,67,0,1023,1048,3,126,63,
	0,1024,1048,3,122,61,0,1025,1048,3,120,60,0,1026,1048,3,124,62,0,1027,1048,
	3,150,75,0,1028,1048,3,152,76,0,1029,1048,3,154,77,0,1030,1048,3,156,78,
	0,1031,1048,3,176,88,0,1032,1048,3,118,59,0,1033,1048,3,108,54,0,1034,1048,
	3,110,55,0,1035,1048,3,112,56,0,1036,1048,3,114,57,0,1037,1048,3,116,58,
	0,1038,1048,3,178,89,0,1039,1048,3,190,95,0,1040,1048,3,202,101,0,1041,
	1048,3,204,102,0,1042,1048,3,148,74,0,1043,1048,3,182,91,0,1044,1048,3,
	184,92,0,1045,1048,3,196,98,0,1046,1048,3,198,99,0,1047,1014,1,0,0,0,1047,
	1015,1,0,0,0,1047,1016,1,0,0,0,1047,1017,1,0,0,0,1047,1018,1,0,0,0,1047,
	1019,1,0,0,0,1047,1020,1,0,0,0,1047,1021,1,0,0,0,1047,1022,1,0,0,0,1047,
	1023,1,0,0,0,1047,1024,1,0,0,0,1047,1025,1,0,0,0,1047,1026,1,0,0,0,1047,
	1027,1,0,0,0,1047,1028,1,0,0,0,1047,1029,1,0,0,0,1047,1030,1,0,0,0,1047,
	1031,1,0,0,0,1047,1032,1,0,0,0,1047,1033,1,0,0,0,1047,1034,1,0,0,0,1047,
	1035,1,0,0,0,1047,1036,1,0,0,0,1047,1037,1,0,0,0,1047,1038,1,0,0,0,1047,
	1039,1,0,0,0,1047,1040,1,0,0,0,1047,1041,1,0,0,0,1047,1042,1,0,0,0,1047,
	1043,1,0,0,0,1047,1044,1,0,0,0,1047,1045,1,0,0,0,1047,1046,1,0,0,0,1048,
	107,1,0,0,0,1049,1050,5,71,0,0,1050,1051,5,12,0,0,1051,1052,5,172,0,0,1052,
	1053,5,40,0,0,1053,1054,3,222,111,0,1054,1055,5,5,0,0,1055,1056,3,222,111,
	0,1056,1057,5,41,0,0,1057,1058,5,2,0,0,1058,109,1,0,0,0,1059,1060,5,71,
	0,0,1060,1061,5,12,0,0,1061,1062,5,172,0,0,1062,1063,5,58,0,0,1063,1064,
	3,222,111,0,1064,1065,5,59,0,0,1065,1066,5,12,0,0,1066,1067,5,172,0,0,1067,
	1068,5,40,0,0,1068,1073,3,222,111,0,1069,1070,5,5,0,0,1070,1072,3,222,111,
	0,1071,1069,1,0,0,0,1072,1075,1,0,0,0,1073,1071,1,0,0,0,1073,1074,1,0,0,
	0,1074,1076,1,0,0,0,1075,1073,1,0,0,0,1076,1077,5,41,0,0,1077,1078,5,2,
	0,0,1078,111,1,0,0,0,1079,1080,5,72,0,0,1080,1109,5,2,0,0,1081,1082,5,72,
	0,0,1082,1087,3,222,111,0,1083,1084,5,5,0,0,1084,1086,3,222,111,0,1085,
	1083,1,0,0,0,1086,1089,1,0,0,0,1087,1085,1,0,0,0,1087,1088,1,0,0,0,1088,
	1090,1,0,0,0,1089,1087,1,0,0,0,1090,1091,5,2,0,0,1091,1109,1,0,0,0,1092,
	1093,5,72,0,0,1093,1094,5,40,0,0,1094,1099,3,222,111,0,1095,1096,5,5,0,
	0,1096,1098,3,222,111,0,1097,1095,1,0,0,0,1098,1101,1,0,0,0,1099,1097,1,
	0,0,0,1099,1100,1,0,0,0,1100,1103,1,0,0,0,1101,1099,1,0,0,0,1102,1104,5,
	5,0,0,1103,1102,1,0,0,0,1103,1104,1,0,0,0,1104,1105,1,0,0,0,1105,1106,5,
	41,0,0,1106,1107,5,2,0,0,1107,1109,1,0,0,0,1108,1079,1,0,0,0,1108,1081,
	1,0,0,0,1108,1092,1,0,0,0,1109,113,1,0,0,0,1110,1111,5,172,0,0,1111,1112,
	3,214,107,0,1112,1113,5,2,0,0,1113,1133,1,0,0,0,1114,1115,5,172,0,0,1115,
	1116,5,12,0,0,1116,1117,5,172,0,0,1117,1118,3,214,107,0,1118,1119,5,2,0,
	0,1119,1133,1,0,0,0,1120,1121,5,172,0,0,1121,1122,3,214,107,0,1122,1123,
	5,12,0,0,1123,1124,5,172,0,0,1124,1125,5,12,0,0,1125,1127,5,172,0,0,1126,
	1128,3,216,108,0,1127,1126,1,0,0,0,1127,1128,1,0,0,0,1128,1129,1,0,0,0,
	1129,1130,3,214,107,0,1130,1131,5,2,0,0,1131,1133,1,0,0,0,1132,1110,1,0,
	0,0,1132,1114,1,0,0,0,1132,1120,1,0,0,0,1133,115,1,0,0,0,1134,1135,3,222,
	111,0,1135,1136,5,12,0,0,1136,1138,5,172,0,0,1137,1139,3,216,108,0,1138,
	1137,1,0,0,0,1138,1139,1,0,0,0,1139,1140,1,0,0,0,1140,1141,3,214,107,0,
	1141,1142,5,2,0,0,1142,117,1,0,0,0,1143,1144,5,73,0,0,1144,1145,5,172,0,
	0,1145,1146,3,214,107,0,1146,1147,5,2,0,0,1147,119,1,0,0,0,1148,1149,5,
	71,0,0,1149,1150,5,12,0,0,1150,1155,5,172,0,0,1151,1152,5,58,0,0,1152,1153,
	3,222,111,0,1153,1154,5,59,0,0,1154,1156,1,0,0,0,1155,1151,1,0,0,0,1156,
	1157,1,0,0,0,1157,1155,1,0,0,0,1157,1158,1,0,0,0,1158,1159,1,0,0,0,1159,
	1160,5,31,0,0,1160,1161,3,222,111,0,1161,1162,5,2,0,0,1162,121,1,0,0,0,
	1163,1164,5,71,0,0,1164,1165,5,12,0,0,1165,1170,5,172,0,0,1166,1167,5,58,
	0,0,1167,1168,3,222,111,0,1168,1169,5,59,0,0,1169,1171,1,0,0,0,1170,1166,
	1,0,0,0,1171,1172,1,0,0,0,1172,1170,1,0,0,0,1172,1173,1,0,0,0,1173,1174,
	1,0,0,0,1174,1175,5,12,0,0,1175,1176,5,172,0,0,1176,1177,5,31,0,0,1177,
	1178,3,222,111,0,1178,1179,5,2,0,0,1179,123,1,0,0,0,1180,1181,5,71,0,0,
	1181,1182,5,12,0,0,1182,1189,5,172,0,0,1183,1184,5,58,0,0,1184,1185,3,222,
	111,0,1185,1186,5,59,0,0,1186,1188,1,0,0,0,1187,1183,1,0,0,0,1188,1191,
	1,0,0,0,1189,1187,1,0,0,0,1189,1190,1,0,0,0,1190,1192,1,0,0,0,1191,1189,
	1,0,0,0,1192,1193,5,74,0,0,1193,1194,5,40,0,0,1194,1195,3,222,111,0,1195,
	1196,5,41,0,0,1196,1197,5,2,0,0,1197,125,1,0,0,0,1198,1199,5,71,0,0,1199,
	1200,5,12,0,0,1200,1201,5,172,0,0,1201,1202,5,31,0,0,1202,1203,3,222,111,
	0,1203,1204,5,2,0,0,1204,127,1,0,0,0,1205,1209,3,234,117,0,1206,1208,3,
	226,113,0,1207,1206,1,0,0,0,1208,1211,1,0,0,0,1209,1207,1,0,0,0,1209,1210,
	1,0,0,0,1210,1212,1,0,0,0,1211,1209,1,0,0,0,1212,1215,5,172,0,0,1213,1214,
	5,31,0,0,1214,1216,3,222,111,0,1215,1213,1,0,0,0,1215,1216,1,0,0,0,1216,
	1217,1,0,0,0,1217,1218,5,2,0,0,1218,1232,1,0,0,0,1219,1223,3,78,39,0,1220,
	1222,3,226,113,0,1221,1220,1,0,0,0,1222,1225,1,0,0,0,1223,1221,1,0,0,0,
	1223,1224,1,0,0,0,1224,1226,1,0,0,0,1225,1223,1,0,0,0,1226,1227,5,172,0,
	0,1227,1228,5,31,0,0,1228,1229,3,222,111,0,1229,1230,5,2,0,0,1230,1232,
	1,0,0,0,1231,1205,1,0,0,0,1231,1219,1,0,0,0,1232,129,1,0,0,0,1233,1234,
	3,234,117,0,1234,1239,5,172,0,0,1235,1236,5,5,0,0,1236,1237,3,234,117,0,
	1237,1238,5,172,0,0,1238,1240,1,0,0,0,1239,1235,1,0,0,0,1240,1241,1,0,0,
	0,1241,1239,1,0,0,0,1241,1242,1,0,0,0,1242,1243,1,0,0,0,1243,1244,5,31,
	0,0,1244,1245,3,222,111,0,1245,1246,5,2,0,0,1246,1282,1,0,0,0,1247,1248,
	5,40,0,0,1248,1251,3,132,66,0,1249,1250,5,5,0,0,1250,1252,3,132,66,0,1251,
	1249,1,0,0,0,1252,1253,1,0,0,0,1253,1251,1,0,0,0,1253,1254,1,0,0,0,1254,
	1255,1,0,0,0,1255,1256,5,41,0,0,1256,1257,5,31,0,0,1257,1258,5,40,0,0,1258,
	1261,3,222,111,0,1259,1260,5,5,0,0,1260,1262,3,222,111,0,1261,1259,1,0,
	0,0,1262,1263,1,0,0,0,1263,1261,1,0,0,0,1263,1264,1,0,0,0,1264,1265,1,0,
	0,0,1265,1266,5,41,0,0,1266,1267,5,2,0,0,1267,1282,1,0,0,0,1268,1269,5,
	40,0,0,1269,1272,3,132,66,0,1270,1271,5,5,0,0,1271,1273,3,132,66,0,1272,
	1270,1,0,0,0,1273,1274,1,0,0,0,1274,1272,1,0,0,0,1274,1275,1,0,0,0,1275,
	1276,1,0,0,0,1276,1277,5,41,0,0,1277,1278,5,31,0,0,1278,1279,3,222,111,
	0,1279,1280,5,2,0,0,1280,1282,1,0,0,0,1281,1233,1,0,0,0,1281,1247,1,0,0,
	0,1281,1268,1,0,0,0,1282,131,1,0,0,0,1283,1284,3,234,117,0,1284,1285,5,
	172,0,0,1285,1289,1,0,0,0,1286,1289,5,172,0,0,1287,1289,1,0,0,0,1288,1283,
	1,0,0,0,1288,1286,1,0,0,0,1288,1287,1,0,0,0,1289,133,1,0,0,0,1290,1291,
	5,172,0,0,1291,1292,7,6,0,0,1292,1293,3,222,111,0,1293,1294,5,2,0,0,1294,
	1299,1,0,0,0,1295,1296,5,172,0,0,1296,1297,7,7,0,0,1297,1299,5,2,0,0,1298,
	1290,1,0,0,0,1298,1295,1,0,0,0,1299,135,1,0,0,0,1300,1301,5,172,0,0,1301,
	1302,5,87,0,0,1302,1303,5,40,0,0,1303,1304,3,222,111,0,1304,1305,5,41,0,
	0,1305,1306,5,2,0,0,1306,137,1,0,0,0,1307,1308,5,172,0,0,1308,1309,5,88,
	0,0,1309,1310,5,40,0,0,1310,1311,5,41,0,0,1311,1312,5,2,0,0,1312,139,1,
	0,0,0,1313,1314,5,172,0,0,1314,1315,5,58,0,0,1315,1316,3,222,111,0,1316,
	1317,5,59,0,0,1317,1318,5,31,0,0,1318,1319,3,222,111,0,1319,1320,5,2,0,
	0,1320,141,1,0,0,0,1321,1322,5,172,0,0,1322,1323,5,74,0,0,1323,1324,5,40,
	0,0,1324,1325,3,222,111,0,1325,1326,5,41,0,0,1326,1327,5,2,0,0,1327,143,
	1,0,0,0,1328,1329,5,71,0,0,1329,1330,5,12,0,0,1330,1331,5,172,0,0,1331,
	1332,5,87,0,0,1332,1333,5,40,0,0,1333,1334,3,222,111,0,1334,1335,5,41,0,
	0,1335,1336,5,2,0,0,1336,145,1,0,0,0,1337,1338,5,71,0,0,1338,1339,5,12,
	0,0,1339,1340,5,172,0,0,1340,1341,5,88,0,0,1341,1342,5,40,0,0,1342,1343,
	5,41,0,0,1343,1344,5,2,0,0,1344,147,1,0,0,0,1345,1346,5,89,0,0,1346,1347,
	5,172,0,0,1347,1368,5,2,0,0,1348,1349,5,89,0,0,1349,1350,5,71,0,0,1350,
	1351,5,12,0,0,1351,1352,5,172,0,0,1352,1368,5,2,0,0,1353,1354,5,89,0,0,
	1354,1355,5,71,0,0,1355,1356,5,12,0,0,1356,1361,5,172,0,0,1357,1358,5,58,
	0,0,1358,1359,3,222,111,0,1359,1360,5,59,0,0,1360,1362,1,0,0,0,1361,1357,
	1,0,0,0,1362,1363,1,0,0,0,1363,1361,1,0,0,0,1363,1364,1,0,0,0,1364,1365,
	1,0,0,0,1365,1366,5,2,0,0,1366,1368,1,0,0,0,1367,1345,1,0,0,0,1367,1348,
	1,0,0,0,1367,1353,1,0,0,0,1368,149,1,0,0,0,1369,1370,5,90,0,0,1370,1371,
	5,40,0,0,1371,1372,5,163,0,0,1372,1373,5,23,0,0,1373,1376,3,222,111,0,1374,
	1375,5,5,0,0,1375,1377,3,200,100,0,1376,1374,1,0,0,0,1376,1377,1,0,0,0,
	1377,1378,1,0,0,0,1378,1379,5,41,0,0,1379,1380,5,2,0,0,1380,151,1,0,0,0,
	1381,1382,5,90,0,0,1382,1383,5,40,0,0,1383,1386,3,222,111,0,1384,1385,5,
	5,0,0,1385,1387,3,200,100,0,1386,1384,1,0,0,0,1386,1387,1,0,0,0,1387,1388,
	1,0,0,0,1388,1389,5,41,0,0,1389,1390,5,2,0,0,1390,153,1,0,0,0,1391,1392,
	5,91,0,0,1392,1393,5,40,0,0,1393,1394,3,222,111,0,1394,1395,5,41,0,0,1395,
	1398,3,104,52,0,1396,1397,5,92,0,0,1397,1399,3,104,52,0,1398,1396,1,0,0,
	0,1398,1399,1,0,0,0,1399,155,1,0,0,0,1400,1407,3,172,86,0,1401,1407,3,174,
	87,0,1402,1407,3,164,82,0,1403,1407,3,158,79,0,1404,1407,3,160,80,0,1405,
	1407,3,162,81,0,1406,1400,1,0,0,0,1406,1401,1,0,0,0,1406,1402,1,0,0,0,1406,
	1403,1,0,0,0,1406,1404,1,0,0,0,1406,1405,1,0,0,0,1407,157,1,0,0,0,1408,
	1409,5,9,0,0,1409,1410,5,40,0,0,1410,1411,3,234,117,0,1411,1412,5,172,0,
	0,1412,1413,5,5,0,0,1413,1414,3,234,117,0,1414,1415,5,172,0,0,1415,1416,
	5,93,0,0,1416,1417,5,71,0,0,1417,1418,5,12,0,0,1418,1419,5,172,0,0,1419,
	1420,5,12,0,0,1420,1421,5,94,0,0,1421,1422,5,41,0,0,1422,1423,3,104,52,
	0,1423,159,1,0,0,0,1424,1425,5,9,0,0,1425,1426,5,40,0,0,1426,1427,3,234,
	117,0,1427,1428,5,172,0,0,1428,1429,5,95,0,0,1429,1430,5,71,0,0,1430,1431,
	5,12,0,0,1431,1432,5,172,0,0,1432,1433,5,41,0,0,1433,1434,3,104,52,0,1434,
	161,1,0,0,0,1435,1436,5,9,0,0,1436,1437,5,40,0,0,1437,1438,3,234,117,0,
	1438,1439,5,172,0,0,1439,1440,5,93,0,0,1440,1441,5,71,0,0,1441,1442,5,12,
	0,0,1442,1443,5,172,0,0,1443,1444,5,41,0,0,1444,1445,3,104,52,0,1445,163,
	1,0,0,0,1446,1447,5,9,0,0,1447,1448,5,40,0,0,1448,1449,3,166,83,0,1449,
	1450,3,168,84,0,1450,1451,3,170,85,0,1451,1452,5,41,0,0,1452,1453,3,104,
	52,0,1453,165,1,0,0,0,1454,1458,3,234,117,0,1455,1457,3,226,113,0,1456,
	1455,1,0,0,0,1457,1460,1,0,0,0,1458,1456,1,0,0,0,1458,1459,1,0,0,0,1459,
	1461,1,0,0,0,1460,1458,1,0,0,0,1461,1462,5,172,0,0,1462,1463,5,31,0,0,1463,
	1464,3,222,111,0,1464,1465,5,2,0,0,1465,167,1,0,0,0,1466,1467,3,222,111,
	0,1467,1468,5,2,0,0,1468,169,1,0,0,0,1469,1470,5,172,0,0,1470,1471,7,6,
	0,0,1471,1475,3,222,111,0,1472,1473,5,172,0,0,1473,1475,7,7,0,0,1474,1469,
	1,0,0,0,1474,1472,1,0,0,0,1475,171,1,0,0,0,1476,1477,5,96,0,0,1477,1478,
	3,104,52,0,1478,1479,5,97,0,0,1479,1480,5,40,0,0,1480,1481,3,222,111,0,
	1481,1482,5,41,0,0,1482,1483,5,2,0,0,1483,173,1,0,0,0,1484,1485,5,97,0,
	0,1485,1486,5,40,0,0,1486,1487,3,222,111,0,1487,1488,5,41,0,0,1488,1489,
	3,104,52,0,1489,175,1,0,0,0,1490,1491,5,98,0,0,1491,1492,3,208,104,0,1492,
	1493,5,2,0,0,1493,177,1,0,0,0,1494,1495,5,99,0,0,1495,1499,5,4,0,0,1496,
	1498,3,180,90,0,1497,1496,1,0,0,0,1498,1501,1,0,0,0,1499,1497,1,0,0,0,1499,
	1500,1,0,0,0,1500,1502,1,0,0,0,1501,1499,1,0,0,0,1502,1503,5,6,0,0,1503,
	179,1,0,0,0,1504,1505,7,8,0,0,1505,181,1,0,0,0,1506,1507,5,100,0,0,1507,
	1511,5,4,0,0,1508,1510,3,106,53,0,1509,1508,1,0,0,0,1510,1513,1,0,0,0,1511,
	1509,1,0,0,0,1511,1512,1,0,0,0,1512,1514,1,0,0,0,1513,1511,1,0,0,0,1514,
	1515,5,6,0,0,1515,183,1,0,0,0,1516,1517,5,101,0,0,1517,1518,5,40,0,0,1518,
	1519,3,222,111,0,1519,1520,5,41,0,0,1520,1524,5,4,0,0,1521,1523,3,186,93,
	0,1522,1521,1,0,0,0,1523,1526,1,0,0,0,1524,1522,1,0,0,0,1524,1525,1,0,0,
	0,1525,1528,1,0,0,0,1526,1524,1,0,0,0,1527,1529,3,188,94,0,1528,1527,1,
	0,0,0,1528,1529,1,0,0,0,1529,1530,1,0,0,0,1530,1531,5,6,0,0,1531,185,1,
	0,0,0,1532,1533,5,102,0,0,1533,1534,3,222,111,0,1534,1538,5,103,0,0,1535,
	1537,3,106,53,0,1536,1535,1,0,0,0,1537,1540,1,0,0,0,1538,1536,1,0,0,0,1538,
	1539,1,0,0,0,1539,187,1,0,0,0,1540,1538,1,0,0,0,1541,1542,5,104,0,0,1542,
	1546,5,103,0,0,1543,1545,3,106,53,0,1544,1543,1,0,0,0,1545,1548,1,0,0,0,
	1546,1544,1,0,0,0,1546,1547,1,0,0,0,1547,189,1,0,0,0,1548,1546,1,0,0,0,
	1549,1550,5,105,0,0,1550,1552,3,222,111,0,1551,1553,3,192,96,0,1552,1551,
	1,0,0,0,1552,1553,1,0,0,0,1553,1554,1,0,0,0,1554,1556,3,104,52,0,1555,1557,
	3,194,97,0,1556,1555,1,0,0,0,1557,1558,1,0,0,0,1558,1556,1,0,0,0,1558,1559,
	1,0,0,0,1559,191,1,0,0,0,1560,1561,5,70,0,0,1561,1573,5,40,0,0,1562,1567,
	3,102,51,0,1563,1564,5,5,0,0,1564,1566,3,102,51,0,1565,1563,1,0,0,0,1566,
	1569,1,0,0,0,1567,1565,1,0,0,0,1567,1568,1,0,0,0,1568,1571,1,0,0,0,1569,
	1567,1,0,0,0,1570,1572,5,5,0,0,1571,1570,1,0,0,0,1571,1572,1,0,0,0,1572,
	1574,1,0,0,0,1573,1562,1,0,0,0,1573,1574,1,0,0,0,1574,1575,1,0,0,0,1575,
	1576,5,41,0,0,1576,193,1,0,0,0,1577,1579,5,106,0,0,1578,1580,5,172,0,0,
	1579,1578,1,0,0,0,1579,1580,1,0,0,0,1580,1596,1,0,0,0,1581,1593,5,40,0,
	0,1582,1587,3,102,51,0,1583,1584,5,5,0,0,1584,1586,3,102,51,0,1585,1583,
	1,0,0,0,1586,1589,1,0,0,0,1587,1585,1,0,0,0,1587,1588,1,0,0,0,1588,1591,
	1,0,0,0,1589,1587,1,0,0,0,1590,1592,5,5,0,0,1591,1590,1,0,0,0,1591,1592,
	1,0,0,0,1592,1594,1,0,0,0,1593,1582,1,0,0,0,1593,1594,1,0,0,0,1594,1595,
	1,0,0,0,1595,1597,5,41,0,0,1596,1581,1,0,0,0,1596,1597,1,0,0,0,1597,1598,
	1,0,0,0,1598,1599,3,104,52,0,1599,195,1,0,0,0,1600,1601,5,107,0,0,1601,
	1602,5,2,0,0,1602,197,1,0,0,0,1603,1604,5,108,0,0,1604,1605,5,2,0,0,1605,
	199,1,0,0,0,1606,1610,5,160,0,0,1607,1608,5,172,0,0,1608,1610,3,214,107,
	0,1609,1606,1,0,0,0,1609,1607,1,0,0,0,1610,201,1,0,0,0,1611,1612,5,109,
	0,0,1612,1613,5,172,0,0,1613,1614,3,214,107,0,1614,1615,5,2,0,0,1615,1626,
	1,0,0,0,1616,1617,5,109,0,0,1617,1618,5,40,0,0,1618,1619,5,160,0,0,1619,
	1620,5,41,0,0,1620,1626,5,2,0,0,1621,1622,5,109,0,0,1622,1623,5,40,0,0,
	1623,1624,5,41,0,0,1624,1626,5,2,0,0,1625,1611,1,0,0,0,1625,1616,1,0,0,
	0,1625,1621,1,0,0,0,1626,203,1,0,0,0,1627,1628,5,110,0,0,1628,1629,5,40,
	0,0,1629,1630,3,222,111,0,1630,1631,5,41,0,0,1631,1632,5,2,0,0,1632,205,
	1,0,0,0,1633,1636,5,172,0,0,1634,1636,3,228,114,0,1635,1633,1,0,0,0,1635,
	1634,1,0,0,0,1636,207,1,0,0,0,1637,1649,5,40,0,0,1638,1643,3,206,103,0,
	1639,1640,5,5,0,0,1640,1642,3,206,103,0,1641,1639,1,0,0,0,1642,1645,1,0,
	0,0,1643,1641,1,0,0,0,1643,1644,1,0,0,0,1644,1647,1,0,0,0,1645,1643,1,0,
	0,0,1646,1648,5,5,0,0,1647,1646,1,0,0,0,1647,1648,1,0,0,0,1648,1650,1,0,
	0,0,1649,1638,1,0,0,0,1649,1650,1,0,0,0,1650,1651,1,0,0,0,1651,1652,5,41,
	0,0,1652,209,1,0,0,0,1653,1654,5,172,0,0,1654,1678,3,214,107,0,1655,1656,
	5,172,0,0,1656,1657,5,12,0,0,1657,1658,5,172,0,0,1658,1678,3,214,107,0,
	1659,1660,5,172,0,0,1660,1661,5,40,0,0,1661,1673,5,4,0,0,1662,1667,3,212,
	106,0,1663,1664,5,5,0,0,1664,1666,3,212,106,0,1665,1663,1,0,0,0,1666,1669,
	1,0,0,0,1667,1665,1,0,0,0,1667,1668,1,0,0,0,1668,1671,1,0,0,0,1669,1667,
	1,0,0,0,1670,1672,5,5,0,0,1671,1670,1,0,0,0,1671,1672,1,0,0,0,1672,1674,
	1,0,0,0,1673,1662,1,0,0,0,1673,1674,1,0,0,0,1674,1675,1,0,0,0,1675,1676,
	5,6,0,0,1676,1678,5,41,0,0,1677,1653,1,0,0,0,1677,1655,1,0,0,0,1677,1659,
	1,0,0,0,1678,211,1,0,0,0,1679,1680,5,172,0,0,1680,1681,5,103,0,0,1681,1682,
	3,222,111,0,1682,213,1,0,0,0,1683,1695,5,40,0,0,1684,1689,3,222,111,0,1685,
	1686,5,5,0,0,1686,1688,3,222,111,0,1687,1685,1,0,0,0,1688,1691,1,0,0,0,
	1689,1687,1,0,0,0,1689,1690,1,0,0,0,1690,1693,1,0,0,0,1691,1689,1,0,0,0,
	1692,1694,5,5,0,0,1693,1692,1,0,0,0,1693,1694,1,0,0,0,1694,1696,1,0,0,0,
	1695,1684,1,0,0,0,1695,1696,1,0,0,0,1696,1697,1,0,0,0,1697,1698,5,41,0,
	0,1698,215,1,0,0,0,1699,1700,5,4,0,0,1700,1705,3,218,109,0,1701,1702,5,
	5,0,0,1702,1704,3,218,109,0,1703,1701,1,0,0,0,1704,1707,1,0,0,0,1705,1703,
	1,0,0,0,1705,1706,1,0,0,0,1706,1709,1,0,0,0,1707,1705,1,0,0,0,1708,1710,
	5,5,0,0,1709,1708,1,0,0,0,1709,1710,1,0,0,0,1710,1711,1,0,0,0,1711,1712,
	5,6,0,0,1712,217,1,0,0,0,1713,1714,5,172,0,0,1714,1715,5,103,0,0,1715,1716,
	3,222,111,0,1716,219,1,0,0,0,1717,1718,5,40,0,0,1718,1723,3,234,117,0,1719,
	1720,5,5,0,0,1720,1722,3,234,117,0,1721,1719,1,0,0,0,1722,1725,1,0,0,0,
	1723,1721,1,0,0,0,1723,1724,1,0,0,0,1724,1727,1,0,0,0,1725,1723,1,0,0,0,
	1726,1728,5,5,0,0,1727,1726,1,0,0,0,1727,1728,1,0,0,0,1728,1729,1,0,0,0,
	1729,1730,5,41,0,0,1730,221,1,0,0,0,1731,1732,6,111,-1,0,1732,1733,5,40,
	0,0,1733,1734,3,222,111,0,1734,1735,5,41,0,0,1735,1861,1,0,0,0,1736,1737,
	3,236,118,0,1737,1738,5,40,0,0,1738,1740,3,222,111,0,1739,1741,5,5,0,0,
	1740,1739,1,0,0,0,1740,1741,1,0,0,0,1741,1742,1,0,0,0,1742,1743,5,41,0,
	0,1743,1861,1,0,0,0,1744,1861,3,210,105,0,1745,1746,5,111,0,0,1746,1748,
	5,172,0,0,1747,1749,3,216,108,0,1748,1747,1,0,0,0,1748,1749,1,0,0,0,1749,
	1750,1,0,0,0,1750,1861,3,214,107,0,1751,1752,5,111,0,0,1752,1753,3,234,
	117,0,1753,1754,5,58,0,0,1754,1755,5,59,0,0,1755,1756,5,40,0,0,1756,1757,
	3,222,111,0,1757,1758,5,41,0,0,1758,1861,1,0,0,0,1759,1760,5,47,0,0,1760,
	1761,5,40,0,0,1761,1762,3,234,117,0,1762,1763,5,41,0,0,1763,1764,5,12,0,
	0,1764,1765,5,172,0,0,1765,1861,1,0,0,0,1766,1767,5,112,0,0,1767,1861,3,
	214,107,0,1768,1769,5,113,0,0,1769,1861,3,214,107,0,1770,1771,5,114,0,0,
	1771,1861,3,214,107,0,1772,1773,5,115,0,0,1773,1861,3,214,107,0,1774,1775,
	5,116,0,0,1775,1776,5,40,0,0,1776,1777,5,172,0,0,1777,1778,5,12,0,0,1778,
	1779,5,172,0,0,1779,1780,5,5,0,0,1780,1781,3,214,107,0,1781,1782,5,41,0,
	0,1782,1861,1,0,0,0,1783,1784,5,117,0,0,1784,1861,3,214,107,0,1785,1786,
	5,118,0,0,1786,1861,3,214,107,0,1787,1788,5,119,0,0,1788,1789,5,40,0,0,
	1789,1790,3,222,111,0,1790,1791,5,5,0,0,1791,1792,3,220,110,0,1792,1793,
	5,41,0,0,1793,1861,1,0,0,0,1794,1795,5,120,0,0,1795,1796,5,40,0,0,1796,
	1797,3,222,111,0,1797,1798,5,5,0,0,1798,1799,3,220,110,0,1799,1800,5,5,
	0,0,1800,1801,5,155,0,0,1801,1802,5,41,0,0,1802,1861,1,0,0,0,1803,1804,
	5,121,0,0,1804,1805,5,58,0,0,1805,1806,3,222,111,0,1806,1807,5,59,0,0,1807,
	1808,7,9,0,0,1808,1861,1,0,0,0,1809,1810,5,127,0,0,1810,1811,5,58,0,0,1811,
	1812,3,222,111,0,1812,1813,5,59,0,0,1813,1814,7,10,0,0,1814,1861,1,0,0,
	0,1815,1816,7,11,0,0,1816,1861,3,222,111,21,1817,1829,5,58,0,0,1818,1823,
	3,222,111,0,1819,1820,5,5,0,0,1820,1822,3,222,111,0,1821,1819,1,0,0,0,1822,
	1825,1,0,0,0,1823,1821,1,0,0,0,1823,1824,1,0,0,0,1824,1827,1,0,0,0,1825,
	1823,1,0,0,0,1826,1828,5,5,0,0,1827,1826,1,0,0,0,1827,1828,1,0,0,0,1828,
	1830,1,0,0,0,1829,1818,1,0,0,0,1829,1830,1,0,0,0,1830,1831,1,0,0,0,1831,
	1861,5,59,0,0,1832,1833,5,71,0,0,1833,1834,5,12,0,0,1834,1835,5,172,0,0,
	1835,1836,5,12,0,0,1836,1837,5,172,0,0,1837,1838,5,58,0,0,1838,1839,3,222,
	111,0,1839,1840,5,59,0,0,1840,1841,3,224,112,0,1841,1861,1,0,0,0,1842,1843,
	5,71,0,0,1843,1844,5,12,0,0,1844,1849,5,172,0,0,1845,1846,5,58,0,0,1846,
	1847,3,222,111,0,1847,1848,5,59,0,0,1848,1850,1,0,0,0,1849,1845,1,0,0,0,
	1850,1851,1,0,0,0,1851,1849,1,0,0,0,1851,1852,1,0,0,0,1852,1861,1,0,0,0,
	1853,1854,5,71,0,0,1854,1855,5,12,0,0,1855,1861,5,172,0,0,1856,1861,5,71,
	0,0,1857,1861,5,169,0,0,1858,1861,5,172,0,0,1859,1861,3,228,114,0,1860,
	1731,1,0,0,0,1860,1736,1,0,0,0,1860,1744,1,0,0,0,1860,1745,1,0,0,0,1860,
	1751,1,0,0,0,1860,1759,1,0,0,0,1860,1766,1,0,0,0,1860,1768,1,0,0,0,1860,
	1770,1,0,0,0,1860,1772,1,0,0,0,1860,1774,1,0,0,0,1860,1783,1,0,0,0,1860,
	1785,1,0,0,0,1860,1787,1,0,0,0,1860,1794,1,0,0,0,1860,1803,1,0,0,0,1860,
	1809,1,0,0,0,1860,1815,1,0,0,0,1860,1817,1,0,0,0,1860,1832,1,0,0,0,1860,
	1842,1,0,0,0,1860,1853,1,0,0,0,1860,1856,1,0,0,0,1860,1857,1,0,0,0,1860,
	1858,1,0,0,0,1860,1859,1,0,0,0,1861,1944,1,0,0,0,1862,1863,10,20,0,0,1863,
	1864,5,17,0,0,1864,1943,3,222,111,20,1865,1866,10,19,0,0,1866,1867,7,12,
	0,0,1867,1943,3,222,111,20,1868,1869,10,18,0,0,1869,1870,7,13,0,0,1870,
	1943,3,222,111,19,1871,1872,10,17,0,0,1872,1873,7,14,0,0,1873,1943,3,222,
	111,18,1874,1875,10,16,0,0,1875,1876,7,15,0,0,1876,1943,3,222,111,17,1877,
	1878,10,15,0,0,1878,1879,7,16,0,0,1879,1943,3,222,111,16,1880,1881,10,14,
	0,0,1881,1882,5,24,0,0,1882,1943,3,222,111,15,1883,1884,10,13,0,0,1884,
	1885,5,26,0,0,1885,1943,3,222,111,14,1886,1887,10,12,0,0,1887,1888,5,25,
	0,0,1888,1943,3,222,111,13,1889,1890,10,11,0,0,1890,1891,5,139,0,0,1891,
	1943,3,222,111,12,1892,1893,10,10,0,0,1893,1894,5,140,0,0,1894,1943,3,222,
	111,11,1895,1896,10,9,0,0,1896,1897,5,141,0,0,1897,1898,3,222,111,0,1898,
	1899,5,103,0,0,1899,1900,3,222,111,9,1900,1943,1,0,0,0,1901,1902,10,31,
	0,0,1902,1903,5,58,0,0,1903,1904,3,222,111,0,1904,1905,5,103,0,0,1905,1906,
	3,222,111,0,1906,1907,5,59,0,0,1907,1943,1,0,0,0,1908,1909,10,30,0,0,1909,
	1910,5,58,0,0,1910,1911,5,155,0,0,1911,1943,5,59,0,0,1912,1913,10,29,0,
	0,1913,1914,5,58,0,0,1914,1915,3,222,111,0,1915,1916,5,59,0,0,1916,1943,
	1,0,0,0,1917,1918,10,26,0,0,1918,1943,7,17,0,0,1919,1920,10,25,0,0,1920,
	1921,5,134,0,0,1921,1922,5,40,0,0,1922,1923,3,222,111,0,1923,1924,5,41,
	0,0,1924,1943,1,0,0,0,1925,1926,10,24,0,0,1926,1927,5,135,0,0,1927,1928,
	5,40,0,0,1928,1929,3,222,111,0,1929,1930,5,5,0,0,1930,1931,3,222,111,0,
	1931,1932,5,41,0,0,1932,1943,1,0,0,0,1933,1934,10,23,0,0,1934,1935,5,12,
	0,0,1935,1937,5,172,0,0,1936,1938,3,216,108,0,1937,1936,1,0,0,0,1937,1938,
	1,0,0,0,1938,1939,1,0,0,0,1939,1943,3,214,107,0,1940,1941,10,22,0,0,1941,
	1943,3,224,112,0,1942,1862,1,0,0,0,1942,1865,1,0,0,0,1942,1868,1,0,0,0,
	1942,1871,1,0,0,0,1942,1874,1,0,0,0,1942,1877,1,0,0,0,1942,1880,1,0,0,0,
	1942,1883,1,0,0,0,1942,1886,1,0,0,0,1942,1889,1,0,0,0,1942,1892,1,0,0,0,
	1942,1895,1,0,0,0,1942,1901,1,0,0,0,1942,1908,1,0,0,0,1942,1912,1,0,0,0,
	1942,1917,1,0,0,0,1942,1919,1,0,0,0,1942,1925,1,0,0,0,1942,1933,1,0,0,0,
	1942,1940,1,0,0,0,1943,1946,1,0,0,0,1944,1942,1,0,0,0,1944,1945,1,0,0,0,
	1945,223,1,0,0,0,1946,1944,1,0,0,0,1947,1948,5,12,0,0,1948,1961,5,172,0,
	0,1949,1961,5,122,0,0,1950,1961,5,123,0,0,1951,1961,5,124,0,0,1952,1961,
	5,125,0,0,1953,1961,5,126,0,0,1954,1961,5,128,0,0,1955,1961,5,129,0,0,1956,
	1961,5,130,0,0,1957,1961,5,131,0,0,1958,1961,5,142,0,0,1959,1961,5,143,
	0,0,1960,1947,1,0,0,0,1960,1949,1,0,0,0,1960,1950,1,0,0,0,1960,1951,1,0,
	0,0,1960,1952,1,0,0,0,1960,1953,1,0,0,0,1960,1954,1,0,0,0,1960,1955,1,0,
	0,0,1960,1956,1,0,0,0,1960,1957,1,0,0,0,1960,1958,1,0,0,0,1960,1959,1,0,
	0,0,1961,225,1,0,0,0,1962,1963,7,18,0,0,1963,227,1,0,0,0,1964,1979,5,152,
	0,0,1965,1979,3,230,115,0,1966,1979,3,232,116,0,1967,1971,5,160,0,0,1968,
	1970,5,160,0,0,1969,1968,1,0,0,0,1970,1973,1,0,0,0,1971,1969,1,0,0,0,1971,
	1972,1,0,0,0,1972,1979,1,0,0,0,1973,1971,1,0,0,0,1974,1979,5,170,0,0,1975,
	1979,5,171,0,0,1976,1979,5,161,0,0,1977,1979,5,162,0,0,1978,1964,1,0,0,
	0,1978,1965,1,0,0,0,1978,1966,1,0,0,0,1978,1967,1,0,0,0,1978,1974,1,0,0,
	0,1978,1975,1,0,0,0,1978,1976,1,0,0,0,1978,1977,1,0,0,0,1979,229,1,0,0,
	0,1980,1982,5,155,0,0,1981,1983,5,153,0,0,1982,1981,1,0,0,0,1982,1983,1,
	0,0,0,1983,231,1,0,0,0,1984,1985,5,154,0,0,1985,233,1,0,0,0,1986,1987,5,
	148,0,0,1987,2030,5,52,0,0,1988,2030,5,148,0,0,1989,2030,5,156,0,0,1990,
	2030,5,158,0,0,1991,2030,5,157,0,0,1992,2030,5,165,0,0,1993,2030,5,166,
	0,0,1994,2030,5,149,0,0,1995,2030,5,150,0,0,1996,2030,5,167,0,0,1997,2030,
	5,168,0,0,1998,1999,5,7,0,0,1999,2008,5,40,0,0,2000,2005,3,234,117,0,2001,
	2002,5,5,0,0,2002,2004,3,234,117,0,2003,2001,1,0,0,0,2004,2007,1,0,0,0,
	2005,2003,1,0,0,0,2005,2006,1,0,0,0,2006,2009,1,0,0,0,2007,2005,1,0,0,0,
	2008,2000,1,0,0,0,2008,2009,1,0,0,0,2009,2010,1,0,0,0,2010,2023,5,41,0,
	0,2011,2012,5,70,0,0,2012,2013,5,40,0,0,2013,2018,3,234,117,0,2014,2015,
	5,5,0,0,2015,2017,3,234,117,0,2016,2014,1,0,0,0,2017,2020,1,0,0,0,2018,
	2016,1,0,0,0,2018,2019,1,0,0,0,2019,2021,1,0,0,0,2020,2018,1,0,0,0,2021,
	2022,5,41,0,0,2022,2024,1,0,0,0,2023,2011,1,0,0,0,2023,2024,1,0,0,0,2024,
	2030,1,0,0,0,2025,2026,5,172,0,0,2026,2027,5,12,0,0,2027,2030,5,172,0,0,
	2028,2030,5,172,0,0,2029,1986,1,0,0,0,2029,1988,1,0,0,0,2029,1989,1,0,0,
	0,2029,1990,1,0,0,0,2029,1991,1,0,0,0,2029,1992,1,0,0,0,2029,1993,1,0,0,
	0,2029,1994,1,0,0,0,2029,1995,1,0,0,0,2029,1996,1,0,0,0,2029,1997,1,0,0,
	0,2029,1998,1,0,0,0,2029,2025,1,0,0,0,2029,2028,1,0,0,0,2030,235,1,0,0,
	0,2031,2032,7,19,0,0,2032,237,1,0,0,0,193,241,247,259,261,266,285,289,296,
	301,307,313,323,326,336,340,346,349,353,358,362,375,378,392,395,401,407,
	413,419,425,431,437,452,465,475,481,487,493,499,505,511,516,524,527,544,
	546,557,563,567,579,583,585,589,595,607,611,613,627,643,647,654,672,677,
	684,695,701,708,716,727,736,742,753,760,766,773,779,785,789,797,802,810,
	820,825,829,841,850,852,858,864,871,882,888,892,898,905,921,930,934,940,
	949,953,961,965,973,977,979,987,996,1001,1007,1012,1047,1073,1087,1099,
	1103,1108,1127,1132,1138,1157,1172,1189,1209,1215,1223,1231,1241,1253,1263,
	1274,1281,1288,1298,1363,1367,1376,1386,1398,1406,1458,1474,1499,1511,1524,
	1528,1538,1546,1552,1558,1567,1571,1573,1579,1587,1591,1593,1596,1609,1625,
	1635,1643,1647,1649,1667,1671,1673,1677,1689,1693,1695,1705,1709,1723,1727,
	1740,1748,1823,1827,1829,1851,1860,1937,1942,1944,1960,1971,1978,1982,2005,
	2008,2018,2023,2029];

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
