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
	public static readonly RULE_variableDefinition = 62;
	public static readonly RULE_tupleAssignment = 63;
	public static readonly RULE_tupleSlot = 64;
	public static readonly RULE_pushArgument = 65;
	public static readonly RULE_deleteStatement = 66;
	public static readonly RULE_timeOpStatement = 67;
	public static readonly RULE_requireStatement = 68;
	public static readonly RULE_ifStatement = 69;
	public static readonly RULE_loopStatement = 70;
	public static readonly RULE_forOfEntriesStatement = 71;
	public static readonly RULE_forInStatement = 72;
	public static readonly RULE_forOfStatement = 73;
	public static readonly RULE_forStatement = 74;
	public static readonly RULE_forInit = 75;
	public static readonly RULE_forCondition = 76;
	public static readonly RULE_forUpdate = 77;
	public static readonly RULE_doWhileStatement = 78;
	public static readonly RULE_whileStatement = 79;
	public static readonly RULE_consoleStatement = 80;
	public static readonly RULE_assemblyStatement = 81;
	public static readonly RULE_yulBlock = 82;
	public static readonly RULE_yulStatement = 83;
	public static readonly RULE_yulVariableDeclaration = 84;
	public static readonly RULE_yulAssignment = 85;
	public static readonly RULE_yulIf = 86;
	public static readonly RULE_yulSwitch = 87;
	public static readonly RULE_yulCase = 88;
	public static readonly RULE_yulDefault = 89;
	public static readonly RULE_yulForLoop = 90;
	public static readonly RULE_yulFunctionDefinition = 91;
	public static readonly RULE_yulExpression = 92;
	public static readonly RULE_yulFunctionCall = 93;
	public static readonly RULE_yulFunctionName = 94;
	public static readonly RULE_yulPath = 95;
	public static readonly RULE_yulLiteral = 96;
	public static readonly RULE_uncheckedStatement = 97;
	public static readonly RULE_switchStatement = 98;
	public static readonly RULE_switchCase = 99;
	public static readonly RULE_switchDefault = 100;
	public static readonly RULE_tryCatchStatement = 101;
	public static readonly RULE_tryReturns = 102;
	public static readonly RULE_catchClause = 103;
	public static readonly RULE_breakStatement = 104;
	public static readonly RULE_continueStatement = 105;
	public static readonly RULE_requireMessage = 106;
	public static readonly RULE_revertStatement = 107;
	public static readonly RULE_assertStatement = 108;
	public static readonly RULE_consoleParameter = 109;
	public static readonly RULE_consoleParameterList = 110;
	public static readonly RULE_functionCall = 111;
	public static readonly RULE_namedArg = 112;
	public static readonly RULE_expressionList = 113;
	public static readonly RULE_callOptions = 114;
	public static readonly RULE_callOption = 115;
	public static readonly RULE_typeList = 116;
	public static readonly RULE_typeListItem = 117;
	public static readonly RULE_expression = 118;
	public static readonly RULE_memberName = 119;
	public static readonly RULE_modifier = 120;
	public static readonly RULE_literal = 121;
	public static readonly RULE_numberLiteral = 122;
	public static readonly RULE_decimalLiteral = 123;
	public static readonly RULE_typeName = 124;
	public static readonly RULE_typeCast = 125;
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
                                                            "'solidity'", 
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
		"emitStatement", "variableDefinition", "tupleAssignment", "tupleSlot", 
		"pushArgument", "deleteStatement", "timeOpStatement", "requireStatement", 
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
			this.state = 255;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===37) {
				{
				{
				this.state = 252;
				this.pragmaDirective();
				}
				}
				this.state = 257;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 261;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===1) {
				{
				{
				this.state = 258;
				this.importDirective();
				}
				}
				this.state = 263;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 277;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1850433) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 275;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 2, this._ctx) ) {
				case 1:
					{
					this.state = 264;
					this.constantDefinition();
					}
					break;
				case 2:
					{
					this.state = 265;
					this.enumDefinition();
					}
					break;
				case 3:
					{
					this.state = 266;
					this.structDefinition();
					}
					break;
				case 4:
					{
					this.state = 267;
					this.typeDefinition();
					}
					break;
				case 5:
					{
					this.state = 268;
					this.usingForDirective();
					}
					break;
				case 6:
					{
					this.state = 269;
					this.errorDefinition();
					}
					break;
				case 7:
					{
					this.state = 270;
					this.eventDefinition();
					}
					break;
				case 8:
					{
					this.state = 271;
					this.interfaceDefinition();
					}
					break;
				case 9:
					{
					this.state = 272;
					this.freeFunctionDefinition();
					}
					break;
				case 10:
					{
					this.state = 273;
					this.libraryDefinition();
					}
					break;
				case 11:
					{
					this.state = 274;
					this.contractDefinition();
					}
					break;
				}
				}
				this.state = 279;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 280;
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
			this.state = 308;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 6, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 282;
				this.match(SolidCashParser.T__0);
				this.state = 283;
				this.match(SolidCashParser.StringLiteral);
				this.state = 284;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 285;
				this.match(SolidCashParser.T__0);
				this.state = 286;
				this.match(SolidCashParser.StringLiteral);
				this.state = 287;
				this.match(SolidCashParser.T__2);
				this.state = 288;
				this.match(SolidCashParser.Identifier);
				this.state = 289;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 290;
				this.match(SolidCashParser.T__0);
				this.state = 291;
				this.match(SolidCashParser.T__3);
				this.state = 292;
				this.importBinding();
				this.state = 297;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 293;
						this.match(SolidCashParser.T__4);
						this.state = 294;
						this.importBinding();
						}
						}
					}
					this.state = 299;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				}
				this.state = 301;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 300;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 303;
				this.match(SolidCashParser.T__5);
				this.state = 304;
				this.match(SolidCashParser.Identifier);
				this.state = 305;
				this.match(SolidCashParser.StringLiteral);
				this.state = 306;
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
			this.state = 310;
			this.match(SolidCashParser.Identifier);
			this.state = 313;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 311;
				this.match(SolidCashParser.T__2);
				this.state = 312;
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
			this.state = 315;
			this.match(SolidCashParser.T__6);
			this.state = 316;
			this.anyIdentifier();
			this.state = 317;
			this.parameterList();
			this.state = 321;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 318;
				this.functionModifier();
				}
				}
				this.state = 323;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 325;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 324;
				this.returnType();
				}
			}

			this.state = 327;
			this.match(SolidCashParser.T__3);
			this.state = 331;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 328;
				this.statement();
				}
				}
				this.state = 333;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 334;
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
			this.state = 375;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 17, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 336;
				this.match(SolidCashParser.T__7);
				this.state = 337;
				this.match(SolidCashParser.Identifier);
				this.state = 338;
				this.match(SolidCashParser.T__8);
				this.state = 343;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 11, this._ctx) ) {
				case 1:
					{
					this.state = 339;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 340;
					this.mappingType();
					}
					break;
				case 3:
					{
					this.state = 341;
					this.typeName();
					}
					break;
				case 4:
					{
					this.state = 342;
					this.match(SolidCashParser.T__9);
					}
					break;
				}
				this.state = 346;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 345;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 348;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 349;
				this.match(SolidCashParser.T__7);
				this.state = 350;
				this.match(SolidCashParser.T__3);
				this.state = 351;
				this.usingFunctionBinding();
				this.state = 356;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 352;
						this.match(SolidCashParser.T__4);
						this.state = 353;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 358;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				}
				this.state = 360;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 359;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 362;
				this.match(SolidCashParser.T__5);
				this.state = 363;
				this.match(SolidCashParser.T__8);
				this.state = 368;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 15, this._ctx) ) {
				case 1:
					{
					this.state = 364;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 365;
					this.mappingType();
					}
					break;
				case 3:
					{
					this.state = 366;
					this.typeName();
					}
					break;
				case 4:
					{
					this.state = 367;
					this.match(SolidCashParser.T__9);
					}
					break;
				}
				this.state = 371;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 370;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 373;
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
			this.state = 377;
			this.match(SolidCashParser.Identifier);
			this.state = 380;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===12) {
				{
				this.state = 378;
				this.match(SolidCashParser.T__11);
				this.state = 379;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 384;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 382;
				this.match(SolidCashParser.T__2);
				this.state = 383;
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
			this.state = 386;
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
			this.state = 388;
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
			this.state = 404;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 21, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 390;
				this.match(SolidCashParser.T__36);
				this.state = 391;
				this.pragmaName();
				this.state = 392;
				this.pragmaValue();
				this.state = 393;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 395;
				this.match(SolidCashParser.T__36);
				this.state = 396;
				this.match(SolidCashParser.Identifier);
				this.state = 400;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===38 || ((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 2081) !== 0) || _la===180) {
					{
					{
					this.state = 397;
					_la = this._input.LA(1);
					if(!(_la===38 || ((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 2081) !== 0) || _la===180)) {
					this._errHandler.recoverInline(this);
					}
					else {
						this._errHandler.reportMatch(this);
					    this.consume();
					}
					}
					}
					this.state = 402;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 403;
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
			this.state = 406;
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
			this.state = 414;
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
				this.state = 409;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 408;
					this.versionConstraint();
					}
					}
					this.state = 411;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0) || _la===140 || _la===144);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 413;
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
			this.state = 417;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0)) {
				{
				this.state = 416;
				this.versionOperator();
				}
			}

			this.state = 419;
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
			this.state = 421;
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
			this.state = 423;
			this.match(SolidCashParser.T__40);
			this.state = 424;
			this.match(SolidCashParser.Identifier);
			this.state = 434;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 425;
				this.match(SolidCashParser.T__41);
				this.state = 426;
				this.match(SolidCashParser.Identifier);
				this.state = 431;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 427;
					this.match(SolidCashParser.T__4);
					this.state = 428;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 433;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 436;
			this.match(SolidCashParser.T__3);
			this.state = 447;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1843969) !== 0)) {
				{
				this.state = 445;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 27, this._ctx) ) {
				case 1:
					{
					this.state = 437;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 438;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 439;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 440;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 441;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 442;
					this.interfaceStateVariable();
					}
					break;
				case 7:
					{
					this.state = 443;
					this.interfaceCollection();
					}
					break;
				case 8:
					{
					this.state = 444;
					this.interfaceFunction();
					}
					break;
				}
				}
				this.state = 449;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 450;
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
			this.state = 462;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 29, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 452;
				this.interfaceStateVariableVisibility();
				this.state = 453;
				this.mappingType();
				this.state = 454;
				this.match(SolidCashParser.Identifier);
				this.state = 455;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 457;
				this.interfaceStateVariableVisibility();
				this.state = 458;
				this.arrayType(0);
				this.state = 459;
				this.match(SolidCashParser.Identifier);
				this.state = 460;
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
			this.state = 464;
			this.interfaceStateVariableVisibility();
			this.state = 465;
			this.typeName();
			this.state = 466;
			this.match(SolidCashParser.Identifier);
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
	public interfaceStateVariableVisibility(): InterfaceStateVariableVisibilityContext {
		let localctx: InterfaceStateVariableVisibilityContext = new InterfaceStateVariableVisibilityContext(this, this._ctx, this.state);
		this.enterRule(localctx, 32, SolidCashParser.RULE_interfaceStateVariableVisibility);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 469;
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
			this.state = 471;
			this.match(SolidCashParser.T__6);
			this.state = 472;
			this.match(SolidCashParser.Identifier);
			this.state = 473;
			this.parameterList();
			this.state = 477;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 474;
				this.functionModifier();
				}
				}
				this.state = 479;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 481;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 480;
				this.returnType();
				}
			}

			this.state = 483;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 485;
			this.match(SolidCashParser.T__44);
			this.state = 486;
			this.match(SolidCashParser.Identifier);
			this.state = 487;
			this.match(SolidCashParser.T__3);
			this.state = 499;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 815538945) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 497;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 32, this._ctx) ) {
				case 1:
					{
					this.state = 488;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 489;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 490;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 491;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 492;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 493;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 494;
					this.stateVariableDeclaration();
					}
					break;
				case 8:
					{
					this.state = 495;
					this.usingForDirective();
					}
					break;
				case 9:
					{
					this.state = 496;
					this.freeFunctionDefinition();
					}
					break;
				}
				}
				this.state = 501;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 502;
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
			this.state = 505;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===46) {
				{
				this.state = 504;
				this.match(SolidCashParser.T__45);
				}
			}

			this.state = 507;
			this.match(SolidCashParser.T__46);
			this.state = 508;
			this.match(SolidCashParser.Identifier);
			this.state = 510;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 509;
				this.parameterList();
				}
			}

			this.state = 521;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 512;
				this.match(SolidCashParser.T__41);
				this.state = 513;
				this.inheritanceSpecifier();
				this.state = 518;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 514;
					this.match(SolidCashParser.T__4);
					this.state = 515;
					this.inheritanceSpecifier();
					}
					}
					this.state = 520;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 523;
			this.match(SolidCashParser.T__3);
			this.state = 540;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 268435459) !== 0) || ((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 37411875) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 538;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 38, this._ctx) ) {
				case 1:
					{
					this.state = 524;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 525;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 526;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 527;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 528;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 529;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 530;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 531;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 532;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 533;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 534;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 535;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 536;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 537;
					this.receiveDefinition();
					}
					break;
				}
				}
				this.state = 542;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 543;
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
			this.state = 545;
			this.match(SolidCashParser.Identifier);
			this.state = 547;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 546;
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
			this.state = 549;
			this.match(SolidCashParser.T__6);
			this.state = 550;
			this.anyIdentifier();
			this.state = 551;
			this.parameterList();
			this.state = 556;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0) || _la===180) {
				{
				this.state = 554;
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
					this.state = 552;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 553;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 558;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 560;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 559;
				this.returnType();
				}
			}

			this.state = 562;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 564;
			this.match(SolidCashParser.T__47);
			this.state = 565;
			this.match(SolidCashParser.Identifier);
			this.state = 566;
			this.match(SolidCashParser.T__48);
			this.state = 578;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 567;
				this.eventParameter();
				this.state = 572;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 44, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 568;
						this.match(SolidCashParser.T__4);
						this.state = 569;
						this.eventParameter();
						}
						}
					}
					this.state = 574;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 44, this._ctx);
				}
				this.state = 576;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 575;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 580;
			this.match(SolidCashParser.T__49);
			this.state = 582;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===51) {
				{
				this.state = 581;
				this.match(SolidCashParser.T__50);
				}
			}

			this.state = 584;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 588;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 48, this._ctx) ) {
			case 1:
				{
				this.state = 586;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 587;
				this.arrayType(0);
				}
				break;
			}
			this.state = 591;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===52) {
				{
				this.state = 590;
				this.match(SolidCashParser.T__51);
				}
			}

			this.state = 594;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 593;
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
			this.state = 596;
			this.match(SolidCashParser.T__34);
			this.state = 597;
			this.match(SolidCashParser.Identifier);
			this.state = 598;
			this.match(SolidCashParser.T__48);
			this.state = 610;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 599;
				this.errorParameter();
				this.state = 604;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 600;
						this.match(SolidCashParser.T__4);
						this.state = 601;
						this.errorParameter();
						}
						}
					}
					this.state = 606;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				}
				this.state = 608;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 607;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 612;
			this.match(SolidCashParser.T__49);
			this.state = 613;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 623;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 56, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 615;
				this.typeName();
				this.state = 617;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 616;
					this.match(SolidCashParser.Identifier);
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 619;
				this.arrayType(0);
				this.state = 621;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 620;
					this.match(SolidCashParser.Identifier);
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
	public structDefinition(): StructDefinitionContext {
		let localctx: StructDefinitionContext = new StructDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 52, SolidCashParser.RULE_structDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 625;
			this.match(SolidCashParser.T__52);
			this.state = 626;
			this.match(SolidCashParser.Identifier);
			this.state = 627;
			this.match(SolidCashParser.T__3);
			this.state = 629;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 628;
				this.structField();
				}
				}
				this.state = 631;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180);
			this.state = 633;
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
			this.state = 638;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 58, this._ctx) ) {
			case 1:
				{
				this.state = 635;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 636;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 637;
				this.mappingType();
				}
				break;
			}
			this.state = 640;
			this.anyIdentifier();
			this.state = 641;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 643;
			this.match(SolidCashParser.T__53);
			this.state = 644;
			this.match(SolidCashParser.Identifier);
			this.state = 645;
			this.match(SolidCashParser.T__3);
			this.state = 646;
			this.enumMember();
			this.state = 651;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 59, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 647;
					this.match(SolidCashParser.T__4);
					this.state = 648;
					this.enumMember();
					}
					}
				}
				this.state = 653;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 59, this._ctx);
			}
			this.state = 655;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 654;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 657;
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
			this.state = 659;
			this.match(SolidCashParser.Identifier);
			this.state = 662;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 660;
				this.match(SolidCashParser.T__39);
				this.state = 661;
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
			this.state = 664;
			this.match(SolidCashParser.T__54);
			this.state = 665;
			this.match(SolidCashParser.Identifier);
			this.state = 666;
			this.match(SolidCashParser.T__41);
			this.state = 667;
			this.typeName();
			this.state = 668;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 670;
			this.typeName();
			this.state = 671;
			this.match(SolidCashParser.T__55);
			this.state = 672;
			this.match(SolidCashParser.Identifier);
			this.state = 673;
			this.match(SolidCashParser.T__39);
			this.state = 674;
			this.expression(0);
			this.state = 675;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 677;
			this.match(SolidCashParser.T__56);
			this.state = 678;
			this.parameterList();
			this.state = 682;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 98307) !== 0)) {
				{
				{
				this.state = 679;
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
				this.state = 684;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 688;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 63, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 685;
					this.parentInvocation();
					}
					}
				}
				this.state = 690;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 63, this._ctx);
			}
			this.state = 694;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
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
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
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
	public fallbackDefinition(): FallbackDefinitionContext {
		let localctx: FallbackDefinitionContext = new FallbackDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 66, SolidCashParser.RULE_fallbackDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 706;
			this.match(SolidCashParser.T__59);
			this.state = 707;
			this.parameterList();
			this.state = 711;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 8197) !== 0)) {
				{
				{
				this.state = 708;
				this.fallbackModifier();
				}
				}
				this.state = 713;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 714;
			this.match(SolidCashParser.T__43);
			this.state = 718;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 8197) !== 0)) {
				{
				{
				this.state = 715;
				this.fallbackModifier();
				}
				}
				this.state = 720;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 724;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 721;
				this.customModifierInvocation();
				}
				}
				this.state = 726;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 728;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 727;
				this.returnType();
				}
			}

			this.state = 730;
			this.match(SolidCashParser.T__3);
			this.state = 734;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 731;
				this.statement();
				}
				}
				this.state = 736;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 737;
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
			this.state = 742;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 59:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 739;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 740;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 741;
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
			this.state = 744;
			this.match(SolidCashParser.T__61);
			this.state = 745;
			this.match(SolidCashParser.T__48);
			this.state = 746;
			this.match(SolidCashParser.T__49);
			this.state = 750;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===61 || _la===72) {
				{
				{
				this.state = 747;
				this.receiveModifier();
				}
				}
				this.state = 752;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 753;
			this.match(SolidCashParser.T__43);
			this.state = 757;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===61 || _la===72) {
				{
				{
				this.state = 754;
				this.receiveModifier();
				}
				}
				this.state = 759;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 760;
			this.match(SolidCashParser.T__58);
			this.state = 764;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===61 || _la===72) {
				{
				{
				this.state = 761;
				this.receiveModifier();
				}
				}
				this.state = 766;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 767;
			this.match(SolidCashParser.T__3);
			this.state = 771;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 768;
				this.statement();
				}
				}
				this.state = 773;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 774;
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
			this.state = 778;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 61:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 776;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 777;
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
			this.state = 780;
			this.match(SolidCashParser.Identifier);
			this.state = 781;
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
			this.state = 854;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 91, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 784;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 783;
					this.stateVariableVisibility();
					}
				}

				this.state = 786;
				this.typeName();
				this.state = 791;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					this.state = 789;
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
						this.state = 787;
						this.modifier();
						}
						break;
					case 72:
						{
						this.state = 788;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 793;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 794;
				this.match(SolidCashParser.Identifier);
				this.state = 797;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 795;
					this.match(SolidCashParser.T__39);
					this.state = 796;
					this.expression(0);
					}
				}

				this.state = 799;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 801;
				this.typeName();
				this.state = 806;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					this.state = 804;
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
						this.state = 802;
						this.modifier();
						}
						break;
					case 72:
						{
						this.state = 803;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 808;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 809;
				this.stateVariableVisibility();
				this.state = 814;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					this.state = 812;
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
						this.state = 810;
						this.modifier();
						}
						break;
					case 72:
						{
						this.state = 811;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 816;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 817;
				this.match(SolidCashParser.Identifier);
				this.state = 820;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 818;
					this.match(SolidCashParser.T__39);
					this.state = 819;
					this.expression(0);
					}
				}

				this.state = 822;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 825;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 824;
					this.stateVariableVisibility();
					}
				}

				this.state = 827;
				this.mappingType();
				this.state = 831;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 828;
					this.collectionModifier();
					}
					}
					this.state = 833;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 834;
				this.match(SolidCashParser.Identifier);
				this.state = 835;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 838;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 837;
					this.stateVariableVisibility();
					}
				}

				this.state = 840;
				this.arrayType(0);
				this.state = 844;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 841;
					this.collectionModifier();
					}
					}
					this.state = 846;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 847;
				this.match(SolidCashParser.Identifier);
				this.state = 850;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 848;
					this.match(SolidCashParser.T__39);
					this.state = 849;
					this.expression(0);
					}
				}

				this.state = 852;
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
			this.state = 859;
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
				this.state = 856;
				this.modifier();
				}
				break;
			case 43:
			case 44:
			case 58:
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 857;
				this.stateVariableVisibility();
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 858;
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
			this.state = 861;
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
			this.state = 899;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 98, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 863;
				this.match(SolidCashParser.T__63);
				this.state = 864;
				this.match(SolidCashParser.T__48);
				this.state = 865;
				this.typeName();
				this.state = 867;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 866;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 869;
				this.match(SolidCashParser.T__64);
				this.state = 870;
				this.typeName();
				this.state = 872;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 871;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 874;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 876;
				this.match(SolidCashParser.T__63);
				this.state = 877;
				this.match(SolidCashParser.T__48);
				this.state = 878;
				this.typeName();
				this.state = 880;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 879;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 882;
				this.match(SolidCashParser.T__64);
				this.state = 883;
				this.mappingType();
				this.state = 884;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 886;
				this.match(SolidCashParser.T__63);
				this.state = 887;
				this.match(SolidCashParser.T__48);
				this.state = 888;
				this.typeName();
				this.state = 890;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 889;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 892;
				this.match(SolidCashParser.T__64);
				this.state = 893;
				this.arrayType(0);
				this.state = 895;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 894;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 897;
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
			this.state = 911;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 99, this._ctx) ) {
			case 1:
				{
				this.state = 902;
				this.typeName();
				this.state = 903;
				this.match(SolidCashParser.T__65);
				this.state = 904;
				_la = this._input.LA(1);
				if(!(_la===145 || _la===180)) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 905;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 2:
				{
				this.state = 907;
				this.typeName();
				this.state = 908;
				this.match(SolidCashParser.T__65);
				this.state = 909;
				this.match(SolidCashParser.T__66);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 922;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 101, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 920;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 100, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 913;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 914;
						this.match(SolidCashParser.T__65);
						this.state = 915;
						_la = this._input.LA(1);
						if(!(_la===145 || _la===180)) {
						this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 916;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 917;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 918;
						this.match(SolidCashParser.T__65);
						this.state = 919;
						this.match(SolidCashParser.T__66);
						}
						break;
					}
					}
				}
				this.state = 924;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 101, this._ctx);
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
			this.state = 925;
			this.match(SolidCashParser.T__67);
			this.state = 926;
			this.match(SolidCashParser.Identifier);
			this.state = 928;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 927;
				this.parameterList();
				}
			}

			this.state = 934;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===61 || _la===72) {
				{
				this.state = 932;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 61:
					{
					this.state = 930;
					this.match(SolidCashParser.T__60);
					}
					break;
				case 72:
					{
					this.state = 931;
					this.overrideSpecifier();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 936;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 937;
			this.match(SolidCashParser.T__3);
			this.state = 941;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 938;
				this.modifierStatement();
				}
				}
				this.state = 943;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 944;
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
			this.state = 948;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 106, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 946;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 947;
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
			this.state = 950;
			this.match(SolidCashParser.T__68);
			this.state = 951;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 953;
			this.match(SolidCashParser.T__6);
			this.state = 954;
			this.anyIdentifier();
			this.state = 955;
			this.parameterList();
			this.state = 960;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0) || _la===180) {
				{
				this.state = 958;
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
					this.state = 956;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 957;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 962;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 964;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 963;
				this.returnType();
				}
			}

			this.state = 966;
			this.match(SolidCashParser.T__3);
			this.state = 970;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 967;
				this.statement();
				}
				}
				this.state = 972;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 973;
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
			this.state = 975;
			this.match(SolidCashParser.Identifier);
			this.state = 977;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 976;
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
			this.state = 993;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 70:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 979;
				this.match(SolidCashParser.T__69);
				}
				break;
			case 71:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 980;
				this.match(SolidCashParser.T__70);
				}
				break;
			case 58:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 981;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 44:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 982;
				this.match(SolidCashParser.T__43);
				}
				break;
			case 43:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 983;
				this.match(SolidCashParser.T__42);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 984;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 59:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 985;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 986;
				this.overrideSpecifier();
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 987;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 988;
				this.unsafeModifier();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 989;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 990;
				this.match(SolidCashParser.T__27);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 991;
				this.match(SolidCashParser.T__30);
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 992;
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
			this.state = 995;
			this.match(SolidCashParser.T__71);
			this.state = 1006;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 996;
				this.match(SolidCashParser.T__48);
				this.state = 997;
				this.match(SolidCashParser.Identifier);
				this.state = 1002;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 998;
					this.match(SolidCashParser.T__4);
					this.state = 999;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1004;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1005;
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
			this.state = 1008;
			this.match(SolidCashParser.T__31);
			this.state = 1012;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 1009;
				this.match(SolidCashParser.T__48);
				this.state = 1010;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1011;
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
			this.state = 1014;
			this.match(SolidCashParser.T__72);
			this.state = 1015;
			this.match(SolidCashParser.T__48);
			this.state = 1016;
			this.returnParam();
			this.state = 1021;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 116, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1017;
					this.match(SolidCashParser.T__4);
					this.state = 1018;
					this.returnParam();
					}
					}
				}
				this.state = 1023;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 116, this._ctx);
			}
			this.state = 1025;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1024;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1027;
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
			this.state = 1059;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 124, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1029;
				this.typeName();
				this.state = 1033;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 118, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1030;
						this.modifier();
						}
						}
					}
					this.state = 1035;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 118, this._ctx);
				}
				this.state = 1037;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1036;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1039;
				this.arrayType(0);
				this.state = 1043;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 120, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1040;
						this.modifier();
						}
						}
					}
					this.state = 1045;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 120, this._ctx);
				}
				this.state = 1047;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1046;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1049;
				this.mappingType();
				this.state = 1053;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 122, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1050;
						this.modifier();
						}
						}
					}
					this.state = 1055;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 122, this._ctx);
				}
				this.state = 1057;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1056;
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
			this.state = 1061;
			this.match(SolidCashParser.T__48);
			this.state = 1073;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1062;
				this.parameter();
				this.state = 1067;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 125, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1063;
						this.match(SolidCashParser.T__4);
						this.state = 1064;
						this.parameter();
						}
						}
					}
					this.state = 1069;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 125, this._ctx);
				}
				this.state = 1071;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1070;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1075;
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
			this.state = 1107;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 134, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1077;
				this.typeName();
				this.state = 1081;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 128, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1078;
						this.modifier();
						}
						}
					}
					this.state = 1083;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 128, this._ctx);
				}
				this.state = 1085;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1084;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1087;
				this.arrayType(0);
				this.state = 1091;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 130, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1088;
						this.modifier();
						}
						}
					}
					this.state = 1093;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 130, this._ctx);
				}
				this.state = 1095;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1094;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1097;
				this.mappingType();
				this.state = 1101;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 132, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1098;
						this.modifier();
						}
						}
					}
					this.state = 1103;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 132, this._ctx);
				}
				this.state = 1105;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1104;
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
			this.state = 1118;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1109;
				this.match(SolidCashParser.T__3);
				this.state = 1113;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
					{
					{
					this.state = 1110;
					this.statement();
					}
					}
					this.state = 1115;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1116;
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
			case 64:
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
				this.state = 1117;
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
			this.state = 1142;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 137, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1120;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1121;
				this.variableDefinition();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1122;
				this.tupleAssignment();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1123;
				this.prefixIncDecStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1124;
				this.timeOpStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1125;
				this.requireStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1126;
				this.ifStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1127;
				this.loopStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1128;
				this.consoleStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1129;
				this.emitStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1130;
				this.returnStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1131;
				this.selfdestructStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1132;
				this.assemblyStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1133;
				this.tryCatchStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1134;
				this.revertStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1135;
				this.assertStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1136;
				this.deleteStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1137;
				this.uncheckedStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1138;
				this.switchStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1139;
				this.breakStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1140;
				this.continueStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1141;
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
			this.state = 1144;
			this.expression(0);
			this.state = 1166;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 139, this._ctx) ) {
			case 1:
				{
				this.state = 1145;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1146;
				this.expression(0);
				}
				break;
			case 2:
				{
				this.state = 1147;
				this.match(SolidCashParser.DotPush);
				this.state = 1148;
				this.match(SolidCashParser.T__48);
				this.state = 1149;
				this.match(SolidCashParser.T__49);
				this.state = 1150;
				this.match(SolidCashParser.T__39);
				this.state = 1151;
				this.expression(0);
				}
				break;
			case 3:
				{
				this.state = 1152;
				this.match(SolidCashParser.DotPush);
				this.state = 1153;
				this.match(SolidCashParser.T__48);
				this.state = 1155;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 1154;
					this.pushArgument();
					}
				}

				this.state = 1157;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 4:
				{
				this.state = 1158;
				this.match(SolidCashParser.DotPop);
				this.state = 1159;
				this.match(SolidCashParser.T__48);
				this.state = 1160;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 5:
				{
				this.state = 1161;
				this.match(SolidCashParser.DotDelete);
				this.state = 1162;
				this.match(SolidCashParser.T__48);
				this.state = 1163;
				this.expression(0);
				this.state = 1164;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
			this.state = 1168;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1170;
			localctx._op = this._input.LT(1);
			_la = this._input.LA(1);
			if(!(_la===84 || _la===85)) {
			    localctx._op = this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			this.state = 1171;
			this.expression(0);
			this.state = 1172;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1203;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 143, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1174;
				this.match(SolidCashParser.T__85);
				this.state = 1175;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1176;
				this.match(SolidCashParser.T__85);
				this.state = 1177;
				this.expression(0);
				this.state = 1182;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1178;
					this.match(SolidCashParser.T__4);
					this.state = 1179;
					this.expression(0);
					}
					}
					this.state = 1184;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1185;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1187;
				this.match(SolidCashParser.T__85);
				this.state = 1188;
				this.match(SolidCashParser.T__48);
				this.state = 1189;
				this.expression(0);
				this.state = 1194;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 141, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1190;
						this.match(SolidCashParser.T__4);
						this.state = 1191;
						this.expression(0);
						}
						}
					}
					this.state = 1196;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 141, this._ctx);
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

				this.state = 1200;
				this.match(SolidCashParser.T__49);
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
	public selfdestructStatement(): SelfdestructStatementContext {
		let localctx: SelfdestructStatementContext = new SelfdestructStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 120, SolidCashParser.RULE_selfdestructStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1205;
			this.match(SolidCashParser.T__30);
			this.state = 1206;
			this.match(SolidCashParser.T__48);
			this.state = 1207;
			this.expression(0);
			this.state = 1208;
			this.match(SolidCashParser.T__49);
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
		this.enterRule(localctx, 122, SolidCashParser.RULE_emitStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1244;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 149, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1211;
				this.match(SolidCashParser.T__86);
				this.state = 1212;
				this.match(SolidCashParser.Identifier);
				this.state = 1215;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1213;
					this.match(SolidCashParser.T__11);
					this.state = 1214;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1217;
				this.match(SolidCashParser.T__48);
				this.state = 1218;
				this.match(SolidCashParser.T__3);
				this.state = 1230;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1219;
					this.namedArg();
					this.state = 1224;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 145, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1220;
							this.match(SolidCashParser.T__4);
							this.state = 1221;
							this.namedArg();
							}
							}
						}
						this.state = 1226;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 145, this._ctx);
					}
					this.state = 1228;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1227;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1232;
				this.match(SolidCashParser.T__5);
				this.state = 1233;
				this.match(SolidCashParser.T__49);
				this.state = 1234;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1235;
				this.match(SolidCashParser.T__86);
				this.state = 1236;
				this.match(SolidCashParser.Identifier);
				this.state = 1239;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1237;
					this.match(SolidCashParser.T__11);
					this.state = 1238;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1241;
				this.expressionList();
				this.state = 1242;
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
	public variableDefinition(): VariableDefinitionContext {
		let localctx: VariableDefinitionContext = new VariableDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 124, SolidCashParser.RULE_variableDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1293;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 157, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1246;
				this.typeName();
				this.state = 1250;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 150, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1247;
						this.modifier();
						}
						}
					}
					this.state = 1252;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 150, this._ctx);
				}
				this.state = 1253;
				this.anyIdentifier();
				this.state = 1261;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1254;
					this.match(SolidCashParser.T__39);
					this.state = 1255;
					this.expression(0);
					this.state = 1259;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===165) {
						{
						this.state = 1256;
						this.match(SolidCashParser.DotPush);
						this.state = 1257;
						this.match(SolidCashParser.T__48);
						this.state = 1258;
						this.match(SolidCashParser.T__49);
						}
					}

					}
				}

				this.state = 1263;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1265;
				this.arrayType(0);
				this.state = 1269;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 153, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1266;
						this.modifier();
						}
						}
					}
					this.state = 1271;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 153, this._ctx);
				}
				this.state = 1272;
				this.anyIdentifier();
				this.state = 1275;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1273;
					this.match(SolidCashParser.T__39);
					this.state = 1274;
					this.expression(0);
					}
				}

				this.state = 1277;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1279;
				this.mappingType();
				this.state = 1283;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 155, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1280;
						this.modifier();
						}
						}
					}
					this.state = 1285;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 155, this._ctx);
				}
				this.state = 1286;
				this.anyIdentifier();
				this.state = 1289;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1287;
					this.match(SolidCashParser.T__39);
					this.state = 1288;
					this.expression(0);
					}
				}

				this.state = 1291;
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
			this.state = 1343;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 162, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1295;
				this.typeName();
				this.state = 1296;
				this.match(SolidCashParser.Identifier);
				this.state = 1301;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1297;
					this.match(SolidCashParser.T__4);
					this.state = 1298;
					this.typeName();
					this.state = 1299;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1303;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1305;
				this.match(SolidCashParser.T__39);
				this.state = 1306;
				this.expression(0);
				this.state = 1307;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1309;
				this.match(SolidCashParser.T__48);
				this.state = 1310;
				this.tupleSlot();
				this.state = 1313;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1311;
					this.match(SolidCashParser.T__4);
					this.state = 1312;
					this.tupleSlot();
					}
					}
					this.state = 1315;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1317;
				this.match(SolidCashParser.T__49);
				this.state = 1318;
				this.match(SolidCashParser.T__39);
				this.state = 1319;
				this.match(SolidCashParser.T__48);
				this.state = 1320;
				this.expression(0);
				this.state = 1323;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1321;
					this.match(SolidCashParser.T__4);
					this.state = 1322;
					this.expression(0);
					}
					}
					this.state = 1325;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1327;
				this.match(SolidCashParser.T__49);
				this.state = 1328;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1330;
				this.match(SolidCashParser.T__48);
				this.state = 1331;
				this.tupleSlot();
				this.state = 1334;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1332;
					this.match(SolidCashParser.T__4);
					this.state = 1333;
					this.tupleSlot();
					}
					}
					this.state = 1336;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1338;
				this.match(SolidCashParser.T__49);
				this.state = 1339;
				this.match(SolidCashParser.T__39);
				this.state = 1340;
				this.expression(0);
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
	public tupleSlot(): TupleSlotContext {
		let localctx: TupleSlotContext = new TupleSlotContext(this, this._ctx, this.state);
		this.enterRule(localctx, 128, SolidCashParser.RULE_tupleSlot);
		try {
			let _alt: number;
			this.state = 1365;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 165, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1345;
				this.typeName();
				this.state = 1349;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 163, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1346;
						this.modifier();
						}
						}
					}
					this.state = 1351;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 163, this._ctx);
				}
				this.state = 1352;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1354;
				this.arrayType(0);
				this.state = 1358;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 164, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1355;
						this.modifier();
						}
						}
					}
					this.state = 1360;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 164, this._ctx);
				}
				this.state = 1361;
				this.anyIdentifier();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1363;
				this.anyIdentifier();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
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
		this.enterRule(localctx, 130, SolidCashParser.RULE_pushArgument);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1367;
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
		this.enterRule(localctx, 132, SolidCashParser.RULE_deleteStatement);
		let _la: number;
		try {
			this.state = 1430;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 171, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1369;
				this.match(SolidCashParser.T__87);
				this.state = 1370;
				this.match(SolidCashParser.Identifier);
				this.state = 1371;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1372;
				this.match(SolidCashParser.T__87);
				this.state = 1373;
				this.match(SolidCashParser.T__88);
				this.state = 1374;
				this.match(SolidCashParser.T__11);
				this.state = 1375;
				this.match(SolidCashParser.Identifier);
				this.state = 1376;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1377;
				this.match(SolidCashParser.T__87);
				this.state = 1378;
				this.match(SolidCashParser.T__88);
				this.state = 1379;
				this.match(SolidCashParser.T__11);
				this.state = 1380;
				this.match(SolidCashParser.Identifier);
				this.state = 1385;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1381;
					this.match(SolidCashParser.T__65);
					this.state = 1382;
					this.expression(0);
					this.state = 1383;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1387;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1389;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1391;
				this.match(SolidCashParser.T__87);
				this.state = 1392;
				this.match(SolidCashParser.Identifier);
				this.state = 1397;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1393;
					this.match(SolidCashParser.T__65);
					this.state = 1394;
					this.expression(0);
					this.state = 1395;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1399;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1401;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				localctx = new DeleteMemberEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1403;
				this.match(SolidCashParser.T__87);
				this.state = 1404;
				this.match(SolidCashParser.Identifier);
				this.state = 1407;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1405;
					this.match(SolidCashParser.T__11);
					this.state = 1406;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1409;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1415;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1411;
					this.match(SolidCashParser.T__65);
					this.state = 1412;
					this.expression(0);
					this.state = 1413;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1417;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1419;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 6:
				localctx = new DeleteMemberContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1421;
				this.match(SolidCashParser.T__87);
				this.state = 1422;
				this.match(SolidCashParser.Identifier);
				this.state = 1425;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1423;
					this.match(SolidCashParser.T__11);
					this.state = 1424;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1427;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1429;
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
		this.enterRule(localctx, 134, SolidCashParser.RULE_timeOpStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1432;
			this.match(SolidCashParser.T__89);
			this.state = 1433;
			this.match(SolidCashParser.T__48);
			this.state = 1434;
			this.match(SolidCashParser.TxVar);
			this.state = 1435;
			this.match(SolidCashParser.T__22);
			this.state = 1436;
			this.expression(0);
			this.state = 1439;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1437;
				this.match(SolidCashParser.T__4);
				this.state = 1438;
				this.requireMessage();
				}
			}

			this.state = 1441;
			this.match(SolidCashParser.T__49);
			this.state = 1442;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 136, SolidCashParser.RULE_requireStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1444;
			this.match(SolidCashParser.T__89);
			this.state = 1445;
			this.match(SolidCashParser.T__48);
			this.state = 1446;
			this.expression(0);
			this.state = 1449;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1447;
				this.match(SolidCashParser.T__4);
				this.state = 1448;
				this.requireMessage();
				}
			}

			this.state = 1451;
			this.match(SolidCashParser.T__49);
			this.state = 1452;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 138, SolidCashParser.RULE_ifStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1454;
			this.match(SolidCashParser.T__90);
			this.state = 1455;
			this.match(SolidCashParser.T__48);
			this.state = 1456;
			this.expression(0);
			this.state = 1457;
			this.match(SolidCashParser.T__49);
			this.state = 1458;
			localctx._ifBlock = this.block();
			this.state = 1461;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 174, this._ctx) ) {
			case 1:
				{
				this.state = 1459;
				this.match(SolidCashParser.T__91);
				this.state = 1460;
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
		this.enterRule(localctx, 140, SolidCashParser.RULE_loopStatement);
		try {
			this.state = 1469;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 175, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1463;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1464;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1465;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1466;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1467;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1468;
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
		this.enterRule(localctx, 142, SolidCashParser.RULE_forOfEntriesStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1471;
			this.match(SolidCashParser.T__8);
			this.state = 1472;
			this.match(SolidCashParser.T__48);
			this.state = 1473;
			this.typeName();
			this.state = 1474;
			this.match(SolidCashParser.Identifier);
			this.state = 1475;
			this.match(SolidCashParser.T__4);
			this.state = 1476;
			this.typeName();
			this.state = 1477;
			this.match(SolidCashParser.Identifier);
			this.state = 1478;
			this.match(SolidCashParser.T__92);
			this.state = 1479;
			this.match(SolidCashParser.T__88);
			this.state = 1480;
			this.match(SolidCashParser.T__11);
			this.state = 1481;
			this.match(SolidCashParser.Identifier);
			this.state = 1482;
			this.match(SolidCashParser.T__11);
			this.state = 1483;
			this.match(SolidCashParser.T__33);
			this.state = 1484;
			this.match(SolidCashParser.T__49);
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
	public forInStatement(): ForInStatementContext {
		let localctx: ForInStatementContext = new ForInStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 144, SolidCashParser.RULE_forInStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1487;
			this.match(SolidCashParser.T__8);
			this.state = 1488;
			this.match(SolidCashParser.T__48);
			this.state = 1489;
			this.typeName();
			this.state = 1490;
			this.match(SolidCashParser.Identifier);
			this.state = 1491;
			this.match(SolidCashParser.T__93);
			this.state = 1492;
			this.match(SolidCashParser.T__88);
			this.state = 1493;
			this.match(SolidCashParser.T__11);
			this.state = 1494;
			this.match(SolidCashParser.Identifier);
			this.state = 1495;
			this.match(SolidCashParser.T__49);
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
	public forOfStatement(): ForOfStatementContext {
		let localctx: ForOfStatementContext = new ForOfStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 146, SolidCashParser.RULE_forOfStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1498;
			this.match(SolidCashParser.T__8);
			this.state = 1499;
			this.match(SolidCashParser.T__48);
			this.state = 1500;
			this.typeName();
			this.state = 1501;
			this.match(SolidCashParser.Identifier);
			this.state = 1502;
			this.match(SolidCashParser.T__92);
			this.state = 1503;
			this.match(SolidCashParser.T__88);
			this.state = 1504;
			this.match(SolidCashParser.T__11);
			this.state = 1505;
			this.match(SolidCashParser.Identifier);
			this.state = 1506;
			this.match(SolidCashParser.T__49);
			this.state = 1507;
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
		this.enterRule(localctx, 148, SolidCashParser.RULE_forStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1509;
			this.match(SolidCashParser.T__8);
			this.state = 1510;
			this.match(SolidCashParser.T__48);
			this.state = 1511;
			this.forInit();
			this.state = 1512;
			this.forCondition();
			this.state = 1514;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===84 || _la===85 || _la===180) {
				{
				this.state = 1513;
				this.forUpdate();
				}
			}

			this.state = 1516;
			this.match(SolidCashParser.T__49);
			this.state = 1517;
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
		this.enterRule(localctx, 150, SolidCashParser.RULE_forInit);
		let _la: number;
		try {
			this.state = 1539;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 179, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1519;
				this.typeName();
				this.state = 1523;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 1520;
					this.modifier();
					}
					}
					this.state = 1525;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1526;
				this.match(SolidCashParser.Identifier);
				this.state = 1529;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1527;
					this.match(SolidCashParser.T__39);
					this.state = 1528;
					this.expression(0);
					}
				}

				this.state = 1531;
				this.match(SolidCashParser.T__1);
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
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1535;
				this.expression(0);
				this.state = 1536;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1538;
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
		this.enterRule(localctx, 152, SolidCashParser.RULE_forCondition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1541;
			this.expression(0);
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
	public forUpdate(): ForUpdateContext {
		let localctx: ForUpdateContext = new ForUpdateContext(this, this._ctx, this.state);
		this.enterRule(localctx, 154, SolidCashParser.RULE_forUpdate);
		let _la: number;
		try {
			this.state = 1551;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 180, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1544;
				this.match(SolidCashParser.Identifier);
				this.state = 1545;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1546;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1547;
				this.match(SolidCashParser.Identifier);
				this.state = 1548;
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
				this.state = 1549;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===84 || _la===85)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1550;
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
		this.enterRule(localctx, 156, SolidCashParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1553;
			this.match(SolidCashParser.T__94);
			this.state = 1554;
			this.block();
			this.state = 1555;
			this.match(SolidCashParser.T__95);
			this.state = 1556;
			this.match(SolidCashParser.T__48);
			this.state = 1557;
			this.expression(0);
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
	public whileStatement(): WhileStatementContext {
		let localctx: WhileStatementContext = new WhileStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 158, SolidCashParser.RULE_whileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1561;
			this.match(SolidCashParser.T__95);
			this.state = 1562;
			this.match(SolidCashParser.T__48);
			this.state = 1563;
			this.expression(0);
			this.state = 1564;
			this.match(SolidCashParser.T__49);
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
		this.enterRule(localctx, 160, SolidCashParser.RULE_consoleStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1567;
			this.match(SolidCashParser.T__96);
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
		this.enterRule(localctx, 162, SolidCashParser.RULE_assemblyStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1571;
			this.match(SolidCashParser.T__97);
			this.state = 1573;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===151) {
				{
				this.state = 1572;
				this.match(SolidCashParser.StringLiteral);
				}
			}

			this.state = 1585;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 1575;
				this.match(SolidCashParser.T__48);
				this.state = 1576;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1581;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1577;
					this.match(SolidCashParser.T__4);
					this.state = 1578;
					this.match(SolidCashParser.StringLiteral);
					}
					}
					this.state = 1583;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1584;
				this.match(SolidCashParser.T__49);
				}
			}

			this.state = 1587;
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
		this.enterRule(localctx, 164, SolidCashParser.RULE_yulBlock);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1589;
			this.match(SolidCashParser.T__3);
			this.state = 1593;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026534544) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 31) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 4579361) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				{
				this.state = 1590;
				this.yulStatement();
				}
				}
				this.state = 1595;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1596;
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
		this.enterRule(localctx, 166, SolidCashParser.RULE_yulStatement);
		try {
			this.state = 1611;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 185, this._ctx) ) {
			case 1:
				localctx = new YulNestedBlockStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1598;
				this.yulBlock();
				}
				break;
			case 2:
				localctx = new YulVarDeclStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1599;
				this.yulVariableDeclaration();
				}
				break;
			case 3:
				localctx = new YulAssignStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1600;
				this.yulAssignment();
				}
				break;
			case 4:
				localctx = new YulIfStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1601;
				this.yulIf();
				}
				break;
			case 5:
				localctx = new YulSwitchStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1602;
				this.yulSwitch();
				}
				break;
			case 6:
				localctx = new YulForStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1603;
				this.yulForLoop();
				}
				break;
			case 7:
				localctx = new YulFunctionDefStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1604;
				this.yulFunctionDefinition();
				}
				break;
			case 8:
				localctx = new YulBreakStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1605;
				this.match(SolidCashParser.T__98);
				}
				break;
			case 9:
				localctx = new YulContinueStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1606;
				this.match(SolidCashParser.T__99);
				}
				break;
			case 10:
				localctx = new YulLeaveStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1607;
				this.match(SolidCashParser.T__100);
				}
				break;
			case 11:
				localctx = new YulCallStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1608;
				this.yulFunctionCall();
				}
				break;
			case 12:
				localctx = new YulPathStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1609;
				this.yulPath();
				}
				break;
			case 13:
				localctx = new YulLiteralStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1610;
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
		this.enterRule(localctx, 168, SolidCashParser.RULE_yulVariableDeclaration);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1613;
			this.match(SolidCashParser.T__101);
			this.state = 1614;
			this.anyIdentifier();
			this.state = 1619;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1615;
				this.match(SolidCashParser.T__4);
				this.state = 1616;
				this.anyIdentifier();
				}
				}
				this.state = 1621;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1624;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===103) {
				{
				this.state = 1622;
				this.match(SolidCashParser.T__102);
				this.state = 1623;
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
		this.enterRule(localctx, 170, SolidCashParser.RULE_yulAssignment);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1626;
			this.yulPath();
			this.state = 1631;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1627;
				this.match(SolidCashParser.T__4);
				this.state = 1628;
				this.yulPath();
				}
				}
				this.state = 1633;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1634;
			this.match(SolidCashParser.T__102);
			this.state = 1635;
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
		this.enterRule(localctx, 172, SolidCashParser.RULE_yulIf);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1637;
			this.match(SolidCashParser.T__90);
			this.state = 1638;
			this.yulExpression();
			this.state = 1639;
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
		this.enterRule(localctx, 174, SolidCashParser.RULE_yulSwitch);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1641;
			this.match(SolidCashParser.T__103);
			this.state = 1642;
			this.yulExpression();
			this.state = 1652;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 105:
				{
				this.state = 1644;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1643;
					this.yulCase();
					}
					}
					this.state = 1646;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===105);
				this.state = 1649;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===106) {
					{
					this.state = 1648;
					this.yulDefault();
					}
				}

				}
				break;
			case 106:
				{
				this.state = 1651;
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
		this.enterRule(localctx, 176, SolidCashParser.RULE_yulCase);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1654;
			this.match(SolidCashParser.T__104);
			this.state = 1655;
			this.yulLiteral();
			this.state = 1656;
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
		this.enterRule(localctx, 178, SolidCashParser.RULE_yulDefault);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1658;
			this.match(SolidCashParser.T__105);
			this.state = 1659;
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
		this.enterRule(localctx, 180, SolidCashParser.RULE_yulForLoop);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1661;
			this.match(SolidCashParser.T__8);
			this.state = 1662;
			this.yulBlock();
			this.state = 1663;
			this.yulExpression();
			this.state = 1664;
			this.yulBlock();
			this.state = 1665;
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
		this.enterRule(localctx, 182, SolidCashParser.RULE_yulFunctionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1667;
			this.match(SolidCashParser.T__6);
			this.state = 1668;
			this.match(SolidCashParser.Identifier);
			this.state = 1669;
			this.match(SolidCashParser.T__48);
			this.state = 1678;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 1670;
				this.match(SolidCashParser.Identifier);
				this.state = 1675;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1671;
					this.match(SolidCashParser.T__4);
					this.state = 1672;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1677;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1680;
			this.match(SolidCashParser.T__49);
			this.state = 1690;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===107) {
				{
				this.state = 1681;
				this.match(SolidCashParser.T__106);
				this.state = 1682;
				this.match(SolidCashParser.Identifier);
				this.state = 1687;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1683;
					this.match(SolidCashParser.T__4);
					this.state = 1684;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1689;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1692;
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
		this.enterRule(localctx, 184, SolidCashParser.RULE_yulExpression);
		try {
			this.state = 1697;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 196, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1694;
				this.yulFunctionCall();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1695;
				this.yulPath();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1696;
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
		this.enterRule(localctx, 186, SolidCashParser.RULE_yulFunctionCall);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1699;
			this.yulFunctionName();
			this.state = 1700;
			this.match(SolidCashParser.T__48);
			this.state = 1709;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===86 || _la===108 || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				this.state = 1701;
				this.yulExpression();
				this.state = 1706;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1702;
					this.match(SolidCashParser.T__4);
					this.state = 1703;
					this.yulExpression();
					}
					}
					this.state = 1708;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1711;
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
		this.enterRule(localctx, 188, SolidCashParser.RULE_yulFunctionName);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1713;
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
		this.enterRule(localctx, 190, SolidCashParser.RULE_yulPath);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1715;
			this.anyIdentifier();
			this.state = 1721;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===12 || _la===164) {
				{
				this.state = 1719;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 12:
					{
					this.state = 1716;
					this.match(SolidCashParser.T__11);
					this.state = 1717;
					this.anyIdentifier();
					}
					break;
				case 164:
					{
					this.state = 1718;
					this.match(SolidCashParser.DotLength);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 1723;
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
		this.enterRule(localctx, 192, SolidCashParser.RULE_yulLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1724;
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
		this.enterRule(localctx, 194, SolidCashParser.RULE_uncheckedStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1726;
			this.match(SolidCashParser.T__108);
			this.state = 1727;
			this.match(SolidCashParser.T__3);
			this.state = 1731;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1728;
				this.statement();
				}
				}
				this.state = 1733;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1734;
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
		this.enterRule(localctx, 196, SolidCashParser.RULE_switchStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1736;
			this.match(SolidCashParser.T__103);
			this.state = 1737;
			this.match(SolidCashParser.T__48);
			this.state = 1738;
			this.expression(0);
			this.state = 1739;
			this.match(SolidCashParser.T__49);
			this.state = 1740;
			this.match(SolidCashParser.T__3);
			this.state = 1744;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===105) {
				{
				{
				this.state = 1741;
				this.switchCase();
				}
				}
				this.state = 1746;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1748;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===106) {
				{
				this.state = 1747;
				this.switchDefault();
				}
			}

			this.state = 1750;
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
		this.enterRule(localctx, 198, SolidCashParser.RULE_switchCase);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1752;
			this.match(SolidCashParser.T__104);
			this.state = 1753;
			this.expression(0);
			this.state = 1754;
			this.match(SolidCashParser.T__109);
			this.state = 1758;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1755;
				this.statement();
				}
				}
				this.state = 1760;
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
		this.enterRule(localctx, 200, SolidCashParser.RULE_switchDefault);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1761;
			this.match(SolidCashParser.T__105);
			this.state = 1762;
			this.match(SolidCashParser.T__109);
			this.state = 1766;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1763;
				this.statement();
				}
				}
				this.state = 1768;
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
		this.enterRule(localctx, 202, SolidCashParser.RULE_tryCatchStatement);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1769;
			this.match(SolidCashParser.T__110);
			this.state = 1770;
			this.expression(0);
			this.state = 1772;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 1771;
				this.tryReturns();
				}
			}

			this.state = 1774;
			localctx._tryBlock = this.block();
			this.state = 1776;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1775;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1778;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 207, this._ctx);
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
		this.enterRule(localctx, 204, SolidCashParser.RULE_tryReturns);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1780;
			this.match(SolidCashParser.T__72);
			this.state = 1781;
			this.match(SolidCashParser.T__48);
			this.state = 1793;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1782;
				this.parameter();
				this.state = 1787;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 208, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1783;
						this.match(SolidCashParser.T__4);
						this.state = 1784;
						this.parameter();
						}
						}
					}
					this.state = 1789;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 208, this._ctx);
				}
				this.state = 1791;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1790;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1795;
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
		this.enterRule(localctx, 206, SolidCashParser.RULE_catchClause);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1797;
			this.match(SolidCashParser.T__111);
			this.state = 1799;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 211, this._ctx) ) {
			case 1:
				{
				this.state = 1798;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 1816;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 215, this._ctx) ) {
			case 1:
				{
				this.state = 1801;
				this.match(SolidCashParser.T__48);
				this.state = 1813;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 1802;
					this.parameter();
					this.state = 1807;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 212, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1803;
							this.match(SolidCashParser.T__4);
							this.state = 1804;
							this.parameter();
							}
							}
						}
						this.state = 1809;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 212, this._ctx);
					}
					this.state = 1811;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1810;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1815;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
			this.state = 1818;
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
		this.enterRule(localctx, 208, SolidCashParser.RULE_breakStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1820;
			this.match(SolidCashParser.T__98);
			this.state = 1821;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 210, SolidCashParser.RULE_continueStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1823;
			this.match(SolidCashParser.T__99);
			this.state = 1824;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 212, SolidCashParser.RULE_requireMessage);
		try {
			this.state = 1829;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 151:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1826;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 180:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1827;
				this.match(SolidCashParser.Identifier);
				this.state = 1828;
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
		this.enterRule(localctx, 214, SolidCashParser.RULE_revertStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1873;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 222, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1831;
				this.match(SolidCashParser.T__35);
				this.state = 1832;
				this.match(SolidCashParser.Identifier);
				this.state = 1835;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1833;
					this.match(SolidCashParser.T__11);
					this.state = 1834;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1837;
				this.match(SolidCashParser.T__48);
				this.state = 1838;
				this.match(SolidCashParser.T__3);
				this.state = 1850;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1839;
					this.namedArg();
					this.state = 1844;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 218, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1840;
							this.match(SolidCashParser.T__4);
							this.state = 1841;
							this.namedArg();
							}
							}
						}
						this.state = 1846;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 218, this._ctx);
					}
					this.state = 1848;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1847;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1852;
				this.match(SolidCashParser.T__5);
				this.state = 1853;
				this.match(SolidCashParser.T__49);
				this.state = 1854;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1855;
				this.match(SolidCashParser.T__35);
				this.state = 1856;
				this.match(SolidCashParser.Identifier);
				this.state = 1859;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1857;
					this.match(SolidCashParser.T__11);
					this.state = 1858;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1861;
				this.expressionList();
				this.state = 1862;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1864;
				this.match(SolidCashParser.T__35);
				this.state = 1865;
				this.match(SolidCashParser.T__48);
				this.state = 1866;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1867;
				this.match(SolidCashParser.T__49);
				this.state = 1868;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1869;
				this.match(SolidCashParser.T__35);
				this.state = 1870;
				this.match(SolidCashParser.T__48);
				this.state = 1871;
				this.match(SolidCashParser.T__49);
				this.state = 1872;
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
		this.enterRule(localctx, 216, SolidCashParser.RULE_assertStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1875;
			this.match(SolidCashParser.T__112);
			this.state = 1876;
			this.match(SolidCashParser.T__48);
			this.state = 1877;
			this.expression(0);
			this.state = 1878;
			this.match(SolidCashParser.T__49);
			this.state = 1879;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 218, SolidCashParser.RULE_consoleParameter);
		try {
			this.state = 1883;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 180:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1881;
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
				this.state = 1882;
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
		this.enterRule(localctx, 220, SolidCashParser.RULE_consoleParameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1885;
			this.match(SolidCashParser.T__48);
			this.state = 1897;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 3152921) !== 0) || _la===180) {
				{
				this.state = 1886;
				this.consoleParameter();
				this.state = 1891;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 224, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1887;
						this.match(SolidCashParser.T__4);
						this.state = 1888;
						this.consoleParameter();
						}
						}
					}
					this.state = 1893;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 224, this._ctx);
				}
				this.state = 1895;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1894;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1899;
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
		this.enterRule(localctx, 222, SolidCashParser.RULE_functionCall);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1925;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 230, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1901;
				this.match(SolidCashParser.Identifier);
				this.state = 1902;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1903;
				this.match(SolidCashParser.Identifier);
				this.state = 1904;
				this.match(SolidCashParser.T__11);
				this.state = 1905;
				this.match(SolidCashParser.Identifier);
				this.state = 1906;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1907;
				this.match(SolidCashParser.Identifier);
				this.state = 1908;
				this.match(SolidCashParser.T__48);
				this.state = 1909;
				this.match(SolidCashParser.T__3);
				this.state = 1921;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1910;
					this.namedArg();
					this.state = 1915;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 227, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1911;
							this.match(SolidCashParser.T__4);
							this.state = 1912;
							this.namedArg();
							}
							}
						}
						this.state = 1917;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 227, this._ctx);
					}
					this.state = 1919;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1918;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1923;
				this.match(SolidCashParser.T__5);
				this.state = 1924;
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
		this.enterRule(localctx, 224, SolidCashParser.RULE_namedArg);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1927;
			this.match(SolidCashParser.Identifier);
			this.state = 1928;
			this.match(SolidCashParser.T__109);
			this.state = 1929;
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
		this.enterRule(localctx, 226, SolidCashParser.RULE_expressionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1931;
			this.match(SolidCashParser.T__48);
			this.state = 1943;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
				{
				this.state = 1932;
				this.expression(0);
				this.state = 1937;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 231, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1933;
						this.match(SolidCashParser.T__4);
						this.state = 1934;
						this.expression(0);
						}
						}
					}
					this.state = 1939;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 231, this._ctx);
				}
				this.state = 1941;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1940;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1945;
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
		this.enterRule(localctx, 228, SolidCashParser.RULE_callOptions);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1947;
			this.match(SolidCashParser.T__3);
			this.state = 1948;
			this.callOption();
			this.state = 1953;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 234, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1949;
					this.match(SolidCashParser.T__4);
					this.state = 1950;
					this.callOption();
					}
					}
				}
				this.state = 1955;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 234, this._ctx);
			}
			this.state = 1957;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1956;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1959;
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
		this.enterRule(localctx, 230, SolidCashParser.RULE_callOption);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1961;
			this.match(SolidCashParser.Identifier);
			this.state = 1962;
			this.match(SolidCashParser.T__109);
			this.state = 1963;
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
		this.enterRule(localctx, 232, SolidCashParser.RULE_typeList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1965;
			this.match(SolidCashParser.T__48);
			this.state = 1966;
			this.typeListItem();
			this.state = 1971;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 236, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1967;
					this.match(SolidCashParser.T__4);
					this.state = 1968;
					this.typeListItem();
					}
					}
				}
				this.state = 1973;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 236, this._ctx);
			}
			this.state = 1975;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1974;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1977;
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
		this.enterRule(localctx, 234, SolidCashParser.RULE_typeListItem);
		try {
			this.state = 1981;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 238, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1979;
				this.typeName();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1980;
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
		let _startState: number = 236;
		this.enterRecursionRule(localctx, 236, SolidCashParser.RULE_expression, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2153;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 247, this._ctx) ) {
			case 1:
				{
				localctx = new AssignmentExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 1984;
				this.match(SolidCashParser.T__48);
				this.state = 1985;
				this.match(SolidCashParser.Identifier);
				this.state = 1986;
				(localctx as AssignmentExpressionContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    (localctx as AssignmentExpressionContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1987;
				this.expression(0);
				this.state = 1988;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				{
				localctx = new InstantiationWithOptionsContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1990;
				this.match(SolidCashParser.T__48);
				this.state = 1991;
				this.match(SolidCashParser.T__113);
				this.state = 1992;
				this.match(SolidCashParser.Identifier);
				this.state = 1993;
				this.match(SolidCashParser.T__49);
				this.state = 1994;
				this.callOptions();
				this.state = 1995;
				this.expressionList();
				}
				break;
			case 3:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1997;
				this.match(SolidCashParser.T__48);
				this.state = 1998;
				this.expression(0);
				this.state = 1999;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 4:
				{
				localctx = new TupleExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2001;
				this.match(SolidCashParser.T__48);
				this.state = 2002;
				this.expression(0);
				this.state = 2005;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2003;
					this.match(SolidCashParser.T__4);
					this.state = 2004;
					this.expression(0);
					}
					}
					this.state = 2007;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2009;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 5:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2011;
				this.typeCast();
				this.state = 2012;
				this.match(SolidCashParser.T__48);
				this.state = 2013;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 2015;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2014;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 2017;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 6:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2019;
				this.functionCall();
				}
				break;
			case 7:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2020;
				this.match(SolidCashParser.T__113);
				this.state = 2021;
				this.match(SolidCashParser.Identifier);
				this.state = 2023;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 2022;
					this.callOptions();
					}
				}

				this.state = 2025;
				this.expressionList();
				}
				break;
			case 8:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2026;
				this.match(SolidCashParser.T__113);
				this.state = 2027;
				this.typeName();
				this.state = 2030;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2028;
					this.match(SolidCashParser.T__65);
					this.state = 2029;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 2032;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 2034;
				this.match(SolidCashParser.T__48);
				this.state = 2035;
				this.expression(0);
				this.state = 2036;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 9:
				{
				localctx = new NewDynamicBytesContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2038;
				this.match(SolidCashParser.T__113);
				this.state = 2039;
				this.match(SolidCashParser.UnboundedBytes);
				this.state = 2040;
				this.match(SolidCashParser.T__48);
				this.state = 2041;
				this.expression(0);
				this.state = 2042;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 10:
				{
				localctx = new NewDynamicStringContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2044;
				this.match(SolidCashParser.T__113);
				this.state = 2045;
				this.match(SolidCashParser.PrimitiveType);
				this.state = 2046;
				this.match(SolidCashParser.T__48);
				this.state = 2047;
				this.expression(0);
				this.state = 2048;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 11:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2050;
				this.match(SolidCashParser.T__54);
				this.state = 2051;
				this.match(SolidCashParser.T__48);
				this.state = 2052;
				this.typeName();
				this.state = 2053;
				this.match(SolidCashParser.T__49);
				this.state = 2054;
				this.match(SolidCashParser.T__11);
				this.state = 2055;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 12:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2057;
				this.match(SolidCashParser.T__114);
				this.state = 2058;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2059;
				this.match(SolidCashParser.T__115);
				this.state = 2060;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2061;
				this.match(SolidCashParser.T__116);
				this.state = 2062;
				this.expressionList();
				}
				break;
			case 15:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2063;
				this.match(SolidCashParser.T__117);
				this.state = 2064;
				this.expressionList();
				}
				break;
			case 16:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2065;
				this.match(SolidCashParser.T__118);
				this.state = 2066;
				this.match(SolidCashParser.T__48);
				this.state = 2067;
				_la = this._input.LA(1);
				if(!(_la===89 || _la===180)) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2068;
				this.match(SolidCashParser.T__11);
				this.state = 2069;
				this.match(SolidCashParser.Identifier);
				this.state = 2070;
				this.match(SolidCashParser.T__4);
				this.state = 2071;
				this.expressionList();
				this.state = 2072;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 17:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2074;
				this.match(SolidCashParser.T__119);
				this.state = 2075;
				this.expressionList();
				}
				break;
			case 18:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2076;
				this.match(SolidCashParser.T__120);
				this.state = 2077;
				this.expressionList();
				}
				break;
			case 19:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2078;
				this.match(SolidCashParser.T__121);
				this.state = 2079;
				this.match(SolidCashParser.T__48);
				this.state = 2080;
				this.expression(0);
				this.state = 2081;
				this.match(SolidCashParser.T__4);
				this.state = 2082;
				this.typeList();
				this.state = 2083;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 20:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2085;
				this.match(SolidCashParser.T__122);
				this.state = 2086;
				this.match(SolidCashParser.T__48);
				this.state = 2087;
				this.expression(0);
				this.state = 2088;
				this.match(SolidCashParser.T__4);
				this.state = 2089;
				this.typeList();
				this.state = 2090;
				this.match(SolidCashParser.T__4);
				this.state = 2091;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 2092;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 21:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2094;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__123);
				this.state = 2095;
				this.match(SolidCashParser.T__65);
				this.state = 2096;
				this.expression(0);
				this.state = 2097;
				this.match(SolidCashParser.T__66);
				this.state = 2098;
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
			case 22:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2100;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__124);
				this.state = 2101;
				this.match(SolidCashParser.T__65);
				this.state = 2102;
				this.expression(0);
				this.state = 2103;
				this.match(SolidCashParser.T__66);
				this.state = 2104;
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
			case 23:
				{
				localctx = new PrefixOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2106;
				(localctx as PrefixOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===84 || _la===85)) {
				    (localctx as PrefixOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2107;
				this.expression(22);
				}
				break;
			case 24:
				{
				localctx = new UnaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2108;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===127)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2109;
				this.expression(21);
				}
				break;
			case 25:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2110;
				this.match(SolidCashParser.T__65);
				this.state = 2122;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 2111;
					this.expression(0);
					this.state = 2116;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 243, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2112;
							this.match(SolidCashParser.T__4);
							this.state = 2113;
							this.expression(0);
							}
							}
						}
						this.state = 2118;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 243, this._ctx);
					}
					this.state = 2120;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2119;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2124;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 26:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2125;
				this.match(SolidCashParser.T__88);
				this.state = 2126;
				this.match(SolidCashParser.T__11);
				this.state = 2127;
				this.match(SolidCashParser.Identifier);
				this.state = 2128;
				this.match(SolidCashParser.T__11);
				this.state = 2129;
				this.match(SolidCashParser.Identifier);
				this.state = 2130;
				this.match(SolidCashParser.T__65);
				this.state = 2131;
				this.expression(0);
				this.state = 2132;
				this.match(SolidCashParser.T__66);
				this.state = 2133;
				this.memberName();
				}
				break;
			case 27:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2135;
				this.match(SolidCashParser.T__88);
				this.state = 2136;
				this.match(SolidCashParser.T__11);
				this.state = 2137;
				this.match(SolidCashParser.Identifier);
				this.state = 2142;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2138;
						this.match(SolidCashParser.T__65);
						this.state = 2139;
						this.expression(0);
						this.state = 2140;
						this.match(SolidCashParser.T__66);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2144;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 246, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 28:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2146;
				this.match(SolidCashParser.T__88);
				this.state = 2147;
				this.match(SolidCashParser.T__11);
				this.state = 2148;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 29:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2149;
				this.match(SolidCashParser.T__88);
				}
				break;
			case 30:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2150;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 31:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2151;
				this.anyIdentifier();
				}
				break;
			case 32:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2152;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2265;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 256, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2263;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 255, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2155;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 2156;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 2157;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2158;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 2159;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2160;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2161;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 2162;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2163;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2164;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 2165;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===128 || _la===129)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2166;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2167;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 2168;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2169;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2170;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2171;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2172;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2173;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2174;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2175;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2176;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2177;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2178;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2179;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2180;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2181;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2182;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2183;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__129);
						this.state = 2184;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2185;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2186;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__130);
						this.state = 2187;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2188;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 2189;
						this.match(SolidCashParser.T__131);
						this.state = 2190;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 2191;
						this.match(SolidCashParser.T__109);
						this.state = 2192;
						(localctx as TernaryOpContext)._ifFalse = this.expression(9);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2194;
						if (!(this.precpred(this._ctx, 34))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 34)");
						}
						this.state = 2195;
						this.match(SolidCashParser.T__65);
						this.state = 2197;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
							{
							this.state = 2196;
							(localctx as IndexRangeSliceContext)._start = this.expression(0);
							}
						}

						this.state = 2199;
						this.match(SolidCashParser.T__109);
						this.state = 2201;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
							{
							this.state = 2200;
							(localctx as IndexRangeSliceContext)._end = this.expression(0);
							}
						}

						this.state = 2203;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2204;
						if (!(this.precpred(this._ctx, 33))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 33)");
						}
						this.state = 2205;
						this.match(SolidCashParser.T__65);
						this.state = 2206;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2207;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2208;
						if (!(this.precpred(this._ctx, 32))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 32)");
						}
						this.state = 2209;
						this.match(SolidCashParser.T__65);
						this.state = 2210;
						this.expression(0);
						this.state = 2211;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2213;
						if (!(this.precpred(this._ctx, 29))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 29)");
						}
						this.state = 2214;
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
						this.state = 2215;
						if (!(this.precpred(this._ctx, 28))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 28)");
						}
						this.state = 2216;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.DotSplit);
						this.state = 2217;
						this.match(SolidCashParser.T__48);
						this.state = 2218;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2219;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2221;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2222;
						this.match(SolidCashParser.DotSlice);
						this.state = 2223;
						this.match(SolidCashParser.T__48);
						this.state = 2224;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2225;
						this.match(SolidCashParser.T__4);
						this.state = 2226;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2227;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2229;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2230;
						this.match(SolidCashParser.T__11);
						this.state = 2231;
						this.match(SolidCashParser.Identifier);
						this.state = 2233;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2232;
							this.callOptions();
							}
						}

						this.state = 2235;
						this.match(SolidCashParser.T__48);
						this.state = 2236;
						this.match(SolidCashParser.T__3);
						this.state = 2248;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===180) {
							{
							this.state = 2237;
							this.namedArg();
							this.state = 2242;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 251, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2238;
									this.match(SolidCashParser.T__4);
									this.state = 2239;
									this.namedArg();
									}
									}
								}
								this.state = 2244;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 251, this._ctx);
							}
							this.state = 2246;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2245;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2250;
						this.match(SolidCashParser.T__5);
						this.state = 2251;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 20:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2252;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2253;
						this.match(SolidCashParser.T__11);
						this.state = 2254;
						this.match(SolidCashParser.Identifier);
						this.state = 2256;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2255;
							this.callOptions();
							}
						}

						this.state = 2258;
						this.expressionList();
						}
						break;
					case 21:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2259;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2260;
						this.memberName();
						}
						break;
					case 22:
						{
						localctx = new PostfixOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2261;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2262;
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
				this.state = 2267;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 256, this._ctx);
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
		this.enterRule(localctx, 238, SolidCashParser.RULE_memberName);
		try {
			this.state = 2281;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2268;
				this.match(SolidCashParser.T__11);
				this.state = 2269;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2270;
				this.match(SolidCashParser.DotValue);
				}
				break;
			case 172:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2271;
				this.match(SolidCashParser.DotLockingBytecode);
				}
				break;
			case 173:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2272;
				this.match(SolidCashParser.DotTokenCategory);
				}
				break;
			case 174:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2273;
				this.match(SolidCashParser.DotNftCommitment);
				}
				break;
			case 175:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2274;
				this.match(SolidCashParser.DotTokenAmount);
				}
				break;
			case 176:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2275;
				this.match(SolidCashParser.DotOutpointTransactionHash);
				}
				break;
			case 177:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2276;
				this.match(SolidCashParser.DotOutpointIndex);
				}
				break;
			case 178:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2277;
				this.match(SolidCashParser.DotUnlockingBytecode);
				}
				break;
			case 179:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2278;
				this.match(SolidCashParser.DotSequenceNumber);
				}
				break;
			case 170:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2279;
				this.match(SolidCashParser.DotCode);
				}
				break;
			case 171:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2280;
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
		this.enterRule(localctx, 240, SolidCashParser.RULE_modifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2283;
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
		this.enterRule(localctx, 242, SolidCashParser.RULE_literal);
		try {
			let _alt: number;
			this.state = 2299;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 141:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2285;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 145:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2286;
				this.numberLiteral();
				}
				break;
			case 144:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2287;
				this.decimalLiteral();
				}
				break;
			case 151:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2288;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2292;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 258, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2289;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2294;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 258, this._ctx);
				}
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2295;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2296;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 152:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2297;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 153:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2298;
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
		this.enterRule(localctx, 244, SolidCashParser.RULE_numberLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2301;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2303;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 260, this._ctx) ) {
			case 1:
				{
				this.state = 2302;
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
		this.enterRule(localctx, 246, SolidCashParser.RULE_decimalLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2305;
			this.match(SolidCashParser.DecimalLiteral);
			this.state = 2307;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 261, this._ctx) ) {
			case 1:
				{
				this.state = 2306;
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
		this.enterRule(localctx, 248, SolidCashParser.RULE_typeName);
		let _la: number;
		try {
			let _alt: number;
			this.state = 2359;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 267, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2309;
				this.match(SolidCashParser.T__107);
				this.state = 2310;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2311;
				this.match(SolidCashParser.T__107);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2312;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2313;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2314;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2315;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2316;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2317;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2318;
				this.match(SolidCashParser.T__137);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2319;
				this.match(SolidCashParser.T__138);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2320;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2321;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2322;
				this.match(SolidCashParser.T__6);
				this.state = 2323;
				this.match(SolidCashParser.T__48);
				this.state = 2332;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 2324;
					this.typeName();
					this.state = 2329;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2325;
						this.match(SolidCashParser.T__4);
						this.state = 2326;
						this.typeName();
						}
						}
						this.state = 2331;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2334;
				this.match(SolidCashParser.T__49);
				this.state = 2338;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 264, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2335;
						_la = this._input.LA(1);
						if(!(((((_la - 44)) & ~0x1F) === 0 && ((1 << (_la - 44)) & 201375745) !== 0))) {
						this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						}
						}
					}
					this.state = 2340;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 264, this._ctx);
				}
				this.state = 2353;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===73) {
					{
					this.state = 2341;
					this.match(SolidCashParser.T__72);
					this.state = 2342;
					this.match(SolidCashParser.T__48);
					this.state = 2343;
					this.typeName();
					this.state = 2348;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2344;
						this.match(SolidCashParser.T__4);
						this.state = 2345;
						this.typeName();
						}
						}
						this.state = 2350;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2351;
					this.match(SolidCashParser.T__49);
					}
				}

				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2355;
				this.match(SolidCashParser.Identifier);
				this.state = 2356;
				this.match(SolidCashParser.T__11);
				this.state = 2357;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 2358;
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
		this.enterRule(localctx, 250, SolidCashParser.RULE_typeCast);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2361;
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
		case 118:
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
			return this.precpred(this._ctx, 34);
		case 15:
			return this.precpred(this._ctx, 33);
		case 16:
			return this.precpred(this._ctx, 32);
		case 17:
			return this.precpred(this._ctx, 29);
		case 18:
			return this.precpred(this._ctx, 28);
		case 19:
			return this.precpred(this._ctx, 27);
		case 20:
			return this.precpred(this._ctx, 26);
		case 21:
			return this.precpred(this._ctx, 25);
		case 22:
			return this.precpred(this._ctx, 24);
		case 23:
			return this.precpred(this._ctx, 23);
		}
		return true;
	}

	public static readonly _serializedATN: number[] = [4,1,183,2364,2,0,7,0,
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
	7,121,2,122,7,122,2,123,7,123,2,124,7,124,2,125,7,125,1,0,5,0,254,8,0,10,
	0,12,0,257,9,0,1,0,5,0,260,8,0,10,0,12,0,263,9,0,1,0,1,0,1,0,1,0,1,0,1,
	0,1,0,1,0,1,0,1,0,1,0,5,0,276,8,0,10,0,12,0,279,9,0,1,0,1,0,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,5,1,296,8,1,10,1,12,1,299,9,1,1,
	1,3,1,302,8,1,1,1,1,1,1,1,1,1,1,1,3,1,309,8,1,1,2,1,2,1,2,3,2,314,8,2,1,
	3,1,3,1,3,1,3,5,3,320,8,3,10,3,12,3,323,9,3,1,3,3,3,326,8,3,1,3,1,3,5,3,
	330,8,3,10,3,12,3,333,9,3,1,3,1,3,1,4,1,4,1,4,1,4,1,4,1,4,1,4,3,4,344,8,
	4,1,4,3,4,347,8,4,1,4,1,4,1,4,1,4,1,4,1,4,5,4,355,8,4,10,4,12,4,358,9,4,
	1,4,3,4,361,8,4,1,4,1,4,1,4,1,4,1,4,1,4,3,4,369,8,4,1,4,3,4,372,8,4,1,4,
	1,4,3,4,376,8,4,1,5,1,5,1,5,3,5,381,8,5,1,5,1,5,3,5,385,8,5,1,6,1,6,1,7,
	1,7,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,5,8,399,8,8,10,8,12,8,402,9,8,1,8,3,
	8,405,8,8,1,9,1,9,1,10,4,10,410,8,10,11,10,12,10,411,1,10,3,10,415,8,10,
	1,11,3,11,418,8,11,1,11,1,11,1,12,1,12,1,13,1,13,1,13,1,13,1,13,1,13,5,
	13,430,8,13,10,13,12,13,433,9,13,3,13,435,8,13,1,13,1,13,1,13,1,13,1,13,
	1,13,1,13,1,13,1,13,5,13,446,8,13,10,13,12,13,449,9,13,1,13,1,13,1,14,1,
	14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,3,14,463,8,14,1,15,1,15,1,15,
	1,15,1,15,1,16,1,16,1,17,1,17,1,17,1,17,5,17,476,8,17,10,17,12,17,479,9,
	17,1,17,3,17,482,8,17,1,17,1,17,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,
	1,18,1,18,1,18,1,18,5,18,498,8,18,10,18,12,18,501,9,18,1,18,1,18,1,19,3,
	19,506,8,19,1,19,1,19,1,19,3,19,511,8,19,1,19,1,19,1,19,1,19,5,19,517,8,
	19,10,19,12,19,520,9,19,3,19,522,8,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,
	1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,5,19,539,8,19,10,19,12,19,542,9,
	19,1,19,1,19,1,20,1,20,3,20,548,8,20,1,21,1,21,1,21,1,21,1,21,5,21,555,
	8,21,10,21,12,21,558,9,21,1,21,3,21,561,8,21,1,21,1,21,1,22,1,22,1,22,1,
	22,1,22,1,22,5,22,571,8,22,10,22,12,22,574,9,22,1,22,3,22,577,8,22,3,22,
	579,8,22,1,22,1,22,3,22,583,8,22,1,22,1,22,1,23,1,23,3,23,589,8,23,1,23,
	3,23,592,8,23,1,23,3,23,595,8,23,1,24,1,24,1,24,1,24,1,24,1,24,5,24,603,
	8,24,10,24,12,24,606,9,24,1,24,3,24,609,8,24,3,24,611,8,24,1,24,1,24,1,
	24,1,25,1,25,3,25,618,8,25,1,25,1,25,3,25,622,8,25,3,25,624,8,25,1,26,1,
	26,1,26,1,26,4,26,630,8,26,11,26,12,26,631,1,26,1,26,1,27,1,27,1,27,3,27,
	639,8,27,1,27,1,27,1,27,1,28,1,28,1,28,1,28,1,28,1,28,5,28,650,8,28,10,
	28,12,28,653,9,28,1,28,3,28,656,8,28,1,28,1,28,1,29,1,29,1,29,3,29,663,
	8,29,1,30,1,30,1,30,1,30,1,30,1,30,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,
	32,1,32,1,32,5,32,681,8,32,10,32,12,32,684,9,32,1,32,5,32,687,8,32,10,32,
	12,32,690,9,32,1,32,5,32,693,8,32,10,32,12,32,696,9,32,1,32,1,32,5,32,700,
	8,32,10,32,12,32,703,9,32,1,32,1,32,1,33,1,33,1,33,5,33,710,8,33,10,33,
	12,33,713,9,33,1,33,1,33,5,33,717,8,33,10,33,12,33,720,9,33,1,33,5,33,723,
	8,33,10,33,12,33,726,9,33,1,33,3,33,729,8,33,1,33,1,33,5,33,733,8,33,10,
	33,12,33,736,9,33,1,33,1,33,1,34,1,34,1,34,3,34,743,8,34,1,35,1,35,1,35,
	1,35,5,35,749,8,35,10,35,12,35,752,9,35,1,35,1,35,5,35,756,8,35,10,35,12,
	35,759,9,35,1,35,1,35,5,35,763,8,35,10,35,12,35,766,9,35,1,35,1,35,5,35,
	770,8,35,10,35,12,35,773,9,35,1,35,1,35,1,36,1,36,3,36,779,8,36,1,37,1,
	37,1,37,1,38,3,38,785,8,38,1,38,1,38,1,38,5,38,790,8,38,10,38,12,38,793,
	9,38,1,38,1,38,1,38,3,38,798,8,38,1,38,1,38,1,38,1,38,1,38,5,38,805,8,38,
	10,38,12,38,808,9,38,1,38,1,38,1,38,5,38,813,8,38,10,38,12,38,816,9,38,
	1,38,1,38,1,38,3,38,821,8,38,1,38,1,38,1,38,3,38,826,8,38,1,38,1,38,5,38,
	830,8,38,10,38,12,38,833,9,38,1,38,1,38,1,38,1,38,3,38,839,8,38,1,38,1,
	38,5,38,843,8,38,10,38,12,38,846,9,38,1,38,1,38,1,38,3,38,851,8,38,1,38,
	1,38,3,38,855,8,38,1,39,1,39,1,39,3,39,860,8,39,1,40,1,40,1,41,1,41,1,41,
	1,41,3,41,868,8,41,1,41,1,41,1,41,3,41,873,8,41,1,41,1,41,1,41,1,41,1,41,
	1,41,3,41,881,8,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,3,41,891,8,41,
	1,41,1,41,1,41,3,41,896,8,41,1,41,1,41,3,41,900,8,41,1,42,1,42,1,42,1,42,
	1,42,1,42,1,42,1,42,1,42,1,42,3,42,912,8,42,1,42,1,42,1,42,1,42,1,42,1,
	42,1,42,5,42,921,8,42,10,42,12,42,924,9,42,1,43,1,43,1,43,3,43,929,8,43,
	1,43,1,43,5,43,933,8,43,10,43,12,43,936,9,43,1,43,1,43,5,43,940,8,43,10,
	43,12,43,943,9,43,1,43,1,43,1,44,1,44,3,44,949,8,44,1,45,1,45,1,45,1,46,
	1,46,1,46,1,46,1,46,5,46,959,8,46,10,46,12,46,962,9,46,1,46,3,46,965,8,
	46,1,46,1,46,5,46,969,8,46,10,46,12,46,972,9,46,1,46,1,46,1,47,1,47,3,47,
	978,8,47,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,
	48,1,48,3,48,994,8,48,1,49,1,49,1,49,1,49,1,49,5,49,1001,8,49,10,49,12,
	49,1004,9,49,1,49,3,49,1007,8,49,1,50,1,50,1,50,1,50,3,50,1013,8,50,1,51,
	1,51,1,51,1,51,1,51,5,51,1020,8,51,10,51,12,51,1023,9,51,1,51,3,51,1026,
	8,51,1,51,1,51,1,52,1,52,5,52,1032,8,52,10,52,12,52,1035,9,52,1,52,3,52,
	1038,8,52,1,52,1,52,5,52,1042,8,52,10,52,12,52,1045,9,52,1,52,3,52,1048,
	8,52,1,52,1,52,5,52,1052,8,52,10,52,12,52,1055,9,52,1,52,3,52,1058,8,52,
	3,52,1060,8,52,1,53,1,53,1,53,1,53,5,53,1066,8,53,10,53,12,53,1069,9,53,
	1,53,3,53,1072,8,53,3,53,1074,8,53,1,53,1,53,1,54,1,54,5,54,1080,8,54,10,
	54,12,54,1083,9,54,1,54,3,54,1086,8,54,1,54,1,54,5,54,1090,8,54,10,54,12,
	54,1093,9,54,1,54,3,54,1096,8,54,1,54,1,54,5,54,1100,8,54,10,54,12,54,1103,
	9,54,1,54,3,54,1106,8,54,3,54,1108,8,54,1,55,1,55,5,55,1112,8,55,10,55,
	12,55,1115,9,55,1,55,1,55,3,55,1119,8,55,1,56,1,56,1,56,1,56,1,56,1,56,
	1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,
	56,1,56,3,56,1143,8,56,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,
	1,57,3,57,1156,8,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,3,57,1167,
	8,57,1,57,1,57,1,58,1,58,1,58,1,58,1,59,1,59,1,59,1,59,1,59,1,59,5,59,1181,
	8,59,10,59,12,59,1184,9,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,5,59,1193,
	8,59,10,59,12,59,1196,9,59,1,59,3,59,1199,8,59,1,59,1,59,1,59,3,59,1204,
	8,59,1,60,1,60,1,60,1,60,1,60,1,60,1,61,1,61,1,61,1,61,3,61,1216,8,61,1,
	61,1,61,1,61,1,61,1,61,5,61,1223,8,61,10,61,12,61,1226,9,61,1,61,3,61,1229,
	8,61,3,61,1231,8,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,3,61,1240,8,61,1,
	61,1,61,1,61,3,61,1245,8,61,1,62,1,62,5,62,1249,8,62,10,62,12,62,1252,9,
	62,1,62,1,62,1,62,1,62,1,62,1,62,3,62,1260,8,62,3,62,1262,8,62,1,62,1,62,
	1,62,1,62,5,62,1268,8,62,10,62,12,62,1271,9,62,1,62,1,62,1,62,3,62,1276,
	8,62,1,62,1,62,1,62,1,62,5,62,1282,8,62,10,62,12,62,1285,9,62,1,62,1,62,
	1,62,3,62,1290,8,62,1,62,1,62,3,62,1294,8,62,1,63,1,63,1,63,1,63,1,63,1,
	63,4,63,1302,8,63,11,63,12,63,1303,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,
	63,4,63,1314,8,63,11,63,12,63,1315,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1324,
	8,63,11,63,12,63,1325,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1335,8,63,
	11,63,12,63,1336,1,63,1,63,1,63,1,63,1,63,3,63,1344,8,63,1,64,1,64,5,64,
	1348,8,64,10,64,12,64,1351,9,64,1,64,1,64,1,64,1,64,5,64,1357,8,64,10,64,
	12,64,1360,9,64,1,64,1,64,1,64,1,64,3,64,1366,8,64,1,65,1,65,1,66,1,66,
	1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,4,
	66,1386,8,66,11,66,12,66,1387,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,4,
	66,1398,8,66,11,66,12,66,1399,1,66,1,66,1,66,1,66,1,66,1,66,4,66,1408,8,
	66,11,66,12,66,1409,1,66,1,66,1,66,1,66,4,66,1416,8,66,11,66,12,66,1417,
	1,66,1,66,1,66,1,66,1,66,1,66,4,66,1426,8,66,11,66,12,66,1427,1,66,3,66,
	1431,8,66,1,67,1,67,1,67,1,67,1,67,1,67,1,67,3,67,1440,8,67,1,67,1,67,1,
	67,1,68,1,68,1,68,1,68,1,68,3,68,1450,8,68,1,68,1,68,1,68,1,69,1,69,1,69,
	1,69,1,69,1,69,1,69,3,69,1462,8,69,1,70,1,70,1,70,1,70,1,70,1,70,3,70,1470,
	8,70,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,
	71,1,71,1,71,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,73,
	1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,74,1,74,1,74,1,74,1,
	74,3,74,1515,8,74,1,74,1,74,1,74,1,75,1,75,5,75,1522,8,75,10,75,12,75,1525,
	9,75,1,75,1,75,1,75,3,75,1530,8,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,
	75,3,75,1540,8,75,1,76,1,76,1,76,1,77,1,77,1,77,1,77,1,77,1,77,1,77,3,77,
	1552,8,77,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,79,1,79,1,79,1,79,1,
	79,1,79,1,80,1,80,1,80,1,80,1,81,1,81,3,81,1574,8,81,1,81,1,81,1,81,1,81,
	5,81,1580,8,81,10,81,12,81,1583,9,81,1,81,3,81,1586,8,81,1,81,1,81,1,82,
	1,82,5,82,1592,8,82,10,82,12,82,1595,9,82,1,82,1,82,1,83,1,83,1,83,1,83,
	1,83,1,83,1,83,1,83,1,83,1,83,1,83,1,83,1,83,3,83,1612,8,83,1,84,1,84,1,
	84,1,84,5,84,1618,8,84,10,84,12,84,1621,9,84,1,84,1,84,3,84,1625,8,84,1,
	85,1,85,1,85,5,85,1630,8,85,10,85,12,85,1633,9,85,1,85,1,85,1,85,1,86,1,
	86,1,86,1,86,1,87,1,87,1,87,4,87,1645,8,87,11,87,12,87,1646,1,87,3,87,1650,
	8,87,1,87,3,87,1653,8,87,1,88,1,88,1,88,1,88,1,89,1,89,1,89,1,90,1,90,1,
	90,1,90,1,90,1,90,1,91,1,91,1,91,1,91,1,91,1,91,5,91,1674,8,91,10,91,12,
	91,1677,9,91,3,91,1679,8,91,1,91,1,91,1,91,1,91,1,91,5,91,1686,8,91,10,
	91,12,91,1689,9,91,3,91,1691,8,91,1,91,1,91,1,92,1,92,1,92,3,92,1698,8,
	92,1,93,1,93,1,93,1,93,1,93,5,93,1705,8,93,10,93,12,93,1708,9,93,3,93,1710,
	8,93,1,93,1,93,1,94,1,94,1,95,1,95,1,95,1,95,5,95,1720,8,95,10,95,12,95,
	1723,9,95,1,96,1,96,1,97,1,97,1,97,5,97,1730,8,97,10,97,12,97,1733,9,97,
	1,97,1,97,1,98,1,98,1,98,1,98,1,98,1,98,5,98,1743,8,98,10,98,12,98,1746,
	9,98,1,98,3,98,1749,8,98,1,98,1,98,1,99,1,99,1,99,1,99,5,99,1757,8,99,10,
	99,12,99,1760,9,99,1,100,1,100,1,100,5,100,1765,8,100,10,100,12,100,1768,
	9,100,1,101,1,101,1,101,3,101,1773,8,101,1,101,1,101,4,101,1777,8,101,11,
	101,12,101,1778,1,102,1,102,1,102,1,102,1,102,5,102,1786,8,102,10,102,12,
	102,1789,9,102,1,102,3,102,1792,8,102,3,102,1794,8,102,1,102,1,102,1,103,
	1,103,3,103,1800,8,103,1,103,1,103,1,103,1,103,5,103,1806,8,103,10,103,
	12,103,1809,9,103,1,103,3,103,1812,8,103,3,103,1814,8,103,1,103,3,103,1817,
	8,103,1,103,1,103,1,104,1,104,1,104,1,105,1,105,1,105,1,106,1,106,1,106,
	3,106,1830,8,106,1,107,1,107,1,107,1,107,3,107,1836,8,107,1,107,1,107,1,
	107,1,107,1,107,5,107,1843,8,107,10,107,12,107,1846,9,107,1,107,3,107,1849,
	8,107,3,107,1851,8,107,1,107,1,107,1,107,1,107,1,107,1,107,1,107,3,107,
	1860,8,107,1,107,1,107,1,107,1,107,1,107,1,107,1,107,1,107,1,107,1,107,
	1,107,1,107,3,107,1874,8,107,1,108,1,108,1,108,1,108,1,108,1,108,1,109,
	1,109,3,109,1884,8,109,1,110,1,110,1,110,1,110,5,110,1890,8,110,10,110,
	12,110,1893,9,110,1,110,3,110,1896,8,110,3,110,1898,8,110,1,110,1,110,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,5,
	111,1914,8,111,10,111,12,111,1917,9,111,1,111,3,111,1920,8,111,3,111,1922,
	8,111,1,111,1,111,3,111,1926,8,111,1,112,1,112,1,112,1,112,1,113,1,113,
	1,113,1,113,5,113,1936,8,113,10,113,12,113,1939,9,113,1,113,3,113,1942,
	8,113,3,113,1944,8,113,1,113,1,113,1,114,1,114,1,114,1,114,5,114,1952,8,
	114,10,114,12,114,1955,9,114,1,114,3,114,1958,8,114,1,114,1,114,1,115,1,
	115,1,115,1,115,1,116,1,116,1,116,1,116,5,116,1970,8,116,10,116,12,116,
	1973,9,116,1,116,3,116,1976,8,116,1,116,1,116,1,117,1,117,3,117,1982,8,
	117,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,
	118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,4,118,2006,
	8,118,11,118,12,118,2007,1,118,1,118,1,118,1,118,1,118,1,118,3,118,2016,
	8,118,1,118,1,118,1,118,1,118,1,118,1,118,3,118,2024,8,118,1,118,1,118,
	1,118,1,118,1,118,4,118,2031,8,118,11,118,12,118,2032,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,5,118,2115,8,118,10,118,12,118,2118,9,118,
	1,118,3,118,2121,8,118,3,118,2123,8,118,1,118,1,118,1,118,1,118,1,118,1,
	118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,
	118,4,118,2143,8,118,11,118,12,118,2144,1,118,1,118,1,118,1,118,1,118,1,
	118,1,118,3,118,2154,8,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,
	118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,
	118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,
	118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,3,118,2198,
	8,118,1,118,1,118,3,118,2202,8,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	3,118,2234,8,118,1,118,1,118,1,118,1,118,1,118,5,118,2241,8,118,10,118,
	12,118,2244,9,118,1,118,3,118,2247,8,118,3,118,2249,8,118,1,118,1,118,1,
	118,1,118,1,118,1,118,3,118,2257,8,118,1,118,1,118,1,118,1,118,1,118,5,
	118,2264,8,118,10,118,12,118,2267,9,118,1,119,1,119,1,119,1,119,1,119,1,
	119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,3,119,2282,8,119,1,120,1,
	120,1,121,1,121,1,121,1,121,1,121,5,121,2291,8,121,10,121,12,121,2294,9,
	121,1,121,1,121,1,121,1,121,3,121,2300,8,121,1,122,1,122,3,122,2304,8,122,
	1,123,1,123,3,123,2308,8,123,1,124,1,124,1,124,1,124,1,124,1,124,1,124,
	1,124,1,124,1,124,1,124,1,124,1,124,1,124,1,124,1,124,1,124,1,124,5,124,
	2328,8,124,10,124,12,124,2331,9,124,3,124,2333,8,124,1,124,1,124,5,124,
	2337,8,124,10,124,12,124,2340,9,124,1,124,1,124,1,124,1,124,1,124,5,124,
	2347,8,124,10,124,12,124,2350,9,124,1,124,1,124,3,124,2354,8,124,1,124,
	1,124,1,124,1,124,3,124,2360,8,124,1,125,1,125,1,125,0,2,84,236,126,0,2,
	4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,
	54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,
	102,104,106,108,110,112,114,116,118,120,122,124,126,128,130,132,134,136,
	138,140,142,144,146,148,150,152,154,156,158,160,162,164,166,168,170,172,
	174,176,178,180,182,184,186,188,190,192,194,196,198,200,202,204,206,208,
	210,212,214,216,218,220,222,224,226,228,230,232,234,236,238,240,242,244,
	246,248,250,0,28,2,0,10,10,13,27,5,0,11,11,28,36,143,143,147,147,180,180,
	5,0,38,38,140,140,145,145,151,151,180,180,1,0,38,39,2,0,140,140,144,144,
	3,0,20,23,26,27,40,40,1,0,43,44,2,0,43,44,58,59,3,0,43,44,58,58,63,63,2,
	0,145,145,180,180,2,0,40,40,74,83,1,0,84,85,6,0,31,31,36,36,86,86,108,108,
	149,149,180,180,5,0,141,141,145,145,151,151,153,153,162,162,2,0,89,89,180,
	180,2,0,163,163,172,175,2,0,163,163,172,179,3,0,14,14,27,27,127,127,2,0,
	10,10,15,16,1,0,13,14,1,0,128,129,1,0,20,23,1,0,18,19,2,0,126,126,164,164,
	3,0,33,33,56,56,133,137,1,0,142,143,3,0,44,44,58,59,70,71,5,0,59,59,108,
	108,138,139,146,149,155,159,2697,0,255,1,0,0,0,2,308,1,0,0,0,4,310,1,0,
	0,0,6,315,1,0,0,0,8,375,1,0,0,0,10,377,1,0,0,0,12,386,1,0,0,0,14,388,1,
	0,0,0,16,404,1,0,0,0,18,406,1,0,0,0,20,414,1,0,0,0,22,417,1,0,0,0,24,421,
	1,0,0,0,26,423,1,0,0,0,28,462,1,0,0,0,30,464,1,0,0,0,32,469,1,0,0,0,34,
	471,1,0,0,0,36,485,1,0,0,0,38,505,1,0,0,0,40,545,1,0,0,0,42,549,1,0,0,0,
	44,564,1,0,0,0,46,588,1,0,0,0,48,596,1,0,0,0,50,623,1,0,0,0,52,625,1,0,
	0,0,54,638,1,0,0,0,56,643,1,0,0,0,58,659,1,0,0,0,60,664,1,0,0,0,62,670,
	1,0,0,0,64,677,1,0,0,0,66,706,1,0,0,0,68,742,1,0,0,0,70,744,1,0,0,0,72,
	778,1,0,0,0,74,780,1,0,0,0,76,854,1,0,0,0,78,859,1,0,0,0,80,861,1,0,0,0,
	82,899,1,0,0,0,84,911,1,0,0,0,86,925,1,0,0,0,88,948,1,0,0,0,90,950,1,0,
	0,0,92,953,1,0,0,0,94,975,1,0,0,0,96,993,1,0,0,0,98,995,1,0,0,0,100,1008,
	1,0,0,0,102,1014,1,0,0,0,104,1059,1,0,0,0,106,1061,1,0,0,0,108,1107,1,0,
	0,0,110,1118,1,0,0,0,112,1142,1,0,0,0,114,1144,1,0,0,0,116,1170,1,0,0,0,
	118,1203,1,0,0,0,120,1205,1,0,0,0,122,1244,1,0,0,0,124,1293,1,0,0,0,126,
	1343,1,0,0,0,128,1365,1,0,0,0,130,1367,1,0,0,0,132,1430,1,0,0,0,134,1432,
	1,0,0,0,136,1444,1,0,0,0,138,1454,1,0,0,0,140,1469,1,0,0,0,142,1471,1,0,
	0,0,144,1487,1,0,0,0,146,1498,1,0,0,0,148,1509,1,0,0,0,150,1539,1,0,0,0,
	152,1541,1,0,0,0,154,1551,1,0,0,0,156,1553,1,0,0,0,158,1561,1,0,0,0,160,
	1567,1,0,0,0,162,1571,1,0,0,0,164,1589,1,0,0,0,166,1611,1,0,0,0,168,1613,
	1,0,0,0,170,1626,1,0,0,0,172,1637,1,0,0,0,174,1641,1,0,0,0,176,1654,1,0,
	0,0,178,1658,1,0,0,0,180,1661,1,0,0,0,182,1667,1,0,0,0,184,1697,1,0,0,0,
	186,1699,1,0,0,0,188,1713,1,0,0,0,190,1715,1,0,0,0,192,1724,1,0,0,0,194,
	1726,1,0,0,0,196,1736,1,0,0,0,198,1752,1,0,0,0,200,1761,1,0,0,0,202,1769,
	1,0,0,0,204,1780,1,0,0,0,206,1797,1,0,0,0,208,1820,1,0,0,0,210,1823,1,0,
	0,0,212,1829,1,0,0,0,214,1873,1,0,0,0,216,1875,1,0,0,0,218,1883,1,0,0,0,
	220,1885,1,0,0,0,222,1925,1,0,0,0,224,1927,1,0,0,0,226,1931,1,0,0,0,228,
	1947,1,0,0,0,230,1961,1,0,0,0,232,1965,1,0,0,0,234,1981,1,0,0,0,236,2153,
	1,0,0,0,238,2281,1,0,0,0,240,2283,1,0,0,0,242,2299,1,0,0,0,244,2301,1,0,
	0,0,246,2305,1,0,0,0,248,2359,1,0,0,0,250,2361,1,0,0,0,252,254,3,16,8,0,
	253,252,1,0,0,0,254,257,1,0,0,0,255,253,1,0,0,0,255,256,1,0,0,0,256,261,
	1,0,0,0,257,255,1,0,0,0,258,260,3,2,1,0,259,258,1,0,0,0,260,263,1,0,0,0,
	261,259,1,0,0,0,261,262,1,0,0,0,262,277,1,0,0,0,263,261,1,0,0,0,264,276,
	3,62,31,0,265,276,3,56,28,0,266,276,3,52,26,0,267,276,3,60,30,0,268,276,
	3,8,4,0,269,276,3,48,24,0,270,276,3,44,22,0,271,276,3,26,13,0,272,276,3,
	6,3,0,273,276,3,36,18,0,274,276,3,38,19,0,275,264,1,0,0,0,275,265,1,0,0,
	0,275,266,1,0,0,0,275,267,1,0,0,0,275,268,1,0,0,0,275,269,1,0,0,0,275,270,
	1,0,0,0,275,271,1,0,0,0,275,272,1,0,0,0,275,273,1,0,0,0,275,274,1,0,0,0,
	276,279,1,0,0,0,277,275,1,0,0,0,277,278,1,0,0,0,278,280,1,0,0,0,279,277,
	1,0,0,0,280,281,5,0,0,1,281,1,1,0,0,0,282,283,5,1,0,0,283,284,5,151,0,0,
	284,309,5,2,0,0,285,286,5,1,0,0,286,287,5,151,0,0,287,288,5,3,0,0,288,289,
	5,180,0,0,289,309,5,2,0,0,290,291,5,1,0,0,291,292,5,4,0,0,292,297,3,4,2,
	0,293,294,5,5,0,0,294,296,3,4,2,0,295,293,1,0,0,0,296,299,1,0,0,0,297,295,
	1,0,0,0,297,298,1,0,0,0,298,301,1,0,0,0,299,297,1,0,0,0,300,302,5,5,0,0,
	301,300,1,0,0,0,301,302,1,0,0,0,302,303,1,0,0,0,303,304,5,6,0,0,304,305,
	5,180,0,0,305,306,5,151,0,0,306,307,5,2,0,0,307,309,1,0,0,0,308,282,1,0,
	0,0,308,285,1,0,0,0,308,290,1,0,0,0,309,3,1,0,0,0,310,313,5,180,0,0,311,
	312,5,3,0,0,312,314,5,180,0,0,313,311,1,0,0,0,313,314,1,0,0,0,314,5,1,0,
	0,0,315,316,5,7,0,0,316,317,3,14,7,0,317,321,3,106,53,0,318,320,3,96,48,
	0,319,318,1,0,0,0,320,323,1,0,0,0,321,319,1,0,0,0,321,322,1,0,0,0,322,325,
	1,0,0,0,323,321,1,0,0,0,324,326,3,102,51,0,325,324,1,0,0,0,325,326,1,0,
	0,0,326,327,1,0,0,0,327,331,5,4,0,0,328,330,3,112,56,0,329,328,1,0,0,0,
	330,333,1,0,0,0,331,329,1,0,0,0,331,332,1,0,0,0,332,334,1,0,0,0,333,331,
	1,0,0,0,334,335,5,6,0,0,335,7,1,0,0,0,336,337,5,8,0,0,337,338,5,180,0,0,
	338,343,5,9,0,0,339,344,3,84,42,0,340,344,3,82,41,0,341,344,3,248,124,0,
	342,344,5,10,0,0,343,339,1,0,0,0,343,340,1,0,0,0,343,341,1,0,0,0,343,342,
	1,0,0,0,344,346,1,0,0,0,345,347,5,11,0,0,346,345,1,0,0,0,346,347,1,0,0,
	0,347,348,1,0,0,0,348,376,5,2,0,0,349,350,5,8,0,0,350,351,5,4,0,0,351,356,
	3,10,5,0,352,353,5,5,0,0,353,355,3,10,5,0,354,352,1,0,0,0,355,358,1,0,0,
	0,356,354,1,0,0,0,356,357,1,0,0,0,357,360,1,0,0,0,358,356,1,0,0,0,359,361,
	5,5,0,0,360,359,1,0,0,0,360,361,1,0,0,0,361,362,1,0,0,0,362,363,5,6,0,0,
	363,368,5,9,0,0,364,369,3,84,42,0,365,369,3,82,41,0,366,369,3,248,124,0,
	367,369,5,10,0,0,368,364,1,0,0,0,368,365,1,0,0,0,368,366,1,0,0,0,368,367,
	1,0,0,0,369,371,1,0,0,0,370,372,5,11,0,0,371,370,1,0,0,0,371,372,1,0,0,
	0,372,373,1,0,0,0,373,374,5,2,0,0,374,376,1,0,0,0,375,336,1,0,0,0,375,349,
	1,0,0,0,376,9,1,0,0,0,377,380,5,180,0,0,378,379,5,12,0,0,379,381,5,180,
	0,0,380,378,1,0,0,0,380,381,1,0,0,0,381,384,1,0,0,0,382,383,5,3,0,0,383,
	385,3,12,6,0,384,382,1,0,0,0,384,385,1,0,0,0,385,11,1,0,0,0,386,387,7,0,
	0,0,387,13,1,0,0,0,388,389,7,1,0,0,389,15,1,0,0,0,390,391,5,37,0,0,391,
	392,3,18,9,0,392,393,3,20,10,0,393,394,5,2,0,0,394,405,1,0,0,0,395,396,
	5,37,0,0,396,400,5,180,0,0,397,399,7,2,0,0,398,397,1,0,0,0,399,402,1,0,
	0,0,400,398,1,0,0,0,400,401,1,0,0,0,401,403,1,0,0,0,402,400,1,0,0,0,403,
	405,5,2,0,0,404,390,1,0,0,0,404,395,1,0,0,0,405,17,1,0,0,0,406,407,7,3,
	0,0,407,19,1,0,0,0,408,410,3,22,11,0,409,408,1,0,0,0,410,411,1,0,0,0,411,
	409,1,0,0,0,411,412,1,0,0,0,412,415,1,0,0,0,413,415,5,10,0,0,414,409,1,
	0,0,0,414,413,1,0,0,0,415,21,1,0,0,0,416,418,3,24,12,0,417,416,1,0,0,0,
	417,418,1,0,0,0,418,419,1,0,0,0,419,420,7,4,0,0,420,23,1,0,0,0,421,422,
	7,5,0,0,422,25,1,0,0,0,423,424,5,41,0,0,424,434,5,180,0,0,425,426,5,42,
	0,0,426,431,5,180,0,0,427,428,5,5,0,0,428,430,5,180,0,0,429,427,1,0,0,0,
	430,433,1,0,0,0,431,429,1,0,0,0,431,432,1,0,0,0,432,435,1,0,0,0,433,431,
	1,0,0,0,434,425,1,0,0,0,434,435,1,0,0,0,435,436,1,0,0,0,436,447,5,4,0,0,
	437,446,3,56,28,0,438,446,3,52,26,0,439,446,3,60,30,0,440,446,3,44,22,0,
	441,446,3,48,24,0,442,446,3,30,15,0,443,446,3,28,14,0,444,446,3,34,17,0,
	445,437,1,0,0,0,445,438,1,0,0,0,445,439,1,0,0,0,445,440,1,0,0,0,445,441,
	1,0,0,0,445,442,1,0,0,0,445,443,1,0,0,0,445,444,1,0,0,0,446,449,1,0,0,0,
	447,445,1,0,0,0,447,448,1,0,0,0,448,450,1,0,0,0,449,447,1,0,0,0,450,451,
	5,6,0,0,451,27,1,0,0,0,452,453,3,32,16,0,453,454,3,82,41,0,454,455,5,180,
	0,0,455,456,5,2,0,0,456,463,1,0,0,0,457,458,3,32,16,0,458,459,3,84,42,0,
	459,460,5,180,0,0,460,461,5,2,0,0,461,463,1,0,0,0,462,452,1,0,0,0,462,457,
	1,0,0,0,463,29,1,0,0,0,464,465,3,32,16,0,465,466,3,248,124,0,466,467,5,
	180,0,0,467,468,5,2,0,0,468,31,1,0,0,0,469,470,7,6,0,0,470,33,1,0,0,0,471,
	472,5,7,0,0,472,473,5,180,0,0,473,477,3,106,53,0,474,476,3,96,48,0,475,
	474,1,0,0,0,476,479,1,0,0,0,477,475,1,0,0,0,477,478,1,0,0,0,478,481,1,0,
	0,0,479,477,1,0,0,0,480,482,3,102,51,0,481,480,1,0,0,0,481,482,1,0,0,0,
	482,483,1,0,0,0,483,484,5,2,0,0,484,35,1,0,0,0,485,486,5,45,0,0,486,487,
	5,180,0,0,487,499,5,4,0,0,488,498,3,56,28,0,489,498,3,52,26,0,490,498,3,
	60,30,0,491,498,3,44,22,0,492,498,3,48,24,0,493,498,3,62,31,0,494,498,3,
	76,38,0,495,498,3,8,4,0,496,498,3,6,3,0,497,488,1,0,0,0,497,489,1,0,0,0,
	497,490,1,0,0,0,497,491,1,0,0,0,497,492,1,0,0,0,497,493,1,0,0,0,497,494,
	1,0,0,0,497,495,1,0,0,0,497,496,1,0,0,0,498,501,1,0,0,0,499,497,1,0,0,0,
	499,500,1,0,0,0,500,502,1,0,0,0,501,499,1,0,0,0,502,503,5,6,0,0,503,37,
	1,0,0,0,504,506,5,46,0,0,505,504,1,0,0,0,505,506,1,0,0,0,506,507,1,0,0,
	0,507,508,5,47,0,0,508,510,5,180,0,0,509,511,3,106,53,0,510,509,1,0,0,0,
	510,511,1,0,0,0,511,521,1,0,0,0,512,513,5,42,0,0,513,518,3,40,20,0,514,
	515,5,5,0,0,515,517,3,40,20,0,516,514,1,0,0,0,517,520,1,0,0,0,518,516,1,
	0,0,0,518,519,1,0,0,0,519,522,1,0,0,0,520,518,1,0,0,0,521,512,1,0,0,0,521,
	522,1,0,0,0,522,523,1,0,0,0,523,540,5,4,0,0,524,539,3,56,28,0,525,539,3,
	52,26,0,526,539,3,60,30,0,527,539,3,44,22,0,528,539,3,48,24,0,529,539,3,
	62,31,0,530,539,3,8,4,0,531,539,3,76,38,0,532,539,3,86,43,0,533,539,3,64,
	32,0,534,539,3,92,46,0,535,539,3,42,21,0,536,539,3,66,33,0,537,539,3,70,
	35,0,538,524,1,0,0,0,538,525,1,0,0,0,538,526,1,0,0,0,538,527,1,0,0,0,538,
	528,1,0,0,0,538,529,1,0,0,0,538,530,1,0,0,0,538,531,1,0,0,0,538,532,1,0,
	0,0,538,533,1,0,0,0,538,534,1,0,0,0,538,535,1,0,0,0,538,536,1,0,0,0,538,
	537,1,0,0,0,539,542,1,0,0,0,540,538,1,0,0,0,540,541,1,0,0,0,541,543,1,0,
	0,0,542,540,1,0,0,0,543,544,5,6,0,0,544,39,1,0,0,0,545,547,5,180,0,0,546,
	548,3,226,113,0,547,546,1,0,0,0,547,548,1,0,0,0,548,41,1,0,0,0,549,550,
	5,7,0,0,550,551,3,14,7,0,551,556,3,106,53,0,552,555,3,96,48,0,553,555,3,
	94,47,0,554,552,1,0,0,0,554,553,1,0,0,0,555,558,1,0,0,0,556,554,1,0,0,0,
	556,557,1,0,0,0,557,560,1,0,0,0,558,556,1,0,0,0,559,561,3,102,51,0,560,
	559,1,0,0,0,560,561,1,0,0,0,561,562,1,0,0,0,562,563,5,2,0,0,563,43,1,0,
	0,0,564,565,5,48,0,0,565,566,5,180,0,0,566,578,5,49,0,0,567,572,3,46,23,
	0,568,569,5,5,0,0,569,571,3,46,23,0,570,568,1,0,0,0,571,574,1,0,0,0,572,
	570,1,0,0,0,572,573,1,0,0,0,573,576,1,0,0,0,574,572,1,0,0,0,575,577,5,5,
	0,0,576,575,1,0,0,0,576,577,1,0,0,0,577,579,1,0,0,0,578,567,1,0,0,0,578,
	579,1,0,0,0,579,580,1,0,0,0,580,582,5,50,0,0,581,583,5,51,0,0,582,581,1,
	0,0,0,582,583,1,0,0,0,583,584,1,0,0,0,584,585,5,2,0,0,585,45,1,0,0,0,586,
	589,3,248,124,0,587,589,3,84,42,0,588,586,1,0,0,0,588,587,1,0,0,0,589,591,
	1,0,0,0,590,592,5,52,0,0,591,590,1,0,0,0,591,592,1,0,0,0,592,594,1,0,0,
	0,593,595,5,180,0,0,594,593,1,0,0,0,594,595,1,0,0,0,595,47,1,0,0,0,596,
	597,5,35,0,0,597,598,5,180,0,0,598,610,5,49,0,0,599,604,3,50,25,0,600,601,
	5,5,0,0,601,603,3,50,25,0,602,600,1,0,0,0,603,606,1,0,0,0,604,602,1,0,0,
	0,604,605,1,0,0,0,605,608,1,0,0,0,606,604,1,0,0,0,607,609,5,5,0,0,608,607,
	1,0,0,0,608,609,1,0,0,0,609,611,1,0,0,0,610,599,1,0,0,0,610,611,1,0,0,0,
	611,612,1,0,0,0,612,613,5,50,0,0,613,614,5,2,0,0,614,49,1,0,0,0,615,617,
	3,248,124,0,616,618,5,180,0,0,617,616,1,0,0,0,617,618,1,0,0,0,618,624,1,
	0,0,0,619,621,3,84,42,0,620,622,5,180,0,0,621,620,1,0,0,0,621,622,1,0,0,
	0,622,624,1,0,0,0,623,615,1,0,0,0,623,619,1,0,0,0,624,51,1,0,0,0,625,626,
	5,53,0,0,626,627,5,180,0,0,627,629,5,4,0,0,628,630,3,54,27,0,629,628,1,
	0,0,0,630,631,1,0,0,0,631,629,1,0,0,0,631,632,1,0,0,0,632,633,1,0,0,0,633,
	634,5,6,0,0,634,53,1,0,0,0,635,639,3,248,124,0,636,639,3,84,42,0,637,639,
	3,82,41,0,638,635,1,0,0,0,638,636,1,0,0,0,638,637,1,0,0,0,639,640,1,0,0,
	0,640,641,3,14,7,0,641,642,5,2,0,0,642,55,1,0,0,0,643,644,5,54,0,0,644,
	645,5,180,0,0,645,646,5,4,0,0,646,651,3,58,29,0,647,648,5,5,0,0,648,650,
	3,58,29,0,649,647,1,0,0,0,650,653,1,0,0,0,651,649,1,0,0,0,651,652,1,0,0,
	0,652,655,1,0,0,0,653,651,1,0,0,0,654,656,5,5,0,0,655,654,1,0,0,0,655,656,
	1,0,0,0,656,657,1,0,0,0,657,658,5,6,0,0,658,57,1,0,0,0,659,662,5,180,0,
	0,660,661,5,40,0,0,661,663,5,145,0,0,662,660,1,0,0,0,662,663,1,0,0,0,663,
	59,1,0,0,0,664,665,5,55,0,0,665,666,5,180,0,0,666,667,5,42,0,0,667,668,
	3,248,124,0,668,669,5,2,0,0,669,61,1,0,0,0,670,671,3,248,124,0,671,672,
	5,56,0,0,672,673,5,180,0,0,673,674,5,40,0,0,674,675,3,236,118,0,675,676,
	5,2,0,0,676,63,1,0,0,0,677,678,5,57,0,0,678,682,3,106,53,0,679,681,7,7,
	0,0,680,679,1,0,0,0,681,684,1,0,0,0,682,680,1,0,0,0,682,683,1,0,0,0,683,
	688,1,0,0,0,684,682,1,0,0,0,685,687,3,74,37,0,686,685,1,0,0,0,687,690,1,
	0,0,0,688,686,1,0,0,0,688,689,1,0,0,0,689,694,1,0,0,0,690,688,1,0,0,0,691,
	693,3,94,47,0,692,691,1,0,0,0,693,696,1,0,0,0,694,692,1,0,0,0,694,695,1,
	0,0,0,695,697,1,0,0,0,696,694,1,0,0,0,697,701,5,4,0,0,698,700,3,112,56,
	0,699,698,1,0,0,0,700,703,1,0,0,0,701,699,1,0,0,0,701,702,1,0,0,0,702,704,
	1,0,0,0,703,701,1,0,0,0,704,705,5,6,0,0,705,65,1,0,0,0,706,707,5,60,0,0,
	707,711,3,106,53,0,708,710,3,68,34,0,709,708,1,0,0,0,710,713,1,0,0,0,711,
	709,1,0,0,0,711,712,1,0,0,0,712,714,1,0,0,0,713,711,1,0,0,0,714,718,5,44,
	0,0,715,717,3,68,34,0,716,715,1,0,0,0,717,720,1,0,0,0,718,716,1,0,0,0,718,
	719,1,0,0,0,719,724,1,0,0,0,720,718,1,0,0,0,721,723,3,94,47,0,722,721,1,
	0,0,0,723,726,1,0,0,0,724,722,1,0,0,0,724,725,1,0,0,0,725,728,1,0,0,0,726,
	724,1,0,0,0,727,729,3,102,51,0,728,727,1,0,0,0,728,729,1,0,0,0,729,730,
	1,0,0,0,730,734,5,4,0,0,731,733,3,112,56,0,732,731,1,0,0,0,733,736,1,0,
	0,0,734,732,1,0,0,0,734,735,1,0,0,0,735,737,1,0,0,0,736,734,1,0,0,0,737,
	738,5,6,0,0,738,67,1,0,0,0,739,743,5,59,0,0,740,743,5,61,0,0,741,743,3,
	98,49,0,742,739,1,0,0,0,742,740,1,0,0,0,742,741,1,0,0,0,743,69,1,0,0,0,
	744,745,5,62,0,0,745,746,5,49,0,0,746,750,5,50,0,0,747,749,3,72,36,0,748,
	747,1,0,0,0,749,752,1,0,0,0,750,748,1,0,0,0,750,751,1,0,0,0,751,753,1,0,
	0,0,752,750,1,0,0,0,753,757,5,44,0,0,754,756,3,72,36,0,755,754,1,0,0,0,
	756,759,1,0,0,0,757,755,1,0,0,0,757,758,1,0,0,0,758,760,1,0,0,0,759,757,
	1,0,0,0,760,764,5,59,0,0,761,763,3,72,36,0,762,761,1,0,0,0,763,766,1,0,
	0,0,764,762,1,0,0,0,764,765,1,0,0,0,765,767,1,0,0,0,766,764,1,0,0,0,767,
	771,5,4,0,0,768,770,3,112,56,0,769,768,1,0,0,0,770,773,1,0,0,0,771,769,
	1,0,0,0,771,772,1,0,0,0,772,774,1,0,0,0,773,771,1,0,0,0,774,775,5,6,0,0,
	775,71,1,0,0,0,776,779,5,61,0,0,777,779,3,98,49,0,778,776,1,0,0,0,778,777,
	1,0,0,0,779,73,1,0,0,0,780,781,5,180,0,0,781,782,3,226,113,0,782,75,1,0,
	0,0,783,785,3,80,40,0,784,783,1,0,0,0,784,785,1,0,0,0,785,786,1,0,0,0,786,
	791,3,248,124,0,787,790,3,240,120,0,788,790,3,98,49,0,789,787,1,0,0,0,789,
	788,1,0,0,0,790,793,1,0,0,0,791,789,1,0,0,0,791,792,1,0,0,0,792,794,1,0,
	0,0,793,791,1,0,0,0,794,797,5,180,0,0,795,796,5,40,0,0,796,798,3,236,118,
	0,797,795,1,0,0,0,797,798,1,0,0,0,798,799,1,0,0,0,799,800,5,2,0,0,800,855,
	1,0,0,0,801,806,3,248,124,0,802,805,3,240,120,0,803,805,3,98,49,0,804,802,
	1,0,0,0,804,803,1,0,0,0,805,808,1,0,0,0,806,804,1,0,0,0,806,807,1,0,0,0,
	807,809,1,0,0,0,808,806,1,0,0,0,809,814,3,80,40,0,810,813,3,240,120,0,811,
	813,3,98,49,0,812,810,1,0,0,0,812,811,1,0,0,0,813,816,1,0,0,0,814,812,1,
	0,0,0,814,815,1,0,0,0,815,817,1,0,0,0,816,814,1,0,0,0,817,820,5,180,0,0,
	818,819,5,40,0,0,819,821,3,236,118,0,820,818,1,0,0,0,820,821,1,0,0,0,821,
	822,1,0,0,0,822,823,5,2,0,0,823,855,1,0,0,0,824,826,3,80,40,0,825,824,1,
	0,0,0,825,826,1,0,0,0,826,827,1,0,0,0,827,831,3,82,41,0,828,830,3,78,39,
	0,829,828,1,0,0,0,830,833,1,0,0,0,831,829,1,0,0,0,831,832,1,0,0,0,832,834,
	1,0,0,0,833,831,1,0,0,0,834,835,5,180,0,0,835,836,5,2,0,0,836,855,1,0,0,
	0,837,839,3,80,40,0,838,837,1,0,0,0,838,839,1,0,0,0,839,840,1,0,0,0,840,
	844,3,84,42,0,841,843,3,78,39,0,842,841,1,0,0,0,843,846,1,0,0,0,844,842,
	1,0,0,0,844,845,1,0,0,0,845,847,1,0,0,0,846,844,1,0,0,0,847,850,5,180,0,
	0,848,849,5,40,0,0,849,851,3,236,118,0,850,848,1,0,0,0,850,851,1,0,0,0,
	851,852,1,0,0,0,852,853,5,2,0,0,853,855,1,0,0,0,854,784,1,0,0,0,854,801,
	1,0,0,0,854,825,1,0,0,0,854,838,1,0,0,0,855,77,1,0,0,0,856,860,3,240,120,
	0,857,860,3,80,40,0,858,860,3,98,49,0,859,856,1,0,0,0,859,857,1,0,0,0,859,
	858,1,0,0,0,860,79,1,0,0,0,861,862,7,8,0,0,862,81,1,0,0,0,863,864,5,64,
	0,0,864,865,5,49,0,0,865,867,3,248,124,0,866,868,5,180,0,0,867,866,1,0,
	0,0,867,868,1,0,0,0,868,869,1,0,0,0,869,870,5,65,0,0,870,872,3,248,124,
	0,871,873,5,180,0,0,872,871,1,0,0,0,872,873,1,0,0,0,873,874,1,0,0,0,874,
	875,5,50,0,0,875,900,1,0,0,0,876,877,5,64,0,0,877,878,5,49,0,0,878,880,
	3,248,124,0,879,881,5,180,0,0,880,879,1,0,0,0,880,881,1,0,0,0,881,882,1,
	0,0,0,882,883,5,65,0,0,883,884,3,82,41,0,884,885,5,50,0,0,885,900,1,0,0,
	0,886,887,5,64,0,0,887,888,5,49,0,0,888,890,3,248,124,0,889,891,5,180,0,
	0,890,889,1,0,0,0,890,891,1,0,0,0,891,892,1,0,0,0,892,893,5,65,0,0,893,
	895,3,84,42,0,894,896,5,180,0,0,895,894,1,0,0,0,895,896,1,0,0,0,896,897,
	1,0,0,0,897,898,5,50,0,0,898,900,1,0,0,0,899,863,1,0,0,0,899,876,1,0,0,
	0,899,886,1,0,0,0,900,83,1,0,0,0,901,902,6,42,-1,0,902,903,3,248,124,0,
	903,904,5,66,0,0,904,905,7,9,0,0,905,906,5,67,0,0,906,912,1,0,0,0,907,908,
	3,248,124,0,908,909,5,66,0,0,909,910,5,67,0,0,910,912,1,0,0,0,911,901,1,
	0,0,0,911,907,1,0,0,0,912,922,1,0,0,0,913,914,10,2,0,0,914,915,5,66,0,0,
	915,916,7,9,0,0,916,921,5,67,0,0,917,918,10,1,0,0,918,919,5,66,0,0,919,
	921,5,67,0,0,920,913,1,0,0,0,920,917,1,0,0,0,921,924,1,0,0,0,922,920,1,
	0,0,0,922,923,1,0,0,0,923,85,1,0,0,0,924,922,1,0,0,0,925,926,5,68,0,0,926,
	928,5,180,0,0,927,929,3,106,53,0,928,927,1,0,0,0,928,929,1,0,0,0,929,934,
	1,0,0,0,930,933,5,61,0,0,931,933,3,98,49,0,932,930,1,0,0,0,932,931,1,0,
	0,0,933,936,1,0,0,0,934,932,1,0,0,0,934,935,1,0,0,0,935,937,1,0,0,0,936,
	934,1,0,0,0,937,941,5,4,0,0,938,940,3,88,44,0,939,938,1,0,0,0,940,943,1,
	0,0,0,941,939,1,0,0,0,941,942,1,0,0,0,942,944,1,0,0,0,943,941,1,0,0,0,944,
	945,5,6,0,0,945,87,1,0,0,0,946,949,3,90,45,0,947,949,3,112,56,0,948,946,
	1,0,0,0,948,947,1,0,0,0,949,89,1,0,0,0,950,951,5,69,0,0,951,952,5,2,0,0,
	952,91,1,0,0,0,953,954,5,7,0,0,954,955,3,14,7,0,955,960,3,106,53,0,956,
	959,3,96,48,0,957,959,3,94,47,0,958,956,1,0,0,0,958,957,1,0,0,0,959,962,
	1,0,0,0,960,958,1,0,0,0,960,961,1,0,0,0,961,964,1,0,0,0,962,960,1,0,0,0,
	963,965,3,102,51,0,964,963,1,0,0,0,964,965,1,0,0,0,965,966,1,0,0,0,966,
	970,5,4,0,0,967,969,3,112,56,0,968,967,1,0,0,0,969,972,1,0,0,0,970,968,
	1,0,0,0,970,971,1,0,0,0,971,973,1,0,0,0,972,970,1,0,0,0,973,974,5,6,0,0,
	974,93,1,0,0,0,975,977,5,180,0,0,976,978,3,226,113,0,977,976,1,0,0,0,977,
	978,1,0,0,0,978,95,1,0,0,0,979,994,5,70,0,0,980,994,5,71,0,0,981,994,5,
	58,0,0,982,994,5,44,0,0,983,994,5,43,0,0,984,994,5,63,0,0,985,994,5,59,
	0,0,986,994,3,98,49,0,987,994,5,61,0,0,988,994,3,100,50,0,989,994,5,30,
	0,0,990,994,5,28,0,0,991,994,5,31,0,0,992,994,5,29,0,0,993,979,1,0,0,0,
	993,980,1,0,0,0,993,981,1,0,0,0,993,982,1,0,0,0,993,983,1,0,0,0,993,984,
	1,0,0,0,993,985,1,0,0,0,993,986,1,0,0,0,993,987,1,0,0,0,993,988,1,0,0,0,
	993,989,1,0,0,0,993,990,1,0,0,0,993,991,1,0,0,0,993,992,1,0,0,0,994,97,
	1,0,0,0,995,1006,5,72,0,0,996,997,5,49,0,0,997,1002,5,180,0,0,998,999,5,
	5,0,0,999,1001,5,180,0,0,1000,998,1,0,0,0,1001,1004,1,0,0,0,1002,1000,1,
	0,0,0,1002,1003,1,0,0,0,1003,1005,1,0,0,0,1004,1002,1,0,0,0,1005,1007,5,
	50,0,0,1006,996,1,0,0,0,1006,1007,1,0,0,0,1007,99,1,0,0,0,1008,1012,5,32,
	0,0,1009,1010,5,49,0,0,1010,1011,5,145,0,0,1011,1013,5,50,0,0,1012,1009,
	1,0,0,0,1012,1013,1,0,0,0,1013,101,1,0,0,0,1014,1015,5,73,0,0,1015,1016,
	5,49,0,0,1016,1021,3,104,52,0,1017,1018,5,5,0,0,1018,1020,3,104,52,0,1019,
	1017,1,0,0,0,1020,1023,1,0,0,0,1021,1019,1,0,0,0,1021,1022,1,0,0,0,1022,
	1025,1,0,0,0,1023,1021,1,0,0,0,1024,1026,5,5,0,0,1025,1024,1,0,0,0,1025,
	1026,1,0,0,0,1026,1027,1,0,0,0,1027,1028,5,50,0,0,1028,103,1,0,0,0,1029,
	1033,3,248,124,0,1030,1032,3,240,120,0,1031,1030,1,0,0,0,1032,1035,1,0,
	0,0,1033,1031,1,0,0,0,1033,1034,1,0,0,0,1034,1037,1,0,0,0,1035,1033,1,0,
	0,0,1036,1038,3,14,7,0,1037,1036,1,0,0,0,1037,1038,1,0,0,0,1038,1060,1,
	0,0,0,1039,1043,3,84,42,0,1040,1042,3,240,120,0,1041,1040,1,0,0,0,1042,
	1045,1,0,0,0,1043,1041,1,0,0,0,1043,1044,1,0,0,0,1044,1047,1,0,0,0,1045,
	1043,1,0,0,0,1046,1048,3,14,7,0,1047,1046,1,0,0,0,1047,1048,1,0,0,0,1048,
	1060,1,0,0,0,1049,1053,3,82,41,0,1050,1052,3,240,120,0,1051,1050,1,0,0,
	0,1052,1055,1,0,0,0,1053,1051,1,0,0,0,1053,1054,1,0,0,0,1054,1057,1,0,0,
	0,1055,1053,1,0,0,0,1056,1058,3,14,7,0,1057,1056,1,0,0,0,1057,1058,1,0,
	0,0,1058,1060,1,0,0,0,1059,1029,1,0,0,0,1059,1039,1,0,0,0,1059,1049,1,0,
	0,0,1060,105,1,0,0,0,1061,1073,5,49,0,0,1062,1067,3,108,54,0,1063,1064,
	5,5,0,0,1064,1066,3,108,54,0,1065,1063,1,0,0,0,1066,1069,1,0,0,0,1067,1065,
	1,0,0,0,1067,1068,1,0,0,0,1068,1071,1,0,0,0,1069,1067,1,0,0,0,1070,1072,
	5,5,0,0,1071,1070,1,0,0,0,1071,1072,1,0,0,0,1072,1074,1,0,0,0,1073,1062,
	1,0,0,0,1073,1074,1,0,0,0,1074,1075,1,0,0,0,1075,1076,5,50,0,0,1076,107,
	1,0,0,0,1077,1081,3,248,124,0,1078,1080,3,240,120,0,1079,1078,1,0,0,0,1080,
	1083,1,0,0,0,1081,1079,1,0,0,0,1081,1082,1,0,0,0,1082,1085,1,0,0,0,1083,
	1081,1,0,0,0,1084,1086,3,14,7,0,1085,1084,1,0,0,0,1085,1086,1,0,0,0,1086,
	1108,1,0,0,0,1087,1091,3,84,42,0,1088,1090,3,240,120,0,1089,1088,1,0,0,
	0,1090,1093,1,0,0,0,1091,1089,1,0,0,0,1091,1092,1,0,0,0,1092,1095,1,0,0,
	0,1093,1091,1,0,0,0,1094,1096,3,14,7,0,1095,1094,1,0,0,0,1095,1096,1,0,
	0,0,1096,1108,1,0,0,0,1097,1101,3,82,41,0,1098,1100,3,240,120,0,1099,1098,
	1,0,0,0,1100,1103,1,0,0,0,1101,1099,1,0,0,0,1101,1102,1,0,0,0,1102,1105,
	1,0,0,0,1103,1101,1,0,0,0,1104,1106,3,14,7,0,1105,1104,1,0,0,0,1105,1106,
	1,0,0,0,1106,1108,1,0,0,0,1107,1077,1,0,0,0,1107,1087,1,0,0,0,1107,1097,
	1,0,0,0,1108,109,1,0,0,0,1109,1113,5,4,0,0,1110,1112,3,112,56,0,1111,1110,
	1,0,0,0,1112,1115,1,0,0,0,1113,1111,1,0,0,0,1113,1114,1,0,0,0,1114,1116,
	1,0,0,0,1115,1113,1,0,0,0,1116,1119,5,6,0,0,1117,1119,3,112,56,0,1118,1109,
	1,0,0,0,1118,1117,1,0,0,0,1119,111,1,0,0,0,1120,1143,3,90,45,0,1121,1143,
	3,124,62,0,1122,1143,3,126,63,0,1123,1143,3,116,58,0,1124,1143,3,134,67,
	0,1125,1143,3,136,68,0,1126,1143,3,138,69,0,1127,1143,3,140,70,0,1128,1143,
	3,160,80,0,1129,1143,3,122,61,0,1130,1143,3,118,59,0,1131,1143,3,120,60,
	0,1132,1143,3,162,81,0,1133,1143,3,202,101,0,1134,1143,3,214,107,0,1135,
	1143,3,216,108,0,1136,1143,3,132,66,0,1137,1143,3,194,97,0,1138,1143,3,
	196,98,0,1139,1143,3,208,104,0,1140,1143,3,210,105,0,1141,1143,3,114,57,
	0,1142,1120,1,0,0,0,1142,1121,1,0,0,0,1142,1122,1,0,0,0,1142,1123,1,0,0,
	0,1142,1124,1,0,0,0,1142,1125,1,0,0,0,1142,1126,1,0,0,0,1142,1127,1,0,0,
	0,1142,1128,1,0,0,0,1142,1129,1,0,0,0,1142,1130,1,0,0,0,1142,1131,1,0,0,
	0,1142,1132,1,0,0,0,1142,1133,1,0,0,0,1142,1134,1,0,0,0,1142,1135,1,0,0,
	0,1142,1136,1,0,0,0,1142,1137,1,0,0,0,1142,1138,1,0,0,0,1142,1139,1,0,0,
	0,1142,1140,1,0,0,0,1142,1141,1,0,0,0,1143,113,1,0,0,0,1144,1166,3,236,
	118,0,1145,1146,7,10,0,0,1146,1167,3,236,118,0,1147,1148,5,165,0,0,1148,
	1149,5,49,0,0,1149,1150,5,50,0,0,1150,1151,5,40,0,0,1151,1167,3,236,118,
	0,1152,1153,5,165,0,0,1153,1155,5,49,0,0,1154,1156,3,130,65,0,1155,1154,
	1,0,0,0,1155,1156,1,0,0,0,1156,1157,1,0,0,0,1157,1167,5,50,0,0,1158,1159,
	5,166,0,0,1159,1160,5,49,0,0,1160,1167,5,50,0,0,1161,1162,5,169,0,0,1162,
	1163,5,49,0,0,1163,1164,3,236,118,0,1164,1165,5,50,0,0,1165,1167,1,0,0,
	0,1166,1145,1,0,0,0,1166,1147,1,0,0,0,1166,1152,1,0,0,0,1166,1158,1,0,0,
	0,1166,1161,1,0,0,0,1166,1167,1,0,0,0,1167,1168,1,0,0,0,1168,1169,5,2,0,
	0,1169,115,1,0,0,0,1170,1171,7,11,0,0,1171,1172,3,236,118,0,1172,1173,5,
	2,0,0,1173,117,1,0,0,0,1174,1175,5,86,0,0,1175,1204,5,2,0,0,1176,1177,5,
	86,0,0,1177,1182,3,236,118,0,1178,1179,5,5,0,0,1179,1181,3,236,118,0,1180,
	1178,1,0,0,0,1181,1184,1,0,0,0,1182,1180,1,0,0,0,1182,1183,1,0,0,0,1183,
	1185,1,0,0,0,1184,1182,1,0,0,0,1185,1186,5,2,0,0,1186,1204,1,0,0,0,1187,
	1188,5,86,0,0,1188,1189,5,49,0,0,1189,1194,3,236,118,0,1190,1191,5,5,0,
	0,1191,1193,3,236,118,0,1192,1190,1,0,0,0,1193,1196,1,0,0,0,1194,1192,1,
	0,0,0,1194,1195,1,0,0,0,1195,1198,1,0,0,0,1196,1194,1,0,0,0,1197,1199,5,
	5,0,0,1198,1197,1,0,0,0,1198,1199,1,0,0,0,1199,1200,1,0,0,0,1200,1201,5,
	50,0,0,1201,1202,5,2,0,0,1202,1204,1,0,0,0,1203,1174,1,0,0,0,1203,1176,
	1,0,0,0,1203,1187,1,0,0,0,1204,119,1,0,0,0,1205,1206,5,31,0,0,1206,1207,
	5,49,0,0,1207,1208,3,236,118,0,1208,1209,5,50,0,0,1209,1210,5,2,0,0,1210,
	121,1,0,0,0,1211,1212,5,87,0,0,1212,1215,5,180,0,0,1213,1214,5,12,0,0,1214,
	1216,5,180,0,0,1215,1213,1,0,0,0,1215,1216,1,0,0,0,1216,1217,1,0,0,0,1217,
	1218,5,49,0,0,1218,1230,5,4,0,0,1219,1224,3,224,112,0,1220,1221,5,5,0,0,
	1221,1223,3,224,112,0,1222,1220,1,0,0,0,1223,1226,1,0,0,0,1224,1222,1,0,
	0,0,1224,1225,1,0,0,0,1225,1228,1,0,0,0,1226,1224,1,0,0,0,1227,1229,5,5,
	0,0,1228,1227,1,0,0,0,1228,1229,1,0,0,0,1229,1231,1,0,0,0,1230,1219,1,0,
	0,0,1230,1231,1,0,0,0,1231,1232,1,0,0,0,1232,1233,5,6,0,0,1233,1234,5,50,
	0,0,1234,1245,5,2,0,0,1235,1236,5,87,0,0,1236,1239,5,180,0,0,1237,1238,
	5,12,0,0,1238,1240,5,180,0,0,1239,1237,1,0,0,0,1239,1240,1,0,0,0,1240,1241,
	1,0,0,0,1241,1242,3,226,113,0,1242,1243,5,2,0,0,1243,1245,1,0,0,0,1244,
	1211,1,0,0,0,1244,1235,1,0,0,0,1245,123,1,0,0,0,1246,1250,3,248,124,0,1247,
	1249,3,240,120,0,1248,1247,1,0,0,0,1249,1252,1,0,0,0,1250,1248,1,0,0,0,
	1250,1251,1,0,0,0,1251,1253,1,0,0,0,1252,1250,1,0,0,0,1253,1261,3,14,7,
	0,1254,1255,5,40,0,0,1255,1259,3,236,118,0,1256,1257,5,165,0,0,1257,1258,
	5,49,0,0,1258,1260,5,50,0,0,1259,1256,1,0,0,0,1259,1260,1,0,0,0,1260,1262,
	1,0,0,0,1261,1254,1,0,0,0,1261,1262,1,0,0,0,1262,1263,1,0,0,0,1263,1264,
	5,2,0,0,1264,1294,1,0,0,0,1265,1269,3,84,42,0,1266,1268,3,240,120,0,1267,
	1266,1,0,0,0,1268,1271,1,0,0,0,1269,1267,1,0,0,0,1269,1270,1,0,0,0,1270,
	1272,1,0,0,0,1271,1269,1,0,0,0,1272,1275,3,14,7,0,1273,1274,5,40,0,0,1274,
	1276,3,236,118,0,1275,1273,1,0,0,0,1275,1276,1,0,0,0,1276,1277,1,0,0,0,
	1277,1278,5,2,0,0,1278,1294,1,0,0,0,1279,1283,3,82,41,0,1280,1282,3,240,
	120,0,1281,1280,1,0,0,0,1282,1285,1,0,0,0,1283,1281,1,0,0,0,1283,1284,1,
	0,0,0,1284,1286,1,0,0,0,1285,1283,1,0,0,0,1286,1289,3,14,7,0,1287,1288,
	5,40,0,0,1288,1290,3,236,118,0,1289,1287,1,0,0,0,1289,1290,1,0,0,0,1290,
	1291,1,0,0,0,1291,1292,5,2,0,0,1292,1294,1,0,0,0,1293,1246,1,0,0,0,1293,
	1265,1,0,0,0,1293,1279,1,0,0,0,1294,125,1,0,0,0,1295,1296,3,248,124,0,1296,
	1301,5,180,0,0,1297,1298,5,5,0,0,1298,1299,3,248,124,0,1299,1300,5,180,
	0,0,1300,1302,1,0,0,0,1301,1297,1,0,0,0,1302,1303,1,0,0,0,1303,1301,1,0,
	0,0,1303,1304,1,0,0,0,1304,1305,1,0,0,0,1305,1306,5,40,0,0,1306,1307,3,
	236,118,0,1307,1308,5,2,0,0,1308,1344,1,0,0,0,1309,1310,5,49,0,0,1310,1313,
	3,128,64,0,1311,1312,5,5,0,0,1312,1314,3,128,64,0,1313,1311,1,0,0,0,1314,
	1315,1,0,0,0,1315,1313,1,0,0,0,1315,1316,1,0,0,0,1316,1317,1,0,0,0,1317,
	1318,5,50,0,0,1318,1319,5,40,0,0,1319,1320,5,49,0,0,1320,1323,3,236,118,
	0,1321,1322,5,5,0,0,1322,1324,3,236,118,0,1323,1321,1,0,0,0,1324,1325,1,
	0,0,0,1325,1323,1,0,0,0,1325,1326,1,0,0,0,1326,1327,1,0,0,0,1327,1328,5,
	50,0,0,1328,1329,5,2,0,0,1329,1344,1,0,0,0,1330,1331,5,49,0,0,1331,1334,
	3,128,64,0,1332,1333,5,5,0,0,1333,1335,3,128,64,0,1334,1332,1,0,0,0,1335,
	1336,1,0,0,0,1336,1334,1,0,0,0,1336,1337,1,0,0,0,1337,1338,1,0,0,0,1338,
	1339,5,50,0,0,1339,1340,5,40,0,0,1340,1341,3,236,118,0,1341,1342,5,2,0,
	0,1342,1344,1,0,0,0,1343,1295,1,0,0,0,1343,1309,1,0,0,0,1343,1330,1,0,0,
	0,1344,127,1,0,0,0,1345,1349,3,248,124,0,1346,1348,3,240,120,0,1347,1346,
	1,0,0,0,1348,1351,1,0,0,0,1349,1347,1,0,0,0,1349,1350,1,0,0,0,1350,1352,
	1,0,0,0,1351,1349,1,0,0,0,1352,1353,3,14,7,0,1353,1366,1,0,0,0,1354,1358,
	3,84,42,0,1355,1357,3,240,120,0,1356,1355,1,0,0,0,1357,1360,1,0,0,0,1358,
	1356,1,0,0,0,1358,1359,1,0,0,0,1359,1361,1,0,0,0,1360,1358,1,0,0,0,1361,
	1362,3,14,7,0,1362,1366,1,0,0,0,1363,1366,3,14,7,0,1364,1366,1,0,0,0,1365,
	1345,1,0,0,0,1365,1354,1,0,0,0,1365,1363,1,0,0,0,1365,1364,1,0,0,0,1366,
	129,1,0,0,0,1367,1368,3,236,118,0,1368,131,1,0,0,0,1369,1370,5,88,0,0,1370,
	1371,5,180,0,0,1371,1431,5,2,0,0,1372,1373,5,88,0,0,1373,1374,5,89,0,0,
	1374,1375,5,12,0,0,1375,1376,5,180,0,0,1376,1431,5,2,0,0,1377,1378,5,88,
	0,0,1378,1379,5,89,0,0,1379,1380,5,12,0,0,1380,1385,5,180,0,0,1381,1382,
	5,66,0,0,1382,1383,3,236,118,0,1383,1384,5,67,0,0,1384,1386,1,0,0,0,1385,
	1381,1,0,0,0,1386,1387,1,0,0,0,1387,1385,1,0,0,0,1387,1388,1,0,0,0,1388,
	1389,1,0,0,0,1389,1390,5,2,0,0,1390,1431,1,0,0,0,1391,1392,5,88,0,0,1392,
	1397,5,180,0,0,1393,1394,5,66,0,0,1394,1395,3,236,118,0,1395,1396,5,67,
	0,0,1396,1398,1,0,0,0,1397,1393,1,0,0,0,1398,1399,1,0,0,0,1399,1397,1,0,
	0,0,1399,1400,1,0,0,0,1400,1401,1,0,0,0,1401,1402,5,2,0,0,1402,1431,1,0,
	0,0,1403,1404,5,88,0,0,1404,1407,5,180,0,0,1405,1406,5,12,0,0,1406,1408,
	5,180,0,0,1407,1405,1,0,0,0,1408,1409,1,0,0,0,1409,1407,1,0,0,0,1409,1410,
	1,0,0,0,1410,1415,1,0,0,0,1411,1412,5,66,0,0,1412,1413,3,236,118,0,1413,
	1414,5,67,0,0,1414,1416,1,0,0,0,1415,1411,1,0,0,0,1416,1417,1,0,0,0,1417,
	1415,1,0,0,0,1417,1418,1,0,0,0,1418,1419,1,0,0,0,1419,1420,5,2,0,0,1420,
	1431,1,0,0,0,1421,1422,5,88,0,0,1422,1425,5,180,0,0,1423,1424,5,12,0,0,
	1424,1426,5,180,0,0,1425,1423,1,0,0,0,1426,1427,1,0,0,0,1427,1425,1,0,0,
	0,1427,1428,1,0,0,0,1428,1429,1,0,0,0,1429,1431,5,2,0,0,1430,1369,1,0,0,
	0,1430,1372,1,0,0,0,1430,1377,1,0,0,0,1430,1391,1,0,0,0,1430,1403,1,0,0,
	0,1430,1421,1,0,0,0,1431,133,1,0,0,0,1432,1433,5,90,0,0,1433,1434,5,49,
	0,0,1434,1435,5,154,0,0,1435,1436,5,23,0,0,1436,1439,3,236,118,0,1437,1438,
	5,5,0,0,1438,1440,3,212,106,0,1439,1437,1,0,0,0,1439,1440,1,0,0,0,1440,
	1441,1,0,0,0,1441,1442,5,50,0,0,1442,1443,5,2,0,0,1443,135,1,0,0,0,1444,
	1445,5,90,0,0,1445,1446,5,49,0,0,1446,1449,3,236,118,0,1447,1448,5,5,0,
	0,1448,1450,3,212,106,0,1449,1447,1,0,0,0,1449,1450,1,0,0,0,1450,1451,1,
	0,0,0,1451,1452,5,50,0,0,1452,1453,5,2,0,0,1453,137,1,0,0,0,1454,1455,5,
	91,0,0,1455,1456,5,49,0,0,1456,1457,3,236,118,0,1457,1458,5,50,0,0,1458,
	1461,3,110,55,0,1459,1460,5,92,0,0,1460,1462,3,110,55,0,1461,1459,1,0,0,
	0,1461,1462,1,0,0,0,1462,139,1,0,0,0,1463,1470,3,156,78,0,1464,1470,3,158,
	79,0,1465,1470,3,148,74,0,1466,1470,3,142,71,0,1467,1470,3,144,72,0,1468,
	1470,3,146,73,0,1469,1463,1,0,0,0,1469,1464,1,0,0,0,1469,1465,1,0,0,0,1469,
	1466,1,0,0,0,1469,1467,1,0,0,0,1469,1468,1,0,0,0,1470,141,1,0,0,0,1471,
	1472,5,9,0,0,1472,1473,5,49,0,0,1473,1474,3,248,124,0,1474,1475,5,180,0,
	0,1475,1476,5,5,0,0,1476,1477,3,248,124,0,1477,1478,5,180,0,0,1478,1479,
	5,93,0,0,1479,1480,5,89,0,0,1480,1481,5,12,0,0,1481,1482,5,180,0,0,1482,
	1483,5,12,0,0,1483,1484,5,34,0,0,1484,1485,5,50,0,0,1485,1486,3,110,55,
	0,1486,143,1,0,0,0,1487,1488,5,9,0,0,1488,1489,5,49,0,0,1489,1490,3,248,
	124,0,1490,1491,5,180,0,0,1491,1492,5,94,0,0,1492,1493,5,89,0,0,1493,1494,
	5,12,0,0,1494,1495,5,180,0,0,1495,1496,5,50,0,0,1496,1497,3,110,55,0,1497,
	145,1,0,0,0,1498,1499,5,9,0,0,1499,1500,5,49,0,0,1500,1501,3,248,124,0,
	1501,1502,5,180,0,0,1502,1503,5,93,0,0,1503,1504,5,89,0,0,1504,1505,5,12,
	0,0,1505,1506,5,180,0,0,1506,1507,5,50,0,0,1507,1508,3,110,55,0,1508,147,
	1,0,0,0,1509,1510,5,9,0,0,1510,1511,5,49,0,0,1511,1512,3,150,75,0,1512,
	1514,3,152,76,0,1513,1515,3,154,77,0,1514,1513,1,0,0,0,1514,1515,1,0,0,
	0,1515,1516,1,0,0,0,1516,1517,5,50,0,0,1517,1518,3,110,55,0,1518,149,1,
	0,0,0,1519,1523,3,248,124,0,1520,1522,3,240,120,0,1521,1520,1,0,0,0,1522,
	1525,1,0,0,0,1523,1521,1,0,0,0,1523,1524,1,0,0,0,1524,1526,1,0,0,0,1525,
	1523,1,0,0,0,1526,1529,5,180,0,0,1527,1528,5,40,0,0,1528,1530,3,236,118,
	0,1529,1527,1,0,0,0,1529,1530,1,0,0,0,1530,1531,1,0,0,0,1531,1532,5,2,0,
	0,1532,1540,1,0,0,0,1533,1534,5,180,0,0,1534,1535,7,10,0,0,1535,1536,3,
	236,118,0,1536,1537,5,2,0,0,1537,1540,1,0,0,0,1538,1540,5,2,0,0,1539,1519,
	1,0,0,0,1539,1533,1,0,0,0,1539,1538,1,0,0,0,1540,151,1,0,0,0,1541,1542,
	3,236,118,0,1542,1543,5,2,0,0,1543,153,1,0,0,0,1544,1545,5,180,0,0,1545,
	1546,7,10,0,0,1546,1552,3,236,118,0,1547,1548,5,180,0,0,1548,1552,7,11,
	0,0,1549,1550,7,11,0,0,1550,1552,5,180,0,0,1551,1544,1,0,0,0,1551,1547,
	1,0,0,0,1551,1549,1,0,0,0,1552,155,1,0,0,0,1553,1554,5,95,0,0,1554,1555,
	3,110,55,0,1555,1556,5,96,0,0,1556,1557,5,49,0,0,1557,1558,3,236,118,0,
	1558,1559,5,50,0,0,1559,1560,5,2,0,0,1560,157,1,0,0,0,1561,1562,5,96,0,
	0,1562,1563,5,49,0,0,1563,1564,3,236,118,0,1564,1565,5,50,0,0,1565,1566,
	3,110,55,0,1566,159,1,0,0,0,1567,1568,5,97,0,0,1568,1569,3,220,110,0,1569,
	1570,5,2,0,0,1570,161,1,0,0,0,1571,1573,5,98,0,0,1572,1574,5,151,0,0,1573,
	1572,1,0,0,0,1573,1574,1,0,0,0,1574,1585,1,0,0,0,1575,1576,5,49,0,0,1576,
	1581,5,151,0,0,1577,1578,5,5,0,0,1578,1580,5,151,0,0,1579,1577,1,0,0,0,
	1580,1583,1,0,0,0,1581,1579,1,0,0,0,1581,1582,1,0,0,0,1582,1584,1,0,0,0,
	1583,1581,1,0,0,0,1584,1586,5,50,0,0,1585,1575,1,0,0,0,1585,1586,1,0,0,
	0,1586,1587,1,0,0,0,1587,1588,3,164,82,0,1588,163,1,0,0,0,1589,1593,5,4,
	0,0,1590,1592,3,166,83,0,1591,1590,1,0,0,0,1592,1595,1,0,0,0,1593,1591,
	1,0,0,0,1593,1594,1,0,0,0,1594,1596,1,0,0,0,1595,1593,1,0,0,0,1596,1597,
	5,6,0,0,1597,165,1,0,0,0,1598,1612,3,164,82,0,1599,1612,3,168,84,0,1600,
	1612,3,170,85,0,1601,1612,3,172,86,0,1602,1612,3,174,87,0,1603,1612,3,180,
	90,0,1604,1612,3,182,91,0,1605,1612,5,99,0,0,1606,1612,5,100,0,0,1607,1612,
	5,101,0,0,1608,1612,3,186,93,0,1609,1612,3,190,95,0,1610,1612,3,192,96,
	0,1611,1598,1,0,0,0,1611,1599,1,0,0,0,1611,1600,1,0,0,0,1611,1601,1,0,0,
	0,1611,1602,1,0,0,0,1611,1603,1,0,0,0,1611,1604,1,0,0,0,1611,1605,1,0,0,
	0,1611,1606,1,0,0,0,1611,1607,1,0,0,0,1611,1608,1,0,0,0,1611,1609,1,0,0,
	0,1611,1610,1,0,0,0,1612,167,1,0,0,0,1613,1614,5,102,0,0,1614,1619,3,14,
	7,0,1615,1616,5,5,0,0,1616,1618,3,14,7,0,1617,1615,1,0,0,0,1618,1621,1,
	0,0,0,1619,1617,1,0,0,0,1619,1620,1,0,0,0,1620,1624,1,0,0,0,1621,1619,1,
	0,0,0,1622,1623,5,103,0,0,1623,1625,3,184,92,0,1624,1622,1,0,0,0,1624,1625,
	1,0,0,0,1625,169,1,0,0,0,1626,1631,3,190,95,0,1627,1628,5,5,0,0,1628,1630,
	3,190,95,0,1629,1627,1,0,0,0,1630,1633,1,0,0,0,1631,1629,1,0,0,0,1631,1632,
	1,0,0,0,1632,1634,1,0,0,0,1633,1631,1,0,0,0,1634,1635,5,103,0,0,1635,1636,
	3,184,92,0,1636,171,1,0,0,0,1637,1638,5,91,0,0,1638,1639,3,184,92,0,1639,
	1640,3,164,82,0,1640,173,1,0,0,0,1641,1642,5,104,0,0,1642,1652,3,184,92,
	0,1643,1645,3,176,88,0,1644,1643,1,0,0,0,1645,1646,1,0,0,0,1646,1644,1,
	0,0,0,1646,1647,1,0,0,0,1647,1649,1,0,0,0,1648,1650,3,178,89,0,1649,1648,
	1,0,0,0,1649,1650,1,0,0,0,1650,1653,1,0,0,0,1651,1653,3,178,89,0,1652,1644,
	1,0,0,0,1652,1651,1,0,0,0,1653,175,1,0,0,0,1654,1655,5,105,0,0,1655,1656,
	3,192,96,0,1656,1657,3,164,82,0,1657,177,1,0,0,0,1658,1659,5,106,0,0,1659,
	1660,3,164,82,0,1660,179,1,0,0,0,1661,1662,5,9,0,0,1662,1663,3,164,82,0,
	1663,1664,3,184,92,0,1664,1665,3,164,82,0,1665,1666,3,164,82,0,1666,181,
	1,0,0,0,1667,1668,5,7,0,0,1668,1669,5,180,0,0,1669,1678,5,49,0,0,1670,1675,
	5,180,0,0,1671,1672,5,5,0,0,1672,1674,5,180,0,0,1673,1671,1,0,0,0,1674,
	1677,1,0,0,0,1675,1673,1,0,0,0,1675,1676,1,0,0,0,1676,1679,1,0,0,0,1677,
	1675,1,0,0,0,1678,1670,1,0,0,0,1678,1679,1,0,0,0,1679,1680,1,0,0,0,1680,
	1690,5,50,0,0,1681,1682,5,107,0,0,1682,1687,5,180,0,0,1683,1684,5,5,0,0,
	1684,1686,5,180,0,0,1685,1683,1,0,0,0,1686,1689,1,0,0,0,1687,1685,1,0,0,
	0,1687,1688,1,0,0,0,1688,1691,1,0,0,0,1689,1687,1,0,0,0,1690,1681,1,0,0,
	0,1690,1691,1,0,0,0,1691,1692,1,0,0,0,1692,1693,3,164,82,0,1693,183,1,0,
	0,0,1694,1698,3,186,93,0,1695,1698,3,190,95,0,1696,1698,3,192,96,0,1697,
	1694,1,0,0,0,1697,1695,1,0,0,0,1697,1696,1,0,0,0,1698,185,1,0,0,0,1699,
	1700,3,188,94,0,1700,1709,5,49,0,0,1701,1706,3,184,92,0,1702,1703,5,5,0,
	0,1703,1705,3,184,92,0,1704,1702,1,0,0,0,1705,1708,1,0,0,0,1706,1704,1,
	0,0,0,1706,1707,1,0,0,0,1707,1710,1,0,0,0,1708,1706,1,0,0,0,1709,1701,1,
	0,0,0,1709,1710,1,0,0,0,1710,1711,1,0,0,0,1711,1712,5,50,0,0,1712,187,1,
	0,0,0,1713,1714,7,12,0,0,1714,189,1,0,0,0,1715,1721,3,14,7,0,1716,1717,
	5,12,0,0,1717,1720,3,14,7,0,1718,1720,5,164,0,0,1719,1716,1,0,0,0,1719,
	1718,1,0,0,0,1720,1723,1,0,0,0,1721,1719,1,0,0,0,1721,1722,1,0,0,0,1722,
	191,1,0,0,0,1723,1721,1,0,0,0,1724,1725,7,13,0,0,1725,193,1,0,0,0,1726,
	1727,5,109,0,0,1727,1731,5,4,0,0,1728,1730,3,112,56,0,1729,1728,1,0,0,0,
	1730,1733,1,0,0,0,1731,1729,1,0,0,0,1731,1732,1,0,0,0,1732,1734,1,0,0,0,
	1733,1731,1,0,0,0,1734,1735,5,6,0,0,1735,195,1,0,0,0,1736,1737,5,104,0,
	0,1737,1738,5,49,0,0,1738,1739,3,236,118,0,1739,1740,5,50,0,0,1740,1744,
	5,4,0,0,1741,1743,3,198,99,0,1742,1741,1,0,0,0,1743,1746,1,0,0,0,1744,1742,
	1,0,0,0,1744,1745,1,0,0,0,1745,1748,1,0,0,0,1746,1744,1,0,0,0,1747,1749,
	3,200,100,0,1748,1747,1,0,0,0,1748,1749,1,0,0,0,1749,1750,1,0,0,0,1750,
	1751,5,6,0,0,1751,197,1,0,0,0,1752,1753,5,105,0,0,1753,1754,3,236,118,0,
	1754,1758,5,110,0,0,1755,1757,3,112,56,0,1756,1755,1,0,0,0,1757,1760,1,
	0,0,0,1758,1756,1,0,0,0,1758,1759,1,0,0,0,1759,199,1,0,0,0,1760,1758,1,
	0,0,0,1761,1762,5,106,0,0,1762,1766,5,110,0,0,1763,1765,3,112,56,0,1764,
	1763,1,0,0,0,1765,1768,1,0,0,0,1766,1764,1,0,0,0,1766,1767,1,0,0,0,1767,
	201,1,0,0,0,1768,1766,1,0,0,0,1769,1770,5,111,0,0,1770,1772,3,236,118,0,
	1771,1773,3,204,102,0,1772,1771,1,0,0,0,1772,1773,1,0,0,0,1773,1774,1,0,
	0,0,1774,1776,3,110,55,0,1775,1777,3,206,103,0,1776,1775,1,0,0,0,1777,1778,
	1,0,0,0,1778,1776,1,0,0,0,1778,1779,1,0,0,0,1779,203,1,0,0,0,1780,1781,
	5,73,0,0,1781,1793,5,49,0,0,1782,1787,3,108,54,0,1783,1784,5,5,0,0,1784,
	1786,3,108,54,0,1785,1783,1,0,0,0,1786,1789,1,0,0,0,1787,1785,1,0,0,0,1787,
	1788,1,0,0,0,1788,1791,1,0,0,0,1789,1787,1,0,0,0,1790,1792,5,5,0,0,1791,
	1790,1,0,0,0,1791,1792,1,0,0,0,1792,1794,1,0,0,0,1793,1782,1,0,0,0,1793,
	1794,1,0,0,0,1794,1795,1,0,0,0,1795,1796,5,50,0,0,1796,205,1,0,0,0,1797,
	1799,5,112,0,0,1798,1800,5,180,0,0,1799,1798,1,0,0,0,1799,1800,1,0,0,0,
	1800,1816,1,0,0,0,1801,1813,5,49,0,0,1802,1807,3,108,54,0,1803,1804,5,5,
	0,0,1804,1806,3,108,54,0,1805,1803,1,0,0,0,1806,1809,1,0,0,0,1807,1805,
	1,0,0,0,1807,1808,1,0,0,0,1808,1811,1,0,0,0,1809,1807,1,0,0,0,1810,1812,
	5,5,0,0,1811,1810,1,0,0,0,1811,1812,1,0,0,0,1812,1814,1,0,0,0,1813,1802,
	1,0,0,0,1813,1814,1,0,0,0,1814,1815,1,0,0,0,1815,1817,5,50,0,0,1816,1801,
	1,0,0,0,1816,1817,1,0,0,0,1817,1818,1,0,0,0,1818,1819,3,110,55,0,1819,207,
	1,0,0,0,1820,1821,5,99,0,0,1821,1822,5,2,0,0,1822,209,1,0,0,0,1823,1824,
	5,100,0,0,1824,1825,5,2,0,0,1825,211,1,0,0,0,1826,1830,5,151,0,0,1827,1828,
	5,180,0,0,1828,1830,3,226,113,0,1829,1826,1,0,0,0,1829,1827,1,0,0,0,1830,
	213,1,0,0,0,1831,1832,5,36,0,0,1832,1835,5,180,0,0,1833,1834,5,12,0,0,1834,
	1836,5,180,0,0,1835,1833,1,0,0,0,1835,1836,1,0,0,0,1836,1837,1,0,0,0,1837,
	1838,5,49,0,0,1838,1850,5,4,0,0,1839,1844,3,224,112,0,1840,1841,5,5,0,0,
	1841,1843,3,224,112,0,1842,1840,1,0,0,0,1843,1846,1,0,0,0,1844,1842,1,0,
	0,0,1844,1845,1,0,0,0,1845,1848,1,0,0,0,1846,1844,1,0,0,0,1847,1849,5,5,
	0,0,1848,1847,1,0,0,0,1848,1849,1,0,0,0,1849,1851,1,0,0,0,1850,1839,1,0,
	0,0,1850,1851,1,0,0,0,1851,1852,1,0,0,0,1852,1853,5,6,0,0,1853,1854,5,50,
	0,0,1854,1874,5,2,0,0,1855,1856,5,36,0,0,1856,1859,5,180,0,0,1857,1858,
	5,12,0,0,1858,1860,5,180,0,0,1859,1857,1,0,0,0,1859,1860,1,0,0,0,1860,1861,
	1,0,0,0,1861,1862,3,226,113,0,1862,1863,5,2,0,0,1863,1874,1,0,0,0,1864,
	1865,5,36,0,0,1865,1866,5,49,0,0,1866,1867,5,151,0,0,1867,1868,5,50,0,0,
	1868,1874,5,2,0,0,1869,1870,5,36,0,0,1870,1871,5,49,0,0,1871,1872,5,50,
	0,0,1872,1874,5,2,0,0,1873,1831,1,0,0,0,1873,1855,1,0,0,0,1873,1864,1,0,
	0,0,1873,1869,1,0,0,0,1874,215,1,0,0,0,1875,1876,5,113,0,0,1876,1877,5,
	49,0,0,1877,1878,3,236,118,0,1878,1879,5,50,0,0,1879,1880,5,2,0,0,1880,
	217,1,0,0,0,1881,1884,5,180,0,0,1882,1884,3,242,121,0,1883,1881,1,0,0,0,
	1883,1882,1,0,0,0,1884,219,1,0,0,0,1885,1897,5,49,0,0,1886,1891,3,218,109,
	0,1887,1888,5,5,0,0,1888,1890,3,218,109,0,1889,1887,1,0,0,0,1890,1893,1,
	0,0,0,1891,1889,1,0,0,0,1891,1892,1,0,0,0,1892,1895,1,0,0,0,1893,1891,1,
	0,0,0,1894,1896,5,5,0,0,1895,1894,1,0,0,0,1895,1896,1,0,0,0,1896,1898,1,
	0,0,0,1897,1886,1,0,0,0,1897,1898,1,0,0,0,1898,1899,1,0,0,0,1899,1900,5,
	50,0,0,1900,221,1,0,0,0,1901,1902,5,180,0,0,1902,1926,3,226,113,0,1903,
	1904,5,180,0,0,1904,1905,5,12,0,0,1905,1906,5,180,0,0,1906,1926,3,226,113,
	0,1907,1908,5,180,0,0,1908,1909,5,49,0,0,1909,1921,5,4,0,0,1910,1915,3,
	224,112,0,1911,1912,5,5,0,0,1912,1914,3,224,112,0,1913,1911,1,0,0,0,1914,
	1917,1,0,0,0,1915,1913,1,0,0,0,1915,1916,1,0,0,0,1916,1919,1,0,0,0,1917,
	1915,1,0,0,0,1918,1920,5,5,0,0,1919,1918,1,0,0,0,1919,1920,1,0,0,0,1920,
	1922,1,0,0,0,1921,1910,1,0,0,0,1921,1922,1,0,0,0,1922,1923,1,0,0,0,1923,
	1924,5,6,0,0,1924,1926,5,50,0,0,1925,1901,1,0,0,0,1925,1903,1,0,0,0,1925,
	1907,1,0,0,0,1926,223,1,0,0,0,1927,1928,5,180,0,0,1928,1929,5,110,0,0,1929,
	1930,3,236,118,0,1930,225,1,0,0,0,1931,1943,5,49,0,0,1932,1937,3,236,118,
	0,1933,1934,5,5,0,0,1934,1936,3,236,118,0,1935,1933,1,0,0,0,1936,1939,1,
	0,0,0,1937,1935,1,0,0,0,1937,1938,1,0,0,0,1938,1941,1,0,0,0,1939,1937,1,
	0,0,0,1940,1942,5,5,0,0,1941,1940,1,0,0,0,1941,1942,1,0,0,0,1942,1944,1,
	0,0,0,1943,1932,1,0,0,0,1943,1944,1,0,0,0,1944,1945,1,0,0,0,1945,1946,5,
	50,0,0,1946,227,1,0,0,0,1947,1948,5,4,0,0,1948,1953,3,230,115,0,1949,1950,
	5,5,0,0,1950,1952,3,230,115,0,1951,1949,1,0,0,0,1952,1955,1,0,0,0,1953,
	1951,1,0,0,0,1953,1954,1,0,0,0,1954,1957,1,0,0,0,1955,1953,1,0,0,0,1956,
	1958,5,5,0,0,1957,1956,1,0,0,0,1957,1958,1,0,0,0,1958,1959,1,0,0,0,1959,
	1960,5,6,0,0,1960,229,1,0,0,0,1961,1962,5,180,0,0,1962,1963,5,110,0,0,1963,
	1964,3,236,118,0,1964,231,1,0,0,0,1965,1966,5,49,0,0,1966,1971,3,234,117,
	0,1967,1968,5,5,0,0,1968,1970,3,234,117,0,1969,1967,1,0,0,0,1970,1973,1,
	0,0,0,1971,1969,1,0,0,0,1971,1972,1,0,0,0,1972,1975,1,0,0,0,1973,1971,1,
	0,0,0,1974,1976,5,5,0,0,1975,1974,1,0,0,0,1975,1976,1,0,0,0,1976,1977,1,
	0,0,0,1977,1978,5,50,0,0,1978,233,1,0,0,0,1979,1982,3,248,124,0,1980,1982,
	3,84,42,0,1981,1979,1,0,0,0,1981,1980,1,0,0,0,1982,235,1,0,0,0,1983,1984,
	6,118,-1,0,1984,1985,5,49,0,0,1985,1986,5,180,0,0,1986,1987,7,10,0,0,1987,
	1988,3,236,118,0,1988,1989,5,50,0,0,1989,2154,1,0,0,0,1990,1991,5,49,0,
	0,1991,1992,5,114,0,0,1992,1993,5,180,0,0,1993,1994,5,50,0,0,1994,1995,
	3,228,114,0,1995,1996,3,226,113,0,1996,2154,1,0,0,0,1997,1998,5,49,0,0,
	1998,1999,3,236,118,0,1999,2000,5,50,0,0,2000,2154,1,0,0,0,2001,2002,5,
	49,0,0,2002,2005,3,236,118,0,2003,2004,5,5,0,0,2004,2006,3,236,118,0,2005,
	2003,1,0,0,0,2006,2007,1,0,0,0,2007,2005,1,0,0,0,2007,2008,1,0,0,0,2008,
	2009,1,0,0,0,2009,2010,5,50,0,0,2010,2154,1,0,0,0,2011,2012,3,250,125,0,
	2012,2013,5,49,0,0,2013,2015,3,236,118,0,2014,2016,5,5,0,0,2015,2014,1,
	0,0,0,2015,2016,1,0,0,0,2016,2017,1,0,0,0,2017,2018,5,50,0,0,2018,2154,
	1,0,0,0,2019,2154,3,222,111,0,2020,2021,5,114,0,0,2021,2023,5,180,0,0,2022,
	2024,3,228,114,0,2023,2022,1,0,0,0,2023,2024,1,0,0,0,2024,2025,1,0,0,0,
	2025,2154,3,226,113,0,2026,2027,5,114,0,0,2027,2030,3,248,124,0,2028,2029,
	5,66,0,0,2029,2031,5,67,0,0,2030,2028,1,0,0,0,2031,2032,1,0,0,0,2032,2030,
	1,0,0,0,2032,2033,1,0,0,0,2033,2034,1,0,0,0,2034,2035,5,49,0,0,2035,2036,
	3,236,118,0,2036,2037,5,50,0,0,2037,2154,1,0,0,0,2038,2039,5,114,0,0,2039,
	2040,5,148,0,0,2040,2041,5,49,0,0,2041,2042,3,236,118,0,2042,2043,5,50,
	0,0,2043,2154,1,0,0,0,2044,2045,5,114,0,0,2045,2046,5,146,0,0,2046,2047,
	5,49,0,0,2047,2048,3,236,118,0,2048,2049,5,50,0,0,2049,2154,1,0,0,0,2050,
	2051,5,55,0,0,2051,2052,5,49,0,0,2052,2053,3,248,124,0,2053,2054,5,50,0,
	0,2054,2055,5,12,0,0,2055,2056,5,180,0,0,2056,2154,1,0,0,0,2057,2058,5,
	115,0,0,2058,2154,3,226,113,0,2059,2060,5,116,0,0,2060,2154,3,226,113,0,
	2061,2062,5,117,0,0,2062,2154,3,226,113,0,2063,2064,5,118,0,0,2064,2154,
	3,226,113,0,2065,2066,5,119,0,0,2066,2067,5,49,0,0,2067,2068,7,14,0,0,2068,
	2069,5,12,0,0,2069,2070,5,180,0,0,2070,2071,5,5,0,0,2071,2072,3,226,113,
	0,2072,2073,5,50,0,0,2073,2154,1,0,0,0,2074,2075,5,120,0,0,2075,2154,3,
	226,113,0,2076,2077,5,121,0,0,2077,2154,3,226,113,0,2078,2079,5,122,0,0,
	2079,2080,5,49,0,0,2080,2081,3,236,118,0,2081,2082,5,5,0,0,2082,2083,3,
	232,116,0,2083,2084,5,50,0,0,2084,2154,1,0,0,0,2085,2086,5,123,0,0,2086,
	2087,5,49,0,0,2087,2088,3,236,118,0,2088,2089,5,5,0,0,2089,2090,3,232,116,
	0,2090,2091,5,5,0,0,2091,2092,5,145,0,0,2092,2093,5,50,0,0,2093,2154,1,
	0,0,0,2094,2095,5,124,0,0,2095,2096,5,66,0,0,2096,2097,3,236,118,0,2097,
	2098,5,67,0,0,2098,2099,7,15,0,0,2099,2154,1,0,0,0,2100,2101,5,125,0,0,
	2101,2102,5,66,0,0,2102,2103,3,236,118,0,2103,2104,5,67,0,0,2104,2105,7,
	16,0,0,2105,2154,1,0,0,0,2106,2107,7,11,0,0,2107,2154,3,236,118,22,2108,
	2109,7,17,0,0,2109,2154,3,236,118,21,2110,2122,5,66,0,0,2111,2116,3,236,
	118,0,2112,2113,5,5,0,0,2113,2115,3,236,118,0,2114,2112,1,0,0,0,2115,2118,
	1,0,0,0,2116,2114,1,0,0,0,2116,2117,1,0,0,0,2117,2120,1,0,0,0,2118,2116,
	1,0,0,0,2119,2121,5,5,0,0,2120,2119,1,0,0,0,2120,2121,1,0,0,0,2121,2123,
	1,0,0,0,2122,2111,1,0,0,0,2122,2123,1,0,0,0,2123,2124,1,0,0,0,2124,2154,
	5,67,0,0,2125,2126,5,89,0,0,2126,2127,5,12,0,0,2127,2128,5,180,0,0,2128,
	2129,5,12,0,0,2129,2130,5,180,0,0,2130,2131,5,66,0,0,2131,2132,3,236,118,
	0,2132,2133,5,67,0,0,2133,2134,3,238,119,0,2134,2154,1,0,0,0,2135,2136,
	5,89,0,0,2136,2137,5,12,0,0,2137,2142,5,180,0,0,2138,2139,5,66,0,0,2139,
	2140,3,236,118,0,2140,2141,5,67,0,0,2141,2143,1,0,0,0,2142,2138,1,0,0,0,
	2143,2144,1,0,0,0,2144,2142,1,0,0,0,2144,2145,1,0,0,0,2145,2154,1,0,0,0,
	2146,2147,5,89,0,0,2147,2148,5,12,0,0,2148,2154,5,180,0,0,2149,2154,5,89,
	0,0,2150,2154,5,160,0,0,2151,2154,3,14,7,0,2152,2154,3,242,121,0,2153,1983,
	1,0,0,0,2153,1990,1,0,0,0,2153,1997,1,0,0,0,2153,2001,1,0,0,0,2153,2011,
	1,0,0,0,2153,2019,1,0,0,0,2153,2020,1,0,0,0,2153,2026,1,0,0,0,2153,2038,
	1,0,0,0,2153,2044,1,0,0,0,2153,2050,1,0,0,0,2153,2057,1,0,0,0,2153,2059,
	1,0,0,0,2153,2061,1,0,0,0,2153,2063,1,0,0,0,2153,2065,1,0,0,0,2153,2074,
	1,0,0,0,2153,2076,1,0,0,0,2153,2078,1,0,0,0,2153,2085,1,0,0,0,2153,2094,
	1,0,0,0,2153,2100,1,0,0,0,2153,2106,1,0,0,0,2153,2108,1,0,0,0,2153,2110,
	1,0,0,0,2153,2125,1,0,0,0,2153,2135,1,0,0,0,2153,2146,1,0,0,0,2153,2149,
	1,0,0,0,2153,2150,1,0,0,0,2153,2151,1,0,0,0,2153,2152,1,0,0,0,2154,2265,
	1,0,0,0,2155,2156,10,20,0,0,2156,2157,5,17,0,0,2157,2264,3,236,118,20,2158,
	2159,10,19,0,0,2159,2160,7,18,0,0,2160,2264,3,236,118,20,2161,2162,10,18,
	0,0,2162,2163,7,19,0,0,2163,2264,3,236,118,19,2164,2165,10,17,0,0,2165,
	2166,7,20,0,0,2166,2264,3,236,118,18,2167,2168,10,16,0,0,2168,2169,7,21,
	0,0,2169,2264,3,236,118,17,2170,2171,10,15,0,0,2171,2172,7,22,0,0,2172,
	2264,3,236,118,16,2173,2174,10,14,0,0,2174,2175,5,24,0,0,2175,2264,3,236,
	118,15,2176,2177,10,13,0,0,2177,2178,5,26,0,0,2178,2264,3,236,118,14,2179,
	2180,10,12,0,0,2180,2181,5,25,0,0,2181,2264,3,236,118,13,2182,2183,10,11,
	0,0,2183,2184,5,130,0,0,2184,2264,3,236,118,12,2185,2186,10,10,0,0,2186,
	2187,5,131,0,0,2187,2264,3,236,118,11,2188,2189,10,9,0,0,2189,2190,5,132,
	0,0,2190,2191,3,236,118,0,2191,2192,5,110,0,0,2192,2193,3,236,118,9,2193,
	2264,1,0,0,0,2194,2195,10,34,0,0,2195,2197,5,66,0,0,2196,2198,3,236,118,
	0,2197,2196,1,0,0,0,2197,2198,1,0,0,0,2198,2199,1,0,0,0,2199,2201,5,110,
	0,0,2200,2202,3,236,118,0,2201,2200,1,0,0,0,2201,2202,1,0,0,0,2202,2203,
	1,0,0,0,2203,2264,5,67,0,0,2204,2205,10,33,0,0,2205,2206,5,66,0,0,2206,
	2207,5,145,0,0,2207,2264,5,67,0,0,2208,2209,10,32,0,0,2209,2210,5,66,0,
	0,2210,2211,3,236,118,0,2211,2212,5,67,0,0,2212,2264,1,0,0,0,2213,2214,
	10,29,0,0,2214,2264,7,23,0,0,2215,2216,10,28,0,0,2216,2217,5,167,0,0,2217,
	2218,5,49,0,0,2218,2219,3,236,118,0,2219,2220,5,50,0,0,2220,2264,1,0,0,
	0,2221,2222,10,27,0,0,2222,2223,5,168,0,0,2223,2224,5,49,0,0,2224,2225,
	3,236,118,0,2225,2226,5,5,0,0,2226,2227,3,236,118,0,2227,2228,5,50,0,0,
	2228,2264,1,0,0,0,2229,2230,10,26,0,0,2230,2231,5,12,0,0,2231,2233,5,180,
	0,0,2232,2234,3,228,114,0,2233,2232,1,0,0,0,2233,2234,1,0,0,0,2234,2235,
	1,0,0,0,2235,2236,5,49,0,0,2236,2248,5,4,0,0,2237,2242,3,224,112,0,2238,
	2239,5,5,0,0,2239,2241,3,224,112,0,2240,2238,1,0,0,0,2241,2244,1,0,0,0,
	2242,2240,1,0,0,0,2242,2243,1,0,0,0,2243,2246,1,0,0,0,2244,2242,1,0,0,0,
	2245,2247,5,5,0,0,2246,2245,1,0,0,0,2246,2247,1,0,0,0,2247,2249,1,0,0,0,
	2248,2237,1,0,0,0,2248,2249,1,0,0,0,2249,2250,1,0,0,0,2250,2251,5,6,0,0,
	2251,2264,5,50,0,0,2252,2253,10,25,0,0,2253,2254,5,12,0,0,2254,2256,5,180,
	0,0,2255,2257,3,228,114,0,2256,2255,1,0,0,0,2256,2257,1,0,0,0,2257,2258,
	1,0,0,0,2258,2264,3,226,113,0,2259,2260,10,24,0,0,2260,2264,3,238,119,0,
	2261,2262,10,23,0,0,2262,2264,7,11,0,0,2263,2155,1,0,0,0,2263,2158,1,0,
	0,0,2263,2161,1,0,0,0,2263,2164,1,0,0,0,2263,2167,1,0,0,0,2263,2170,1,0,
	0,0,2263,2173,1,0,0,0,2263,2176,1,0,0,0,2263,2179,1,0,0,0,2263,2182,1,0,
	0,0,2263,2185,1,0,0,0,2263,2188,1,0,0,0,2263,2194,1,0,0,0,2263,2204,1,0,
	0,0,2263,2208,1,0,0,0,2263,2213,1,0,0,0,2263,2215,1,0,0,0,2263,2221,1,0,
	0,0,2263,2229,1,0,0,0,2263,2252,1,0,0,0,2263,2259,1,0,0,0,2263,2261,1,0,
	0,0,2264,2267,1,0,0,0,2265,2263,1,0,0,0,2265,2266,1,0,0,0,2266,237,1,0,
	0,0,2267,2265,1,0,0,0,2268,2269,5,12,0,0,2269,2282,5,180,0,0,2270,2282,
	5,163,0,0,2271,2282,5,172,0,0,2272,2282,5,173,0,0,2273,2282,5,174,0,0,2274,
	2282,5,175,0,0,2275,2282,5,176,0,0,2276,2282,5,177,0,0,2277,2282,5,178,
	0,0,2278,2282,5,179,0,0,2279,2282,5,170,0,0,2280,2282,5,171,0,0,2281,2268,
	1,0,0,0,2281,2270,1,0,0,0,2281,2271,1,0,0,0,2281,2272,1,0,0,0,2281,2273,
	1,0,0,0,2281,2274,1,0,0,0,2281,2275,1,0,0,0,2281,2276,1,0,0,0,2281,2277,
	1,0,0,0,2281,2278,1,0,0,0,2281,2279,1,0,0,0,2281,2280,1,0,0,0,2282,239,
	1,0,0,0,2283,2284,7,24,0,0,2284,241,1,0,0,0,2285,2300,5,141,0,0,2286,2300,
	3,244,122,0,2287,2300,3,246,123,0,2288,2292,5,151,0,0,2289,2291,5,151,0,
	0,2290,2289,1,0,0,0,2291,2294,1,0,0,0,2292,2290,1,0,0,0,2292,2293,1,0,0,
	0,2293,2300,1,0,0,0,2294,2292,1,0,0,0,2295,2300,5,161,0,0,2296,2300,5,162,
	0,0,2297,2300,5,152,0,0,2298,2300,5,153,0,0,2299,2285,1,0,0,0,2299,2286,
	1,0,0,0,2299,2287,1,0,0,0,2299,2288,1,0,0,0,2299,2295,1,0,0,0,2299,2296,
	1,0,0,0,2299,2297,1,0,0,0,2299,2298,1,0,0,0,2300,243,1,0,0,0,2301,2303,
	5,145,0,0,2302,2304,7,25,0,0,2303,2302,1,0,0,0,2303,2304,1,0,0,0,2304,245,
	1,0,0,0,2305,2307,5,144,0,0,2306,2308,7,25,0,0,2307,2306,1,0,0,0,2307,2308,
	1,0,0,0,2308,247,1,0,0,0,2309,2310,5,108,0,0,2310,2360,5,59,0,0,2311,2360,
	5,108,0,0,2312,2360,5,146,0,0,2313,2360,5,147,0,0,2314,2360,5,149,0,0,2315,
	2360,5,148,0,0,2316,2360,5,156,0,0,2317,2360,5,157,0,0,2318,2360,5,138,
	0,0,2319,2360,5,139,0,0,2320,2360,5,158,0,0,2321,2360,5,159,0,0,2322,2323,
	5,7,0,0,2323,2332,5,49,0,0,2324,2329,3,248,124,0,2325,2326,5,5,0,0,2326,
	2328,3,248,124,0,2327,2325,1,0,0,0,2328,2331,1,0,0,0,2329,2327,1,0,0,0,
	2329,2330,1,0,0,0,2330,2333,1,0,0,0,2331,2329,1,0,0,0,2332,2324,1,0,0,0,
	2332,2333,1,0,0,0,2333,2334,1,0,0,0,2334,2338,5,50,0,0,2335,2337,7,26,0,
	0,2336,2335,1,0,0,0,2337,2340,1,0,0,0,2338,2336,1,0,0,0,2338,2339,1,0,0,
	0,2339,2353,1,0,0,0,2340,2338,1,0,0,0,2341,2342,5,73,0,0,2342,2343,5,49,
	0,0,2343,2348,3,248,124,0,2344,2345,5,5,0,0,2345,2347,3,248,124,0,2346,
	2344,1,0,0,0,2347,2350,1,0,0,0,2348,2346,1,0,0,0,2348,2349,1,0,0,0,2349,
	2351,1,0,0,0,2350,2348,1,0,0,0,2351,2352,5,50,0,0,2352,2354,1,0,0,0,2353,
	2341,1,0,0,0,2353,2354,1,0,0,0,2354,2360,1,0,0,0,2355,2356,5,180,0,0,2356,
	2357,5,12,0,0,2357,2360,5,180,0,0,2358,2360,5,180,0,0,2359,2309,1,0,0,0,
	2359,2311,1,0,0,0,2359,2312,1,0,0,0,2359,2313,1,0,0,0,2359,2314,1,0,0,0,
	2359,2315,1,0,0,0,2359,2316,1,0,0,0,2359,2317,1,0,0,0,2359,2318,1,0,0,0,
	2359,2319,1,0,0,0,2359,2320,1,0,0,0,2359,2321,1,0,0,0,2359,2322,1,0,0,0,
	2359,2355,1,0,0,0,2359,2358,1,0,0,0,2360,249,1,0,0,0,2361,2362,7,27,0,0,
	2362,251,1,0,0,0,268,255,261,275,277,297,301,308,313,321,325,331,343,346,
	356,360,368,371,375,380,384,400,404,411,414,417,431,434,445,447,462,477,
	481,497,499,505,510,518,521,538,540,547,554,556,560,572,576,578,582,588,
	591,594,604,608,610,617,621,623,631,638,651,655,662,682,688,694,701,711,
	718,724,728,734,742,750,757,764,771,778,784,789,791,797,804,806,812,814,
	820,825,831,838,844,850,854,859,867,872,880,890,895,899,911,920,922,928,
	932,934,941,948,958,960,964,970,977,993,1002,1006,1012,1021,1025,1033,1037,
	1043,1047,1053,1057,1059,1067,1071,1073,1081,1085,1091,1095,1101,1105,1107,
	1113,1118,1142,1155,1166,1182,1194,1198,1203,1215,1224,1228,1230,1239,1244,
	1250,1259,1261,1269,1275,1283,1289,1293,1303,1315,1325,1336,1343,1349,1358,
	1365,1387,1399,1409,1417,1427,1430,1439,1449,1461,1469,1514,1523,1529,1539,
	1551,1573,1581,1585,1593,1611,1619,1624,1631,1646,1649,1652,1675,1678,1687,
	1690,1697,1706,1709,1719,1721,1731,1744,1748,1758,1766,1772,1778,1787,1791,
	1793,1799,1807,1811,1813,1816,1829,1835,1844,1848,1850,1859,1873,1883,1891,
	1895,1897,1915,1919,1921,1925,1937,1941,1943,1953,1957,1971,1975,1981,2007,
	2015,2023,2032,2116,2120,2122,2144,2153,2197,2201,2233,2242,2246,2248,2256,
	2263,2265,2281,2292,2299,2303,2307,2329,2332,2338,2348,2353,2359];

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
	public eventDefinition_list(): EventDefinitionContext[] {
		return this.getTypedRuleContexts(EventDefinitionContext) as EventDefinitionContext[];
	}
	public eventDefinition(i: number): EventDefinitionContext {
		return this.getTypedRuleContext(EventDefinitionContext, i) as EventDefinitionContext;
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
	public mappingType(): MappingTypeContext {
		return this.getTypedRuleContext(MappingTypeContext, 0) as MappingTypeContext;
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
	public mappingType(): MappingTypeContext {
		return this.getTypedRuleContext(MappingTypeContext, 0) as MappingTypeContext;
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
	public arrayType(): ArrayTypeContext {
		return this.getTypedRuleContext(ArrayTypeContext, 0) as ArrayTypeContext;
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
	public overrideSpecifier_list(): OverrideSpecifierContext[] {
		return this.getTypedRuleContexts(OverrideSpecifierContext) as OverrideSpecifierContext[];
	}
	public overrideSpecifier(i: number): OverrideSpecifierContext {
		return this.getTypedRuleContext(OverrideSpecifierContext, i) as OverrideSpecifierContext;
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
	public mappingType(): MappingTypeContext {
		return this.getTypedRuleContext(MappingTypeContext, 0) as MappingTypeContext;
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
	public DotPush(): TerminalNode {
		return this.getToken(SolidCashParser.DotPush, 0);
	}
	public arrayType(): ArrayTypeContext {
		return this.getTypedRuleContext(ArrayTypeContext, 0) as ArrayTypeContext;
	}
	public mappingType(): MappingTypeContext {
		return this.getTypedRuleContext(MappingTypeContext, 0) as MappingTypeContext;
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
	public arrayType(): ArrayTypeContext {
		return this.getTypedRuleContext(ArrayTypeContext, 0) as ArrayTypeContext;
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
	public StringLiteral_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.StringLiteral);
	}
	public StringLiteral(i: number): TerminalNode {
		return this.getToken(SolidCashParser.StringLiteral, i);
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
export class NewDynamicStringContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public PrimitiveType(): TerminalNode {
		return this.getToken(SolidCashParser.PrimitiveType, 0);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitNewDynamicString) {
			return visitor.visitNewDynamicString(this);
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
export class PrefixOpContext extends ExpressionContext {
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
		if (visitor.visitPrefixOp) {
			return visitor.visitPrefixOp(this);
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
