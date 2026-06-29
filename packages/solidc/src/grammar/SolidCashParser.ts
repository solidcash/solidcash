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
	public static readonly RULE_yulBlock = 90;
	public static readonly RULE_yulStatement = 91;
	public static readonly RULE_yulVariableDeclaration = 92;
	public static readonly RULE_yulAssignment = 93;
	public static readonly RULE_yulIf = 94;
	public static readonly RULE_yulSwitch = 95;
	public static readonly RULE_yulCase = 96;
	public static readonly RULE_yulDefault = 97;
	public static readonly RULE_yulForLoop = 98;
	public static readonly RULE_yulFunctionDefinition = 99;
	public static readonly RULE_yulExpression = 100;
	public static readonly RULE_yulFunctionCall = 101;
	public static readonly RULE_yulFunctionName = 102;
	public static readonly RULE_yulPath = 103;
	public static readonly RULE_yulLiteral = 104;
	public static readonly RULE_uncheckedStatement = 105;
	public static readonly RULE_switchStatement = 106;
	public static readonly RULE_switchCase = 107;
	public static readonly RULE_switchDefault = 108;
	public static readonly RULE_tryCatchStatement = 109;
	public static readonly RULE_tryReturns = 110;
	public static readonly RULE_catchClause = 111;
	public static readonly RULE_breakStatement = 112;
	public static readonly RULE_continueStatement = 113;
	public static readonly RULE_requireMessage = 114;
	public static readonly RULE_revertStatement = 115;
	public static readonly RULE_assertStatement = 116;
	public static readonly RULE_consoleParameter = 117;
	public static readonly RULE_consoleParameterList = 118;
	public static readonly RULE_functionCall = 119;
	public static readonly RULE_namedArg = 120;
	public static readonly RULE_expressionList = 121;
	public static readonly RULE_callOptions = 122;
	public static readonly RULE_callOption = 123;
	public static readonly RULE_typeList = 124;
	public static readonly RULE_expression = 125;
	public static readonly RULE_memberName = 126;
	public static readonly RULE_modifier = 127;
	public static readonly RULE_literal = 128;
	public static readonly RULE_numberLiteral = 129;
	public static readonly RULE_decimalLiteral = 130;
	public static readonly RULE_typeName = 131;
	public static readonly RULE_typeCast = 132;
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
		"consoleStatement", "assemblyStatement", "yulBlock", "yulStatement", "yulVariableDeclaration", 
		"yulAssignment", "yulIf", "yulSwitch", "yulCase", "yulDefault", "yulForLoop", 
		"yulFunctionDefinition", "yulExpression", "yulFunctionCall", "yulFunctionName", 
		"yulPath", "yulLiteral", "uncheckedStatement", "switchStatement", "switchCase", 
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
			this.state = 269;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===37) {
				{
				{
				this.state = 266;
				this.pragmaDirective();
				}
				}
				this.state = 271;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 275;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===1) {
				{
				{
				this.state = 272;
				this.importDirective();
				}
				}
				this.state = 277;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 290;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1842241) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 288;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 2, this._ctx) ) {
				case 1:
					{
					this.state = 278;
					this.constantDefinition();
					}
					break;
				case 2:
					{
					this.state = 279;
					this.enumDefinition();
					}
					break;
				case 3:
					{
					this.state = 280;
					this.structDefinition();
					}
					break;
				case 4:
					{
					this.state = 281;
					this.typeDefinition();
					}
					break;
				case 5:
					{
					this.state = 282;
					this.usingForDirective();
					}
					break;
				case 6:
					{
					this.state = 283;
					this.errorDefinition();
					}
					break;
				case 7:
					{
					this.state = 284;
					this.interfaceDefinition();
					}
					break;
				case 8:
					{
					this.state = 285;
					this.freeFunctionDefinition();
					}
					break;
				case 9:
					{
					this.state = 286;
					this.libraryDefinition();
					}
					break;
				case 10:
					{
					this.state = 287;
					this.contractDefinition();
					}
					break;
				}
				}
				this.state = 292;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 293;
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
			this.state = 321;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 6, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 295;
				this.match(SolidCashParser.T__0);
				this.state = 296;
				this.match(SolidCashParser.StringLiteral);
				this.state = 297;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 298;
				this.match(SolidCashParser.T__0);
				this.state = 299;
				this.match(SolidCashParser.StringLiteral);
				this.state = 300;
				this.match(SolidCashParser.T__2);
				this.state = 301;
				this.match(SolidCashParser.Identifier);
				this.state = 302;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 303;
				this.match(SolidCashParser.T__0);
				this.state = 304;
				this.match(SolidCashParser.T__3);
				this.state = 305;
				this.importBinding();
				this.state = 310;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 306;
						this.match(SolidCashParser.T__4);
						this.state = 307;
						this.importBinding();
						}
						}
					}
					this.state = 312;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				}
				this.state = 314;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 313;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 316;
				this.match(SolidCashParser.T__5);
				this.state = 317;
				this.match(SolidCashParser.Identifier);
				this.state = 318;
				this.match(SolidCashParser.StringLiteral);
				this.state = 319;
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
			this.state = 323;
			this.match(SolidCashParser.Identifier);
			this.state = 326;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 324;
				this.match(SolidCashParser.T__2);
				this.state = 325;
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
			this.state = 328;
			this.match(SolidCashParser.T__6);
			this.state = 329;
			this.anyIdentifier();
			this.state = 330;
			this.parameterList();
			this.state = 334;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 331;
				this.functionModifier();
				}
				}
				this.state = 336;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 338;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 337;
				this.returnType();
				}
			}

			this.state = 340;
			this.match(SolidCashParser.T__3);
			this.state = 344;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 341;
				this.statement();
				}
				}
				this.state = 346;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 347;
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
			this.state = 386;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 17, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 349;
				this.match(SolidCashParser.T__7);
				this.state = 350;
				this.match(SolidCashParser.Identifier);
				this.state = 351;
				this.match(SolidCashParser.T__8);
				this.state = 355;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 11, this._ctx) ) {
				case 1:
					{
					this.state = 352;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 353;
					this.typeName();
					}
					break;
				case 3:
					{
					this.state = 354;
					this.match(SolidCashParser.T__9);
					}
					break;
				}
				this.state = 358;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 357;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 360;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 361;
				this.match(SolidCashParser.T__7);
				this.state = 362;
				this.match(SolidCashParser.T__3);
				this.state = 363;
				this.usingFunctionBinding();
				this.state = 368;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 364;
						this.match(SolidCashParser.T__4);
						this.state = 365;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 370;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				}
				this.state = 372;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 371;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 374;
				this.match(SolidCashParser.T__5);
				this.state = 375;
				this.match(SolidCashParser.T__8);
				this.state = 379;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 15, this._ctx) ) {
				case 1:
					{
					this.state = 376;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 377;
					this.typeName();
					}
					break;
				case 3:
					{
					this.state = 378;
					this.match(SolidCashParser.T__9);
					}
					break;
				}
				this.state = 382;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 381;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 384;
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
			this.state = 388;
			this.match(SolidCashParser.Identifier);
			this.state = 391;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===12) {
				{
				this.state = 389;
				this.match(SolidCashParser.T__11);
				this.state = 390;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 395;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 393;
				this.match(SolidCashParser.T__2);
				this.state = 394;
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
			this.state = 397;
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
			this.state = 399;
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
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 401;
			this.match(SolidCashParser.T__36);
			this.state = 402;
			this.pragmaName();
			this.state = 403;
			this.pragmaValue();
			this.state = 404;
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
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 408;
			this.versionConstraint();
			this.state = 410;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0) || _la===140) {
				{
				this.state = 409;
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
			this.state = 413;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0)) {
				{
				this.state = 412;
				this.versionOperator();
				}
			}

			this.state = 415;
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
			this.state = 417;
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
			this.state = 419;
			this.match(SolidCashParser.T__40);
			this.state = 420;
			this.match(SolidCashParser.Identifier);
			this.state = 430;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 421;
				this.match(SolidCashParser.T__41);
				this.state = 422;
				this.match(SolidCashParser.Identifier);
				this.state = 427;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 423;
					this.match(SolidCashParser.T__4);
					this.state = 424;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 429;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 432;
			this.match(SolidCashParser.T__3);
			this.state = 443;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1843969) !== 0)) {
				{
				this.state = 441;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 24, this._ctx) ) {
				case 1:
					{
					this.state = 433;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 434;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 435;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 436;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 437;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 438;
					this.interfaceStateVariable();
					}
					break;
				case 7:
					{
					this.state = 439;
					this.interfaceCollection();
					}
					break;
				case 8:
					{
					this.state = 440;
					this.interfaceFunction();
					}
					break;
				}
				}
				this.state = 445;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 446;
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
			this.state = 458;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 26, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 448;
				this.interfaceStateVariableVisibility();
				this.state = 449;
				this.mappingType();
				this.state = 450;
				this.match(SolidCashParser.Identifier);
				this.state = 451;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 453;
				this.interfaceStateVariableVisibility();
				this.state = 454;
				this.arrayType(0);
				this.state = 455;
				this.match(SolidCashParser.Identifier);
				this.state = 456;
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
			this.state = 460;
			this.interfaceStateVariableVisibility();
			this.state = 461;
			this.typeName();
			this.state = 462;
			this.match(SolidCashParser.Identifier);
			this.state = 463;
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
			this.state = 465;
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
			this.state = 467;
			this.match(SolidCashParser.T__6);
			this.state = 468;
			this.match(SolidCashParser.Identifier);
			this.state = 469;
			this.parameterList();
			this.state = 473;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 470;
				this.functionModifier();
				}
				}
				this.state = 475;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 477;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 476;
				this.returnType();
				}
			}

			this.state = 479;
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
			this.state = 481;
			this.match(SolidCashParser.T__44);
			this.state = 482;
			this.match(SolidCashParser.Identifier);
			this.state = 483;
			this.match(SolidCashParser.T__3);
			this.state = 487;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===54) {
				{
				{
				this.state = 484;
				this.enumDefinition();
				}
				}
				this.state = 489;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 493;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===53) {
				{
				{
				this.state = 490;
				this.structDefinition();
				}
				}
				this.state = 495;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 499;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===55) {
				{
				{
				this.state = 496;
				this.typeDefinition();
				}
				}
				this.state = 501;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 505;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===48) {
				{
				{
				this.state = 502;
				this.eventDefinition();
				}
				}
				this.state = 507;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 511;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===35) {
				{
				{
				this.state = 508;
				this.errorDefinition();
				}
				}
				this.state = 513;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 517;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 34, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 514;
					this.constantDefinition();
					}
					}
				}
				this.state = 519;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 34, this._ctx);
			}
			this.state = 523;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 35, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 520;
					this.stateVariableDeclaration();
					}
					}
				}
				this.state = 525;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 35, this._ctx);
			}
			this.state = 529;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===8) {
				{
				{
				this.state = 526;
				this.usingForDirective();
				}
				}
				this.state = 531;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 535;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 532;
				this.freeFunctionDefinition();
				}
				}
				this.state = 537;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 538;
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
			this.state = 541;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===46) {
				{
				this.state = 540;
				this.match(SolidCashParser.T__45);
				}
			}

			this.state = 543;
			this.match(SolidCashParser.T__46);
			this.state = 544;
			this.match(SolidCashParser.Identifier);
			this.state = 546;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 545;
				this.parameterList();
				}
			}

			this.state = 557;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 548;
				this.match(SolidCashParser.T__41);
				this.state = 549;
				this.inheritanceSpecifier();
				this.state = 554;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 550;
					this.match(SolidCashParser.T__4);
					this.state = 551;
					this.inheritanceSpecifier();
					}
					}
					this.state = 556;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 559;
			this.match(SolidCashParser.T__3);
			this.state = 576;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 268435459) !== 0) || ((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 37411875) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 574;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 42, this._ctx) ) {
				case 1:
					{
					this.state = 560;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 561;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 562;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 563;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 564;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 565;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 566;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 567;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 568;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 569;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 570;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 571;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 572;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 573;
					this.receiveDefinition();
					}
					break;
				}
				}
				this.state = 578;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 579;
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
			this.state = 581;
			this.match(SolidCashParser.Identifier);
			this.state = 583;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 582;
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
			this.state = 585;
			this.match(SolidCashParser.T__6);
			this.state = 586;
			this.anyIdentifier();
			this.state = 587;
			this.parameterList();
			this.state = 591;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 588;
				this.functionModifier();
				}
				}
				this.state = 593;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 597;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 594;
				this.customModifierInvocation();
				}
				}
				this.state = 599;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 601;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 600;
				this.returnType();
				}
			}

			this.state = 603;
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
			this.state = 605;
			this.match(SolidCashParser.T__47);
			this.state = 606;
			this.match(SolidCashParser.Identifier);
			this.state = 607;
			this.match(SolidCashParser.T__48);
			this.state = 619;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 608;
				this.eventParameter();
				this.state = 613;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 48, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 609;
						this.match(SolidCashParser.T__4);
						this.state = 610;
						this.eventParameter();
						}
						}
					}
					this.state = 615;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 48, this._ctx);
				}
				this.state = 617;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 616;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 621;
			this.match(SolidCashParser.T__49);
			this.state = 623;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===51) {
				{
				this.state = 622;
				this.match(SolidCashParser.T__50);
				}
			}

			this.state = 625;
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
			this.state = 629;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 52, this._ctx) ) {
			case 1:
				{
				this.state = 627;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 628;
				this.arrayType(0);
				}
				break;
			}
			this.state = 632;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===52) {
				{
				this.state = 631;
				this.match(SolidCashParser.T__51);
				}
			}

			this.state = 634;
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
			this.state = 636;
			this.match(SolidCashParser.T__34);
			this.state = 637;
			this.match(SolidCashParser.Identifier);
			this.state = 638;
			this.match(SolidCashParser.T__48);
			this.state = 650;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 639;
				this.errorParameter();
				this.state = 644;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 54, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 640;
						this.match(SolidCashParser.T__4);
						this.state = 641;
						this.errorParameter();
						}
						}
					}
					this.state = 646;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 54, this._ctx);
				}
				this.state = 648;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 647;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 652;
			this.match(SolidCashParser.T__49);
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
	public errorParameter(): ErrorParameterContext {
		let localctx: ErrorParameterContext = new ErrorParameterContext(this, this._ctx, this.state);
		this.enterRule(localctx, 50, SolidCashParser.RULE_errorParameter);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 655;
			this.typeName();
			this.state = 656;
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
			this.state = 658;
			this.match(SolidCashParser.T__52);
			this.state = 659;
			this.match(SolidCashParser.Identifier);
			this.state = 660;
			this.match(SolidCashParser.T__3);
			this.state = 662;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 661;
				this.structField();
				}
				}
				this.state = 664;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180);
			this.state = 666;
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
			this.state = 671;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 58, this._ctx) ) {
			case 1:
				{
				this.state = 668;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 669;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 670;
				this.mappingType();
				}
				break;
			}
			this.state = 673;
			this.anyIdentifier();
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
	public enumDefinition(): EnumDefinitionContext {
		let localctx: EnumDefinitionContext = new EnumDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 56, SolidCashParser.RULE_enumDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 676;
			this.match(SolidCashParser.T__53);
			this.state = 677;
			this.match(SolidCashParser.Identifier);
			this.state = 678;
			this.match(SolidCashParser.T__3);
			this.state = 679;
			this.enumMember();
			this.state = 684;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 59, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 680;
					this.match(SolidCashParser.T__4);
					this.state = 681;
					this.enumMember();
					}
					}
				}
				this.state = 686;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 59, this._ctx);
			}
			this.state = 688;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 687;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 690;
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
			this.state = 692;
			this.match(SolidCashParser.Identifier);
			this.state = 695;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 693;
				this.match(SolidCashParser.T__39);
				this.state = 694;
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
			this.state = 697;
			this.match(SolidCashParser.T__54);
			this.state = 698;
			this.match(SolidCashParser.Identifier);
			this.state = 699;
			this.match(SolidCashParser.T__41);
			this.state = 700;
			this.typeName();
			this.state = 701;
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
			this.state = 703;
			this.typeName();
			this.state = 704;
			this.match(SolidCashParser.T__55);
			this.state = 705;
			this.match(SolidCashParser.Identifier);
			this.state = 706;
			this.match(SolidCashParser.T__39);
			this.state = 707;
			this.expression(0);
			this.state = 708;
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
			this.state = 710;
			this.match(SolidCashParser.T__56);
			this.state = 711;
			this.parameterList();
			this.state = 715;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 98307) !== 0)) {
				{
				{
				this.state = 712;
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
				this.state = 717;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 721;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 718;
				this.parentInvocation();
				}
				}
				this.state = 723;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 724;
			this.match(SolidCashParser.T__3);
			this.state = 728;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 725;
				this.statement();
				}
				}
				this.state = 730;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 731;
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
			this.state = 733;
			this.match(SolidCashParser.T__59);
			this.state = 734;
			this.parameterList();
			this.state = 735;
			this.match(SolidCashParser.T__43);
			this.state = 739;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 8197) !== 0)) {
				{
				{
				this.state = 736;
				this.fallbackModifier();
				}
				}
				this.state = 741;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 745;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 742;
				this.customModifierInvocation();
				}
				}
				this.state = 747;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 748;
			this.match(SolidCashParser.T__3);
			this.state = 752;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 749;
				this.statement();
				}
				}
				this.state = 754;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 755;
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
			this.state = 760;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 59:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 757;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 758;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 759;
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
			this.state = 762;
			this.match(SolidCashParser.T__61);
			this.state = 763;
			this.match(SolidCashParser.T__48);
			this.state = 764;
			this.match(SolidCashParser.T__49);
			this.state = 765;
			this.match(SolidCashParser.T__43);
			this.state = 766;
			this.match(SolidCashParser.T__58);
			this.state = 767;
			this.match(SolidCashParser.T__3);
			this.state = 771;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
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
	public parentInvocation(): ParentInvocationContext {
		let localctx: ParentInvocationContext = new ParentInvocationContext(this, this._ctx, this.state);
		this.enterRule(localctx, 72, SolidCashParser.RULE_parentInvocation);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 776;
			this.match(SolidCashParser.Identifier);
			this.state = 777;
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
			this.state = 841;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 80, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 780;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 779;
					this.stateVariableVisibility();
					}
				}

				this.state = 782;
				this.typeName();
				this.state = 786;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 783;
					this.modifier();
					}
					}
					this.state = 788;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 789;
				this.match(SolidCashParser.Identifier);
				this.state = 792;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 790;
					this.match(SolidCashParser.T__39);
					this.state = 791;
					this.expression(0);
					}
				}

				this.state = 794;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 796;
				this.typeName();
				this.state = 797;
				this.stateVariableVisibility();
				this.state = 801;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 798;
					this.modifier();
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
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 812;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 811;
					this.stateVariableVisibility();
					}
				}

				this.state = 814;
				this.mappingType();
				this.state = 818;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 815;
					this.collectionModifier();
					}
					}
					this.state = 820;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 821;
				this.match(SolidCashParser.Identifier);
				this.state = 822;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
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
				this.arrayType(0);
				this.state = 831;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
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
				this.state = 837;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 835;
					this.match(SolidCashParser.T__39);
					this.state = 836;
					this.expression(0);
					}
				}

				this.state = 839;
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
			this.state = 845;
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
				this.state = 843;
				this.modifier();
				}
				break;
			case 43:
			case 44:
			case 58:
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 844;
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
			this.state = 847;
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
			this.state = 885;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 87, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 849;
				this.match(SolidCashParser.T__63);
				this.state = 850;
				this.match(SolidCashParser.T__48);
				this.state = 851;
				this.typeName();
				this.state = 853;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 852;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 855;
				this.match(SolidCashParser.T__64);
				this.state = 856;
				this.typeName();
				this.state = 858;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 857;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 860;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 862;
				this.match(SolidCashParser.T__63);
				this.state = 863;
				this.match(SolidCashParser.T__48);
				this.state = 864;
				this.typeName();
				this.state = 866;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 865;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 868;
				this.match(SolidCashParser.T__64);
				this.state = 869;
				this.mappingType();
				this.state = 870;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 872;
				this.match(SolidCashParser.T__63);
				this.state = 873;
				this.match(SolidCashParser.T__48);
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
				this.match(SolidCashParser.T__64);
				this.state = 879;
				this.arrayType(0);
				this.state = 881;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 880;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 883;
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
			this.state = 897;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 88, this._ctx) ) {
			case 1:
				{
				this.state = 888;
				this.typeName();
				this.state = 889;
				this.match(SolidCashParser.T__65);
				this.state = 890;
				_la = this._input.LA(1);
				if(!(_la===145 || _la===180)) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 891;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 2:
				{
				this.state = 893;
				this.typeName();
				this.state = 894;
				this.match(SolidCashParser.T__65);
				this.state = 895;
				this.match(SolidCashParser.T__66);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 908;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 90, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 906;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 89, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 899;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 900;
						this.match(SolidCashParser.T__65);
						this.state = 901;
						_la = this._input.LA(1);
						if(!(_la===145 || _la===180)) {
						this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 902;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 903;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 904;
						this.match(SolidCashParser.T__65);
						this.state = 905;
						this.match(SolidCashParser.T__66);
						}
						break;
					}
					}
				}
				this.state = 910;
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
			this.state = 911;
			this.match(SolidCashParser.T__67);
			this.state = 912;
			this.match(SolidCashParser.Identifier);
			this.state = 914;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 913;
				this.parameterList();
				}
			}

			this.state = 916;
			this.match(SolidCashParser.T__3);
			this.state = 920;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 917;
				this.modifierStatement();
				}
				}
				this.state = 922;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 923;
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
			this.state = 927;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 69:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 925;
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
				this.state = 926;
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
			this.state = 929;
			this.match(SolidCashParser.T__68);
			this.state = 930;
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
			this.state = 932;
			this.match(SolidCashParser.T__6);
			this.state = 933;
			this.anyIdentifier();
			this.state = 934;
			this.parameterList();
			this.state = 938;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 935;
				this.functionModifier();
				}
				}
				this.state = 940;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 944;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 941;
				this.customModifierInvocation();
				}
				}
				this.state = 946;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 948;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 947;
				this.returnType();
				}
			}

			this.state = 950;
			this.match(SolidCashParser.T__3);
			this.state = 954;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 951;
				this.statement();
				}
				}
				this.state = 956;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 957;
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
			this.state = 959;
			this.match(SolidCashParser.Identifier);
			this.state = 961;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 960;
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
			this.state = 977;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 70:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 963;
				this.match(SolidCashParser.T__69);
				}
				break;
			case 71:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 964;
				this.match(SolidCashParser.T__70);
				}
				break;
			case 58:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 965;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 44:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 966;
				this.match(SolidCashParser.T__43);
				}
				break;
			case 43:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 967;
				this.match(SolidCashParser.T__42);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 968;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 59:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 969;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 970;
				this.overrideSpecifier();
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 971;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 972;
				this.unsafeModifier();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 973;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 974;
				this.match(SolidCashParser.T__27);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 975;
				this.match(SolidCashParser.T__30);
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 976;
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
			this.state = 979;
			this.match(SolidCashParser.T__71);
			this.state = 990;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 980;
				this.match(SolidCashParser.T__48);
				this.state = 981;
				this.match(SolidCashParser.Identifier);
				this.state = 986;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 982;
					this.match(SolidCashParser.T__4);
					this.state = 983;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 988;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 989;
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
			this.state = 992;
			this.match(SolidCashParser.T__31);
			this.state = 996;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 993;
				this.match(SolidCashParser.T__48);
				this.state = 994;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 995;
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
			this.state = 998;
			this.match(SolidCashParser.T__72);
			this.state = 999;
			this.match(SolidCashParser.T__48);
			this.state = 1000;
			this.returnParam();
			this.state = 1005;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 103, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1001;
					this.match(SolidCashParser.T__4);
					this.state = 1002;
					this.returnParam();
					}
					}
				}
				this.state = 1007;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 103, this._ctx);
			}
			this.state = 1009;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1008;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1011;
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
			this.state = 1033;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 109, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1013;
				this.typeName();
				this.state = 1017;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 105, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 105, this._ctx);
				}
				this.state = 1021;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1020;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1023;
				this.arrayType(0);
				this.state = 1027;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 107, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1024;
						this.modifier();
						}
						}
					}
					this.state = 1029;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 107, this._ctx);
				}
				this.state = 1031;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1030;
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
			this.state = 1035;
			this.match(SolidCashParser.T__48);
			this.state = 1047;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1036;
				this.parameter();
				this.state = 1041;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 110, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1037;
						this.match(SolidCashParser.T__4);
						this.state = 1038;
						this.parameter();
						}
						}
					}
					this.state = 1043;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 110, this._ctx);
				}
				this.state = 1045;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1044;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1049;
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
			this.state = 1081;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 119, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1051;
				this.typeName();
				this.state = 1055;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 113, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1052;
						this.modifier();
						}
						}
					}
					this.state = 1057;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 113, this._ctx);
				}
				this.state = 1059;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1058;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1061;
				this.arrayType(0);
				this.state = 1065;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 115, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1062;
						this.modifier();
						}
						}
					}
					this.state = 1067;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 115, this._ctx);
				}
				this.state = 1069;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1068;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1071;
				this.mappingType();
				this.state = 1075;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 117, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1072;
						this.modifier();
						}
						}
					}
					this.state = 1077;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 117, this._ctx);
				}
				this.state = 1079;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1078;
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
			this.state = 1092;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1083;
				this.match(SolidCashParser.T__3);
				this.state = 1087;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
					{
					{
					this.state = 1084;
					this.statement();
					}
					}
					this.state = 1089;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1090;
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
				this.state = 1091;
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
			this.state = 1125;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 122, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1094;
				this.variableDefinition();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1095;
				this.tupleAssignment();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1096;
				this.arrayPushStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1097;
				this.arrayPopStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1098;
				this.arrayDeleteStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1099;
				this.stateArrayPushStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1100;
				this.stateArrayPopStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1101;
				this.assignStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1102;
				this.assignmentStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1103;
				this.mappingDeleteStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1104;
				this.timeOpStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1105;
				this.requireStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1106;
				this.ifStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1107;
				this.loopStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1108;
				this.consoleStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1109;
				this.emitStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1110;
				this.transferStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1111;
				this.tokenContainerMethodStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1112;
				this.returnStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1113;
				this.functionCallStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1114;
				this.addressMethodStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1115;
				this.selfdestructStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1116;
				this.assemblyStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1117;
				this.tryCatchStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1118;
				this.revertStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1119;
				this.assertStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1120;
				this.deleteStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1121;
				this.uncheckedStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1122;
				this.switchStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1123;
				this.breakStatement();
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 31);
				{
				this.state = 1124;
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
			this.state = 1127;
			this.match(SolidCashParser.T__73);
			this.state = 1128;
			this.match(SolidCashParser.T__11);
			this.state = 1129;
			this.match(SolidCashParser.Identifier);
			this.state = 1130;
			this.match(SolidCashParser.T__48);
			this.state = 1131;
			this.expression(0);
			this.state = 1132;
			this.match(SolidCashParser.T__4);
			this.state = 1133;
			this.expression(0);
			this.state = 1134;
			this.match(SolidCashParser.T__49);
			this.state = 1135;
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
			this.state = 1137;
			this.match(SolidCashParser.T__73);
			this.state = 1138;
			this.match(SolidCashParser.T__11);
			this.state = 1139;
			this.match(SolidCashParser.Identifier);
			this.state = 1140;
			this.match(SolidCashParser.T__65);
			this.state = 1141;
			this.expression(0);
			this.state = 1142;
			this.match(SolidCashParser.T__66);
			this.state = 1143;
			this.match(SolidCashParser.T__11);
			this.state = 1144;
			this.match(SolidCashParser.Identifier);
			this.state = 1145;
			this.match(SolidCashParser.T__48);
			this.state = 1146;
			this.expression(0);
			this.state = 1151;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1147;
				this.match(SolidCashParser.T__4);
				this.state = 1148;
				this.expression(0);
				}
				}
				this.state = 1153;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1154;
			this.match(SolidCashParser.T__49);
			this.state = 1155;
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
			this.state = 1186;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 127, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1157;
				this.match(SolidCashParser.T__74);
				this.state = 1158;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1159;
				this.match(SolidCashParser.T__74);
				this.state = 1160;
				this.expression(0);
				this.state = 1165;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1161;
					this.match(SolidCashParser.T__4);
					this.state = 1162;
					this.expression(0);
					}
					}
					this.state = 1167;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1168;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1170;
				this.match(SolidCashParser.T__74);
				this.state = 1171;
				this.match(SolidCashParser.T__48);
				this.state = 1172;
				this.expression(0);
				this.state = 1177;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 125, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1173;
						this.match(SolidCashParser.T__4);
						this.state = 1174;
						this.expression(0);
						}
						}
					}
					this.state = 1179;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 125, this._ctx);
				}
				this.state = 1181;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1180;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1183;
				this.match(SolidCashParser.T__49);
				this.state = 1184;
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
			this.state = 1233;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 133, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1188;
				this.match(SolidCashParser.Identifier);
				this.state = 1191;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1189;
					this.match(SolidCashParser.T__11);
					this.state = 1190;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1193;
				this.match(SolidCashParser.T__48);
				this.state = 1194;
				this.match(SolidCashParser.T__3);
				this.state = 1206;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1195;
					this.namedArg();
					this.state = 1200;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 129, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1196;
							this.match(SolidCashParser.T__4);
							this.state = 1197;
							this.namedArg();
							}
							}
						}
						this.state = 1202;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 129, this._ctx);
					}
					this.state = 1204;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1203;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1208;
				this.match(SolidCashParser.T__5);
				this.state = 1209;
				this.match(SolidCashParser.T__49);
				this.state = 1210;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1211;
				this.match(SolidCashParser.Identifier);
				this.state = 1212;
				this.expressionList();
				this.state = 1213;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1215;
				this.match(SolidCashParser.Identifier);
				this.state = 1216;
				this.match(SolidCashParser.T__11);
				this.state = 1217;
				this.match(SolidCashParser.Identifier);
				this.state = 1218;
				this.expressionList();
				this.state = 1219;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1221;
				this.match(SolidCashParser.Identifier);
				this.state = 1222;
				this.expressionList();
				this.state = 1223;
				this.match(SolidCashParser.T__11);
				this.state = 1224;
				this.match(SolidCashParser.Identifier);
				this.state = 1225;
				this.match(SolidCashParser.T__11);
				this.state = 1226;
				this.match(SolidCashParser.Identifier);
				this.state = 1228;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1227;
					this.callOptions();
					}
				}

				this.state = 1230;
				this.expressionList();
				this.state = 1231;
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
			this.state = 1235;
			this.expression(0);
			this.state = 1236;
			this.match(SolidCashParser.T__11);
			this.state = 1237;
			this.match(SolidCashParser.Identifier);
			this.state = 1239;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===4) {
				{
				this.state = 1238;
				this.callOptions();
				}
			}

			this.state = 1241;
			this.expressionList();
			this.state = 1242;
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
			this.state = 1244;
			this.match(SolidCashParser.T__30);
			this.state = 1245;
			this.match(SolidCashParser.T__48);
			this.state = 1246;
			this.expression(0);
			this.state = 1247;
			this.match(SolidCashParser.T__49);
			this.state = 1248;
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
			this.state = 1283;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 140, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1250;
				this.match(SolidCashParser.T__75);
				this.state = 1251;
				this.match(SolidCashParser.Identifier);
				this.state = 1254;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1252;
					this.match(SolidCashParser.T__11);
					this.state = 1253;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1256;
				this.match(SolidCashParser.T__48);
				this.state = 1257;
				this.match(SolidCashParser.T__3);
				this.state = 1269;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1258;
					this.namedArg();
					this.state = 1263;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 136, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1259;
							this.match(SolidCashParser.T__4);
							this.state = 1260;
							this.namedArg();
							}
							}
						}
						this.state = 1265;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 136, this._ctx);
					}
					this.state = 1267;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1266;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1271;
				this.match(SolidCashParser.T__5);
				this.state = 1272;
				this.match(SolidCashParser.T__49);
				this.state = 1273;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1274;
				this.match(SolidCashParser.T__75);
				this.state = 1275;
				this.match(SolidCashParser.Identifier);
				this.state = 1278;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1276;
					this.match(SolidCashParser.T__11);
					this.state = 1277;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1280;
				this.expressionList();
				this.state = 1281;
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
			this.state = 1409;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 155, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1285;
				this.match(SolidCashParser.T__73);
				this.state = 1286;
				this.match(SolidCashParser.T__11);
				this.state = 1287;
				this.match(SolidCashParser.Identifier);
				this.state = 1296;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===66) {
					{
					this.state = 1292;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1288;
						this.match(SolidCashParser.T__65);
						this.state = 1289;
						this.expression(0);
						this.state = 1290;
						this.match(SolidCashParser.T__66);
						}
						}
						this.state = 1294;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===66);
					}
				}

				this.state = 1302;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12) {
					{
					{
					this.state = 1298;
					this.match(SolidCashParser.T__11);
					this.state = 1299;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1304;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1305;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
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
				this.match(SolidCashParser.Identifier);
				this.state = 1314;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1310;
					this.match(SolidCashParser.T__65);
					this.state = 1311;
					this.expression(0);
					this.state = 1312;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1316;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1322;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12) {
					{
					{
					this.state = 1318;
					this.match(SolidCashParser.T__11);
					this.state = 1319;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1324;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
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
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1329;
				this.match(SolidCashParser.Identifier);
				this.state = 1332;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1330;
					this.match(SolidCashParser.T__11);
					this.state = 1331;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1334;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1336;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1337;
				this.expression(0);
				this.state = 1338;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1340;
				this.match(SolidCashParser.Identifier);
				this.state = 1343;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1341;
					this.match(SolidCashParser.T__11);
					this.state = 1342;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1345;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1351;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1347;
					this.match(SolidCashParser.T__65);
					this.state = 1348;
					this.expression(0);
					this.state = 1349;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1353;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1355;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1356;
				this.expression(0);
				this.state = 1357;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1359;
				this.match(SolidCashParser.T__73);
				this.state = 1360;
				this.match(SolidCashParser.T__11);
				this.state = 1361;
				this.match(SolidCashParser.Identifier);
				this.state = 1370;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===66) {
					{
					this.state = 1366;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1362;
						this.match(SolidCashParser.T__65);
						this.state = 1363;
						this.expression(0);
						this.state = 1364;
						this.match(SolidCashParser.T__66);
						}
						}
						this.state = 1368;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===66);
					}
				}

				this.state = 1376;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12) {
					{
					{
					this.state = 1372;
					this.match(SolidCashParser.T__11);
					this.state = 1373;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1378;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1379;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1380;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1381;
				this.match(SolidCashParser.Identifier);
				this.state = 1386;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1382;
					this.match(SolidCashParser.T__65);
					this.state = 1383;
					this.expression(0);
					this.state = 1384;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1388;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1394;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12) {
					{
					{
					this.state = 1390;
					this.match(SolidCashParser.T__11);
					this.state = 1391;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1396;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1397;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1398;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1400;
				this.match(SolidCashParser.Identifier);
				this.state = 1403;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1401;
					this.match(SolidCashParser.T__11);
					this.state = 1402;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1405;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1407;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1408;
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
			this.state = 1411;
			this.match(SolidCashParser.T__73);
			this.state = 1412;
			this.match(SolidCashParser.T__11);
			this.state = 1413;
			this.match(SolidCashParser.Identifier);
			this.state = 1420;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===66) {
				{
				{
				this.state = 1414;
				this.match(SolidCashParser.T__65);
				this.state = 1415;
				this.expression(0);
				this.state = 1416;
				this.match(SolidCashParser.T__66);
				}
				}
				this.state = 1422;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1423;
			this.match(SolidCashParser.DotDelete);
			this.state = 1424;
			this.match(SolidCashParser.T__48);
			this.state = 1425;
			this.expression(0);
			this.state = 1426;
			this.match(SolidCashParser.T__49);
			this.state = 1427;
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
			this.state = 1457;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 161, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1429;
				this.typeName();
				this.state = 1433;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 157, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1430;
						this.modifier();
						}
						}
					}
					this.state = 1435;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 157, this._ctx);
				}
				this.state = 1436;
				this.anyIdentifier();
				this.state = 1439;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1437;
					this.match(SolidCashParser.T__39);
					this.state = 1438;
					this.expression(0);
					}
				}

				this.state = 1441;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1443;
				this.arrayType(0);
				this.state = 1447;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 159, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1444;
						this.modifier();
						}
						}
					}
					this.state = 1449;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 159, this._ctx);
				}
				this.state = 1450;
				this.anyIdentifier();
				this.state = 1453;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1451;
					this.match(SolidCashParser.T__39);
					this.state = 1452;
					this.expression(0);
					}
				}

				this.state = 1455;
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
			this.state = 1507;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 166, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1459;
				this.typeName();
				this.state = 1460;
				this.match(SolidCashParser.Identifier);
				this.state = 1465;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1461;
					this.match(SolidCashParser.T__4);
					this.state = 1462;
					this.typeName();
					this.state = 1463;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1467;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1469;
				this.match(SolidCashParser.T__39);
				this.state = 1470;
				this.expression(0);
				this.state = 1471;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1473;
				this.match(SolidCashParser.T__48);
				this.state = 1474;
				this.tupleSlot();
				this.state = 1477;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1475;
					this.match(SolidCashParser.T__4);
					this.state = 1476;
					this.tupleSlot();
					}
					}
					this.state = 1479;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1481;
				this.match(SolidCashParser.T__49);
				this.state = 1482;
				this.match(SolidCashParser.T__39);
				this.state = 1483;
				this.match(SolidCashParser.T__48);
				this.state = 1484;
				this.expression(0);
				this.state = 1487;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1485;
					this.match(SolidCashParser.T__4);
					this.state = 1486;
					this.expression(0);
					}
					}
					this.state = 1489;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1491;
				this.match(SolidCashParser.T__49);
				this.state = 1492;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1494;
				this.match(SolidCashParser.T__48);
				this.state = 1495;
				this.tupleSlot();
				this.state = 1498;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1496;
					this.match(SolidCashParser.T__4);
					this.state = 1497;
					this.tupleSlot();
					}
					}
					this.state = 1500;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1502;
				this.match(SolidCashParser.T__49);
				this.state = 1503;
				this.match(SolidCashParser.T__39);
				this.state = 1504;
				this.expression(0);
				this.state = 1505;
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
			this.state = 1520;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 168, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1509;
				this.typeName();
				this.state = 1513;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 1510;
					this.modifier();
					}
					}
					this.state = 1515;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1516;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1518;
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
			this.state = 1533;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 169, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1522;
				this.match(SolidCashParser.Identifier);
				this.state = 1523;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1524;
				this.expression(0);
				this.state = 1525;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1527;
				this.match(SolidCashParser.Identifier);
				this.state = 1528;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1529;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1530;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1531;
				this.match(SolidCashParser.Identifier);
				this.state = 1532;
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
			this.state = 1551;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 170, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1535;
				this.match(SolidCashParser.Identifier);
				this.state = 1536;
				this.match(SolidCashParser.DotPush);
				this.state = 1537;
				this.match(SolidCashParser.T__48);
				this.state = 1538;
				this.expression(0);
				this.state = 1539;
				this.match(SolidCashParser.T__49);
				this.state = 1540;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1542;
				this.match(SolidCashParser.Identifier);
				this.state = 1543;
				this.match(SolidCashParser.T__11);
				this.state = 1544;
				this.match(SolidCashParser.Identifier);
				this.state = 1545;
				this.match(SolidCashParser.DotPush);
				this.state = 1546;
				this.match(SolidCashParser.T__48);
				this.state = 1547;
				this.expression(0);
				this.state = 1548;
				this.match(SolidCashParser.T__49);
				this.state = 1549;
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
			this.state = 1565;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 171, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1553;
				this.match(SolidCashParser.Identifier);
				this.state = 1554;
				this.match(SolidCashParser.DotPop);
				this.state = 1555;
				this.match(SolidCashParser.T__48);
				this.state = 1556;
				this.match(SolidCashParser.T__49);
				this.state = 1557;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1558;
				this.match(SolidCashParser.Identifier);
				this.state = 1559;
				this.match(SolidCashParser.T__11);
				this.state = 1560;
				this.match(SolidCashParser.Identifier);
				this.state = 1561;
				this.match(SolidCashParser.DotPop);
				this.state = 1562;
				this.match(SolidCashParser.T__48);
				this.state = 1563;
				this.match(SolidCashParser.T__49);
				this.state = 1564;
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
			this.state = 1567;
			this.match(SolidCashParser.Identifier);
			this.state = 1568;
			this.match(SolidCashParser.DotDelete);
			this.state = 1569;
			this.match(SolidCashParser.T__48);
			this.state = 1570;
			this.expression(0);
			this.state = 1571;
			this.match(SolidCashParser.T__49);
			this.state = 1572;
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
			this.state = 1574;
			this.match(SolidCashParser.T__73);
			this.state = 1575;
			this.match(SolidCashParser.T__11);
			this.state = 1576;
			this.match(SolidCashParser.Identifier);
			this.state = 1577;
			this.match(SolidCashParser.DotPush);
			this.state = 1578;
			this.match(SolidCashParser.T__48);
			this.state = 1579;
			this.expression(0);
			this.state = 1580;
			this.match(SolidCashParser.T__49);
			this.state = 1581;
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
			this.state = 1583;
			this.match(SolidCashParser.T__73);
			this.state = 1584;
			this.match(SolidCashParser.T__11);
			this.state = 1585;
			this.match(SolidCashParser.Identifier);
			this.state = 1586;
			this.match(SolidCashParser.DotPop);
			this.state = 1587;
			this.match(SolidCashParser.T__48);
			this.state = 1588;
			this.match(SolidCashParser.T__49);
			this.state = 1589;
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
			this.state = 1625;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 174, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1591;
				this.match(SolidCashParser.T__88);
				this.state = 1592;
				this.match(SolidCashParser.Identifier);
				this.state = 1593;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1594;
				this.match(SolidCashParser.T__88);
				this.state = 1595;
				this.match(SolidCashParser.T__73);
				this.state = 1596;
				this.match(SolidCashParser.T__11);
				this.state = 1597;
				this.match(SolidCashParser.Identifier);
				this.state = 1598;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1599;
				this.match(SolidCashParser.T__88);
				this.state = 1600;
				this.match(SolidCashParser.T__73);
				this.state = 1601;
				this.match(SolidCashParser.T__11);
				this.state = 1602;
				this.match(SolidCashParser.Identifier);
				this.state = 1607;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1603;
					this.match(SolidCashParser.T__65);
					this.state = 1604;
					this.expression(0);
					this.state = 1605;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1609;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1611;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1613;
				this.match(SolidCashParser.T__88);
				this.state = 1614;
				this.match(SolidCashParser.Identifier);
				this.state = 1619;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1615;
					this.match(SolidCashParser.T__65);
					this.state = 1616;
					this.expression(0);
					this.state = 1617;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1621;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1623;
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
			this.state = 1627;
			this.match(SolidCashParser.T__89);
			this.state = 1628;
			this.match(SolidCashParser.T__48);
			this.state = 1629;
			this.match(SolidCashParser.TxVar);
			this.state = 1630;
			this.match(SolidCashParser.T__22);
			this.state = 1631;
			this.expression(0);
			this.state = 1634;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1632;
				this.match(SolidCashParser.T__4);
				this.state = 1633;
				this.requireMessage();
				}
			}

			this.state = 1636;
			this.match(SolidCashParser.T__49);
			this.state = 1637;
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
			this.state = 1639;
			this.match(SolidCashParser.T__89);
			this.state = 1640;
			this.match(SolidCashParser.T__48);
			this.state = 1641;
			this.expression(0);
			this.state = 1644;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1642;
				this.match(SolidCashParser.T__4);
				this.state = 1643;
				this.requireMessage();
				}
			}

			this.state = 1646;
			this.match(SolidCashParser.T__49);
			this.state = 1647;
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
			this.state = 1649;
			this.match(SolidCashParser.T__90);
			this.state = 1650;
			this.match(SolidCashParser.T__48);
			this.state = 1651;
			this.expression(0);
			this.state = 1652;
			this.match(SolidCashParser.T__49);
			this.state = 1653;
			localctx._ifBlock = this.block();
			this.state = 1656;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 177, this._ctx) ) {
			case 1:
				{
				this.state = 1654;
				this.match(SolidCashParser.T__91);
				this.state = 1655;
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
			this.state = 1664;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 178, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1658;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1659;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1660;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1661;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1662;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1663;
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
			this.state = 1666;
			this.match(SolidCashParser.T__8);
			this.state = 1667;
			this.match(SolidCashParser.T__48);
			this.state = 1668;
			this.typeName();
			this.state = 1669;
			this.match(SolidCashParser.Identifier);
			this.state = 1670;
			this.match(SolidCashParser.T__4);
			this.state = 1671;
			this.typeName();
			this.state = 1672;
			this.match(SolidCashParser.Identifier);
			this.state = 1673;
			this.match(SolidCashParser.T__92);
			this.state = 1674;
			this.match(SolidCashParser.T__73);
			this.state = 1675;
			this.match(SolidCashParser.T__11);
			this.state = 1676;
			this.match(SolidCashParser.Identifier);
			this.state = 1677;
			this.match(SolidCashParser.T__11);
			this.state = 1678;
			this.match(SolidCashParser.T__33);
			this.state = 1679;
			this.match(SolidCashParser.T__49);
			this.state = 1680;
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
			this.state = 1682;
			this.match(SolidCashParser.T__8);
			this.state = 1683;
			this.match(SolidCashParser.T__48);
			this.state = 1684;
			this.typeName();
			this.state = 1685;
			this.match(SolidCashParser.Identifier);
			this.state = 1686;
			this.match(SolidCashParser.T__93);
			this.state = 1687;
			this.match(SolidCashParser.T__73);
			this.state = 1688;
			this.match(SolidCashParser.T__11);
			this.state = 1689;
			this.match(SolidCashParser.Identifier);
			this.state = 1690;
			this.match(SolidCashParser.T__49);
			this.state = 1691;
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
			this.state = 1693;
			this.match(SolidCashParser.T__8);
			this.state = 1694;
			this.match(SolidCashParser.T__48);
			this.state = 1695;
			this.typeName();
			this.state = 1696;
			this.match(SolidCashParser.Identifier);
			this.state = 1697;
			this.match(SolidCashParser.T__92);
			this.state = 1698;
			this.match(SolidCashParser.T__73);
			this.state = 1699;
			this.match(SolidCashParser.T__11);
			this.state = 1700;
			this.match(SolidCashParser.Identifier);
			this.state = 1701;
			this.match(SolidCashParser.T__49);
			this.state = 1702;
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
			this.state = 1704;
			this.match(SolidCashParser.T__8);
			this.state = 1705;
			this.match(SolidCashParser.T__48);
			this.state = 1706;
			this.forInit();
			this.state = 1707;
			this.forCondition();
			this.state = 1709;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===87 || _la===88 || _la===180) {
				{
				this.state = 1708;
				this.forUpdate();
				}
			}

			this.state = 1711;
			this.match(SolidCashParser.T__49);
			this.state = 1712;
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
			this.state = 1714;
			this.typeName();
			this.state = 1718;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
				{
				{
				this.state = 1715;
				this.modifier();
				}
				}
				this.state = 1720;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1721;
			this.match(SolidCashParser.Identifier);
			this.state = 1724;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 1722;
				this.match(SolidCashParser.T__39);
				this.state = 1723;
				this.expression(0);
				}
			}

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
	public forCondition(): ForConditionContext {
		let localctx: ForConditionContext = new ForConditionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 168, SolidCashParser.RULE_forCondition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1728;
			this.expression(0);
			this.state = 1729;
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
			this.state = 1738;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 182, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1731;
				this.match(SolidCashParser.Identifier);
				this.state = 1732;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1733;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1734;
				this.match(SolidCashParser.Identifier);
				this.state = 1735;
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
				this.state = 1736;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1737;
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
			this.state = 1740;
			this.match(SolidCashParser.T__94);
			this.state = 1741;
			this.block();
			this.state = 1742;
			this.match(SolidCashParser.T__95);
			this.state = 1743;
			this.match(SolidCashParser.T__48);
			this.state = 1744;
			this.expression(0);
			this.state = 1745;
			this.match(SolidCashParser.T__49);
			this.state = 1746;
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
			this.state = 1748;
			this.match(SolidCashParser.T__95);
			this.state = 1749;
			this.match(SolidCashParser.T__48);
			this.state = 1750;
			this.expression(0);
			this.state = 1751;
			this.match(SolidCashParser.T__49);
			this.state = 1752;
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
			this.state = 1754;
			this.match(SolidCashParser.T__96);
			this.state = 1755;
			this.consoleParameterList();
			this.state = 1756;
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
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1758;
			this.match(SolidCashParser.T__97);
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
	public yulBlock(): YulBlockContext {
		let localctx: YulBlockContext = new YulBlockContext(this, this._ctx, this.state);
		this.enterRule(localctx, 180, SolidCashParser.RULE_yulBlock);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1761;
			this.match(SolidCashParser.T__3);
			this.state = 1765;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026534544) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 31) !== 0) || ((((_la - 75)) & ~0x1F) === 0 && ((1 << (_la - 75)) & 788594689) !== 0) || _la===108 || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				{
				this.state = 1762;
				this.yulStatement();
				}
				}
				this.state = 1767;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1768;
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
		this.enterRule(localctx, 182, SolidCashParser.RULE_yulStatement);
		try {
			this.state = 1783;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 184, this._ctx) ) {
			case 1:
				localctx = new YulNestedBlockStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1770;
				this.yulBlock();
				}
				break;
			case 2:
				localctx = new YulVarDeclStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1771;
				this.yulVariableDeclaration();
				}
				break;
			case 3:
				localctx = new YulAssignStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1772;
				this.yulAssignment();
				}
				break;
			case 4:
				localctx = new YulIfStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1773;
				this.yulIf();
				}
				break;
			case 5:
				localctx = new YulSwitchStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1774;
				this.yulSwitch();
				}
				break;
			case 6:
				localctx = new YulForStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1775;
				this.yulForLoop();
				}
				break;
			case 7:
				localctx = new YulFunctionDefStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1776;
				this.yulFunctionDefinition();
				}
				break;
			case 8:
				localctx = new YulBreakStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1777;
				this.match(SolidCashParser.T__98);
				}
				break;
			case 9:
				localctx = new YulContinueStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1778;
				this.match(SolidCashParser.T__99);
				}
				break;
			case 10:
				localctx = new YulLeaveStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1779;
				this.match(SolidCashParser.T__100);
				}
				break;
			case 11:
				localctx = new YulCallStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1780;
				this.yulFunctionCall();
				}
				break;
			case 12:
				localctx = new YulPathStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1781;
				this.yulPath();
				}
				break;
			case 13:
				localctx = new YulLiteralStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1782;
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
		this.enterRule(localctx, 184, SolidCashParser.RULE_yulVariableDeclaration);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1785;
			this.match(SolidCashParser.T__101);
			this.state = 1786;
			this.anyIdentifier();
			this.state = 1791;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1787;
				this.match(SolidCashParser.T__4);
				this.state = 1788;
				this.anyIdentifier();
				}
				}
				this.state = 1793;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1796;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===103) {
				{
				this.state = 1794;
				this.match(SolidCashParser.T__102);
				this.state = 1795;
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
		this.enterRule(localctx, 186, SolidCashParser.RULE_yulAssignment);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1798;
			this.yulPath();
			this.state = 1803;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1799;
				this.match(SolidCashParser.T__4);
				this.state = 1800;
				this.yulPath();
				}
				}
				this.state = 1805;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1806;
			this.match(SolidCashParser.T__102);
			this.state = 1807;
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
		this.enterRule(localctx, 188, SolidCashParser.RULE_yulIf);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1809;
			this.match(SolidCashParser.T__90);
			this.state = 1810;
			this.yulExpression();
			this.state = 1811;
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
		this.enterRule(localctx, 190, SolidCashParser.RULE_yulSwitch);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1813;
			this.match(SolidCashParser.T__103);
			this.state = 1814;
			this.yulExpression();
			this.state = 1824;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 105:
				{
				this.state = 1816;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1815;
					this.yulCase();
					}
					}
					this.state = 1818;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===105);
				this.state = 1821;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===106) {
					{
					this.state = 1820;
					this.yulDefault();
					}
				}

				}
				break;
			case 106:
				{
				this.state = 1823;
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
		this.enterRule(localctx, 192, SolidCashParser.RULE_yulCase);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1826;
			this.match(SolidCashParser.T__104);
			this.state = 1827;
			this.yulLiteral();
			this.state = 1828;
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
		this.enterRule(localctx, 194, SolidCashParser.RULE_yulDefault);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1830;
			this.match(SolidCashParser.T__105);
			this.state = 1831;
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
		this.enterRule(localctx, 196, SolidCashParser.RULE_yulForLoop);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1833;
			this.match(SolidCashParser.T__8);
			this.state = 1834;
			this.yulBlock();
			this.state = 1835;
			this.yulExpression();
			this.state = 1836;
			this.yulBlock();
			this.state = 1837;
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
		this.enterRule(localctx, 198, SolidCashParser.RULE_yulFunctionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1839;
			this.match(SolidCashParser.T__6);
			this.state = 1840;
			this.match(SolidCashParser.Identifier);
			this.state = 1841;
			this.match(SolidCashParser.T__48);
			this.state = 1850;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 1842;
				this.match(SolidCashParser.Identifier);
				this.state = 1847;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1843;
					this.match(SolidCashParser.T__4);
					this.state = 1844;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1849;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1852;
			this.match(SolidCashParser.T__49);
			this.state = 1862;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===107) {
				{
				this.state = 1853;
				this.match(SolidCashParser.T__106);
				this.state = 1854;
				this.match(SolidCashParser.Identifier);
				this.state = 1859;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1855;
					this.match(SolidCashParser.T__4);
					this.state = 1856;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1861;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1864;
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
		this.enterRule(localctx, 200, SolidCashParser.RULE_yulExpression);
		try {
			this.state = 1869;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 195, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1866;
				this.yulFunctionCall();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1867;
				this.yulPath();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1868;
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
		this.enterRule(localctx, 202, SolidCashParser.RULE_yulFunctionCall);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1871;
			this.yulFunctionName();
			this.state = 1872;
			this.match(SolidCashParser.T__48);
			this.state = 1881;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===75 || _la===108 || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				this.state = 1873;
				this.yulExpression();
				this.state = 1878;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1874;
					this.match(SolidCashParser.T__4);
					this.state = 1875;
					this.yulExpression();
					}
					}
					this.state = 1880;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1883;
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
		this.enterRule(localctx, 204, SolidCashParser.RULE_yulFunctionName);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1885;
			_la = this._input.LA(1);
			if(!(_la===31 || _la===36 || _la===75 || _la===108 || _la===149 || _la===180)) {
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
		this.enterRule(localctx, 206, SolidCashParser.RULE_yulPath);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1887;
			this.anyIdentifier();
			this.state = 1892;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===12) {
				{
				{
				this.state = 1888;
				this.match(SolidCashParser.T__11);
				this.state = 1889;
				this.anyIdentifier();
				}
				}
				this.state = 1894;
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
		this.enterRule(localctx, 208, SolidCashParser.RULE_yulLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1895;
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
		this.enterRule(localctx, 210, SolidCashParser.RULE_uncheckedStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1897;
			this.match(SolidCashParser.T__108);
			this.state = 1898;
			this.match(SolidCashParser.T__3);
			this.state = 1902;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 1899;
				this.statement();
				}
				}
				this.state = 1904;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1905;
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
		this.enterRule(localctx, 212, SolidCashParser.RULE_switchStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1907;
			this.match(SolidCashParser.T__103);
			this.state = 1908;
			this.match(SolidCashParser.T__48);
			this.state = 1909;
			this.expression(0);
			this.state = 1910;
			this.match(SolidCashParser.T__49);
			this.state = 1911;
			this.match(SolidCashParser.T__3);
			this.state = 1915;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===105) {
				{
				{
				this.state = 1912;
				this.switchCase();
				}
				}
				this.state = 1917;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1919;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===106) {
				{
				this.state = 1918;
				this.switchDefault();
				}
			}

			this.state = 1921;
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
		this.enterRule(localctx, 214, SolidCashParser.RULE_switchCase);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1923;
			this.match(SolidCashParser.T__104);
			this.state = 1924;
			this.expression(0);
			this.state = 1925;
			this.match(SolidCashParser.T__109);
			this.state = 1929;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 1926;
				this.statement();
				}
				}
				this.state = 1931;
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
		this.enterRule(localctx, 216, SolidCashParser.RULE_switchDefault);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1932;
			this.match(SolidCashParser.T__105);
			this.state = 1933;
			this.match(SolidCashParser.T__109);
			this.state = 1937;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 235013185) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 1934;
				this.statement();
				}
				}
				this.state = 1939;
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
		this.enterRule(localctx, 218, SolidCashParser.RULE_tryCatchStatement);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1940;
			this.match(SolidCashParser.T__110);
			this.state = 1941;
			this.expression(0);
			this.state = 1943;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 1942;
				this.tryReturns();
				}
			}

			this.state = 1945;
			localctx._tryBlock = this.block();
			this.state = 1947;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1946;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1949;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 205, this._ctx);
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
		this.enterRule(localctx, 220, SolidCashParser.RULE_tryReturns);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1951;
			this.match(SolidCashParser.T__72);
			this.state = 1952;
			this.match(SolidCashParser.T__48);
			this.state = 1964;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1953;
				this.parameter();
				this.state = 1958;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 206, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1954;
						this.match(SolidCashParser.T__4);
						this.state = 1955;
						this.parameter();
						}
						}
					}
					this.state = 1960;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 206, this._ctx);
				}
				this.state = 1962;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1961;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1966;
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
		this.enterRule(localctx, 222, SolidCashParser.RULE_catchClause);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1968;
			this.match(SolidCashParser.T__111);
			this.state = 1970;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 209, this._ctx) ) {
			case 1:
				{
				this.state = 1969;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 1987;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 213, this._ctx) ) {
			case 1:
				{
				this.state = 1972;
				this.match(SolidCashParser.T__48);
				this.state = 1984;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 1973;
					this.parameter();
					this.state = 1978;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 210, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1974;
							this.match(SolidCashParser.T__4);
							this.state = 1975;
							this.parameter();
							}
							}
						}
						this.state = 1980;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 210, this._ctx);
					}
					this.state = 1982;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1981;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1986;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
			this.state = 1989;
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
		this.enterRule(localctx, 224, SolidCashParser.RULE_breakStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1991;
			this.match(SolidCashParser.T__98);
			this.state = 1992;
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
		this.enterRule(localctx, 226, SolidCashParser.RULE_continueStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1994;
			this.match(SolidCashParser.T__99);
			this.state = 1995;
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
		this.enterRule(localctx, 228, SolidCashParser.RULE_requireMessage);
		try {
			this.state = 2000;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 151:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1997;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 180:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1998;
				this.match(SolidCashParser.Identifier);
				this.state = 1999;
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
		this.enterRule(localctx, 230, SolidCashParser.RULE_revertStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 2044;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 220, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2002;
				this.match(SolidCashParser.T__35);
				this.state = 2003;
				this.match(SolidCashParser.Identifier);
				this.state = 2006;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 2004;
					this.match(SolidCashParser.T__11);
					this.state = 2005;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 2008;
				this.match(SolidCashParser.T__48);
				this.state = 2009;
				this.match(SolidCashParser.T__3);
				this.state = 2021;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2010;
					this.namedArg();
					this.state = 2015;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 216, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2011;
							this.match(SolidCashParser.T__4);
							this.state = 2012;
							this.namedArg();
							}
							}
						}
						this.state = 2017;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 216, this._ctx);
					}
					this.state = 2019;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2018;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2023;
				this.match(SolidCashParser.T__5);
				this.state = 2024;
				this.match(SolidCashParser.T__49);
				this.state = 2025;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2026;
				this.match(SolidCashParser.T__35);
				this.state = 2027;
				this.match(SolidCashParser.Identifier);
				this.state = 2030;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 2028;
					this.match(SolidCashParser.T__11);
					this.state = 2029;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 2032;
				this.expressionList();
				this.state = 2033;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2035;
				this.match(SolidCashParser.T__35);
				this.state = 2036;
				this.match(SolidCashParser.T__48);
				this.state = 2037;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2038;
				this.match(SolidCashParser.T__49);
				this.state = 2039;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2040;
				this.match(SolidCashParser.T__35);
				this.state = 2041;
				this.match(SolidCashParser.T__48);
				this.state = 2042;
				this.match(SolidCashParser.T__49);
				this.state = 2043;
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
		this.enterRule(localctx, 232, SolidCashParser.RULE_assertStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2046;
			this.match(SolidCashParser.T__112);
			this.state = 2047;
			this.match(SolidCashParser.T__48);
			this.state = 2048;
			this.expression(0);
			this.state = 2049;
			this.match(SolidCashParser.T__49);
			this.state = 2050;
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
		this.enterRule(localctx, 234, SolidCashParser.RULE_consoleParameter);
		try {
			this.state = 2054;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 180:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2052;
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
				this.state = 2053;
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
		this.enterRule(localctx, 236, SolidCashParser.RULE_consoleParameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2056;
			this.match(SolidCashParser.T__48);
			this.state = 2068;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 3152921) !== 0) || _la===180) {
				{
				this.state = 2057;
				this.consoleParameter();
				this.state = 2062;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 222, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2058;
						this.match(SolidCashParser.T__4);
						this.state = 2059;
						this.consoleParameter();
						}
						}
					}
					this.state = 2064;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 222, this._ctx);
				}
				this.state = 2066;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2065;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2070;
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
		this.enterRule(localctx, 238, SolidCashParser.RULE_functionCall);
		let _la: number;
		try {
			let _alt: number;
			this.state = 2096;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 228, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2072;
				this.match(SolidCashParser.Identifier);
				this.state = 2073;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2074;
				this.match(SolidCashParser.Identifier);
				this.state = 2075;
				this.match(SolidCashParser.T__11);
				this.state = 2076;
				this.match(SolidCashParser.Identifier);
				this.state = 2077;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2078;
				this.match(SolidCashParser.Identifier);
				this.state = 2079;
				this.match(SolidCashParser.T__48);
				this.state = 2080;
				this.match(SolidCashParser.T__3);
				this.state = 2092;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2081;
					this.namedArg();
					this.state = 2086;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 225, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2082;
							this.match(SolidCashParser.T__4);
							this.state = 2083;
							this.namedArg();
							}
							}
						}
						this.state = 2088;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 225, this._ctx);
					}
					this.state = 2090;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2089;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2094;
				this.match(SolidCashParser.T__5);
				this.state = 2095;
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
		this.enterRule(localctx, 240, SolidCashParser.RULE_namedArg);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2098;
			this.match(SolidCashParser.Identifier);
			this.state = 2099;
			this.match(SolidCashParser.T__109);
			this.state = 2100;
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
		this.enterRule(localctx, 242, SolidCashParser.RULE_expressionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2102;
			this.match(SolidCashParser.T__48);
			this.state = 2114;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
				{
				this.state = 2103;
				this.expression(0);
				this.state = 2108;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 229, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2104;
						this.match(SolidCashParser.T__4);
						this.state = 2105;
						this.expression(0);
						}
						}
					}
					this.state = 2110;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 229, this._ctx);
				}
				this.state = 2112;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2111;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2116;
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
		this.enterRule(localctx, 244, SolidCashParser.RULE_callOptions);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2118;
			this.match(SolidCashParser.T__3);
			this.state = 2119;
			this.callOption();
			this.state = 2124;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 232, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2120;
					this.match(SolidCashParser.T__4);
					this.state = 2121;
					this.callOption();
					}
					}
				}
				this.state = 2126;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 232, this._ctx);
			}
			this.state = 2128;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2127;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 2130;
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
		this.enterRule(localctx, 246, SolidCashParser.RULE_callOption);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2132;
			this.match(SolidCashParser.Identifier);
			this.state = 2133;
			this.match(SolidCashParser.T__109);
			this.state = 2134;
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
		this.enterRule(localctx, 248, SolidCashParser.RULE_typeList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2136;
			this.match(SolidCashParser.T__48);
			this.state = 2137;
			this.typeName();
			this.state = 2142;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 234, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2138;
					this.match(SolidCashParser.T__4);
					this.state = 2139;
					this.typeName();
					}
					}
				}
				this.state = 2144;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 234, this._ctx);
			}
			this.state = 2146;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2145;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 2148;
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
		let _startState: number = 250;
		this.enterRecursionRule(localctx, 250, SolidCashParser.RULE_expression, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2295;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 243, this._ctx) ) {
			case 1:
				{
				localctx = new AssignmentExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 2151;
				this.match(SolidCashParser.T__48);
				this.state = 2152;
				this.match(SolidCashParser.Identifier);
				this.state = 2153;
				(localctx as AssignmentExpressionContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    (localctx as AssignmentExpressionContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2154;
				this.expression(0);
				this.state = 2155;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2157;
				this.match(SolidCashParser.T__48);
				this.state = 2158;
				this.expression(0);
				this.state = 2159;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				{
				localctx = new TupleExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2161;
				this.match(SolidCashParser.T__48);
				this.state = 2162;
				this.expression(0);
				this.state = 2165;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2163;
					this.match(SolidCashParser.T__4);
					this.state = 2164;
					this.expression(0);
					}
					}
					this.state = 2167;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2169;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 4:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2171;
				this.typeCast();
				this.state = 2172;
				this.match(SolidCashParser.T__48);
				this.state = 2173;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 2175;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2174;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 2177;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 5:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2179;
				this.functionCall();
				}
				break;
			case 6:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2180;
				this.match(SolidCashParser.T__113);
				this.state = 2181;
				this.match(SolidCashParser.Identifier);
				this.state = 2183;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 2182;
					this.callOptions();
					}
				}

				this.state = 2185;
				this.expressionList();
				}
				break;
			case 7:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2186;
				this.match(SolidCashParser.T__113);
				this.state = 2187;
				this.typeName();
				this.state = 2188;
				this.match(SolidCashParser.T__65);
				this.state = 2189;
				this.match(SolidCashParser.T__66);
				this.state = 2190;
				this.match(SolidCashParser.T__48);
				this.state = 2191;
				this.expression(0);
				this.state = 2192;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 8:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2194;
				this.match(SolidCashParser.T__54);
				this.state = 2195;
				this.match(SolidCashParser.T__48);
				this.state = 2196;
				this.typeName();
				this.state = 2197;
				this.match(SolidCashParser.T__49);
				this.state = 2198;
				this.match(SolidCashParser.T__11);
				this.state = 2199;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 9:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2201;
				this.match(SolidCashParser.T__114);
				this.state = 2202;
				this.expressionList();
				}
				break;
			case 10:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2203;
				this.match(SolidCashParser.T__115);
				this.state = 2204;
				this.expressionList();
				}
				break;
			case 11:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2205;
				this.match(SolidCashParser.T__116);
				this.state = 2206;
				this.expressionList();
				}
				break;
			case 12:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2207;
				this.match(SolidCashParser.T__117);
				this.state = 2208;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2209;
				this.match(SolidCashParser.T__118);
				this.state = 2210;
				this.match(SolidCashParser.T__48);
				this.state = 2211;
				this.match(SolidCashParser.Identifier);
				this.state = 2212;
				this.match(SolidCashParser.T__11);
				this.state = 2213;
				this.match(SolidCashParser.Identifier);
				this.state = 2214;
				this.match(SolidCashParser.T__4);
				this.state = 2215;
				this.expressionList();
				this.state = 2216;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 14:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2218;
				this.match(SolidCashParser.T__119);
				this.state = 2219;
				this.expressionList();
				}
				break;
			case 15:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2220;
				this.match(SolidCashParser.T__120);
				this.state = 2221;
				this.expressionList();
				}
				break;
			case 16:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2222;
				this.match(SolidCashParser.T__121);
				this.state = 2223;
				this.match(SolidCashParser.T__48);
				this.state = 2224;
				this.expression(0);
				this.state = 2225;
				this.match(SolidCashParser.T__4);
				this.state = 2226;
				this.typeList();
				this.state = 2227;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 17:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2229;
				this.match(SolidCashParser.T__122);
				this.state = 2230;
				this.match(SolidCashParser.T__48);
				this.state = 2231;
				this.expression(0);
				this.state = 2232;
				this.match(SolidCashParser.T__4);
				this.state = 2233;
				this.typeList();
				this.state = 2234;
				this.match(SolidCashParser.T__4);
				this.state = 2235;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 2236;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 18:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2238;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__123);
				this.state = 2239;
				this.match(SolidCashParser.T__65);
				this.state = 2240;
				this.expression(0);
				this.state = 2241;
				this.match(SolidCashParser.T__66);
				this.state = 2242;
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
			case 19:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2244;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__124);
				this.state = 2245;
				this.match(SolidCashParser.T__65);
				this.state = 2246;
				this.expression(0);
				this.state = 2247;
				this.match(SolidCashParser.T__66);
				this.state = 2248;
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
			case 20:
				{
				localctx = new UnaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2250;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===127)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2251;
				this.expression(21);
				}
				break;
			case 21:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2252;
				this.match(SolidCashParser.T__65);
				this.state = 2264;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 2253;
					this.expression(0);
					this.state = 2258;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 239, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2254;
							this.match(SolidCashParser.T__4);
							this.state = 2255;
							this.expression(0);
							}
							}
						}
						this.state = 2260;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 239, this._ctx);
					}
					this.state = 2262;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2261;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2266;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 22:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2267;
				this.match(SolidCashParser.T__73);
				this.state = 2268;
				this.match(SolidCashParser.T__11);
				this.state = 2269;
				this.match(SolidCashParser.Identifier);
				this.state = 2270;
				this.match(SolidCashParser.T__11);
				this.state = 2271;
				this.match(SolidCashParser.Identifier);
				this.state = 2272;
				this.match(SolidCashParser.T__65);
				this.state = 2273;
				this.expression(0);
				this.state = 2274;
				this.match(SolidCashParser.T__66);
				this.state = 2275;
				this.memberName();
				}
				break;
			case 23:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2277;
				this.match(SolidCashParser.T__73);
				this.state = 2278;
				this.match(SolidCashParser.T__11);
				this.state = 2279;
				this.match(SolidCashParser.Identifier);
				this.state = 2284;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2280;
						this.match(SolidCashParser.T__65);
						this.state = 2281;
						this.expression(0);
						this.state = 2282;
						this.match(SolidCashParser.T__66);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2286;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 242, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 24:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2288;
				this.match(SolidCashParser.T__73);
				this.state = 2289;
				this.match(SolidCashParser.T__11);
				this.state = 2290;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 25:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2291;
				this.match(SolidCashParser.T__73);
				}
				break;
			case 26:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2292;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 27:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2293;
				this.anyIdentifier();
				}
				break;
			case 28:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2294;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2404;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 250, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2402;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 249, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2297;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 2298;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 2299;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2300;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 2301;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2302;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2303;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 2304;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2305;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2306;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 2307;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===128 || _la===129)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2308;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2309;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 2310;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2311;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2312;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2313;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2314;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2315;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2316;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2317;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2318;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2319;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2320;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2321;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2322;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2323;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2324;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2325;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__129);
						this.state = 2326;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2327;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2328;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__130);
						this.state = 2329;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2330;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 2331;
						this.match(SolidCashParser.T__131);
						this.state = 2332;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 2333;
						this.match(SolidCashParser.T__109);
						this.state = 2334;
						(localctx as TernaryOpContext)._ifFalse = this.expression(9);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2336;
						if (!(this.precpred(this._ctx, 33))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 33)");
						}
						this.state = 2337;
						this.match(SolidCashParser.T__65);
						this.state = 2338;
						(localctx as IndexRangeSliceContext)._start = this.expression(0);
						this.state = 2339;
						this.match(SolidCashParser.T__109);
						this.state = 2340;
						(localctx as IndexRangeSliceContext)._end = this.expression(0);
						this.state = 2341;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2343;
						if (!(this.precpred(this._ctx, 32))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 32)");
						}
						this.state = 2344;
						this.match(SolidCashParser.T__65);
						this.state = 2345;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2346;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2347;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 2348;
						this.match(SolidCashParser.T__65);
						this.state = 2349;
						this.expression(0);
						this.state = 2350;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2352;
						if (!(this.precpred(this._ctx, 28))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 28)");
						}
						this.state = 2353;
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
						this.state = 2354;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2355;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.DotSplit);
						this.state = 2356;
						this.match(SolidCashParser.T__48);
						this.state = 2357;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2358;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2360;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2361;
						this.match(SolidCashParser.DotSlice);
						this.state = 2362;
						this.match(SolidCashParser.T__48);
						this.state = 2363;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2364;
						this.match(SolidCashParser.T__4);
						this.state = 2365;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2366;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2368;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2369;
						this.match(SolidCashParser.T__11);
						this.state = 2370;
						this.match(SolidCashParser.Identifier);
						this.state = 2372;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2371;
							this.callOptions();
							}
						}

						this.state = 2374;
						this.match(SolidCashParser.T__48);
						this.state = 2375;
						this.match(SolidCashParser.T__3);
						this.state = 2387;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===180) {
							{
							this.state = 2376;
							this.namedArg();
							this.state = 2381;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 245, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2377;
									this.match(SolidCashParser.T__4);
									this.state = 2378;
									this.namedArg();
									}
									}
								}
								this.state = 2383;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 245, this._ctx);
							}
							this.state = 2385;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2384;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2389;
						this.match(SolidCashParser.T__5);
						this.state = 2390;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 20:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2391;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2392;
						this.match(SolidCashParser.T__11);
						this.state = 2393;
						this.match(SolidCashParser.Identifier);
						this.state = 2395;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2394;
							this.callOptions();
							}
						}

						this.state = 2397;
						this.expressionList();
						}
						break;
					case 21:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2398;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2399;
						this.memberName();
						}
						break;
					case 22:
						{
						localctx = new PostfixOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2400;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 2401;
						(localctx as PostfixOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===87 || _la===88)) {
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
				this.state = 2406;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 250, this._ctx);
			}
			}
		}
		catch (re) {
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
		this.enterRule(localctx, 252, SolidCashParser.RULE_memberName);
		try {
			this.state = 2420;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2407;
				this.match(SolidCashParser.T__11);
				this.state = 2408;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2409;
				this.match(SolidCashParser.DotValue);
				}
				break;
			case 172:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2410;
				this.match(SolidCashParser.DotLockingBytecode);
				}
				break;
			case 173:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2411;
				this.match(SolidCashParser.DotTokenCategory);
				}
				break;
			case 174:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2412;
				this.match(SolidCashParser.DotNftCommitment);
				}
				break;
			case 175:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2413;
				this.match(SolidCashParser.DotTokenAmount);
				}
				break;
			case 176:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2414;
				this.match(SolidCashParser.DotOutpointTransactionHash);
				}
				break;
			case 177:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2415;
				this.match(SolidCashParser.DotOutpointIndex);
				}
				break;
			case 178:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2416;
				this.match(SolidCashParser.DotUnlockingBytecode);
				}
				break;
			case 179:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2417;
				this.match(SolidCashParser.DotSequenceNumber);
				}
				break;
			case 170:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2418;
				this.match(SolidCashParser.DotCode);
				}
				break;
			case 171:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2419;
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
		this.enterRule(localctx, 254, SolidCashParser.RULE_modifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2422;
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
		this.enterRule(localctx, 256, SolidCashParser.RULE_literal);
		try {
			let _alt: number;
			this.state = 2438;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 141:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2424;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 145:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2425;
				this.numberLiteral();
				}
				break;
			case 144:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2426;
				this.decimalLiteral();
				}
				break;
			case 151:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2427;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2431;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 252, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2428;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2433;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 252, this._ctx);
				}
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2434;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2435;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 152:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2436;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 153:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2437;
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
		this.enterRule(localctx, 258, SolidCashParser.RULE_numberLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2440;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2442;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 254, this._ctx) ) {
			case 1:
				{
				this.state = 2441;
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
		this.enterRule(localctx, 260, SolidCashParser.RULE_decimalLiteral);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2444;
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
		this.enterRule(localctx, 262, SolidCashParser.RULE_typeName);
		let _la: number;
		try {
			this.state = 2490;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 259, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2446;
				this.match(SolidCashParser.T__107);
				this.state = 2447;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2448;
				this.match(SolidCashParser.T__107);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2449;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2450;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2451;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2452;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2453;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2454;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2455;
				this.match(SolidCashParser.T__137);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2456;
				this.match(SolidCashParser.T__138);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2457;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2458;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2459;
				this.match(SolidCashParser.T__6);
				this.state = 2460;
				this.match(SolidCashParser.T__48);
				this.state = 2469;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 2461;
					this.typeName();
					this.state = 2466;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2462;
						this.match(SolidCashParser.T__4);
						this.state = 2463;
						this.typeName();
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
				this.state = 2484;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===73) {
					{
					this.state = 2472;
					this.match(SolidCashParser.T__72);
					this.state = 2473;
					this.match(SolidCashParser.T__48);
					this.state = 2474;
					this.typeName();
					this.state = 2479;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2475;
						this.match(SolidCashParser.T__4);
						this.state = 2476;
						this.typeName();
						}
						}
						this.state = 2481;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2482;
					this.match(SolidCashParser.T__49);
					}
				}

				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2486;
				this.match(SolidCashParser.Identifier);
				this.state = 2487;
				this.match(SolidCashParser.T__11);
				this.state = 2488;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 2489;
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
		this.enterRule(localctx, 264, SolidCashParser.RULE_typeCast);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2492;
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
		case 41:
			return this.arrayType_sempred(localctx as ArrayTypeContext, predIndex);
		case 125:
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

	public static readonly _serializedATN: number[] = [4,1,183,2495,2,0,7,0,
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
	7,127,2,128,7,128,2,129,7,129,2,130,7,130,2,131,7,131,2,132,7,132,1,0,5,
	0,268,8,0,10,0,12,0,271,9,0,1,0,5,0,274,8,0,10,0,12,0,277,9,0,1,0,1,0,1,
	0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,5,0,289,8,0,10,0,12,0,292,9,0,1,0,1,0,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,5,1,309,8,1,10,1,12,1,312,
	9,1,1,1,3,1,315,8,1,1,1,1,1,1,1,1,1,1,1,3,1,322,8,1,1,2,1,2,1,2,3,2,327,
	8,2,1,3,1,3,1,3,1,3,5,3,333,8,3,10,3,12,3,336,9,3,1,3,3,3,339,8,3,1,3,1,
	3,5,3,343,8,3,10,3,12,3,346,9,3,1,3,1,3,1,4,1,4,1,4,1,4,1,4,1,4,3,4,356,
	8,4,1,4,3,4,359,8,4,1,4,1,4,1,4,1,4,1,4,1,4,5,4,367,8,4,10,4,12,4,370,9,
	4,1,4,3,4,373,8,4,1,4,1,4,1,4,1,4,1,4,3,4,380,8,4,1,4,3,4,383,8,4,1,4,1,
	4,3,4,387,8,4,1,5,1,5,1,5,3,5,392,8,5,1,5,1,5,3,5,396,8,5,1,6,1,6,1,7,1,
	7,1,8,1,8,1,8,1,8,1,8,1,9,1,9,1,10,1,10,3,10,411,8,10,1,11,3,11,414,8,11,
	1,11,1,11,1,12,1,12,1,13,1,13,1,13,1,13,1,13,1,13,5,13,426,8,13,10,13,12,
	13,429,9,13,3,13,431,8,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,
	5,13,442,8,13,10,13,12,13,445,9,13,1,13,1,13,1,14,1,14,1,14,1,14,1,14,1,
	14,1,14,1,14,1,14,1,14,3,14,459,8,14,1,15,1,15,1,15,1,15,1,15,1,16,1,16,
	1,17,1,17,1,17,1,17,5,17,472,8,17,10,17,12,17,475,9,17,1,17,3,17,478,8,
	17,1,17,1,17,1,18,1,18,1,18,1,18,5,18,486,8,18,10,18,12,18,489,9,18,1,18,
	5,18,492,8,18,10,18,12,18,495,9,18,1,18,5,18,498,8,18,10,18,12,18,501,9,
	18,1,18,5,18,504,8,18,10,18,12,18,507,9,18,1,18,5,18,510,8,18,10,18,12,
	18,513,9,18,1,18,5,18,516,8,18,10,18,12,18,519,9,18,1,18,5,18,522,8,18,
	10,18,12,18,525,9,18,1,18,5,18,528,8,18,10,18,12,18,531,9,18,1,18,5,18,
	534,8,18,10,18,12,18,537,9,18,1,18,1,18,1,19,3,19,542,8,19,1,19,1,19,1,
	19,3,19,547,8,19,1,19,1,19,1,19,1,19,5,19,553,8,19,10,19,12,19,556,9,19,
	3,19,558,8,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,
	19,1,19,1,19,1,19,5,19,575,8,19,10,19,12,19,578,9,19,1,19,1,19,1,20,1,20,
	3,20,584,8,20,1,21,1,21,1,21,1,21,5,21,590,8,21,10,21,12,21,593,9,21,1,
	21,5,21,596,8,21,10,21,12,21,599,9,21,1,21,3,21,602,8,21,1,21,1,21,1,22,
	1,22,1,22,1,22,1,22,1,22,5,22,612,8,22,10,22,12,22,615,9,22,1,22,3,22,618,
	8,22,3,22,620,8,22,1,22,1,22,3,22,624,8,22,1,22,1,22,1,23,1,23,3,23,630,
	8,23,1,23,3,23,633,8,23,1,23,1,23,1,24,1,24,1,24,1,24,1,24,1,24,5,24,643,
	8,24,10,24,12,24,646,9,24,1,24,3,24,649,8,24,3,24,651,8,24,1,24,1,24,1,
	24,1,25,1,25,1,25,1,26,1,26,1,26,1,26,4,26,663,8,26,11,26,12,26,664,1,26,
	1,26,1,27,1,27,1,27,3,27,672,8,27,1,27,1,27,1,27,1,28,1,28,1,28,1,28,1,
	28,1,28,5,28,683,8,28,10,28,12,28,686,9,28,1,28,3,28,689,8,28,1,28,1,28,
	1,29,1,29,1,29,3,29,696,8,29,1,30,1,30,1,30,1,30,1,30,1,30,1,31,1,31,1,
	31,1,31,1,31,1,31,1,31,1,32,1,32,1,32,5,32,714,8,32,10,32,12,32,717,9,32,
	1,32,5,32,720,8,32,10,32,12,32,723,9,32,1,32,1,32,5,32,727,8,32,10,32,12,
	32,730,9,32,1,32,1,32,1,33,1,33,1,33,1,33,5,33,738,8,33,10,33,12,33,741,
	9,33,1,33,5,33,744,8,33,10,33,12,33,747,9,33,1,33,1,33,5,33,751,8,33,10,
	33,12,33,754,9,33,1,33,1,33,1,34,1,34,1,34,3,34,761,8,34,1,35,1,35,1,35,
	1,35,1,35,1,35,1,35,5,35,770,8,35,10,35,12,35,773,9,35,1,35,1,35,1,36,1,
	36,1,36,1,37,3,37,781,8,37,1,37,1,37,5,37,785,8,37,10,37,12,37,788,9,37,
	1,37,1,37,1,37,3,37,793,8,37,1,37,1,37,1,37,1,37,1,37,5,37,800,8,37,10,
	37,12,37,803,9,37,1,37,1,37,1,37,3,37,808,8,37,1,37,1,37,1,37,3,37,813,
	8,37,1,37,1,37,5,37,817,8,37,10,37,12,37,820,9,37,1,37,1,37,1,37,1,37,3,
	37,826,8,37,1,37,1,37,5,37,830,8,37,10,37,12,37,833,9,37,1,37,1,37,1,37,
	3,37,838,8,37,1,37,1,37,3,37,842,8,37,1,38,1,38,3,38,846,8,38,1,39,1,39,
	1,40,1,40,1,40,1,40,3,40,854,8,40,1,40,1,40,1,40,3,40,859,8,40,1,40,1,40,
	1,40,1,40,1,40,1,40,3,40,867,8,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,
	40,3,40,877,8,40,1,40,1,40,1,40,3,40,882,8,40,1,40,1,40,3,40,886,8,40,1,
	41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,3,41,898,8,41,1,41,1,41,
	1,41,1,41,1,41,1,41,1,41,5,41,907,8,41,10,41,12,41,910,9,41,1,42,1,42,1,
	42,3,42,915,8,42,1,42,1,42,5,42,919,8,42,10,42,12,42,922,9,42,1,42,1,42,
	1,43,1,43,3,43,928,8,43,1,44,1,44,1,44,1,45,1,45,1,45,1,45,5,45,937,8,45,
	10,45,12,45,940,9,45,1,45,5,45,943,8,45,10,45,12,45,946,9,45,1,45,3,45,
	949,8,45,1,45,1,45,5,45,953,8,45,10,45,12,45,956,9,45,1,45,1,45,1,46,1,
	46,3,46,962,8,46,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,
	1,47,1,47,1,47,3,47,978,8,47,1,48,1,48,1,48,1,48,1,48,5,48,985,8,48,10,
	48,12,48,988,9,48,1,48,3,48,991,8,48,1,49,1,49,1,49,1,49,3,49,997,8,49,
	1,50,1,50,1,50,1,50,1,50,5,50,1004,8,50,10,50,12,50,1007,9,50,1,50,3,50,
	1010,8,50,1,50,1,50,1,51,1,51,5,51,1016,8,51,10,51,12,51,1019,9,51,1,51,
	3,51,1022,8,51,1,51,1,51,5,51,1026,8,51,10,51,12,51,1029,9,51,1,51,3,51,
	1032,8,51,3,51,1034,8,51,1,52,1,52,1,52,1,52,5,52,1040,8,52,10,52,12,52,
	1043,9,52,1,52,3,52,1046,8,52,3,52,1048,8,52,1,52,1,52,1,53,1,53,5,53,1054,
	8,53,10,53,12,53,1057,9,53,1,53,3,53,1060,8,53,1,53,1,53,5,53,1064,8,53,
	10,53,12,53,1067,9,53,1,53,3,53,1070,8,53,1,53,1,53,5,53,1074,8,53,10,53,
	12,53,1077,9,53,1,53,3,53,1080,8,53,3,53,1082,8,53,1,54,1,54,5,54,1086,
	8,54,10,54,12,54,1089,9,54,1,54,1,54,3,54,1093,8,54,1,55,1,55,1,55,1,55,
	1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,
	55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,3,55,1126,
	8,55,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,57,1,57,1,57,1,
	57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,5,57,1150,8,57,10,57,12,57,1153,
	9,57,1,57,1,57,1,57,1,58,1,58,1,58,1,58,1,58,1,58,5,58,1164,8,58,10,58,
	12,58,1167,9,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,5,58,1176,8,58,10,58,
	12,58,1179,9,58,1,58,3,58,1182,8,58,1,58,1,58,1,58,3,58,1187,8,58,1,59,
	1,59,1,59,3,59,1192,8,59,1,59,1,59,1,59,1,59,1,59,5,59,1199,8,59,10,59,
	12,59,1202,9,59,1,59,3,59,1205,8,59,3,59,1207,8,59,1,59,1,59,1,59,1,59,
	1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,
	59,1,59,3,59,1229,8,59,1,59,1,59,1,59,3,59,1234,8,59,1,60,1,60,1,60,1,60,
	3,60,1240,8,60,1,60,1,60,1,60,1,61,1,61,1,61,1,61,1,61,1,61,1,62,1,62,1,
	62,1,62,3,62,1255,8,62,1,62,1,62,1,62,1,62,1,62,5,62,1262,8,62,10,62,12,
	62,1265,9,62,1,62,3,62,1268,8,62,3,62,1270,8,62,1,62,1,62,1,62,1,62,1,62,
	1,62,1,62,3,62,1279,8,62,1,62,1,62,1,62,3,62,1284,8,62,1,63,1,63,1,63,1,
	63,1,63,1,63,1,63,4,63,1293,8,63,11,63,12,63,1294,3,63,1297,8,63,1,63,1,
	63,5,63,1301,8,63,10,63,12,63,1304,9,63,1,63,1,63,1,63,1,63,1,63,1,63,1,
	63,1,63,1,63,4,63,1315,8,63,11,63,12,63,1316,1,63,1,63,5,63,1321,8,63,10,
	63,12,63,1324,9,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1333,8,63,11,
	63,12,63,1334,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1344,8,63,11,63,12,
	63,1345,1,63,1,63,1,63,1,63,4,63,1352,8,63,11,63,12,63,1353,1,63,1,63,1,
	63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1367,8,63,11,63,12,63,1368,
	3,63,1371,8,63,1,63,1,63,5,63,1375,8,63,10,63,12,63,1378,9,63,1,63,1,63,
	1,63,1,63,1,63,1,63,1,63,4,63,1387,8,63,11,63,12,63,1388,1,63,1,63,5,63,
	1393,8,63,10,63,12,63,1396,9,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1404,
	8,63,11,63,12,63,1405,1,63,1,63,3,63,1410,8,63,1,64,1,64,1,64,1,64,1,64,
	1,64,1,64,5,64,1419,8,64,10,64,12,64,1422,9,64,1,64,1,64,1,64,1,64,1,64,
	1,64,1,65,1,65,5,65,1432,8,65,10,65,12,65,1435,9,65,1,65,1,65,1,65,3,65,
	1440,8,65,1,65,1,65,1,65,1,65,5,65,1446,8,65,10,65,12,65,1449,9,65,1,65,
	1,65,1,65,3,65,1454,8,65,1,65,1,65,3,65,1458,8,65,1,66,1,66,1,66,1,66,1,
	66,1,66,4,66,1466,8,66,11,66,12,66,1467,1,66,1,66,1,66,1,66,1,66,1,66,1,
	66,1,66,4,66,1478,8,66,11,66,12,66,1479,1,66,1,66,1,66,1,66,1,66,1,66,4,
	66,1488,8,66,11,66,12,66,1489,1,66,1,66,1,66,1,66,1,66,1,66,1,66,4,66,1499,
	8,66,11,66,12,66,1500,1,66,1,66,1,66,1,66,1,66,3,66,1508,8,66,1,67,1,67,
	5,67,1512,8,67,10,67,12,67,1515,9,67,1,67,1,67,1,67,1,67,3,67,1521,8,67,
	1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,3,68,1534,8,68,1,
	69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,
	1,69,3,69,1552,8,69,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,
	70,1,70,3,70,1566,8,70,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,72,1,72,1,72,
	1,72,1,72,1,72,1,72,1,72,1,72,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,
	74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,
	1,74,4,74,1608,8,74,11,74,12,74,1609,1,74,1,74,1,74,1,74,1,74,1,74,1,74,
	1,74,4,74,1620,8,74,11,74,12,74,1621,1,74,1,74,3,74,1626,8,74,1,75,1,75,
	1,75,1,75,1,75,1,75,1,75,3,75,1635,8,75,1,75,1,75,1,75,1,76,1,76,1,76,1,
	76,1,76,3,76,1645,8,76,1,76,1,76,1,76,1,77,1,77,1,77,1,77,1,77,1,77,1,77,
	3,77,1657,8,77,1,78,1,78,1,78,1,78,1,78,1,78,3,78,1665,8,78,1,79,1,79,1,
	79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,80,
	1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,81,1,81,1,81,1,81,1,
	81,1,81,1,81,1,81,1,81,1,81,1,81,1,82,1,82,1,82,1,82,1,82,3,82,1710,8,82,
	1,82,1,82,1,82,1,83,1,83,5,83,1717,8,83,10,83,12,83,1720,9,83,1,83,1,83,
	1,83,3,83,1725,8,83,1,83,1,83,1,84,1,84,1,84,1,85,1,85,1,85,1,85,1,85,1,
	85,1,85,3,85,1739,8,85,1,86,1,86,1,86,1,86,1,86,1,86,1,86,1,86,1,87,1,87,
	1,87,1,87,1,87,1,87,1,88,1,88,1,88,1,88,1,89,1,89,1,89,1,90,1,90,5,90,1764,
	8,90,10,90,12,90,1767,9,90,1,90,1,90,1,91,1,91,1,91,1,91,1,91,1,91,1,91,
	1,91,1,91,1,91,1,91,1,91,1,91,3,91,1784,8,91,1,92,1,92,1,92,1,92,5,92,1790,
	8,92,10,92,12,92,1793,9,92,1,92,1,92,3,92,1797,8,92,1,93,1,93,1,93,5,93,
	1802,8,93,10,93,12,93,1805,9,93,1,93,1,93,1,93,1,94,1,94,1,94,1,94,1,95,
	1,95,1,95,4,95,1817,8,95,11,95,12,95,1818,1,95,3,95,1822,8,95,1,95,3,95,
	1825,8,95,1,96,1,96,1,96,1,96,1,97,1,97,1,97,1,98,1,98,1,98,1,98,1,98,1,
	98,1,99,1,99,1,99,1,99,1,99,1,99,5,99,1846,8,99,10,99,12,99,1849,9,99,3,
	99,1851,8,99,1,99,1,99,1,99,1,99,1,99,5,99,1858,8,99,10,99,12,99,1861,9,
	99,3,99,1863,8,99,1,99,1,99,1,100,1,100,1,100,3,100,1870,8,100,1,101,1,
	101,1,101,1,101,1,101,5,101,1877,8,101,10,101,12,101,1880,9,101,3,101,1882,
	8,101,1,101,1,101,1,102,1,102,1,103,1,103,1,103,5,103,1891,8,103,10,103,
	12,103,1894,9,103,1,104,1,104,1,105,1,105,1,105,5,105,1901,8,105,10,105,
	12,105,1904,9,105,1,105,1,105,1,106,1,106,1,106,1,106,1,106,1,106,5,106,
	1914,8,106,10,106,12,106,1917,9,106,1,106,3,106,1920,8,106,1,106,1,106,
	1,107,1,107,1,107,1,107,5,107,1928,8,107,10,107,12,107,1931,9,107,1,108,
	1,108,1,108,5,108,1936,8,108,10,108,12,108,1939,9,108,1,109,1,109,1,109,
	3,109,1944,8,109,1,109,1,109,4,109,1948,8,109,11,109,12,109,1949,1,110,
	1,110,1,110,1,110,1,110,5,110,1957,8,110,10,110,12,110,1960,9,110,1,110,
	3,110,1963,8,110,3,110,1965,8,110,1,110,1,110,1,111,1,111,3,111,1971,8,
	111,1,111,1,111,1,111,1,111,5,111,1977,8,111,10,111,12,111,1980,9,111,1,
	111,3,111,1983,8,111,3,111,1985,8,111,1,111,3,111,1988,8,111,1,111,1,111,
	1,112,1,112,1,112,1,113,1,113,1,113,1,114,1,114,1,114,3,114,2001,8,114,
	1,115,1,115,1,115,1,115,3,115,2007,8,115,1,115,1,115,1,115,1,115,1,115,
	5,115,2014,8,115,10,115,12,115,2017,9,115,1,115,3,115,2020,8,115,3,115,
	2022,8,115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,3,115,2031,8,115,1,
	115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,1,115,3,
	115,2045,8,115,1,116,1,116,1,116,1,116,1,116,1,116,1,117,1,117,3,117,2055,
	8,117,1,118,1,118,1,118,1,118,5,118,2061,8,118,10,118,12,118,2064,9,118,
	1,118,3,118,2067,8,118,3,118,2069,8,118,1,118,1,118,1,119,1,119,1,119,1,
	119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,5,119,2085,8,119,10,
	119,12,119,2088,9,119,1,119,3,119,2091,8,119,3,119,2093,8,119,1,119,1,119,
	3,119,2097,8,119,1,120,1,120,1,120,1,120,1,121,1,121,1,121,1,121,5,121,
	2107,8,121,10,121,12,121,2110,9,121,1,121,3,121,2113,8,121,3,121,2115,8,
	121,1,121,1,121,1,122,1,122,1,122,1,122,5,122,2123,8,122,10,122,12,122,
	2126,9,122,1,122,3,122,2129,8,122,1,122,1,122,1,123,1,123,1,123,1,123,1,
	124,1,124,1,124,1,124,5,124,2141,8,124,10,124,12,124,2144,9,124,1,124,3,
	124,2147,8,124,1,124,1,124,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,
	125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,4,125,2166,8,125,11,125,12,
	125,2167,1,125,1,125,1,125,1,125,1,125,1,125,3,125,2176,8,125,1,125,1,125,
	1,125,1,125,1,125,1,125,3,125,2184,8,125,1,125,1,125,1,125,1,125,1,125,
	1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,
	1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,
	1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,
	1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,
	1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,
	1,125,1,125,1,125,1,125,1,125,1,125,5,125,2257,8,125,10,125,12,125,2260,
	9,125,1,125,3,125,2263,8,125,3,125,2265,8,125,1,125,1,125,1,125,1,125,1,
	125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,
	125,1,125,4,125,2285,8,125,11,125,12,125,2286,1,125,1,125,1,125,1,125,1,
	125,1,125,1,125,3,125,2296,8,125,1,125,1,125,1,125,1,125,1,125,1,125,1,
	125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,
	125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,
	125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,
	125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,
	125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,
	125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,3,125,2373,8,125,1,
	125,1,125,1,125,1,125,1,125,5,125,2380,8,125,10,125,12,125,2383,9,125,1,
	125,3,125,2386,8,125,3,125,2388,8,125,1,125,1,125,1,125,1,125,1,125,1,125,
	3,125,2396,8,125,1,125,1,125,1,125,1,125,1,125,5,125,2403,8,125,10,125,
	12,125,2406,9,125,1,126,1,126,1,126,1,126,1,126,1,126,1,126,1,126,1,126,
	1,126,1,126,1,126,1,126,3,126,2421,8,126,1,127,1,127,1,128,1,128,1,128,
	1,128,1,128,5,128,2430,8,128,10,128,12,128,2433,9,128,1,128,1,128,1,128,
	1,128,3,128,2439,8,128,1,129,1,129,3,129,2443,8,129,1,130,1,130,1,131,1,
	131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,
	131,1,131,1,131,1,131,1,131,5,131,2465,8,131,10,131,12,131,2468,9,131,3,
	131,2470,8,131,1,131,1,131,1,131,1,131,1,131,1,131,5,131,2478,8,131,10,
	131,12,131,2481,9,131,1,131,1,131,3,131,2485,8,131,1,131,1,131,1,131,1,
	131,3,131,2491,8,131,1,132,1,132,1,132,0,2,82,250,133,0,2,4,6,8,10,12,14,
	16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,
	64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,
	110,112,114,116,118,120,122,124,126,128,130,132,134,136,138,140,142,144,
	146,148,150,152,154,156,158,160,162,164,166,168,170,172,174,176,178,180,
	182,184,186,188,190,192,194,196,198,200,202,204,206,208,210,212,214,216,
	218,220,222,224,226,228,230,232,234,236,238,240,242,244,246,248,250,252,
	254,256,258,260,262,264,0,24,2,0,10,10,13,27,5,0,11,11,28,36,143,143,147,
	147,180,180,1,0,38,39,3,0,20,23,26,27,40,40,1,0,43,44,2,0,43,44,58,59,3,
	0,43,44,58,58,63,63,2,0,145,145,180,180,2,0,40,40,77,86,1,0,87,88,6,0,31,
	31,36,36,75,75,108,108,149,149,180,180,5,0,141,141,145,145,151,151,153,
	153,162,162,2,0,163,163,172,175,2,0,163,163,172,179,3,0,14,14,27,27,127,
	127,2,0,10,10,15,16,1,0,13,14,1,0,128,129,1,0,20,23,1,0,18,19,2,0,126,126,
	164,164,3,0,33,33,56,56,133,137,1,0,142,143,5,0,59,59,108,108,138,139,146,
	149,155,159,2805,0,269,1,0,0,0,2,321,1,0,0,0,4,323,1,0,0,0,6,328,1,0,0,
	0,8,386,1,0,0,0,10,388,1,0,0,0,12,397,1,0,0,0,14,399,1,0,0,0,16,401,1,0,
	0,0,18,406,1,0,0,0,20,408,1,0,0,0,22,413,1,0,0,0,24,417,1,0,0,0,26,419,
	1,0,0,0,28,458,1,0,0,0,30,460,1,0,0,0,32,465,1,0,0,0,34,467,1,0,0,0,36,
	481,1,0,0,0,38,541,1,0,0,0,40,581,1,0,0,0,42,585,1,0,0,0,44,605,1,0,0,0,
	46,629,1,0,0,0,48,636,1,0,0,0,50,655,1,0,0,0,52,658,1,0,0,0,54,671,1,0,
	0,0,56,676,1,0,0,0,58,692,1,0,0,0,60,697,1,0,0,0,62,703,1,0,0,0,64,710,
	1,0,0,0,66,733,1,0,0,0,68,760,1,0,0,0,70,762,1,0,0,0,72,776,1,0,0,0,74,
	841,1,0,0,0,76,845,1,0,0,0,78,847,1,0,0,0,80,885,1,0,0,0,82,897,1,0,0,0,
	84,911,1,0,0,0,86,927,1,0,0,0,88,929,1,0,0,0,90,932,1,0,0,0,92,959,1,0,
	0,0,94,977,1,0,0,0,96,979,1,0,0,0,98,992,1,0,0,0,100,998,1,0,0,0,102,1033,
	1,0,0,0,104,1035,1,0,0,0,106,1081,1,0,0,0,108,1092,1,0,0,0,110,1125,1,0,
	0,0,112,1127,1,0,0,0,114,1137,1,0,0,0,116,1186,1,0,0,0,118,1233,1,0,0,0,
	120,1235,1,0,0,0,122,1244,1,0,0,0,124,1283,1,0,0,0,126,1409,1,0,0,0,128,
	1411,1,0,0,0,130,1457,1,0,0,0,132,1507,1,0,0,0,134,1520,1,0,0,0,136,1533,
	1,0,0,0,138,1551,1,0,0,0,140,1565,1,0,0,0,142,1567,1,0,0,0,144,1574,1,0,
	0,0,146,1583,1,0,0,0,148,1625,1,0,0,0,150,1627,1,0,0,0,152,1639,1,0,0,0,
	154,1649,1,0,0,0,156,1664,1,0,0,0,158,1666,1,0,0,0,160,1682,1,0,0,0,162,
	1693,1,0,0,0,164,1704,1,0,0,0,166,1714,1,0,0,0,168,1728,1,0,0,0,170,1738,
	1,0,0,0,172,1740,1,0,0,0,174,1748,1,0,0,0,176,1754,1,0,0,0,178,1758,1,0,
	0,0,180,1761,1,0,0,0,182,1783,1,0,0,0,184,1785,1,0,0,0,186,1798,1,0,0,0,
	188,1809,1,0,0,0,190,1813,1,0,0,0,192,1826,1,0,0,0,194,1830,1,0,0,0,196,
	1833,1,0,0,0,198,1839,1,0,0,0,200,1869,1,0,0,0,202,1871,1,0,0,0,204,1885,
	1,0,0,0,206,1887,1,0,0,0,208,1895,1,0,0,0,210,1897,1,0,0,0,212,1907,1,0,
	0,0,214,1923,1,0,0,0,216,1932,1,0,0,0,218,1940,1,0,0,0,220,1951,1,0,0,0,
	222,1968,1,0,0,0,224,1991,1,0,0,0,226,1994,1,0,0,0,228,2000,1,0,0,0,230,
	2044,1,0,0,0,232,2046,1,0,0,0,234,2054,1,0,0,0,236,2056,1,0,0,0,238,2096,
	1,0,0,0,240,2098,1,0,0,0,242,2102,1,0,0,0,244,2118,1,0,0,0,246,2132,1,0,
	0,0,248,2136,1,0,0,0,250,2295,1,0,0,0,252,2420,1,0,0,0,254,2422,1,0,0,0,
	256,2438,1,0,0,0,258,2440,1,0,0,0,260,2444,1,0,0,0,262,2490,1,0,0,0,264,
	2492,1,0,0,0,266,268,3,16,8,0,267,266,1,0,0,0,268,271,1,0,0,0,269,267,1,
	0,0,0,269,270,1,0,0,0,270,275,1,0,0,0,271,269,1,0,0,0,272,274,3,2,1,0,273,
	272,1,0,0,0,274,277,1,0,0,0,275,273,1,0,0,0,275,276,1,0,0,0,276,290,1,0,
	0,0,277,275,1,0,0,0,278,289,3,62,31,0,279,289,3,56,28,0,280,289,3,52,26,
	0,281,289,3,60,30,0,282,289,3,8,4,0,283,289,3,48,24,0,284,289,3,26,13,0,
	285,289,3,6,3,0,286,289,3,36,18,0,287,289,3,38,19,0,288,278,1,0,0,0,288,
	279,1,0,0,0,288,280,1,0,0,0,288,281,1,0,0,0,288,282,1,0,0,0,288,283,1,0,
	0,0,288,284,1,0,0,0,288,285,1,0,0,0,288,286,1,0,0,0,288,287,1,0,0,0,289,
	292,1,0,0,0,290,288,1,0,0,0,290,291,1,0,0,0,291,293,1,0,0,0,292,290,1,0,
	0,0,293,294,5,0,0,1,294,1,1,0,0,0,295,296,5,1,0,0,296,297,5,151,0,0,297,
	322,5,2,0,0,298,299,5,1,0,0,299,300,5,151,0,0,300,301,5,3,0,0,301,302,5,
	180,0,0,302,322,5,2,0,0,303,304,5,1,0,0,304,305,5,4,0,0,305,310,3,4,2,0,
	306,307,5,5,0,0,307,309,3,4,2,0,308,306,1,0,0,0,309,312,1,0,0,0,310,308,
	1,0,0,0,310,311,1,0,0,0,311,314,1,0,0,0,312,310,1,0,0,0,313,315,5,5,0,0,
	314,313,1,0,0,0,314,315,1,0,0,0,315,316,1,0,0,0,316,317,5,6,0,0,317,318,
	5,180,0,0,318,319,5,151,0,0,319,320,5,2,0,0,320,322,1,0,0,0,321,295,1,0,
	0,0,321,298,1,0,0,0,321,303,1,0,0,0,322,3,1,0,0,0,323,326,5,180,0,0,324,
	325,5,3,0,0,325,327,5,180,0,0,326,324,1,0,0,0,326,327,1,0,0,0,327,5,1,0,
	0,0,328,329,5,7,0,0,329,330,3,14,7,0,330,334,3,104,52,0,331,333,3,94,47,
	0,332,331,1,0,0,0,333,336,1,0,0,0,334,332,1,0,0,0,334,335,1,0,0,0,335,338,
	1,0,0,0,336,334,1,0,0,0,337,339,3,100,50,0,338,337,1,0,0,0,338,339,1,0,
	0,0,339,340,1,0,0,0,340,344,5,4,0,0,341,343,3,110,55,0,342,341,1,0,0,0,
	343,346,1,0,0,0,344,342,1,0,0,0,344,345,1,0,0,0,345,347,1,0,0,0,346,344,
	1,0,0,0,347,348,5,6,0,0,348,7,1,0,0,0,349,350,5,8,0,0,350,351,5,180,0,0,
	351,355,5,9,0,0,352,356,3,82,41,0,353,356,3,262,131,0,354,356,5,10,0,0,
	355,352,1,0,0,0,355,353,1,0,0,0,355,354,1,0,0,0,356,358,1,0,0,0,357,359,
	5,11,0,0,358,357,1,0,0,0,358,359,1,0,0,0,359,360,1,0,0,0,360,387,5,2,0,
	0,361,362,5,8,0,0,362,363,5,4,0,0,363,368,3,10,5,0,364,365,5,5,0,0,365,
	367,3,10,5,0,366,364,1,0,0,0,367,370,1,0,0,0,368,366,1,0,0,0,368,369,1,
	0,0,0,369,372,1,0,0,0,370,368,1,0,0,0,371,373,5,5,0,0,372,371,1,0,0,0,372,
	373,1,0,0,0,373,374,1,0,0,0,374,375,5,6,0,0,375,379,5,9,0,0,376,380,3,82,
	41,0,377,380,3,262,131,0,378,380,5,10,0,0,379,376,1,0,0,0,379,377,1,0,0,
	0,379,378,1,0,0,0,380,382,1,0,0,0,381,383,5,11,0,0,382,381,1,0,0,0,382,
	383,1,0,0,0,383,384,1,0,0,0,384,385,5,2,0,0,385,387,1,0,0,0,386,349,1,0,
	0,0,386,361,1,0,0,0,387,9,1,0,0,0,388,391,5,180,0,0,389,390,5,12,0,0,390,
	392,5,180,0,0,391,389,1,0,0,0,391,392,1,0,0,0,392,395,1,0,0,0,393,394,5,
	3,0,0,394,396,3,12,6,0,395,393,1,0,0,0,395,396,1,0,0,0,396,11,1,0,0,0,397,
	398,7,0,0,0,398,13,1,0,0,0,399,400,7,1,0,0,400,15,1,0,0,0,401,402,5,37,
	0,0,402,403,3,18,9,0,403,404,3,20,10,0,404,405,5,2,0,0,405,17,1,0,0,0,406,
	407,7,2,0,0,407,19,1,0,0,0,408,410,3,22,11,0,409,411,3,22,11,0,410,409,
	1,0,0,0,410,411,1,0,0,0,411,21,1,0,0,0,412,414,3,24,12,0,413,412,1,0,0,
	0,413,414,1,0,0,0,414,415,1,0,0,0,415,416,5,140,0,0,416,23,1,0,0,0,417,
	418,7,3,0,0,418,25,1,0,0,0,419,420,5,41,0,0,420,430,5,180,0,0,421,422,5,
	42,0,0,422,427,5,180,0,0,423,424,5,5,0,0,424,426,5,180,0,0,425,423,1,0,
	0,0,426,429,1,0,0,0,427,425,1,0,0,0,427,428,1,0,0,0,428,431,1,0,0,0,429,
	427,1,0,0,0,430,421,1,0,0,0,430,431,1,0,0,0,431,432,1,0,0,0,432,443,5,4,
	0,0,433,442,3,56,28,0,434,442,3,52,26,0,435,442,3,60,30,0,436,442,3,44,
	22,0,437,442,3,48,24,0,438,442,3,30,15,0,439,442,3,28,14,0,440,442,3,34,
	17,0,441,433,1,0,0,0,441,434,1,0,0,0,441,435,1,0,0,0,441,436,1,0,0,0,441,
	437,1,0,0,0,441,438,1,0,0,0,441,439,1,0,0,0,441,440,1,0,0,0,442,445,1,0,
	0,0,443,441,1,0,0,0,443,444,1,0,0,0,444,446,1,0,0,0,445,443,1,0,0,0,446,
	447,5,6,0,0,447,27,1,0,0,0,448,449,3,32,16,0,449,450,3,80,40,0,450,451,
	5,180,0,0,451,452,5,2,0,0,452,459,1,0,0,0,453,454,3,32,16,0,454,455,3,82,
	41,0,455,456,5,180,0,0,456,457,5,2,0,0,457,459,1,0,0,0,458,448,1,0,0,0,
	458,453,1,0,0,0,459,29,1,0,0,0,460,461,3,32,16,0,461,462,3,262,131,0,462,
	463,5,180,0,0,463,464,5,2,0,0,464,31,1,0,0,0,465,466,7,4,0,0,466,33,1,0,
	0,0,467,468,5,7,0,0,468,469,5,180,0,0,469,473,3,104,52,0,470,472,3,94,47,
	0,471,470,1,0,0,0,472,475,1,0,0,0,473,471,1,0,0,0,473,474,1,0,0,0,474,477,
	1,0,0,0,475,473,1,0,0,0,476,478,3,100,50,0,477,476,1,0,0,0,477,478,1,0,
	0,0,478,479,1,0,0,0,479,480,5,2,0,0,480,35,1,0,0,0,481,482,5,45,0,0,482,
	483,5,180,0,0,483,487,5,4,0,0,484,486,3,56,28,0,485,484,1,0,0,0,486,489,
	1,0,0,0,487,485,1,0,0,0,487,488,1,0,0,0,488,493,1,0,0,0,489,487,1,0,0,0,
	490,492,3,52,26,0,491,490,1,0,0,0,492,495,1,0,0,0,493,491,1,0,0,0,493,494,
	1,0,0,0,494,499,1,0,0,0,495,493,1,0,0,0,496,498,3,60,30,0,497,496,1,0,0,
	0,498,501,1,0,0,0,499,497,1,0,0,0,499,500,1,0,0,0,500,505,1,0,0,0,501,499,
	1,0,0,0,502,504,3,44,22,0,503,502,1,0,0,0,504,507,1,0,0,0,505,503,1,0,0,
	0,505,506,1,0,0,0,506,511,1,0,0,0,507,505,1,0,0,0,508,510,3,48,24,0,509,
	508,1,0,0,0,510,513,1,0,0,0,511,509,1,0,0,0,511,512,1,0,0,0,512,517,1,0,
	0,0,513,511,1,0,0,0,514,516,3,62,31,0,515,514,1,0,0,0,516,519,1,0,0,0,517,
	515,1,0,0,0,517,518,1,0,0,0,518,523,1,0,0,0,519,517,1,0,0,0,520,522,3,74,
	37,0,521,520,1,0,0,0,522,525,1,0,0,0,523,521,1,0,0,0,523,524,1,0,0,0,524,
	529,1,0,0,0,525,523,1,0,0,0,526,528,3,8,4,0,527,526,1,0,0,0,528,531,1,0,
	0,0,529,527,1,0,0,0,529,530,1,0,0,0,530,535,1,0,0,0,531,529,1,0,0,0,532,
	534,3,6,3,0,533,532,1,0,0,0,534,537,1,0,0,0,535,533,1,0,0,0,535,536,1,0,
	0,0,536,538,1,0,0,0,537,535,1,0,0,0,538,539,5,6,0,0,539,37,1,0,0,0,540,
	542,5,46,0,0,541,540,1,0,0,0,541,542,1,0,0,0,542,543,1,0,0,0,543,544,5,
	47,0,0,544,546,5,180,0,0,545,547,3,104,52,0,546,545,1,0,0,0,546,547,1,0,
	0,0,547,557,1,0,0,0,548,549,5,42,0,0,549,554,3,40,20,0,550,551,5,5,0,0,
	551,553,3,40,20,0,552,550,1,0,0,0,553,556,1,0,0,0,554,552,1,0,0,0,554,555,
	1,0,0,0,555,558,1,0,0,0,556,554,1,0,0,0,557,548,1,0,0,0,557,558,1,0,0,0,
	558,559,1,0,0,0,559,576,5,4,0,0,560,575,3,56,28,0,561,575,3,52,26,0,562,
	575,3,60,30,0,563,575,3,44,22,0,564,575,3,48,24,0,565,575,3,62,31,0,566,
	575,3,8,4,0,567,575,3,74,37,0,568,575,3,84,42,0,569,575,3,64,32,0,570,575,
	3,90,45,0,571,575,3,42,21,0,572,575,3,66,33,0,573,575,3,70,35,0,574,560,
	1,0,0,0,574,561,1,0,0,0,574,562,1,0,0,0,574,563,1,0,0,0,574,564,1,0,0,0,
	574,565,1,0,0,0,574,566,1,0,0,0,574,567,1,0,0,0,574,568,1,0,0,0,574,569,
	1,0,0,0,574,570,1,0,0,0,574,571,1,0,0,0,574,572,1,0,0,0,574,573,1,0,0,0,
	575,578,1,0,0,0,576,574,1,0,0,0,576,577,1,0,0,0,577,579,1,0,0,0,578,576,
	1,0,0,0,579,580,5,6,0,0,580,39,1,0,0,0,581,583,5,180,0,0,582,584,3,242,
	121,0,583,582,1,0,0,0,583,584,1,0,0,0,584,41,1,0,0,0,585,586,5,7,0,0,586,
	587,3,14,7,0,587,591,3,104,52,0,588,590,3,94,47,0,589,588,1,0,0,0,590,593,
	1,0,0,0,591,589,1,0,0,0,591,592,1,0,0,0,592,597,1,0,0,0,593,591,1,0,0,0,
	594,596,3,92,46,0,595,594,1,0,0,0,596,599,1,0,0,0,597,595,1,0,0,0,597,598,
	1,0,0,0,598,601,1,0,0,0,599,597,1,0,0,0,600,602,3,100,50,0,601,600,1,0,
	0,0,601,602,1,0,0,0,602,603,1,0,0,0,603,604,5,2,0,0,604,43,1,0,0,0,605,
	606,5,48,0,0,606,607,5,180,0,0,607,619,5,49,0,0,608,613,3,46,23,0,609,610,
	5,5,0,0,610,612,3,46,23,0,611,609,1,0,0,0,612,615,1,0,0,0,613,611,1,0,0,
	0,613,614,1,0,0,0,614,617,1,0,0,0,615,613,1,0,0,0,616,618,5,5,0,0,617,616,
	1,0,0,0,617,618,1,0,0,0,618,620,1,0,0,0,619,608,1,0,0,0,619,620,1,0,0,0,
	620,621,1,0,0,0,621,623,5,50,0,0,622,624,5,51,0,0,623,622,1,0,0,0,623,624,
	1,0,0,0,624,625,1,0,0,0,625,626,5,2,0,0,626,45,1,0,0,0,627,630,3,262,131,
	0,628,630,3,82,41,0,629,627,1,0,0,0,629,628,1,0,0,0,630,632,1,0,0,0,631,
	633,5,52,0,0,632,631,1,0,0,0,632,633,1,0,0,0,633,634,1,0,0,0,634,635,5,
	180,0,0,635,47,1,0,0,0,636,637,5,35,0,0,637,638,5,180,0,0,638,650,5,49,
	0,0,639,644,3,50,25,0,640,641,5,5,0,0,641,643,3,50,25,0,642,640,1,0,0,0,
	643,646,1,0,0,0,644,642,1,0,0,0,644,645,1,0,0,0,645,648,1,0,0,0,646,644,
	1,0,0,0,647,649,5,5,0,0,648,647,1,0,0,0,648,649,1,0,0,0,649,651,1,0,0,0,
	650,639,1,0,0,0,650,651,1,0,0,0,651,652,1,0,0,0,652,653,5,50,0,0,653,654,
	5,2,0,0,654,49,1,0,0,0,655,656,3,262,131,0,656,657,5,180,0,0,657,51,1,0,
	0,0,658,659,5,53,0,0,659,660,5,180,0,0,660,662,5,4,0,0,661,663,3,54,27,
	0,662,661,1,0,0,0,663,664,1,0,0,0,664,662,1,0,0,0,664,665,1,0,0,0,665,666,
	1,0,0,0,666,667,5,6,0,0,667,53,1,0,0,0,668,672,3,262,131,0,669,672,3,82,
	41,0,670,672,3,80,40,0,671,668,1,0,0,0,671,669,1,0,0,0,671,670,1,0,0,0,
	672,673,1,0,0,0,673,674,3,14,7,0,674,675,5,2,0,0,675,55,1,0,0,0,676,677,
	5,54,0,0,677,678,5,180,0,0,678,679,5,4,0,0,679,684,3,58,29,0,680,681,5,
	5,0,0,681,683,3,58,29,0,682,680,1,0,0,0,683,686,1,0,0,0,684,682,1,0,0,0,
	684,685,1,0,0,0,685,688,1,0,0,0,686,684,1,0,0,0,687,689,5,5,0,0,688,687,
	1,0,0,0,688,689,1,0,0,0,689,690,1,0,0,0,690,691,5,6,0,0,691,57,1,0,0,0,
	692,695,5,180,0,0,693,694,5,40,0,0,694,696,5,145,0,0,695,693,1,0,0,0,695,
	696,1,0,0,0,696,59,1,0,0,0,697,698,5,55,0,0,698,699,5,180,0,0,699,700,5,
	42,0,0,700,701,3,262,131,0,701,702,5,2,0,0,702,61,1,0,0,0,703,704,3,262,
	131,0,704,705,5,56,0,0,705,706,5,180,0,0,706,707,5,40,0,0,707,708,3,250,
	125,0,708,709,5,2,0,0,709,63,1,0,0,0,710,711,5,57,0,0,711,715,3,104,52,
	0,712,714,7,5,0,0,713,712,1,0,0,0,714,717,1,0,0,0,715,713,1,0,0,0,715,716,
	1,0,0,0,716,721,1,0,0,0,717,715,1,0,0,0,718,720,3,72,36,0,719,718,1,0,0,
	0,720,723,1,0,0,0,721,719,1,0,0,0,721,722,1,0,0,0,722,724,1,0,0,0,723,721,
	1,0,0,0,724,728,5,4,0,0,725,727,3,110,55,0,726,725,1,0,0,0,727,730,1,0,
	0,0,728,726,1,0,0,0,728,729,1,0,0,0,729,731,1,0,0,0,730,728,1,0,0,0,731,
	732,5,6,0,0,732,65,1,0,0,0,733,734,5,60,0,0,734,735,3,104,52,0,735,739,
	5,44,0,0,736,738,3,68,34,0,737,736,1,0,0,0,738,741,1,0,0,0,739,737,1,0,
	0,0,739,740,1,0,0,0,740,745,1,0,0,0,741,739,1,0,0,0,742,744,3,92,46,0,743,
	742,1,0,0,0,744,747,1,0,0,0,745,743,1,0,0,0,745,746,1,0,0,0,746,748,1,0,
	0,0,747,745,1,0,0,0,748,752,5,4,0,0,749,751,3,110,55,0,750,749,1,0,0,0,
	751,754,1,0,0,0,752,750,1,0,0,0,752,753,1,0,0,0,753,755,1,0,0,0,754,752,
	1,0,0,0,755,756,5,6,0,0,756,67,1,0,0,0,757,761,5,59,0,0,758,761,5,61,0,
	0,759,761,3,96,48,0,760,757,1,0,0,0,760,758,1,0,0,0,760,759,1,0,0,0,761,
	69,1,0,0,0,762,763,5,62,0,0,763,764,5,49,0,0,764,765,5,50,0,0,765,766,5,
	44,0,0,766,767,5,59,0,0,767,771,5,4,0,0,768,770,3,110,55,0,769,768,1,0,
	0,0,770,773,1,0,0,0,771,769,1,0,0,0,771,772,1,0,0,0,772,774,1,0,0,0,773,
	771,1,0,0,0,774,775,5,6,0,0,775,71,1,0,0,0,776,777,5,180,0,0,777,778,3,
	242,121,0,778,73,1,0,0,0,779,781,3,78,39,0,780,779,1,0,0,0,780,781,1,0,
	0,0,781,782,1,0,0,0,782,786,3,262,131,0,783,785,3,254,127,0,784,783,1,0,
	0,0,785,788,1,0,0,0,786,784,1,0,0,0,786,787,1,0,0,0,787,789,1,0,0,0,788,
	786,1,0,0,0,789,792,5,180,0,0,790,791,5,40,0,0,791,793,3,250,125,0,792,
	790,1,0,0,0,792,793,1,0,0,0,793,794,1,0,0,0,794,795,5,2,0,0,795,842,1,0,
	0,0,796,797,3,262,131,0,797,801,3,78,39,0,798,800,3,254,127,0,799,798,1,
	0,0,0,800,803,1,0,0,0,801,799,1,0,0,0,801,802,1,0,0,0,802,804,1,0,0,0,803,
	801,1,0,0,0,804,807,5,180,0,0,805,806,5,40,0,0,806,808,3,250,125,0,807,
	805,1,0,0,0,807,808,1,0,0,0,808,809,1,0,0,0,809,810,5,2,0,0,810,842,1,0,
	0,0,811,813,3,78,39,0,812,811,1,0,0,0,812,813,1,0,0,0,813,814,1,0,0,0,814,
	818,3,80,40,0,815,817,3,76,38,0,816,815,1,0,0,0,817,820,1,0,0,0,818,816,
	1,0,0,0,818,819,1,0,0,0,819,821,1,0,0,0,820,818,1,0,0,0,821,822,5,180,0,
	0,822,823,5,2,0,0,823,842,1,0,0,0,824,826,3,78,39,0,825,824,1,0,0,0,825,
	826,1,0,0,0,826,827,1,0,0,0,827,831,3,82,41,0,828,830,3,76,38,0,829,828,
	1,0,0,0,830,833,1,0,0,0,831,829,1,0,0,0,831,832,1,0,0,0,832,834,1,0,0,0,
	833,831,1,0,0,0,834,837,5,180,0,0,835,836,5,40,0,0,836,838,3,250,125,0,
	837,835,1,0,0,0,837,838,1,0,0,0,838,839,1,0,0,0,839,840,5,2,0,0,840,842,
	1,0,0,0,841,780,1,0,0,0,841,796,1,0,0,0,841,812,1,0,0,0,841,825,1,0,0,0,
	842,75,1,0,0,0,843,846,3,254,127,0,844,846,3,78,39,0,845,843,1,0,0,0,845,
	844,1,0,0,0,846,77,1,0,0,0,847,848,7,6,0,0,848,79,1,0,0,0,849,850,5,64,
	0,0,850,851,5,49,0,0,851,853,3,262,131,0,852,854,5,180,0,0,853,852,1,0,
	0,0,853,854,1,0,0,0,854,855,1,0,0,0,855,856,5,65,0,0,856,858,3,262,131,
	0,857,859,5,180,0,0,858,857,1,0,0,0,858,859,1,0,0,0,859,860,1,0,0,0,860,
	861,5,50,0,0,861,886,1,0,0,0,862,863,5,64,0,0,863,864,5,49,0,0,864,866,
	3,262,131,0,865,867,5,180,0,0,866,865,1,0,0,0,866,867,1,0,0,0,867,868,1,
	0,0,0,868,869,5,65,0,0,869,870,3,80,40,0,870,871,5,50,0,0,871,886,1,0,0,
	0,872,873,5,64,0,0,873,874,5,49,0,0,874,876,3,262,131,0,875,877,5,180,0,
	0,876,875,1,0,0,0,876,877,1,0,0,0,877,878,1,0,0,0,878,879,5,65,0,0,879,
	881,3,82,41,0,880,882,5,180,0,0,881,880,1,0,0,0,881,882,1,0,0,0,882,883,
	1,0,0,0,883,884,5,50,0,0,884,886,1,0,0,0,885,849,1,0,0,0,885,862,1,0,0,
	0,885,872,1,0,0,0,886,81,1,0,0,0,887,888,6,41,-1,0,888,889,3,262,131,0,
	889,890,5,66,0,0,890,891,7,7,0,0,891,892,5,67,0,0,892,898,1,0,0,0,893,894,
	3,262,131,0,894,895,5,66,0,0,895,896,5,67,0,0,896,898,1,0,0,0,897,887,1,
	0,0,0,897,893,1,0,0,0,898,908,1,0,0,0,899,900,10,2,0,0,900,901,5,66,0,0,
	901,902,7,7,0,0,902,907,5,67,0,0,903,904,10,1,0,0,904,905,5,66,0,0,905,
	907,5,67,0,0,906,899,1,0,0,0,906,903,1,0,0,0,907,910,1,0,0,0,908,906,1,
	0,0,0,908,909,1,0,0,0,909,83,1,0,0,0,910,908,1,0,0,0,911,912,5,68,0,0,912,
	914,5,180,0,0,913,915,3,104,52,0,914,913,1,0,0,0,914,915,1,0,0,0,915,916,
	1,0,0,0,916,920,5,4,0,0,917,919,3,86,43,0,918,917,1,0,0,0,919,922,1,0,0,
	0,920,918,1,0,0,0,920,921,1,0,0,0,921,923,1,0,0,0,922,920,1,0,0,0,923,924,
	5,6,0,0,924,85,1,0,0,0,925,928,3,88,44,0,926,928,3,110,55,0,927,925,1,0,
	0,0,927,926,1,0,0,0,928,87,1,0,0,0,929,930,5,69,0,0,930,931,5,2,0,0,931,
	89,1,0,0,0,932,933,5,7,0,0,933,934,3,14,7,0,934,938,3,104,52,0,935,937,
	3,94,47,0,936,935,1,0,0,0,937,940,1,0,0,0,938,936,1,0,0,0,938,939,1,0,0,
	0,939,944,1,0,0,0,940,938,1,0,0,0,941,943,3,92,46,0,942,941,1,0,0,0,943,
	946,1,0,0,0,944,942,1,0,0,0,944,945,1,0,0,0,945,948,1,0,0,0,946,944,1,0,
	0,0,947,949,3,100,50,0,948,947,1,0,0,0,948,949,1,0,0,0,949,950,1,0,0,0,
	950,954,5,4,0,0,951,953,3,110,55,0,952,951,1,0,0,0,953,956,1,0,0,0,954,
	952,1,0,0,0,954,955,1,0,0,0,955,957,1,0,0,0,956,954,1,0,0,0,957,958,5,6,
	0,0,958,91,1,0,0,0,959,961,5,180,0,0,960,962,3,242,121,0,961,960,1,0,0,
	0,961,962,1,0,0,0,962,93,1,0,0,0,963,978,5,70,0,0,964,978,5,71,0,0,965,
	978,5,58,0,0,966,978,5,44,0,0,967,978,5,43,0,0,968,978,5,63,0,0,969,978,
	5,59,0,0,970,978,3,96,48,0,971,978,5,61,0,0,972,978,3,98,49,0,973,978,5,
	30,0,0,974,978,5,28,0,0,975,978,5,31,0,0,976,978,5,29,0,0,977,963,1,0,0,
	0,977,964,1,0,0,0,977,965,1,0,0,0,977,966,1,0,0,0,977,967,1,0,0,0,977,968,
	1,0,0,0,977,969,1,0,0,0,977,970,1,0,0,0,977,971,1,0,0,0,977,972,1,0,0,0,
	977,973,1,0,0,0,977,974,1,0,0,0,977,975,1,0,0,0,977,976,1,0,0,0,978,95,
	1,0,0,0,979,990,5,72,0,0,980,981,5,49,0,0,981,986,5,180,0,0,982,983,5,5,
	0,0,983,985,5,180,0,0,984,982,1,0,0,0,985,988,1,0,0,0,986,984,1,0,0,0,986,
	987,1,0,0,0,987,989,1,0,0,0,988,986,1,0,0,0,989,991,5,50,0,0,990,980,1,
	0,0,0,990,991,1,0,0,0,991,97,1,0,0,0,992,996,5,32,0,0,993,994,5,49,0,0,
	994,995,5,145,0,0,995,997,5,50,0,0,996,993,1,0,0,0,996,997,1,0,0,0,997,
	99,1,0,0,0,998,999,5,73,0,0,999,1000,5,49,0,0,1000,1005,3,102,51,0,1001,
	1002,5,5,0,0,1002,1004,3,102,51,0,1003,1001,1,0,0,0,1004,1007,1,0,0,0,1005,
	1003,1,0,0,0,1005,1006,1,0,0,0,1006,1009,1,0,0,0,1007,1005,1,0,0,0,1008,
	1010,5,5,0,0,1009,1008,1,0,0,0,1009,1010,1,0,0,0,1010,1011,1,0,0,0,1011,
	1012,5,50,0,0,1012,101,1,0,0,0,1013,1017,3,262,131,0,1014,1016,3,254,127,
	0,1015,1014,1,0,0,0,1016,1019,1,0,0,0,1017,1015,1,0,0,0,1017,1018,1,0,0,
	0,1018,1021,1,0,0,0,1019,1017,1,0,0,0,1020,1022,3,14,7,0,1021,1020,1,0,
	0,0,1021,1022,1,0,0,0,1022,1034,1,0,0,0,1023,1027,3,82,41,0,1024,1026,3,
	254,127,0,1025,1024,1,0,0,0,1026,1029,1,0,0,0,1027,1025,1,0,0,0,1027,1028,
	1,0,0,0,1028,1031,1,0,0,0,1029,1027,1,0,0,0,1030,1032,3,14,7,0,1031,1030,
	1,0,0,0,1031,1032,1,0,0,0,1032,1034,1,0,0,0,1033,1013,1,0,0,0,1033,1023,
	1,0,0,0,1034,103,1,0,0,0,1035,1047,5,49,0,0,1036,1041,3,106,53,0,1037,1038,
	5,5,0,0,1038,1040,3,106,53,0,1039,1037,1,0,0,0,1040,1043,1,0,0,0,1041,1039,
	1,0,0,0,1041,1042,1,0,0,0,1042,1045,1,0,0,0,1043,1041,1,0,0,0,1044,1046,
	5,5,0,0,1045,1044,1,0,0,0,1045,1046,1,0,0,0,1046,1048,1,0,0,0,1047,1036,
	1,0,0,0,1047,1048,1,0,0,0,1048,1049,1,0,0,0,1049,1050,5,50,0,0,1050,105,
	1,0,0,0,1051,1055,3,262,131,0,1052,1054,3,254,127,0,1053,1052,1,0,0,0,1054,
	1057,1,0,0,0,1055,1053,1,0,0,0,1055,1056,1,0,0,0,1056,1059,1,0,0,0,1057,
	1055,1,0,0,0,1058,1060,3,14,7,0,1059,1058,1,0,0,0,1059,1060,1,0,0,0,1060,
	1082,1,0,0,0,1061,1065,3,82,41,0,1062,1064,3,254,127,0,1063,1062,1,0,0,
	0,1064,1067,1,0,0,0,1065,1063,1,0,0,0,1065,1066,1,0,0,0,1066,1069,1,0,0,
	0,1067,1065,1,0,0,0,1068,1070,3,14,7,0,1069,1068,1,0,0,0,1069,1070,1,0,
	0,0,1070,1082,1,0,0,0,1071,1075,3,80,40,0,1072,1074,3,254,127,0,1073,1072,
	1,0,0,0,1074,1077,1,0,0,0,1075,1073,1,0,0,0,1075,1076,1,0,0,0,1076,1079,
	1,0,0,0,1077,1075,1,0,0,0,1078,1080,3,14,7,0,1079,1078,1,0,0,0,1079,1080,
	1,0,0,0,1080,1082,1,0,0,0,1081,1051,1,0,0,0,1081,1061,1,0,0,0,1081,1071,
	1,0,0,0,1082,107,1,0,0,0,1083,1087,5,4,0,0,1084,1086,3,110,55,0,1085,1084,
	1,0,0,0,1086,1089,1,0,0,0,1087,1085,1,0,0,0,1087,1088,1,0,0,0,1088,1090,
	1,0,0,0,1089,1087,1,0,0,0,1090,1093,5,6,0,0,1091,1093,3,110,55,0,1092,1083,
	1,0,0,0,1092,1091,1,0,0,0,1093,109,1,0,0,0,1094,1126,3,130,65,0,1095,1126,
	3,132,66,0,1096,1126,3,138,69,0,1097,1126,3,140,70,0,1098,1126,3,142,71,
	0,1099,1126,3,144,72,0,1100,1126,3,146,73,0,1101,1126,3,136,68,0,1102,1126,
	3,126,63,0,1103,1126,3,128,64,0,1104,1126,3,150,75,0,1105,1126,3,152,76,
	0,1106,1126,3,154,77,0,1107,1126,3,156,78,0,1108,1126,3,176,88,0,1109,1126,
	3,124,62,0,1110,1126,3,112,56,0,1111,1126,3,114,57,0,1112,1126,3,116,58,
	0,1113,1126,3,118,59,0,1114,1126,3,120,60,0,1115,1126,3,122,61,0,1116,1126,
	3,178,89,0,1117,1126,3,218,109,0,1118,1126,3,230,115,0,1119,1126,3,232,
	116,0,1120,1126,3,148,74,0,1121,1126,3,210,105,0,1122,1126,3,212,106,0,
	1123,1126,3,224,112,0,1124,1126,3,226,113,0,1125,1094,1,0,0,0,1125,1095,
	1,0,0,0,1125,1096,1,0,0,0,1125,1097,1,0,0,0,1125,1098,1,0,0,0,1125,1099,
	1,0,0,0,1125,1100,1,0,0,0,1125,1101,1,0,0,0,1125,1102,1,0,0,0,1125,1103,
	1,0,0,0,1125,1104,1,0,0,0,1125,1105,1,0,0,0,1125,1106,1,0,0,0,1125,1107,
	1,0,0,0,1125,1108,1,0,0,0,1125,1109,1,0,0,0,1125,1110,1,0,0,0,1125,1111,
	1,0,0,0,1125,1112,1,0,0,0,1125,1113,1,0,0,0,1125,1114,1,0,0,0,1125,1115,
	1,0,0,0,1125,1116,1,0,0,0,1125,1117,1,0,0,0,1125,1118,1,0,0,0,1125,1119,
	1,0,0,0,1125,1120,1,0,0,0,1125,1121,1,0,0,0,1125,1122,1,0,0,0,1125,1123,
	1,0,0,0,1125,1124,1,0,0,0,1126,111,1,0,0,0,1127,1128,5,74,0,0,1128,1129,
	5,12,0,0,1129,1130,5,180,0,0,1130,1131,5,49,0,0,1131,1132,3,250,125,0,1132,
	1133,5,5,0,0,1133,1134,3,250,125,0,1134,1135,5,50,0,0,1135,1136,5,2,0,0,
	1136,113,1,0,0,0,1137,1138,5,74,0,0,1138,1139,5,12,0,0,1139,1140,5,180,
	0,0,1140,1141,5,66,0,0,1141,1142,3,250,125,0,1142,1143,5,67,0,0,1143,1144,
	5,12,0,0,1144,1145,5,180,0,0,1145,1146,5,49,0,0,1146,1151,3,250,125,0,1147,
	1148,5,5,0,0,1148,1150,3,250,125,0,1149,1147,1,0,0,0,1150,1153,1,0,0,0,
	1151,1149,1,0,0,0,1151,1152,1,0,0,0,1152,1154,1,0,0,0,1153,1151,1,0,0,0,
	1154,1155,5,50,0,0,1155,1156,5,2,0,0,1156,115,1,0,0,0,1157,1158,5,75,0,
	0,1158,1187,5,2,0,0,1159,1160,5,75,0,0,1160,1165,3,250,125,0,1161,1162,
	5,5,0,0,1162,1164,3,250,125,0,1163,1161,1,0,0,0,1164,1167,1,0,0,0,1165,
	1163,1,0,0,0,1165,1166,1,0,0,0,1166,1168,1,0,0,0,1167,1165,1,0,0,0,1168,
	1169,5,2,0,0,1169,1187,1,0,0,0,1170,1171,5,75,0,0,1171,1172,5,49,0,0,1172,
	1177,3,250,125,0,1173,1174,5,5,0,0,1174,1176,3,250,125,0,1175,1173,1,0,
	0,0,1176,1179,1,0,0,0,1177,1175,1,0,0,0,1177,1178,1,0,0,0,1178,1181,1,0,
	0,0,1179,1177,1,0,0,0,1180,1182,5,5,0,0,1181,1180,1,0,0,0,1181,1182,1,0,
	0,0,1182,1183,1,0,0,0,1183,1184,5,50,0,0,1184,1185,5,2,0,0,1185,1187,1,
	0,0,0,1186,1157,1,0,0,0,1186,1159,1,0,0,0,1186,1170,1,0,0,0,1187,117,1,
	0,0,0,1188,1191,5,180,0,0,1189,1190,5,12,0,0,1190,1192,5,180,0,0,1191,1189,
	1,0,0,0,1191,1192,1,0,0,0,1192,1193,1,0,0,0,1193,1194,5,49,0,0,1194,1206,
	5,4,0,0,1195,1200,3,240,120,0,1196,1197,5,5,0,0,1197,1199,3,240,120,0,1198,
	1196,1,0,0,0,1199,1202,1,0,0,0,1200,1198,1,0,0,0,1200,1201,1,0,0,0,1201,
	1204,1,0,0,0,1202,1200,1,0,0,0,1203,1205,5,5,0,0,1204,1203,1,0,0,0,1204,
	1205,1,0,0,0,1205,1207,1,0,0,0,1206,1195,1,0,0,0,1206,1207,1,0,0,0,1207,
	1208,1,0,0,0,1208,1209,5,6,0,0,1209,1210,5,50,0,0,1210,1234,5,2,0,0,1211,
	1212,5,180,0,0,1212,1213,3,242,121,0,1213,1214,5,2,0,0,1214,1234,1,0,0,
	0,1215,1216,5,180,0,0,1216,1217,5,12,0,0,1217,1218,5,180,0,0,1218,1219,
	3,242,121,0,1219,1220,5,2,0,0,1220,1234,1,0,0,0,1221,1222,5,180,0,0,1222,
	1223,3,242,121,0,1223,1224,5,12,0,0,1224,1225,5,180,0,0,1225,1226,5,12,
	0,0,1226,1228,5,180,0,0,1227,1229,3,244,122,0,1228,1227,1,0,0,0,1228,1229,
	1,0,0,0,1229,1230,1,0,0,0,1230,1231,3,242,121,0,1231,1232,5,2,0,0,1232,
	1234,1,0,0,0,1233,1188,1,0,0,0,1233,1211,1,0,0,0,1233,1215,1,0,0,0,1233,
	1221,1,0,0,0,1234,119,1,0,0,0,1235,1236,3,250,125,0,1236,1237,5,12,0,0,
	1237,1239,5,180,0,0,1238,1240,3,244,122,0,1239,1238,1,0,0,0,1239,1240,1,
	0,0,0,1240,1241,1,0,0,0,1241,1242,3,242,121,0,1242,1243,5,2,0,0,1243,121,
	1,0,0,0,1244,1245,5,31,0,0,1245,1246,5,49,0,0,1246,1247,3,250,125,0,1247,
	1248,5,50,0,0,1248,1249,5,2,0,0,1249,123,1,0,0,0,1250,1251,5,76,0,0,1251,
	1254,5,180,0,0,1252,1253,5,12,0,0,1253,1255,5,180,0,0,1254,1252,1,0,0,0,
	1254,1255,1,0,0,0,1255,1256,1,0,0,0,1256,1257,5,49,0,0,1257,1269,5,4,0,
	0,1258,1263,3,240,120,0,1259,1260,5,5,0,0,1260,1262,3,240,120,0,1261,1259,
	1,0,0,0,1262,1265,1,0,0,0,1263,1261,1,0,0,0,1263,1264,1,0,0,0,1264,1267,
	1,0,0,0,1265,1263,1,0,0,0,1266,1268,5,5,0,0,1267,1266,1,0,0,0,1267,1268,
	1,0,0,0,1268,1270,1,0,0,0,1269,1258,1,0,0,0,1269,1270,1,0,0,0,1270,1271,
	1,0,0,0,1271,1272,5,6,0,0,1272,1273,5,50,0,0,1273,1284,5,2,0,0,1274,1275,
	5,76,0,0,1275,1278,5,180,0,0,1276,1277,5,12,0,0,1277,1279,5,180,0,0,1278,
	1276,1,0,0,0,1278,1279,1,0,0,0,1279,1280,1,0,0,0,1280,1281,3,242,121,0,
	1281,1282,5,2,0,0,1282,1284,1,0,0,0,1283,1250,1,0,0,0,1283,1274,1,0,0,0,
	1284,125,1,0,0,0,1285,1286,5,74,0,0,1286,1287,5,12,0,0,1287,1296,5,180,
	0,0,1288,1289,5,66,0,0,1289,1290,3,250,125,0,1290,1291,5,67,0,0,1291,1293,
	1,0,0,0,1292,1288,1,0,0,0,1293,1294,1,0,0,0,1294,1292,1,0,0,0,1294,1295,
	1,0,0,0,1295,1297,1,0,0,0,1296,1292,1,0,0,0,1296,1297,1,0,0,0,1297,1302,
	1,0,0,0,1298,1299,5,12,0,0,1299,1301,5,180,0,0,1300,1298,1,0,0,0,1301,1304,
	1,0,0,0,1302,1300,1,0,0,0,1302,1303,1,0,0,0,1303,1305,1,0,0,0,1304,1302,
	1,0,0,0,1305,1306,7,8,0,0,1306,1307,3,250,125,0,1307,1308,5,2,0,0,1308,
	1410,1,0,0,0,1309,1314,5,180,0,0,1310,1311,5,66,0,0,1311,1312,3,250,125,
	0,1312,1313,5,67,0,0,1313,1315,1,0,0,0,1314,1310,1,0,0,0,1315,1316,1,0,
	0,0,1316,1314,1,0,0,0,1316,1317,1,0,0,0,1317,1322,1,0,0,0,1318,1319,5,12,
	0,0,1319,1321,5,180,0,0,1320,1318,1,0,0,0,1321,1324,1,0,0,0,1322,1320,1,
	0,0,0,1322,1323,1,0,0,0,1323,1325,1,0,0,0,1324,1322,1,0,0,0,1325,1326,7,
	8,0,0,1326,1327,3,250,125,0,1327,1328,5,2,0,0,1328,1410,1,0,0,0,1329,1332,
	5,180,0,0,1330,1331,5,12,0,0,1331,1333,5,180,0,0,1332,1330,1,0,0,0,1333,
	1334,1,0,0,0,1334,1332,1,0,0,0,1334,1335,1,0,0,0,1335,1336,1,0,0,0,1336,
	1337,7,8,0,0,1337,1338,3,250,125,0,1338,1339,5,2,0,0,1339,1410,1,0,0,0,
	1340,1343,5,180,0,0,1341,1342,5,12,0,0,1342,1344,5,180,0,0,1343,1341,1,
	0,0,0,1344,1345,1,0,0,0,1345,1343,1,0,0,0,1345,1346,1,0,0,0,1346,1351,1,
	0,0,0,1347,1348,5,66,0,0,1348,1349,3,250,125,0,1349,1350,5,67,0,0,1350,
	1352,1,0,0,0,1351,1347,1,0,0,0,1352,1353,1,0,0,0,1353,1351,1,0,0,0,1353,
	1354,1,0,0,0,1354,1355,1,0,0,0,1355,1356,7,8,0,0,1356,1357,3,250,125,0,
	1357,1358,5,2,0,0,1358,1410,1,0,0,0,1359,1360,5,74,0,0,1360,1361,5,12,0,
	0,1361,1370,5,180,0,0,1362,1363,5,66,0,0,1363,1364,3,250,125,0,1364,1365,
	5,67,0,0,1365,1367,1,0,0,0,1366,1362,1,0,0,0,1367,1368,1,0,0,0,1368,1366,
	1,0,0,0,1368,1369,1,0,0,0,1369,1371,1,0,0,0,1370,1366,1,0,0,0,1370,1371,
	1,0,0,0,1371,1376,1,0,0,0,1372,1373,5,12,0,0,1373,1375,5,180,0,0,1374,1372,
	1,0,0,0,1375,1378,1,0,0,0,1376,1374,1,0,0,0,1376,1377,1,0,0,0,1377,1379,
	1,0,0,0,1378,1376,1,0,0,0,1379,1380,7,9,0,0,1380,1410,5,2,0,0,1381,1386,
	5,180,0,0,1382,1383,5,66,0,0,1383,1384,3,250,125,0,1384,1385,5,67,0,0,1385,
	1387,1,0,0,0,1386,1382,1,0,0,0,1387,1388,1,0,0,0,1388,1386,1,0,0,0,1388,
	1389,1,0,0,0,1389,1394,1,0,0,0,1390,1391,5,12,0,0,1391,1393,5,180,0,0,1392,
	1390,1,0,0,0,1393,1396,1,0,0,0,1394,1392,1,0,0,0,1394,1395,1,0,0,0,1395,
	1397,1,0,0,0,1396,1394,1,0,0,0,1397,1398,7,9,0,0,1398,1399,5,2,0,0,1399,
	1410,1,0,0,0,1400,1403,5,180,0,0,1401,1402,5,12,0,0,1402,1404,5,180,0,0,
	1403,1401,1,0,0,0,1404,1405,1,0,0,0,1405,1403,1,0,0,0,1405,1406,1,0,0,0,
	1406,1407,1,0,0,0,1407,1408,7,9,0,0,1408,1410,5,2,0,0,1409,1285,1,0,0,0,
	1409,1309,1,0,0,0,1409,1329,1,0,0,0,1409,1340,1,0,0,0,1409,1359,1,0,0,0,
	1409,1381,1,0,0,0,1409,1400,1,0,0,0,1410,127,1,0,0,0,1411,1412,5,74,0,0,
	1412,1413,5,12,0,0,1413,1420,5,180,0,0,1414,1415,5,66,0,0,1415,1416,3,250,
	125,0,1416,1417,5,67,0,0,1417,1419,1,0,0,0,1418,1414,1,0,0,0,1419,1422,
	1,0,0,0,1420,1418,1,0,0,0,1420,1421,1,0,0,0,1421,1423,1,0,0,0,1422,1420,
	1,0,0,0,1423,1424,5,169,0,0,1424,1425,5,49,0,0,1425,1426,3,250,125,0,1426,
	1427,5,50,0,0,1427,1428,5,2,0,0,1428,129,1,0,0,0,1429,1433,3,262,131,0,
	1430,1432,3,254,127,0,1431,1430,1,0,0,0,1432,1435,1,0,0,0,1433,1431,1,0,
	0,0,1433,1434,1,0,0,0,1434,1436,1,0,0,0,1435,1433,1,0,0,0,1436,1439,3,14,
	7,0,1437,1438,5,40,0,0,1438,1440,3,250,125,0,1439,1437,1,0,0,0,1439,1440,
	1,0,0,0,1440,1441,1,0,0,0,1441,1442,5,2,0,0,1442,1458,1,0,0,0,1443,1447,
	3,82,41,0,1444,1446,3,254,127,0,1445,1444,1,0,0,0,1446,1449,1,0,0,0,1447,
	1445,1,0,0,0,1447,1448,1,0,0,0,1448,1450,1,0,0,0,1449,1447,1,0,0,0,1450,
	1453,3,14,7,0,1451,1452,5,40,0,0,1452,1454,3,250,125,0,1453,1451,1,0,0,
	0,1453,1454,1,0,0,0,1454,1455,1,0,0,0,1455,1456,5,2,0,0,1456,1458,1,0,0,
	0,1457,1429,1,0,0,0,1457,1443,1,0,0,0,1458,131,1,0,0,0,1459,1460,3,262,
	131,0,1460,1465,5,180,0,0,1461,1462,5,5,0,0,1462,1463,3,262,131,0,1463,
	1464,5,180,0,0,1464,1466,1,0,0,0,1465,1461,1,0,0,0,1466,1467,1,0,0,0,1467,
	1465,1,0,0,0,1467,1468,1,0,0,0,1468,1469,1,0,0,0,1469,1470,5,40,0,0,1470,
	1471,3,250,125,0,1471,1472,5,2,0,0,1472,1508,1,0,0,0,1473,1474,5,49,0,0,
	1474,1477,3,134,67,0,1475,1476,5,5,0,0,1476,1478,3,134,67,0,1477,1475,1,
	0,0,0,1478,1479,1,0,0,0,1479,1477,1,0,0,0,1479,1480,1,0,0,0,1480,1481,1,
	0,0,0,1481,1482,5,50,0,0,1482,1483,5,40,0,0,1483,1484,5,49,0,0,1484,1487,
	3,250,125,0,1485,1486,5,5,0,0,1486,1488,3,250,125,0,1487,1485,1,0,0,0,1488,
	1489,1,0,0,0,1489,1487,1,0,0,0,1489,1490,1,0,0,0,1490,1491,1,0,0,0,1491,
	1492,5,50,0,0,1492,1493,5,2,0,0,1493,1508,1,0,0,0,1494,1495,5,49,0,0,1495,
	1498,3,134,67,0,1496,1497,5,5,0,0,1497,1499,3,134,67,0,1498,1496,1,0,0,
	0,1499,1500,1,0,0,0,1500,1498,1,0,0,0,1500,1501,1,0,0,0,1501,1502,1,0,0,
	0,1502,1503,5,50,0,0,1503,1504,5,40,0,0,1504,1505,3,250,125,0,1505,1506,
	5,2,0,0,1506,1508,1,0,0,0,1507,1459,1,0,0,0,1507,1473,1,0,0,0,1507,1494,
	1,0,0,0,1508,133,1,0,0,0,1509,1513,3,262,131,0,1510,1512,3,254,127,0,1511,
	1510,1,0,0,0,1512,1515,1,0,0,0,1513,1511,1,0,0,0,1513,1514,1,0,0,0,1514,
	1516,1,0,0,0,1515,1513,1,0,0,0,1516,1517,5,180,0,0,1517,1521,1,0,0,0,1518,
	1521,5,180,0,0,1519,1521,1,0,0,0,1520,1509,1,0,0,0,1520,1518,1,0,0,0,1520,
	1519,1,0,0,0,1521,135,1,0,0,0,1522,1523,5,180,0,0,1523,1524,7,8,0,0,1524,
	1525,3,250,125,0,1525,1526,5,2,0,0,1526,1534,1,0,0,0,1527,1528,5,180,0,
	0,1528,1529,7,9,0,0,1529,1534,5,2,0,0,1530,1531,7,9,0,0,1531,1532,5,180,
	0,0,1532,1534,5,2,0,0,1533,1522,1,0,0,0,1533,1527,1,0,0,0,1533,1530,1,0,
	0,0,1534,137,1,0,0,0,1535,1536,5,180,0,0,1536,1537,5,165,0,0,1537,1538,
	5,49,0,0,1538,1539,3,250,125,0,1539,1540,5,50,0,0,1540,1541,5,2,0,0,1541,
	1552,1,0,0,0,1542,1543,5,180,0,0,1543,1544,5,12,0,0,1544,1545,5,180,0,0,
	1545,1546,5,165,0,0,1546,1547,5,49,0,0,1547,1548,3,250,125,0,1548,1549,
	5,50,0,0,1549,1550,5,2,0,0,1550,1552,1,0,0,0,1551,1535,1,0,0,0,1551,1542,
	1,0,0,0,1552,139,1,0,0,0,1553,1554,5,180,0,0,1554,1555,5,166,0,0,1555,1556,
	5,49,0,0,1556,1557,5,50,0,0,1557,1566,5,2,0,0,1558,1559,5,180,0,0,1559,
	1560,5,12,0,0,1560,1561,5,180,0,0,1561,1562,5,166,0,0,1562,1563,5,49,0,
	0,1563,1564,5,50,0,0,1564,1566,5,2,0,0,1565,1553,1,0,0,0,1565,1558,1,0,
	0,0,1566,141,1,0,0,0,1567,1568,5,180,0,0,1568,1569,5,169,0,0,1569,1570,
	5,49,0,0,1570,1571,3,250,125,0,1571,1572,5,50,0,0,1572,1573,5,2,0,0,1573,
	143,1,0,0,0,1574,1575,5,74,0,0,1575,1576,5,12,0,0,1576,1577,5,180,0,0,1577,
	1578,5,165,0,0,1578,1579,5,49,0,0,1579,1580,3,250,125,0,1580,1581,5,50,
	0,0,1581,1582,5,2,0,0,1582,145,1,0,0,0,1583,1584,5,74,0,0,1584,1585,5,12,
	0,0,1585,1586,5,180,0,0,1586,1587,5,166,0,0,1587,1588,5,49,0,0,1588,1589,
	5,50,0,0,1589,1590,5,2,0,0,1590,147,1,0,0,0,1591,1592,5,89,0,0,1592,1593,
	5,180,0,0,1593,1626,5,2,0,0,1594,1595,5,89,0,0,1595,1596,5,74,0,0,1596,
	1597,5,12,0,0,1597,1598,5,180,0,0,1598,1626,5,2,0,0,1599,1600,5,89,0,0,
	1600,1601,5,74,0,0,1601,1602,5,12,0,0,1602,1607,5,180,0,0,1603,1604,5,66,
	0,0,1604,1605,3,250,125,0,1605,1606,5,67,0,0,1606,1608,1,0,0,0,1607,1603,
	1,0,0,0,1608,1609,1,0,0,0,1609,1607,1,0,0,0,1609,1610,1,0,0,0,1610,1611,
	1,0,0,0,1611,1612,5,2,0,0,1612,1626,1,0,0,0,1613,1614,5,89,0,0,1614,1619,
	5,180,0,0,1615,1616,5,66,0,0,1616,1617,3,250,125,0,1617,1618,5,67,0,0,1618,
	1620,1,0,0,0,1619,1615,1,0,0,0,1620,1621,1,0,0,0,1621,1619,1,0,0,0,1621,
	1622,1,0,0,0,1622,1623,1,0,0,0,1623,1624,5,2,0,0,1624,1626,1,0,0,0,1625,
	1591,1,0,0,0,1625,1594,1,0,0,0,1625,1599,1,0,0,0,1625,1613,1,0,0,0,1626,
	149,1,0,0,0,1627,1628,5,90,0,0,1628,1629,5,49,0,0,1629,1630,5,154,0,0,1630,
	1631,5,23,0,0,1631,1634,3,250,125,0,1632,1633,5,5,0,0,1633,1635,3,228,114,
	0,1634,1632,1,0,0,0,1634,1635,1,0,0,0,1635,1636,1,0,0,0,1636,1637,5,50,
	0,0,1637,1638,5,2,0,0,1638,151,1,0,0,0,1639,1640,5,90,0,0,1640,1641,5,49,
	0,0,1641,1644,3,250,125,0,1642,1643,5,5,0,0,1643,1645,3,228,114,0,1644,
	1642,1,0,0,0,1644,1645,1,0,0,0,1645,1646,1,0,0,0,1646,1647,5,50,0,0,1647,
	1648,5,2,0,0,1648,153,1,0,0,0,1649,1650,5,91,0,0,1650,1651,5,49,0,0,1651,
	1652,3,250,125,0,1652,1653,5,50,0,0,1653,1656,3,108,54,0,1654,1655,5,92,
	0,0,1655,1657,3,108,54,0,1656,1654,1,0,0,0,1656,1657,1,0,0,0,1657,155,1,
	0,0,0,1658,1665,3,172,86,0,1659,1665,3,174,87,0,1660,1665,3,164,82,0,1661,
	1665,3,158,79,0,1662,1665,3,160,80,0,1663,1665,3,162,81,0,1664,1658,1,0,
	0,0,1664,1659,1,0,0,0,1664,1660,1,0,0,0,1664,1661,1,0,0,0,1664,1662,1,0,
	0,0,1664,1663,1,0,0,0,1665,157,1,0,0,0,1666,1667,5,9,0,0,1667,1668,5,49,
	0,0,1668,1669,3,262,131,0,1669,1670,5,180,0,0,1670,1671,5,5,0,0,1671,1672,
	3,262,131,0,1672,1673,5,180,0,0,1673,1674,5,93,0,0,1674,1675,5,74,0,0,1675,
	1676,5,12,0,0,1676,1677,5,180,0,0,1677,1678,5,12,0,0,1678,1679,5,34,0,0,
	1679,1680,5,50,0,0,1680,1681,3,108,54,0,1681,159,1,0,0,0,1682,1683,5,9,
	0,0,1683,1684,5,49,0,0,1684,1685,3,262,131,0,1685,1686,5,180,0,0,1686,1687,
	5,94,0,0,1687,1688,5,74,0,0,1688,1689,5,12,0,0,1689,1690,5,180,0,0,1690,
	1691,5,50,0,0,1691,1692,3,108,54,0,1692,161,1,0,0,0,1693,1694,5,9,0,0,1694,
	1695,5,49,0,0,1695,1696,3,262,131,0,1696,1697,5,180,0,0,1697,1698,5,93,
	0,0,1698,1699,5,74,0,0,1699,1700,5,12,0,0,1700,1701,5,180,0,0,1701,1702,
	5,50,0,0,1702,1703,3,108,54,0,1703,163,1,0,0,0,1704,1705,5,9,0,0,1705,1706,
	5,49,0,0,1706,1707,3,166,83,0,1707,1709,3,168,84,0,1708,1710,3,170,85,0,
	1709,1708,1,0,0,0,1709,1710,1,0,0,0,1710,1711,1,0,0,0,1711,1712,5,50,0,
	0,1712,1713,3,108,54,0,1713,165,1,0,0,0,1714,1718,3,262,131,0,1715,1717,
	3,254,127,0,1716,1715,1,0,0,0,1717,1720,1,0,0,0,1718,1716,1,0,0,0,1718,
	1719,1,0,0,0,1719,1721,1,0,0,0,1720,1718,1,0,0,0,1721,1724,5,180,0,0,1722,
	1723,5,40,0,0,1723,1725,3,250,125,0,1724,1722,1,0,0,0,1724,1725,1,0,0,0,
	1725,1726,1,0,0,0,1726,1727,5,2,0,0,1727,167,1,0,0,0,1728,1729,3,250,125,
	0,1729,1730,5,2,0,0,1730,169,1,0,0,0,1731,1732,5,180,0,0,1732,1733,7,8,
	0,0,1733,1739,3,250,125,0,1734,1735,5,180,0,0,1735,1739,7,9,0,0,1736,1737,
	7,9,0,0,1737,1739,5,180,0,0,1738,1731,1,0,0,0,1738,1734,1,0,0,0,1738,1736,
	1,0,0,0,1739,171,1,0,0,0,1740,1741,5,95,0,0,1741,1742,3,108,54,0,1742,1743,
	5,96,0,0,1743,1744,5,49,0,0,1744,1745,3,250,125,0,1745,1746,5,50,0,0,1746,
	1747,5,2,0,0,1747,173,1,0,0,0,1748,1749,5,96,0,0,1749,1750,5,49,0,0,1750,
	1751,3,250,125,0,1751,1752,5,50,0,0,1752,1753,3,108,54,0,1753,175,1,0,0,
	0,1754,1755,5,97,0,0,1755,1756,3,236,118,0,1756,1757,5,2,0,0,1757,177,1,
	0,0,0,1758,1759,5,98,0,0,1759,1760,3,180,90,0,1760,179,1,0,0,0,1761,1765,
	5,4,0,0,1762,1764,3,182,91,0,1763,1762,1,0,0,0,1764,1767,1,0,0,0,1765,1763,
	1,0,0,0,1765,1766,1,0,0,0,1766,1768,1,0,0,0,1767,1765,1,0,0,0,1768,1769,
	5,6,0,0,1769,181,1,0,0,0,1770,1784,3,180,90,0,1771,1784,3,184,92,0,1772,
	1784,3,186,93,0,1773,1784,3,188,94,0,1774,1784,3,190,95,0,1775,1784,3,196,
	98,0,1776,1784,3,198,99,0,1777,1784,5,99,0,0,1778,1784,5,100,0,0,1779,1784,
	5,101,0,0,1780,1784,3,202,101,0,1781,1784,3,206,103,0,1782,1784,3,208,104,
	0,1783,1770,1,0,0,0,1783,1771,1,0,0,0,1783,1772,1,0,0,0,1783,1773,1,0,0,
	0,1783,1774,1,0,0,0,1783,1775,1,0,0,0,1783,1776,1,0,0,0,1783,1777,1,0,0,
	0,1783,1778,1,0,0,0,1783,1779,1,0,0,0,1783,1780,1,0,0,0,1783,1781,1,0,0,
	0,1783,1782,1,0,0,0,1784,183,1,0,0,0,1785,1786,5,102,0,0,1786,1791,3,14,
	7,0,1787,1788,5,5,0,0,1788,1790,3,14,7,0,1789,1787,1,0,0,0,1790,1793,1,
	0,0,0,1791,1789,1,0,0,0,1791,1792,1,0,0,0,1792,1796,1,0,0,0,1793,1791,1,
	0,0,0,1794,1795,5,103,0,0,1795,1797,3,200,100,0,1796,1794,1,0,0,0,1796,
	1797,1,0,0,0,1797,185,1,0,0,0,1798,1803,3,206,103,0,1799,1800,5,5,0,0,1800,
	1802,3,206,103,0,1801,1799,1,0,0,0,1802,1805,1,0,0,0,1803,1801,1,0,0,0,
	1803,1804,1,0,0,0,1804,1806,1,0,0,0,1805,1803,1,0,0,0,1806,1807,5,103,0,
	0,1807,1808,3,200,100,0,1808,187,1,0,0,0,1809,1810,5,91,0,0,1810,1811,3,
	200,100,0,1811,1812,3,180,90,0,1812,189,1,0,0,0,1813,1814,5,104,0,0,1814,
	1824,3,200,100,0,1815,1817,3,192,96,0,1816,1815,1,0,0,0,1817,1818,1,0,0,
	0,1818,1816,1,0,0,0,1818,1819,1,0,0,0,1819,1821,1,0,0,0,1820,1822,3,194,
	97,0,1821,1820,1,0,0,0,1821,1822,1,0,0,0,1822,1825,1,0,0,0,1823,1825,3,
	194,97,0,1824,1816,1,0,0,0,1824,1823,1,0,0,0,1825,191,1,0,0,0,1826,1827,
	5,105,0,0,1827,1828,3,208,104,0,1828,1829,3,180,90,0,1829,193,1,0,0,0,1830,
	1831,5,106,0,0,1831,1832,3,180,90,0,1832,195,1,0,0,0,1833,1834,5,9,0,0,
	1834,1835,3,180,90,0,1835,1836,3,200,100,0,1836,1837,3,180,90,0,1837,1838,
	3,180,90,0,1838,197,1,0,0,0,1839,1840,5,7,0,0,1840,1841,5,180,0,0,1841,
	1850,5,49,0,0,1842,1847,5,180,0,0,1843,1844,5,5,0,0,1844,1846,5,180,0,0,
	1845,1843,1,0,0,0,1846,1849,1,0,0,0,1847,1845,1,0,0,0,1847,1848,1,0,0,0,
	1848,1851,1,0,0,0,1849,1847,1,0,0,0,1850,1842,1,0,0,0,1850,1851,1,0,0,0,
	1851,1852,1,0,0,0,1852,1862,5,50,0,0,1853,1854,5,107,0,0,1854,1859,5,180,
	0,0,1855,1856,5,5,0,0,1856,1858,5,180,0,0,1857,1855,1,0,0,0,1858,1861,1,
	0,0,0,1859,1857,1,0,0,0,1859,1860,1,0,0,0,1860,1863,1,0,0,0,1861,1859,1,
	0,0,0,1862,1853,1,0,0,0,1862,1863,1,0,0,0,1863,1864,1,0,0,0,1864,1865,3,
	180,90,0,1865,199,1,0,0,0,1866,1870,3,202,101,0,1867,1870,3,206,103,0,1868,
	1870,3,208,104,0,1869,1866,1,0,0,0,1869,1867,1,0,0,0,1869,1868,1,0,0,0,
	1870,201,1,0,0,0,1871,1872,3,204,102,0,1872,1881,5,49,0,0,1873,1878,3,200,
	100,0,1874,1875,5,5,0,0,1875,1877,3,200,100,0,1876,1874,1,0,0,0,1877,1880,
	1,0,0,0,1878,1876,1,0,0,0,1878,1879,1,0,0,0,1879,1882,1,0,0,0,1880,1878,
	1,0,0,0,1881,1873,1,0,0,0,1881,1882,1,0,0,0,1882,1883,1,0,0,0,1883,1884,
	5,50,0,0,1884,203,1,0,0,0,1885,1886,7,10,0,0,1886,205,1,0,0,0,1887,1892,
	3,14,7,0,1888,1889,5,12,0,0,1889,1891,3,14,7,0,1890,1888,1,0,0,0,1891,1894,
	1,0,0,0,1892,1890,1,0,0,0,1892,1893,1,0,0,0,1893,207,1,0,0,0,1894,1892,
	1,0,0,0,1895,1896,7,11,0,0,1896,209,1,0,0,0,1897,1898,5,109,0,0,1898,1902,
	5,4,0,0,1899,1901,3,110,55,0,1900,1899,1,0,0,0,1901,1904,1,0,0,0,1902,1900,
	1,0,0,0,1902,1903,1,0,0,0,1903,1905,1,0,0,0,1904,1902,1,0,0,0,1905,1906,
	5,6,0,0,1906,211,1,0,0,0,1907,1908,5,104,0,0,1908,1909,5,49,0,0,1909,1910,
	3,250,125,0,1910,1911,5,50,0,0,1911,1915,5,4,0,0,1912,1914,3,214,107,0,
	1913,1912,1,0,0,0,1914,1917,1,0,0,0,1915,1913,1,0,0,0,1915,1916,1,0,0,0,
	1916,1919,1,0,0,0,1917,1915,1,0,0,0,1918,1920,3,216,108,0,1919,1918,1,0,
	0,0,1919,1920,1,0,0,0,1920,1921,1,0,0,0,1921,1922,5,6,0,0,1922,213,1,0,
	0,0,1923,1924,5,105,0,0,1924,1925,3,250,125,0,1925,1929,5,110,0,0,1926,
	1928,3,110,55,0,1927,1926,1,0,0,0,1928,1931,1,0,0,0,1929,1927,1,0,0,0,1929,
	1930,1,0,0,0,1930,215,1,0,0,0,1931,1929,1,0,0,0,1932,1933,5,106,0,0,1933,
	1937,5,110,0,0,1934,1936,3,110,55,0,1935,1934,1,0,0,0,1936,1939,1,0,0,0,
	1937,1935,1,0,0,0,1937,1938,1,0,0,0,1938,217,1,0,0,0,1939,1937,1,0,0,0,
	1940,1941,5,111,0,0,1941,1943,3,250,125,0,1942,1944,3,220,110,0,1943,1942,
	1,0,0,0,1943,1944,1,0,0,0,1944,1945,1,0,0,0,1945,1947,3,108,54,0,1946,1948,
	3,222,111,0,1947,1946,1,0,0,0,1948,1949,1,0,0,0,1949,1947,1,0,0,0,1949,
	1950,1,0,0,0,1950,219,1,0,0,0,1951,1952,5,73,0,0,1952,1964,5,49,0,0,1953,
	1958,3,106,53,0,1954,1955,5,5,0,0,1955,1957,3,106,53,0,1956,1954,1,0,0,
	0,1957,1960,1,0,0,0,1958,1956,1,0,0,0,1958,1959,1,0,0,0,1959,1962,1,0,0,
	0,1960,1958,1,0,0,0,1961,1963,5,5,0,0,1962,1961,1,0,0,0,1962,1963,1,0,0,
	0,1963,1965,1,0,0,0,1964,1953,1,0,0,0,1964,1965,1,0,0,0,1965,1966,1,0,0,
	0,1966,1967,5,50,0,0,1967,221,1,0,0,0,1968,1970,5,112,0,0,1969,1971,5,180,
	0,0,1970,1969,1,0,0,0,1970,1971,1,0,0,0,1971,1987,1,0,0,0,1972,1984,5,49,
	0,0,1973,1978,3,106,53,0,1974,1975,5,5,0,0,1975,1977,3,106,53,0,1976,1974,
	1,0,0,0,1977,1980,1,0,0,0,1978,1976,1,0,0,0,1978,1979,1,0,0,0,1979,1982,
	1,0,0,0,1980,1978,1,0,0,0,1981,1983,5,5,0,0,1982,1981,1,0,0,0,1982,1983,
	1,0,0,0,1983,1985,1,0,0,0,1984,1973,1,0,0,0,1984,1985,1,0,0,0,1985,1986,
	1,0,0,0,1986,1988,5,50,0,0,1987,1972,1,0,0,0,1987,1988,1,0,0,0,1988,1989,
	1,0,0,0,1989,1990,3,108,54,0,1990,223,1,0,0,0,1991,1992,5,99,0,0,1992,1993,
	5,2,0,0,1993,225,1,0,0,0,1994,1995,5,100,0,0,1995,1996,5,2,0,0,1996,227,
	1,0,0,0,1997,2001,5,151,0,0,1998,1999,5,180,0,0,1999,2001,3,242,121,0,2000,
	1997,1,0,0,0,2000,1998,1,0,0,0,2001,229,1,0,0,0,2002,2003,5,36,0,0,2003,
	2006,5,180,0,0,2004,2005,5,12,0,0,2005,2007,5,180,0,0,2006,2004,1,0,0,0,
	2006,2007,1,0,0,0,2007,2008,1,0,0,0,2008,2009,5,49,0,0,2009,2021,5,4,0,
	0,2010,2015,3,240,120,0,2011,2012,5,5,0,0,2012,2014,3,240,120,0,2013,2011,
	1,0,0,0,2014,2017,1,0,0,0,2015,2013,1,0,0,0,2015,2016,1,0,0,0,2016,2019,
	1,0,0,0,2017,2015,1,0,0,0,2018,2020,5,5,0,0,2019,2018,1,0,0,0,2019,2020,
	1,0,0,0,2020,2022,1,0,0,0,2021,2010,1,0,0,0,2021,2022,1,0,0,0,2022,2023,
	1,0,0,0,2023,2024,5,6,0,0,2024,2025,5,50,0,0,2025,2045,5,2,0,0,2026,2027,
	5,36,0,0,2027,2030,5,180,0,0,2028,2029,5,12,0,0,2029,2031,5,180,0,0,2030,
	2028,1,0,0,0,2030,2031,1,0,0,0,2031,2032,1,0,0,0,2032,2033,3,242,121,0,
	2033,2034,5,2,0,0,2034,2045,1,0,0,0,2035,2036,5,36,0,0,2036,2037,5,49,0,
	0,2037,2038,5,151,0,0,2038,2039,5,50,0,0,2039,2045,5,2,0,0,2040,2041,5,
	36,0,0,2041,2042,5,49,0,0,2042,2043,5,50,0,0,2043,2045,5,2,0,0,2044,2002,
	1,0,0,0,2044,2026,1,0,0,0,2044,2035,1,0,0,0,2044,2040,1,0,0,0,2045,231,
	1,0,0,0,2046,2047,5,113,0,0,2047,2048,5,49,0,0,2048,2049,3,250,125,0,2049,
	2050,5,50,0,0,2050,2051,5,2,0,0,2051,233,1,0,0,0,2052,2055,5,180,0,0,2053,
	2055,3,256,128,0,2054,2052,1,0,0,0,2054,2053,1,0,0,0,2055,235,1,0,0,0,2056,
	2068,5,49,0,0,2057,2062,3,234,117,0,2058,2059,5,5,0,0,2059,2061,3,234,117,
	0,2060,2058,1,0,0,0,2061,2064,1,0,0,0,2062,2060,1,0,0,0,2062,2063,1,0,0,
	0,2063,2066,1,0,0,0,2064,2062,1,0,0,0,2065,2067,5,5,0,0,2066,2065,1,0,0,
	0,2066,2067,1,0,0,0,2067,2069,1,0,0,0,2068,2057,1,0,0,0,2068,2069,1,0,0,
	0,2069,2070,1,0,0,0,2070,2071,5,50,0,0,2071,237,1,0,0,0,2072,2073,5,180,
	0,0,2073,2097,3,242,121,0,2074,2075,5,180,0,0,2075,2076,5,12,0,0,2076,2077,
	5,180,0,0,2077,2097,3,242,121,0,2078,2079,5,180,0,0,2079,2080,5,49,0,0,
	2080,2092,5,4,0,0,2081,2086,3,240,120,0,2082,2083,5,5,0,0,2083,2085,3,240,
	120,0,2084,2082,1,0,0,0,2085,2088,1,0,0,0,2086,2084,1,0,0,0,2086,2087,1,
	0,0,0,2087,2090,1,0,0,0,2088,2086,1,0,0,0,2089,2091,5,5,0,0,2090,2089,1,
	0,0,0,2090,2091,1,0,0,0,2091,2093,1,0,0,0,2092,2081,1,0,0,0,2092,2093,1,
	0,0,0,2093,2094,1,0,0,0,2094,2095,5,6,0,0,2095,2097,5,50,0,0,2096,2072,
	1,0,0,0,2096,2074,1,0,0,0,2096,2078,1,0,0,0,2097,239,1,0,0,0,2098,2099,
	5,180,0,0,2099,2100,5,110,0,0,2100,2101,3,250,125,0,2101,241,1,0,0,0,2102,
	2114,5,49,0,0,2103,2108,3,250,125,0,2104,2105,5,5,0,0,2105,2107,3,250,125,
	0,2106,2104,1,0,0,0,2107,2110,1,0,0,0,2108,2106,1,0,0,0,2108,2109,1,0,0,
	0,2109,2112,1,0,0,0,2110,2108,1,0,0,0,2111,2113,5,5,0,0,2112,2111,1,0,0,
	0,2112,2113,1,0,0,0,2113,2115,1,0,0,0,2114,2103,1,0,0,0,2114,2115,1,0,0,
	0,2115,2116,1,0,0,0,2116,2117,5,50,0,0,2117,243,1,0,0,0,2118,2119,5,4,0,
	0,2119,2124,3,246,123,0,2120,2121,5,5,0,0,2121,2123,3,246,123,0,2122,2120,
	1,0,0,0,2123,2126,1,0,0,0,2124,2122,1,0,0,0,2124,2125,1,0,0,0,2125,2128,
	1,0,0,0,2126,2124,1,0,0,0,2127,2129,5,5,0,0,2128,2127,1,0,0,0,2128,2129,
	1,0,0,0,2129,2130,1,0,0,0,2130,2131,5,6,0,0,2131,245,1,0,0,0,2132,2133,
	5,180,0,0,2133,2134,5,110,0,0,2134,2135,3,250,125,0,2135,247,1,0,0,0,2136,
	2137,5,49,0,0,2137,2142,3,262,131,0,2138,2139,5,5,0,0,2139,2141,3,262,131,
	0,2140,2138,1,0,0,0,2141,2144,1,0,0,0,2142,2140,1,0,0,0,2142,2143,1,0,0,
	0,2143,2146,1,0,0,0,2144,2142,1,0,0,0,2145,2147,5,5,0,0,2146,2145,1,0,0,
	0,2146,2147,1,0,0,0,2147,2148,1,0,0,0,2148,2149,5,50,0,0,2149,249,1,0,0,
	0,2150,2151,6,125,-1,0,2151,2152,5,49,0,0,2152,2153,5,180,0,0,2153,2154,
	7,8,0,0,2154,2155,3,250,125,0,2155,2156,5,50,0,0,2156,2296,1,0,0,0,2157,
	2158,5,49,0,0,2158,2159,3,250,125,0,2159,2160,5,50,0,0,2160,2296,1,0,0,
	0,2161,2162,5,49,0,0,2162,2165,3,250,125,0,2163,2164,5,5,0,0,2164,2166,
	3,250,125,0,2165,2163,1,0,0,0,2166,2167,1,0,0,0,2167,2165,1,0,0,0,2167,
	2168,1,0,0,0,2168,2169,1,0,0,0,2169,2170,5,50,0,0,2170,2296,1,0,0,0,2171,
	2172,3,264,132,0,2172,2173,5,49,0,0,2173,2175,3,250,125,0,2174,2176,5,5,
	0,0,2175,2174,1,0,0,0,2175,2176,1,0,0,0,2176,2177,1,0,0,0,2177,2178,5,50,
	0,0,2178,2296,1,0,0,0,2179,2296,3,238,119,0,2180,2181,5,114,0,0,2181,2183,
	5,180,0,0,2182,2184,3,244,122,0,2183,2182,1,0,0,0,2183,2184,1,0,0,0,2184,
	2185,1,0,0,0,2185,2296,3,242,121,0,2186,2187,5,114,0,0,2187,2188,3,262,
	131,0,2188,2189,5,66,0,0,2189,2190,5,67,0,0,2190,2191,5,49,0,0,2191,2192,
	3,250,125,0,2192,2193,5,50,0,0,2193,2296,1,0,0,0,2194,2195,5,55,0,0,2195,
	2196,5,49,0,0,2196,2197,3,262,131,0,2197,2198,5,50,0,0,2198,2199,5,12,0,
	0,2199,2200,5,180,0,0,2200,2296,1,0,0,0,2201,2202,5,115,0,0,2202,2296,3,
	242,121,0,2203,2204,5,116,0,0,2204,2296,3,242,121,0,2205,2206,5,117,0,0,
	2206,2296,3,242,121,0,2207,2208,5,118,0,0,2208,2296,3,242,121,0,2209,2210,
	5,119,0,0,2210,2211,5,49,0,0,2211,2212,5,180,0,0,2212,2213,5,12,0,0,2213,
	2214,5,180,0,0,2214,2215,5,5,0,0,2215,2216,3,242,121,0,2216,2217,5,50,0,
	0,2217,2296,1,0,0,0,2218,2219,5,120,0,0,2219,2296,3,242,121,0,2220,2221,
	5,121,0,0,2221,2296,3,242,121,0,2222,2223,5,122,0,0,2223,2224,5,49,0,0,
	2224,2225,3,250,125,0,2225,2226,5,5,0,0,2226,2227,3,248,124,0,2227,2228,
	5,50,0,0,2228,2296,1,0,0,0,2229,2230,5,123,0,0,2230,2231,5,49,0,0,2231,
	2232,3,250,125,0,2232,2233,5,5,0,0,2233,2234,3,248,124,0,2234,2235,5,5,
	0,0,2235,2236,5,145,0,0,2236,2237,5,50,0,0,2237,2296,1,0,0,0,2238,2239,
	5,124,0,0,2239,2240,5,66,0,0,2240,2241,3,250,125,0,2241,2242,5,67,0,0,2242,
	2243,7,12,0,0,2243,2296,1,0,0,0,2244,2245,5,125,0,0,2245,2246,5,66,0,0,
	2246,2247,3,250,125,0,2247,2248,5,67,0,0,2248,2249,7,13,0,0,2249,2296,1,
	0,0,0,2250,2251,7,14,0,0,2251,2296,3,250,125,21,2252,2264,5,66,0,0,2253,
	2258,3,250,125,0,2254,2255,5,5,0,0,2255,2257,3,250,125,0,2256,2254,1,0,
	0,0,2257,2260,1,0,0,0,2258,2256,1,0,0,0,2258,2259,1,0,0,0,2259,2262,1,0,
	0,0,2260,2258,1,0,0,0,2261,2263,5,5,0,0,2262,2261,1,0,0,0,2262,2263,1,0,
	0,0,2263,2265,1,0,0,0,2264,2253,1,0,0,0,2264,2265,1,0,0,0,2265,2266,1,0,
	0,0,2266,2296,5,67,0,0,2267,2268,5,74,0,0,2268,2269,5,12,0,0,2269,2270,
	5,180,0,0,2270,2271,5,12,0,0,2271,2272,5,180,0,0,2272,2273,5,66,0,0,2273,
	2274,3,250,125,0,2274,2275,5,67,0,0,2275,2276,3,252,126,0,2276,2296,1,0,
	0,0,2277,2278,5,74,0,0,2278,2279,5,12,0,0,2279,2284,5,180,0,0,2280,2281,
	5,66,0,0,2281,2282,3,250,125,0,2282,2283,5,67,0,0,2283,2285,1,0,0,0,2284,
	2280,1,0,0,0,2285,2286,1,0,0,0,2286,2284,1,0,0,0,2286,2287,1,0,0,0,2287,
	2296,1,0,0,0,2288,2289,5,74,0,0,2289,2290,5,12,0,0,2290,2296,5,180,0,0,
	2291,2296,5,74,0,0,2292,2296,5,160,0,0,2293,2296,3,14,7,0,2294,2296,3,256,
	128,0,2295,2150,1,0,0,0,2295,2157,1,0,0,0,2295,2161,1,0,0,0,2295,2171,1,
	0,0,0,2295,2179,1,0,0,0,2295,2180,1,0,0,0,2295,2186,1,0,0,0,2295,2194,1,
	0,0,0,2295,2201,1,0,0,0,2295,2203,1,0,0,0,2295,2205,1,0,0,0,2295,2207,1,
	0,0,0,2295,2209,1,0,0,0,2295,2218,1,0,0,0,2295,2220,1,0,0,0,2295,2222,1,
	0,0,0,2295,2229,1,0,0,0,2295,2238,1,0,0,0,2295,2244,1,0,0,0,2295,2250,1,
	0,0,0,2295,2252,1,0,0,0,2295,2267,1,0,0,0,2295,2277,1,0,0,0,2295,2288,1,
	0,0,0,2295,2291,1,0,0,0,2295,2292,1,0,0,0,2295,2293,1,0,0,0,2295,2294,1,
	0,0,0,2296,2404,1,0,0,0,2297,2298,10,20,0,0,2298,2299,5,17,0,0,2299,2403,
	3,250,125,20,2300,2301,10,19,0,0,2301,2302,7,15,0,0,2302,2403,3,250,125,
	20,2303,2304,10,18,0,0,2304,2305,7,16,0,0,2305,2403,3,250,125,19,2306,2307,
	10,17,0,0,2307,2308,7,17,0,0,2308,2403,3,250,125,18,2309,2310,10,16,0,0,
	2310,2311,7,18,0,0,2311,2403,3,250,125,17,2312,2313,10,15,0,0,2313,2314,
	7,19,0,0,2314,2403,3,250,125,16,2315,2316,10,14,0,0,2316,2317,5,24,0,0,
	2317,2403,3,250,125,15,2318,2319,10,13,0,0,2319,2320,5,26,0,0,2320,2403,
	3,250,125,14,2321,2322,10,12,0,0,2322,2323,5,25,0,0,2323,2403,3,250,125,
	13,2324,2325,10,11,0,0,2325,2326,5,130,0,0,2326,2403,3,250,125,12,2327,
	2328,10,10,0,0,2328,2329,5,131,0,0,2329,2403,3,250,125,11,2330,2331,10,
	9,0,0,2331,2332,5,132,0,0,2332,2333,3,250,125,0,2333,2334,5,110,0,0,2334,
	2335,3,250,125,9,2335,2403,1,0,0,0,2336,2337,10,33,0,0,2337,2338,5,66,0,
	0,2338,2339,3,250,125,0,2339,2340,5,110,0,0,2340,2341,3,250,125,0,2341,
	2342,5,67,0,0,2342,2403,1,0,0,0,2343,2344,10,32,0,0,2344,2345,5,66,0,0,
	2345,2346,5,145,0,0,2346,2403,5,67,0,0,2347,2348,10,31,0,0,2348,2349,5,
	66,0,0,2349,2350,3,250,125,0,2350,2351,5,67,0,0,2351,2403,1,0,0,0,2352,
	2353,10,28,0,0,2353,2403,7,20,0,0,2354,2355,10,27,0,0,2355,2356,5,167,0,
	0,2356,2357,5,49,0,0,2357,2358,3,250,125,0,2358,2359,5,50,0,0,2359,2403,
	1,0,0,0,2360,2361,10,26,0,0,2361,2362,5,168,0,0,2362,2363,5,49,0,0,2363,
	2364,3,250,125,0,2364,2365,5,5,0,0,2365,2366,3,250,125,0,2366,2367,5,50,
	0,0,2367,2403,1,0,0,0,2368,2369,10,25,0,0,2369,2370,5,12,0,0,2370,2372,
	5,180,0,0,2371,2373,3,244,122,0,2372,2371,1,0,0,0,2372,2373,1,0,0,0,2373,
	2374,1,0,0,0,2374,2375,5,49,0,0,2375,2387,5,4,0,0,2376,2381,3,240,120,0,
	2377,2378,5,5,0,0,2378,2380,3,240,120,0,2379,2377,1,0,0,0,2380,2383,1,0,
	0,0,2381,2379,1,0,0,0,2381,2382,1,0,0,0,2382,2385,1,0,0,0,2383,2381,1,0,
	0,0,2384,2386,5,5,0,0,2385,2384,1,0,0,0,2385,2386,1,0,0,0,2386,2388,1,0,
	0,0,2387,2376,1,0,0,0,2387,2388,1,0,0,0,2388,2389,1,0,0,0,2389,2390,5,6,
	0,0,2390,2403,5,50,0,0,2391,2392,10,24,0,0,2392,2393,5,12,0,0,2393,2395,
	5,180,0,0,2394,2396,3,244,122,0,2395,2394,1,0,0,0,2395,2396,1,0,0,0,2396,
	2397,1,0,0,0,2397,2403,3,242,121,0,2398,2399,10,23,0,0,2399,2403,3,252,
	126,0,2400,2401,10,22,0,0,2401,2403,7,9,0,0,2402,2297,1,0,0,0,2402,2300,
	1,0,0,0,2402,2303,1,0,0,0,2402,2306,1,0,0,0,2402,2309,1,0,0,0,2402,2312,
	1,0,0,0,2402,2315,1,0,0,0,2402,2318,1,0,0,0,2402,2321,1,0,0,0,2402,2324,
	1,0,0,0,2402,2327,1,0,0,0,2402,2330,1,0,0,0,2402,2336,1,0,0,0,2402,2343,
	1,0,0,0,2402,2347,1,0,0,0,2402,2352,1,0,0,0,2402,2354,1,0,0,0,2402,2360,
	1,0,0,0,2402,2368,1,0,0,0,2402,2391,1,0,0,0,2402,2398,1,0,0,0,2402,2400,
	1,0,0,0,2403,2406,1,0,0,0,2404,2402,1,0,0,0,2404,2405,1,0,0,0,2405,251,
	1,0,0,0,2406,2404,1,0,0,0,2407,2408,5,12,0,0,2408,2421,5,180,0,0,2409,2421,
	5,163,0,0,2410,2421,5,172,0,0,2411,2421,5,173,0,0,2412,2421,5,174,0,0,2413,
	2421,5,175,0,0,2414,2421,5,176,0,0,2415,2421,5,177,0,0,2416,2421,5,178,
	0,0,2417,2421,5,179,0,0,2418,2421,5,170,0,0,2419,2421,5,171,0,0,2420,2407,
	1,0,0,0,2420,2409,1,0,0,0,2420,2410,1,0,0,0,2420,2411,1,0,0,0,2420,2412,
	1,0,0,0,2420,2413,1,0,0,0,2420,2414,1,0,0,0,2420,2415,1,0,0,0,2420,2416,
	1,0,0,0,2420,2417,1,0,0,0,2420,2418,1,0,0,0,2420,2419,1,0,0,0,2421,253,
	1,0,0,0,2422,2423,7,21,0,0,2423,255,1,0,0,0,2424,2439,5,141,0,0,2425,2439,
	3,258,129,0,2426,2439,3,260,130,0,2427,2431,5,151,0,0,2428,2430,5,151,0,
	0,2429,2428,1,0,0,0,2430,2433,1,0,0,0,2431,2429,1,0,0,0,2431,2432,1,0,0,
	0,2432,2439,1,0,0,0,2433,2431,1,0,0,0,2434,2439,5,161,0,0,2435,2439,5,162,
	0,0,2436,2439,5,152,0,0,2437,2439,5,153,0,0,2438,2424,1,0,0,0,2438,2425,
	1,0,0,0,2438,2426,1,0,0,0,2438,2427,1,0,0,0,2438,2434,1,0,0,0,2438,2435,
	1,0,0,0,2438,2436,1,0,0,0,2438,2437,1,0,0,0,2439,257,1,0,0,0,2440,2442,
	5,145,0,0,2441,2443,7,22,0,0,2442,2441,1,0,0,0,2442,2443,1,0,0,0,2443,259,
	1,0,0,0,2444,2445,5,144,0,0,2445,261,1,0,0,0,2446,2447,5,108,0,0,2447,2491,
	5,59,0,0,2448,2491,5,108,0,0,2449,2491,5,146,0,0,2450,2491,5,147,0,0,2451,
	2491,5,149,0,0,2452,2491,5,148,0,0,2453,2491,5,156,0,0,2454,2491,5,157,
	0,0,2455,2491,5,138,0,0,2456,2491,5,139,0,0,2457,2491,5,158,0,0,2458,2491,
	5,159,0,0,2459,2460,5,7,0,0,2460,2469,5,49,0,0,2461,2466,3,262,131,0,2462,
	2463,5,5,0,0,2463,2465,3,262,131,0,2464,2462,1,0,0,0,2465,2468,1,0,0,0,
	2466,2464,1,0,0,0,2466,2467,1,0,0,0,2467,2470,1,0,0,0,2468,2466,1,0,0,0,
	2469,2461,1,0,0,0,2469,2470,1,0,0,0,2470,2471,1,0,0,0,2471,2484,5,50,0,
	0,2472,2473,5,73,0,0,2473,2474,5,49,0,0,2474,2479,3,262,131,0,2475,2476,
	5,5,0,0,2476,2478,3,262,131,0,2477,2475,1,0,0,0,2478,2481,1,0,0,0,2479,
	2477,1,0,0,0,2479,2480,1,0,0,0,2480,2482,1,0,0,0,2481,2479,1,0,0,0,2482,
	2483,5,50,0,0,2483,2485,1,0,0,0,2484,2472,1,0,0,0,2484,2485,1,0,0,0,2485,
	2491,1,0,0,0,2486,2487,5,180,0,0,2487,2488,5,12,0,0,2488,2491,5,180,0,0,
	2489,2491,5,180,0,0,2490,2446,1,0,0,0,2490,2448,1,0,0,0,2490,2449,1,0,0,
	0,2490,2450,1,0,0,0,2490,2451,1,0,0,0,2490,2452,1,0,0,0,2490,2453,1,0,0,
	0,2490,2454,1,0,0,0,2490,2455,1,0,0,0,2490,2456,1,0,0,0,2490,2457,1,0,0,
	0,2490,2458,1,0,0,0,2490,2459,1,0,0,0,2490,2486,1,0,0,0,2490,2489,1,0,0,
	0,2491,263,1,0,0,0,2492,2493,7,23,0,0,2493,265,1,0,0,0,260,269,275,288,
	290,310,314,321,326,334,338,344,355,358,368,372,379,382,386,391,395,410,
	413,427,430,441,443,458,473,477,487,493,499,505,511,517,523,529,535,541,
	546,554,557,574,576,583,591,597,601,613,617,619,623,629,632,644,648,650,
	664,671,684,688,695,715,721,728,739,745,752,760,771,780,786,792,801,807,
	812,818,825,831,837,841,845,853,858,866,876,881,885,897,906,908,914,920,
	927,938,944,948,954,961,977,986,990,996,1005,1009,1017,1021,1027,1031,1033,
	1041,1045,1047,1055,1059,1065,1069,1075,1079,1081,1087,1092,1125,1151,1165,
	1177,1181,1186,1191,1200,1204,1206,1228,1233,1239,1254,1263,1267,1269,1278,
	1283,1294,1296,1302,1316,1322,1334,1345,1353,1368,1370,1376,1388,1394,1405,
	1409,1420,1433,1439,1447,1453,1457,1467,1479,1489,1500,1507,1513,1520,1533,
	1551,1565,1609,1621,1625,1634,1644,1656,1664,1709,1718,1724,1738,1765,1783,
	1791,1796,1803,1818,1821,1824,1847,1850,1859,1862,1869,1878,1881,1892,1902,
	1915,1919,1929,1937,1943,1949,1958,1962,1964,1970,1978,1982,1984,1987,2000,
	2006,2015,2019,2021,2030,2044,2054,2062,2066,2068,2086,2090,2092,2096,2108,
	2112,2114,2124,2128,2142,2146,2167,2175,2183,2258,2262,2264,2286,2295,2372,
	2381,2385,2387,2395,2402,2404,2420,2431,2438,2442,2466,2469,2479,2484,2490];

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
