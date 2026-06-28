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
	public static readonly VersionLiteral = 136;
	public static readonly BooleanLiteral = 137;
	public static readonly NumberUnit = 138;
	public static readonly BchUnit = 139;
	public static readonly DecimalLiteral = 140;
	public static readonly NumberLiteral = 141;
	public static readonly PrimitiveType = 142;
	public static readonly CryptoType = 143;
	public static readonly UnboundedBytes = 144;
	public static readonly BoundedBytes = 145;
	public static readonly Bound = 146;
	public static readonly StringLiteral = 147;
	public static readonly DateLiteral = 148;
	public static readonly HexLiteral = 149;
	public static readonly TxVar = 150;
	public static readonly UnsafeCast = 151;
	public static readonly BoundedSignedInt = 152;
	public static readonly BoundedUnsignedInt = 153;
	public static readonly BoundedSignedFixed = 154;
	public static readonly BoundedUnsignedFixed = 155;
	public static readonly NullaryOp = 156;
	public static readonly UnicodeLiteral = 157;
	public static readonly HexStringLiteral = 158;
	public static readonly DotValue = 159;
	public static readonly DotLength = 160;
	public static readonly DotPush = 161;
	public static readonly DotPop = 162;
	public static readonly DotSplit = 163;
	public static readonly DotSlice = 164;
	public static readonly DotDelete = 165;
	public static readonly DotCode = 166;
	public static readonly DotCodehash = 167;
	public static readonly DotLockingBytecode = 168;
	public static readonly DotTokenCategory = 169;
	public static readonly DotNftCommitment = 170;
	public static readonly DotTokenAmount = 171;
	public static readonly DotOutpointTransactionHash = 172;
	public static readonly DotOutpointIndex = 173;
	public static readonly DotUnlockingBytecode = 174;
	public static readonly DotSequenceNumber = 175;
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
                                                            "'--'", "'delete'", 
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
                                                            "'tx.inputs'", 
                                                            "'.reverse()'", 
                                                            "'!'", "'>>'", 
                                                            "'<<'", "'&&'", 
                                                            "'||'", "'?'", 
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
                                                            "'bytes'", null, 
                                                            null, null, 
                                                            null, null, 
                                                            null, null, 
                                                            null, null, 
                                                            null, null, 
                                                            null, null, 
                                                            null, "'.value'", 
                                                            "'.length'", 
                                                            "'.push'", "'.pop'", 
                                                            "'.split'", 
                                                            "'.slice'", 
                                                            "'.delete'", 
                                                            "'.code'", "'.codehash'", 
                                                            "'.lockingBytecode'", 
                                                            "'.tokenCategory'", 
                                                            "'.nftCommitment'", 
                                                            "'.tokenAmount'", 
                                                            "'.outpointTransactionHash'", 
                                                            "'.outpointIndex'", 
                                                            "'.unlockingBytecode'", 
                                                            "'.sequenceNumber'" ];
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
                                                             "DotValue", 
                                                             "DotLength", 
                                                             "DotPush", 
                                                             "DotPop", "DotSplit", 
                                                             "DotSlice", 
                                                             "DotDelete", 
                                                             "DotCode", 
                                                             "DotCodehash", 
                                                             "DotLockingBytecode", 
                                                             "DotTokenCategory", 
                                                             "DotNftCommitment", 
                                                             "DotTokenAmount", 
                                                             "DotOutpointTransactionHash", 
                                                             "DotOutpointIndex", 
                                                             "DotUnlockingBytecode", 
                                                             "DotSequenceNumber", 
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
			while (_la===7 || _la===8 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1842241) !== 0) || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 7872007) !== 0) || _la===176) {
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
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4294590239) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2012594187) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 33554687) !== 0)) {
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
				case 133:
				case 134:
				case 135:
				case 142:
				case 143:
				case 144:
				case 145:
				case 152:
				case 153:
				case 154:
				case 155:
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
				case 133:
				case 134:
				case 135:
				case 142:
				case 143:
				case 144:
				case 145:
				case 152:
				case 153:
				case 154:
				case 155:
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
			if(!(((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===139 || _la===143 || _la===176)) {
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
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0) || _la===136) {
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
			_alt = this._interp.adaptivePredict(this._input, 35, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 490;
					this.stateVariableDeclaration();
					}
					}
				}
				this.state = 495;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 35, this._ctx);
			}
			this.state = 499;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===8) {
				{
				{
				this.state = 496;
				this.usingForDirective();
				}
				}
				this.state = 501;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
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
		this.enterRule(localctx, 38, SolidCashParser.RULE_contractDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 511;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===46) {
				{
				this.state = 510;
				this.match(SolidCashParser.T__45);
				}
			}

			this.state = 513;
			this.match(SolidCashParser.T__46);
			this.state = 514;
			this.match(SolidCashParser.Identifier);
			this.state = 516;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 515;
				this.parameterList();
				}
			}

			this.state = 527;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 518;
				this.match(SolidCashParser.T__41);
				this.state = 519;
				this.inheritanceSpecifier();
				this.state = 524;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 520;
					this.match(SolidCashParser.T__4);
					this.state = 521;
					this.inheritanceSpecifier();
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
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 268435459) !== 0) || ((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 37411875) !== 0) || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 7872007) !== 0) || _la===176) {
				{
				this.state = 544;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 42, this._ctx) ) {
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
	public inheritanceSpecifier(): InheritanceSpecifierContext {
		let localctx: InheritanceSpecifierContext = new InheritanceSpecifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 40, SolidCashParser.RULE_inheritanceSpecifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 551;
			this.match(SolidCashParser.Identifier);
			this.state = 553;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 552;
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
			this.state = 555;
			this.match(SolidCashParser.T__6);
			this.state = 556;
			this.anyIdentifier();
			this.state = 557;
			this.parameterList();
			this.state = 561;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 558;
				this.functionModifier();
				}
				}
				this.state = 563;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 567;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===176) {
				{
				{
				this.state = 564;
				this.customModifierInvocation();
				}
				}
				this.state = 569;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 571;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 570;
				this.returnType();
				}
			}

			this.state = 573;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 575;
			this.match(SolidCashParser.T__47);
			this.state = 576;
			this.match(SolidCashParser.Identifier);
			this.state = 577;
			this.match(SolidCashParser.T__48);
			this.state = 589;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 7872007) !== 0) || _la===176) {
				{
				this.state = 578;
				this.eventParameter();
				this.state = 583;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 48, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 579;
						this.match(SolidCashParser.T__4);
						this.state = 580;
						this.eventParameter();
						}
						}
					}
					this.state = 585;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 48, this._ctx);
				}
				this.state = 587;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 586;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 591;
			this.match(SolidCashParser.T__49);
			this.state = 593;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===51) {
				{
				this.state = 592;
				this.match(SolidCashParser.T__50);
				}
			}

			this.state = 595;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 599;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 52, this._ctx) ) {
			case 1:
				{
				this.state = 597;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 598;
				this.arrayType(0);
				}
				break;
			}
			this.state = 602;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===52) {
				{
				this.state = 601;
				this.match(SolidCashParser.T__51);
				}
			}

			this.state = 604;
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
			this.state = 606;
			this.match(SolidCashParser.T__34);
			this.state = 607;
			this.match(SolidCashParser.Identifier);
			this.state = 608;
			this.match(SolidCashParser.T__48);
			this.state = 620;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 7872007) !== 0) || _la===176) {
				{
				this.state = 609;
				this.errorParameter();
				this.state = 614;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 54, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 610;
						this.match(SolidCashParser.T__4);
						this.state = 611;
						this.errorParameter();
						}
						}
					}
					this.state = 616;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 54, this._ctx);
				}
				this.state = 618;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 617;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 622;
			this.match(SolidCashParser.T__49);
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
	public errorParameter(): ErrorParameterContext {
		let localctx: ErrorParameterContext = new ErrorParameterContext(this, this._ctx, this.state);
		this.enterRule(localctx, 50, SolidCashParser.RULE_errorParameter);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 625;
			this.typeName();
			this.state = 626;
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
			this.state = 628;
			this.match(SolidCashParser.T__52);
			this.state = 629;
			this.match(SolidCashParser.Identifier);
			this.state = 630;
			this.match(SolidCashParser.T__3);
			this.state = 632;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 631;
				this.structField();
				}
				}
				this.state = 634;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || _la===64 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 7872007) !== 0) || _la===176);
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
	public structField(): StructFieldContext {
		let localctx: StructFieldContext = new StructFieldContext(this, this._ctx, this.state);
		this.enterRule(localctx, 54, SolidCashParser.RULE_structField);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 641;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 58, this._ctx) ) {
			case 1:
				{
				this.state = 638;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 639;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 640;
				this.mappingType();
				}
				break;
			}
			this.state = 643;
			this.anyIdentifier();
			this.state = 644;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 646;
			this.match(SolidCashParser.T__53);
			this.state = 647;
			this.match(SolidCashParser.Identifier);
			this.state = 648;
			this.match(SolidCashParser.T__3);
			this.state = 649;
			this.enumMember();
			this.state = 654;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 59, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 650;
					this.match(SolidCashParser.T__4);
					this.state = 651;
					this.enumMember();
					}
					}
				}
				this.state = 656;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 59, this._ctx);
			}
			this.state = 658;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 657;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 660;
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
			this.state = 662;
			this.match(SolidCashParser.Identifier);
			this.state = 665;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 663;
				this.match(SolidCashParser.T__39);
				this.state = 664;
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
			this.state = 667;
			this.match(SolidCashParser.T__54);
			this.state = 668;
			this.match(SolidCashParser.Identifier);
			this.state = 669;
			this.match(SolidCashParser.T__41);
			this.state = 670;
			this.typeName();
			this.state = 671;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 673;
			this.typeName();
			this.state = 674;
			this.match(SolidCashParser.T__55);
			this.state = 675;
			this.match(SolidCashParser.Identifier);
			this.state = 676;
			this.match(SolidCashParser.T__39);
			this.state = 677;
			this.expression(0);
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
	public constructorDefinition(): ConstructorDefinitionContext {
		let localctx: ConstructorDefinitionContext = new ConstructorDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 64, SolidCashParser.RULE_constructorDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 680;
			this.match(SolidCashParser.T__56);
			this.state = 681;
			this.parameterList();
			this.state = 685;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 98307) !== 0)) {
				{
				{
				this.state = 682;
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
				this.state = 687;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 691;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===176) {
				{
				{
				this.state = 688;
				this.parentInvocation();
				}
				}
				this.state = 693;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 694;
			this.match(SolidCashParser.T__3);
			this.state = 698;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4294590239) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2012594187) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 33554687) !== 0)) {
				{
				{
				this.state = 695;
				this.statement();
				}
				}
				this.state = 700;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 701;
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
			this.state = 703;
			this.match(SolidCashParser.T__59);
			this.state = 704;
			this.parameterList();
			this.state = 705;
			this.match(SolidCashParser.T__43);
			this.state = 709;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 8197) !== 0)) {
				{
				{
				this.state = 706;
				this.fallbackModifier();
				}
				}
				this.state = 711;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 715;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===176) {
				{
				{
				this.state = 712;
				this.customModifierInvocation();
				}
				}
				this.state = 717;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 718;
			this.match(SolidCashParser.T__3);
			this.state = 722;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4294590239) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2012594187) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 33554687) !== 0)) {
				{
				{
				this.state = 719;
				this.statement();
				}
				}
				this.state = 724;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 725;
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
			this.state = 730;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 59:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 727;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 728;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 729;
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
			this.state = 732;
			this.match(SolidCashParser.T__61);
			this.state = 733;
			this.match(SolidCashParser.T__48);
			this.state = 734;
			this.match(SolidCashParser.T__49);
			this.state = 735;
			this.match(SolidCashParser.T__43);
			this.state = 736;
			this.match(SolidCashParser.T__58);
			this.state = 737;
			this.match(SolidCashParser.T__3);
			this.state = 741;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4294590239) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2012594187) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 33554687) !== 0)) {
				{
				{
				this.state = 738;
				this.statement();
				}
				}
				this.state = 743;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 744;
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
			this.state = 746;
			this.match(SolidCashParser.Identifier);
			this.state = 747;
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
			this.state = 811;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 80, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 750;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 749;
					this.stateVariableVisibility();
					}
				}

				this.state = 752;
				this.typeName();
				this.state = 756;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 128)) & ~0x1F) === 0 && ((1 << (_la - 128)) & 31) !== 0)) {
					{
					{
					this.state = 753;
					this.modifier();
					}
					}
					this.state = 758;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 759;
				this.match(SolidCashParser.Identifier);
				this.state = 762;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 760;
					this.match(SolidCashParser.T__39);
					this.state = 761;
					this.expression(0);
					}
				}

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
				while (_la===33 || _la===56 || ((((_la - 128)) & ~0x1F) === 0 && ((1 << (_la - 128)) & 31) !== 0)) {
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
				this.state = 777;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 775;
					this.match(SolidCashParser.T__39);
					this.state = 776;
					this.expression(0);
					}
				}

				this.state = 779;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 782;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 781;
					this.stateVariableVisibility();
					}
				}

				this.state = 784;
				this.mappingType();
				this.state = 788;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || ((((_la - 128)) & ~0x1F) === 0 && ((1 << (_la - 128)) & 31) !== 0)) {
					{
					{
					this.state = 785;
					this.collectionModifier();
					}
					}
					this.state = 790;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 791;
				this.match(SolidCashParser.Identifier);
				this.state = 792;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 795;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 794;
					this.stateVariableVisibility();
					}
				}

				this.state = 797;
				this.arrayType(0);
				this.state = 801;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || ((((_la - 128)) & ~0x1F) === 0 && ((1 << (_la - 128)) & 31) !== 0)) {
					{
					{
					this.state = 798;
					this.collectionModifier();
					}
					}
					this.state = 803;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 804;
				this.match(SolidCashParser.Identifier);
				this.state = 807;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 805;
					this.match(SolidCashParser.T__39);
					this.state = 806;
					this.expression(0);
					}
				}

				this.state = 809;
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
			this.state = 815;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 33:
			case 56:
			case 128:
			case 129:
			case 130:
			case 131:
			case 132:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 813;
				this.modifier();
				}
				break;
			case 43:
			case 44:
			case 58:
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 814;
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
			this.state = 817;
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
			this.state = 855;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 87, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 819;
				this.match(SolidCashParser.T__63);
				this.state = 820;
				this.match(SolidCashParser.T__48);
				this.state = 821;
				this.typeName();
				this.state = 823;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 822;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 825;
				this.match(SolidCashParser.T__64);
				this.state = 826;
				this.typeName();
				this.state = 828;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 827;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 830;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 832;
				this.match(SolidCashParser.T__63);
				this.state = 833;
				this.match(SolidCashParser.T__48);
				this.state = 834;
				this.typeName();
				this.state = 836;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 835;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 838;
				this.match(SolidCashParser.T__64);
				this.state = 839;
				this.mappingType();
				this.state = 840;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 842;
				this.match(SolidCashParser.T__63);
				this.state = 843;
				this.match(SolidCashParser.T__48);
				this.state = 844;
				this.typeName();
				this.state = 846;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 845;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 848;
				this.match(SolidCashParser.T__64);
				this.state = 849;
				this.arrayType(0);
				this.state = 851;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 850;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 853;
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
			this.state = 867;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 88, this._ctx) ) {
			case 1:
				{
				this.state = 858;
				this.typeName();
				this.state = 859;
				this.match(SolidCashParser.T__65);
				this.state = 860;
				_la = this._input.LA(1);
				if(!(_la===141 || _la===176)) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 861;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 2:
				{
				this.state = 863;
				this.typeName();
				this.state = 864;
				this.match(SolidCashParser.T__65);
				this.state = 865;
				this.match(SolidCashParser.T__66);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 878;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 90, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 876;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 89, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 869;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 870;
						this.match(SolidCashParser.T__65);
						this.state = 871;
						_la = this._input.LA(1);
						if(!(_la===141 || _la===176)) {
						this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 872;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 873;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 874;
						this.match(SolidCashParser.T__65);
						this.state = 875;
						this.match(SolidCashParser.T__66);
						}
						break;
					}
					}
				}
				this.state = 880;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 90, this._ctx);
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
			this.state = 881;
			this.match(SolidCashParser.T__67);
			this.state = 882;
			this.match(SolidCashParser.Identifier);
			this.state = 884;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 883;
				this.parameterList();
				}
			}

			this.state = 886;
			this.match(SolidCashParser.T__3);
			this.state = 890;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4294590239) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2012594187) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 33554687) !== 0)) {
				{
				{
				this.state = 887;
				this.modifierStatement();
				}
				}
				this.state = 892;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 893;
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
			this.state = 897;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 69:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 895;
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
			case 89:
			case 90:
			case 91:
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
			case 122:
			case 133:
			case 134:
			case 135:
			case 137:
			case 139:
			case 140:
			case 141:
			case 142:
			case 143:
			case 144:
			case 145:
			case 147:
			case 148:
			case 149:
			case 151:
			case 152:
			case 153:
			case 154:
			case 155:
			case 156:
			case 157:
			case 158:
			case 176:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 896;
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
			this.state = 899;
			this.match(SolidCashParser.T__68);
			this.state = 900;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 902;
			this.match(SolidCashParser.T__6);
			this.state = 903;
			this.anyIdentifier();
			this.state = 904;
			this.parameterList();
			this.state = 908;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 905;
				this.functionModifier();
				}
				}
				this.state = 910;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 914;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===176) {
				{
				{
				this.state = 911;
				this.customModifierInvocation();
				}
				}
				this.state = 916;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 918;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 917;
				this.returnType();
				}
			}

			this.state = 920;
			this.match(SolidCashParser.T__3);
			this.state = 924;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4294590239) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2012594187) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 33554687) !== 0)) {
				{
				{
				this.state = 921;
				this.statement();
				}
				}
				this.state = 926;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 927;
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
			this.state = 929;
			this.match(SolidCashParser.Identifier);
			this.state = 931;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 930;
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
			this.state = 947;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 70:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 933;
				this.match(SolidCashParser.T__69);
				}
				break;
			case 71:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 934;
				this.match(SolidCashParser.T__70);
				}
				break;
			case 58:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 935;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 44:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 936;
				this.match(SolidCashParser.T__43);
				}
				break;
			case 43:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 937;
				this.match(SolidCashParser.T__42);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 938;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 59:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 939;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 940;
				this.overrideSpecifier();
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 941;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 942;
				this.unsafeModifier();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 943;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 944;
				this.match(SolidCashParser.T__27);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 945;
				this.match(SolidCashParser.T__30);
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 946;
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
			this.state = 949;
			this.match(SolidCashParser.T__71);
			this.state = 960;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 950;
				this.match(SolidCashParser.T__48);
				this.state = 951;
				this.match(SolidCashParser.Identifier);
				this.state = 956;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 952;
					this.match(SolidCashParser.T__4);
					this.state = 953;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 958;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
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
	public unsafeModifier(): UnsafeModifierContext {
		let localctx: UnsafeModifierContext = new UnsafeModifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 98, SolidCashParser.RULE_unsafeModifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 962;
			this.match(SolidCashParser.T__31);
			this.state = 966;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 963;
				this.match(SolidCashParser.T__48);
				this.state = 964;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 965;
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
			this.state = 968;
			this.match(SolidCashParser.T__72);
			this.state = 969;
			this.match(SolidCashParser.T__48);
			this.state = 970;
			this.returnParam();
			this.state = 975;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 103, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 971;
					this.match(SolidCashParser.T__4);
					this.state = 972;
					this.returnParam();
					}
					}
				}
				this.state = 977;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 103, this._ctx);
			}
			this.state = 979;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 978;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 981;
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
			this.state = 1003;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 109, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 983;
				this.typeName();
				this.state = 987;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 105, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 984;
						this.modifier();
						}
						}
					}
					this.state = 989;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 105, this._ctx);
				}
				this.state = 991;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===139 || _la===143 || _la===176) {
					{
					this.state = 990;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 993;
				this.arrayType(0);
				this.state = 997;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 107, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 994;
						this.modifier();
						}
						}
					}
					this.state = 999;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 107, this._ctx);
				}
				this.state = 1001;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===139 || _la===143 || _la===176) {
					{
					this.state = 1000;
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
			this.state = 1005;
			this.match(SolidCashParser.T__48);
			this.state = 1017;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 7872007) !== 0) || _la===176) {
				{
				this.state = 1006;
				this.parameter();
				this.state = 1011;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 110, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1007;
						this.match(SolidCashParser.T__4);
						this.state = 1008;
						this.parameter();
						}
						}
					}
					this.state = 1013;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 110, this._ctx);
				}
				this.state = 1015;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1014;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1019;
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
			this.state = 1051;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 119, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1021;
				this.typeName();
				this.state = 1025;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 113, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1022;
						this.modifier();
						}
						}
					}
					this.state = 1027;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 113, this._ctx);
				}
				this.state = 1029;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===139 || _la===143 || _la===176) {
					{
					this.state = 1028;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1031;
				this.arrayType(0);
				this.state = 1035;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 115, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1032;
						this.modifier();
						}
						}
					}
					this.state = 1037;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 115, this._ctx);
				}
				this.state = 1039;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===139 || _la===143 || _la===176) {
					{
					this.state = 1038;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1041;
				this.mappingType();
				this.state = 1045;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 117, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1042;
						this.modifier();
						}
						}
					}
					this.state = 1047;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 117, this._ctx);
				}
				this.state = 1049;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===139 || _la===143 || _la===176) {
					{
					this.state = 1048;
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
			this.state = 1062;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1053;
				this.match(SolidCashParser.T__3);
				this.state = 1057;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4294590239) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2012594187) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 33554687) !== 0)) {
					{
					{
					this.state = 1054;
					this.statement();
					}
					}
					this.state = 1059;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1060;
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
			case 89:
			case 90:
			case 91:
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
			case 122:
			case 133:
			case 134:
			case 135:
			case 137:
			case 139:
			case 140:
			case 141:
			case 142:
			case 143:
			case 144:
			case 145:
			case 147:
			case 148:
			case 149:
			case 151:
			case 152:
			case 153:
			case 154:
			case 155:
			case 156:
			case 157:
			case 158:
			case 176:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1061;
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
			this.state = 1095;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 122, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1064;
				this.variableDefinition();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1065;
				this.tupleAssignment();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1066;
				this.arrayPushStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1067;
				this.arrayPopStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1068;
				this.arrayDeleteStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1069;
				this.stateArrayPushStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1070;
				this.stateArrayPopStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1071;
				this.assignStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1072;
				this.assignmentStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1073;
				this.mappingDeleteStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1074;
				this.timeOpStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1075;
				this.requireStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1076;
				this.ifStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1077;
				this.loopStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1078;
				this.consoleStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1079;
				this.emitStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1080;
				this.transferStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1081;
				this.tokenContainerMethodStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1082;
				this.returnStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1083;
				this.functionCallStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1084;
				this.addressMethodStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1085;
				this.selfdestructStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1086;
				this.assemblyStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1087;
				this.tryCatchStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1088;
				this.revertStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1089;
				this.assertStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1090;
				this.deleteStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1091;
				this.uncheckedStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1092;
				this.switchStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1093;
				this.breakStatement();
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 31);
				{
				this.state = 1094;
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
			this.state = 1097;
			this.match(SolidCashParser.T__73);
			this.state = 1098;
			this.match(SolidCashParser.T__11);
			this.state = 1099;
			this.match(SolidCashParser.Identifier);
			this.state = 1100;
			this.match(SolidCashParser.T__48);
			this.state = 1101;
			this.expression(0);
			this.state = 1102;
			this.match(SolidCashParser.T__4);
			this.state = 1103;
			this.expression(0);
			this.state = 1104;
			this.match(SolidCashParser.T__49);
			this.state = 1105;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1107;
			this.match(SolidCashParser.T__73);
			this.state = 1108;
			this.match(SolidCashParser.T__11);
			this.state = 1109;
			this.match(SolidCashParser.Identifier);
			this.state = 1110;
			this.match(SolidCashParser.T__65);
			this.state = 1111;
			this.expression(0);
			this.state = 1112;
			this.match(SolidCashParser.T__66);
			this.state = 1113;
			this.match(SolidCashParser.T__11);
			this.state = 1114;
			this.match(SolidCashParser.Identifier);
			this.state = 1115;
			this.match(SolidCashParser.T__48);
			this.state = 1116;
			this.expression(0);
			this.state = 1121;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1117;
				this.match(SolidCashParser.T__4);
				this.state = 1118;
				this.expression(0);
				}
				}
				this.state = 1123;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1124;
			this.match(SolidCashParser.T__49);
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
	public returnStatement(): ReturnStatementContext {
		let localctx: ReturnStatementContext = new ReturnStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 116, SolidCashParser.RULE_returnStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1156;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 127, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1127;
				this.match(SolidCashParser.T__74);
				this.state = 1128;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1129;
				this.match(SolidCashParser.T__74);
				this.state = 1130;
				this.expression(0);
				this.state = 1135;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1131;
					this.match(SolidCashParser.T__4);
					this.state = 1132;
					this.expression(0);
					}
					}
					this.state = 1137;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1138;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1140;
				this.match(SolidCashParser.T__74);
				this.state = 1141;
				this.match(SolidCashParser.T__48);
				this.state = 1142;
				this.expression(0);
				this.state = 1147;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 125, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1143;
						this.match(SolidCashParser.T__4);
						this.state = 1144;
						this.expression(0);
						}
						}
					}
					this.state = 1149;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 125, this._ctx);
				}
				this.state = 1151;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1150;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1153;
				this.match(SolidCashParser.T__49);
				this.state = 1154;
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
			this.state = 1203;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 133, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1158;
				this.match(SolidCashParser.Identifier);
				this.state = 1161;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1159;
					this.match(SolidCashParser.T__11);
					this.state = 1160;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1163;
				this.match(SolidCashParser.T__48);
				this.state = 1164;
				this.match(SolidCashParser.T__3);
				this.state = 1176;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 1165;
					this.namedArg();
					this.state = 1170;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 129, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1166;
							this.match(SolidCashParser.T__4);
							this.state = 1167;
							this.namedArg();
							}
							}
						}
						this.state = 1172;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 129, this._ctx);
					}
					this.state = 1174;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1173;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1178;
				this.match(SolidCashParser.T__5);
				this.state = 1179;
				this.match(SolidCashParser.T__49);
				this.state = 1180;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1181;
				this.match(SolidCashParser.Identifier);
				this.state = 1182;
				this.expressionList();
				this.state = 1183;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1185;
				this.match(SolidCashParser.Identifier);
				this.state = 1186;
				this.match(SolidCashParser.T__11);
				this.state = 1187;
				this.match(SolidCashParser.Identifier);
				this.state = 1188;
				this.expressionList();
				this.state = 1189;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1191;
				this.match(SolidCashParser.Identifier);
				this.state = 1192;
				this.expressionList();
				this.state = 1193;
				this.match(SolidCashParser.T__11);
				this.state = 1194;
				this.match(SolidCashParser.Identifier);
				this.state = 1195;
				this.match(SolidCashParser.T__11);
				this.state = 1196;
				this.match(SolidCashParser.Identifier);
				this.state = 1198;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1197;
					this.callOptions();
					}
				}

				this.state = 1200;
				this.expressionList();
				this.state = 1201;
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
			this.state = 1205;
			this.expression(0);
			this.state = 1206;
			this.match(SolidCashParser.T__11);
			this.state = 1207;
			this.match(SolidCashParser.Identifier);
			this.state = 1209;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===4) {
				{
				this.state = 1208;
				this.callOptions();
				}
			}

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
	public selfdestructStatement(): SelfdestructStatementContext {
		let localctx: SelfdestructStatementContext = new SelfdestructStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 122, SolidCashParser.RULE_selfdestructStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1214;
			this.match(SolidCashParser.T__30);
			this.state = 1215;
			this.match(SolidCashParser.T__48);
			this.state = 1216;
			this.expression(0);
			this.state = 1217;
			this.match(SolidCashParser.T__49);
			this.state = 1218;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1253;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 140, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1220;
				this.match(SolidCashParser.T__75);
				this.state = 1221;
				this.match(SolidCashParser.Identifier);
				this.state = 1224;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1222;
					this.match(SolidCashParser.T__11);
					this.state = 1223;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1226;
				this.match(SolidCashParser.T__48);
				this.state = 1227;
				this.match(SolidCashParser.T__3);
				this.state = 1239;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 1228;
					this.namedArg();
					this.state = 1233;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 136, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1229;
							this.match(SolidCashParser.T__4);
							this.state = 1230;
							this.namedArg();
							}
							}
						}
						this.state = 1235;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 136, this._ctx);
					}
					this.state = 1237;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1236;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1241;
				this.match(SolidCashParser.T__5);
				this.state = 1242;
				this.match(SolidCashParser.T__49);
				this.state = 1243;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1244;
				this.match(SolidCashParser.T__75);
				this.state = 1245;
				this.match(SolidCashParser.Identifier);
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
				this.expressionList();
				this.state = 1251;
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
			this.state = 1379;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 155, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1255;
				this.match(SolidCashParser.T__73);
				this.state = 1256;
				this.match(SolidCashParser.T__11);
				this.state = 1257;
				this.match(SolidCashParser.Identifier);
				this.state = 1266;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===66) {
					{
					this.state = 1262;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1258;
						this.match(SolidCashParser.T__65);
						this.state = 1259;
						this.expression(0);
						this.state = 1260;
						this.match(SolidCashParser.T__66);
						}
						}
						this.state = 1264;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===66);
					}
				}

				this.state = 1272;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12) {
					{
					{
					this.state = 1268;
					this.match(SolidCashParser.T__11);
					this.state = 1269;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1274;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1275;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1276;
				this.expression(0);
				this.state = 1277;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1279;
				this.match(SolidCashParser.Identifier);
				this.state = 1284;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
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
					this.state = 1286;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1292;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12) {
					{
					{
					this.state = 1288;
					this.match(SolidCashParser.T__11);
					this.state = 1289;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1294;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1295;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1296;
				this.expression(0);
				this.state = 1297;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1299;
				this.match(SolidCashParser.Identifier);
				this.state = 1302;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1300;
					this.match(SolidCashParser.T__11);
					this.state = 1301;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1304;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1306;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1307;
				this.expression(0);
				this.state = 1308;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1310;
				this.match(SolidCashParser.Identifier);
				this.state = 1313;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1311;
					this.match(SolidCashParser.T__11);
					this.state = 1312;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1315;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1321;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1317;
					this.match(SolidCashParser.T__65);
					this.state = 1318;
					this.expression(0);
					this.state = 1319;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1323;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1325;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1326;
				this.expression(0);
				this.state = 1327;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1329;
				this.match(SolidCashParser.T__73);
				this.state = 1330;
				this.match(SolidCashParser.T__11);
				this.state = 1331;
				this.match(SolidCashParser.Identifier);
				this.state = 1340;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===66) {
					{
					this.state = 1336;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1332;
						this.match(SolidCashParser.T__65);
						this.state = 1333;
						this.expression(0);
						this.state = 1334;
						this.match(SolidCashParser.T__66);
						}
						}
						this.state = 1338;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===66);
					}
				}

				this.state = 1346;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12) {
					{
					{
					this.state = 1342;
					this.match(SolidCashParser.T__11);
					this.state = 1343;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1348;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1349;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1350;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1351;
				this.match(SolidCashParser.Identifier);
				this.state = 1356;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1352;
					this.match(SolidCashParser.T__65);
					this.state = 1353;
					this.expression(0);
					this.state = 1354;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1358;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1364;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12) {
					{
					{
					this.state = 1360;
					this.match(SolidCashParser.T__11);
					this.state = 1361;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1366;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1367;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1368;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1370;
				this.match(SolidCashParser.Identifier);
				this.state = 1373;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1371;
					this.match(SolidCashParser.T__11);
					this.state = 1372;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1375;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1377;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1378;
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
			this.state = 1381;
			this.match(SolidCashParser.T__73);
			this.state = 1382;
			this.match(SolidCashParser.T__11);
			this.state = 1383;
			this.match(SolidCashParser.Identifier);
			this.state = 1390;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===66) {
				{
				{
				this.state = 1384;
				this.match(SolidCashParser.T__65);
				this.state = 1385;
				this.expression(0);
				this.state = 1386;
				this.match(SolidCashParser.T__66);
				}
				}
				this.state = 1392;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1393;
			this.match(SolidCashParser.DotDelete);
			this.state = 1394;
			this.match(SolidCashParser.T__48);
			this.state = 1395;
			this.expression(0);
			this.state = 1396;
			this.match(SolidCashParser.T__49);
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
	public variableDefinition(): VariableDefinitionContext {
		let localctx: VariableDefinitionContext = new VariableDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 130, SolidCashParser.RULE_variableDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1427;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 161, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1399;
				this.typeName();
				this.state = 1403;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 157, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1400;
						this.modifier();
						}
						}
					}
					this.state = 1405;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 157, this._ctx);
				}
				this.state = 1406;
				this.anyIdentifier();
				this.state = 1409;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1407;
					this.match(SolidCashParser.T__39);
					this.state = 1408;
					this.expression(0);
					}
				}

				this.state = 1411;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1413;
				this.arrayType(0);
				this.state = 1417;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 159, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1414;
						this.modifier();
						}
						}
					}
					this.state = 1419;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 159, this._ctx);
				}
				this.state = 1420;
				this.anyIdentifier();
				this.state = 1423;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1421;
					this.match(SolidCashParser.T__39);
					this.state = 1422;
					this.expression(0);
					}
				}

				this.state = 1425;
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
			this.state = 1477;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 166, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1429;
				this.typeName();
				this.state = 1430;
				this.match(SolidCashParser.Identifier);
				this.state = 1435;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1431;
					this.match(SolidCashParser.T__4);
					this.state = 1432;
					this.typeName();
					this.state = 1433;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1437;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1439;
				this.match(SolidCashParser.T__39);
				this.state = 1440;
				this.expression(0);
				this.state = 1441;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1443;
				this.match(SolidCashParser.T__48);
				this.state = 1444;
				this.tupleSlot();
				this.state = 1447;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1445;
					this.match(SolidCashParser.T__4);
					this.state = 1446;
					this.tupleSlot();
					}
					}
					this.state = 1449;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1451;
				this.match(SolidCashParser.T__49);
				this.state = 1452;
				this.match(SolidCashParser.T__39);
				this.state = 1453;
				this.match(SolidCashParser.T__48);
				this.state = 1454;
				this.expression(0);
				this.state = 1457;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1455;
					this.match(SolidCashParser.T__4);
					this.state = 1456;
					this.expression(0);
					}
					}
					this.state = 1459;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1461;
				this.match(SolidCashParser.T__49);
				this.state = 1462;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1464;
				this.match(SolidCashParser.T__48);
				this.state = 1465;
				this.tupleSlot();
				this.state = 1468;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1466;
					this.match(SolidCashParser.T__4);
					this.state = 1467;
					this.tupleSlot();
					}
					}
					this.state = 1470;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1472;
				this.match(SolidCashParser.T__49);
				this.state = 1473;
				this.match(SolidCashParser.T__39);
				this.state = 1474;
				this.expression(0);
				this.state = 1475;
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
			this.state = 1490;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 168, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1479;
				this.typeName();
				this.state = 1483;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 128)) & ~0x1F) === 0 && ((1 << (_la - 128)) & 31) !== 0)) {
					{
					{
					this.state = 1480;
					this.modifier();
					}
					}
					this.state = 1485;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1486;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1488;
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
			this.state = 1503;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 169, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1492;
				this.match(SolidCashParser.Identifier);
				this.state = 1493;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1494;
				this.expression(0);
				this.state = 1495;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1497;
				this.match(SolidCashParser.Identifier);
				this.state = 1498;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1499;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1500;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1501;
				this.match(SolidCashParser.Identifier);
				this.state = 1502;
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
			this.state = 1521;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 170, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1505;
				this.match(SolidCashParser.Identifier);
				this.state = 1506;
				this.match(SolidCashParser.DotPush);
				this.state = 1507;
				this.match(SolidCashParser.T__48);
				this.state = 1508;
				this.expression(0);
				this.state = 1509;
				this.match(SolidCashParser.T__49);
				this.state = 1510;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1512;
				this.match(SolidCashParser.Identifier);
				this.state = 1513;
				this.match(SolidCashParser.T__11);
				this.state = 1514;
				this.match(SolidCashParser.Identifier);
				this.state = 1515;
				this.match(SolidCashParser.DotPush);
				this.state = 1516;
				this.match(SolidCashParser.T__48);
				this.state = 1517;
				this.expression(0);
				this.state = 1518;
				this.match(SolidCashParser.T__49);
				this.state = 1519;
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
	public arrayPopStatement(): ArrayPopStatementContext {
		let localctx: ArrayPopStatementContext = new ArrayPopStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 140, SolidCashParser.RULE_arrayPopStatement);
		try {
			this.state = 1535;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 171, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1523;
				this.match(SolidCashParser.Identifier);
				this.state = 1524;
				this.match(SolidCashParser.DotPop);
				this.state = 1525;
				this.match(SolidCashParser.T__48);
				this.state = 1526;
				this.match(SolidCashParser.T__49);
				this.state = 1527;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1528;
				this.match(SolidCashParser.Identifier);
				this.state = 1529;
				this.match(SolidCashParser.T__11);
				this.state = 1530;
				this.match(SolidCashParser.Identifier);
				this.state = 1531;
				this.match(SolidCashParser.DotPop);
				this.state = 1532;
				this.match(SolidCashParser.T__48);
				this.state = 1533;
				this.match(SolidCashParser.T__49);
				this.state = 1534;
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
	public arrayDeleteStatement(): ArrayDeleteStatementContext {
		let localctx: ArrayDeleteStatementContext = new ArrayDeleteStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 142, SolidCashParser.RULE_arrayDeleteStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1537;
			this.match(SolidCashParser.Identifier);
			this.state = 1538;
			this.match(SolidCashParser.DotDelete);
			this.state = 1539;
			this.match(SolidCashParser.T__48);
			this.state = 1540;
			this.expression(0);
			this.state = 1541;
			this.match(SolidCashParser.T__49);
			this.state = 1542;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1544;
			this.match(SolidCashParser.T__73);
			this.state = 1545;
			this.match(SolidCashParser.T__11);
			this.state = 1546;
			this.match(SolidCashParser.Identifier);
			this.state = 1547;
			this.match(SolidCashParser.DotPush);
			this.state = 1548;
			this.match(SolidCashParser.T__48);
			this.state = 1549;
			this.expression(0);
			this.state = 1550;
			this.match(SolidCashParser.T__49);
			this.state = 1551;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1553;
			this.match(SolidCashParser.T__73);
			this.state = 1554;
			this.match(SolidCashParser.T__11);
			this.state = 1555;
			this.match(SolidCashParser.Identifier);
			this.state = 1556;
			this.match(SolidCashParser.DotPop);
			this.state = 1557;
			this.match(SolidCashParser.T__48);
			this.state = 1558;
			this.match(SolidCashParser.T__49);
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
	public deleteStatement(): DeleteStatementContext {
		let localctx: DeleteStatementContext = new DeleteStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 148, SolidCashParser.RULE_deleteStatement);
		let _la: number;
		try {
			this.state = 1595;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 174, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1561;
				this.match(SolidCashParser.T__88);
				this.state = 1562;
				this.match(SolidCashParser.Identifier);
				this.state = 1563;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1564;
				this.match(SolidCashParser.T__88);
				this.state = 1565;
				this.match(SolidCashParser.T__73);
				this.state = 1566;
				this.match(SolidCashParser.T__11);
				this.state = 1567;
				this.match(SolidCashParser.Identifier);
				this.state = 1568;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1569;
				this.match(SolidCashParser.T__88);
				this.state = 1570;
				this.match(SolidCashParser.T__73);
				this.state = 1571;
				this.match(SolidCashParser.T__11);
				this.state = 1572;
				this.match(SolidCashParser.Identifier);
				this.state = 1577;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1573;
					this.match(SolidCashParser.T__65);
					this.state = 1574;
					this.expression(0);
					this.state = 1575;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1579;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1581;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1583;
				this.match(SolidCashParser.T__88);
				this.state = 1584;
				this.match(SolidCashParser.Identifier);
				this.state = 1589;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1585;
					this.match(SolidCashParser.T__65);
					this.state = 1586;
					this.expression(0);
					this.state = 1587;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1591;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1593;
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
			this.state = 1597;
			this.match(SolidCashParser.T__89);
			this.state = 1598;
			this.match(SolidCashParser.T__48);
			this.state = 1599;
			this.match(SolidCashParser.TxVar);
			this.state = 1600;
			this.match(SolidCashParser.T__22);
			this.state = 1601;
			this.expression(0);
			this.state = 1604;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1602;
				this.match(SolidCashParser.T__4);
				this.state = 1603;
				this.requireMessage();
				}
			}

			this.state = 1606;
			this.match(SolidCashParser.T__49);
			this.state = 1607;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1609;
			this.match(SolidCashParser.T__89);
			this.state = 1610;
			this.match(SolidCashParser.T__48);
			this.state = 1611;
			this.expression(0);
			this.state = 1614;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1612;
				this.match(SolidCashParser.T__4);
				this.state = 1613;
				this.requireMessage();
				}
			}

			this.state = 1616;
			this.match(SolidCashParser.T__49);
			this.state = 1617;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1619;
			this.match(SolidCashParser.T__90);
			this.state = 1620;
			this.match(SolidCashParser.T__48);
			this.state = 1621;
			this.expression(0);
			this.state = 1622;
			this.match(SolidCashParser.T__49);
			this.state = 1623;
			localctx._ifBlock = this.block();
			this.state = 1626;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 177, this._ctx) ) {
			case 1:
				{
				this.state = 1624;
				this.match(SolidCashParser.T__91);
				this.state = 1625;
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
			this.state = 1634;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 178, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1628;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1629;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1630;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1631;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1632;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1633;
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
			this.state = 1636;
			this.match(SolidCashParser.T__8);
			this.state = 1637;
			this.match(SolidCashParser.T__48);
			this.state = 1638;
			this.typeName();
			this.state = 1639;
			this.match(SolidCashParser.Identifier);
			this.state = 1640;
			this.match(SolidCashParser.T__4);
			this.state = 1641;
			this.typeName();
			this.state = 1642;
			this.match(SolidCashParser.Identifier);
			this.state = 1643;
			this.match(SolidCashParser.T__92);
			this.state = 1644;
			this.match(SolidCashParser.T__73);
			this.state = 1645;
			this.match(SolidCashParser.T__11);
			this.state = 1646;
			this.match(SolidCashParser.Identifier);
			this.state = 1647;
			this.match(SolidCashParser.T__11);
			this.state = 1648;
			this.match(SolidCashParser.T__33);
			this.state = 1649;
			this.match(SolidCashParser.T__49);
			this.state = 1650;
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
			this.state = 1652;
			this.match(SolidCashParser.T__8);
			this.state = 1653;
			this.match(SolidCashParser.T__48);
			this.state = 1654;
			this.typeName();
			this.state = 1655;
			this.match(SolidCashParser.Identifier);
			this.state = 1656;
			this.match(SolidCashParser.T__93);
			this.state = 1657;
			this.match(SolidCashParser.T__73);
			this.state = 1658;
			this.match(SolidCashParser.T__11);
			this.state = 1659;
			this.match(SolidCashParser.Identifier);
			this.state = 1660;
			this.match(SolidCashParser.T__49);
			this.state = 1661;
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
			this.state = 1663;
			this.match(SolidCashParser.T__8);
			this.state = 1664;
			this.match(SolidCashParser.T__48);
			this.state = 1665;
			this.typeName();
			this.state = 1666;
			this.match(SolidCashParser.Identifier);
			this.state = 1667;
			this.match(SolidCashParser.T__92);
			this.state = 1668;
			this.match(SolidCashParser.T__73);
			this.state = 1669;
			this.match(SolidCashParser.T__11);
			this.state = 1670;
			this.match(SolidCashParser.Identifier);
			this.state = 1671;
			this.match(SolidCashParser.T__49);
			this.state = 1672;
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
			this.state = 1674;
			this.match(SolidCashParser.T__8);
			this.state = 1675;
			this.match(SolidCashParser.T__48);
			this.state = 1676;
			this.forInit();
			this.state = 1677;
			this.forCondition();
			this.state = 1679;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===87 || _la===88 || _la===176) {
				{
				this.state = 1678;
				this.forUpdate();
				}
			}

			this.state = 1681;
			this.match(SolidCashParser.T__49);
			this.state = 1682;
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
			this.state = 1684;
			this.typeName();
			this.state = 1688;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===33 || _la===56 || ((((_la - 128)) & ~0x1F) === 0 && ((1 << (_la - 128)) & 31) !== 0)) {
				{
				{
				this.state = 1685;
				this.modifier();
				}
				}
				this.state = 1690;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1691;
			this.match(SolidCashParser.Identifier);
			this.state = 1694;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 1692;
				this.match(SolidCashParser.T__39);
				this.state = 1693;
				this.expression(0);
				}
			}

			this.state = 1696;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1698;
			this.expression(0);
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
	public forUpdate(): ForUpdateContext {
		let localctx: ForUpdateContext = new ForUpdateContext(this, this._ctx, this.state);
		this.enterRule(localctx, 170, SolidCashParser.RULE_forUpdate);
		let _la: number;
		try {
			this.state = 1708;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 182, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1701;
				this.match(SolidCashParser.Identifier);
				this.state = 1702;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1703;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1704;
				this.match(SolidCashParser.Identifier);
				this.state = 1705;
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
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1706;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1707;
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
	public doWhileStatement(): DoWhileStatementContext {
		let localctx: DoWhileStatementContext = new DoWhileStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 172, SolidCashParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1710;
			this.match(SolidCashParser.T__94);
			this.state = 1711;
			this.block();
			this.state = 1712;
			this.match(SolidCashParser.T__95);
			this.state = 1713;
			this.match(SolidCashParser.T__48);
			this.state = 1714;
			this.expression(0);
			this.state = 1715;
			this.match(SolidCashParser.T__49);
			this.state = 1716;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1718;
			this.match(SolidCashParser.T__95);
			this.state = 1719;
			this.match(SolidCashParser.T__48);
			this.state = 1720;
			this.expression(0);
			this.state = 1721;
			this.match(SolidCashParser.T__49);
			this.state = 1722;
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
			this.state = 1724;
			this.match(SolidCashParser.T__96);
			this.state = 1725;
			this.consoleParameterList();
			this.state = 1726;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1728;
			this.match(SolidCashParser.T__97);
			this.state = 1729;
			this.match(SolidCashParser.T__3);
			this.state = 1733;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===141 || _la===149 || _la===176) {
				{
				{
				this.state = 1730;
				this.assemblyToken();
				}
				}
				this.state = 1735;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1736;
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
			this.state = 1738;
			_la = this._input.LA(1);
			if(!(_la===141 || _la===149 || _la===176)) {
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
			this.state = 1740;
			this.match(SolidCashParser.T__98);
			this.state = 1741;
			this.match(SolidCashParser.T__3);
			this.state = 1745;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4294590239) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2012594187) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 33554687) !== 0)) {
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
			this.state = 1748;
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
			this.state = 1750;
			this.match(SolidCashParser.T__99);
			this.state = 1751;
			this.match(SolidCashParser.T__48);
			this.state = 1752;
			this.expression(0);
			this.state = 1753;
			this.match(SolidCashParser.T__49);
			this.state = 1754;
			this.match(SolidCashParser.T__3);
			this.state = 1758;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===101) {
				{
				{
				this.state = 1755;
				this.switchCase();
				}
				}
				this.state = 1760;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1762;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===103) {
				{
				this.state = 1761;
				this.switchDefault();
				}
			}

			this.state = 1764;
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
			this.state = 1766;
			this.match(SolidCashParser.T__100);
			this.state = 1767;
			this.expression(0);
			this.state = 1768;
			this.match(SolidCashParser.T__101);
			this.state = 1772;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4294590239) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2012594187) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 33554687) !== 0)) {
				{
				{
				this.state = 1769;
				this.statement();
				}
				}
				this.state = 1774;
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
			this.state = 1775;
			this.match(SolidCashParser.T__102);
			this.state = 1776;
			this.match(SolidCashParser.T__101);
			this.state = 1780;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4294590239) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2012594187) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 33554687) !== 0)) {
				{
				{
				this.state = 1777;
				this.statement();
				}
				}
				this.state = 1782;
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
			this.state = 1783;
			this.match(SolidCashParser.T__103);
			this.state = 1784;
			this.expression(0);
			this.state = 1786;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 1785;
				this.tryReturns();
				}
			}

			this.state = 1788;
			localctx._tryBlock = this.block();
			this.state = 1790;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1789;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1792;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 190, this._ctx);
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
			this.state = 1794;
			this.match(SolidCashParser.T__72);
			this.state = 1795;
			this.match(SolidCashParser.T__48);
			this.state = 1807;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 7872007) !== 0) || _la===176) {
				{
				this.state = 1796;
				this.parameter();
				this.state = 1801;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 191, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1797;
						this.match(SolidCashParser.T__4);
						this.state = 1798;
						this.parameter();
						}
						}
					}
					this.state = 1803;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 191, this._ctx);
				}
				this.state = 1805;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1804;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1809;
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
			this.state = 1811;
			this.match(SolidCashParser.T__104);
			this.state = 1813;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 194, this._ctx) ) {
			case 1:
				{
				this.state = 1812;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 1830;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 198, this._ctx) ) {
			case 1:
				{
				this.state = 1815;
				this.match(SolidCashParser.T__48);
				this.state = 1827;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || _la===64 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 7872007) !== 0) || _la===176) {
					{
					this.state = 1816;
					this.parameter();
					this.state = 1821;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 195, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1817;
							this.match(SolidCashParser.T__4);
							this.state = 1818;
							this.parameter();
							}
							}
						}
						this.state = 1823;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 195, this._ctx);
					}
					this.state = 1825;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1824;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1829;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
			this.state = 1832;
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
			this.state = 1834;
			this.match(SolidCashParser.T__105);
			this.state = 1835;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1837;
			this.match(SolidCashParser.T__106);
			this.state = 1838;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1843;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 147:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1840;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 176:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1841;
				this.match(SolidCashParser.Identifier);
				this.state = 1842;
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
			this.state = 1887;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 205, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1845;
				this.match(SolidCashParser.T__35);
				this.state = 1846;
				this.match(SolidCashParser.Identifier);
				this.state = 1849;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1847;
					this.match(SolidCashParser.T__11);
					this.state = 1848;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1851;
				this.match(SolidCashParser.T__48);
				this.state = 1852;
				this.match(SolidCashParser.T__3);
				this.state = 1864;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 1853;
					this.namedArg();
					this.state = 1858;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 201, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1854;
							this.match(SolidCashParser.T__4);
							this.state = 1855;
							this.namedArg();
							}
							}
						}
						this.state = 1860;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 201, this._ctx);
					}
					this.state = 1862;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1861;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1866;
				this.match(SolidCashParser.T__5);
				this.state = 1867;
				this.match(SolidCashParser.T__49);
				this.state = 1868;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1869;
				this.match(SolidCashParser.T__35);
				this.state = 1870;
				this.match(SolidCashParser.Identifier);
				this.state = 1873;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1871;
					this.match(SolidCashParser.T__11);
					this.state = 1872;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1875;
				this.expressionList();
				this.state = 1876;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1878;
				this.match(SolidCashParser.T__35);
				this.state = 1879;
				this.match(SolidCashParser.T__48);
				this.state = 1880;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1881;
				this.match(SolidCashParser.T__49);
				this.state = 1882;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1883;
				this.match(SolidCashParser.T__35);
				this.state = 1884;
				this.match(SolidCashParser.T__48);
				this.state = 1885;
				this.match(SolidCashParser.T__49);
				this.state = 1886;
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
			this.state = 1889;
			this.match(SolidCashParser.T__107);
			this.state = 1890;
			this.match(SolidCashParser.T__48);
			this.state = 1891;
			this.expression(0);
			this.state = 1892;
			this.match(SolidCashParser.T__49);
			this.state = 1893;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1897;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 176:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1895;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 137:
			case 140:
			case 141:
			case 147:
			case 148:
			case 149:
			case 157:
			case 158:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1896;
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
			this.state = 1899;
			this.match(SolidCashParser.T__48);
			this.state = 1911;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 137)) & ~0x1F) === 0 && ((1 << (_la - 137)) & 3152921) !== 0) || _la===176) {
				{
				this.state = 1900;
				this.consoleParameter();
				this.state = 1905;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 207, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1901;
						this.match(SolidCashParser.T__4);
						this.state = 1902;
						this.consoleParameter();
						}
						}
					}
					this.state = 1907;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 207, this._ctx);
				}
				this.state = 1909;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1908;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1913;
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
			this.state = 1939;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 213, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1915;
				this.match(SolidCashParser.Identifier);
				this.state = 1916;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1917;
				this.match(SolidCashParser.Identifier);
				this.state = 1918;
				this.match(SolidCashParser.T__11);
				this.state = 1919;
				this.match(SolidCashParser.Identifier);
				this.state = 1920;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1921;
				this.match(SolidCashParser.Identifier);
				this.state = 1922;
				this.match(SolidCashParser.T__48);
				this.state = 1923;
				this.match(SolidCashParser.T__3);
				this.state = 1935;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===176) {
					{
					this.state = 1924;
					this.namedArg();
					this.state = 1929;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 210, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1925;
							this.match(SolidCashParser.T__4);
							this.state = 1926;
							this.namedArg();
							}
							}
						}
						this.state = 1931;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 210, this._ctx);
					}
					this.state = 1933;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1932;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1937;
				this.match(SolidCashParser.T__5);
				this.state = 1938;
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
			this.state = 1941;
			this.match(SolidCashParser.Identifier);
			this.state = 1942;
			this.match(SolidCashParser.T__101);
			this.state = 1943;
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
			this.state = 1945;
			this.match(SolidCashParser.T__48);
			this.state = 1957;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 3607113727) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 261599) !== 0) || _la===176) {
				{
				this.state = 1946;
				this.expression(0);
				this.state = 1951;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 214, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1947;
						this.match(SolidCashParser.T__4);
						this.state = 1948;
						this.expression(0);
						}
						}
					}
					this.state = 1953;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 214, this._ctx);
				}
				this.state = 1955;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1954;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1959;
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
			this.state = 1961;
			this.match(SolidCashParser.T__3);
			this.state = 1962;
			this.callOption();
			this.state = 1967;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 217, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1963;
					this.match(SolidCashParser.T__4);
					this.state = 1964;
					this.callOption();
					}
					}
				}
				this.state = 1969;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 217, this._ctx);
			}
			this.state = 1971;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1970;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1973;
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
			this.state = 1975;
			this.match(SolidCashParser.Identifier);
			this.state = 1976;
			this.match(SolidCashParser.T__101);
			this.state = 1977;
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
			this.state = 1979;
			this.match(SolidCashParser.T__48);
			this.state = 1980;
			this.typeName();
			this.state = 1985;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 219, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1981;
					this.match(SolidCashParser.T__4);
					this.state = 1982;
					this.typeName();
					}
					}
				}
				this.state = 1987;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 219, this._ctx);
			}
			this.state = 1989;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1988;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1991;
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
			this.state = 2138;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 228, this._ctx) ) {
			case 1:
				{
				localctx = new AssignmentExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 1994;
				this.match(SolidCashParser.T__48);
				this.state = 1995;
				this.match(SolidCashParser.Identifier);
				this.state = 1996;
				(localctx as AssignmentExpressionContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    (localctx as AssignmentExpressionContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1997;
				this.expression(0);
				this.state = 1998;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2000;
				this.match(SolidCashParser.T__48);
				this.state = 2001;
				this.expression(0);
				this.state = 2002;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				{
				localctx = new TupleExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2004;
				this.match(SolidCashParser.T__48);
				this.state = 2005;
				this.expression(0);
				this.state = 2008;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2006;
					this.match(SolidCashParser.T__4);
					this.state = 2007;
					this.expression(0);
					}
					}
					this.state = 2010;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2012;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 4:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2014;
				this.typeCast();
				this.state = 2015;
				this.match(SolidCashParser.T__48);
				this.state = 2016;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 2018;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2017;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 2020;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 5:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2022;
				this.functionCall();
				}
				break;
			case 6:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2023;
				this.match(SolidCashParser.T__108);
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
				this.expressionList();
				}
				break;
			case 7:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2029;
				this.match(SolidCashParser.T__108);
				this.state = 2030;
				this.typeName();
				this.state = 2031;
				this.match(SolidCashParser.T__65);
				this.state = 2032;
				this.match(SolidCashParser.T__66);
				this.state = 2033;
				this.match(SolidCashParser.T__48);
				this.state = 2034;
				this.expression(0);
				this.state = 2035;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 8:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2037;
				this.match(SolidCashParser.T__54);
				this.state = 2038;
				this.match(SolidCashParser.T__48);
				this.state = 2039;
				this.typeName();
				this.state = 2040;
				this.match(SolidCashParser.T__49);
				this.state = 2041;
				this.match(SolidCashParser.T__11);
				this.state = 2042;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 9:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2044;
				this.match(SolidCashParser.T__109);
				this.state = 2045;
				this.expressionList();
				}
				break;
			case 10:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2046;
				this.match(SolidCashParser.T__110);
				this.state = 2047;
				this.expressionList();
				}
				break;
			case 11:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2048;
				this.match(SolidCashParser.T__111);
				this.state = 2049;
				this.expressionList();
				}
				break;
			case 12:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2050;
				this.match(SolidCashParser.T__112);
				this.state = 2051;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2052;
				this.match(SolidCashParser.T__113);
				this.state = 2053;
				this.match(SolidCashParser.T__48);
				this.state = 2054;
				this.match(SolidCashParser.Identifier);
				this.state = 2055;
				this.match(SolidCashParser.T__11);
				this.state = 2056;
				this.match(SolidCashParser.Identifier);
				this.state = 2057;
				this.match(SolidCashParser.T__4);
				this.state = 2058;
				this.expressionList();
				this.state = 2059;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 14:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2061;
				this.match(SolidCashParser.T__114);
				this.state = 2062;
				this.expressionList();
				}
				break;
			case 15:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2063;
				this.match(SolidCashParser.T__115);
				this.state = 2064;
				this.expressionList();
				}
				break;
			case 16:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2065;
				this.match(SolidCashParser.T__116);
				this.state = 2066;
				this.match(SolidCashParser.T__48);
				this.state = 2067;
				this.expression(0);
				this.state = 2068;
				this.match(SolidCashParser.T__4);
				this.state = 2069;
				this.typeList();
				this.state = 2070;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 17:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2072;
				this.match(SolidCashParser.T__117);
				this.state = 2073;
				this.match(SolidCashParser.T__48);
				this.state = 2074;
				this.expression(0);
				this.state = 2075;
				this.match(SolidCashParser.T__4);
				this.state = 2076;
				this.typeList();
				this.state = 2077;
				this.match(SolidCashParser.T__4);
				this.state = 2078;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 2079;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 18:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2081;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__118);
				this.state = 2082;
				this.match(SolidCashParser.T__65);
				this.state = 2083;
				this.expression(0);
				this.state = 2084;
				this.match(SolidCashParser.T__66);
				this.state = 2085;
				(localctx as UnaryIntrospectionOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 159)) & ~0x1F) === 0 && ((1 << (_la - 159)) & 7681) !== 0))) {
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
				this.state = 2087;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__119);
				this.state = 2088;
				this.match(SolidCashParser.T__65);
				this.state = 2089;
				this.expression(0);
				this.state = 2090;
				this.match(SolidCashParser.T__66);
				this.state = 2091;
				(localctx as UnaryIntrospectionOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 159)) & ~0x1F) === 0 && ((1 << (_la - 159)) & 130561) !== 0))) {
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
				this.state = 2093;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===122)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2094;
				this.expression(21);
				}
				break;
			case 21:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2095;
				this.match(SolidCashParser.T__65);
				this.state = 2107;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 3607113727) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 261599) !== 0) || _la===176) {
					{
					this.state = 2096;
					this.expression(0);
					this.state = 2101;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 224, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2097;
							this.match(SolidCashParser.T__4);
							this.state = 2098;
							this.expression(0);
							}
							}
						}
						this.state = 2103;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 224, this._ctx);
					}
					this.state = 2105;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2104;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2109;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 22:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2110;
				this.match(SolidCashParser.T__73);
				this.state = 2111;
				this.match(SolidCashParser.T__11);
				this.state = 2112;
				this.match(SolidCashParser.Identifier);
				this.state = 2113;
				this.match(SolidCashParser.T__11);
				this.state = 2114;
				this.match(SolidCashParser.Identifier);
				this.state = 2115;
				this.match(SolidCashParser.T__65);
				this.state = 2116;
				this.expression(0);
				this.state = 2117;
				this.match(SolidCashParser.T__66);
				this.state = 2118;
				this.memberName();
				}
				break;
			case 23:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2120;
				this.match(SolidCashParser.T__73);
				this.state = 2121;
				this.match(SolidCashParser.T__11);
				this.state = 2122;
				this.match(SolidCashParser.Identifier);
				this.state = 2127;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2123;
						this.match(SolidCashParser.T__65);
						this.state = 2124;
						this.expression(0);
						this.state = 2125;
						this.match(SolidCashParser.T__66);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2129;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 227, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 24:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2131;
				this.match(SolidCashParser.T__73);
				this.state = 2132;
				this.match(SolidCashParser.T__11);
				this.state = 2133;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 25:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2134;
				this.match(SolidCashParser.T__73);
				}
				break;
			case 26:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2135;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 27:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2136;
				this.anyIdentifier();
				}
				break;
			case 28:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2137;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2245;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 235, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2243;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 234, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2140;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 2141;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 2142;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2143;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 2144;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2145;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2146;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 2147;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2148;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2149;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 2150;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===123 || _la===124)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2151;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2152;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 2153;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2154;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2155;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2156;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2157;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2158;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2159;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2160;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2161;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2162;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2163;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2164;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2165;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2166;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2167;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2168;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__124);
						this.state = 2169;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2170;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2171;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__125);
						this.state = 2172;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2173;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 2174;
						this.match(SolidCashParser.T__126);
						this.state = 2175;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 2176;
						this.match(SolidCashParser.T__101);
						this.state = 2177;
						(localctx as TernaryOpContext)._ifFalse = this.expression(9);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2179;
						if (!(this.precpred(this._ctx, 32))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 32)");
						}
						this.state = 2180;
						this.match(SolidCashParser.T__65);
						this.state = 2181;
						(localctx as IndexRangeSliceContext)._start = this.expression(0);
						this.state = 2182;
						this.match(SolidCashParser.T__101);
						this.state = 2183;
						(localctx as IndexRangeSliceContext)._end = this.expression(0);
						this.state = 2184;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2186;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 2187;
						this.match(SolidCashParser.T__65);
						this.state = 2188;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2189;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2190;
						if (!(this.precpred(this._ctx, 30))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 30)");
						}
						this.state = 2191;
						this.match(SolidCashParser.T__65);
						this.state = 2192;
						this.expression(0);
						this.state = 2193;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2195;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2196;
						(localctx as UnaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===121 || _la===160)) {
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
						this.state = 2197;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2198;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.DotSplit);
						this.state = 2199;
						this.match(SolidCashParser.T__48);
						this.state = 2200;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2201;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2203;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2204;
						this.match(SolidCashParser.DotSlice);
						this.state = 2205;
						this.match(SolidCashParser.T__48);
						this.state = 2206;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2207;
						this.match(SolidCashParser.T__4);
						this.state = 2208;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2209;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2211;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2212;
						this.match(SolidCashParser.T__11);
						this.state = 2213;
						this.match(SolidCashParser.Identifier);
						this.state = 2215;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2214;
							this.callOptions();
							}
						}

						this.state = 2217;
						this.match(SolidCashParser.T__48);
						this.state = 2218;
						this.match(SolidCashParser.T__3);
						this.state = 2230;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===176) {
							{
							this.state = 2219;
							this.namedArg();
							this.state = 2224;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 230, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2220;
									this.match(SolidCashParser.T__4);
									this.state = 2221;
									this.namedArg();
									}
									}
								}
								this.state = 2226;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 230, this._ctx);
							}
							this.state = 2228;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2227;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2232;
						this.match(SolidCashParser.T__5);
						this.state = 2233;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 20:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2234;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2235;
						this.match(SolidCashParser.T__11);
						this.state = 2236;
						this.match(SolidCashParser.Identifier);
						this.state = 2238;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2237;
							this.callOptions();
							}
						}

						this.state = 2240;
						this.expressionList();
						}
						break;
					case 21:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2241;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 2242;
						this.memberName();
						}
						break;
					}
					}
				}
				this.state = 2247;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 235, this._ctx);
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
			this.state = 2261;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2248;
				this.match(SolidCashParser.T__11);
				this.state = 2249;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 159:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2250;
				this.match(SolidCashParser.DotValue);
				}
				break;
			case 168:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2251;
				this.match(SolidCashParser.DotLockingBytecode);
				}
				break;
			case 169:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2252;
				this.match(SolidCashParser.DotTokenCategory);
				}
				break;
			case 170:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2253;
				this.match(SolidCashParser.DotNftCommitment);
				}
				break;
			case 171:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2254;
				this.match(SolidCashParser.DotTokenAmount);
				}
				break;
			case 172:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2255;
				this.match(SolidCashParser.DotOutpointTransactionHash);
				}
				break;
			case 173:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2256;
				this.match(SolidCashParser.DotOutpointIndex);
				}
				break;
			case 174:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2257;
				this.match(SolidCashParser.DotUnlockingBytecode);
				}
				break;
			case 175:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2258;
				this.match(SolidCashParser.DotSequenceNumber);
				}
				break;
			case 166:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2259;
				this.match(SolidCashParser.DotCode);
				}
				break;
			case 167:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2260;
				this.match(SolidCashParser.DotCodehash);
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
			this.state = 2263;
			_la = this._input.LA(1);
			if(!(_la===33 || _la===56 || ((((_la - 128)) & ~0x1F) === 0 && ((1 << (_la - 128)) & 31) !== 0))) {
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
			this.state = 2279;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 137:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2265;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 141:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2266;
				this.numberLiteral();
				}
				break;
			case 140:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2267;
				this.decimalLiteral();
				}
				break;
			case 147:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2268;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2272;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 237, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2269;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2274;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 237, this._ctx);
				}
				}
				break;
			case 157:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2275;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 158:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2276;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 148:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2277;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 149:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2278;
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
			this.state = 2281;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2283;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 239, this._ctx) ) {
			case 1:
				{
				this.state = 2282;
				_la = this._input.LA(1);
				if(!(_la===138 || _la===139)) {
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
			this.state = 2285;
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
			this.state = 2331;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 244, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2287;
				this.match(SolidCashParser.T__132);
				this.state = 2288;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2289;
				this.match(SolidCashParser.T__132);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2290;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2291;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2292;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2293;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2294;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2295;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2296;
				this.match(SolidCashParser.T__133);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2297;
				this.match(SolidCashParser.T__134);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2298;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2299;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2300;
				this.match(SolidCashParser.T__6);
				this.state = 2301;
				this.match(SolidCashParser.T__48);
				this.state = 2310;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 7872007) !== 0) || _la===176) {
					{
					this.state = 2302;
					this.typeName();
					this.state = 2307;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2303;
						this.match(SolidCashParser.T__4);
						this.state = 2304;
						this.typeName();
						}
						}
						this.state = 2309;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2312;
				this.match(SolidCashParser.T__49);
				this.state = 2325;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===73) {
					{
					this.state = 2313;
					this.match(SolidCashParser.T__72);
					this.state = 2314;
					this.match(SolidCashParser.T__48);
					this.state = 2315;
					this.typeName();
					this.state = 2320;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2316;
						this.match(SolidCashParser.T__4);
						this.state = 2317;
						this.typeName();
						}
						}
						this.state = 2322;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2323;
					this.match(SolidCashParser.T__49);
					}
				}

				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2327;
				this.match(SolidCashParser.Identifier);
				this.state = 2328;
				this.match(SolidCashParser.T__11);
				this.state = 2329;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 2330;
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
			this.state = 2333;
			_la = this._input.LA(1);
			if(!(_la===59 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 8134151) !== 0))) {
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

	public static readonly _serializedATN: number[] = [4,1,179,2336,2,0,7,0,
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
	498,8,18,10,18,12,18,501,9,18,1,18,5,18,504,8,18,10,18,12,18,507,9,18,1,
	18,1,18,1,19,3,19,512,8,19,1,19,1,19,1,19,3,19,517,8,19,1,19,1,19,1,19,
	1,19,5,19,523,8,19,10,19,12,19,526,9,19,3,19,528,8,19,1,19,1,19,1,19,1,
	19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,5,19,545,8,19,
	10,19,12,19,548,9,19,1,19,1,19,1,20,1,20,3,20,554,8,20,1,21,1,21,1,21,1,
	21,5,21,560,8,21,10,21,12,21,563,9,21,1,21,5,21,566,8,21,10,21,12,21,569,
	9,21,1,21,3,21,572,8,21,1,21,1,21,1,22,1,22,1,22,1,22,1,22,1,22,5,22,582,
	8,22,10,22,12,22,585,9,22,1,22,3,22,588,8,22,3,22,590,8,22,1,22,1,22,3,
	22,594,8,22,1,22,1,22,1,23,1,23,3,23,600,8,23,1,23,3,23,603,8,23,1,23,1,
	23,1,24,1,24,1,24,1,24,1,24,1,24,5,24,613,8,24,10,24,12,24,616,9,24,1,24,
	3,24,619,8,24,3,24,621,8,24,1,24,1,24,1,24,1,25,1,25,1,25,1,26,1,26,1,26,
	1,26,4,26,633,8,26,11,26,12,26,634,1,26,1,26,1,27,1,27,1,27,3,27,642,8,
	27,1,27,1,27,1,27,1,28,1,28,1,28,1,28,1,28,1,28,5,28,653,8,28,10,28,12,
	28,656,9,28,1,28,3,28,659,8,28,1,28,1,28,1,29,1,29,1,29,3,29,666,8,29,1,
	30,1,30,1,30,1,30,1,30,1,30,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,32,1,32,
	1,32,5,32,684,8,32,10,32,12,32,687,9,32,1,32,5,32,690,8,32,10,32,12,32,
	693,9,32,1,32,1,32,5,32,697,8,32,10,32,12,32,700,9,32,1,32,1,32,1,33,1,
	33,1,33,1,33,5,33,708,8,33,10,33,12,33,711,9,33,1,33,5,33,714,8,33,10,33,
	12,33,717,9,33,1,33,1,33,5,33,721,8,33,10,33,12,33,724,9,33,1,33,1,33,1,
	34,1,34,1,34,3,34,731,8,34,1,35,1,35,1,35,1,35,1,35,1,35,1,35,5,35,740,
	8,35,10,35,12,35,743,9,35,1,35,1,35,1,36,1,36,1,36,1,37,3,37,751,8,37,1,
	37,1,37,5,37,755,8,37,10,37,12,37,758,9,37,1,37,1,37,1,37,3,37,763,8,37,
	1,37,1,37,1,37,1,37,1,37,5,37,770,8,37,10,37,12,37,773,9,37,1,37,1,37,1,
	37,3,37,778,8,37,1,37,1,37,1,37,3,37,783,8,37,1,37,1,37,5,37,787,8,37,10,
	37,12,37,790,9,37,1,37,1,37,1,37,1,37,3,37,796,8,37,1,37,1,37,5,37,800,
	8,37,10,37,12,37,803,9,37,1,37,1,37,1,37,3,37,808,8,37,1,37,1,37,3,37,812,
	8,37,1,38,1,38,3,38,816,8,38,1,39,1,39,1,40,1,40,1,40,1,40,3,40,824,8,40,
	1,40,1,40,1,40,3,40,829,8,40,1,40,1,40,1,40,1,40,1,40,1,40,3,40,837,8,40,
	1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,3,40,847,8,40,1,40,1,40,1,40,3,
	40,852,8,40,1,40,1,40,3,40,856,8,40,1,41,1,41,1,41,1,41,1,41,1,41,1,41,
	1,41,1,41,1,41,3,41,868,8,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,5,41,877,
	8,41,10,41,12,41,880,9,41,1,42,1,42,1,42,3,42,885,8,42,1,42,1,42,5,42,889,
	8,42,10,42,12,42,892,9,42,1,42,1,42,1,43,1,43,3,43,898,8,43,1,44,1,44,1,
	44,1,45,1,45,1,45,1,45,5,45,907,8,45,10,45,12,45,910,9,45,1,45,5,45,913,
	8,45,10,45,12,45,916,9,45,1,45,3,45,919,8,45,1,45,1,45,5,45,923,8,45,10,
	45,12,45,926,9,45,1,45,1,45,1,46,1,46,3,46,932,8,46,1,47,1,47,1,47,1,47,
	1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,3,47,948,8,47,1,48,1,
	48,1,48,1,48,1,48,5,48,955,8,48,10,48,12,48,958,9,48,1,48,3,48,961,8,48,
	1,49,1,49,1,49,1,49,3,49,967,8,49,1,50,1,50,1,50,1,50,1,50,5,50,974,8,50,
	10,50,12,50,977,9,50,1,50,3,50,980,8,50,1,50,1,50,1,51,1,51,5,51,986,8,
	51,10,51,12,51,989,9,51,1,51,3,51,992,8,51,1,51,1,51,5,51,996,8,51,10,51,
	12,51,999,9,51,1,51,3,51,1002,8,51,3,51,1004,8,51,1,52,1,52,1,52,1,52,5,
	52,1010,8,52,10,52,12,52,1013,9,52,1,52,3,52,1016,8,52,3,52,1018,8,52,1,
	52,1,52,1,53,1,53,5,53,1024,8,53,10,53,12,53,1027,9,53,1,53,3,53,1030,8,
	53,1,53,1,53,5,53,1034,8,53,10,53,12,53,1037,9,53,1,53,3,53,1040,8,53,1,
	53,1,53,5,53,1044,8,53,10,53,12,53,1047,9,53,1,53,3,53,1050,8,53,3,53,1052,
	8,53,1,54,1,54,5,54,1056,8,54,10,54,12,54,1059,9,54,1,54,1,54,3,54,1063,
	8,54,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,
	55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,
	1,55,1,55,1,55,3,55,1096,8,55,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,
	56,1,56,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,5,57,
	1120,8,57,10,57,12,57,1123,9,57,1,57,1,57,1,57,1,58,1,58,1,58,1,58,1,58,
	1,58,5,58,1134,8,58,10,58,12,58,1137,9,58,1,58,1,58,1,58,1,58,1,58,1,58,
	1,58,5,58,1146,8,58,10,58,12,58,1149,9,58,1,58,3,58,1152,8,58,1,58,1,58,
	1,58,3,58,1157,8,58,1,59,1,59,1,59,3,59,1162,8,59,1,59,1,59,1,59,1,59,1,
	59,5,59,1169,8,59,10,59,12,59,1172,9,59,1,59,3,59,1175,8,59,3,59,1177,8,
	59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,
	1,59,1,59,1,59,1,59,1,59,1,59,3,59,1199,8,59,1,59,1,59,1,59,3,59,1204,8,
	59,1,60,1,60,1,60,1,60,3,60,1210,8,60,1,60,1,60,1,60,1,61,1,61,1,61,1,61,
	1,61,1,61,1,62,1,62,1,62,1,62,3,62,1225,8,62,1,62,1,62,1,62,1,62,1,62,5,
	62,1232,8,62,10,62,12,62,1235,9,62,1,62,3,62,1238,8,62,3,62,1240,8,62,1,
	62,1,62,1,62,1,62,1,62,1,62,1,62,3,62,1249,8,62,1,62,1,62,1,62,3,62,1254,
	8,62,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1263,8,63,11,63,12,63,1264,
	3,63,1267,8,63,1,63,1,63,5,63,1271,8,63,10,63,12,63,1274,9,63,1,63,1,63,
	1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1285,8,63,11,63,12,63,1286,1,63,
	1,63,5,63,1291,8,63,10,63,12,63,1294,9,63,1,63,1,63,1,63,1,63,1,63,1,63,
	1,63,4,63,1303,8,63,11,63,12,63,1304,1,63,1,63,1,63,1,63,1,63,1,63,1,63,
	4,63,1314,8,63,11,63,12,63,1315,1,63,1,63,1,63,1,63,4,63,1322,8,63,11,63,
	12,63,1323,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,
	1337,8,63,11,63,12,63,1338,3,63,1341,8,63,1,63,1,63,5,63,1345,8,63,10,63,
	12,63,1348,9,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1357,8,63,11,63,
	12,63,1358,1,63,1,63,5,63,1363,8,63,10,63,12,63,1366,9,63,1,63,1,63,1,63,
	1,63,1,63,1,63,4,63,1374,8,63,11,63,12,63,1375,1,63,1,63,3,63,1380,8,63,
	1,64,1,64,1,64,1,64,1,64,1,64,1,64,5,64,1389,8,64,10,64,12,64,1392,9,64,
	1,64,1,64,1,64,1,64,1,64,1,64,1,65,1,65,5,65,1402,8,65,10,65,12,65,1405,
	9,65,1,65,1,65,1,65,3,65,1410,8,65,1,65,1,65,1,65,1,65,5,65,1416,8,65,10,
	65,12,65,1419,9,65,1,65,1,65,1,65,3,65,1424,8,65,1,65,1,65,3,65,1428,8,
	65,1,66,1,66,1,66,1,66,1,66,1,66,4,66,1436,8,66,11,66,12,66,1437,1,66,1,
	66,1,66,1,66,1,66,1,66,1,66,1,66,4,66,1448,8,66,11,66,12,66,1449,1,66,1,
	66,1,66,1,66,1,66,1,66,4,66,1458,8,66,11,66,12,66,1459,1,66,1,66,1,66,1,
	66,1,66,1,66,1,66,4,66,1469,8,66,11,66,12,66,1470,1,66,1,66,1,66,1,66,1,
	66,3,66,1478,8,66,1,67,1,67,5,67,1482,8,67,10,67,12,67,1485,9,67,1,67,1,
	67,1,67,1,67,3,67,1491,8,67,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,
	1,68,1,68,3,68,1504,8,68,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,
	69,1,69,1,69,1,69,1,69,1,69,1,69,3,69,1522,8,69,1,70,1,70,1,70,1,70,1,70,
	1,70,1,70,1,70,1,70,1,70,1,70,1,70,3,70,1536,8,70,1,71,1,71,1,71,1,71,1,
	71,1,71,1,71,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,73,1,73,1,73,
	1,73,1,73,1,73,1,73,1,73,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,
	74,1,74,1,74,1,74,1,74,1,74,1,74,4,74,1578,8,74,11,74,12,74,1579,1,74,1,
	74,1,74,1,74,1,74,1,74,1,74,1,74,4,74,1590,8,74,11,74,12,74,1591,1,74,1,
	74,3,74,1596,8,74,1,75,1,75,1,75,1,75,1,75,1,75,1,75,3,75,1605,8,75,1,75,
	1,75,1,75,1,76,1,76,1,76,1,76,1,76,3,76,1615,8,76,1,76,1,76,1,76,1,77,1,
	77,1,77,1,77,1,77,1,77,1,77,3,77,1627,8,77,1,78,1,78,1,78,1,78,1,78,1,78,
	3,78,1635,8,78,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,
	79,1,79,1,79,1,79,1,79,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,
	1,80,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,82,1,82,1,
	82,1,82,1,82,3,82,1680,8,82,1,82,1,82,1,82,1,83,1,83,5,83,1687,8,83,10,
	83,12,83,1690,9,83,1,83,1,83,1,83,3,83,1695,8,83,1,83,1,83,1,84,1,84,1,
	84,1,85,1,85,1,85,1,85,1,85,1,85,1,85,3,85,1709,8,85,1,86,1,86,1,86,1,86,
	1,86,1,86,1,86,1,86,1,87,1,87,1,87,1,87,1,87,1,87,1,88,1,88,1,88,1,88,1,
	89,1,89,1,89,5,89,1732,8,89,10,89,12,89,1735,9,89,1,89,1,89,1,90,1,90,1,
	91,1,91,1,91,5,91,1744,8,91,10,91,12,91,1747,9,91,1,91,1,91,1,92,1,92,1,
	92,1,92,1,92,1,92,5,92,1757,8,92,10,92,12,92,1760,9,92,1,92,3,92,1763,8,
	92,1,92,1,92,1,93,1,93,1,93,1,93,5,93,1771,8,93,10,93,12,93,1774,9,93,1,
	94,1,94,1,94,5,94,1779,8,94,10,94,12,94,1782,9,94,1,95,1,95,1,95,3,95,1787,
	8,95,1,95,1,95,4,95,1791,8,95,11,95,12,95,1792,1,96,1,96,1,96,1,96,1,96,
	5,96,1800,8,96,10,96,12,96,1803,9,96,1,96,3,96,1806,8,96,3,96,1808,8,96,
	1,96,1,96,1,97,1,97,3,97,1814,8,97,1,97,1,97,1,97,1,97,5,97,1820,8,97,10,
	97,12,97,1823,9,97,1,97,3,97,1826,8,97,3,97,1828,8,97,1,97,3,97,1831,8,
	97,1,97,1,97,1,98,1,98,1,98,1,99,1,99,1,99,1,100,1,100,1,100,3,100,1844,
	8,100,1,101,1,101,1,101,1,101,3,101,1850,8,101,1,101,1,101,1,101,1,101,
	1,101,5,101,1857,8,101,10,101,12,101,1860,9,101,1,101,3,101,1863,8,101,
	3,101,1865,8,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,3,101,1874,8,
	101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,
	101,3,101,1888,8,101,1,102,1,102,1,102,1,102,1,102,1,102,1,103,1,103,3,
	103,1898,8,103,1,104,1,104,1,104,1,104,5,104,1904,8,104,10,104,12,104,1907,
	9,104,1,104,3,104,1910,8,104,3,104,1912,8,104,1,104,1,104,1,105,1,105,1,
	105,1,105,1,105,1,105,1,105,1,105,1,105,1,105,1,105,1,105,5,105,1928,8,
	105,10,105,12,105,1931,9,105,1,105,3,105,1934,8,105,3,105,1936,8,105,1,
	105,1,105,3,105,1940,8,105,1,106,1,106,1,106,1,106,1,107,1,107,1,107,1,
	107,5,107,1950,8,107,10,107,12,107,1953,9,107,1,107,3,107,1956,8,107,3,
	107,1958,8,107,1,107,1,107,1,108,1,108,1,108,1,108,5,108,1966,8,108,10,
	108,12,108,1969,9,108,1,108,3,108,1972,8,108,1,108,1,108,1,109,1,109,1,
	109,1,109,1,110,1,110,1,110,1,110,5,110,1984,8,110,10,110,12,110,1987,9,
	110,1,110,3,110,1990,8,110,1,110,1,110,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,4,111,2009,8,
	111,11,111,12,111,2010,1,111,1,111,1,111,1,111,1,111,1,111,3,111,2019,8,
	111,1,111,1,111,1,111,1,111,1,111,1,111,3,111,2027,8,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,5,111,2100,8,111,10,
	111,12,111,2103,9,111,1,111,3,111,2106,8,111,3,111,2108,8,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,4,111,2128,8,111,11,111,12,111,2129,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,3,111,2139,8,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,
	1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,3,111,
	2216,8,111,1,111,1,111,1,111,1,111,1,111,5,111,2223,8,111,10,111,12,111,
	2226,9,111,1,111,3,111,2229,8,111,3,111,2231,8,111,1,111,1,111,1,111,1,
	111,1,111,1,111,3,111,2239,8,111,1,111,1,111,1,111,5,111,2244,8,111,10,
	111,12,111,2247,9,111,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,
	112,1,112,1,112,1,112,1,112,3,112,2262,8,112,1,113,1,113,1,114,1,114,1,
	114,1,114,1,114,5,114,2271,8,114,10,114,12,114,2274,9,114,1,114,1,114,1,
	114,1,114,3,114,2280,8,114,1,115,1,115,3,115,2284,8,115,1,116,1,116,1,117,
	1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,
	1,117,1,117,1,117,1,117,1,117,5,117,2306,8,117,10,117,12,117,2309,9,117,
	3,117,2311,8,117,1,117,1,117,1,117,1,117,1,117,1,117,5,117,2319,8,117,10,
	117,12,117,2322,9,117,1,117,1,117,3,117,2326,8,117,1,117,1,117,1,117,1,
	117,3,117,2332,8,117,1,118,1,118,1,118,0,2,82,222,119,0,2,4,6,8,10,12,14,
	16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,
	64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,
	110,112,114,116,118,120,122,124,126,128,130,132,134,136,138,140,142,144,
	146,148,150,152,154,156,158,160,162,164,166,168,170,172,174,176,178,180,
	182,184,186,188,190,192,194,196,198,200,202,204,206,208,210,212,214,216,
	218,220,222,224,226,228,230,232,234,236,0,23,2,0,10,10,13,27,5,0,11,11,
	28,36,139,139,143,143,176,176,1,0,38,39,3,0,20,23,26,27,40,40,1,0,43,44,
	2,0,43,44,58,59,3,0,43,44,58,58,63,63,2,0,141,141,176,176,2,0,40,40,77,
	86,1,0,87,88,3,0,141,141,149,149,176,176,2,0,159,159,168,171,2,0,159,159,
	168,175,3,0,14,14,27,27,122,122,2,0,10,10,15,16,1,0,13,14,1,0,123,124,1,
	0,20,23,1,0,18,19,2,0,121,121,160,160,3,0,33,33,56,56,128,132,1,0,138,139,
	4,0,59,59,133,135,142,145,151,155,2630,0,241,1,0,0,0,2,293,1,0,0,0,4,295,
	1,0,0,0,6,300,1,0,0,0,8,356,1,0,0,0,10,358,1,0,0,0,12,367,1,0,0,0,14,369,
	1,0,0,0,16,371,1,0,0,0,18,376,1,0,0,0,20,378,1,0,0,0,22,383,1,0,0,0,24,
	387,1,0,0,0,26,389,1,0,0,0,28,428,1,0,0,0,30,430,1,0,0,0,32,435,1,0,0,0,
	34,437,1,0,0,0,36,451,1,0,0,0,38,511,1,0,0,0,40,551,1,0,0,0,42,555,1,0,
	0,0,44,575,1,0,0,0,46,599,1,0,0,0,48,606,1,0,0,0,50,625,1,0,0,0,52,628,
	1,0,0,0,54,641,1,0,0,0,56,646,1,0,0,0,58,662,1,0,0,0,60,667,1,0,0,0,62,
	673,1,0,0,0,64,680,1,0,0,0,66,703,1,0,0,0,68,730,1,0,0,0,70,732,1,0,0,0,
	72,746,1,0,0,0,74,811,1,0,0,0,76,815,1,0,0,0,78,817,1,0,0,0,80,855,1,0,
	0,0,82,867,1,0,0,0,84,881,1,0,0,0,86,897,1,0,0,0,88,899,1,0,0,0,90,902,
	1,0,0,0,92,929,1,0,0,0,94,947,1,0,0,0,96,949,1,0,0,0,98,962,1,0,0,0,100,
	968,1,0,0,0,102,1003,1,0,0,0,104,1005,1,0,0,0,106,1051,1,0,0,0,108,1062,
	1,0,0,0,110,1095,1,0,0,0,112,1097,1,0,0,0,114,1107,1,0,0,0,116,1156,1,0,
	0,0,118,1203,1,0,0,0,120,1205,1,0,0,0,122,1214,1,0,0,0,124,1253,1,0,0,0,
	126,1379,1,0,0,0,128,1381,1,0,0,0,130,1427,1,0,0,0,132,1477,1,0,0,0,134,
	1490,1,0,0,0,136,1503,1,0,0,0,138,1521,1,0,0,0,140,1535,1,0,0,0,142,1537,
	1,0,0,0,144,1544,1,0,0,0,146,1553,1,0,0,0,148,1595,1,0,0,0,150,1597,1,0,
	0,0,152,1609,1,0,0,0,154,1619,1,0,0,0,156,1634,1,0,0,0,158,1636,1,0,0,0,
	160,1652,1,0,0,0,162,1663,1,0,0,0,164,1674,1,0,0,0,166,1684,1,0,0,0,168,
	1698,1,0,0,0,170,1708,1,0,0,0,172,1710,1,0,0,0,174,1718,1,0,0,0,176,1724,
	1,0,0,0,178,1728,1,0,0,0,180,1738,1,0,0,0,182,1740,1,0,0,0,184,1750,1,0,
	0,0,186,1766,1,0,0,0,188,1775,1,0,0,0,190,1783,1,0,0,0,192,1794,1,0,0,0,
	194,1811,1,0,0,0,196,1834,1,0,0,0,198,1837,1,0,0,0,200,1843,1,0,0,0,202,
	1887,1,0,0,0,204,1889,1,0,0,0,206,1897,1,0,0,0,208,1899,1,0,0,0,210,1939,
	1,0,0,0,212,1941,1,0,0,0,214,1945,1,0,0,0,216,1961,1,0,0,0,218,1975,1,0,
	0,0,220,1979,1,0,0,0,222,2138,1,0,0,0,224,2261,1,0,0,0,226,2263,1,0,0,0,
	228,2279,1,0,0,0,230,2281,1,0,0,0,232,2285,1,0,0,0,234,2331,1,0,0,0,236,
	2333,1,0,0,0,238,240,3,16,8,0,239,238,1,0,0,0,240,243,1,0,0,0,241,239,1,
	0,0,0,241,242,1,0,0,0,242,247,1,0,0,0,243,241,1,0,0,0,244,246,3,2,1,0,245,
	244,1,0,0,0,246,249,1,0,0,0,247,245,1,0,0,0,247,248,1,0,0,0,248,262,1,0,
	0,0,249,247,1,0,0,0,250,261,3,62,31,0,251,261,3,56,28,0,252,261,3,52,26,
	0,253,261,3,60,30,0,254,261,3,8,4,0,255,261,3,48,24,0,256,261,3,26,13,0,
	257,261,3,6,3,0,258,261,3,36,18,0,259,261,3,38,19,0,260,250,1,0,0,0,260,
	251,1,0,0,0,260,252,1,0,0,0,260,253,1,0,0,0,260,254,1,0,0,0,260,255,1,0,
	0,0,260,256,1,0,0,0,260,257,1,0,0,0,260,258,1,0,0,0,260,259,1,0,0,0,261,
	264,1,0,0,0,262,260,1,0,0,0,262,263,1,0,0,0,263,265,1,0,0,0,264,262,1,0,
	0,0,265,266,5,0,0,1,266,1,1,0,0,0,267,268,5,1,0,0,268,269,5,147,0,0,269,
	294,5,2,0,0,270,271,5,1,0,0,271,272,5,147,0,0,272,273,5,3,0,0,273,274,5,
	176,0,0,274,294,5,2,0,0,275,276,5,1,0,0,276,277,5,4,0,0,277,282,3,4,2,0,
	278,279,5,5,0,0,279,281,3,4,2,0,280,278,1,0,0,0,281,284,1,0,0,0,282,280,
	1,0,0,0,282,283,1,0,0,0,283,286,1,0,0,0,284,282,1,0,0,0,285,287,5,5,0,0,
	286,285,1,0,0,0,286,287,1,0,0,0,287,288,1,0,0,0,288,289,5,6,0,0,289,290,
	5,176,0,0,290,291,5,147,0,0,291,292,5,2,0,0,292,294,1,0,0,0,293,267,1,0,
	0,0,293,270,1,0,0,0,293,275,1,0,0,0,294,3,1,0,0,0,295,298,5,176,0,0,296,
	297,5,3,0,0,297,299,5,176,0,0,298,296,1,0,0,0,298,299,1,0,0,0,299,5,1,0,
	0,0,300,301,5,7,0,0,301,302,3,14,7,0,302,306,3,104,52,0,303,305,3,94,47,
	0,304,303,1,0,0,0,305,308,1,0,0,0,306,304,1,0,0,0,306,307,1,0,0,0,307,310,
	1,0,0,0,308,306,1,0,0,0,309,311,3,100,50,0,310,309,1,0,0,0,310,311,1,0,
	0,0,311,312,1,0,0,0,312,316,5,4,0,0,313,315,3,110,55,0,314,313,1,0,0,0,
	315,318,1,0,0,0,316,314,1,0,0,0,316,317,1,0,0,0,317,319,1,0,0,0,318,316,
	1,0,0,0,319,320,5,6,0,0,320,7,1,0,0,0,321,322,5,8,0,0,322,323,5,176,0,0,
	323,326,5,9,0,0,324,327,3,234,117,0,325,327,5,10,0,0,326,324,1,0,0,0,326,
	325,1,0,0,0,327,329,1,0,0,0,328,330,5,11,0,0,329,328,1,0,0,0,329,330,1,
	0,0,0,330,331,1,0,0,0,331,357,5,2,0,0,332,333,5,8,0,0,333,334,5,4,0,0,334,
	339,3,10,5,0,335,336,5,5,0,0,336,338,3,10,5,0,337,335,1,0,0,0,338,341,1,
	0,0,0,339,337,1,0,0,0,339,340,1,0,0,0,340,343,1,0,0,0,341,339,1,0,0,0,342,
	344,5,5,0,0,343,342,1,0,0,0,343,344,1,0,0,0,344,345,1,0,0,0,345,346,5,6,
	0,0,346,349,5,9,0,0,347,350,3,234,117,0,348,350,5,10,0,0,349,347,1,0,0,
	0,349,348,1,0,0,0,350,352,1,0,0,0,351,353,5,11,0,0,352,351,1,0,0,0,352,
	353,1,0,0,0,353,354,1,0,0,0,354,355,5,2,0,0,355,357,1,0,0,0,356,321,1,0,
	0,0,356,332,1,0,0,0,357,9,1,0,0,0,358,361,5,176,0,0,359,360,5,12,0,0,360,
	362,5,176,0,0,361,359,1,0,0,0,361,362,1,0,0,0,362,365,1,0,0,0,363,364,5,
	3,0,0,364,366,3,12,6,0,365,363,1,0,0,0,365,366,1,0,0,0,366,11,1,0,0,0,367,
	368,7,0,0,0,368,13,1,0,0,0,369,370,7,1,0,0,370,15,1,0,0,0,371,372,5,37,
	0,0,372,373,3,18,9,0,373,374,3,20,10,0,374,375,5,2,0,0,375,17,1,0,0,0,376,
	377,7,2,0,0,377,19,1,0,0,0,378,380,3,22,11,0,379,381,3,22,11,0,380,379,
	1,0,0,0,380,381,1,0,0,0,381,21,1,0,0,0,382,384,3,24,12,0,383,382,1,0,0,
	0,383,384,1,0,0,0,384,385,1,0,0,0,385,386,5,136,0,0,386,23,1,0,0,0,387,
	388,7,3,0,0,388,25,1,0,0,0,389,390,5,41,0,0,390,400,5,176,0,0,391,392,5,
	42,0,0,392,397,5,176,0,0,393,394,5,5,0,0,394,396,5,176,0,0,395,393,1,0,
	0,0,396,399,1,0,0,0,397,395,1,0,0,0,397,398,1,0,0,0,398,401,1,0,0,0,399,
	397,1,0,0,0,400,391,1,0,0,0,400,401,1,0,0,0,401,402,1,0,0,0,402,413,5,4,
	0,0,403,412,3,56,28,0,404,412,3,52,26,0,405,412,3,60,30,0,406,412,3,44,
	22,0,407,412,3,48,24,0,408,412,3,30,15,0,409,412,3,28,14,0,410,412,3,34,
	17,0,411,403,1,0,0,0,411,404,1,0,0,0,411,405,1,0,0,0,411,406,1,0,0,0,411,
	407,1,0,0,0,411,408,1,0,0,0,411,409,1,0,0,0,411,410,1,0,0,0,412,415,1,0,
	0,0,413,411,1,0,0,0,413,414,1,0,0,0,414,416,1,0,0,0,415,413,1,0,0,0,416,
	417,5,6,0,0,417,27,1,0,0,0,418,419,3,32,16,0,419,420,3,80,40,0,420,421,
	5,176,0,0,421,422,5,2,0,0,422,429,1,0,0,0,423,424,3,32,16,0,424,425,3,82,
	41,0,425,426,5,176,0,0,426,427,5,2,0,0,427,429,1,0,0,0,428,418,1,0,0,0,
	428,423,1,0,0,0,429,29,1,0,0,0,430,431,3,32,16,0,431,432,3,234,117,0,432,
	433,5,176,0,0,433,434,5,2,0,0,434,31,1,0,0,0,435,436,7,4,0,0,436,33,1,0,
	0,0,437,438,5,7,0,0,438,439,5,176,0,0,439,443,3,104,52,0,440,442,3,94,47,
	0,441,440,1,0,0,0,442,445,1,0,0,0,443,441,1,0,0,0,443,444,1,0,0,0,444,447,
	1,0,0,0,445,443,1,0,0,0,446,448,3,100,50,0,447,446,1,0,0,0,447,448,1,0,
	0,0,448,449,1,0,0,0,449,450,5,2,0,0,450,35,1,0,0,0,451,452,5,45,0,0,452,
	453,5,176,0,0,453,457,5,4,0,0,454,456,3,56,28,0,455,454,1,0,0,0,456,459,
	1,0,0,0,457,455,1,0,0,0,457,458,1,0,0,0,458,463,1,0,0,0,459,457,1,0,0,0,
	460,462,3,52,26,0,461,460,1,0,0,0,462,465,1,0,0,0,463,461,1,0,0,0,463,464,
	1,0,0,0,464,469,1,0,0,0,465,463,1,0,0,0,466,468,3,60,30,0,467,466,1,0,0,
	0,468,471,1,0,0,0,469,467,1,0,0,0,469,470,1,0,0,0,470,475,1,0,0,0,471,469,
	1,0,0,0,472,474,3,44,22,0,473,472,1,0,0,0,474,477,1,0,0,0,475,473,1,0,0,
	0,475,476,1,0,0,0,476,481,1,0,0,0,477,475,1,0,0,0,478,480,3,48,24,0,479,
	478,1,0,0,0,480,483,1,0,0,0,481,479,1,0,0,0,481,482,1,0,0,0,482,487,1,0,
	0,0,483,481,1,0,0,0,484,486,3,62,31,0,485,484,1,0,0,0,486,489,1,0,0,0,487,
	485,1,0,0,0,487,488,1,0,0,0,488,493,1,0,0,0,489,487,1,0,0,0,490,492,3,74,
	37,0,491,490,1,0,0,0,492,495,1,0,0,0,493,491,1,0,0,0,493,494,1,0,0,0,494,
	499,1,0,0,0,495,493,1,0,0,0,496,498,3,8,4,0,497,496,1,0,0,0,498,501,1,0,
	0,0,499,497,1,0,0,0,499,500,1,0,0,0,500,505,1,0,0,0,501,499,1,0,0,0,502,
	504,3,6,3,0,503,502,1,0,0,0,504,507,1,0,0,0,505,503,1,0,0,0,505,506,1,0,
	0,0,506,508,1,0,0,0,507,505,1,0,0,0,508,509,5,6,0,0,509,37,1,0,0,0,510,
	512,5,46,0,0,511,510,1,0,0,0,511,512,1,0,0,0,512,513,1,0,0,0,513,514,5,
	47,0,0,514,516,5,176,0,0,515,517,3,104,52,0,516,515,1,0,0,0,516,517,1,0,
	0,0,517,527,1,0,0,0,518,519,5,42,0,0,519,524,3,40,20,0,520,521,5,5,0,0,
	521,523,3,40,20,0,522,520,1,0,0,0,523,526,1,0,0,0,524,522,1,0,0,0,524,525,
	1,0,0,0,525,528,1,0,0,0,526,524,1,0,0,0,527,518,1,0,0,0,527,528,1,0,0,0,
	528,529,1,0,0,0,529,546,5,4,0,0,530,545,3,56,28,0,531,545,3,52,26,0,532,
	545,3,60,30,0,533,545,3,44,22,0,534,545,3,48,24,0,535,545,3,62,31,0,536,
	545,3,8,4,0,537,545,3,74,37,0,538,545,3,84,42,0,539,545,3,64,32,0,540,545,
	3,90,45,0,541,545,3,42,21,0,542,545,3,66,33,0,543,545,3,70,35,0,544,530,
	1,0,0,0,544,531,1,0,0,0,544,532,1,0,0,0,544,533,1,0,0,0,544,534,1,0,0,0,
	544,535,1,0,0,0,544,536,1,0,0,0,544,537,1,0,0,0,544,538,1,0,0,0,544,539,
	1,0,0,0,544,540,1,0,0,0,544,541,1,0,0,0,544,542,1,0,0,0,544,543,1,0,0,0,
	545,548,1,0,0,0,546,544,1,0,0,0,546,547,1,0,0,0,547,549,1,0,0,0,548,546,
	1,0,0,0,549,550,5,6,0,0,550,39,1,0,0,0,551,553,5,176,0,0,552,554,3,214,
	107,0,553,552,1,0,0,0,553,554,1,0,0,0,554,41,1,0,0,0,555,556,5,7,0,0,556,
	557,3,14,7,0,557,561,3,104,52,0,558,560,3,94,47,0,559,558,1,0,0,0,560,563,
	1,0,0,0,561,559,1,0,0,0,561,562,1,0,0,0,562,567,1,0,0,0,563,561,1,0,0,0,
	564,566,3,92,46,0,565,564,1,0,0,0,566,569,1,0,0,0,567,565,1,0,0,0,567,568,
	1,0,0,0,568,571,1,0,0,0,569,567,1,0,0,0,570,572,3,100,50,0,571,570,1,0,
	0,0,571,572,1,0,0,0,572,573,1,0,0,0,573,574,5,2,0,0,574,43,1,0,0,0,575,
	576,5,48,0,0,576,577,5,176,0,0,577,589,5,49,0,0,578,583,3,46,23,0,579,580,
	5,5,0,0,580,582,3,46,23,0,581,579,1,0,0,0,582,585,1,0,0,0,583,581,1,0,0,
	0,583,584,1,0,0,0,584,587,1,0,0,0,585,583,1,0,0,0,586,588,5,5,0,0,587,586,
	1,0,0,0,587,588,1,0,0,0,588,590,1,0,0,0,589,578,1,0,0,0,589,590,1,0,0,0,
	590,591,1,0,0,0,591,593,5,50,0,0,592,594,5,51,0,0,593,592,1,0,0,0,593,594,
	1,0,0,0,594,595,1,0,0,0,595,596,5,2,0,0,596,45,1,0,0,0,597,600,3,234,117,
	0,598,600,3,82,41,0,599,597,1,0,0,0,599,598,1,0,0,0,600,602,1,0,0,0,601,
	603,5,52,0,0,602,601,1,0,0,0,602,603,1,0,0,0,603,604,1,0,0,0,604,605,5,
	176,0,0,605,47,1,0,0,0,606,607,5,35,0,0,607,608,5,176,0,0,608,620,5,49,
	0,0,609,614,3,50,25,0,610,611,5,5,0,0,611,613,3,50,25,0,612,610,1,0,0,0,
	613,616,1,0,0,0,614,612,1,0,0,0,614,615,1,0,0,0,615,618,1,0,0,0,616,614,
	1,0,0,0,617,619,5,5,0,0,618,617,1,0,0,0,618,619,1,0,0,0,619,621,1,0,0,0,
	620,609,1,0,0,0,620,621,1,0,0,0,621,622,1,0,0,0,622,623,5,50,0,0,623,624,
	5,2,0,0,624,49,1,0,0,0,625,626,3,234,117,0,626,627,5,176,0,0,627,51,1,0,
	0,0,628,629,5,53,0,0,629,630,5,176,0,0,630,632,5,4,0,0,631,633,3,54,27,
	0,632,631,1,0,0,0,633,634,1,0,0,0,634,632,1,0,0,0,634,635,1,0,0,0,635,636,
	1,0,0,0,636,637,5,6,0,0,637,53,1,0,0,0,638,642,3,234,117,0,639,642,3,82,
	41,0,640,642,3,80,40,0,641,638,1,0,0,0,641,639,1,0,0,0,641,640,1,0,0,0,
	642,643,1,0,0,0,643,644,3,14,7,0,644,645,5,2,0,0,645,55,1,0,0,0,646,647,
	5,54,0,0,647,648,5,176,0,0,648,649,5,4,0,0,649,654,3,58,29,0,650,651,5,
	5,0,0,651,653,3,58,29,0,652,650,1,0,0,0,653,656,1,0,0,0,654,652,1,0,0,0,
	654,655,1,0,0,0,655,658,1,0,0,0,656,654,1,0,0,0,657,659,5,5,0,0,658,657,
	1,0,0,0,658,659,1,0,0,0,659,660,1,0,0,0,660,661,5,6,0,0,661,57,1,0,0,0,
	662,665,5,176,0,0,663,664,5,40,0,0,664,666,5,141,0,0,665,663,1,0,0,0,665,
	666,1,0,0,0,666,59,1,0,0,0,667,668,5,55,0,0,668,669,5,176,0,0,669,670,5,
	42,0,0,670,671,3,234,117,0,671,672,5,2,0,0,672,61,1,0,0,0,673,674,3,234,
	117,0,674,675,5,56,0,0,675,676,5,176,0,0,676,677,5,40,0,0,677,678,3,222,
	111,0,678,679,5,2,0,0,679,63,1,0,0,0,680,681,5,57,0,0,681,685,3,104,52,
	0,682,684,7,5,0,0,683,682,1,0,0,0,684,687,1,0,0,0,685,683,1,0,0,0,685,686,
	1,0,0,0,686,691,1,0,0,0,687,685,1,0,0,0,688,690,3,72,36,0,689,688,1,0,0,
	0,690,693,1,0,0,0,691,689,1,0,0,0,691,692,1,0,0,0,692,694,1,0,0,0,693,691,
	1,0,0,0,694,698,5,4,0,0,695,697,3,110,55,0,696,695,1,0,0,0,697,700,1,0,
	0,0,698,696,1,0,0,0,698,699,1,0,0,0,699,701,1,0,0,0,700,698,1,0,0,0,701,
	702,5,6,0,0,702,65,1,0,0,0,703,704,5,60,0,0,704,705,3,104,52,0,705,709,
	5,44,0,0,706,708,3,68,34,0,707,706,1,0,0,0,708,711,1,0,0,0,709,707,1,0,
	0,0,709,710,1,0,0,0,710,715,1,0,0,0,711,709,1,0,0,0,712,714,3,92,46,0,713,
	712,1,0,0,0,714,717,1,0,0,0,715,713,1,0,0,0,715,716,1,0,0,0,716,718,1,0,
	0,0,717,715,1,0,0,0,718,722,5,4,0,0,719,721,3,110,55,0,720,719,1,0,0,0,
	721,724,1,0,0,0,722,720,1,0,0,0,722,723,1,0,0,0,723,725,1,0,0,0,724,722,
	1,0,0,0,725,726,5,6,0,0,726,67,1,0,0,0,727,731,5,59,0,0,728,731,5,61,0,
	0,729,731,3,96,48,0,730,727,1,0,0,0,730,728,1,0,0,0,730,729,1,0,0,0,731,
	69,1,0,0,0,732,733,5,62,0,0,733,734,5,49,0,0,734,735,5,50,0,0,735,736,5,
	44,0,0,736,737,5,59,0,0,737,741,5,4,0,0,738,740,3,110,55,0,739,738,1,0,
	0,0,740,743,1,0,0,0,741,739,1,0,0,0,741,742,1,0,0,0,742,744,1,0,0,0,743,
	741,1,0,0,0,744,745,5,6,0,0,745,71,1,0,0,0,746,747,5,176,0,0,747,748,3,
	214,107,0,748,73,1,0,0,0,749,751,3,78,39,0,750,749,1,0,0,0,750,751,1,0,
	0,0,751,752,1,0,0,0,752,756,3,234,117,0,753,755,3,226,113,0,754,753,1,0,
	0,0,755,758,1,0,0,0,756,754,1,0,0,0,756,757,1,0,0,0,757,759,1,0,0,0,758,
	756,1,0,0,0,759,762,5,176,0,0,760,761,5,40,0,0,761,763,3,222,111,0,762,
	760,1,0,0,0,762,763,1,0,0,0,763,764,1,0,0,0,764,765,5,2,0,0,765,812,1,0,
	0,0,766,767,3,234,117,0,767,771,3,78,39,0,768,770,3,226,113,0,769,768,1,
	0,0,0,770,773,1,0,0,0,771,769,1,0,0,0,771,772,1,0,0,0,772,774,1,0,0,0,773,
	771,1,0,0,0,774,777,5,176,0,0,775,776,5,40,0,0,776,778,3,222,111,0,777,
	775,1,0,0,0,777,778,1,0,0,0,778,779,1,0,0,0,779,780,5,2,0,0,780,812,1,0,
	0,0,781,783,3,78,39,0,782,781,1,0,0,0,782,783,1,0,0,0,783,784,1,0,0,0,784,
	788,3,80,40,0,785,787,3,76,38,0,786,785,1,0,0,0,787,790,1,0,0,0,788,786,
	1,0,0,0,788,789,1,0,0,0,789,791,1,0,0,0,790,788,1,0,0,0,791,792,5,176,0,
	0,792,793,5,2,0,0,793,812,1,0,0,0,794,796,3,78,39,0,795,794,1,0,0,0,795,
	796,1,0,0,0,796,797,1,0,0,0,797,801,3,82,41,0,798,800,3,76,38,0,799,798,
	1,0,0,0,800,803,1,0,0,0,801,799,1,0,0,0,801,802,1,0,0,0,802,804,1,0,0,0,
	803,801,1,0,0,0,804,807,5,176,0,0,805,806,5,40,0,0,806,808,3,222,111,0,
	807,805,1,0,0,0,807,808,1,0,0,0,808,809,1,0,0,0,809,810,5,2,0,0,810,812,
	1,0,0,0,811,750,1,0,0,0,811,766,1,0,0,0,811,782,1,0,0,0,811,795,1,0,0,0,
	812,75,1,0,0,0,813,816,3,226,113,0,814,816,3,78,39,0,815,813,1,0,0,0,815,
	814,1,0,0,0,816,77,1,0,0,0,817,818,7,6,0,0,818,79,1,0,0,0,819,820,5,64,
	0,0,820,821,5,49,0,0,821,823,3,234,117,0,822,824,5,176,0,0,823,822,1,0,
	0,0,823,824,1,0,0,0,824,825,1,0,0,0,825,826,5,65,0,0,826,828,3,234,117,
	0,827,829,5,176,0,0,828,827,1,0,0,0,828,829,1,0,0,0,829,830,1,0,0,0,830,
	831,5,50,0,0,831,856,1,0,0,0,832,833,5,64,0,0,833,834,5,49,0,0,834,836,
	3,234,117,0,835,837,5,176,0,0,836,835,1,0,0,0,836,837,1,0,0,0,837,838,1,
	0,0,0,838,839,5,65,0,0,839,840,3,80,40,0,840,841,5,50,0,0,841,856,1,0,0,
	0,842,843,5,64,0,0,843,844,5,49,0,0,844,846,3,234,117,0,845,847,5,176,0,
	0,846,845,1,0,0,0,846,847,1,0,0,0,847,848,1,0,0,0,848,849,5,65,0,0,849,
	851,3,82,41,0,850,852,5,176,0,0,851,850,1,0,0,0,851,852,1,0,0,0,852,853,
	1,0,0,0,853,854,5,50,0,0,854,856,1,0,0,0,855,819,1,0,0,0,855,832,1,0,0,
	0,855,842,1,0,0,0,856,81,1,0,0,0,857,858,6,41,-1,0,858,859,3,234,117,0,
	859,860,5,66,0,0,860,861,7,7,0,0,861,862,5,67,0,0,862,868,1,0,0,0,863,864,
	3,234,117,0,864,865,5,66,0,0,865,866,5,67,0,0,866,868,1,0,0,0,867,857,1,
	0,0,0,867,863,1,0,0,0,868,878,1,0,0,0,869,870,10,2,0,0,870,871,5,66,0,0,
	871,872,7,7,0,0,872,877,5,67,0,0,873,874,10,1,0,0,874,875,5,66,0,0,875,
	877,5,67,0,0,876,869,1,0,0,0,876,873,1,0,0,0,877,880,1,0,0,0,878,876,1,
	0,0,0,878,879,1,0,0,0,879,83,1,0,0,0,880,878,1,0,0,0,881,882,5,68,0,0,882,
	884,5,176,0,0,883,885,3,104,52,0,884,883,1,0,0,0,884,885,1,0,0,0,885,886,
	1,0,0,0,886,890,5,4,0,0,887,889,3,86,43,0,888,887,1,0,0,0,889,892,1,0,0,
	0,890,888,1,0,0,0,890,891,1,0,0,0,891,893,1,0,0,0,892,890,1,0,0,0,893,894,
	5,6,0,0,894,85,1,0,0,0,895,898,3,88,44,0,896,898,3,110,55,0,897,895,1,0,
	0,0,897,896,1,0,0,0,898,87,1,0,0,0,899,900,5,69,0,0,900,901,5,2,0,0,901,
	89,1,0,0,0,902,903,5,7,0,0,903,904,3,14,7,0,904,908,3,104,52,0,905,907,
	3,94,47,0,906,905,1,0,0,0,907,910,1,0,0,0,908,906,1,0,0,0,908,909,1,0,0,
	0,909,914,1,0,0,0,910,908,1,0,0,0,911,913,3,92,46,0,912,911,1,0,0,0,913,
	916,1,0,0,0,914,912,1,0,0,0,914,915,1,0,0,0,915,918,1,0,0,0,916,914,1,0,
	0,0,917,919,3,100,50,0,918,917,1,0,0,0,918,919,1,0,0,0,919,920,1,0,0,0,
	920,924,5,4,0,0,921,923,3,110,55,0,922,921,1,0,0,0,923,926,1,0,0,0,924,
	922,1,0,0,0,924,925,1,0,0,0,925,927,1,0,0,0,926,924,1,0,0,0,927,928,5,6,
	0,0,928,91,1,0,0,0,929,931,5,176,0,0,930,932,3,214,107,0,931,930,1,0,0,
	0,931,932,1,0,0,0,932,93,1,0,0,0,933,948,5,70,0,0,934,948,5,71,0,0,935,
	948,5,58,0,0,936,948,5,44,0,0,937,948,5,43,0,0,938,948,5,63,0,0,939,948,
	5,59,0,0,940,948,3,96,48,0,941,948,5,61,0,0,942,948,3,98,49,0,943,948,5,
	30,0,0,944,948,5,28,0,0,945,948,5,31,0,0,946,948,5,29,0,0,947,933,1,0,0,
	0,947,934,1,0,0,0,947,935,1,0,0,0,947,936,1,0,0,0,947,937,1,0,0,0,947,938,
	1,0,0,0,947,939,1,0,0,0,947,940,1,0,0,0,947,941,1,0,0,0,947,942,1,0,0,0,
	947,943,1,0,0,0,947,944,1,0,0,0,947,945,1,0,0,0,947,946,1,0,0,0,948,95,
	1,0,0,0,949,960,5,72,0,0,950,951,5,49,0,0,951,956,5,176,0,0,952,953,5,5,
	0,0,953,955,5,176,0,0,954,952,1,0,0,0,955,958,1,0,0,0,956,954,1,0,0,0,956,
	957,1,0,0,0,957,959,1,0,0,0,958,956,1,0,0,0,959,961,5,50,0,0,960,950,1,
	0,0,0,960,961,1,0,0,0,961,97,1,0,0,0,962,966,5,32,0,0,963,964,5,49,0,0,
	964,965,5,141,0,0,965,967,5,50,0,0,966,963,1,0,0,0,966,967,1,0,0,0,967,
	99,1,0,0,0,968,969,5,73,0,0,969,970,5,49,0,0,970,975,3,102,51,0,971,972,
	5,5,0,0,972,974,3,102,51,0,973,971,1,0,0,0,974,977,1,0,0,0,975,973,1,0,
	0,0,975,976,1,0,0,0,976,979,1,0,0,0,977,975,1,0,0,0,978,980,5,5,0,0,979,
	978,1,0,0,0,979,980,1,0,0,0,980,981,1,0,0,0,981,982,5,50,0,0,982,101,1,
	0,0,0,983,987,3,234,117,0,984,986,3,226,113,0,985,984,1,0,0,0,986,989,1,
	0,0,0,987,985,1,0,0,0,987,988,1,0,0,0,988,991,1,0,0,0,989,987,1,0,0,0,990,
	992,3,14,7,0,991,990,1,0,0,0,991,992,1,0,0,0,992,1004,1,0,0,0,993,997,3,
	82,41,0,994,996,3,226,113,0,995,994,1,0,0,0,996,999,1,0,0,0,997,995,1,0,
	0,0,997,998,1,0,0,0,998,1001,1,0,0,0,999,997,1,0,0,0,1000,1002,3,14,7,0,
	1001,1000,1,0,0,0,1001,1002,1,0,0,0,1002,1004,1,0,0,0,1003,983,1,0,0,0,
	1003,993,1,0,0,0,1004,103,1,0,0,0,1005,1017,5,49,0,0,1006,1011,3,106,53,
	0,1007,1008,5,5,0,0,1008,1010,3,106,53,0,1009,1007,1,0,0,0,1010,1013,1,
	0,0,0,1011,1009,1,0,0,0,1011,1012,1,0,0,0,1012,1015,1,0,0,0,1013,1011,1,
	0,0,0,1014,1016,5,5,0,0,1015,1014,1,0,0,0,1015,1016,1,0,0,0,1016,1018,1,
	0,0,0,1017,1006,1,0,0,0,1017,1018,1,0,0,0,1018,1019,1,0,0,0,1019,1020,5,
	50,0,0,1020,105,1,0,0,0,1021,1025,3,234,117,0,1022,1024,3,226,113,0,1023,
	1022,1,0,0,0,1024,1027,1,0,0,0,1025,1023,1,0,0,0,1025,1026,1,0,0,0,1026,
	1029,1,0,0,0,1027,1025,1,0,0,0,1028,1030,3,14,7,0,1029,1028,1,0,0,0,1029,
	1030,1,0,0,0,1030,1052,1,0,0,0,1031,1035,3,82,41,0,1032,1034,3,226,113,
	0,1033,1032,1,0,0,0,1034,1037,1,0,0,0,1035,1033,1,0,0,0,1035,1036,1,0,0,
	0,1036,1039,1,0,0,0,1037,1035,1,0,0,0,1038,1040,3,14,7,0,1039,1038,1,0,
	0,0,1039,1040,1,0,0,0,1040,1052,1,0,0,0,1041,1045,3,80,40,0,1042,1044,3,
	226,113,0,1043,1042,1,0,0,0,1044,1047,1,0,0,0,1045,1043,1,0,0,0,1045,1046,
	1,0,0,0,1046,1049,1,0,0,0,1047,1045,1,0,0,0,1048,1050,3,14,7,0,1049,1048,
	1,0,0,0,1049,1050,1,0,0,0,1050,1052,1,0,0,0,1051,1021,1,0,0,0,1051,1031,
	1,0,0,0,1051,1041,1,0,0,0,1052,107,1,0,0,0,1053,1057,5,4,0,0,1054,1056,
	3,110,55,0,1055,1054,1,0,0,0,1056,1059,1,0,0,0,1057,1055,1,0,0,0,1057,1058,
	1,0,0,0,1058,1060,1,0,0,0,1059,1057,1,0,0,0,1060,1063,5,6,0,0,1061,1063,
	3,110,55,0,1062,1053,1,0,0,0,1062,1061,1,0,0,0,1063,109,1,0,0,0,1064,1096,
	3,130,65,0,1065,1096,3,132,66,0,1066,1096,3,138,69,0,1067,1096,3,140,70,
	0,1068,1096,3,142,71,0,1069,1096,3,144,72,0,1070,1096,3,146,73,0,1071,1096,
	3,136,68,0,1072,1096,3,126,63,0,1073,1096,3,128,64,0,1074,1096,3,150,75,
	0,1075,1096,3,152,76,0,1076,1096,3,154,77,0,1077,1096,3,156,78,0,1078,1096,
	3,176,88,0,1079,1096,3,124,62,0,1080,1096,3,112,56,0,1081,1096,3,114,57,
	0,1082,1096,3,116,58,0,1083,1096,3,118,59,0,1084,1096,3,120,60,0,1085,1096,
	3,122,61,0,1086,1096,3,178,89,0,1087,1096,3,190,95,0,1088,1096,3,202,101,
	0,1089,1096,3,204,102,0,1090,1096,3,148,74,0,1091,1096,3,182,91,0,1092,
	1096,3,184,92,0,1093,1096,3,196,98,0,1094,1096,3,198,99,0,1095,1064,1,0,
	0,0,1095,1065,1,0,0,0,1095,1066,1,0,0,0,1095,1067,1,0,0,0,1095,1068,1,0,
	0,0,1095,1069,1,0,0,0,1095,1070,1,0,0,0,1095,1071,1,0,0,0,1095,1072,1,0,
	0,0,1095,1073,1,0,0,0,1095,1074,1,0,0,0,1095,1075,1,0,0,0,1095,1076,1,0,
	0,0,1095,1077,1,0,0,0,1095,1078,1,0,0,0,1095,1079,1,0,0,0,1095,1080,1,0,
	0,0,1095,1081,1,0,0,0,1095,1082,1,0,0,0,1095,1083,1,0,0,0,1095,1084,1,0,
	0,0,1095,1085,1,0,0,0,1095,1086,1,0,0,0,1095,1087,1,0,0,0,1095,1088,1,0,
	0,0,1095,1089,1,0,0,0,1095,1090,1,0,0,0,1095,1091,1,0,0,0,1095,1092,1,0,
	0,0,1095,1093,1,0,0,0,1095,1094,1,0,0,0,1096,111,1,0,0,0,1097,1098,5,74,
	0,0,1098,1099,5,12,0,0,1099,1100,5,176,0,0,1100,1101,5,49,0,0,1101,1102,
	3,222,111,0,1102,1103,5,5,0,0,1103,1104,3,222,111,0,1104,1105,5,50,0,0,
	1105,1106,5,2,0,0,1106,113,1,0,0,0,1107,1108,5,74,0,0,1108,1109,5,12,0,
	0,1109,1110,5,176,0,0,1110,1111,5,66,0,0,1111,1112,3,222,111,0,1112,1113,
	5,67,0,0,1113,1114,5,12,0,0,1114,1115,5,176,0,0,1115,1116,5,49,0,0,1116,
	1121,3,222,111,0,1117,1118,5,5,0,0,1118,1120,3,222,111,0,1119,1117,1,0,
	0,0,1120,1123,1,0,0,0,1121,1119,1,0,0,0,1121,1122,1,0,0,0,1122,1124,1,0,
	0,0,1123,1121,1,0,0,0,1124,1125,5,50,0,0,1125,1126,5,2,0,0,1126,115,1,0,
	0,0,1127,1128,5,75,0,0,1128,1157,5,2,0,0,1129,1130,5,75,0,0,1130,1135,3,
	222,111,0,1131,1132,5,5,0,0,1132,1134,3,222,111,0,1133,1131,1,0,0,0,1134,
	1137,1,0,0,0,1135,1133,1,0,0,0,1135,1136,1,0,0,0,1136,1138,1,0,0,0,1137,
	1135,1,0,0,0,1138,1139,5,2,0,0,1139,1157,1,0,0,0,1140,1141,5,75,0,0,1141,
	1142,5,49,0,0,1142,1147,3,222,111,0,1143,1144,5,5,0,0,1144,1146,3,222,111,
	0,1145,1143,1,0,0,0,1146,1149,1,0,0,0,1147,1145,1,0,0,0,1147,1148,1,0,0,
	0,1148,1151,1,0,0,0,1149,1147,1,0,0,0,1150,1152,5,5,0,0,1151,1150,1,0,0,
	0,1151,1152,1,0,0,0,1152,1153,1,0,0,0,1153,1154,5,50,0,0,1154,1155,5,2,
	0,0,1155,1157,1,0,0,0,1156,1127,1,0,0,0,1156,1129,1,0,0,0,1156,1140,1,0,
	0,0,1157,117,1,0,0,0,1158,1161,5,176,0,0,1159,1160,5,12,0,0,1160,1162,5,
	176,0,0,1161,1159,1,0,0,0,1161,1162,1,0,0,0,1162,1163,1,0,0,0,1163,1164,
	5,49,0,0,1164,1176,5,4,0,0,1165,1170,3,212,106,0,1166,1167,5,5,0,0,1167,
	1169,3,212,106,0,1168,1166,1,0,0,0,1169,1172,1,0,0,0,1170,1168,1,0,0,0,
	1170,1171,1,0,0,0,1171,1174,1,0,0,0,1172,1170,1,0,0,0,1173,1175,5,5,0,0,
	1174,1173,1,0,0,0,1174,1175,1,0,0,0,1175,1177,1,0,0,0,1176,1165,1,0,0,0,
	1176,1177,1,0,0,0,1177,1178,1,0,0,0,1178,1179,5,6,0,0,1179,1180,5,50,0,
	0,1180,1204,5,2,0,0,1181,1182,5,176,0,0,1182,1183,3,214,107,0,1183,1184,
	5,2,0,0,1184,1204,1,0,0,0,1185,1186,5,176,0,0,1186,1187,5,12,0,0,1187,1188,
	5,176,0,0,1188,1189,3,214,107,0,1189,1190,5,2,0,0,1190,1204,1,0,0,0,1191,
	1192,5,176,0,0,1192,1193,3,214,107,0,1193,1194,5,12,0,0,1194,1195,5,176,
	0,0,1195,1196,5,12,0,0,1196,1198,5,176,0,0,1197,1199,3,216,108,0,1198,1197,
	1,0,0,0,1198,1199,1,0,0,0,1199,1200,1,0,0,0,1200,1201,3,214,107,0,1201,
	1202,5,2,0,0,1202,1204,1,0,0,0,1203,1158,1,0,0,0,1203,1181,1,0,0,0,1203,
	1185,1,0,0,0,1203,1191,1,0,0,0,1204,119,1,0,0,0,1205,1206,3,222,111,0,1206,
	1207,5,12,0,0,1207,1209,5,176,0,0,1208,1210,3,216,108,0,1209,1208,1,0,0,
	0,1209,1210,1,0,0,0,1210,1211,1,0,0,0,1211,1212,3,214,107,0,1212,1213,5,
	2,0,0,1213,121,1,0,0,0,1214,1215,5,31,0,0,1215,1216,5,49,0,0,1216,1217,
	3,222,111,0,1217,1218,5,50,0,0,1218,1219,5,2,0,0,1219,123,1,0,0,0,1220,
	1221,5,76,0,0,1221,1224,5,176,0,0,1222,1223,5,12,0,0,1223,1225,5,176,0,
	0,1224,1222,1,0,0,0,1224,1225,1,0,0,0,1225,1226,1,0,0,0,1226,1227,5,49,
	0,0,1227,1239,5,4,0,0,1228,1233,3,212,106,0,1229,1230,5,5,0,0,1230,1232,
	3,212,106,0,1231,1229,1,0,0,0,1232,1235,1,0,0,0,1233,1231,1,0,0,0,1233,
	1234,1,0,0,0,1234,1237,1,0,0,0,1235,1233,1,0,0,0,1236,1238,5,5,0,0,1237,
	1236,1,0,0,0,1237,1238,1,0,0,0,1238,1240,1,0,0,0,1239,1228,1,0,0,0,1239,
	1240,1,0,0,0,1240,1241,1,0,0,0,1241,1242,5,6,0,0,1242,1243,5,50,0,0,1243,
	1254,5,2,0,0,1244,1245,5,76,0,0,1245,1248,5,176,0,0,1246,1247,5,12,0,0,
	1247,1249,5,176,0,0,1248,1246,1,0,0,0,1248,1249,1,0,0,0,1249,1250,1,0,0,
	0,1250,1251,3,214,107,0,1251,1252,5,2,0,0,1252,1254,1,0,0,0,1253,1220,1,
	0,0,0,1253,1244,1,0,0,0,1254,125,1,0,0,0,1255,1256,5,74,0,0,1256,1257,5,
	12,0,0,1257,1266,5,176,0,0,1258,1259,5,66,0,0,1259,1260,3,222,111,0,1260,
	1261,5,67,0,0,1261,1263,1,0,0,0,1262,1258,1,0,0,0,1263,1264,1,0,0,0,1264,
	1262,1,0,0,0,1264,1265,1,0,0,0,1265,1267,1,0,0,0,1266,1262,1,0,0,0,1266,
	1267,1,0,0,0,1267,1272,1,0,0,0,1268,1269,5,12,0,0,1269,1271,5,176,0,0,1270,
	1268,1,0,0,0,1271,1274,1,0,0,0,1272,1270,1,0,0,0,1272,1273,1,0,0,0,1273,
	1275,1,0,0,0,1274,1272,1,0,0,0,1275,1276,7,8,0,0,1276,1277,3,222,111,0,
	1277,1278,5,2,0,0,1278,1380,1,0,0,0,1279,1284,5,176,0,0,1280,1281,5,66,
	0,0,1281,1282,3,222,111,0,1282,1283,5,67,0,0,1283,1285,1,0,0,0,1284,1280,
	1,0,0,0,1285,1286,1,0,0,0,1286,1284,1,0,0,0,1286,1287,1,0,0,0,1287,1292,
	1,0,0,0,1288,1289,5,12,0,0,1289,1291,5,176,0,0,1290,1288,1,0,0,0,1291,1294,
	1,0,0,0,1292,1290,1,0,0,0,1292,1293,1,0,0,0,1293,1295,1,0,0,0,1294,1292,
	1,0,0,0,1295,1296,7,8,0,0,1296,1297,3,222,111,0,1297,1298,5,2,0,0,1298,
	1380,1,0,0,0,1299,1302,5,176,0,0,1300,1301,5,12,0,0,1301,1303,5,176,0,0,
	1302,1300,1,0,0,0,1303,1304,1,0,0,0,1304,1302,1,0,0,0,1304,1305,1,0,0,0,
	1305,1306,1,0,0,0,1306,1307,7,8,0,0,1307,1308,3,222,111,0,1308,1309,5,2,
	0,0,1309,1380,1,0,0,0,1310,1313,5,176,0,0,1311,1312,5,12,0,0,1312,1314,
	5,176,0,0,1313,1311,1,0,0,0,1314,1315,1,0,0,0,1315,1313,1,0,0,0,1315,1316,
	1,0,0,0,1316,1321,1,0,0,0,1317,1318,5,66,0,0,1318,1319,3,222,111,0,1319,
	1320,5,67,0,0,1320,1322,1,0,0,0,1321,1317,1,0,0,0,1322,1323,1,0,0,0,1323,
	1321,1,0,0,0,1323,1324,1,0,0,0,1324,1325,1,0,0,0,1325,1326,7,8,0,0,1326,
	1327,3,222,111,0,1327,1328,5,2,0,0,1328,1380,1,0,0,0,1329,1330,5,74,0,0,
	1330,1331,5,12,0,0,1331,1340,5,176,0,0,1332,1333,5,66,0,0,1333,1334,3,222,
	111,0,1334,1335,5,67,0,0,1335,1337,1,0,0,0,1336,1332,1,0,0,0,1337,1338,
	1,0,0,0,1338,1336,1,0,0,0,1338,1339,1,0,0,0,1339,1341,1,0,0,0,1340,1336,
	1,0,0,0,1340,1341,1,0,0,0,1341,1346,1,0,0,0,1342,1343,5,12,0,0,1343,1345,
	5,176,0,0,1344,1342,1,0,0,0,1345,1348,1,0,0,0,1346,1344,1,0,0,0,1346,1347,
	1,0,0,0,1347,1349,1,0,0,0,1348,1346,1,0,0,0,1349,1350,7,9,0,0,1350,1380,
	5,2,0,0,1351,1356,5,176,0,0,1352,1353,5,66,0,0,1353,1354,3,222,111,0,1354,
	1355,5,67,0,0,1355,1357,1,0,0,0,1356,1352,1,0,0,0,1357,1358,1,0,0,0,1358,
	1356,1,0,0,0,1358,1359,1,0,0,0,1359,1364,1,0,0,0,1360,1361,5,12,0,0,1361,
	1363,5,176,0,0,1362,1360,1,0,0,0,1363,1366,1,0,0,0,1364,1362,1,0,0,0,1364,
	1365,1,0,0,0,1365,1367,1,0,0,0,1366,1364,1,0,0,0,1367,1368,7,9,0,0,1368,
	1369,5,2,0,0,1369,1380,1,0,0,0,1370,1373,5,176,0,0,1371,1372,5,12,0,0,1372,
	1374,5,176,0,0,1373,1371,1,0,0,0,1374,1375,1,0,0,0,1375,1373,1,0,0,0,1375,
	1376,1,0,0,0,1376,1377,1,0,0,0,1377,1378,7,9,0,0,1378,1380,5,2,0,0,1379,
	1255,1,0,0,0,1379,1279,1,0,0,0,1379,1299,1,0,0,0,1379,1310,1,0,0,0,1379,
	1329,1,0,0,0,1379,1351,1,0,0,0,1379,1370,1,0,0,0,1380,127,1,0,0,0,1381,
	1382,5,74,0,0,1382,1383,5,12,0,0,1383,1390,5,176,0,0,1384,1385,5,66,0,0,
	1385,1386,3,222,111,0,1386,1387,5,67,0,0,1387,1389,1,0,0,0,1388,1384,1,
	0,0,0,1389,1392,1,0,0,0,1390,1388,1,0,0,0,1390,1391,1,0,0,0,1391,1393,1,
	0,0,0,1392,1390,1,0,0,0,1393,1394,5,165,0,0,1394,1395,5,49,0,0,1395,1396,
	3,222,111,0,1396,1397,5,50,0,0,1397,1398,5,2,0,0,1398,129,1,0,0,0,1399,
	1403,3,234,117,0,1400,1402,3,226,113,0,1401,1400,1,0,0,0,1402,1405,1,0,
	0,0,1403,1401,1,0,0,0,1403,1404,1,0,0,0,1404,1406,1,0,0,0,1405,1403,1,0,
	0,0,1406,1409,3,14,7,0,1407,1408,5,40,0,0,1408,1410,3,222,111,0,1409,1407,
	1,0,0,0,1409,1410,1,0,0,0,1410,1411,1,0,0,0,1411,1412,5,2,0,0,1412,1428,
	1,0,0,0,1413,1417,3,82,41,0,1414,1416,3,226,113,0,1415,1414,1,0,0,0,1416,
	1419,1,0,0,0,1417,1415,1,0,0,0,1417,1418,1,0,0,0,1418,1420,1,0,0,0,1419,
	1417,1,0,0,0,1420,1423,3,14,7,0,1421,1422,5,40,0,0,1422,1424,3,222,111,
	0,1423,1421,1,0,0,0,1423,1424,1,0,0,0,1424,1425,1,0,0,0,1425,1426,5,2,0,
	0,1426,1428,1,0,0,0,1427,1399,1,0,0,0,1427,1413,1,0,0,0,1428,131,1,0,0,
	0,1429,1430,3,234,117,0,1430,1435,5,176,0,0,1431,1432,5,5,0,0,1432,1433,
	3,234,117,0,1433,1434,5,176,0,0,1434,1436,1,0,0,0,1435,1431,1,0,0,0,1436,
	1437,1,0,0,0,1437,1435,1,0,0,0,1437,1438,1,0,0,0,1438,1439,1,0,0,0,1439,
	1440,5,40,0,0,1440,1441,3,222,111,0,1441,1442,5,2,0,0,1442,1478,1,0,0,0,
	1443,1444,5,49,0,0,1444,1447,3,134,67,0,1445,1446,5,5,0,0,1446,1448,3,134,
	67,0,1447,1445,1,0,0,0,1448,1449,1,0,0,0,1449,1447,1,0,0,0,1449,1450,1,
	0,0,0,1450,1451,1,0,0,0,1451,1452,5,50,0,0,1452,1453,5,40,0,0,1453,1454,
	5,49,0,0,1454,1457,3,222,111,0,1455,1456,5,5,0,0,1456,1458,3,222,111,0,
	1457,1455,1,0,0,0,1458,1459,1,0,0,0,1459,1457,1,0,0,0,1459,1460,1,0,0,0,
	1460,1461,1,0,0,0,1461,1462,5,50,0,0,1462,1463,5,2,0,0,1463,1478,1,0,0,
	0,1464,1465,5,49,0,0,1465,1468,3,134,67,0,1466,1467,5,5,0,0,1467,1469,3,
	134,67,0,1468,1466,1,0,0,0,1469,1470,1,0,0,0,1470,1468,1,0,0,0,1470,1471,
	1,0,0,0,1471,1472,1,0,0,0,1472,1473,5,50,0,0,1473,1474,5,40,0,0,1474,1475,
	3,222,111,0,1475,1476,5,2,0,0,1476,1478,1,0,0,0,1477,1429,1,0,0,0,1477,
	1443,1,0,0,0,1477,1464,1,0,0,0,1478,133,1,0,0,0,1479,1483,3,234,117,0,1480,
	1482,3,226,113,0,1481,1480,1,0,0,0,1482,1485,1,0,0,0,1483,1481,1,0,0,0,
	1483,1484,1,0,0,0,1484,1486,1,0,0,0,1485,1483,1,0,0,0,1486,1487,5,176,0,
	0,1487,1491,1,0,0,0,1488,1491,5,176,0,0,1489,1491,1,0,0,0,1490,1479,1,0,
	0,0,1490,1488,1,0,0,0,1490,1489,1,0,0,0,1491,135,1,0,0,0,1492,1493,5,176,
	0,0,1493,1494,7,8,0,0,1494,1495,3,222,111,0,1495,1496,5,2,0,0,1496,1504,
	1,0,0,0,1497,1498,5,176,0,0,1498,1499,7,9,0,0,1499,1504,5,2,0,0,1500,1501,
	7,9,0,0,1501,1502,5,176,0,0,1502,1504,5,2,0,0,1503,1492,1,0,0,0,1503,1497,
	1,0,0,0,1503,1500,1,0,0,0,1504,137,1,0,0,0,1505,1506,5,176,0,0,1506,1507,
	5,161,0,0,1507,1508,5,49,0,0,1508,1509,3,222,111,0,1509,1510,5,50,0,0,1510,
	1511,5,2,0,0,1511,1522,1,0,0,0,1512,1513,5,176,0,0,1513,1514,5,12,0,0,1514,
	1515,5,176,0,0,1515,1516,5,161,0,0,1516,1517,5,49,0,0,1517,1518,3,222,111,
	0,1518,1519,5,50,0,0,1519,1520,5,2,0,0,1520,1522,1,0,0,0,1521,1505,1,0,
	0,0,1521,1512,1,0,0,0,1522,139,1,0,0,0,1523,1524,5,176,0,0,1524,1525,5,
	162,0,0,1525,1526,5,49,0,0,1526,1527,5,50,0,0,1527,1536,5,2,0,0,1528,1529,
	5,176,0,0,1529,1530,5,12,0,0,1530,1531,5,176,0,0,1531,1532,5,162,0,0,1532,
	1533,5,49,0,0,1533,1534,5,50,0,0,1534,1536,5,2,0,0,1535,1523,1,0,0,0,1535,
	1528,1,0,0,0,1536,141,1,0,0,0,1537,1538,5,176,0,0,1538,1539,5,165,0,0,1539,
	1540,5,49,0,0,1540,1541,3,222,111,0,1541,1542,5,50,0,0,1542,1543,5,2,0,
	0,1543,143,1,0,0,0,1544,1545,5,74,0,0,1545,1546,5,12,0,0,1546,1547,5,176,
	0,0,1547,1548,5,161,0,0,1548,1549,5,49,0,0,1549,1550,3,222,111,0,1550,1551,
	5,50,0,0,1551,1552,5,2,0,0,1552,145,1,0,0,0,1553,1554,5,74,0,0,1554,1555,
	5,12,0,0,1555,1556,5,176,0,0,1556,1557,5,162,0,0,1557,1558,5,49,0,0,1558,
	1559,5,50,0,0,1559,1560,5,2,0,0,1560,147,1,0,0,0,1561,1562,5,89,0,0,1562,
	1563,5,176,0,0,1563,1596,5,2,0,0,1564,1565,5,89,0,0,1565,1566,5,74,0,0,
	1566,1567,5,12,0,0,1567,1568,5,176,0,0,1568,1596,5,2,0,0,1569,1570,5,89,
	0,0,1570,1571,5,74,0,0,1571,1572,5,12,0,0,1572,1577,5,176,0,0,1573,1574,
	5,66,0,0,1574,1575,3,222,111,0,1575,1576,5,67,0,0,1576,1578,1,0,0,0,1577,
	1573,1,0,0,0,1578,1579,1,0,0,0,1579,1577,1,0,0,0,1579,1580,1,0,0,0,1580,
	1581,1,0,0,0,1581,1582,5,2,0,0,1582,1596,1,0,0,0,1583,1584,5,89,0,0,1584,
	1589,5,176,0,0,1585,1586,5,66,0,0,1586,1587,3,222,111,0,1587,1588,5,67,
	0,0,1588,1590,1,0,0,0,1589,1585,1,0,0,0,1590,1591,1,0,0,0,1591,1589,1,0,
	0,0,1591,1592,1,0,0,0,1592,1593,1,0,0,0,1593,1594,5,2,0,0,1594,1596,1,0,
	0,0,1595,1561,1,0,0,0,1595,1564,1,0,0,0,1595,1569,1,0,0,0,1595,1583,1,0,
	0,0,1596,149,1,0,0,0,1597,1598,5,90,0,0,1598,1599,5,49,0,0,1599,1600,5,
	150,0,0,1600,1601,5,23,0,0,1601,1604,3,222,111,0,1602,1603,5,5,0,0,1603,
	1605,3,200,100,0,1604,1602,1,0,0,0,1604,1605,1,0,0,0,1605,1606,1,0,0,0,
	1606,1607,5,50,0,0,1607,1608,5,2,0,0,1608,151,1,0,0,0,1609,1610,5,90,0,
	0,1610,1611,5,49,0,0,1611,1614,3,222,111,0,1612,1613,5,5,0,0,1613,1615,
	3,200,100,0,1614,1612,1,0,0,0,1614,1615,1,0,0,0,1615,1616,1,0,0,0,1616,
	1617,5,50,0,0,1617,1618,5,2,0,0,1618,153,1,0,0,0,1619,1620,5,91,0,0,1620,
	1621,5,49,0,0,1621,1622,3,222,111,0,1622,1623,5,50,0,0,1623,1626,3,108,
	54,0,1624,1625,5,92,0,0,1625,1627,3,108,54,0,1626,1624,1,0,0,0,1626,1627,
	1,0,0,0,1627,155,1,0,0,0,1628,1635,3,172,86,0,1629,1635,3,174,87,0,1630,
	1635,3,164,82,0,1631,1635,3,158,79,0,1632,1635,3,160,80,0,1633,1635,3,162,
	81,0,1634,1628,1,0,0,0,1634,1629,1,0,0,0,1634,1630,1,0,0,0,1634,1631,1,
	0,0,0,1634,1632,1,0,0,0,1634,1633,1,0,0,0,1635,157,1,0,0,0,1636,1637,5,
	9,0,0,1637,1638,5,49,0,0,1638,1639,3,234,117,0,1639,1640,5,176,0,0,1640,
	1641,5,5,0,0,1641,1642,3,234,117,0,1642,1643,5,176,0,0,1643,1644,5,93,0,
	0,1644,1645,5,74,0,0,1645,1646,5,12,0,0,1646,1647,5,176,0,0,1647,1648,5,
	12,0,0,1648,1649,5,34,0,0,1649,1650,5,50,0,0,1650,1651,3,108,54,0,1651,
	159,1,0,0,0,1652,1653,5,9,0,0,1653,1654,5,49,0,0,1654,1655,3,234,117,0,
	1655,1656,5,176,0,0,1656,1657,5,94,0,0,1657,1658,5,74,0,0,1658,1659,5,12,
	0,0,1659,1660,5,176,0,0,1660,1661,5,50,0,0,1661,1662,3,108,54,0,1662,161,
	1,0,0,0,1663,1664,5,9,0,0,1664,1665,5,49,0,0,1665,1666,3,234,117,0,1666,
	1667,5,176,0,0,1667,1668,5,93,0,0,1668,1669,5,74,0,0,1669,1670,5,12,0,0,
	1670,1671,5,176,0,0,1671,1672,5,50,0,0,1672,1673,3,108,54,0,1673,163,1,
	0,0,0,1674,1675,5,9,0,0,1675,1676,5,49,0,0,1676,1677,3,166,83,0,1677,1679,
	3,168,84,0,1678,1680,3,170,85,0,1679,1678,1,0,0,0,1679,1680,1,0,0,0,1680,
	1681,1,0,0,0,1681,1682,5,50,0,0,1682,1683,3,108,54,0,1683,165,1,0,0,0,1684,
	1688,3,234,117,0,1685,1687,3,226,113,0,1686,1685,1,0,0,0,1687,1690,1,0,
	0,0,1688,1686,1,0,0,0,1688,1689,1,0,0,0,1689,1691,1,0,0,0,1690,1688,1,0,
	0,0,1691,1694,5,176,0,0,1692,1693,5,40,0,0,1693,1695,3,222,111,0,1694,1692,
	1,0,0,0,1694,1695,1,0,0,0,1695,1696,1,0,0,0,1696,1697,5,2,0,0,1697,167,
	1,0,0,0,1698,1699,3,222,111,0,1699,1700,5,2,0,0,1700,169,1,0,0,0,1701,1702,
	5,176,0,0,1702,1703,7,8,0,0,1703,1709,3,222,111,0,1704,1705,5,176,0,0,1705,
	1709,7,9,0,0,1706,1707,7,9,0,0,1707,1709,5,176,0,0,1708,1701,1,0,0,0,1708,
	1704,1,0,0,0,1708,1706,1,0,0,0,1709,171,1,0,0,0,1710,1711,5,95,0,0,1711,
	1712,3,108,54,0,1712,1713,5,96,0,0,1713,1714,5,49,0,0,1714,1715,3,222,111,
	0,1715,1716,5,50,0,0,1716,1717,5,2,0,0,1717,173,1,0,0,0,1718,1719,5,96,
	0,0,1719,1720,5,49,0,0,1720,1721,3,222,111,0,1721,1722,5,50,0,0,1722,1723,
	3,108,54,0,1723,175,1,0,0,0,1724,1725,5,97,0,0,1725,1726,3,208,104,0,1726,
	1727,5,2,0,0,1727,177,1,0,0,0,1728,1729,5,98,0,0,1729,1733,5,4,0,0,1730,
	1732,3,180,90,0,1731,1730,1,0,0,0,1732,1735,1,0,0,0,1733,1731,1,0,0,0,1733,
	1734,1,0,0,0,1734,1736,1,0,0,0,1735,1733,1,0,0,0,1736,1737,5,6,0,0,1737,
	179,1,0,0,0,1738,1739,7,10,0,0,1739,181,1,0,0,0,1740,1741,5,99,0,0,1741,
	1745,5,4,0,0,1742,1744,3,110,55,0,1743,1742,1,0,0,0,1744,1747,1,0,0,0,1745,
	1743,1,0,0,0,1745,1746,1,0,0,0,1746,1748,1,0,0,0,1747,1745,1,0,0,0,1748,
	1749,5,6,0,0,1749,183,1,0,0,0,1750,1751,5,100,0,0,1751,1752,5,49,0,0,1752,
	1753,3,222,111,0,1753,1754,5,50,0,0,1754,1758,5,4,0,0,1755,1757,3,186,93,
	0,1756,1755,1,0,0,0,1757,1760,1,0,0,0,1758,1756,1,0,0,0,1758,1759,1,0,0,
	0,1759,1762,1,0,0,0,1760,1758,1,0,0,0,1761,1763,3,188,94,0,1762,1761,1,
	0,0,0,1762,1763,1,0,0,0,1763,1764,1,0,0,0,1764,1765,5,6,0,0,1765,185,1,
	0,0,0,1766,1767,5,101,0,0,1767,1768,3,222,111,0,1768,1772,5,102,0,0,1769,
	1771,3,110,55,0,1770,1769,1,0,0,0,1771,1774,1,0,0,0,1772,1770,1,0,0,0,1772,
	1773,1,0,0,0,1773,187,1,0,0,0,1774,1772,1,0,0,0,1775,1776,5,103,0,0,1776,
	1780,5,102,0,0,1777,1779,3,110,55,0,1778,1777,1,0,0,0,1779,1782,1,0,0,0,
	1780,1778,1,0,0,0,1780,1781,1,0,0,0,1781,189,1,0,0,0,1782,1780,1,0,0,0,
	1783,1784,5,104,0,0,1784,1786,3,222,111,0,1785,1787,3,192,96,0,1786,1785,
	1,0,0,0,1786,1787,1,0,0,0,1787,1788,1,0,0,0,1788,1790,3,108,54,0,1789,1791,
	3,194,97,0,1790,1789,1,0,0,0,1791,1792,1,0,0,0,1792,1790,1,0,0,0,1792,1793,
	1,0,0,0,1793,191,1,0,0,0,1794,1795,5,73,0,0,1795,1807,5,49,0,0,1796,1801,
	3,106,53,0,1797,1798,5,5,0,0,1798,1800,3,106,53,0,1799,1797,1,0,0,0,1800,
	1803,1,0,0,0,1801,1799,1,0,0,0,1801,1802,1,0,0,0,1802,1805,1,0,0,0,1803,
	1801,1,0,0,0,1804,1806,5,5,0,0,1805,1804,1,0,0,0,1805,1806,1,0,0,0,1806,
	1808,1,0,0,0,1807,1796,1,0,0,0,1807,1808,1,0,0,0,1808,1809,1,0,0,0,1809,
	1810,5,50,0,0,1810,193,1,0,0,0,1811,1813,5,105,0,0,1812,1814,5,176,0,0,
	1813,1812,1,0,0,0,1813,1814,1,0,0,0,1814,1830,1,0,0,0,1815,1827,5,49,0,
	0,1816,1821,3,106,53,0,1817,1818,5,5,0,0,1818,1820,3,106,53,0,1819,1817,
	1,0,0,0,1820,1823,1,0,0,0,1821,1819,1,0,0,0,1821,1822,1,0,0,0,1822,1825,
	1,0,0,0,1823,1821,1,0,0,0,1824,1826,5,5,0,0,1825,1824,1,0,0,0,1825,1826,
	1,0,0,0,1826,1828,1,0,0,0,1827,1816,1,0,0,0,1827,1828,1,0,0,0,1828,1829,
	1,0,0,0,1829,1831,5,50,0,0,1830,1815,1,0,0,0,1830,1831,1,0,0,0,1831,1832,
	1,0,0,0,1832,1833,3,108,54,0,1833,195,1,0,0,0,1834,1835,5,106,0,0,1835,
	1836,5,2,0,0,1836,197,1,0,0,0,1837,1838,5,107,0,0,1838,1839,5,2,0,0,1839,
	199,1,0,0,0,1840,1844,5,147,0,0,1841,1842,5,176,0,0,1842,1844,3,214,107,
	0,1843,1840,1,0,0,0,1843,1841,1,0,0,0,1844,201,1,0,0,0,1845,1846,5,36,0,
	0,1846,1849,5,176,0,0,1847,1848,5,12,0,0,1848,1850,5,176,0,0,1849,1847,
	1,0,0,0,1849,1850,1,0,0,0,1850,1851,1,0,0,0,1851,1852,5,49,0,0,1852,1864,
	5,4,0,0,1853,1858,3,212,106,0,1854,1855,5,5,0,0,1855,1857,3,212,106,0,1856,
	1854,1,0,0,0,1857,1860,1,0,0,0,1858,1856,1,0,0,0,1858,1859,1,0,0,0,1859,
	1862,1,0,0,0,1860,1858,1,0,0,0,1861,1863,5,5,0,0,1862,1861,1,0,0,0,1862,
	1863,1,0,0,0,1863,1865,1,0,0,0,1864,1853,1,0,0,0,1864,1865,1,0,0,0,1865,
	1866,1,0,0,0,1866,1867,5,6,0,0,1867,1868,5,50,0,0,1868,1888,5,2,0,0,1869,
	1870,5,36,0,0,1870,1873,5,176,0,0,1871,1872,5,12,0,0,1872,1874,5,176,0,
	0,1873,1871,1,0,0,0,1873,1874,1,0,0,0,1874,1875,1,0,0,0,1875,1876,3,214,
	107,0,1876,1877,5,2,0,0,1877,1888,1,0,0,0,1878,1879,5,36,0,0,1879,1880,
	5,49,0,0,1880,1881,5,147,0,0,1881,1882,5,50,0,0,1882,1888,5,2,0,0,1883,
	1884,5,36,0,0,1884,1885,5,49,0,0,1885,1886,5,50,0,0,1886,1888,5,2,0,0,1887,
	1845,1,0,0,0,1887,1869,1,0,0,0,1887,1878,1,0,0,0,1887,1883,1,0,0,0,1888,
	203,1,0,0,0,1889,1890,5,108,0,0,1890,1891,5,49,0,0,1891,1892,3,222,111,
	0,1892,1893,5,50,0,0,1893,1894,5,2,0,0,1894,205,1,0,0,0,1895,1898,5,176,
	0,0,1896,1898,3,228,114,0,1897,1895,1,0,0,0,1897,1896,1,0,0,0,1898,207,
	1,0,0,0,1899,1911,5,49,0,0,1900,1905,3,206,103,0,1901,1902,5,5,0,0,1902,
	1904,3,206,103,0,1903,1901,1,0,0,0,1904,1907,1,0,0,0,1905,1903,1,0,0,0,
	1905,1906,1,0,0,0,1906,1909,1,0,0,0,1907,1905,1,0,0,0,1908,1910,5,5,0,0,
	1909,1908,1,0,0,0,1909,1910,1,0,0,0,1910,1912,1,0,0,0,1911,1900,1,0,0,0,
	1911,1912,1,0,0,0,1912,1913,1,0,0,0,1913,1914,5,50,0,0,1914,209,1,0,0,0,
	1915,1916,5,176,0,0,1916,1940,3,214,107,0,1917,1918,5,176,0,0,1918,1919,
	5,12,0,0,1919,1920,5,176,0,0,1920,1940,3,214,107,0,1921,1922,5,176,0,0,
	1922,1923,5,49,0,0,1923,1935,5,4,0,0,1924,1929,3,212,106,0,1925,1926,5,
	5,0,0,1926,1928,3,212,106,0,1927,1925,1,0,0,0,1928,1931,1,0,0,0,1929,1927,
	1,0,0,0,1929,1930,1,0,0,0,1930,1933,1,0,0,0,1931,1929,1,0,0,0,1932,1934,
	5,5,0,0,1933,1932,1,0,0,0,1933,1934,1,0,0,0,1934,1936,1,0,0,0,1935,1924,
	1,0,0,0,1935,1936,1,0,0,0,1936,1937,1,0,0,0,1937,1938,5,6,0,0,1938,1940,
	5,50,0,0,1939,1915,1,0,0,0,1939,1917,1,0,0,0,1939,1921,1,0,0,0,1940,211,
	1,0,0,0,1941,1942,5,176,0,0,1942,1943,5,102,0,0,1943,1944,3,222,111,0,1944,
	213,1,0,0,0,1945,1957,5,49,0,0,1946,1951,3,222,111,0,1947,1948,5,5,0,0,
	1948,1950,3,222,111,0,1949,1947,1,0,0,0,1950,1953,1,0,0,0,1951,1949,1,0,
	0,0,1951,1952,1,0,0,0,1952,1955,1,0,0,0,1953,1951,1,0,0,0,1954,1956,5,5,
	0,0,1955,1954,1,0,0,0,1955,1956,1,0,0,0,1956,1958,1,0,0,0,1957,1946,1,0,
	0,0,1957,1958,1,0,0,0,1958,1959,1,0,0,0,1959,1960,5,50,0,0,1960,215,1,0,
	0,0,1961,1962,5,4,0,0,1962,1967,3,218,109,0,1963,1964,5,5,0,0,1964,1966,
	3,218,109,0,1965,1963,1,0,0,0,1966,1969,1,0,0,0,1967,1965,1,0,0,0,1967,
	1968,1,0,0,0,1968,1971,1,0,0,0,1969,1967,1,0,0,0,1970,1972,5,5,0,0,1971,
	1970,1,0,0,0,1971,1972,1,0,0,0,1972,1973,1,0,0,0,1973,1974,5,6,0,0,1974,
	217,1,0,0,0,1975,1976,5,176,0,0,1976,1977,5,102,0,0,1977,1978,3,222,111,
	0,1978,219,1,0,0,0,1979,1980,5,49,0,0,1980,1985,3,234,117,0,1981,1982,5,
	5,0,0,1982,1984,3,234,117,0,1983,1981,1,0,0,0,1984,1987,1,0,0,0,1985,1983,
	1,0,0,0,1985,1986,1,0,0,0,1986,1989,1,0,0,0,1987,1985,1,0,0,0,1988,1990,
	5,5,0,0,1989,1988,1,0,0,0,1989,1990,1,0,0,0,1990,1991,1,0,0,0,1991,1992,
	5,50,0,0,1992,221,1,0,0,0,1993,1994,6,111,-1,0,1994,1995,5,49,0,0,1995,
	1996,5,176,0,0,1996,1997,7,8,0,0,1997,1998,3,222,111,0,1998,1999,5,50,0,
	0,1999,2139,1,0,0,0,2000,2001,5,49,0,0,2001,2002,3,222,111,0,2002,2003,
	5,50,0,0,2003,2139,1,0,0,0,2004,2005,5,49,0,0,2005,2008,3,222,111,0,2006,
	2007,5,5,0,0,2007,2009,3,222,111,0,2008,2006,1,0,0,0,2009,2010,1,0,0,0,
	2010,2008,1,0,0,0,2010,2011,1,0,0,0,2011,2012,1,0,0,0,2012,2013,5,50,0,
	0,2013,2139,1,0,0,0,2014,2015,3,236,118,0,2015,2016,5,49,0,0,2016,2018,
	3,222,111,0,2017,2019,5,5,0,0,2018,2017,1,0,0,0,2018,2019,1,0,0,0,2019,
	2020,1,0,0,0,2020,2021,5,50,0,0,2021,2139,1,0,0,0,2022,2139,3,210,105,0,
	2023,2024,5,109,0,0,2024,2026,5,176,0,0,2025,2027,3,216,108,0,2026,2025,
	1,0,0,0,2026,2027,1,0,0,0,2027,2028,1,0,0,0,2028,2139,3,214,107,0,2029,
	2030,5,109,0,0,2030,2031,3,234,117,0,2031,2032,5,66,0,0,2032,2033,5,67,
	0,0,2033,2034,5,49,0,0,2034,2035,3,222,111,0,2035,2036,5,50,0,0,2036,2139,
	1,0,0,0,2037,2038,5,55,0,0,2038,2039,5,49,0,0,2039,2040,3,234,117,0,2040,
	2041,5,50,0,0,2041,2042,5,12,0,0,2042,2043,5,176,0,0,2043,2139,1,0,0,0,
	2044,2045,5,110,0,0,2045,2139,3,214,107,0,2046,2047,5,111,0,0,2047,2139,
	3,214,107,0,2048,2049,5,112,0,0,2049,2139,3,214,107,0,2050,2051,5,113,0,
	0,2051,2139,3,214,107,0,2052,2053,5,114,0,0,2053,2054,5,49,0,0,2054,2055,
	5,176,0,0,2055,2056,5,12,0,0,2056,2057,5,176,0,0,2057,2058,5,5,0,0,2058,
	2059,3,214,107,0,2059,2060,5,50,0,0,2060,2139,1,0,0,0,2061,2062,5,115,0,
	0,2062,2139,3,214,107,0,2063,2064,5,116,0,0,2064,2139,3,214,107,0,2065,
	2066,5,117,0,0,2066,2067,5,49,0,0,2067,2068,3,222,111,0,2068,2069,5,5,0,
	0,2069,2070,3,220,110,0,2070,2071,5,50,0,0,2071,2139,1,0,0,0,2072,2073,
	5,118,0,0,2073,2074,5,49,0,0,2074,2075,3,222,111,0,2075,2076,5,5,0,0,2076,
	2077,3,220,110,0,2077,2078,5,5,0,0,2078,2079,5,141,0,0,2079,2080,5,50,0,
	0,2080,2139,1,0,0,0,2081,2082,5,119,0,0,2082,2083,5,66,0,0,2083,2084,3,
	222,111,0,2084,2085,5,67,0,0,2085,2086,7,11,0,0,2086,2139,1,0,0,0,2087,
	2088,5,120,0,0,2088,2089,5,66,0,0,2089,2090,3,222,111,0,2090,2091,5,67,
	0,0,2091,2092,7,12,0,0,2092,2139,1,0,0,0,2093,2094,7,13,0,0,2094,2139,3,
	222,111,21,2095,2107,5,66,0,0,2096,2101,3,222,111,0,2097,2098,5,5,0,0,2098,
	2100,3,222,111,0,2099,2097,1,0,0,0,2100,2103,1,0,0,0,2101,2099,1,0,0,0,
	2101,2102,1,0,0,0,2102,2105,1,0,0,0,2103,2101,1,0,0,0,2104,2106,5,5,0,0,
	2105,2104,1,0,0,0,2105,2106,1,0,0,0,2106,2108,1,0,0,0,2107,2096,1,0,0,0,
	2107,2108,1,0,0,0,2108,2109,1,0,0,0,2109,2139,5,67,0,0,2110,2111,5,74,0,
	0,2111,2112,5,12,0,0,2112,2113,5,176,0,0,2113,2114,5,12,0,0,2114,2115,5,
	176,0,0,2115,2116,5,66,0,0,2116,2117,3,222,111,0,2117,2118,5,67,0,0,2118,
	2119,3,224,112,0,2119,2139,1,0,0,0,2120,2121,5,74,0,0,2121,2122,5,12,0,
	0,2122,2127,5,176,0,0,2123,2124,5,66,0,0,2124,2125,3,222,111,0,2125,2126,
	5,67,0,0,2126,2128,1,0,0,0,2127,2123,1,0,0,0,2128,2129,1,0,0,0,2129,2127,
	1,0,0,0,2129,2130,1,0,0,0,2130,2139,1,0,0,0,2131,2132,5,74,0,0,2132,2133,
	5,12,0,0,2133,2139,5,176,0,0,2134,2139,5,74,0,0,2135,2139,5,156,0,0,2136,
	2139,3,14,7,0,2137,2139,3,228,114,0,2138,1993,1,0,0,0,2138,2000,1,0,0,0,
	2138,2004,1,0,0,0,2138,2014,1,0,0,0,2138,2022,1,0,0,0,2138,2023,1,0,0,0,
	2138,2029,1,0,0,0,2138,2037,1,0,0,0,2138,2044,1,0,0,0,2138,2046,1,0,0,0,
	2138,2048,1,0,0,0,2138,2050,1,0,0,0,2138,2052,1,0,0,0,2138,2061,1,0,0,0,
	2138,2063,1,0,0,0,2138,2065,1,0,0,0,2138,2072,1,0,0,0,2138,2081,1,0,0,0,
	2138,2087,1,0,0,0,2138,2093,1,0,0,0,2138,2095,1,0,0,0,2138,2110,1,0,0,0,
	2138,2120,1,0,0,0,2138,2131,1,0,0,0,2138,2134,1,0,0,0,2138,2135,1,0,0,0,
	2138,2136,1,0,0,0,2138,2137,1,0,0,0,2139,2245,1,0,0,0,2140,2141,10,20,0,
	0,2141,2142,5,17,0,0,2142,2244,3,222,111,20,2143,2144,10,19,0,0,2144,2145,
	7,14,0,0,2145,2244,3,222,111,20,2146,2147,10,18,0,0,2147,2148,7,15,0,0,
	2148,2244,3,222,111,19,2149,2150,10,17,0,0,2150,2151,7,16,0,0,2151,2244,
	3,222,111,18,2152,2153,10,16,0,0,2153,2154,7,17,0,0,2154,2244,3,222,111,
	17,2155,2156,10,15,0,0,2156,2157,7,18,0,0,2157,2244,3,222,111,16,2158,2159,
	10,14,0,0,2159,2160,5,24,0,0,2160,2244,3,222,111,15,2161,2162,10,13,0,0,
	2162,2163,5,26,0,0,2163,2244,3,222,111,14,2164,2165,10,12,0,0,2165,2166,
	5,25,0,0,2166,2244,3,222,111,13,2167,2168,10,11,0,0,2168,2169,5,125,0,0,
	2169,2244,3,222,111,12,2170,2171,10,10,0,0,2171,2172,5,126,0,0,2172,2244,
	3,222,111,11,2173,2174,10,9,0,0,2174,2175,5,127,0,0,2175,2176,3,222,111,
	0,2176,2177,5,102,0,0,2177,2178,3,222,111,9,2178,2244,1,0,0,0,2179,2180,
	10,32,0,0,2180,2181,5,66,0,0,2181,2182,3,222,111,0,2182,2183,5,102,0,0,
	2183,2184,3,222,111,0,2184,2185,5,67,0,0,2185,2244,1,0,0,0,2186,2187,10,
	31,0,0,2187,2188,5,66,0,0,2188,2189,5,141,0,0,2189,2244,5,67,0,0,2190,2191,
	10,30,0,0,2191,2192,5,66,0,0,2192,2193,3,222,111,0,2193,2194,5,67,0,0,2194,
	2244,1,0,0,0,2195,2196,10,27,0,0,2196,2244,7,19,0,0,2197,2198,10,26,0,0,
	2198,2199,5,163,0,0,2199,2200,5,49,0,0,2200,2201,3,222,111,0,2201,2202,
	5,50,0,0,2202,2244,1,0,0,0,2203,2204,10,25,0,0,2204,2205,5,164,0,0,2205,
	2206,5,49,0,0,2206,2207,3,222,111,0,2207,2208,5,5,0,0,2208,2209,3,222,111,
	0,2209,2210,5,50,0,0,2210,2244,1,0,0,0,2211,2212,10,24,0,0,2212,2213,5,
	12,0,0,2213,2215,5,176,0,0,2214,2216,3,216,108,0,2215,2214,1,0,0,0,2215,
	2216,1,0,0,0,2216,2217,1,0,0,0,2217,2218,5,49,0,0,2218,2230,5,4,0,0,2219,
	2224,3,212,106,0,2220,2221,5,5,0,0,2221,2223,3,212,106,0,2222,2220,1,0,
	0,0,2223,2226,1,0,0,0,2224,2222,1,0,0,0,2224,2225,1,0,0,0,2225,2228,1,0,
	0,0,2226,2224,1,0,0,0,2227,2229,5,5,0,0,2228,2227,1,0,0,0,2228,2229,1,0,
	0,0,2229,2231,1,0,0,0,2230,2219,1,0,0,0,2230,2231,1,0,0,0,2231,2232,1,0,
	0,0,2232,2233,5,6,0,0,2233,2244,5,50,0,0,2234,2235,10,23,0,0,2235,2236,
	5,12,0,0,2236,2238,5,176,0,0,2237,2239,3,216,108,0,2238,2237,1,0,0,0,2238,
	2239,1,0,0,0,2239,2240,1,0,0,0,2240,2244,3,214,107,0,2241,2242,10,22,0,
	0,2242,2244,3,224,112,0,2243,2140,1,0,0,0,2243,2143,1,0,0,0,2243,2146,1,
	0,0,0,2243,2149,1,0,0,0,2243,2152,1,0,0,0,2243,2155,1,0,0,0,2243,2158,1,
	0,0,0,2243,2161,1,0,0,0,2243,2164,1,0,0,0,2243,2167,1,0,0,0,2243,2170,1,
	0,0,0,2243,2173,1,0,0,0,2243,2179,1,0,0,0,2243,2186,1,0,0,0,2243,2190,1,
	0,0,0,2243,2195,1,0,0,0,2243,2197,1,0,0,0,2243,2203,1,0,0,0,2243,2211,1,
	0,0,0,2243,2234,1,0,0,0,2243,2241,1,0,0,0,2244,2247,1,0,0,0,2245,2243,1,
	0,0,0,2245,2246,1,0,0,0,2246,223,1,0,0,0,2247,2245,1,0,0,0,2248,2249,5,
	12,0,0,2249,2262,5,176,0,0,2250,2262,5,159,0,0,2251,2262,5,168,0,0,2252,
	2262,5,169,0,0,2253,2262,5,170,0,0,2254,2262,5,171,0,0,2255,2262,5,172,
	0,0,2256,2262,5,173,0,0,2257,2262,5,174,0,0,2258,2262,5,175,0,0,2259,2262,
	5,166,0,0,2260,2262,5,167,0,0,2261,2248,1,0,0,0,2261,2250,1,0,0,0,2261,
	2251,1,0,0,0,2261,2252,1,0,0,0,2261,2253,1,0,0,0,2261,2254,1,0,0,0,2261,
	2255,1,0,0,0,2261,2256,1,0,0,0,2261,2257,1,0,0,0,2261,2258,1,0,0,0,2261,
	2259,1,0,0,0,2261,2260,1,0,0,0,2262,225,1,0,0,0,2263,2264,7,20,0,0,2264,
	227,1,0,0,0,2265,2280,5,137,0,0,2266,2280,3,230,115,0,2267,2280,3,232,116,
	0,2268,2272,5,147,0,0,2269,2271,5,147,0,0,2270,2269,1,0,0,0,2271,2274,1,
	0,0,0,2272,2270,1,0,0,0,2272,2273,1,0,0,0,2273,2280,1,0,0,0,2274,2272,1,
	0,0,0,2275,2280,5,157,0,0,2276,2280,5,158,0,0,2277,2280,5,148,0,0,2278,
	2280,5,149,0,0,2279,2265,1,0,0,0,2279,2266,1,0,0,0,2279,2267,1,0,0,0,2279,
	2268,1,0,0,0,2279,2275,1,0,0,0,2279,2276,1,0,0,0,2279,2277,1,0,0,0,2279,
	2278,1,0,0,0,2280,229,1,0,0,0,2281,2283,5,141,0,0,2282,2284,7,21,0,0,2283,
	2282,1,0,0,0,2283,2284,1,0,0,0,2284,231,1,0,0,0,2285,2286,5,140,0,0,2286,
	233,1,0,0,0,2287,2288,5,133,0,0,2288,2332,5,59,0,0,2289,2332,5,133,0,0,
	2290,2332,5,142,0,0,2291,2332,5,143,0,0,2292,2332,5,145,0,0,2293,2332,5,
	144,0,0,2294,2332,5,152,0,0,2295,2332,5,153,0,0,2296,2332,5,134,0,0,2297,
	2332,5,135,0,0,2298,2332,5,154,0,0,2299,2332,5,155,0,0,2300,2301,5,7,0,
	0,2301,2310,5,49,0,0,2302,2307,3,234,117,0,2303,2304,5,5,0,0,2304,2306,
	3,234,117,0,2305,2303,1,0,0,0,2306,2309,1,0,0,0,2307,2305,1,0,0,0,2307,
	2308,1,0,0,0,2308,2311,1,0,0,0,2309,2307,1,0,0,0,2310,2302,1,0,0,0,2310,
	2311,1,0,0,0,2311,2312,1,0,0,0,2312,2325,5,50,0,0,2313,2314,5,73,0,0,2314,
	2315,5,49,0,0,2315,2320,3,234,117,0,2316,2317,5,5,0,0,2317,2319,3,234,117,
	0,2318,2316,1,0,0,0,2319,2322,1,0,0,0,2320,2318,1,0,0,0,2320,2321,1,0,0,
	0,2321,2323,1,0,0,0,2322,2320,1,0,0,0,2323,2324,5,50,0,0,2324,2326,1,0,
	0,0,2325,2313,1,0,0,0,2325,2326,1,0,0,0,2326,2332,1,0,0,0,2327,2328,5,176,
	0,0,2328,2329,5,12,0,0,2329,2332,5,176,0,0,2330,2332,5,176,0,0,2331,2287,
	1,0,0,0,2331,2289,1,0,0,0,2331,2290,1,0,0,0,2331,2291,1,0,0,0,2331,2292,
	1,0,0,0,2331,2293,1,0,0,0,2331,2294,1,0,0,0,2331,2295,1,0,0,0,2331,2296,
	1,0,0,0,2331,2297,1,0,0,0,2331,2298,1,0,0,0,2331,2299,1,0,0,0,2331,2300,
	1,0,0,0,2331,2327,1,0,0,0,2331,2330,1,0,0,0,2332,235,1,0,0,0,2333,2334,
	7,22,0,0,2334,237,1,0,0,0,245,241,247,260,262,282,286,293,298,306,310,316,
	326,329,339,343,349,352,356,361,365,380,383,397,400,411,413,428,443,447,
	457,463,469,475,481,487,493,499,505,511,516,524,527,544,546,553,561,567,
	571,583,587,589,593,599,602,614,618,620,634,641,654,658,665,685,691,698,
	709,715,722,730,741,750,756,762,771,777,782,788,795,801,807,811,815,823,
	828,836,846,851,855,867,876,878,884,890,897,908,914,918,924,931,947,956,
	960,966,975,979,987,991,997,1001,1003,1011,1015,1017,1025,1029,1035,1039,
	1045,1049,1051,1057,1062,1095,1121,1135,1147,1151,1156,1161,1170,1174,1176,
	1198,1203,1209,1224,1233,1237,1239,1248,1253,1264,1266,1272,1286,1292,1304,
	1315,1323,1338,1340,1346,1358,1364,1375,1379,1390,1403,1409,1417,1423,1427,
	1437,1449,1459,1470,1477,1483,1490,1503,1521,1535,1579,1591,1595,1604,1614,
	1626,1634,1679,1688,1694,1708,1733,1745,1758,1762,1772,1780,1786,1792,1801,
	1805,1807,1813,1821,1825,1827,1830,1843,1849,1858,1862,1864,1873,1887,1897,
	1905,1909,1911,1929,1933,1935,1939,1951,1955,1957,1967,1971,1985,1989,2010,
	2018,2026,2101,2105,2107,2129,2138,2215,2224,2228,2230,2238,2243,2245,2261,
	2272,2279,2283,2307,2310,2320,2325,2331];

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
	public stateVariableDeclaration_list(): StateVariableDeclarationContext[] {
		return this.getTypedRuleContexts(StateVariableDeclarationContext) as StateVariableDeclarationContext[];
	}
	public stateVariableDeclaration(i: number): StateVariableDeclarationContext {
		return this.getTypedRuleContext(StateVariableDeclarationContext, i) as StateVariableDeclarationContext;
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
	public DotDelete(): TerminalNode {
		return this.getToken(SolidCashParser.DotDelete, 0);
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
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public DotPush(): TerminalNode {
		return this.getToken(SolidCashParser.DotPush, 0);
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
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public DotPop(): TerminalNode {
		return this.getToken(SolidCashParser.DotPop, 0);
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
	public DotDelete(): TerminalNode {
		return this.getToken(SolidCashParser.DotDelete, 0);
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
	public DotPush(): TerminalNode {
		return this.getToken(SolidCashParser.DotPush, 0);
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
	public DotPop(): TerminalNode {
		return this.getToken(SolidCashParser.DotPop, 0);
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
	public DotSplit(): TerminalNode {
		return this.getToken(SolidCashParser.DotSplit, 0);
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
	public DotValue(): TerminalNode {
		return this.getToken(SolidCashParser.DotValue, 0);
	}
	public DotLockingBytecode(): TerminalNode {
		return this.getToken(SolidCashParser.DotLockingBytecode, 0);
	}
	public DotTokenCategory(): TerminalNode {
		return this.getToken(SolidCashParser.DotTokenCategory, 0);
	}
	public DotNftCommitment(): TerminalNode {
		return this.getToken(SolidCashParser.DotNftCommitment, 0);
	}
	public DotTokenAmount(): TerminalNode {
		return this.getToken(SolidCashParser.DotTokenAmount, 0);
	}
	public DotOutpointTransactionHash(): TerminalNode {
		return this.getToken(SolidCashParser.DotOutpointTransactionHash, 0);
	}
	public DotOutpointIndex(): TerminalNode {
		return this.getToken(SolidCashParser.DotOutpointIndex, 0);
	}
	public DotUnlockingBytecode(): TerminalNode {
		return this.getToken(SolidCashParser.DotUnlockingBytecode, 0);
	}
	public DotSequenceNumber(): TerminalNode {
		return this.getToken(SolidCashParser.DotSequenceNumber, 0);
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
	public DotLength(): TerminalNode {
		return this.getToken(SolidCashParser.DotLength, 0);
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
	public DotSlice(): TerminalNode {
		return this.getToken(SolidCashParser.DotSlice, 0);
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
	public DotValue(): TerminalNode {
		return this.getToken(SolidCashParser.DotValue, 0);
	}
	public DotLockingBytecode(): TerminalNode {
		return this.getToken(SolidCashParser.DotLockingBytecode, 0);
	}
	public DotTokenCategory(): TerminalNode {
		return this.getToken(SolidCashParser.DotTokenCategory, 0);
	}
	public DotNftCommitment(): TerminalNode {
		return this.getToken(SolidCashParser.DotNftCommitment, 0);
	}
	public DotTokenAmount(): TerminalNode {
		return this.getToken(SolidCashParser.DotTokenAmount, 0);
	}
	public DotOutpointTransactionHash(): TerminalNode {
		return this.getToken(SolidCashParser.DotOutpointTransactionHash, 0);
	}
	public DotOutpointIndex(): TerminalNode {
		return this.getToken(SolidCashParser.DotOutpointIndex, 0);
	}
	public DotUnlockingBytecode(): TerminalNode {
		return this.getToken(SolidCashParser.DotUnlockingBytecode, 0);
	}
	public DotSequenceNumber(): TerminalNode {
		return this.getToken(SolidCashParser.DotSequenceNumber, 0);
	}
	public DotCode(): TerminalNode {
		return this.getToken(SolidCashParser.DotCode, 0);
	}
	public DotCodehash(): TerminalNode {
		return this.getToken(SolidCashParser.DotCodehash, 0);
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
