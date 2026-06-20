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
	public static readonly RULE_assignmentStatement = 60;
	public static readonly RULE_mappingDeleteStatement = 61;
	public static readonly RULE_variableDefinition = 62;
	public static readonly RULE_tupleAssignment = 63;
	public static readonly RULE_tupleSlot = 64;
	public static readonly RULE_assignStatement = 65;
	public static readonly RULE_arrayPushStatement = 66;
	public static readonly RULE_arrayPopStatement = 67;
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
		"addressMethodStatement", "emitStatement", "assignmentStatement", "mappingDeleteStatement", 
		"variableDefinition", "tupleAssignment", "tupleSlot", "assignStatement", 
		"arrayPushStatement", "arrayPopStatement", "arrayDeleteStatement", "stateArrayPushStatement", 
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
			this.state = 255;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 3, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					this.state = 253;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 2, this._ctx) ) {
					case 1:
						{
						this.state = 244;
						this.constantDefinition();
						}
						break;
					case 2:
						{
						this.state = 245;
						this.enumDefinition();
						}
						break;
					case 3:
						{
						this.state = 246;
						this.structDefinition();
						}
						break;
					case 4:
						{
						this.state = 247;
						this.typeDefinition();
						}
						break;
					case 5:
						{
						this.state = 248;
						this.usingForDirective();
						}
						break;
					case 6:
						{
						this.state = 249;
						this.errorDefinition();
						}
						break;
					case 7:
						{
						this.state = 250;
						this.interfaceDefinition();
						}
						break;
					case 8:
						{
						this.state = 251;
						this.freeFunctionDefinition();
						}
						break;
					case 9:
						{
						this.state = 252;
						this.libraryDefinition();
						}
						break;
					}
					}
				}
				this.state = 257;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 3, this._ctx);
			}
			this.state = 260;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 37:
			case 38:
				{
				this.state = 258;
				this.contractDefinition();
				}
				break;
			case 36:
				{
				this.state = 259;
				this.libraryDefinition();
				}
				break;
			case -1:
				break;
			default:
				break;
			}
			this.state = 262;
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
			this.state = 290;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 7, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 264;
				this.match(SolidCashParser.T__0);
				this.state = 265;
				this.match(SolidCashParser.StringLiteral);
				this.state = 266;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 267;
				this.match(SolidCashParser.T__0);
				this.state = 268;
				this.match(SolidCashParser.StringLiteral);
				this.state = 269;
				this.match(SolidCashParser.T__2);
				this.state = 270;
				this.match(SolidCashParser.Identifier);
				this.state = 271;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 272;
				this.match(SolidCashParser.T__0);
				this.state = 273;
				this.match(SolidCashParser.T__3);
				this.state = 274;
				this.importBinding();
				this.state = 279;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 5, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 275;
						this.match(SolidCashParser.T__4);
						this.state = 276;
						this.importBinding();
						}
						}
					}
					this.state = 281;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 5, this._ctx);
				}
				this.state = 283;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 282;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 285;
				this.match(SolidCashParser.T__5);
				this.state = 286;
				this.match(SolidCashParser.Identifier);
				this.state = 287;
				this.match(SolidCashParser.StringLiteral);
				this.state = 288;
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
			this.state = 292;
			this.match(SolidCashParser.Identifier);
			this.state = 295;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 293;
				this.match(SolidCashParser.T__2);
				this.state = 294;
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
			this.state = 297;
			this.match(SolidCashParser.T__6);
			this.state = 298;
			this.match(SolidCashParser.Identifier);
			this.state = 299;
			this.parameterList();
			this.state = 303;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 4029480963) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 15) !== 0)) {
				{
				{
				this.state = 300;
				this.functionModifier();
				}
				}
				this.state = 305;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
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
			switch ( this._interp.adaptivePredict(this._input, 18, this._ctx) ) {
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
				_alt = this._interp.adaptivePredict(this._input, 14, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 14, this._ctx);
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
			_alt = this._interp.adaptivePredict(this._input, 29, this._ctx);
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
				_alt = this._interp.adaptivePredict(this._input, 29, this._ctx);
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
			switch ( this._interp.adaptivePredict(this._input, 32, this._ctx) ) {
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
			this.state = 467;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 4029480963) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 15) !== 0)) {
				{
				{
				this.state = 464;
				this.functionModifier();
				}
				}
				this.state = 469;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 471;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===70) {
				{
				this.state = 470;
				this.returnType();
				}
			}

			this.state = 473;
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
			this.state = 475;
			this.match(SolidCashParser.T__35);
			this.state = 476;
			this.match(SolidCashParser.Identifier);
			this.state = 477;
			this.match(SolidCashParser.T__3);
			this.state = 481;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===46) {
				{
				{
				this.state = 478;
				this.enumDefinition();
				}
				}
				this.state = 483;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 487;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===45) {
				{
				{
				this.state = 484;
				this.structDefinition();
				}
				}
				this.state = 489;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 493;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===47) {
				{
				{
				this.state = 490;
				this.typeDefinition();
				}
				}
				this.state = 495;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 499;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===39) {
				{
				{
				this.state = 496;
				this.eventDefinition();
				}
				}
				this.state = 501;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 505;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===44) {
				{
				{
				this.state = 502;
				this.errorDefinition();
				}
				}
				this.state = 507;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 511;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 40, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 508;
					this.constantDefinition();
					}
					}
				}
				this.state = 513;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 40, this._ctx);
			}
			this.state = 517;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===8) {
				{
				{
				this.state = 514;
				this.usingForDirective();
				}
				}
				this.state = 519;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 523;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 520;
				this.freeFunctionDefinition();
				}
				}
				this.state = 525;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 526;
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
			this.state = 529;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===37) {
				{
				this.state = 528;
				this.match(SolidCashParser.T__36);
				}
			}

			this.state = 531;
			this.match(SolidCashParser.T__37);
			this.state = 532;
			this.match(SolidCashParser.Identifier);
			this.state = 534;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 533;
				this.parameterList();
				}
			}

			this.state = 545;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===33) {
				{
				this.state = 536;
				this.match(SolidCashParser.T__32);
				this.state = 537;
				this.match(SolidCashParser.Identifier);
				this.state = 542;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 538;
					this.match(SolidCashParser.T__4);
					this.state = 539;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 544;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 547;
			this.match(SolidCashParser.T__3);
			this.state = 564;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 74693667) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
				{
				this.state = 562;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 47, this._ctx) ) {
				case 1:
					{
					this.state = 548;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 549;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 550;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 551;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 552;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 553;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 554;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 555;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 556;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 557;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 558;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 559;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 560;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 561;
					this.receiveDefinition();
					}
					break;
				}
				}
				this.state = 566;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 567;
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
			this.state = 569;
			this.match(SolidCashParser.T__6);
			this.state = 570;
			this.match(SolidCashParser.Identifier);
			this.state = 571;
			this.parameterList();
			this.state = 575;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 4029480963) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 15) !== 0)) {
				{
				{
				this.state = 572;
				this.functionModifier();
				}
				}
				this.state = 577;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 581;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===172) {
				{
				{
				this.state = 578;
				this.customModifierInvocation();
				}
				}
				this.state = 583;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 585;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===70) {
				{
				this.state = 584;
				this.returnType();
				}
			}

			this.state = 587;
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
			this.state = 589;
			this.match(SolidCashParser.T__38);
			this.state = 590;
			this.match(SolidCashParser.Identifier);
			this.state = 591;
			this.match(SolidCashParser.T__39);
			this.state = 603;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
				{
				this.state = 592;
				this.eventParameter();
				this.state = 597;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 52, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 593;
						this.match(SolidCashParser.T__4);
						this.state = 594;
						this.eventParameter();
						}
						}
					}
					this.state = 599;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 52, this._ctx);
				}
				this.state = 601;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 600;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 605;
			this.match(SolidCashParser.T__40);
			this.state = 607;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 606;
				this.match(SolidCashParser.T__41);
				}
			}

			this.state = 609;
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
			this.state = 611;
			this.typeName();
			this.state = 613;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===43) {
				{
				this.state = 612;
				this.match(SolidCashParser.T__42);
				}
			}

			this.state = 615;
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
			this.state = 617;
			this.match(SolidCashParser.T__43);
			this.state = 618;
			this.match(SolidCashParser.Identifier);
			this.state = 619;
			this.match(SolidCashParser.T__39);
			this.state = 631;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
				{
				this.state = 620;
				this.errorParameter();
				this.state = 625;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 57, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 621;
						this.match(SolidCashParser.T__4);
						this.state = 622;
						this.errorParameter();
						}
						}
					}
					this.state = 627;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 57, this._ctx);
				}
				this.state = 629;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 628;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 633;
			this.match(SolidCashParser.T__40);
			this.state = 634;
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
			this.state = 636;
			this.typeName();
			this.state = 637;
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
			this.state = 639;
			this.match(SolidCashParser.T__44);
			this.state = 640;
			this.match(SolidCashParser.Identifier);
			this.state = 641;
			this.match(SolidCashParser.T__3);
			this.state = 643;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 642;
				this.structField();
				}
				}
				this.state = 645;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0));
			this.state = 647;
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
			this.state = 649;
			this.typeName();
			this.state = 650;
			this.match(SolidCashParser.Identifier);
			this.state = 651;
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
			this.state = 653;
			this.match(SolidCashParser.T__45);
			this.state = 654;
			this.match(SolidCashParser.Identifier);
			this.state = 655;
			this.match(SolidCashParser.T__3);
			this.state = 656;
			this.enumMember();
			this.state = 661;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 61, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 657;
					this.match(SolidCashParser.T__4);
					this.state = 658;
					this.enumMember();
					}
					}
				}
				this.state = 663;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 61, this._ctx);
			}
			this.state = 665;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 664;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 667;
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
			this.state = 669;
			this.match(SolidCashParser.Identifier);
			this.state = 672;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===31) {
				{
				this.state = 670;
				this.match(SolidCashParser.T__30);
				this.state = 671;
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
			this.state = 674;
			this.match(SolidCashParser.T__46);
			this.state = 675;
			this.match(SolidCashParser.Identifier);
			this.state = 676;
			this.match(SolidCashParser.T__32);
			this.state = 677;
			this.typeName();
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
	public constantDefinition(): ConstantDefinitionContext {
		let localctx: ConstantDefinitionContext = new ConstantDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 58, SolidCashParser.RULE_constantDefinition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 680;
			this.typeName();
			this.state = 681;
			this.match(SolidCashParser.T__47);
			this.state = 682;
			this.match(SolidCashParser.Identifier);
			this.state = 683;
			this.match(SolidCashParser.T__30);
			this.state = 684;
			this.expression(0);
			this.state = 685;
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
			this.state = 687;
			this.match(SolidCashParser.T__48);
			this.state = 688;
			this.parameterList();
			this.state = 690;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 65539) !== 0)) {
				{
				this.state = 689;
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

			this.state = 695;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===172) {
				{
				{
				this.state = 692;
				this.parentInvocation();
				}
				}
				this.state = 697;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 698;
			this.match(SolidCashParser.T__3);
			this.state = 702;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 699;
				this.statement();
				}
				}
				this.state = 704;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 705;
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
			this.state = 707;
			this.match(SolidCashParser.T__50);
			this.state = 708;
			this.parameterList();
			this.state = 709;
			this.match(SolidCashParser.T__34);
			this.state = 713;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 52)) & ~0x1F) === 0 && ((1 << (_la - 52)) & 65539) !== 0)) {
				{
				{
				this.state = 710;
				this.fallbackModifier();
				}
				}
				this.state = 715;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 719;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===172) {
				{
				{
				this.state = 716;
				this.customModifierInvocation();
				}
				}
				this.state = 721;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 722;
			this.match(SolidCashParser.T__3);
			this.state = 726;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 723;
				this.statement();
				}
				}
				this.state = 728;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 729;
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
			this.state = 734;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 52:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 731;
				this.match(SolidCashParser.T__51);
				}
				break;
			case 53:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 732;
				this.match(SolidCashParser.T__52);
				}
				break;
			case 68:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 733;
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
			this.state = 736;
			this.match(SolidCashParser.T__53);
			this.state = 737;
			this.match(SolidCashParser.T__39);
			this.state = 738;
			this.match(SolidCashParser.T__40);
			this.state = 739;
			this.match(SolidCashParser.T__34);
			this.state = 740;
			this.match(SolidCashParser.T__51);
			this.state = 741;
			this.match(SolidCashParser.T__3);
			this.state = 745;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 742;
				this.statement();
				}
				}
				this.state = 747;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 748;
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
			this.state = 750;
			this.match(SolidCashParser.Identifier);
			this.state = 751;
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
			this.state = 803;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 79, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 754;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 2162691) !== 0)) {
					{
					this.state = 753;
					this.stateVariableVisibility();
					}
				}

				this.state = 756;
				this.typeName();
				this.state = 760;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 757;
					this.modifier();
					}
					}
					this.state = 762;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 763;
				this.match(SolidCashParser.Identifier);
				this.state = 764;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 766;
				this.typeName();
				this.state = 767;
				this.stateVariableVisibility();
				this.state = 771;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 768;
					this.modifier();
					}
					}
					this.state = 773;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 774;
				this.match(SolidCashParser.Identifier);
				this.state = 775;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 778;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 2162691) !== 0)) {
					{
					this.state = 777;
					this.stateVariableVisibility();
					}
				}

				this.state = 780;
				this.mappingType();
				this.state = 784;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 2179075) !== 0) || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 781;
					this.collectionModifier();
					}
					}
					this.state = 786;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 787;
				this.match(SolidCashParser.Identifier);
				this.state = 788;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 791;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 2162691) !== 0)) {
					{
					this.state = 790;
					this.stateVariableVisibility();
					}
				}

				this.state = 793;
				this.arrayType(0);
				this.state = 797;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 2179075) !== 0) || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 794;
					this.collectionModifier();
					}
					}
					this.state = 799;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 800;
				this.match(SolidCashParser.Identifier);
				this.state = 801;
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
			this.state = 807;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 48:
			case 144:
			case 145:
			case 146:
			case 147:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 805;
				this.modifier();
				}
				break;
			case 34:
			case 35:
			case 50:
			case 55:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 806;
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
			this.state = 809;
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
			this.state = 847;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 86, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 811;
				this.match(SolidCashParser.T__55);
				this.state = 812;
				this.match(SolidCashParser.T__39);
				this.state = 813;
				this.typeName();
				this.state = 815;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 814;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 817;
				this.match(SolidCashParser.T__56);
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
				this.match(SolidCashParser.T__40);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 824;
				this.match(SolidCashParser.T__55);
				this.state = 825;
				this.match(SolidCashParser.T__39);
				this.state = 826;
				this.typeName();
				this.state = 828;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 827;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 830;
				this.match(SolidCashParser.T__56);
				this.state = 831;
				this.mappingType();
				this.state = 832;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 834;
				this.match(SolidCashParser.T__55);
				this.state = 835;
				this.match(SolidCashParser.T__39);
				this.state = 836;
				this.typeName();
				this.state = 838;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 837;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 840;
				this.match(SolidCashParser.T__56);
				this.state = 841;
				this.arrayType(0);
				this.state = 843;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 842;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 845;
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
			this.state = 859;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 87, this._ctx) ) {
			case 1:
				{
				this.state = 850;
				this.typeName();
				this.state = 851;
				this.match(SolidCashParser.T__57);
				this.state = 852;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 853;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				{
				this.state = 855;
				this.typeName();
				this.state = 856;
				this.match(SolidCashParser.T__57);
				this.state = 857;
				this.match(SolidCashParser.T__58);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 870;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 89, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 868;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 88, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 861;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 862;
						this.match(SolidCashParser.T__57);
						this.state = 863;
						this.match(SolidCashParser.NumberLiteral);
						this.state = 864;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 865;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 866;
						this.match(SolidCashParser.T__57);
						this.state = 867;
						this.match(SolidCashParser.T__58);
						}
						break;
					}
					}
				}
				this.state = 872;
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
			this.state = 873;
			this.match(SolidCashParser.T__59);
			this.state = 874;
			this.match(SolidCashParser.Identifier);
			this.state = 876;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 875;
				this.parameterList();
				}
			}

			this.state = 878;
			this.match(SolidCashParser.T__3);
			this.state = 882;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2149847169) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 879;
				this.modifierStatement();
				}
				}
				this.state = 884;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 885;
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
			this.state = 889;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 61:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 887;
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
				this.state = 888;
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
			this.state = 891;
			this.match(SolidCashParser.T__60);
			this.state = 892;
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
			this.state = 894;
			this.match(SolidCashParser.T__6);
			this.state = 895;
			this.match(SolidCashParser.Identifier);
			this.state = 896;
			this.parameterList();
			this.state = 900;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 4029480963) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 15) !== 0)) {
				{
				{
				this.state = 897;
				this.functionModifier();
				}
				}
				this.state = 902;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 906;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===172) {
				{
				{
				this.state = 903;
				this.customModifierInvocation();
				}
				}
				this.state = 908;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 910;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===70) {
				{
				this.state = 909;
				this.returnType();
				}
			}

			this.state = 912;
			this.match(SolidCashParser.T__3);
			this.state = 916;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 913;
				this.statement();
				}
				}
				this.state = 918;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 919;
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
			this.state = 921;
			this.match(SolidCashParser.Identifier);
			this.state = 923;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 922;
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
			this.state = 939;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 62:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 925;
				this.match(SolidCashParser.T__61);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 926;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 50:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 927;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 35:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 928;
				this.match(SolidCashParser.T__34);
				}
				break;
			case 34:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 929;
				this.match(SolidCashParser.T__33);
				}
				break;
			case 55:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 930;
				this.match(SolidCashParser.T__54);
				}
				break;
			case 52:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 931;
				this.match(SolidCashParser.T__51);
				}
				break;
			case 68:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 932;
				this.overrideSpecifier();
				}
				break;
			case 53:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 933;
				this.match(SolidCashParser.T__52);
				}
				break;
			case 69:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 934;
				this.unsafeModifier();
				}
				break;
			case 64:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 935;
				this.match(SolidCashParser.T__63);
				}
				break;
			case 65:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 936;
				this.match(SolidCashParser.T__64);
				}
				break;
			case 66:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 937;
				this.match(SolidCashParser.T__65);
				}
				break;
			case 67:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 938;
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
			this.state = 941;
			this.match(SolidCashParser.T__67);
			this.state = 952;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 942;
				this.match(SolidCashParser.T__39);
				this.state = 943;
				this.match(SolidCashParser.Identifier);
				this.state = 948;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 944;
					this.match(SolidCashParser.T__4);
					this.state = 945;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 950;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 951;
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
			this.state = 954;
			this.match(SolidCashParser.T__68);
			this.state = 958;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 955;
				this.match(SolidCashParser.T__39);
				this.state = 956;
				this.match(SolidCashParser.NumberLiteral);
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
	public returnType(): ReturnTypeContext {
		let localctx: ReturnTypeContext = new ReturnTypeContext(this, this._ctx, this.state);
		this.enterRule(localctx, 96, SolidCashParser.RULE_returnType);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 960;
			this.match(SolidCashParser.T__69);
			this.state = 961;
			this.match(SolidCashParser.T__39);
			this.state = 962;
			this.returnParam();
			this.state = 967;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 102, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 963;
					this.match(SolidCashParser.T__4);
					this.state = 964;
					this.returnParam();
					}
					}
				}
				this.state = 969;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 102, this._ctx);
			}
			this.state = 971;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 970;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 973;
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
			this.state = 975;
			this.typeName();
			this.state = 979;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
				{
				{
				this.state = 976;
				this.modifier();
				}
				}
				this.state = 981;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 983;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===172) {
				{
				this.state = 982;
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
			this.state = 985;
			this.match(SolidCashParser.T__39);
			this.state = 997;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
				{
				this.state = 986;
				this.parameter();
				this.state = 991;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 106, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 987;
						this.match(SolidCashParser.T__4);
						this.state = 988;
						this.parameter();
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
				if (_la===5) {
					{
					this.state = 994;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 999;
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
			this.state = 1019;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 111, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1001;
				this.typeName();
				this.state = 1005;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 1002;
					this.modifier();
					}
					}
					this.state = 1007;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1008;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1010;
				this.arrayType(0);
				this.state = 1014;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
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
				this.state = 1017;
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
			this.state = 1030;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1021;
				this.match(SolidCashParser.T__3);
				this.state = 1025;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
					{
					{
					this.state = 1022;
					this.statement();
					}
					}
					this.state = 1027;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1028;
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
				this.state = 1029;
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
			this.state = 1062;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 114, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1032;
				this.variableDefinition();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1033;
				this.tupleAssignment();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1034;
				this.arrayPushStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1035;
				this.arrayPopStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1036;
				this.arrayDeleteStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1037;
				this.stateArrayPushStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1038;
				this.stateArrayPopStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1039;
				this.assignStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1040;
				this.assignmentStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1041;
				this.mappingDeleteStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1042;
				this.timeOpStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1043;
				this.requireStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1044;
				this.ifStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1045;
				this.loopStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1046;
				this.consoleStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1047;
				this.emitStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1048;
				this.transferStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1049;
				this.tokenContainerMethodStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1050;
				this.returnStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1051;
				this.functionCallStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1052;
				this.addressMethodStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1053;
				this.assemblyStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1054;
				this.tryCatchStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1055;
				this.revertStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1056;
				this.assertStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1057;
				this.deleteStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1058;
				this.uncheckedStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1059;
				this.switchStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1060;
				this.breakStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1061;
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
			this.state = 1064;
			this.match(SolidCashParser.T__70);
			this.state = 1065;
			this.match(SolidCashParser.T__11);
			this.state = 1066;
			this.match(SolidCashParser.Identifier);
			this.state = 1067;
			this.match(SolidCashParser.T__39);
			this.state = 1068;
			this.expression(0);
			this.state = 1069;
			this.match(SolidCashParser.T__4);
			this.state = 1070;
			this.expression(0);
			this.state = 1071;
			this.match(SolidCashParser.T__40);
			this.state = 1072;
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
			this.state = 1074;
			this.match(SolidCashParser.T__70);
			this.state = 1075;
			this.match(SolidCashParser.T__11);
			this.state = 1076;
			this.match(SolidCashParser.Identifier);
			this.state = 1077;
			this.match(SolidCashParser.T__57);
			this.state = 1078;
			this.expression(0);
			this.state = 1079;
			this.match(SolidCashParser.T__58);
			this.state = 1080;
			this.match(SolidCashParser.T__11);
			this.state = 1081;
			this.match(SolidCashParser.Identifier);
			this.state = 1082;
			this.match(SolidCashParser.T__39);
			this.state = 1083;
			this.expression(0);
			this.state = 1088;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1084;
				this.match(SolidCashParser.T__4);
				this.state = 1085;
				this.expression(0);
				}
				}
				this.state = 1090;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1091;
			this.match(SolidCashParser.T__40);
			this.state = 1092;
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
			this.state = 1123;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 119, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1094;
				this.match(SolidCashParser.T__71);
				this.state = 1095;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1096;
				this.match(SolidCashParser.T__71);
				this.state = 1097;
				this.expression(0);
				this.state = 1102;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1098;
					this.match(SolidCashParser.T__4);
					this.state = 1099;
					this.expression(0);
					}
					}
					this.state = 1104;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1105;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1107;
				this.match(SolidCashParser.T__71);
				this.state = 1108;
				this.match(SolidCashParser.T__39);
				this.state = 1109;
				this.expression(0);
				this.state = 1114;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 117, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1110;
						this.match(SolidCashParser.T__4);
						this.state = 1111;
						this.expression(0);
						}
						}
					}
					this.state = 1116;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 117, this._ctx);
				}
				this.state = 1118;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1117;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1120;
				this.match(SolidCashParser.T__40);
				this.state = 1121;
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
			this.state = 1170;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 125, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1125;
				this.match(SolidCashParser.Identifier);
				this.state = 1128;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1126;
					this.match(SolidCashParser.T__11);
					this.state = 1127;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1130;
				this.match(SolidCashParser.T__39);
				this.state = 1131;
				this.match(SolidCashParser.T__3);
				this.state = 1143;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 1132;
					this.namedArg();
					this.state = 1137;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 121, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1133;
							this.match(SolidCashParser.T__4);
							this.state = 1134;
							this.namedArg();
							}
							}
						}
						this.state = 1139;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 121, this._ctx);
					}
					this.state = 1141;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1140;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1145;
				this.match(SolidCashParser.T__5);
				this.state = 1146;
				this.match(SolidCashParser.T__40);
				this.state = 1147;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1148;
				this.match(SolidCashParser.Identifier);
				this.state = 1149;
				this.expressionList();
				this.state = 1150;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1152;
				this.match(SolidCashParser.Identifier);
				this.state = 1153;
				this.match(SolidCashParser.T__11);
				this.state = 1154;
				this.match(SolidCashParser.Identifier);
				this.state = 1155;
				this.expressionList();
				this.state = 1156;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1158;
				this.match(SolidCashParser.Identifier);
				this.state = 1159;
				this.expressionList();
				this.state = 1160;
				this.match(SolidCashParser.T__11);
				this.state = 1161;
				this.match(SolidCashParser.Identifier);
				this.state = 1162;
				this.match(SolidCashParser.T__11);
				this.state = 1163;
				this.match(SolidCashParser.Identifier);
				this.state = 1165;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1164;
					this.callOptions();
					}
				}

				this.state = 1167;
				this.expressionList();
				this.state = 1168;
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
			this.state = 1172;
			this.expression(0);
			this.state = 1173;
			this.match(SolidCashParser.T__11);
			this.state = 1174;
			this.match(SolidCashParser.Identifier);
			this.state = 1176;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===4) {
				{
				this.state = 1175;
				this.callOptions();
				}
			}

			this.state = 1178;
			this.expressionList();
			this.state = 1179;
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
			this.state = 1214;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 132, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1181;
				this.match(SolidCashParser.T__72);
				this.state = 1182;
				this.match(SolidCashParser.Identifier);
				this.state = 1185;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1183;
					this.match(SolidCashParser.T__11);
					this.state = 1184;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1187;
				this.match(SolidCashParser.T__39);
				this.state = 1188;
				this.match(SolidCashParser.T__3);
				this.state = 1200;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 1189;
					this.namedArg();
					this.state = 1194;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 128, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1190;
							this.match(SolidCashParser.T__4);
							this.state = 1191;
							this.namedArg();
							}
							}
						}
						this.state = 1196;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 128, this._ctx);
					}
					this.state = 1198;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1197;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1202;
				this.match(SolidCashParser.T__5);
				this.state = 1203;
				this.match(SolidCashParser.T__40);
				this.state = 1204;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1205;
				this.match(SolidCashParser.T__72);
				this.state = 1206;
				this.match(SolidCashParser.Identifier);
				this.state = 1209;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1207;
					this.match(SolidCashParser.T__11);
					this.state = 1208;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1211;
				this.expressionList();
				this.state = 1212;
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
		this.enterRule(localctx, 120, SolidCashParser.RULE_assignmentStatement);
		let _la: number;
		try {
			this.state = 1254;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 71:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1216;
				this.match(SolidCashParser.T__70);
				this.state = 1217;
				this.match(SolidCashParser.T__11);
				this.state = 1218;
				this.match(SolidCashParser.Identifier);
				this.state = 1231;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===58) {
					{
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
					this.state = 1229;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===12) {
						{
						this.state = 1227;
						this.match(SolidCashParser.T__11);
						this.state = 1228;
						this.match(SolidCashParser.Identifier);
						}
					}

					}
				}

				this.state = 1233;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===31 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1234;
				this.expression(0);
				this.state = 1235;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 172:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1237;
				this.match(SolidCashParser.Identifier);
				this.state = 1242;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1238;
					this.match(SolidCashParser.T__57);
					this.state = 1239;
					this.expression(0);
					this.state = 1240;
					this.match(SolidCashParser.T__58);
					}
					}
					this.state = 1244;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===58);
				this.state = 1248;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1246;
					this.match(SolidCashParser.T__11);
					this.state = 1247;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1250;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===31 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1251;
				this.expression(0);
				this.state = 1252;
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
	public mappingDeleteStatement(): MappingDeleteStatementContext {
		let localctx: MappingDeleteStatementContext = new MappingDeleteStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 122, SolidCashParser.RULE_mappingDeleteStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1256;
			this.match(SolidCashParser.T__70);
			this.state = 1257;
			this.match(SolidCashParser.T__11);
			this.state = 1258;
			this.match(SolidCashParser.Identifier);
			this.state = 1265;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===58) {
				{
				{
				this.state = 1259;
				this.match(SolidCashParser.T__57);
				this.state = 1260;
				this.expression(0);
				this.state = 1261;
				this.match(SolidCashParser.T__58);
				}
				}
				this.state = 1267;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1268;
			this.match(SolidCashParser.T__83);
			this.state = 1269;
			this.match(SolidCashParser.T__39);
			this.state = 1270;
			this.expression(0);
			this.state = 1271;
			this.match(SolidCashParser.T__40);
			this.state = 1272;
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
			this.state = 1300;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 143, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1274;
				this.typeName();
				this.state = 1278;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 1275;
					this.modifier();
					}
					}
					this.state = 1280;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1281;
				this.match(SolidCashParser.Identifier);
				this.state = 1284;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===31) {
					{
					this.state = 1282;
					this.match(SolidCashParser.T__30);
					this.state = 1283;
					this.expression(0);
					}
				}

				this.state = 1286;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1288;
				this.arrayType(0);
				this.state = 1292;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
					{
					{
					this.state = 1289;
					this.modifier();
					}
					}
					this.state = 1294;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1295;
				this.match(SolidCashParser.Identifier);
				this.state = 1296;
				this.match(SolidCashParser.T__30);
				this.state = 1297;
				this.expression(0);
				this.state = 1298;
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
			this.state = 1350;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 148, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1302;
				this.typeName();
				this.state = 1303;
				this.match(SolidCashParser.Identifier);
				this.state = 1308;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1304;
					this.match(SolidCashParser.T__4);
					this.state = 1305;
					this.typeName();
					this.state = 1306;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1310;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1312;
				this.match(SolidCashParser.T__30);
				this.state = 1313;
				this.expression(0);
				this.state = 1314;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1316;
				this.match(SolidCashParser.T__39);
				this.state = 1317;
				this.tupleSlot();
				this.state = 1320;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1318;
					this.match(SolidCashParser.T__4);
					this.state = 1319;
					this.tupleSlot();
					}
					}
					this.state = 1322;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1324;
				this.match(SolidCashParser.T__40);
				this.state = 1325;
				this.match(SolidCashParser.T__30);
				this.state = 1326;
				this.match(SolidCashParser.T__39);
				this.state = 1327;
				this.expression(0);
				this.state = 1330;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1328;
					this.match(SolidCashParser.T__4);
					this.state = 1329;
					this.expression(0);
					}
					}
					this.state = 1332;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1334;
				this.match(SolidCashParser.T__40);
				this.state = 1335;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1337;
				this.match(SolidCashParser.T__39);
				this.state = 1338;
				this.tupleSlot();
				this.state = 1341;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1339;
					this.match(SolidCashParser.T__4);
					this.state = 1340;
					this.tupleSlot();
					}
					}
					this.state = 1343;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1345;
				this.match(SolidCashParser.T__40);
				this.state = 1346;
				this.match(SolidCashParser.T__30);
				this.state = 1347;
				this.expression(0);
				this.state = 1348;
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
		this.enterRule(localctx, 128, SolidCashParser.RULE_tupleSlot);
		try {
			this.state = 1357;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 149, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1352;
				this.typeName();
				this.state = 1353;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1355;
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
		this.enterRule(localctx, 130, SolidCashParser.RULE_assignStatement);
		let _la: number;
		try {
			this.state = 1367;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 150, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1359;
				this.match(SolidCashParser.Identifier);
				this.state = 1360;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===31 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1361;
				this.expression(0);
				this.state = 1362;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1364;
				this.match(SolidCashParser.Identifier);
				this.state = 1365;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===85 || _la===86)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1366;
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
			this.state = 1369;
			this.match(SolidCashParser.Identifier);
			this.state = 1370;
			this.match(SolidCashParser.T__86);
			this.state = 1371;
			this.match(SolidCashParser.T__39);
			this.state = 1372;
			this.expression(0);
			this.state = 1373;
			this.match(SolidCashParser.T__40);
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
	public arrayPopStatement(): ArrayPopStatementContext {
		let localctx: ArrayPopStatementContext = new ArrayPopStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 134, SolidCashParser.RULE_arrayPopStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1376;
			this.match(SolidCashParser.Identifier);
			this.state = 1377;
			this.match(SolidCashParser.T__87);
			this.state = 1378;
			this.match(SolidCashParser.T__39);
			this.state = 1379;
			this.match(SolidCashParser.T__40);
			this.state = 1380;
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
			this.state = 1382;
			this.match(SolidCashParser.Identifier);
			this.state = 1383;
			this.match(SolidCashParser.T__83);
			this.state = 1384;
			this.match(SolidCashParser.T__39);
			this.state = 1385;
			this.expression(0);
			this.state = 1386;
			this.match(SolidCashParser.T__40);
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
	public stateArrayPushStatement(): StateArrayPushStatementContext {
		let localctx: StateArrayPushStatementContext = new StateArrayPushStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 138, SolidCashParser.RULE_stateArrayPushStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1389;
			this.match(SolidCashParser.T__70);
			this.state = 1390;
			this.match(SolidCashParser.T__11);
			this.state = 1391;
			this.match(SolidCashParser.Identifier);
			this.state = 1392;
			this.match(SolidCashParser.T__86);
			this.state = 1393;
			this.match(SolidCashParser.T__39);
			this.state = 1394;
			this.expression(0);
			this.state = 1395;
			this.match(SolidCashParser.T__40);
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
	public stateArrayPopStatement(): StateArrayPopStatementContext {
		let localctx: StateArrayPopStatementContext = new StateArrayPopStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 140, SolidCashParser.RULE_stateArrayPopStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1398;
			this.match(SolidCashParser.T__70);
			this.state = 1399;
			this.match(SolidCashParser.T__11);
			this.state = 1400;
			this.match(SolidCashParser.Identifier);
			this.state = 1401;
			this.match(SolidCashParser.T__87);
			this.state = 1402;
			this.match(SolidCashParser.T__39);
			this.state = 1403;
			this.match(SolidCashParser.T__40);
			this.state = 1404;
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
			this.state = 1428;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 152, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1406;
				this.match(SolidCashParser.T__88);
				this.state = 1407;
				this.match(SolidCashParser.Identifier);
				this.state = 1408;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1409;
				this.match(SolidCashParser.T__88);
				this.state = 1410;
				this.match(SolidCashParser.T__70);
				this.state = 1411;
				this.match(SolidCashParser.T__11);
				this.state = 1412;
				this.match(SolidCashParser.Identifier);
				this.state = 1413;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1414;
				this.match(SolidCashParser.T__88);
				this.state = 1415;
				this.match(SolidCashParser.T__70);
				this.state = 1416;
				this.match(SolidCashParser.T__11);
				this.state = 1417;
				this.match(SolidCashParser.Identifier);
				this.state = 1422;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1418;
					this.match(SolidCashParser.T__57);
					this.state = 1419;
					this.expression(0);
					this.state = 1420;
					this.match(SolidCashParser.T__58);
					}
					}
					this.state = 1424;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===58);
				this.state = 1426;
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
			this.state = 1430;
			this.match(SolidCashParser.T__89);
			this.state = 1431;
			this.match(SolidCashParser.T__39);
			this.state = 1432;
			this.match(SolidCashParser.TxVar);
			this.state = 1433;
			this.match(SolidCashParser.T__22);
			this.state = 1434;
			this.expression(0);
			this.state = 1437;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1435;
				this.match(SolidCashParser.T__4);
				this.state = 1436;
				this.requireMessage();
				}
			}

			this.state = 1439;
			this.match(SolidCashParser.T__40);
			this.state = 1440;
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
			this.state = 1442;
			this.match(SolidCashParser.T__89);
			this.state = 1443;
			this.match(SolidCashParser.T__39);
			this.state = 1444;
			this.expression(0);
			this.state = 1447;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1445;
				this.match(SolidCashParser.T__4);
				this.state = 1446;
				this.requireMessage();
				}
			}

			this.state = 1449;
			this.match(SolidCashParser.T__40);
			this.state = 1450;
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
			this.state = 1452;
			this.match(SolidCashParser.T__90);
			this.state = 1453;
			this.match(SolidCashParser.T__39);
			this.state = 1454;
			this.expression(0);
			this.state = 1455;
			this.match(SolidCashParser.T__40);
			this.state = 1456;
			localctx._ifBlock = this.block();
			this.state = 1459;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 155, this._ctx) ) {
			case 1:
				{
				this.state = 1457;
				this.match(SolidCashParser.T__91);
				this.state = 1458;
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
			this.state = 1467;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 156, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1461;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1462;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1463;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1464;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1465;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1466;
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
			this.state = 1469;
			this.match(SolidCashParser.T__8);
			this.state = 1470;
			this.match(SolidCashParser.T__39);
			this.state = 1471;
			this.typeName();
			this.state = 1472;
			this.match(SolidCashParser.Identifier);
			this.state = 1473;
			this.match(SolidCashParser.T__4);
			this.state = 1474;
			this.typeName();
			this.state = 1475;
			this.match(SolidCashParser.Identifier);
			this.state = 1476;
			this.match(SolidCashParser.T__92);
			this.state = 1477;
			this.match(SolidCashParser.T__70);
			this.state = 1478;
			this.match(SolidCashParser.T__11);
			this.state = 1479;
			this.match(SolidCashParser.Identifier);
			this.state = 1480;
			this.match(SolidCashParser.T__11);
			this.state = 1481;
			this.match(SolidCashParser.T__93);
			this.state = 1482;
			this.match(SolidCashParser.T__40);
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
	public forInStatement(): ForInStatementContext {
		let localctx: ForInStatementContext = new ForInStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 154, SolidCashParser.RULE_forInStatement);
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
			this.match(SolidCashParser.T__94);
			this.state = 1490;
			this.match(SolidCashParser.T__70);
			this.state = 1491;
			this.match(SolidCashParser.T__11);
			this.state = 1492;
			this.match(SolidCashParser.Identifier);
			this.state = 1493;
			this.match(SolidCashParser.T__40);
			this.state = 1494;
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
			this.state = 1496;
			this.match(SolidCashParser.T__8);
			this.state = 1497;
			this.match(SolidCashParser.T__39);
			this.state = 1498;
			this.typeName();
			this.state = 1499;
			this.match(SolidCashParser.Identifier);
			this.state = 1500;
			this.match(SolidCashParser.T__92);
			this.state = 1501;
			this.match(SolidCashParser.T__70);
			this.state = 1502;
			this.match(SolidCashParser.T__11);
			this.state = 1503;
			this.match(SolidCashParser.Identifier);
			this.state = 1504;
			this.match(SolidCashParser.T__40);
			this.state = 1505;
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
			this.state = 1507;
			this.match(SolidCashParser.T__8);
			this.state = 1508;
			this.match(SolidCashParser.T__39);
			this.state = 1509;
			this.forInit();
			this.state = 1510;
			this.forCondition();
			this.state = 1511;
			this.forUpdate();
			this.state = 1512;
			this.match(SolidCashParser.T__40);
			this.state = 1513;
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
			this.state = 1515;
			this.typeName();
			this.state = 1519;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===48 || ((((_la - 144)) & ~0x1F) === 0 && ((1 << (_la - 144)) & 15) !== 0)) {
				{
				{
				this.state = 1516;
				this.modifier();
				}
				}
				this.state = 1521;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1522;
			this.match(SolidCashParser.Identifier);
			this.state = 1523;
			this.match(SolidCashParser.T__30);
			this.state = 1524;
			this.expression(0);
			this.state = 1525;
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
			this.state = 1527;
			this.expression(0);
			this.state = 1528;
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
			this.state = 1535;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 158, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1530;
				this.match(SolidCashParser.Identifier);
				this.state = 1531;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===31 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1532;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1533;
				this.match(SolidCashParser.Identifier);
				this.state = 1534;
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
		this.enterRule(localctx, 166, SolidCashParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1537;
			this.match(SolidCashParser.T__95);
			this.state = 1538;
			this.block();
			this.state = 1539;
			this.match(SolidCashParser.T__96);
			this.state = 1540;
			this.match(SolidCashParser.T__39);
			this.state = 1541;
			this.expression(0);
			this.state = 1542;
			this.match(SolidCashParser.T__40);
			this.state = 1543;
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
			this.state = 1545;
			this.match(SolidCashParser.T__96);
			this.state = 1546;
			this.match(SolidCashParser.T__39);
			this.state = 1547;
			this.expression(0);
			this.state = 1548;
			this.match(SolidCashParser.T__40);
			this.state = 1549;
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
			this.state = 1551;
			this.match(SolidCashParser.T__97);
			this.state = 1552;
			this.consoleParameterList();
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
	public assemblyStatement(): AssemblyStatementContext {
		let localctx: AssemblyStatementContext = new AssemblyStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 172, SolidCashParser.RULE_assemblyStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1555;
			this.match(SolidCashParser.T__98);
			this.state = 1556;
			this.match(SolidCashParser.T__3);
			this.state = 1560;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 155)) & ~0x1F) === 0 && ((1 << (_la - 155)) & 131201) !== 0)) {
				{
				{
				this.state = 1557;
				this.assemblyToken();
				}
				}
				this.state = 1562;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1563;
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
			this.state = 1565;
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
		this.enterRule(localctx, 176, SolidCashParser.RULE_uncheckedStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1567;
			this.match(SolidCashParser.T__99);
			this.state = 1568;
			this.match(SolidCashParser.T__3);
			this.state = 1572;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 1569;
				this.statement();
				}
				}
				this.state = 1574;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1575;
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
			this.state = 1577;
			this.match(SolidCashParser.T__100);
			this.state = 1578;
			this.match(SolidCashParser.T__39);
			this.state = 1579;
			this.expression(0);
			this.state = 1580;
			this.match(SolidCashParser.T__40);
			this.state = 1581;
			this.match(SolidCashParser.T__3);
			this.state = 1585;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===102) {
				{
				{
				this.state = 1582;
				this.switchCase();
				}
				}
				this.state = 1587;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1589;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===104) {
				{
				this.state = 1588;
				this.switchDefault();
				}
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
	public switchCase(): SwitchCaseContext {
		let localctx: SwitchCaseContext = new SwitchCaseContext(this, this._ctx, this.state);
		this.enterRule(localctx, 180, SolidCashParser.RULE_switchCase);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1593;
			this.match(SolidCashParser.T__101);
			this.state = 1594;
			this.expression(0);
			this.state = 1595;
			this.match(SolidCashParser.T__102);
			this.state = 1599;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 1596;
				this.statement();
				}
				}
				this.state = 1601;
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
			this.state = 1602;
			this.match(SolidCashParser.T__103);
			this.state = 1603;
			this.match(SolidCashParser.T__102);
			this.state = 1607;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134234752) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & 1057882115) !== 0) || ((((_la - 105)) & ~0x1F) === 0 && ((1 << (_la - 105)) & 2151809021) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				{
				this.state = 1604;
				this.statement();
				}
				}
				this.state = 1609;
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
			this.state = 1610;
			this.match(SolidCashParser.T__104);
			this.state = 1611;
			this.expression(0);
			this.state = 1613;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===70) {
				{
				this.state = 1612;
				this.tryReturns();
				}
			}

			this.state = 1615;
			localctx._tryBlock = this.block();
			this.state = 1617;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1616;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1619;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
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
			this.state = 1621;
			this.match(SolidCashParser.T__69);
			this.state = 1622;
			this.match(SolidCashParser.T__39);
			this.state = 1634;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
				{
				this.state = 1623;
				this.parameter();
				this.state = 1628;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 167, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1624;
						this.match(SolidCashParser.T__4);
						this.state = 1625;
						this.parameter();
						}
						}
					}
					this.state = 1630;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 167, this._ctx);
				}
				this.state = 1632;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1631;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1636;
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
		this.enterRule(localctx, 188, SolidCashParser.RULE_catchClause);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1638;
			this.match(SolidCashParser.T__105);
			this.state = 1640;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 170, this._ctx) ) {
			case 1:
				{
				this.state = 1639;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 1657;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 174, this._ctx) ) {
			case 1:
				{
				this.state = 1642;
				this.match(SolidCashParser.T__39);
				this.state = 1654;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
					{
					this.state = 1643;
					this.parameter();
					this.state = 1648;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 171, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1644;
							this.match(SolidCashParser.T__4);
							this.state = 1645;
							this.parameter();
							}
							}
						}
						this.state = 1650;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 171, this._ctx);
					}
					this.state = 1652;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1651;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1656;
				this.match(SolidCashParser.T__40);
				}
				break;
			}
			this.state = 1659;
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
			this.state = 1661;
			this.match(SolidCashParser.T__106);
			this.state = 1662;
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
			this.state = 1664;
			this.match(SolidCashParser.T__107);
			this.state = 1665;
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
			this.state = 1670;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 160:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1667;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 172:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1668;
				this.match(SolidCashParser.Identifier);
				this.state = 1669;
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
		this.enterRule(localctx, 196, SolidCashParser.RULE_revertStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1714;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 181, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1672;
				this.match(SolidCashParser.T__108);
				this.state = 1673;
				this.match(SolidCashParser.Identifier);
				this.state = 1676;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1674;
					this.match(SolidCashParser.T__11);
					this.state = 1675;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1678;
				this.match(SolidCashParser.T__39);
				this.state = 1679;
				this.match(SolidCashParser.T__3);
				this.state = 1691;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 1680;
					this.namedArg();
					this.state = 1685;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 177, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1681;
							this.match(SolidCashParser.T__4);
							this.state = 1682;
							this.namedArg();
							}
							}
						}
						this.state = 1687;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 177, this._ctx);
					}
					this.state = 1689;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1688;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1693;
				this.match(SolidCashParser.T__5);
				this.state = 1694;
				this.match(SolidCashParser.T__40);
				this.state = 1695;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1696;
				this.match(SolidCashParser.T__108);
				this.state = 1697;
				this.match(SolidCashParser.Identifier);
				this.state = 1700;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1698;
					this.match(SolidCashParser.T__11);
					this.state = 1699;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1702;
				this.expressionList();
				this.state = 1703;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1705;
				this.match(SolidCashParser.T__108);
				this.state = 1706;
				this.match(SolidCashParser.T__39);
				this.state = 1707;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1708;
				this.match(SolidCashParser.T__40);
				this.state = 1709;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1710;
				this.match(SolidCashParser.T__108);
				this.state = 1711;
				this.match(SolidCashParser.T__39);
				this.state = 1712;
				this.match(SolidCashParser.T__40);
				this.state = 1713;
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
			this.state = 1716;
			this.match(SolidCashParser.T__109);
			this.state = 1717;
			this.match(SolidCashParser.T__39);
			this.state = 1718;
			this.expression(0);
			this.state = 1719;
			this.match(SolidCashParser.T__40);
			this.state = 1720;
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
			this.state = 1724;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 172:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1722;
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
				this.state = 1723;
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
			this.state = 1726;
			this.match(SolidCashParser.T__39);
			this.state = 1738;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 152)) & ~0x1F) === 0 && ((1 << (_la - 152)) & 1836813) !== 0)) {
				{
				this.state = 1727;
				this.consoleParameter();
				this.state = 1732;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 183, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1728;
						this.match(SolidCashParser.T__4);
						this.state = 1729;
						this.consoleParameter();
						}
						}
					}
					this.state = 1734;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 183, this._ctx);
				}
				this.state = 1736;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1735;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1740;
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
		this.enterRule(localctx, 204, SolidCashParser.RULE_functionCall);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1766;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 189, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1742;
				this.match(SolidCashParser.Identifier);
				this.state = 1743;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1744;
				this.match(SolidCashParser.Identifier);
				this.state = 1745;
				this.match(SolidCashParser.T__11);
				this.state = 1746;
				this.match(SolidCashParser.Identifier);
				this.state = 1747;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1748;
				this.match(SolidCashParser.Identifier);
				this.state = 1749;
				this.match(SolidCashParser.T__39);
				this.state = 1750;
				this.match(SolidCashParser.T__3);
				this.state = 1762;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===172) {
					{
					this.state = 1751;
					this.namedArg();
					this.state = 1756;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 186, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1752;
							this.match(SolidCashParser.T__4);
							this.state = 1753;
							this.namedArg();
							}
							}
						}
						this.state = 1758;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 186, this._ctx);
					}
					this.state = 1760;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1759;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1764;
				this.match(SolidCashParser.T__5);
				this.state = 1765;
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
		this.enterRule(localctx, 206, SolidCashParser.RULE_namedArg);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1768;
			this.match(SolidCashParser.Identifier);
			this.state = 1769;
			this.match(SolidCashParser.T__102);
			this.state = 1770;
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
			this.state = 1772;
			this.match(SolidCashParser.T__39);
			this.state = 1784;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===14 || _la===27 || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 111)) & ~0x1F) === 0 && ((1 << (_la - 111)) & 33622015) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
				{
				this.state = 1773;
				this.expression(0);
				this.state = 1778;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 190, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1774;
						this.match(SolidCashParser.T__4);
						this.state = 1775;
						this.expression(0);
						}
						}
					}
					this.state = 1780;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 190, this._ctx);
				}
				this.state = 1782;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1781;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1786;
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
		this.enterRule(localctx, 210, SolidCashParser.RULE_callOptions);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1788;
			this.match(SolidCashParser.T__3);
			this.state = 1789;
			this.callOption();
			this.state = 1794;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 193, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1790;
					this.match(SolidCashParser.T__4);
					this.state = 1791;
					this.callOption();
					}
					}
				}
				this.state = 1796;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 193, this._ctx);
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

			this.state = 1800;
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
			this.state = 1802;
			this.match(SolidCashParser.Identifier);
			this.state = 1803;
			this.match(SolidCashParser.T__102);
			this.state = 1804;
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
			this.state = 1806;
			this.match(SolidCashParser.T__39);
			this.state = 1807;
			this.typeName();
			this.state = 1812;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 195, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1808;
					this.match(SolidCashParser.T__4);
					this.state = 1809;
					this.typeName();
					}
					}
				}
				this.state = 1814;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 195, this._ctx);
			}
			this.state = 1816;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1815;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1818;
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
		let _startState: number = 216;
		this.enterRecursionRule(localctx, 216, SolidCashParser.RULE_expression, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1949;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 203, this._ctx) ) {
			case 1:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 1821;
				this.match(SolidCashParser.T__39);
				this.state = 1822;
				this.expression(0);
				this.state = 1823;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 2:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1825;
				this.typeCast();
				this.state = 1826;
				this.match(SolidCashParser.T__39);
				this.state = 1827;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 1829;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1828;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1831;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 3:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1833;
				this.functionCall();
				}
				break;
			case 4:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1834;
				this.match(SolidCashParser.T__110);
				this.state = 1835;
				this.match(SolidCashParser.Identifier);
				this.state = 1837;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1836;
					this.callOptions();
					}
				}

				this.state = 1839;
				this.expressionList();
				}
				break;
			case 5:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1840;
				this.match(SolidCashParser.T__110);
				this.state = 1841;
				this.typeName();
				this.state = 1842;
				this.match(SolidCashParser.T__57);
				this.state = 1843;
				this.match(SolidCashParser.T__58);
				this.state = 1844;
				this.match(SolidCashParser.T__39);
				this.state = 1845;
				this.expression(0);
				this.state = 1846;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 6:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1848;
				this.match(SolidCashParser.T__46);
				this.state = 1849;
				this.match(SolidCashParser.T__39);
				this.state = 1850;
				this.typeName();
				this.state = 1851;
				this.match(SolidCashParser.T__40);
				this.state = 1852;
				this.match(SolidCashParser.T__11);
				this.state = 1853;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 7:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1855;
				this.match(SolidCashParser.T__111);
				this.state = 1856;
				this.expressionList();
				}
				break;
			case 8:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1857;
				this.match(SolidCashParser.T__112);
				this.state = 1858;
				this.expressionList();
				}
				break;
			case 9:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1859;
				this.match(SolidCashParser.T__113);
				this.state = 1860;
				this.expressionList();
				}
				break;
			case 10:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1861;
				this.match(SolidCashParser.T__114);
				this.state = 1862;
				this.expressionList();
				}
				break;
			case 11:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1863;
				this.match(SolidCashParser.T__115);
				this.state = 1864;
				this.match(SolidCashParser.T__39);
				this.state = 1865;
				this.match(SolidCashParser.Identifier);
				this.state = 1866;
				this.match(SolidCashParser.T__11);
				this.state = 1867;
				this.match(SolidCashParser.Identifier);
				this.state = 1868;
				this.match(SolidCashParser.T__4);
				this.state = 1869;
				this.expressionList();
				this.state = 1870;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 12:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1872;
				this.match(SolidCashParser.T__116);
				this.state = 1873;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1874;
				this.match(SolidCashParser.T__117);
				this.state = 1875;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1876;
				this.match(SolidCashParser.T__118);
				this.state = 1877;
				this.match(SolidCashParser.T__39);
				this.state = 1878;
				this.expression(0);
				this.state = 1879;
				this.match(SolidCashParser.T__4);
				this.state = 1880;
				this.typeList();
				this.state = 1881;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 15:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1883;
				this.match(SolidCashParser.T__119);
				this.state = 1884;
				this.match(SolidCashParser.T__39);
				this.state = 1885;
				this.expression(0);
				this.state = 1886;
				this.match(SolidCashParser.T__4);
				this.state = 1887;
				this.typeList();
				this.state = 1888;
				this.match(SolidCashParser.T__4);
				this.state = 1889;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1890;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 16:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1892;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__120);
				this.state = 1893;
				this.match(SolidCashParser.T__57);
				this.state = 1894;
				this.expression(0);
				this.state = 1895;
				this.match(SolidCashParser.T__58);
				this.state = 1896;
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
				this.state = 1898;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__126);
				this.state = 1899;
				this.match(SolidCashParser.T__57);
				this.state = 1900;
				this.expression(0);
				this.state = 1901;
				this.match(SolidCashParser.T__58);
				this.state = 1902;
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
				this.state = 1904;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===136)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1905;
				this.expression(21);
				}
				break;
			case 19:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1906;
				this.match(SolidCashParser.T__57);
				this.state = 1918;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===14 || _la===27 || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 2147750017) !== 0) || ((((_la - 111)) & ~0x1F) === 0 && ((1 << (_la - 111)) & 33622015) !== 0) || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 33519575) !== 0)) {
					{
					this.state = 1907;
					this.expression(0);
					this.state = 1912;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 199, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1908;
							this.match(SolidCashParser.T__4);
							this.state = 1909;
							this.expression(0);
							}
							}
						}
						this.state = 1914;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 199, this._ctx);
					}
					this.state = 1916;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1915;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1920;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 20:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1921;
				this.match(SolidCashParser.T__70);
				this.state = 1922;
				this.match(SolidCashParser.T__11);
				this.state = 1923;
				this.match(SolidCashParser.Identifier);
				this.state = 1924;
				this.match(SolidCashParser.T__11);
				this.state = 1925;
				this.match(SolidCashParser.Identifier);
				this.state = 1926;
				this.match(SolidCashParser.T__57);
				this.state = 1927;
				this.expression(0);
				this.state = 1928;
				this.match(SolidCashParser.T__58);
				this.state = 1929;
				this.memberName();
				}
				break;
			case 21:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1931;
				this.match(SolidCashParser.T__70);
				this.state = 1932;
				this.match(SolidCashParser.T__11);
				this.state = 1933;
				this.match(SolidCashParser.Identifier);
				this.state = 1938;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 1934;
						this.match(SolidCashParser.T__57);
						this.state = 1935;
						this.expression(0);
						this.state = 1936;
						this.match(SolidCashParser.T__58);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 1940;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 202, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 22:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1942;
				this.match(SolidCashParser.T__70);
				this.state = 1943;
				this.match(SolidCashParser.T__11);
				this.state = 1944;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 23:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1945;
				this.match(SolidCashParser.T__70);
				}
				break;
			case 24:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1946;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 25:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1947;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 26:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1948;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2056;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 210, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2054;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 209, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1951;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 1952;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 1953;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1954;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 1955;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1956;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1957;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 1958;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1959;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1960;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 1961;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===137 || _la===138)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1962;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1963;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 1964;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1965;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1966;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 1967;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1968;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1969;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 1970;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 1971;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1972;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 1973;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 1974;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1975;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 1976;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 1977;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1978;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 1979;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__138);
						this.state = 1980;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1981;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 1982;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__139);
						this.state = 1983;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1984;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 1985;
						this.match(SolidCashParser.T__140);
						this.state = 1986;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 1987;
						this.match(SolidCashParser.T__102);
						this.state = 1988;
						(localctx as TernaryOpContext)._ifFalse = this.expression(9);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1990;
						if (!(this.precpred(this._ctx, 32))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 32)");
						}
						this.state = 1991;
						this.match(SolidCashParser.T__57);
						this.state = 1992;
						(localctx as IndexRangeSliceContext)._start = this.expression(0);
						this.state = 1993;
						this.match(SolidCashParser.T__102);
						this.state = 1994;
						(localctx as IndexRangeSliceContext)._end = this.expression(0);
						this.state = 1995;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1997;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 1998;
						this.match(SolidCashParser.T__57);
						this.state = 1999;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2000;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2001;
						if (!(this.precpred(this._ctx, 30))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 30)");
						}
						this.state = 2002;
						this.match(SolidCashParser.T__57);
						this.state = 2003;
						this.expression(0);
						this.state = 2004;
						this.match(SolidCashParser.T__58);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2006;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2007;
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
						this.state = 2008;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2009;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__133);
						this.state = 2010;
						this.match(SolidCashParser.T__39);
						this.state = 2011;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2012;
						this.match(SolidCashParser.T__40);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2014;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2015;
						this.match(SolidCashParser.T__134);
						this.state = 2016;
						this.match(SolidCashParser.T__39);
						this.state = 2017;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2018;
						this.match(SolidCashParser.T__4);
						this.state = 2019;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2020;
						this.match(SolidCashParser.T__40);
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2022;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2023;
						this.match(SolidCashParser.T__11);
						this.state = 2024;
						this.match(SolidCashParser.Identifier);
						this.state = 2026;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2025;
							this.callOptions();
							}
						}

						this.state = 2028;
						this.match(SolidCashParser.T__39);
						this.state = 2029;
						this.match(SolidCashParser.T__3);
						this.state = 2041;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===172) {
							{
							this.state = 2030;
							this.namedArg();
							this.state = 2035;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 205, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2031;
									this.match(SolidCashParser.T__4);
									this.state = 2032;
									this.namedArg();
									}
									}
								}
								this.state = 2037;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 205, this._ctx);
							}
							this.state = 2039;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2038;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2043;
						this.match(SolidCashParser.T__5);
						this.state = 2044;
						this.match(SolidCashParser.T__40);
						}
						break;
					case 20:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2045;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2046;
						this.match(SolidCashParser.T__11);
						this.state = 2047;
						this.match(SolidCashParser.Identifier);
						this.state = 2049;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2048;
							this.callOptions();
							}
						}

						this.state = 2051;
						this.expressionList();
						}
						break;
					case 21:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2052;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 2053;
						this.memberName();
						}
						break;
					}
					}
				}
				this.state = 2058;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 210, this._ctx);
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
			this.state = 2072;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2059;
				this.match(SolidCashParser.T__11);
				this.state = 2060;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 122:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2061;
				this.match(SolidCashParser.T__121);
				}
				break;
			case 123:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2062;
				this.match(SolidCashParser.T__122);
				}
				break;
			case 124:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2063;
				this.match(SolidCashParser.T__123);
				}
				break;
			case 125:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2064;
				this.match(SolidCashParser.T__124);
				}
				break;
			case 126:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2065;
				this.match(SolidCashParser.T__125);
				}
				break;
			case 128:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2066;
				this.match(SolidCashParser.T__127);
				}
				break;
			case 129:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2067;
				this.match(SolidCashParser.T__128);
				}
				break;
			case 130:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2068;
				this.match(SolidCashParser.T__129);
				}
				break;
			case 131:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2069;
				this.match(SolidCashParser.T__130);
				}
				break;
			case 142:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2070;
				this.match(SolidCashParser.T__141);
				}
				break;
			case 143:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2071;
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
		this.enterRule(localctx, 220, SolidCashParser.RULE_modifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2074;
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
		this.enterRule(localctx, 222, SolidCashParser.RULE_literal);
		try {
			let _alt: number;
			this.state = 2090;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 152:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2076;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 155:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2077;
				this.numberLiteral();
				}
				break;
			case 154:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2078;
				this.decimalLiteral();
				}
				break;
			case 160:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2079;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2083;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 212, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2080;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2085;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 212, this._ctx);
				}
				}
				break;
			case 170:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2086;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 171:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2087;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2088;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2089;
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
			this.state = 2092;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2094;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 214, this._ctx) ) {
			case 1:
				{
				this.state = 2093;
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
			this.state = 2096;
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
		let _la: number;
		try {
			this.state = 2141;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 219, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2098;
				this.match(SolidCashParser.T__147);
				this.state = 2099;
				this.match(SolidCashParser.T__51);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2100;
				this.match(SolidCashParser.T__147);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2101;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2102;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2103;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2104;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2105;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2106;
				this.match(SolidCashParser.T__148);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2107;
				this.match(SolidCashParser.T__149);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2108;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2109;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2110;
				this.match(SolidCashParser.T__6);
				this.state = 2111;
				this.match(SolidCashParser.T__39);
				this.state = 2120;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 148)) & ~0x1F) === 0 && ((1 << (_la - 148)) & 18745095) !== 0)) {
					{
					this.state = 2112;
					this.typeName();
					this.state = 2117;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2113;
						this.match(SolidCashParser.T__4);
						this.state = 2114;
						this.typeName();
						}
						}
						this.state = 2119;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2122;
				this.match(SolidCashParser.T__40);
				this.state = 2135;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===70) {
					{
					this.state = 2123;
					this.match(SolidCashParser.T__69);
					this.state = 2124;
					this.match(SolidCashParser.T__39);
					this.state = 2125;
					this.typeName();
					this.state = 2130;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2126;
						this.match(SolidCashParser.T__4);
						this.state = 2127;
						this.typeName();
						}
						}
						this.state = 2132;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2133;
					this.match(SolidCashParser.T__40);
					}
				}

				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2137;
				this.match(SolidCashParser.Identifier);
				this.state = 2138;
				this.match(SolidCashParser.T__11);
				this.state = 2139;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2140;
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
			this.state = 2143;
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

	public static readonly _serializedATN: number[] = [4,1,175,2146,2,0,7,0,
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
	0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,5,0,254,8,0,10,0,12,0,257,9,0,1,0,
	1,0,3,0,261,8,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,5,1,278,8,1,10,1,12,1,281,9,1,1,1,3,1,284,8,1,1,1,1,1,1,1,1,1,1,1,3,
	1,291,8,1,1,2,1,2,1,2,3,2,296,8,2,1,3,1,3,1,3,1,3,5,3,302,8,3,10,3,12,3,
	305,9,3,1,3,3,3,308,8,3,1,3,1,3,5,3,312,8,3,10,3,12,3,315,9,3,1,3,1,3,1,
	4,1,4,1,4,1,4,1,4,3,4,324,8,4,1,4,3,4,327,8,4,1,4,1,4,1,4,1,4,1,4,1,4,5,
	4,335,8,4,10,4,12,4,338,9,4,1,4,3,4,341,8,4,1,4,1,4,1,4,1,4,3,4,347,8,4,
	1,4,3,4,350,8,4,1,4,1,4,3,4,354,8,4,1,5,1,5,1,5,3,5,359,8,5,1,5,1,5,3,5,
	363,8,5,1,6,1,6,1,7,1,7,1,7,1,7,1,7,1,8,1,8,1,9,1,9,3,9,376,8,9,1,10,3,
	10,379,8,10,1,10,1,10,1,11,1,11,1,12,1,12,1,12,1,12,1,12,1,12,5,12,391,
	8,12,10,12,12,12,394,9,12,3,12,396,8,12,1,12,1,12,5,12,400,8,12,10,12,12,
	12,403,9,12,1,12,5,12,406,8,12,10,12,12,12,409,9,12,1,12,5,12,412,8,12,
	10,12,12,12,415,9,12,1,12,5,12,418,8,12,10,12,12,12,421,9,12,1,12,5,12,
	424,8,12,10,12,12,12,427,9,12,1,12,5,12,430,8,12,10,12,12,12,433,9,12,1,
	12,5,12,436,8,12,10,12,12,12,439,9,12,1,12,1,12,1,13,1,13,1,13,1,13,1,13,
	1,13,1,13,1,13,1,13,1,13,3,13,453,8,13,1,14,1,14,1,14,1,14,1,14,1,15,1,
	15,1,16,1,16,1,16,1,16,5,16,466,8,16,10,16,12,16,469,9,16,1,16,3,16,472,
	8,16,1,16,1,16,1,17,1,17,1,17,1,17,5,17,480,8,17,10,17,12,17,483,9,17,1,
	17,5,17,486,8,17,10,17,12,17,489,9,17,1,17,5,17,492,8,17,10,17,12,17,495,
	9,17,1,17,5,17,498,8,17,10,17,12,17,501,9,17,1,17,5,17,504,8,17,10,17,12,
	17,507,9,17,1,17,5,17,510,8,17,10,17,12,17,513,9,17,1,17,5,17,516,8,17,
	10,17,12,17,519,9,17,1,17,5,17,522,8,17,10,17,12,17,525,9,17,1,17,1,17,
	1,18,3,18,530,8,18,1,18,1,18,1,18,3,18,535,8,18,1,18,1,18,1,18,1,18,5,18,
	541,8,18,10,18,12,18,544,9,18,3,18,546,8,18,1,18,1,18,1,18,1,18,1,18,1,
	18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,5,18,563,8,18,10,18,12,
	18,566,9,18,1,18,1,18,1,19,1,19,1,19,1,19,5,19,574,8,19,10,19,12,19,577,
	9,19,1,19,5,19,580,8,19,10,19,12,19,583,9,19,1,19,3,19,586,8,19,1,19,1,
	19,1,20,1,20,1,20,1,20,1,20,1,20,5,20,596,8,20,10,20,12,20,599,9,20,1,20,
	3,20,602,8,20,3,20,604,8,20,1,20,1,20,3,20,608,8,20,1,20,1,20,1,21,1,21,
	3,21,614,8,21,1,21,1,21,1,22,1,22,1,22,1,22,1,22,1,22,5,22,624,8,22,10,
	22,12,22,627,9,22,1,22,3,22,630,8,22,3,22,632,8,22,1,22,1,22,1,22,1,23,
	1,23,1,23,1,24,1,24,1,24,1,24,4,24,644,8,24,11,24,12,24,645,1,24,1,24,1,
	25,1,25,1,25,1,25,1,26,1,26,1,26,1,26,1,26,1,26,5,26,660,8,26,10,26,12,
	26,663,9,26,1,26,3,26,666,8,26,1,26,1,26,1,27,1,27,1,27,3,27,673,8,27,1,
	28,1,28,1,28,1,28,1,28,1,28,1,29,1,29,1,29,1,29,1,29,1,29,1,29,1,30,1,30,
	1,30,3,30,691,8,30,1,30,5,30,694,8,30,10,30,12,30,697,9,30,1,30,1,30,5,
	30,701,8,30,10,30,12,30,704,9,30,1,30,1,30,1,31,1,31,1,31,1,31,5,31,712,
	8,31,10,31,12,31,715,9,31,1,31,5,31,718,8,31,10,31,12,31,721,9,31,1,31,
	1,31,5,31,725,8,31,10,31,12,31,728,9,31,1,31,1,31,1,32,1,32,1,32,3,32,735,
	8,32,1,33,1,33,1,33,1,33,1,33,1,33,1,33,5,33,744,8,33,10,33,12,33,747,9,
	33,1,33,1,33,1,34,1,34,1,34,1,35,3,35,755,8,35,1,35,1,35,5,35,759,8,35,
	10,35,12,35,762,9,35,1,35,1,35,1,35,1,35,1,35,1,35,5,35,770,8,35,10,35,
	12,35,773,9,35,1,35,1,35,1,35,1,35,3,35,779,8,35,1,35,1,35,5,35,783,8,35,
	10,35,12,35,786,9,35,1,35,1,35,1,35,1,35,3,35,792,8,35,1,35,1,35,5,35,796,
	8,35,10,35,12,35,799,9,35,1,35,1,35,1,35,3,35,804,8,35,1,36,1,36,3,36,808,
	8,36,1,37,1,37,1,38,1,38,1,38,1,38,3,38,816,8,38,1,38,1,38,1,38,3,38,821,
	8,38,1,38,1,38,1,38,1,38,1,38,1,38,3,38,829,8,38,1,38,1,38,1,38,1,38,1,
	38,1,38,1,38,1,38,3,38,839,8,38,1,38,1,38,1,38,3,38,844,8,38,1,38,1,38,
	3,38,848,8,38,1,39,1,39,1,39,1,39,1,39,1,39,1,39,1,39,1,39,1,39,3,39,860,
	8,39,1,39,1,39,1,39,1,39,1,39,1,39,1,39,5,39,869,8,39,10,39,12,39,872,9,
	39,1,40,1,40,1,40,3,40,877,8,40,1,40,1,40,5,40,881,8,40,10,40,12,40,884,
	9,40,1,40,1,40,1,41,1,41,3,41,890,8,41,1,42,1,42,1,42,1,43,1,43,1,43,1,
	43,5,43,899,8,43,10,43,12,43,902,9,43,1,43,5,43,905,8,43,10,43,12,43,908,
	9,43,1,43,3,43,911,8,43,1,43,1,43,5,43,915,8,43,10,43,12,43,918,9,43,1,
	43,1,43,1,44,1,44,3,44,924,8,44,1,45,1,45,1,45,1,45,1,45,1,45,1,45,1,45,
	1,45,1,45,1,45,1,45,1,45,1,45,3,45,940,8,45,1,46,1,46,1,46,1,46,1,46,5,
	46,947,8,46,10,46,12,46,950,9,46,1,46,3,46,953,8,46,1,47,1,47,1,47,1,47,
	3,47,959,8,47,1,48,1,48,1,48,1,48,1,48,5,48,966,8,48,10,48,12,48,969,9,
	48,1,48,3,48,972,8,48,1,48,1,48,1,49,1,49,5,49,978,8,49,10,49,12,49,981,
	9,49,1,49,3,49,984,8,49,1,50,1,50,1,50,1,50,5,50,990,8,50,10,50,12,50,993,
	9,50,1,50,3,50,996,8,50,3,50,998,8,50,1,50,1,50,1,51,1,51,5,51,1004,8,51,
	10,51,12,51,1007,9,51,1,51,1,51,1,51,1,51,5,51,1013,8,51,10,51,12,51,1016,
	9,51,1,51,1,51,3,51,1020,8,51,1,52,1,52,5,52,1024,8,52,10,52,12,52,1027,
	9,52,1,52,1,52,3,52,1031,8,52,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,
	53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,
	1,53,1,53,1,53,1,53,1,53,1,53,1,53,3,53,1063,8,53,1,54,1,54,1,54,1,54,1,
	54,1,54,1,54,1,54,1,54,1,54,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,
	1,55,1,55,1,55,5,55,1087,8,55,10,55,12,55,1090,9,55,1,55,1,55,1,55,1,56,
	1,56,1,56,1,56,1,56,1,56,5,56,1101,8,56,10,56,12,56,1104,9,56,1,56,1,56,
	1,56,1,56,1,56,1,56,1,56,5,56,1113,8,56,10,56,12,56,1116,9,56,1,56,3,56,
	1119,8,56,1,56,1,56,1,56,3,56,1124,8,56,1,57,1,57,1,57,3,57,1129,8,57,1,
	57,1,57,1,57,1,57,1,57,5,57,1136,8,57,10,57,12,57,1139,9,57,1,57,3,57,1142,
	8,57,3,57,1144,8,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,
	57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,3,57,1166,8,57,1,57,1,57,
	1,57,3,57,1171,8,57,1,58,1,58,1,58,1,58,3,58,1177,8,58,1,58,1,58,1,58,1,
	59,1,59,1,59,1,59,3,59,1186,8,59,1,59,1,59,1,59,1,59,1,59,5,59,1193,8,59,
	10,59,12,59,1196,9,59,1,59,3,59,1199,8,59,3,59,1201,8,59,1,59,1,59,1,59,
	1,59,1,59,1,59,1,59,3,59,1210,8,59,1,59,1,59,1,59,3,59,1215,8,59,1,60,1,
	60,1,60,1,60,1,60,1,60,1,60,4,60,1224,8,60,11,60,12,60,1225,1,60,1,60,3,
	60,1230,8,60,3,60,1232,8,60,1,60,1,60,1,60,1,60,1,60,1,60,1,60,1,60,1,60,
	4,60,1243,8,60,11,60,12,60,1244,1,60,1,60,3,60,1249,8,60,1,60,1,60,1,60,
	1,60,3,60,1255,8,60,1,61,1,61,1,61,1,61,1,61,1,61,1,61,5,61,1264,8,61,10,
	61,12,61,1267,9,61,1,61,1,61,1,61,1,61,1,61,1,61,1,62,1,62,5,62,1277,8,
	62,10,62,12,62,1280,9,62,1,62,1,62,1,62,3,62,1285,8,62,1,62,1,62,1,62,1,
	62,5,62,1291,8,62,10,62,12,62,1294,9,62,1,62,1,62,1,62,1,62,1,62,3,62,1301,
	8,62,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1309,8,63,11,63,12,63,1310,1,63,
	1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1321,8,63,11,63,12,63,1322,1,63,
	1,63,1,63,1,63,1,63,1,63,4,63,1331,8,63,11,63,12,63,1332,1,63,1,63,1,63,
	1,63,1,63,1,63,1,63,4,63,1342,8,63,11,63,12,63,1343,1,63,1,63,1,63,1,63,
	1,63,3,63,1351,8,63,1,64,1,64,1,64,1,64,1,64,3,64,1358,8,64,1,65,1,65,1,
	65,1,65,1,65,1,65,1,65,1,65,3,65,1368,8,65,1,66,1,66,1,66,1,66,1,66,1,66,
	1,66,1,67,1,67,1,67,1,67,1,67,1,67,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,
	69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,70,1,70,1,70,1,70,1,70,1,70,
	1,70,1,70,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,
	71,1,71,1,71,1,71,4,71,1423,8,71,11,71,12,71,1424,1,71,1,71,3,71,1429,8,
	71,1,72,1,72,1,72,1,72,1,72,1,72,1,72,3,72,1438,8,72,1,72,1,72,1,72,1,73,
	1,73,1,73,1,73,1,73,3,73,1448,8,73,1,73,1,73,1,73,1,74,1,74,1,74,1,74,1,
	74,1,74,1,74,3,74,1460,8,74,1,75,1,75,1,75,1,75,1,75,1,75,3,75,1468,8,75,
	1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,
	76,1,76,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,78,1,78,
	1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,79,1,79,1,79,1,79,1,79,1,
	79,1,79,1,79,1,80,1,80,5,80,1518,8,80,10,80,12,80,1521,9,80,1,80,1,80,1,
	80,1,80,1,80,1,81,1,81,1,81,1,82,1,82,1,82,1,82,1,82,3,82,1536,8,82,1,83,
	1,83,1,83,1,83,1,83,1,83,1,83,1,83,1,84,1,84,1,84,1,84,1,84,1,84,1,85,1,
	85,1,85,1,85,1,86,1,86,1,86,5,86,1559,8,86,10,86,12,86,1562,9,86,1,86,1,
	86,1,87,1,87,1,88,1,88,1,88,5,88,1571,8,88,10,88,12,88,1574,9,88,1,88,1,
	88,1,89,1,89,1,89,1,89,1,89,1,89,5,89,1584,8,89,10,89,12,89,1587,9,89,1,
	89,3,89,1590,8,89,1,89,1,89,1,90,1,90,1,90,1,90,5,90,1598,8,90,10,90,12,
	90,1601,9,90,1,91,1,91,1,91,5,91,1606,8,91,10,91,12,91,1609,9,91,1,92,1,
	92,1,92,3,92,1614,8,92,1,92,1,92,4,92,1618,8,92,11,92,12,92,1619,1,93,1,
	93,1,93,1,93,1,93,5,93,1627,8,93,10,93,12,93,1630,9,93,1,93,3,93,1633,8,
	93,3,93,1635,8,93,1,93,1,93,1,94,1,94,3,94,1641,8,94,1,94,1,94,1,94,1,94,
	5,94,1647,8,94,10,94,12,94,1650,9,94,1,94,3,94,1653,8,94,3,94,1655,8,94,
	1,94,3,94,1658,8,94,1,94,1,94,1,95,1,95,1,95,1,96,1,96,1,96,1,97,1,97,1,
	97,3,97,1671,8,97,1,98,1,98,1,98,1,98,3,98,1677,8,98,1,98,1,98,1,98,1,98,
	1,98,5,98,1684,8,98,10,98,12,98,1687,9,98,1,98,3,98,1690,8,98,3,98,1692,
	8,98,1,98,1,98,1,98,1,98,1,98,1,98,1,98,3,98,1701,8,98,1,98,1,98,1,98,1,
	98,1,98,1,98,1,98,1,98,1,98,1,98,1,98,1,98,3,98,1715,8,98,1,99,1,99,1,99,
	1,99,1,99,1,99,1,100,1,100,3,100,1725,8,100,1,101,1,101,1,101,1,101,5,101,
	1731,8,101,10,101,12,101,1734,9,101,1,101,3,101,1737,8,101,3,101,1739,8,
	101,1,101,1,101,1,102,1,102,1,102,1,102,1,102,1,102,1,102,1,102,1,102,1,
	102,1,102,1,102,5,102,1755,8,102,10,102,12,102,1758,9,102,1,102,3,102,1761,
	8,102,3,102,1763,8,102,1,102,1,102,3,102,1767,8,102,1,103,1,103,1,103,1,
	103,1,104,1,104,1,104,1,104,5,104,1777,8,104,10,104,12,104,1780,9,104,1,
	104,3,104,1783,8,104,3,104,1785,8,104,1,104,1,104,1,105,1,105,1,105,1,105,
	5,105,1793,8,105,10,105,12,105,1796,9,105,1,105,3,105,1799,8,105,1,105,
	1,105,1,106,1,106,1,106,1,106,1,107,1,107,1,107,1,107,5,107,1811,8,107,
	10,107,12,107,1814,9,107,1,107,3,107,1817,8,107,1,107,1,107,1,108,1,108,
	1,108,1,108,1,108,1,108,1,108,1,108,1,108,3,108,1830,8,108,1,108,1,108,
	1,108,1,108,1,108,1,108,3,108,1838,8,108,1,108,1,108,1,108,1,108,1,108,
	1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,
	1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,
	1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,
	1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,
	1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,
	1,108,1,108,1,108,1,108,1,108,1,108,5,108,1911,8,108,10,108,12,108,1914,
	9,108,1,108,3,108,1917,8,108,3,108,1919,8,108,1,108,1,108,1,108,1,108,1,
	108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,
	108,1,108,4,108,1939,8,108,11,108,12,108,1940,1,108,1,108,1,108,1,108,1,
	108,1,108,1,108,3,108,1950,8,108,1,108,1,108,1,108,1,108,1,108,1,108,1,
	108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,
	108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,
	108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,
	108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,
	108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,
	108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,3,108,2027,8,108,1,
	108,1,108,1,108,1,108,1,108,5,108,2034,8,108,10,108,12,108,2037,9,108,1,
	108,3,108,2040,8,108,3,108,2042,8,108,1,108,1,108,1,108,1,108,1,108,1,108,
	3,108,2050,8,108,1,108,1,108,1,108,5,108,2055,8,108,10,108,12,108,2058,
	9,108,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,3,109,2073,8,109,1,110,1,110,1,111,1,111,1,111,1,111,1,111,
	5,111,2082,8,111,10,111,12,111,2085,9,111,1,111,1,111,1,111,1,111,3,111,
	2091,8,111,1,112,1,112,3,112,2095,8,112,1,113,1,113,1,114,1,114,1,114,1,
	114,1,114,1,114,1,114,1,114,1,114,1,114,1,114,1,114,1,114,1,114,1,114,1,
	114,1,114,5,114,2116,8,114,10,114,12,114,2119,9,114,3,114,2121,8,114,1,
	114,1,114,1,114,1,114,1,114,1,114,5,114,2129,8,114,10,114,12,114,2132,9,
	114,1,114,1,114,3,114,2136,8,114,1,114,1,114,1,114,1,114,3,114,2142,8,114,
	1,115,1,115,1,115,0,2,78,216,116,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,
	30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,
	78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,110,112,114,116,118,
	120,122,124,126,128,130,132,134,136,138,140,142,144,146,148,150,152,154,
	156,158,160,162,164,166,168,170,172,174,176,178,180,182,184,186,188,190,
	192,194,196,198,200,202,204,206,208,210,212,214,216,218,220,222,224,226,
	228,230,0,20,2,0,10,10,13,27,1,0,29,30,3,0,20,23,26,27,31,31,1,0,34,35,
	2,0,34,35,50,50,3,0,34,35,50,50,55,55,2,0,31,31,74,83,1,0,85,86,3,0,155,
	155,162,162,172,172,1,0,122,126,2,0,122,126,128,131,3,0,14,14,27,27,136,
	136,2,0,10,10,15,16,1,0,13,14,1,0,137,138,1,0,20,23,1,0,18,19,1,0,132,133,
	2,0,48,48,144,147,4,0,52,52,148,150,156,158,164,168,2398,0,235,1,0,0,0,
	2,290,1,0,0,0,4,292,1,0,0,0,6,297,1,0,0,0,8,353,1,0,0,0,10,355,1,0,0,0,
	12,364,1,0,0,0,14,366,1,0,0,0,16,371,1,0,0,0,18,373,1,0,0,0,20,378,1,0,
	0,0,22,382,1,0,0,0,24,384,1,0,0,0,26,452,1,0,0,0,28,454,1,0,0,0,30,459,
	1,0,0,0,32,461,1,0,0,0,34,475,1,0,0,0,36,529,1,0,0,0,38,569,1,0,0,0,40,
	589,1,0,0,0,42,611,1,0,0,0,44,617,1,0,0,0,46,636,1,0,0,0,48,639,1,0,0,0,
	50,649,1,0,0,0,52,653,1,0,0,0,54,669,1,0,0,0,56,674,1,0,0,0,58,680,1,0,
	0,0,60,687,1,0,0,0,62,707,1,0,0,0,64,734,1,0,0,0,66,736,1,0,0,0,68,750,
	1,0,0,0,70,803,1,0,0,0,72,807,1,0,0,0,74,809,1,0,0,0,76,847,1,0,0,0,78,
	859,1,0,0,0,80,873,1,0,0,0,82,889,1,0,0,0,84,891,1,0,0,0,86,894,1,0,0,0,
	88,921,1,0,0,0,90,939,1,0,0,0,92,941,1,0,0,0,94,954,1,0,0,0,96,960,1,0,
	0,0,98,975,1,0,0,0,100,985,1,0,0,0,102,1019,1,0,0,0,104,1030,1,0,0,0,106,
	1062,1,0,0,0,108,1064,1,0,0,0,110,1074,1,0,0,0,112,1123,1,0,0,0,114,1170,
	1,0,0,0,116,1172,1,0,0,0,118,1214,1,0,0,0,120,1254,1,0,0,0,122,1256,1,0,
	0,0,124,1300,1,0,0,0,126,1350,1,0,0,0,128,1357,1,0,0,0,130,1367,1,0,0,0,
	132,1369,1,0,0,0,134,1376,1,0,0,0,136,1382,1,0,0,0,138,1389,1,0,0,0,140,
	1398,1,0,0,0,142,1428,1,0,0,0,144,1430,1,0,0,0,146,1442,1,0,0,0,148,1452,
	1,0,0,0,150,1467,1,0,0,0,152,1469,1,0,0,0,154,1485,1,0,0,0,156,1496,1,0,
	0,0,158,1507,1,0,0,0,160,1515,1,0,0,0,162,1527,1,0,0,0,164,1535,1,0,0,0,
	166,1537,1,0,0,0,168,1545,1,0,0,0,170,1551,1,0,0,0,172,1555,1,0,0,0,174,
	1565,1,0,0,0,176,1567,1,0,0,0,178,1577,1,0,0,0,180,1593,1,0,0,0,182,1602,
	1,0,0,0,184,1610,1,0,0,0,186,1621,1,0,0,0,188,1638,1,0,0,0,190,1661,1,0,
	0,0,192,1664,1,0,0,0,194,1670,1,0,0,0,196,1714,1,0,0,0,198,1716,1,0,0,0,
	200,1724,1,0,0,0,202,1726,1,0,0,0,204,1766,1,0,0,0,206,1768,1,0,0,0,208,
	1772,1,0,0,0,210,1788,1,0,0,0,212,1802,1,0,0,0,214,1806,1,0,0,0,216,1949,
	1,0,0,0,218,2072,1,0,0,0,220,2074,1,0,0,0,222,2090,1,0,0,0,224,2092,1,0,
	0,0,226,2096,1,0,0,0,228,2141,1,0,0,0,230,2143,1,0,0,0,232,234,3,14,7,0,
	233,232,1,0,0,0,234,237,1,0,0,0,235,233,1,0,0,0,235,236,1,0,0,0,236,241,
	1,0,0,0,237,235,1,0,0,0,238,240,3,2,1,0,239,238,1,0,0,0,240,243,1,0,0,0,
	241,239,1,0,0,0,241,242,1,0,0,0,242,255,1,0,0,0,243,241,1,0,0,0,244,254,
	3,58,29,0,245,254,3,52,26,0,246,254,3,48,24,0,247,254,3,56,28,0,248,254,
	3,8,4,0,249,254,3,44,22,0,250,254,3,24,12,0,251,254,3,6,3,0,252,254,3,34,
	17,0,253,244,1,0,0,0,253,245,1,0,0,0,253,246,1,0,0,0,253,247,1,0,0,0,253,
	248,1,0,0,0,253,249,1,0,0,0,253,250,1,0,0,0,253,251,1,0,0,0,253,252,1,0,
	0,0,254,257,1,0,0,0,255,253,1,0,0,0,255,256,1,0,0,0,256,260,1,0,0,0,257,
	255,1,0,0,0,258,261,3,36,18,0,259,261,3,34,17,0,260,258,1,0,0,0,260,259,
	1,0,0,0,260,261,1,0,0,0,261,262,1,0,0,0,262,263,5,0,0,1,263,1,1,0,0,0,264,
	265,5,1,0,0,265,266,5,160,0,0,266,291,5,2,0,0,267,268,5,1,0,0,268,269,5,
	160,0,0,269,270,5,3,0,0,270,271,5,172,0,0,271,291,5,2,0,0,272,273,5,1,0,
	0,273,274,5,4,0,0,274,279,3,4,2,0,275,276,5,5,0,0,276,278,3,4,2,0,277,275,
	1,0,0,0,278,281,1,0,0,0,279,277,1,0,0,0,279,280,1,0,0,0,280,283,1,0,0,0,
	281,279,1,0,0,0,282,284,5,5,0,0,283,282,1,0,0,0,283,284,1,0,0,0,284,285,
	1,0,0,0,285,286,5,6,0,0,286,287,5,172,0,0,287,288,5,160,0,0,288,289,5,2,
	0,0,289,291,1,0,0,0,290,264,1,0,0,0,290,267,1,0,0,0,290,272,1,0,0,0,291,
	3,1,0,0,0,292,295,5,172,0,0,293,294,5,3,0,0,294,296,5,172,0,0,295,293,1,
	0,0,0,295,296,1,0,0,0,296,5,1,0,0,0,297,298,5,7,0,0,298,299,5,172,0,0,299,
	303,3,100,50,0,300,302,3,90,45,0,301,300,1,0,0,0,302,305,1,0,0,0,303,301,
	1,0,0,0,303,304,1,0,0,0,304,307,1,0,0,0,305,303,1,0,0,0,306,308,3,96,48,
	0,307,306,1,0,0,0,307,308,1,0,0,0,308,309,1,0,0,0,309,313,5,4,0,0,310,312,
	3,106,53,0,311,310,1,0,0,0,312,315,1,0,0,0,313,311,1,0,0,0,313,314,1,0,
	0,0,314,316,1,0,0,0,315,313,1,0,0,0,316,317,5,6,0,0,317,7,1,0,0,0,318,319,
	5,8,0,0,319,320,5,172,0,0,320,323,5,9,0,0,321,324,3,228,114,0,322,324,5,
	10,0,0,323,321,1,0,0,0,323,322,1,0,0,0,324,326,1,0,0,0,325,327,5,11,0,0,
	326,325,1,0,0,0,326,327,1,0,0,0,327,328,1,0,0,0,328,354,5,2,0,0,329,330,
	5,8,0,0,330,331,5,4,0,0,331,336,3,10,5,0,332,333,5,5,0,0,333,335,3,10,5,
	0,334,332,1,0,0,0,335,338,1,0,0,0,336,334,1,0,0,0,336,337,1,0,0,0,337,340,
	1,0,0,0,338,336,1,0,0,0,339,341,5,5,0,0,340,339,1,0,0,0,340,341,1,0,0,0,
	341,342,1,0,0,0,342,343,5,6,0,0,343,346,5,9,0,0,344,347,3,228,114,0,345,
	347,5,10,0,0,346,344,1,0,0,0,346,345,1,0,0,0,347,349,1,0,0,0,348,350,5,
	11,0,0,349,348,1,0,0,0,349,350,1,0,0,0,350,351,1,0,0,0,351,352,5,2,0,0,
	352,354,1,0,0,0,353,318,1,0,0,0,353,329,1,0,0,0,354,9,1,0,0,0,355,358,5,
	172,0,0,356,357,5,12,0,0,357,359,5,172,0,0,358,356,1,0,0,0,358,359,1,0,
	0,0,359,362,1,0,0,0,360,361,5,3,0,0,361,363,3,12,6,0,362,360,1,0,0,0,362,
	363,1,0,0,0,363,11,1,0,0,0,364,365,7,0,0,0,365,13,1,0,0,0,366,367,5,28,
	0,0,367,368,3,16,8,0,368,369,3,18,9,0,369,370,5,2,0,0,370,15,1,0,0,0,371,
	372,7,1,0,0,372,17,1,0,0,0,373,375,3,20,10,0,374,376,3,20,10,0,375,374,
	1,0,0,0,375,376,1,0,0,0,376,19,1,0,0,0,377,379,3,22,11,0,378,377,1,0,0,
	0,378,379,1,0,0,0,379,380,1,0,0,0,380,381,5,151,0,0,381,21,1,0,0,0,382,
	383,7,2,0,0,383,23,1,0,0,0,384,385,5,32,0,0,385,395,5,172,0,0,386,387,5,
	33,0,0,387,392,5,172,0,0,388,389,5,5,0,0,389,391,5,172,0,0,390,388,1,0,
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
	444,445,5,172,0,0,445,446,5,2,0,0,446,453,1,0,0,0,447,448,3,30,15,0,448,
	449,3,78,39,0,449,450,5,172,0,0,450,451,5,2,0,0,451,453,1,0,0,0,452,442,
	1,0,0,0,452,447,1,0,0,0,453,27,1,0,0,0,454,455,3,30,15,0,455,456,3,228,
	114,0,456,457,5,172,0,0,457,458,5,2,0,0,458,29,1,0,0,0,459,460,7,3,0,0,
	460,31,1,0,0,0,461,462,5,7,0,0,462,463,5,172,0,0,463,467,3,100,50,0,464,
	466,3,90,45,0,465,464,1,0,0,0,466,469,1,0,0,0,467,465,1,0,0,0,467,468,1,
	0,0,0,468,471,1,0,0,0,469,467,1,0,0,0,470,472,3,96,48,0,471,470,1,0,0,0,
	471,472,1,0,0,0,472,473,1,0,0,0,473,474,5,2,0,0,474,33,1,0,0,0,475,476,
	5,36,0,0,476,477,5,172,0,0,477,481,5,4,0,0,478,480,3,52,26,0,479,478,1,
	0,0,0,480,483,1,0,0,0,481,479,1,0,0,0,481,482,1,0,0,0,482,487,1,0,0,0,483,
	481,1,0,0,0,484,486,3,48,24,0,485,484,1,0,0,0,486,489,1,0,0,0,487,485,1,
	0,0,0,487,488,1,0,0,0,488,493,1,0,0,0,489,487,1,0,0,0,490,492,3,56,28,0,
	491,490,1,0,0,0,492,495,1,0,0,0,493,491,1,0,0,0,493,494,1,0,0,0,494,499,
	1,0,0,0,495,493,1,0,0,0,496,498,3,40,20,0,497,496,1,0,0,0,498,501,1,0,0,
	0,499,497,1,0,0,0,499,500,1,0,0,0,500,505,1,0,0,0,501,499,1,0,0,0,502,504,
	3,44,22,0,503,502,1,0,0,0,504,507,1,0,0,0,505,503,1,0,0,0,505,506,1,0,0,
	0,506,511,1,0,0,0,507,505,1,0,0,0,508,510,3,58,29,0,509,508,1,0,0,0,510,
	513,1,0,0,0,511,509,1,0,0,0,511,512,1,0,0,0,512,517,1,0,0,0,513,511,1,0,
	0,0,514,516,3,8,4,0,515,514,1,0,0,0,516,519,1,0,0,0,517,515,1,0,0,0,517,
	518,1,0,0,0,518,523,1,0,0,0,519,517,1,0,0,0,520,522,3,6,3,0,521,520,1,0,
	0,0,522,525,1,0,0,0,523,521,1,0,0,0,523,524,1,0,0,0,524,526,1,0,0,0,525,
	523,1,0,0,0,526,527,5,6,0,0,527,35,1,0,0,0,528,530,5,37,0,0,529,528,1,0,
	0,0,529,530,1,0,0,0,530,531,1,0,0,0,531,532,5,38,0,0,532,534,5,172,0,0,
	533,535,3,100,50,0,534,533,1,0,0,0,534,535,1,0,0,0,535,545,1,0,0,0,536,
	537,5,33,0,0,537,542,5,172,0,0,538,539,5,5,0,0,539,541,5,172,0,0,540,538,
	1,0,0,0,541,544,1,0,0,0,542,540,1,0,0,0,542,543,1,0,0,0,543,546,1,0,0,0,
	544,542,1,0,0,0,545,536,1,0,0,0,545,546,1,0,0,0,546,547,1,0,0,0,547,564,
	5,4,0,0,548,563,3,52,26,0,549,563,3,48,24,0,550,563,3,56,28,0,551,563,3,
	40,20,0,552,563,3,44,22,0,553,563,3,58,29,0,554,563,3,8,4,0,555,563,3,70,
	35,0,556,563,3,80,40,0,557,563,3,60,30,0,558,563,3,86,43,0,559,563,3,38,
	19,0,560,563,3,62,31,0,561,563,3,66,33,0,562,548,1,0,0,0,562,549,1,0,0,
	0,562,550,1,0,0,0,562,551,1,0,0,0,562,552,1,0,0,0,562,553,1,0,0,0,562,554,
	1,0,0,0,562,555,1,0,0,0,562,556,1,0,0,0,562,557,1,0,0,0,562,558,1,0,0,0,
	562,559,1,0,0,0,562,560,1,0,0,0,562,561,1,0,0,0,563,566,1,0,0,0,564,562,
	1,0,0,0,564,565,1,0,0,0,565,567,1,0,0,0,566,564,1,0,0,0,567,568,5,6,0,0,
	568,37,1,0,0,0,569,570,5,7,0,0,570,571,5,172,0,0,571,575,3,100,50,0,572,
	574,3,90,45,0,573,572,1,0,0,0,574,577,1,0,0,0,575,573,1,0,0,0,575,576,1,
	0,0,0,576,581,1,0,0,0,577,575,1,0,0,0,578,580,3,88,44,0,579,578,1,0,0,0,
	580,583,1,0,0,0,581,579,1,0,0,0,581,582,1,0,0,0,582,585,1,0,0,0,583,581,
	1,0,0,0,584,586,3,96,48,0,585,584,1,0,0,0,585,586,1,0,0,0,586,587,1,0,0,
	0,587,588,5,2,0,0,588,39,1,0,0,0,589,590,5,39,0,0,590,591,5,172,0,0,591,
	603,5,40,0,0,592,597,3,42,21,0,593,594,5,5,0,0,594,596,3,42,21,0,595,593,
	1,0,0,0,596,599,1,0,0,0,597,595,1,0,0,0,597,598,1,0,0,0,598,601,1,0,0,0,
	599,597,1,0,0,0,600,602,5,5,0,0,601,600,1,0,0,0,601,602,1,0,0,0,602,604,
	1,0,0,0,603,592,1,0,0,0,603,604,1,0,0,0,604,605,1,0,0,0,605,607,5,41,0,
	0,606,608,5,42,0,0,607,606,1,0,0,0,607,608,1,0,0,0,608,609,1,0,0,0,609,
	610,5,2,0,0,610,41,1,0,0,0,611,613,3,228,114,0,612,614,5,43,0,0,613,612,
	1,0,0,0,613,614,1,0,0,0,614,615,1,0,0,0,615,616,5,172,0,0,616,43,1,0,0,
	0,617,618,5,44,0,0,618,619,5,172,0,0,619,631,5,40,0,0,620,625,3,46,23,0,
	621,622,5,5,0,0,622,624,3,46,23,0,623,621,1,0,0,0,624,627,1,0,0,0,625,623,
	1,0,0,0,625,626,1,0,0,0,626,629,1,0,0,0,627,625,1,0,0,0,628,630,5,5,0,0,
	629,628,1,0,0,0,629,630,1,0,0,0,630,632,1,0,0,0,631,620,1,0,0,0,631,632,
	1,0,0,0,632,633,1,0,0,0,633,634,5,41,0,0,634,635,5,2,0,0,635,45,1,0,0,0,
	636,637,3,228,114,0,637,638,5,172,0,0,638,47,1,0,0,0,639,640,5,45,0,0,640,
	641,5,172,0,0,641,643,5,4,0,0,642,644,3,50,25,0,643,642,1,0,0,0,644,645,
	1,0,0,0,645,643,1,0,0,0,645,646,1,0,0,0,646,647,1,0,0,0,647,648,5,6,0,0,
	648,49,1,0,0,0,649,650,3,228,114,0,650,651,5,172,0,0,651,652,5,2,0,0,652,
	51,1,0,0,0,653,654,5,46,0,0,654,655,5,172,0,0,655,656,5,4,0,0,656,661,3,
	54,27,0,657,658,5,5,0,0,658,660,3,54,27,0,659,657,1,0,0,0,660,663,1,0,0,
	0,661,659,1,0,0,0,661,662,1,0,0,0,662,665,1,0,0,0,663,661,1,0,0,0,664,666,
	5,5,0,0,665,664,1,0,0,0,665,666,1,0,0,0,666,667,1,0,0,0,667,668,5,6,0,0,
	668,53,1,0,0,0,669,672,5,172,0,0,670,671,5,31,0,0,671,673,5,155,0,0,672,
	670,1,0,0,0,672,673,1,0,0,0,673,55,1,0,0,0,674,675,5,47,0,0,675,676,5,172,
	0,0,676,677,5,33,0,0,677,678,3,228,114,0,678,679,5,2,0,0,679,57,1,0,0,0,
	680,681,3,228,114,0,681,682,5,48,0,0,682,683,5,172,0,0,683,684,5,31,0,0,
	684,685,3,216,108,0,685,686,5,2,0,0,686,59,1,0,0,0,687,688,5,49,0,0,688,
	690,3,100,50,0,689,691,7,4,0,0,690,689,1,0,0,0,690,691,1,0,0,0,691,695,
	1,0,0,0,692,694,3,68,34,0,693,692,1,0,0,0,694,697,1,0,0,0,695,693,1,0,0,
	0,695,696,1,0,0,0,696,698,1,0,0,0,697,695,1,0,0,0,698,702,5,4,0,0,699,701,
	3,106,53,0,700,699,1,0,0,0,701,704,1,0,0,0,702,700,1,0,0,0,702,703,1,0,
	0,0,703,705,1,0,0,0,704,702,1,0,0,0,705,706,5,6,0,0,706,61,1,0,0,0,707,
	708,5,51,0,0,708,709,3,100,50,0,709,713,5,35,0,0,710,712,3,64,32,0,711,
	710,1,0,0,0,712,715,1,0,0,0,713,711,1,0,0,0,713,714,1,0,0,0,714,719,1,0,
	0,0,715,713,1,0,0,0,716,718,3,88,44,0,717,716,1,0,0,0,718,721,1,0,0,0,719,
	717,1,0,0,0,719,720,1,0,0,0,720,722,1,0,0,0,721,719,1,0,0,0,722,726,5,4,
	0,0,723,725,3,106,53,0,724,723,1,0,0,0,725,728,1,0,0,0,726,724,1,0,0,0,
	726,727,1,0,0,0,727,729,1,0,0,0,728,726,1,0,0,0,729,730,5,6,0,0,730,63,
	1,0,0,0,731,735,5,52,0,0,732,735,5,53,0,0,733,735,3,92,46,0,734,731,1,0,
	0,0,734,732,1,0,0,0,734,733,1,0,0,0,735,65,1,0,0,0,736,737,5,54,0,0,737,
	738,5,40,0,0,738,739,5,41,0,0,739,740,5,35,0,0,740,741,5,52,0,0,741,745,
	5,4,0,0,742,744,3,106,53,0,743,742,1,0,0,0,744,747,1,0,0,0,745,743,1,0,
	0,0,745,746,1,0,0,0,746,748,1,0,0,0,747,745,1,0,0,0,748,749,5,6,0,0,749,
	67,1,0,0,0,750,751,5,172,0,0,751,752,3,208,104,0,752,69,1,0,0,0,753,755,
	3,74,37,0,754,753,1,0,0,0,754,755,1,0,0,0,755,756,1,0,0,0,756,760,3,228,
	114,0,757,759,3,220,110,0,758,757,1,0,0,0,759,762,1,0,0,0,760,758,1,0,0,
	0,760,761,1,0,0,0,761,763,1,0,0,0,762,760,1,0,0,0,763,764,5,172,0,0,764,
	765,5,2,0,0,765,804,1,0,0,0,766,767,3,228,114,0,767,771,3,74,37,0,768,770,
	3,220,110,0,769,768,1,0,0,0,770,773,1,0,0,0,771,769,1,0,0,0,771,772,1,0,
	0,0,772,774,1,0,0,0,773,771,1,0,0,0,774,775,5,172,0,0,775,776,5,2,0,0,776,
	804,1,0,0,0,777,779,3,74,37,0,778,777,1,0,0,0,778,779,1,0,0,0,779,780,1,
	0,0,0,780,784,3,76,38,0,781,783,3,72,36,0,782,781,1,0,0,0,783,786,1,0,0,
	0,784,782,1,0,0,0,784,785,1,0,0,0,785,787,1,0,0,0,786,784,1,0,0,0,787,788,
	5,172,0,0,788,789,5,2,0,0,789,804,1,0,0,0,790,792,3,74,37,0,791,790,1,0,
	0,0,791,792,1,0,0,0,792,793,1,0,0,0,793,797,3,78,39,0,794,796,3,72,36,0,
	795,794,1,0,0,0,796,799,1,0,0,0,797,795,1,0,0,0,797,798,1,0,0,0,798,800,
	1,0,0,0,799,797,1,0,0,0,800,801,5,172,0,0,801,802,5,2,0,0,802,804,1,0,0,
	0,803,754,1,0,0,0,803,766,1,0,0,0,803,778,1,0,0,0,803,791,1,0,0,0,804,71,
	1,0,0,0,805,808,3,220,110,0,806,808,3,74,37,0,807,805,1,0,0,0,807,806,1,
	0,0,0,808,73,1,0,0,0,809,810,7,5,0,0,810,75,1,0,0,0,811,812,5,56,0,0,812,
	813,5,40,0,0,813,815,3,228,114,0,814,816,5,172,0,0,815,814,1,0,0,0,815,
	816,1,0,0,0,816,817,1,0,0,0,817,818,5,57,0,0,818,820,3,228,114,0,819,821,
	5,172,0,0,820,819,1,0,0,0,820,821,1,0,0,0,821,822,1,0,0,0,822,823,5,41,
	0,0,823,848,1,0,0,0,824,825,5,56,0,0,825,826,5,40,0,0,826,828,3,228,114,
	0,827,829,5,172,0,0,828,827,1,0,0,0,828,829,1,0,0,0,829,830,1,0,0,0,830,
	831,5,57,0,0,831,832,3,76,38,0,832,833,5,41,0,0,833,848,1,0,0,0,834,835,
	5,56,0,0,835,836,5,40,0,0,836,838,3,228,114,0,837,839,5,172,0,0,838,837,
	1,0,0,0,838,839,1,0,0,0,839,840,1,0,0,0,840,841,5,57,0,0,841,843,3,78,39,
	0,842,844,5,172,0,0,843,842,1,0,0,0,843,844,1,0,0,0,844,845,1,0,0,0,845,
	846,5,41,0,0,846,848,1,0,0,0,847,811,1,0,0,0,847,824,1,0,0,0,847,834,1,
	0,0,0,848,77,1,0,0,0,849,850,6,39,-1,0,850,851,3,228,114,0,851,852,5,58,
	0,0,852,853,5,155,0,0,853,854,5,59,0,0,854,860,1,0,0,0,855,856,3,228,114,
	0,856,857,5,58,0,0,857,858,5,59,0,0,858,860,1,0,0,0,859,849,1,0,0,0,859,
	855,1,0,0,0,860,870,1,0,0,0,861,862,10,2,0,0,862,863,5,58,0,0,863,864,5,
	155,0,0,864,869,5,59,0,0,865,866,10,1,0,0,866,867,5,58,0,0,867,869,5,59,
	0,0,868,861,1,0,0,0,868,865,1,0,0,0,869,872,1,0,0,0,870,868,1,0,0,0,870,
	871,1,0,0,0,871,79,1,0,0,0,872,870,1,0,0,0,873,874,5,60,0,0,874,876,5,172,
	0,0,875,877,3,100,50,0,876,875,1,0,0,0,876,877,1,0,0,0,877,878,1,0,0,0,
	878,882,5,4,0,0,879,881,3,82,41,0,880,879,1,0,0,0,881,884,1,0,0,0,882,880,
	1,0,0,0,882,883,1,0,0,0,883,885,1,0,0,0,884,882,1,0,0,0,885,886,5,6,0,0,
	886,81,1,0,0,0,887,890,3,84,42,0,888,890,3,106,53,0,889,887,1,0,0,0,889,
	888,1,0,0,0,890,83,1,0,0,0,891,892,5,61,0,0,892,893,5,2,0,0,893,85,1,0,
	0,0,894,895,5,7,0,0,895,896,5,172,0,0,896,900,3,100,50,0,897,899,3,90,45,
	0,898,897,1,0,0,0,899,902,1,0,0,0,900,898,1,0,0,0,900,901,1,0,0,0,901,906,
	1,0,0,0,902,900,1,0,0,0,903,905,3,88,44,0,904,903,1,0,0,0,905,908,1,0,0,
	0,906,904,1,0,0,0,906,907,1,0,0,0,907,910,1,0,0,0,908,906,1,0,0,0,909,911,
	3,96,48,0,910,909,1,0,0,0,910,911,1,0,0,0,911,912,1,0,0,0,912,916,5,4,0,
	0,913,915,3,106,53,0,914,913,1,0,0,0,915,918,1,0,0,0,916,914,1,0,0,0,916,
	917,1,0,0,0,917,919,1,0,0,0,918,916,1,0,0,0,919,920,5,6,0,0,920,87,1,0,
	0,0,921,923,5,172,0,0,922,924,3,208,104,0,923,922,1,0,0,0,923,924,1,0,0,
	0,924,89,1,0,0,0,925,940,5,62,0,0,926,940,5,63,0,0,927,940,5,50,0,0,928,
	940,5,35,0,0,929,940,5,34,0,0,930,940,5,55,0,0,931,940,5,52,0,0,932,940,
	3,92,46,0,933,940,5,53,0,0,934,940,3,94,47,0,935,940,5,64,0,0,936,940,5,
	65,0,0,937,940,5,66,0,0,938,940,5,67,0,0,939,925,1,0,0,0,939,926,1,0,0,
	0,939,927,1,0,0,0,939,928,1,0,0,0,939,929,1,0,0,0,939,930,1,0,0,0,939,931,
	1,0,0,0,939,932,1,0,0,0,939,933,1,0,0,0,939,934,1,0,0,0,939,935,1,0,0,0,
	939,936,1,0,0,0,939,937,1,0,0,0,939,938,1,0,0,0,940,91,1,0,0,0,941,952,
	5,68,0,0,942,943,5,40,0,0,943,948,5,172,0,0,944,945,5,5,0,0,945,947,5,172,
	0,0,946,944,1,0,0,0,947,950,1,0,0,0,948,946,1,0,0,0,948,949,1,0,0,0,949,
	951,1,0,0,0,950,948,1,0,0,0,951,953,5,41,0,0,952,942,1,0,0,0,952,953,1,
	0,0,0,953,93,1,0,0,0,954,958,5,69,0,0,955,956,5,40,0,0,956,957,5,155,0,
	0,957,959,5,41,0,0,958,955,1,0,0,0,958,959,1,0,0,0,959,95,1,0,0,0,960,961,
	5,70,0,0,961,962,5,40,0,0,962,967,3,98,49,0,963,964,5,5,0,0,964,966,3,98,
	49,0,965,963,1,0,0,0,966,969,1,0,0,0,967,965,1,0,0,0,967,968,1,0,0,0,968,
	971,1,0,0,0,969,967,1,0,0,0,970,972,5,5,0,0,971,970,1,0,0,0,971,972,1,0,
	0,0,972,973,1,0,0,0,973,974,5,41,0,0,974,97,1,0,0,0,975,979,3,228,114,0,
	976,978,3,220,110,0,977,976,1,0,0,0,978,981,1,0,0,0,979,977,1,0,0,0,979,
	980,1,0,0,0,980,983,1,0,0,0,981,979,1,0,0,0,982,984,5,172,0,0,983,982,1,
	0,0,0,983,984,1,0,0,0,984,99,1,0,0,0,985,997,5,40,0,0,986,991,3,102,51,
	0,987,988,5,5,0,0,988,990,3,102,51,0,989,987,1,0,0,0,990,993,1,0,0,0,991,
	989,1,0,0,0,991,992,1,0,0,0,992,995,1,0,0,0,993,991,1,0,0,0,994,996,5,5,
	0,0,995,994,1,0,0,0,995,996,1,0,0,0,996,998,1,0,0,0,997,986,1,0,0,0,997,
	998,1,0,0,0,998,999,1,0,0,0,999,1000,5,41,0,0,1000,101,1,0,0,0,1001,1005,
	3,228,114,0,1002,1004,3,220,110,0,1003,1002,1,0,0,0,1004,1007,1,0,0,0,1005,
	1003,1,0,0,0,1005,1006,1,0,0,0,1006,1008,1,0,0,0,1007,1005,1,0,0,0,1008,
	1009,5,172,0,0,1009,1020,1,0,0,0,1010,1014,3,78,39,0,1011,1013,3,220,110,
	0,1012,1011,1,0,0,0,1013,1016,1,0,0,0,1014,1012,1,0,0,0,1014,1015,1,0,0,
	0,1015,1017,1,0,0,0,1016,1014,1,0,0,0,1017,1018,5,172,0,0,1018,1020,1,0,
	0,0,1019,1001,1,0,0,0,1019,1010,1,0,0,0,1020,103,1,0,0,0,1021,1025,5,4,
	0,0,1022,1024,3,106,53,0,1023,1022,1,0,0,0,1024,1027,1,0,0,0,1025,1023,
	1,0,0,0,1025,1026,1,0,0,0,1026,1028,1,0,0,0,1027,1025,1,0,0,0,1028,1031,
	5,6,0,0,1029,1031,3,106,53,0,1030,1021,1,0,0,0,1030,1029,1,0,0,0,1031,105,
	1,0,0,0,1032,1063,3,124,62,0,1033,1063,3,126,63,0,1034,1063,3,132,66,0,
	1035,1063,3,134,67,0,1036,1063,3,136,68,0,1037,1063,3,138,69,0,1038,1063,
	3,140,70,0,1039,1063,3,130,65,0,1040,1063,3,120,60,0,1041,1063,3,122,61,
	0,1042,1063,3,144,72,0,1043,1063,3,146,73,0,1044,1063,3,148,74,0,1045,1063,
	3,150,75,0,1046,1063,3,170,85,0,1047,1063,3,118,59,0,1048,1063,3,108,54,
	0,1049,1063,3,110,55,0,1050,1063,3,112,56,0,1051,1063,3,114,57,0,1052,1063,
	3,116,58,0,1053,1063,3,172,86,0,1054,1063,3,184,92,0,1055,1063,3,196,98,
	0,1056,1063,3,198,99,0,1057,1063,3,142,71,0,1058,1063,3,176,88,0,1059,1063,
	3,178,89,0,1060,1063,3,190,95,0,1061,1063,3,192,96,0,1062,1032,1,0,0,0,
	1062,1033,1,0,0,0,1062,1034,1,0,0,0,1062,1035,1,0,0,0,1062,1036,1,0,0,0,
	1062,1037,1,0,0,0,1062,1038,1,0,0,0,1062,1039,1,0,0,0,1062,1040,1,0,0,0,
	1062,1041,1,0,0,0,1062,1042,1,0,0,0,1062,1043,1,0,0,0,1062,1044,1,0,0,0,
	1062,1045,1,0,0,0,1062,1046,1,0,0,0,1062,1047,1,0,0,0,1062,1048,1,0,0,0,
	1062,1049,1,0,0,0,1062,1050,1,0,0,0,1062,1051,1,0,0,0,1062,1052,1,0,0,0,
	1062,1053,1,0,0,0,1062,1054,1,0,0,0,1062,1055,1,0,0,0,1062,1056,1,0,0,0,
	1062,1057,1,0,0,0,1062,1058,1,0,0,0,1062,1059,1,0,0,0,1062,1060,1,0,0,0,
	1062,1061,1,0,0,0,1063,107,1,0,0,0,1064,1065,5,71,0,0,1065,1066,5,12,0,
	0,1066,1067,5,172,0,0,1067,1068,5,40,0,0,1068,1069,3,216,108,0,1069,1070,
	5,5,0,0,1070,1071,3,216,108,0,1071,1072,5,41,0,0,1072,1073,5,2,0,0,1073,
	109,1,0,0,0,1074,1075,5,71,0,0,1075,1076,5,12,0,0,1076,1077,5,172,0,0,1077,
	1078,5,58,0,0,1078,1079,3,216,108,0,1079,1080,5,59,0,0,1080,1081,5,12,0,
	0,1081,1082,5,172,0,0,1082,1083,5,40,0,0,1083,1088,3,216,108,0,1084,1085,
	5,5,0,0,1085,1087,3,216,108,0,1086,1084,1,0,0,0,1087,1090,1,0,0,0,1088,
	1086,1,0,0,0,1088,1089,1,0,0,0,1089,1091,1,0,0,0,1090,1088,1,0,0,0,1091,
	1092,5,41,0,0,1092,1093,5,2,0,0,1093,111,1,0,0,0,1094,1095,5,72,0,0,1095,
	1124,5,2,0,0,1096,1097,5,72,0,0,1097,1102,3,216,108,0,1098,1099,5,5,0,0,
	1099,1101,3,216,108,0,1100,1098,1,0,0,0,1101,1104,1,0,0,0,1102,1100,1,0,
	0,0,1102,1103,1,0,0,0,1103,1105,1,0,0,0,1104,1102,1,0,0,0,1105,1106,5,2,
	0,0,1106,1124,1,0,0,0,1107,1108,5,72,0,0,1108,1109,5,40,0,0,1109,1114,3,
	216,108,0,1110,1111,5,5,0,0,1111,1113,3,216,108,0,1112,1110,1,0,0,0,1113,
	1116,1,0,0,0,1114,1112,1,0,0,0,1114,1115,1,0,0,0,1115,1118,1,0,0,0,1116,
	1114,1,0,0,0,1117,1119,5,5,0,0,1118,1117,1,0,0,0,1118,1119,1,0,0,0,1119,
	1120,1,0,0,0,1120,1121,5,41,0,0,1121,1122,5,2,0,0,1122,1124,1,0,0,0,1123,
	1094,1,0,0,0,1123,1096,1,0,0,0,1123,1107,1,0,0,0,1124,113,1,0,0,0,1125,
	1128,5,172,0,0,1126,1127,5,12,0,0,1127,1129,5,172,0,0,1128,1126,1,0,0,0,
	1128,1129,1,0,0,0,1129,1130,1,0,0,0,1130,1131,5,40,0,0,1131,1143,5,4,0,
	0,1132,1137,3,206,103,0,1133,1134,5,5,0,0,1134,1136,3,206,103,0,1135,1133,
	1,0,0,0,1136,1139,1,0,0,0,1137,1135,1,0,0,0,1137,1138,1,0,0,0,1138,1141,
	1,0,0,0,1139,1137,1,0,0,0,1140,1142,5,5,0,0,1141,1140,1,0,0,0,1141,1142,
	1,0,0,0,1142,1144,1,0,0,0,1143,1132,1,0,0,0,1143,1144,1,0,0,0,1144,1145,
	1,0,0,0,1145,1146,5,6,0,0,1146,1147,5,41,0,0,1147,1171,5,2,0,0,1148,1149,
	5,172,0,0,1149,1150,3,208,104,0,1150,1151,5,2,0,0,1151,1171,1,0,0,0,1152,
	1153,5,172,0,0,1153,1154,5,12,0,0,1154,1155,5,172,0,0,1155,1156,3,208,104,
	0,1156,1157,5,2,0,0,1157,1171,1,0,0,0,1158,1159,5,172,0,0,1159,1160,3,208,
	104,0,1160,1161,5,12,0,0,1161,1162,5,172,0,0,1162,1163,5,12,0,0,1163,1165,
	5,172,0,0,1164,1166,3,210,105,0,1165,1164,1,0,0,0,1165,1166,1,0,0,0,1166,
	1167,1,0,0,0,1167,1168,3,208,104,0,1168,1169,5,2,0,0,1169,1171,1,0,0,0,
	1170,1125,1,0,0,0,1170,1148,1,0,0,0,1170,1152,1,0,0,0,1170,1158,1,0,0,0,
	1171,115,1,0,0,0,1172,1173,3,216,108,0,1173,1174,5,12,0,0,1174,1176,5,172,
	0,0,1175,1177,3,210,105,0,1176,1175,1,0,0,0,1176,1177,1,0,0,0,1177,1178,
	1,0,0,0,1178,1179,3,208,104,0,1179,1180,5,2,0,0,1180,117,1,0,0,0,1181,1182,
	5,73,0,0,1182,1185,5,172,0,0,1183,1184,5,12,0,0,1184,1186,5,172,0,0,1185,
	1183,1,0,0,0,1185,1186,1,0,0,0,1186,1187,1,0,0,0,1187,1188,5,40,0,0,1188,
	1200,5,4,0,0,1189,1194,3,206,103,0,1190,1191,5,5,0,0,1191,1193,3,206,103,
	0,1192,1190,1,0,0,0,1193,1196,1,0,0,0,1194,1192,1,0,0,0,1194,1195,1,0,0,
	0,1195,1198,1,0,0,0,1196,1194,1,0,0,0,1197,1199,5,5,0,0,1198,1197,1,0,0,
	0,1198,1199,1,0,0,0,1199,1201,1,0,0,0,1200,1189,1,0,0,0,1200,1201,1,0,0,
	0,1201,1202,1,0,0,0,1202,1203,5,6,0,0,1203,1204,5,41,0,0,1204,1215,5,2,
	0,0,1205,1206,5,73,0,0,1206,1209,5,172,0,0,1207,1208,5,12,0,0,1208,1210,
	5,172,0,0,1209,1207,1,0,0,0,1209,1210,1,0,0,0,1210,1211,1,0,0,0,1211,1212,
	3,208,104,0,1212,1213,5,2,0,0,1213,1215,1,0,0,0,1214,1181,1,0,0,0,1214,
	1205,1,0,0,0,1215,119,1,0,0,0,1216,1217,5,71,0,0,1217,1218,5,12,0,0,1218,
	1231,5,172,0,0,1219,1220,5,58,0,0,1220,1221,3,216,108,0,1221,1222,5,59,
	0,0,1222,1224,1,0,0,0,1223,1219,1,0,0,0,1224,1225,1,0,0,0,1225,1223,1,0,
	0,0,1225,1226,1,0,0,0,1226,1229,1,0,0,0,1227,1228,5,12,0,0,1228,1230,5,
	172,0,0,1229,1227,1,0,0,0,1229,1230,1,0,0,0,1230,1232,1,0,0,0,1231,1223,
	1,0,0,0,1231,1232,1,0,0,0,1232,1233,1,0,0,0,1233,1234,7,6,0,0,1234,1235,
	3,216,108,0,1235,1236,5,2,0,0,1236,1255,1,0,0,0,1237,1242,5,172,0,0,1238,
	1239,5,58,0,0,1239,1240,3,216,108,0,1240,1241,5,59,0,0,1241,1243,1,0,0,
	0,1242,1238,1,0,0,0,1243,1244,1,0,0,0,1244,1242,1,0,0,0,1244,1245,1,0,0,
	0,1245,1248,1,0,0,0,1246,1247,5,12,0,0,1247,1249,5,172,0,0,1248,1246,1,
	0,0,0,1248,1249,1,0,0,0,1249,1250,1,0,0,0,1250,1251,7,6,0,0,1251,1252,3,
	216,108,0,1252,1253,5,2,0,0,1253,1255,1,0,0,0,1254,1216,1,0,0,0,1254,1237,
	1,0,0,0,1255,121,1,0,0,0,1256,1257,5,71,0,0,1257,1258,5,12,0,0,1258,1265,
	5,172,0,0,1259,1260,5,58,0,0,1260,1261,3,216,108,0,1261,1262,5,59,0,0,1262,
	1264,1,0,0,0,1263,1259,1,0,0,0,1264,1267,1,0,0,0,1265,1263,1,0,0,0,1265,
	1266,1,0,0,0,1266,1268,1,0,0,0,1267,1265,1,0,0,0,1268,1269,5,84,0,0,1269,
	1270,5,40,0,0,1270,1271,3,216,108,0,1271,1272,5,41,0,0,1272,1273,5,2,0,
	0,1273,123,1,0,0,0,1274,1278,3,228,114,0,1275,1277,3,220,110,0,1276,1275,
	1,0,0,0,1277,1280,1,0,0,0,1278,1276,1,0,0,0,1278,1279,1,0,0,0,1279,1281,
	1,0,0,0,1280,1278,1,0,0,0,1281,1284,5,172,0,0,1282,1283,5,31,0,0,1283,1285,
	3,216,108,0,1284,1282,1,0,0,0,1284,1285,1,0,0,0,1285,1286,1,0,0,0,1286,
	1287,5,2,0,0,1287,1301,1,0,0,0,1288,1292,3,78,39,0,1289,1291,3,220,110,
	0,1290,1289,1,0,0,0,1291,1294,1,0,0,0,1292,1290,1,0,0,0,1292,1293,1,0,0,
	0,1293,1295,1,0,0,0,1294,1292,1,0,0,0,1295,1296,5,172,0,0,1296,1297,5,31,
	0,0,1297,1298,3,216,108,0,1298,1299,5,2,0,0,1299,1301,1,0,0,0,1300,1274,
	1,0,0,0,1300,1288,1,0,0,0,1301,125,1,0,0,0,1302,1303,3,228,114,0,1303,1308,
	5,172,0,0,1304,1305,5,5,0,0,1305,1306,3,228,114,0,1306,1307,5,172,0,0,1307,
	1309,1,0,0,0,1308,1304,1,0,0,0,1309,1310,1,0,0,0,1310,1308,1,0,0,0,1310,
	1311,1,0,0,0,1311,1312,1,0,0,0,1312,1313,5,31,0,0,1313,1314,3,216,108,0,
	1314,1315,5,2,0,0,1315,1351,1,0,0,0,1316,1317,5,40,0,0,1317,1320,3,128,
	64,0,1318,1319,5,5,0,0,1319,1321,3,128,64,0,1320,1318,1,0,0,0,1321,1322,
	1,0,0,0,1322,1320,1,0,0,0,1322,1323,1,0,0,0,1323,1324,1,0,0,0,1324,1325,
	5,41,0,0,1325,1326,5,31,0,0,1326,1327,5,40,0,0,1327,1330,3,216,108,0,1328,
	1329,5,5,0,0,1329,1331,3,216,108,0,1330,1328,1,0,0,0,1331,1332,1,0,0,0,
	1332,1330,1,0,0,0,1332,1333,1,0,0,0,1333,1334,1,0,0,0,1334,1335,5,41,0,
	0,1335,1336,5,2,0,0,1336,1351,1,0,0,0,1337,1338,5,40,0,0,1338,1341,3,128,
	64,0,1339,1340,5,5,0,0,1340,1342,3,128,64,0,1341,1339,1,0,0,0,1342,1343,
	1,0,0,0,1343,1341,1,0,0,0,1343,1344,1,0,0,0,1344,1345,1,0,0,0,1345,1346,
	5,41,0,0,1346,1347,5,31,0,0,1347,1348,3,216,108,0,1348,1349,5,2,0,0,1349,
	1351,1,0,0,0,1350,1302,1,0,0,0,1350,1316,1,0,0,0,1350,1337,1,0,0,0,1351,
	127,1,0,0,0,1352,1353,3,228,114,0,1353,1354,5,172,0,0,1354,1358,1,0,0,0,
	1355,1358,5,172,0,0,1356,1358,1,0,0,0,1357,1352,1,0,0,0,1357,1355,1,0,0,
	0,1357,1356,1,0,0,0,1358,129,1,0,0,0,1359,1360,5,172,0,0,1360,1361,7,6,
	0,0,1361,1362,3,216,108,0,1362,1363,5,2,0,0,1363,1368,1,0,0,0,1364,1365,
	5,172,0,0,1365,1366,7,7,0,0,1366,1368,5,2,0,0,1367,1359,1,0,0,0,1367,1364,
	1,0,0,0,1368,131,1,0,0,0,1369,1370,5,172,0,0,1370,1371,5,87,0,0,1371,1372,
	5,40,0,0,1372,1373,3,216,108,0,1373,1374,5,41,0,0,1374,1375,5,2,0,0,1375,
	133,1,0,0,0,1376,1377,5,172,0,0,1377,1378,5,88,0,0,1378,1379,5,40,0,0,1379,
	1380,5,41,0,0,1380,1381,5,2,0,0,1381,135,1,0,0,0,1382,1383,5,172,0,0,1383,
	1384,5,84,0,0,1384,1385,5,40,0,0,1385,1386,3,216,108,0,1386,1387,5,41,0,
	0,1387,1388,5,2,0,0,1388,137,1,0,0,0,1389,1390,5,71,0,0,1390,1391,5,12,
	0,0,1391,1392,5,172,0,0,1392,1393,5,87,0,0,1393,1394,5,40,0,0,1394,1395,
	3,216,108,0,1395,1396,5,41,0,0,1396,1397,5,2,0,0,1397,139,1,0,0,0,1398,
	1399,5,71,0,0,1399,1400,5,12,0,0,1400,1401,5,172,0,0,1401,1402,5,88,0,0,
	1402,1403,5,40,0,0,1403,1404,5,41,0,0,1404,1405,5,2,0,0,1405,141,1,0,0,
	0,1406,1407,5,89,0,0,1407,1408,5,172,0,0,1408,1429,5,2,0,0,1409,1410,5,
	89,0,0,1410,1411,5,71,0,0,1411,1412,5,12,0,0,1412,1413,5,172,0,0,1413,1429,
	5,2,0,0,1414,1415,5,89,0,0,1415,1416,5,71,0,0,1416,1417,5,12,0,0,1417,1422,
	5,172,0,0,1418,1419,5,58,0,0,1419,1420,3,216,108,0,1420,1421,5,59,0,0,1421,
	1423,1,0,0,0,1422,1418,1,0,0,0,1423,1424,1,0,0,0,1424,1422,1,0,0,0,1424,
	1425,1,0,0,0,1425,1426,1,0,0,0,1426,1427,5,2,0,0,1427,1429,1,0,0,0,1428,
	1406,1,0,0,0,1428,1409,1,0,0,0,1428,1414,1,0,0,0,1429,143,1,0,0,0,1430,
	1431,5,90,0,0,1431,1432,5,40,0,0,1432,1433,5,163,0,0,1433,1434,5,23,0,0,
	1434,1437,3,216,108,0,1435,1436,5,5,0,0,1436,1438,3,194,97,0,1437,1435,
	1,0,0,0,1437,1438,1,0,0,0,1438,1439,1,0,0,0,1439,1440,5,41,0,0,1440,1441,
	5,2,0,0,1441,145,1,0,0,0,1442,1443,5,90,0,0,1443,1444,5,40,0,0,1444,1447,
	3,216,108,0,1445,1446,5,5,0,0,1446,1448,3,194,97,0,1447,1445,1,0,0,0,1447,
	1448,1,0,0,0,1448,1449,1,0,0,0,1449,1450,5,41,0,0,1450,1451,5,2,0,0,1451,
	147,1,0,0,0,1452,1453,5,91,0,0,1453,1454,5,40,0,0,1454,1455,3,216,108,0,
	1455,1456,5,41,0,0,1456,1459,3,104,52,0,1457,1458,5,92,0,0,1458,1460,3,
	104,52,0,1459,1457,1,0,0,0,1459,1460,1,0,0,0,1460,149,1,0,0,0,1461,1468,
	3,166,83,0,1462,1468,3,168,84,0,1463,1468,3,158,79,0,1464,1468,3,152,76,
	0,1465,1468,3,154,77,0,1466,1468,3,156,78,0,1467,1461,1,0,0,0,1467,1462,
	1,0,0,0,1467,1463,1,0,0,0,1467,1464,1,0,0,0,1467,1465,1,0,0,0,1467,1466,
	1,0,0,0,1468,151,1,0,0,0,1469,1470,5,9,0,0,1470,1471,5,40,0,0,1471,1472,
	3,228,114,0,1472,1473,5,172,0,0,1473,1474,5,5,0,0,1474,1475,3,228,114,0,
	1475,1476,5,172,0,0,1476,1477,5,93,0,0,1477,1478,5,71,0,0,1478,1479,5,12,
	0,0,1479,1480,5,172,0,0,1480,1481,5,12,0,0,1481,1482,5,94,0,0,1482,1483,
	5,41,0,0,1483,1484,3,104,52,0,1484,153,1,0,0,0,1485,1486,5,9,0,0,1486,1487,
	5,40,0,0,1487,1488,3,228,114,0,1488,1489,5,172,0,0,1489,1490,5,95,0,0,1490,
	1491,5,71,0,0,1491,1492,5,12,0,0,1492,1493,5,172,0,0,1493,1494,5,41,0,0,
	1494,1495,3,104,52,0,1495,155,1,0,0,0,1496,1497,5,9,0,0,1497,1498,5,40,
	0,0,1498,1499,3,228,114,0,1499,1500,5,172,0,0,1500,1501,5,93,0,0,1501,1502,
	5,71,0,0,1502,1503,5,12,0,0,1503,1504,5,172,0,0,1504,1505,5,41,0,0,1505,
	1506,3,104,52,0,1506,157,1,0,0,0,1507,1508,5,9,0,0,1508,1509,5,40,0,0,1509,
	1510,3,160,80,0,1510,1511,3,162,81,0,1511,1512,3,164,82,0,1512,1513,5,41,
	0,0,1513,1514,3,104,52,0,1514,159,1,0,0,0,1515,1519,3,228,114,0,1516,1518,
	3,220,110,0,1517,1516,1,0,0,0,1518,1521,1,0,0,0,1519,1517,1,0,0,0,1519,
	1520,1,0,0,0,1520,1522,1,0,0,0,1521,1519,1,0,0,0,1522,1523,5,172,0,0,1523,
	1524,5,31,0,0,1524,1525,3,216,108,0,1525,1526,5,2,0,0,1526,161,1,0,0,0,
	1527,1528,3,216,108,0,1528,1529,5,2,0,0,1529,163,1,0,0,0,1530,1531,5,172,
	0,0,1531,1532,7,6,0,0,1532,1536,3,216,108,0,1533,1534,5,172,0,0,1534,1536,
	7,7,0,0,1535,1530,1,0,0,0,1535,1533,1,0,0,0,1536,165,1,0,0,0,1537,1538,
	5,96,0,0,1538,1539,3,104,52,0,1539,1540,5,97,0,0,1540,1541,5,40,0,0,1541,
	1542,3,216,108,0,1542,1543,5,41,0,0,1543,1544,5,2,0,0,1544,167,1,0,0,0,
	1545,1546,5,97,0,0,1546,1547,5,40,0,0,1547,1548,3,216,108,0,1548,1549,5,
	41,0,0,1549,1550,3,104,52,0,1550,169,1,0,0,0,1551,1552,5,98,0,0,1552,1553,
	3,202,101,0,1553,1554,5,2,0,0,1554,171,1,0,0,0,1555,1556,5,99,0,0,1556,
	1560,5,4,0,0,1557,1559,3,174,87,0,1558,1557,1,0,0,0,1559,1562,1,0,0,0,1560,
	1558,1,0,0,0,1560,1561,1,0,0,0,1561,1563,1,0,0,0,1562,1560,1,0,0,0,1563,
	1564,5,6,0,0,1564,173,1,0,0,0,1565,1566,7,8,0,0,1566,175,1,0,0,0,1567,1568,
	5,100,0,0,1568,1572,5,4,0,0,1569,1571,3,106,53,0,1570,1569,1,0,0,0,1571,
	1574,1,0,0,0,1572,1570,1,0,0,0,1572,1573,1,0,0,0,1573,1575,1,0,0,0,1574,
	1572,1,0,0,0,1575,1576,5,6,0,0,1576,177,1,0,0,0,1577,1578,5,101,0,0,1578,
	1579,5,40,0,0,1579,1580,3,216,108,0,1580,1581,5,41,0,0,1581,1585,5,4,0,
	0,1582,1584,3,180,90,0,1583,1582,1,0,0,0,1584,1587,1,0,0,0,1585,1583,1,
	0,0,0,1585,1586,1,0,0,0,1586,1589,1,0,0,0,1587,1585,1,0,0,0,1588,1590,3,
	182,91,0,1589,1588,1,0,0,0,1589,1590,1,0,0,0,1590,1591,1,0,0,0,1591,1592,
	5,6,0,0,1592,179,1,0,0,0,1593,1594,5,102,0,0,1594,1595,3,216,108,0,1595,
	1599,5,103,0,0,1596,1598,3,106,53,0,1597,1596,1,0,0,0,1598,1601,1,0,0,0,
	1599,1597,1,0,0,0,1599,1600,1,0,0,0,1600,181,1,0,0,0,1601,1599,1,0,0,0,
	1602,1603,5,104,0,0,1603,1607,5,103,0,0,1604,1606,3,106,53,0,1605,1604,
	1,0,0,0,1606,1609,1,0,0,0,1607,1605,1,0,0,0,1607,1608,1,0,0,0,1608,183,
	1,0,0,0,1609,1607,1,0,0,0,1610,1611,5,105,0,0,1611,1613,3,216,108,0,1612,
	1614,3,186,93,0,1613,1612,1,0,0,0,1613,1614,1,0,0,0,1614,1615,1,0,0,0,1615,
	1617,3,104,52,0,1616,1618,3,188,94,0,1617,1616,1,0,0,0,1618,1619,1,0,0,
	0,1619,1617,1,0,0,0,1619,1620,1,0,0,0,1620,185,1,0,0,0,1621,1622,5,70,0,
	0,1622,1634,5,40,0,0,1623,1628,3,102,51,0,1624,1625,5,5,0,0,1625,1627,3,
	102,51,0,1626,1624,1,0,0,0,1627,1630,1,0,0,0,1628,1626,1,0,0,0,1628,1629,
	1,0,0,0,1629,1632,1,0,0,0,1630,1628,1,0,0,0,1631,1633,5,5,0,0,1632,1631,
	1,0,0,0,1632,1633,1,0,0,0,1633,1635,1,0,0,0,1634,1623,1,0,0,0,1634,1635,
	1,0,0,0,1635,1636,1,0,0,0,1636,1637,5,41,0,0,1637,187,1,0,0,0,1638,1640,
	5,106,0,0,1639,1641,5,172,0,0,1640,1639,1,0,0,0,1640,1641,1,0,0,0,1641,
	1657,1,0,0,0,1642,1654,5,40,0,0,1643,1648,3,102,51,0,1644,1645,5,5,0,0,
	1645,1647,3,102,51,0,1646,1644,1,0,0,0,1647,1650,1,0,0,0,1648,1646,1,0,
	0,0,1648,1649,1,0,0,0,1649,1652,1,0,0,0,1650,1648,1,0,0,0,1651,1653,5,5,
	0,0,1652,1651,1,0,0,0,1652,1653,1,0,0,0,1653,1655,1,0,0,0,1654,1643,1,0,
	0,0,1654,1655,1,0,0,0,1655,1656,1,0,0,0,1656,1658,5,41,0,0,1657,1642,1,
	0,0,0,1657,1658,1,0,0,0,1658,1659,1,0,0,0,1659,1660,3,104,52,0,1660,189,
	1,0,0,0,1661,1662,5,107,0,0,1662,1663,5,2,0,0,1663,191,1,0,0,0,1664,1665,
	5,108,0,0,1665,1666,5,2,0,0,1666,193,1,0,0,0,1667,1671,5,160,0,0,1668,1669,
	5,172,0,0,1669,1671,3,208,104,0,1670,1667,1,0,0,0,1670,1668,1,0,0,0,1671,
	195,1,0,0,0,1672,1673,5,109,0,0,1673,1676,5,172,0,0,1674,1675,5,12,0,0,
	1675,1677,5,172,0,0,1676,1674,1,0,0,0,1676,1677,1,0,0,0,1677,1678,1,0,0,
	0,1678,1679,5,40,0,0,1679,1691,5,4,0,0,1680,1685,3,206,103,0,1681,1682,
	5,5,0,0,1682,1684,3,206,103,0,1683,1681,1,0,0,0,1684,1687,1,0,0,0,1685,
	1683,1,0,0,0,1685,1686,1,0,0,0,1686,1689,1,0,0,0,1687,1685,1,0,0,0,1688,
	1690,5,5,0,0,1689,1688,1,0,0,0,1689,1690,1,0,0,0,1690,1692,1,0,0,0,1691,
	1680,1,0,0,0,1691,1692,1,0,0,0,1692,1693,1,0,0,0,1693,1694,5,6,0,0,1694,
	1695,5,41,0,0,1695,1715,5,2,0,0,1696,1697,5,109,0,0,1697,1700,5,172,0,0,
	1698,1699,5,12,0,0,1699,1701,5,172,0,0,1700,1698,1,0,0,0,1700,1701,1,0,
	0,0,1701,1702,1,0,0,0,1702,1703,3,208,104,0,1703,1704,5,2,0,0,1704,1715,
	1,0,0,0,1705,1706,5,109,0,0,1706,1707,5,40,0,0,1707,1708,5,160,0,0,1708,
	1709,5,41,0,0,1709,1715,5,2,0,0,1710,1711,5,109,0,0,1711,1712,5,40,0,0,
	1712,1713,5,41,0,0,1713,1715,5,2,0,0,1714,1672,1,0,0,0,1714,1696,1,0,0,
	0,1714,1705,1,0,0,0,1714,1710,1,0,0,0,1715,197,1,0,0,0,1716,1717,5,110,
	0,0,1717,1718,5,40,0,0,1718,1719,3,216,108,0,1719,1720,5,41,0,0,1720,1721,
	5,2,0,0,1721,199,1,0,0,0,1722,1725,5,172,0,0,1723,1725,3,222,111,0,1724,
	1722,1,0,0,0,1724,1723,1,0,0,0,1725,201,1,0,0,0,1726,1738,5,40,0,0,1727,
	1732,3,200,100,0,1728,1729,5,5,0,0,1729,1731,3,200,100,0,1730,1728,1,0,
	0,0,1731,1734,1,0,0,0,1732,1730,1,0,0,0,1732,1733,1,0,0,0,1733,1736,1,0,
	0,0,1734,1732,1,0,0,0,1735,1737,5,5,0,0,1736,1735,1,0,0,0,1736,1737,1,0,
	0,0,1737,1739,1,0,0,0,1738,1727,1,0,0,0,1738,1739,1,0,0,0,1739,1740,1,0,
	0,0,1740,1741,5,41,0,0,1741,203,1,0,0,0,1742,1743,5,172,0,0,1743,1767,3,
	208,104,0,1744,1745,5,172,0,0,1745,1746,5,12,0,0,1746,1747,5,172,0,0,1747,
	1767,3,208,104,0,1748,1749,5,172,0,0,1749,1750,5,40,0,0,1750,1762,5,4,0,
	0,1751,1756,3,206,103,0,1752,1753,5,5,0,0,1753,1755,3,206,103,0,1754,1752,
	1,0,0,0,1755,1758,1,0,0,0,1756,1754,1,0,0,0,1756,1757,1,0,0,0,1757,1760,
	1,0,0,0,1758,1756,1,0,0,0,1759,1761,5,5,0,0,1760,1759,1,0,0,0,1760,1761,
	1,0,0,0,1761,1763,1,0,0,0,1762,1751,1,0,0,0,1762,1763,1,0,0,0,1763,1764,
	1,0,0,0,1764,1765,5,6,0,0,1765,1767,5,41,0,0,1766,1742,1,0,0,0,1766,1744,
	1,0,0,0,1766,1748,1,0,0,0,1767,205,1,0,0,0,1768,1769,5,172,0,0,1769,1770,
	5,103,0,0,1770,1771,3,216,108,0,1771,207,1,0,0,0,1772,1784,5,40,0,0,1773,
	1778,3,216,108,0,1774,1775,5,5,0,0,1775,1777,3,216,108,0,1776,1774,1,0,
	0,0,1777,1780,1,0,0,0,1778,1776,1,0,0,0,1778,1779,1,0,0,0,1779,1782,1,0,
	0,0,1780,1778,1,0,0,0,1781,1783,5,5,0,0,1782,1781,1,0,0,0,1782,1783,1,0,
	0,0,1783,1785,1,0,0,0,1784,1773,1,0,0,0,1784,1785,1,0,0,0,1785,1786,1,0,
	0,0,1786,1787,5,41,0,0,1787,209,1,0,0,0,1788,1789,5,4,0,0,1789,1794,3,212,
	106,0,1790,1791,5,5,0,0,1791,1793,3,212,106,0,1792,1790,1,0,0,0,1793,1796,
	1,0,0,0,1794,1792,1,0,0,0,1794,1795,1,0,0,0,1795,1798,1,0,0,0,1796,1794,
	1,0,0,0,1797,1799,5,5,0,0,1798,1797,1,0,0,0,1798,1799,1,0,0,0,1799,1800,
	1,0,0,0,1800,1801,5,6,0,0,1801,211,1,0,0,0,1802,1803,5,172,0,0,1803,1804,
	5,103,0,0,1804,1805,3,216,108,0,1805,213,1,0,0,0,1806,1807,5,40,0,0,1807,
	1812,3,228,114,0,1808,1809,5,5,0,0,1809,1811,3,228,114,0,1810,1808,1,0,
	0,0,1811,1814,1,0,0,0,1812,1810,1,0,0,0,1812,1813,1,0,0,0,1813,1816,1,0,
	0,0,1814,1812,1,0,0,0,1815,1817,5,5,0,0,1816,1815,1,0,0,0,1816,1817,1,0,
	0,0,1817,1818,1,0,0,0,1818,1819,5,41,0,0,1819,215,1,0,0,0,1820,1821,6,108,
	-1,0,1821,1822,5,40,0,0,1822,1823,3,216,108,0,1823,1824,5,41,0,0,1824,1950,
	1,0,0,0,1825,1826,3,230,115,0,1826,1827,5,40,0,0,1827,1829,3,216,108,0,
	1828,1830,5,5,0,0,1829,1828,1,0,0,0,1829,1830,1,0,0,0,1830,1831,1,0,0,0,
	1831,1832,5,41,0,0,1832,1950,1,0,0,0,1833,1950,3,204,102,0,1834,1835,5,
	111,0,0,1835,1837,5,172,0,0,1836,1838,3,210,105,0,1837,1836,1,0,0,0,1837,
	1838,1,0,0,0,1838,1839,1,0,0,0,1839,1950,3,208,104,0,1840,1841,5,111,0,
	0,1841,1842,3,228,114,0,1842,1843,5,58,0,0,1843,1844,5,59,0,0,1844,1845,
	5,40,0,0,1845,1846,3,216,108,0,1846,1847,5,41,0,0,1847,1950,1,0,0,0,1848,
	1849,5,47,0,0,1849,1850,5,40,0,0,1850,1851,3,228,114,0,1851,1852,5,41,0,
	0,1852,1853,5,12,0,0,1853,1854,5,172,0,0,1854,1950,1,0,0,0,1855,1856,5,
	112,0,0,1856,1950,3,208,104,0,1857,1858,5,113,0,0,1858,1950,3,208,104,0,
	1859,1860,5,114,0,0,1860,1950,3,208,104,0,1861,1862,5,115,0,0,1862,1950,
	3,208,104,0,1863,1864,5,116,0,0,1864,1865,5,40,0,0,1865,1866,5,172,0,0,
	1866,1867,5,12,0,0,1867,1868,5,172,0,0,1868,1869,5,5,0,0,1869,1870,3,208,
	104,0,1870,1871,5,41,0,0,1871,1950,1,0,0,0,1872,1873,5,117,0,0,1873,1950,
	3,208,104,0,1874,1875,5,118,0,0,1875,1950,3,208,104,0,1876,1877,5,119,0,
	0,1877,1878,5,40,0,0,1878,1879,3,216,108,0,1879,1880,5,5,0,0,1880,1881,
	3,214,107,0,1881,1882,5,41,0,0,1882,1950,1,0,0,0,1883,1884,5,120,0,0,1884,
	1885,5,40,0,0,1885,1886,3,216,108,0,1886,1887,5,5,0,0,1887,1888,3,214,107,
	0,1888,1889,5,5,0,0,1889,1890,5,155,0,0,1890,1891,5,41,0,0,1891,1950,1,
	0,0,0,1892,1893,5,121,0,0,1893,1894,5,58,0,0,1894,1895,3,216,108,0,1895,
	1896,5,59,0,0,1896,1897,7,9,0,0,1897,1950,1,0,0,0,1898,1899,5,127,0,0,1899,
	1900,5,58,0,0,1900,1901,3,216,108,0,1901,1902,5,59,0,0,1902,1903,7,10,0,
	0,1903,1950,1,0,0,0,1904,1905,7,11,0,0,1905,1950,3,216,108,21,1906,1918,
	5,58,0,0,1907,1912,3,216,108,0,1908,1909,5,5,0,0,1909,1911,3,216,108,0,
	1910,1908,1,0,0,0,1911,1914,1,0,0,0,1912,1910,1,0,0,0,1912,1913,1,0,0,0,
	1913,1916,1,0,0,0,1914,1912,1,0,0,0,1915,1917,5,5,0,0,1916,1915,1,0,0,0,
	1916,1917,1,0,0,0,1917,1919,1,0,0,0,1918,1907,1,0,0,0,1918,1919,1,0,0,0,
	1919,1920,1,0,0,0,1920,1950,5,59,0,0,1921,1922,5,71,0,0,1922,1923,5,12,
	0,0,1923,1924,5,172,0,0,1924,1925,5,12,0,0,1925,1926,5,172,0,0,1926,1927,
	5,58,0,0,1927,1928,3,216,108,0,1928,1929,5,59,0,0,1929,1930,3,218,109,0,
	1930,1950,1,0,0,0,1931,1932,5,71,0,0,1932,1933,5,12,0,0,1933,1938,5,172,
	0,0,1934,1935,5,58,0,0,1935,1936,3,216,108,0,1936,1937,5,59,0,0,1937,1939,
	1,0,0,0,1938,1934,1,0,0,0,1939,1940,1,0,0,0,1940,1938,1,0,0,0,1940,1941,
	1,0,0,0,1941,1950,1,0,0,0,1942,1943,5,71,0,0,1943,1944,5,12,0,0,1944,1950,
	5,172,0,0,1945,1950,5,71,0,0,1946,1950,5,169,0,0,1947,1950,5,172,0,0,1948,
	1950,3,222,111,0,1949,1820,1,0,0,0,1949,1825,1,0,0,0,1949,1833,1,0,0,0,
	1949,1834,1,0,0,0,1949,1840,1,0,0,0,1949,1848,1,0,0,0,1949,1855,1,0,0,0,
	1949,1857,1,0,0,0,1949,1859,1,0,0,0,1949,1861,1,0,0,0,1949,1863,1,0,0,0,
	1949,1872,1,0,0,0,1949,1874,1,0,0,0,1949,1876,1,0,0,0,1949,1883,1,0,0,0,
	1949,1892,1,0,0,0,1949,1898,1,0,0,0,1949,1904,1,0,0,0,1949,1906,1,0,0,0,
	1949,1921,1,0,0,0,1949,1931,1,0,0,0,1949,1942,1,0,0,0,1949,1945,1,0,0,0,
	1949,1946,1,0,0,0,1949,1947,1,0,0,0,1949,1948,1,0,0,0,1950,2056,1,0,0,0,
	1951,1952,10,20,0,0,1952,1953,5,17,0,0,1953,2055,3,216,108,20,1954,1955,
	10,19,0,0,1955,1956,7,12,0,0,1956,2055,3,216,108,20,1957,1958,10,18,0,0,
	1958,1959,7,13,0,0,1959,2055,3,216,108,19,1960,1961,10,17,0,0,1961,1962,
	7,14,0,0,1962,2055,3,216,108,18,1963,1964,10,16,0,0,1964,1965,7,15,0,0,
	1965,2055,3,216,108,17,1966,1967,10,15,0,0,1967,1968,7,16,0,0,1968,2055,
	3,216,108,16,1969,1970,10,14,0,0,1970,1971,5,24,0,0,1971,2055,3,216,108,
	15,1972,1973,10,13,0,0,1973,1974,5,26,0,0,1974,2055,3,216,108,14,1975,1976,
	10,12,0,0,1976,1977,5,25,0,0,1977,2055,3,216,108,13,1978,1979,10,11,0,0,
	1979,1980,5,139,0,0,1980,2055,3,216,108,12,1981,1982,10,10,0,0,1982,1983,
	5,140,0,0,1983,2055,3,216,108,11,1984,1985,10,9,0,0,1985,1986,5,141,0,0,
	1986,1987,3,216,108,0,1987,1988,5,103,0,0,1988,1989,3,216,108,9,1989,2055,
	1,0,0,0,1990,1991,10,32,0,0,1991,1992,5,58,0,0,1992,1993,3,216,108,0,1993,
	1994,5,103,0,0,1994,1995,3,216,108,0,1995,1996,5,59,0,0,1996,2055,1,0,0,
	0,1997,1998,10,31,0,0,1998,1999,5,58,0,0,1999,2000,5,155,0,0,2000,2055,
	5,59,0,0,2001,2002,10,30,0,0,2002,2003,5,58,0,0,2003,2004,3,216,108,0,2004,
	2005,5,59,0,0,2005,2055,1,0,0,0,2006,2007,10,27,0,0,2007,2055,7,17,0,0,
	2008,2009,10,26,0,0,2009,2010,5,134,0,0,2010,2011,5,40,0,0,2011,2012,3,
	216,108,0,2012,2013,5,41,0,0,2013,2055,1,0,0,0,2014,2015,10,25,0,0,2015,
	2016,5,135,0,0,2016,2017,5,40,0,0,2017,2018,3,216,108,0,2018,2019,5,5,0,
	0,2019,2020,3,216,108,0,2020,2021,5,41,0,0,2021,2055,1,0,0,0,2022,2023,
	10,24,0,0,2023,2024,5,12,0,0,2024,2026,5,172,0,0,2025,2027,3,210,105,0,
	2026,2025,1,0,0,0,2026,2027,1,0,0,0,2027,2028,1,0,0,0,2028,2029,5,40,0,
	0,2029,2041,5,4,0,0,2030,2035,3,206,103,0,2031,2032,5,5,0,0,2032,2034,3,
	206,103,0,2033,2031,1,0,0,0,2034,2037,1,0,0,0,2035,2033,1,0,0,0,2035,2036,
	1,0,0,0,2036,2039,1,0,0,0,2037,2035,1,0,0,0,2038,2040,5,5,0,0,2039,2038,
	1,0,0,0,2039,2040,1,0,0,0,2040,2042,1,0,0,0,2041,2030,1,0,0,0,2041,2042,
	1,0,0,0,2042,2043,1,0,0,0,2043,2044,5,6,0,0,2044,2055,5,41,0,0,2045,2046,
	10,23,0,0,2046,2047,5,12,0,0,2047,2049,5,172,0,0,2048,2050,3,210,105,0,
	2049,2048,1,0,0,0,2049,2050,1,0,0,0,2050,2051,1,0,0,0,2051,2055,3,208,104,
	0,2052,2053,10,22,0,0,2053,2055,3,218,109,0,2054,1951,1,0,0,0,2054,1954,
	1,0,0,0,2054,1957,1,0,0,0,2054,1960,1,0,0,0,2054,1963,1,0,0,0,2054,1966,
	1,0,0,0,2054,1969,1,0,0,0,2054,1972,1,0,0,0,2054,1975,1,0,0,0,2054,1978,
	1,0,0,0,2054,1981,1,0,0,0,2054,1984,1,0,0,0,2054,1990,1,0,0,0,2054,1997,
	1,0,0,0,2054,2001,1,0,0,0,2054,2006,1,0,0,0,2054,2008,1,0,0,0,2054,2014,
	1,0,0,0,2054,2022,1,0,0,0,2054,2045,1,0,0,0,2054,2052,1,0,0,0,2055,2058,
	1,0,0,0,2056,2054,1,0,0,0,2056,2057,1,0,0,0,2057,217,1,0,0,0,2058,2056,
	1,0,0,0,2059,2060,5,12,0,0,2060,2073,5,172,0,0,2061,2073,5,122,0,0,2062,
	2073,5,123,0,0,2063,2073,5,124,0,0,2064,2073,5,125,0,0,2065,2073,5,126,
	0,0,2066,2073,5,128,0,0,2067,2073,5,129,0,0,2068,2073,5,130,0,0,2069,2073,
	5,131,0,0,2070,2073,5,142,0,0,2071,2073,5,143,0,0,2072,2059,1,0,0,0,2072,
	2061,1,0,0,0,2072,2062,1,0,0,0,2072,2063,1,0,0,0,2072,2064,1,0,0,0,2072,
	2065,1,0,0,0,2072,2066,1,0,0,0,2072,2067,1,0,0,0,2072,2068,1,0,0,0,2072,
	2069,1,0,0,0,2072,2070,1,0,0,0,2072,2071,1,0,0,0,2073,219,1,0,0,0,2074,
	2075,7,18,0,0,2075,221,1,0,0,0,2076,2091,5,152,0,0,2077,2091,3,224,112,
	0,2078,2091,3,226,113,0,2079,2083,5,160,0,0,2080,2082,5,160,0,0,2081,2080,
	1,0,0,0,2082,2085,1,0,0,0,2083,2081,1,0,0,0,2083,2084,1,0,0,0,2084,2091,
	1,0,0,0,2085,2083,1,0,0,0,2086,2091,5,170,0,0,2087,2091,5,171,0,0,2088,
	2091,5,161,0,0,2089,2091,5,162,0,0,2090,2076,1,0,0,0,2090,2077,1,0,0,0,
	2090,2078,1,0,0,0,2090,2079,1,0,0,0,2090,2086,1,0,0,0,2090,2087,1,0,0,0,
	2090,2088,1,0,0,0,2090,2089,1,0,0,0,2091,223,1,0,0,0,2092,2094,5,155,0,
	0,2093,2095,5,153,0,0,2094,2093,1,0,0,0,2094,2095,1,0,0,0,2095,225,1,0,
	0,0,2096,2097,5,154,0,0,2097,227,1,0,0,0,2098,2099,5,148,0,0,2099,2142,
	5,52,0,0,2100,2142,5,148,0,0,2101,2142,5,156,0,0,2102,2142,5,158,0,0,2103,
	2142,5,157,0,0,2104,2142,5,165,0,0,2105,2142,5,166,0,0,2106,2142,5,149,
	0,0,2107,2142,5,150,0,0,2108,2142,5,167,0,0,2109,2142,5,168,0,0,2110,2111,
	5,7,0,0,2111,2120,5,40,0,0,2112,2117,3,228,114,0,2113,2114,5,5,0,0,2114,
	2116,3,228,114,0,2115,2113,1,0,0,0,2116,2119,1,0,0,0,2117,2115,1,0,0,0,
	2117,2118,1,0,0,0,2118,2121,1,0,0,0,2119,2117,1,0,0,0,2120,2112,1,0,0,0,
	2120,2121,1,0,0,0,2121,2122,1,0,0,0,2122,2135,5,41,0,0,2123,2124,5,70,0,
	0,2124,2125,5,40,0,0,2125,2130,3,228,114,0,2126,2127,5,5,0,0,2127,2129,
	3,228,114,0,2128,2126,1,0,0,0,2129,2132,1,0,0,0,2130,2128,1,0,0,0,2130,
	2131,1,0,0,0,2131,2133,1,0,0,0,2132,2130,1,0,0,0,2133,2134,5,41,0,0,2134,
	2136,1,0,0,0,2135,2123,1,0,0,0,2135,2136,1,0,0,0,2136,2142,1,0,0,0,2137,
	2138,5,172,0,0,2138,2139,5,12,0,0,2139,2142,5,172,0,0,2140,2142,5,172,0,
	0,2141,2098,1,0,0,0,2141,2100,1,0,0,0,2141,2101,1,0,0,0,2141,2102,1,0,0,
	0,2141,2103,1,0,0,0,2141,2104,1,0,0,0,2141,2105,1,0,0,0,2141,2106,1,0,0,
	0,2141,2107,1,0,0,0,2141,2108,1,0,0,0,2141,2109,1,0,0,0,2141,2110,1,0,0,
	0,2141,2137,1,0,0,0,2141,2140,1,0,0,0,2142,229,1,0,0,0,2143,2144,7,19,0,
	0,2144,231,1,0,0,0,220,235,241,253,255,260,279,283,290,295,303,307,313,
	323,326,336,340,346,349,353,358,362,375,378,392,395,401,407,413,419,425,
	431,437,452,467,471,481,487,493,499,505,511,517,523,529,534,542,545,562,
	564,575,581,585,597,601,603,607,613,625,629,631,645,661,665,672,690,695,
	702,713,719,726,734,745,754,760,771,778,784,791,797,803,807,815,820,828,
	838,843,847,859,868,870,876,882,889,900,906,910,916,923,939,948,952,958,
	967,971,979,983,991,995,997,1005,1014,1019,1025,1030,1062,1088,1102,1114,
	1118,1123,1128,1137,1141,1143,1165,1170,1176,1185,1194,1198,1200,1209,1214,
	1225,1229,1231,1244,1248,1254,1265,1278,1284,1292,1300,1310,1322,1332,1343,
	1350,1357,1367,1424,1428,1437,1447,1459,1467,1519,1535,1560,1572,1585,1589,
	1599,1607,1613,1619,1628,1632,1634,1640,1648,1652,1654,1657,1670,1676,1685,
	1689,1691,1700,1714,1724,1732,1736,1738,1756,1760,1762,1766,1778,1782,1784,
	1794,1798,1812,1816,1829,1837,1912,1916,1918,1940,1949,2026,2035,2039,2041,
	2049,2054,2056,2072,2083,2090,2094,2117,2120,2130,2135,2141];

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
