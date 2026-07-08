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
	public static readonly RULE_assignChain = 59;
	public static readonly RULE_prefixIncDecStatement = 60;
	public static readonly RULE_returnStatement = 61;
	public static readonly RULE_selfdestructStatement = 62;
	public static readonly RULE_emitStatement = 63;
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
	public static readonly RULE_dataLocation = 123;
	public static readonly RULE_literal = 124;
	public static readonly RULE_numberLiteral = 125;
	public static readonly RULE_decimalLiteral = 126;
	public static readonly RULE_typeName = 127;
	public static readonly RULE_typeCast = 128;
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
		"statement", "expressionStatement", "assignChain", "prefixIncDecStatement", 
		"returnStatement", "selfdestructStatement", "emitStatement", "variableDefinition", 
		"tupleAssignment", "tupleSlot", "pushArgument", "deleteStatement", "timeOpStatement", 
		"requireStatement", "ifStatement", "loopStatement", "forOfEntriesStatement", 
		"forInStatement", "forOfStatement", "forStatement", "forInit", "forCondition", 
		"forUpdate", "doWhileStatement", "whileStatement", "consoleStatement", 
		"assemblyStatement", "yulBlock", "yulStatement", "yulVariableDeclaration", 
		"yulAssignment", "yulIf", "yulSwitch", "yulCase", "yulDefault", "yulForLoop", 
		"yulFunctionDefinition", "yulExpression", "yulFunctionCall", "yulFunctionName", 
		"yulPath", "yulLiteral", "uncheckedStatement", "switchStatement", "switchCase", 
		"switchDefault", "tryCatchStatement", "tryReturns", "catchClause", "breakStatement", 
		"continueStatement", "requireMessage", "revertStatement", "assertStatement", 
		"consoleParameter", "consoleParameterList", "functionCall", "namedArg", 
		"expressionList", "callOptions", "callOption", "typeList", "typeListItem", 
		"expression", "memberName", "modifier", "dataLocation", "literal", "numberLiteral", 
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
			this.state = 261;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===37) {
				{
				{
				this.state = 258;
				this.pragmaDirective();
				}
				}
				this.state = 263;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 267;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===1) {
				{
				{
				this.state = 264;
				this.importDirective();
				}
				}
				this.state = 269;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 283;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1850433) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 281;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 2, this._ctx) ) {
				case 1:
					{
					this.state = 270;
					this.constantDefinition();
					}
					break;
				case 2:
					{
					this.state = 271;
					this.enumDefinition();
					}
					break;
				case 3:
					{
					this.state = 272;
					this.structDefinition();
					}
					break;
				case 4:
					{
					this.state = 273;
					this.typeDefinition();
					}
					break;
				case 5:
					{
					this.state = 274;
					this.usingForDirective();
					}
					break;
				case 6:
					{
					this.state = 275;
					this.errorDefinition();
					}
					break;
				case 7:
					{
					this.state = 276;
					this.eventDefinition();
					}
					break;
				case 8:
					{
					this.state = 277;
					this.interfaceDefinition();
					}
					break;
				case 9:
					{
					this.state = 278;
					this.freeFunctionDefinition();
					}
					break;
				case 10:
					{
					this.state = 279;
					this.libraryDefinition();
					}
					break;
				case 11:
					{
					this.state = 280;
					this.contractDefinition();
					}
					break;
				}
				}
				this.state = 285;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 286;
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
			this.state = 314;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 6, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 288;
				this.match(SolidCashParser.T__0);
				this.state = 289;
				this.match(SolidCashParser.StringLiteral);
				this.state = 290;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 291;
				this.match(SolidCashParser.T__0);
				this.state = 292;
				this.match(SolidCashParser.StringLiteral);
				this.state = 293;
				this.match(SolidCashParser.T__2);
				this.state = 294;
				this.match(SolidCashParser.Identifier);
				this.state = 295;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 296;
				this.match(SolidCashParser.T__0);
				this.state = 297;
				this.match(SolidCashParser.T__3);
				this.state = 298;
				this.importBinding();
				this.state = 303;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 299;
						this.match(SolidCashParser.T__4);
						this.state = 300;
						this.importBinding();
						}
						}
					}
					this.state = 305;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				}
				this.state = 307;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 306;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 309;
				this.match(SolidCashParser.T__5);
				this.state = 310;
				this.match(SolidCashParser.Identifier);
				this.state = 311;
				this.match(SolidCashParser.StringLiteral);
				this.state = 312;
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
			this.state = 316;
			this.match(SolidCashParser.Identifier);
			this.state = 319;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 317;
				this.match(SolidCashParser.T__2);
				this.state = 318;
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
			this.state = 321;
			this.match(SolidCashParser.T__6);
			this.state = 322;
			this.anyIdentifier();
			this.state = 323;
			this.parameterList();
			this.state = 327;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 324;
				this.functionModifier();
				}
				}
				this.state = 329;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 331;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 330;
				this.returnType();
				}
			}

			this.state = 333;
			this.match(SolidCashParser.T__3);
			this.state = 337;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 334;
				this.statement();
				}
				}
				this.state = 339;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 340;
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
			this.state = 381;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 17, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 342;
				this.match(SolidCashParser.T__7);
				this.state = 343;
				this.match(SolidCashParser.Identifier);
				this.state = 344;
				this.match(SolidCashParser.T__8);
				this.state = 349;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 11, this._ctx) ) {
				case 1:
					{
					this.state = 345;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 346;
					this.mappingType();
					}
					break;
				case 3:
					{
					this.state = 347;
					this.typeName();
					}
					break;
				case 4:
					{
					this.state = 348;
					this.match(SolidCashParser.T__9);
					}
					break;
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
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 355;
				this.match(SolidCashParser.T__7);
				this.state = 356;
				this.match(SolidCashParser.T__3);
				this.state = 357;
				this.usingFunctionBinding();
				this.state = 362;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 358;
						this.match(SolidCashParser.T__4);
						this.state = 359;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 364;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				}
				this.state = 366;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 365;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 368;
				this.match(SolidCashParser.T__5);
				this.state = 369;
				this.match(SolidCashParser.T__8);
				this.state = 374;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 15, this._ctx) ) {
				case 1:
					{
					this.state = 370;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 371;
					this.mappingType();
					}
					break;
				case 3:
					{
					this.state = 372;
					this.typeName();
					}
					break;
				case 4:
					{
					this.state = 373;
					this.match(SolidCashParser.T__9);
					}
					break;
				}
				this.state = 377;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 376;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 379;
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
			this.state = 383;
			this.match(SolidCashParser.Identifier);
			this.state = 386;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===12) {
				{
				this.state = 384;
				this.match(SolidCashParser.T__11);
				this.state = 385;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 390;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 388;
				this.match(SolidCashParser.T__2);
				this.state = 389;
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
			this.state = 392;
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
			this.state = 394;
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
			this.state = 410;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 21, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 396;
				this.match(SolidCashParser.T__36);
				this.state = 397;
				this.pragmaName();
				this.state = 398;
				this.pragmaValue();
				this.state = 399;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 401;
				this.match(SolidCashParser.T__36);
				this.state = 402;
				this.match(SolidCashParser.Identifier);
				this.state = 406;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===38 || ((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 2081) !== 0) || _la===180) {
					{
					{
					this.state = 403;
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
					this.state = 408;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 409;
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
			this.state = 412;
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
			this.state = 420;
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
				this.state = 415;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 414;
					this.versionConstraint();
					}
					}
					this.state = 417;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0) || _la===140 || _la===144);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 419;
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
			this.state = 423;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0)) {
				{
				this.state = 422;
				this.versionOperator();
				}
			}

			this.state = 425;
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
			this.state = 427;
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
			this.state = 429;
			this.match(SolidCashParser.T__40);
			this.state = 430;
			this.match(SolidCashParser.Identifier);
			this.state = 440;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 431;
				this.match(SolidCashParser.T__41);
				this.state = 432;
				this.match(SolidCashParser.Identifier);
				this.state = 437;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 433;
					this.match(SolidCashParser.T__4);
					this.state = 434;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 439;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 442;
			this.match(SolidCashParser.T__3);
			this.state = 453;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1843969) !== 0)) {
				{
				this.state = 451;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 27, this._ctx) ) {
				case 1:
					{
					this.state = 443;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 444;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 445;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 446;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 447;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 448;
					this.interfaceStateVariable();
					}
					break;
				case 7:
					{
					this.state = 449;
					this.interfaceCollection();
					}
					break;
				case 8:
					{
					this.state = 450;
					this.interfaceFunction();
					}
					break;
				}
				}
				this.state = 455;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 456;
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
			this.state = 468;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 29, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 458;
				this.interfaceStateVariableVisibility();
				this.state = 459;
				this.mappingType();
				this.state = 460;
				this.match(SolidCashParser.Identifier);
				this.state = 461;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 463;
				this.interfaceStateVariableVisibility();
				this.state = 464;
				this.arrayType(0);
				this.state = 465;
				this.match(SolidCashParser.Identifier);
				this.state = 466;
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
			this.state = 470;
			this.interfaceStateVariableVisibility();
			this.state = 471;
			this.typeName();
			this.state = 472;
			this.match(SolidCashParser.Identifier);
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
	public interfaceStateVariableVisibility(): InterfaceStateVariableVisibilityContext {
		let localctx: InterfaceStateVariableVisibilityContext = new InterfaceStateVariableVisibilityContext(this, this._ctx, this.state);
		this.enterRule(localctx, 32, SolidCashParser.RULE_interfaceStateVariableVisibility);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 475;
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
			this.state = 477;
			this.match(SolidCashParser.T__6);
			this.state = 478;
			this.match(SolidCashParser.Identifier);
			this.state = 479;
			this.parameterList();
			this.state = 483;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 480;
				this.functionModifier();
				}
				}
				this.state = 485;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 487;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 486;
				this.returnType();
				}
			}

			this.state = 489;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 491;
			this.match(SolidCashParser.T__44);
			this.state = 492;
			this.match(SolidCashParser.Identifier);
			this.state = 493;
			this.match(SolidCashParser.T__3);
			this.state = 505;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 815538945) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 503;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 32, this._ctx) ) {
				case 1:
					{
					this.state = 494;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 495;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 496;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 497;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 498;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 499;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 500;
					this.stateVariableDeclaration();
					}
					break;
				case 8:
					{
					this.state = 501;
					this.usingForDirective();
					}
					break;
				case 9:
					{
					this.state = 502;
					this.freeFunctionDefinition();
					}
					break;
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
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 268435459) !== 0) || ((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 37411875) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 544;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 38, this._ctx) ) {
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
			this.state = 562;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0) || _la===180) {
				{
				this.state = 560;
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
					this.state = 558;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 559;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 564;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 566;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 565;
				this.returnType();
				}
			}

			this.state = 568;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 570;
			this.match(SolidCashParser.T__47);
			this.state = 571;
			this.match(SolidCashParser.Identifier);
			this.state = 572;
			this.match(SolidCashParser.T__48);
			this.state = 584;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 573;
				this.eventParameter();
				this.state = 578;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 44, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 574;
						this.match(SolidCashParser.T__4);
						this.state = 575;
						this.eventParameter();
						}
						}
					}
					this.state = 580;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 44, this._ctx);
				}
				this.state = 582;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 581;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 586;
			this.match(SolidCashParser.T__49);
			this.state = 588;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===51) {
				{
				this.state = 587;
				this.match(SolidCashParser.T__50);
				}
			}

			this.state = 590;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 594;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 48, this._ctx) ) {
			case 1:
				{
				this.state = 592;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 593;
				this.arrayType(0);
				}
				break;
			}
			this.state = 597;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===52) {
				{
				this.state = 596;
				this.match(SolidCashParser.T__51);
				}
			}

			this.state = 600;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 599;
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
			this.state = 602;
			this.match(SolidCashParser.T__34);
			this.state = 603;
			this.match(SolidCashParser.Identifier);
			this.state = 604;
			this.match(SolidCashParser.T__48);
			this.state = 616;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 605;
				this.errorParameter();
				this.state = 610;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 606;
						this.match(SolidCashParser.T__4);
						this.state = 607;
						this.errorParameter();
						}
						}
					}
					this.state = 612;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				}
				this.state = 614;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 613;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 618;
			this.match(SolidCashParser.T__49);
			this.state = 619;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 629;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 56, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 621;
				this.typeName();
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
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 625;
				this.arrayType(0);
				this.state = 627;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 626;
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
			this.state = 631;
			this.match(SolidCashParser.T__52);
			this.state = 632;
			this.match(SolidCashParser.Identifier);
			this.state = 633;
			this.match(SolidCashParser.T__3);
			this.state = 635;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 634;
				this.structField();
				}
				}
				this.state = 637;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180);
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
	public structField(): StructFieldContext {
		let localctx: StructFieldContext = new StructFieldContext(this, this._ctx, this.state);
		this.enterRule(localctx, 54, SolidCashParser.RULE_structField);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 644;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 58, this._ctx) ) {
			case 1:
				{
				this.state = 641;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 642;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 643;
				this.mappingType();
				}
				break;
			}
			this.state = 646;
			this.anyIdentifier();
			this.state = 647;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 649;
			this.match(SolidCashParser.T__53);
			this.state = 650;
			this.match(SolidCashParser.Identifier);
			this.state = 651;
			this.match(SolidCashParser.T__3);
			this.state = 652;
			this.enumMember();
			this.state = 657;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 59, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 653;
					this.match(SolidCashParser.T__4);
					this.state = 654;
					this.enumMember();
					}
					}
				}
				this.state = 659;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 59, this._ctx);
			}
			this.state = 661;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 660;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 663;
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
			this.state = 665;
			this.match(SolidCashParser.Identifier);
			this.state = 668;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 666;
				this.match(SolidCashParser.T__39);
				this.state = 667;
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
			this.state = 670;
			this.match(SolidCashParser.T__54);
			this.state = 671;
			this.match(SolidCashParser.Identifier);
			this.state = 672;
			this.match(SolidCashParser.T__41);
			this.state = 673;
			this.typeName();
			this.state = 674;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 676;
			this.typeName();
			this.state = 677;
			this.match(SolidCashParser.T__55);
			this.state = 678;
			this.match(SolidCashParser.Identifier);
			this.state = 679;
			this.match(SolidCashParser.T__39);
			this.state = 680;
			this.expression(0);
			this.state = 681;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 683;
			this.match(SolidCashParser.T__56);
			this.state = 684;
			this.parameterList();
			this.state = 688;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 62, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 685;
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
				}
				this.state = 690;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 62, this._ctx);
			}
			this.state = 694;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 63, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 691;
					this.parentInvocation();
					}
					}
				}
				this.state = 696;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 63, this._ctx);
			}
			this.state = 700;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 98307) !== 0)) {
				{
				{
				this.state = 697;
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
				this.state = 702;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 706;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 703;
				this.customModifierInvocation();
				}
				}
				this.state = 708;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 709;
			this.match(SolidCashParser.T__3);
			this.state = 713;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
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
	public fallbackDefinition(): FallbackDefinitionContext {
		let localctx: FallbackDefinitionContext = new FallbackDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 66, SolidCashParser.RULE_fallbackDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 718;
			this.match(SolidCashParser.T__59);
			this.state = 719;
			this.parameterList();
			this.state = 723;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 8197) !== 0)) {
				{
				{
				this.state = 720;
				this.fallbackModifier();
				}
				}
				this.state = 725;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 726;
			this.match(SolidCashParser.T__43);
			this.state = 730;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 8197) !== 0)) {
				{
				{
				this.state = 727;
				this.fallbackModifier();
				}
				}
				this.state = 732;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 736;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 733;
				this.customModifierInvocation();
				}
				}
				this.state = 738;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 740;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 739;
				this.returnType();
				}
			}

			this.state = 742;
			this.match(SolidCashParser.T__3);
			this.state = 746;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 743;
				this.statement();
				}
				}
				this.state = 748;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 749;
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
			this.state = 754;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 59:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 751;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 752;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 753;
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
			this.state = 824;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 83, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 756;
				this.match(SolidCashParser.T__61);
				this.state = 757;
				this.match(SolidCashParser.T__48);
				this.state = 758;
				this.match(SolidCashParser.T__49);
				this.state = 762;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===61 || _la===72) {
					{
					{
					this.state = 759;
					this.receiveModifier();
					}
					}
					this.state = 764;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 765;
				this.match(SolidCashParser.T__43);
				this.state = 769;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===61 || _la===72) {
					{
					{
					this.state = 766;
					this.receiveModifier();
					}
					}
					this.state = 771;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 772;
				this.match(SolidCashParser.T__58);
				this.state = 776;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===61 || _la===72) {
					{
					{
					this.state = 773;
					this.receiveModifier();
					}
					}
					this.state = 778;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 788;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 4:
					{
					this.state = 779;
					this.match(SolidCashParser.T__3);
					this.state = 783;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
						{
						{
						this.state = 780;
						this.statement();
						}
						}
						this.state = 785;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 786;
					this.match(SolidCashParser.T__5);
					}
					break;
				case 2:
					{
					this.state = 787;
					this.match(SolidCashParser.T__1);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 790;
				this.match(SolidCashParser.T__61);
				this.state = 791;
				this.match(SolidCashParser.T__48);
				this.state = 792;
				this.match(SolidCashParser.T__49);
				this.state = 796;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===61 || _la===72) {
					{
					{
					this.state = 793;
					this.receiveModifier();
					}
					}
					this.state = 798;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 799;
				this.match(SolidCashParser.T__58);
				this.state = 803;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===61 || _la===72) {
					{
					{
					this.state = 800;
					this.receiveModifier();
					}
					}
					this.state = 805;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 806;
				this.match(SolidCashParser.T__43);
				this.state = 810;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===61 || _la===72) {
					{
					{
					this.state = 807;
					this.receiveModifier();
					}
					}
					this.state = 812;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 822;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 4:
					{
					this.state = 813;
					this.match(SolidCashParser.T__3);
					this.state = 817;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
						{
						{
						this.state = 814;
						this.statement();
						}
						}
						this.state = 819;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 820;
					this.match(SolidCashParser.T__5);
					}
					break;
				case 2:
					{
					this.state = 821;
					this.match(SolidCashParser.T__1);
					}
					break;
				default:
					throw new NoViableAltException(this);
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
	public receiveModifier(): ReceiveModifierContext {
		let localctx: ReceiveModifierContext = new ReceiveModifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 72, SolidCashParser.RULE_receiveModifier);
		try {
			this.state = 828;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 61:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 826;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 827;
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
			this.state = 830;
			this.match(SolidCashParser.Identifier);
			this.state = 831;
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
			this.state = 904;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 99, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 834;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 833;
					this.stateVariableVisibility();
					}
				}

				this.state = 836;
				this.typeName();
				this.state = 841;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					this.state = 839;
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
						this.state = 837;
						this.modifier();
						}
						break;
					case 72:
						{
						this.state = 838;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 843;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 844;
				this.match(SolidCashParser.Identifier);
				this.state = 847;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 845;
					this.match(SolidCashParser.T__39);
					this.state = 846;
					this.expression(0);
					}
				}

				this.state = 849;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 851;
				this.typeName();
				this.state = 856;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					this.state = 854;
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
						this.state = 852;
						this.modifier();
						}
						break;
					case 72:
						{
						this.state = 853;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 858;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 859;
				this.stateVariableVisibility();
				this.state = 864;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					this.state = 862;
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
						this.state = 860;
						this.modifier();
						}
						break;
					case 72:
						{
						this.state = 861;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 866;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 867;
				this.match(SolidCashParser.Identifier);
				this.state = 870;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 868;
					this.match(SolidCashParser.T__39);
					this.state = 869;
					this.expression(0);
					}
				}

				this.state = 872;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 875;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 874;
					this.stateVariableVisibility();
					}
				}

				this.state = 877;
				this.mappingType();
				this.state = 881;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 878;
					this.collectionModifier();
					}
					}
					this.state = 883;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 884;
				this.match(SolidCashParser.Identifier);
				this.state = 885;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 888;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 887;
					this.stateVariableVisibility();
					}
				}

				this.state = 890;
				this.arrayType(0);
				this.state = 894;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 891;
					this.collectionModifier();
					}
					}
					this.state = 896;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 897;
				this.match(SolidCashParser.Identifier);
				this.state = 900;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 898;
					this.match(SolidCashParser.T__39);
					this.state = 899;
					this.expression(0);
					}
				}

				this.state = 902;
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
			this.state = 909;
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
				this.state = 906;
				this.modifier();
				}
				break;
			case 43:
			case 44:
			case 58:
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 907;
				this.stateVariableVisibility();
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 908;
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
			this.state = 911;
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
			this.state = 949;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 106, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 913;
				this.match(SolidCashParser.T__63);
				this.state = 914;
				this.match(SolidCashParser.T__48);
				this.state = 915;
				this.typeName();
				this.state = 917;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 916;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 919;
				this.match(SolidCashParser.T__64);
				this.state = 920;
				this.typeName();
				this.state = 922;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 921;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 924;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 926;
				this.match(SolidCashParser.T__63);
				this.state = 927;
				this.match(SolidCashParser.T__48);
				this.state = 928;
				this.typeName();
				this.state = 930;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 929;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 932;
				this.match(SolidCashParser.T__64);
				this.state = 933;
				this.mappingType();
				this.state = 934;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 936;
				this.match(SolidCashParser.T__63);
				this.state = 937;
				this.match(SolidCashParser.T__48);
				this.state = 938;
				this.typeName();
				this.state = 940;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 939;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 942;
				this.match(SolidCashParser.T__64);
				this.state = 943;
				this.arrayType(0);
				this.state = 945;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 944;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 947;
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
			this.state = 952;
			this.typeName();
			this.state = 953;
			this.match(SolidCashParser.T__65);
			this.state = 955;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
				{
				this.state = 954;
				this.expression(0);
				}
			}

			this.state = 957;
			this.match(SolidCashParser.T__66);
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 967;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 109, this._ctx);
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
					this.state = 959;
					if (!(this.precpred(this._ctx, 1))) {
						throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
					}
					this.state = 960;
					this.match(SolidCashParser.T__65);
					this.state = 962;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
						{
						this.state = 961;
						this.expression(0);
						}
					}

					this.state = 964;
					this.match(SolidCashParser.T__66);
					}
					}
				}
				this.state = 969;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 109, this._ctx);
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
			this.state = 970;
			this.match(SolidCashParser.T__67);
			this.state = 971;
			this.match(SolidCashParser.Identifier);
			this.state = 973;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 972;
				this.parameterList();
				}
			}

			this.state = 979;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===61 || _la===72) {
				{
				this.state = 977;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 61:
					{
					this.state = 975;
					this.match(SolidCashParser.T__60);
					}
					break;
				case 72:
					{
					this.state = 976;
					this.overrideSpecifier();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 981;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 991;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				{
				this.state = 982;
				this.match(SolidCashParser.T__3);
				this.state = 986;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
					{
					{
					this.state = 983;
					this.modifierStatement();
					}
					}
					this.state = 988;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 989;
				this.match(SolidCashParser.T__5);
				}
				break;
			case 2:
				{
				this.state = 990;
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
			this.state = 995;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 115, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 993;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 994;
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
			this.state = 997;
			this.match(SolidCashParser.T__68);
			this.state = 998;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1000;
			this.match(SolidCashParser.T__6);
			this.state = 1001;
			this.anyIdentifier();
			this.state = 1002;
			this.parameterList();
			this.state = 1007;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0) || _la===180) {
				{
				this.state = 1005;
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
					this.state = 1003;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 1004;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 1009;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1011;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 1010;
				this.returnType();
				}
			}

			this.state = 1013;
			this.match(SolidCashParser.T__3);
			this.state = 1017;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1014;
				this.statement();
				}
				}
				this.state = 1019;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1020;
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
			this.state = 1022;
			this.match(SolidCashParser.Identifier);
			this.state = 1024;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 1023;
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
			this.state = 1040;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 70:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1026;
				this.match(SolidCashParser.T__69);
				}
				break;
			case 71:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1027;
				this.match(SolidCashParser.T__70);
				}
				break;
			case 58:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1028;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 44:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1029;
				this.match(SolidCashParser.T__43);
				}
				break;
			case 43:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1030;
				this.match(SolidCashParser.T__42);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1031;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 59:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1032;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1033;
				this.overrideSpecifier();
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1034;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1035;
				this.unsafeModifier();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1036;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1037;
				this.match(SolidCashParser.T__27);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1038;
				this.match(SolidCashParser.T__30);
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1039;
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
			this.state = 1042;
			this.match(SolidCashParser.T__71);
			this.state = 1053;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 1043;
				this.match(SolidCashParser.T__48);
				this.state = 1044;
				this.match(SolidCashParser.Identifier);
				this.state = 1049;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1045;
					this.match(SolidCashParser.T__4);
					this.state = 1046;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1051;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1052;
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
			this.state = 1055;
			this.match(SolidCashParser.T__31);
			this.state = 1059;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 1056;
				this.match(SolidCashParser.T__48);
				this.state = 1057;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1058;
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
			this.state = 1061;
			this.match(SolidCashParser.T__72);
			this.state = 1062;
			this.match(SolidCashParser.T__48);
			this.state = 1063;
			this.returnParam();
			this.state = 1068;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 125, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1064;
					this.match(SolidCashParser.T__4);
					this.state = 1065;
					this.returnParam();
					}
					}
				}
				this.state = 1070;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 125, this._ctx);
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

			this.state = 1074;
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
			this.state = 1106;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 133, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1076;
				this.typeName();
				this.state = 1080;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 127, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1077;
						this.modifier();
						}
						}
					}
					this.state = 1082;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 127, this._ctx);
				}
				this.state = 1084;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1083;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1086;
				this.arrayType(0);
				this.state = 1090;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 129, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1087;
						this.modifier();
						}
						}
					}
					this.state = 1092;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 129, this._ctx);
				}
				this.state = 1094;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1093;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1096;
				this.mappingType();
				this.state = 1100;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 131, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1097;
						this.modifier();
						}
						}
					}
					this.state = 1102;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 131, this._ctx);
				}
				this.state = 1104;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1103;
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
			this.state = 1108;
			this.match(SolidCashParser.T__48);
			this.state = 1120;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1109;
				this.parameter();
				this.state = 1114;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 134, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1110;
						this.match(SolidCashParser.T__4);
						this.state = 1111;
						this.parameter();
						}
						}
					}
					this.state = 1116;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 134, this._ctx);
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

				}
			}

			this.state = 1122;
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
			this.state = 1154;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 143, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1124;
				this.typeName();
				this.state = 1128;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 137, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1125;
						this.modifier();
						}
						}
					}
					this.state = 1130;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 137, this._ctx);
				}
				this.state = 1132;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1131;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1134;
				this.arrayType(0);
				this.state = 1138;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 139, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1135;
						this.modifier();
						}
						}
					}
					this.state = 1140;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 139, this._ctx);
				}
				this.state = 1142;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1141;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1144;
				this.mappingType();
				this.state = 1148;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 141, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1145;
						this.modifier();
						}
						}
					}
					this.state = 1150;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 141, this._ctx);
				}
				this.state = 1152;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1151;
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
			this.state = 1165;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 145, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1156;
				this.match(SolidCashParser.T__3);
				this.state = 1160;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
					{
					{
					this.state = 1157;
					this.statement();
					}
					}
					this.state = 1162;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1163;
				this.match(SolidCashParser.T__5);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1164;
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
			this.state = 1167;
			this.match(SolidCashParser.T__3);
			this.state = 1171;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1168;
				this.statement();
				}
				}
				this.state = 1173;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1174;
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
			this.state = 1199;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 147, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1176;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1177;
				this.blockStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1178;
				this.variableDefinition();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1179;
				this.tupleAssignment();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1180;
				this.prefixIncDecStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1181;
				this.timeOpStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1182;
				this.requireStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1183;
				this.ifStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1184;
				this.loopStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1185;
				this.consoleStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1186;
				this.emitStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1187;
				this.returnStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1188;
				this.selfdestructStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1189;
				this.assemblyStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1190;
				this.tryCatchStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1191;
				this.revertStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1192;
				this.assertStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1193;
				this.deleteStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1194;
				this.uncheckedStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1195;
				this.switchStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1196;
				this.breakStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1197;
				this.continueStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1198;
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
			this.state = 1201;
			this.expression(0);
			this.state = 1223;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 149, this._ctx) ) {
			case 1:
				{
				this.state = 1202;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1203;
				this.assignChain();
				}
				break;
			case 2:
				{
				this.state = 1204;
				this.match(SolidCashParser.DotPush);
				this.state = 1205;
				this.match(SolidCashParser.T__48);
				this.state = 1206;
				this.match(SolidCashParser.T__49);
				this.state = 1207;
				this.match(SolidCashParser.T__39);
				this.state = 1208;
				this.expression(0);
				}
				break;
			case 3:
				{
				this.state = 1209;
				this.match(SolidCashParser.DotPush);
				this.state = 1210;
				this.match(SolidCashParser.T__48);
				this.state = 1212;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 1211;
					this.pushArgument();
					}
				}

				this.state = 1214;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 4:
				{
				this.state = 1215;
				this.match(SolidCashParser.DotPop);
				this.state = 1216;
				this.match(SolidCashParser.T__48);
				this.state = 1217;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 5:
				{
				this.state = 1218;
				this.match(SolidCashParser.DotDelete);
				this.state = 1219;
				this.match(SolidCashParser.T__48);
				this.state = 1220;
				this.expression(0);
				this.state = 1221;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
			this.state = 1225;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public assignChain(): AssignChainContext {
		let localctx: AssignChainContext = new AssignChainContext(this, this._ctx, this.state);
		this.enterRule(localctx, 118, SolidCashParser.RULE_assignChain);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1227;
			this.expression(0);
			this.state = 1230;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 150, this._ctx) ) {
			case 1:
				{
				this.state = 1228;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1229;
				this.assignChain();
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
	public prefixIncDecStatement(): PrefixIncDecStatementContext {
		let localctx: PrefixIncDecStatementContext = new PrefixIncDecStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 120, SolidCashParser.RULE_prefixIncDecStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1232;
			localctx._op = this._input.LT(1);
			_la = this._input.LA(1);
			if(!(_la===84 || _la===85)) {
			    localctx._op = this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			this.state = 1233;
			this.expression(0);
			this.state = 1234;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 122, SolidCashParser.RULE_returnStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1271;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 154, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1236;
				this.match(SolidCashParser.T__85);
				this.state = 1237;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1238;
				this.match(SolidCashParser.T__85);
				this.state = 1239;
				this.expression(0);
				this.state = 1240;
				localctx._rop = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._rop = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1241;
				this.assignChain();
				this.state = 1242;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1244;
				this.match(SolidCashParser.T__85);
				this.state = 1245;
				this.expression(0);
				this.state = 1250;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1246;
					this.match(SolidCashParser.T__4);
					this.state = 1247;
					this.expression(0);
					}
					}
					this.state = 1252;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1253;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1255;
				this.match(SolidCashParser.T__85);
				this.state = 1256;
				this.match(SolidCashParser.T__48);
				this.state = 1257;
				this.expression(0);
				this.state = 1262;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 152, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1258;
						this.match(SolidCashParser.T__4);
						this.state = 1259;
						this.expression(0);
						}
						}
					}
					this.state = 1264;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 152, this._ctx);
				}
				this.state = 1266;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1265;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1268;
				this.match(SolidCashParser.T__49);
				this.state = 1269;
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
		this.enterRule(localctx, 124, SolidCashParser.RULE_selfdestructStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1273;
			this.match(SolidCashParser.T__30);
			this.state = 1274;
			this.match(SolidCashParser.T__48);
			this.state = 1275;
			this.expression(0);
			this.state = 1276;
			this.match(SolidCashParser.T__49);
			this.state = 1277;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 126, SolidCashParser.RULE_emitStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1312;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 160, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1279;
				this.match(SolidCashParser.T__86);
				this.state = 1280;
				this.match(SolidCashParser.Identifier);
				this.state = 1283;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1281;
					this.match(SolidCashParser.T__11);
					this.state = 1282;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1285;
				this.match(SolidCashParser.T__48);
				this.state = 1286;
				this.match(SolidCashParser.T__3);
				this.state = 1298;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1287;
					this.namedArg();
					this.state = 1292;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 156, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1288;
							this.match(SolidCashParser.T__4);
							this.state = 1289;
							this.namedArg();
							}
							}
						}
						this.state = 1294;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 156, this._ctx);
					}
					this.state = 1296;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1295;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1300;
				this.match(SolidCashParser.T__5);
				this.state = 1301;
				this.match(SolidCashParser.T__49);
				this.state = 1302;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1303;
				this.match(SolidCashParser.T__86);
				this.state = 1304;
				this.match(SolidCashParser.Identifier);
				this.state = 1307;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1305;
					this.match(SolidCashParser.T__11);
					this.state = 1306;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1309;
				this.expressionList();
				this.state = 1310;
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
		this.enterRule(localctx, 128, SolidCashParser.RULE_variableDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1363;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 168, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1314;
				this.typeName();
				this.state = 1318;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 161, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1315;
						this.modifier();
						}
						}
					}
					this.state = 1320;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 161, this._ctx);
				}
				this.state = 1321;
				this.anyIdentifier();
				this.state = 1331;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1322;
					this.match(SolidCashParser.T__39);
					this.state = 1323;
					this.expression(0);
					this.state = 1329;
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
						this.state = 1324;
						localctx._iop = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
						    localctx._iop = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1325;
						this.assignChain();
						}
						break;
					case 165:
						{
						this.state = 1326;
						this.match(SolidCashParser.DotPush);
						this.state = 1327;
						this.match(SolidCashParser.T__48);
						this.state = 1328;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 2:
						break;
					default:
						break;
					}
					}
				}

				this.state = 1333;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1335;
				this.arrayType(0);
				this.state = 1339;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 164, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1336;
						this.modifier();
						}
						}
					}
					this.state = 1341;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 164, this._ctx);
				}
				this.state = 1342;
				this.anyIdentifier();
				this.state = 1345;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1343;
					this.match(SolidCashParser.T__39);
					this.state = 1344;
					this.expression(0);
					}
				}

				this.state = 1347;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1349;
				this.mappingType();
				this.state = 1353;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1350;
						this.modifier();
						}
						}
					}
					this.state = 1355;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
				}
				this.state = 1356;
				this.anyIdentifier();
				this.state = 1359;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1357;
					this.match(SolidCashParser.T__39);
					this.state = 1358;
					this.expression(0);
					}
				}

				this.state = 1361;
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
			this.state = 1413;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 173, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1365;
				this.typeName();
				this.state = 1366;
				this.match(SolidCashParser.Identifier);
				this.state = 1371;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1367;
					this.match(SolidCashParser.T__4);
					this.state = 1368;
					this.typeName();
					this.state = 1369;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1373;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1375;
				this.match(SolidCashParser.T__39);
				this.state = 1376;
				this.expression(0);
				this.state = 1377;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1379;
				this.match(SolidCashParser.T__48);
				this.state = 1380;
				this.tupleSlot();
				this.state = 1383;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1381;
					this.match(SolidCashParser.T__4);
					this.state = 1382;
					this.tupleSlot();
					}
					}
					this.state = 1385;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1387;
				this.match(SolidCashParser.T__49);
				this.state = 1388;
				this.match(SolidCashParser.T__39);
				this.state = 1389;
				this.match(SolidCashParser.T__48);
				this.state = 1390;
				this.expression(0);
				this.state = 1393;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1391;
					this.match(SolidCashParser.T__4);
					this.state = 1392;
					this.expression(0);
					}
					}
					this.state = 1395;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1397;
				this.match(SolidCashParser.T__49);
				this.state = 1398;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1400;
				this.match(SolidCashParser.T__48);
				this.state = 1401;
				this.tupleSlot();
				this.state = 1404;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1402;
					this.match(SolidCashParser.T__4);
					this.state = 1403;
					this.tupleSlot();
					}
					}
					this.state = 1406;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1408;
				this.match(SolidCashParser.T__49);
				this.state = 1409;
				this.match(SolidCashParser.T__39);
				this.state = 1410;
				this.expression(0);
				this.state = 1411;
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
			this.state = 1435;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 176, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1415;
				this.typeName();
				this.state = 1419;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 174, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1416;
						this.modifier();
						}
						}
					}
					this.state = 1421;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 174, this._ctx);
				}
				this.state = 1422;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1424;
				this.arrayType(0);
				this.state = 1428;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 175, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1425;
						this.modifier();
						}
						}
					}
					this.state = 1430;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 175, this._ctx);
				}
				this.state = 1431;
				this.anyIdentifier();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1433;
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
		this.enterRule(localctx, 134, SolidCashParser.RULE_pushArgument);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1437;
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
			this.state = 1500;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 182, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1439;
				this.match(SolidCashParser.T__87);
				this.state = 1440;
				this.match(SolidCashParser.Identifier);
				this.state = 1441;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1442;
				this.match(SolidCashParser.T__87);
				this.state = 1443;
				this.match(SolidCashParser.T__88);
				this.state = 1444;
				this.match(SolidCashParser.T__11);
				this.state = 1445;
				this.match(SolidCashParser.Identifier);
				this.state = 1446;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1447;
				this.match(SolidCashParser.T__87);
				this.state = 1448;
				this.match(SolidCashParser.T__88);
				this.state = 1449;
				this.match(SolidCashParser.T__11);
				this.state = 1450;
				this.match(SolidCashParser.Identifier);
				this.state = 1455;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1451;
					this.match(SolidCashParser.T__65);
					this.state = 1452;
					this.expression(0);
					this.state = 1453;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1457;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1459;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1461;
				this.match(SolidCashParser.T__87);
				this.state = 1462;
				this.match(SolidCashParser.Identifier);
				this.state = 1467;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1463;
					this.match(SolidCashParser.T__65);
					this.state = 1464;
					this.expression(0);
					this.state = 1465;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1469;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1471;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				localctx = new DeleteMemberEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1473;
				this.match(SolidCashParser.T__87);
				this.state = 1474;
				this.match(SolidCashParser.Identifier);
				this.state = 1477;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1475;
					this.match(SolidCashParser.T__11);
					this.state = 1476;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1479;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1485;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1481;
					this.match(SolidCashParser.T__65);
					this.state = 1482;
					this.expression(0);
					this.state = 1483;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1487;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1489;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 6:
				localctx = new DeleteMemberContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1491;
				this.match(SolidCashParser.T__87);
				this.state = 1492;
				this.match(SolidCashParser.Identifier);
				this.state = 1495;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1493;
					this.match(SolidCashParser.T__11);
					this.state = 1494;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1497;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1499;
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
			this.state = 1502;
			this.match(SolidCashParser.T__89);
			this.state = 1503;
			this.match(SolidCashParser.T__48);
			this.state = 1504;
			this.match(SolidCashParser.TxVar);
			this.state = 1505;
			this.match(SolidCashParser.T__22);
			this.state = 1506;
			this.expression(0);
			this.state = 1509;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1507;
				this.match(SolidCashParser.T__4);
				this.state = 1508;
				this.requireMessage();
				}
			}

			this.state = 1511;
			this.match(SolidCashParser.T__49);
			this.state = 1512;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1514;
			this.match(SolidCashParser.T__89);
			this.state = 1515;
			this.match(SolidCashParser.T__48);
			this.state = 1516;
			this.expression(0);
			this.state = 1519;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1517;
				this.match(SolidCashParser.T__4);
				this.state = 1518;
				this.requireMessage();
				}
			}

			this.state = 1521;
			this.match(SolidCashParser.T__49);
			this.state = 1522;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1524;
			this.match(SolidCashParser.T__90);
			this.state = 1525;
			this.match(SolidCashParser.T__48);
			this.state = 1526;
			this.expression(0);
			this.state = 1527;
			this.match(SolidCashParser.T__49);
			this.state = 1528;
			localctx._ifBlock = this.block();
			this.state = 1531;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 185, this._ctx) ) {
			case 1:
				{
				this.state = 1529;
				this.match(SolidCashParser.T__91);
				this.state = 1530;
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
			this.state = 1539;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 186, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1533;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1534;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1535;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1536;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1537;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1538;
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
			this.state = 1541;
			this.match(SolidCashParser.T__8);
			this.state = 1542;
			this.match(SolidCashParser.T__48);
			this.state = 1543;
			this.typeName();
			this.state = 1544;
			this.match(SolidCashParser.Identifier);
			this.state = 1545;
			this.match(SolidCashParser.T__4);
			this.state = 1546;
			this.typeName();
			this.state = 1547;
			this.match(SolidCashParser.Identifier);
			this.state = 1548;
			this.match(SolidCashParser.T__92);
			this.state = 1549;
			this.match(SolidCashParser.T__88);
			this.state = 1550;
			this.match(SolidCashParser.T__11);
			this.state = 1551;
			this.match(SolidCashParser.Identifier);
			this.state = 1552;
			this.match(SolidCashParser.T__11);
			this.state = 1553;
			this.match(SolidCashParser.T__33);
			this.state = 1554;
			this.match(SolidCashParser.T__49);
			this.state = 1555;
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
			this.state = 1557;
			this.match(SolidCashParser.T__8);
			this.state = 1558;
			this.match(SolidCashParser.T__48);
			this.state = 1559;
			this.typeName();
			this.state = 1560;
			this.match(SolidCashParser.Identifier);
			this.state = 1561;
			this.match(SolidCashParser.T__93);
			this.state = 1562;
			this.match(SolidCashParser.T__88);
			this.state = 1563;
			this.match(SolidCashParser.T__11);
			this.state = 1564;
			this.match(SolidCashParser.Identifier);
			this.state = 1565;
			this.match(SolidCashParser.T__49);
			this.state = 1566;
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
			this.state = 1568;
			this.match(SolidCashParser.T__8);
			this.state = 1569;
			this.match(SolidCashParser.T__48);
			this.state = 1570;
			this.typeName();
			this.state = 1571;
			this.match(SolidCashParser.Identifier);
			this.state = 1572;
			this.match(SolidCashParser.T__92);
			this.state = 1573;
			this.match(SolidCashParser.T__88);
			this.state = 1574;
			this.match(SolidCashParser.T__11);
			this.state = 1575;
			this.match(SolidCashParser.Identifier);
			this.state = 1576;
			this.match(SolidCashParser.T__49);
			this.state = 1577;
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
			this.state = 1579;
			this.match(SolidCashParser.T__8);
			this.state = 1580;
			this.match(SolidCashParser.T__48);
			this.state = 1581;
			this.forInit();
			this.state = 1582;
			this.forCondition();
			this.state = 1584;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49 || _la===84 || _la===85 || _la===180) {
				{
				this.state = 1583;
				this.forUpdate();
				}
			}

			this.state = 1586;
			this.match(SolidCashParser.T__49);
			this.state = 1587;
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
			this.state = 1634;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 193, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1589;
				this.typeName();
				this.state = 1593;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 1590;
					this.modifier();
					}
					}
					this.state = 1595;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1596;
				this.match(SolidCashParser.Identifier);
				this.state = 1599;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1597;
					this.match(SolidCashParser.T__39);
					this.state = 1598;
					this.expression(0);
					}
				}

				this.state = 1601;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1603;
				this.match(SolidCashParser.Identifier);
				this.state = 1604;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1605;
				this.expression(0);
				this.state = 1606;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1608;
				this.match(SolidCashParser.T__48);
				this.state = 1609;
				this.tupleSlot();
				this.state = 1612;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1610;
					this.match(SolidCashParser.T__4);
					this.state = 1611;
					this.tupleSlot();
					}
					}
					this.state = 1614;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1616;
				this.match(SolidCashParser.T__49);
				this.state = 1617;
				this.match(SolidCashParser.T__39);
				this.state = 1629;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 192, this._ctx) ) {
				case 1:
					{
					this.state = 1618;
					this.match(SolidCashParser.T__48);
					this.state = 1619;
					this.expression(0);
					this.state = 1622;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1620;
						this.match(SolidCashParser.T__4);
						this.state = 1621;
						this.expression(0);
						}
						}
						this.state = 1624;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===5);
					this.state = 1626;
					this.match(SolidCashParser.T__49);
					}
					break;
				case 2:
					{
					this.state = 1628;
					this.expression(0);
					}
					break;
				}
				this.state = 1631;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1633;
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
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1637;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
				{
				this.state = 1636;
				this.expression(0);
				}
			}

			this.state = 1639;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1671;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 198, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1641;
				this.match(SolidCashParser.Identifier);
				this.state = 1642;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1643;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1644;
				this.match(SolidCashParser.Identifier);
				this.state = 1645;
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
				this.state = 1646;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===84 || _la===85)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1647;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1648;
				this.match(SolidCashParser.T__48);
				this.state = 1649;
				this.tupleSlot();
				this.state = 1652;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1650;
					this.match(SolidCashParser.T__4);
					this.state = 1651;
					this.tupleSlot();
					}
					}
					this.state = 1654;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1656;
				this.match(SolidCashParser.T__49);
				this.state = 1657;
				this.match(SolidCashParser.T__39);
				this.state = 1669;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 197, this._ctx) ) {
				case 1:
					{
					this.state = 1658;
					this.match(SolidCashParser.T__48);
					this.state = 1659;
					this.expression(0);
					this.state = 1662;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1660;
						this.match(SolidCashParser.T__4);
						this.state = 1661;
						this.expression(0);
						}
						}
						this.state = 1664;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===5);
					this.state = 1666;
					this.match(SolidCashParser.T__49);
					}
					break;
				case 2:
					{
					this.state = 1668;
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
		this.enterRule(localctx, 160, SolidCashParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1673;
			this.match(SolidCashParser.T__94);
			this.state = 1674;
			this.block();
			this.state = 1675;
			this.match(SolidCashParser.T__95);
			this.state = 1676;
			this.match(SolidCashParser.T__48);
			this.state = 1677;
			this.expression(0);
			this.state = 1678;
			this.match(SolidCashParser.T__49);
			this.state = 1679;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1681;
			this.match(SolidCashParser.T__95);
			this.state = 1682;
			this.match(SolidCashParser.T__48);
			this.state = 1683;
			this.expression(0);
			this.state = 1684;
			this.match(SolidCashParser.T__49);
			this.state = 1685;
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
			this.state = 1687;
			this.match(SolidCashParser.T__96);
			this.state = 1688;
			this.consoleParameterList();
			this.state = 1689;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1691;
			this.match(SolidCashParser.T__97);
			this.state = 1693;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===151) {
				{
				this.state = 1692;
				this.match(SolidCashParser.StringLiteral);
				}
			}

			this.state = 1705;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 1695;
				this.match(SolidCashParser.T__48);
				this.state = 1696;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1701;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1697;
					this.match(SolidCashParser.T__4);
					this.state = 1698;
					this.match(SolidCashParser.StringLiteral);
					}
					}
					this.state = 1703;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1704;
				this.match(SolidCashParser.T__49);
				}
			}

			this.state = 1707;
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
			this.state = 1709;
			this.match(SolidCashParser.T__3);
			this.state = 1713;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026534544) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 31) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 4579361) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				{
				this.state = 1710;
				this.yulStatement();
				}
				}
				this.state = 1715;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1716;
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
			this.state = 1731;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 203, this._ctx) ) {
			case 1:
				localctx = new YulNestedBlockStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1718;
				this.yulBlock();
				}
				break;
			case 2:
				localctx = new YulVarDeclStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1719;
				this.yulVariableDeclaration();
				}
				break;
			case 3:
				localctx = new YulAssignStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1720;
				this.yulAssignment();
				}
				break;
			case 4:
				localctx = new YulIfStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1721;
				this.yulIf();
				}
				break;
			case 5:
				localctx = new YulSwitchStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1722;
				this.yulSwitch();
				}
				break;
			case 6:
				localctx = new YulForStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1723;
				this.yulForLoop();
				}
				break;
			case 7:
				localctx = new YulFunctionDefStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1724;
				this.yulFunctionDefinition();
				}
				break;
			case 8:
				localctx = new YulBreakStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1725;
				this.match(SolidCashParser.T__98);
				}
				break;
			case 9:
				localctx = new YulContinueStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1726;
				this.match(SolidCashParser.T__99);
				}
				break;
			case 10:
				localctx = new YulLeaveStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1727;
				this.match(SolidCashParser.T__100);
				}
				break;
			case 11:
				localctx = new YulCallStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1728;
				this.yulFunctionCall();
				}
				break;
			case 12:
				localctx = new YulPathStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1729;
				this.yulPath();
				}
				break;
			case 13:
				localctx = new YulLiteralStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1730;
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
			this.state = 1733;
			this.match(SolidCashParser.T__101);
			this.state = 1734;
			this.anyIdentifier();
			this.state = 1739;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1735;
				this.match(SolidCashParser.T__4);
				this.state = 1736;
				this.anyIdentifier();
				}
				}
				this.state = 1741;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1744;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===103) {
				{
				this.state = 1742;
				this.match(SolidCashParser.T__102);
				this.state = 1743;
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
			this.state = 1746;
			this.yulPath();
			this.state = 1751;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1747;
				this.match(SolidCashParser.T__4);
				this.state = 1748;
				this.yulPath();
				}
				}
				this.state = 1753;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1754;
			this.match(SolidCashParser.T__102);
			this.state = 1755;
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
			this.state = 1757;
			this.match(SolidCashParser.T__90);
			this.state = 1758;
			this.yulExpression();
			this.state = 1759;
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
			this.state = 1761;
			this.match(SolidCashParser.T__103);
			this.state = 1762;
			this.yulExpression();
			this.state = 1772;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 105:
				{
				this.state = 1764;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1763;
					this.yulCase();
					}
					}
					this.state = 1766;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===105);
				this.state = 1769;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===106) {
					{
					this.state = 1768;
					this.yulDefault();
					}
				}

				}
				break;
			case 106:
				{
				this.state = 1771;
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
			this.state = 1774;
			this.match(SolidCashParser.T__104);
			this.state = 1775;
			this.yulLiteral();
			this.state = 1776;
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
			this.state = 1778;
			this.match(SolidCashParser.T__105);
			this.state = 1779;
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
			this.state = 1781;
			this.match(SolidCashParser.T__8);
			this.state = 1782;
			this.yulBlock();
			this.state = 1783;
			this.yulExpression();
			this.state = 1784;
			this.yulBlock();
			this.state = 1785;
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
			this.state = 1787;
			this.match(SolidCashParser.T__6);
			this.state = 1788;
			this.match(SolidCashParser.Identifier);
			this.state = 1789;
			this.match(SolidCashParser.T__48);
			this.state = 1798;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 1790;
				this.match(SolidCashParser.Identifier);
				this.state = 1795;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1791;
					this.match(SolidCashParser.T__4);
					this.state = 1792;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1797;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1800;
			this.match(SolidCashParser.T__49);
			this.state = 1810;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===107) {
				{
				this.state = 1801;
				this.match(SolidCashParser.T__106);
				this.state = 1802;
				this.match(SolidCashParser.Identifier);
				this.state = 1807;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1803;
					this.match(SolidCashParser.T__4);
					this.state = 1804;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1809;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1812;
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
			this.state = 1817;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 214, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1814;
				this.yulFunctionCall();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1815;
				this.yulPath();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1816;
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
			this.state = 1819;
			this.yulFunctionName();
			this.state = 1820;
			this.match(SolidCashParser.T__48);
			this.state = 1829;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===86 || _la===108 || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				this.state = 1821;
				this.yulExpression();
				this.state = 1826;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1822;
					this.match(SolidCashParser.T__4);
					this.state = 1823;
					this.yulExpression();
					}
					}
					this.state = 1828;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1831;
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
			this.state = 1833;
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
			this.state = 1835;
			this.anyIdentifier();
			this.state = 1841;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===12 || _la===164) {
				{
				this.state = 1839;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 12:
					{
					this.state = 1836;
					this.match(SolidCashParser.T__11);
					this.state = 1837;
					this.anyIdentifier();
					}
					break;
				case 164:
					{
					this.state = 1838;
					this.match(SolidCashParser.DotLength);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 1843;
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
			this.state = 1844;
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
			this.state = 1846;
			this.match(SolidCashParser.T__108);
			this.state = 1847;
			this.match(SolidCashParser.T__3);
			this.state = 1851;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1848;
				this.statement();
				}
				}
				this.state = 1853;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1854;
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
			this.state = 1856;
			this.match(SolidCashParser.T__103);
			this.state = 1857;
			this.match(SolidCashParser.T__48);
			this.state = 1858;
			this.expression(0);
			this.state = 1859;
			this.match(SolidCashParser.T__49);
			this.state = 1860;
			this.match(SolidCashParser.T__3);
			this.state = 1864;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===105) {
				{
				{
				this.state = 1861;
				this.switchCase();
				}
				}
				this.state = 1866;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1868;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===106) {
				{
				this.state = 1867;
				this.switchDefault();
				}
			}

			this.state = 1870;
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
			this.state = 1872;
			this.match(SolidCashParser.T__104);
			this.state = 1873;
			this.expression(0);
			this.state = 1874;
			this.match(SolidCashParser.T__109);
			this.state = 1878;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1875;
				this.statement();
				}
				}
				this.state = 1880;
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
			this.state = 1881;
			this.match(SolidCashParser.T__105);
			this.state = 1882;
			this.match(SolidCashParser.T__109);
			this.state = 1886;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2414870565) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 3221139743) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1883;
				this.statement();
				}
				}
				this.state = 1888;
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
			this.state = 1889;
			this.match(SolidCashParser.T__110);
			this.state = 1890;
			this.expression(0);
			this.state = 1892;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 1891;
				this.tryReturns();
				}
			}

			this.state = 1894;
			localctx._tryBlock = this.block();
			this.state = 1896;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1895;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1898;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 225, this._ctx);
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
			this.state = 1900;
			this.match(SolidCashParser.T__72);
			this.state = 1901;
			this.match(SolidCashParser.T__48);
			this.state = 1913;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1902;
				this.parameter();
				this.state = 1907;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 226, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1903;
						this.match(SolidCashParser.T__4);
						this.state = 1904;
						this.parameter();
						}
						}
					}
					this.state = 1909;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 226, this._ctx);
				}
				this.state = 1911;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1910;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1915;
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
			this.state = 1917;
			this.match(SolidCashParser.T__111);
			this.state = 1919;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 229, this._ctx) ) {
			case 1:
				{
				this.state = 1918;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 1936;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 233, this._ctx) ) {
			case 1:
				{
				this.state = 1921;
				this.match(SolidCashParser.T__48);
				this.state = 1933;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 1922;
					this.parameter();
					this.state = 1927;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 230, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1923;
							this.match(SolidCashParser.T__4);
							this.state = 1924;
							this.parameter();
							}
							}
						}
						this.state = 1929;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 230, this._ctx);
					}
					this.state = 1931;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1930;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1935;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
			this.state = 1938;
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
			this.state = 1940;
			this.match(SolidCashParser.T__98);
			this.state = 1941;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1943;
			this.match(SolidCashParser.T__99);
			this.state = 1944;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1949;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 151:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1946;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 180:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1947;
				this.match(SolidCashParser.Identifier);
				this.state = 1948;
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
			this.state = 1993;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 240, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1951;
				this.match(SolidCashParser.T__35);
				this.state = 1952;
				this.match(SolidCashParser.Identifier);
				this.state = 1955;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1953;
					this.match(SolidCashParser.T__11);
					this.state = 1954;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1957;
				this.match(SolidCashParser.T__48);
				this.state = 1958;
				this.match(SolidCashParser.T__3);
				this.state = 1970;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1959;
					this.namedArg();
					this.state = 1964;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 236, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1960;
							this.match(SolidCashParser.T__4);
							this.state = 1961;
							this.namedArg();
							}
							}
						}
						this.state = 1966;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 236, this._ctx);
					}
					this.state = 1968;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1967;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1972;
				this.match(SolidCashParser.T__5);
				this.state = 1973;
				this.match(SolidCashParser.T__49);
				this.state = 1974;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1975;
				this.match(SolidCashParser.T__35);
				this.state = 1976;
				this.match(SolidCashParser.Identifier);
				this.state = 1979;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1977;
					this.match(SolidCashParser.T__11);
					this.state = 1978;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1981;
				this.expressionList();
				this.state = 1982;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1984;
				this.match(SolidCashParser.T__35);
				this.state = 1985;
				this.match(SolidCashParser.T__48);
				this.state = 1986;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1987;
				this.match(SolidCashParser.T__49);
				this.state = 1988;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1989;
				this.match(SolidCashParser.T__35);
				this.state = 1990;
				this.match(SolidCashParser.T__48);
				this.state = 1991;
				this.match(SolidCashParser.T__49);
				this.state = 1992;
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
			this.state = 1995;
			this.match(SolidCashParser.T__112);
			this.state = 1996;
			this.match(SolidCashParser.T__48);
			this.state = 1997;
			this.expression(0);
			this.state = 1998;
			this.match(SolidCashParser.T__49);
			this.state = 1999;
			this.match(SolidCashParser.T__1);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 2003;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 180:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2001;
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
				this.state = 2002;
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
			this.state = 2005;
			this.match(SolidCashParser.T__48);
			this.state = 2017;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 3152921) !== 0) || _la===180) {
				{
				this.state = 2006;
				this.consoleParameter();
				this.state = 2011;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 242, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2007;
						this.match(SolidCashParser.T__4);
						this.state = 2008;
						this.consoleParameter();
						}
						}
					}
					this.state = 2013;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 242, this._ctx);
				}
				this.state = 2015;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2014;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2019;
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
			this.state = 2045;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 248, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2021;
				this.match(SolidCashParser.Identifier);
				this.state = 2022;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2023;
				this.match(SolidCashParser.Identifier);
				this.state = 2024;
				this.match(SolidCashParser.T__11);
				this.state = 2025;
				this.match(SolidCashParser.Identifier);
				this.state = 2026;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2027;
				this.match(SolidCashParser.Identifier);
				this.state = 2028;
				this.match(SolidCashParser.T__48);
				this.state = 2029;
				this.match(SolidCashParser.T__3);
				this.state = 2041;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2030;
					this.namedArg();
					this.state = 2035;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 245, this._ctx);
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
						_alt = this._interp.adaptivePredict(this._input, 245, this._ctx);
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
			this.state = 2047;
			this.match(SolidCashParser.Identifier);
			this.state = 2048;
			this.match(SolidCashParser.T__109);
			this.state = 2049;
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
			this.state = 2051;
			this.match(SolidCashParser.T__48);
			this.state = 2063;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
				{
				this.state = 2052;
				this.expression(0);
				this.state = 2057;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 249, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2053;
						this.match(SolidCashParser.T__4);
						this.state = 2054;
						this.expression(0);
						}
						}
					}
					this.state = 2059;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 249, this._ctx);
				}
				this.state = 2061;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2060;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2065;
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
			this.state = 2067;
			this.match(SolidCashParser.T__3);
			this.state = 2068;
			this.callOption();
			this.state = 2073;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 252, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2069;
					this.match(SolidCashParser.T__4);
					this.state = 2070;
					this.callOption();
					}
					}
				}
				this.state = 2075;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 252, this._ctx);
			}
			this.state = 2077;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2076;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 2079;
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
			this.state = 2081;
			this.match(SolidCashParser.Identifier);
			this.state = 2082;
			this.match(SolidCashParser.T__109);
			this.state = 2083;
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
			this.state = 2085;
			this.match(SolidCashParser.T__48);
			this.state = 2086;
			this.typeListItem();
			this.state = 2091;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 254, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2087;
					this.match(SolidCashParser.T__4);
					this.state = 2088;
					this.typeListItem();
					}
					}
				}
				this.state = 2093;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 254, this._ctx);
			}
			this.state = 2095;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2094;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 2097;
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
			this.state = 2101;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 256, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2099;
				this.typeName();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2100;
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
			this.state = 2273;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 265, this._ctx) ) {
			case 1:
				{
				localctx = new AssignmentExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 2104;
				this.match(SolidCashParser.T__48);
				this.state = 2105;
				this.match(SolidCashParser.Identifier);
				this.state = 2106;
				(localctx as AssignmentExpressionContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
				    (localctx as AssignmentExpressionContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2107;
				this.expression(0);
				this.state = 2108;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				{
				localctx = new InstantiationWithOptionsContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2110;
				this.match(SolidCashParser.T__48);
				this.state = 2111;
				this.match(SolidCashParser.T__113);
				this.state = 2112;
				this.match(SolidCashParser.Identifier);
				this.state = 2113;
				this.match(SolidCashParser.T__49);
				this.state = 2114;
				this.callOptions();
				this.state = 2115;
				this.expressionList();
				}
				break;
			case 3:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2117;
				this.match(SolidCashParser.T__48);
				this.state = 2118;
				this.expression(0);
				this.state = 2119;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 4:
				{
				localctx = new TupleExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2121;
				this.match(SolidCashParser.T__48);
				this.state = 2122;
				this.expression(0);
				this.state = 2125;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2123;
					this.match(SolidCashParser.T__4);
					this.state = 2124;
					this.expression(0);
					}
					}
					this.state = 2127;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2129;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 5:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2131;
				this.typeCast();
				this.state = 2132;
				this.match(SolidCashParser.T__48);
				this.state = 2133;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 2135;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2134;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 2137;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 6:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2139;
				this.functionCall();
				}
				break;
			case 7:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2140;
				this.match(SolidCashParser.T__113);
				this.state = 2141;
				this.match(SolidCashParser.Identifier);
				this.state = 2143;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 2142;
					this.callOptions();
					}
				}

				this.state = 2145;
				this.expressionList();
				}
				break;
			case 8:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2146;
				this.match(SolidCashParser.T__113);
				this.state = 2147;
				this.typeName();
				this.state = 2150;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2148;
					this.match(SolidCashParser.T__65);
					this.state = 2149;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 2152;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 2154;
				this.match(SolidCashParser.T__48);
				this.state = 2155;
				this.expression(0);
				this.state = 2156;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 9:
				{
				localctx = new NewDynamicBytesContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2158;
				this.match(SolidCashParser.T__113);
				this.state = 2159;
				this.match(SolidCashParser.UnboundedBytes);
				this.state = 2160;
				this.match(SolidCashParser.T__48);
				this.state = 2161;
				this.expression(0);
				this.state = 2162;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 10:
				{
				localctx = new NewDynamicStringContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2164;
				this.match(SolidCashParser.T__113);
				this.state = 2165;
				this.match(SolidCashParser.PrimitiveType);
				this.state = 2166;
				this.match(SolidCashParser.T__48);
				this.state = 2167;
				this.expression(0);
				this.state = 2168;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 11:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2170;
				this.match(SolidCashParser.T__54);
				this.state = 2171;
				this.match(SolidCashParser.T__48);
				this.state = 2172;
				this.typeName();
				this.state = 2173;
				this.match(SolidCashParser.T__49);
				this.state = 2174;
				this.match(SolidCashParser.T__11);
				this.state = 2175;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 12:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2177;
				this.match(SolidCashParser.T__114);
				this.state = 2178;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2179;
				this.match(SolidCashParser.T__115);
				this.state = 2180;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2181;
				this.match(SolidCashParser.T__116);
				this.state = 2182;
				this.expressionList();
				}
				break;
			case 15:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2183;
				this.match(SolidCashParser.T__117);
				this.state = 2184;
				this.expressionList();
				}
				break;
			case 16:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2185;
				this.match(SolidCashParser.T__118);
				this.state = 2186;
				this.match(SolidCashParser.T__48);
				this.state = 2187;
				_la = this._input.LA(1);
				if(!(_la===89 || _la===180)) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2188;
				this.match(SolidCashParser.T__11);
				this.state = 2189;
				this.match(SolidCashParser.Identifier);
				this.state = 2190;
				this.match(SolidCashParser.T__4);
				this.state = 2191;
				this.expressionList();
				this.state = 2192;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 17:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2194;
				this.match(SolidCashParser.T__119);
				this.state = 2195;
				this.expressionList();
				}
				break;
			case 18:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2196;
				this.match(SolidCashParser.T__120);
				this.state = 2197;
				this.expressionList();
				}
				break;
			case 19:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2198;
				this.match(SolidCashParser.T__121);
				this.state = 2199;
				this.match(SolidCashParser.T__48);
				this.state = 2200;
				this.expression(0);
				this.state = 2201;
				this.match(SolidCashParser.T__4);
				this.state = 2202;
				this.typeList();
				this.state = 2203;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 20:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2205;
				this.match(SolidCashParser.T__122);
				this.state = 2206;
				this.match(SolidCashParser.T__48);
				this.state = 2207;
				this.expression(0);
				this.state = 2208;
				this.match(SolidCashParser.T__4);
				this.state = 2209;
				this.typeList();
				this.state = 2210;
				this.match(SolidCashParser.T__4);
				this.state = 2211;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 2212;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 21:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2214;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__123);
				this.state = 2215;
				this.match(SolidCashParser.T__65);
				this.state = 2216;
				this.expression(0);
				this.state = 2217;
				this.match(SolidCashParser.T__66);
				this.state = 2218;
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
				this.state = 2220;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__124);
				this.state = 2221;
				this.match(SolidCashParser.T__65);
				this.state = 2222;
				this.expression(0);
				this.state = 2223;
				this.match(SolidCashParser.T__66);
				this.state = 2224;
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
				this.state = 2226;
				(localctx as PrefixOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===84 || _la===85)) {
				    (localctx as PrefixOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2227;
				this.expression(22);
				}
				break;
			case 24:
				{
				localctx = new UnaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2228;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===127)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2229;
				this.expression(21);
				}
				break;
			case 25:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2230;
				this.match(SolidCashParser.T__65);
				this.state = 2242;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 2231;
					this.expression(0);
					this.state = 2236;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 261, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2232;
							this.match(SolidCashParser.T__4);
							this.state = 2233;
							this.expression(0);
							}
							}
						}
						this.state = 2238;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 261, this._ctx);
					}
					this.state = 2240;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2239;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2244;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 26:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2245;
				this.match(SolidCashParser.T__88);
				this.state = 2246;
				this.match(SolidCashParser.T__11);
				this.state = 2247;
				this.match(SolidCashParser.Identifier);
				this.state = 2248;
				this.match(SolidCashParser.T__11);
				this.state = 2249;
				this.match(SolidCashParser.Identifier);
				this.state = 2250;
				this.match(SolidCashParser.T__65);
				this.state = 2251;
				this.expression(0);
				this.state = 2252;
				this.match(SolidCashParser.T__66);
				this.state = 2253;
				this.memberName();
				}
				break;
			case 27:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2255;
				this.match(SolidCashParser.T__88);
				this.state = 2256;
				this.match(SolidCashParser.T__11);
				this.state = 2257;
				this.match(SolidCashParser.Identifier);
				this.state = 2262;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2258;
						this.match(SolidCashParser.T__65);
						this.state = 2259;
						this.expression(0);
						this.state = 2260;
						this.match(SolidCashParser.T__66);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2264;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 264, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 28:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2266;
				this.match(SolidCashParser.T__88);
				this.state = 2267;
				this.match(SolidCashParser.T__11);
				this.state = 2268;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 29:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2269;
				this.match(SolidCashParser.T__88);
				}
				break;
			case 30:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2270;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 31:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2271;
				this.anyIdentifier();
				}
				break;
			case 32:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2272;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2392;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 276, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2390;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 275, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2275;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 2276;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 2277;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2278;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 2279;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2280;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2281;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 2282;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2283;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2284;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 2285;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===128 || _la===129)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2286;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2287;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 2288;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2289;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2290;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2291;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2292;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2293;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2294;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2295;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2296;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2297;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2298;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2299;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2300;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2301;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2302;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2303;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__129);
						this.state = 2304;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2305;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2306;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__130);
						this.state = 2307;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2308;
						if (!(this.precpred(this._ctx, 34))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 34)");
						}
						this.state = 2309;
						this.match(SolidCashParser.T__65);
						this.state = 2311;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
							{
							this.state = 2310;
							(localctx as IndexRangeSliceContext)._start = this.expression(0);
							}
						}

						this.state = 2313;
						this.match(SolidCashParser.T__109);
						this.state = 2315;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768000) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 142737439) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 9175041) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
							{
							this.state = 2314;
							(localctx as IndexRangeSliceContext)._end = this.expression(0);
							}
						}

						this.state = 2317;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 13:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2318;
						if (!(this.precpred(this._ctx, 33))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 33)");
						}
						this.state = 2319;
						this.match(SolidCashParser.T__65);
						this.state = 2320;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2321;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 14:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2322;
						if (!(this.precpred(this._ctx, 32))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 32)");
						}
						this.state = 2323;
						this.match(SolidCashParser.T__65);
						this.state = 2324;
						this.expression(0);
						this.state = 2325;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 15:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2327;
						if (!(this.precpred(this._ctx, 29))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 29)");
						}
						this.state = 2328;
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
					case 16:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2329;
						if (!(this.precpred(this._ctx, 28))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 28)");
						}
						this.state = 2330;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.DotSplit);
						this.state = 2331;
						this.match(SolidCashParser.T__48);
						this.state = 2332;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2333;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 17:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2335;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2336;
						this.match(SolidCashParser.DotSlice);
						this.state = 2337;
						this.match(SolidCashParser.T__48);
						this.state = 2338;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2339;
						this.match(SolidCashParser.T__4);
						this.state = 2340;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2341;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 18:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2343;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2344;
						this.match(SolidCashParser.T__11);
						this.state = 2345;
						this.match(SolidCashParser.Identifier);
						this.state = 2347;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2346;
							this.callOptions();
							}
						}

						this.state = 2349;
						this.match(SolidCashParser.T__48);
						this.state = 2350;
						this.match(SolidCashParser.T__3);
						this.state = 2362;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===180) {
							{
							this.state = 2351;
							this.namedArg();
							this.state = 2356;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 269, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2352;
									this.match(SolidCashParser.T__4);
									this.state = 2353;
									this.namedArg();
									}
									}
								}
								this.state = 2358;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 269, this._ctx);
							}
							this.state = 2360;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2359;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2364;
						this.match(SolidCashParser.T__5);
						this.state = 2365;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 19:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2366;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2367;
						this.match(SolidCashParser.T__11);
						this.state = 2368;
						this.match(SolidCashParser.Identifier);
						this.state = 2370;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2369;
							this.callOptions();
							}
						}

						this.state = 2372;
						this.expressionList();
						}
						break;
					case 20:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2373;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2374;
						this.memberName();
						}
						break;
					case 21:
						{
						localctx = new PostfixOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2375;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2376;
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
					case 22:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2377;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 2378;
						this.match(SolidCashParser.T__131);
						this.state = 2379;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 2382;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0)) {
							{
							this.state = 2380;
							(localctx as TernaryOpContext)._tOp = this._input.LT(1);
							_la = this._input.LA(1);
							if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
							    (localctx as TernaryOpContext)._tOp = this._errHandler.recoverInline(this);
							}
							else {
								this._errHandler.reportMatch(this);
							    this.consume();
							}
							this.state = 2381;
							(localctx as TernaryOpContext)._tVal = this.assignChain();
							}
						}

						this.state = 2384;
						this.match(SolidCashParser.T__109);
						this.state = 2385;
						(localctx as TernaryOpContext)._ifFalse = this.expression(0);
						this.state = 2388;
						this._errHandler.sync(this);
						switch ( this._interp.adaptivePredict(this._input, 274, this._ctx) ) {
						case 1:
							{
							this.state = 2386;
							(localctx as TernaryOpContext)._fOp = this._input.LT(1);
							_la = this._input.LA(1);
							if(!(_la===40 || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & 1023) !== 0))) {
							    (localctx as TernaryOpContext)._fOp = this._errHandler.recoverInline(this);
							}
							else {
								this._errHandler.reportMatch(this);
							    this.consume();
							}
							this.state = 2387;
							(localctx as TernaryOpContext)._fVal = this.assignChain();
							}
							break;
						}
						}
						break;
					}
					}
				}
				this.state = 2394;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 276, this._ctx);
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
			this.state = 2410;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 277, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2395;
				this.match(SolidCashParser.T__11);
				this.state = 2396;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2397;
				this.match(SolidCashParser.T__11);
				this.state = 2398;
				this.match(SolidCashParser.T__107);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2399;
				this.match(SolidCashParser.DotValue);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2400;
				this.match(SolidCashParser.DotLockingBytecode);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2401;
				this.match(SolidCashParser.DotTokenCategory);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2402;
				this.match(SolidCashParser.DotNftCommitment);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2403;
				this.match(SolidCashParser.DotTokenAmount);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2404;
				this.match(SolidCashParser.DotOutpointTransactionHash);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2405;
				this.match(SolidCashParser.DotOutpointIndex);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2406;
				this.match(SolidCashParser.DotUnlockingBytecode);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2407;
				this.match(SolidCashParser.DotSequenceNumber);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2408;
				this.match(SolidCashParser.DotCode);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2409;
				this.match(SolidCashParser.DotCodehash);
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
	public modifier(): ModifierContext {
		let localctx: ModifierContext = new ModifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 244, SolidCashParser.RULE_modifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2412;
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
	public dataLocation(): DataLocationContext {
		let localctx: DataLocationContext = new DataLocationContext(this, this._ctx, this.state);
		this.enterRule(localctx, 246, SolidCashParser.RULE_dataLocation);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2414;
			_la = this._input.LA(1);
			if(!(((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 7) !== 0))) {
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
		this.enterRule(localctx, 248, SolidCashParser.RULE_literal);
		try {
			let _alt: number;
			this.state = 2430;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 141:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2416;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 145:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2417;
				this.numberLiteral();
				}
				break;
			case 144:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2418;
				this.decimalLiteral();
				}
				break;
			case 151:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2419;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2423;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 278, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2420;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2425;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 278, this._ctx);
				}
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2426;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2427;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 152:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2428;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 153:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2429;
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
		this.enterRule(localctx, 250, SolidCashParser.RULE_numberLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2432;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2434;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 280, this._ctx) ) {
			case 1:
				{
				this.state = 2433;
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
		this.enterRule(localctx, 252, SolidCashParser.RULE_decimalLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2436;
			this.match(SolidCashParser.DecimalLiteral);
			this.state = 2438;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 281, this._ctx) ) {
			case 1:
				{
				this.state = 2437;
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
		this.enterRule(localctx, 254, SolidCashParser.RULE_typeName);
		let _la: number;
		try {
			let _alt: number;
			this.state = 2502;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 291, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2440;
				this.match(SolidCashParser.T__107);
				this.state = 2441;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2442;
				this.match(SolidCashParser.T__107);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2443;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2444;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2445;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2446;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2447;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2448;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2449;
				this.match(SolidCashParser.T__137);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2450;
				this.match(SolidCashParser.T__138);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2451;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2452;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2453;
				this.match(SolidCashParser.T__6);
				this.state = 2454;
				this.match(SolidCashParser.T__48);
				this.state = 2469;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 2455;
					this.typeName();
					this.state = 2457;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 7) !== 0)) {
						{
						this.state = 2456;
						this.dataLocation();
						}
					}

					this.state = 2466;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2459;
						this.match(SolidCashParser.T__4);
						this.state = 2460;
						this.typeName();
						this.state = 2462;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 7) !== 0)) {
							{
							this.state = 2461;
							this.dataLocation();
							}
						}

						}
						}
						this.state = 2468;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2471;
				this.match(SolidCashParser.T__49);
				this.state = 2475;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 286, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2472;
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
					this.state = 2477;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 286, this._ctx);
				}
				this.state = 2496;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===73) {
					{
					this.state = 2478;
					this.match(SolidCashParser.T__72);
					this.state = 2479;
					this.match(SolidCashParser.T__48);
					this.state = 2480;
					this.typeName();
					this.state = 2482;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 7) !== 0)) {
						{
						this.state = 2481;
						this.dataLocation();
						}
					}

					this.state = 2491;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2484;
						this.match(SolidCashParser.T__4);
						this.state = 2485;
						this.typeName();
						this.state = 2487;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 7) !== 0)) {
							{
							this.state = 2486;
							this.dataLocation();
							}
						}

						}
						}
						this.state = 2493;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2494;
					this.match(SolidCashParser.T__49);
					}
				}

				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2498;
				this.match(SolidCashParser.Identifier);
				this.state = 2499;
				this.match(SolidCashParser.T__11);
				this.state = 2500;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 2501;
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
		this.enterRule(localctx, 256, SolidCashParser.RULE_typeCast);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2504;
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
			return this.precpred(this._ctx, 34);
		case 13:
			return this.precpred(this._ctx, 33);
		case 14:
			return this.precpred(this._ctx, 32);
		case 15:
			return this.precpred(this._ctx, 29);
		case 16:
			return this.precpred(this._ctx, 28);
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
			return this.precpred(this._ctx, 9);
		}
		return true;
	}

	public static readonly _serializedATN: number[] = [4,1,183,2507,2,0,7,0,
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
	7,127,2,128,7,128,1,0,5,0,260,8,0,10,0,12,0,263,9,0,1,0,5,0,266,8,0,10,
	0,12,0,269,9,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,5,0,282,8,0,
	10,0,12,0,285,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,5,1,302,8,1,10,1,12,1,305,9,1,1,1,3,1,308,8,1,1,1,1,1,1,1,1,1,1,1,
	3,1,315,8,1,1,2,1,2,1,2,3,2,320,8,2,1,3,1,3,1,3,1,3,5,3,326,8,3,10,3,12,
	3,329,9,3,1,3,3,3,332,8,3,1,3,1,3,5,3,336,8,3,10,3,12,3,339,9,3,1,3,1,3,
	1,4,1,4,1,4,1,4,1,4,1,4,1,4,3,4,350,8,4,1,4,3,4,353,8,4,1,4,1,4,1,4,1,4,
	1,4,1,4,5,4,361,8,4,10,4,12,4,364,9,4,1,4,3,4,367,8,4,1,4,1,4,1,4,1,4,1,
	4,1,4,3,4,375,8,4,1,4,3,4,378,8,4,1,4,1,4,3,4,382,8,4,1,5,1,5,1,5,3,5,387,
	8,5,1,5,1,5,3,5,391,8,5,1,6,1,6,1,7,1,7,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,
	5,8,405,8,8,10,8,12,8,408,9,8,1,8,3,8,411,8,8,1,9,1,9,1,10,4,10,416,8,10,
	11,10,12,10,417,1,10,3,10,421,8,10,1,11,3,11,424,8,11,1,11,1,11,1,12,1,
	12,1,13,1,13,1,13,1,13,1,13,1,13,5,13,436,8,13,10,13,12,13,439,9,13,3,13,
	441,8,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,5,13,452,8,13,10,
	13,12,13,455,9,13,1,13,1,13,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,
	1,14,3,14,469,8,14,1,15,1,15,1,15,1,15,1,15,1,16,1,16,1,17,1,17,1,17,1,
	17,5,17,482,8,17,10,17,12,17,485,9,17,1,17,3,17,488,8,17,1,17,1,17,1,18,
	1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,5,18,504,8,18,10,
	18,12,18,507,9,18,1,18,1,18,1,19,3,19,512,8,19,1,19,1,19,1,19,3,19,517,
	8,19,1,19,1,19,1,19,1,19,5,19,523,8,19,10,19,12,19,526,9,19,3,19,528,8,
	19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,
	1,19,5,19,545,8,19,10,19,12,19,548,9,19,1,19,1,19,1,20,1,20,3,20,554,8,
	20,1,21,1,21,1,21,1,21,1,21,5,21,561,8,21,10,21,12,21,564,9,21,1,21,3,21,
	567,8,21,1,21,1,21,1,22,1,22,1,22,1,22,1,22,1,22,5,22,577,8,22,10,22,12,
	22,580,9,22,1,22,3,22,583,8,22,3,22,585,8,22,1,22,1,22,3,22,589,8,22,1,
	22,1,22,1,23,1,23,3,23,595,8,23,1,23,3,23,598,8,23,1,23,3,23,601,8,23,1,
	24,1,24,1,24,1,24,1,24,1,24,5,24,609,8,24,10,24,12,24,612,9,24,1,24,3,24,
	615,8,24,3,24,617,8,24,1,24,1,24,1,24,1,25,1,25,3,25,624,8,25,1,25,1,25,
	3,25,628,8,25,3,25,630,8,25,1,26,1,26,1,26,1,26,4,26,636,8,26,11,26,12,
	26,637,1,26,1,26,1,27,1,27,1,27,3,27,645,8,27,1,27,1,27,1,27,1,28,1,28,
	1,28,1,28,1,28,1,28,5,28,656,8,28,10,28,12,28,659,9,28,1,28,3,28,662,8,
	28,1,28,1,28,1,29,1,29,1,29,3,29,669,8,29,1,30,1,30,1,30,1,30,1,30,1,30,
	1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,32,1,32,1,32,5,32,687,8,32,10,32,12,
	32,690,9,32,1,32,5,32,693,8,32,10,32,12,32,696,9,32,1,32,5,32,699,8,32,
	10,32,12,32,702,9,32,1,32,5,32,705,8,32,10,32,12,32,708,9,32,1,32,1,32,
	5,32,712,8,32,10,32,12,32,715,9,32,1,32,1,32,1,33,1,33,1,33,5,33,722,8,
	33,10,33,12,33,725,9,33,1,33,1,33,5,33,729,8,33,10,33,12,33,732,9,33,1,
	33,5,33,735,8,33,10,33,12,33,738,9,33,1,33,3,33,741,8,33,1,33,1,33,5,33,
	745,8,33,10,33,12,33,748,9,33,1,33,1,33,1,34,1,34,1,34,3,34,755,8,34,1,
	35,1,35,1,35,1,35,5,35,761,8,35,10,35,12,35,764,9,35,1,35,1,35,5,35,768,
	8,35,10,35,12,35,771,9,35,1,35,1,35,5,35,775,8,35,10,35,12,35,778,9,35,
	1,35,1,35,5,35,782,8,35,10,35,12,35,785,9,35,1,35,1,35,3,35,789,8,35,1,
	35,1,35,1,35,1,35,5,35,795,8,35,10,35,12,35,798,9,35,1,35,1,35,5,35,802,
	8,35,10,35,12,35,805,9,35,1,35,1,35,5,35,809,8,35,10,35,12,35,812,9,35,
	1,35,1,35,5,35,816,8,35,10,35,12,35,819,9,35,1,35,1,35,3,35,823,8,35,3,
	35,825,8,35,1,36,1,36,3,36,829,8,36,1,37,1,37,1,37,1,38,3,38,835,8,38,1,
	38,1,38,1,38,5,38,840,8,38,10,38,12,38,843,9,38,1,38,1,38,1,38,3,38,848,
	8,38,1,38,1,38,1,38,1,38,1,38,5,38,855,8,38,10,38,12,38,858,9,38,1,38,1,
	38,1,38,5,38,863,8,38,10,38,12,38,866,9,38,1,38,1,38,1,38,3,38,871,8,38,
	1,38,1,38,1,38,3,38,876,8,38,1,38,1,38,5,38,880,8,38,10,38,12,38,883,9,
	38,1,38,1,38,1,38,1,38,3,38,889,8,38,1,38,1,38,5,38,893,8,38,10,38,12,38,
	896,9,38,1,38,1,38,1,38,3,38,901,8,38,1,38,1,38,3,38,905,8,38,1,39,1,39,
	1,39,3,39,910,8,39,1,40,1,40,1,41,1,41,1,41,1,41,3,41,918,8,41,1,41,1,41,
	1,41,3,41,923,8,41,1,41,1,41,1,41,1,41,1,41,1,41,3,41,931,8,41,1,41,1,41,
	1,41,1,41,1,41,1,41,1,41,1,41,3,41,941,8,41,1,41,1,41,1,41,3,41,946,8,41,
	1,41,1,41,3,41,950,8,41,1,42,1,42,1,42,1,42,3,42,956,8,42,1,42,1,42,1,42,
	1,42,1,42,3,42,963,8,42,1,42,5,42,966,8,42,10,42,12,42,969,9,42,1,43,1,
	43,1,43,3,43,974,8,43,1,43,1,43,5,43,978,8,43,10,43,12,43,981,9,43,1,43,
	1,43,5,43,985,8,43,10,43,12,43,988,9,43,1,43,1,43,3,43,992,8,43,1,44,1,
	44,3,44,996,8,44,1,45,1,45,1,45,1,46,1,46,1,46,1,46,1,46,5,46,1006,8,46,
	10,46,12,46,1009,9,46,1,46,3,46,1012,8,46,1,46,1,46,5,46,1016,8,46,10,46,
	12,46,1019,9,46,1,46,1,46,1,47,1,47,3,47,1025,8,47,1,48,1,48,1,48,1,48,
	1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,3,48,1041,8,48,1,49,1,
	49,1,49,1,49,1,49,5,49,1048,8,49,10,49,12,49,1051,9,49,1,49,3,49,1054,8,
	49,1,50,1,50,1,50,1,50,3,50,1060,8,50,1,51,1,51,1,51,1,51,1,51,5,51,1067,
	8,51,10,51,12,51,1070,9,51,1,51,3,51,1073,8,51,1,51,1,51,1,52,1,52,5,52,
	1079,8,52,10,52,12,52,1082,9,52,1,52,3,52,1085,8,52,1,52,1,52,5,52,1089,
	8,52,10,52,12,52,1092,9,52,1,52,3,52,1095,8,52,1,52,1,52,5,52,1099,8,52,
	10,52,12,52,1102,9,52,1,52,3,52,1105,8,52,3,52,1107,8,52,1,53,1,53,1,53,
	1,53,5,53,1113,8,53,10,53,12,53,1116,9,53,1,53,3,53,1119,8,53,3,53,1121,
	8,53,1,53,1,53,1,54,1,54,5,54,1127,8,54,10,54,12,54,1130,9,54,1,54,3,54,
	1133,8,54,1,54,1,54,5,54,1137,8,54,10,54,12,54,1140,9,54,1,54,3,54,1143,
	8,54,1,54,1,54,5,54,1147,8,54,10,54,12,54,1150,9,54,1,54,3,54,1153,8,54,
	3,54,1155,8,54,1,55,1,55,5,55,1159,8,55,10,55,12,55,1162,9,55,1,55,1,55,
	3,55,1166,8,55,1,56,1,56,5,56,1170,8,56,10,56,12,56,1173,9,56,1,56,1,56,
	1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,
	57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,3,57,1200,8,57,1,58,1,58,1,58,
	1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,3,58,1213,8,58,1,58,1,58,1,58,1,
	58,1,58,1,58,1,58,1,58,1,58,3,58,1224,8,58,1,58,1,58,1,59,1,59,1,59,3,59,
	1231,8,59,1,60,1,60,1,60,1,60,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,
	61,1,61,1,61,1,61,5,61,1249,8,61,10,61,12,61,1252,9,61,1,61,1,61,1,61,1,
	61,1,61,1,61,1,61,5,61,1261,8,61,10,61,12,61,1264,9,61,1,61,3,61,1267,8,
	61,1,61,1,61,1,61,3,61,1272,8,61,1,62,1,62,1,62,1,62,1,62,1,62,1,63,1,63,
	1,63,1,63,3,63,1284,8,63,1,63,1,63,1,63,1,63,1,63,5,63,1291,8,63,10,63,
	12,63,1294,9,63,1,63,3,63,1297,8,63,3,63,1299,8,63,1,63,1,63,1,63,1,63,
	1,63,1,63,1,63,3,63,1308,8,63,1,63,1,63,1,63,3,63,1313,8,63,1,64,1,64,5,
	64,1317,8,64,10,64,12,64,1320,9,64,1,64,1,64,1,64,1,64,1,64,1,64,1,64,1,
	64,3,64,1330,8,64,3,64,1332,8,64,1,64,1,64,1,64,1,64,5,64,1338,8,64,10,
	64,12,64,1341,9,64,1,64,1,64,1,64,3,64,1346,8,64,1,64,1,64,1,64,1,64,5,
	64,1352,8,64,10,64,12,64,1355,9,64,1,64,1,64,1,64,3,64,1360,8,64,1,64,1,
	64,3,64,1364,8,64,1,65,1,65,1,65,1,65,1,65,1,65,4,65,1372,8,65,11,65,12,
	65,1373,1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,65,4,65,1384,8,65,11,65,12,
	65,1385,1,65,1,65,1,65,1,65,1,65,1,65,4,65,1394,8,65,11,65,12,65,1395,1,
	65,1,65,1,65,1,65,1,65,1,65,1,65,4,65,1405,8,65,11,65,12,65,1406,1,65,1,
	65,1,65,1,65,1,65,3,65,1414,8,65,1,66,1,66,5,66,1418,8,66,10,66,12,66,1421,
	9,66,1,66,1,66,1,66,1,66,5,66,1427,8,66,10,66,12,66,1430,9,66,1,66,1,66,
	1,66,1,66,3,66,1436,8,66,1,67,1,67,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,
	68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,4,68,1456,8,68,11,68,12,68,1457,
	1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,4,68,1468,8,68,11,68,12,68,1469,
	1,68,1,68,1,68,1,68,1,68,1,68,4,68,1478,8,68,11,68,12,68,1479,1,68,1,68,
	1,68,1,68,4,68,1486,8,68,11,68,12,68,1487,1,68,1,68,1,68,1,68,1,68,1,68,
	4,68,1496,8,68,11,68,12,68,1497,1,68,3,68,1501,8,68,1,69,1,69,1,69,1,69,
	1,69,1,69,1,69,3,69,1510,8,69,1,69,1,69,1,69,1,70,1,70,1,70,1,70,1,70,3,
	70,1520,8,70,1,70,1,70,1,70,1,71,1,71,1,71,1,71,1,71,1,71,1,71,3,71,1532,
	8,71,1,72,1,72,1,72,1,72,1,72,1,72,3,72,1540,8,72,1,73,1,73,1,73,1,73,1,
	73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,74,1,74,1,74,
	1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,75,1,75,1,75,1,75,1,75,1,75,1,
	75,1,75,1,75,1,75,1,75,1,76,1,76,1,76,1,76,1,76,3,76,1585,8,76,1,76,1,76,
	1,76,1,77,1,77,5,77,1592,8,77,10,77,12,77,1595,9,77,1,77,1,77,1,77,3,77,
	1600,8,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,4,77,1613,
	8,77,11,77,12,77,1614,1,77,1,77,1,77,1,77,1,77,1,77,4,77,1623,8,77,11,77,
	12,77,1624,1,77,1,77,1,77,3,77,1630,8,77,1,77,1,77,1,77,3,77,1635,8,77,
	1,78,3,78,1638,8,78,1,78,1,78,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,
	79,1,79,1,79,4,79,1653,8,79,11,79,12,79,1654,1,79,1,79,1,79,1,79,1,79,1,
	79,4,79,1663,8,79,11,79,12,79,1664,1,79,1,79,1,79,3,79,1670,8,79,3,79,1672,
	8,79,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,81,1,81,1,81,1,81,1,81,1,
	81,1,82,1,82,1,82,1,82,1,83,1,83,3,83,1694,8,83,1,83,1,83,1,83,1,83,5,83,
	1700,8,83,10,83,12,83,1703,9,83,1,83,3,83,1706,8,83,1,83,1,83,1,84,1,84,
	5,84,1712,8,84,10,84,12,84,1715,9,84,1,84,1,84,1,85,1,85,1,85,1,85,1,85,
	1,85,1,85,1,85,1,85,1,85,1,85,1,85,1,85,3,85,1732,8,85,1,86,1,86,1,86,1,
	86,5,86,1738,8,86,10,86,12,86,1741,9,86,1,86,1,86,3,86,1745,8,86,1,87,1,
	87,1,87,5,87,1750,8,87,10,87,12,87,1753,9,87,1,87,1,87,1,87,1,88,1,88,1,
	88,1,88,1,89,1,89,1,89,4,89,1765,8,89,11,89,12,89,1766,1,89,3,89,1770,8,
	89,1,89,3,89,1773,8,89,1,90,1,90,1,90,1,90,1,91,1,91,1,91,1,92,1,92,1,92,
	1,92,1,92,1,92,1,93,1,93,1,93,1,93,1,93,1,93,5,93,1794,8,93,10,93,12,93,
	1797,9,93,3,93,1799,8,93,1,93,1,93,1,93,1,93,1,93,5,93,1806,8,93,10,93,
	12,93,1809,9,93,3,93,1811,8,93,1,93,1,93,1,94,1,94,1,94,3,94,1818,8,94,
	1,95,1,95,1,95,1,95,1,95,5,95,1825,8,95,10,95,12,95,1828,9,95,3,95,1830,
	8,95,1,95,1,95,1,96,1,96,1,97,1,97,1,97,1,97,5,97,1840,8,97,10,97,12,97,
	1843,9,97,1,98,1,98,1,99,1,99,1,99,5,99,1850,8,99,10,99,12,99,1853,9,99,
	1,99,1,99,1,100,1,100,1,100,1,100,1,100,1,100,5,100,1863,8,100,10,100,12,
	100,1866,9,100,1,100,3,100,1869,8,100,1,100,1,100,1,101,1,101,1,101,1,101,
	5,101,1877,8,101,10,101,12,101,1880,9,101,1,102,1,102,1,102,5,102,1885,
	8,102,10,102,12,102,1888,9,102,1,103,1,103,1,103,3,103,1893,8,103,1,103,
	1,103,4,103,1897,8,103,11,103,12,103,1898,1,104,1,104,1,104,1,104,1,104,
	5,104,1906,8,104,10,104,12,104,1909,9,104,1,104,3,104,1912,8,104,3,104,
	1914,8,104,1,104,1,104,1,105,1,105,3,105,1920,8,105,1,105,1,105,1,105,1,
	105,5,105,1926,8,105,10,105,12,105,1929,9,105,1,105,3,105,1932,8,105,3,
	105,1934,8,105,1,105,3,105,1937,8,105,1,105,1,105,1,106,1,106,1,106,1,107,
	1,107,1,107,1,108,1,108,1,108,3,108,1950,8,108,1,109,1,109,1,109,1,109,
	3,109,1956,8,109,1,109,1,109,1,109,1,109,1,109,5,109,1963,8,109,10,109,
	12,109,1966,9,109,1,109,3,109,1969,8,109,3,109,1971,8,109,1,109,1,109,1,
	109,1,109,1,109,1,109,1,109,3,109,1980,8,109,1,109,1,109,1,109,1,109,1,
	109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,3,109,1994,8,109,1,110,1,
	110,1,110,1,110,1,110,1,110,1,111,1,111,3,111,2004,8,111,1,112,1,112,1,
	112,1,112,5,112,2010,8,112,10,112,12,112,2013,9,112,1,112,3,112,2016,8,
	112,3,112,2018,8,112,1,112,1,112,1,113,1,113,1,113,1,113,1,113,1,113,1,
	113,1,113,1,113,1,113,1,113,1,113,5,113,2034,8,113,10,113,12,113,2037,9,
	113,1,113,3,113,2040,8,113,3,113,2042,8,113,1,113,1,113,3,113,2046,8,113,
	1,114,1,114,1,114,1,114,1,115,1,115,1,115,1,115,5,115,2056,8,115,10,115,
	12,115,2059,9,115,1,115,3,115,2062,8,115,3,115,2064,8,115,1,115,1,115,1,
	116,1,116,1,116,1,116,5,116,2072,8,116,10,116,12,116,2075,9,116,1,116,3,
	116,2078,8,116,1,116,1,116,1,117,1,117,1,117,1,117,1,118,1,118,1,118,1,
	118,5,118,2090,8,118,10,118,12,118,2093,9,118,1,118,3,118,2096,8,118,1,
	118,1,118,1,119,1,119,3,119,2102,8,119,1,120,1,120,1,120,1,120,1,120,1,
	120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,
	120,1,120,1,120,1,120,1,120,4,120,2126,8,120,11,120,12,120,2127,1,120,1,
	120,1,120,1,120,1,120,1,120,3,120,2136,8,120,1,120,1,120,1,120,1,120,1,
	120,1,120,3,120,2144,8,120,1,120,1,120,1,120,1,120,1,120,4,120,2151,8,120,
	11,120,12,120,2152,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,5,120,
	2235,8,120,10,120,12,120,2238,9,120,1,120,3,120,2241,8,120,3,120,2243,8,
	120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,
	120,1,120,1,120,1,120,1,120,1,120,1,120,4,120,2263,8,120,11,120,12,120,
	2264,1,120,1,120,1,120,1,120,1,120,1,120,1,120,3,120,2274,8,120,1,120,1,
	120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,
	120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,
	120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,3,120,2312,
	8,120,1,120,1,120,3,120,2316,8,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	3,120,2348,8,120,1,120,1,120,1,120,1,120,1,120,5,120,2355,8,120,10,120,
	12,120,2358,9,120,1,120,3,120,2361,8,120,3,120,2363,8,120,1,120,1,120,1,
	120,1,120,1,120,1,120,3,120,2371,8,120,1,120,1,120,1,120,1,120,1,120,1,
	120,1,120,1,120,1,120,1,120,3,120,2383,8,120,1,120,1,120,1,120,1,120,3,
	120,2389,8,120,5,120,2391,8,120,10,120,12,120,2394,9,120,1,121,1,121,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,
	121,3,121,2411,8,121,1,122,1,122,1,123,1,123,1,124,1,124,1,124,1,124,1,
	124,5,124,2422,8,124,10,124,12,124,2425,9,124,1,124,1,124,1,124,1,124,3,
	124,2431,8,124,1,125,1,125,3,125,2435,8,125,1,126,1,126,3,126,2439,8,126,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,3,127,2458,8,127,1,127,1,127,1,127,3,127,
	2463,8,127,5,127,2465,8,127,10,127,12,127,2468,9,127,3,127,2470,8,127,1,
	127,1,127,5,127,2474,8,127,10,127,12,127,2477,9,127,1,127,1,127,1,127,1,
	127,3,127,2483,8,127,1,127,1,127,1,127,3,127,2488,8,127,5,127,2490,8,127,
	10,127,12,127,2493,9,127,1,127,1,127,3,127,2497,8,127,1,127,1,127,1,127,
	1,127,3,127,2503,8,127,1,128,1,128,1,128,0,2,84,240,129,0,2,4,6,8,10,12,
	14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,
	62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,
	108,110,112,114,116,118,120,122,124,126,128,130,132,134,136,138,140,142,
	144,146,148,150,152,154,156,158,160,162,164,166,168,170,172,174,176,178,
	180,182,184,186,188,190,192,194,196,198,200,202,204,206,208,210,212,214,
	216,218,220,222,224,226,228,230,232,234,236,238,240,242,244,246,248,250,
	252,254,256,0,28,2,0,10,10,13,27,5,0,11,11,28,36,143,143,147,147,180,180,
	5,0,38,38,140,140,145,145,151,151,180,180,1,0,38,39,2,0,140,140,144,144,
	3,0,20,23,26,27,40,40,1,0,43,44,2,0,43,44,58,59,3,0,43,44,58,58,63,63,2,
	0,40,40,74,83,1,0,84,85,6,0,31,31,36,36,86,86,108,108,149,149,180,180,5,
	0,141,141,145,145,151,151,153,153,162,162,2,0,89,89,180,180,2,0,163,163,
	172,175,2,0,163,163,172,179,3,0,14,14,27,27,127,127,2,0,10,10,15,16,1,0,
	13,14,1,0,128,129,1,0,20,23,1,0,18,19,2,0,126,126,164,164,3,0,33,33,56,
	56,133,137,1,0,133,135,1,0,142,143,3,0,44,44,58,59,70,71,5,0,59,59,108,
	108,138,139,146,149,155,159,2867,0,261,1,0,0,0,2,314,1,0,0,0,4,316,1,0,
	0,0,6,321,1,0,0,0,8,381,1,0,0,0,10,383,1,0,0,0,12,392,1,0,0,0,14,394,1,
	0,0,0,16,410,1,0,0,0,18,412,1,0,0,0,20,420,1,0,0,0,22,423,1,0,0,0,24,427,
	1,0,0,0,26,429,1,0,0,0,28,468,1,0,0,0,30,470,1,0,0,0,32,475,1,0,0,0,34,
	477,1,0,0,0,36,491,1,0,0,0,38,511,1,0,0,0,40,551,1,0,0,0,42,555,1,0,0,0,
	44,570,1,0,0,0,46,594,1,0,0,0,48,602,1,0,0,0,50,629,1,0,0,0,52,631,1,0,
	0,0,54,644,1,0,0,0,56,649,1,0,0,0,58,665,1,0,0,0,60,670,1,0,0,0,62,676,
	1,0,0,0,64,683,1,0,0,0,66,718,1,0,0,0,68,754,1,0,0,0,70,824,1,0,0,0,72,
	828,1,0,0,0,74,830,1,0,0,0,76,904,1,0,0,0,78,909,1,0,0,0,80,911,1,0,0,0,
	82,949,1,0,0,0,84,951,1,0,0,0,86,970,1,0,0,0,88,995,1,0,0,0,90,997,1,0,
	0,0,92,1000,1,0,0,0,94,1022,1,0,0,0,96,1040,1,0,0,0,98,1042,1,0,0,0,100,
	1055,1,0,0,0,102,1061,1,0,0,0,104,1106,1,0,0,0,106,1108,1,0,0,0,108,1154,
	1,0,0,0,110,1165,1,0,0,0,112,1167,1,0,0,0,114,1199,1,0,0,0,116,1201,1,0,
	0,0,118,1227,1,0,0,0,120,1232,1,0,0,0,122,1271,1,0,0,0,124,1273,1,0,0,0,
	126,1312,1,0,0,0,128,1363,1,0,0,0,130,1413,1,0,0,0,132,1435,1,0,0,0,134,
	1437,1,0,0,0,136,1500,1,0,0,0,138,1502,1,0,0,0,140,1514,1,0,0,0,142,1524,
	1,0,0,0,144,1539,1,0,0,0,146,1541,1,0,0,0,148,1557,1,0,0,0,150,1568,1,0,
	0,0,152,1579,1,0,0,0,154,1634,1,0,0,0,156,1637,1,0,0,0,158,1671,1,0,0,0,
	160,1673,1,0,0,0,162,1681,1,0,0,0,164,1687,1,0,0,0,166,1691,1,0,0,0,168,
	1709,1,0,0,0,170,1731,1,0,0,0,172,1733,1,0,0,0,174,1746,1,0,0,0,176,1757,
	1,0,0,0,178,1761,1,0,0,0,180,1774,1,0,0,0,182,1778,1,0,0,0,184,1781,1,0,
	0,0,186,1787,1,0,0,0,188,1817,1,0,0,0,190,1819,1,0,0,0,192,1833,1,0,0,0,
	194,1835,1,0,0,0,196,1844,1,0,0,0,198,1846,1,0,0,0,200,1856,1,0,0,0,202,
	1872,1,0,0,0,204,1881,1,0,0,0,206,1889,1,0,0,0,208,1900,1,0,0,0,210,1917,
	1,0,0,0,212,1940,1,0,0,0,214,1943,1,0,0,0,216,1949,1,0,0,0,218,1993,1,0,
	0,0,220,1995,1,0,0,0,222,2003,1,0,0,0,224,2005,1,0,0,0,226,2045,1,0,0,0,
	228,2047,1,0,0,0,230,2051,1,0,0,0,232,2067,1,0,0,0,234,2081,1,0,0,0,236,
	2085,1,0,0,0,238,2101,1,0,0,0,240,2273,1,0,0,0,242,2410,1,0,0,0,244,2412,
	1,0,0,0,246,2414,1,0,0,0,248,2430,1,0,0,0,250,2432,1,0,0,0,252,2436,1,0,
	0,0,254,2502,1,0,0,0,256,2504,1,0,0,0,258,260,3,16,8,0,259,258,1,0,0,0,
	260,263,1,0,0,0,261,259,1,0,0,0,261,262,1,0,0,0,262,267,1,0,0,0,263,261,
	1,0,0,0,264,266,3,2,1,0,265,264,1,0,0,0,266,269,1,0,0,0,267,265,1,0,0,0,
	267,268,1,0,0,0,268,283,1,0,0,0,269,267,1,0,0,0,270,282,3,62,31,0,271,282,
	3,56,28,0,272,282,3,52,26,0,273,282,3,60,30,0,274,282,3,8,4,0,275,282,3,
	48,24,0,276,282,3,44,22,0,277,282,3,26,13,0,278,282,3,6,3,0,279,282,3,36,
	18,0,280,282,3,38,19,0,281,270,1,0,0,0,281,271,1,0,0,0,281,272,1,0,0,0,
	281,273,1,0,0,0,281,274,1,0,0,0,281,275,1,0,0,0,281,276,1,0,0,0,281,277,
	1,0,0,0,281,278,1,0,0,0,281,279,1,0,0,0,281,280,1,0,0,0,282,285,1,0,0,0,
	283,281,1,0,0,0,283,284,1,0,0,0,284,286,1,0,0,0,285,283,1,0,0,0,286,287,
	5,0,0,1,287,1,1,0,0,0,288,289,5,1,0,0,289,290,5,151,0,0,290,315,5,2,0,0,
	291,292,5,1,0,0,292,293,5,151,0,0,293,294,5,3,0,0,294,295,5,180,0,0,295,
	315,5,2,0,0,296,297,5,1,0,0,297,298,5,4,0,0,298,303,3,4,2,0,299,300,5,5,
	0,0,300,302,3,4,2,0,301,299,1,0,0,0,302,305,1,0,0,0,303,301,1,0,0,0,303,
	304,1,0,0,0,304,307,1,0,0,0,305,303,1,0,0,0,306,308,5,5,0,0,307,306,1,0,
	0,0,307,308,1,0,0,0,308,309,1,0,0,0,309,310,5,6,0,0,310,311,5,180,0,0,311,
	312,5,151,0,0,312,313,5,2,0,0,313,315,1,0,0,0,314,288,1,0,0,0,314,291,1,
	0,0,0,314,296,1,0,0,0,315,3,1,0,0,0,316,319,5,180,0,0,317,318,5,3,0,0,318,
	320,5,180,0,0,319,317,1,0,0,0,319,320,1,0,0,0,320,5,1,0,0,0,321,322,5,7,
	0,0,322,323,3,14,7,0,323,327,3,106,53,0,324,326,3,96,48,0,325,324,1,0,0,
	0,326,329,1,0,0,0,327,325,1,0,0,0,327,328,1,0,0,0,328,331,1,0,0,0,329,327,
	1,0,0,0,330,332,3,102,51,0,331,330,1,0,0,0,331,332,1,0,0,0,332,333,1,0,
	0,0,333,337,5,4,0,0,334,336,3,114,57,0,335,334,1,0,0,0,336,339,1,0,0,0,
	337,335,1,0,0,0,337,338,1,0,0,0,338,340,1,0,0,0,339,337,1,0,0,0,340,341,
	5,6,0,0,341,7,1,0,0,0,342,343,5,8,0,0,343,344,5,180,0,0,344,349,5,9,0,0,
	345,350,3,84,42,0,346,350,3,82,41,0,347,350,3,254,127,0,348,350,5,10,0,
	0,349,345,1,0,0,0,349,346,1,0,0,0,349,347,1,0,0,0,349,348,1,0,0,0,350,352,
	1,0,0,0,351,353,5,11,0,0,352,351,1,0,0,0,352,353,1,0,0,0,353,354,1,0,0,
	0,354,382,5,2,0,0,355,356,5,8,0,0,356,357,5,4,0,0,357,362,3,10,5,0,358,
	359,5,5,0,0,359,361,3,10,5,0,360,358,1,0,0,0,361,364,1,0,0,0,362,360,1,
	0,0,0,362,363,1,0,0,0,363,366,1,0,0,0,364,362,1,0,0,0,365,367,5,5,0,0,366,
	365,1,0,0,0,366,367,1,0,0,0,367,368,1,0,0,0,368,369,5,6,0,0,369,374,5,9,
	0,0,370,375,3,84,42,0,371,375,3,82,41,0,372,375,3,254,127,0,373,375,5,10,
	0,0,374,370,1,0,0,0,374,371,1,0,0,0,374,372,1,0,0,0,374,373,1,0,0,0,375,
	377,1,0,0,0,376,378,5,11,0,0,377,376,1,0,0,0,377,378,1,0,0,0,378,379,1,
	0,0,0,379,380,5,2,0,0,380,382,1,0,0,0,381,342,1,0,0,0,381,355,1,0,0,0,382,
	9,1,0,0,0,383,386,5,180,0,0,384,385,5,12,0,0,385,387,5,180,0,0,386,384,
	1,0,0,0,386,387,1,0,0,0,387,390,1,0,0,0,388,389,5,3,0,0,389,391,3,12,6,
	0,390,388,1,0,0,0,390,391,1,0,0,0,391,11,1,0,0,0,392,393,7,0,0,0,393,13,
	1,0,0,0,394,395,7,1,0,0,395,15,1,0,0,0,396,397,5,37,0,0,397,398,3,18,9,
	0,398,399,3,20,10,0,399,400,5,2,0,0,400,411,1,0,0,0,401,402,5,37,0,0,402,
	406,5,180,0,0,403,405,7,2,0,0,404,403,1,0,0,0,405,408,1,0,0,0,406,404,1,
	0,0,0,406,407,1,0,0,0,407,409,1,0,0,0,408,406,1,0,0,0,409,411,5,2,0,0,410,
	396,1,0,0,0,410,401,1,0,0,0,411,17,1,0,0,0,412,413,7,3,0,0,413,19,1,0,0,
	0,414,416,3,22,11,0,415,414,1,0,0,0,416,417,1,0,0,0,417,415,1,0,0,0,417,
	418,1,0,0,0,418,421,1,0,0,0,419,421,5,10,0,0,420,415,1,0,0,0,420,419,1,
	0,0,0,421,21,1,0,0,0,422,424,3,24,12,0,423,422,1,0,0,0,423,424,1,0,0,0,
	424,425,1,0,0,0,425,426,7,4,0,0,426,23,1,0,0,0,427,428,7,5,0,0,428,25,1,
	0,0,0,429,430,5,41,0,0,430,440,5,180,0,0,431,432,5,42,0,0,432,437,5,180,
	0,0,433,434,5,5,0,0,434,436,5,180,0,0,435,433,1,0,0,0,436,439,1,0,0,0,437,
	435,1,0,0,0,437,438,1,0,0,0,438,441,1,0,0,0,439,437,1,0,0,0,440,431,1,0,
	0,0,440,441,1,0,0,0,441,442,1,0,0,0,442,453,5,4,0,0,443,452,3,56,28,0,444,
	452,3,52,26,0,445,452,3,60,30,0,446,452,3,44,22,0,447,452,3,48,24,0,448,
	452,3,30,15,0,449,452,3,28,14,0,450,452,3,34,17,0,451,443,1,0,0,0,451,444,
	1,0,0,0,451,445,1,0,0,0,451,446,1,0,0,0,451,447,1,0,0,0,451,448,1,0,0,0,
	451,449,1,0,0,0,451,450,1,0,0,0,452,455,1,0,0,0,453,451,1,0,0,0,453,454,
	1,0,0,0,454,456,1,0,0,0,455,453,1,0,0,0,456,457,5,6,0,0,457,27,1,0,0,0,
	458,459,3,32,16,0,459,460,3,82,41,0,460,461,5,180,0,0,461,462,5,2,0,0,462,
	469,1,0,0,0,463,464,3,32,16,0,464,465,3,84,42,0,465,466,5,180,0,0,466,467,
	5,2,0,0,467,469,1,0,0,0,468,458,1,0,0,0,468,463,1,0,0,0,469,29,1,0,0,0,
	470,471,3,32,16,0,471,472,3,254,127,0,472,473,5,180,0,0,473,474,5,2,0,0,
	474,31,1,0,0,0,475,476,7,6,0,0,476,33,1,0,0,0,477,478,5,7,0,0,478,479,5,
	180,0,0,479,483,3,106,53,0,480,482,3,96,48,0,481,480,1,0,0,0,482,485,1,
	0,0,0,483,481,1,0,0,0,483,484,1,0,0,0,484,487,1,0,0,0,485,483,1,0,0,0,486,
	488,3,102,51,0,487,486,1,0,0,0,487,488,1,0,0,0,488,489,1,0,0,0,489,490,
	5,2,0,0,490,35,1,0,0,0,491,492,5,45,0,0,492,493,5,180,0,0,493,505,5,4,0,
	0,494,504,3,56,28,0,495,504,3,52,26,0,496,504,3,60,30,0,497,504,3,44,22,
	0,498,504,3,48,24,0,499,504,3,62,31,0,500,504,3,76,38,0,501,504,3,8,4,0,
	502,504,3,6,3,0,503,494,1,0,0,0,503,495,1,0,0,0,503,496,1,0,0,0,503,497,
	1,0,0,0,503,498,1,0,0,0,503,499,1,0,0,0,503,500,1,0,0,0,503,501,1,0,0,0,
	503,502,1,0,0,0,504,507,1,0,0,0,505,503,1,0,0,0,505,506,1,0,0,0,506,508,
	1,0,0,0,507,505,1,0,0,0,508,509,5,6,0,0,509,37,1,0,0,0,510,512,5,46,0,0,
	511,510,1,0,0,0,511,512,1,0,0,0,512,513,1,0,0,0,513,514,5,47,0,0,514,516,
	5,180,0,0,515,517,3,106,53,0,516,515,1,0,0,0,516,517,1,0,0,0,517,527,1,
	0,0,0,518,519,5,42,0,0,519,524,3,40,20,0,520,521,5,5,0,0,521,523,3,40,20,
	0,522,520,1,0,0,0,523,526,1,0,0,0,524,522,1,0,0,0,524,525,1,0,0,0,525,528,
	1,0,0,0,526,524,1,0,0,0,527,518,1,0,0,0,527,528,1,0,0,0,528,529,1,0,0,0,
	529,546,5,4,0,0,530,545,3,56,28,0,531,545,3,52,26,0,532,545,3,60,30,0,533,
	545,3,44,22,0,534,545,3,48,24,0,535,545,3,62,31,0,536,545,3,8,4,0,537,545,
	3,76,38,0,538,545,3,86,43,0,539,545,3,64,32,0,540,545,3,92,46,0,541,545,
	3,42,21,0,542,545,3,66,33,0,543,545,3,70,35,0,544,530,1,0,0,0,544,531,1,
	0,0,0,544,532,1,0,0,0,544,533,1,0,0,0,544,534,1,0,0,0,544,535,1,0,0,0,544,
	536,1,0,0,0,544,537,1,0,0,0,544,538,1,0,0,0,544,539,1,0,0,0,544,540,1,0,
	0,0,544,541,1,0,0,0,544,542,1,0,0,0,544,543,1,0,0,0,545,548,1,0,0,0,546,
	544,1,0,0,0,546,547,1,0,0,0,547,549,1,0,0,0,548,546,1,0,0,0,549,550,5,6,
	0,0,550,39,1,0,0,0,551,553,5,180,0,0,552,554,3,230,115,0,553,552,1,0,0,
	0,553,554,1,0,0,0,554,41,1,0,0,0,555,556,5,7,0,0,556,557,3,14,7,0,557,562,
	3,106,53,0,558,561,3,96,48,0,559,561,3,94,47,0,560,558,1,0,0,0,560,559,
	1,0,0,0,561,564,1,0,0,0,562,560,1,0,0,0,562,563,1,0,0,0,563,566,1,0,0,0,
	564,562,1,0,0,0,565,567,3,102,51,0,566,565,1,0,0,0,566,567,1,0,0,0,567,
	568,1,0,0,0,568,569,5,2,0,0,569,43,1,0,0,0,570,571,5,48,0,0,571,572,5,180,
	0,0,572,584,5,49,0,0,573,578,3,46,23,0,574,575,5,5,0,0,575,577,3,46,23,
	0,576,574,1,0,0,0,577,580,1,0,0,0,578,576,1,0,0,0,578,579,1,0,0,0,579,582,
	1,0,0,0,580,578,1,0,0,0,581,583,5,5,0,0,582,581,1,0,0,0,582,583,1,0,0,0,
	583,585,1,0,0,0,584,573,1,0,0,0,584,585,1,0,0,0,585,586,1,0,0,0,586,588,
	5,50,0,0,587,589,5,51,0,0,588,587,1,0,0,0,588,589,1,0,0,0,589,590,1,0,0,
	0,590,591,5,2,0,0,591,45,1,0,0,0,592,595,3,254,127,0,593,595,3,84,42,0,
	594,592,1,0,0,0,594,593,1,0,0,0,595,597,1,0,0,0,596,598,5,52,0,0,597,596,
	1,0,0,0,597,598,1,0,0,0,598,600,1,0,0,0,599,601,5,180,0,0,600,599,1,0,0,
	0,600,601,1,0,0,0,601,47,1,0,0,0,602,603,5,35,0,0,603,604,5,180,0,0,604,
	616,5,49,0,0,605,610,3,50,25,0,606,607,5,5,0,0,607,609,3,50,25,0,608,606,
	1,0,0,0,609,612,1,0,0,0,610,608,1,0,0,0,610,611,1,0,0,0,611,614,1,0,0,0,
	612,610,1,0,0,0,613,615,5,5,0,0,614,613,1,0,0,0,614,615,1,0,0,0,615,617,
	1,0,0,0,616,605,1,0,0,0,616,617,1,0,0,0,617,618,1,0,0,0,618,619,5,50,0,
	0,619,620,5,2,0,0,620,49,1,0,0,0,621,623,3,254,127,0,622,624,5,180,0,0,
	623,622,1,0,0,0,623,624,1,0,0,0,624,630,1,0,0,0,625,627,3,84,42,0,626,628,
	5,180,0,0,627,626,1,0,0,0,627,628,1,0,0,0,628,630,1,0,0,0,629,621,1,0,0,
	0,629,625,1,0,0,0,630,51,1,0,0,0,631,632,5,53,0,0,632,633,5,180,0,0,633,
	635,5,4,0,0,634,636,3,54,27,0,635,634,1,0,0,0,636,637,1,0,0,0,637,635,1,
	0,0,0,637,638,1,0,0,0,638,639,1,0,0,0,639,640,5,6,0,0,640,53,1,0,0,0,641,
	645,3,254,127,0,642,645,3,84,42,0,643,645,3,82,41,0,644,641,1,0,0,0,644,
	642,1,0,0,0,644,643,1,0,0,0,645,646,1,0,0,0,646,647,3,14,7,0,647,648,5,
	2,0,0,648,55,1,0,0,0,649,650,5,54,0,0,650,651,5,180,0,0,651,652,5,4,0,0,
	652,657,3,58,29,0,653,654,5,5,0,0,654,656,3,58,29,0,655,653,1,0,0,0,656,
	659,1,0,0,0,657,655,1,0,0,0,657,658,1,0,0,0,658,661,1,0,0,0,659,657,1,0,
	0,0,660,662,5,5,0,0,661,660,1,0,0,0,661,662,1,0,0,0,662,663,1,0,0,0,663,
	664,5,6,0,0,664,57,1,0,0,0,665,668,5,180,0,0,666,667,5,40,0,0,667,669,5,
	145,0,0,668,666,1,0,0,0,668,669,1,0,0,0,669,59,1,0,0,0,670,671,5,55,0,0,
	671,672,5,180,0,0,672,673,5,42,0,0,673,674,3,254,127,0,674,675,5,2,0,0,
	675,61,1,0,0,0,676,677,3,254,127,0,677,678,5,56,0,0,678,679,5,180,0,0,679,
	680,5,40,0,0,680,681,3,240,120,0,681,682,5,2,0,0,682,63,1,0,0,0,683,684,
	5,57,0,0,684,688,3,106,53,0,685,687,7,7,0,0,686,685,1,0,0,0,687,690,1,0,
	0,0,688,686,1,0,0,0,688,689,1,0,0,0,689,694,1,0,0,0,690,688,1,0,0,0,691,
	693,3,74,37,0,692,691,1,0,0,0,693,696,1,0,0,0,694,692,1,0,0,0,694,695,1,
	0,0,0,695,700,1,0,0,0,696,694,1,0,0,0,697,699,7,7,0,0,698,697,1,0,0,0,699,
	702,1,0,0,0,700,698,1,0,0,0,700,701,1,0,0,0,701,706,1,0,0,0,702,700,1,0,
	0,0,703,705,3,94,47,0,704,703,1,0,0,0,705,708,1,0,0,0,706,704,1,0,0,0,706,
	707,1,0,0,0,707,709,1,0,0,0,708,706,1,0,0,0,709,713,5,4,0,0,710,712,3,114,
	57,0,711,710,1,0,0,0,712,715,1,0,0,0,713,711,1,0,0,0,713,714,1,0,0,0,714,
	716,1,0,0,0,715,713,1,0,0,0,716,717,5,6,0,0,717,65,1,0,0,0,718,719,5,60,
	0,0,719,723,3,106,53,0,720,722,3,68,34,0,721,720,1,0,0,0,722,725,1,0,0,
	0,723,721,1,0,0,0,723,724,1,0,0,0,724,726,1,0,0,0,725,723,1,0,0,0,726,730,
	5,44,0,0,727,729,3,68,34,0,728,727,1,0,0,0,729,732,1,0,0,0,730,728,1,0,
	0,0,730,731,1,0,0,0,731,736,1,0,0,0,732,730,1,0,0,0,733,735,3,94,47,0,734,
	733,1,0,0,0,735,738,1,0,0,0,736,734,1,0,0,0,736,737,1,0,0,0,737,740,1,0,
	0,0,738,736,1,0,0,0,739,741,3,102,51,0,740,739,1,0,0,0,740,741,1,0,0,0,
	741,742,1,0,0,0,742,746,5,4,0,0,743,745,3,114,57,0,744,743,1,0,0,0,745,
	748,1,0,0,0,746,744,1,0,0,0,746,747,1,0,0,0,747,749,1,0,0,0,748,746,1,0,
	0,0,749,750,5,6,0,0,750,67,1,0,0,0,751,755,5,59,0,0,752,755,5,61,0,0,753,
	755,3,98,49,0,754,751,1,0,0,0,754,752,1,0,0,0,754,753,1,0,0,0,755,69,1,
	0,0,0,756,757,5,62,0,0,757,758,5,49,0,0,758,762,5,50,0,0,759,761,3,72,36,
	0,760,759,1,0,0,0,761,764,1,0,0,0,762,760,1,0,0,0,762,763,1,0,0,0,763,765,
	1,0,0,0,764,762,1,0,0,0,765,769,5,44,0,0,766,768,3,72,36,0,767,766,1,0,
	0,0,768,771,1,0,0,0,769,767,1,0,0,0,769,770,1,0,0,0,770,772,1,0,0,0,771,
	769,1,0,0,0,772,776,5,59,0,0,773,775,3,72,36,0,774,773,1,0,0,0,775,778,
	1,0,0,0,776,774,1,0,0,0,776,777,1,0,0,0,777,788,1,0,0,0,778,776,1,0,0,0,
	779,783,5,4,0,0,780,782,3,114,57,0,781,780,1,0,0,0,782,785,1,0,0,0,783,
	781,1,0,0,0,783,784,1,0,0,0,784,786,1,0,0,0,785,783,1,0,0,0,786,789,5,6,
	0,0,787,789,5,2,0,0,788,779,1,0,0,0,788,787,1,0,0,0,789,825,1,0,0,0,790,
	791,5,62,0,0,791,792,5,49,0,0,792,796,5,50,0,0,793,795,3,72,36,0,794,793,
	1,0,0,0,795,798,1,0,0,0,796,794,1,0,0,0,796,797,1,0,0,0,797,799,1,0,0,0,
	798,796,1,0,0,0,799,803,5,59,0,0,800,802,3,72,36,0,801,800,1,0,0,0,802,
	805,1,0,0,0,803,801,1,0,0,0,803,804,1,0,0,0,804,806,1,0,0,0,805,803,1,0,
	0,0,806,810,5,44,0,0,807,809,3,72,36,0,808,807,1,0,0,0,809,812,1,0,0,0,
	810,808,1,0,0,0,810,811,1,0,0,0,811,822,1,0,0,0,812,810,1,0,0,0,813,817,
	5,4,0,0,814,816,3,114,57,0,815,814,1,0,0,0,816,819,1,0,0,0,817,815,1,0,
	0,0,817,818,1,0,0,0,818,820,1,0,0,0,819,817,1,0,0,0,820,823,5,6,0,0,821,
	823,5,2,0,0,822,813,1,0,0,0,822,821,1,0,0,0,823,825,1,0,0,0,824,756,1,0,
	0,0,824,790,1,0,0,0,825,71,1,0,0,0,826,829,5,61,0,0,827,829,3,98,49,0,828,
	826,1,0,0,0,828,827,1,0,0,0,829,73,1,0,0,0,830,831,5,180,0,0,831,832,3,
	230,115,0,832,75,1,0,0,0,833,835,3,80,40,0,834,833,1,0,0,0,834,835,1,0,
	0,0,835,836,1,0,0,0,836,841,3,254,127,0,837,840,3,244,122,0,838,840,3,98,
	49,0,839,837,1,0,0,0,839,838,1,0,0,0,840,843,1,0,0,0,841,839,1,0,0,0,841,
	842,1,0,0,0,842,844,1,0,0,0,843,841,1,0,0,0,844,847,5,180,0,0,845,846,5,
	40,0,0,846,848,3,240,120,0,847,845,1,0,0,0,847,848,1,0,0,0,848,849,1,0,
	0,0,849,850,5,2,0,0,850,905,1,0,0,0,851,856,3,254,127,0,852,855,3,244,122,
	0,853,855,3,98,49,0,854,852,1,0,0,0,854,853,1,0,0,0,855,858,1,0,0,0,856,
	854,1,0,0,0,856,857,1,0,0,0,857,859,1,0,0,0,858,856,1,0,0,0,859,864,3,80,
	40,0,860,863,3,244,122,0,861,863,3,98,49,0,862,860,1,0,0,0,862,861,1,0,
	0,0,863,866,1,0,0,0,864,862,1,0,0,0,864,865,1,0,0,0,865,867,1,0,0,0,866,
	864,1,0,0,0,867,870,5,180,0,0,868,869,5,40,0,0,869,871,3,240,120,0,870,
	868,1,0,0,0,870,871,1,0,0,0,871,872,1,0,0,0,872,873,5,2,0,0,873,905,1,0,
	0,0,874,876,3,80,40,0,875,874,1,0,0,0,875,876,1,0,0,0,876,877,1,0,0,0,877,
	881,3,82,41,0,878,880,3,78,39,0,879,878,1,0,0,0,880,883,1,0,0,0,881,879,
	1,0,0,0,881,882,1,0,0,0,882,884,1,0,0,0,883,881,1,0,0,0,884,885,5,180,0,
	0,885,886,5,2,0,0,886,905,1,0,0,0,887,889,3,80,40,0,888,887,1,0,0,0,888,
	889,1,0,0,0,889,890,1,0,0,0,890,894,3,84,42,0,891,893,3,78,39,0,892,891,
	1,0,0,0,893,896,1,0,0,0,894,892,1,0,0,0,894,895,1,0,0,0,895,897,1,0,0,0,
	896,894,1,0,0,0,897,900,5,180,0,0,898,899,5,40,0,0,899,901,3,240,120,0,
	900,898,1,0,0,0,900,901,1,0,0,0,901,902,1,0,0,0,902,903,5,2,0,0,903,905,
	1,0,0,0,904,834,1,0,0,0,904,851,1,0,0,0,904,875,1,0,0,0,904,888,1,0,0,0,
	905,77,1,0,0,0,906,910,3,244,122,0,907,910,3,80,40,0,908,910,3,98,49,0,
	909,906,1,0,0,0,909,907,1,0,0,0,909,908,1,0,0,0,910,79,1,0,0,0,911,912,
	7,8,0,0,912,81,1,0,0,0,913,914,5,64,0,0,914,915,5,49,0,0,915,917,3,254,
	127,0,916,918,5,180,0,0,917,916,1,0,0,0,917,918,1,0,0,0,918,919,1,0,0,0,
	919,920,5,65,0,0,920,922,3,254,127,0,921,923,5,180,0,0,922,921,1,0,0,0,
	922,923,1,0,0,0,923,924,1,0,0,0,924,925,5,50,0,0,925,950,1,0,0,0,926,927,
	5,64,0,0,927,928,5,49,0,0,928,930,3,254,127,0,929,931,5,180,0,0,930,929,
	1,0,0,0,930,931,1,0,0,0,931,932,1,0,0,0,932,933,5,65,0,0,933,934,3,82,41,
	0,934,935,5,50,0,0,935,950,1,0,0,0,936,937,5,64,0,0,937,938,5,49,0,0,938,
	940,3,254,127,0,939,941,5,180,0,0,940,939,1,0,0,0,940,941,1,0,0,0,941,942,
	1,0,0,0,942,943,5,65,0,0,943,945,3,84,42,0,944,946,5,180,0,0,945,944,1,
	0,0,0,945,946,1,0,0,0,946,947,1,0,0,0,947,948,5,50,0,0,948,950,1,0,0,0,
	949,913,1,0,0,0,949,926,1,0,0,0,949,936,1,0,0,0,950,83,1,0,0,0,951,952,
	6,42,-1,0,952,953,3,254,127,0,953,955,5,66,0,0,954,956,3,240,120,0,955,
	954,1,0,0,0,955,956,1,0,0,0,956,957,1,0,0,0,957,958,5,67,0,0,958,967,1,
	0,0,0,959,960,10,1,0,0,960,962,5,66,0,0,961,963,3,240,120,0,962,961,1,0,
	0,0,962,963,1,0,0,0,963,964,1,0,0,0,964,966,5,67,0,0,965,959,1,0,0,0,966,
	969,1,0,0,0,967,965,1,0,0,0,967,968,1,0,0,0,968,85,1,0,0,0,969,967,1,0,
	0,0,970,971,5,68,0,0,971,973,5,180,0,0,972,974,3,106,53,0,973,972,1,0,0,
	0,973,974,1,0,0,0,974,979,1,0,0,0,975,978,5,61,0,0,976,978,3,98,49,0,977,
	975,1,0,0,0,977,976,1,0,0,0,978,981,1,0,0,0,979,977,1,0,0,0,979,980,1,0,
	0,0,980,991,1,0,0,0,981,979,1,0,0,0,982,986,5,4,0,0,983,985,3,88,44,0,984,
	983,1,0,0,0,985,988,1,0,0,0,986,984,1,0,0,0,986,987,1,0,0,0,987,989,1,0,
	0,0,988,986,1,0,0,0,989,992,5,6,0,0,990,992,5,2,0,0,991,982,1,0,0,0,991,
	990,1,0,0,0,992,87,1,0,0,0,993,996,3,90,45,0,994,996,3,114,57,0,995,993,
	1,0,0,0,995,994,1,0,0,0,996,89,1,0,0,0,997,998,5,69,0,0,998,999,5,2,0,0,
	999,91,1,0,0,0,1000,1001,5,7,0,0,1001,1002,3,14,7,0,1002,1007,3,106,53,
	0,1003,1006,3,96,48,0,1004,1006,3,94,47,0,1005,1003,1,0,0,0,1005,1004,1,
	0,0,0,1006,1009,1,0,0,0,1007,1005,1,0,0,0,1007,1008,1,0,0,0,1008,1011,1,
	0,0,0,1009,1007,1,0,0,0,1010,1012,3,102,51,0,1011,1010,1,0,0,0,1011,1012,
	1,0,0,0,1012,1013,1,0,0,0,1013,1017,5,4,0,0,1014,1016,3,114,57,0,1015,1014,
	1,0,0,0,1016,1019,1,0,0,0,1017,1015,1,0,0,0,1017,1018,1,0,0,0,1018,1020,
	1,0,0,0,1019,1017,1,0,0,0,1020,1021,5,6,0,0,1021,93,1,0,0,0,1022,1024,5,
	180,0,0,1023,1025,3,230,115,0,1024,1023,1,0,0,0,1024,1025,1,0,0,0,1025,
	95,1,0,0,0,1026,1041,5,70,0,0,1027,1041,5,71,0,0,1028,1041,5,58,0,0,1029,
	1041,5,44,0,0,1030,1041,5,43,0,0,1031,1041,5,63,0,0,1032,1041,5,59,0,0,
	1033,1041,3,98,49,0,1034,1041,5,61,0,0,1035,1041,3,100,50,0,1036,1041,5,
	30,0,0,1037,1041,5,28,0,0,1038,1041,5,31,0,0,1039,1041,5,29,0,0,1040,1026,
	1,0,0,0,1040,1027,1,0,0,0,1040,1028,1,0,0,0,1040,1029,1,0,0,0,1040,1030,
	1,0,0,0,1040,1031,1,0,0,0,1040,1032,1,0,0,0,1040,1033,1,0,0,0,1040,1034,
	1,0,0,0,1040,1035,1,0,0,0,1040,1036,1,0,0,0,1040,1037,1,0,0,0,1040,1038,
	1,0,0,0,1040,1039,1,0,0,0,1041,97,1,0,0,0,1042,1053,5,72,0,0,1043,1044,
	5,49,0,0,1044,1049,5,180,0,0,1045,1046,5,5,0,0,1046,1048,5,180,0,0,1047,
	1045,1,0,0,0,1048,1051,1,0,0,0,1049,1047,1,0,0,0,1049,1050,1,0,0,0,1050,
	1052,1,0,0,0,1051,1049,1,0,0,0,1052,1054,5,50,0,0,1053,1043,1,0,0,0,1053,
	1054,1,0,0,0,1054,99,1,0,0,0,1055,1059,5,32,0,0,1056,1057,5,49,0,0,1057,
	1058,5,145,0,0,1058,1060,5,50,0,0,1059,1056,1,0,0,0,1059,1060,1,0,0,0,1060,
	101,1,0,0,0,1061,1062,5,73,0,0,1062,1063,5,49,0,0,1063,1068,3,104,52,0,
	1064,1065,5,5,0,0,1065,1067,3,104,52,0,1066,1064,1,0,0,0,1067,1070,1,0,
	0,0,1068,1066,1,0,0,0,1068,1069,1,0,0,0,1069,1072,1,0,0,0,1070,1068,1,0,
	0,0,1071,1073,5,5,0,0,1072,1071,1,0,0,0,1072,1073,1,0,0,0,1073,1074,1,0,
	0,0,1074,1075,5,50,0,0,1075,103,1,0,0,0,1076,1080,3,254,127,0,1077,1079,
	3,244,122,0,1078,1077,1,0,0,0,1079,1082,1,0,0,0,1080,1078,1,0,0,0,1080,
	1081,1,0,0,0,1081,1084,1,0,0,0,1082,1080,1,0,0,0,1083,1085,3,14,7,0,1084,
	1083,1,0,0,0,1084,1085,1,0,0,0,1085,1107,1,0,0,0,1086,1090,3,84,42,0,1087,
	1089,3,244,122,0,1088,1087,1,0,0,0,1089,1092,1,0,0,0,1090,1088,1,0,0,0,
	1090,1091,1,0,0,0,1091,1094,1,0,0,0,1092,1090,1,0,0,0,1093,1095,3,14,7,
	0,1094,1093,1,0,0,0,1094,1095,1,0,0,0,1095,1107,1,0,0,0,1096,1100,3,82,
	41,0,1097,1099,3,244,122,0,1098,1097,1,0,0,0,1099,1102,1,0,0,0,1100,1098,
	1,0,0,0,1100,1101,1,0,0,0,1101,1104,1,0,0,0,1102,1100,1,0,0,0,1103,1105,
	3,14,7,0,1104,1103,1,0,0,0,1104,1105,1,0,0,0,1105,1107,1,0,0,0,1106,1076,
	1,0,0,0,1106,1086,1,0,0,0,1106,1096,1,0,0,0,1107,105,1,0,0,0,1108,1120,
	5,49,0,0,1109,1114,3,108,54,0,1110,1111,5,5,0,0,1111,1113,3,108,54,0,1112,
	1110,1,0,0,0,1113,1116,1,0,0,0,1114,1112,1,0,0,0,1114,1115,1,0,0,0,1115,
	1118,1,0,0,0,1116,1114,1,0,0,0,1117,1119,5,5,0,0,1118,1117,1,0,0,0,1118,
	1119,1,0,0,0,1119,1121,1,0,0,0,1120,1109,1,0,0,0,1120,1121,1,0,0,0,1121,
	1122,1,0,0,0,1122,1123,5,50,0,0,1123,107,1,0,0,0,1124,1128,3,254,127,0,
	1125,1127,3,244,122,0,1126,1125,1,0,0,0,1127,1130,1,0,0,0,1128,1126,1,0,
	0,0,1128,1129,1,0,0,0,1129,1132,1,0,0,0,1130,1128,1,0,0,0,1131,1133,3,14,
	7,0,1132,1131,1,0,0,0,1132,1133,1,0,0,0,1133,1155,1,0,0,0,1134,1138,3,84,
	42,0,1135,1137,3,244,122,0,1136,1135,1,0,0,0,1137,1140,1,0,0,0,1138,1136,
	1,0,0,0,1138,1139,1,0,0,0,1139,1142,1,0,0,0,1140,1138,1,0,0,0,1141,1143,
	3,14,7,0,1142,1141,1,0,0,0,1142,1143,1,0,0,0,1143,1155,1,0,0,0,1144,1148,
	3,82,41,0,1145,1147,3,244,122,0,1146,1145,1,0,0,0,1147,1150,1,0,0,0,1148,
	1146,1,0,0,0,1148,1149,1,0,0,0,1149,1152,1,0,0,0,1150,1148,1,0,0,0,1151,
	1153,3,14,7,0,1152,1151,1,0,0,0,1152,1153,1,0,0,0,1153,1155,1,0,0,0,1154,
	1124,1,0,0,0,1154,1134,1,0,0,0,1154,1144,1,0,0,0,1155,109,1,0,0,0,1156,
	1160,5,4,0,0,1157,1159,3,114,57,0,1158,1157,1,0,0,0,1159,1162,1,0,0,0,1160,
	1158,1,0,0,0,1160,1161,1,0,0,0,1161,1163,1,0,0,0,1162,1160,1,0,0,0,1163,
	1166,5,6,0,0,1164,1166,3,114,57,0,1165,1156,1,0,0,0,1165,1164,1,0,0,0,1166,
	111,1,0,0,0,1167,1171,5,4,0,0,1168,1170,3,114,57,0,1169,1168,1,0,0,0,1170,
	1173,1,0,0,0,1171,1169,1,0,0,0,1171,1172,1,0,0,0,1172,1174,1,0,0,0,1173,
	1171,1,0,0,0,1174,1175,5,6,0,0,1175,113,1,0,0,0,1176,1200,3,90,45,0,1177,
	1200,3,112,56,0,1178,1200,3,128,64,0,1179,1200,3,130,65,0,1180,1200,3,120,
	60,0,1181,1200,3,138,69,0,1182,1200,3,140,70,0,1183,1200,3,142,71,0,1184,
	1200,3,144,72,0,1185,1200,3,164,82,0,1186,1200,3,126,63,0,1187,1200,3,122,
	61,0,1188,1200,3,124,62,0,1189,1200,3,166,83,0,1190,1200,3,206,103,0,1191,
	1200,3,218,109,0,1192,1200,3,220,110,0,1193,1200,3,136,68,0,1194,1200,3,
	198,99,0,1195,1200,3,200,100,0,1196,1200,3,212,106,0,1197,1200,3,214,107,
	0,1198,1200,3,116,58,0,1199,1176,1,0,0,0,1199,1177,1,0,0,0,1199,1178,1,
	0,0,0,1199,1179,1,0,0,0,1199,1180,1,0,0,0,1199,1181,1,0,0,0,1199,1182,1,
	0,0,0,1199,1183,1,0,0,0,1199,1184,1,0,0,0,1199,1185,1,0,0,0,1199,1186,1,
	0,0,0,1199,1187,1,0,0,0,1199,1188,1,0,0,0,1199,1189,1,0,0,0,1199,1190,1,
	0,0,0,1199,1191,1,0,0,0,1199,1192,1,0,0,0,1199,1193,1,0,0,0,1199,1194,1,
	0,0,0,1199,1195,1,0,0,0,1199,1196,1,0,0,0,1199,1197,1,0,0,0,1199,1198,1,
	0,0,0,1200,115,1,0,0,0,1201,1223,3,240,120,0,1202,1203,7,9,0,0,1203,1224,
	3,118,59,0,1204,1205,5,165,0,0,1205,1206,5,49,0,0,1206,1207,5,50,0,0,1207,
	1208,5,40,0,0,1208,1224,3,240,120,0,1209,1210,5,165,0,0,1210,1212,5,49,
	0,0,1211,1213,3,134,67,0,1212,1211,1,0,0,0,1212,1213,1,0,0,0,1213,1214,
	1,0,0,0,1214,1224,5,50,0,0,1215,1216,5,166,0,0,1216,1217,5,49,0,0,1217,
	1224,5,50,0,0,1218,1219,5,169,0,0,1219,1220,5,49,0,0,1220,1221,3,240,120,
	0,1221,1222,5,50,0,0,1222,1224,1,0,0,0,1223,1202,1,0,0,0,1223,1204,1,0,
	0,0,1223,1209,1,0,0,0,1223,1215,1,0,0,0,1223,1218,1,0,0,0,1223,1224,1,0,
	0,0,1224,1225,1,0,0,0,1225,1226,5,2,0,0,1226,117,1,0,0,0,1227,1230,3,240,
	120,0,1228,1229,7,9,0,0,1229,1231,3,118,59,0,1230,1228,1,0,0,0,1230,1231,
	1,0,0,0,1231,119,1,0,0,0,1232,1233,7,10,0,0,1233,1234,3,240,120,0,1234,
	1235,5,2,0,0,1235,121,1,0,0,0,1236,1237,5,86,0,0,1237,1272,5,2,0,0,1238,
	1239,5,86,0,0,1239,1240,3,240,120,0,1240,1241,7,9,0,0,1241,1242,3,118,59,
	0,1242,1243,5,2,0,0,1243,1272,1,0,0,0,1244,1245,5,86,0,0,1245,1250,3,240,
	120,0,1246,1247,5,5,0,0,1247,1249,3,240,120,0,1248,1246,1,0,0,0,1249,1252,
	1,0,0,0,1250,1248,1,0,0,0,1250,1251,1,0,0,0,1251,1253,1,0,0,0,1252,1250,
	1,0,0,0,1253,1254,5,2,0,0,1254,1272,1,0,0,0,1255,1256,5,86,0,0,1256,1257,
	5,49,0,0,1257,1262,3,240,120,0,1258,1259,5,5,0,0,1259,1261,3,240,120,0,
	1260,1258,1,0,0,0,1261,1264,1,0,0,0,1262,1260,1,0,0,0,1262,1263,1,0,0,0,
	1263,1266,1,0,0,0,1264,1262,1,0,0,0,1265,1267,5,5,0,0,1266,1265,1,0,0,0,
	1266,1267,1,0,0,0,1267,1268,1,0,0,0,1268,1269,5,50,0,0,1269,1270,5,2,0,
	0,1270,1272,1,0,0,0,1271,1236,1,0,0,0,1271,1238,1,0,0,0,1271,1244,1,0,0,
	0,1271,1255,1,0,0,0,1272,123,1,0,0,0,1273,1274,5,31,0,0,1274,1275,5,49,
	0,0,1275,1276,3,240,120,0,1276,1277,5,50,0,0,1277,1278,5,2,0,0,1278,125,
	1,0,0,0,1279,1280,5,87,0,0,1280,1283,5,180,0,0,1281,1282,5,12,0,0,1282,
	1284,5,180,0,0,1283,1281,1,0,0,0,1283,1284,1,0,0,0,1284,1285,1,0,0,0,1285,
	1286,5,49,0,0,1286,1298,5,4,0,0,1287,1292,3,228,114,0,1288,1289,5,5,0,0,
	1289,1291,3,228,114,0,1290,1288,1,0,0,0,1291,1294,1,0,0,0,1292,1290,1,0,
	0,0,1292,1293,1,0,0,0,1293,1296,1,0,0,0,1294,1292,1,0,0,0,1295,1297,5,5,
	0,0,1296,1295,1,0,0,0,1296,1297,1,0,0,0,1297,1299,1,0,0,0,1298,1287,1,0,
	0,0,1298,1299,1,0,0,0,1299,1300,1,0,0,0,1300,1301,5,6,0,0,1301,1302,5,50,
	0,0,1302,1313,5,2,0,0,1303,1304,5,87,0,0,1304,1307,5,180,0,0,1305,1306,
	5,12,0,0,1306,1308,5,180,0,0,1307,1305,1,0,0,0,1307,1308,1,0,0,0,1308,1309,
	1,0,0,0,1309,1310,3,230,115,0,1310,1311,5,2,0,0,1311,1313,1,0,0,0,1312,
	1279,1,0,0,0,1312,1303,1,0,0,0,1313,127,1,0,0,0,1314,1318,3,254,127,0,1315,
	1317,3,244,122,0,1316,1315,1,0,0,0,1317,1320,1,0,0,0,1318,1316,1,0,0,0,
	1318,1319,1,0,0,0,1319,1321,1,0,0,0,1320,1318,1,0,0,0,1321,1331,3,14,7,
	0,1322,1323,5,40,0,0,1323,1329,3,240,120,0,1324,1325,7,9,0,0,1325,1330,
	3,118,59,0,1326,1327,5,165,0,0,1327,1328,5,49,0,0,1328,1330,5,50,0,0,1329,
	1324,1,0,0,0,1329,1326,1,0,0,0,1329,1330,1,0,0,0,1330,1332,1,0,0,0,1331,
	1322,1,0,0,0,1331,1332,1,0,0,0,1332,1333,1,0,0,0,1333,1334,5,2,0,0,1334,
	1364,1,0,0,0,1335,1339,3,84,42,0,1336,1338,3,244,122,0,1337,1336,1,0,0,
	0,1338,1341,1,0,0,0,1339,1337,1,0,0,0,1339,1340,1,0,0,0,1340,1342,1,0,0,
	0,1341,1339,1,0,0,0,1342,1345,3,14,7,0,1343,1344,5,40,0,0,1344,1346,3,240,
	120,0,1345,1343,1,0,0,0,1345,1346,1,0,0,0,1346,1347,1,0,0,0,1347,1348,5,
	2,0,0,1348,1364,1,0,0,0,1349,1353,3,82,41,0,1350,1352,3,244,122,0,1351,
	1350,1,0,0,0,1352,1355,1,0,0,0,1353,1351,1,0,0,0,1353,1354,1,0,0,0,1354,
	1356,1,0,0,0,1355,1353,1,0,0,0,1356,1359,3,14,7,0,1357,1358,5,40,0,0,1358,
	1360,3,240,120,0,1359,1357,1,0,0,0,1359,1360,1,0,0,0,1360,1361,1,0,0,0,
	1361,1362,5,2,0,0,1362,1364,1,0,0,0,1363,1314,1,0,0,0,1363,1335,1,0,0,0,
	1363,1349,1,0,0,0,1364,129,1,0,0,0,1365,1366,3,254,127,0,1366,1371,5,180,
	0,0,1367,1368,5,5,0,0,1368,1369,3,254,127,0,1369,1370,5,180,0,0,1370,1372,
	1,0,0,0,1371,1367,1,0,0,0,1372,1373,1,0,0,0,1373,1371,1,0,0,0,1373,1374,
	1,0,0,0,1374,1375,1,0,0,0,1375,1376,5,40,0,0,1376,1377,3,240,120,0,1377,
	1378,5,2,0,0,1378,1414,1,0,0,0,1379,1380,5,49,0,0,1380,1383,3,132,66,0,
	1381,1382,5,5,0,0,1382,1384,3,132,66,0,1383,1381,1,0,0,0,1384,1385,1,0,
	0,0,1385,1383,1,0,0,0,1385,1386,1,0,0,0,1386,1387,1,0,0,0,1387,1388,5,50,
	0,0,1388,1389,5,40,0,0,1389,1390,5,49,0,0,1390,1393,3,240,120,0,1391,1392,
	5,5,0,0,1392,1394,3,240,120,0,1393,1391,1,0,0,0,1394,1395,1,0,0,0,1395,
	1393,1,0,0,0,1395,1396,1,0,0,0,1396,1397,1,0,0,0,1397,1398,5,50,0,0,1398,
	1399,5,2,0,0,1399,1414,1,0,0,0,1400,1401,5,49,0,0,1401,1404,3,132,66,0,
	1402,1403,5,5,0,0,1403,1405,3,132,66,0,1404,1402,1,0,0,0,1405,1406,1,0,
	0,0,1406,1404,1,0,0,0,1406,1407,1,0,0,0,1407,1408,1,0,0,0,1408,1409,5,50,
	0,0,1409,1410,5,40,0,0,1410,1411,3,240,120,0,1411,1412,5,2,0,0,1412,1414,
	1,0,0,0,1413,1365,1,0,0,0,1413,1379,1,0,0,0,1413,1400,1,0,0,0,1414,131,
	1,0,0,0,1415,1419,3,254,127,0,1416,1418,3,244,122,0,1417,1416,1,0,0,0,1418,
	1421,1,0,0,0,1419,1417,1,0,0,0,1419,1420,1,0,0,0,1420,1422,1,0,0,0,1421,
	1419,1,0,0,0,1422,1423,3,14,7,0,1423,1436,1,0,0,0,1424,1428,3,84,42,0,1425,
	1427,3,244,122,0,1426,1425,1,0,0,0,1427,1430,1,0,0,0,1428,1426,1,0,0,0,
	1428,1429,1,0,0,0,1429,1431,1,0,0,0,1430,1428,1,0,0,0,1431,1432,3,14,7,
	0,1432,1436,1,0,0,0,1433,1436,3,14,7,0,1434,1436,1,0,0,0,1435,1415,1,0,
	0,0,1435,1424,1,0,0,0,1435,1433,1,0,0,0,1435,1434,1,0,0,0,1436,133,1,0,
	0,0,1437,1438,3,240,120,0,1438,135,1,0,0,0,1439,1440,5,88,0,0,1440,1441,
	5,180,0,0,1441,1501,5,2,0,0,1442,1443,5,88,0,0,1443,1444,5,89,0,0,1444,
	1445,5,12,0,0,1445,1446,5,180,0,0,1446,1501,5,2,0,0,1447,1448,5,88,0,0,
	1448,1449,5,89,0,0,1449,1450,5,12,0,0,1450,1455,5,180,0,0,1451,1452,5,66,
	0,0,1452,1453,3,240,120,0,1453,1454,5,67,0,0,1454,1456,1,0,0,0,1455,1451,
	1,0,0,0,1456,1457,1,0,0,0,1457,1455,1,0,0,0,1457,1458,1,0,0,0,1458,1459,
	1,0,0,0,1459,1460,5,2,0,0,1460,1501,1,0,0,0,1461,1462,5,88,0,0,1462,1467,
	5,180,0,0,1463,1464,5,66,0,0,1464,1465,3,240,120,0,1465,1466,5,67,0,0,1466,
	1468,1,0,0,0,1467,1463,1,0,0,0,1468,1469,1,0,0,0,1469,1467,1,0,0,0,1469,
	1470,1,0,0,0,1470,1471,1,0,0,0,1471,1472,5,2,0,0,1472,1501,1,0,0,0,1473,
	1474,5,88,0,0,1474,1477,5,180,0,0,1475,1476,5,12,0,0,1476,1478,5,180,0,
	0,1477,1475,1,0,0,0,1478,1479,1,0,0,0,1479,1477,1,0,0,0,1479,1480,1,0,0,
	0,1480,1485,1,0,0,0,1481,1482,5,66,0,0,1482,1483,3,240,120,0,1483,1484,
	5,67,0,0,1484,1486,1,0,0,0,1485,1481,1,0,0,0,1486,1487,1,0,0,0,1487,1485,
	1,0,0,0,1487,1488,1,0,0,0,1488,1489,1,0,0,0,1489,1490,5,2,0,0,1490,1501,
	1,0,0,0,1491,1492,5,88,0,0,1492,1495,5,180,0,0,1493,1494,5,12,0,0,1494,
	1496,5,180,0,0,1495,1493,1,0,0,0,1496,1497,1,0,0,0,1497,1495,1,0,0,0,1497,
	1498,1,0,0,0,1498,1499,1,0,0,0,1499,1501,5,2,0,0,1500,1439,1,0,0,0,1500,
	1442,1,0,0,0,1500,1447,1,0,0,0,1500,1461,1,0,0,0,1500,1473,1,0,0,0,1500,
	1491,1,0,0,0,1501,137,1,0,0,0,1502,1503,5,90,0,0,1503,1504,5,49,0,0,1504,
	1505,5,154,0,0,1505,1506,5,23,0,0,1506,1509,3,240,120,0,1507,1508,5,5,0,
	0,1508,1510,3,216,108,0,1509,1507,1,0,0,0,1509,1510,1,0,0,0,1510,1511,1,
	0,0,0,1511,1512,5,50,0,0,1512,1513,5,2,0,0,1513,139,1,0,0,0,1514,1515,5,
	90,0,0,1515,1516,5,49,0,0,1516,1519,3,240,120,0,1517,1518,5,5,0,0,1518,
	1520,3,216,108,0,1519,1517,1,0,0,0,1519,1520,1,0,0,0,1520,1521,1,0,0,0,
	1521,1522,5,50,0,0,1522,1523,5,2,0,0,1523,141,1,0,0,0,1524,1525,5,91,0,
	0,1525,1526,5,49,0,0,1526,1527,3,240,120,0,1527,1528,5,50,0,0,1528,1531,
	3,110,55,0,1529,1530,5,92,0,0,1530,1532,3,110,55,0,1531,1529,1,0,0,0,1531,
	1532,1,0,0,0,1532,143,1,0,0,0,1533,1540,3,160,80,0,1534,1540,3,162,81,0,
	1535,1540,3,152,76,0,1536,1540,3,146,73,0,1537,1540,3,148,74,0,1538,1540,
	3,150,75,0,1539,1533,1,0,0,0,1539,1534,1,0,0,0,1539,1535,1,0,0,0,1539,1536,
	1,0,0,0,1539,1537,1,0,0,0,1539,1538,1,0,0,0,1540,145,1,0,0,0,1541,1542,
	5,9,0,0,1542,1543,5,49,0,0,1543,1544,3,254,127,0,1544,1545,5,180,0,0,1545,
	1546,5,5,0,0,1546,1547,3,254,127,0,1547,1548,5,180,0,0,1548,1549,5,93,0,
	0,1549,1550,5,89,0,0,1550,1551,5,12,0,0,1551,1552,5,180,0,0,1552,1553,5,
	12,0,0,1553,1554,5,34,0,0,1554,1555,5,50,0,0,1555,1556,3,110,55,0,1556,
	147,1,0,0,0,1557,1558,5,9,0,0,1558,1559,5,49,0,0,1559,1560,3,254,127,0,
	1560,1561,5,180,0,0,1561,1562,5,94,0,0,1562,1563,5,89,0,0,1563,1564,5,12,
	0,0,1564,1565,5,180,0,0,1565,1566,5,50,0,0,1566,1567,3,110,55,0,1567,149,
	1,0,0,0,1568,1569,5,9,0,0,1569,1570,5,49,0,0,1570,1571,3,254,127,0,1571,
	1572,5,180,0,0,1572,1573,5,93,0,0,1573,1574,5,89,0,0,1574,1575,5,12,0,0,
	1575,1576,5,180,0,0,1576,1577,5,50,0,0,1577,1578,3,110,55,0,1578,151,1,
	0,0,0,1579,1580,5,9,0,0,1580,1581,5,49,0,0,1581,1582,3,154,77,0,1582,1584,
	3,156,78,0,1583,1585,3,158,79,0,1584,1583,1,0,0,0,1584,1585,1,0,0,0,1585,
	1586,1,0,0,0,1586,1587,5,50,0,0,1587,1588,3,110,55,0,1588,153,1,0,0,0,1589,
	1593,3,254,127,0,1590,1592,3,244,122,0,1591,1590,1,0,0,0,1592,1595,1,0,
	0,0,1593,1591,1,0,0,0,1593,1594,1,0,0,0,1594,1596,1,0,0,0,1595,1593,1,0,
	0,0,1596,1599,5,180,0,0,1597,1598,5,40,0,0,1598,1600,3,240,120,0,1599,1597,
	1,0,0,0,1599,1600,1,0,0,0,1600,1601,1,0,0,0,1601,1602,5,2,0,0,1602,1635,
	1,0,0,0,1603,1604,5,180,0,0,1604,1605,7,9,0,0,1605,1606,3,240,120,0,1606,
	1607,5,2,0,0,1607,1635,1,0,0,0,1608,1609,5,49,0,0,1609,1612,3,132,66,0,
	1610,1611,5,5,0,0,1611,1613,3,132,66,0,1612,1610,1,0,0,0,1613,1614,1,0,
	0,0,1614,1612,1,0,0,0,1614,1615,1,0,0,0,1615,1616,1,0,0,0,1616,1617,5,50,
	0,0,1617,1629,5,40,0,0,1618,1619,5,49,0,0,1619,1622,3,240,120,0,1620,1621,
	5,5,0,0,1621,1623,3,240,120,0,1622,1620,1,0,0,0,1623,1624,1,0,0,0,1624,
	1622,1,0,0,0,1624,1625,1,0,0,0,1625,1626,1,0,0,0,1626,1627,5,50,0,0,1627,
	1630,1,0,0,0,1628,1630,3,240,120,0,1629,1618,1,0,0,0,1629,1628,1,0,0,0,
	1630,1631,1,0,0,0,1631,1632,5,2,0,0,1632,1635,1,0,0,0,1633,1635,5,2,0,0,
	1634,1589,1,0,0,0,1634,1603,1,0,0,0,1634,1608,1,0,0,0,1634,1633,1,0,0,0,
	1635,155,1,0,0,0,1636,1638,3,240,120,0,1637,1636,1,0,0,0,1637,1638,1,0,
	0,0,1638,1639,1,0,0,0,1639,1640,5,2,0,0,1640,157,1,0,0,0,1641,1642,5,180,
	0,0,1642,1643,7,9,0,0,1643,1672,3,240,120,0,1644,1645,5,180,0,0,1645,1672,
	7,10,0,0,1646,1647,7,10,0,0,1647,1672,5,180,0,0,1648,1649,5,49,0,0,1649,
	1652,3,132,66,0,1650,1651,5,5,0,0,1651,1653,3,132,66,0,1652,1650,1,0,0,
	0,1653,1654,1,0,0,0,1654,1652,1,0,0,0,1654,1655,1,0,0,0,1655,1656,1,0,0,
	0,1656,1657,5,50,0,0,1657,1669,5,40,0,0,1658,1659,5,49,0,0,1659,1662,3,
	240,120,0,1660,1661,5,5,0,0,1661,1663,3,240,120,0,1662,1660,1,0,0,0,1663,
	1664,1,0,0,0,1664,1662,1,0,0,0,1664,1665,1,0,0,0,1665,1666,1,0,0,0,1666,
	1667,5,50,0,0,1667,1670,1,0,0,0,1668,1670,3,240,120,0,1669,1658,1,0,0,0,
	1669,1668,1,0,0,0,1670,1672,1,0,0,0,1671,1641,1,0,0,0,1671,1644,1,0,0,0,
	1671,1646,1,0,0,0,1671,1648,1,0,0,0,1672,159,1,0,0,0,1673,1674,5,95,0,0,
	1674,1675,3,110,55,0,1675,1676,5,96,0,0,1676,1677,5,49,0,0,1677,1678,3,
	240,120,0,1678,1679,5,50,0,0,1679,1680,5,2,0,0,1680,161,1,0,0,0,1681,1682,
	5,96,0,0,1682,1683,5,49,0,0,1683,1684,3,240,120,0,1684,1685,5,50,0,0,1685,
	1686,3,110,55,0,1686,163,1,0,0,0,1687,1688,5,97,0,0,1688,1689,3,224,112,
	0,1689,1690,5,2,0,0,1690,165,1,0,0,0,1691,1693,5,98,0,0,1692,1694,5,151,
	0,0,1693,1692,1,0,0,0,1693,1694,1,0,0,0,1694,1705,1,0,0,0,1695,1696,5,49,
	0,0,1696,1701,5,151,0,0,1697,1698,5,5,0,0,1698,1700,5,151,0,0,1699,1697,
	1,0,0,0,1700,1703,1,0,0,0,1701,1699,1,0,0,0,1701,1702,1,0,0,0,1702,1704,
	1,0,0,0,1703,1701,1,0,0,0,1704,1706,5,50,0,0,1705,1695,1,0,0,0,1705,1706,
	1,0,0,0,1706,1707,1,0,0,0,1707,1708,3,168,84,0,1708,167,1,0,0,0,1709,1713,
	5,4,0,0,1710,1712,3,170,85,0,1711,1710,1,0,0,0,1712,1715,1,0,0,0,1713,1711,
	1,0,0,0,1713,1714,1,0,0,0,1714,1716,1,0,0,0,1715,1713,1,0,0,0,1716,1717,
	5,6,0,0,1717,169,1,0,0,0,1718,1732,3,168,84,0,1719,1732,3,172,86,0,1720,
	1732,3,174,87,0,1721,1732,3,176,88,0,1722,1732,3,178,89,0,1723,1732,3,184,
	92,0,1724,1732,3,186,93,0,1725,1732,5,99,0,0,1726,1732,5,100,0,0,1727,1732,
	5,101,0,0,1728,1732,3,190,95,0,1729,1732,3,194,97,0,1730,1732,3,196,98,
	0,1731,1718,1,0,0,0,1731,1719,1,0,0,0,1731,1720,1,0,0,0,1731,1721,1,0,0,
	0,1731,1722,1,0,0,0,1731,1723,1,0,0,0,1731,1724,1,0,0,0,1731,1725,1,0,0,
	0,1731,1726,1,0,0,0,1731,1727,1,0,0,0,1731,1728,1,0,0,0,1731,1729,1,0,0,
	0,1731,1730,1,0,0,0,1732,171,1,0,0,0,1733,1734,5,102,0,0,1734,1739,3,14,
	7,0,1735,1736,5,5,0,0,1736,1738,3,14,7,0,1737,1735,1,0,0,0,1738,1741,1,
	0,0,0,1739,1737,1,0,0,0,1739,1740,1,0,0,0,1740,1744,1,0,0,0,1741,1739,1,
	0,0,0,1742,1743,5,103,0,0,1743,1745,3,188,94,0,1744,1742,1,0,0,0,1744,1745,
	1,0,0,0,1745,173,1,0,0,0,1746,1751,3,194,97,0,1747,1748,5,5,0,0,1748,1750,
	3,194,97,0,1749,1747,1,0,0,0,1750,1753,1,0,0,0,1751,1749,1,0,0,0,1751,1752,
	1,0,0,0,1752,1754,1,0,0,0,1753,1751,1,0,0,0,1754,1755,5,103,0,0,1755,1756,
	3,188,94,0,1756,175,1,0,0,0,1757,1758,5,91,0,0,1758,1759,3,188,94,0,1759,
	1760,3,168,84,0,1760,177,1,0,0,0,1761,1762,5,104,0,0,1762,1772,3,188,94,
	0,1763,1765,3,180,90,0,1764,1763,1,0,0,0,1765,1766,1,0,0,0,1766,1764,1,
	0,0,0,1766,1767,1,0,0,0,1767,1769,1,0,0,0,1768,1770,3,182,91,0,1769,1768,
	1,0,0,0,1769,1770,1,0,0,0,1770,1773,1,0,0,0,1771,1773,3,182,91,0,1772,1764,
	1,0,0,0,1772,1771,1,0,0,0,1773,179,1,0,0,0,1774,1775,5,105,0,0,1775,1776,
	3,196,98,0,1776,1777,3,168,84,0,1777,181,1,0,0,0,1778,1779,5,106,0,0,1779,
	1780,3,168,84,0,1780,183,1,0,0,0,1781,1782,5,9,0,0,1782,1783,3,168,84,0,
	1783,1784,3,188,94,0,1784,1785,3,168,84,0,1785,1786,3,168,84,0,1786,185,
	1,0,0,0,1787,1788,5,7,0,0,1788,1789,5,180,0,0,1789,1798,5,49,0,0,1790,1795,
	5,180,0,0,1791,1792,5,5,0,0,1792,1794,5,180,0,0,1793,1791,1,0,0,0,1794,
	1797,1,0,0,0,1795,1793,1,0,0,0,1795,1796,1,0,0,0,1796,1799,1,0,0,0,1797,
	1795,1,0,0,0,1798,1790,1,0,0,0,1798,1799,1,0,0,0,1799,1800,1,0,0,0,1800,
	1810,5,50,0,0,1801,1802,5,107,0,0,1802,1807,5,180,0,0,1803,1804,5,5,0,0,
	1804,1806,5,180,0,0,1805,1803,1,0,0,0,1806,1809,1,0,0,0,1807,1805,1,0,0,
	0,1807,1808,1,0,0,0,1808,1811,1,0,0,0,1809,1807,1,0,0,0,1810,1801,1,0,0,
	0,1810,1811,1,0,0,0,1811,1812,1,0,0,0,1812,1813,3,168,84,0,1813,187,1,0,
	0,0,1814,1818,3,190,95,0,1815,1818,3,194,97,0,1816,1818,3,196,98,0,1817,
	1814,1,0,0,0,1817,1815,1,0,0,0,1817,1816,1,0,0,0,1818,189,1,0,0,0,1819,
	1820,3,192,96,0,1820,1829,5,49,0,0,1821,1826,3,188,94,0,1822,1823,5,5,0,
	0,1823,1825,3,188,94,0,1824,1822,1,0,0,0,1825,1828,1,0,0,0,1826,1824,1,
	0,0,0,1826,1827,1,0,0,0,1827,1830,1,0,0,0,1828,1826,1,0,0,0,1829,1821,1,
	0,0,0,1829,1830,1,0,0,0,1830,1831,1,0,0,0,1831,1832,5,50,0,0,1832,191,1,
	0,0,0,1833,1834,7,11,0,0,1834,193,1,0,0,0,1835,1841,3,14,7,0,1836,1837,
	5,12,0,0,1837,1840,3,14,7,0,1838,1840,5,164,0,0,1839,1836,1,0,0,0,1839,
	1838,1,0,0,0,1840,1843,1,0,0,0,1841,1839,1,0,0,0,1841,1842,1,0,0,0,1842,
	195,1,0,0,0,1843,1841,1,0,0,0,1844,1845,7,12,0,0,1845,197,1,0,0,0,1846,
	1847,5,109,0,0,1847,1851,5,4,0,0,1848,1850,3,114,57,0,1849,1848,1,0,0,0,
	1850,1853,1,0,0,0,1851,1849,1,0,0,0,1851,1852,1,0,0,0,1852,1854,1,0,0,0,
	1853,1851,1,0,0,0,1854,1855,5,6,0,0,1855,199,1,0,0,0,1856,1857,5,104,0,
	0,1857,1858,5,49,0,0,1858,1859,3,240,120,0,1859,1860,5,50,0,0,1860,1864,
	5,4,0,0,1861,1863,3,202,101,0,1862,1861,1,0,0,0,1863,1866,1,0,0,0,1864,
	1862,1,0,0,0,1864,1865,1,0,0,0,1865,1868,1,0,0,0,1866,1864,1,0,0,0,1867,
	1869,3,204,102,0,1868,1867,1,0,0,0,1868,1869,1,0,0,0,1869,1870,1,0,0,0,
	1870,1871,5,6,0,0,1871,201,1,0,0,0,1872,1873,5,105,0,0,1873,1874,3,240,
	120,0,1874,1878,5,110,0,0,1875,1877,3,114,57,0,1876,1875,1,0,0,0,1877,1880,
	1,0,0,0,1878,1876,1,0,0,0,1878,1879,1,0,0,0,1879,203,1,0,0,0,1880,1878,
	1,0,0,0,1881,1882,5,106,0,0,1882,1886,5,110,0,0,1883,1885,3,114,57,0,1884,
	1883,1,0,0,0,1885,1888,1,0,0,0,1886,1884,1,0,0,0,1886,1887,1,0,0,0,1887,
	205,1,0,0,0,1888,1886,1,0,0,0,1889,1890,5,111,0,0,1890,1892,3,240,120,0,
	1891,1893,3,208,104,0,1892,1891,1,0,0,0,1892,1893,1,0,0,0,1893,1894,1,0,
	0,0,1894,1896,3,110,55,0,1895,1897,3,210,105,0,1896,1895,1,0,0,0,1897,1898,
	1,0,0,0,1898,1896,1,0,0,0,1898,1899,1,0,0,0,1899,207,1,0,0,0,1900,1901,
	5,73,0,0,1901,1913,5,49,0,0,1902,1907,3,108,54,0,1903,1904,5,5,0,0,1904,
	1906,3,108,54,0,1905,1903,1,0,0,0,1906,1909,1,0,0,0,1907,1905,1,0,0,0,1907,
	1908,1,0,0,0,1908,1911,1,0,0,0,1909,1907,1,0,0,0,1910,1912,5,5,0,0,1911,
	1910,1,0,0,0,1911,1912,1,0,0,0,1912,1914,1,0,0,0,1913,1902,1,0,0,0,1913,
	1914,1,0,0,0,1914,1915,1,0,0,0,1915,1916,5,50,0,0,1916,209,1,0,0,0,1917,
	1919,5,112,0,0,1918,1920,5,180,0,0,1919,1918,1,0,0,0,1919,1920,1,0,0,0,
	1920,1936,1,0,0,0,1921,1933,5,49,0,0,1922,1927,3,108,54,0,1923,1924,5,5,
	0,0,1924,1926,3,108,54,0,1925,1923,1,0,0,0,1926,1929,1,0,0,0,1927,1925,
	1,0,0,0,1927,1928,1,0,0,0,1928,1931,1,0,0,0,1929,1927,1,0,0,0,1930,1932,
	5,5,0,0,1931,1930,1,0,0,0,1931,1932,1,0,0,0,1932,1934,1,0,0,0,1933,1922,
	1,0,0,0,1933,1934,1,0,0,0,1934,1935,1,0,0,0,1935,1937,5,50,0,0,1936,1921,
	1,0,0,0,1936,1937,1,0,0,0,1937,1938,1,0,0,0,1938,1939,3,110,55,0,1939,211,
	1,0,0,0,1940,1941,5,99,0,0,1941,1942,5,2,0,0,1942,213,1,0,0,0,1943,1944,
	5,100,0,0,1944,1945,5,2,0,0,1945,215,1,0,0,0,1946,1950,5,151,0,0,1947,1948,
	5,180,0,0,1948,1950,3,230,115,0,1949,1946,1,0,0,0,1949,1947,1,0,0,0,1950,
	217,1,0,0,0,1951,1952,5,36,0,0,1952,1955,5,180,0,0,1953,1954,5,12,0,0,1954,
	1956,5,180,0,0,1955,1953,1,0,0,0,1955,1956,1,0,0,0,1956,1957,1,0,0,0,1957,
	1958,5,49,0,0,1958,1970,5,4,0,0,1959,1964,3,228,114,0,1960,1961,5,5,0,0,
	1961,1963,3,228,114,0,1962,1960,1,0,0,0,1963,1966,1,0,0,0,1964,1962,1,0,
	0,0,1964,1965,1,0,0,0,1965,1968,1,0,0,0,1966,1964,1,0,0,0,1967,1969,5,5,
	0,0,1968,1967,1,0,0,0,1968,1969,1,0,0,0,1969,1971,1,0,0,0,1970,1959,1,0,
	0,0,1970,1971,1,0,0,0,1971,1972,1,0,0,0,1972,1973,5,6,0,0,1973,1974,5,50,
	0,0,1974,1994,5,2,0,0,1975,1976,5,36,0,0,1976,1979,5,180,0,0,1977,1978,
	5,12,0,0,1978,1980,5,180,0,0,1979,1977,1,0,0,0,1979,1980,1,0,0,0,1980,1981,
	1,0,0,0,1981,1982,3,230,115,0,1982,1983,5,2,0,0,1983,1994,1,0,0,0,1984,
	1985,5,36,0,0,1985,1986,5,49,0,0,1986,1987,5,151,0,0,1987,1988,5,50,0,0,
	1988,1994,5,2,0,0,1989,1990,5,36,0,0,1990,1991,5,49,0,0,1991,1992,5,50,
	0,0,1992,1994,5,2,0,0,1993,1951,1,0,0,0,1993,1975,1,0,0,0,1993,1984,1,0,
	0,0,1993,1989,1,0,0,0,1994,219,1,0,0,0,1995,1996,5,113,0,0,1996,1997,5,
	49,0,0,1997,1998,3,240,120,0,1998,1999,5,50,0,0,1999,2000,5,2,0,0,2000,
	221,1,0,0,0,2001,2004,5,180,0,0,2002,2004,3,248,124,0,2003,2001,1,0,0,0,
	2003,2002,1,0,0,0,2004,223,1,0,0,0,2005,2017,5,49,0,0,2006,2011,3,222,111,
	0,2007,2008,5,5,0,0,2008,2010,3,222,111,0,2009,2007,1,0,0,0,2010,2013,1,
	0,0,0,2011,2009,1,0,0,0,2011,2012,1,0,0,0,2012,2015,1,0,0,0,2013,2011,1,
	0,0,0,2014,2016,5,5,0,0,2015,2014,1,0,0,0,2015,2016,1,0,0,0,2016,2018,1,
	0,0,0,2017,2006,1,0,0,0,2017,2018,1,0,0,0,2018,2019,1,0,0,0,2019,2020,5,
	50,0,0,2020,225,1,0,0,0,2021,2022,5,180,0,0,2022,2046,3,230,115,0,2023,
	2024,5,180,0,0,2024,2025,5,12,0,0,2025,2026,5,180,0,0,2026,2046,3,230,115,
	0,2027,2028,5,180,0,0,2028,2029,5,49,0,0,2029,2041,5,4,0,0,2030,2035,3,
	228,114,0,2031,2032,5,5,0,0,2032,2034,3,228,114,0,2033,2031,1,0,0,0,2034,
	2037,1,0,0,0,2035,2033,1,0,0,0,2035,2036,1,0,0,0,2036,2039,1,0,0,0,2037,
	2035,1,0,0,0,2038,2040,5,5,0,0,2039,2038,1,0,0,0,2039,2040,1,0,0,0,2040,
	2042,1,0,0,0,2041,2030,1,0,0,0,2041,2042,1,0,0,0,2042,2043,1,0,0,0,2043,
	2044,5,6,0,0,2044,2046,5,50,0,0,2045,2021,1,0,0,0,2045,2023,1,0,0,0,2045,
	2027,1,0,0,0,2046,227,1,0,0,0,2047,2048,5,180,0,0,2048,2049,5,110,0,0,2049,
	2050,3,240,120,0,2050,229,1,0,0,0,2051,2063,5,49,0,0,2052,2057,3,240,120,
	0,2053,2054,5,5,0,0,2054,2056,3,240,120,0,2055,2053,1,0,0,0,2056,2059,1,
	0,0,0,2057,2055,1,0,0,0,2057,2058,1,0,0,0,2058,2061,1,0,0,0,2059,2057,1,
	0,0,0,2060,2062,5,5,0,0,2061,2060,1,0,0,0,2061,2062,1,0,0,0,2062,2064,1,
	0,0,0,2063,2052,1,0,0,0,2063,2064,1,0,0,0,2064,2065,1,0,0,0,2065,2066,5,
	50,0,0,2066,231,1,0,0,0,2067,2068,5,4,0,0,2068,2073,3,234,117,0,2069,2070,
	5,5,0,0,2070,2072,3,234,117,0,2071,2069,1,0,0,0,2072,2075,1,0,0,0,2073,
	2071,1,0,0,0,2073,2074,1,0,0,0,2074,2077,1,0,0,0,2075,2073,1,0,0,0,2076,
	2078,5,5,0,0,2077,2076,1,0,0,0,2077,2078,1,0,0,0,2078,2079,1,0,0,0,2079,
	2080,5,6,0,0,2080,233,1,0,0,0,2081,2082,5,180,0,0,2082,2083,5,110,0,0,2083,
	2084,3,240,120,0,2084,235,1,0,0,0,2085,2086,5,49,0,0,2086,2091,3,238,119,
	0,2087,2088,5,5,0,0,2088,2090,3,238,119,0,2089,2087,1,0,0,0,2090,2093,1,
	0,0,0,2091,2089,1,0,0,0,2091,2092,1,0,0,0,2092,2095,1,0,0,0,2093,2091,1,
	0,0,0,2094,2096,5,5,0,0,2095,2094,1,0,0,0,2095,2096,1,0,0,0,2096,2097,1,
	0,0,0,2097,2098,5,50,0,0,2098,237,1,0,0,0,2099,2102,3,254,127,0,2100,2102,
	3,84,42,0,2101,2099,1,0,0,0,2101,2100,1,0,0,0,2102,239,1,0,0,0,2103,2104,
	6,120,-1,0,2104,2105,5,49,0,0,2105,2106,5,180,0,0,2106,2107,7,9,0,0,2107,
	2108,3,240,120,0,2108,2109,5,50,0,0,2109,2274,1,0,0,0,2110,2111,5,49,0,
	0,2111,2112,5,114,0,0,2112,2113,5,180,0,0,2113,2114,5,50,0,0,2114,2115,
	3,232,116,0,2115,2116,3,230,115,0,2116,2274,1,0,0,0,2117,2118,5,49,0,0,
	2118,2119,3,240,120,0,2119,2120,5,50,0,0,2120,2274,1,0,0,0,2121,2122,5,
	49,0,0,2122,2125,3,240,120,0,2123,2124,5,5,0,0,2124,2126,3,240,120,0,2125,
	2123,1,0,0,0,2126,2127,1,0,0,0,2127,2125,1,0,0,0,2127,2128,1,0,0,0,2128,
	2129,1,0,0,0,2129,2130,5,50,0,0,2130,2274,1,0,0,0,2131,2132,3,256,128,0,
	2132,2133,5,49,0,0,2133,2135,3,240,120,0,2134,2136,5,5,0,0,2135,2134,1,
	0,0,0,2135,2136,1,0,0,0,2136,2137,1,0,0,0,2137,2138,5,50,0,0,2138,2274,
	1,0,0,0,2139,2274,3,226,113,0,2140,2141,5,114,0,0,2141,2143,5,180,0,0,2142,
	2144,3,232,116,0,2143,2142,1,0,0,0,2143,2144,1,0,0,0,2144,2145,1,0,0,0,
	2145,2274,3,230,115,0,2146,2147,5,114,0,0,2147,2150,3,254,127,0,2148,2149,
	5,66,0,0,2149,2151,5,67,0,0,2150,2148,1,0,0,0,2151,2152,1,0,0,0,2152,2150,
	1,0,0,0,2152,2153,1,0,0,0,2153,2154,1,0,0,0,2154,2155,5,49,0,0,2155,2156,
	3,240,120,0,2156,2157,5,50,0,0,2157,2274,1,0,0,0,2158,2159,5,114,0,0,2159,
	2160,5,148,0,0,2160,2161,5,49,0,0,2161,2162,3,240,120,0,2162,2163,5,50,
	0,0,2163,2274,1,0,0,0,2164,2165,5,114,0,0,2165,2166,5,146,0,0,2166,2167,
	5,49,0,0,2167,2168,3,240,120,0,2168,2169,5,50,0,0,2169,2274,1,0,0,0,2170,
	2171,5,55,0,0,2171,2172,5,49,0,0,2172,2173,3,254,127,0,2173,2174,5,50,0,
	0,2174,2175,5,12,0,0,2175,2176,5,180,0,0,2176,2274,1,0,0,0,2177,2178,5,
	115,0,0,2178,2274,3,230,115,0,2179,2180,5,116,0,0,2180,2274,3,230,115,0,
	2181,2182,5,117,0,0,2182,2274,3,230,115,0,2183,2184,5,118,0,0,2184,2274,
	3,230,115,0,2185,2186,5,119,0,0,2186,2187,5,49,0,0,2187,2188,7,13,0,0,2188,
	2189,5,12,0,0,2189,2190,5,180,0,0,2190,2191,5,5,0,0,2191,2192,3,230,115,
	0,2192,2193,5,50,0,0,2193,2274,1,0,0,0,2194,2195,5,120,0,0,2195,2274,3,
	230,115,0,2196,2197,5,121,0,0,2197,2274,3,230,115,0,2198,2199,5,122,0,0,
	2199,2200,5,49,0,0,2200,2201,3,240,120,0,2201,2202,5,5,0,0,2202,2203,3,
	236,118,0,2203,2204,5,50,0,0,2204,2274,1,0,0,0,2205,2206,5,123,0,0,2206,
	2207,5,49,0,0,2207,2208,3,240,120,0,2208,2209,5,5,0,0,2209,2210,3,236,118,
	0,2210,2211,5,5,0,0,2211,2212,5,145,0,0,2212,2213,5,50,0,0,2213,2274,1,
	0,0,0,2214,2215,5,124,0,0,2215,2216,5,66,0,0,2216,2217,3,240,120,0,2217,
	2218,5,67,0,0,2218,2219,7,14,0,0,2219,2274,1,0,0,0,2220,2221,5,125,0,0,
	2221,2222,5,66,0,0,2222,2223,3,240,120,0,2223,2224,5,67,0,0,2224,2225,7,
	15,0,0,2225,2274,1,0,0,0,2226,2227,7,10,0,0,2227,2274,3,240,120,22,2228,
	2229,7,16,0,0,2229,2274,3,240,120,21,2230,2242,5,66,0,0,2231,2236,3,240,
	120,0,2232,2233,5,5,0,0,2233,2235,3,240,120,0,2234,2232,1,0,0,0,2235,2238,
	1,0,0,0,2236,2234,1,0,0,0,2236,2237,1,0,0,0,2237,2240,1,0,0,0,2238,2236,
	1,0,0,0,2239,2241,5,5,0,0,2240,2239,1,0,0,0,2240,2241,1,0,0,0,2241,2243,
	1,0,0,0,2242,2231,1,0,0,0,2242,2243,1,0,0,0,2243,2244,1,0,0,0,2244,2274,
	5,67,0,0,2245,2246,5,89,0,0,2246,2247,5,12,0,0,2247,2248,5,180,0,0,2248,
	2249,5,12,0,0,2249,2250,5,180,0,0,2250,2251,5,66,0,0,2251,2252,3,240,120,
	0,2252,2253,5,67,0,0,2253,2254,3,242,121,0,2254,2274,1,0,0,0,2255,2256,
	5,89,0,0,2256,2257,5,12,0,0,2257,2262,5,180,0,0,2258,2259,5,66,0,0,2259,
	2260,3,240,120,0,2260,2261,5,67,0,0,2261,2263,1,0,0,0,2262,2258,1,0,0,0,
	2263,2264,1,0,0,0,2264,2262,1,0,0,0,2264,2265,1,0,0,0,2265,2274,1,0,0,0,
	2266,2267,5,89,0,0,2267,2268,5,12,0,0,2268,2274,5,180,0,0,2269,2274,5,89,
	0,0,2270,2274,5,160,0,0,2271,2274,3,14,7,0,2272,2274,3,248,124,0,2273,2103,
	1,0,0,0,2273,2110,1,0,0,0,2273,2117,1,0,0,0,2273,2121,1,0,0,0,2273,2131,
	1,0,0,0,2273,2139,1,0,0,0,2273,2140,1,0,0,0,2273,2146,1,0,0,0,2273,2158,
	1,0,0,0,2273,2164,1,0,0,0,2273,2170,1,0,0,0,2273,2177,1,0,0,0,2273,2179,
	1,0,0,0,2273,2181,1,0,0,0,2273,2183,1,0,0,0,2273,2185,1,0,0,0,2273,2194,
	1,0,0,0,2273,2196,1,0,0,0,2273,2198,1,0,0,0,2273,2205,1,0,0,0,2273,2214,
	1,0,0,0,2273,2220,1,0,0,0,2273,2226,1,0,0,0,2273,2228,1,0,0,0,2273,2230,
	1,0,0,0,2273,2245,1,0,0,0,2273,2255,1,0,0,0,2273,2266,1,0,0,0,2273,2269,
	1,0,0,0,2273,2270,1,0,0,0,2273,2271,1,0,0,0,2273,2272,1,0,0,0,2274,2392,
	1,0,0,0,2275,2276,10,20,0,0,2276,2277,5,17,0,0,2277,2391,3,240,120,20,2278,
	2279,10,19,0,0,2279,2280,7,17,0,0,2280,2391,3,240,120,20,2281,2282,10,18,
	0,0,2282,2283,7,18,0,0,2283,2391,3,240,120,19,2284,2285,10,17,0,0,2285,
	2286,7,19,0,0,2286,2391,3,240,120,18,2287,2288,10,16,0,0,2288,2289,5,24,
	0,0,2289,2391,3,240,120,17,2290,2291,10,15,0,0,2291,2292,5,26,0,0,2292,
	2391,3,240,120,16,2293,2294,10,14,0,0,2294,2295,5,25,0,0,2295,2391,3,240,
	120,15,2296,2297,10,13,0,0,2297,2298,7,20,0,0,2298,2391,3,240,120,14,2299,
	2300,10,12,0,0,2300,2301,7,21,0,0,2301,2391,3,240,120,13,2302,2303,10,11,
	0,0,2303,2304,5,130,0,0,2304,2391,3,240,120,12,2305,2306,10,10,0,0,2306,
	2307,5,131,0,0,2307,2391,3,240,120,11,2308,2309,10,34,0,0,2309,2311,5,66,
	0,0,2310,2312,3,240,120,0,2311,2310,1,0,0,0,2311,2312,1,0,0,0,2312,2313,
	1,0,0,0,2313,2315,5,110,0,0,2314,2316,3,240,120,0,2315,2314,1,0,0,0,2315,
	2316,1,0,0,0,2316,2317,1,0,0,0,2317,2391,5,67,0,0,2318,2319,10,33,0,0,2319,
	2320,5,66,0,0,2320,2321,5,145,0,0,2321,2391,5,67,0,0,2322,2323,10,32,0,
	0,2323,2324,5,66,0,0,2324,2325,3,240,120,0,2325,2326,5,67,0,0,2326,2391,
	1,0,0,0,2327,2328,10,29,0,0,2328,2391,7,22,0,0,2329,2330,10,28,0,0,2330,
	2331,5,167,0,0,2331,2332,5,49,0,0,2332,2333,3,240,120,0,2333,2334,5,50,
	0,0,2334,2391,1,0,0,0,2335,2336,10,27,0,0,2336,2337,5,168,0,0,2337,2338,
	5,49,0,0,2338,2339,3,240,120,0,2339,2340,5,5,0,0,2340,2341,3,240,120,0,
	2341,2342,5,50,0,0,2342,2391,1,0,0,0,2343,2344,10,26,0,0,2344,2345,5,12,
	0,0,2345,2347,5,180,0,0,2346,2348,3,232,116,0,2347,2346,1,0,0,0,2347,2348,
	1,0,0,0,2348,2349,1,0,0,0,2349,2350,5,49,0,0,2350,2362,5,4,0,0,2351,2356,
	3,228,114,0,2352,2353,5,5,0,0,2353,2355,3,228,114,0,2354,2352,1,0,0,0,2355,
	2358,1,0,0,0,2356,2354,1,0,0,0,2356,2357,1,0,0,0,2357,2360,1,0,0,0,2358,
	2356,1,0,0,0,2359,2361,5,5,0,0,2360,2359,1,0,0,0,2360,2361,1,0,0,0,2361,
	2363,1,0,0,0,2362,2351,1,0,0,0,2362,2363,1,0,0,0,2363,2364,1,0,0,0,2364,
	2365,5,6,0,0,2365,2391,5,50,0,0,2366,2367,10,25,0,0,2367,2368,5,12,0,0,
	2368,2370,5,180,0,0,2369,2371,3,232,116,0,2370,2369,1,0,0,0,2370,2371,1,
	0,0,0,2371,2372,1,0,0,0,2372,2391,3,230,115,0,2373,2374,10,24,0,0,2374,
	2391,3,242,121,0,2375,2376,10,23,0,0,2376,2391,7,10,0,0,2377,2378,10,9,
	0,0,2378,2379,5,132,0,0,2379,2382,3,240,120,0,2380,2381,7,9,0,0,2381,2383,
	3,118,59,0,2382,2380,1,0,0,0,2382,2383,1,0,0,0,2383,2384,1,0,0,0,2384,2385,
	5,110,0,0,2385,2388,3,240,120,0,2386,2387,7,9,0,0,2387,2389,3,118,59,0,
	2388,2386,1,0,0,0,2388,2389,1,0,0,0,2389,2391,1,0,0,0,2390,2275,1,0,0,0,
	2390,2278,1,0,0,0,2390,2281,1,0,0,0,2390,2284,1,0,0,0,2390,2287,1,0,0,0,
	2390,2290,1,0,0,0,2390,2293,1,0,0,0,2390,2296,1,0,0,0,2390,2299,1,0,0,0,
	2390,2302,1,0,0,0,2390,2305,1,0,0,0,2390,2308,1,0,0,0,2390,2318,1,0,0,0,
	2390,2322,1,0,0,0,2390,2327,1,0,0,0,2390,2329,1,0,0,0,2390,2335,1,0,0,0,
	2390,2343,1,0,0,0,2390,2366,1,0,0,0,2390,2373,1,0,0,0,2390,2375,1,0,0,0,
	2390,2377,1,0,0,0,2391,2394,1,0,0,0,2392,2390,1,0,0,0,2392,2393,1,0,0,0,
	2393,241,1,0,0,0,2394,2392,1,0,0,0,2395,2396,5,12,0,0,2396,2411,5,180,0,
	0,2397,2398,5,12,0,0,2398,2411,5,108,0,0,2399,2411,5,163,0,0,2400,2411,
	5,172,0,0,2401,2411,5,173,0,0,2402,2411,5,174,0,0,2403,2411,5,175,0,0,2404,
	2411,5,176,0,0,2405,2411,5,177,0,0,2406,2411,5,178,0,0,2407,2411,5,179,
	0,0,2408,2411,5,170,0,0,2409,2411,5,171,0,0,2410,2395,1,0,0,0,2410,2397,
	1,0,0,0,2410,2399,1,0,0,0,2410,2400,1,0,0,0,2410,2401,1,0,0,0,2410,2402,
	1,0,0,0,2410,2403,1,0,0,0,2410,2404,1,0,0,0,2410,2405,1,0,0,0,2410,2406,
	1,0,0,0,2410,2407,1,0,0,0,2410,2408,1,0,0,0,2410,2409,1,0,0,0,2411,243,
	1,0,0,0,2412,2413,7,23,0,0,2413,245,1,0,0,0,2414,2415,7,24,0,0,2415,247,
	1,0,0,0,2416,2431,5,141,0,0,2417,2431,3,250,125,0,2418,2431,3,252,126,0,
	2419,2423,5,151,0,0,2420,2422,5,151,0,0,2421,2420,1,0,0,0,2422,2425,1,0,
	0,0,2423,2421,1,0,0,0,2423,2424,1,0,0,0,2424,2431,1,0,0,0,2425,2423,1,0,
	0,0,2426,2431,5,161,0,0,2427,2431,5,162,0,0,2428,2431,5,152,0,0,2429,2431,
	5,153,0,0,2430,2416,1,0,0,0,2430,2417,1,0,0,0,2430,2418,1,0,0,0,2430,2419,
	1,0,0,0,2430,2426,1,0,0,0,2430,2427,1,0,0,0,2430,2428,1,0,0,0,2430,2429,
	1,0,0,0,2431,249,1,0,0,0,2432,2434,5,145,0,0,2433,2435,7,25,0,0,2434,2433,
	1,0,0,0,2434,2435,1,0,0,0,2435,251,1,0,0,0,2436,2438,5,144,0,0,2437,2439,
	7,25,0,0,2438,2437,1,0,0,0,2438,2439,1,0,0,0,2439,253,1,0,0,0,2440,2441,
	5,108,0,0,2441,2503,5,59,0,0,2442,2503,5,108,0,0,2443,2503,5,146,0,0,2444,
	2503,5,147,0,0,2445,2503,5,149,0,0,2446,2503,5,148,0,0,2447,2503,5,156,
	0,0,2448,2503,5,157,0,0,2449,2503,5,138,0,0,2450,2503,5,139,0,0,2451,2503,
	5,158,0,0,2452,2503,5,159,0,0,2453,2454,5,7,0,0,2454,2469,5,49,0,0,2455,
	2457,3,254,127,0,2456,2458,3,246,123,0,2457,2456,1,0,0,0,2457,2458,1,0,
	0,0,2458,2466,1,0,0,0,2459,2460,5,5,0,0,2460,2462,3,254,127,0,2461,2463,
	3,246,123,0,2462,2461,1,0,0,0,2462,2463,1,0,0,0,2463,2465,1,0,0,0,2464,
	2459,1,0,0,0,2465,2468,1,0,0,0,2466,2464,1,0,0,0,2466,2467,1,0,0,0,2467,
	2470,1,0,0,0,2468,2466,1,0,0,0,2469,2455,1,0,0,0,2469,2470,1,0,0,0,2470,
	2471,1,0,0,0,2471,2475,5,50,0,0,2472,2474,7,26,0,0,2473,2472,1,0,0,0,2474,
	2477,1,0,0,0,2475,2473,1,0,0,0,2475,2476,1,0,0,0,2476,2496,1,0,0,0,2477,
	2475,1,0,0,0,2478,2479,5,73,0,0,2479,2480,5,49,0,0,2480,2482,3,254,127,
	0,2481,2483,3,246,123,0,2482,2481,1,0,0,0,2482,2483,1,0,0,0,2483,2491,1,
	0,0,0,2484,2485,5,5,0,0,2485,2487,3,254,127,0,2486,2488,3,246,123,0,2487,
	2486,1,0,0,0,2487,2488,1,0,0,0,2488,2490,1,0,0,0,2489,2484,1,0,0,0,2490,
	2493,1,0,0,0,2491,2489,1,0,0,0,2491,2492,1,0,0,0,2492,2494,1,0,0,0,2493,
	2491,1,0,0,0,2494,2495,5,50,0,0,2495,2497,1,0,0,0,2496,2478,1,0,0,0,2496,
	2497,1,0,0,0,2497,2503,1,0,0,0,2498,2499,5,180,0,0,2499,2500,5,12,0,0,2500,
	2503,5,180,0,0,2501,2503,5,180,0,0,2502,2440,1,0,0,0,2502,2442,1,0,0,0,
	2502,2443,1,0,0,0,2502,2444,1,0,0,0,2502,2445,1,0,0,0,2502,2446,1,0,0,0,
	2502,2447,1,0,0,0,2502,2448,1,0,0,0,2502,2449,1,0,0,0,2502,2450,1,0,0,0,
	2502,2451,1,0,0,0,2502,2452,1,0,0,0,2502,2453,1,0,0,0,2502,2498,1,0,0,0,
	2502,2501,1,0,0,0,2503,255,1,0,0,0,2504,2505,7,27,0,0,2505,257,1,0,0,0,
	292,261,267,281,283,303,307,314,319,327,331,337,349,352,362,366,374,377,
	381,386,390,406,410,417,420,423,437,440,451,453,468,483,487,503,505,511,
	516,524,527,544,546,553,560,562,566,578,582,584,588,594,597,600,610,614,
	616,623,627,629,637,644,657,661,668,688,694,700,706,713,723,730,736,740,
	746,754,762,769,776,783,788,796,803,810,817,822,824,828,834,839,841,847,
	854,856,862,864,870,875,881,888,894,900,904,909,917,922,930,940,945,949,
	955,962,967,973,977,979,986,991,995,1005,1007,1011,1017,1024,1040,1049,
	1053,1059,1068,1072,1080,1084,1090,1094,1100,1104,1106,1114,1118,1120,1128,
	1132,1138,1142,1148,1152,1154,1160,1165,1171,1199,1212,1223,1230,1250,1262,
	1266,1271,1283,1292,1296,1298,1307,1312,1318,1329,1331,1339,1345,1353,1359,
	1363,1373,1385,1395,1406,1413,1419,1428,1435,1457,1469,1479,1487,1497,1500,
	1509,1519,1531,1539,1584,1593,1599,1614,1624,1629,1634,1637,1654,1664,1669,
	1671,1693,1701,1705,1713,1731,1739,1744,1751,1766,1769,1772,1795,1798,1807,
	1810,1817,1826,1829,1839,1841,1851,1864,1868,1878,1886,1892,1898,1907,1911,
	1913,1919,1927,1931,1933,1936,1949,1955,1964,1968,1970,1979,1993,2003,2011,
	2015,2017,2035,2039,2041,2045,2057,2061,2063,2073,2077,2091,2095,2101,2127,
	2135,2143,2152,2236,2240,2242,2264,2273,2311,2315,2347,2356,2360,2362,2370,
	2382,2388,2390,2392,2410,2423,2430,2434,2438,2457,2462,2466,2469,2475,2482,
	2487,2491,2496,2502];

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
	public assignChain(): AssignChainContext {
		return this.getTypedRuleContext(AssignChainContext, 0) as AssignChainContext;
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


export class AssignChainContext extends ParserRuleContext {
	public _op!: Token;
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public assignChain(): AssignChainContext {
		return this.getTypedRuleContext(AssignChainContext, 0) as AssignChainContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_assignChain;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitAssignChain) {
			return visitor.visitAssignChain(this);
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
	public _rop!: Token;
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
	public assignChain(): AssignChainContext {
		return this.getTypedRuleContext(AssignChainContext, 0) as AssignChainContext;
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
	public _iop!: Token;
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
	public assignChain(): AssignChainContext {
		return this.getTypedRuleContext(AssignChainContext, 0) as AssignChainContext;
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
	public _tOp!: Token;
	public _tVal!: AssignChainContext;
	public _ifFalse!: ExpressionContext;
	public _fOp!: Token;
	public _fVal!: AssignChainContext;
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
	public assignChain_list(): AssignChainContext[] {
		return this.getTypedRuleContexts(AssignChainContext) as AssignChainContext[];
	}
	public assignChain(i: number): AssignChainContext {
		return this.getTypedRuleContext(AssignChainContext, i) as AssignChainContext;
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


export class DataLocationContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_dataLocation;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitDataLocation) {
			return visitor.visitDataLocation(this);
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
	public dataLocation_list(): DataLocationContext[] {
		return this.getTypedRuleContexts(DataLocationContext) as DataLocationContext[];
	}
	public dataLocation(i: number): DataLocationContext {
		return this.getTypedRuleContext(DataLocationContext, i) as DataLocationContext;
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
