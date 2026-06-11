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
	public static readonly VersionLiteral = 142;
	public static readonly BooleanLiteral = 143;
	public static readonly NumberUnit = 144;
	public static readonly DecimalLiteral = 145;
	public static readonly NumberLiteral = 146;
	public static readonly NumberPart = 147;
	public static readonly ExponentPart = 148;
	public static readonly PrimitiveType = 149;
	public static readonly UnboundedBytes = 150;
	public static readonly BoundedBytes = 151;
	public static readonly Bound = 152;
	public static readonly StringLiteral = 153;
	public static readonly DateLiteral = 154;
	public static readonly HexLiteral = 155;
	public static readonly TxVar = 156;
	public static readonly UnsafeCast = 157;
	public static readonly BoundedSignedInt = 158;
	public static readonly BoundedUnsignedInt = 159;
	public static readonly BoundedSignedFixed = 160;
	public static readonly BoundedUnsignedFixed = 161;
	public static readonly NullaryOp = 162;
	public static readonly UnicodeLiteral = 163;
	public static readonly HexStringLiteral = 164;
	public static readonly Identifier = 165;
	public static readonly WHITESPACE = 166;
	public static readonly COMMENT = 167;
	public static readonly LINE_COMMENT = 168;
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
	public static readonly RULE_assignStatement = 64;
	public static readonly RULE_arrayPushStatement = 65;
	public static readonly RULE_arrayPopStatement = 66;
	public static readonly RULE_arrayAssignStatement = 67;
	public static readonly RULE_arrayDeleteStatement = 68;
	public static readonly RULE_stateArrayPushStatement = 69;
	public static readonly RULE_stateArrayPopStatement = 70;
	public static readonly RULE_deleteStatement = 71;
	public static readonly RULE_timeOpStatement = 72;
	public static readonly RULE_requireStatement = 73;
	public static readonly RULE_ifStatement = 74;
	public static readonly RULE_loopStatement = 75;
	public static readonly RULE_forOfEntriesStatement = 76;
	public static readonly RULE_forInStatement = 77;
	public static readonly RULE_forOfStatement = 78;
	public static readonly RULE_forStatement = 79;
	public static readonly RULE_forInit = 80;
	public static readonly RULE_forCondition = 81;
	public static readonly RULE_forUpdate = 82;
	public static readonly RULE_doWhileStatement = 83;
	public static readonly RULE_whileStatement = 84;
	public static readonly RULE_consoleStatement = 85;
	public static readonly RULE_assemblyStatement = 86;
	public static readonly RULE_assemblyToken = 87;
	public static readonly RULE_uncheckedStatement = 88;
	public static readonly RULE_switchStatement = 89;
	public static readonly RULE_switchCase = 90;
	public static readonly RULE_switchDefault = 91;
	public static readonly RULE_tryCatchStatement = 92;
	public static readonly RULE_tryReturns = 93;
	public static readonly RULE_catchClause = 94;
	public static readonly RULE_breakStatement = 95;
	public static readonly RULE_continueStatement = 96;
	public static readonly RULE_requireMessage = 97;
	public static readonly RULE_revertStatement = 98;
	public static readonly RULE_assertStatement = 99;
	public static readonly RULE_consoleParameter = 100;
	public static readonly RULE_consoleParameterList = 101;
	public static readonly RULE_functionCall = 102;
	public static readonly RULE_namedArg = 103;
	public static readonly RULE_expressionList = 104;
	public static readonly RULE_callOptions = 105;
	public static readonly RULE_callOption = 106;
	public static readonly RULE_typeList = 107;
	public static readonly RULE_expression = 108;
	public static readonly RULE_memberName = 109;
	public static readonly RULE_modifier = 110;
	public static readonly RULE_literal = 111;
	public static readonly RULE_numberLiteral = 112;
	public static readonly RULE_decimalLiteral = 113;
	public static readonly RULE_typeName = 114;
	public static readonly RULE_typeCast = 115;
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
		"tupleAssignment", "assignStatement", "arrayPushStatement", "arrayPopStatement", 
		"arrayAssignStatement", "arrayDeleteStatement", "stateArrayPushStatement", 
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
			this.state = 235;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===28) {
				{
				{
				this.state = 232;
				this.pragmaDirective();
				}
				}
				this.state = 237;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 241;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===1) {
				{
				{
				this.state = 238;
				this.importDirective();
				}
				}
				this.state = 243;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 247;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 74980359) !== 0)) {
				{
				{
				this.state = 244;
				this.constantDefinition();
				}
				}
				this.state = 249;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 253;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===45) {
				{
				{
				this.state = 250;
				this.enumDefinition();
				}
				}
				this.state = 255;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 259;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===44) {
				{
				{
				this.state = 256;
				this.structDefinition();
				}
				}
				this.state = 261;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 265;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===46) {
				{
				{
				this.state = 262;
				this.typeDefinition();
				}
				}
				this.state = 267;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 271;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===8) {
				{
				{
				this.state = 268;
				this.usingForDirective();
				}
				}
				this.state = 273;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 277;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===43) {
				{
				{
				this.state = 274;
				this.errorDefinition();
				}
				}
				this.state = 279;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 283;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===31) {
				{
				{
				this.state = 280;
				this.interfaceDefinition();
				}
				}
				this.state = 285;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 289;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 286;
				this.freeFunctionDefinition();
				}
				}
				this.state = 291;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 295;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 10, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 292;
					this.libraryDefinition();
					}
					}
				}
				this.state = 297;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 10, this._ctx);
			}
			this.state = 300;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 36:
			case 37:
				{
				this.state = 298;
				this.contractDefinition();
				}
				break;
			case 35:
				{
				this.state = 299;
				this.libraryDefinition();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
			this.state = 302;
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
			this.state = 330;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 14, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 304;
				this.match(SolidCashParser.T__0);
				this.state = 305;
				this.match(SolidCashParser.StringLiteral);
				this.state = 306;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 307;
				this.match(SolidCashParser.T__0);
				this.state = 308;
				this.match(SolidCashParser.StringLiteral);
				this.state = 309;
				this.match(SolidCashParser.T__2);
				this.state = 310;
				this.match(SolidCashParser.Identifier);
				this.state = 311;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 312;
				this.match(SolidCashParser.T__0);
				this.state = 313;
				this.match(SolidCashParser.T__3);
				this.state = 314;
				this.importBinding();
				this.state = 319;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 12, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 315;
						this.match(SolidCashParser.T__4);
						this.state = 316;
						this.importBinding();
						}
						}
					}
					this.state = 321;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 12, this._ctx);
				}
				this.state = 323;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 322;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 325;
				this.match(SolidCashParser.T__5);
				this.state = 326;
				this.match(SolidCashParser.Identifier);
				this.state = 327;
				this.match(SolidCashParser.StringLiteral);
				this.state = 328;
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
			this.state = 332;
			this.match(SolidCashParser.Identifier);
			this.state = 335;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 333;
				this.match(SolidCashParser.T__2);
				this.state = 334;
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
			this.state = 337;
			this.match(SolidCashParser.T__6);
			this.state = 338;
			this.match(SolidCashParser.Identifier);
			this.state = 339;
			this.parameterList();
			this.state = 341;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 340;
				this.returnType();
				}
			}

			this.state = 343;
			this.match(SolidCashParser.T__3);
			this.state = 347;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 4198436355) !== 0) || ((((_la - 103)) & ~0x1F) === 0 && ((1 << (_la - 103)) & 16811007) !== 0) || ((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 134077655) !== 0)) {
				{
				{
				this.state = 344;
				this.statement();
				}
				}
				this.state = 349;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 350;
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
			this.state = 387;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 24, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 352;
				this.match(SolidCashParser.T__7);
				this.state = 353;
				this.match(SolidCashParser.Identifier);
				this.state = 354;
				this.match(SolidCashParser.T__8);
				this.state = 357;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 139:
				case 140:
				case 141:
				case 149:
				case 150:
				case 151:
				case 158:
				case 159:
				case 160:
				case 161:
				case 165:
					{
					this.state = 355;
					this.typeName();
					}
					break;
				case 10:
					{
					this.state = 356;
					this.match(SolidCashParser.T__9);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 360;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 359;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 362;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 363;
				this.match(SolidCashParser.T__7);
				this.state = 364;
				this.match(SolidCashParser.T__3);
				this.state = 365;
				this.usingFunctionBinding();
				this.state = 370;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 20, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 366;
						this.match(SolidCashParser.T__4);
						this.state = 367;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 372;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 20, this._ctx);
				}
				this.state = 374;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 373;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 376;
				this.match(SolidCashParser.T__5);
				this.state = 377;
				this.match(SolidCashParser.T__8);
				this.state = 380;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 139:
				case 140:
				case 141:
				case 149:
				case 150:
				case 151:
				case 158:
				case 159:
				case 160:
				case 161:
				case 165:
					{
					this.state = 378;
					this.typeName();
					}
					break;
				case 10:
					{
					this.state = 379;
					this.match(SolidCashParser.T__9);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 383;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 382;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 385;
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
			this.state = 389;
			this.match(SolidCashParser.Identifier);
			this.state = 392;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===12) {
				{
				this.state = 390;
				this.match(SolidCashParser.T__11);
				this.state = 391;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 396;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 394;
				this.match(SolidCashParser.T__2);
				this.state = 395;
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
			this.state = 398;
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
			this.state = 400;
			this.match(SolidCashParser.T__27);
			this.state = 401;
			this.pragmaName();
			this.state = 402;
			this.pragmaValue();
			this.state = 403;
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
			this.state = 405;
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
			this.state = 407;
			this.versionConstraint();
			this.state = 409;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 1290797056) !== 0) || _la===142) {
				{
				this.state = 408;
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
			this.state = 412;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 1290797056) !== 0)) {
				{
				this.state = 411;
				this.versionOperator();
				}
			}

			this.state = 414;
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
			this.state = 416;
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
			this.state = 418;
			this.match(SolidCashParser.T__30);
			this.state = 419;
			this.match(SolidCashParser.Identifier);
			this.state = 429;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===32) {
				{
				this.state = 420;
				this.match(SolidCashParser.T__31);
				this.state = 421;
				this.match(SolidCashParser.Identifier);
				this.state = 426;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 422;
					this.match(SolidCashParser.T__4);
					this.state = 423;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 428;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 431;
			this.match(SolidCashParser.T__3);
			this.state = 435;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===45) {
				{
				{
				this.state = 432;
				this.enumDefinition();
				}
				}
				this.state = 437;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 441;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===44) {
				{
				{
				this.state = 438;
				this.structDefinition();
				}
				}
				this.state = 443;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 447;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===46) {
				{
				{
				this.state = 444;
				this.typeDefinition();
				}
				}
				this.state = 449;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 453;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===38) {
				{
				{
				this.state = 450;
				this.eventDefinition();
				}
				}
				this.state = 455;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 459;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 35, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 456;
					this.interfaceStateVariable();
					}
					}
				}
				this.state = 461;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 35, this._ctx);
			}
			this.state = 465;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===33 || _la===34) {
				{
				{
				this.state = 462;
				this.interfaceCollection();
				}
				}
				this.state = 467;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 471;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 468;
				this.interfaceFunction();
				}
				}
				this.state = 473;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 474;
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
			this.state = 486;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 38, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 476;
				this.interfaceStateVariableVisibility();
				this.state = 477;
				this.mappingType();
				this.state = 478;
				this.match(SolidCashParser.Identifier);
				this.state = 479;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 481;
				this.interfaceStateVariableVisibility();
				this.state = 482;
				this.arrayType(0);
				this.state = 483;
				this.match(SolidCashParser.Identifier);
				this.state = 484;
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
			this.state = 488;
			this.interfaceStateVariableVisibility();
			this.state = 489;
			this.typeName();
			this.state = 490;
			this.match(SolidCashParser.Identifier);
			this.state = 491;
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
			this.state = 493;
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
			this.state = 495;
			this.match(SolidCashParser.T__6);
			this.state = 496;
			this.match(SolidCashParser.Identifier);
			this.state = 497;
			this.parameterList();
			this.state = 499;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 498;
				this.returnType();
				}
			}

			this.state = 501;
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
			this.state = 503;
			this.match(SolidCashParser.T__34);
			this.state = 504;
			this.match(SolidCashParser.Identifier);
			this.state = 505;
			this.match(SolidCashParser.T__3);
			this.state = 509;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===45) {
				{
				{
				this.state = 506;
				this.enumDefinition();
				}
				}
				this.state = 511;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 515;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===44) {
				{
				{
				this.state = 512;
				this.structDefinition();
				}
				}
				this.state = 517;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 521;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===46) {
				{
				{
				this.state = 518;
				this.typeDefinition();
				}
				}
				this.state = 523;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 527;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===38) {
				{
				{
				this.state = 524;
				this.eventDefinition();
				}
				}
				this.state = 529;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 533;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 74980359) !== 0)) {
				{
				{
				this.state = 530;
				this.constantDefinition();
				}
				}
				this.state = 535;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 539;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 536;
				this.freeFunctionDefinition();
				}
				}
				this.state = 541;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 542;
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
			this.state = 545;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===36) {
				{
				this.state = 544;
				this.match(SolidCashParser.T__35);
				}
			}

			this.state = 547;
			this.match(SolidCashParser.T__36);
			this.state = 548;
			this.match(SolidCashParser.Identifier);
			this.state = 550;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===39) {
				{
				this.state = 549;
				this.parameterList();
				}
			}

			this.state = 561;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===32) {
				{
				this.state = 552;
				this.match(SolidCashParser.T__31);
				this.state = 553;
				this.match(SolidCashParser.Identifier);
				this.state = 558;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 554;
					this.match(SolidCashParser.T__4);
					this.state = 555;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 560;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 563;
			this.match(SolidCashParser.T__3);
			this.state = 567;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===45) {
				{
				{
				this.state = 564;
				this.enumDefinition();
				}
				}
				this.state = 569;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 573;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===44) {
				{
				{
				this.state = 570;
				this.structDefinition();
				}
				}
				this.state = 575;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 579;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===46) {
				{
				{
				this.state = 576;
				this.typeDefinition();
				}
				}
				this.state = 581;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 585;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===38) {
				{
				{
				this.state = 582;
				this.eventDefinition();
				}
				}
				this.state = 587;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 591;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===43) {
				{
				{
				this.state = 588;
				this.errorDefinition();
				}
				}
				this.state = 593;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 597;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 55, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 594;
					this.constantDefinition();
					}
					}
				}
				this.state = 599;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 55, this._ctx);
			}
			this.state = 603;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===8) {
				{
				{
				this.state = 600;
				this.usingForDirective();
				}
				}
				this.state = 605;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 609;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 14680067) !== 0) || ((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 74980359) !== 0)) {
				{
				{
				this.state = 606;
				this.stateVariableDeclaration();
				}
				}
				this.state = 611;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 615;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===60) {
				{
				{
				this.state = 612;
				this.modifierDefinition();
				}
				}
				this.state = 617;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 619;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===48) {
				{
				this.state = 618;
				this.constructorDefinition();
				}
			}

			this.state = 625;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				this.state = 623;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 60, this._ctx) ) {
				case 1:
					{
					this.state = 621;
					this.functionDefinition();
					}
					break;
				case 2:
					{
					this.state = 622;
					this.abstractFunctionDefinition();
					}
					break;
				}
				}
				this.state = 627;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 629;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 628;
				this.fallbackDefinition();
				}
			}

			this.state = 632;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===53) {
				{
				this.state = 631;
				this.receiveDefinition();
				}
			}

			this.state = 634;
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
			this.state = 636;
			this.match(SolidCashParser.T__6);
			this.state = 637;
			this.match(SolidCashParser.Identifier);
			this.state = 638;
			this.parameterList();
			this.state = 642;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 3765305347) !== 0) || ((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & 15) !== 0)) {
				{
				{
				this.state = 639;
				this.functionModifier();
				}
				}
				this.state = 644;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 648;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===165) {
				{
				{
				this.state = 645;
				this.customModifierInvocation();
				}
				}
				this.state = 650;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 652;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 651;
				this.returnType();
				}
			}

			this.state = 654;
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
			this.state = 656;
			this.match(SolidCashParser.T__37);
			this.state = 657;
			this.match(SolidCashParser.Identifier);
			this.state = 658;
			this.match(SolidCashParser.T__38);
			this.state = 670;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 74980359) !== 0)) {
				{
				this.state = 659;
				this.eventParameter();
				this.state = 664;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 67, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 660;
						this.match(SolidCashParser.T__4);
						this.state = 661;
						this.eventParameter();
						}
						}
					}
					this.state = 666;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 67, this._ctx);
				}
				this.state = 668;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 667;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 672;
			this.match(SolidCashParser.T__39);
			this.state = 674;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===41) {
				{
				this.state = 673;
				this.match(SolidCashParser.T__40);
				}
			}

			this.state = 676;
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
			this.state = 678;
			this.typeName();
			this.state = 680;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 679;
				this.match(SolidCashParser.T__41);
				}
			}

			this.state = 682;
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
			this.state = 684;
			this.match(SolidCashParser.T__42);
			this.state = 685;
			this.match(SolidCashParser.Identifier);
			this.state = 686;
			this.match(SolidCashParser.T__38);
			this.state = 698;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 74980359) !== 0)) {
				{
				this.state = 687;
				this.errorParameter();
				this.state = 692;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 72, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 688;
						this.match(SolidCashParser.T__4);
						this.state = 689;
						this.errorParameter();
						}
						}
					}
					this.state = 694;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 72, this._ctx);
				}
				this.state = 696;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 695;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 700;
			this.match(SolidCashParser.T__39);
			this.state = 701;
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
			this.state = 703;
			this.typeName();
			this.state = 704;
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
			this.state = 706;
			this.match(SolidCashParser.T__43);
			this.state = 707;
			this.match(SolidCashParser.Identifier);
			this.state = 708;
			this.match(SolidCashParser.T__3);
			this.state = 710;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 709;
				this.structField();
				}
				}
				this.state = 712;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 74980359) !== 0));
			this.state = 714;
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
			this.state = 716;
			this.typeName();
			this.state = 717;
			this.match(SolidCashParser.Identifier);
			this.state = 718;
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
			this.state = 720;
			this.match(SolidCashParser.T__44);
			this.state = 721;
			this.match(SolidCashParser.Identifier);
			this.state = 722;
			this.match(SolidCashParser.T__3);
			this.state = 723;
			this.enumMember();
			this.state = 728;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 76, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 724;
					this.match(SolidCashParser.T__4);
					this.state = 725;
					this.enumMember();
					}
					}
				}
				this.state = 730;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 76, this._ctx);
			}
			this.state = 732;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 731;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 734;
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
			this.state = 736;
			this.match(SolidCashParser.Identifier);
			this.state = 739;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===30) {
				{
				this.state = 737;
				this.match(SolidCashParser.T__29);
				this.state = 738;
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
			this.state = 741;
			this.match(SolidCashParser.T__45);
			this.state = 742;
			this.match(SolidCashParser.Identifier);
			this.state = 743;
			this.match(SolidCashParser.T__31);
			this.state = 744;
			this.typeName();
			this.state = 745;
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
			this.state = 747;
			this.typeName();
			this.state = 748;
			this.match(SolidCashParser.T__46);
			this.state = 749;
			this.match(SolidCashParser.Identifier);
			this.state = 750;
			this.match(SolidCashParser.T__29);
			this.state = 751;
			this.expression(0);
			this.state = 752;
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
			this.state = 754;
			this.match(SolidCashParser.T__47);
			this.state = 755;
			this.parameterList();
			this.state = 759;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===165) {
				{
				{
				this.state = 756;
				this.parentInvocation();
				}
				}
				this.state = 761;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 762;
			this.match(SolidCashParser.T__3);
			this.state = 766;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 4198436355) !== 0) || ((((_la - 103)) & ~0x1F) === 0 && ((1 << (_la - 103)) & 16811007) !== 0) || ((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 134077655) !== 0)) {
				{
				{
				this.state = 763;
				this.statement();
				}
				}
				this.state = 768;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 769;
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
			this.state = 771;
			this.match(SolidCashParser.T__48);
			this.state = 772;
			this.parameterList();
			this.state = 773;
			this.match(SolidCashParser.T__33);
			this.state = 777;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 7) !== 0)) {
				{
				{
				this.state = 774;
				this.fallbackModifier();
				}
				}
				this.state = 779;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 783;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===165) {
				{
				{
				this.state = 780;
				this.customModifierInvocation();
				}
				}
				this.state = 785;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 786;
			this.match(SolidCashParser.T__3);
			this.state = 790;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 4198436355) !== 0) || ((((_la - 103)) & ~0x1F) === 0 && ((1 << (_la - 103)) & 16811007) !== 0) || ((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 134077655) !== 0)) {
				{
				{
				this.state = 787;
				this.statement();
				}
				}
				this.state = 792;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 793;
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
			this.state = 795;
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
			this.state = 797;
			this.match(SolidCashParser.T__52);
			this.state = 798;
			this.match(SolidCashParser.T__38);
			this.state = 799;
			this.match(SolidCashParser.T__39);
			this.state = 800;
			this.match(SolidCashParser.T__33);
			this.state = 801;
			this.match(SolidCashParser.T__49);
			this.state = 802;
			this.match(SolidCashParser.T__3);
			this.state = 806;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 4198436355) !== 0) || ((((_la - 103)) & ~0x1F) === 0 && ((1 << (_la - 103)) & 16811007) !== 0) || ((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 134077655) !== 0)) {
				{
				{
				this.state = 803;
				this.statement();
				}
				}
				this.state = 808;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 809;
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
			this.state = 811;
			this.match(SolidCashParser.Identifier);
			this.state = 812;
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
			this.state = 864;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 92, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 815;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 6291459) !== 0)) {
					{
					this.state = 814;
					this.stateVariableVisibility();
					}
				}

				this.state = 817;
				this.typeName();
				this.state = 821;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 135)) & ~0x1F) === 0 && ((1 << (_la - 135)) & 15) !== 0)) {
					{
					{
					this.state = 818;
					this.modifier();
					}
					}
					this.state = 823;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 824;
				this.match(SolidCashParser.Identifier);
				this.state = 825;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 827;
				this.typeName();
				this.state = 828;
				this.stateVariableVisibility();
				this.state = 832;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 135)) & ~0x1F) === 0 && ((1 << (_la - 135)) & 15) !== 0)) {
					{
					{
					this.state = 829;
					this.modifier();
					}
					}
					this.state = 834;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 835;
				this.match(SolidCashParser.Identifier);
				this.state = 836;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 839;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 6291459) !== 0)) {
					{
					this.state = 838;
					this.stateVariableVisibility();
					}
				}

				this.state = 841;
				this.mappingType();
				this.state = 845;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 6307843) !== 0) || ((((_la - 135)) & ~0x1F) === 0 && ((1 << (_la - 135)) & 15) !== 0)) {
					{
					{
					this.state = 842;
					this.collectionModifier();
					}
					}
					this.state = 847;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 848;
				this.match(SolidCashParser.Identifier);
				this.state = 849;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 852;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 6291459) !== 0)) {
					{
					this.state = 851;
					this.stateVariableVisibility();
					}
				}

				this.state = 854;
				this.arrayType(0);
				this.state = 858;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 6307843) !== 0) || ((((_la - 135)) & ~0x1F) === 0 && ((1 << (_la - 135)) & 15) !== 0)) {
					{
					{
					this.state = 855;
					this.collectionModifier();
					}
					}
					this.state = 860;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 861;
				this.match(SolidCashParser.Identifier);
				this.state = 862;
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
			this.state = 868;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 47:
			case 135:
			case 136:
			case 137:
			case 138:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 866;
				this.modifier();
				}
				break;
			case 33:
			case 34:
			case 54:
			case 55:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 867;
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
			this.state = 870;
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
			this.state = 908;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 99, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 872;
				this.match(SolidCashParser.T__55);
				this.state = 873;
				this.match(SolidCashParser.T__38);
				this.state = 874;
				this.typeName();
				this.state = 876;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===165) {
					{
					this.state = 875;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 878;
				this.match(SolidCashParser.T__56);
				this.state = 879;
				this.typeName();
				this.state = 881;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===165) {
					{
					this.state = 880;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 883;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 885;
				this.match(SolidCashParser.T__55);
				this.state = 886;
				this.match(SolidCashParser.T__38);
				this.state = 887;
				this.typeName();
				this.state = 889;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===165) {
					{
					this.state = 888;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 891;
				this.match(SolidCashParser.T__56);
				this.state = 892;
				this.mappingType();
				this.state = 893;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 895;
				this.match(SolidCashParser.T__55);
				this.state = 896;
				this.match(SolidCashParser.T__38);
				this.state = 897;
				this.typeName();
				this.state = 899;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===165) {
					{
					this.state = 898;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 901;
				this.match(SolidCashParser.T__56);
				this.state = 902;
				this.arrayType(0);
				this.state = 904;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===165) {
					{
					this.state = 903;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 906;
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
			this.state = 920;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 100, this._ctx) ) {
			case 1:
				{
				this.state = 911;
				this.typeName();
				this.state = 912;
				this.match(SolidCashParser.T__57);
				this.state = 913;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 914;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				{
				this.state = 916;
				this.typeName();
				this.state = 917;
				this.match(SolidCashParser.T__57);
				this.state = 918;
				this.match(SolidCashParser.T__58);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 931;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 102, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 929;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 101, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 922;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 923;
						this.match(SolidCashParser.T__57);
						this.state = 924;
						this.match(SolidCashParser.NumberLiteral);
						this.state = 925;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 926;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 927;
						this.match(SolidCashParser.T__57);
						this.state = 928;
						this.match(SolidCashParser.T__58);
						}
						break;
					}
					}
				}
				this.state = 933;
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
			this.state = 934;
			this.match(SolidCashParser.T__59);
			this.state = 935;
			this.match(SolidCashParser.Identifier);
			this.state = 937;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===39) {
				{
				this.state = 936;
				this.parameterList();
				}
			}

			this.state = 939;
			this.match(SolidCashParser.T__3);
			this.state = 943;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2152204417) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 4198436355) !== 0) || ((((_la - 103)) & ~0x1F) === 0 && ((1 << (_la - 103)) & 16811007) !== 0) || ((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 134077655) !== 0)) {
				{
				{
				this.state = 940;
				this.modifierStatement();
				}
				}
				this.state = 945;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 946;
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
			this.state = 950;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 61:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 948;
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
			case 80:
			case 81:
			case 82:
			case 87:
			case 88:
			case 89:
			case 90:
			case 91:
			case 92:
			case 96:
			case 98:
			case 99:
			case 100:
			case 101:
			case 102:
			case 103:
			case 104:
			case 105:
			case 106:
			case 107:
			case 108:
			case 109:
			case 110:
			case 111:
			case 112:
			case 118:
			case 127:
			case 139:
			case 140:
			case 141:
			case 143:
			case 145:
			case 146:
			case 149:
			case 150:
			case 151:
			case 153:
			case 154:
			case 155:
			case 157:
			case 158:
			case 159:
			case 160:
			case 161:
			case 162:
			case 163:
			case 164:
			case 165:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 949;
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
			this.state = 952;
			this.match(SolidCashParser.T__60);
			this.state = 953;
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
			this.state = 955;
			this.match(SolidCashParser.T__6);
			this.state = 956;
			this.match(SolidCashParser.Identifier);
			this.state = 957;
			this.parameterList();
			this.state = 961;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 3765305347) !== 0) || ((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & 15) !== 0)) {
				{
				{
				this.state = 958;
				this.functionModifier();
				}
				}
				this.state = 963;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 967;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===165) {
				{
				{
				this.state = 964;
				this.customModifierInvocation();
				}
				}
				this.state = 969;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 971;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 970;
				this.returnType();
				}
			}

			this.state = 973;
			this.match(SolidCashParser.T__3);
			this.state = 977;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 4198436355) !== 0) || ((((_la - 103)) & ~0x1F) === 0 && ((1 << (_la - 103)) & 16811007) !== 0) || ((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 134077655) !== 0)) {
				{
				{
				this.state = 974;
				this.statement();
				}
				}
				this.state = 979;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 980;
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
			this.state = 982;
			this.match(SolidCashParser.Identifier);
			this.state = 984;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===39) {
				{
				this.state = 983;
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
			this.state = 1000;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 62:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 986;
				this.match(SolidCashParser.T__61);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 987;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 54:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 988;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 34:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 989;
				this.match(SolidCashParser.T__33);
				}
				break;
			case 33:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 990;
				this.match(SolidCashParser.T__32);
				}
				break;
			case 55:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 991;
				this.match(SolidCashParser.T__54);
				}
				break;
			case 50:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 992;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 52:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 993;
				this.match(SolidCashParser.T__51);
				}
				break;
			case 51:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 994;
				this.match(SolidCashParser.T__50);
				}
				break;
			case 68:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 995;
				this.unsafeModifier();
				}
				break;
			case 64:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 996;
				this.match(SolidCashParser.T__63);
				}
				break;
			case 65:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 997;
				this.match(SolidCashParser.T__64);
				}
				break;
			case 66:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 998;
				this.match(SolidCashParser.T__65);
				}
				break;
			case 67:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 999;
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
			this.state = 1002;
			this.match(SolidCashParser.T__67);
			this.state = 1006;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===39) {
				{
				this.state = 1003;
				this.match(SolidCashParser.T__38);
				this.state = 1004;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1005;
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
			this.state = 1008;
			this.match(SolidCashParser.T__68);
			this.state = 1009;
			this.match(SolidCashParser.T__38);
			this.state = 1010;
			this.typeName();
			this.state = 1014;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===47 || ((((_la - 135)) & ~0x1F) === 0 && ((1 << (_la - 135)) & 15) !== 0)) {
				{
				{
				this.state = 1011;
				this.modifier();
				}
				}
				this.state = 1016;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1027;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 115, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1017;
					this.match(SolidCashParser.T__4);
					this.state = 1018;
					this.typeName();
					this.state = 1022;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===47 || ((((_la - 135)) & ~0x1F) === 0 && ((1 << (_la - 135)) & 15) !== 0)) {
						{
						{
						this.state = 1019;
						this.modifier();
						}
						}
						this.state = 1024;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
					}
				}
				this.state = 1029;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 115, this._ctx);
			}
			this.state = 1031;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1030;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1033;
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
			this.state = 1035;
			this.match(SolidCashParser.T__38);
			this.state = 1047;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 74980359) !== 0)) {
				{
				this.state = 1036;
				this.parameter();
				this.state = 1041;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 117, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1037;
						this.match(SolidCashParser.T__4);
						this.state = 1038;
						this.parameter();
						}
						}
					}
					this.state = 1043;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 117, this._ctx);
				}
				this.state = 1045;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1044;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1049;
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
			this.state = 1069;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 122, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1051;
				this.typeName();
				this.state = 1055;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 135)) & ~0x1F) === 0 && ((1 << (_la - 135)) & 15) !== 0)) {
					{
					{
					this.state = 1052;
					this.modifier();
					}
					}
					this.state = 1057;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1058;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1060;
				this.arrayType(0);
				this.state = 1064;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 135)) & ~0x1F) === 0 && ((1 << (_la - 135)) & 15) !== 0)) {
					{
					{
					this.state = 1061;
					this.modifier();
					}
					}
					this.state = 1066;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1067;
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
			this.state = 1080;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1071;
				this.match(SolidCashParser.T__3);
				this.state = 1075;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 4198436355) !== 0) || ((((_la - 103)) & ~0x1F) === 0 && ((1 << (_la - 103)) & 16811007) !== 0) || ((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 134077655) !== 0)) {
					{
					{
					this.state = 1072;
					this.statement();
					}
					}
					this.state = 1077;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1078;
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
			case 80:
			case 81:
			case 82:
			case 87:
			case 88:
			case 89:
			case 90:
			case 91:
			case 92:
			case 96:
			case 98:
			case 99:
			case 100:
			case 101:
			case 102:
			case 103:
			case 104:
			case 105:
			case 106:
			case 107:
			case 108:
			case 109:
			case 110:
			case 111:
			case 112:
			case 118:
			case 127:
			case 139:
			case 140:
			case 141:
			case 143:
			case 145:
			case 146:
			case 149:
			case 150:
			case 151:
			case 153:
			case 154:
			case 155:
			case 157:
			case 158:
			case 159:
			case 160:
			case 161:
			case 162:
			case 163:
			case 164:
			case 165:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1079;
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
			this.state = 1115;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 125, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1082;
				this.variableDefinition();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1083;
				this.tupleAssignment();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1084;
				this.arrayAssignStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1085;
				this.arrayPushStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1086;
				this.arrayPopStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1087;
				this.arrayDeleteStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1088;
				this.stateArrayPushStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1089;
				this.stateArrayPopStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1090;
				this.assignStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1091;
				this.stateAssignStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1092;
				this.mappingFieldAssignStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1093;
				this.mappingAssignStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1094;
				this.mappingDeleteStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1095;
				this.timeOpStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1096;
				this.requireStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1097;
				this.ifStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1098;
				this.loopStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1099;
				this.consoleStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1100;
				this.emitStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1101;
				this.transferStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1102;
				this.tokenContainerMethodStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1103;
				this.returnStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1104;
				this.functionCallStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1105;
				this.addressMethodStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1106;
				this.assemblyStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1107;
				this.tryCatchStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1108;
				this.revertStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1109;
				this.assertStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1110;
				this.deleteStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1111;
				this.uncheckedStatement();
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 31);
				{
				this.state = 1112;
				this.switchStatement();
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 32);
				{
				this.state = 1113;
				this.breakStatement();
				}
				break;
			case 33:
				this.enterOuterAlt(localctx, 33);
				{
				this.state = 1114;
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
			this.state = 1117;
			this.match(SolidCashParser.T__69);
			this.state = 1118;
			this.match(SolidCashParser.T__11);
			this.state = 1119;
			this.match(SolidCashParser.Identifier);
			this.state = 1120;
			this.match(SolidCashParser.T__38);
			this.state = 1121;
			this.expression(0);
			this.state = 1122;
			this.match(SolidCashParser.T__4);
			this.state = 1123;
			this.expression(0);
			this.state = 1124;
			this.match(SolidCashParser.T__39);
			this.state = 1125;
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
			this.state = 1127;
			this.match(SolidCashParser.T__69);
			this.state = 1128;
			this.match(SolidCashParser.T__11);
			this.state = 1129;
			this.match(SolidCashParser.Identifier);
			this.state = 1130;
			this.match(SolidCashParser.T__57);
			this.state = 1131;
			this.expression(0);
			this.state = 1132;
			this.match(SolidCashParser.T__58);
			this.state = 1133;
			this.match(SolidCashParser.T__11);
			this.state = 1134;
			this.match(SolidCashParser.Identifier);
			this.state = 1135;
			this.match(SolidCashParser.T__38);
			this.state = 1136;
			this.expression(0);
			this.state = 1141;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1137;
				this.match(SolidCashParser.T__4);
				this.state = 1138;
				this.expression(0);
				}
				}
				this.state = 1143;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
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
	public returnStatement(): ReturnStatementContext {
		let localctx: ReturnStatementContext = new ReturnStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 108, SolidCashParser.RULE_returnStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1174;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 130, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1147;
				this.match(SolidCashParser.T__70);
				this.state = 1148;
				this.expression(0);
				this.state = 1153;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1149;
					this.match(SolidCashParser.T__4);
					this.state = 1150;
					this.expression(0);
					}
					}
					this.state = 1155;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1156;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1158;
				this.match(SolidCashParser.T__70);
				this.state = 1159;
				this.match(SolidCashParser.T__38);
				this.state = 1160;
				this.expression(0);
				this.state = 1165;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 128, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1161;
						this.match(SolidCashParser.T__4);
						this.state = 1162;
						this.expression(0);
						}
						}
					}
					this.state = 1167;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 128, this._ctx);
				}
				this.state = 1169;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1168;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1171;
				this.match(SolidCashParser.T__39);
				this.state = 1172;
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
			this.state = 1198;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 132, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1176;
				this.match(SolidCashParser.Identifier);
				this.state = 1177;
				this.expressionList();
				this.state = 1178;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1180;
				this.match(SolidCashParser.Identifier);
				this.state = 1181;
				this.match(SolidCashParser.T__11);
				this.state = 1182;
				this.match(SolidCashParser.Identifier);
				this.state = 1183;
				this.expressionList();
				this.state = 1184;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1186;
				this.match(SolidCashParser.Identifier);
				this.state = 1187;
				this.expressionList();
				this.state = 1188;
				this.match(SolidCashParser.T__11);
				this.state = 1189;
				this.match(SolidCashParser.Identifier);
				this.state = 1190;
				this.match(SolidCashParser.T__11);
				this.state = 1191;
				this.match(SolidCashParser.Identifier);
				this.state = 1193;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1192;
					this.callOptions();
					}
				}

				this.state = 1195;
				this.expressionList();
				this.state = 1196;
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
			this.state = 1200;
			this.expression(0);
			this.state = 1201;
			this.match(SolidCashParser.T__11);
			this.state = 1202;
			this.match(SolidCashParser.Identifier);
			this.state = 1204;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===4) {
				{
				this.state = 1203;
				this.callOptions();
				}
			}

			this.state = 1206;
			this.expressionList();
			this.state = 1207;
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
			this.state = 1209;
			this.match(SolidCashParser.T__71);
			this.state = 1210;
			this.match(SolidCashParser.Identifier);
			this.state = 1211;
			this.expressionList();
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
	public mappingAssignStatement(): MappingAssignStatementContext {
		let localctx: MappingAssignStatementContext = new MappingAssignStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 116, SolidCashParser.RULE_mappingAssignStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1214;
			this.match(SolidCashParser.T__69);
			this.state = 1215;
			this.match(SolidCashParser.T__11);
			this.state = 1216;
			this.match(SolidCashParser.Identifier);
			this.state = 1221;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 1217;
				this.match(SolidCashParser.T__57);
				this.state = 1218;
				this.expression(0);
				this.state = 1219;
				this.match(SolidCashParser.T__58);
				}
				}
				this.state = 1223;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===58);
			this.state = 1225;
			this.match(SolidCashParser.T__29);
			this.state = 1226;
			this.expression(0);
			this.state = 1227;
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
			this.state = 1229;
			this.match(SolidCashParser.T__69);
			this.state = 1230;
			this.match(SolidCashParser.T__11);
			this.state = 1231;
			this.match(SolidCashParser.Identifier);
			this.state = 1236;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 1232;
				this.match(SolidCashParser.T__57);
				this.state = 1233;
				this.expression(0);
				this.state = 1234;
				this.match(SolidCashParser.T__58);
				}
				}
				this.state = 1238;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===58);
			this.state = 1240;
			this.match(SolidCashParser.T__11);
			this.state = 1241;
			this.match(SolidCashParser.Identifier);
			this.state = 1242;
			this.match(SolidCashParser.T__29);
			this.state = 1243;
			this.expression(0);
			this.state = 1244;
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
			this.state = 1246;
			this.match(SolidCashParser.T__69);
			this.state = 1247;
			this.match(SolidCashParser.T__11);
			this.state = 1248;
			this.match(SolidCashParser.Identifier);
			this.state = 1255;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===58) {
				{
				{
				this.state = 1249;
				this.match(SolidCashParser.T__57);
				this.state = 1250;
				this.expression(0);
				this.state = 1251;
				this.match(SolidCashParser.T__58);
				}
				}
				this.state = 1257;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1258;
			this.match(SolidCashParser.T__72);
			this.state = 1259;
			this.match(SolidCashParser.T__38);
			this.state = 1260;
			this.expression(0);
			this.state = 1261;
			this.match(SolidCashParser.T__39);
			this.state = 1262;
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
			this.state = 1264;
			this.match(SolidCashParser.T__69);
			this.state = 1265;
			this.match(SolidCashParser.T__11);
			this.state = 1266;
			this.match(SolidCashParser.Identifier);
			this.state = 1267;
			this.match(SolidCashParser.T__29);
			this.state = 1268;
			this.expression(0);
			this.state = 1269;
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
			this.state = 1295;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 139, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1271;
				this.typeName();
				this.state = 1275;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 135)) & ~0x1F) === 0 && ((1 << (_la - 135)) & 15) !== 0)) {
					{
					{
					this.state = 1272;
					this.modifier();
					}
					}
					this.state = 1277;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1278;
				this.match(SolidCashParser.Identifier);
				this.state = 1279;
				this.match(SolidCashParser.T__29);
				this.state = 1280;
				this.expression(0);
				this.state = 1281;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1283;
				this.arrayType(0);
				this.state = 1287;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47 || ((((_la - 135)) & ~0x1F) === 0 && ((1 << (_la - 135)) & 15) !== 0)) {
					{
					{
					this.state = 1284;
					this.modifier();
					}
					}
					this.state = 1289;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1290;
				this.match(SolidCashParser.Identifier);
				this.state = 1291;
				this.match(SolidCashParser.T__29);
				this.state = 1292;
				this.expression(0);
				this.state = 1293;
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
			this.state = 1327;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 139:
			case 140:
			case 141:
			case 149:
			case 150:
			case 151:
			case 158:
			case 159:
			case 160:
			case 161:
			case 165:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1297;
				this.typeName();
				this.state = 1298;
				this.match(SolidCashParser.Identifier);
				this.state = 1303;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1299;
					this.match(SolidCashParser.T__4);
					this.state = 1300;
					this.typeName();
					this.state = 1301;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1305;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1307;
				this.match(SolidCashParser.T__29);
				this.state = 1308;
				this.expression(0);
				this.state = 1309;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 39:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1311;
				this.match(SolidCashParser.T__38);
				this.state = 1312;
				this.typeName();
				this.state = 1313;
				this.match(SolidCashParser.Identifier);
				this.state = 1318;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1314;
					this.match(SolidCashParser.T__4);
					this.state = 1315;
					this.typeName();
					this.state = 1316;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1320;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1322;
				this.match(SolidCashParser.T__39);
				this.state = 1323;
				this.match(SolidCashParser.T__29);
				this.state = 1324;
				this.expression(0);
				this.state = 1325;
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
	public assignStatement(): AssignStatementContext {
		let localctx: AssignStatementContext = new AssignStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 128, SolidCashParser.RULE_assignStatement);
		let _la: number;
		try {
			this.state = 1337;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 143, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1329;
				this.match(SolidCashParser.Identifier);
				this.state = 1330;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===30 || _la===74 || _la===75)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1331;
				this.expression(0);
				this.state = 1332;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1334;
				this.match(SolidCashParser.Identifier);
				this.state = 1335;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===76 || _la===77)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1336;
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
		this.enterRule(localctx, 130, SolidCashParser.RULE_arrayPushStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1339;
			this.match(SolidCashParser.Identifier);
			this.state = 1340;
			this.match(SolidCashParser.T__77);
			this.state = 1341;
			this.match(SolidCashParser.T__38);
			this.state = 1342;
			this.expression(0);
			this.state = 1343;
			this.match(SolidCashParser.T__39);
			this.state = 1344;
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
		this.enterRule(localctx, 132, SolidCashParser.RULE_arrayPopStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1346;
			this.match(SolidCashParser.Identifier);
			this.state = 1347;
			this.match(SolidCashParser.T__78);
			this.state = 1348;
			this.match(SolidCashParser.T__38);
			this.state = 1349;
			this.match(SolidCashParser.T__39);
			this.state = 1350;
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
		this.enterRule(localctx, 134, SolidCashParser.RULE_arrayAssignStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1352;
			this.match(SolidCashParser.Identifier);
			this.state = 1353;
			this.match(SolidCashParser.T__57);
			this.state = 1354;
			this.expression(0);
			this.state = 1355;
			this.match(SolidCashParser.T__58);
			this.state = 1356;
			this.match(SolidCashParser.T__29);
			this.state = 1357;
			this.expression(0);
			this.state = 1358;
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
		this.enterRule(localctx, 136, SolidCashParser.RULE_arrayDeleteStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1360;
			this.match(SolidCashParser.Identifier);
			this.state = 1361;
			this.match(SolidCashParser.T__72);
			this.state = 1362;
			this.match(SolidCashParser.T__38);
			this.state = 1363;
			this.expression(0);
			this.state = 1364;
			this.match(SolidCashParser.T__39);
			this.state = 1365;
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
		this.enterRule(localctx, 138, SolidCashParser.RULE_stateArrayPushStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1367;
			this.match(SolidCashParser.T__69);
			this.state = 1368;
			this.match(SolidCashParser.T__11);
			this.state = 1369;
			this.match(SolidCashParser.Identifier);
			this.state = 1370;
			this.match(SolidCashParser.T__77);
			this.state = 1371;
			this.match(SolidCashParser.T__38);
			this.state = 1372;
			this.expression(0);
			this.state = 1373;
			this.match(SolidCashParser.T__39);
			this.state = 1374;
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
		this.enterRule(localctx, 140, SolidCashParser.RULE_stateArrayPopStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1376;
			this.match(SolidCashParser.T__69);
			this.state = 1377;
			this.match(SolidCashParser.T__11);
			this.state = 1378;
			this.match(SolidCashParser.Identifier);
			this.state = 1379;
			this.match(SolidCashParser.T__78);
			this.state = 1380;
			this.match(SolidCashParser.T__38);
			this.state = 1381;
			this.match(SolidCashParser.T__39);
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
	public deleteStatement(): DeleteStatementContext {
		let localctx: DeleteStatementContext = new DeleteStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 142, SolidCashParser.RULE_deleteStatement);
		let _la: number;
		try {
			this.state = 1406;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 145, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1384;
				this.match(SolidCashParser.T__79);
				this.state = 1385;
				this.match(SolidCashParser.Identifier);
				this.state = 1386;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1387;
				this.match(SolidCashParser.T__79);
				this.state = 1388;
				this.match(SolidCashParser.T__69);
				this.state = 1389;
				this.match(SolidCashParser.T__11);
				this.state = 1390;
				this.match(SolidCashParser.Identifier);
				this.state = 1391;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1392;
				this.match(SolidCashParser.T__79);
				this.state = 1393;
				this.match(SolidCashParser.T__69);
				this.state = 1394;
				this.match(SolidCashParser.T__11);
				this.state = 1395;
				this.match(SolidCashParser.Identifier);
				this.state = 1400;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1396;
					this.match(SolidCashParser.T__57);
					this.state = 1397;
					this.expression(0);
					this.state = 1398;
					this.match(SolidCashParser.T__58);
					}
					}
					this.state = 1402;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===58);
				this.state = 1404;
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
		this.enterRule(localctx, 144, SolidCashParser.RULE_timeOpStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1408;
			this.match(SolidCashParser.T__80);
			this.state = 1409;
			this.match(SolidCashParser.T__38);
			this.state = 1410;
			this.match(SolidCashParser.TxVar);
			this.state = 1411;
			this.match(SolidCashParser.T__22);
			this.state = 1412;
			this.expression(0);
			this.state = 1415;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1413;
				this.match(SolidCashParser.T__4);
				this.state = 1414;
				this.requireMessage();
				}
			}

			this.state = 1417;
			this.match(SolidCashParser.T__39);
			this.state = 1418;
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
		this.enterRule(localctx, 146, SolidCashParser.RULE_requireStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1420;
			this.match(SolidCashParser.T__80);
			this.state = 1421;
			this.match(SolidCashParser.T__38);
			this.state = 1422;
			this.expression(0);
			this.state = 1425;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1423;
				this.match(SolidCashParser.T__4);
				this.state = 1424;
				this.requireMessage();
				}
			}

			this.state = 1427;
			this.match(SolidCashParser.T__39);
			this.state = 1428;
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
		this.enterRule(localctx, 148, SolidCashParser.RULE_ifStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1430;
			this.match(SolidCashParser.T__81);
			this.state = 1431;
			this.match(SolidCashParser.T__38);
			this.state = 1432;
			this.expression(0);
			this.state = 1433;
			this.match(SolidCashParser.T__39);
			this.state = 1434;
			localctx._ifBlock = this.block();
			this.state = 1437;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 148, this._ctx) ) {
			case 1:
				{
				this.state = 1435;
				this.match(SolidCashParser.T__82);
				this.state = 1436;
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
		this.enterRule(localctx, 150, SolidCashParser.RULE_loopStatement);
		try {
			this.state = 1445;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 149, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1439;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1440;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1441;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1442;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1443;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1444;
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
		this.enterRule(localctx, 152, SolidCashParser.RULE_forOfEntriesStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1447;
			this.match(SolidCashParser.T__8);
			this.state = 1448;
			this.match(SolidCashParser.T__38);
			this.state = 1449;
			this.typeName();
			this.state = 1450;
			this.match(SolidCashParser.Identifier);
			this.state = 1451;
			this.match(SolidCashParser.T__4);
			this.state = 1452;
			this.typeName();
			this.state = 1453;
			this.match(SolidCashParser.Identifier);
			this.state = 1454;
			this.match(SolidCashParser.T__83);
			this.state = 1455;
			this.match(SolidCashParser.T__69);
			this.state = 1456;
			this.match(SolidCashParser.T__11);
			this.state = 1457;
			this.match(SolidCashParser.Identifier);
			this.state = 1458;
			this.match(SolidCashParser.T__11);
			this.state = 1459;
			this.match(SolidCashParser.T__84);
			this.state = 1460;
			this.match(SolidCashParser.T__39);
			this.state = 1461;
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
		this.enterRule(localctx, 154, SolidCashParser.RULE_forInStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1463;
			this.match(SolidCashParser.T__8);
			this.state = 1464;
			this.match(SolidCashParser.T__38);
			this.state = 1465;
			this.typeName();
			this.state = 1466;
			this.match(SolidCashParser.Identifier);
			this.state = 1467;
			this.match(SolidCashParser.T__85);
			this.state = 1468;
			this.match(SolidCashParser.T__69);
			this.state = 1469;
			this.match(SolidCashParser.T__11);
			this.state = 1470;
			this.match(SolidCashParser.Identifier);
			this.state = 1471;
			this.match(SolidCashParser.T__39);
			this.state = 1472;
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
		this.enterRule(localctx, 156, SolidCashParser.RULE_forOfStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1474;
			this.match(SolidCashParser.T__8);
			this.state = 1475;
			this.match(SolidCashParser.T__38);
			this.state = 1476;
			this.typeName();
			this.state = 1477;
			this.match(SolidCashParser.Identifier);
			this.state = 1478;
			this.match(SolidCashParser.T__83);
			this.state = 1479;
			this.match(SolidCashParser.T__69);
			this.state = 1480;
			this.match(SolidCashParser.T__11);
			this.state = 1481;
			this.match(SolidCashParser.Identifier);
			this.state = 1482;
			this.match(SolidCashParser.T__39);
			this.state = 1483;
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
		this.enterRule(localctx, 158, SolidCashParser.RULE_forStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1485;
			this.match(SolidCashParser.T__8);
			this.state = 1486;
			this.match(SolidCashParser.T__38);
			this.state = 1487;
			this.forInit();
			this.state = 1488;
			this.forCondition();
			this.state = 1489;
			this.forUpdate();
			this.state = 1490;
			this.match(SolidCashParser.T__39);
			this.state = 1491;
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
		this.enterRule(localctx, 160, SolidCashParser.RULE_forInit);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1493;
			this.typeName();
			this.state = 1497;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===47 || ((((_la - 135)) & ~0x1F) === 0 && ((1 << (_la - 135)) & 15) !== 0)) {
				{
				{
				this.state = 1494;
				this.modifier();
				}
				}
				this.state = 1499;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1500;
			this.match(SolidCashParser.Identifier);
			this.state = 1501;
			this.match(SolidCashParser.T__29);
			this.state = 1502;
			this.expression(0);
			this.state = 1503;
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
		this.enterRule(localctx, 162, SolidCashParser.RULE_forCondition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1505;
			this.expression(0);
			this.state = 1506;
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
		this.enterRule(localctx, 164, SolidCashParser.RULE_forUpdate);
		let _la: number;
		try {
			this.state = 1513;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 151, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1508;
				this.match(SolidCashParser.Identifier);
				this.state = 1509;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===30 || _la===74 || _la===75)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1510;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1511;
				this.match(SolidCashParser.Identifier);
				this.state = 1512;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===76 || _la===77)) {
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
		this.enterRule(localctx, 166, SolidCashParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1515;
			this.match(SolidCashParser.T__86);
			this.state = 1516;
			this.block();
			this.state = 1517;
			this.match(SolidCashParser.T__87);
			this.state = 1518;
			this.match(SolidCashParser.T__38);
			this.state = 1519;
			this.expression(0);
			this.state = 1520;
			this.match(SolidCashParser.T__39);
			this.state = 1521;
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
		this.enterRule(localctx, 168, SolidCashParser.RULE_whileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1523;
			this.match(SolidCashParser.T__87);
			this.state = 1524;
			this.match(SolidCashParser.T__38);
			this.state = 1525;
			this.expression(0);
			this.state = 1526;
			this.match(SolidCashParser.T__39);
			this.state = 1527;
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
		this.enterRule(localctx, 170, SolidCashParser.RULE_consoleStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1529;
			this.match(SolidCashParser.T__88);
			this.state = 1530;
			this.consoleParameterList();
			this.state = 1531;
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
		this.enterRule(localctx, 172, SolidCashParser.RULE_assemblyStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1533;
			this.match(SolidCashParser.T__89);
			this.state = 1534;
			this.match(SolidCashParser.T__3);
			this.state = 1538;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 524801) !== 0)) {
				{
				{
				this.state = 1535;
				this.assemblyToken();
				}
				}
				this.state = 1540;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1541;
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
		this.enterRule(localctx, 174, SolidCashParser.RULE_assemblyToken);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1543;
			_la = this._input.LA(1);
			if(!(((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 524801) !== 0))) {
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
		this.enterRule(localctx, 176, SolidCashParser.RULE_uncheckedStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1545;
			this.match(SolidCashParser.T__90);
			this.state = 1546;
			this.match(SolidCashParser.T__3);
			this.state = 1550;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 4198436355) !== 0) || ((((_la - 103)) & ~0x1F) === 0 && ((1 << (_la - 103)) & 16811007) !== 0) || ((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 134077655) !== 0)) {
				{
				{
				this.state = 1547;
				this.statement();
				}
				}
				this.state = 1552;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1553;
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
		this.enterRule(localctx, 178, SolidCashParser.RULE_switchStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1555;
			this.match(SolidCashParser.T__91);
			this.state = 1556;
			this.match(SolidCashParser.T__38);
			this.state = 1557;
			this.expression(0);
			this.state = 1558;
			this.match(SolidCashParser.T__39);
			this.state = 1559;
			this.match(SolidCashParser.T__3);
			this.state = 1563;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===93) {
				{
				{
				this.state = 1560;
				this.switchCase();
				}
				}
				this.state = 1565;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1567;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===95) {
				{
				this.state = 1566;
				this.switchDefault();
				}
			}

			this.state = 1569;
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
		this.enterRule(localctx, 180, SolidCashParser.RULE_switchCase);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1571;
			this.match(SolidCashParser.T__92);
			this.state = 1572;
			this.expression(0);
			this.state = 1573;
			this.match(SolidCashParser.T__93);
			this.state = 1577;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 4198436355) !== 0) || ((((_la - 103)) & ~0x1F) === 0 && ((1 << (_la - 103)) & 16811007) !== 0) || ((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 134077655) !== 0)) {
				{
				{
				this.state = 1574;
				this.statement();
				}
				}
				this.state = 1579;
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
		this.enterRule(localctx, 182, SolidCashParser.RULE_switchDefault);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1580;
			this.match(SolidCashParser.T__94);
			this.state = 1581;
			this.match(SolidCashParser.T__93);
			this.state = 1585;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234624) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 4198436355) !== 0) || ((((_la - 103)) & ~0x1F) === 0 && ((1 << (_la - 103)) & 16811007) !== 0) || ((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 134077655) !== 0)) {
				{
				{
				this.state = 1582;
				this.statement();
				}
				}
				this.state = 1587;
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
		this.enterRule(localctx, 184, SolidCashParser.RULE_tryCatchStatement);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1588;
			this.match(SolidCashParser.T__95);
			this.state = 1589;
			this.expression(0);
			this.state = 1591;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===69) {
				{
				this.state = 1590;
				this.tryReturns();
				}
			}

			this.state = 1593;
			localctx._tryBlock = this.block();
			this.state = 1595;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1594;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1597;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 159, this._ctx);
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
		this.enterRule(localctx, 186, SolidCashParser.RULE_tryReturns);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1599;
			this.match(SolidCashParser.T__68);
			this.state = 1600;
			this.match(SolidCashParser.T__38);
			this.state = 1612;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 74980359) !== 0)) {
				{
				this.state = 1601;
				this.parameter();
				this.state = 1606;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 160, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1602;
						this.match(SolidCashParser.T__4);
						this.state = 1603;
						this.parameter();
						}
						}
					}
					this.state = 1608;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 160, this._ctx);
				}
				this.state = 1610;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1609;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1614;
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
		this.enterRule(localctx, 188, SolidCashParser.RULE_catchClause);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1616;
			this.match(SolidCashParser.T__96);
			this.state = 1618;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 163, this._ctx) ) {
			case 1:
				{
				this.state = 1617;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 1635;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 167, this._ctx) ) {
			case 1:
				{
				this.state = 1620;
				this.match(SolidCashParser.T__38);
				this.state = 1632;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 74980359) !== 0)) {
					{
					this.state = 1621;
					this.parameter();
					this.state = 1626;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 164, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1622;
							this.match(SolidCashParser.T__4);
							this.state = 1623;
							this.parameter();
							}
							}
						}
						this.state = 1628;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 164, this._ctx);
					}
					this.state = 1630;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1629;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1634;
				this.match(SolidCashParser.T__39);
				}
				break;
			}
			this.state = 1637;
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
		this.enterRule(localctx, 190, SolidCashParser.RULE_breakStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1639;
			this.match(SolidCashParser.T__97);
			this.state = 1640;
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
		this.enterRule(localctx, 192, SolidCashParser.RULE_continueStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1642;
			this.match(SolidCashParser.T__98);
			this.state = 1643;
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
		this.enterRule(localctx, 194, SolidCashParser.RULE_requireMessage);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1645;
			this.match(SolidCashParser.StringLiteral);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 196, SolidCashParser.RULE_revertStatement);
		try {
			this.state = 1661;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 168, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1647;
				this.match(SolidCashParser.T__99);
				this.state = 1648;
				this.match(SolidCashParser.Identifier);
				this.state = 1649;
				this.expressionList();
				this.state = 1650;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1652;
				this.match(SolidCashParser.T__99);
				this.state = 1653;
				this.match(SolidCashParser.T__38);
				this.state = 1654;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1655;
				this.match(SolidCashParser.T__39);
				this.state = 1656;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1657;
				this.match(SolidCashParser.T__99);
				this.state = 1658;
				this.match(SolidCashParser.T__38);
				this.state = 1659;
				this.match(SolidCashParser.T__39);
				this.state = 1660;
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
		this.enterRule(localctx, 198, SolidCashParser.RULE_assertStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1663;
			this.match(SolidCashParser.T__100);
			this.state = 1664;
			this.match(SolidCashParser.T__38);
			this.state = 1665;
			this.expression(0);
			this.state = 1666;
			this.match(SolidCashParser.T__39);
			this.state = 1667;
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
		this.enterRule(localctx, 200, SolidCashParser.RULE_consoleParameter);
		try {
			this.state = 1671;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 165:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1669;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 143:
			case 145:
			case 146:
			case 153:
			case 154:
			case 155:
			case 163:
			case 164:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1670;
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
		this.enterRule(localctx, 202, SolidCashParser.RULE_consoleParameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1673;
			this.match(SolidCashParser.T__38);
			this.state = 1685;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 7347213) !== 0)) {
				{
				this.state = 1674;
				this.consoleParameter();
				this.state = 1679;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 170, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1675;
						this.match(SolidCashParser.T__4);
						this.state = 1676;
						this.consoleParameter();
						}
						}
					}
					this.state = 1681;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 170, this._ctx);
				}
				this.state = 1683;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1682;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1687;
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
		this.enterRule(localctx, 204, SolidCashParser.RULE_functionCall);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1713;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 176, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1689;
				this.match(SolidCashParser.Identifier);
				this.state = 1690;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1691;
				this.match(SolidCashParser.Identifier);
				this.state = 1692;
				this.match(SolidCashParser.T__11);
				this.state = 1693;
				this.match(SolidCashParser.Identifier);
				this.state = 1694;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1695;
				this.match(SolidCashParser.Identifier);
				this.state = 1696;
				this.match(SolidCashParser.T__38);
				this.state = 1697;
				this.match(SolidCashParser.T__3);
				this.state = 1709;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===165) {
					{
					this.state = 1698;
					this.namedArg();
					this.state = 1703;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 173, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1699;
							this.match(SolidCashParser.T__4);
							this.state = 1700;
							this.namedArg();
							}
							}
						}
						this.state = 1705;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 173, this._ctx);
					}
					this.state = 1707;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1706;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1711;
				this.match(SolidCashParser.T__5);
				this.state = 1712;
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
		this.enterRule(localctx, 206, SolidCashParser.RULE_namedArg);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1715;
			this.match(SolidCashParser.Identifier);
			this.state = 1716;
			this.match(SolidCashParser.T__93);
			this.state = 1717;
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
		this.enterRule(localctx, 208, SolidCashParser.RULE_expressionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1719;
			this.match(SolidCashParser.T__38);
			this.state = 1731;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===14 || _la===27 || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 102)) & ~0x1F) === 0 && ((1 << (_la - 102)) & 33622015) !== 0) || ((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 134077655) !== 0)) {
				{
				this.state = 1720;
				this.expression(0);
				this.state = 1725;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 177, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1721;
						this.match(SolidCashParser.T__4);
						this.state = 1722;
						this.expression(0);
						}
						}
					}
					this.state = 1727;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 177, this._ctx);
				}
				this.state = 1729;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1728;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1733;
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
		this.enterRule(localctx, 210, SolidCashParser.RULE_callOptions);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1735;
			this.match(SolidCashParser.T__3);
			this.state = 1736;
			this.callOption();
			this.state = 1741;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 180, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1737;
					this.match(SolidCashParser.T__4);
					this.state = 1738;
					this.callOption();
					}
					}
				}
				this.state = 1743;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 180, this._ctx);
			}
			this.state = 1745;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1744;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1747;
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
		this.enterRule(localctx, 212, SolidCashParser.RULE_callOption);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1749;
			this.match(SolidCashParser.Identifier);
			this.state = 1750;
			this.match(SolidCashParser.T__93);
			this.state = 1751;
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
		this.enterRule(localctx, 214, SolidCashParser.RULE_typeList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1753;
			this.match(SolidCashParser.T__38);
			this.state = 1754;
			this.typeName();
			this.state = 1759;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 182, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1755;
					this.match(SolidCashParser.T__4);
					this.state = 1756;
					this.typeName();
					}
					}
				}
				this.state = 1761;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 182, this._ctx);
			}
			this.state = 1763;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1762;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1765;
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
		let _startState: number = 216;
		this.enterRecursionRule(localctx, 216, SolidCashParser.RULE_expression, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1895;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 190, this._ctx) ) {
			case 1:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 1768;
				this.match(SolidCashParser.T__38);
				this.state = 1769;
				this.expression(0);
				this.state = 1770;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 2:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1772;
				this.typeCast();
				this.state = 1773;
				this.match(SolidCashParser.T__38);
				this.state = 1774;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 1776;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1775;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1778;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 3:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1780;
				this.functionCall();
				}
				break;
			case 4:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1781;
				this.match(SolidCashParser.T__101);
				this.state = 1782;
				this.match(SolidCashParser.Identifier);
				this.state = 1784;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1783;
					this.callOptions();
					}
				}

				this.state = 1786;
				this.expressionList();
				}
				break;
			case 5:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1787;
				this.match(SolidCashParser.T__101);
				this.state = 1788;
				this.typeName();
				this.state = 1789;
				this.match(SolidCashParser.T__57);
				this.state = 1790;
				this.match(SolidCashParser.T__58);
				this.state = 1791;
				this.match(SolidCashParser.T__38);
				this.state = 1792;
				this.expression(0);
				this.state = 1793;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 6:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1795;
				this.match(SolidCashParser.T__45);
				this.state = 1796;
				this.match(SolidCashParser.T__38);
				this.state = 1797;
				this.typeName();
				this.state = 1798;
				this.match(SolidCashParser.T__39);
				this.state = 1799;
				this.match(SolidCashParser.T__11);
				this.state = 1800;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 7:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1802;
				this.match(SolidCashParser.T__102);
				this.state = 1803;
				this.expressionList();
				}
				break;
			case 8:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1804;
				this.match(SolidCashParser.T__103);
				this.state = 1805;
				this.expressionList();
				}
				break;
			case 9:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1806;
				this.match(SolidCashParser.T__104);
				this.state = 1807;
				this.expressionList();
				}
				break;
			case 10:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1808;
				this.match(SolidCashParser.T__105);
				this.state = 1809;
				this.expressionList();
				}
				break;
			case 11:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1810;
				this.match(SolidCashParser.T__106);
				this.state = 1811;
				this.match(SolidCashParser.T__38);
				this.state = 1812;
				this.match(SolidCashParser.Identifier);
				this.state = 1813;
				this.match(SolidCashParser.T__11);
				this.state = 1814;
				this.match(SolidCashParser.Identifier);
				this.state = 1815;
				this.match(SolidCashParser.T__4);
				this.state = 1816;
				this.expressionList();
				this.state = 1817;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 12:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1819;
				this.match(SolidCashParser.T__107);
				this.state = 1820;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1821;
				this.match(SolidCashParser.T__108);
				this.state = 1822;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1823;
				this.match(SolidCashParser.T__109);
				this.state = 1824;
				this.match(SolidCashParser.T__38);
				this.state = 1825;
				this.expression(0);
				this.state = 1826;
				this.match(SolidCashParser.T__4);
				this.state = 1827;
				this.typeList();
				this.state = 1828;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 15:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1830;
				this.match(SolidCashParser.T__110);
				this.state = 1831;
				this.match(SolidCashParser.T__38);
				this.state = 1832;
				this.expression(0);
				this.state = 1833;
				this.match(SolidCashParser.T__4);
				this.state = 1834;
				this.typeList();
				this.state = 1835;
				this.match(SolidCashParser.T__4);
				this.state = 1836;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1837;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 16:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1839;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__111);
				this.state = 1840;
				this.match(SolidCashParser.T__57);
				this.state = 1841;
				this.expression(0);
				this.state = 1842;
				this.match(SolidCashParser.T__58);
				this.state = 1843;
				(localctx as UnaryIntrospectionOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 113)) & ~0x1F) === 0 && ((1 << (_la - 113)) & 31) !== 0))) {
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
				this.state = 1845;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__117);
				this.state = 1846;
				this.match(SolidCashParser.T__57);
				this.state = 1847;
				this.expression(0);
				this.state = 1848;
				this.match(SolidCashParser.T__58);
				this.state = 1849;
				(localctx as UnaryIntrospectionOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 113)) & ~0x1F) === 0 && ((1 << (_la - 113)) & 991) !== 0))) {
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
				this.state = 1851;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===127)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1852;
				this.expression(20);
				}
				break;
			case 19:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1853;
				this.match(SolidCashParser.T__57);
				this.state = 1865;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===14 || _la===27 || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2148010113) !== 0) || ((((_la - 102)) & ~0x1F) === 0 && ((1 << (_la - 102)) & 33622015) !== 0) || ((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 134077655) !== 0)) {
					{
					this.state = 1854;
					this.expression(0);
					this.state = 1859;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 186, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1855;
							this.match(SolidCashParser.T__4);
							this.state = 1856;
							this.expression(0);
							}
							}
						}
						this.state = 1861;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 186, this._ctx);
					}
					this.state = 1863;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1862;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1867;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 20:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1868;
				this.match(SolidCashParser.T__69);
				this.state = 1869;
				this.match(SolidCashParser.T__11);
				this.state = 1870;
				this.match(SolidCashParser.Identifier);
				this.state = 1871;
				this.match(SolidCashParser.T__11);
				this.state = 1872;
				this.match(SolidCashParser.Identifier);
				this.state = 1873;
				this.match(SolidCashParser.T__57);
				this.state = 1874;
				this.expression(0);
				this.state = 1875;
				this.match(SolidCashParser.T__58);
				this.state = 1876;
				this.memberName();
				}
				break;
			case 21:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1878;
				this.match(SolidCashParser.T__69);
				this.state = 1879;
				this.match(SolidCashParser.T__11);
				this.state = 1880;
				this.match(SolidCashParser.Identifier);
				this.state = 1885;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 1881;
						this.match(SolidCashParser.T__57);
						this.state = 1882;
						this.expression(0);
						this.state = 1883;
						this.match(SolidCashParser.T__58);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 1887;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 189, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 22:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1889;
				this.match(SolidCashParser.T__69);
				this.state = 1890;
				this.match(SolidCashParser.T__11);
				this.state = 1891;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 23:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1892;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 24:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1893;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 25:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1894;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 1972;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 193, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 1970;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 192, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1897;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 1898;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 1899;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1900;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 1901;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1902;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1903;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 1904;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1905;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1906;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 1907;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===128 || _la===129)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1908;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1909;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 1910;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1911;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1912;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 1913;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1914;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1915;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 1916;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 1917;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1918;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 1919;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 1920;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1921;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 1922;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 1923;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1924;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 1925;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__129);
						this.state = 1926;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1927;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 1928;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__130);
						this.state = 1929;
						(localctx as BinaryOpContext)._right = this.expression(10);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1930;
						if (!(this.precpred(this._ctx, 8))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 8)");
						}
						this.state = 1931;
						this.match(SolidCashParser.T__131);
						this.state = 1932;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 1933;
						this.match(SolidCashParser.T__93);
						this.state = 1934;
						(localctx as TernaryOpContext)._ifFalse = this.expression(8);
						}
						break;
					case 13:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1936;
						if (!(this.precpred(this._ctx, 29))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 29)");
						}
						this.state = 1937;
						this.match(SolidCashParser.T__57);
						this.state = 1938;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 1939;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 14:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1940;
						if (!(this.precpred(this._ctx, 28))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 28)");
						}
						this.state = 1941;
						this.match(SolidCashParser.T__57);
						this.state = 1942;
						this.expression(0);
						this.state = 1943;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 15:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1945;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 1946;
						(localctx as UnaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===123 || _la===124)) {
						    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						}
						break;
					case 16:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1947;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 1948;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__124);
						this.state = 1949;
						this.match(SolidCashParser.T__38);
						this.state = 1950;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 1951;
						this.match(SolidCashParser.T__39);
						}
						break;
					case 17:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1953;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 1954;
						this.match(SolidCashParser.T__125);
						this.state = 1955;
						this.match(SolidCashParser.T__38);
						this.state = 1956;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 1957;
						this.match(SolidCashParser.T__4);
						this.state = 1958;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 1959;
						this.match(SolidCashParser.T__39);
						}
						break;
					case 18:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1961;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 1962;
						this.match(SolidCashParser.T__11);
						this.state = 1963;
						this.match(SolidCashParser.Identifier);
						this.state = 1965;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 1964;
							this.callOptions();
							}
						}

						this.state = 1967;
						this.expressionList();
						}
						break;
					case 19:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1968;
						if (!(this.precpred(this._ctx, 21))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 21)");
						}
						this.state = 1969;
						this.memberName();
						}
						break;
					}
					}
				}
				this.state = 1974;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 193, this._ctx);
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
		this.enterRule(localctx, 218, SolidCashParser.RULE_memberName);
		try {
			this.state = 1988;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1975;
				this.match(SolidCashParser.T__11);
				this.state = 1976;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 113:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1977;
				this.match(SolidCashParser.T__112);
				}
				break;
			case 114:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1978;
				this.match(SolidCashParser.T__113);
				}
				break;
			case 115:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1979;
				this.match(SolidCashParser.T__114);
				}
				break;
			case 116:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1980;
				this.match(SolidCashParser.T__115);
				}
				break;
			case 117:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1981;
				this.match(SolidCashParser.T__116);
				}
				break;
			case 119:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1982;
				this.match(SolidCashParser.T__118);
				}
				break;
			case 120:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1983;
				this.match(SolidCashParser.T__119);
				}
				break;
			case 121:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1984;
				this.match(SolidCashParser.T__120);
				}
				break;
			case 122:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1985;
				this.match(SolidCashParser.T__121);
				}
				break;
			case 133:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1986;
				this.match(SolidCashParser.T__132);
				}
				break;
			case 134:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1987;
				this.match(SolidCashParser.T__133);
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
		this.enterRule(localctx, 220, SolidCashParser.RULE_modifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1990;
			_la = this._input.LA(1);
			if(!(_la===47 || ((((_la - 135)) & ~0x1F) === 0 && ((1 << (_la - 135)) & 15) !== 0))) {
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
		this.enterRule(localctx, 222, SolidCashParser.RULE_literal);
		try {
			let _alt: number;
			this.state = 2006;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 143:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1992;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 146:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1993;
				this.numberLiteral();
				}
				break;
			case 145:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1994;
				this.decimalLiteral();
				}
				break;
			case 153:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1995;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1999;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 195, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1996;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2001;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 195, this._ctx);
				}
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2002;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 164:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2003;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 154:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2004;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 155:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2005;
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
		this.enterRule(localctx, 224, SolidCashParser.RULE_numberLiteral);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2008;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2010;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 197, this._ctx) ) {
			case 1:
				{
				this.state = 2009;
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
		this.enterRule(localctx, 226, SolidCashParser.RULE_decimalLiteral);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2012;
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
		this.enterRule(localctx, 228, SolidCashParser.RULE_typeName);
		try {
			this.state = 2027;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 198, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2014;
				this.match(SolidCashParser.T__138);
				this.state = 2015;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2016;
				this.match(SolidCashParser.T__138);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2017;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2018;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2019;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2020;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2021;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2022;
				this.match(SolidCashParser.T__139);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2023;
				this.match(SolidCashParser.T__140);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2024;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2025;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2026;
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
		this.enterRule(localctx, 230, SolidCashParser.RULE_typeCast);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2029;
			_la = this._input.LA(1);
			if(!(_la===50 || ((((_la - 139)) & ~0x1F) === 0 && ((1 << (_la - 139)) & 8133639) !== 0))) {
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
		case 108:
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
			return this.precpred(this._ctx, 29);
		case 15:
			return this.precpred(this._ctx, 28);
		case 16:
			return this.precpred(this._ctx, 25);
		case 17:
			return this.precpred(this._ctx, 24);
		case 18:
			return this.precpred(this._ctx, 23);
		case 19:
			return this.precpred(this._ctx, 22);
		case 20:
			return this.precpred(this._ctx, 21);
		}
		return true;
	}

	public static readonly _serializedATN: number[] = [4,1,168,2032,2,0,7,0,
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
	7,115,1,0,5,0,234,8,0,10,0,12,0,237,9,0,1,0,5,0,240,8,0,10,0,12,0,243,9,
	0,1,0,5,0,246,8,0,10,0,12,0,249,9,0,1,0,5,0,252,8,0,10,0,12,0,255,9,0,1,
	0,5,0,258,8,0,10,0,12,0,261,9,0,1,0,5,0,264,8,0,10,0,12,0,267,9,0,1,0,5,
	0,270,8,0,10,0,12,0,273,9,0,1,0,5,0,276,8,0,10,0,12,0,279,9,0,1,0,5,0,282,
	8,0,10,0,12,0,285,9,0,1,0,5,0,288,8,0,10,0,12,0,291,9,0,1,0,5,0,294,8,0,
	10,0,12,0,297,9,0,1,0,1,0,3,0,301,8,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,5,1,318,8,1,10,1,12,1,321,9,1,1,1,3,1,324,8,1,
	1,1,1,1,1,1,1,1,1,1,3,1,331,8,1,1,2,1,2,1,2,3,2,336,8,2,1,3,1,3,1,3,1,3,
	3,3,342,8,3,1,3,1,3,5,3,346,8,3,10,3,12,3,349,9,3,1,3,1,3,1,4,1,4,1,4,1,
	4,1,4,3,4,358,8,4,1,4,3,4,361,8,4,1,4,1,4,1,4,1,4,1,4,1,4,5,4,369,8,4,10,
	4,12,4,372,9,4,1,4,3,4,375,8,4,1,4,1,4,1,4,1,4,3,4,381,8,4,1,4,3,4,384,
	8,4,1,4,1,4,3,4,388,8,4,1,5,1,5,1,5,3,5,393,8,5,1,5,1,5,3,5,397,8,5,1,6,
	1,6,1,7,1,7,1,7,1,7,1,7,1,8,1,8,1,9,1,9,3,9,410,8,9,1,10,3,10,413,8,10,
	1,10,1,10,1,11,1,11,1,12,1,12,1,12,1,12,1,12,1,12,5,12,425,8,12,10,12,12,
	12,428,9,12,3,12,430,8,12,1,12,1,12,5,12,434,8,12,10,12,12,12,437,9,12,
	1,12,5,12,440,8,12,10,12,12,12,443,9,12,1,12,5,12,446,8,12,10,12,12,12,
	449,9,12,1,12,5,12,452,8,12,10,12,12,12,455,9,12,1,12,5,12,458,8,12,10,
	12,12,12,461,9,12,1,12,5,12,464,8,12,10,12,12,12,467,9,12,1,12,5,12,470,
	8,12,10,12,12,12,473,9,12,1,12,1,12,1,13,1,13,1,13,1,13,1,13,1,13,1,13,
	1,13,1,13,1,13,3,13,487,8,13,1,14,1,14,1,14,1,14,1,14,1,15,1,15,1,16,1,
	16,1,16,1,16,3,16,500,8,16,1,16,1,16,1,17,1,17,1,17,1,17,5,17,508,8,17,
	10,17,12,17,511,9,17,1,17,5,17,514,8,17,10,17,12,17,517,9,17,1,17,5,17,
	520,8,17,10,17,12,17,523,9,17,1,17,5,17,526,8,17,10,17,12,17,529,9,17,1,
	17,5,17,532,8,17,10,17,12,17,535,9,17,1,17,5,17,538,8,17,10,17,12,17,541,
	9,17,1,17,1,17,1,18,3,18,546,8,18,1,18,1,18,1,18,3,18,551,8,18,1,18,1,18,
	1,18,1,18,5,18,557,8,18,10,18,12,18,560,9,18,3,18,562,8,18,1,18,1,18,5,
	18,566,8,18,10,18,12,18,569,9,18,1,18,5,18,572,8,18,10,18,12,18,575,9,18,
	1,18,5,18,578,8,18,10,18,12,18,581,9,18,1,18,5,18,584,8,18,10,18,12,18,
	587,9,18,1,18,5,18,590,8,18,10,18,12,18,593,9,18,1,18,5,18,596,8,18,10,
	18,12,18,599,9,18,1,18,5,18,602,8,18,10,18,12,18,605,9,18,1,18,5,18,608,
	8,18,10,18,12,18,611,9,18,1,18,5,18,614,8,18,10,18,12,18,617,9,18,1,18,
	3,18,620,8,18,1,18,1,18,5,18,624,8,18,10,18,12,18,627,9,18,1,18,3,18,630,
	8,18,1,18,3,18,633,8,18,1,18,1,18,1,19,1,19,1,19,1,19,5,19,641,8,19,10,
	19,12,19,644,9,19,1,19,5,19,647,8,19,10,19,12,19,650,9,19,1,19,3,19,653,
	8,19,1,19,1,19,1,20,1,20,1,20,1,20,1,20,1,20,5,20,663,8,20,10,20,12,20,
	666,9,20,1,20,3,20,669,8,20,3,20,671,8,20,1,20,1,20,3,20,675,8,20,1,20,
	1,20,1,21,1,21,3,21,681,8,21,1,21,1,21,1,22,1,22,1,22,1,22,1,22,1,22,5,
	22,691,8,22,10,22,12,22,694,9,22,1,22,3,22,697,8,22,3,22,699,8,22,1,22,
	1,22,1,22,1,23,1,23,1,23,1,24,1,24,1,24,1,24,4,24,711,8,24,11,24,12,24,
	712,1,24,1,24,1,25,1,25,1,25,1,25,1,26,1,26,1,26,1,26,1,26,1,26,5,26,727,
	8,26,10,26,12,26,730,9,26,1,26,3,26,733,8,26,1,26,1,26,1,27,1,27,1,27,3,
	27,740,8,27,1,28,1,28,1,28,1,28,1,28,1,28,1,29,1,29,1,29,1,29,1,29,1,29,
	1,29,1,30,1,30,1,30,5,30,758,8,30,10,30,12,30,761,9,30,1,30,1,30,5,30,765,
	8,30,10,30,12,30,768,9,30,1,30,1,30,1,31,1,31,1,31,1,31,5,31,776,8,31,10,
	31,12,31,779,9,31,1,31,5,31,782,8,31,10,31,12,31,785,9,31,1,31,1,31,5,31,
	789,8,31,10,31,12,31,792,9,31,1,31,1,31,1,32,1,32,1,33,1,33,1,33,1,33,1,
	33,1,33,1,33,5,33,805,8,33,10,33,12,33,808,9,33,1,33,1,33,1,34,1,34,1,34,
	1,35,3,35,816,8,35,1,35,1,35,5,35,820,8,35,10,35,12,35,823,9,35,1,35,1,
	35,1,35,1,35,1,35,1,35,5,35,831,8,35,10,35,12,35,834,9,35,1,35,1,35,1,35,
	1,35,3,35,840,8,35,1,35,1,35,5,35,844,8,35,10,35,12,35,847,9,35,1,35,1,
	35,1,35,1,35,3,35,853,8,35,1,35,1,35,5,35,857,8,35,10,35,12,35,860,9,35,
	1,35,1,35,1,35,3,35,865,8,35,1,36,1,36,3,36,869,8,36,1,37,1,37,1,38,1,38,
	1,38,1,38,3,38,877,8,38,1,38,1,38,1,38,3,38,882,8,38,1,38,1,38,1,38,1,38,
	1,38,1,38,3,38,890,8,38,1,38,1,38,1,38,1,38,1,38,1,38,1,38,1,38,3,38,900,
	8,38,1,38,1,38,1,38,3,38,905,8,38,1,38,1,38,3,38,909,8,38,1,39,1,39,1,39,
	1,39,1,39,1,39,1,39,1,39,1,39,1,39,3,39,921,8,39,1,39,1,39,1,39,1,39,1,
	39,1,39,1,39,5,39,930,8,39,10,39,12,39,933,9,39,1,40,1,40,1,40,3,40,938,
	8,40,1,40,1,40,5,40,942,8,40,10,40,12,40,945,9,40,1,40,1,40,1,41,1,41,3,
	41,951,8,41,1,42,1,42,1,42,1,43,1,43,1,43,1,43,5,43,960,8,43,10,43,12,43,
	963,9,43,1,43,5,43,966,8,43,10,43,12,43,969,9,43,1,43,3,43,972,8,43,1,43,
	1,43,5,43,976,8,43,10,43,12,43,979,9,43,1,43,1,43,1,44,1,44,3,44,985,8,
	44,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,
	3,45,1001,8,45,1,46,1,46,1,46,1,46,3,46,1007,8,46,1,47,1,47,1,47,1,47,5,
	47,1013,8,47,10,47,12,47,1016,9,47,1,47,1,47,1,47,5,47,1021,8,47,10,47,
	12,47,1024,9,47,5,47,1026,8,47,10,47,12,47,1029,9,47,1,47,3,47,1032,8,47,
	1,47,1,47,1,48,1,48,1,48,1,48,5,48,1040,8,48,10,48,12,48,1043,9,48,1,48,
	3,48,1046,8,48,3,48,1048,8,48,1,48,1,48,1,49,1,49,5,49,1054,8,49,10,49,
	12,49,1057,9,49,1,49,1,49,1,49,1,49,5,49,1063,8,49,10,49,12,49,1066,9,49,
	1,49,1,49,3,49,1070,8,49,1,50,1,50,5,50,1074,8,50,10,50,12,50,1077,9,50,
	1,50,1,50,3,50,1081,8,50,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,
	51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,
	1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,3,51,1116,8,51,1,52,1,52,1,
	52,1,52,1,52,1,52,1,52,1,52,1,52,1,52,1,53,1,53,1,53,1,53,1,53,1,53,1,53,
	1,53,1,53,1,53,1,53,1,53,5,53,1140,8,53,10,53,12,53,1143,9,53,1,53,1,53,
	1,53,1,54,1,54,1,54,1,54,5,54,1152,8,54,10,54,12,54,1155,9,54,1,54,1,54,
	1,54,1,54,1,54,1,54,1,54,5,54,1164,8,54,10,54,12,54,1167,9,54,1,54,3,54,
	1170,8,54,1,54,1,54,1,54,3,54,1175,8,54,1,55,1,55,1,55,1,55,1,55,1,55,1,
	55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,3,55,1194,8,55,1,55,
	1,55,1,55,3,55,1199,8,55,1,56,1,56,1,56,1,56,3,56,1205,8,56,1,56,1,56,1,
	56,1,57,1,57,1,57,1,57,1,57,1,58,1,58,1,58,1,58,1,58,1,58,1,58,4,58,1222,
	8,58,11,58,12,58,1223,1,58,1,58,1,58,1,58,1,59,1,59,1,59,1,59,1,59,1,59,
	1,59,4,59,1237,8,59,11,59,12,59,1238,1,59,1,59,1,59,1,59,1,59,1,59,1,60,
	1,60,1,60,1,60,1,60,1,60,1,60,5,60,1254,8,60,10,60,12,60,1257,9,60,1,60,
	1,60,1,60,1,60,1,60,1,60,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,62,1,62,5,
	62,1274,8,62,10,62,12,62,1277,9,62,1,62,1,62,1,62,1,62,1,62,1,62,1,62,5,
	62,1286,8,62,10,62,12,62,1289,9,62,1,62,1,62,1,62,1,62,1,62,3,62,1296,8,
	62,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1304,8,63,11,63,12,63,1305,1,63,1,
	63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1319,8,63,11,63,12,
	63,1320,1,63,1,63,1,63,1,63,1,63,3,63,1328,8,63,1,64,1,64,1,64,1,64,1,64,
	1,64,1,64,1,64,3,64,1338,8,64,1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,66,1,
	66,1,66,1,66,1,66,1,66,1,67,1,67,1,67,1,67,1,67,1,67,1,67,1,67,1,68,1,68,
	1,68,1,68,1,68,1,68,1,68,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,
	70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,71,1,71,1,71,1,71,1,71,1,71,1,71,
	1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,4,71,1401,8,71,11,71,12,71,
	1402,1,71,1,71,3,71,1407,8,71,1,72,1,72,1,72,1,72,1,72,1,72,1,72,3,72,1416,
	8,72,1,72,1,72,1,72,1,73,1,73,1,73,1,73,1,73,3,73,1426,8,73,1,73,1,73,1,
	73,1,74,1,74,1,74,1,74,1,74,1,74,1,74,3,74,1438,8,74,1,75,1,75,1,75,1,75,
	1,75,1,75,3,75,1446,8,75,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,
	76,1,76,1,76,1,76,1,76,1,76,1,76,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,
	1,77,1,77,1,77,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,
	79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,80,1,80,5,80,1496,8,80,10,80,12,
	80,1499,9,80,1,80,1,80,1,80,1,80,1,80,1,81,1,81,1,81,1,82,1,82,1,82,1,82,
	1,82,3,82,1514,8,82,1,83,1,83,1,83,1,83,1,83,1,83,1,83,1,83,1,84,1,84,1,
	84,1,84,1,84,1,84,1,85,1,85,1,85,1,85,1,86,1,86,1,86,5,86,1537,8,86,10,
	86,12,86,1540,9,86,1,86,1,86,1,87,1,87,1,88,1,88,1,88,5,88,1549,8,88,10,
	88,12,88,1552,9,88,1,88,1,88,1,89,1,89,1,89,1,89,1,89,1,89,5,89,1562,8,
	89,10,89,12,89,1565,9,89,1,89,3,89,1568,8,89,1,89,1,89,1,90,1,90,1,90,1,
	90,5,90,1576,8,90,10,90,12,90,1579,9,90,1,91,1,91,1,91,5,91,1584,8,91,10,
	91,12,91,1587,9,91,1,92,1,92,1,92,3,92,1592,8,92,1,92,1,92,4,92,1596,8,
	92,11,92,12,92,1597,1,93,1,93,1,93,1,93,1,93,5,93,1605,8,93,10,93,12,93,
	1608,9,93,1,93,3,93,1611,8,93,3,93,1613,8,93,1,93,1,93,1,94,1,94,3,94,1619,
	8,94,1,94,1,94,1,94,1,94,5,94,1625,8,94,10,94,12,94,1628,9,94,1,94,3,94,
	1631,8,94,3,94,1633,8,94,1,94,3,94,1636,8,94,1,94,1,94,1,95,1,95,1,95,1,
	96,1,96,1,96,1,97,1,97,1,98,1,98,1,98,1,98,1,98,1,98,1,98,1,98,1,98,1,98,
	1,98,1,98,1,98,1,98,3,98,1662,8,98,1,99,1,99,1,99,1,99,1,99,1,99,1,100,
	1,100,3,100,1672,8,100,1,101,1,101,1,101,1,101,5,101,1678,8,101,10,101,
	12,101,1681,9,101,1,101,3,101,1684,8,101,3,101,1686,8,101,1,101,1,101,1,
	102,1,102,1,102,1,102,1,102,1,102,1,102,1,102,1,102,1,102,1,102,1,102,5,
	102,1702,8,102,10,102,12,102,1705,9,102,1,102,3,102,1708,8,102,3,102,1710,
	8,102,1,102,1,102,3,102,1714,8,102,1,103,1,103,1,103,1,103,1,104,1,104,
	1,104,1,104,5,104,1724,8,104,10,104,12,104,1727,9,104,1,104,3,104,1730,
	8,104,3,104,1732,8,104,1,104,1,104,1,105,1,105,1,105,1,105,5,105,1740,8,
	105,10,105,12,105,1743,9,105,1,105,3,105,1746,8,105,1,105,1,105,1,106,1,
	106,1,106,1,106,1,107,1,107,1,107,1,107,5,107,1758,8,107,10,107,12,107,
	1761,9,107,1,107,3,107,1764,8,107,1,107,1,107,1,108,1,108,1,108,1,108,1,
	108,1,108,1,108,1,108,1,108,3,108,1777,8,108,1,108,1,108,1,108,1,108,1,
	108,1,108,3,108,1785,8,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,
	108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,
	108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,
	108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,
	108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,
	108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,
	108,1,108,1,108,1,108,5,108,1858,8,108,10,108,12,108,1861,9,108,1,108,3,
	108,1864,8,108,3,108,1866,8,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,
	1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,4,108,
	1886,8,108,11,108,12,108,1887,1,108,1,108,1,108,1,108,1,108,1,108,3,108,
	1896,8,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,
	1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,
	1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,
	1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,
	1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,
	1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,3,108,1966,
	8,108,1,108,1,108,1,108,5,108,1971,8,108,10,108,12,108,1974,9,108,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	3,109,1989,8,109,1,110,1,110,1,111,1,111,1,111,1,111,1,111,5,111,1998,8,
	111,10,111,12,111,2001,9,111,1,111,1,111,1,111,1,111,3,111,2007,8,111,1,
	112,1,112,3,112,2011,8,112,1,113,1,113,1,114,1,114,1,114,1,114,1,114,1,
	114,1,114,1,114,1,114,1,114,1,114,1,114,1,114,3,114,2028,8,114,1,115,1,
	115,1,115,0,2,78,216,116,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,
	34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,
	82,84,86,88,90,92,94,96,98,100,102,104,106,108,110,112,114,116,118,120,
	122,124,126,128,130,132,134,136,138,140,142,144,146,148,150,152,154,156,
	158,160,162,164,166,168,170,172,174,176,178,180,182,184,186,188,190,192,
	194,196,198,200,202,204,206,208,210,212,214,216,218,220,222,224,226,228,
	230,0,19,2,0,10,10,13,27,3,0,20,23,26,27,30,30,1,0,33,34,1,0,50,52,2,0,
	33,34,54,55,2,0,30,30,74,75,1,0,76,77,3,0,146,146,155,155,165,165,1,0,113,
	117,2,0,113,117,119,122,3,0,14,14,27,27,127,127,2,0,10,10,15,16,1,0,13,
	14,1,0,128,129,1,0,20,23,1,0,18,19,1,0,123,124,2,0,47,47,135,138,4,0,50,
	50,139,141,149,151,157,161,2235,0,235,1,0,0,0,2,330,1,0,0,0,4,332,1,0,0,
	0,6,337,1,0,0,0,8,387,1,0,0,0,10,389,1,0,0,0,12,398,1,0,0,0,14,400,1,0,
	0,0,16,405,1,0,0,0,18,407,1,0,0,0,20,412,1,0,0,0,22,416,1,0,0,0,24,418,
	1,0,0,0,26,486,1,0,0,0,28,488,1,0,0,0,30,493,1,0,0,0,32,495,1,0,0,0,34,
	503,1,0,0,0,36,545,1,0,0,0,38,636,1,0,0,0,40,656,1,0,0,0,42,678,1,0,0,0,
	44,684,1,0,0,0,46,703,1,0,0,0,48,706,1,0,0,0,50,716,1,0,0,0,52,720,1,0,
	0,0,54,736,1,0,0,0,56,741,1,0,0,0,58,747,1,0,0,0,60,754,1,0,0,0,62,771,
	1,0,0,0,64,795,1,0,0,0,66,797,1,0,0,0,68,811,1,0,0,0,70,864,1,0,0,0,72,
	868,1,0,0,0,74,870,1,0,0,0,76,908,1,0,0,0,78,920,1,0,0,0,80,934,1,0,0,0,
	82,950,1,0,0,0,84,952,1,0,0,0,86,955,1,0,0,0,88,982,1,0,0,0,90,1000,1,0,
	0,0,92,1002,1,0,0,0,94,1008,1,0,0,0,96,1035,1,0,0,0,98,1069,1,0,0,0,100,
	1080,1,0,0,0,102,1115,1,0,0,0,104,1117,1,0,0,0,106,1127,1,0,0,0,108,1174,
	1,0,0,0,110,1198,1,0,0,0,112,1200,1,0,0,0,114,1209,1,0,0,0,116,1214,1,0,
	0,0,118,1229,1,0,0,0,120,1246,1,0,0,0,122,1264,1,0,0,0,124,1295,1,0,0,0,
	126,1327,1,0,0,0,128,1337,1,0,0,0,130,1339,1,0,0,0,132,1346,1,0,0,0,134,
	1352,1,0,0,0,136,1360,1,0,0,0,138,1367,1,0,0,0,140,1376,1,0,0,0,142,1406,
	1,0,0,0,144,1408,1,0,0,0,146,1420,1,0,0,0,148,1430,1,0,0,0,150,1445,1,0,
	0,0,152,1447,1,0,0,0,154,1463,1,0,0,0,156,1474,1,0,0,0,158,1485,1,0,0,0,
	160,1493,1,0,0,0,162,1505,1,0,0,0,164,1513,1,0,0,0,166,1515,1,0,0,0,168,
	1523,1,0,0,0,170,1529,1,0,0,0,172,1533,1,0,0,0,174,1543,1,0,0,0,176,1545,
	1,0,0,0,178,1555,1,0,0,0,180,1571,1,0,0,0,182,1580,1,0,0,0,184,1588,1,0,
	0,0,186,1599,1,0,0,0,188,1616,1,0,0,0,190,1639,1,0,0,0,192,1642,1,0,0,0,
	194,1645,1,0,0,0,196,1661,1,0,0,0,198,1663,1,0,0,0,200,1671,1,0,0,0,202,
	1673,1,0,0,0,204,1713,1,0,0,0,206,1715,1,0,0,0,208,1719,1,0,0,0,210,1735,
	1,0,0,0,212,1749,1,0,0,0,214,1753,1,0,0,0,216,1895,1,0,0,0,218,1988,1,0,
	0,0,220,1990,1,0,0,0,222,2006,1,0,0,0,224,2008,1,0,0,0,226,2012,1,0,0,0,
	228,2027,1,0,0,0,230,2029,1,0,0,0,232,234,3,14,7,0,233,232,1,0,0,0,234,
	237,1,0,0,0,235,233,1,0,0,0,235,236,1,0,0,0,236,241,1,0,0,0,237,235,1,0,
	0,0,238,240,3,2,1,0,239,238,1,0,0,0,240,243,1,0,0,0,241,239,1,0,0,0,241,
	242,1,0,0,0,242,247,1,0,0,0,243,241,1,0,0,0,244,246,3,58,29,0,245,244,1,
	0,0,0,246,249,1,0,0,0,247,245,1,0,0,0,247,248,1,0,0,0,248,253,1,0,0,0,249,
	247,1,0,0,0,250,252,3,52,26,0,251,250,1,0,0,0,252,255,1,0,0,0,253,251,1,
	0,0,0,253,254,1,0,0,0,254,259,1,0,0,0,255,253,1,0,0,0,256,258,3,48,24,0,
	257,256,1,0,0,0,258,261,1,0,0,0,259,257,1,0,0,0,259,260,1,0,0,0,260,265,
	1,0,0,0,261,259,1,0,0,0,262,264,3,56,28,0,263,262,1,0,0,0,264,267,1,0,0,
	0,265,263,1,0,0,0,265,266,1,0,0,0,266,271,1,0,0,0,267,265,1,0,0,0,268,270,
	3,8,4,0,269,268,1,0,0,0,270,273,1,0,0,0,271,269,1,0,0,0,271,272,1,0,0,0,
	272,277,1,0,0,0,273,271,1,0,0,0,274,276,3,44,22,0,275,274,1,0,0,0,276,279,
	1,0,0,0,277,275,1,0,0,0,277,278,1,0,0,0,278,283,1,0,0,0,279,277,1,0,0,0,
	280,282,3,24,12,0,281,280,1,0,0,0,282,285,1,0,0,0,283,281,1,0,0,0,283,284,
	1,0,0,0,284,289,1,0,0,0,285,283,1,0,0,0,286,288,3,6,3,0,287,286,1,0,0,0,
	288,291,1,0,0,0,289,287,1,0,0,0,289,290,1,0,0,0,290,295,1,0,0,0,291,289,
	1,0,0,0,292,294,3,34,17,0,293,292,1,0,0,0,294,297,1,0,0,0,295,293,1,0,0,
	0,295,296,1,0,0,0,296,300,1,0,0,0,297,295,1,0,0,0,298,301,3,36,18,0,299,
	301,3,34,17,0,300,298,1,0,0,0,300,299,1,0,0,0,301,302,1,0,0,0,302,303,5,
	0,0,1,303,1,1,0,0,0,304,305,5,1,0,0,305,306,5,153,0,0,306,331,5,2,0,0,307,
	308,5,1,0,0,308,309,5,153,0,0,309,310,5,3,0,0,310,311,5,165,0,0,311,331,
	5,2,0,0,312,313,5,1,0,0,313,314,5,4,0,0,314,319,3,4,2,0,315,316,5,5,0,0,
	316,318,3,4,2,0,317,315,1,0,0,0,318,321,1,0,0,0,319,317,1,0,0,0,319,320,
	1,0,0,0,320,323,1,0,0,0,321,319,1,0,0,0,322,324,5,5,0,0,323,322,1,0,0,0,
	323,324,1,0,0,0,324,325,1,0,0,0,325,326,5,6,0,0,326,327,5,165,0,0,327,328,
	5,153,0,0,328,329,5,2,0,0,329,331,1,0,0,0,330,304,1,0,0,0,330,307,1,0,0,
	0,330,312,1,0,0,0,331,3,1,0,0,0,332,335,5,165,0,0,333,334,5,3,0,0,334,336,
	5,165,0,0,335,333,1,0,0,0,335,336,1,0,0,0,336,5,1,0,0,0,337,338,5,7,0,0,
	338,339,5,165,0,0,339,341,3,96,48,0,340,342,3,94,47,0,341,340,1,0,0,0,341,
	342,1,0,0,0,342,343,1,0,0,0,343,347,5,4,0,0,344,346,3,102,51,0,345,344,
	1,0,0,0,346,349,1,0,0,0,347,345,1,0,0,0,347,348,1,0,0,0,348,350,1,0,0,0,
	349,347,1,0,0,0,350,351,5,6,0,0,351,7,1,0,0,0,352,353,5,8,0,0,353,354,5,
	165,0,0,354,357,5,9,0,0,355,358,3,228,114,0,356,358,5,10,0,0,357,355,1,
	0,0,0,357,356,1,0,0,0,358,360,1,0,0,0,359,361,5,11,0,0,360,359,1,0,0,0,
	360,361,1,0,0,0,361,362,1,0,0,0,362,388,5,2,0,0,363,364,5,8,0,0,364,365,
	5,4,0,0,365,370,3,10,5,0,366,367,5,5,0,0,367,369,3,10,5,0,368,366,1,0,0,
	0,369,372,1,0,0,0,370,368,1,0,0,0,370,371,1,0,0,0,371,374,1,0,0,0,372,370,
	1,0,0,0,373,375,5,5,0,0,374,373,1,0,0,0,374,375,1,0,0,0,375,376,1,0,0,0,
	376,377,5,6,0,0,377,380,5,9,0,0,378,381,3,228,114,0,379,381,5,10,0,0,380,
	378,1,0,0,0,380,379,1,0,0,0,381,383,1,0,0,0,382,384,5,11,0,0,383,382,1,
	0,0,0,383,384,1,0,0,0,384,385,1,0,0,0,385,386,5,2,0,0,386,388,1,0,0,0,387,
	352,1,0,0,0,387,363,1,0,0,0,388,9,1,0,0,0,389,392,5,165,0,0,390,391,5,12,
	0,0,391,393,5,165,0,0,392,390,1,0,0,0,392,393,1,0,0,0,393,396,1,0,0,0,394,
	395,5,3,0,0,395,397,3,12,6,0,396,394,1,0,0,0,396,397,1,0,0,0,397,11,1,0,
	0,0,398,399,7,0,0,0,399,13,1,0,0,0,400,401,5,28,0,0,401,402,3,16,8,0,402,
	403,3,18,9,0,403,404,5,2,0,0,404,15,1,0,0,0,405,406,5,29,0,0,406,17,1,0,
	0,0,407,409,3,20,10,0,408,410,3,20,10,0,409,408,1,0,0,0,409,410,1,0,0,0,
	410,19,1,0,0,0,411,413,3,22,11,0,412,411,1,0,0,0,412,413,1,0,0,0,413,414,
	1,0,0,0,414,415,5,142,0,0,415,21,1,0,0,0,416,417,7,1,0,0,417,23,1,0,0,0,
	418,419,5,31,0,0,419,429,5,165,0,0,420,421,5,32,0,0,421,426,5,165,0,0,422,
	423,5,5,0,0,423,425,5,165,0,0,424,422,1,0,0,0,425,428,1,0,0,0,426,424,1,
	0,0,0,426,427,1,0,0,0,427,430,1,0,0,0,428,426,1,0,0,0,429,420,1,0,0,0,429,
	430,1,0,0,0,430,431,1,0,0,0,431,435,5,4,0,0,432,434,3,52,26,0,433,432,1,
	0,0,0,434,437,1,0,0,0,435,433,1,0,0,0,435,436,1,0,0,0,436,441,1,0,0,0,437,
	435,1,0,0,0,438,440,3,48,24,0,439,438,1,0,0,0,440,443,1,0,0,0,441,439,1,
	0,0,0,441,442,1,0,0,0,442,447,1,0,0,0,443,441,1,0,0,0,444,446,3,56,28,0,
	445,444,1,0,0,0,446,449,1,0,0,0,447,445,1,0,0,0,447,448,1,0,0,0,448,453,
	1,0,0,0,449,447,1,0,0,0,450,452,3,40,20,0,451,450,1,0,0,0,452,455,1,0,0,
	0,453,451,1,0,0,0,453,454,1,0,0,0,454,459,1,0,0,0,455,453,1,0,0,0,456,458,
	3,28,14,0,457,456,1,0,0,0,458,461,1,0,0,0,459,457,1,0,0,0,459,460,1,0,0,
	0,460,465,1,0,0,0,461,459,1,0,0,0,462,464,3,26,13,0,463,462,1,0,0,0,464,
	467,1,0,0,0,465,463,1,0,0,0,465,466,1,0,0,0,466,471,1,0,0,0,467,465,1,0,
	0,0,468,470,3,32,16,0,469,468,1,0,0,0,470,473,1,0,0,0,471,469,1,0,0,0,471,
	472,1,0,0,0,472,474,1,0,0,0,473,471,1,0,0,0,474,475,5,6,0,0,475,25,1,0,
	0,0,476,477,3,30,15,0,477,478,3,76,38,0,478,479,5,165,0,0,479,480,5,2,0,
	0,480,487,1,0,0,0,481,482,3,30,15,0,482,483,3,78,39,0,483,484,5,165,0,0,
	484,485,5,2,0,0,485,487,1,0,0,0,486,476,1,0,0,0,486,481,1,0,0,0,487,27,
	1,0,0,0,488,489,3,30,15,0,489,490,3,228,114,0,490,491,5,165,0,0,491,492,
	5,2,0,0,492,29,1,0,0,0,493,494,7,2,0,0,494,31,1,0,0,0,495,496,5,7,0,0,496,
	497,5,165,0,0,497,499,3,96,48,0,498,500,3,94,47,0,499,498,1,0,0,0,499,500,
	1,0,0,0,500,501,1,0,0,0,501,502,5,2,0,0,502,33,1,0,0,0,503,504,5,35,0,0,
	504,505,5,165,0,0,505,509,5,4,0,0,506,508,3,52,26,0,507,506,1,0,0,0,508,
	511,1,0,0,0,509,507,1,0,0,0,509,510,1,0,0,0,510,515,1,0,0,0,511,509,1,0,
	0,0,512,514,3,48,24,0,513,512,1,0,0,0,514,517,1,0,0,0,515,513,1,0,0,0,515,
	516,1,0,0,0,516,521,1,0,0,0,517,515,1,0,0,0,518,520,3,56,28,0,519,518,1,
	0,0,0,520,523,1,0,0,0,521,519,1,0,0,0,521,522,1,0,0,0,522,527,1,0,0,0,523,
	521,1,0,0,0,524,526,3,40,20,0,525,524,1,0,0,0,526,529,1,0,0,0,527,525,1,
	0,0,0,527,528,1,0,0,0,528,533,1,0,0,0,529,527,1,0,0,0,530,532,3,58,29,0,
	531,530,1,0,0,0,532,535,1,0,0,0,533,531,1,0,0,0,533,534,1,0,0,0,534,539,
	1,0,0,0,535,533,1,0,0,0,536,538,3,6,3,0,537,536,1,0,0,0,538,541,1,0,0,0,
	539,537,1,0,0,0,539,540,1,0,0,0,540,542,1,0,0,0,541,539,1,0,0,0,542,543,
	5,6,0,0,543,35,1,0,0,0,544,546,5,36,0,0,545,544,1,0,0,0,545,546,1,0,0,0,
	546,547,1,0,0,0,547,548,5,37,0,0,548,550,5,165,0,0,549,551,3,96,48,0,550,
	549,1,0,0,0,550,551,1,0,0,0,551,561,1,0,0,0,552,553,5,32,0,0,553,558,5,
	165,0,0,554,555,5,5,0,0,555,557,5,165,0,0,556,554,1,0,0,0,557,560,1,0,0,
	0,558,556,1,0,0,0,558,559,1,0,0,0,559,562,1,0,0,0,560,558,1,0,0,0,561,552,
	1,0,0,0,561,562,1,0,0,0,562,563,1,0,0,0,563,567,5,4,0,0,564,566,3,52,26,
	0,565,564,1,0,0,0,566,569,1,0,0,0,567,565,1,0,0,0,567,568,1,0,0,0,568,573,
	1,0,0,0,569,567,1,0,0,0,570,572,3,48,24,0,571,570,1,0,0,0,572,575,1,0,0,
	0,573,571,1,0,0,0,573,574,1,0,0,0,574,579,1,0,0,0,575,573,1,0,0,0,576,578,
	3,56,28,0,577,576,1,0,0,0,578,581,1,0,0,0,579,577,1,0,0,0,579,580,1,0,0,
	0,580,585,1,0,0,0,581,579,1,0,0,0,582,584,3,40,20,0,583,582,1,0,0,0,584,
	587,1,0,0,0,585,583,1,0,0,0,585,586,1,0,0,0,586,591,1,0,0,0,587,585,1,0,
	0,0,588,590,3,44,22,0,589,588,1,0,0,0,590,593,1,0,0,0,591,589,1,0,0,0,591,
	592,1,0,0,0,592,597,1,0,0,0,593,591,1,0,0,0,594,596,3,58,29,0,595,594,1,
	0,0,0,596,599,1,0,0,0,597,595,1,0,0,0,597,598,1,0,0,0,598,603,1,0,0,0,599,
	597,1,0,0,0,600,602,3,8,4,0,601,600,1,0,0,0,602,605,1,0,0,0,603,601,1,0,
	0,0,603,604,1,0,0,0,604,609,1,0,0,0,605,603,1,0,0,0,606,608,3,70,35,0,607,
	606,1,0,0,0,608,611,1,0,0,0,609,607,1,0,0,0,609,610,1,0,0,0,610,615,1,0,
	0,0,611,609,1,0,0,0,612,614,3,80,40,0,613,612,1,0,0,0,614,617,1,0,0,0,615,
	613,1,0,0,0,615,616,1,0,0,0,616,619,1,0,0,0,617,615,1,0,0,0,618,620,3,60,
	30,0,619,618,1,0,0,0,619,620,1,0,0,0,620,625,1,0,0,0,621,624,3,86,43,0,
	622,624,3,38,19,0,623,621,1,0,0,0,623,622,1,0,0,0,624,627,1,0,0,0,625,623,
	1,0,0,0,625,626,1,0,0,0,626,629,1,0,0,0,627,625,1,0,0,0,628,630,3,62,31,
	0,629,628,1,0,0,0,629,630,1,0,0,0,630,632,1,0,0,0,631,633,3,66,33,0,632,
	631,1,0,0,0,632,633,1,0,0,0,633,634,1,0,0,0,634,635,5,6,0,0,635,37,1,0,
	0,0,636,637,5,7,0,0,637,638,5,165,0,0,638,642,3,96,48,0,639,641,3,90,45,
	0,640,639,1,0,0,0,641,644,1,0,0,0,642,640,1,0,0,0,642,643,1,0,0,0,643,648,
	1,0,0,0,644,642,1,0,0,0,645,647,3,88,44,0,646,645,1,0,0,0,647,650,1,0,0,
	0,648,646,1,0,0,0,648,649,1,0,0,0,649,652,1,0,0,0,650,648,1,0,0,0,651,653,
	3,94,47,0,652,651,1,0,0,0,652,653,1,0,0,0,653,654,1,0,0,0,654,655,5,2,0,
	0,655,39,1,0,0,0,656,657,5,38,0,0,657,658,5,165,0,0,658,670,5,39,0,0,659,
	664,3,42,21,0,660,661,5,5,0,0,661,663,3,42,21,0,662,660,1,0,0,0,663,666,
	1,0,0,0,664,662,1,0,0,0,664,665,1,0,0,0,665,668,1,0,0,0,666,664,1,0,0,0,
	667,669,5,5,0,0,668,667,1,0,0,0,668,669,1,0,0,0,669,671,1,0,0,0,670,659,
	1,0,0,0,670,671,1,0,0,0,671,672,1,0,0,0,672,674,5,40,0,0,673,675,5,41,0,
	0,674,673,1,0,0,0,674,675,1,0,0,0,675,676,1,0,0,0,676,677,5,2,0,0,677,41,
	1,0,0,0,678,680,3,228,114,0,679,681,5,42,0,0,680,679,1,0,0,0,680,681,1,
	0,0,0,681,682,1,0,0,0,682,683,5,165,0,0,683,43,1,0,0,0,684,685,5,43,0,0,
	685,686,5,165,0,0,686,698,5,39,0,0,687,692,3,46,23,0,688,689,5,5,0,0,689,
	691,3,46,23,0,690,688,1,0,0,0,691,694,1,0,0,0,692,690,1,0,0,0,692,693,1,
	0,0,0,693,696,1,0,0,0,694,692,1,0,0,0,695,697,5,5,0,0,696,695,1,0,0,0,696,
	697,1,0,0,0,697,699,1,0,0,0,698,687,1,0,0,0,698,699,1,0,0,0,699,700,1,0,
	0,0,700,701,5,40,0,0,701,702,5,2,0,0,702,45,1,0,0,0,703,704,3,228,114,0,
	704,705,5,165,0,0,705,47,1,0,0,0,706,707,5,44,0,0,707,708,5,165,0,0,708,
	710,5,4,0,0,709,711,3,50,25,0,710,709,1,0,0,0,711,712,1,0,0,0,712,710,1,
	0,0,0,712,713,1,0,0,0,713,714,1,0,0,0,714,715,5,6,0,0,715,49,1,0,0,0,716,
	717,3,228,114,0,717,718,5,165,0,0,718,719,5,2,0,0,719,51,1,0,0,0,720,721,
	5,45,0,0,721,722,5,165,0,0,722,723,5,4,0,0,723,728,3,54,27,0,724,725,5,
	5,0,0,725,727,3,54,27,0,726,724,1,0,0,0,727,730,1,0,0,0,728,726,1,0,0,0,
	728,729,1,0,0,0,729,732,1,0,0,0,730,728,1,0,0,0,731,733,5,5,0,0,732,731,
	1,0,0,0,732,733,1,0,0,0,733,734,1,0,0,0,734,735,5,6,0,0,735,53,1,0,0,0,
	736,739,5,165,0,0,737,738,5,30,0,0,738,740,5,146,0,0,739,737,1,0,0,0,739,
	740,1,0,0,0,740,55,1,0,0,0,741,742,5,46,0,0,742,743,5,165,0,0,743,744,5,
	32,0,0,744,745,3,228,114,0,745,746,5,2,0,0,746,57,1,0,0,0,747,748,3,228,
	114,0,748,749,5,47,0,0,749,750,5,165,0,0,750,751,5,30,0,0,751,752,3,216,
	108,0,752,753,5,2,0,0,753,59,1,0,0,0,754,755,5,48,0,0,755,759,3,96,48,0,
	756,758,3,68,34,0,757,756,1,0,0,0,758,761,1,0,0,0,759,757,1,0,0,0,759,760,
	1,0,0,0,760,762,1,0,0,0,761,759,1,0,0,0,762,766,5,4,0,0,763,765,3,102,51,
	0,764,763,1,0,0,0,765,768,1,0,0,0,766,764,1,0,0,0,766,767,1,0,0,0,767,769,
	1,0,0,0,768,766,1,0,0,0,769,770,5,6,0,0,770,61,1,0,0,0,771,772,5,49,0,0,
	772,773,3,96,48,0,773,777,5,34,0,0,774,776,3,64,32,0,775,774,1,0,0,0,776,
	779,1,0,0,0,777,775,1,0,0,0,777,778,1,0,0,0,778,783,1,0,0,0,779,777,1,0,
	0,0,780,782,3,88,44,0,781,780,1,0,0,0,782,785,1,0,0,0,783,781,1,0,0,0,783,
	784,1,0,0,0,784,786,1,0,0,0,785,783,1,0,0,0,786,790,5,4,0,0,787,789,3,102,
	51,0,788,787,1,0,0,0,789,792,1,0,0,0,790,788,1,0,0,0,790,791,1,0,0,0,791,
	793,1,0,0,0,792,790,1,0,0,0,793,794,5,6,0,0,794,63,1,0,0,0,795,796,7,3,
	0,0,796,65,1,0,0,0,797,798,5,53,0,0,798,799,5,39,0,0,799,800,5,40,0,0,800,
	801,5,34,0,0,801,802,5,50,0,0,802,806,5,4,0,0,803,805,3,102,51,0,804,803,
	1,0,0,0,805,808,1,0,0,0,806,804,1,0,0,0,806,807,1,0,0,0,807,809,1,0,0,0,
	808,806,1,0,0,0,809,810,5,6,0,0,810,67,1,0,0,0,811,812,5,165,0,0,812,813,
	3,208,104,0,813,69,1,0,0,0,814,816,3,74,37,0,815,814,1,0,0,0,815,816,1,
	0,0,0,816,817,1,0,0,0,817,821,3,228,114,0,818,820,3,220,110,0,819,818,1,
	0,0,0,820,823,1,0,0,0,821,819,1,0,0,0,821,822,1,0,0,0,822,824,1,0,0,0,823,
	821,1,0,0,0,824,825,5,165,0,0,825,826,5,2,0,0,826,865,1,0,0,0,827,828,3,
	228,114,0,828,832,3,74,37,0,829,831,3,220,110,0,830,829,1,0,0,0,831,834,
	1,0,0,0,832,830,1,0,0,0,832,833,1,0,0,0,833,835,1,0,0,0,834,832,1,0,0,0,
	835,836,5,165,0,0,836,837,5,2,0,0,837,865,1,0,0,0,838,840,3,74,37,0,839,
	838,1,0,0,0,839,840,1,0,0,0,840,841,1,0,0,0,841,845,3,76,38,0,842,844,3,
	72,36,0,843,842,1,0,0,0,844,847,1,0,0,0,845,843,1,0,0,0,845,846,1,0,0,0,
	846,848,1,0,0,0,847,845,1,0,0,0,848,849,5,165,0,0,849,850,5,2,0,0,850,865,
	1,0,0,0,851,853,3,74,37,0,852,851,1,0,0,0,852,853,1,0,0,0,853,854,1,0,0,
	0,854,858,3,78,39,0,855,857,3,72,36,0,856,855,1,0,0,0,857,860,1,0,0,0,858,
	856,1,0,0,0,858,859,1,0,0,0,859,861,1,0,0,0,860,858,1,0,0,0,861,862,5,165,
	0,0,862,863,5,2,0,0,863,865,1,0,0,0,864,815,1,0,0,0,864,827,1,0,0,0,864,
	839,1,0,0,0,864,852,1,0,0,0,865,71,1,0,0,0,866,869,3,220,110,0,867,869,
	3,74,37,0,868,866,1,0,0,0,868,867,1,0,0,0,869,73,1,0,0,0,870,871,7,4,0,
	0,871,75,1,0,0,0,872,873,5,56,0,0,873,874,5,39,0,0,874,876,3,228,114,0,
	875,877,5,165,0,0,876,875,1,0,0,0,876,877,1,0,0,0,877,878,1,0,0,0,878,879,
	5,57,0,0,879,881,3,228,114,0,880,882,5,165,0,0,881,880,1,0,0,0,881,882,
	1,0,0,0,882,883,1,0,0,0,883,884,5,40,0,0,884,909,1,0,0,0,885,886,5,56,0,
	0,886,887,5,39,0,0,887,889,3,228,114,0,888,890,5,165,0,0,889,888,1,0,0,
	0,889,890,1,0,0,0,890,891,1,0,0,0,891,892,5,57,0,0,892,893,3,76,38,0,893,
	894,5,40,0,0,894,909,1,0,0,0,895,896,5,56,0,0,896,897,5,39,0,0,897,899,
	3,228,114,0,898,900,5,165,0,0,899,898,1,0,0,0,899,900,1,0,0,0,900,901,1,
	0,0,0,901,902,5,57,0,0,902,904,3,78,39,0,903,905,5,165,0,0,904,903,1,0,
	0,0,904,905,1,0,0,0,905,906,1,0,0,0,906,907,5,40,0,0,907,909,1,0,0,0,908,
	872,1,0,0,0,908,885,1,0,0,0,908,895,1,0,0,0,909,77,1,0,0,0,910,911,6,39,
	-1,0,911,912,3,228,114,0,912,913,5,58,0,0,913,914,5,146,0,0,914,915,5,59,
	0,0,915,921,1,0,0,0,916,917,3,228,114,0,917,918,5,58,0,0,918,919,5,59,0,
	0,919,921,1,0,0,0,920,910,1,0,0,0,920,916,1,0,0,0,921,931,1,0,0,0,922,923,
	10,2,0,0,923,924,5,58,0,0,924,925,5,146,0,0,925,930,5,59,0,0,926,927,10,
	1,0,0,927,928,5,58,0,0,928,930,5,59,0,0,929,922,1,0,0,0,929,926,1,0,0,0,
	930,933,1,0,0,0,931,929,1,0,0,0,931,932,1,0,0,0,932,79,1,0,0,0,933,931,
	1,0,0,0,934,935,5,60,0,0,935,937,5,165,0,0,936,938,3,96,48,0,937,936,1,
	0,0,0,937,938,1,0,0,0,938,939,1,0,0,0,939,943,5,4,0,0,940,942,3,82,41,0,
	941,940,1,0,0,0,942,945,1,0,0,0,943,941,1,0,0,0,943,944,1,0,0,0,944,946,
	1,0,0,0,945,943,1,0,0,0,946,947,5,6,0,0,947,81,1,0,0,0,948,951,3,84,42,
	0,949,951,3,102,51,0,950,948,1,0,0,0,950,949,1,0,0,0,951,83,1,0,0,0,952,
	953,5,61,0,0,953,954,5,2,0,0,954,85,1,0,0,0,955,956,5,7,0,0,956,957,5,165,
	0,0,957,961,3,96,48,0,958,960,3,90,45,0,959,958,1,0,0,0,960,963,1,0,0,0,
	961,959,1,0,0,0,961,962,1,0,0,0,962,967,1,0,0,0,963,961,1,0,0,0,964,966,
	3,88,44,0,965,964,1,0,0,0,966,969,1,0,0,0,967,965,1,0,0,0,967,968,1,0,0,
	0,968,971,1,0,0,0,969,967,1,0,0,0,970,972,3,94,47,0,971,970,1,0,0,0,971,
	972,1,0,0,0,972,973,1,0,0,0,973,977,5,4,0,0,974,976,3,102,51,0,975,974,
	1,0,0,0,976,979,1,0,0,0,977,975,1,0,0,0,977,978,1,0,0,0,978,980,1,0,0,0,
	979,977,1,0,0,0,980,981,5,6,0,0,981,87,1,0,0,0,982,984,5,165,0,0,983,985,
	3,208,104,0,984,983,1,0,0,0,984,985,1,0,0,0,985,89,1,0,0,0,986,1001,5,62,
	0,0,987,1001,5,63,0,0,988,1001,5,54,0,0,989,1001,5,34,0,0,990,1001,5,33,
	0,0,991,1001,5,55,0,0,992,1001,5,50,0,0,993,1001,5,52,0,0,994,1001,5,51,
	0,0,995,1001,3,92,46,0,996,1001,5,64,0,0,997,1001,5,65,0,0,998,1001,5,66,
	0,0,999,1001,5,67,0,0,1000,986,1,0,0,0,1000,987,1,0,0,0,1000,988,1,0,0,
	0,1000,989,1,0,0,0,1000,990,1,0,0,0,1000,991,1,0,0,0,1000,992,1,0,0,0,1000,
	993,1,0,0,0,1000,994,1,0,0,0,1000,995,1,0,0,0,1000,996,1,0,0,0,1000,997,
	1,0,0,0,1000,998,1,0,0,0,1000,999,1,0,0,0,1001,91,1,0,0,0,1002,1006,5,68,
	0,0,1003,1004,5,39,0,0,1004,1005,5,146,0,0,1005,1007,5,40,0,0,1006,1003,
	1,0,0,0,1006,1007,1,0,0,0,1007,93,1,0,0,0,1008,1009,5,69,0,0,1009,1010,
	5,39,0,0,1010,1014,3,228,114,0,1011,1013,3,220,110,0,1012,1011,1,0,0,0,
	1013,1016,1,0,0,0,1014,1012,1,0,0,0,1014,1015,1,0,0,0,1015,1027,1,0,0,0,
	1016,1014,1,0,0,0,1017,1018,5,5,0,0,1018,1022,3,228,114,0,1019,1021,3,220,
	110,0,1020,1019,1,0,0,0,1021,1024,1,0,0,0,1022,1020,1,0,0,0,1022,1023,1,
	0,0,0,1023,1026,1,0,0,0,1024,1022,1,0,0,0,1025,1017,1,0,0,0,1026,1029,1,
	0,0,0,1027,1025,1,0,0,0,1027,1028,1,0,0,0,1028,1031,1,0,0,0,1029,1027,1,
	0,0,0,1030,1032,5,5,0,0,1031,1030,1,0,0,0,1031,1032,1,0,0,0,1032,1033,1,
	0,0,0,1033,1034,5,40,0,0,1034,95,1,0,0,0,1035,1047,5,39,0,0,1036,1041,3,
	98,49,0,1037,1038,5,5,0,0,1038,1040,3,98,49,0,1039,1037,1,0,0,0,1040,1043,
	1,0,0,0,1041,1039,1,0,0,0,1041,1042,1,0,0,0,1042,1045,1,0,0,0,1043,1041,
	1,0,0,0,1044,1046,5,5,0,0,1045,1044,1,0,0,0,1045,1046,1,0,0,0,1046,1048,
	1,0,0,0,1047,1036,1,0,0,0,1047,1048,1,0,0,0,1048,1049,1,0,0,0,1049,1050,
	5,40,0,0,1050,97,1,0,0,0,1051,1055,3,228,114,0,1052,1054,3,220,110,0,1053,
	1052,1,0,0,0,1054,1057,1,0,0,0,1055,1053,1,0,0,0,1055,1056,1,0,0,0,1056,
	1058,1,0,0,0,1057,1055,1,0,0,0,1058,1059,5,165,0,0,1059,1070,1,0,0,0,1060,
	1064,3,78,39,0,1061,1063,3,220,110,0,1062,1061,1,0,0,0,1063,1066,1,0,0,
	0,1064,1062,1,0,0,0,1064,1065,1,0,0,0,1065,1067,1,0,0,0,1066,1064,1,0,0,
	0,1067,1068,5,165,0,0,1068,1070,1,0,0,0,1069,1051,1,0,0,0,1069,1060,1,0,
	0,0,1070,99,1,0,0,0,1071,1075,5,4,0,0,1072,1074,3,102,51,0,1073,1072,1,
	0,0,0,1074,1077,1,0,0,0,1075,1073,1,0,0,0,1075,1076,1,0,0,0,1076,1078,1,
	0,0,0,1077,1075,1,0,0,0,1078,1081,5,6,0,0,1079,1081,3,102,51,0,1080,1071,
	1,0,0,0,1080,1079,1,0,0,0,1081,101,1,0,0,0,1082,1116,3,124,62,0,1083,1116,
	3,126,63,0,1084,1116,3,134,67,0,1085,1116,3,130,65,0,1086,1116,3,132,66,
	0,1087,1116,3,136,68,0,1088,1116,3,138,69,0,1089,1116,3,140,70,0,1090,1116,
	3,128,64,0,1091,1116,3,122,61,0,1092,1116,3,118,59,0,1093,1116,3,116,58,
	0,1094,1116,3,120,60,0,1095,1116,3,144,72,0,1096,1116,3,146,73,0,1097,1116,
	3,148,74,0,1098,1116,3,150,75,0,1099,1116,3,170,85,0,1100,1116,3,114,57,
	0,1101,1116,3,104,52,0,1102,1116,3,106,53,0,1103,1116,3,108,54,0,1104,1116,
	3,110,55,0,1105,1116,3,112,56,0,1106,1116,3,172,86,0,1107,1116,3,184,92,
	0,1108,1116,3,196,98,0,1109,1116,3,198,99,0,1110,1116,3,142,71,0,1111,1116,
	3,176,88,0,1112,1116,3,178,89,0,1113,1116,3,190,95,0,1114,1116,3,192,96,
	0,1115,1082,1,0,0,0,1115,1083,1,0,0,0,1115,1084,1,0,0,0,1115,1085,1,0,0,
	0,1115,1086,1,0,0,0,1115,1087,1,0,0,0,1115,1088,1,0,0,0,1115,1089,1,0,0,
	0,1115,1090,1,0,0,0,1115,1091,1,0,0,0,1115,1092,1,0,0,0,1115,1093,1,0,0,
	0,1115,1094,1,0,0,0,1115,1095,1,0,0,0,1115,1096,1,0,0,0,1115,1097,1,0,0,
	0,1115,1098,1,0,0,0,1115,1099,1,0,0,0,1115,1100,1,0,0,0,1115,1101,1,0,0,
	0,1115,1102,1,0,0,0,1115,1103,1,0,0,0,1115,1104,1,0,0,0,1115,1105,1,0,0,
	0,1115,1106,1,0,0,0,1115,1107,1,0,0,0,1115,1108,1,0,0,0,1115,1109,1,0,0,
	0,1115,1110,1,0,0,0,1115,1111,1,0,0,0,1115,1112,1,0,0,0,1115,1113,1,0,0,
	0,1115,1114,1,0,0,0,1116,103,1,0,0,0,1117,1118,5,70,0,0,1118,1119,5,12,
	0,0,1119,1120,5,165,0,0,1120,1121,5,39,0,0,1121,1122,3,216,108,0,1122,1123,
	5,5,0,0,1123,1124,3,216,108,0,1124,1125,5,40,0,0,1125,1126,5,2,0,0,1126,
	105,1,0,0,0,1127,1128,5,70,0,0,1128,1129,5,12,0,0,1129,1130,5,165,0,0,1130,
	1131,5,58,0,0,1131,1132,3,216,108,0,1132,1133,5,59,0,0,1133,1134,5,12,0,
	0,1134,1135,5,165,0,0,1135,1136,5,39,0,0,1136,1141,3,216,108,0,1137,1138,
	5,5,0,0,1138,1140,3,216,108,0,1139,1137,1,0,0,0,1140,1143,1,0,0,0,1141,
	1139,1,0,0,0,1141,1142,1,0,0,0,1142,1144,1,0,0,0,1143,1141,1,0,0,0,1144,
	1145,5,40,0,0,1145,1146,5,2,0,0,1146,107,1,0,0,0,1147,1148,5,71,0,0,1148,
	1153,3,216,108,0,1149,1150,5,5,0,0,1150,1152,3,216,108,0,1151,1149,1,0,
	0,0,1152,1155,1,0,0,0,1153,1151,1,0,0,0,1153,1154,1,0,0,0,1154,1156,1,0,
	0,0,1155,1153,1,0,0,0,1156,1157,5,2,0,0,1157,1175,1,0,0,0,1158,1159,5,71,
	0,0,1159,1160,5,39,0,0,1160,1165,3,216,108,0,1161,1162,5,5,0,0,1162,1164,
	3,216,108,0,1163,1161,1,0,0,0,1164,1167,1,0,0,0,1165,1163,1,0,0,0,1165,
	1166,1,0,0,0,1166,1169,1,0,0,0,1167,1165,1,0,0,0,1168,1170,5,5,0,0,1169,
	1168,1,0,0,0,1169,1170,1,0,0,0,1170,1171,1,0,0,0,1171,1172,5,40,0,0,1172,
	1173,5,2,0,0,1173,1175,1,0,0,0,1174,1147,1,0,0,0,1174,1158,1,0,0,0,1175,
	109,1,0,0,0,1176,1177,5,165,0,0,1177,1178,3,208,104,0,1178,1179,5,2,0,0,
	1179,1199,1,0,0,0,1180,1181,5,165,0,0,1181,1182,5,12,0,0,1182,1183,5,165,
	0,0,1183,1184,3,208,104,0,1184,1185,5,2,0,0,1185,1199,1,0,0,0,1186,1187,
	5,165,0,0,1187,1188,3,208,104,0,1188,1189,5,12,0,0,1189,1190,5,165,0,0,
	1190,1191,5,12,0,0,1191,1193,5,165,0,0,1192,1194,3,210,105,0,1193,1192,
	1,0,0,0,1193,1194,1,0,0,0,1194,1195,1,0,0,0,1195,1196,3,208,104,0,1196,
	1197,5,2,0,0,1197,1199,1,0,0,0,1198,1176,1,0,0,0,1198,1180,1,0,0,0,1198,
	1186,1,0,0,0,1199,111,1,0,0,0,1200,1201,3,216,108,0,1201,1202,5,12,0,0,
	1202,1204,5,165,0,0,1203,1205,3,210,105,0,1204,1203,1,0,0,0,1204,1205,1,
	0,0,0,1205,1206,1,0,0,0,1206,1207,3,208,104,0,1207,1208,5,2,0,0,1208,113,
	1,0,0,0,1209,1210,5,72,0,0,1210,1211,5,165,0,0,1211,1212,3,208,104,0,1212,
	1213,5,2,0,0,1213,115,1,0,0,0,1214,1215,5,70,0,0,1215,1216,5,12,0,0,1216,
	1221,5,165,0,0,1217,1218,5,58,0,0,1218,1219,3,216,108,0,1219,1220,5,59,
	0,0,1220,1222,1,0,0,0,1221,1217,1,0,0,0,1222,1223,1,0,0,0,1223,1221,1,0,
	0,0,1223,1224,1,0,0,0,1224,1225,1,0,0,0,1225,1226,5,30,0,0,1226,1227,3,
	216,108,0,1227,1228,5,2,0,0,1228,117,1,0,0,0,1229,1230,5,70,0,0,1230,1231,
	5,12,0,0,1231,1236,5,165,0,0,1232,1233,5,58,0,0,1233,1234,3,216,108,0,1234,
	1235,5,59,0,0,1235,1237,1,0,0,0,1236,1232,1,0,0,0,1237,1238,1,0,0,0,1238,
	1236,1,0,0,0,1238,1239,1,0,0,0,1239,1240,1,0,0,0,1240,1241,5,12,0,0,1241,
	1242,5,165,0,0,1242,1243,5,30,0,0,1243,1244,3,216,108,0,1244,1245,5,2,0,
	0,1245,119,1,0,0,0,1246,1247,5,70,0,0,1247,1248,5,12,0,0,1248,1255,5,165,
	0,0,1249,1250,5,58,0,0,1250,1251,3,216,108,0,1251,1252,5,59,0,0,1252,1254,
	1,0,0,0,1253,1249,1,0,0,0,1254,1257,1,0,0,0,1255,1253,1,0,0,0,1255,1256,
	1,0,0,0,1256,1258,1,0,0,0,1257,1255,1,0,0,0,1258,1259,5,73,0,0,1259,1260,
	5,39,0,0,1260,1261,3,216,108,0,1261,1262,5,40,0,0,1262,1263,5,2,0,0,1263,
	121,1,0,0,0,1264,1265,5,70,0,0,1265,1266,5,12,0,0,1266,1267,5,165,0,0,1267,
	1268,5,30,0,0,1268,1269,3,216,108,0,1269,1270,5,2,0,0,1270,123,1,0,0,0,
	1271,1275,3,228,114,0,1272,1274,3,220,110,0,1273,1272,1,0,0,0,1274,1277,
	1,0,0,0,1275,1273,1,0,0,0,1275,1276,1,0,0,0,1276,1278,1,0,0,0,1277,1275,
	1,0,0,0,1278,1279,5,165,0,0,1279,1280,5,30,0,0,1280,1281,3,216,108,0,1281,
	1282,5,2,0,0,1282,1296,1,0,0,0,1283,1287,3,78,39,0,1284,1286,3,220,110,
	0,1285,1284,1,0,0,0,1286,1289,1,0,0,0,1287,1285,1,0,0,0,1287,1288,1,0,0,
	0,1288,1290,1,0,0,0,1289,1287,1,0,0,0,1290,1291,5,165,0,0,1291,1292,5,30,
	0,0,1292,1293,3,216,108,0,1293,1294,5,2,0,0,1294,1296,1,0,0,0,1295,1271,
	1,0,0,0,1295,1283,1,0,0,0,1296,125,1,0,0,0,1297,1298,3,228,114,0,1298,1303,
	5,165,0,0,1299,1300,5,5,0,0,1300,1301,3,228,114,0,1301,1302,5,165,0,0,1302,
	1304,1,0,0,0,1303,1299,1,0,0,0,1304,1305,1,0,0,0,1305,1303,1,0,0,0,1305,
	1306,1,0,0,0,1306,1307,1,0,0,0,1307,1308,5,30,0,0,1308,1309,3,216,108,0,
	1309,1310,5,2,0,0,1310,1328,1,0,0,0,1311,1312,5,39,0,0,1312,1313,3,228,
	114,0,1313,1318,5,165,0,0,1314,1315,5,5,0,0,1315,1316,3,228,114,0,1316,
	1317,5,165,0,0,1317,1319,1,0,0,0,1318,1314,1,0,0,0,1319,1320,1,0,0,0,1320,
	1318,1,0,0,0,1320,1321,1,0,0,0,1321,1322,1,0,0,0,1322,1323,5,40,0,0,1323,
	1324,5,30,0,0,1324,1325,3,216,108,0,1325,1326,5,2,0,0,1326,1328,1,0,0,0,
	1327,1297,1,0,0,0,1327,1311,1,0,0,0,1328,127,1,0,0,0,1329,1330,5,165,0,
	0,1330,1331,7,5,0,0,1331,1332,3,216,108,0,1332,1333,5,2,0,0,1333,1338,1,
	0,0,0,1334,1335,5,165,0,0,1335,1336,7,6,0,0,1336,1338,5,2,0,0,1337,1329,
	1,0,0,0,1337,1334,1,0,0,0,1338,129,1,0,0,0,1339,1340,5,165,0,0,1340,1341,
	5,78,0,0,1341,1342,5,39,0,0,1342,1343,3,216,108,0,1343,1344,5,40,0,0,1344,
	1345,5,2,0,0,1345,131,1,0,0,0,1346,1347,5,165,0,0,1347,1348,5,79,0,0,1348,
	1349,5,39,0,0,1349,1350,5,40,0,0,1350,1351,5,2,0,0,1351,133,1,0,0,0,1352,
	1353,5,165,0,0,1353,1354,5,58,0,0,1354,1355,3,216,108,0,1355,1356,5,59,
	0,0,1356,1357,5,30,0,0,1357,1358,3,216,108,0,1358,1359,5,2,0,0,1359,135,
	1,0,0,0,1360,1361,5,165,0,0,1361,1362,5,73,0,0,1362,1363,5,39,0,0,1363,
	1364,3,216,108,0,1364,1365,5,40,0,0,1365,1366,5,2,0,0,1366,137,1,0,0,0,
	1367,1368,5,70,0,0,1368,1369,5,12,0,0,1369,1370,5,165,0,0,1370,1371,5,78,
	0,0,1371,1372,5,39,0,0,1372,1373,3,216,108,0,1373,1374,5,40,0,0,1374,1375,
	5,2,0,0,1375,139,1,0,0,0,1376,1377,5,70,0,0,1377,1378,5,12,0,0,1378,1379,
	5,165,0,0,1379,1380,5,79,0,0,1380,1381,5,39,0,0,1381,1382,5,40,0,0,1382,
	1383,5,2,0,0,1383,141,1,0,0,0,1384,1385,5,80,0,0,1385,1386,5,165,0,0,1386,
	1407,5,2,0,0,1387,1388,5,80,0,0,1388,1389,5,70,0,0,1389,1390,5,12,0,0,1390,
	1391,5,165,0,0,1391,1407,5,2,0,0,1392,1393,5,80,0,0,1393,1394,5,70,0,0,
	1394,1395,5,12,0,0,1395,1400,5,165,0,0,1396,1397,5,58,0,0,1397,1398,3,216,
	108,0,1398,1399,5,59,0,0,1399,1401,1,0,0,0,1400,1396,1,0,0,0,1401,1402,
	1,0,0,0,1402,1400,1,0,0,0,1402,1403,1,0,0,0,1403,1404,1,0,0,0,1404,1405,
	5,2,0,0,1405,1407,1,0,0,0,1406,1384,1,0,0,0,1406,1387,1,0,0,0,1406,1392,
	1,0,0,0,1407,143,1,0,0,0,1408,1409,5,81,0,0,1409,1410,5,39,0,0,1410,1411,
	5,156,0,0,1411,1412,5,23,0,0,1412,1415,3,216,108,0,1413,1414,5,5,0,0,1414,
	1416,3,194,97,0,1415,1413,1,0,0,0,1415,1416,1,0,0,0,1416,1417,1,0,0,0,1417,
	1418,5,40,0,0,1418,1419,5,2,0,0,1419,145,1,0,0,0,1420,1421,5,81,0,0,1421,
	1422,5,39,0,0,1422,1425,3,216,108,0,1423,1424,5,5,0,0,1424,1426,3,194,97,
	0,1425,1423,1,0,0,0,1425,1426,1,0,0,0,1426,1427,1,0,0,0,1427,1428,5,40,
	0,0,1428,1429,5,2,0,0,1429,147,1,0,0,0,1430,1431,5,82,0,0,1431,1432,5,39,
	0,0,1432,1433,3,216,108,0,1433,1434,5,40,0,0,1434,1437,3,100,50,0,1435,
	1436,5,83,0,0,1436,1438,3,100,50,0,1437,1435,1,0,0,0,1437,1438,1,0,0,0,
	1438,149,1,0,0,0,1439,1446,3,166,83,0,1440,1446,3,168,84,0,1441,1446,3,
	158,79,0,1442,1446,3,152,76,0,1443,1446,3,154,77,0,1444,1446,3,156,78,0,
	1445,1439,1,0,0,0,1445,1440,1,0,0,0,1445,1441,1,0,0,0,1445,1442,1,0,0,0,
	1445,1443,1,0,0,0,1445,1444,1,0,0,0,1446,151,1,0,0,0,1447,1448,5,9,0,0,
	1448,1449,5,39,0,0,1449,1450,3,228,114,0,1450,1451,5,165,0,0,1451,1452,
	5,5,0,0,1452,1453,3,228,114,0,1453,1454,5,165,0,0,1454,1455,5,84,0,0,1455,
	1456,5,70,0,0,1456,1457,5,12,0,0,1457,1458,5,165,0,0,1458,1459,5,12,0,0,
	1459,1460,5,85,0,0,1460,1461,5,40,0,0,1461,1462,3,100,50,0,1462,153,1,0,
	0,0,1463,1464,5,9,0,0,1464,1465,5,39,0,0,1465,1466,3,228,114,0,1466,1467,
	5,165,0,0,1467,1468,5,86,0,0,1468,1469,5,70,0,0,1469,1470,5,12,0,0,1470,
	1471,5,165,0,0,1471,1472,5,40,0,0,1472,1473,3,100,50,0,1473,155,1,0,0,0,
	1474,1475,5,9,0,0,1475,1476,5,39,0,0,1476,1477,3,228,114,0,1477,1478,5,
	165,0,0,1478,1479,5,84,0,0,1479,1480,5,70,0,0,1480,1481,5,12,0,0,1481,1482,
	5,165,0,0,1482,1483,5,40,0,0,1483,1484,3,100,50,0,1484,157,1,0,0,0,1485,
	1486,5,9,0,0,1486,1487,5,39,0,0,1487,1488,3,160,80,0,1488,1489,3,162,81,
	0,1489,1490,3,164,82,0,1490,1491,5,40,0,0,1491,1492,3,100,50,0,1492,159,
	1,0,0,0,1493,1497,3,228,114,0,1494,1496,3,220,110,0,1495,1494,1,0,0,0,1496,
	1499,1,0,0,0,1497,1495,1,0,0,0,1497,1498,1,0,0,0,1498,1500,1,0,0,0,1499,
	1497,1,0,0,0,1500,1501,5,165,0,0,1501,1502,5,30,0,0,1502,1503,3,216,108,
	0,1503,1504,5,2,0,0,1504,161,1,0,0,0,1505,1506,3,216,108,0,1506,1507,5,
	2,0,0,1507,163,1,0,0,0,1508,1509,5,165,0,0,1509,1510,7,5,0,0,1510,1514,
	3,216,108,0,1511,1512,5,165,0,0,1512,1514,7,6,0,0,1513,1508,1,0,0,0,1513,
	1511,1,0,0,0,1514,165,1,0,0,0,1515,1516,5,87,0,0,1516,1517,3,100,50,0,1517,
	1518,5,88,0,0,1518,1519,5,39,0,0,1519,1520,3,216,108,0,1520,1521,5,40,0,
	0,1521,1522,5,2,0,0,1522,167,1,0,0,0,1523,1524,5,88,0,0,1524,1525,5,39,
	0,0,1525,1526,3,216,108,0,1526,1527,5,40,0,0,1527,1528,3,100,50,0,1528,
	169,1,0,0,0,1529,1530,5,89,0,0,1530,1531,3,202,101,0,1531,1532,5,2,0,0,
	1532,171,1,0,0,0,1533,1534,5,90,0,0,1534,1538,5,4,0,0,1535,1537,3,174,87,
	0,1536,1535,1,0,0,0,1537,1540,1,0,0,0,1538,1536,1,0,0,0,1538,1539,1,0,0,
	0,1539,1541,1,0,0,0,1540,1538,1,0,0,0,1541,1542,5,6,0,0,1542,173,1,0,0,
	0,1543,1544,7,7,0,0,1544,175,1,0,0,0,1545,1546,5,91,0,0,1546,1550,5,4,0,
	0,1547,1549,3,102,51,0,1548,1547,1,0,0,0,1549,1552,1,0,0,0,1550,1548,1,
	0,0,0,1550,1551,1,0,0,0,1551,1553,1,0,0,0,1552,1550,1,0,0,0,1553,1554,5,
	6,0,0,1554,177,1,0,0,0,1555,1556,5,92,0,0,1556,1557,5,39,0,0,1557,1558,
	3,216,108,0,1558,1559,5,40,0,0,1559,1563,5,4,0,0,1560,1562,3,180,90,0,1561,
	1560,1,0,0,0,1562,1565,1,0,0,0,1563,1561,1,0,0,0,1563,1564,1,0,0,0,1564,
	1567,1,0,0,0,1565,1563,1,0,0,0,1566,1568,3,182,91,0,1567,1566,1,0,0,0,1567,
	1568,1,0,0,0,1568,1569,1,0,0,0,1569,1570,5,6,0,0,1570,179,1,0,0,0,1571,
	1572,5,93,0,0,1572,1573,3,216,108,0,1573,1577,5,94,0,0,1574,1576,3,102,
	51,0,1575,1574,1,0,0,0,1576,1579,1,0,0,0,1577,1575,1,0,0,0,1577,1578,1,
	0,0,0,1578,181,1,0,0,0,1579,1577,1,0,0,0,1580,1581,5,95,0,0,1581,1585,5,
	94,0,0,1582,1584,3,102,51,0,1583,1582,1,0,0,0,1584,1587,1,0,0,0,1585,1583,
	1,0,0,0,1585,1586,1,0,0,0,1586,183,1,0,0,0,1587,1585,1,0,0,0,1588,1589,
	5,96,0,0,1589,1591,3,216,108,0,1590,1592,3,186,93,0,1591,1590,1,0,0,0,1591,
	1592,1,0,0,0,1592,1593,1,0,0,0,1593,1595,3,100,50,0,1594,1596,3,188,94,
	0,1595,1594,1,0,0,0,1596,1597,1,0,0,0,1597,1595,1,0,0,0,1597,1598,1,0,0,
	0,1598,185,1,0,0,0,1599,1600,5,69,0,0,1600,1612,5,39,0,0,1601,1606,3,98,
	49,0,1602,1603,5,5,0,0,1603,1605,3,98,49,0,1604,1602,1,0,0,0,1605,1608,
	1,0,0,0,1606,1604,1,0,0,0,1606,1607,1,0,0,0,1607,1610,1,0,0,0,1608,1606,
	1,0,0,0,1609,1611,5,5,0,0,1610,1609,1,0,0,0,1610,1611,1,0,0,0,1611,1613,
	1,0,0,0,1612,1601,1,0,0,0,1612,1613,1,0,0,0,1613,1614,1,0,0,0,1614,1615,
	5,40,0,0,1615,187,1,0,0,0,1616,1618,5,97,0,0,1617,1619,5,165,0,0,1618,1617,
	1,0,0,0,1618,1619,1,0,0,0,1619,1635,1,0,0,0,1620,1632,5,39,0,0,1621,1626,
	3,98,49,0,1622,1623,5,5,0,0,1623,1625,3,98,49,0,1624,1622,1,0,0,0,1625,
	1628,1,0,0,0,1626,1624,1,0,0,0,1626,1627,1,0,0,0,1627,1630,1,0,0,0,1628,
	1626,1,0,0,0,1629,1631,5,5,0,0,1630,1629,1,0,0,0,1630,1631,1,0,0,0,1631,
	1633,1,0,0,0,1632,1621,1,0,0,0,1632,1633,1,0,0,0,1633,1634,1,0,0,0,1634,
	1636,5,40,0,0,1635,1620,1,0,0,0,1635,1636,1,0,0,0,1636,1637,1,0,0,0,1637,
	1638,3,100,50,0,1638,189,1,0,0,0,1639,1640,5,98,0,0,1640,1641,5,2,0,0,1641,
	191,1,0,0,0,1642,1643,5,99,0,0,1643,1644,5,2,0,0,1644,193,1,0,0,0,1645,
	1646,5,153,0,0,1646,195,1,0,0,0,1647,1648,5,100,0,0,1648,1649,5,165,0,0,
	1649,1650,3,208,104,0,1650,1651,5,2,0,0,1651,1662,1,0,0,0,1652,1653,5,100,
	0,0,1653,1654,5,39,0,0,1654,1655,5,153,0,0,1655,1656,5,40,0,0,1656,1662,
	5,2,0,0,1657,1658,5,100,0,0,1658,1659,5,39,0,0,1659,1660,5,40,0,0,1660,
	1662,5,2,0,0,1661,1647,1,0,0,0,1661,1652,1,0,0,0,1661,1657,1,0,0,0,1662,
	197,1,0,0,0,1663,1664,5,101,0,0,1664,1665,5,39,0,0,1665,1666,3,216,108,
	0,1666,1667,5,40,0,0,1667,1668,5,2,0,0,1668,199,1,0,0,0,1669,1672,5,165,
	0,0,1670,1672,3,222,111,0,1671,1669,1,0,0,0,1671,1670,1,0,0,0,1672,201,
	1,0,0,0,1673,1685,5,39,0,0,1674,1679,3,200,100,0,1675,1676,5,5,0,0,1676,
	1678,3,200,100,0,1677,1675,1,0,0,0,1678,1681,1,0,0,0,1679,1677,1,0,0,0,
	1679,1680,1,0,0,0,1680,1683,1,0,0,0,1681,1679,1,0,0,0,1682,1684,5,5,0,0,
	1683,1682,1,0,0,0,1683,1684,1,0,0,0,1684,1686,1,0,0,0,1685,1674,1,0,0,0,
	1685,1686,1,0,0,0,1686,1687,1,0,0,0,1687,1688,5,40,0,0,1688,203,1,0,0,0,
	1689,1690,5,165,0,0,1690,1714,3,208,104,0,1691,1692,5,165,0,0,1692,1693,
	5,12,0,0,1693,1694,5,165,0,0,1694,1714,3,208,104,0,1695,1696,5,165,0,0,
	1696,1697,5,39,0,0,1697,1709,5,4,0,0,1698,1703,3,206,103,0,1699,1700,5,
	5,0,0,1700,1702,3,206,103,0,1701,1699,1,0,0,0,1702,1705,1,0,0,0,1703,1701,
	1,0,0,0,1703,1704,1,0,0,0,1704,1707,1,0,0,0,1705,1703,1,0,0,0,1706,1708,
	5,5,0,0,1707,1706,1,0,0,0,1707,1708,1,0,0,0,1708,1710,1,0,0,0,1709,1698,
	1,0,0,0,1709,1710,1,0,0,0,1710,1711,1,0,0,0,1711,1712,5,6,0,0,1712,1714,
	5,40,0,0,1713,1689,1,0,0,0,1713,1691,1,0,0,0,1713,1695,1,0,0,0,1714,205,
	1,0,0,0,1715,1716,5,165,0,0,1716,1717,5,94,0,0,1717,1718,3,216,108,0,1718,
	207,1,0,0,0,1719,1731,5,39,0,0,1720,1725,3,216,108,0,1721,1722,5,5,0,0,
	1722,1724,3,216,108,0,1723,1721,1,0,0,0,1724,1727,1,0,0,0,1725,1723,1,0,
	0,0,1725,1726,1,0,0,0,1726,1729,1,0,0,0,1727,1725,1,0,0,0,1728,1730,5,5,
	0,0,1729,1728,1,0,0,0,1729,1730,1,0,0,0,1730,1732,1,0,0,0,1731,1720,1,0,
	0,0,1731,1732,1,0,0,0,1732,1733,1,0,0,0,1733,1734,5,40,0,0,1734,209,1,0,
	0,0,1735,1736,5,4,0,0,1736,1741,3,212,106,0,1737,1738,5,5,0,0,1738,1740,
	3,212,106,0,1739,1737,1,0,0,0,1740,1743,1,0,0,0,1741,1739,1,0,0,0,1741,
	1742,1,0,0,0,1742,1745,1,0,0,0,1743,1741,1,0,0,0,1744,1746,5,5,0,0,1745,
	1744,1,0,0,0,1745,1746,1,0,0,0,1746,1747,1,0,0,0,1747,1748,5,6,0,0,1748,
	211,1,0,0,0,1749,1750,5,165,0,0,1750,1751,5,94,0,0,1751,1752,3,216,108,
	0,1752,213,1,0,0,0,1753,1754,5,39,0,0,1754,1759,3,228,114,0,1755,1756,5,
	5,0,0,1756,1758,3,228,114,0,1757,1755,1,0,0,0,1758,1761,1,0,0,0,1759,1757,
	1,0,0,0,1759,1760,1,0,0,0,1760,1763,1,0,0,0,1761,1759,1,0,0,0,1762,1764,
	5,5,0,0,1763,1762,1,0,0,0,1763,1764,1,0,0,0,1764,1765,1,0,0,0,1765,1766,
	5,40,0,0,1766,215,1,0,0,0,1767,1768,6,108,-1,0,1768,1769,5,39,0,0,1769,
	1770,3,216,108,0,1770,1771,5,40,0,0,1771,1896,1,0,0,0,1772,1773,3,230,115,
	0,1773,1774,5,39,0,0,1774,1776,3,216,108,0,1775,1777,5,5,0,0,1776,1775,
	1,0,0,0,1776,1777,1,0,0,0,1777,1778,1,0,0,0,1778,1779,5,40,0,0,1779,1896,
	1,0,0,0,1780,1896,3,204,102,0,1781,1782,5,102,0,0,1782,1784,5,165,0,0,1783,
	1785,3,210,105,0,1784,1783,1,0,0,0,1784,1785,1,0,0,0,1785,1786,1,0,0,0,
	1786,1896,3,208,104,0,1787,1788,5,102,0,0,1788,1789,3,228,114,0,1789,1790,
	5,58,0,0,1790,1791,5,59,0,0,1791,1792,5,39,0,0,1792,1793,3,216,108,0,1793,
	1794,5,40,0,0,1794,1896,1,0,0,0,1795,1796,5,46,0,0,1796,1797,5,39,0,0,1797,
	1798,3,228,114,0,1798,1799,5,40,0,0,1799,1800,5,12,0,0,1800,1801,5,165,
	0,0,1801,1896,1,0,0,0,1802,1803,5,103,0,0,1803,1896,3,208,104,0,1804,1805,
	5,104,0,0,1805,1896,3,208,104,0,1806,1807,5,105,0,0,1807,1896,3,208,104,
	0,1808,1809,5,106,0,0,1809,1896,3,208,104,0,1810,1811,5,107,0,0,1811,1812,
	5,39,0,0,1812,1813,5,165,0,0,1813,1814,5,12,0,0,1814,1815,5,165,0,0,1815,
	1816,5,5,0,0,1816,1817,3,208,104,0,1817,1818,5,40,0,0,1818,1896,1,0,0,0,
	1819,1820,5,108,0,0,1820,1896,3,208,104,0,1821,1822,5,109,0,0,1822,1896,
	3,208,104,0,1823,1824,5,110,0,0,1824,1825,5,39,0,0,1825,1826,3,216,108,
	0,1826,1827,5,5,0,0,1827,1828,3,214,107,0,1828,1829,5,40,0,0,1829,1896,
	1,0,0,0,1830,1831,5,111,0,0,1831,1832,5,39,0,0,1832,1833,3,216,108,0,1833,
	1834,5,5,0,0,1834,1835,3,214,107,0,1835,1836,5,5,0,0,1836,1837,5,146,0,
	0,1837,1838,5,40,0,0,1838,1896,1,0,0,0,1839,1840,5,112,0,0,1840,1841,5,
	58,0,0,1841,1842,3,216,108,0,1842,1843,5,59,0,0,1843,1844,7,8,0,0,1844,
	1896,1,0,0,0,1845,1846,5,118,0,0,1846,1847,5,58,0,0,1847,1848,3,216,108,
	0,1848,1849,5,59,0,0,1849,1850,7,9,0,0,1850,1896,1,0,0,0,1851,1852,7,10,
	0,0,1852,1896,3,216,108,20,1853,1865,5,58,0,0,1854,1859,3,216,108,0,1855,
	1856,5,5,0,0,1856,1858,3,216,108,0,1857,1855,1,0,0,0,1858,1861,1,0,0,0,
	1859,1857,1,0,0,0,1859,1860,1,0,0,0,1860,1863,1,0,0,0,1861,1859,1,0,0,0,
	1862,1864,5,5,0,0,1863,1862,1,0,0,0,1863,1864,1,0,0,0,1864,1866,1,0,0,0,
	1865,1854,1,0,0,0,1865,1866,1,0,0,0,1866,1867,1,0,0,0,1867,1896,5,59,0,
	0,1868,1869,5,70,0,0,1869,1870,5,12,0,0,1870,1871,5,165,0,0,1871,1872,5,
	12,0,0,1872,1873,5,165,0,0,1873,1874,5,58,0,0,1874,1875,3,216,108,0,1875,
	1876,5,59,0,0,1876,1877,3,218,109,0,1877,1896,1,0,0,0,1878,1879,5,70,0,
	0,1879,1880,5,12,0,0,1880,1885,5,165,0,0,1881,1882,5,58,0,0,1882,1883,3,
	216,108,0,1883,1884,5,59,0,0,1884,1886,1,0,0,0,1885,1881,1,0,0,0,1886,1887,
	1,0,0,0,1887,1885,1,0,0,0,1887,1888,1,0,0,0,1888,1896,1,0,0,0,1889,1890,
	5,70,0,0,1890,1891,5,12,0,0,1891,1896,5,165,0,0,1892,1896,5,162,0,0,1893,
	1896,5,165,0,0,1894,1896,3,222,111,0,1895,1767,1,0,0,0,1895,1772,1,0,0,
	0,1895,1780,1,0,0,0,1895,1781,1,0,0,0,1895,1787,1,0,0,0,1895,1795,1,0,0,
	0,1895,1802,1,0,0,0,1895,1804,1,0,0,0,1895,1806,1,0,0,0,1895,1808,1,0,0,
	0,1895,1810,1,0,0,0,1895,1819,1,0,0,0,1895,1821,1,0,0,0,1895,1823,1,0,0,
	0,1895,1830,1,0,0,0,1895,1839,1,0,0,0,1895,1845,1,0,0,0,1895,1851,1,0,0,
	0,1895,1853,1,0,0,0,1895,1868,1,0,0,0,1895,1878,1,0,0,0,1895,1889,1,0,0,
	0,1895,1892,1,0,0,0,1895,1893,1,0,0,0,1895,1894,1,0,0,0,1896,1972,1,0,0,
	0,1897,1898,10,19,0,0,1898,1899,5,17,0,0,1899,1971,3,216,108,19,1900,1901,
	10,18,0,0,1901,1902,7,11,0,0,1902,1971,3,216,108,19,1903,1904,10,17,0,0,
	1904,1905,7,12,0,0,1905,1971,3,216,108,18,1906,1907,10,16,0,0,1907,1908,
	7,13,0,0,1908,1971,3,216,108,17,1909,1910,10,15,0,0,1910,1911,7,14,0,0,
	1911,1971,3,216,108,16,1912,1913,10,14,0,0,1913,1914,7,15,0,0,1914,1971,
	3,216,108,15,1915,1916,10,13,0,0,1916,1917,5,24,0,0,1917,1971,3,216,108,
	14,1918,1919,10,12,0,0,1919,1920,5,26,0,0,1920,1971,3,216,108,13,1921,1922,
	10,11,0,0,1922,1923,5,25,0,0,1923,1971,3,216,108,12,1924,1925,10,10,0,0,
	1925,1926,5,130,0,0,1926,1971,3,216,108,11,1927,1928,10,9,0,0,1928,1929,
	5,131,0,0,1929,1971,3,216,108,10,1930,1931,10,8,0,0,1931,1932,5,132,0,0,
	1932,1933,3,216,108,0,1933,1934,5,94,0,0,1934,1935,3,216,108,8,1935,1971,
	1,0,0,0,1936,1937,10,29,0,0,1937,1938,5,58,0,0,1938,1939,5,146,0,0,1939,
	1971,5,59,0,0,1940,1941,10,28,0,0,1941,1942,5,58,0,0,1942,1943,3,216,108,
	0,1943,1944,5,59,0,0,1944,1971,1,0,0,0,1945,1946,10,25,0,0,1946,1971,7,
	16,0,0,1947,1948,10,24,0,0,1948,1949,5,125,0,0,1949,1950,5,39,0,0,1950,
	1951,3,216,108,0,1951,1952,5,40,0,0,1952,1971,1,0,0,0,1953,1954,10,23,0,
	0,1954,1955,5,126,0,0,1955,1956,5,39,0,0,1956,1957,3,216,108,0,1957,1958,
	5,5,0,0,1958,1959,3,216,108,0,1959,1960,5,40,0,0,1960,1971,1,0,0,0,1961,
	1962,10,22,0,0,1962,1963,5,12,0,0,1963,1965,5,165,0,0,1964,1966,3,210,105,
	0,1965,1964,1,0,0,0,1965,1966,1,0,0,0,1966,1967,1,0,0,0,1967,1971,3,208,
	104,0,1968,1969,10,21,0,0,1969,1971,3,218,109,0,1970,1897,1,0,0,0,1970,
	1900,1,0,0,0,1970,1903,1,0,0,0,1970,1906,1,0,0,0,1970,1909,1,0,0,0,1970,
	1912,1,0,0,0,1970,1915,1,0,0,0,1970,1918,1,0,0,0,1970,1921,1,0,0,0,1970,
	1924,1,0,0,0,1970,1927,1,0,0,0,1970,1930,1,0,0,0,1970,1936,1,0,0,0,1970,
	1940,1,0,0,0,1970,1945,1,0,0,0,1970,1947,1,0,0,0,1970,1953,1,0,0,0,1970,
	1961,1,0,0,0,1970,1968,1,0,0,0,1971,1974,1,0,0,0,1972,1970,1,0,0,0,1972,
	1973,1,0,0,0,1973,217,1,0,0,0,1974,1972,1,0,0,0,1975,1976,5,12,0,0,1976,
	1989,5,165,0,0,1977,1989,5,113,0,0,1978,1989,5,114,0,0,1979,1989,5,115,
	0,0,1980,1989,5,116,0,0,1981,1989,5,117,0,0,1982,1989,5,119,0,0,1983,1989,
	5,120,0,0,1984,1989,5,121,0,0,1985,1989,5,122,0,0,1986,1989,5,133,0,0,1987,
	1989,5,134,0,0,1988,1975,1,0,0,0,1988,1977,1,0,0,0,1988,1978,1,0,0,0,1988,
	1979,1,0,0,0,1988,1980,1,0,0,0,1988,1981,1,0,0,0,1988,1982,1,0,0,0,1988,
	1983,1,0,0,0,1988,1984,1,0,0,0,1988,1985,1,0,0,0,1988,1986,1,0,0,0,1988,
	1987,1,0,0,0,1989,219,1,0,0,0,1990,1991,7,17,0,0,1991,221,1,0,0,0,1992,
	2007,5,143,0,0,1993,2007,3,224,112,0,1994,2007,3,226,113,0,1995,1999,5,
	153,0,0,1996,1998,5,153,0,0,1997,1996,1,0,0,0,1998,2001,1,0,0,0,1999,1997,
	1,0,0,0,1999,2000,1,0,0,0,2000,2007,1,0,0,0,2001,1999,1,0,0,0,2002,2007,
	5,163,0,0,2003,2007,5,164,0,0,2004,2007,5,154,0,0,2005,2007,5,155,0,0,2006,
	1992,1,0,0,0,2006,1993,1,0,0,0,2006,1994,1,0,0,0,2006,1995,1,0,0,0,2006,
	2002,1,0,0,0,2006,2003,1,0,0,0,2006,2004,1,0,0,0,2006,2005,1,0,0,0,2007,
	223,1,0,0,0,2008,2010,5,146,0,0,2009,2011,5,144,0,0,2010,2009,1,0,0,0,2010,
	2011,1,0,0,0,2011,225,1,0,0,0,2012,2013,5,145,0,0,2013,227,1,0,0,0,2014,
	2015,5,139,0,0,2015,2028,5,50,0,0,2016,2028,5,139,0,0,2017,2028,5,149,0,
	0,2018,2028,5,151,0,0,2019,2028,5,150,0,0,2020,2028,5,158,0,0,2021,2028,
	5,159,0,0,2022,2028,5,140,0,0,2023,2028,5,141,0,0,2024,2028,5,160,0,0,2025,
	2028,5,161,0,0,2026,2028,5,165,0,0,2027,2014,1,0,0,0,2027,2016,1,0,0,0,
	2027,2017,1,0,0,0,2027,2018,1,0,0,0,2027,2019,1,0,0,0,2027,2020,1,0,0,0,
	2027,2021,1,0,0,0,2027,2022,1,0,0,0,2027,2023,1,0,0,0,2027,2024,1,0,0,0,
	2027,2025,1,0,0,0,2027,2026,1,0,0,0,2028,229,1,0,0,0,2029,2030,7,18,0,0,
	2030,231,1,0,0,0,199,235,241,247,253,259,265,271,277,283,289,295,300,319,
	323,330,335,341,347,357,360,370,374,380,383,387,392,396,409,412,426,429,
	435,441,447,453,459,465,471,486,499,509,515,521,527,533,539,545,550,558,
	561,567,573,579,585,591,597,603,609,615,619,623,625,629,632,642,648,652,
	664,668,670,674,680,692,696,698,712,728,732,739,759,766,777,783,790,806,
	815,821,832,839,845,852,858,864,868,876,881,889,899,904,908,920,929,931,
	937,943,950,961,967,971,977,984,1000,1006,1014,1022,1027,1031,1041,1045,
	1047,1055,1064,1069,1075,1080,1115,1141,1153,1165,1169,1174,1193,1198,1204,
	1223,1238,1255,1275,1287,1295,1305,1320,1327,1337,1402,1406,1415,1425,1437,
	1445,1497,1513,1538,1550,1563,1567,1577,1585,1591,1597,1606,1610,1612,1618,
	1626,1630,1632,1635,1661,1671,1679,1683,1685,1703,1707,1709,1713,1725,1729,
	1731,1741,1745,1759,1763,1776,1784,1859,1863,1865,1887,1895,1965,1970,1972,
	1988,1999,2006,2010,2027];

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
