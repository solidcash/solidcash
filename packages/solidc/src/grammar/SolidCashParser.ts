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
	public static readonly VersionLiteral = 152;
	public static readonly BooleanLiteral = 153;
	public static readonly NumberUnit = 154;
	public static readonly BchUnit = 155;
	public static readonly DecimalLiteral = 156;
	public static readonly NumberLiteral = 157;
	public static readonly PrimitiveType = 158;
	public static readonly CryptoType = 159;
	public static readonly UnboundedBytes = 160;
	public static readonly BoundedBytes = 161;
	public static readonly Bound = 162;
	public static readonly StringLiteral = 163;
	public static readonly DateLiteral = 164;
	public static readonly HexLiteral = 165;
	public static readonly TxVar = 166;
	public static readonly UnsafeCast = 167;
	public static readonly BoundedSignedInt = 168;
	public static readonly BoundedUnsignedInt = 169;
	public static readonly BoundedSignedFixed = 170;
	public static readonly BoundedUnsignedFixed = 171;
	public static readonly NullaryOp = 172;
	public static readonly UnicodeLiteral = 173;
	public static readonly HexStringLiteral = 174;
	public static readonly Identifier = 175;
	public static readonly WHITESPACE = 176;
	public static readonly COMMENT = 177;
	public static readonly LINE_COMMENT = 178;
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
	public static readonly RULE_abstractFunctionDefinition = 20;
	public static readonly RULE_eventDefinition = 21;
	public static readonly RULE_eventParameter = 22;
	public static readonly RULE_errorDefinition = 23;
	public static readonly RULE_errorParameter = 24;
	public static readonly RULE_structDefinition = 25;
	public static readonly RULE_structField = 26;
	public static readonly RULE_enumDefinition = 27;
	public static readonly RULE_enumMember = 28;
	public static readonly RULE_typeDefinition = 29;
	public static readonly RULE_constantDefinition = 30;
	public static readonly RULE_constructorDefinition = 31;
	public static readonly RULE_fallbackDefinition = 32;
	public static readonly RULE_fallbackModifier = 33;
	public static readonly RULE_receiveDefinition = 34;
	public static readonly RULE_parentInvocation = 35;
	public static readonly RULE_stateVariableDeclaration = 36;
	public static readonly RULE_collectionModifier = 37;
	public static readonly RULE_stateVariableVisibility = 38;
	public static readonly RULE_mappingType = 39;
	public static readonly RULE_arrayType = 40;
	public static readonly RULE_modifierDefinition = 41;
	public static readonly RULE_modifierStatement = 42;
	public static readonly RULE_placeholderStatement = 43;
	public static readonly RULE_functionDefinition = 44;
	public static readonly RULE_customModifierInvocation = 45;
	public static readonly RULE_functionModifier = 46;
	public static readonly RULE_overrideSpecifier = 47;
	public static readonly RULE_unsafeModifier = 48;
	public static readonly RULE_returnType = 49;
	public static readonly RULE_returnParam = 50;
	public static readonly RULE_parameterList = 51;
	public static readonly RULE_parameter = 52;
	public static readonly RULE_block = 53;
	public static readonly RULE_statement = 54;
	public static readonly RULE_transferStatement = 55;
	public static readonly RULE_tokenContainerMethodStatement = 56;
	public static readonly RULE_returnStatement = 57;
	public static readonly RULE_functionCallStatement = 58;
	public static readonly RULE_addressMethodStatement = 59;
	public static readonly RULE_emitStatement = 60;
	public static readonly RULE_assignmentStatement = 61;
	public static readonly RULE_mappingDeleteStatement = 62;
	public static readonly RULE_variableDefinition = 63;
	public static readonly RULE_tupleAssignment = 64;
	public static readonly RULE_tupleSlot = 65;
	public static readonly RULE_assignStatement = 66;
	public static readonly RULE_arrayPushStatement = 67;
	public static readonly RULE_arrayPopStatement = 68;
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
                                                            "'>>='", "'.delete'", 
                                                            "'++'", "'--'", 
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
                                                             "VersionLiteral", 
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
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 237;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===37) {
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
			this.state = 258;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1842241) !== 0) || ((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 74980871) !== 0)) {
				{
				this.state = 256;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 2, this._ctx) ) {
				case 1:
					{
					this.state = 246;
					this.constantDefinition();
					}
					break;
				case 2:
					{
					this.state = 247;
					this.enumDefinition();
					}
					break;
				case 3:
					{
					this.state = 248;
					this.structDefinition();
					}
					break;
				case 4:
					{
					this.state = 249;
					this.typeDefinition();
					}
					break;
				case 5:
					{
					this.state = 250;
					this.usingForDirective();
					}
					break;
				case 6:
					{
					this.state = 251;
					this.errorDefinition();
					}
					break;
				case 7:
					{
					this.state = 252;
					this.interfaceDefinition();
					}
					break;
				case 8:
					{
					this.state = 253;
					this.freeFunctionDefinition();
					}
					break;
				case 9:
					{
					this.state = 254;
					this.libraryDefinition();
					}
					break;
				case 10:
					{
					this.state = 255;
					this.contractDefinition();
					}
					break;
				}
				}
				this.state = 260;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 261;
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
			this.state = 289;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 6, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 263;
				this.match(SolidCashParser.T__0);
				this.state = 264;
				this.match(SolidCashParser.StringLiteral);
				this.state = 265;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 266;
				this.match(SolidCashParser.T__0);
				this.state = 267;
				this.match(SolidCashParser.StringLiteral);
				this.state = 268;
				this.match(SolidCashParser.T__2);
				this.state = 269;
				this.match(SolidCashParser.Identifier);
				this.state = 270;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 271;
				this.match(SolidCashParser.T__0);
				this.state = 272;
				this.match(SolidCashParser.T__3);
				this.state = 273;
				this.importBinding();
				this.state = 278;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 274;
						this.match(SolidCashParser.T__4);
						this.state = 275;
						this.importBinding();
						}
						}
					}
					this.state = 280;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				}
				this.state = 282;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 281;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 284;
				this.match(SolidCashParser.T__5);
				this.state = 285;
				this.match(SolidCashParser.Identifier);
				this.state = 286;
				this.match(SolidCashParser.StringLiteral);
				this.state = 287;
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
			this.state = 291;
			this.match(SolidCashParser.Identifier);
			this.state = 294;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 292;
				this.match(SolidCashParser.T__2);
				this.state = 293;
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
			this.state = 296;
			this.match(SolidCashParser.T__6);
			this.state = 297;
			this.anyIdentifier();
			this.state = 298;
			this.parameterList();
			this.state = 302;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 299;
				this.functionModifier();
				}
				}
				this.state = 304;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 306;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 305;
				this.returnType();
				}
			}

			this.state = 308;
			this.match(SolidCashParser.T__3);
			this.state = 312;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
				{
				{
				this.state = 309;
				this.statement();
				}
				}
				this.state = 314;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 315;
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
			this.state = 352;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 17, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 317;
				this.match(SolidCashParser.T__7);
				this.state = 318;
				this.match(SolidCashParser.Identifier);
				this.state = 319;
				this.match(SolidCashParser.T__8);
				this.state = 322;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 7:
				case 149:
				case 150:
				case 151:
				case 158:
				case 159:
				case 160:
				case 161:
				case 168:
				case 169:
				case 170:
				case 171:
				case 175:
					{
					this.state = 320;
					this.typeName();
					}
					break;
				case 10:
					{
					this.state = 321;
					this.match(SolidCashParser.T__9);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 325;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 324;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 327;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 328;
				this.match(SolidCashParser.T__7);
				this.state = 329;
				this.match(SolidCashParser.T__3);
				this.state = 330;
				this.usingFunctionBinding();
				this.state = 335;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 331;
						this.match(SolidCashParser.T__4);
						this.state = 332;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 337;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				}
				this.state = 339;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 338;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 341;
				this.match(SolidCashParser.T__5);
				this.state = 342;
				this.match(SolidCashParser.T__8);
				this.state = 345;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 7:
				case 149:
				case 150:
				case 151:
				case 158:
				case 159:
				case 160:
				case 161:
				case 168:
				case 169:
				case 170:
				case 171:
				case 175:
					{
					this.state = 343;
					this.typeName();
					}
					break;
				case 10:
					{
					this.state = 344;
					this.match(SolidCashParser.T__9);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 348;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 347;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 350;
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
			this.state = 354;
			this.match(SolidCashParser.Identifier);
			this.state = 357;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===12) {
				{
				this.state = 355;
				this.match(SolidCashParser.T__11);
				this.state = 356;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 361;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 359;
				this.match(SolidCashParser.T__2);
				this.state = 360;
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
			this.state = 363;
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
			this.state = 365;
			_la = this._input.LA(1);
			if(!(((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 155)) & ~0x1F) === 0 && ((1 << (_la - 155)) & 1048593) !== 0))) {
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
			this.state = 367;
			this.match(SolidCashParser.T__36);
			this.state = 368;
			this.pragmaName();
			this.state = 369;
			this.pragmaValue();
			this.state = 370;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 372;
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
			this.state = 374;
			this.versionConstraint();
			this.state = 376;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0) || _la===152) {
				{
				this.state = 375;
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
			this.state = 379;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0)) {
				{
				this.state = 378;
				this.versionOperator();
				}
			}

			this.state = 381;
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
			this.state = 383;
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
			this.state = 385;
			this.match(SolidCashParser.T__40);
			this.state = 386;
			this.match(SolidCashParser.Identifier);
			this.state = 396;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 387;
				this.match(SolidCashParser.T__41);
				this.state = 388;
				this.match(SolidCashParser.Identifier);
				this.state = 393;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 389;
					this.match(SolidCashParser.T__4);
					this.state = 390;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 395;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 398;
			this.match(SolidCashParser.T__3);
			this.state = 409;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1843969) !== 0)) {
				{
				this.state = 407;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 24, this._ctx) ) {
				case 1:
					{
					this.state = 399;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 400;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 401;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 402;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 403;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 404;
					this.interfaceStateVariable();
					}
					break;
				case 7:
					{
					this.state = 405;
					this.interfaceCollection();
					}
					break;
				case 8:
					{
					this.state = 406;
					this.interfaceFunction();
					}
					break;
				}
				}
				this.state = 411;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 412;
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
			this.state = 424;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 26, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 414;
				this.interfaceStateVariableVisibility();
				this.state = 415;
				this.mappingType();
				this.state = 416;
				this.match(SolidCashParser.Identifier);
				this.state = 417;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 419;
				this.interfaceStateVariableVisibility();
				this.state = 420;
				this.arrayType(0);
				this.state = 421;
				this.match(SolidCashParser.Identifier);
				this.state = 422;
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
			this.state = 426;
			this.interfaceStateVariableVisibility();
			this.state = 427;
			this.typeName();
			this.state = 428;
			this.match(SolidCashParser.Identifier);
			this.state = 429;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 431;
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
			this.state = 433;
			this.match(SolidCashParser.T__6);
			this.state = 434;
			this.match(SolidCashParser.Identifier);
			this.state = 435;
			this.parameterList();
			this.state = 439;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 436;
				this.functionModifier();
				}
				}
				this.state = 441;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 443;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 442;
				this.returnType();
				}
			}

			this.state = 445;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 447;
			this.match(SolidCashParser.T__44);
			this.state = 448;
			this.match(SolidCashParser.Identifier);
			this.state = 449;
			this.match(SolidCashParser.T__3);
			this.state = 453;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===54) {
				{
				{
				this.state = 450;
				this.enumDefinition();
				}
				}
				this.state = 455;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 459;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===53) {
				{
				{
				this.state = 456;
				this.structDefinition();
				}
				}
				this.state = 461;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 465;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===55) {
				{
				{
				this.state = 462;
				this.typeDefinition();
				}
				}
				this.state = 467;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 471;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===48) {
				{
				{
				this.state = 468;
				this.eventDefinition();
				}
				}
				this.state = 473;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 477;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===35) {
				{
				{
				this.state = 474;
				this.errorDefinition();
				}
				}
				this.state = 479;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 483;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 34, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 480;
					this.constantDefinition();
					}
					}
				}
				this.state = 485;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 34, this._ctx);
			}
			this.state = 489;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===8) {
				{
				{
				this.state = 486;
				this.usingForDirective();
				}
				}
				this.state = 491;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 495;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 492;
				this.freeFunctionDefinition();
				}
				}
				this.state = 497;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 498;
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
			this.state = 501;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===46) {
				{
				this.state = 500;
				this.match(SolidCashParser.T__45);
				}
			}

			this.state = 503;
			this.match(SolidCashParser.T__46);
			this.state = 504;
			this.match(SolidCashParser.Identifier);
			this.state = 506;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 505;
				this.parameterList();
				}
			}

			this.state = 517;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 508;
				this.match(SolidCashParser.T__41);
				this.state = 509;
				this.match(SolidCashParser.Identifier);
				this.state = 514;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 510;
					this.match(SolidCashParser.T__4);
					this.state = 511;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 516;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 519;
			this.match(SolidCashParser.T__3);
			this.state = 536;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 268435459) !== 0) || ((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 37411875) !== 0) || ((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 74980871) !== 0)) {
				{
				this.state = 534;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 41, this._ctx) ) {
				case 1:
					{
					this.state = 520;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 521;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 522;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 523;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 524;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 525;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 526;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 527;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 528;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 529;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 530;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 531;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 532;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 533;
					this.receiveDefinition();
					}
					break;
				}
				}
				this.state = 538;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 539;
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
		this.enterRule(localctx, 40, SolidCashParser.RULE_abstractFunctionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 541;
			this.match(SolidCashParser.T__6);
			this.state = 542;
			this.anyIdentifier();
			this.state = 543;
			this.parameterList();
			this.state = 547;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 544;
				this.functionModifier();
				}
				}
				this.state = 549;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 553;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===175) {
				{
				{
				this.state = 550;
				this.customModifierInvocation();
				}
				}
				this.state = 555;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 557;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 556;
				this.returnType();
				}
			}

			this.state = 559;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 42, SolidCashParser.RULE_eventDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 561;
			this.match(SolidCashParser.T__47);
			this.state = 562;
			this.match(SolidCashParser.Identifier);
			this.state = 563;
			this.match(SolidCashParser.T__48);
			this.state = 575;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 74980871) !== 0)) {
				{
				this.state = 564;
				this.eventParameter();
				this.state = 569;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 46, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 565;
						this.match(SolidCashParser.T__4);
						this.state = 566;
						this.eventParameter();
						}
						}
					}
					this.state = 571;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 46, this._ctx);
				}
				this.state = 573;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 572;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 577;
			this.match(SolidCashParser.T__49);
			this.state = 579;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===51) {
				{
				this.state = 578;
				this.match(SolidCashParser.T__50);
				}
			}

			this.state = 581;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 44, SolidCashParser.RULE_eventParameter);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 583;
			this.typeName();
			this.state = 585;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===52) {
				{
				this.state = 584;
				this.match(SolidCashParser.T__51);
				}
			}

			this.state = 587;
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
		this.enterRule(localctx, 46, SolidCashParser.RULE_errorDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 589;
			this.match(SolidCashParser.T__34);
			this.state = 590;
			this.match(SolidCashParser.Identifier);
			this.state = 591;
			this.match(SolidCashParser.T__48);
			this.state = 603;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 74980871) !== 0)) {
				{
				this.state = 592;
				this.errorParameter();
				this.state = 597;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 593;
						this.match(SolidCashParser.T__4);
						this.state = 594;
						this.errorParameter();
						}
						}
					}
					this.state = 599;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
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
			this.match(SolidCashParser.T__49);
			this.state = 606;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 48, SolidCashParser.RULE_errorParameter);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 608;
			this.typeName();
			this.state = 609;
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
		this.enterRule(localctx, 50, SolidCashParser.RULE_structDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 611;
			this.match(SolidCashParser.T__52);
			this.state = 612;
			this.match(SolidCashParser.Identifier);
			this.state = 613;
			this.match(SolidCashParser.T__3);
			this.state = 615;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 614;
				this.structField();
				}
				}
				this.state = 617;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || ((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 74980871) !== 0));
			this.state = 619;
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
		this.enterRule(localctx, 52, SolidCashParser.RULE_structField);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 623;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 55, this._ctx) ) {
			case 1:
				{
				this.state = 621;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 622;
				this.arrayType(0);
				}
				break;
			}
			this.state = 625;
			this.anyIdentifier();
			this.state = 626;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 54, SolidCashParser.RULE_enumDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 628;
			this.match(SolidCashParser.T__53);
			this.state = 629;
			this.match(SolidCashParser.Identifier);
			this.state = 630;
			this.match(SolidCashParser.T__3);
			this.state = 631;
			this.enumMember();
			this.state = 636;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 56, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 632;
					this.match(SolidCashParser.T__4);
					this.state = 633;
					this.enumMember();
					}
					}
				}
				this.state = 638;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 56, this._ctx);
			}
			this.state = 640;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 639;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 642;
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
		this.enterRule(localctx, 56, SolidCashParser.RULE_enumMember);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 644;
			this.match(SolidCashParser.Identifier);
			this.state = 647;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 645;
				this.match(SolidCashParser.T__39);
				this.state = 646;
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
		this.enterRule(localctx, 58, SolidCashParser.RULE_typeDefinition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 649;
			this.match(SolidCashParser.T__54);
			this.state = 650;
			this.match(SolidCashParser.Identifier);
			this.state = 651;
			this.match(SolidCashParser.T__41);
			this.state = 652;
			this.typeName();
			this.state = 653;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 60, SolidCashParser.RULE_constantDefinition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 655;
			this.typeName();
			this.state = 656;
			this.match(SolidCashParser.T__55);
			this.state = 657;
			this.match(SolidCashParser.Identifier);
			this.state = 658;
			this.match(SolidCashParser.T__39);
			this.state = 659;
			this.expression(0);
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
	public constructorDefinition(): ConstructorDefinitionContext {
		let localctx: ConstructorDefinitionContext = new ConstructorDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 62, SolidCashParser.RULE_constructorDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 662;
			this.match(SolidCashParser.T__56);
			this.state = 663;
			this.parameterList();
			this.state = 667;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 98307) !== 0)) {
				{
				{
				this.state = 664;
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
				this.state = 669;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 673;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===175) {
				{
				{
				this.state = 670;
				this.parentInvocation();
				}
				}
				this.state = 675;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 676;
			this.match(SolidCashParser.T__3);
			this.state = 680;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
				{
				{
				this.state = 677;
				this.statement();
				}
				}
				this.state = 682;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 683;
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
		this.enterRule(localctx, 64, SolidCashParser.RULE_fallbackDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 685;
			this.match(SolidCashParser.T__59);
			this.state = 686;
			this.parameterList();
			this.state = 687;
			this.match(SolidCashParser.T__43);
			this.state = 691;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 8197) !== 0)) {
				{
				{
				this.state = 688;
				this.fallbackModifier();
				}
				}
				this.state = 693;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 697;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===175) {
				{
				{
				this.state = 694;
				this.customModifierInvocation();
				}
				}
				this.state = 699;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 700;
			this.match(SolidCashParser.T__3);
			this.state = 704;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
				{
				{
				this.state = 701;
				this.statement();
				}
				}
				this.state = 706;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 707;
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
		this.enterRule(localctx, 66, SolidCashParser.RULE_fallbackModifier);
		try {
			this.state = 712;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 59:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 709;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 710;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 711;
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
		this.enterRule(localctx, 68, SolidCashParser.RULE_receiveDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 714;
			this.match(SolidCashParser.T__61);
			this.state = 715;
			this.match(SolidCashParser.T__48);
			this.state = 716;
			this.match(SolidCashParser.T__49);
			this.state = 717;
			this.match(SolidCashParser.T__43);
			this.state = 718;
			this.match(SolidCashParser.T__58);
			this.state = 719;
			this.match(SolidCashParser.T__3);
			this.state = 723;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
				{
				{
				this.state = 720;
				this.statement();
				}
				}
				this.state = 725;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 726;
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
		this.enterRule(localctx, 70, SolidCashParser.RULE_parentInvocation);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 728;
			this.match(SolidCashParser.Identifier);
			this.state = 729;
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
		this.enterRule(localctx, 72, SolidCashParser.RULE_stateVariableDeclaration);
		let _la: number;
		try {
			this.state = 793;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 77, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 732;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 731;
					this.stateVariableVisibility();
					}
				}

				this.state = 734;
				this.typeName();
				this.state = 738;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 15) !== 0)) {
					{
					{
					this.state = 735;
					this.modifier();
					}
					}
					this.state = 740;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 741;
				this.match(SolidCashParser.Identifier);
				this.state = 744;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 742;
					this.match(SolidCashParser.T__39);
					this.state = 743;
					this.expression(0);
					}
				}

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
				while (_la===33 || _la===56 || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 15) !== 0)) {
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
				this.state = 759;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 757;
					this.match(SolidCashParser.T__39);
					this.state = 758;
					this.expression(0);
					}
				}

				this.state = 761;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 764;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 763;
					this.stateVariableVisibility();
					}
				}

				this.state = 766;
				this.mappingType();
				this.state = 770;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 15) !== 0)) {
					{
					{
					this.state = 767;
					this.collectionModifier();
					}
					}
					this.state = 772;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 773;
				this.match(SolidCashParser.Identifier);
				this.state = 774;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 777;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 776;
					this.stateVariableVisibility();
					}
				}

				this.state = 779;
				this.arrayType(0);
				this.state = 783;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 15) !== 0)) {
					{
					{
					this.state = 780;
					this.collectionModifier();
					}
					}
					this.state = 785;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 786;
				this.match(SolidCashParser.Identifier);
				this.state = 789;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 787;
					this.match(SolidCashParser.T__39);
					this.state = 788;
					this.expression(0);
					}
				}

				this.state = 791;
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
		this.enterRule(localctx, 74, SolidCashParser.RULE_collectionModifier);
		try {
			this.state = 797;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 33:
			case 56:
			case 145:
			case 146:
			case 147:
			case 148:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 795;
				this.modifier();
				}
				break;
			case 43:
			case 44:
			case 58:
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 796;
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
		this.enterRule(localctx, 76, SolidCashParser.RULE_stateVariableVisibility);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 799;
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
		this.enterRule(localctx, 78, SolidCashParser.RULE_mappingType);
		let _la: number;
		try {
			this.state = 837;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 84, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 801;
				this.match(SolidCashParser.T__63);
				this.state = 802;
				this.match(SolidCashParser.T__48);
				this.state = 803;
				this.typeName();
				this.state = 805;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===175) {
					{
					this.state = 804;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 807;
				this.match(SolidCashParser.T__64);
				this.state = 808;
				this.typeName();
				this.state = 810;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===175) {
					{
					this.state = 809;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 812;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 814;
				this.match(SolidCashParser.T__63);
				this.state = 815;
				this.match(SolidCashParser.T__48);
				this.state = 816;
				this.typeName();
				this.state = 818;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===175) {
					{
					this.state = 817;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 820;
				this.match(SolidCashParser.T__64);
				this.state = 821;
				this.mappingType();
				this.state = 822;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 824;
				this.match(SolidCashParser.T__63);
				this.state = 825;
				this.match(SolidCashParser.T__48);
				this.state = 826;
				this.typeName();
				this.state = 828;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===175) {
					{
					this.state = 827;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 830;
				this.match(SolidCashParser.T__64);
				this.state = 831;
				this.arrayType(0);
				this.state = 833;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===175) {
					{
					this.state = 832;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 835;
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
		let _startState: number = 80;
		this.enterRecursionRule(localctx, 80, SolidCashParser.RULE_arrayType, _p);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 849;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 85, this._ctx) ) {
			case 1:
				{
				this.state = 840;
				this.typeName();
				this.state = 841;
				this.match(SolidCashParser.T__65);
				this.state = 842;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 843;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 2:
				{
				this.state = 845;
				this.typeName();
				this.state = 846;
				this.match(SolidCashParser.T__65);
				this.state = 847;
				this.match(SolidCashParser.T__66);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 860;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 87, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 858;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 86, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 851;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 852;
						this.match(SolidCashParser.T__65);
						this.state = 853;
						this.match(SolidCashParser.NumberLiteral);
						this.state = 854;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 855;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 856;
						this.match(SolidCashParser.T__65);
						this.state = 857;
						this.match(SolidCashParser.T__66);
						}
						break;
					}
					}
				}
				this.state = 862;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 87, this._ctx);
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
		this.enterRule(localctx, 82, SolidCashParser.RULE_modifierDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 863;
			this.match(SolidCashParser.T__67);
			this.state = 864;
			this.match(SolidCashParser.Identifier);
			this.state = 866;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 865;
				this.parameterList();
				}
			}

			this.state = 868;
			this.match(SolidCashParser.T__3);
			this.state = 872;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
				{
				{
				this.state = 869;
				this.modifierStatement();
				}
				}
				this.state = 874;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 875;
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
		this.enterRule(localctx, 84, SolidCashParser.RULE_modifierStatement);
		try {
			this.state = 879;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 69:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 877;
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
			case 88:
			case 89:
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
			case 149:
			case 150:
			case 151:
			case 153:
			case 155:
			case 156:
			case 157:
			case 158:
			case 159:
			case 160:
			case 161:
			case 163:
			case 164:
			case 165:
			case 167:
			case 168:
			case 169:
			case 170:
			case 171:
			case 172:
			case 173:
			case 174:
			case 175:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 878;
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
		this.enterRule(localctx, 86, SolidCashParser.RULE_placeholderStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 881;
			this.match(SolidCashParser.T__68);
			this.state = 882;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 88, SolidCashParser.RULE_functionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 884;
			this.match(SolidCashParser.T__6);
			this.state = 885;
			this.anyIdentifier();
			this.state = 886;
			this.parameterList();
			this.state = 890;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 887;
				this.functionModifier();
				}
				}
				this.state = 892;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 896;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===175) {
				{
				{
				this.state = 893;
				this.customModifierInvocation();
				}
				}
				this.state = 898;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 900;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 899;
				this.returnType();
				}
			}

			this.state = 902;
			this.match(SolidCashParser.T__3);
			this.state = 906;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
				{
				{
				this.state = 903;
				this.statement();
				}
				}
				this.state = 908;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 909;
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
		this.enterRule(localctx, 90, SolidCashParser.RULE_customModifierInvocation);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 911;
			this.match(SolidCashParser.Identifier);
			this.state = 913;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 912;
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
		this.enterRule(localctx, 92, SolidCashParser.RULE_functionModifier);
		try {
			this.state = 929;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 70:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 915;
				this.match(SolidCashParser.T__69);
				}
				break;
			case 71:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 916;
				this.match(SolidCashParser.T__70);
				}
				break;
			case 58:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 917;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 44:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 918;
				this.match(SolidCashParser.T__43);
				}
				break;
			case 43:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 919;
				this.match(SolidCashParser.T__42);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 920;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 59:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 921;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 922;
				this.overrideSpecifier();
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 923;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 924;
				this.unsafeModifier();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 925;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 926;
				this.match(SolidCashParser.T__27);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 927;
				this.match(SolidCashParser.T__30);
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 928;
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
		this.enterRule(localctx, 94, SolidCashParser.RULE_overrideSpecifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 931;
			this.match(SolidCashParser.T__71);
			this.state = 942;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 932;
				this.match(SolidCashParser.T__48);
				this.state = 933;
				this.match(SolidCashParser.Identifier);
				this.state = 938;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 934;
					this.match(SolidCashParser.T__4);
					this.state = 935;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 940;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 941;
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
		this.enterRule(localctx, 96, SolidCashParser.RULE_unsafeModifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 944;
			this.match(SolidCashParser.T__31);
			this.state = 948;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 945;
				this.match(SolidCashParser.T__48);
				this.state = 946;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 947;
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
		this.enterRule(localctx, 98, SolidCashParser.RULE_returnType);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 950;
			this.match(SolidCashParser.T__72);
			this.state = 951;
			this.match(SolidCashParser.T__48);
			this.state = 952;
			this.returnParam();
			this.state = 957;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 100, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 953;
					this.match(SolidCashParser.T__4);
					this.state = 954;
					this.returnParam();
					}
					}
				}
				this.state = 959;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 100, this._ctx);
			}
			this.state = 961;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 960;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 963;
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
		this.enterRule(localctx, 100, SolidCashParser.RULE_returnParam);
		let _la: number;
		try {
			let _alt: number;
			this.state = 985;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 106, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 965;
				this.typeName();
				this.state = 969;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 102, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 966;
						this.modifier();
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
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 155)) & ~0x1F) === 0 && ((1 << (_la - 155)) & 1048593) !== 0)) {
					{
					this.state = 972;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 975;
				this.arrayType(0);
				this.state = 979;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 104, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 976;
						this.modifier();
						}
						}
					}
					this.state = 981;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 104, this._ctx);
				}
				this.state = 983;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 155)) & ~0x1F) === 0 && ((1 << (_la - 155)) & 1048593) !== 0)) {
					{
					this.state = 982;
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
		this.enterRule(localctx, 102, SolidCashParser.RULE_parameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 987;
			this.match(SolidCashParser.T__48);
			this.state = 999;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 74980871) !== 0)) {
				{
				this.state = 988;
				this.parameter();
				this.state = 993;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 107, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 989;
						this.match(SolidCashParser.T__4);
						this.state = 990;
						this.parameter();
						}
						}
					}
					this.state = 995;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 107, this._ctx);
				}
				this.state = 997;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 996;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1001;
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
		this.enterRule(localctx, 104, SolidCashParser.RULE_parameter);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1023;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 114, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1003;
				this.typeName();
				this.state = 1007;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 110, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1004;
						this.modifier();
						}
						}
					}
					this.state = 1009;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 110, this._ctx);
				}
				this.state = 1011;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 155)) & ~0x1F) === 0 && ((1 << (_la - 155)) & 1048593) !== 0)) {
					{
					this.state = 1010;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1013;
				this.arrayType(0);
				this.state = 1017;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 112, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1014;
						this.modifier();
						}
						}
					}
					this.state = 1019;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 112, this._ctx);
				}
				this.state = 1021;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 155)) & ~0x1F) === 0 && ((1 << (_la - 155)) & 1048593) !== 0)) {
					{
					this.state = 1020;
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
		this.enterRule(localctx, 106, SolidCashParser.RULE_block);
		let _la: number;
		try {
			this.state = 1034;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1025;
				this.match(SolidCashParser.T__3);
				this.state = 1029;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
					{
					{
					this.state = 1026;
					this.statement();
					}
					}
					this.state = 1031;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1032;
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
			case 88:
			case 89:
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
			case 149:
			case 150:
			case 151:
			case 153:
			case 155:
			case 156:
			case 157:
			case 158:
			case 159:
			case 160:
			case 161:
			case 163:
			case 164:
			case 165:
			case 167:
			case 168:
			case 169:
			case 170:
			case 171:
			case 172:
			case 173:
			case 174:
			case 175:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1033;
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
		this.enterRule(localctx, 108, SolidCashParser.RULE_statement);
		try {
			this.state = 1066;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 117, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1036;
				this.variableDefinition();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1037;
				this.tupleAssignment();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1038;
				this.arrayPushStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1039;
				this.arrayPopStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1040;
				this.arrayDeleteStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1041;
				this.stateArrayPushStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1042;
				this.stateArrayPopStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1043;
				this.assignStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1044;
				this.assignmentStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1045;
				this.mappingDeleteStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1046;
				this.timeOpStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1047;
				this.requireStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1048;
				this.ifStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1049;
				this.loopStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1050;
				this.consoleStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1051;
				this.emitStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1052;
				this.transferStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1053;
				this.tokenContainerMethodStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1054;
				this.returnStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1055;
				this.functionCallStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1056;
				this.addressMethodStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1057;
				this.assemblyStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1058;
				this.tryCatchStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1059;
				this.revertStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1060;
				this.assertStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1061;
				this.deleteStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1062;
				this.uncheckedStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1063;
				this.switchStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1064;
				this.breakStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1065;
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
		this.enterRule(localctx, 110, SolidCashParser.RULE_transferStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1068;
			this.match(SolidCashParser.T__73);
			this.state = 1069;
			this.match(SolidCashParser.T__11);
			this.state = 1070;
			this.match(SolidCashParser.Identifier);
			this.state = 1071;
			this.match(SolidCashParser.T__48);
			this.state = 1072;
			this.expression(0);
			this.state = 1073;
			this.match(SolidCashParser.T__4);
			this.state = 1074;
			this.expression(0);
			this.state = 1075;
			this.match(SolidCashParser.T__49);
			this.state = 1076;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 112, SolidCashParser.RULE_tokenContainerMethodStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1078;
			this.match(SolidCashParser.T__73);
			this.state = 1079;
			this.match(SolidCashParser.T__11);
			this.state = 1080;
			this.match(SolidCashParser.Identifier);
			this.state = 1081;
			this.match(SolidCashParser.T__65);
			this.state = 1082;
			this.expression(0);
			this.state = 1083;
			this.match(SolidCashParser.T__66);
			this.state = 1084;
			this.match(SolidCashParser.T__11);
			this.state = 1085;
			this.match(SolidCashParser.Identifier);
			this.state = 1086;
			this.match(SolidCashParser.T__48);
			this.state = 1087;
			this.expression(0);
			this.state = 1092;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1088;
				this.match(SolidCashParser.T__4);
				this.state = 1089;
				this.expression(0);
				}
				}
				this.state = 1094;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1095;
			this.match(SolidCashParser.T__49);
			this.state = 1096;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 114, SolidCashParser.RULE_returnStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1127;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 122, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1098;
				this.match(SolidCashParser.T__74);
				this.state = 1099;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1100;
				this.match(SolidCashParser.T__74);
				this.state = 1101;
				this.expression(0);
				this.state = 1106;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1102;
					this.match(SolidCashParser.T__4);
					this.state = 1103;
					this.expression(0);
					}
					}
					this.state = 1108;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1109;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1111;
				this.match(SolidCashParser.T__74);
				this.state = 1112;
				this.match(SolidCashParser.T__48);
				this.state = 1113;
				this.expression(0);
				this.state = 1118;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 120, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1114;
						this.match(SolidCashParser.T__4);
						this.state = 1115;
						this.expression(0);
						}
						}
					}
					this.state = 1120;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 120, this._ctx);
				}
				this.state = 1122;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1121;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1124;
				this.match(SolidCashParser.T__49);
				this.state = 1125;
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
		this.enterRule(localctx, 116, SolidCashParser.RULE_functionCallStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1174;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 128, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1129;
				this.match(SolidCashParser.Identifier);
				this.state = 1132;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1130;
					this.match(SolidCashParser.T__11);
					this.state = 1131;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1134;
				this.match(SolidCashParser.T__48);
				this.state = 1135;
				this.match(SolidCashParser.T__3);
				this.state = 1147;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===175) {
					{
					this.state = 1136;
					this.namedArg();
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
							this.namedArg();
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

					}
				}

				this.state = 1149;
				this.match(SolidCashParser.T__5);
				this.state = 1150;
				this.match(SolidCashParser.T__49);
				this.state = 1151;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1152;
				this.match(SolidCashParser.Identifier);
				this.state = 1153;
				this.expressionList();
				this.state = 1154;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1156;
				this.match(SolidCashParser.Identifier);
				this.state = 1157;
				this.match(SolidCashParser.T__11);
				this.state = 1158;
				this.match(SolidCashParser.Identifier);
				this.state = 1159;
				this.expressionList();
				this.state = 1160;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1162;
				this.match(SolidCashParser.Identifier);
				this.state = 1163;
				this.expressionList();
				this.state = 1164;
				this.match(SolidCashParser.T__11);
				this.state = 1165;
				this.match(SolidCashParser.Identifier);
				this.state = 1166;
				this.match(SolidCashParser.T__11);
				this.state = 1167;
				this.match(SolidCashParser.Identifier);
				this.state = 1169;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1168;
					this.callOptions();
					}
				}

				this.state = 1171;
				this.expressionList();
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
	public addressMethodStatement(): AddressMethodStatementContext {
		let localctx: AddressMethodStatementContext = new AddressMethodStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 118, SolidCashParser.RULE_addressMethodStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1176;
			this.expression(0);
			this.state = 1177;
			this.match(SolidCashParser.T__11);
			this.state = 1178;
			this.match(SolidCashParser.Identifier);
			this.state = 1180;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===4) {
				{
				this.state = 1179;
				this.callOptions();
				}
			}

			this.state = 1182;
			this.expressionList();
			this.state = 1183;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 120, SolidCashParser.RULE_emitStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1218;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 135, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1185;
				this.match(SolidCashParser.T__75);
				this.state = 1186;
				this.match(SolidCashParser.Identifier);
				this.state = 1189;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1187;
					this.match(SolidCashParser.T__11);
					this.state = 1188;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1191;
				this.match(SolidCashParser.T__48);
				this.state = 1192;
				this.match(SolidCashParser.T__3);
				this.state = 1204;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===175) {
					{
					this.state = 1193;
					this.namedArg();
					this.state = 1198;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 131, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1194;
							this.match(SolidCashParser.T__4);
							this.state = 1195;
							this.namedArg();
							}
							}
						}
						this.state = 1200;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 131, this._ctx);
					}
					this.state = 1202;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1201;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1206;
				this.match(SolidCashParser.T__5);
				this.state = 1207;
				this.match(SolidCashParser.T__49);
				this.state = 1208;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1209;
				this.match(SolidCashParser.T__75);
				this.state = 1210;
				this.match(SolidCashParser.Identifier);
				this.state = 1213;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1211;
					this.match(SolidCashParser.T__11);
					this.state = 1212;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1215;
				this.expressionList();
				this.state = 1216;
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
		this.enterRule(localctx, 122, SolidCashParser.RULE_assignmentStatement);
		let _la: number;
		try {
			this.state = 1275;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 142, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1220;
				this.match(SolidCashParser.T__73);
				this.state = 1221;
				this.match(SolidCashParser.T__11);
				this.state = 1222;
				this.match(SolidCashParser.Identifier);
				this.state = 1231;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===66) {
					{
					this.state = 1227;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1223;
						this.match(SolidCashParser.T__65);
						this.state = 1224;
						this.expression(0);
						this.state = 1225;
						this.match(SolidCashParser.T__66);
						}
						}
						this.state = 1229;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===66);
					}
				}

				this.state = 1237;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12) {
					{
					{
					this.state = 1233;
					this.match(SolidCashParser.T__11);
					this.state = 1234;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1239;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1240;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
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
				this.match(SolidCashParser.Identifier);
				this.state = 1249;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1245;
					this.match(SolidCashParser.T__65);
					this.state = 1246;
					this.expression(0);
					this.state = 1247;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1251;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1257;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12) {
					{
					{
					this.state = 1253;
					this.match(SolidCashParser.T__11);
					this.state = 1254;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1259;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1260;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1261;
				this.expression(0);
				this.state = 1262;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1264;
				this.match(SolidCashParser.Identifier);
				this.state = 1267;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1265;
					this.match(SolidCashParser.T__11);
					this.state = 1266;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1269;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1271;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1272;
				this.expression(0);
				this.state = 1273;
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
		this.enterRule(localctx, 124, SolidCashParser.RULE_mappingDeleteStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1277;
			this.match(SolidCashParser.T__73);
			this.state = 1278;
			this.match(SolidCashParser.T__11);
			this.state = 1279;
			this.match(SolidCashParser.Identifier);
			this.state = 1286;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===66) {
				{
				{
				this.state = 1280;
				this.match(SolidCashParser.T__65);
				this.state = 1281;
				this.expression(0);
				this.state = 1282;
				this.match(SolidCashParser.T__66);
				}
				}
				this.state = 1288;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1289;
			this.match(SolidCashParser.T__86);
			this.state = 1290;
			this.match(SolidCashParser.T__48);
			this.state = 1291;
			this.expression(0);
			this.state = 1292;
			this.match(SolidCashParser.T__49);
			this.state = 1293;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 126, SolidCashParser.RULE_variableDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1323;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 148, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1295;
				this.typeName();
				this.state = 1299;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 144, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1296;
						this.modifier();
						}
						}
					}
					this.state = 1301;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 144, this._ctx);
				}
				this.state = 1302;
				this.anyIdentifier();
				this.state = 1305;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1303;
					this.match(SolidCashParser.T__39);
					this.state = 1304;
					this.expression(0);
					}
				}

				this.state = 1307;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1309;
				this.arrayType(0);
				this.state = 1313;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 146, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1310;
						this.modifier();
						}
						}
					}
					this.state = 1315;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 146, this._ctx);
				}
				this.state = 1316;
				this.anyIdentifier();
				this.state = 1319;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1317;
					this.match(SolidCashParser.T__39);
					this.state = 1318;
					this.expression(0);
					}
				}

				this.state = 1321;
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
		this.enterRule(localctx, 128, SolidCashParser.RULE_tupleAssignment);
		let _la: number;
		try {
			this.state = 1373;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 153, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1325;
				this.typeName();
				this.state = 1326;
				this.match(SolidCashParser.Identifier);
				this.state = 1331;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1327;
					this.match(SolidCashParser.T__4);
					this.state = 1328;
					this.typeName();
					this.state = 1329;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1333;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1335;
				this.match(SolidCashParser.T__39);
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
				this.match(SolidCashParser.T__48);
				this.state = 1340;
				this.tupleSlot();
				this.state = 1343;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1341;
					this.match(SolidCashParser.T__4);
					this.state = 1342;
					this.tupleSlot();
					}
					}
					this.state = 1345;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1347;
				this.match(SolidCashParser.T__49);
				this.state = 1348;
				this.match(SolidCashParser.T__39);
				this.state = 1349;
				this.match(SolidCashParser.T__48);
				this.state = 1350;
				this.expression(0);
				this.state = 1353;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1351;
					this.match(SolidCashParser.T__4);
					this.state = 1352;
					this.expression(0);
					}
					}
					this.state = 1355;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1357;
				this.match(SolidCashParser.T__49);
				this.state = 1358;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1360;
				this.match(SolidCashParser.T__48);
				this.state = 1361;
				this.tupleSlot();
				this.state = 1364;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1362;
					this.match(SolidCashParser.T__4);
					this.state = 1363;
					this.tupleSlot();
					}
					}
					this.state = 1366;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1368;
				this.match(SolidCashParser.T__49);
				this.state = 1369;
				this.match(SolidCashParser.T__39);
				this.state = 1370;
				this.expression(0);
				this.state = 1371;
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
		this.enterRule(localctx, 130, SolidCashParser.RULE_tupleSlot);
		let _la: number;
		try {
			this.state = 1386;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 155, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1375;
				this.typeName();
				this.state = 1379;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 15) !== 0)) {
					{
					{
					this.state = 1376;
					this.modifier();
					}
					}
					this.state = 1381;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1382;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1384;
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
		this.enterRule(localctx, 132, SolidCashParser.RULE_assignStatement);
		let _la: number;
		try {
			this.state = 1399;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 156, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1388;
				this.match(SolidCashParser.Identifier);
				this.state = 1389;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1390;
				this.expression(0);
				this.state = 1391;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1393;
				this.match(SolidCashParser.Identifier);
				this.state = 1394;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===88 || _la===89)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1395;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1396;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===88 || _la===89)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1397;
				this.match(SolidCashParser.Identifier);
				this.state = 1398;
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
		this.enterRule(localctx, 134, SolidCashParser.RULE_arrayPushStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1401;
			this.match(SolidCashParser.Identifier);
			this.state = 1402;
			this.match(SolidCashParser.T__89);
			this.state = 1403;
			this.match(SolidCashParser.T__48);
			this.state = 1404;
			this.expression(0);
			this.state = 1405;
			this.match(SolidCashParser.T__49);
			this.state = 1406;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 136, SolidCashParser.RULE_arrayPopStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1408;
			this.match(SolidCashParser.Identifier);
			this.state = 1409;
			this.match(SolidCashParser.T__90);
			this.state = 1410;
			this.match(SolidCashParser.T__48);
			this.state = 1411;
			this.match(SolidCashParser.T__49);
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
	public arrayDeleteStatement(): ArrayDeleteStatementContext {
		let localctx: ArrayDeleteStatementContext = new ArrayDeleteStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 138, SolidCashParser.RULE_arrayDeleteStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1414;
			this.match(SolidCashParser.Identifier);
			this.state = 1415;
			this.match(SolidCashParser.T__86);
			this.state = 1416;
			this.match(SolidCashParser.T__48);
			this.state = 1417;
			this.expression(0);
			this.state = 1418;
			this.match(SolidCashParser.T__49);
			this.state = 1419;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1421;
			this.match(SolidCashParser.T__73);
			this.state = 1422;
			this.match(SolidCashParser.T__11);
			this.state = 1423;
			this.match(SolidCashParser.Identifier);
			this.state = 1424;
			this.match(SolidCashParser.T__89);
			this.state = 1425;
			this.match(SolidCashParser.T__48);
			this.state = 1426;
			this.expression(0);
			this.state = 1427;
			this.match(SolidCashParser.T__49);
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
	public stateArrayPopStatement(): StateArrayPopStatementContext {
		let localctx: StateArrayPopStatementContext = new StateArrayPopStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 142, SolidCashParser.RULE_stateArrayPopStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1430;
			this.match(SolidCashParser.T__73);
			this.state = 1431;
			this.match(SolidCashParser.T__11);
			this.state = 1432;
			this.match(SolidCashParser.Identifier);
			this.state = 1433;
			this.match(SolidCashParser.T__90);
			this.state = 1434;
			this.match(SolidCashParser.T__48);
			this.state = 1435;
			this.match(SolidCashParser.T__49);
			this.state = 1436;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1472;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 159, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1438;
				this.match(SolidCashParser.T__91);
				this.state = 1439;
				this.match(SolidCashParser.Identifier);
				this.state = 1440;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1441;
				this.match(SolidCashParser.T__91);
				this.state = 1442;
				this.match(SolidCashParser.T__73);
				this.state = 1443;
				this.match(SolidCashParser.T__11);
				this.state = 1444;
				this.match(SolidCashParser.Identifier);
				this.state = 1445;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1446;
				this.match(SolidCashParser.T__91);
				this.state = 1447;
				this.match(SolidCashParser.T__73);
				this.state = 1448;
				this.match(SolidCashParser.T__11);
				this.state = 1449;
				this.match(SolidCashParser.Identifier);
				this.state = 1454;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1450;
					this.match(SolidCashParser.T__65);
					this.state = 1451;
					this.expression(0);
					this.state = 1452;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1456;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1458;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1460;
				this.match(SolidCashParser.T__91);
				this.state = 1461;
				this.match(SolidCashParser.Identifier);
				this.state = 1466;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1462;
					this.match(SolidCashParser.T__65);
					this.state = 1463;
					this.expression(0);
					this.state = 1464;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1468;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1470;
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
			this.state = 1474;
			this.match(SolidCashParser.T__92);
			this.state = 1475;
			this.match(SolidCashParser.T__48);
			this.state = 1476;
			this.match(SolidCashParser.TxVar);
			this.state = 1477;
			this.match(SolidCashParser.T__22);
			this.state = 1478;
			this.expression(0);
			this.state = 1481;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1479;
				this.match(SolidCashParser.T__4);
				this.state = 1480;
				this.requireMessage();
				}
			}

			this.state = 1483;
			this.match(SolidCashParser.T__49);
			this.state = 1484;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1486;
			this.match(SolidCashParser.T__92);
			this.state = 1487;
			this.match(SolidCashParser.T__48);
			this.state = 1488;
			this.expression(0);
			this.state = 1491;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1489;
				this.match(SolidCashParser.T__4);
				this.state = 1490;
				this.requireMessage();
				}
			}

			this.state = 1493;
			this.match(SolidCashParser.T__49);
			this.state = 1494;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1496;
			this.match(SolidCashParser.T__93);
			this.state = 1497;
			this.match(SolidCashParser.T__48);
			this.state = 1498;
			this.expression(0);
			this.state = 1499;
			this.match(SolidCashParser.T__49);
			this.state = 1500;
			localctx._ifBlock = this.block();
			this.state = 1503;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 162, this._ctx) ) {
			case 1:
				{
				this.state = 1501;
				this.match(SolidCashParser.T__94);
				this.state = 1502;
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
			this.state = 1511;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 163, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1505;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1506;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1507;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1508;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1509;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1510;
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
			this.state = 1513;
			this.match(SolidCashParser.T__8);
			this.state = 1514;
			this.match(SolidCashParser.T__48);
			this.state = 1515;
			this.typeName();
			this.state = 1516;
			this.match(SolidCashParser.Identifier);
			this.state = 1517;
			this.match(SolidCashParser.T__4);
			this.state = 1518;
			this.typeName();
			this.state = 1519;
			this.match(SolidCashParser.Identifier);
			this.state = 1520;
			this.match(SolidCashParser.T__95);
			this.state = 1521;
			this.match(SolidCashParser.T__73);
			this.state = 1522;
			this.match(SolidCashParser.T__11);
			this.state = 1523;
			this.match(SolidCashParser.Identifier);
			this.state = 1524;
			this.match(SolidCashParser.T__11);
			this.state = 1525;
			this.match(SolidCashParser.T__33);
			this.state = 1526;
			this.match(SolidCashParser.T__49);
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
	public forInStatement(): ForInStatementContext {
		let localctx: ForInStatementContext = new ForInStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 156, SolidCashParser.RULE_forInStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1529;
			this.match(SolidCashParser.T__8);
			this.state = 1530;
			this.match(SolidCashParser.T__48);
			this.state = 1531;
			this.typeName();
			this.state = 1532;
			this.match(SolidCashParser.Identifier);
			this.state = 1533;
			this.match(SolidCashParser.T__96);
			this.state = 1534;
			this.match(SolidCashParser.T__73);
			this.state = 1535;
			this.match(SolidCashParser.T__11);
			this.state = 1536;
			this.match(SolidCashParser.Identifier);
			this.state = 1537;
			this.match(SolidCashParser.T__49);
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
	public forOfStatement(): ForOfStatementContext {
		let localctx: ForOfStatementContext = new ForOfStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 158, SolidCashParser.RULE_forOfStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1540;
			this.match(SolidCashParser.T__8);
			this.state = 1541;
			this.match(SolidCashParser.T__48);
			this.state = 1542;
			this.typeName();
			this.state = 1543;
			this.match(SolidCashParser.Identifier);
			this.state = 1544;
			this.match(SolidCashParser.T__95);
			this.state = 1545;
			this.match(SolidCashParser.T__73);
			this.state = 1546;
			this.match(SolidCashParser.T__11);
			this.state = 1547;
			this.match(SolidCashParser.Identifier);
			this.state = 1548;
			this.match(SolidCashParser.T__49);
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
	public forStatement(): ForStatementContext {
		let localctx: ForStatementContext = new ForStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 160, SolidCashParser.RULE_forStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1551;
			this.match(SolidCashParser.T__8);
			this.state = 1552;
			this.match(SolidCashParser.T__48);
			this.state = 1553;
			this.forInit();
			this.state = 1554;
			this.forCondition();
			this.state = 1556;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===175) {
				{
				this.state = 1555;
				this.forUpdate();
				}
			}

			this.state = 1558;
			this.match(SolidCashParser.T__49);
			this.state = 1559;
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
			this.state = 1561;
			this.typeName();
			this.state = 1565;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===33 || _la===56 || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 15) !== 0)) {
				{
				{
				this.state = 1562;
				this.modifier();
				}
				}
				this.state = 1567;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1568;
			this.match(SolidCashParser.Identifier);
			this.state = 1571;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 1569;
				this.match(SolidCashParser.T__39);
				this.state = 1570;
				this.expression(0);
				}
			}

			this.state = 1573;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1575;
			this.expression(0);
			this.state = 1576;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1583;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 167, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1578;
				this.match(SolidCashParser.Identifier);
				this.state = 1579;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1580;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1581;
				this.match(SolidCashParser.Identifier);
				this.state = 1582;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===88 || _la===89)) {
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
			this.state = 1585;
			this.match(SolidCashParser.T__97);
			this.state = 1586;
			this.block();
			this.state = 1587;
			this.match(SolidCashParser.T__98);
			this.state = 1588;
			this.match(SolidCashParser.T__48);
			this.state = 1589;
			this.expression(0);
			this.state = 1590;
			this.match(SolidCashParser.T__49);
			this.state = 1591;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1593;
			this.match(SolidCashParser.T__98);
			this.state = 1594;
			this.match(SolidCashParser.T__48);
			this.state = 1595;
			this.expression(0);
			this.state = 1596;
			this.match(SolidCashParser.T__49);
			this.state = 1597;
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
			this.state = 1599;
			this.match(SolidCashParser.T__99);
			this.state = 1600;
			this.consoleParameterList();
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
	public assemblyStatement(): AssemblyStatementContext {
		let localctx: AssemblyStatementContext = new AssemblyStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 174, SolidCashParser.RULE_assemblyStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1603;
			this.match(SolidCashParser.T__100);
			this.state = 1604;
			this.match(SolidCashParser.T__3);
			this.state = 1608;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 157)) & ~0x1F) === 0 && ((1 << (_la - 157)) & 262401) !== 0)) {
				{
				{
				this.state = 1605;
				this.assemblyToken();
				}
				}
				this.state = 1610;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1611;
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
			this.state = 1613;
			_la = this._input.LA(1);
			if(!(((((_la - 157)) & ~0x1F) === 0 && ((1 << (_la - 157)) & 262401) !== 0))) {
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
			this.state = 1615;
			this.match(SolidCashParser.T__101);
			this.state = 1616;
			this.match(SolidCashParser.T__3);
			this.state = 1620;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
				{
				{
				this.state = 1617;
				this.statement();
				}
				}
				this.state = 1622;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1623;
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
			this.state = 1625;
			this.match(SolidCashParser.T__102);
			this.state = 1626;
			this.match(SolidCashParser.T__48);
			this.state = 1627;
			this.expression(0);
			this.state = 1628;
			this.match(SolidCashParser.T__49);
			this.state = 1629;
			this.match(SolidCashParser.T__3);
			this.state = 1633;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===104) {
				{
				{
				this.state = 1630;
				this.switchCase();
				}
				}
				this.state = 1635;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1637;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===106) {
				{
				this.state = 1636;
				this.switchDefault();
				}
			}

			this.state = 1639;
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
			this.state = 1641;
			this.match(SolidCashParser.T__103);
			this.state = 1642;
			this.expression(0);
			this.state = 1643;
			this.match(SolidCashParser.T__104);
			this.state = 1647;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
				{
				{
				this.state = 1644;
				this.statement();
				}
				}
				this.state = 1649;
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
			this.state = 1650;
			this.match(SolidCashParser.T__105);
			this.state = 1651;
			this.match(SolidCashParser.T__104);
			this.state = 1655;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
				{
				{
				this.state = 1652;
				this.statement();
				}
				}
				this.state = 1657;
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
			this.state = 1658;
			this.match(SolidCashParser.T__106);
			this.state = 1659;
			this.expression(0);
			this.state = 1661;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 1660;
				this.tryReturns();
				}
			}

			this.state = 1663;
			localctx._tryBlock = this.block();
			this.state = 1665;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1664;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1667;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 175, this._ctx);
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
			this.state = 1669;
			this.match(SolidCashParser.T__72);
			this.state = 1670;
			this.match(SolidCashParser.T__48);
			this.state = 1682;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 74980871) !== 0)) {
				{
				this.state = 1671;
				this.parameter();
				this.state = 1676;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 176, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1672;
						this.match(SolidCashParser.T__4);
						this.state = 1673;
						this.parameter();
						}
						}
					}
					this.state = 1678;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 176, this._ctx);
				}
				this.state = 1680;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1679;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1684;
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
		this.enterRule(localctx, 190, SolidCashParser.RULE_catchClause);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1686;
			this.match(SolidCashParser.T__107);
			this.state = 1688;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 179, this._ctx) ) {
			case 1:
				{
				this.state = 1687;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 1705;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 183, this._ctx) ) {
			case 1:
				{
				this.state = 1690;
				this.match(SolidCashParser.T__48);
				this.state = 1702;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 74980871) !== 0)) {
					{
					this.state = 1691;
					this.parameter();
					this.state = 1696;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 180, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1692;
							this.match(SolidCashParser.T__4);
							this.state = 1693;
							this.parameter();
							}
							}
						}
						this.state = 1698;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 180, this._ctx);
					}
					this.state = 1700;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1699;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1704;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
			this.state = 1707;
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
			this.state = 1709;
			this.match(SolidCashParser.T__108);
			this.state = 1710;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1712;
			this.match(SolidCashParser.T__109);
			this.state = 1713;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1718;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 163:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1715;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 175:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1716;
				this.match(SolidCashParser.Identifier);
				this.state = 1717;
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
		let _la: number;
		try {
			let _alt: number;
			this.state = 1762;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 190, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1720;
				this.match(SolidCashParser.T__35);
				this.state = 1721;
				this.match(SolidCashParser.Identifier);
				this.state = 1724;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1722;
					this.match(SolidCashParser.T__11);
					this.state = 1723;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1726;
				this.match(SolidCashParser.T__48);
				this.state = 1727;
				this.match(SolidCashParser.T__3);
				this.state = 1739;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===175) {
					{
					this.state = 1728;
					this.namedArg();
					this.state = 1733;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 186, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1729;
							this.match(SolidCashParser.T__4);
							this.state = 1730;
							this.namedArg();
							}
							}
						}
						this.state = 1735;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 186, this._ctx);
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
				this.match(SolidCashParser.T__5);
				this.state = 1742;
				this.match(SolidCashParser.T__49);
				this.state = 1743;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1744;
				this.match(SolidCashParser.T__35);
				this.state = 1745;
				this.match(SolidCashParser.Identifier);
				this.state = 1748;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1746;
					this.match(SolidCashParser.T__11);
					this.state = 1747;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1750;
				this.expressionList();
				this.state = 1751;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1753;
				this.match(SolidCashParser.T__35);
				this.state = 1754;
				this.match(SolidCashParser.T__48);
				this.state = 1755;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1756;
				this.match(SolidCashParser.T__49);
				this.state = 1757;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1758;
				this.match(SolidCashParser.T__35);
				this.state = 1759;
				this.match(SolidCashParser.T__48);
				this.state = 1760;
				this.match(SolidCashParser.T__49);
				this.state = 1761;
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
			this.state = 1764;
			this.match(SolidCashParser.T__110);
			this.state = 1765;
			this.match(SolidCashParser.T__48);
			this.state = 1766;
			this.expression(0);
			this.state = 1767;
			this.match(SolidCashParser.T__49);
			this.state = 1768;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1772;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 175:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1770;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 153:
			case 156:
			case 157:
			case 163:
			case 164:
			case 165:
			case 173:
			case 174:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1771;
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
			this.state = 1774;
			this.match(SolidCashParser.T__48);
			this.state = 1786;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 7347225) !== 0)) {
				{
				this.state = 1775;
				this.consoleParameter();
				this.state = 1780;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 192, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1776;
						this.match(SolidCashParser.T__4);
						this.state = 1777;
						this.consoleParameter();
						}
						}
					}
					this.state = 1782;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 192, this._ctx);
				}
				this.state = 1784;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1783;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1788;
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
		this.enterRule(localctx, 206, SolidCashParser.RULE_functionCall);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1814;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 198, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1790;
				this.match(SolidCashParser.Identifier);
				this.state = 1791;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1792;
				this.match(SolidCashParser.Identifier);
				this.state = 1793;
				this.match(SolidCashParser.T__11);
				this.state = 1794;
				this.match(SolidCashParser.Identifier);
				this.state = 1795;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1796;
				this.match(SolidCashParser.Identifier);
				this.state = 1797;
				this.match(SolidCashParser.T__48);
				this.state = 1798;
				this.match(SolidCashParser.T__3);
				this.state = 1810;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===175) {
					{
					this.state = 1799;
					this.namedArg();
					this.state = 1804;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 195, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1800;
							this.match(SolidCashParser.T__4);
							this.state = 1801;
							this.namedArg();
							}
							}
						}
						this.state = 1806;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 195, this._ctx);
					}
					this.state = 1808;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1807;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1812;
				this.match(SolidCashParser.T__5);
				this.state = 1813;
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
		this.enterRule(localctx, 208, SolidCashParser.RULE_namedArg);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1816;
			this.match(SolidCashParser.Identifier);
			this.state = 1817;
			this.match(SolidCashParser.T__104);
			this.state = 1818;
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
			this.state = 1820;
			this.match(SolidCashParser.T__48);
			this.state = 1832;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 112)) & ~0x1F) === 0 && ((1 << (_la - 112)) & 33622015) !== 0) || ((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 134078423) !== 0)) {
				{
				this.state = 1821;
				this.expression(0);
				this.state = 1826;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 199, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1822;
						this.match(SolidCashParser.T__4);
						this.state = 1823;
						this.expression(0);
						}
						}
					}
					this.state = 1828;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 199, this._ctx);
				}
				this.state = 1830;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1829;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1834;
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
		this.enterRule(localctx, 212, SolidCashParser.RULE_callOptions);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1836;
			this.match(SolidCashParser.T__3);
			this.state = 1837;
			this.callOption();
			this.state = 1842;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 202, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1838;
					this.match(SolidCashParser.T__4);
					this.state = 1839;
					this.callOption();
					}
					}
				}
				this.state = 1844;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 202, this._ctx);
			}
			this.state = 1846;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1845;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1848;
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
			this.state = 1850;
			this.match(SolidCashParser.Identifier);
			this.state = 1851;
			this.match(SolidCashParser.T__104);
			this.state = 1852;
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
			this.state = 1854;
			this.match(SolidCashParser.T__48);
			this.state = 1855;
			this.typeName();
			this.state = 1860;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 204, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1856;
					this.match(SolidCashParser.T__4);
					this.state = 1857;
					this.typeName();
					}
					}
				}
				this.state = 1862;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 204, this._ctx);
			}
			this.state = 1864;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1863;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1866;
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
		let _startState: number = 218;
		this.enterRecursionRule(localctx, 218, SolidCashParser.RULE_expression, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1997;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 212, this._ctx) ) {
			case 1:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 1869;
				this.match(SolidCashParser.T__48);
				this.state = 1870;
				this.expression(0);
				this.state = 1871;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1873;
				this.typeCast();
				this.state = 1874;
				this.match(SolidCashParser.T__48);
				this.state = 1875;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 1877;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1876;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1879;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1881;
				this.functionCall();
				}
				break;
			case 4:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1882;
				this.match(SolidCashParser.T__111);
				this.state = 1883;
				this.match(SolidCashParser.Identifier);
				this.state = 1885;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1884;
					this.callOptions();
					}
				}

				this.state = 1887;
				this.expressionList();
				}
				break;
			case 5:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1888;
				this.match(SolidCashParser.T__111);
				this.state = 1889;
				this.typeName();
				this.state = 1890;
				this.match(SolidCashParser.T__65);
				this.state = 1891;
				this.match(SolidCashParser.T__66);
				this.state = 1892;
				this.match(SolidCashParser.T__48);
				this.state = 1893;
				this.expression(0);
				this.state = 1894;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 6:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1896;
				this.match(SolidCashParser.T__54);
				this.state = 1897;
				this.match(SolidCashParser.T__48);
				this.state = 1898;
				this.typeName();
				this.state = 1899;
				this.match(SolidCashParser.T__49);
				this.state = 1900;
				this.match(SolidCashParser.T__11);
				this.state = 1901;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 7:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1903;
				this.match(SolidCashParser.T__112);
				this.state = 1904;
				this.expressionList();
				}
				break;
			case 8:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1905;
				this.match(SolidCashParser.T__113);
				this.state = 1906;
				this.expressionList();
				}
				break;
			case 9:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1907;
				this.match(SolidCashParser.T__114);
				this.state = 1908;
				this.expressionList();
				}
				break;
			case 10:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1909;
				this.match(SolidCashParser.T__115);
				this.state = 1910;
				this.expressionList();
				}
				break;
			case 11:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1911;
				this.match(SolidCashParser.T__116);
				this.state = 1912;
				this.match(SolidCashParser.T__48);
				this.state = 1913;
				this.match(SolidCashParser.Identifier);
				this.state = 1914;
				this.match(SolidCashParser.T__11);
				this.state = 1915;
				this.match(SolidCashParser.Identifier);
				this.state = 1916;
				this.match(SolidCashParser.T__4);
				this.state = 1917;
				this.expressionList();
				this.state = 1918;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 12:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1920;
				this.match(SolidCashParser.T__117);
				this.state = 1921;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1922;
				this.match(SolidCashParser.T__118);
				this.state = 1923;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1924;
				this.match(SolidCashParser.T__119);
				this.state = 1925;
				this.match(SolidCashParser.T__48);
				this.state = 1926;
				this.expression(0);
				this.state = 1927;
				this.match(SolidCashParser.T__4);
				this.state = 1928;
				this.typeList();
				this.state = 1929;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 15:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1931;
				this.match(SolidCashParser.T__120);
				this.state = 1932;
				this.match(SolidCashParser.T__48);
				this.state = 1933;
				this.expression(0);
				this.state = 1934;
				this.match(SolidCashParser.T__4);
				this.state = 1935;
				this.typeList();
				this.state = 1936;
				this.match(SolidCashParser.T__4);
				this.state = 1937;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1938;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 16:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1940;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__121);
				this.state = 1941;
				this.match(SolidCashParser.T__65);
				this.state = 1942;
				this.expression(0);
				this.state = 1943;
				this.match(SolidCashParser.T__66);
				this.state = 1944;
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
			case 17:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1946;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__127);
				this.state = 1947;
				this.match(SolidCashParser.T__65);
				this.state = 1948;
				this.expression(0);
				this.state = 1949;
				this.match(SolidCashParser.T__66);
				this.state = 1950;
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
			case 18:
				{
				localctx = new UnaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1952;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===137)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1953;
				this.expression(21);
				}
				break;
			case 19:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1954;
				this.match(SolidCashParser.T__65);
				this.state = 1966;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 112)) & ~0x1F) === 0 && ((1 << (_la - 112)) & 33622015) !== 0) || ((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 134078423) !== 0)) {
					{
					this.state = 1955;
					this.expression(0);
					this.state = 1960;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 208, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1956;
							this.match(SolidCashParser.T__4);
							this.state = 1957;
							this.expression(0);
							}
							}
						}
						this.state = 1962;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 208, this._ctx);
					}
					this.state = 1964;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1963;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1968;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 20:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1969;
				this.match(SolidCashParser.T__73);
				this.state = 1970;
				this.match(SolidCashParser.T__11);
				this.state = 1971;
				this.match(SolidCashParser.Identifier);
				this.state = 1972;
				this.match(SolidCashParser.T__11);
				this.state = 1973;
				this.match(SolidCashParser.Identifier);
				this.state = 1974;
				this.match(SolidCashParser.T__65);
				this.state = 1975;
				this.expression(0);
				this.state = 1976;
				this.match(SolidCashParser.T__66);
				this.state = 1977;
				this.memberName();
				}
				break;
			case 21:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1979;
				this.match(SolidCashParser.T__73);
				this.state = 1980;
				this.match(SolidCashParser.T__11);
				this.state = 1981;
				this.match(SolidCashParser.Identifier);
				this.state = 1986;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 1982;
						this.match(SolidCashParser.T__65);
						this.state = 1983;
						this.expression(0);
						this.state = 1984;
						this.match(SolidCashParser.T__66);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 1988;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 211, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 22:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1990;
				this.match(SolidCashParser.T__73);
				this.state = 1991;
				this.match(SolidCashParser.T__11);
				this.state = 1992;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 23:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1993;
				this.match(SolidCashParser.T__73);
				}
				break;
			case 24:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1994;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 25:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1995;
				this.anyIdentifier();
				}
				break;
			case 26:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1996;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2104;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 219, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2102;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 218, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1999;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 2000;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 2001;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2002;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 2003;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2004;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2005;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 2006;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2007;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2008;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 2009;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===138 || _la===139)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2010;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2011;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 2012;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2013;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2014;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2015;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2016;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2017;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2018;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2019;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2020;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2021;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2022;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2023;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2024;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2025;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2026;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2027;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__139);
						this.state = 2028;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2029;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2030;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__140);
						this.state = 2031;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2032;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 2033;
						this.match(SolidCashParser.T__141);
						this.state = 2034;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 2035;
						this.match(SolidCashParser.T__104);
						this.state = 2036;
						(localctx as TernaryOpContext)._ifFalse = this.expression(9);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2038;
						if (!(this.precpred(this._ctx, 32))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 32)");
						}
						this.state = 2039;
						this.match(SolidCashParser.T__65);
						this.state = 2040;
						(localctx as IndexRangeSliceContext)._start = this.expression(0);
						this.state = 2041;
						this.match(SolidCashParser.T__104);
						this.state = 2042;
						(localctx as IndexRangeSliceContext)._end = this.expression(0);
						this.state = 2043;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2045;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 2046;
						this.match(SolidCashParser.T__65);
						this.state = 2047;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2048;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2049;
						if (!(this.precpred(this._ctx, 30))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 30)");
						}
						this.state = 2050;
						this.match(SolidCashParser.T__65);
						this.state = 2051;
						this.expression(0);
						this.state = 2052;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2054;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2055;
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
						this.state = 2056;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2057;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__134);
						this.state = 2058;
						this.match(SolidCashParser.T__48);
						this.state = 2059;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2060;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2062;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2063;
						this.match(SolidCashParser.T__135);
						this.state = 2064;
						this.match(SolidCashParser.T__48);
						this.state = 2065;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2066;
						this.match(SolidCashParser.T__4);
						this.state = 2067;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2068;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2070;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2071;
						this.match(SolidCashParser.T__11);
						this.state = 2072;
						this.match(SolidCashParser.Identifier);
						this.state = 2074;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2073;
							this.callOptions();
							}
						}

						this.state = 2076;
						this.match(SolidCashParser.T__48);
						this.state = 2077;
						this.match(SolidCashParser.T__3);
						this.state = 2089;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===175) {
							{
							this.state = 2078;
							this.namedArg();
							this.state = 2083;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 214, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2079;
									this.match(SolidCashParser.T__4);
									this.state = 2080;
									this.namedArg();
									}
									}
								}
								this.state = 2085;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 214, this._ctx);
							}
							this.state = 2087;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2086;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2091;
						this.match(SolidCashParser.T__5);
						this.state = 2092;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 20:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2093;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2094;
						this.match(SolidCashParser.T__11);
						this.state = 2095;
						this.match(SolidCashParser.Identifier);
						this.state = 2097;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2096;
							this.callOptions();
							}
						}

						this.state = 2099;
						this.expressionList();
						}
						break;
					case 21:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2100;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 2101;
						this.memberName();
						}
						break;
					}
					}
				}
				this.state = 2106;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 219, this._ctx);
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
			this.state = 2120;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2107;
				this.match(SolidCashParser.T__11);
				this.state = 2108;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 123:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2109;
				this.match(SolidCashParser.T__122);
				}
				break;
			case 124:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2110;
				this.match(SolidCashParser.T__123);
				}
				break;
			case 125:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2111;
				this.match(SolidCashParser.T__124);
				}
				break;
			case 126:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2112;
				this.match(SolidCashParser.T__125);
				}
				break;
			case 127:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2113;
				this.match(SolidCashParser.T__126);
				}
				break;
			case 129:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2114;
				this.match(SolidCashParser.T__128);
				}
				break;
			case 130:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2115;
				this.match(SolidCashParser.T__129);
				}
				break;
			case 131:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2116;
				this.match(SolidCashParser.T__130);
				}
				break;
			case 132:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2117;
				this.match(SolidCashParser.T__131);
				}
				break;
			case 143:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2118;
				this.match(SolidCashParser.T__142);
				}
				break;
			case 144:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2119;
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
		this.enterRule(localctx, 222, SolidCashParser.RULE_modifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2122;
			_la = this._input.LA(1);
			if(!(_la===33 || _la===56 || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 15) !== 0))) {
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
			this.state = 2138;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 153:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2124;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 157:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2125;
				this.numberLiteral();
				}
				break;
			case 156:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2126;
				this.decimalLiteral();
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2127;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2131;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 221, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2128;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2133;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 221, this._ctx);
				}
				}
				break;
			case 173:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2134;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 174:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2135;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 164:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2136;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 165:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2137;
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
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2140;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2142;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 223, this._ctx) ) {
			case 1:
				{
				this.state = 2141;
				_la = this._input.LA(1);
				if(!(_la===154 || _la===155)) {
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
		this.enterRule(localctx, 228, SolidCashParser.RULE_decimalLiteral);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2144;
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
		let _la: number;
		try {
			this.state = 2190;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 228, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2146;
				this.match(SolidCashParser.T__148);
				this.state = 2147;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2148;
				this.match(SolidCashParser.T__148);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2149;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2150;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2151;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2152;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2153;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2154;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2155;
				this.match(SolidCashParser.T__149);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2156;
				this.match(SolidCashParser.T__150);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2157;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2158;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2159;
				this.match(SolidCashParser.T__6);
				this.state = 2160;
				this.match(SolidCashParser.T__48);
				this.state = 2169;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 74980871) !== 0)) {
					{
					this.state = 2161;
					this.typeName();
					this.state = 2166;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2162;
						this.match(SolidCashParser.T__4);
						this.state = 2163;
						this.typeName();
						}
						}
						this.state = 2168;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2171;
				this.match(SolidCashParser.T__49);
				this.state = 2184;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===73) {
					{
					this.state = 2172;
					this.match(SolidCashParser.T__72);
					this.state = 2173;
					this.match(SolidCashParser.T__48);
					this.state = 2174;
					this.typeName();
					this.state = 2179;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2175;
						this.match(SolidCashParser.T__4);
						this.state = 2176;
						this.typeName();
						}
						}
						this.state = 2181;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2182;
					this.match(SolidCashParser.T__49);
					}
				}

				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2186;
				this.match(SolidCashParser.Identifier);
				this.state = 2187;
				this.match(SolidCashParser.T__11);
				this.state = 2188;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 2189;
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
			this.state = 2192;
			_la = this._input.LA(1);
			if(!(_la===59 || ((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 8134151) !== 0))) {
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
		case 40:
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

	public static readonly _serializedATN: number[] = [4,1,178,2195,2,0,7,0,
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
	0,12,0,245,9,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,5,0,257,8,0,10,0,
	12,0,260,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,5,1,277,8,1,10,1,12,1,280,9,1,1,1,3,1,283,8,1,1,1,1,1,1,1,1,1,1,1,3,1,
	290,8,1,1,2,1,2,1,2,3,2,295,8,2,1,3,1,3,1,3,1,3,5,3,301,8,3,10,3,12,3,304,
	9,3,1,3,3,3,307,8,3,1,3,1,3,5,3,311,8,3,10,3,12,3,314,9,3,1,3,1,3,1,4,1,
	4,1,4,1,4,1,4,3,4,323,8,4,1,4,3,4,326,8,4,1,4,1,4,1,4,1,4,1,4,1,4,5,4,334,
	8,4,10,4,12,4,337,9,4,1,4,3,4,340,8,4,1,4,1,4,1,4,1,4,3,4,346,8,4,1,4,3,
	4,349,8,4,1,4,1,4,3,4,353,8,4,1,5,1,5,1,5,3,5,358,8,5,1,5,1,5,3,5,362,8,
	5,1,6,1,6,1,7,1,7,1,8,1,8,1,8,1,8,1,8,1,9,1,9,1,10,1,10,3,10,377,8,10,1,
	11,3,11,380,8,11,1,11,1,11,1,12,1,12,1,13,1,13,1,13,1,13,1,13,1,13,5,13,
	392,8,13,10,13,12,13,395,9,13,3,13,397,8,13,1,13,1,13,1,13,1,13,1,13,1,
	13,1,13,1,13,1,13,5,13,408,8,13,10,13,12,13,411,9,13,1,13,1,13,1,14,1,14,
	1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,3,14,425,8,14,1,15,1,15,1,15,1,
	15,1,15,1,16,1,16,1,17,1,17,1,17,1,17,5,17,438,8,17,10,17,12,17,441,9,17,
	1,17,3,17,444,8,17,1,17,1,17,1,18,1,18,1,18,1,18,5,18,452,8,18,10,18,12,
	18,455,9,18,1,18,5,18,458,8,18,10,18,12,18,461,9,18,1,18,5,18,464,8,18,
	10,18,12,18,467,9,18,1,18,5,18,470,8,18,10,18,12,18,473,9,18,1,18,5,18,
	476,8,18,10,18,12,18,479,9,18,1,18,5,18,482,8,18,10,18,12,18,485,9,18,1,
	18,5,18,488,8,18,10,18,12,18,491,9,18,1,18,5,18,494,8,18,10,18,12,18,497,
	9,18,1,18,1,18,1,19,3,19,502,8,19,1,19,1,19,1,19,3,19,507,8,19,1,19,1,19,
	1,19,1,19,5,19,513,8,19,10,19,12,19,516,9,19,3,19,518,8,19,1,19,1,19,1,
	19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,5,19,535,
	8,19,10,19,12,19,538,9,19,1,19,1,19,1,20,1,20,1,20,1,20,5,20,546,8,20,10,
	20,12,20,549,9,20,1,20,5,20,552,8,20,10,20,12,20,555,9,20,1,20,3,20,558,
	8,20,1,20,1,20,1,21,1,21,1,21,1,21,1,21,1,21,5,21,568,8,21,10,21,12,21,
	571,9,21,1,21,3,21,574,8,21,3,21,576,8,21,1,21,1,21,3,21,580,8,21,1,21,
	1,21,1,22,1,22,3,22,586,8,22,1,22,1,22,1,23,1,23,1,23,1,23,1,23,1,23,5,
	23,596,8,23,10,23,12,23,599,9,23,1,23,3,23,602,8,23,3,23,604,8,23,1,23,
	1,23,1,23,1,24,1,24,1,24,1,25,1,25,1,25,1,25,4,25,616,8,25,11,25,12,25,
	617,1,25,1,25,1,26,1,26,3,26,624,8,26,1,26,1,26,1,26,1,27,1,27,1,27,1,27,
	1,27,1,27,5,27,635,8,27,10,27,12,27,638,9,27,1,27,3,27,641,8,27,1,27,1,
	27,1,28,1,28,1,28,3,28,648,8,28,1,29,1,29,1,29,1,29,1,29,1,29,1,30,1,30,
	1,30,1,30,1,30,1,30,1,30,1,31,1,31,1,31,5,31,666,8,31,10,31,12,31,669,9,
	31,1,31,5,31,672,8,31,10,31,12,31,675,9,31,1,31,1,31,5,31,679,8,31,10,31,
	12,31,682,9,31,1,31,1,31,1,32,1,32,1,32,1,32,5,32,690,8,32,10,32,12,32,
	693,9,32,1,32,5,32,696,8,32,10,32,12,32,699,9,32,1,32,1,32,5,32,703,8,32,
	10,32,12,32,706,9,32,1,32,1,32,1,33,1,33,1,33,3,33,713,8,33,1,34,1,34,1,
	34,1,34,1,34,1,34,1,34,5,34,722,8,34,10,34,12,34,725,9,34,1,34,1,34,1,35,
	1,35,1,35,1,36,3,36,733,8,36,1,36,1,36,5,36,737,8,36,10,36,12,36,740,9,
	36,1,36,1,36,1,36,3,36,745,8,36,1,36,1,36,1,36,1,36,1,36,5,36,752,8,36,
	10,36,12,36,755,9,36,1,36,1,36,1,36,3,36,760,8,36,1,36,1,36,1,36,3,36,765,
	8,36,1,36,1,36,5,36,769,8,36,10,36,12,36,772,9,36,1,36,1,36,1,36,1,36,3,
	36,778,8,36,1,36,1,36,5,36,782,8,36,10,36,12,36,785,9,36,1,36,1,36,1,36,
	3,36,790,8,36,1,36,1,36,3,36,794,8,36,1,37,1,37,3,37,798,8,37,1,38,1,38,
	1,39,1,39,1,39,1,39,3,39,806,8,39,1,39,1,39,1,39,3,39,811,8,39,1,39,1,39,
	1,39,1,39,1,39,1,39,3,39,819,8,39,1,39,1,39,1,39,1,39,1,39,1,39,1,39,1,
	39,3,39,829,8,39,1,39,1,39,1,39,3,39,834,8,39,1,39,1,39,3,39,838,8,39,1,
	40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,3,40,850,8,40,1,40,1,40,
	1,40,1,40,1,40,1,40,1,40,5,40,859,8,40,10,40,12,40,862,9,40,1,41,1,41,1,
	41,3,41,867,8,41,1,41,1,41,5,41,871,8,41,10,41,12,41,874,9,41,1,41,1,41,
	1,42,1,42,3,42,880,8,42,1,43,1,43,1,43,1,44,1,44,1,44,1,44,5,44,889,8,44,
	10,44,12,44,892,9,44,1,44,5,44,895,8,44,10,44,12,44,898,9,44,1,44,3,44,
	901,8,44,1,44,1,44,5,44,905,8,44,10,44,12,44,908,9,44,1,44,1,44,1,45,1,
	45,3,45,914,8,45,1,46,1,46,1,46,1,46,1,46,1,46,1,46,1,46,1,46,1,46,1,46,
	1,46,1,46,1,46,3,46,930,8,46,1,47,1,47,1,47,1,47,1,47,5,47,937,8,47,10,
	47,12,47,940,9,47,1,47,3,47,943,8,47,1,48,1,48,1,48,1,48,3,48,949,8,48,
	1,49,1,49,1,49,1,49,1,49,5,49,956,8,49,10,49,12,49,959,9,49,1,49,3,49,962,
	8,49,1,49,1,49,1,50,1,50,5,50,968,8,50,10,50,12,50,971,9,50,1,50,3,50,974,
	8,50,1,50,1,50,5,50,978,8,50,10,50,12,50,981,9,50,1,50,3,50,984,8,50,3,
	50,986,8,50,1,51,1,51,1,51,1,51,5,51,992,8,51,10,51,12,51,995,9,51,1,51,
	3,51,998,8,51,3,51,1000,8,51,1,51,1,51,1,52,1,52,5,52,1006,8,52,10,52,12,
	52,1009,9,52,1,52,3,52,1012,8,52,1,52,1,52,5,52,1016,8,52,10,52,12,52,1019,
	9,52,1,52,3,52,1022,8,52,3,52,1024,8,52,1,53,1,53,5,53,1028,8,53,10,53,
	12,53,1031,9,53,1,53,1,53,3,53,1035,8,53,1,54,1,54,1,54,1,54,1,54,1,54,
	1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,
	54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,3,54,1067,8,54,1,55,1,55,
	1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,56,1,56,1,56,1,56,1,56,1,56,1,
	56,1,56,1,56,1,56,1,56,1,56,5,56,1091,8,56,10,56,12,56,1094,9,56,1,56,1,
	56,1,56,1,57,1,57,1,57,1,57,1,57,1,57,5,57,1105,8,57,10,57,12,57,1108,9,
	57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,5,57,1117,8,57,10,57,12,57,1120,9,
	57,1,57,3,57,1123,8,57,1,57,1,57,1,57,3,57,1128,8,57,1,58,1,58,1,58,3,58,
	1133,8,58,1,58,1,58,1,58,1,58,1,58,5,58,1140,8,58,10,58,12,58,1143,9,58,
	1,58,3,58,1146,8,58,3,58,1148,8,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,
	58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,3,58,1170,
	8,58,1,58,1,58,1,58,3,58,1175,8,58,1,59,1,59,1,59,1,59,3,59,1181,8,59,1,
	59,1,59,1,59,1,60,1,60,1,60,1,60,3,60,1190,8,60,1,60,1,60,1,60,1,60,1,60,
	5,60,1197,8,60,10,60,12,60,1200,9,60,1,60,3,60,1203,8,60,3,60,1205,8,60,
	1,60,1,60,1,60,1,60,1,60,1,60,1,60,3,60,1214,8,60,1,60,1,60,1,60,3,60,1219,
	8,60,1,61,1,61,1,61,1,61,1,61,1,61,1,61,4,61,1228,8,61,11,61,12,61,1229,
	3,61,1232,8,61,1,61,1,61,5,61,1236,8,61,10,61,12,61,1239,9,61,1,61,1,61,
	1,61,1,61,1,61,1,61,1,61,1,61,1,61,4,61,1250,8,61,11,61,12,61,1251,1,61,
	1,61,5,61,1256,8,61,10,61,12,61,1259,9,61,1,61,1,61,1,61,1,61,1,61,1,61,
	1,61,4,61,1268,8,61,11,61,12,61,1269,1,61,1,61,1,61,1,61,3,61,1276,8,61,
	1,62,1,62,1,62,1,62,1,62,1,62,1,62,5,62,1285,8,62,10,62,12,62,1288,9,62,
	1,62,1,62,1,62,1,62,1,62,1,62,1,63,1,63,5,63,1298,8,63,10,63,12,63,1301,
	9,63,1,63,1,63,1,63,3,63,1306,8,63,1,63,1,63,1,63,1,63,5,63,1312,8,63,10,
	63,12,63,1315,9,63,1,63,1,63,1,63,3,63,1320,8,63,1,63,1,63,3,63,1324,8,
	63,1,64,1,64,1,64,1,64,1,64,1,64,4,64,1332,8,64,11,64,12,64,1333,1,64,1,
	64,1,64,1,64,1,64,1,64,1,64,1,64,4,64,1344,8,64,11,64,12,64,1345,1,64,1,
	64,1,64,1,64,1,64,1,64,4,64,1354,8,64,11,64,12,64,1355,1,64,1,64,1,64,1,
	64,1,64,1,64,1,64,4,64,1365,8,64,11,64,12,64,1366,1,64,1,64,1,64,1,64,1,
	64,3,64,1374,8,64,1,65,1,65,5,65,1378,8,65,10,65,12,65,1381,9,65,1,65,1,
	65,1,65,1,65,3,65,1387,8,65,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,
	1,66,1,66,3,66,1400,8,66,1,67,1,67,1,67,1,67,1,67,1,67,1,67,1,68,1,68,1,
	68,1,68,1,68,1,68,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,70,1,70,1,70,1,70,
	1,70,1,70,1,70,1,70,1,70,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,72,1,
	72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,
	4,72,1455,8,72,11,72,12,72,1456,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,
	4,72,1467,8,72,11,72,12,72,1468,1,72,1,72,3,72,1473,8,72,1,73,1,73,1,73,
	1,73,1,73,1,73,1,73,3,73,1482,8,73,1,73,1,73,1,73,1,74,1,74,1,74,1,74,1,
	74,3,74,1492,8,74,1,74,1,74,1,74,1,75,1,75,1,75,1,75,1,75,1,75,1,75,3,75,
	1504,8,75,1,76,1,76,1,76,1,76,1,76,1,76,3,76,1512,8,76,1,77,1,77,1,77,1,
	77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,78,1,78,
	1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,79,1,79,1,79,1,79,1,79,1,
	79,1,79,1,79,1,79,1,79,1,79,1,80,1,80,1,80,1,80,1,80,3,80,1557,8,80,1,80,
	1,80,1,80,1,81,1,81,5,81,1564,8,81,10,81,12,81,1567,9,81,1,81,1,81,1,81,
	3,81,1572,8,81,1,81,1,81,1,82,1,82,1,82,1,83,1,83,1,83,1,83,1,83,3,83,1584,
	8,83,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,85,1,85,1,85,1,85,1,85,1,
	85,1,86,1,86,1,86,1,86,1,87,1,87,1,87,5,87,1607,8,87,10,87,12,87,1610,9,
	87,1,87,1,87,1,88,1,88,1,89,1,89,1,89,5,89,1619,8,89,10,89,12,89,1622,9,
	89,1,89,1,89,1,90,1,90,1,90,1,90,1,90,1,90,5,90,1632,8,90,10,90,12,90,1635,
	9,90,1,90,3,90,1638,8,90,1,90,1,90,1,91,1,91,1,91,1,91,5,91,1646,8,91,10,
	91,12,91,1649,9,91,1,92,1,92,1,92,5,92,1654,8,92,10,92,12,92,1657,9,92,
	1,93,1,93,1,93,3,93,1662,8,93,1,93,1,93,4,93,1666,8,93,11,93,12,93,1667,
	1,94,1,94,1,94,1,94,1,94,5,94,1675,8,94,10,94,12,94,1678,9,94,1,94,3,94,
	1681,8,94,3,94,1683,8,94,1,94,1,94,1,95,1,95,3,95,1689,8,95,1,95,1,95,1,
	95,1,95,5,95,1695,8,95,10,95,12,95,1698,9,95,1,95,3,95,1701,8,95,3,95,1703,
	8,95,1,95,3,95,1706,8,95,1,95,1,95,1,96,1,96,1,96,1,97,1,97,1,97,1,98,1,
	98,1,98,3,98,1719,8,98,1,99,1,99,1,99,1,99,3,99,1725,8,99,1,99,1,99,1,99,
	1,99,1,99,5,99,1732,8,99,10,99,12,99,1735,9,99,1,99,3,99,1738,8,99,3,99,
	1740,8,99,1,99,1,99,1,99,1,99,1,99,1,99,1,99,3,99,1749,8,99,1,99,1,99,1,
	99,1,99,1,99,1,99,1,99,1,99,1,99,1,99,1,99,1,99,3,99,1763,8,99,1,100,1,
	100,1,100,1,100,1,100,1,100,1,101,1,101,3,101,1773,8,101,1,102,1,102,1,
	102,1,102,5,102,1779,8,102,10,102,12,102,1782,9,102,1,102,3,102,1785,8,
	102,3,102,1787,8,102,1,102,1,102,1,103,1,103,1,103,1,103,1,103,1,103,1,
	103,1,103,1,103,1,103,1,103,1,103,5,103,1803,8,103,10,103,12,103,1806,9,
	103,1,103,3,103,1809,8,103,3,103,1811,8,103,1,103,1,103,3,103,1815,8,103,
	1,104,1,104,1,104,1,104,1,105,1,105,1,105,1,105,5,105,1825,8,105,10,105,
	12,105,1828,9,105,1,105,3,105,1831,8,105,3,105,1833,8,105,1,105,1,105,1,
	106,1,106,1,106,1,106,5,106,1841,8,106,10,106,12,106,1844,9,106,1,106,3,
	106,1847,8,106,1,106,1,106,1,107,1,107,1,107,1,107,1,108,1,108,1,108,1,
	108,5,108,1859,8,108,10,108,12,108,1862,9,108,1,108,3,108,1865,8,108,1,
	108,1,108,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,3,109,1878,
	8,109,1,109,1,109,1,109,1,109,1,109,1,109,3,109,1886,8,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,5,109,1959,8,109,
	10,109,12,109,1962,9,109,1,109,3,109,1965,8,109,3,109,1967,8,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,4,109,1987,8,109,11,109,12,109,1988,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,3,109,1998,8,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	3,109,2075,8,109,1,109,1,109,1,109,1,109,1,109,5,109,2082,8,109,10,109,
	12,109,2085,9,109,1,109,3,109,2088,8,109,3,109,2090,8,109,1,109,1,109,1,
	109,1,109,1,109,1,109,3,109,2098,8,109,1,109,1,109,1,109,5,109,2103,8,109,
	10,109,12,109,2106,9,109,1,110,1,110,1,110,1,110,1,110,1,110,1,110,1,110,
	1,110,1,110,1,110,1,110,1,110,3,110,2121,8,110,1,111,1,111,1,112,1,112,
	1,112,1,112,1,112,5,112,2130,8,112,10,112,12,112,2133,9,112,1,112,1,112,
	1,112,1,112,3,112,2139,8,112,1,113,1,113,3,113,2143,8,113,1,114,1,114,1,
	115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,1,
	115,1,115,1,115,1,115,1,115,1,115,5,115,2165,8,115,10,115,12,115,2168,9,
	115,3,115,2170,8,115,1,115,1,115,1,115,1,115,1,115,1,115,5,115,2178,8,115,
	10,115,12,115,2181,9,115,1,115,1,115,3,115,2185,8,115,1,115,1,115,1,115,
	1,115,3,115,2191,8,115,1,116,1,116,1,116,0,2,80,218,117,0,2,4,6,8,10,12,
	14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,
	62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,
	108,110,112,114,116,118,120,122,124,126,128,130,132,134,136,138,140,142,
	144,146,148,150,152,154,156,158,160,162,164,166,168,170,172,174,176,178,
	180,182,184,186,188,190,192,194,196,198,200,202,204,206,208,210,212,214,
	216,218,220,222,224,226,228,230,232,0,22,2,0,10,10,13,27,5,0,11,11,28,36,
	155,155,159,159,175,175,1,0,38,39,3,0,20,23,26,27,40,40,1,0,43,44,2,0,43,
	44,58,59,3,0,43,44,58,58,63,63,2,0,40,40,77,86,1,0,88,89,3,0,157,157,165,
	165,175,175,1,0,123,127,2,0,123,127,129,132,3,0,14,14,27,27,137,137,2,0,
	10,10,15,16,1,0,13,14,1,0,138,139,1,0,20,23,1,0,18,19,1,0,133,134,3,0,33,
	33,56,56,145,148,1,0,154,155,4,0,59,59,149,151,158,161,167,171,2465,0,237,
	1,0,0,0,2,289,1,0,0,0,4,291,1,0,0,0,6,296,1,0,0,0,8,352,1,0,0,0,10,354,
	1,0,0,0,12,363,1,0,0,0,14,365,1,0,0,0,16,367,1,0,0,0,18,372,1,0,0,0,20,
	374,1,0,0,0,22,379,1,0,0,0,24,383,1,0,0,0,26,385,1,0,0,0,28,424,1,0,0,0,
	30,426,1,0,0,0,32,431,1,0,0,0,34,433,1,0,0,0,36,447,1,0,0,0,38,501,1,0,
	0,0,40,541,1,0,0,0,42,561,1,0,0,0,44,583,1,0,0,0,46,589,1,0,0,0,48,608,
	1,0,0,0,50,611,1,0,0,0,52,623,1,0,0,0,54,628,1,0,0,0,56,644,1,0,0,0,58,
	649,1,0,0,0,60,655,1,0,0,0,62,662,1,0,0,0,64,685,1,0,0,0,66,712,1,0,0,0,
	68,714,1,0,0,0,70,728,1,0,0,0,72,793,1,0,0,0,74,797,1,0,0,0,76,799,1,0,
	0,0,78,837,1,0,0,0,80,849,1,0,0,0,82,863,1,0,0,0,84,879,1,0,0,0,86,881,
	1,0,0,0,88,884,1,0,0,0,90,911,1,0,0,0,92,929,1,0,0,0,94,931,1,0,0,0,96,
	944,1,0,0,0,98,950,1,0,0,0,100,985,1,0,0,0,102,987,1,0,0,0,104,1023,1,0,
	0,0,106,1034,1,0,0,0,108,1066,1,0,0,0,110,1068,1,0,0,0,112,1078,1,0,0,0,
	114,1127,1,0,0,0,116,1174,1,0,0,0,118,1176,1,0,0,0,120,1218,1,0,0,0,122,
	1275,1,0,0,0,124,1277,1,0,0,0,126,1323,1,0,0,0,128,1373,1,0,0,0,130,1386,
	1,0,0,0,132,1399,1,0,0,0,134,1401,1,0,0,0,136,1408,1,0,0,0,138,1414,1,0,
	0,0,140,1421,1,0,0,0,142,1430,1,0,0,0,144,1472,1,0,0,0,146,1474,1,0,0,0,
	148,1486,1,0,0,0,150,1496,1,0,0,0,152,1511,1,0,0,0,154,1513,1,0,0,0,156,
	1529,1,0,0,0,158,1540,1,0,0,0,160,1551,1,0,0,0,162,1561,1,0,0,0,164,1575,
	1,0,0,0,166,1583,1,0,0,0,168,1585,1,0,0,0,170,1593,1,0,0,0,172,1599,1,0,
	0,0,174,1603,1,0,0,0,176,1613,1,0,0,0,178,1615,1,0,0,0,180,1625,1,0,0,0,
	182,1641,1,0,0,0,184,1650,1,0,0,0,186,1658,1,0,0,0,188,1669,1,0,0,0,190,
	1686,1,0,0,0,192,1709,1,0,0,0,194,1712,1,0,0,0,196,1718,1,0,0,0,198,1762,
	1,0,0,0,200,1764,1,0,0,0,202,1772,1,0,0,0,204,1774,1,0,0,0,206,1814,1,0,
	0,0,208,1816,1,0,0,0,210,1820,1,0,0,0,212,1836,1,0,0,0,214,1850,1,0,0,0,
	216,1854,1,0,0,0,218,1997,1,0,0,0,220,2120,1,0,0,0,222,2122,1,0,0,0,224,
	2138,1,0,0,0,226,2140,1,0,0,0,228,2144,1,0,0,0,230,2190,1,0,0,0,232,2192,
	1,0,0,0,234,236,3,16,8,0,235,234,1,0,0,0,236,239,1,0,0,0,237,235,1,0,0,
	0,237,238,1,0,0,0,238,243,1,0,0,0,239,237,1,0,0,0,240,242,3,2,1,0,241,240,
	1,0,0,0,242,245,1,0,0,0,243,241,1,0,0,0,243,244,1,0,0,0,244,258,1,0,0,0,
	245,243,1,0,0,0,246,257,3,60,30,0,247,257,3,54,27,0,248,257,3,50,25,0,249,
	257,3,58,29,0,250,257,3,8,4,0,251,257,3,46,23,0,252,257,3,26,13,0,253,257,
	3,6,3,0,254,257,3,36,18,0,255,257,3,38,19,0,256,246,1,0,0,0,256,247,1,0,
	0,0,256,248,1,0,0,0,256,249,1,0,0,0,256,250,1,0,0,0,256,251,1,0,0,0,256,
	252,1,0,0,0,256,253,1,0,0,0,256,254,1,0,0,0,256,255,1,0,0,0,257,260,1,0,
	0,0,258,256,1,0,0,0,258,259,1,0,0,0,259,261,1,0,0,0,260,258,1,0,0,0,261,
	262,5,0,0,1,262,1,1,0,0,0,263,264,5,1,0,0,264,265,5,163,0,0,265,290,5,2,
	0,0,266,267,5,1,0,0,267,268,5,163,0,0,268,269,5,3,0,0,269,270,5,175,0,0,
	270,290,5,2,0,0,271,272,5,1,0,0,272,273,5,4,0,0,273,278,3,4,2,0,274,275,
	5,5,0,0,275,277,3,4,2,0,276,274,1,0,0,0,277,280,1,0,0,0,278,276,1,0,0,0,
	278,279,1,0,0,0,279,282,1,0,0,0,280,278,1,0,0,0,281,283,5,5,0,0,282,281,
	1,0,0,0,282,283,1,0,0,0,283,284,1,0,0,0,284,285,5,6,0,0,285,286,5,175,0,
	0,286,287,5,163,0,0,287,288,5,2,0,0,288,290,1,0,0,0,289,263,1,0,0,0,289,
	266,1,0,0,0,289,271,1,0,0,0,290,3,1,0,0,0,291,294,5,175,0,0,292,293,5,3,
	0,0,293,295,5,175,0,0,294,292,1,0,0,0,294,295,1,0,0,0,295,5,1,0,0,0,296,
	297,5,7,0,0,297,298,3,14,7,0,298,302,3,102,51,0,299,301,3,92,46,0,300,299,
	1,0,0,0,301,304,1,0,0,0,302,300,1,0,0,0,302,303,1,0,0,0,303,306,1,0,0,0,
	304,302,1,0,0,0,305,307,3,98,49,0,306,305,1,0,0,0,306,307,1,0,0,0,307,308,
	1,0,0,0,308,312,5,4,0,0,309,311,3,108,54,0,310,309,1,0,0,0,311,314,1,0,
	0,0,312,310,1,0,0,0,312,313,1,0,0,0,313,315,1,0,0,0,314,312,1,0,0,0,315,
	316,5,6,0,0,316,7,1,0,0,0,317,318,5,8,0,0,318,319,5,175,0,0,319,322,5,9,
	0,0,320,323,3,230,115,0,321,323,5,10,0,0,322,320,1,0,0,0,322,321,1,0,0,
	0,323,325,1,0,0,0,324,326,5,11,0,0,325,324,1,0,0,0,325,326,1,0,0,0,326,
	327,1,0,0,0,327,353,5,2,0,0,328,329,5,8,0,0,329,330,5,4,0,0,330,335,3,10,
	5,0,331,332,5,5,0,0,332,334,3,10,5,0,333,331,1,0,0,0,334,337,1,0,0,0,335,
	333,1,0,0,0,335,336,1,0,0,0,336,339,1,0,0,0,337,335,1,0,0,0,338,340,5,5,
	0,0,339,338,1,0,0,0,339,340,1,0,0,0,340,341,1,0,0,0,341,342,5,6,0,0,342,
	345,5,9,0,0,343,346,3,230,115,0,344,346,5,10,0,0,345,343,1,0,0,0,345,344,
	1,0,0,0,346,348,1,0,0,0,347,349,5,11,0,0,348,347,1,0,0,0,348,349,1,0,0,
	0,349,350,1,0,0,0,350,351,5,2,0,0,351,353,1,0,0,0,352,317,1,0,0,0,352,328,
	1,0,0,0,353,9,1,0,0,0,354,357,5,175,0,0,355,356,5,12,0,0,356,358,5,175,
	0,0,357,355,1,0,0,0,357,358,1,0,0,0,358,361,1,0,0,0,359,360,5,3,0,0,360,
	362,3,12,6,0,361,359,1,0,0,0,361,362,1,0,0,0,362,11,1,0,0,0,363,364,7,0,
	0,0,364,13,1,0,0,0,365,366,7,1,0,0,366,15,1,0,0,0,367,368,5,37,0,0,368,
	369,3,18,9,0,369,370,3,20,10,0,370,371,5,2,0,0,371,17,1,0,0,0,372,373,7,
	2,0,0,373,19,1,0,0,0,374,376,3,22,11,0,375,377,3,22,11,0,376,375,1,0,0,
	0,376,377,1,0,0,0,377,21,1,0,0,0,378,380,3,24,12,0,379,378,1,0,0,0,379,
	380,1,0,0,0,380,381,1,0,0,0,381,382,5,152,0,0,382,23,1,0,0,0,383,384,7,
	3,0,0,384,25,1,0,0,0,385,386,5,41,0,0,386,396,5,175,0,0,387,388,5,42,0,
	0,388,393,5,175,0,0,389,390,5,5,0,0,390,392,5,175,0,0,391,389,1,0,0,0,392,
	395,1,0,0,0,393,391,1,0,0,0,393,394,1,0,0,0,394,397,1,0,0,0,395,393,1,0,
	0,0,396,387,1,0,0,0,396,397,1,0,0,0,397,398,1,0,0,0,398,409,5,4,0,0,399,
	408,3,54,27,0,400,408,3,50,25,0,401,408,3,58,29,0,402,408,3,42,21,0,403,
	408,3,46,23,0,404,408,3,30,15,0,405,408,3,28,14,0,406,408,3,34,17,0,407,
	399,1,0,0,0,407,400,1,0,0,0,407,401,1,0,0,0,407,402,1,0,0,0,407,403,1,0,
	0,0,407,404,1,0,0,0,407,405,1,0,0,0,407,406,1,0,0,0,408,411,1,0,0,0,409,
	407,1,0,0,0,409,410,1,0,0,0,410,412,1,0,0,0,411,409,1,0,0,0,412,413,5,6,
	0,0,413,27,1,0,0,0,414,415,3,32,16,0,415,416,3,78,39,0,416,417,5,175,0,
	0,417,418,5,2,0,0,418,425,1,0,0,0,419,420,3,32,16,0,420,421,3,80,40,0,421,
	422,5,175,0,0,422,423,5,2,0,0,423,425,1,0,0,0,424,414,1,0,0,0,424,419,1,
	0,0,0,425,29,1,0,0,0,426,427,3,32,16,0,427,428,3,230,115,0,428,429,5,175,
	0,0,429,430,5,2,0,0,430,31,1,0,0,0,431,432,7,4,0,0,432,33,1,0,0,0,433,434,
	5,7,0,0,434,435,5,175,0,0,435,439,3,102,51,0,436,438,3,92,46,0,437,436,
	1,0,0,0,438,441,1,0,0,0,439,437,1,0,0,0,439,440,1,0,0,0,440,443,1,0,0,0,
	441,439,1,0,0,0,442,444,3,98,49,0,443,442,1,0,0,0,443,444,1,0,0,0,444,445,
	1,0,0,0,445,446,5,2,0,0,446,35,1,0,0,0,447,448,5,45,0,0,448,449,5,175,0,
	0,449,453,5,4,0,0,450,452,3,54,27,0,451,450,1,0,0,0,452,455,1,0,0,0,453,
	451,1,0,0,0,453,454,1,0,0,0,454,459,1,0,0,0,455,453,1,0,0,0,456,458,3,50,
	25,0,457,456,1,0,0,0,458,461,1,0,0,0,459,457,1,0,0,0,459,460,1,0,0,0,460,
	465,1,0,0,0,461,459,1,0,0,0,462,464,3,58,29,0,463,462,1,0,0,0,464,467,1,
	0,0,0,465,463,1,0,0,0,465,466,1,0,0,0,466,471,1,0,0,0,467,465,1,0,0,0,468,
	470,3,42,21,0,469,468,1,0,0,0,470,473,1,0,0,0,471,469,1,0,0,0,471,472,1,
	0,0,0,472,477,1,0,0,0,473,471,1,0,0,0,474,476,3,46,23,0,475,474,1,0,0,0,
	476,479,1,0,0,0,477,475,1,0,0,0,477,478,1,0,0,0,478,483,1,0,0,0,479,477,
	1,0,0,0,480,482,3,60,30,0,481,480,1,0,0,0,482,485,1,0,0,0,483,481,1,0,0,
	0,483,484,1,0,0,0,484,489,1,0,0,0,485,483,1,0,0,0,486,488,3,8,4,0,487,486,
	1,0,0,0,488,491,1,0,0,0,489,487,1,0,0,0,489,490,1,0,0,0,490,495,1,0,0,0,
	491,489,1,0,0,0,492,494,3,6,3,0,493,492,1,0,0,0,494,497,1,0,0,0,495,493,
	1,0,0,0,495,496,1,0,0,0,496,498,1,0,0,0,497,495,1,0,0,0,498,499,5,6,0,0,
	499,37,1,0,0,0,500,502,5,46,0,0,501,500,1,0,0,0,501,502,1,0,0,0,502,503,
	1,0,0,0,503,504,5,47,0,0,504,506,5,175,0,0,505,507,3,102,51,0,506,505,1,
	0,0,0,506,507,1,0,0,0,507,517,1,0,0,0,508,509,5,42,0,0,509,514,5,175,0,
	0,510,511,5,5,0,0,511,513,5,175,0,0,512,510,1,0,0,0,513,516,1,0,0,0,514,
	512,1,0,0,0,514,515,1,0,0,0,515,518,1,0,0,0,516,514,1,0,0,0,517,508,1,0,
	0,0,517,518,1,0,0,0,518,519,1,0,0,0,519,536,5,4,0,0,520,535,3,54,27,0,521,
	535,3,50,25,0,522,535,3,58,29,0,523,535,3,42,21,0,524,535,3,46,23,0,525,
	535,3,60,30,0,526,535,3,8,4,0,527,535,3,72,36,0,528,535,3,82,41,0,529,535,
	3,62,31,0,530,535,3,88,44,0,531,535,3,40,20,0,532,535,3,64,32,0,533,535,
	3,68,34,0,534,520,1,0,0,0,534,521,1,0,0,0,534,522,1,0,0,0,534,523,1,0,0,
	0,534,524,1,0,0,0,534,525,1,0,0,0,534,526,1,0,0,0,534,527,1,0,0,0,534,528,
	1,0,0,0,534,529,1,0,0,0,534,530,1,0,0,0,534,531,1,0,0,0,534,532,1,0,0,0,
	534,533,1,0,0,0,535,538,1,0,0,0,536,534,1,0,0,0,536,537,1,0,0,0,537,539,
	1,0,0,0,538,536,1,0,0,0,539,540,5,6,0,0,540,39,1,0,0,0,541,542,5,7,0,0,
	542,543,3,14,7,0,543,547,3,102,51,0,544,546,3,92,46,0,545,544,1,0,0,0,546,
	549,1,0,0,0,547,545,1,0,0,0,547,548,1,0,0,0,548,553,1,0,0,0,549,547,1,0,
	0,0,550,552,3,90,45,0,551,550,1,0,0,0,552,555,1,0,0,0,553,551,1,0,0,0,553,
	554,1,0,0,0,554,557,1,0,0,0,555,553,1,0,0,0,556,558,3,98,49,0,557,556,1,
	0,0,0,557,558,1,0,0,0,558,559,1,0,0,0,559,560,5,2,0,0,560,41,1,0,0,0,561,
	562,5,48,0,0,562,563,5,175,0,0,563,575,5,49,0,0,564,569,3,44,22,0,565,566,
	5,5,0,0,566,568,3,44,22,0,567,565,1,0,0,0,568,571,1,0,0,0,569,567,1,0,0,
	0,569,570,1,0,0,0,570,573,1,0,0,0,571,569,1,0,0,0,572,574,5,5,0,0,573,572,
	1,0,0,0,573,574,1,0,0,0,574,576,1,0,0,0,575,564,1,0,0,0,575,576,1,0,0,0,
	576,577,1,0,0,0,577,579,5,50,0,0,578,580,5,51,0,0,579,578,1,0,0,0,579,580,
	1,0,0,0,580,581,1,0,0,0,581,582,5,2,0,0,582,43,1,0,0,0,583,585,3,230,115,
	0,584,586,5,52,0,0,585,584,1,0,0,0,585,586,1,0,0,0,586,587,1,0,0,0,587,
	588,5,175,0,0,588,45,1,0,0,0,589,590,5,35,0,0,590,591,5,175,0,0,591,603,
	5,49,0,0,592,597,3,48,24,0,593,594,5,5,0,0,594,596,3,48,24,0,595,593,1,
	0,0,0,596,599,1,0,0,0,597,595,1,0,0,0,597,598,1,0,0,0,598,601,1,0,0,0,599,
	597,1,0,0,0,600,602,5,5,0,0,601,600,1,0,0,0,601,602,1,0,0,0,602,604,1,0,
	0,0,603,592,1,0,0,0,603,604,1,0,0,0,604,605,1,0,0,0,605,606,5,50,0,0,606,
	607,5,2,0,0,607,47,1,0,0,0,608,609,3,230,115,0,609,610,5,175,0,0,610,49,
	1,0,0,0,611,612,5,53,0,0,612,613,5,175,0,0,613,615,5,4,0,0,614,616,3,52,
	26,0,615,614,1,0,0,0,616,617,1,0,0,0,617,615,1,0,0,0,617,618,1,0,0,0,618,
	619,1,0,0,0,619,620,5,6,0,0,620,51,1,0,0,0,621,624,3,230,115,0,622,624,
	3,80,40,0,623,621,1,0,0,0,623,622,1,0,0,0,624,625,1,0,0,0,625,626,3,14,
	7,0,626,627,5,2,0,0,627,53,1,0,0,0,628,629,5,54,0,0,629,630,5,175,0,0,630,
	631,5,4,0,0,631,636,3,56,28,0,632,633,5,5,0,0,633,635,3,56,28,0,634,632,
	1,0,0,0,635,638,1,0,0,0,636,634,1,0,0,0,636,637,1,0,0,0,637,640,1,0,0,0,
	638,636,1,0,0,0,639,641,5,5,0,0,640,639,1,0,0,0,640,641,1,0,0,0,641,642,
	1,0,0,0,642,643,5,6,0,0,643,55,1,0,0,0,644,647,5,175,0,0,645,646,5,40,0,
	0,646,648,5,157,0,0,647,645,1,0,0,0,647,648,1,0,0,0,648,57,1,0,0,0,649,
	650,5,55,0,0,650,651,5,175,0,0,651,652,5,42,0,0,652,653,3,230,115,0,653,
	654,5,2,0,0,654,59,1,0,0,0,655,656,3,230,115,0,656,657,5,56,0,0,657,658,
	5,175,0,0,658,659,5,40,0,0,659,660,3,218,109,0,660,661,5,2,0,0,661,61,1,
	0,0,0,662,663,5,57,0,0,663,667,3,102,51,0,664,666,7,5,0,0,665,664,1,0,0,
	0,666,669,1,0,0,0,667,665,1,0,0,0,667,668,1,0,0,0,668,673,1,0,0,0,669,667,
	1,0,0,0,670,672,3,70,35,0,671,670,1,0,0,0,672,675,1,0,0,0,673,671,1,0,0,
	0,673,674,1,0,0,0,674,676,1,0,0,0,675,673,1,0,0,0,676,680,5,4,0,0,677,679,
	3,108,54,0,678,677,1,0,0,0,679,682,1,0,0,0,680,678,1,0,0,0,680,681,1,0,
	0,0,681,683,1,0,0,0,682,680,1,0,0,0,683,684,5,6,0,0,684,63,1,0,0,0,685,
	686,5,60,0,0,686,687,3,102,51,0,687,691,5,44,0,0,688,690,3,66,33,0,689,
	688,1,0,0,0,690,693,1,0,0,0,691,689,1,0,0,0,691,692,1,0,0,0,692,697,1,0,
	0,0,693,691,1,0,0,0,694,696,3,90,45,0,695,694,1,0,0,0,696,699,1,0,0,0,697,
	695,1,0,0,0,697,698,1,0,0,0,698,700,1,0,0,0,699,697,1,0,0,0,700,704,5,4,
	0,0,701,703,3,108,54,0,702,701,1,0,0,0,703,706,1,0,0,0,704,702,1,0,0,0,
	704,705,1,0,0,0,705,707,1,0,0,0,706,704,1,0,0,0,707,708,5,6,0,0,708,65,
	1,0,0,0,709,713,5,59,0,0,710,713,5,61,0,0,711,713,3,94,47,0,712,709,1,0,
	0,0,712,710,1,0,0,0,712,711,1,0,0,0,713,67,1,0,0,0,714,715,5,62,0,0,715,
	716,5,49,0,0,716,717,5,50,0,0,717,718,5,44,0,0,718,719,5,59,0,0,719,723,
	5,4,0,0,720,722,3,108,54,0,721,720,1,0,0,0,722,725,1,0,0,0,723,721,1,0,
	0,0,723,724,1,0,0,0,724,726,1,0,0,0,725,723,1,0,0,0,726,727,5,6,0,0,727,
	69,1,0,0,0,728,729,5,175,0,0,729,730,3,210,105,0,730,71,1,0,0,0,731,733,
	3,76,38,0,732,731,1,0,0,0,732,733,1,0,0,0,733,734,1,0,0,0,734,738,3,230,
	115,0,735,737,3,222,111,0,736,735,1,0,0,0,737,740,1,0,0,0,738,736,1,0,0,
	0,738,739,1,0,0,0,739,741,1,0,0,0,740,738,1,0,0,0,741,744,5,175,0,0,742,
	743,5,40,0,0,743,745,3,218,109,0,744,742,1,0,0,0,744,745,1,0,0,0,745,746,
	1,0,0,0,746,747,5,2,0,0,747,794,1,0,0,0,748,749,3,230,115,0,749,753,3,76,
	38,0,750,752,3,222,111,0,751,750,1,0,0,0,752,755,1,0,0,0,753,751,1,0,0,
	0,753,754,1,0,0,0,754,756,1,0,0,0,755,753,1,0,0,0,756,759,5,175,0,0,757,
	758,5,40,0,0,758,760,3,218,109,0,759,757,1,0,0,0,759,760,1,0,0,0,760,761,
	1,0,0,0,761,762,5,2,0,0,762,794,1,0,0,0,763,765,3,76,38,0,764,763,1,0,0,
	0,764,765,1,0,0,0,765,766,1,0,0,0,766,770,3,78,39,0,767,769,3,74,37,0,768,
	767,1,0,0,0,769,772,1,0,0,0,770,768,1,0,0,0,770,771,1,0,0,0,771,773,1,0,
	0,0,772,770,1,0,0,0,773,774,5,175,0,0,774,775,5,2,0,0,775,794,1,0,0,0,776,
	778,3,76,38,0,777,776,1,0,0,0,777,778,1,0,0,0,778,779,1,0,0,0,779,783,3,
	80,40,0,780,782,3,74,37,0,781,780,1,0,0,0,782,785,1,0,0,0,783,781,1,0,0,
	0,783,784,1,0,0,0,784,786,1,0,0,0,785,783,1,0,0,0,786,789,5,175,0,0,787,
	788,5,40,0,0,788,790,3,218,109,0,789,787,1,0,0,0,789,790,1,0,0,0,790,791,
	1,0,0,0,791,792,5,2,0,0,792,794,1,0,0,0,793,732,1,0,0,0,793,748,1,0,0,0,
	793,764,1,0,0,0,793,777,1,0,0,0,794,73,1,0,0,0,795,798,3,222,111,0,796,
	798,3,76,38,0,797,795,1,0,0,0,797,796,1,0,0,0,798,75,1,0,0,0,799,800,7,
	6,0,0,800,77,1,0,0,0,801,802,5,64,0,0,802,803,5,49,0,0,803,805,3,230,115,
	0,804,806,5,175,0,0,805,804,1,0,0,0,805,806,1,0,0,0,806,807,1,0,0,0,807,
	808,5,65,0,0,808,810,3,230,115,0,809,811,5,175,0,0,810,809,1,0,0,0,810,
	811,1,0,0,0,811,812,1,0,0,0,812,813,5,50,0,0,813,838,1,0,0,0,814,815,5,
	64,0,0,815,816,5,49,0,0,816,818,3,230,115,0,817,819,5,175,0,0,818,817,1,
	0,0,0,818,819,1,0,0,0,819,820,1,0,0,0,820,821,5,65,0,0,821,822,3,78,39,
	0,822,823,5,50,0,0,823,838,1,0,0,0,824,825,5,64,0,0,825,826,5,49,0,0,826,
	828,3,230,115,0,827,829,5,175,0,0,828,827,1,0,0,0,828,829,1,0,0,0,829,830,
	1,0,0,0,830,831,5,65,0,0,831,833,3,80,40,0,832,834,5,175,0,0,833,832,1,
	0,0,0,833,834,1,0,0,0,834,835,1,0,0,0,835,836,5,50,0,0,836,838,1,0,0,0,
	837,801,1,0,0,0,837,814,1,0,0,0,837,824,1,0,0,0,838,79,1,0,0,0,839,840,
	6,40,-1,0,840,841,3,230,115,0,841,842,5,66,0,0,842,843,5,157,0,0,843,844,
	5,67,0,0,844,850,1,0,0,0,845,846,3,230,115,0,846,847,5,66,0,0,847,848,5,
	67,0,0,848,850,1,0,0,0,849,839,1,0,0,0,849,845,1,0,0,0,850,860,1,0,0,0,
	851,852,10,2,0,0,852,853,5,66,0,0,853,854,5,157,0,0,854,859,5,67,0,0,855,
	856,10,1,0,0,856,857,5,66,0,0,857,859,5,67,0,0,858,851,1,0,0,0,858,855,
	1,0,0,0,859,862,1,0,0,0,860,858,1,0,0,0,860,861,1,0,0,0,861,81,1,0,0,0,
	862,860,1,0,0,0,863,864,5,68,0,0,864,866,5,175,0,0,865,867,3,102,51,0,866,
	865,1,0,0,0,866,867,1,0,0,0,867,868,1,0,0,0,868,872,5,4,0,0,869,871,3,84,
	42,0,870,869,1,0,0,0,871,874,1,0,0,0,872,870,1,0,0,0,872,873,1,0,0,0,873,
	875,1,0,0,0,874,872,1,0,0,0,875,876,5,6,0,0,876,83,1,0,0,0,877,880,3,86,
	43,0,878,880,3,108,54,0,879,877,1,0,0,0,879,878,1,0,0,0,880,85,1,0,0,0,
	881,882,5,69,0,0,882,883,5,2,0,0,883,87,1,0,0,0,884,885,5,7,0,0,885,886,
	3,14,7,0,886,890,3,102,51,0,887,889,3,92,46,0,888,887,1,0,0,0,889,892,1,
	0,0,0,890,888,1,0,0,0,890,891,1,0,0,0,891,896,1,0,0,0,892,890,1,0,0,0,893,
	895,3,90,45,0,894,893,1,0,0,0,895,898,1,0,0,0,896,894,1,0,0,0,896,897,1,
	0,0,0,897,900,1,0,0,0,898,896,1,0,0,0,899,901,3,98,49,0,900,899,1,0,0,0,
	900,901,1,0,0,0,901,902,1,0,0,0,902,906,5,4,0,0,903,905,3,108,54,0,904,
	903,1,0,0,0,905,908,1,0,0,0,906,904,1,0,0,0,906,907,1,0,0,0,907,909,1,0,
	0,0,908,906,1,0,0,0,909,910,5,6,0,0,910,89,1,0,0,0,911,913,5,175,0,0,912,
	914,3,210,105,0,913,912,1,0,0,0,913,914,1,0,0,0,914,91,1,0,0,0,915,930,
	5,70,0,0,916,930,5,71,0,0,917,930,5,58,0,0,918,930,5,44,0,0,919,930,5,43,
	0,0,920,930,5,63,0,0,921,930,5,59,0,0,922,930,3,94,47,0,923,930,5,61,0,
	0,924,930,3,96,48,0,925,930,5,30,0,0,926,930,5,28,0,0,927,930,5,31,0,0,
	928,930,5,29,0,0,929,915,1,0,0,0,929,916,1,0,0,0,929,917,1,0,0,0,929,918,
	1,0,0,0,929,919,1,0,0,0,929,920,1,0,0,0,929,921,1,0,0,0,929,922,1,0,0,0,
	929,923,1,0,0,0,929,924,1,0,0,0,929,925,1,0,0,0,929,926,1,0,0,0,929,927,
	1,0,0,0,929,928,1,0,0,0,930,93,1,0,0,0,931,942,5,72,0,0,932,933,5,49,0,
	0,933,938,5,175,0,0,934,935,5,5,0,0,935,937,5,175,0,0,936,934,1,0,0,0,937,
	940,1,0,0,0,938,936,1,0,0,0,938,939,1,0,0,0,939,941,1,0,0,0,940,938,1,0,
	0,0,941,943,5,50,0,0,942,932,1,0,0,0,942,943,1,0,0,0,943,95,1,0,0,0,944,
	948,5,32,0,0,945,946,5,49,0,0,946,947,5,157,0,0,947,949,5,50,0,0,948,945,
	1,0,0,0,948,949,1,0,0,0,949,97,1,0,0,0,950,951,5,73,0,0,951,952,5,49,0,
	0,952,957,3,100,50,0,953,954,5,5,0,0,954,956,3,100,50,0,955,953,1,0,0,0,
	956,959,1,0,0,0,957,955,1,0,0,0,957,958,1,0,0,0,958,961,1,0,0,0,959,957,
	1,0,0,0,960,962,5,5,0,0,961,960,1,0,0,0,961,962,1,0,0,0,962,963,1,0,0,0,
	963,964,5,50,0,0,964,99,1,0,0,0,965,969,3,230,115,0,966,968,3,222,111,0,
	967,966,1,0,0,0,968,971,1,0,0,0,969,967,1,0,0,0,969,970,1,0,0,0,970,973,
	1,0,0,0,971,969,1,0,0,0,972,974,3,14,7,0,973,972,1,0,0,0,973,974,1,0,0,
	0,974,986,1,0,0,0,975,979,3,80,40,0,976,978,3,222,111,0,977,976,1,0,0,0,
	978,981,1,0,0,0,979,977,1,0,0,0,979,980,1,0,0,0,980,983,1,0,0,0,981,979,
	1,0,0,0,982,984,3,14,7,0,983,982,1,0,0,0,983,984,1,0,0,0,984,986,1,0,0,
	0,985,965,1,0,0,0,985,975,1,0,0,0,986,101,1,0,0,0,987,999,5,49,0,0,988,
	993,3,104,52,0,989,990,5,5,0,0,990,992,3,104,52,0,991,989,1,0,0,0,992,995,
	1,0,0,0,993,991,1,0,0,0,993,994,1,0,0,0,994,997,1,0,0,0,995,993,1,0,0,0,
	996,998,5,5,0,0,997,996,1,0,0,0,997,998,1,0,0,0,998,1000,1,0,0,0,999,988,
	1,0,0,0,999,1000,1,0,0,0,1000,1001,1,0,0,0,1001,1002,5,50,0,0,1002,103,
	1,0,0,0,1003,1007,3,230,115,0,1004,1006,3,222,111,0,1005,1004,1,0,0,0,1006,
	1009,1,0,0,0,1007,1005,1,0,0,0,1007,1008,1,0,0,0,1008,1011,1,0,0,0,1009,
	1007,1,0,0,0,1010,1012,3,14,7,0,1011,1010,1,0,0,0,1011,1012,1,0,0,0,1012,
	1024,1,0,0,0,1013,1017,3,80,40,0,1014,1016,3,222,111,0,1015,1014,1,0,0,
	0,1016,1019,1,0,0,0,1017,1015,1,0,0,0,1017,1018,1,0,0,0,1018,1021,1,0,0,
	0,1019,1017,1,0,0,0,1020,1022,3,14,7,0,1021,1020,1,0,0,0,1021,1022,1,0,
	0,0,1022,1024,1,0,0,0,1023,1003,1,0,0,0,1023,1013,1,0,0,0,1024,105,1,0,
	0,0,1025,1029,5,4,0,0,1026,1028,3,108,54,0,1027,1026,1,0,0,0,1028,1031,
	1,0,0,0,1029,1027,1,0,0,0,1029,1030,1,0,0,0,1030,1032,1,0,0,0,1031,1029,
	1,0,0,0,1032,1035,5,6,0,0,1033,1035,3,108,54,0,1034,1025,1,0,0,0,1034,1033,
	1,0,0,0,1035,107,1,0,0,0,1036,1067,3,126,63,0,1037,1067,3,128,64,0,1038,
	1067,3,134,67,0,1039,1067,3,136,68,0,1040,1067,3,138,69,0,1041,1067,3,140,
	70,0,1042,1067,3,142,71,0,1043,1067,3,132,66,0,1044,1067,3,122,61,0,1045,
	1067,3,124,62,0,1046,1067,3,146,73,0,1047,1067,3,148,74,0,1048,1067,3,150,
	75,0,1049,1067,3,152,76,0,1050,1067,3,172,86,0,1051,1067,3,120,60,0,1052,
	1067,3,110,55,0,1053,1067,3,112,56,0,1054,1067,3,114,57,0,1055,1067,3,116,
	58,0,1056,1067,3,118,59,0,1057,1067,3,174,87,0,1058,1067,3,186,93,0,1059,
	1067,3,198,99,0,1060,1067,3,200,100,0,1061,1067,3,144,72,0,1062,1067,3,
	178,89,0,1063,1067,3,180,90,0,1064,1067,3,192,96,0,1065,1067,3,194,97,0,
	1066,1036,1,0,0,0,1066,1037,1,0,0,0,1066,1038,1,0,0,0,1066,1039,1,0,0,0,
	1066,1040,1,0,0,0,1066,1041,1,0,0,0,1066,1042,1,0,0,0,1066,1043,1,0,0,0,
	1066,1044,1,0,0,0,1066,1045,1,0,0,0,1066,1046,1,0,0,0,1066,1047,1,0,0,0,
	1066,1048,1,0,0,0,1066,1049,1,0,0,0,1066,1050,1,0,0,0,1066,1051,1,0,0,0,
	1066,1052,1,0,0,0,1066,1053,1,0,0,0,1066,1054,1,0,0,0,1066,1055,1,0,0,0,
	1066,1056,1,0,0,0,1066,1057,1,0,0,0,1066,1058,1,0,0,0,1066,1059,1,0,0,0,
	1066,1060,1,0,0,0,1066,1061,1,0,0,0,1066,1062,1,0,0,0,1066,1063,1,0,0,0,
	1066,1064,1,0,0,0,1066,1065,1,0,0,0,1067,109,1,0,0,0,1068,1069,5,74,0,0,
	1069,1070,5,12,0,0,1070,1071,5,175,0,0,1071,1072,5,49,0,0,1072,1073,3,218,
	109,0,1073,1074,5,5,0,0,1074,1075,3,218,109,0,1075,1076,5,50,0,0,1076,1077,
	5,2,0,0,1077,111,1,0,0,0,1078,1079,5,74,0,0,1079,1080,5,12,0,0,1080,1081,
	5,175,0,0,1081,1082,5,66,0,0,1082,1083,3,218,109,0,1083,1084,5,67,0,0,1084,
	1085,5,12,0,0,1085,1086,5,175,0,0,1086,1087,5,49,0,0,1087,1092,3,218,109,
	0,1088,1089,5,5,0,0,1089,1091,3,218,109,0,1090,1088,1,0,0,0,1091,1094,1,
	0,0,0,1092,1090,1,0,0,0,1092,1093,1,0,0,0,1093,1095,1,0,0,0,1094,1092,1,
	0,0,0,1095,1096,5,50,0,0,1096,1097,5,2,0,0,1097,113,1,0,0,0,1098,1099,5,
	75,0,0,1099,1128,5,2,0,0,1100,1101,5,75,0,0,1101,1106,3,218,109,0,1102,
	1103,5,5,0,0,1103,1105,3,218,109,0,1104,1102,1,0,0,0,1105,1108,1,0,0,0,
	1106,1104,1,0,0,0,1106,1107,1,0,0,0,1107,1109,1,0,0,0,1108,1106,1,0,0,0,
	1109,1110,5,2,0,0,1110,1128,1,0,0,0,1111,1112,5,75,0,0,1112,1113,5,49,0,
	0,1113,1118,3,218,109,0,1114,1115,5,5,0,0,1115,1117,3,218,109,0,1116,1114,
	1,0,0,0,1117,1120,1,0,0,0,1118,1116,1,0,0,0,1118,1119,1,0,0,0,1119,1122,
	1,0,0,0,1120,1118,1,0,0,0,1121,1123,5,5,0,0,1122,1121,1,0,0,0,1122,1123,
	1,0,0,0,1123,1124,1,0,0,0,1124,1125,5,50,0,0,1125,1126,5,2,0,0,1126,1128,
	1,0,0,0,1127,1098,1,0,0,0,1127,1100,1,0,0,0,1127,1111,1,0,0,0,1128,115,
	1,0,0,0,1129,1132,5,175,0,0,1130,1131,5,12,0,0,1131,1133,5,175,0,0,1132,
	1130,1,0,0,0,1132,1133,1,0,0,0,1133,1134,1,0,0,0,1134,1135,5,49,0,0,1135,
	1147,5,4,0,0,1136,1141,3,208,104,0,1137,1138,5,5,0,0,1138,1140,3,208,104,
	0,1139,1137,1,0,0,0,1140,1143,1,0,0,0,1141,1139,1,0,0,0,1141,1142,1,0,0,
	0,1142,1145,1,0,0,0,1143,1141,1,0,0,0,1144,1146,5,5,0,0,1145,1144,1,0,0,
	0,1145,1146,1,0,0,0,1146,1148,1,0,0,0,1147,1136,1,0,0,0,1147,1148,1,0,0,
	0,1148,1149,1,0,0,0,1149,1150,5,6,0,0,1150,1151,5,50,0,0,1151,1175,5,2,
	0,0,1152,1153,5,175,0,0,1153,1154,3,210,105,0,1154,1155,5,2,0,0,1155,1175,
	1,0,0,0,1156,1157,5,175,0,0,1157,1158,5,12,0,0,1158,1159,5,175,0,0,1159,
	1160,3,210,105,0,1160,1161,5,2,0,0,1161,1175,1,0,0,0,1162,1163,5,175,0,
	0,1163,1164,3,210,105,0,1164,1165,5,12,0,0,1165,1166,5,175,0,0,1166,1167,
	5,12,0,0,1167,1169,5,175,0,0,1168,1170,3,212,106,0,1169,1168,1,0,0,0,1169,
	1170,1,0,0,0,1170,1171,1,0,0,0,1171,1172,3,210,105,0,1172,1173,5,2,0,0,
	1173,1175,1,0,0,0,1174,1129,1,0,0,0,1174,1152,1,0,0,0,1174,1156,1,0,0,0,
	1174,1162,1,0,0,0,1175,117,1,0,0,0,1176,1177,3,218,109,0,1177,1178,5,12,
	0,0,1178,1180,5,175,0,0,1179,1181,3,212,106,0,1180,1179,1,0,0,0,1180,1181,
	1,0,0,0,1181,1182,1,0,0,0,1182,1183,3,210,105,0,1183,1184,5,2,0,0,1184,
	119,1,0,0,0,1185,1186,5,76,0,0,1186,1189,5,175,0,0,1187,1188,5,12,0,0,1188,
	1190,5,175,0,0,1189,1187,1,0,0,0,1189,1190,1,0,0,0,1190,1191,1,0,0,0,1191,
	1192,5,49,0,0,1192,1204,5,4,0,0,1193,1198,3,208,104,0,1194,1195,5,5,0,0,
	1195,1197,3,208,104,0,1196,1194,1,0,0,0,1197,1200,1,0,0,0,1198,1196,1,0,
	0,0,1198,1199,1,0,0,0,1199,1202,1,0,0,0,1200,1198,1,0,0,0,1201,1203,5,5,
	0,0,1202,1201,1,0,0,0,1202,1203,1,0,0,0,1203,1205,1,0,0,0,1204,1193,1,0,
	0,0,1204,1205,1,0,0,0,1205,1206,1,0,0,0,1206,1207,5,6,0,0,1207,1208,5,50,
	0,0,1208,1219,5,2,0,0,1209,1210,5,76,0,0,1210,1213,5,175,0,0,1211,1212,
	5,12,0,0,1212,1214,5,175,0,0,1213,1211,1,0,0,0,1213,1214,1,0,0,0,1214,1215,
	1,0,0,0,1215,1216,3,210,105,0,1216,1217,5,2,0,0,1217,1219,1,0,0,0,1218,
	1185,1,0,0,0,1218,1209,1,0,0,0,1219,121,1,0,0,0,1220,1221,5,74,0,0,1221,
	1222,5,12,0,0,1222,1231,5,175,0,0,1223,1224,5,66,0,0,1224,1225,3,218,109,
	0,1225,1226,5,67,0,0,1226,1228,1,0,0,0,1227,1223,1,0,0,0,1228,1229,1,0,
	0,0,1229,1227,1,0,0,0,1229,1230,1,0,0,0,1230,1232,1,0,0,0,1231,1227,1,0,
	0,0,1231,1232,1,0,0,0,1232,1237,1,0,0,0,1233,1234,5,12,0,0,1234,1236,5,
	175,0,0,1235,1233,1,0,0,0,1236,1239,1,0,0,0,1237,1235,1,0,0,0,1237,1238,
	1,0,0,0,1238,1240,1,0,0,0,1239,1237,1,0,0,0,1240,1241,7,7,0,0,1241,1242,
	3,218,109,0,1242,1243,5,2,0,0,1243,1276,1,0,0,0,1244,1249,5,175,0,0,1245,
	1246,5,66,0,0,1246,1247,3,218,109,0,1247,1248,5,67,0,0,1248,1250,1,0,0,
	0,1249,1245,1,0,0,0,1250,1251,1,0,0,0,1251,1249,1,0,0,0,1251,1252,1,0,0,
	0,1252,1257,1,0,0,0,1253,1254,5,12,0,0,1254,1256,5,175,0,0,1255,1253,1,
	0,0,0,1256,1259,1,0,0,0,1257,1255,1,0,0,0,1257,1258,1,0,0,0,1258,1260,1,
	0,0,0,1259,1257,1,0,0,0,1260,1261,7,7,0,0,1261,1262,3,218,109,0,1262,1263,
	5,2,0,0,1263,1276,1,0,0,0,1264,1267,5,175,0,0,1265,1266,5,12,0,0,1266,1268,
	5,175,0,0,1267,1265,1,0,0,0,1268,1269,1,0,0,0,1269,1267,1,0,0,0,1269,1270,
	1,0,0,0,1270,1271,1,0,0,0,1271,1272,7,7,0,0,1272,1273,3,218,109,0,1273,
	1274,5,2,0,0,1274,1276,1,0,0,0,1275,1220,1,0,0,0,1275,1244,1,0,0,0,1275,
	1264,1,0,0,0,1276,123,1,0,0,0,1277,1278,5,74,0,0,1278,1279,5,12,0,0,1279,
	1286,5,175,0,0,1280,1281,5,66,0,0,1281,1282,3,218,109,0,1282,1283,5,67,
	0,0,1283,1285,1,0,0,0,1284,1280,1,0,0,0,1285,1288,1,0,0,0,1286,1284,1,0,
	0,0,1286,1287,1,0,0,0,1287,1289,1,0,0,0,1288,1286,1,0,0,0,1289,1290,5,87,
	0,0,1290,1291,5,49,0,0,1291,1292,3,218,109,0,1292,1293,5,50,0,0,1293,1294,
	5,2,0,0,1294,125,1,0,0,0,1295,1299,3,230,115,0,1296,1298,3,222,111,0,1297,
	1296,1,0,0,0,1298,1301,1,0,0,0,1299,1297,1,0,0,0,1299,1300,1,0,0,0,1300,
	1302,1,0,0,0,1301,1299,1,0,0,0,1302,1305,3,14,7,0,1303,1304,5,40,0,0,1304,
	1306,3,218,109,0,1305,1303,1,0,0,0,1305,1306,1,0,0,0,1306,1307,1,0,0,0,
	1307,1308,5,2,0,0,1308,1324,1,0,0,0,1309,1313,3,80,40,0,1310,1312,3,222,
	111,0,1311,1310,1,0,0,0,1312,1315,1,0,0,0,1313,1311,1,0,0,0,1313,1314,1,
	0,0,0,1314,1316,1,0,0,0,1315,1313,1,0,0,0,1316,1319,3,14,7,0,1317,1318,
	5,40,0,0,1318,1320,3,218,109,0,1319,1317,1,0,0,0,1319,1320,1,0,0,0,1320,
	1321,1,0,0,0,1321,1322,5,2,0,0,1322,1324,1,0,0,0,1323,1295,1,0,0,0,1323,
	1309,1,0,0,0,1324,127,1,0,0,0,1325,1326,3,230,115,0,1326,1331,5,175,0,0,
	1327,1328,5,5,0,0,1328,1329,3,230,115,0,1329,1330,5,175,0,0,1330,1332,1,
	0,0,0,1331,1327,1,0,0,0,1332,1333,1,0,0,0,1333,1331,1,0,0,0,1333,1334,1,
	0,0,0,1334,1335,1,0,0,0,1335,1336,5,40,0,0,1336,1337,3,218,109,0,1337,1338,
	5,2,0,0,1338,1374,1,0,0,0,1339,1340,5,49,0,0,1340,1343,3,130,65,0,1341,
	1342,5,5,0,0,1342,1344,3,130,65,0,1343,1341,1,0,0,0,1344,1345,1,0,0,0,1345,
	1343,1,0,0,0,1345,1346,1,0,0,0,1346,1347,1,0,0,0,1347,1348,5,50,0,0,1348,
	1349,5,40,0,0,1349,1350,5,49,0,0,1350,1353,3,218,109,0,1351,1352,5,5,0,
	0,1352,1354,3,218,109,0,1353,1351,1,0,0,0,1354,1355,1,0,0,0,1355,1353,1,
	0,0,0,1355,1356,1,0,0,0,1356,1357,1,0,0,0,1357,1358,5,50,0,0,1358,1359,
	5,2,0,0,1359,1374,1,0,0,0,1360,1361,5,49,0,0,1361,1364,3,130,65,0,1362,
	1363,5,5,0,0,1363,1365,3,130,65,0,1364,1362,1,0,0,0,1365,1366,1,0,0,0,1366,
	1364,1,0,0,0,1366,1367,1,0,0,0,1367,1368,1,0,0,0,1368,1369,5,50,0,0,1369,
	1370,5,40,0,0,1370,1371,3,218,109,0,1371,1372,5,2,0,0,1372,1374,1,0,0,0,
	1373,1325,1,0,0,0,1373,1339,1,0,0,0,1373,1360,1,0,0,0,1374,129,1,0,0,0,
	1375,1379,3,230,115,0,1376,1378,3,222,111,0,1377,1376,1,0,0,0,1378,1381,
	1,0,0,0,1379,1377,1,0,0,0,1379,1380,1,0,0,0,1380,1382,1,0,0,0,1381,1379,
	1,0,0,0,1382,1383,5,175,0,0,1383,1387,1,0,0,0,1384,1387,5,175,0,0,1385,
	1387,1,0,0,0,1386,1375,1,0,0,0,1386,1384,1,0,0,0,1386,1385,1,0,0,0,1387,
	131,1,0,0,0,1388,1389,5,175,0,0,1389,1390,7,7,0,0,1390,1391,3,218,109,0,
	1391,1392,5,2,0,0,1392,1400,1,0,0,0,1393,1394,5,175,0,0,1394,1395,7,8,0,
	0,1395,1400,5,2,0,0,1396,1397,7,8,0,0,1397,1398,5,175,0,0,1398,1400,5,2,
	0,0,1399,1388,1,0,0,0,1399,1393,1,0,0,0,1399,1396,1,0,0,0,1400,133,1,0,
	0,0,1401,1402,5,175,0,0,1402,1403,5,90,0,0,1403,1404,5,49,0,0,1404,1405,
	3,218,109,0,1405,1406,5,50,0,0,1406,1407,5,2,0,0,1407,135,1,0,0,0,1408,
	1409,5,175,0,0,1409,1410,5,91,0,0,1410,1411,5,49,0,0,1411,1412,5,50,0,0,
	1412,1413,5,2,0,0,1413,137,1,0,0,0,1414,1415,5,175,0,0,1415,1416,5,87,0,
	0,1416,1417,5,49,0,0,1417,1418,3,218,109,0,1418,1419,5,50,0,0,1419,1420,
	5,2,0,0,1420,139,1,0,0,0,1421,1422,5,74,0,0,1422,1423,5,12,0,0,1423,1424,
	5,175,0,0,1424,1425,5,90,0,0,1425,1426,5,49,0,0,1426,1427,3,218,109,0,1427,
	1428,5,50,0,0,1428,1429,5,2,0,0,1429,141,1,0,0,0,1430,1431,5,74,0,0,1431,
	1432,5,12,0,0,1432,1433,5,175,0,0,1433,1434,5,91,0,0,1434,1435,5,49,0,0,
	1435,1436,5,50,0,0,1436,1437,5,2,0,0,1437,143,1,0,0,0,1438,1439,5,92,0,
	0,1439,1440,5,175,0,0,1440,1473,5,2,0,0,1441,1442,5,92,0,0,1442,1443,5,
	74,0,0,1443,1444,5,12,0,0,1444,1445,5,175,0,0,1445,1473,5,2,0,0,1446,1447,
	5,92,0,0,1447,1448,5,74,0,0,1448,1449,5,12,0,0,1449,1454,5,175,0,0,1450,
	1451,5,66,0,0,1451,1452,3,218,109,0,1452,1453,5,67,0,0,1453,1455,1,0,0,
	0,1454,1450,1,0,0,0,1455,1456,1,0,0,0,1456,1454,1,0,0,0,1456,1457,1,0,0,
	0,1457,1458,1,0,0,0,1458,1459,5,2,0,0,1459,1473,1,0,0,0,1460,1461,5,92,
	0,0,1461,1466,5,175,0,0,1462,1463,5,66,0,0,1463,1464,3,218,109,0,1464,1465,
	5,67,0,0,1465,1467,1,0,0,0,1466,1462,1,0,0,0,1467,1468,1,0,0,0,1468,1466,
	1,0,0,0,1468,1469,1,0,0,0,1469,1470,1,0,0,0,1470,1471,5,2,0,0,1471,1473,
	1,0,0,0,1472,1438,1,0,0,0,1472,1441,1,0,0,0,1472,1446,1,0,0,0,1472,1460,
	1,0,0,0,1473,145,1,0,0,0,1474,1475,5,93,0,0,1475,1476,5,49,0,0,1476,1477,
	5,166,0,0,1477,1478,5,23,0,0,1478,1481,3,218,109,0,1479,1480,5,5,0,0,1480,
	1482,3,196,98,0,1481,1479,1,0,0,0,1481,1482,1,0,0,0,1482,1483,1,0,0,0,1483,
	1484,5,50,0,0,1484,1485,5,2,0,0,1485,147,1,0,0,0,1486,1487,5,93,0,0,1487,
	1488,5,49,0,0,1488,1491,3,218,109,0,1489,1490,5,5,0,0,1490,1492,3,196,98,
	0,1491,1489,1,0,0,0,1491,1492,1,0,0,0,1492,1493,1,0,0,0,1493,1494,5,50,
	0,0,1494,1495,5,2,0,0,1495,149,1,0,0,0,1496,1497,5,94,0,0,1497,1498,5,49,
	0,0,1498,1499,3,218,109,0,1499,1500,5,50,0,0,1500,1503,3,106,53,0,1501,
	1502,5,95,0,0,1502,1504,3,106,53,0,1503,1501,1,0,0,0,1503,1504,1,0,0,0,
	1504,151,1,0,0,0,1505,1512,3,168,84,0,1506,1512,3,170,85,0,1507,1512,3,
	160,80,0,1508,1512,3,154,77,0,1509,1512,3,156,78,0,1510,1512,3,158,79,0,
	1511,1505,1,0,0,0,1511,1506,1,0,0,0,1511,1507,1,0,0,0,1511,1508,1,0,0,0,
	1511,1509,1,0,0,0,1511,1510,1,0,0,0,1512,153,1,0,0,0,1513,1514,5,9,0,0,
	1514,1515,5,49,0,0,1515,1516,3,230,115,0,1516,1517,5,175,0,0,1517,1518,
	5,5,0,0,1518,1519,3,230,115,0,1519,1520,5,175,0,0,1520,1521,5,96,0,0,1521,
	1522,5,74,0,0,1522,1523,5,12,0,0,1523,1524,5,175,0,0,1524,1525,5,12,0,0,
	1525,1526,5,34,0,0,1526,1527,5,50,0,0,1527,1528,3,106,53,0,1528,155,1,0,
	0,0,1529,1530,5,9,0,0,1530,1531,5,49,0,0,1531,1532,3,230,115,0,1532,1533,
	5,175,0,0,1533,1534,5,97,0,0,1534,1535,5,74,0,0,1535,1536,5,12,0,0,1536,
	1537,5,175,0,0,1537,1538,5,50,0,0,1538,1539,3,106,53,0,1539,157,1,0,0,0,
	1540,1541,5,9,0,0,1541,1542,5,49,0,0,1542,1543,3,230,115,0,1543,1544,5,
	175,0,0,1544,1545,5,96,0,0,1545,1546,5,74,0,0,1546,1547,5,12,0,0,1547,1548,
	5,175,0,0,1548,1549,5,50,0,0,1549,1550,3,106,53,0,1550,159,1,0,0,0,1551,
	1552,5,9,0,0,1552,1553,5,49,0,0,1553,1554,3,162,81,0,1554,1556,3,164,82,
	0,1555,1557,3,166,83,0,1556,1555,1,0,0,0,1556,1557,1,0,0,0,1557,1558,1,
	0,0,0,1558,1559,5,50,0,0,1559,1560,3,106,53,0,1560,161,1,0,0,0,1561,1565,
	3,230,115,0,1562,1564,3,222,111,0,1563,1562,1,0,0,0,1564,1567,1,0,0,0,1565,
	1563,1,0,0,0,1565,1566,1,0,0,0,1566,1568,1,0,0,0,1567,1565,1,0,0,0,1568,
	1571,5,175,0,0,1569,1570,5,40,0,0,1570,1572,3,218,109,0,1571,1569,1,0,0,
	0,1571,1572,1,0,0,0,1572,1573,1,0,0,0,1573,1574,5,2,0,0,1574,163,1,0,0,
	0,1575,1576,3,218,109,0,1576,1577,5,2,0,0,1577,165,1,0,0,0,1578,1579,5,
	175,0,0,1579,1580,7,7,0,0,1580,1584,3,218,109,0,1581,1582,5,175,0,0,1582,
	1584,7,8,0,0,1583,1578,1,0,0,0,1583,1581,1,0,0,0,1584,167,1,0,0,0,1585,
	1586,5,98,0,0,1586,1587,3,106,53,0,1587,1588,5,99,0,0,1588,1589,5,49,0,
	0,1589,1590,3,218,109,0,1590,1591,5,50,0,0,1591,1592,5,2,0,0,1592,169,1,
	0,0,0,1593,1594,5,99,0,0,1594,1595,5,49,0,0,1595,1596,3,218,109,0,1596,
	1597,5,50,0,0,1597,1598,3,106,53,0,1598,171,1,0,0,0,1599,1600,5,100,0,0,
	1600,1601,3,204,102,0,1601,1602,5,2,0,0,1602,173,1,0,0,0,1603,1604,5,101,
	0,0,1604,1608,5,4,0,0,1605,1607,3,176,88,0,1606,1605,1,0,0,0,1607,1610,
	1,0,0,0,1608,1606,1,0,0,0,1608,1609,1,0,0,0,1609,1611,1,0,0,0,1610,1608,
	1,0,0,0,1611,1612,5,6,0,0,1612,175,1,0,0,0,1613,1614,7,9,0,0,1614,177,1,
	0,0,0,1615,1616,5,102,0,0,1616,1620,5,4,0,0,1617,1619,3,108,54,0,1618,1617,
	1,0,0,0,1619,1622,1,0,0,0,1620,1618,1,0,0,0,1620,1621,1,0,0,0,1621,1623,
	1,0,0,0,1622,1620,1,0,0,0,1623,1624,5,6,0,0,1624,179,1,0,0,0,1625,1626,
	5,103,0,0,1626,1627,5,49,0,0,1627,1628,3,218,109,0,1628,1629,5,50,0,0,1629,
	1633,5,4,0,0,1630,1632,3,182,91,0,1631,1630,1,0,0,0,1632,1635,1,0,0,0,1633,
	1631,1,0,0,0,1633,1634,1,0,0,0,1634,1637,1,0,0,0,1635,1633,1,0,0,0,1636,
	1638,3,184,92,0,1637,1636,1,0,0,0,1637,1638,1,0,0,0,1638,1639,1,0,0,0,1639,
	1640,5,6,0,0,1640,181,1,0,0,0,1641,1642,5,104,0,0,1642,1643,3,218,109,0,
	1643,1647,5,105,0,0,1644,1646,3,108,54,0,1645,1644,1,0,0,0,1646,1649,1,
	0,0,0,1647,1645,1,0,0,0,1647,1648,1,0,0,0,1648,183,1,0,0,0,1649,1647,1,
	0,0,0,1650,1651,5,106,0,0,1651,1655,5,105,0,0,1652,1654,3,108,54,0,1653,
	1652,1,0,0,0,1654,1657,1,0,0,0,1655,1653,1,0,0,0,1655,1656,1,0,0,0,1656,
	185,1,0,0,0,1657,1655,1,0,0,0,1658,1659,5,107,0,0,1659,1661,3,218,109,0,
	1660,1662,3,188,94,0,1661,1660,1,0,0,0,1661,1662,1,0,0,0,1662,1663,1,0,
	0,0,1663,1665,3,106,53,0,1664,1666,3,190,95,0,1665,1664,1,0,0,0,1666,1667,
	1,0,0,0,1667,1665,1,0,0,0,1667,1668,1,0,0,0,1668,187,1,0,0,0,1669,1670,
	5,73,0,0,1670,1682,5,49,0,0,1671,1676,3,104,52,0,1672,1673,5,5,0,0,1673,
	1675,3,104,52,0,1674,1672,1,0,0,0,1675,1678,1,0,0,0,1676,1674,1,0,0,0,1676,
	1677,1,0,0,0,1677,1680,1,0,0,0,1678,1676,1,0,0,0,1679,1681,5,5,0,0,1680,
	1679,1,0,0,0,1680,1681,1,0,0,0,1681,1683,1,0,0,0,1682,1671,1,0,0,0,1682,
	1683,1,0,0,0,1683,1684,1,0,0,0,1684,1685,5,50,0,0,1685,189,1,0,0,0,1686,
	1688,5,108,0,0,1687,1689,5,175,0,0,1688,1687,1,0,0,0,1688,1689,1,0,0,0,
	1689,1705,1,0,0,0,1690,1702,5,49,0,0,1691,1696,3,104,52,0,1692,1693,5,5,
	0,0,1693,1695,3,104,52,0,1694,1692,1,0,0,0,1695,1698,1,0,0,0,1696,1694,
	1,0,0,0,1696,1697,1,0,0,0,1697,1700,1,0,0,0,1698,1696,1,0,0,0,1699,1701,
	5,5,0,0,1700,1699,1,0,0,0,1700,1701,1,0,0,0,1701,1703,1,0,0,0,1702,1691,
	1,0,0,0,1702,1703,1,0,0,0,1703,1704,1,0,0,0,1704,1706,5,50,0,0,1705,1690,
	1,0,0,0,1705,1706,1,0,0,0,1706,1707,1,0,0,0,1707,1708,3,106,53,0,1708,191,
	1,0,0,0,1709,1710,5,109,0,0,1710,1711,5,2,0,0,1711,193,1,0,0,0,1712,1713,
	5,110,0,0,1713,1714,5,2,0,0,1714,195,1,0,0,0,1715,1719,5,163,0,0,1716,1717,
	5,175,0,0,1717,1719,3,210,105,0,1718,1715,1,0,0,0,1718,1716,1,0,0,0,1719,
	197,1,0,0,0,1720,1721,5,36,0,0,1721,1724,5,175,0,0,1722,1723,5,12,0,0,1723,
	1725,5,175,0,0,1724,1722,1,0,0,0,1724,1725,1,0,0,0,1725,1726,1,0,0,0,1726,
	1727,5,49,0,0,1727,1739,5,4,0,0,1728,1733,3,208,104,0,1729,1730,5,5,0,0,
	1730,1732,3,208,104,0,1731,1729,1,0,0,0,1732,1735,1,0,0,0,1733,1731,1,0,
	0,0,1733,1734,1,0,0,0,1734,1737,1,0,0,0,1735,1733,1,0,0,0,1736,1738,5,5,
	0,0,1737,1736,1,0,0,0,1737,1738,1,0,0,0,1738,1740,1,0,0,0,1739,1728,1,0,
	0,0,1739,1740,1,0,0,0,1740,1741,1,0,0,0,1741,1742,5,6,0,0,1742,1743,5,50,
	0,0,1743,1763,5,2,0,0,1744,1745,5,36,0,0,1745,1748,5,175,0,0,1746,1747,
	5,12,0,0,1747,1749,5,175,0,0,1748,1746,1,0,0,0,1748,1749,1,0,0,0,1749,1750,
	1,0,0,0,1750,1751,3,210,105,0,1751,1752,5,2,0,0,1752,1763,1,0,0,0,1753,
	1754,5,36,0,0,1754,1755,5,49,0,0,1755,1756,5,163,0,0,1756,1757,5,50,0,0,
	1757,1763,5,2,0,0,1758,1759,5,36,0,0,1759,1760,5,49,0,0,1760,1761,5,50,
	0,0,1761,1763,5,2,0,0,1762,1720,1,0,0,0,1762,1744,1,0,0,0,1762,1753,1,0,
	0,0,1762,1758,1,0,0,0,1763,199,1,0,0,0,1764,1765,5,111,0,0,1765,1766,5,
	49,0,0,1766,1767,3,218,109,0,1767,1768,5,50,0,0,1768,1769,5,2,0,0,1769,
	201,1,0,0,0,1770,1773,5,175,0,0,1771,1773,3,224,112,0,1772,1770,1,0,0,0,
	1772,1771,1,0,0,0,1773,203,1,0,0,0,1774,1786,5,49,0,0,1775,1780,3,202,101,
	0,1776,1777,5,5,0,0,1777,1779,3,202,101,0,1778,1776,1,0,0,0,1779,1782,1,
	0,0,0,1780,1778,1,0,0,0,1780,1781,1,0,0,0,1781,1784,1,0,0,0,1782,1780,1,
	0,0,0,1783,1785,5,5,0,0,1784,1783,1,0,0,0,1784,1785,1,0,0,0,1785,1787,1,
	0,0,0,1786,1775,1,0,0,0,1786,1787,1,0,0,0,1787,1788,1,0,0,0,1788,1789,5,
	50,0,0,1789,205,1,0,0,0,1790,1791,5,175,0,0,1791,1815,3,210,105,0,1792,
	1793,5,175,0,0,1793,1794,5,12,0,0,1794,1795,5,175,0,0,1795,1815,3,210,105,
	0,1796,1797,5,175,0,0,1797,1798,5,49,0,0,1798,1810,5,4,0,0,1799,1804,3,
	208,104,0,1800,1801,5,5,0,0,1801,1803,3,208,104,0,1802,1800,1,0,0,0,1803,
	1806,1,0,0,0,1804,1802,1,0,0,0,1804,1805,1,0,0,0,1805,1808,1,0,0,0,1806,
	1804,1,0,0,0,1807,1809,5,5,0,0,1808,1807,1,0,0,0,1808,1809,1,0,0,0,1809,
	1811,1,0,0,0,1810,1799,1,0,0,0,1810,1811,1,0,0,0,1811,1812,1,0,0,0,1812,
	1813,5,6,0,0,1813,1815,5,50,0,0,1814,1790,1,0,0,0,1814,1792,1,0,0,0,1814,
	1796,1,0,0,0,1815,207,1,0,0,0,1816,1817,5,175,0,0,1817,1818,5,105,0,0,1818,
	1819,3,218,109,0,1819,209,1,0,0,0,1820,1832,5,49,0,0,1821,1826,3,218,109,
	0,1822,1823,5,5,0,0,1823,1825,3,218,109,0,1824,1822,1,0,0,0,1825,1828,1,
	0,0,0,1826,1824,1,0,0,0,1826,1827,1,0,0,0,1827,1830,1,0,0,0,1828,1826,1,
	0,0,0,1829,1831,5,5,0,0,1830,1829,1,0,0,0,1830,1831,1,0,0,0,1831,1833,1,
	0,0,0,1832,1821,1,0,0,0,1832,1833,1,0,0,0,1833,1834,1,0,0,0,1834,1835,5,
	50,0,0,1835,211,1,0,0,0,1836,1837,5,4,0,0,1837,1842,3,214,107,0,1838,1839,
	5,5,0,0,1839,1841,3,214,107,0,1840,1838,1,0,0,0,1841,1844,1,0,0,0,1842,
	1840,1,0,0,0,1842,1843,1,0,0,0,1843,1846,1,0,0,0,1844,1842,1,0,0,0,1845,
	1847,5,5,0,0,1846,1845,1,0,0,0,1846,1847,1,0,0,0,1847,1848,1,0,0,0,1848,
	1849,5,6,0,0,1849,213,1,0,0,0,1850,1851,5,175,0,0,1851,1852,5,105,0,0,1852,
	1853,3,218,109,0,1853,215,1,0,0,0,1854,1855,5,49,0,0,1855,1860,3,230,115,
	0,1856,1857,5,5,0,0,1857,1859,3,230,115,0,1858,1856,1,0,0,0,1859,1862,1,
	0,0,0,1860,1858,1,0,0,0,1860,1861,1,0,0,0,1861,1864,1,0,0,0,1862,1860,1,
	0,0,0,1863,1865,5,5,0,0,1864,1863,1,0,0,0,1864,1865,1,0,0,0,1865,1866,1,
	0,0,0,1866,1867,5,50,0,0,1867,217,1,0,0,0,1868,1869,6,109,-1,0,1869,1870,
	5,49,0,0,1870,1871,3,218,109,0,1871,1872,5,50,0,0,1872,1998,1,0,0,0,1873,
	1874,3,232,116,0,1874,1875,5,49,0,0,1875,1877,3,218,109,0,1876,1878,5,5,
	0,0,1877,1876,1,0,0,0,1877,1878,1,0,0,0,1878,1879,1,0,0,0,1879,1880,5,50,
	0,0,1880,1998,1,0,0,0,1881,1998,3,206,103,0,1882,1883,5,112,0,0,1883,1885,
	5,175,0,0,1884,1886,3,212,106,0,1885,1884,1,0,0,0,1885,1886,1,0,0,0,1886,
	1887,1,0,0,0,1887,1998,3,210,105,0,1888,1889,5,112,0,0,1889,1890,3,230,
	115,0,1890,1891,5,66,0,0,1891,1892,5,67,0,0,1892,1893,5,49,0,0,1893,1894,
	3,218,109,0,1894,1895,5,50,0,0,1895,1998,1,0,0,0,1896,1897,5,55,0,0,1897,
	1898,5,49,0,0,1898,1899,3,230,115,0,1899,1900,5,50,0,0,1900,1901,5,12,0,
	0,1901,1902,5,175,0,0,1902,1998,1,0,0,0,1903,1904,5,113,0,0,1904,1998,3,
	210,105,0,1905,1906,5,114,0,0,1906,1998,3,210,105,0,1907,1908,5,115,0,0,
	1908,1998,3,210,105,0,1909,1910,5,116,0,0,1910,1998,3,210,105,0,1911,1912,
	5,117,0,0,1912,1913,5,49,0,0,1913,1914,5,175,0,0,1914,1915,5,12,0,0,1915,
	1916,5,175,0,0,1916,1917,5,5,0,0,1917,1918,3,210,105,0,1918,1919,5,50,0,
	0,1919,1998,1,0,0,0,1920,1921,5,118,0,0,1921,1998,3,210,105,0,1922,1923,
	5,119,0,0,1923,1998,3,210,105,0,1924,1925,5,120,0,0,1925,1926,5,49,0,0,
	1926,1927,3,218,109,0,1927,1928,5,5,0,0,1928,1929,3,216,108,0,1929,1930,
	5,50,0,0,1930,1998,1,0,0,0,1931,1932,5,121,0,0,1932,1933,5,49,0,0,1933,
	1934,3,218,109,0,1934,1935,5,5,0,0,1935,1936,3,216,108,0,1936,1937,5,5,
	0,0,1937,1938,5,157,0,0,1938,1939,5,50,0,0,1939,1998,1,0,0,0,1940,1941,
	5,122,0,0,1941,1942,5,66,0,0,1942,1943,3,218,109,0,1943,1944,5,67,0,0,1944,
	1945,7,10,0,0,1945,1998,1,0,0,0,1946,1947,5,128,0,0,1947,1948,5,66,0,0,
	1948,1949,3,218,109,0,1949,1950,5,67,0,0,1950,1951,7,11,0,0,1951,1998,1,
	0,0,0,1952,1953,7,12,0,0,1953,1998,3,218,109,21,1954,1966,5,66,0,0,1955,
	1960,3,218,109,0,1956,1957,5,5,0,0,1957,1959,3,218,109,0,1958,1956,1,0,
	0,0,1959,1962,1,0,0,0,1960,1958,1,0,0,0,1960,1961,1,0,0,0,1961,1964,1,0,
	0,0,1962,1960,1,0,0,0,1963,1965,5,5,0,0,1964,1963,1,0,0,0,1964,1965,1,0,
	0,0,1965,1967,1,0,0,0,1966,1955,1,0,0,0,1966,1967,1,0,0,0,1967,1968,1,0,
	0,0,1968,1998,5,67,0,0,1969,1970,5,74,0,0,1970,1971,5,12,0,0,1971,1972,
	5,175,0,0,1972,1973,5,12,0,0,1973,1974,5,175,0,0,1974,1975,5,66,0,0,1975,
	1976,3,218,109,0,1976,1977,5,67,0,0,1977,1978,3,220,110,0,1978,1998,1,0,
	0,0,1979,1980,5,74,0,0,1980,1981,5,12,0,0,1981,1986,5,175,0,0,1982,1983,
	5,66,0,0,1983,1984,3,218,109,0,1984,1985,5,67,0,0,1985,1987,1,0,0,0,1986,
	1982,1,0,0,0,1987,1988,1,0,0,0,1988,1986,1,0,0,0,1988,1989,1,0,0,0,1989,
	1998,1,0,0,0,1990,1991,5,74,0,0,1991,1992,5,12,0,0,1992,1998,5,175,0,0,
	1993,1998,5,74,0,0,1994,1998,5,172,0,0,1995,1998,3,14,7,0,1996,1998,3,224,
	112,0,1997,1868,1,0,0,0,1997,1873,1,0,0,0,1997,1881,1,0,0,0,1997,1882,1,
	0,0,0,1997,1888,1,0,0,0,1997,1896,1,0,0,0,1997,1903,1,0,0,0,1997,1905,1,
	0,0,0,1997,1907,1,0,0,0,1997,1909,1,0,0,0,1997,1911,1,0,0,0,1997,1920,1,
	0,0,0,1997,1922,1,0,0,0,1997,1924,1,0,0,0,1997,1931,1,0,0,0,1997,1940,1,
	0,0,0,1997,1946,1,0,0,0,1997,1952,1,0,0,0,1997,1954,1,0,0,0,1997,1969,1,
	0,0,0,1997,1979,1,0,0,0,1997,1990,1,0,0,0,1997,1993,1,0,0,0,1997,1994,1,
	0,0,0,1997,1995,1,0,0,0,1997,1996,1,0,0,0,1998,2104,1,0,0,0,1999,2000,10,
	20,0,0,2000,2001,5,17,0,0,2001,2103,3,218,109,20,2002,2003,10,19,0,0,2003,
	2004,7,13,0,0,2004,2103,3,218,109,20,2005,2006,10,18,0,0,2006,2007,7,14,
	0,0,2007,2103,3,218,109,19,2008,2009,10,17,0,0,2009,2010,7,15,0,0,2010,
	2103,3,218,109,18,2011,2012,10,16,0,0,2012,2013,7,16,0,0,2013,2103,3,218,
	109,17,2014,2015,10,15,0,0,2015,2016,7,17,0,0,2016,2103,3,218,109,16,2017,
	2018,10,14,0,0,2018,2019,5,24,0,0,2019,2103,3,218,109,15,2020,2021,10,13,
	0,0,2021,2022,5,26,0,0,2022,2103,3,218,109,14,2023,2024,10,12,0,0,2024,
	2025,5,25,0,0,2025,2103,3,218,109,13,2026,2027,10,11,0,0,2027,2028,5,140,
	0,0,2028,2103,3,218,109,12,2029,2030,10,10,0,0,2030,2031,5,141,0,0,2031,
	2103,3,218,109,11,2032,2033,10,9,0,0,2033,2034,5,142,0,0,2034,2035,3,218,
	109,0,2035,2036,5,105,0,0,2036,2037,3,218,109,9,2037,2103,1,0,0,0,2038,
	2039,10,32,0,0,2039,2040,5,66,0,0,2040,2041,3,218,109,0,2041,2042,5,105,
	0,0,2042,2043,3,218,109,0,2043,2044,5,67,0,0,2044,2103,1,0,0,0,2045,2046,
	10,31,0,0,2046,2047,5,66,0,0,2047,2048,5,157,0,0,2048,2103,5,67,0,0,2049,
	2050,10,30,0,0,2050,2051,5,66,0,0,2051,2052,3,218,109,0,2052,2053,5,67,
	0,0,2053,2103,1,0,0,0,2054,2055,10,27,0,0,2055,2103,7,18,0,0,2056,2057,
	10,26,0,0,2057,2058,5,135,0,0,2058,2059,5,49,0,0,2059,2060,3,218,109,0,
	2060,2061,5,50,0,0,2061,2103,1,0,0,0,2062,2063,10,25,0,0,2063,2064,5,136,
	0,0,2064,2065,5,49,0,0,2065,2066,3,218,109,0,2066,2067,5,5,0,0,2067,2068,
	3,218,109,0,2068,2069,5,50,0,0,2069,2103,1,0,0,0,2070,2071,10,24,0,0,2071,
	2072,5,12,0,0,2072,2074,5,175,0,0,2073,2075,3,212,106,0,2074,2073,1,0,0,
	0,2074,2075,1,0,0,0,2075,2076,1,0,0,0,2076,2077,5,49,0,0,2077,2089,5,4,
	0,0,2078,2083,3,208,104,0,2079,2080,5,5,0,0,2080,2082,3,208,104,0,2081,
	2079,1,0,0,0,2082,2085,1,0,0,0,2083,2081,1,0,0,0,2083,2084,1,0,0,0,2084,
	2087,1,0,0,0,2085,2083,1,0,0,0,2086,2088,5,5,0,0,2087,2086,1,0,0,0,2087,
	2088,1,0,0,0,2088,2090,1,0,0,0,2089,2078,1,0,0,0,2089,2090,1,0,0,0,2090,
	2091,1,0,0,0,2091,2092,5,6,0,0,2092,2103,5,50,0,0,2093,2094,10,23,0,0,2094,
	2095,5,12,0,0,2095,2097,5,175,0,0,2096,2098,3,212,106,0,2097,2096,1,0,0,
	0,2097,2098,1,0,0,0,2098,2099,1,0,0,0,2099,2103,3,210,105,0,2100,2101,10,
	22,0,0,2101,2103,3,220,110,0,2102,1999,1,0,0,0,2102,2002,1,0,0,0,2102,2005,
	1,0,0,0,2102,2008,1,0,0,0,2102,2011,1,0,0,0,2102,2014,1,0,0,0,2102,2017,
	1,0,0,0,2102,2020,1,0,0,0,2102,2023,1,0,0,0,2102,2026,1,0,0,0,2102,2029,
	1,0,0,0,2102,2032,1,0,0,0,2102,2038,1,0,0,0,2102,2045,1,0,0,0,2102,2049,
	1,0,0,0,2102,2054,1,0,0,0,2102,2056,1,0,0,0,2102,2062,1,0,0,0,2102,2070,
	1,0,0,0,2102,2093,1,0,0,0,2102,2100,1,0,0,0,2103,2106,1,0,0,0,2104,2102,
	1,0,0,0,2104,2105,1,0,0,0,2105,219,1,0,0,0,2106,2104,1,0,0,0,2107,2108,
	5,12,0,0,2108,2121,5,175,0,0,2109,2121,5,123,0,0,2110,2121,5,124,0,0,2111,
	2121,5,125,0,0,2112,2121,5,126,0,0,2113,2121,5,127,0,0,2114,2121,5,129,
	0,0,2115,2121,5,130,0,0,2116,2121,5,131,0,0,2117,2121,5,132,0,0,2118,2121,
	5,143,0,0,2119,2121,5,144,0,0,2120,2107,1,0,0,0,2120,2109,1,0,0,0,2120,
	2110,1,0,0,0,2120,2111,1,0,0,0,2120,2112,1,0,0,0,2120,2113,1,0,0,0,2120,
	2114,1,0,0,0,2120,2115,1,0,0,0,2120,2116,1,0,0,0,2120,2117,1,0,0,0,2120,
	2118,1,0,0,0,2120,2119,1,0,0,0,2121,221,1,0,0,0,2122,2123,7,19,0,0,2123,
	223,1,0,0,0,2124,2139,5,153,0,0,2125,2139,3,226,113,0,2126,2139,3,228,114,
	0,2127,2131,5,163,0,0,2128,2130,5,163,0,0,2129,2128,1,0,0,0,2130,2133,1,
	0,0,0,2131,2129,1,0,0,0,2131,2132,1,0,0,0,2132,2139,1,0,0,0,2133,2131,1,
	0,0,0,2134,2139,5,173,0,0,2135,2139,5,174,0,0,2136,2139,5,164,0,0,2137,
	2139,5,165,0,0,2138,2124,1,0,0,0,2138,2125,1,0,0,0,2138,2126,1,0,0,0,2138,
	2127,1,0,0,0,2138,2134,1,0,0,0,2138,2135,1,0,0,0,2138,2136,1,0,0,0,2138,
	2137,1,0,0,0,2139,225,1,0,0,0,2140,2142,5,157,0,0,2141,2143,7,20,0,0,2142,
	2141,1,0,0,0,2142,2143,1,0,0,0,2143,227,1,0,0,0,2144,2145,5,156,0,0,2145,
	229,1,0,0,0,2146,2147,5,149,0,0,2147,2191,5,59,0,0,2148,2191,5,149,0,0,
	2149,2191,5,158,0,0,2150,2191,5,159,0,0,2151,2191,5,161,0,0,2152,2191,5,
	160,0,0,2153,2191,5,168,0,0,2154,2191,5,169,0,0,2155,2191,5,150,0,0,2156,
	2191,5,151,0,0,2157,2191,5,170,0,0,2158,2191,5,171,0,0,2159,2160,5,7,0,
	0,2160,2169,5,49,0,0,2161,2166,3,230,115,0,2162,2163,5,5,0,0,2163,2165,
	3,230,115,0,2164,2162,1,0,0,0,2165,2168,1,0,0,0,2166,2164,1,0,0,0,2166,
	2167,1,0,0,0,2167,2170,1,0,0,0,2168,2166,1,0,0,0,2169,2161,1,0,0,0,2169,
	2170,1,0,0,0,2170,2171,1,0,0,0,2171,2184,5,50,0,0,2172,2173,5,73,0,0,2173,
	2174,5,49,0,0,2174,2179,3,230,115,0,2175,2176,5,5,0,0,2176,2178,3,230,115,
	0,2177,2175,1,0,0,0,2178,2181,1,0,0,0,2179,2177,1,0,0,0,2179,2180,1,0,0,
	0,2180,2182,1,0,0,0,2181,2179,1,0,0,0,2182,2183,5,50,0,0,2183,2185,1,0,
	0,0,2184,2172,1,0,0,0,2184,2185,1,0,0,0,2185,2191,1,0,0,0,2186,2187,5,175,
	0,0,2187,2188,5,12,0,0,2188,2191,5,175,0,0,2189,2191,5,175,0,0,2190,2146,
	1,0,0,0,2190,2148,1,0,0,0,2190,2149,1,0,0,0,2190,2150,1,0,0,0,2190,2151,
	1,0,0,0,2190,2152,1,0,0,0,2190,2153,1,0,0,0,2190,2154,1,0,0,0,2190,2155,
	1,0,0,0,2190,2156,1,0,0,0,2190,2157,1,0,0,0,2190,2158,1,0,0,0,2190,2159,
	1,0,0,0,2190,2186,1,0,0,0,2190,2189,1,0,0,0,2191,231,1,0,0,0,2192,2193,
	7,21,0,0,2193,233,1,0,0,0,229,237,243,256,258,278,282,289,294,302,306,312,
	322,325,335,339,345,348,352,357,361,376,379,393,396,407,409,424,439,443,
	453,459,465,471,477,483,489,495,501,506,514,517,534,536,547,553,557,569,
	573,575,579,585,597,601,603,617,623,636,640,647,667,673,680,691,697,704,
	712,723,732,738,744,753,759,764,770,777,783,789,793,797,805,810,818,828,
	833,837,849,858,860,866,872,879,890,896,900,906,913,929,938,942,948,957,
	961,969,973,979,983,985,993,997,999,1007,1011,1017,1021,1023,1029,1034,
	1066,1092,1106,1118,1122,1127,1132,1141,1145,1147,1169,1174,1180,1189,1198,
	1202,1204,1213,1218,1229,1231,1237,1251,1257,1269,1275,1286,1299,1305,1313,
	1319,1323,1333,1345,1355,1366,1373,1379,1386,1399,1456,1468,1472,1481,1491,
	1503,1511,1556,1565,1571,1583,1608,1620,1633,1637,1647,1655,1661,1667,1676,
	1680,1682,1688,1696,1700,1702,1705,1718,1724,1733,1737,1739,1748,1762,1772,
	1780,1784,1786,1804,1808,1810,1814,1826,1830,1832,1842,1846,1860,1864,1877,
	1885,1960,1964,1966,1988,1997,2074,2083,2087,2089,2097,2102,2104,2120,2131,
	2138,2142,2166,2169,2179,2184,2190];

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
