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
			this.state = 276;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1842241) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 274;
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
					this.interfaceDefinition();
					}
					break;
				case 8:
					{
					this.state = 271;
					this.freeFunctionDefinition();
					}
					break;
				case 9:
					{
					this.state = 272;
					this.libraryDefinition();
					}
					break;
				case 10:
					{
					this.state = 273;
					this.contractDefinition();
					}
					break;
				}
				}
				this.state = 278;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 279;
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
			this.state = 307;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 6, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 281;
				this.match(SolidCashParser.T__0);
				this.state = 282;
				this.match(SolidCashParser.StringLiteral);
				this.state = 283;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 284;
				this.match(SolidCashParser.T__0);
				this.state = 285;
				this.match(SolidCashParser.StringLiteral);
				this.state = 286;
				this.match(SolidCashParser.T__2);
				this.state = 287;
				this.match(SolidCashParser.Identifier);
				this.state = 288;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 289;
				this.match(SolidCashParser.T__0);
				this.state = 290;
				this.match(SolidCashParser.T__3);
				this.state = 291;
				this.importBinding();
				this.state = 296;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 292;
						this.match(SolidCashParser.T__4);
						this.state = 293;
						this.importBinding();
						}
						}
					}
					this.state = 298;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				}
				this.state = 300;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 299;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 302;
				this.match(SolidCashParser.T__5);
				this.state = 303;
				this.match(SolidCashParser.Identifier);
				this.state = 304;
				this.match(SolidCashParser.StringLiteral);
				this.state = 305;
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
			this.state = 309;
			this.match(SolidCashParser.Identifier);
			this.state = 312;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 310;
				this.match(SolidCashParser.T__2);
				this.state = 311;
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
			this.state = 314;
			this.match(SolidCashParser.T__6);
			this.state = 315;
			this.anyIdentifier();
			this.state = 316;
			this.parameterList();
			this.state = 320;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 317;
				this.functionModifier();
				}
				}
				this.state = 322;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 324;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 323;
				this.returnType();
				}
			}

			this.state = 326;
			this.match(SolidCashParser.T__3);
			this.state = 330;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 327;
				this.statement();
				}
				}
				this.state = 332;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 333;
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
			this.state = 372;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 17, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 335;
				this.match(SolidCashParser.T__7);
				this.state = 336;
				this.match(SolidCashParser.Identifier);
				this.state = 337;
				this.match(SolidCashParser.T__8);
				this.state = 341;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 11, this._ctx) ) {
				case 1:
					{
					this.state = 338;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 339;
					this.typeName();
					}
					break;
				case 3:
					{
					this.state = 340;
					this.match(SolidCashParser.T__9);
					}
					break;
				}
				this.state = 344;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 343;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 346;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 347;
				this.match(SolidCashParser.T__7);
				this.state = 348;
				this.match(SolidCashParser.T__3);
				this.state = 349;
				this.usingFunctionBinding();
				this.state = 354;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 350;
						this.match(SolidCashParser.T__4);
						this.state = 351;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 356;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				}
				this.state = 358;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 357;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 360;
				this.match(SolidCashParser.T__5);
				this.state = 361;
				this.match(SolidCashParser.T__8);
				this.state = 365;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 15, this._ctx) ) {
				case 1:
					{
					this.state = 362;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 363;
					this.typeName();
					}
					break;
				case 3:
					{
					this.state = 364;
					this.match(SolidCashParser.T__9);
					}
					break;
				}
				this.state = 368;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 367;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 370;
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
			this.state = 374;
			this.match(SolidCashParser.Identifier);
			this.state = 377;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===12) {
				{
				this.state = 375;
				this.match(SolidCashParser.T__11);
				this.state = 376;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 381;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 379;
				this.match(SolidCashParser.T__2);
				this.state = 380;
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
			this.state = 383;
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
			this.state = 385;
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
			this.state = 401;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 21, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 387;
				this.match(SolidCashParser.T__36);
				this.state = 388;
				this.pragmaName();
				this.state = 389;
				this.pragmaValue();
				this.state = 390;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 392;
				this.match(SolidCashParser.T__36);
				this.state = 393;
				this.match(SolidCashParser.Identifier);
				this.state = 397;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 2081) !== 0) || _la===180) {
					{
					{
					this.state = 394;
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
					this.state = 399;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 400;
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
			this.state = 403;
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
			this.state = 411;
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
				this.state = 406;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 405;
					this.versionConstraint();
					}
					}
					this.state = 408;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0) || _la===140 || _la===144);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 410;
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
			this.state = 414;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0)) {
				{
				this.state = 413;
				this.versionOperator();
				}
			}

			this.state = 416;
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
			this.state = 418;
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
			this.state = 420;
			this.match(SolidCashParser.T__40);
			this.state = 421;
			this.match(SolidCashParser.Identifier);
			this.state = 431;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 422;
				this.match(SolidCashParser.T__41);
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
			this.state = 444;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1843969) !== 0)) {
				{
				this.state = 442;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 27, this._ctx) ) {
				case 1:
					{
					this.state = 434;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 435;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 436;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 437;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 438;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 439;
					this.interfaceStateVariable();
					}
					break;
				case 7:
					{
					this.state = 440;
					this.interfaceCollection();
					}
					break;
				case 8:
					{
					this.state = 441;
					this.interfaceFunction();
					}
					break;
				}
				}
				this.state = 446;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 447;
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
			this.state = 459;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 29, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 449;
				this.interfaceStateVariableVisibility();
				this.state = 450;
				this.mappingType();
				this.state = 451;
				this.match(SolidCashParser.Identifier);
				this.state = 452;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 454;
				this.interfaceStateVariableVisibility();
				this.state = 455;
				this.arrayType(0);
				this.state = 456;
				this.match(SolidCashParser.Identifier);
				this.state = 457;
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
			this.state = 461;
			this.interfaceStateVariableVisibility();
			this.state = 462;
			this.typeName();
			this.state = 463;
			this.match(SolidCashParser.Identifier);
			this.state = 464;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 466;
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
			this.state = 468;
			this.match(SolidCashParser.T__6);
			this.state = 469;
			this.match(SolidCashParser.Identifier);
			this.state = 470;
			this.parameterList();
			this.state = 474;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 471;
				this.functionModifier();
				}
				}
				this.state = 476;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 478;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 477;
				this.returnType();
				}
			}

			this.state = 480;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 482;
			this.match(SolidCashParser.T__44);
			this.state = 483;
			this.match(SolidCashParser.Identifier);
			this.state = 484;
			this.match(SolidCashParser.T__3);
			this.state = 496;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 815538945) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 494;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 32, this._ctx) ) {
				case 1:
					{
					this.state = 485;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 486;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 487;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 488;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 489;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 490;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 491;
					this.stateVariableDeclaration();
					}
					break;
				case 8:
					{
					this.state = 492;
					this.usingForDirective();
					}
					break;
				case 9:
					{
					this.state = 493;
					this.freeFunctionDefinition();
					}
					break;
				}
				}
				this.state = 498;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 499;
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
			this.state = 502;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===46) {
				{
				this.state = 501;
				this.match(SolidCashParser.T__45);
				}
			}

			this.state = 504;
			this.match(SolidCashParser.T__46);
			this.state = 505;
			this.match(SolidCashParser.Identifier);
			this.state = 507;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 506;
				this.parameterList();
				}
			}

			this.state = 518;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 509;
				this.match(SolidCashParser.T__41);
				this.state = 510;
				this.inheritanceSpecifier();
				this.state = 515;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 511;
					this.match(SolidCashParser.T__4);
					this.state = 512;
					this.inheritanceSpecifier();
					}
					}
					this.state = 517;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 520;
			this.match(SolidCashParser.T__3);
			this.state = 537;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 268435459) !== 0) || ((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 37411875) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 535;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 38, this._ctx) ) {
				case 1:
					{
					this.state = 521;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 522;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 523;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 524;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 525;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 526;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 527;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 528;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 529;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 530;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 531;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 532;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 533;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 534;
					this.receiveDefinition();
					}
					break;
				}
				}
				this.state = 539;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 540;
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
			this.state = 542;
			this.match(SolidCashParser.Identifier);
			this.state = 544;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 543;
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
			this.state = 546;
			this.match(SolidCashParser.T__6);
			this.state = 547;
			this.anyIdentifier();
			this.state = 548;
			this.parameterList();
			this.state = 553;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0) || _la===180) {
				{
				this.state = 551;
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
					this.state = 549;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 550;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
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
		this.enterRule(localctx, 44, SolidCashParser.RULE_eventDefinition);
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
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 564;
				this.eventParameter();
				this.state = 569;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 44, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 44, this._ctx);
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
		this.enterRule(localctx, 46, SolidCashParser.RULE_eventParameter);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 585;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 48, this._ctx) ) {
			case 1:
				{
				this.state = 583;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 584;
				this.arrayType(0);
				}
				break;
			}
			this.state = 588;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===52) {
				{
				this.state = 587;
				this.match(SolidCashParser.T__51);
				}
			}

			this.state = 591;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 590;
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
			this.state = 593;
			this.match(SolidCashParser.T__34);
			this.state = 594;
			this.match(SolidCashParser.Identifier);
			this.state = 595;
			this.match(SolidCashParser.T__48);
			this.state = 607;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 596;
				this.errorParameter();
				this.state = 601;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 597;
						this.match(SolidCashParser.T__4);
						this.state = 598;
						this.errorParameter();
						}
						}
					}
					this.state = 603;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				}
				this.state = 605;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 604;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 609;
			this.match(SolidCashParser.T__49);
			this.state = 610;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 612;
			this.typeName();
			this.state = 614;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 613;
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
			this.state = 616;
			this.match(SolidCashParser.T__52);
			this.state = 617;
			this.match(SolidCashParser.Identifier);
			this.state = 618;
			this.match(SolidCashParser.T__3);
			this.state = 620;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 619;
				this.structField();
				}
				}
				this.state = 622;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180);
			this.state = 624;
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
			this.state = 629;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 56, this._ctx) ) {
			case 1:
				{
				this.state = 626;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 627;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 628;
				this.mappingType();
				}
				break;
			}
			this.state = 631;
			this.anyIdentifier();
			this.state = 632;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 634;
			this.match(SolidCashParser.T__53);
			this.state = 635;
			this.match(SolidCashParser.Identifier);
			this.state = 636;
			this.match(SolidCashParser.T__3);
			this.state = 637;
			this.enumMember();
			this.state = 642;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 57, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 638;
					this.match(SolidCashParser.T__4);
					this.state = 639;
					this.enumMember();
					}
					}
				}
				this.state = 644;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 57, this._ctx);
			}
			this.state = 646;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 645;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 648;
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
			this.state = 650;
			this.match(SolidCashParser.Identifier);
			this.state = 653;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 651;
				this.match(SolidCashParser.T__39);
				this.state = 652;
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
			this.state = 655;
			this.match(SolidCashParser.T__54);
			this.state = 656;
			this.match(SolidCashParser.Identifier);
			this.state = 657;
			this.match(SolidCashParser.T__41);
			this.state = 658;
			this.typeName();
			this.state = 659;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 661;
			this.typeName();
			this.state = 662;
			this.match(SolidCashParser.T__55);
			this.state = 663;
			this.match(SolidCashParser.Identifier);
			this.state = 664;
			this.match(SolidCashParser.T__39);
			this.state = 665;
			this.expression(0);
			this.state = 666;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 668;
			this.match(SolidCashParser.T__56);
			this.state = 669;
			this.parameterList();
			this.state = 673;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 98307) !== 0)) {
				{
				{
				this.state = 670;
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
				this.state = 675;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 679;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 676;
				this.parentInvocation();
				}
				}
				this.state = 681;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 682;
			this.match(SolidCashParser.T__3);
			this.state = 686;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 683;
				this.statement();
				}
				}
				this.state = 688;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 689;
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
			this.state = 691;
			this.match(SolidCashParser.T__59);
			this.state = 692;
			this.parameterList();
			this.state = 693;
			this.match(SolidCashParser.T__43);
			this.state = 697;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 8197) !== 0)) {
				{
				{
				this.state = 694;
				this.fallbackModifier();
				}
				}
				this.state = 699;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 703;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 700;
				this.customModifierInvocation();
				}
				}
				this.state = 705;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 707;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 706;
				this.returnType();
				}
			}

			this.state = 709;
			this.match(SolidCashParser.T__3);
			this.state = 713;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 710;
				this.statement();
				}
				}
				this.state = 715;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
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
	public fallbackModifier(): FallbackModifierContext {
		let localctx: FallbackModifierContext = new FallbackModifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 68, SolidCashParser.RULE_fallbackModifier);
		try {
			this.state = 721;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 59:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 718;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 719;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 720;
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
			this.state = 723;
			this.match(SolidCashParser.T__61);
			this.state = 724;
			this.match(SolidCashParser.T__48);
			this.state = 725;
			this.match(SolidCashParser.T__49);
			this.state = 729;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===61 || _la===72) {
				{
				{
				this.state = 726;
				this.receiveModifier();
				}
				}
				this.state = 731;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 732;
			this.match(SolidCashParser.T__43);
			this.state = 736;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===61 || _la===72) {
				{
				{
				this.state = 733;
				this.receiveModifier();
				}
				}
				this.state = 738;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 739;
			this.match(SolidCashParser.T__58);
			this.state = 743;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===61 || _la===72) {
				{
				{
				this.state = 740;
				this.receiveModifier();
				}
				}
				this.state = 745;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 746;
			this.match(SolidCashParser.T__3);
			this.state = 750;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 747;
				this.statement();
				}
				}
				this.state = 752;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 753;
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
			this.state = 757;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 61:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 755;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 756;
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
			this.state = 759;
			this.match(SolidCashParser.Identifier);
			this.state = 760;
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
			this.state = 833;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 87, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 763;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 762;
					this.stateVariableVisibility();
					}
				}

				this.state = 765;
				this.typeName();
				this.state = 770;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					this.state = 768;
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
						this.state = 766;
						this.modifier();
						}
						break;
					case 72:
						{
						this.state = 767;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 772;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 773;
				this.match(SolidCashParser.Identifier);
				this.state = 776;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 774;
					this.match(SolidCashParser.T__39);
					this.state = 775;
					this.expression(0);
					}
				}

				this.state = 778;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 780;
				this.typeName();
				this.state = 785;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					this.state = 783;
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
						this.state = 781;
						this.modifier();
						}
						break;
					case 72:
						{
						this.state = 782;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 787;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 788;
				this.stateVariableVisibility();
				this.state = 793;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					this.state = 791;
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
						this.state = 789;
						this.modifier();
						}
						break;
					case 72:
						{
						this.state = 790;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 795;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 796;
				this.match(SolidCashParser.Identifier);
				this.state = 799;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 797;
					this.match(SolidCashParser.T__39);
					this.state = 798;
					this.expression(0);
					}
				}

				this.state = 801;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 804;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 803;
					this.stateVariableVisibility();
					}
				}

				this.state = 806;
				this.mappingType();
				this.state = 810;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 807;
					this.collectionModifier();
					}
					}
					this.state = 812;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 813;
				this.match(SolidCashParser.Identifier);
				this.state = 814;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 817;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 816;
					this.stateVariableVisibility();
					}
				}

				this.state = 819;
				this.arrayType(0);
				this.state = 823;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 820;
					this.collectionModifier();
					}
					}
					this.state = 825;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 826;
				this.match(SolidCashParser.Identifier);
				this.state = 829;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 827;
					this.match(SolidCashParser.T__39);
					this.state = 828;
					this.expression(0);
					}
				}

				this.state = 831;
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
			this.state = 838;
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
				this.state = 835;
				this.modifier();
				}
				break;
			case 43:
			case 44:
			case 58:
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 836;
				this.stateVariableVisibility();
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 837;
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
			this.state = 840;
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
			this.state = 878;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 94, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
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
				if (_la===180) {
					{
					this.state = 845;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 848;
				this.match(SolidCashParser.T__64);
				this.state = 849;
				this.typeName();
				this.state = 851;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 850;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 853;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 855;
				this.match(SolidCashParser.T__63);
				this.state = 856;
				this.match(SolidCashParser.T__48);
				this.state = 857;
				this.typeName();
				this.state = 859;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 858;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 861;
				this.match(SolidCashParser.T__64);
				this.state = 862;
				this.mappingType();
				this.state = 863;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 865;
				this.match(SolidCashParser.T__63);
				this.state = 866;
				this.match(SolidCashParser.T__48);
				this.state = 867;
				this.typeName();
				this.state = 869;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 868;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 871;
				this.match(SolidCashParser.T__64);
				this.state = 872;
				this.arrayType(0);
				this.state = 874;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 873;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 876;
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
			this.state = 890;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 95, this._ctx) ) {
			case 1:
				{
				this.state = 881;
				this.typeName();
				this.state = 882;
				this.match(SolidCashParser.T__65);
				this.state = 883;
				_la = this._input.LA(1);
				if(!(_la===145 || _la===180)) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 884;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 2:
				{
				this.state = 886;
				this.typeName();
				this.state = 887;
				this.match(SolidCashParser.T__65);
				this.state = 888;
				this.match(SolidCashParser.T__66);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 901;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 97, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 899;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 96, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 892;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 893;
						this.match(SolidCashParser.T__65);
						this.state = 894;
						_la = this._input.LA(1);
						if(!(_la===145 || _la===180)) {
						this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 895;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 896;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 897;
						this.match(SolidCashParser.T__65);
						this.state = 898;
						this.match(SolidCashParser.T__66);
						}
						break;
					}
					}
				}
				this.state = 903;
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
			this.state = 904;
			this.match(SolidCashParser.T__67);
			this.state = 905;
			this.match(SolidCashParser.Identifier);
			this.state = 907;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 906;
				this.parameterList();
				}
			}

			this.state = 909;
			this.match(SolidCashParser.T__3);
			this.state = 913;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 910;
				this.modifierStatement();
				}
				}
				this.state = 915;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 916;
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
			this.state = 920;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 100, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 918;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 919;
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
			this.state = 922;
			this.match(SolidCashParser.T__68);
			this.state = 923;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 925;
			this.match(SolidCashParser.T__6);
			this.state = 926;
			this.anyIdentifier();
			this.state = 927;
			this.parameterList();
			this.state = 932;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0) || _la===180) {
				{
				this.state = 930;
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
					this.state = 928;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 929;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 934;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 936;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 935;
				this.returnType();
				}
			}

			this.state = 938;
			this.match(SolidCashParser.T__3);
			this.state = 942;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 939;
				this.statement();
				}
				}
				this.state = 944;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 945;
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
			this.state = 947;
			this.match(SolidCashParser.Identifier);
			this.state = 949;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 948;
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
			this.state = 965;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 70:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 951;
				this.match(SolidCashParser.T__69);
				}
				break;
			case 71:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 952;
				this.match(SolidCashParser.T__70);
				}
				break;
			case 58:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 953;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 44:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 954;
				this.match(SolidCashParser.T__43);
				}
				break;
			case 43:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 955;
				this.match(SolidCashParser.T__42);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 956;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 59:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 957;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 958;
				this.overrideSpecifier();
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 959;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 960;
				this.unsafeModifier();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 961;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 962;
				this.match(SolidCashParser.T__27);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 963;
				this.match(SolidCashParser.T__30);
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 964;
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
			this.state = 967;
			this.match(SolidCashParser.T__71);
			this.state = 978;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 968;
				this.match(SolidCashParser.T__48);
				this.state = 969;
				this.match(SolidCashParser.Identifier);
				this.state = 974;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 970;
					this.match(SolidCashParser.T__4);
					this.state = 971;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 976;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 977;
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
			this.state = 980;
			this.match(SolidCashParser.T__31);
			this.state = 984;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 981;
				this.match(SolidCashParser.T__48);
				this.state = 982;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 983;
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
			this.state = 986;
			this.match(SolidCashParser.T__72);
			this.state = 987;
			this.match(SolidCashParser.T__48);
			this.state = 988;
			this.returnParam();
			this.state = 993;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 110, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 989;
					this.match(SolidCashParser.T__4);
					this.state = 990;
					this.returnParam();
					}
					}
				}
				this.state = 995;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 110, this._ctx);
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

			this.state = 999;
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
			this.state = 1021;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 116, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1001;
				this.typeName();
				this.state = 1005;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 112, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1002;
						this.modifier();
						}
						}
					}
					this.state = 1007;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 112, this._ctx);
				}
				this.state = 1009;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1008;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1011;
				this.arrayType(0);
				this.state = 1015;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 114, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1012;
						this.modifier();
						}
						}
					}
					this.state = 1017;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 114, this._ctx);
				}
				this.state = 1019;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1018;
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
			this.state = 1023;
			this.match(SolidCashParser.T__48);
			this.state = 1035;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1024;
				this.parameter();
				this.state = 1029;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 117, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1025;
						this.match(SolidCashParser.T__4);
						this.state = 1026;
						this.parameter();
						}
						}
					}
					this.state = 1031;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 117, this._ctx);
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

				}
			}

			this.state = 1037;
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
			this.state = 1069;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 126, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1039;
				this.typeName();
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
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1049;
				this.arrayType(0);
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
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1059;
				this.mappingType();
				this.state = 1063;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 124, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1060;
						this.modifier();
						}
						}
					}
					this.state = 1065;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 124, this._ctx);
				}
				this.state = 1067;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1066;
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
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
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
		this.enterRule(localctx, 112, SolidCashParser.RULE_statement);
		try {
			this.state = 1104;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 129, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1082;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1083;
				this.variableDefinition();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1084;
				this.tupleAssignment();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1085;
				this.prefixIncDecStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1086;
				this.timeOpStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1087;
				this.requireStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1088;
				this.ifStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1089;
				this.loopStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1090;
				this.consoleStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1091;
				this.emitStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1092;
				this.returnStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1093;
				this.selfdestructStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1094;
				this.assemblyStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1095;
				this.tryCatchStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1096;
				this.revertStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1097;
				this.assertStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1098;
				this.deleteStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1099;
				this.uncheckedStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1100;
				this.switchStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1101;
				this.breakStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1102;
				this.continueStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1103;
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
			this.state = 1106;
			this.expression(0);
			this.state = 1128;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 131, this._ctx) ) {
			case 1:
				{
				this.state = 1107;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1108;
				this.expression(0);
				}
				break;
			case 2:
				{
				this.state = 1109;
				this.match(SolidCashParser.DotPush);
				this.state = 1110;
				this.match(SolidCashParser.T__48);
				this.state = 1111;
				this.match(SolidCashParser.T__49);
				this.state = 1112;
				this.match(SolidCashParser.T__39);
				this.state = 1113;
				this.expression(0);
				}
				break;
			case 3:
				{
				this.state = 1114;
				this.match(SolidCashParser.DotPush);
				this.state = 1115;
				this.match(SolidCashParser.T__48);
				this.state = 1117;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 132161) !== 0) || ((((_la - 89)) & ~0x1F) === 0 && ((1 << (_la - 89)) & 4261937153) !== 0) || ((((_la - 121)) & ~0x1F) === 0 && ((1 << (_la - 121)) & 3755343967) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 134218749) !== 0)) {
					{
					this.state = 1116;
					this.pushArgument();
					}
				}

				this.state = 1119;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 4:
				{
				this.state = 1120;
				this.match(SolidCashParser.DotPop);
				this.state = 1121;
				this.match(SolidCashParser.T__48);
				this.state = 1122;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 5:
				{
				this.state = 1123;
				this.match(SolidCashParser.DotDelete);
				this.state = 1124;
				this.match(SolidCashParser.T__48);
				this.state = 1125;
				this.expression(0);
				this.state = 1126;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
			this.state = 1130;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1132;
			localctx._op = this._input.LT(1);
			_la = this._input.LA(1);
			if(!(_la===84 || _la===85)) {
			    localctx._op = this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			this.state = 1133;
			this.expression(0);
			this.state = 1134;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1165;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 135, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1136;
				this.match(SolidCashParser.T__85);
				this.state = 1137;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1138;
				this.match(SolidCashParser.T__85);
				this.state = 1139;
				this.expression(0);
				this.state = 1144;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1140;
					this.match(SolidCashParser.T__4);
					this.state = 1141;
					this.expression(0);
					}
					}
					this.state = 1146;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1147;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1149;
				this.match(SolidCashParser.T__85);
				this.state = 1150;
				this.match(SolidCashParser.T__48);
				this.state = 1151;
				this.expression(0);
				this.state = 1156;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 133, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1152;
						this.match(SolidCashParser.T__4);
						this.state = 1153;
						this.expression(0);
						}
						}
					}
					this.state = 1158;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 133, this._ctx);
				}
				this.state = 1160;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1159;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1162;
				this.match(SolidCashParser.T__49);
				this.state = 1163;
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
			this.state = 1167;
			this.match(SolidCashParser.T__30);
			this.state = 1168;
			this.match(SolidCashParser.T__48);
			this.state = 1169;
			this.expression(0);
			this.state = 1170;
			this.match(SolidCashParser.T__49);
			this.state = 1171;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1206;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 141, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1173;
				this.match(SolidCashParser.T__86);
				this.state = 1174;
				this.match(SolidCashParser.Identifier);
				this.state = 1177;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1175;
					this.match(SolidCashParser.T__11);
					this.state = 1176;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1179;
				this.match(SolidCashParser.T__48);
				this.state = 1180;
				this.match(SolidCashParser.T__3);
				this.state = 1192;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1181;
					this.namedArg();
					this.state = 1186;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 137, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1182;
							this.match(SolidCashParser.T__4);
							this.state = 1183;
							this.namedArg();
							}
							}
						}
						this.state = 1188;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 137, this._ctx);
					}
					this.state = 1190;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1189;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1194;
				this.match(SolidCashParser.T__5);
				this.state = 1195;
				this.match(SolidCashParser.T__49);
				this.state = 1196;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1197;
				this.match(SolidCashParser.T__86);
				this.state = 1198;
				this.match(SolidCashParser.Identifier);
				this.state = 1201;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1199;
					this.match(SolidCashParser.T__11);
					this.state = 1200;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1203;
				this.expressionList();
				this.state = 1204;
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
			this.state = 1236;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 146, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1208;
				this.typeName();
				this.state = 1212;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 142, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1209;
						this.modifier();
						}
						}
					}
					this.state = 1214;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 142, this._ctx);
				}
				this.state = 1215;
				this.anyIdentifier();
				this.state = 1218;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1216;
					this.match(SolidCashParser.T__39);
					this.state = 1217;
					this.expression(0);
					}
				}

				this.state = 1220;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1222;
				this.arrayType(0);
				this.state = 1226;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 144, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1223;
						this.modifier();
						}
						}
					}
					this.state = 1228;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 144, this._ctx);
				}
				this.state = 1229;
				this.anyIdentifier();
				this.state = 1232;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1230;
					this.match(SolidCashParser.T__39);
					this.state = 1231;
					this.expression(0);
					}
				}

				this.state = 1234;
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
			this.state = 1286;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 151, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1238;
				this.typeName();
				this.state = 1239;
				this.match(SolidCashParser.Identifier);
				this.state = 1244;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1240;
					this.match(SolidCashParser.T__4);
					this.state = 1241;
					this.typeName();
					this.state = 1242;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1246;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1248;
				this.match(SolidCashParser.T__39);
				this.state = 1249;
				this.expression(0);
				this.state = 1250;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1252;
				this.match(SolidCashParser.T__48);
				this.state = 1253;
				this.tupleSlot();
				this.state = 1256;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1254;
					this.match(SolidCashParser.T__4);
					this.state = 1255;
					this.tupleSlot();
					}
					}
					this.state = 1258;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1260;
				this.match(SolidCashParser.T__49);
				this.state = 1261;
				this.match(SolidCashParser.T__39);
				this.state = 1262;
				this.match(SolidCashParser.T__48);
				this.state = 1263;
				this.expression(0);
				this.state = 1266;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1264;
					this.match(SolidCashParser.T__4);
					this.state = 1265;
					this.expression(0);
					}
					}
					this.state = 1268;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1270;
				this.match(SolidCashParser.T__49);
				this.state = 1271;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1273;
				this.match(SolidCashParser.T__48);
				this.state = 1274;
				this.tupleSlot();
				this.state = 1277;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1275;
					this.match(SolidCashParser.T__4);
					this.state = 1276;
					this.tupleSlot();
					}
					}
					this.state = 1279;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1281;
				this.match(SolidCashParser.T__49);
				this.state = 1282;
				this.match(SolidCashParser.T__39);
				this.state = 1283;
				this.expression(0);
				this.state = 1284;
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
			this.state = 1299;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 153, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1288;
				this.typeName();
				this.state = 1292;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 152, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1289;
						this.modifier();
						}
						}
					}
					this.state = 1294;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 152, this._ctx);
				}
				this.state = 1295;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1297;
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
		this.enterRule(localctx, 130, SolidCashParser.RULE_pushArgument);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1301;
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
			this.state = 1364;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 159, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1303;
				this.match(SolidCashParser.T__87);
				this.state = 1304;
				this.match(SolidCashParser.Identifier);
				this.state = 1305;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1306;
				this.match(SolidCashParser.T__87);
				this.state = 1307;
				this.match(SolidCashParser.T__88);
				this.state = 1308;
				this.match(SolidCashParser.T__11);
				this.state = 1309;
				this.match(SolidCashParser.Identifier);
				this.state = 1310;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1311;
				this.match(SolidCashParser.T__87);
				this.state = 1312;
				this.match(SolidCashParser.T__88);
				this.state = 1313;
				this.match(SolidCashParser.T__11);
				this.state = 1314;
				this.match(SolidCashParser.Identifier);
				this.state = 1319;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1315;
					this.match(SolidCashParser.T__65);
					this.state = 1316;
					this.expression(0);
					this.state = 1317;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1321;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1323;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1325;
				this.match(SolidCashParser.T__87);
				this.state = 1326;
				this.match(SolidCashParser.Identifier);
				this.state = 1331;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1327;
					this.match(SolidCashParser.T__65);
					this.state = 1328;
					this.expression(0);
					this.state = 1329;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1333;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1335;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				localctx = new DeleteMemberEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1337;
				this.match(SolidCashParser.T__87);
				this.state = 1338;
				this.match(SolidCashParser.Identifier);
				this.state = 1341;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1339;
					this.match(SolidCashParser.T__11);
					this.state = 1340;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1343;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1349;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1345;
					this.match(SolidCashParser.T__65);
					this.state = 1346;
					this.expression(0);
					this.state = 1347;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1351;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1353;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 6:
				localctx = new DeleteMemberContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1355;
				this.match(SolidCashParser.T__87);
				this.state = 1356;
				this.match(SolidCashParser.Identifier);
				this.state = 1359;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1357;
					this.match(SolidCashParser.T__11);
					this.state = 1358;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1361;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1363;
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
			this.state = 1366;
			this.match(SolidCashParser.T__89);
			this.state = 1367;
			this.match(SolidCashParser.T__48);
			this.state = 1368;
			this.match(SolidCashParser.TxVar);
			this.state = 1369;
			this.match(SolidCashParser.T__22);
			this.state = 1370;
			this.expression(0);
			this.state = 1373;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1371;
				this.match(SolidCashParser.T__4);
				this.state = 1372;
				this.requireMessage();
				}
			}

			this.state = 1375;
			this.match(SolidCashParser.T__49);
			this.state = 1376;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1378;
			this.match(SolidCashParser.T__89);
			this.state = 1379;
			this.match(SolidCashParser.T__48);
			this.state = 1380;
			this.expression(0);
			this.state = 1383;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1381;
				this.match(SolidCashParser.T__4);
				this.state = 1382;
				this.requireMessage();
				}
			}

			this.state = 1385;
			this.match(SolidCashParser.T__49);
			this.state = 1386;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1388;
			this.match(SolidCashParser.T__90);
			this.state = 1389;
			this.match(SolidCashParser.T__48);
			this.state = 1390;
			this.expression(0);
			this.state = 1391;
			this.match(SolidCashParser.T__49);
			this.state = 1392;
			localctx._ifBlock = this.block();
			this.state = 1395;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 162, this._ctx) ) {
			case 1:
				{
				this.state = 1393;
				this.match(SolidCashParser.T__91);
				this.state = 1394;
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
			this.state = 1403;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 163, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1397;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1398;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1399;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1400;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1401;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1402;
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
			this.state = 1405;
			this.match(SolidCashParser.T__8);
			this.state = 1406;
			this.match(SolidCashParser.T__48);
			this.state = 1407;
			this.typeName();
			this.state = 1408;
			this.match(SolidCashParser.Identifier);
			this.state = 1409;
			this.match(SolidCashParser.T__4);
			this.state = 1410;
			this.typeName();
			this.state = 1411;
			this.match(SolidCashParser.Identifier);
			this.state = 1412;
			this.match(SolidCashParser.T__92);
			this.state = 1413;
			this.match(SolidCashParser.T__88);
			this.state = 1414;
			this.match(SolidCashParser.T__11);
			this.state = 1415;
			this.match(SolidCashParser.Identifier);
			this.state = 1416;
			this.match(SolidCashParser.T__11);
			this.state = 1417;
			this.match(SolidCashParser.T__33);
			this.state = 1418;
			this.match(SolidCashParser.T__49);
			this.state = 1419;
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
			this.state = 1421;
			this.match(SolidCashParser.T__8);
			this.state = 1422;
			this.match(SolidCashParser.T__48);
			this.state = 1423;
			this.typeName();
			this.state = 1424;
			this.match(SolidCashParser.Identifier);
			this.state = 1425;
			this.match(SolidCashParser.T__93);
			this.state = 1426;
			this.match(SolidCashParser.T__88);
			this.state = 1427;
			this.match(SolidCashParser.T__11);
			this.state = 1428;
			this.match(SolidCashParser.Identifier);
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
	public forOfStatement(): ForOfStatementContext {
		let localctx: ForOfStatementContext = new ForOfStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 146, SolidCashParser.RULE_forOfStatement);
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
			this.match(SolidCashParser.T__92);
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
	public forStatement(): ForStatementContext {
		let localctx: ForStatementContext = new ForStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 148, SolidCashParser.RULE_forStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1443;
			this.match(SolidCashParser.T__8);
			this.state = 1444;
			this.match(SolidCashParser.T__48);
			this.state = 1445;
			this.forInit();
			this.state = 1446;
			this.forCondition();
			this.state = 1448;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===84 || _la===85 || _la===180) {
				{
				this.state = 1447;
				this.forUpdate();
				}
			}

			this.state = 1450;
			this.match(SolidCashParser.T__49);
			this.state = 1451;
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
			this.state = 1473;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 167, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1453;
				this.typeName();
				this.state = 1457;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 1454;
					this.modifier();
					}
					}
					this.state = 1459;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1460;
				this.match(SolidCashParser.Identifier);
				this.state = 1463;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1461;
					this.match(SolidCashParser.T__39);
					this.state = 1462;
					this.expression(0);
					}
				}

				this.state = 1465;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1467;
				this.match(SolidCashParser.Identifier);
				this.state = 1468;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1469;
				this.expression(0);
				this.state = 1470;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1472;
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
			this.state = 1475;
			this.expression(0);
			this.state = 1476;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1485;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 168, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
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
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1481;
				this.match(SolidCashParser.Identifier);
				this.state = 1482;
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
				this.state = 1483;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===84 || _la===85)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1484;
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
			this.state = 1487;
			this.match(SolidCashParser.T__94);
			this.state = 1488;
			this.block();
			this.state = 1489;
			this.match(SolidCashParser.T__95);
			this.state = 1490;
			this.match(SolidCashParser.T__48);
			this.state = 1491;
			this.expression(0);
			this.state = 1492;
			this.match(SolidCashParser.T__49);
			this.state = 1493;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1495;
			this.match(SolidCashParser.T__95);
			this.state = 1496;
			this.match(SolidCashParser.T__48);
			this.state = 1497;
			this.expression(0);
			this.state = 1498;
			this.match(SolidCashParser.T__49);
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
	public consoleStatement(): ConsoleStatementContext {
		let localctx: ConsoleStatementContext = new ConsoleStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 160, SolidCashParser.RULE_consoleStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1501;
			this.match(SolidCashParser.T__96);
			this.state = 1502;
			this.consoleParameterList();
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
	public assemblyStatement(): AssemblyStatementContext {
		let localctx: AssemblyStatementContext = new AssemblyStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 162, SolidCashParser.RULE_assemblyStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1505;
			this.match(SolidCashParser.T__97);
			this.state = 1506;
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
			this.state = 1508;
			this.match(SolidCashParser.T__3);
			this.state = 1512;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026534544) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 31) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 4579361) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				{
				this.state = 1509;
				this.yulStatement();
				}
				}
				this.state = 1514;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1515;
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
			this.state = 1530;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 170, this._ctx) ) {
			case 1:
				localctx = new YulNestedBlockStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1517;
				this.yulBlock();
				}
				break;
			case 2:
				localctx = new YulVarDeclStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1518;
				this.yulVariableDeclaration();
				}
				break;
			case 3:
				localctx = new YulAssignStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1519;
				this.yulAssignment();
				}
				break;
			case 4:
				localctx = new YulIfStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1520;
				this.yulIf();
				}
				break;
			case 5:
				localctx = new YulSwitchStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1521;
				this.yulSwitch();
				}
				break;
			case 6:
				localctx = new YulForStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1522;
				this.yulForLoop();
				}
				break;
			case 7:
				localctx = new YulFunctionDefStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1523;
				this.yulFunctionDefinition();
				}
				break;
			case 8:
				localctx = new YulBreakStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1524;
				this.match(SolidCashParser.T__98);
				}
				break;
			case 9:
				localctx = new YulContinueStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1525;
				this.match(SolidCashParser.T__99);
				}
				break;
			case 10:
				localctx = new YulLeaveStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1526;
				this.match(SolidCashParser.T__100);
				}
				break;
			case 11:
				localctx = new YulCallStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1527;
				this.yulFunctionCall();
				}
				break;
			case 12:
				localctx = new YulPathStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1528;
				this.yulPath();
				}
				break;
			case 13:
				localctx = new YulLiteralStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1529;
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
			this.state = 1532;
			this.match(SolidCashParser.T__101);
			this.state = 1533;
			this.anyIdentifier();
			this.state = 1538;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1534;
				this.match(SolidCashParser.T__4);
				this.state = 1535;
				this.anyIdentifier();
				}
				}
				this.state = 1540;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1543;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===103) {
				{
				this.state = 1541;
				this.match(SolidCashParser.T__102);
				this.state = 1542;
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
			this.state = 1545;
			this.yulPath();
			this.state = 1550;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1546;
				this.match(SolidCashParser.T__4);
				this.state = 1547;
				this.yulPath();
				}
				}
				this.state = 1552;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1553;
			this.match(SolidCashParser.T__102);
			this.state = 1554;
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
			this.state = 1556;
			this.match(SolidCashParser.T__90);
			this.state = 1557;
			this.yulExpression();
			this.state = 1558;
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
			this.state = 1560;
			this.match(SolidCashParser.T__103);
			this.state = 1561;
			this.yulExpression();
			this.state = 1571;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 105:
				{
				this.state = 1563;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1562;
					this.yulCase();
					}
					}
					this.state = 1565;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===105);
				this.state = 1568;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===106) {
					{
					this.state = 1567;
					this.yulDefault();
					}
				}

				}
				break;
			case 106:
				{
				this.state = 1570;
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
			this.state = 1573;
			this.match(SolidCashParser.T__104);
			this.state = 1574;
			this.yulLiteral();
			this.state = 1575;
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
			this.state = 1577;
			this.match(SolidCashParser.T__105);
			this.state = 1578;
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
			this.state = 1580;
			this.match(SolidCashParser.T__8);
			this.state = 1581;
			this.yulBlock();
			this.state = 1582;
			this.yulExpression();
			this.state = 1583;
			this.yulBlock();
			this.state = 1584;
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
			this.state = 1586;
			this.match(SolidCashParser.T__6);
			this.state = 1587;
			this.match(SolidCashParser.Identifier);
			this.state = 1588;
			this.match(SolidCashParser.T__48);
			this.state = 1597;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 1589;
				this.match(SolidCashParser.Identifier);
				this.state = 1594;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1590;
					this.match(SolidCashParser.T__4);
					this.state = 1591;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1596;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1599;
			this.match(SolidCashParser.T__49);
			this.state = 1609;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===107) {
				{
				this.state = 1600;
				this.match(SolidCashParser.T__106);
				this.state = 1601;
				this.match(SolidCashParser.Identifier);
				this.state = 1606;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1602;
					this.match(SolidCashParser.T__4);
					this.state = 1603;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1608;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1611;
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
			this.state = 1616;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 181, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1613;
				this.yulFunctionCall();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1614;
				this.yulPath();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1615;
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
			this.state = 1618;
			this.yulFunctionName();
			this.state = 1619;
			this.match(SolidCashParser.T__48);
			this.state = 1628;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===86 || _la===108 || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				this.state = 1620;
				this.yulExpression();
				this.state = 1625;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1621;
					this.match(SolidCashParser.T__4);
					this.state = 1622;
					this.yulExpression();
					}
					}
					this.state = 1627;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1630;
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
			this.state = 1632;
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
			this.state = 1634;
			this.anyIdentifier();
			this.state = 1640;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===12 || _la===164) {
				{
				this.state = 1638;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 12:
					{
					this.state = 1635;
					this.match(SolidCashParser.T__11);
					this.state = 1636;
					this.anyIdentifier();
					}
					break;
				case 164:
					{
					this.state = 1637;
					this.match(SolidCashParser.DotLength);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 1642;
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
			this.state = 1643;
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
			this.state = 1645;
			this.match(SolidCashParser.T__108);
			this.state = 1646;
			this.match(SolidCashParser.T__3);
			this.state = 1650;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1647;
				this.statement();
				}
				}
				this.state = 1652;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1653;
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
			this.state = 1655;
			this.match(SolidCashParser.T__103);
			this.state = 1656;
			this.match(SolidCashParser.T__48);
			this.state = 1657;
			this.expression(0);
			this.state = 1658;
			this.match(SolidCashParser.T__49);
			this.state = 1659;
			this.match(SolidCashParser.T__3);
			this.state = 1663;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===105) {
				{
				{
				this.state = 1660;
				this.switchCase();
				}
				}
				this.state = 1665;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1667;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===106) {
				{
				this.state = 1666;
				this.switchDefault();
				}
			}

			this.state = 1669;
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
			this.state = 1671;
			this.match(SolidCashParser.T__104);
			this.state = 1672;
			this.expression(0);
			this.state = 1673;
			this.match(SolidCashParser.T__109);
			this.state = 1677;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1674;
				this.statement();
				}
				}
				this.state = 1679;
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
			this.state = 1680;
			this.match(SolidCashParser.T__105);
			this.state = 1681;
			this.match(SolidCashParser.T__109);
			this.state = 1685;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768640) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3824943113) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 805284935) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1682;
				this.statement();
				}
				}
				this.state = 1687;
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
			this.state = 1688;
			this.match(SolidCashParser.T__110);
			this.state = 1689;
			this.expression(0);
			this.state = 1691;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 1690;
				this.tryReturns();
				}
			}

			this.state = 1693;
			localctx._tryBlock = this.block();
			this.state = 1695;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1694;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1697;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 192, this._ctx);
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
			this.state = 1699;
			this.match(SolidCashParser.T__72);
			this.state = 1700;
			this.match(SolidCashParser.T__48);
			this.state = 1712;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1701;
				this.parameter();
				this.state = 1706;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 193, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1702;
						this.match(SolidCashParser.T__4);
						this.state = 1703;
						this.parameter();
						}
						}
					}
					this.state = 1708;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 193, this._ctx);
				}
				this.state = 1710;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1709;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1714;
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
			this.state = 1716;
			this.match(SolidCashParser.T__111);
			this.state = 1718;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 196, this._ctx) ) {
			case 1:
				{
				this.state = 1717;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 1735;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 200, this._ctx) ) {
			case 1:
				{
				this.state = 1720;
				this.match(SolidCashParser.T__48);
				this.state = 1732;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 1721;
					this.parameter();
					this.state = 1726;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 197, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1722;
							this.match(SolidCashParser.T__4);
							this.state = 1723;
							this.parameter();
							}
							}
						}
						this.state = 1728;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 197, this._ctx);
					}
					this.state = 1730;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1729;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1734;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
			this.state = 1737;
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
			this.state = 1739;
			this.match(SolidCashParser.T__98);
			this.state = 1740;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1742;
			this.match(SolidCashParser.T__99);
			this.state = 1743;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1748;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 151:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1745;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 180:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1746;
				this.match(SolidCashParser.Identifier);
				this.state = 1747;
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
			this.state = 1792;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 207, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1750;
				this.match(SolidCashParser.T__35);
				this.state = 1751;
				this.match(SolidCashParser.Identifier);
				this.state = 1754;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1752;
					this.match(SolidCashParser.T__11);
					this.state = 1753;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1756;
				this.match(SolidCashParser.T__48);
				this.state = 1757;
				this.match(SolidCashParser.T__3);
				this.state = 1769;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1758;
					this.namedArg();
					this.state = 1763;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 203, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1759;
							this.match(SolidCashParser.T__4);
							this.state = 1760;
							this.namedArg();
							}
							}
						}
						this.state = 1765;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 203, this._ctx);
					}
					this.state = 1767;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1766;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1771;
				this.match(SolidCashParser.T__5);
				this.state = 1772;
				this.match(SolidCashParser.T__49);
				this.state = 1773;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1774;
				this.match(SolidCashParser.T__35);
				this.state = 1775;
				this.match(SolidCashParser.Identifier);
				this.state = 1778;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1776;
					this.match(SolidCashParser.T__11);
					this.state = 1777;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1780;
				this.expressionList();
				this.state = 1781;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1783;
				this.match(SolidCashParser.T__35);
				this.state = 1784;
				this.match(SolidCashParser.T__48);
				this.state = 1785;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1786;
				this.match(SolidCashParser.T__49);
				this.state = 1787;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1788;
				this.match(SolidCashParser.T__35);
				this.state = 1789;
				this.match(SolidCashParser.T__48);
				this.state = 1790;
				this.match(SolidCashParser.T__49);
				this.state = 1791;
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
			this.state = 1794;
			this.match(SolidCashParser.T__112);
			this.state = 1795;
			this.match(SolidCashParser.T__48);
			this.state = 1796;
			this.expression(0);
			this.state = 1797;
			this.match(SolidCashParser.T__49);
			this.state = 1798;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1802;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 180:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1800;
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
				this.state = 1801;
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
			this.state = 1804;
			this.match(SolidCashParser.T__48);
			this.state = 1816;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 3152921) !== 0) || _la===180) {
				{
				this.state = 1805;
				this.consoleParameter();
				this.state = 1810;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 209, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1806;
						this.match(SolidCashParser.T__4);
						this.state = 1807;
						this.consoleParameter();
						}
						}
					}
					this.state = 1812;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 209, this._ctx);
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

				}
			}

			this.state = 1818;
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
			this.state = 1844;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 215, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1820;
				this.match(SolidCashParser.Identifier);
				this.state = 1821;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1822;
				this.match(SolidCashParser.Identifier);
				this.state = 1823;
				this.match(SolidCashParser.T__11);
				this.state = 1824;
				this.match(SolidCashParser.Identifier);
				this.state = 1825;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1826;
				this.match(SolidCashParser.Identifier);
				this.state = 1827;
				this.match(SolidCashParser.T__48);
				this.state = 1828;
				this.match(SolidCashParser.T__3);
				this.state = 1840;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1829;
					this.namedArg();
					this.state = 1834;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 212, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1830;
							this.match(SolidCashParser.T__4);
							this.state = 1831;
							this.namedArg();
							}
							}
						}
						this.state = 1836;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 212, this._ctx);
					}
					this.state = 1838;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1837;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1842;
				this.match(SolidCashParser.T__5);
				this.state = 1843;
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
			this.state = 1846;
			this.match(SolidCashParser.Identifier);
			this.state = 1847;
			this.match(SolidCashParser.T__109);
			this.state = 1848;
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
			this.state = 1850;
			this.match(SolidCashParser.T__48);
			this.state = 1862;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 132161) !== 0) || ((((_la - 89)) & ~0x1F) === 0 && ((1 << (_la - 89)) & 4261937153) !== 0) || ((((_la - 121)) & ~0x1F) === 0 && ((1 << (_la - 121)) & 3755343967) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 134218749) !== 0)) {
				{
				this.state = 1851;
				this.expression(0);
				this.state = 1856;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 216, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1852;
						this.match(SolidCashParser.T__4);
						this.state = 1853;
						this.expression(0);
						}
						}
					}
					this.state = 1858;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 216, this._ctx);
				}
				this.state = 1860;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1859;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1864;
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
			this.state = 1866;
			this.match(SolidCashParser.T__3);
			this.state = 1867;
			this.callOption();
			this.state = 1872;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 219, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1868;
					this.match(SolidCashParser.T__4);
					this.state = 1869;
					this.callOption();
					}
					}
				}
				this.state = 1874;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 219, this._ctx);
			}
			this.state = 1876;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1875;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1878;
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
			this.state = 1880;
			this.match(SolidCashParser.Identifier);
			this.state = 1881;
			this.match(SolidCashParser.T__109);
			this.state = 1882;
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
			this.state = 1884;
			this.match(SolidCashParser.T__48);
			this.state = 1885;
			this.typeListItem();
			this.state = 1890;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 221, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1886;
					this.match(SolidCashParser.T__4);
					this.state = 1887;
					this.typeListItem();
					}
					}
				}
				this.state = 1892;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 221, this._ctx);
			}
			this.state = 1894;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1893;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1896;
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
			this.state = 1900;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 223, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1898;
				this.typeName();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1899;
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
			this.state = 2064;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 232, this._ctx) ) {
			case 1:
				{
				localctx = new AssignmentExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 1903;
				this.match(SolidCashParser.T__48);
				this.state = 1904;
				this.match(SolidCashParser.Identifier);
				this.state = 1905;
				(localctx as AssignmentExpressionContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    (localctx as AssignmentExpressionContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1906;
				this.expression(0);
				this.state = 1907;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				{
				localctx = new InstantiationWithOptionsContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1909;
				this.match(SolidCashParser.T__48);
				this.state = 1910;
				this.match(SolidCashParser.T__113);
				this.state = 1911;
				this.match(SolidCashParser.Identifier);
				this.state = 1912;
				this.match(SolidCashParser.T__49);
				this.state = 1913;
				this.callOptions();
				this.state = 1914;
				this.expressionList();
				}
				break;
			case 3:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1916;
				this.match(SolidCashParser.T__48);
				this.state = 1917;
				this.expression(0);
				this.state = 1918;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 4:
				{
				localctx = new TupleExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1920;
				this.match(SolidCashParser.T__48);
				this.state = 1921;
				this.expression(0);
				this.state = 1924;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1922;
					this.match(SolidCashParser.T__4);
					this.state = 1923;
					this.expression(0);
					}
					}
					this.state = 1926;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1928;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 5:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1930;
				this.typeCast();
				this.state = 1931;
				this.match(SolidCashParser.T__48);
				this.state = 1932;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 1934;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1933;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1936;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 6:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1938;
				this.functionCall();
				}
				break;
			case 7:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1939;
				this.match(SolidCashParser.T__113);
				this.state = 1940;
				this.match(SolidCashParser.Identifier);
				this.state = 1942;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1941;
					this.callOptions();
					}
				}

				this.state = 1944;
				this.expressionList();
				}
				break;
			case 8:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1945;
				this.match(SolidCashParser.T__113);
				this.state = 1946;
				this.typeName();
				this.state = 1949;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1947;
					this.match(SolidCashParser.T__65);
					this.state = 1948;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1951;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1953;
				this.match(SolidCashParser.T__48);
				this.state = 1954;
				this.expression(0);
				this.state = 1955;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 9:
				{
				localctx = new NewDynamicBytesContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1957;
				this.match(SolidCashParser.T__113);
				this.state = 1958;
				this.match(SolidCashParser.UnboundedBytes);
				this.state = 1959;
				this.match(SolidCashParser.T__48);
				this.state = 1960;
				this.expression(0);
				this.state = 1961;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 10:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1963;
				this.match(SolidCashParser.T__54);
				this.state = 1964;
				this.match(SolidCashParser.T__48);
				this.state = 1965;
				this.typeName();
				this.state = 1966;
				this.match(SolidCashParser.T__49);
				this.state = 1967;
				this.match(SolidCashParser.T__11);
				this.state = 1968;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 11:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1970;
				this.match(SolidCashParser.T__114);
				this.state = 1971;
				this.expressionList();
				}
				break;
			case 12:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1972;
				this.match(SolidCashParser.T__115);
				this.state = 1973;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1974;
				this.match(SolidCashParser.T__116);
				this.state = 1975;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1976;
				this.match(SolidCashParser.T__117);
				this.state = 1977;
				this.expressionList();
				}
				break;
			case 15:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1978;
				this.match(SolidCashParser.T__118);
				this.state = 1979;
				this.match(SolidCashParser.T__48);
				this.state = 1980;
				this.match(SolidCashParser.Identifier);
				this.state = 1981;
				this.match(SolidCashParser.T__11);
				this.state = 1982;
				this.match(SolidCashParser.Identifier);
				this.state = 1983;
				this.match(SolidCashParser.T__4);
				this.state = 1984;
				this.expressionList();
				this.state = 1985;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 16:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1987;
				this.match(SolidCashParser.T__119);
				this.state = 1988;
				this.expressionList();
				}
				break;
			case 17:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1989;
				this.match(SolidCashParser.T__120);
				this.state = 1990;
				this.expressionList();
				}
				break;
			case 18:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1991;
				this.match(SolidCashParser.T__121);
				this.state = 1992;
				this.match(SolidCashParser.T__48);
				this.state = 1993;
				this.expression(0);
				this.state = 1994;
				this.match(SolidCashParser.T__4);
				this.state = 1995;
				this.typeList();
				this.state = 1996;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 19:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 1998;
				this.match(SolidCashParser.T__122);
				this.state = 1999;
				this.match(SolidCashParser.T__48);
				this.state = 2000;
				this.expression(0);
				this.state = 2001;
				this.match(SolidCashParser.T__4);
				this.state = 2002;
				this.typeList();
				this.state = 2003;
				this.match(SolidCashParser.T__4);
				this.state = 2004;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 2005;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 20:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2007;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__123);
				this.state = 2008;
				this.match(SolidCashParser.T__65);
				this.state = 2009;
				this.expression(0);
				this.state = 2010;
				this.match(SolidCashParser.T__66);
				this.state = 2011;
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
				this.state = 2013;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__124);
				this.state = 2014;
				this.match(SolidCashParser.T__65);
				this.state = 2015;
				this.expression(0);
				this.state = 2016;
				this.match(SolidCashParser.T__66);
				this.state = 2017;
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
				this.state = 2019;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===127)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2020;
				this.expression(21);
				}
				break;
			case 23:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2021;
				this.match(SolidCashParser.T__65);
				this.state = 2033;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 132161) !== 0) || ((((_la - 89)) & ~0x1F) === 0 && ((1 << (_la - 89)) & 4261937153) !== 0) || ((((_la - 121)) & ~0x1F) === 0 && ((1 << (_la - 121)) & 3755343967) !== 0) || ((((_la - 153)) & ~0x1F) === 0 && ((1 << (_la - 153)) & 134218749) !== 0)) {
					{
					this.state = 2022;
					this.expression(0);
					this.state = 2027;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 228, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2023;
							this.match(SolidCashParser.T__4);
							this.state = 2024;
							this.expression(0);
							}
							}
						}
						this.state = 2029;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 228, this._ctx);
					}
					this.state = 2031;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2030;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2035;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 24:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2036;
				this.match(SolidCashParser.T__88);
				this.state = 2037;
				this.match(SolidCashParser.T__11);
				this.state = 2038;
				this.match(SolidCashParser.Identifier);
				this.state = 2039;
				this.match(SolidCashParser.T__11);
				this.state = 2040;
				this.match(SolidCashParser.Identifier);
				this.state = 2041;
				this.match(SolidCashParser.T__65);
				this.state = 2042;
				this.expression(0);
				this.state = 2043;
				this.match(SolidCashParser.T__66);
				this.state = 2044;
				this.memberName();
				}
				break;
			case 25:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2046;
				this.match(SolidCashParser.T__88);
				this.state = 2047;
				this.match(SolidCashParser.T__11);
				this.state = 2048;
				this.match(SolidCashParser.Identifier);
				this.state = 2053;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2049;
						this.match(SolidCashParser.T__65);
						this.state = 2050;
						this.expression(0);
						this.state = 2051;
						this.match(SolidCashParser.T__66);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2055;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 231, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 26:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2057;
				this.match(SolidCashParser.T__88);
				this.state = 2058;
				this.match(SolidCashParser.T__11);
				this.state = 2059;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 27:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2060;
				this.match(SolidCashParser.T__88);
				}
				break;
			case 28:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2061;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 29:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2062;
				this.anyIdentifier();
				}
				break;
			case 30:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2063;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2173;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 239, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2171;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 238, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2066;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 2067;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 2068;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2069;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 2070;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2071;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2072;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 2073;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2074;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2075;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 2076;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===128 || _la===129)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2077;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2078;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 2079;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2080;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2081;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2082;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2083;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2084;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2085;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2086;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2087;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2088;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2089;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2090;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2091;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2092;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2093;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2094;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__129);
						this.state = 2095;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2096;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2097;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__130);
						this.state = 2098;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2099;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 2100;
						this.match(SolidCashParser.T__131);
						this.state = 2101;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 2102;
						this.match(SolidCashParser.T__109);
						this.state = 2103;
						(localctx as TernaryOpContext)._ifFalse = this.expression(9);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2105;
						if (!(this.precpred(this._ctx, 33))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 33)");
						}
						this.state = 2106;
						this.match(SolidCashParser.T__65);
						this.state = 2107;
						(localctx as IndexRangeSliceContext)._start = this.expression(0);
						this.state = 2108;
						this.match(SolidCashParser.T__109);
						this.state = 2109;
						(localctx as IndexRangeSliceContext)._end = this.expression(0);
						this.state = 2110;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2112;
						if (!(this.precpred(this._ctx, 32))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 32)");
						}
						this.state = 2113;
						this.match(SolidCashParser.T__65);
						this.state = 2114;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2115;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2116;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 2117;
						this.match(SolidCashParser.T__65);
						this.state = 2118;
						this.expression(0);
						this.state = 2119;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2121;
						if (!(this.precpred(this._ctx, 28))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 28)");
						}
						this.state = 2122;
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
						this.state = 2123;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2124;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.DotSplit);
						this.state = 2125;
						this.match(SolidCashParser.T__48);
						this.state = 2126;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2127;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2129;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2130;
						this.match(SolidCashParser.DotSlice);
						this.state = 2131;
						this.match(SolidCashParser.T__48);
						this.state = 2132;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2133;
						this.match(SolidCashParser.T__4);
						this.state = 2134;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2135;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2137;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2138;
						this.match(SolidCashParser.T__11);
						this.state = 2139;
						this.match(SolidCashParser.Identifier);
						this.state = 2141;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2140;
							this.callOptions();
							}
						}

						this.state = 2143;
						this.match(SolidCashParser.T__48);
						this.state = 2144;
						this.match(SolidCashParser.T__3);
						this.state = 2156;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===180) {
							{
							this.state = 2145;
							this.namedArg();
							this.state = 2150;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 234, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2146;
									this.match(SolidCashParser.T__4);
									this.state = 2147;
									this.namedArg();
									}
									}
								}
								this.state = 2152;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 234, this._ctx);
							}
							this.state = 2154;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2153;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2158;
						this.match(SolidCashParser.T__5);
						this.state = 2159;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 20:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2160;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2161;
						this.match(SolidCashParser.T__11);
						this.state = 2162;
						this.match(SolidCashParser.Identifier);
						this.state = 2164;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2163;
							this.callOptions();
							}
						}

						this.state = 2166;
						this.expressionList();
						}
						break;
					case 21:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2167;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2168;
						this.memberName();
						}
						break;
					case 22:
						{
						localctx = new PostfixOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2169;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 2170;
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
				this.state = 2175;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 239, this._ctx);
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
			this.state = 2189;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2176;
				this.match(SolidCashParser.T__11);
				this.state = 2177;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2178;
				this.match(SolidCashParser.DotValue);
				}
				break;
			case 172:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2179;
				this.match(SolidCashParser.DotLockingBytecode);
				}
				break;
			case 173:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2180;
				this.match(SolidCashParser.DotTokenCategory);
				}
				break;
			case 174:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2181;
				this.match(SolidCashParser.DotNftCommitment);
				}
				break;
			case 175:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2182;
				this.match(SolidCashParser.DotTokenAmount);
				}
				break;
			case 176:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2183;
				this.match(SolidCashParser.DotOutpointTransactionHash);
				}
				break;
			case 177:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2184;
				this.match(SolidCashParser.DotOutpointIndex);
				}
				break;
			case 178:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2185;
				this.match(SolidCashParser.DotUnlockingBytecode);
				}
				break;
			case 179:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2186;
				this.match(SolidCashParser.DotSequenceNumber);
				}
				break;
			case 170:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2187;
				this.match(SolidCashParser.DotCode);
				}
				break;
			case 171:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2188;
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
			this.state = 2191;
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
			this.state = 2207;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 141:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2193;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 145:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2194;
				this.numberLiteral();
				}
				break;
			case 144:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2195;
				this.decimalLiteral();
				}
				break;
			case 151:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2196;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2200;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 241, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2197;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2202;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 241, this._ctx);
				}
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2203;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2204;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 152:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2205;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 153:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2206;
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
			this.state = 2209;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2211;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 243, this._ctx) ) {
			case 1:
				{
				this.state = 2210;
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
			this.state = 2213;
			this.match(SolidCashParser.DecimalLiteral);
			this.state = 2215;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 244, this._ctx) ) {
			case 1:
				{
				this.state = 2214;
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
			this.state = 2267;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 250, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2217;
				this.match(SolidCashParser.T__107);
				this.state = 2218;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2219;
				this.match(SolidCashParser.T__107);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2220;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2221;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2222;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2223;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2224;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2225;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2226;
				this.match(SolidCashParser.T__137);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2227;
				this.match(SolidCashParser.T__138);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2228;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2229;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2230;
				this.match(SolidCashParser.T__6);
				this.state = 2231;
				this.match(SolidCashParser.T__48);
				this.state = 2240;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 2232;
					this.typeName();
					this.state = 2237;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2233;
						this.match(SolidCashParser.T__4);
						this.state = 2234;
						this.typeName();
						}
						}
						this.state = 2239;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2242;
				this.match(SolidCashParser.T__49);
				this.state = 2246;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===70 || _la===71) {
					{
					{
					this.state = 2243;
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
					this.state = 2248;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 2261;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===73) {
					{
					this.state = 2249;
					this.match(SolidCashParser.T__72);
					this.state = 2250;
					this.match(SolidCashParser.T__48);
					this.state = 2251;
					this.typeName();
					this.state = 2256;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2252;
						this.match(SolidCashParser.T__4);
						this.state = 2253;
						this.typeName();
						}
						}
						this.state = 2258;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2259;
					this.match(SolidCashParser.T__49);
					}
				}

				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2263;
				this.match(SolidCashParser.Identifier);
				this.state = 2264;
				this.match(SolidCashParser.T__11);
				this.state = 2265;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 2266;
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
			this.state = 2269;
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

	public static readonly _serializedATN: number[] = [4,1,183,2272,2,0,7,0,
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
	0,1,0,1,0,1,0,1,0,5,0,275,8,0,10,0,12,0,278,9,0,1,0,1,0,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,5,1,295,8,1,10,1,12,1,298,9,1,1,1,3,
	1,301,8,1,1,1,1,1,1,1,1,1,1,1,3,1,308,8,1,1,2,1,2,1,2,3,2,313,8,2,1,3,1,
	3,1,3,1,3,5,3,319,8,3,10,3,12,3,322,9,3,1,3,3,3,325,8,3,1,3,1,3,5,3,329,
	8,3,10,3,12,3,332,9,3,1,3,1,3,1,4,1,4,1,4,1,4,1,4,1,4,3,4,342,8,4,1,4,3,
	4,345,8,4,1,4,1,4,1,4,1,4,1,4,1,4,5,4,353,8,4,10,4,12,4,356,9,4,1,4,3,4,
	359,8,4,1,4,1,4,1,4,1,4,1,4,3,4,366,8,4,1,4,3,4,369,8,4,1,4,1,4,3,4,373,
	8,4,1,5,1,5,1,5,3,5,378,8,5,1,5,1,5,3,5,382,8,5,1,6,1,6,1,7,1,7,1,8,1,8,
	1,8,1,8,1,8,1,8,1,8,1,8,5,8,396,8,8,10,8,12,8,399,9,8,1,8,3,8,402,8,8,1,
	9,1,9,1,10,4,10,407,8,10,11,10,12,10,408,1,10,3,10,412,8,10,1,11,3,11,415,
	8,11,1,11,1,11,1,12,1,12,1,13,1,13,1,13,1,13,1,13,1,13,5,13,427,8,13,10,
	13,12,13,430,9,13,3,13,432,8,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,
	1,13,5,13,443,8,13,10,13,12,13,446,9,13,1,13,1,13,1,14,1,14,1,14,1,14,1,
	14,1,14,1,14,1,14,1,14,1,14,3,14,460,8,14,1,15,1,15,1,15,1,15,1,15,1,16,
	1,16,1,17,1,17,1,17,1,17,5,17,473,8,17,10,17,12,17,476,9,17,1,17,3,17,479,
	8,17,1,17,1,17,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,
	18,5,18,495,8,18,10,18,12,18,498,9,18,1,18,1,18,1,19,3,19,503,8,19,1,19,
	1,19,1,19,3,19,508,8,19,1,19,1,19,1,19,1,19,5,19,514,8,19,10,19,12,19,517,
	9,19,3,19,519,8,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,
	19,1,19,1,19,1,19,1,19,5,19,536,8,19,10,19,12,19,539,9,19,1,19,1,19,1,20,
	1,20,3,20,545,8,20,1,21,1,21,1,21,1,21,1,21,5,21,552,8,21,10,21,12,21,555,
	9,21,1,21,3,21,558,8,21,1,21,1,21,1,22,1,22,1,22,1,22,1,22,1,22,5,22,568,
	8,22,10,22,12,22,571,9,22,1,22,3,22,574,8,22,3,22,576,8,22,1,22,1,22,3,
	22,580,8,22,1,22,1,22,1,23,1,23,3,23,586,8,23,1,23,3,23,589,8,23,1,23,3,
	23,592,8,23,1,24,1,24,1,24,1,24,1,24,1,24,5,24,600,8,24,10,24,12,24,603,
	9,24,1,24,3,24,606,8,24,3,24,608,8,24,1,24,1,24,1,24,1,25,1,25,3,25,615,
	8,25,1,26,1,26,1,26,1,26,4,26,621,8,26,11,26,12,26,622,1,26,1,26,1,27,1,
	27,1,27,3,27,630,8,27,1,27,1,27,1,27,1,28,1,28,1,28,1,28,1,28,1,28,5,28,
	641,8,28,10,28,12,28,644,9,28,1,28,3,28,647,8,28,1,28,1,28,1,29,1,29,1,
	29,3,29,654,8,29,1,30,1,30,1,30,1,30,1,30,1,30,1,31,1,31,1,31,1,31,1,31,
	1,31,1,31,1,32,1,32,1,32,5,32,672,8,32,10,32,12,32,675,9,32,1,32,5,32,678,
	8,32,10,32,12,32,681,9,32,1,32,1,32,5,32,685,8,32,10,32,12,32,688,9,32,
	1,32,1,32,1,33,1,33,1,33,1,33,5,33,696,8,33,10,33,12,33,699,9,33,1,33,5,
	33,702,8,33,10,33,12,33,705,9,33,1,33,3,33,708,8,33,1,33,1,33,5,33,712,
	8,33,10,33,12,33,715,9,33,1,33,1,33,1,34,1,34,1,34,3,34,722,8,34,1,35,1,
	35,1,35,1,35,5,35,728,8,35,10,35,12,35,731,9,35,1,35,1,35,5,35,735,8,35,
	10,35,12,35,738,9,35,1,35,1,35,5,35,742,8,35,10,35,12,35,745,9,35,1,35,
	1,35,5,35,749,8,35,10,35,12,35,752,9,35,1,35,1,35,1,36,1,36,3,36,758,8,
	36,1,37,1,37,1,37,1,38,3,38,764,8,38,1,38,1,38,1,38,5,38,769,8,38,10,38,
	12,38,772,9,38,1,38,1,38,1,38,3,38,777,8,38,1,38,1,38,1,38,1,38,1,38,5,
	38,784,8,38,10,38,12,38,787,9,38,1,38,1,38,1,38,5,38,792,8,38,10,38,12,
	38,795,9,38,1,38,1,38,1,38,3,38,800,8,38,1,38,1,38,1,38,3,38,805,8,38,1,
	38,1,38,5,38,809,8,38,10,38,12,38,812,9,38,1,38,1,38,1,38,1,38,3,38,818,
	8,38,1,38,1,38,5,38,822,8,38,10,38,12,38,825,9,38,1,38,1,38,1,38,3,38,830,
	8,38,1,38,1,38,3,38,834,8,38,1,39,1,39,1,39,3,39,839,8,39,1,40,1,40,1,41,
	1,41,1,41,1,41,3,41,847,8,41,1,41,1,41,1,41,3,41,852,8,41,1,41,1,41,1,41,
	1,41,1,41,1,41,3,41,860,8,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,3,
	41,870,8,41,1,41,1,41,1,41,3,41,875,8,41,1,41,1,41,3,41,879,8,41,1,42,1,
	42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,3,42,891,8,42,1,42,1,42,1,42,
	1,42,1,42,1,42,1,42,5,42,900,8,42,10,42,12,42,903,9,42,1,43,1,43,1,43,3,
	43,908,8,43,1,43,1,43,5,43,912,8,43,10,43,12,43,915,9,43,1,43,1,43,1,44,
	1,44,3,44,921,8,44,1,45,1,45,1,45,1,46,1,46,1,46,1,46,1,46,5,46,931,8,46,
	10,46,12,46,934,9,46,1,46,3,46,937,8,46,1,46,1,46,5,46,941,8,46,10,46,12,
	46,944,9,46,1,46,1,46,1,47,1,47,3,47,950,8,47,1,48,1,48,1,48,1,48,1,48,
	1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,3,48,966,8,48,1,49,1,49,1,
	49,1,49,1,49,5,49,973,8,49,10,49,12,49,976,9,49,1,49,3,49,979,8,49,1,50,
	1,50,1,50,1,50,3,50,985,8,50,1,51,1,51,1,51,1,51,1,51,5,51,992,8,51,10,
	51,12,51,995,9,51,1,51,3,51,998,8,51,1,51,1,51,1,52,1,52,5,52,1004,8,52,
	10,52,12,52,1007,9,52,1,52,3,52,1010,8,52,1,52,1,52,5,52,1014,8,52,10,52,
	12,52,1017,9,52,1,52,3,52,1020,8,52,3,52,1022,8,52,1,53,1,53,1,53,1,53,
	5,53,1028,8,53,10,53,12,53,1031,9,53,1,53,3,53,1034,8,53,3,53,1036,8,53,
	1,53,1,53,1,54,1,54,5,54,1042,8,54,10,54,12,54,1045,9,54,1,54,3,54,1048,
	8,54,1,54,1,54,5,54,1052,8,54,10,54,12,54,1055,9,54,1,54,3,54,1058,8,54,
	1,54,1,54,5,54,1062,8,54,10,54,12,54,1065,9,54,1,54,3,54,1068,8,54,3,54,
	1070,8,54,1,55,1,55,5,55,1074,8,55,10,55,12,55,1077,9,55,1,55,1,55,3,55,
	1081,8,55,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,
	56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,3,56,1105,8,56,1,57,1,57,
	1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,3,57,1118,8,57,1,57,1,57,1,
	57,1,57,1,57,1,57,1,57,1,57,1,57,3,57,1129,8,57,1,57,1,57,1,58,1,58,1,58,
	1,58,1,59,1,59,1,59,1,59,1,59,1,59,5,59,1143,8,59,10,59,12,59,1146,9,59,
	1,59,1,59,1,59,1,59,1,59,1,59,1,59,5,59,1155,8,59,10,59,12,59,1158,9,59,
	1,59,3,59,1161,8,59,1,59,1,59,1,59,3,59,1166,8,59,1,60,1,60,1,60,1,60,1,
	60,1,60,1,61,1,61,1,61,1,61,3,61,1178,8,61,1,61,1,61,1,61,1,61,1,61,5,61,
	1185,8,61,10,61,12,61,1188,9,61,1,61,3,61,1191,8,61,3,61,1193,8,61,1,61,
	1,61,1,61,1,61,1,61,1,61,1,61,3,61,1202,8,61,1,61,1,61,1,61,3,61,1207,8,
	61,1,62,1,62,5,62,1211,8,62,10,62,12,62,1214,9,62,1,62,1,62,1,62,3,62,1219,
	8,62,1,62,1,62,1,62,1,62,5,62,1225,8,62,10,62,12,62,1228,9,62,1,62,1,62,
	1,62,3,62,1233,8,62,1,62,1,62,3,62,1237,8,62,1,63,1,63,1,63,1,63,1,63,1,
	63,4,63,1245,8,63,11,63,12,63,1246,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,
	63,4,63,1257,8,63,11,63,12,63,1258,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1267,
	8,63,11,63,12,63,1268,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1278,8,63,
	11,63,12,63,1279,1,63,1,63,1,63,1,63,1,63,3,63,1287,8,63,1,64,1,64,5,64,
	1291,8,64,10,64,12,64,1294,9,64,1,64,1,64,1,64,1,64,3,64,1300,8,64,1,65,
	1,65,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,
	66,1,66,1,66,4,66,1320,8,66,11,66,12,66,1321,1,66,1,66,1,66,1,66,1,66,1,
	66,1,66,1,66,4,66,1332,8,66,11,66,12,66,1333,1,66,1,66,1,66,1,66,1,66,1,
	66,4,66,1342,8,66,11,66,12,66,1343,1,66,1,66,1,66,1,66,4,66,1350,8,66,11,
	66,12,66,1351,1,66,1,66,1,66,1,66,1,66,1,66,4,66,1360,8,66,11,66,12,66,
	1361,1,66,3,66,1365,8,66,1,67,1,67,1,67,1,67,1,67,1,67,1,67,3,67,1374,8,
	67,1,67,1,67,1,67,1,68,1,68,1,68,1,68,1,68,3,68,1384,8,68,1,68,1,68,1,68,
	1,69,1,69,1,69,1,69,1,69,1,69,1,69,3,69,1396,8,69,1,70,1,70,1,70,1,70,1,
	70,1,70,3,70,1404,8,70,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,
	1,71,1,71,1,71,1,71,1,71,1,71,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,
	72,1,72,1,72,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,74,
	1,74,1,74,1,74,1,74,3,74,1449,8,74,1,74,1,74,1,74,1,75,1,75,5,75,1456,8,
	75,10,75,12,75,1459,9,75,1,75,1,75,1,75,3,75,1464,8,75,1,75,1,75,1,75,1,
	75,1,75,1,75,1,75,1,75,3,75,1474,8,75,1,76,1,76,1,76,1,77,1,77,1,77,1,77,
	1,77,1,77,1,77,3,77,1486,8,77,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,
	79,1,79,1,79,1,79,1,79,1,79,1,80,1,80,1,80,1,80,1,81,1,81,1,81,1,82,1,82,
	5,82,1511,8,82,10,82,12,82,1514,9,82,1,82,1,82,1,83,1,83,1,83,1,83,1,83,
	1,83,1,83,1,83,1,83,1,83,1,83,1,83,1,83,3,83,1531,8,83,1,84,1,84,1,84,1,
	84,5,84,1537,8,84,10,84,12,84,1540,9,84,1,84,1,84,3,84,1544,8,84,1,85,1,
	85,1,85,5,85,1549,8,85,10,85,12,85,1552,9,85,1,85,1,85,1,85,1,86,1,86,1,
	86,1,86,1,87,1,87,1,87,4,87,1564,8,87,11,87,12,87,1565,1,87,3,87,1569,8,
	87,1,87,3,87,1572,8,87,1,88,1,88,1,88,1,88,1,89,1,89,1,89,1,90,1,90,1,90,
	1,90,1,90,1,90,1,91,1,91,1,91,1,91,1,91,1,91,5,91,1593,8,91,10,91,12,91,
	1596,9,91,3,91,1598,8,91,1,91,1,91,1,91,1,91,1,91,5,91,1605,8,91,10,91,
	12,91,1608,9,91,3,91,1610,8,91,1,91,1,91,1,92,1,92,1,92,3,92,1617,8,92,
	1,93,1,93,1,93,1,93,1,93,5,93,1624,8,93,10,93,12,93,1627,9,93,3,93,1629,
	8,93,1,93,1,93,1,94,1,94,1,95,1,95,1,95,1,95,5,95,1639,8,95,10,95,12,95,
	1642,9,95,1,96,1,96,1,97,1,97,1,97,5,97,1649,8,97,10,97,12,97,1652,9,97,
	1,97,1,97,1,98,1,98,1,98,1,98,1,98,1,98,5,98,1662,8,98,10,98,12,98,1665,
	9,98,1,98,3,98,1668,8,98,1,98,1,98,1,99,1,99,1,99,1,99,5,99,1676,8,99,10,
	99,12,99,1679,9,99,1,100,1,100,1,100,5,100,1684,8,100,10,100,12,100,1687,
	9,100,1,101,1,101,1,101,3,101,1692,8,101,1,101,1,101,4,101,1696,8,101,11,
	101,12,101,1697,1,102,1,102,1,102,1,102,1,102,5,102,1705,8,102,10,102,12,
	102,1708,9,102,1,102,3,102,1711,8,102,3,102,1713,8,102,1,102,1,102,1,103,
	1,103,3,103,1719,8,103,1,103,1,103,1,103,1,103,5,103,1725,8,103,10,103,
	12,103,1728,9,103,1,103,3,103,1731,8,103,3,103,1733,8,103,1,103,3,103,1736,
	8,103,1,103,1,103,1,104,1,104,1,104,1,105,1,105,1,105,1,106,1,106,1,106,
	3,106,1749,8,106,1,107,1,107,1,107,1,107,3,107,1755,8,107,1,107,1,107,1,
	107,1,107,1,107,5,107,1762,8,107,10,107,12,107,1765,9,107,1,107,3,107,1768,
	8,107,3,107,1770,8,107,1,107,1,107,1,107,1,107,1,107,1,107,1,107,3,107,
	1779,8,107,1,107,1,107,1,107,1,107,1,107,1,107,1,107,1,107,1,107,1,107,
	1,107,1,107,3,107,1793,8,107,1,108,1,108,1,108,1,108,1,108,1,108,1,109,
	1,109,3,109,1803,8,109,1,110,1,110,1,110,1,110,5,110,1809,8,110,10,110,
	12,110,1812,9,110,1,110,3,110,1815,8,110,3,110,1817,8,110,1,110,1,110,1,
	111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,1,111,5,
	111,1833,8,111,10,111,12,111,1836,9,111,1,111,3,111,1839,8,111,3,111,1841,
	8,111,1,111,1,111,3,111,1845,8,111,1,112,1,112,1,112,1,112,1,113,1,113,
	1,113,1,113,5,113,1855,8,113,10,113,12,113,1858,9,113,1,113,3,113,1861,
	8,113,3,113,1863,8,113,1,113,1,113,1,114,1,114,1,114,1,114,5,114,1871,8,
	114,10,114,12,114,1874,9,114,1,114,3,114,1877,8,114,1,114,1,114,1,115,1,
	115,1,115,1,115,1,116,1,116,1,116,1,116,5,116,1889,8,116,10,116,12,116,
	1892,9,116,1,116,3,116,1895,8,116,1,116,1,116,1,117,1,117,3,117,1901,8,
	117,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,
	118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,4,118,1925,
	8,118,11,118,12,118,1926,1,118,1,118,1,118,1,118,1,118,1,118,3,118,1935,
	8,118,1,118,1,118,1,118,1,118,1,118,1,118,3,118,1943,8,118,1,118,1,118,
	1,118,1,118,1,118,4,118,1950,8,118,11,118,12,118,1951,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,5,118,2026,8,118,
	10,118,12,118,2029,9,118,1,118,3,118,2032,8,118,3,118,2034,8,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,4,118,2054,8,118,11,118,12,118,2055,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,3,118,2065,8,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,
	3,118,2142,8,118,1,118,1,118,1,118,1,118,1,118,5,118,2149,8,118,10,118,
	12,118,2152,9,118,1,118,3,118,2155,8,118,3,118,2157,8,118,1,118,1,118,1,
	118,1,118,1,118,1,118,3,118,2165,8,118,1,118,1,118,1,118,1,118,1,118,5,
	118,2172,8,118,10,118,12,118,2175,9,118,1,119,1,119,1,119,1,119,1,119,1,
	119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,3,119,2190,8,119,1,120,1,
	120,1,121,1,121,1,121,1,121,1,121,5,121,2199,8,121,10,121,12,121,2202,9,
	121,1,121,1,121,1,121,1,121,3,121,2208,8,121,1,122,1,122,3,122,2212,8,122,
	1,123,1,123,3,123,2216,8,123,1,124,1,124,1,124,1,124,1,124,1,124,1,124,
	1,124,1,124,1,124,1,124,1,124,1,124,1,124,1,124,1,124,1,124,1,124,5,124,
	2236,8,124,10,124,12,124,2239,9,124,3,124,2241,8,124,1,124,1,124,5,124,
	2245,8,124,10,124,12,124,2248,9,124,1,124,1,124,1,124,1,124,1,124,5,124,
	2255,8,124,10,124,12,124,2258,9,124,1,124,1,124,3,124,2262,8,124,1,124,
	1,124,1,124,1,124,3,124,2268,8,124,1,125,1,125,1,125,0,2,84,236,126,0,2,
	4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,
	54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,
	102,104,106,108,110,112,114,116,118,120,122,124,126,128,130,132,134,136,
	138,140,142,144,146,148,150,152,154,156,158,160,162,164,166,168,170,172,
	174,176,178,180,182,184,186,188,190,192,194,196,198,200,202,204,206,208,
	210,212,214,216,218,220,222,224,226,228,230,232,234,236,238,240,242,244,
	246,248,250,0,27,2,0,10,10,13,27,5,0,11,11,28,36,143,143,147,147,180,180,
	4,0,140,140,145,145,151,151,180,180,1,0,38,39,2,0,140,140,144,144,3,0,20,
	23,26,27,40,40,1,0,43,44,2,0,43,44,58,59,3,0,43,44,58,58,63,63,2,0,145,
	145,180,180,2,0,40,40,74,83,1,0,84,85,6,0,31,31,36,36,86,86,108,108,149,
	149,180,180,5,0,141,141,145,145,151,151,153,153,162,162,2,0,163,163,172,
	175,2,0,163,163,172,179,3,0,14,14,27,27,127,127,2,0,10,10,15,16,1,0,13,
	14,1,0,128,129,1,0,20,23,1,0,18,19,2,0,126,126,164,164,3,0,33,33,56,56,
	133,137,1,0,142,143,1,0,70,71,5,0,59,59,108,108,138,139,146,149,155,159,
	2580,0,255,1,0,0,0,2,307,1,0,0,0,4,309,1,0,0,0,6,314,1,0,0,0,8,372,1,0,
	0,0,10,374,1,0,0,0,12,383,1,0,0,0,14,385,1,0,0,0,16,401,1,0,0,0,18,403,
	1,0,0,0,20,411,1,0,0,0,22,414,1,0,0,0,24,418,1,0,0,0,26,420,1,0,0,0,28,
	459,1,0,0,0,30,461,1,0,0,0,32,466,1,0,0,0,34,468,1,0,0,0,36,482,1,0,0,0,
	38,502,1,0,0,0,40,542,1,0,0,0,42,546,1,0,0,0,44,561,1,0,0,0,46,585,1,0,
	0,0,48,593,1,0,0,0,50,612,1,0,0,0,52,616,1,0,0,0,54,629,1,0,0,0,56,634,
	1,0,0,0,58,650,1,0,0,0,60,655,1,0,0,0,62,661,1,0,0,0,64,668,1,0,0,0,66,
	691,1,0,0,0,68,721,1,0,0,0,70,723,1,0,0,0,72,757,1,0,0,0,74,759,1,0,0,0,
	76,833,1,0,0,0,78,838,1,0,0,0,80,840,1,0,0,0,82,878,1,0,0,0,84,890,1,0,
	0,0,86,904,1,0,0,0,88,920,1,0,0,0,90,922,1,0,0,0,92,925,1,0,0,0,94,947,
	1,0,0,0,96,965,1,0,0,0,98,967,1,0,0,0,100,980,1,0,0,0,102,986,1,0,0,0,104,
	1021,1,0,0,0,106,1023,1,0,0,0,108,1069,1,0,0,0,110,1080,1,0,0,0,112,1104,
	1,0,0,0,114,1106,1,0,0,0,116,1132,1,0,0,0,118,1165,1,0,0,0,120,1167,1,0,
	0,0,122,1206,1,0,0,0,124,1236,1,0,0,0,126,1286,1,0,0,0,128,1299,1,0,0,0,
	130,1301,1,0,0,0,132,1364,1,0,0,0,134,1366,1,0,0,0,136,1378,1,0,0,0,138,
	1388,1,0,0,0,140,1403,1,0,0,0,142,1405,1,0,0,0,144,1421,1,0,0,0,146,1432,
	1,0,0,0,148,1443,1,0,0,0,150,1473,1,0,0,0,152,1475,1,0,0,0,154,1485,1,0,
	0,0,156,1487,1,0,0,0,158,1495,1,0,0,0,160,1501,1,0,0,0,162,1505,1,0,0,0,
	164,1508,1,0,0,0,166,1530,1,0,0,0,168,1532,1,0,0,0,170,1545,1,0,0,0,172,
	1556,1,0,0,0,174,1560,1,0,0,0,176,1573,1,0,0,0,178,1577,1,0,0,0,180,1580,
	1,0,0,0,182,1586,1,0,0,0,184,1616,1,0,0,0,186,1618,1,0,0,0,188,1632,1,0,
	0,0,190,1634,1,0,0,0,192,1643,1,0,0,0,194,1645,1,0,0,0,196,1655,1,0,0,0,
	198,1671,1,0,0,0,200,1680,1,0,0,0,202,1688,1,0,0,0,204,1699,1,0,0,0,206,
	1716,1,0,0,0,208,1739,1,0,0,0,210,1742,1,0,0,0,212,1748,1,0,0,0,214,1792,
	1,0,0,0,216,1794,1,0,0,0,218,1802,1,0,0,0,220,1804,1,0,0,0,222,1844,1,0,
	0,0,224,1846,1,0,0,0,226,1850,1,0,0,0,228,1866,1,0,0,0,230,1880,1,0,0,0,
	232,1884,1,0,0,0,234,1900,1,0,0,0,236,2064,1,0,0,0,238,2189,1,0,0,0,240,
	2191,1,0,0,0,242,2207,1,0,0,0,244,2209,1,0,0,0,246,2213,1,0,0,0,248,2267,
	1,0,0,0,250,2269,1,0,0,0,252,254,3,16,8,0,253,252,1,0,0,0,254,257,1,0,0,
	0,255,253,1,0,0,0,255,256,1,0,0,0,256,261,1,0,0,0,257,255,1,0,0,0,258,260,
	3,2,1,0,259,258,1,0,0,0,260,263,1,0,0,0,261,259,1,0,0,0,261,262,1,0,0,0,
	262,276,1,0,0,0,263,261,1,0,0,0,264,275,3,62,31,0,265,275,3,56,28,0,266,
	275,3,52,26,0,267,275,3,60,30,0,268,275,3,8,4,0,269,275,3,48,24,0,270,275,
	3,26,13,0,271,275,3,6,3,0,272,275,3,36,18,0,273,275,3,38,19,0,274,264,1,
	0,0,0,274,265,1,0,0,0,274,266,1,0,0,0,274,267,1,0,0,0,274,268,1,0,0,0,274,
	269,1,0,0,0,274,270,1,0,0,0,274,271,1,0,0,0,274,272,1,0,0,0,274,273,1,0,
	0,0,275,278,1,0,0,0,276,274,1,0,0,0,276,277,1,0,0,0,277,279,1,0,0,0,278,
	276,1,0,0,0,279,280,5,0,0,1,280,1,1,0,0,0,281,282,5,1,0,0,282,283,5,151,
	0,0,283,308,5,2,0,0,284,285,5,1,0,0,285,286,5,151,0,0,286,287,5,3,0,0,287,
	288,5,180,0,0,288,308,5,2,0,0,289,290,5,1,0,0,290,291,5,4,0,0,291,296,3,
	4,2,0,292,293,5,5,0,0,293,295,3,4,2,0,294,292,1,0,0,0,295,298,1,0,0,0,296,
	294,1,0,0,0,296,297,1,0,0,0,297,300,1,0,0,0,298,296,1,0,0,0,299,301,5,5,
	0,0,300,299,1,0,0,0,300,301,1,0,0,0,301,302,1,0,0,0,302,303,5,6,0,0,303,
	304,5,180,0,0,304,305,5,151,0,0,305,306,5,2,0,0,306,308,1,0,0,0,307,281,
	1,0,0,0,307,284,1,0,0,0,307,289,1,0,0,0,308,3,1,0,0,0,309,312,5,180,0,0,
	310,311,5,3,0,0,311,313,5,180,0,0,312,310,1,0,0,0,312,313,1,0,0,0,313,5,
	1,0,0,0,314,315,5,7,0,0,315,316,3,14,7,0,316,320,3,106,53,0,317,319,3,96,
	48,0,318,317,1,0,0,0,319,322,1,0,0,0,320,318,1,0,0,0,320,321,1,0,0,0,321,
	324,1,0,0,0,322,320,1,0,0,0,323,325,3,102,51,0,324,323,1,0,0,0,324,325,
	1,0,0,0,325,326,1,0,0,0,326,330,5,4,0,0,327,329,3,112,56,0,328,327,1,0,
	0,0,329,332,1,0,0,0,330,328,1,0,0,0,330,331,1,0,0,0,331,333,1,0,0,0,332,
	330,1,0,0,0,333,334,5,6,0,0,334,7,1,0,0,0,335,336,5,8,0,0,336,337,5,180,
	0,0,337,341,5,9,0,0,338,342,3,84,42,0,339,342,3,248,124,0,340,342,5,10,
	0,0,341,338,1,0,0,0,341,339,1,0,0,0,341,340,1,0,0,0,342,344,1,0,0,0,343,
	345,5,11,0,0,344,343,1,0,0,0,344,345,1,0,0,0,345,346,1,0,0,0,346,373,5,
	2,0,0,347,348,5,8,0,0,348,349,5,4,0,0,349,354,3,10,5,0,350,351,5,5,0,0,
	351,353,3,10,5,0,352,350,1,0,0,0,353,356,1,0,0,0,354,352,1,0,0,0,354,355,
	1,0,0,0,355,358,1,0,0,0,356,354,1,0,0,0,357,359,5,5,0,0,358,357,1,0,0,0,
	358,359,1,0,0,0,359,360,1,0,0,0,360,361,5,6,0,0,361,365,5,9,0,0,362,366,
	3,84,42,0,363,366,3,248,124,0,364,366,5,10,0,0,365,362,1,0,0,0,365,363,
	1,0,0,0,365,364,1,0,0,0,366,368,1,0,0,0,367,369,5,11,0,0,368,367,1,0,0,
	0,368,369,1,0,0,0,369,370,1,0,0,0,370,371,5,2,0,0,371,373,1,0,0,0,372,335,
	1,0,0,0,372,347,1,0,0,0,373,9,1,0,0,0,374,377,5,180,0,0,375,376,5,12,0,
	0,376,378,5,180,0,0,377,375,1,0,0,0,377,378,1,0,0,0,378,381,1,0,0,0,379,
	380,5,3,0,0,380,382,3,12,6,0,381,379,1,0,0,0,381,382,1,0,0,0,382,11,1,0,
	0,0,383,384,7,0,0,0,384,13,1,0,0,0,385,386,7,1,0,0,386,15,1,0,0,0,387,388,
	5,37,0,0,388,389,3,18,9,0,389,390,3,20,10,0,390,391,5,2,0,0,391,402,1,0,
	0,0,392,393,5,37,0,0,393,397,5,180,0,0,394,396,7,2,0,0,395,394,1,0,0,0,
	396,399,1,0,0,0,397,395,1,0,0,0,397,398,1,0,0,0,398,400,1,0,0,0,399,397,
	1,0,0,0,400,402,5,2,0,0,401,387,1,0,0,0,401,392,1,0,0,0,402,17,1,0,0,0,
	403,404,7,3,0,0,404,19,1,0,0,0,405,407,3,22,11,0,406,405,1,0,0,0,407,408,
	1,0,0,0,408,406,1,0,0,0,408,409,1,0,0,0,409,412,1,0,0,0,410,412,5,10,0,
	0,411,406,1,0,0,0,411,410,1,0,0,0,412,21,1,0,0,0,413,415,3,24,12,0,414,
	413,1,0,0,0,414,415,1,0,0,0,415,416,1,0,0,0,416,417,7,4,0,0,417,23,1,0,
	0,0,418,419,7,5,0,0,419,25,1,0,0,0,420,421,5,41,0,0,421,431,5,180,0,0,422,
	423,5,42,0,0,423,428,5,180,0,0,424,425,5,5,0,0,425,427,5,180,0,0,426,424,
	1,0,0,0,427,430,1,0,0,0,428,426,1,0,0,0,428,429,1,0,0,0,429,432,1,0,0,0,
	430,428,1,0,0,0,431,422,1,0,0,0,431,432,1,0,0,0,432,433,1,0,0,0,433,444,
	5,4,0,0,434,443,3,56,28,0,435,443,3,52,26,0,436,443,3,60,30,0,437,443,3,
	44,22,0,438,443,3,48,24,0,439,443,3,30,15,0,440,443,3,28,14,0,441,443,3,
	34,17,0,442,434,1,0,0,0,442,435,1,0,0,0,442,436,1,0,0,0,442,437,1,0,0,0,
	442,438,1,0,0,0,442,439,1,0,0,0,442,440,1,0,0,0,442,441,1,0,0,0,443,446,
	1,0,0,0,444,442,1,0,0,0,444,445,1,0,0,0,445,447,1,0,0,0,446,444,1,0,0,0,
	447,448,5,6,0,0,448,27,1,0,0,0,449,450,3,32,16,0,450,451,3,82,41,0,451,
	452,5,180,0,0,452,453,5,2,0,0,453,460,1,0,0,0,454,455,3,32,16,0,455,456,
	3,84,42,0,456,457,5,180,0,0,457,458,5,2,0,0,458,460,1,0,0,0,459,449,1,0,
	0,0,459,454,1,0,0,0,460,29,1,0,0,0,461,462,3,32,16,0,462,463,3,248,124,
	0,463,464,5,180,0,0,464,465,5,2,0,0,465,31,1,0,0,0,466,467,7,6,0,0,467,
	33,1,0,0,0,468,469,5,7,0,0,469,470,5,180,0,0,470,474,3,106,53,0,471,473,
	3,96,48,0,472,471,1,0,0,0,473,476,1,0,0,0,474,472,1,0,0,0,474,475,1,0,0,
	0,475,478,1,0,0,0,476,474,1,0,0,0,477,479,3,102,51,0,478,477,1,0,0,0,478,
	479,1,0,0,0,479,480,1,0,0,0,480,481,5,2,0,0,481,35,1,0,0,0,482,483,5,45,
	0,0,483,484,5,180,0,0,484,496,5,4,0,0,485,495,3,56,28,0,486,495,3,52,26,
	0,487,495,3,60,30,0,488,495,3,44,22,0,489,495,3,48,24,0,490,495,3,62,31,
	0,491,495,3,76,38,0,492,495,3,8,4,0,493,495,3,6,3,0,494,485,1,0,0,0,494,
	486,1,0,0,0,494,487,1,0,0,0,494,488,1,0,0,0,494,489,1,0,0,0,494,490,1,0,
	0,0,494,491,1,0,0,0,494,492,1,0,0,0,494,493,1,0,0,0,495,498,1,0,0,0,496,
	494,1,0,0,0,496,497,1,0,0,0,497,499,1,0,0,0,498,496,1,0,0,0,499,500,5,6,
	0,0,500,37,1,0,0,0,501,503,5,46,0,0,502,501,1,0,0,0,502,503,1,0,0,0,503,
	504,1,0,0,0,504,505,5,47,0,0,505,507,5,180,0,0,506,508,3,106,53,0,507,506,
	1,0,0,0,507,508,1,0,0,0,508,518,1,0,0,0,509,510,5,42,0,0,510,515,3,40,20,
	0,511,512,5,5,0,0,512,514,3,40,20,0,513,511,1,0,0,0,514,517,1,0,0,0,515,
	513,1,0,0,0,515,516,1,0,0,0,516,519,1,0,0,0,517,515,1,0,0,0,518,509,1,0,
	0,0,518,519,1,0,0,0,519,520,1,0,0,0,520,537,5,4,0,0,521,536,3,56,28,0,522,
	536,3,52,26,0,523,536,3,60,30,0,524,536,3,44,22,0,525,536,3,48,24,0,526,
	536,3,62,31,0,527,536,3,8,4,0,528,536,3,76,38,0,529,536,3,86,43,0,530,536,
	3,64,32,0,531,536,3,92,46,0,532,536,3,42,21,0,533,536,3,66,33,0,534,536,
	3,70,35,0,535,521,1,0,0,0,535,522,1,0,0,0,535,523,1,0,0,0,535,524,1,0,0,
	0,535,525,1,0,0,0,535,526,1,0,0,0,535,527,1,0,0,0,535,528,1,0,0,0,535,529,
	1,0,0,0,535,530,1,0,0,0,535,531,1,0,0,0,535,532,1,0,0,0,535,533,1,0,0,0,
	535,534,1,0,0,0,536,539,1,0,0,0,537,535,1,0,0,0,537,538,1,0,0,0,538,540,
	1,0,0,0,539,537,1,0,0,0,540,541,5,6,0,0,541,39,1,0,0,0,542,544,5,180,0,
	0,543,545,3,226,113,0,544,543,1,0,0,0,544,545,1,0,0,0,545,41,1,0,0,0,546,
	547,5,7,0,0,547,548,3,14,7,0,548,553,3,106,53,0,549,552,3,96,48,0,550,552,
	3,94,47,0,551,549,1,0,0,0,551,550,1,0,0,0,552,555,1,0,0,0,553,551,1,0,0,
	0,553,554,1,0,0,0,554,557,1,0,0,0,555,553,1,0,0,0,556,558,3,102,51,0,557,
	556,1,0,0,0,557,558,1,0,0,0,558,559,1,0,0,0,559,560,5,2,0,0,560,43,1,0,
	0,0,561,562,5,48,0,0,562,563,5,180,0,0,563,575,5,49,0,0,564,569,3,46,23,
	0,565,566,5,5,0,0,566,568,3,46,23,0,567,565,1,0,0,0,568,571,1,0,0,0,569,
	567,1,0,0,0,569,570,1,0,0,0,570,573,1,0,0,0,571,569,1,0,0,0,572,574,5,5,
	0,0,573,572,1,0,0,0,573,574,1,0,0,0,574,576,1,0,0,0,575,564,1,0,0,0,575,
	576,1,0,0,0,576,577,1,0,0,0,577,579,5,50,0,0,578,580,5,51,0,0,579,578,1,
	0,0,0,579,580,1,0,0,0,580,581,1,0,0,0,581,582,5,2,0,0,582,45,1,0,0,0,583,
	586,3,248,124,0,584,586,3,84,42,0,585,583,1,0,0,0,585,584,1,0,0,0,586,588,
	1,0,0,0,587,589,5,52,0,0,588,587,1,0,0,0,588,589,1,0,0,0,589,591,1,0,0,
	0,590,592,5,180,0,0,591,590,1,0,0,0,591,592,1,0,0,0,592,47,1,0,0,0,593,
	594,5,35,0,0,594,595,5,180,0,0,595,607,5,49,0,0,596,601,3,50,25,0,597,598,
	5,5,0,0,598,600,3,50,25,0,599,597,1,0,0,0,600,603,1,0,0,0,601,599,1,0,0,
	0,601,602,1,0,0,0,602,605,1,0,0,0,603,601,1,0,0,0,604,606,5,5,0,0,605,604,
	1,0,0,0,605,606,1,0,0,0,606,608,1,0,0,0,607,596,1,0,0,0,607,608,1,0,0,0,
	608,609,1,0,0,0,609,610,5,50,0,0,610,611,5,2,0,0,611,49,1,0,0,0,612,614,
	3,248,124,0,613,615,5,180,0,0,614,613,1,0,0,0,614,615,1,0,0,0,615,51,1,
	0,0,0,616,617,5,53,0,0,617,618,5,180,0,0,618,620,5,4,0,0,619,621,3,54,27,
	0,620,619,1,0,0,0,621,622,1,0,0,0,622,620,1,0,0,0,622,623,1,0,0,0,623,624,
	1,0,0,0,624,625,5,6,0,0,625,53,1,0,0,0,626,630,3,248,124,0,627,630,3,84,
	42,0,628,630,3,82,41,0,629,626,1,0,0,0,629,627,1,0,0,0,629,628,1,0,0,0,
	630,631,1,0,0,0,631,632,3,14,7,0,632,633,5,2,0,0,633,55,1,0,0,0,634,635,
	5,54,0,0,635,636,5,180,0,0,636,637,5,4,0,0,637,642,3,58,29,0,638,639,5,
	5,0,0,639,641,3,58,29,0,640,638,1,0,0,0,641,644,1,0,0,0,642,640,1,0,0,0,
	642,643,1,0,0,0,643,646,1,0,0,0,644,642,1,0,0,0,645,647,5,5,0,0,646,645,
	1,0,0,0,646,647,1,0,0,0,647,648,1,0,0,0,648,649,5,6,0,0,649,57,1,0,0,0,
	650,653,5,180,0,0,651,652,5,40,0,0,652,654,5,145,0,0,653,651,1,0,0,0,653,
	654,1,0,0,0,654,59,1,0,0,0,655,656,5,55,0,0,656,657,5,180,0,0,657,658,5,
	42,0,0,658,659,3,248,124,0,659,660,5,2,0,0,660,61,1,0,0,0,661,662,3,248,
	124,0,662,663,5,56,0,0,663,664,5,180,0,0,664,665,5,40,0,0,665,666,3,236,
	118,0,666,667,5,2,0,0,667,63,1,0,0,0,668,669,5,57,0,0,669,673,3,106,53,
	0,670,672,7,7,0,0,671,670,1,0,0,0,672,675,1,0,0,0,673,671,1,0,0,0,673,674,
	1,0,0,0,674,679,1,0,0,0,675,673,1,0,0,0,676,678,3,74,37,0,677,676,1,0,0,
	0,678,681,1,0,0,0,679,677,1,0,0,0,679,680,1,0,0,0,680,682,1,0,0,0,681,679,
	1,0,0,0,682,686,5,4,0,0,683,685,3,112,56,0,684,683,1,0,0,0,685,688,1,0,
	0,0,686,684,1,0,0,0,686,687,1,0,0,0,687,689,1,0,0,0,688,686,1,0,0,0,689,
	690,5,6,0,0,690,65,1,0,0,0,691,692,5,60,0,0,692,693,3,106,53,0,693,697,
	5,44,0,0,694,696,3,68,34,0,695,694,1,0,0,0,696,699,1,0,0,0,697,695,1,0,
	0,0,697,698,1,0,0,0,698,703,1,0,0,0,699,697,1,0,0,0,700,702,3,94,47,0,701,
	700,1,0,0,0,702,705,1,0,0,0,703,701,1,0,0,0,703,704,1,0,0,0,704,707,1,0,
	0,0,705,703,1,0,0,0,706,708,3,102,51,0,707,706,1,0,0,0,707,708,1,0,0,0,
	708,709,1,0,0,0,709,713,5,4,0,0,710,712,3,112,56,0,711,710,1,0,0,0,712,
	715,1,0,0,0,713,711,1,0,0,0,713,714,1,0,0,0,714,716,1,0,0,0,715,713,1,0,
	0,0,716,717,5,6,0,0,717,67,1,0,0,0,718,722,5,59,0,0,719,722,5,61,0,0,720,
	722,3,98,49,0,721,718,1,0,0,0,721,719,1,0,0,0,721,720,1,0,0,0,722,69,1,
	0,0,0,723,724,5,62,0,0,724,725,5,49,0,0,725,729,5,50,0,0,726,728,3,72,36,
	0,727,726,1,0,0,0,728,731,1,0,0,0,729,727,1,0,0,0,729,730,1,0,0,0,730,732,
	1,0,0,0,731,729,1,0,0,0,732,736,5,44,0,0,733,735,3,72,36,0,734,733,1,0,
	0,0,735,738,1,0,0,0,736,734,1,0,0,0,736,737,1,0,0,0,737,739,1,0,0,0,738,
	736,1,0,0,0,739,743,5,59,0,0,740,742,3,72,36,0,741,740,1,0,0,0,742,745,
	1,0,0,0,743,741,1,0,0,0,743,744,1,0,0,0,744,746,1,0,0,0,745,743,1,0,0,0,
	746,750,5,4,0,0,747,749,3,112,56,0,748,747,1,0,0,0,749,752,1,0,0,0,750,
	748,1,0,0,0,750,751,1,0,0,0,751,753,1,0,0,0,752,750,1,0,0,0,753,754,5,6,
	0,0,754,71,1,0,0,0,755,758,5,61,0,0,756,758,3,98,49,0,757,755,1,0,0,0,757,
	756,1,0,0,0,758,73,1,0,0,0,759,760,5,180,0,0,760,761,3,226,113,0,761,75,
	1,0,0,0,762,764,3,80,40,0,763,762,1,0,0,0,763,764,1,0,0,0,764,765,1,0,0,
	0,765,770,3,248,124,0,766,769,3,240,120,0,767,769,3,98,49,0,768,766,1,0,
	0,0,768,767,1,0,0,0,769,772,1,0,0,0,770,768,1,0,0,0,770,771,1,0,0,0,771,
	773,1,0,0,0,772,770,1,0,0,0,773,776,5,180,0,0,774,775,5,40,0,0,775,777,
	3,236,118,0,776,774,1,0,0,0,776,777,1,0,0,0,777,778,1,0,0,0,778,779,5,2,
	0,0,779,834,1,0,0,0,780,785,3,248,124,0,781,784,3,240,120,0,782,784,3,98,
	49,0,783,781,1,0,0,0,783,782,1,0,0,0,784,787,1,0,0,0,785,783,1,0,0,0,785,
	786,1,0,0,0,786,788,1,0,0,0,787,785,1,0,0,0,788,793,3,80,40,0,789,792,3,
	240,120,0,790,792,3,98,49,0,791,789,1,0,0,0,791,790,1,0,0,0,792,795,1,0,
	0,0,793,791,1,0,0,0,793,794,1,0,0,0,794,796,1,0,0,0,795,793,1,0,0,0,796,
	799,5,180,0,0,797,798,5,40,0,0,798,800,3,236,118,0,799,797,1,0,0,0,799,
	800,1,0,0,0,800,801,1,0,0,0,801,802,5,2,0,0,802,834,1,0,0,0,803,805,3,80,
	40,0,804,803,1,0,0,0,804,805,1,0,0,0,805,806,1,0,0,0,806,810,3,82,41,0,
	807,809,3,78,39,0,808,807,1,0,0,0,809,812,1,0,0,0,810,808,1,0,0,0,810,811,
	1,0,0,0,811,813,1,0,0,0,812,810,1,0,0,0,813,814,5,180,0,0,814,815,5,2,0,
	0,815,834,1,0,0,0,816,818,3,80,40,0,817,816,1,0,0,0,817,818,1,0,0,0,818,
	819,1,0,0,0,819,823,3,84,42,0,820,822,3,78,39,0,821,820,1,0,0,0,822,825,
	1,0,0,0,823,821,1,0,0,0,823,824,1,0,0,0,824,826,1,0,0,0,825,823,1,0,0,0,
	826,829,5,180,0,0,827,828,5,40,0,0,828,830,3,236,118,0,829,827,1,0,0,0,
	829,830,1,0,0,0,830,831,1,0,0,0,831,832,5,2,0,0,832,834,1,0,0,0,833,763,
	1,0,0,0,833,780,1,0,0,0,833,804,1,0,0,0,833,817,1,0,0,0,834,77,1,0,0,0,
	835,839,3,240,120,0,836,839,3,80,40,0,837,839,3,98,49,0,838,835,1,0,0,0,
	838,836,1,0,0,0,838,837,1,0,0,0,839,79,1,0,0,0,840,841,7,8,0,0,841,81,1,
	0,0,0,842,843,5,64,0,0,843,844,5,49,0,0,844,846,3,248,124,0,845,847,5,180,
	0,0,846,845,1,0,0,0,846,847,1,0,0,0,847,848,1,0,0,0,848,849,5,65,0,0,849,
	851,3,248,124,0,850,852,5,180,0,0,851,850,1,0,0,0,851,852,1,0,0,0,852,853,
	1,0,0,0,853,854,5,50,0,0,854,879,1,0,0,0,855,856,5,64,0,0,856,857,5,49,
	0,0,857,859,3,248,124,0,858,860,5,180,0,0,859,858,1,0,0,0,859,860,1,0,0,
	0,860,861,1,0,0,0,861,862,5,65,0,0,862,863,3,82,41,0,863,864,5,50,0,0,864,
	879,1,0,0,0,865,866,5,64,0,0,866,867,5,49,0,0,867,869,3,248,124,0,868,870,
	5,180,0,0,869,868,1,0,0,0,869,870,1,0,0,0,870,871,1,0,0,0,871,872,5,65,
	0,0,872,874,3,84,42,0,873,875,5,180,0,0,874,873,1,0,0,0,874,875,1,0,0,0,
	875,876,1,0,0,0,876,877,5,50,0,0,877,879,1,0,0,0,878,842,1,0,0,0,878,855,
	1,0,0,0,878,865,1,0,0,0,879,83,1,0,0,0,880,881,6,42,-1,0,881,882,3,248,
	124,0,882,883,5,66,0,0,883,884,7,9,0,0,884,885,5,67,0,0,885,891,1,0,0,0,
	886,887,3,248,124,0,887,888,5,66,0,0,888,889,5,67,0,0,889,891,1,0,0,0,890,
	880,1,0,0,0,890,886,1,0,0,0,891,901,1,0,0,0,892,893,10,2,0,0,893,894,5,
	66,0,0,894,895,7,9,0,0,895,900,5,67,0,0,896,897,10,1,0,0,897,898,5,66,0,
	0,898,900,5,67,0,0,899,892,1,0,0,0,899,896,1,0,0,0,900,903,1,0,0,0,901,
	899,1,0,0,0,901,902,1,0,0,0,902,85,1,0,0,0,903,901,1,0,0,0,904,905,5,68,
	0,0,905,907,5,180,0,0,906,908,3,106,53,0,907,906,1,0,0,0,907,908,1,0,0,
	0,908,909,1,0,0,0,909,913,5,4,0,0,910,912,3,88,44,0,911,910,1,0,0,0,912,
	915,1,0,0,0,913,911,1,0,0,0,913,914,1,0,0,0,914,916,1,0,0,0,915,913,1,0,
	0,0,916,917,5,6,0,0,917,87,1,0,0,0,918,921,3,90,45,0,919,921,3,112,56,0,
	920,918,1,0,0,0,920,919,1,0,0,0,921,89,1,0,0,0,922,923,5,69,0,0,923,924,
	5,2,0,0,924,91,1,0,0,0,925,926,5,7,0,0,926,927,3,14,7,0,927,932,3,106,53,
	0,928,931,3,96,48,0,929,931,3,94,47,0,930,928,1,0,0,0,930,929,1,0,0,0,931,
	934,1,0,0,0,932,930,1,0,0,0,932,933,1,0,0,0,933,936,1,0,0,0,934,932,1,0,
	0,0,935,937,3,102,51,0,936,935,1,0,0,0,936,937,1,0,0,0,937,938,1,0,0,0,
	938,942,5,4,0,0,939,941,3,112,56,0,940,939,1,0,0,0,941,944,1,0,0,0,942,
	940,1,0,0,0,942,943,1,0,0,0,943,945,1,0,0,0,944,942,1,0,0,0,945,946,5,6,
	0,0,946,93,1,0,0,0,947,949,5,180,0,0,948,950,3,226,113,0,949,948,1,0,0,
	0,949,950,1,0,0,0,950,95,1,0,0,0,951,966,5,70,0,0,952,966,5,71,0,0,953,
	966,5,58,0,0,954,966,5,44,0,0,955,966,5,43,0,0,956,966,5,63,0,0,957,966,
	5,59,0,0,958,966,3,98,49,0,959,966,5,61,0,0,960,966,3,100,50,0,961,966,
	5,30,0,0,962,966,5,28,0,0,963,966,5,31,0,0,964,966,5,29,0,0,965,951,1,0,
	0,0,965,952,1,0,0,0,965,953,1,0,0,0,965,954,1,0,0,0,965,955,1,0,0,0,965,
	956,1,0,0,0,965,957,1,0,0,0,965,958,1,0,0,0,965,959,1,0,0,0,965,960,1,0,
	0,0,965,961,1,0,0,0,965,962,1,0,0,0,965,963,1,0,0,0,965,964,1,0,0,0,966,
	97,1,0,0,0,967,978,5,72,0,0,968,969,5,49,0,0,969,974,5,180,0,0,970,971,
	5,5,0,0,971,973,5,180,0,0,972,970,1,0,0,0,973,976,1,0,0,0,974,972,1,0,0,
	0,974,975,1,0,0,0,975,977,1,0,0,0,976,974,1,0,0,0,977,979,5,50,0,0,978,
	968,1,0,0,0,978,979,1,0,0,0,979,99,1,0,0,0,980,984,5,32,0,0,981,982,5,49,
	0,0,982,983,5,145,0,0,983,985,5,50,0,0,984,981,1,0,0,0,984,985,1,0,0,0,
	985,101,1,0,0,0,986,987,5,73,0,0,987,988,5,49,0,0,988,993,3,104,52,0,989,
	990,5,5,0,0,990,992,3,104,52,0,991,989,1,0,0,0,992,995,1,0,0,0,993,991,
	1,0,0,0,993,994,1,0,0,0,994,997,1,0,0,0,995,993,1,0,0,0,996,998,5,5,0,0,
	997,996,1,0,0,0,997,998,1,0,0,0,998,999,1,0,0,0,999,1000,5,50,0,0,1000,
	103,1,0,0,0,1001,1005,3,248,124,0,1002,1004,3,240,120,0,1003,1002,1,0,0,
	0,1004,1007,1,0,0,0,1005,1003,1,0,0,0,1005,1006,1,0,0,0,1006,1009,1,0,0,
	0,1007,1005,1,0,0,0,1008,1010,3,14,7,0,1009,1008,1,0,0,0,1009,1010,1,0,
	0,0,1010,1022,1,0,0,0,1011,1015,3,84,42,0,1012,1014,3,240,120,0,1013,1012,
	1,0,0,0,1014,1017,1,0,0,0,1015,1013,1,0,0,0,1015,1016,1,0,0,0,1016,1019,
	1,0,0,0,1017,1015,1,0,0,0,1018,1020,3,14,7,0,1019,1018,1,0,0,0,1019,1020,
	1,0,0,0,1020,1022,1,0,0,0,1021,1001,1,0,0,0,1021,1011,1,0,0,0,1022,105,
	1,0,0,0,1023,1035,5,49,0,0,1024,1029,3,108,54,0,1025,1026,5,5,0,0,1026,
	1028,3,108,54,0,1027,1025,1,0,0,0,1028,1031,1,0,0,0,1029,1027,1,0,0,0,1029,
	1030,1,0,0,0,1030,1033,1,0,0,0,1031,1029,1,0,0,0,1032,1034,5,5,0,0,1033,
	1032,1,0,0,0,1033,1034,1,0,0,0,1034,1036,1,0,0,0,1035,1024,1,0,0,0,1035,
	1036,1,0,0,0,1036,1037,1,0,0,0,1037,1038,5,50,0,0,1038,107,1,0,0,0,1039,
	1043,3,248,124,0,1040,1042,3,240,120,0,1041,1040,1,0,0,0,1042,1045,1,0,
	0,0,1043,1041,1,0,0,0,1043,1044,1,0,0,0,1044,1047,1,0,0,0,1045,1043,1,0,
	0,0,1046,1048,3,14,7,0,1047,1046,1,0,0,0,1047,1048,1,0,0,0,1048,1070,1,
	0,0,0,1049,1053,3,84,42,0,1050,1052,3,240,120,0,1051,1050,1,0,0,0,1052,
	1055,1,0,0,0,1053,1051,1,0,0,0,1053,1054,1,0,0,0,1054,1057,1,0,0,0,1055,
	1053,1,0,0,0,1056,1058,3,14,7,0,1057,1056,1,0,0,0,1057,1058,1,0,0,0,1058,
	1070,1,0,0,0,1059,1063,3,82,41,0,1060,1062,3,240,120,0,1061,1060,1,0,0,
	0,1062,1065,1,0,0,0,1063,1061,1,0,0,0,1063,1064,1,0,0,0,1064,1067,1,0,0,
	0,1065,1063,1,0,0,0,1066,1068,3,14,7,0,1067,1066,1,0,0,0,1067,1068,1,0,
	0,0,1068,1070,1,0,0,0,1069,1039,1,0,0,0,1069,1049,1,0,0,0,1069,1059,1,0,
	0,0,1070,109,1,0,0,0,1071,1075,5,4,0,0,1072,1074,3,112,56,0,1073,1072,1,
	0,0,0,1074,1077,1,0,0,0,1075,1073,1,0,0,0,1075,1076,1,0,0,0,1076,1078,1,
	0,0,0,1077,1075,1,0,0,0,1078,1081,5,6,0,0,1079,1081,3,112,56,0,1080,1071,
	1,0,0,0,1080,1079,1,0,0,0,1081,111,1,0,0,0,1082,1105,3,90,45,0,1083,1105,
	3,124,62,0,1084,1105,3,126,63,0,1085,1105,3,116,58,0,1086,1105,3,134,67,
	0,1087,1105,3,136,68,0,1088,1105,3,138,69,0,1089,1105,3,140,70,0,1090,1105,
	3,160,80,0,1091,1105,3,122,61,0,1092,1105,3,118,59,0,1093,1105,3,120,60,
	0,1094,1105,3,162,81,0,1095,1105,3,202,101,0,1096,1105,3,214,107,0,1097,
	1105,3,216,108,0,1098,1105,3,132,66,0,1099,1105,3,194,97,0,1100,1105,3,
	196,98,0,1101,1105,3,208,104,0,1102,1105,3,210,105,0,1103,1105,3,114,57,
	0,1104,1082,1,0,0,0,1104,1083,1,0,0,0,1104,1084,1,0,0,0,1104,1085,1,0,0,
	0,1104,1086,1,0,0,0,1104,1087,1,0,0,0,1104,1088,1,0,0,0,1104,1089,1,0,0,
	0,1104,1090,1,0,0,0,1104,1091,1,0,0,0,1104,1092,1,0,0,0,1104,1093,1,0,0,
	0,1104,1094,1,0,0,0,1104,1095,1,0,0,0,1104,1096,1,0,0,0,1104,1097,1,0,0,
	0,1104,1098,1,0,0,0,1104,1099,1,0,0,0,1104,1100,1,0,0,0,1104,1101,1,0,0,
	0,1104,1102,1,0,0,0,1104,1103,1,0,0,0,1105,113,1,0,0,0,1106,1128,3,236,
	118,0,1107,1108,7,10,0,0,1108,1129,3,236,118,0,1109,1110,5,165,0,0,1110,
	1111,5,49,0,0,1111,1112,5,50,0,0,1112,1113,5,40,0,0,1113,1129,3,236,118,
	0,1114,1115,5,165,0,0,1115,1117,5,49,0,0,1116,1118,3,130,65,0,1117,1116,
	1,0,0,0,1117,1118,1,0,0,0,1118,1119,1,0,0,0,1119,1129,5,50,0,0,1120,1121,
	5,166,0,0,1121,1122,5,49,0,0,1122,1129,5,50,0,0,1123,1124,5,169,0,0,1124,
	1125,5,49,0,0,1125,1126,3,236,118,0,1126,1127,5,50,0,0,1127,1129,1,0,0,
	0,1128,1107,1,0,0,0,1128,1109,1,0,0,0,1128,1114,1,0,0,0,1128,1120,1,0,0,
	0,1128,1123,1,0,0,0,1128,1129,1,0,0,0,1129,1130,1,0,0,0,1130,1131,5,2,0,
	0,1131,115,1,0,0,0,1132,1133,7,11,0,0,1133,1134,3,236,118,0,1134,1135,5,
	2,0,0,1135,117,1,0,0,0,1136,1137,5,86,0,0,1137,1166,5,2,0,0,1138,1139,5,
	86,0,0,1139,1144,3,236,118,0,1140,1141,5,5,0,0,1141,1143,3,236,118,0,1142,
	1140,1,0,0,0,1143,1146,1,0,0,0,1144,1142,1,0,0,0,1144,1145,1,0,0,0,1145,
	1147,1,0,0,0,1146,1144,1,0,0,0,1147,1148,5,2,0,0,1148,1166,1,0,0,0,1149,
	1150,5,86,0,0,1150,1151,5,49,0,0,1151,1156,3,236,118,0,1152,1153,5,5,0,
	0,1153,1155,3,236,118,0,1154,1152,1,0,0,0,1155,1158,1,0,0,0,1156,1154,1,
	0,0,0,1156,1157,1,0,0,0,1157,1160,1,0,0,0,1158,1156,1,0,0,0,1159,1161,5,
	5,0,0,1160,1159,1,0,0,0,1160,1161,1,0,0,0,1161,1162,1,0,0,0,1162,1163,5,
	50,0,0,1163,1164,5,2,0,0,1164,1166,1,0,0,0,1165,1136,1,0,0,0,1165,1138,
	1,0,0,0,1165,1149,1,0,0,0,1166,119,1,0,0,0,1167,1168,5,31,0,0,1168,1169,
	5,49,0,0,1169,1170,3,236,118,0,1170,1171,5,50,0,0,1171,1172,5,2,0,0,1172,
	121,1,0,0,0,1173,1174,5,87,0,0,1174,1177,5,180,0,0,1175,1176,5,12,0,0,1176,
	1178,5,180,0,0,1177,1175,1,0,0,0,1177,1178,1,0,0,0,1178,1179,1,0,0,0,1179,
	1180,5,49,0,0,1180,1192,5,4,0,0,1181,1186,3,224,112,0,1182,1183,5,5,0,0,
	1183,1185,3,224,112,0,1184,1182,1,0,0,0,1185,1188,1,0,0,0,1186,1184,1,0,
	0,0,1186,1187,1,0,0,0,1187,1190,1,0,0,0,1188,1186,1,0,0,0,1189,1191,5,5,
	0,0,1190,1189,1,0,0,0,1190,1191,1,0,0,0,1191,1193,1,0,0,0,1192,1181,1,0,
	0,0,1192,1193,1,0,0,0,1193,1194,1,0,0,0,1194,1195,5,6,0,0,1195,1196,5,50,
	0,0,1196,1207,5,2,0,0,1197,1198,5,87,0,0,1198,1201,5,180,0,0,1199,1200,
	5,12,0,0,1200,1202,5,180,0,0,1201,1199,1,0,0,0,1201,1202,1,0,0,0,1202,1203,
	1,0,0,0,1203,1204,3,226,113,0,1204,1205,5,2,0,0,1205,1207,1,0,0,0,1206,
	1173,1,0,0,0,1206,1197,1,0,0,0,1207,123,1,0,0,0,1208,1212,3,248,124,0,1209,
	1211,3,240,120,0,1210,1209,1,0,0,0,1211,1214,1,0,0,0,1212,1210,1,0,0,0,
	1212,1213,1,0,0,0,1213,1215,1,0,0,0,1214,1212,1,0,0,0,1215,1218,3,14,7,
	0,1216,1217,5,40,0,0,1217,1219,3,236,118,0,1218,1216,1,0,0,0,1218,1219,
	1,0,0,0,1219,1220,1,0,0,0,1220,1221,5,2,0,0,1221,1237,1,0,0,0,1222,1226,
	3,84,42,0,1223,1225,3,240,120,0,1224,1223,1,0,0,0,1225,1228,1,0,0,0,1226,
	1224,1,0,0,0,1226,1227,1,0,0,0,1227,1229,1,0,0,0,1228,1226,1,0,0,0,1229,
	1232,3,14,7,0,1230,1231,5,40,0,0,1231,1233,3,236,118,0,1232,1230,1,0,0,
	0,1232,1233,1,0,0,0,1233,1234,1,0,0,0,1234,1235,5,2,0,0,1235,1237,1,0,0,
	0,1236,1208,1,0,0,0,1236,1222,1,0,0,0,1237,125,1,0,0,0,1238,1239,3,248,
	124,0,1239,1244,5,180,0,0,1240,1241,5,5,0,0,1241,1242,3,248,124,0,1242,
	1243,5,180,0,0,1243,1245,1,0,0,0,1244,1240,1,0,0,0,1245,1246,1,0,0,0,1246,
	1244,1,0,0,0,1246,1247,1,0,0,0,1247,1248,1,0,0,0,1248,1249,5,40,0,0,1249,
	1250,3,236,118,0,1250,1251,5,2,0,0,1251,1287,1,0,0,0,1252,1253,5,49,0,0,
	1253,1256,3,128,64,0,1254,1255,5,5,0,0,1255,1257,3,128,64,0,1256,1254,1,
	0,0,0,1257,1258,1,0,0,0,1258,1256,1,0,0,0,1258,1259,1,0,0,0,1259,1260,1,
	0,0,0,1260,1261,5,50,0,0,1261,1262,5,40,0,0,1262,1263,5,49,0,0,1263,1266,
	3,236,118,0,1264,1265,5,5,0,0,1265,1267,3,236,118,0,1266,1264,1,0,0,0,1267,
	1268,1,0,0,0,1268,1266,1,0,0,0,1268,1269,1,0,0,0,1269,1270,1,0,0,0,1270,
	1271,5,50,0,0,1271,1272,5,2,0,0,1272,1287,1,0,0,0,1273,1274,5,49,0,0,1274,
	1277,3,128,64,0,1275,1276,5,5,0,0,1276,1278,3,128,64,0,1277,1275,1,0,0,
	0,1278,1279,1,0,0,0,1279,1277,1,0,0,0,1279,1280,1,0,0,0,1280,1281,1,0,0,
	0,1281,1282,5,50,0,0,1282,1283,5,40,0,0,1283,1284,3,236,118,0,1284,1285,
	5,2,0,0,1285,1287,1,0,0,0,1286,1238,1,0,0,0,1286,1252,1,0,0,0,1286,1273,
	1,0,0,0,1287,127,1,0,0,0,1288,1292,3,248,124,0,1289,1291,3,240,120,0,1290,
	1289,1,0,0,0,1291,1294,1,0,0,0,1292,1290,1,0,0,0,1292,1293,1,0,0,0,1293,
	1295,1,0,0,0,1294,1292,1,0,0,0,1295,1296,3,14,7,0,1296,1300,1,0,0,0,1297,
	1300,3,14,7,0,1298,1300,1,0,0,0,1299,1288,1,0,0,0,1299,1297,1,0,0,0,1299,
	1298,1,0,0,0,1300,129,1,0,0,0,1301,1302,3,236,118,0,1302,131,1,0,0,0,1303,
	1304,5,88,0,0,1304,1305,5,180,0,0,1305,1365,5,2,0,0,1306,1307,5,88,0,0,
	1307,1308,5,89,0,0,1308,1309,5,12,0,0,1309,1310,5,180,0,0,1310,1365,5,2,
	0,0,1311,1312,5,88,0,0,1312,1313,5,89,0,0,1313,1314,5,12,0,0,1314,1319,
	5,180,0,0,1315,1316,5,66,0,0,1316,1317,3,236,118,0,1317,1318,5,67,0,0,1318,
	1320,1,0,0,0,1319,1315,1,0,0,0,1320,1321,1,0,0,0,1321,1319,1,0,0,0,1321,
	1322,1,0,0,0,1322,1323,1,0,0,0,1323,1324,5,2,0,0,1324,1365,1,0,0,0,1325,
	1326,5,88,0,0,1326,1331,5,180,0,0,1327,1328,5,66,0,0,1328,1329,3,236,118,
	0,1329,1330,5,67,0,0,1330,1332,1,0,0,0,1331,1327,1,0,0,0,1332,1333,1,0,
	0,0,1333,1331,1,0,0,0,1333,1334,1,0,0,0,1334,1335,1,0,0,0,1335,1336,5,2,
	0,0,1336,1365,1,0,0,0,1337,1338,5,88,0,0,1338,1341,5,180,0,0,1339,1340,
	5,12,0,0,1340,1342,5,180,0,0,1341,1339,1,0,0,0,1342,1343,1,0,0,0,1343,1341,
	1,0,0,0,1343,1344,1,0,0,0,1344,1349,1,0,0,0,1345,1346,5,66,0,0,1346,1347,
	3,236,118,0,1347,1348,5,67,0,0,1348,1350,1,0,0,0,1349,1345,1,0,0,0,1350,
	1351,1,0,0,0,1351,1349,1,0,0,0,1351,1352,1,0,0,0,1352,1353,1,0,0,0,1353,
	1354,5,2,0,0,1354,1365,1,0,0,0,1355,1356,5,88,0,0,1356,1359,5,180,0,0,1357,
	1358,5,12,0,0,1358,1360,5,180,0,0,1359,1357,1,0,0,0,1360,1361,1,0,0,0,1361,
	1359,1,0,0,0,1361,1362,1,0,0,0,1362,1363,1,0,0,0,1363,1365,5,2,0,0,1364,
	1303,1,0,0,0,1364,1306,1,0,0,0,1364,1311,1,0,0,0,1364,1325,1,0,0,0,1364,
	1337,1,0,0,0,1364,1355,1,0,0,0,1365,133,1,0,0,0,1366,1367,5,90,0,0,1367,
	1368,5,49,0,0,1368,1369,5,154,0,0,1369,1370,5,23,0,0,1370,1373,3,236,118,
	0,1371,1372,5,5,0,0,1372,1374,3,212,106,0,1373,1371,1,0,0,0,1373,1374,1,
	0,0,0,1374,1375,1,0,0,0,1375,1376,5,50,0,0,1376,1377,5,2,0,0,1377,135,1,
	0,0,0,1378,1379,5,90,0,0,1379,1380,5,49,0,0,1380,1383,3,236,118,0,1381,
	1382,5,5,0,0,1382,1384,3,212,106,0,1383,1381,1,0,0,0,1383,1384,1,0,0,0,
	1384,1385,1,0,0,0,1385,1386,5,50,0,0,1386,1387,5,2,0,0,1387,137,1,0,0,0,
	1388,1389,5,91,0,0,1389,1390,5,49,0,0,1390,1391,3,236,118,0,1391,1392,5,
	50,0,0,1392,1395,3,110,55,0,1393,1394,5,92,0,0,1394,1396,3,110,55,0,1395,
	1393,1,0,0,0,1395,1396,1,0,0,0,1396,139,1,0,0,0,1397,1404,3,156,78,0,1398,
	1404,3,158,79,0,1399,1404,3,148,74,0,1400,1404,3,142,71,0,1401,1404,3,144,
	72,0,1402,1404,3,146,73,0,1403,1397,1,0,0,0,1403,1398,1,0,0,0,1403,1399,
	1,0,0,0,1403,1400,1,0,0,0,1403,1401,1,0,0,0,1403,1402,1,0,0,0,1404,141,
	1,0,0,0,1405,1406,5,9,0,0,1406,1407,5,49,0,0,1407,1408,3,248,124,0,1408,
	1409,5,180,0,0,1409,1410,5,5,0,0,1410,1411,3,248,124,0,1411,1412,5,180,
	0,0,1412,1413,5,93,0,0,1413,1414,5,89,0,0,1414,1415,5,12,0,0,1415,1416,
	5,180,0,0,1416,1417,5,12,0,0,1417,1418,5,34,0,0,1418,1419,5,50,0,0,1419,
	1420,3,110,55,0,1420,143,1,0,0,0,1421,1422,5,9,0,0,1422,1423,5,49,0,0,1423,
	1424,3,248,124,0,1424,1425,5,180,0,0,1425,1426,5,94,0,0,1426,1427,5,89,
	0,0,1427,1428,5,12,0,0,1428,1429,5,180,0,0,1429,1430,5,50,0,0,1430,1431,
	3,110,55,0,1431,145,1,0,0,0,1432,1433,5,9,0,0,1433,1434,5,49,0,0,1434,1435,
	3,248,124,0,1435,1436,5,180,0,0,1436,1437,5,93,0,0,1437,1438,5,89,0,0,1438,
	1439,5,12,0,0,1439,1440,5,180,0,0,1440,1441,5,50,0,0,1441,1442,3,110,55,
	0,1442,147,1,0,0,0,1443,1444,5,9,0,0,1444,1445,5,49,0,0,1445,1446,3,150,
	75,0,1446,1448,3,152,76,0,1447,1449,3,154,77,0,1448,1447,1,0,0,0,1448,1449,
	1,0,0,0,1449,1450,1,0,0,0,1450,1451,5,50,0,0,1451,1452,3,110,55,0,1452,
	149,1,0,0,0,1453,1457,3,248,124,0,1454,1456,3,240,120,0,1455,1454,1,0,0,
	0,1456,1459,1,0,0,0,1457,1455,1,0,0,0,1457,1458,1,0,0,0,1458,1460,1,0,0,
	0,1459,1457,1,0,0,0,1460,1463,5,180,0,0,1461,1462,5,40,0,0,1462,1464,3,
	236,118,0,1463,1461,1,0,0,0,1463,1464,1,0,0,0,1464,1465,1,0,0,0,1465,1466,
	5,2,0,0,1466,1474,1,0,0,0,1467,1468,5,180,0,0,1468,1469,7,10,0,0,1469,1470,
	3,236,118,0,1470,1471,5,2,0,0,1471,1474,1,0,0,0,1472,1474,5,2,0,0,1473,
	1453,1,0,0,0,1473,1467,1,0,0,0,1473,1472,1,0,0,0,1474,151,1,0,0,0,1475,
	1476,3,236,118,0,1476,1477,5,2,0,0,1477,153,1,0,0,0,1478,1479,5,180,0,0,
	1479,1480,7,10,0,0,1480,1486,3,236,118,0,1481,1482,5,180,0,0,1482,1486,
	7,11,0,0,1483,1484,7,11,0,0,1484,1486,5,180,0,0,1485,1478,1,0,0,0,1485,
	1481,1,0,0,0,1485,1483,1,0,0,0,1486,155,1,0,0,0,1487,1488,5,95,0,0,1488,
	1489,3,110,55,0,1489,1490,5,96,0,0,1490,1491,5,49,0,0,1491,1492,3,236,118,
	0,1492,1493,5,50,0,0,1493,1494,5,2,0,0,1494,157,1,0,0,0,1495,1496,5,96,
	0,0,1496,1497,5,49,0,0,1497,1498,3,236,118,0,1498,1499,5,50,0,0,1499,1500,
	3,110,55,0,1500,159,1,0,0,0,1501,1502,5,97,0,0,1502,1503,3,220,110,0,1503,
	1504,5,2,0,0,1504,161,1,0,0,0,1505,1506,5,98,0,0,1506,1507,3,164,82,0,1507,
	163,1,0,0,0,1508,1512,5,4,0,0,1509,1511,3,166,83,0,1510,1509,1,0,0,0,1511,
	1514,1,0,0,0,1512,1510,1,0,0,0,1512,1513,1,0,0,0,1513,1515,1,0,0,0,1514,
	1512,1,0,0,0,1515,1516,5,6,0,0,1516,165,1,0,0,0,1517,1531,3,164,82,0,1518,
	1531,3,168,84,0,1519,1531,3,170,85,0,1520,1531,3,172,86,0,1521,1531,3,174,
	87,0,1522,1531,3,180,90,0,1523,1531,3,182,91,0,1524,1531,5,99,0,0,1525,
	1531,5,100,0,0,1526,1531,5,101,0,0,1527,1531,3,186,93,0,1528,1531,3,190,
	95,0,1529,1531,3,192,96,0,1530,1517,1,0,0,0,1530,1518,1,0,0,0,1530,1519,
	1,0,0,0,1530,1520,1,0,0,0,1530,1521,1,0,0,0,1530,1522,1,0,0,0,1530,1523,
	1,0,0,0,1530,1524,1,0,0,0,1530,1525,1,0,0,0,1530,1526,1,0,0,0,1530,1527,
	1,0,0,0,1530,1528,1,0,0,0,1530,1529,1,0,0,0,1531,167,1,0,0,0,1532,1533,
	5,102,0,0,1533,1538,3,14,7,0,1534,1535,5,5,0,0,1535,1537,3,14,7,0,1536,
	1534,1,0,0,0,1537,1540,1,0,0,0,1538,1536,1,0,0,0,1538,1539,1,0,0,0,1539,
	1543,1,0,0,0,1540,1538,1,0,0,0,1541,1542,5,103,0,0,1542,1544,3,184,92,0,
	1543,1541,1,0,0,0,1543,1544,1,0,0,0,1544,169,1,0,0,0,1545,1550,3,190,95,
	0,1546,1547,5,5,0,0,1547,1549,3,190,95,0,1548,1546,1,0,0,0,1549,1552,1,
	0,0,0,1550,1548,1,0,0,0,1550,1551,1,0,0,0,1551,1553,1,0,0,0,1552,1550,1,
	0,0,0,1553,1554,5,103,0,0,1554,1555,3,184,92,0,1555,171,1,0,0,0,1556,1557,
	5,91,0,0,1557,1558,3,184,92,0,1558,1559,3,164,82,0,1559,173,1,0,0,0,1560,
	1561,5,104,0,0,1561,1571,3,184,92,0,1562,1564,3,176,88,0,1563,1562,1,0,
	0,0,1564,1565,1,0,0,0,1565,1563,1,0,0,0,1565,1566,1,0,0,0,1566,1568,1,0,
	0,0,1567,1569,3,178,89,0,1568,1567,1,0,0,0,1568,1569,1,0,0,0,1569,1572,
	1,0,0,0,1570,1572,3,178,89,0,1571,1563,1,0,0,0,1571,1570,1,0,0,0,1572,175,
	1,0,0,0,1573,1574,5,105,0,0,1574,1575,3,192,96,0,1575,1576,3,164,82,0,1576,
	177,1,0,0,0,1577,1578,5,106,0,0,1578,1579,3,164,82,0,1579,179,1,0,0,0,1580,
	1581,5,9,0,0,1581,1582,3,164,82,0,1582,1583,3,184,92,0,1583,1584,3,164,
	82,0,1584,1585,3,164,82,0,1585,181,1,0,0,0,1586,1587,5,7,0,0,1587,1588,
	5,180,0,0,1588,1597,5,49,0,0,1589,1594,5,180,0,0,1590,1591,5,5,0,0,1591,
	1593,5,180,0,0,1592,1590,1,0,0,0,1593,1596,1,0,0,0,1594,1592,1,0,0,0,1594,
	1595,1,0,0,0,1595,1598,1,0,0,0,1596,1594,1,0,0,0,1597,1589,1,0,0,0,1597,
	1598,1,0,0,0,1598,1599,1,0,0,0,1599,1609,5,50,0,0,1600,1601,5,107,0,0,1601,
	1606,5,180,0,0,1602,1603,5,5,0,0,1603,1605,5,180,0,0,1604,1602,1,0,0,0,
	1605,1608,1,0,0,0,1606,1604,1,0,0,0,1606,1607,1,0,0,0,1607,1610,1,0,0,0,
	1608,1606,1,0,0,0,1609,1600,1,0,0,0,1609,1610,1,0,0,0,1610,1611,1,0,0,0,
	1611,1612,3,164,82,0,1612,183,1,0,0,0,1613,1617,3,186,93,0,1614,1617,3,
	190,95,0,1615,1617,3,192,96,0,1616,1613,1,0,0,0,1616,1614,1,0,0,0,1616,
	1615,1,0,0,0,1617,185,1,0,0,0,1618,1619,3,188,94,0,1619,1628,5,49,0,0,1620,
	1625,3,184,92,0,1621,1622,5,5,0,0,1622,1624,3,184,92,0,1623,1621,1,0,0,
	0,1624,1627,1,0,0,0,1625,1623,1,0,0,0,1625,1626,1,0,0,0,1626,1629,1,0,0,
	0,1627,1625,1,0,0,0,1628,1620,1,0,0,0,1628,1629,1,0,0,0,1629,1630,1,0,0,
	0,1630,1631,5,50,0,0,1631,187,1,0,0,0,1632,1633,7,12,0,0,1633,189,1,0,0,
	0,1634,1640,3,14,7,0,1635,1636,5,12,0,0,1636,1639,3,14,7,0,1637,1639,5,
	164,0,0,1638,1635,1,0,0,0,1638,1637,1,0,0,0,1639,1642,1,0,0,0,1640,1638,
	1,0,0,0,1640,1641,1,0,0,0,1641,191,1,0,0,0,1642,1640,1,0,0,0,1643,1644,
	7,13,0,0,1644,193,1,0,0,0,1645,1646,5,109,0,0,1646,1650,5,4,0,0,1647,1649,
	3,112,56,0,1648,1647,1,0,0,0,1649,1652,1,0,0,0,1650,1648,1,0,0,0,1650,1651,
	1,0,0,0,1651,1653,1,0,0,0,1652,1650,1,0,0,0,1653,1654,5,6,0,0,1654,195,
	1,0,0,0,1655,1656,5,104,0,0,1656,1657,5,49,0,0,1657,1658,3,236,118,0,1658,
	1659,5,50,0,0,1659,1663,5,4,0,0,1660,1662,3,198,99,0,1661,1660,1,0,0,0,
	1662,1665,1,0,0,0,1663,1661,1,0,0,0,1663,1664,1,0,0,0,1664,1667,1,0,0,0,
	1665,1663,1,0,0,0,1666,1668,3,200,100,0,1667,1666,1,0,0,0,1667,1668,1,0,
	0,0,1668,1669,1,0,0,0,1669,1670,5,6,0,0,1670,197,1,0,0,0,1671,1672,5,105,
	0,0,1672,1673,3,236,118,0,1673,1677,5,110,0,0,1674,1676,3,112,56,0,1675,
	1674,1,0,0,0,1676,1679,1,0,0,0,1677,1675,1,0,0,0,1677,1678,1,0,0,0,1678,
	199,1,0,0,0,1679,1677,1,0,0,0,1680,1681,5,106,0,0,1681,1685,5,110,0,0,1682,
	1684,3,112,56,0,1683,1682,1,0,0,0,1684,1687,1,0,0,0,1685,1683,1,0,0,0,1685,
	1686,1,0,0,0,1686,201,1,0,0,0,1687,1685,1,0,0,0,1688,1689,5,111,0,0,1689,
	1691,3,236,118,0,1690,1692,3,204,102,0,1691,1690,1,0,0,0,1691,1692,1,0,
	0,0,1692,1693,1,0,0,0,1693,1695,3,110,55,0,1694,1696,3,206,103,0,1695,1694,
	1,0,0,0,1696,1697,1,0,0,0,1697,1695,1,0,0,0,1697,1698,1,0,0,0,1698,203,
	1,0,0,0,1699,1700,5,73,0,0,1700,1712,5,49,0,0,1701,1706,3,108,54,0,1702,
	1703,5,5,0,0,1703,1705,3,108,54,0,1704,1702,1,0,0,0,1705,1708,1,0,0,0,1706,
	1704,1,0,0,0,1706,1707,1,0,0,0,1707,1710,1,0,0,0,1708,1706,1,0,0,0,1709,
	1711,5,5,0,0,1710,1709,1,0,0,0,1710,1711,1,0,0,0,1711,1713,1,0,0,0,1712,
	1701,1,0,0,0,1712,1713,1,0,0,0,1713,1714,1,0,0,0,1714,1715,5,50,0,0,1715,
	205,1,0,0,0,1716,1718,5,112,0,0,1717,1719,5,180,0,0,1718,1717,1,0,0,0,1718,
	1719,1,0,0,0,1719,1735,1,0,0,0,1720,1732,5,49,0,0,1721,1726,3,108,54,0,
	1722,1723,5,5,0,0,1723,1725,3,108,54,0,1724,1722,1,0,0,0,1725,1728,1,0,
	0,0,1726,1724,1,0,0,0,1726,1727,1,0,0,0,1727,1730,1,0,0,0,1728,1726,1,0,
	0,0,1729,1731,5,5,0,0,1730,1729,1,0,0,0,1730,1731,1,0,0,0,1731,1733,1,0,
	0,0,1732,1721,1,0,0,0,1732,1733,1,0,0,0,1733,1734,1,0,0,0,1734,1736,5,50,
	0,0,1735,1720,1,0,0,0,1735,1736,1,0,0,0,1736,1737,1,0,0,0,1737,1738,3,110,
	55,0,1738,207,1,0,0,0,1739,1740,5,99,0,0,1740,1741,5,2,0,0,1741,209,1,0,
	0,0,1742,1743,5,100,0,0,1743,1744,5,2,0,0,1744,211,1,0,0,0,1745,1749,5,
	151,0,0,1746,1747,5,180,0,0,1747,1749,3,226,113,0,1748,1745,1,0,0,0,1748,
	1746,1,0,0,0,1749,213,1,0,0,0,1750,1751,5,36,0,0,1751,1754,5,180,0,0,1752,
	1753,5,12,0,0,1753,1755,5,180,0,0,1754,1752,1,0,0,0,1754,1755,1,0,0,0,1755,
	1756,1,0,0,0,1756,1757,5,49,0,0,1757,1769,5,4,0,0,1758,1763,3,224,112,0,
	1759,1760,5,5,0,0,1760,1762,3,224,112,0,1761,1759,1,0,0,0,1762,1765,1,0,
	0,0,1763,1761,1,0,0,0,1763,1764,1,0,0,0,1764,1767,1,0,0,0,1765,1763,1,0,
	0,0,1766,1768,5,5,0,0,1767,1766,1,0,0,0,1767,1768,1,0,0,0,1768,1770,1,0,
	0,0,1769,1758,1,0,0,0,1769,1770,1,0,0,0,1770,1771,1,0,0,0,1771,1772,5,6,
	0,0,1772,1773,5,50,0,0,1773,1793,5,2,0,0,1774,1775,5,36,0,0,1775,1778,5,
	180,0,0,1776,1777,5,12,0,0,1777,1779,5,180,0,0,1778,1776,1,0,0,0,1778,1779,
	1,0,0,0,1779,1780,1,0,0,0,1780,1781,3,226,113,0,1781,1782,5,2,0,0,1782,
	1793,1,0,0,0,1783,1784,5,36,0,0,1784,1785,5,49,0,0,1785,1786,5,151,0,0,
	1786,1787,5,50,0,0,1787,1793,5,2,0,0,1788,1789,5,36,0,0,1789,1790,5,49,
	0,0,1790,1791,5,50,0,0,1791,1793,5,2,0,0,1792,1750,1,0,0,0,1792,1774,1,
	0,0,0,1792,1783,1,0,0,0,1792,1788,1,0,0,0,1793,215,1,0,0,0,1794,1795,5,
	113,0,0,1795,1796,5,49,0,0,1796,1797,3,236,118,0,1797,1798,5,50,0,0,1798,
	1799,5,2,0,0,1799,217,1,0,0,0,1800,1803,5,180,0,0,1801,1803,3,242,121,0,
	1802,1800,1,0,0,0,1802,1801,1,0,0,0,1803,219,1,0,0,0,1804,1816,5,49,0,0,
	1805,1810,3,218,109,0,1806,1807,5,5,0,0,1807,1809,3,218,109,0,1808,1806,
	1,0,0,0,1809,1812,1,0,0,0,1810,1808,1,0,0,0,1810,1811,1,0,0,0,1811,1814,
	1,0,0,0,1812,1810,1,0,0,0,1813,1815,5,5,0,0,1814,1813,1,0,0,0,1814,1815,
	1,0,0,0,1815,1817,1,0,0,0,1816,1805,1,0,0,0,1816,1817,1,0,0,0,1817,1818,
	1,0,0,0,1818,1819,5,50,0,0,1819,221,1,0,0,0,1820,1821,5,180,0,0,1821,1845,
	3,226,113,0,1822,1823,5,180,0,0,1823,1824,5,12,0,0,1824,1825,5,180,0,0,
	1825,1845,3,226,113,0,1826,1827,5,180,0,0,1827,1828,5,49,0,0,1828,1840,
	5,4,0,0,1829,1834,3,224,112,0,1830,1831,5,5,0,0,1831,1833,3,224,112,0,1832,
	1830,1,0,0,0,1833,1836,1,0,0,0,1834,1832,1,0,0,0,1834,1835,1,0,0,0,1835,
	1838,1,0,0,0,1836,1834,1,0,0,0,1837,1839,5,5,0,0,1838,1837,1,0,0,0,1838,
	1839,1,0,0,0,1839,1841,1,0,0,0,1840,1829,1,0,0,0,1840,1841,1,0,0,0,1841,
	1842,1,0,0,0,1842,1843,5,6,0,0,1843,1845,5,50,0,0,1844,1820,1,0,0,0,1844,
	1822,1,0,0,0,1844,1826,1,0,0,0,1845,223,1,0,0,0,1846,1847,5,180,0,0,1847,
	1848,5,110,0,0,1848,1849,3,236,118,0,1849,225,1,0,0,0,1850,1862,5,49,0,
	0,1851,1856,3,236,118,0,1852,1853,5,5,0,0,1853,1855,3,236,118,0,1854,1852,
	1,0,0,0,1855,1858,1,0,0,0,1856,1854,1,0,0,0,1856,1857,1,0,0,0,1857,1860,
	1,0,0,0,1858,1856,1,0,0,0,1859,1861,5,5,0,0,1860,1859,1,0,0,0,1860,1861,
	1,0,0,0,1861,1863,1,0,0,0,1862,1851,1,0,0,0,1862,1863,1,0,0,0,1863,1864,
	1,0,0,0,1864,1865,5,50,0,0,1865,227,1,0,0,0,1866,1867,5,4,0,0,1867,1872,
	3,230,115,0,1868,1869,5,5,0,0,1869,1871,3,230,115,0,1870,1868,1,0,0,0,1871,
	1874,1,0,0,0,1872,1870,1,0,0,0,1872,1873,1,0,0,0,1873,1876,1,0,0,0,1874,
	1872,1,0,0,0,1875,1877,5,5,0,0,1876,1875,1,0,0,0,1876,1877,1,0,0,0,1877,
	1878,1,0,0,0,1878,1879,5,6,0,0,1879,229,1,0,0,0,1880,1881,5,180,0,0,1881,
	1882,5,110,0,0,1882,1883,3,236,118,0,1883,231,1,0,0,0,1884,1885,5,49,0,
	0,1885,1890,3,234,117,0,1886,1887,5,5,0,0,1887,1889,3,234,117,0,1888,1886,
	1,0,0,0,1889,1892,1,0,0,0,1890,1888,1,0,0,0,1890,1891,1,0,0,0,1891,1894,
	1,0,0,0,1892,1890,1,0,0,0,1893,1895,5,5,0,0,1894,1893,1,0,0,0,1894,1895,
	1,0,0,0,1895,1896,1,0,0,0,1896,1897,5,50,0,0,1897,233,1,0,0,0,1898,1901,
	3,248,124,0,1899,1901,3,84,42,0,1900,1898,1,0,0,0,1900,1899,1,0,0,0,1901,
	235,1,0,0,0,1902,1903,6,118,-1,0,1903,1904,5,49,0,0,1904,1905,5,180,0,0,
	1905,1906,7,10,0,0,1906,1907,3,236,118,0,1907,1908,5,50,0,0,1908,2065,1,
	0,0,0,1909,1910,5,49,0,0,1910,1911,5,114,0,0,1911,1912,5,180,0,0,1912,1913,
	5,50,0,0,1913,1914,3,228,114,0,1914,1915,3,226,113,0,1915,2065,1,0,0,0,
	1916,1917,5,49,0,0,1917,1918,3,236,118,0,1918,1919,5,50,0,0,1919,2065,1,
	0,0,0,1920,1921,5,49,0,0,1921,1924,3,236,118,0,1922,1923,5,5,0,0,1923,1925,
	3,236,118,0,1924,1922,1,0,0,0,1925,1926,1,0,0,0,1926,1924,1,0,0,0,1926,
	1927,1,0,0,0,1927,1928,1,0,0,0,1928,1929,5,50,0,0,1929,2065,1,0,0,0,1930,
	1931,3,250,125,0,1931,1932,5,49,0,0,1932,1934,3,236,118,0,1933,1935,5,5,
	0,0,1934,1933,1,0,0,0,1934,1935,1,0,0,0,1935,1936,1,0,0,0,1936,1937,5,50,
	0,0,1937,2065,1,0,0,0,1938,2065,3,222,111,0,1939,1940,5,114,0,0,1940,1942,
	5,180,0,0,1941,1943,3,228,114,0,1942,1941,1,0,0,0,1942,1943,1,0,0,0,1943,
	1944,1,0,0,0,1944,2065,3,226,113,0,1945,1946,5,114,0,0,1946,1949,3,248,
	124,0,1947,1948,5,66,0,0,1948,1950,5,67,0,0,1949,1947,1,0,0,0,1950,1951,
	1,0,0,0,1951,1949,1,0,0,0,1951,1952,1,0,0,0,1952,1953,1,0,0,0,1953,1954,
	5,49,0,0,1954,1955,3,236,118,0,1955,1956,5,50,0,0,1956,2065,1,0,0,0,1957,
	1958,5,114,0,0,1958,1959,5,148,0,0,1959,1960,5,49,0,0,1960,1961,3,236,118,
	0,1961,1962,5,50,0,0,1962,2065,1,0,0,0,1963,1964,5,55,0,0,1964,1965,5,49,
	0,0,1965,1966,3,248,124,0,1966,1967,5,50,0,0,1967,1968,5,12,0,0,1968,1969,
	5,180,0,0,1969,2065,1,0,0,0,1970,1971,5,115,0,0,1971,2065,3,226,113,0,1972,
	1973,5,116,0,0,1973,2065,3,226,113,0,1974,1975,5,117,0,0,1975,2065,3,226,
	113,0,1976,1977,5,118,0,0,1977,2065,3,226,113,0,1978,1979,5,119,0,0,1979,
	1980,5,49,0,0,1980,1981,5,180,0,0,1981,1982,5,12,0,0,1982,1983,5,180,0,
	0,1983,1984,5,5,0,0,1984,1985,3,226,113,0,1985,1986,5,50,0,0,1986,2065,
	1,0,0,0,1987,1988,5,120,0,0,1988,2065,3,226,113,0,1989,1990,5,121,0,0,1990,
	2065,3,226,113,0,1991,1992,5,122,0,0,1992,1993,5,49,0,0,1993,1994,3,236,
	118,0,1994,1995,5,5,0,0,1995,1996,3,232,116,0,1996,1997,5,50,0,0,1997,2065,
	1,0,0,0,1998,1999,5,123,0,0,1999,2000,5,49,0,0,2000,2001,3,236,118,0,2001,
	2002,5,5,0,0,2002,2003,3,232,116,0,2003,2004,5,5,0,0,2004,2005,5,145,0,
	0,2005,2006,5,50,0,0,2006,2065,1,0,0,0,2007,2008,5,124,0,0,2008,2009,5,
	66,0,0,2009,2010,3,236,118,0,2010,2011,5,67,0,0,2011,2012,7,14,0,0,2012,
	2065,1,0,0,0,2013,2014,5,125,0,0,2014,2015,5,66,0,0,2015,2016,3,236,118,
	0,2016,2017,5,67,0,0,2017,2018,7,15,0,0,2018,2065,1,0,0,0,2019,2020,7,16,
	0,0,2020,2065,3,236,118,21,2021,2033,5,66,0,0,2022,2027,3,236,118,0,2023,
	2024,5,5,0,0,2024,2026,3,236,118,0,2025,2023,1,0,0,0,2026,2029,1,0,0,0,
	2027,2025,1,0,0,0,2027,2028,1,0,0,0,2028,2031,1,0,0,0,2029,2027,1,0,0,0,
	2030,2032,5,5,0,0,2031,2030,1,0,0,0,2031,2032,1,0,0,0,2032,2034,1,0,0,0,
	2033,2022,1,0,0,0,2033,2034,1,0,0,0,2034,2035,1,0,0,0,2035,2065,5,67,0,
	0,2036,2037,5,89,0,0,2037,2038,5,12,0,0,2038,2039,5,180,0,0,2039,2040,5,
	12,0,0,2040,2041,5,180,0,0,2041,2042,5,66,0,0,2042,2043,3,236,118,0,2043,
	2044,5,67,0,0,2044,2045,3,238,119,0,2045,2065,1,0,0,0,2046,2047,5,89,0,
	0,2047,2048,5,12,0,0,2048,2053,5,180,0,0,2049,2050,5,66,0,0,2050,2051,3,
	236,118,0,2051,2052,5,67,0,0,2052,2054,1,0,0,0,2053,2049,1,0,0,0,2054,2055,
	1,0,0,0,2055,2053,1,0,0,0,2055,2056,1,0,0,0,2056,2065,1,0,0,0,2057,2058,
	5,89,0,0,2058,2059,5,12,0,0,2059,2065,5,180,0,0,2060,2065,5,89,0,0,2061,
	2065,5,160,0,0,2062,2065,3,14,7,0,2063,2065,3,242,121,0,2064,1902,1,0,0,
	0,2064,1909,1,0,0,0,2064,1916,1,0,0,0,2064,1920,1,0,0,0,2064,1930,1,0,0,
	0,2064,1938,1,0,0,0,2064,1939,1,0,0,0,2064,1945,1,0,0,0,2064,1957,1,0,0,
	0,2064,1963,1,0,0,0,2064,1970,1,0,0,0,2064,1972,1,0,0,0,2064,1974,1,0,0,
	0,2064,1976,1,0,0,0,2064,1978,1,0,0,0,2064,1987,1,0,0,0,2064,1989,1,0,0,
	0,2064,1991,1,0,0,0,2064,1998,1,0,0,0,2064,2007,1,0,0,0,2064,2013,1,0,0,
	0,2064,2019,1,0,0,0,2064,2021,1,0,0,0,2064,2036,1,0,0,0,2064,2046,1,0,0,
	0,2064,2057,1,0,0,0,2064,2060,1,0,0,0,2064,2061,1,0,0,0,2064,2062,1,0,0,
	0,2064,2063,1,0,0,0,2065,2173,1,0,0,0,2066,2067,10,20,0,0,2067,2068,5,17,
	0,0,2068,2172,3,236,118,20,2069,2070,10,19,0,0,2070,2071,7,17,0,0,2071,
	2172,3,236,118,20,2072,2073,10,18,0,0,2073,2074,7,18,0,0,2074,2172,3,236,
	118,19,2075,2076,10,17,0,0,2076,2077,7,19,0,0,2077,2172,3,236,118,18,2078,
	2079,10,16,0,0,2079,2080,7,20,0,0,2080,2172,3,236,118,17,2081,2082,10,15,
	0,0,2082,2083,7,21,0,0,2083,2172,3,236,118,16,2084,2085,10,14,0,0,2085,
	2086,5,24,0,0,2086,2172,3,236,118,15,2087,2088,10,13,0,0,2088,2089,5,26,
	0,0,2089,2172,3,236,118,14,2090,2091,10,12,0,0,2091,2092,5,25,0,0,2092,
	2172,3,236,118,13,2093,2094,10,11,0,0,2094,2095,5,130,0,0,2095,2172,3,236,
	118,12,2096,2097,10,10,0,0,2097,2098,5,131,0,0,2098,2172,3,236,118,11,2099,
	2100,10,9,0,0,2100,2101,5,132,0,0,2101,2102,3,236,118,0,2102,2103,5,110,
	0,0,2103,2104,3,236,118,9,2104,2172,1,0,0,0,2105,2106,10,33,0,0,2106,2107,
	5,66,0,0,2107,2108,3,236,118,0,2108,2109,5,110,0,0,2109,2110,3,236,118,
	0,2110,2111,5,67,0,0,2111,2172,1,0,0,0,2112,2113,10,32,0,0,2113,2114,5,
	66,0,0,2114,2115,5,145,0,0,2115,2172,5,67,0,0,2116,2117,10,31,0,0,2117,
	2118,5,66,0,0,2118,2119,3,236,118,0,2119,2120,5,67,0,0,2120,2172,1,0,0,
	0,2121,2122,10,28,0,0,2122,2172,7,22,0,0,2123,2124,10,27,0,0,2124,2125,
	5,167,0,0,2125,2126,5,49,0,0,2126,2127,3,236,118,0,2127,2128,5,50,0,0,2128,
	2172,1,0,0,0,2129,2130,10,26,0,0,2130,2131,5,168,0,0,2131,2132,5,49,0,0,
	2132,2133,3,236,118,0,2133,2134,5,5,0,0,2134,2135,3,236,118,0,2135,2136,
	5,50,0,0,2136,2172,1,0,0,0,2137,2138,10,25,0,0,2138,2139,5,12,0,0,2139,
	2141,5,180,0,0,2140,2142,3,228,114,0,2141,2140,1,0,0,0,2141,2142,1,0,0,
	0,2142,2143,1,0,0,0,2143,2144,5,49,0,0,2144,2156,5,4,0,0,2145,2150,3,224,
	112,0,2146,2147,5,5,0,0,2147,2149,3,224,112,0,2148,2146,1,0,0,0,2149,2152,
	1,0,0,0,2150,2148,1,0,0,0,2150,2151,1,0,0,0,2151,2154,1,0,0,0,2152,2150,
	1,0,0,0,2153,2155,5,5,0,0,2154,2153,1,0,0,0,2154,2155,1,0,0,0,2155,2157,
	1,0,0,0,2156,2145,1,0,0,0,2156,2157,1,0,0,0,2157,2158,1,0,0,0,2158,2159,
	5,6,0,0,2159,2172,5,50,0,0,2160,2161,10,24,0,0,2161,2162,5,12,0,0,2162,
	2164,5,180,0,0,2163,2165,3,228,114,0,2164,2163,1,0,0,0,2164,2165,1,0,0,
	0,2165,2166,1,0,0,0,2166,2172,3,226,113,0,2167,2168,10,23,0,0,2168,2172,
	3,238,119,0,2169,2170,10,22,0,0,2170,2172,7,11,0,0,2171,2066,1,0,0,0,2171,
	2069,1,0,0,0,2171,2072,1,0,0,0,2171,2075,1,0,0,0,2171,2078,1,0,0,0,2171,
	2081,1,0,0,0,2171,2084,1,0,0,0,2171,2087,1,0,0,0,2171,2090,1,0,0,0,2171,
	2093,1,0,0,0,2171,2096,1,0,0,0,2171,2099,1,0,0,0,2171,2105,1,0,0,0,2171,
	2112,1,0,0,0,2171,2116,1,0,0,0,2171,2121,1,0,0,0,2171,2123,1,0,0,0,2171,
	2129,1,0,0,0,2171,2137,1,0,0,0,2171,2160,1,0,0,0,2171,2167,1,0,0,0,2171,
	2169,1,0,0,0,2172,2175,1,0,0,0,2173,2171,1,0,0,0,2173,2174,1,0,0,0,2174,
	237,1,0,0,0,2175,2173,1,0,0,0,2176,2177,5,12,0,0,2177,2190,5,180,0,0,2178,
	2190,5,163,0,0,2179,2190,5,172,0,0,2180,2190,5,173,0,0,2181,2190,5,174,
	0,0,2182,2190,5,175,0,0,2183,2190,5,176,0,0,2184,2190,5,177,0,0,2185,2190,
	5,178,0,0,2186,2190,5,179,0,0,2187,2190,5,170,0,0,2188,2190,5,171,0,0,2189,
	2176,1,0,0,0,2189,2178,1,0,0,0,2189,2179,1,0,0,0,2189,2180,1,0,0,0,2189,
	2181,1,0,0,0,2189,2182,1,0,0,0,2189,2183,1,0,0,0,2189,2184,1,0,0,0,2189,
	2185,1,0,0,0,2189,2186,1,0,0,0,2189,2187,1,0,0,0,2189,2188,1,0,0,0,2190,
	239,1,0,0,0,2191,2192,7,23,0,0,2192,241,1,0,0,0,2193,2208,5,141,0,0,2194,
	2208,3,244,122,0,2195,2208,3,246,123,0,2196,2200,5,151,0,0,2197,2199,5,
	151,0,0,2198,2197,1,0,0,0,2199,2202,1,0,0,0,2200,2198,1,0,0,0,2200,2201,
	1,0,0,0,2201,2208,1,0,0,0,2202,2200,1,0,0,0,2203,2208,5,161,0,0,2204,2208,
	5,162,0,0,2205,2208,5,152,0,0,2206,2208,5,153,0,0,2207,2193,1,0,0,0,2207,
	2194,1,0,0,0,2207,2195,1,0,0,0,2207,2196,1,0,0,0,2207,2203,1,0,0,0,2207,
	2204,1,0,0,0,2207,2205,1,0,0,0,2207,2206,1,0,0,0,2208,243,1,0,0,0,2209,
	2211,5,145,0,0,2210,2212,7,24,0,0,2211,2210,1,0,0,0,2211,2212,1,0,0,0,2212,
	245,1,0,0,0,2213,2215,5,144,0,0,2214,2216,7,24,0,0,2215,2214,1,0,0,0,2215,
	2216,1,0,0,0,2216,247,1,0,0,0,2217,2218,5,108,0,0,2218,2268,5,59,0,0,2219,
	2268,5,108,0,0,2220,2268,5,146,0,0,2221,2268,5,147,0,0,2222,2268,5,149,
	0,0,2223,2268,5,148,0,0,2224,2268,5,156,0,0,2225,2268,5,157,0,0,2226,2268,
	5,138,0,0,2227,2268,5,139,0,0,2228,2268,5,158,0,0,2229,2268,5,159,0,0,2230,
	2231,5,7,0,0,2231,2240,5,49,0,0,2232,2237,3,248,124,0,2233,2234,5,5,0,0,
	2234,2236,3,248,124,0,2235,2233,1,0,0,0,2236,2239,1,0,0,0,2237,2235,1,0,
	0,0,2237,2238,1,0,0,0,2238,2241,1,0,0,0,2239,2237,1,0,0,0,2240,2232,1,0,
	0,0,2240,2241,1,0,0,0,2241,2242,1,0,0,0,2242,2246,5,50,0,0,2243,2245,7,
	25,0,0,2244,2243,1,0,0,0,2245,2248,1,0,0,0,2246,2244,1,0,0,0,2246,2247,
	1,0,0,0,2247,2261,1,0,0,0,2248,2246,1,0,0,0,2249,2250,5,73,0,0,2250,2251,
	5,49,0,0,2251,2256,3,248,124,0,2252,2253,5,5,0,0,2253,2255,3,248,124,0,
	2254,2252,1,0,0,0,2255,2258,1,0,0,0,2256,2254,1,0,0,0,2256,2257,1,0,0,0,
	2257,2259,1,0,0,0,2258,2256,1,0,0,0,2259,2260,5,50,0,0,2260,2262,1,0,0,
	0,2261,2249,1,0,0,0,2261,2262,1,0,0,0,2262,2268,1,0,0,0,2263,2264,5,180,
	0,0,2264,2265,5,12,0,0,2265,2268,5,180,0,0,2266,2268,5,180,0,0,2267,2217,
	1,0,0,0,2267,2219,1,0,0,0,2267,2220,1,0,0,0,2267,2221,1,0,0,0,2267,2222,
	1,0,0,0,2267,2223,1,0,0,0,2267,2224,1,0,0,0,2267,2225,1,0,0,0,2267,2226,
	1,0,0,0,2267,2227,1,0,0,0,2267,2228,1,0,0,0,2267,2229,1,0,0,0,2267,2230,
	1,0,0,0,2267,2263,1,0,0,0,2267,2266,1,0,0,0,2268,249,1,0,0,0,2269,2270,
	7,26,0,0,2270,251,1,0,0,0,251,255,261,274,276,296,300,307,312,320,324,330,
	341,344,354,358,365,368,372,377,381,397,401,408,411,414,428,431,442,444,
	459,474,478,494,496,502,507,515,518,535,537,544,551,553,557,569,573,575,
	579,585,588,591,601,605,607,614,622,629,642,646,653,673,679,686,697,703,
	707,713,721,729,736,743,750,757,763,768,770,776,783,785,791,793,799,804,
	810,817,823,829,833,838,846,851,859,869,874,878,890,899,901,907,913,920,
	930,932,936,942,949,965,974,978,984,993,997,1005,1009,1015,1019,1021,1029,
	1033,1035,1043,1047,1053,1057,1063,1067,1069,1075,1080,1104,1117,1128,1144,
	1156,1160,1165,1177,1186,1190,1192,1201,1206,1212,1218,1226,1232,1236,1246,
	1258,1268,1279,1286,1292,1299,1321,1333,1343,1351,1361,1364,1373,1383,1395,
	1403,1448,1457,1463,1473,1485,1512,1530,1538,1543,1550,1565,1568,1571,1594,
	1597,1606,1609,1616,1625,1628,1638,1640,1650,1663,1667,1677,1685,1691,1697,
	1706,1710,1712,1718,1726,1730,1732,1735,1748,1754,1763,1767,1769,1778,1792,
	1802,1810,1814,1816,1834,1838,1840,1844,1856,1860,1862,1872,1876,1890,1894,
	1900,1926,1934,1942,1951,2027,2031,2033,2055,2064,2141,2150,2154,2156,2164,
	2171,2173,2189,2200,2207,2211,2215,2237,2240,2246,2256,2261,2267];

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
