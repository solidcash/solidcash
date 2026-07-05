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
	public static readonly VersionLiteral = 140;
	public static readonly BooleanLiteral = 141;
	public static readonly NumberUnit = 142;
	public static readonly BchUnit = 143;
	public static readonly DecimalLiteral = 144;
	public static readonly NumberLiteral = 145;
	public static readonly PrimitiveType = 146;
	public static readonly CryptoType = 147;
	public static readonly UnboundedBytes = 148;
	public static readonly BoundedBytes = 149;
	public static readonly Bound = 150;
	public static readonly StringLiteral = 151;
	public static readonly DateLiteral = 152;
	public static readonly HexLiteral = 153;
	public static readonly TxVar = 154;
	public static readonly UnsafeCast = 155;
	public static readonly BoundedSignedInt = 156;
	public static readonly BoundedUnsignedInt = 157;
	public static readonly BoundedSignedFixed = 158;
	public static readonly BoundedUnsignedFixed = 159;
	public static readonly NullaryOp = 160;
	public static readonly UnicodeLiteral = 161;
	public static readonly HexStringLiteral = 162;
	public static readonly DotValue = 163;
	public static readonly DotLength = 164;
	public static readonly DotPush = 165;
	public static readonly DotPop = 166;
	public static readonly DotSplit = 167;
	public static readonly DotSlice = 168;
	public static readonly DotDelete = 169;
	public static readonly DotCode = 170;
	public static readonly DotCodehash = 171;
	public static readonly DotLockingBytecode = 172;
	public static readonly DotTokenCategory = 173;
	public static readonly DotNftCommitment = 174;
	public static readonly DotTokenAmount = 175;
	public static readonly DotOutpointTransactionHash = 176;
	public static readonly DotOutpointIndex = 177;
	public static readonly DotUnlockingBytecode = 178;
	public static readonly DotSequenceNumber = 179;
	public static readonly Identifier = 180;
	public static readonly WHITESPACE = 181;
	public static readonly COMMENT = 182;
	public static readonly LINE_COMMENT = 183;
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
	public static readonly RULE_receiveModifier = 36;
	public static readonly RULE_parentInvocation = 37;
	public static readonly RULE_stateVariableDeclaration = 38;
	public static readonly RULE_collectionModifier = 39;
	public static readonly RULE_stateVariableVisibility = 40;
	public static readonly RULE_mappingType = 41;
	public static readonly RULE_arrayType = 42;
	public static readonly RULE_modifierDefinition = 43;
	public static readonly RULE_modifierStatement = 44;
	public static readonly RULE_placeholderStatement = 45;
	public static readonly RULE_functionDefinition = 46;
	public static readonly RULE_customModifierInvocation = 47;
	public static readonly RULE_functionModifier = 48;
	public static readonly RULE_overrideSpecifier = 49;
	public static readonly RULE_unsafeModifier = 50;
	public static readonly RULE_returnType = 51;
	public static readonly RULE_returnParam = 52;
	public static readonly RULE_parameterList = 53;
	public static readonly RULE_parameter = 54;
	public static readonly RULE_block = 55;
	public static readonly RULE_statement = 56;
	public static readonly RULE_expressionStatement = 57;
	public static readonly RULE_prefixIncDecStatement = 58;
	public static readonly RULE_returnStatement = 59;
	public static readonly RULE_selfdestructStatement = 60;
	public static readonly RULE_emitStatement = 61;
	public static readonly RULE_lvPart = 62;
	public static readonly RULE_lvMember = 63;
	public static readonly RULE_variableDefinition = 64;
	public static readonly RULE_tupleAssignment = 65;
	public static readonly RULE_tupleSlot = 66;
	public static readonly RULE_pushArgument = 67;
	public static readonly RULE_deleteStatement = 68;
	public static readonly RULE_timeOpStatement = 69;
	public static readonly RULE_requireStatement = 70;
	public static readonly RULE_ifStatement = 71;
	public static readonly RULE_loopStatement = 72;
	public static readonly RULE_forOfEntriesStatement = 73;
	public static readonly RULE_forInStatement = 74;
	public static readonly RULE_forOfStatement = 75;
	public static readonly RULE_forStatement = 76;
	public static readonly RULE_forInit = 77;
	public static readonly RULE_forCondition = 78;
	public static readonly RULE_forUpdate = 79;
	public static readonly RULE_doWhileStatement = 80;
	public static readonly RULE_whileStatement = 81;
	public static readonly RULE_consoleStatement = 82;
	public static readonly RULE_assemblyStatement = 83;
	public static readonly RULE_yulBlock = 84;
	public static readonly RULE_yulStatement = 85;
	public static readonly RULE_yulVariableDeclaration = 86;
	public static readonly RULE_yulAssignment = 87;
	public static readonly RULE_yulIf = 88;
	public static readonly RULE_yulSwitch = 89;
	public static readonly RULE_yulCase = 90;
	public static readonly RULE_yulDefault = 91;
	public static readonly RULE_yulForLoop = 92;
	public static readonly RULE_yulFunctionDefinition = 93;
	public static readonly RULE_yulExpression = 94;
	public static readonly RULE_yulFunctionCall = 95;
	public static readonly RULE_yulFunctionName = 96;
	public static readonly RULE_yulPath = 97;
	public static readonly RULE_yulLiteral = 98;
	public static readonly RULE_uncheckedStatement = 99;
	public static readonly RULE_switchStatement = 100;
	public static readonly RULE_switchCase = 101;
	public static readonly RULE_switchDefault = 102;
	public static readonly RULE_tryCatchStatement = 103;
	public static readonly RULE_tryReturns = 104;
	public static readonly RULE_catchClause = 105;
	public static readonly RULE_breakStatement = 106;
	public static readonly RULE_continueStatement = 107;
	public static readonly RULE_requireMessage = 108;
	public static readonly RULE_revertStatement = 109;
	public static readonly RULE_assertStatement = 110;
	public static readonly RULE_consoleParameter = 111;
	public static readonly RULE_consoleParameterList = 112;
	public static readonly RULE_functionCall = 113;
	public static readonly RULE_namedArg = 114;
	public static readonly RULE_expressionList = 115;
	public static readonly RULE_callOptions = 116;
	public static readonly RULE_callOption = 117;
	public static readonly RULE_typeList = 118;
	public static readonly RULE_typeListItem = 119;
	public static readonly RULE_expression = 120;
	public static readonly RULE_memberName = 121;
	public static readonly RULE_modifier = 122;
	public static readonly RULE_literal = 123;
	public static readonly RULE_numberLiteral = 124;
	public static readonly RULE_decimalLiteral = 125;
	public static readonly RULE_typeName = 126;
	public static readonly RULE_typeCast = 127;
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
                                                            "'+='", "'-='", 
                                                            "'*='", "'/='", 
                                                            "'%='", "'&='", 
                                                            "'|='", "'^='", 
                                                            "'<<='", "'>>='", 
                                                            "'++'", "'--'", 
                                                            "'return'", 
                                                            "'emit'", "'delete'", 
                                                            "'this'", "'require'", 
                                                            "'if'", "'else'", 
                                                            "'of'", "'in'", 
                                                            "'do'", "'while'", 
                                                            "'console.log'", 
                                                            "'assembly'", 
                                                            "'break'", "'continue'", 
                                                            "'leave'", "'let'", 
                                                            "':='", "'switch'", 
                                                            "'case'", "'default'", 
                                                            "'->'", "'address'", 
                                                            "'unchecked'", 
                                                            "':'", "'try'", 
                                                            "'catch'", "'assert'", 
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
		"receiveDefinition", "receiveModifier", "parentInvocation", "stateVariableDeclaration", 
		"collectionModifier", "stateVariableVisibility", "mappingType", "arrayType", 
		"modifierDefinition", "modifierStatement", "placeholderStatement", "functionDefinition", 
		"customModifierInvocation", "functionModifier", "overrideSpecifier", "unsafeModifier", 
		"returnType", "returnParam", "parameterList", "parameter", "block", "statement", 
		"expressionStatement", "prefixIncDecStatement", "returnStatement", "selfdestructStatement", 
		"emitStatement", "lvPart", "lvMember", "variableDefinition", "tupleAssignment", 
		"tupleSlot", "pushArgument", "deleteStatement", "timeOpStatement", "requireStatement", 
		"ifStatement", "loopStatement", "forOfEntriesStatement", "forInStatement", 
		"forOfStatement", "forStatement", "forInit", "forCondition", "forUpdate", 
		"doWhileStatement", "whileStatement", "consoleStatement", "assemblyStatement", 
		"yulBlock", "yulStatement", "yulVariableDeclaration", "yulAssignment", 
		"yulIf", "yulSwitch", "yulCase", "yulDefault", "yulForLoop", "yulFunctionDefinition", 
		"yulExpression", "yulFunctionCall", "yulFunctionName", "yulPath", "yulLiteral", 
		"uncheckedStatement", "switchStatement", "switchCase", "switchDefault", 
		"tryCatchStatement", "tryReturns", "catchClause", "breakStatement", "continueStatement", 
		"requireMessage", "revertStatement", "assertStatement", "consoleParameter", 
		"consoleParameterList", "functionCall", "namedArg", "expressionList", 
		"callOptions", "callOption", "typeList", "typeListItem", "expression", 
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
			this.state = 259;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===37) {
				{
				{
				this.state = 256;
				this.pragmaDirective();
				}
				}
				this.state = 261;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 265;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===1) {
				{
				{
				this.state = 262;
				this.importDirective();
				}
				}
				this.state = 267;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 280;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1842241) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 278;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 2, this._ctx) ) {
				case 1:
					{
					this.state = 268;
					this.constantDefinition();
					}
					break;
				case 2:
					{
					this.state = 269;
					this.enumDefinition();
					}
					break;
				case 3:
					{
					this.state = 270;
					this.structDefinition();
					}
					break;
				case 4:
					{
					this.state = 271;
					this.typeDefinition();
					}
					break;
				case 5:
					{
					this.state = 272;
					this.usingForDirective();
					}
					break;
				case 6:
					{
					this.state = 273;
					this.errorDefinition();
					}
					break;
				case 7:
					{
					this.state = 274;
					this.interfaceDefinition();
					}
					break;
				case 8:
					{
					this.state = 275;
					this.freeFunctionDefinition();
					}
					break;
				case 9:
					{
					this.state = 276;
					this.libraryDefinition();
					}
					break;
				case 10:
					{
					this.state = 277;
					this.contractDefinition();
					}
					break;
				}
				}
				this.state = 282;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 283;
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
			this.state = 311;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 6, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 285;
				this.match(SolidCashParser.T__0);
				this.state = 286;
				this.match(SolidCashParser.StringLiteral);
				this.state = 287;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 288;
				this.match(SolidCashParser.T__0);
				this.state = 289;
				this.match(SolidCashParser.StringLiteral);
				this.state = 290;
				this.match(SolidCashParser.T__2);
				this.state = 291;
				this.match(SolidCashParser.Identifier);
				this.state = 292;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 293;
				this.match(SolidCashParser.T__0);
				this.state = 294;
				this.match(SolidCashParser.T__3);
				this.state = 295;
				this.importBinding();
				this.state = 300;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 296;
						this.match(SolidCashParser.T__4);
						this.state = 297;
						this.importBinding();
						}
						}
					}
					this.state = 302;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				}
				this.state = 304;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 303;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 306;
				this.match(SolidCashParser.T__5);
				this.state = 307;
				this.match(SolidCashParser.Identifier);
				this.state = 308;
				this.match(SolidCashParser.StringLiteral);
				this.state = 309;
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
			this.state = 313;
			this.match(SolidCashParser.Identifier);
			this.state = 316;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 314;
				this.match(SolidCashParser.T__2);
				this.state = 315;
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
			this.state = 318;
			this.match(SolidCashParser.T__6);
			this.state = 319;
			this.anyIdentifier();
			this.state = 320;
			this.parameterList();
			this.state = 324;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 321;
				this.functionModifier();
				}
				}
				this.state = 326;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 328;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 327;
				this.returnType();
				}
			}

			this.state = 330;
			this.match(SolidCashParser.T__3);
			this.state = 334;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 331;
				this.statement();
				}
				}
				this.state = 336;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 337;
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
			this.state = 376;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 17, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 339;
				this.match(SolidCashParser.T__7);
				this.state = 340;
				this.match(SolidCashParser.Identifier);
				this.state = 341;
				this.match(SolidCashParser.T__8);
				this.state = 345;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 11, this._ctx) ) {
				case 1:
					{
					this.state = 342;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 343;
					this.typeName();
					}
					break;
				case 3:
					{
					this.state = 344;
					this.match(SolidCashParser.T__9);
					}
					break;
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
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 351;
				this.match(SolidCashParser.T__7);
				this.state = 352;
				this.match(SolidCashParser.T__3);
				this.state = 353;
				this.usingFunctionBinding();
				this.state = 358;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 354;
						this.match(SolidCashParser.T__4);
						this.state = 355;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 360;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				}
				this.state = 362;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 361;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 364;
				this.match(SolidCashParser.T__5);
				this.state = 365;
				this.match(SolidCashParser.T__8);
				this.state = 369;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 15, this._ctx) ) {
				case 1:
					{
					this.state = 366;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 367;
					this.typeName();
					}
					break;
				case 3:
					{
					this.state = 368;
					this.match(SolidCashParser.T__9);
					}
					break;
				}
				this.state = 372;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 371;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 374;
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
			this.state = 378;
			this.match(SolidCashParser.Identifier);
			this.state = 381;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===12) {
				{
				this.state = 379;
				this.match(SolidCashParser.T__11);
				this.state = 380;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 385;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 383;
				this.match(SolidCashParser.T__2);
				this.state = 384;
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
			this.state = 387;
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
			this.state = 389;
			_la = this._input.LA(1);
			if(!(((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180)) {
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
		let _la: number;
		try {
			this.state = 405;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 21, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 391;
				this.match(SolidCashParser.T__36);
				this.state = 392;
				this.pragmaName();
				this.state = 393;
				this.pragmaValue();
				this.state = 394;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 396;
				this.match(SolidCashParser.T__36);
				this.state = 397;
				this.match(SolidCashParser.Identifier);
				this.state = 401;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 2081) !== 0) || _la===180) {
					{
					{
					this.state = 398;
					_la = this._input.LA(1);
					if(!(((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 2081) !== 0) || _la===180)) {
					this._errHandler.recoverInline(this);
					}
					else {
						this._errHandler.reportMatch(this);
					    this.consume();
					}
					}
					}
					this.state = 403;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 404;
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
	public pragmaName(): PragmaNameContext {
		let localctx: PragmaNameContext = new PragmaNameContext(this, this._ctx, this.state);
		this.enterRule(localctx, 18, SolidCashParser.RULE_pragmaName);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 407;
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
			this.state = 415;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 20:
			case 21:
			case 22:
			case 23:
			case 26:
			case 27:
			case 40:
			case 140:
			case 144:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 410;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 409;
					this.versionConstraint();
					}
					}
					this.state = 412;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0) || _la===140 || _la===144);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 414;
				this.match(SolidCashParser.T__9);
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
	public versionConstraint(): VersionConstraintContext {
		let localctx: VersionConstraintContext = new VersionConstraintContext(this, this._ctx, this.state);
		this.enterRule(localctx, 22, SolidCashParser.RULE_versionConstraint);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 418;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0)) {
				{
				this.state = 417;
				this.versionOperator();
				}
			}

			this.state = 420;
			_la = this._input.LA(1);
			if(!(_la===140 || _la===144)) {
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
	public versionOperator(): VersionOperatorContext {
		let localctx: VersionOperatorContext = new VersionOperatorContext(this, this._ctx, this.state);
		this.enterRule(localctx, 24, SolidCashParser.RULE_versionOperator);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 422;
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
			this.state = 424;
			this.match(SolidCashParser.T__40);
			this.state = 425;
			this.match(SolidCashParser.Identifier);
			this.state = 435;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 426;
				this.match(SolidCashParser.T__41);
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
			this.state = 448;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1843969) !== 0)) {
				{
				this.state = 446;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 27, this._ctx) ) {
				case 1:
					{
					this.state = 438;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 439;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 440;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 441;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 442;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 443;
					this.interfaceStateVariable();
					}
					break;
				case 7:
					{
					this.state = 444;
					this.interfaceCollection();
					}
					break;
				case 8:
					{
					this.state = 445;
					this.interfaceFunction();
					}
					break;
				}
				}
				this.state = 450;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 451;
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
			this.state = 463;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 29, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 453;
				this.interfaceStateVariableVisibility();
				this.state = 454;
				this.mappingType();
				this.state = 455;
				this.match(SolidCashParser.Identifier);
				this.state = 456;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 458;
				this.interfaceStateVariableVisibility();
				this.state = 459;
				this.arrayType(0);
				this.state = 460;
				this.match(SolidCashParser.Identifier);
				this.state = 461;
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
			this.state = 465;
			this.interfaceStateVariableVisibility();
			this.state = 466;
			this.typeName();
			this.state = 467;
			this.match(SolidCashParser.Identifier);
			this.state = 468;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 470;
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
			this.state = 472;
			this.match(SolidCashParser.T__6);
			this.state = 473;
			this.match(SolidCashParser.Identifier);
			this.state = 474;
			this.parameterList();
			this.state = 478;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 475;
				this.functionModifier();
				}
				}
				this.state = 480;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 482;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 481;
				this.returnType();
				}
			}

			this.state = 484;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 486;
			this.match(SolidCashParser.T__44);
			this.state = 487;
			this.match(SolidCashParser.Identifier);
			this.state = 488;
			this.match(SolidCashParser.T__3);
			this.state = 500;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 815538945) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 498;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 32, this._ctx) ) {
				case 1:
					{
					this.state = 489;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 490;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 491;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 492;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 493;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 494;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 495;
					this.stateVariableDeclaration();
					}
					break;
				case 8:
					{
					this.state = 496;
					this.usingForDirective();
					}
					break;
				case 9:
					{
					this.state = 497;
					this.freeFunctionDefinition();
					}
					break;
				}
				}
				this.state = 502;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 503;
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
			this.state = 506;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===46) {
				{
				this.state = 505;
				this.match(SolidCashParser.T__45);
				}
			}

			this.state = 508;
			this.match(SolidCashParser.T__46);
			this.state = 509;
			this.match(SolidCashParser.Identifier);
			this.state = 511;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 510;
				this.parameterList();
				}
			}

			this.state = 522;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 513;
				this.match(SolidCashParser.T__41);
				this.state = 514;
				this.inheritanceSpecifier();
				this.state = 519;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 515;
					this.match(SolidCashParser.T__4);
					this.state = 516;
					this.inheritanceSpecifier();
					}
					}
					this.state = 521;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 524;
			this.match(SolidCashParser.T__3);
			this.state = 541;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 268435459) !== 0) || ((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 37411875) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 539;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 38, this._ctx) ) {
				case 1:
					{
					this.state = 525;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 526;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 527;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 528;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 529;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 530;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 531;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 532;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 533;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 534;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 535;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 536;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 537;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 538;
					this.receiveDefinition();
					}
					break;
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
	public inheritanceSpecifier(): InheritanceSpecifierContext {
		let localctx: InheritanceSpecifierContext = new InheritanceSpecifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 40, SolidCashParser.RULE_inheritanceSpecifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 546;
			this.match(SolidCashParser.Identifier);
			this.state = 548;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 547;
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
			this.state = 550;
			this.match(SolidCashParser.T__6);
			this.state = 551;
			this.anyIdentifier();
			this.state = 552;
			this.parameterList();
			this.state = 557;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0) || _la===180) {
				{
				this.state = 555;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 28:
				case 29:
				case 30:
				case 31:
				case 32:
				case 43:
				case 44:
				case 58:
				case 59:
				case 61:
				case 63:
				case 70:
				case 71:
				case 72:
					{
					this.state = 553;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 554;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 559;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 561;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 560;
				this.returnType();
				}
			}

			this.state = 563;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 565;
			this.match(SolidCashParser.T__47);
			this.state = 566;
			this.match(SolidCashParser.Identifier);
			this.state = 567;
			this.match(SolidCashParser.T__48);
			this.state = 579;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 568;
				this.eventParameter();
				this.state = 573;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 44, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 569;
						this.match(SolidCashParser.T__4);
						this.state = 570;
						this.eventParameter();
						}
						}
					}
					this.state = 575;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 44, this._ctx);
				}
				this.state = 577;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 576;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 581;
			this.match(SolidCashParser.T__49);
			this.state = 583;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===51) {
				{
				this.state = 582;
				this.match(SolidCashParser.T__50);
				}
			}

			this.state = 585;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 589;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 48, this._ctx) ) {
			case 1:
				{
				this.state = 587;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 588;
				this.arrayType(0);
				}
				break;
			}
			this.state = 592;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===52) {
				{
				this.state = 591;
				this.match(SolidCashParser.T__51);
				}
			}

			this.state = 595;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 594;
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
	public errorDefinition(): ErrorDefinitionContext {
		let localctx: ErrorDefinitionContext = new ErrorDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 48, SolidCashParser.RULE_errorDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 597;
			this.match(SolidCashParser.T__34);
			this.state = 598;
			this.match(SolidCashParser.Identifier);
			this.state = 599;
			this.match(SolidCashParser.T__48);
			this.state = 611;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 600;
				this.errorParameter();
				this.state = 605;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 601;
						this.match(SolidCashParser.T__4);
						this.state = 602;
						this.errorParameter();
						}
						}
					}
					this.state = 607;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				}
				this.state = 609;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 608;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 613;
			this.match(SolidCashParser.T__49);
			this.state = 614;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 616;
			this.typeName();
			this.state = 618;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 617;
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
	public structDefinition(): StructDefinitionContext {
		let localctx: StructDefinitionContext = new StructDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 52, SolidCashParser.RULE_structDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 620;
			this.match(SolidCashParser.T__52);
			this.state = 621;
			this.match(SolidCashParser.Identifier);
			this.state = 622;
			this.match(SolidCashParser.T__3);
			this.state = 624;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 623;
				this.structField();
				}
				}
				this.state = 626;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180);
			this.state = 628;
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
			this.state = 633;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 56, this._ctx) ) {
			case 1:
				{
				this.state = 630;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 631;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 632;
				this.mappingType();
				}
				break;
			}
			this.state = 635;
			this.anyIdentifier();
			this.state = 636;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 638;
			this.match(SolidCashParser.T__53);
			this.state = 639;
			this.match(SolidCashParser.Identifier);
			this.state = 640;
			this.match(SolidCashParser.T__3);
			this.state = 641;
			this.enumMember();
			this.state = 646;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 57, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 642;
					this.match(SolidCashParser.T__4);
					this.state = 643;
					this.enumMember();
					}
					}
				}
				this.state = 648;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 57, this._ctx);
			}
			this.state = 650;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 649;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 652;
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
			this.state = 654;
			this.match(SolidCashParser.Identifier);
			this.state = 657;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 655;
				this.match(SolidCashParser.T__39);
				this.state = 656;
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
			this.state = 659;
			this.match(SolidCashParser.T__54);
			this.state = 660;
			this.match(SolidCashParser.Identifier);
			this.state = 661;
			this.match(SolidCashParser.T__41);
			this.state = 662;
			this.typeName();
			this.state = 663;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 665;
			this.typeName();
			this.state = 666;
			this.match(SolidCashParser.T__55);
			this.state = 667;
			this.match(SolidCashParser.Identifier);
			this.state = 668;
			this.match(SolidCashParser.T__39);
			this.state = 669;
			this.expression(0);
			this.state = 670;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 672;
			this.match(SolidCashParser.T__56);
			this.state = 673;
			this.parameterList();
			this.state = 677;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 98307) !== 0)) {
				{
				{
				this.state = 674;
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
				this.state = 679;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 683;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 680;
				this.parentInvocation();
				}
				}
				this.state = 685;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 686;
			this.match(SolidCashParser.T__3);
			this.state = 690;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 687;
				this.statement();
				}
				}
				this.state = 692;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 693;
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
			this.state = 695;
			this.match(SolidCashParser.T__59);
			this.state = 696;
			this.parameterList();
			this.state = 697;
			this.match(SolidCashParser.T__43);
			this.state = 701;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 8197) !== 0)) {
				{
				{
				this.state = 698;
				this.fallbackModifier();
				}
				}
				this.state = 703;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 707;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 704;
				this.customModifierInvocation();
				}
				}
				this.state = 709;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 711;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 710;
				this.returnType();
				}
			}

			this.state = 713;
			this.match(SolidCashParser.T__3);
			this.state = 717;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 714;
				this.statement();
				}
				}
				this.state = 719;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
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
	public fallbackModifier(): FallbackModifierContext {
		let localctx: FallbackModifierContext = new FallbackModifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 68, SolidCashParser.RULE_fallbackModifier);
		try {
			this.state = 725;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 59:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 722;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 723;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 724;
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
			this.state = 727;
			this.match(SolidCashParser.T__61);
			this.state = 728;
			this.match(SolidCashParser.T__48);
			this.state = 729;
			this.match(SolidCashParser.T__49);
			this.state = 733;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===61 || _la===72) {
				{
				{
				this.state = 730;
				this.receiveModifier();
				}
				}
				this.state = 735;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 736;
			this.match(SolidCashParser.T__43);
			this.state = 740;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===61 || _la===72) {
				{
				{
				this.state = 737;
				this.receiveModifier();
				}
				}
				this.state = 742;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 743;
			this.match(SolidCashParser.T__58);
			this.state = 747;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===61 || _la===72) {
				{
				{
				this.state = 744;
				this.receiveModifier();
				}
				}
				this.state = 749;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 750;
			this.match(SolidCashParser.T__3);
			this.state = 754;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 751;
				this.statement();
				}
				}
				this.state = 756;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 757;
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
	public receiveModifier(): ReceiveModifierContext {
		let localctx: ReceiveModifierContext = new ReceiveModifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 72, SolidCashParser.RULE_receiveModifier);
		try {
			this.state = 761;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 61:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 759;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 760;
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
	public parentInvocation(): ParentInvocationContext {
		let localctx: ParentInvocationContext = new ParentInvocationContext(this, this._ctx, this.state);
		this.enterRule(localctx, 74, SolidCashParser.RULE_parentInvocation);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 763;
			this.match(SolidCashParser.Identifier);
			this.state = 764;
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
		this.enterRule(localctx, 76, SolidCashParser.RULE_stateVariableDeclaration);
		let _la: number;
		try {
			this.state = 837;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 87, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 767;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 766;
					this.stateVariableVisibility();
					}
				}

				this.state = 769;
				this.typeName();
				this.state = 774;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					this.state = 772;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case 33:
					case 56:
					case 133:
					case 134:
					case 135:
					case 136:
					case 137:
						{
						this.state = 770;
						this.modifier();
						}
						break;
					case 72:
						{
						this.state = 771;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 776;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 777;
				this.match(SolidCashParser.Identifier);
				this.state = 780;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 778;
					this.match(SolidCashParser.T__39);
					this.state = 779;
					this.expression(0);
					}
				}

				this.state = 782;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 784;
				this.typeName();
				this.state = 789;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					this.state = 787;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case 33:
					case 56:
					case 133:
					case 134:
					case 135:
					case 136:
					case 137:
						{
						this.state = 785;
						this.modifier();
						}
						break;
					case 72:
						{
						this.state = 786;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 791;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 792;
				this.stateVariableVisibility();
				this.state = 797;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					this.state = 795;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case 33:
					case 56:
					case 133:
					case 134:
					case 135:
					case 136:
					case 137:
						{
						this.state = 793;
						this.modifier();
						}
						break;
					case 72:
						{
						this.state = 794;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 799;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 800;
				this.match(SolidCashParser.Identifier);
				this.state = 803;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 801;
					this.match(SolidCashParser.T__39);
					this.state = 802;
					this.expression(0);
					}
				}

				this.state = 805;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 808;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 807;
					this.stateVariableVisibility();
					}
				}

				this.state = 810;
				this.mappingType();
				this.state = 814;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 811;
					this.collectionModifier();
					}
					}
					this.state = 816;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 817;
				this.match(SolidCashParser.Identifier);
				this.state = 818;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 821;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 820;
					this.stateVariableVisibility();
					}
				}

				this.state = 823;
				this.arrayType(0);
				this.state = 827;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 824;
					this.collectionModifier();
					}
					}
					this.state = 829;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 830;
				this.match(SolidCashParser.Identifier);
				this.state = 833;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 831;
					this.match(SolidCashParser.T__39);
					this.state = 832;
					this.expression(0);
					}
				}

				this.state = 835;
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
		this.enterRule(localctx, 78, SolidCashParser.RULE_collectionModifier);
		try {
			this.state = 842;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 33:
			case 56:
			case 133:
			case 134:
			case 135:
			case 136:
			case 137:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 839;
				this.modifier();
				}
				break;
			case 43:
			case 44:
			case 58:
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 840;
				this.stateVariableVisibility();
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 841;
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
	public stateVariableVisibility(): StateVariableVisibilityContext {
		let localctx: StateVariableVisibilityContext = new StateVariableVisibilityContext(this, this._ctx, this.state);
		this.enterRule(localctx, 80, SolidCashParser.RULE_stateVariableVisibility);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 844;
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
		this.enterRule(localctx, 82, SolidCashParser.RULE_mappingType);
		let _la: number;
		try {
			this.state = 882;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 94, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 846;
				this.match(SolidCashParser.T__63);
				this.state = 847;
				this.match(SolidCashParser.T__48);
				this.state = 848;
				this.typeName();
				this.state = 850;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 849;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 852;
				this.match(SolidCashParser.T__64);
				this.state = 853;
				this.typeName();
				this.state = 855;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 854;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 857;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 859;
				this.match(SolidCashParser.T__63);
				this.state = 860;
				this.match(SolidCashParser.T__48);
				this.state = 861;
				this.typeName();
				this.state = 863;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 862;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 865;
				this.match(SolidCashParser.T__64);
				this.state = 866;
				this.mappingType();
				this.state = 867;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 869;
				this.match(SolidCashParser.T__63);
				this.state = 870;
				this.match(SolidCashParser.T__48);
				this.state = 871;
				this.typeName();
				this.state = 873;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 872;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 875;
				this.match(SolidCashParser.T__64);
				this.state = 876;
				this.arrayType(0);
				this.state = 878;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 877;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 880;
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
		let _startState: number = 84;
		this.enterRecursionRule(localctx, 84, SolidCashParser.RULE_arrayType, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 894;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 95, this._ctx) ) {
			case 1:
				{
				this.state = 885;
				this.typeName();
				this.state = 886;
				this.match(SolidCashParser.T__65);
				this.state = 887;
				_la = this._input.LA(1);
				if(!(_la===145 || _la===180)) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 888;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 2:
				{
				this.state = 890;
				this.typeName();
				this.state = 891;
				this.match(SolidCashParser.T__65);
				this.state = 892;
				this.match(SolidCashParser.T__66);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 905;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 97, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 903;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 96, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 896;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 897;
						this.match(SolidCashParser.T__65);
						this.state = 898;
						_la = this._input.LA(1);
						if(!(_la===145 || _la===180)) {
						this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 899;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 900;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 901;
						this.match(SolidCashParser.T__65);
						this.state = 902;
						this.match(SolidCashParser.T__66);
						}
						break;
					}
					}
				}
				this.state = 907;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 97, this._ctx);
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
		this.enterRule(localctx, 86, SolidCashParser.RULE_modifierDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 908;
			this.match(SolidCashParser.T__67);
			this.state = 909;
			this.match(SolidCashParser.Identifier);
			this.state = 911;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 910;
				this.parameterList();
				}
			}

			this.state = 913;
			this.match(SolidCashParser.T__3);
			this.state = 917;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 914;
				this.modifierStatement();
				}
				}
				this.state = 919;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 920;
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
		this.enterRule(localctx, 88, SolidCashParser.RULE_modifierStatement);
		try {
			this.state = 924;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 100, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 922;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 923;
				this.statement();
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
	public placeholderStatement(): PlaceholderStatementContext {
		let localctx: PlaceholderStatementContext = new PlaceholderStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 90, SolidCashParser.RULE_placeholderStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 926;
			this.match(SolidCashParser.T__68);
			this.state = 927;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 92, SolidCashParser.RULE_functionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 929;
			this.match(SolidCashParser.T__6);
			this.state = 930;
			this.anyIdentifier();
			this.state = 931;
			this.parameterList();
			this.state = 936;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0) || _la===180) {
				{
				this.state = 934;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 28:
				case 29:
				case 30:
				case 31:
				case 32:
				case 43:
				case 44:
				case 58:
				case 59:
				case 61:
				case 63:
				case 70:
				case 71:
				case 72:
					{
					this.state = 932;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 933;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 938;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 940;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 939;
				this.returnType();
				}
			}

			this.state = 942;
			this.match(SolidCashParser.T__3);
			this.state = 946;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 943;
				this.statement();
				}
				}
				this.state = 948;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 949;
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
		this.enterRule(localctx, 94, SolidCashParser.RULE_customModifierInvocation);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 951;
			this.match(SolidCashParser.Identifier);
			this.state = 953;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 952;
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
		this.enterRule(localctx, 96, SolidCashParser.RULE_functionModifier);
		try {
			this.state = 969;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 70:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 955;
				this.match(SolidCashParser.T__69);
				}
				break;
			case 71:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 956;
				this.match(SolidCashParser.T__70);
				}
				break;
			case 58:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 957;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 44:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 958;
				this.match(SolidCashParser.T__43);
				}
				break;
			case 43:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 959;
				this.match(SolidCashParser.T__42);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 960;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 59:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 961;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 962;
				this.overrideSpecifier();
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 963;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 964;
				this.unsafeModifier();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 965;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 966;
				this.match(SolidCashParser.T__27);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 967;
				this.match(SolidCashParser.T__30);
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 968;
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
		this.enterRule(localctx, 98, SolidCashParser.RULE_overrideSpecifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 971;
			this.match(SolidCashParser.T__71);
			this.state = 982;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 972;
				this.match(SolidCashParser.T__48);
				this.state = 973;
				this.match(SolidCashParser.Identifier);
				this.state = 978;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 974;
					this.match(SolidCashParser.T__4);
					this.state = 975;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 980;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 981;
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
		this.enterRule(localctx, 100, SolidCashParser.RULE_unsafeModifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 984;
			this.match(SolidCashParser.T__31);
			this.state = 988;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 985;
				this.match(SolidCashParser.T__48);
				this.state = 986;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 987;
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
		this.enterRule(localctx, 102, SolidCashParser.RULE_returnType);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 990;
			this.match(SolidCashParser.T__72);
			this.state = 991;
			this.match(SolidCashParser.T__48);
			this.state = 992;
			this.returnParam();
			this.state = 997;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 110, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 993;
					this.match(SolidCashParser.T__4);
					this.state = 994;
					this.returnParam();
					}
					}
				}
				this.state = 999;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 110, this._ctx);
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

			this.state = 1003;
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
		this.enterRule(localctx, 104, SolidCashParser.RULE_returnParam);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1025;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 116, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1005;
				this.typeName();
				this.state = 1009;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 112, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1006;
						this.modifier();
						}
						}
					}
					this.state = 1011;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 112, this._ctx);
				}
				this.state = 1013;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1012;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1015;
				this.arrayType(0);
				this.state = 1019;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 114, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1016;
						this.modifier();
						}
						}
					}
					this.state = 1021;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 114, this._ctx);
				}
				this.state = 1023;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1022;
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
		this.enterRule(localctx, 106, SolidCashParser.RULE_parameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1027;
			this.match(SolidCashParser.T__48);
			this.state = 1039;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1028;
				this.parameter();
				this.state = 1033;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 117, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1029;
						this.match(SolidCashParser.T__4);
						this.state = 1030;
						this.parameter();
						}
						}
					}
					this.state = 1035;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 117, this._ctx);
				}
				this.state = 1037;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1036;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1041;
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
		this.enterRule(localctx, 108, SolidCashParser.RULE_parameter);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1073;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 126, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1043;
				this.typeName();
				this.state = 1047;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 120, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1044;
						this.modifier();
						}
						}
					}
					this.state = 1049;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 120, this._ctx);
				}
				this.state = 1051;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1050;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1053;
				this.arrayType(0);
				this.state = 1057;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 122, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1054;
						this.modifier();
						}
						}
					}
					this.state = 1059;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 122, this._ctx);
				}
				this.state = 1061;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1060;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1063;
				this.mappingType();
				this.state = 1067;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 124, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1064;
						this.modifier();
						}
						}
					}
					this.state = 1069;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 124, this._ctx);
				}
				this.state = 1071;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1070;
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
		this.enterRule(localctx, 110, SolidCashParser.RULE_block);
		let _la: number;
		try {
			this.state = 1084;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1075;
				this.match(SolidCashParser.T__3);
				this.state = 1079;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
					{
					{
					this.state = 1076;
					this.statement();
					}
					}
					this.state = 1081;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1082;
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
			case 69:
			case 84:
			case 85:
			case 86:
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
			case 108:
			case 109:
			case 111:
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
			case 123:
			case 124:
			case 125:
			case 127:
			case 138:
			case 139:
			case 141:
			case 143:
			case 144:
			case 145:
			case 146:
			case 147:
			case 148:
			case 149:
			case 151:
			case 152:
			case 153:
			case 155:
			case 156:
			case 157:
			case 158:
			case 159:
			case 160:
			case 161:
			case 162:
			case 180:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1083;
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
		this.enterRule(localctx, 112, SolidCashParser.RULE_statement);
		try {
			this.state = 1108;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 129, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1086;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1087;
				this.variableDefinition();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1088;
				this.tupleAssignment();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1089;
				this.prefixIncDecStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1090;
				this.timeOpStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1091;
				this.requireStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1092;
				this.ifStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1093;
				this.loopStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1094;
				this.consoleStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1095;
				this.emitStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1096;
				this.returnStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1097;
				this.selfdestructStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1098;
				this.assemblyStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1099;
				this.tryCatchStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1100;
				this.revertStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1101;
				this.assertStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1102;
				this.deleteStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1103;
				this.uncheckedStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1104;
				this.switchStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1105;
				this.breakStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1106;
				this.continueStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1107;
				this.expressionStatement();
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
	public expressionStatement(): ExpressionStatementContext {
		let localctx: ExpressionStatementContext = new ExpressionStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 114, SolidCashParser.RULE_expressionStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1110;
			this.expression(0);
			this.state = 1127;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 40:
			case 74:
			case 75:
			case 76:
			case 77:
			case 78:
			case 79:
			case 80:
			case 81:
			case 82:
			case 83:
				{
				this.state = 1111;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1112;
				this.expression(0);
				}
				break;
			case 165:
				{
				this.state = 1113;
				this.match(SolidCashParser.DotPush);
				this.state = 1114;
				this.match(SolidCashParser.T__48);
				this.state = 1116;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 132161) !== 0) || ((((_la - 89)) & ~0x1F) === 0 && ((1 << (_la - 89)) & 4261937153) !== 0) || ((((_la - 121)) & ~0x1F) === 0 && ((1 << (_la - 121)) & 3755343967) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 134218749) !== 0)) {
					{
					this.state = 1115;
					this.pushArgument();
					}
				}

				this.state = 1118;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 166:
				{
				this.state = 1119;
				this.match(SolidCashParser.DotPop);
				this.state = 1120;
				this.match(SolidCashParser.T__48);
				this.state = 1121;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 169:
				{
				this.state = 1122;
				this.match(SolidCashParser.DotDelete);
				this.state = 1123;
				this.match(SolidCashParser.T__48);
				this.state = 1124;
				this.expression(0);
				this.state = 1125;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				break;
			default:
				break;
			}
			this.state = 1129;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public prefixIncDecStatement(): PrefixIncDecStatementContext {
		let localctx: PrefixIncDecStatementContext = new PrefixIncDecStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 116, SolidCashParser.RULE_prefixIncDecStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1131;
			localctx._op = this._input.LT(1);
			_la = this._input.LA(1);
			if(!(_la===84 || _la===85)) {
			    localctx._op = this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			this.state = 1132;
			this.expression(0);
			this.state = 1133;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 118, SolidCashParser.RULE_returnStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1164;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 135, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1135;
				this.match(SolidCashParser.T__85);
				this.state = 1136;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1137;
				this.match(SolidCashParser.T__85);
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
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1148;
				this.match(SolidCashParser.T__85);
				this.state = 1149;
				this.match(SolidCashParser.T__48);
				this.state = 1150;
				this.expression(0);
				this.state = 1155;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 133, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1151;
						this.match(SolidCashParser.T__4);
						this.state = 1152;
						this.expression(0);
						}
						}
					}
					this.state = 1157;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 133, this._ctx);
				}
				this.state = 1159;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1158;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1161;
				this.match(SolidCashParser.T__49);
				this.state = 1162;
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
	public selfdestructStatement(): SelfdestructStatementContext {
		let localctx: SelfdestructStatementContext = new SelfdestructStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 120, SolidCashParser.RULE_selfdestructStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1166;
			this.match(SolidCashParser.T__30);
			this.state = 1167;
			this.match(SolidCashParser.T__48);
			this.state = 1168;
			this.expression(0);
			this.state = 1169;
			this.match(SolidCashParser.T__49);
			this.state = 1170;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 122, SolidCashParser.RULE_emitStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1205;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 141, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1172;
				this.match(SolidCashParser.T__86);
				this.state = 1173;
				this.match(SolidCashParser.Identifier);
				this.state = 1176;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1174;
					this.match(SolidCashParser.T__11);
					this.state = 1175;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1178;
				this.match(SolidCashParser.T__48);
				this.state = 1179;
				this.match(SolidCashParser.T__3);
				this.state = 1191;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1180;
					this.namedArg();
					this.state = 1185;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 137, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1181;
							this.match(SolidCashParser.T__4);
							this.state = 1182;
							this.namedArg();
							}
							}
						}
						this.state = 1187;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 137, this._ctx);
					}
					this.state = 1189;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1188;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1193;
				this.match(SolidCashParser.T__5);
				this.state = 1194;
				this.match(SolidCashParser.T__49);
				this.state = 1195;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1196;
				this.match(SolidCashParser.T__86);
				this.state = 1197;
				this.match(SolidCashParser.Identifier);
				this.state = 1200;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1198;
					this.match(SolidCashParser.T__11);
					this.state = 1199;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1202;
				this.expressionList();
				this.state = 1203;
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
	public lvPart(): LvPartContext {
		let localctx: LvPartContext = new LvPartContext(this, this._ctx, this.state);
		this.enterRule(localctx, 124, SolidCashParser.RULE_lvPart);
		try {
			this.state = 1212;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 66:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1207;
				this.match(SolidCashParser.T__65);
				this.state = 1208;
				this.expression(0);
				this.state = 1209;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 12:
			case 163:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1211;
				this.lvMember();
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
	public lvMember(): LvMemberContext {
		let localctx: LvMemberContext = new LvMemberContext(this, this._ctx, this.state);
		this.enterRule(localctx, 126, SolidCashParser.RULE_lvMember);
		try {
			this.state = 1217;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1214;
				this.match(SolidCashParser.T__11);
				this.state = 1215;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1216;
				this.match(SolidCashParser.DotValue);
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
	public variableDefinition(): VariableDefinitionContext {
		let localctx: VariableDefinitionContext = new VariableDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 128, SolidCashParser.RULE_variableDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1247;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 148, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1219;
				this.typeName();
				this.state = 1223;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 144, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1220;
						this.modifier();
						}
						}
					}
					this.state = 1225;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 144, this._ctx);
				}
				this.state = 1226;
				this.anyIdentifier();
				this.state = 1229;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1227;
					this.match(SolidCashParser.T__39);
					this.state = 1228;
					this.expression(0);
					}
				}

				this.state = 1231;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1233;
				this.arrayType(0);
				this.state = 1237;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 146, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1234;
						this.modifier();
						}
						}
					}
					this.state = 1239;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 146, this._ctx);
				}
				this.state = 1240;
				this.anyIdentifier();
				this.state = 1243;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1241;
					this.match(SolidCashParser.T__39);
					this.state = 1242;
					this.expression(0);
					}
				}

				this.state = 1245;
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
			this.state = 1297;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 153, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1249;
				this.typeName();
				this.state = 1250;
				this.match(SolidCashParser.Identifier);
				this.state = 1255;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1251;
					this.match(SolidCashParser.T__4);
					this.state = 1252;
					this.typeName();
					this.state = 1253;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1257;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1259;
				this.match(SolidCashParser.T__39);
				this.state = 1260;
				this.expression(0);
				this.state = 1261;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1263;
				this.match(SolidCashParser.T__48);
				this.state = 1264;
				this.tupleSlot();
				this.state = 1267;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1265;
					this.match(SolidCashParser.T__4);
					this.state = 1266;
					this.tupleSlot();
					}
					}
					this.state = 1269;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1271;
				this.match(SolidCashParser.T__49);
				this.state = 1272;
				this.match(SolidCashParser.T__39);
				this.state = 1273;
				this.match(SolidCashParser.T__48);
				this.state = 1274;
				this.expression(0);
				this.state = 1277;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1275;
					this.match(SolidCashParser.T__4);
					this.state = 1276;
					this.expression(0);
					}
					}
					this.state = 1279;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1281;
				this.match(SolidCashParser.T__49);
				this.state = 1282;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1284;
				this.match(SolidCashParser.T__48);
				this.state = 1285;
				this.tupleSlot();
				this.state = 1288;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1286;
					this.match(SolidCashParser.T__4);
					this.state = 1287;
					this.tupleSlot();
					}
					}
					this.state = 1290;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1292;
				this.match(SolidCashParser.T__49);
				this.state = 1293;
				this.match(SolidCashParser.T__39);
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
	public tupleSlot(): TupleSlotContext {
		let localctx: TupleSlotContext = new TupleSlotContext(this, this._ctx, this.state);
		this.enterRule(localctx, 132, SolidCashParser.RULE_tupleSlot);
		try {
			let _alt: number;
			this.state = 1310;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 155, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1299;
				this.typeName();
				this.state = 1303;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 154, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1300;
						this.modifier();
						}
						}
					}
					this.state = 1305;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 154, this._ctx);
				}
				this.state = 1306;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1308;
				this.anyIdentifier();
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
	public pushArgument(): PushArgumentContext {
		let localctx: PushArgumentContext = new PushArgumentContext(this, this._ctx, this.state);
		this.enterRule(localctx, 134, SolidCashParser.RULE_pushArgument);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1312;
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
	public deleteStatement(): DeleteStatementContext {
		let localctx: DeleteStatementContext = new DeleteStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 136, SolidCashParser.RULE_deleteStatement);
		let _la: number;
		try {
			this.state = 1375;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 161, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1314;
				this.match(SolidCashParser.T__87);
				this.state = 1315;
				this.match(SolidCashParser.Identifier);
				this.state = 1316;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1317;
				this.match(SolidCashParser.T__87);
				this.state = 1318;
				this.match(SolidCashParser.T__88);
				this.state = 1319;
				this.match(SolidCashParser.T__11);
				this.state = 1320;
				this.match(SolidCashParser.Identifier);
				this.state = 1321;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1322;
				this.match(SolidCashParser.T__87);
				this.state = 1323;
				this.match(SolidCashParser.T__88);
				this.state = 1324;
				this.match(SolidCashParser.T__11);
				this.state = 1325;
				this.match(SolidCashParser.Identifier);
				this.state = 1330;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1326;
					this.match(SolidCashParser.T__65);
					this.state = 1327;
					this.expression(0);
					this.state = 1328;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1332;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1334;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1336;
				this.match(SolidCashParser.T__87);
				this.state = 1337;
				this.match(SolidCashParser.Identifier);
				this.state = 1342;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1338;
					this.match(SolidCashParser.T__65);
					this.state = 1339;
					this.expression(0);
					this.state = 1340;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1344;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1346;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				localctx = new DeleteMemberEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1348;
				this.match(SolidCashParser.T__87);
				this.state = 1349;
				this.match(SolidCashParser.Identifier);
				this.state = 1352;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1350;
					this.match(SolidCashParser.T__11);
					this.state = 1351;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1354;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1360;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1356;
					this.match(SolidCashParser.T__65);
					this.state = 1357;
					this.expression(0);
					this.state = 1358;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1362;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1364;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 6:
				localctx = new DeleteMemberContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1366;
				this.match(SolidCashParser.T__87);
				this.state = 1367;
				this.match(SolidCashParser.Identifier);
				this.state = 1370;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1368;
					this.match(SolidCashParser.T__11);
					this.state = 1369;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1372;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
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
	public timeOpStatement(): TimeOpStatementContext {
		let localctx: TimeOpStatementContext = new TimeOpStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 138, SolidCashParser.RULE_timeOpStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1377;
			this.match(SolidCashParser.T__89);
			this.state = 1378;
			this.match(SolidCashParser.T__48);
			this.state = 1379;
			this.match(SolidCashParser.TxVar);
			this.state = 1380;
			this.match(SolidCashParser.T__22);
			this.state = 1381;
			this.expression(0);
			this.state = 1384;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1382;
				this.match(SolidCashParser.T__4);
				this.state = 1383;
				this.requireMessage();
				}
			}

			this.state = 1386;
			this.match(SolidCashParser.T__49);
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
	public requireStatement(): RequireStatementContext {
		let localctx: RequireStatementContext = new RequireStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 140, SolidCashParser.RULE_requireStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1389;
			this.match(SolidCashParser.T__89);
			this.state = 1390;
			this.match(SolidCashParser.T__48);
			this.state = 1391;
			this.expression(0);
			this.state = 1394;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1392;
				this.match(SolidCashParser.T__4);
				this.state = 1393;
				this.requireMessage();
				}
			}

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
	public ifStatement(): IfStatementContext {
		let localctx: IfStatementContext = new IfStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 142, SolidCashParser.RULE_ifStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1399;
			this.match(SolidCashParser.T__90);
			this.state = 1400;
			this.match(SolidCashParser.T__48);
			this.state = 1401;
			this.expression(0);
			this.state = 1402;
			this.match(SolidCashParser.T__49);
			this.state = 1403;
			localctx._ifBlock = this.block();
			this.state = 1406;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 164, this._ctx) ) {
			case 1:
				{
				this.state = 1404;
				this.match(SolidCashParser.T__91);
				this.state = 1405;
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
		this.enterRule(localctx, 144, SolidCashParser.RULE_loopStatement);
		try {
			this.state = 1414;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 165, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1408;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1409;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1410;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1411;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1412;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1413;
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
		this.enterRule(localctx, 146, SolidCashParser.RULE_forOfEntriesStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1416;
			this.match(SolidCashParser.T__8);
			this.state = 1417;
			this.match(SolidCashParser.T__48);
			this.state = 1418;
			this.typeName();
			this.state = 1419;
			this.match(SolidCashParser.Identifier);
			this.state = 1420;
			this.match(SolidCashParser.T__4);
			this.state = 1421;
			this.typeName();
			this.state = 1422;
			this.match(SolidCashParser.Identifier);
			this.state = 1423;
			this.match(SolidCashParser.T__92);
			this.state = 1424;
			this.match(SolidCashParser.T__88);
			this.state = 1425;
			this.match(SolidCashParser.T__11);
			this.state = 1426;
			this.match(SolidCashParser.Identifier);
			this.state = 1427;
			this.match(SolidCashParser.T__11);
			this.state = 1428;
			this.match(SolidCashParser.T__33);
			this.state = 1429;
			this.match(SolidCashParser.T__49);
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
	public forInStatement(): ForInStatementContext {
		let localctx: ForInStatementContext = new ForInStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 148, SolidCashParser.RULE_forInStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1432;
			this.match(SolidCashParser.T__8);
			this.state = 1433;
			this.match(SolidCashParser.T__48);
			this.state = 1434;
			this.typeName();
			this.state = 1435;
			this.match(SolidCashParser.Identifier);
			this.state = 1436;
			this.match(SolidCashParser.T__93);
			this.state = 1437;
			this.match(SolidCashParser.T__88);
			this.state = 1438;
			this.match(SolidCashParser.T__11);
			this.state = 1439;
			this.match(SolidCashParser.Identifier);
			this.state = 1440;
			this.match(SolidCashParser.T__49);
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
	public forOfStatement(): ForOfStatementContext {
		let localctx: ForOfStatementContext = new ForOfStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 150, SolidCashParser.RULE_forOfStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1443;
			this.match(SolidCashParser.T__8);
			this.state = 1444;
			this.match(SolidCashParser.T__48);
			this.state = 1445;
			this.typeName();
			this.state = 1446;
			this.match(SolidCashParser.Identifier);
			this.state = 1447;
			this.match(SolidCashParser.T__92);
			this.state = 1448;
			this.match(SolidCashParser.T__88);
			this.state = 1449;
			this.match(SolidCashParser.T__11);
			this.state = 1450;
			this.match(SolidCashParser.Identifier);
			this.state = 1451;
			this.match(SolidCashParser.T__49);
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
	public forStatement(): ForStatementContext {
		let localctx: ForStatementContext = new ForStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 152, SolidCashParser.RULE_forStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1454;
			this.match(SolidCashParser.T__8);
			this.state = 1455;
			this.match(SolidCashParser.T__48);
			this.state = 1456;
			this.forInit();
			this.state = 1457;
			this.forCondition();
			this.state = 1459;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===84 || _la===85 || _la===180) {
				{
				this.state = 1458;
				this.forUpdate();
				}
			}

			this.state = 1461;
			this.match(SolidCashParser.T__49);
			this.state = 1462;
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
		this.enterRule(localctx, 154, SolidCashParser.RULE_forInit);
		let _la: number;
		try {
			this.state = 1484;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 169, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1464;
				this.typeName();
				this.state = 1468;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 1465;
					this.modifier();
					}
					}
					this.state = 1470;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1471;
				this.match(SolidCashParser.Identifier);
				this.state = 1474;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1472;
					this.match(SolidCashParser.T__39);
					this.state = 1473;
					this.expression(0);
					}
				}

				this.state = 1476;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1478;
				this.match(SolidCashParser.Identifier);
				this.state = 1479;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1480;
				this.expression(0);
				this.state = 1481;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1483;
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
	public forCondition(): ForConditionContext {
		let localctx: ForConditionContext = new ForConditionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 156, SolidCashParser.RULE_forCondition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1486;
			this.expression(0);
			this.state = 1487;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 158, SolidCashParser.RULE_forUpdate);
		let _la: number;
		try {
			this.state = 1496;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 170, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1489;
				this.match(SolidCashParser.Identifier);
				this.state = 1490;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1491;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1492;
				this.match(SolidCashParser.Identifier);
				this.state = 1493;
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
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1494;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===84 || _la===85)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1495;
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
		this.enterRule(localctx, 160, SolidCashParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1498;
			this.match(SolidCashParser.T__94);
			this.state = 1499;
			this.block();
			this.state = 1500;
			this.match(SolidCashParser.T__95);
			this.state = 1501;
			this.match(SolidCashParser.T__48);
			this.state = 1502;
			this.expression(0);
			this.state = 1503;
			this.match(SolidCashParser.T__49);
			this.state = 1504;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 162, SolidCashParser.RULE_whileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1506;
			this.match(SolidCashParser.T__95);
			this.state = 1507;
			this.match(SolidCashParser.T__48);
			this.state = 1508;
			this.expression(0);
			this.state = 1509;
			this.match(SolidCashParser.T__49);
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
	public consoleStatement(): ConsoleStatementContext {
		let localctx: ConsoleStatementContext = new ConsoleStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 164, SolidCashParser.RULE_consoleStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1512;
			this.match(SolidCashParser.T__96);
			this.state = 1513;
			this.consoleParameterList();
			this.state = 1514;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 166, SolidCashParser.RULE_assemblyStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1516;
			this.match(SolidCashParser.T__97);
			this.state = 1517;
			this.yulBlock();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public yulBlock(): YulBlockContext {
		let localctx: YulBlockContext = new YulBlockContext(this, this._ctx, this.state);
		this.enterRule(localctx, 168, SolidCashParser.RULE_yulBlock);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1519;
			this.match(SolidCashParser.T__3);
			this.state = 1523;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026534544) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 31) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 4579361) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				{
				this.state = 1520;
				this.yulStatement();
				}
				}
				this.state = 1525;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1526;
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
	public yulStatement(): YulStatementContext {
		let localctx: YulStatementContext = new YulStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 170, SolidCashParser.RULE_yulStatement);
		try {
			this.state = 1541;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 172, this._ctx) ) {
			case 1:
				localctx = new YulNestedBlockStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1528;
				this.yulBlock();
				}
				break;
			case 2:
				localctx = new YulVarDeclStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1529;
				this.yulVariableDeclaration();
				}
				break;
			case 3:
				localctx = new YulAssignStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1530;
				this.yulAssignment();
				}
				break;
			case 4:
				localctx = new YulIfStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1531;
				this.yulIf();
				}
				break;
			case 5:
				localctx = new YulSwitchStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1532;
				this.yulSwitch();
				}
				break;
			case 6:
				localctx = new YulForStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1533;
				this.yulForLoop();
				}
				break;
			case 7:
				localctx = new YulFunctionDefStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1534;
				this.yulFunctionDefinition();
				}
				break;
			case 8:
				localctx = new YulBreakStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1535;
				this.match(SolidCashParser.T__98);
				}
				break;
			case 9:
				localctx = new YulContinueStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1536;
				this.match(SolidCashParser.T__99);
				}
				break;
			case 10:
				localctx = new YulLeaveStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1537;
				this.match(SolidCashParser.T__100);
				}
				break;
			case 11:
				localctx = new YulCallStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1538;
				this.yulFunctionCall();
				}
				break;
			case 12:
				localctx = new YulPathStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1539;
				this.yulPath();
				}
				break;
			case 13:
				localctx = new YulLiteralStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1540;
				this.yulLiteral();
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
	public yulVariableDeclaration(): YulVariableDeclarationContext {
		let localctx: YulVariableDeclarationContext = new YulVariableDeclarationContext(this, this._ctx, this.state);
		this.enterRule(localctx, 172, SolidCashParser.RULE_yulVariableDeclaration);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1543;
			this.match(SolidCashParser.T__101);
			this.state = 1544;
			this.anyIdentifier();
			this.state = 1549;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1545;
				this.match(SolidCashParser.T__4);
				this.state = 1546;
				this.anyIdentifier();
				}
				}
				this.state = 1551;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1554;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===103) {
				{
				this.state = 1552;
				this.match(SolidCashParser.T__102);
				this.state = 1553;
				this.yulExpression();
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
	public yulAssignment(): YulAssignmentContext {
		let localctx: YulAssignmentContext = new YulAssignmentContext(this, this._ctx, this.state);
		this.enterRule(localctx, 174, SolidCashParser.RULE_yulAssignment);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1556;
			this.yulPath();
			this.state = 1561;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1557;
				this.match(SolidCashParser.T__4);
				this.state = 1558;
				this.yulPath();
				}
				}
				this.state = 1563;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1564;
			this.match(SolidCashParser.T__102);
			this.state = 1565;
			this.yulExpression();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public yulIf(): YulIfContext {
		let localctx: YulIfContext = new YulIfContext(this, this._ctx, this.state);
		this.enterRule(localctx, 176, SolidCashParser.RULE_yulIf);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1567;
			this.match(SolidCashParser.T__90);
			this.state = 1568;
			this.yulExpression();
			this.state = 1569;
			this.yulBlock();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public yulSwitch(): YulSwitchContext {
		let localctx: YulSwitchContext = new YulSwitchContext(this, this._ctx, this.state);
		this.enterRule(localctx, 178, SolidCashParser.RULE_yulSwitch);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1571;
			this.match(SolidCashParser.T__103);
			this.state = 1572;
			this.yulExpression();
			this.state = 1582;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 105:
				{
				this.state = 1574;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1573;
					this.yulCase();
					}
					}
					this.state = 1576;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===105);
				this.state = 1579;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===106) {
					{
					this.state = 1578;
					this.yulDefault();
					}
				}

				}
				break;
			case 106:
				{
				this.state = 1581;
				this.yulDefault();
				}
				break;
			default:
				throw new NoViableAltException(this);
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
	public yulCase(): YulCaseContext {
		let localctx: YulCaseContext = new YulCaseContext(this, this._ctx, this.state);
		this.enterRule(localctx, 180, SolidCashParser.RULE_yulCase);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1584;
			this.match(SolidCashParser.T__104);
			this.state = 1585;
			this.yulLiteral();
			this.state = 1586;
			this.yulBlock();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public yulDefault(): YulDefaultContext {
		let localctx: YulDefaultContext = new YulDefaultContext(this, this._ctx, this.state);
		this.enterRule(localctx, 182, SolidCashParser.RULE_yulDefault);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1588;
			this.match(SolidCashParser.T__105);
			this.state = 1589;
			this.yulBlock();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public yulForLoop(): YulForLoopContext {
		let localctx: YulForLoopContext = new YulForLoopContext(this, this._ctx, this.state);
		this.enterRule(localctx, 184, SolidCashParser.RULE_yulForLoop);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1591;
			this.match(SolidCashParser.T__8);
			this.state = 1592;
			this.yulBlock();
			this.state = 1593;
			this.yulExpression();
			this.state = 1594;
			this.yulBlock();
			this.state = 1595;
			this.yulBlock();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public yulFunctionDefinition(): YulFunctionDefinitionContext {
		let localctx: YulFunctionDefinitionContext = new YulFunctionDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 186, SolidCashParser.RULE_yulFunctionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1597;
			this.match(SolidCashParser.T__6);
			this.state = 1598;
			this.match(SolidCashParser.Identifier);
			this.state = 1599;
			this.match(SolidCashParser.T__48);
			this.state = 1608;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 1600;
				this.match(SolidCashParser.Identifier);
				this.state = 1605;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1601;
					this.match(SolidCashParser.T__4);
					this.state = 1602;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1607;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1610;
			this.match(SolidCashParser.T__49);
			this.state = 1620;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===107) {
				{
				this.state = 1611;
				this.match(SolidCashParser.T__106);
				this.state = 1612;
				this.match(SolidCashParser.Identifier);
				this.state = 1617;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1613;
					this.match(SolidCashParser.T__4);
					this.state = 1614;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1619;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1622;
			this.yulBlock();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public yulExpression(): YulExpressionContext {
		let localctx: YulExpressionContext = new YulExpressionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 188, SolidCashParser.RULE_yulExpression);
		try {
			this.state = 1627;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 183, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1624;
				this.yulFunctionCall();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1625;
				this.yulPath();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1626;
				this.yulLiteral();
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
	public yulFunctionCall(): YulFunctionCallContext {
		let localctx: YulFunctionCallContext = new YulFunctionCallContext(this, this._ctx, this.state);
		this.enterRule(localctx, 190, SolidCashParser.RULE_yulFunctionCall);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1629;
			this.yulFunctionName();
			this.state = 1630;
			this.match(SolidCashParser.T__48);
			this.state = 1639;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===86 || _la===108 || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				this.state = 1631;
				this.yulExpression();
				this.state = 1636;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1632;
					this.match(SolidCashParser.T__4);
					this.state = 1633;
					this.yulExpression();
					}
					}
					this.state = 1638;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1641;
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
	public yulFunctionName(): YulFunctionNameContext {
		let localctx: YulFunctionNameContext = new YulFunctionNameContext(this, this._ctx, this.state);
		this.enterRule(localctx, 192, SolidCashParser.RULE_yulFunctionName);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1643;
			_la = this._input.LA(1);
			if(!(_la===31 || _la===36 || _la===86 || _la===108 || _la===149 || _la===180)) {
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
	public yulPath(): YulPathContext {
		let localctx: YulPathContext = new YulPathContext(this, this._ctx, this.state);
		this.enterRule(localctx, 194, SolidCashParser.RULE_yulPath);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1645;
			this.anyIdentifier();
			this.state = 1651;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===12 || _la===164) {
				{
				this.state = 1649;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 12:
					{
					this.state = 1646;
					this.match(SolidCashParser.T__11);
					this.state = 1647;
					this.anyIdentifier();
					}
					break;
				case 164:
					{
					this.state = 1648;
					this.match(SolidCashParser.DotLength);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 1653;
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
	public yulLiteral(): YulLiteralContext {
		let localctx: YulLiteralContext = new YulLiteralContext(this, this._ctx, this.state);
		this.enterRule(localctx, 196, SolidCashParser.RULE_yulLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1654;
			_la = this._input.LA(1);
			if(!(((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102289) !== 0))) {
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
		this.enterRule(localctx, 198, SolidCashParser.RULE_uncheckedStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1656;
			this.match(SolidCashParser.T__108);
			this.state = 1657;
			this.match(SolidCashParser.T__3);
			this.state = 1661;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1658;
				this.statement();
				}
				}
				this.state = 1663;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1664;
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
		this.enterRule(localctx, 200, SolidCashParser.RULE_switchStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1666;
			this.match(SolidCashParser.T__103);
			this.state = 1667;
			this.match(SolidCashParser.T__48);
			this.state = 1668;
			this.expression(0);
			this.state = 1669;
			this.match(SolidCashParser.T__49);
			this.state = 1670;
			this.match(SolidCashParser.T__3);
			this.state = 1674;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===105) {
				{
				{
				this.state = 1671;
				this.switchCase();
				}
				}
				this.state = 1676;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1678;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===106) {
				{
				this.state = 1677;
				this.switchDefault();
				}
			}

			this.state = 1680;
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
		this.enterRule(localctx, 202, SolidCashParser.RULE_switchCase);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1682;
			this.match(SolidCashParser.T__104);
			this.state = 1683;
			this.expression(0);
			this.state = 1684;
			this.match(SolidCashParser.T__109);
			this.state = 1688;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1685;
				this.statement();
				}
				}
				this.state = 1690;
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
		this.enterRule(localctx, 204, SolidCashParser.RULE_switchDefault);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1691;
			this.match(SolidCashParser.T__105);
			this.state = 1692;
			this.match(SolidCashParser.T__109);
			this.state = 1696;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1693;
				this.statement();
				}
				}
				this.state = 1698;
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
		this.enterRule(localctx, 206, SolidCashParser.RULE_tryCatchStatement);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1699;
			this.match(SolidCashParser.T__110);
			this.state = 1700;
			this.expression(0);
			this.state = 1702;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 1701;
				this.tryReturns();
				}
			}

			this.state = 1704;
			localctx._tryBlock = this.block();
			this.state = 1706;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1705;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1708;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 194, this._ctx);
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
		this.enterRule(localctx, 208, SolidCashParser.RULE_tryReturns);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1710;
			this.match(SolidCashParser.T__72);
			this.state = 1711;
			this.match(SolidCashParser.T__48);
			this.state = 1723;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1712;
				this.parameter();
				this.state = 1717;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 195, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1713;
						this.match(SolidCashParser.T__4);
						this.state = 1714;
						this.parameter();
						}
						}
					}
					this.state = 1719;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 195, this._ctx);
				}
				this.state = 1721;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1720;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1725;
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
		this.enterRule(localctx, 210, SolidCashParser.RULE_catchClause);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1727;
			this.match(SolidCashParser.T__111);
			this.state = 1729;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 198, this._ctx) ) {
			case 1:
				{
				this.state = 1728;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 1746;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 202, this._ctx) ) {
			case 1:
				{
				this.state = 1731;
				this.match(SolidCashParser.T__48);
				this.state = 1743;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 1732;
					this.parameter();
					this.state = 1737;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 199, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1733;
							this.match(SolidCashParser.T__4);
							this.state = 1734;
							this.parameter();
							}
							}
						}
						this.state = 1739;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 199, this._ctx);
					}
					this.state = 1741;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1740;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1745;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
			this.state = 1748;
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
		this.enterRule(localctx, 212, SolidCashParser.RULE_breakStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1750;
			this.match(SolidCashParser.T__98);
			this.state = 1751;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 214, SolidCashParser.RULE_continueStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1753;
			this.match(SolidCashParser.T__99);
			this.state = 1754;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 216, SolidCashParser.RULE_requireMessage);
		try {
			this.state = 1759;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 151:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1756;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 180:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1757;
				this.match(SolidCashParser.Identifier);
				this.state = 1758;
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
		this.enterRule(localctx, 218, SolidCashParser.RULE_revertStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1803;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 209, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1761;
				this.match(SolidCashParser.T__35);
				this.state = 1762;
				this.match(SolidCashParser.Identifier);
				this.state = 1765;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1763;
					this.match(SolidCashParser.T__11);
					this.state = 1764;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1767;
				this.match(SolidCashParser.T__48);
				this.state = 1768;
				this.match(SolidCashParser.T__3);
				this.state = 1780;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1769;
					this.namedArg();
					this.state = 1774;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 205, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1770;
							this.match(SolidCashParser.T__4);
							this.state = 1771;
							this.namedArg();
							}
							}
						}
						this.state = 1776;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 205, this._ctx);
					}
					this.state = 1778;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1777;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1782;
				this.match(SolidCashParser.T__5);
				this.state = 1783;
				this.match(SolidCashParser.T__49);
				this.state = 1784;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1785;
				this.match(SolidCashParser.T__35);
				this.state = 1786;
				this.match(SolidCashParser.Identifier);
				this.state = 1789;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1787;
					this.match(SolidCashParser.T__11);
					this.state = 1788;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1791;
				this.expressionList();
				this.state = 1792;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1794;
				this.match(SolidCashParser.T__35);
				this.state = 1795;
				this.match(SolidCashParser.T__48);
				this.state = 1796;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1797;
				this.match(SolidCashParser.T__49);
				this.state = 1798;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1799;
				this.match(SolidCashParser.T__35);
				this.state = 1800;
				this.match(SolidCashParser.T__48);
				this.state = 1801;
				this.match(SolidCashParser.T__49);
				this.state = 1802;
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
		this.enterRule(localctx, 220, SolidCashParser.RULE_assertStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1805;
			this.match(SolidCashParser.T__112);
			this.state = 1806;
			this.match(SolidCashParser.T__48);
			this.state = 1807;
			this.expression(0);
			this.state = 1808;
			this.match(SolidCashParser.T__49);
			this.state = 1809;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 222, SolidCashParser.RULE_consoleParameter);
		try {
			this.state = 1813;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 180:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1811;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 141:
			case 144:
			case 145:
			case 151:
			case 152:
			case 153:
			case 161:
			case 162:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1812;
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
		this.enterRule(localctx, 224, SolidCashParser.RULE_consoleParameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1815;
			this.match(SolidCashParser.T__48);
			this.state = 1827;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 3152921) !== 0) || _la===180) {
				{
				this.state = 1816;
				this.consoleParameter();
				this.state = 1821;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 211, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1817;
						this.match(SolidCashParser.T__4);
						this.state = 1818;
						this.consoleParameter();
						}
						}
					}
					this.state = 1823;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 211, this._ctx);
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
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 226, SolidCashParser.RULE_functionCall);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1855;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 217, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1831;
				this.match(SolidCashParser.Identifier);
				this.state = 1832;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1833;
				this.match(SolidCashParser.Identifier);
				this.state = 1834;
				this.match(SolidCashParser.T__11);
				this.state = 1835;
				this.match(SolidCashParser.Identifier);
				this.state = 1836;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1837;
				this.match(SolidCashParser.Identifier);
				this.state = 1838;
				this.match(SolidCashParser.T__48);
				this.state = 1839;
				this.match(SolidCashParser.T__3);
				this.state = 1851;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1840;
					this.namedArg();
					this.state = 1845;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 214, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1841;
							this.match(SolidCashParser.T__4);
							this.state = 1842;
							this.namedArg();
							}
							}
						}
						this.state = 1847;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 214, this._ctx);
					}
					this.state = 1849;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1848;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1853;
				this.match(SolidCashParser.T__5);
				this.state = 1854;
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
		this.enterRule(localctx, 228, SolidCashParser.RULE_namedArg);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1857;
			this.match(SolidCashParser.Identifier);
			this.state = 1858;
			this.match(SolidCashParser.T__109);
			this.state = 1859;
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
		this.enterRule(localctx, 230, SolidCashParser.RULE_expressionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1861;
			this.match(SolidCashParser.T__48);
			this.state = 1873;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 132161) !== 0) || ((((_la - 89)) & ~0x1F) === 0 && ((1 << (_la - 89)) & 4261937153) !== 0) || ((((_la - 121)) & ~0x1F) === 0 && ((1 << (_la - 121)) & 3755343967) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 134218749) !== 0)) {
				{
				this.state = 1862;
				this.expression(0);
				this.state = 1867;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 218, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 218, this._ctx);
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
		this.enterRule(localctx, 232, SolidCashParser.RULE_callOptions);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1877;
			this.match(SolidCashParser.T__3);
			this.state = 1878;
			this.callOption();
			this.state = 1883;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 221, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1879;
					this.match(SolidCashParser.T__4);
					this.state = 1880;
					this.callOption();
					}
					}
				}
				this.state = 1885;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 221, this._ctx);
			}
			this.state = 1887;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1886;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1889;
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
		this.enterRule(localctx, 234, SolidCashParser.RULE_callOption);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1891;
			this.match(SolidCashParser.Identifier);
			this.state = 1892;
			this.match(SolidCashParser.T__109);
			this.state = 1893;
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
		this.enterRule(localctx, 236, SolidCashParser.RULE_typeList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1895;
			this.match(SolidCashParser.T__48);
			this.state = 1896;
			this.typeListItem();
			this.state = 1901;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 223, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1897;
					this.match(SolidCashParser.T__4);
					this.state = 1898;
					this.typeListItem();
					}
					}
				}
				this.state = 1903;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 223, this._ctx);
			}
			this.state = 1905;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1904;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1907;
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
	public typeListItem(): TypeListItemContext {
		let localctx: TypeListItemContext = new TypeListItemContext(this, this._ctx, this.state);
		this.enterRule(localctx, 238, SolidCashParser.RULE_typeListItem);
		try {
			this.state = 1911;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 225, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1909;
				this.typeName();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1910;
				this.arrayType(0);
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
		let _startState: number = 240;
		this.enterRecursionRule(localctx, 240, SolidCashParser.RULE_expression, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2075;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 234, this._ctx) ) {
			case 1:
				{
				localctx = new AssignmentExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 1914;
				this.match(SolidCashParser.T__48);
				this.state = 1915;
				this.match(SolidCashParser.Identifier);
				this.state = 1916;
				(localctx as AssignmentExpressionContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    (localctx as AssignmentExpressionContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1917;
				this.expression(0);
				this.state = 1918;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				{
				localctx = new InstantiationWithOptionsContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1920;
				this.match(SolidCashParser.T__48);
				this.state = 1921;
				this.match(SolidCashParser.T__113);
				this.state = 1922;
				this.match(SolidCashParser.Identifier);
				this.state = 1923;
				this.match(SolidCashParser.T__49);
				this.state = 1924;
				this.callOptions();
				this.state = 1925;
				this.expressionList();
				}
				break;
			case 3:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1927;
				this.match(SolidCashParser.T__48);
				this.state = 1928;
				this.expression(0);
				this.state = 1929;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 4:
				{
				localctx = new TupleExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1931;
				this.match(SolidCashParser.T__48);
				this.state = 1932;
				this.expression(0);
				this.state = 1935;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1933;
					this.match(SolidCashParser.T__4);
					this.state = 1934;
					this.expression(0);
					}
					}
					this.state = 1937;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1939;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 5:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1941;
				this.typeCast();
				this.state = 1942;
				this.match(SolidCashParser.T__48);
				this.state = 1943;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 1945;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1944;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1947;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 6:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1949;
				this.functionCall();
				}
				break;
			case 7:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1950;
				this.match(SolidCashParser.T__113);
				this.state = 1951;
				this.match(SolidCashParser.Identifier);
				this.state = 1953;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1952;
					this.callOptions();
					}
				}

				this.state = 1955;
				this.expressionList();
				}
				break;
			case 8:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1956;
				this.match(SolidCashParser.T__113);
				this.state = 1957;
				this.typeName();
				this.state = 1960;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1958;
					this.match(SolidCashParser.T__65);
					this.state = 1959;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1962;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1964;
				this.match(SolidCashParser.T__48);
				this.state = 1965;
				this.expression(0);
				this.state = 1966;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 9:
				{
				localctx = new NewDynamicBytesContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1968;
				this.match(SolidCashParser.T__113);
				this.state = 1969;
				this.match(SolidCashParser.UnboundedBytes);
				this.state = 1970;
				this.match(SolidCashParser.T__48);
				this.state = 1971;
				this.expression(0);
				this.state = 1972;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 10:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1974;
				this.match(SolidCashParser.T__54);
				this.state = 1975;
				this.match(SolidCashParser.T__48);
				this.state = 1976;
				this.typeName();
				this.state = 1977;
				this.match(SolidCashParser.T__49);
				this.state = 1978;
				this.match(SolidCashParser.T__11);
				this.state = 1979;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 11:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1981;
				this.match(SolidCashParser.T__114);
				this.state = 1982;
				this.expressionList();
				}
				break;
			case 12:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1983;
				this.match(SolidCashParser.T__115);
				this.state = 1984;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1985;
				this.match(SolidCashParser.T__116);
				this.state = 1986;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1987;
				this.match(SolidCashParser.T__117);
				this.state = 1988;
				this.expressionList();
				}
				break;
			case 15:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1989;
				this.match(SolidCashParser.T__118);
				this.state = 1990;
				this.match(SolidCashParser.T__48);
				this.state = 1991;
				this.match(SolidCashParser.Identifier);
				this.state = 1992;
				this.match(SolidCashParser.T__11);
				this.state = 1993;
				this.match(SolidCashParser.Identifier);
				this.state = 1994;
				this.match(SolidCashParser.T__4);
				this.state = 1995;
				this.expressionList();
				this.state = 1996;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 16:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1998;
				this.match(SolidCashParser.T__119);
				this.state = 1999;
				this.expressionList();
				}
				break;
			case 17:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2000;
				this.match(SolidCashParser.T__120);
				this.state = 2001;
				this.expressionList();
				}
				break;
			case 18:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2002;
				this.match(SolidCashParser.T__121);
				this.state = 2003;
				this.match(SolidCashParser.T__48);
				this.state = 2004;
				this.expression(0);
				this.state = 2005;
				this.match(SolidCashParser.T__4);
				this.state = 2006;
				this.typeList();
				this.state = 2007;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 19:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2009;
				this.match(SolidCashParser.T__122);
				this.state = 2010;
				this.match(SolidCashParser.T__48);
				this.state = 2011;
				this.expression(0);
				this.state = 2012;
				this.match(SolidCashParser.T__4);
				this.state = 2013;
				this.typeList();
				this.state = 2014;
				this.match(SolidCashParser.T__4);
				this.state = 2015;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 2016;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 20:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2018;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__123);
				this.state = 2019;
				this.match(SolidCashParser.T__65);
				this.state = 2020;
				this.expression(0);
				this.state = 2021;
				this.match(SolidCashParser.T__66);
				this.state = 2022;
				(localctx as UnaryIntrospectionOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 163)) & ~0x1F) === 0 && ((1 << (_la - 163)) & 7681) !== 0))) {
				    (localctx as UnaryIntrospectionOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				break;
			case 21:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2024;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__124);
				this.state = 2025;
				this.match(SolidCashParser.T__65);
				this.state = 2026;
				this.expression(0);
				this.state = 2027;
				this.match(SolidCashParser.T__66);
				this.state = 2028;
				(localctx as UnaryIntrospectionOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 163)) & ~0x1F) === 0 && ((1 << (_la - 163)) & 130561) !== 0))) {
				    (localctx as UnaryIntrospectionOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				break;
			case 22:
				{
				localctx = new UnaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2030;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===127)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2031;
				this.expression(21);
				}
				break;
			case 23:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2032;
				this.match(SolidCashParser.T__65);
				this.state = 2044;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 132161) !== 0) || ((((_la - 89)) & ~0x1F) === 0 && ((1 << (_la - 89)) & 4261937153) !== 0) || ((((_la - 121)) & ~0x1F) === 0 && ((1 << (_la - 121)) & 3755343967) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 134218749) !== 0)) {
					{
					this.state = 2033;
					this.expression(0);
					this.state = 2038;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 230, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2034;
							this.match(SolidCashParser.T__4);
							this.state = 2035;
							this.expression(0);
							}
							}
						}
						this.state = 2040;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 230, this._ctx);
					}
					this.state = 2042;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2041;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2046;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 24:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2047;
				this.match(SolidCashParser.T__88);
				this.state = 2048;
				this.match(SolidCashParser.T__11);
				this.state = 2049;
				this.match(SolidCashParser.Identifier);
				this.state = 2050;
				this.match(SolidCashParser.T__11);
				this.state = 2051;
				this.match(SolidCashParser.Identifier);
				this.state = 2052;
				this.match(SolidCashParser.T__65);
				this.state = 2053;
				this.expression(0);
				this.state = 2054;
				this.match(SolidCashParser.T__66);
				this.state = 2055;
				this.memberName();
				}
				break;
			case 25:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2057;
				this.match(SolidCashParser.T__88);
				this.state = 2058;
				this.match(SolidCashParser.T__11);
				this.state = 2059;
				this.match(SolidCashParser.Identifier);
				this.state = 2064;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2060;
						this.match(SolidCashParser.T__65);
						this.state = 2061;
						this.expression(0);
						this.state = 2062;
						this.match(SolidCashParser.T__66);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2066;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 233, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 26:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2068;
				this.match(SolidCashParser.T__88);
				this.state = 2069;
				this.match(SolidCashParser.T__11);
				this.state = 2070;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 27:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2071;
				this.match(SolidCashParser.T__88);
				}
				break;
			case 28:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2072;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 29:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2073;
				this.anyIdentifier();
				}
				break;
			case 30:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2074;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2184;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 241, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2182;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 240, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2077;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 2078;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 2079;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2080;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 2081;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2082;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2083;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 2084;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2085;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2086;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 2087;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===128 || _la===129)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2088;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2089;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 2090;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2091;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2092;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2093;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2094;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2095;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2096;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2097;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2098;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2099;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2100;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2101;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2102;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2103;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2104;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2105;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__129);
						this.state = 2106;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2107;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2108;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__130);
						this.state = 2109;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2110;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 2111;
						this.match(SolidCashParser.T__131);
						this.state = 2112;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 2113;
						this.match(SolidCashParser.T__109);
						this.state = 2114;
						(localctx as TernaryOpContext)._ifFalse = this.expression(9);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2116;
						if (!(this.precpred(this._ctx, 33))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 33)");
						}
						this.state = 2117;
						this.match(SolidCashParser.T__65);
						this.state = 2118;
						(localctx as IndexRangeSliceContext)._start = this.expression(0);
						this.state = 2119;
						this.match(SolidCashParser.T__109);
						this.state = 2120;
						(localctx as IndexRangeSliceContext)._end = this.expression(0);
						this.state = 2121;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2123;
						if (!(this.precpred(this._ctx, 32))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 32)");
						}
						this.state = 2124;
						this.match(SolidCashParser.T__65);
						this.state = 2125;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2126;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2127;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 2128;
						this.match(SolidCashParser.T__65);
						this.state = 2129;
						this.expression(0);
						this.state = 2130;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2132;
						if (!(this.precpred(this._ctx, 28))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 28)");
						}
						this.state = 2133;
						(localctx as UnaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===126 || _la===164)) {
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
						this.state = 2134;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2135;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.DotSplit);
						this.state = 2136;
						this.match(SolidCashParser.T__48);
						this.state = 2137;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2138;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2140;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2141;
						this.match(SolidCashParser.DotSlice);
						this.state = 2142;
						this.match(SolidCashParser.T__48);
						this.state = 2143;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2144;
						this.match(SolidCashParser.T__4);
						this.state = 2145;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2146;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2148;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2149;
						this.match(SolidCashParser.T__11);
						this.state = 2150;
						this.match(SolidCashParser.Identifier);
						this.state = 2152;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2151;
							this.callOptions();
							}
						}

						this.state = 2154;
						this.match(SolidCashParser.T__48);
						this.state = 2155;
						this.match(SolidCashParser.T__3);
						this.state = 2167;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===180) {
							{
							this.state = 2156;
							this.namedArg();
							this.state = 2161;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 236, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2157;
									this.match(SolidCashParser.T__4);
									this.state = 2158;
									this.namedArg();
									}
									}
								}
								this.state = 2163;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 236, this._ctx);
							}
							this.state = 2165;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2164;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2169;
						this.match(SolidCashParser.T__5);
						this.state = 2170;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 20:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2171;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2172;
						this.match(SolidCashParser.T__11);
						this.state = 2173;
						this.match(SolidCashParser.Identifier);
						this.state = 2175;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2174;
							this.callOptions();
							}
						}

						this.state = 2177;
						this.expressionList();
						}
						break;
					case 21:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2178;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2179;
						this.memberName();
						}
						break;
					case 22:
						{
						localctx = new PostfixOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2180;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 2181;
						(localctx as PostfixOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===84 || _la===85)) {
						    (localctx as PostfixOpContext)._op = this._errHandler.recoverInline(this);
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
				this.state = 2186;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 241, this._ctx);
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
		this.enterRule(localctx, 242, SolidCashParser.RULE_memberName);
		try {
			this.state = 2200;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2187;
				this.match(SolidCashParser.T__11);
				this.state = 2188;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2189;
				this.match(SolidCashParser.DotValue);
				}
				break;
			case 172:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2190;
				this.match(SolidCashParser.DotLockingBytecode);
				}
				break;
			case 173:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2191;
				this.match(SolidCashParser.DotTokenCategory);
				}
				break;
			case 174:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2192;
				this.match(SolidCashParser.DotNftCommitment);
				}
				break;
			case 175:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2193;
				this.match(SolidCashParser.DotTokenAmount);
				}
				break;
			case 176:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2194;
				this.match(SolidCashParser.DotOutpointTransactionHash);
				}
				break;
			case 177:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2195;
				this.match(SolidCashParser.DotOutpointIndex);
				}
				break;
			case 178:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2196;
				this.match(SolidCashParser.DotUnlockingBytecode);
				}
				break;
			case 179:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2197;
				this.match(SolidCashParser.DotSequenceNumber);
				}
				break;
			case 170:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2198;
				this.match(SolidCashParser.DotCode);
				}
				break;
			case 171:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2199;
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
		this.enterRule(localctx, 244, SolidCashParser.RULE_modifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2202;
			_la = this._input.LA(1);
			if(!(_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0))) {
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
		this.enterRule(localctx, 246, SolidCashParser.RULE_literal);
		try {
			let _alt: number;
			this.state = 2218;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 141:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2204;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 145:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2205;
				this.numberLiteral();
				}
				break;
			case 144:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2206;
				this.decimalLiteral();
				}
				break;
			case 151:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2207;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2211;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 243, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2208;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2213;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 243, this._ctx);
				}
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2214;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2215;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 152:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2216;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 153:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2217;
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
		this.enterRule(localctx, 248, SolidCashParser.RULE_numberLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2220;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2222;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 245, this._ctx) ) {
			case 1:
				{
				this.state = 2221;
				_la = this._input.LA(1);
				if(!(_la===142 || _la===143)) {
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
		this.enterRule(localctx, 250, SolidCashParser.RULE_decimalLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2224;
			this.match(SolidCashParser.DecimalLiteral);
			this.state = 2226;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 246, this._ctx) ) {
			case 1:
				{
				this.state = 2225;
				_la = this._input.LA(1);
				if(!(_la===142 || _la===143)) {
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
	public typeName(): TypeNameContext {
		let localctx: TypeNameContext = new TypeNameContext(this, this._ctx, this.state);
		this.enterRule(localctx, 252, SolidCashParser.RULE_typeName);
		let _la: number;
		try {
			this.state = 2278;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 252, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2228;
				this.match(SolidCashParser.T__107);
				this.state = 2229;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2230;
				this.match(SolidCashParser.T__107);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2231;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2232;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2233;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2234;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2235;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2236;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2237;
				this.match(SolidCashParser.T__137);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2238;
				this.match(SolidCashParser.T__138);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2239;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2240;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2241;
				this.match(SolidCashParser.T__6);
				this.state = 2242;
				this.match(SolidCashParser.T__48);
				this.state = 2251;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 2243;
					this.typeName();
					this.state = 2248;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2244;
						this.match(SolidCashParser.T__4);
						this.state = 2245;
						this.typeName();
						}
						}
						this.state = 2250;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2253;
				this.match(SolidCashParser.T__49);
				this.state = 2257;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===70 || _la===71) {
					{
					{
					this.state = 2254;
					_la = this._input.LA(1);
					if(!(_la===70 || _la===71)) {
					this._errHandler.recoverInline(this);
					}
					else {
						this._errHandler.reportMatch(this);
					    this.consume();
					}
					}
					}
					this.state = 2259;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 2272;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===73) {
					{
					this.state = 2260;
					this.match(SolidCashParser.T__72);
					this.state = 2261;
					this.match(SolidCashParser.T__48);
					this.state = 2262;
					this.typeName();
					this.state = 2267;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2263;
						this.match(SolidCashParser.T__4);
						this.state = 2264;
						this.typeName();
						}
						}
						this.state = 2269;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2270;
					this.match(SolidCashParser.T__49);
					}
				}

				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2274;
				this.match(SolidCashParser.Identifier);
				this.state = 2275;
				this.match(SolidCashParser.T__11);
				this.state = 2276;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 2277;
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
		this.enterRule(localctx, 254, SolidCashParser.RULE_typeCast);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2280;
			_la = this._input.LA(1);
			if(!(_la===59 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15887) !== 0))) {
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
		case 42:
			return this.arrayType_sempred(localctx as ArrayTypeContext, predIndex);
		case 120:
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
			return this.precpred(this._ctx, 33);
		case 15:
			return this.precpred(this._ctx, 32);
		case 16:
			return this.precpred(this._ctx, 31);
		case 17:
			return this.precpred(this._ctx, 28);
		case 18:
			return this.precpred(this._ctx, 27);
		case 19:
			return this.precpred(this._ctx, 26);
		case 20:
			return this.precpred(this._ctx, 25);
		case 21:
			return this.precpred(this._ctx, 24);
		case 22:
			return this.precpred(this._ctx, 23);
		case 23:
			return this.precpred(this._ctx, 22);
		}
		return true;
	}

	public static readonly _serializedATN: number[] = [4,1,183,2283,2,0,7,0,
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
	7,115,2,116,7,116,2,117,7,117,2,118,7,118,2,119,7,119,2,120,7,120,2,121,
	7,121,2,122,7,122,2,123,7,123,2,124,7,124,2,125,7,125,2,126,7,126,2,127,
	7,127,1,0,5,0,258,8,0,10,0,12,0,261,9,0,1,0,5,0,264,8,0,10,0,12,0,267,9,
	0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,5,0,279,8,0,10,0,12,0,282,9,0,
	1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,5,1,299,8,1,
	10,1,12,1,302,9,1,1,1,3,1,305,8,1,1,1,1,1,1,1,1,1,1,1,3,1,312,8,1,1,2,1,
	2,1,2,3,2,317,8,2,1,3,1,3,1,3,1,3,5,3,323,8,3,10,3,12,3,326,9,3,1,3,3,3,
	329,8,3,1,3,1,3,5,3,333,8,3,10,3,12,3,336,9,3,1,3,1,3,1,4,1,4,1,4,1,4,1,
	4,1,4,3,4,346,8,4,1,4,3,4,349,8,4,1,4,1,4,1,4,1,4,1,4,1,4,5,4,357,8,4,10,
	4,12,4,360,9,4,1,4,3,4,363,8,4,1,4,1,4,1,4,1,4,1,4,3,4,370,8,4,1,4,3,4,
	373,8,4,1,4,1,4,3,4,377,8,4,1,5,1,5,1,5,3,5,382,8,5,1,5,1,5,3,5,386,8,5,
	1,6,1,6,1,7,1,7,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,5,8,400,8,8,10,8,12,8,403,
	9,8,1,8,3,8,406,8,8,1,9,1,9,1,10,4,10,411,8,10,11,10,12,10,412,1,10,3,10,
	416,8,10,1,11,3,11,419,8,11,1,11,1,11,1,12,1,12,1,13,1,13,1,13,1,13,1,13,
	1,13,5,13,431,8,13,10,13,12,13,434,9,13,3,13,436,8,13,1,13,1,13,1,13,1,
	13,1,13,1,13,1,13,1,13,1,13,5,13,447,8,13,10,13,12,13,450,9,13,1,13,1,13,
	1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,3,14,464,8,14,1,15,1,
	15,1,15,1,15,1,15,1,16,1,16,1,17,1,17,1,17,1,17,5,17,477,8,17,10,17,12,
	17,480,9,17,1,17,3,17,483,8,17,1,17,1,17,1,18,1,18,1,18,1,18,1,18,1,18,
	1,18,1,18,1,18,1,18,1,18,1,18,5,18,499,8,18,10,18,12,18,502,9,18,1,18,1,
	18,1,19,3,19,507,8,19,1,19,1,19,1,19,3,19,512,8,19,1,19,1,19,1,19,1,19,
	5,19,518,8,19,10,19,12,19,521,9,19,3,19,523,8,19,1,19,1,19,1,19,1,19,1,
	19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,5,19,540,8,19,10,19,
	12,19,543,9,19,1,19,1,19,1,20,1,20,3,20,549,8,20,1,21,1,21,1,21,1,21,1,
	21,5,21,556,8,21,10,21,12,21,559,9,21,1,21,3,21,562,8,21,1,21,1,21,1,22,
	1,22,1,22,1,22,1,22,1,22,5,22,572,8,22,10,22,12,22,575,9,22,1,22,3,22,578,
	8,22,3,22,580,8,22,1,22,1,22,3,22,584,8,22,1,22,1,22,1,23,1,23,3,23,590,
	8,23,1,23,3,23,593,8,23,1,23,3,23,596,8,23,1,24,1,24,1,24,1,24,1,24,1,24,
	5,24,604,8,24,10,24,12,24,607,9,24,1,24,3,24,610,8,24,3,24,612,8,24,1,24,
	1,24,1,24,1,25,1,25,3,25,619,8,25,1,26,1,26,1,26,1,26,4,26,625,8,26,11,
	26,12,26,626,1,26,1,26,1,27,1,27,1,27,3,27,634,8,27,1,27,1,27,1,27,1,28,
	1,28,1,28,1,28,1,28,1,28,5,28,645,8,28,10,28,12,28,648,9,28,1,28,3,28,651,
	8,28,1,28,1,28,1,29,1,29,1,29,3,29,658,8,29,1,30,1,30,1,30,1,30,1,30,1,
	30,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,32,1,32,1,32,5,32,676,8,32,10,32,
	12,32,679,9,32,1,32,5,32,682,8,32,10,32,12,32,685,9,32,1,32,1,32,5,32,689,
	8,32,10,32,12,32,692,9,32,1,32,1,32,1,33,1,33,1,33,1,33,5,33,700,8,33,10,
	33,12,33,703,9,33,1,33,5,33,706,8,33,10,33,12,33,709,9,33,1,33,3,33,712,
	8,33,1,33,1,33,5,33,716,8,33,10,33,12,33,719,9,33,1,33,1,33,1,34,1,34,1,
	34,3,34,726,8,34,1,35,1,35,1,35,1,35,5,35,732,8,35,10,35,12,35,735,9,35,
	1,35,1,35,5,35,739,8,35,10,35,12,35,742,9,35,1,35,1,35,5,35,746,8,35,10,
	35,12,35,749,9,35,1,35,1,35,5,35,753,8,35,10,35,12,35,756,9,35,1,35,1,35,
	1,36,1,36,3,36,762,8,36,1,37,1,37,1,37,1,38,3,38,768,8,38,1,38,1,38,1,38,
	5,38,773,8,38,10,38,12,38,776,9,38,1,38,1,38,1,38,3,38,781,8,38,1,38,1,
	38,1,38,1,38,1,38,5,38,788,8,38,10,38,12,38,791,9,38,1,38,1,38,1,38,5,38,
	796,8,38,10,38,12,38,799,9,38,1,38,1,38,1,38,3,38,804,8,38,1,38,1,38,1,
	38,3,38,809,8,38,1,38,1,38,5,38,813,8,38,10,38,12,38,816,9,38,1,38,1,38,
	1,38,1,38,3,38,822,8,38,1,38,1,38,5,38,826,8,38,10,38,12,38,829,9,38,1,
	38,1,38,1,38,3,38,834,8,38,1,38,1,38,3,38,838,8,38,1,39,1,39,1,39,3,39,
	843,8,39,1,40,1,40,1,41,1,41,1,41,1,41,3,41,851,8,41,1,41,1,41,1,41,3,41,
	856,8,41,1,41,1,41,1,41,1,41,1,41,1,41,3,41,864,8,41,1,41,1,41,1,41,1,41,
	1,41,1,41,1,41,1,41,3,41,874,8,41,1,41,1,41,1,41,3,41,879,8,41,1,41,1,41,
	3,41,883,8,41,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,3,42,895,
	8,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,5,42,904,8,42,10,42,12,42,907,9,
	42,1,43,1,43,1,43,3,43,912,8,43,1,43,1,43,5,43,916,8,43,10,43,12,43,919,
	9,43,1,43,1,43,1,44,1,44,3,44,925,8,44,1,45,1,45,1,45,1,46,1,46,1,46,1,
	46,1,46,5,46,935,8,46,10,46,12,46,938,9,46,1,46,3,46,941,8,46,1,46,1,46,
	5,46,945,8,46,10,46,12,46,948,9,46,1,46,1,46,1,47,1,47,3,47,954,8,47,1,
	48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,3,48,
	970,8,48,1,49,1,49,1,49,1,49,1,49,5,49,977,8,49,10,49,12,49,980,9,49,1,
	49,3,49,983,8,49,1,50,1,50,1,50,1,50,3,50,989,8,50,1,51,1,51,1,51,1,51,
	1,51,5,51,996,8,51,10,51,12,51,999,9,51,1,51,3,51,1002,8,51,1,51,1,51,1,
	52,1,52,5,52,1008,8,52,10,52,12,52,1011,9,52,1,52,3,52,1014,8,52,1,52,1,
	52,5,52,1018,8,52,10,52,12,52,1021,9,52,1,52,3,52,1024,8,52,3,52,1026,8,
	52,1,53,1,53,1,53,1,53,5,53,1032,8,53,10,53,12,53,1035,9,53,1,53,3,53,1038,
	8,53,3,53,1040,8,53,1,53,1,53,1,54,1,54,5,54,1046,8,54,10,54,12,54,1049,
	9,54,1,54,3,54,1052,8,54,1,54,1,54,5,54,1056,8,54,10,54,12,54,1059,9,54,
	1,54,3,54,1062,8,54,1,54,1,54,5,54,1066,8,54,10,54,12,54,1069,9,54,1,54,
	3,54,1072,8,54,3,54,1074,8,54,1,55,1,55,5,55,1078,8,55,10,55,12,55,1081,
	9,55,1,55,1,55,3,55,1085,8,55,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,
	56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,3,56,
	1109,8,56,1,57,1,57,1,57,1,57,1,57,1,57,3,57,1117,8,57,1,57,1,57,1,57,1,
	57,1,57,1,57,1,57,1,57,1,57,3,57,1128,8,57,1,57,1,57,1,58,1,58,1,58,1,58,
	1,59,1,59,1,59,1,59,1,59,1,59,5,59,1142,8,59,10,59,12,59,1145,9,59,1,59,
	1,59,1,59,1,59,1,59,1,59,1,59,5,59,1154,8,59,10,59,12,59,1157,9,59,1,59,
	3,59,1160,8,59,1,59,1,59,1,59,3,59,1165,8,59,1,60,1,60,1,60,1,60,1,60,1,
	60,1,61,1,61,1,61,1,61,3,61,1177,8,61,1,61,1,61,1,61,1,61,1,61,5,61,1184,
	8,61,10,61,12,61,1187,9,61,1,61,3,61,1190,8,61,3,61,1192,8,61,1,61,1,61,
	1,61,1,61,1,61,1,61,1,61,3,61,1201,8,61,1,61,1,61,1,61,3,61,1206,8,61,1,
	62,1,62,1,62,1,62,1,62,3,62,1213,8,62,1,63,1,63,1,63,3,63,1218,8,63,1,64,
	1,64,5,64,1222,8,64,10,64,12,64,1225,9,64,1,64,1,64,1,64,3,64,1230,8,64,
	1,64,1,64,1,64,1,64,5,64,1236,8,64,10,64,12,64,1239,9,64,1,64,1,64,1,64,
	3,64,1244,8,64,1,64,1,64,3,64,1248,8,64,1,65,1,65,1,65,1,65,1,65,1,65,4,
	65,1256,8,65,11,65,12,65,1257,1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,65,4,
	65,1268,8,65,11,65,12,65,1269,1,65,1,65,1,65,1,65,1,65,1,65,4,65,1278,8,
	65,11,65,12,65,1279,1,65,1,65,1,65,1,65,1,65,1,65,1,65,4,65,1289,8,65,11,
	65,12,65,1290,1,65,1,65,1,65,1,65,1,65,3,65,1298,8,65,1,66,1,66,5,66,1302,
	8,66,10,66,12,66,1305,9,66,1,66,1,66,1,66,1,66,3,66,1311,8,66,1,67,1,67,
	1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,
	68,1,68,4,68,1331,8,68,11,68,12,68,1332,1,68,1,68,1,68,1,68,1,68,1,68,1,
	68,1,68,4,68,1343,8,68,11,68,12,68,1344,1,68,1,68,1,68,1,68,1,68,1,68,4,
	68,1353,8,68,11,68,12,68,1354,1,68,1,68,1,68,1,68,4,68,1361,8,68,11,68,
	12,68,1362,1,68,1,68,1,68,1,68,1,68,1,68,4,68,1371,8,68,11,68,12,68,1372,
	1,68,3,68,1376,8,68,1,69,1,69,1,69,1,69,1,69,1,69,1,69,3,69,1385,8,69,1,
	69,1,69,1,69,1,70,1,70,1,70,1,70,1,70,3,70,1395,8,70,1,70,1,70,1,70,1,71,
	1,71,1,71,1,71,1,71,1,71,1,71,3,71,1407,8,71,1,72,1,72,1,72,1,72,1,72,1,
	72,3,72,1415,8,72,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,
	1,73,1,73,1,73,1,73,1,73,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,
	74,1,74,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,76,1,76,
	1,76,1,76,1,76,3,76,1460,8,76,1,76,1,76,1,76,1,77,1,77,5,77,1467,8,77,10,
	77,12,77,1470,9,77,1,77,1,77,1,77,3,77,1475,8,77,1,77,1,77,1,77,1,77,1,
	77,1,77,1,77,1,77,3,77,1485,8,77,1,78,1,78,1,78,1,79,1,79,1,79,1,79,1,79,
	1,79,1,79,3,79,1497,8,79,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,81,1,
	81,1,81,1,81,1,81,1,81,1,82,1,82,1,82,1,82,1,83,1,83,1,83,1,84,1,84,5,84,
	1522,8,84,10,84,12,84,1525,9,84,1,84,1,84,1,85,1,85,1,85,1,85,1,85,1,85,
	1,85,1,85,1,85,1,85,1,85,1,85,1,85,3,85,1542,8,85,1,86,1,86,1,86,1,86,5,
	86,1548,8,86,10,86,12,86,1551,9,86,1,86,1,86,3,86,1555,8,86,1,87,1,87,1,
	87,5,87,1560,8,87,10,87,12,87,1563,9,87,1,87,1,87,1,87,1,88,1,88,1,88,1,
	88,1,89,1,89,1,89,4,89,1575,8,89,11,89,12,89,1576,1,89,3,89,1580,8,89,1,
	89,3,89,1583,8,89,1,90,1,90,1,90,1,90,1,91,1,91,1,91,1,92,1,92,1,92,1,92,
	1,92,1,92,1,93,1,93,1,93,1,93,1,93,1,93,5,93,1604,8,93,10,93,12,93,1607,
	9,93,3,93,1609,8,93,1,93,1,93,1,93,1,93,1,93,5,93,1616,8,93,10,93,12,93,
	1619,9,93,3,93,1621,8,93,1,93,1,93,1,94,1,94,1,94,3,94,1628,8,94,1,95,1,
	95,1,95,1,95,1,95,5,95,1635,8,95,10,95,12,95,1638,9,95,3,95,1640,8,95,1,
	95,1,95,1,96,1,96,1,97,1,97,1,97,1,97,5,97,1650,8,97,10,97,12,97,1653,9,
	97,1,98,1,98,1,99,1,99,1,99,5,99,1660,8,99,10,99,12,99,1663,9,99,1,99,1,
	99,1,100,1,100,1,100,1,100,1,100,1,100,5,100,1673,8,100,10,100,12,100,1676,
	9,100,1,100,3,100,1679,8,100,1,100,1,100,1,101,1,101,1,101,1,101,5,101,
	1687,8,101,10,101,12,101,1690,9,101,1,102,1,102,1,102,5,102,1695,8,102,
	10,102,12,102,1698,9,102,1,103,1,103,1,103,3,103,1703,8,103,1,103,1,103,
	4,103,1707,8,103,11,103,12,103,1708,1,104,1,104,1,104,1,104,1,104,5,104,
	1716,8,104,10,104,12,104,1719,9,104,1,104,3,104,1722,8,104,3,104,1724,8,
	104,1,104,1,104,1,105,1,105,3,105,1730,8,105,1,105,1,105,1,105,1,105,5,
	105,1736,8,105,10,105,12,105,1739,9,105,1,105,3,105,1742,8,105,3,105,1744,
	8,105,1,105,3,105,1747,8,105,1,105,1,105,1,106,1,106,1,106,1,107,1,107,
	1,107,1,108,1,108,1,108,3,108,1760,8,108,1,109,1,109,1,109,1,109,3,109,
	1766,8,109,1,109,1,109,1,109,1,109,1,109,5,109,1773,8,109,10,109,12,109,
	1776,9,109,1,109,3,109,1779,8,109,3,109,1781,8,109,1,109,1,109,1,109,1,
	109,1,109,1,109,1,109,3,109,1790,8,109,1,109,1,109,1,109,1,109,1,109,1,
	109,1,109,1,109,1,109,1,109,1,109,1,109,3,109,1804,8,109,1,110,1,110,1,
	110,1,110,1,110,1,110,1,111,1,111,3,111,1814,8,111,1,112,1,112,1,112,1,
	112,5,112,1820,8,112,10,112,12,112,1823,9,112,1,112,3,112,1826,8,112,3,
	112,1828,8,112,1,112,1,112,1,113,1,113,1,113,1,113,1,113,1,113,1,113,1,
	113,1,113,1,113,1,113,1,113,5,113,1844,8,113,10,113,12,113,1847,9,113,1,
	113,3,113,1850,8,113,3,113,1852,8,113,1,113,1,113,3,113,1856,8,113,1,114,
	1,114,1,114,1,114,1,115,1,115,1,115,1,115,5,115,1866,8,115,10,115,12,115,
	1869,9,115,1,115,3,115,1872,8,115,3,115,1874,8,115,1,115,1,115,1,116,1,
	116,1,116,1,116,5,116,1882,8,116,10,116,12,116,1885,9,116,1,116,3,116,1888,
	8,116,1,116,1,116,1,117,1,117,1,117,1,117,1,118,1,118,1,118,1,118,5,118,
	1900,8,118,10,118,12,118,1903,9,118,1,118,3,118,1906,8,118,1,118,1,118,
	1,119,1,119,3,119,1912,8,119,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,4,120,1936,8,120,11,120,12,120,1937,1,120,1,120,1,120,
	1,120,1,120,1,120,3,120,1946,8,120,1,120,1,120,1,120,1,120,1,120,1,120,
	3,120,1954,8,120,1,120,1,120,1,120,1,120,1,120,4,120,1961,8,120,11,120,
	12,120,1962,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,5,120,2037,8,120,10,120,12,120,2040,9,120,1,120,3,120,2043,
	8,120,3,120,2045,8,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,4,120,2065,
	8,120,11,120,12,120,2066,1,120,1,120,1,120,1,120,1,120,1,120,1,120,3,120,
	2076,8,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,3,120,2153,8,120,1,120,1,120,1,120,1,120,
	1,120,5,120,2160,8,120,10,120,12,120,2163,9,120,1,120,3,120,2166,8,120,
	3,120,2168,8,120,1,120,1,120,1,120,1,120,1,120,1,120,3,120,2176,8,120,1,
	120,1,120,1,120,1,120,1,120,5,120,2183,8,120,10,120,12,120,2186,9,120,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,
	121,3,121,2201,8,121,1,122,1,122,1,123,1,123,1,123,1,123,1,123,5,123,2210,
	8,123,10,123,12,123,2213,9,123,1,123,1,123,1,123,1,123,3,123,2219,8,123,
	1,124,1,124,3,124,2223,8,124,1,125,1,125,3,125,2227,8,125,1,126,1,126,1,
	126,1,126,1,126,1,126,1,126,1,126,1,126,1,126,1,126,1,126,1,126,1,126,1,
	126,1,126,1,126,1,126,5,126,2247,8,126,10,126,12,126,2250,9,126,3,126,2252,
	8,126,1,126,1,126,5,126,2256,8,126,10,126,12,126,2259,9,126,1,126,1,126,
	1,126,1,126,1,126,5,126,2266,8,126,10,126,12,126,2269,9,126,1,126,1,126,
	3,126,2273,8,126,1,126,1,126,1,126,1,126,3,126,2279,8,126,1,127,1,127,1,
	127,0,2,84,240,128,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,
	38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,
	86,88,90,92,94,96,98,100,102,104,106,108,110,112,114,116,118,120,122,124,
	126,128,130,132,134,136,138,140,142,144,146,148,150,152,154,156,158,160,
	162,164,166,168,170,172,174,176,178,180,182,184,186,188,190,192,194,196,
	198,200,202,204,206,208,210,212,214,216,218,220,222,224,226,228,230,232,
	234,236,238,240,242,244,246,248,250,252,254,0,27,2,0,10,10,13,27,5,0,11,
	11,28,36,143,143,147,147,180,180,4,0,140,140,145,145,151,151,180,180,1,
	0,38,39,2,0,140,140,144,144,3,0,20,23,26,27,40,40,1,0,43,44,2,0,43,44,58,
	59,3,0,43,44,58,58,63,63,2,0,145,145,180,180,2,0,40,40,74,83,1,0,84,85,
	6,0,31,31,36,36,86,86,108,108,149,149,180,180,5,0,141,141,145,145,151,151,
	153,153,162,162,2,0,163,163,172,175,2,0,163,163,172,179,3,0,14,14,27,27,
	127,127,2,0,10,10,15,16,1,0,13,14,1,0,128,129,1,0,20,23,1,0,18,19,2,0,126,
	126,164,164,3,0,33,33,56,56,133,137,1,0,142,143,1,0,70,71,5,0,59,59,108,
	108,138,139,146,149,155,159,2590,0,259,1,0,0,0,2,311,1,0,0,0,4,313,1,0,
	0,0,6,318,1,0,0,0,8,376,1,0,0,0,10,378,1,0,0,0,12,387,1,0,0,0,14,389,1,
	0,0,0,16,405,1,0,0,0,18,407,1,0,0,0,20,415,1,0,0,0,22,418,1,0,0,0,24,422,
	1,0,0,0,26,424,1,0,0,0,28,463,1,0,0,0,30,465,1,0,0,0,32,470,1,0,0,0,34,
	472,1,0,0,0,36,486,1,0,0,0,38,506,1,0,0,0,40,546,1,0,0,0,42,550,1,0,0,0,
	44,565,1,0,0,0,46,589,1,0,0,0,48,597,1,0,0,0,50,616,1,0,0,0,52,620,1,0,
	0,0,54,633,1,0,0,0,56,638,1,0,0,0,58,654,1,0,0,0,60,659,1,0,0,0,62,665,
	1,0,0,0,64,672,1,0,0,0,66,695,1,0,0,0,68,725,1,0,0,0,70,727,1,0,0,0,72,
	761,1,0,0,0,74,763,1,0,0,0,76,837,1,0,0,0,78,842,1,0,0,0,80,844,1,0,0,0,
	82,882,1,0,0,0,84,894,1,0,0,0,86,908,1,0,0,0,88,924,1,0,0,0,90,926,1,0,
	0,0,92,929,1,0,0,0,94,951,1,0,0,0,96,969,1,0,0,0,98,971,1,0,0,0,100,984,
	1,0,0,0,102,990,1,0,0,0,104,1025,1,0,0,0,106,1027,1,0,0,0,108,1073,1,0,
	0,0,110,1084,1,0,0,0,112,1108,1,0,0,0,114,1110,1,0,0,0,116,1131,1,0,0,0,
	118,1164,1,0,0,0,120,1166,1,0,0,0,122,1205,1,0,0,0,124,1212,1,0,0,0,126,
	1217,1,0,0,0,128,1247,1,0,0,0,130,1297,1,0,0,0,132,1310,1,0,0,0,134,1312,
	1,0,0,0,136,1375,1,0,0,0,138,1377,1,0,0,0,140,1389,1,0,0,0,142,1399,1,0,
	0,0,144,1414,1,0,0,0,146,1416,1,0,0,0,148,1432,1,0,0,0,150,1443,1,0,0,0,
	152,1454,1,0,0,0,154,1484,1,0,0,0,156,1486,1,0,0,0,158,1496,1,0,0,0,160,
	1498,1,0,0,0,162,1506,1,0,0,0,164,1512,1,0,0,0,166,1516,1,0,0,0,168,1519,
	1,0,0,0,170,1541,1,0,0,0,172,1543,1,0,0,0,174,1556,1,0,0,0,176,1567,1,0,
	0,0,178,1571,1,0,0,0,180,1584,1,0,0,0,182,1588,1,0,0,0,184,1591,1,0,0,0,
	186,1597,1,0,0,0,188,1627,1,0,0,0,190,1629,1,0,0,0,192,1643,1,0,0,0,194,
	1645,1,0,0,0,196,1654,1,0,0,0,198,1656,1,0,0,0,200,1666,1,0,0,0,202,1682,
	1,0,0,0,204,1691,1,0,0,0,206,1699,1,0,0,0,208,1710,1,0,0,0,210,1727,1,0,
	0,0,212,1750,1,0,0,0,214,1753,1,0,0,0,216,1759,1,0,0,0,218,1803,1,0,0,0,
	220,1805,1,0,0,0,222,1813,1,0,0,0,224,1815,1,0,0,0,226,1855,1,0,0,0,228,
	1857,1,0,0,0,230,1861,1,0,0,0,232,1877,1,0,0,0,234,1891,1,0,0,0,236,1895,
	1,0,0,0,238,1911,1,0,0,0,240,2075,1,0,0,0,242,2200,1,0,0,0,244,2202,1,0,
	0,0,246,2218,1,0,0,0,248,2220,1,0,0,0,250,2224,1,0,0,0,252,2278,1,0,0,0,
	254,2280,1,0,0,0,256,258,3,16,8,0,257,256,1,0,0,0,258,261,1,0,0,0,259,257,
	1,0,0,0,259,260,1,0,0,0,260,265,1,0,0,0,261,259,1,0,0,0,262,264,3,2,1,0,
	263,262,1,0,0,0,264,267,1,0,0,0,265,263,1,0,0,0,265,266,1,0,0,0,266,280,
	1,0,0,0,267,265,1,0,0,0,268,279,3,62,31,0,269,279,3,56,28,0,270,279,3,52,
	26,0,271,279,3,60,30,0,272,279,3,8,4,0,273,279,3,48,24,0,274,279,3,26,13,
	0,275,279,3,6,3,0,276,279,3,36,18,0,277,279,3,38,19,0,278,268,1,0,0,0,278,
	269,1,0,0,0,278,270,1,0,0,0,278,271,1,0,0,0,278,272,1,0,0,0,278,273,1,0,
	0,0,278,274,1,0,0,0,278,275,1,0,0,0,278,276,1,0,0,0,278,277,1,0,0,0,279,
	282,1,0,0,0,280,278,1,0,0,0,280,281,1,0,0,0,281,283,1,0,0,0,282,280,1,0,
	0,0,283,284,5,0,0,1,284,1,1,0,0,0,285,286,5,1,0,0,286,287,5,151,0,0,287,
	312,5,2,0,0,288,289,5,1,0,0,289,290,5,151,0,0,290,291,5,3,0,0,291,292,5,
	180,0,0,292,312,5,2,0,0,293,294,5,1,0,0,294,295,5,4,0,0,295,300,3,4,2,0,
	296,297,5,5,0,0,297,299,3,4,2,0,298,296,1,0,0,0,299,302,1,0,0,0,300,298,
	1,0,0,0,300,301,1,0,0,0,301,304,1,0,0,0,302,300,1,0,0,0,303,305,5,5,0,0,
	304,303,1,0,0,0,304,305,1,0,0,0,305,306,1,0,0,0,306,307,5,6,0,0,307,308,
	5,180,0,0,308,309,5,151,0,0,309,310,5,2,0,0,310,312,1,0,0,0,311,285,1,0,
	0,0,311,288,1,0,0,0,311,293,1,0,0,0,312,3,1,0,0,0,313,316,5,180,0,0,314,
	315,5,3,0,0,315,317,5,180,0,0,316,314,1,0,0,0,316,317,1,0,0,0,317,5,1,0,
	0,0,318,319,5,7,0,0,319,320,3,14,7,0,320,324,3,106,53,0,321,323,3,96,48,
	0,322,321,1,0,0,0,323,326,1,0,0,0,324,322,1,0,0,0,324,325,1,0,0,0,325,328,
	1,0,0,0,326,324,1,0,0,0,327,329,3,102,51,0,328,327,1,0,0,0,328,329,1,0,
	0,0,329,330,1,0,0,0,330,334,5,4,0,0,331,333,3,112,56,0,332,331,1,0,0,0,
	333,336,1,0,0,0,334,332,1,0,0,0,334,335,1,0,0,0,335,337,1,0,0,0,336,334,
	1,0,0,0,337,338,5,6,0,0,338,7,1,0,0,0,339,340,5,8,0,0,340,341,5,180,0,0,
	341,345,5,9,0,0,342,346,3,84,42,0,343,346,3,252,126,0,344,346,5,10,0,0,
	345,342,1,0,0,0,345,343,1,0,0,0,345,344,1,0,0,0,346,348,1,0,0,0,347,349,
	5,11,0,0,348,347,1,0,0,0,348,349,1,0,0,0,349,350,1,0,0,0,350,377,5,2,0,
	0,351,352,5,8,0,0,352,353,5,4,0,0,353,358,3,10,5,0,354,355,5,5,0,0,355,
	357,3,10,5,0,356,354,1,0,0,0,357,360,1,0,0,0,358,356,1,0,0,0,358,359,1,
	0,0,0,359,362,1,0,0,0,360,358,1,0,0,0,361,363,5,5,0,0,362,361,1,0,0,0,362,
	363,1,0,0,0,363,364,1,0,0,0,364,365,5,6,0,0,365,369,5,9,0,0,366,370,3,84,
	42,0,367,370,3,252,126,0,368,370,5,10,0,0,369,366,1,0,0,0,369,367,1,0,0,
	0,369,368,1,0,0,0,370,372,1,0,0,0,371,373,5,11,0,0,372,371,1,0,0,0,372,
	373,1,0,0,0,373,374,1,0,0,0,374,375,5,2,0,0,375,377,1,0,0,0,376,339,1,0,
	0,0,376,351,1,0,0,0,377,9,1,0,0,0,378,381,5,180,0,0,379,380,5,12,0,0,380,
	382,5,180,0,0,381,379,1,0,0,0,381,382,1,0,0,0,382,385,1,0,0,0,383,384,5,
	3,0,0,384,386,3,12,6,0,385,383,1,0,0,0,385,386,1,0,0,0,386,11,1,0,0,0,387,
	388,7,0,0,0,388,13,1,0,0,0,389,390,7,1,0,0,390,15,1,0,0,0,391,392,5,37,
	0,0,392,393,3,18,9,0,393,394,3,20,10,0,394,395,5,2,0,0,395,406,1,0,0,0,
	396,397,5,37,0,0,397,401,5,180,0,0,398,400,7,2,0,0,399,398,1,0,0,0,400,
	403,1,0,0,0,401,399,1,0,0,0,401,402,1,0,0,0,402,404,1,0,0,0,403,401,1,0,
	0,0,404,406,5,2,0,0,405,391,1,0,0,0,405,396,1,0,0,0,406,17,1,0,0,0,407,
	408,7,3,0,0,408,19,1,0,0,0,409,411,3,22,11,0,410,409,1,0,0,0,411,412,1,
	0,0,0,412,410,1,0,0,0,412,413,1,0,0,0,413,416,1,0,0,0,414,416,5,10,0,0,
	415,410,1,0,0,0,415,414,1,0,0,0,416,21,1,0,0,0,417,419,3,24,12,0,418,417,
	1,0,0,0,418,419,1,0,0,0,419,420,1,0,0,0,420,421,7,4,0,0,421,23,1,0,0,0,
	422,423,7,5,0,0,423,25,1,0,0,0,424,425,5,41,0,0,425,435,5,180,0,0,426,427,
	5,42,0,0,427,432,5,180,0,0,428,429,5,5,0,0,429,431,5,180,0,0,430,428,1,
	0,0,0,431,434,1,0,0,0,432,430,1,0,0,0,432,433,1,0,0,0,433,436,1,0,0,0,434,
	432,1,0,0,0,435,426,1,0,0,0,435,436,1,0,0,0,436,437,1,0,0,0,437,448,5,4,
	0,0,438,447,3,56,28,0,439,447,3,52,26,0,440,447,3,60,30,0,441,447,3,44,
	22,0,442,447,3,48,24,0,443,447,3,30,15,0,444,447,3,28,14,0,445,447,3,34,
	17,0,446,438,1,0,0,0,446,439,1,0,0,0,446,440,1,0,0,0,446,441,1,0,0,0,446,
	442,1,0,0,0,446,443,1,0,0,0,446,444,1,0,0,0,446,445,1,0,0,0,447,450,1,0,
	0,0,448,446,1,0,0,0,448,449,1,0,0,0,449,451,1,0,0,0,450,448,1,0,0,0,451,
	452,5,6,0,0,452,27,1,0,0,0,453,454,3,32,16,0,454,455,3,82,41,0,455,456,
	5,180,0,0,456,457,5,2,0,0,457,464,1,0,0,0,458,459,3,32,16,0,459,460,3,84,
	42,0,460,461,5,180,0,0,461,462,5,2,0,0,462,464,1,0,0,0,463,453,1,0,0,0,
	463,458,1,0,0,0,464,29,1,0,0,0,465,466,3,32,16,0,466,467,3,252,126,0,467,
	468,5,180,0,0,468,469,5,2,0,0,469,31,1,0,0,0,470,471,7,6,0,0,471,33,1,0,
	0,0,472,473,5,7,0,0,473,474,5,180,0,0,474,478,3,106,53,0,475,477,3,96,48,
	0,476,475,1,0,0,0,477,480,1,0,0,0,478,476,1,0,0,0,478,479,1,0,0,0,479,482,
	1,0,0,0,480,478,1,0,0,0,481,483,3,102,51,0,482,481,1,0,0,0,482,483,1,0,
	0,0,483,484,1,0,0,0,484,485,5,2,0,0,485,35,1,0,0,0,486,487,5,45,0,0,487,
	488,5,180,0,0,488,500,5,4,0,0,489,499,3,56,28,0,490,499,3,52,26,0,491,499,
	3,60,30,0,492,499,3,44,22,0,493,499,3,48,24,0,494,499,3,62,31,0,495,499,
	3,76,38,0,496,499,3,8,4,0,497,499,3,6,3,0,498,489,1,0,0,0,498,490,1,0,0,
	0,498,491,1,0,0,0,498,492,1,0,0,0,498,493,1,0,0,0,498,494,1,0,0,0,498,495,
	1,0,0,0,498,496,1,0,0,0,498,497,1,0,0,0,499,502,1,0,0,0,500,498,1,0,0,0,
	500,501,1,0,0,0,501,503,1,0,0,0,502,500,1,0,0,0,503,504,5,6,0,0,504,37,
	1,0,0,0,505,507,5,46,0,0,506,505,1,0,0,0,506,507,1,0,0,0,507,508,1,0,0,
	0,508,509,5,47,0,0,509,511,5,180,0,0,510,512,3,106,53,0,511,510,1,0,0,0,
	511,512,1,0,0,0,512,522,1,0,0,0,513,514,5,42,0,0,514,519,3,40,20,0,515,
	516,5,5,0,0,516,518,3,40,20,0,517,515,1,0,0,0,518,521,1,0,0,0,519,517,1,
	0,0,0,519,520,1,0,0,0,520,523,1,0,0,0,521,519,1,0,0,0,522,513,1,0,0,0,522,
	523,1,0,0,0,523,524,1,0,0,0,524,541,5,4,0,0,525,540,3,56,28,0,526,540,3,
	52,26,0,527,540,3,60,30,0,528,540,3,44,22,0,529,540,3,48,24,0,530,540,3,
	62,31,0,531,540,3,8,4,0,532,540,3,76,38,0,533,540,3,86,43,0,534,540,3,64,
	32,0,535,540,3,92,46,0,536,540,3,42,21,0,537,540,3,66,33,0,538,540,3,70,
	35,0,539,525,1,0,0,0,539,526,1,0,0,0,539,527,1,0,0,0,539,528,1,0,0,0,539,
	529,1,0,0,0,539,530,1,0,0,0,539,531,1,0,0,0,539,532,1,0,0,0,539,533,1,0,
	0,0,539,534,1,0,0,0,539,535,1,0,0,0,539,536,1,0,0,0,539,537,1,0,0,0,539,
	538,1,0,0,0,540,543,1,0,0,0,541,539,1,0,0,0,541,542,1,0,0,0,542,544,1,0,
	0,0,543,541,1,0,0,0,544,545,5,6,0,0,545,39,1,0,0,0,546,548,5,180,0,0,547,
	549,3,230,115,0,548,547,1,0,0,0,548,549,1,0,0,0,549,41,1,0,0,0,550,551,
	5,7,0,0,551,552,3,14,7,0,552,557,3,106,53,0,553,556,3,96,48,0,554,556,3,
	94,47,0,555,553,1,0,0,0,555,554,1,0,0,0,556,559,1,0,0,0,557,555,1,0,0,0,
	557,558,1,0,0,0,558,561,1,0,0,0,559,557,1,0,0,0,560,562,3,102,51,0,561,
	560,1,0,0,0,561,562,1,0,0,0,562,563,1,0,0,0,563,564,5,2,0,0,564,43,1,0,
	0,0,565,566,5,48,0,0,566,567,5,180,0,0,567,579,5,49,0,0,568,573,3,46,23,
	0,569,570,5,5,0,0,570,572,3,46,23,0,571,569,1,0,0,0,572,575,1,0,0,0,573,
	571,1,0,0,0,573,574,1,0,0,0,574,577,1,0,0,0,575,573,1,0,0,0,576,578,5,5,
	0,0,577,576,1,0,0,0,577,578,1,0,0,0,578,580,1,0,0,0,579,568,1,0,0,0,579,
	580,1,0,0,0,580,581,1,0,0,0,581,583,5,50,0,0,582,584,5,51,0,0,583,582,1,
	0,0,0,583,584,1,0,0,0,584,585,1,0,0,0,585,586,5,2,0,0,586,45,1,0,0,0,587,
	590,3,252,126,0,588,590,3,84,42,0,589,587,1,0,0,0,589,588,1,0,0,0,590,592,
	1,0,0,0,591,593,5,52,0,0,592,591,1,0,0,0,592,593,1,0,0,0,593,595,1,0,0,
	0,594,596,5,180,0,0,595,594,1,0,0,0,595,596,1,0,0,0,596,47,1,0,0,0,597,
	598,5,35,0,0,598,599,5,180,0,0,599,611,5,49,0,0,600,605,3,50,25,0,601,602,
	5,5,0,0,602,604,3,50,25,0,603,601,1,0,0,0,604,607,1,0,0,0,605,603,1,0,0,
	0,605,606,1,0,0,0,606,609,1,0,0,0,607,605,1,0,0,0,608,610,5,5,0,0,609,608,
	1,0,0,0,609,610,1,0,0,0,610,612,1,0,0,0,611,600,1,0,0,0,611,612,1,0,0,0,
	612,613,1,0,0,0,613,614,5,50,0,0,614,615,5,2,0,0,615,49,1,0,0,0,616,618,
	3,252,126,0,617,619,5,180,0,0,618,617,1,0,0,0,618,619,1,0,0,0,619,51,1,
	0,0,0,620,621,5,53,0,0,621,622,5,180,0,0,622,624,5,4,0,0,623,625,3,54,27,
	0,624,623,1,0,0,0,625,626,1,0,0,0,626,624,1,0,0,0,626,627,1,0,0,0,627,628,
	1,0,0,0,628,629,5,6,0,0,629,53,1,0,0,0,630,634,3,252,126,0,631,634,3,84,
	42,0,632,634,3,82,41,0,633,630,1,0,0,0,633,631,1,0,0,0,633,632,1,0,0,0,
	634,635,1,0,0,0,635,636,3,14,7,0,636,637,5,2,0,0,637,55,1,0,0,0,638,639,
	5,54,0,0,639,640,5,180,0,0,640,641,5,4,0,0,641,646,3,58,29,0,642,643,5,
	5,0,0,643,645,3,58,29,0,644,642,1,0,0,0,645,648,1,0,0,0,646,644,1,0,0,0,
	646,647,1,0,0,0,647,650,1,0,0,0,648,646,1,0,0,0,649,651,5,5,0,0,650,649,
	1,0,0,0,650,651,1,0,0,0,651,652,1,0,0,0,652,653,5,6,0,0,653,57,1,0,0,0,
	654,657,5,180,0,0,655,656,5,40,0,0,656,658,5,145,0,0,657,655,1,0,0,0,657,
	658,1,0,0,0,658,59,1,0,0,0,659,660,5,55,0,0,660,661,5,180,0,0,661,662,5,
	42,0,0,662,663,3,252,126,0,663,664,5,2,0,0,664,61,1,0,0,0,665,666,3,252,
	126,0,666,667,5,56,0,0,667,668,5,180,0,0,668,669,5,40,0,0,669,670,3,240,
	120,0,670,671,5,2,0,0,671,63,1,0,0,0,672,673,5,57,0,0,673,677,3,106,53,
	0,674,676,7,7,0,0,675,674,1,0,0,0,676,679,1,0,0,0,677,675,1,0,0,0,677,678,
	1,0,0,0,678,683,1,0,0,0,679,677,1,0,0,0,680,682,3,74,37,0,681,680,1,0,0,
	0,682,685,1,0,0,0,683,681,1,0,0,0,683,684,1,0,0,0,684,686,1,0,0,0,685,683,
	1,0,0,0,686,690,5,4,0,0,687,689,3,112,56,0,688,687,1,0,0,0,689,692,1,0,
	0,0,690,688,1,0,0,0,690,691,1,0,0,0,691,693,1,0,0,0,692,690,1,0,0,0,693,
	694,5,6,0,0,694,65,1,0,0,0,695,696,5,60,0,0,696,697,3,106,53,0,697,701,
	5,44,0,0,698,700,3,68,34,0,699,698,1,0,0,0,700,703,1,0,0,0,701,699,1,0,
	0,0,701,702,1,0,0,0,702,707,1,0,0,0,703,701,1,0,0,0,704,706,3,94,47,0,705,
	704,1,0,0,0,706,709,1,0,0,0,707,705,1,0,0,0,707,708,1,0,0,0,708,711,1,0,
	0,0,709,707,1,0,0,0,710,712,3,102,51,0,711,710,1,0,0,0,711,712,1,0,0,0,
	712,713,1,0,0,0,713,717,5,4,0,0,714,716,3,112,56,0,715,714,1,0,0,0,716,
	719,1,0,0,0,717,715,1,0,0,0,717,718,1,0,0,0,718,720,1,0,0,0,719,717,1,0,
	0,0,720,721,5,6,0,0,721,67,1,0,0,0,722,726,5,59,0,0,723,726,5,61,0,0,724,
	726,3,98,49,0,725,722,1,0,0,0,725,723,1,0,0,0,725,724,1,0,0,0,726,69,1,
	0,0,0,727,728,5,62,0,0,728,729,5,49,0,0,729,733,5,50,0,0,730,732,3,72,36,
	0,731,730,1,0,0,0,732,735,1,0,0,0,733,731,1,0,0,0,733,734,1,0,0,0,734,736,
	1,0,0,0,735,733,1,0,0,0,736,740,5,44,0,0,737,739,3,72,36,0,738,737,1,0,
	0,0,739,742,1,0,0,0,740,738,1,0,0,0,740,741,1,0,0,0,741,743,1,0,0,0,742,
	740,1,0,0,0,743,747,5,59,0,0,744,746,3,72,36,0,745,744,1,0,0,0,746,749,
	1,0,0,0,747,745,1,0,0,0,747,748,1,0,0,0,748,750,1,0,0,0,749,747,1,0,0,0,
	750,754,5,4,0,0,751,753,3,112,56,0,752,751,1,0,0,0,753,756,1,0,0,0,754,
	752,1,0,0,0,754,755,1,0,0,0,755,757,1,0,0,0,756,754,1,0,0,0,757,758,5,6,
	0,0,758,71,1,0,0,0,759,762,5,61,0,0,760,762,3,98,49,0,761,759,1,0,0,0,761,
	760,1,0,0,0,762,73,1,0,0,0,763,764,5,180,0,0,764,765,3,230,115,0,765,75,
	1,0,0,0,766,768,3,80,40,0,767,766,1,0,0,0,767,768,1,0,0,0,768,769,1,0,0,
	0,769,774,3,252,126,0,770,773,3,244,122,0,771,773,3,98,49,0,772,770,1,0,
	0,0,772,771,1,0,0,0,773,776,1,0,0,0,774,772,1,0,0,0,774,775,1,0,0,0,775,
	777,1,0,0,0,776,774,1,0,0,0,777,780,5,180,0,0,778,779,5,40,0,0,779,781,
	3,240,120,0,780,778,1,0,0,0,780,781,1,0,0,0,781,782,1,0,0,0,782,783,5,2,
	0,0,783,838,1,0,0,0,784,789,3,252,126,0,785,788,3,244,122,0,786,788,3,98,
	49,0,787,785,1,0,0,0,787,786,1,0,0,0,788,791,1,0,0,0,789,787,1,0,0,0,789,
	790,1,0,0,0,790,792,1,0,0,0,791,789,1,0,0,0,792,797,3,80,40,0,793,796,3,
	244,122,0,794,796,3,98,49,0,795,793,1,0,0,0,795,794,1,0,0,0,796,799,1,0,
	0,0,797,795,1,0,0,0,797,798,1,0,0,0,798,800,1,0,0,0,799,797,1,0,0,0,800,
	803,5,180,0,0,801,802,5,40,0,0,802,804,3,240,120,0,803,801,1,0,0,0,803,
	804,1,0,0,0,804,805,1,0,0,0,805,806,5,2,0,0,806,838,1,0,0,0,807,809,3,80,
	40,0,808,807,1,0,0,0,808,809,1,0,0,0,809,810,1,0,0,0,810,814,3,82,41,0,
	811,813,3,78,39,0,812,811,1,0,0,0,813,816,1,0,0,0,814,812,1,0,0,0,814,815,
	1,0,0,0,815,817,1,0,0,0,816,814,1,0,0,0,817,818,5,180,0,0,818,819,5,2,0,
	0,819,838,1,0,0,0,820,822,3,80,40,0,821,820,1,0,0,0,821,822,1,0,0,0,822,
	823,1,0,0,0,823,827,3,84,42,0,824,826,3,78,39,0,825,824,1,0,0,0,826,829,
	1,0,0,0,827,825,1,0,0,0,827,828,1,0,0,0,828,830,1,0,0,0,829,827,1,0,0,0,
	830,833,5,180,0,0,831,832,5,40,0,0,832,834,3,240,120,0,833,831,1,0,0,0,
	833,834,1,0,0,0,834,835,1,0,0,0,835,836,5,2,0,0,836,838,1,0,0,0,837,767,
	1,0,0,0,837,784,1,0,0,0,837,808,1,0,0,0,837,821,1,0,0,0,838,77,1,0,0,0,
	839,843,3,244,122,0,840,843,3,80,40,0,841,843,3,98,49,0,842,839,1,0,0,0,
	842,840,1,0,0,0,842,841,1,0,0,0,843,79,1,0,0,0,844,845,7,8,0,0,845,81,1,
	0,0,0,846,847,5,64,0,0,847,848,5,49,0,0,848,850,3,252,126,0,849,851,5,180,
	0,0,850,849,1,0,0,0,850,851,1,0,0,0,851,852,1,0,0,0,852,853,5,65,0,0,853,
	855,3,252,126,0,854,856,5,180,0,0,855,854,1,0,0,0,855,856,1,0,0,0,856,857,
	1,0,0,0,857,858,5,50,0,0,858,883,1,0,0,0,859,860,5,64,0,0,860,861,5,49,
	0,0,861,863,3,252,126,0,862,864,5,180,0,0,863,862,1,0,0,0,863,864,1,0,0,
	0,864,865,1,0,0,0,865,866,5,65,0,0,866,867,3,82,41,0,867,868,5,50,0,0,868,
	883,1,0,0,0,869,870,5,64,0,0,870,871,5,49,0,0,871,873,3,252,126,0,872,874,
	5,180,0,0,873,872,1,0,0,0,873,874,1,0,0,0,874,875,1,0,0,0,875,876,5,65,
	0,0,876,878,3,84,42,0,877,879,5,180,0,0,878,877,1,0,0,0,878,879,1,0,0,0,
	879,880,1,0,0,0,880,881,5,50,0,0,881,883,1,0,0,0,882,846,1,0,0,0,882,859,
	1,0,0,0,882,869,1,0,0,0,883,83,1,0,0,0,884,885,6,42,-1,0,885,886,3,252,
	126,0,886,887,5,66,0,0,887,888,7,9,0,0,888,889,5,67,0,0,889,895,1,0,0,0,
	890,891,3,252,126,0,891,892,5,66,0,0,892,893,5,67,0,0,893,895,1,0,0,0,894,
	884,1,0,0,0,894,890,1,0,0,0,895,905,1,0,0,0,896,897,10,2,0,0,897,898,5,
	66,0,0,898,899,7,9,0,0,899,904,5,67,0,0,900,901,10,1,0,0,901,902,5,66,0,
	0,902,904,5,67,0,0,903,896,1,0,0,0,903,900,1,0,0,0,904,907,1,0,0,0,905,
	903,1,0,0,0,905,906,1,0,0,0,906,85,1,0,0,0,907,905,1,0,0,0,908,909,5,68,
	0,0,909,911,5,180,0,0,910,912,3,106,53,0,911,910,1,0,0,0,911,912,1,0,0,
	0,912,913,1,0,0,0,913,917,5,4,0,0,914,916,3,88,44,0,915,914,1,0,0,0,916,
	919,1,0,0,0,917,915,1,0,0,0,917,918,1,0,0,0,918,920,1,0,0,0,919,917,1,0,
	0,0,920,921,5,6,0,0,921,87,1,0,0,0,922,925,3,90,45,0,923,925,3,112,56,0,
	924,922,1,0,0,0,924,923,1,0,0,0,925,89,1,0,0,0,926,927,5,69,0,0,927,928,
	5,2,0,0,928,91,1,0,0,0,929,930,5,7,0,0,930,931,3,14,7,0,931,936,3,106,53,
	0,932,935,3,96,48,0,933,935,3,94,47,0,934,932,1,0,0,0,934,933,1,0,0,0,935,
	938,1,0,0,0,936,934,1,0,0,0,936,937,1,0,0,0,937,940,1,0,0,0,938,936,1,0,
	0,0,939,941,3,102,51,0,940,939,1,0,0,0,940,941,1,0,0,0,941,942,1,0,0,0,
	942,946,5,4,0,0,943,945,3,112,56,0,944,943,1,0,0,0,945,948,1,0,0,0,946,
	944,1,0,0,0,946,947,1,0,0,0,947,949,1,0,0,0,948,946,1,0,0,0,949,950,5,6,
	0,0,950,93,1,0,0,0,951,953,5,180,0,0,952,954,3,230,115,0,953,952,1,0,0,
	0,953,954,1,0,0,0,954,95,1,0,0,0,955,970,5,70,0,0,956,970,5,71,0,0,957,
	970,5,58,0,0,958,970,5,44,0,0,959,970,5,43,0,0,960,970,5,63,0,0,961,970,
	5,59,0,0,962,970,3,98,49,0,963,970,5,61,0,0,964,970,3,100,50,0,965,970,
	5,30,0,0,966,970,5,28,0,0,967,970,5,31,0,0,968,970,5,29,0,0,969,955,1,0,
	0,0,969,956,1,0,0,0,969,957,1,0,0,0,969,958,1,0,0,0,969,959,1,0,0,0,969,
	960,1,0,0,0,969,961,1,0,0,0,969,962,1,0,0,0,969,963,1,0,0,0,969,964,1,0,
	0,0,969,965,1,0,0,0,969,966,1,0,0,0,969,967,1,0,0,0,969,968,1,0,0,0,970,
	97,1,0,0,0,971,982,5,72,0,0,972,973,5,49,0,0,973,978,5,180,0,0,974,975,
	5,5,0,0,975,977,5,180,0,0,976,974,1,0,0,0,977,980,1,0,0,0,978,976,1,0,0,
	0,978,979,1,0,0,0,979,981,1,0,0,0,980,978,1,0,0,0,981,983,5,50,0,0,982,
	972,1,0,0,0,982,983,1,0,0,0,983,99,1,0,0,0,984,988,5,32,0,0,985,986,5,49,
	0,0,986,987,5,145,0,0,987,989,5,50,0,0,988,985,1,0,0,0,988,989,1,0,0,0,
	989,101,1,0,0,0,990,991,5,73,0,0,991,992,5,49,0,0,992,997,3,104,52,0,993,
	994,5,5,0,0,994,996,3,104,52,0,995,993,1,0,0,0,996,999,1,0,0,0,997,995,
	1,0,0,0,997,998,1,0,0,0,998,1001,1,0,0,0,999,997,1,0,0,0,1000,1002,5,5,
	0,0,1001,1000,1,0,0,0,1001,1002,1,0,0,0,1002,1003,1,0,0,0,1003,1004,5,50,
	0,0,1004,103,1,0,0,0,1005,1009,3,252,126,0,1006,1008,3,244,122,0,1007,1006,
	1,0,0,0,1008,1011,1,0,0,0,1009,1007,1,0,0,0,1009,1010,1,0,0,0,1010,1013,
	1,0,0,0,1011,1009,1,0,0,0,1012,1014,3,14,7,0,1013,1012,1,0,0,0,1013,1014,
	1,0,0,0,1014,1026,1,0,0,0,1015,1019,3,84,42,0,1016,1018,3,244,122,0,1017,
	1016,1,0,0,0,1018,1021,1,0,0,0,1019,1017,1,0,0,0,1019,1020,1,0,0,0,1020,
	1023,1,0,0,0,1021,1019,1,0,0,0,1022,1024,3,14,7,0,1023,1022,1,0,0,0,1023,
	1024,1,0,0,0,1024,1026,1,0,0,0,1025,1005,1,0,0,0,1025,1015,1,0,0,0,1026,
	105,1,0,0,0,1027,1039,5,49,0,0,1028,1033,3,108,54,0,1029,1030,5,5,0,0,1030,
	1032,3,108,54,0,1031,1029,1,0,0,0,1032,1035,1,0,0,0,1033,1031,1,0,0,0,1033,
	1034,1,0,0,0,1034,1037,1,0,0,0,1035,1033,1,0,0,0,1036,1038,5,5,0,0,1037,
	1036,1,0,0,0,1037,1038,1,0,0,0,1038,1040,1,0,0,0,1039,1028,1,0,0,0,1039,
	1040,1,0,0,0,1040,1041,1,0,0,0,1041,1042,5,50,0,0,1042,107,1,0,0,0,1043,
	1047,3,252,126,0,1044,1046,3,244,122,0,1045,1044,1,0,0,0,1046,1049,1,0,
	0,0,1047,1045,1,0,0,0,1047,1048,1,0,0,0,1048,1051,1,0,0,0,1049,1047,1,0,
	0,0,1050,1052,3,14,7,0,1051,1050,1,0,0,0,1051,1052,1,0,0,0,1052,1074,1,
	0,0,0,1053,1057,3,84,42,0,1054,1056,3,244,122,0,1055,1054,1,0,0,0,1056,
	1059,1,0,0,0,1057,1055,1,0,0,0,1057,1058,1,0,0,0,1058,1061,1,0,0,0,1059,
	1057,1,0,0,0,1060,1062,3,14,7,0,1061,1060,1,0,0,0,1061,1062,1,0,0,0,1062,
	1074,1,0,0,0,1063,1067,3,82,41,0,1064,1066,3,244,122,0,1065,1064,1,0,0,
	0,1066,1069,1,0,0,0,1067,1065,1,0,0,0,1067,1068,1,0,0,0,1068,1071,1,0,0,
	0,1069,1067,1,0,0,0,1070,1072,3,14,7,0,1071,1070,1,0,0,0,1071,1072,1,0,
	0,0,1072,1074,1,0,0,0,1073,1043,1,0,0,0,1073,1053,1,0,0,0,1073,1063,1,0,
	0,0,1074,109,1,0,0,0,1075,1079,5,4,0,0,1076,1078,3,112,56,0,1077,1076,1,
	0,0,0,1078,1081,1,0,0,0,1079,1077,1,0,0,0,1079,1080,1,0,0,0,1080,1082,1,
	0,0,0,1081,1079,1,0,0,0,1082,1085,5,6,0,0,1083,1085,3,112,56,0,1084,1075,
	1,0,0,0,1084,1083,1,0,0,0,1085,111,1,0,0,0,1086,1109,3,90,45,0,1087,1109,
	3,128,64,0,1088,1109,3,130,65,0,1089,1109,3,116,58,0,1090,1109,3,138,69,
	0,1091,1109,3,140,70,0,1092,1109,3,142,71,0,1093,1109,3,144,72,0,1094,1109,
	3,164,82,0,1095,1109,3,122,61,0,1096,1109,3,118,59,0,1097,1109,3,120,60,
	0,1098,1109,3,166,83,0,1099,1109,3,206,103,0,1100,1109,3,218,109,0,1101,
	1109,3,220,110,0,1102,1109,3,136,68,0,1103,1109,3,198,99,0,1104,1109,3,
	200,100,0,1105,1109,3,212,106,0,1106,1109,3,214,107,0,1107,1109,3,114,57,
	0,1108,1086,1,0,0,0,1108,1087,1,0,0,0,1108,1088,1,0,0,0,1108,1089,1,0,0,
	0,1108,1090,1,0,0,0,1108,1091,1,0,0,0,1108,1092,1,0,0,0,1108,1093,1,0,0,
	0,1108,1094,1,0,0,0,1108,1095,1,0,0,0,1108,1096,1,0,0,0,1108,1097,1,0,0,
	0,1108,1098,1,0,0,0,1108,1099,1,0,0,0,1108,1100,1,0,0,0,1108,1101,1,0,0,
	0,1108,1102,1,0,0,0,1108,1103,1,0,0,0,1108,1104,1,0,0,0,1108,1105,1,0,0,
	0,1108,1106,1,0,0,0,1108,1107,1,0,0,0,1109,113,1,0,0,0,1110,1127,3,240,
	120,0,1111,1112,7,10,0,0,1112,1128,3,240,120,0,1113,1114,5,165,0,0,1114,
	1116,5,49,0,0,1115,1117,3,134,67,0,1116,1115,1,0,0,0,1116,1117,1,0,0,0,
	1117,1118,1,0,0,0,1118,1128,5,50,0,0,1119,1120,5,166,0,0,1120,1121,5,49,
	0,0,1121,1128,5,50,0,0,1122,1123,5,169,0,0,1123,1124,5,49,0,0,1124,1125,
	3,240,120,0,1125,1126,5,50,0,0,1126,1128,1,0,0,0,1127,1111,1,0,0,0,1127,
	1113,1,0,0,0,1127,1119,1,0,0,0,1127,1122,1,0,0,0,1127,1128,1,0,0,0,1128,
	1129,1,0,0,0,1129,1130,5,2,0,0,1130,115,1,0,0,0,1131,1132,7,11,0,0,1132,
	1133,3,240,120,0,1133,1134,5,2,0,0,1134,117,1,0,0,0,1135,1136,5,86,0,0,
	1136,1165,5,2,0,0,1137,1138,5,86,0,0,1138,1143,3,240,120,0,1139,1140,5,
	5,0,0,1140,1142,3,240,120,0,1141,1139,1,0,0,0,1142,1145,1,0,0,0,1143,1141,
	1,0,0,0,1143,1144,1,0,0,0,1144,1146,1,0,0,0,1145,1143,1,0,0,0,1146,1147,
	5,2,0,0,1147,1165,1,0,0,0,1148,1149,5,86,0,0,1149,1150,5,49,0,0,1150,1155,
	3,240,120,0,1151,1152,5,5,0,0,1152,1154,3,240,120,0,1153,1151,1,0,0,0,1154,
	1157,1,0,0,0,1155,1153,1,0,0,0,1155,1156,1,0,0,0,1156,1159,1,0,0,0,1157,
	1155,1,0,0,0,1158,1160,5,5,0,0,1159,1158,1,0,0,0,1159,1160,1,0,0,0,1160,
	1161,1,0,0,0,1161,1162,5,50,0,0,1162,1163,5,2,0,0,1163,1165,1,0,0,0,1164,
	1135,1,0,0,0,1164,1137,1,0,0,0,1164,1148,1,0,0,0,1165,119,1,0,0,0,1166,
	1167,5,31,0,0,1167,1168,5,49,0,0,1168,1169,3,240,120,0,1169,1170,5,50,0,
	0,1170,1171,5,2,0,0,1171,121,1,0,0,0,1172,1173,5,87,0,0,1173,1176,5,180,
	0,0,1174,1175,5,12,0,0,1175,1177,5,180,0,0,1176,1174,1,0,0,0,1176,1177,
	1,0,0,0,1177,1178,1,0,0,0,1178,1179,5,49,0,0,1179,1191,5,4,0,0,1180,1185,
	3,228,114,0,1181,1182,5,5,0,0,1182,1184,3,228,114,0,1183,1181,1,0,0,0,1184,
	1187,1,0,0,0,1185,1183,1,0,0,0,1185,1186,1,0,0,0,1186,1189,1,0,0,0,1187,
	1185,1,0,0,0,1188,1190,5,5,0,0,1189,1188,1,0,0,0,1189,1190,1,0,0,0,1190,
	1192,1,0,0,0,1191,1180,1,0,0,0,1191,1192,1,0,0,0,1192,1193,1,0,0,0,1193,
	1194,5,6,0,0,1194,1195,5,50,0,0,1195,1206,5,2,0,0,1196,1197,5,87,0,0,1197,
	1200,5,180,0,0,1198,1199,5,12,0,0,1199,1201,5,180,0,0,1200,1198,1,0,0,0,
	1200,1201,1,0,0,0,1201,1202,1,0,0,0,1202,1203,3,230,115,0,1203,1204,5,2,
	0,0,1204,1206,1,0,0,0,1205,1172,1,0,0,0,1205,1196,1,0,0,0,1206,123,1,0,
	0,0,1207,1208,5,66,0,0,1208,1209,3,240,120,0,1209,1210,5,67,0,0,1210,1213,
	1,0,0,0,1211,1213,3,126,63,0,1212,1207,1,0,0,0,1212,1211,1,0,0,0,1213,125,
	1,0,0,0,1214,1215,5,12,0,0,1215,1218,5,180,0,0,1216,1218,5,163,0,0,1217,
	1214,1,0,0,0,1217,1216,1,0,0,0,1218,127,1,0,0,0,1219,1223,3,252,126,0,1220,
	1222,3,244,122,0,1221,1220,1,0,0,0,1222,1225,1,0,0,0,1223,1221,1,0,0,0,
	1223,1224,1,0,0,0,1224,1226,1,0,0,0,1225,1223,1,0,0,0,1226,1229,3,14,7,
	0,1227,1228,5,40,0,0,1228,1230,3,240,120,0,1229,1227,1,0,0,0,1229,1230,
	1,0,0,0,1230,1231,1,0,0,0,1231,1232,5,2,0,0,1232,1248,1,0,0,0,1233,1237,
	3,84,42,0,1234,1236,3,244,122,0,1235,1234,1,0,0,0,1236,1239,1,0,0,0,1237,
	1235,1,0,0,0,1237,1238,1,0,0,0,1238,1240,1,0,0,0,1239,1237,1,0,0,0,1240,
	1243,3,14,7,0,1241,1242,5,40,0,0,1242,1244,3,240,120,0,1243,1241,1,0,0,
	0,1243,1244,1,0,0,0,1244,1245,1,0,0,0,1245,1246,5,2,0,0,1246,1248,1,0,0,
	0,1247,1219,1,0,0,0,1247,1233,1,0,0,0,1248,129,1,0,0,0,1249,1250,3,252,
	126,0,1250,1255,5,180,0,0,1251,1252,5,5,0,0,1252,1253,3,252,126,0,1253,
	1254,5,180,0,0,1254,1256,1,0,0,0,1255,1251,1,0,0,0,1256,1257,1,0,0,0,1257,
	1255,1,0,0,0,1257,1258,1,0,0,0,1258,1259,1,0,0,0,1259,1260,5,40,0,0,1260,
	1261,3,240,120,0,1261,1262,5,2,0,0,1262,1298,1,0,0,0,1263,1264,5,49,0,0,
	1264,1267,3,132,66,0,1265,1266,5,5,0,0,1266,1268,3,132,66,0,1267,1265,1,
	0,0,0,1268,1269,1,0,0,0,1269,1267,1,0,0,0,1269,1270,1,0,0,0,1270,1271,1,
	0,0,0,1271,1272,5,50,0,0,1272,1273,5,40,0,0,1273,1274,5,49,0,0,1274,1277,
	3,240,120,0,1275,1276,5,5,0,0,1276,1278,3,240,120,0,1277,1275,1,0,0,0,1278,
	1279,1,0,0,0,1279,1277,1,0,0,0,1279,1280,1,0,0,0,1280,1281,1,0,0,0,1281,
	1282,5,50,0,0,1282,1283,5,2,0,0,1283,1298,1,0,0,0,1284,1285,5,49,0,0,1285,
	1288,3,132,66,0,1286,1287,5,5,0,0,1287,1289,3,132,66,0,1288,1286,1,0,0,
	0,1289,1290,1,0,0,0,1290,1288,1,0,0,0,1290,1291,1,0,0,0,1291,1292,1,0,0,
	0,1292,1293,5,50,0,0,1293,1294,5,40,0,0,1294,1295,3,240,120,0,1295,1296,
	5,2,0,0,1296,1298,1,0,0,0,1297,1249,1,0,0,0,1297,1263,1,0,0,0,1297,1284,
	1,0,0,0,1298,131,1,0,0,0,1299,1303,3,252,126,0,1300,1302,3,244,122,0,1301,
	1300,1,0,0,0,1302,1305,1,0,0,0,1303,1301,1,0,0,0,1303,1304,1,0,0,0,1304,
	1306,1,0,0,0,1305,1303,1,0,0,0,1306,1307,3,14,7,0,1307,1311,1,0,0,0,1308,
	1311,3,14,7,0,1309,1311,1,0,0,0,1310,1299,1,0,0,0,1310,1308,1,0,0,0,1310,
	1309,1,0,0,0,1311,133,1,0,0,0,1312,1313,3,240,120,0,1313,135,1,0,0,0,1314,
	1315,5,88,0,0,1315,1316,5,180,0,0,1316,1376,5,2,0,0,1317,1318,5,88,0,0,
	1318,1319,5,89,0,0,1319,1320,5,12,0,0,1320,1321,5,180,0,0,1321,1376,5,2,
	0,0,1322,1323,5,88,0,0,1323,1324,5,89,0,0,1324,1325,5,12,0,0,1325,1330,
	5,180,0,0,1326,1327,5,66,0,0,1327,1328,3,240,120,0,1328,1329,5,67,0,0,1329,
	1331,1,0,0,0,1330,1326,1,0,0,0,1331,1332,1,0,0,0,1332,1330,1,0,0,0,1332,
	1333,1,0,0,0,1333,1334,1,0,0,0,1334,1335,5,2,0,0,1335,1376,1,0,0,0,1336,
	1337,5,88,0,0,1337,1342,5,180,0,0,1338,1339,5,66,0,0,1339,1340,3,240,120,
	0,1340,1341,5,67,0,0,1341,1343,1,0,0,0,1342,1338,1,0,0,0,1343,1344,1,0,
	0,0,1344,1342,1,0,0,0,1344,1345,1,0,0,0,1345,1346,1,0,0,0,1346,1347,5,2,
	0,0,1347,1376,1,0,0,0,1348,1349,5,88,0,0,1349,1352,5,180,0,0,1350,1351,
	5,12,0,0,1351,1353,5,180,0,0,1352,1350,1,0,0,0,1353,1354,1,0,0,0,1354,1352,
	1,0,0,0,1354,1355,1,0,0,0,1355,1360,1,0,0,0,1356,1357,5,66,0,0,1357,1358,
	3,240,120,0,1358,1359,5,67,0,0,1359,1361,1,0,0,0,1360,1356,1,0,0,0,1361,
	1362,1,0,0,0,1362,1360,1,0,0,0,1362,1363,1,0,0,0,1363,1364,1,0,0,0,1364,
	1365,5,2,0,0,1365,1376,1,0,0,0,1366,1367,5,88,0,0,1367,1370,5,180,0,0,1368,
	1369,5,12,0,0,1369,1371,5,180,0,0,1370,1368,1,0,0,0,1371,1372,1,0,0,0,1372,
	1370,1,0,0,0,1372,1373,1,0,0,0,1373,1374,1,0,0,0,1374,1376,5,2,0,0,1375,
	1314,1,0,0,0,1375,1317,1,0,0,0,1375,1322,1,0,0,0,1375,1336,1,0,0,0,1375,
	1348,1,0,0,0,1375,1366,1,0,0,0,1376,137,1,0,0,0,1377,1378,5,90,0,0,1378,
	1379,5,49,0,0,1379,1380,5,154,0,0,1380,1381,5,23,0,0,1381,1384,3,240,120,
	0,1382,1383,5,5,0,0,1383,1385,3,216,108,0,1384,1382,1,0,0,0,1384,1385,1,
	0,0,0,1385,1386,1,0,0,0,1386,1387,5,50,0,0,1387,1388,5,2,0,0,1388,139,1,
	0,0,0,1389,1390,5,90,0,0,1390,1391,5,49,0,0,1391,1394,3,240,120,0,1392,
	1393,5,5,0,0,1393,1395,3,216,108,0,1394,1392,1,0,0,0,1394,1395,1,0,0,0,
	1395,1396,1,0,0,0,1396,1397,5,50,0,0,1397,1398,5,2,0,0,1398,141,1,0,0,0,
	1399,1400,5,91,0,0,1400,1401,5,49,0,0,1401,1402,3,240,120,0,1402,1403,5,
	50,0,0,1403,1406,3,110,55,0,1404,1405,5,92,0,0,1405,1407,3,110,55,0,1406,
	1404,1,0,0,0,1406,1407,1,0,0,0,1407,143,1,0,0,0,1408,1415,3,160,80,0,1409,
	1415,3,162,81,0,1410,1415,3,152,76,0,1411,1415,3,146,73,0,1412,1415,3,148,
	74,0,1413,1415,3,150,75,0,1414,1408,1,0,0,0,1414,1409,1,0,0,0,1414,1410,
	1,0,0,0,1414,1411,1,0,0,0,1414,1412,1,0,0,0,1414,1413,1,0,0,0,1415,145,
	1,0,0,0,1416,1417,5,9,0,0,1417,1418,5,49,0,0,1418,1419,3,252,126,0,1419,
	1420,5,180,0,0,1420,1421,5,5,0,0,1421,1422,3,252,126,0,1422,1423,5,180,
	0,0,1423,1424,5,93,0,0,1424,1425,5,89,0,0,1425,1426,5,12,0,0,1426,1427,
	5,180,0,0,1427,1428,5,12,0,0,1428,1429,5,34,0,0,1429,1430,5,50,0,0,1430,
	1431,3,110,55,0,1431,147,1,0,0,0,1432,1433,5,9,0,0,1433,1434,5,49,0,0,1434,
	1435,3,252,126,0,1435,1436,5,180,0,0,1436,1437,5,94,0,0,1437,1438,5,89,
	0,0,1438,1439,5,12,0,0,1439,1440,5,180,0,0,1440,1441,5,50,0,0,1441,1442,
	3,110,55,0,1442,149,1,0,0,0,1443,1444,5,9,0,0,1444,1445,5,49,0,0,1445,1446,
	3,252,126,0,1446,1447,5,180,0,0,1447,1448,5,93,0,0,1448,1449,5,89,0,0,1449,
	1450,5,12,0,0,1450,1451,5,180,0,0,1451,1452,5,50,0,0,1452,1453,3,110,55,
	0,1453,151,1,0,0,0,1454,1455,5,9,0,0,1455,1456,5,49,0,0,1456,1457,3,154,
	77,0,1457,1459,3,156,78,0,1458,1460,3,158,79,0,1459,1458,1,0,0,0,1459,1460,
	1,0,0,0,1460,1461,1,0,0,0,1461,1462,5,50,0,0,1462,1463,3,110,55,0,1463,
	153,1,0,0,0,1464,1468,3,252,126,0,1465,1467,3,244,122,0,1466,1465,1,0,0,
	0,1467,1470,1,0,0,0,1468,1466,1,0,0,0,1468,1469,1,0,0,0,1469,1471,1,0,0,
	0,1470,1468,1,0,0,0,1471,1474,5,180,0,0,1472,1473,5,40,0,0,1473,1475,3,
	240,120,0,1474,1472,1,0,0,0,1474,1475,1,0,0,0,1475,1476,1,0,0,0,1476,1477,
	5,2,0,0,1477,1485,1,0,0,0,1478,1479,5,180,0,0,1479,1480,7,10,0,0,1480,1481,
	3,240,120,0,1481,1482,5,2,0,0,1482,1485,1,0,0,0,1483,1485,5,2,0,0,1484,
	1464,1,0,0,0,1484,1478,1,0,0,0,1484,1483,1,0,0,0,1485,155,1,0,0,0,1486,
	1487,3,240,120,0,1487,1488,5,2,0,0,1488,157,1,0,0,0,1489,1490,5,180,0,0,
	1490,1491,7,10,0,0,1491,1497,3,240,120,0,1492,1493,5,180,0,0,1493,1497,
	7,11,0,0,1494,1495,7,11,0,0,1495,1497,5,180,0,0,1496,1489,1,0,0,0,1496,
	1492,1,0,0,0,1496,1494,1,0,0,0,1497,159,1,0,0,0,1498,1499,5,95,0,0,1499,
	1500,3,110,55,0,1500,1501,5,96,0,0,1501,1502,5,49,0,0,1502,1503,3,240,120,
	0,1503,1504,5,50,0,0,1504,1505,5,2,0,0,1505,161,1,0,0,0,1506,1507,5,96,
	0,0,1507,1508,5,49,0,0,1508,1509,3,240,120,0,1509,1510,5,50,0,0,1510,1511,
	3,110,55,0,1511,163,1,0,0,0,1512,1513,5,97,0,0,1513,1514,3,224,112,0,1514,
	1515,5,2,0,0,1515,165,1,0,0,0,1516,1517,5,98,0,0,1517,1518,3,168,84,0,1518,
	167,1,0,0,0,1519,1523,5,4,0,0,1520,1522,3,170,85,0,1521,1520,1,0,0,0,1522,
	1525,1,0,0,0,1523,1521,1,0,0,0,1523,1524,1,0,0,0,1524,1526,1,0,0,0,1525,
	1523,1,0,0,0,1526,1527,5,6,0,0,1527,169,1,0,0,0,1528,1542,3,168,84,0,1529,
	1542,3,172,86,0,1530,1542,3,174,87,0,1531,1542,3,176,88,0,1532,1542,3,178,
	89,0,1533,1542,3,184,92,0,1534,1542,3,186,93,0,1535,1542,5,99,0,0,1536,
	1542,5,100,0,0,1537,1542,5,101,0,0,1538,1542,3,190,95,0,1539,1542,3,194,
	97,0,1540,1542,3,196,98,0,1541,1528,1,0,0,0,1541,1529,1,0,0,0,1541,1530,
	1,0,0,0,1541,1531,1,0,0,0,1541,1532,1,0,0,0,1541,1533,1,0,0,0,1541,1534,
	1,0,0,0,1541,1535,1,0,0,0,1541,1536,1,0,0,0,1541,1537,1,0,0,0,1541,1538,
	1,0,0,0,1541,1539,1,0,0,0,1541,1540,1,0,0,0,1542,171,1,0,0,0,1543,1544,
	5,102,0,0,1544,1549,3,14,7,0,1545,1546,5,5,0,0,1546,1548,3,14,7,0,1547,
	1545,1,0,0,0,1548,1551,1,0,0,0,1549,1547,1,0,0,0,1549,1550,1,0,0,0,1550,
	1554,1,0,0,0,1551,1549,1,0,0,0,1552,1553,5,103,0,0,1553,1555,3,188,94,0,
	1554,1552,1,0,0,0,1554,1555,1,0,0,0,1555,173,1,0,0,0,1556,1561,3,194,97,
	0,1557,1558,5,5,0,0,1558,1560,3,194,97,0,1559,1557,1,0,0,0,1560,1563,1,
	0,0,0,1561,1559,1,0,0,0,1561,1562,1,0,0,0,1562,1564,1,0,0,0,1563,1561,1,
	0,0,0,1564,1565,5,103,0,0,1565,1566,3,188,94,0,1566,175,1,0,0,0,1567,1568,
	5,91,0,0,1568,1569,3,188,94,0,1569,1570,3,168,84,0,1570,177,1,0,0,0,1571,
	1572,5,104,0,0,1572,1582,3,188,94,0,1573,1575,3,180,90,0,1574,1573,1,0,
	0,0,1575,1576,1,0,0,0,1576,1574,1,0,0,0,1576,1577,1,0,0,0,1577,1579,1,0,
	0,0,1578,1580,3,182,91,0,1579,1578,1,0,0,0,1579,1580,1,0,0,0,1580,1583,
	1,0,0,0,1581,1583,3,182,91,0,1582,1574,1,0,0,0,1582,1581,1,0,0,0,1583,179,
	1,0,0,0,1584,1585,5,105,0,0,1585,1586,3,196,98,0,1586,1587,3,168,84,0,1587,
	181,1,0,0,0,1588,1589,5,106,0,0,1589,1590,3,168,84,0,1590,183,1,0,0,0,1591,
	1592,5,9,0,0,1592,1593,3,168,84,0,1593,1594,3,188,94,0,1594,1595,3,168,
	84,0,1595,1596,3,168,84,0,1596,185,1,0,0,0,1597,1598,5,7,0,0,1598,1599,
	5,180,0,0,1599,1608,5,49,0,0,1600,1605,5,180,0,0,1601,1602,5,5,0,0,1602,
	1604,5,180,0,0,1603,1601,1,0,0,0,1604,1607,1,0,0,0,1605,1603,1,0,0,0,1605,
	1606,1,0,0,0,1606,1609,1,0,0,0,1607,1605,1,0,0,0,1608,1600,1,0,0,0,1608,
	1609,1,0,0,0,1609,1610,1,0,0,0,1610,1620,5,50,0,0,1611,1612,5,107,0,0,1612,
	1617,5,180,0,0,1613,1614,5,5,0,0,1614,1616,5,180,0,0,1615,1613,1,0,0,0,
	1616,1619,1,0,0,0,1617,1615,1,0,0,0,1617,1618,1,0,0,0,1618,1621,1,0,0,0,
	1619,1617,1,0,0,0,1620,1611,1,0,0,0,1620,1621,1,0,0,0,1621,1622,1,0,0,0,
	1622,1623,3,168,84,0,1623,187,1,0,0,0,1624,1628,3,190,95,0,1625,1628,3,
	194,97,0,1626,1628,3,196,98,0,1627,1624,1,0,0,0,1627,1625,1,0,0,0,1627,
	1626,1,0,0,0,1628,189,1,0,0,0,1629,1630,3,192,96,0,1630,1639,5,49,0,0,1631,
	1636,3,188,94,0,1632,1633,5,5,0,0,1633,1635,3,188,94,0,1634,1632,1,0,0,
	0,1635,1638,1,0,0,0,1636,1634,1,0,0,0,1636,1637,1,0,0,0,1637,1640,1,0,0,
	0,1638,1636,1,0,0,0,1639,1631,1,0,0,0,1639,1640,1,0,0,0,1640,1641,1,0,0,
	0,1641,1642,5,50,0,0,1642,191,1,0,0,0,1643,1644,7,12,0,0,1644,193,1,0,0,
	0,1645,1651,3,14,7,0,1646,1647,5,12,0,0,1647,1650,3,14,7,0,1648,1650,5,
	164,0,0,1649,1646,1,0,0,0,1649,1648,1,0,0,0,1650,1653,1,0,0,0,1651,1649,
	1,0,0,0,1651,1652,1,0,0,0,1652,195,1,0,0,0,1653,1651,1,0,0,0,1654,1655,
	7,13,0,0,1655,197,1,0,0,0,1656,1657,5,109,0,0,1657,1661,5,4,0,0,1658,1660,
	3,112,56,0,1659,1658,1,0,0,0,1660,1663,1,0,0,0,1661,1659,1,0,0,0,1661,1662,
	1,0,0,0,1662,1664,1,0,0,0,1663,1661,1,0,0,0,1664,1665,5,6,0,0,1665,199,
	1,0,0,0,1666,1667,5,104,0,0,1667,1668,5,49,0,0,1668,1669,3,240,120,0,1669,
	1670,5,50,0,0,1670,1674,5,4,0,0,1671,1673,3,202,101,0,1672,1671,1,0,0,0,
	1673,1676,1,0,0,0,1674,1672,1,0,0,0,1674,1675,1,0,0,0,1675,1678,1,0,0,0,
	1676,1674,1,0,0,0,1677,1679,3,204,102,0,1678,1677,1,0,0,0,1678,1679,1,0,
	0,0,1679,1680,1,0,0,0,1680,1681,5,6,0,0,1681,201,1,0,0,0,1682,1683,5,105,
	0,0,1683,1684,3,240,120,0,1684,1688,5,110,0,0,1685,1687,3,112,56,0,1686,
	1685,1,0,0,0,1687,1690,1,0,0,0,1688,1686,1,0,0,0,1688,1689,1,0,0,0,1689,
	203,1,0,0,0,1690,1688,1,0,0,0,1691,1692,5,106,0,0,1692,1696,5,110,0,0,1693,
	1695,3,112,56,0,1694,1693,1,0,0,0,1695,1698,1,0,0,0,1696,1694,1,0,0,0,1696,
	1697,1,0,0,0,1697,205,1,0,0,0,1698,1696,1,0,0,0,1699,1700,5,111,0,0,1700,
	1702,3,240,120,0,1701,1703,3,208,104,0,1702,1701,1,0,0,0,1702,1703,1,0,
	0,0,1703,1704,1,0,0,0,1704,1706,3,110,55,0,1705,1707,3,210,105,0,1706,1705,
	1,0,0,0,1707,1708,1,0,0,0,1708,1706,1,0,0,0,1708,1709,1,0,0,0,1709,207,
	1,0,0,0,1710,1711,5,73,0,0,1711,1723,5,49,0,0,1712,1717,3,108,54,0,1713,
	1714,5,5,0,0,1714,1716,3,108,54,0,1715,1713,1,0,0,0,1716,1719,1,0,0,0,1717,
	1715,1,0,0,0,1717,1718,1,0,0,0,1718,1721,1,0,0,0,1719,1717,1,0,0,0,1720,
	1722,5,5,0,0,1721,1720,1,0,0,0,1721,1722,1,0,0,0,1722,1724,1,0,0,0,1723,
	1712,1,0,0,0,1723,1724,1,0,0,0,1724,1725,1,0,0,0,1725,1726,5,50,0,0,1726,
	209,1,0,0,0,1727,1729,5,112,0,0,1728,1730,5,180,0,0,1729,1728,1,0,0,0,1729,
	1730,1,0,0,0,1730,1746,1,0,0,0,1731,1743,5,49,0,0,1732,1737,3,108,54,0,
	1733,1734,5,5,0,0,1734,1736,3,108,54,0,1735,1733,1,0,0,0,1736,1739,1,0,
	0,0,1737,1735,1,0,0,0,1737,1738,1,0,0,0,1738,1741,1,0,0,0,1739,1737,1,0,
	0,0,1740,1742,5,5,0,0,1741,1740,1,0,0,0,1741,1742,1,0,0,0,1742,1744,1,0,
	0,0,1743,1732,1,0,0,0,1743,1744,1,0,0,0,1744,1745,1,0,0,0,1745,1747,5,50,
	0,0,1746,1731,1,0,0,0,1746,1747,1,0,0,0,1747,1748,1,0,0,0,1748,1749,3,110,
	55,0,1749,211,1,0,0,0,1750,1751,5,99,0,0,1751,1752,5,2,0,0,1752,213,1,0,
	0,0,1753,1754,5,100,0,0,1754,1755,5,2,0,0,1755,215,1,0,0,0,1756,1760,5,
	151,0,0,1757,1758,5,180,0,0,1758,1760,3,230,115,0,1759,1756,1,0,0,0,1759,
	1757,1,0,0,0,1760,217,1,0,0,0,1761,1762,5,36,0,0,1762,1765,5,180,0,0,1763,
	1764,5,12,0,0,1764,1766,5,180,0,0,1765,1763,1,0,0,0,1765,1766,1,0,0,0,1766,
	1767,1,0,0,0,1767,1768,5,49,0,0,1768,1780,5,4,0,0,1769,1774,3,228,114,0,
	1770,1771,5,5,0,0,1771,1773,3,228,114,0,1772,1770,1,0,0,0,1773,1776,1,0,
	0,0,1774,1772,1,0,0,0,1774,1775,1,0,0,0,1775,1778,1,0,0,0,1776,1774,1,0,
	0,0,1777,1779,5,5,0,0,1778,1777,1,0,0,0,1778,1779,1,0,0,0,1779,1781,1,0,
	0,0,1780,1769,1,0,0,0,1780,1781,1,0,0,0,1781,1782,1,0,0,0,1782,1783,5,6,
	0,0,1783,1784,5,50,0,0,1784,1804,5,2,0,0,1785,1786,5,36,0,0,1786,1789,5,
	180,0,0,1787,1788,5,12,0,0,1788,1790,5,180,0,0,1789,1787,1,0,0,0,1789,1790,
	1,0,0,0,1790,1791,1,0,0,0,1791,1792,3,230,115,0,1792,1793,5,2,0,0,1793,
	1804,1,0,0,0,1794,1795,5,36,0,0,1795,1796,5,49,0,0,1796,1797,5,151,0,0,
	1797,1798,5,50,0,0,1798,1804,5,2,0,0,1799,1800,5,36,0,0,1800,1801,5,49,
	0,0,1801,1802,5,50,0,0,1802,1804,5,2,0,0,1803,1761,1,0,0,0,1803,1785,1,
	0,0,0,1803,1794,1,0,0,0,1803,1799,1,0,0,0,1804,219,1,0,0,0,1805,1806,5,
	113,0,0,1806,1807,5,49,0,0,1807,1808,3,240,120,0,1808,1809,5,50,0,0,1809,
	1810,5,2,0,0,1810,221,1,0,0,0,1811,1814,5,180,0,0,1812,1814,3,246,123,0,
	1813,1811,1,0,0,0,1813,1812,1,0,0,0,1814,223,1,0,0,0,1815,1827,5,49,0,0,
	1816,1821,3,222,111,0,1817,1818,5,5,0,0,1818,1820,3,222,111,0,1819,1817,
	1,0,0,0,1820,1823,1,0,0,0,1821,1819,1,0,0,0,1821,1822,1,0,0,0,1822,1825,
	1,0,0,0,1823,1821,1,0,0,0,1824,1826,5,5,0,0,1825,1824,1,0,0,0,1825,1826,
	1,0,0,0,1826,1828,1,0,0,0,1827,1816,1,0,0,0,1827,1828,1,0,0,0,1828,1829,
	1,0,0,0,1829,1830,5,50,0,0,1830,225,1,0,0,0,1831,1832,5,180,0,0,1832,1856,
	3,230,115,0,1833,1834,5,180,0,0,1834,1835,5,12,0,0,1835,1836,5,180,0,0,
	1836,1856,3,230,115,0,1837,1838,5,180,0,0,1838,1839,5,49,0,0,1839,1851,
	5,4,0,0,1840,1845,3,228,114,0,1841,1842,5,5,0,0,1842,1844,3,228,114,0,1843,
	1841,1,0,0,0,1844,1847,1,0,0,0,1845,1843,1,0,0,0,1845,1846,1,0,0,0,1846,
	1849,1,0,0,0,1847,1845,1,0,0,0,1848,1850,5,5,0,0,1849,1848,1,0,0,0,1849,
	1850,1,0,0,0,1850,1852,1,0,0,0,1851,1840,1,0,0,0,1851,1852,1,0,0,0,1852,
	1853,1,0,0,0,1853,1854,5,6,0,0,1854,1856,5,50,0,0,1855,1831,1,0,0,0,1855,
	1833,1,0,0,0,1855,1837,1,0,0,0,1856,227,1,0,0,0,1857,1858,5,180,0,0,1858,
	1859,5,110,0,0,1859,1860,3,240,120,0,1860,229,1,0,0,0,1861,1873,5,49,0,
	0,1862,1867,3,240,120,0,1863,1864,5,5,0,0,1864,1866,3,240,120,0,1865,1863,
	1,0,0,0,1866,1869,1,0,0,0,1867,1865,1,0,0,0,1867,1868,1,0,0,0,1868,1871,
	1,0,0,0,1869,1867,1,0,0,0,1870,1872,5,5,0,0,1871,1870,1,0,0,0,1871,1872,
	1,0,0,0,1872,1874,1,0,0,0,1873,1862,1,0,0,0,1873,1874,1,0,0,0,1874,1875,
	1,0,0,0,1875,1876,5,50,0,0,1876,231,1,0,0,0,1877,1878,5,4,0,0,1878,1883,
	3,234,117,0,1879,1880,5,5,0,0,1880,1882,3,234,117,0,1881,1879,1,0,0,0,1882,
	1885,1,0,0,0,1883,1881,1,0,0,0,1883,1884,1,0,0,0,1884,1887,1,0,0,0,1885,
	1883,1,0,0,0,1886,1888,5,5,0,0,1887,1886,1,0,0,0,1887,1888,1,0,0,0,1888,
	1889,1,0,0,0,1889,1890,5,6,0,0,1890,233,1,0,0,0,1891,1892,5,180,0,0,1892,
	1893,5,110,0,0,1893,1894,3,240,120,0,1894,235,1,0,0,0,1895,1896,5,49,0,
	0,1896,1901,3,238,119,0,1897,1898,5,5,0,0,1898,1900,3,238,119,0,1899,1897,
	1,0,0,0,1900,1903,1,0,0,0,1901,1899,1,0,0,0,1901,1902,1,0,0,0,1902,1905,
	1,0,0,0,1903,1901,1,0,0,0,1904,1906,5,5,0,0,1905,1904,1,0,0,0,1905,1906,
	1,0,0,0,1906,1907,1,0,0,0,1907,1908,5,50,0,0,1908,237,1,0,0,0,1909,1912,
	3,252,126,0,1910,1912,3,84,42,0,1911,1909,1,0,0,0,1911,1910,1,0,0,0,1912,
	239,1,0,0,0,1913,1914,6,120,-1,0,1914,1915,5,49,0,0,1915,1916,5,180,0,0,
	1916,1917,7,10,0,0,1917,1918,3,240,120,0,1918,1919,5,50,0,0,1919,2076,1,
	0,0,0,1920,1921,5,49,0,0,1921,1922,5,114,0,0,1922,1923,5,180,0,0,1923,1924,
	5,50,0,0,1924,1925,3,232,116,0,1925,1926,3,230,115,0,1926,2076,1,0,0,0,
	1927,1928,5,49,0,0,1928,1929,3,240,120,0,1929,1930,5,50,0,0,1930,2076,1,
	0,0,0,1931,1932,5,49,0,0,1932,1935,3,240,120,0,1933,1934,5,5,0,0,1934,1936,
	3,240,120,0,1935,1933,1,0,0,0,1936,1937,1,0,0,0,1937,1935,1,0,0,0,1937,
	1938,1,0,0,0,1938,1939,1,0,0,0,1939,1940,5,50,0,0,1940,2076,1,0,0,0,1941,
	1942,3,254,127,0,1942,1943,5,49,0,0,1943,1945,3,240,120,0,1944,1946,5,5,
	0,0,1945,1944,1,0,0,0,1945,1946,1,0,0,0,1946,1947,1,0,0,0,1947,1948,5,50,
	0,0,1948,2076,1,0,0,0,1949,2076,3,226,113,0,1950,1951,5,114,0,0,1951,1953,
	5,180,0,0,1952,1954,3,232,116,0,1953,1952,1,0,0,0,1953,1954,1,0,0,0,1954,
	1955,1,0,0,0,1955,2076,3,230,115,0,1956,1957,5,114,0,0,1957,1960,3,252,
	126,0,1958,1959,5,66,0,0,1959,1961,5,67,0,0,1960,1958,1,0,0,0,1961,1962,
	1,0,0,0,1962,1960,1,0,0,0,1962,1963,1,0,0,0,1963,1964,1,0,0,0,1964,1965,
	5,49,0,0,1965,1966,3,240,120,0,1966,1967,5,50,0,0,1967,2076,1,0,0,0,1968,
	1969,5,114,0,0,1969,1970,5,148,0,0,1970,1971,5,49,0,0,1971,1972,3,240,120,
	0,1972,1973,5,50,0,0,1973,2076,1,0,0,0,1974,1975,5,55,0,0,1975,1976,5,49,
	0,0,1976,1977,3,252,126,0,1977,1978,5,50,0,0,1978,1979,5,12,0,0,1979,1980,
	5,180,0,0,1980,2076,1,0,0,0,1981,1982,5,115,0,0,1982,2076,3,230,115,0,1983,
	1984,5,116,0,0,1984,2076,3,230,115,0,1985,1986,5,117,0,0,1986,2076,3,230,
	115,0,1987,1988,5,118,0,0,1988,2076,3,230,115,0,1989,1990,5,119,0,0,1990,
	1991,5,49,0,0,1991,1992,5,180,0,0,1992,1993,5,12,0,0,1993,1994,5,180,0,
	0,1994,1995,5,5,0,0,1995,1996,3,230,115,0,1996,1997,5,50,0,0,1997,2076,
	1,0,0,0,1998,1999,5,120,0,0,1999,2076,3,230,115,0,2000,2001,5,121,0,0,2001,
	2076,3,230,115,0,2002,2003,5,122,0,0,2003,2004,5,49,0,0,2004,2005,3,240,
	120,0,2005,2006,5,5,0,0,2006,2007,3,236,118,0,2007,2008,5,50,0,0,2008,2076,
	1,0,0,0,2009,2010,5,123,0,0,2010,2011,5,49,0,0,2011,2012,3,240,120,0,2012,
	2013,5,5,0,0,2013,2014,3,236,118,0,2014,2015,5,5,0,0,2015,2016,5,145,0,
	0,2016,2017,5,50,0,0,2017,2076,1,0,0,0,2018,2019,5,124,0,0,2019,2020,5,
	66,0,0,2020,2021,3,240,120,0,2021,2022,5,67,0,0,2022,2023,7,14,0,0,2023,
	2076,1,0,0,0,2024,2025,5,125,0,0,2025,2026,5,66,0,0,2026,2027,3,240,120,
	0,2027,2028,5,67,0,0,2028,2029,7,15,0,0,2029,2076,1,0,0,0,2030,2031,7,16,
	0,0,2031,2076,3,240,120,21,2032,2044,5,66,0,0,2033,2038,3,240,120,0,2034,
	2035,5,5,0,0,2035,2037,3,240,120,0,2036,2034,1,0,0,0,2037,2040,1,0,0,0,
	2038,2036,1,0,0,0,2038,2039,1,0,0,0,2039,2042,1,0,0,0,2040,2038,1,0,0,0,
	2041,2043,5,5,0,0,2042,2041,1,0,0,0,2042,2043,1,0,0,0,2043,2045,1,0,0,0,
	2044,2033,1,0,0,0,2044,2045,1,0,0,0,2045,2046,1,0,0,0,2046,2076,5,67,0,
	0,2047,2048,5,89,0,0,2048,2049,5,12,0,0,2049,2050,5,180,0,0,2050,2051,5,
	12,0,0,2051,2052,5,180,0,0,2052,2053,5,66,0,0,2053,2054,3,240,120,0,2054,
	2055,5,67,0,0,2055,2056,3,242,121,0,2056,2076,1,0,0,0,2057,2058,5,89,0,
	0,2058,2059,5,12,0,0,2059,2064,5,180,0,0,2060,2061,5,66,0,0,2061,2062,3,
	240,120,0,2062,2063,5,67,0,0,2063,2065,1,0,0,0,2064,2060,1,0,0,0,2065,2066,
	1,0,0,0,2066,2064,1,0,0,0,2066,2067,1,0,0,0,2067,2076,1,0,0,0,2068,2069,
	5,89,0,0,2069,2070,5,12,0,0,2070,2076,5,180,0,0,2071,2076,5,89,0,0,2072,
	2076,5,160,0,0,2073,2076,3,14,7,0,2074,2076,3,246,123,0,2075,1913,1,0,0,
	0,2075,1920,1,0,0,0,2075,1927,1,0,0,0,2075,1931,1,0,0,0,2075,1941,1,0,0,
	0,2075,1949,1,0,0,0,2075,1950,1,0,0,0,2075,1956,1,0,0,0,2075,1968,1,0,0,
	0,2075,1974,1,0,0,0,2075,1981,1,0,0,0,2075,1983,1,0,0,0,2075,1985,1,0,0,
	0,2075,1987,1,0,0,0,2075,1989,1,0,0,0,2075,1998,1,0,0,0,2075,2000,1,0,0,
	0,2075,2002,1,0,0,0,2075,2009,1,0,0,0,2075,2018,1,0,0,0,2075,2024,1,0,0,
	0,2075,2030,1,0,0,0,2075,2032,1,0,0,0,2075,2047,1,0,0,0,2075,2057,1,0,0,
	0,2075,2068,1,0,0,0,2075,2071,1,0,0,0,2075,2072,1,0,0,0,2075,2073,1,0,0,
	0,2075,2074,1,0,0,0,2076,2184,1,0,0,0,2077,2078,10,20,0,0,2078,2079,5,17,
	0,0,2079,2183,3,240,120,20,2080,2081,10,19,0,0,2081,2082,7,17,0,0,2082,
	2183,3,240,120,20,2083,2084,10,18,0,0,2084,2085,7,18,0,0,2085,2183,3,240,
	120,19,2086,2087,10,17,0,0,2087,2088,7,19,0,0,2088,2183,3,240,120,18,2089,
	2090,10,16,0,0,2090,2091,7,20,0,0,2091,2183,3,240,120,17,2092,2093,10,15,
	0,0,2093,2094,7,21,0,0,2094,2183,3,240,120,16,2095,2096,10,14,0,0,2096,
	2097,5,24,0,0,2097,2183,3,240,120,15,2098,2099,10,13,0,0,2099,2100,5,26,
	0,0,2100,2183,3,240,120,14,2101,2102,10,12,0,0,2102,2103,5,25,0,0,2103,
	2183,3,240,120,13,2104,2105,10,11,0,0,2105,2106,5,130,0,0,2106,2183,3,240,
	120,12,2107,2108,10,10,0,0,2108,2109,5,131,0,0,2109,2183,3,240,120,11,2110,
	2111,10,9,0,0,2111,2112,5,132,0,0,2112,2113,3,240,120,0,2113,2114,5,110,
	0,0,2114,2115,3,240,120,9,2115,2183,1,0,0,0,2116,2117,10,33,0,0,2117,2118,
	5,66,0,0,2118,2119,3,240,120,0,2119,2120,5,110,0,0,2120,2121,3,240,120,
	0,2121,2122,5,67,0,0,2122,2183,1,0,0,0,2123,2124,10,32,0,0,2124,2125,5,
	66,0,0,2125,2126,5,145,0,0,2126,2183,5,67,0,0,2127,2128,10,31,0,0,2128,
	2129,5,66,0,0,2129,2130,3,240,120,0,2130,2131,5,67,0,0,2131,2183,1,0,0,
	0,2132,2133,10,28,0,0,2133,2183,7,22,0,0,2134,2135,10,27,0,0,2135,2136,
	5,167,0,0,2136,2137,5,49,0,0,2137,2138,3,240,120,0,2138,2139,5,50,0,0,2139,
	2183,1,0,0,0,2140,2141,10,26,0,0,2141,2142,5,168,0,0,2142,2143,5,49,0,0,
	2143,2144,3,240,120,0,2144,2145,5,5,0,0,2145,2146,3,240,120,0,2146,2147,
	5,50,0,0,2147,2183,1,0,0,0,2148,2149,10,25,0,0,2149,2150,5,12,0,0,2150,
	2152,5,180,0,0,2151,2153,3,232,116,0,2152,2151,1,0,0,0,2152,2153,1,0,0,
	0,2153,2154,1,0,0,0,2154,2155,5,49,0,0,2155,2167,5,4,0,0,2156,2161,3,228,
	114,0,2157,2158,5,5,0,0,2158,2160,3,228,114,0,2159,2157,1,0,0,0,2160,2163,
	1,0,0,0,2161,2159,1,0,0,0,2161,2162,1,0,0,0,2162,2165,1,0,0,0,2163,2161,
	1,0,0,0,2164,2166,5,5,0,0,2165,2164,1,0,0,0,2165,2166,1,0,0,0,2166,2168,
	1,0,0,0,2167,2156,1,0,0,0,2167,2168,1,0,0,0,2168,2169,1,0,0,0,2169,2170,
	5,6,0,0,2170,2183,5,50,0,0,2171,2172,10,24,0,0,2172,2173,5,12,0,0,2173,
	2175,5,180,0,0,2174,2176,3,232,116,0,2175,2174,1,0,0,0,2175,2176,1,0,0,
	0,2176,2177,1,0,0,0,2177,2183,3,230,115,0,2178,2179,10,23,0,0,2179,2183,
	3,242,121,0,2180,2181,10,22,0,0,2181,2183,7,11,0,0,2182,2077,1,0,0,0,2182,
	2080,1,0,0,0,2182,2083,1,0,0,0,2182,2086,1,0,0,0,2182,2089,1,0,0,0,2182,
	2092,1,0,0,0,2182,2095,1,0,0,0,2182,2098,1,0,0,0,2182,2101,1,0,0,0,2182,
	2104,1,0,0,0,2182,2107,1,0,0,0,2182,2110,1,0,0,0,2182,2116,1,0,0,0,2182,
	2123,1,0,0,0,2182,2127,1,0,0,0,2182,2132,1,0,0,0,2182,2134,1,0,0,0,2182,
	2140,1,0,0,0,2182,2148,1,0,0,0,2182,2171,1,0,0,0,2182,2178,1,0,0,0,2182,
	2180,1,0,0,0,2183,2186,1,0,0,0,2184,2182,1,0,0,0,2184,2185,1,0,0,0,2185,
	241,1,0,0,0,2186,2184,1,0,0,0,2187,2188,5,12,0,0,2188,2201,5,180,0,0,2189,
	2201,5,163,0,0,2190,2201,5,172,0,0,2191,2201,5,173,0,0,2192,2201,5,174,
	0,0,2193,2201,5,175,0,0,2194,2201,5,176,0,0,2195,2201,5,177,0,0,2196,2201,
	5,178,0,0,2197,2201,5,179,0,0,2198,2201,5,170,0,0,2199,2201,5,171,0,0,2200,
	2187,1,0,0,0,2200,2189,1,0,0,0,2200,2190,1,0,0,0,2200,2191,1,0,0,0,2200,
	2192,1,0,0,0,2200,2193,1,0,0,0,2200,2194,1,0,0,0,2200,2195,1,0,0,0,2200,
	2196,1,0,0,0,2200,2197,1,0,0,0,2200,2198,1,0,0,0,2200,2199,1,0,0,0,2201,
	243,1,0,0,0,2202,2203,7,23,0,0,2203,245,1,0,0,0,2204,2219,5,141,0,0,2205,
	2219,3,248,124,0,2206,2219,3,250,125,0,2207,2211,5,151,0,0,2208,2210,5,
	151,0,0,2209,2208,1,0,0,0,2210,2213,1,0,0,0,2211,2209,1,0,0,0,2211,2212,
	1,0,0,0,2212,2219,1,0,0,0,2213,2211,1,0,0,0,2214,2219,5,161,0,0,2215,2219,
	5,162,0,0,2216,2219,5,152,0,0,2217,2219,5,153,0,0,2218,2204,1,0,0,0,2218,
	2205,1,0,0,0,2218,2206,1,0,0,0,2218,2207,1,0,0,0,2218,2214,1,0,0,0,2218,
	2215,1,0,0,0,2218,2216,1,0,0,0,2218,2217,1,0,0,0,2219,247,1,0,0,0,2220,
	2222,5,145,0,0,2221,2223,7,24,0,0,2222,2221,1,0,0,0,2222,2223,1,0,0,0,2223,
	249,1,0,0,0,2224,2226,5,144,0,0,2225,2227,7,24,0,0,2226,2225,1,0,0,0,2226,
	2227,1,0,0,0,2227,251,1,0,0,0,2228,2229,5,108,0,0,2229,2279,5,59,0,0,2230,
	2279,5,108,0,0,2231,2279,5,146,0,0,2232,2279,5,147,0,0,2233,2279,5,149,
	0,0,2234,2279,5,148,0,0,2235,2279,5,156,0,0,2236,2279,5,157,0,0,2237,2279,
	5,138,0,0,2238,2279,5,139,0,0,2239,2279,5,158,0,0,2240,2279,5,159,0,0,2241,
	2242,5,7,0,0,2242,2251,5,49,0,0,2243,2248,3,252,126,0,2244,2245,5,5,0,0,
	2245,2247,3,252,126,0,2246,2244,1,0,0,0,2247,2250,1,0,0,0,2248,2246,1,0,
	0,0,2248,2249,1,0,0,0,2249,2252,1,0,0,0,2250,2248,1,0,0,0,2251,2243,1,0,
	0,0,2251,2252,1,0,0,0,2252,2253,1,0,0,0,2253,2257,5,50,0,0,2254,2256,7,
	25,0,0,2255,2254,1,0,0,0,2256,2259,1,0,0,0,2257,2255,1,0,0,0,2257,2258,
	1,0,0,0,2258,2272,1,0,0,0,2259,2257,1,0,0,0,2260,2261,5,73,0,0,2261,2262,
	5,49,0,0,2262,2267,3,252,126,0,2263,2264,5,5,0,0,2264,2266,3,252,126,0,
	2265,2263,1,0,0,0,2266,2269,1,0,0,0,2267,2265,1,0,0,0,2267,2268,1,0,0,0,
	2268,2270,1,0,0,0,2269,2267,1,0,0,0,2270,2271,5,50,0,0,2271,2273,1,0,0,
	0,2272,2260,1,0,0,0,2272,2273,1,0,0,0,2273,2279,1,0,0,0,2274,2275,5,180,
	0,0,2275,2276,5,12,0,0,2276,2279,5,180,0,0,2277,2279,5,180,0,0,2278,2228,
	1,0,0,0,2278,2230,1,0,0,0,2278,2231,1,0,0,0,2278,2232,1,0,0,0,2278,2233,
	1,0,0,0,2278,2234,1,0,0,0,2278,2235,1,0,0,0,2278,2236,1,0,0,0,2278,2237,
	1,0,0,0,2278,2238,1,0,0,0,2278,2239,1,0,0,0,2278,2240,1,0,0,0,2278,2241,
	1,0,0,0,2278,2274,1,0,0,0,2278,2277,1,0,0,0,2279,253,1,0,0,0,2280,2281,
	7,26,0,0,2281,255,1,0,0,0,253,259,265,278,280,300,304,311,316,324,328,334,
	345,348,358,362,369,372,376,381,385,401,405,412,415,418,432,435,446,448,
	463,478,482,498,500,506,511,519,522,539,541,548,555,557,561,573,577,579,
	583,589,592,595,605,609,611,618,626,633,646,650,657,677,683,690,701,707,
	711,717,725,733,740,747,754,761,767,772,774,780,787,789,795,797,803,808,
	814,821,827,833,837,842,850,855,863,873,878,882,894,903,905,911,917,924,
	934,936,940,946,953,969,978,982,988,997,1001,1009,1013,1019,1023,1025,1033,
	1037,1039,1047,1051,1057,1061,1067,1071,1073,1079,1084,1108,1116,1127,1143,
	1155,1159,1164,1176,1185,1189,1191,1200,1205,1212,1217,1223,1229,1237,1243,
	1247,1257,1269,1279,1290,1297,1303,1310,1332,1344,1354,1362,1372,1375,1384,
	1394,1406,1414,1459,1468,1474,1484,1496,1523,1541,1549,1554,1561,1576,1579,
	1582,1605,1608,1617,1620,1627,1636,1639,1649,1651,1661,1674,1678,1688,1696,
	1702,1708,1717,1721,1723,1729,1737,1741,1743,1746,1759,1765,1774,1778,1780,
	1789,1803,1813,1821,1825,1827,1845,1849,1851,1855,1867,1871,1873,1883,1887,
	1901,1905,1911,1937,1945,1953,1962,2038,2042,2044,2066,2075,2152,2161,2165,
	2167,2175,2182,2184,2200,2211,2218,2222,2226,2248,2251,2257,2267,2272,2278];

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
	public arrayType(): ArrayTypeContext {
		return this.getTypedRuleContext(ArrayTypeContext, 0) as ArrayTypeContext;
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
	public arrayType(): ArrayTypeContext {
		return this.getTypedRuleContext(ArrayTypeContext, 0) as ArrayTypeContext;
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
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public VersionLiteral_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.VersionLiteral);
	}
	public VersionLiteral(i: number): TerminalNode {
		return this.getToken(SolidCashParser.VersionLiteral, i);
	}
	public NumberLiteral_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.NumberLiteral);
	}
	public NumberLiteral(i: number): TerminalNode {
		return this.getToken(SolidCashParser.NumberLiteral, i);
	}
	public StringLiteral_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.StringLiteral);
	}
	public StringLiteral(i: number): TerminalNode {
		return this.getToken(SolidCashParser.StringLiteral, i);
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
	public DecimalLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.DecimalLiteral, 0);
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
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public arrayType(): ArrayTypeContext {
		return this.getTypedRuleContext(ArrayTypeContext, 0) as ArrayTypeContext;
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
	public receiveModifier_list(): ReceiveModifierContext[] {
		return this.getTypedRuleContexts(ReceiveModifierContext) as ReceiveModifierContext[];
	}
	public receiveModifier(i: number): ReceiveModifierContext {
		return this.getTypedRuleContext(ReceiveModifierContext, i) as ReceiveModifierContext;
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


export class ReceiveModifierContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public overrideSpecifier(): OverrideSpecifierContext {
		return this.getTypedRuleContext(OverrideSpecifierContext, 0) as OverrideSpecifierContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_receiveModifier;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitReceiveModifier) {
			return visitor.visitReceiveModifier(this);
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
	public overrideSpecifier_list(): OverrideSpecifierContext[] {
		return this.getTypedRuleContexts(OverrideSpecifierContext) as OverrideSpecifierContext[];
	}
	public overrideSpecifier(i: number): OverrideSpecifierContext {
		return this.getTypedRuleContext(OverrideSpecifierContext, i) as OverrideSpecifierContext;
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
	public overrideSpecifier(): OverrideSpecifierContext {
		return this.getTypedRuleContext(OverrideSpecifierContext, 0) as OverrideSpecifierContext;
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
	public placeholderStatement(): PlaceholderStatementContext {
		return this.getTypedRuleContext(PlaceholderStatementContext, 0) as PlaceholderStatementContext;
	}
	public variableDefinition(): VariableDefinitionContext {
		return this.getTypedRuleContext(VariableDefinitionContext, 0) as VariableDefinitionContext;
	}
	public tupleAssignment(): TupleAssignmentContext {
		return this.getTypedRuleContext(TupleAssignmentContext, 0) as TupleAssignmentContext;
	}
	public prefixIncDecStatement(): PrefixIncDecStatementContext {
		return this.getTypedRuleContext(PrefixIncDecStatementContext, 0) as PrefixIncDecStatementContext;
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
	public returnStatement(): ReturnStatementContext {
		return this.getTypedRuleContext(ReturnStatementContext, 0) as ReturnStatementContext;
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
	public expressionStatement(): ExpressionStatementContext {
		return this.getTypedRuleContext(ExpressionStatementContext, 0) as ExpressionStatementContext;
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


export class ExpressionStatementContext extends ParserRuleContext {
	public _op!: Token;
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
	public DotPush(): TerminalNode {
		return this.getToken(SolidCashParser.DotPush, 0);
	}
	public DotPop(): TerminalNode {
		return this.getToken(SolidCashParser.DotPop, 0);
	}
	public DotDelete(): TerminalNode {
		return this.getToken(SolidCashParser.DotDelete, 0);
	}
	public pushArgument(): PushArgumentContext {
		return this.getTypedRuleContext(PushArgumentContext, 0) as PushArgumentContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_expressionStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitExpressionStatement) {
			return visitor.visitExpressionStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PrefixIncDecStatementContext extends ParserRuleContext {
	public _op!: Token;
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_prefixIncDecStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitPrefixIncDecStatement) {
			return visitor.visitPrefixIncDecStatement(this);
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


export class LvPartContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public lvMember(): LvMemberContext {
		return this.getTypedRuleContext(LvMemberContext, 0) as LvMemberContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_lvPart;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitLvPart) {
			return visitor.visitLvPart(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class LvMemberContext extends ParserRuleContext {
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
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_lvMember;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitLvMember) {
			return visitor.visitLvMember(this);
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
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
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


export class PushArgumentContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_pushArgument;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitPushArgument) {
			return visitor.visitPushArgument(this);
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
export class DeleteMemberEntryContext extends DeleteStatementContext {
	constructor(parser: SolidCashParser, ctx: DeleteStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
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
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitDeleteMemberEntry) {
			return visitor.visitDeleteMemberEntry(this);
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
export class DeleteMemberContext extends DeleteStatementContext {
	constructor(parser: SolidCashParser, ctx: DeleteStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitDeleteMember) {
			return visitor.visitDeleteMember(this);
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
	public _op!: Token;
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
	public yulBlock(): YulBlockContext {
		return this.getTypedRuleContext(YulBlockContext, 0) as YulBlockContext;
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


export class YulBlockContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public yulStatement_list(): YulStatementContext[] {
		return this.getTypedRuleContexts(YulStatementContext) as YulStatementContext[];
	}
	public yulStatement(i: number): YulStatementContext {
		return this.getTypedRuleContext(YulStatementContext, i) as YulStatementContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_yulBlock;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulBlock) {
			return visitor.visitYulBlock(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class YulStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_yulStatement;
	}
	public override copyFrom(ctx: YulStatementContext): void {
		super.copyFrom(ctx);
	}
}
export class YulBreakStmtContext extends YulStatementContext {
	constructor(parser: SolidCashParser, ctx: YulStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulBreakStmt) {
			return visitor.visitYulBreakStmt(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class YulPathStmtContext extends YulStatementContext {
	constructor(parser: SolidCashParser, ctx: YulStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public yulPath(): YulPathContext {
		return this.getTypedRuleContext(YulPathContext, 0) as YulPathContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulPathStmt) {
			return visitor.visitYulPathStmt(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class YulAssignStmtContext extends YulStatementContext {
	constructor(parser: SolidCashParser, ctx: YulStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public yulAssignment(): YulAssignmentContext {
		return this.getTypedRuleContext(YulAssignmentContext, 0) as YulAssignmentContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulAssignStmt) {
			return visitor.visitYulAssignStmt(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class YulContinueStmtContext extends YulStatementContext {
	constructor(parser: SolidCashParser, ctx: YulStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulContinueStmt) {
			return visitor.visitYulContinueStmt(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class YulLeaveStmtContext extends YulStatementContext {
	constructor(parser: SolidCashParser, ctx: YulStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulLeaveStmt) {
			return visitor.visitYulLeaveStmt(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class YulLiteralStmtContext extends YulStatementContext {
	constructor(parser: SolidCashParser, ctx: YulStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public yulLiteral(): YulLiteralContext {
		return this.getTypedRuleContext(YulLiteralContext, 0) as YulLiteralContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulLiteralStmt) {
			return visitor.visitYulLiteralStmt(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class YulFunctionDefStmtContext extends YulStatementContext {
	constructor(parser: SolidCashParser, ctx: YulStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public yulFunctionDefinition(): YulFunctionDefinitionContext {
		return this.getTypedRuleContext(YulFunctionDefinitionContext, 0) as YulFunctionDefinitionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulFunctionDefStmt) {
			return visitor.visitYulFunctionDefStmt(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class YulVarDeclStmtContext extends YulStatementContext {
	constructor(parser: SolidCashParser, ctx: YulStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public yulVariableDeclaration(): YulVariableDeclarationContext {
		return this.getTypedRuleContext(YulVariableDeclarationContext, 0) as YulVariableDeclarationContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulVarDeclStmt) {
			return visitor.visitYulVarDeclStmt(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class YulCallStmtContext extends YulStatementContext {
	constructor(parser: SolidCashParser, ctx: YulStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public yulFunctionCall(): YulFunctionCallContext {
		return this.getTypedRuleContext(YulFunctionCallContext, 0) as YulFunctionCallContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulCallStmt) {
			return visitor.visitYulCallStmt(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class YulNestedBlockStmtContext extends YulStatementContext {
	constructor(parser: SolidCashParser, ctx: YulStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public yulBlock(): YulBlockContext {
		return this.getTypedRuleContext(YulBlockContext, 0) as YulBlockContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulNestedBlockStmt) {
			return visitor.visitYulNestedBlockStmt(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class YulSwitchStmtContext extends YulStatementContext {
	constructor(parser: SolidCashParser, ctx: YulStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public yulSwitch(): YulSwitchContext {
		return this.getTypedRuleContext(YulSwitchContext, 0) as YulSwitchContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulSwitchStmt) {
			return visitor.visitYulSwitchStmt(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class YulForStmtContext extends YulStatementContext {
	constructor(parser: SolidCashParser, ctx: YulStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public yulForLoop(): YulForLoopContext {
		return this.getTypedRuleContext(YulForLoopContext, 0) as YulForLoopContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulForStmt) {
			return visitor.visitYulForStmt(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class YulIfStmtContext extends YulStatementContext {
	constructor(parser: SolidCashParser, ctx: YulStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public yulIf(): YulIfContext {
		return this.getTypedRuleContext(YulIfContext, 0) as YulIfContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulIfStmt) {
			return visitor.visitYulIfStmt(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class YulVariableDeclarationContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public anyIdentifier_list(): AnyIdentifierContext[] {
		return this.getTypedRuleContexts(AnyIdentifierContext) as AnyIdentifierContext[];
	}
	public anyIdentifier(i: number): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, i) as AnyIdentifierContext;
	}
	public yulExpression(): YulExpressionContext {
		return this.getTypedRuleContext(YulExpressionContext, 0) as YulExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_yulVariableDeclaration;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulVariableDeclaration) {
			return visitor.visitYulVariableDeclaration(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class YulAssignmentContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public yulPath_list(): YulPathContext[] {
		return this.getTypedRuleContexts(YulPathContext) as YulPathContext[];
	}
	public yulPath(i: number): YulPathContext {
		return this.getTypedRuleContext(YulPathContext, i) as YulPathContext;
	}
	public yulExpression(): YulExpressionContext {
		return this.getTypedRuleContext(YulExpressionContext, 0) as YulExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_yulAssignment;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulAssignment) {
			return visitor.visitYulAssignment(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class YulIfContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public yulExpression(): YulExpressionContext {
		return this.getTypedRuleContext(YulExpressionContext, 0) as YulExpressionContext;
	}
	public yulBlock(): YulBlockContext {
		return this.getTypedRuleContext(YulBlockContext, 0) as YulBlockContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_yulIf;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulIf) {
			return visitor.visitYulIf(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class YulSwitchContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public yulExpression(): YulExpressionContext {
		return this.getTypedRuleContext(YulExpressionContext, 0) as YulExpressionContext;
	}
	public yulDefault(): YulDefaultContext {
		return this.getTypedRuleContext(YulDefaultContext, 0) as YulDefaultContext;
	}
	public yulCase_list(): YulCaseContext[] {
		return this.getTypedRuleContexts(YulCaseContext) as YulCaseContext[];
	}
	public yulCase(i: number): YulCaseContext {
		return this.getTypedRuleContext(YulCaseContext, i) as YulCaseContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_yulSwitch;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulSwitch) {
			return visitor.visitYulSwitch(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class YulCaseContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public yulLiteral(): YulLiteralContext {
		return this.getTypedRuleContext(YulLiteralContext, 0) as YulLiteralContext;
	}
	public yulBlock(): YulBlockContext {
		return this.getTypedRuleContext(YulBlockContext, 0) as YulBlockContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_yulCase;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulCase) {
			return visitor.visitYulCase(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class YulDefaultContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public yulBlock(): YulBlockContext {
		return this.getTypedRuleContext(YulBlockContext, 0) as YulBlockContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_yulDefault;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulDefault) {
			return visitor.visitYulDefault(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class YulForLoopContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public yulBlock_list(): YulBlockContext[] {
		return this.getTypedRuleContexts(YulBlockContext) as YulBlockContext[];
	}
	public yulBlock(i: number): YulBlockContext {
		return this.getTypedRuleContext(YulBlockContext, i) as YulBlockContext;
	}
	public yulExpression(): YulExpressionContext {
		return this.getTypedRuleContext(YulExpressionContext, 0) as YulExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_yulForLoop;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulForLoop) {
			return visitor.visitYulForLoop(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class YulFunctionDefinitionContext extends ParserRuleContext {
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
	public yulBlock(): YulBlockContext {
		return this.getTypedRuleContext(YulBlockContext, 0) as YulBlockContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_yulFunctionDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulFunctionDefinition) {
			return visitor.visitYulFunctionDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class YulExpressionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public yulFunctionCall(): YulFunctionCallContext {
		return this.getTypedRuleContext(YulFunctionCallContext, 0) as YulFunctionCallContext;
	}
	public yulPath(): YulPathContext {
		return this.getTypedRuleContext(YulPathContext, 0) as YulPathContext;
	}
	public yulLiteral(): YulLiteralContext {
		return this.getTypedRuleContext(YulLiteralContext, 0) as YulLiteralContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_yulExpression;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulExpression) {
			return visitor.visitYulExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class YulFunctionCallContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public yulFunctionName(): YulFunctionNameContext {
		return this.getTypedRuleContext(YulFunctionNameContext, 0) as YulFunctionNameContext;
	}
	public yulExpression_list(): YulExpressionContext[] {
		return this.getTypedRuleContexts(YulExpressionContext) as YulExpressionContext[];
	}
	public yulExpression(i: number): YulExpressionContext {
		return this.getTypedRuleContext(YulExpressionContext, i) as YulExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_yulFunctionCall;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulFunctionCall) {
			return visitor.visitYulFunctionCall(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class YulFunctionNameContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public BoundedBytes(): TerminalNode {
		return this.getToken(SolidCashParser.BoundedBytes, 0);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_yulFunctionName;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulFunctionName) {
			return visitor.visitYulFunctionName(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class YulPathContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public anyIdentifier_list(): AnyIdentifierContext[] {
		return this.getTypedRuleContexts(AnyIdentifierContext) as AnyIdentifierContext[];
	}
	public anyIdentifier(i: number): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, i) as AnyIdentifierContext;
	}
	public DotLength_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.DotLength);
	}
	public DotLength(i: number): TerminalNode {
		return this.getToken(SolidCashParser.DotLength, i);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_yulPath;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulPath) {
			return visitor.visitYulPath(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class YulLiteralContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public NumberLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.NumberLiteral, 0);
	}
	public HexLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.HexLiteral, 0);
	}
	public HexStringLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.HexStringLiteral, 0);
	}
	public StringLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.StringLiteral, 0);
	}
	public BooleanLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.BooleanLiteral, 0);
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_yulLiteral;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulLiteral) {
			return visitor.visitYulLiteral(this);
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
	public typeListItem_list(): TypeListItemContext[] {
		return this.getTypedRuleContexts(TypeListItemContext) as TypeListItemContext[];
	}
	public typeListItem(i: number): TypeListItemContext {
		return this.getTypedRuleContext(TypeListItemContext, i) as TypeListItemContext;
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


export class TypeListItemContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public arrayType(): ArrayTypeContext {
		return this.getTypedRuleContext(ArrayTypeContext, 0) as ArrayTypeContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_typeListItem;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitTypeListItem) {
			return visitor.visitTypeListItem(this);
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
export class InstantiationWithOptionsContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public callOptions(): CallOptionsContext {
		return this.getTypedRuleContext(CallOptionsContext, 0) as CallOptionsContext;
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitInstantiationWithOptions) {
			return visitor.visitInstantiationWithOptions(this);
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
export class PostfixOpContext extends ExpressionContext {
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
		if (visitor.visitPostfixOp) {
			return visitor.visitPostfixOp(this);
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
export class NewDynamicBytesContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public UnboundedBytes(): TerminalNode {
		return this.getToken(SolidCashParser.UnboundedBytes, 0);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitNewDynamicBytes) {
			return visitor.visitNewDynamicBytes(this);
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
	public NumberUnit(): TerminalNode {
		return this.getToken(SolidCashParser.NumberUnit, 0);
	}
	public BchUnit(): TerminalNode {
		return this.getToken(SolidCashParser.BchUnit, 0);
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
