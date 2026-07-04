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
	public static readonly RULE_lvMember = 64;
	public static readonly RULE_mappingDeleteStatement = 65;
	public static readonly RULE_variableDefinition = 66;
	public static readonly RULE_tupleAssignment = 67;
	public static readonly RULE_tupleSlot = 68;
	public static readonly RULE_assignStatement = 69;
	public static readonly RULE_arrayPushStatement = 70;
	public static readonly RULE_pushArgument = 71;
	public static readonly RULE_arrayPopStatement = 72;
	public static readonly RULE_arrayDeleteStatement = 73;
	public static readonly RULE_stateArrayPushStatement = 74;
	public static readonly RULE_stateArrayPopStatement = 75;
	public static readonly RULE_deleteStatement = 76;
	public static readonly RULE_timeOpStatement = 77;
	public static readonly RULE_requireStatement = 78;
	public static readonly RULE_ifStatement = 79;
	public static readonly RULE_loopStatement = 80;
	public static readonly RULE_forOfEntriesStatement = 81;
	public static readonly RULE_forInStatement = 82;
	public static readonly RULE_forOfStatement = 83;
	public static readonly RULE_forStatement = 84;
	public static readonly RULE_forInit = 85;
	public static readonly RULE_forCondition = 86;
	public static readonly RULE_forUpdate = 87;
	public static readonly RULE_doWhileStatement = 88;
	public static readonly RULE_whileStatement = 89;
	public static readonly RULE_consoleStatement = 90;
	public static readonly RULE_assemblyStatement = 91;
	public static readonly RULE_yulBlock = 92;
	public static readonly RULE_yulStatement = 93;
	public static readonly RULE_yulVariableDeclaration = 94;
	public static readonly RULE_yulAssignment = 95;
	public static readonly RULE_yulIf = 96;
	public static readonly RULE_yulSwitch = 97;
	public static readonly RULE_yulCase = 98;
	public static readonly RULE_yulDefault = 99;
	public static readonly RULE_yulForLoop = 100;
	public static readonly RULE_yulFunctionDefinition = 101;
	public static readonly RULE_yulExpression = 102;
	public static readonly RULE_yulFunctionCall = 103;
	public static readonly RULE_yulFunctionName = 104;
	public static readonly RULE_yulPath = 105;
	public static readonly RULE_yulLiteral = 106;
	public static readonly RULE_uncheckedStatement = 107;
	public static readonly RULE_switchStatement = 108;
	public static readonly RULE_switchCase = 109;
	public static readonly RULE_switchDefault = 110;
	public static readonly RULE_tryCatchStatement = 111;
	public static readonly RULE_tryReturns = 112;
	public static readonly RULE_catchClause = 113;
	public static readonly RULE_breakStatement = 114;
	public static readonly RULE_continueStatement = 115;
	public static readonly RULE_requireMessage = 116;
	public static readonly RULE_revertStatement = 117;
	public static readonly RULE_assertStatement = 118;
	public static readonly RULE_consoleParameter = 119;
	public static readonly RULE_consoleParameterList = 120;
	public static readonly RULE_functionCall = 121;
	public static readonly RULE_namedArg = 122;
	public static readonly RULE_expressionList = 123;
	public static readonly RULE_callOptions = 124;
	public static readonly RULE_callOption = 125;
	public static readonly RULE_typeList = 126;
	public static readonly RULE_typeListItem = 127;
	public static readonly RULE_expression = 128;
	public static readonly RULE_memberName = 129;
	public static readonly RULE_modifier = 130;
	public static readonly RULE_literal = 131;
	public static readonly RULE_numberLiteral = 132;
	public static readonly RULE_decimalLiteral = 133;
	public static readonly RULE_typeName = 134;
	public static readonly RULE_typeCast = 135;
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
		"lvMember", "mappingDeleteStatement", "variableDefinition", "tupleAssignment", 
		"tupleSlot", "assignStatement", "arrayPushStatement", "pushArgument", 
		"arrayPopStatement", "arrayDeleteStatement", "stateArrayPushStatement", 
		"stateArrayPopStatement", "deleteStatement", "timeOpStatement", "requireStatement", 
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
			this.state = 275;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===37) {
				{
				{
				this.state = 272;
				this.pragmaDirective();
				}
				}
				this.state = 277;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 281;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===1) {
				{
				{
				this.state = 278;
				this.importDirective();
				}
				}
				this.state = 283;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 296;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1842241) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 294;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 2, this._ctx) ) {
				case 1:
					{
					this.state = 284;
					this.constantDefinition();
					}
					break;
				case 2:
					{
					this.state = 285;
					this.enumDefinition();
					}
					break;
				case 3:
					{
					this.state = 286;
					this.structDefinition();
					}
					break;
				case 4:
					{
					this.state = 287;
					this.typeDefinition();
					}
					break;
				case 5:
					{
					this.state = 288;
					this.usingForDirective();
					}
					break;
				case 6:
					{
					this.state = 289;
					this.errorDefinition();
					}
					break;
				case 7:
					{
					this.state = 290;
					this.interfaceDefinition();
					}
					break;
				case 8:
					{
					this.state = 291;
					this.freeFunctionDefinition();
					}
					break;
				case 9:
					{
					this.state = 292;
					this.libraryDefinition();
					}
					break;
				case 10:
					{
					this.state = 293;
					this.contractDefinition();
					}
					break;
				}
				}
				this.state = 298;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 299;
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
			this.state = 327;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 6, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 301;
				this.match(SolidCashParser.T__0);
				this.state = 302;
				this.match(SolidCashParser.StringLiteral);
				this.state = 303;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 304;
				this.match(SolidCashParser.T__0);
				this.state = 305;
				this.match(SolidCashParser.StringLiteral);
				this.state = 306;
				this.match(SolidCashParser.T__2);
				this.state = 307;
				this.match(SolidCashParser.Identifier);
				this.state = 308;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 309;
				this.match(SolidCashParser.T__0);
				this.state = 310;
				this.match(SolidCashParser.T__3);
				this.state = 311;
				this.importBinding();
				this.state = 316;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 312;
						this.match(SolidCashParser.T__4);
						this.state = 313;
						this.importBinding();
						}
						}
					}
					this.state = 318;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				}
				this.state = 320;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 319;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 322;
				this.match(SolidCashParser.T__5);
				this.state = 323;
				this.match(SolidCashParser.Identifier);
				this.state = 324;
				this.match(SolidCashParser.StringLiteral);
				this.state = 325;
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
			this.state = 329;
			this.match(SolidCashParser.Identifier);
			this.state = 332;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 330;
				this.match(SolidCashParser.T__2);
				this.state = 331;
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
			this.state = 334;
			this.match(SolidCashParser.T__6);
			this.state = 335;
			this.anyIdentifier();
			this.state = 336;
			this.parameterList();
			this.state = 340;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 337;
				this.functionModifier();
				}
				}
				this.state = 342;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 344;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 343;
				this.returnType();
				}
			}

			this.state = 346;
			this.match(SolidCashParser.T__3);
			this.state = 350;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 347;
				this.statement();
				}
				}
				this.state = 352;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 353;
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
			this.state = 392;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 17, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 355;
				this.match(SolidCashParser.T__7);
				this.state = 356;
				this.match(SolidCashParser.Identifier);
				this.state = 357;
				this.match(SolidCashParser.T__8);
				this.state = 361;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 11, this._ctx) ) {
				case 1:
					{
					this.state = 358;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 359;
					this.typeName();
					}
					break;
				case 3:
					{
					this.state = 360;
					this.match(SolidCashParser.T__9);
					}
					break;
				}
				this.state = 364;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 363;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 366;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 367;
				this.match(SolidCashParser.T__7);
				this.state = 368;
				this.match(SolidCashParser.T__3);
				this.state = 369;
				this.usingFunctionBinding();
				this.state = 374;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 370;
						this.match(SolidCashParser.T__4);
						this.state = 371;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 376;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				}
				this.state = 378;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 377;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 380;
				this.match(SolidCashParser.T__5);
				this.state = 381;
				this.match(SolidCashParser.T__8);
				this.state = 385;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 15, this._ctx) ) {
				case 1:
					{
					this.state = 382;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 383;
					this.typeName();
					}
					break;
				case 3:
					{
					this.state = 384;
					this.match(SolidCashParser.T__9);
					}
					break;
				}
				this.state = 388;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 387;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 390;
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
			this.state = 394;
			this.match(SolidCashParser.Identifier);
			this.state = 397;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===12) {
				{
				this.state = 395;
				this.match(SolidCashParser.T__11);
				this.state = 396;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 401;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 399;
				this.match(SolidCashParser.T__2);
				this.state = 400;
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
			this.state = 403;
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
			this.state = 405;
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
			this.state = 421;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 21, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 407;
				this.match(SolidCashParser.T__36);
				this.state = 408;
				this.pragmaName();
				this.state = 409;
				this.pragmaValue();
				this.state = 410;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 412;
				this.match(SolidCashParser.T__36);
				this.state = 413;
				this.match(SolidCashParser.Identifier);
				this.state = 417;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 2081) !== 0) || _la===180) {
					{
					{
					this.state = 414;
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
					this.state = 419;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 420;
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
			this.state = 423;
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
			this.state = 431;
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
				this.state = 426;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 425;
					this.versionConstraint();
					}
					}
					this.state = 428;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0) || _la===140 || _la===144);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 430;
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
			this.state = 434;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0)) {
				{
				this.state = 433;
				this.versionOperator();
				}
			}

			this.state = 436;
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
			this.state = 438;
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
			this.state = 440;
			this.match(SolidCashParser.T__40);
			this.state = 441;
			this.match(SolidCashParser.Identifier);
			this.state = 451;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 442;
				this.match(SolidCashParser.T__41);
				this.state = 443;
				this.match(SolidCashParser.Identifier);
				this.state = 448;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 444;
					this.match(SolidCashParser.T__4);
					this.state = 445;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 450;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 453;
			this.match(SolidCashParser.T__3);
			this.state = 464;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1843969) !== 0)) {
				{
				this.state = 462;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 27, this._ctx) ) {
				case 1:
					{
					this.state = 454;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 455;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 456;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 457;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 458;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 459;
					this.interfaceStateVariable();
					}
					break;
				case 7:
					{
					this.state = 460;
					this.interfaceCollection();
					}
					break;
				case 8:
					{
					this.state = 461;
					this.interfaceFunction();
					}
					break;
				}
				}
				this.state = 466;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 467;
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
			this.state = 479;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 29, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 469;
				this.interfaceStateVariableVisibility();
				this.state = 470;
				this.mappingType();
				this.state = 471;
				this.match(SolidCashParser.Identifier);
				this.state = 472;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 474;
				this.interfaceStateVariableVisibility();
				this.state = 475;
				this.arrayType(0);
				this.state = 476;
				this.match(SolidCashParser.Identifier);
				this.state = 477;
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
			this.state = 481;
			this.interfaceStateVariableVisibility();
			this.state = 482;
			this.typeName();
			this.state = 483;
			this.match(SolidCashParser.Identifier);
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
	public interfaceStateVariableVisibility(): InterfaceStateVariableVisibilityContext {
		let localctx: InterfaceStateVariableVisibilityContext = new InterfaceStateVariableVisibilityContext(this, this._ctx, this.state);
		this.enterRule(localctx, 32, SolidCashParser.RULE_interfaceStateVariableVisibility);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 486;
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
			this.state = 488;
			this.match(SolidCashParser.T__6);
			this.state = 489;
			this.match(SolidCashParser.Identifier);
			this.state = 490;
			this.parameterList();
			this.state = 494;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 491;
				this.functionModifier();
				}
				}
				this.state = 496;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 498;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 497;
				this.returnType();
				}
			}

			this.state = 500;
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
			this.state = 502;
			this.match(SolidCashParser.T__44);
			this.state = 503;
			this.match(SolidCashParser.Identifier);
			this.state = 504;
			this.match(SolidCashParser.T__3);
			this.state = 508;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===54) {
				{
				{
				this.state = 505;
				this.enumDefinition();
				}
				}
				this.state = 510;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 514;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===53) {
				{
				{
				this.state = 511;
				this.structDefinition();
				}
				}
				this.state = 516;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 520;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===55) {
				{
				{
				this.state = 517;
				this.typeDefinition();
				}
				}
				this.state = 522;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 526;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===48) {
				{
				{
				this.state = 523;
				this.eventDefinition();
				}
				}
				this.state = 528;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 532;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===35) {
				{
				{
				this.state = 529;
				this.errorDefinition();
				}
				}
				this.state = 534;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 538;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 37, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 535;
					this.constantDefinition();
					}
					}
				}
				this.state = 540;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 37, this._ctx);
			}
			this.state = 544;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 38, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 541;
					this.stateVariableDeclaration();
					}
					}
				}
				this.state = 546;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 38, this._ctx);
			}
			this.state = 550;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===8) {
				{
				{
				this.state = 547;
				this.usingForDirective();
				}
				}
				this.state = 552;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 556;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 553;
				this.freeFunctionDefinition();
				}
				}
				this.state = 558;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 559;
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
			this.state = 562;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===46) {
				{
				this.state = 561;
				this.match(SolidCashParser.T__45);
				}
			}

			this.state = 564;
			this.match(SolidCashParser.T__46);
			this.state = 565;
			this.match(SolidCashParser.Identifier);
			this.state = 567;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 566;
				this.parameterList();
				}
			}

			this.state = 578;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 569;
				this.match(SolidCashParser.T__41);
				this.state = 570;
				this.inheritanceSpecifier();
				this.state = 575;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 571;
					this.match(SolidCashParser.T__4);
					this.state = 572;
					this.inheritanceSpecifier();
					}
					}
					this.state = 577;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 580;
			this.match(SolidCashParser.T__3);
			this.state = 597;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 268435459) !== 0) || ((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 37411875) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 595;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 45, this._ctx) ) {
				case 1:
					{
					this.state = 581;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 582;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 583;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 584;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 585;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 586;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 587;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 588;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 589;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 590;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 591;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 592;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 593;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 594;
					this.receiveDefinition();
					}
					break;
				}
				}
				this.state = 599;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 600;
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
			this.state = 602;
			this.match(SolidCashParser.Identifier);
			this.state = 604;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 603;
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
			this.state = 606;
			this.match(SolidCashParser.T__6);
			this.state = 607;
			this.anyIdentifier();
			this.state = 608;
			this.parameterList();
			this.state = 613;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0) || _la===180) {
				{
				this.state = 611;
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
					this.state = 609;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 610;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 615;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 617;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 616;
				this.returnType();
				}
			}

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
	public eventDefinition(): EventDefinitionContext {
		let localctx: EventDefinitionContext = new EventDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 44, SolidCashParser.RULE_eventDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 621;
			this.match(SolidCashParser.T__47);
			this.state = 622;
			this.match(SolidCashParser.Identifier);
			this.state = 623;
			this.match(SolidCashParser.T__48);
			this.state = 635;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 624;
				this.eventParameter();
				this.state = 629;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 625;
						this.match(SolidCashParser.T__4);
						this.state = 626;
						this.eventParameter();
						}
						}
					}
					this.state = 631;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				}
				this.state = 633;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 632;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 637;
			this.match(SolidCashParser.T__49);
			this.state = 639;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===51) {
				{
				this.state = 638;
				this.match(SolidCashParser.T__50);
				}
			}

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
	public eventParameter(): EventParameterContext {
		let localctx: EventParameterContext = new EventParameterContext(this, this._ctx, this.state);
		this.enterRule(localctx, 46, SolidCashParser.RULE_eventParameter);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 645;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 55, this._ctx) ) {
			case 1:
				{
				this.state = 643;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 644;
				this.arrayType(0);
				}
				break;
			}
			this.state = 648;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===52) {
				{
				this.state = 647;
				this.match(SolidCashParser.T__51);
				}
			}

			this.state = 651;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 650;
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
			this.state = 653;
			this.match(SolidCashParser.T__34);
			this.state = 654;
			this.match(SolidCashParser.Identifier);
			this.state = 655;
			this.match(SolidCashParser.T__48);
			this.state = 667;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 656;
				this.errorParameter();
				this.state = 661;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 58, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 657;
						this.match(SolidCashParser.T__4);
						this.state = 658;
						this.errorParameter();
						}
						}
					}
					this.state = 663;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 58, this._ctx);
				}
				this.state = 665;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 664;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 669;
			this.match(SolidCashParser.T__49);
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
	public errorParameter(): ErrorParameterContext {
		let localctx: ErrorParameterContext = new ErrorParameterContext(this, this._ctx, this.state);
		this.enterRule(localctx, 50, SolidCashParser.RULE_errorParameter);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 672;
			this.typeName();
			this.state = 674;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 673;
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
			this.state = 676;
			this.match(SolidCashParser.T__52);
			this.state = 677;
			this.match(SolidCashParser.Identifier);
			this.state = 678;
			this.match(SolidCashParser.T__3);
			this.state = 680;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 679;
				this.structField();
				}
				}
				this.state = 682;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180);
			this.state = 684;
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
			this.state = 689;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 63, this._ctx) ) {
			case 1:
				{
				this.state = 686;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 687;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 688;
				this.mappingType();
				}
				break;
			}
			this.state = 691;
			this.anyIdentifier();
			this.state = 692;
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
			this.state = 694;
			this.match(SolidCashParser.T__53);
			this.state = 695;
			this.match(SolidCashParser.Identifier);
			this.state = 696;
			this.match(SolidCashParser.T__3);
			this.state = 697;
			this.enumMember();
			this.state = 702;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 64, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 698;
					this.match(SolidCashParser.T__4);
					this.state = 699;
					this.enumMember();
					}
					}
				}
				this.state = 704;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 64, this._ctx);
			}
			this.state = 706;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 705;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 708;
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
			this.state = 710;
			this.match(SolidCashParser.Identifier);
			this.state = 713;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 711;
				this.match(SolidCashParser.T__39);
				this.state = 712;
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
			this.state = 715;
			this.match(SolidCashParser.T__54);
			this.state = 716;
			this.match(SolidCashParser.Identifier);
			this.state = 717;
			this.match(SolidCashParser.T__41);
			this.state = 718;
			this.typeName();
			this.state = 719;
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
			this.state = 721;
			this.typeName();
			this.state = 722;
			this.match(SolidCashParser.T__55);
			this.state = 723;
			this.match(SolidCashParser.Identifier);
			this.state = 724;
			this.match(SolidCashParser.T__39);
			this.state = 725;
			this.expression(0);
			this.state = 726;
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
			this.state = 728;
			this.match(SolidCashParser.T__56);
			this.state = 729;
			this.parameterList();
			this.state = 733;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 98307) !== 0)) {
				{
				{
				this.state = 730;
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
				this.state = 735;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 739;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 736;
				this.parentInvocation();
				}
				}
				this.state = 741;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 742;
			this.match(SolidCashParser.T__3);
			this.state = 746;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
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
	public fallbackDefinition(): FallbackDefinitionContext {
		let localctx: FallbackDefinitionContext = new FallbackDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 66, SolidCashParser.RULE_fallbackDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 751;
			this.match(SolidCashParser.T__59);
			this.state = 752;
			this.parameterList();
			this.state = 753;
			this.match(SolidCashParser.T__43);
			this.state = 757;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 8197) !== 0)) {
				{
				{
				this.state = 754;
				this.fallbackModifier();
				}
				}
				this.state = 759;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 763;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 760;
				this.customModifierInvocation();
				}
				}
				this.state = 765;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 766;
			this.match(SolidCashParser.T__3);
			this.state = 770;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 767;
				this.statement();
				}
				}
				this.state = 772;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 773;
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
			this.state = 778;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 59:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 775;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 776;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
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
	public receiveDefinition(): ReceiveDefinitionContext {
		let localctx: ReceiveDefinitionContext = new ReceiveDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 70, SolidCashParser.RULE_receiveDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 780;
			this.match(SolidCashParser.T__61);
			this.state = 781;
			this.match(SolidCashParser.T__48);
			this.state = 782;
			this.match(SolidCashParser.T__49);
			this.state = 783;
			this.match(SolidCashParser.T__43);
			this.state = 784;
			this.match(SolidCashParser.T__58);
			this.state = 785;
			this.match(SolidCashParser.T__3);
			this.state = 789;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 786;
				this.statement();
				}
				}
				this.state = 791;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 792;
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
			this.state = 794;
			this.match(SolidCashParser.Identifier);
			this.state = 795;
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
			this.state = 865;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 86, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 798;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 797;
					this.stateVariableVisibility();
					}
				}

				this.state = 800;
				this.typeName();
				this.state = 804;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 801;
					this.modifier();
					}
					}
					this.state = 806;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 807;
				this.match(SolidCashParser.Identifier);
				this.state = 810;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 808;
					this.match(SolidCashParser.T__39);
					this.state = 809;
					this.expression(0);
					}
				}

				this.state = 812;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 814;
				this.typeName();
				this.state = 818;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 815;
					this.modifier();
					}
					}
					this.state = 820;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 821;
				this.stateVariableVisibility();
				this.state = 825;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 822;
					this.modifier();
					}
					}
					this.state = 827;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 828;
				this.match(SolidCashParser.Identifier);
				this.state = 831;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 829;
					this.match(SolidCashParser.T__39);
					this.state = 830;
					this.expression(0);
					}
				}

				this.state = 833;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 836;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 835;
					this.stateVariableVisibility();
					}
				}

				this.state = 838;
				this.mappingType();
				this.state = 842;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 839;
					this.collectionModifier();
					}
					}
					this.state = 844;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 845;
				this.match(SolidCashParser.Identifier);
				this.state = 846;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 849;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 848;
					this.stateVariableVisibility();
					}
				}

				this.state = 851;
				this.arrayType(0);
				this.state = 855;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 852;
					this.collectionModifier();
					}
					}
					this.state = 857;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 858;
				this.match(SolidCashParser.Identifier);
				this.state = 861;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 859;
					this.match(SolidCashParser.T__39);
					this.state = 860;
					this.expression(0);
					}
				}

				this.state = 863;
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
			this.state = 869;
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
				this.state = 867;
				this.modifier();
				}
				break;
			case 43:
			case 44:
			case 58:
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 868;
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
			this.state = 871;
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
			this.state = 909;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 93, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 873;
				this.match(SolidCashParser.T__63);
				this.state = 874;
				this.match(SolidCashParser.T__48);
				this.state = 875;
				this.typeName();
				this.state = 877;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 876;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 879;
				this.match(SolidCashParser.T__64);
				this.state = 880;
				this.typeName();
				this.state = 882;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 881;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 884;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
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
				this.mappingType();
				this.state = 894;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 896;
				this.match(SolidCashParser.T__63);
				this.state = 897;
				this.match(SolidCashParser.T__48);
				this.state = 898;
				this.typeName();
				this.state = 900;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 899;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 902;
				this.match(SolidCashParser.T__64);
				this.state = 903;
				this.arrayType(0);
				this.state = 905;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 904;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 907;
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
			this.state = 921;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 94, this._ctx) ) {
			case 1:
				{
				this.state = 912;
				this.typeName();
				this.state = 913;
				this.match(SolidCashParser.T__65);
				this.state = 914;
				_la = this._input.LA(1);
				if(!(_la===145 || _la===180)) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 915;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 2:
				{
				this.state = 917;
				this.typeName();
				this.state = 918;
				this.match(SolidCashParser.T__65);
				this.state = 919;
				this.match(SolidCashParser.T__66);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 932;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 96, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 930;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 95, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 923;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 924;
						this.match(SolidCashParser.T__65);
						this.state = 925;
						_la = this._input.LA(1);
						if(!(_la===145 || _la===180)) {
						this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 926;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 927;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 928;
						this.match(SolidCashParser.T__65);
						this.state = 929;
						this.match(SolidCashParser.T__66);
						}
						break;
					}
					}
				}
				this.state = 934;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 96, this._ctx);
			}
			}
		}
		catch (re) {
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
			this.state = 935;
			this.match(SolidCashParser.T__67);
			this.state = 936;
			this.match(SolidCashParser.Identifier);
			this.state = 938;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 937;
				this.parameterList();
				}
			}

			this.state = 940;
			this.match(SolidCashParser.T__3);
			this.state = 944;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 941;
				this.modifierStatement();
				}
				}
				this.state = 946;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 947;
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
			this.state = 951;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 99, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 949;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 950;
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
		this.enterRule(localctx, 88, SolidCashParser.RULE_placeholderStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 953;
			this.match(SolidCashParser.T__68);
			this.state = 954;
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
			this.state = 956;
			this.match(SolidCashParser.T__6);
			this.state = 957;
			this.anyIdentifier();
			this.state = 958;
			this.parameterList();
			this.state = 963;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0) || _la===180) {
				{
				this.state = 961;
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
					this.state = 959;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 960;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 965;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 967;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 966;
				this.returnType();
				}
			}

			this.state = 969;
			this.match(SolidCashParser.T__3);
			this.state = 973;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 970;
				this.statement();
				}
				}
				this.state = 975;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 976;
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
			this.state = 978;
			this.match(SolidCashParser.Identifier);
			this.state = 980;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 979;
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
			this.state = 996;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 70:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 982;
				this.match(SolidCashParser.T__69);
				}
				break;
			case 71:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 983;
				this.match(SolidCashParser.T__70);
				}
				break;
			case 58:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 984;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 44:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 985;
				this.match(SolidCashParser.T__43);
				}
				break;
			case 43:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 986;
				this.match(SolidCashParser.T__42);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 987;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 59:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 988;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 989;
				this.overrideSpecifier();
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 990;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 991;
				this.unsafeModifier();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 992;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 993;
				this.match(SolidCashParser.T__27);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 994;
				this.match(SolidCashParser.T__30);
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 995;
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
			this.state = 998;
			this.match(SolidCashParser.T__71);
			this.state = 1009;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 999;
				this.match(SolidCashParser.T__48);
				this.state = 1000;
				this.match(SolidCashParser.Identifier);
				this.state = 1005;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1001;
					this.match(SolidCashParser.T__4);
					this.state = 1002;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1007;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1008;
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
			this.state = 1011;
			this.match(SolidCashParser.T__31);
			this.state = 1015;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 1012;
				this.match(SolidCashParser.T__48);
				this.state = 1013;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1014;
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
			this.state = 1017;
			this.match(SolidCashParser.T__72);
			this.state = 1018;
			this.match(SolidCashParser.T__48);
			this.state = 1019;
			this.returnParam();
			this.state = 1024;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 109, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1020;
					this.match(SolidCashParser.T__4);
					this.state = 1021;
					this.returnParam();
					}
					}
				}
				this.state = 1026;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 109, this._ctx);
			}
			this.state = 1028;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1027;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1030;
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
			this.state = 1052;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 115, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1032;
				this.typeName();
				this.state = 1036;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 111, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1033;
						this.modifier();
						}
						}
					}
					this.state = 1038;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 111, this._ctx);
				}
				this.state = 1040;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1039;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1042;
				this.arrayType(0);
				this.state = 1046;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 113, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1043;
						this.modifier();
						}
						}
					}
					this.state = 1048;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 113, this._ctx);
				}
				this.state = 1050;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1049;
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
			this.state = 1054;
			this.match(SolidCashParser.T__48);
			this.state = 1066;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1055;
				this.parameter();
				this.state = 1060;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 116, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1056;
						this.match(SolidCashParser.T__4);
						this.state = 1057;
						this.parameter();
						}
						}
					}
					this.state = 1062;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 116, this._ctx);
				}
				this.state = 1064;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1063;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1068;
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
			this.state = 1100;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 125, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1070;
				this.typeName();
				this.state = 1074;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 119, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1071;
						this.modifier();
						}
						}
					}
					this.state = 1076;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 119, this._ctx);
				}
				this.state = 1078;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1077;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1080;
				this.arrayType(0);
				this.state = 1084;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 121, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1081;
						this.modifier();
						}
						}
					}
					this.state = 1086;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 121, this._ctx);
				}
				this.state = 1088;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1087;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1090;
				this.mappingType();
				this.state = 1094;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 123, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1091;
						this.modifier();
						}
						}
					}
					this.state = 1096;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 123, this._ctx);
				}
				this.state = 1098;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1097;
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
			this.state = 1111;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1102;
				this.match(SolidCashParser.T__3);
				this.state = 1106;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
					{
					{
					this.state = 1103;
					this.statement();
					}
					}
					this.state = 1108;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1109;
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
				this.state = 1110;
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
			this.state = 1145;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 128, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1113;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1114;
				this.variableDefinition();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1115;
				this.tupleAssignment();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1116;
				this.arrayPushStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1117;
				this.arrayPopStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1118;
				this.arrayDeleteStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1119;
				this.stateArrayPushStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1120;
				this.stateArrayPopStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1121;
				this.assignStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1122;
				this.assignmentStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1123;
				this.mappingDeleteStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1124;
				this.timeOpStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1125;
				this.requireStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1126;
				this.ifStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1127;
				this.loopStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1128;
				this.consoleStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1129;
				this.emitStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1130;
				this.transferStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1131;
				this.tokenContainerMethodStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1132;
				this.returnStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1133;
				this.functionCallStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1134;
				this.addressMethodStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1135;
				this.selfdestructStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1136;
				this.assemblyStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1137;
				this.tryCatchStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1138;
				this.revertStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1139;
				this.assertStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1140;
				this.deleteStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1141;
				this.uncheckedStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1142;
				this.switchStatement();
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 31);
				{
				this.state = 1143;
				this.breakStatement();
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 32);
				{
				this.state = 1144;
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
			this.state = 1147;
			this.match(SolidCashParser.T__73);
			this.state = 1148;
			this.match(SolidCashParser.T__11);
			this.state = 1149;
			this.match(SolidCashParser.Identifier);
			this.state = 1150;
			this.match(SolidCashParser.T__48);
			this.state = 1151;
			this.expression(0);
			this.state = 1152;
			this.match(SolidCashParser.T__4);
			this.state = 1153;
			this.expression(0);
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
	public tokenContainerMethodStatement(): TokenContainerMethodStatementContext {
		let localctx: TokenContainerMethodStatementContext = new TokenContainerMethodStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 114, SolidCashParser.RULE_tokenContainerMethodStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1157;
			this.match(SolidCashParser.T__73);
			this.state = 1158;
			this.match(SolidCashParser.T__11);
			this.state = 1159;
			this.match(SolidCashParser.Identifier);
			this.state = 1160;
			this.match(SolidCashParser.T__65);
			this.state = 1161;
			this.expression(0);
			this.state = 1162;
			this.match(SolidCashParser.T__66);
			this.state = 1163;
			this.match(SolidCashParser.T__11);
			this.state = 1164;
			this.match(SolidCashParser.Identifier);
			this.state = 1165;
			this.match(SolidCashParser.T__48);
			this.state = 1166;
			this.expression(0);
			this.state = 1171;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1167;
				this.match(SolidCashParser.T__4);
				this.state = 1168;
				this.expression(0);
				}
				}
				this.state = 1173;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1174;
			this.match(SolidCashParser.T__49);
			this.state = 1175;
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
			this.state = 1206;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 133, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1177;
				this.match(SolidCashParser.T__74);
				this.state = 1178;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1179;
				this.match(SolidCashParser.T__74);
				this.state = 1180;
				this.expression(0);
				this.state = 1185;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1181;
					this.match(SolidCashParser.T__4);
					this.state = 1182;
					this.expression(0);
					}
					}
					this.state = 1187;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1188;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1190;
				this.match(SolidCashParser.T__74);
				this.state = 1191;
				this.match(SolidCashParser.T__48);
				this.state = 1192;
				this.expression(0);
				this.state = 1197;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 131, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1193;
						this.match(SolidCashParser.T__4);
						this.state = 1194;
						this.expression(0);
						}
						}
					}
					this.state = 1199;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 131, this._ctx);
				}
				this.state = 1201;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1200;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1203;
				this.match(SolidCashParser.T__49);
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
	public functionCallStatement(): FunctionCallStatementContext {
		let localctx: FunctionCallStatementContext = new FunctionCallStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 118, SolidCashParser.RULE_functionCallStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1253;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 139, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1208;
				this.match(SolidCashParser.Identifier);
				this.state = 1211;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1209;
					this.match(SolidCashParser.T__11);
					this.state = 1210;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1213;
				this.match(SolidCashParser.T__48);
				this.state = 1214;
				this.match(SolidCashParser.T__3);
				this.state = 1226;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1215;
					this.namedArg();
					this.state = 1220;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 135, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1216;
							this.match(SolidCashParser.T__4);
							this.state = 1217;
							this.namedArg();
							}
							}
						}
						this.state = 1222;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 135, this._ctx);
					}
					this.state = 1224;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1223;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1228;
				this.match(SolidCashParser.T__5);
				this.state = 1229;
				this.match(SolidCashParser.T__49);
				this.state = 1230;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1231;
				this.match(SolidCashParser.Identifier);
				this.state = 1232;
				this.expressionList();
				this.state = 1233;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1235;
				this.match(SolidCashParser.Identifier);
				this.state = 1236;
				this.match(SolidCashParser.T__11);
				this.state = 1237;
				this.match(SolidCashParser.Identifier);
				this.state = 1238;
				this.expressionList();
				this.state = 1239;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1241;
				this.match(SolidCashParser.Identifier);
				this.state = 1242;
				this.expressionList();
				this.state = 1243;
				this.match(SolidCashParser.T__11);
				this.state = 1244;
				this.match(SolidCashParser.Identifier);
				this.state = 1245;
				this.match(SolidCashParser.T__11);
				this.state = 1246;
				this.match(SolidCashParser.Identifier);
				this.state = 1248;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1247;
					this.callOptions();
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
	public addressMethodStatement(): AddressMethodStatementContext {
		let localctx: AddressMethodStatementContext = new AddressMethodStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 120, SolidCashParser.RULE_addressMethodStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1255;
			this.expression(0);
			this.state = 1256;
			this.match(SolidCashParser.T__11);
			this.state = 1257;
			this.match(SolidCashParser.Identifier);
			this.state = 1259;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===4) {
				{
				this.state = 1258;
				this.callOptions();
				}
			}

			this.state = 1261;
			this.expressionList();
			this.state = 1262;
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
			this.state = 1264;
			this.match(SolidCashParser.T__30);
			this.state = 1265;
			this.match(SolidCashParser.T__48);
			this.state = 1266;
			this.expression(0);
			this.state = 1267;
			this.match(SolidCashParser.T__49);
			this.state = 1268;
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
			this.state = 1303;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 146, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1270;
				this.match(SolidCashParser.T__75);
				this.state = 1271;
				this.match(SolidCashParser.Identifier);
				this.state = 1274;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1272;
					this.match(SolidCashParser.T__11);
					this.state = 1273;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1276;
				this.match(SolidCashParser.T__48);
				this.state = 1277;
				this.match(SolidCashParser.T__3);
				this.state = 1289;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1278;
					this.namedArg();
					this.state = 1283;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 142, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1279;
							this.match(SolidCashParser.T__4);
							this.state = 1280;
							this.namedArg();
							}
							}
						}
						this.state = 1285;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 142, this._ctx);
					}
					this.state = 1287;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1286;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1291;
				this.match(SolidCashParser.T__5);
				this.state = 1292;
				this.match(SolidCashParser.T__49);
				this.state = 1293;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1294;
				this.match(SolidCashParser.T__75);
				this.state = 1295;
				this.match(SolidCashParser.Identifier);
				this.state = 1298;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1296;
					this.match(SolidCashParser.T__11);
					this.state = 1297;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1300;
				this.expressionList();
				this.state = 1301;
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
			this.state = 1423;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 161, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1305;
				this.match(SolidCashParser.T__73);
				this.state = 1306;
				this.match(SolidCashParser.T__11);
				this.state = 1307;
				this.match(SolidCashParser.Identifier);
				this.state = 1316;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===66) {
					{
					this.state = 1312;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1308;
						this.match(SolidCashParser.T__65);
						this.state = 1309;
						this.expression(0);
						this.state = 1310;
						this.match(SolidCashParser.T__66);
						}
						}
						this.state = 1314;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===66);
					}
				}

				this.state = 1321;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12 || _la===163) {
					{
					{
					this.state = 1318;
					this.lvMember();
					}
					}
					this.state = 1323;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1324;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1325;
				this.expression(0);
				this.state = 1326;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1328;
				this.match(SolidCashParser.Identifier);
				this.state = 1333;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1329;
					this.match(SolidCashParser.T__65);
					this.state = 1330;
					this.expression(0);
					this.state = 1331;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1335;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1340;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12 || _la===163) {
					{
					{
					this.state = 1337;
					this.lvMember();
					}
					}
					this.state = 1342;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1343;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1344;
				this.expression(0);
				this.state = 1345;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1347;
				this.match(SolidCashParser.Identifier);
				this.state = 1349;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1348;
					this.lvMember();
					}
					}
					this.state = 1351;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12 || _la===163);
				this.state = 1353;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1354;
				this.expression(0);
				this.state = 1355;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1357;
				this.match(SolidCashParser.Identifier);
				this.state = 1359;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1358;
					this.lvMember();
					}
					}
					this.state = 1361;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12 || _la===163);
				this.state = 1367;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1363;
					this.match(SolidCashParser.T__65);
					this.state = 1364;
					this.expression(0);
					this.state = 1365;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1369;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1371;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1372;
				this.expression(0);
				this.state = 1373;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1375;
				this.match(SolidCashParser.T__73);
				this.state = 1376;
				this.match(SolidCashParser.T__11);
				this.state = 1377;
				this.match(SolidCashParser.Identifier);
				this.state = 1386;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===66) {
					{
					this.state = 1382;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1378;
						this.match(SolidCashParser.T__65);
						this.state = 1379;
						this.expression(0);
						this.state = 1380;
						this.match(SolidCashParser.T__66);
						}
						}
						this.state = 1384;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===66);
					}
				}

				this.state = 1391;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12 || _la===163) {
					{
					{
					this.state = 1388;
					this.lvMember();
					}
					}
					this.state = 1393;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1394;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
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
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1396;
				this.match(SolidCashParser.Identifier);
				this.state = 1401;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1397;
					this.match(SolidCashParser.T__65);
					this.state = 1398;
					this.expression(0);
					this.state = 1399;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1403;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1408;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12 || _la===163) {
					{
					{
					this.state = 1405;
					this.lvMember();
					}
					}
					this.state = 1410;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1411;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1412;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1414;
				this.match(SolidCashParser.Identifier);
				this.state = 1416;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1415;
					this.lvMember();
					}
					}
					this.state = 1418;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12 || _la===163);
				this.state = 1420;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1421;
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
	public lvMember(): LvMemberContext {
		let localctx: LvMemberContext = new LvMemberContext(this, this._ctx, this.state);
		this.enterRule(localctx, 128, SolidCashParser.RULE_lvMember);
		try {
			this.state = 1428;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1425;
				this.match(SolidCashParser.T__11);
				this.state = 1426;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1427;
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
	public mappingDeleteStatement(): MappingDeleteStatementContext {
		let localctx: MappingDeleteStatementContext = new MappingDeleteStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 130, SolidCashParser.RULE_mappingDeleteStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1430;
			this.match(SolidCashParser.T__73);
			this.state = 1431;
			this.match(SolidCashParser.T__11);
			this.state = 1432;
			this.match(SolidCashParser.Identifier);
			this.state = 1439;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===66) {
				{
				{
				this.state = 1433;
				this.match(SolidCashParser.T__65);
				this.state = 1434;
				this.expression(0);
				this.state = 1435;
				this.match(SolidCashParser.T__66);
				}
				}
				this.state = 1441;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1442;
			this.match(SolidCashParser.DotDelete);
			this.state = 1443;
			this.match(SolidCashParser.T__48);
			this.state = 1444;
			this.expression(0);
			this.state = 1445;
			this.match(SolidCashParser.T__49);
			this.state = 1446;
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
		this.enterRule(localctx, 132, SolidCashParser.RULE_variableDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1476;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 168, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1448;
				this.typeName();
				this.state = 1452;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 164, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1449;
						this.modifier();
						}
						}
					}
					this.state = 1454;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 164, this._ctx);
				}
				this.state = 1455;
				this.anyIdentifier();
				this.state = 1458;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1456;
					this.match(SolidCashParser.T__39);
					this.state = 1457;
					this.expression(0);
					}
				}

				this.state = 1460;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1462;
				this.arrayType(0);
				this.state = 1466;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1463;
						this.modifier();
						}
						}
					}
					this.state = 1468;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
				}
				this.state = 1469;
				this.anyIdentifier();
				this.state = 1472;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1470;
					this.match(SolidCashParser.T__39);
					this.state = 1471;
					this.expression(0);
					}
				}

				this.state = 1474;
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
		this.enterRule(localctx, 134, SolidCashParser.RULE_tupleAssignment);
		let _la: number;
		try {
			this.state = 1526;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 173, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1478;
				this.typeName();
				this.state = 1479;
				this.match(SolidCashParser.Identifier);
				this.state = 1484;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1480;
					this.match(SolidCashParser.T__4);
					this.state = 1481;
					this.typeName();
					this.state = 1482;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1486;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1488;
				this.match(SolidCashParser.T__39);
				this.state = 1489;
				this.expression(0);
				this.state = 1490;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1492;
				this.match(SolidCashParser.T__48);
				this.state = 1493;
				this.tupleSlot();
				this.state = 1496;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1494;
					this.match(SolidCashParser.T__4);
					this.state = 1495;
					this.tupleSlot();
					}
					}
					this.state = 1498;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1500;
				this.match(SolidCashParser.T__49);
				this.state = 1501;
				this.match(SolidCashParser.T__39);
				this.state = 1502;
				this.match(SolidCashParser.T__48);
				this.state = 1503;
				this.expression(0);
				this.state = 1506;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1504;
					this.match(SolidCashParser.T__4);
					this.state = 1505;
					this.expression(0);
					}
					}
					this.state = 1508;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1510;
				this.match(SolidCashParser.T__49);
				this.state = 1511;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1513;
				this.match(SolidCashParser.T__48);
				this.state = 1514;
				this.tupleSlot();
				this.state = 1517;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1515;
					this.match(SolidCashParser.T__4);
					this.state = 1516;
					this.tupleSlot();
					}
					}
					this.state = 1519;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1521;
				this.match(SolidCashParser.T__49);
				this.state = 1522;
				this.match(SolidCashParser.T__39);
				this.state = 1523;
				this.expression(0);
				this.state = 1524;
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
		this.enterRule(localctx, 136, SolidCashParser.RULE_tupleSlot);
		try {
			let _alt: number;
			this.state = 1539;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 175, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1528;
				this.typeName();
				this.state = 1532;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 174, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1529;
						this.modifier();
						}
						}
					}
					this.state = 1534;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 174, this._ctx);
				}
				this.state = 1535;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1537;
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
	public assignStatement(): AssignStatementContext {
		let localctx: AssignStatementContext = new AssignStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 138, SolidCashParser.RULE_assignStatement);
		let _la: number;
		try {
			this.state = 1552;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 176, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1541;
				this.match(SolidCashParser.Identifier);
				this.state = 1542;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1543;
				this.expression(0);
				this.state = 1544;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1546;
				this.match(SolidCashParser.Identifier);
				this.state = 1547;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1548;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1549;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1550;
				this.match(SolidCashParser.Identifier);
				this.state = 1551;
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
		this.enterRule(localctx, 140, SolidCashParser.RULE_arrayPushStatement);
		let _la: number;
		try {
			this.state = 1589;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 181, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1554;
				this.match(SolidCashParser.Identifier);
				this.state = 1555;
				this.match(SolidCashParser.DotPush);
				this.state = 1556;
				this.match(SolidCashParser.T__48);
				this.state = 1558;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 1557;
					this.pushArgument();
					}
				}

				this.state = 1560;
				this.match(SolidCashParser.T__49);
				this.state = 1561;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1562;
				this.match(SolidCashParser.Identifier);
				this.state = 1563;
				this.match(SolidCashParser.T__11);
				this.state = 1564;
				this.match(SolidCashParser.Identifier);
				this.state = 1565;
				this.match(SolidCashParser.DotPush);
				this.state = 1566;
				this.match(SolidCashParser.T__48);
				this.state = 1568;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 1567;
					this.pushArgument();
					}
				}

				this.state = 1570;
				this.match(SolidCashParser.T__49);
				this.state = 1571;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
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
				this.match(SolidCashParser.DotPush);
				this.state = 1582;
				this.match(SolidCashParser.T__48);
				this.state = 1584;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 1583;
					this.pushArgument();
					}
				}

				this.state = 1586;
				this.match(SolidCashParser.T__49);
				this.state = 1587;
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
	public pushArgument(): PushArgumentContext {
		let localctx: PushArgumentContext = new PushArgumentContext(this, this._ctx, this.state);
		this.enterRule(localctx, 142, SolidCashParser.RULE_pushArgument);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1591;
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
	public arrayPopStatement(): ArrayPopStatementContext {
		let localctx: ArrayPopStatementContext = new ArrayPopStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 144, SolidCashParser.RULE_arrayPopStatement);
		let _la: number;
		try {
			this.state = 1619;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 183, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1593;
				this.match(SolidCashParser.Identifier);
				this.state = 1594;
				this.match(SolidCashParser.DotPop);
				this.state = 1595;
				this.match(SolidCashParser.T__48);
				this.state = 1596;
				this.match(SolidCashParser.T__49);
				this.state = 1597;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1598;
				this.match(SolidCashParser.Identifier);
				this.state = 1599;
				this.match(SolidCashParser.T__11);
				this.state = 1600;
				this.match(SolidCashParser.Identifier);
				this.state = 1601;
				this.match(SolidCashParser.DotPop);
				this.state = 1602;
				this.match(SolidCashParser.T__48);
				this.state = 1603;
				this.match(SolidCashParser.T__49);
				this.state = 1604;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1605;
				this.match(SolidCashParser.Identifier);
				this.state = 1610;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1606;
					this.match(SolidCashParser.T__65);
					this.state = 1607;
					this.expression(0);
					this.state = 1608;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1612;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1614;
				this.match(SolidCashParser.DotPop);
				this.state = 1615;
				this.match(SolidCashParser.T__48);
				this.state = 1616;
				this.match(SolidCashParser.T__49);
				this.state = 1617;
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
		this.enterRule(localctx, 146, SolidCashParser.RULE_arrayDeleteStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1621;
			this.match(SolidCashParser.Identifier);
			this.state = 1622;
			this.match(SolidCashParser.DotDelete);
			this.state = 1623;
			this.match(SolidCashParser.T__48);
			this.state = 1624;
			this.expression(0);
			this.state = 1625;
			this.match(SolidCashParser.T__49);
			this.state = 1626;
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
		this.enterRule(localctx, 148, SolidCashParser.RULE_stateArrayPushStatement);
		let _la: number;
		try {
			this.state = 1669;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 188, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1628;
				this.match(SolidCashParser.T__73);
				this.state = 1629;
				this.match(SolidCashParser.T__11);
				this.state = 1630;
				this.match(SolidCashParser.Identifier);
				this.state = 1631;
				this.match(SolidCashParser.DotPush);
				this.state = 1632;
				this.match(SolidCashParser.T__48);
				this.state = 1634;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 1633;
					this.pushArgument();
					}
				}

				this.state = 1636;
				this.match(SolidCashParser.T__49);
				this.state = 1637;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1638;
				this.match(SolidCashParser.T__73);
				this.state = 1639;
				this.match(SolidCashParser.T__11);
				this.state = 1640;
				this.match(SolidCashParser.Identifier);
				this.state = 1645;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1641;
					this.match(SolidCashParser.T__65);
					this.state = 1642;
					this.expression(0);
					this.state = 1643;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1647;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1649;
				this.match(SolidCashParser.DotPush);
				this.state = 1650;
				this.match(SolidCashParser.T__48);
				this.state = 1652;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 1651;
					this.pushArgument();
					}
				}

				this.state = 1654;
				this.match(SolidCashParser.T__49);
				this.state = 1655;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1657;
				this.match(SolidCashParser.T__73);
				this.state = 1658;
				this.match(SolidCashParser.T__11);
				this.state = 1659;
				this.match(SolidCashParser.Identifier);
				this.state = 1660;
				this.match(SolidCashParser.T__11);
				this.state = 1661;
				this.match(SolidCashParser.Identifier);
				this.state = 1662;
				this.match(SolidCashParser.DotPush);
				this.state = 1663;
				this.match(SolidCashParser.T__48);
				this.state = 1665;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 1664;
					this.pushArgument();
					}
				}

				this.state = 1667;
				this.match(SolidCashParser.T__49);
				this.state = 1668;
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
	public stateArrayPopStatement(): StateArrayPopStatementContext {
		let localctx: StateArrayPopStatementContext = new StateArrayPopStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 150, SolidCashParser.RULE_stateArrayPopStatement);
		let _la: number;
		try {
			this.state = 1703;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 190, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1671;
				this.match(SolidCashParser.T__73);
				this.state = 1672;
				this.match(SolidCashParser.T__11);
				this.state = 1673;
				this.match(SolidCashParser.Identifier);
				this.state = 1674;
				this.match(SolidCashParser.DotPop);
				this.state = 1675;
				this.match(SolidCashParser.T__48);
				this.state = 1676;
				this.match(SolidCashParser.T__49);
				this.state = 1677;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1678;
				this.match(SolidCashParser.T__73);
				this.state = 1679;
				this.match(SolidCashParser.T__11);
				this.state = 1680;
				this.match(SolidCashParser.Identifier);
				this.state = 1685;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1681;
					this.match(SolidCashParser.T__65);
					this.state = 1682;
					this.expression(0);
					this.state = 1683;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1687;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1689;
				this.match(SolidCashParser.DotPop);
				this.state = 1690;
				this.match(SolidCashParser.T__48);
				this.state = 1691;
				this.match(SolidCashParser.T__49);
				this.state = 1692;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1694;
				this.match(SolidCashParser.T__73);
				this.state = 1695;
				this.match(SolidCashParser.T__11);
				this.state = 1696;
				this.match(SolidCashParser.Identifier);
				this.state = 1697;
				this.match(SolidCashParser.T__11);
				this.state = 1698;
				this.match(SolidCashParser.Identifier);
				this.state = 1699;
				this.match(SolidCashParser.DotPop);
				this.state = 1700;
				this.match(SolidCashParser.T__48);
				this.state = 1701;
				this.match(SolidCashParser.T__49);
				this.state = 1702;
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
	public deleteStatement(): DeleteStatementContext {
		let localctx: DeleteStatementContext = new DeleteStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 152, SolidCashParser.RULE_deleteStatement);
		let _la: number;
		try {
			this.state = 1757;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 195, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1705;
				this.match(SolidCashParser.T__88);
				this.state = 1706;
				this.match(SolidCashParser.Identifier);
				this.state = 1707;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1708;
				this.match(SolidCashParser.T__88);
				this.state = 1709;
				this.match(SolidCashParser.T__73);
				this.state = 1710;
				this.match(SolidCashParser.T__11);
				this.state = 1711;
				this.match(SolidCashParser.Identifier);
				this.state = 1712;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1713;
				this.match(SolidCashParser.T__88);
				this.state = 1714;
				this.match(SolidCashParser.T__73);
				this.state = 1715;
				this.match(SolidCashParser.T__11);
				this.state = 1716;
				this.match(SolidCashParser.Identifier);
				this.state = 1721;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1717;
					this.match(SolidCashParser.T__65);
					this.state = 1718;
					this.expression(0);
					this.state = 1719;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1723;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1725;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1727;
				this.match(SolidCashParser.T__88);
				this.state = 1728;
				this.match(SolidCashParser.Identifier);
				this.state = 1733;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1729;
					this.match(SolidCashParser.T__65);
					this.state = 1730;
					this.expression(0);
					this.state = 1731;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1735;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1737;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				localctx = new DeleteMemberEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1739;
				this.match(SolidCashParser.T__88);
				this.state = 1740;
				this.match(SolidCashParser.Identifier);
				this.state = 1743;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1741;
					this.match(SolidCashParser.T__11);
					this.state = 1742;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1745;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1751;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1747;
					this.match(SolidCashParser.T__65);
					this.state = 1748;
					this.expression(0);
					this.state = 1749;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1753;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1755;
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
		this.enterRule(localctx, 154, SolidCashParser.RULE_timeOpStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1759;
			this.match(SolidCashParser.T__89);
			this.state = 1760;
			this.match(SolidCashParser.T__48);
			this.state = 1761;
			this.match(SolidCashParser.TxVar);
			this.state = 1762;
			this.match(SolidCashParser.T__22);
			this.state = 1763;
			this.expression(0);
			this.state = 1766;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1764;
				this.match(SolidCashParser.T__4);
				this.state = 1765;
				this.requireMessage();
				}
			}

			this.state = 1768;
			this.match(SolidCashParser.T__49);
			this.state = 1769;
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
		this.enterRule(localctx, 156, SolidCashParser.RULE_requireStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1771;
			this.match(SolidCashParser.T__89);
			this.state = 1772;
			this.match(SolidCashParser.T__48);
			this.state = 1773;
			this.expression(0);
			this.state = 1776;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1774;
				this.match(SolidCashParser.T__4);
				this.state = 1775;
				this.requireMessage();
				}
			}

			this.state = 1778;
			this.match(SolidCashParser.T__49);
			this.state = 1779;
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
		this.enterRule(localctx, 158, SolidCashParser.RULE_ifStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1781;
			this.match(SolidCashParser.T__90);
			this.state = 1782;
			this.match(SolidCashParser.T__48);
			this.state = 1783;
			this.expression(0);
			this.state = 1784;
			this.match(SolidCashParser.T__49);
			this.state = 1785;
			localctx._ifBlock = this.block();
			this.state = 1788;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 198, this._ctx) ) {
			case 1:
				{
				this.state = 1786;
				this.match(SolidCashParser.T__91);
				this.state = 1787;
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
		this.enterRule(localctx, 160, SolidCashParser.RULE_loopStatement);
		try {
			this.state = 1796;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 199, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1790;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1791;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1792;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1793;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1794;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1795;
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
		this.enterRule(localctx, 162, SolidCashParser.RULE_forOfEntriesStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1798;
			this.match(SolidCashParser.T__8);
			this.state = 1799;
			this.match(SolidCashParser.T__48);
			this.state = 1800;
			this.typeName();
			this.state = 1801;
			this.match(SolidCashParser.Identifier);
			this.state = 1802;
			this.match(SolidCashParser.T__4);
			this.state = 1803;
			this.typeName();
			this.state = 1804;
			this.match(SolidCashParser.Identifier);
			this.state = 1805;
			this.match(SolidCashParser.T__92);
			this.state = 1806;
			this.match(SolidCashParser.T__73);
			this.state = 1807;
			this.match(SolidCashParser.T__11);
			this.state = 1808;
			this.match(SolidCashParser.Identifier);
			this.state = 1809;
			this.match(SolidCashParser.T__11);
			this.state = 1810;
			this.match(SolidCashParser.T__33);
			this.state = 1811;
			this.match(SolidCashParser.T__49);
			this.state = 1812;
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
		this.enterRule(localctx, 164, SolidCashParser.RULE_forInStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1814;
			this.match(SolidCashParser.T__8);
			this.state = 1815;
			this.match(SolidCashParser.T__48);
			this.state = 1816;
			this.typeName();
			this.state = 1817;
			this.match(SolidCashParser.Identifier);
			this.state = 1818;
			this.match(SolidCashParser.T__93);
			this.state = 1819;
			this.match(SolidCashParser.T__73);
			this.state = 1820;
			this.match(SolidCashParser.T__11);
			this.state = 1821;
			this.match(SolidCashParser.Identifier);
			this.state = 1822;
			this.match(SolidCashParser.T__49);
			this.state = 1823;
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
		this.enterRule(localctx, 166, SolidCashParser.RULE_forOfStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1825;
			this.match(SolidCashParser.T__8);
			this.state = 1826;
			this.match(SolidCashParser.T__48);
			this.state = 1827;
			this.typeName();
			this.state = 1828;
			this.match(SolidCashParser.Identifier);
			this.state = 1829;
			this.match(SolidCashParser.T__92);
			this.state = 1830;
			this.match(SolidCashParser.T__73);
			this.state = 1831;
			this.match(SolidCashParser.T__11);
			this.state = 1832;
			this.match(SolidCashParser.Identifier);
			this.state = 1833;
			this.match(SolidCashParser.T__49);
			this.state = 1834;
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
		this.enterRule(localctx, 168, SolidCashParser.RULE_forStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1836;
			this.match(SolidCashParser.T__8);
			this.state = 1837;
			this.match(SolidCashParser.T__48);
			this.state = 1838;
			this.forInit();
			this.state = 1839;
			this.forCondition();
			this.state = 1841;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===87 || _la===88 || _la===180) {
				{
				this.state = 1840;
				this.forUpdate();
				}
			}

			this.state = 1843;
			this.match(SolidCashParser.T__49);
			this.state = 1844;
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
		this.enterRule(localctx, 170, SolidCashParser.RULE_forInit);
		let _la: number;
		try {
			this.state = 1866;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 203, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1846;
				this.typeName();
				this.state = 1850;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 1847;
					this.modifier();
					}
					}
					this.state = 1852;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1853;
				this.match(SolidCashParser.Identifier);
				this.state = 1856;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1854;
					this.match(SolidCashParser.T__39);
					this.state = 1855;
					this.expression(0);
					}
				}

				this.state = 1858;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1860;
				this.match(SolidCashParser.Identifier);
				this.state = 1861;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1862;
				this.expression(0);
				this.state = 1863;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1865;
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
		this.enterRule(localctx, 172, SolidCashParser.RULE_forCondition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1868;
			this.expression(0);
			this.state = 1869;
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
		this.enterRule(localctx, 174, SolidCashParser.RULE_forUpdate);
		let _la: number;
		try {
			this.state = 1878;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 204, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1871;
				this.match(SolidCashParser.Identifier);
				this.state = 1872;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1873;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1874;
				this.match(SolidCashParser.Identifier);
				this.state = 1875;
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
				this.state = 1876;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1877;
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
		this.enterRule(localctx, 176, SolidCashParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1880;
			this.match(SolidCashParser.T__94);
			this.state = 1881;
			this.block();
			this.state = 1882;
			this.match(SolidCashParser.T__95);
			this.state = 1883;
			this.match(SolidCashParser.T__48);
			this.state = 1884;
			this.expression(0);
			this.state = 1885;
			this.match(SolidCashParser.T__49);
			this.state = 1886;
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
		this.enterRule(localctx, 178, SolidCashParser.RULE_whileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1888;
			this.match(SolidCashParser.T__95);
			this.state = 1889;
			this.match(SolidCashParser.T__48);
			this.state = 1890;
			this.expression(0);
			this.state = 1891;
			this.match(SolidCashParser.T__49);
			this.state = 1892;
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
		this.enterRule(localctx, 180, SolidCashParser.RULE_consoleStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1894;
			this.match(SolidCashParser.T__96);
			this.state = 1895;
			this.consoleParameterList();
			this.state = 1896;
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
		this.enterRule(localctx, 182, SolidCashParser.RULE_assemblyStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1898;
			this.match(SolidCashParser.T__97);
			this.state = 1899;
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
		this.enterRule(localctx, 184, SolidCashParser.RULE_yulBlock);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1901;
			this.match(SolidCashParser.T__3);
			this.state = 1905;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026534544) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 31) !== 0) || ((((_la - 75)) & ~0x1F) === 0 && ((1 << (_la - 75)) & 788594689) !== 0) || _la===108 || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				{
				this.state = 1902;
				this.yulStatement();
				}
				}
				this.state = 1907;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1908;
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
		this.enterRule(localctx, 186, SolidCashParser.RULE_yulStatement);
		try {
			this.state = 1923;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 206, this._ctx) ) {
			case 1:
				localctx = new YulNestedBlockStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1910;
				this.yulBlock();
				}
				break;
			case 2:
				localctx = new YulVarDeclStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1911;
				this.yulVariableDeclaration();
				}
				break;
			case 3:
				localctx = new YulAssignStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1912;
				this.yulAssignment();
				}
				break;
			case 4:
				localctx = new YulIfStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1913;
				this.yulIf();
				}
				break;
			case 5:
				localctx = new YulSwitchStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1914;
				this.yulSwitch();
				}
				break;
			case 6:
				localctx = new YulForStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1915;
				this.yulForLoop();
				}
				break;
			case 7:
				localctx = new YulFunctionDefStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1916;
				this.yulFunctionDefinition();
				}
				break;
			case 8:
				localctx = new YulBreakStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1917;
				this.match(SolidCashParser.T__98);
				}
				break;
			case 9:
				localctx = new YulContinueStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1918;
				this.match(SolidCashParser.T__99);
				}
				break;
			case 10:
				localctx = new YulLeaveStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1919;
				this.match(SolidCashParser.T__100);
				}
				break;
			case 11:
				localctx = new YulCallStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1920;
				this.yulFunctionCall();
				}
				break;
			case 12:
				localctx = new YulPathStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1921;
				this.yulPath();
				}
				break;
			case 13:
				localctx = new YulLiteralStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1922;
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
		this.enterRule(localctx, 188, SolidCashParser.RULE_yulVariableDeclaration);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1925;
			this.match(SolidCashParser.T__101);
			this.state = 1926;
			this.anyIdentifier();
			this.state = 1931;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1927;
				this.match(SolidCashParser.T__4);
				this.state = 1928;
				this.anyIdentifier();
				}
				}
				this.state = 1933;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1936;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===103) {
				{
				this.state = 1934;
				this.match(SolidCashParser.T__102);
				this.state = 1935;
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
		this.enterRule(localctx, 190, SolidCashParser.RULE_yulAssignment);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1938;
			this.yulPath();
			this.state = 1943;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1939;
				this.match(SolidCashParser.T__4);
				this.state = 1940;
				this.yulPath();
				}
				}
				this.state = 1945;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1946;
			this.match(SolidCashParser.T__102);
			this.state = 1947;
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
		this.enterRule(localctx, 192, SolidCashParser.RULE_yulIf);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1949;
			this.match(SolidCashParser.T__90);
			this.state = 1950;
			this.yulExpression();
			this.state = 1951;
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
		this.enterRule(localctx, 194, SolidCashParser.RULE_yulSwitch);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1953;
			this.match(SolidCashParser.T__103);
			this.state = 1954;
			this.yulExpression();
			this.state = 1964;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 105:
				{
				this.state = 1956;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1955;
					this.yulCase();
					}
					}
					this.state = 1958;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===105);
				this.state = 1961;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===106) {
					{
					this.state = 1960;
					this.yulDefault();
					}
				}

				}
				break;
			case 106:
				{
				this.state = 1963;
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
		this.enterRule(localctx, 196, SolidCashParser.RULE_yulCase);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1966;
			this.match(SolidCashParser.T__104);
			this.state = 1967;
			this.yulLiteral();
			this.state = 1968;
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
		this.enterRule(localctx, 198, SolidCashParser.RULE_yulDefault);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1970;
			this.match(SolidCashParser.T__105);
			this.state = 1971;
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
		this.enterRule(localctx, 200, SolidCashParser.RULE_yulForLoop);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1973;
			this.match(SolidCashParser.T__8);
			this.state = 1974;
			this.yulBlock();
			this.state = 1975;
			this.yulExpression();
			this.state = 1976;
			this.yulBlock();
			this.state = 1977;
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
		this.enterRule(localctx, 202, SolidCashParser.RULE_yulFunctionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1979;
			this.match(SolidCashParser.T__6);
			this.state = 1980;
			this.match(SolidCashParser.Identifier);
			this.state = 1981;
			this.match(SolidCashParser.T__48);
			this.state = 1990;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 1982;
				this.match(SolidCashParser.Identifier);
				this.state = 1987;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1983;
					this.match(SolidCashParser.T__4);
					this.state = 1984;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1989;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1992;
			this.match(SolidCashParser.T__49);
			this.state = 2002;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===107) {
				{
				this.state = 1993;
				this.match(SolidCashParser.T__106);
				this.state = 1994;
				this.match(SolidCashParser.Identifier);
				this.state = 1999;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1995;
					this.match(SolidCashParser.T__4);
					this.state = 1996;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 2001;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 2004;
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
		this.enterRule(localctx, 204, SolidCashParser.RULE_yulExpression);
		try {
			this.state = 2009;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 217, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2006;
				this.yulFunctionCall();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2007;
				this.yulPath();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2008;
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
		this.enterRule(localctx, 206, SolidCashParser.RULE_yulFunctionCall);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2011;
			this.yulFunctionName();
			this.state = 2012;
			this.match(SolidCashParser.T__48);
			this.state = 2021;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===75 || _la===108 || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				this.state = 2013;
				this.yulExpression();
				this.state = 2018;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 2014;
					this.match(SolidCashParser.T__4);
					this.state = 2015;
					this.yulExpression();
					}
					}
					this.state = 2020;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 2023;
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
		this.enterRule(localctx, 208, SolidCashParser.RULE_yulFunctionName);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2025;
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
		this.enterRule(localctx, 210, SolidCashParser.RULE_yulPath);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2027;
			this.anyIdentifier();
			this.state = 2032;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===12) {
				{
				{
				this.state = 2028;
				this.match(SolidCashParser.T__11);
				this.state = 2029;
				this.anyIdentifier();
				}
				}
				this.state = 2034;
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
		this.enterRule(localctx, 212, SolidCashParser.RULE_yulLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2035;
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
		this.enterRule(localctx, 214, SolidCashParser.RULE_uncheckedStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2037;
			this.match(SolidCashParser.T__108);
			this.state = 2038;
			this.match(SolidCashParser.T__3);
			this.state = 2042;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 2039;
				this.statement();
				}
				}
				this.state = 2044;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 2045;
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
		this.enterRule(localctx, 216, SolidCashParser.RULE_switchStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2047;
			this.match(SolidCashParser.T__103);
			this.state = 2048;
			this.match(SolidCashParser.T__48);
			this.state = 2049;
			this.expression(0);
			this.state = 2050;
			this.match(SolidCashParser.T__49);
			this.state = 2051;
			this.match(SolidCashParser.T__3);
			this.state = 2055;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===105) {
				{
				{
				this.state = 2052;
				this.switchCase();
				}
				}
				this.state = 2057;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 2059;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===106) {
				{
				this.state = 2058;
				this.switchDefault();
				}
			}

			this.state = 2061;
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
		this.enterRule(localctx, 218, SolidCashParser.RULE_switchCase);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2063;
			this.match(SolidCashParser.T__104);
			this.state = 2064;
			this.expression(0);
			this.state = 2065;
			this.match(SolidCashParser.T__109);
			this.state = 2069;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 2066;
				this.statement();
				}
				}
				this.state = 2071;
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
		this.enterRule(localctx, 220, SolidCashParser.RULE_switchDefault);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2072;
			this.match(SolidCashParser.T__105);
			this.state = 2073;
			this.match(SolidCashParser.T__109);
			this.state = 2077;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 2074;
				this.statement();
				}
				}
				this.state = 2079;
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
		this.enterRule(localctx, 222, SolidCashParser.RULE_tryCatchStatement);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2080;
			this.match(SolidCashParser.T__110);
			this.state = 2081;
			this.expression(0);
			this.state = 2083;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 2082;
				this.tryReturns();
				}
			}

			this.state = 2085;
			localctx._tryBlock = this.block();
			this.state = 2087;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 2086;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 2089;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 227, this._ctx);
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
		this.enterRule(localctx, 224, SolidCashParser.RULE_tryReturns);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2091;
			this.match(SolidCashParser.T__72);
			this.state = 2092;
			this.match(SolidCashParser.T__48);
			this.state = 2104;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 2093;
				this.parameter();
				this.state = 2098;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 228, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2094;
						this.match(SolidCashParser.T__4);
						this.state = 2095;
						this.parameter();
						}
						}
					}
					this.state = 2100;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 228, this._ctx);
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
		this.enterRule(localctx, 226, SolidCashParser.RULE_catchClause);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2108;
			this.match(SolidCashParser.T__111);
			this.state = 2110;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 231, this._ctx) ) {
			case 1:
				{
				this.state = 2109;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 2127;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 235, this._ctx) ) {
			case 1:
				{
				this.state = 2112;
				this.match(SolidCashParser.T__48);
				this.state = 2124;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 2113;
					this.parameter();
					this.state = 2118;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 232, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2114;
							this.match(SolidCashParser.T__4);
							this.state = 2115;
							this.parameter();
							}
							}
						}
						this.state = 2120;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 232, this._ctx);
					}
					this.state = 2122;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2121;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2126;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
			this.state = 2129;
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
		this.enterRule(localctx, 228, SolidCashParser.RULE_breakStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2131;
			this.match(SolidCashParser.T__98);
			this.state = 2132;
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
		this.enterRule(localctx, 230, SolidCashParser.RULE_continueStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2134;
			this.match(SolidCashParser.T__99);
			this.state = 2135;
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
		this.enterRule(localctx, 232, SolidCashParser.RULE_requireMessage);
		try {
			this.state = 2140;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 151:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2137;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 180:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2138;
				this.match(SolidCashParser.Identifier);
				this.state = 2139;
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
		this.enterRule(localctx, 234, SolidCashParser.RULE_revertStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 2184;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 242, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2142;
				this.match(SolidCashParser.T__35);
				this.state = 2143;
				this.match(SolidCashParser.Identifier);
				this.state = 2146;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 2144;
					this.match(SolidCashParser.T__11);
					this.state = 2145;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 2148;
				this.match(SolidCashParser.T__48);
				this.state = 2149;
				this.match(SolidCashParser.T__3);
				this.state = 2161;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2150;
					this.namedArg();
					this.state = 2155;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 238, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2151;
							this.match(SolidCashParser.T__4);
							this.state = 2152;
							this.namedArg();
							}
							}
						}
						this.state = 2157;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 238, this._ctx);
					}
					this.state = 2159;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2158;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2163;
				this.match(SolidCashParser.T__5);
				this.state = 2164;
				this.match(SolidCashParser.T__49);
				this.state = 2165;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2166;
				this.match(SolidCashParser.T__35);
				this.state = 2167;
				this.match(SolidCashParser.Identifier);
				this.state = 2170;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 2168;
					this.match(SolidCashParser.T__11);
					this.state = 2169;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 2172;
				this.expressionList();
				this.state = 2173;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2175;
				this.match(SolidCashParser.T__35);
				this.state = 2176;
				this.match(SolidCashParser.T__48);
				this.state = 2177;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2178;
				this.match(SolidCashParser.T__49);
				this.state = 2179;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2180;
				this.match(SolidCashParser.T__35);
				this.state = 2181;
				this.match(SolidCashParser.T__48);
				this.state = 2182;
				this.match(SolidCashParser.T__49);
				this.state = 2183;
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
		this.enterRule(localctx, 236, SolidCashParser.RULE_assertStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2186;
			this.match(SolidCashParser.T__112);
			this.state = 2187;
			this.match(SolidCashParser.T__48);
			this.state = 2188;
			this.expression(0);
			this.state = 2189;
			this.match(SolidCashParser.T__49);
			this.state = 2190;
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
		this.enterRule(localctx, 238, SolidCashParser.RULE_consoleParameter);
		try {
			this.state = 2194;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 180:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2192;
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
				this.state = 2193;
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
		this.enterRule(localctx, 240, SolidCashParser.RULE_consoleParameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2196;
			this.match(SolidCashParser.T__48);
			this.state = 2208;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 3152921) !== 0) || _la===180) {
				{
				this.state = 2197;
				this.consoleParameter();
				this.state = 2202;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 244, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2198;
						this.match(SolidCashParser.T__4);
						this.state = 2199;
						this.consoleParameter();
						}
						}
					}
					this.state = 2204;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 244, this._ctx);
				}
				this.state = 2206;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2205;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2210;
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
		this.enterRule(localctx, 242, SolidCashParser.RULE_functionCall);
		let _la: number;
		try {
			let _alt: number;
			this.state = 2236;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 250, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2212;
				this.match(SolidCashParser.Identifier);
				this.state = 2213;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2214;
				this.match(SolidCashParser.Identifier);
				this.state = 2215;
				this.match(SolidCashParser.T__11);
				this.state = 2216;
				this.match(SolidCashParser.Identifier);
				this.state = 2217;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2218;
				this.match(SolidCashParser.Identifier);
				this.state = 2219;
				this.match(SolidCashParser.T__48);
				this.state = 2220;
				this.match(SolidCashParser.T__3);
				this.state = 2232;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2221;
					this.namedArg();
					this.state = 2226;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 247, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2222;
							this.match(SolidCashParser.T__4);
							this.state = 2223;
							this.namedArg();
							}
							}
						}
						this.state = 2228;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 247, this._ctx);
					}
					this.state = 2230;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2229;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2234;
				this.match(SolidCashParser.T__5);
				this.state = 2235;
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
		this.enterRule(localctx, 244, SolidCashParser.RULE_namedArg);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2238;
			this.match(SolidCashParser.Identifier);
			this.state = 2239;
			this.match(SolidCashParser.T__109);
			this.state = 2240;
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
		this.enterRule(localctx, 246, SolidCashParser.RULE_expressionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2242;
			this.match(SolidCashParser.T__48);
			this.state = 2254;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
				{
				this.state = 2243;
				this.expression(0);
				this.state = 2248;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 251, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2244;
						this.match(SolidCashParser.T__4);
						this.state = 2245;
						this.expression(0);
						}
						}
					}
					this.state = 2250;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 251, this._ctx);
				}
				this.state = 2252;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2251;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2256;
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
		this.enterRule(localctx, 248, SolidCashParser.RULE_callOptions);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2258;
			this.match(SolidCashParser.T__3);
			this.state = 2259;
			this.callOption();
			this.state = 2264;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 254, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2260;
					this.match(SolidCashParser.T__4);
					this.state = 2261;
					this.callOption();
					}
					}
				}
				this.state = 2266;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 254, this._ctx);
			}
			this.state = 2268;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2267;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 2270;
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
		this.enterRule(localctx, 250, SolidCashParser.RULE_callOption);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2272;
			this.match(SolidCashParser.Identifier);
			this.state = 2273;
			this.match(SolidCashParser.T__109);
			this.state = 2274;
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
		this.enterRule(localctx, 252, SolidCashParser.RULE_typeList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2276;
			this.match(SolidCashParser.T__48);
			this.state = 2277;
			this.typeListItem();
			this.state = 2282;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 256, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2278;
					this.match(SolidCashParser.T__4);
					this.state = 2279;
					this.typeListItem();
					}
					}
				}
				this.state = 2284;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 256, this._ctx);
			}
			this.state = 2286;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2285;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 2288;
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
		this.enterRule(localctx, 254, SolidCashParser.RULE_typeListItem);
		try {
			this.state = 2292;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 258, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2290;
				this.typeName();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2291;
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
		let _startState: number = 256;
		this.enterRecursionRule(localctx, 256, SolidCashParser.RULE_expression, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2449;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 267, this._ctx) ) {
			case 1:
				{
				localctx = new AssignmentExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 2295;
				this.match(SolidCashParser.T__48);
				this.state = 2296;
				this.match(SolidCashParser.Identifier);
				this.state = 2297;
				(localctx as AssignmentExpressionContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    (localctx as AssignmentExpressionContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2298;
				this.expression(0);
				this.state = 2299;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2301;
				this.match(SolidCashParser.T__48);
				this.state = 2302;
				this.expression(0);
				this.state = 2303;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				{
				localctx = new TupleExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2305;
				this.match(SolidCashParser.T__48);
				this.state = 2306;
				this.expression(0);
				this.state = 2309;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2307;
					this.match(SolidCashParser.T__4);
					this.state = 2308;
					this.expression(0);
					}
					}
					this.state = 2311;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2313;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 4:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2315;
				this.typeCast();
				this.state = 2316;
				this.match(SolidCashParser.T__48);
				this.state = 2317;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 2319;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2318;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 2321;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 5:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2323;
				this.functionCall();
				}
				break;
			case 6:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2324;
				this.match(SolidCashParser.T__113);
				this.state = 2325;
				this.match(SolidCashParser.Identifier);
				this.state = 2327;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 2326;
					this.callOptions();
					}
				}

				this.state = 2329;
				this.expressionList();
				}
				break;
			case 7:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2330;
				this.match(SolidCashParser.T__113);
				this.state = 2331;
				this.typeName();
				this.state = 2334;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2332;
					this.match(SolidCashParser.T__65);
					this.state = 2333;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 2336;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 2338;
				this.match(SolidCashParser.T__48);
				this.state = 2339;
				this.expression(0);
				this.state = 2340;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 8:
				{
				localctx = new NewDynamicBytesContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2342;
				this.match(SolidCashParser.T__113);
				this.state = 2343;
				this.match(SolidCashParser.UnboundedBytes);
				this.state = 2344;
				this.match(SolidCashParser.T__48);
				this.state = 2345;
				this.expression(0);
				this.state = 2346;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 9:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2348;
				this.match(SolidCashParser.T__54);
				this.state = 2349;
				this.match(SolidCashParser.T__48);
				this.state = 2350;
				this.typeName();
				this.state = 2351;
				this.match(SolidCashParser.T__49);
				this.state = 2352;
				this.match(SolidCashParser.T__11);
				this.state = 2353;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 10:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2355;
				this.match(SolidCashParser.T__114);
				this.state = 2356;
				this.expressionList();
				}
				break;
			case 11:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2357;
				this.match(SolidCashParser.T__115);
				this.state = 2358;
				this.expressionList();
				}
				break;
			case 12:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2359;
				this.match(SolidCashParser.T__116);
				this.state = 2360;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2361;
				this.match(SolidCashParser.T__117);
				this.state = 2362;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2363;
				this.match(SolidCashParser.T__118);
				this.state = 2364;
				this.match(SolidCashParser.T__48);
				this.state = 2365;
				this.match(SolidCashParser.Identifier);
				this.state = 2366;
				this.match(SolidCashParser.T__11);
				this.state = 2367;
				this.match(SolidCashParser.Identifier);
				this.state = 2368;
				this.match(SolidCashParser.T__4);
				this.state = 2369;
				this.expressionList();
				this.state = 2370;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 15:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2372;
				this.match(SolidCashParser.T__119);
				this.state = 2373;
				this.expressionList();
				}
				break;
			case 16:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2374;
				this.match(SolidCashParser.T__120);
				this.state = 2375;
				this.expressionList();
				}
				break;
			case 17:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2376;
				this.match(SolidCashParser.T__121);
				this.state = 2377;
				this.match(SolidCashParser.T__48);
				this.state = 2378;
				this.expression(0);
				this.state = 2379;
				this.match(SolidCashParser.T__4);
				this.state = 2380;
				this.typeList();
				this.state = 2381;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 18:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2383;
				this.match(SolidCashParser.T__122);
				this.state = 2384;
				this.match(SolidCashParser.T__48);
				this.state = 2385;
				this.expression(0);
				this.state = 2386;
				this.match(SolidCashParser.T__4);
				this.state = 2387;
				this.typeList();
				this.state = 2388;
				this.match(SolidCashParser.T__4);
				this.state = 2389;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 2390;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 19:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2392;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__123);
				this.state = 2393;
				this.match(SolidCashParser.T__65);
				this.state = 2394;
				this.expression(0);
				this.state = 2395;
				this.match(SolidCashParser.T__66);
				this.state = 2396;
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
			case 20:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2398;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__124);
				this.state = 2399;
				this.match(SolidCashParser.T__65);
				this.state = 2400;
				this.expression(0);
				this.state = 2401;
				this.match(SolidCashParser.T__66);
				this.state = 2402;
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
			case 21:
				{
				localctx = new UnaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2404;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===127)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2405;
				this.expression(21);
				}
				break;
			case 22:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2406;
				this.match(SolidCashParser.T__65);
				this.state = 2418;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 2407;
					this.expression(0);
					this.state = 2412;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 263, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2408;
							this.match(SolidCashParser.T__4);
							this.state = 2409;
							this.expression(0);
							}
							}
						}
						this.state = 2414;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 263, this._ctx);
					}
					this.state = 2416;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2415;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2420;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 23:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2421;
				this.match(SolidCashParser.T__73);
				this.state = 2422;
				this.match(SolidCashParser.T__11);
				this.state = 2423;
				this.match(SolidCashParser.Identifier);
				this.state = 2424;
				this.match(SolidCashParser.T__11);
				this.state = 2425;
				this.match(SolidCashParser.Identifier);
				this.state = 2426;
				this.match(SolidCashParser.T__65);
				this.state = 2427;
				this.expression(0);
				this.state = 2428;
				this.match(SolidCashParser.T__66);
				this.state = 2429;
				this.memberName();
				}
				break;
			case 24:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2431;
				this.match(SolidCashParser.T__73);
				this.state = 2432;
				this.match(SolidCashParser.T__11);
				this.state = 2433;
				this.match(SolidCashParser.Identifier);
				this.state = 2438;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2434;
						this.match(SolidCashParser.T__65);
						this.state = 2435;
						this.expression(0);
						this.state = 2436;
						this.match(SolidCashParser.T__66);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2440;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 266, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 25:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2442;
				this.match(SolidCashParser.T__73);
				this.state = 2443;
				this.match(SolidCashParser.T__11);
				this.state = 2444;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 26:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2445;
				this.match(SolidCashParser.T__73);
				}
				break;
			case 27:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2446;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 28:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2447;
				this.anyIdentifier();
				}
				break;
			case 29:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2448;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2558;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 274, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2556;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 273, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2451;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 2452;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 2453;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2454;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 2455;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2456;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2457;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 2458;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2459;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2460;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 2461;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===128 || _la===129)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2462;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2463;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 2464;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2465;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2466;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2467;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2468;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2469;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2470;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2471;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2472;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2473;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2474;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2475;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2476;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2477;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2478;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2479;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__129);
						this.state = 2480;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2481;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2482;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__130);
						this.state = 2483;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2484;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 2485;
						this.match(SolidCashParser.T__131);
						this.state = 2486;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 2487;
						this.match(SolidCashParser.T__109);
						this.state = 2488;
						(localctx as TernaryOpContext)._ifFalse = this.expression(9);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2490;
						if (!(this.precpred(this._ctx, 33))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 33)");
						}
						this.state = 2491;
						this.match(SolidCashParser.T__65);
						this.state = 2492;
						(localctx as IndexRangeSliceContext)._start = this.expression(0);
						this.state = 2493;
						this.match(SolidCashParser.T__109);
						this.state = 2494;
						(localctx as IndexRangeSliceContext)._end = this.expression(0);
						this.state = 2495;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2497;
						if (!(this.precpred(this._ctx, 32))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 32)");
						}
						this.state = 2498;
						this.match(SolidCashParser.T__65);
						this.state = 2499;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2500;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2501;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 2502;
						this.match(SolidCashParser.T__65);
						this.state = 2503;
						this.expression(0);
						this.state = 2504;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2506;
						if (!(this.precpred(this._ctx, 28))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 28)");
						}
						this.state = 2507;
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
						this.state = 2508;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2509;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.DotSplit);
						this.state = 2510;
						this.match(SolidCashParser.T__48);
						this.state = 2511;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2512;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2514;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2515;
						this.match(SolidCashParser.DotSlice);
						this.state = 2516;
						this.match(SolidCashParser.T__48);
						this.state = 2517;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2518;
						this.match(SolidCashParser.T__4);
						this.state = 2519;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2520;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2522;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2523;
						this.match(SolidCashParser.T__11);
						this.state = 2524;
						this.match(SolidCashParser.Identifier);
						this.state = 2526;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2525;
							this.callOptions();
							}
						}

						this.state = 2528;
						this.match(SolidCashParser.T__48);
						this.state = 2529;
						this.match(SolidCashParser.T__3);
						this.state = 2541;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===180) {
							{
							this.state = 2530;
							this.namedArg();
							this.state = 2535;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 269, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2531;
									this.match(SolidCashParser.T__4);
									this.state = 2532;
									this.namedArg();
									}
									}
								}
								this.state = 2537;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 269, this._ctx);
							}
							this.state = 2539;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2538;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2543;
						this.match(SolidCashParser.T__5);
						this.state = 2544;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 20:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2545;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2546;
						this.match(SolidCashParser.T__11);
						this.state = 2547;
						this.match(SolidCashParser.Identifier);
						this.state = 2549;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2548;
							this.callOptions();
							}
						}

						this.state = 2551;
						this.expressionList();
						}
						break;
					case 21:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2552;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2553;
						this.memberName();
						}
						break;
					case 22:
						{
						localctx = new PostfixOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2554;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 2555;
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
				this.state = 2560;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 274, this._ctx);
			}
			}
		}
		catch (re) {
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
		this.enterRule(localctx, 258, SolidCashParser.RULE_memberName);
		try {
			this.state = 2574;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2561;
				this.match(SolidCashParser.T__11);
				this.state = 2562;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2563;
				this.match(SolidCashParser.DotValue);
				}
				break;
			case 172:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2564;
				this.match(SolidCashParser.DotLockingBytecode);
				}
				break;
			case 173:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2565;
				this.match(SolidCashParser.DotTokenCategory);
				}
				break;
			case 174:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2566;
				this.match(SolidCashParser.DotNftCommitment);
				}
				break;
			case 175:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2567;
				this.match(SolidCashParser.DotTokenAmount);
				}
				break;
			case 176:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2568;
				this.match(SolidCashParser.DotOutpointTransactionHash);
				}
				break;
			case 177:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2569;
				this.match(SolidCashParser.DotOutpointIndex);
				}
				break;
			case 178:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2570;
				this.match(SolidCashParser.DotUnlockingBytecode);
				}
				break;
			case 179:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2571;
				this.match(SolidCashParser.DotSequenceNumber);
				}
				break;
			case 170:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2572;
				this.match(SolidCashParser.DotCode);
				}
				break;
			case 171:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2573;
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
		this.enterRule(localctx, 260, SolidCashParser.RULE_modifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2576;
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
		this.enterRule(localctx, 262, SolidCashParser.RULE_literal);
		try {
			let _alt: number;
			this.state = 2592;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 141:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2578;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 145:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2579;
				this.numberLiteral();
				}
				break;
			case 144:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2580;
				this.decimalLiteral();
				}
				break;
			case 151:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2581;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2585;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 276, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2582;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2587;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 276, this._ctx);
				}
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2588;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2589;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 152:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2590;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 153:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2591;
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
		this.enterRule(localctx, 264, SolidCashParser.RULE_numberLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2594;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2596;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 278, this._ctx) ) {
			case 1:
				{
				this.state = 2595;
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
		this.enterRule(localctx, 266, SolidCashParser.RULE_decimalLiteral);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2598;
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
		this.enterRule(localctx, 268, SolidCashParser.RULE_typeName);
		let _la: number;
		try {
			this.state = 2650;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 284, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2600;
				this.match(SolidCashParser.T__107);
				this.state = 2601;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2602;
				this.match(SolidCashParser.T__107);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2603;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2604;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2605;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2606;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2607;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2608;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2609;
				this.match(SolidCashParser.T__137);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2610;
				this.match(SolidCashParser.T__138);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2611;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2612;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2613;
				this.match(SolidCashParser.T__6);
				this.state = 2614;
				this.match(SolidCashParser.T__48);
				this.state = 2623;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 2615;
					this.typeName();
					this.state = 2620;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2616;
						this.match(SolidCashParser.T__4);
						this.state = 2617;
						this.typeName();
						}
						}
						this.state = 2622;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2625;
				this.match(SolidCashParser.T__49);
				this.state = 2629;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===70 || _la===71) {
					{
					{
					this.state = 2626;
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
					this.state = 2631;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 2644;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===73) {
					{
					this.state = 2632;
					this.match(SolidCashParser.T__72);
					this.state = 2633;
					this.match(SolidCashParser.T__48);
					this.state = 2634;
					this.typeName();
					this.state = 2639;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2635;
						this.match(SolidCashParser.T__4);
						this.state = 2636;
						this.typeName();
						}
						}
						this.state = 2641;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2642;
					this.match(SolidCashParser.T__49);
					}
				}

				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2646;
				this.match(SolidCashParser.Identifier);
				this.state = 2647;
				this.match(SolidCashParser.T__11);
				this.state = 2648;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 2649;
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
		this.enterRule(localctx, 270, SolidCashParser.RULE_typeCast);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2652;
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
		case 128:
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

	public static readonly _serializedATN: number[] = [4,1,183,2655,2,0,7,0,
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
	7,127,2,128,7,128,2,129,7,129,2,130,7,130,2,131,7,131,2,132,7,132,2,133,
	7,133,2,134,7,134,2,135,7,135,1,0,5,0,274,8,0,10,0,12,0,277,9,0,1,0,5,0,
	280,8,0,10,0,12,0,283,9,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,5,0,295,
	8,0,10,0,12,0,298,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,5,1,315,8,1,10,1,12,1,318,9,1,1,1,3,1,321,8,1,1,1,1,1,1,1,1,1,
	1,1,3,1,328,8,1,1,2,1,2,1,2,3,2,333,8,2,1,3,1,3,1,3,1,3,5,3,339,8,3,10,
	3,12,3,342,9,3,1,3,3,3,345,8,3,1,3,1,3,5,3,349,8,3,10,3,12,3,352,9,3,1,
	3,1,3,1,4,1,4,1,4,1,4,1,4,1,4,3,4,362,8,4,1,4,3,4,365,8,4,1,4,1,4,1,4,1,
	4,1,4,1,4,5,4,373,8,4,10,4,12,4,376,9,4,1,4,3,4,379,8,4,1,4,1,4,1,4,1,4,
	1,4,3,4,386,8,4,1,4,3,4,389,8,4,1,4,1,4,3,4,393,8,4,1,5,1,5,1,5,3,5,398,
	8,5,1,5,1,5,3,5,402,8,5,1,6,1,6,1,7,1,7,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,
	5,8,416,8,8,10,8,12,8,419,9,8,1,8,3,8,422,8,8,1,9,1,9,1,10,4,10,427,8,10,
	11,10,12,10,428,1,10,3,10,432,8,10,1,11,3,11,435,8,11,1,11,1,11,1,12,1,
	12,1,13,1,13,1,13,1,13,1,13,1,13,5,13,447,8,13,10,13,12,13,450,9,13,3,13,
	452,8,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,5,13,463,8,13,10,
	13,12,13,466,9,13,1,13,1,13,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,
	1,14,3,14,480,8,14,1,15,1,15,1,15,1,15,1,15,1,16,1,16,1,17,1,17,1,17,1,
	17,5,17,493,8,17,10,17,12,17,496,9,17,1,17,3,17,499,8,17,1,17,1,17,1,18,
	1,18,1,18,1,18,5,18,507,8,18,10,18,12,18,510,9,18,1,18,5,18,513,8,18,10,
	18,12,18,516,9,18,1,18,5,18,519,8,18,10,18,12,18,522,9,18,1,18,5,18,525,
	8,18,10,18,12,18,528,9,18,1,18,5,18,531,8,18,10,18,12,18,534,9,18,1,18,
	5,18,537,8,18,10,18,12,18,540,9,18,1,18,5,18,543,8,18,10,18,12,18,546,9,
	18,1,18,5,18,549,8,18,10,18,12,18,552,9,18,1,18,5,18,555,8,18,10,18,12,
	18,558,9,18,1,18,1,18,1,19,3,19,563,8,19,1,19,1,19,1,19,3,19,568,8,19,1,
	19,1,19,1,19,1,19,5,19,574,8,19,10,19,12,19,577,9,19,3,19,579,8,19,1,19,
	1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,5,
	19,596,8,19,10,19,12,19,599,9,19,1,19,1,19,1,20,1,20,3,20,605,8,20,1,21,
	1,21,1,21,1,21,1,21,5,21,612,8,21,10,21,12,21,615,9,21,1,21,3,21,618,8,
	21,1,21,1,21,1,22,1,22,1,22,1,22,1,22,1,22,5,22,628,8,22,10,22,12,22,631,
	9,22,1,22,3,22,634,8,22,3,22,636,8,22,1,22,1,22,3,22,640,8,22,1,22,1,22,
	1,23,1,23,3,23,646,8,23,1,23,3,23,649,8,23,1,23,3,23,652,8,23,1,24,1,24,
	1,24,1,24,1,24,1,24,5,24,660,8,24,10,24,12,24,663,9,24,1,24,3,24,666,8,
	24,3,24,668,8,24,1,24,1,24,1,24,1,25,1,25,3,25,675,8,25,1,26,1,26,1,26,
	1,26,4,26,681,8,26,11,26,12,26,682,1,26,1,26,1,27,1,27,1,27,3,27,690,8,
	27,1,27,1,27,1,27,1,28,1,28,1,28,1,28,1,28,1,28,5,28,701,8,28,10,28,12,
	28,704,9,28,1,28,3,28,707,8,28,1,28,1,28,1,29,1,29,1,29,3,29,714,8,29,1,
	30,1,30,1,30,1,30,1,30,1,30,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,32,1,32,
	1,32,5,32,732,8,32,10,32,12,32,735,9,32,1,32,5,32,738,8,32,10,32,12,32,
	741,9,32,1,32,1,32,5,32,745,8,32,10,32,12,32,748,9,32,1,32,1,32,1,33,1,
	33,1,33,1,33,5,33,756,8,33,10,33,12,33,759,9,33,1,33,5,33,762,8,33,10,33,
	12,33,765,9,33,1,33,1,33,5,33,769,8,33,10,33,12,33,772,9,33,1,33,1,33,1,
	34,1,34,1,34,3,34,779,8,34,1,35,1,35,1,35,1,35,1,35,1,35,1,35,5,35,788,
	8,35,10,35,12,35,791,9,35,1,35,1,35,1,36,1,36,1,36,1,37,3,37,799,8,37,1,
	37,1,37,5,37,803,8,37,10,37,12,37,806,9,37,1,37,1,37,1,37,3,37,811,8,37,
	1,37,1,37,1,37,1,37,5,37,817,8,37,10,37,12,37,820,9,37,1,37,1,37,5,37,824,
	8,37,10,37,12,37,827,9,37,1,37,1,37,1,37,3,37,832,8,37,1,37,1,37,1,37,3,
	37,837,8,37,1,37,1,37,5,37,841,8,37,10,37,12,37,844,9,37,1,37,1,37,1,37,
	1,37,3,37,850,8,37,1,37,1,37,5,37,854,8,37,10,37,12,37,857,9,37,1,37,1,
	37,1,37,3,37,862,8,37,1,37,1,37,3,37,866,8,37,1,38,1,38,3,38,870,8,38,1,
	39,1,39,1,40,1,40,1,40,1,40,3,40,878,8,40,1,40,1,40,1,40,3,40,883,8,40,
	1,40,1,40,1,40,1,40,1,40,1,40,3,40,891,8,40,1,40,1,40,1,40,1,40,1,40,1,
	40,1,40,1,40,3,40,901,8,40,1,40,1,40,1,40,3,40,906,8,40,1,40,1,40,3,40,
	910,8,40,1,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,3,41,922,8,41,
	1,41,1,41,1,41,1,41,1,41,1,41,1,41,5,41,931,8,41,10,41,12,41,934,9,41,1,
	42,1,42,1,42,3,42,939,8,42,1,42,1,42,5,42,943,8,42,10,42,12,42,946,9,42,
	1,42,1,42,1,43,1,43,3,43,952,8,43,1,44,1,44,1,44,1,45,1,45,1,45,1,45,1,
	45,5,45,962,8,45,10,45,12,45,965,9,45,1,45,3,45,968,8,45,1,45,1,45,5,45,
	972,8,45,10,45,12,45,975,9,45,1,45,1,45,1,46,1,46,3,46,981,8,46,1,47,1,
	47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,3,47,997,
	8,47,1,48,1,48,1,48,1,48,1,48,5,48,1004,8,48,10,48,12,48,1007,9,48,1,48,
	3,48,1010,8,48,1,49,1,49,1,49,1,49,3,49,1016,8,49,1,50,1,50,1,50,1,50,1,
	50,5,50,1023,8,50,10,50,12,50,1026,9,50,1,50,3,50,1029,8,50,1,50,1,50,1,
	51,1,51,5,51,1035,8,51,10,51,12,51,1038,9,51,1,51,3,51,1041,8,51,1,51,1,
	51,5,51,1045,8,51,10,51,12,51,1048,9,51,1,51,3,51,1051,8,51,3,51,1053,8,
	51,1,52,1,52,1,52,1,52,5,52,1059,8,52,10,52,12,52,1062,9,52,1,52,3,52,1065,
	8,52,3,52,1067,8,52,1,52,1,52,1,53,1,53,5,53,1073,8,53,10,53,12,53,1076,
	9,53,1,53,3,53,1079,8,53,1,53,1,53,5,53,1083,8,53,10,53,12,53,1086,9,53,
	1,53,3,53,1089,8,53,1,53,1,53,5,53,1093,8,53,10,53,12,53,1096,9,53,1,53,
	3,53,1099,8,53,3,53,1101,8,53,1,54,1,54,5,54,1105,8,54,10,54,12,54,1108,
	9,54,1,54,1,54,3,54,1112,8,54,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,
	55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,
	1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,3,55,1146,8,55,1,56,1,56,1,
	56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,57,1,57,1,57,1,57,1,57,1,57,1,57,
	1,57,1,57,1,57,1,57,1,57,5,57,1170,8,57,10,57,12,57,1173,9,57,1,57,1,57,
	1,57,1,58,1,58,1,58,1,58,1,58,1,58,5,58,1184,8,58,10,58,12,58,1187,9,58,
	1,58,1,58,1,58,1,58,1,58,1,58,1,58,5,58,1196,8,58,10,58,12,58,1199,9,58,
	1,58,3,58,1202,8,58,1,58,1,58,1,58,3,58,1207,8,58,1,59,1,59,1,59,3,59,1212,
	8,59,1,59,1,59,1,59,1,59,1,59,5,59,1219,8,59,10,59,12,59,1222,9,59,1,59,
	3,59,1225,8,59,3,59,1227,8,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,
	59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,3,59,1249,8,59,
	1,59,1,59,1,59,3,59,1254,8,59,1,60,1,60,1,60,1,60,3,60,1260,8,60,1,60,1,
	60,1,60,1,61,1,61,1,61,1,61,1,61,1,61,1,62,1,62,1,62,1,62,3,62,1275,8,62,
	1,62,1,62,1,62,1,62,1,62,5,62,1282,8,62,10,62,12,62,1285,9,62,1,62,3,62,
	1288,8,62,3,62,1290,8,62,1,62,1,62,1,62,1,62,1,62,1,62,1,62,3,62,1299,8,
	62,1,62,1,62,1,62,3,62,1304,8,62,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,
	1313,8,63,11,63,12,63,1314,3,63,1317,8,63,1,63,5,63,1320,8,63,10,63,12,
	63,1323,9,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1334,8,63,
	11,63,12,63,1335,1,63,5,63,1339,8,63,10,63,12,63,1342,9,63,1,63,1,63,1,
	63,1,63,1,63,1,63,4,63,1350,8,63,11,63,12,63,1351,1,63,1,63,1,63,1,63,1,
	63,1,63,4,63,1360,8,63,11,63,12,63,1361,1,63,1,63,1,63,1,63,4,63,1368,8,
	63,11,63,12,63,1369,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,
	63,4,63,1383,8,63,11,63,12,63,1384,3,63,1387,8,63,1,63,5,63,1390,8,63,10,
	63,12,63,1393,9,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1402,8,63,11,
	63,12,63,1403,1,63,5,63,1407,8,63,10,63,12,63,1410,9,63,1,63,1,63,1,63,
	1,63,1,63,4,63,1417,8,63,11,63,12,63,1418,1,63,1,63,1,63,3,63,1424,8,63,
	1,64,1,64,1,64,3,64,1429,8,64,1,65,1,65,1,65,1,65,1,65,1,65,1,65,5,65,1438,
	8,65,10,65,12,65,1441,9,65,1,65,1,65,1,65,1,65,1,65,1,65,1,66,1,66,5,66,
	1451,8,66,10,66,12,66,1454,9,66,1,66,1,66,1,66,3,66,1459,8,66,1,66,1,66,
	1,66,1,66,5,66,1465,8,66,10,66,12,66,1468,9,66,1,66,1,66,1,66,3,66,1473,
	8,66,1,66,1,66,3,66,1477,8,66,1,67,1,67,1,67,1,67,1,67,1,67,4,67,1485,8,
	67,11,67,12,67,1486,1,67,1,67,1,67,1,67,1,67,1,67,1,67,1,67,4,67,1497,8,
	67,11,67,12,67,1498,1,67,1,67,1,67,1,67,1,67,1,67,4,67,1507,8,67,11,67,
	12,67,1508,1,67,1,67,1,67,1,67,1,67,1,67,1,67,4,67,1518,8,67,11,67,12,67,
	1519,1,67,1,67,1,67,1,67,1,67,3,67,1527,8,67,1,68,1,68,5,68,1531,8,68,10,
	68,12,68,1534,9,68,1,68,1,68,1,68,1,68,3,68,1540,8,68,1,69,1,69,1,69,1,
	69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,3,69,1553,8,69,1,70,1,70,1,70,1,70,
	3,70,1559,8,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,3,70,1569,8,70,1,
	70,1,70,1,70,1,70,1,70,1,70,1,70,4,70,1578,8,70,11,70,12,70,1579,1,70,1,
	70,1,70,3,70,1585,8,70,1,70,1,70,1,70,3,70,1590,8,70,1,71,1,71,1,72,1,72,
	1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,
	72,4,72,1611,8,72,11,72,12,72,1612,1,72,1,72,1,72,1,72,1,72,3,72,1620,8,
	72,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,74,1,74,1,74,1,74,1,74,1,74,3,74,
	1635,8,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,4,74,1646,8,74,11,
	74,12,74,1647,1,74,1,74,1,74,3,74,1653,8,74,1,74,1,74,1,74,1,74,1,74,1,
	74,1,74,1,74,1,74,1,74,1,74,3,74,1666,8,74,1,74,1,74,3,74,1670,8,74,1,75,
	1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,4,75,1686,
	8,75,11,75,12,75,1687,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,
	1,75,1,75,1,75,1,75,3,75,1704,8,75,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,
	76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,4,76,1722,8,76,11,76,12,76,1723,
	1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,4,76,1734,8,76,11,76,12,76,1735,
	1,76,1,76,1,76,1,76,1,76,1,76,4,76,1744,8,76,11,76,12,76,1745,1,76,1,76,
	1,76,1,76,4,76,1752,8,76,11,76,12,76,1753,1,76,1,76,3,76,1758,8,76,1,77,
	1,77,1,77,1,77,1,77,1,77,1,77,3,77,1767,8,77,1,77,1,77,1,77,1,78,1,78,1,
	78,1,78,1,78,3,78,1777,8,78,1,78,1,78,1,78,1,79,1,79,1,79,1,79,1,79,1,79,
	1,79,3,79,1789,8,79,1,80,1,80,1,80,1,80,1,80,1,80,3,80,1797,8,80,1,81,1,
	81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,
	1,82,1,82,1,82,1,82,1,82,1,82,1,82,1,82,1,82,1,82,1,82,1,83,1,83,1,83,1,
	83,1,83,1,83,1,83,1,83,1,83,1,83,1,83,1,84,1,84,1,84,1,84,1,84,3,84,1842,
	8,84,1,84,1,84,1,84,1,85,1,85,5,85,1849,8,85,10,85,12,85,1852,9,85,1,85,
	1,85,1,85,3,85,1857,8,85,1,85,1,85,1,85,1,85,1,85,1,85,1,85,1,85,3,85,1867,
	8,85,1,86,1,86,1,86,1,87,1,87,1,87,1,87,1,87,1,87,1,87,3,87,1879,8,87,1,
	88,1,88,1,88,1,88,1,88,1,88,1,88,1,88,1,89,1,89,1,89,1,89,1,89,1,89,1,90,
	1,90,1,90,1,90,1,91,1,91,1,91,1,92,1,92,5,92,1904,8,92,10,92,12,92,1907,
	9,92,1,92,1,92,1,93,1,93,1,93,1,93,1,93,1,93,1,93,1,93,1,93,1,93,1,93,1,
	93,1,93,3,93,1924,8,93,1,94,1,94,1,94,1,94,5,94,1930,8,94,10,94,12,94,1933,
	9,94,1,94,1,94,3,94,1937,8,94,1,95,1,95,1,95,5,95,1942,8,95,10,95,12,95,
	1945,9,95,1,95,1,95,1,95,1,96,1,96,1,96,1,96,1,97,1,97,1,97,4,97,1957,8,
	97,11,97,12,97,1958,1,97,3,97,1962,8,97,1,97,3,97,1965,8,97,1,98,1,98,1,
	98,1,98,1,99,1,99,1,99,1,100,1,100,1,100,1,100,1,100,1,100,1,101,1,101,
	1,101,1,101,1,101,1,101,5,101,1986,8,101,10,101,12,101,1989,9,101,3,101,
	1991,8,101,1,101,1,101,1,101,1,101,1,101,5,101,1998,8,101,10,101,12,101,
	2001,9,101,3,101,2003,8,101,1,101,1,101,1,102,1,102,1,102,3,102,2010,8,
	102,1,103,1,103,1,103,1,103,1,103,5,103,2017,8,103,10,103,12,103,2020,9,
	103,3,103,2022,8,103,1,103,1,103,1,104,1,104,1,105,1,105,1,105,5,105,2031,
	8,105,10,105,12,105,2034,9,105,1,106,1,106,1,107,1,107,1,107,5,107,2041,
	8,107,10,107,12,107,2044,9,107,1,107,1,107,1,108,1,108,1,108,1,108,1,108,
	1,108,5,108,2054,8,108,10,108,12,108,2057,9,108,1,108,3,108,2060,8,108,
	1,108,1,108,1,109,1,109,1,109,1,109,5,109,2068,8,109,10,109,12,109,2071,
	9,109,1,110,1,110,1,110,5,110,2076,8,110,10,110,12,110,2079,9,110,1,111,
	1,111,1,111,3,111,2084,8,111,1,111,1,111,4,111,2088,8,111,11,111,12,111,
	2089,1,112,1,112,1,112,1,112,1,112,5,112,2097,8,112,10,112,12,112,2100,
	9,112,1,112,3,112,2103,8,112,3,112,2105,8,112,1,112,1,112,1,113,1,113,3,
	113,2111,8,113,1,113,1,113,1,113,1,113,5,113,2117,8,113,10,113,12,113,2120,
	9,113,1,113,3,113,2123,8,113,3,113,2125,8,113,1,113,3,113,2128,8,113,1,
	113,1,113,1,114,1,114,1,114,1,115,1,115,1,115,1,116,1,116,1,116,3,116,2141,
	8,116,1,117,1,117,1,117,1,117,3,117,2147,8,117,1,117,1,117,1,117,1,117,
	1,117,5,117,2154,8,117,10,117,12,117,2157,9,117,1,117,3,117,2160,8,117,
	3,117,2162,8,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,3,117,2171,8,
	117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,
	117,3,117,2185,8,117,1,118,1,118,1,118,1,118,1,118,1,118,1,119,1,119,3,
	119,2195,8,119,1,120,1,120,1,120,1,120,5,120,2201,8,120,10,120,12,120,2204,
	9,120,1,120,3,120,2207,8,120,3,120,2209,8,120,1,120,1,120,1,121,1,121,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,5,121,2225,8,
	121,10,121,12,121,2228,9,121,1,121,3,121,2231,8,121,3,121,2233,8,121,1,
	121,1,121,3,121,2237,8,121,1,122,1,122,1,122,1,122,1,123,1,123,1,123,1,
	123,5,123,2247,8,123,10,123,12,123,2250,9,123,1,123,3,123,2253,8,123,3,
	123,2255,8,123,1,123,1,123,1,124,1,124,1,124,1,124,5,124,2263,8,124,10,
	124,12,124,2266,9,124,1,124,3,124,2269,8,124,1,124,1,124,1,125,1,125,1,
	125,1,125,1,126,1,126,1,126,1,126,5,126,2281,8,126,10,126,12,126,2284,9,
	126,1,126,3,126,2287,8,126,1,126,1,126,1,127,1,127,3,127,2293,8,127,1,128,
	1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,
	1,128,1,128,4,128,2310,8,128,11,128,12,128,2311,1,128,1,128,1,128,1,128,
	1,128,1,128,3,128,2320,8,128,1,128,1,128,1,128,1,128,1,128,1,128,3,128,
	2328,8,128,1,128,1,128,1,128,1,128,1,128,4,128,2335,8,128,11,128,12,128,
	2336,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,
	1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,
	1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,
	1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,
	1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,
	1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,
	1,128,5,128,2411,8,128,10,128,12,128,2414,9,128,1,128,3,128,2417,8,128,
	3,128,2419,8,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,
	1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,4,128,2439,8,128,
	11,128,12,128,2440,1,128,1,128,1,128,1,128,1,128,1,128,1,128,3,128,2450,
	8,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,
	1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,
	1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,
	1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,
	1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,
	1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,
	1,128,1,128,1,128,1,128,3,128,2527,8,128,1,128,1,128,1,128,1,128,1,128,
	5,128,2534,8,128,10,128,12,128,2537,9,128,1,128,3,128,2540,8,128,3,128,
	2542,8,128,1,128,1,128,1,128,1,128,1,128,1,128,3,128,2550,8,128,1,128,1,
	128,1,128,1,128,1,128,5,128,2557,8,128,10,128,12,128,2560,9,128,1,129,1,
	129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,3,
	129,2575,8,129,1,130,1,130,1,131,1,131,1,131,1,131,1,131,5,131,2584,8,131,
	10,131,12,131,2587,9,131,1,131,1,131,1,131,1,131,3,131,2593,8,131,1,132,
	1,132,3,132,2597,8,132,1,133,1,133,1,134,1,134,1,134,1,134,1,134,1,134,
	1,134,1,134,1,134,1,134,1,134,1,134,1,134,1,134,1,134,1,134,1,134,1,134,
	5,134,2619,8,134,10,134,12,134,2622,9,134,3,134,2624,8,134,1,134,1,134,
	5,134,2628,8,134,10,134,12,134,2631,9,134,1,134,1,134,1,134,1,134,1,134,
	5,134,2638,8,134,10,134,12,134,2641,9,134,1,134,1,134,3,134,2645,8,134,
	1,134,1,134,1,134,1,134,3,134,2651,8,134,1,135,1,135,1,135,0,2,82,256,136,
	0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,
	52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,
	100,102,104,106,108,110,112,114,116,118,120,122,124,126,128,130,132,134,
	136,138,140,142,144,146,148,150,152,154,156,158,160,162,164,166,168,170,
	172,174,176,178,180,182,184,186,188,190,192,194,196,198,200,202,204,206,
	208,210,212,214,216,218,220,222,224,226,228,230,232,234,236,238,240,242,
	244,246,248,250,252,254,256,258,260,262,264,266,268,270,0,27,2,0,10,10,
	13,27,5,0,11,11,28,36,143,143,147,147,180,180,4,0,140,140,145,145,151,151,
	180,180,1,0,38,39,2,0,140,140,144,144,3,0,20,23,26,27,40,40,1,0,43,44,2,
	0,43,44,58,59,3,0,43,44,58,58,63,63,2,0,145,145,180,180,2,0,40,40,77,86,
	1,0,87,88,6,0,31,31,36,36,75,75,108,108,149,149,180,180,5,0,141,141,145,
	145,151,151,153,153,162,162,2,0,163,163,172,175,2,0,163,163,172,179,3,0,
	14,14,27,27,127,127,2,0,10,10,15,16,1,0,13,14,1,0,128,129,1,0,20,23,1,0,
	18,19,2,0,126,126,164,164,3,0,33,33,56,56,133,137,1,0,142,143,1,0,70,71,
	5,0,59,59,108,108,138,139,146,149,155,159,2995,0,275,1,0,0,0,2,327,1,0,
	0,0,4,329,1,0,0,0,6,334,1,0,0,0,8,392,1,0,0,0,10,394,1,0,0,0,12,403,1,0,
	0,0,14,405,1,0,0,0,16,421,1,0,0,0,18,423,1,0,0,0,20,431,1,0,0,0,22,434,
	1,0,0,0,24,438,1,0,0,0,26,440,1,0,0,0,28,479,1,0,0,0,30,481,1,0,0,0,32,
	486,1,0,0,0,34,488,1,0,0,0,36,502,1,0,0,0,38,562,1,0,0,0,40,602,1,0,0,0,
	42,606,1,0,0,0,44,621,1,0,0,0,46,645,1,0,0,0,48,653,1,0,0,0,50,672,1,0,
	0,0,52,676,1,0,0,0,54,689,1,0,0,0,56,694,1,0,0,0,58,710,1,0,0,0,60,715,
	1,0,0,0,62,721,1,0,0,0,64,728,1,0,0,0,66,751,1,0,0,0,68,778,1,0,0,0,70,
	780,1,0,0,0,72,794,1,0,0,0,74,865,1,0,0,0,76,869,1,0,0,0,78,871,1,0,0,0,
	80,909,1,0,0,0,82,921,1,0,0,0,84,935,1,0,0,0,86,951,1,0,0,0,88,953,1,0,
	0,0,90,956,1,0,0,0,92,978,1,0,0,0,94,996,1,0,0,0,96,998,1,0,0,0,98,1011,
	1,0,0,0,100,1017,1,0,0,0,102,1052,1,0,0,0,104,1054,1,0,0,0,106,1100,1,0,
	0,0,108,1111,1,0,0,0,110,1145,1,0,0,0,112,1147,1,0,0,0,114,1157,1,0,0,0,
	116,1206,1,0,0,0,118,1253,1,0,0,0,120,1255,1,0,0,0,122,1264,1,0,0,0,124,
	1303,1,0,0,0,126,1423,1,0,0,0,128,1428,1,0,0,0,130,1430,1,0,0,0,132,1476,
	1,0,0,0,134,1526,1,0,0,0,136,1539,1,0,0,0,138,1552,1,0,0,0,140,1589,1,0,
	0,0,142,1591,1,0,0,0,144,1619,1,0,0,0,146,1621,1,0,0,0,148,1669,1,0,0,0,
	150,1703,1,0,0,0,152,1757,1,0,0,0,154,1759,1,0,0,0,156,1771,1,0,0,0,158,
	1781,1,0,0,0,160,1796,1,0,0,0,162,1798,1,0,0,0,164,1814,1,0,0,0,166,1825,
	1,0,0,0,168,1836,1,0,0,0,170,1866,1,0,0,0,172,1868,1,0,0,0,174,1878,1,0,
	0,0,176,1880,1,0,0,0,178,1888,1,0,0,0,180,1894,1,0,0,0,182,1898,1,0,0,0,
	184,1901,1,0,0,0,186,1923,1,0,0,0,188,1925,1,0,0,0,190,1938,1,0,0,0,192,
	1949,1,0,0,0,194,1953,1,0,0,0,196,1966,1,0,0,0,198,1970,1,0,0,0,200,1973,
	1,0,0,0,202,1979,1,0,0,0,204,2009,1,0,0,0,206,2011,1,0,0,0,208,2025,1,0,
	0,0,210,2027,1,0,0,0,212,2035,1,0,0,0,214,2037,1,0,0,0,216,2047,1,0,0,0,
	218,2063,1,0,0,0,220,2072,1,0,0,0,222,2080,1,0,0,0,224,2091,1,0,0,0,226,
	2108,1,0,0,0,228,2131,1,0,0,0,230,2134,1,0,0,0,232,2140,1,0,0,0,234,2184,
	1,0,0,0,236,2186,1,0,0,0,238,2194,1,0,0,0,240,2196,1,0,0,0,242,2236,1,0,
	0,0,244,2238,1,0,0,0,246,2242,1,0,0,0,248,2258,1,0,0,0,250,2272,1,0,0,0,
	252,2276,1,0,0,0,254,2292,1,0,0,0,256,2449,1,0,0,0,258,2574,1,0,0,0,260,
	2576,1,0,0,0,262,2592,1,0,0,0,264,2594,1,0,0,0,266,2598,1,0,0,0,268,2650,
	1,0,0,0,270,2652,1,0,0,0,272,274,3,16,8,0,273,272,1,0,0,0,274,277,1,0,0,
	0,275,273,1,0,0,0,275,276,1,0,0,0,276,281,1,0,0,0,277,275,1,0,0,0,278,280,
	3,2,1,0,279,278,1,0,0,0,280,283,1,0,0,0,281,279,1,0,0,0,281,282,1,0,0,0,
	282,296,1,0,0,0,283,281,1,0,0,0,284,295,3,62,31,0,285,295,3,56,28,0,286,
	295,3,52,26,0,287,295,3,60,30,0,288,295,3,8,4,0,289,295,3,48,24,0,290,295,
	3,26,13,0,291,295,3,6,3,0,292,295,3,36,18,0,293,295,3,38,19,0,294,284,1,
	0,0,0,294,285,1,0,0,0,294,286,1,0,0,0,294,287,1,0,0,0,294,288,1,0,0,0,294,
	289,1,0,0,0,294,290,1,0,0,0,294,291,1,0,0,0,294,292,1,0,0,0,294,293,1,0,
	0,0,295,298,1,0,0,0,296,294,1,0,0,0,296,297,1,0,0,0,297,299,1,0,0,0,298,
	296,1,0,0,0,299,300,5,0,0,1,300,1,1,0,0,0,301,302,5,1,0,0,302,303,5,151,
	0,0,303,328,5,2,0,0,304,305,5,1,0,0,305,306,5,151,0,0,306,307,5,3,0,0,307,
	308,5,180,0,0,308,328,5,2,0,0,309,310,5,1,0,0,310,311,5,4,0,0,311,316,3,
	4,2,0,312,313,5,5,0,0,313,315,3,4,2,0,314,312,1,0,0,0,315,318,1,0,0,0,316,
	314,1,0,0,0,316,317,1,0,0,0,317,320,1,0,0,0,318,316,1,0,0,0,319,321,5,5,
	0,0,320,319,1,0,0,0,320,321,1,0,0,0,321,322,1,0,0,0,322,323,5,6,0,0,323,
	324,5,180,0,0,324,325,5,151,0,0,325,326,5,2,0,0,326,328,1,0,0,0,327,301,
	1,0,0,0,327,304,1,0,0,0,327,309,1,0,0,0,328,3,1,0,0,0,329,332,5,180,0,0,
	330,331,5,3,0,0,331,333,5,180,0,0,332,330,1,0,0,0,332,333,1,0,0,0,333,5,
	1,0,0,0,334,335,5,7,0,0,335,336,3,14,7,0,336,340,3,104,52,0,337,339,3,94,
	47,0,338,337,1,0,0,0,339,342,1,0,0,0,340,338,1,0,0,0,340,341,1,0,0,0,341,
	344,1,0,0,0,342,340,1,0,0,0,343,345,3,100,50,0,344,343,1,0,0,0,344,345,
	1,0,0,0,345,346,1,0,0,0,346,350,5,4,0,0,347,349,3,110,55,0,348,347,1,0,
	0,0,349,352,1,0,0,0,350,348,1,0,0,0,350,351,1,0,0,0,351,353,1,0,0,0,352,
	350,1,0,0,0,353,354,5,6,0,0,354,7,1,0,0,0,355,356,5,8,0,0,356,357,5,180,
	0,0,357,361,5,9,0,0,358,362,3,82,41,0,359,362,3,268,134,0,360,362,5,10,
	0,0,361,358,1,0,0,0,361,359,1,0,0,0,361,360,1,0,0,0,362,364,1,0,0,0,363,
	365,5,11,0,0,364,363,1,0,0,0,364,365,1,0,0,0,365,366,1,0,0,0,366,393,5,
	2,0,0,367,368,5,8,0,0,368,369,5,4,0,0,369,374,3,10,5,0,370,371,5,5,0,0,
	371,373,3,10,5,0,372,370,1,0,0,0,373,376,1,0,0,0,374,372,1,0,0,0,374,375,
	1,0,0,0,375,378,1,0,0,0,376,374,1,0,0,0,377,379,5,5,0,0,378,377,1,0,0,0,
	378,379,1,0,0,0,379,380,1,0,0,0,380,381,5,6,0,0,381,385,5,9,0,0,382,386,
	3,82,41,0,383,386,3,268,134,0,384,386,5,10,0,0,385,382,1,0,0,0,385,383,
	1,0,0,0,385,384,1,0,0,0,386,388,1,0,0,0,387,389,5,11,0,0,388,387,1,0,0,
	0,388,389,1,0,0,0,389,390,1,0,0,0,390,391,5,2,0,0,391,393,1,0,0,0,392,355,
	1,0,0,0,392,367,1,0,0,0,393,9,1,0,0,0,394,397,5,180,0,0,395,396,5,12,0,
	0,396,398,5,180,0,0,397,395,1,0,0,0,397,398,1,0,0,0,398,401,1,0,0,0,399,
	400,5,3,0,0,400,402,3,12,6,0,401,399,1,0,0,0,401,402,1,0,0,0,402,11,1,0,
	0,0,403,404,7,0,0,0,404,13,1,0,0,0,405,406,7,1,0,0,406,15,1,0,0,0,407,408,
	5,37,0,0,408,409,3,18,9,0,409,410,3,20,10,0,410,411,5,2,0,0,411,422,1,0,
	0,0,412,413,5,37,0,0,413,417,5,180,0,0,414,416,7,2,0,0,415,414,1,0,0,0,
	416,419,1,0,0,0,417,415,1,0,0,0,417,418,1,0,0,0,418,420,1,0,0,0,419,417,
	1,0,0,0,420,422,5,2,0,0,421,407,1,0,0,0,421,412,1,0,0,0,422,17,1,0,0,0,
	423,424,7,3,0,0,424,19,1,0,0,0,425,427,3,22,11,0,426,425,1,0,0,0,427,428,
	1,0,0,0,428,426,1,0,0,0,428,429,1,0,0,0,429,432,1,0,0,0,430,432,5,10,0,
	0,431,426,1,0,0,0,431,430,1,0,0,0,432,21,1,0,0,0,433,435,3,24,12,0,434,
	433,1,0,0,0,434,435,1,0,0,0,435,436,1,0,0,0,436,437,7,4,0,0,437,23,1,0,
	0,0,438,439,7,5,0,0,439,25,1,0,0,0,440,441,5,41,0,0,441,451,5,180,0,0,442,
	443,5,42,0,0,443,448,5,180,0,0,444,445,5,5,0,0,445,447,5,180,0,0,446,444,
	1,0,0,0,447,450,1,0,0,0,448,446,1,0,0,0,448,449,1,0,0,0,449,452,1,0,0,0,
	450,448,1,0,0,0,451,442,1,0,0,0,451,452,1,0,0,0,452,453,1,0,0,0,453,464,
	5,4,0,0,454,463,3,56,28,0,455,463,3,52,26,0,456,463,3,60,30,0,457,463,3,
	44,22,0,458,463,3,48,24,0,459,463,3,30,15,0,460,463,3,28,14,0,461,463,3,
	34,17,0,462,454,1,0,0,0,462,455,1,0,0,0,462,456,1,0,0,0,462,457,1,0,0,0,
	462,458,1,0,0,0,462,459,1,0,0,0,462,460,1,0,0,0,462,461,1,0,0,0,463,466,
	1,0,0,0,464,462,1,0,0,0,464,465,1,0,0,0,465,467,1,0,0,0,466,464,1,0,0,0,
	467,468,5,6,0,0,468,27,1,0,0,0,469,470,3,32,16,0,470,471,3,80,40,0,471,
	472,5,180,0,0,472,473,5,2,0,0,473,480,1,0,0,0,474,475,3,32,16,0,475,476,
	3,82,41,0,476,477,5,180,0,0,477,478,5,2,0,0,478,480,1,0,0,0,479,469,1,0,
	0,0,479,474,1,0,0,0,480,29,1,0,0,0,481,482,3,32,16,0,482,483,3,268,134,
	0,483,484,5,180,0,0,484,485,5,2,0,0,485,31,1,0,0,0,486,487,7,6,0,0,487,
	33,1,0,0,0,488,489,5,7,0,0,489,490,5,180,0,0,490,494,3,104,52,0,491,493,
	3,94,47,0,492,491,1,0,0,0,493,496,1,0,0,0,494,492,1,0,0,0,494,495,1,0,0,
	0,495,498,1,0,0,0,496,494,1,0,0,0,497,499,3,100,50,0,498,497,1,0,0,0,498,
	499,1,0,0,0,499,500,1,0,0,0,500,501,5,2,0,0,501,35,1,0,0,0,502,503,5,45,
	0,0,503,504,5,180,0,0,504,508,5,4,0,0,505,507,3,56,28,0,506,505,1,0,0,0,
	507,510,1,0,0,0,508,506,1,0,0,0,508,509,1,0,0,0,509,514,1,0,0,0,510,508,
	1,0,0,0,511,513,3,52,26,0,512,511,1,0,0,0,513,516,1,0,0,0,514,512,1,0,0,
	0,514,515,1,0,0,0,515,520,1,0,0,0,516,514,1,0,0,0,517,519,3,60,30,0,518,
	517,1,0,0,0,519,522,1,0,0,0,520,518,1,0,0,0,520,521,1,0,0,0,521,526,1,0,
	0,0,522,520,1,0,0,0,523,525,3,44,22,0,524,523,1,0,0,0,525,528,1,0,0,0,526,
	524,1,0,0,0,526,527,1,0,0,0,527,532,1,0,0,0,528,526,1,0,0,0,529,531,3,48,
	24,0,530,529,1,0,0,0,531,534,1,0,0,0,532,530,1,0,0,0,532,533,1,0,0,0,533,
	538,1,0,0,0,534,532,1,0,0,0,535,537,3,62,31,0,536,535,1,0,0,0,537,540,1,
	0,0,0,538,536,1,0,0,0,538,539,1,0,0,0,539,544,1,0,0,0,540,538,1,0,0,0,541,
	543,3,74,37,0,542,541,1,0,0,0,543,546,1,0,0,0,544,542,1,0,0,0,544,545,1,
	0,0,0,545,550,1,0,0,0,546,544,1,0,0,0,547,549,3,8,4,0,548,547,1,0,0,0,549,
	552,1,0,0,0,550,548,1,0,0,0,550,551,1,0,0,0,551,556,1,0,0,0,552,550,1,0,
	0,0,553,555,3,6,3,0,554,553,1,0,0,0,555,558,1,0,0,0,556,554,1,0,0,0,556,
	557,1,0,0,0,557,559,1,0,0,0,558,556,1,0,0,0,559,560,5,6,0,0,560,37,1,0,
	0,0,561,563,5,46,0,0,562,561,1,0,0,0,562,563,1,0,0,0,563,564,1,0,0,0,564,
	565,5,47,0,0,565,567,5,180,0,0,566,568,3,104,52,0,567,566,1,0,0,0,567,568,
	1,0,0,0,568,578,1,0,0,0,569,570,5,42,0,0,570,575,3,40,20,0,571,572,5,5,
	0,0,572,574,3,40,20,0,573,571,1,0,0,0,574,577,1,0,0,0,575,573,1,0,0,0,575,
	576,1,0,0,0,576,579,1,0,0,0,577,575,1,0,0,0,578,569,1,0,0,0,578,579,1,0,
	0,0,579,580,1,0,0,0,580,597,5,4,0,0,581,596,3,56,28,0,582,596,3,52,26,0,
	583,596,3,60,30,0,584,596,3,44,22,0,585,596,3,48,24,0,586,596,3,62,31,0,
	587,596,3,8,4,0,588,596,3,74,37,0,589,596,3,84,42,0,590,596,3,64,32,0,591,
	596,3,90,45,0,592,596,3,42,21,0,593,596,3,66,33,0,594,596,3,70,35,0,595,
	581,1,0,0,0,595,582,1,0,0,0,595,583,1,0,0,0,595,584,1,0,0,0,595,585,1,0,
	0,0,595,586,1,0,0,0,595,587,1,0,0,0,595,588,1,0,0,0,595,589,1,0,0,0,595,
	590,1,0,0,0,595,591,1,0,0,0,595,592,1,0,0,0,595,593,1,0,0,0,595,594,1,0,
	0,0,596,599,1,0,0,0,597,595,1,0,0,0,597,598,1,0,0,0,598,600,1,0,0,0,599,
	597,1,0,0,0,600,601,5,6,0,0,601,39,1,0,0,0,602,604,5,180,0,0,603,605,3,
	246,123,0,604,603,1,0,0,0,604,605,1,0,0,0,605,41,1,0,0,0,606,607,5,7,0,
	0,607,608,3,14,7,0,608,613,3,104,52,0,609,612,3,94,47,0,610,612,3,92,46,
	0,611,609,1,0,0,0,611,610,1,0,0,0,612,615,1,0,0,0,613,611,1,0,0,0,613,614,
	1,0,0,0,614,617,1,0,0,0,615,613,1,0,0,0,616,618,3,100,50,0,617,616,1,0,
	0,0,617,618,1,0,0,0,618,619,1,0,0,0,619,620,5,2,0,0,620,43,1,0,0,0,621,
	622,5,48,0,0,622,623,5,180,0,0,623,635,5,49,0,0,624,629,3,46,23,0,625,626,
	5,5,0,0,626,628,3,46,23,0,627,625,1,0,0,0,628,631,1,0,0,0,629,627,1,0,0,
	0,629,630,1,0,0,0,630,633,1,0,0,0,631,629,1,0,0,0,632,634,5,5,0,0,633,632,
	1,0,0,0,633,634,1,0,0,0,634,636,1,0,0,0,635,624,1,0,0,0,635,636,1,0,0,0,
	636,637,1,0,0,0,637,639,5,50,0,0,638,640,5,51,0,0,639,638,1,0,0,0,639,640,
	1,0,0,0,640,641,1,0,0,0,641,642,5,2,0,0,642,45,1,0,0,0,643,646,3,268,134,
	0,644,646,3,82,41,0,645,643,1,0,0,0,645,644,1,0,0,0,646,648,1,0,0,0,647,
	649,5,52,0,0,648,647,1,0,0,0,648,649,1,0,0,0,649,651,1,0,0,0,650,652,5,
	180,0,0,651,650,1,0,0,0,651,652,1,0,0,0,652,47,1,0,0,0,653,654,5,35,0,0,
	654,655,5,180,0,0,655,667,5,49,0,0,656,661,3,50,25,0,657,658,5,5,0,0,658,
	660,3,50,25,0,659,657,1,0,0,0,660,663,1,0,0,0,661,659,1,0,0,0,661,662,1,
	0,0,0,662,665,1,0,0,0,663,661,1,0,0,0,664,666,5,5,0,0,665,664,1,0,0,0,665,
	666,1,0,0,0,666,668,1,0,0,0,667,656,1,0,0,0,667,668,1,0,0,0,668,669,1,0,
	0,0,669,670,5,50,0,0,670,671,5,2,0,0,671,49,1,0,0,0,672,674,3,268,134,0,
	673,675,5,180,0,0,674,673,1,0,0,0,674,675,1,0,0,0,675,51,1,0,0,0,676,677,
	5,53,0,0,677,678,5,180,0,0,678,680,5,4,0,0,679,681,3,54,27,0,680,679,1,
	0,0,0,681,682,1,0,0,0,682,680,1,0,0,0,682,683,1,0,0,0,683,684,1,0,0,0,684,
	685,5,6,0,0,685,53,1,0,0,0,686,690,3,268,134,0,687,690,3,82,41,0,688,690,
	3,80,40,0,689,686,1,0,0,0,689,687,1,0,0,0,689,688,1,0,0,0,690,691,1,0,0,
	0,691,692,3,14,7,0,692,693,5,2,0,0,693,55,1,0,0,0,694,695,5,54,0,0,695,
	696,5,180,0,0,696,697,5,4,0,0,697,702,3,58,29,0,698,699,5,5,0,0,699,701,
	3,58,29,0,700,698,1,0,0,0,701,704,1,0,0,0,702,700,1,0,0,0,702,703,1,0,0,
	0,703,706,1,0,0,0,704,702,1,0,0,0,705,707,5,5,0,0,706,705,1,0,0,0,706,707,
	1,0,0,0,707,708,1,0,0,0,708,709,5,6,0,0,709,57,1,0,0,0,710,713,5,180,0,
	0,711,712,5,40,0,0,712,714,5,145,0,0,713,711,1,0,0,0,713,714,1,0,0,0,714,
	59,1,0,0,0,715,716,5,55,0,0,716,717,5,180,0,0,717,718,5,42,0,0,718,719,
	3,268,134,0,719,720,5,2,0,0,720,61,1,0,0,0,721,722,3,268,134,0,722,723,
	5,56,0,0,723,724,5,180,0,0,724,725,5,40,0,0,725,726,3,256,128,0,726,727,
	5,2,0,0,727,63,1,0,0,0,728,729,5,57,0,0,729,733,3,104,52,0,730,732,7,7,
	0,0,731,730,1,0,0,0,732,735,1,0,0,0,733,731,1,0,0,0,733,734,1,0,0,0,734,
	739,1,0,0,0,735,733,1,0,0,0,736,738,3,72,36,0,737,736,1,0,0,0,738,741,1,
	0,0,0,739,737,1,0,0,0,739,740,1,0,0,0,740,742,1,0,0,0,741,739,1,0,0,0,742,
	746,5,4,0,0,743,745,3,110,55,0,744,743,1,0,0,0,745,748,1,0,0,0,746,744,
	1,0,0,0,746,747,1,0,0,0,747,749,1,0,0,0,748,746,1,0,0,0,749,750,5,6,0,0,
	750,65,1,0,0,0,751,752,5,60,0,0,752,753,3,104,52,0,753,757,5,44,0,0,754,
	756,3,68,34,0,755,754,1,0,0,0,756,759,1,0,0,0,757,755,1,0,0,0,757,758,1,
	0,0,0,758,763,1,0,0,0,759,757,1,0,0,0,760,762,3,92,46,0,761,760,1,0,0,0,
	762,765,1,0,0,0,763,761,1,0,0,0,763,764,1,0,0,0,764,766,1,0,0,0,765,763,
	1,0,0,0,766,770,5,4,0,0,767,769,3,110,55,0,768,767,1,0,0,0,769,772,1,0,
	0,0,770,768,1,0,0,0,770,771,1,0,0,0,771,773,1,0,0,0,772,770,1,0,0,0,773,
	774,5,6,0,0,774,67,1,0,0,0,775,779,5,59,0,0,776,779,5,61,0,0,777,779,3,
	96,48,0,778,775,1,0,0,0,778,776,1,0,0,0,778,777,1,0,0,0,779,69,1,0,0,0,
	780,781,5,62,0,0,781,782,5,49,0,0,782,783,5,50,0,0,783,784,5,44,0,0,784,
	785,5,59,0,0,785,789,5,4,0,0,786,788,3,110,55,0,787,786,1,0,0,0,788,791,
	1,0,0,0,789,787,1,0,0,0,789,790,1,0,0,0,790,792,1,0,0,0,791,789,1,0,0,0,
	792,793,5,6,0,0,793,71,1,0,0,0,794,795,5,180,0,0,795,796,3,246,123,0,796,
	73,1,0,0,0,797,799,3,78,39,0,798,797,1,0,0,0,798,799,1,0,0,0,799,800,1,
	0,0,0,800,804,3,268,134,0,801,803,3,260,130,0,802,801,1,0,0,0,803,806,1,
	0,0,0,804,802,1,0,0,0,804,805,1,0,0,0,805,807,1,0,0,0,806,804,1,0,0,0,807,
	810,5,180,0,0,808,809,5,40,0,0,809,811,3,256,128,0,810,808,1,0,0,0,810,
	811,1,0,0,0,811,812,1,0,0,0,812,813,5,2,0,0,813,866,1,0,0,0,814,818,3,268,
	134,0,815,817,3,260,130,0,816,815,1,0,0,0,817,820,1,0,0,0,818,816,1,0,0,
	0,818,819,1,0,0,0,819,821,1,0,0,0,820,818,1,0,0,0,821,825,3,78,39,0,822,
	824,3,260,130,0,823,822,1,0,0,0,824,827,1,0,0,0,825,823,1,0,0,0,825,826,
	1,0,0,0,826,828,1,0,0,0,827,825,1,0,0,0,828,831,5,180,0,0,829,830,5,40,
	0,0,830,832,3,256,128,0,831,829,1,0,0,0,831,832,1,0,0,0,832,833,1,0,0,0,
	833,834,5,2,0,0,834,866,1,0,0,0,835,837,3,78,39,0,836,835,1,0,0,0,836,837,
	1,0,0,0,837,838,1,0,0,0,838,842,3,80,40,0,839,841,3,76,38,0,840,839,1,0,
	0,0,841,844,1,0,0,0,842,840,1,0,0,0,842,843,1,0,0,0,843,845,1,0,0,0,844,
	842,1,0,0,0,845,846,5,180,0,0,846,847,5,2,0,0,847,866,1,0,0,0,848,850,3,
	78,39,0,849,848,1,0,0,0,849,850,1,0,0,0,850,851,1,0,0,0,851,855,3,82,41,
	0,852,854,3,76,38,0,853,852,1,0,0,0,854,857,1,0,0,0,855,853,1,0,0,0,855,
	856,1,0,0,0,856,858,1,0,0,0,857,855,1,0,0,0,858,861,5,180,0,0,859,860,5,
	40,0,0,860,862,3,256,128,0,861,859,1,0,0,0,861,862,1,0,0,0,862,863,1,0,
	0,0,863,864,5,2,0,0,864,866,1,0,0,0,865,798,1,0,0,0,865,814,1,0,0,0,865,
	836,1,0,0,0,865,849,1,0,0,0,866,75,1,0,0,0,867,870,3,260,130,0,868,870,
	3,78,39,0,869,867,1,0,0,0,869,868,1,0,0,0,870,77,1,0,0,0,871,872,7,8,0,
	0,872,79,1,0,0,0,873,874,5,64,0,0,874,875,5,49,0,0,875,877,3,268,134,0,
	876,878,5,180,0,0,877,876,1,0,0,0,877,878,1,0,0,0,878,879,1,0,0,0,879,880,
	5,65,0,0,880,882,3,268,134,0,881,883,5,180,0,0,882,881,1,0,0,0,882,883,
	1,0,0,0,883,884,1,0,0,0,884,885,5,50,0,0,885,910,1,0,0,0,886,887,5,64,0,
	0,887,888,5,49,0,0,888,890,3,268,134,0,889,891,5,180,0,0,890,889,1,0,0,
	0,890,891,1,0,0,0,891,892,1,0,0,0,892,893,5,65,0,0,893,894,3,80,40,0,894,
	895,5,50,0,0,895,910,1,0,0,0,896,897,5,64,0,0,897,898,5,49,0,0,898,900,
	3,268,134,0,899,901,5,180,0,0,900,899,1,0,0,0,900,901,1,0,0,0,901,902,1,
	0,0,0,902,903,5,65,0,0,903,905,3,82,41,0,904,906,5,180,0,0,905,904,1,0,
	0,0,905,906,1,0,0,0,906,907,1,0,0,0,907,908,5,50,0,0,908,910,1,0,0,0,909,
	873,1,0,0,0,909,886,1,0,0,0,909,896,1,0,0,0,910,81,1,0,0,0,911,912,6,41,
	-1,0,912,913,3,268,134,0,913,914,5,66,0,0,914,915,7,9,0,0,915,916,5,67,
	0,0,916,922,1,0,0,0,917,918,3,268,134,0,918,919,5,66,0,0,919,920,5,67,0,
	0,920,922,1,0,0,0,921,911,1,0,0,0,921,917,1,0,0,0,922,932,1,0,0,0,923,924,
	10,2,0,0,924,925,5,66,0,0,925,926,7,9,0,0,926,931,5,67,0,0,927,928,10,1,
	0,0,928,929,5,66,0,0,929,931,5,67,0,0,930,923,1,0,0,0,930,927,1,0,0,0,931,
	934,1,0,0,0,932,930,1,0,0,0,932,933,1,0,0,0,933,83,1,0,0,0,934,932,1,0,
	0,0,935,936,5,68,0,0,936,938,5,180,0,0,937,939,3,104,52,0,938,937,1,0,0,
	0,938,939,1,0,0,0,939,940,1,0,0,0,940,944,5,4,0,0,941,943,3,86,43,0,942,
	941,1,0,0,0,943,946,1,0,0,0,944,942,1,0,0,0,944,945,1,0,0,0,945,947,1,0,
	0,0,946,944,1,0,0,0,947,948,5,6,0,0,948,85,1,0,0,0,949,952,3,88,44,0,950,
	952,3,110,55,0,951,949,1,0,0,0,951,950,1,0,0,0,952,87,1,0,0,0,953,954,5,
	69,0,0,954,955,5,2,0,0,955,89,1,0,0,0,956,957,5,7,0,0,957,958,3,14,7,0,
	958,963,3,104,52,0,959,962,3,94,47,0,960,962,3,92,46,0,961,959,1,0,0,0,
	961,960,1,0,0,0,962,965,1,0,0,0,963,961,1,0,0,0,963,964,1,0,0,0,964,967,
	1,0,0,0,965,963,1,0,0,0,966,968,3,100,50,0,967,966,1,0,0,0,967,968,1,0,
	0,0,968,969,1,0,0,0,969,973,5,4,0,0,970,972,3,110,55,0,971,970,1,0,0,0,
	972,975,1,0,0,0,973,971,1,0,0,0,973,974,1,0,0,0,974,976,1,0,0,0,975,973,
	1,0,0,0,976,977,5,6,0,0,977,91,1,0,0,0,978,980,5,180,0,0,979,981,3,246,
	123,0,980,979,1,0,0,0,980,981,1,0,0,0,981,93,1,0,0,0,982,997,5,70,0,0,983,
	997,5,71,0,0,984,997,5,58,0,0,985,997,5,44,0,0,986,997,5,43,0,0,987,997,
	5,63,0,0,988,997,5,59,0,0,989,997,3,96,48,0,990,997,5,61,0,0,991,997,3,
	98,49,0,992,997,5,30,0,0,993,997,5,28,0,0,994,997,5,31,0,0,995,997,5,29,
	0,0,996,982,1,0,0,0,996,983,1,0,0,0,996,984,1,0,0,0,996,985,1,0,0,0,996,
	986,1,0,0,0,996,987,1,0,0,0,996,988,1,0,0,0,996,989,1,0,0,0,996,990,1,0,
	0,0,996,991,1,0,0,0,996,992,1,0,0,0,996,993,1,0,0,0,996,994,1,0,0,0,996,
	995,1,0,0,0,997,95,1,0,0,0,998,1009,5,72,0,0,999,1000,5,49,0,0,1000,1005,
	5,180,0,0,1001,1002,5,5,0,0,1002,1004,5,180,0,0,1003,1001,1,0,0,0,1004,
	1007,1,0,0,0,1005,1003,1,0,0,0,1005,1006,1,0,0,0,1006,1008,1,0,0,0,1007,
	1005,1,0,0,0,1008,1010,5,50,0,0,1009,999,1,0,0,0,1009,1010,1,0,0,0,1010,
	97,1,0,0,0,1011,1015,5,32,0,0,1012,1013,5,49,0,0,1013,1014,5,145,0,0,1014,
	1016,5,50,0,0,1015,1012,1,0,0,0,1015,1016,1,0,0,0,1016,99,1,0,0,0,1017,
	1018,5,73,0,0,1018,1019,5,49,0,0,1019,1024,3,102,51,0,1020,1021,5,5,0,0,
	1021,1023,3,102,51,0,1022,1020,1,0,0,0,1023,1026,1,0,0,0,1024,1022,1,0,
	0,0,1024,1025,1,0,0,0,1025,1028,1,0,0,0,1026,1024,1,0,0,0,1027,1029,5,5,
	0,0,1028,1027,1,0,0,0,1028,1029,1,0,0,0,1029,1030,1,0,0,0,1030,1031,5,50,
	0,0,1031,101,1,0,0,0,1032,1036,3,268,134,0,1033,1035,3,260,130,0,1034,1033,
	1,0,0,0,1035,1038,1,0,0,0,1036,1034,1,0,0,0,1036,1037,1,0,0,0,1037,1040,
	1,0,0,0,1038,1036,1,0,0,0,1039,1041,3,14,7,0,1040,1039,1,0,0,0,1040,1041,
	1,0,0,0,1041,1053,1,0,0,0,1042,1046,3,82,41,0,1043,1045,3,260,130,0,1044,
	1043,1,0,0,0,1045,1048,1,0,0,0,1046,1044,1,0,0,0,1046,1047,1,0,0,0,1047,
	1050,1,0,0,0,1048,1046,1,0,0,0,1049,1051,3,14,7,0,1050,1049,1,0,0,0,1050,
	1051,1,0,0,0,1051,1053,1,0,0,0,1052,1032,1,0,0,0,1052,1042,1,0,0,0,1053,
	103,1,0,0,0,1054,1066,5,49,0,0,1055,1060,3,106,53,0,1056,1057,5,5,0,0,1057,
	1059,3,106,53,0,1058,1056,1,0,0,0,1059,1062,1,0,0,0,1060,1058,1,0,0,0,1060,
	1061,1,0,0,0,1061,1064,1,0,0,0,1062,1060,1,0,0,0,1063,1065,5,5,0,0,1064,
	1063,1,0,0,0,1064,1065,1,0,0,0,1065,1067,1,0,0,0,1066,1055,1,0,0,0,1066,
	1067,1,0,0,0,1067,1068,1,0,0,0,1068,1069,5,50,0,0,1069,105,1,0,0,0,1070,
	1074,3,268,134,0,1071,1073,3,260,130,0,1072,1071,1,0,0,0,1073,1076,1,0,
	0,0,1074,1072,1,0,0,0,1074,1075,1,0,0,0,1075,1078,1,0,0,0,1076,1074,1,0,
	0,0,1077,1079,3,14,7,0,1078,1077,1,0,0,0,1078,1079,1,0,0,0,1079,1101,1,
	0,0,0,1080,1084,3,82,41,0,1081,1083,3,260,130,0,1082,1081,1,0,0,0,1083,
	1086,1,0,0,0,1084,1082,1,0,0,0,1084,1085,1,0,0,0,1085,1088,1,0,0,0,1086,
	1084,1,0,0,0,1087,1089,3,14,7,0,1088,1087,1,0,0,0,1088,1089,1,0,0,0,1089,
	1101,1,0,0,0,1090,1094,3,80,40,0,1091,1093,3,260,130,0,1092,1091,1,0,0,
	0,1093,1096,1,0,0,0,1094,1092,1,0,0,0,1094,1095,1,0,0,0,1095,1098,1,0,0,
	0,1096,1094,1,0,0,0,1097,1099,3,14,7,0,1098,1097,1,0,0,0,1098,1099,1,0,
	0,0,1099,1101,1,0,0,0,1100,1070,1,0,0,0,1100,1080,1,0,0,0,1100,1090,1,0,
	0,0,1101,107,1,0,0,0,1102,1106,5,4,0,0,1103,1105,3,110,55,0,1104,1103,1,
	0,0,0,1105,1108,1,0,0,0,1106,1104,1,0,0,0,1106,1107,1,0,0,0,1107,1109,1,
	0,0,0,1108,1106,1,0,0,0,1109,1112,5,6,0,0,1110,1112,3,110,55,0,1111,1102,
	1,0,0,0,1111,1110,1,0,0,0,1112,109,1,0,0,0,1113,1146,3,88,44,0,1114,1146,
	3,132,66,0,1115,1146,3,134,67,0,1116,1146,3,140,70,0,1117,1146,3,144,72,
	0,1118,1146,3,146,73,0,1119,1146,3,148,74,0,1120,1146,3,150,75,0,1121,1146,
	3,138,69,0,1122,1146,3,126,63,0,1123,1146,3,130,65,0,1124,1146,3,154,77,
	0,1125,1146,3,156,78,0,1126,1146,3,158,79,0,1127,1146,3,160,80,0,1128,1146,
	3,180,90,0,1129,1146,3,124,62,0,1130,1146,3,112,56,0,1131,1146,3,114,57,
	0,1132,1146,3,116,58,0,1133,1146,3,118,59,0,1134,1146,3,120,60,0,1135,1146,
	3,122,61,0,1136,1146,3,182,91,0,1137,1146,3,222,111,0,1138,1146,3,234,117,
	0,1139,1146,3,236,118,0,1140,1146,3,152,76,0,1141,1146,3,214,107,0,1142,
	1146,3,216,108,0,1143,1146,3,228,114,0,1144,1146,3,230,115,0,1145,1113,
	1,0,0,0,1145,1114,1,0,0,0,1145,1115,1,0,0,0,1145,1116,1,0,0,0,1145,1117,
	1,0,0,0,1145,1118,1,0,0,0,1145,1119,1,0,0,0,1145,1120,1,0,0,0,1145,1121,
	1,0,0,0,1145,1122,1,0,0,0,1145,1123,1,0,0,0,1145,1124,1,0,0,0,1145,1125,
	1,0,0,0,1145,1126,1,0,0,0,1145,1127,1,0,0,0,1145,1128,1,0,0,0,1145,1129,
	1,0,0,0,1145,1130,1,0,0,0,1145,1131,1,0,0,0,1145,1132,1,0,0,0,1145,1133,
	1,0,0,0,1145,1134,1,0,0,0,1145,1135,1,0,0,0,1145,1136,1,0,0,0,1145,1137,
	1,0,0,0,1145,1138,1,0,0,0,1145,1139,1,0,0,0,1145,1140,1,0,0,0,1145,1141,
	1,0,0,0,1145,1142,1,0,0,0,1145,1143,1,0,0,0,1145,1144,1,0,0,0,1146,111,
	1,0,0,0,1147,1148,5,74,0,0,1148,1149,5,12,0,0,1149,1150,5,180,0,0,1150,
	1151,5,49,0,0,1151,1152,3,256,128,0,1152,1153,5,5,0,0,1153,1154,3,256,128,
	0,1154,1155,5,50,0,0,1155,1156,5,2,0,0,1156,113,1,0,0,0,1157,1158,5,74,
	0,0,1158,1159,5,12,0,0,1159,1160,5,180,0,0,1160,1161,5,66,0,0,1161,1162,
	3,256,128,0,1162,1163,5,67,0,0,1163,1164,5,12,0,0,1164,1165,5,180,0,0,1165,
	1166,5,49,0,0,1166,1171,3,256,128,0,1167,1168,5,5,0,0,1168,1170,3,256,128,
	0,1169,1167,1,0,0,0,1170,1173,1,0,0,0,1171,1169,1,0,0,0,1171,1172,1,0,0,
	0,1172,1174,1,0,0,0,1173,1171,1,0,0,0,1174,1175,5,50,0,0,1175,1176,5,2,
	0,0,1176,115,1,0,0,0,1177,1178,5,75,0,0,1178,1207,5,2,0,0,1179,1180,5,75,
	0,0,1180,1185,3,256,128,0,1181,1182,5,5,0,0,1182,1184,3,256,128,0,1183,
	1181,1,0,0,0,1184,1187,1,0,0,0,1185,1183,1,0,0,0,1185,1186,1,0,0,0,1186,
	1188,1,0,0,0,1187,1185,1,0,0,0,1188,1189,5,2,0,0,1189,1207,1,0,0,0,1190,
	1191,5,75,0,0,1191,1192,5,49,0,0,1192,1197,3,256,128,0,1193,1194,5,5,0,
	0,1194,1196,3,256,128,0,1195,1193,1,0,0,0,1196,1199,1,0,0,0,1197,1195,1,
	0,0,0,1197,1198,1,0,0,0,1198,1201,1,0,0,0,1199,1197,1,0,0,0,1200,1202,5,
	5,0,0,1201,1200,1,0,0,0,1201,1202,1,0,0,0,1202,1203,1,0,0,0,1203,1204,5,
	50,0,0,1204,1205,5,2,0,0,1205,1207,1,0,0,0,1206,1177,1,0,0,0,1206,1179,
	1,0,0,0,1206,1190,1,0,0,0,1207,117,1,0,0,0,1208,1211,5,180,0,0,1209,1210,
	5,12,0,0,1210,1212,5,180,0,0,1211,1209,1,0,0,0,1211,1212,1,0,0,0,1212,1213,
	1,0,0,0,1213,1214,5,49,0,0,1214,1226,5,4,0,0,1215,1220,3,244,122,0,1216,
	1217,5,5,0,0,1217,1219,3,244,122,0,1218,1216,1,0,0,0,1219,1222,1,0,0,0,
	1220,1218,1,0,0,0,1220,1221,1,0,0,0,1221,1224,1,0,0,0,1222,1220,1,0,0,0,
	1223,1225,5,5,0,0,1224,1223,1,0,0,0,1224,1225,1,0,0,0,1225,1227,1,0,0,0,
	1226,1215,1,0,0,0,1226,1227,1,0,0,0,1227,1228,1,0,0,0,1228,1229,5,6,0,0,
	1229,1230,5,50,0,0,1230,1254,5,2,0,0,1231,1232,5,180,0,0,1232,1233,3,246,
	123,0,1233,1234,5,2,0,0,1234,1254,1,0,0,0,1235,1236,5,180,0,0,1236,1237,
	5,12,0,0,1237,1238,5,180,0,0,1238,1239,3,246,123,0,1239,1240,5,2,0,0,1240,
	1254,1,0,0,0,1241,1242,5,180,0,0,1242,1243,3,246,123,0,1243,1244,5,12,0,
	0,1244,1245,5,180,0,0,1245,1246,5,12,0,0,1246,1248,5,180,0,0,1247,1249,
	3,248,124,0,1248,1247,1,0,0,0,1248,1249,1,0,0,0,1249,1250,1,0,0,0,1250,
	1251,3,246,123,0,1251,1252,5,2,0,0,1252,1254,1,0,0,0,1253,1208,1,0,0,0,
	1253,1231,1,0,0,0,1253,1235,1,0,0,0,1253,1241,1,0,0,0,1254,119,1,0,0,0,
	1255,1256,3,256,128,0,1256,1257,5,12,0,0,1257,1259,5,180,0,0,1258,1260,
	3,248,124,0,1259,1258,1,0,0,0,1259,1260,1,0,0,0,1260,1261,1,0,0,0,1261,
	1262,3,246,123,0,1262,1263,5,2,0,0,1263,121,1,0,0,0,1264,1265,5,31,0,0,
	1265,1266,5,49,0,0,1266,1267,3,256,128,0,1267,1268,5,50,0,0,1268,1269,5,
	2,0,0,1269,123,1,0,0,0,1270,1271,5,76,0,0,1271,1274,5,180,0,0,1272,1273,
	5,12,0,0,1273,1275,5,180,0,0,1274,1272,1,0,0,0,1274,1275,1,0,0,0,1275,1276,
	1,0,0,0,1276,1277,5,49,0,0,1277,1289,5,4,0,0,1278,1283,3,244,122,0,1279,
	1280,5,5,0,0,1280,1282,3,244,122,0,1281,1279,1,0,0,0,1282,1285,1,0,0,0,
	1283,1281,1,0,0,0,1283,1284,1,0,0,0,1284,1287,1,0,0,0,1285,1283,1,0,0,0,
	1286,1288,5,5,0,0,1287,1286,1,0,0,0,1287,1288,1,0,0,0,1288,1290,1,0,0,0,
	1289,1278,1,0,0,0,1289,1290,1,0,0,0,1290,1291,1,0,0,0,1291,1292,5,6,0,0,
	1292,1293,5,50,0,0,1293,1304,5,2,0,0,1294,1295,5,76,0,0,1295,1298,5,180,
	0,0,1296,1297,5,12,0,0,1297,1299,5,180,0,0,1298,1296,1,0,0,0,1298,1299,
	1,0,0,0,1299,1300,1,0,0,0,1300,1301,3,246,123,0,1301,1302,5,2,0,0,1302,
	1304,1,0,0,0,1303,1270,1,0,0,0,1303,1294,1,0,0,0,1304,125,1,0,0,0,1305,
	1306,5,74,0,0,1306,1307,5,12,0,0,1307,1316,5,180,0,0,1308,1309,5,66,0,0,
	1309,1310,3,256,128,0,1310,1311,5,67,0,0,1311,1313,1,0,0,0,1312,1308,1,
	0,0,0,1313,1314,1,0,0,0,1314,1312,1,0,0,0,1314,1315,1,0,0,0,1315,1317,1,
	0,0,0,1316,1312,1,0,0,0,1316,1317,1,0,0,0,1317,1321,1,0,0,0,1318,1320,3,
	128,64,0,1319,1318,1,0,0,0,1320,1323,1,0,0,0,1321,1319,1,0,0,0,1321,1322,
	1,0,0,0,1322,1324,1,0,0,0,1323,1321,1,0,0,0,1324,1325,7,10,0,0,1325,1326,
	3,256,128,0,1326,1327,5,2,0,0,1327,1424,1,0,0,0,1328,1333,5,180,0,0,1329,
	1330,5,66,0,0,1330,1331,3,256,128,0,1331,1332,5,67,0,0,1332,1334,1,0,0,
	0,1333,1329,1,0,0,0,1334,1335,1,0,0,0,1335,1333,1,0,0,0,1335,1336,1,0,0,
	0,1336,1340,1,0,0,0,1337,1339,3,128,64,0,1338,1337,1,0,0,0,1339,1342,1,
	0,0,0,1340,1338,1,0,0,0,1340,1341,1,0,0,0,1341,1343,1,0,0,0,1342,1340,1,
	0,0,0,1343,1344,7,10,0,0,1344,1345,3,256,128,0,1345,1346,5,2,0,0,1346,1424,
	1,0,0,0,1347,1349,5,180,0,0,1348,1350,3,128,64,0,1349,1348,1,0,0,0,1350,
	1351,1,0,0,0,1351,1349,1,0,0,0,1351,1352,1,0,0,0,1352,1353,1,0,0,0,1353,
	1354,7,10,0,0,1354,1355,3,256,128,0,1355,1356,5,2,0,0,1356,1424,1,0,0,0,
	1357,1359,5,180,0,0,1358,1360,3,128,64,0,1359,1358,1,0,0,0,1360,1361,1,
	0,0,0,1361,1359,1,0,0,0,1361,1362,1,0,0,0,1362,1367,1,0,0,0,1363,1364,5,
	66,0,0,1364,1365,3,256,128,0,1365,1366,5,67,0,0,1366,1368,1,0,0,0,1367,
	1363,1,0,0,0,1368,1369,1,0,0,0,1369,1367,1,0,0,0,1369,1370,1,0,0,0,1370,
	1371,1,0,0,0,1371,1372,7,10,0,0,1372,1373,3,256,128,0,1373,1374,5,2,0,0,
	1374,1424,1,0,0,0,1375,1376,5,74,0,0,1376,1377,5,12,0,0,1377,1386,5,180,
	0,0,1378,1379,5,66,0,0,1379,1380,3,256,128,0,1380,1381,5,67,0,0,1381,1383,
	1,0,0,0,1382,1378,1,0,0,0,1383,1384,1,0,0,0,1384,1382,1,0,0,0,1384,1385,
	1,0,0,0,1385,1387,1,0,0,0,1386,1382,1,0,0,0,1386,1387,1,0,0,0,1387,1391,
	1,0,0,0,1388,1390,3,128,64,0,1389,1388,1,0,0,0,1390,1393,1,0,0,0,1391,1389,
	1,0,0,0,1391,1392,1,0,0,0,1392,1394,1,0,0,0,1393,1391,1,0,0,0,1394,1395,
	7,11,0,0,1395,1424,5,2,0,0,1396,1401,5,180,0,0,1397,1398,5,66,0,0,1398,
	1399,3,256,128,0,1399,1400,5,67,0,0,1400,1402,1,0,0,0,1401,1397,1,0,0,0,
	1402,1403,1,0,0,0,1403,1401,1,0,0,0,1403,1404,1,0,0,0,1404,1408,1,0,0,0,
	1405,1407,3,128,64,0,1406,1405,1,0,0,0,1407,1410,1,0,0,0,1408,1406,1,0,
	0,0,1408,1409,1,0,0,0,1409,1411,1,0,0,0,1410,1408,1,0,0,0,1411,1412,7,11,
	0,0,1412,1413,5,2,0,0,1413,1424,1,0,0,0,1414,1416,5,180,0,0,1415,1417,3,
	128,64,0,1416,1415,1,0,0,0,1417,1418,1,0,0,0,1418,1416,1,0,0,0,1418,1419,
	1,0,0,0,1419,1420,1,0,0,0,1420,1421,7,11,0,0,1421,1422,5,2,0,0,1422,1424,
	1,0,0,0,1423,1305,1,0,0,0,1423,1328,1,0,0,0,1423,1347,1,0,0,0,1423,1357,
	1,0,0,0,1423,1375,1,0,0,0,1423,1396,1,0,0,0,1423,1414,1,0,0,0,1424,127,
	1,0,0,0,1425,1426,5,12,0,0,1426,1429,5,180,0,0,1427,1429,5,163,0,0,1428,
	1425,1,0,0,0,1428,1427,1,0,0,0,1429,129,1,0,0,0,1430,1431,5,74,0,0,1431,
	1432,5,12,0,0,1432,1439,5,180,0,0,1433,1434,5,66,0,0,1434,1435,3,256,128,
	0,1435,1436,5,67,0,0,1436,1438,1,0,0,0,1437,1433,1,0,0,0,1438,1441,1,0,
	0,0,1439,1437,1,0,0,0,1439,1440,1,0,0,0,1440,1442,1,0,0,0,1441,1439,1,0,
	0,0,1442,1443,5,169,0,0,1443,1444,5,49,0,0,1444,1445,3,256,128,0,1445,1446,
	5,50,0,0,1446,1447,5,2,0,0,1447,131,1,0,0,0,1448,1452,3,268,134,0,1449,
	1451,3,260,130,0,1450,1449,1,0,0,0,1451,1454,1,0,0,0,1452,1450,1,0,0,0,
	1452,1453,1,0,0,0,1453,1455,1,0,0,0,1454,1452,1,0,0,0,1455,1458,3,14,7,
	0,1456,1457,5,40,0,0,1457,1459,3,256,128,0,1458,1456,1,0,0,0,1458,1459,
	1,0,0,0,1459,1460,1,0,0,0,1460,1461,5,2,0,0,1461,1477,1,0,0,0,1462,1466,
	3,82,41,0,1463,1465,3,260,130,0,1464,1463,1,0,0,0,1465,1468,1,0,0,0,1466,
	1464,1,0,0,0,1466,1467,1,0,0,0,1467,1469,1,0,0,0,1468,1466,1,0,0,0,1469,
	1472,3,14,7,0,1470,1471,5,40,0,0,1471,1473,3,256,128,0,1472,1470,1,0,0,
	0,1472,1473,1,0,0,0,1473,1474,1,0,0,0,1474,1475,5,2,0,0,1475,1477,1,0,0,
	0,1476,1448,1,0,0,0,1476,1462,1,0,0,0,1477,133,1,0,0,0,1478,1479,3,268,
	134,0,1479,1484,5,180,0,0,1480,1481,5,5,0,0,1481,1482,3,268,134,0,1482,
	1483,5,180,0,0,1483,1485,1,0,0,0,1484,1480,1,0,0,0,1485,1486,1,0,0,0,1486,
	1484,1,0,0,0,1486,1487,1,0,0,0,1487,1488,1,0,0,0,1488,1489,5,40,0,0,1489,
	1490,3,256,128,0,1490,1491,5,2,0,0,1491,1527,1,0,0,0,1492,1493,5,49,0,0,
	1493,1496,3,136,68,0,1494,1495,5,5,0,0,1495,1497,3,136,68,0,1496,1494,1,
	0,0,0,1497,1498,1,0,0,0,1498,1496,1,0,0,0,1498,1499,1,0,0,0,1499,1500,1,
	0,0,0,1500,1501,5,50,0,0,1501,1502,5,40,0,0,1502,1503,5,49,0,0,1503,1506,
	3,256,128,0,1504,1505,5,5,0,0,1505,1507,3,256,128,0,1506,1504,1,0,0,0,1507,
	1508,1,0,0,0,1508,1506,1,0,0,0,1508,1509,1,0,0,0,1509,1510,1,0,0,0,1510,
	1511,5,50,0,0,1511,1512,5,2,0,0,1512,1527,1,0,0,0,1513,1514,5,49,0,0,1514,
	1517,3,136,68,0,1515,1516,5,5,0,0,1516,1518,3,136,68,0,1517,1515,1,0,0,
	0,1518,1519,1,0,0,0,1519,1517,1,0,0,0,1519,1520,1,0,0,0,1520,1521,1,0,0,
	0,1521,1522,5,50,0,0,1522,1523,5,40,0,0,1523,1524,3,256,128,0,1524,1525,
	5,2,0,0,1525,1527,1,0,0,0,1526,1478,1,0,0,0,1526,1492,1,0,0,0,1526,1513,
	1,0,0,0,1527,135,1,0,0,0,1528,1532,3,268,134,0,1529,1531,3,260,130,0,1530,
	1529,1,0,0,0,1531,1534,1,0,0,0,1532,1530,1,0,0,0,1532,1533,1,0,0,0,1533,
	1535,1,0,0,0,1534,1532,1,0,0,0,1535,1536,3,14,7,0,1536,1540,1,0,0,0,1537,
	1540,3,14,7,0,1538,1540,1,0,0,0,1539,1528,1,0,0,0,1539,1537,1,0,0,0,1539,
	1538,1,0,0,0,1540,137,1,0,0,0,1541,1542,5,180,0,0,1542,1543,7,10,0,0,1543,
	1544,3,256,128,0,1544,1545,5,2,0,0,1545,1553,1,0,0,0,1546,1547,5,180,0,
	0,1547,1548,7,11,0,0,1548,1553,5,2,0,0,1549,1550,7,11,0,0,1550,1551,5,180,
	0,0,1551,1553,5,2,0,0,1552,1541,1,0,0,0,1552,1546,1,0,0,0,1552,1549,1,0,
	0,0,1553,139,1,0,0,0,1554,1555,5,180,0,0,1555,1556,5,165,0,0,1556,1558,
	5,49,0,0,1557,1559,3,142,71,0,1558,1557,1,0,0,0,1558,1559,1,0,0,0,1559,
	1560,1,0,0,0,1560,1561,5,50,0,0,1561,1590,5,2,0,0,1562,1563,5,180,0,0,1563,
	1564,5,12,0,0,1564,1565,5,180,0,0,1565,1566,5,165,0,0,1566,1568,5,49,0,
	0,1567,1569,3,142,71,0,1568,1567,1,0,0,0,1568,1569,1,0,0,0,1569,1570,1,
	0,0,0,1570,1571,5,50,0,0,1571,1590,5,2,0,0,1572,1577,5,180,0,0,1573,1574,
	5,66,0,0,1574,1575,3,256,128,0,1575,1576,5,67,0,0,1576,1578,1,0,0,0,1577,
	1573,1,0,0,0,1578,1579,1,0,0,0,1579,1577,1,0,0,0,1579,1580,1,0,0,0,1580,
	1581,1,0,0,0,1581,1582,5,165,0,0,1582,1584,5,49,0,0,1583,1585,3,142,71,
	0,1584,1583,1,0,0,0,1584,1585,1,0,0,0,1585,1586,1,0,0,0,1586,1587,5,50,
	0,0,1587,1588,5,2,0,0,1588,1590,1,0,0,0,1589,1554,1,0,0,0,1589,1562,1,0,
	0,0,1589,1572,1,0,0,0,1590,141,1,0,0,0,1591,1592,3,256,128,0,1592,143,1,
	0,0,0,1593,1594,5,180,0,0,1594,1595,5,166,0,0,1595,1596,5,49,0,0,1596,1597,
	5,50,0,0,1597,1620,5,2,0,0,1598,1599,5,180,0,0,1599,1600,5,12,0,0,1600,
	1601,5,180,0,0,1601,1602,5,166,0,0,1602,1603,5,49,0,0,1603,1604,5,50,0,
	0,1604,1620,5,2,0,0,1605,1610,5,180,0,0,1606,1607,5,66,0,0,1607,1608,3,
	256,128,0,1608,1609,5,67,0,0,1609,1611,1,0,0,0,1610,1606,1,0,0,0,1611,1612,
	1,0,0,0,1612,1610,1,0,0,0,1612,1613,1,0,0,0,1613,1614,1,0,0,0,1614,1615,
	5,166,0,0,1615,1616,5,49,0,0,1616,1617,5,50,0,0,1617,1618,5,2,0,0,1618,
	1620,1,0,0,0,1619,1593,1,0,0,0,1619,1598,1,0,0,0,1619,1605,1,0,0,0,1620,
	145,1,0,0,0,1621,1622,5,180,0,0,1622,1623,5,169,0,0,1623,1624,5,49,0,0,
	1624,1625,3,256,128,0,1625,1626,5,50,0,0,1626,1627,5,2,0,0,1627,147,1,0,
	0,0,1628,1629,5,74,0,0,1629,1630,5,12,0,0,1630,1631,5,180,0,0,1631,1632,
	5,165,0,0,1632,1634,5,49,0,0,1633,1635,3,142,71,0,1634,1633,1,0,0,0,1634,
	1635,1,0,0,0,1635,1636,1,0,0,0,1636,1637,5,50,0,0,1637,1670,5,2,0,0,1638,
	1639,5,74,0,0,1639,1640,5,12,0,0,1640,1645,5,180,0,0,1641,1642,5,66,0,0,
	1642,1643,3,256,128,0,1643,1644,5,67,0,0,1644,1646,1,0,0,0,1645,1641,1,
	0,0,0,1646,1647,1,0,0,0,1647,1645,1,0,0,0,1647,1648,1,0,0,0,1648,1649,1,
	0,0,0,1649,1650,5,165,0,0,1650,1652,5,49,0,0,1651,1653,3,142,71,0,1652,
	1651,1,0,0,0,1652,1653,1,0,0,0,1653,1654,1,0,0,0,1654,1655,5,50,0,0,1655,
	1656,5,2,0,0,1656,1670,1,0,0,0,1657,1658,5,74,0,0,1658,1659,5,12,0,0,1659,
	1660,5,180,0,0,1660,1661,5,12,0,0,1661,1662,5,180,0,0,1662,1663,5,165,0,
	0,1663,1665,5,49,0,0,1664,1666,3,142,71,0,1665,1664,1,0,0,0,1665,1666,1,
	0,0,0,1666,1667,1,0,0,0,1667,1668,5,50,0,0,1668,1670,5,2,0,0,1669,1628,
	1,0,0,0,1669,1638,1,0,0,0,1669,1657,1,0,0,0,1670,149,1,0,0,0,1671,1672,
	5,74,0,0,1672,1673,5,12,0,0,1673,1674,5,180,0,0,1674,1675,5,166,0,0,1675,
	1676,5,49,0,0,1676,1677,5,50,0,0,1677,1704,5,2,0,0,1678,1679,5,74,0,0,1679,
	1680,5,12,0,0,1680,1685,5,180,0,0,1681,1682,5,66,0,0,1682,1683,3,256,128,
	0,1683,1684,5,67,0,0,1684,1686,1,0,0,0,1685,1681,1,0,0,0,1686,1687,1,0,
	0,0,1687,1685,1,0,0,0,1687,1688,1,0,0,0,1688,1689,1,0,0,0,1689,1690,5,166,
	0,0,1690,1691,5,49,0,0,1691,1692,5,50,0,0,1692,1693,5,2,0,0,1693,1704,1,
	0,0,0,1694,1695,5,74,0,0,1695,1696,5,12,0,0,1696,1697,5,180,0,0,1697,1698,
	5,12,0,0,1698,1699,5,180,0,0,1699,1700,5,166,0,0,1700,1701,5,49,0,0,1701,
	1702,5,50,0,0,1702,1704,5,2,0,0,1703,1671,1,0,0,0,1703,1678,1,0,0,0,1703,
	1694,1,0,0,0,1704,151,1,0,0,0,1705,1706,5,89,0,0,1706,1707,5,180,0,0,1707,
	1758,5,2,0,0,1708,1709,5,89,0,0,1709,1710,5,74,0,0,1710,1711,5,12,0,0,1711,
	1712,5,180,0,0,1712,1758,5,2,0,0,1713,1714,5,89,0,0,1714,1715,5,74,0,0,
	1715,1716,5,12,0,0,1716,1721,5,180,0,0,1717,1718,5,66,0,0,1718,1719,3,256,
	128,0,1719,1720,5,67,0,0,1720,1722,1,0,0,0,1721,1717,1,0,0,0,1722,1723,
	1,0,0,0,1723,1721,1,0,0,0,1723,1724,1,0,0,0,1724,1725,1,0,0,0,1725,1726,
	5,2,0,0,1726,1758,1,0,0,0,1727,1728,5,89,0,0,1728,1733,5,180,0,0,1729,1730,
	5,66,0,0,1730,1731,3,256,128,0,1731,1732,5,67,0,0,1732,1734,1,0,0,0,1733,
	1729,1,0,0,0,1734,1735,1,0,0,0,1735,1733,1,0,0,0,1735,1736,1,0,0,0,1736,
	1737,1,0,0,0,1737,1738,5,2,0,0,1738,1758,1,0,0,0,1739,1740,5,89,0,0,1740,
	1743,5,180,0,0,1741,1742,5,12,0,0,1742,1744,5,180,0,0,1743,1741,1,0,0,0,
	1744,1745,1,0,0,0,1745,1743,1,0,0,0,1745,1746,1,0,0,0,1746,1751,1,0,0,0,
	1747,1748,5,66,0,0,1748,1749,3,256,128,0,1749,1750,5,67,0,0,1750,1752,1,
	0,0,0,1751,1747,1,0,0,0,1752,1753,1,0,0,0,1753,1751,1,0,0,0,1753,1754,1,
	0,0,0,1754,1755,1,0,0,0,1755,1756,5,2,0,0,1756,1758,1,0,0,0,1757,1705,1,
	0,0,0,1757,1708,1,0,0,0,1757,1713,1,0,0,0,1757,1727,1,0,0,0,1757,1739,1,
	0,0,0,1758,153,1,0,0,0,1759,1760,5,90,0,0,1760,1761,5,49,0,0,1761,1762,
	5,154,0,0,1762,1763,5,23,0,0,1763,1766,3,256,128,0,1764,1765,5,5,0,0,1765,
	1767,3,232,116,0,1766,1764,1,0,0,0,1766,1767,1,0,0,0,1767,1768,1,0,0,0,
	1768,1769,5,50,0,0,1769,1770,5,2,0,0,1770,155,1,0,0,0,1771,1772,5,90,0,
	0,1772,1773,5,49,0,0,1773,1776,3,256,128,0,1774,1775,5,5,0,0,1775,1777,
	3,232,116,0,1776,1774,1,0,0,0,1776,1777,1,0,0,0,1777,1778,1,0,0,0,1778,
	1779,5,50,0,0,1779,1780,5,2,0,0,1780,157,1,0,0,0,1781,1782,5,91,0,0,1782,
	1783,5,49,0,0,1783,1784,3,256,128,0,1784,1785,5,50,0,0,1785,1788,3,108,
	54,0,1786,1787,5,92,0,0,1787,1789,3,108,54,0,1788,1786,1,0,0,0,1788,1789,
	1,0,0,0,1789,159,1,0,0,0,1790,1797,3,176,88,0,1791,1797,3,178,89,0,1792,
	1797,3,168,84,0,1793,1797,3,162,81,0,1794,1797,3,164,82,0,1795,1797,3,166,
	83,0,1796,1790,1,0,0,0,1796,1791,1,0,0,0,1796,1792,1,0,0,0,1796,1793,1,
	0,0,0,1796,1794,1,0,0,0,1796,1795,1,0,0,0,1797,161,1,0,0,0,1798,1799,5,
	9,0,0,1799,1800,5,49,0,0,1800,1801,3,268,134,0,1801,1802,5,180,0,0,1802,
	1803,5,5,0,0,1803,1804,3,268,134,0,1804,1805,5,180,0,0,1805,1806,5,93,0,
	0,1806,1807,5,74,0,0,1807,1808,5,12,0,0,1808,1809,5,180,0,0,1809,1810,5,
	12,0,0,1810,1811,5,34,0,0,1811,1812,5,50,0,0,1812,1813,3,108,54,0,1813,
	163,1,0,0,0,1814,1815,5,9,0,0,1815,1816,5,49,0,0,1816,1817,3,268,134,0,
	1817,1818,5,180,0,0,1818,1819,5,94,0,0,1819,1820,5,74,0,0,1820,1821,5,12,
	0,0,1821,1822,5,180,0,0,1822,1823,5,50,0,0,1823,1824,3,108,54,0,1824,165,
	1,0,0,0,1825,1826,5,9,0,0,1826,1827,5,49,0,0,1827,1828,3,268,134,0,1828,
	1829,5,180,0,0,1829,1830,5,93,0,0,1830,1831,5,74,0,0,1831,1832,5,12,0,0,
	1832,1833,5,180,0,0,1833,1834,5,50,0,0,1834,1835,3,108,54,0,1835,167,1,
	0,0,0,1836,1837,5,9,0,0,1837,1838,5,49,0,0,1838,1839,3,170,85,0,1839,1841,
	3,172,86,0,1840,1842,3,174,87,0,1841,1840,1,0,0,0,1841,1842,1,0,0,0,1842,
	1843,1,0,0,0,1843,1844,5,50,0,0,1844,1845,3,108,54,0,1845,169,1,0,0,0,1846,
	1850,3,268,134,0,1847,1849,3,260,130,0,1848,1847,1,0,0,0,1849,1852,1,0,
	0,0,1850,1848,1,0,0,0,1850,1851,1,0,0,0,1851,1853,1,0,0,0,1852,1850,1,0,
	0,0,1853,1856,5,180,0,0,1854,1855,5,40,0,0,1855,1857,3,256,128,0,1856,1854,
	1,0,0,0,1856,1857,1,0,0,0,1857,1858,1,0,0,0,1858,1859,5,2,0,0,1859,1867,
	1,0,0,0,1860,1861,5,180,0,0,1861,1862,7,10,0,0,1862,1863,3,256,128,0,1863,
	1864,5,2,0,0,1864,1867,1,0,0,0,1865,1867,5,2,0,0,1866,1846,1,0,0,0,1866,
	1860,1,0,0,0,1866,1865,1,0,0,0,1867,171,1,0,0,0,1868,1869,3,256,128,0,1869,
	1870,5,2,0,0,1870,173,1,0,0,0,1871,1872,5,180,0,0,1872,1873,7,10,0,0,1873,
	1879,3,256,128,0,1874,1875,5,180,0,0,1875,1879,7,11,0,0,1876,1877,7,11,
	0,0,1877,1879,5,180,0,0,1878,1871,1,0,0,0,1878,1874,1,0,0,0,1878,1876,1,
	0,0,0,1879,175,1,0,0,0,1880,1881,5,95,0,0,1881,1882,3,108,54,0,1882,1883,
	5,96,0,0,1883,1884,5,49,0,0,1884,1885,3,256,128,0,1885,1886,5,50,0,0,1886,
	1887,5,2,0,0,1887,177,1,0,0,0,1888,1889,5,96,0,0,1889,1890,5,49,0,0,1890,
	1891,3,256,128,0,1891,1892,5,50,0,0,1892,1893,3,108,54,0,1893,179,1,0,0,
	0,1894,1895,5,97,0,0,1895,1896,3,240,120,0,1896,1897,5,2,0,0,1897,181,1,
	0,0,0,1898,1899,5,98,0,0,1899,1900,3,184,92,0,1900,183,1,0,0,0,1901,1905,
	5,4,0,0,1902,1904,3,186,93,0,1903,1902,1,0,0,0,1904,1907,1,0,0,0,1905,1903,
	1,0,0,0,1905,1906,1,0,0,0,1906,1908,1,0,0,0,1907,1905,1,0,0,0,1908,1909,
	5,6,0,0,1909,185,1,0,0,0,1910,1924,3,184,92,0,1911,1924,3,188,94,0,1912,
	1924,3,190,95,0,1913,1924,3,192,96,0,1914,1924,3,194,97,0,1915,1924,3,200,
	100,0,1916,1924,3,202,101,0,1917,1924,5,99,0,0,1918,1924,5,100,0,0,1919,
	1924,5,101,0,0,1920,1924,3,206,103,0,1921,1924,3,210,105,0,1922,1924,3,
	212,106,0,1923,1910,1,0,0,0,1923,1911,1,0,0,0,1923,1912,1,0,0,0,1923,1913,
	1,0,0,0,1923,1914,1,0,0,0,1923,1915,1,0,0,0,1923,1916,1,0,0,0,1923,1917,
	1,0,0,0,1923,1918,1,0,0,0,1923,1919,1,0,0,0,1923,1920,1,0,0,0,1923,1921,
	1,0,0,0,1923,1922,1,0,0,0,1924,187,1,0,0,0,1925,1926,5,102,0,0,1926,1931,
	3,14,7,0,1927,1928,5,5,0,0,1928,1930,3,14,7,0,1929,1927,1,0,0,0,1930,1933,
	1,0,0,0,1931,1929,1,0,0,0,1931,1932,1,0,0,0,1932,1936,1,0,0,0,1933,1931,
	1,0,0,0,1934,1935,5,103,0,0,1935,1937,3,204,102,0,1936,1934,1,0,0,0,1936,
	1937,1,0,0,0,1937,189,1,0,0,0,1938,1943,3,210,105,0,1939,1940,5,5,0,0,1940,
	1942,3,210,105,0,1941,1939,1,0,0,0,1942,1945,1,0,0,0,1943,1941,1,0,0,0,
	1943,1944,1,0,0,0,1944,1946,1,0,0,0,1945,1943,1,0,0,0,1946,1947,5,103,0,
	0,1947,1948,3,204,102,0,1948,191,1,0,0,0,1949,1950,5,91,0,0,1950,1951,3,
	204,102,0,1951,1952,3,184,92,0,1952,193,1,0,0,0,1953,1954,5,104,0,0,1954,
	1964,3,204,102,0,1955,1957,3,196,98,0,1956,1955,1,0,0,0,1957,1958,1,0,0,
	0,1958,1956,1,0,0,0,1958,1959,1,0,0,0,1959,1961,1,0,0,0,1960,1962,3,198,
	99,0,1961,1960,1,0,0,0,1961,1962,1,0,0,0,1962,1965,1,0,0,0,1963,1965,3,
	198,99,0,1964,1956,1,0,0,0,1964,1963,1,0,0,0,1965,195,1,0,0,0,1966,1967,
	5,105,0,0,1967,1968,3,212,106,0,1968,1969,3,184,92,0,1969,197,1,0,0,0,1970,
	1971,5,106,0,0,1971,1972,3,184,92,0,1972,199,1,0,0,0,1973,1974,5,9,0,0,
	1974,1975,3,184,92,0,1975,1976,3,204,102,0,1976,1977,3,184,92,0,1977,1978,
	3,184,92,0,1978,201,1,0,0,0,1979,1980,5,7,0,0,1980,1981,5,180,0,0,1981,
	1990,5,49,0,0,1982,1987,5,180,0,0,1983,1984,5,5,0,0,1984,1986,5,180,0,0,
	1985,1983,1,0,0,0,1986,1989,1,0,0,0,1987,1985,1,0,0,0,1987,1988,1,0,0,0,
	1988,1991,1,0,0,0,1989,1987,1,0,0,0,1990,1982,1,0,0,0,1990,1991,1,0,0,0,
	1991,1992,1,0,0,0,1992,2002,5,50,0,0,1993,1994,5,107,0,0,1994,1999,5,180,
	0,0,1995,1996,5,5,0,0,1996,1998,5,180,0,0,1997,1995,1,0,0,0,1998,2001,1,
	0,0,0,1999,1997,1,0,0,0,1999,2000,1,0,0,0,2000,2003,1,0,0,0,2001,1999,1,
	0,0,0,2002,1993,1,0,0,0,2002,2003,1,0,0,0,2003,2004,1,0,0,0,2004,2005,3,
	184,92,0,2005,203,1,0,0,0,2006,2010,3,206,103,0,2007,2010,3,210,105,0,2008,
	2010,3,212,106,0,2009,2006,1,0,0,0,2009,2007,1,0,0,0,2009,2008,1,0,0,0,
	2010,205,1,0,0,0,2011,2012,3,208,104,0,2012,2021,5,49,0,0,2013,2018,3,204,
	102,0,2014,2015,5,5,0,0,2015,2017,3,204,102,0,2016,2014,1,0,0,0,2017,2020,
	1,0,0,0,2018,2016,1,0,0,0,2018,2019,1,0,0,0,2019,2022,1,0,0,0,2020,2018,
	1,0,0,0,2021,2013,1,0,0,0,2021,2022,1,0,0,0,2022,2023,1,0,0,0,2023,2024,
	5,50,0,0,2024,207,1,0,0,0,2025,2026,7,12,0,0,2026,209,1,0,0,0,2027,2032,
	3,14,7,0,2028,2029,5,12,0,0,2029,2031,3,14,7,0,2030,2028,1,0,0,0,2031,2034,
	1,0,0,0,2032,2030,1,0,0,0,2032,2033,1,0,0,0,2033,211,1,0,0,0,2034,2032,
	1,0,0,0,2035,2036,7,13,0,0,2036,213,1,0,0,0,2037,2038,5,109,0,0,2038,2042,
	5,4,0,0,2039,2041,3,110,55,0,2040,2039,1,0,0,0,2041,2044,1,0,0,0,2042,2040,
	1,0,0,0,2042,2043,1,0,0,0,2043,2045,1,0,0,0,2044,2042,1,0,0,0,2045,2046,
	5,6,0,0,2046,215,1,0,0,0,2047,2048,5,104,0,0,2048,2049,5,49,0,0,2049,2050,
	3,256,128,0,2050,2051,5,50,0,0,2051,2055,5,4,0,0,2052,2054,3,218,109,0,
	2053,2052,1,0,0,0,2054,2057,1,0,0,0,2055,2053,1,0,0,0,2055,2056,1,0,0,0,
	2056,2059,1,0,0,0,2057,2055,1,0,0,0,2058,2060,3,220,110,0,2059,2058,1,0,
	0,0,2059,2060,1,0,0,0,2060,2061,1,0,0,0,2061,2062,5,6,0,0,2062,217,1,0,
	0,0,2063,2064,5,105,0,0,2064,2065,3,256,128,0,2065,2069,5,110,0,0,2066,
	2068,3,110,55,0,2067,2066,1,0,0,0,2068,2071,1,0,0,0,2069,2067,1,0,0,0,2069,
	2070,1,0,0,0,2070,219,1,0,0,0,2071,2069,1,0,0,0,2072,2073,5,106,0,0,2073,
	2077,5,110,0,0,2074,2076,3,110,55,0,2075,2074,1,0,0,0,2076,2079,1,0,0,0,
	2077,2075,1,0,0,0,2077,2078,1,0,0,0,2078,221,1,0,0,0,2079,2077,1,0,0,0,
	2080,2081,5,111,0,0,2081,2083,3,256,128,0,2082,2084,3,224,112,0,2083,2082,
	1,0,0,0,2083,2084,1,0,0,0,2084,2085,1,0,0,0,2085,2087,3,108,54,0,2086,2088,
	3,226,113,0,2087,2086,1,0,0,0,2088,2089,1,0,0,0,2089,2087,1,0,0,0,2089,
	2090,1,0,0,0,2090,223,1,0,0,0,2091,2092,5,73,0,0,2092,2104,5,49,0,0,2093,
	2098,3,106,53,0,2094,2095,5,5,0,0,2095,2097,3,106,53,0,2096,2094,1,0,0,
	0,2097,2100,1,0,0,0,2098,2096,1,0,0,0,2098,2099,1,0,0,0,2099,2102,1,0,0,
	0,2100,2098,1,0,0,0,2101,2103,5,5,0,0,2102,2101,1,0,0,0,2102,2103,1,0,0,
	0,2103,2105,1,0,0,0,2104,2093,1,0,0,0,2104,2105,1,0,0,0,2105,2106,1,0,0,
	0,2106,2107,5,50,0,0,2107,225,1,0,0,0,2108,2110,5,112,0,0,2109,2111,5,180,
	0,0,2110,2109,1,0,0,0,2110,2111,1,0,0,0,2111,2127,1,0,0,0,2112,2124,5,49,
	0,0,2113,2118,3,106,53,0,2114,2115,5,5,0,0,2115,2117,3,106,53,0,2116,2114,
	1,0,0,0,2117,2120,1,0,0,0,2118,2116,1,0,0,0,2118,2119,1,0,0,0,2119,2122,
	1,0,0,0,2120,2118,1,0,0,0,2121,2123,5,5,0,0,2122,2121,1,0,0,0,2122,2123,
	1,0,0,0,2123,2125,1,0,0,0,2124,2113,1,0,0,0,2124,2125,1,0,0,0,2125,2126,
	1,0,0,0,2126,2128,5,50,0,0,2127,2112,1,0,0,0,2127,2128,1,0,0,0,2128,2129,
	1,0,0,0,2129,2130,3,108,54,0,2130,227,1,0,0,0,2131,2132,5,99,0,0,2132,2133,
	5,2,0,0,2133,229,1,0,0,0,2134,2135,5,100,0,0,2135,2136,5,2,0,0,2136,231,
	1,0,0,0,2137,2141,5,151,0,0,2138,2139,5,180,0,0,2139,2141,3,246,123,0,2140,
	2137,1,0,0,0,2140,2138,1,0,0,0,2141,233,1,0,0,0,2142,2143,5,36,0,0,2143,
	2146,5,180,0,0,2144,2145,5,12,0,0,2145,2147,5,180,0,0,2146,2144,1,0,0,0,
	2146,2147,1,0,0,0,2147,2148,1,0,0,0,2148,2149,5,49,0,0,2149,2161,5,4,0,
	0,2150,2155,3,244,122,0,2151,2152,5,5,0,0,2152,2154,3,244,122,0,2153,2151,
	1,0,0,0,2154,2157,1,0,0,0,2155,2153,1,0,0,0,2155,2156,1,0,0,0,2156,2159,
	1,0,0,0,2157,2155,1,0,0,0,2158,2160,5,5,0,0,2159,2158,1,0,0,0,2159,2160,
	1,0,0,0,2160,2162,1,0,0,0,2161,2150,1,0,0,0,2161,2162,1,0,0,0,2162,2163,
	1,0,0,0,2163,2164,5,6,0,0,2164,2165,5,50,0,0,2165,2185,5,2,0,0,2166,2167,
	5,36,0,0,2167,2170,5,180,0,0,2168,2169,5,12,0,0,2169,2171,5,180,0,0,2170,
	2168,1,0,0,0,2170,2171,1,0,0,0,2171,2172,1,0,0,0,2172,2173,3,246,123,0,
	2173,2174,5,2,0,0,2174,2185,1,0,0,0,2175,2176,5,36,0,0,2176,2177,5,49,0,
	0,2177,2178,5,151,0,0,2178,2179,5,50,0,0,2179,2185,5,2,0,0,2180,2181,5,
	36,0,0,2181,2182,5,49,0,0,2182,2183,5,50,0,0,2183,2185,5,2,0,0,2184,2142,
	1,0,0,0,2184,2166,1,0,0,0,2184,2175,1,0,0,0,2184,2180,1,0,0,0,2185,235,
	1,0,0,0,2186,2187,5,113,0,0,2187,2188,5,49,0,0,2188,2189,3,256,128,0,2189,
	2190,5,50,0,0,2190,2191,5,2,0,0,2191,237,1,0,0,0,2192,2195,5,180,0,0,2193,
	2195,3,262,131,0,2194,2192,1,0,0,0,2194,2193,1,0,0,0,2195,239,1,0,0,0,2196,
	2208,5,49,0,0,2197,2202,3,238,119,0,2198,2199,5,5,0,0,2199,2201,3,238,119,
	0,2200,2198,1,0,0,0,2201,2204,1,0,0,0,2202,2200,1,0,0,0,2202,2203,1,0,0,
	0,2203,2206,1,0,0,0,2204,2202,1,0,0,0,2205,2207,5,5,0,0,2206,2205,1,0,0,
	0,2206,2207,1,0,0,0,2207,2209,1,0,0,0,2208,2197,1,0,0,0,2208,2209,1,0,0,
	0,2209,2210,1,0,0,0,2210,2211,5,50,0,0,2211,241,1,0,0,0,2212,2213,5,180,
	0,0,2213,2237,3,246,123,0,2214,2215,5,180,0,0,2215,2216,5,12,0,0,2216,2217,
	5,180,0,0,2217,2237,3,246,123,0,2218,2219,5,180,0,0,2219,2220,5,49,0,0,
	2220,2232,5,4,0,0,2221,2226,3,244,122,0,2222,2223,5,5,0,0,2223,2225,3,244,
	122,0,2224,2222,1,0,0,0,2225,2228,1,0,0,0,2226,2224,1,0,0,0,2226,2227,1,
	0,0,0,2227,2230,1,0,0,0,2228,2226,1,0,0,0,2229,2231,5,5,0,0,2230,2229,1,
	0,0,0,2230,2231,1,0,0,0,2231,2233,1,0,0,0,2232,2221,1,0,0,0,2232,2233,1,
	0,0,0,2233,2234,1,0,0,0,2234,2235,5,6,0,0,2235,2237,5,50,0,0,2236,2212,
	1,0,0,0,2236,2214,1,0,0,0,2236,2218,1,0,0,0,2237,243,1,0,0,0,2238,2239,
	5,180,0,0,2239,2240,5,110,0,0,2240,2241,3,256,128,0,2241,245,1,0,0,0,2242,
	2254,5,49,0,0,2243,2248,3,256,128,0,2244,2245,5,5,0,0,2245,2247,3,256,128,
	0,2246,2244,1,0,0,0,2247,2250,1,0,0,0,2248,2246,1,0,0,0,2248,2249,1,0,0,
	0,2249,2252,1,0,0,0,2250,2248,1,0,0,0,2251,2253,5,5,0,0,2252,2251,1,0,0,
	0,2252,2253,1,0,0,0,2253,2255,1,0,0,0,2254,2243,1,0,0,0,2254,2255,1,0,0,
	0,2255,2256,1,0,0,0,2256,2257,5,50,0,0,2257,247,1,0,0,0,2258,2259,5,4,0,
	0,2259,2264,3,250,125,0,2260,2261,5,5,0,0,2261,2263,3,250,125,0,2262,2260,
	1,0,0,0,2263,2266,1,0,0,0,2264,2262,1,0,0,0,2264,2265,1,0,0,0,2265,2268,
	1,0,0,0,2266,2264,1,0,0,0,2267,2269,5,5,0,0,2268,2267,1,0,0,0,2268,2269,
	1,0,0,0,2269,2270,1,0,0,0,2270,2271,5,6,0,0,2271,249,1,0,0,0,2272,2273,
	5,180,0,0,2273,2274,5,110,0,0,2274,2275,3,256,128,0,2275,251,1,0,0,0,2276,
	2277,5,49,0,0,2277,2282,3,254,127,0,2278,2279,5,5,0,0,2279,2281,3,254,127,
	0,2280,2278,1,0,0,0,2281,2284,1,0,0,0,2282,2280,1,0,0,0,2282,2283,1,0,0,
	0,2283,2286,1,0,0,0,2284,2282,1,0,0,0,2285,2287,5,5,0,0,2286,2285,1,0,0,
	0,2286,2287,1,0,0,0,2287,2288,1,0,0,0,2288,2289,5,50,0,0,2289,253,1,0,0,
	0,2290,2293,3,268,134,0,2291,2293,3,82,41,0,2292,2290,1,0,0,0,2292,2291,
	1,0,0,0,2293,255,1,0,0,0,2294,2295,6,128,-1,0,2295,2296,5,49,0,0,2296,2297,
	5,180,0,0,2297,2298,7,10,0,0,2298,2299,3,256,128,0,2299,2300,5,50,0,0,2300,
	2450,1,0,0,0,2301,2302,5,49,0,0,2302,2303,3,256,128,0,2303,2304,5,50,0,
	0,2304,2450,1,0,0,0,2305,2306,5,49,0,0,2306,2309,3,256,128,0,2307,2308,
	5,5,0,0,2308,2310,3,256,128,0,2309,2307,1,0,0,0,2310,2311,1,0,0,0,2311,
	2309,1,0,0,0,2311,2312,1,0,0,0,2312,2313,1,0,0,0,2313,2314,5,50,0,0,2314,
	2450,1,0,0,0,2315,2316,3,270,135,0,2316,2317,5,49,0,0,2317,2319,3,256,128,
	0,2318,2320,5,5,0,0,2319,2318,1,0,0,0,2319,2320,1,0,0,0,2320,2321,1,0,0,
	0,2321,2322,5,50,0,0,2322,2450,1,0,0,0,2323,2450,3,242,121,0,2324,2325,
	5,114,0,0,2325,2327,5,180,0,0,2326,2328,3,248,124,0,2327,2326,1,0,0,0,2327,
	2328,1,0,0,0,2328,2329,1,0,0,0,2329,2450,3,246,123,0,2330,2331,5,114,0,
	0,2331,2334,3,268,134,0,2332,2333,5,66,0,0,2333,2335,5,67,0,0,2334,2332,
	1,0,0,0,2335,2336,1,0,0,0,2336,2334,1,0,0,0,2336,2337,1,0,0,0,2337,2338,
	1,0,0,0,2338,2339,5,49,0,0,2339,2340,3,256,128,0,2340,2341,5,50,0,0,2341,
	2450,1,0,0,0,2342,2343,5,114,0,0,2343,2344,5,148,0,0,2344,2345,5,49,0,0,
	2345,2346,3,256,128,0,2346,2347,5,50,0,0,2347,2450,1,0,0,0,2348,2349,5,
	55,0,0,2349,2350,5,49,0,0,2350,2351,3,268,134,0,2351,2352,5,50,0,0,2352,
	2353,5,12,0,0,2353,2354,5,180,0,0,2354,2450,1,0,0,0,2355,2356,5,115,0,0,
	2356,2450,3,246,123,0,2357,2358,5,116,0,0,2358,2450,3,246,123,0,2359,2360,
	5,117,0,0,2360,2450,3,246,123,0,2361,2362,5,118,0,0,2362,2450,3,246,123,
	0,2363,2364,5,119,0,0,2364,2365,5,49,0,0,2365,2366,5,180,0,0,2366,2367,
	5,12,0,0,2367,2368,5,180,0,0,2368,2369,5,5,0,0,2369,2370,3,246,123,0,2370,
	2371,5,50,0,0,2371,2450,1,0,0,0,2372,2373,5,120,0,0,2373,2450,3,246,123,
	0,2374,2375,5,121,0,0,2375,2450,3,246,123,0,2376,2377,5,122,0,0,2377,2378,
	5,49,0,0,2378,2379,3,256,128,0,2379,2380,5,5,0,0,2380,2381,3,252,126,0,
	2381,2382,5,50,0,0,2382,2450,1,0,0,0,2383,2384,5,123,0,0,2384,2385,5,49,
	0,0,2385,2386,3,256,128,0,2386,2387,5,5,0,0,2387,2388,3,252,126,0,2388,
	2389,5,5,0,0,2389,2390,5,145,0,0,2390,2391,5,50,0,0,2391,2450,1,0,0,0,2392,
	2393,5,124,0,0,2393,2394,5,66,0,0,2394,2395,3,256,128,0,2395,2396,5,67,
	0,0,2396,2397,7,14,0,0,2397,2450,1,0,0,0,2398,2399,5,125,0,0,2399,2400,
	5,66,0,0,2400,2401,3,256,128,0,2401,2402,5,67,0,0,2402,2403,7,15,0,0,2403,
	2450,1,0,0,0,2404,2405,7,16,0,0,2405,2450,3,256,128,21,2406,2418,5,66,0,
	0,2407,2412,3,256,128,0,2408,2409,5,5,0,0,2409,2411,3,256,128,0,2410,2408,
	1,0,0,0,2411,2414,1,0,0,0,2412,2410,1,0,0,0,2412,2413,1,0,0,0,2413,2416,
	1,0,0,0,2414,2412,1,0,0,0,2415,2417,5,5,0,0,2416,2415,1,0,0,0,2416,2417,
	1,0,0,0,2417,2419,1,0,0,0,2418,2407,1,0,0,0,2418,2419,1,0,0,0,2419,2420,
	1,0,0,0,2420,2450,5,67,0,0,2421,2422,5,74,0,0,2422,2423,5,12,0,0,2423,2424,
	5,180,0,0,2424,2425,5,12,0,0,2425,2426,5,180,0,0,2426,2427,5,66,0,0,2427,
	2428,3,256,128,0,2428,2429,5,67,0,0,2429,2430,3,258,129,0,2430,2450,1,0,
	0,0,2431,2432,5,74,0,0,2432,2433,5,12,0,0,2433,2438,5,180,0,0,2434,2435,
	5,66,0,0,2435,2436,3,256,128,0,2436,2437,5,67,0,0,2437,2439,1,0,0,0,2438,
	2434,1,0,0,0,2439,2440,1,0,0,0,2440,2438,1,0,0,0,2440,2441,1,0,0,0,2441,
	2450,1,0,0,0,2442,2443,5,74,0,0,2443,2444,5,12,0,0,2444,2450,5,180,0,0,
	2445,2450,5,74,0,0,2446,2450,5,160,0,0,2447,2450,3,14,7,0,2448,2450,3,262,
	131,0,2449,2294,1,0,0,0,2449,2301,1,0,0,0,2449,2305,1,0,0,0,2449,2315,1,
	0,0,0,2449,2323,1,0,0,0,2449,2324,1,0,0,0,2449,2330,1,0,0,0,2449,2342,1,
	0,0,0,2449,2348,1,0,0,0,2449,2355,1,0,0,0,2449,2357,1,0,0,0,2449,2359,1,
	0,0,0,2449,2361,1,0,0,0,2449,2363,1,0,0,0,2449,2372,1,0,0,0,2449,2374,1,
	0,0,0,2449,2376,1,0,0,0,2449,2383,1,0,0,0,2449,2392,1,0,0,0,2449,2398,1,
	0,0,0,2449,2404,1,0,0,0,2449,2406,1,0,0,0,2449,2421,1,0,0,0,2449,2431,1,
	0,0,0,2449,2442,1,0,0,0,2449,2445,1,0,0,0,2449,2446,1,0,0,0,2449,2447,1,
	0,0,0,2449,2448,1,0,0,0,2450,2558,1,0,0,0,2451,2452,10,20,0,0,2452,2453,
	5,17,0,0,2453,2557,3,256,128,20,2454,2455,10,19,0,0,2455,2456,7,17,0,0,
	2456,2557,3,256,128,20,2457,2458,10,18,0,0,2458,2459,7,18,0,0,2459,2557,
	3,256,128,19,2460,2461,10,17,0,0,2461,2462,7,19,0,0,2462,2557,3,256,128,
	18,2463,2464,10,16,0,0,2464,2465,7,20,0,0,2465,2557,3,256,128,17,2466,2467,
	10,15,0,0,2467,2468,7,21,0,0,2468,2557,3,256,128,16,2469,2470,10,14,0,0,
	2470,2471,5,24,0,0,2471,2557,3,256,128,15,2472,2473,10,13,0,0,2473,2474,
	5,26,0,0,2474,2557,3,256,128,14,2475,2476,10,12,0,0,2476,2477,5,25,0,0,
	2477,2557,3,256,128,13,2478,2479,10,11,0,0,2479,2480,5,130,0,0,2480,2557,
	3,256,128,12,2481,2482,10,10,0,0,2482,2483,5,131,0,0,2483,2557,3,256,128,
	11,2484,2485,10,9,0,0,2485,2486,5,132,0,0,2486,2487,3,256,128,0,2487,2488,
	5,110,0,0,2488,2489,3,256,128,9,2489,2557,1,0,0,0,2490,2491,10,33,0,0,2491,
	2492,5,66,0,0,2492,2493,3,256,128,0,2493,2494,5,110,0,0,2494,2495,3,256,
	128,0,2495,2496,5,67,0,0,2496,2557,1,0,0,0,2497,2498,10,32,0,0,2498,2499,
	5,66,0,0,2499,2500,5,145,0,0,2500,2557,5,67,0,0,2501,2502,10,31,0,0,2502,
	2503,5,66,0,0,2503,2504,3,256,128,0,2504,2505,5,67,0,0,2505,2557,1,0,0,
	0,2506,2507,10,28,0,0,2507,2557,7,22,0,0,2508,2509,10,27,0,0,2509,2510,
	5,167,0,0,2510,2511,5,49,0,0,2511,2512,3,256,128,0,2512,2513,5,50,0,0,2513,
	2557,1,0,0,0,2514,2515,10,26,0,0,2515,2516,5,168,0,0,2516,2517,5,49,0,0,
	2517,2518,3,256,128,0,2518,2519,5,5,0,0,2519,2520,3,256,128,0,2520,2521,
	5,50,0,0,2521,2557,1,0,0,0,2522,2523,10,25,0,0,2523,2524,5,12,0,0,2524,
	2526,5,180,0,0,2525,2527,3,248,124,0,2526,2525,1,0,0,0,2526,2527,1,0,0,
	0,2527,2528,1,0,0,0,2528,2529,5,49,0,0,2529,2541,5,4,0,0,2530,2535,3,244,
	122,0,2531,2532,5,5,0,0,2532,2534,3,244,122,0,2533,2531,1,0,0,0,2534,2537,
	1,0,0,0,2535,2533,1,0,0,0,2535,2536,1,0,0,0,2536,2539,1,0,0,0,2537,2535,
	1,0,0,0,2538,2540,5,5,0,0,2539,2538,1,0,0,0,2539,2540,1,0,0,0,2540,2542,
	1,0,0,0,2541,2530,1,0,0,0,2541,2542,1,0,0,0,2542,2543,1,0,0,0,2543,2544,
	5,6,0,0,2544,2557,5,50,0,0,2545,2546,10,24,0,0,2546,2547,5,12,0,0,2547,
	2549,5,180,0,0,2548,2550,3,248,124,0,2549,2548,1,0,0,0,2549,2550,1,0,0,
	0,2550,2551,1,0,0,0,2551,2557,3,246,123,0,2552,2553,10,23,0,0,2553,2557,
	3,258,129,0,2554,2555,10,22,0,0,2555,2557,7,11,0,0,2556,2451,1,0,0,0,2556,
	2454,1,0,0,0,2556,2457,1,0,0,0,2556,2460,1,0,0,0,2556,2463,1,0,0,0,2556,
	2466,1,0,0,0,2556,2469,1,0,0,0,2556,2472,1,0,0,0,2556,2475,1,0,0,0,2556,
	2478,1,0,0,0,2556,2481,1,0,0,0,2556,2484,1,0,0,0,2556,2490,1,0,0,0,2556,
	2497,1,0,0,0,2556,2501,1,0,0,0,2556,2506,1,0,0,0,2556,2508,1,0,0,0,2556,
	2514,1,0,0,0,2556,2522,1,0,0,0,2556,2545,1,0,0,0,2556,2552,1,0,0,0,2556,
	2554,1,0,0,0,2557,2560,1,0,0,0,2558,2556,1,0,0,0,2558,2559,1,0,0,0,2559,
	257,1,0,0,0,2560,2558,1,0,0,0,2561,2562,5,12,0,0,2562,2575,5,180,0,0,2563,
	2575,5,163,0,0,2564,2575,5,172,0,0,2565,2575,5,173,0,0,2566,2575,5,174,
	0,0,2567,2575,5,175,0,0,2568,2575,5,176,0,0,2569,2575,5,177,0,0,2570,2575,
	5,178,0,0,2571,2575,5,179,0,0,2572,2575,5,170,0,0,2573,2575,5,171,0,0,2574,
	2561,1,0,0,0,2574,2563,1,0,0,0,2574,2564,1,0,0,0,2574,2565,1,0,0,0,2574,
	2566,1,0,0,0,2574,2567,1,0,0,0,2574,2568,1,0,0,0,2574,2569,1,0,0,0,2574,
	2570,1,0,0,0,2574,2571,1,0,0,0,2574,2572,1,0,0,0,2574,2573,1,0,0,0,2575,
	259,1,0,0,0,2576,2577,7,23,0,0,2577,261,1,0,0,0,2578,2593,5,141,0,0,2579,
	2593,3,264,132,0,2580,2593,3,266,133,0,2581,2585,5,151,0,0,2582,2584,5,
	151,0,0,2583,2582,1,0,0,0,2584,2587,1,0,0,0,2585,2583,1,0,0,0,2585,2586,
	1,0,0,0,2586,2593,1,0,0,0,2587,2585,1,0,0,0,2588,2593,5,161,0,0,2589,2593,
	5,162,0,0,2590,2593,5,152,0,0,2591,2593,5,153,0,0,2592,2578,1,0,0,0,2592,
	2579,1,0,0,0,2592,2580,1,0,0,0,2592,2581,1,0,0,0,2592,2588,1,0,0,0,2592,
	2589,1,0,0,0,2592,2590,1,0,0,0,2592,2591,1,0,0,0,2593,263,1,0,0,0,2594,
	2596,5,145,0,0,2595,2597,7,24,0,0,2596,2595,1,0,0,0,2596,2597,1,0,0,0,2597,
	265,1,0,0,0,2598,2599,5,144,0,0,2599,267,1,0,0,0,2600,2601,5,108,0,0,2601,
	2651,5,59,0,0,2602,2651,5,108,0,0,2603,2651,5,146,0,0,2604,2651,5,147,0,
	0,2605,2651,5,149,0,0,2606,2651,5,148,0,0,2607,2651,5,156,0,0,2608,2651,
	5,157,0,0,2609,2651,5,138,0,0,2610,2651,5,139,0,0,2611,2651,5,158,0,0,2612,
	2651,5,159,0,0,2613,2614,5,7,0,0,2614,2623,5,49,0,0,2615,2620,3,268,134,
	0,2616,2617,5,5,0,0,2617,2619,3,268,134,0,2618,2616,1,0,0,0,2619,2622,1,
	0,0,0,2620,2618,1,0,0,0,2620,2621,1,0,0,0,2621,2624,1,0,0,0,2622,2620,1,
	0,0,0,2623,2615,1,0,0,0,2623,2624,1,0,0,0,2624,2625,1,0,0,0,2625,2629,5,
	50,0,0,2626,2628,7,25,0,0,2627,2626,1,0,0,0,2628,2631,1,0,0,0,2629,2627,
	1,0,0,0,2629,2630,1,0,0,0,2630,2644,1,0,0,0,2631,2629,1,0,0,0,2632,2633,
	5,73,0,0,2633,2634,5,49,0,0,2634,2639,3,268,134,0,2635,2636,5,5,0,0,2636,
	2638,3,268,134,0,2637,2635,1,0,0,0,2638,2641,1,0,0,0,2639,2637,1,0,0,0,
	2639,2640,1,0,0,0,2640,2642,1,0,0,0,2641,2639,1,0,0,0,2642,2643,5,50,0,
	0,2643,2645,1,0,0,0,2644,2632,1,0,0,0,2644,2645,1,0,0,0,2645,2651,1,0,0,
	0,2646,2647,5,180,0,0,2647,2648,5,12,0,0,2648,2651,5,180,0,0,2649,2651,
	5,180,0,0,2650,2600,1,0,0,0,2650,2602,1,0,0,0,2650,2603,1,0,0,0,2650,2604,
	1,0,0,0,2650,2605,1,0,0,0,2650,2606,1,0,0,0,2650,2607,1,0,0,0,2650,2608,
	1,0,0,0,2650,2609,1,0,0,0,2650,2610,1,0,0,0,2650,2611,1,0,0,0,2650,2612,
	1,0,0,0,2650,2613,1,0,0,0,2650,2646,1,0,0,0,2650,2649,1,0,0,0,2651,269,
	1,0,0,0,2652,2653,7,26,0,0,2653,271,1,0,0,0,285,275,281,294,296,316,320,
	327,332,340,344,350,361,364,374,378,385,388,392,397,401,417,421,428,431,
	434,448,451,462,464,479,494,498,508,514,520,526,532,538,544,550,556,562,
	567,575,578,595,597,604,611,613,617,629,633,635,639,645,648,651,661,665,
	667,674,682,689,702,706,713,733,739,746,757,763,770,778,789,798,804,810,
	818,825,831,836,842,849,855,861,865,869,877,882,890,900,905,909,921,930,
	932,938,944,951,961,963,967,973,980,996,1005,1009,1015,1024,1028,1036,1040,
	1046,1050,1052,1060,1064,1066,1074,1078,1084,1088,1094,1098,1100,1106,1111,
	1145,1171,1185,1197,1201,1206,1211,1220,1224,1226,1248,1253,1259,1274,1283,
	1287,1289,1298,1303,1314,1316,1321,1335,1340,1351,1361,1369,1384,1386,1391,
	1403,1408,1418,1423,1428,1439,1452,1458,1466,1472,1476,1486,1498,1508,1519,
	1526,1532,1539,1552,1558,1568,1579,1584,1589,1612,1619,1634,1647,1652,1665,
	1669,1687,1703,1723,1735,1745,1753,1757,1766,1776,1788,1796,1841,1850,1856,
	1866,1878,1905,1923,1931,1936,1943,1958,1961,1964,1987,1990,1999,2002,2009,
	2018,2021,2032,2042,2055,2059,2069,2077,2083,2089,2098,2102,2104,2110,2118,
	2122,2124,2127,2140,2146,2155,2159,2161,2170,2184,2194,2202,2206,2208,2226,
	2230,2232,2236,2248,2252,2254,2264,2268,2282,2286,2292,2311,2319,2327,2336,
	2412,2416,2418,2440,2449,2526,2535,2539,2541,2549,2556,2558,2574,2585,2592,
	2596,2620,2623,2629,2639,2644,2650];

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
	public placeholderStatement(): PlaceholderStatementContext {
		return this.getTypedRuleContext(PlaceholderStatementContext, 0) as PlaceholderStatementContext;
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
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
	public lvMember_list(): LvMemberContext[] {
		return this.getTypedRuleContexts(LvMemberContext) as LvMemberContext[];
	}
	public lvMember(i: number): LvMemberContext {
		return this.getTypedRuleContext(LvMemberContext, i) as LvMemberContext;
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
	public pushArgument(): PushArgumentContext {
		return this.getTypedRuleContext(PushArgumentContext, 0) as PushArgumentContext;
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
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
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
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
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public DotPush(): TerminalNode {
		return this.getToken(SolidCashParser.DotPush, 0);
	}
	public pushArgument(): PushArgumentContext {
		return this.getTypedRuleContext(PushArgumentContext, 0) as PushArgumentContext;
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
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
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
	}
	public DotPop(): TerminalNode {
		return this.getToken(SolidCashParser.DotPop, 0);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
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
