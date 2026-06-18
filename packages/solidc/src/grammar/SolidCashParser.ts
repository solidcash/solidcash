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
	public static readonly RULE_unsafeModifier = 46;
	public static readonly RULE_returnType = 47;
	public static readonly RULE_parameterList = 48;
	public static readonly RULE_parameter = 49;
	public static readonly RULE_block = 50;
	public static readonly RULE_statement = 51;
	public static readonly RULE_transferStatement = 52;
	public static readonly RULE_tokenContainerMethodStatement = 53;
	public static readonly RULE_returnStatement = 54;
	public static readonly RULE_functionCallStatement = 55;
	public static readonly RULE_addressMethodStatement = 56;
	public static readonly RULE_emitStatement = 57;
	public static readonly RULE_mappingAssignStatement = 58;
	public static readonly RULE_mappingFieldAssignStatement = 59;
	public static readonly RULE_mappingDeleteStatement = 60;
	public static readonly RULE_stateAssignStatement = 61;
	public static readonly RULE_variableDefinition = 62;
	public static readonly RULE_tupleAssignment = 63;
	public static readonly RULE_tupleSlot = 64;
	public static readonly RULE_assignStatement = 65;
	public static readonly RULE_arrayPushStatement = 66;
	public static readonly RULE_arrayPopStatement = 67;
	public static readonly RULE_arrayAssignStatement = 68;
	public static readonly RULE_arrayDeleteStatement = 69;
	public static readonly RULE_stateArrayPushStatement = 70;
	public static readonly RULE_stateArrayPopStatement = 71;
	public static readonly RULE_deleteStatement = 72;
	public static readonly RULE_timeOpStatement = 73;
	public static readonly RULE_requireStatement = 74;
	public static readonly RULE_ifStatement = 75;
	public static readonly RULE_loopStatement = 76;
	public static readonly RULE_forOfEntriesStatement = 77;
	public static readonly RULE_forInStatement = 78;
	public static readonly RULE_forOfStatement = 79;
	public static readonly RULE_forStatement = 80;
	public static readonly RULE_forInit = 81;
	public static readonly RULE_forCondition = 82;
	public static readonly RULE_forUpdate = 83;
	public static readonly RULE_doWhileStatement = 84;
	public static readonly RULE_whileStatement = 85;
	public static readonly RULE_consoleStatement = 86;
	public static readonly RULE_assemblyStatement = 87;
	public static readonly RULE_assemblyToken = 88;
	public static readonly RULE_uncheckedStatement = 89;
	public static readonly RULE_switchStatement = 90;
	public static readonly RULE_switchCase = 91;
	public static readonly RULE_switchDefault = 92;
	public static readonly RULE_tryCatchStatement = 93;
	public static readonly RULE_tryReturns = 94;
	public static readonly RULE_catchClause = 95;
	public static readonly RULE_breakStatement = 96;
	public static readonly RULE_continueStatement = 97;
	public static readonly RULE_requireMessage = 98;
	public static readonly RULE_revertStatement = 99;
	public static readonly RULE_assertStatement = 100;
	public static readonly RULE_consoleParameter = 101;
	public static readonly RULE_consoleParameterList = 102;
	public static readonly RULE_functionCall = 103;
	public static readonly RULE_namedArg = 104;
	public static readonly RULE_expressionList = 105;
	public static readonly RULE_callOptions = 106;
	public static readonly RULE_callOption = 107;
	public static readonly RULE_typeList = 108;
	public static readonly RULE_expression = 109;
	public static readonly RULE_memberName = 110;
	public static readonly RULE_modifier = 111;
	public static readonly RULE_literal = 112;
	public static readonly RULE_numberLiteral = 113;
	public static readonly RULE_decimalLiteral = 114;
	public static readonly RULE_typeName = 115;
	public static readonly RULE_typeCast = 116;
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
                                                            "'override'", 
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
		"functionModifier", "unsafeModifier", "returnType", "parameterList", "parameter", 
		"block", "statement", "transferStatement", "tokenContainerMethodStatement", 
		"returnStatement", "functionCallStatement", "addressMethodStatement", 
		"emitStatement", "mappingAssignStatement", "mappingFieldAssignStatement", 
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
			this.state = 237;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===28) {
				{
				{
				this.state = 234;
				this.pragmaDirective();
				}
				}
				this.state = 239;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 243;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===1) {
				{
				{
				this.state = 240;
				this.importDirective();
				}
				}
				this.state = 245;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 249;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 74980359) !== 0)) {
				{
				{
				this.state = 246;
				this.constantDefinition();
				}
				}
				this.state = 251;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 255;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===45) {
				{
				{
				this.state = 252;
				this.enumDefinition();
				}
				}
				this.state = 257;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 261;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===44) {
				{
				{
				this.state = 258;
				this.structDefinition();
				}
				}
				this.state = 263;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 267;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===46) {
				{
				{
				this.state = 264;
				this.typeDefinition();
				}
				}
				this.state = 269;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 273;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===8) {
				{
				{
				this.state = 270;
				this.usingForDirective();
				}
				}
				this.state = 275;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 279;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===43) {
				{
				{
				this.state = 276;
				this.errorDefinition();
				}
				}
				this.state = 281;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 285;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===31) {
				{
				{
				this.state = 282;
				this.interfaceDefinition();
				}
				}
				this.state = 287;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 291;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 288;
				this.freeFunctionDefinition();
				}
				}
				this.state = 293;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 297;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 10, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 294;
					this.libraryDefinition();
					}
					}
				}
				this.state = 299;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 10, this._ctx);
			}
			this.state = 302;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 36:
			case 37:
				{
				this.state = 300;
				this.contractDefinition();
				}
				break;
			case 35:
				{
				this.state = 301;
				this.libraryDefinition();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
			this.state = 304;
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
			this.state = 332;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 14, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 306;
				this.match(SolidCashParser.T__0);
				this.state = 307;
				this.match(SolidCashParser.StringLiteral);
				this.state = 308;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 309;
				this.match(SolidCashParser.T__0);
				this.state = 310;
				this.match(SolidCashParser.StringLiteral);
				this.state = 311;
				this.match(SolidCashParser.T__2);
				this.state = 312;
				this.match(SolidCashParser.Identifier);
				this.state = 313;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 314;
				this.match(SolidCashParser.T__0);
				this.state = 315;
				this.match(SolidCashParser.T__3);
				this.state = 316;
				this.importBinding();
				this.state = 321;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 12, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 317;
						this.match(SolidCashParser.T__4);
						this.state = 318;
						this.importBinding();
						}
						}
					}
					this.state = 323;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 12, this._ctx);
				}
				this.state = 325;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 324;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 327;
				this.match(SolidCashParser.T__5);
				this.state = 328;
				this.match(SolidCashParser.Identifier);
				this.state = 329;
				this.match(SolidCashParser.StringLiteral);
				this.state = 330;
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
			this.state = 334;
			this.match(SolidCashParser.Identifier);
			this.state = 337;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 335;
				this.match(SolidCashParser.T__2);
				this.state = 336;
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
			this.state = 339;
			this.match(SolidCashParser.T__6);
			this.state = 340;
			this.match(SolidCashParser.Identifier);
			this.state = 341;
			this.parameterList();
			this.state = 343;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 342;
				this.returnType();
				}
			}

			this.state = 345;
			this.match(SolidCashParser.T__3);
			this.state = 349;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				{
				this.state = 346;
				this.statement();
				}
				}
				this.state = 351;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 352;
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
			this.state = 389;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 24, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 354;
				this.match(SolidCashParser.T__7);
				this.state = 355;
				this.match(SolidCashParser.Identifier);
				this.state = 356;
				this.match(SolidCashParser.T__8);
				this.state = 359;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
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
					this.state = 357;
					this.typeName();
					}
					break;
				case 10:
					{
					this.state = 358;
					this.match(SolidCashParser.T__9);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 362;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 361;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 364;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 365;
				this.match(SolidCashParser.T__7);
				this.state = 366;
				this.match(SolidCashParser.T__3);
				this.state = 367;
				this.usingFunctionBinding();
				this.state = 372;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 20, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 368;
						this.match(SolidCashParser.T__4);
						this.state = 369;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 374;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 20, this._ctx);
				}
				this.state = 376;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 375;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 378;
				this.match(SolidCashParser.T__5);
				this.state = 379;
				this.match(SolidCashParser.T__8);
				this.state = 382;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
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
					this.state = 380;
					this.typeName();
					}
					break;
				case 10:
					{
					this.state = 381;
					this.match(SolidCashParser.T__9);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 385;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 384;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 387;
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
			this.state = 391;
			this.match(SolidCashParser.Identifier);
			this.state = 394;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===12) {
				{
				this.state = 392;
				this.match(SolidCashParser.T__11);
				this.state = 393;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 398;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 396;
				this.match(SolidCashParser.T__2);
				this.state = 397;
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
			this.state = 400;
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
			this.state = 402;
			this.match(SolidCashParser.T__27);
			this.state = 403;
			this.pragmaName();
			this.state = 404;
			this.pragmaValue();
			this.state = 405;
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
			this.state = 407;
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
			this.state = 409;
			this.versionConstraint();
			this.state = 411;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 1290797056) !== 0) || _la===150) {
				{
				this.state = 410;
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
			this.state = 414;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 1290797056) !== 0)) {
				{
				this.state = 413;
				this.versionOperator();
				}
			}

			this.state = 416;
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
			this.state = 418;
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
			this.state = 420;
			this.match(SolidCashParser.T__30);
			this.state = 421;
			this.match(SolidCashParser.Identifier);
			this.state = 431;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===32) {
				{
				this.state = 422;
				this.match(SolidCashParser.T__31);
				this.state = 423;
				this.match(SolidCashParser.Identifier);
				this.state = 428;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 424;
					this.match(SolidCashParser.T__4);
					this.state = 425;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 430;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 433;
			this.match(SolidCashParser.T__3);
			this.state = 437;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===45) {
				{
				{
				this.state = 434;
				this.enumDefinition();
				}
				}
				this.state = 439;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 443;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===44) {
				{
				{
				this.state = 440;
				this.structDefinition();
				}
				}
				this.state = 445;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 449;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===46) {
				{
				{
				this.state = 446;
				this.typeDefinition();
				}
				}
				this.state = 451;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 455;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===38) {
				{
				{
				this.state = 452;
				this.eventDefinition();
				}
				}
				this.state = 457;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 461;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 35, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 458;
					this.interfaceStateVariable();
					}
					}
				}
				this.state = 463;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 35, this._ctx);
			}
			this.state = 467;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===33 || _la===34) {
				{
				{
				this.state = 464;
				this.interfaceCollection();
				}
				}
				this.state = 469;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 473;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 470;
				this.interfaceFunction();
				}
				}
				this.state = 475;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 476;
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
			this.state = 488;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 38, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 478;
				this.interfaceStateVariableVisibility();
				this.state = 479;
				this.mappingType();
				this.state = 480;
				this.match(SolidCashParser.Identifier);
				this.state = 481;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 483;
				this.interfaceStateVariableVisibility();
				this.state = 484;
				this.arrayType(0);
				this.state = 485;
				this.match(SolidCashParser.Identifier);
				this.state = 486;
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
			this.state = 490;
			this.interfaceStateVariableVisibility();
			this.state = 491;
			this.typeName();
			this.state = 492;
			this.match(SolidCashParser.Identifier);
			this.state = 493;
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
			this.state = 495;
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
			this.state = 497;
			this.match(SolidCashParser.T__6);
			this.state = 498;
			this.match(SolidCashParser.Identifier);
			this.state = 499;
			this.parameterList();
			this.state = 501;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 500;
				this.returnType();
				}
			}

			this.state = 503;
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
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 505;
			this.match(SolidCashParser.T__34);
			this.state = 506;
			this.match(SolidCashParser.Identifier);
			this.state = 507;
			this.match(SolidCashParser.T__3);
			this.state = 511;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===45) {
				{
				{
				this.state = 508;
				this.enumDefinition();
				}
				}
				this.state = 513;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 517;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===44) {
				{
				{
				this.state = 514;
				this.structDefinition();
				}
				}
				this.state = 519;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 523;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===46) {
				{
				{
				this.state = 520;
				this.typeDefinition();
				}
				}
				this.state = 525;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 529;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===38) {
				{
				{
				this.state = 526;
				this.eventDefinition();
				}
				}
				this.state = 531;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 535;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 74980359) !== 0)) {
				{
				{
				this.state = 532;
				this.constantDefinition();
				}
				}
				this.state = 537;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 541;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 538;
				this.freeFunctionDefinition();
				}
				}
				this.state = 543;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 544;
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
			this.state = 547;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===36) {
				{
				this.state = 546;
				this.match(SolidCashParser.T__35);
				}
			}

			this.state = 549;
			this.match(SolidCashParser.T__36);
			this.state = 550;
			this.match(SolidCashParser.Identifier);
			this.state = 552;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===39) {
				{
				this.state = 551;
				this.parameterList();
				}
			}

			this.state = 563;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===32) {
				{
				this.state = 554;
				this.match(SolidCashParser.T__31);
				this.state = 555;
				this.match(SolidCashParser.Identifier);
				this.state = 560;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 556;
					this.match(SolidCashParser.T__4);
					this.state = 557;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 562;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 565;
			this.match(SolidCashParser.T__3);
			this.state = 569;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===45) {
				{
				{
				this.state = 566;
				this.enumDefinition();
				}
				}
				this.state = 571;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 575;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===44) {
				{
				{
				this.state = 572;
				this.structDefinition();
				}
				}
				this.state = 577;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 581;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===46) {
				{
				{
				this.state = 578;
				this.typeDefinition();
				}
				}
				this.state = 583;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 587;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===38) {
				{
				{
				this.state = 584;
				this.eventDefinition();
				}
				}
				this.state = 589;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 593;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===43) {
				{
				{
				this.state = 590;
				this.errorDefinition();
				}
				}
				this.state = 595;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 599;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 55, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 596;
					this.constantDefinition();
					}
					}
				}
				this.state = 601;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 55, this._ctx);
			}
			this.state = 605;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===8) {
				{
				{
				this.state = 602;
				this.usingForDirective();
				}
				}
				this.state = 607;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 611;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 14680067) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 74980359) !== 0)) {
				{
				{
				this.state = 608;
				this.stateVariableDeclaration();
				}
				}
				this.state = 613;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 617;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===60) {
				{
				{
				this.state = 614;
				this.modifierDefinition();
				}
				}
				this.state = 619;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 621;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===48) {
				{
				this.state = 620;
				this.constructorDefinition();
				}
			}

			this.state = 627;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				this.state = 625;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 60, this._ctx) ) {
				case 1:
					{
					this.state = 623;
					this.functionDefinition();
					}
					break;
				case 2:
					{
					this.state = 624;
					this.abstractFunctionDefinition();
					}
					break;
				}
				}
				this.state = 629;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 631;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 630;
				this.fallbackDefinition();
				}
			}

			this.state = 634;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===53) {
				{
				this.state = 633;
				this.receiveDefinition();
				}
			}

			this.state = 636;
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
			this.state = 638;
			this.match(SolidCashParser.T__6);
			this.state = 639;
			this.match(SolidCashParser.Identifier);
			this.state = 640;
			this.parameterList();
			this.state = 644;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 3765305347) !== 0) || ((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & 15) !== 0)) {
				{
				{
				this.state = 641;
				this.functionModifier();
				}
				}
				this.state = 646;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 650;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===173) {
				{
				{
				this.state = 647;
				this.customModifierInvocation();
				}
				}
				this.state = 652;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 654;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 653;
				this.returnType();
				}
			}

			this.state = 656;
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
			this.state = 658;
			this.match(SolidCashParser.T__37);
			this.state = 659;
			this.match(SolidCashParser.Identifier);
			this.state = 660;
			this.match(SolidCashParser.T__38);
			this.state = 672;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 74980359) !== 0)) {
				{
				this.state = 661;
				this.eventParameter();
				this.state = 666;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 67, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 662;
						this.match(SolidCashParser.T__4);
						this.state = 663;
						this.eventParameter();
						}
						}
					}
					this.state = 668;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 67, this._ctx);
				}
				this.state = 670;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 669;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 674;
			this.match(SolidCashParser.T__39);
			this.state = 676;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===41) {
				{
				this.state = 675;
				this.match(SolidCashParser.T__40);
				}
			}

			this.state = 678;
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
			this.state = 680;
			this.typeName();
			this.state = 682;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 681;
				this.match(SolidCashParser.T__41);
				}
			}

			this.state = 684;
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
			this.state = 686;
			this.match(SolidCashParser.T__42);
			this.state = 687;
			this.match(SolidCashParser.Identifier);
			this.state = 688;
			this.match(SolidCashParser.T__38);
			this.state = 700;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 74980359) !== 0)) {
				{
				this.state = 689;
				this.errorParameter();
				this.state = 694;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 72, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 690;
						this.match(SolidCashParser.T__4);
						this.state = 691;
						this.errorParameter();
						}
						}
					}
					this.state = 696;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 72, this._ctx);
				}
				this.state = 698;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 697;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 702;
			this.match(SolidCashParser.T__39);
			this.state = 703;
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
			this.state = 705;
			this.typeName();
			this.state = 706;
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
			this.state = 708;
			this.match(SolidCashParser.T__43);
			this.state = 709;
			this.match(SolidCashParser.Identifier);
			this.state = 710;
			this.match(SolidCashParser.T__3);
			this.state = 712;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 711;
				this.structField();
				}
				}
				this.state = 714;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 74980359) !== 0));
			this.state = 716;
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
			this.state = 718;
			this.typeName();
			this.state = 719;
			this.match(SolidCashParser.Identifier);
			this.state = 720;
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
			this.state = 722;
			this.match(SolidCashParser.T__44);
			this.state = 723;
			this.match(SolidCashParser.Identifier);
			this.state = 724;
			this.match(SolidCashParser.T__3);
			this.state = 725;
			this.enumMember();
			this.state = 730;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 76, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 726;
					this.match(SolidCashParser.T__4);
					this.state = 727;
					this.enumMember();
					}
					}
				}
				this.state = 732;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 76, this._ctx);
			}
			this.state = 734;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 733;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 736;
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
			this.state = 738;
			this.match(SolidCashParser.Identifier);
			this.state = 741;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===30) {
				{
				this.state = 739;
				this.match(SolidCashParser.T__29);
				this.state = 740;
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
			this.state = 743;
			this.match(SolidCashParser.T__45);
			this.state = 744;
			this.match(SolidCashParser.Identifier);
			this.state = 745;
			this.match(SolidCashParser.T__31);
			this.state = 746;
			this.typeName();
			this.state = 747;
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
			this.state = 749;
			this.typeName();
			this.state = 750;
			this.match(SolidCashParser.T__46);
			this.state = 751;
			this.match(SolidCashParser.Identifier);
			this.state = 752;
			this.match(SolidCashParser.T__29);
			this.state = 753;
			this.expression(0);
			this.state = 754;
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
			this.state = 756;
			this.match(SolidCashParser.T__47);
			this.state = 757;
			this.parameterList();
			this.state = 761;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===173) {
				{
				{
				this.state = 758;
				this.parentInvocation();
				}
				}
				this.state = 763;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 764;
			this.match(SolidCashParser.T__3);
			this.state = 768;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				{
				this.state = 765;
				this.statement();
				}
				}
				this.state = 770;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 771;
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
			this.state = 773;
			this.match(SolidCashParser.T__48);
			this.state = 774;
			this.parameterList();
			this.state = 775;
			this.match(SolidCashParser.T__33);
			this.state = 779;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 7) !== 0)) {
				{
				{
				this.state = 776;
				this.fallbackModifier();
				}
				}
				this.state = 781;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 785;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===173) {
				{
				{
				this.state = 782;
				this.customModifierInvocation();
				}
				}
				this.state = 787;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 788;
			this.match(SolidCashParser.T__3);
			this.state = 792;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				{
				this.state = 789;
				this.statement();
				}
				}
				this.state = 794;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 795;
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
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 797;
			_la = this._input.LA(1);
			if(!(((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 7) !== 0))) {
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
	public receiveDefinition(): ReceiveDefinitionContext {
		let localctx: ReceiveDefinitionContext = new ReceiveDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 66, SolidCashParser.RULE_receiveDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 799;
			this.match(SolidCashParser.T__52);
			this.state = 800;
			this.match(SolidCashParser.T__38);
			this.state = 801;
			this.match(SolidCashParser.T__39);
			this.state = 802;
			this.match(SolidCashParser.T__33);
			this.state = 803;
			this.match(SolidCashParser.T__49);
			this.state = 804;
			this.match(SolidCashParser.T__3);
			this.state = 808;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				{
				this.state = 805;
				this.statement();
				}
				}
				this.state = 810;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 811;
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
			this.state = 813;
			this.match(SolidCashParser.Identifier);
			this.state = 814;
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
			this.state = 866;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 92, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 817;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 6291459) !== 0)) {
					{
					this.state = 816;
					this.stateVariableVisibility();
					}
				}

				this.state = 819;
				this.typeName();
				this.state = 823;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 820;
					this.modifier();
					}
					}
					this.state = 825;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 826;
				this.match(SolidCashParser.Identifier);
				this.state = 827;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 829;
				this.typeName();
				this.state = 830;
				this.stateVariableVisibility();
				this.state = 834;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 831;
					this.modifier();
					}
					}
					this.state = 836;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 837;
				this.match(SolidCashParser.Identifier);
				this.state = 838;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 841;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 6291459) !== 0)) {
					{
					this.state = 840;
					this.stateVariableVisibility();
					}
				}

				this.state = 843;
				this.mappingType();
				this.state = 847;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 6307843) !== 0) || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 844;
					this.collectionModifier();
					}
					}
					this.state = 849;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 850;
				this.match(SolidCashParser.Identifier);
				this.state = 851;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 854;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 6291459) !== 0)) {
					{
					this.state = 853;
					this.stateVariableVisibility();
					}
				}

				this.state = 856;
				this.arrayType(0);
				this.state = 860;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 6307843) !== 0) || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 857;
					this.collectionModifier();
					}
					}
					this.state = 862;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 863;
				this.match(SolidCashParser.Identifier);
				this.state = 864;
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
			this.state = 870;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 47:
			case 143:
			case 144:
			case 145:
			case 146:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 868;
				this.modifier();
				}
				break;
			case 33:
			case 34:
			case 54:
			case 55:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 869;
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
			this.state = 872;
			_la = this._input.LA(1);
			if(!(((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 6291459) !== 0))) {
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
			this.state = 910;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 99, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 874;
				this.match(SolidCashParser.T__55);
				this.state = 875;
				this.match(SolidCashParser.T__38);
				this.state = 876;
				this.typeName();
				this.state = 878;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===173) {
					{
					this.state = 877;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 880;
				this.match(SolidCashParser.T__56);
				this.state = 881;
				this.typeName();
				this.state = 883;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===173) {
					{
					this.state = 882;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 885;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 887;
				this.match(SolidCashParser.T__55);
				this.state = 888;
				this.match(SolidCashParser.T__38);
				this.state = 889;
				this.typeName();
				this.state = 891;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===173) {
					{
					this.state = 890;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 893;
				this.match(SolidCashParser.T__56);
				this.state = 894;
				this.mappingType();
				this.state = 895;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 897;
				this.match(SolidCashParser.T__55);
				this.state = 898;
				this.match(SolidCashParser.T__38);
				this.state = 899;
				this.typeName();
				this.state = 901;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===173) {
					{
					this.state = 900;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 903;
				this.match(SolidCashParser.T__56);
				this.state = 904;
				this.arrayType(0);
				this.state = 906;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===173) {
					{
					this.state = 905;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 908;
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
			this.state = 922;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 100, this._ctx) ) {
			case 1:
				{
				this.state = 913;
				this.typeName();
				this.state = 914;
				this.match(SolidCashParser.T__57);
				this.state = 915;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 916;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				{
				this.state = 918;
				this.typeName();
				this.state = 919;
				this.match(SolidCashParser.T__57);
				this.state = 920;
				this.match(SolidCashParser.T__58);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 933;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 102, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 931;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 101, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 924;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 925;
						this.match(SolidCashParser.T__57);
						this.state = 926;
						this.match(SolidCashParser.NumberLiteral);
						this.state = 927;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 928;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 929;
						this.match(SolidCashParser.T__57);
						this.state = 930;
						this.match(SolidCashParser.T__58);
						}
						break;
					}
					}
				}
				this.state = 935;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 102, this._ctx);
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
			this.state = 936;
			this.match(SolidCashParser.T__59);
			this.state = 937;
			this.match(SolidCashParser.Identifier);
			this.state = 939;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===39) {
				{
				this.state = 938;
				this.parameterList();
				}
			}

			this.state = 941;
			this.match(SolidCashParser.T__3);
			this.state = 945;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2152204417) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				{
				this.state = 942;
				this.modifierStatement();
				}
				}
				this.state = 947;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 948;
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
			this.state = 952;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 61:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 950;
				this.placeholderStatement();
				}
				break;
			case 9:
			case 14:
			case 27:
			case 39:
			case 46:
			case 50:
			case 58:
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
				this.state = 951;
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
			this.state = 954;
			this.match(SolidCashParser.T__60);
			this.state = 955;
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
			this.state = 957;
			this.match(SolidCashParser.T__6);
			this.state = 958;
			this.match(SolidCashParser.Identifier);
			this.state = 959;
			this.parameterList();
			this.state = 963;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 3765305347) !== 0) || ((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & 15) !== 0)) {
				{
				{
				this.state = 960;
				this.functionModifier();
				}
				}
				this.state = 965;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 969;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===173) {
				{
				{
				this.state = 966;
				this.customModifierInvocation();
				}
				}
				this.state = 971;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 973;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 972;
				this.returnType();
				}
			}

			this.state = 975;
			this.match(SolidCashParser.T__3);
			this.state = 979;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				{
				this.state = 976;
				this.statement();
				}
				}
				this.state = 981;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 982;
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
			this.state = 984;
			this.match(SolidCashParser.Identifier);
			this.state = 986;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===39) {
				{
				this.state = 985;
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
			this.state = 1002;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 62:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 988;
				this.match(SolidCashParser.T__61);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 989;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 54:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 990;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 34:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 991;
				this.match(SolidCashParser.T__33);
				}
				break;
			case 33:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 992;
				this.match(SolidCashParser.T__32);
				}
				break;
			case 55:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 993;
				this.match(SolidCashParser.T__54);
				}
				break;
			case 50:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 994;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 52:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 995;
				this.match(SolidCashParser.T__51);
				}
				break;
			case 51:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 996;
				this.match(SolidCashParser.T__50);
				}
				break;
			case 68:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 997;
				this.unsafeModifier();
				}
				break;
			case 64:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 998;
				this.match(SolidCashParser.T__63);
				}
				break;
			case 65:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 999;
				this.match(SolidCashParser.T__64);
				}
				break;
			case 66:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1000;
				this.match(SolidCashParser.T__65);
				}
				break;
			case 67:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1001;
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
	public unsafeModifier(): UnsafeModifierContext {
		let localctx: UnsafeModifierContext = new UnsafeModifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 92, SolidCashParser.RULE_unsafeModifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1004;
			this.match(SolidCashParser.T__67);
			this.state = 1008;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===39) {
				{
				this.state = 1005;
				this.match(SolidCashParser.T__38);
				this.state = 1006;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1007;
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
		this.enterRule(localctx, 94, SolidCashParser.RULE_returnType);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1010;
			this.match(SolidCashParser.T__68);
			this.state = 1011;
			this.match(SolidCashParser.T__38);
			this.state = 1012;
			this.typeName();
			this.state = 1016;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
				{
				{
				this.state = 1013;
				this.modifier();
				}
				}
				this.state = 1018;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1029;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 115, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1019;
					this.match(SolidCashParser.T__4);
					this.state = 1020;
					this.typeName();
					this.state = 1024;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
						{
						{
						this.state = 1021;
						this.modifier();
						}
						}
						this.state = 1026;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
					}
				}
				this.state = 1031;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 115, this._ctx);
			}
			this.state = 1033;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1032;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1035;
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
	public parameterList(): ParameterListContext {
		let localctx: ParameterListContext = new ParameterListContext(this, this._ctx, this.state);
		this.enterRule(localctx, 96, SolidCashParser.RULE_parameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1037;
			this.match(SolidCashParser.T__38);
			this.state = 1049;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 74980359) !== 0)) {
				{
				this.state = 1038;
				this.parameter();
				this.state = 1043;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 117, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1039;
						this.match(SolidCashParser.T__4);
						this.state = 1040;
						this.parameter();
						}
						}
					}
					this.state = 1045;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 117, this._ctx);
				}
				this.state = 1047;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1046;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1051;
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
		this.enterRule(localctx, 98, SolidCashParser.RULE_parameter);
		let _la: number;
		try {
			this.state = 1071;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 122, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1053;
				this.typeName();
				this.state = 1057;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 1054;
					this.modifier();
					}
					}
					this.state = 1059;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1060;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1062;
				this.arrayType(0);
				this.state = 1066;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 1063;
					this.modifier();
					}
					}
					this.state = 1068;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1069;
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
		this.enterRule(localctx, 100, SolidCashParser.RULE_block);
		let _la: number;
		try {
			this.state = 1082;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1073;
				this.match(SolidCashParser.T__3);
				this.state = 1077;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
					{
					{
					this.state = 1074;
					this.statement();
					}
					}
					this.state = 1079;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1080;
				this.match(SolidCashParser.T__5);
				}
				break;
			case 9:
			case 14:
			case 27:
			case 39:
			case 46:
			case 50:
			case 58:
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
				this.state = 1081;
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
		this.enterRule(localctx, 102, SolidCashParser.RULE_statement);
		try {
			this.state = 1117;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 125, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1084;
				this.variableDefinition();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1085;
				this.tupleAssignment();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1086;
				this.arrayAssignStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1087;
				this.arrayPushStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1088;
				this.arrayPopStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1089;
				this.arrayDeleteStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1090;
				this.stateArrayPushStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1091;
				this.stateArrayPopStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1092;
				this.assignStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1093;
				this.stateAssignStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1094;
				this.mappingFieldAssignStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1095;
				this.mappingAssignStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1096;
				this.mappingDeleteStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1097;
				this.timeOpStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1098;
				this.requireStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1099;
				this.ifStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1100;
				this.loopStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1101;
				this.consoleStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1102;
				this.emitStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1103;
				this.transferStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1104;
				this.tokenContainerMethodStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1105;
				this.returnStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1106;
				this.functionCallStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1107;
				this.addressMethodStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1108;
				this.assemblyStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1109;
				this.tryCatchStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1110;
				this.revertStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1111;
				this.assertStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1112;
				this.deleteStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1113;
				this.uncheckedStatement();
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 31);
				{
				this.state = 1114;
				this.switchStatement();
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 32);
				{
				this.state = 1115;
				this.breakStatement();
				}
				break;
			case 33:
				this.enterOuterAlt(localctx, 33);
				{
				this.state = 1116;
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
		this.enterRule(localctx, 104, SolidCashParser.RULE_transferStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1119;
			this.match(SolidCashParser.T__69);
			this.state = 1120;
			this.match(SolidCashParser.T__11);
			this.state = 1121;
			this.match(SolidCashParser.Identifier);
			this.state = 1122;
			this.match(SolidCashParser.T__38);
			this.state = 1123;
			this.expression(0);
			this.state = 1124;
			this.match(SolidCashParser.T__4);
			this.state = 1125;
			this.expression(0);
			this.state = 1126;
			this.match(SolidCashParser.T__39);
			this.state = 1127;
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
		this.enterRule(localctx, 106, SolidCashParser.RULE_tokenContainerMethodStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1129;
			this.match(SolidCashParser.T__69);
			this.state = 1130;
			this.match(SolidCashParser.T__11);
			this.state = 1131;
			this.match(SolidCashParser.Identifier);
			this.state = 1132;
			this.match(SolidCashParser.T__57);
			this.state = 1133;
			this.expression(0);
			this.state = 1134;
			this.match(SolidCashParser.T__58);
			this.state = 1135;
			this.match(SolidCashParser.T__11);
			this.state = 1136;
			this.match(SolidCashParser.Identifier);
			this.state = 1137;
			this.match(SolidCashParser.T__38);
			this.state = 1138;
			this.expression(0);
			this.state = 1143;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1139;
				this.match(SolidCashParser.T__4);
				this.state = 1140;
				this.expression(0);
				}
				}
				this.state = 1145;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1146;
			this.match(SolidCashParser.T__39);
			this.state = 1147;
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
		this.enterRule(localctx, 108, SolidCashParser.RULE_returnStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1176;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 130, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1149;
				this.match(SolidCashParser.T__70);
				this.state = 1150;
				this.expression(0);
				this.state = 1155;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1151;
					this.match(SolidCashParser.T__4);
					this.state = 1152;
					this.expression(0);
					}
					}
					this.state = 1157;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1158;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1160;
				this.match(SolidCashParser.T__70);
				this.state = 1161;
				this.match(SolidCashParser.T__38);
				this.state = 1162;
				this.expression(0);
				this.state = 1167;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 128, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1163;
						this.match(SolidCashParser.T__4);
						this.state = 1164;
						this.expression(0);
						}
						}
					}
					this.state = 1169;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 128, this._ctx);
				}
				this.state = 1171;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1170;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1173;
				this.match(SolidCashParser.T__39);
				this.state = 1174;
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
		this.enterRule(localctx, 110, SolidCashParser.RULE_functionCallStatement);
		let _la: number;
		try {
			this.state = 1200;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 132, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1178;
				this.match(SolidCashParser.Identifier);
				this.state = 1179;
				this.expressionList();
				this.state = 1180;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1182;
				this.match(SolidCashParser.Identifier);
				this.state = 1183;
				this.match(SolidCashParser.T__11);
				this.state = 1184;
				this.match(SolidCashParser.Identifier);
				this.state = 1185;
				this.expressionList();
				this.state = 1186;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1188;
				this.match(SolidCashParser.Identifier);
				this.state = 1189;
				this.expressionList();
				this.state = 1190;
				this.match(SolidCashParser.T__11);
				this.state = 1191;
				this.match(SolidCashParser.Identifier);
				this.state = 1192;
				this.match(SolidCashParser.T__11);
				this.state = 1193;
				this.match(SolidCashParser.Identifier);
				this.state = 1195;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1194;
					this.callOptions();
					}
				}

				this.state = 1197;
				this.expressionList();
				this.state = 1198;
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
		this.enterRule(localctx, 112, SolidCashParser.RULE_addressMethodStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1202;
			this.expression(0);
			this.state = 1203;
			this.match(SolidCashParser.T__11);
			this.state = 1204;
			this.match(SolidCashParser.Identifier);
			this.state = 1206;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===4) {
				{
				this.state = 1205;
				this.callOptions();
				}
			}

			this.state = 1208;
			this.expressionList();
			this.state = 1209;
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
		this.enterRule(localctx, 114, SolidCashParser.RULE_emitStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1211;
			this.match(SolidCashParser.T__71);
			this.state = 1212;
			this.match(SolidCashParser.Identifier);
			this.state = 1213;
			this.expressionList();
			this.state = 1214;
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
		this.enterRule(localctx, 116, SolidCashParser.RULE_mappingAssignStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1216;
			this.match(SolidCashParser.T__69);
			this.state = 1217;
			this.match(SolidCashParser.T__11);
			this.state = 1218;
			this.match(SolidCashParser.Identifier);
			this.state = 1223;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 1219;
				this.match(SolidCashParser.T__57);
				this.state = 1220;
				this.expression(0);
				this.state = 1221;
				this.match(SolidCashParser.T__58);
				}
				}
				this.state = 1225;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===58);
			this.state = 1227;
			this.match(SolidCashParser.T__29);
			this.state = 1228;
			this.expression(0);
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
	public mappingFieldAssignStatement(): MappingFieldAssignStatementContext {
		let localctx: MappingFieldAssignStatementContext = new MappingFieldAssignStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 118, SolidCashParser.RULE_mappingFieldAssignStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1231;
			this.match(SolidCashParser.T__69);
			this.state = 1232;
			this.match(SolidCashParser.T__11);
			this.state = 1233;
			this.match(SolidCashParser.Identifier);
			this.state = 1238;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 1234;
				this.match(SolidCashParser.T__57);
				this.state = 1235;
				this.expression(0);
				this.state = 1236;
				this.match(SolidCashParser.T__58);
				}
				}
				this.state = 1240;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===58);
			this.state = 1242;
			this.match(SolidCashParser.T__11);
			this.state = 1243;
			this.match(SolidCashParser.Identifier);
			this.state = 1244;
			this.match(SolidCashParser.T__29);
			this.state = 1245;
			this.expression(0);
			this.state = 1246;
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
		this.enterRule(localctx, 120, SolidCashParser.RULE_mappingDeleteStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1248;
			this.match(SolidCashParser.T__69);
			this.state = 1249;
			this.match(SolidCashParser.T__11);
			this.state = 1250;
			this.match(SolidCashParser.Identifier);
			this.state = 1257;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===58) {
				{
				{
				this.state = 1251;
				this.match(SolidCashParser.T__57);
				this.state = 1252;
				this.expression(0);
				this.state = 1253;
				this.match(SolidCashParser.T__58);
				}
				}
				this.state = 1259;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1260;
			this.match(SolidCashParser.T__72);
			this.state = 1261;
			this.match(SolidCashParser.T__38);
			this.state = 1262;
			this.expression(0);
			this.state = 1263;
			this.match(SolidCashParser.T__39);
			this.state = 1264;
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
		this.enterRule(localctx, 122, SolidCashParser.RULE_stateAssignStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1266;
			this.match(SolidCashParser.T__69);
			this.state = 1267;
			this.match(SolidCashParser.T__11);
			this.state = 1268;
			this.match(SolidCashParser.Identifier);
			this.state = 1269;
			this.match(SolidCashParser.T__29);
			this.state = 1270;
			this.expression(0);
			this.state = 1271;
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
		this.enterRule(localctx, 124, SolidCashParser.RULE_variableDefinition);
		let _la: number;
		try {
			this.state = 1297;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 139, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1273;
				this.typeName();
				this.state = 1277;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 1274;
					this.modifier();
					}
					}
					this.state = 1279;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1280;
				this.match(SolidCashParser.Identifier);
				this.state = 1281;
				this.match(SolidCashParser.T__29);
				this.state = 1282;
				this.expression(0);
				this.state = 1283;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1285;
				this.arrayType(0);
				this.state = 1289;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
					{
					{
					this.state = 1286;
					this.modifier();
					}
					}
					this.state = 1291;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1292;
				this.match(SolidCashParser.Identifier);
				this.state = 1293;
				this.match(SolidCashParser.T__29);
				this.state = 1294;
				this.expression(0);
				this.state = 1295;
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
		this.enterRule(localctx, 126, SolidCashParser.RULE_tupleAssignment);
		let _la: number;
		try {
			this.state = 1326;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
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
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1299;
				this.typeName();
				this.state = 1300;
				this.match(SolidCashParser.Identifier);
				this.state = 1305;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1301;
					this.match(SolidCashParser.T__4);
					this.state = 1302;
					this.typeName();
					this.state = 1303;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1307;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1309;
				this.match(SolidCashParser.T__29);
				this.state = 1310;
				this.expression(0);
				this.state = 1311;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 39:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1313;
				this.match(SolidCashParser.T__38);
				this.state = 1314;
				this.tupleSlot();
				this.state = 1317;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1315;
					this.match(SolidCashParser.T__4);
					this.state = 1316;
					this.tupleSlot();
					}
					}
					this.state = 1319;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1321;
				this.match(SolidCashParser.T__39);
				this.state = 1322;
				this.match(SolidCashParser.T__29);
				this.state = 1323;
				this.expression(0);
				this.state = 1324;
				this.match(SolidCashParser.T__1);
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
	public tupleSlot(): TupleSlotContext {
		let localctx: TupleSlotContext = new TupleSlotContext(this, this._ctx, this.state);
		this.enterRule(localctx, 128, SolidCashParser.RULE_tupleSlot);
		try {
			this.state = 1332;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
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
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1328;
				this.typeName();
				this.state = 1329;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 5:
			case 40:
				this.enterOuterAlt(localctx, 2);
				// tslint:disable-next-line:no-empty
				{
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
	public assignStatement(): AssignStatementContext {
		let localctx: AssignStatementContext = new AssignStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 130, SolidCashParser.RULE_assignStatement);
		let _la: number;
		try {
			this.state = 1342;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 144, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1334;
				this.match(SolidCashParser.Identifier);
				this.state = 1335;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===30 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1336;
				this.expression(0);
				this.state = 1337;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1339;
				this.match(SolidCashParser.Identifier);
				this.state = 1340;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===84 || _la===85)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1341;
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
		this.enterRule(localctx, 132, SolidCashParser.RULE_arrayPushStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1344;
			this.match(SolidCashParser.Identifier);
			this.state = 1345;
			this.match(SolidCashParser.T__85);
			this.state = 1346;
			this.match(SolidCashParser.T__38);
			this.state = 1347;
			this.expression(0);
			this.state = 1348;
			this.match(SolidCashParser.T__39);
			this.state = 1349;
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
		this.enterRule(localctx, 134, SolidCashParser.RULE_arrayPopStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1351;
			this.match(SolidCashParser.Identifier);
			this.state = 1352;
			this.match(SolidCashParser.T__86);
			this.state = 1353;
			this.match(SolidCashParser.T__38);
			this.state = 1354;
			this.match(SolidCashParser.T__39);
			this.state = 1355;
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
		this.enterRule(localctx, 136, SolidCashParser.RULE_arrayAssignStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1357;
			this.match(SolidCashParser.Identifier);
			this.state = 1358;
			this.match(SolidCashParser.T__57);
			this.state = 1359;
			this.expression(0);
			this.state = 1360;
			this.match(SolidCashParser.T__58);
			this.state = 1361;
			this.match(SolidCashParser.T__29);
			this.state = 1362;
			this.expression(0);
			this.state = 1363;
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
		this.enterRule(localctx, 138, SolidCashParser.RULE_arrayDeleteStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1365;
			this.match(SolidCashParser.Identifier);
			this.state = 1366;
			this.match(SolidCashParser.T__72);
			this.state = 1367;
			this.match(SolidCashParser.T__38);
			this.state = 1368;
			this.expression(0);
			this.state = 1369;
			this.match(SolidCashParser.T__39);
			this.state = 1370;
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
		this.enterRule(localctx, 140, SolidCashParser.RULE_stateArrayPushStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1372;
			this.match(SolidCashParser.T__69);
			this.state = 1373;
			this.match(SolidCashParser.T__11);
			this.state = 1374;
			this.match(SolidCashParser.Identifier);
			this.state = 1375;
			this.match(SolidCashParser.T__85);
			this.state = 1376;
			this.match(SolidCashParser.T__38);
			this.state = 1377;
			this.expression(0);
			this.state = 1378;
			this.match(SolidCashParser.T__39);
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
	public stateArrayPopStatement(): StateArrayPopStatementContext {
		let localctx: StateArrayPopStatementContext = new StateArrayPopStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 142, SolidCashParser.RULE_stateArrayPopStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1381;
			this.match(SolidCashParser.T__69);
			this.state = 1382;
			this.match(SolidCashParser.T__11);
			this.state = 1383;
			this.match(SolidCashParser.Identifier);
			this.state = 1384;
			this.match(SolidCashParser.T__86);
			this.state = 1385;
			this.match(SolidCashParser.T__38);
			this.state = 1386;
			this.match(SolidCashParser.T__39);
			this.state = 1387;
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
		this.enterRule(localctx, 144, SolidCashParser.RULE_deleteStatement);
		let _la: number;
		try {
			this.state = 1411;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 146, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1389;
				this.match(SolidCashParser.T__87);
				this.state = 1390;
				this.match(SolidCashParser.Identifier);
				this.state = 1391;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1392;
				this.match(SolidCashParser.T__87);
				this.state = 1393;
				this.match(SolidCashParser.T__69);
				this.state = 1394;
				this.match(SolidCashParser.T__11);
				this.state = 1395;
				this.match(SolidCashParser.Identifier);
				this.state = 1396;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1397;
				this.match(SolidCashParser.T__87);
				this.state = 1398;
				this.match(SolidCashParser.T__69);
				this.state = 1399;
				this.match(SolidCashParser.T__11);
				this.state = 1400;
				this.match(SolidCashParser.Identifier);
				this.state = 1405;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1401;
					this.match(SolidCashParser.T__57);
					this.state = 1402;
					this.expression(0);
					this.state = 1403;
					this.match(SolidCashParser.T__58);
					}
					}
					this.state = 1407;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===58);
				this.state = 1409;
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
		this.enterRule(localctx, 146, SolidCashParser.RULE_timeOpStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1413;
			this.match(SolidCashParser.T__88);
			this.state = 1414;
			this.match(SolidCashParser.T__38);
			this.state = 1415;
			this.match(SolidCashParser.TxVar);
			this.state = 1416;
			this.match(SolidCashParser.T__22);
			this.state = 1417;
			this.expression(0);
			this.state = 1420;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1418;
				this.match(SolidCashParser.T__4);
				this.state = 1419;
				this.requireMessage();
				}
			}

			this.state = 1422;
			this.match(SolidCashParser.T__39);
			this.state = 1423;
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
		this.enterRule(localctx, 148, SolidCashParser.RULE_requireStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1425;
			this.match(SolidCashParser.T__88);
			this.state = 1426;
			this.match(SolidCashParser.T__38);
			this.state = 1427;
			this.expression(0);
			this.state = 1430;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1428;
				this.match(SolidCashParser.T__4);
				this.state = 1429;
				this.requireMessage();
				}
			}

			this.state = 1432;
			this.match(SolidCashParser.T__39);
			this.state = 1433;
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
		this.enterRule(localctx, 150, SolidCashParser.RULE_ifStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1435;
			this.match(SolidCashParser.T__89);
			this.state = 1436;
			this.match(SolidCashParser.T__38);
			this.state = 1437;
			this.expression(0);
			this.state = 1438;
			this.match(SolidCashParser.T__39);
			this.state = 1439;
			localctx._ifBlock = this.block();
			this.state = 1442;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 149, this._ctx) ) {
			case 1:
				{
				this.state = 1440;
				this.match(SolidCashParser.T__90);
				this.state = 1441;
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
		this.enterRule(localctx, 152, SolidCashParser.RULE_loopStatement);
		try {
			this.state = 1450;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 150, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1444;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1445;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1446;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1447;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1448;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1449;
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
		this.enterRule(localctx, 154, SolidCashParser.RULE_forOfEntriesStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1452;
			this.match(SolidCashParser.T__8);
			this.state = 1453;
			this.match(SolidCashParser.T__38);
			this.state = 1454;
			this.typeName();
			this.state = 1455;
			this.match(SolidCashParser.Identifier);
			this.state = 1456;
			this.match(SolidCashParser.T__4);
			this.state = 1457;
			this.typeName();
			this.state = 1458;
			this.match(SolidCashParser.Identifier);
			this.state = 1459;
			this.match(SolidCashParser.T__91);
			this.state = 1460;
			this.match(SolidCashParser.T__69);
			this.state = 1461;
			this.match(SolidCashParser.T__11);
			this.state = 1462;
			this.match(SolidCashParser.Identifier);
			this.state = 1463;
			this.match(SolidCashParser.T__11);
			this.state = 1464;
			this.match(SolidCashParser.T__92);
			this.state = 1465;
			this.match(SolidCashParser.T__39);
			this.state = 1466;
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
		this.enterRule(localctx, 156, SolidCashParser.RULE_forInStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1468;
			this.match(SolidCashParser.T__8);
			this.state = 1469;
			this.match(SolidCashParser.T__38);
			this.state = 1470;
			this.typeName();
			this.state = 1471;
			this.match(SolidCashParser.Identifier);
			this.state = 1472;
			this.match(SolidCashParser.T__93);
			this.state = 1473;
			this.match(SolidCashParser.T__69);
			this.state = 1474;
			this.match(SolidCashParser.T__11);
			this.state = 1475;
			this.match(SolidCashParser.Identifier);
			this.state = 1476;
			this.match(SolidCashParser.T__39);
			this.state = 1477;
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
		this.enterRule(localctx, 158, SolidCashParser.RULE_forOfStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1479;
			this.match(SolidCashParser.T__8);
			this.state = 1480;
			this.match(SolidCashParser.T__38);
			this.state = 1481;
			this.typeName();
			this.state = 1482;
			this.match(SolidCashParser.Identifier);
			this.state = 1483;
			this.match(SolidCashParser.T__91);
			this.state = 1484;
			this.match(SolidCashParser.T__69);
			this.state = 1485;
			this.match(SolidCashParser.T__11);
			this.state = 1486;
			this.match(SolidCashParser.Identifier);
			this.state = 1487;
			this.match(SolidCashParser.T__39);
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
	public forStatement(): ForStatementContext {
		let localctx: ForStatementContext = new ForStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 160, SolidCashParser.RULE_forStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1490;
			this.match(SolidCashParser.T__8);
			this.state = 1491;
			this.match(SolidCashParser.T__38);
			this.state = 1492;
			this.forInit();
			this.state = 1493;
			this.forCondition();
			this.state = 1494;
			this.forUpdate();
			this.state = 1495;
			this.match(SolidCashParser.T__39);
			this.state = 1496;
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
		this.enterRule(localctx, 162, SolidCashParser.RULE_forInit);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1498;
			this.typeName();
			this.state = 1502;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===47 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 15) !== 0)) {
				{
				{
				this.state = 1499;
				this.modifier();
				}
				}
				this.state = 1504;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1505;
			this.match(SolidCashParser.Identifier);
			this.state = 1506;
			this.match(SolidCashParser.T__29);
			this.state = 1507;
			this.expression(0);
			this.state = 1508;
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
		this.enterRule(localctx, 164, SolidCashParser.RULE_forCondition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1510;
			this.expression(0);
			this.state = 1511;
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
		this.enterRule(localctx, 166, SolidCashParser.RULE_forUpdate);
		let _la: number;
		try {
			this.state = 1518;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 152, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1513;
				this.match(SolidCashParser.Identifier);
				this.state = 1514;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===30 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1515;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1516;
				this.match(SolidCashParser.Identifier);
				this.state = 1517;
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
		this.enterRule(localctx, 168, SolidCashParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1520;
			this.match(SolidCashParser.T__94);
			this.state = 1521;
			this.block();
			this.state = 1522;
			this.match(SolidCashParser.T__95);
			this.state = 1523;
			this.match(SolidCashParser.T__38);
			this.state = 1524;
			this.expression(0);
			this.state = 1525;
			this.match(SolidCashParser.T__39);
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
	public whileStatement(): WhileStatementContext {
		let localctx: WhileStatementContext = new WhileStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 170, SolidCashParser.RULE_whileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1528;
			this.match(SolidCashParser.T__95);
			this.state = 1529;
			this.match(SolidCashParser.T__38);
			this.state = 1530;
			this.expression(0);
			this.state = 1531;
			this.match(SolidCashParser.T__39);
			this.state = 1532;
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
		this.enterRule(localctx, 172, SolidCashParser.RULE_consoleStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1534;
			this.match(SolidCashParser.T__96);
			this.state = 1535;
			this.consoleParameterList();
			this.state = 1536;
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
		this.enterRule(localctx, 174, SolidCashParser.RULE_assemblyStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1538;
			this.match(SolidCashParser.T__97);
			this.state = 1539;
			this.match(SolidCashParser.T__3);
			this.state = 1543;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 154)) & ~0x1F) === 0 && ((1 << (_la - 154)) & 524801) !== 0)) {
				{
				{
				this.state = 1540;
				this.assemblyToken();
				}
				}
				this.state = 1545;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1546;
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
		this.enterRule(localctx, 176, SolidCashParser.RULE_assemblyToken);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1548;
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
		this.enterRule(localctx, 178, SolidCashParser.RULE_uncheckedStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1550;
			this.match(SolidCashParser.T__98);
			this.state = 1551;
			this.match(SolidCashParser.T__3);
			this.state = 1555;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				{
				this.state = 1552;
				this.statement();
				}
				}
				this.state = 1557;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1558;
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
		this.enterRule(localctx, 180, SolidCashParser.RULE_switchStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1560;
			this.match(SolidCashParser.T__99);
			this.state = 1561;
			this.match(SolidCashParser.T__38);
			this.state = 1562;
			this.expression(0);
			this.state = 1563;
			this.match(SolidCashParser.T__39);
			this.state = 1564;
			this.match(SolidCashParser.T__3);
			this.state = 1568;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===101) {
				{
				{
				this.state = 1565;
				this.switchCase();
				}
				}
				this.state = 1570;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1572;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===103) {
				{
				this.state = 1571;
				this.switchDefault();
				}
			}

			this.state = 1574;
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
		this.enterRule(localctx, 182, SolidCashParser.RULE_switchCase);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1576;
			this.match(SolidCashParser.T__100);
			this.state = 1577;
			this.expression(0);
			this.state = 1578;
			this.match(SolidCashParser.T__101);
			this.state = 1582;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				{
				this.state = 1579;
				this.statement();
				}
				}
				this.state = 1584;
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
		this.enterRule(localctx, 184, SolidCashParser.RULE_switchDefault);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1585;
			this.match(SolidCashParser.T__102);
			this.state = 1586;
			this.match(SolidCashParser.T__101);
			this.state = 1590;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1057882115) !== 0) || ((((_la - 104)) & ~0x1F) === 0 && ((1 << (_la - 104)) & 2151809021) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				{
				this.state = 1587;
				this.statement();
				}
				}
				this.state = 1592;
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
		this.enterRule(localctx, 186, SolidCashParser.RULE_tryCatchStatement);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1593;
			this.match(SolidCashParser.T__103);
			this.state = 1594;
			this.expression(0);
			this.state = 1596;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 1595;
				this.tryReturns();
				}
			}

			this.state = 1598;
			localctx._tryBlock = this.block();
			this.state = 1600;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1599;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1602;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 160, this._ctx);
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
		this.enterRule(localctx, 188, SolidCashParser.RULE_tryReturns);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1604;
			this.match(SolidCashParser.T__68);
			this.state = 1605;
			this.match(SolidCashParser.T__38);
			this.state = 1617;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 74980359) !== 0)) {
				{
				this.state = 1606;
				this.parameter();
				this.state = 1611;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 161, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1607;
						this.match(SolidCashParser.T__4);
						this.state = 1608;
						this.parameter();
						}
						}
					}
					this.state = 1613;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 161, this._ctx);
				}
				this.state = 1615;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1614;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1619;
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
		this.enterRule(localctx, 190, SolidCashParser.RULE_catchClause);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1621;
			this.match(SolidCashParser.T__104);
			this.state = 1623;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 164, this._ctx) ) {
			case 1:
				{
				this.state = 1622;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 1640;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 168, this._ctx) ) {
			case 1:
				{
				this.state = 1625;
				this.match(SolidCashParser.T__38);
				this.state = 1637;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 74980359) !== 0)) {
					{
					this.state = 1626;
					this.parameter();
					this.state = 1631;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 165, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1627;
							this.match(SolidCashParser.T__4);
							this.state = 1628;
							this.parameter();
							}
							}
						}
						this.state = 1633;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 165, this._ctx);
					}
					this.state = 1635;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1634;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1639;
				this.match(SolidCashParser.T__39);
				}
				break;
			}
			this.state = 1642;
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
		this.enterRule(localctx, 192, SolidCashParser.RULE_breakStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1644;
			this.match(SolidCashParser.T__105);
			this.state = 1645;
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
		this.enterRule(localctx, 194, SolidCashParser.RULE_continueStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1647;
			this.match(SolidCashParser.T__106);
			this.state = 1648;
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
		this.enterRule(localctx, 196, SolidCashParser.RULE_requireMessage);
		try {
			this.state = 1653;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 161:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1650;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 173:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1651;
				this.match(SolidCashParser.Identifier);
				this.state = 1652;
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
		this.enterRule(localctx, 198, SolidCashParser.RULE_revertStatement);
		try {
			this.state = 1669;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 170, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1655;
				this.match(SolidCashParser.T__107);
				this.state = 1656;
				this.match(SolidCashParser.Identifier);
				this.state = 1657;
				this.expressionList();
				this.state = 1658;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1660;
				this.match(SolidCashParser.T__107);
				this.state = 1661;
				this.match(SolidCashParser.T__38);
				this.state = 1662;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1663;
				this.match(SolidCashParser.T__39);
				this.state = 1664;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1665;
				this.match(SolidCashParser.T__107);
				this.state = 1666;
				this.match(SolidCashParser.T__38);
				this.state = 1667;
				this.match(SolidCashParser.T__39);
				this.state = 1668;
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
		this.enterRule(localctx, 200, SolidCashParser.RULE_assertStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1671;
			this.match(SolidCashParser.T__108);
			this.state = 1672;
			this.match(SolidCashParser.T__38);
			this.state = 1673;
			this.expression(0);
			this.state = 1674;
			this.match(SolidCashParser.T__39);
			this.state = 1675;
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
		this.enterRule(localctx, 202, SolidCashParser.RULE_consoleParameter);
		try {
			this.state = 1679;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 173:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1677;
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
				this.state = 1678;
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
		this.enterRule(localctx, 204, SolidCashParser.RULE_consoleParameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1681;
			this.match(SolidCashParser.T__38);
			this.state = 1693;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 7347213) !== 0)) {
				{
				this.state = 1682;
				this.consoleParameter();
				this.state = 1687;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 172, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1683;
						this.match(SolidCashParser.T__4);
						this.state = 1684;
						this.consoleParameter();
						}
						}
					}
					this.state = 1689;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 172, this._ctx);
				}
				this.state = 1691;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1690;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1695;
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
		this.enterRule(localctx, 206, SolidCashParser.RULE_functionCall);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1721;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 178, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1697;
				this.match(SolidCashParser.Identifier);
				this.state = 1698;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1699;
				this.match(SolidCashParser.Identifier);
				this.state = 1700;
				this.match(SolidCashParser.T__11);
				this.state = 1701;
				this.match(SolidCashParser.Identifier);
				this.state = 1702;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1703;
				this.match(SolidCashParser.Identifier);
				this.state = 1704;
				this.match(SolidCashParser.T__38);
				this.state = 1705;
				this.match(SolidCashParser.T__3);
				this.state = 1717;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===173) {
					{
					this.state = 1706;
					this.namedArg();
					this.state = 1711;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 175, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1707;
							this.match(SolidCashParser.T__4);
							this.state = 1708;
							this.namedArg();
							}
							}
						}
						this.state = 1713;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 175, this._ctx);
					}
					this.state = 1715;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1714;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1719;
				this.match(SolidCashParser.T__5);
				this.state = 1720;
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
		this.enterRule(localctx, 208, SolidCashParser.RULE_namedArg);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1723;
			this.match(SolidCashParser.Identifier);
			this.state = 1724;
			this.match(SolidCashParser.T__101);
			this.state = 1725;
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
		this.enterRule(localctx, 210, SolidCashParser.RULE_expressionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1727;
			this.match(SolidCashParser.T__38);
			this.state = 1739;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===14 || _la===27 || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 110)) & ~0x1F) === 0 && ((1 << (_la - 110)) & 33622015) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
				{
				this.state = 1728;
				this.expression(0);
				this.state = 1733;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 179, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1729;
						this.match(SolidCashParser.T__4);
						this.state = 1730;
						this.expression(0);
						}
						}
					}
					this.state = 1735;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 179, this._ctx);
				}
				this.state = 1737;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1736;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1741;
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
		this.enterRule(localctx, 212, SolidCashParser.RULE_callOptions);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1743;
			this.match(SolidCashParser.T__3);
			this.state = 1744;
			this.callOption();
			this.state = 1749;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 182, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1745;
					this.match(SolidCashParser.T__4);
					this.state = 1746;
					this.callOption();
					}
					}
				}
				this.state = 1751;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 182, this._ctx);
			}
			this.state = 1753;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1752;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1755;
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
		this.enterRule(localctx, 214, SolidCashParser.RULE_callOption);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1757;
			this.match(SolidCashParser.Identifier);
			this.state = 1758;
			this.match(SolidCashParser.T__101);
			this.state = 1759;
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
		this.enterRule(localctx, 216, SolidCashParser.RULE_typeList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1761;
			this.match(SolidCashParser.T__38);
			this.state = 1762;
			this.typeName();
			this.state = 1767;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 184, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1763;
					this.match(SolidCashParser.T__4);
					this.state = 1764;
					this.typeName();
					}
					}
				}
				this.state = 1769;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 184, this._ctx);
			}
			this.state = 1771;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1770;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1773;
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
		let _startState: number = 218;
		this.enterRecursionRule(localctx, 218, SolidCashParser.RULE_expression, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1903;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 192, this._ctx) ) {
			case 1:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 1776;
				this.match(SolidCashParser.T__38);
				this.state = 1777;
				this.expression(0);
				this.state = 1778;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 2:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1780;
				this.typeCast();
				this.state = 1781;
				this.match(SolidCashParser.T__38);
				this.state = 1782;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 1784;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1783;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1786;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 3:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1788;
				this.functionCall();
				}
				break;
			case 4:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1789;
				this.match(SolidCashParser.T__109);
				this.state = 1790;
				this.match(SolidCashParser.Identifier);
				this.state = 1792;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1791;
					this.callOptions();
					}
				}

				this.state = 1794;
				this.expressionList();
				}
				break;
			case 5:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1795;
				this.match(SolidCashParser.T__109);
				this.state = 1796;
				this.typeName();
				this.state = 1797;
				this.match(SolidCashParser.T__57);
				this.state = 1798;
				this.match(SolidCashParser.T__58);
				this.state = 1799;
				this.match(SolidCashParser.T__38);
				this.state = 1800;
				this.expression(0);
				this.state = 1801;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 6:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1803;
				this.match(SolidCashParser.T__45);
				this.state = 1804;
				this.match(SolidCashParser.T__38);
				this.state = 1805;
				this.typeName();
				this.state = 1806;
				this.match(SolidCashParser.T__39);
				this.state = 1807;
				this.match(SolidCashParser.T__11);
				this.state = 1808;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 7:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1810;
				this.match(SolidCashParser.T__110);
				this.state = 1811;
				this.expressionList();
				}
				break;
			case 8:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1812;
				this.match(SolidCashParser.T__111);
				this.state = 1813;
				this.expressionList();
				}
				break;
			case 9:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1814;
				this.match(SolidCashParser.T__112);
				this.state = 1815;
				this.expressionList();
				}
				break;
			case 10:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1816;
				this.match(SolidCashParser.T__113);
				this.state = 1817;
				this.expressionList();
				}
				break;
			case 11:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1818;
				this.match(SolidCashParser.T__114);
				this.state = 1819;
				this.match(SolidCashParser.T__38);
				this.state = 1820;
				this.match(SolidCashParser.Identifier);
				this.state = 1821;
				this.match(SolidCashParser.T__11);
				this.state = 1822;
				this.match(SolidCashParser.Identifier);
				this.state = 1823;
				this.match(SolidCashParser.T__4);
				this.state = 1824;
				this.expressionList();
				this.state = 1825;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 12:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1827;
				this.match(SolidCashParser.T__115);
				this.state = 1828;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1829;
				this.match(SolidCashParser.T__116);
				this.state = 1830;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1831;
				this.match(SolidCashParser.T__117);
				this.state = 1832;
				this.match(SolidCashParser.T__38);
				this.state = 1833;
				this.expression(0);
				this.state = 1834;
				this.match(SolidCashParser.T__4);
				this.state = 1835;
				this.typeList();
				this.state = 1836;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 15:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1838;
				this.match(SolidCashParser.T__118);
				this.state = 1839;
				this.match(SolidCashParser.T__38);
				this.state = 1840;
				this.expression(0);
				this.state = 1841;
				this.match(SolidCashParser.T__4);
				this.state = 1842;
				this.typeList();
				this.state = 1843;
				this.match(SolidCashParser.T__4);
				this.state = 1844;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1845;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 16:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1847;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__119);
				this.state = 1848;
				this.match(SolidCashParser.T__57);
				this.state = 1849;
				this.expression(0);
				this.state = 1850;
				this.match(SolidCashParser.T__58);
				this.state = 1851;
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
				this.state = 1853;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__125);
				this.state = 1854;
				this.match(SolidCashParser.T__57);
				this.state = 1855;
				this.expression(0);
				this.state = 1856;
				this.match(SolidCashParser.T__58);
				this.state = 1857;
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
				this.state = 1859;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===135)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1860;
				this.expression(20);
				}
				break;
			case 19:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1861;
				this.match(SolidCashParser.T__57);
				this.state = 1873;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===14 || _la===27 || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 110)) & ~0x1F) === 0 && ((1 << (_la - 110)) & 33622015) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 134077655) !== 0)) {
					{
					this.state = 1862;
					this.expression(0);
					this.state = 1867;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 188, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1863;
							this.match(SolidCashParser.T__4);
							this.state = 1864;
							this.expression(0);
							}
							}
						}
						this.state = 1869;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 188, this._ctx);
					}
					this.state = 1871;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1870;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1875;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 20:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1876;
				this.match(SolidCashParser.T__69);
				this.state = 1877;
				this.match(SolidCashParser.T__11);
				this.state = 1878;
				this.match(SolidCashParser.Identifier);
				this.state = 1879;
				this.match(SolidCashParser.T__11);
				this.state = 1880;
				this.match(SolidCashParser.Identifier);
				this.state = 1881;
				this.match(SolidCashParser.T__57);
				this.state = 1882;
				this.expression(0);
				this.state = 1883;
				this.match(SolidCashParser.T__58);
				this.state = 1884;
				this.memberName();
				}
				break;
			case 21:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1886;
				this.match(SolidCashParser.T__69);
				this.state = 1887;
				this.match(SolidCashParser.T__11);
				this.state = 1888;
				this.match(SolidCashParser.Identifier);
				this.state = 1893;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 1889;
						this.match(SolidCashParser.T__57);
						this.state = 1890;
						this.expression(0);
						this.state = 1891;
						this.match(SolidCashParser.T__58);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 1895;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 191, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 22:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1897;
				this.match(SolidCashParser.T__69);
				this.state = 1898;
				this.match(SolidCashParser.T__11);
				this.state = 1899;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 23:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1900;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 24:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1901;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 25:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1902;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 1987;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 195, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 1985;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 194, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1905;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 1906;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 1907;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1908;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 1909;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1910;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1911;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 1912;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1913;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1914;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 1915;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===136 || _la===137)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1916;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1917;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 1918;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1919;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1920;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 1921;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1922;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1923;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 1924;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 1925;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1926;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 1927;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 1928;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1929;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 1930;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 1931;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1932;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 1933;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__137);
						this.state = 1934;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1935;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 1936;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__138);
						this.state = 1937;
						(localctx as BinaryOpContext)._right = this.expression(10);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1938;
						if (!(this.precpred(this._ctx, 8))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 8)");
						}
						this.state = 1939;
						this.match(SolidCashParser.T__139);
						this.state = 1940;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 1941;
						this.match(SolidCashParser.T__101);
						this.state = 1942;
						(localctx as TernaryOpContext)._ifFalse = this.expression(8);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1944;
						if (!(this.precpred(this._ctx, 30))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 30)");
						}
						this.state = 1945;
						this.match(SolidCashParser.T__57);
						this.state = 1946;
						(localctx as IndexRangeSliceContext)._start = this.expression(0);
						this.state = 1947;
						this.match(SolidCashParser.T__101);
						this.state = 1948;
						(localctx as IndexRangeSliceContext)._end = this.expression(0);
						this.state = 1949;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1951;
						if (!(this.precpred(this._ctx, 29))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 29)");
						}
						this.state = 1952;
						this.match(SolidCashParser.T__57);
						this.state = 1953;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 1954;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1955;
						if (!(this.precpred(this._ctx, 28))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 28)");
						}
						this.state = 1956;
						this.match(SolidCashParser.T__57);
						this.state = 1957;
						this.expression(0);
						this.state = 1958;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1960;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 1961;
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
						this.state = 1962;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 1963;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__132);
						this.state = 1964;
						this.match(SolidCashParser.T__38);
						this.state = 1965;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 1966;
						this.match(SolidCashParser.T__39);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1968;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 1969;
						this.match(SolidCashParser.T__133);
						this.state = 1970;
						this.match(SolidCashParser.T__38);
						this.state = 1971;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 1972;
						this.match(SolidCashParser.T__4);
						this.state = 1973;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 1974;
						this.match(SolidCashParser.T__39);
						}
						break;
					case 19:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1976;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 1977;
						this.match(SolidCashParser.T__11);
						this.state = 1978;
						this.match(SolidCashParser.Identifier);
						this.state = 1980;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 1979;
							this.callOptions();
							}
						}

						this.state = 1982;
						this.expressionList();
						}
						break;
					case 20:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1983;
						if (!(this.precpred(this._ctx, 21))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 21)");
						}
						this.state = 1984;
						this.memberName();
						}
						break;
					}
					}
				}
				this.state = 1989;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 195, this._ctx);
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
		this.enterRule(localctx, 220, SolidCashParser.RULE_memberName);
		try {
			this.state = 2003;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1990;
				this.match(SolidCashParser.T__11);
				this.state = 1991;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 121:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1992;
				this.match(SolidCashParser.T__120);
				}
				break;
			case 122:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1993;
				this.match(SolidCashParser.T__121);
				}
				break;
			case 123:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1994;
				this.match(SolidCashParser.T__122);
				}
				break;
			case 124:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1995;
				this.match(SolidCashParser.T__123);
				}
				break;
			case 125:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1996;
				this.match(SolidCashParser.T__124);
				}
				break;
			case 127:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1997;
				this.match(SolidCashParser.T__126);
				}
				break;
			case 128:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1998;
				this.match(SolidCashParser.T__127);
				}
				break;
			case 129:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1999;
				this.match(SolidCashParser.T__128);
				}
				break;
			case 130:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2000;
				this.match(SolidCashParser.T__129);
				}
				break;
			case 141:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2001;
				this.match(SolidCashParser.T__140);
				}
				break;
			case 142:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2002;
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
		this.enterRule(localctx, 222, SolidCashParser.RULE_modifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2005;
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
		this.enterRule(localctx, 224, SolidCashParser.RULE_literal);
		try {
			let _alt: number;
			this.state = 2021;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 151:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2007;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 154:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2008;
				this.numberLiteral();
				}
				break;
			case 153:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2009;
				this.decimalLiteral();
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2010;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2014;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 197, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2011;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2016;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 197, this._ctx);
				}
				}
				break;
			case 171:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2017;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 172:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2018;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2019;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2020;
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
		this.enterRule(localctx, 226, SolidCashParser.RULE_numberLiteral);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2023;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2025;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 199, this._ctx) ) {
			case 1:
				{
				this.state = 2024;
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
		this.enterRule(localctx, 228, SolidCashParser.RULE_decimalLiteral);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2027;
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
		this.enterRule(localctx, 230, SolidCashParser.RULE_typeName);
		try {
			this.state = 2042;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 200, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2029;
				this.match(SolidCashParser.T__146);
				this.state = 2030;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2031;
				this.match(SolidCashParser.T__146);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2032;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2033;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2034;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2035;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2036;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2037;
				this.match(SolidCashParser.T__147);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2038;
				this.match(SolidCashParser.T__148);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2039;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2040;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2041;
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
		this.enterRule(localctx, 232, SolidCashParser.RULE_typeCast);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2044;
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
		case 109:
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

	public static readonly _serializedATN: number[] = [4,1,176,2047,2,0,7,0,
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
	7,115,2,116,7,116,1,0,5,0,236,8,0,10,0,12,0,239,9,0,1,0,5,0,242,8,0,10,
	0,12,0,245,9,0,1,0,5,0,248,8,0,10,0,12,0,251,9,0,1,0,5,0,254,8,0,10,0,12,
	0,257,9,0,1,0,5,0,260,8,0,10,0,12,0,263,9,0,1,0,5,0,266,8,0,10,0,12,0,269,
	9,0,1,0,5,0,272,8,0,10,0,12,0,275,9,0,1,0,5,0,278,8,0,10,0,12,0,281,9,0,
	1,0,5,0,284,8,0,10,0,12,0,287,9,0,1,0,5,0,290,8,0,10,0,12,0,293,9,0,1,0,
	5,0,296,8,0,10,0,12,0,299,9,0,1,0,1,0,3,0,303,8,0,1,0,1,0,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,5,1,320,8,1,10,1,12,1,323,9,1,1,1,
	3,1,326,8,1,1,1,1,1,1,1,1,1,1,1,3,1,333,8,1,1,2,1,2,1,2,3,2,338,8,2,1,3,
	1,3,1,3,1,3,3,3,344,8,3,1,3,1,3,5,3,348,8,3,10,3,12,3,351,9,3,1,3,1,3,1,
	4,1,4,1,4,1,4,1,4,3,4,360,8,4,1,4,3,4,363,8,4,1,4,1,4,1,4,1,4,1,4,1,4,5,
	4,371,8,4,10,4,12,4,374,9,4,1,4,3,4,377,8,4,1,4,1,4,1,4,1,4,3,4,383,8,4,
	1,4,3,4,386,8,4,1,4,1,4,3,4,390,8,4,1,5,1,5,1,5,3,5,395,8,5,1,5,1,5,3,5,
	399,8,5,1,6,1,6,1,7,1,7,1,7,1,7,1,7,1,8,1,8,1,9,1,9,3,9,412,8,9,1,10,3,
	10,415,8,10,1,10,1,10,1,11,1,11,1,12,1,12,1,12,1,12,1,12,1,12,5,12,427,
	8,12,10,12,12,12,430,9,12,3,12,432,8,12,1,12,1,12,5,12,436,8,12,10,12,12,
	12,439,9,12,1,12,5,12,442,8,12,10,12,12,12,445,9,12,1,12,5,12,448,8,12,
	10,12,12,12,451,9,12,1,12,5,12,454,8,12,10,12,12,12,457,9,12,1,12,5,12,
	460,8,12,10,12,12,12,463,9,12,1,12,5,12,466,8,12,10,12,12,12,469,9,12,1,
	12,5,12,472,8,12,10,12,12,12,475,9,12,1,12,1,12,1,13,1,13,1,13,1,13,1,13,
	1,13,1,13,1,13,1,13,1,13,3,13,489,8,13,1,14,1,14,1,14,1,14,1,14,1,15,1,
	15,1,16,1,16,1,16,1,16,3,16,502,8,16,1,16,1,16,1,17,1,17,1,17,1,17,5,17,
	510,8,17,10,17,12,17,513,9,17,1,17,5,17,516,8,17,10,17,12,17,519,9,17,1,
	17,5,17,522,8,17,10,17,12,17,525,9,17,1,17,5,17,528,8,17,10,17,12,17,531,
	9,17,1,17,5,17,534,8,17,10,17,12,17,537,9,17,1,17,5,17,540,8,17,10,17,12,
	17,543,9,17,1,17,1,17,1,18,3,18,548,8,18,1,18,1,18,1,18,3,18,553,8,18,1,
	18,1,18,1,18,1,18,5,18,559,8,18,10,18,12,18,562,9,18,3,18,564,8,18,1,18,
	1,18,5,18,568,8,18,10,18,12,18,571,9,18,1,18,5,18,574,8,18,10,18,12,18,
	577,9,18,1,18,5,18,580,8,18,10,18,12,18,583,9,18,1,18,5,18,586,8,18,10,
	18,12,18,589,9,18,1,18,5,18,592,8,18,10,18,12,18,595,9,18,1,18,5,18,598,
	8,18,10,18,12,18,601,9,18,1,18,5,18,604,8,18,10,18,12,18,607,9,18,1,18,
	5,18,610,8,18,10,18,12,18,613,9,18,1,18,5,18,616,8,18,10,18,12,18,619,9,
	18,1,18,3,18,622,8,18,1,18,1,18,5,18,626,8,18,10,18,12,18,629,9,18,1,18,
	3,18,632,8,18,1,18,3,18,635,8,18,1,18,1,18,1,19,1,19,1,19,1,19,5,19,643,
	8,19,10,19,12,19,646,9,19,1,19,5,19,649,8,19,10,19,12,19,652,9,19,1,19,
	3,19,655,8,19,1,19,1,19,1,20,1,20,1,20,1,20,1,20,1,20,5,20,665,8,20,10,
	20,12,20,668,9,20,1,20,3,20,671,8,20,3,20,673,8,20,1,20,1,20,3,20,677,8,
	20,1,20,1,20,1,21,1,21,3,21,683,8,21,1,21,1,21,1,22,1,22,1,22,1,22,1,22,
	1,22,5,22,693,8,22,10,22,12,22,696,9,22,1,22,3,22,699,8,22,3,22,701,8,22,
	1,22,1,22,1,22,1,23,1,23,1,23,1,24,1,24,1,24,1,24,4,24,713,8,24,11,24,12,
	24,714,1,24,1,24,1,25,1,25,1,25,1,25,1,26,1,26,1,26,1,26,1,26,1,26,5,26,
	729,8,26,10,26,12,26,732,9,26,1,26,3,26,735,8,26,1,26,1,26,1,27,1,27,1,
	27,3,27,742,8,27,1,28,1,28,1,28,1,28,1,28,1,28,1,29,1,29,1,29,1,29,1,29,
	1,29,1,29,1,30,1,30,1,30,5,30,760,8,30,10,30,12,30,763,9,30,1,30,1,30,5,
	30,767,8,30,10,30,12,30,770,9,30,1,30,1,30,1,31,1,31,1,31,1,31,5,31,778,
	8,31,10,31,12,31,781,9,31,1,31,5,31,784,8,31,10,31,12,31,787,9,31,1,31,
	1,31,5,31,791,8,31,10,31,12,31,794,9,31,1,31,1,31,1,32,1,32,1,33,1,33,1,
	33,1,33,1,33,1,33,1,33,5,33,807,8,33,10,33,12,33,810,9,33,1,33,1,33,1,34,
	1,34,1,34,1,35,3,35,818,8,35,1,35,1,35,5,35,822,8,35,10,35,12,35,825,9,
	35,1,35,1,35,1,35,1,35,1,35,1,35,5,35,833,8,35,10,35,12,35,836,9,35,1,35,
	1,35,1,35,1,35,3,35,842,8,35,1,35,1,35,5,35,846,8,35,10,35,12,35,849,9,
	35,1,35,1,35,1,35,1,35,3,35,855,8,35,1,35,1,35,5,35,859,8,35,10,35,12,35,
	862,9,35,1,35,1,35,1,35,3,35,867,8,35,1,36,1,36,3,36,871,8,36,1,37,1,37,
	1,38,1,38,1,38,1,38,3,38,879,8,38,1,38,1,38,1,38,3,38,884,8,38,1,38,1,38,
	1,38,1,38,1,38,1,38,3,38,892,8,38,1,38,1,38,1,38,1,38,1,38,1,38,1,38,1,
	38,3,38,902,8,38,1,38,1,38,1,38,3,38,907,8,38,1,38,1,38,3,38,911,8,38,1,
	39,1,39,1,39,1,39,1,39,1,39,1,39,1,39,1,39,1,39,3,39,923,8,39,1,39,1,39,
	1,39,1,39,1,39,1,39,1,39,5,39,932,8,39,10,39,12,39,935,9,39,1,40,1,40,1,
	40,3,40,940,8,40,1,40,1,40,5,40,944,8,40,10,40,12,40,947,9,40,1,40,1,40,
	1,41,1,41,3,41,953,8,41,1,42,1,42,1,42,1,43,1,43,1,43,1,43,5,43,962,8,43,
	10,43,12,43,965,9,43,1,43,5,43,968,8,43,10,43,12,43,971,9,43,1,43,3,43,
	974,8,43,1,43,1,43,5,43,978,8,43,10,43,12,43,981,9,43,1,43,1,43,1,44,1,
	44,3,44,987,8,44,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,
	1,45,1,45,1,45,3,45,1003,8,45,1,46,1,46,1,46,1,46,3,46,1009,8,46,1,47,1,
	47,1,47,1,47,5,47,1015,8,47,10,47,12,47,1018,9,47,1,47,1,47,1,47,5,47,1023,
	8,47,10,47,12,47,1026,9,47,5,47,1028,8,47,10,47,12,47,1031,9,47,1,47,3,
	47,1034,8,47,1,47,1,47,1,48,1,48,1,48,1,48,5,48,1042,8,48,10,48,12,48,1045,
	9,48,1,48,3,48,1048,8,48,3,48,1050,8,48,1,48,1,48,1,49,1,49,5,49,1056,8,
	49,10,49,12,49,1059,9,49,1,49,1,49,1,49,1,49,5,49,1065,8,49,10,49,12,49,
	1068,9,49,1,49,1,49,3,49,1072,8,49,1,50,1,50,5,50,1076,8,50,10,50,12,50,
	1079,9,50,1,50,1,50,3,50,1083,8,50,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,
	51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,
	1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,3,51,1118,8,51,1,
	52,1,52,1,52,1,52,1,52,1,52,1,52,1,52,1,52,1,52,1,53,1,53,1,53,1,53,1,53,
	1,53,1,53,1,53,1,53,1,53,1,53,1,53,5,53,1142,8,53,10,53,12,53,1145,9,53,
	1,53,1,53,1,53,1,54,1,54,1,54,1,54,5,54,1154,8,54,10,54,12,54,1157,9,54,
	1,54,1,54,1,54,1,54,1,54,1,54,1,54,5,54,1166,8,54,10,54,12,54,1169,9,54,
	1,54,3,54,1172,8,54,1,54,1,54,1,54,3,54,1177,8,54,1,55,1,55,1,55,1,55,1,
	55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,3,55,1196,
	8,55,1,55,1,55,1,55,3,55,1201,8,55,1,56,1,56,1,56,1,56,3,56,1207,8,56,1,
	56,1,56,1,56,1,57,1,57,1,57,1,57,1,57,1,58,1,58,1,58,1,58,1,58,1,58,1,58,
	4,58,1224,8,58,11,58,12,58,1225,1,58,1,58,1,58,1,58,1,59,1,59,1,59,1,59,
	1,59,1,59,1,59,4,59,1239,8,59,11,59,12,59,1240,1,59,1,59,1,59,1,59,1,59,
	1,59,1,60,1,60,1,60,1,60,1,60,1,60,1,60,5,60,1256,8,60,10,60,12,60,1259,
	9,60,1,60,1,60,1,60,1,60,1,60,1,60,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,
	62,1,62,5,62,1276,8,62,10,62,12,62,1279,9,62,1,62,1,62,1,62,1,62,1,62,1,
	62,1,62,5,62,1288,8,62,10,62,12,62,1291,9,62,1,62,1,62,1,62,1,62,1,62,3,
	62,1298,8,62,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1306,8,63,11,63,12,63,1307,
	1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1318,8,63,11,63,12,63,1319,
	1,63,1,63,1,63,1,63,1,63,3,63,1327,8,63,1,64,1,64,1,64,1,64,3,64,1333,8,
	64,1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,65,3,65,1343,8,65,1,66,1,66,1,66,
	1,66,1,66,1,66,1,66,1,67,1,67,1,67,1,67,1,67,1,67,1,68,1,68,1,68,1,68,1,
	68,1,68,1,68,1,68,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,70,1,70,1,70,1,70,
	1,70,1,70,1,70,1,70,1,70,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,72,1,
	72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,
	4,72,1406,8,72,11,72,12,72,1407,1,72,1,72,3,72,1412,8,72,1,73,1,73,1,73,
	1,73,1,73,1,73,1,73,3,73,1421,8,73,1,73,1,73,1,73,1,74,1,74,1,74,1,74,1,
	74,3,74,1431,8,74,1,74,1,74,1,74,1,75,1,75,1,75,1,75,1,75,1,75,1,75,3,75,
	1443,8,75,1,76,1,76,1,76,1,76,1,76,1,76,3,76,1451,8,76,1,77,1,77,1,77,1,
	77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,78,1,78,
	1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,79,1,79,1,79,1,79,1,79,1,
	79,1,79,1,79,1,79,1,79,1,79,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,81,
	1,81,5,81,1501,8,81,10,81,12,81,1504,9,81,1,81,1,81,1,81,1,81,1,81,1,82,
	1,82,1,82,1,83,1,83,1,83,1,83,1,83,3,83,1519,8,83,1,84,1,84,1,84,1,84,1,
	84,1,84,1,84,1,84,1,85,1,85,1,85,1,85,1,85,1,85,1,86,1,86,1,86,1,86,1,87,
	1,87,1,87,5,87,1542,8,87,10,87,12,87,1545,9,87,1,87,1,87,1,88,1,88,1,89,
	1,89,1,89,5,89,1554,8,89,10,89,12,89,1557,9,89,1,89,1,89,1,90,1,90,1,90,
	1,90,1,90,1,90,5,90,1567,8,90,10,90,12,90,1570,9,90,1,90,3,90,1573,8,90,
	1,90,1,90,1,91,1,91,1,91,1,91,5,91,1581,8,91,10,91,12,91,1584,9,91,1,92,
	1,92,1,92,5,92,1589,8,92,10,92,12,92,1592,9,92,1,93,1,93,1,93,3,93,1597,
	8,93,1,93,1,93,4,93,1601,8,93,11,93,12,93,1602,1,94,1,94,1,94,1,94,1,94,
	5,94,1610,8,94,10,94,12,94,1613,9,94,1,94,3,94,1616,8,94,3,94,1618,8,94,
	1,94,1,94,1,95,1,95,3,95,1624,8,95,1,95,1,95,1,95,1,95,5,95,1630,8,95,10,
	95,12,95,1633,9,95,1,95,3,95,1636,8,95,3,95,1638,8,95,1,95,3,95,1641,8,
	95,1,95,1,95,1,96,1,96,1,96,1,97,1,97,1,97,1,98,1,98,1,98,3,98,1654,8,98,
	1,99,1,99,1,99,1,99,1,99,1,99,1,99,1,99,1,99,1,99,1,99,1,99,1,99,1,99,3,
	99,1670,8,99,1,100,1,100,1,100,1,100,1,100,1,100,1,101,1,101,3,101,1680,
	8,101,1,102,1,102,1,102,1,102,5,102,1686,8,102,10,102,12,102,1689,9,102,
	1,102,3,102,1692,8,102,3,102,1694,8,102,1,102,1,102,1,103,1,103,1,103,1,
	103,1,103,1,103,1,103,1,103,1,103,1,103,1,103,1,103,5,103,1710,8,103,10,
	103,12,103,1713,9,103,1,103,3,103,1716,8,103,3,103,1718,8,103,1,103,1,103,
	3,103,1722,8,103,1,104,1,104,1,104,1,104,1,105,1,105,1,105,1,105,5,105,
	1732,8,105,10,105,12,105,1735,9,105,1,105,3,105,1738,8,105,3,105,1740,8,
	105,1,105,1,105,1,106,1,106,1,106,1,106,5,106,1748,8,106,10,106,12,106,
	1751,9,106,1,106,3,106,1754,8,106,1,106,1,106,1,107,1,107,1,107,1,107,1,
	108,1,108,1,108,1,108,5,108,1766,8,108,10,108,12,108,1769,9,108,1,108,3,
	108,1772,8,108,1,108,1,108,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,
	109,1,109,3,109,1785,8,109,1,109,1,109,1,109,1,109,1,109,1,109,3,109,1793,
	8,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	5,109,1866,8,109,10,109,12,109,1869,9,109,1,109,3,109,1872,8,109,3,109,
	1874,8,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,4,109,1894,8,109,11,109,
	12,109,1895,1,109,1,109,1,109,1,109,1,109,1,109,3,109,1904,8,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,3,109,1981,8,109,1,109,1,109,1,109,5,109,1986,8,109,10,109,
	12,109,1989,9,109,1,110,1,110,1,110,1,110,1,110,1,110,1,110,1,110,1,110,
	1,110,1,110,1,110,1,110,3,110,2004,8,110,1,111,1,111,1,112,1,112,1,112,
	1,112,1,112,5,112,2013,8,112,10,112,12,112,2016,9,112,1,112,1,112,1,112,
	1,112,3,112,2022,8,112,1,113,1,113,3,113,2026,8,113,1,114,1,114,1,115,1,
	115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,3,
	115,2043,8,115,1,116,1,116,1,116,0,2,78,218,117,0,2,4,6,8,10,12,14,16,18,
	20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,
	68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,110,
	112,114,116,118,120,122,124,126,128,130,132,134,136,138,140,142,144,146,
	148,150,152,154,156,158,160,162,164,166,168,170,172,174,176,178,180,182,
	184,186,188,190,192,194,196,198,200,202,204,206,208,210,212,214,216,218,
	220,222,224,226,228,230,232,0,19,2,0,10,10,13,27,3,0,20,23,26,27,30,30,
	1,0,33,34,1,0,50,52,2,0,33,34,54,55,2,0,30,30,74,83,1,0,84,85,3,0,154,154,
	163,163,173,173,1,0,121,125,2,0,121,125,127,130,3,0,14,14,27,27,135,135,
	2,0,10,10,15,16,1,0,13,14,1,0,136,137,1,0,20,23,1,0,18,19,1,0,131,132,2,
	0,47,47,143,146,4,0,50,50,147,149,157,159,165,169,2252,0,237,1,0,0,0,2,
	332,1,0,0,0,4,334,1,0,0,0,6,339,1,0,0,0,8,389,1,0,0,0,10,391,1,0,0,0,12,
	400,1,0,0,0,14,402,1,0,0,0,16,407,1,0,0,0,18,409,1,0,0,0,20,414,1,0,0,0,
	22,418,1,0,0,0,24,420,1,0,0,0,26,488,1,0,0,0,28,490,1,0,0,0,30,495,1,0,
	0,0,32,497,1,0,0,0,34,505,1,0,0,0,36,547,1,0,0,0,38,638,1,0,0,0,40,658,
	1,0,0,0,42,680,1,0,0,0,44,686,1,0,0,0,46,705,1,0,0,0,48,708,1,0,0,0,50,
	718,1,0,0,0,52,722,1,0,0,0,54,738,1,0,0,0,56,743,1,0,0,0,58,749,1,0,0,0,
	60,756,1,0,0,0,62,773,1,0,0,0,64,797,1,0,0,0,66,799,1,0,0,0,68,813,1,0,
	0,0,70,866,1,0,0,0,72,870,1,0,0,0,74,872,1,0,0,0,76,910,1,0,0,0,78,922,
	1,0,0,0,80,936,1,0,0,0,82,952,1,0,0,0,84,954,1,0,0,0,86,957,1,0,0,0,88,
	984,1,0,0,0,90,1002,1,0,0,0,92,1004,1,0,0,0,94,1010,1,0,0,0,96,1037,1,0,
	0,0,98,1071,1,0,0,0,100,1082,1,0,0,0,102,1117,1,0,0,0,104,1119,1,0,0,0,
	106,1129,1,0,0,0,108,1176,1,0,0,0,110,1200,1,0,0,0,112,1202,1,0,0,0,114,
	1211,1,0,0,0,116,1216,1,0,0,0,118,1231,1,0,0,0,120,1248,1,0,0,0,122,1266,
	1,0,0,0,124,1297,1,0,0,0,126,1326,1,0,0,0,128,1332,1,0,0,0,130,1342,1,0,
	0,0,132,1344,1,0,0,0,134,1351,1,0,0,0,136,1357,1,0,0,0,138,1365,1,0,0,0,
	140,1372,1,0,0,0,142,1381,1,0,0,0,144,1411,1,0,0,0,146,1413,1,0,0,0,148,
	1425,1,0,0,0,150,1435,1,0,0,0,152,1450,1,0,0,0,154,1452,1,0,0,0,156,1468,
	1,0,0,0,158,1479,1,0,0,0,160,1490,1,0,0,0,162,1498,1,0,0,0,164,1510,1,0,
	0,0,166,1518,1,0,0,0,168,1520,1,0,0,0,170,1528,1,0,0,0,172,1534,1,0,0,0,
	174,1538,1,0,0,0,176,1548,1,0,0,0,178,1550,1,0,0,0,180,1560,1,0,0,0,182,
	1576,1,0,0,0,184,1585,1,0,0,0,186,1593,1,0,0,0,188,1604,1,0,0,0,190,1621,
	1,0,0,0,192,1644,1,0,0,0,194,1647,1,0,0,0,196,1653,1,0,0,0,198,1669,1,0,
	0,0,200,1671,1,0,0,0,202,1679,1,0,0,0,204,1681,1,0,0,0,206,1721,1,0,0,0,
	208,1723,1,0,0,0,210,1727,1,0,0,0,212,1743,1,0,0,0,214,1757,1,0,0,0,216,
	1761,1,0,0,0,218,1903,1,0,0,0,220,2003,1,0,0,0,222,2005,1,0,0,0,224,2021,
	1,0,0,0,226,2023,1,0,0,0,228,2027,1,0,0,0,230,2042,1,0,0,0,232,2044,1,0,
	0,0,234,236,3,14,7,0,235,234,1,0,0,0,236,239,1,0,0,0,237,235,1,0,0,0,237,
	238,1,0,0,0,238,243,1,0,0,0,239,237,1,0,0,0,240,242,3,2,1,0,241,240,1,0,
	0,0,242,245,1,0,0,0,243,241,1,0,0,0,243,244,1,0,0,0,244,249,1,0,0,0,245,
	243,1,0,0,0,246,248,3,58,29,0,247,246,1,0,0,0,248,251,1,0,0,0,249,247,1,
	0,0,0,249,250,1,0,0,0,250,255,1,0,0,0,251,249,1,0,0,0,252,254,3,52,26,0,
	253,252,1,0,0,0,254,257,1,0,0,0,255,253,1,0,0,0,255,256,1,0,0,0,256,261,
	1,0,0,0,257,255,1,0,0,0,258,260,3,48,24,0,259,258,1,0,0,0,260,263,1,0,0,
	0,261,259,1,0,0,0,261,262,1,0,0,0,262,267,1,0,0,0,263,261,1,0,0,0,264,266,
	3,56,28,0,265,264,1,0,0,0,266,269,1,0,0,0,267,265,1,0,0,0,267,268,1,0,0,
	0,268,273,1,0,0,0,269,267,1,0,0,0,270,272,3,8,4,0,271,270,1,0,0,0,272,275,
	1,0,0,0,273,271,1,0,0,0,273,274,1,0,0,0,274,279,1,0,0,0,275,273,1,0,0,0,
	276,278,3,44,22,0,277,276,1,0,0,0,278,281,1,0,0,0,279,277,1,0,0,0,279,280,
	1,0,0,0,280,285,1,0,0,0,281,279,1,0,0,0,282,284,3,24,12,0,283,282,1,0,0,
	0,284,287,1,0,0,0,285,283,1,0,0,0,285,286,1,0,0,0,286,291,1,0,0,0,287,285,
	1,0,0,0,288,290,3,6,3,0,289,288,1,0,0,0,290,293,1,0,0,0,291,289,1,0,0,0,
	291,292,1,0,0,0,292,297,1,0,0,0,293,291,1,0,0,0,294,296,3,34,17,0,295,294,
	1,0,0,0,296,299,1,0,0,0,297,295,1,0,0,0,297,298,1,0,0,0,298,302,1,0,0,0,
	299,297,1,0,0,0,300,303,3,36,18,0,301,303,3,34,17,0,302,300,1,0,0,0,302,
	301,1,0,0,0,303,304,1,0,0,0,304,305,5,0,0,1,305,1,1,0,0,0,306,307,5,1,0,
	0,307,308,5,161,0,0,308,333,5,2,0,0,309,310,5,1,0,0,310,311,5,161,0,0,311,
	312,5,3,0,0,312,313,5,173,0,0,313,333,5,2,0,0,314,315,5,1,0,0,315,316,5,
	4,0,0,316,321,3,4,2,0,317,318,5,5,0,0,318,320,3,4,2,0,319,317,1,0,0,0,320,
	323,1,0,0,0,321,319,1,0,0,0,321,322,1,0,0,0,322,325,1,0,0,0,323,321,1,0,
	0,0,324,326,5,5,0,0,325,324,1,0,0,0,325,326,1,0,0,0,326,327,1,0,0,0,327,
	328,5,6,0,0,328,329,5,173,0,0,329,330,5,161,0,0,330,331,5,2,0,0,331,333,
	1,0,0,0,332,306,1,0,0,0,332,309,1,0,0,0,332,314,1,0,0,0,333,3,1,0,0,0,334,
	337,5,173,0,0,335,336,5,3,0,0,336,338,5,173,0,0,337,335,1,0,0,0,337,338,
	1,0,0,0,338,5,1,0,0,0,339,340,5,7,0,0,340,341,5,173,0,0,341,343,3,96,48,
	0,342,344,3,94,47,0,343,342,1,0,0,0,343,344,1,0,0,0,344,345,1,0,0,0,345,
	349,5,4,0,0,346,348,3,102,51,0,347,346,1,0,0,0,348,351,1,0,0,0,349,347,
	1,0,0,0,349,350,1,0,0,0,350,352,1,0,0,0,351,349,1,0,0,0,352,353,5,6,0,0,
	353,7,1,0,0,0,354,355,5,8,0,0,355,356,5,173,0,0,356,359,5,9,0,0,357,360,
	3,230,115,0,358,360,5,10,0,0,359,357,1,0,0,0,359,358,1,0,0,0,360,362,1,
	0,0,0,361,363,5,11,0,0,362,361,1,0,0,0,362,363,1,0,0,0,363,364,1,0,0,0,
	364,390,5,2,0,0,365,366,5,8,0,0,366,367,5,4,0,0,367,372,3,10,5,0,368,369,
	5,5,0,0,369,371,3,10,5,0,370,368,1,0,0,0,371,374,1,0,0,0,372,370,1,0,0,
	0,372,373,1,0,0,0,373,376,1,0,0,0,374,372,1,0,0,0,375,377,5,5,0,0,376,375,
	1,0,0,0,376,377,1,0,0,0,377,378,1,0,0,0,378,379,5,6,0,0,379,382,5,9,0,0,
	380,383,3,230,115,0,381,383,5,10,0,0,382,380,1,0,0,0,382,381,1,0,0,0,383,
	385,1,0,0,0,384,386,5,11,0,0,385,384,1,0,0,0,385,386,1,0,0,0,386,387,1,
	0,0,0,387,388,5,2,0,0,388,390,1,0,0,0,389,354,1,0,0,0,389,365,1,0,0,0,390,
	9,1,0,0,0,391,394,5,173,0,0,392,393,5,12,0,0,393,395,5,173,0,0,394,392,
	1,0,0,0,394,395,1,0,0,0,395,398,1,0,0,0,396,397,5,3,0,0,397,399,3,12,6,
	0,398,396,1,0,0,0,398,399,1,0,0,0,399,11,1,0,0,0,400,401,7,0,0,0,401,13,
	1,0,0,0,402,403,5,28,0,0,403,404,3,16,8,0,404,405,3,18,9,0,405,406,5,2,
	0,0,406,15,1,0,0,0,407,408,5,29,0,0,408,17,1,0,0,0,409,411,3,20,10,0,410,
	412,3,20,10,0,411,410,1,0,0,0,411,412,1,0,0,0,412,19,1,0,0,0,413,415,3,
	22,11,0,414,413,1,0,0,0,414,415,1,0,0,0,415,416,1,0,0,0,416,417,5,150,0,
	0,417,21,1,0,0,0,418,419,7,1,0,0,419,23,1,0,0,0,420,421,5,31,0,0,421,431,
	5,173,0,0,422,423,5,32,0,0,423,428,5,173,0,0,424,425,5,5,0,0,425,427,5,
	173,0,0,426,424,1,0,0,0,427,430,1,0,0,0,428,426,1,0,0,0,428,429,1,0,0,0,
	429,432,1,0,0,0,430,428,1,0,0,0,431,422,1,0,0,0,431,432,1,0,0,0,432,433,
	1,0,0,0,433,437,5,4,0,0,434,436,3,52,26,0,435,434,1,0,0,0,436,439,1,0,0,
	0,437,435,1,0,0,0,437,438,1,0,0,0,438,443,1,0,0,0,439,437,1,0,0,0,440,442,
	3,48,24,0,441,440,1,0,0,0,442,445,1,0,0,0,443,441,1,0,0,0,443,444,1,0,0,
	0,444,449,1,0,0,0,445,443,1,0,0,0,446,448,3,56,28,0,447,446,1,0,0,0,448,
	451,1,0,0,0,449,447,1,0,0,0,449,450,1,0,0,0,450,455,1,0,0,0,451,449,1,0,
	0,0,452,454,3,40,20,0,453,452,1,0,0,0,454,457,1,0,0,0,455,453,1,0,0,0,455,
	456,1,0,0,0,456,461,1,0,0,0,457,455,1,0,0,0,458,460,3,28,14,0,459,458,1,
	0,0,0,460,463,1,0,0,0,461,459,1,0,0,0,461,462,1,0,0,0,462,467,1,0,0,0,463,
	461,1,0,0,0,464,466,3,26,13,0,465,464,1,0,0,0,466,469,1,0,0,0,467,465,1,
	0,0,0,467,468,1,0,0,0,468,473,1,0,0,0,469,467,1,0,0,0,470,472,3,32,16,0,
	471,470,1,0,0,0,472,475,1,0,0,0,473,471,1,0,0,0,473,474,1,0,0,0,474,476,
	1,0,0,0,475,473,1,0,0,0,476,477,5,6,0,0,477,25,1,0,0,0,478,479,3,30,15,
	0,479,480,3,76,38,0,480,481,5,173,0,0,481,482,5,2,0,0,482,489,1,0,0,0,483,
	484,3,30,15,0,484,485,3,78,39,0,485,486,5,173,0,0,486,487,5,2,0,0,487,489,
	1,0,0,0,488,478,1,0,0,0,488,483,1,0,0,0,489,27,1,0,0,0,490,491,3,30,15,
	0,491,492,3,230,115,0,492,493,5,173,0,0,493,494,5,2,0,0,494,29,1,0,0,0,
	495,496,7,2,0,0,496,31,1,0,0,0,497,498,5,7,0,0,498,499,5,173,0,0,499,501,
	3,96,48,0,500,502,3,94,47,0,501,500,1,0,0,0,501,502,1,0,0,0,502,503,1,0,
	0,0,503,504,5,2,0,0,504,33,1,0,0,0,505,506,5,35,0,0,506,507,5,173,0,0,507,
	511,5,4,0,0,508,510,3,52,26,0,509,508,1,0,0,0,510,513,1,0,0,0,511,509,1,
	0,0,0,511,512,1,0,0,0,512,517,1,0,0,0,513,511,1,0,0,0,514,516,3,48,24,0,
	515,514,1,0,0,0,516,519,1,0,0,0,517,515,1,0,0,0,517,518,1,0,0,0,518,523,
	1,0,0,0,519,517,1,0,0,0,520,522,3,56,28,0,521,520,1,0,0,0,522,525,1,0,0,
	0,523,521,1,0,0,0,523,524,1,0,0,0,524,529,1,0,0,0,525,523,1,0,0,0,526,528,
	3,40,20,0,527,526,1,0,0,0,528,531,1,0,0,0,529,527,1,0,0,0,529,530,1,0,0,
	0,530,535,1,0,0,0,531,529,1,0,0,0,532,534,3,58,29,0,533,532,1,0,0,0,534,
	537,1,0,0,0,535,533,1,0,0,0,535,536,1,0,0,0,536,541,1,0,0,0,537,535,1,0,
	0,0,538,540,3,6,3,0,539,538,1,0,0,0,540,543,1,0,0,0,541,539,1,0,0,0,541,
	542,1,0,0,0,542,544,1,0,0,0,543,541,1,0,0,0,544,545,5,6,0,0,545,35,1,0,
	0,0,546,548,5,36,0,0,547,546,1,0,0,0,547,548,1,0,0,0,548,549,1,0,0,0,549,
	550,5,37,0,0,550,552,5,173,0,0,551,553,3,96,48,0,552,551,1,0,0,0,552,553,
	1,0,0,0,553,563,1,0,0,0,554,555,5,32,0,0,555,560,5,173,0,0,556,557,5,5,
	0,0,557,559,5,173,0,0,558,556,1,0,0,0,559,562,1,0,0,0,560,558,1,0,0,0,560,
	561,1,0,0,0,561,564,1,0,0,0,562,560,1,0,0,0,563,554,1,0,0,0,563,564,1,0,
	0,0,564,565,1,0,0,0,565,569,5,4,0,0,566,568,3,52,26,0,567,566,1,0,0,0,568,
	571,1,0,0,0,569,567,1,0,0,0,569,570,1,0,0,0,570,575,1,0,0,0,571,569,1,0,
	0,0,572,574,3,48,24,0,573,572,1,0,0,0,574,577,1,0,0,0,575,573,1,0,0,0,575,
	576,1,0,0,0,576,581,1,0,0,0,577,575,1,0,0,0,578,580,3,56,28,0,579,578,1,
	0,0,0,580,583,1,0,0,0,581,579,1,0,0,0,581,582,1,0,0,0,582,587,1,0,0,0,583,
	581,1,0,0,0,584,586,3,40,20,0,585,584,1,0,0,0,586,589,1,0,0,0,587,585,1,
	0,0,0,587,588,1,0,0,0,588,593,1,0,0,0,589,587,1,0,0,0,590,592,3,44,22,0,
	591,590,1,0,0,0,592,595,1,0,0,0,593,591,1,0,0,0,593,594,1,0,0,0,594,599,
	1,0,0,0,595,593,1,0,0,0,596,598,3,58,29,0,597,596,1,0,0,0,598,601,1,0,0,
	0,599,597,1,0,0,0,599,600,1,0,0,0,600,605,1,0,0,0,601,599,1,0,0,0,602,604,
	3,8,4,0,603,602,1,0,0,0,604,607,1,0,0,0,605,603,1,0,0,0,605,606,1,0,0,0,
	606,611,1,0,0,0,607,605,1,0,0,0,608,610,3,70,35,0,609,608,1,0,0,0,610,613,
	1,0,0,0,611,609,1,0,0,0,611,612,1,0,0,0,612,617,1,0,0,0,613,611,1,0,0,0,
	614,616,3,80,40,0,615,614,1,0,0,0,616,619,1,0,0,0,617,615,1,0,0,0,617,618,
	1,0,0,0,618,621,1,0,0,0,619,617,1,0,0,0,620,622,3,60,30,0,621,620,1,0,0,
	0,621,622,1,0,0,0,622,627,1,0,0,0,623,626,3,86,43,0,624,626,3,38,19,0,625,
	623,1,0,0,0,625,624,1,0,0,0,626,629,1,0,0,0,627,625,1,0,0,0,627,628,1,0,
	0,0,628,631,1,0,0,0,629,627,1,0,0,0,630,632,3,62,31,0,631,630,1,0,0,0,631,
	632,1,0,0,0,632,634,1,0,0,0,633,635,3,66,33,0,634,633,1,0,0,0,634,635,1,
	0,0,0,635,636,1,0,0,0,636,637,5,6,0,0,637,37,1,0,0,0,638,639,5,7,0,0,639,
	640,5,173,0,0,640,644,3,96,48,0,641,643,3,90,45,0,642,641,1,0,0,0,643,646,
	1,0,0,0,644,642,1,0,0,0,644,645,1,0,0,0,645,650,1,0,0,0,646,644,1,0,0,0,
	647,649,3,88,44,0,648,647,1,0,0,0,649,652,1,0,0,0,650,648,1,0,0,0,650,651,
	1,0,0,0,651,654,1,0,0,0,652,650,1,0,0,0,653,655,3,94,47,0,654,653,1,0,0,
	0,654,655,1,0,0,0,655,656,1,0,0,0,656,657,5,2,0,0,657,39,1,0,0,0,658,659,
	5,38,0,0,659,660,5,173,0,0,660,672,5,39,0,0,661,666,3,42,21,0,662,663,5,
	5,0,0,663,665,3,42,21,0,664,662,1,0,0,0,665,668,1,0,0,0,666,664,1,0,0,0,
	666,667,1,0,0,0,667,670,1,0,0,0,668,666,1,0,0,0,669,671,5,5,0,0,670,669,
	1,0,0,0,670,671,1,0,0,0,671,673,1,0,0,0,672,661,1,0,0,0,672,673,1,0,0,0,
	673,674,1,0,0,0,674,676,5,40,0,0,675,677,5,41,0,0,676,675,1,0,0,0,676,677,
	1,0,0,0,677,678,1,0,0,0,678,679,5,2,0,0,679,41,1,0,0,0,680,682,3,230,115,
	0,681,683,5,42,0,0,682,681,1,0,0,0,682,683,1,0,0,0,683,684,1,0,0,0,684,
	685,5,173,0,0,685,43,1,0,0,0,686,687,5,43,0,0,687,688,5,173,0,0,688,700,
	5,39,0,0,689,694,3,46,23,0,690,691,5,5,0,0,691,693,3,46,23,0,692,690,1,
	0,0,0,693,696,1,0,0,0,694,692,1,0,0,0,694,695,1,0,0,0,695,698,1,0,0,0,696,
	694,1,0,0,0,697,699,5,5,0,0,698,697,1,0,0,0,698,699,1,0,0,0,699,701,1,0,
	0,0,700,689,1,0,0,0,700,701,1,0,0,0,701,702,1,0,0,0,702,703,5,40,0,0,703,
	704,5,2,0,0,704,45,1,0,0,0,705,706,3,230,115,0,706,707,5,173,0,0,707,47,
	1,0,0,0,708,709,5,44,0,0,709,710,5,173,0,0,710,712,5,4,0,0,711,713,3,50,
	25,0,712,711,1,0,0,0,713,714,1,0,0,0,714,712,1,0,0,0,714,715,1,0,0,0,715,
	716,1,0,0,0,716,717,5,6,0,0,717,49,1,0,0,0,718,719,3,230,115,0,719,720,
	5,173,0,0,720,721,5,2,0,0,721,51,1,0,0,0,722,723,5,45,0,0,723,724,5,173,
	0,0,724,725,5,4,0,0,725,730,3,54,27,0,726,727,5,5,0,0,727,729,3,54,27,0,
	728,726,1,0,0,0,729,732,1,0,0,0,730,728,1,0,0,0,730,731,1,0,0,0,731,734,
	1,0,0,0,732,730,1,0,0,0,733,735,5,5,0,0,734,733,1,0,0,0,734,735,1,0,0,0,
	735,736,1,0,0,0,736,737,5,6,0,0,737,53,1,0,0,0,738,741,5,173,0,0,739,740,
	5,30,0,0,740,742,5,154,0,0,741,739,1,0,0,0,741,742,1,0,0,0,742,55,1,0,0,
	0,743,744,5,46,0,0,744,745,5,173,0,0,745,746,5,32,0,0,746,747,3,230,115,
	0,747,748,5,2,0,0,748,57,1,0,0,0,749,750,3,230,115,0,750,751,5,47,0,0,751,
	752,5,173,0,0,752,753,5,30,0,0,753,754,3,218,109,0,754,755,5,2,0,0,755,
	59,1,0,0,0,756,757,5,48,0,0,757,761,3,96,48,0,758,760,3,68,34,0,759,758,
	1,0,0,0,760,763,1,0,0,0,761,759,1,0,0,0,761,762,1,0,0,0,762,764,1,0,0,0,
	763,761,1,0,0,0,764,768,5,4,0,0,765,767,3,102,51,0,766,765,1,0,0,0,767,
	770,1,0,0,0,768,766,1,0,0,0,768,769,1,0,0,0,769,771,1,0,0,0,770,768,1,0,
	0,0,771,772,5,6,0,0,772,61,1,0,0,0,773,774,5,49,0,0,774,775,3,96,48,0,775,
	779,5,34,0,0,776,778,3,64,32,0,777,776,1,0,0,0,778,781,1,0,0,0,779,777,
	1,0,0,0,779,780,1,0,0,0,780,785,1,0,0,0,781,779,1,0,0,0,782,784,3,88,44,
	0,783,782,1,0,0,0,784,787,1,0,0,0,785,783,1,0,0,0,785,786,1,0,0,0,786,788,
	1,0,0,0,787,785,1,0,0,0,788,792,5,4,0,0,789,791,3,102,51,0,790,789,1,0,
	0,0,791,794,1,0,0,0,792,790,1,0,0,0,792,793,1,0,0,0,793,795,1,0,0,0,794,
	792,1,0,0,0,795,796,5,6,0,0,796,63,1,0,0,0,797,798,7,3,0,0,798,65,1,0,0,
	0,799,800,5,53,0,0,800,801,5,39,0,0,801,802,5,40,0,0,802,803,5,34,0,0,803,
	804,5,50,0,0,804,808,5,4,0,0,805,807,3,102,51,0,806,805,1,0,0,0,807,810,
	1,0,0,0,808,806,1,0,0,0,808,809,1,0,0,0,809,811,1,0,0,0,810,808,1,0,0,0,
	811,812,5,6,0,0,812,67,1,0,0,0,813,814,5,173,0,0,814,815,3,210,105,0,815,
	69,1,0,0,0,816,818,3,74,37,0,817,816,1,0,0,0,817,818,1,0,0,0,818,819,1,
	0,0,0,819,823,3,230,115,0,820,822,3,222,111,0,821,820,1,0,0,0,822,825,1,
	0,0,0,823,821,1,0,0,0,823,824,1,0,0,0,824,826,1,0,0,0,825,823,1,0,0,0,826,
	827,5,173,0,0,827,828,5,2,0,0,828,867,1,0,0,0,829,830,3,230,115,0,830,834,
	3,74,37,0,831,833,3,222,111,0,832,831,1,0,0,0,833,836,1,0,0,0,834,832,1,
	0,0,0,834,835,1,0,0,0,835,837,1,0,0,0,836,834,1,0,0,0,837,838,5,173,0,0,
	838,839,5,2,0,0,839,867,1,0,0,0,840,842,3,74,37,0,841,840,1,0,0,0,841,842,
	1,0,0,0,842,843,1,0,0,0,843,847,3,76,38,0,844,846,3,72,36,0,845,844,1,0,
	0,0,846,849,1,0,0,0,847,845,1,0,0,0,847,848,1,0,0,0,848,850,1,0,0,0,849,
	847,1,0,0,0,850,851,5,173,0,0,851,852,5,2,0,0,852,867,1,0,0,0,853,855,3,
	74,37,0,854,853,1,0,0,0,854,855,1,0,0,0,855,856,1,0,0,0,856,860,3,78,39,
	0,857,859,3,72,36,0,858,857,1,0,0,0,859,862,1,0,0,0,860,858,1,0,0,0,860,
	861,1,0,0,0,861,863,1,0,0,0,862,860,1,0,0,0,863,864,5,173,0,0,864,865,5,
	2,0,0,865,867,1,0,0,0,866,817,1,0,0,0,866,829,1,0,0,0,866,841,1,0,0,0,866,
	854,1,0,0,0,867,71,1,0,0,0,868,871,3,222,111,0,869,871,3,74,37,0,870,868,
	1,0,0,0,870,869,1,0,0,0,871,73,1,0,0,0,872,873,7,4,0,0,873,75,1,0,0,0,874,
	875,5,56,0,0,875,876,5,39,0,0,876,878,3,230,115,0,877,879,5,173,0,0,878,
	877,1,0,0,0,878,879,1,0,0,0,879,880,1,0,0,0,880,881,5,57,0,0,881,883,3,
	230,115,0,882,884,5,173,0,0,883,882,1,0,0,0,883,884,1,0,0,0,884,885,1,0,
	0,0,885,886,5,40,0,0,886,911,1,0,0,0,887,888,5,56,0,0,888,889,5,39,0,0,
	889,891,3,230,115,0,890,892,5,173,0,0,891,890,1,0,0,0,891,892,1,0,0,0,892,
	893,1,0,0,0,893,894,5,57,0,0,894,895,3,76,38,0,895,896,5,40,0,0,896,911,
	1,0,0,0,897,898,5,56,0,0,898,899,5,39,0,0,899,901,3,230,115,0,900,902,5,
	173,0,0,901,900,1,0,0,0,901,902,1,0,0,0,902,903,1,0,0,0,903,904,5,57,0,
	0,904,906,3,78,39,0,905,907,5,173,0,0,906,905,1,0,0,0,906,907,1,0,0,0,907,
	908,1,0,0,0,908,909,5,40,0,0,909,911,1,0,0,0,910,874,1,0,0,0,910,887,1,
	0,0,0,910,897,1,0,0,0,911,77,1,0,0,0,912,913,6,39,-1,0,913,914,3,230,115,
	0,914,915,5,58,0,0,915,916,5,154,0,0,916,917,5,59,0,0,917,923,1,0,0,0,918,
	919,3,230,115,0,919,920,5,58,0,0,920,921,5,59,0,0,921,923,1,0,0,0,922,912,
	1,0,0,0,922,918,1,0,0,0,923,933,1,0,0,0,924,925,10,2,0,0,925,926,5,58,0,
	0,926,927,5,154,0,0,927,932,5,59,0,0,928,929,10,1,0,0,929,930,5,58,0,0,
	930,932,5,59,0,0,931,924,1,0,0,0,931,928,1,0,0,0,932,935,1,0,0,0,933,931,
	1,0,0,0,933,934,1,0,0,0,934,79,1,0,0,0,935,933,1,0,0,0,936,937,5,60,0,0,
	937,939,5,173,0,0,938,940,3,96,48,0,939,938,1,0,0,0,939,940,1,0,0,0,940,
	941,1,0,0,0,941,945,5,4,0,0,942,944,3,82,41,0,943,942,1,0,0,0,944,947,1,
	0,0,0,945,943,1,0,0,0,945,946,1,0,0,0,946,948,1,0,0,0,947,945,1,0,0,0,948,
	949,5,6,0,0,949,81,1,0,0,0,950,953,3,84,42,0,951,953,3,102,51,0,952,950,
	1,0,0,0,952,951,1,0,0,0,953,83,1,0,0,0,954,955,5,61,0,0,955,956,5,2,0,0,
	956,85,1,0,0,0,957,958,5,7,0,0,958,959,5,173,0,0,959,963,3,96,48,0,960,
	962,3,90,45,0,961,960,1,0,0,0,962,965,1,0,0,0,963,961,1,0,0,0,963,964,1,
	0,0,0,964,969,1,0,0,0,965,963,1,0,0,0,966,968,3,88,44,0,967,966,1,0,0,0,
	968,971,1,0,0,0,969,967,1,0,0,0,969,970,1,0,0,0,970,973,1,0,0,0,971,969,
	1,0,0,0,972,974,3,94,47,0,973,972,1,0,0,0,973,974,1,0,0,0,974,975,1,0,0,
	0,975,979,5,4,0,0,976,978,3,102,51,0,977,976,1,0,0,0,978,981,1,0,0,0,979,
	977,1,0,0,0,979,980,1,0,0,0,980,982,1,0,0,0,981,979,1,0,0,0,982,983,5,6,
	0,0,983,87,1,0,0,0,984,986,5,173,0,0,985,987,3,210,105,0,986,985,1,0,0,
	0,986,987,1,0,0,0,987,89,1,0,0,0,988,1003,5,62,0,0,989,1003,5,63,0,0,990,
	1003,5,54,0,0,991,1003,5,34,0,0,992,1003,5,33,0,0,993,1003,5,55,0,0,994,
	1003,5,50,0,0,995,1003,5,52,0,0,996,1003,5,51,0,0,997,1003,3,92,46,0,998,
	1003,5,64,0,0,999,1003,5,65,0,0,1000,1003,5,66,0,0,1001,1003,5,67,0,0,1002,
	988,1,0,0,0,1002,989,1,0,0,0,1002,990,1,0,0,0,1002,991,1,0,0,0,1002,992,
	1,0,0,0,1002,993,1,0,0,0,1002,994,1,0,0,0,1002,995,1,0,0,0,1002,996,1,0,
	0,0,1002,997,1,0,0,0,1002,998,1,0,0,0,1002,999,1,0,0,0,1002,1000,1,0,0,
	0,1002,1001,1,0,0,0,1003,91,1,0,0,0,1004,1008,5,68,0,0,1005,1006,5,39,0,
	0,1006,1007,5,154,0,0,1007,1009,5,40,0,0,1008,1005,1,0,0,0,1008,1009,1,
	0,0,0,1009,93,1,0,0,0,1010,1011,5,69,0,0,1011,1012,5,39,0,0,1012,1016,3,
	230,115,0,1013,1015,3,222,111,0,1014,1013,1,0,0,0,1015,1018,1,0,0,0,1016,
	1014,1,0,0,0,1016,1017,1,0,0,0,1017,1029,1,0,0,0,1018,1016,1,0,0,0,1019,
	1020,5,5,0,0,1020,1024,3,230,115,0,1021,1023,3,222,111,0,1022,1021,1,0,
	0,0,1023,1026,1,0,0,0,1024,1022,1,0,0,0,1024,1025,1,0,0,0,1025,1028,1,0,
	0,0,1026,1024,1,0,0,0,1027,1019,1,0,0,0,1028,1031,1,0,0,0,1029,1027,1,0,
	0,0,1029,1030,1,0,0,0,1030,1033,1,0,0,0,1031,1029,1,0,0,0,1032,1034,5,5,
	0,0,1033,1032,1,0,0,0,1033,1034,1,0,0,0,1034,1035,1,0,0,0,1035,1036,5,40,
	0,0,1036,95,1,0,0,0,1037,1049,5,39,0,0,1038,1043,3,98,49,0,1039,1040,5,
	5,0,0,1040,1042,3,98,49,0,1041,1039,1,0,0,0,1042,1045,1,0,0,0,1043,1041,
	1,0,0,0,1043,1044,1,0,0,0,1044,1047,1,0,0,0,1045,1043,1,0,0,0,1046,1048,
	5,5,0,0,1047,1046,1,0,0,0,1047,1048,1,0,0,0,1048,1050,1,0,0,0,1049,1038,
	1,0,0,0,1049,1050,1,0,0,0,1050,1051,1,0,0,0,1051,1052,5,40,0,0,1052,97,
	1,0,0,0,1053,1057,3,230,115,0,1054,1056,3,222,111,0,1055,1054,1,0,0,0,1056,
	1059,1,0,0,0,1057,1055,1,0,0,0,1057,1058,1,0,0,0,1058,1060,1,0,0,0,1059,
	1057,1,0,0,0,1060,1061,5,173,0,0,1061,1072,1,0,0,0,1062,1066,3,78,39,0,
	1063,1065,3,222,111,0,1064,1063,1,0,0,0,1065,1068,1,0,0,0,1066,1064,1,0,
	0,0,1066,1067,1,0,0,0,1067,1069,1,0,0,0,1068,1066,1,0,0,0,1069,1070,5,173,
	0,0,1070,1072,1,0,0,0,1071,1053,1,0,0,0,1071,1062,1,0,0,0,1072,99,1,0,0,
	0,1073,1077,5,4,0,0,1074,1076,3,102,51,0,1075,1074,1,0,0,0,1076,1079,1,
	0,0,0,1077,1075,1,0,0,0,1077,1078,1,0,0,0,1078,1080,1,0,0,0,1079,1077,1,
	0,0,0,1080,1083,5,6,0,0,1081,1083,3,102,51,0,1082,1073,1,0,0,0,1082,1081,
	1,0,0,0,1083,101,1,0,0,0,1084,1118,3,124,62,0,1085,1118,3,126,63,0,1086,
	1118,3,136,68,0,1087,1118,3,132,66,0,1088,1118,3,134,67,0,1089,1118,3,138,
	69,0,1090,1118,3,140,70,0,1091,1118,3,142,71,0,1092,1118,3,130,65,0,1093,
	1118,3,122,61,0,1094,1118,3,118,59,0,1095,1118,3,116,58,0,1096,1118,3,120,
	60,0,1097,1118,3,146,73,0,1098,1118,3,148,74,0,1099,1118,3,150,75,0,1100,
	1118,3,152,76,0,1101,1118,3,172,86,0,1102,1118,3,114,57,0,1103,1118,3,104,
	52,0,1104,1118,3,106,53,0,1105,1118,3,108,54,0,1106,1118,3,110,55,0,1107,
	1118,3,112,56,0,1108,1118,3,174,87,0,1109,1118,3,186,93,0,1110,1118,3,198,
	99,0,1111,1118,3,200,100,0,1112,1118,3,144,72,0,1113,1118,3,178,89,0,1114,
	1118,3,180,90,0,1115,1118,3,192,96,0,1116,1118,3,194,97,0,1117,1084,1,0,
	0,0,1117,1085,1,0,0,0,1117,1086,1,0,0,0,1117,1087,1,0,0,0,1117,1088,1,0,
	0,0,1117,1089,1,0,0,0,1117,1090,1,0,0,0,1117,1091,1,0,0,0,1117,1092,1,0,
	0,0,1117,1093,1,0,0,0,1117,1094,1,0,0,0,1117,1095,1,0,0,0,1117,1096,1,0,
	0,0,1117,1097,1,0,0,0,1117,1098,1,0,0,0,1117,1099,1,0,0,0,1117,1100,1,0,
	0,0,1117,1101,1,0,0,0,1117,1102,1,0,0,0,1117,1103,1,0,0,0,1117,1104,1,0,
	0,0,1117,1105,1,0,0,0,1117,1106,1,0,0,0,1117,1107,1,0,0,0,1117,1108,1,0,
	0,0,1117,1109,1,0,0,0,1117,1110,1,0,0,0,1117,1111,1,0,0,0,1117,1112,1,0,
	0,0,1117,1113,1,0,0,0,1117,1114,1,0,0,0,1117,1115,1,0,0,0,1117,1116,1,0,
	0,0,1118,103,1,0,0,0,1119,1120,5,70,0,0,1120,1121,5,12,0,0,1121,1122,5,
	173,0,0,1122,1123,5,39,0,0,1123,1124,3,218,109,0,1124,1125,5,5,0,0,1125,
	1126,3,218,109,0,1126,1127,5,40,0,0,1127,1128,5,2,0,0,1128,105,1,0,0,0,
	1129,1130,5,70,0,0,1130,1131,5,12,0,0,1131,1132,5,173,0,0,1132,1133,5,58,
	0,0,1133,1134,3,218,109,0,1134,1135,5,59,0,0,1135,1136,5,12,0,0,1136,1137,
	5,173,0,0,1137,1138,5,39,0,0,1138,1143,3,218,109,0,1139,1140,5,5,0,0,1140,
	1142,3,218,109,0,1141,1139,1,0,0,0,1142,1145,1,0,0,0,1143,1141,1,0,0,0,
	1143,1144,1,0,0,0,1144,1146,1,0,0,0,1145,1143,1,0,0,0,1146,1147,5,40,0,
	0,1147,1148,5,2,0,0,1148,107,1,0,0,0,1149,1150,5,71,0,0,1150,1155,3,218,
	109,0,1151,1152,5,5,0,0,1152,1154,3,218,109,0,1153,1151,1,0,0,0,1154,1157,
	1,0,0,0,1155,1153,1,0,0,0,1155,1156,1,0,0,0,1156,1158,1,0,0,0,1157,1155,
	1,0,0,0,1158,1159,5,2,0,0,1159,1177,1,0,0,0,1160,1161,5,71,0,0,1161,1162,
	5,39,0,0,1162,1167,3,218,109,0,1163,1164,5,5,0,0,1164,1166,3,218,109,0,
	1165,1163,1,0,0,0,1166,1169,1,0,0,0,1167,1165,1,0,0,0,1167,1168,1,0,0,0,
	1168,1171,1,0,0,0,1169,1167,1,0,0,0,1170,1172,5,5,0,0,1171,1170,1,0,0,0,
	1171,1172,1,0,0,0,1172,1173,1,0,0,0,1173,1174,5,40,0,0,1174,1175,5,2,0,
	0,1175,1177,1,0,0,0,1176,1149,1,0,0,0,1176,1160,1,0,0,0,1177,109,1,0,0,
	0,1178,1179,5,173,0,0,1179,1180,3,210,105,0,1180,1181,5,2,0,0,1181,1201,
	1,0,0,0,1182,1183,5,173,0,0,1183,1184,5,12,0,0,1184,1185,5,173,0,0,1185,
	1186,3,210,105,0,1186,1187,5,2,0,0,1187,1201,1,0,0,0,1188,1189,5,173,0,
	0,1189,1190,3,210,105,0,1190,1191,5,12,0,0,1191,1192,5,173,0,0,1192,1193,
	5,12,0,0,1193,1195,5,173,0,0,1194,1196,3,212,106,0,1195,1194,1,0,0,0,1195,
	1196,1,0,0,0,1196,1197,1,0,0,0,1197,1198,3,210,105,0,1198,1199,5,2,0,0,
	1199,1201,1,0,0,0,1200,1178,1,0,0,0,1200,1182,1,0,0,0,1200,1188,1,0,0,0,
	1201,111,1,0,0,0,1202,1203,3,218,109,0,1203,1204,5,12,0,0,1204,1206,5,173,
	0,0,1205,1207,3,212,106,0,1206,1205,1,0,0,0,1206,1207,1,0,0,0,1207,1208,
	1,0,0,0,1208,1209,3,210,105,0,1209,1210,5,2,0,0,1210,113,1,0,0,0,1211,1212,
	5,72,0,0,1212,1213,5,173,0,0,1213,1214,3,210,105,0,1214,1215,5,2,0,0,1215,
	115,1,0,0,0,1216,1217,5,70,0,0,1217,1218,5,12,0,0,1218,1223,5,173,0,0,1219,
	1220,5,58,0,0,1220,1221,3,218,109,0,1221,1222,5,59,0,0,1222,1224,1,0,0,
	0,1223,1219,1,0,0,0,1224,1225,1,0,0,0,1225,1223,1,0,0,0,1225,1226,1,0,0,
	0,1226,1227,1,0,0,0,1227,1228,5,30,0,0,1228,1229,3,218,109,0,1229,1230,
	5,2,0,0,1230,117,1,0,0,0,1231,1232,5,70,0,0,1232,1233,5,12,0,0,1233,1238,
	5,173,0,0,1234,1235,5,58,0,0,1235,1236,3,218,109,0,1236,1237,5,59,0,0,1237,
	1239,1,0,0,0,1238,1234,1,0,0,0,1239,1240,1,0,0,0,1240,1238,1,0,0,0,1240,
	1241,1,0,0,0,1241,1242,1,0,0,0,1242,1243,5,12,0,0,1243,1244,5,173,0,0,1244,
	1245,5,30,0,0,1245,1246,3,218,109,0,1246,1247,5,2,0,0,1247,119,1,0,0,0,
	1248,1249,5,70,0,0,1249,1250,5,12,0,0,1250,1257,5,173,0,0,1251,1252,5,58,
	0,0,1252,1253,3,218,109,0,1253,1254,5,59,0,0,1254,1256,1,0,0,0,1255,1251,
	1,0,0,0,1256,1259,1,0,0,0,1257,1255,1,0,0,0,1257,1258,1,0,0,0,1258,1260,
	1,0,0,0,1259,1257,1,0,0,0,1260,1261,5,73,0,0,1261,1262,5,39,0,0,1262,1263,
	3,218,109,0,1263,1264,5,40,0,0,1264,1265,5,2,0,0,1265,121,1,0,0,0,1266,
	1267,5,70,0,0,1267,1268,5,12,0,0,1268,1269,5,173,0,0,1269,1270,5,30,0,0,
	1270,1271,3,218,109,0,1271,1272,5,2,0,0,1272,123,1,0,0,0,1273,1277,3,230,
	115,0,1274,1276,3,222,111,0,1275,1274,1,0,0,0,1276,1279,1,0,0,0,1277,1275,
	1,0,0,0,1277,1278,1,0,0,0,1278,1280,1,0,0,0,1279,1277,1,0,0,0,1280,1281,
	5,173,0,0,1281,1282,5,30,0,0,1282,1283,3,218,109,0,1283,1284,5,2,0,0,1284,
	1298,1,0,0,0,1285,1289,3,78,39,0,1286,1288,3,222,111,0,1287,1286,1,0,0,
	0,1288,1291,1,0,0,0,1289,1287,1,0,0,0,1289,1290,1,0,0,0,1290,1292,1,0,0,
	0,1291,1289,1,0,0,0,1292,1293,5,173,0,0,1293,1294,5,30,0,0,1294,1295,3,
	218,109,0,1295,1296,5,2,0,0,1296,1298,1,0,0,0,1297,1273,1,0,0,0,1297,1285,
	1,0,0,0,1298,125,1,0,0,0,1299,1300,3,230,115,0,1300,1305,5,173,0,0,1301,
	1302,5,5,0,0,1302,1303,3,230,115,0,1303,1304,5,173,0,0,1304,1306,1,0,0,
	0,1305,1301,1,0,0,0,1306,1307,1,0,0,0,1307,1305,1,0,0,0,1307,1308,1,0,0,
	0,1308,1309,1,0,0,0,1309,1310,5,30,0,0,1310,1311,3,218,109,0,1311,1312,
	5,2,0,0,1312,1327,1,0,0,0,1313,1314,5,39,0,0,1314,1317,3,128,64,0,1315,
	1316,5,5,0,0,1316,1318,3,128,64,0,1317,1315,1,0,0,0,1318,1319,1,0,0,0,1319,
	1317,1,0,0,0,1319,1320,1,0,0,0,1320,1321,1,0,0,0,1321,1322,5,40,0,0,1322,
	1323,5,30,0,0,1323,1324,3,218,109,0,1324,1325,5,2,0,0,1325,1327,1,0,0,0,
	1326,1299,1,0,0,0,1326,1313,1,0,0,0,1327,127,1,0,0,0,1328,1329,3,230,115,
	0,1329,1330,5,173,0,0,1330,1333,1,0,0,0,1331,1333,1,0,0,0,1332,1328,1,0,
	0,0,1332,1331,1,0,0,0,1333,129,1,0,0,0,1334,1335,5,173,0,0,1335,1336,7,
	5,0,0,1336,1337,3,218,109,0,1337,1338,5,2,0,0,1338,1343,1,0,0,0,1339,1340,
	5,173,0,0,1340,1341,7,6,0,0,1341,1343,5,2,0,0,1342,1334,1,0,0,0,1342,1339,
	1,0,0,0,1343,131,1,0,0,0,1344,1345,5,173,0,0,1345,1346,5,86,0,0,1346,1347,
	5,39,0,0,1347,1348,3,218,109,0,1348,1349,5,40,0,0,1349,1350,5,2,0,0,1350,
	133,1,0,0,0,1351,1352,5,173,0,0,1352,1353,5,87,0,0,1353,1354,5,39,0,0,1354,
	1355,5,40,0,0,1355,1356,5,2,0,0,1356,135,1,0,0,0,1357,1358,5,173,0,0,1358,
	1359,5,58,0,0,1359,1360,3,218,109,0,1360,1361,5,59,0,0,1361,1362,5,30,0,
	0,1362,1363,3,218,109,0,1363,1364,5,2,0,0,1364,137,1,0,0,0,1365,1366,5,
	173,0,0,1366,1367,5,73,0,0,1367,1368,5,39,0,0,1368,1369,3,218,109,0,1369,
	1370,5,40,0,0,1370,1371,5,2,0,0,1371,139,1,0,0,0,1372,1373,5,70,0,0,1373,
	1374,5,12,0,0,1374,1375,5,173,0,0,1375,1376,5,86,0,0,1376,1377,5,39,0,0,
	1377,1378,3,218,109,0,1378,1379,5,40,0,0,1379,1380,5,2,0,0,1380,141,1,0,
	0,0,1381,1382,5,70,0,0,1382,1383,5,12,0,0,1383,1384,5,173,0,0,1384,1385,
	5,87,0,0,1385,1386,5,39,0,0,1386,1387,5,40,0,0,1387,1388,5,2,0,0,1388,143,
	1,0,0,0,1389,1390,5,88,0,0,1390,1391,5,173,0,0,1391,1412,5,2,0,0,1392,1393,
	5,88,0,0,1393,1394,5,70,0,0,1394,1395,5,12,0,0,1395,1396,5,173,0,0,1396,
	1412,5,2,0,0,1397,1398,5,88,0,0,1398,1399,5,70,0,0,1399,1400,5,12,0,0,1400,
	1405,5,173,0,0,1401,1402,5,58,0,0,1402,1403,3,218,109,0,1403,1404,5,59,
	0,0,1404,1406,1,0,0,0,1405,1401,1,0,0,0,1406,1407,1,0,0,0,1407,1405,1,0,
	0,0,1407,1408,1,0,0,0,1408,1409,1,0,0,0,1409,1410,5,2,0,0,1410,1412,1,0,
	0,0,1411,1389,1,0,0,0,1411,1392,1,0,0,0,1411,1397,1,0,0,0,1412,145,1,0,
	0,0,1413,1414,5,89,0,0,1414,1415,5,39,0,0,1415,1416,5,164,0,0,1416,1417,
	5,23,0,0,1417,1420,3,218,109,0,1418,1419,5,5,0,0,1419,1421,3,196,98,0,1420,
	1418,1,0,0,0,1420,1421,1,0,0,0,1421,1422,1,0,0,0,1422,1423,5,40,0,0,1423,
	1424,5,2,0,0,1424,147,1,0,0,0,1425,1426,5,89,0,0,1426,1427,5,39,0,0,1427,
	1430,3,218,109,0,1428,1429,5,5,0,0,1429,1431,3,196,98,0,1430,1428,1,0,0,
	0,1430,1431,1,0,0,0,1431,1432,1,0,0,0,1432,1433,5,40,0,0,1433,1434,5,2,
	0,0,1434,149,1,0,0,0,1435,1436,5,90,0,0,1436,1437,5,39,0,0,1437,1438,3,
	218,109,0,1438,1439,5,40,0,0,1439,1442,3,100,50,0,1440,1441,5,91,0,0,1441,
	1443,3,100,50,0,1442,1440,1,0,0,0,1442,1443,1,0,0,0,1443,151,1,0,0,0,1444,
	1451,3,168,84,0,1445,1451,3,170,85,0,1446,1451,3,160,80,0,1447,1451,3,154,
	77,0,1448,1451,3,156,78,0,1449,1451,3,158,79,0,1450,1444,1,0,0,0,1450,1445,
	1,0,0,0,1450,1446,1,0,0,0,1450,1447,1,0,0,0,1450,1448,1,0,0,0,1450,1449,
	1,0,0,0,1451,153,1,0,0,0,1452,1453,5,9,0,0,1453,1454,5,39,0,0,1454,1455,
	3,230,115,0,1455,1456,5,173,0,0,1456,1457,5,5,0,0,1457,1458,3,230,115,0,
	1458,1459,5,173,0,0,1459,1460,5,92,0,0,1460,1461,5,70,0,0,1461,1462,5,12,
	0,0,1462,1463,5,173,0,0,1463,1464,5,12,0,0,1464,1465,5,93,0,0,1465,1466,
	5,40,0,0,1466,1467,3,100,50,0,1467,155,1,0,0,0,1468,1469,5,9,0,0,1469,1470,
	5,39,0,0,1470,1471,3,230,115,0,1471,1472,5,173,0,0,1472,1473,5,94,0,0,1473,
	1474,5,70,0,0,1474,1475,5,12,0,0,1475,1476,5,173,0,0,1476,1477,5,40,0,0,
	1477,1478,3,100,50,0,1478,157,1,0,0,0,1479,1480,5,9,0,0,1480,1481,5,39,
	0,0,1481,1482,3,230,115,0,1482,1483,5,173,0,0,1483,1484,5,92,0,0,1484,1485,
	5,70,0,0,1485,1486,5,12,0,0,1486,1487,5,173,0,0,1487,1488,5,40,0,0,1488,
	1489,3,100,50,0,1489,159,1,0,0,0,1490,1491,5,9,0,0,1491,1492,5,39,0,0,1492,
	1493,3,162,81,0,1493,1494,3,164,82,0,1494,1495,3,166,83,0,1495,1496,5,40,
	0,0,1496,1497,3,100,50,0,1497,161,1,0,0,0,1498,1502,3,230,115,0,1499,1501,
	3,222,111,0,1500,1499,1,0,0,0,1501,1504,1,0,0,0,1502,1500,1,0,0,0,1502,
	1503,1,0,0,0,1503,1505,1,0,0,0,1504,1502,1,0,0,0,1505,1506,5,173,0,0,1506,
	1507,5,30,0,0,1507,1508,3,218,109,0,1508,1509,5,2,0,0,1509,163,1,0,0,0,
	1510,1511,3,218,109,0,1511,1512,5,2,0,0,1512,165,1,0,0,0,1513,1514,5,173,
	0,0,1514,1515,7,5,0,0,1515,1519,3,218,109,0,1516,1517,5,173,0,0,1517,1519,
	7,6,0,0,1518,1513,1,0,0,0,1518,1516,1,0,0,0,1519,167,1,0,0,0,1520,1521,
	5,95,0,0,1521,1522,3,100,50,0,1522,1523,5,96,0,0,1523,1524,5,39,0,0,1524,
	1525,3,218,109,0,1525,1526,5,40,0,0,1526,1527,5,2,0,0,1527,169,1,0,0,0,
	1528,1529,5,96,0,0,1529,1530,5,39,0,0,1530,1531,3,218,109,0,1531,1532,5,
	40,0,0,1532,1533,3,100,50,0,1533,171,1,0,0,0,1534,1535,5,97,0,0,1535,1536,
	3,204,102,0,1536,1537,5,2,0,0,1537,173,1,0,0,0,1538,1539,5,98,0,0,1539,
	1543,5,4,0,0,1540,1542,3,176,88,0,1541,1540,1,0,0,0,1542,1545,1,0,0,0,1543,
	1541,1,0,0,0,1543,1544,1,0,0,0,1544,1546,1,0,0,0,1545,1543,1,0,0,0,1546,
	1547,5,6,0,0,1547,175,1,0,0,0,1548,1549,7,7,0,0,1549,177,1,0,0,0,1550,1551,
	5,99,0,0,1551,1555,5,4,0,0,1552,1554,3,102,51,0,1553,1552,1,0,0,0,1554,
	1557,1,0,0,0,1555,1553,1,0,0,0,1555,1556,1,0,0,0,1556,1558,1,0,0,0,1557,
	1555,1,0,0,0,1558,1559,5,6,0,0,1559,179,1,0,0,0,1560,1561,5,100,0,0,1561,
	1562,5,39,0,0,1562,1563,3,218,109,0,1563,1564,5,40,0,0,1564,1568,5,4,0,
	0,1565,1567,3,182,91,0,1566,1565,1,0,0,0,1567,1570,1,0,0,0,1568,1566,1,
	0,0,0,1568,1569,1,0,0,0,1569,1572,1,0,0,0,1570,1568,1,0,0,0,1571,1573,3,
	184,92,0,1572,1571,1,0,0,0,1572,1573,1,0,0,0,1573,1574,1,0,0,0,1574,1575,
	5,6,0,0,1575,181,1,0,0,0,1576,1577,5,101,0,0,1577,1578,3,218,109,0,1578,
	1582,5,102,0,0,1579,1581,3,102,51,0,1580,1579,1,0,0,0,1581,1584,1,0,0,0,
	1582,1580,1,0,0,0,1582,1583,1,0,0,0,1583,183,1,0,0,0,1584,1582,1,0,0,0,
	1585,1586,5,103,0,0,1586,1590,5,102,0,0,1587,1589,3,102,51,0,1588,1587,
	1,0,0,0,1589,1592,1,0,0,0,1590,1588,1,0,0,0,1590,1591,1,0,0,0,1591,185,
	1,0,0,0,1592,1590,1,0,0,0,1593,1594,5,104,0,0,1594,1596,3,218,109,0,1595,
	1597,3,188,94,0,1596,1595,1,0,0,0,1596,1597,1,0,0,0,1597,1598,1,0,0,0,1598,
	1600,3,100,50,0,1599,1601,3,190,95,0,1600,1599,1,0,0,0,1601,1602,1,0,0,
	0,1602,1600,1,0,0,0,1602,1603,1,0,0,0,1603,187,1,0,0,0,1604,1605,5,69,0,
	0,1605,1617,5,39,0,0,1606,1611,3,98,49,0,1607,1608,5,5,0,0,1608,1610,3,
	98,49,0,1609,1607,1,0,0,0,1610,1613,1,0,0,0,1611,1609,1,0,0,0,1611,1612,
	1,0,0,0,1612,1615,1,0,0,0,1613,1611,1,0,0,0,1614,1616,5,5,0,0,1615,1614,
	1,0,0,0,1615,1616,1,0,0,0,1616,1618,1,0,0,0,1617,1606,1,0,0,0,1617,1618,
	1,0,0,0,1618,1619,1,0,0,0,1619,1620,5,40,0,0,1620,189,1,0,0,0,1621,1623,
	5,105,0,0,1622,1624,5,173,0,0,1623,1622,1,0,0,0,1623,1624,1,0,0,0,1624,
	1640,1,0,0,0,1625,1637,5,39,0,0,1626,1631,3,98,49,0,1627,1628,5,5,0,0,1628,
	1630,3,98,49,0,1629,1627,1,0,0,0,1630,1633,1,0,0,0,1631,1629,1,0,0,0,1631,
	1632,1,0,0,0,1632,1635,1,0,0,0,1633,1631,1,0,0,0,1634,1636,5,5,0,0,1635,
	1634,1,0,0,0,1635,1636,1,0,0,0,1636,1638,1,0,0,0,1637,1626,1,0,0,0,1637,
	1638,1,0,0,0,1638,1639,1,0,0,0,1639,1641,5,40,0,0,1640,1625,1,0,0,0,1640,
	1641,1,0,0,0,1641,1642,1,0,0,0,1642,1643,3,100,50,0,1643,191,1,0,0,0,1644,
	1645,5,106,0,0,1645,1646,5,2,0,0,1646,193,1,0,0,0,1647,1648,5,107,0,0,1648,
	1649,5,2,0,0,1649,195,1,0,0,0,1650,1654,5,161,0,0,1651,1652,5,173,0,0,1652,
	1654,3,210,105,0,1653,1650,1,0,0,0,1653,1651,1,0,0,0,1654,197,1,0,0,0,1655,
	1656,5,108,0,0,1656,1657,5,173,0,0,1657,1658,3,210,105,0,1658,1659,5,2,
	0,0,1659,1670,1,0,0,0,1660,1661,5,108,0,0,1661,1662,5,39,0,0,1662,1663,
	5,161,0,0,1663,1664,5,40,0,0,1664,1670,5,2,0,0,1665,1666,5,108,0,0,1666,
	1667,5,39,0,0,1667,1668,5,40,0,0,1668,1670,5,2,0,0,1669,1655,1,0,0,0,1669,
	1660,1,0,0,0,1669,1665,1,0,0,0,1670,199,1,0,0,0,1671,1672,5,109,0,0,1672,
	1673,5,39,0,0,1673,1674,3,218,109,0,1674,1675,5,40,0,0,1675,1676,5,2,0,
	0,1676,201,1,0,0,0,1677,1680,5,173,0,0,1678,1680,3,224,112,0,1679,1677,
	1,0,0,0,1679,1678,1,0,0,0,1680,203,1,0,0,0,1681,1693,5,39,0,0,1682,1687,
	3,202,101,0,1683,1684,5,5,0,0,1684,1686,3,202,101,0,1685,1683,1,0,0,0,1686,
	1689,1,0,0,0,1687,1685,1,0,0,0,1687,1688,1,0,0,0,1688,1691,1,0,0,0,1689,
	1687,1,0,0,0,1690,1692,5,5,0,0,1691,1690,1,0,0,0,1691,1692,1,0,0,0,1692,
	1694,1,0,0,0,1693,1682,1,0,0,0,1693,1694,1,0,0,0,1694,1695,1,0,0,0,1695,
	1696,5,40,0,0,1696,205,1,0,0,0,1697,1698,5,173,0,0,1698,1722,3,210,105,
	0,1699,1700,5,173,0,0,1700,1701,5,12,0,0,1701,1702,5,173,0,0,1702,1722,
	3,210,105,0,1703,1704,5,173,0,0,1704,1705,5,39,0,0,1705,1717,5,4,0,0,1706,
	1711,3,208,104,0,1707,1708,5,5,0,0,1708,1710,3,208,104,0,1709,1707,1,0,
	0,0,1710,1713,1,0,0,0,1711,1709,1,0,0,0,1711,1712,1,0,0,0,1712,1715,1,0,
	0,0,1713,1711,1,0,0,0,1714,1716,5,5,0,0,1715,1714,1,0,0,0,1715,1716,1,0,
	0,0,1716,1718,1,0,0,0,1717,1706,1,0,0,0,1717,1718,1,0,0,0,1718,1719,1,0,
	0,0,1719,1720,5,6,0,0,1720,1722,5,40,0,0,1721,1697,1,0,0,0,1721,1699,1,
	0,0,0,1721,1703,1,0,0,0,1722,207,1,0,0,0,1723,1724,5,173,0,0,1724,1725,
	5,102,0,0,1725,1726,3,218,109,0,1726,209,1,0,0,0,1727,1739,5,39,0,0,1728,
	1733,3,218,109,0,1729,1730,5,5,0,0,1730,1732,3,218,109,0,1731,1729,1,0,
	0,0,1732,1735,1,0,0,0,1733,1731,1,0,0,0,1733,1734,1,0,0,0,1734,1737,1,0,
	0,0,1735,1733,1,0,0,0,1736,1738,5,5,0,0,1737,1736,1,0,0,0,1737,1738,1,0,
	0,0,1738,1740,1,0,0,0,1739,1728,1,0,0,0,1739,1740,1,0,0,0,1740,1741,1,0,
	0,0,1741,1742,5,40,0,0,1742,211,1,0,0,0,1743,1744,5,4,0,0,1744,1749,3,214,
	107,0,1745,1746,5,5,0,0,1746,1748,3,214,107,0,1747,1745,1,0,0,0,1748,1751,
	1,0,0,0,1749,1747,1,0,0,0,1749,1750,1,0,0,0,1750,1753,1,0,0,0,1751,1749,
	1,0,0,0,1752,1754,5,5,0,0,1753,1752,1,0,0,0,1753,1754,1,0,0,0,1754,1755,
	1,0,0,0,1755,1756,5,6,0,0,1756,213,1,0,0,0,1757,1758,5,173,0,0,1758,1759,
	5,102,0,0,1759,1760,3,218,109,0,1760,215,1,0,0,0,1761,1762,5,39,0,0,1762,
	1767,3,230,115,0,1763,1764,5,5,0,0,1764,1766,3,230,115,0,1765,1763,1,0,
	0,0,1766,1769,1,0,0,0,1767,1765,1,0,0,0,1767,1768,1,0,0,0,1768,1771,1,0,
	0,0,1769,1767,1,0,0,0,1770,1772,5,5,0,0,1771,1770,1,0,0,0,1771,1772,1,0,
	0,0,1772,1773,1,0,0,0,1773,1774,5,40,0,0,1774,217,1,0,0,0,1775,1776,6,109,
	-1,0,1776,1777,5,39,0,0,1777,1778,3,218,109,0,1778,1779,5,40,0,0,1779,1904,
	1,0,0,0,1780,1781,3,232,116,0,1781,1782,5,39,0,0,1782,1784,3,218,109,0,
	1783,1785,5,5,0,0,1784,1783,1,0,0,0,1784,1785,1,0,0,0,1785,1786,1,0,0,0,
	1786,1787,5,40,0,0,1787,1904,1,0,0,0,1788,1904,3,206,103,0,1789,1790,5,
	110,0,0,1790,1792,5,173,0,0,1791,1793,3,212,106,0,1792,1791,1,0,0,0,1792,
	1793,1,0,0,0,1793,1794,1,0,0,0,1794,1904,3,210,105,0,1795,1796,5,110,0,
	0,1796,1797,3,230,115,0,1797,1798,5,58,0,0,1798,1799,5,59,0,0,1799,1800,
	5,39,0,0,1800,1801,3,218,109,0,1801,1802,5,40,0,0,1802,1904,1,0,0,0,1803,
	1804,5,46,0,0,1804,1805,5,39,0,0,1805,1806,3,230,115,0,1806,1807,5,40,0,
	0,1807,1808,5,12,0,0,1808,1809,5,173,0,0,1809,1904,1,0,0,0,1810,1811,5,
	111,0,0,1811,1904,3,210,105,0,1812,1813,5,112,0,0,1813,1904,3,210,105,0,
	1814,1815,5,113,0,0,1815,1904,3,210,105,0,1816,1817,5,114,0,0,1817,1904,
	3,210,105,0,1818,1819,5,115,0,0,1819,1820,5,39,0,0,1820,1821,5,173,0,0,
	1821,1822,5,12,0,0,1822,1823,5,173,0,0,1823,1824,5,5,0,0,1824,1825,3,210,
	105,0,1825,1826,5,40,0,0,1826,1904,1,0,0,0,1827,1828,5,116,0,0,1828,1904,
	3,210,105,0,1829,1830,5,117,0,0,1830,1904,3,210,105,0,1831,1832,5,118,0,
	0,1832,1833,5,39,0,0,1833,1834,3,218,109,0,1834,1835,5,5,0,0,1835,1836,
	3,216,108,0,1836,1837,5,40,0,0,1837,1904,1,0,0,0,1838,1839,5,119,0,0,1839,
	1840,5,39,0,0,1840,1841,3,218,109,0,1841,1842,5,5,0,0,1842,1843,3,216,108,
	0,1843,1844,5,5,0,0,1844,1845,5,154,0,0,1845,1846,5,40,0,0,1846,1904,1,
	0,0,0,1847,1848,5,120,0,0,1848,1849,5,58,0,0,1849,1850,3,218,109,0,1850,
	1851,5,59,0,0,1851,1852,7,8,0,0,1852,1904,1,0,0,0,1853,1854,5,126,0,0,1854,
	1855,5,58,0,0,1855,1856,3,218,109,0,1856,1857,5,59,0,0,1857,1858,7,9,0,
	0,1858,1904,1,0,0,0,1859,1860,7,10,0,0,1860,1904,3,218,109,20,1861,1873,
	5,58,0,0,1862,1867,3,218,109,0,1863,1864,5,5,0,0,1864,1866,3,218,109,0,
	1865,1863,1,0,0,0,1866,1869,1,0,0,0,1867,1865,1,0,0,0,1867,1868,1,0,0,0,
	1868,1871,1,0,0,0,1869,1867,1,0,0,0,1870,1872,5,5,0,0,1871,1870,1,0,0,0,
	1871,1872,1,0,0,0,1872,1874,1,0,0,0,1873,1862,1,0,0,0,1873,1874,1,0,0,0,
	1874,1875,1,0,0,0,1875,1904,5,59,0,0,1876,1877,5,70,0,0,1877,1878,5,12,
	0,0,1878,1879,5,173,0,0,1879,1880,5,12,0,0,1880,1881,5,173,0,0,1881,1882,
	5,58,0,0,1882,1883,3,218,109,0,1883,1884,5,59,0,0,1884,1885,3,220,110,0,
	1885,1904,1,0,0,0,1886,1887,5,70,0,0,1887,1888,5,12,0,0,1888,1893,5,173,
	0,0,1889,1890,5,58,0,0,1890,1891,3,218,109,0,1891,1892,5,59,0,0,1892,1894,
	1,0,0,0,1893,1889,1,0,0,0,1894,1895,1,0,0,0,1895,1893,1,0,0,0,1895,1896,
	1,0,0,0,1896,1904,1,0,0,0,1897,1898,5,70,0,0,1898,1899,5,12,0,0,1899,1904,
	5,173,0,0,1900,1904,5,170,0,0,1901,1904,5,173,0,0,1902,1904,3,224,112,0,
	1903,1775,1,0,0,0,1903,1780,1,0,0,0,1903,1788,1,0,0,0,1903,1789,1,0,0,0,
	1903,1795,1,0,0,0,1903,1803,1,0,0,0,1903,1810,1,0,0,0,1903,1812,1,0,0,0,
	1903,1814,1,0,0,0,1903,1816,1,0,0,0,1903,1818,1,0,0,0,1903,1827,1,0,0,0,
	1903,1829,1,0,0,0,1903,1831,1,0,0,0,1903,1838,1,0,0,0,1903,1847,1,0,0,0,
	1903,1853,1,0,0,0,1903,1859,1,0,0,0,1903,1861,1,0,0,0,1903,1876,1,0,0,0,
	1903,1886,1,0,0,0,1903,1897,1,0,0,0,1903,1900,1,0,0,0,1903,1901,1,0,0,0,
	1903,1902,1,0,0,0,1904,1987,1,0,0,0,1905,1906,10,19,0,0,1906,1907,5,17,
	0,0,1907,1986,3,218,109,19,1908,1909,10,18,0,0,1909,1910,7,11,0,0,1910,
	1986,3,218,109,19,1911,1912,10,17,0,0,1912,1913,7,12,0,0,1913,1986,3,218,
	109,18,1914,1915,10,16,0,0,1915,1916,7,13,0,0,1916,1986,3,218,109,17,1917,
	1918,10,15,0,0,1918,1919,7,14,0,0,1919,1986,3,218,109,16,1920,1921,10,14,
	0,0,1921,1922,7,15,0,0,1922,1986,3,218,109,15,1923,1924,10,13,0,0,1924,
	1925,5,24,0,0,1925,1986,3,218,109,14,1926,1927,10,12,0,0,1927,1928,5,26,
	0,0,1928,1986,3,218,109,13,1929,1930,10,11,0,0,1930,1931,5,25,0,0,1931,
	1986,3,218,109,12,1932,1933,10,10,0,0,1933,1934,5,138,0,0,1934,1986,3,218,
	109,11,1935,1936,10,9,0,0,1936,1937,5,139,0,0,1937,1986,3,218,109,10,1938,
	1939,10,8,0,0,1939,1940,5,140,0,0,1940,1941,3,218,109,0,1941,1942,5,102,
	0,0,1942,1943,3,218,109,8,1943,1986,1,0,0,0,1944,1945,10,30,0,0,1945,1946,
	5,58,0,0,1946,1947,3,218,109,0,1947,1948,5,102,0,0,1948,1949,3,218,109,
	0,1949,1950,5,59,0,0,1950,1986,1,0,0,0,1951,1952,10,29,0,0,1952,1953,5,
	58,0,0,1953,1954,5,154,0,0,1954,1986,5,59,0,0,1955,1956,10,28,0,0,1956,
	1957,5,58,0,0,1957,1958,3,218,109,0,1958,1959,5,59,0,0,1959,1986,1,0,0,
	0,1960,1961,10,25,0,0,1961,1986,7,16,0,0,1962,1963,10,24,0,0,1963,1964,
	5,133,0,0,1964,1965,5,39,0,0,1965,1966,3,218,109,0,1966,1967,5,40,0,0,1967,
	1986,1,0,0,0,1968,1969,10,23,0,0,1969,1970,5,134,0,0,1970,1971,5,39,0,0,
	1971,1972,3,218,109,0,1972,1973,5,5,0,0,1973,1974,3,218,109,0,1974,1975,
	5,40,0,0,1975,1986,1,0,0,0,1976,1977,10,22,0,0,1977,1978,5,12,0,0,1978,
	1980,5,173,0,0,1979,1981,3,212,106,0,1980,1979,1,0,0,0,1980,1981,1,0,0,
	0,1981,1982,1,0,0,0,1982,1986,3,210,105,0,1983,1984,10,21,0,0,1984,1986,
	3,220,110,0,1985,1905,1,0,0,0,1985,1908,1,0,0,0,1985,1911,1,0,0,0,1985,
	1914,1,0,0,0,1985,1917,1,0,0,0,1985,1920,1,0,0,0,1985,1923,1,0,0,0,1985,
	1926,1,0,0,0,1985,1929,1,0,0,0,1985,1932,1,0,0,0,1985,1935,1,0,0,0,1985,
	1938,1,0,0,0,1985,1944,1,0,0,0,1985,1951,1,0,0,0,1985,1955,1,0,0,0,1985,
	1960,1,0,0,0,1985,1962,1,0,0,0,1985,1968,1,0,0,0,1985,1976,1,0,0,0,1985,
	1983,1,0,0,0,1986,1989,1,0,0,0,1987,1985,1,0,0,0,1987,1988,1,0,0,0,1988,
	219,1,0,0,0,1989,1987,1,0,0,0,1990,1991,5,12,0,0,1991,2004,5,173,0,0,1992,
	2004,5,121,0,0,1993,2004,5,122,0,0,1994,2004,5,123,0,0,1995,2004,5,124,
	0,0,1996,2004,5,125,0,0,1997,2004,5,127,0,0,1998,2004,5,128,0,0,1999,2004,
	5,129,0,0,2000,2004,5,130,0,0,2001,2004,5,141,0,0,2002,2004,5,142,0,0,2003,
	1990,1,0,0,0,2003,1992,1,0,0,0,2003,1993,1,0,0,0,2003,1994,1,0,0,0,2003,
	1995,1,0,0,0,2003,1996,1,0,0,0,2003,1997,1,0,0,0,2003,1998,1,0,0,0,2003,
	1999,1,0,0,0,2003,2000,1,0,0,0,2003,2001,1,0,0,0,2003,2002,1,0,0,0,2004,
	221,1,0,0,0,2005,2006,7,17,0,0,2006,223,1,0,0,0,2007,2022,5,151,0,0,2008,
	2022,3,226,113,0,2009,2022,3,228,114,0,2010,2014,5,161,0,0,2011,2013,5,
	161,0,0,2012,2011,1,0,0,0,2013,2016,1,0,0,0,2014,2012,1,0,0,0,2014,2015,
	1,0,0,0,2015,2022,1,0,0,0,2016,2014,1,0,0,0,2017,2022,5,171,0,0,2018,2022,
	5,172,0,0,2019,2022,5,162,0,0,2020,2022,5,163,0,0,2021,2007,1,0,0,0,2021,
	2008,1,0,0,0,2021,2009,1,0,0,0,2021,2010,1,0,0,0,2021,2017,1,0,0,0,2021,
	2018,1,0,0,0,2021,2019,1,0,0,0,2021,2020,1,0,0,0,2022,225,1,0,0,0,2023,
	2025,5,154,0,0,2024,2026,5,152,0,0,2025,2024,1,0,0,0,2025,2026,1,0,0,0,
	2026,227,1,0,0,0,2027,2028,5,153,0,0,2028,229,1,0,0,0,2029,2030,5,147,0,
	0,2030,2043,5,50,0,0,2031,2043,5,147,0,0,2032,2043,5,157,0,0,2033,2043,
	5,159,0,0,2034,2043,5,158,0,0,2035,2043,5,166,0,0,2036,2043,5,167,0,0,2037,
	2043,5,148,0,0,2038,2043,5,149,0,0,2039,2043,5,168,0,0,2040,2043,5,169,
	0,0,2041,2043,5,173,0,0,2042,2029,1,0,0,0,2042,2031,1,0,0,0,2042,2032,1,
	0,0,0,2042,2033,1,0,0,0,2042,2034,1,0,0,0,2042,2035,1,0,0,0,2042,2036,1,
	0,0,0,2042,2037,1,0,0,0,2042,2038,1,0,0,0,2042,2039,1,0,0,0,2042,2040,1,
	0,0,0,2042,2041,1,0,0,0,2043,231,1,0,0,0,2044,2045,7,18,0,0,2045,233,1,
	0,0,0,201,237,243,249,255,261,267,273,279,285,291,297,302,321,325,332,337,
	343,349,359,362,372,376,382,385,389,394,398,411,414,428,431,437,443,449,
	455,461,467,473,488,501,511,517,523,529,535,541,547,552,560,563,569,575,
	581,587,593,599,605,611,617,621,625,627,631,634,644,650,654,666,670,672,
	676,682,694,698,700,714,730,734,741,761,768,779,785,792,808,817,823,834,
	841,847,854,860,866,870,878,883,891,901,906,910,922,931,933,939,945,952,
	963,969,973,979,986,1002,1008,1016,1024,1029,1033,1043,1047,1049,1057,1066,
	1071,1077,1082,1117,1143,1155,1167,1171,1176,1195,1200,1206,1225,1240,1257,
	1277,1289,1297,1307,1319,1326,1332,1342,1407,1411,1420,1430,1442,1450,1502,
	1518,1543,1555,1568,1572,1582,1590,1596,1602,1611,1615,1617,1623,1631,1635,
	1637,1640,1653,1669,1679,1687,1691,1693,1711,1715,1717,1721,1733,1737,1739,
	1749,1753,1767,1771,1784,1792,1867,1871,1873,1895,1903,1980,1985,1987,2003,
	2014,2021,2025,2042];

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
	public typeName_list(): TypeNameContext[] {
		return this.getTypedRuleContexts(TypeNameContext) as TypeNameContext[];
	}
	public typeName(i: number): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, i) as TypeNameContext;
	}
	public modifier_list(): ModifierContext[] {
		return this.getTypedRuleContexts(ModifierContext) as ModifierContext[];
	}
	public modifier(i: number): ModifierContext {
		return this.getTypedRuleContext(ModifierContext, i) as ModifierContext;
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
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
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
