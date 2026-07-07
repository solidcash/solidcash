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
	public static readonly RULE_blockStatement = 56;
	public static readonly RULE_statement = 57;
	public static readonly RULE_expressionStatement = 58;
	public static readonly RULE_prefixIncDecStatement = 59;
	public static readonly RULE_returnStatement = 60;
	public static readonly RULE_selfdestructStatement = 61;
	public static readonly RULE_emitStatement = 62;
	public static readonly RULE_variableDefinition = 63;
	public static readonly RULE_tupleAssignment = 64;
	public static readonly RULE_tupleSlot = 65;
	public static readonly RULE_pushArgument = 66;
	public static readonly RULE_deleteStatement = 67;
	public static readonly RULE_timeOpStatement = 68;
	public static readonly RULE_requireStatement = 69;
	public static readonly RULE_ifStatement = 70;
	public static readonly RULE_loopStatement = 71;
	public static readonly RULE_forOfEntriesStatement = 72;
	public static readonly RULE_forInStatement = 73;
	public static readonly RULE_forOfStatement = 74;
	public static readonly RULE_forStatement = 75;
	public static readonly RULE_forInit = 76;
	public static readonly RULE_forCondition = 77;
	public static readonly RULE_forUpdate = 78;
	public static readonly RULE_doWhileStatement = 79;
	public static readonly RULE_whileStatement = 80;
	public static readonly RULE_consoleStatement = 81;
	public static readonly RULE_assemblyStatement = 82;
	public static readonly RULE_yulBlock = 83;
	public static readonly RULE_yulStatement = 84;
	public static readonly RULE_yulVariableDeclaration = 85;
	public static readonly RULE_yulAssignment = 86;
	public static readonly RULE_yulIf = 87;
	public static readonly RULE_yulSwitch = 88;
	public static readonly RULE_yulCase = 89;
	public static readonly RULE_yulDefault = 90;
	public static readonly RULE_yulForLoop = 91;
	public static readonly RULE_yulFunctionDefinition = 92;
	public static readonly RULE_yulExpression = 93;
	public static readonly RULE_yulFunctionCall = 94;
	public static readonly RULE_yulFunctionName = 95;
	public static readonly RULE_yulPath = 96;
	public static readonly RULE_yulLiteral = 97;
	public static readonly RULE_uncheckedStatement = 98;
	public static readonly RULE_switchStatement = 99;
	public static readonly RULE_switchCase = 100;
	public static readonly RULE_switchDefault = 101;
	public static readonly RULE_tryCatchStatement = 102;
	public static readonly RULE_tryReturns = 103;
	public static readonly RULE_catchClause = 104;
	public static readonly RULE_breakStatement = 105;
	public static readonly RULE_continueStatement = 106;
	public static readonly RULE_requireMessage = 107;
	public static readonly RULE_revertStatement = 108;
	public static readonly RULE_assertStatement = 109;
	public static readonly RULE_consoleParameter = 110;
	public static readonly RULE_consoleParameterList = 111;
	public static readonly RULE_functionCall = 112;
	public static readonly RULE_namedArg = 113;
	public static readonly RULE_expressionList = 114;
	public static readonly RULE_callOptions = 115;
	public static readonly RULE_callOption = 116;
	public static readonly RULE_typeList = 117;
	public static readonly RULE_typeListItem = 118;
	public static readonly RULE_expression = 119;
	public static readonly RULE_memberName = 120;
	public static readonly RULE_modifier = 121;
	public static readonly RULE_literal = 122;
	public static readonly RULE_numberLiteral = 123;
	public static readonly RULE_decimalLiteral = 124;
	public static readonly RULE_typeName = 125;
	public static readonly RULE_typeCast = 126;
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
		"returnType", "returnParam", "parameterList", "parameter", "block", "blockStatement", 
		"statement", "expressionStatement", "prefixIncDecStatement", "returnStatement", 
		"selfdestructStatement", "emitStatement", "variableDefinition", "tupleAssignment", 
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
			this.state = 257;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===37) {
				{
				{
				this.state = 254;
				this.pragmaDirective();
				}
				}
				this.state = 259;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 263;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===1) {
				{
				{
				this.state = 260;
				this.importDirective();
				}
				}
				this.state = 265;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 279;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1850433) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 277;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 2, this._ctx) ) {
				case 1:
					{
					this.state = 266;
					this.constantDefinition();
					}
					break;
				case 2:
					{
					this.state = 267;
					this.enumDefinition();
					}
					break;
				case 3:
					{
					this.state = 268;
					this.structDefinition();
					}
					break;
				case 4:
					{
					this.state = 269;
					this.typeDefinition();
					}
					break;
				case 5:
					{
					this.state = 270;
					this.usingForDirective();
					}
					break;
				case 6:
					{
					this.state = 271;
					this.errorDefinition();
					}
					break;
				case 7:
					{
					this.state = 272;
					this.eventDefinition();
					}
					break;
				case 8:
					{
					this.state = 273;
					this.interfaceDefinition();
					}
					break;
				case 9:
					{
					this.state = 274;
					this.freeFunctionDefinition();
					}
					break;
				case 10:
					{
					this.state = 275;
					this.libraryDefinition();
					}
					break;
				case 11:
					{
					this.state = 276;
					this.contractDefinition();
					}
					break;
				}
				}
				this.state = 281;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 282;
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
			this.state = 310;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 6, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 284;
				this.match(SolidCashParser.T__0);
				this.state = 285;
				this.match(SolidCashParser.StringLiteral);
				this.state = 286;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 287;
				this.match(SolidCashParser.T__0);
				this.state = 288;
				this.match(SolidCashParser.StringLiteral);
				this.state = 289;
				this.match(SolidCashParser.T__2);
				this.state = 290;
				this.match(SolidCashParser.Identifier);
				this.state = 291;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 292;
				this.match(SolidCashParser.T__0);
				this.state = 293;
				this.match(SolidCashParser.T__3);
				this.state = 294;
				this.importBinding();
				this.state = 299;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 295;
						this.match(SolidCashParser.T__4);
						this.state = 296;
						this.importBinding();
						}
						}
					}
					this.state = 301;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				}
				this.state = 303;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 302;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 305;
				this.match(SolidCashParser.T__5);
				this.state = 306;
				this.match(SolidCashParser.Identifier);
				this.state = 307;
				this.match(SolidCashParser.StringLiteral);
				this.state = 308;
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
			this.state = 312;
			this.match(SolidCashParser.Identifier);
			this.state = 315;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 313;
				this.match(SolidCashParser.T__2);
				this.state = 314;
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
			this.state = 317;
			this.match(SolidCashParser.T__6);
			this.state = 318;
			this.anyIdentifier();
			this.state = 319;
			this.parameterList();
			this.state = 323;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 320;
				this.functionModifier();
				}
				}
				this.state = 325;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 327;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 326;
				this.returnType();
				}
			}

			this.state = 329;
			this.match(SolidCashParser.T__3);
			this.state = 333;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 330;
				this.statement();
				}
				}
				this.state = 335;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 336;
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
			this.state = 377;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 17, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 338;
				this.match(SolidCashParser.T__7);
				this.state = 339;
				this.match(SolidCashParser.Identifier);
				this.state = 340;
				this.match(SolidCashParser.T__8);
				this.state = 345;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 11, this._ctx) ) {
				case 1:
					{
					this.state = 341;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 342;
					this.mappingType();
					}
					break;
				case 3:
					{
					this.state = 343;
					this.typeName();
					}
					break;
				case 4:
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
				this.state = 370;
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
					this.mappingType();
					}
					break;
				case 3:
					{
					this.state = 368;
					this.typeName();
					}
					break;
				case 4:
					{
					this.state = 369;
					this.match(SolidCashParser.T__9);
					}
					break;
				}
				this.state = 373;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 372;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 375;
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
			this.state = 379;
			this.match(SolidCashParser.Identifier);
			this.state = 382;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===12) {
				{
				this.state = 380;
				this.match(SolidCashParser.T__11);
				this.state = 381;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 386;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 384;
				this.match(SolidCashParser.T__2);
				this.state = 385;
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
			this.state = 388;
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
			this.state = 390;
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
			this.state = 406;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 21, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 392;
				this.match(SolidCashParser.T__36);
				this.state = 393;
				this.pragmaName();
				this.state = 394;
				this.pragmaValue();
				this.state = 395;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 397;
				this.match(SolidCashParser.T__36);
				this.state = 398;
				this.match(SolidCashParser.Identifier);
				this.state = 402;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===38 || ((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 2081) !== 0) || _la===180) {
					{
					{
					this.state = 399;
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
					this.state = 404;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 405;
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
			this.state = 408;
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
			this.state = 416;
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
				this.state = 411;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 410;
					this.versionConstraint();
					}
					}
					this.state = 413;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0) || _la===140 || _la===144);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 415;
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
			this.state = 419;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0)) {
				{
				this.state = 418;
				this.versionOperator();
				}
			}

			this.state = 421;
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
			this.state = 423;
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
			this.state = 425;
			this.match(SolidCashParser.T__40);
			this.state = 426;
			this.match(SolidCashParser.Identifier);
			this.state = 436;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 427;
				this.match(SolidCashParser.T__41);
				this.state = 428;
				this.match(SolidCashParser.Identifier);
				this.state = 433;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 429;
					this.match(SolidCashParser.T__4);
					this.state = 430;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 435;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 438;
			this.match(SolidCashParser.T__3);
			this.state = 449;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1843969) !== 0)) {
				{
				this.state = 447;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 27, this._ctx) ) {
				case 1:
					{
					this.state = 439;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 440;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 441;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 442;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 443;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 444;
					this.interfaceStateVariable();
					}
					break;
				case 7:
					{
					this.state = 445;
					this.interfaceCollection();
					}
					break;
				case 8:
					{
					this.state = 446;
					this.interfaceFunction();
					}
					break;
				}
				}
				this.state = 451;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 452;
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
			this.state = 464;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 29, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 454;
				this.interfaceStateVariableVisibility();
				this.state = 455;
				this.mappingType();
				this.state = 456;
				this.match(SolidCashParser.Identifier);
				this.state = 457;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 459;
				this.interfaceStateVariableVisibility();
				this.state = 460;
				this.arrayType(0);
				this.state = 461;
				this.match(SolidCashParser.Identifier);
				this.state = 462;
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
			this.state = 466;
			this.interfaceStateVariableVisibility();
			this.state = 467;
			this.typeName();
			this.state = 468;
			this.match(SolidCashParser.Identifier);
			this.state = 469;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 471;
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
			this.state = 473;
			this.match(SolidCashParser.T__6);
			this.state = 474;
			this.match(SolidCashParser.Identifier);
			this.state = 475;
			this.parameterList();
			this.state = 479;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 476;
				this.functionModifier();
				}
				}
				this.state = 481;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 483;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 482;
				this.returnType();
				}
			}

			this.state = 485;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 487;
			this.match(SolidCashParser.T__44);
			this.state = 488;
			this.match(SolidCashParser.Identifier);
			this.state = 489;
			this.match(SolidCashParser.T__3);
			this.state = 501;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 815538945) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 499;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 32, this._ctx) ) {
				case 1:
					{
					this.state = 490;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 491;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 492;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 493;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 494;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 495;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 496;
					this.stateVariableDeclaration();
					}
					break;
				case 8:
					{
					this.state = 497;
					this.usingForDirective();
					}
					break;
				case 9:
					{
					this.state = 498;
					this.freeFunctionDefinition();
					}
					break;
				}
				}
				this.state = 503;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 504;
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
			this.state = 507;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===46) {
				{
				this.state = 506;
				this.match(SolidCashParser.T__45);
				}
			}

			this.state = 509;
			this.match(SolidCashParser.T__46);
			this.state = 510;
			this.match(SolidCashParser.Identifier);
			this.state = 512;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 511;
				this.parameterList();
				}
			}

			this.state = 523;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 514;
				this.match(SolidCashParser.T__41);
				this.state = 515;
				this.inheritanceSpecifier();
				this.state = 520;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 516;
					this.match(SolidCashParser.T__4);
					this.state = 517;
					this.inheritanceSpecifier();
					}
					}
					this.state = 522;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 525;
			this.match(SolidCashParser.T__3);
			this.state = 542;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 268435459) !== 0) || ((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 37411875) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 540;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 38, this._ctx) ) {
				case 1:
					{
					this.state = 526;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 527;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 528;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 529;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 530;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 531;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 532;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 533;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 534;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 535;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 536;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 537;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 538;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 539;
					this.receiveDefinition();
					}
					break;
				}
				}
				this.state = 544;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 545;
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
			this.state = 547;
			this.match(SolidCashParser.Identifier);
			this.state = 549;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 548;
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
			this.state = 551;
			this.match(SolidCashParser.T__6);
			this.state = 552;
			this.anyIdentifier();
			this.state = 553;
			this.parameterList();
			this.state = 558;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0) || _la===180) {
				{
				this.state = 556;
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
					this.state = 554;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 555;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 560;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 562;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 561;
				this.returnType();
				}
			}

			this.state = 564;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 566;
			this.match(SolidCashParser.T__47);
			this.state = 567;
			this.match(SolidCashParser.Identifier);
			this.state = 568;
			this.match(SolidCashParser.T__48);
			this.state = 580;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 569;
				this.eventParameter();
				this.state = 574;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 44, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 570;
						this.match(SolidCashParser.T__4);
						this.state = 571;
						this.eventParameter();
						}
						}
					}
					this.state = 576;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 44, this._ctx);
				}
				this.state = 578;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 577;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 582;
			this.match(SolidCashParser.T__49);
			this.state = 584;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===51) {
				{
				this.state = 583;
				this.match(SolidCashParser.T__50);
				}
			}

			this.state = 586;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 590;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 48, this._ctx) ) {
			case 1:
				{
				this.state = 588;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 589;
				this.arrayType(0);
				}
				break;
			}
			this.state = 593;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===52) {
				{
				this.state = 592;
				this.match(SolidCashParser.T__51);
				}
			}

			this.state = 596;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 595;
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
			this.state = 598;
			this.match(SolidCashParser.T__34);
			this.state = 599;
			this.match(SolidCashParser.Identifier);
			this.state = 600;
			this.match(SolidCashParser.T__48);
			this.state = 612;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 601;
				this.errorParameter();
				this.state = 606;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 602;
						this.match(SolidCashParser.T__4);
						this.state = 603;
						this.errorParameter();
						}
						}
					}
					this.state = 608;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				}
				this.state = 610;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 609;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 614;
			this.match(SolidCashParser.T__49);
			this.state = 615;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 625;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 56, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 617;
				this.typeName();
				this.state = 619;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 618;
					this.match(SolidCashParser.Identifier);
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 621;
				this.arrayType(0);
				this.state = 623;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 622;
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
			this.state = 627;
			this.match(SolidCashParser.T__52);
			this.state = 628;
			this.match(SolidCashParser.Identifier);
			this.state = 629;
			this.match(SolidCashParser.T__3);
			this.state = 631;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 630;
				this.structField();
				}
				}
				this.state = 633;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180);
			this.state = 635;
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
			this.state = 640;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 58, this._ctx) ) {
			case 1:
				{
				this.state = 637;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 638;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 639;
				this.mappingType();
				}
				break;
			}
			this.state = 642;
			this.anyIdentifier();
			this.state = 643;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 645;
			this.match(SolidCashParser.T__53);
			this.state = 646;
			this.match(SolidCashParser.Identifier);
			this.state = 647;
			this.match(SolidCashParser.T__3);
			this.state = 648;
			this.enumMember();
			this.state = 653;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 59, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 649;
					this.match(SolidCashParser.T__4);
					this.state = 650;
					this.enumMember();
					}
					}
				}
				this.state = 655;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 59, this._ctx);
			}
			this.state = 657;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 656;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 659;
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
			this.state = 661;
			this.match(SolidCashParser.Identifier);
			this.state = 664;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 662;
				this.match(SolidCashParser.T__39);
				this.state = 663;
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
			this.state = 666;
			this.match(SolidCashParser.T__54);
			this.state = 667;
			this.match(SolidCashParser.Identifier);
			this.state = 668;
			this.match(SolidCashParser.T__41);
			this.state = 669;
			this.typeName();
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
	public constantDefinition(): ConstantDefinitionContext {
		let localctx: ConstantDefinitionContext = new ConstantDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 62, SolidCashParser.RULE_constantDefinition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 672;
			this.typeName();
			this.state = 673;
			this.match(SolidCashParser.T__55);
			this.state = 674;
			this.match(SolidCashParser.Identifier);
			this.state = 675;
			this.match(SolidCashParser.T__39);
			this.state = 676;
			this.expression(0);
			this.state = 677;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 679;
			this.match(SolidCashParser.T__56);
			this.state = 680;
			this.parameterList();
			this.state = 684;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 98307) !== 0)) {
				{
				{
				this.state = 681;
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
				this.state = 686;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 690;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 63, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 687;
					this.parentInvocation();
					}
					}
				}
				this.state = 692;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 63, this._ctx);
			}
			this.state = 696;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 693;
				this.customModifierInvocation();
				}
				}
				this.state = 698;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 699;
			this.match(SolidCashParser.T__3);
			this.state = 703;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 700;
				this.statement();
				}
				}
				this.state = 705;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 706;
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
			this.state = 708;
			this.match(SolidCashParser.T__59);
			this.state = 709;
			this.parameterList();
			this.state = 713;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 8197) !== 0)) {
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
			this.state = 716;
			this.match(SolidCashParser.T__43);
			this.state = 720;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 8197) !== 0)) {
				{
				{
				this.state = 717;
				this.fallbackModifier();
				}
				}
				this.state = 722;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 726;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 723;
				this.customModifierInvocation();
				}
				}
				this.state = 728;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 730;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 729;
				this.returnType();
				}
			}

			this.state = 732;
			this.match(SolidCashParser.T__3);
			this.state = 736;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 733;
				this.statement();
				}
				}
				this.state = 738;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 739;
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
			this.state = 744;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 59:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 741;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 742;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 743;
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
			this.state = 746;
			this.match(SolidCashParser.T__61);
			this.state = 747;
			this.match(SolidCashParser.T__48);
			this.state = 748;
			this.match(SolidCashParser.T__49);
			this.state = 752;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===61 || _la===72) {
				{
				{
				this.state = 749;
				this.receiveModifier();
				}
				}
				this.state = 754;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 755;
			this.match(SolidCashParser.T__43);
			this.state = 759;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===61 || _la===72) {
				{
				{
				this.state = 756;
				this.receiveModifier();
				}
				}
				this.state = 761;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 762;
			this.match(SolidCashParser.T__58);
			this.state = 766;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===61 || _la===72) {
				{
				{
				this.state = 763;
				this.receiveModifier();
				}
				}
				this.state = 768;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 778;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				{
				this.state = 769;
				this.match(SolidCashParser.T__3);
				this.state = 773;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
					{
					{
					this.state = 770;
					this.statement();
					}
					}
					this.state = 775;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 776;
				this.match(SolidCashParser.T__5);
				}
				break;
			case 2:
				{
				this.state = 777;
				this.match(SolidCashParser.T__1);
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
	public receiveModifier(): ReceiveModifierContext {
		let localctx: ReceiveModifierContext = new ReceiveModifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 72, SolidCashParser.RULE_receiveModifier);
		try {
			this.state = 782;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 61:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 780;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 781;
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
			this.state = 784;
			this.match(SolidCashParser.Identifier);
			this.state = 785;
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
			this.state = 858;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 92, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 788;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 787;
					this.stateVariableVisibility();
					}
				}

				this.state = 790;
				this.typeName();
				this.state = 795;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					this.state = 793;
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
						this.state = 791;
						this.modifier();
						}
						break;
					case 72:
						{
						this.state = 792;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 797;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 798;
				this.match(SolidCashParser.Identifier);
				this.state = 801;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 799;
					this.match(SolidCashParser.T__39);
					this.state = 800;
					this.expression(0);
					}
				}

				this.state = 803;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 805;
				this.typeName();
				this.state = 810;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					this.state = 808;
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
						this.state = 806;
						this.modifier();
						}
						break;
					case 72:
						{
						this.state = 807;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 812;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 813;
				this.stateVariableVisibility();
				this.state = 818;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					this.state = 816;
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
						this.state = 814;
						this.modifier();
						}
						break;
					case 72:
						{
						this.state = 815;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 820;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 821;
				this.match(SolidCashParser.Identifier);
				this.state = 824;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 822;
					this.match(SolidCashParser.T__39);
					this.state = 823;
					this.expression(0);
					}
				}

				this.state = 826;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 829;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 828;
					this.stateVariableVisibility();
					}
				}

				this.state = 831;
				this.mappingType();
				this.state = 835;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 832;
					this.collectionModifier();
					}
					}
					this.state = 837;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 838;
				this.match(SolidCashParser.Identifier);
				this.state = 839;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 842;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 841;
					this.stateVariableVisibility();
					}
				}

				this.state = 844;
				this.arrayType(0);
				this.state = 848;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 845;
					this.collectionModifier();
					}
					}
					this.state = 850;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 851;
				this.match(SolidCashParser.Identifier);
				this.state = 854;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 852;
					this.match(SolidCashParser.T__39);
					this.state = 853;
					this.expression(0);
					}
				}

				this.state = 856;
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
			this.state = 863;
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
				this.state = 860;
				this.modifier();
				}
				break;
			case 43:
			case 44:
			case 58:
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 861;
				this.stateVariableVisibility();
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 862;
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
			this.state = 865;
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
			this.state = 903;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 99, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 867;
				this.match(SolidCashParser.T__63);
				this.state = 868;
				this.match(SolidCashParser.T__48);
				this.state = 869;
				this.typeName();
				this.state = 871;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 870;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 873;
				this.match(SolidCashParser.T__64);
				this.state = 874;
				this.typeName();
				this.state = 876;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 875;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 878;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 880;
				this.match(SolidCashParser.T__63);
				this.state = 881;
				this.match(SolidCashParser.T__48);
				this.state = 882;
				this.typeName();
				this.state = 884;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 883;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 886;
				this.match(SolidCashParser.T__64);
				this.state = 887;
				this.mappingType();
				this.state = 888;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 890;
				this.match(SolidCashParser.T__63);
				this.state = 891;
				this.match(SolidCashParser.T__48);
				this.state = 892;
				this.typeName();
				this.state = 894;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 893;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 896;
				this.match(SolidCashParser.T__64);
				this.state = 897;
				this.arrayType(0);
				this.state = 899;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 898;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 901;
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
			{
			this.state = 906;
			this.typeName();
			this.state = 907;
			this.match(SolidCashParser.T__65);
			this.state = 909;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
				{
				this.state = 908;
				this.expression(0);
				}
			}

			this.state = 911;
			this.match(SolidCashParser.T__66);
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 921;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 102, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					{
					localctx = new ArrayTypeContext(this, _parentctx, _parentState);
					this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
					this.state = 913;
					if (!(this.precpred(this._ctx, 1))) {
						throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
					}
					this.state = 914;
					this.match(SolidCashParser.T__65);
					this.state = 916;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
						{
						this.state = 915;
						this.expression(0);
						}
					}

					this.state = 918;
					this.match(SolidCashParser.T__66);
					}
					}
				}
				this.state = 923;
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
		this.enterRule(localctx, 86, SolidCashParser.RULE_modifierDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 924;
			this.match(SolidCashParser.T__67);
			this.state = 925;
			this.match(SolidCashParser.Identifier);
			this.state = 927;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 926;
				this.parameterList();
				}
			}

			this.state = 933;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===61 || _la===72) {
				{
				this.state = 931;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 61:
					{
					this.state = 929;
					this.match(SolidCashParser.T__60);
					}
					break;
				case 72:
					{
					this.state = 930;
					this.overrideSpecifier();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 935;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 945;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				{
				this.state = 936;
				this.match(SolidCashParser.T__3);
				this.state = 940;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
					{
					{
					this.state = 937;
					this.modifierStatement();
					}
					}
					this.state = 942;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 943;
				this.match(SolidCashParser.T__5);
				}
				break;
			case 2:
				{
				this.state = 944;
				this.match(SolidCashParser.T__1);
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
	public modifierStatement(): ModifierStatementContext {
		let localctx: ModifierStatementContext = new ModifierStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 88, SolidCashParser.RULE_modifierStatement);
		try {
			this.state = 949;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 108, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 947;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 948;
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
			this.state = 951;
			this.match(SolidCashParser.T__68);
			this.state = 952;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 954;
			this.match(SolidCashParser.T__6);
			this.state = 955;
			this.anyIdentifier();
			this.state = 956;
			this.parameterList();
			this.state = 961;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0) || _la===180) {
				{
				this.state = 959;
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
					this.state = 957;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 958;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 963;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 965;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 964;
				this.returnType();
				}
			}

			this.state = 967;
			this.match(SolidCashParser.T__3);
			this.state = 971;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 968;
				this.statement();
				}
				}
				this.state = 973;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 974;
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
			this.state = 976;
			this.match(SolidCashParser.Identifier);
			this.state = 978;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 977;
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
			this.state = 994;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 70:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 980;
				this.match(SolidCashParser.T__69);
				}
				break;
			case 71:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 981;
				this.match(SolidCashParser.T__70);
				}
				break;
			case 58:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 982;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 44:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 983;
				this.match(SolidCashParser.T__43);
				}
				break;
			case 43:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 984;
				this.match(SolidCashParser.T__42);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 985;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 59:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 986;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 987;
				this.overrideSpecifier();
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 988;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 989;
				this.unsafeModifier();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 990;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 991;
				this.match(SolidCashParser.T__27);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 992;
				this.match(SolidCashParser.T__30);
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 993;
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
			this.state = 996;
			this.match(SolidCashParser.T__71);
			this.state = 1007;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 997;
				this.match(SolidCashParser.T__48);
				this.state = 998;
				this.match(SolidCashParser.Identifier);
				this.state = 1003;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 999;
					this.match(SolidCashParser.T__4);
					this.state = 1000;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1005;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1006;
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
			this.state = 1009;
			this.match(SolidCashParser.T__31);
			this.state = 1013;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 1010;
				this.match(SolidCashParser.T__48);
				this.state = 1011;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1012;
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
			this.state = 1015;
			this.match(SolidCashParser.T__72);
			this.state = 1016;
			this.match(SolidCashParser.T__48);
			this.state = 1017;
			this.returnParam();
			this.state = 1022;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 118, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1018;
					this.match(SolidCashParser.T__4);
					this.state = 1019;
					this.returnParam();
					}
					}
				}
				this.state = 1024;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 118, this._ctx);
			}
			this.state = 1026;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1025;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1028;
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
			this.state = 1060;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 126, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1030;
				this.typeName();
				this.state = 1034;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 120, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1031;
						this.modifier();
						}
						}
					}
					this.state = 1036;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 120, this._ctx);
				}
				this.state = 1038;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1037;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1040;
				this.arrayType(0);
				this.state = 1044;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 122, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1041;
						this.modifier();
						}
						}
					}
					this.state = 1046;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 122, this._ctx);
				}
				this.state = 1048;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1047;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1050;
				this.mappingType();
				this.state = 1054;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 124, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1051;
						this.modifier();
						}
						}
					}
					this.state = 1056;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 124, this._ctx);
				}
				this.state = 1058;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1057;
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
			this.state = 1062;
			this.match(SolidCashParser.T__48);
			this.state = 1074;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1063;
				this.parameter();
				this.state = 1068;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 127, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1064;
						this.match(SolidCashParser.T__4);
						this.state = 1065;
						this.parameter();
						}
						}
					}
					this.state = 1070;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 127, this._ctx);
				}
				this.state = 1072;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1071;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1076;
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
			this.state = 1108;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 136, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1078;
				this.typeName();
				this.state = 1082;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 130, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1079;
						this.modifier();
						}
						}
					}
					this.state = 1084;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 130, this._ctx);
				}
				this.state = 1086;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1085;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1088;
				this.arrayType(0);
				this.state = 1092;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 132, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1089;
						this.modifier();
						}
						}
					}
					this.state = 1094;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 132, this._ctx);
				}
				this.state = 1096;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1095;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1098;
				this.mappingType();
				this.state = 1102;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 134, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1099;
						this.modifier();
						}
						}
					}
					this.state = 1104;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 134, this._ctx);
				}
				this.state = 1106;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1105;
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
			this.state = 1119;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 138, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1110;
				this.match(SolidCashParser.T__3);
				this.state = 1114;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
					{
					{
					this.state = 1111;
					this.statement();
					}
					}
					this.state = 1116;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1117;
				this.match(SolidCashParser.T__5);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1118;
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
	public blockStatement(): BlockStatementContext {
		let localctx: BlockStatementContext = new BlockStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 112, SolidCashParser.RULE_blockStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1121;
			this.match(SolidCashParser.T__3);
			this.state = 1125;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1122;
				this.statement();
				}
				}
				this.state = 1127;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1128;
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
	public statement(): StatementContext {
		let localctx: StatementContext = new StatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 114, SolidCashParser.RULE_statement);
		try {
			this.state = 1153;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 140, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1130;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1131;
				this.blockStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1132;
				this.variableDefinition();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1133;
				this.tupleAssignment();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1134;
				this.prefixIncDecStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1135;
				this.timeOpStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1136;
				this.requireStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1137;
				this.ifStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1138;
				this.loopStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1139;
				this.consoleStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1140;
				this.emitStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1141;
				this.returnStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1142;
				this.selfdestructStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1143;
				this.assemblyStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1144;
				this.tryCatchStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1145;
				this.revertStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1146;
				this.assertStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1147;
				this.deleteStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1148;
				this.uncheckedStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1149;
				this.switchStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1150;
				this.breakStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1151;
				this.continueStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1152;
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
		this.enterRule(localctx, 116, SolidCashParser.RULE_expressionStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1155;
			this.expression(0);
			this.state = 1177;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 142, this._ctx) ) {
			case 1:
				{
				this.state = 1156;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1157;
				this.expression(0);
				}
				break;
			case 2:
				{
				this.state = 1158;
				this.match(SolidCashParser.DotPush);
				this.state = 1159;
				this.match(SolidCashParser.T__48);
				this.state = 1160;
				this.match(SolidCashParser.T__49);
				this.state = 1161;
				this.match(SolidCashParser.T__39);
				this.state = 1162;
				this.expression(0);
				}
				break;
			case 3:
				{
				this.state = 1163;
				this.match(SolidCashParser.DotPush);
				this.state = 1164;
				this.match(SolidCashParser.T__48);
				this.state = 1166;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 1165;
					this.pushArgument();
					}
				}

				this.state = 1168;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 4:
				{
				this.state = 1169;
				this.match(SolidCashParser.DotPop);
				this.state = 1170;
				this.match(SolidCashParser.T__48);
				this.state = 1171;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 5:
				{
				this.state = 1172;
				this.match(SolidCashParser.DotDelete);
				this.state = 1173;
				this.match(SolidCashParser.T__48);
				this.state = 1174;
				this.expression(0);
				this.state = 1175;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
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
	public prefixIncDecStatement(): PrefixIncDecStatementContext {
		let localctx: PrefixIncDecStatementContext = new PrefixIncDecStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 118, SolidCashParser.RULE_prefixIncDecStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1181;
			localctx._op = this._input.LT(1);
			_la = this._input.LA(1);
			if(!(_la===84 || _la===85)) {
			    localctx._op = this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			this.state = 1182;
			this.expression(0);
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
	public returnStatement(): ReturnStatementContext {
		let localctx: ReturnStatementContext = new ReturnStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 120, SolidCashParser.RULE_returnStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1214;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 146, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1185;
				this.match(SolidCashParser.T__85);
				this.state = 1186;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1187;
				this.match(SolidCashParser.T__85);
				this.state = 1188;
				this.expression(0);
				this.state = 1193;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1189;
					this.match(SolidCashParser.T__4);
					this.state = 1190;
					this.expression(0);
					}
					}
					this.state = 1195;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1196;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1198;
				this.match(SolidCashParser.T__85);
				this.state = 1199;
				this.match(SolidCashParser.T__48);
				this.state = 1200;
				this.expression(0);
				this.state = 1205;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 144, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1201;
						this.match(SolidCashParser.T__4);
						this.state = 1202;
						this.expression(0);
						}
						}
					}
					this.state = 1207;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 144, this._ctx);
				}
				this.state = 1209;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1208;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1211;
				this.match(SolidCashParser.T__49);
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
	public selfdestructStatement(): SelfdestructStatementContext {
		let localctx: SelfdestructStatementContext = new SelfdestructStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 122, SolidCashParser.RULE_selfdestructStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1216;
			this.match(SolidCashParser.T__30);
			this.state = 1217;
			this.match(SolidCashParser.T__48);
			this.state = 1218;
			this.expression(0);
			this.state = 1219;
			this.match(SolidCashParser.T__49);
			this.state = 1220;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1255;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 152, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1222;
				this.match(SolidCashParser.T__86);
				this.state = 1223;
				this.match(SolidCashParser.Identifier);
				this.state = 1226;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1224;
					this.match(SolidCashParser.T__11);
					this.state = 1225;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1228;
				this.match(SolidCashParser.T__48);
				this.state = 1229;
				this.match(SolidCashParser.T__3);
				this.state = 1241;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1230;
					this.namedArg();
					this.state = 1235;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 148, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1231;
							this.match(SolidCashParser.T__4);
							this.state = 1232;
							this.namedArg();
							}
							}
						}
						this.state = 1237;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 148, this._ctx);
					}
					this.state = 1239;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1238;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1243;
				this.match(SolidCashParser.T__5);
				this.state = 1244;
				this.match(SolidCashParser.T__49);
				this.state = 1245;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1246;
				this.match(SolidCashParser.T__86);
				this.state = 1247;
				this.match(SolidCashParser.Identifier);
				this.state = 1250;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1248;
					this.match(SolidCashParser.T__11);
					this.state = 1249;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1252;
				this.expressionList();
				this.state = 1253;
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
		this.enterRule(localctx, 126, SolidCashParser.RULE_variableDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1304;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 160, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1257;
				this.typeName();
				this.state = 1261;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 153, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1258;
						this.modifier();
						}
						}
					}
					this.state = 1263;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 153, this._ctx);
				}
				this.state = 1264;
				this.anyIdentifier();
				this.state = 1272;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1265;
					this.match(SolidCashParser.T__39);
					this.state = 1266;
					this.expression(0);
					this.state = 1270;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===165) {
						{
						this.state = 1267;
						this.match(SolidCashParser.DotPush);
						this.state = 1268;
						this.match(SolidCashParser.T__48);
						this.state = 1269;
						this.match(SolidCashParser.T__49);
						}
					}

					}
				}

				this.state = 1274;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1276;
				this.arrayType(0);
				this.state = 1280;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 156, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1277;
						this.modifier();
						}
						}
					}
					this.state = 1282;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 156, this._ctx);
				}
				this.state = 1283;
				this.anyIdentifier();
				this.state = 1286;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1284;
					this.match(SolidCashParser.T__39);
					this.state = 1285;
					this.expression(0);
					}
				}

				this.state = 1288;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1290;
				this.mappingType();
				this.state = 1294;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 158, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1291;
						this.modifier();
						}
						}
					}
					this.state = 1296;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 158, this._ctx);
				}
				this.state = 1297;
				this.anyIdentifier();
				this.state = 1300;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1298;
					this.match(SolidCashParser.T__39);
					this.state = 1299;
					this.expression(0);
					}
				}

				this.state = 1302;
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
			this.state = 1354;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 165, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1306;
				this.typeName();
				this.state = 1307;
				this.match(SolidCashParser.Identifier);
				this.state = 1312;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1308;
					this.match(SolidCashParser.T__4);
					this.state = 1309;
					this.typeName();
					this.state = 1310;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1314;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1316;
				this.match(SolidCashParser.T__39);
				this.state = 1317;
				this.expression(0);
				this.state = 1318;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1320;
				this.match(SolidCashParser.T__48);
				this.state = 1321;
				this.tupleSlot();
				this.state = 1324;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1322;
					this.match(SolidCashParser.T__4);
					this.state = 1323;
					this.tupleSlot();
					}
					}
					this.state = 1326;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1328;
				this.match(SolidCashParser.T__49);
				this.state = 1329;
				this.match(SolidCashParser.T__39);
				this.state = 1330;
				this.match(SolidCashParser.T__48);
				this.state = 1331;
				this.expression(0);
				this.state = 1334;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1332;
					this.match(SolidCashParser.T__4);
					this.state = 1333;
					this.expression(0);
					}
					}
					this.state = 1336;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1338;
				this.match(SolidCashParser.T__49);
				this.state = 1339;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1341;
				this.match(SolidCashParser.T__48);
				this.state = 1342;
				this.tupleSlot();
				this.state = 1345;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1343;
					this.match(SolidCashParser.T__4);
					this.state = 1344;
					this.tupleSlot();
					}
					}
					this.state = 1347;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1349;
				this.match(SolidCashParser.T__49);
				this.state = 1350;
				this.match(SolidCashParser.T__39);
				this.state = 1351;
				this.expression(0);
				this.state = 1352;
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
		try {
			let _alt: number;
			this.state = 1376;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 168, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1356;
				this.typeName();
				this.state = 1360;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1357;
						this.modifier();
						}
						}
					}
					this.state = 1362;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
				}
				this.state = 1363;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1365;
				this.arrayType(0);
				this.state = 1369;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 167, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1366;
						this.modifier();
						}
						}
					}
					this.state = 1371;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 167, this._ctx);
				}
				this.state = 1372;
				this.anyIdentifier();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1374;
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
		this.enterRule(localctx, 132, SolidCashParser.RULE_pushArgument);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1378;
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
		this.enterRule(localctx, 134, SolidCashParser.RULE_deleteStatement);
		let _la: number;
		try {
			this.state = 1441;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 174, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1380;
				this.match(SolidCashParser.T__87);
				this.state = 1381;
				this.match(SolidCashParser.Identifier);
				this.state = 1382;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1383;
				this.match(SolidCashParser.T__87);
				this.state = 1384;
				this.match(SolidCashParser.T__88);
				this.state = 1385;
				this.match(SolidCashParser.T__11);
				this.state = 1386;
				this.match(SolidCashParser.Identifier);
				this.state = 1387;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1388;
				this.match(SolidCashParser.T__87);
				this.state = 1389;
				this.match(SolidCashParser.T__88);
				this.state = 1390;
				this.match(SolidCashParser.T__11);
				this.state = 1391;
				this.match(SolidCashParser.Identifier);
				this.state = 1396;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1392;
					this.match(SolidCashParser.T__65);
					this.state = 1393;
					this.expression(0);
					this.state = 1394;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1398;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1400;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1402;
				this.match(SolidCashParser.T__87);
				this.state = 1403;
				this.match(SolidCashParser.Identifier);
				this.state = 1408;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1404;
					this.match(SolidCashParser.T__65);
					this.state = 1405;
					this.expression(0);
					this.state = 1406;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1410;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1412;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				localctx = new DeleteMemberEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1414;
				this.match(SolidCashParser.T__87);
				this.state = 1415;
				this.match(SolidCashParser.Identifier);
				this.state = 1418;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1416;
					this.match(SolidCashParser.T__11);
					this.state = 1417;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1420;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1426;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1422;
					this.match(SolidCashParser.T__65);
					this.state = 1423;
					this.expression(0);
					this.state = 1424;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1428;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1430;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 6:
				localctx = new DeleteMemberContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1432;
				this.match(SolidCashParser.T__87);
				this.state = 1433;
				this.match(SolidCashParser.Identifier);
				this.state = 1436;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1434;
					this.match(SolidCashParser.T__11);
					this.state = 1435;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1438;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1440;
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
		this.enterRule(localctx, 136, SolidCashParser.RULE_timeOpStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1443;
			this.match(SolidCashParser.T__89);
			this.state = 1444;
			this.match(SolidCashParser.T__48);
			this.state = 1445;
			this.match(SolidCashParser.TxVar);
			this.state = 1446;
			this.match(SolidCashParser.T__22);
			this.state = 1447;
			this.expression(0);
			this.state = 1450;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1448;
				this.match(SolidCashParser.T__4);
				this.state = 1449;
				this.requireMessage();
				}
			}

			this.state = 1452;
			this.match(SolidCashParser.T__49);
			this.state = 1453;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 138, SolidCashParser.RULE_requireStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1455;
			this.match(SolidCashParser.T__89);
			this.state = 1456;
			this.match(SolidCashParser.T__48);
			this.state = 1457;
			this.expression(0);
			this.state = 1460;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1458;
				this.match(SolidCashParser.T__4);
				this.state = 1459;
				this.requireMessage();
				}
			}

			this.state = 1462;
			this.match(SolidCashParser.T__49);
			this.state = 1463;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 140, SolidCashParser.RULE_ifStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1465;
			this.match(SolidCashParser.T__90);
			this.state = 1466;
			this.match(SolidCashParser.T__48);
			this.state = 1467;
			this.expression(0);
			this.state = 1468;
			this.match(SolidCashParser.T__49);
			this.state = 1469;
			localctx._ifBlock = this.block();
			this.state = 1472;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 177, this._ctx) ) {
			case 1:
				{
				this.state = 1470;
				this.match(SolidCashParser.T__91);
				this.state = 1471;
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
		this.enterRule(localctx, 142, SolidCashParser.RULE_loopStatement);
		try {
			this.state = 1480;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 178, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1474;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1475;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1476;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1477;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1478;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1479;
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
		this.enterRule(localctx, 144, SolidCashParser.RULE_forOfEntriesStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1482;
			this.match(SolidCashParser.T__8);
			this.state = 1483;
			this.match(SolidCashParser.T__48);
			this.state = 1484;
			this.typeName();
			this.state = 1485;
			this.match(SolidCashParser.Identifier);
			this.state = 1486;
			this.match(SolidCashParser.T__4);
			this.state = 1487;
			this.typeName();
			this.state = 1488;
			this.match(SolidCashParser.Identifier);
			this.state = 1489;
			this.match(SolidCashParser.T__92);
			this.state = 1490;
			this.match(SolidCashParser.T__88);
			this.state = 1491;
			this.match(SolidCashParser.T__11);
			this.state = 1492;
			this.match(SolidCashParser.Identifier);
			this.state = 1493;
			this.match(SolidCashParser.T__11);
			this.state = 1494;
			this.match(SolidCashParser.T__33);
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
	public forInStatement(): ForInStatementContext {
		let localctx: ForInStatementContext = new ForInStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 146, SolidCashParser.RULE_forInStatement);
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
			this.match(SolidCashParser.T__93);
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
	public forOfStatement(): ForOfStatementContext {
		let localctx: ForOfStatementContext = new ForOfStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 148, SolidCashParser.RULE_forOfStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1509;
			this.match(SolidCashParser.T__8);
			this.state = 1510;
			this.match(SolidCashParser.T__48);
			this.state = 1511;
			this.typeName();
			this.state = 1512;
			this.match(SolidCashParser.Identifier);
			this.state = 1513;
			this.match(SolidCashParser.T__92);
			this.state = 1514;
			this.match(SolidCashParser.T__88);
			this.state = 1515;
			this.match(SolidCashParser.T__11);
			this.state = 1516;
			this.match(SolidCashParser.Identifier);
			this.state = 1517;
			this.match(SolidCashParser.T__49);
			this.state = 1518;
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
		this.enterRule(localctx, 150, SolidCashParser.RULE_forStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1520;
			this.match(SolidCashParser.T__8);
			this.state = 1521;
			this.match(SolidCashParser.T__48);
			this.state = 1522;
			this.forInit();
			this.state = 1523;
			this.forCondition();
			this.state = 1525;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49 || _la===84 || _la===85 || _la===180) {
				{
				this.state = 1524;
				this.forUpdate();
				}
			}

			this.state = 1527;
			this.match(SolidCashParser.T__49);
			this.state = 1528;
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
		this.enterRule(localctx, 152, SolidCashParser.RULE_forInit);
		let _la: number;
		try {
			this.state = 1575;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 185, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1530;
				this.typeName();
				this.state = 1534;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 1531;
					this.modifier();
					}
					}
					this.state = 1536;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1537;
				this.match(SolidCashParser.Identifier);
				this.state = 1540;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1538;
					this.match(SolidCashParser.T__39);
					this.state = 1539;
					this.expression(0);
					}
				}

				this.state = 1542;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
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
				this.state = 1547;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1549;
				this.match(SolidCashParser.T__48);
				this.state = 1550;
				this.tupleSlot();
				this.state = 1553;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1551;
					this.match(SolidCashParser.T__4);
					this.state = 1552;
					this.tupleSlot();
					}
					}
					this.state = 1555;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1557;
				this.match(SolidCashParser.T__49);
				this.state = 1558;
				this.match(SolidCashParser.T__39);
				this.state = 1570;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 184, this._ctx) ) {
				case 1:
					{
					this.state = 1559;
					this.match(SolidCashParser.T__48);
					this.state = 1560;
					this.expression(0);
					this.state = 1563;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1561;
						this.match(SolidCashParser.T__4);
						this.state = 1562;
						this.expression(0);
						}
						}
						this.state = 1565;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===5);
					this.state = 1567;
					this.match(SolidCashParser.T__49);
					}
					break;
				case 2:
					{
					this.state = 1569;
					this.expression(0);
					}
					break;
				}
				this.state = 1572;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1574;
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
		this.enterRule(localctx, 154, SolidCashParser.RULE_forCondition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1578;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
				{
				this.state = 1577;
				this.expression(0);
				}
			}

			this.state = 1580;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 156, SolidCashParser.RULE_forUpdate);
		let _la: number;
		try {
			this.state = 1612;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 190, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1582;
				this.match(SolidCashParser.Identifier);
				this.state = 1583;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1584;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1585;
				this.match(SolidCashParser.Identifier);
				this.state = 1586;
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
				this.state = 1587;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===84 || _la===85)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1588;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1589;
				this.match(SolidCashParser.T__48);
				this.state = 1590;
				this.tupleSlot();
				this.state = 1593;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1591;
					this.match(SolidCashParser.T__4);
					this.state = 1592;
					this.tupleSlot();
					}
					}
					this.state = 1595;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1597;
				this.match(SolidCashParser.T__49);
				this.state = 1598;
				this.match(SolidCashParser.T__39);
				this.state = 1610;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 189, this._ctx) ) {
				case 1:
					{
					this.state = 1599;
					this.match(SolidCashParser.T__48);
					this.state = 1600;
					this.expression(0);
					this.state = 1603;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1601;
						this.match(SolidCashParser.T__4);
						this.state = 1602;
						this.expression(0);
						}
						}
						this.state = 1605;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===5);
					this.state = 1607;
					this.match(SolidCashParser.T__49);
					}
					break;
				case 2:
					{
					this.state = 1609;
					this.expression(0);
					}
					break;
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
		this.enterRule(localctx, 158, SolidCashParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1614;
			this.match(SolidCashParser.T__94);
			this.state = 1615;
			this.block();
			this.state = 1616;
			this.match(SolidCashParser.T__95);
			this.state = 1617;
			this.match(SolidCashParser.T__48);
			this.state = 1618;
			this.expression(0);
			this.state = 1619;
			this.match(SolidCashParser.T__49);
			this.state = 1620;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 160, SolidCashParser.RULE_whileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1622;
			this.match(SolidCashParser.T__95);
			this.state = 1623;
			this.match(SolidCashParser.T__48);
			this.state = 1624;
			this.expression(0);
			this.state = 1625;
			this.match(SolidCashParser.T__49);
			this.state = 1626;
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
		this.enterRule(localctx, 162, SolidCashParser.RULE_consoleStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1628;
			this.match(SolidCashParser.T__96);
			this.state = 1629;
			this.consoleParameterList();
			this.state = 1630;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 164, SolidCashParser.RULE_assemblyStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1632;
			this.match(SolidCashParser.T__97);
			this.state = 1634;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===151) {
				{
				this.state = 1633;
				this.match(SolidCashParser.StringLiteral);
				}
			}

			this.state = 1646;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 1636;
				this.match(SolidCashParser.T__48);
				this.state = 1637;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1642;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1638;
					this.match(SolidCashParser.T__4);
					this.state = 1639;
					this.match(SolidCashParser.StringLiteral);
					}
					}
					this.state = 1644;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1645;
				this.match(SolidCashParser.T__49);
				}
			}

			this.state = 1648;
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
		this.enterRule(localctx, 166, SolidCashParser.RULE_yulBlock);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1650;
			this.match(SolidCashParser.T__3);
			this.state = 1654;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026534544) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 31) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 4579361) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				{
				this.state = 1651;
				this.yulStatement();
				}
				}
				this.state = 1656;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1657;
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
		this.enterRule(localctx, 168, SolidCashParser.RULE_yulStatement);
		try {
			this.state = 1672;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 195, this._ctx) ) {
			case 1:
				localctx = new YulNestedBlockStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1659;
				this.yulBlock();
				}
				break;
			case 2:
				localctx = new YulVarDeclStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1660;
				this.yulVariableDeclaration();
				}
				break;
			case 3:
				localctx = new YulAssignStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1661;
				this.yulAssignment();
				}
				break;
			case 4:
				localctx = new YulIfStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1662;
				this.yulIf();
				}
				break;
			case 5:
				localctx = new YulSwitchStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1663;
				this.yulSwitch();
				}
				break;
			case 6:
				localctx = new YulForStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1664;
				this.yulForLoop();
				}
				break;
			case 7:
				localctx = new YulFunctionDefStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1665;
				this.yulFunctionDefinition();
				}
				break;
			case 8:
				localctx = new YulBreakStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1666;
				this.match(SolidCashParser.T__98);
				}
				break;
			case 9:
				localctx = new YulContinueStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1667;
				this.match(SolidCashParser.T__99);
				}
				break;
			case 10:
				localctx = new YulLeaveStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1668;
				this.match(SolidCashParser.T__100);
				}
				break;
			case 11:
				localctx = new YulCallStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1669;
				this.yulFunctionCall();
				}
				break;
			case 12:
				localctx = new YulPathStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1670;
				this.yulPath();
				}
				break;
			case 13:
				localctx = new YulLiteralStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1671;
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
		this.enterRule(localctx, 170, SolidCashParser.RULE_yulVariableDeclaration);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1674;
			this.match(SolidCashParser.T__101);
			this.state = 1675;
			this.anyIdentifier();
			this.state = 1680;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1676;
				this.match(SolidCashParser.T__4);
				this.state = 1677;
				this.anyIdentifier();
				}
				}
				this.state = 1682;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1685;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===103) {
				{
				this.state = 1683;
				this.match(SolidCashParser.T__102);
				this.state = 1684;
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
		this.enterRule(localctx, 172, SolidCashParser.RULE_yulAssignment);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1687;
			this.yulPath();
			this.state = 1692;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1688;
				this.match(SolidCashParser.T__4);
				this.state = 1689;
				this.yulPath();
				}
				}
				this.state = 1694;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1695;
			this.match(SolidCashParser.T__102);
			this.state = 1696;
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
		this.enterRule(localctx, 174, SolidCashParser.RULE_yulIf);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1698;
			this.match(SolidCashParser.T__90);
			this.state = 1699;
			this.yulExpression();
			this.state = 1700;
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
		this.enterRule(localctx, 176, SolidCashParser.RULE_yulSwitch);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1702;
			this.match(SolidCashParser.T__103);
			this.state = 1703;
			this.yulExpression();
			this.state = 1713;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 105:
				{
				this.state = 1705;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1704;
					this.yulCase();
					}
					}
					this.state = 1707;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===105);
				this.state = 1710;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===106) {
					{
					this.state = 1709;
					this.yulDefault();
					}
				}

				}
				break;
			case 106:
				{
				this.state = 1712;
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
		this.enterRule(localctx, 178, SolidCashParser.RULE_yulCase);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1715;
			this.match(SolidCashParser.T__104);
			this.state = 1716;
			this.yulLiteral();
			this.state = 1717;
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
		this.enterRule(localctx, 180, SolidCashParser.RULE_yulDefault);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1719;
			this.match(SolidCashParser.T__105);
			this.state = 1720;
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
		this.enterRule(localctx, 182, SolidCashParser.RULE_yulForLoop);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1722;
			this.match(SolidCashParser.T__8);
			this.state = 1723;
			this.yulBlock();
			this.state = 1724;
			this.yulExpression();
			this.state = 1725;
			this.yulBlock();
			this.state = 1726;
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
		this.enterRule(localctx, 184, SolidCashParser.RULE_yulFunctionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1728;
			this.match(SolidCashParser.T__6);
			this.state = 1729;
			this.match(SolidCashParser.Identifier);
			this.state = 1730;
			this.match(SolidCashParser.T__48);
			this.state = 1739;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 1731;
				this.match(SolidCashParser.Identifier);
				this.state = 1736;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1732;
					this.match(SolidCashParser.T__4);
					this.state = 1733;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1738;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1741;
			this.match(SolidCashParser.T__49);
			this.state = 1751;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===107) {
				{
				this.state = 1742;
				this.match(SolidCashParser.T__106);
				this.state = 1743;
				this.match(SolidCashParser.Identifier);
				this.state = 1748;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1744;
					this.match(SolidCashParser.T__4);
					this.state = 1745;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1750;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1753;
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
		this.enterRule(localctx, 186, SolidCashParser.RULE_yulExpression);
		try {
			this.state = 1758;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 206, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1755;
				this.yulFunctionCall();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1756;
				this.yulPath();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1757;
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
		this.enterRule(localctx, 188, SolidCashParser.RULE_yulFunctionCall);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1760;
			this.yulFunctionName();
			this.state = 1761;
			this.match(SolidCashParser.T__48);
			this.state = 1770;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===86 || _la===108 || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				this.state = 1762;
				this.yulExpression();
				this.state = 1767;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1763;
					this.match(SolidCashParser.T__4);
					this.state = 1764;
					this.yulExpression();
					}
					}
					this.state = 1769;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1772;
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
		this.enterRule(localctx, 190, SolidCashParser.RULE_yulFunctionName);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1774;
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
		this.enterRule(localctx, 192, SolidCashParser.RULE_yulPath);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1776;
			this.anyIdentifier();
			this.state = 1782;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===12 || _la===164) {
				{
				this.state = 1780;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 12:
					{
					this.state = 1777;
					this.match(SolidCashParser.T__11);
					this.state = 1778;
					this.anyIdentifier();
					}
					break;
				case 164:
					{
					this.state = 1779;
					this.match(SolidCashParser.DotLength);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 1784;
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
		this.enterRule(localctx, 194, SolidCashParser.RULE_yulLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1785;
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
		this.enterRule(localctx, 196, SolidCashParser.RULE_uncheckedStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1787;
			this.match(SolidCashParser.T__108);
			this.state = 1788;
			this.match(SolidCashParser.T__3);
			this.state = 1792;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1789;
				this.statement();
				}
				}
				this.state = 1794;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1795;
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
		this.enterRule(localctx, 198, SolidCashParser.RULE_switchStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1797;
			this.match(SolidCashParser.T__103);
			this.state = 1798;
			this.match(SolidCashParser.T__48);
			this.state = 1799;
			this.expression(0);
			this.state = 1800;
			this.match(SolidCashParser.T__49);
			this.state = 1801;
			this.match(SolidCashParser.T__3);
			this.state = 1805;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===105) {
				{
				{
				this.state = 1802;
				this.switchCase();
				}
				}
				this.state = 1807;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1809;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===106) {
				{
				this.state = 1808;
				this.switchDefault();
				}
			}

			this.state = 1811;
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
		this.enterRule(localctx, 200, SolidCashParser.RULE_switchCase);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1813;
			this.match(SolidCashParser.T__104);
			this.state = 1814;
			this.expression(0);
			this.state = 1815;
			this.match(SolidCashParser.T__109);
			this.state = 1819;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1816;
				this.statement();
				}
				}
				this.state = 1821;
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
		this.enterRule(localctx, 202, SolidCashParser.RULE_switchDefault);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1822;
			this.match(SolidCashParser.T__105);
			this.state = 1823;
			this.match(SolidCashParser.T__109);
			this.state = 1827;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1824;
				this.statement();
				}
				}
				this.state = 1829;
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
		this.enterRule(localctx, 204, SolidCashParser.RULE_tryCatchStatement);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1830;
			this.match(SolidCashParser.T__110);
			this.state = 1831;
			this.expression(0);
			this.state = 1833;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 1832;
				this.tryReturns();
				}
			}

			this.state = 1835;
			localctx._tryBlock = this.block();
			this.state = 1837;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1836;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1839;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 217, this._ctx);
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
		this.enterRule(localctx, 206, SolidCashParser.RULE_tryReturns);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1841;
			this.match(SolidCashParser.T__72);
			this.state = 1842;
			this.match(SolidCashParser.T__48);
			this.state = 1854;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1843;
				this.parameter();
				this.state = 1848;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 218, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1844;
						this.match(SolidCashParser.T__4);
						this.state = 1845;
						this.parameter();
						}
						}
					}
					this.state = 1850;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 218, this._ctx);
				}
				this.state = 1852;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1851;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1856;
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
		this.enterRule(localctx, 208, SolidCashParser.RULE_catchClause);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1858;
			this.match(SolidCashParser.T__111);
			this.state = 1860;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 221, this._ctx) ) {
			case 1:
				{
				this.state = 1859;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 1877;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 225, this._ctx) ) {
			case 1:
				{
				this.state = 1862;
				this.match(SolidCashParser.T__48);
				this.state = 1874;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 1863;
					this.parameter();
					this.state = 1868;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 222, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1864;
							this.match(SolidCashParser.T__4);
							this.state = 1865;
							this.parameter();
							}
							}
						}
						this.state = 1870;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 222, this._ctx);
					}
					this.state = 1872;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1871;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1876;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
			this.state = 1879;
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
		this.enterRule(localctx, 210, SolidCashParser.RULE_breakStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1881;
			this.match(SolidCashParser.T__98);
			this.state = 1882;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 212, SolidCashParser.RULE_continueStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1884;
			this.match(SolidCashParser.T__99);
			this.state = 1885;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 214, SolidCashParser.RULE_requireMessage);
		try {
			this.state = 1890;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 151:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1887;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 180:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1888;
				this.match(SolidCashParser.Identifier);
				this.state = 1889;
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
		this.enterRule(localctx, 216, SolidCashParser.RULE_revertStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1934;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 232, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1892;
				this.match(SolidCashParser.T__35);
				this.state = 1893;
				this.match(SolidCashParser.Identifier);
				this.state = 1896;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1894;
					this.match(SolidCashParser.T__11);
					this.state = 1895;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1898;
				this.match(SolidCashParser.T__48);
				this.state = 1899;
				this.match(SolidCashParser.T__3);
				this.state = 1911;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1900;
					this.namedArg();
					this.state = 1905;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 228, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1901;
							this.match(SolidCashParser.T__4);
							this.state = 1902;
							this.namedArg();
							}
							}
						}
						this.state = 1907;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 228, this._ctx);
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
				this.match(SolidCashParser.T__5);
				this.state = 1914;
				this.match(SolidCashParser.T__49);
				this.state = 1915;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1916;
				this.match(SolidCashParser.T__35);
				this.state = 1917;
				this.match(SolidCashParser.Identifier);
				this.state = 1920;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1918;
					this.match(SolidCashParser.T__11);
					this.state = 1919;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1922;
				this.expressionList();
				this.state = 1923;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1925;
				this.match(SolidCashParser.T__35);
				this.state = 1926;
				this.match(SolidCashParser.T__48);
				this.state = 1927;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1928;
				this.match(SolidCashParser.T__49);
				this.state = 1929;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1930;
				this.match(SolidCashParser.T__35);
				this.state = 1931;
				this.match(SolidCashParser.T__48);
				this.state = 1932;
				this.match(SolidCashParser.T__49);
				this.state = 1933;
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
		this.enterRule(localctx, 218, SolidCashParser.RULE_assertStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1936;
			this.match(SolidCashParser.T__112);
			this.state = 1937;
			this.match(SolidCashParser.T__48);
			this.state = 1938;
			this.expression(0);
			this.state = 1939;
			this.match(SolidCashParser.T__49);
			this.state = 1940;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 220, SolidCashParser.RULE_consoleParameter);
		try {
			this.state = 1944;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 180:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1942;
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
				this.state = 1943;
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
		this.enterRule(localctx, 222, SolidCashParser.RULE_consoleParameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1946;
			this.match(SolidCashParser.T__48);
			this.state = 1958;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 3152921) !== 0) || _la===180) {
				{
				this.state = 1947;
				this.consoleParameter();
				this.state = 1952;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 234, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1948;
						this.match(SolidCashParser.T__4);
						this.state = 1949;
						this.consoleParameter();
						}
						}
					}
					this.state = 1954;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 234, this._ctx);
				}
				this.state = 1956;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1955;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1960;
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
		this.enterRule(localctx, 224, SolidCashParser.RULE_functionCall);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1986;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 240, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1962;
				this.match(SolidCashParser.Identifier);
				this.state = 1963;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1964;
				this.match(SolidCashParser.Identifier);
				this.state = 1965;
				this.match(SolidCashParser.T__11);
				this.state = 1966;
				this.match(SolidCashParser.Identifier);
				this.state = 1967;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1968;
				this.match(SolidCashParser.Identifier);
				this.state = 1969;
				this.match(SolidCashParser.T__48);
				this.state = 1970;
				this.match(SolidCashParser.T__3);
				this.state = 1982;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1971;
					this.namedArg();
					this.state = 1976;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 237, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1972;
							this.match(SolidCashParser.T__4);
							this.state = 1973;
							this.namedArg();
							}
							}
						}
						this.state = 1978;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 237, this._ctx);
					}
					this.state = 1980;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1979;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1984;
				this.match(SolidCashParser.T__5);
				this.state = 1985;
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
		this.enterRule(localctx, 226, SolidCashParser.RULE_namedArg);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1988;
			this.match(SolidCashParser.Identifier);
			this.state = 1989;
			this.match(SolidCashParser.T__109);
			this.state = 1990;
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
		this.enterRule(localctx, 228, SolidCashParser.RULE_expressionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1992;
			this.match(SolidCashParser.T__48);
			this.state = 2004;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
				{
				this.state = 1993;
				this.expression(0);
				this.state = 1998;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 241, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1994;
						this.match(SolidCashParser.T__4);
						this.state = 1995;
						this.expression(0);
						}
						}
					}
					this.state = 2000;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 241, this._ctx);
				}
				this.state = 2002;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2001;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2006;
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
		this.enterRule(localctx, 230, SolidCashParser.RULE_callOptions);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2008;
			this.match(SolidCashParser.T__3);
			this.state = 2009;
			this.callOption();
			this.state = 2014;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 244, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2010;
					this.match(SolidCashParser.T__4);
					this.state = 2011;
					this.callOption();
					}
					}
				}
				this.state = 2016;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 244, this._ctx);
			}
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
		this.enterRule(localctx, 232, SolidCashParser.RULE_callOption);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2022;
			this.match(SolidCashParser.Identifier);
			this.state = 2023;
			this.match(SolidCashParser.T__109);
			this.state = 2024;
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
		this.enterRule(localctx, 234, SolidCashParser.RULE_typeList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2026;
			this.match(SolidCashParser.T__48);
			this.state = 2027;
			this.typeListItem();
			this.state = 2032;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 246, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2028;
					this.match(SolidCashParser.T__4);
					this.state = 2029;
					this.typeListItem();
					}
					}
				}
				this.state = 2034;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 246, this._ctx);
			}
			this.state = 2036;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2035;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 2038;
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
		this.enterRule(localctx, 236, SolidCashParser.RULE_typeListItem);
		try {
			this.state = 2042;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 248, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2040;
				this.typeName();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2041;
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
		let _startState: number = 238;
		this.enterRecursionRule(localctx, 238, SolidCashParser.RULE_expression, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2214;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 257, this._ctx) ) {
			case 1:
				{
				localctx = new AssignmentExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 2045;
				this.match(SolidCashParser.T__48);
				this.state = 2046;
				this.match(SolidCashParser.Identifier);
				this.state = 2047;
				(localctx as AssignmentExpressionContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    (localctx as AssignmentExpressionContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2048;
				this.expression(0);
				this.state = 2049;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				{
				localctx = new InstantiationWithOptionsContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2051;
				this.match(SolidCashParser.T__48);
				this.state = 2052;
				this.match(SolidCashParser.T__113);
				this.state = 2053;
				this.match(SolidCashParser.Identifier);
				this.state = 2054;
				this.match(SolidCashParser.T__49);
				this.state = 2055;
				this.callOptions();
				this.state = 2056;
				this.expressionList();
				}
				break;
			case 3:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2058;
				this.match(SolidCashParser.T__48);
				this.state = 2059;
				this.expression(0);
				this.state = 2060;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 4:
				{
				localctx = new TupleExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2062;
				this.match(SolidCashParser.T__48);
				this.state = 2063;
				this.expression(0);
				this.state = 2066;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2064;
					this.match(SolidCashParser.T__4);
					this.state = 2065;
					this.expression(0);
					}
					}
					this.state = 2068;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2070;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 5:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2072;
				this.typeCast();
				this.state = 2073;
				this.match(SolidCashParser.T__48);
				this.state = 2074;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 2076;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2075;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 2078;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 6:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2080;
				this.functionCall();
				}
				break;
			case 7:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2081;
				this.match(SolidCashParser.T__113);
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
			case 8:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2087;
				this.match(SolidCashParser.T__113);
				this.state = 2088;
				this.typeName();
				this.state = 2091;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2089;
					this.match(SolidCashParser.T__65);
					this.state = 2090;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 2093;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 2095;
				this.match(SolidCashParser.T__48);
				this.state = 2096;
				this.expression(0);
				this.state = 2097;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 9:
				{
				localctx = new NewDynamicBytesContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2099;
				this.match(SolidCashParser.T__113);
				this.state = 2100;
				this.match(SolidCashParser.UnboundedBytes);
				this.state = 2101;
				this.match(SolidCashParser.T__48);
				this.state = 2102;
				this.expression(0);
				this.state = 2103;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 10:
				{
				localctx = new NewDynamicStringContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2105;
				this.match(SolidCashParser.T__113);
				this.state = 2106;
				this.match(SolidCashParser.PrimitiveType);
				this.state = 2107;
				this.match(SolidCashParser.T__48);
				this.state = 2108;
				this.expression(0);
				this.state = 2109;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 11:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2111;
				this.match(SolidCashParser.T__54);
				this.state = 2112;
				this.match(SolidCashParser.T__48);
				this.state = 2113;
				this.typeName();
				this.state = 2114;
				this.match(SolidCashParser.T__49);
				this.state = 2115;
				this.match(SolidCashParser.T__11);
				this.state = 2116;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 12:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2118;
				this.match(SolidCashParser.T__114);
				this.state = 2119;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2120;
				this.match(SolidCashParser.T__115);
				this.state = 2121;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2122;
				this.match(SolidCashParser.T__116);
				this.state = 2123;
				this.expressionList();
				}
				break;
			case 15:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2124;
				this.match(SolidCashParser.T__117);
				this.state = 2125;
				this.expressionList();
				}
				break;
			case 16:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2126;
				this.match(SolidCashParser.T__118);
				this.state = 2127;
				this.match(SolidCashParser.T__48);
				this.state = 2128;
				_la = this._input.LA(1);
				if(!(_la===89 || _la===180)) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2129;
				this.match(SolidCashParser.T__11);
				this.state = 2130;
				this.match(SolidCashParser.Identifier);
				this.state = 2131;
				this.match(SolidCashParser.T__4);
				this.state = 2132;
				this.expressionList();
				this.state = 2133;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 17:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2135;
				this.match(SolidCashParser.T__119);
				this.state = 2136;
				this.expressionList();
				}
				break;
			case 18:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2137;
				this.match(SolidCashParser.T__120);
				this.state = 2138;
				this.expressionList();
				}
				break;
			case 19:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2139;
				this.match(SolidCashParser.T__121);
				this.state = 2140;
				this.match(SolidCashParser.T__48);
				this.state = 2141;
				this.expression(0);
				this.state = 2142;
				this.match(SolidCashParser.T__4);
				this.state = 2143;
				this.typeList();
				this.state = 2144;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 20:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2146;
				this.match(SolidCashParser.T__122);
				this.state = 2147;
				this.match(SolidCashParser.T__48);
				this.state = 2148;
				this.expression(0);
				this.state = 2149;
				this.match(SolidCashParser.T__4);
				this.state = 2150;
				this.typeList();
				this.state = 2151;
				this.match(SolidCashParser.T__4);
				this.state = 2152;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 2153;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 21:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2155;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__123);
				this.state = 2156;
				this.match(SolidCashParser.T__65);
				this.state = 2157;
				this.expression(0);
				this.state = 2158;
				this.match(SolidCashParser.T__66);
				this.state = 2159;
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
				this.state = 2161;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__124);
				this.state = 2162;
				this.match(SolidCashParser.T__65);
				this.state = 2163;
				this.expression(0);
				this.state = 2164;
				this.match(SolidCashParser.T__66);
				this.state = 2165;
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
				this.state = 2167;
				(localctx as PrefixOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===84 || _la===85)) {
				    (localctx as PrefixOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2168;
				this.expression(22);
				}
				break;
			case 24:
				{
				localctx = new UnaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2169;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===127)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2170;
				this.expression(21);
				}
				break;
			case 25:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2171;
				this.match(SolidCashParser.T__65);
				this.state = 2183;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 2172;
					this.expression(0);
					this.state = 2177;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 253, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2173;
							this.match(SolidCashParser.T__4);
							this.state = 2174;
							this.expression(0);
							}
							}
						}
						this.state = 2179;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 253, this._ctx);
					}
					this.state = 2181;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2180;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2185;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 26:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2186;
				this.match(SolidCashParser.T__88);
				this.state = 2187;
				this.match(SolidCashParser.T__11);
				this.state = 2188;
				this.match(SolidCashParser.Identifier);
				this.state = 2189;
				this.match(SolidCashParser.T__11);
				this.state = 2190;
				this.match(SolidCashParser.Identifier);
				this.state = 2191;
				this.match(SolidCashParser.T__65);
				this.state = 2192;
				this.expression(0);
				this.state = 2193;
				this.match(SolidCashParser.T__66);
				this.state = 2194;
				this.memberName();
				}
				break;
			case 27:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2196;
				this.match(SolidCashParser.T__88);
				this.state = 2197;
				this.match(SolidCashParser.T__11);
				this.state = 2198;
				this.match(SolidCashParser.Identifier);
				this.state = 2203;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2199;
						this.match(SolidCashParser.T__65);
						this.state = 2200;
						this.expression(0);
						this.state = 2201;
						this.match(SolidCashParser.T__66);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2205;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 256, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 28:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2207;
				this.match(SolidCashParser.T__88);
				this.state = 2208;
				this.match(SolidCashParser.T__11);
				this.state = 2209;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 29:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2210;
				this.match(SolidCashParser.T__88);
				}
				break;
			case 30:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2211;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 31:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2212;
				this.anyIdentifier();
				}
				break;
			case 32:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2213;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2326;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 266, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2324;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 265, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2216;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 2217;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 2218;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2219;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 2220;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2221;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2222;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 2223;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2224;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2225;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 2226;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===128 || _la===129)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2227;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2228;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 2229;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2230;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2231;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2232;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2233;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2234;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2235;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2236;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2237;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2238;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2239;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2240;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2241;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2242;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2243;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2244;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__129);
						this.state = 2245;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2246;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2247;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__130);
						this.state = 2248;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2249;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 2250;
						this.match(SolidCashParser.T__131);
						this.state = 2251;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 2252;
						this.match(SolidCashParser.T__109);
						this.state = 2253;
						(localctx as TernaryOpContext)._ifFalse = this.expression(9);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2255;
						if (!(this.precpred(this._ctx, 34))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 34)");
						}
						this.state = 2256;
						this.match(SolidCashParser.T__65);
						this.state = 2258;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
							{
							this.state = 2257;
							(localctx as IndexRangeSliceContext)._start = this.expression(0);
							}
						}

						this.state = 2260;
						this.match(SolidCashParser.T__109);
						this.state = 2262;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
							{
							this.state = 2261;
							(localctx as IndexRangeSliceContext)._end = this.expression(0);
							}
						}

						this.state = 2264;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2265;
						if (!(this.precpred(this._ctx, 33))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 33)");
						}
						this.state = 2266;
						this.match(SolidCashParser.T__65);
						this.state = 2267;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2268;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2269;
						if (!(this.precpred(this._ctx, 32))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 32)");
						}
						this.state = 2270;
						this.match(SolidCashParser.T__65);
						this.state = 2271;
						this.expression(0);
						this.state = 2272;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2274;
						if (!(this.precpred(this._ctx, 29))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 29)");
						}
						this.state = 2275;
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
						this.state = 2276;
						if (!(this.precpred(this._ctx, 28))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 28)");
						}
						this.state = 2277;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.DotSplit);
						this.state = 2278;
						this.match(SolidCashParser.T__48);
						this.state = 2279;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2280;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2282;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2283;
						this.match(SolidCashParser.DotSlice);
						this.state = 2284;
						this.match(SolidCashParser.T__48);
						this.state = 2285;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2286;
						this.match(SolidCashParser.T__4);
						this.state = 2287;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2288;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2290;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2291;
						this.match(SolidCashParser.T__11);
						this.state = 2292;
						this.match(SolidCashParser.Identifier);
						this.state = 2294;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2293;
							this.callOptions();
							}
						}

						this.state = 2296;
						this.match(SolidCashParser.T__48);
						this.state = 2297;
						this.match(SolidCashParser.T__3);
						this.state = 2309;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===180) {
							{
							this.state = 2298;
							this.namedArg();
							this.state = 2303;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 261, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2299;
									this.match(SolidCashParser.T__4);
									this.state = 2300;
									this.namedArg();
									}
									}
								}
								this.state = 2305;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 261, this._ctx);
							}
							this.state = 2307;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2306;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2311;
						this.match(SolidCashParser.T__5);
						this.state = 2312;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 20:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2313;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2314;
						this.match(SolidCashParser.T__11);
						this.state = 2315;
						this.match(SolidCashParser.Identifier);
						this.state = 2317;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2316;
							this.callOptions();
							}
						}

						this.state = 2319;
						this.expressionList();
						}
						break;
					case 21:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2320;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2321;
						this.memberName();
						}
						break;
					case 22:
						{
						localctx = new PostfixOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2322;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2323;
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
				this.state = 2328;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 266, this._ctx);
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
		this.enterRule(localctx, 240, SolidCashParser.RULE_memberName);
		try {
			this.state = 2342;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2329;
				this.match(SolidCashParser.T__11);
				this.state = 2330;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2331;
				this.match(SolidCashParser.DotValue);
				}
				break;
			case 172:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2332;
				this.match(SolidCashParser.DotLockingBytecode);
				}
				break;
			case 173:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2333;
				this.match(SolidCashParser.DotTokenCategory);
				}
				break;
			case 174:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2334;
				this.match(SolidCashParser.DotNftCommitment);
				}
				break;
			case 175:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2335;
				this.match(SolidCashParser.DotTokenAmount);
				}
				break;
			case 176:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2336;
				this.match(SolidCashParser.DotOutpointTransactionHash);
				}
				break;
			case 177:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2337;
				this.match(SolidCashParser.DotOutpointIndex);
				}
				break;
			case 178:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2338;
				this.match(SolidCashParser.DotUnlockingBytecode);
				}
				break;
			case 179:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2339;
				this.match(SolidCashParser.DotSequenceNumber);
				}
				break;
			case 170:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2340;
				this.match(SolidCashParser.DotCode);
				}
				break;
			case 171:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2341;
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
		this.enterRule(localctx, 242, SolidCashParser.RULE_modifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2344;
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
		this.enterRule(localctx, 244, SolidCashParser.RULE_literal);
		try {
			let _alt: number;
			this.state = 2360;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 141:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2346;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 145:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2347;
				this.numberLiteral();
				}
				break;
			case 144:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2348;
				this.decimalLiteral();
				}
				break;
			case 151:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2349;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2353;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 268, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2350;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2355;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 268, this._ctx);
				}
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2356;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2357;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 152:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2358;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 153:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2359;
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
		this.enterRule(localctx, 246, SolidCashParser.RULE_numberLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2362;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2364;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 270, this._ctx) ) {
			case 1:
				{
				this.state = 2363;
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
		this.enterRule(localctx, 248, SolidCashParser.RULE_decimalLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2366;
			this.match(SolidCashParser.DecimalLiteral);
			this.state = 2368;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 271, this._ctx) ) {
			case 1:
				{
				this.state = 2367;
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
		this.enterRule(localctx, 250, SolidCashParser.RULE_typeName);
		let _la: number;
		try {
			let _alt: number;
			this.state = 2420;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 277, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2370;
				this.match(SolidCashParser.T__107);
				this.state = 2371;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2372;
				this.match(SolidCashParser.T__107);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2373;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2374;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2375;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2376;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2377;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2378;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2379;
				this.match(SolidCashParser.T__137);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2380;
				this.match(SolidCashParser.T__138);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2381;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2382;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2383;
				this.match(SolidCashParser.T__6);
				this.state = 2384;
				this.match(SolidCashParser.T__48);
				this.state = 2393;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 2385;
					this.typeName();
					this.state = 2390;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2386;
						this.match(SolidCashParser.T__4);
						this.state = 2387;
						this.typeName();
						}
						}
						this.state = 2392;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2395;
				this.match(SolidCashParser.T__49);
				this.state = 2399;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 274, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2396;
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
					this.state = 2401;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 274, this._ctx);
				}
				this.state = 2414;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===73) {
					{
					this.state = 2402;
					this.match(SolidCashParser.T__72);
					this.state = 2403;
					this.match(SolidCashParser.T__48);
					this.state = 2404;
					this.typeName();
					this.state = 2409;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2405;
						this.match(SolidCashParser.T__4);
						this.state = 2406;
						this.typeName();
						}
						}
						this.state = 2411;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2412;
					this.match(SolidCashParser.T__49);
					}
				}

				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2416;
				this.match(SolidCashParser.Identifier);
				this.state = 2417;
				this.match(SolidCashParser.T__11);
				this.state = 2418;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 2419;
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
		this.enterRule(localctx, 252, SolidCashParser.RULE_typeCast);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2422;
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
		case 119:
			return this.expression_sempred(localctx as ExpressionContext, predIndex);
		}
		return true;
	}
	private arrayType_sempred(localctx: ArrayTypeContext, predIndex: number): boolean {
		switch (predIndex) {
		case 0:
			return this.precpred(this._ctx, 1);
		}
		return true;
	}
	private expression_sempred(localctx: ExpressionContext, predIndex: number): boolean {
		switch (predIndex) {
		case 1:
			return this.precpred(this._ctx, 20);
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
			return this.precpred(this._ctx, 34);
		case 14:
			return this.precpred(this._ctx, 33);
		case 15:
			return this.precpred(this._ctx, 32);
		case 16:
			return this.precpred(this._ctx, 29);
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
		}
		return true;
	}

	public static readonly _serializedATN: number[] = [4,1,183,2425,2,0,7,0,
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
	7,121,2,122,7,122,2,123,7,123,2,124,7,124,2,125,7,125,2,126,7,126,1,0,5,
	0,256,8,0,10,0,12,0,259,9,0,1,0,5,0,262,8,0,10,0,12,0,265,9,0,1,0,1,0,1,
	0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,5,0,278,8,0,10,0,12,0,281,9,0,1,0,1,0,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,5,1,298,8,1,10,1,12,
	1,301,9,1,1,1,3,1,304,8,1,1,1,1,1,1,1,1,1,1,1,3,1,311,8,1,1,2,1,2,1,2,3,
	2,316,8,2,1,3,1,3,1,3,1,3,5,3,322,8,3,10,3,12,3,325,9,3,1,3,3,3,328,8,3,
	1,3,1,3,5,3,332,8,3,10,3,12,3,335,9,3,1,3,1,3,1,4,1,4,1,4,1,4,1,4,1,4,1,
	4,3,4,346,8,4,1,4,3,4,349,8,4,1,4,1,4,1,4,1,4,1,4,1,4,5,4,357,8,4,10,4,
	12,4,360,9,4,1,4,3,4,363,8,4,1,4,1,4,1,4,1,4,1,4,1,4,3,4,371,8,4,1,4,3,
	4,374,8,4,1,4,1,4,3,4,378,8,4,1,5,1,5,1,5,3,5,383,8,5,1,5,1,5,3,5,387,8,
	5,1,6,1,6,1,7,1,7,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,5,8,401,8,8,10,8,12,8,
	404,9,8,1,8,3,8,407,8,8,1,9,1,9,1,10,4,10,412,8,10,11,10,12,10,413,1,10,
	3,10,417,8,10,1,11,3,11,420,8,11,1,11,1,11,1,12,1,12,1,13,1,13,1,13,1,13,
	1,13,1,13,5,13,432,8,13,10,13,12,13,435,9,13,3,13,437,8,13,1,13,1,13,1,
	13,1,13,1,13,1,13,1,13,1,13,1,13,5,13,448,8,13,10,13,12,13,451,9,13,1,13,
	1,13,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,3,14,465,8,14,1,
	15,1,15,1,15,1,15,1,15,1,16,1,16,1,17,1,17,1,17,1,17,5,17,478,8,17,10,17,
	12,17,481,9,17,1,17,3,17,484,8,17,1,17,1,17,1,18,1,18,1,18,1,18,1,18,1,
	18,1,18,1,18,1,18,1,18,1,18,1,18,5,18,500,8,18,10,18,12,18,503,9,18,1,18,
	1,18,1,19,3,19,508,8,19,1,19,1,19,1,19,3,19,513,8,19,1,19,1,19,1,19,1,19,
	5,19,519,8,19,10,19,12,19,522,9,19,3,19,524,8,19,1,19,1,19,1,19,1,19,1,
	19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,5,19,541,8,19,10,19,
	12,19,544,9,19,1,19,1,19,1,20,1,20,3,20,550,8,20,1,21,1,21,1,21,1,21,1,
	21,5,21,557,8,21,10,21,12,21,560,9,21,1,21,3,21,563,8,21,1,21,1,21,1,22,
	1,22,1,22,1,22,1,22,1,22,5,22,573,8,22,10,22,12,22,576,9,22,1,22,3,22,579,
	8,22,3,22,581,8,22,1,22,1,22,3,22,585,8,22,1,22,1,22,1,23,1,23,3,23,591,
	8,23,1,23,3,23,594,8,23,1,23,3,23,597,8,23,1,24,1,24,1,24,1,24,1,24,1,24,
	5,24,605,8,24,10,24,12,24,608,9,24,1,24,3,24,611,8,24,3,24,613,8,24,1,24,
	1,24,1,24,1,25,1,25,3,25,620,8,25,1,25,1,25,3,25,624,8,25,3,25,626,8,25,
	1,26,1,26,1,26,1,26,4,26,632,8,26,11,26,12,26,633,1,26,1,26,1,27,1,27,1,
	27,3,27,641,8,27,1,27,1,27,1,27,1,28,1,28,1,28,1,28,1,28,1,28,5,28,652,
	8,28,10,28,12,28,655,9,28,1,28,3,28,658,8,28,1,28,1,28,1,29,1,29,1,29,3,
	29,665,8,29,1,30,1,30,1,30,1,30,1,30,1,30,1,31,1,31,1,31,1,31,1,31,1,31,
	1,31,1,32,1,32,1,32,5,32,683,8,32,10,32,12,32,686,9,32,1,32,5,32,689,8,
	32,10,32,12,32,692,9,32,1,32,5,32,695,8,32,10,32,12,32,698,9,32,1,32,1,
	32,5,32,702,8,32,10,32,12,32,705,9,32,1,32,1,32,1,33,1,33,1,33,5,33,712,
	8,33,10,33,12,33,715,9,33,1,33,1,33,5,33,719,8,33,10,33,12,33,722,9,33,
	1,33,5,33,725,8,33,10,33,12,33,728,9,33,1,33,3,33,731,8,33,1,33,1,33,5,
	33,735,8,33,10,33,12,33,738,9,33,1,33,1,33,1,34,1,34,1,34,3,34,745,8,34,
	1,35,1,35,1,35,1,35,5,35,751,8,35,10,35,12,35,754,9,35,1,35,1,35,5,35,758,
	8,35,10,35,12,35,761,9,35,1,35,1,35,5,35,765,8,35,10,35,12,35,768,9,35,
	1,35,1,35,5,35,772,8,35,10,35,12,35,775,9,35,1,35,1,35,3,35,779,8,35,1,
	36,1,36,3,36,783,8,36,1,37,1,37,1,37,1,38,3,38,789,8,38,1,38,1,38,1,38,
	5,38,794,8,38,10,38,12,38,797,9,38,1,38,1,38,1,38,3,38,802,8,38,1,38,1,
	38,1,38,1,38,1,38,5,38,809,8,38,10,38,12,38,812,9,38,1,38,1,38,1,38,5,38,
	817,8,38,10,38,12,38,820,9,38,1,38,1,38,1,38,3,38,825,8,38,1,38,1,38,1,
	38,3,38,830,8,38,1,38,1,38,5,38,834,8,38,10,38,12,38,837,9,38,1,38,1,38,
	1,38,1,38,3,38,843,8,38,1,38,1,38,5,38,847,8,38,10,38,12,38,850,9,38,1,
	38,1,38,1,38,3,38,855,8,38,1,38,1,38,3,38,859,8,38,1,39,1,39,1,39,3,39,
	864,8,39,1,40,1,40,1,41,1,41,1,41,1,41,3,41,872,8,41,1,41,1,41,1,41,3,41,
	877,8,41,1,41,1,41,1,41,1,41,1,41,1,41,3,41,885,8,41,1,41,1,41,1,41,1,41,
	1,41,1,41,1,41,1,41,3,41,895,8,41,1,41,1,41,1,41,3,41,900,8,41,1,41,1,41,
	3,41,904,8,41,1,42,1,42,1,42,1,42,3,42,910,8,42,1,42,1,42,1,42,1,42,1,42,
	3,42,917,8,42,1,42,5,42,920,8,42,10,42,12,42,923,9,42,1,43,1,43,1,43,3,
	43,928,8,43,1,43,1,43,5,43,932,8,43,10,43,12,43,935,9,43,1,43,1,43,5,43,
	939,8,43,10,43,12,43,942,9,43,1,43,1,43,3,43,946,8,43,1,44,1,44,3,44,950,
	8,44,1,45,1,45,1,45,1,46,1,46,1,46,1,46,1,46,5,46,960,8,46,10,46,12,46,
	963,9,46,1,46,3,46,966,8,46,1,46,1,46,5,46,970,8,46,10,46,12,46,973,9,46,
	1,46,1,46,1,47,1,47,3,47,979,8,47,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,
	48,1,48,1,48,1,48,1,48,1,48,1,48,3,48,995,8,48,1,49,1,49,1,49,1,49,1,49,
	5,49,1002,8,49,10,49,12,49,1005,9,49,1,49,3,49,1008,8,49,1,50,1,50,1,50,
	1,50,3,50,1014,8,50,1,51,1,51,1,51,1,51,1,51,5,51,1021,8,51,10,51,12,51,
	1024,9,51,1,51,3,51,1027,8,51,1,51,1,51,1,52,1,52,5,52,1033,8,52,10,52,
	12,52,1036,9,52,1,52,3,52,1039,8,52,1,52,1,52,5,52,1043,8,52,10,52,12,52,
	1046,9,52,1,52,3,52,1049,8,52,1,52,1,52,5,52,1053,8,52,10,52,12,52,1056,
	9,52,1,52,3,52,1059,8,52,3,52,1061,8,52,1,53,1,53,1,53,1,53,5,53,1067,8,
	53,10,53,12,53,1070,9,53,1,53,3,53,1073,8,53,3,53,1075,8,53,1,53,1,53,1,
	54,1,54,5,54,1081,8,54,10,54,12,54,1084,9,54,1,54,3,54,1087,8,54,1,54,1,
	54,5,54,1091,8,54,10,54,12,54,1094,9,54,1,54,3,54,1097,8,54,1,54,1,54,5,
	54,1101,8,54,10,54,12,54,1104,9,54,1,54,3,54,1107,8,54,3,54,1109,8,54,1,
	55,1,55,5,55,1113,8,55,10,55,12,55,1116,9,55,1,55,1,55,3,55,1120,8,55,1,
	56,1,56,5,56,1124,8,56,10,56,12,56,1127,9,56,1,56,1,56,1,57,1,57,1,57,1,
	57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,
	1,57,1,57,1,57,1,57,1,57,3,57,1154,8,57,1,58,1,58,1,58,1,58,1,58,1,58,1,
	58,1,58,1,58,1,58,1,58,3,58,1167,8,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,
	1,58,1,58,3,58,1178,8,58,1,58,1,58,1,59,1,59,1,59,1,59,1,60,1,60,1,60,1,
	60,1,60,1,60,5,60,1192,8,60,10,60,12,60,1195,9,60,1,60,1,60,1,60,1,60,1,
	60,1,60,1,60,5,60,1204,8,60,10,60,12,60,1207,9,60,1,60,3,60,1210,8,60,1,
	60,1,60,1,60,3,60,1215,8,60,1,61,1,61,1,61,1,61,1,61,1,61,1,62,1,62,1,62,
	1,62,3,62,1227,8,62,1,62,1,62,1,62,1,62,1,62,5,62,1234,8,62,10,62,12,62,
	1237,9,62,1,62,3,62,1240,8,62,3,62,1242,8,62,1,62,1,62,1,62,1,62,1,62,1,
	62,1,62,3,62,1251,8,62,1,62,1,62,1,62,3,62,1256,8,62,1,63,1,63,5,63,1260,
	8,63,10,63,12,63,1263,9,63,1,63,1,63,1,63,1,63,1,63,1,63,3,63,1271,8,63,
	3,63,1273,8,63,1,63,1,63,1,63,1,63,5,63,1279,8,63,10,63,12,63,1282,9,63,
	1,63,1,63,1,63,3,63,1287,8,63,1,63,1,63,1,63,1,63,5,63,1293,8,63,10,63,
	12,63,1296,9,63,1,63,1,63,1,63,3,63,1301,8,63,1,63,1,63,3,63,1305,8,63,
	1,64,1,64,1,64,1,64,1,64,1,64,4,64,1313,8,64,11,64,12,64,1314,1,64,1,64,
	1,64,1,64,1,64,1,64,1,64,1,64,4,64,1325,8,64,11,64,12,64,1326,1,64,1,64,
	1,64,1,64,1,64,1,64,4,64,1335,8,64,11,64,12,64,1336,1,64,1,64,1,64,1,64,
	1,64,1,64,1,64,4,64,1346,8,64,11,64,12,64,1347,1,64,1,64,1,64,1,64,1,64,
	3,64,1355,8,64,1,65,1,65,5,65,1359,8,65,10,65,12,65,1362,9,65,1,65,1,65,
	1,65,1,65,5,65,1368,8,65,10,65,12,65,1371,9,65,1,65,1,65,1,65,1,65,3,65,
	1377,8,65,1,66,1,66,1,67,1,67,1,67,1,67,1,67,1,67,1,67,1,67,1,67,1,67,1,
	67,1,67,1,67,1,67,1,67,1,67,4,67,1397,8,67,11,67,12,67,1398,1,67,1,67,1,
	67,1,67,1,67,1,67,1,67,1,67,4,67,1409,8,67,11,67,12,67,1410,1,67,1,67,1,
	67,1,67,1,67,1,67,4,67,1419,8,67,11,67,12,67,1420,1,67,1,67,1,67,1,67,4,
	67,1427,8,67,11,67,12,67,1428,1,67,1,67,1,67,1,67,1,67,1,67,4,67,1437,8,
	67,11,67,12,67,1438,1,67,3,67,1442,8,67,1,68,1,68,1,68,1,68,1,68,1,68,1,
	68,3,68,1451,8,68,1,68,1,68,1,68,1,69,1,69,1,69,1,69,1,69,3,69,1461,8,69,
	1,69,1,69,1,69,1,70,1,70,1,70,1,70,1,70,1,70,1,70,3,70,1473,8,70,1,71,1,
	71,1,71,1,71,1,71,1,71,3,71,1481,8,71,1,72,1,72,1,72,1,72,1,72,1,72,1,72,
	1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,73,1,73,1,73,1,73,1,73,1,
	73,1,73,1,73,1,73,1,73,1,73,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,
	1,74,1,74,1,75,1,75,1,75,1,75,1,75,3,75,1526,8,75,1,75,1,75,1,75,1,76,1,
	76,5,76,1533,8,76,10,76,12,76,1536,9,76,1,76,1,76,1,76,3,76,1541,8,76,1,
	76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,4,76,1554,8,76,11,
	76,12,76,1555,1,76,1,76,1,76,1,76,1,76,1,76,4,76,1564,8,76,11,76,12,76,
	1565,1,76,1,76,1,76,3,76,1571,8,76,1,76,1,76,1,76,3,76,1576,8,76,1,77,3,
	77,1579,8,77,1,77,1,77,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,
	1,78,4,78,1594,8,78,11,78,12,78,1595,1,78,1,78,1,78,1,78,1,78,1,78,4,78,
	1604,8,78,11,78,12,78,1605,1,78,1,78,1,78,3,78,1611,8,78,3,78,1613,8,78,
	1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,80,1,80,1,80,1,80,1,80,1,80,1,
	81,1,81,1,81,1,81,1,82,1,82,3,82,1635,8,82,1,82,1,82,1,82,1,82,5,82,1641,
	8,82,10,82,12,82,1644,9,82,1,82,3,82,1647,8,82,1,82,1,82,1,83,1,83,5,83,
	1653,8,83,10,83,12,83,1656,9,83,1,83,1,83,1,84,1,84,1,84,1,84,1,84,1,84,
	1,84,1,84,1,84,1,84,1,84,1,84,1,84,3,84,1673,8,84,1,85,1,85,1,85,1,85,5,
	85,1679,8,85,10,85,12,85,1682,9,85,1,85,1,85,3,85,1686,8,85,1,86,1,86,1,
	86,5,86,1691,8,86,10,86,12,86,1694,9,86,1,86,1,86,1,86,1,87,1,87,1,87,1,
	87,1,88,1,88,1,88,4,88,1706,8,88,11,88,12,88,1707,1,88,3,88,1711,8,88,1,
	88,3,88,1714,8,88,1,89,1,89,1,89,1,89,1,90,1,90,1,90,1,91,1,91,1,91,1,91,
	1,91,1,91,1,92,1,92,1,92,1,92,1,92,1,92,5,92,1735,8,92,10,92,12,92,1738,
	9,92,3,92,1740,8,92,1,92,1,92,1,92,1,92,1,92,5,92,1747,8,92,10,92,12,92,
	1750,9,92,3,92,1752,8,92,1,92,1,92,1,93,1,93,1,93,3,93,1759,8,93,1,94,1,
	94,1,94,1,94,1,94,5,94,1766,8,94,10,94,12,94,1769,9,94,3,94,1771,8,94,1,
	94,1,94,1,95,1,95,1,96,1,96,1,96,1,96,5,96,1781,8,96,10,96,12,96,1784,9,
	96,1,97,1,97,1,98,1,98,1,98,5,98,1791,8,98,10,98,12,98,1794,9,98,1,98,1,
	98,1,99,1,99,1,99,1,99,1,99,1,99,5,99,1804,8,99,10,99,12,99,1807,9,99,1,
	99,3,99,1810,8,99,1,99,1,99,1,100,1,100,1,100,1,100,5,100,1818,8,100,10,
	100,12,100,1821,9,100,1,101,1,101,1,101,5,101,1826,8,101,10,101,12,101,
	1829,9,101,1,102,1,102,1,102,3,102,1834,8,102,1,102,1,102,4,102,1838,8,
	102,11,102,12,102,1839,1,103,1,103,1,103,1,103,1,103,5,103,1847,8,103,10,
	103,12,103,1850,9,103,1,103,3,103,1853,8,103,3,103,1855,8,103,1,103,1,103,
	1,104,1,104,3,104,1861,8,104,1,104,1,104,1,104,1,104,5,104,1867,8,104,10,
	104,12,104,1870,9,104,1,104,3,104,1873,8,104,3,104,1875,8,104,1,104,3,104,
	1878,8,104,1,104,1,104,1,105,1,105,1,105,1,106,1,106,1,106,1,107,1,107,
	1,107,3,107,1891,8,107,1,108,1,108,1,108,1,108,3,108,1897,8,108,1,108,1,
	108,1,108,1,108,1,108,5,108,1904,8,108,10,108,12,108,1907,9,108,1,108,3,
	108,1910,8,108,3,108,1912,8,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,
	3,108,1921,8,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,
	1,108,1,108,1,108,3,108,1935,8,108,1,109,1,109,1,109,1,109,1,109,1,109,
	1,110,1,110,3,110,1945,8,110,1,111,1,111,1,111,1,111,5,111,1951,8,111,10,
	111,12,111,1954,9,111,1,111,3,111,1957,8,111,3,111,1959,8,111,1,111,1,111,
	1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,1,112,
	5,112,1975,8,112,10,112,12,112,1978,9,112,1,112,3,112,1981,8,112,3,112,
	1983,8,112,1,112,1,112,3,112,1987,8,112,1,113,1,113,1,113,1,113,1,114,1,
	114,1,114,1,114,5,114,1997,8,114,10,114,12,114,2000,9,114,1,114,3,114,2003,
	8,114,3,114,2005,8,114,1,114,1,114,1,115,1,115,1,115,1,115,5,115,2013,8,
	115,10,115,12,115,2016,9,115,1,115,3,115,2019,8,115,1,115,1,115,1,116,1,
	116,1,116,1,116,1,117,1,117,1,117,1,117,5,117,2031,8,117,10,117,12,117,
	2034,9,117,1,117,3,117,2037,8,117,1,117,1,117,1,118,1,118,3,118,2043,8,
	118,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,
	119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,4,119,2067,
	8,119,11,119,12,119,2068,1,119,1,119,1,119,1,119,1,119,1,119,3,119,2077,
	8,119,1,119,1,119,1,119,1,119,1,119,1,119,3,119,2085,8,119,1,119,1,119,
	1,119,1,119,1,119,4,119,2092,8,119,11,119,12,119,2093,1,119,1,119,1,119,
	1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,
	1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,
	1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,
	1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,
	1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,
	1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,
	1,119,1,119,1,119,1,119,1,119,5,119,2176,8,119,10,119,12,119,2179,9,119,
	1,119,3,119,2182,8,119,3,119,2184,8,119,1,119,1,119,1,119,1,119,1,119,1,
	119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,
	119,4,119,2204,8,119,11,119,12,119,2205,1,119,1,119,1,119,1,119,1,119,1,
	119,1,119,3,119,2215,8,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,
	119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,
	119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,
	119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,3,119,2259,
	8,119,1,119,1,119,3,119,2263,8,119,1,119,1,119,1,119,1,119,1,119,1,119,
	1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,
	1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,
	3,119,2295,8,119,1,119,1,119,1,119,1,119,1,119,5,119,2302,8,119,10,119,
	12,119,2305,9,119,1,119,3,119,2308,8,119,3,119,2310,8,119,1,119,1,119,1,
	119,1,119,1,119,1,119,3,119,2318,8,119,1,119,1,119,1,119,1,119,1,119,5,
	119,2325,8,119,10,119,12,119,2328,9,119,1,120,1,120,1,120,1,120,1,120,1,
	120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,3,120,2343,8,120,1,121,1,
	121,1,122,1,122,1,122,1,122,1,122,5,122,2352,8,122,10,122,12,122,2355,9,
	122,1,122,1,122,1,122,1,122,3,122,2361,8,122,1,123,1,123,3,123,2365,8,123,
	1,124,1,124,3,124,2369,8,124,1,125,1,125,1,125,1,125,1,125,1,125,1,125,
	1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,5,125,
	2389,8,125,10,125,12,125,2392,9,125,3,125,2394,8,125,1,125,1,125,5,125,
	2398,8,125,10,125,12,125,2401,9,125,1,125,1,125,1,125,1,125,1,125,5,125,
	2408,8,125,10,125,12,125,2411,9,125,1,125,1,125,3,125,2415,8,125,1,125,
	1,125,1,125,1,125,3,125,2421,8,125,1,126,1,126,1,126,0,2,84,238,127,0,2,
	4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,
	54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,
	102,104,106,108,110,112,114,116,118,120,122,124,126,128,130,132,134,136,
	138,140,142,144,146,148,150,152,154,156,158,160,162,164,166,168,170,172,
	174,176,178,180,182,184,186,188,190,192,194,196,198,200,202,204,206,208,
	210,212,214,216,218,220,222,224,226,228,230,232,234,236,238,240,242,244,
	246,248,250,252,0,27,2,0,10,10,13,27,5,0,11,11,28,36,143,143,147,147,180,
	180,5,0,38,38,140,140,145,145,151,151,180,180,1,0,38,39,2,0,140,140,144,
	144,3,0,20,23,26,27,40,40,1,0,43,44,2,0,43,44,58,59,3,0,43,44,58,58,63,
	63,2,0,40,40,74,83,1,0,84,85,6,0,31,31,36,36,86,86,108,108,149,149,180,
	180,5,0,141,141,145,145,151,151,153,153,162,162,2,0,89,89,180,180,2,0,163,
	163,172,175,2,0,163,163,172,179,3,0,14,14,27,27,127,127,2,0,10,10,15,16,
	1,0,13,14,1,0,128,129,1,0,20,23,1,0,18,19,2,0,126,126,164,164,3,0,33,33,
	56,56,133,137,1,0,142,143,3,0,44,44,58,59,70,71,5,0,59,59,108,108,138,139,
	146,149,155,159,2770,0,257,1,0,0,0,2,310,1,0,0,0,4,312,1,0,0,0,6,317,1,
	0,0,0,8,377,1,0,0,0,10,379,1,0,0,0,12,388,1,0,0,0,14,390,1,0,0,0,16,406,
	1,0,0,0,18,408,1,0,0,0,20,416,1,0,0,0,22,419,1,0,0,0,24,423,1,0,0,0,26,
	425,1,0,0,0,28,464,1,0,0,0,30,466,1,0,0,0,32,471,1,0,0,0,34,473,1,0,0,0,
	36,487,1,0,0,0,38,507,1,0,0,0,40,547,1,0,0,0,42,551,1,0,0,0,44,566,1,0,
	0,0,46,590,1,0,0,0,48,598,1,0,0,0,50,625,1,0,0,0,52,627,1,0,0,0,54,640,
	1,0,0,0,56,645,1,0,0,0,58,661,1,0,0,0,60,666,1,0,0,0,62,672,1,0,0,0,64,
	679,1,0,0,0,66,708,1,0,0,0,68,744,1,0,0,0,70,746,1,0,0,0,72,782,1,0,0,0,
	74,784,1,0,0,0,76,858,1,0,0,0,78,863,1,0,0,0,80,865,1,0,0,0,82,903,1,0,
	0,0,84,905,1,0,0,0,86,924,1,0,0,0,88,949,1,0,0,0,90,951,1,0,0,0,92,954,
	1,0,0,0,94,976,1,0,0,0,96,994,1,0,0,0,98,996,1,0,0,0,100,1009,1,0,0,0,102,
	1015,1,0,0,0,104,1060,1,0,0,0,106,1062,1,0,0,0,108,1108,1,0,0,0,110,1119,
	1,0,0,0,112,1121,1,0,0,0,114,1153,1,0,0,0,116,1155,1,0,0,0,118,1181,1,0,
	0,0,120,1214,1,0,0,0,122,1216,1,0,0,0,124,1255,1,0,0,0,126,1304,1,0,0,0,
	128,1354,1,0,0,0,130,1376,1,0,0,0,132,1378,1,0,0,0,134,1441,1,0,0,0,136,
	1443,1,0,0,0,138,1455,1,0,0,0,140,1465,1,0,0,0,142,1480,1,0,0,0,144,1482,
	1,0,0,0,146,1498,1,0,0,0,148,1509,1,0,0,0,150,1520,1,0,0,0,152,1575,1,0,
	0,0,154,1578,1,0,0,0,156,1612,1,0,0,0,158,1614,1,0,0,0,160,1622,1,0,0,0,
	162,1628,1,0,0,0,164,1632,1,0,0,0,166,1650,1,0,0,0,168,1672,1,0,0,0,170,
	1674,1,0,0,0,172,1687,1,0,0,0,174,1698,1,0,0,0,176,1702,1,0,0,0,178,1715,
	1,0,0,0,180,1719,1,0,0,0,182,1722,1,0,0,0,184,1728,1,0,0,0,186,1758,1,0,
	0,0,188,1760,1,0,0,0,190,1774,1,0,0,0,192,1776,1,0,0,0,194,1785,1,0,0,0,
	196,1787,1,0,0,0,198,1797,1,0,0,0,200,1813,1,0,0,0,202,1822,1,0,0,0,204,
	1830,1,0,0,0,206,1841,1,0,0,0,208,1858,1,0,0,0,210,1881,1,0,0,0,212,1884,
	1,0,0,0,214,1890,1,0,0,0,216,1934,1,0,0,0,218,1936,1,0,0,0,220,1944,1,0,
	0,0,222,1946,1,0,0,0,224,1986,1,0,0,0,226,1988,1,0,0,0,228,1992,1,0,0,0,
	230,2008,1,0,0,0,232,2022,1,0,0,0,234,2026,1,0,0,0,236,2042,1,0,0,0,238,
	2214,1,0,0,0,240,2342,1,0,0,0,242,2344,1,0,0,0,244,2360,1,0,0,0,246,2362,
	1,0,0,0,248,2366,1,0,0,0,250,2420,1,0,0,0,252,2422,1,0,0,0,254,256,3,16,
	8,0,255,254,1,0,0,0,256,259,1,0,0,0,257,255,1,0,0,0,257,258,1,0,0,0,258,
	263,1,0,0,0,259,257,1,0,0,0,260,262,3,2,1,0,261,260,1,0,0,0,262,265,1,0,
	0,0,263,261,1,0,0,0,263,264,1,0,0,0,264,279,1,0,0,0,265,263,1,0,0,0,266,
	278,3,62,31,0,267,278,3,56,28,0,268,278,3,52,26,0,269,278,3,60,30,0,270,
	278,3,8,4,0,271,278,3,48,24,0,272,278,3,44,22,0,273,278,3,26,13,0,274,278,
	3,6,3,0,275,278,3,36,18,0,276,278,3,38,19,0,277,266,1,0,0,0,277,267,1,0,
	0,0,277,268,1,0,0,0,277,269,1,0,0,0,277,270,1,0,0,0,277,271,1,0,0,0,277,
	272,1,0,0,0,277,273,1,0,0,0,277,274,1,0,0,0,277,275,1,0,0,0,277,276,1,0,
	0,0,278,281,1,0,0,0,279,277,1,0,0,0,279,280,1,0,0,0,280,282,1,0,0,0,281,
	279,1,0,0,0,282,283,5,0,0,1,283,1,1,0,0,0,284,285,5,1,0,0,285,286,5,151,
	0,0,286,311,5,2,0,0,287,288,5,1,0,0,288,289,5,151,0,0,289,290,5,3,0,0,290,
	291,5,180,0,0,291,311,5,2,0,0,292,293,5,1,0,0,293,294,5,4,0,0,294,299,3,
	4,2,0,295,296,5,5,0,0,296,298,3,4,2,0,297,295,1,0,0,0,298,301,1,0,0,0,299,
	297,1,0,0,0,299,300,1,0,0,0,300,303,1,0,0,0,301,299,1,0,0,0,302,304,5,5,
	0,0,303,302,1,0,0,0,303,304,1,0,0,0,304,305,1,0,0,0,305,306,5,6,0,0,306,
	307,5,180,0,0,307,308,5,151,0,0,308,309,5,2,0,0,309,311,1,0,0,0,310,284,
	1,0,0,0,310,287,1,0,0,0,310,292,1,0,0,0,311,3,1,0,0,0,312,315,5,180,0,0,
	313,314,5,3,0,0,314,316,5,180,0,0,315,313,1,0,0,0,315,316,1,0,0,0,316,5,
	1,0,0,0,317,318,5,7,0,0,318,319,3,14,7,0,319,323,3,106,53,0,320,322,3,96,
	48,0,321,320,1,0,0,0,322,325,1,0,0,0,323,321,1,0,0,0,323,324,1,0,0,0,324,
	327,1,0,0,0,325,323,1,0,0,0,326,328,3,102,51,0,327,326,1,0,0,0,327,328,
	1,0,0,0,328,329,1,0,0,0,329,333,5,4,0,0,330,332,3,114,57,0,331,330,1,0,
	0,0,332,335,1,0,0,0,333,331,1,0,0,0,333,334,1,0,0,0,334,336,1,0,0,0,335,
	333,1,0,0,0,336,337,5,6,0,0,337,7,1,0,0,0,338,339,5,8,0,0,339,340,5,180,
	0,0,340,345,5,9,0,0,341,346,3,84,42,0,342,346,3,82,41,0,343,346,3,250,125,
	0,344,346,5,10,0,0,345,341,1,0,0,0,345,342,1,0,0,0,345,343,1,0,0,0,345,
	344,1,0,0,0,346,348,1,0,0,0,347,349,5,11,0,0,348,347,1,0,0,0,348,349,1,
	0,0,0,349,350,1,0,0,0,350,378,5,2,0,0,351,352,5,8,0,0,352,353,5,4,0,0,353,
	358,3,10,5,0,354,355,5,5,0,0,355,357,3,10,5,0,356,354,1,0,0,0,357,360,1,
	0,0,0,358,356,1,0,0,0,358,359,1,0,0,0,359,362,1,0,0,0,360,358,1,0,0,0,361,
	363,5,5,0,0,362,361,1,0,0,0,362,363,1,0,0,0,363,364,1,0,0,0,364,365,5,6,
	0,0,365,370,5,9,0,0,366,371,3,84,42,0,367,371,3,82,41,0,368,371,3,250,125,
	0,369,371,5,10,0,0,370,366,1,0,0,0,370,367,1,0,0,0,370,368,1,0,0,0,370,
	369,1,0,0,0,371,373,1,0,0,0,372,374,5,11,0,0,373,372,1,0,0,0,373,374,1,
	0,0,0,374,375,1,0,0,0,375,376,5,2,0,0,376,378,1,0,0,0,377,338,1,0,0,0,377,
	351,1,0,0,0,378,9,1,0,0,0,379,382,5,180,0,0,380,381,5,12,0,0,381,383,5,
	180,0,0,382,380,1,0,0,0,382,383,1,0,0,0,383,386,1,0,0,0,384,385,5,3,0,0,
	385,387,3,12,6,0,386,384,1,0,0,0,386,387,1,0,0,0,387,11,1,0,0,0,388,389,
	7,0,0,0,389,13,1,0,0,0,390,391,7,1,0,0,391,15,1,0,0,0,392,393,5,37,0,0,
	393,394,3,18,9,0,394,395,3,20,10,0,395,396,5,2,0,0,396,407,1,0,0,0,397,
	398,5,37,0,0,398,402,5,180,0,0,399,401,7,2,0,0,400,399,1,0,0,0,401,404,
	1,0,0,0,402,400,1,0,0,0,402,403,1,0,0,0,403,405,1,0,0,0,404,402,1,0,0,0,
	405,407,5,2,0,0,406,392,1,0,0,0,406,397,1,0,0,0,407,17,1,0,0,0,408,409,
	7,3,0,0,409,19,1,0,0,0,410,412,3,22,11,0,411,410,1,0,0,0,412,413,1,0,0,
	0,413,411,1,0,0,0,413,414,1,0,0,0,414,417,1,0,0,0,415,417,5,10,0,0,416,
	411,1,0,0,0,416,415,1,0,0,0,417,21,1,0,0,0,418,420,3,24,12,0,419,418,1,
	0,0,0,419,420,1,0,0,0,420,421,1,0,0,0,421,422,7,4,0,0,422,23,1,0,0,0,423,
	424,7,5,0,0,424,25,1,0,0,0,425,426,5,41,0,0,426,436,5,180,0,0,427,428,5,
	42,0,0,428,433,5,180,0,0,429,430,5,5,0,0,430,432,5,180,0,0,431,429,1,0,
	0,0,432,435,1,0,0,0,433,431,1,0,0,0,433,434,1,0,0,0,434,437,1,0,0,0,435,
	433,1,0,0,0,436,427,1,0,0,0,436,437,1,0,0,0,437,438,1,0,0,0,438,449,5,4,
	0,0,439,448,3,56,28,0,440,448,3,52,26,0,441,448,3,60,30,0,442,448,3,44,
	22,0,443,448,3,48,24,0,444,448,3,30,15,0,445,448,3,28,14,0,446,448,3,34,
	17,0,447,439,1,0,0,0,447,440,1,0,0,0,447,441,1,0,0,0,447,442,1,0,0,0,447,
	443,1,0,0,0,447,444,1,0,0,0,447,445,1,0,0,0,447,446,1,0,0,0,448,451,1,0,
	0,0,449,447,1,0,0,0,449,450,1,0,0,0,450,452,1,0,0,0,451,449,1,0,0,0,452,
	453,5,6,0,0,453,27,1,0,0,0,454,455,3,32,16,0,455,456,3,82,41,0,456,457,
	5,180,0,0,457,458,5,2,0,0,458,465,1,0,0,0,459,460,3,32,16,0,460,461,3,84,
	42,0,461,462,5,180,0,0,462,463,5,2,0,0,463,465,1,0,0,0,464,454,1,0,0,0,
	464,459,1,0,0,0,465,29,1,0,0,0,466,467,3,32,16,0,467,468,3,250,125,0,468,
	469,5,180,0,0,469,470,5,2,0,0,470,31,1,0,0,0,471,472,7,6,0,0,472,33,1,0,
	0,0,473,474,5,7,0,0,474,475,5,180,0,0,475,479,3,106,53,0,476,478,3,96,48,
	0,477,476,1,0,0,0,478,481,1,0,0,0,479,477,1,0,0,0,479,480,1,0,0,0,480,483,
	1,0,0,0,481,479,1,0,0,0,482,484,3,102,51,0,483,482,1,0,0,0,483,484,1,0,
	0,0,484,485,1,0,0,0,485,486,5,2,0,0,486,35,1,0,0,0,487,488,5,45,0,0,488,
	489,5,180,0,0,489,501,5,4,0,0,490,500,3,56,28,0,491,500,3,52,26,0,492,500,
	3,60,30,0,493,500,3,44,22,0,494,500,3,48,24,0,495,500,3,62,31,0,496,500,
	3,76,38,0,497,500,3,8,4,0,498,500,3,6,3,0,499,490,1,0,0,0,499,491,1,0,0,
	0,499,492,1,0,0,0,499,493,1,0,0,0,499,494,1,0,0,0,499,495,1,0,0,0,499,496,
	1,0,0,0,499,497,1,0,0,0,499,498,1,0,0,0,500,503,1,0,0,0,501,499,1,0,0,0,
	501,502,1,0,0,0,502,504,1,0,0,0,503,501,1,0,0,0,504,505,5,6,0,0,505,37,
	1,0,0,0,506,508,5,46,0,0,507,506,1,0,0,0,507,508,1,0,0,0,508,509,1,0,0,
	0,509,510,5,47,0,0,510,512,5,180,0,0,511,513,3,106,53,0,512,511,1,0,0,0,
	512,513,1,0,0,0,513,523,1,0,0,0,514,515,5,42,0,0,515,520,3,40,20,0,516,
	517,5,5,0,0,517,519,3,40,20,0,518,516,1,0,0,0,519,522,1,0,0,0,520,518,1,
	0,0,0,520,521,1,0,0,0,521,524,1,0,0,0,522,520,1,0,0,0,523,514,1,0,0,0,523,
	524,1,0,0,0,524,525,1,0,0,0,525,542,5,4,0,0,526,541,3,56,28,0,527,541,3,
	52,26,0,528,541,3,60,30,0,529,541,3,44,22,0,530,541,3,48,24,0,531,541,3,
	62,31,0,532,541,3,8,4,0,533,541,3,76,38,0,534,541,3,86,43,0,535,541,3,64,
	32,0,536,541,3,92,46,0,537,541,3,42,21,0,538,541,3,66,33,0,539,541,3,70,
	35,0,540,526,1,0,0,0,540,527,1,0,0,0,540,528,1,0,0,0,540,529,1,0,0,0,540,
	530,1,0,0,0,540,531,1,0,0,0,540,532,1,0,0,0,540,533,1,0,0,0,540,534,1,0,
	0,0,540,535,1,0,0,0,540,536,1,0,0,0,540,537,1,0,0,0,540,538,1,0,0,0,540,
	539,1,0,0,0,541,544,1,0,0,0,542,540,1,0,0,0,542,543,1,0,0,0,543,545,1,0,
	0,0,544,542,1,0,0,0,545,546,5,6,0,0,546,39,1,0,0,0,547,549,5,180,0,0,548,
	550,3,228,114,0,549,548,1,0,0,0,549,550,1,0,0,0,550,41,1,0,0,0,551,552,
	5,7,0,0,552,553,3,14,7,0,553,558,3,106,53,0,554,557,3,96,48,0,555,557,3,
	94,47,0,556,554,1,0,0,0,556,555,1,0,0,0,557,560,1,0,0,0,558,556,1,0,0,0,
	558,559,1,0,0,0,559,562,1,0,0,0,560,558,1,0,0,0,561,563,3,102,51,0,562,
	561,1,0,0,0,562,563,1,0,0,0,563,564,1,0,0,0,564,565,5,2,0,0,565,43,1,0,
	0,0,566,567,5,48,0,0,567,568,5,180,0,0,568,580,5,49,0,0,569,574,3,46,23,
	0,570,571,5,5,0,0,571,573,3,46,23,0,572,570,1,0,0,0,573,576,1,0,0,0,574,
	572,1,0,0,0,574,575,1,0,0,0,575,578,1,0,0,0,576,574,1,0,0,0,577,579,5,5,
	0,0,578,577,1,0,0,0,578,579,1,0,0,0,579,581,1,0,0,0,580,569,1,0,0,0,580,
	581,1,0,0,0,581,582,1,0,0,0,582,584,5,50,0,0,583,585,5,51,0,0,584,583,1,
	0,0,0,584,585,1,0,0,0,585,586,1,0,0,0,586,587,5,2,0,0,587,45,1,0,0,0,588,
	591,3,250,125,0,589,591,3,84,42,0,590,588,1,0,0,0,590,589,1,0,0,0,591,593,
	1,0,0,0,592,594,5,52,0,0,593,592,1,0,0,0,593,594,1,0,0,0,594,596,1,0,0,
	0,595,597,5,180,0,0,596,595,1,0,0,0,596,597,1,0,0,0,597,47,1,0,0,0,598,
	599,5,35,0,0,599,600,5,180,0,0,600,612,5,49,0,0,601,606,3,50,25,0,602,603,
	5,5,0,0,603,605,3,50,25,0,604,602,1,0,0,0,605,608,1,0,0,0,606,604,1,0,0,
	0,606,607,1,0,0,0,607,610,1,0,0,0,608,606,1,0,0,0,609,611,5,5,0,0,610,609,
	1,0,0,0,610,611,1,0,0,0,611,613,1,0,0,0,612,601,1,0,0,0,612,613,1,0,0,0,
	613,614,1,0,0,0,614,615,5,50,0,0,615,616,5,2,0,0,616,49,1,0,0,0,617,619,
	3,250,125,0,618,620,5,180,0,0,619,618,1,0,0,0,619,620,1,0,0,0,620,626,1,
	0,0,0,621,623,3,84,42,0,622,624,5,180,0,0,623,622,1,0,0,0,623,624,1,0,0,
	0,624,626,1,0,0,0,625,617,1,0,0,0,625,621,1,0,0,0,626,51,1,0,0,0,627,628,
	5,53,0,0,628,629,5,180,0,0,629,631,5,4,0,0,630,632,3,54,27,0,631,630,1,
	0,0,0,632,633,1,0,0,0,633,631,1,0,0,0,633,634,1,0,0,0,634,635,1,0,0,0,635,
	636,5,6,0,0,636,53,1,0,0,0,637,641,3,250,125,0,638,641,3,84,42,0,639,641,
	3,82,41,0,640,637,1,0,0,0,640,638,1,0,0,0,640,639,1,0,0,0,641,642,1,0,0,
	0,642,643,3,14,7,0,643,644,5,2,0,0,644,55,1,0,0,0,645,646,5,54,0,0,646,
	647,5,180,0,0,647,648,5,4,0,0,648,653,3,58,29,0,649,650,5,5,0,0,650,652,
	3,58,29,0,651,649,1,0,0,0,652,655,1,0,0,0,653,651,1,0,0,0,653,654,1,0,0,
	0,654,657,1,0,0,0,655,653,1,0,0,0,656,658,5,5,0,0,657,656,1,0,0,0,657,658,
	1,0,0,0,658,659,1,0,0,0,659,660,5,6,0,0,660,57,1,0,0,0,661,664,5,180,0,
	0,662,663,5,40,0,0,663,665,5,145,0,0,664,662,1,0,0,0,664,665,1,0,0,0,665,
	59,1,0,0,0,666,667,5,55,0,0,667,668,5,180,0,0,668,669,5,42,0,0,669,670,
	3,250,125,0,670,671,5,2,0,0,671,61,1,0,0,0,672,673,3,250,125,0,673,674,
	5,56,0,0,674,675,5,180,0,0,675,676,5,40,0,0,676,677,3,238,119,0,677,678,
	5,2,0,0,678,63,1,0,0,0,679,680,5,57,0,0,680,684,3,106,53,0,681,683,7,7,
	0,0,682,681,1,0,0,0,683,686,1,0,0,0,684,682,1,0,0,0,684,685,1,0,0,0,685,
	690,1,0,0,0,686,684,1,0,0,0,687,689,3,74,37,0,688,687,1,0,0,0,689,692,1,
	0,0,0,690,688,1,0,0,0,690,691,1,0,0,0,691,696,1,0,0,0,692,690,1,0,0,0,693,
	695,3,94,47,0,694,693,1,0,0,0,695,698,1,0,0,0,696,694,1,0,0,0,696,697,1,
	0,0,0,697,699,1,0,0,0,698,696,1,0,0,0,699,703,5,4,0,0,700,702,3,114,57,
	0,701,700,1,0,0,0,702,705,1,0,0,0,703,701,1,0,0,0,703,704,1,0,0,0,704,706,
	1,0,0,0,705,703,1,0,0,0,706,707,5,6,0,0,707,65,1,0,0,0,708,709,5,60,0,0,
	709,713,3,106,53,0,710,712,3,68,34,0,711,710,1,0,0,0,712,715,1,0,0,0,713,
	711,1,0,0,0,713,714,1,0,0,0,714,716,1,0,0,0,715,713,1,0,0,0,716,720,5,44,
	0,0,717,719,3,68,34,0,718,717,1,0,0,0,719,722,1,0,0,0,720,718,1,0,0,0,720,
	721,1,0,0,0,721,726,1,0,0,0,722,720,1,0,0,0,723,725,3,94,47,0,724,723,1,
	0,0,0,725,728,1,0,0,0,726,724,1,0,0,0,726,727,1,0,0,0,727,730,1,0,0,0,728,
	726,1,0,0,0,729,731,3,102,51,0,730,729,1,0,0,0,730,731,1,0,0,0,731,732,
	1,0,0,0,732,736,5,4,0,0,733,735,3,114,57,0,734,733,1,0,0,0,735,738,1,0,
	0,0,736,734,1,0,0,0,736,737,1,0,0,0,737,739,1,0,0,0,738,736,1,0,0,0,739,
	740,5,6,0,0,740,67,1,0,0,0,741,745,5,59,0,0,742,745,5,61,0,0,743,745,3,
	98,49,0,744,741,1,0,0,0,744,742,1,0,0,0,744,743,1,0,0,0,745,69,1,0,0,0,
	746,747,5,62,0,0,747,748,5,49,0,0,748,752,5,50,0,0,749,751,3,72,36,0,750,
	749,1,0,0,0,751,754,1,0,0,0,752,750,1,0,0,0,752,753,1,0,0,0,753,755,1,0,
	0,0,754,752,1,0,0,0,755,759,5,44,0,0,756,758,3,72,36,0,757,756,1,0,0,0,
	758,761,1,0,0,0,759,757,1,0,0,0,759,760,1,0,0,0,760,762,1,0,0,0,761,759,
	1,0,0,0,762,766,5,59,0,0,763,765,3,72,36,0,764,763,1,0,0,0,765,768,1,0,
	0,0,766,764,1,0,0,0,766,767,1,0,0,0,767,778,1,0,0,0,768,766,1,0,0,0,769,
	773,5,4,0,0,770,772,3,114,57,0,771,770,1,0,0,0,772,775,1,0,0,0,773,771,
	1,0,0,0,773,774,1,0,0,0,774,776,1,0,0,0,775,773,1,0,0,0,776,779,5,6,0,0,
	777,779,5,2,0,0,778,769,1,0,0,0,778,777,1,0,0,0,779,71,1,0,0,0,780,783,
	5,61,0,0,781,783,3,98,49,0,782,780,1,0,0,0,782,781,1,0,0,0,783,73,1,0,0,
	0,784,785,5,180,0,0,785,786,3,228,114,0,786,75,1,0,0,0,787,789,3,80,40,
	0,788,787,1,0,0,0,788,789,1,0,0,0,789,790,1,0,0,0,790,795,3,250,125,0,791,
	794,3,242,121,0,792,794,3,98,49,0,793,791,1,0,0,0,793,792,1,0,0,0,794,797,
	1,0,0,0,795,793,1,0,0,0,795,796,1,0,0,0,796,798,1,0,0,0,797,795,1,0,0,0,
	798,801,5,180,0,0,799,800,5,40,0,0,800,802,3,238,119,0,801,799,1,0,0,0,
	801,802,1,0,0,0,802,803,1,0,0,0,803,804,5,2,0,0,804,859,1,0,0,0,805,810,
	3,250,125,0,806,809,3,242,121,0,807,809,3,98,49,0,808,806,1,0,0,0,808,807,
	1,0,0,0,809,812,1,0,0,0,810,808,1,0,0,0,810,811,1,0,0,0,811,813,1,0,0,0,
	812,810,1,0,0,0,813,818,3,80,40,0,814,817,3,242,121,0,815,817,3,98,49,0,
	816,814,1,0,0,0,816,815,1,0,0,0,817,820,1,0,0,0,818,816,1,0,0,0,818,819,
	1,0,0,0,819,821,1,0,0,0,820,818,1,0,0,0,821,824,5,180,0,0,822,823,5,40,
	0,0,823,825,3,238,119,0,824,822,1,0,0,0,824,825,1,0,0,0,825,826,1,0,0,0,
	826,827,5,2,0,0,827,859,1,0,0,0,828,830,3,80,40,0,829,828,1,0,0,0,829,830,
	1,0,0,0,830,831,1,0,0,0,831,835,3,82,41,0,832,834,3,78,39,0,833,832,1,0,
	0,0,834,837,1,0,0,0,835,833,1,0,0,0,835,836,1,0,0,0,836,838,1,0,0,0,837,
	835,1,0,0,0,838,839,5,180,0,0,839,840,5,2,0,0,840,859,1,0,0,0,841,843,3,
	80,40,0,842,841,1,0,0,0,842,843,1,0,0,0,843,844,1,0,0,0,844,848,3,84,42,
	0,845,847,3,78,39,0,846,845,1,0,0,0,847,850,1,0,0,0,848,846,1,0,0,0,848,
	849,1,0,0,0,849,851,1,0,0,0,850,848,1,0,0,0,851,854,5,180,0,0,852,853,5,
	40,0,0,853,855,3,238,119,0,854,852,1,0,0,0,854,855,1,0,0,0,855,856,1,0,
	0,0,856,857,5,2,0,0,857,859,1,0,0,0,858,788,1,0,0,0,858,805,1,0,0,0,858,
	829,1,0,0,0,858,842,1,0,0,0,859,77,1,0,0,0,860,864,3,242,121,0,861,864,
	3,80,40,0,862,864,3,98,49,0,863,860,1,0,0,0,863,861,1,0,0,0,863,862,1,0,
	0,0,864,79,1,0,0,0,865,866,7,8,0,0,866,81,1,0,0,0,867,868,5,64,0,0,868,
	869,5,49,0,0,869,871,3,250,125,0,870,872,5,180,0,0,871,870,1,0,0,0,871,
	872,1,0,0,0,872,873,1,0,0,0,873,874,5,65,0,0,874,876,3,250,125,0,875,877,
	5,180,0,0,876,875,1,0,0,0,876,877,1,0,0,0,877,878,1,0,0,0,878,879,5,50,
	0,0,879,904,1,0,0,0,880,881,5,64,0,0,881,882,5,49,0,0,882,884,3,250,125,
	0,883,885,5,180,0,0,884,883,1,0,0,0,884,885,1,0,0,0,885,886,1,0,0,0,886,
	887,5,65,0,0,887,888,3,82,41,0,888,889,5,50,0,0,889,904,1,0,0,0,890,891,
	5,64,0,0,891,892,5,49,0,0,892,894,3,250,125,0,893,895,5,180,0,0,894,893,
	1,0,0,0,894,895,1,0,0,0,895,896,1,0,0,0,896,897,5,65,0,0,897,899,3,84,42,
	0,898,900,5,180,0,0,899,898,1,0,0,0,899,900,1,0,0,0,900,901,1,0,0,0,901,
	902,5,50,0,0,902,904,1,0,0,0,903,867,1,0,0,0,903,880,1,0,0,0,903,890,1,
	0,0,0,904,83,1,0,0,0,905,906,6,42,-1,0,906,907,3,250,125,0,907,909,5,66,
	0,0,908,910,3,238,119,0,909,908,1,0,0,0,909,910,1,0,0,0,910,911,1,0,0,0,
	911,912,5,67,0,0,912,921,1,0,0,0,913,914,10,1,0,0,914,916,5,66,0,0,915,
	917,3,238,119,0,916,915,1,0,0,0,916,917,1,0,0,0,917,918,1,0,0,0,918,920,
	5,67,0,0,919,913,1,0,0,0,920,923,1,0,0,0,921,919,1,0,0,0,921,922,1,0,0,
	0,922,85,1,0,0,0,923,921,1,0,0,0,924,925,5,68,0,0,925,927,5,180,0,0,926,
	928,3,106,53,0,927,926,1,0,0,0,927,928,1,0,0,0,928,933,1,0,0,0,929,932,
	5,61,0,0,930,932,3,98,49,0,931,929,1,0,0,0,931,930,1,0,0,0,932,935,1,0,
	0,0,933,931,1,0,0,0,933,934,1,0,0,0,934,945,1,0,0,0,935,933,1,0,0,0,936,
	940,5,4,0,0,937,939,3,88,44,0,938,937,1,0,0,0,939,942,1,0,0,0,940,938,1,
	0,0,0,940,941,1,0,0,0,941,943,1,0,0,0,942,940,1,0,0,0,943,946,5,6,0,0,944,
	946,5,2,0,0,945,936,1,0,0,0,945,944,1,0,0,0,946,87,1,0,0,0,947,950,3,90,
	45,0,948,950,3,114,57,0,949,947,1,0,0,0,949,948,1,0,0,0,950,89,1,0,0,0,
	951,952,5,69,0,0,952,953,5,2,0,0,953,91,1,0,0,0,954,955,5,7,0,0,955,956,
	3,14,7,0,956,961,3,106,53,0,957,960,3,96,48,0,958,960,3,94,47,0,959,957,
	1,0,0,0,959,958,1,0,0,0,960,963,1,0,0,0,961,959,1,0,0,0,961,962,1,0,0,0,
	962,965,1,0,0,0,963,961,1,0,0,0,964,966,3,102,51,0,965,964,1,0,0,0,965,
	966,1,0,0,0,966,967,1,0,0,0,967,971,5,4,0,0,968,970,3,114,57,0,969,968,
	1,0,0,0,970,973,1,0,0,0,971,969,1,0,0,0,971,972,1,0,0,0,972,974,1,0,0,0,
	973,971,1,0,0,0,974,975,5,6,0,0,975,93,1,0,0,0,976,978,5,180,0,0,977,979,
	3,228,114,0,978,977,1,0,0,0,978,979,1,0,0,0,979,95,1,0,0,0,980,995,5,70,
	0,0,981,995,5,71,0,0,982,995,5,58,0,0,983,995,5,44,0,0,984,995,5,43,0,0,
	985,995,5,63,0,0,986,995,5,59,0,0,987,995,3,98,49,0,988,995,5,61,0,0,989,
	995,3,100,50,0,990,995,5,30,0,0,991,995,5,28,0,0,992,995,5,31,0,0,993,995,
	5,29,0,0,994,980,1,0,0,0,994,981,1,0,0,0,994,982,1,0,0,0,994,983,1,0,0,
	0,994,984,1,0,0,0,994,985,1,0,0,0,994,986,1,0,0,0,994,987,1,0,0,0,994,988,
	1,0,0,0,994,989,1,0,0,0,994,990,1,0,0,0,994,991,1,0,0,0,994,992,1,0,0,0,
	994,993,1,0,0,0,995,97,1,0,0,0,996,1007,5,72,0,0,997,998,5,49,0,0,998,1003,
	5,180,0,0,999,1000,5,5,0,0,1000,1002,5,180,0,0,1001,999,1,0,0,0,1002,1005,
	1,0,0,0,1003,1001,1,0,0,0,1003,1004,1,0,0,0,1004,1006,1,0,0,0,1005,1003,
	1,0,0,0,1006,1008,5,50,0,0,1007,997,1,0,0,0,1007,1008,1,0,0,0,1008,99,1,
	0,0,0,1009,1013,5,32,0,0,1010,1011,5,49,0,0,1011,1012,5,145,0,0,1012,1014,
	5,50,0,0,1013,1010,1,0,0,0,1013,1014,1,0,0,0,1014,101,1,0,0,0,1015,1016,
	5,73,0,0,1016,1017,5,49,0,0,1017,1022,3,104,52,0,1018,1019,5,5,0,0,1019,
	1021,3,104,52,0,1020,1018,1,0,0,0,1021,1024,1,0,0,0,1022,1020,1,0,0,0,1022,
	1023,1,0,0,0,1023,1026,1,0,0,0,1024,1022,1,0,0,0,1025,1027,5,5,0,0,1026,
	1025,1,0,0,0,1026,1027,1,0,0,0,1027,1028,1,0,0,0,1028,1029,5,50,0,0,1029,
	103,1,0,0,0,1030,1034,3,250,125,0,1031,1033,3,242,121,0,1032,1031,1,0,0,
	0,1033,1036,1,0,0,0,1034,1032,1,0,0,0,1034,1035,1,0,0,0,1035,1038,1,0,0,
	0,1036,1034,1,0,0,0,1037,1039,3,14,7,0,1038,1037,1,0,0,0,1038,1039,1,0,
	0,0,1039,1061,1,0,0,0,1040,1044,3,84,42,0,1041,1043,3,242,121,0,1042,1041,
	1,0,0,0,1043,1046,1,0,0,0,1044,1042,1,0,0,0,1044,1045,1,0,0,0,1045,1048,
	1,0,0,0,1046,1044,1,0,0,0,1047,1049,3,14,7,0,1048,1047,1,0,0,0,1048,1049,
	1,0,0,0,1049,1061,1,0,0,0,1050,1054,3,82,41,0,1051,1053,3,242,121,0,1052,
	1051,1,0,0,0,1053,1056,1,0,0,0,1054,1052,1,0,0,0,1054,1055,1,0,0,0,1055,
	1058,1,0,0,0,1056,1054,1,0,0,0,1057,1059,3,14,7,0,1058,1057,1,0,0,0,1058,
	1059,1,0,0,0,1059,1061,1,0,0,0,1060,1030,1,0,0,0,1060,1040,1,0,0,0,1060,
	1050,1,0,0,0,1061,105,1,0,0,0,1062,1074,5,49,0,0,1063,1068,3,108,54,0,1064,
	1065,5,5,0,0,1065,1067,3,108,54,0,1066,1064,1,0,0,0,1067,1070,1,0,0,0,1068,
	1066,1,0,0,0,1068,1069,1,0,0,0,1069,1072,1,0,0,0,1070,1068,1,0,0,0,1071,
	1073,5,5,0,0,1072,1071,1,0,0,0,1072,1073,1,0,0,0,1073,1075,1,0,0,0,1074,
	1063,1,0,0,0,1074,1075,1,0,0,0,1075,1076,1,0,0,0,1076,1077,5,50,0,0,1077,
	107,1,0,0,0,1078,1082,3,250,125,0,1079,1081,3,242,121,0,1080,1079,1,0,0,
	0,1081,1084,1,0,0,0,1082,1080,1,0,0,0,1082,1083,1,0,0,0,1083,1086,1,0,0,
	0,1084,1082,1,0,0,0,1085,1087,3,14,7,0,1086,1085,1,0,0,0,1086,1087,1,0,
	0,0,1087,1109,1,0,0,0,1088,1092,3,84,42,0,1089,1091,3,242,121,0,1090,1089,
	1,0,0,0,1091,1094,1,0,0,0,1092,1090,1,0,0,0,1092,1093,1,0,0,0,1093,1096,
	1,0,0,0,1094,1092,1,0,0,0,1095,1097,3,14,7,0,1096,1095,1,0,0,0,1096,1097,
	1,0,0,0,1097,1109,1,0,0,0,1098,1102,3,82,41,0,1099,1101,3,242,121,0,1100,
	1099,1,0,0,0,1101,1104,1,0,0,0,1102,1100,1,0,0,0,1102,1103,1,0,0,0,1103,
	1106,1,0,0,0,1104,1102,1,0,0,0,1105,1107,3,14,7,0,1106,1105,1,0,0,0,1106,
	1107,1,0,0,0,1107,1109,1,0,0,0,1108,1078,1,0,0,0,1108,1088,1,0,0,0,1108,
	1098,1,0,0,0,1109,109,1,0,0,0,1110,1114,5,4,0,0,1111,1113,3,114,57,0,1112,
	1111,1,0,0,0,1113,1116,1,0,0,0,1114,1112,1,0,0,0,1114,1115,1,0,0,0,1115,
	1117,1,0,0,0,1116,1114,1,0,0,0,1117,1120,5,6,0,0,1118,1120,3,114,57,0,1119,
	1110,1,0,0,0,1119,1118,1,0,0,0,1120,111,1,0,0,0,1121,1125,5,4,0,0,1122,
	1124,3,114,57,0,1123,1122,1,0,0,0,1124,1127,1,0,0,0,1125,1123,1,0,0,0,1125,
	1126,1,0,0,0,1126,1128,1,0,0,0,1127,1125,1,0,0,0,1128,1129,5,6,0,0,1129,
	113,1,0,0,0,1130,1154,3,90,45,0,1131,1154,3,112,56,0,1132,1154,3,126,63,
	0,1133,1154,3,128,64,0,1134,1154,3,118,59,0,1135,1154,3,136,68,0,1136,1154,
	3,138,69,0,1137,1154,3,140,70,0,1138,1154,3,142,71,0,1139,1154,3,162,81,
	0,1140,1154,3,124,62,0,1141,1154,3,120,60,0,1142,1154,3,122,61,0,1143,1154,
	3,164,82,0,1144,1154,3,204,102,0,1145,1154,3,216,108,0,1146,1154,3,218,
	109,0,1147,1154,3,134,67,0,1148,1154,3,196,98,0,1149,1154,3,198,99,0,1150,
	1154,3,210,105,0,1151,1154,3,212,106,0,1152,1154,3,116,58,0,1153,1130,1,
	0,0,0,1153,1131,1,0,0,0,1153,1132,1,0,0,0,1153,1133,1,0,0,0,1153,1134,1,
	0,0,0,1153,1135,1,0,0,0,1153,1136,1,0,0,0,1153,1137,1,0,0,0,1153,1138,1,
	0,0,0,1153,1139,1,0,0,0,1153,1140,1,0,0,0,1153,1141,1,0,0,0,1153,1142,1,
	0,0,0,1153,1143,1,0,0,0,1153,1144,1,0,0,0,1153,1145,1,0,0,0,1153,1146,1,
	0,0,0,1153,1147,1,0,0,0,1153,1148,1,0,0,0,1153,1149,1,0,0,0,1153,1150,1,
	0,0,0,1153,1151,1,0,0,0,1153,1152,1,0,0,0,1154,115,1,0,0,0,1155,1177,3,
	238,119,0,1156,1157,7,9,0,0,1157,1178,3,238,119,0,1158,1159,5,165,0,0,1159,
	1160,5,49,0,0,1160,1161,5,50,0,0,1161,1162,5,40,0,0,1162,1178,3,238,119,
	0,1163,1164,5,165,0,0,1164,1166,5,49,0,0,1165,1167,3,132,66,0,1166,1165,
	1,0,0,0,1166,1167,1,0,0,0,1167,1168,1,0,0,0,1168,1178,5,50,0,0,1169,1170,
	5,166,0,0,1170,1171,5,49,0,0,1171,1178,5,50,0,0,1172,1173,5,169,0,0,1173,
	1174,5,49,0,0,1174,1175,3,238,119,0,1175,1176,5,50,0,0,1176,1178,1,0,0,
	0,1177,1156,1,0,0,0,1177,1158,1,0,0,0,1177,1163,1,0,0,0,1177,1169,1,0,0,
	0,1177,1172,1,0,0,0,1177,1178,1,0,0,0,1178,1179,1,0,0,0,1179,1180,5,2,0,
	0,1180,117,1,0,0,0,1181,1182,7,10,0,0,1182,1183,3,238,119,0,1183,1184,5,
	2,0,0,1184,119,1,0,0,0,1185,1186,5,86,0,0,1186,1215,5,2,0,0,1187,1188,5,
	86,0,0,1188,1193,3,238,119,0,1189,1190,5,5,0,0,1190,1192,3,238,119,0,1191,
	1189,1,0,0,0,1192,1195,1,0,0,0,1193,1191,1,0,0,0,1193,1194,1,0,0,0,1194,
	1196,1,0,0,0,1195,1193,1,0,0,0,1196,1197,5,2,0,0,1197,1215,1,0,0,0,1198,
	1199,5,86,0,0,1199,1200,5,49,0,0,1200,1205,3,238,119,0,1201,1202,5,5,0,
	0,1202,1204,3,238,119,0,1203,1201,1,0,0,0,1204,1207,1,0,0,0,1205,1203,1,
	0,0,0,1205,1206,1,0,0,0,1206,1209,1,0,0,0,1207,1205,1,0,0,0,1208,1210,5,
	5,0,0,1209,1208,1,0,0,0,1209,1210,1,0,0,0,1210,1211,1,0,0,0,1211,1212,5,
	50,0,0,1212,1213,5,2,0,0,1213,1215,1,0,0,0,1214,1185,1,0,0,0,1214,1187,
	1,0,0,0,1214,1198,1,0,0,0,1215,121,1,0,0,0,1216,1217,5,31,0,0,1217,1218,
	5,49,0,0,1218,1219,3,238,119,0,1219,1220,5,50,0,0,1220,1221,5,2,0,0,1221,
	123,1,0,0,0,1222,1223,5,87,0,0,1223,1226,5,180,0,0,1224,1225,5,12,0,0,1225,
	1227,5,180,0,0,1226,1224,1,0,0,0,1226,1227,1,0,0,0,1227,1228,1,0,0,0,1228,
	1229,5,49,0,0,1229,1241,5,4,0,0,1230,1235,3,226,113,0,1231,1232,5,5,0,0,
	1232,1234,3,226,113,0,1233,1231,1,0,0,0,1234,1237,1,0,0,0,1235,1233,1,0,
	0,0,1235,1236,1,0,0,0,1236,1239,1,0,0,0,1237,1235,1,0,0,0,1238,1240,5,5,
	0,0,1239,1238,1,0,0,0,1239,1240,1,0,0,0,1240,1242,1,0,0,0,1241,1230,1,0,
	0,0,1241,1242,1,0,0,0,1242,1243,1,0,0,0,1243,1244,5,6,0,0,1244,1245,5,50,
	0,0,1245,1256,5,2,0,0,1246,1247,5,87,0,0,1247,1250,5,180,0,0,1248,1249,
	5,12,0,0,1249,1251,5,180,0,0,1250,1248,1,0,0,0,1250,1251,1,0,0,0,1251,1252,
	1,0,0,0,1252,1253,3,228,114,0,1253,1254,5,2,0,0,1254,1256,1,0,0,0,1255,
	1222,1,0,0,0,1255,1246,1,0,0,0,1256,125,1,0,0,0,1257,1261,3,250,125,0,1258,
	1260,3,242,121,0,1259,1258,1,0,0,0,1260,1263,1,0,0,0,1261,1259,1,0,0,0,
	1261,1262,1,0,0,0,1262,1264,1,0,0,0,1263,1261,1,0,0,0,1264,1272,3,14,7,
	0,1265,1266,5,40,0,0,1266,1270,3,238,119,0,1267,1268,5,165,0,0,1268,1269,
	5,49,0,0,1269,1271,5,50,0,0,1270,1267,1,0,0,0,1270,1271,1,0,0,0,1271,1273,
	1,0,0,0,1272,1265,1,0,0,0,1272,1273,1,0,0,0,1273,1274,1,0,0,0,1274,1275,
	5,2,0,0,1275,1305,1,0,0,0,1276,1280,3,84,42,0,1277,1279,3,242,121,0,1278,
	1277,1,0,0,0,1279,1282,1,0,0,0,1280,1278,1,0,0,0,1280,1281,1,0,0,0,1281,
	1283,1,0,0,0,1282,1280,1,0,0,0,1283,1286,3,14,7,0,1284,1285,5,40,0,0,1285,
	1287,3,238,119,0,1286,1284,1,0,0,0,1286,1287,1,0,0,0,1287,1288,1,0,0,0,
	1288,1289,5,2,0,0,1289,1305,1,0,0,0,1290,1294,3,82,41,0,1291,1293,3,242,
	121,0,1292,1291,1,0,0,0,1293,1296,1,0,0,0,1294,1292,1,0,0,0,1294,1295,1,
	0,0,0,1295,1297,1,0,0,0,1296,1294,1,0,0,0,1297,1300,3,14,7,0,1298,1299,
	5,40,0,0,1299,1301,3,238,119,0,1300,1298,1,0,0,0,1300,1301,1,0,0,0,1301,
	1302,1,0,0,0,1302,1303,5,2,0,0,1303,1305,1,0,0,0,1304,1257,1,0,0,0,1304,
	1276,1,0,0,0,1304,1290,1,0,0,0,1305,127,1,0,0,0,1306,1307,3,250,125,0,1307,
	1312,5,180,0,0,1308,1309,5,5,0,0,1309,1310,3,250,125,0,1310,1311,5,180,
	0,0,1311,1313,1,0,0,0,1312,1308,1,0,0,0,1313,1314,1,0,0,0,1314,1312,1,0,
	0,0,1314,1315,1,0,0,0,1315,1316,1,0,0,0,1316,1317,5,40,0,0,1317,1318,3,
	238,119,0,1318,1319,5,2,0,0,1319,1355,1,0,0,0,1320,1321,5,49,0,0,1321,1324,
	3,130,65,0,1322,1323,5,5,0,0,1323,1325,3,130,65,0,1324,1322,1,0,0,0,1325,
	1326,1,0,0,0,1326,1324,1,0,0,0,1326,1327,1,0,0,0,1327,1328,1,0,0,0,1328,
	1329,5,50,0,0,1329,1330,5,40,0,0,1330,1331,5,49,0,0,1331,1334,3,238,119,
	0,1332,1333,5,5,0,0,1333,1335,3,238,119,0,1334,1332,1,0,0,0,1335,1336,1,
	0,0,0,1336,1334,1,0,0,0,1336,1337,1,0,0,0,1337,1338,1,0,0,0,1338,1339,5,
	50,0,0,1339,1340,5,2,0,0,1340,1355,1,0,0,0,1341,1342,5,49,0,0,1342,1345,
	3,130,65,0,1343,1344,5,5,0,0,1344,1346,3,130,65,0,1345,1343,1,0,0,0,1346,
	1347,1,0,0,0,1347,1345,1,0,0,0,1347,1348,1,0,0,0,1348,1349,1,0,0,0,1349,
	1350,5,50,0,0,1350,1351,5,40,0,0,1351,1352,3,238,119,0,1352,1353,5,2,0,
	0,1353,1355,1,0,0,0,1354,1306,1,0,0,0,1354,1320,1,0,0,0,1354,1341,1,0,0,
	0,1355,129,1,0,0,0,1356,1360,3,250,125,0,1357,1359,3,242,121,0,1358,1357,
	1,0,0,0,1359,1362,1,0,0,0,1360,1358,1,0,0,0,1360,1361,1,0,0,0,1361,1363,
	1,0,0,0,1362,1360,1,0,0,0,1363,1364,3,14,7,0,1364,1377,1,0,0,0,1365,1369,
	3,84,42,0,1366,1368,3,242,121,0,1367,1366,1,0,0,0,1368,1371,1,0,0,0,1369,
	1367,1,0,0,0,1369,1370,1,0,0,0,1370,1372,1,0,0,0,1371,1369,1,0,0,0,1372,
	1373,3,14,7,0,1373,1377,1,0,0,0,1374,1377,3,14,7,0,1375,1377,1,0,0,0,1376,
	1356,1,0,0,0,1376,1365,1,0,0,0,1376,1374,1,0,0,0,1376,1375,1,0,0,0,1377,
	131,1,0,0,0,1378,1379,3,238,119,0,1379,133,1,0,0,0,1380,1381,5,88,0,0,1381,
	1382,5,180,0,0,1382,1442,5,2,0,0,1383,1384,5,88,0,0,1384,1385,5,89,0,0,
	1385,1386,5,12,0,0,1386,1387,5,180,0,0,1387,1442,5,2,0,0,1388,1389,5,88,
	0,0,1389,1390,5,89,0,0,1390,1391,5,12,0,0,1391,1396,5,180,0,0,1392,1393,
	5,66,0,0,1393,1394,3,238,119,0,1394,1395,5,67,0,0,1395,1397,1,0,0,0,1396,
	1392,1,0,0,0,1397,1398,1,0,0,0,1398,1396,1,0,0,0,1398,1399,1,0,0,0,1399,
	1400,1,0,0,0,1400,1401,5,2,0,0,1401,1442,1,0,0,0,1402,1403,5,88,0,0,1403,
	1408,5,180,0,0,1404,1405,5,66,0,0,1405,1406,3,238,119,0,1406,1407,5,67,
	0,0,1407,1409,1,0,0,0,1408,1404,1,0,0,0,1409,1410,1,0,0,0,1410,1408,1,0,
	0,0,1410,1411,1,0,0,0,1411,1412,1,0,0,0,1412,1413,5,2,0,0,1413,1442,1,0,
	0,0,1414,1415,5,88,0,0,1415,1418,5,180,0,0,1416,1417,5,12,0,0,1417,1419,
	5,180,0,0,1418,1416,1,0,0,0,1419,1420,1,0,0,0,1420,1418,1,0,0,0,1420,1421,
	1,0,0,0,1421,1426,1,0,0,0,1422,1423,5,66,0,0,1423,1424,3,238,119,0,1424,
	1425,5,67,0,0,1425,1427,1,0,0,0,1426,1422,1,0,0,0,1427,1428,1,0,0,0,1428,
	1426,1,0,0,0,1428,1429,1,0,0,0,1429,1430,1,0,0,0,1430,1431,5,2,0,0,1431,
	1442,1,0,0,0,1432,1433,5,88,0,0,1433,1436,5,180,0,0,1434,1435,5,12,0,0,
	1435,1437,5,180,0,0,1436,1434,1,0,0,0,1437,1438,1,0,0,0,1438,1436,1,0,0,
	0,1438,1439,1,0,0,0,1439,1440,1,0,0,0,1440,1442,5,2,0,0,1441,1380,1,0,0,
	0,1441,1383,1,0,0,0,1441,1388,1,0,0,0,1441,1402,1,0,0,0,1441,1414,1,0,0,
	0,1441,1432,1,0,0,0,1442,135,1,0,0,0,1443,1444,5,90,0,0,1444,1445,5,49,
	0,0,1445,1446,5,154,0,0,1446,1447,5,23,0,0,1447,1450,3,238,119,0,1448,1449,
	5,5,0,0,1449,1451,3,214,107,0,1450,1448,1,0,0,0,1450,1451,1,0,0,0,1451,
	1452,1,0,0,0,1452,1453,5,50,0,0,1453,1454,5,2,0,0,1454,137,1,0,0,0,1455,
	1456,5,90,0,0,1456,1457,5,49,0,0,1457,1460,3,238,119,0,1458,1459,5,5,0,
	0,1459,1461,3,214,107,0,1460,1458,1,0,0,0,1460,1461,1,0,0,0,1461,1462,1,
	0,0,0,1462,1463,5,50,0,0,1463,1464,5,2,0,0,1464,139,1,0,0,0,1465,1466,5,
	91,0,0,1466,1467,5,49,0,0,1467,1468,3,238,119,0,1468,1469,5,50,0,0,1469,
	1472,3,110,55,0,1470,1471,5,92,0,0,1471,1473,3,110,55,0,1472,1470,1,0,0,
	0,1472,1473,1,0,0,0,1473,141,1,0,0,0,1474,1481,3,158,79,0,1475,1481,3,160,
	80,0,1476,1481,3,150,75,0,1477,1481,3,144,72,0,1478,1481,3,146,73,0,1479,
	1481,3,148,74,0,1480,1474,1,0,0,0,1480,1475,1,0,0,0,1480,1476,1,0,0,0,1480,
	1477,1,0,0,0,1480,1478,1,0,0,0,1480,1479,1,0,0,0,1481,143,1,0,0,0,1482,
	1483,5,9,0,0,1483,1484,5,49,0,0,1484,1485,3,250,125,0,1485,1486,5,180,0,
	0,1486,1487,5,5,0,0,1487,1488,3,250,125,0,1488,1489,5,180,0,0,1489,1490,
	5,93,0,0,1490,1491,5,89,0,0,1491,1492,5,12,0,0,1492,1493,5,180,0,0,1493,
	1494,5,12,0,0,1494,1495,5,34,0,0,1495,1496,5,50,0,0,1496,1497,3,110,55,
	0,1497,145,1,0,0,0,1498,1499,5,9,0,0,1499,1500,5,49,0,0,1500,1501,3,250,
	125,0,1501,1502,5,180,0,0,1502,1503,5,94,0,0,1503,1504,5,89,0,0,1504,1505,
	5,12,0,0,1505,1506,5,180,0,0,1506,1507,5,50,0,0,1507,1508,3,110,55,0,1508,
	147,1,0,0,0,1509,1510,5,9,0,0,1510,1511,5,49,0,0,1511,1512,3,250,125,0,
	1512,1513,5,180,0,0,1513,1514,5,93,0,0,1514,1515,5,89,0,0,1515,1516,5,12,
	0,0,1516,1517,5,180,0,0,1517,1518,5,50,0,0,1518,1519,3,110,55,0,1519,149,
	1,0,0,0,1520,1521,5,9,0,0,1521,1522,5,49,0,0,1522,1523,3,152,76,0,1523,
	1525,3,154,77,0,1524,1526,3,156,78,0,1525,1524,1,0,0,0,1525,1526,1,0,0,
	0,1526,1527,1,0,0,0,1527,1528,5,50,0,0,1528,1529,3,110,55,0,1529,151,1,
	0,0,0,1530,1534,3,250,125,0,1531,1533,3,242,121,0,1532,1531,1,0,0,0,1533,
	1536,1,0,0,0,1534,1532,1,0,0,0,1534,1535,1,0,0,0,1535,1537,1,0,0,0,1536,
	1534,1,0,0,0,1537,1540,5,180,0,0,1538,1539,5,40,0,0,1539,1541,3,238,119,
	0,1540,1538,1,0,0,0,1540,1541,1,0,0,0,1541,1542,1,0,0,0,1542,1543,5,2,0,
	0,1543,1576,1,0,0,0,1544,1545,5,180,0,0,1545,1546,7,9,0,0,1546,1547,3,238,
	119,0,1547,1548,5,2,0,0,1548,1576,1,0,0,0,1549,1550,5,49,0,0,1550,1553,
	3,130,65,0,1551,1552,5,5,0,0,1552,1554,3,130,65,0,1553,1551,1,0,0,0,1554,
	1555,1,0,0,0,1555,1553,1,0,0,0,1555,1556,1,0,0,0,1556,1557,1,0,0,0,1557,
	1558,5,50,0,0,1558,1570,5,40,0,0,1559,1560,5,49,0,0,1560,1563,3,238,119,
	0,1561,1562,5,5,0,0,1562,1564,3,238,119,0,1563,1561,1,0,0,0,1564,1565,1,
	0,0,0,1565,1563,1,0,0,0,1565,1566,1,0,0,0,1566,1567,1,0,0,0,1567,1568,5,
	50,0,0,1568,1571,1,0,0,0,1569,1571,3,238,119,0,1570,1559,1,0,0,0,1570,1569,
	1,0,0,0,1571,1572,1,0,0,0,1572,1573,5,2,0,0,1573,1576,1,0,0,0,1574,1576,
	5,2,0,0,1575,1530,1,0,0,0,1575,1544,1,0,0,0,1575,1549,1,0,0,0,1575,1574,
	1,0,0,0,1576,153,1,0,0,0,1577,1579,3,238,119,0,1578,1577,1,0,0,0,1578,1579,
	1,0,0,0,1579,1580,1,0,0,0,1580,1581,5,2,0,0,1581,155,1,0,0,0,1582,1583,
	5,180,0,0,1583,1584,7,9,0,0,1584,1613,3,238,119,0,1585,1586,5,180,0,0,1586,
	1613,7,10,0,0,1587,1588,7,10,0,0,1588,1613,5,180,0,0,1589,1590,5,49,0,0,
	1590,1593,3,130,65,0,1591,1592,5,5,0,0,1592,1594,3,130,65,0,1593,1591,1,
	0,0,0,1594,1595,1,0,0,0,1595,1593,1,0,0,0,1595,1596,1,0,0,0,1596,1597,1,
	0,0,0,1597,1598,5,50,0,0,1598,1610,5,40,0,0,1599,1600,5,49,0,0,1600,1603,
	3,238,119,0,1601,1602,5,5,0,0,1602,1604,3,238,119,0,1603,1601,1,0,0,0,1604,
	1605,1,0,0,0,1605,1603,1,0,0,0,1605,1606,1,0,0,0,1606,1607,1,0,0,0,1607,
	1608,5,50,0,0,1608,1611,1,0,0,0,1609,1611,3,238,119,0,1610,1599,1,0,0,0,
	1610,1609,1,0,0,0,1611,1613,1,0,0,0,1612,1582,1,0,0,0,1612,1585,1,0,0,0,
	1612,1587,1,0,0,0,1612,1589,1,0,0,0,1613,157,1,0,0,0,1614,1615,5,95,0,0,
	1615,1616,3,110,55,0,1616,1617,5,96,0,0,1617,1618,5,49,0,0,1618,1619,3,
	238,119,0,1619,1620,5,50,0,0,1620,1621,5,2,0,0,1621,159,1,0,0,0,1622,1623,
	5,96,0,0,1623,1624,5,49,0,0,1624,1625,3,238,119,0,1625,1626,5,50,0,0,1626,
	1627,3,110,55,0,1627,161,1,0,0,0,1628,1629,5,97,0,0,1629,1630,3,222,111,
	0,1630,1631,5,2,0,0,1631,163,1,0,0,0,1632,1634,5,98,0,0,1633,1635,5,151,
	0,0,1634,1633,1,0,0,0,1634,1635,1,0,0,0,1635,1646,1,0,0,0,1636,1637,5,49,
	0,0,1637,1642,5,151,0,0,1638,1639,5,5,0,0,1639,1641,5,151,0,0,1640,1638,
	1,0,0,0,1641,1644,1,0,0,0,1642,1640,1,0,0,0,1642,1643,1,0,0,0,1643,1645,
	1,0,0,0,1644,1642,1,0,0,0,1645,1647,5,50,0,0,1646,1636,1,0,0,0,1646,1647,
	1,0,0,0,1647,1648,1,0,0,0,1648,1649,3,166,83,0,1649,165,1,0,0,0,1650,1654,
	5,4,0,0,1651,1653,3,168,84,0,1652,1651,1,0,0,0,1653,1656,1,0,0,0,1654,1652,
	1,0,0,0,1654,1655,1,0,0,0,1655,1657,1,0,0,0,1656,1654,1,0,0,0,1657,1658,
	5,6,0,0,1658,167,1,0,0,0,1659,1673,3,166,83,0,1660,1673,3,170,85,0,1661,
	1673,3,172,86,0,1662,1673,3,174,87,0,1663,1673,3,176,88,0,1664,1673,3,182,
	91,0,1665,1673,3,184,92,0,1666,1673,5,99,0,0,1667,1673,5,100,0,0,1668,1673,
	5,101,0,0,1669,1673,3,188,94,0,1670,1673,3,192,96,0,1671,1673,3,194,97,
	0,1672,1659,1,0,0,0,1672,1660,1,0,0,0,1672,1661,1,0,0,0,1672,1662,1,0,0,
	0,1672,1663,1,0,0,0,1672,1664,1,0,0,0,1672,1665,1,0,0,0,1672,1666,1,0,0,
	0,1672,1667,1,0,0,0,1672,1668,1,0,0,0,1672,1669,1,0,0,0,1672,1670,1,0,0,
	0,1672,1671,1,0,0,0,1673,169,1,0,0,0,1674,1675,5,102,0,0,1675,1680,3,14,
	7,0,1676,1677,5,5,0,0,1677,1679,3,14,7,0,1678,1676,1,0,0,0,1679,1682,1,
	0,0,0,1680,1678,1,0,0,0,1680,1681,1,0,0,0,1681,1685,1,0,0,0,1682,1680,1,
	0,0,0,1683,1684,5,103,0,0,1684,1686,3,186,93,0,1685,1683,1,0,0,0,1685,1686,
	1,0,0,0,1686,171,1,0,0,0,1687,1692,3,192,96,0,1688,1689,5,5,0,0,1689,1691,
	3,192,96,0,1690,1688,1,0,0,0,1691,1694,1,0,0,0,1692,1690,1,0,0,0,1692,1693,
	1,0,0,0,1693,1695,1,0,0,0,1694,1692,1,0,0,0,1695,1696,5,103,0,0,1696,1697,
	3,186,93,0,1697,173,1,0,0,0,1698,1699,5,91,0,0,1699,1700,3,186,93,0,1700,
	1701,3,166,83,0,1701,175,1,0,0,0,1702,1703,5,104,0,0,1703,1713,3,186,93,
	0,1704,1706,3,178,89,0,1705,1704,1,0,0,0,1706,1707,1,0,0,0,1707,1705,1,
	0,0,0,1707,1708,1,0,0,0,1708,1710,1,0,0,0,1709,1711,3,180,90,0,1710,1709,
	1,0,0,0,1710,1711,1,0,0,0,1711,1714,1,0,0,0,1712,1714,3,180,90,0,1713,1705,
	1,0,0,0,1713,1712,1,0,0,0,1714,177,1,0,0,0,1715,1716,5,105,0,0,1716,1717,
	3,194,97,0,1717,1718,3,166,83,0,1718,179,1,0,0,0,1719,1720,5,106,0,0,1720,
	1721,3,166,83,0,1721,181,1,0,0,0,1722,1723,5,9,0,0,1723,1724,3,166,83,0,
	1724,1725,3,186,93,0,1725,1726,3,166,83,0,1726,1727,3,166,83,0,1727,183,
	1,0,0,0,1728,1729,5,7,0,0,1729,1730,5,180,0,0,1730,1739,5,49,0,0,1731,1736,
	5,180,0,0,1732,1733,5,5,0,0,1733,1735,5,180,0,0,1734,1732,1,0,0,0,1735,
	1738,1,0,0,0,1736,1734,1,0,0,0,1736,1737,1,0,0,0,1737,1740,1,0,0,0,1738,
	1736,1,0,0,0,1739,1731,1,0,0,0,1739,1740,1,0,0,0,1740,1741,1,0,0,0,1741,
	1751,5,50,0,0,1742,1743,5,107,0,0,1743,1748,5,180,0,0,1744,1745,5,5,0,0,
	1745,1747,5,180,0,0,1746,1744,1,0,0,0,1747,1750,1,0,0,0,1748,1746,1,0,0,
	0,1748,1749,1,0,0,0,1749,1752,1,0,0,0,1750,1748,1,0,0,0,1751,1742,1,0,0,
	0,1751,1752,1,0,0,0,1752,1753,1,0,0,0,1753,1754,3,166,83,0,1754,185,1,0,
	0,0,1755,1759,3,188,94,0,1756,1759,3,192,96,0,1757,1759,3,194,97,0,1758,
	1755,1,0,0,0,1758,1756,1,0,0,0,1758,1757,1,0,0,0,1759,187,1,0,0,0,1760,
	1761,3,190,95,0,1761,1770,5,49,0,0,1762,1767,3,186,93,0,1763,1764,5,5,0,
	0,1764,1766,3,186,93,0,1765,1763,1,0,0,0,1766,1769,1,0,0,0,1767,1765,1,
	0,0,0,1767,1768,1,0,0,0,1768,1771,1,0,0,0,1769,1767,1,0,0,0,1770,1762,1,
	0,0,0,1770,1771,1,0,0,0,1771,1772,1,0,0,0,1772,1773,5,50,0,0,1773,189,1,
	0,0,0,1774,1775,7,11,0,0,1775,191,1,0,0,0,1776,1782,3,14,7,0,1777,1778,
	5,12,0,0,1778,1781,3,14,7,0,1779,1781,5,164,0,0,1780,1777,1,0,0,0,1780,
	1779,1,0,0,0,1781,1784,1,0,0,0,1782,1780,1,0,0,0,1782,1783,1,0,0,0,1783,
	193,1,0,0,0,1784,1782,1,0,0,0,1785,1786,7,12,0,0,1786,195,1,0,0,0,1787,
	1788,5,109,0,0,1788,1792,5,4,0,0,1789,1791,3,114,57,0,1790,1789,1,0,0,0,
	1791,1794,1,0,0,0,1792,1790,1,0,0,0,1792,1793,1,0,0,0,1793,1795,1,0,0,0,
	1794,1792,1,0,0,0,1795,1796,5,6,0,0,1796,197,1,0,0,0,1797,1798,5,104,0,
	0,1798,1799,5,49,0,0,1799,1800,3,238,119,0,1800,1801,5,50,0,0,1801,1805,
	5,4,0,0,1802,1804,3,200,100,0,1803,1802,1,0,0,0,1804,1807,1,0,0,0,1805,
	1803,1,0,0,0,1805,1806,1,0,0,0,1806,1809,1,0,0,0,1807,1805,1,0,0,0,1808,
	1810,3,202,101,0,1809,1808,1,0,0,0,1809,1810,1,0,0,0,1810,1811,1,0,0,0,
	1811,1812,5,6,0,0,1812,199,1,0,0,0,1813,1814,5,105,0,0,1814,1815,3,238,
	119,0,1815,1819,5,110,0,0,1816,1818,3,114,57,0,1817,1816,1,0,0,0,1818,1821,
	1,0,0,0,1819,1817,1,0,0,0,1819,1820,1,0,0,0,1820,201,1,0,0,0,1821,1819,
	1,0,0,0,1822,1823,5,106,0,0,1823,1827,5,110,0,0,1824,1826,3,114,57,0,1825,
	1824,1,0,0,0,1826,1829,1,0,0,0,1827,1825,1,0,0,0,1827,1828,1,0,0,0,1828,
	203,1,0,0,0,1829,1827,1,0,0,0,1830,1831,5,111,0,0,1831,1833,3,238,119,0,
	1832,1834,3,206,103,0,1833,1832,1,0,0,0,1833,1834,1,0,0,0,1834,1835,1,0,
	0,0,1835,1837,3,110,55,0,1836,1838,3,208,104,0,1837,1836,1,0,0,0,1838,1839,
	1,0,0,0,1839,1837,1,0,0,0,1839,1840,1,0,0,0,1840,205,1,0,0,0,1841,1842,
	5,73,0,0,1842,1854,5,49,0,0,1843,1848,3,108,54,0,1844,1845,5,5,0,0,1845,
	1847,3,108,54,0,1846,1844,1,0,0,0,1847,1850,1,0,0,0,1848,1846,1,0,0,0,1848,
	1849,1,0,0,0,1849,1852,1,0,0,0,1850,1848,1,0,0,0,1851,1853,5,5,0,0,1852,
	1851,1,0,0,0,1852,1853,1,0,0,0,1853,1855,1,0,0,0,1854,1843,1,0,0,0,1854,
	1855,1,0,0,0,1855,1856,1,0,0,0,1856,1857,5,50,0,0,1857,207,1,0,0,0,1858,
	1860,5,112,0,0,1859,1861,5,180,0,0,1860,1859,1,0,0,0,1860,1861,1,0,0,0,
	1861,1877,1,0,0,0,1862,1874,5,49,0,0,1863,1868,3,108,54,0,1864,1865,5,5,
	0,0,1865,1867,3,108,54,0,1866,1864,1,0,0,0,1867,1870,1,0,0,0,1868,1866,
	1,0,0,0,1868,1869,1,0,0,0,1869,1872,1,0,0,0,1870,1868,1,0,0,0,1871,1873,
	5,5,0,0,1872,1871,1,0,0,0,1872,1873,1,0,0,0,1873,1875,1,0,0,0,1874,1863,
	1,0,0,0,1874,1875,1,0,0,0,1875,1876,1,0,0,0,1876,1878,5,50,0,0,1877,1862,
	1,0,0,0,1877,1878,1,0,0,0,1878,1879,1,0,0,0,1879,1880,3,110,55,0,1880,209,
	1,0,0,0,1881,1882,5,99,0,0,1882,1883,5,2,0,0,1883,211,1,0,0,0,1884,1885,
	5,100,0,0,1885,1886,5,2,0,0,1886,213,1,0,0,0,1887,1891,5,151,0,0,1888,1889,
	5,180,0,0,1889,1891,3,228,114,0,1890,1887,1,0,0,0,1890,1888,1,0,0,0,1891,
	215,1,0,0,0,1892,1893,5,36,0,0,1893,1896,5,180,0,0,1894,1895,5,12,0,0,1895,
	1897,5,180,0,0,1896,1894,1,0,0,0,1896,1897,1,0,0,0,1897,1898,1,0,0,0,1898,
	1899,5,49,0,0,1899,1911,5,4,0,0,1900,1905,3,226,113,0,1901,1902,5,5,0,0,
	1902,1904,3,226,113,0,1903,1901,1,0,0,0,1904,1907,1,0,0,0,1905,1903,1,0,
	0,0,1905,1906,1,0,0,0,1906,1909,1,0,0,0,1907,1905,1,0,0,0,1908,1910,5,5,
	0,0,1909,1908,1,0,0,0,1909,1910,1,0,0,0,1910,1912,1,0,0,0,1911,1900,1,0,
	0,0,1911,1912,1,0,0,0,1912,1913,1,0,0,0,1913,1914,5,6,0,0,1914,1915,5,50,
	0,0,1915,1935,5,2,0,0,1916,1917,5,36,0,0,1917,1920,5,180,0,0,1918,1919,
	5,12,0,0,1919,1921,5,180,0,0,1920,1918,1,0,0,0,1920,1921,1,0,0,0,1921,1922,
	1,0,0,0,1922,1923,3,228,114,0,1923,1924,5,2,0,0,1924,1935,1,0,0,0,1925,
	1926,5,36,0,0,1926,1927,5,49,0,0,1927,1928,5,151,0,0,1928,1929,5,50,0,0,
	1929,1935,5,2,0,0,1930,1931,5,36,0,0,1931,1932,5,49,0,0,1932,1933,5,50,
	0,0,1933,1935,5,2,0,0,1934,1892,1,0,0,0,1934,1916,1,0,0,0,1934,1925,1,0,
	0,0,1934,1930,1,0,0,0,1935,217,1,0,0,0,1936,1937,5,113,0,0,1937,1938,5,
	49,0,0,1938,1939,3,238,119,0,1939,1940,5,50,0,0,1940,1941,5,2,0,0,1941,
	219,1,0,0,0,1942,1945,5,180,0,0,1943,1945,3,244,122,0,1944,1942,1,0,0,0,
	1944,1943,1,0,0,0,1945,221,1,0,0,0,1946,1958,5,49,0,0,1947,1952,3,220,110,
	0,1948,1949,5,5,0,0,1949,1951,3,220,110,0,1950,1948,1,0,0,0,1951,1954,1,
	0,0,0,1952,1950,1,0,0,0,1952,1953,1,0,0,0,1953,1956,1,0,0,0,1954,1952,1,
	0,0,0,1955,1957,5,5,0,0,1956,1955,1,0,0,0,1956,1957,1,0,0,0,1957,1959,1,
	0,0,0,1958,1947,1,0,0,0,1958,1959,1,0,0,0,1959,1960,1,0,0,0,1960,1961,5,
	50,0,0,1961,223,1,0,0,0,1962,1963,5,180,0,0,1963,1987,3,228,114,0,1964,
	1965,5,180,0,0,1965,1966,5,12,0,0,1966,1967,5,180,0,0,1967,1987,3,228,114,
	0,1968,1969,5,180,0,0,1969,1970,5,49,0,0,1970,1982,5,4,0,0,1971,1976,3,
	226,113,0,1972,1973,5,5,0,0,1973,1975,3,226,113,0,1974,1972,1,0,0,0,1975,
	1978,1,0,0,0,1976,1974,1,0,0,0,1976,1977,1,0,0,0,1977,1980,1,0,0,0,1978,
	1976,1,0,0,0,1979,1981,5,5,0,0,1980,1979,1,0,0,0,1980,1981,1,0,0,0,1981,
	1983,1,0,0,0,1982,1971,1,0,0,0,1982,1983,1,0,0,0,1983,1984,1,0,0,0,1984,
	1985,5,6,0,0,1985,1987,5,50,0,0,1986,1962,1,0,0,0,1986,1964,1,0,0,0,1986,
	1968,1,0,0,0,1987,225,1,0,0,0,1988,1989,5,180,0,0,1989,1990,5,110,0,0,1990,
	1991,3,238,119,0,1991,227,1,0,0,0,1992,2004,5,49,0,0,1993,1998,3,238,119,
	0,1994,1995,5,5,0,0,1995,1997,3,238,119,0,1996,1994,1,0,0,0,1997,2000,1,
	0,0,0,1998,1996,1,0,0,0,1998,1999,1,0,0,0,1999,2002,1,0,0,0,2000,1998,1,
	0,0,0,2001,2003,5,5,0,0,2002,2001,1,0,0,0,2002,2003,1,0,0,0,2003,2005,1,
	0,0,0,2004,1993,1,0,0,0,2004,2005,1,0,0,0,2005,2006,1,0,0,0,2006,2007,5,
	50,0,0,2007,229,1,0,0,0,2008,2009,5,4,0,0,2009,2014,3,232,116,0,2010,2011,
	5,5,0,0,2011,2013,3,232,116,0,2012,2010,1,0,0,0,2013,2016,1,0,0,0,2014,
	2012,1,0,0,0,2014,2015,1,0,0,0,2015,2018,1,0,0,0,2016,2014,1,0,0,0,2017,
	2019,5,5,0,0,2018,2017,1,0,0,0,2018,2019,1,0,0,0,2019,2020,1,0,0,0,2020,
	2021,5,6,0,0,2021,231,1,0,0,0,2022,2023,5,180,0,0,2023,2024,5,110,0,0,2024,
	2025,3,238,119,0,2025,233,1,0,0,0,2026,2027,5,49,0,0,2027,2032,3,236,118,
	0,2028,2029,5,5,0,0,2029,2031,3,236,118,0,2030,2028,1,0,0,0,2031,2034,1,
	0,0,0,2032,2030,1,0,0,0,2032,2033,1,0,0,0,2033,2036,1,0,0,0,2034,2032,1,
	0,0,0,2035,2037,5,5,0,0,2036,2035,1,0,0,0,2036,2037,1,0,0,0,2037,2038,1,
	0,0,0,2038,2039,5,50,0,0,2039,235,1,0,0,0,2040,2043,3,250,125,0,2041,2043,
	3,84,42,0,2042,2040,1,0,0,0,2042,2041,1,0,0,0,2043,237,1,0,0,0,2044,2045,
	6,119,-1,0,2045,2046,5,49,0,0,2046,2047,5,180,0,0,2047,2048,7,9,0,0,2048,
	2049,3,238,119,0,2049,2050,5,50,0,0,2050,2215,1,0,0,0,2051,2052,5,49,0,
	0,2052,2053,5,114,0,0,2053,2054,5,180,0,0,2054,2055,5,50,0,0,2055,2056,
	3,230,115,0,2056,2057,3,228,114,0,2057,2215,1,0,0,0,2058,2059,5,49,0,0,
	2059,2060,3,238,119,0,2060,2061,5,50,0,0,2061,2215,1,0,0,0,2062,2063,5,
	49,0,0,2063,2066,3,238,119,0,2064,2065,5,5,0,0,2065,2067,3,238,119,0,2066,
	2064,1,0,0,0,2067,2068,1,0,0,0,2068,2066,1,0,0,0,2068,2069,1,0,0,0,2069,
	2070,1,0,0,0,2070,2071,5,50,0,0,2071,2215,1,0,0,0,2072,2073,3,252,126,0,
	2073,2074,5,49,0,0,2074,2076,3,238,119,0,2075,2077,5,5,0,0,2076,2075,1,
	0,0,0,2076,2077,1,0,0,0,2077,2078,1,0,0,0,2078,2079,5,50,0,0,2079,2215,
	1,0,0,0,2080,2215,3,224,112,0,2081,2082,5,114,0,0,2082,2084,5,180,0,0,2083,
	2085,3,230,115,0,2084,2083,1,0,0,0,2084,2085,1,0,0,0,2085,2086,1,0,0,0,
	2086,2215,3,228,114,0,2087,2088,5,114,0,0,2088,2091,3,250,125,0,2089,2090,
	5,66,0,0,2090,2092,5,67,0,0,2091,2089,1,0,0,0,2092,2093,1,0,0,0,2093,2091,
	1,0,0,0,2093,2094,1,0,0,0,2094,2095,1,0,0,0,2095,2096,5,49,0,0,2096,2097,
	3,238,119,0,2097,2098,5,50,0,0,2098,2215,1,0,0,0,2099,2100,5,114,0,0,2100,
	2101,5,148,0,0,2101,2102,5,49,0,0,2102,2103,3,238,119,0,2103,2104,5,50,
	0,0,2104,2215,1,0,0,0,2105,2106,5,114,0,0,2106,2107,5,146,0,0,2107,2108,
	5,49,0,0,2108,2109,3,238,119,0,2109,2110,5,50,0,0,2110,2215,1,0,0,0,2111,
	2112,5,55,0,0,2112,2113,5,49,0,0,2113,2114,3,250,125,0,2114,2115,5,50,0,
	0,2115,2116,5,12,0,0,2116,2117,5,180,0,0,2117,2215,1,0,0,0,2118,2119,5,
	115,0,0,2119,2215,3,228,114,0,2120,2121,5,116,0,0,2121,2215,3,228,114,0,
	2122,2123,5,117,0,0,2123,2215,3,228,114,0,2124,2125,5,118,0,0,2125,2215,
	3,228,114,0,2126,2127,5,119,0,0,2127,2128,5,49,0,0,2128,2129,7,13,0,0,2129,
	2130,5,12,0,0,2130,2131,5,180,0,0,2131,2132,5,5,0,0,2132,2133,3,228,114,
	0,2133,2134,5,50,0,0,2134,2215,1,0,0,0,2135,2136,5,120,0,0,2136,2215,3,
	228,114,0,2137,2138,5,121,0,0,2138,2215,3,228,114,0,2139,2140,5,122,0,0,
	2140,2141,5,49,0,0,2141,2142,3,238,119,0,2142,2143,5,5,0,0,2143,2144,3,
	234,117,0,2144,2145,5,50,0,0,2145,2215,1,0,0,0,2146,2147,5,123,0,0,2147,
	2148,5,49,0,0,2148,2149,3,238,119,0,2149,2150,5,5,0,0,2150,2151,3,234,117,
	0,2151,2152,5,5,0,0,2152,2153,5,145,0,0,2153,2154,5,50,0,0,2154,2215,1,
	0,0,0,2155,2156,5,124,0,0,2156,2157,5,66,0,0,2157,2158,3,238,119,0,2158,
	2159,5,67,0,0,2159,2160,7,14,0,0,2160,2215,1,0,0,0,2161,2162,5,125,0,0,
	2162,2163,5,66,0,0,2163,2164,3,238,119,0,2164,2165,5,67,0,0,2165,2166,7,
	15,0,0,2166,2215,1,0,0,0,2167,2168,7,10,0,0,2168,2215,3,238,119,22,2169,
	2170,7,16,0,0,2170,2215,3,238,119,21,2171,2183,5,66,0,0,2172,2177,3,238,
	119,0,2173,2174,5,5,0,0,2174,2176,3,238,119,0,2175,2173,1,0,0,0,2176,2179,
	1,0,0,0,2177,2175,1,0,0,0,2177,2178,1,0,0,0,2178,2181,1,0,0,0,2179,2177,
	1,0,0,0,2180,2182,5,5,0,0,2181,2180,1,0,0,0,2181,2182,1,0,0,0,2182,2184,
	1,0,0,0,2183,2172,1,0,0,0,2183,2184,1,0,0,0,2184,2185,1,0,0,0,2185,2215,
	5,67,0,0,2186,2187,5,89,0,0,2187,2188,5,12,0,0,2188,2189,5,180,0,0,2189,
	2190,5,12,0,0,2190,2191,5,180,0,0,2191,2192,5,66,0,0,2192,2193,3,238,119,
	0,2193,2194,5,67,0,0,2194,2195,3,240,120,0,2195,2215,1,0,0,0,2196,2197,
	5,89,0,0,2197,2198,5,12,0,0,2198,2203,5,180,0,0,2199,2200,5,66,0,0,2200,
	2201,3,238,119,0,2201,2202,5,67,0,0,2202,2204,1,0,0,0,2203,2199,1,0,0,0,
	2204,2205,1,0,0,0,2205,2203,1,0,0,0,2205,2206,1,0,0,0,2206,2215,1,0,0,0,
	2207,2208,5,89,0,0,2208,2209,5,12,0,0,2209,2215,5,180,0,0,2210,2215,5,89,
	0,0,2211,2215,5,160,0,0,2212,2215,3,14,7,0,2213,2215,3,244,122,0,2214,2044,
	1,0,0,0,2214,2051,1,0,0,0,2214,2058,1,0,0,0,2214,2062,1,0,0,0,2214,2072,
	1,0,0,0,2214,2080,1,0,0,0,2214,2081,1,0,0,0,2214,2087,1,0,0,0,2214,2099,
	1,0,0,0,2214,2105,1,0,0,0,2214,2111,1,0,0,0,2214,2118,1,0,0,0,2214,2120,
	1,0,0,0,2214,2122,1,0,0,0,2214,2124,1,0,0,0,2214,2126,1,0,0,0,2214,2135,
	1,0,0,0,2214,2137,1,0,0,0,2214,2139,1,0,0,0,2214,2146,1,0,0,0,2214,2155,
	1,0,0,0,2214,2161,1,0,0,0,2214,2167,1,0,0,0,2214,2169,1,0,0,0,2214,2171,
	1,0,0,0,2214,2186,1,0,0,0,2214,2196,1,0,0,0,2214,2207,1,0,0,0,2214,2210,
	1,0,0,0,2214,2211,1,0,0,0,2214,2212,1,0,0,0,2214,2213,1,0,0,0,2215,2326,
	1,0,0,0,2216,2217,10,20,0,0,2217,2218,5,17,0,0,2218,2325,3,238,119,20,2219,
	2220,10,19,0,0,2220,2221,7,17,0,0,2221,2325,3,238,119,20,2222,2223,10,18,
	0,0,2223,2224,7,18,0,0,2224,2325,3,238,119,19,2225,2226,10,17,0,0,2226,
	2227,7,19,0,0,2227,2325,3,238,119,18,2228,2229,10,16,0,0,2229,2230,7,20,
	0,0,2230,2325,3,238,119,17,2231,2232,10,15,0,0,2232,2233,7,21,0,0,2233,
	2325,3,238,119,16,2234,2235,10,14,0,0,2235,2236,5,24,0,0,2236,2325,3,238,
	119,15,2237,2238,10,13,0,0,2238,2239,5,26,0,0,2239,2325,3,238,119,14,2240,
	2241,10,12,0,0,2241,2242,5,25,0,0,2242,2325,3,238,119,13,2243,2244,10,11,
	0,0,2244,2245,5,130,0,0,2245,2325,3,238,119,12,2246,2247,10,10,0,0,2247,
	2248,5,131,0,0,2248,2325,3,238,119,11,2249,2250,10,9,0,0,2250,2251,5,132,
	0,0,2251,2252,3,238,119,0,2252,2253,5,110,0,0,2253,2254,3,238,119,9,2254,
	2325,1,0,0,0,2255,2256,10,34,0,0,2256,2258,5,66,0,0,2257,2259,3,238,119,
	0,2258,2257,1,0,0,0,2258,2259,1,0,0,0,2259,2260,1,0,0,0,2260,2262,5,110,
	0,0,2261,2263,3,238,119,0,2262,2261,1,0,0,0,2262,2263,1,0,0,0,2263,2264,
	1,0,0,0,2264,2325,5,67,0,0,2265,2266,10,33,0,0,2266,2267,5,66,0,0,2267,
	2268,5,145,0,0,2268,2325,5,67,0,0,2269,2270,10,32,0,0,2270,2271,5,66,0,
	0,2271,2272,3,238,119,0,2272,2273,5,67,0,0,2273,2325,1,0,0,0,2274,2275,
	10,29,0,0,2275,2325,7,22,0,0,2276,2277,10,28,0,0,2277,2278,5,167,0,0,2278,
	2279,5,49,0,0,2279,2280,3,238,119,0,2280,2281,5,50,0,0,2281,2325,1,0,0,
	0,2282,2283,10,27,0,0,2283,2284,5,168,0,0,2284,2285,5,49,0,0,2285,2286,
	3,238,119,0,2286,2287,5,5,0,0,2287,2288,3,238,119,0,2288,2289,5,50,0,0,
	2289,2325,1,0,0,0,2290,2291,10,26,0,0,2291,2292,5,12,0,0,2292,2294,5,180,
	0,0,2293,2295,3,230,115,0,2294,2293,1,0,0,0,2294,2295,1,0,0,0,2295,2296,
	1,0,0,0,2296,2297,5,49,0,0,2297,2309,5,4,0,0,2298,2303,3,226,113,0,2299,
	2300,5,5,0,0,2300,2302,3,226,113,0,2301,2299,1,0,0,0,2302,2305,1,0,0,0,
	2303,2301,1,0,0,0,2303,2304,1,0,0,0,2304,2307,1,0,0,0,2305,2303,1,0,0,0,
	2306,2308,5,5,0,0,2307,2306,1,0,0,0,2307,2308,1,0,0,0,2308,2310,1,0,0,0,
	2309,2298,1,0,0,0,2309,2310,1,0,0,0,2310,2311,1,0,0,0,2311,2312,5,6,0,0,
	2312,2325,5,50,0,0,2313,2314,10,25,0,0,2314,2315,5,12,0,0,2315,2317,5,180,
	0,0,2316,2318,3,230,115,0,2317,2316,1,0,0,0,2317,2318,1,0,0,0,2318,2319,
	1,0,0,0,2319,2325,3,228,114,0,2320,2321,10,24,0,0,2321,2325,3,240,120,0,
	2322,2323,10,23,0,0,2323,2325,7,10,0,0,2324,2216,1,0,0,0,2324,2219,1,0,
	0,0,2324,2222,1,0,0,0,2324,2225,1,0,0,0,2324,2228,1,0,0,0,2324,2231,1,0,
	0,0,2324,2234,1,0,0,0,2324,2237,1,0,0,0,2324,2240,1,0,0,0,2324,2243,1,0,
	0,0,2324,2246,1,0,0,0,2324,2249,1,0,0,0,2324,2255,1,0,0,0,2324,2265,1,0,
	0,0,2324,2269,1,0,0,0,2324,2274,1,0,0,0,2324,2276,1,0,0,0,2324,2282,1,0,
	0,0,2324,2290,1,0,0,0,2324,2313,1,0,0,0,2324,2320,1,0,0,0,2324,2322,1,0,
	0,0,2325,2328,1,0,0,0,2326,2324,1,0,0,0,2326,2327,1,0,0,0,2327,239,1,0,
	0,0,2328,2326,1,0,0,0,2329,2330,5,12,0,0,2330,2343,5,180,0,0,2331,2343,
	5,163,0,0,2332,2343,5,172,0,0,2333,2343,5,173,0,0,2334,2343,5,174,0,0,2335,
	2343,5,175,0,0,2336,2343,5,176,0,0,2337,2343,5,177,0,0,2338,2343,5,178,
	0,0,2339,2343,5,179,0,0,2340,2343,5,170,0,0,2341,2343,5,171,0,0,2342,2329,
	1,0,0,0,2342,2331,1,0,0,0,2342,2332,1,0,0,0,2342,2333,1,0,0,0,2342,2334,
	1,0,0,0,2342,2335,1,0,0,0,2342,2336,1,0,0,0,2342,2337,1,0,0,0,2342,2338,
	1,0,0,0,2342,2339,1,0,0,0,2342,2340,1,0,0,0,2342,2341,1,0,0,0,2343,241,
	1,0,0,0,2344,2345,7,23,0,0,2345,243,1,0,0,0,2346,2361,5,141,0,0,2347,2361,
	3,246,123,0,2348,2361,3,248,124,0,2349,2353,5,151,0,0,2350,2352,5,151,0,
	0,2351,2350,1,0,0,0,2352,2355,1,0,0,0,2353,2351,1,0,0,0,2353,2354,1,0,0,
	0,2354,2361,1,0,0,0,2355,2353,1,0,0,0,2356,2361,5,161,0,0,2357,2361,5,162,
	0,0,2358,2361,5,152,0,0,2359,2361,5,153,0,0,2360,2346,1,0,0,0,2360,2347,
	1,0,0,0,2360,2348,1,0,0,0,2360,2349,1,0,0,0,2360,2356,1,0,0,0,2360,2357,
	1,0,0,0,2360,2358,1,0,0,0,2360,2359,1,0,0,0,2361,245,1,0,0,0,2362,2364,
	5,145,0,0,2363,2365,7,24,0,0,2364,2363,1,0,0,0,2364,2365,1,0,0,0,2365,247,
	1,0,0,0,2366,2368,5,144,0,0,2367,2369,7,24,0,0,2368,2367,1,0,0,0,2368,2369,
	1,0,0,0,2369,249,1,0,0,0,2370,2371,5,108,0,0,2371,2421,5,59,0,0,2372,2421,
	5,108,0,0,2373,2421,5,146,0,0,2374,2421,5,147,0,0,2375,2421,5,149,0,0,2376,
	2421,5,148,0,0,2377,2421,5,156,0,0,2378,2421,5,157,0,0,2379,2421,5,138,
	0,0,2380,2421,5,139,0,0,2381,2421,5,158,0,0,2382,2421,5,159,0,0,2383,2384,
	5,7,0,0,2384,2393,5,49,0,0,2385,2390,3,250,125,0,2386,2387,5,5,0,0,2387,
	2389,3,250,125,0,2388,2386,1,0,0,0,2389,2392,1,0,0,0,2390,2388,1,0,0,0,
	2390,2391,1,0,0,0,2391,2394,1,0,0,0,2392,2390,1,0,0,0,2393,2385,1,0,0,0,
	2393,2394,1,0,0,0,2394,2395,1,0,0,0,2395,2399,5,50,0,0,2396,2398,7,25,0,
	0,2397,2396,1,0,0,0,2398,2401,1,0,0,0,2399,2397,1,0,0,0,2399,2400,1,0,0,
	0,2400,2414,1,0,0,0,2401,2399,1,0,0,0,2402,2403,5,73,0,0,2403,2404,5,49,
	0,0,2404,2409,3,250,125,0,2405,2406,5,5,0,0,2406,2408,3,250,125,0,2407,
	2405,1,0,0,0,2408,2411,1,0,0,0,2409,2407,1,0,0,0,2409,2410,1,0,0,0,2410,
	2412,1,0,0,0,2411,2409,1,0,0,0,2412,2413,5,50,0,0,2413,2415,1,0,0,0,2414,
	2402,1,0,0,0,2414,2415,1,0,0,0,2415,2421,1,0,0,0,2416,2417,5,180,0,0,2417,
	2418,5,12,0,0,2418,2421,5,180,0,0,2419,2421,5,180,0,0,2420,2370,1,0,0,0,
	2420,2372,1,0,0,0,2420,2373,1,0,0,0,2420,2374,1,0,0,0,2420,2375,1,0,0,0,
	2420,2376,1,0,0,0,2420,2377,1,0,0,0,2420,2378,1,0,0,0,2420,2379,1,0,0,0,
	2420,2380,1,0,0,0,2420,2381,1,0,0,0,2420,2382,1,0,0,0,2420,2383,1,0,0,0,
	2420,2416,1,0,0,0,2420,2419,1,0,0,0,2421,251,1,0,0,0,2422,2423,7,26,0,0,
	2423,253,1,0,0,0,278,257,263,277,279,299,303,310,315,323,327,333,345,348,
	358,362,370,373,377,382,386,402,406,413,416,419,433,436,447,449,464,479,
	483,499,501,507,512,520,523,540,542,549,556,558,562,574,578,580,584,590,
	593,596,606,610,612,619,623,625,633,640,653,657,664,684,690,696,703,713,
	720,726,730,736,744,752,759,766,773,778,782,788,793,795,801,808,810,816,
	818,824,829,835,842,848,854,858,863,871,876,884,894,899,903,909,916,921,
	927,931,933,940,945,949,959,961,965,971,978,994,1003,1007,1013,1022,1026,
	1034,1038,1044,1048,1054,1058,1060,1068,1072,1074,1082,1086,1092,1096,1102,
	1106,1108,1114,1119,1125,1153,1166,1177,1193,1205,1209,1214,1226,1235,1239,
	1241,1250,1255,1261,1270,1272,1280,1286,1294,1300,1304,1314,1326,1336,1347,
	1354,1360,1369,1376,1398,1410,1420,1428,1438,1441,1450,1460,1472,1480,1525,
	1534,1540,1555,1565,1570,1575,1578,1595,1605,1610,1612,1634,1642,1646,1654,
	1672,1680,1685,1692,1707,1710,1713,1736,1739,1748,1751,1758,1767,1770,1780,
	1782,1792,1805,1809,1819,1827,1833,1839,1848,1852,1854,1860,1868,1872,1874,
	1877,1890,1896,1905,1909,1911,1920,1934,1944,1952,1956,1958,1976,1980,1982,
	1986,1998,2002,2004,2014,2018,2032,2036,2042,2068,2076,2084,2093,2177,2181,
	2183,2205,2214,2258,2262,2294,2303,2307,2309,2317,2324,2326,2342,2353,2360,
	2364,2368,2390,2393,2399,2409,2414,2420];

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
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
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


export class BlockStatementContext extends ParserRuleContext {
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
    	return SolidCashParser.RULE_blockStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitBlockStatement) {
			return visitor.visitBlockStatement(this);
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
	public blockStatement(): BlockStatementContext {
		return this.getTypedRuleContext(BlockStatementContext, 0) as BlockStatementContext;
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
