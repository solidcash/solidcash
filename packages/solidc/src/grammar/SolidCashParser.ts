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
                                                            "'delegate'", 
                                                            "'upgrade'", 
                                                            "'selfdestruct'", 
                                                            "'unsafe'", 
                                                            "'packed'", 
                                                            "'entries'", 
                                                            "'error'", "'revert'", 
                                                            "'transient'", 
                                                            "'leave'", "'fallback'", 
                                                            "'receive'", 
                                                            "'enumerable'", 
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
                                                            "'virtual'", 
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
                                                            "'let'", "':='", 
                                                            "'switch'", 
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
			while (_la===41) {
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
			while (_la===7 || _la===8 || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 59213825) !== 0) || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
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
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026531840) !== 0) || ((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 235372547) !== 0)) {
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
			if (_la===75) {
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
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
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
			if(!(((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073610753) !== 0) || _la===143 || _la===147 || _la===180)) {
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
				this.match(SolidCashParser.T__40);
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
				this.match(SolidCashParser.T__40);
				this.state = 402;
				this.match(SolidCashParser.Identifier);
				this.state = 406;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===42 || ((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 2081) !== 0) || _la===180) {
					{
					{
					this.state = 403;
					_la = this._input.LA(1);
					if(!(_la===42 || ((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 2081) !== 0) || _la===180)) {
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
			if(!(_la===42 || _la===43)) {
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
			case 44:
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
				} while (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 16777423) !== 0) || _la===140 || _la===144);
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
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 16777423) !== 0)) {
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
			if(!(((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 16777423) !== 0))) {
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
			this.match(SolidCashParser.T__44);
			this.state = 430;
			this.match(SolidCashParser.Identifier);
			this.state = 440;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===46) {
				{
				this.state = 431;
				this.match(SolidCashParser.T__45);
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
			this.state = 454;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 59006977) !== 0)) {
				{
				this.state = 452;
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
					this.usingForDirective();
					}
					break;
				case 7:
					{
					this.state = 449;
					this.interfaceStateVariable();
					}
					break;
				case 8:
					{
					this.state = 450;
					this.interfaceCollection();
					}
					break;
				case 9:
					{
					this.state = 451;
					this.interfaceFunction();
					}
					break;
				}
				}
				this.state = 456;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 457;
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
			this.state = 469;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 29, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 459;
				this.interfaceStateVariableVisibility();
				this.state = 460;
				this.mappingType();
				this.state = 461;
				this.match(SolidCashParser.Identifier);
				this.state = 462;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 464;
				this.interfaceStateVariableVisibility();
				this.state = 465;
				this.arrayType(0);
				this.state = 466;
				this.match(SolidCashParser.Identifier);
				this.state = 467;
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
			this.state = 471;
			this.interfaceStateVariableVisibility();
			this.state = 472;
			this.typeName();
			this.state = 473;
			this.match(SolidCashParser.Identifier);
			this.state = 474;
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
			this.state = 476;
			_la = this._input.LA(1);
			if(!(_la===47 || _la===48)) {
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
			this.state = 478;
			this.match(SolidCashParser.T__6);
			this.state = 479;
			this.match(SolidCashParser.Identifier);
			this.state = 480;
			this.parameterList();
			this.state = 484;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026531840) !== 0) || ((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 235372547) !== 0)) {
				{
				{
				this.state = 481;
				this.functionModifier();
				}
				}
				this.state = 486;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 488;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===75) {
				{
				this.state = 487;
				this.returnType();
				}
			}

			this.state = 490;
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
			this.state = 492;
			this.match(SolidCashParser.T__48);
			this.state = 493;
			this.match(SolidCashParser.Identifier);
			this.state = 494;
			this.match(SolidCashParser.T__3);
			this.state = 506;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 134217731) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 105779585) !== 0) || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 504;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 32, this._ctx) ) {
				case 1:
					{
					this.state = 495;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 496;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 497;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 498;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 499;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 500;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 501;
					this.stateVariableDeclaration();
					}
					break;
				case 8:
					{
					this.state = 502;
					this.usingForDirective();
					}
					break;
				case 9:
					{
					this.state = 503;
					this.freeFunctionDefinition();
					}
					break;
				}
				}
				this.state = 508;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 509;
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
			this.state = 512;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===50) {
				{
				this.state = 511;
				this.match(SolidCashParser.T__49);
				}
			}

			this.state = 514;
			this.match(SolidCashParser.T__50);
			this.state = 515;
			this.anyIdentifier();
			this.state = 517;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===53) {
				{
				this.state = 516;
				this.parameterList();
				}
			}

			this.state = 528;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===46) {
				{
				this.state = 519;
				this.match(SolidCashParser.T__45);
				this.state = 520;
				this.inheritanceSpecifier();
				this.state = 525;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 521;
					this.match(SolidCashParser.T__4);
					this.state = 522;
					this.inheritanceSpecifier();
					}
					}
					this.state = 527;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 530;
			this.match(SolidCashParser.T__3);
			this.state = 547;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 2281701379) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2363237123) !== 0) || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 545;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 38, this._ctx) ) {
				case 1:
					{
					this.state = 531;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 532;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 533;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 534;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 535;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 536;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 537;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 538;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 539;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 540;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 541;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 542;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 543;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 544;
					this.receiveDefinition();
					}
					break;
				}
				}
				this.state = 549;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 550;
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
			this.state = 552;
			this.match(SolidCashParser.Identifier);
			this.state = 554;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===53) {
				{
				this.state = 553;
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
			this.state = 556;
			this.match(SolidCashParser.T__6);
			this.state = 557;
			this.anyIdentifier();
			this.state = 558;
			this.parameterList();
			this.state = 563;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026531840) !== 0) || ((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 235372547) !== 0) || _la===180) {
				{
				this.state = 561;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 28:
				case 29:
				case 30:
				case 31:
				case 47:
				case 48:
				case 62:
				case 63:
				case 64:
				case 65:
				case 72:
				case 73:
				case 74:
					{
					this.state = 559;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 560;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 565;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 567;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===75) {
				{
				this.state = 566;
				this.returnType();
				}
			}

			this.state = 569;
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
			this.state = 571;
			this.match(SolidCashParser.T__51);
			this.state = 572;
			this.anyIdentifier();
			this.state = 573;
			this.match(SolidCashParser.T__52);
			this.state = 585;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 574;
				this.eventParameter();
				this.state = 579;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 44, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 575;
						this.match(SolidCashParser.T__4);
						this.state = 576;
						this.eventParameter();
						}
						}
					}
					this.state = 581;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 44, this._ctx);
				}
				this.state = 583;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 582;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 587;
			this.match(SolidCashParser.T__53);
			this.state = 589;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===55) {
				{
				this.state = 588;
				this.match(SolidCashParser.T__54);
				}
			}

			this.state = 591;
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
			this.state = 595;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 48, this._ctx) ) {
			case 1:
				{
				this.state = 593;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 594;
				this.arrayType(0);
				}
				break;
			}
			this.state = 598;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===56) {
				{
				this.state = 597;
				this.match(SolidCashParser.T__55);
				}
			}

			this.state = 601;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073610753) !== 0) || _la===143 || _la===147 || _la===180) {
				{
				this.state = 600;
				this.anyIdentifier();
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
			this.state = 603;
			this.match(SolidCashParser.T__33);
			this.state = 604;
			this.anyIdentifier();
			this.state = 605;
			this.match(SolidCashParser.T__52);
			this.state = 617;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 606;
				this.errorParameter();
				this.state = 611;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 607;
						this.match(SolidCashParser.T__4);
						this.state = 608;
						this.errorParameter();
						}
						}
					}
					this.state = 613;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				}
				this.state = 615;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 614;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 619;
			this.match(SolidCashParser.T__53);
			this.state = 620;
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
			this.state = 630;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 56, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 622;
				this.typeName();
				this.state = 624;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 623;
					this.match(SolidCashParser.Identifier);
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 626;
				this.arrayType(0);
				this.state = 628;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 627;
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
			this.state = 632;
			this.match(SolidCashParser.T__56);
			this.state = 633;
			this.anyIdentifier();
			this.state = 634;
			this.match(SolidCashParser.T__3);
			this.state = 636;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 635;
				this.structField();
				}
				}
				this.state = 638;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || _la===66 || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180);
			this.state = 640;
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
			this.state = 645;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 58, this._ctx) ) {
			case 1:
				{
				this.state = 642;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 643;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 644;
				this.mappingType();
				}
				break;
			}
			this.state = 647;
			this.anyIdentifier();
			this.state = 648;
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
			this.state = 650;
			this.match(SolidCashParser.T__57);
			this.state = 651;
			this.anyIdentifier();
			this.state = 652;
			this.match(SolidCashParser.T__3);
			this.state = 653;
			this.enumMember();
			this.state = 658;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 59, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 654;
					this.match(SolidCashParser.T__4);
					this.state = 655;
					this.enumMember();
					}
					}
				}
				this.state = 660;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 59, this._ctx);
			}
			this.state = 662;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 661;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 664;
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
			this.state = 666;
			this.anyIdentifier();
			this.state = 669;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===44) {
				{
				this.state = 667;
				this.match(SolidCashParser.T__43);
				this.state = 668;
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
			this.state = 671;
			this.match(SolidCashParser.T__58);
			this.state = 672;
			this.anyIdentifier();
			this.state = 673;
			this.match(SolidCashParser.T__45);
			this.state = 674;
			this.typeName();
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
	public constantDefinition(): ConstantDefinitionContext {
		let localctx: ConstantDefinitionContext = new ConstantDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 62, SolidCashParser.RULE_constantDefinition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 677;
			this.typeName();
			this.state = 678;
			this.match(SolidCashParser.T__59);
			this.state = 679;
			this.anyIdentifier();
			this.state = 680;
			this.match(SolidCashParser.T__43);
			this.state = 681;
			this.expression(0);
			this.state = 682;
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
			this.state = 684;
			this.match(SolidCashParser.T__60);
			this.state = 685;
			this.parameterList();
			this.state = 689;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 62, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 686;
					_la = this._input.LA(1);
					if(!(((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 98307) !== 0))) {
					this._errHandler.recoverInline(this);
					}
					else {
						this._errHandler.reportMatch(this);
					    this.consume();
					}
					}
					}
				}
				this.state = 691;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 62, this._ctx);
			}
			this.state = 695;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 63, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 692;
					this.parentInvocation();
					}
					}
				}
				this.state = 697;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 63, this._ctx);
			}
			this.state = 701;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 98307) !== 0)) {
				{
				{
				this.state = 698;
				_la = this._input.LA(1);
				if(!(((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 98307) !== 0))) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
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
			this.state = 710;
			this.match(SolidCashParser.T__3);
			this.state = 714;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 711;
				this.statement();
				}
				}
				this.state = 716;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 717;
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
			this.state = 719;
			this.match(SolidCashParser.T__37);
			this.state = 720;
			this.parameterList();
			this.state = 724;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 63)) & ~0x1F) === 0 && ((1 << (_la - 63)) & 2051) !== 0)) {
				{
				{
				this.state = 721;
				this.fallbackModifier();
				}
				}
				this.state = 726;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 727;
			this.match(SolidCashParser.T__47);
			this.state = 731;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 63)) & ~0x1F) === 0 && ((1 << (_la - 63)) & 2051) !== 0)) {
				{
				{
				this.state = 728;
				this.fallbackModifier();
				}
				}
				this.state = 733;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 737;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 734;
				this.customModifierInvocation();
				}
				}
				this.state = 739;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 741;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===75) {
				{
				this.state = 740;
				this.returnType();
				}
			}

			this.state = 743;
			this.match(SolidCashParser.T__3);
			this.state = 747;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 744;
				this.statement();
				}
				}
				this.state = 749;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 750;
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
			this.state = 755;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 63:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 752;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 64:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 753;
				this.match(SolidCashParser.T__63);
				}
				break;
			case 74:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 754;
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
			this.state = 825;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 83, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 757;
				this.match(SolidCashParser.T__38);
				this.state = 758;
				this.match(SolidCashParser.T__52);
				this.state = 759;
				this.match(SolidCashParser.T__53);
				this.state = 763;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===64 || _la===74) {
					{
					{
					this.state = 760;
					this.receiveModifier();
					}
					}
					this.state = 765;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 766;
				this.match(SolidCashParser.T__47);
				this.state = 770;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===64 || _la===74) {
					{
					{
					this.state = 767;
					this.receiveModifier();
					}
					}
					this.state = 772;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 773;
				this.match(SolidCashParser.T__62);
				this.state = 777;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===64 || _la===74) {
					{
					{
					this.state = 774;
					this.receiveModifier();
					}
					}
					this.state = 779;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 789;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 4:
					{
					this.state = 780;
					this.match(SolidCashParser.T__3);
					this.state = 784;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
						{
						{
						this.state = 781;
						this.statement();
						}
						}
						this.state = 786;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 787;
					this.match(SolidCashParser.T__5);
					}
					break;
				case 2:
					{
					this.state = 788;
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
				this.state = 791;
				this.match(SolidCashParser.T__38);
				this.state = 792;
				this.match(SolidCashParser.T__52);
				this.state = 793;
				this.match(SolidCashParser.T__53);
				this.state = 797;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===64 || _la===74) {
					{
					{
					this.state = 794;
					this.receiveModifier();
					}
					}
					this.state = 799;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 800;
				this.match(SolidCashParser.T__62);
				this.state = 804;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===64 || _la===74) {
					{
					{
					this.state = 801;
					this.receiveModifier();
					}
					}
					this.state = 806;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 807;
				this.match(SolidCashParser.T__47);
				this.state = 811;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===64 || _la===74) {
					{
					{
					this.state = 808;
					this.receiveModifier();
					}
					}
					this.state = 813;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 823;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 4:
					{
					this.state = 814;
					this.match(SolidCashParser.T__3);
					this.state = 818;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
						{
						{
						this.state = 815;
						this.statement();
						}
						}
						this.state = 820;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 821;
					this.match(SolidCashParser.T__5);
					}
					break;
				case 2:
					{
					this.state = 822;
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
			this.state = 829;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 64:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 827;
				this.match(SolidCashParser.T__63);
				}
				break;
			case 74:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 828;
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
			this.state = 831;
			this.match(SolidCashParser.Identifier);
			this.state = 832;
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
			let _alt: number;
			this.state = 908;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 100, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 835;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 294915) !== 0)) {
					{
					this.state = 834;
					this.stateVariableVisibility();
					}
				}

				this.state = 837;
				this.typeName();
				this.state = 842;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 87, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						this.state = 840;
						this._errHandler.sync(this);
						switch (this._input.LA(1)) {
						case 32:
						case 36:
						case 60:
						case 134:
						case 135:
						case 136:
						case 137:
							{
							this.state = 838;
							this.modifier();
							}
							break;
						case 74:
							{
							this.state = 839;
							this.overrideSpecifier();
							}
							break;
						default:
							throw new NoViableAltException(this);
						}
						}
					}
					this.state = 844;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 87, this._ctx);
				}
				this.state = 845;
				this.anyIdentifier();
				this.state = 848;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===44) {
					{
					this.state = 846;
					this.match(SolidCashParser.T__43);
					this.state = 847;
					this.expression(0);
					}
				}

				this.state = 850;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 852;
				this.typeName();
				this.state = 857;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 268435473) !== 0) || _la===74 || ((((_la - 134)) & ~0x1F) === 0 && ((1 << (_la - 134)) & 15) !== 0)) {
					{
					this.state = 855;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case 32:
					case 36:
					case 60:
					case 134:
					case 135:
					case 136:
					case 137:
						{
						this.state = 853;
						this.modifier();
						}
						break;
					case 74:
						{
						this.state = 854;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 859;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 860;
				this.stateVariableVisibility();
				this.state = 865;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 92, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						this.state = 863;
						this._errHandler.sync(this);
						switch (this._input.LA(1)) {
						case 32:
						case 36:
						case 60:
						case 134:
						case 135:
						case 136:
						case 137:
							{
							this.state = 861;
							this.modifier();
							}
							break;
						case 74:
							{
							this.state = 862;
							this.overrideSpecifier();
							}
							break;
						default:
							throw new NoViableAltException(this);
						}
						}
					}
					this.state = 867;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 92, this._ctx);
				}
				this.state = 868;
				this.anyIdentifier();
				this.state = 871;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===44) {
					{
					this.state = 869;
					this.match(SolidCashParser.T__43);
					this.state = 870;
					this.expression(0);
					}
				}

				this.state = 873;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 876;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 294915) !== 0)) {
					{
					this.state = 875;
					this.stateVariableVisibility();
					}
				}

				this.state = 879;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 878;
					this.match(SolidCashParser.T__39);
					}
				}

				this.state = 881;
				this.mappingType();
				this.state = 885;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 96, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 882;
						this.collectionModifier();
						}
						}
					}
					this.state = 887;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 96, this._ctx);
				}
				this.state = 888;
				this.anyIdentifier();
				this.state = 889;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 892;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 294915) !== 0)) {
					{
					this.state = 891;
					this.stateVariableVisibility();
					}
				}

				this.state = 894;
				this.arrayType(0);
				this.state = 898;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 98, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 895;
						this.collectionModifier();
						}
						}
					}
					this.state = 900;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 98, this._ctx);
				}
				this.state = 901;
				this.anyIdentifier();
				this.state = 904;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===44) {
					{
					this.state = 902;
					this.match(SolidCashParser.T__43);
					this.state = 903;
					this.expression(0);
					}
				}

				this.state = 906;
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
			this.state = 913;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 32:
			case 36:
			case 60:
			case 134:
			case 135:
			case 136:
			case 137:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 910;
				this.modifier();
				}
				break;
			case 47:
			case 48:
			case 62:
			case 65:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 911;
				this.stateVariableVisibility();
				}
				break;
			case 74:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 912;
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
			this.state = 915;
			_la = this._input.LA(1);
			if(!(((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 294915) !== 0))) {
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
			this.state = 953;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 107, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 917;
				this.match(SolidCashParser.T__65);
				this.state = 918;
				this.match(SolidCashParser.T__52);
				this.state = 919;
				this.typeName();
				this.state = 921;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 920;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 923;
				this.match(SolidCashParser.T__66);
				this.state = 924;
				this.typeName();
				this.state = 926;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 925;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 928;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 930;
				this.match(SolidCashParser.T__65);
				this.state = 931;
				this.match(SolidCashParser.T__52);
				this.state = 932;
				this.typeName();
				this.state = 934;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 933;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 936;
				this.match(SolidCashParser.T__66);
				this.state = 937;
				this.mappingType();
				this.state = 938;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 940;
				this.match(SolidCashParser.T__65);
				this.state = 941;
				this.match(SolidCashParser.T__52);
				this.state = 942;
				this.typeName();
				this.state = 944;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 943;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 946;
				this.match(SolidCashParser.T__66);
				this.state = 947;
				this.arrayType(0);
				this.state = 949;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 948;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 951;
				this.match(SolidCashParser.T__53);
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
			this.state = 956;
			this.typeName();
			this.state = 957;
			this.match(SolidCashParser.T__67);
			this.state = 959;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073676297) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 33857) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 3766485027) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 4272948735) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				this.state = 958;
				this.expression(0);
				}
			}

			this.state = 961;
			this.match(SolidCashParser.T__68);
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 971;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 110, this._ctx);
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
					this.state = 963;
					if (!(this.precpred(this._ctx, 1))) {
						throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
					}
					this.state = 964;
					this.match(SolidCashParser.T__67);
					this.state = 966;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073676297) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 33857) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 3766485027) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 4272948735) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
						{
						this.state = 965;
						this.expression(0);
						}
					}

					this.state = 968;
					this.match(SolidCashParser.T__68);
					}
					}
				}
				this.state = 973;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 110, this._ctx);
			}
			}
		}
		catch (re) {
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
			this.state = 974;
			this.match(SolidCashParser.T__69);
			this.state = 975;
			this.match(SolidCashParser.Identifier);
			this.state = 977;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===53) {
				{
				this.state = 976;
				this.parameterList();
				}
			}

			this.state = 983;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===64 || _la===74) {
				{
				this.state = 981;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 64:
					{
					this.state = 979;
					this.match(SolidCashParser.T__63);
					}
					break;
				case 74:
					{
					this.state = 980;
					this.overrideSpecifier();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 985;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 995;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				{
				this.state = 986;
				this.match(SolidCashParser.T__3);
				this.state = 990;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
					{
					{
					this.state = 987;
					this.modifierStatement();
					}
					}
					this.state = 992;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 993;
				this.match(SolidCashParser.T__5);
				}
				break;
			case 2:
				{
				this.state = 994;
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
			this.state = 999;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 116, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 997;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 998;
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
			this.state = 1001;
			this.match(SolidCashParser.T__70);
			this.state = 1002;
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
			this.state = 1004;
			this.match(SolidCashParser.T__6);
			this.state = 1005;
			this.anyIdentifier();
			this.state = 1006;
			this.parameterList();
			this.state = 1011;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026531840) !== 0) || ((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 235372547) !== 0) || _la===180) {
				{
				this.state = 1009;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 28:
				case 29:
				case 30:
				case 31:
				case 47:
				case 48:
				case 62:
				case 63:
				case 64:
				case 65:
				case 72:
				case 73:
				case 74:
					{
					this.state = 1007;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 1008;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 1013;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1015;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===75) {
				{
				this.state = 1014;
				this.returnType();
				}
			}

			this.state = 1017;
			this.match(SolidCashParser.T__3);
			this.state = 1021;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1018;
				this.statement();
				}
				}
				this.state = 1023;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1024;
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
			this.state = 1026;
			this.match(SolidCashParser.Identifier);
			this.state = 1028;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===53) {
				{
				this.state = 1027;
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
			this.state = 1043;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 72:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1030;
				this.match(SolidCashParser.T__71);
				}
				break;
			case 73:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1031;
				this.match(SolidCashParser.T__72);
				}
				break;
			case 62:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1032;
				this.match(SolidCashParser.T__61);
				}
				break;
			case 48:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1033;
				this.match(SolidCashParser.T__47);
				}
				break;
			case 47:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1034;
				this.match(SolidCashParser.T__46);
				}
				break;
			case 65:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1035;
				this.match(SolidCashParser.T__64);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1036;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 74:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1037;
				this.overrideSpecifier();
				}
				break;
			case 64:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1038;
				this.match(SolidCashParser.T__63);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1039;
				this.unsafeModifier();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1040;
				this.match(SolidCashParser.T__28);
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1041;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1042;
				this.match(SolidCashParser.T__27);
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
			this.state = 1045;
			this.match(SolidCashParser.T__73);
			this.state = 1056;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===53) {
				{
				this.state = 1046;
				this.match(SolidCashParser.T__52);
				this.state = 1047;
				this.match(SolidCashParser.Identifier);
				this.state = 1052;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1048;
					this.match(SolidCashParser.T__4);
					this.state = 1049;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1054;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1055;
				this.match(SolidCashParser.T__53);
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
			this.state = 1058;
			this.match(SolidCashParser.T__30);
			this.state = 1062;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===53) {
				{
				this.state = 1059;
				this.match(SolidCashParser.T__52);
				this.state = 1060;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1061;
				this.match(SolidCashParser.T__53);
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
			this.state = 1064;
			this.match(SolidCashParser.T__74);
			this.state = 1065;
			this.match(SolidCashParser.T__52);
			this.state = 1066;
			this.returnParam();
			this.state = 1071;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 126, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1067;
					this.match(SolidCashParser.T__4);
					this.state = 1068;
					this.returnParam();
					}
					}
				}
				this.state = 1073;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 126, this._ctx);
			}
			this.state = 1075;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1074;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1077;
			this.match(SolidCashParser.T__53);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1109;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 134, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1079;
				this.typeName();
				this.state = 1083;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 128, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1080;
						this.modifier();
						}
						}
					}
					this.state = 1085;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 128, this._ctx);
				}
				this.state = 1087;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073610753) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1086;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1089;
				this.arrayType(0);
				this.state = 1093;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 130, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1090;
						this.modifier();
						}
						}
					}
					this.state = 1095;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 130, this._ctx);
				}
				this.state = 1097;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073610753) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1096;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1099;
				this.mappingType();
				this.state = 1103;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 132, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1100;
						this.modifier();
						}
						}
					}
					this.state = 1105;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 132, this._ctx);
				}
				this.state = 1107;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073610753) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1106;
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
			this.state = 1111;
			this.match(SolidCashParser.T__52);
			this.state = 1123;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===66 || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1112;
				this.parameter();
				this.state = 1117;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 135, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1113;
						this.match(SolidCashParser.T__4);
						this.state = 1114;
						this.parameter();
						}
						}
					}
					this.state = 1119;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 135, this._ctx);
				}
				this.state = 1121;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1120;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1125;
			this.match(SolidCashParser.T__53);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1157;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 144, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1127;
				this.typeName();
				this.state = 1131;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 138, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1128;
						this.modifier();
						}
						}
					}
					this.state = 1133;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 138, this._ctx);
				}
				this.state = 1135;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073610753) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1134;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1137;
				this.arrayType(0);
				this.state = 1141;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 140, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1138;
						this.modifier();
						}
						}
					}
					this.state = 1143;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 140, this._ctx);
				}
				this.state = 1145;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073610753) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1144;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1147;
				this.mappingType();
				this.state = 1151;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 142, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1148;
						this.modifier();
						}
						}
					}
					this.state = 1153;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 142, this._ctx);
				}
				this.state = 1155;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073610753) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1154;
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
			this.state = 1168;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 146, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1159;
				this.match(SolidCashParser.T__3);
				this.state = 1163;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
					{
					{
					this.state = 1160;
					this.statement();
					}
					}
					this.state = 1165;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1166;
				this.match(SolidCashParser.T__5);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1167;
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
			this.state = 1170;
			this.match(SolidCashParser.T__3);
			this.state = 1174;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1171;
				this.statement();
				}
				}
				this.state = 1176;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1177;
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
			this.state = 1202;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 148, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1179;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1180;
				this.blockStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1181;
				this.variableDefinition();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1182;
				this.tupleAssignment();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1183;
				this.prefixIncDecStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1184;
				this.timeOpStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1185;
				this.requireStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1186;
				this.ifStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1187;
				this.loopStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1188;
				this.consoleStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1189;
				this.emitStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1190;
				this.returnStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1191;
				this.selfdestructStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1192;
				this.assemblyStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1193;
				this.tryCatchStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1194;
				this.revertStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1195;
				this.assertStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1196;
				this.deleteStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1197;
				this.uncheckedStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1198;
				this.switchStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1199;
				this.breakStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1200;
				this.continueStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1201;
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
			this.state = 1204;
			this.expression(0);
			this.state = 1263;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 155, this._ctx) ) {
			case 1:
				{
				this.state = 1205;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1206;
				this.assignChain();
				}
				break;
			case 2:
				{
				this.state = 1207;
				this.match(SolidCashParser.DotPush);
				this.state = 1208;
				this.match(SolidCashParser.T__52);
				this.state = 1209;
				this.match(SolidCashParser.T__53);
				this.state = 1210;
				localctx._second = this.match(SolidCashParser.DotPush);
				this.state = 1211;
				this.match(SolidCashParser.T__52);
				this.state = 1212;
				this.match(SolidCashParser.T__53);
				this.state = 1213;
				this.match(SolidCashParser.T__43);
				this.state = 1214;
				this.expression(0);
				this.state = 1223;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===165) {
					{
					this.state = 1215;
					localctx._rhsPush = this.match(SolidCashParser.DotPush);
					this.state = 1216;
					this.match(SolidCashParser.T__52);
					this.state = 1217;
					this.match(SolidCashParser.T__53);
					this.state = 1221;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===165) {
						{
						this.state = 1218;
						localctx._rhsPush2 = this.match(SolidCashParser.DotPush);
						this.state = 1219;
						this.match(SolidCashParser.T__52);
						this.state = 1220;
						this.match(SolidCashParser.T__53);
						}
					}

					}
				}

				}
				break;
			case 3:
				{
				this.state = 1225;
				this.match(SolidCashParser.DotPush);
				this.state = 1226;
				this.match(SolidCashParser.T__52);
				this.state = 1227;
				this.match(SolidCashParser.T__53);
				this.state = 1228;
				localctx._second = this.match(SolidCashParser.DotPush);
				this.state = 1229;
				this.match(SolidCashParser.T__52);
				this.state = 1231;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073676297) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 33857) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 3766485027) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 4272948735) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
					{
					this.state = 1230;
					this.pushArgument();
					}
				}

				this.state = 1233;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 4:
				{
				this.state = 1234;
				this.match(SolidCashParser.DotPush);
				this.state = 1235;
				this.match(SolidCashParser.T__52);
				this.state = 1236;
				this.match(SolidCashParser.T__53);
				this.state = 1237;
				this.match(SolidCashParser.T__43);
				this.state = 1238;
				this.expression(0);
				this.state = 1247;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===165) {
					{
					this.state = 1239;
					localctx._rhsPush = this.match(SolidCashParser.DotPush);
					this.state = 1240;
					this.match(SolidCashParser.T__52);
					this.state = 1241;
					this.match(SolidCashParser.T__53);
					this.state = 1245;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===165) {
						{
						this.state = 1242;
						localctx._rhsPush2 = this.match(SolidCashParser.DotPush);
						this.state = 1243;
						this.match(SolidCashParser.T__52);
						this.state = 1244;
						this.match(SolidCashParser.T__53);
						}
					}

					}
				}

				}
				break;
			case 5:
				{
				this.state = 1249;
				this.match(SolidCashParser.DotPush);
				this.state = 1250;
				this.match(SolidCashParser.T__52);
				this.state = 1252;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073676297) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 33857) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 3766485027) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 4272948735) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
					{
					this.state = 1251;
					this.pushArgument();
					}
				}

				this.state = 1254;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 6:
				{
				this.state = 1255;
				this.match(SolidCashParser.DotPop);
				this.state = 1256;
				this.match(SolidCashParser.T__52);
				this.state = 1257;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 7:
				{
				this.state = 1258;
				this.match(SolidCashParser.DotDelete);
				this.state = 1259;
				this.match(SolidCashParser.T__52);
				this.state = 1260;
				this.expression(0);
				this.state = 1261;
				this.match(SolidCashParser.T__53);
				}
				break;
			}
			this.state = 1265;
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
			this.state = 1267;
			this.expression(0);
			this.state = 1270;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 156, this._ctx) ) {
			case 1:
				{
				this.state = 1268;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1269;
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
			this.state = 1272;
			localctx._op = this._input.LT(1);
			_la = this._input.LA(1);
			if(!(_la===86 || _la===87)) {
			    localctx._op = this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			this.state = 1273;
			this.expression(0);
			this.state = 1274;
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
			this.state = 1311;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 160, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1276;
				this.match(SolidCashParser.T__87);
				this.state = 1277;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1278;
				this.match(SolidCashParser.T__87);
				this.state = 1279;
				this.expression(0);
				this.state = 1280;
				localctx._rop = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
				    localctx._rop = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1281;
				this.assignChain();
				this.state = 1282;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1284;
				this.match(SolidCashParser.T__87);
				this.state = 1285;
				this.expression(0);
				this.state = 1290;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1286;
					this.match(SolidCashParser.T__4);
					this.state = 1287;
					this.expression(0);
					}
					}
					this.state = 1292;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1293;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1295;
				this.match(SolidCashParser.T__87);
				this.state = 1296;
				this.match(SolidCashParser.T__52);
				this.state = 1297;
				this.expression(0);
				this.state = 1302;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 158, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1298;
						this.match(SolidCashParser.T__4);
						this.state = 1299;
						this.expression(0);
						}
						}
					}
					this.state = 1304;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 158, this._ctx);
				}
				this.state = 1306;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1305;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1308;
				this.match(SolidCashParser.T__53);
				this.state = 1309;
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
			this.state = 1313;
			this.match(SolidCashParser.T__29);
			this.state = 1314;
			this.match(SolidCashParser.T__52);
			this.state = 1315;
			this.expression(0);
			this.state = 1316;
			this.match(SolidCashParser.T__53);
			this.state = 1317;
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
			this.state = 1352;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 166, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1319;
				this.match(SolidCashParser.T__88);
				this.state = 1320;
				this.match(SolidCashParser.Identifier);
				this.state = 1323;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1321;
					this.match(SolidCashParser.T__11);
					this.state = 1322;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1325;
				this.match(SolidCashParser.T__52);
				this.state = 1326;
				this.match(SolidCashParser.T__3);
				this.state = 1338;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1327;
					this.namedArg();
					this.state = 1332;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 162, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1328;
							this.match(SolidCashParser.T__4);
							this.state = 1329;
							this.namedArg();
							}
							}
						}
						this.state = 1334;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 162, this._ctx);
					}
					this.state = 1336;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1335;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1340;
				this.match(SolidCashParser.T__5);
				this.state = 1341;
				this.match(SolidCashParser.T__53);
				this.state = 1342;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1343;
				this.match(SolidCashParser.T__88);
				this.state = 1344;
				this.match(SolidCashParser.Identifier);
				this.state = 1347;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1345;
					this.match(SolidCashParser.T__11);
					this.state = 1346;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1349;
				this.expressionList();
				this.state = 1350;
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
			this.state = 1408;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 175, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1354;
				this.typeName();
				this.state = 1358;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 167, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 167, this._ctx);
				}
				this.state = 1361;
				this.anyIdentifier();
				this.state = 1371;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===44) {
					{
					this.state = 1362;
					this.match(SolidCashParser.T__43);
					this.state = 1363;
					this.expression(0);
					this.state = 1369;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case 44:
					case 76:
					case 77:
					case 78:
					case 79:
					case 80:
					case 81:
					case 82:
					case 83:
					case 84:
					case 85:
						{
						this.state = 1364;
						localctx._iop = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
						    localctx._iop = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1365;
						this.assignChain();
						}
						break;
					case 165:
						{
						this.state = 1366;
						this.match(SolidCashParser.DotPush);
						this.state = 1367;
						this.match(SolidCashParser.T__52);
						this.state = 1368;
						this.match(SolidCashParser.T__53);
						}
						break;
					case 2:
						break;
					default:
						break;
					}
					}
				}

				this.state = 1373;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1375;
				this.arrayType(0);
				this.state = 1379;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 170, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1376;
						this.modifier();
						}
						}
					}
					this.state = 1381;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 170, this._ctx);
				}
				this.state = 1382;
				this.anyIdentifier();
				this.state = 1390;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===44) {
					{
					this.state = 1383;
					this.match(SolidCashParser.T__43);
					this.state = 1384;
					this.expression(0);
					this.state = 1388;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===165) {
						{
						this.state = 1385;
						this.match(SolidCashParser.DotPush);
						this.state = 1386;
						this.match(SolidCashParser.T__52);
						this.state = 1387;
						this.match(SolidCashParser.T__53);
						}
					}

					}
				}

				this.state = 1392;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1394;
				this.mappingType();
				this.state = 1398;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 173, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1395;
						this.modifier();
						}
						}
					}
					this.state = 1400;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 173, this._ctx);
				}
				this.state = 1401;
				this.anyIdentifier();
				this.state = 1404;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===44) {
					{
					this.state = 1402;
					this.match(SolidCashParser.T__43);
					this.state = 1403;
					this.expression(0);
					}
				}

				this.state = 1406;
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
			let _alt: number;
			this.state = 1486;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 182, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1410;
				this.typeName();
				this.state = 1411;
				this.match(SolidCashParser.Identifier);
				this.state = 1416;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1412;
					this.match(SolidCashParser.T__4);
					this.state = 1413;
					this.typeName();
					this.state = 1414;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1418;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1420;
				this.match(SolidCashParser.T__43);
				this.state = 1421;
				this.expression(0);
				this.state = 1422;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1424;
				this.match(SolidCashParser.T__52);
				this.state = 1425;
				this.tupleSlot();
				this.state = 1428;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1426;
					this.match(SolidCashParser.T__4);
					this.state = 1427;
					this.tupleSlot();
					}
					}
					this.state = 1430;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1432;
				this.match(SolidCashParser.T__53);
				this.state = 1433;
				this.match(SolidCashParser.T__43);
				this.state = 1434;
				this.match(SolidCashParser.T__52);
				this.state = 1435;
				this.expression(0);
				this.state = 1438;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1436;
					this.match(SolidCashParser.T__4);
					this.state = 1437;
					this.expression(0);
					}
					}
					this.state = 1440;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1442;
				this.match(SolidCashParser.T__53);
				this.state = 1443;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1445;
				this.match(SolidCashParser.T__52);
				this.state = 1446;
				this.tupleSlot();
				this.state = 1449;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1447;
					this.match(SolidCashParser.T__4);
					this.state = 1448;
					this.tupleSlot();
					}
					}
					this.state = 1451;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1453;
				this.match(SolidCashParser.T__53);
				this.state = 1454;
				this.match(SolidCashParser.T__43);
				this.state = 1455;
				this.expression(0);
				this.state = 1456;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1458;
				this.match(SolidCashParser.T__52);
				this.state = 1459;
				this.typeName();
				this.state = 1463;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 180, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1460;
						this.modifier();
						}
						}
					}
					this.state = 1465;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 180, this._ctx);
				}
				this.state = 1466;
				this.anyIdentifier();
				this.state = 1467;
				this.match(SolidCashParser.T__53);
				this.state = 1468;
				this.match(SolidCashParser.T__43);
				this.state = 1469;
				this.expression(0);
				this.state = 1470;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1472;
				this.match(SolidCashParser.T__52);
				this.state = 1473;
				this.arrayType(0);
				this.state = 1477;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 181, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1474;
						this.modifier();
						}
						}
					}
					this.state = 1479;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 181, this._ctx);
				}
				this.state = 1480;
				this.anyIdentifier();
				this.state = 1481;
				this.match(SolidCashParser.T__53);
				this.state = 1482;
				this.match(SolidCashParser.T__43);
				this.state = 1483;
				this.expression(0);
				this.state = 1484;
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
		let _la: number;
		try {
			let _alt: number;
			this.state = 1519;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 187, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1488;
				this.typeName();
				this.state = 1492;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 183, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1489;
						this.modifier();
						}
						}
					}
					this.state = 1494;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 183, this._ctx);
				}
				this.state = 1495;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1497;
				this.arrayType(0);
				this.state = 1501;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 184, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1498;
						this.modifier();
						}
						}
					}
					this.state = 1503;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 184, this._ctx);
				}
				this.state = 1504;
				this.anyIdentifier();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1506;
				this.anyIdentifier();
				this.state = 1515;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12 || _la===68) {
					{
					this.state = 1513;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case 68:
						{
						this.state = 1507;
						this.match(SolidCashParser.T__67);
						this.state = 1508;
						this.expression(0);
						this.state = 1509;
						this.match(SolidCashParser.T__68);
						}
						break;
					case 12:
						{
						this.state = 1511;
						this.match(SolidCashParser.T__11);
						this.state = 1512;
						this.anyIdentifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 1517;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
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
			this.state = 1521;
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
			this.state = 1584;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 193, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1523;
				this.match(SolidCashParser.T__89);
				this.state = 1524;
				this.match(SolidCashParser.Identifier);
				this.state = 1525;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1526;
				this.match(SolidCashParser.T__89);
				this.state = 1527;
				this.match(SolidCashParser.T__90);
				this.state = 1528;
				this.match(SolidCashParser.T__11);
				this.state = 1529;
				this.match(SolidCashParser.Identifier);
				this.state = 1530;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1531;
				this.match(SolidCashParser.T__89);
				this.state = 1532;
				this.match(SolidCashParser.T__90);
				this.state = 1533;
				this.match(SolidCashParser.T__11);
				this.state = 1534;
				this.match(SolidCashParser.Identifier);
				this.state = 1539;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1535;
					this.match(SolidCashParser.T__67);
					this.state = 1536;
					this.expression(0);
					this.state = 1537;
					this.match(SolidCashParser.T__68);
					}
					}
					this.state = 1541;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===68);
				this.state = 1543;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1545;
				this.match(SolidCashParser.T__89);
				this.state = 1546;
				this.match(SolidCashParser.Identifier);
				this.state = 1551;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1547;
					this.match(SolidCashParser.T__67);
					this.state = 1548;
					this.expression(0);
					this.state = 1549;
					this.match(SolidCashParser.T__68);
					}
					}
					this.state = 1553;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===68);
				this.state = 1555;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				localctx = new DeleteMemberEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1557;
				this.match(SolidCashParser.T__89);
				this.state = 1558;
				this.match(SolidCashParser.Identifier);
				this.state = 1561;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1559;
					this.match(SolidCashParser.T__11);
					this.state = 1560;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1563;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1569;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1565;
					this.match(SolidCashParser.T__67);
					this.state = 1566;
					this.expression(0);
					this.state = 1567;
					this.match(SolidCashParser.T__68);
					}
					}
					this.state = 1571;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===68);
				this.state = 1573;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 6:
				localctx = new DeleteMemberContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1575;
				this.match(SolidCashParser.T__89);
				this.state = 1576;
				this.match(SolidCashParser.Identifier);
				this.state = 1579;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1577;
					this.match(SolidCashParser.T__11);
					this.state = 1578;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1581;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1583;
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
			this.state = 1586;
			this.match(SolidCashParser.T__91);
			this.state = 1587;
			this.match(SolidCashParser.T__52);
			this.state = 1588;
			this.match(SolidCashParser.TxVar);
			this.state = 1589;
			this.match(SolidCashParser.T__22);
			this.state = 1590;
			this.expression(0);
			this.state = 1593;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1591;
				this.match(SolidCashParser.T__4);
				this.state = 1592;
				this.requireMessage();
				}
			}

			this.state = 1595;
			this.match(SolidCashParser.T__53);
			this.state = 1596;
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
			this.state = 1598;
			this.match(SolidCashParser.T__91);
			this.state = 1599;
			this.match(SolidCashParser.T__52);
			this.state = 1600;
			this.expression(0);
			this.state = 1603;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1601;
				this.match(SolidCashParser.T__4);
				this.state = 1602;
				this.requireMessage();
				}
			}

			this.state = 1605;
			this.match(SolidCashParser.T__53);
			this.state = 1606;
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
			this.state = 1608;
			this.match(SolidCashParser.T__92);
			this.state = 1609;
			this.match(SolidCashParser.T__52);
			this.state = 1610;
			this.expression(0);
			this.state = 1611;
			this.match(SolidCashParser.T__53);
			this.state = 1612;
			localctx._ifBlock = this.block();
			this.state = 1615;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 196, this._ctx) ) {
			case 1:
				{
				this.state = 1613;
				this.match(SolidCashParser.T__93);
				this.state = 1614;
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
			this.state = 1623;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 197, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1617;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1618;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1619;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1620;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1621;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1622;
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
			this.state = 1625;
			this.match(SolidCashParser.T__8);
			this.state = 1626;
			this.match(SolidCashParser.T__52);
			this.state = 1627;
			this.typeName();
			this.state = 1628;
			this.match(SolidCashParser.Identifier);
			this.state = 1629;
			this.match(SolidCashParser.T__4);
			this.state = 1630;
			this.typeName();
			this.state = 1631;
			this.match(SolidCashParser.Identifier);
			this.state = 1632;
			this.match(SolidCashParser.T__94);
			this.state = 1633;
			this.match(SolidCashParser.T__90);
			this.state = 1634;
			this.match(SolidCashParser.T__11);
			this.state = 1635;
			this.match(SolidCashParser.Identifier);
			this.state = 1636;
			this.match(SolidCashParser.T__11);
			this.state = 1637;
			this.match(SolidCashParser.T__32);
			this.state = 1638;
			this.match(SolidCashParser.T__53);
			this.state = 1639;
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
			this.state = 1641;
			this.match(SolidCashParser.T__8);
			this.state = 1642;
			this.match(SolidCashParser.T__52);
			this.state = 1643;
			this.typeName();
			this.state = 1644;
			this.match(SolidCashParser.Identifier);
			this.state = 1645;
			this.match(SolidCashParser.T__95);
			this.state = 1646;
			this.match(SolidCashParser.T__90);
			this.state = 1647;
			this.match(SolidCashParser.T__11);
			this.state = 1648;
			this.match(SolidCashParser.Identifier);
			this.state = 1649;
			this.match(SolidCashParser.T__53);
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
	public forOfStatement(): ForOfStatementContext {
		let localctx: ForOfStatementContext = new ForOfStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 150, SolidCashParser.RULE_forOfStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1652;
			this.match(SolidCashParser.T__8);
			this.state = 1653;
			this.match(SolidCashParser.T__52);
			this.state = 1654;
			this.typeName();
			this.state = 1655;
			this.match(SolidCashParser.Identifier);
			this.state = 1656;
			this.match(SolidCashParser.T__94);
			this.state = 1657;
			this.match(SolidCashParser.T__90);
			this.state = 1658;
			this.match(SolidCashParser.T__11);
			this.state = 1659;
			this.match(SolidCashParser.Identifier);
			this.state = 1660;
			this.match(SolidCashParser.T__53);
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
	public forStatement(): ForStatementContext {
		let localctx: ForStatementContext = new ForStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 152, SolidCashParser.RULE_forStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1663;
			this.match(SolidCashParser.T__8);
			this.state = 1664;
			this.match(SolidCashParser.T__52);
			this.state = 1665;
			this.forInit();
			this.state = 1666;
			this.forCondition();
			this.state = 1668;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===53 || _la===86 || _la===87 || _la===180) {
				{
				this.state = 1667;
				this.forUpdate();
				}
			}

			this.state = 1670;
			this.match(SolidCashParser.T__53);
			this.state = 1671;
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
			this.state = 1718;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 204, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1673;
				this.typeName();
				this.state = 1677;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 268435473) !== 0) || ((((_la - 134)) & ~0x1F) === 0 && ((1 << (_la - 134)) & 15) !== 0)) {
					{
					{
					this.state = 1674;
					this.modifier();
					}
					}
					this.state = 1679;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1680;
				this.match(SolidCashParser.Identifier);
				this.state = 1683;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===44) {
					{
					this.state = 1681;
					this.match(SolidCashParser.T__43);
					this.state = 1682;
					this.expression(0);
					}
				}

				this.state = 1685;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1687;
				this.match(SolidCashParser.Identifier);
				this.state = 1688;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1689;
				this.expression(0);
				this.state = 1690;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1692;
				this.match(SolidCashParser.T__52);
				this.state = 1693;
				this.tupleSlot();
				this.state = 1696;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1694;
					this.match(SolidCashParser.T__4);
					this.state = 1695;
					this.tupleSlot();
					}
					}
					this.state = 1698;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1700;
				this.match(SolidCashParser.T__53);
				this.state = 1701;
				this.match(SolidCashParser.T__43);
				this.state = 1713;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 203, this._ctx) ) {
				case 1:
					{
					this.state = 1702;
					this.match(SolidCashParser.T__52);
					this.state = 1703;
					this.expression(0);
					this.state = 1706;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1704;
						this.match(SolidCashParser.T__4);
						this.state = 1705;
						this.expression(0);
						}
						}
						this.state = 1708;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===5);
					this.state = 1710;
					this.match(SolidCashParser.T__53);
					}
					break;
				case 2:
					{
					this.state = 1712;
					this.expression(0);
					}
					break;
				}
				this.state = 1715;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1717;
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
			this.state = 1721;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073676297) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 33857) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 3766485027) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 4272948735) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				this.state = 1720;
				this.expression(0);
				}
			}

			this.state = 1723;
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
			this.state = 1755;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 209, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1725;
				this.match(SolidCashParser.Identifier);
				this.state = 1726;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1727;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1728;
				this.match(SolidCashParser.Identifier);
				this.state = 1729;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===86 || _la===87)) {
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
				this.state = 1730;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===86 || _la===87)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1731;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1732;
				this.match(SolidCashParser.T__52);
				this.state = 1733;
				this.tupleSlot();
				this.state = 1736;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1734;
					this.match(SolidCashParser.T__4);
					this.state = 1735;
					this.tupleSlot();
					}
					}
					this.state = 1738;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1740;
				this.match(SolidCashParser.T__53);
				this.state = 1741;
				this.match(SolidCashParser.T__43);
				this.state = 1753;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 208, this._ctx) ) {
				case 1:
					{
					this.state = 1742;
					this.match(SolidCashParser.T__52);
					this.state = 1743;
					this.expression(0);
					this.state = 1746;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1744;
						this.match(SolidCashParser.T__4);
						this.state = 1745;
						this.expression(0);
						}
						}
						this.state = 1748;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===5);
					this.state = 1750;
					this.match(SolidCashParser.T__53);
					}
					break;
				case 2:
					{
					this.state = 1752;
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
			this.state = 1757;
			this.match(SolidCashParser.T__96);
			this.state = 1758;
			this.block();
			this.state = 1759;
			this.match(SolidCashParser.T__97);
			this.state = 1760;
			this.match(SolidCashParser.T__52);
			this.state = 1761;
			this.expression(0);
			this.state = 1762;
			this.match(SolidCashParser.T__53);
			this.state = 1763;
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
			this.state = 1765;
			this.match(SolidCashParser.T__97);
			this.state = 1766;
			this.match(SolidCashParser.T__52);
			this.state = 1767;
			this.expression(0);
			this.state = 1768;
			this.match(SolidCashParser.T__53);
			this.state = 1769;
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
			this.state = 1771;
			this.match(SolidCashParser.T__98);
			this.state = 1772;
			this.consoleParameterList();
			this.state = 1773;
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
			this.state = 1775;
			this.match(SolidCashParser.T__99);
			this.state = 1777;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===151) {
				{
				this.state = 1776;
				this.match(SolidCashParser.StringLiteral);
				}
			}

			this.state = 1789;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===53) {
				{
				this.state = 1779;
				this.match(SolidCashParser.T__52);
				this.state = 1780;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1785;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1781;
					this.match(SolidCashParser.T__4);
					this.state = 1782;
					this.match(SolidCashParser.StringLiteral);
					}
					}
					this.state = 1787;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1788;
				this.match(SolidCashParser.T__53);
				}
			}

			this.state = 1791;
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
			this.state = 1793;
			this.match(SolidCashParser.T__3);
			this.state = 1797;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026534544) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 511) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 2285601) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				{
				this.state = 1794;
				this.yulStatement();
				}
				}
				this.state = 1799;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
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
	public yulStatement(): YulStatementContext {
		let localctx: YulStatementContext = new YulStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 170, SolidCashParser.RULE_yulStatement);
		try {
			this.state = 1815;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 214, this._ctx) ) {
			case 1:
				localctx = new YulNestedBlockStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1802;
				this.yulBlock();
				}
				break;
			case 2:
				localctx = new YulVarDeclStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1803;
				this.yulVariableDeclaration();
				}
				break;
			case 3:
				localctx = new YulAssignStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1804;
				this.yulAssignment();
				}
				break;
			case 4:
				localctx = new YulIfStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1805;
				this.yulIf();
				}
				break;
			case 5:
				localctx = new YulSwitchStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1806;
				this.yulSwitch();
				}
				break;
			case 6:
				localctx = new YulForStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1807;
				this.yulForLoop();
				}
				break;
			case 7:
				localctx = new YulFunctionDefStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1808;
				this.yulFunctionDefinition();
				}
				break;
			case 8:
				localctx = new YulBreakStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1809;
				this.match(SolidCashParser.T__100);
				}
				break;
			case 9:
				localctx = new YulContinueStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1810;
				this.match(SolidCashParser.T__101);
				}
				break;
			case 10:
				localctx = new YulLeaveStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1811;
				this.match(SolidCashParser.T__36);
				}
				break;
			case 11:
				localctx = new YulCallStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1812;
				this.yulFunctionCall();
				}
				break;
			case 12:
				localctx = new YulPathStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1813;
				this.yulPath();
				}
				break;
			case 13:
				localctx = new YulLiteralStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1814;
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
			this.state = 1817;
			this.match(SolidCashParser.T__102);
			this.state = 1818;
			this.anyIdentifier();
			this.state = 1823;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1819;
				this.match(SolidCashParser.T__4);
				this.state = 1820;
				this.anyIdentifier();
				}
				}
				this.state = 1825;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1828;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===104) {
				{
				this.state = 1826;
				this.match(SolidCashParser.T__103);
				this.state = 1827;
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
			this.state = 1830;
			this.yulPath();
			this.state = 1835;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1831;
				this.match(SolidCashParser.T__4);
				this.state = 1832;
				this.yulPath();
				}
				}
				this.state = 1837;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1838;
			this.match(SolidCashParser.T__103);
			this.state = 1839;
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
			this.state = 1841;
			this.match(SolidCashParser.T__92);
			this.state = 1842;
			this.yulExpression();
			this.state = 1843;
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
			this.state = 1845;
			this.match(SolidCashParser.T__104);
			this.state = 1846;
			this.yulExpression();
			this.state = 1856;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 106:
				{
				this.state = 1848;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1847;
					this.yulCase();
					}
					}
					this.state = 1850;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===106);
				this.state = 1853;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===107) {
					{
					this.state = 1852;
					this.yulDefault();
					}
				}

				}
				break;
			case 107:
				{
				this.state = 1855;
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
			this.state = 1858;
			this.match(SolidCashParser.T__105);
			this.state = 1859;
			this.yulLiteral();
			this.state = 1860;
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
			this.state = 1862;
			this.match(SolidCashParser.T__106);
			this.state = 1863;
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
			this.state = 1865;
			this.match(SolidCashParser.T__8);
			this.state = 1866;
			this.yulBlock();
			this.state = 1867;
			this.yulExpression();
			this.state = 1868;
			this.yulBlock();
			this.state = 1869;
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
			this.state = 1871;
			this.match(SolidCashParser.T__6);
			this.state = 1872;
			this.match(SolidCashParser.Identifier);
			this.state = 1873;
			this.match(SolidCashParser.T__52);
			this.state = 1882;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 1874;
				this.match(SolidCashParser.Identifier);
				this.state = 1879;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1875;
					this.match(SolidCashParser.T__4);
					this.state = 1876;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1881;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1884;
			this.match(SolidCashParser.T__53);
			this.state = 1894;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===108) {
				{
				this.state = 1885;
				this.match(SolidCashParser.T__107);
				this.state = 1886;
				this.match(SolidCashParser.Identifier);
				this.state = 1891;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1887;
					this.match(SolidCashParser.T__4);
					this.state = 1888;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1893;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1896;
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
			this.state = 1901;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 225, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1898;
				this.yulFunctionCall();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1899;
				this.yulPath();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1900;
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
			this.state = 1903;
			this.yulFunctionName();
			this.state = 1904;
			this.match(SolidCashParser.T__52);
			this.state = 1913;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073610753) !== 0) || _la===88 || _la===109 || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				this.state = 1905;
				this.yulExpression();
				this.state = 1910;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1906;
					this.match(SolidCashParser.T__4);
					this.state = 1907;
					this.yulExpression();
					}
					}
					this.state = 1912;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1915;
			this.match(SolidCashParser.T__53);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1917;
			_la = this._input.LA(1);
			if(!(_la===30 || _la===35 || _la===88 || _la===109 || _la===149 || _la===180)) {
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
			this.state = 1919;
			this.anyIdentifier();
			this.state = 1925;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===12 || _la===164) {
				{
				this.state = 1923;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 12:
					{
					this.state = 1920;
					this.match(SolidCashParser.T__11);
					this.state = 1921;
					this.anyIdentifier();
					}
					break;
				case 164:
					{
					this.state = 1922;
					this.match(SolidCashParser.DotLength);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 1927;
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
			this.state = 1928;
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
			this.state = 1930;
			this.match(SolidCashParser.T__109);
			this.state = 1931;
			this.match(SolidCashParser.T__3);
			this.state = 1935;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1932;
				this.statement();
				}
				}
				this.state = 1937;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1938;
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
			this.state = 1940;
			this.match(SolidCashParser.T__104);
			this.state = 1941;
			this.match(SolidCashParser.T__52);
			this.state = 1942;
			this.expression(0);
			this.state = 1943;
			this.match(SolidCashParser.T__53);
			this.state = 1944;
			this.match(SolidCashParser.T__3);
			this.state = 1948;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===106) {
				{
				{
				this.state = 1945;
				this.switchCase();
				}
				}
				this.state = 1950;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1952;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===107) {
				{
				this.state = 1951;
				this.switchDefault();
				}
			}

			this.state = 1954;
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
			this.state = 1956;
			this.match(SolidCashParser.T__105);
			this.state = 1957;
			this.expression(0);
			this.state = 1958;
			this.match(SolidCashParser.T__110);
			this.state = 1962;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1959;
				this.statement();
				}
				}
				this.state = 1964;
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
			this.state = 1965;
			this.match(SolidCashParser.T__106);
			this.state = 1966;
			this.match(SolidCashParser.T__110);
			this.state = 1970;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1967;
				this.statement();
				}
				}
				this.state = 1972;
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
			this.state = 1973;
			this.match(SolidCashParser.T__111);
			this.state = 1974;
			this.expression(0);
			this.state = 1976;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===75) {
				{
				this.state = 1975;
				this.tryReturns();
				}
			}

			this.state = 1978;
			localctx._tryBlock = this.block();
			this.state = 1980;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1979;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1982;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 236, this._ctx);
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
			this.state = 1984;
			this.match(SolidCashParser.T__74);
			this.state = 1985;
			this.match(SolidCashParser.T__52);
			this.state = 1997;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===66 || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1986;
				this.parameter();
				this.state = 1991;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 237, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1987;
						this.match(SolidCashParser.T__4);
						this.state = 1988;
						this.parameter();
						}
						}
					}
					this.state = 1993;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 237, this._ctx);
				}
				this.state = 1995;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1994;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1999;
			this.match(SolidCashParser.T__53);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 2001;
			this.match(SolidCashParser.T__112);
			this.state = 2003;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 240, this._ctx) ) {
			case 1:
				{
				this.state = 2002;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 2020;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 244, this._ctx) ) {
			case 1:
				{
				this.state = 2005;
				this.match(SolidCashParser.T__52);
				this.state = 2017;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || _la===66 || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 2006;
					this.parameter();
					this.state = 2011;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 241, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2007;
							this.match(SolidCashParser.T__4);
							this.state = 2008;
							this.parameter();
							}
							}
						}
						this.state = 2013;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 241, this._ctx);
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
				this.match(SolidCashParser.T__53);
				}
				break;
			}
			this.state = 2022;
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
			this.state = 2024;
			this.match(SolidCashParser.T__100);
			this.state = 2025;
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
			this.state = 2027;
			this.match(SolidCashParser.T__101);
			this.state = 2028;
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
			this.state = 2034;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 245, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2030;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2031;
				this.match(SolidCashParser.Identifier);
				this.state = 2032;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2033;
				this.expression(0);
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
	public revertStatement(): RevertStatementContext {
		let localctx: RevertStatementContext = new RevertStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 218, SolidCashParser.RULE_revertStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 2080;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 251, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2036;
				this.match(SolidCashParser.T__34);
				this.state = 2037;
				this.anyIdentifier();
				this.state = 2040;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 2038;
					this.match(SolidCashParser.T__11);
					this.state = 2039;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 2042;
				this.match(SolidCashParser.T__52);
				this.state = 2043;
				this.match(SolidCashParser.T__3);
				this.state = 2055;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2044;
					this.namedArg();
					this.state = 2049;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 247, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2045;
							this.match(SolidCashParser.T__4);
							this.state = 2046;
							this.namedArg();
							}
							}
						}
						this.state = 2051;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 247, this._ctx);
					}
					this.state = 2053;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2052;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2057;
				this.match(SolidCashParser.T__5);
				this.state = 2058;
				this.match(SolidCashParser.T__53);
				this.state = 2059;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2061;
				this.match(SolidCashParser.T__34);
				this.state = 2062;
				this.anyIdentifier();
				this.state = 2065;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 2063;
					this.match(SolidCashParser.T__11);
					this.state = 2064;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 2067;
				this.expressionList();
				this.state = 2068;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2070;
				this.match(SolidCashParser.T__34);
				this.state = 2071;
				this.match(SolidCashParser.T__52);
				this.state = 2072;
				this.expression(0);
				this.state = 2073;
				this.match(SolidCashParser.T__53);
				this.state = 2074;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2076;
				this.match(SolidCashParser.T__34);
				this.state = 2077;
				this.match(SolidCashParser.T__52);
				this.state = 2078;
				this.match(SolidCashParser.T__53);
				this.state = 2079;
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
			this.state = 2082;
			this.match(SolidCashParser.T__113);
			this.state = 2083;
			this.match(SolidCashParser.T__52);
			this.state = 2084;
			this.expression(0);
			this.state = 2085;
			this.match(SolidCashParser.T__53);
			this.state = 2086;
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
			this.state = 2090;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 180:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2088;
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
				this.state = 2089;
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
			this.state = 2092;
			this.match(SolidCashParser.T__52);
			this.state = 2104;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 3152921) !== 0) || _la===180) {
				{
				this.state = 2093;
				this.consoleParameter();
				this.state = 2098;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 253, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2094;
						this.match(SolidCashParser.T__4);
						this.state = 2095;
						this.consoleParameter();
						}
						}
					}
					this.state = 2100;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 253, this._ctx);
				}
				this.state = 2102;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2101;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2106;
			this.match(SolidCashParser.T__53);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 2142;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 259, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2108;
				this.match(SolidCashParser.Identifier);
				this.state = 2109;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2110;
				this.match(SolidCashParser.Identifier);
				this.state = 2111;
				this.match(SolidCashParser.T__11);
				this.state = 2112;
				this.match(SolidCashParser.Identifier);
				this.state = 2113;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2114;
				this.match(SolidCashParser.Identifier);
				this.state = 2115;
				this.match(SolidCashParser.T__52);
				this.state = 2116;
				this.match(SolidCashParser.T__3);
				this.state = 2128;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2117;
					this.namedArg();
					this.state = 2122;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 256, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2118;
							this.match(SolidCashParser.T__4);
							this.state = 2119;
							this.namedArg();
							}
							}
						}
						this.state = 2124;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 256, this._ctx);
					}
					this.state = 2126;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2125;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2130;
				this.match(SolidCashParser.T__5);
				this.state = 2131;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2132;
				this.match(SolidCashParser.T__52);
				this.state = 2133;
				this.match(SolidCashParser.Identifier);
				this.state = 2134;
				this.match(SolidCashParser.T__53);
				this.state = 2135;
				this.expressionList();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2136;
				this.match(SolidCashParser.T__52);
				this.state = 2137;
				this.match(SolidCashParser.Identifier);
				this.state = 2138;
				this.match(SolidCashParser.T__11);
				this.state = 2139;
				this.match(SolidCashParser.Identifier);
				this.state = 2140;
				this.match(SolidCashParser.T__53);
				this.state = 2141;
				this.expressionList();
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
			this.state = 2144;
			this.match(SolidCashParser.Identifier);
			this.state = 2145;
			this.match(SolidCashParser.T__110);
			this.state = 2146;
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
			this.state = 2148;
			this.match(SolidCashParser.T__52);
			this.state = 2160;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073676297) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 33857) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 3766485027) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 4272948735) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				this.state = 2149;
				this.expression(0);
				this.state = 2154;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 260, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2150;
						this.match(SolidCashParser.T__4);
						this.state = 2151;
						this.expression(0);
						}
						}
					}
					this.state = 2156;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 260, this._ctx);
				}
				this.state = 2158;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2157;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2162;
			this.match(SolidCashParser.T__53);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 2164;
			this.match(SolidCashParser.T__3);
			this.state = 2165;
			this.callOption();
			this.state = 2170;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 263, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2166;
					this.match(SolidCashParser.T__4);
					this.state = 2167;
					this.callOption();
					}
					}
				}
				this.state = 2172;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 263, this._ctx);
			}
			this.state = 2174;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2173;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 2176;
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
			this.state = 2178;
			this.match(SolidCashParser.Identifier);
			this.state = 2179;
			this.match(SolidCashParser.T__110);
			this.state = 2180;
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
			this.state = 2182;
			this.match(SolidCashParser.T__52);
			this.state = 2183;
			this.typeListItem();
			this.state = 2188;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 265, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2184;
					this.match(SolidCashParser.T__4);
					this.state = 2185;
					this.typeListItem();
					}
					}
				}
				this.state = 2190;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 265, this._ctx);
			}
			this.state = 2192;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2191;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 2194;
			this.match(SolidCashParser.T__53);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 2198;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 267, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2196;
				this.typeName();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2197;
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
			this.state = 2378;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 277, this._ctx) ) {
			case 1:
				{
				localctx = new AssignmentExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 2201;
				this.match(SolidCashParser.T__52);
				this.state = 2202;
				this.match(SolidCashParser.Identifier);
				this.state = 2203;
				(localctx as AssignmentExpressionContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
				    (localctx as AssignmentExpressionContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2204;
				this.expression(0);
				this.state = 2205;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 2:
				{
				localctx = new InstantiationWithOptionsContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2207;
				this.match(SolidCashParser.T__52);
				this.state = 2208;
				this.match(SolidCashParser.T__114);
				this.state = 2209;
				this.match(SolidCashParser.Identifier);
				this.state = 2210;
				this.match(SolidCashParser.T__53);
				this.state = 2211;
				this.callOptions();
				this.state = 2212;
				this.expressionList();
				}
				break;
			case 3:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2214;
				this.match(SolidCashParser.T__52);
				this.state = 2215;
				this.expression(0);
				this.state = 2216;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 4:
				{
				localctx = new TupleExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2218;
				this.match(SolidCashParser.T__52);
				this.state = 2219;
				this.expression(0);
				this.state = 2222;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2220;
					this.match(SolidCashParser.T__4);
					this.state = 2221;
					this.expression(0);
					}
					}
					this.state = 2224;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2226;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 5:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2228;
				this.typeCast();
				this.state = 2229;
				this.match(SolidCashParser.T__52);
				this.state = 2230;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 2232;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2231;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 2234;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 6:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2236;
				this.functionCall();
				}
				break;
			case 7:
				{
				localctx = new ParenthesizedFunctionCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2237;
				this.match(SolidCashParser.T__52);
				this.state = 2238;
				this.expression(0);
				this.state = 2239;
				this.match(SolidCashParser.T__53);
				this.state = 2240;
				this.expressionList();
				}
				break;
			case 8:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2242;
				this.match(SolidCashParser.T__114);
				this.state = 2243;
				this.match(SolidCashParser.Identifier);
				this.state = 2245;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 2244;
					this.callOptions();
					}
				}

				this.state = 2247;
				this.expressionList();
				}
				break;
			case 9:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2248;
				this.match(SolidCashParser.T__114);
				this.state = 2249;
				this.typeName();
				this.state = 2255;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2250;
					this.match(SolidCashParser.T__67);
					this.state = 2252;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===145) {
						{
						this.state = 2251;
						this.match(SolidCashParser.NumberLiteral);
						}
					}

					this.state = 2254;
					this.match(SolidCashParser.T__68);
					}
					}
					this.state = 2257;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===68);
				this.state = 2259;
				this.match(SolidCashParser.T__52);
				this.state = 2260;
				this.expression(0);
				this.state = 2261;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 10:
				{
				localctx = new NewDynamicBytesContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2263;
				this.match(SolidCashParser.T__114);
				this.state = 2264;
				this.match(SolidCashParser.UnboundedBytes);
				this.state = 2265;
				this.match(SolidCashParser.T__52);
				this.state = 2266;
				this.expression(0);
				this.state = 2267;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 11:
				{
				localctx = new NewDynamicStringContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2269;
				this.match(SolidCashParser.T__114);
				this.state = 2270;
				this.match(SolidCashParser.PrimitiveType);
				this.state = 2271;
				this.match(SolidCashParser.T__52);
				this.state = 2272;
				this.expression(0);
				this.state = 2273;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 12:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2275;
				this.match(SolidCashParser.T__58);
				this.state = 2276;
				this.match(SolidCashParser.T__52);
				this.state = 2277;
				this.typeName();
				this.state = 2278;
				this.match(SolidCashParser.T__53);
				this.state = 2279;
				this.match(SolidCashParser.T__11);
				this.state = 2280;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 13:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2282;
				this.match(SolidCashParser.T__115);
				this.state = 2283;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2284;
				this.match(SolidCashParser.T__116);
				this.state = 2285;
				this.expressionList();
				}
				break;
			case 15:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2286;
				this.match(SolidCashParser.T__117);
				this.state = 2287;
				this.expressionList();
				}
				break;
			case 16:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2288;
				this.match(SolidCashParser.T__118);
				this.state = 2289;
				this.expressionList();
				}
				break;
			case 17:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2290;
				this.match(SolidCashParser.T__119);
				this.state = 2291;
				this.match(SolidCashParser.T__52);
				this.state = 2292;
				_la = this._input.LA(1);
				if(!(_la===91 || _la===180)) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2293;
				this.match(SolidCashParser.T__11);
				this.state = 2294;
				this.match(SolidCashParser.Identifier);
				this.state = 2295;
				this.match(SolidCashParser.T__4);
				this.state = 2296;
				this.expressionList();
				this.state = 2297;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 18:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2299;
				this.match(SolidCashParser.T__120);
				this.state = 2300;
				this.expressionList();
				}
				break;
			case 19:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2301;
				this.match(SolidCashParser.T__121);
				this.state = 2302;
				this.expressionList();
				}
				break;
			case 20:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2303;
				this.match(SolidCashParser.T__122);
				this.state = 2304;
				this.match(SolidCashParser.T__52);
				this.state = 2305;
				this.expression(0);
				this.state = 2306;
				this.match(SolidCashParser.T__4);
				this.state = 2307;
				this.typeList();
				this.state = 2308;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 21:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2310;
				this.match(SolidCashParser.T__123);
				this.state = 2311;
				this.match(SolidCashParser.T__52);
				this.state = 2312;
				this.expression(0);
				this.state = 2313;
				this.match(SolidCashParser.T__4);
				this.state = 2314;
				this.typeList();
				this.state = 2315;
				this.match(SolidCashParser.T__4);
				this.state = 2316;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 2317;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 22:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2319;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__124);
				this.state = 2320;
				this.match(SolidCashParser.T__67);
				this.state = 2321;
				this.expression(0);
				this.state = 2322;
				this.match(SolidCashParser.T__68);
				this.state = 2323;
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
			case 23:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2325;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__125);
				this.state = 2326;
				this.match(SolidCashParser.T__67);
				this.state = 2327;
				this.expression(0);
				this.state = 2328;
				this.match(SolidCashParser.T__68);
				this.state = 2329;
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
			case 24:
				{
				localctx = new PrefixOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2331;
				(localctx as PrefixOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===86 || _la===87)) {
				    (localctx as PrefixOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2332;
				this.expression(22);
				}
				break;
			case 25:
				{
				localctx = new UnaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2333;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===128)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2334;
				this.expression(21);
				}
				break;
			case 26:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2335;
				this.match(SolidCashParser.T__67);
				this.state = 2347;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073676297) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 33857) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 3766485027) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 4272948735) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
					{
					this.state = 2336;
					this.expression(0);
					this.state = 2341;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 273, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2337;
							this.match(SolidCashParser.T__4);
							this.state = 2338;
							this.expression(0);
							}
							}
						}
						this.state = 2343;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 273, this._ctx);
					}
					this.state = 2345;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2344;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2349;
				this.match(SolidCashParser.T__68);
				}
				break;
			case 27:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2350;
				this.match(SolidCashParser.T__90);
				this.state = 2351;
				this.match(SolidCashParser.T__11);
				this.state = 2352;
				this.match(SolidCashParser.Identifier);
				this.state = 2353;
				this.match(SolidCashParser.T__11);
				this.state = 2354;
				this.match(SolidCashParser.Identifier);
				this.state = 2355;
				this.match(SolidCashParser.T__67);
				this.state = 2356;
				this.expression(0);
				this.state = 2357;
				this.match(SolidCashParser.T__68);
				this.state = 2358;
				this.memberName();
				}
				break;
			case 28:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2360;
				this.match(SolidCashParser.T__90);
				this.state = 2361;
				this.match(SolidCashParser.T__11);
				this.state = 2362;
				this.match(SolidCashParser.Identifier);
				this.state = 2367;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2363;
						this.match(SolidCashParser.T__67);
						this.state = 2364;
						this.expression(0);
						this.state = 2365;
						this.match(SolidCashParser.T__68);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2369;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 276, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 29:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2371;
				this.match(SolidCashParser.T__90);
				this.state = 2372;
				this.match(SolidCashParser.T__11);
				this.state = 2373;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 30:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2374;
				this.match(SolidCashParser.T__90);
				}
				break;
			case 31:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2375;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 32:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2376;
				this.anyIdentifier();
				}
				break;
			case 33:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2377;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2516;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 289, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2514;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 288, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2380;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 2381;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 2382;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2383;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 2384;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2385;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2386;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 2387;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2388;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2389;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 2390;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===129 || _la===130)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2391;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2392;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 2393;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2394;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2395;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2396;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2397;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2398;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2399;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2400;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2401;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2402;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2403;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2404;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2405;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2406;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2407;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2408;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__130);
						this.state = 2409;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2410;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2411;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__131);
						this.state = 2412;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2413;
						if (!(this.precpred(this._ctx, 36))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 36)");
						}
						this.state = 2414;
						this.match(SolidCashParser.T__67);
						this.state = 2416;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073676297) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 33857) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 3766485027) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 4272948735) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
							{
							this.state = 2415;
							(localctx as IndexRangeSliceContext)._start = this.expression(0);
							}
						}

						this.state = 2418;
						this.match(SolidCashParser.T__110);
						this.state = 2420;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073676297) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 33857) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 3766485027) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 4272948735) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
							{
							this.state = 2419;
							(localctx as IndexRangeSliceContext)._end = this.expression(0);
							}
						}

						this.state = 2422;
						this.match(SolidCashParser.T__68);
						}
						break;
					case 13:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2423;
						if (!(this.precpred(this._ctx, 35))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 35)");
						}
						this.state = 2424;
						this.match(SolidCashParser.T__67);
						this.state = 2425;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2426;
						this.match(SolidCashParser.T__68);
						}
						break;
					case 14:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2427;
						if (!(this.precpred(this._ctx, 34))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 34)");
						}
						this.state = 2428;
						this.match(SolidCashParser.T__67);
						this.state = 2429;
						this.expression(0);
						this.state = 2430;
						this.match(SolidCashParser.T__68);
						}
						break;
					case 15:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2432;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 2433;
						(localctx as UnaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===127 || _la===164)) {
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
						this.state = 2434;
						if (!(this.precpred(this._ctx, 30))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 30)");
						}
						this.state = 2435;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.DotSplit);
						this.state = 2436;
						this.match(SolidCashParser.T__52);
						this.state = 2437;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2438;
						this.match(SolidCashParser.T__53);
						}
						break;
					case 17:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2440;
						if (!(this.precpred(this._ctx, 29))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 29)");
						}
						this.state = 2441;
						this.match(SolidCashParser.DotSlice);
						this.state = 2442;
						this.match(SolidCashParser.T__52);
						this.state = 2443;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2444;
						this.match(SolidCashParser.T__4);
						this.state = 2445;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2446;
						this.match(SolidCashParser.T__53);
						}
						break;
					case 18:
						{
						localctx = new LegacyCallOptionCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2448;
						if (!(this.precpred(this._ctx, 28))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 28)");
						}
						this.state = 2449;
						this.match(SolidCashParser.T__11);
						this.state = 2450;
						this.match(SolidCashParser.Identifier);
						this.state = 2454;
						this._errHandler.sync(this);
						switch (this._input.LA(1)) {
						case 12:
							{
							this.state = 2451;
							this.match(SolidCashParser.T__11);
							this.state = 2452;
							this.match(SolidCashParser.Identifier);
							}
							break;
						case 163:
							{
							this.state = 2453;
							this.match(SolidCashParser.DotValue);
							}
							break;
						default:
							throw new NoViableAltException(this);
						}
						this.state = 2456;
						this.match(SolidCashParser.T__52);
						this.state = 2457;
						this.expression(0);
						this.state = 2458;
						this.match(SolidCashParser.T__53);
						this.state = 2459;
						this.expressionList();
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2461;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2462;
						this.match(SolidCashParser.T__11);
						this.state = 2463;
						this.match(SolidCashParser.Identifier);
						this.state = 2465;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2464;
							this.callOptions();
							}
						}

						this.state = 2467;
						this.match(SolidCashParser.T__52);
						this.state = 2468;
						this.match(SolidCashParser.T__3);
						this.state = 2480;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===180) {
							{
							this.state = 2469;
							this.namedArg();
							this.state = 2474;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 282, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2470;
									this.match(SolidCashParser.T__4);
									this.state = 2471;
									this.namedArg();
									}
									}
								}
								this.state = 2476;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 282, this._ctx);
							}
							this.state = 2478;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2477;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2482;
						this.match(SolidCashParser.T__5);
						this.state = 2483;
						this.match(SolidCashParser.T__53);
						}
						break;
					case 20:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2484;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2485;
						this.match(SolidCashParser.T__11);
						this.state = 2486;
						this.match(SolidCashParser.Identifier);
						this.state = 2488;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2487;
							this.callOptions();
							}
						}

						this.state = 2490;
						this.expressionList();
						}
						break;
					case 21:
						{
						localctx = new IndexedFunctionCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexedFunctionCallContext)._base = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2491;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2492;
						this.match(SolidCashParser.T__67);
						this.state = 2493;
						(localctx as IndexedFunctionCallContext)._index = this.expression(0);
						this.state = 2494;
						this.match(SolidCashParser.T__68);
						this.state = 2495;
						this.expressionList();
						}
						break;
					case 22:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2497;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2498;
						this.memberName();
						}
						break;
					case 23:
						{
						localctx = new PostfixOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2499;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2500;
						(localctx as PostfixOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===86 || _la===87)) {
						    (localctx as PostfixOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						}
						break;
					case 24:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2501;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 2502;
						this.match(SolidCashParser.T__132);
						this.state = 2503;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 2506;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0)) {
							{
							this.state = 2504;
							(localctx as TernaryOpContext)._tOp = this._input.LT(1);
							_la = this._input.LA(1);
							if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
							    (localctx as TernaryOpContext)._tOp = this._errHandler.recoverInline(this);
							}
							else {
								this._errHandler.reportMatch(this);
							    this.consume();
							}
							this.state = 2505;
							(localctx as TernaryOpContext)._tVal = this.assignChain();
							}
						}

						this.state = 2508;
						this.match(SolidCashParser.T__110);
						this.state = 2509;
						(localctx as TernaryOpContext)._ifFalse = this.expression(0);
						this.state = 2512;
						this._errHandler.sync(this);
						switch ( this._interp.adaptivePredict(this._input, 287, this._ctx) ) {
						case 1:
							{
							this.state = 2510;
							(localctx as TernaryOpContext)._fOp = this._input.LT(1);
							_la = this._input.LA(1);
							if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
							    (localctx as TernaryOpContext)._fOp = this._errHandler.recoverInline(this);
							}
							else {
								this._errHandler.reportMatch(this);
							    this.consume();
							}
							this.state = 2511;
							(localctx as TernaryOpContext)._fVal = this.assignChain();
							}
							break;
						}
						}
						break;
					}
					}
				}
				this.state = 2518;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 289, this._ctx);
			}
			}
		}
		catch (re) {
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
			this.state = 2534;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 290, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2519;
				this.match(SolidCashParser.T__11);
				this.state = 2520;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2521;
				this.match(SolidCashParser.T__11);
				this.state = 2522;
				this.match(SolidCashParser.T__108);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2523;
				this.match(SolidCashParser.DotValue);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2524;
				this.match(SolidCashParser.DotLockingBytecode);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2525;
				this.match(SolidCashParser.DotTokenCategory);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2526;
				this.match(SolidCashParser.DotNftCommitment);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2527;
				this.match(SolidCashParser.DotTokenAmount);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2528;
				this.match(SolidCashParser.DotOutpointTransactionHash);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2529;
				this.match(SolidCashParser.DotOutpointIndex);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2530;
				this.match(SolidCashParser.DotUnlockingBytecode);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2531;
				this.match(SolidCashParser.DotSequenceNumber);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2532;
				this.match(SolidCashParser.DotCode);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2533;
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
			this.state = 2536;
			_la = this._input.LA(1);
			if(!(((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 268435473) !== 0) || ((((_la - 134)) & ~0x1F) === 0 && ((1 << (_la - 134)) & 15) !== 0))) {
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
			this.state = 2538;
			_la = this._input.LA(1);
			if(!(((((_la - 134)) & ~0x1F) === 0 && ((1 << (_la - 134)) & 7) !== 0))) {
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
			this.state = 2554;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 141:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2540;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 145:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2541;
				this.numberLiteral();
				}
				break;
			case 144:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2542;
				this.decimalLiteral();
				}
				break;
			case 151:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2543;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2547;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 291, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2544;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2549;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 291, this._ctx);
				}
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2550;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2551;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 152:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2552;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 153:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2553;
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
			this.state = 2556;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2558;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 293, this._ctx) ) {
			case 1:
				{
				this.state = 2557;
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
			this.state = 2560;
			this.match(SolidCashParser.DecimalLiteral);
			this.state = 2562;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 294, this._ctx) ) {
			case 1:
				{
				this.state = 2561;
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
			this.state = 2626;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 304, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2564;
				this.match(SolidCashParser.T__108);
				this.state = 2565;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2566;
				this.match(SolidCashParser.T__108);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2567;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2568;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2569;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2570;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2571;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2572;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2573;
				this.match(SolidCashParser.T__137);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2574;
				this.match(SolidCashParser.T__138);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2575;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2576;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2577;
				this.match(SolidCashParser.T__6);
				this.state = 2578;
				this.match(SolidCashParser.T__52);
				this.state = 2593;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 2579;
					this.typeName();
					this.state = 2581;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (((((_la - 134)) & ~0x1F) === 0 && ((1 << (_la - 134)) & 7) !== 0)) {
						{
						this.state = 2580;
						this.dataLocation();
						}
					}

					this.state = 2590;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2583;
						this.match(SolidCashParser.T__4);
						this.state = 2584;
						this.typeName();
						this.state = 2586;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (((((_la - 134)) & ~0x1F) === 0 && ((1 << (_la - 134)) & 7) !== 0)) {
							{
							this.state = 2585;
							this.dataLocation();
							}
						}

						}
						}
						this.state = 2592;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2595;
				this.match(SolidCashParser.T__53);
				this.state = 2599;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 299, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2596;
						_la = this._input.LA(1);
						if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 50380801) !== 0))) {
						this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						}
						}
					}
					this.state = 2601;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 299, this._ctx);
				}
				this.state = 2620;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===75) {
					{
					this.state = 2602;
					this.match(SolidCashParser.T__74);
					this.state = 2603;
					this.match(SolidCashParser.T__52);
					this.state = 2604;
					this.typeName();
					this.state = 2606;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (((((_la - 134)) & ~0x1F) === 0 && ((1 << (_la - 134)) & 7) !== 0)) {
						{
						this.state = 2605;
						this.dataLocation();
						}
					}

					this.state = 2615;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2608;
						this.match(SolidCashParser.T__4);
						this.state = 2609;
						this.typeName();
						this.state = 2611;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (((((_la - 134)) & ~0x1F) === 0 && ((1 << (_la - 134)) & 7) !== 0)) {
							{
							this.state = 2610;
							this.dataLocation();
							}
						}

						}
						}
						this.state = 2617;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2618;
					this.match(SolidCashParser.T__53);
					}
				}

				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2622;
				this.match(SolidCashParser.Identifier);
				this.state = 2623;
				this.match(SolidCashParser.T__11);
				this.state = 2624;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 2625;
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
			this.state = 2628;
			_la = this._input.LA(1);
			if(!(_la===63 || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15887) !== 0))) {
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
			return this.precpred(this._ctx, 36);
		case 13:
			return this.precpred(this._ctx, 35);
		case 14:
			return this.precpred(this._ctx, 34);
		case 15:
			return this.precpred(this._ctx, 31);
		case 16:
			return this.precpred(this._ctx, 30);
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
		case 24:
			return this.precpred(this._ctx, 9);
		}
		return true;
	}

	public static readonly _serializedATN: number[] = [4,1,183,2631,2,0,7,0,
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
	441,8,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,5,13,453,8,13,
	10,13,12,13,456,9,13,1,13,1,13,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,
	1,14,1,14,3,14,470,8,14,1,15,1,15,1,15,1,15,1,15,1,16,1,16,1,17,1,17,1,
	17,1,17,5,17,483,8,17,10,17,12,17,486,9,17,1,17,3,17,489,8,17,1,17,1,17,
	1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,5,18,505,8,
	18,10,18,12,18,508,9,18,1,18,1,18,1,19,3,19,513,8,19,1,19,1,19,1,19,3,19,
	518,8,19,1,19,1,19,1,19,1,19,5,19,524,8,19,10,19,12,19,527,9,19,3,19,529,
	8,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,
	19,1,19,5,19,546,8,19,10,19,12,19,549,9,19,1,19,1,19,1,20,1,20,3,20,555,
	8,20,1,21,1,21,1,21,1,21,1,21,5,21,562,8,21,10,21,12,21,565,9,21,1,21,3,
	21,568,8,21,1,21,1,21,1,22,1,22,1,22,1,22,1,22,1,22,5,22,578,8,22,10,22,
	12,22,581,9,22,1,22,3,22,584,8,22,3,22,586,8,22,1,22,1,22,3,22,590,8,22,
	1,22,1,22,1,23,1,23,3,23,596,8,23,1,23,3,23,599,8,23,1,23,3,23,602,8,23,
	1,24,1,24,1,24,1,24,1,24,1,24,5,24,610,8,24,10,24,12,24,613,9,24,1,24,3,
	24,616,8,24,3,24,618,8,24,1,24,1,24,1,24,1,25,1,25,3,25,625,8,25,1,25,1,
	25,3,25,629,8,25,3,25,631,8,25,1,26,1,26,1,26,1,26,4,26,637,8,26,11,26,
	12,26,638,1,26,1,26,1,27,1,27,1,27,3,27,646,8,27,1,27,1,27,1,27,1,28,1,
	28,1,28,1,28,1,28,1,28,5,28,657,8,28,10,28,12,28,660,9,28,1,28,3,28,663,
	8,28,1,28,1,28,1,29,1,29,1,29,3,29,670,8,29,1,30,1,30,1,30,1,30,1,30,1,
	30,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,32,1,32,1,32,5,32,688,8,32,10,32,
	12,32,691,9,32,1,32,5,32,694,8,32,10,32,12,32,697,9,32,1,32,5,32,700,8,
	32,10,32,12,32,703,9,32,1,32,5,32,706,8,32,10,32,12,32,709,9,32,1,32,1,
	32,5,32,713,8,32,10,32,12,32,716,9,32,1,32,1,32,1,33,1,33,1,33,5,33,723,
	8,33,10,33,12,33,726,9,33,1,33,1,33,5,33,730,8,33,10,33,12,33,733,9,33,
	1,33,5,33,736,8,33,10,33,12,33,739,9,33,1,33,3,33,742,8,33,1,33,1,33,5,
	33,746,8,33,10,33,12,33,749,9,33,1,33,1,33,1,34,1,34,1,34,3,34,756,8,34,
	1,35,1,35,1,35,1,35,5,35,762,8,35,10,35,12,35,765,9,35,1,35,1,35,5,35,769,
	8,35,10,35,12,35,772,9,35,1,35,1,35,5,35,776,8,35,10,35,12,35,779,9,35,
	1,35,1,35,5,35,783,8,35,10,35,12,35,786,9,35,1,35,1,35,3,35,790,8,35,1,
	35,1,35,1,35,1,35,5,35,796,8,35,10,35,12,35,799,9,35,1,35,1,35,5,35,803,
	8,35,10,35,12,35,806,9,35,1,35,1,35,5,35,810,8,35,10,35,12,35,813,9,35,
	1,35,1,35,5,35,817,8,35,10,35,12,35,820,9,35,1,35,1,35,3,35,824,8,35,3,
	35,826,8,35,1,36,1,36,3,36,830,8,36,1,37,1,37,1,37,1,38,3,38,836,8,38,1,
	38,1,38,1,38,5,38,841,8,38,10,38,12,38,844,9,38,1,38,1,38,1,38,3,38,849,
	8,38,1,38,1,38,1,38,1,38,1,38,5,38,856,8,38,10,38,12,38,859,9,38,1,38,1,
	38,1,38,5,38,864,8,38,10,38,12,38,867,9,38,1,38,1,38,1,38,3,38,872,8,38,
	1,38,1,38,1,38,3,38,877,8,38,1,38,3,38,880,8,38,1,38,1,38,5,38,884,8,38,
	10,38,12,38,887,9,38,1,38,1,38,1,38,1,38,3,38,893,8,38,1,38,1,38,5,38,897,
	8,38,10,38,12,38,900,9,38,1,38,1,38,1,38,3,38,905,8,38,1,38,1,38,3,38,909,
	8,38,1,39,1,39,1,39,3,39,914,8,39,1,40,1,40,1,41,1,41,1,41,1,41,3,41,922,
	8,41,1,41,1,41,1,41,3,41,927,8,41,1,41,1,41,1,41,1,41,1,41,1,41,3,41,935,
	8,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,3,41,945,8,41,1,41,1,41,1,
	41,3,41,950,8,41,1,41,1,41,3,41,954,8,41,1,42,1,42,1,42,1,42,3,42,960,8,
	42,1,42,1,42,1,42,1,42,1,42,3,42,967,8,42,1,42,5,42,970,8,42,10,42,12,42,
	973,9,42,1,43,1,43,1,43,3,43,978,8,43,1,43,1,43,5,43,982,8,43,10,43,12,
	43,985,9,43,1,43,1,43,5,43,989,8,43,10,43,12,43,992,9,43,1,43,1,43,3,43,
	996,8,43,1,44,1,44,3,44,1000,8,44,1,45,1,45,1,45,1,46,1,46,1,46,1,46,1,
	46,5,46,1010,8,46,10,46,12,46,1013,9,46,1,46,3,46,1016,8,46,1,46,1,46,5,
	46,1020,8,46,10,46,12,46,1023,9,46,1,46,1,46,1,47,1,47,3,47,1029,8,47,1,
	48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,3,48,1044,
	8,48,1,49,1,49,1,49,1,49,1,49,5,49,1051,8,49,10,49,12,49,1054,9,49,1,49,
	3,49,1057,8,49,1,50,1,50,1,50,1,50,3,50,1063,8,50,1,51,1,51,1,51,1,51,1,
	51,5,51,1070,8,51,10,51,12,51,1073,9,51,1,51,3,51,1076,8,51,1,51,1,51,1,
	52,1,52,5,52,1082,8,52,10,52,12,52,1085,9,52,1,52,3,52,1088,8,52,1,52,1,
	52,5,52,1092,8,52,10,52,12,52,1095,9,52,1,52,3,52,1098,8,52,1,52,1,52,5,
	52,1102,8,52,10,52,12,52,1105,9,52,1,52,3,52,1108,8,52,3,52,1110,8,52,1,
	53,1,53,1,53,1,53,5,53,1116,8,53,10,53,12,53,1119,9,53,1,53,3,53,1122,8,
	53,3,53,1124,8,53,1,53,1,53,1,54,1,54,5,54,1130,8,54,10,54,12,54,1133,9,
	54,1,54,3,54,1136,8,54,1,54,1,54,5,54,1140,8,54,10,54,12,54,1143,9,54,1,
	54,3,54,1146,8,54,1,54,1,54,5,54,1150,8,54,10,54,12,54,1153,9,54,1,54,3,
	54,1156,8,54,3,54,1158,8,54,1,55,1,55,5,55,1162,8,55,10,55,12,55,1165,9,
	55,1,55,1,55,3,55,1169,8,55,1,56,1,56,5,56,1173,8,56,10,56,12,56,1176,9,
	56,1,56,1,56,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,
	1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,3,57,1203,8,57,1,
	58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,
	1,58,1,58,3,58,1222,8,58,3,58,1224,8,58,1,58,1,58,1,58,1,58,1,58,1,58,3,
	58,1232,8,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,
	3,58,1246,8,58,3,58,1248,8,58,1,58,1,58,1,58,3,58,1253,8,58,1,58,1,58,1,
	58,1,58,1,58,1,58,1,58,1,58,1,58,3,58,1264,8,58,1,58,1,58,1,59,1,59,1,59,
	3,59,1271,8,59,1,60,1,60,1,60,1,60,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,
	61,1,61,1,61,1,61,1,61,5,61,1289,8,61,10,61,12,61,1292,9,61,1,61,1,61,1,
	61,1,61,1,61,1,61,1,61,5,61,1301,8,61,10,61,12,61,1304,9,61,1,61,3,61,1307,
	8,61,1,61,1,61,1,61,3,61,1312,8,61,1,62,1,62,1,62,1,62,1,62,1,62,1,63,1,
	63,1,63,1,63,3,63,1324,8,63,1,63,1,63,1,63,1,63,1,63,5,63,1331,8,63,10,
	63,12,63,1334,9,63,1,63,3,63,1337,8,63,3,63,1339,8,63,1,63,1,63,1,63,1,
	63,1,63,1,63,1,63,3,63,1348,8,63,1,63,1,63,1,63,3,63,1353,8,63,1,64,1,64,
	5,64,1357,8,64,10,64,12,64,1360,9,64,1,64,1,64,1,64,1,64,1,64,1,64,1,64,
	1,64,3,64,1370,8,64,3,64,1372,8,64,1,64,1,64,1,64,1,64,5,64,1378,8,64,10,
	64,12,64,1381,9,64,1,64,1,64,1,64,1,64,1,64,1,64,3,64,1389,8,64,3,64,1391,
	8,64,1,64,1,64,1,64,1,64,5,64,1397,8,64,10,64,12,64,1400,9,64,1,64,1,64,
	1,64,3,64,1405,8,64,1,64,1,64,3,64,1409,8,64,1,65,1,65,1,65,1,65,1,65,1,
	65,4,65,1417,8,65,11,65,12,65,1418,1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,
	65,4,65,1429,8,65,11,65,12,65,1430,1,65,1,65,1,65,1,65,1,65,1,65,4,65,1439,
	8,65,11,65,12,65,1440,1,65,1,65,1,65,1,65,1,65,1,65,1,65,4,65,1450,8,65,
	11,65,12,65,1451,1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,65,5,65,1462,8,65,
	10,65,12,65,1465,9,65,1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,65,5,65,
	1476,8,65,10,65,12,65,1479,9,65,1,65,1,65,1,65,1,65,1,65,1,65,3,65,1487,
	8,65,1,66,1,66,5,66,1491,8,66,10,66,12,66,1494,9,66,1,66,1,66,1,66,1,66,
	5,66,1500,8,66,10,66,12,66,1503,9,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,
	1,66,1,66,5,66,1514,8,66,10,66,12,66,1517,9,66,1,66,3,66,1520,8,66,1,67,
	1,67,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,
	68,1,68,1,68,4,68,1540,8,68,11,68,12,68,1541,1,68,1,68,1,68,1,68,1,68,1,
	68,1,68,1,68,4,68,1552,8,68,11,68,12,68,1553,1,68,1,68,1,68,1,68,1,68,1,
	68,4,68,1562,8,68,11,68,12,68,1563,1,68,1,68,1,68,1,68,4,68,1570,8,68,11,
	68,12,68,1571,1,68,1,68,1,68,1,68,1,68,1,68,4,68,1580,8,68,11,68,12,68,
	1581,1,68,3,68,1585,8,68,1,69,1,69,1,69,1,69,1,69,1,69,1,69,3,69,1594,8,
	69,1,69,1,69,1,69,1,70,1,70,1,70,1,70,1,70,3,70,1604,8,70,1,70,1,70,1,70,
	1,71,1,71,1,71,1,71,1,71,1,71,1,71,3,71,1616,8,71,1,72,1,72,1,72,1,72,1,
	72,1,72,3,72,1624,8,72,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,
	1,73,1,73,1,73,1,73,1,73,1,73,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,
	74,1,74,1,74,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,76,
	1,76,1,76,1,76,1,76,3,76,1669,8,76,1,76,1,76,1,76,1,77,1,77,5,77,1676,8,
	77,10,77,12,77,1679,9,77,1,77,1,77,1,77,3,77,1684,8,77,1,77,1,77,1,77,1,
	77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,4,77,1697,8,77,11,77,12,77,1698,1,
	77,1,77,1,77,1,77,1,77,1,77,4,77,1707,8,77,11,77,12,77,1708,1,77,1,77,1,
	77,3,77,1714,8,77,1,77,1,77,1,77,3,77,1719,8,77,1,78,3,78,1722,8,78,1,78,
	1,78,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,4,79,1737,8,
	79,11,79,12,79,1738,1,79,1,79,1,79,1,79,1,79,1,79,4,79,1747,8,79,11,79,
	12,79,1748,1,79,1,79,1,79,3,79,1754,8,79,3,79,1756,8,79,1,80,1,80,1,80,
	1,80,1,80,1,80,1,80,1,80,1,81,1,81,1,81,1,81,1,81,1,81,1,82,1,82,1,82,1,
	82,1,83,1,83,3,83,1778,8,83,1,83,1,83,1,83,1,83,5,83,1784,8,83,10,83,12,
	83,1787,9,83,1,83,3,83,1790,8,83,1,83,1,83,1,84,1,84,5,84,1796,8,84,10,
	84,12,84,1799,9,84,1,84,1,84,1,85,1,85,1,85,1,85,1,85,1,85,1,85,1,85,1,
	85,1,85,1,85,1,85,1,85,3,85,1816,8,85,1,86,1,86,1,86,1,86,5,86,1822,8,86,
	10,86,12,86,1825,9,86,1,86,1,86,3,86,1829,8,86,1,87,1,87,1,87,5,87,1834,
	8,87,10,87,12,87,1837,9,87,1,87,1,87,1,87,1,88,1,88,1,88,1,88,1,89,1,89,
	1,89,4,89,1849,8,89,11,89,12,89,1850,1,89,3,89,1854,8,89,1,89,3,89,1857,
	8,89,1,90,1,90,1,90,1,90,1,91,1,91,1,91,1,92,1,92,1,92,1,92,1,92,1,92,1,
	93,1,93,1,93,1,93,1,93,1,93,5,93,1878,8,93,10,93,12,93,1881,9,93,3,93,1883,
	8,93,1,93,1,93,1,93,1,93,1,93,5,93,1890,8,93,10,93,12,93,1893,9,93,3,93,
	1895,8,93,1,93,1,93,1,94,1,94,1,94,3,94,1902,8,94,1,95,1,95,1,95,1,95,1,
	95,5,95,1909,8,95,10,95,12,95,1912,9,95,3,95,1914,8,95,1,95,1,95,1,96,1,
	96,1,97,1,97,1,97,1,97,5,97,1924,8,97,10,97,12,97,1927,9,97,1,98,1,98,1,
	99,1,99,1,99,5,99,1934,8,99,10,99,12,99,1937,9,99,1,99,1,99,1,100,1,100,
	1,100,1,100,1,100,1,100,5,100,1947,8,100,10,100,12,100,1950,9,100,1,100,
	3,100,1953,8,100,1,100,1,100,1,101,1,101,1,101,1,101,5,101,1961,8,101,10,
	101,12,101,1964,9,101,1,102,1,102,1,102,5,102,1969,8,102,10,102,12,102,
	1972,9,102,1,103,1,103,1,103,3,103,1977,8,103,1,103,1,103,4,103,1981,8,
	103,11,103,12,103,1982,1,104,1,104,1,104,1,104,1,104,5,104,1990,8,104,10,
	104,12,104,1993,9,104,1,104,3,104,1996,8,104,3,104,1998,8,104,1,104,1,104,
	1,105,1,105,3,105,2004,8,105,1,105,1,105,1,105,1,105,5,105,2010,8,105,10,
	105,12,105,2013,9,105,1,105,3,105,2016,8,105,3,105,2018,8,105,1,105,3,105,
	2021,8,105,1,105,1,105,1,106,1,106,1,106,1,107,1,107,1,107,1,108,1,108,
	1,108,1,108,3,108,2035,8,108,1,109,1,109,1,109,1,109,3,109,2041,8,109,1,
	109,1,109,1,109,1,109,1,109,5,109,2048,8,109,10,109,12,109,2051,9,109,1,
	109,3,109,2054,8,109,3,109,2056,8,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,3,109,2066,8,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,1,109,3,109,2081,8,109,1,110,1,110,1,110,
	1,110,1,110,1,110,1,111,1,111,3,111,2091,8,111,1,112,1,112,1,112,1,112,
	5,112,2097,8,112,10,112,12,112,2100,9,112,1,112,3,112,2103,8,112,3,112,
	2105,8,112,1,112,1,112,1,113,1,113,1,113,1,113,1,113,1,113,1,113,1,113,
	1,113,1,113,1,113,1,113,5,113,2121,8,113,10,113,12,113,2124,9,113,1,113,
	3,113,2127,8,113,3,113,2129,8,113,1,113,1,113,1,113,1,113,1,113,1,113,1,
	113,1,113,1,113,1,113,1,113,1,113,3,113,2143,8,113,1,114,1,114,1,114,1,
	114,1,115,1,115,1,115,1,115,5,115,2153,8,115,10,115,12,115,2156,9,115,1,
	115,3,115,2159,8,115,3,115,2161,8,115,1,115,1,115,1,116,1,116,1,116,1,116,
	5,116,2169,8,116,10,116,12,116,2172,9,116,1,116,3,116,2175,8,116,1,116,
	1,116,1,117,1,117,1,117,1,117,1,118,1,118,1,118,1,118,5,118,2187,8,118,
	10,118,12,118,2190,9,118,1,118,3,118,2193,8,118,1,118,1,118,1,119,1,119,
	3,119,2199,8,119,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,4,120,2223,8,120,11,120,12,120,2224,1,120,1,120,1,120,1,120,1,120,
	1,120,3,120,2233,8,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,3,120,2246,8,120,1,120,1,120,1,120,1,120,1,120,3,120,
	2253,8,120,1,120,4,120,2256,8,120,11,120,12,120,2257,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,5,120,2340,8,120,10,120,12,120,2343,9,120,
	1,120,3,120,2346,8,120,3,120,2348,8,120,1,120,1,120,1,120,1,120,1,120,1,
	120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,
	120,4,120,2368,8,120,11,120,12,120,2369,1,120,1,120,1,120,1,120,1,120,1,
	120,1,120,3,120,2379,8,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,
	120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,
	120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,
	120,1,120,1,120,1,120,1,120,3,120,2417,8,120,1,120,1,120,3,120,2421,8,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,3,120,2455,8,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,3,120,2466,8,120,1,120,
	1,120,1,120,1,120,1,120,5,120,2473,8,120,10,120,12,120,2476,9,120,1,120,
	3,120,2479,8,120,3,120,2481,8,120,1,120,1,120,1,120,1,120,1,120,1,120,3,
	120,2489,8,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,
	120,1,120,1,120,1,120,1,120,1,120,1,120,3,120,2507,8,120,1,120,1,120,1,
	120,1,120,3,120,2513,8,120,5,120,2515,8,120,10,120,12,120,2518,9,120,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,
	121,1,121,1,121,3,121,2535,8,121,1,122,1,122,1,123,1,123,1,124,1,124,1,
	124,1,124,1,124,5,124,2546,8,124,10,124,12,124,2549,9,124,1,124,1,124,1,
	124,1,124,3,124,2555,8,124,1,125,1,125,3,125,2559,8,125,1,126,1,126,3,126,
	2563,8,126,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,3,127,2582,8,127,1,127,1,127,
	1,127,3,127,2587,8,127,5,127,2589,8,127,10,127,12,127,2592,9,127,3,127,
	2594,8,127,1,127,1,127,5,127,2598,8,127,10,127,12,127,2601,9,127,1,127,
	1,127,1,127,1,127,3,127,2607,8,127,1,127,1,127,1,127,3,127,2612,8,127,5,
	127,2614,8,127,10,127,12,127,2617,9,127,1,127,1,127,3,127,2621,8,127,1,
	127,1,127,1,127,1,127,3,127,2627,8,127,1,128,1,128,1,128,0,2,84,240,129,
	0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,
	52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,
	100,102,104,106,108,110,112,114,116,118,120,122,124,126,128,130,132,134,
	136,138,140,142,144,146,148,150,152,154,156,158,160,162,164,166,168,170,
	172,174,176,178,180,182,184,186,188,190,192,194,196,198,200,202,204,206,
	208,210,212,214,216,218,220,222,224,226,228,230,232,234,236,238,240,242,
	244,246,248,250,252,254,256,0,28,2,0,10,10,13,27,5,0,11,11,28,40,143,143,
	147,147,180,180,5,0,42,42,140,140,145,145,151,151,180,180,1,0,42,43,2,0,
	140,140,144,144,3,0,20,23,26,27,44,44,1,0,47,48,2,0,47,48,62,63,3,0,47,
	48,62,62,65,65,2,0,44,44,76,85,1,0,86,87,6,0,30,30,35,35,88,88,109,109,
	149,149,180,180,5,0,141,141,145,145,151,151,153,153,162,162,2,0,91,91,180,
	180,2,0,163,163,172,175,2,0,163,163,172,179,3,0,14,14,27,27,128,128,2,0,
	10,10,15,16,1,0,13,14,1,0,129,130,1,0,20,23,1,0,18,19,2,0,127,127,164,164,
	4,0,32,32,36,36,60,60,134,137,1,0,134,136,1,0,142,143,3,0,48,48,62,63,72,
	73,5,0,63,63,109,109,138,139,146,149,155,159,3014,0,261,1,0,0,0,2,314,1,
	0,0,0,4,316,1,0,0,0,6,321,1,0,0,0,8,381,1,0,0,0,10,383,1,0,0,0,12,392,1,
	0,0,0,14,394,1,0,0,0,16,410,1,0,0,0,18,412,1,0,0,0,20,420,1,0,0,0,22,423,
	1,0,0,0,24,427,1,0,0,0,26,429,1,0,0,0,28,469,1,0,0,0,30,471,1,0,0,0,32,
	476,1,0,0,0,34,478,1,0,0,0,36,492,1,0,0,0,38,512,1,0,0,0,40,552,1,0,0,0,
	42,556,1,0,0,0,44,571,1,0,0,0,46,595,1,0,0,0,48,603,1,0,0,0,50,630,1,0,
	0,0,52,632,1,0,0,0,54,645,1,0,0,0,56,650,1,0,0,0,58,666,1,0,0,0,60,671,
	1,0,0,0,62,677,1,0,0,0,64,684,1,0,0,0,66,719,1,0,0,0,68,755,1,0,0,0,70,
	825,1,0,0,0,72,829,1,0,0,0,74,831,1,0,0,0,76,908,1,0,0,0,78,913,1,0,0,0,
	80,915,1,0,0,0,82,953,1,0,0,0,84,955,1,0,0,0,86,974,1,0,0,0,88,999,1,0,
	0,0,90,1001,1,0,0,0,92,1004,1,0,0,0,94,1026,1,0,0,0,96,1043,1,0,0,0,98,
	1045,1,0,0,0,100,1058,1,0,0,0,102,1064,1,0,0,0,104,1109,1,0,0,0,106,1111,
	1,0,0,0,108,1157,1,0,0,0,110,1168,1,0,0,0,112,1170,1,0,0,0,114,1202,1,0,
	0,0,116,1204,1,0,0,0,118,1267,1,0,0,0,120,1272,1,0,0,0,122,1311,1,0,0,0,
	124,1313,1,0,0,0,126,1352,1,0,0,0,128,1408,1,0,0,0,130,1486,1,0,0,0,132,
	1519,1,0,0,0,134,1521,1,0,0,0,136,1584,1,0,0,0,138,1586,1,0,0,0,140,1598,
	1,0,0,0,142,1608,1,0,0,0,144,1623,1,0,0,0,146,1625,1,0,0,0,148,1641,1,0,
	0,0,150,1652,1,0,0,0,152,1663,1,0,0,0,154,1718,1,0,0,0,156,1721,1,0,0,0,
	158,1755,1,0,0,0,160,1757,1,0,0,0,162,1765,1,0,0,0,164,1771,1,0,0,0,166,
	1775,1,0,0,0,168,1793,1,0,0,0,170,1815,1,0,0,0,172,1817,1,0,0,0,174,1830,
	1,0,0,0,176,1841,1,0,0,0,178,1845,1,0,0,0,180,1858,1,0,0,0,182,1862,1,0,
	0,0,184,1865,1,0,0,0,186,1871,1,0,0,0,188,1901,1,0,0,0,190,1903,1,0,0,0,
	192,1917,1,0,0,0,194,1919,1,0,0,0,196,1928,1,0,0,0,198,1930,1,0,0,0,200,
	1940,1,0,0,0,202,1956,1,0,0,0,204,1965,1,0,0,0,206,1973,1,0,0,0,208,1984,
	1,0,0,0,210,2001,1,0,0,0,212,2024,1,0,0,0,214,2027,1,0,0,0,216,2034,1,0,
	0,0,218,2080,1,0,0,0,220,2082,1,0,0,0,222,2090,1,0,0,0,224,2092,1,0,0,0,
	226,2142,1,0,0,0,228,2144,1,0,0,0,230,2148,1,0,0,0,232,2164,1,0,0,0,234,
	2178,1,0,0,0,236,2182,1,0,0,0,238,2198,1,0,0,0,240,2378,1,0,0,0,242,2534,
	1,0,0,0,244,2536,1,0,0,0,246,2538,1,0,0,0,248,2554,1,0,0,0,250,2556,1,0,
	0,0,252,2560,1,0,0,0,254,2626,1,0,0,0,256,2628,1,0,0,0,258,260,3,16,8,0,
	259,258,1,0,0,0,260,263,1,0,0,0,261,259,1,0,0,0,261,262,1,0,0,0,262,267,
	1,0,0,0,263,261,1,0,0,0,264,266,3,2,1,0,265,264,1,0,0,0,266,269,1,0,0,0,
	267,265,1,0,0,0,267,268,1,0,0,0,268,283,1,0,0,0,269,267,1,0,0,0,270,282,
	3,62,31,0,271,282,3,56,28,0,272,282,3,52,26,0,273,282,3,60,30,0,274,282,
	3,8,4,0,275,282,3,48,24,0,276,282,3,44,22,0,277,282,3,26,13,0,278,282,3,
	6,3,0,279,282,3,36,18,0,280,282,3,38,19,0,281,270,1,0,0,0,281,271,1,0,0,
	0,281,272,1,0,0,0,281,273,1,0,0,0,281,274,1,0,0,0,281,275,1,0,0,0,281,276,
	1,0,0,0,281,277,1,0,0,0,281,278,1,0,0,0,281,279,1,0,0,0,281,280,1,0,0,0,
	282,285,1,0,0,0,283,281,1,0,0,0,283,284,1,0,0,0,284,286,1,0,0,0,285,283,
	1,0,0,0,286,287,5,0,0,1,287,1,1,0,0,0,288,289,5,1,0,0,289,290,5,151,0,0,
	290,315,5,2,0,0,291,292,5,1,0,0,292,293,5,151,0,0,293,294,5,3,0,0,294,295,
	5,180,0,0,295,315,5,2,0,0,296,297,5,1,0,0,297,298,5,4,0,0,298,303,3,4,2,
	0,299,300,5,5,0,0,300,302,3,4,2,0,301,299,1,0,0,0,302,305,1,0,0,0,303,301,
	1,0,0,0,303,304,1,0,0,0,304,307,1,0,0,0,305,303,1,0,0,0,306,308,5,5,0,0,
	307,306,1,0,0,0,307,308,1,0,0,0,308,309,1,0,0,0,309,310,5,6,0,0,310,311,
	5,180,0,0,311,312,5,151,0,0,312,313,5,2,0,0,313,315,1,0,0,0,314,288,1,0,
	0,0,314,291,1,0,0,0,314,296,1,0,0,0,315,3,1,0,0,0,316,319,5,180,0,0,317,
	318,5,3,0,0,318,320,5,180,0,0,319,317,1,0,0,0,319,320,1,0,0,0,320,5,1,0,
	0,0,321,322,5,7,0,0,322,323,3,14,7,0,323,327,3,106,53,0,324,326,3,96,48,
	0,325,324,1,0,0,0,326,329,1,0,0,0,327,325,1,0,0,0,327,328,1,0,0,0,328,331,
	1,0,0,0,329,327,1,0,0,0,330,332,3,102,51,0,331,330,1,0,0,0,331,332,1,0,
	0,0,332,333,1,0,0,0,333,337,5,4,0,0,334,336,3,114,57,0,335,334,1,0,0,0,
	336,339,1,0,0,0,337,335,1,0,0,0,337,338,1,0,0,0,338,340,1,0,0,0,339,337,
	1,0,0,0,340,341,5,6,0,0,341,7,1,0,0,0,342,343,5,8,0,0,343,344,5,180,0,0,
	344,349,5,9,0,0,345,350,3,84,42,0,346,350,3,82,41,0,347,350,3,254,127,0,
	348,350,5,10,0,0,349,345,1,0,0,0,349,346,1,0,0,0,349,347,1,0,0,0,349,348,
	1,0,0,0,350,352,1,0,0,0,351,353,5,11,0,0,352,351,1,0,0,0,352,353,1,0,0,
	0,353,354,1,0,0,0,354,382,5,2,0,0,355,356,5,8,0,0,356,357,5,4,0,0,357,362,
	3,10,5,0,358,359,5,5,0,0,359,361,3,10,5,0,360,358,1,0,0,0,361,364,1,0,0,
	0,362,360,1,0,0,0,362,363,1,0,0,0,363,366,1,0,0,0,364,362,1,0,0,0,365,367,
	5,5,0,0,366,365,1,0,0,0,366,367,1,0,0,0,367,368,1,0,0,0,368,369,5,6,0,0,
	369,374,5,9,0,0,370,375,3,84,42,0,371,375,3,82,41,0,372,375,3,254,127,0,
	373,375,5,10,0,0,374,370,1,0,0,0,374,371,1,0,0,0,374,372,1,0,0,0,374,373,
	1,0,0,0,375,377,1,0,0,0,376,378,5,11,0,0,377,376,1,0,0,0,377,378,1,0,0,
	0,378,379,1,0,0,0,379,380,5,2,0,0,380,382,1,0,0,0,381,342,1,0,0,0,381,355,
	1,0,0,0,382,9,1,0,0,0,383,386,5,180,0,0,384,385,5,12,0,0,385,387,5,180,
	0,0,386,384,1,0,0,0,386,387,1,0,0,0,387,390,1,0,0,0,388,389,5,3,0,0,389,
	391,3,12,6,0,390,388,1,0,0,0,390,391,1,0,0,0,391,11,1,0,0,0,392,393,7,0,
	0,0,393,13,1,0,0,0,394,395,7,1,0,0,395,15,1,0,0,0,396,397,5,41,0,0,397,
	398,3,18,9,0,398,399,3,20,10,0,399,400,5,2,0,0,400,411,1,0,0,0,401,402,
	5,41,0,0,402,406,5,180,0,0,403,405,7,2,0,0,404,403,1,0,0,0,405,408,1,0,
	0,0,406,404,1,0,0,0,406,407,1,0,0,0,407,409,1,0,0,0,408,406,1,0,0,0,409,
	411,5,2,0,0,410,396,1,0,0,0,410,401,1,0,0,0,411,17,1,0,0,0,412,413,7,3,
	0,0,413,19,1,0,0,0,414,416,3,22,11,0,415,414,1,0,0,0,416,417,1,0,0,0,417,
	415,1,0,0,0,417,418,1,0,0,0,418,421,1,0,0,0,419,421,5,10,0,0,420,415,1,
	0,0,0,420,419,1,0,0,0,421,21,1,0,0,0,422,424,3,24,12,0,423,422,1,0,0,0,
	423,424,1,0,0,0,424,425,1,0,0,0,425,426,7,4,0,0,426,23,1,0,0,0,427,428,
	7,5,0,0,428,25,1,0,0,0,429,430,5,45,0,0,430,440,5,180,0,0,431,432,5,46,
	0,0,432,437,5,180,0,0,433,434,5,5,0,0,434,436,5,180,0,0,435,433,1,0,0,0,
	436,439,1,0,0,0,437,435,1,0,0,0,437,438,1,0,0,0,438,441,1,0,0,0,439,437,
	1,0,0,0,440,431,1,0,0,0,440,441,1,0,0,0,441,442,1,0,0,0,442,454,5,4,0,0,
	443,453,3,56,28,0,444,453,3,52,26,0,445,453,3,60,30,0,446,453,3,44,22,0,
	447,453,3,48,24,0,448,453,3,8,4,0,449,453,3,30,15,0,450,453,3,28,14,0,451,
	453,3,34,17,0,452,443,1,0,0,0,452,444,1,0,0,0,452,445,1,0,0,0,452,446,1,
	0,0,0,452,447,1,0,0,0,452,448,1,0,0,0,452,449,1,0,0,0,452,450,1,0,0,0,452,
	451,1,0,0,0,453,456,1,0,0,0,454,452,1,0,0,0,454,455,1,0,0,0,455,457,1,0,
	0,0,456,454,1,0,0,0,457,458,5,6,0,0,458,27,1,0,0,0,459,460,3,32,16,0,460,
	461,3,82,41,0,461,462,5,180,0,0,462,463,5,2,0,0,463,470,1,0,0,0,464,465,
	3,32,16,0,465,466,3,84,42,0,466,467,5,180,0,0,467,468,5,2,0,0,468,470,1,
	0,0,0,469,459,1,0,0,0,469,464,1,0,0,0,470,29,1,0,0,0,471,472,3,32,16,0,
	472,473,3,254,127,0,473,474,5,180,0,0,474,475,5,2,0,0,475,31,1,0,0,0,476,
	477,7,6,0,0,477,33,1,0,0,0,478,479,5,7,0,0,479,480,5,180,0,0,480,484,3,
	106,53,0,481,483,3,96,48,0,482,481,1,0,0,0,483,486,1,0,0,0,484,482,1,0,
	0,0,484,485,1,0,0,0,485,488,1,0,0,0,486,484,1,0,0,0,487,489,3,102,51,0,
	488,487,1,0,0,0,488,489,1,0,0,0,489,490,1,0,0,0,490,491,5,2,0,0,491,35,
	1,0,0,0,492,493,5,49,0,0,493,494,5,180,0,0,494,506,5,4,0,0,495,505,3,56,
	28,0,496,505,3,52,26,0,497,505,3,60,30,0,498,505,3,44,22,0,499,505,3,48,
	24,0,500,505,3,62,31,0,501,505,3,76,38,0,502,505,3,8,4,0,503,505,3,6,3,
	0,504,495,1,0,0,0,504,496,1,0,0,0,504,497,1,0,0,0,504,498,1,0,0,0,504,499,
	1,0,0,0,504,500,1,0,0,0,504,501,1,0,0,0,504,502,1,0,0,0,504,503,1,0,0,0,
	505,508,1,0,0,0,506,504,1,0,0,0,506,507,1,0,0,0,507,509,1,0,0,0,508,506,
	1,0,0,0,509,510,5,6,0,0,510,37,1,0,0,0,511,513,5,50,0,0,512,511,1,0,0,0,
	512,513,1,0,0,0,513,514,1,0,0,0,514,515,5,51,0,0,515,517,3,14,7,0,516,518,
	3,106,53,0,517,516,1,0,0,0,517,518,1,0,0,0,518,528,1,0,0,0,519,520,5,46,
	0,0,520,525,3,40,20,0,521,522,5,5,0,0,522,524,3,40,20,0,523,521,1,0,0,0,
	524,527,1,0,0,0,525,523,1,0,0,0,525,526,1,0,0,0,526,529,1,0,0,0,527,525,
	1,0,0,0,528,519,1,0,0,0,528,529,1,0,0,0,529,530,1,0,0,0,530,547,5,4,0,0,
	531,546,3,56,28,0,532,546,3,52,26,0,533,546,3,60,30,0,534,546,3,44,22,0,
	535,546,3,48,24,0,536,546,3,62,31,0,537,546,3,8,4,0,538,546,3,76,38,0,539,
	546,3,86,43,0,540,546,3,64,32,0,541,546,3,92,46,0,542,546,3,42,21,0,543,
	546,3,66,33,0,544,546,3,70,35,0,545,531,1,0,0,0,545,532,1,0,0,0,545,533,
	1,0,0,0,545,534,1,0,0,0,545,535,1,0,0,0,545,536,1,0,0,0,545,537,1,0,0,0,
	545,538,1,0,0,0,545,539,1,0,0,0,545,540,1,0,0,0,545,541,1,0,0,0,545,542,
	1,0,0,0,545,543,1,0,0,0,545,544,1,0,0,0,546,549,1,0,0,0,547,545,1,0,0,0,
	547,548,1,0,0,0,548,550,1,0,0,0,549,547,1,0,0,0,550,551,5,6,0,0,551,39,
	1,0,0,0,552,554,5,180,0,0,553,555,3,230,115,0,554,553,1,0,0,0,554,555,1,
	0,0,0,555,41,1,0,0,0,556,557,5,7,0,0,557,558,3,14,7,0,558,563,3,106,53,
	0,559,562,3,96,48,0,560,562,3,94,47,0,561,559,1,0,0,0,561,560,1,0,0,0,562,
	565,1,0,0,0,563,561,1,0,0,0,563,564,1,0,0,0,564,567,1,0,0,0,565,563,1,0,
	0,0,566,568,3,102,51,0,567,566,1,0,0,0,567,568,1,0,0,0,568,569,1,0,0,0,
	569,570,5,2,0,0,570,43,1,0,0,0,571,572,5,52,0,0,572,573,3,14,7,0,573,585,
	5,53,0,0,574,579,3,46,23,0,575,576,5,5,0,0,576,578,3,46,23,0,577,575,1,
	0,0,0,578,581,1,0,0,0,579,577,1,0,0,0,579,580,1,0,0,0,580,583,1,0,0,0,581,
	579,1,0,0,0,582,584,5,5,0,0,583,582,1,0,0,0,583,584,1,0,0,0,584,586,1,0,
	0,0,585,574,1,0,0,0,585,586,1,0,0,0,586,587,1,0,0,0,587,589,5,54,0,0,588,
	590,5,55,0,0,589,588,1,0,0,0,589,590,1,0,0,0,590,591,1,0,0,0,591,592,5,
	2,0,0,592,45,1,0,0,0,593,596,3,254,127,0,594,596,3,84,42,0,595,593,1,0,
	0,0,595,594,1,0,0,0,596,598,1,0,0,0,597,599,5,56,0,0,598,597,1,0,0,0,598,
	599,1,0,0,0,599,601,1,0,0,0,600,602,3,14,7,0,601,600,1,0,0,0,601,602,1,
	0,0,0,602,47,1,0,0,0,603,604,5,34,0,0,604,605,3,14,7,0,605,617,5,53,0,0,
	606,611,3,50,25,0,607,608,5,5,0,0,608,610,3,50,25,0,609,607,1,0,0,0,610,
	613,1,0,0,0,611,609,1,0,0,0,611,612,1,0,0,0,612,615,1,0,0,0,613,611,1,0,
	0,0,614,616,5,5,0,0,615,614,1,0,0,0,615,616,1,0,0,0,616,618,1,0,0,0,617,
	606,1,0,0,0,617,618,1,0,0,0,618,619,1,0,0,0,619,620,5,54,0,0,620,621,5,
	2,0,0,621,49,1,0,0,0,622,624,3,254,127,0,623,625,5,180,0,0,624,623,1,0,
	0,0,624,625,1,0,0,0,625,631,1,0,0,0,626,628,3,84,42,0,627,629,5,180,0,0,
	628,627,1,0,0,0,628,629,1,0,0,0,629,631,1,0,0,0,630,622,1,0,0,0,630,626,
	1,0,0,0,631,51,1,0,0,0,632,633,5,57,0,0,633,634,3,14,7,0,634,636,5,4,0,
	0,635,637,3,54,27,0,636,635,1,0,0,0,637,638,1,0,0,0,638,636,1,0,0,0,638,
	639,1,0,0,0,639,640,1,0,0,0,640,641,5,6,0,0,641,53,1,0,0,0,642,646,3,254,
	127,0,643,646,3,84,42,0,644,646,3,82,41,0,645,642,1,0,0,0,645,643,1,0,0,
	0,645,644,1,0,0,0,646,647,1,0,0,0,647,648,3,14,7,0,648,649,5,2,0,0,649,
	55,1,0,0,0,650,651,5,58,0,0,651,652,3,14,7,0,652,653,5,4,0,0,653,658,3,
	58,29,0,654,655,5,5,0,0,655,657,3,58,29,0,656,654,1,0,0,0,657,660,1,0,0,
	0,658,656,1,0,0,0,658,659,1,0,0,0,659,662,1,0,0,0,660,658,1,0,0,0,661,663,
	5,5,0,0,662,661,1,0,0,0,662,663,1,0,0,0,663,664,1,0,0,0,664,665,5,6,0,0,
	665,57,1,0,0,0,666,669,3,14,7,0,667,668,5,44,0,0,668,670,5,145,0,0,669,
	667,1,0,0,0,669,670,1,0,0,0,670,59,1,0,0,0,671,672,5,59,0,0,672,673,3,14,
	7,0,673,674,5,46,0,0,674,675,3,254,127,0,675,676,5,2,0,0,676,61,1,0,0,0,
	677,678,3,254,127,0,678,679,5,60,0,0,679,680,3,14,7,0,680,681,5,44,0,0,
	681,682,3,240,120,0,682,683,5,2,0,0,683,63,1,0,0,0,684,685,5,61,0,0,685,
	689,3,106,53,0,686,688,7,7,0,0,687,686,1,0,0,0,688,691,1,0,0,0,689,687,
	1,0,0,0,689,690,1,0,0,0,690,695,1,0,0,0,691,689,1,0,0,0,692,694,3,74,37,
	0,693,692,1,0,0,0,694,697,1,0,0,0,695,693,1,0,0,0,695,696,1,0,0,0,696,701,
	1,0,0,0,697,695,1,0,0,0,698,700,7,7,0,0,699,698,1,0,0,0,700,703,1,0,0,0,
	701,699,1,0,0,0,701,702,1,0,0,0,702,707,1,0,0,0,703,701,1,0,0,0,704,706,
	3,94,47,0,705,704,1,0,0,0,706,709,1,0,0,0,707,705,1,0,0,0,707,708,1,0,0,
	0,708,710,1,0,0,0,709,707,1,0,0,0,710,714,5,4,0,0,711,713,3,114,57,0,712,
	711,1,0,0,0,713,716,1,0,0,0,714,712,1,0,0,0,714,715,1,0,0,0,715,717,1,0,
	0,0,716,714,1,0,0,0,717,718,5,6,0,0,718,65,1,0,0,0,719,720,5,38,0,0,720,
	724,3,106,53,0,721,723,3,68,34,0,722,721,1,0,0,0,723,726,1,0,0,0,724,722,
	1,0,0,0,724,725,1,0,0,0,725,727,1,0,0,0,726,724,1,0,0,0,727,731,5,48,0,
	0,728,730,3,68,34,0,729,728,1,0,0,0,730,733,1,0,0,0,731,729,1,0,0,0,731,
	732,1,0,0,0,732,737,1,0,0,0,733,731,1,0,0,0,734,736,3,94,47,0,735,734,1,
	0,0,0,736,739,1,0,0,0,737,735,1,0,0,0,737,738,1,0,0,0,738,741,1,0,0,0,739,
	737,1,0,0,0,740,742,3,102,51,0,741,740,1,0,0,0,741,742,1,0,0,0,742,743,
	1,0,0,0,743,747,5,4,0,0,744,746,3,114,57,0,745,744,1,0,0,0,746,749,1,0,
	0,0,747,745,1,0,0,0,747,748,1,0,0,0,748,750,1,0,0,0,749,747,1,0,0,0,750,
	751,5,6,0,0,751,67,1,0,0,0,752,756,5,63,0,0,753,756,5,64,0,0,754,756,3,
	98,49,0,755,752,1,0,0,0,755,753,1,0,0,0,755,754,1,0,0,0,756,69,1,0,0,0,
	757,758,5,39,0,0,758,759,5,53,0,0,759,763,5,54,0,0,760,762,3,72,36,0,761,
	760,1,0,0,0,762,765,1,0,0,0,763,761,1,0,0,0,763,764,1,0,0,0,764,766,1,0,
	0,0,765,763,1,0,0,0,766,770,5,48,0,0,767,769,3,72,36,0,768,767,1,0,0,0,
	769,772,1,0,0,0,770,768,1,0,0,0,770,771,1,0,0,0,771,773,1,0,0,0,772,770,
	1,0,0,0,773,777,5,63,0,0,774,776,3,72,36,0,775,774,1,0,0,0,776,779,1,0,
	0,0,777,775,1,0,0,0,777,778,1,0,0,0,778,789,1,0,0,0,779,777,1,0,0,0,780,
	784,5,4,0,0,781,783,3,114,57,0,782,781,1,0,0,0,783,786,1,0,0,0,784,782,
	1,0,0,0,784,785,1,0,0,0,785,787,1,0,0,0,786,784,1,0,0,0,787,790,5,6,0,0,
	788,790,5,2,0,0,789,780,1,0,0,0,789,788,1,0,0,0,790,826,1,0,0,0,791,792,
	5,39,0,0,792,793,5,53,0,0,793,797,5,54,0,0,794,796,3,72,36,0,795,794,1,
	0,0,0,796,799,1,0,0,0,797,795,1,0,0,0,797,798,1,0,0,0,798,800,1,0,0,0,799,
	797,1,0,0,0,800,804,5,63,0,0,801,803,3,72,36,0,802,801,1,0,0,0,803,806,
	1,0,0,0,804,802,1,0,0,0,804,805,1,0,0,0,805,807,1,0,0,0,806,804,1,0,0,0,
	807,811,5,48,0,0,808,810,3,72,36,0,809,808,1,0,0,0,810,813,1,0,0,0,811,
	809,1,0,0,0,811,812,1,0,0,0,812,823,1,0,0,0,813,811,1,0,0,0,814,818,5,4,
	0,0,815,817,3,114,57,0,816,815,1,0,0,0,817,820,1,0,0,0,818,816,1,0,0,0,
	818,819,1,0,0,0,819,821,1,0,0,0,820,818,1,0,0,0,821,824,5,6,0,0,822,824,
	5,2,0,0,823,814,1,0,0,0,823,822,1,0,0,0,824,826,1,0,0,0,825,757,1,0,0,0,
	825,791,1,0,0,0,826,71,1,0,0,0,827,830,5,64,0,0,828,830,3,98,49,0,829,827,
	1,0,0,0,829,828,1,0,0,0,830,73,1,0,0,0,831,832,5,180,0,0,832,833,3,230,
	115,0,833,75,1,0,0,0,834,836,3,80,40,0,835,834,1,0,0,0,835,836,1,0,0,0,
	836,837,1,0,0,0,837,842,3,254,127,0,838,841,3,244,122,0,839,841,3,98,49,
	0,840,838,1,0,0,0,840,839,1,0,0,0,841,844,1,0,0,0,842,840,1,0,0,0,842,843,
	1,0,0,0,843,845,1,0,0,0,844,842,1,0,0,0,845,848,3,14,7,0,846,847,5,44,0,
	0,847,849,3,240,120,0,848,846,1,0,0,0,848,849,1,0,0,0,849,850,1,0,0,0,850,
	851,5,2,0,0,851,909,1,0,0,0,852,857,3,254,127,0,853,856,3,244,122,0,854,
	856,3,98,49,0,855,853,1,0,0,0,855,854,1,0,0,0,856,859,1,0,0,0,857,855,1,
	0,0,0,857,858,1,0,0,0,858,860,1,0,0,0,859,857,1,0,0,0,860,865,3,80,40,0,
	861,864,3,244,122,0,862,864,3,98,49,0,863,861,1,0,0,0,863,862,1,0,0,0,864,
	867,1,0,0,0,865,863,1,0,0,0,865,866,1,0,0,0,866,868,1,0,0,0,867,865,1,0,
	0,0,868,871,3,14,7,0,869,870,5,44,0,0,870,872,3,240,120,0,871,869,1,0,0,
	0,871,872,1,0,0,0,872,873,1,0,0,0,873,874,5,2,0,0,874,909,1,0,0,0,875,877,
	3,80,40,0,876,875,1,0,0,0,876,877,1,0,0,0,877,879,1,0,0,0,878,880,5,40,
	0,0,879,878,1,0,0,0,879,880,1,0,0,0,880,881,1,0,0,0,881,885,3,82,41,0,882,
	884,3,78,39,0,883,882,1,0,0,0,884,887,1,0,0,0,885,883,1,0,0,0,885,886,1,
	0,0,0,886,888,1,0,0,0,887,885,1,0,0,0,888,889,3,14,7,0,889,890,5,2,0,0,
	890,909,1,0,0,0,891,893,3,80,40,0,892,891,1,0,0,0,892,893,1,0,0,0,893,894,
	1,0,0,0,894,898,3,84,42,0,895,897,3,78,39,0,896,895,1,0,0,0,897,900,1,0,
	0,0,898,896,1,0,0,0,898,899,1,0,0,0,899,901,1,0,0,0,900,898,1,0,0,0,901,
	904,3,14,7,0,902,903,5,44,0,0,903,905,3,240,120,0,904,902,1,0,0,0,904,905,
	1,0,0,0,905,906,1,0,0,0,906,907,5,2,0,0,907,909,1,0,0,0,908,835,1,0,0,0,
	908,852,1,0,0,0,908,876,1,0,0,0,908,892,1,0,0,0,909,77,1,0,0,0,910,914,
	3,244,122,0,911,914,3,80,40,0,912,914,3,98,49,0,913,910,1,0,0,0,913,911,
	1,0,0,0,913,912,1,0,0,0,914,79,1,0,0,0,915,916,7,8,0,0,916,81,1,0,0,0,917,
	918,5,66,0,0,918,919,5,53,0,0,919,921,3,254,127,0,920,922,5,180,0,0,921,
	920,1,0,0,0,921,922,1,0,0,0,922,923,1,0,0,0,923,924,5,67,0,0,924,926,3,
	254,127,0,925,927,5,180,0,0,926,925,1,0,0,0,926,927,1,0,0,0,927,928,1,0,
	0,0,928,929,5,54,0,0,929,954,1,0,0,0,930,931,5,66,0,0,931,932,5,53,0,0,
	932,934,3,254,127,0,933,935,5,180,0,0,934,933,1,0,0,0,934,935,1,0,0,0,935,
	936,1,0,0,0,936,937,5,67,0,0,937,938,3,82,41,0,938,939,5,54,0,0,939,954,
	1,0,0,0,940,941,5,66,0,0,941,942,5,53,0,0,942,944,3,254,127,0,943,945,5,
	180,0,0,944,943,1,0,0,0,944,945,1,0,0,0,945,946,1,0,0,0,946,947,5,67,0,
	0,947,949,3,84,42,0,948,950,5,180,0,0,949,948,1,0,0,0,949,950,1,0,0,0,950,
	951,1,0,0,0,951,952,5,54,0,0,952,954,1,0,0,0,953,917,1,0,0,0,953,930,1,
	0,0,0,953,940,1,0,0,0,954,83,1,0,0,0,955,956,6,42,-1,0,956,957,3,254,127,
	0,957,959,5,68,0,0,958,960,3,240,120,0,959,958,1,0,0,0,959,960,1,0,0,0,
	960,961,1,0,0,0,961,962,5,69,0,0,962,971,1,0,0,0,963,964,10,1,0,0,964,966,
	5,68,0,0,965,967,3,240,120,0,966,965,1,0,0,0,966,967,1,0,0,0,967,968,1,
	0,0,0,968,970,5,69,0,0,969,963,1,0,0,0,970,973,1,0,0,0,971,969,1,0,0,0,
	971,972,1,0,0,0,972,85,1,0,0,0,973,971,1,0,0,0,974,975,5,70,0,0,975,977,
	5,180,0,0,976,978,3,106,53,0,977,976,1,0,0,0,977,978,1,0,0,0,978,983,1,
	0,0,0,979,982,5,64,0,0,980,982,3,98,49,0,981,979,1,0,0,0,981,980,1,0,0,
	0,982,985,1,0,0,0,983,981,1,0,0,0,983,984,1,0,0,0,984,995,1,0,0,0,985,983,
	1,0,0,0,986,990,5,4,0,0,987,989,3,88,44,0,988,987,1,0,0,0,989,992,1,0,0,
	0,990,988,1,0,0,0,990,991,1,0,0,0,991,993,1,0,0,0,992,990,1,0,0,0,993,996,
	5,6,0,0,994,996,5,2,0,0,995,986,1,0,0,0,995,994,1,0,0,0,996,87,1,0,0,0,
	997,1000,3,90,45,0,998,1000,3,114,57,0,999,997,1,0,0,0,999,998,1,0,0,0,
	1000,89,1,0,0,0,1001,1002,5,71,0,0,1002,1003,5,2,0,0,1003,91,1,0,0,0,1004,
	1005,5,7,0,0,1005,1006,3,14,7,0,1006,1011,3,106,53,0,1007,1010,3,96,48,
	0,1008,1010,3,94,47,0,1009,1007,1,0,0,0,1009,1008,1,0,0,0,1010,1013,1,0,
	0,0,1011,1009,1,0,0,0,1011,1012,1,0,0,0,1012,1015,1,0,0,0,1013,1011,1,0,
	0,0,1014,1016,3,102,51,0,1015,1014,1,0,0,0,1015,1016,1,0,0,0,1016,1017,
	1,0,0,0,1017,1021,5,4,0,0,1018,1020,3,114,57,0,1019,1018,1,0,0,0,1020,1023,
	1,0,0,0,1021,1019,1,0,0,0,1021,1022,1,0,0,0,1022,1024,1,0,0,0,1023,1021,
	1,0,0,0,1024,1025,5,6,0,0,1025,93,1,0,0,0,1026,1028,5,180,0,0,1027,1029,
	3,230,115,0,1028,1027,1,0,0,0,1028,1029,1,0,0,0,1029,95,1,0,0,0,1030,1044,
	5,72,0,0,1031,1044,5,73,0,0,1032,1044,5,62,0,0,1033,1044,5,48,0,0,1034,
	1044,5,47,0,0,1035,1044,5,65,0,0,1036,1044,5,63,0,0,1037,1044,3,98,49,0,
	1038,1044,5,64,0,0,1039,1044,3,100,50,0,1040,1044,5,29,0,0,1041,1044,5,
	30,0,0,1042,1044,5,28,0,0,1043,1030,1,0,0,0,1043,1031,1,0,0,0,1043,1032,
	1,0,0,0,1043,1033,1,0,0,0,1043,1034,1,0,0,0,1043,1035,1,0,0,0,1043,1036,
	1,0,0,0,1043,1037,1,0,0,0,1043,1038,1,0,0,0,1043,1039,1,0,0,0,1043,1040,
	1,0,0,0,1043,1041,1,0,0,0,1043,1042,1,0,0,0,1044,97,1,0,0,0,1045,1056,5,
	74,0,0,1046,1047,5,53,0,0,1047,1052,5,180,0,0,1048,1049,5,5,0,0,1049,1051,
	5,180,0,0,1050,1048,1,0,0,0,1051,1054,1,0,0,0,1052,1050,1,0,0,0,1052,1053,
	1,0,0,0,1053,1055,1,0,0,0,1054,1052,1,0,0,0,1055,1057,5,54,0,0,1056,1046,
	1,0,0,0,1056,1057,1,0,0,0,1057,99,1,0,0,0,1058,1062,5,31,0,0,1059,1060,
	5,53,0,0,1060,1061,5,145,0,0,1061,1063,5,54,0,0,1062,1059,1,0,0,0,1062,
	1063,1,0,0,0,1063,101,1,0,0,0,1064,1065,5,75,0,0,1065,1066,5,53,0,0,1066,
	1071,3,104,52,0,1067,1068,5,5,0,0,1068,1070,3,104,52,0,1069,1067,1,0,0,
	0,1070,1073,1,0,0,0,1071,1069,1,0,0,0,1071,1072,1,0,0,0,1072,1075,1,0,0,
	0,1073,1071,1,0,0,0,1074,1076,5,5,0,0,1075,1074,1,0,0,0,1075,1076,1,0,0,
	0,1076,1077,1,0,0,0,1077,1078,5,54,0,0,1078,103,1,0,0,0,1079,1083,3,254,
	127,0,1080,1082,3,244,122,0,1081,1080,1,0,0,0,1082,1085,1,0,0,0,1083,1081,
	1,0,0,0,1083,1084,1,0,0,0,1084,1087,1,0,0,0,1085,1083,1,0,0,0,1086,1088,
	3,14,7,0,1087,1086,1,0,0,0,1087,1088,1,0,0,0,1088,1110,1,0,0,0,1089,1093,
	3,84,42,0,1090,1092,3,244,122,0,1091,1090,1,0,0,0,1092,1095,1,0,0,0,1093,
	1091,1,0,0,0,1093,1094,1,0,0,0,1094,1097,1,0,0,0,1095,1093,1,0,0,0,1096,
	1098,3,14,7,0,1097,1096,1,0,0,0,1097,1098,1,0,0,0,1098,1110,1,0,0,0,1099,
	1103,3,82,41,0,1100,1102,3,244,122,0,1101,1100,1,0,0,0,1102,1105,1,0,0,
	0,1103,1101,1,0,0,0,1103,1104,1,0,0,0,1104,1107,1,0,0,0,1105,1103,1,0,0,
	0,1106,1108,3,14,7,0,1107,1106,1,0,0,0,1107,1108,1,0,0,0,1108,1110,1,0,
	0,0,1109,1079,1,0,0,0,1109,1089,1,0,0,0,1109,1099,1,0,0,0,1110,105,1,0,
	0,0,1111,1123,5,53,0,0,1112,1117,3,108,54,0,1113,1114,5,5,0,0,1114,1116,
	3,108,54,0,1115,1113,1,0,0,0,1116,1119,1,0,0,0,1117,1115,1,0,0,0,1117,1118,
	1,0,0,0,1118,1121,1,0,0,0,1119,1117,1,0,0,0,1120,1122,5,5,0,0,1121,1120,
	1,0,0,0,1121,1122,1,0,0,0,1122,1124,1,0,0,0,1123,1112,1,0,0,0,1123,1124,
	1,0,0,0,1124,1125,1,0,0,0,1125,1126,5,54,0,0,1126,107,1,0,0,0,1127,1131,
	3,254,127,0,1128,1130,3,244,122,0,1129,1128,1,0,0,0,1130,1133,1,0,0,0,1131,
	1129,1,0,0,0,1131,1132,1,0,0,0,1132,1135,1,0,0,0,1133,1131,1,0,0,0,1134,
	1136,3,14,7,0,1135,1134,1,0,0,0,1135,1136,1,0,0,0,1136,1158,1,0,0,0,1137,
	1141,3,84,42,0,1138,1140,3,244,122,0,1139,1138,1,0,0,0,1140,1143,1,0,0,
	0,1141,1139,1,0,0,0,1141,1142,1,0,0,0,1142,1145,1,0,0,0,1143,1141,1,0,0,
	0,1144,1146,3,14,7,0,1145,1144,1,0,0,0,1145,1146,1,0,0,0,1146,1158,1,0,
	0,0,1147,1151,3,82,41,0,1148,1150,3,244,122,0,1149,1148,1,0,0,0,1150,1153,
	1,0,0,0,1151,1149,1,0,0,0,1151,1152,1,0,0,0,1152,1155,1,0,0,0,1153,1151,
	1,0,0,0,1154,1156,3,14,7,0,1155,1154,1,0,0,0,1155,1156,1,0,0,0,1156,1158,
	1,0,0,0,1157,1127,1,0,0,0,1157,1137,1,0,0,0,1157,1147,1,0,0,0,1158,109,
	1,0,0,0,1159,1163,5,4,0,0,1160,1162,3,114,57,0,1161,1160,1,0,0,0,1162,1165,
	1,0,0,0,1163,1161,1,0,0,0,1163,1164,1,0,0,0,1164,1166,1,0,0,0,1165,1163,
	1,0,0,0,1166,1169,5,6,0,0,1167,1169,3,114,57,0,1168,1159,1,0,0,0,1168,1167,
	1,0,0,0,1169,111,1,0,0,0,1170,1174,5,4,0,0,1171,1173,3,114,57,0,1172,1171,
	1,0,0,0,1173,1176,1,0,0,0,1174,1172,1,0,0,0,1174,1175,1,0,0,0,1175,1177,
	1,0,0,0,1176,1174,1,0,0,0,1177,1178,5,6,0,0,1178,113,1,0,0,0,1179,1203,
	3,90,45,0,1180,1203,3,112,56,0,1181,1203,3,128,64,0,1182,1203,3,130,65,
	0,1183,1203,3,120,60,0,1184,1203,3,138,69,0,1185,1203,3,140,70,0,1186,1203,
	3,142,71,0,1187,1203,3,144,72,0,1188,1203,3,164,82,0,1189,1203,3,126,63,
	0,1190,1203,3,122,61,0,1191,1203,3,124,62,0,1192,1203,3,166,83,0,1193,1203,
	3,206,103,0,1194,1203,3,218,109,0,1195,1203,3,220,110,0,1196,1203,3,136,
	68,0,1197,1203,3,198,99,0,1198,1203,3,200,100,0,1199,1203,3,212,106,0,1200,
	1203,3,214,107,0,1201,1203,3,116,58,0,1202,1179,1,0,0,0,1202,1180,1,0,0,
	0,1202,1181,1,0,0,0,1202,1182,1,0,0,0,1202,1183,1,0,0,0,1202,1184,1,0,0,
	0,1202,1185,1,0,0,0,1202,1186,1,0,0,0,1202,1187,1,0,0,0,1202,1188,1,0,0,
	0,1202,1189,1,0,0,0,1202,1190,1,0,0,0,1202,1191,1,0,0,0,1202,1192,1,0,0,
	0,1202,1193,1,0,0,0,1202,1194,1,0,0,0,1202,1195,1,0,0,0,1202,1196,1,0,0,
	0,1202,1197,1,0,0,0,1202,1198,1,0,0,0,1202,1199,1,0,0,0,1202,1200,1,0,0,
	0,1202,1201,1,0,0,0,1203,115,1,0,0,0,1204,1263,3,240,120,0,1205,1206,7,
	9,0,0,1206,1264,3,118,59,0,1207,1208,5,165,0,0,1208,1209,5,53,0,0,1209,
	1210,5,54,0,0,1210,1211,5,165,0,0,1211,1212,5,53,0,0,1212,1213,5,54,0,0,
	1213,1214,5,44,0,0,1214,1223,3,240,120,0,1215,1216,5,165,0,0,1216,1217,
	5,53,0,0,1217,1221,5,54,0,0,1218,1219,5,165,0,0,1219,1220,5,53,0,0,1220,
	1222,5,54,0,0,1221,1218,1,0,0,0,1221,1222,1,0,0,0,1222,1224,1,0,0,0,1223,
	1215,1,0,0,0,1223,1224,1,0,0,0,1224,1264,1,0,0,0,1225,1226,5,165,0,0,1226,
	1227,5,53,0,0,1227,1228,5,54,0,0,1228,1229,5,165,0,0,1229,1231,5,53,0,0,
	1230,1232,3,134,67,0,1231,1230,1,0,0,0,1231,1232,1,0,0,0,1232,1233,1,0,
	0,0,1233,1264,5,54,0,0,1234,1235,5,165,0,0,1235,1236,5,53,0,0,1236,1237,
	5,54,0,0,1237,1238,5,44,0,0,1238,1247,3,240,120,0,1239,1240,5,165,0,0,1240,
	1241,5,53,0,0,1241,1245,5,54,0,0,1242,1243,5,165,0,0,1243,1244,5,53,0,0,
	1244,1246,5,54,0,0,1245,1242,1,0,0,0,1245,1246,1,0,0,0,1246,1248,1,0,0,
	0,1247,1239,1,0,0,0,1247,1248,1,0,0,0,1248,1264,1,0,0,0,1249,1250,5,165,
	0,0,1250,1252,5,53,0,0,1251,1253,3,134,67,0,1252,1251,1,0,0,0,1252,1253,
	1,0,0,0,1253,1254,1,0,0,0,1254,1264,5,54,0,0,1255,1256,5,166,0,0,1256,1257,
	5,53,0,0,1257,1264,5,54,0,0,1258,1259,5,169,0,0,1259,1260,5,53,0,0,1260,
	1261,3,240,120,0,1261,1262,5,54,0,0,1262,1264,1,0,0,0,1263,1205,1,0,0,0,
	1263,1207,1,0,0,0,1263,1225,1,0,0,0,1263,1234,1,0,0,0,1263,1249,1,0,0,0,
	1263,1255,1,0,0,0,1263,1258,1,0,0,0,1263,1264,1,0,0,0,1264,1265,1,0,0,0,
	1265,1266,5,2,0,0,1266,117,1,0,0,0,1267,1270,3,240,120,0,1268,1269,7,9,
	0,0,1269,1271,3,118,59,0,1270,1268,1,0,0,0,1270,1271,1,0,0,0,1271,119,1,
	0,0,0,1272,1273,7,10,0,0,1273,1274,3,240,120,0,1274,1275,5,2,0,0,1275,121,
	1,0,0,0,1276,1277,5,88,0,0,1277,1312,5,2,0,0,1278,1279,5,88,0,0,1279,1280,
	3,240,120,0,1280,1281,7,9,0,0,1281,1282,3,118,59,0,1282,1283,5,2,0,0,1283,
	1312,1,0,0,0,1284,1285,5,88,0,0,1285,1290,3,240,120,0,1286,1287,5,5,0,0,
	1287,1289,3,240,120,0,1288,1286,1,0,0,0,1289,1292,1,0,0,0,1290,1288,1,0,
	0,0,1290,1291,1,0,0,0,1291,1293,1,0,0,0,1292,1290,1,0,0,0,1293,1294,5,2,
	0,0,1294,1312,1,0,0,0,1295,1296,5,88,0,0,1296,1297,5,53,0,0,1297,1302,3,
	240,120,0,1298,1299,5,5,0,0,1299,1301,3,240,120,0,1300,1298,1,0,0,0,1301,
	1304,1,0,0,0,1302,1300,1,0,0,0,1302,1303,1,0,0,0,1303,1306,1,0,0,0,1304,
	1302,1,0,0,0,1305,1307,5,5,0,0,1306,1305,1,0,0,0,1306,1307,1,0,0,0,1307,
	1308,1,0,0,0,1308,1309,5,54,0,0,1309,1310,5,2,0,0,1310,1312,1,0,0,0,1311,
	1276,1,0,0,0,1311,1278,1,0,0,0,1311,1284,1,0,0,0,1311,1295,1,0,0,0,1312,
	123,1,0,0,0,1313,1314,5,30,0,0,1314,1315,5,53,0,0,1315,1316,3,240,120,0,
	1316,1317,5,54,0,0,1317,1318,5,2,0,0,1318,125,1,0,0,0,1319,1320,5,89,0,
	0,1320,1323,5,180,0,0,1321,1322,5,12,0,0,1322,1324,5,180,0,0,1323,1321,
	1,0,0,0,1323,1324,1,0,0,0,1324,1325,1,0,0,0,1325,1326,5,53,0,0,1326,1338,
	5,4,0,0,1327,1332,3,228,114,0,1328,1329,5,5,0,0,1329,1331,3,228,114,0,1330,
	1328,1,0,0,0,1331,1334,1,0,0,0,1332,1330,1,0,0,0,1332,1333,1,0,0,0,1333,
	1336,1,0,0,0,1334,1332,1,0,0,0,1335,1337,5,5,0,0,1336,1335,1,0,0,0,1336,
	1337,1,0,0,0,1337,1339,1,0,0,0,1338,1327,1,0,0,0,1338,1339,1,0,0,0,1339,
	1340,1,0,0,0,1340,1341,5,6,0,0,1341,1342,5,54,0,0,1342,1353,5,2,0,0,1343,
	1344,5,89,0,0,1344,1347,5,180,0,0,1345,1346,5,12,0,0,1346,1348,5,180,0,
	0,1347,1345,1,0,0,0,1347,1348,1,0,0,0,1348,1349,1,0,0,0,1349,1350,3,230,
	115,0,1350,1351,5,2,0,0,1351,1353,1,0,0,0,1352,1319,1,0,0,0,1352,1343,1,
	0,0,0,1353,127,1,0,0,0,1354,1358,3,254,127,0,1355,1357,3,244,122,0,1356,
	1355,1,0,0,0,1357,1360,1,0,0,0,1358,1356,1,0,0,0,1358,1359,1,0,0,0,1359,
	1361,1,0,0,0,1360,1358,1,0,0,0,1361,1371,3,14,7,0,1362,1363,5,44,0,0,1363,
	1369,3,240,120,0,1364,1365,7,9,0,0,1365,1370,3,118,59,0,1366,1367,5,165,
	0,0,1367,1368,5,53,0,0,1368,1370,5,54,0,0,1369,1364,1,0,0,0,1369,1366,1,
	0,0,0,1369,1370,1,0,0,0,1370,1372,1,0,0,0,1371,1362,1,0,0,0,1371,1372,1,
	0,0,0,1372,1373,1,0,0,0,1373,1374,5,2,0,0,1374,1409,1,0,0,0,1375,1379,3,
	84,42,0,1376,1378,3,244,122,0,1377,1376,1,0,0,0,1378,1381,1,0,0,0,1379,
	1377,1,0,0,0,1379,1380,1,0,0,0,1380,1382,1,0,0,0,1381,1379,1,0,0,0,1382,
	1390,3,14,7,0,1383,1384,5,44,0,0,1384,1388,3,240,120,0,1385,1386,5,165,
	0,0,1386,1387,5,53,0,0,1387,1389,5,54,0,0,1388,1385,1,0,0,0,1388,1389,1,
	0,0,0,1389,1391,1,0,0,0,1390,1383,1,0,0,0,1390,1391,1,0,0,0,1391,1392,1,
	0,0,0,1392,1393,5,2,0,0,1393,1409,1,0,0,0,1394,1398,3,82,41,0,1395,1397,
	3,244,122,0,1396,1395,1,0,0,0,1397,1400,1,0,0,0,1398,1396,1,0,0,0,1398,
	1399,1,0,0,0,1399,1401,1,0,0,0,1400,1398,1,0,0,0,1401,1404,3,14,7,0,1402,
	1403,5,44,0,0,1403,1405,3,240,120,0,1404,1402,1,0,0,0,1404,1405,1,0,0,0,
	1405,1406,1,0,0,0,1406,1407,5,2,0,0,1407,1409,1,0,0,0,1408,1354,1,0,0,0,
	1408,1375,1,0,0,0,1408,1394,1,0,0,0,1409,129,1,0,0,0,1410,1411,3,254,127,
	0,1411,1416,5,180,0,0,1412,1413,5,5,0,0,1413,1414,3,254,127,0,1414,1415,
	5,180,0,0,1415,1417,1,0,0,0,1416,1412,1,0,0,0,1417,1418,1,0,0,0,1418,1416,
	1,0,0,0,1418,1419,1,0,0,0,1419,1420,1,0,0,0,1420,1421,5,44,0,0,1421,1422,
	3,240,120,0,1422,1423,5,2,0,0,1423,1487,1,0,0,0,1424,1425,5,53,0,0,1425,
	1428,3,132,66,0,1426,1427,5,5,0,0,1427,1429,3,132,66,0,1428,1426,1,0,0,
	0,1429,1430,1,0,0,0,1430,1428,1,0,0,0,1430,1431,1,0,0,0,1431,1432,1,0,0,
	0,1432,1433,5,54,0,0,1433,1434,5,44,0,0,1434,1435,5,53,0,0,1435,1438,3,
	240,120,0,1436,1437,5,5,0,0,1437,1439,3,240,120,0,1438,1436,1,0,0,0,1439,
	1440,1,0,0,0,1440,1438,1,0,0,0,1440,1441,1,0,0,0,1441,1442,1,0,0,0,1442,
	1443,5,54,0,0,1443,1444,5,2,0,0,1444,1487,1,0,0,0,1445,1446,5,53,0,0,1446,
	1449,3,132,66,0,1447,1448,5,5,0,0,1448,1450,3,132,66,0,1449,1447,1,0,0,
	0,1450,1451,1,0,0,0,1451,1449,1,0,0,0,1451,1452,1,0,0,0,1452,1453,1,0,0,
	0,1453,1454,5,54,0,0,1454,1455,5,44,0,0,1455,1456,3,240,120,0,1456,1457,
	5,2,0,0,1457,1487,1,0,0,0,1458,1459,5,53,0,0,1459,1463,3,254,127,0,1460,
	1462,3,244,122,0,1461,1460,1,0,0,0,1462,1465,1,0,0,0,1463,1461,1,0,0,0,
	1463,1464,1,0,0,0,1464,1466,1,0,0,0,1465,1463,1,0,0,0,1466,1467,3,14,7,
	0,1467,1468,5,54,0,0,1468,1469,5,44,0,0,1469,1470,3,240,120,0,1470,1471,
	5,2,0,0,1471,1487,1,0,0,0,1472,1473,5,53,0,0,1473,1477,3,84,42,0,1474,1476,
	3,244,122,0,1475,1474,1,0,0,0,1476,1479,1,0,0,0,1477,1475,1,0,0,0,1477,
	1478,1,0,0,0,1478,1480,1,0,0,0,1479,1477,1,0,0,0,1480,1481,3,14,7,0,1481,
	1482,5,54,0,0,1482,1483,5,44,0,0,1483,1484,3,240,120,0,1484,1485,5,2,0,
	0,1485,1487,1,0,0,0,1486,1410,1,0,0,0,1486,1424,1,0,0,0,1486,1445,1,0,0,
	0,1486,1458,1,0,0,0,1486,1472,1,0,0,0,1487,131,1,0,0,0,1488,1492,3,254,
	127,0,1489,1491,3,244,122,0,1490,1489,1,0,0,0,1491,1494,1,0,0,0,1492,1490,
	1,0,0,0,1492,1493,1,0,0,0,1493,1495,1,0,0,0,1494,1492,1,0,0,0,1495,1496,
	3,14,7,0,1496,1520,1,0,0,0,1497,1501,3,84,42,0,1498,1500,3,244,122,0,1499,
	1498,1,0,0,0,1500,1503,1,0,0,0,1501,1499,1,0,0,0,1501,1502,1,0,0,0,1502,
	1504,1,0,0,0,1503,1501,1,0,0,0,1504,1505,3,14,7,0,1505,1520,1,0,0,0,1506,
	1515,3,14,7,0,1507,1508,5,68,0,0,1508,1509,3,240,120,0,1509,1510,5,69,0,
	0,1510,1514,1,0,0,0,1511,1512,5,12,0,0,1512,1514,3,14,7,0,1513,1507,1,0,
	0,0,1513,1511,1,0,0,0,1514,1517,1,0,0,0,1515,1513,1,0,0,0,1515,1516,1,0,
	0,0,1516,1520,1,0,0,0,1517,1515,1,0,0,0,1518,1520,1,0,0,0,1519,1488,1,0,
	0,0,1519,1497,1,0,0,0,1519,1506,1,0,0,0,1519,1518,1,0,0,0,1520,133,1,0,
	0,0,1521,1522,3,240,120,0,1522,135,1,0,0,0,1523,1524,5,90,0,0,1524,1525,
	5,180,0,0,1525,1585,5,2,0,0,1526,1527,5,90,0,0,1527,1528,5,91,0,0,1528,
	1529,5,12,0,0,1529,1530,5,180,0,0,1530,1585,5,2,0,0,1531,1532,5,90,0,0,
	1532,1533,5,91,0,0,1533,1534,5,12,0,0,1534,1539,5,180,0,0,1535,1536,5,68,
	0,0,1536,1537,3,240,120,0,1537,1538,5,69,0,0,1538,1540,1,0,0,0,1539,1535,
	1,0,0,0,1540,1541,1,0,0,0,1541,1539,1,0,0,0,1541,1542,1,0,0,0,1542,1543,
	1,0,0,0,1543,1544,5,2,0,0,1544,1585,1,0,0,0,1545,1546,5,90,0,0,1546,1551,
	5,180,0,0,1547,1548,5,68,0,0,1548,1549,3,240,120,0,1549,1550,5,69,0,0,1550,
	1552,1,0,0,0,1551,1547,1,0,0,0,1552,1553,1,0,0,0,1553,1551,1,0,0,0,1553,
	1554,1,0,0,0,1554,1555,1,0,0,0,1555,1556,5,2,0,0,1556,1585,1,0,0,0,1557,
	1558,5,90,0,0,1558,1561,5,180,0,0,1559,1560,5,12,0,0,1560,1562,5,180,0,
	0,1561,1559,1,0,0,0,1562,1563,1,0,0,0,1563,1561,1,0,0,0,1563,1564,1,0,0,
	0,1564,1569,1,0,0,0,1565,1566,5,68,0,0,1566,1567,3,240,120,0,1567,1568,
	5,69,0,0,1568,1570,1,0,0,0,1569,1565,1,0,0,0,1570,1571,1,0,0,0,1571,1569,
	1,0,0,0,1571,1572,1,0,0,0,1572,1573,1,0,0,0,1573,1574,5,2,0,0,1574,1585,
	1,0,0,0,1575,1576,5,90,0,0,1576,1579,5,180,0,0,1577,1578,5,12,0,0,1578,
	1580,5,180,0,0,1579,1577,1,0,0,0,1580,1581,1,0,0,0,1581,1579,1,0,0,0,1581,
	1582,1,0,0,0,1582,1583,1,0,0,0,1583,1585,5,2,0,0,1584,1523,1,0,0,0,1584,
	1526,1,0,0,0,1584,1531,1,0,0,0,1584,1545,1,0,0,0,1584,1557,1,0,0,0,1584,
	1575,1,0,0,0,1585,137,1,0,0,0,1586,1587,5,92,0,0,1587,1588,5,53,0,0,1588,
	1589,5,154,0,0,1589,1590,5,23,0,0,1590,1593,3,240,120,0,1591,1592,5,5,0,
	0,1592,1594,3,216,108,0,1593,1591,1,0,0,0,1593,1594,1,0,0,0,1594,1595,1,
	0,0,0,1595,1596,5,54,0,0,1596,1597,5,2,0,0,1597,139,1,0,0,0,1598,1599,5,
	92,0,0,1599,1600,5,53,0,0,1600,1603,3,240,120,0,1601,1602,5,5,0,0,1602,
	1604,3,216,108,0,1603,1601,1,0,0,0,1603,1604,1,0,0,0,1604,1605,1,0,0,0,
	1605,1606,5,54,0,0,1606,1607,5,2,0,0,1607,141,1,0,0,0,1608,1609,5,93,0,
	0,1609,1610,5,53,0,0,1610,1611,3,240,120,0,1611,1612,5,54,0,0,1612,1615,
	3,110,55,0,1613,1614,5,94,0,0,1614,1616,3,110,55,0,1615,1613,1,0,0,0,1615,
	1616,1,0,0,0,1616,143,1,0,0,0,1617,1624,3,160,80,0,1618,1624,3,162,81,0,
	1619,1624,3,152,76,0,1620,1624,3,146,73,0,1621,1624,3,148,74,0,1622,1624,
	3,150,75,0,1623,1617,1,0,0,0,1623,1618,1,0,0,0,1623,1619,1,0,0,0,1623,1620,
	1,0,0,0,1623,1621,1,0,0,0,1623,1622,1,0,0,0,1624,145,1,0,0,0,1625,1626,
	5,9,0,0,1626,1627,5,53,0,0,1627,1628,3,254,127,0,1628,1629,5,180,0,0,1629,
	1630,5,5,0,0,1630,1631,3,254,127,0,1631,1632,5,180,0,0,1632,1633,5,95,0,
	0,1633,1634,5,91,0,0,1634,1635,5,12,0,0,1635,1636,5,180,0,0,1636,1637,5,
	12,0,0,1637,1638,5,33,0,0,1638,1639,5,54,0,0,1639,1640,3,110,55,0,1640,
	147,1,0,0,0,1641,1642,5,9,0,0,1642,1643,5,53,0,0,1643,1644,3,254,127,0,
	1644,1645,5,180,0,0,1645,1646,5,96,0,0,1646,1647,5,91,0,0,1647,1648,5,12,
	0,0,1648,1649,5,180,0,0,1649,1650,5,54,0,0,1650,1651,3,110,55,0,1651,149,
	1,0,0,0,1652,1653,5,9,0,0,1653,1654,5,53,0,0,1654,1655,3,254,127,0,1655,
	1656,5,180,0,0,1656,1657,5,95,0,0,1657,1658,5,91,0,0,1658,1659,5,12,0,0,
	1659,1660,5,180,0,0,1660,1661,5,54,0,0,1661,1662,3,110,55,0,1662,151,1,
	0,0,0,1663,1664,5,9,0,0,1664,1665,5,53,0,0,1665,1666,3,154,77,0,1666,1668,
	3,156,78,0,1667,1669,3,158,79,0,1668,1667,1,0,0,0,1668,1669,1,0,0,0,1669,
	1670,1,0,0,0,1670,1671,5,54,0,0,1671,1672,3,110,55,0,1672,153,1,0,0,0,1673,
	1677,3,254,127,0,1674,1676,3,244,122,0,1675,1674,1,0,0,0,1676,1679,1,0,
	0,0,1677,1675,1,0,0,0,1677,1678,1,0,0,0,1678,1680,1,0,0,0,1679,1677,1,0,
	0,0,1680,1683,5,180,0,0,1681,1682,5,44,0,0,1682,1684,3,240,120,0,1683,1681,
	1,0,0,0,1683,1684,1,0,0,0,1684,1685,1,0,0,0,1685,1686,5,2,0,0,1686,1719,
	1,0,0,0,1687,1688,5,180,0,0,1688,1689,7,9,0,0,1689,1690,3,240,120,0,1690,
	1691,5,2,0,0,1691,1719,1,0,0,0,1692,1693,5,53,0,0,1693,1696,3,132,66,0,
	1694,1695,5,5,0,0,1695,1697,3,132,66,0,1696,1694,1,0,0,0,1697,1698,1,0,
	0,0,1698,1696,1,0,0,0,1698,1699,1,0,0,0,1699,1700,1,0,0,0,1700,1701,5,54,
	0,0,1701,1713,5,44,0,0,1702,1703,5,53,0,0,1703,1706,3,240,120,0,1704,1705,
	5,5,0,0,1705,1707,3,240,120,0,1706,1704,1,0,0,0,1707,1708,1,0,0,0,1708,
	1706,1,0,0,0,1708,1709,1,0,0,0,1709,1710,1,0,0,0,1710,1711,5,54,0,0,1711,
	1714,1,0,0,0,1712,1714,3,240,120,0,1713,1702,1,0,0,0,1713,1712,1,0,0,0,
	1714,1715,1,0,0,0,1715,1716,5,2,0,0,1716,1719,1,0,0,0,1717,1719,5,2,0,0,
	1718,1673,1,0,0,0,1718,1687,1,0,0,0,1718,1692,1,0,0,0,1718,1717,1,0,0,0,
	1719,155,1,0,0,0,1720,1722,3,240,120,0,1721,1720,1,0,0,0,1721,1722,1,0,
	0,0,1722,1723,1,0,0,0,1723,1724,5,2,0,0,1724,157,1,0,0,0,1725,1726,5,180,
	0,0,1726,1727,7,9,0,0,1727,1756,3,240,120,0,1728,1729,5,180,0,0,1729,1756,
	7,10,0,0,1730,1731,7,10,0,0,1731,1756,5,180,0,0,1732,1733,5,53,0,0,1733,
	1736,3,132,66,0,1734,1735,5,5,0,0,1735,1737,3,132,66,0,1736,1734,1,0,0,
	0,1737,1738,1,0,0,0,1738,1736,1,0,0,0,1738,1739,1,0,0,0,1739,1740,1,0,0,
	0,1740,1741,5,54,0,0,1741,1753,5,44,0,0,1742,1743,5,53,0,0,1743,1746,3,
	240,120,0,1744,1745,5,5,0,0,1745,1747,3,240,120,0,1746,1744,1,0,0,0,1747,
	1748,1,0,0,0,1748,1746,1,0,0,0,1748,1749,1,0,0,0,1749,1750,1,0,0,0,1750,
	1751,5,54,0,0,1751,1754,1,0,0,0,1752,1754,3,240,120,0,1753,1742,1,0,0,0,
	1753,1752,1,0,0,0,1754,1756,1,0,0,0,1755,1725,1,0,0,0,1755,1728,1,0,0,0,
	1755,1730,1,0,0,0,1755,1732,1,0,0,0,1756,159,1,0,0,0,1757,1758,5,97,0,0,
	1758,1759,3,110,55,0,1759,1760,5,98,0,0,1760,1761,5,53,0,0,1761,1762,3,
	240,120,0,1762,1763,5,54,0,0,1763,1764,5,2,0,0,1764,161,1,0,0,0,1765,1766,
	5,98,0,0,1766,1767,5,53,0,0,1767,1768,3,240,120,0,1768,1769,5,54,0,0,1769,
	1770,3,110,55,0,1770,163,1,0,0,0,1771,1772,5,99,0,0,1772,1773,3,224,112,
	0,1773,1774,5,2,0,0,1774,165,1,0,0,0,1775,1777,5,100,0,0,1776,1778,5,151,
	0,0,1777,1776,1,0,0,0,1777,1778,1,0,0,0,1778,1789,1,0,0,0,1779,1780,5,53,
	0,0,1780,1785,5,151,0,0,1781,1782,5,5,0,0,1782,1784,5,151,0,0,1783,1781,
	1,0,0,0,1784,1787,1,0,0,0,1785,1783,1,0,0,0,1785,1786,1,0,0,0,1786,1788,
	1,0,0,0,1787,1785,1,0,0,0,1788,1790,5,54,0,0,1789,1779,1,0,0,0,1789,1790,
	1,0,0,0,1790,1791,1,0,0,0,1791,1792,3,168,84,0,1792,167,1,0,0,0,1793,1797,
	5,4,0,0,1794,1796,3,170,85,0,1795,1794,1,0,0,0,1796,1799,1,0,0,0,1797,1795,
	1,0,0,0,1797,1798,1,0,0,0,1798,1800,1,0,0,0,1799,1797,1,0,0,0,1800,1801,
	5,6,0,0,1801,169,1,0,0,0,1802,1816,3,168,84,0,1803,1816,3,172,86,0,1804,
	1816,3,174,87,0,1805,1816,3,176,88,0,1806,1816,3,178,89,0,1807,1816,3,184,
	92,0,1808,1816,3,186,93,0,1809,1816,5,101,0,0,1810,1816,5,102,0,0,1811,
	1816,5,37,0,0,1812,1816,3,190,95,0,1813,1816,3,194,97,0,1814,1816,3,196,
	98,0,1815,1802,1,0,0,0,1815,1803,1,0,0,0,1815,1804,1,0,0,0,1815,1805,1,
	0,0,0,1815,1806,1,0,0,0,1815,1807,1,0,0,0,1815,1808,1,0,0,0,1815,1809,1,
	0,0,0,1815,1810,1,0,0,0,1815,1811,1,0,0,0,1815,1812,1,0,0,0,1815,1813,1,
	0,0,0,1815,1814,1,0,0,0,1816,171,1,0,0,0,1817,1818,5,103,0,0,1818,1823,
	3,14,7,0,1819,1820,5,5,0,0,1820,1822,3,14,7,0,1821,1819,1,0,0,0,1822,1825,
	1,0,0,0,1823,1821,1,0,0,0,1823,1824,1,0,0,0,1824,1828,1,0,0,0,1825,1823,
	1,0,0,0,1826,1827,5,104,0,0,1827,1829,3,188,94,0,1828,1826,1,0,0,0,1828,
	1829,1,0,0,0,1829,173,1,0,0,0,1830,1835,3,194,97,0,1831,1832,5,5,0,0,1832,
	1834,3,194,97,0,1833,1831,1,0,0,0,1834,1837,1,0,0,0,1835,1833,1,0,0,0,1835,
	1836,1,0,0,0,1836,1838,1,0,0,0,1837,1835,1,0,0,0,1838,1839,5,104,0,0,1839,
	1840,3,188,94,0,1840,175,1,0,0,0,1841,1842,5,93,0,0,1842,1843,3,188,94,
	0,1843,1844,3,168,84,0,1844,177,1,0,0,0,1845,1846,5,105,0,0,1846,1856,3,
	188,94,0,1847,1849,3,180,90,0,1848,1847,1,0,0,0,1849,1850,1,0,0,0,1850,
	1848,1,0,0,0,1850,1851,1,0,0,0,1851,1853,1,0,0,0,1852,1854,3,182,91,0,1853,
	1852,1,0,0,0,1853,1854,1,0,0,0,1854,1857,1,0,0,0,1855,1857,3,182,91,0,1856,
	1848,1,0,0,0,1856,1855,1,0,0,0,1857,179,1,0,0,0,1858,1859,5,106,0,0,1859,
	1860,3,196,98,0,1860,1861,3,168,84,0,1861,181,1,0,0,0,1862,1863,5,107,0,
	0,1863,1864,3,168,84,0,1864,183,1,0,0,0,1865,1866,5,9,0,0,1866,1867,3,168,
	84,0,1867,1868,3,188,94,0,1868,1869,3,168,84,0,1869,1870,3,168,84,0,1870,
	185,1,0,0,0,1871,1872,5,7,0,0,1872,1873,5,180,0,0,1873,1882,5,53,0,0,1874,
	1879,5,180,0,0,1875,1876,5,5,0,0,1876,1878,5,180,0,0,1877,1875,1,0,0,0,
	1878,1881,1,0,0,0,1879,1877,1,0,0,0,1879,1880,1,0,0,0,1880,1883,1,0,0,0,
	1881,1879,1,0,0,0,1882,1874,1,0,0,0,1882,1883,1,0,0,0,1883,1884,1,0,0,0,
	1884,1894,5,54,0,0,1885,1886,5,108,0,0,1886,1891,5,180,0,0,1887,1888,5,
	5,0,0,1888,1890,5,180,0,0,1889,1887,1,0,0,0,1890,1893,1,0,0,0,1891,1889,
	1,0,0,0,1891,1892,1,0,0,0,1892,1895,1,0,0,0,1893,1891,1,0,0,0,1894,1885,
	1,0,0,0,1894,1895,1,0,0,0,1895,1896,1,0,0,0,1896,1897,3,168,84,0,1897,187,
	1,0,0,0,1898,1902,3,190,95,0,1899,1902,3,194,97,0,1900,1902,3,196,98,0,
	1901,1898,1,0,0,0,1901,1899,1,0,0,0,1901,1900,1,0,0,0,1902,189,1,0,0,0,
	1903,1904,3,192,96,0,1904,1913,5,53,0,0,1905,1910,3,188,94,0,1906,1907,
	5,5,0,0,1907,1909,3,188,94,0,1908,1906,1,0,0,0,1909,1912,1,0,0,0,1910,1908,
	1,0,0,0,1910,1911,1,0,0,0,1911,1914,1,0,0,0,1912,1910,1,0,0,0,1913,1905,
	1,0,0,0,1913,1914,1,0,0,0,1914,1915,1,0,0,0,1915,1916,5,54,0,0,1916,191,
	1,0,0,0,1917,1918,7,11,0,0,1918,193,1,0,0,0,1919,1925,3,14,7,0,1920,1921,
	5,12,0,0,1921,1924,3,14,7,0,1922,1924,5,164,0,0,1923,1920,1,0,0,0,1923,
	1922,1,0,0,0,1924,1927,1,0,0,0,1925,1923,1,0,0,0,1925,1926,1,0,0,0,1926,
	195,1,0,0,0,1927,1925,1,0,0,0,1928,1929,7,12,0,0,1929,197,1,0,0,0,1930,
	1931,5,110,0,0,1931,1935,5,4,0,0,1932,1934,3,114,57,0,1933,1932,1,0,0,0,
	1934,1937,1,0,0,0,1935,1933,1,0,0,0,1935,1936,1,0,0,0,1936,1938,1,0,0,0,
	1937,1935,1,0,0,0,1938,1939,5,6,0,0,1939,199,1,0,0,0,1940,1941,5,105,0,
	0,1941,1942,5,53,0,0,1942,1943,3,240,120,0,1943,1944,5,54,0,0,1944,1948,
	5,4,0,0,1945,1947,3,202,101,0,1946,1945,1,0,0,0,1947,1950,1,0,0,0,1948,
	1946,1,0,0,0,1948,1949,1,0,0,0,1949,1952,1,0,0,0,1950,1948,1,0,0,0,1951,
	1953,3,204,102,0,1952,1951,1,0,0,0,1952,1953,1,0,0,0,1953,1954,1,0,0,0,
	1954,1955,5,6,0,0,1955,201,1,0,0,0,1956,1957,5,106,0,0,1957,1958,3,240,
	120,0,1958,1962,5,111,0,0,1959,1961,3,114,57,0,1960,1959,1,0,0,0,1961,1964,
	1,0,0,0,1962,1960,1,0,0,0,1962,1963,1,0,0,0,1963,203,1,0,0,0,1964,1962,
	1,0,0,0,1965,1966,5,107,0,0,1966,1970,5,111,0,0,1967,1969,3,114,57,0,1968,
	1967,1,0,0,0,1969,1972,1,0,0,0,1970,1968,1,0,0,0,1970,1971,1,0,0,0,1971,
	205,1,0,0,0,1972,1970,1,0,0,0,1973,1974,5,112,0,0,1974,1976,3,240,120,0,
	1975,1977,3,208,104,0,1976,1975,1,0,0,0,1976,1977,1,0,0,0,1977,1978,1,0,
	0,0,1978,1980,3,110,55,0,1979,1981,3,210,105,0,1980,1979,1,0,0,0,1981,1982,
	1,0,0,0,1982,1980,1,0,0,0,1982,1983,1,0,0,0,1983,207,1,0,0,0,1984,1985,
	5,75,0,0,1985,1997,5,53,0,0,1986,1991,3,108,54,0,1987,1988,5,5,0,0,1988,
	1990,3,108,54,0,1989,1987,1,0,0,0,1990,1993,1,0,0,0,1991,1989,1,0,0,0,1991,
	1992,1,0,0,0,1992,1995,1,0,0,0,1993,1991,1,0,0,0,1994,1996,5,5,0,0,1995,
	1994,1,0,0,0,1995,1996,1,0,0,0,1996,1998,1,0,0,0,1997,1986,1,0,0,0,1997,
	1998,1,0,0,0,1998,1999,1,0,0,0,1999,2000,5,54,0,0,2000,209,1,0,0,0,2001,
	2003,5,113,0,0,2002,2004,5,180,0,0,2003,2002,1,0,0,0,2003,2004,1,0,0,0,
	2004,2020,1,0,0,0,2005,2017,5,53,0,0,2006,2011,3,108,54,0,2007,2008,5,5,
	0,0,2008,2010,3,108,54,0,2009,2007,1,0,0,0,2010,2013,1,0,0,0,2011,2009,
	1,0,0,0,2011,2012,1,0,0,0,2012,2015,1,0,0,0,2013,2011,1,0,0,0,2014,2016,
	5,5,0,0,2015,2014,1,0,0,0,2015,2016,1,0,0,0,2016,2018,1,0,0,0,2017,2006,
	1,0,0,0,2017,2018,1,0,0,0,2018,2019,1,0,0,0,2019,2021,5,54,0,0,2020,2005,
	1,0,0,0,2020,2021,1,0,0,0,2021,2022,1,0,0,0,2022,2023,3,110,55,0,2023,211,
	1,0,0,0,2024,2025,5,101,0,0,2025,2026,5,2,0,0,2026,213,1,0,0,0,2027,2028,
	5,102,0,0,2028,2029,5,2,0,0,2029,215,1,0,0,0,2030,2035,5,151,0,0,2031,2032,
	5,180,0,0,2032,2035,3,230,115,0,2033,2035,3,240,120,0,2034,2030,1,0,0,0,
	2034,2031,1,0,0,0,2034,2033,1,0,0,0,2035,217,1,0,0,0,2036,2037,5,35,0,0,
	2037,2040,3,14,7,0,2038,2039,5,12,0,0,2039,2041,5,180,0,0,2040,2038,1,0,
	0,0,2040,2041,1,0,0,0,2041,2042,1,0,0,0,2042,2043,5,53,0,0,2043,2055,5,
	4,0,0,2044,2049,3,228,114,0,2045,2046,5,5,0,0,2046,2048,3,228,114,0,2047,
	2045,1,0,0,0,2048,2051,1,0,0,0,2049,2047,1,0,0,0,2049,2050,1,0,0,0,2050,
	2053,1,0,0,0,2051,2049,1,0,0,0,2052,2054,5,5,0,0,2053,2052,1,0,0,0,2053,
	2054,1,0,0,0,2054,2056,1,0,0,0,2055,2044,1,0,0,0,2055,2056,1,0,0,0,2056,
	2057,1,0,0,0,2057,2058,5,6,0,0,2058,2059,5,54,0,0,2059,2060,5,2,0,0,2060,
	2081,1,0,0,0,2061,2062,5,35,0,0,2062,2065,3,14,7,0,2063,2064,5,12,0,0,2064,
	2066,5,180,0,0,2065,2063,1,0,0,0,2065,2066,1,0,0,0,2066,2067,1,0,0,0,2067,
	2068,3,230,115,0,2068,2069,5,2,0,0,2069,2081,1,0,0,0,2070,2071,5,35,0,0,
	2071,2072,5,53,0,0,2072,2073,3,240,120,0,2073,2074,5,54,0,0,2074,2075,5,
	2,0,0,2075,2081,1,0,0,0,2076,2077,5,35,0,0,2077,2078,5,53,0,0,2078,2079,
	5,54,0,0,2079,2081,5,2,0,0,2080,2036,1,0,0,0,2080,2061,1,0,0,0,2080,2070,
	1,0,0,0,2080,2076,1,0,0,0,2081,219,1,0,0,0,2082,2083,5,114,0,0,2083,2084,
	5,53,0,0,2084,2085,3,240,120,0,2085,2086,5,54,0,0,2086,2087,5,2,0,0,2087,
	221,1,0,0,0,2088,2091,5,180,0,0,2089,2091,3,248,124,0,2090,2088,1,0,0,0,
	2090,2089,1,0,0,0,2091,223,1,0,0,0,2092,2104,5,53,0,0,2093,2098,3,222,111,
	0,2094,2095,5,5,0,0,2095,2097,3,222,111,0,2096,2094,1,0,0,0,2097,2100,1,
	0,0,0,2098,2096,1,0,0,0,2098,2099,1,0,0,0,2099,2102,1,0,0,0,2100,2098,1,
	0,0,0,2101,2103,5,5,0,0,2102,2101,1,0,0,0,2102,2103,1,0,0,0,2103,2105,1,
	0,0,0,2104,2093,1,0,0,0,2104,2105,1,0,0,0,2105,2106,1,0,0,0,2106,2107,5,
	54,0,0,2107,225,1,0,0,0,2108,2109,5,180,0,0,2109,2143,3,230,115,0,2110,
	2111,5,180,0,0,2111,2112,5,12,0,0,2112,2113,5,180,0,0,2113,2143,3,230,115,
	0,2114,2115,5,180,0,0,2115,2116,5,53,0,0,2116,2128,5,4,0,0,2117,2122,3,
	228,114,0,2118,2119,5,5,0,0,2119,2121,3,228,114,0,2120,2118,1,0,0,0,2121,
	2124,1,0,0,0,2122,2120,1,0,0,0,2122,2123,1,0,0,0,2123,2126,1,0,0,0,2124,
	2122,1,0,0,0,2125,2127,5,5,0,0,2126,2125,1,0,0,0,2126,2127,1,0,0,0,2127,
	2129,1,0,0,0,2128,2117,1,0,0,0,2128,2129,1,0,0,0,2129,2130,1,0,0,0,2130,
	2131,5,6,0,0,2131,2143,5,54,0,0,2132,2133,5,53,0,0,2133,2134,5,180,0,0,
	2134,2135,5,54,0,0,2135,2143,3,230,115,0,2136,2137,5,53,0,0,2137,2138,5,
	180,0,0,2138,2139,5,12,0,0,2139,2140,5,180,0,0,2140,2141,5,54,0,0,2141,
	2143,3,230,115,0,2142,2108,1,0,0,0,2142,2110,1,0,0,0,2142,2114,1,0,0,0,
	2142,2132,1,0,0,0,2142,2136,1,0,0,0,2143,227,1,0,0,0,2144,2145,5,180,0,
	0,2145,2146,5,111,0,0,2146,2147,3,240,120,0,2147,229,1,0,0,0,2148,2160,
	5,53,0,0,2149,2154,3,240,120,0,2150,2151,5,5,0,0,2151,2153,3,240,120,0,
	2152,2150,1,0,0,0,2153,2156,1,0,0,0,2154,2152,1,0,0,0,2154,2155,1,0,0,0,
	2155,2158,1,0,0,0,2156,2154,1,0,0,0,2157,2159,5,5,0,0,2158,2157,1,0,0,0,
	2158,2159,1,0,0,0,2159,2161,1,0,0,0,2160,2149,1,0,0,0,2160,2161,1,0,0,0,
	2161,2162,1,0,0,0,2162,2163,5,54,0,0,2163,231,1,0,0,0,2164,2165,5,4,0,0,
	2165,2170,3,234,117,0,2166,2167,5,5,0,0,2167,2169,3,234,117,0,2168,2166,
	1,0,0,0,2169,2172,1,0,0,0,2170,2168,1,0,0,0,2170,2171,1,0,0,0,2171,2174,
	1,0,0,0,2172,2170,1,0,0,0,2173,2175,5,5,0,0,2174,2173,1,0,0,0,2174,2175,
	1,0,0,0,2175,2176,1,0,0,0,2176,2177,5,6,0,0,2177,233,1,0,0,0,2178,2179,
	5,180,0,0,2179,2180,5,111,0,0,2180,2181,3,240,120,0,2181,235,1,0,0,0,2182,
	2183,5,53,0,0,2183,2188,3,238,119,0,2184,2185,5,5,0,0,2185,2187,3,238,119,
	0,2186,2184,1,0,0,0,2187,2190,1,0,0,0,2188,2186,1,0,0,0,2188,2189,1,0,0,
	0,2189,2192,1,0,0,0,2190,2188,1,0,0,0,2191,2193,5,5,0,0,2192,2191,1,0,0,
	0,2192,2193,1,0,0,0,2193,2194,1,0,0,0,2194,2195,5,54,0,0,2195,237,1,0,0,
	0,2196,2199,3,254,127,0,2197,2199,3,84,42,0,2198,2196,1,0,0,0,2198,2197,
	1,0,0,0,2199,239,1,0,0,0,2200,2201,6,120,-1,0,2201,2202,5,53,0,0,2202,2203,
	5,180,0,0,2203,2204,7,9,0,0,2204,2205,3,240,120,0,2205,2206,5,54,0,0,2206,
	2379,1,0,0,0,2207,2208,5,53,0,0,2208,2209,5,115,0,0,2209,2210,5,180,0,0,
	2210,2211,5,54,0,0,2211,2212,3,232,116,0,2212,2213,3,230,115,0,2213,2379,
	1,0,0,0,2214,2215,5,53,0,0,2215,2216,3,240,120,0,2216,2217,5,54,0,0,2217,
	2379,1,0,0,0,2218,2219,5,53,0,0,2219,2222,3,240,120,0,2220,2221,5,5,0,0,
	2221,2223,3,240,120,0,2222,2220,1,0,0,0,2223,2224,1,0,0,0,2224,2222,1,0,
	0,0,2224,2225,1,0,0,0,2225,2226,1,0,0,0,2226,2227,5,54,0,0,2227,2379,1,
	0,0,0,2228,2229,3,256,128,0,2229,2230,5,53,0,0,2230,2232,3,240,120,0,2231,
	2233,5,5,0,0,2232,2231,1,0,0,0,2232,2233,1,0,0,0,2233,2234,1,0,0,0,2234,
	2235,5,54,0,0,2235,2379,1,0,0,0,2236,2379,3,226,113,0,2237,2238,5,53,0,
	0,2238,2239,3,240,120,0,2239,2240,5,54,0,0,2240,2241,3,230,115,0,2241,2379,
	1,0,0,0,2242,2243,5,115,0,0,2243,2245,5,180,0,0,2244,2246,3,232,116,0,2245,
	2244,1,0,0,0,2245,2246,1,0,0,0,2246,2247,1,0,0,0,2247,2379,3,230,115,0,
	2248,2249,5,115,0,0,2249,2255,3,254,127,0,2250,2252,5,68,0,0,2251,2253,
	5,145,0,0,2252,2251,1,0,0,0,2252,2253,1,0,0,0,2253,2254,1,0,0,0,2254,2256,
	5,69,0,0,2255,2250,1,0,0,0,2256,2257,1,0,0,0,2257,2255,1,0,0,0,2257,2258,
	1,0,0,0,2258,2259,1,0,0,0,2259,2260,5,53,0,0,2260,2261,3,240,120,0,2261,
	2262,5,54,0,0,2262,2379,1,0,0,0,2263,2264,5,115,0,0,2264,2265,5,148,0,0,
	2265,2266,5,53,0,0,2266,2267,3,240,120,0,2267,2268,5,54,0,0,2268,2379,1,
	0,0,0,2269,2270,5,115,0,0,2270,2271,5,146,0,0,2271,2272,5,53,0,0,2272,2273,
	3,240,120,0,2273,2274,5,54,0,0,2274,2379,1,0,0,0,2275,2276,5,59,0,0,2276,
	2277,5,53,0,0,2277,2278,3,254,127,0,2278,2279,5,54,0,0,2279,2280,5,12,0,
	0,2280,2281,5,180,0,0,2281,2379,1,0,0,0,2282,2283,5,116,0,0,2283,2379,3,
	230,115,0,2284,2285,5,117,0,0,2285,2379,3,230,115,0,2286,2287,5,118,0,0,
	2287,2379,3,230,115,0,2288,2289,5,119,0,0,2289,2379,3,230,115,0,2290,2291,
	5,120,0,0,2291,2292,5,53,0,0,2292,2293,7,13,0,0,2293,2294,5,12,0,0,2294,
	2295,5,180,0,0,2295,2296,5,5,0,0,2296,2297,3,230,115,0,2297,2298,5,54,0,
	0,2298,2379,1,0,0,0,2299,2300,5,121,0,0,2300,2379,3,230,115,0,2301,2302,
	5,122,0,0,2302,2379,3,230,115,0,2303,2304,5,123,0,0,2304,2305,5,53,0,0,
	2305,2306,3,240,120,0,2306,2307,5,5,0,0,2307,2308,3,236,118,0,2308,2309,
	5,54,0,0,2309,2379,1,0,0,0,2310,2311,5,124,0,0,2311,2312,5,53,0,0,2312,
	2313,3,240,120,0,2313,2314,5,5,0,0,2314,2315,3,236,118,0,2315,2316,5,5,
	0,0,2316,2317,5,145,0,0,2317,2318,5,54,0,0,2318,2379,1,0,0,0,2319,2320,
	5,125,0,0,2320,2321,5,68,0,0,2321,2322,3,240,120,0,2322,2323,5,69,0,0,2323,
	2324,7,14,0,0,2324,2379,1,0,0,0,2325,2326,5,126,0,0,2326,2327,5,68,0,0,
	2327,2328,3,240,120,0,2328,2329,5,69,0,0,2329,2330,7,15,0,0,2330,2379,1,
	0,0,0,2331,2332,7,10,0,0,2332,2379,3,240,120,22,2333,2334,7,16,0,0,2334,
	2379,3,240,120,21,2335,2347,5,68,0,0,2336,2341,3,240,120,0,2337,2338,5,
	5,0,0,2338,2340,3,240,120,0,2339,2337,1,0,0,0,2340,2343,1,0,0,0,2341,2339,
	1,0,0,0,2341,2342,1,0,0,0,2342,2345,1,0,0,0,2343,2341,1,0,0,0,2344,2346,
	5,5,0,0,2345,2344,1,0,0,0,2345,2346,1,0,0,0,2346,2348,1,0,0,0,2347,2336,
	1,0,0,0,2347,2348,1,0,0,0,2348,2349,1,0,0,0,2349,2379,5,69,0,0,2350,2351,
	5,91,0,0,2351,2352,5,12,0,0,2352,2353,5,180,0,0,2353,2354,5,12,0,0,2354,
	2355,5,180,0,0,2355,2356,5,68,0,0,2356,2357,3,240,120,0,2357,2358,5,69,
	0,0,2358,2359,3,242,121,0,2359,2379,1,0,0,0,2360,2361,5,91,0,0,2361,2362,
	5,12,0,0,2362,2367,5,180,0,0,2363,2364,5,68,0,0,2364,2365,3,240,120,0,2365,
	2366,5,69,0,0,2366,2368,1,0,0,0,2367,2363,1,0,0,0,2368,2369,1,0,0,0,2369,
	2367,1,0,0,0,2369,2370,1,0,0,0,2370,2379,1,0,0,0,2371,2372,5,91,0,0,2372,
	2373,5,12,0,0,2373,2379,5,180,0,0,2374,2379,5,91,0,0,2375,2379,5,160,0,
	0,2376,2379,3,14,7,0,2377,2379,3,248,124,0,2378,2200,1,0,0,0,2378,2207,
	1,0,0,0,2378,2214,1,0,0,0,2378,2218,1,0,0,0,2378,2228,1,0,0,0,2378,2236,
	1,0,0,0,2378,2237,1,0,0,0,2378,2242,1,0,0,0,2378,2248,1,0,0,0,2378,2263,
	1,0,0,0,2378,2269,1,0,0,0,2378,2275,1,0,0,0,2378,2282,1,0,0,0,2378,2284,
	1,0,0,0,2378,2286,1,0,0,0,2378,2288,1,0,0,0,2378,2290,1,0,0,0,2378,2299,
	1,0,0,0,2378,2301,1,0,0,0,2378,2303,1,0,0,0,2378,2310,1,0,0,0,2378,2319,
	1,0,0,0,2378,2325,1,0,0,0,2378,2331,1,0,0,0,2378,2333,1,0,0,0,2378,2335,
	1,0,0,0,2378,2350,1,0,0,0,2378,2360,1,0,0,0,2378,2371,1,0,0,0,2378,2374,
	1,0,0,0,2378,2375,1,0,0,0,2378,2376,1,0,0,0,2378,2377,1,0,0,0,2379,2516,
	1,0,0,0,2380,2381,10,20,0,0,2381,2382,5,17,0,0,2382,2515,3,240,120,20,2383,
	2384,10,19,0,0,2384,2385,7,17,0,0,2385,2515,3,240,120,20,2386,2387,10,18,
	0,0,2387,2388,7,18,0,0,2388,2515,3,240,120,19,2389,2390,10,17,0,0,2390,
	2391,7,19,0,0,2391,2515,3,240,120,18,2392,2393,10,16,0,0,2393,2394,5,24,
	0,0,2394,2515,3,240,120,17,2395,2396,10,15,0,0,2396,2397,5,26,0,0,2397,
	2515,3,240,120,16,2398,2399,10,14,0,0,2399,2400,5,25,0,0,2400,2515,3,240,
	120,15,2401,2402,10,13,0,0,2402,2403,7,20,0,0,2403,2515,3,240,120,14,2404,
	2405,10,12,0,0,2405,2406,7,21,0,0,2406,2515,3,240,120,13,2407,2408,10,11,
	0,0,2408,2409,5,131,0,0,2409,2515,3,240,120,12,2410,2411,10,10,0,0,2411,
	2412,5,132,0,0,2412,2515,3,240,120,11,2413,2414,10,36,0,0,2414,2416,5,68,
	0,0,2415,2417,3,240,120,0,2416,2415,1,0,0,0,2416,2417,1,0,0,0,2417,2418,
	1,0,0,0,2418,2420,5,111,0,0,2419,2421,3,240,120,0,2420,2419,1,0,0,0,2420,
	2421,1,0,0,0,2421,2422,1,0,0,0,2422,2515,5,69,0,0,2423,2424,10,35,0,0,2424,
	2425,5,68,0,0,2425,2426,5,145,0,0,2426,2515,5,69,0,0,2427,2428,10,34,0,
	0,2428,2429,5,68,0,0,2429,2430,3,240,120,0,2430,2431,5,69,0,0,2431,2515,
	1,0,0,0,2432,2433,10,31,0,0,2433,2515,7,22,0,0,2434,2435,10,30,0,0,2435,
	2436,5,167,0,0,2436,2437,5,53,0,0,2437,2438,3,240,120,0,2438,2439,5,54,
	0,0,2439,2515,1,0,0,0,2440,2441,10,29,0,0,2441,2442,5,168,0,0,2442,2443,
	5,53,0,0,2443,2444,3,240,120,0,2444,2445,5,5,0,0,2445,2446,3,240,120,0,
	2446,2447,5,54,0,0,2447,2515,1,0,0,0,2448,2449,10,28,0,0,2449,2450,5,12,
	0,0,2450,2454,5,180,0,0,2451,2452,5,12,0,0,2452,2455,5,180,0,0,2453,2455,
	5,163,0,0,2454,2451,1,0,0,0,2454,2453,1,0,0,0,2455,2456,1,0,0,0,2456,2457,
	5,53,0,0,2457,2458,3,240,120,0,2458,2459,5,54,0,0,2459,2460,3,230,115,0,
	2460,2515,1,0,0,0,2461,2462,10,27,0,0,2462,2463,5,12,0,0,2463,2465,5,180,
	0,0,2464,2466,3,232,116,0,2465,2464,1,0,0,0,2465,2466,1,0,0,0,2466,2467,
	1,0,0,0,2467,2468,5,53,0,0,2468,2480,5,4,0,0,2469,2474,3,228,114,0,2470,
	2471,5,5,0,0,2471,2473,3,228,114,0,2472,2470,1,0,0,0,2473,2476,1,0,0,0,
	2474,2472,1,0,0,0,2474,2475,1,0,0,0,2475,2478,1,0,0,0,2476,2474,1,0,0,0,
	2477,2479,5,5,0,0,2478,2477,1,0,0,0,2478,2479,1,0,0,0,2479,2481,1,0,0,0,
	2480,2469,1,0,0,0,2480,2481,1,0,0,0,2481,2482,1,0,0,0,2482,2483,5,6,0,0,
	2483,2515,5,54,0,0,2484,2485,10,26,0,0,2485,2486,5,12,0,0,2486,2488,5,180,
	0,0,2487,2489,3,232,116,0,2488,2487,1,0,0,0,2488,2489,1,0,0,0,2489,2490,
	1,0,0,0,2490,2515,3,230,115,0,2491,2492,10,25,0,0,2492,2493,5,68,0,0,2493,
	2494,3,240,120,0,2494,2495,5,69,0,0,2495,2496,3,230,115,0,2496,2515,1,0,
	0,0,2497,2498,10,24,0,0,2498,2515,3,242,121,0,2499,2500,10,23,0,0,2500,
	2515,7,10,0,0,2501,2502,10,9,0,0,2502,2503,5,133,0,0,2503,2506,3,240,120,
	0,2504,2505,7,9,0,0,2505,2507,3,118,59,0,2506,2504,1,0,0,0,2506,2507,1,
	0,0,0,2507,2508,1,0,0,0,2508,2509,5,111,0,0,2509,2512,3,240,120,0,2510,
	2511,7,9,0,0,2511,2513,3,118,59,0,2512,2510,1,0,0,0,2512,2513,1,0,0,0,2513,
	2515,1,0,0,0,2514,2380,1,0,0,0,2514,2383,1,0,0,0,2514,2386,1,0,0,0,2514,
	2389,1,0,0,0,2514,2392,1,0,0,0,2514,2395,1,0,0,0,2514,2398,1,0,0,0,2514,
	2401,1,0,0,0,2514,2404,1,0,0,0,2514,2407,1,0,0,0,2514,2410,1,0,0,0,2514,
	2413,1,0,0,0,2514,2423,1,0,0,0,2514,2427,1,0,0,0,2514,2432,1,0,0,0,2514,
	2434,1,0,0,0,2514,2440,1,0,0,0,2514,2448,1,0,0,0,2514,2461,1,0,0,0,2514,
	2484,1,0,0,0,2514,2491,1,0,0,0,2514,2497,1,0,0,0,2514,2499,1,0,0,0,2514,
	2501,1,0,0,0,2515,2518,1,0,0,0,2516,2514,1,0,0,0,2516,2517,1,0,0,0,2517,
	241,1,0,0,0,2518,2516,1,0,0,0,2519,2520,5,12,0,0,2520,2535,5,180,0,0,2521,
	2522,5,12,0,0,2522,2535,5,109,0,0,2523,2535,5,163,0,0,2524,2535,5,172,0,
	0,2525,2535,5,173,0,0,2526,2535,5,174,0,0,2527,2535,5,175,0,0,2528,2535,
	5,176,0,0,2529,2535,5,177,0,0,2530,2535,5,178,0,0,2531,2535,5,179,0,0,2532,
	2535,5,170,0,0,2533,2535,5,171,0,0,2534,2519,1,0,0,0,2534,2521,1,0,0,0,
	2534,2523,1,0,0,0,2534,2524,1,0,0,0,2534,2525,1,0,0,0,2534,2526,1,0,0,0,
	2534,2527,1,0,0,0,2534,2528,1,0,0,0,2534,2529,1,0,0,0,2534,2530,1,0,0,0,
	2534,2531,1,0,0,0,2534,2532,1,0,0,0,2534,2533,1,0,0,0,2535,243,1,0,0,0,
	2536,2537,7,23,0,0,2537,245,1,0,0,0,2538,2539,7,24,0,0,2539,247,1,0,0,0,
	2540,2555,5,141,0,0,2541,2555,3,250,125,0,2542,2555,3,252,126,0,2543,2547,
	5,151,0,0,2544,2546,5,151,0,0,2545,2544,1,0,0,0,2546,2549,1,0,0,0,2547,
	2545,1,0,0,0,2547,2548,1,0,0,0,2548,2555,1,0,0,0,2549,2547,1,0,0,0,2550,
	2555,5,161,0,0,2551,2555,5,162,0,0,2552,2555,5,152,0,0,2553,2555,5,153,
	0,0,2554,2540,1,0,0,0,2554,2541,1,0,0,0,2554,2542,1,0,0,0,2554,2543,1,0,
	0,0,2554,2550,1,0,0,0,2554,2551,1,0,0,0,2554,2552,1,0,0,0,2554,2553,1,0,
	0,0,2555,249,1,0,0,0,2556,2558,5,145,0,0,2557,2559,7,25,0,0,2558,2557,1,
	0,0,0,2558,2559,1,0,0,0,2559,251,1,0,0,0,2560,2562,5,144,0,0,2561,2563,
	7,25,0,0,2562,2561,1,0,0,0,2562,2563,1,0,0,0,2563,253,1,0,0,0,2564,2565,
	5,109,0,0,2565,2627,5,63,0,0,2566,2627,5,109,0,0,2567,2627,5,146,0,0,2568,
	2627,5,147,0,0,2569,2627,5,149,0,0,2570,2627,5,148,0,0,2571,2627,5,156,
	0,0,2572,2627,5,157,0,0,2573,2627,5,138,0,0,2574,2627,5,139,0,0,2575,2627,
	5,158,0,0,2576,2627,5,159,0,0,2577,2578,5,7,0,0,2578,2593,5,53,0,0,2579,
	2581,3,254,127,0,2580,2582,3,246,123,0,2581,2580,1,0,0,0,2581,2582,1,0,
	0,0,2582,2590,1,0,0,0,2583,2584,5,5,0,0,2584,2586,3,254,127,0,2585,2587,
	3,246,123,0,2586,2585,1,0,0,0,2586,2587,1,0,0,0,2587,2589,1,0,0,0,2588,
	2583,1,0,0,0,2589,2592,1,0,0,0,2590,2588,1,0,0,0,2590,2591,1,0,0,0,2591,
	2594,1,0,0,0,2592,2590,1,0,0,0,2593,2579,1,0,0,0,2593,2594,1,0,0,0,2594,
	2595,1,0,0,0,2595,2599,5,54,0,0,2596,2598,7,26,0,0,2597,2596,1,0,0,0,2598,
	2601,1,0,0,0,2599,2597,1,0,0,0,2599,2600,1,0,0,0,2600,2620,1,0,0,0,2601,
	2599,1,0,0,0,2602,2603,5,75,0,0,2603,2604,5,53,0,0,2604,2606,3,254,127,
	0,2605,2607,3,246,123,0,2606,2605,1,0,0,0,2606,2607,1,0,0,0,2607,2615,1,
	0,0,0,2608,2609,5,5,0,0,2609,2611,3,254,127,0,2610,2612,3,246,123,0,2611,
	2610,1,0,0,0,2611,2612,1,0,0,0,2612,2614,1,0,0,0,2613,2608,1,0,0,0,2614,
	2617,1,0,0,0,2615,2613,1,0,0,0,2615,2616,1,0,0,0,2616,2618,1,0,0,0,2617,
	2615,1,0,0,0,2618,2619,5,54,0,0,2619,2621,1,0,0,0,2620,2602,1,0,0,0,2620,
	2621,1,0,0,0,2621,2627,1,0,0,0,2622,2623,5,180,0,0,2623,2624,5,12,0,0,2624,
	2627,5,180,0,0,2625,2627,5,180,0,0,2626,2564,1,0,0,0,2626,2566,1,0,0,0,
	2626,2567,1,0,0,0,2626,2568,1,0,0,0,2626,2569,1,0,0,0,2626,2570,1,0,0,0,
	2626,2571,1,0,0,0,2626,2572,1,0,0,0,2626,2573,1,0,0,0,2626,2574,1,0,0,0,
	2626,2575,1,0,0,0,2626,2576,1,0,0,0,2626,2577,1,0,0,0,2626,2622,1,0,0,0,
	2626,2625,1,0,0,0,2627,255,1,0,0,0,2628,2629,7,27,0,0,2629,257,1,0,0,0,
	305,261,267,281,283,303,307,314,319,327,331,337,349,352,362,366,374,377,
	381,386,390,406,410,417,420,423,437,440,452,454,469,484,488,504,506,512,
	517,525,528,545,547,554,561,563,567,579,583,585,589,595,598,601,611,615,
	617,624,628,630,638,645,658,662,669,689,695,701,707,714,724,731,737,741,
	747,755,763,770,777,784,789,797,804,811,818,823,825,829,835,840,842,848,
	855,857,863,865,871,876,879,885,892,898,904,908,913,921,926,934,944,949,
	953,959,966,971,977,981,983,990,995,999,1009,1011,1015,1021,1028,1043,1052,
	1056,1062,1071,1075,1083,1087,1093,1097,1103,1107,1109,1117,1121,1123,1131,
	1135,1141,1145,1151,1155,1157,1163,1168,1174,1202,1221,1223,1231,1245,1247,
	1252,1263,1270,1290,1302,1306,1311,1323,1332,1336,1338,1347,1352,1358,1369,
	1371,1379,1388,1390,1398,1404,1408,1418,1430,1440,1451,1463,1477,1486,1492,
	1501,1513,1515,1519,1541,1553,1563,1571,1581,1584,1593,1603,1615,1623,1668,
	1677,1683,1698,1708,1713,1718,1721,1738,1748,1753,1755,1777,1785,1789,1797,
	1815,1823,1828,1835,1850,1853,1856,1879,1882,1891,1894,1901,1910,1913,1923,
	1925,1935,1948,1952,1962,1970,1976,1982,1991,1995,1997,2003,2011,2015,2017,
	2020,2034,2040,2049,2053,2055,2065,2080,2090,2098,2102,2104,2122,2126,2128,
	2142,2154,2158,2160,2170,2174,2188,2192,2198,2224,2232,2245,2252,2257,2341,
	2345,2347,2369,2378,2416,2420,2454,2465,2474,2478,2480,2488,2506,2512,2514,
	2516,2534,2547,2554,2558,2562,2581,2586,2590,2593,2599,2606,2611,2615,2620,
	2626];

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
	public usingForDirective_list(): UsingForDirectiveContext[] {
		return this.getTypedRuleContexts(UsingForDirectiveContext) as UsingForDirectiveContext[];
	}
	public usingForDirective(i: number): UsingForDirectiveContext {
		return this.getTypedRuleContext(UsingForDirectiveContext, i) as UsingForDirectiveContext;
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
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
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
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
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
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
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
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
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
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
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
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
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
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
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
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
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
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
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
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
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
	public _second!: Token;
	public _rhsPush!: Token;
	public _rhsPush2!: Token;
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
	public DotPush_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.DotPush);
	}
	public DotPush(i: number): TerminalNode {
		return this.getToken(SolidCashParser.DotPush, i);
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
	public anyIdentifier_list(): AnyIdentifierContext[] {
		return this.getTypedRuleContexts(AnyIdentifierContext) as AnyIdentifierContext[];
	}
	public anyIdentifier(i: number): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, i) as AnyIdentifierContext;
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
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
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
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
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
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
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
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
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
export class LegacyCallOptionCallContext extends ExpressionContext {
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
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
	public DotValue(): TerminalNode {
		return this.getToken(SolidCashParser.DotValue, 0);
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitLegacyCallOptionCall) {
			return visitor.visitLegacyCallOptionCall(this);
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
export class IndexedFunctionCallContext extends ExpressionContext {
	public _base!: ExpressionContext;
	public _index!: ExpressionContext;
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitIndexedFunctionCall) {
			return visitor.visitIndexedFunctionCall(this);
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
	public NumberLiteral_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.NumberLiteral);
	}
	public NumberLiteral(i: number): TerminalNode {
		return this.getToken(SolidCashParser.NumberLiteral, i);
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
export class ParenthesizedFunctionCallContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitParenthesizedFunctionCall) {
			return visitor.visitParenthesizedFunctionCall(this);
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
