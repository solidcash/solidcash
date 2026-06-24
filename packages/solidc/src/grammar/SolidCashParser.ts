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
			this.state = 621;
			this.typeName();
			this.state = 622;
			this.anyIdentifier();
			this.state = 623;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 625;
			this.match(SolidCashParser.T__53);
			this.state = 626;
			this.match(SolidCashParser.Identifier);
			this.state = 627;
			this.match(SolidCashParser.T__3);
			this.state = 628;
			this.enumMember();
			this.state = 633;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 55, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 629;
					this.match(SolidCashParser.T__4);
					this.state = 630;
					this.enumMember();
					}
					}
				}
				this.state = 635;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 55, this._ctx);
			}
			this.state = 637;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 636;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 639;
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
			this.state = 641;
			this.match(SolidCashParser.Identifier);
			this.state = 644;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 642;
				this.match(SolidCashParser.T__39);
				this.state = 643;
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
			this.state = 646;
			this.match(SolidCashParser.T__54);
			this.state = 647;
			this.match(SolidCashParser.Identifier);
			this.state = 648;
			this.match(SolidCashParser.T__41);
			this.state = 649;
			this.typeName();
			this.state = 650;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 652;
			this.typeName();
			this.state = 653;
			this.match(SolidCashParser.T__55);
			this.state = 654;
			this.match(SolidCashParser.Identifier);
			this.state = 655;
			this.match(SolidCashParser.T__39);
			this.state = 656;
			this.expression(0);
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
	public constructorDefinition(): ConstructorDefinitionContext {
		let localctx: ConstructorDefinitionContext = new ConstructorDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 62, SolidCashParser.RULE_constructorDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 659;
			this.match(SolidCashParser.T__56);
			this.state = 660;
			this.parameterList();
			this.state = 664;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 98307) !== 0)) {
				{
				{
				this.state = 661;
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
				this.state = 666;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 670;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===175) {
				{
				{
				this.state = 667;
				this.parentInvocation();
				}
				}
				this.state = 672;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 673;
			this.match(SolidCashParser.T__3);
			this.state = 677;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
				{
				{
				this.state = 674;
				this.statement();
				}
				}
				this.state = 679;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 680;
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
			this.state = 682;
			this.match(SolidCashParser.T__59);
			this.state = 683;
			this.parameterList();
			this.state = 684;
			this.match(SolidCashParser.T__43);
			this.state = 688;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 8197) !== 0)) {
				{
				{
				this.state = 685;
				this.fallbackModifier();
				}
				}
				this.state = 690;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 694;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===175) {
				{
				{
				this.state = 691;
				this.customModifierInvocation();
				}
				}
				this.state = 696;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 697;
			this.match(SolidCashParser.T__3);
			this.state = 701;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
				{
				{
				this.state = 698;
				this.statement();
				}
				}
				this.state = 703;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 704;
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
			this.state = 709;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 59:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 706;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 707;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 708;
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
			this.state = 711;
			this.match(SolidCashParser.T__61);
			this.state = 712;
			this.match(SolidCashParser.T__48);
			this.state = 713;
			this.match(SolidCashParser.T__49);
			this.state = 714;
			this.match(SolidCashParser.T__43);
			this.state = 715;
			this.match(SolidCashParser.T__58);
			this.state = 716;
			this.match(SolidCashParser.T__3);
			this.state = 720;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
				{
				{
				this.state = 717;
				this.statement();
				}
				}
				this.state = 722;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 723;
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
			this.state = 725;
			this.match(SolidCashParser.Identifier);
			this.state = 726;
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
			this.state = 790;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 76, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 729;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 728;
					this.stateVariableVisibility();
					}
				}

				this.state = 731;
				this.typeName();
				this.state = 735;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 15) !== 0)) {
					{
					{
					this.state = 732;
					this.modifier();
					}
					}
					this.state = 737;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 738;
				this.match(SolidCashParser.Identifier);
				this.state = 741;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 739;
					this.match(SolidCashParser.T__39);
					this.state = 740;
					this.expression(0);
					}
				}

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
				while (_la===33 || _la===56 || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 15) !== 0)) {
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
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 761;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 760;
					this.stateVariableVisibility();
					}
				}

				this.state = 763;
				this.mappingType();
				this.state = 767;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 15) !== 0)) {
					{
					{
					this.state = 764;
					this.collectionModifier();
					}
					}
					this.state = 769;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 770;
				this.match(SolidCashParser.Identifier);
				this.state = 771;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 774;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 773;
					this.stateVariableVisibility();
					}
				}

				this.state = 776;
				this.arrayType(0);
				this.state = 780;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 15) !== 0)) {
					{
					{
					this.state = 777;
					this.collectionModifier();
					}
					}
					this.state = 782;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 783;
				this.match(SolidCashParser.Identifier);
				this.state = 786;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 784;
					this.match(SolidCashParser.T__39);
					this.state = 785;
					this.expression(0);
					}
				}

				this.state = 788;
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
			this.state = 794;
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
				this.state = 792;
				this.modifier();
				}
				break;
			case 43:
			case 44:
			case 58:
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 793;
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
			this.state = 796;
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
			this.state = 834;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 83, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 798;
				this.match(SolidCashParser.T__63);
				this.state = 799;
				this.match(SolidCashParser.T__48);
				this.state = 800;
				this.typeName();
				this.state = 802;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===175) {
					{
					this.state = 801;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 804;
				this.match(SolidCashParser.T__64);
				this.state = 805;
				this.typeName();
				this.state = 807;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===175) {
					{
					this.state = 806;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 809;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 811;
				this.match(SolidCashParser.T__63);
				this.state = 812;
				this.match(SolidCashParser.T__48);
				this.state = 813;
				this.typeName();
				this.state = 815;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===175) {
					{
					this.state = 814;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 817;
				this.match(SolidCashParser.T__64);
				this.state = 818;
				this.mappingType();
				this.state = 819;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 821;
				this.match(SolidCashParser.T__63);
				this.state = 822;
				this.match(SolidCashParser.T__48);
				this.state = 823;
				this.typeName();
				this.state = 825;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===175) {
					{
					this.state = 824;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 827;
				this.match(SolidCashParser.T__64);
				this.state = 828;
				this.arrayType(0);
				this.state = 830;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===175) {
					{
					this.state = 829;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 832;
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
			this.state = 846;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 84, this._ctx) ) {
			case 1:
				{
				this.state = 837;
				this.typeName();
				this.state = 838;
				this.match(SolidCashParser.T__65);
				this.state = 839;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 840;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 2:
				{
				this.state = 842;
				this.typeName();
				this.state = 843;
				this.match(SolidCashParser.T__65);
				this.state = 844;
				this.match(SolidCashParser.T__66);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 857;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 86, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 855;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 85, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 848;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 849;
						this.match(SolidCashParser.T__65);
						this.state = 850;
						this.match(SolidCashParser.NumberLiteral);
						this.state = 851;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 852;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 853;
						this.match(SolidCashParser.T__65);
						this.state = 854;
						this.match(SolidCashParser.T__66);
						}
						break;
					}
					}
				}
				this.state = 859;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 86, this._ctx);
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
			this.state = 860;
			this.match(SolidCashParser.T__67);
			this.state = 861;
			this.match(SolidCashParser.Identifier);
			this.state = 863;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 862;
				this.parameterList();
				}
			}

			this.state = 865;
			this.match(SolidCashParser.T__3);
			this.state = 869;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
				{
				{
				this.state = 866;
				this.modifierStatement();
				}
				}
				this.state = 871;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 872;
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
			this.state = 876;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 69:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 874;
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
				this.state = 875;
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
			this.state = 878;
			this.match(SolidCashParser.T__68);
			this.state = 879;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 881;
			this.match(SolidCashParser.T__6);
			this.state = 882;
			this.anyIdentifier();
			this.state = 883;
			this.parameterList();
			this.state = 887;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 884;
				this.functionModifier();
				}
				}
				this.state = 889;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 893;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===175) {
				{
				{
				this.state = 890;
				this.customModifierInvocation();
				}
				}
				this.state = 895;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 897;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 896;
				this.returnType();
				}
			}

			this.state = 899;
			this.match(SolidCashParser.T__3);
			this.state = 903;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
				{
				{
				this.state = 900;
				this.statement();
				}
				}
				this.state = 905;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 906;
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
			this.state = 908;
			this.match(SolidCashParser.Identifier);
			this.state = 910;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 909;
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
			this.state = 926;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 70:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 912;
				this.match(SolidCashParser.T__69);
				}
				break;
			case 71:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 913;
				this.match(SolidCashParser.T__70);
				}
				break;
			case 58:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 914;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 44:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 915;
				this.match(SolidCashParser.T__43);
				}
				break;
			case 43:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 916;
				this.match(SolidCashParser.T__42);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 917;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 59:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 918;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 919;
				this.overrideSpecifier();
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 920;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 921;
				this.unsafeModifier();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 922;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 923;
				this.match(SolidCashParser.T__27);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 924;
				this.match(SolidCashParser.T__30);
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 925;
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
			this.state = 928;
			this.match(SolidCashParser.T__71);
			this.state = 939;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 929;
				this.match(SolidCashParser.T__48);
				this.state = 930;
				this.match(SolidCashParser.Identifier);
				this.state = 935;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 931;
					this.match(SolidCashParser.T__4);
					this.state = 932;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 937;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 938;
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
			this.state = 941;
			this.match(SolidCashParser.T__31);
			this.state = 945;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 942;
				this.match(SolidCashParser.T__48);
				this.state = 943;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 944;
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
			this.state = 947;
			this.match(SolidCashParser.T__72);
			this.state = 948;
			this.match(SolidCashParser.T__48);
			this.state = 949;
			this.returnParam();
			this.state = 954;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 99, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 950;
					this.match(SolidCashParser.T__4);
					this.state = 951;
					this.returnParam();
					}
					}
				}
				this.state = 956;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 99, this._ctx);
			}
			this.state = 958;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 957;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 960;
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
			this.state = 982;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 105, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 962;
				this.typeName();
				this.state = 966;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 101, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 963;
						this.modifier();
						}
						}
					}
					this.state = 968;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 101, this._ctx);
				}
				this.state = 970;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 155)) & ~0x1F) === 0 && ((1 << (_la - 155)) & 1048593) !== 0)) {
					{
					this.state = 969;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 972;
				this.arrayType(0);
				this.state = 976;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 103, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 973;
						this.modifier();
						}
						}
					}
					this.state = 978;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 103, this._ctx);
				}
				this.state = 980;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 155)) & ~0x1F) === 0 && ((1 << (_la - 155)) & 1048593) !== 0)) {
					{
					this.state = 979;
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
			this.state = 984;
			this.match(SolidCashParser.T__48);
			this.state = 996;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 74980871) !== 0)) {
				{
				this.state = 985;
				this.parameter();
				this.state = 990;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 106, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 986;
						this.match(SolidCashParser.T__4);
						this.state = 987;
						this.parameter();
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
				if (_la===5) {
					{
					this.state = 993;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 998;
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
			this.state = 1020;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 113, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1000;
				this.typeName();
				this.state = 1004;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 109, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1001;
						this.modifier();
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
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 155)) & ~0x1F) === 0 && ((1 << (_la - 155)) & 1048593) !== 0)) {
					{
					this.state = 1007;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1010;
				this.arrayType(0);
				this.state = 1014;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 111, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1011;
						this.modifier();
						}
						}
					}
					this.state = 1016;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 111, this._ctx);
				}
				this.state = 1018;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || ((((_la - 155)) & ~0x1F) === 0 && ((1 << (_la - 155)) & 1048593) !== 0)) {
					{
					this.state = 1017;
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
			this.state = 1031;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1022;
				this.match(SolidCashParser.T__3);
				this.state = 1026;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
					{
					{
					this.state = 1023;
					this.statement();
					}
					}
					this.state = 1028;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1029;
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
				this.state = 1030;
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
			this.state = 1063;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 116, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1033;
				this.variableDefinition();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1034;
				this.tupleAssignment();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1035;
				this.arrayPushStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1036;
				this.arrayPopStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1037;
				this.arrayDeleteStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1038;
				this.stateArrayPushStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1039;
				this.stateArrayPopStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1040;
				this.assignStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1041;
				this.assignmentStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1042;
				this.mappingDeleteStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1043;
				this.timeOpStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1044;
				this.requireStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1045;
				this.ifStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1046;
				this.loopStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1047;
				this.consoleStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1048;
				this.emitStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1049;
				this.transferStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1050;
				this.tokenContainerMethodStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1051;
				this.returnStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1052;
				this.functionCallStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1053;
				this.addressMethodStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1054;
				this.assemblyStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1055;
				this.tryCatchStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1056;
				this.revertStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1057;
				this.assertStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1058;
				this.deleteStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1059;
				this.uncheckedStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1060;
				this.switchStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1061;
				this.breakStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1062;
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
			this.state = 1065;
			this.match(SolidCashParser.T__73);
			this.state = 1066;
			this.match(SolidCashParser.T__11);
			this.state = 1067;
			this.match(SolidCashParser.Identifier);
			this.state = 1068;
			this.match(SolidCashParser.T__48);
			this.state = 1069;
			this.expression(0);
			this.state = 1070;
			this.match(SolidCashParser.T__4);
			this.state = 1071;
			this.expression(0);
			this.state = 1072;
			this.match(SolidCashParser.T__49);
			this.state = 1073;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1075;
			this.match(SolidCashParser.T__73);
			this.state = 1076;
			this.match(SolidCashParser.T__11);
			this.state = 1077;
			this.match(SolidCashParser.Identifier);
			this.state = 1078;
			this.match(SolidCashParser.T__65);
			this.state = 1079;
			this.expression(0);
			this.state = 1080;
			this.match(SolidCashParser.T__66);
			this.state = 1081;
			this.match(SolidCashParser.T__11);
			this.state = 1082;
			this.match(SolidCashParser.Identifier);
			this.state = 1083;
			this.match(SolidCashParser.T__48);
			this.state = 1084;
			this.expression(0);
			this.state = 1089;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1085;
				this.match(SolidCashParser.T__4);
				this.state = 1086;
				this.expression(0);
				}
				}
				this.state = 1091;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1092;
			this.match(SolidCashParser.T__49);
			this.state = 1093;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1124;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 121, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1095;
				this.match(SolidCashParser.T__74);
				this.state = 1096;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1097;
				this.match(SolidCashParser.T__74);
				this.state = 1098;
				this.expression(0);
				this.state = 1103;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1099;
					this.match(SolidCashParser.T__4);
					this.state = 1100;
					this.expression(0);
					}
					}
					this.state = 1105;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1106;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1108;
				this.match(SolidCashParser.T__74);
				this.state = 1109;
				this.match(SolidCashParser.T__48);
				this.state = 1110;
				this.expression(0);
				this.state = 1115;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 119, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1111;
						this.match(SolidCashParser.T__4);
						this.state = 1112;
						this.expression(0);
						}
						}
					}
					this.state = 1117;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 119, this._ctx);
				}
				this.state = 1119;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1118;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1121;
				this.match(SolidCashParser.T__49);
				this.state = 1122;
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
			this.state = 1171;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 127, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1126;
				this.match(SolidCashParser.Identifier);
				this.state = 1129;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1127;
					this.match(SolidCashParser.T__11);
					this.state = 1128;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1131;
				this.match(SolidCashParser.T__48);
				this.state = 1132;
				this.match(SolidCashParser.T__3);
				this.state = 1144;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===175) {
					{
					this.state = 1133;
					this.namedArg();
					this.state = 1138;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 123, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1134;
							this.match(SolidCashParser.T__4);
							this.state = 1135;
							this.namedArg();
							}
							}
						}
						this.state = 1140;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 123, this._ctx);
					}
					this.state = 1142;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1141;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1146;
				this.match(SolidCashParser.T__5);
				this.state = 1147;
				this.match(SolidCashParser.T__49);
				this.state = 1148;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1149;
				this.match(SolidCashParser.Identifier);
				this.state = 1150;
				this.expressionList();
				this.state = 1151;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1153;
				this.match(SolidCashParser.Identifier);
				this.state = 1154;
				this.match(SolidCashParser.T__11);
				this.state = 1155;
				this.match(SolidCashParser.Identifier);
				this.state = 1156;
				this.expressionList();
				this.state = 1157;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1159;
				this.match(SolidCashParser.Identifier);
				this.state = 1160;
				this.expressionList();
				this.state = 1161;
				this.match(SolidCashParser.T__11);
				this.state = 1162;
				this.match(SolidCashParser.Identifier);
				this.state = 1163;
				this.match(SolidCashParser.T__11);
				this.state = 1164;
				this.match(SolidCashParser.Identifier);
				this.state = 1166;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1165;
					this.callOptions();
					}
				}

				this.state = 1168;
				this.expressionList();
				this.state = 1169;
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
			this.state = 1173;
			this.expression(0);
			this.state = 1174;
			this.match(SolidCashParser.T__11);
			this.state = 1175;
			this.match(SolidCashParser.Identifier);
			this.state = 1177;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===4) {
				{
				this.state = 1176;
				this.callOptions();
				}
			}

			this.state = 1179;
			this.expressionList();
			this.state = 1180;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1215;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 134, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1182;
				this.match(SolidCashParser.T__75);
				this.state = 1183;
				this.match(SolidCashParser.Identifier);
				this.state = 1186;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1184;
					this.match(SolidCashParser.T__11);
					this.state = 1185;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1188;
				this.match(SolidCashParser.T__48);
				this.state = 1189;
				this.match(SolidCashParser.T__3);
				this.state = 1201;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===175) {
					{
					this.state = 1190;
					this.namedArg();
					this.state = 1195;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 130, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1191;
							this.match(SolidCashParser.T__4);
							this.state = 1192;
							this.namedArg();
							}
							}
						}
						this.state = 1197;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 130, this._ctx);
					}
					this.state = 1199;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1198;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1203;
				this.match(SolidCashParser.T__5);
				this.state = 1204;
				this.match(SolidCashParser.T__49);
				this.state = 1205;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1206;
				this.match(SolidCashParser.T__75);
				this.state = 1207;
				this.match(SolidCashParser.Identifier);
				this.state = 1210;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1208;
					this.match(SolidCashParser.T__11);
					this.state = 1209;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1212;
				this.expressionList();
				this.state = 1213;
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
			this.state = 1262;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 140, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1217;
				this.match(SolidCashParser.T__73);
				this.state = 1218;
				this.match(SolidCashParser.T__11);
				this.state = 1219;
				this.match(SolidCashParser.Identifier);
				this.state = 1232;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===66) {
					{
					this.state = 1224;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1220;
						this.match(SolidCashParser.T__65);
						this.state = 1221;
						this.expression(0);
						this.state = 1222;
						this.match(SolidCashParser.T__66);
						}
						}
						this.state = 1226;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===66);
					this.state = 1230;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===12) {
						{
						this.state = 1228;
						this.match(SolidCashParser.T__11);
						this.state = 1229;
						this.match(SolidCashParser.Identifier);
						}
					}

					}
				}

				this.state = 1234;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1235;
				this.expression(0);
				this.state = 1236;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1238;
				this.match(SolidCashParser.Identifier);
				this.state = 1243;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1239;
					this.match(SolidCashParser.T__65);
					this.state = 1240;
					this.expression(0);
					this.state = 1241;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1245;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1249;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1247;
					this.match(SolidCashParser.T__11);
					this.state = 1248;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1251;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1252;
				this.expression(0);
				this.state = 1253;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1255;
				this.match(SolidCashParser.Identifier);
				this.state = 1256;
				this.match(SolidCashParser.T__11);
				this.state = 1257;
				this.match(SolidCashParser.Identifier);
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
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1264;
			this.match(SolidCashParser.T__73);
			this.state = 1265;
			this.match(SolidCashParser.T__11);
			this.state = 1266;
			this.match(SolidCashParser.Identifier);
			this.state = 1273;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===66) {
				{
				{
				this.state = 1267;
				this.match(SolidCashParser.T__65);
				this.state = 1268;
				this.expression(0);
				this.state = 1269;
				this.match(SolidCashParser.T__66);
				}
				}
				this.state = 1275;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1276;
			this.match(SolidCashParser.T__86);
			this.state = 1277;
			this.match(SolidCashParser.T__48);
			this.state = 1278;
			this.expression(0);
			this.state = 1279;
			this.match(SolidCashParser.T__49);
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
		this.enterRule(localctx, 126, SolidCashParser.RULE_variableDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1310;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 146, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1282;
				this.typeName();
				this.state = 1286;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 142, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1283;
						this.modifier();
						}
						}
					}
					this.state = 1288;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 142, this._ctx);
				}
				this.state = 1289;
				this.anyIdentifier();
				this.state = 1292;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1290;
					this.match(SolidCashParser.T__39);
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
				_alt = this._interp.adaptivePredict(this._input, 144, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1297;
						this.modifier();
						}
						}
					}
					this.state = 1302;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 144, this._ctx);
				}
				this.state = 1303;
				this.anyIdentifier();
				this.state = 1306;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1304;
					this.match(SolidCashParser.T__39);
					this.state = 1305;
					this.expression(0);
					}
				}

				this.state = 1308;
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
			this.state = 1360;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 151, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
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
				this.expression(0);
				this.state = 1324;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1326;
				this.match(SolidCashParser.T__48);
				this.state = 1327;
				this.tupleSlot();
				this.state = 1330;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1328;
					this.match(SolidCashParser.T__4);
					this.state = 1329;
					this.tupleSlot();
					}
					}
					this.state = 1332;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1334;
				this.match(SolidCashParser.T__49);
				this.state = 1335;
				this.match(SolidCashParser.T__39);
				this.state = 1336;
				this.match(SolidCashParser.T__48);
				this.state = 1337;
				this.expression(0);
				this.state = 1340;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1338;
					this.match(SolidCashParser.T__4);
					this.state = 1339;
					this.expression(0);
					}
					}
					this.state = 1342;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1344;
				this.match(SolidCashParser.T__49);
				this.state = 1345;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1347;
				this.match(SolidCashParser.T__48);
				this.state = 1348;
				this.tupleSlot();
				this.state = 1351;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1349;
					this.match(SolidCashParser.T__4);
					this.state = 1350;
					this.tupleSlot();
					}
					}
					this.state = 1353;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1355;
				this.match(SolidCashParser.T__49);
				this.state = 1356;
				this.match(SolidCashParser.T__39);
				this.state = 1357;
				this.expression(0);
				this.state = 1358;
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
			this.state = 1373;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 153, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1362;
				this.typeName();
				this.state = 1366;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 15) !== 0)) {
					{
					{
					this.state = 1363;
					this.modifier();
					}
					}
					this.state = 1368;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1369;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1371;
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
			this.state = 1386;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 154, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1375;
				this.match(SolidCashParser.Identifier);
				this.state = 1376;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1377;
				this.expression(0);
				this.state = 1378;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1380;
				this.match(SolidCashParser.Identifier);
				this.state = 1381;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===88 || _la===89)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1382;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1383;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===88 || _la===89)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1384;
				this.match(SolidCashParser.Identifier);
				this.state = 1385;
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
			this.state = 1388;
			this.match(SolidCashParser.Identifier);
			this.state = 1389;
			this.match(SolidCashParser.T__89);
			this.state = 1390;
			this.match(SolidCashParser.T__48);
			this.state = 1391;
			this.expression(0);
			this.state = 1392;
			this.match(SolidCashParser.T__49);
			this.state = 1393;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1395;
			this.match(SolidCashParser.Identifier);
			this.state = 1396;
			this.match(SolidCashParser.T__90);
			this.state = 1397;
			this.match(SolidCashParser.T__48);
			this.state = 1398;
			this.match(SolidCashParser.T__49);
			this.state = 1399;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1401;
			this.match(SolidCashParser.Identifier);
			this.state = 1402;
			this.match(SolidCashParser.T__86);
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
	public stateArrayPushStatement(): StateArrayPushStatementContext {
		let localctx: StateArrayPushStatementContext = new StateArrayPushStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 140, SolidCashParser.RULE_stateArrayPushStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1408;
			this.match(SolidCashParser.T__73);
			this.state = 1409;
			this.match(SolidCashParser.T__11);
			this.state = 1410;
			this.match(SolidCashParser.Identifier);
			this.state = 1411;
			this.match(SolidCashParser.T__89);
			this.state = 1412;
			this.match(SolidCashParser.T__48);
			this.state = 1413;
			this.expression(0);
			this.state = 1414;
			this.match(SolidCashParser.T__49);
			this.state = 1415;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1417;
			this.match(SolidCashParser.T__73);
			this.state = 1418;
			this.match(SolidCashParser.T__11);
			this.state = 1419;
			this.match(SolidCashParser.Identifier);
			this.state = 1420;
			this.match(SolidCashParser.T__90);
			this.state = 1421;
			this.match(SolidCashParser.T__48);
			this.state = 1422;
			this.match(SolidCashParser.T__49);
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
	public deleteStatement(): DeleteStatementContext {
		let localctx: DeleteStatementContext = new DeleteStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 144, SolidCashParser.RULE_deleteStatement);
		let _la: number;
		try {
			this.state = 1459;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 157, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1425;
				this.match(SolidCashParser.T__91);
				this.state = 1426;
				this.match(SolidCashParser.Identifier);
				this.state = 1427;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1428;
				this.match(SolidCashParser.T__91);
				this.state = 1429;
				this.match(SolidCashParser.T__73);
				this.state = 1430;
				this.match(SolidCashParser.T__11);
				this.state = 1431;
				this.match(SolidCashParser.Identifier);
				this.state = 1432;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1433;
				this.match(SolidCashParser.T__91);
				this.state = 1434;
				this.match(SolidCashParser.T__73);
				this.state = 1435;
				this.match(SolidCashParser.T__11);
				this.state = 1436;
				this.match(SolidCashParser.Identifier);
				this.state = 1441;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1437;
					this.match(SolidCashParser.T__65);
					this.state = 1438;
					this.expression(0);
					this.state = 1439;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1443;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1445;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1447;
				this.match(SolidCashParser.T__91);
				this.state = 1448;
				this.match(SolidCashParser.Identifier);
				this.state = 1453;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1449;
					this.match(SolidCashParser.T__65);
					this.state = 1450;
					this.expression(0);
					this.state = 1451;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1455;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1457;
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
			this.state = 1461;
			this.match(SolidCashParser.T__92);
			this.state = 1462;
			this.match(SolidCashParser.T__48);
			this.state = 1463;
			this.match(SolidCashParser.TxVar);
			this.state = 1464;
			this.match(SolidCashParser.T__22);
			this.state = 1465;
			this.expression(0);
			this.state = 1468;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1466;
				this.match(SolidCashParser.T__4);
				this.state = 1467;
				this.requireMessage();
				}
			}

			this.state = 1470;
			this.match(SolidCashParser.T__49);
			this.state = 1471;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1473;
			this.match(SolidCashParser.T__92);
			this.state = 1474;
			this.match(SolidCashParser.T__48);
			this.state = 1475;
			this.expression(0);
			this.state = 1478;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1476;
				this.match(SolidCashParser.T__4);
				this.state = 1477;
				this.requireMessage();
				}
			}

			this.state = 1480;
			this.match(SolidCashParser.T__49);
			this.state = 1481;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1483;
			this.match(SolidCashParser.T__93);
			this.state = 1484;
			this.match(SolidCashParser.T__48);
			this.state = 1485;
			this.expression(0);
			this.state = 1486;
			this.match(SolidCashParser.T__49);
			this.state = 1487;
			localctx._ifBlock = this.block();
			this.state = 1490;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 160, this._ctx) ) {
			case 1:
				{
				this.state = 1488;
				this.match(SolidCashParser.T__94);
				this.state = 1489;
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
			this.state = 1498;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 161, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1492;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1493;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1494;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1495;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1496;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1497;
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
			this.state = 1500;
			this.match(SolidCashParser.T__8);
			this.state = 1501;
			this.match(SolidCashParser.T__48);
			this.state = 1502;
			this.typeName();
			this.state = 1503;
			this.match(SolidCashParser.Identifier);
			this.state = 1504;
			this.match(SolidCashParser.T__4);
			this.state = 1505;
			this.typeName();
			this.state = 1506;
			this.match(SolidCashParser.Identifier);
			this.state = 1507;
			this.match(SolidCashParser.T__95);
			this.state = 1508;
			this.match(SolidCashParser.T__73);
			this.state = 1509;
			this.match(SolidCashParser.T__11);
			this.state = 1510;
			this.match(SolidCashParser.Identifier);
			this.state = 1511;
			this.match(SolidCashParser.T__11);
			this.state = 1512;
			this.match(SolidCashParser.T__33);
			this.state = 1513;
			this.match(SolidCashParser.T__49);
			this.state = 1514;
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
			this.state = 1516;
			this.match(SolidCashParser.T__8);
			this.state = 1517;
			this.match(SolidCashParser.T__48);
			this.state = 1518;
			this.typeName();
			this.state = 1519;
			this.match(SolidCashParser.Identifier);
			this.state = 1520;
			this.match(SolidCashParser.T__96);
			this.state = 1521;
			this.match(SolidCashParser.T__73);
			this.state = 1522;
			this.match(SolidCashParser.T__11);
			this.state = 1523;
			this.match(SolidCashParser.Identifier);
			this.state = 1524;
			this.match(SolidCashParser.T__49);
			this.state = 1525;
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
			this.state = 1527;
			this.match(SolidCashParser.T__8);
			this.state = 1528;
			this.match(SolidCashParser.T__48);
			this.state = 1529;
			this.typeName();
			this.state = 1530;
			this.match(SolidCashParser.Identifier);
			this.state = 1531;
			this.match(SolidCashParser.T__95);
			this.state = 1532;
			this.match(SolidCashParser.T__73);
			this.state = 1533;
			this.match(SolidCashParser.T__11);
			this.state = 1534;
			this.match(SolidCashParser.Identifier);
			this.state = 1535;
			this.match(SolidCashParser.T__49);
			this.state = 1536;
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
			this.state = 1538;
			this.match(SolidCashParser.T__8);
			this.state = 1539;
			this.match(SolidCashParser.T__48);
			this.state = 1540;
			this.forInit();
			this.state = 1541;
			this.forCondition();
			this.state = 1543;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===175) {
				{
				this.state = 1542;
				this.forUpdate();
				}
			}

			this.state = 1545;
			this.match(SolidCashParser.T__49);
			this.state = 1546;
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
			this.state = 1548;
			this.typeName();
			this.state = 1552;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===33 || _la===56 || ((((_la - 145)) & ~0x1F) === 0 && ((1 << (_la - 145)) & 15) !== 0)) {
				{
				{
				this.state = 1549;
				this.modifier();
				}
				}
				this.state = 1554;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1555;
			this.match(SolidCashParser.Identifier);
			this.state = 1558;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 1556;
				this.match(SolidCashParser.T__39);
				this.state = 1557;
				this.expression(0);
				}
			}

			this.state = 1560;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1562;
			this.expression(0);
			this.state = 1563;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1570;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 165, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1565;
				this.match(SolidCashParser.Identifier);
				this.state = 1566;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1567;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1568;
				this.match(SolidCashParser.Identifier);
				this.state = 1569;
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
			this.state = 1572;
			this.match(SolidCashParser.T__97);
			this.state = 1573;
			this.block();
			this.state = 1574;
			this.match(SolidCashParser.T__98);
			this.state = 1575;
			this.match(SolidCashParser.T__48);
			this.state = 1576;
			this.expression(0);
			this.state = 1577;
			this.match(SolidCashParser.T__49);
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
	public whileStatement(): WhileStatementContext {
		let localctx: WhileStatementContext = new WhileStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 170, SolidCashParser.RULE_whileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1580;
			this.match(SolidCashParser.T__98);
			this.state = 1581;
			this.match(SolidCashParser.T__48);
			this.state = 1582;
			this.expression(0);
			this.state = 1583;
			this.match(SolidCashParser.T__49);
			this.state = 1584;
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
			this.state = 1586;
			this.match(SolidCashParser.T__99);
			this.state = 1587;
			this.consoleParameterList();
			this.state = 1588;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1590;
			this.match(SolidCashParser.T__100);
			this.state = 1591;
			this.match(SolidCashParser.T__3);
			this.state = 1595;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 157)) & ~0x1F) === 0 && ((1 << (_la - 157)) & 262401) !== 0)) {
				{
				{
				this.state = 1592;
				this.assemblyToken();
				}
				}
				this.state = 1597;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1598;
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
			this.state = 1600;
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
			this.state = 1602;
			this.match(SolidCashParser.T__101);
			this.state = 1603;
			this.match(SolidCashParser.T__3);
			this.state = 1607;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
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
			this.state = 1610;
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
			this.state = 1612;
			this.match(SolidCashParser.T__102);
			this.state = 1613;
			this.match(SolidCashParser.T__48);
			this.state = 1614;
			this.expression(0);
			this.state = 1615;
			this.match(SolidCashParser.T__49);
			this.state = 1616;
			this.match(SolidCashParser.T__3);
			this.state = 1620;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===104) {
				{
				{
				this.state = 1617;
				this.switchCase();
				}
				}
				this.state = 1622;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1624;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===106) {
				{
				this.state = 1623;
				this.switchDefault();
				}
			}

			this.state = 1626;
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
			this.state = 1628;
			this.match(SolidCashParser.T__103);
			this.state = 1629;
			this.expression(0);
			this.state = 1630;
			this.match(SolidCashParser.T__104);
			this.state = 1634;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
				{
				{
				this.state = 1631;
				this.statement();
				}
				}
				this.state = 1636;
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
			this.state = 1637;
			this.match(SolidCashParser.T__105);
			this.state = 1638;
			this.match(SolidCashParser.T__104);
			this.state = 1642;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 4293459059) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 3758227719) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 8379901) !== 0)) {
				{
				{
				this.state = 1639;
				this.statement();
				}
				}
				this.state = 1644;
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
			this.state = 1645;
			this.match(SolidCashParser.T__106);
			this.state = 1646;
			this.expression(0);
			this.state = 1648;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 1647;
				this.tryReturns();
				}
			}

			this.state = 1650;
			localctx._tryBlock = this.block();
			this.state = 1652;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1651;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1654;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 173, this._ctx);
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
			this.state = 1656;
			this.match(SolidCashParser.T__72);
			this.state = 1657;
			this.match(SolidCashParser.T__48);
			this.state = 1669;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 74980871) !== 0)) {
				{
				this.state = 1658;
				this.parameter();
				this.state = 1663;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 174, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1659;
						this.match(SolidCashParser.T__4);
						this.state = 1660;
						this.parameter();
						}
						}
					}
					this.state = 1665;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 174, this._ctx);
				}
				this.state = 1667;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1666;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1671;
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
			this.state = 1673;
			this.match(SolidCashParser.T__107);
			this.state = 1675;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 177, this._ctx) ) {
			case 1:
				{
				this.state = 1674;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 1692;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 181, this._ctx) ) {
			case 1:
				{
				this.state = 1677;
				this.match(SolidCashParser.T__48);
				this.state = 1689;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 74980871) !== 0)) {
					{
					this.state = 1678;
					this.parameter();
					this.state = 1683;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 178, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1679;
							this.match(SolidCashParser.T__4);
							this.state = 1680;
							this.parameter();
							}
							}
						}
						this.state = 1685;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 178, this._ctx);
					}
					this.state = 1687;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1686;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1691;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
			this.state = 1694;
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
			this.state = 1696;
			this.match(SolidCashParser.T__108);
			this.state = 1697;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1699;
			this.match(SolidCashParser.T__109);
			this.state = 1700;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1705;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 163:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1702;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 175:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1703;
				this.match(SolidCashParser.Identifier);
				this.state = 1704;
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
			this.state = 1749;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 188, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1707;
				this.match(SolidCashParser.T__35);
				this.state = 1708;
				this.match(SolidCashParser.Identifier);
				this.state = 1711;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1709;
					this.match(SolidCashParser.T__11);
					this.state = 1710;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1713;
				this.match(SolidCashParser.T__48);
				this.state = 1714;
				this.match(SolidCashParser.T__3);
				this.state = 1726;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===175) {
					{
					this.state = 1715;
					this.namedArg();
					this.state = 1720;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 184, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1716;
							this.match(SolidCashParser.T__4);
							this.state = 1717;
							this.namedArg();
							}
							}
						}
						this.state = 1722;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 184, this._ctx);
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

					}
				}

				this.state = 1728;
				this.match(SolidCashParser.T__5);
				this.state = 1729;
				this.match(SolidCashParser.T__49);
				this.state = 1730;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1731;
				this.match(SolidCashParser.T__35);
				this.state = 1732;
				this.match(SolidCashParser.Identifier);
				this.state = 1735;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1733;
					this.match(SolidCashParser.T__11);
					this.state = 1734;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1737;
				this.expressionList();
				this.state = 1738;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1740;
				this.match(SolidCashParser.T__35);
				this.state = 1741;
				this.match(SolidCashParser.T__48);
				this.state = 1742;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1743;
				this.match(SolidCashParser.T__49);
				this.state = 1744;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1745;
				this.match(SolidCashParser.T__35);
				this.state = 1746;
				this.match(SolidCashParser.T__48);
				this.state = 1747;
				this.match(SolidCashParser.T__49);
				this.state = 1748;
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
			this.state = 1751;
			this.match(SolidCashParser.T__110);
			this.state = 1752;
			this.match(SolidCashParser.T__48);
			this.state = 1753;
			this.expression(0);
			this.state = 1754;
			this.match(SolidCashParser.T__49);
			this.state = 1755;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1759;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 175:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1757;
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
				this.state = 1758;
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
			this.state = 1761;
			this.match(SolidCashParser.T__48);
			this.state = 1773;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 7347225) !== 0)) {
				{
				this.state = 1762;
				this.consoleParameter();
				this.state = 1767;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 190, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1763;
						this.match(SolidCashParser.T__4);
						this.state = 1764;
						this.consoleParameter();
						}
						}
					}
					this.state = 1769;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 190, this._ctx);
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

				}
			}

			this.state = 1775;
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
			this.state = 1801;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 196, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1777;
				this.match(SolidCashParser.Identifier);
				this.state = 1778;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1779;
				this.match(SolidCashParser.Identifier);
				this.state = 1780;
				this.match(SolidCashParser.T__11);
				this.state = 1781;
				this.match(SolidCashParser.Identifier);
				this.state = 1782;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1783;
				this.match(SolidCashParser.Identifier);
				this.state = 1784;
				this.match(SolidCashParser.T__48);
				this.state = 1785;
				this.match(SolidCashParser.T__3);
				this.state = 1797;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===175) {
					{
					this.state = 1786;
					this.namedArg();
					this.state = 1791;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 193, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1787;
							this.match(SolidCashParser.T__4);
							this.state = 1788;
							this.namedArg();
							}
							}
						}
						this.state = 1793;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 193, this._ctx);
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

					}
				}

				this.state = 1799;
				this.match(SolidCashParser.T__5);
				this.state = 1800;
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
			this.state = 1803;
			this.match(SolidCashParser.Identifier);
			this.state = 1804;
			this.match(SolidCashParser.T__104);
			this.state = 1805;
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
			this.state = 1807;
			this.match(SolidCashParser.T__48);
			this.state = 1819;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 112)) & ~0x1F) === 0 && ((1 << (_la - 112)) & 33622015) !== 0) || ((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 134078423) !== 0)) {
				{
				this.state = 1808;
				this.expression(0);
				this.state = 1813;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 197, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1809;
						this.match(SolidCashParser.T__4);
						this.state = 1810;
						this.expression(0);
						}
						}
					}
					this.state = 1815;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 197, this._ctx);
				}
				this.state = 1817;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1816;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1821;
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
			this.state = 1823;
			this.match(SolidCashParser.T__3);
			this.state = 1824;
			this.callOption();
			this.state = 1829;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 200, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1825;
					this.match(SolidCashParser.T__4);
					this.state = 1826;
					this.callOption();
					}
					}
				}
				this.state = 1831;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 200, this._ctx);
			}
			this.state = 1833;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1832;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1835;
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
			this.state = 1837;
			this.match(SolidCashParser.Identifier);
			this.state = 1838;
			this.match(SolidCashParser.T__104);
			this.state = 1839;
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
			this.state = 1841;
			this.match(SolidCashParser.T__48);
			this.state = 1842;
			this.typeName();
			this.state = 1847;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 202, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1843;
					this.match(SolidCashParser.T__4);
					this.state = 1844;
					this.typeName();
					}
					}
				}
				this.state = 1849;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 202, this._ctx);
			}
			this.state = 1851;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1850;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1853;
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
			this.state = 1984;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 210, this._ctx) ) {
			case 1:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 1856;
				this.match(SolidCashParser.T__48);
				this.state = 1857;
				this.expression(0);
				this.state = 1858;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1860;
				this.typeCast();
				this.state = 1861;
				this.match(SolidCashParser.T__48);
				this.state = 1862;
				(localctx as CastContext)._castable = this.expression(0);
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
				break;
			case 3:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1868;
				this.functionCall();
				}
				break;
			case 4:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1869;
				this.match(SolidCashParser.T__111);
				this.state = 1870;
				this.match(SolidCashParser.Identifier);
				this.state = 1872;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1871;
					this.callOptions();
					}
				}

				this.state = 1874;
				this.expressionList();
				}
				break;
			case 5:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1875;
				this.match(SolidCashParser.T__111);
				this.state = 1876;
				this.typeName();
				this.state = 1877;
				this.match(SolidCashParser.T__65);
				this.state = 1878;
				this.match(SolidCashParser.T__66);
				this.state = 1879;
				this.match(SolidCashParser.T__48);
				this.state = 1880;
				this.expression(0);
				this.state = 1881;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 6:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1883;
				this.match(SolidCashParser.T__54);
				this.state = 1884;
				this.match(SolidCashParser.T__48);
				this.state = 1885;
				this.typeName();
				this.state = 1886;
				this.match(SolidCashParser.T__49);
				this.state = 1887;
				this.match(SolidCashParser.T__11);
				this.state = 1888;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 7:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1890;
				this.match(SolidCashParser.T__112);
				this.state = 1891;
				this.expressionList();
				}
				break;
			case 8:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1892;
				this.match(SolidCashParser.T__113);
				this.state = 1893;
				this.expressionList();
				}
				break;
			case 9:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1894;
				this.match(SolidCashParser.T__114);
				this.state = 1895;
				this.expressionList();
				}
				break;
			case 10:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1896;
				this.match(SolidCashParser.T__115);
				this.state = 1897;
				this.expressionList();
				}
				break;
			case 11:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1898;
				this.match(SolidCashParser.T__116);
				this.state = 1899;
				this.match(SolidCashParser.T__48);
				this.state = 1900;
				this.match(SolidCashParser.Identifier);
				this.state = 1901;
				this.match(SolidCashParser.T__11);
				this.state = 1902;
				this.match(SolidCashParser.Identifier);
				this.state = 1903;
				this.match(SolidCashParser.T__4);
				this.state = 1904;
				this.expressionList();
				this.state = 1905;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 12:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1907;
				this.match(SolidCashParser.T__117);
				this.state = 1908;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1909;
				this.match(SolidCashParser.T__118);
				this.state = 1910;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1911;
				this.match(SolidCashParser.T__119);
				this.state = 1912;
				this.match(SolidCashParser.T__48);
				this.state = 1913;
				this.expression(0);
				this.state = 1914;
				this.match(SolidCashParser.T__4);
				this.state = 1915;
				this.typeList();
				this.state = 1916;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 15:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1918;
				this.match(SolidCashParser.T__120);
				this.state = 1919;
				this.match(SolidCashParser.T__48);
				this.state = 1920;
				this.expression(0);
				this.state = 1921;
				this.match(SolidCashParser.T__4);
				this.state = 1922;
				this.typeList();
				this.state = 1923;
				this.match(SolidCashParser.T__4);
				this.state = 1924;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1925;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 16:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1927;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__121);
				this.state = 1928;
				this.match(SolidCashParser.T__65);
				this.state = 1929;
				this.expression(0);
				this.state = 1930;
				this.match(SolidCashParser.T__66);
				this.state = 1931;
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
				this.state = 1933;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__127);
				this.state = 1934;
				this.match(SolidCashParser.T__65);
				this.state = 1935;
				this.expression(0);
				this.state = 1936;
				this.match(SolidCashParser.T__66);
				this.state = 1937;
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
				this.state = 1939;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===137)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1940;
				this.expression(21);
				}
				break;
			case 19:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1941;
				this.match(SolidCashParser.T__65);
				this.state = 1953;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 112)) & ~0x1F) === 0 && ((1 << (_la - 112)) & 33622015) !== 0) || ((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 134078423) !== 0)) {
					{
					this.state = 1942;
					this.expression(0);
					this.state = 1947;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 206, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1943;
							this.match(SolidCashParser.T__4);
							this.state = 1944;
							this.expression(0);
							}
							}
						}
						this.state = 1949;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 206, this._ctx);
					}
					this.state = 1951;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1950;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1955;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 20:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1956;
				this.match(SolidCashParser.T__73);
				this.state = 1957;
				this.match(SolidCashParser.T__11);
				this.state = 1958;
				this.match(SolidCashParser.Identifier);
				this.state = 1959;
				this.match(SolidCashParser.T__11);
				this.state = 1960;
				this.match(SolidCashParser.Identifier);
				this.state = 1961;
				this.match(SolidCashParser.T__65);
				this.state = 1962;
				this.expression(0);
				this.state = 1963;
				this.match(SolidCashParser.T__66);
				this.state = 1964;
				this.memberName();
				}
				break;
			case 21:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1966;
				this.match(SolidCashParser.T__73);
				this.state = 1967;
				this.match(SolidCashParser.T__11);
				this.state = 1968;
				this.match(SolidCashParser.Identifier);
				this.state = 1973;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 1969;
						this.match(SolidCashParser.T__65);
						this.state = 1970;
						this.expression(0);
						this.state = 1971;
						this.match(SolidCashParser.T__66);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 1975;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 209, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 22:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1977;
				this.match(SolidCashParser.T__73);
				this.state = 1978;
				this.match(SolidCashParser.T__11);
				this.state = 1979;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 23:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1980;
				this.match(SolidCashParser.T__73);
				}
				break;
			case 24:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1981;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 25:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1982;
				this.anyIdentifier();
				}
				break;
			case 26:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1983;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2091;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 217, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2089;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 216, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1986;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 1987;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 1988;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1989;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 1990;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1991;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1992;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 1993;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1994;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1995;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 1996;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===138 || _la===139)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1997;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 1998;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 1999;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2000;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2001;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2002;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2003;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2004;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2005;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2006;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2007;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2008;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2009;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2010;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2011;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2012;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2013;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2014;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__139);
						this.state = 2015;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2016;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2017;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__140);
						this.state = 2018;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2019;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 2020;
						this.match(SolidCashParser.T__141);
						this.state = 2021;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 2022;
						this.match(SolidCashParser.T__104);
						this.state = 2023;
						(localctx as TernaryOpContext)._ifFalse = this.expression(9);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2025;
						if (!(this.precpred(this._ctx, 32))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 32)");
						}
						this.state = 2026;
						this.match(SolidCashParser.T__65);
						this.state = 2027;
						(localctx as IndexRangeSliceContext)._start = this.expression(0);
						this.state = 2028;
						this.match(SolidCashParser.T__104);
						this.state = 2029;
						(localctx as IndexRangeSliceContext)._end = this.expression(0);
						this.state = 2030;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2032;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 2033;
						this.match(SolidCashParser.T__65);
						this.state = 2034;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2035;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2036;
						if (!(this.precpred(this._ctx, 30))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 30)");
						}
						this.state = 2037;
						this.match(SolidCashParser.T__65);
						this.state = 2038;
						this.expression(0);
						this.state = 2039;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2041;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2042;
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
						this.state = 2043;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2044;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__134);
						this.state = 2045;
						this.match(SolidCashParser.T__48);
						this.state = 2046;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2047;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2049;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2050;
						this.match(SolidCashParser.T__135);
						this.state = 2051;
						this.match(SolidCashParser.T__48);
						this.state = 2052;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2053;
						this.match(SolidCashParser.T__4);
						this.state = 2054;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2055;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2057;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2058;
						this.match(SolidCashParser.T__11);
						this.state = 2059;
						this.match(SolidCashParser.Identifier);
						this.state = 2061;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2060;
							this.callOptions();
							}
						}

						this.state = 2063;
						this.match(SolidCashParser.T__48);
						this.state = 2064;
						this.match(SolidCashParser.T__3);
						this.state = 2076;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===175) {
							{
							this.state = 2065;
							this.namedArg();
							this.state = 2070;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 212, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2066;
									this.match(SolidCashParser.T__4);
									this.state = 2067;
									this.namedArg();
									}
									}
								}
								this.state = 2072;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 212, this._ctx);
							}
							this.state = 2074;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2073;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2078;
						this.match(SolidCashParser.T__5);
						this.state = 2079;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 20:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2080;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2081;
						this.match(SolidCashParser.T__11);
						this.state = 2082;
						this.match(SolidCashParser.Identifier);
						this.state = 2084;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2083;
							this.callOptions();
							}
						}

						this.state = 2086;
						this.expressionList();
						}
						break;
					case 21:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2087;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 2088;
						this.memberName();
						}
						break;
					}
					}
				}
				this.state = 2093;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 217, this._ctx);
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
			this.state = 2107;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2094;
				this.match(SolidCashParser.T__11);
				this.state = 2095;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 123:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2096;
				this.match(SolidCashParser.T__122);
				}
				break;
			case 124:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2097;
				this.match(SolidCashParser.T__123);
				}
				break;
			case 125:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2098;
				this.match(SolidCashParser.T__124);
				}
				break;
			case 126:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2099;
				this.match(SolidCashParser.T__125);
				}
				break;
			case 127:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2100;
				this.match(SolidCashParser.T__126);
				}
				break;
			case 129:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2101;
				this.match(SolidCashParser.T__128);
				}
				break;
			case 130:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2102;
				this.match(SolidCashParser.T__129);
				}
				break;
			case 131:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2103;
				this.match(SolidCashParser.T__130);
				}
				break;
			case 132:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2104;
				this.match(SolidCashParser.T__131);
				}
				break;
			case 143:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2105;
				this.match(SolidCashParser.T__142);
				}
				break;
			case 144:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2106;
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
			this.state = 2109;
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
			this.state = 2125;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 153:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2111;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 157:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2112;
				this.numberLiteral();
				}
				break;
			case 156:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2113;
				this.decimalLiteral();
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2114;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2118;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 219, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2115;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2120;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 219, this._ctx);
				}
				}
				break;
			case 173:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2121;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 174:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2122;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 164:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2123;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 165:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2124;
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
			this.state = 2127;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2129;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 221, this._ctx) ) {
			case 1:
				{
				this.state = 2128;
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
			this.state = 2131;
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
			this.state = 2177;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 226, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2133;
				this.match(SolidCashParser.T__148);
				this.state = 2134;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2135;
				this.match(SolidCashParser.T__148);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2136;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2137;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2138;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2139;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2140;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2141;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2142;
				this.match(SolidCashParser.T__149);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2143;
				this.match(SolidCashParser.T__150);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2144;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2145;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2146;
				this.match(SolidCashParser.T__6);
				this.state = 2147;
				this.match(SolidCashParser.T__48);
				this.state = 2156;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 74980871) !== 0)) {
					{
					this.state = 2148;
					this.typeName();
					this.state = 2153;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2149;
						this.match(SolidCashParser.T__4);
						this.state = 2150;
						this.typeName();
						}
						}
						this.state = 2155;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2158;
				this.match(SolidCashParser.T__49);
				this.state = 2171;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===73) {
					{
					this.state = 2159;
					this.match(SolidCashParser.T__72);
					this.state = 2160;
					this.match(SolidCashParser.T__48);
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
					this.state = 2169;
					this.match(SolidCashParser.T__49);
					}
				}

				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2173;
				this.match(SolidCashParser.Identifier);
				this.state = 2174;
				this.match(SolidCashParser.T__11);
				this.state = 2175;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 2176;
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
			this.state = 2179;
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

	public static readonly _serializedATN: number[] = [4,1,178,2182,2,0,7,0,
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
	617,1,25,1,25,1,26,1,26,1,26,1,26,1,27,1,27,1,27,1,27,1,27,1,27,5,27,632,
	8,27,10,27,12,27,635,9,27,1,27,3,27,638,8,27,1,27,1,27,1,28,1,28,1,28,3,
	28,645,8,28,1,29,1,29,1,29,1,29,1,29,1,29,1,30,1,30,1,30,1,30,1,30,1,30,
	1,30,1,31,1,31,1,31,5,31,663,8,31,10,31,12,31,666,9,31,1,31,5,31,669,8,
	31,10,31,12,31,672,9,31,1,31,1,31,5,31,676,8,31,10,31,12,31,679,9,31,1,
	31,1,31,1,32,1,32,1,32,1,32,5,32,687,8,32,10,32,12,32,690,9,32,1,32,5,32,
	693,8,32,10,32,12,32,696,9,32,1,32,1,32,5,32,700,8,32,10,32,12,32,703,9,
	32,1,32,1,32,1,33,1,33,1,33,3,33,710,8,33,1,34,1,34,1,34,1,34,1,34,1,34,
	1,34,5,34,719,8,34,10,34,12,34,722,9,34,1,34,1,34,1,35,1,35,1,35,1,36,3,
	36,730,8,36,1,36,1,36,5,36,734,8,36,10,36,12,36,737,9,36,1,36,1,36,1,36,
	3,36,742,8,36,1,36,1,36,1,36,1,36,1,36,5,36,749,8,36,10,36,12,36,752,9,
	36,1,36,1,36,1,36,3,36,757,8,36,1,36,1,36,1,36,3,36,762,8,36,1,36,1,36,
	5,36,766,8,36,10,36,12,36,769,9,36,1,36,1,36,1,36,1,36,3,36,775,8,36,1,
	36,1,36,5,36,779,8,36,10,36,12,36,782,9,36,1,36,1,36,1,36,3,36,787,8,36,
	1,36,1,36,3,36,791,8,36,1,37,1,37,3,37,795,8,37,1,38,1,38,1,39,1,39,1,39,
	1,39,3,39,803,8,39,1,39,1,39,1,39,3,39,808,8,39,1,39,1,39,1,39,1,39,1,39,
	1,39,3,39,816,8,39,1,39,1,39,1,39,1,39,1,39,1,39,1,39,1,39,3,39,826,8,39,
	1,39,1,39,1,39,3,39,831,8,39,1,39,1,39,3,39,835,8,39,1,40,1,40,1,40,1,40,
	1,40,1,40,1,40,1,40,1,40,1,40,3,40,847,8,40,1,40,1,40,1,40,1,40,1,40,1,
	40,1,40,5,40,856,8,40,10,40,12,40,859,9,40,1,41,1,41,1,41,3,41,864,8,41,
	1,41,1,41,5,41,868,8,41,10,41,12,41,871,9,41,1,41,1,41,1,42,1,42,3,42,877,
	8,42,1,43,1,43,1,43,1,44,1,44,1,44,1,44,5,44,886,8,44,10,44,12,44,889,9,
	44,1,44,5,44,892,8,44,10,44,12,44,895,9,44,1,44,3,44,898,8,44,1,44,1,44,
	5,44,902,8,44,10,44,12,44,905,9,44,1,44,1,44,1,45,1,45,3,45,911,8,45,1,
	46,1,46,1,46,1,46,1,46,1,46,1,46,1,46,1,46,1,46,1,46,1,46,1,46,1,46,3,46,
	927,8,46,1,47,1,47,1,47,1,47,1,47,5,47,934,8,47,10,47,12,47,937,9,47,1,
	47,3,47,940,8,47,1,48,1,48,1,48,1,48,3,48,946,8,48,1,49,1,49,1,49,1,49,
	1,49,5,49,953,8,49,10,49,12,49,956,9,49,1,49,3,49,959,8,49,1,49,1,49,1,
	50,1,50,5,50,965,8,50,10,50,12,50,968,9,50,1,50,3,50,971,8,50,1,50,1,50,
	5,50,975,8,50,10,50,12,50,978,9,50,1,50,3,50,981,8,50,3,50,983,8,50,1,51,
	1,51,1,51,1,51,5,51,989,8,51,10,51,12,51,992,9,51,1,51,3,51,995,8,51,3,
	51,997,8,51,1,51,1,51,1,52,1,52,5,52,1003,8,52,10,52,12,52,1006,9,52,1,
	52,3,52,1009,8,52,1,52,1,52,5,52,1013,8,52,10,52,12,52,1016,9,52,1,52,3,
	52,1019,8,52,3,52,1021,8,52,1,53,1,53,5,53,1025,8,53,10,53,12,53,1028,9,
	53,1,53,1,53,3,53,1032,8,53,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,
	1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,
	54,1,54,1,54,1,54,1,54,1,54,1,54,3,54,1064,8,54,1,55,1,55,1,55,1,55,1,55,
	1,55,1,55,1,55,1,55,1,55,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,
	56,1,56,1,56,5,56,1088,8,56,10,56,12,56,1091,9,56,1,56,1,56,1,56,1,57,1,
	57,1,57,1,57,1,57,1,57,5,57,1102,8,57,10,57,12,57,1105,9,57,1,57,1,57,1,
	57,1,57,1,57,1,57,1,57,5,57,1114,8,57,10,57,12,57,1117,9,57,1,57,3,57,1120,
	8,57,1,57,1,57,1,57,3,57,1125,8,57,1,58,1,58,1,58,3,58,1130,8,58,1,58,1,
	58,1,58,1,58,1,58,5,58,1137,8,58,10,58,12,58,1140,9,58,1,58,3,58,1143,8,
	58,3,58,1145,8,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,
	1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,3,58,1167,8,58,1,58,1,58,1,
	58,3,58,1172,8,58,1,59,1,59,1,59,1,59,3,59,1178,8,59,1,59,1,59,1,59,1,60,
	1,60,1,60,1,60,3,60,1187,8,60,1,60,1,60,1,60,1,60,1,60,5,60,1194,8,60,10,
	60,12,60,1197,9,60,1,60,3,60,1200,8,60,3,60,1202,8,60,1,60,1,60,1,60,1,
	60,1,60,1,60,1,60,3,60,1211,8,60,1,60,1,60,1,60,3,60,1216,8,60,1,61,1,61,
	1,61,1,61,1,61,1,61,1,61,4,61,1225,8,61,11,61,12,61,1226,1,61,1,61,3,61,
	1231,8,61,3,61,1233,8,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,4,
	61,1244,8,61,11,61,12,61,1245,1,61,1,61,3,61,1250,8,61,1,61,1,61,1,61,1,
	61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,3,61,1263,8,61,1,62,1,62,1,62,1,62,
	1,62,1,62,1,62,5,62,1272,8,62,10,62,12,62,1275,9,62,1,62,1,62,1,62,1,62,
	1,62,1,62,1,63,1,63,5,63,1285,8,63,10,63,12,63,1288,9,63,1,63,1,63,1,63,
	3,63,1293,8,63,1,63,1,63,1,63,1,63,5,63,1299,8,63,10,63,12,63,1302,9,63,
	1,63,1,63,1,63,3,63,1307,8,63,1,63,1,63,3,63,1311,8,63,1,64,1,64,1,64,1,
	64,1,64,1,64,4,64,1319,8,64,11,64,12,64,1320,1,64,1,64,1,64,1,64,1,64,1,
	64,1,64,1,64,4,64,1331,8,64,11,64,12,64,1332,1,64,1,64,1,64,1,64,1,64,1,
	64,4,64,1341,8,64,11,64,12,64,1342,1,64,1,64,1,64,1,64,1,64,1,64,1,64,4,
	64,1352,8,64,11,64,12,64,1353,1,64,1,64,1,64,1,64,1,64,3,64,1361,8,64,1,
	65,1,65,5,65,1365,8,65,10,65,12,65,1368,9,65,1,65,1,65,1,65,1,65,3,65,1374,
	8,65,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,3,66,1387,8,
	66,1,67,1,67,1,67,1,67,1,67,1,67,1,67,1,68,1,68,1,68,1,68,1,68,1,68,1,69,
	1,69,1,69,1,69,1,69,1,69,1,69,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,
	70,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,72,1,72,1,72,1,72,1,72,1,72,
	1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,4,72,1442,8,72,11,72,
	12,72,1443,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,4,72,1454,8,72,11,72,
	12,72,1455,1,72,1,72,3,72,1460,8,72,1,73,1,73,1,73,1,73,1,73,1,73,1,73,
	3,73,1469,8,73,1,73,1,73,1,73,1,74,1,74,1,74,1,74,1,74,3,74,1479,8,74,1,
	74,1,74,1,74,1,75,1,75,1,75,1,75,1,75,1,75,1,75,3,75,1491,8,75,1,76,1,76,
	1,76,1,76,1,76,1,76,3,76,1499,8,76,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,
	77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,78,1,78,1,78,1,78,1,78,1,78,
	1,78,1,78,1,78,1,78,1,78,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,
	79,1,79,1,80,1,80,1,80,1,80,1,80,3,80,1544,8,80,1,80,1,80,1,80,1,81,1,81,
	5,81,1551,8,81,10,81,12,81,1554,9,81,1,81,1,81,1,81,3,81,1559,8,81,1,81,
	1,81,1,82,1,82,1,82,1,83,1,83,1,83,1,83,1,83,3,83,1571,8,83,1,84,1,84,1,
	84,1,84,1,84,1,84,1,84,1,84,1,85,1,85,1,85,1,85,1,85,1,85,1,86,1,86,1,86,
	1,86,1,87,1,87,1,87,5,87,1594,8,87,10,87,12,87,1597,9,87,1,87,1,87,1,88,
	1,88,1,89,1,89,1,89,5,89,1606,8,89,10,89,12,89,1609,9,89,1,89,1,89,1,90,
	1,90,1,90,1,90,1,90,1,90,5,90,1619,8,90,10,90,12,90,1622,9,90,1,90,3,90,
	1625,8,90,1,90,1,90,1,91,1,91,1,91,1,91,5,91,1633,8,91,10,91,12,91,1636,
	9,91,1,92,1,92,1,92,5,92,1641,8,92,10,92,12,92,1644,9,92,1,93,1,93,1,93,
	3,93,1649,8,93,1,93,1,93,4,93,1653,8,93,11,93,12,93,1654,1,94,1,94,1,94,
	1,94,1,94,5,94,1662,8,94,10,94,12,94,1665,9,94,1,94,3,94,1668,8,94,3,94,
	1670,8,94,1,94,1,94,1,95,1,95,3,95,1676,8,95,1,95,1,95,1,95,1,95,5,95,1682,
	8,95,10,95,12,95,1685,9,95,1,95,3,95,1688,8,95,3,95,1690,8,95,1,95,3,95,
	1693,8,95,1,95,1,95,1,96,1,96,1,96,1,97,1,97,1,97,1,98,1,98,1,98,3,98,1706,
	8,98,1,99,1,99,1,99,1,99,3,99,1712,8,99,1,99,1,99,1,99,1,99,1,99,5,99,1719,
	8,99,10,99,12,99,1722,9,99,1,99,3,99,1725,8,99,3,99,1727,8,99,1,99,1,99,
	1,99,1,99,1,99,1,99,1,99,3,99,1736,8,99,1,99,1,99,1,99,1,99,1,99,1,99,1,
	99,1,99,1,99,1,99,1,99,1,99,3,99,1750,8,99,1,100,1,100,1,100,1,100,1,100,
	1,100,1,101,1,101,3,101,1760,8,101,1,102,1,102,1,102,1,102,5,102,1766,8,
	102,10,102,12,102,1769,9,102,1,102,3,102,1772,8,102,3,102,1774,8,102,1,
	102,1,102,1,103,1,103,1,103,1,103,1,103,1,103,1,103,1,103,1,103,1,103,1,
	103,1,103,5,103,1790,8,103,10,103,12,103,1793,9,103,1,103,3,103,1796,8,
	103,3,103,1798,8,103,1,103,1,103,3,103,1802,8,103,1,104,1,104,1,104,1,104,
	1,105,1,105,1,105,1,105,5,105,1812,8,105,10,105,12,105,1815,9,105,1,105,
	3,105,1818,8,105,3,105,1820,8,105,1,105,1,105,1,106,1,106,1,106,1,106,5,
	106,1828,8,106,10,106,12,106,1831,9,106,1,106,3,106,1834,8,106,1,106,1,
	106,1,107,1,107,1,107,1,107,1,108,1,108,1,108,1,108,5,108,1846,8,108,10,
	108,12,108,1849,9,108,1,108,3,108,1852,8,108,1,108,1,108,1,109,1,109,1,
	109,1,109,1,109,1,109,1,109,1,109,1,109,3,109,1865,8,109,1,109,1,109,1,
	109,1,109,1,109,1,109,3,109,1873,8,109,1,109,1,109,1,109,1,109,1,109,1,
	109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,
	109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,
	109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,
	109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,
	109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,
	109,1,109,1,109,1,109,1,109,1,109,5,109,1946,8,109,10,109,12,109,1949,9,
	109,1,109,3,109,1952,8,109,3,109,1954,8,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,4,109,1974,8,109,11,109,12,109,1975,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,3,109,1985,8,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,3,109,2062,8,109,1,109,
	1,109,1,109,1,109,1,109,5,109,2069,8,109,10,109,12,109,2072,9,109,1,109,
	3,109,2075,8,109,3,109,2077,8,109,1,109,1,109,1,109,1,109,1,109,1,109,3,
	109,2085,8,109,1,109,1,109,1,109,5,109,2090,8,109,10,109,12,109,2093,9,
	109,1,110,1,110,1,110,1,110,1,110,1,110,1,110,1,110,1,110,1,110,1,110,1,
	110,1,110,3,110,2108,8,110,1,111,1,111,1,112,1,112,1,112,1,112,1,112,5,
	112,2117,8,112,10,112,12,112,2120,9,112,1,112,1,112,1,112,1,112,3,112,2126,
	8,112,1,113,1,113,3,113,2130,8,113,1,114,1,114,1,115,1,115,1,115,1,115,
	1,115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,
	1,115,1,115,5,115,2152,8,115,10,115,12,115,2155,9,115,3,115,2157,8,115,
	1,115,1,115,1,115,1,115,1,115,1,115,5,115,2165,8,115,10,115,12,115,2168,
	9,115,1,115,1,115,3,115,2172,8,115,1,115,1,115,1,115,1,115,3,115,2178,8,
	115,1,116,1,116,1,116,0,2,80,218,117,0,2,4,6,8,10,12,14,16,18,20,22,24,
	26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,
	74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,110,112,114,
	116,118,120,122,124,126,128,130,132,134,136,138,140,142,144,146,148,150,
	152,154,156,158,160,162,164,166,168,170,172,174,176,178,180,182,184,186,
	188,190,192,194,196,198,200,202,204,206,208,210,212,214,216,218,220,222,
	224,226,228,230,232,0,22,2,0,10,10,13,27,5,0,11,11,28,36,155,155,159,159,
	175,175,1,0,38,39,3,0,20,23,26,27,40,40,1,0,43,44,2,0,43,44,58,59,3,0,43,
	44,58,58,63,63,2,0,40,40,77,86,1,0,88,89,3,0,157,157,165,165,175,175,1,
	0,123,127,2,0,123,127,129,132,3,0,14,14,27,27,137,137,2,0,10,10,15,16,1,
	0,13,14,1,0,138,139,1,0,20,23,1,0,18,19,1,0,133,134,3,0,33,33,56,56,145,
	148,1,0,154,155,4,0,59,59,149,151,158,161,167,171,2450,0,237,1,0,0,0,2,
	289,1,0,0,0,4,291,1,0,0,0,6,296,1,0,0,0,8,352,1,0,0,0,10,354,1,0,0,0,12,
	363,1,0,0,0,14,365,1,0,0,0,16,367,1,0,0,0,18,372,1,0,0,0,20,374,1,0,0,0,
	22,379,1,0,0,0,24,383,1,0,0,0,26,385,1,0,0,0,28,424,1,0,0,0,30,426,1,0,
	0,0,32,431,1,0,0,0,34,433,1,0,0,0,36,447,1,0,0,0,38,501,1,0,0,0,40,541,
	1,0,0,0,42,561,1,0,0,0,44,583,1,0,0,0,46,589,1,0,0,0,48,608,1,0,0,0,50,
	611,1,0,0,0,52,621,1,0,0,0,54,625,1,0,0,0,56,641,1,0,0,0,58,646,1,0,0,0,
	60,652,1,0,0,0,62,659,1,0,0,0,64,682,1,0,0,0,66,709,1,0,0,0,68,711,1,0,
	0,0,70,725,1,0,0,0,72,790,1,0,0,0,74,794,1,0,0,0,76,796,1,0,0,0,78,834,
	1,0,0,0,80,846,1,0,0,0,82,860,1,0,0,0,84,876,1,0,0,0,86,878,1,0,0,0,88,
	881,1,0,0,0,90,908,1,0,0,0,92,926,1,0,0,0,94,928,1,0,0,0,96,941,1,0,0,0,
	98,947,1,0,0,0,100,982,1,0,0,0,102,984,1,0,0,0,104,1020,1,0,0,0,106,1031,
	1,0,0,0,108,1063,1,0,0,0,110,1065,1,0,0,0,112,1075,1,0,0,0,114,1124,1,0,
	0,0,116,1171,1,0,0,0,118,1173,1,0,0,0,120,1215,1,0,0,0,122,1262,1,0,0,0,
	124,1264,1,0,0,0,126,1310,1,0,0,0,128,1360,1,0,0,0,130,1373,1,0,0,0,132,
	1386,1,0,0,0,134,1388,1,0,0,0,136,1395,1,0,0,0,138,1401,1,0,0,0,140,1408,
	1,0,0,0,142,1417,1,0,0,0,144,1459,1,0,0,0,146,1461,1,0,0,0,148,1473,1,0,
	0,0,150,1483,1,0,0,0,152,1498,1,0,0,0,154,1500,1,0,0,0,156,1516,1,0,0,0,
	158,1527,1,0,0,0,160,1538,1,0,0,0,162,1548,1,0,0,0,164,1562,1,0,0,0,166,
	1570,1,0,0,0,168,1572,1,0,0,0,170,1580,1,0,0,0,172,1586,1,0,0,0,174,1590,
	1,0,0,0,176,1600,1,0,0,0,178,1602,1,0,0,0,180,1612,1,0,0,0,182,1628,1,0,
	0,0,184,1637,1,0,0,0,186,1645,1,0,0,0,188,1656,1,0,0,0,190,1673,1,0,0,0,
	192,1696,1,0,0,0,194,1699,1,0,0,0,196,1705,1,0,0,0,198,1749,1,0,0,0,200,
	1751,1,0,0,0,202,1759,1,0,0,0,204,1761,1,0,0,0,206,1801,1,0,0,0,208,1803,
	1,0,0,0,210,1807,1,0,0,0,212,1823,1,0,0,0,214,1837,1,0,0,0,216,1841,1,0,
	0,0,218,1984,1,0,0,0,220,2107,1,0,0,0,222,2109,1,0,0,0,224,2125,1,0,0,0,
	226,2127,1,0,0,0,228,2131,1,0,0,0,230,2177,1,0,0,0,232,2179,1,0,0,0,234,
	236,3,16,8,0,235,234,1,0,0,0,236,239,1,0,0,0,237,235,1,0,0,0,237,238,1,
	0,0,0,238,243,1,0,0,0,239,237,1,0,0,0,240,242,3,2,1,0,241,240,1,0,0,0,242,
	245,1,0,0,0,243,241,1,0,0,0,243,244,1,0,0,0,244,258,1,0,0,0,245,243,1,0,
	0,0,246,257,3,60,30,0,247,257,3,54,27,0,248,257,3,50,25,0,249,257,3,58,
	29,0,250,257,3,8,4,0,251,257,3,46,23,0,252,257,3,26,13,0,253,257,3,6,3,
	0,254,257,3,36,18,0,255,257,3,38,19,0,256,246,1,0,0,0,256,247,1,0,0,0,256,
	248,1,0,0,0,256,249,1,0,0,0,256,250,1,0,0,0,256,251,1,0,0,0,256,252,1,0,
	0,0,256,253,1,0,0,0,256,254,1,0,0,0,256,255,1,0,0,0,257,260,1,0,0,0,258,
	256,1,0,0,0,258,259,1,0,0,0,259,261,1,0,0,0,260,258,1,0,0,0,261,262,5,0,
	0,1,262,1,1,0,0,0,263,264,5,1,0,0,264,265,5,163,0,0,265,290,5,2,0,0,266,
	267,5,1,0,0,267,268,5,163,0,0,268,269,5,3,0,0,269,270,5,175,0,0,270,290,
	5,2,0,0,271,272,5,1,0,0,272,273,5,4,0,0,273,278,3,4,2,0,274,275,5,5,0,0,
	275,277,3,4,2,0,276,274,1,0,0,0,277,280,1,0,0,0,278,276,1,0,0,0,278,279,
	1,0,0,0,279,282,1,0,0,0,280,278,1,0,0,0,281,283,5,5,0,0,282,281,1,0,0,0,
	282,283,1,0,0,0,283,284,1,0,0,0,284,285,5,6,0,0,285,286,5,175,0,0,286,287,
	5,163,0,0,287,288,5,2,0,0,288,290,1,0,0,0,289,263,1,0,0,0,289,266,1,0,0,
	0,289,271,1,0,0,0,290,3,1,0,0,0,291,294,5,175,0,0,292,293,5,3,0,0,293,295,
	5,175,0,0,294,292,1,0,0,0,294,295,1,0,0,0,295,5,1,0,0,0,296,297,5,7,0,0,
	297,298,3,14,7,0,298,302,3,102,51,0,299,301,3,92,46,0,300,299,1,0,0,0,301,
	304,1,0,0,0,302,300,1,0,0,0,302,303,1,0,0,0,303,306,1,0,0,0,304,302,1,0,
	0,0,305,307,3,98,49,0,306,305,1,0,0,0,306,307,1,0,0,0,307,308,1,0,0,0,308,
	312,5,4,0,0,309,311,3,108,54,0,310,309,1,0,0,0,311,314,1,0,0,0,312,310,
	1,0,0,0,312,313,1,0,0,0,313,315,1,0,0,0,314,312,1,0,0,0,315,316,5,6,0,0,
	316,7,1,0,0,0,317,318,5,8,0,0,318,319,5,175,0,0,319,322,5,9,0,0,320,323,
	3,230,115,0,321,323,5,10,0,0,322,320,1,0,0,0,322,321,1,0,0,0,323,325,1,
	0,0,0,324,326,5,11,0,0,325,324,1,0,0,0,325,326,1,0,0,0,326,327,1,0,0,0,
	327,353,5,2,0,0,328,329,5,8,0,0,329,330,5,4,0,0,330,335,3,10,5,0,331,332,
	5,5,0,0,332,334,3,10,5,0,333,331,1,0,0,0,334,337,1,0,0,0,335,333,1,0,0,
	0,335,336,1,0,0,0,336,339,1,0,0,0,337,335,1,0,0,0,338,340,5,5,0,0,339,338,
	1,0,0,0,339,340,1,0,0,0,340,341,1,0,0,0,341,342,5,6,0,0,342,345,5,9,0,0,
	343,346,3,230,115,0,344,346,5,10,0,0,345,343,1,0,0,0,345,344,1,0,0,0,346,
	348,1,0,0,0,347,349,5,11,0,0,348,347,1,0,0,0,348,349,1,0,0,0,349,350,1,
	0,0,0,350,351,5,2,0,0,351,353,1,0,0,0,352,317,1,0,0,0,352,328,1,0,0,0,353,
	9,1,0,0,0,354,357,5,175,0,0,355,356,5,12,0,0,356,358,5,175,0,0,357,355,
	1,0,0,0,357,358,1,0,0,0,358,361,1,0,0,0,359,360,5,3,0,0,360,362,3,12,6,
	0,361,359,1,0,0,0,361,362,1,0,0,0,362,11,1,0,0,0,363,364,7,0,0,0,364,13,
	1,0,0,0,365,366,7,1,0,0,366,15,1,0,0,0,367,368,5,37,0,0,368,369,3,18,9,
	0,369,370,3,20,10,0,370,371,5,2,0,0,371,17,1,0,0,0,372,373,7,2,0,0,373,
	19,1,0,0,0,374,376,3,22,11,0,375,377,3,22,11,0,376,375,1,0,0,0,376,377,
	1,0,0,0,377,21,1,0,0,0,378,380,3,24,12,0,379,378,1,0,0,0,379,380,1,0,0,
	0,380,381,1,0,0,0,381,382,5,152,0,0,382,23,1,0,0,0,383,384,7,3,0,0,384,
	25,1,0,0,0,385,386,5,41,0,0,386,396,5,175,0,0,387,388,5,42,0,0,388,393,
	5,175,0,0,389,390,5,5,0,0,390,392,5,175,0,0,391,389,1,0,0,0,392,395,1,0,
	0,0,393,391,1,0,0,0,393,394,1,0,0,0,394,397,1,0,0,0,395,393,1,0,0,0,396,
	387,1,0,0,0,396,397,1,0,0,0,397,398,1,0,0,0,398,409,5,4,0,0,399,408,3,54,
	27,0,400,408,3,50,25,0,401,408,3,58,29,0,402,408,3,42,21,0,403,408,3,46,
	23,0,404,408,3,30,15,0,405,408,3,28,14,0,406,408,3,34,17,0,407,399,1,0,
	0,0,407,400,1,0,0,0,407,401,1,0,0,0,407,402,1,0,0,0,407,403,1,0,0,0,407,
	404,1,0,0,0,407,405,1,0,0,0,407,406,1,0,0,0,408,411,1,0,0,0,409,407,1,0,
	0,0,409,410,1,0,0,0,410,412,1,0,0,0,411,409,1,0,0,0,412,413,5,6,0,0,413,
	27,1,0,0,0,414,415,3,32,16,0,415,416,3,78,39,0,416,417,5,175,0,0,417,418,
	5,2,0,0,418,425,1,0,0,0,419,420,3,32,16,0,420,421,3,80,40,0,421,422,5,175,
	0,0,422,423,5,2,0,0,423,425,1,0,0,0,424,414,1,0,0,0,424,419,1,0,0,0,425,
	29,1,0,0,0,426,427,3,32,16,0,427,428,3,230,115,0,428,429,5,175,0,0,429,
	430,5,2,0,0,430,31,1,0,0,0,431,432,7,4,0,0,432,33,1,0,0,0,433,434,5,7,0,
	0,434,435,5,175,0,0,435,439,3,102,51,0,436,438,3,92,46,0,437,436,1,0,0,
	0,438,441,1,0,0,0,439,437,1,0,0,0,439,440,1,0,0,0,440,443,1,0,0,0,441,439,
	1,0,0,0,442,444,3,98,49,0,443,442,1,0,0,0,443,444,1,0,0,0,444,445,1,0,0,
	0,445,446,5,2,0,0,446,35,1,0,0,0,447,448,5,45,0,0,448,449,5,175,0,0,449,
	453,5,4,0,0,450,452,3,54,27,0,451,450,1,0,0,0,452,455,1,0,0,0,453,451,1,
	0,0,0,453,454,1,0,0,0,454,459,1,0,0,0,455,453,1,0,0,0,456,458,3,50,25,0,
	457,456,1,0,0,0,458,461,1,0,0,0,459,457,1,0,0,0,459,460,1,0,0,0,460,465,
	1,0,0,0,461,459,1,0,0,0,462,464,3,58,29,0,463,462,1,0,0,0,464,467,1,0,0,
	0,465,463,1,0,0,0,465,466,1,0,0,0,466,471,1,0,0,0,467,465,1,0,0,0,468,470,
	3,42,21,0,469,468,1,0,0,0,470,473,1,0,0,0,471,469,1,0,0,0,471,472,1,0,0,
	0,472,477,1,0,0,0,473,471,1,0,0,0,474,476,3,46,23,0,475,474,1,0,0,0,476,
	479,1,0,0,0,477,475,1,0,0,0,477,478,1,0,0,0,478,483,1,0,0,0,479,477,1,0,
	0,0,480,482,3,60,30,0,481,480,1,0,0,0,482,485,1,0,0,0,483,481,1,0,0,0,483,
	484,1,0,0,0,484,489,1,0,0,0,485,483,1,0,0,0,486,488,3,8,4,0,487,486,1,0,
	0,0,488,491,1,0,0,0,489,487,1,0,0,0,489,490,1,0,0,0,490,495,1,0,0,0,491,
	489,1,0,0,0,492,494,3,6,3,0,493,492,1,0,0,0,494,497,1,0,0,0,495,493,1,0,
	0,0,495,496,1,0,0,0,496,498,1,0,0,0,497,495,1,0,0,0,498,499,5,6,0,0,499,
	37,1,0,0,0,500,502,5,46,0,0,501,500,1,0,0,0,501,502,1,0,0,0,502,503,1,0,
	0,0,503,504,5,47,0,0,504,506,5,175,0,0,505,507,3,102,51,0,506,505,1,0,0,
	0,506,507,1,0,0,0,507,517,1,0,0,0,508,509,5,42,0,0,509,514,5,175,0,0,510,
	511,5,5,0,0,511,513,5,175,0,0,512,510,1,0,0,0,513,516,1,0,0,0,514,512,1,
	0,0,0,514,515,1,0,0,0,515,518,1,0,0,0,516,514,1,0,0,0,517,508,1,0,0,0,517,
	518,1,0,0,0,518,519,1,0,0,0,519,536,5,4,0,0,520,535,3,54,27,0,521,535,3,
	50,25,0,522,535,3,58,29,0,523,535,3,42,21,0,524,535,3,46,23,0,525,535,3,
	60,30,0,526,535,3,8,4,0,527,535,3,72,36,0,528,535,3,82,41,0,529,535,3,62,
	31,0,530,535,3,88,44,0,531,535,3,40,20,0,532,535,3,64,32,0,533,535,3,68,
	34,0,534,520,1,0,0,0,534,521,1,0,0,0,534,522,1,0,0,0,534,523,1,0,0,0,534,
	524,1,0,0,0,534,525,1,0,0,0,534,526,1,0,0,0,534,527,1,0,0,0,534,528,1,0,
	0,0,534,529,1,0,0,0,534,530,1,0,0,0,534,531,1,0,0,0,534,532,1,0,0,0,534,
	533,1,0,0,0,535,538,1,0,0,0,536,534,1,0,0,0,536,537,1,0,0,0,537,539,1,0,
	0,0,538,536,1,0,0,0,539,540,5,6,0,0,540,39,1,0,0,0,541,542,5,7,0,0,542,
	543,3,14,7,0,543,547,3,102,51,0,544,546,3,92,46,0,545,544,1,0,0,0,546,549,
	1,0,0,0,547,545,1,0,0,0,547,548,1,0,0,0,548,553,1,0,0,0,549,547,1,0,0,0,
	550,552,3,90,45,0,551,550,1,0,0,0,552,555,1,0,0,0,553,551,1,0,0,0,553,554,
	1,0,0,0,554,557,1,0,0,0,555,553,1,0,0,0,556,558,3,98,49,0,557,556,1,0,0,
	0,557,558,1,0,0,0,558,559,1,0,0,0,559,560,5,2,0,0,560,41,1,0,0,0,561,562,
	5,48,0,0,562,563,5,175,0,0,563,575,5,49,0,0,564,569,3,44,22,0,565,566,5,
	5,0,0,566,568,3,44,22,0,567,565,1,0,0,0,568,571,1,0,0,0,569,567,1,0,0,0,
	569,570,1,0,0,0,570,573,1,0,0,0,571,569,1,0,0,0,572,574,5,5,0,0,573,572,
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
	619,1,0,0,0,619,620,5,6,0,0,620,51,1,0,0,0,621,622,3,230,115,0,622,623,
	3,14,7,0,623,624,5,2,0,0,624,53,1,0,0,0,625,626,5,54,0,0,626,627,5,175,
	0,0,627,628,5,4,0,0,628,633,3,56,28,0,629,630,5,5,0,0,630,632,3,56,28,0,
	631,629,1,0,0,0,632,635,1,0,0,0,633,631,1,0,0,0,633,634,1,0,0,0,634,637,
	1,0,0,0,635,633,1,0,0,0,636,638,5,5,0,0,637,636,1,0,0,0,637,638,1,0,0,0,
	638,639,1,0,0,0,639,640,5,6,0,0,640,55,1,0,0,0,641,644,5,175,0,0,642,643,
	5,40,0,0,643,645,5,157,0,0,644,642,1,0,0,0,644,645,1,0,0,0,645,57,1,0,0,
	0,646,647,5,55,0,0,647,648,5,175,0,0,648,649,5,42,0,0,649,650,3,230,115,
	0,650,651,5,2,0,0,651,59,1,0,0,0,652,653,3,230,115,0,653,654,5,56,0,0,654,
	655,5,175,0,0,655,656,5,40,0,0,656,657,3,218,109,0,657,658,5,2,0,0,658,
	61,1,0,0,0,659,660,5,57,0,0,660,664,3,102,51,0,661,663,7,5,0,0,662,661,
	1,0,0,0,663,666,1,0,0,0,664,662,1,0,0,0,664,665,1,0,0,0,665,670,1,0,0,0,
	666,664,1,0,0,0,667,669,3,70,35,0,668,667,1,0,0,0,669,672,1,0,0,0,670,668,
	1,0,0,0,670,671,1,0,0,0,671,673,1,0,0,0,672,670,1,0,0,0,673,677,5,4,0,0,
	674,676,3,108,54,0,675,674,1,0,0,0,676,679,1,0,0,0,677,675,1,0,0,0,677,
	678,1,0,0,0,678,680,1,0,0,0,679,677,1,0,0,0,680,681,5,6,0,0,681,63,1,0,
	0,0,682,683,5,60,0,0,683,684,3,102,51,0,684,688,5,44,0,0,685,687,3,66,33,
	0,686,685,1,0,0,0,687,690,1,0,0,0,688,686,1,0,0,0,688,689,1,0,0,0,689,694,
	1,0,0,0,690,688,1,0,0,0,691,693,3,90,45,0,692,691,1,0,0,0,693,696,1,0,0,
	0,694,692,1,0,0,0,694,695,1,0,0,0,695,697,1,0,0,0,696,694,1,0,0,0,697,701,
	5,4,0,0,698,700,3,108,54,0,699,698,1,0,0,0,700,703,1,0,0,0,701,699,1,0,
	0,0,701,702,1,0,0,0,702,704,1,0,0,0,703,701,1,0,0,0,704,705,5,6,0,0,705,
	65,1,0,0,0,706,710,5,59,0,0,707,710,5,61,0,0,708,710,3,94,47,0,709,706,
	1,0,0,0,709,707,1,0,0,0,709,708,1,0,0,0,710,67,1,0,0,0,711,712,5,62,0,0,
	712,713,5,49,0,0,713,714,5,50,0,0,714,715,5,44,0,0,715,716,5,59,0,0,716,
	720,5,4,0,0,717,719,3,108,54,0,718,717,1,0,0,0,719,722,1,0,0,0,720,718,
	1,0,0,0,720,721,1,0,0,0,721,723,1,0,0,0,722,720,1,0,0,0,723,724,5,6,0,0,
	724,69,1,0,0,0,725,726,5,175,0,0,726,727,3,210,105,0,727,71,1,0,0,0,728,
	730,3,76,38,0,729,728,1,0,0,0,729,730,1,0,0,0,730,731,1,0,0,0,731,735,3,
	230,115,0,732,734,3,222,111,0,733,732,1,0,0,0,734,737,1,0,0,0,735,733,1,
	0,0,0,735,736,1,0,0,0,736,738,1,0,0,0,737,735,1,0,0,0,738,741,5,175,0,0,
	739,740,5,40,0,0,740,742,3,218,109,0,741,739,1,0,0,0,741,742,1,0,0,0,742,
	743,1,0,0,0,743,744,5,2,0,0,744,791,1,0,0,0,745,746,3,230,115,0,746,750,
	3,76,38,0,747,749,3,222,111,0,748,747,1,0,0,0,749,752,1,0,0,0,750,748,1,
	0,0,0,750,751,1,0,0,0,751,753,1,0,0,0,752,750,1,0,0,0,753,756,5,175,0,0,
	754,755,5,40,0,0,755,757,3,218,109,0,756,754,1,0,0,0,756,757,1,0,0,0,757,
	758,1,0,0,0,758,759,5,2,0,0,759,791,1,0,0,0,760,762,3,76,38,0,761,760,1,
	0,0,0,761,762,1,0,0,0,762,763,1,0,0,0,763,767,3,78,39,0,764,766,3,74,37,
	0,765,764,1,0,0,0,766,769,1,0,0,0,767,765,1,0,0,0,767,768,1,0,0,0,768,770,
	1,0,0,0,769,767,1,0,0,0,770,771,5,175,0,0,771,772,5,2,0,0,772,791,1,0,0,
	0,773,775,3,76,38,0,774,773,1,0,0,0,774,775,1,0,0,0,775,776,1,0,0,0,776,
	780,3,80,40,0,777,779,3,74,37,0,778,777,1,0,0,0,779,782,1,0,0,0,780,778,
	1,0,0,0,780,781,1,0,0,0,781,783,1,0,0,0,782,780,1,0,0,0,783,786,5,175,0,
	0,784,785,5,40,0,0,785,787,3,218,109,0,786,784,1,0,0,0,786,787,1,0,0,0,
	787,788,1,0,0,0,788,789,5,2,0,0,789,791,1,0,0,0,790,729,1,0,0,0,790,745,
	1,0,0,0,790,761,1,0,0,0,790,774,1,0,0,0,791,73,1,0,0,0,792,795,3,222,111,
	0,793,795,3,76,38,0,794,792,1,0,0,0,794,793,1,0,0,0,795,75,1,0,0,0,796,
	797,7,6,0,0,797,77,1,0,0,0,798,799,5,64,0,0,799,800,5,49,0,0,800,802,3,
	230,115,0,801,803,5,175,0,0,802,801,1,0,0,0,802,803,1,0,0,0,803,804,1,0,
	0,0,804,805,5,65,0,0,805,807,3,230,115,0,806,808,5,175,0,0,807,806,1,0,
	0,0,807,808,1,0,0,0,808,809,1,0,0,0,809,810,5,50,0,0,810,835,1,0,0,0,811,
	812,5,64,0,0,812,813,5,49,0,0,813,815,3,230,115,0,814,816,5,175,0,0,815,
	814,1,0,0,0,815,816,1,0,0,0,816,817,1,0,0,0,817,818,5,65,0,0,818,819,3,
	78,39,0,819,820,5,50,0,0,820,835,1,0,0,0,821,822,5,64,0,0,822,823,5,49,
	0,0,823,825,3,230,115,0,824,826,5,175,0,0,825,824,1,0,0,0,825,826,1,0,0,
	0,826,827,1,0,0,0,827,828,5,65,0,0,828,830,3,80,40,0,829,831,5,175,0,0,
	830,829,1,0,0,0,830,831,1,0,0,0,831,832,1,0,0,0,832,833,5,50,0,0,833,835,
	1,0,0,0,834,798,1,0,0,0,834,811,1,0,0,0,834,821,1,0,0,0,835,79,1,0,0,0,
	836,837,6,40,-1,0,837,838,3,230,115,0,838,839,5,66,0,0,839,840,5,157,0,
	0,840,841,5,67,0,0,841,847,1,0,0,0,842,843,3,230,115,0,843,844,5,66,0,0,
	844,845,5,67,0,0,845,847,1,0,0,0,846,836,1,0,0,0,846,842,1,0,0,0,847,857,
	1,0,0,0,848,849,10,2,0,0,849,850,5,66,0,0,850,851,5,157,0,0,851,856,5,67,
	0,0,852,853,10,1,0,0,853,854,5,66,0,0,854,856,5,67,0,0,855,848,1,0,0,0,
	855,852,1,0,0,0,856,859,1,0,0,0,857,855,1,0,0,0,857,858,1,0,0,0,858,81,
	1,0,0,0,859,857,1,0,0,0,860,861,5,68,0,0,861,863,5,175,0,0,862,864,3,102,
	51,0,863,862,1,0,0,0,863,864,1,0,0,0,864,865,1,0,0,0,865,869,5,4,0,0,866,
	868,3,84,42,0,867,866,1,0,0,0,868,871,1,0,0,0,869,867,1,0,0,0,869,870,1,
	0,0,0,870,872,1,0,0,0,871,869,1,0,0,0,872,873,5,6,0,0,873,83,1,0,0,0,874,
	877,3,86,43,0,875,877,3,108,54,0,876,874,1,0,0,0,876,875,1,0,0,0,877,85,
	1,0,0,0,878,879,5,69,0,0,879,880,5,2,0,0,880,87,1,0,0,0,881,882,5,7,0,0,
	882,883,3,14,7,0,883,887,3,102,51,0,884,886,3,92,46,0,885,884,1,0,0,0,886,
	889,1,0,0,0,887,885,1,0,0,0,887,888,1,0,0,0,888,893,1,0,0,0,889,887,1,0,
	0,0,890,892,3,90,45,0,891,890,1,0,0,0,892,895,1,0,0,0,893,891,1,0,0,0,893,
	894,1,0,0,0,894,897,1,0,0,0,895,893,1,0,0,0,896,898,3,98,49,0,897,896,1,
	0,0,0,897,898,1,0,0,0,898,899,1,0,0,0,899,903,5,4,0,0,900,902,3,108,54,
	0,901,900,1,0,0,0,902,905,1,0,0,0,903,901,1,0,0,0,903,904,1,0,0,0,904,906,
	1,0,0,0,905,903,1,0,0,0,906,907,5,6,0,0,907,89,1,0,0,0,908,910,5,175,0,
	0,909,911,3,210,105,0,910,909,1,0,0,0,910,911,1,0,0,0,911,91,1,0,0,0,912,
	927,5,70,0,0,913,927,5,71,0,0,914,927,5,58,0,0,915,927,5,44,0,0,916,927,
	5,43,0,0,917,927,5,63,0,0,918,927,5,59,0,0,919,927,3,94,47,0,920,927,5,
	61,0,0,921,927,3,96,48,0,922,927,5,30,0,0,923,927,5,28,0,0,924,927,5,31,
	0,0,925,927,5,29,0,0,926,912,1,0,0,0,926,913,1,0,0,0,926,914,1,0,0,0,926,
	915,1,0,0,0,926,916,1,0,0,0,926,917,1,0,0,0,926,918,1,0,0,0,926,919,1,0,
	0,0,926,920,1,0,0,0,926,921,1,0,0,0,926,922,1,0,0,0,926,923,1,0,0,0,926,
	924,1,0,0,0,926,925,1,0,0,0,927,93,1,0,0,0,928,939,5,72,0,0,929,930,5,49,
	0,0,930,935,5,175,0,0,931,932,5,5,0,0,932,934,5,175,0,0,933,931,1,0,0,0,
	934,937,1,0,0,0,935,933,1,0,0,0,935,936,1,0,0,0,936,938,1,0,0,0,937,935,
	1,0,0,0,938,940,5,50,0,0,939,929,1,0,0,0,939,940,1,0,0,0,940,95,1,0,0,0,
	941,945,5,32,0,0,942,943,5,49,0,0,943,944,5,157,0,0,944,946,5,50,0,0,945,
	942,1,0,0,0,945,946,1,0,0,0,946,97,1,0,0,0,947,948,5,73,0,0,948,949,5,49,
	0,0,949,954,3,100,50,0,950,951,5,5,0,0,951,953,3,100,50,0,952,950,1,0,0,
	0,953,956,1,0,0,0,954,952,1,0,0,0,954,955,1,0,0,0,955,958,1,0,0,0,956,954,
	1,0,0,0,957,959,5,5,0,0,958,957,1,0,0,0,958,959,1,0,0,0,959,960,1,0,0,0,
	960,961,5,50,0,0,961,99,1,0,0,0,962,966,3,230,115,0,963,965,3,222,111,0,
	964,963,1,0,0,0,965,968,1,0,0,0,966,964,1,0,0,0,966,967,1,0,0,0,967,970,
	1,0,0,0,968,966,1,0,0,0,969,971,3,14,7,0,970,969,1,0,0,0,970,971,1,0,0,
	0,971,983,1,0,0,0,972,976,3,80,40,0,973,975,3,222,111,0,974,973,1,0,0,0,
	975,978,1,0,0,0,976,974,1,0,0,0,976,977,1,0,0,0,977,980,1,0,0,0,978,976,
	1,0,0,0,979,981,3,14,7,0,980,979,1,0,0,0,980,981,1,0,0,0,981,983,1,0,0,
	0,982,962,1,0,0,0,982,972,1,0,0,0,983,101,1,0,0,0,984,996,5,49,0,0,985,
	990,3,104,52,0,986,987,5,5,0,0,987,989,3,104,52,0,988,986,1,0,0,0,989,992,
	1,0,0,0,990,988,1,0,0,0,990,991,1,0,0,0,991,994,1,0,0,0,992,990,1,0,0,0,
	993,995,5,5,0,0,994,993,1,0,0,0,994,995,1,0,0,0,995,997,1,0,0,0,996,985,
	1,0,0,0,996,997,1,0,0,0,997,998,1,0,0,0,998,999,5,50,0,0,999,103,1,0,0,
	0,1000,1004,3,230,115,0,1001,1003,3,222,111,0,1002,1001,1,0,0,0,1003,1006,
	1,0,0,0,1004,1002,1,0,0,0,1004,1005,1,0,0,0,1005,1008,1,0,0,0,1006,1004,
	1,0,0,0,1007,1009,3,14,7,0,1008,1007,1,0,0,0,1008,1009,1,0,0,0,1009,1021,
	1,0,0,0,1010,1014,3,80,40,0,1011,1013,3,222,111,0,1012,1011,1,0,0,0,1013,
	1016,1,0,0,0,1014,1012,1,0,0,0,1014,1015,1,0,0,0,1015,1018,1,0,0,0,1016,
	1014,1,0,0,0,1017,1019,3,14,7,0,1018,1017,1,0,0,0,1018,1019,1,0,0,0,1019,
	1021,1,0,0,0,1020,1000,1,0,0,0,1020,1010,1,0,0,0,1021,105,1,0,0,0,1022,
	1026,5,4,0,0,1023,1025,3,108,54,0,1024,1023,1,0,0,0,1025,1028,1,0,0,0,1026,
	1024,1,0,0,0,1026,1027,1,0,0,0,1027,1029,1,0,0,0,1028,1026,1,0,0,0,1029,
	1032,5,6,0,0,1030,1032,3,108,54,0,1031,1022,1,0,0,0,1031,1030,1,0,0,0,1032,
	107,1,0,0,0,1033,1064,3,126,63,0,1034,1064,3,128,64,0,1035,1064,3,134,67,
	0,1036,1064,3,136,68,0,1037,1064,3,138,69,0,1038,1064,3,140,70,0,1039,1064,
	3,142,71,0,1040,1064,3,132,66,0,1041,1064,3,122,61,0,1042,1064,3,124,62,
	0,1043,1064,3,146,73,0,1044,1064,3,148,74,0,1045,1064,3,150,75,0,1046,1064,
	3,152,76,0,1047,1064,3,172,86,0,1048,1064,3,120,60,0,1049,1064,3,110,55,
	0,1050,1064,3,112,56,0,1051,1064,3,114,57,0,1052,1064,3,116,58,0,1053,1064,
	3,118,59,0,1054,1064,3,174,87,0,1055,1064,3,186,93,0,1056,1064,3,198,99,
	0,1057,1064,3,200,100,0,1058,1064,3,144,72,0,1059,1064,3,178,89,0,1060,
	1064,3,180,90,0,1061,1064,3,192,96,0,1062,1064,3,194,97,0,1063,1033,1,0,
	0,0,1063,1034,1,0,0,0,1063,1035,1,0,0,0,1063,1036,1,0,0,0,1063,1037,1,0,
	0,0,1063,1038,1,0,0,0,1063,1039,1,0,0,0,1063,1040,1,0,0,0,1063,1041,1,0,
	0,0,1063,1042,1,0,0,0,1063,1043,1,0,0,0,1063,1044,1,0,0,0,1063,1045,1,0,
	0,0,1063,1046,1,0,0,0,1063,1047,1,0,0,0,1063,1048,1,0,0,0,1063,1049,1,0,
	0,0,1063,1050,1,0,0,0,1063,1051,1,0,0,0,1063,1052,1,0,0,0,1063,1053,1,0,
	0,0,1063,1054,1,0,0,0,1063,1055,1,0,0,0,1063,1056,1,0,0,0,1063,1057,1,0,
	0,0,1063,1058,1,0,0,0,1063,1059,1,0,0,0,1063,1060,1,0,0,0,1063,1061,1,0,
	0,0,1063,1062,1,0,0,0,1064,109,1,0,0,0,1065,1066,5,74,0,0,1066,1067,5,12,
	0,0,1067,1068,5,175,0,0,1068,1069,5,49,0,0,1069,1070,3,218,109,0,1070,1071,
	5,5,0,0,1071,1072,3,218,109,0,1072,1073,5,50,0,0,1073,1074,5,2,0,0,1074,
	111,1,0,0,0,1075,1076,5,74,0,0,1076,1077,5,12,0,0,1077,1078,5,175,0,0,1078,
	1079,5,66,0,0,1079,1080,3,218,109,0,1080,1081,5,67,0,0,1081,1082,5,12,0,
	0,1082,1083,5,175,0,0,1083,1084,5,49,0,0,1084,1089,3,218,109,0,1085,1086,
	5,5,0,0,1086,1088,3,218,109,0,1087,1085,1,0,0,0,1088,1091,1,0,0,0,1089,
	1087,1,0,0,0,1089,1090,1,0,0,0,1090,1092,1,0,0,0,1091,1089,1,0,0,0,1092,
	1093,5,50,0,0,1093,1094,5,2,0,0,1094,113,1,0,0,0,1095,1096,5,75,0,0,1096,
	1125,5,2,0,0,1097,1098,5,75,0,0,1098,1103,3,218,109,0,1099,1100,5,5,0,0,
	1100,1102,3,218,109,0,1101,1099,1,0,0,0,1102,1105,1,0,0,0,1103,1101,1,0,
	0,0,1103,1104,1,0,0,0,1104,1106,1,0,0,0,1105,1103,1,0,0,0,1106,1107,5,2,
	0,0,1107,1125,1,0,0,0,1108,1109,5,75,0,0,1109,1110,5,49,0,0,1110,1115,3,
	218,109,0,1111,1112,5,5,0,0,1112,1114,3,218,109,0,1113,1111,1,0,0,0,1114,
	1117,1,0,0,0,1115,1113,1,0,0,0,1115,1116,1,0,0,0,1116,1119,1,0,0,0,1117,
	1115,1,0,0,0,1118,1120,5,5,0,0,1119,1118,1,0,0,0,1119,1120,1,0,0,0,1120,
	1121,1,0,0,0,1121,1122,5,50,0,0,1122,1123,5,2,0,0,1123,1125,1,0,0,0,1124,
	1095,1,0,0,0,1124,1097,1,0,0,0,1124,1108,1,0,0,0,1125,115,1,0,0,0,1126,
	1129,5,175,0,0,1127,1128,5,12,0,0,1128,1130,5,175,0,0,1129,1127,1,0,0,0,
	1129,1130,1,0,0,0,1130,1131,1,0,0,0,1131,1132,5,49,0,0,1132,1144,5,4,0,
	0,1133,1138,3,208,104,0,1134,1135,5,5,0,0,1135,1137,3,208,104,0,1136,1134,
	1,0,0,0,1137,1140,1,0,0,0,1138,1136,1,0,0,0,1138,1139,1,0,0,0,1139,1142,
	1,0,0,0,1140,1138,1,0,0,0,1141,1143,5,5,0,0,1142,1141,1,0,0,0,1142,1143,
	1,0,0,0,1143,1145,1,0,0,0,1144,1133,1,0,0,0,1144,1145,1,0,0,0,1145,1146,
	1,0,0,0,1146,1147,5,6,0,0,1147,1148,5,50,0,0,1148,1172,5,2,0,0,1149,1150,
	5,175,0,0,1150,1151,3,210,105,0,1151,1152,5,2,0,0,1152,1172,1,0,0,0,1153,
	1154,5,175,0,0,1154,1155,5,12,0,0,1155,1156,5,175,0,0,1156,1157,3,210,105,
	0,1157,1158,5,2,0,0,1158,1172,1,0,0,0,1159,1160,5,175,0,0,1160,1161,3,210,
	105,0,1161,1162,5,12,0,0,1162,1163,5,175,0,0,1163,1164,5,12,0,0,1164,1166,
	5,175,0,0,1165,1167,3,212,106,0,1166,1165,1,0,0,0,1166,1167,1,0,0,0,1167,
	1168,1,0,0,0,1168,1169,3,210,105,0,1169,1170,5,2,0,0,1170,1172,1,0,0,0,
	1171,1126,1,0,0,0,1171,1149,1,0,0,0,1171,1153,1,0,0,0,1171,1159,1,0,0,0,
	1172,117,1,0,0,0,1173,1174,3,218,109,0,1174,1175,5,12,0,0,1175,1177,5,175,
	0,0,1176,1178,3,212,106,0,1177,1176,1,0,0,0,1177,1178,1,0,0,0,1178,1179,
	1,0,0,0,1179,1180,3,210,105,0,1180,1181,5,2,0,0,1181,119,1,0,0,0,1182,1183,
	5,76,0,0,1183,1186,5,175,0,0,1184,1185,5,12,0,0,1185,1187,5,175,0,0,1186,
	1184,1,0,0,0,1186,1187,1,0,0,0,1187,1188,1,0,0,0,1188,1189,5,49,0,0,1189,
	1201,5,4,0,0,1190,1195,3,208,104,0,1191,1192,5,5,0,0,1192,1194,3,208,104,
	0,1193,1191,1,0,0,0,1194,1197,1,0,0,0,1195,1193,1,0,0,0,1195,1196,1,0,0,
	0,1196,1199,1,0,0,0,1197,1195,1,0,0,0,1198,1200,5,5,0,0,1199,1198,1,0,0,
	0,1199,1200,1,0,0,0,1200,1202,1,0,0,0,1201,1190,1,0,0,0,1201,1202,1,0,0,
	0,1202,1203,1,0,0,0,1203,1204,5,6,0,0,1204,1205,5,50,0,0,1205,1216,5,2,
	0,0,1206,1207,5,76,0,0,1207,1210,5,175,0,0,1208,1209,5,12,0,0,1209,1211,
	5,175,0,0,1210,1208,1,0,0,0,1210,1211,1,0,0,0,1211,1212,1,0,0,0,1212,1213,
	3,210,105,0,1213,1214,5,2,0,0,1214,1216,1,0,0,0,1215,1182,1,0,0,0,1215,
	1206,1,0,0,0,1216,121,1,0,0,0,1217,1218,5,74,0,0,1218,1219,5,12,0,0,1219,
	1232,5,175,0,0,1220,1221,5,66,0,0,1221,1222,3,218,109,0,1222,1223,5,67,
	0,0,1223,1225,1,0,0,0,1224,1220,1,0,0,0,1225,1226,1,0,0,0,1226,1224,1,0,
	0,0,1226,1227,1,0,0,0,1227,1230,1,0,0,0,1228,1229,5,12,0,0,1229,1231,5,
	175,0,0,1230,1228,1,0,0,0,1230,1231,1,0,0,0,1231,1233,1,0,0,0,1232,1224,
	1,0,0,0,1232,1233,1,0,0,0,1233,1234,1,0,0,0,1234,1235,7,7,0,0,1235,1236,
	3,218,109,0,1236,1237,5,2,0,0,1237,1263,1,0,0,0,1238,1243,5,175,0,0,1239,
	1240,5,66,0,0,1240,1241,3,218,109,0,1241,1242,5,67,0,0,1242,1244,1,0,0,
	0,1243,1239,1,0,0,0,1244,1245,1,0,0,0,1245,1243,1,0,0,0,1245,1246,1,0,0,
	0,1246,1249,1,0,0,0,1247,1248,5,12,0,0,1248,1250,5,175,0,0,1249,1247,1,
	0,0,0,1249,1250,1,0,0,0,1250,1251,1,0,0,0,1251,1252,7,7,0,0,1252,1253,3,
	218,109,0,1253,1254,5,2,0,0,1254,1263,1,0,0,0,1255,1256,5,175,0,0,1256,
	1257,5,12,0,0,1257,1258,5,175,0,0,1258,1259,7,7,0,0,1259,1260,3,218,109,
	0,1260,1261,5,2,0,0,1261,1263,1,0,0,0,1262,1217,1,0,0,0,1262,1238,1,0,0,
	0,1262,1255,1,0,0,0,1263,123,1,0,0,0,1264,1265,5,74,0,0,1265,1266,5,12,
	0,0,1266,1273,5,175,0,0,1267,1268,5,66,0,0,1268,1269,3,218,109,0,1269,1270,
	5,67,0,0,1270,1272,1,0,0,0,1271,1267,1,0,0,0,1272,1275,1,0,0,0,1273,1271,
	1,0,0,0,1273,1274,1,0,0,0,1274,1276,1,0,0,0,1275,1273,1,0,0,0,1276,1277,
	5,87,0,0,1277,1278,5,49,0,0,1278,1279,3,218,109,0,1279,1280,5,50,0,0,1280,
	1281,5,2,0,0,1281,125,1,0,0,0,1282,1286,3,230,115,0,1283,1285,3,222,111,
	0,1284,1283,1,0,0,0,1285,1288,1,0,0,0,1286,1284,1,0,0,0,1286,1287,1,0,0,
	0,1287,1289,1,0,0,0,1288,1286,1,0,0,0,1289,1292,3,14,7,0,1290,1291,5,40,
	0,0,1291,1293,3,218,109,0,1292,1290,1,0,0,0,1292,1293,1,0,0,0,1293,1294,
	1,0,0,0,1294,1295,5,2,0,0,1295,1311,1,0,0,0,1296,1300,3,80,40,0,1297,1299,
	3,222,111,0,1298,1297,1,0,0,0,1299,1302,1,0,0,0,1300,1298,1,0,0,0,1300,
	1301,1,0,0,0,1301,1303,1,0,0,0,1302,1300,1,0,0,0,1303,1306,3,14,7,0,1304,
	1305,5,40,0,0,1305,1307,3,218,109,0,1306,1304,1,0,0,0,1306,1307,1,0,0,0,
	1307,1308,1,0,0,0,1308,1309,5,2,0,0,1309,1311,1,0,0,0,1310,1282,1,0,0,0,
	1310,1296,1,0,0,0,1311,127,1,0,0,0,1312,1313,3,230,115,0,1313,1318,5,175,
	0,0,1314,1315,5,5,0,0,1315,1316,3,230,115,0,1316,1317,5,175,0,0,1317,1319,
	1,0,0,0,1318,1314,1,0,0,0,1319,1320,1,0,0,0,1320,1318,1,0,0,0,1320,1321,
	1,0,0,0,1321,1322,1,0,0,0,1322,1323,5,40,0,0,1323,1324,3,218,109,0,1324,
	1325,5,2,0,0,1325,1361,1,0,0,0,1326,1327,5,49,0,0,1327,1330,3,130,65,0,
	1328,1329,5,5,0,0,1329,1331,3,130,65,0,1330,1328,1,0,0,0,1331,1332,1,0,
	0,0,1332,1330,1,0,0,0,1332,1333,1,0,0,0,1333,1334,1,0,0,0,1334,1335,5,50,
	0,0,1335,1336,5,40,0,0,1336,1337,5,49,0,0,1337,1340,3,218,109,0,1338,1339,
	5,5,0,0,1339,1341,3,218,109,0,1340,1338,1,0,0,0,1341,1342,1,0,0,0,1342,
	1340,1,0,0,0,1342,1343,1,0,0,0,1343,1344,1,0,0,0,1344,1345,5,50,0,0,1345,
	1346,5,2,0,0,1346,1361,1,0,0,0,1347,1348,5,49,0,0,1348,1351,3,130,65,0,
	1349,1350,5,5,0,0,1350,1352,3,130,65,0,1351,1349,1,0,0,0,1352,1353,1,0,
	0,0,1353,1351,1,0,0,0,1353,1354,1,0,0,0,1354,1355,1,0,0,0,1355,1356,5,50,
	0,0,1356,1357,5,40,0,0,1357,1358,3,218,109,0,1358,1359,5,2,0,0,1359,1361,
	1,0,0,0,1360,1312,1,0,0,0,1360,1326,1,0,0,0,1360,1347,1,0,0,0,1361,129,
	1,0,0,0,1362,1366,3,230,115,0,1363,1365,3,222,111,0,1364,1363,1,0,0,0,1365,
	1368,1,0,0,0,1366,1364,1,0,0,0,1366,1367,1,0,0,0,1367,1369,1,0,0,0,1368,
	1366,1,0,0,0,1369,1370,5,175,0,0,1370,1374,1,0,0,0,1371,1374,5,175,0,0,
	1372,1374,1,0,0,0,1373,1362,1,0,0,0,1373,1371,1,0,0,0,1373,1372,1,0,0,0,
	1374,131,1,0,0,0,1375,1376,5,175,0,0,1376,1377,7,7,0,0,1377,1378,3,218,
	109,0,1378,1379,5,2,0,0,1379,1387,1,0,0,0,1380,1381,5,175,0,0,1381,1382,
	7,8,0,0,1382,1387,5,2,0,0,1383,1384,7,8,0,0,1384,1385,5,175,0,0,1385,1387,
	5,2,0,0,1386,1375,1,0,0,0,1386,1380,1,0,0,0,1386,1383,1,0,0,0,1387,133,
	1,0,0,0,1388,1389,5,175,0,0,1389,1390,5,90,0,0,1390,1391,5,49,0,0,1391,
	1392,3,218,109,0,1392,1393,5,50,0,0,1393,1394,5,2,0,0,1394,135,1,0,0,0,
	1395,1396,5,175,0,0,1396,1397,5,91,0,0,1397,1398,5,49,0,0,1398,1399,5,50,
	0,0,1399,1400,5,2,0,0,1400,137,1,0,0,0,1401,1402,5,175,0,0,1402,1403,5,
	87,0,0,1403,1404,5,49,0,0,1404,1405,3,218,109,0,1405,1406,5,50,0,0,1406,
	1407,5,2,0,0,1407,139,1,0,0,0,1408,1409,5,74,0,0,1409,1410,5,12,0,0,1410,
	1411,5,175,0,0,1411,1412,5,90,0,0,1412,1413,5,49,0,0,1413,1414,3,218,109,
	0,1414,1415,5,50,0,0,1415,1416,5,2,0,0,1416,141,1,0,0,0,1417,1418,5,74,
	0,0,1418,1419,5,12,0,0,1419,1420,5,175,0,0,1420,1421,5,91,0,0,1421,1422,
	5,49,0,0,1422,1423,5,50,0,0,1423,1424,5,2,0,0,1424,143,1,0,0,0,1425,1426,
	5,92,0,0,1426,1427,5,175,0,0,1427,1460,5,2,0,0,1428,1429,5,92,0,0,1429,
	1430,5,74,0,0,1430,1431,5,12,0,0,1431,1432,5,175,0,0,1432,1460,5,2,0,0,
	1433,1434,5,92,0,0,1434,1435,5,74,0,0,1435,1436,5,12,0,0,1436,1441,5,175,
	0,0,1437,1438,5,66,0,0,1438,1439,3,218,109,0,1439,1440,5,67,0,0,1440,1442,
	1,0,0,0,1441,1437,1,0,0,0,1442,1443,1,0,0,0,1443,1441,1,0,0,0,1443,1444,
	1,0,0,0,1444,1445,1,0,0,0,1445,1446,5,2,0,0,1446,1460,1,0,0,0,1447,1448,
	5,92,0,0,1448,1453,5,175,0,0,1449,1450,5,66,0,0,1450,1451,3,218,109,0,1451,
	1452,5,67,0,0,1452,1454,1,0,0,0,1453,1449,1,0,0,0,1454,1455,1,0,0,0,1455,
	1453,1,0,0,0,1455,1456,1,0,0,0,1456,1457,1,0,0,0,1457,1458,5,2,0,0,1458,
	1460,1,0,0,0,1459,1425,1,0,0,0,1459,1428,1,0,0,0,1459,1433,1,0,0,0,1459,
	1447,1,0,0,0,1460,145,1,0,0,0,1461,1462,5,93,0,0,1462,1463,5,49,0,0,1463,
	1464,5,166,0,0,1464,1465,5,23,0,0,1465,1468,3,218,109,0,1466,1467,5,5,0,
	0,1467,1469,3,196,98,0,1468,1466,1,0,0,0,1468,1469,1,0,0,0,1469,1470,1,
	0,0,0,1470,1471,5,50,0,0,1471,1472,5,2,0,0,1472,147,1,0,0,0,1473,1474,5,
	93,0,0,1474,1475,5,49,0,0,1475,1478,3,218,109,0,1476,1477,5,5,0,0,1477,
	1479,3,196,98,0,1478,1476,1,0,0,0,1478,1479,1,0,0,0,1479,1480,1,0,0,0,1480,
	1481,5,50,0,0,1481,1482,5,2,0,0,1482,149,1,0,0,0,1483,1484,5,94,0,0,1484,
	1485,5,49,0,0,1485,1486,3,218,109,0,1486,1487,5,50,0,0,1487,1490,3,106,
	53,0,1488,1489,5,95,0,0,1489,1491,3,106,53,0,1490,1488,1,0,0,0,1490,1491,
	1,0,0,0,1491,151,1,0,0,0,1492,1499,3,168,84,0,1493,1499,3,170,85,0,1494,
	1499,3,160,80,0,1495,1499,3,154,77,0,1496,1499,3,156,78,0,1497,1499,3,158,
	79,0,1498,1492,1,0,0,0,1498,1493,1,0,0,0,1498,1494,1,0,0,0,1498,1495,1,
	0,0,0,1498,1496,1,0,0,0,1498,1497,1,0,0,0,1499,153,1,0,0,0,1500,1501,5,
	9,0,0,1501,1502,5,49,0,0,1502,1503,3,230,115,0,1503,1504,5,175,0,0,1504,
	1505,5,5,0,0,1505,1506,3,230,115,0,1506,1507,5,175,0,0,1507,1508,5,96,0,
	0,1508,1509,5,74,0,0,1509,1510,5,12,0,0,1510,1511,5,175,0,0,1511,1512,5,
	12,0,0,1512,1513,5,34,0,0,1513,1514,5,50,0,0,1514,1515,3,106,53,0,1515,
	155,1,0,0,0,1516,1517,5,9,0,0,1517,1518,5,49,0,0,1518,1519,3,230,115,0,
	1519,1520,5,175,0,0,1520,1521,5,97,0,0,1521,1522,5,74,0,0,1522,1523,5,12,
	0,0,1523,1524,5,175,0,0,1524,1525,5,50,0,0,1525,1526,3,106,53,0,1526,157,
	1,0,0,0,1527,1528,5,9,0,0,1528,1529,5,49,0,0,1529,1530,3,230,115,0,1530,
	1531,5,175,0,0,1531,1532,5,96,0,0,1532,1533,5,74,0,0,1533,1534,5,12,0,0,
	1534,1535,5,175,0,0,1535,1536,5,50,0,0,1536,1537,3,106,53,0,1537,159,1,
	0,0,0,1538,1539,5,9,0,0,1539,1540,5,49,0,0,1540,1541,3,162,81,0,1541,1543,
	3,164,82,0,1542,1544,3,166,83,0,1543,1542,1,0,0,0,1543,1544,1,0,0,0,1544,
	1545,1,0,0,0,1545,1546,5,50,0,0,1546,1547,3,106,53,0,1547,161,1,0,0,0,1548,
	1552,3,230,115,0,1549,1551,3,222,111,0,1550,1549,1,0,0,0,1551,1554,1,0,
	0,0,1552,1550,1,0,0,0,1552,1553,1,0,0,0,1553,1555,1,0,0,0,1554,1552,1,0,
	0,0,1555,1558,5,175,0,0,1556,1557,5,40,0,0,1557,1559,3,218,109,0,1558,1556,
	1,0,0,0,1558,1559,1,0,0,0,1559,1560,1,0,0,0,1560,1561,5,2,0,0,1561,163,
	1,0,0,0,1562,1563,3,218,109,0,1563,1564,5,2,0,0,1564,165,1,0,0,0,1565,1566,
	5,175,0,0,1566,1567,7,7,0,0,1567,1571,3,218,109,0,1568,1569,5,175,0,0,1569,
	1571,7,8,0,0,1570,1565,1,0,0,0,1570,1568,1,0,0,0,1571,167,1,0,0,0,1572,
	1573,5,98,0,0,1573,1574,3,106,53,0,1574,1575,5,99,0,0,1575,1576,5,49,0,
	0,1576,1577,3,218,109,0,1577,1578,5,50,0,0,1578,1579,5,2,0,0,1579,169,1,
	0,0,0,1580,1581,5,99,0,0,1581,1582,5,49,0,0,1582,1583,3,218,109,0,1583,
	1584,5,50,0,0,1584,1585,3,106,53,0,1585,171,1,0,0,0,1586,1587,5,100,0,0,
	1587,1588,3,204,102,0,1588,1589,5,2,0,0,1589,173,1,0,0,0,1590,1591,5,101,
	0,0,1591,1595,5,4,0,0,1592,1594,3,176,88,0,1593,1592,1,0,0,0,1594,1597,
	1,0,0,0,1595,1593,1,0,0,0,1595,1596,1,0,0,0,1596,1598,1,0,0,0,1597,1595,
	1,0,0,0,1598,1599,5,6,0,0,1599,175,1,0,0,0,1600,1601,7,9,0,0,1601,177,1,
	0,0,0,1602,1603,5,102,0,0,1603,1607,5,4,0,0,1604,1606,3,108,54,0,1605,1604,
	1,0,0,0,1606,1609,1,0,0,0,1607,1605,1,0,0,0,1607,1608,1,0,0,0,1608,1610,
	1,0,0,0,1609,1607,1,0,0,0,1610,1611,5,6,0,0,1611,179,1,0,0,0,1612,1613,
	5,103,0,0,1613,1614,5,49,0,0,1614,1615,3,218,109,0,1615,1616,5,50,0,0,1616,
	1620,5,4,0,0,1617,1619,3,182,91,0,1618,1617,1,0,0,0,1619,1622,1,0,0,0,1620,
	1618,1,0,0,0,1620,1621,1,0,0,0,1621,1624,1,0,0,0,1622,1620,1,0,0,0,1623,
	1625,3,184,92,0,1624,1623,1,0,0,0,1624,1625,1,0,0,0,1625,1626,1,0,0,0,1626,
	1627,5,6,0,0,1627,181,1,0,0,0,1628,1629,5,104,0,0,1629,1630,3,218,109,0,
	1630,1634,5,105,0,0,1631,1633,3,108,54,0,1632,1631,1,0,0,0,1633,1636,1,
	0,0,0,1634,1632,1,0,0,0,1634,1635,1,0,0,0,1635,183,1,0,0,0,1636,1634,1,
	0,0,0,1637,1638,5,106,0,0,1638,1642,5,105,0,0,1639,1641,3,108,54,0,1640,
	1639,1,0,0,0,1641,1644,1,0,0,0,1642,1640,1,0,0,0,1642,1643,1,0,0,0,1643,
	185,1,0,0,0,1644,1642,1,0,0,0,1645,1646,5,107,0,0,1646,1648,3,218,109,0,
	1647,1649,3,188,94,0,1648,1647,1,0,0,0,1648,1649,1,0,0,0,1649,1650,1,0,
	0,0,1650,1652,3,106,53,0,1651,1653,3,190,95,0,1652,1651,1,0,0,0,1653,1654,
	1,0,0,0,1654,1652,1,0,0,0,1654,1655,1,0,0,0,1655,187,1,0,0,0,1656,1657,
	5,73,0,0,1657,1669,5,49,0,0,1658,1663,3,104,52,0,1659,1660,5,5,0,0,1660,
	1662,3,104,52,0,1661,1659,1,0,0,0,1662,1665,1,0,0,0,1663,1661,1,0,0,0,1663,
	1664,1,0,0,0,1664,1667,1,0,0,0,1665,1663,1,0,0,0,1666,1668,5,5,0,0,1667,
	1666,1,0,0,0,1667,1668,1,0,0,0,1668,1670,1,0,0,0,1669,1658,1,0,0,0,1669,
	1670,1,0,0,0,1670,1671,1,0,0,0,1671,1672,5,50,0,0,1672,189,1,0,0,0,1673,
	1675,5,108,0,0,1674,1676,5,175,0,0,1675,1674,1,0,0,0,1675,1676,1,0,0,0,
	1676,1692,1,0,0,0,1677,1689,5,49,0,0,1678,1683,3,104,52,0,1679,1680,5,5,
	0,0,1680,1682,3,104,52,0,1681,1679,1,0,0,0,1682,1685,1,0,0,0,1683,1681,
	1,0,0,0,1683,1684,1,0,0,0,1684,1687,1,0,0,0,1685,1683,1,0,0,0,1686,1688,
	5,5,0,0,1687,1686,1,0,0,0,1687,1688,1,0,0,0,1688,1690,1,0,0,0,1689,1678,
	1,0,0,0,1689,1690,1,0,0,0,1690,1691,1,0,0,0,1691,1693,5,50,0,0,1692,1677,
	1,0,0,0,1692,1693,1,0,0,0,1693,1694,1,0,0,0,1694,1695,3,106,53,0,1695,191,
	1,0,0,0,1696,1697,5,109,0,0,1697,1698,5,2,0,0,1698,193,1,0,0,0,1699,1700,
	5,110,0,0,1700,1701,5,2,0,0,1701,195,1,0,0,0,1702,1706,5,163,0,0,1703,1704,
	5,175,0,0,1704,1706,3,210,105,0,1705,1702,1,0,0,0,1705,1703,1,0,0,0,1706,
	197,1,0,0,0,1707,1708,5,36,0,0,1708,1711,5,175,0,0,1709,1710,5,12,0,0,1710,
	1712,5,175,0,0,1711,1709,1,0,0,0,1711,1712,1,0,0,0,1712,1713,1,0,0,0,1713,
	1714,5,49,0,0,1714,1726,5,4,0,0,1715,1720,3,208,104,0,1716,1717,5,5,0,0,
	1717,1719,3,208,104,0,1718,1716,1,0,0,0,1719,1722,1,0,0,0,1720,1718,1,0,
	0,0,1720,1721,1,0,0,0,1721,1724,1,0,0,0,1722,1720,1,0,0,0,1723,1725,5,5,
	0,0,1724,1723,1,0,0,0,1724,1725,1,0,0,0,1725,1727,1,0,0,0,1726,1715,1,0,
	0,0,1726,1727,1,0,0,0,1727,1728,1,0,0,0,1728,1729,5,6,0,0,1729,1730,5,50,
	0,0,1730,1750,5,2,0,0,1731,1732,5,36,0,0,1732,1735,5,175,0,0,1733,1734,
	5,12,0,0,1734,1736,5,175,0,0,1735,1733,1,0,0,0,1735,1736,1,0,0,0,1736,1737,
	1,0,0,0,1737,1738,3,210,105,0,1738,1739,5,2,0,0,1739,1750,1,0,0,0,1740,
	1741,5,36,0,0,1741,1742,5,49,0,0,1742,1743,5,163,0,0,1743,1744,5,50,0,0,
	1744,1750,5,2,0,0,1745,1746,5,36,0,0,1746,1747,5,49,0,0,1747,1748,5,50,
	0,0,1748,1750,5,2,0,0,1749,1707,1,0,0,0,1749,1731,1,0,0,0,1749,1740,1,0,
	0,0,1749,1745,1,0,0,0,1750,199,1,0,0,0,1751,1752,5,111,0,0,1752,1753,5,
	49,0,0,1753,1754,3,218,109,0,1754,1755,5,50,0,0,1755,1756,5,2,0,0,1756,
	201,1,0,0,0,1757,1760,5,175,0,0,1758,1760,3,224,112,0,1759,1757,1,0,0,0,
	1759,1758,1,0,0,0,1760,203,1,0,0,0,1761,1773,5,49,0,0,1762,1767,3,202,101,
	0,1763,1764,5,5,0,0,1764,1766,3,202,101,0,1765,1763,1,0,0,0,1766,1769,1,
	0,0,0,1767,1765,1,0,0,0,1767,1768,1,0,0,0,1768,1771,1,0,0,0,1769,1767,1,
	0,0,0,1770,1772,5,5,0,0,1771,1770,1,0,0,0,1771,1772,1,0,0,0,1772,1774,1,
	0,0,0,1773,1762,1,0,0,0,1773,1774,1,0,0,0,1774,1775,1,0,0,0,1775,1776,5,
	50,0,0,1776,205,1,0,0,0,1777,1778,5,175,0,0,1778,1802,3,210,105,0,1779,
	1780,5,175,0,0,1780,1781,5,12,0,0,1781,1782,5,175,0,0,1782,1802,3,210,105,
	0,1783,1784,5,175,0,0,1784,1785,5,49,0,0,1785,1797,5,4,0,0,1786,1791,3,
	208,104,0,1787,1788,5,5,0,0,1788,1790,3,208,104,0,1789,1787,1,0,0,0,1790,
	1793,1,0,0,0,1791,1789,1,0,0,0,1791,1792,1,0,0,0,1792,1795,1,0,0,0,1793,
	1791,1,0,0,0,1794,1796,5,5,0,0,1795,1794,1,0,0,0,1795,1796,1,0,0,0,1796,
	1798,1,0,0,0,1797,1786,1,0,0,0,1797,1798,1,0,0,0,1798,1799,1,0,0,0,1799,
	1800,5,6,0,0,1800,1802,5,50,0,0,1801,1777,1,0,0,0,1801,1779,1,0,0,0,1801,
	1783,1,0,0,0,1802,207,1,0,0,0,1803,1804,5,175,0,0,1804,1805,5,105,0,0,1805,
	1806,3,218,109,0,1806,209,1,0,0,0,1807,1819,5,49,0,0,1808,1813,3,218,109,
	0,1809,1810,5,5,0,0,1810,1812,3,218,109,0,1811,1809,1,0,0,0,1812,1815,1,
	0,0,0,1813,1811,1,0,0,0,1813,1814,1,0,0,0,1814,1817,1,0,0,0,1815,1813,1,
	0,0,0,1816,1818,5,5,0,0,1817,1816,1,0,0,0,1817,1818,1,0,0,0,1818,1820,1,
	0,0,0,1819,1808,1,0,0,0,1819,1820,1,0,0,0,1820,1821,1,0,0,0,1821,1822,5,
	50,0,0,1822,211,1,0,0,0,1823,1824,5,4,0,0,1824,1829,3,214,107,0,1825,1826,
	5,5,0,0,1826,1828,3,214,107,0,1827,1825,1,0,0,0,1828,1831,1,0,0,0,1829,
	1827,1,0,0,0,1829,1830,1,0,0,0,1830,1833,1,0,0,0,1831,1829,1,0,0,0,1832,
	1834,5,5,0,0,1833,1832,1,0,0,0,1833,1834,1,0,0,0,1834,1835,1,0,0,0,1835,
	1836,5,6,0,0,1836,213,1,0,0,0,1837,1838,5,175,0,0,1838,1839,5,105,0,0,1839,
	1840,3,218,109,0,1840,215,1,0,0,0,1841,1842,5,49,0,0,1842,1847,3,230,115,
	0,1843,1844,5,5,0,0,1844,1846,3,230,115,0,1845,1843,1,0,0,0,1846,1849,1,
	0,0,0,1847,1845,1,0,0,0,1847,1848,1,0,0,0,1848,1851,1,0,0,0,1849,1847,1,
	0,0,0,1850,1852,5,5,0,0,1851,1850,1,0,0,0,1851,1852,1,0,0,0,1852,1853,1,
	0,0,0,1853,1854,5,50,0,0,1854,217,1,0,0,0,1855,1856,6,109,-1,0,1856,1857,
	5,49,0,0,1857,1858,3,218,109,0,1858,1859,5,50,0,0,1859,1985,1,0,0,0,1860,
	1861,3,232,116,0,1861,1862,5,49,0,0,1862,1864,3,218,109,0,1863,1865,5,5,
	0,0,1864,1863,1,0,0,0,1864,1865,1,0,0,0,1865,1866,1,0,0,0,1866,1867,5,50,
	0,0,1867,1985,1,0,0,0,1868,1985,3,206,103,0,1869,1870,5,112,0,0,1870,1872,
	5,175,0,0,1871,1873,3,212,106,0,1872,1871,1,0,0,0,1872,1873,1,0,0,0,1873,
	1874,1,0,0,0,1874,1985,3,210,105,0,1875,1876,5,112,0,0,1876,1877,3,230,
	115,0,1877,1878,5,66,0,0,1878,1879,5,67,0,0,1879,1880,5,49,0,0,1880,1881,
	3,218,109,0,1881,1882,5,50,0,0,1882,1985,1,0,0,0,1883,1884,5,55,0,0,1884,
	1885,5,49,0,0,1885,1886,3,230,115,0,1886,1887,5,50,0,0,1887,1888,5,12,0,
	0,1888,1889,5,175,0,0,1889,1985,1,0,0,0,1890,1891,5,113,0,0,1891,1985,3,
	210,105,0,1892,1893,5,114,0,0,1893,1985,3,210,105,0,1894,1895,5,115,0,0,
	1895,1985,3,210,105,0,1896,1897,5,116,0,0,1897,1985,3,210,105,0,1898,1899,
	5,117,0,0,1899,1900,5,49,0,0,1900,1901,5,175,0,0,1901,1902,5,12,0,0,1902,
	1903,5,175,0,0,1903,1904,5,5,0,0,1904,1905,3,210,105,0,1905,1906,5,50,0,
	0,1906,1985,1,0,0,0,1907,1908,5,118,0,0,1908,1985,3,210,105,0,1909,1910,
	5,119,0,0,1910,1985,3,210,105,0,1911,1912,5,120,0,0,1912,1913,5,49,0,0,
	1913,1914,3,218,109,0,1914,1915,5,5,0,0,1915,1916,3,216,108,0,1916,1917,
	5,50,0,0,1917,1985,1,0,0,0,1918,1919,5,121,0,0,1919,1920,5,49,0,0,1920,
	1921,3,218,109,0,1921,1922,5,5,0,0,1922,1923,3,216,108,0,1923,1924,5,5,
	0,0,1924,1925,5,157,0,0,1925,1926,5,50,0,0,1926,1985,1,0,0,0,1927,1928,
	5,122,0,0,1928,1929,5,66,0,0,1929,1930,3,218,109,0,1930,1931,5,67,0,0,1931,
	1932,7,10,0,0,1932,1985,1,0,0,0,1933,1934,5,128,0,0,1934,1935,5,66,0,0,
	1935,1936,3,218,109,0,1936,1937,5,67,0,0,1937,1938,7,11,0,0,1938,1985,1,
	0,0,0,1939,1940,7,12,0,0,1940,1985,3,218,109,21,1941,1953,5,66,0,0,1942,
	1947,3,218,109,0,1943,1944,5,5,0,0,1944,1946,3,218,109,0,1945,1943,1,0,
	0,0,1946,1949,1,0,0,0,1947,1945,1,0,0,0,1947,1948,1,0,0,0,1948,1951,1,0,
	0,0,1949,1947,1,0,0,0,1950,1952,5,5,0,0,1951,1950,1,0,0,0,1951,1952,1,0,
	0,0,1952,1954,1,0,0,0,1953,1942,1,0,0,0,1953,1954,1,0,0,0,1954,1955,1,0,
	0,0,1955,1985,5,67,0,0,1956,1957,5,74,0,0,1957,1958,5,12,0,0,1958,1959,
	5,175,0,0,1959,1960,5,12,0,0,1960,1961,5,175,0,0,1961,1962,5,66,0,0,1962,
	1963,3,218,109,0,1963,1964,5,67,0,0,1964,1965,3,220,110,0,1965,1985,1,0,
	0,0,1966,1967,5,74,0,0,1967,1968,5,12,0,0,1968,1973,5,175,0,0,1969,1970,
	5,66,0,0,1970,1971,3,218,109,0,1971,1972,5,67,0,0,1972,1974,1,0,0,0,1973,
	1969,1,0,0,0,1974,1975,1,0,0,0,1975,1973,1,0,0,0,1975,1976,1,0,0,0,1976,
	1985,1,0,0,0,1977,1978,5,74,0,0,1978,1979,5,12,0,0,1979,1985,5,175,0,0,
	1980,1985,5,74,0,0,1981,1985,5,172,0,0,1982,1985,3,14,7,0,1983,1985,3,224,
	112,0,1984,1855,1,0,0,0,1984,1860,1,0,0,0,1984,1868,1,0,0,0,1984,1869,1,
	0,0,0,1984,1875,1,0,0,0,1984,1883,1,0,0,0,1984,1890,1,0,0,0,1984,1892,1,
	0,0,0,1984,1894,1,0,0,0,1984,1896,1,0,0,0,1984,1898,1,0,0,0,1984,1907,1,
	0,0,0,1984,1909,1,0,0,0,1984,1911,1,0,0,0,1984,1918,1,0,0,0,1984,1927,1,
	0,0,0,1984,1933,1,0,0,0,1984,1939,1,0,0,0,1984,1941,1,0,0,0,1984,1956,1,
	0,0,0,1984,1966,1,0,0,0,1984,1977,1,0,0,0,1984,1980,1,0,0,0,1984,1981,1,
	0,0,0,1984,1982,1,0,0,0,1984,1983,1,0,0,0,1985,2091,1,0,0,0,1986,1987,10,
	20,0,0,1987,1988,5,17,0,0,1988,2090,3,218,109,20,1989,1990,10,19,0,0,1990,
	1991,7,13,0,0,1991,2090,3,218,109,20,1992,1993,10,18,0,0,1993,1994,7,14,
	0,0,1994,2090,3,218,109,19,1995,1996,10,17,0,0,1996,1997,7,15,0,0,1997,
	2090,3,218,109,18,1998,1999,10,16,0,0,1999,2000,7,16,0,0,2000,2090,3,218,
	109,17,2001,2002,10,15,0,0,2002,2003,7,17,0,0,2003,2090,3,218,109,16,2004,
	2005,10,14,0,0,2005,2006,5,24,0,0,2006,2090,3,218,109,15,2007,2008,10,13,
	0,0,2008,2009,5,26,0,0,2009,2090,3,218,109,14,2010,2011,10,12,0,0,2011,
	2012,5,25,0,0,2012,2090,3,218,109,13,2013,2014,10,11,0,0,2014,2015,5,140,
	0,0,2015,2090,3,218,109,12,2016,2017,10,10,0,0,2017,2018,5,141,0,0,2018,
	2090,3,218,109,11,2019,2020,10,9,0,0,2020,2021,5,142,0,0,2021,2022,3,218,
	109,0,2022,2023,5,105,0,0,2023,2024,3,218,109,9,2024,2090,1,0,0,0,2025,
	2026,10,32,0,0,2026,2027,5,66,0,0,2027,2028,3,218,109,0,2028,2029,5,105,
	0,0,2029,2030,3,218,109,0,2030,2031,5,67,0,0,2031,2090,1,0,0,0,2032,2033,
	10,31,0,0,2033,2034,5,66,0,0,2034,2035,5,157,0,0,2035,2090,5,67,0,0,2036,
	2037,10,30,0,0,2037,2038,5,66,0,0,2038,2039,3,218,109,0,2039,2040,5,67,
	0,0,2040,2090,1,0,0,0,2041,2042,10,27,0,0,2042,2090,7,18,0,0,2043,2044,
	10,26,0,0,2044,2045,5,135,0,0,2045,2046,5,49,0,0,2046,2047,3,218,109,0,
	2047,2048,5,50,0,0,2048,2090,1,0,0,0,2049,2050,10,25,0,0,2050,2051,5,136,
	0,0,2051,2052,5,49,0,0,2052,2053,3,218,109,0,2053,2054,5,5,0,0,2054,2055,
	3,218,109,0,2055,2056,5,50,0,0,2056,2090,1,0,0,0,2057,2058,10,24,0,0,2058,
	2059,5,12,0,0,2059,2061,5,175,0,0,2060,2062,3,212,106,0,2061,2060,1,0,0,
	0,2061,2062,1,0,0,0,2062,2063,1,0,0,0,2063,2064,5,49,0,0,2064,2076,5,4,
	0,0,2065,2070,3,208,104,0,2066,2067,5,5,0,0,2067,2069,3,208,104,0,2068,
	2066,1,0,0,0,2069,2072,1,0,0,0,2070,2068,1,0,0,0,2070,2071,1,0,0,0,2071,
	2074,1,0,0,0,2072,2070,1,0,0,0,2073,2075,5,5,0,0,2074,2073,1,0,0,0,2074,
	2075,1,0,0,0,2075,2077,1,0,0,0,2076,2065,1,0,0,0,2076,2077,1,0,0,0,2077,
	2078,1,0,0,0,2078,2079,5,6,0,0,2079,2090,5,50,0,0,2080,2081,10,23,0,0,2081,
	2082,5,12,0,0,2082,2084,5,175,0,0,2083,2085,3,212,106,0,2084,2083,1,0,0,
	0,2084,2085,1,0,0,0,2085,2086,1,0,0,0,2086,2090,3,210,105,0,2087,2088,10,
	22,0,0,2088,2090,3,220,110,0,2089,1986,1,0,0,0,2089,1989,1,0,0,0,2089,1992,
	1,0,0,0,2089,1995,1,0,0,0,2089,1998,1,0,0,0,2089,2001,1,0,0,0,2089,2004,
	1,0,0,0,2089,2007,1,0,0,0,2089,2010,1,0,0,0,2089,2013,1,0,0,0,2089,2016,
	1,0,0,0,2089,2019,1,0,0,0,2089,2025,1,0,0,0,2089,2032,1,0,0,0,2089,2036,
	1,0,0,0,2089,2041,1,0,0,0,2089,2043,1,0,0,0,2089,2049,1,0,0,0,2089,2057,
	1,0,0,0,2089,2080,1,0,0,0,2089,2087,1,0,0,0,2090,2093,1,0,0,0,2091,2089,
	1,0,0,0,2091,2092,1,0,0,0,2092,219,1,0,0,0,2093,2091,1,0,0,0,2094,2095,
	5,12,0,0,2095,2108,5,175,0,0,2096,2108,5,123,0,0,2097,2108,5,124,0,0,2098,
	2108,5,125,0,0,2099,2108,5,126,0,0,2100,2108,5,127,0,0,2101,2108,5,129,
	0,0,2102,2108,5,130,0,0,2103,2108,5,131,0,0,2104,2108,5,132,0,0,2105,2108,
	5,143,0,0,2106,2108,5,144,0,0,2107,2094,1,0,0,0,2107,2096,1,0,0,0,2107,
	2097,1,0,0,0,2107,2098,1,0,0,0,2107,2099,1,0,0,0,2107,2100,1,0,0,0,2107,
	2101,1,0,0,0,2107,2102,1,0,0,0,2107,2103,1,0,0,0,2107,2104,1,0,0,0,2107,
	2105,1,0,0,0,2107,2106,1,0,0,0,2108,221,1,0,0,0,2109,2110,7,19,0,0,2110,
	223,1,0,0,0,2111,2126,5,153,0,0,2112,2126,3,226,113,0,2113,2126,3,228,114,
	0,2114,2118,5,163,0,0,2115,2117,5,163,0,0,2116,2115,1,0,0,0,2117,2120,1,
	0,0,0,2118,2116,1,0,0,0,2118,2119,1,0,0,0,2119,2126,1,0,0,0,2120,2118,1,
	0,0,0,2121,2126,5,173,0,0,2122,2126,5,174,0,0,2123,2126,5,164,0,0,2124,
	2126,5,165,0,0,2125,2111,1,0,0,0,2125,2112,1,0,0,0,2125,2113,1,0,0,0,2125,
	2114,1,0,0,0,2125,2121,1,0,0,0,2125,2122,1,0,0,0,2125,2123,1,0,0,0,2125,
	2124,1,0,0,0,2126,225,1,0,0,0,2127,2129,5,157,0,0,2128,2130,7,20,0,0,2129,
	2128,1,0,0,0,2129,2130,1,0,0,0,2130,227,1,0,0,0,2131,2132,5,156,0,0,2132,
	229,1,0,0,0,2133,2134,5,149,0,0,2134,2178,5,59,0,0,2135,2178,5,149,0,0,
	2136,2178,5,158,0,0,2137,2178,5,159,0,0,2138,2178,5,161,0,0,2139,2178,5,
	160,0,0,2140,2178,5,168,0,0,2141,2178,5,169,0,0,2142,2178,5,150,0,0,2143,
	2178,5,151,0,0,2144,2178,5,170,0,0,2145,2178,5,171,0,0,2146,2147,5,7,0,
	0,2147,2156,5,49,0,0,2148,2153,3,230,115,0,2149,2150,5,5,0,0,2150,2152,
	3,230,115,0,2151,2149,1,0,0,0,2152,2155,1,0,0,0,2153,2151,1,0,0,0,2153,
	2154,1,0,0,0,2154,2157,1,0,0,0,2155,2153,1,0,0,0,2156,2148,1,0,0,0,2156,
	2157,1,0,0,0,2157,2158,1,0,0,0,2158,2171,5,50,0,0,2159,2160,5,73,0,0,2160,
	2161,5,49,0,0,2161,2166,3,230,115,0,2162,2163,5,5,0,0,2163,2165,3,230,115,
	0,2164,2162,1,0,0,0,2165,2168,1,0,0,0,2166,2164,1,0,0,0,2166,2167,1,0,0,
	0,2167,2169,1,0,0,0,2168,2166,1,0,0,0,2169,2170,5,50,0,0,2170,2172,1,0,
	0,0,2171,2159,1,0,0,0,2171,2172,1,0,0,0,2172,2178,1,0,0,0,2173,2174,5,175,
	0,0,2174,2175,5,12,0,0,2175,2178,5,175,0,0,2176,2178,5,175,0,0,2177,2133,
	1,0,0,0,2177,2135,1,0,0,0,2177,2136,1,0,0,0,2177,2137,1,0,0,0,2177,2138,
	1,0,0,0,2177,2139,1,0,0,0,2177,2140,1,0,0,0,2177,2141,1,0,0,0,2177,2142,
	1,0,0,0,2177,2143,1,0,0,0,2177,2144,1,0,0,0,2177,2145,1,0,0,0,2177,2146,
	1,0,0,0,2177,2173,1,0,0,0,2177,2176,1,0,0,0,2178,231,1,0,0,0,2179,2180,
	7,21,0,0,2180,233,1,0,0,0,227,237,243,256,258,278,282,289,294,302,306,312,
	322,325,335,339,345,348,352,357,361,376,379,393,396,407,409,424,439,443,
	453,459,465,471,477,483,489,495,501,506,514,517,534,536,547,553,557,569,
	573,575,579,585,597,601,603,617,633,637,644,664,670,677,688,694,701,709,
	720,729,735,741,750,756,761,767,774,780,786,790,794,802,807,815,825,830,
	834,846,855,857,863,869,876,887,893,897,903,910,926,935,939,945,954,958,
	966,970,976,980,982,990,994,996,1004,1008,1014,1018,1020,1026,1031,1063,
	1089,1103,1115,1119,1124,1129,1138,1142,1144,1166,1171,1177,1186,1195,1199,
	1201,1210,1215,1226,1230,1232,1245,1249,1262,1273,1286,1292,1300,1306,1310,
	1320,1332,1342,1353,1360,1366,1373,1386,1443,1455,1459,1468,1478,1490,1498,
	1543,1552,1558,1570,1595,1607,1620,1624,1634,1642,1648,1654,1663,1667,1669,
	1675,1683,1687,1689,1692,1705,1711,1720,1724,1726,1735,1749,1759,1767,1771,
	1773,1791,1795,1797,1801,1813,1817,1819,1829,1833,1847,1851,1864,1872,1947,
	1951,1953,1975,1984,2061,2070,2074,2076,2084,2089,2091,2107,2118,2125,2129,
	2153,2156,2166,2171,2177];

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
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
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
