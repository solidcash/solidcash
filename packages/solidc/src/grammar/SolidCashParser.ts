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
	public static readonly RULE_arrayPopStatement = 71;
	public static readonly RULE_arrayDeleteStatement = 72;
	public static readonly RULE_stateArrayPushStatement = 73;
	public static readonly RULE_stateArrayPopStatement = 74;
	public static readonly RULE_deleteStatement = 75;
	public static readonly RULE_timeOpStatement = 76;
	public static readonly RULE_requireStatement = 77;
	public static readonly RULE_ifStatement = 78;
	public static readonly RULE_loopStatement = 79;
	public static readonly RULE_forOfEntriesStatement = 80;
	public static readonly RULE_forInStatement = 81;
	public static readonly RULE_forOfStatement = 82;
	public static readonly RULE_forStatement = 83;
	public static readonly RULE_forInit = 84;
	public static readonly RULE_forCondition = 85;
	public static readonly RULE_forUpdate = 86;
	public static readonly RULE_doWhileStatement = 87;
	public static readonly RULE_whileStatement = 88;
	public static readonly RULE_consoleStatement = 89;
	public static readonly RULE_assemblyStatement = 90;
	public static readonly RULE_yulBlock = 91;
	public static readonly RULE_yulStatement = 92;
	public static readonly RULE_yulVariableDeclaration = 93;
	public static readonly RULE_yulAssignment = 94;
	public static readonly RULE_yulIf = 95;
	public static readonly RULE_yulSwitch = 96;
	public static readonly RULE_yulCase = 97;
	public static readonly RULE_yulDefault = 98;
	public static readonly RULE_yulForLoop = 99;
	public static readonly RULE_yulFunctionDefinition = 100;
	public static readonly RULE_yulExpression = 101;
	public static readonly RULE_yulFunctionCall = 102;
	public static readonly RULE_yulFunctionName = 103;
	public static readonly RULE_yulPath = 104;
	public static readonly RULE_yulLiteral = 105;
	public static readonly RULE_uncheckedStatement = 106;
	public static readonly RULE_switchStatement = 107;
	public static readonly RULE_switchCase = 108;
	public static readonly RULE_switchDefault = 109;
	public static readonly RULE_tryCatchStatement = 110;
	public static readonly RULE_tryReturns = 111;
	public static readonly RULE_catchClause = 112;
	public static readonly RULE_breakStatement = 113;
	public static readonly RULE_continueStatement = 114;
	public static readonly RULE_requireMessage = 115;
	public static readonly RULE_revertStatement = 116;
	public static readonly RULE_assertStatement = 117;
	public static readonly RULE_consoleParameter = 118;
	public static readonly RULE_consoleParameterList = 119;
	public static readonly RULE_functionCall = 120;
	public static readonly RULE_namedArg = 121;
	public static readonly RULE_expressionList = 122;
	public static readonly RULE_callOptions = 123;
	public static readonly RULE_callOption = 124;
	public static readonly RULE_typeList = 125;
	public static readonly RULE_typeListItem = 126;
	public static readonly RULE_expression = 127;
	public static readonly RULE_memberName = 128;
	public static readonly RULE_modifier = 129;
	public static readonly RULE_literal = 130;
	public static readonly RULE_numberLiteral = 131;
	public static readonly RULE_decimalLiteral = 132;
	public static readonly RULE_typeName = 133;
	public static readonly RULE_typeCast = 134;
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
		"tupleSlot", "assignStatement", "arrayPushStatement", "arrayPopStatement", 
		"arrayDeleteStatement", "stateArrayPushStatement", "stateArrayPopStatement", 
		"deleteStatement", "timeOpStatement", "requireStatement", "ifStatement", 
		"loopStatement", "forOfEntriesStatement", "forInStatement", "forOfStatement", 
		"forStatement", "forInit", "forCondition", "forUpdate", "doWhileStatement", 
		"whileStatement", "consoleStatement", "assemblyStatement", "yulBlock", 
		"yulStatement", "yulVariableDeclaration", "yulAssignment", "yulIf", "yulSwitch", 
		"yulCase", "yulDefault", "yulForLoop", "yulFunctionDefinition", "yulExpression", 
		"yulFunctionCall", "yulFunctionName", "yulPath", "yulLiteral", "uncheckedStatement", 
		"switchStatement", "switchCase", "switchDefault", "tryCatchStatement", 
		"tryReturns", "catchClause", "breakStatement", "continueStatement", "requireMessage", 
		"revertStatement", "assertStatement", "consoleParameter", "consoleParameterList", 
		"functionCall", "namedArg", "expressionList", "callOptions", "callOption", 
		"typeList", "typeListItem", "expression", "memberName", "modifier", "literal", 
		"numberLiteral", "decimalLiteral", "typeName", "typeCast",
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
			this.state = 273;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===37) {
				{
				{
				this.state = 270;
				this.pragmaDirective();
				}
				}
				this.state = 275;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 279;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===1) {
				{
				{
				this.state = 276;
				this.importDirective();
				}
				}
				this.state = 281;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 294;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1842241) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 292;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 2, this._ctx) ) {
				case 1:
					{
					this.state = 282;
					this.constantDefinition();
					}
					break;
				case 2:
					{
					this.state = 283;
					this.enumDefinition();
					}
					break;
				case 3:
					{
					this.state = 284;
					this.structDefinition();
					}
					break;
				case 4:
					{
					this.state = 285;
					this.typeDefinition();
					}
					break;
				case 5:
					{
					this.state = 286;
					this.usingForDirective();
					}
					break;
				case 6:
					{
					this.state = 287;
					this.errorDefinition();
					}
					break;
				case 7:
					{
					this.state = 288;
					this.interfaceDefinition();
					}
					break;
				case 8:
					{
					this.state = 289;
					this.freeFunctionDefinition();
					}
					break;
				case 9:
					{
					this.state = 290;
					this.libraryDefinition();
					}
					break;
				case 10:
					{
					this.state = 291;
					this.contractDefinition();
					}
					break;
				}
				}
				this.state = 296;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 297;
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
			this.state = 325;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 6, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 299;
				this.match(SolidCashParser.T__0);
				this.state = 300;
				this.match(SolidCashParser.StringLiteral);
				this.state = 301;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 302;
				this.match(SolidCashParser.T__0);
				this.state = 303;
				this.match(SolidCashParser.StringLiteral);
				this.state = 304;
				this.match(SolidCashParser.T__2);
				this.state = 305;
				this.match(SolidCashParser.Identifier);
				this.state = 306;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 307;
				this.match(SolidCashParser.T__0);
				this.state = 308;
				this.match(SolidCashParser.T__3);
				this.state = 309;
				this.importBinding();
				this.state = 314;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 310;
						this.match(SolidCashParser.T__4);
						this.state = 311;
						this.importBinding();
						}
						}
					}
					this.state = 316;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				}
				this.state = 318;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 317;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 320;
				this.match(SolidCashParser.T__5);
				this.state = 321;
				this.match(SolidCashParser.Identifier);
				this.state = 322;
				this.match(SolidCashParser.StringLiteral);
				this.state = 323;
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
			this.state = 327;
			this.match(SolidCashParser.Identifier);
			this.state = 330;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 328;
				this.match(SolidCashParser.T__2);
				this.state = 329;
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
			this.state = 332;
			this.match(SolidCashParser.T__6);
			this.state = 333;
			this.anyIdentifier();
			this.state = 334;
			this.parameterList();
			this.state = 338;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 335;
				this.functionModifier();
				}
				}
				this.state = 340;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 342;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 341;
				this.returnType();
				}
			}

			this.state = 344;
			this.match(SolidCashParser.T__3);
			this.state = 348;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 345;
				this.statement();
				}
				}
				this.state = 350;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 351;
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
			this.state = 390;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 17, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 353;
				this.match(SolidCashParser.T__7);
				this.state = 354;
				this.match(SolidCashParser.Identifier);
				this.state = 355;
				this.match(SolidCashParser.T__8);
				this.state = 359;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 11, this._ctx) ) {
				case 1:
					{
					this.state = 356;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 357;
					this.typeName();
					}
					break;
				case 3:
					{
					this.state = 358;
					this.match(SolidCashParser.T__9);
					}
					break;
				}
				this.state = 362;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 361;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 364;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 365;
				this.match(SolidCashParser.T__7);
				this.state = 366;
				this.match(SolidCashParser.T__3);
				this.state = 367;
				this.usingFunctionBinding();
				this.state = 372;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 368;
						this.match(SolidCashParser.T__4);
						this.state = 369;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 374;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				}
				this.state = 376;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 375;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 378;
				this.match(SolidCashParser.T__5);
				this.state = 379;
				this.match(SolidCashParser.T__8);
				this.state = 383;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 15, this._ctx) ) {
				case 1:
					{
					this.state = 380;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 381;
					this.typeName();
					}
					break;
				case 3:
					{
					this.state = 382;
					this.match(SolidCashParser.T__9);
					}
					break;
				}
				this.state = 386;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 385;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 388;
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
			this.state = 392;
			this.match(SolidCashParser.Identifier);
			this.state = 395;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===12) {
				{
				this.state = 393;
				this.match(SolidCashParser.T__11);
				this.state = 394;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 399;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 397;
				this.match(SolidCashParser.T__2);
				this.state = 398;
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
			this.state = 401;
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
			this.state = 403;
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
			this.state = 405;
			this.match(SolidCashParser.T__36);
			this.state = 406;
			this.pragmaName();
			this.state = 407;
			this.pragmaValue();
			this.state = 408;
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
			this.state = 410;
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
			this.state = 412;
			this.versionConstraint();
			this.state = 414;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0) || _la===140) {
				{
				this.state = 413;
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
				switch ( this._interp.adaptivePredict(this._input, 24, this._ctx) ) {
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
			switch ( this._interp.adaptivePredict(this._input, 26, this._ctx) ) {
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
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 485;
			this.match(SolidCashParser.T__44);
			this.state = 486;
			this.match(SolidCashParser.Identifier);
			this.state = 487;
			this.match(SolidCashParser.T__3);
			this.state = 491;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===54) {
				{
				{
				this.state = 488;
				this.enumDefinition();
				}
				}
				this.state = 493;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 497;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===53) {
				{
				{
				this.state = 494;
				this.structDefinition();
				}
				}
				this.state = 499;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 503;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===55) {
				{
				{
				this.state = 500;
				this.typeDefinition();
				}
				}
				this.state = 505;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 509;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===48) {
				{
				{
				this.state = 506;
				this.eventDefinition();
				}
				}
				this.state = 511;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 515;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===35) {
				{
				{
				this.state = 512;
				this.errorDefinition();
				}
				}
				this.state = 517;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 521;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 34, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 518;
					this.constantDefinition();
					}
					}
				}
				this.state = 523;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 34, this._ctx);
			}
			this.state = 527;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 35, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 524;
					this.stateVariableDeclaration();
					}
					}
				}
				this.state = 529;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 35, this._ctx);
			}
			this.state = 533;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===8) {
				{
				{
				this.state = 530;
				this.usingForDirective();
				}
				}
				this.state = 535;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 539;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 536;
				this.freeFunctionDefinition();
				}
				}
				this.state = 541;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 542;
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
			this.state = 545;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===46) {
				{
				this.state = 544;
				this.match(SolidCashParser.T__45);
				}
			}

			this.state = 547;
			this.match(SolidCashParser.T__46);
			this.state = 548;
			this.match(SolidCashParser.Identifier);
			this.state = 550;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 549;
				this.parameterList();
				}
			}

			this.state = 561;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 552;
				this.match(SolidCashParser.T__41);
				this.state = 553;
				this.inheritanceSpecifier();
				this.state = 558;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 554;
					this.match(SolidCashParser.T__4);
					this.state = 555;
					this.inheritanceSpecifier();
					}
					}
					this.state = 560;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 563;
			this.match(SolidCashParser.T__3);
			this.state = 580;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 268435459) !== 0) || ((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 37411875) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 578;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 42, this._ctx) ) {
				case 1:
					{
					this.state = 564;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 565;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 566;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 567;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 568;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 569;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 570;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 571;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 572;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 573;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 574;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 575;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 576;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 577;
					this.receiveDefinition();
					}
					break;
				}
				}
				this.state = 582;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 583;
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
			this.state = 585;
			this.match(SolidCashParser.Identifier);
			this.state = 587;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 586;
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
			this.state = 589;
			this.match(SolidCashParser.T__6);
			this.state = 590;
			this.anyIdentifier();
			this.state = 591;
			this.parameterList();
			this.state = 595;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 592;
				this.functionModifier();
				}
				}
				this.state = 597;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 601;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 598;
				this.customModifierInvocation();
				}
				}
				this.state = 603;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 605;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 604;
				this.returnType();
				}
			}

			this.state = 607;
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
			this.state = 609;
			this.match(SolidCashParser.T__47);
			this.state = 610;
			this.match(SolidCashParser.Identifier);
			this.state = 611;
			this.match(SolidCashParser.T__48);
			this.state = 623;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 612;
				this.eventParameter();
				this.state = 617;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 48, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 613;
						this.match(SolidCashParser.T__4);
						this.state = 614;
						this.eventParameter();
						}
						}
					}
					this.state = 619;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 48, this._ctx);
				}
				this.state = 621;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 620;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 625;
			this.match(SolidCashParser.T__49);
			this.state = 627;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===51) {
				{
				this.state = 626;
				this.match(SolidCashParser.T__50);
				}
			}

			this.state = 629;
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
			this.state = 633;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 52, this._ctx) ) {
			case 1:
				{
				this.state = 631;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 632;
				this.arrayType(0);
				}
				break;
			}
			this.state = 636;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===52) {
				{
				this.state = 635;
				this.match(SolidCashParser.T__51);
				}
			}

			this.state = 639;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 638;
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
			this.state = 641;
			this.match(SolidCashParser.T__34);
			this.state = 642;
			this.match(SolidCashParser.Identifier);
			this.state = 643;
			this.match(SolidCashParser.T__48);
			this.state = 655;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 644;
				this.errorParameter();
				this.state = 649;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 55, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 645;
						this.match(SolidCashParser.T__4);
						this.state = 646;
						this.errorParameter();
						}
						}
					}
					this.state = 651;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 55, this._ctx);
				}
				this.state = 653;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 652;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 657;
			this.match(SolidCashParser.T__49);
			this.state = 658;
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
			this.state = 660;
			this.typeName();
			this.state = 662;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 661;
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
			this.state = 664;
			this.match(SolidCashParser.T__52);
			this.state = 665;
			this.match(SolidCashParser.Identifier);
			this.state = 666;
			this.match(SolidCashParser.T__3);
			this.state = 668;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 667;
				this.structField();
				}
				}
				this.state = 670;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180);
			this.state = 672;
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
			this.state = 677;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 60, this._ctx) ) {
			case 1:
				{
				this.state = 674;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 675;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 676;
				this.mappingType();
				}
				break;
			}
			this.state = 679;
			this.anyIdentifier();
			this.state = 680;
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
			this.state = 682;
			this.match(SolidCashParser.T__53);
			this.state = 683;
			this.match(SolidCashParser.Identifier);
			this.state = 684;
			this.match(SolidCashParser.T__3);
			this.state = 685;
			this.enumMember();
			this.state = 690;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 61, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 686;
					this.match(SolidCashParser.T__4);
					this.state = 687;
					this.enumMember();
					}
					}
				}
				this.state = 692;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 61, this._ctx);
			}
			this.state = 694;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 693;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 696;
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
			this.state = 698;
			this.match(SolidCashParser.Identifier);
			this.state = 701;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 699;
				this.match(SolidCashParser.T__39);
				this.state = 700;
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
			this.state = 703;
			this.match(SolidCashParser.T__54);
			this.state = 704;
			this.match(SolidCashParser.Identifier);
			this.state = 705;
			this.match(SolidCashParser.T__41);
			this.state = 706;
			this.typeName();
			this.state = 707;
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
			this.state = 709;
			this.typeName();
			this.state = 710;
			this.match(SolidCashParser.T__55);
			this.state = 711;
			this.match(SolidCashParser.Identifier);
			this.state = 712;
			this.match(SolidCashParser.T__39);
			this.state = 713;
			this.expression(0);
			this.state = 714;
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
			this.state = 716;
			this.match(SolidCashParser.T__56);
			this.state = 717;
			this.parameterList();
			this.state = 721;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 98307) !== 0)) {
				{
				{
				this.state = 718;
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
				this.state = 723;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 727;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 724;
				this.parentInvocation();
				}
				}
				this.state = 729;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 730;
			this.match(SolidCashParser.T__3);
			this.state = 734;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
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
	public fallbackDefinition(): FallbackDefinitionContext {
		let localctx: FallbackDefinitionContext = new FallbackDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 66, SolidCashParser.RULE_fallbackDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 739;
			this.match(SolidCashParser.T__59);
			this.state = 740;
			this.parameterList();
			this.state = 741;
			this.match(SolidCashParser.T__43);
			this.state = 745;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 8197) !== 0)) {
				{
				{
				this.state = 742;
				this.fallbackModifier();
				}
				}
				this.state = 747;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 751;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 748;
				this.customModifierInvocation();
				}
				}
				this.state = 753;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 754;
			this.match(SolidCashParser.T__3);
			this.state = 758;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 755;
				this.statement();
				}
				}
				this.state = 760;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 761;
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
			this.state = 766;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 59:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 763;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 764;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 765;
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
			this.state = 768;
			this.match(SolidCashParser.T__61);
			this.state = 769;
			this.match(SolidCashParser.T__48);
			this.state = 770;
			this.match(SolidCashParser.T__49);
			this.state = 771;
			this.match(SolidCashParser.T__43);
			this.state = 772;
			this.match(SolidCashParser.T__58);
			this.state = 773;
			this.match(SolidCashParser.T__3);
			this.state = 777;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 774;
				this.statement();
				}
				}
				this.state = 779;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 780;
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
			this.state = 782;
			this.match(SolidCashParser.Identifier);
			this.state = 783;
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
			this.state = 847;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 82, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 786;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 785;
					this.stateVariableVisibility();
					}
				}

				this.state = 788;
				this.typeName();
				this.state = 792;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 789;
					this.modifier();
					}
					}
					this.state = 794;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 795;
				this.match(SolidCashParser.Identifier);
				this.state = 798;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 796;
					this.match(SolidCashParser.T__39);
					this.state = 797;
					this.expression(0);
					}
				}

				this.state = 800;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 802;
				this.typeName();
				this.state = 803;
				this.stateVariableVisibility();
				this.state = 807;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 804;
					this.modifier();
					}
					}
					this.state = 809;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 810;
				this.match(SolidCashParser.Identifier);
				this.state = 813;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 811;
					this.match(SolidCashParser.T__39);
					this.state = 812;
					this.expression(0);
					}
				}

				this.state = 815;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 818;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 817;
					this.stateVariableVisibility();
					}
				}

				this.state = 820;
				this.mappingType();
				this.state = 824;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 821;
					this.collectionModifier();
					}
					}
					this.state = 826;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 827;
				this.match(SolidCashParser.Identifier);
				this.state = 828;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 831;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 830;
					this.stateVariableVisibility();
					}
				}

				this.state = 833;
				this.arrayType(0);
				this.state = 837;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 834;
					this.collectionModifier();
					}
					}
					this.state = 839;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 840;
				this.match(SolidCashParser.Identifier);
				this.state = 843;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 841;
					this.match(SolidCashParser.T__39);
					this.state = 842;
					this.expression(0);
					}
				}

				this.state = 845;
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
			this.state = 851;
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
				this.state = 849;
				this.modifier();
				}
				break;
			case 43:
			case 44:
			case 58:
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 850;
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
			this.state = 853;
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
			this.state = 891;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 89, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
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
				this.typeName();
				this.state = 864;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 863;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 866;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 868;
				this.match(SolidCashParser.T__63);
				this.state = 869;
				this.match(SolidCashParser.T__48);
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
				this.match(SolidCashParser.T__64);
				this.state = 875;
				this.mappingType();
				this.state = 876;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 878;
				this.match(SolidCashParser.T__63);
				this.state = 879;
				this.match(SolidCashParser.T__48);
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
				this.match(SolidCashParser.T__64);
				this.state = 885;
				this.arrayType(0);
				this.state = 887;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 886;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 889;
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
			this.state = 903;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 90, this._ctx) ) {
			case 1:
				{
				this.state = 894;
				this.typeName();
				this.state = 895;
				this.match(SolidCashParser.T__65);
				this.state = 896;
				_la = this._input.LA(1);
				if(!(_la===145 || _la===180)) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 897;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 2:
				{
				this.state = 899;
				this.typeName();
				this.state = 900;
				this.match(SolidCashParser.T__65);
				this.state = 901;
				this.match(SolidCashParser.T__66);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 914;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 92, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 912;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 91, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 905;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 906;
						this.match(SolidCashParser.T__65);
						this.state = 907;
						_la = this._input.LA(1);
						if(!(_la===145 || _la===180)) {
						this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 908;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 909;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 910;
						this.match(SolidCashParser.T__65);
						this.state = 911;
						this.match(SolidCashParser.T__66);
						}
						break;
					}
					}
				}
				this.state = 916;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 92, this._ctx);
			}
			}
		}
		catch (re) {
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
			this.state = 917;
			this.match(SolidCashParser.T__67);
			this.state = 918;
			this.match(SolidCashParser.Identifier);
			this.state = 920;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 919;
				this.parameterList();
				}
			}

			this.state = 922;
			this.match(SolidCashParser.T__3);
			this.state = 926;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 923;
				this.modifierStatement();
				}
				}
				this.state = 928;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 929;
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
			this.state = 933;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 95, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 931;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 932;
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
			this.state = 935;
			this.match(SolidCashParser.T__68);
			this.state = 936;
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
			this.state = 938;
			this.match(SolidCashParser.T__6);
			this.state = 939;
			this.anyIdentifier();
			this.state = 940;
			this.parameterList();
			this.state = 944;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 941;
				this.functionModifier();
				}
				}
				this.state = 946;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 950;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 947;
				this.customModifierInvocation();
				}
				}
				this.state = 952;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 954;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 953;
				this.returnType();
				}
			}

			this.state = 956;
			this.match(SolidCashParser.T__3);
			this.state = 960;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 957;
				this.statement();
				}
				}
				this.state = 962;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 963;
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
			this.state = 965;
			this.match(SolidCashParser.Identifier);
			this.state = 967;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 966;
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
			this.state = 983;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 70:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 969;
				this.match(SolidCashParser.T__69);
				}
				break;
			case 71:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 970;
				this.match(SolidCashParser.T__70);
				}
				break;
			case 58:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 971;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 44:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 972;
				this.match(SolidCashParser.T__43);
				}
				break;
			case 43:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 973;
				this.match(SolidCashParser.T__42);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 974;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 59:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 975;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 976;
				this.overrideSpecifier();
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 977;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 978;
				this.unsafeModifier();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 979;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 980;
				this.match(SolidCashParser.T__27);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 981;
				this.match(SolidCashParser.T__30);
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 982;
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
			this.state = 985;
			this.match(SolidCashParser.T__71);
			this.state = 996;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 986;
				this.match(SolidCashParser.T__48);
				this.state = 987;
				this.match(SolidCashParser.Identifier);
				this.state = 992;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 988;
					this.match(SolidCashParser.T__4);
					this.state = 989;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 994;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
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
	public unsafeModifier(): UnsafeModifierContext {
		let localctx: UnsafeModifierContext = new UnsafeModifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 98, SolidCashParser.RULE_unsafeModifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 998;
			this.match(SolidCashParser.T__31);
			this.state = 1002;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 999;
				this.match(SolidCashParser.T__48);
				this.state = 1000;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1001;
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
			this.state = 1004;
			this.match(SolidCashParser.T__72);
			this.state = 1005;
			this.match(SolidCashParser.T__48);
			this.state = 1006;
			this.returnParam();
			this.state = 1011;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 105, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1007;
					this.match(SolidCashParser.T__4);
					this.state = 1008;
					this.returnParam();
					}
					}
				}
				this.state = 1013;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 105, this._ctx);
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

			this.state = 1017;
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
			this.state = 1039;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 111, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1019;
				this.typeName();
				this.state = 1023;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 107, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1020;
						this.modifier();
						}
						}
					}
					this.state = 1025;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 107, this._ctx);
				}
				this.state = 1027;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1026;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1029;
				this.arrayType(0);
				this.state = 1033;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 109, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 109, this._ctx);
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
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1041;
			this.match(SolidCashParser.T__48);
			this.state = 1053;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1042;
				this.parameter();
				this.state = 1047;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 112, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1043;
						this.match(SolidCashParser.T__4);
						this.state = 1044;
						this.parameter();
						}
						}
					}
					this.state = 1049;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 112, this._ctx);
				}
				this.state = 1051;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1050;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1055;
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
			this.state = 1087;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 121, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1057;
				this.typeName();
				this.state = 1061;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 115, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1058;
						this.modifier();
						}
						}
					}
					this.state = 1063;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 115, this._ctx);
				}
				this.state = 1065;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1064;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1067;
				this.arrayType(0);
				this.state = 1071;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 117, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1068;
						this.modifier();
						}
						}
					}
					this.state = 1073;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 117, this._ctx);
				}
				this.state = 1075;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1074;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1077;
				this.mappingType();
				this.state = 1081;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 119, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 119, this._ctx);
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
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1098;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1089;
				this.match(SolidCashParser.T__3);
				this.state = 1093;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
					{
					{
					this.state = 1090;
					this.statement();
					}
					}
					this.state = 1095;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1096;
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
				this.state = 1097;
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
			this.state = 1132;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 124, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1100;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1101;
				this.variableDefinition();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1102;
				this.tupleAssignment();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1103;
				this.arrayPushStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1104;
				this.arrayPopStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1105;
				this.arrayDeleteStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1106;
				this.stateArrayPushStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1107;
				this.stateArrayPopStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1108;
				this.assignStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1109;
				this.assignmentStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1110;
				this.mappingDeleteStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1111;
				this.timeOpStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1112;
				this.requireStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1113;
				this.ifStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1114;
				this.loopStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1115;
				this.consoleStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1116;
				this.emitStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1117;
				this.transferStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1118;
				this.tokenContainerMethodStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1119;
				this.returnStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1120;
				this.functionCallStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1121;
				this.addressMethodStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1122;
				this.selfdestructStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1123;
				this.assemblyStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1124;
				this.tryCatchStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1125;
				this.revertStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1126;
				this.assertStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1127;
				this.deleteStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1128;
				this.uncheckedStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1129;
				this.switchStatement();
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 31);
				{
				this.state = 1130;
				this.breakStatement();
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 32);
				{
				this.state = 1131;
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
			this.state = 1134;
			this.match(SolidCashParser.T__73);
			this.state = 1135;
			this.match(SolidCashParser.T__11);
			this.state = 1136;
			this.match(SolidCashParser.Identifier);
			this.state = 1137;
			this.match(SolidCashParser.T__48);
			this.state = 1138;
			this.expression(0);
			this.state = 1139;
			this.match(SolidCashParser.T__4);
			this.state = 1140;
			this.expression(0);
			this.state = 1141;
			this.match(SolidCashParser.T__49);
			this.state = 1142;
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
			this.state = 1144;
			this.match(SolidCashParser.T__73);
			this.state = 1145;
			this.match(SolidCashParser.T__11);
			this.state = 1146;
			this.match(SolidCashParser.Identifier);
			this.state = 1147;
			this.match(SolidCashParser.T__65);
			this.state = 1148;
			this.expression(0);
			this.state = 1149;
			this.match(SolidCashParser.T__66);
			this.state = 1150;
			this.match(SolidCashParser.T__11);
			this.state = 1151;
			this.match(SolidCashParser.Identifier);
			this.state = 1152;
			this.match(SolidCashParser.T__48);
			this.state = 1153;
			this.expression(0);
			this.state = 1158;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1154;
				this.match(SolidCashParser.T__4);
				this.state = 1155;
				this.expression(0);
				}
				}
				this.state = 1160;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1161;
			this.match(SolidCashParser.T__49);
			this.state = 1162;
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
			this.state = 1193;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 129, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1164;
				this.match(SolidCashParser.T__74);
				this.state = 1165;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1166;
				this.match(SolidCashParser.T__74);
				this.state = 1167;
				this.expression(0);
				this.state = 1172;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1168;
					this.match(SolidCashParser.T__4);
					this.state = 1169;
					this.expression(0);
					}
					}
					this.state = 1174;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1175;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1177;
				this.match(SolidCashParser.T__74);
				this.state = 1178;
				this.match(SolidCashParser.T__48);
				this.state = 1179;
				this.expression(0);
				this.state = 1184;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 127, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1180;
						this.match(SolidCashParser.T__4);
						this.state = 1181;
						this.expression(0);
						}
						}
					}
					this.state = 1186;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 127, this._ctx);
				}
				this.state = 1188;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1187;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1190;
				this.match(SolidCashParser.T__49);
				this.state = 1191;
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
			this.state = 1240;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 135, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1195;
				this.match(SolidCashParser.Identifier);
				this.state = 1198;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1196;
					this.match(SolidCashParser.T__11);
					this.state = 1197;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1200;
				this.match(SolidCashParser.T__48);
				this.state = 1201;
				this.match(SolidCashParser.T__3);
				this.state = 1213;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1202;
					this.namedArg();
					this.state = 1207;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 131, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1203;
							this.match(SolidCashParser.T__4);
							this.state = 1204;
							this.namedArg();
							}
							}
						}
						this.state = 1209;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 131, this._ctx);
					}
					this.state = 1211;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1210;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1215;
				this.match(SolidCashParser.T__5);
				this.state = 1216;
				this.match(SolidCashParser.T__49);
				this.state = 1217;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1218;
				this.match(SolidCashParser.Identifier);
				this.state = 1219;
				this.expressionList();
				this.state = 1220;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1222;
				this.match(SolidCashParser.Identifier);
				this.state = 1223;
				this.match(SolidCashParser.T__11);
				this.state = 1224;
				this.match(SolidCashParser.Identifier);
				this.state = 1225;
				this.expressionList();
				this.state = 1226;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1228;
				this.match(SolidCashParser.Identifier);
				this.state = 1229;
				this.expressionList();
				this.state = 1230;
				this.match(SolidCashParser.T__11);
				this.state = 1231;
				this.match(SolidCashParser.Identifier);
				this.state = 1232;
				this.match(SolidCashParser.T__11);
				this.state = 1233;
				this.match(SolidCashParser.Identifier);
				this.state = 1235;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1234;
					this.callOptions();
					}
				}

				this.state = 1237;
				this.expressionList();
				this.state = 1238;
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
			this.state = 1242;
			this.expression(0);
			this.state = 1243;
			this.match(SolidCashParser.T__11);
			this.state = 1244;
			this.match(SolidCashParser.Identifier);
			this.state = 1246;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===4) {
				{
				this.state = 1245;
				this.callOptions();
				}
			}

			this.state = 1248;
			this.expressionList();
			this.state = 1249;
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
			this.state = 1251;
			this.match(SolidCashParser.T__30);
			this.state = 1252;
			this.match(SolidCashParser.T__48);
			this.state = 1253;
			this.expression(0);
			this.state = 1254;
			this.match(SolidCashParser.T__49);
			this.state = 1255;
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
			this.state = 1290;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 142, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1257;
				this.match(SolidCashParser.T__75);
				this.state = 1258;
				this.match(SolidCashParser.Identifier);
				this.state = 1261;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1259;
					this.match(SolidCashParser.T__11);
					this.state = 1260;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1263;
				this.match(SolidCashParser.T__48);
				this.state = 1264;
				this.match(SolidCashParser.T__3);
				this.state = 1276;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1265;
					this.namedArg();
					this.state = 1270;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 138, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1266;
							this.match(SolidCashParser.T__4);
							this.state = 1267;
							this.namedArg();
							}
							}
						}
						this.state = 1272;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 138, this._ctx);
					}
					this.state = 1274;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1273;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1278;
				this.match(SolidCashParser.T__5);
				this.state = 1279;
				this.match(SolidCashParser.T__49);
				this.state = 1280;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1281;
				this.match(SolidCashParser.T__75);
				this.state = 1282;
				this.match(SolidCashParser.Identifier);
				this.state = 1285;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1283;
					this.match(SolidCashParser.T__11);
					this.state = 1284;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1287;
				this.expressionList();
				this.state = 1288;
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
			this.state = 1410;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 157, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1292;
				this.match(SolidCashParser.T__73);
				this.state = 1293;
				this.match(SolidCashParser.T__11);
				this.state = 1294;
				this.match(SolidCashParser.Identifier);
				this.state = 1303;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===66) {
					{
					this.state = 1299;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1295;
						this.match(SolidCashParser.T__65);
						this.state = 1296;
						this.expression(0);
						this.state = 1297;
						this.match(SolidCashParser.T__66);
						}
						}
						this.state = 1301;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===66);
					}
				}

				this.state = 1308;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12 || _la===163) {
					{
					{
					this.state = 1305;
					this.lvMember();
					}
					}
					this.state = 1310;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1311;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1312;
				this.expression(0);
				this.state = 1313;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1315;
				this.match(SolidCashParser.Identifier);
				this.state = 1320;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1316;
					this.match(SolidCashParser.T__65);
					this.state = 1317;
					this.expression(0);
					this.state = 1318;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1322;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1327;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12 || _la===163) {
					{
					{
					this.state = 1324;
					this.lvMember();
					}
					}
					this.state = 1329;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1330;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1331;
				this.expression(0);
				this.state = 1332;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1334;
				this.match(SolidCashParser.Identifier);
				this.state = 1336;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1335;
					this.lvMember();
					}
					}
					this.state = 1338;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12 || _la===163);
				this.state = 1340;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1341;
				this.expression(0);
				this.state = 1342;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1344;
				this.match(SolidCashParser.Identifier);
				this.state = 1346;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1345;
					this.lvMember();
					}
					}
					this.state = 1348;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12 || _la===163);
				this.state = 1354;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1350;
					this.match(SolidCashParser.T__65);
					this.state = 1351;
					this.expression(0);
					this.state = 1352;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1356;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1358;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1359;
				this.expression(0);
				this.state = 1360;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1362;
				this.match(SolidCashParser.T__73);
				this.state = 1363;
				this.match(SolidCashParser.T__11);
				this.state = 1364;
				this.match(SolidCashParser.Identifier);
				this.state = 1373;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===66) {
					{
					this.state = 1369;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1365;
						this.match(SolidCashParser.T__65);
						this.state = 1366;
						this.expression(0);
						this.state = 1367;
						this.match(SolidCashParser.T__66);
						}
						}
						this.state = 1371;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===66);
					}
				}

				this.state = 1378;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12 || _la===163) {
					{
					{
					this.state = 1375;
					this.lvMember();
					}
					}
					this.state = 1380;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1381;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
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
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1383;
				this.match(SolidCashParser.Identifier);
				this.state = 1388;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
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
					this.state = 1390;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1395;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12 || _la===163) {
					{
					{
					this.state = 1392;
					this.lvMember();
					}
					}
					this.state = 1397;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1398;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1399;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1401;
				this.match(SolidCashParser.Identifier);
				this.state = 1403;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1402;
					this.lvMember();
					}
					}
					this.state = 1405;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12 || _la===163);
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
	public lvMember(): LvMemberContext {
		let localctx: LvMemberContext = new LvMemberContext(this, this._ctx, this.state);
		this.enterRule(localctx, 128, SolidCashParser.RULE_lvMember);
		try {
			this.state = 1415;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1412;
				this.match(SolidCashParser.T__11);
				this.state = 1413;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1414;
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
			this.state = 1417;
			this.match(SolidCashParser.T__73);
			this.state = 1418;
			this.match(SolidCashParser.T__11);
			this.state = 1419;
			this.match(SolidCashParser.Identifier);
			this.state = 1426;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===66) {
				{
				{
				this.state = 1420;
				this.match(SolidCashParser.T__65);
				this.state = 1421;
				this.expression(0);
				this.state = 1422;
				this.match(SolidCashParser.T__66);
				}
				}
				this.state = 1428;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1429;
			this.match(SolidCashParser.DotDelete);
			this.state = 1430;
			this.match(SolidCashParser.T__48);
			this.state = 1431;
			this.expression(0);
			this.state = 1432;
			this.match(SolidCashParser.T__49);
			this.state = 1433;
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
			this.state = 1463;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 164, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1435;
				this.typeName();
				this.state = 1439;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 160, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1436;
						this.modifier();
						}
						}
					}
					this.state = 1441;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 160, this._ctx);
				}
				this.state = 1442;
				this.anyIdentifier();
				this.state = 1445;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1443;
					this.match(SolidCashParser.T__39);
					this.state = 1444;
					this.expression(0);
					}
				}

				this.state = 1447;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1449;
				this.arrayType(0);
				this.state = 1453;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 162, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1450;
						this.modifier();
						}
						}
					}
					this.state = 1455;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 162, this._ctx);
				}
				this.state = 1456;
				this.anyIdentifier();
				this.state = 1459;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1457;
					this.match(SolidCashParser.T__39);
					this.state = 1458;
					this.expression(0);
					}
				}

				this.state = 1461;
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
			this.state = 1513;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 169, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1465;
				this.typeName();
				this.state = 1466;
				this.match(SolidCashParser.Identifier);
				this.state = 1471;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1467;
					this.match(SolidCashParser.T__4);
					this.state = 1468;
					this.typeName();
					this.state = 1469;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1473;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1475;
				this.match(SolidCashParser.T__39);
				this.state = 1476;
				this.expression(0);
				this.state = 1477;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1479;
				this.match(SolidCashParser.T__48);
				this.state = 1480;
				this.tupleSlot();
				this.state = 1483;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1481;
					this.match(SolidCashParser.T__4);
					this.state = 1482;
					this.tupleSlot();
					}
					}
					this.state = 1485;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1487;
				this.match(SolidCashParser.T__49);
				this.state = 1488;
				this.match(SolidCashParser.T__39);
				this.state = 1489;
				this.match(SolidCashParser.T__48);
				this.state = 1490;
				this.expression(0);
				this.state = 1493;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1491;
					this.match(SolidCashParser.T__4);
					this.state = 1492;
					this.expression(0);
					}
					}
					this.state = 1495;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1497;
				this.match(SolidCashParser.T__49);
				this.state = 1498;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1500;
				this.match(SolidCashParser.T__48);
				this.state = 1501;
				this.tupleSlot();
				this.state = 1504;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1502;
					this.match(SolidCashParser.T__4);
					this.state = 1503;
					this.tupleSlot();
					}
					}
					this.state = 1506;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1508;
				this.match(SolidCashParser.T__49);
				this.state = 1509;
				this.match(SolidCashParser.T__39);
				this.state = 1510;
				this.expression(0);
				this.state = 1511;
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
			this.state = 1526;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 171, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1515;
				this.typeName();
				this.state = 1519;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 170, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1516;
						this.modifier();
						}
						}
					}
					this.state = 1521;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 170, this._ctx);
				}
				this.state = 1522;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1524;
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
			this.state = 1539;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 172, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1528;
				this.match(SolidCashParser.Identifier);
				this.state = 1529;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1530;
				this.expression(0);
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
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1535;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1536;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1537;
				this.match(SolidCashParser.Identifier);
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
	public arrayPushStatement(): ArrayPushStatementContext {
		let localctx: ArrayPushStatementContext = new ArrayPushStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 140, SolidCashParser.RULE_arrayPushStatement);
		try {
			this.state = 1557;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 173, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1541;
				this.match(SolidCashParser.Identifier);
				this.state = 1542;
				this.match(SolidCashParser.DotPush);
				this.state = 1543;
				this.match(SolidCashParser.T__48);
				this.state = 1544;
				this.expression(0);
				this.state = 1545;
				this.match(SolidCashParser.T__49);
				this.state = 1546;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1548;
				this.match(SolidCashParser.Identifier);
				this.state = 1549;
				this.match(SolidCashParser.T__11);
				this.state = 1550;
				this.match(SolidCashParser.Identifier);
				this.state = 1551;
				this.match(SolidCashParser.DotPush);
				this.state = 1552;
				this.match(SolidCashParser.T__48);
				this.state = 1553;
				this.expression(0);
				this.state = 1554;
				this.match(SolidCashParser.T__49);
				this.state = 1555;
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
		this.enterRule(localctx, 142, SolidCashParser.RULE_arrayPopStatement);
		try {
			this.state = 1571;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 174, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1559;
				this.match(SolidCashParser.Identifier);
				this.state = 1560;
				this.match(SolidCashParser.DotPop);
				this.state = 1561;
				this.match(SolidCashParser.T__48);
				this.state = 1562;
				this.match(SolidCashParser.T__49);
				this.state = 1563;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1564;
				this.match(SolidCashParser.Identifier);
				this.state = 1565;
				this.match(SolidCashParser.T__11);
				this.state = 1566;
				this.match(SolidCashParser.Identifier);
				this.state = 1567;
				this.match(SolidCashParser.DotPop);
				this.state = 1568;
				this.match(SolidCashParser.T__48);
				this.state = 1569;
				this.match(SolidCashParser.T__49);
				this.state = 1570;
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
		this.enterRule(localctx, 144, SolidCashParser.RULE_arrayDeleteStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1573;
			this.match(SolidCashParser.Identifier);
			this.state = 1574;
			this.match(SolidCashParser.DotDelete);
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
	public stateArrayPushStatement(): StateArrayPushStatementContext {
		let localctx: StateArrayPushStatementContext = new StateArrayPushStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 146, SolidCashParser.RULE_stateArrayPushStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1580;
			this.match(SolidCashParser.T__73);
			this.state = 1581;
			this.match(SolidCashParser.T__11);
			this.state = 1582;
			this.match(SolidCashParser.Identifier);
			this.state = 1583;
			this.match(SolidCashParser.DotPush);
			this.state = 1584;
			this.match(SolidCashParser.T__48);
			this.state = 1585;
			this.expression(0);
			this.state = 1586;
			this.match(SolidCashParser.T__49);
			this.state = 1587;
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
		this.enterRule(localctx, 148, SolidCashParser.RULE_stateArrayPopStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1589;
			this.match(SolidCashParser.T__73);
			this.state = 1590;
			this.match(SolidCashParser.T__11);
			this.state = 1591;
			this.match(SolidCashParser.Identifier);
			this.state = 1592;
			this.match(SolidCashParser.DotPop);
			this.state = 1593;
			this.match(SolidCashParser.T__48);
			this.state = 1594;
			this.match(SolidCashParser.T__49);
			this.state = 1595;
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
		this.enterRule(localctx, 150, SolidCashParser.RULE_deleteStatement);
		let _la: number;
		try {
			this.state = 1649;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 179, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1597;
				this.match(SolidCashParser.T__88);
				this.state = 1598;
				this.match(SolidCashParser.Identifier);
				this.state = 1599;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1600;
				this.match(SolidCashParser.T__88);
				this.state = 1601;
				this.match(SolidCashParser.T__73);
				this.state = 1602;
				this.match(SolidCashParser.T__11);
				this.state = 1603;
				this.match(SolidCashParser.Identifier);
				this.state = 1604;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1605;
				this.match(SolidCashParser.T__88);
				this.state = 1606;
				this.match(SolidCashParser.T__73);
				this.state = 1607;
				this.match(SolidCashParser.T__11);
				this.state = 1608;
				this.match(SolidCashParser.Identifier);
				this.state = 1613;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1609;
					this.match(SolidCashParser.T__65);
					this.state = 1610;
					this.expression(0);
					this.state = 1611;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1615;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1617;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1619;
				this.match(SolidCashParser.T__88);
				this.state = 1620;
				this.match(SolidCashParser.Identifier);
				this.state = 1625;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1621;
					this.match(SolidCashParser.T__65);
					this.state = 1622;
					this.expression(0);
					this.state = 1623;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1627;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1629;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				localctx = new DeleteMemberEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1631;
				this.match(SolidCashParser.T__88);
				this.state = 1632;
				this.match(SolidCashParser.Identifier);
				this.state = 1635;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1633;
					this.match(SolidCashParser.T__11);
					this.state = 1634;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1637;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1643;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1639;
					this.match(SolidCashParser.T__65);
					this.state = 1640;
					this.expression(0);
					this.state = 1641;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1645;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1647;
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
		this.enterRule(localctx, 152, SolidCashParser.RULE_timeOpStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1651;
			this.match(SolidCashParser.T__89);
			this.state = 1652;
			this.match(SolidCashParser.T__48);
			this.state = 1653;
			this.match(SolidCashParser.TxVar);
			this.state = 1654;
			this.match(SolidCashParser.T__22);
			this.state = 1655;
			this.expression(0);
			this.state = 1658;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1656;
				this.match(SolidCashParser.T__4);
				this.state = 1657;
				this.requireMessage();
				}
			}

			this.state = 1660;
			this.match(SolidCashParser.T__49);
			this.state = 1661;
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
		this.enterRule(localctx, 154, SolidCashParser.RULE_requireStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1663;
			this.match(SolidCashParser.T__89);
			this.state = 1664;
			this.match(SolidCashParser.T__48);
			this.state = 1665;
			this.expression(0);
			this.state = 1668;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1666;
				this.match(SolidCashParser.T__4);
				this.state = 1667;
				this.requireMessage();
				}
			}

			this.state = 1670;
			this.match(SolidCashParser.T__49);
			this.state = 1671;
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
		this.enterRule(localctx, 156, SolidCashParser.RULE_ifStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1673;
			this.match(SolidCashParser.T__90);
			this.state = 1674;
			this.match(SolidCashParser.T__48);
			this.state = 1675;
			this.expression(0);
			this.state = 1676;
			this.match(SolidCashParser.T__49);
			this.state = 1677;
			localctx._ifBlock = this.block();
			this.state = 1680;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 182, this._ctx) ) {
			case 1:
				{
				this.state = 1678;
				this.match(SolidCashParser.T__91);
				this.state = 1679;
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
		this.enterRule(localctx, 158, SolidCashParser.RULE_loopStatement);
		try {
			this.state = 1688;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 183, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1682;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1683;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1684;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1685;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1686;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1687;
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
		this.enterRule(localctx, 160, SolidCashParser.RULE_forOfEntriesStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1690;
			this.match(SolidCashParser.T__8);
			this.state = 1691;
			this.match(SolidCashParser.T__48);
			this.state = 1692;
			this.typeName();
			this.state = 1693;
			this.match(SolidCashParser.Identifier);
			this.state = 1694;
			this.match(SolidCashParser.T__4);
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
			this.match(SolidCashParser.T__11);
			this.state = 1702;
			this.match(SolidCashParser.T__33);
			this.state = 1703;
			this.match(SolidCashParser.T__49);
			this.state = 1704;
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
		this.enterRule(localctx, 162, SolidCashParser.RULE_forInStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1706;
			this.match(SolidCashParser.T__8);
			this.state = 1707;
			this.match(SolidCashParser.T__48);
			this.state = 1708;
			this.typeName();
			this.state = 1709;
			this.match(SolidCashParser.Identifier);
			this.state = 1710;
			this.match(SolidCashParser.T__93);
			this.state = 1711;
			this.match(SolidCashParser.T__73);
			this.state = 1712;
			this.match(SolidCashParser.T__11);
			this.state = 1713;
			this.match(SolidCashParser.Identifier);
			this.state = 1714;
			this.match(SolidCashParser.T__49);
			this.state = 1715;
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
		this.enterRule(localctx, 164, SolidCashParser.RULE_forOfStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1717;
			this.match(SolidCashParser.T__8);
			this.state = 1718;
			this.match(SolidCashParser.T__48);
			this.state = 1719;
			this.typeName();
			this.state = 1720;
			this.match(SolidCashParser.Identifier);
			this.state = 1721;
			this.match(SolidCashParser.T__92);
			this.state = 1722;
			this.match(SolidCashParser.T__73);
			this.state = 1723;
			this.match(SolidCashParser.T__11);
			this.state = 1724;
			this.match(SolidCashParser.Identifier);
			this.state = 1725;
			this.match(SolidCashParser.T__49);
			this.state = 1726;
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
		this.enterRule(localctx, 166, SolidCashParser.RULE_forStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1728;
			this.match(SolidCashParser.T__8);
			this.state = 1729;
			this.match(SolidCashParser.T__48);
			this.state = 1730;
			this.forInit();
			this.state = 1731;
			this.forCondition();
			this.state = 1733;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===87 || _la===88 || _la===180) {
				{
				this.state = 1732;
				this.forUpdate();
				}
			}

			this.state = 1735;
			this.match(SolidCashParser.T__49);
			this.state = 1736;
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
		this.enterRule(localctx, 168, SolidCashParser.RULE_forInit);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1738;
			this.typeName();
			this.state = 1742;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
				{
				{
				this.state = 1739;
				this.modifier();
				}
				}
				this.state = 1744;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1745;
			this.match(SolidCashParser.Identifier);
			this.state = 1748;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 1746;
				this.match(SolidCashParser.T__39);
				this.state = 1747;
				this.expression(0);
				}
			}

			this.state = 1750;
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
		this.enterRule(localctx, 170, SolidCashParser.RULE_forCondition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1752;
			this.expression(0);
			this.state = 1753;
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
		this.enterRule(localctx, 172, SolidCashParser.RULE_forUpdate);
		let _la: number;
		try {
			this.state = 1762;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 187, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1755;
				this.match(SolidCashParser.Identifier);
				this.state = 1756;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1757;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1758;
				this.match(SolidCashParser.Identifier);
				this.state = 1759;
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
				this.state = 1760;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1761;
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
		this.enterRule(localctx, 174, SolidCashParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1764;
			this.match(SolidCashParser.T__94);
			this.state = 1765;
			this.block();
			this.state = 1766;
			this.match(SolidCashParser.T__95);
			this.state = 1767;
			this.match(SolidCashParser.T__48);
			this.state = 1768;
			this.expression(0);
			this.state = 1769;
			this.match(SolidCashParser.T__49);
			this.state = 1770;
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
		this.enterRule(localctx, 176, SolidCashParser.RULE_whileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1772;
			this.match(SolidCashParser.T__95);
			this.state = 1773;
			this.match(SolidCashParser.T__48);
			this.state = 1774;
			this.expression(0);
			this.state = 1775;
			this.match(SolidCashParser.T__49);
			this.state = 1776;
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
		this.enterRule(localctx, 178, SolidCashParser.RULE_consoleStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1778;
			this.match(SolidCashParser.T__96);
			this.state = 1779;
			this.consoleParameterList();
			this.state = 1780;
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
		this.enterRule(localctx, 180, SolidCashParser.RULE_assemblyStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1782;
			this.match(SolidCashParser.T__97);
			this.state = 1783;
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
		this.enterRule(localctx, 182, SolidCashParser.RULE_yulBlock);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1785;
			this.match(SolidCashParser.T__3);
			this.state = 1789;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026534544) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 31) !== 0) || ((((_la - 75)) & ~0x1F) === 0 && ((1 << (_la - 75)) & 788594689) !== 0) || _la===108 || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				{
				this.state = 1786;
				this.yulStatement();
				}
				}
				this.state = 1791;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1792;
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
		this.enterRule(localctx, 184, SolidCashParser.RULE_yulStatement);
		try {
			this.state = 1807;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 189, this._ctx) ) {
			case 1:
				localctx = new YulNestedBlockStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1794;
				this.yulBlock();
				}
				break;
			case 2:
				localctx = new YulVarDeclStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1795;
				this.yulVariableDeclaration();
				}
				break;
			case 3:
				localctx = new YulAssignStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1796;
				this.yulAssignment();
				}
				break;
			case 4:
				localctx = new YulIfStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1797;
				this.yulIf();
				}
				break;
			case 5:
				localctx = new YulSwitchStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1798;
				this.yulSwitch();
				}
				break;
			case 6:
				localctx = new YulForStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1799;
				this.yulForLoop();
				}
				break;
			case 7:
				localctx = new YulFunctionDefStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1800;
				this.yulFunctionDefinition();
				}
				break;
			case 8:
				localctx = new YulBreakStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1801;
				this.match(SolidCashParser.T__98);
				}
				break;
			case 9:
				localctx = new YulContinueStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1802;
				this.match(SolidCashParser.T__99);
				}
				break;
			case 10:
				localctx = new YulLeaveStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1803;
				this.match(SolidCashParser.T__100);
				}
				break;
			case 11:
				localctx = new YulCallStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1804;
				this.yulFunctionCall();
				}
				break;
			case 12:
				localctx = new YulPathStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1805;
				this.yulPath();
				}
				break;
			case 13:
				localctx = new YulLiteralStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1806;
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
		this.enterRule(localctx, 186, SolidCashParser.RULE_yulVariableDeclaration);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1809;
			this.match(SolidCashParser.T__101);
			this.state = 1810;
			this.anyIdentifier();
			this.state = 1815;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1811;
				this.match(SolidCashParser.T__4);
				this.state = 1812;
				this.anyIdentifier();
				}
				}
				this.state = 1817;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1820;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===103) {
				{
				this.state = 1818;
				this.match(SolidCashParser.T__102);
				this.state = 1819;
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
		this.enterRule(localctx, 188, SolidCashParser.RULE_yulAssignment);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1822;
			this.yulPath();
			this.state = 1827;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1823;
				this.match(SolidCashParser.T__4);
				this.state = 1824;
				this.yulPath();
				}
				}
				this.state = 1829;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1830;
			this.match(SolidCashParser.T__102);
			this.state = 1831;
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
		this.enterRule(localctx, 190, SolidCashParser.RULE_yulIf);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1833;
			this.match(SolidCashParser.T__90);
			this.state = 1834;
			this.yulExpression();
			this.state = 1835;
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
		this.enterRule(localctx, 192, SolidCashParser.RULE_yulSwitch);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1837;
			this.match(SolidCashParser.T__103);
			this.state = 1838;
			this.yulExpression();
			this.state = 1848;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 105:
				{
				this.state = 1840;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1839;
					this.yulCase();
					}
					}
					this.state = 1842;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===105);
				this.state = 1845;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===106) {
					{
					this.state = 1844;
					this.yulDefault();
					}
				}

				}
				break;
			case 106:
				{
				this.state = 1847;
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
		this.enterRule(localctx, 194, SolidCashParser.RULE_yulCase);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1850;
			this.match(SolidCashParser.T__104);
			this.state = 1851;
			this.yulLiteral();
			this.state = 1852;
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
		this.enterRule(localctx, 196, SolidCashParser.RULE_yulDefault);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1854;
			this.match(SolidCashParser.T__105);
			this.state = 1855;
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
		this.enterRule(localctx, 198, SolidCashParser.RULE_yulForLoop);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1857;
			this.match(SolidCashParser.T__8);
			this.state = 1858;
			this.yulBlock();
			this.state = 1859;
			this.yulExpression();
			this.state = 1860;
			this.yulBlock();
			this.state = 1861;
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
		this.enterRule(localctx, 200, SolidCashParser.RULE_yulFunctionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1863;
			this.match(SolidCashParser.T__6);
			this.state = 1864;
			this.match(SolidCashParser.Identifier);
			this.state = 1865;
			this.match(SolidCashParser.T__48);
			this.state = 1874;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 1866;
				this.match(SolidCashParser.Identifier);
				this.state = 1871;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1867;
					this.match(SolidCashParser.T__4);
					this.state = 1868;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1873;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1876;
			this.match(SolidCashParser.T__49);
			this.state = 1886;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===107) {
				{
				this.state = 1877;
				this.match(SolidCashParser.T__106);
				this.state = 1878;
				this.match(SolidCashParser.Identifier);
				this.state = 1883;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1879;
					this.match(SolidCashParser.T__4);
					this.state = 1880;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1885;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1888;
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
		this.enterRule(localctx, 202, SolidCashParser.RULE_yulExpression);
		try {
			this.state = 1893;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 200, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1890;
				this.yulFunctionCall();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1891;
				this.yulPath();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1892;
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
		this.enterRule(localctx, 204, SolidCashParser.RULE_yulFunctionCall);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1895;
			this.yulFunctionName();
			this.state = 1896;
			this.match(SolidCashParser.T__48);
			this.state = 1905;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===75 || _la===108 || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				this.state = 1897;
				this.yulExpression();
				this.state = 1902;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1898;
					this.match(SolidCashParser.T__4);
					this.state = 1899;
					this.yulExpression();
					}
					}
					this.state = 1904;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
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
	public yulFunctionName(): YulFunctionNameContext {
		let localctx: YulFunctionNameContext = new YulFunctionNameContext(this, this._ctx, this.state);
		this.enterRule(localctx, 206, SolidCashParser.RULE_yulFunctionName);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1909;
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
		this.enterRule(localctx, 208, SolidCashParser.RULE_yulPath);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1911;
			this.anyIdentifier();
			this.state = 1916;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===12) {
				{
				{
				this.state = 1912;
				this.match(SolidCashParser.T__11);
				this.state = 1913;
				this.anyIdentifier();
				}
				}
				this.state = 1918;
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
		this.enterRule(localctx, 210, SolidCashParser.RULE_yulLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1919;
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
		this.enterRule(localctx, 212, SolidCashParser.RULE_uncheckedStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1921;
			this.match(SolidCashParser.T__108);
			this.state = 1922;
			this.match(SolidCashParser.T__3);
			this.state = 1926;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 1923;
				this.statement();
				}
				}
				this.state = 1928;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1929;
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
		this.enterRule(localctx, 214, SolidCashParser.RULE_switchStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1931;
			this.match(SolidCashParser.T__103);
			this.state = 1932;
			this.match(SolidCashParser.T__48);
			this.state = 1933;
			this.expression(0);
			this.state = 1934;
			this.match(SolidCashParser.T__49);
			this.state = 1935;
			this.match(SolidCashParser.T__3);
			this.state = 1939;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===105) {
				{
				{
				this.state = 1936;
				this.switchCase();
				}
				}
				this.state = 1941;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1943;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===106) {
				{
				this.state = 1942;
				this.switchDefault();
				}
			}

			this.state = 1945;
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
		this.enterRule(localctx, 216, SolidCashParser.RULE_switchCase);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1947;
			this.match(SolidCashParser.T__104);
			this.state = 1948;
			this.expression(0);
			this.state = 1949;
			this.match(SolidCashParser.T__109);
			this.state = 1953;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 1950;
				this.statement();
				}
				}
				this.state = 1955;
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
		this.enterRule(localctx, 218, SolidCashParser.RULE_switchDefault);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1956;
			this.match(SolidCashParser.T__105);
			this.state = 1957;
			this.match(SolidCashParser.T__109);
			this.state = 1961;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 1958;
				this.statement();
				}
				}
				this.state = 1963;
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
		this.enterRule(localctx, 220, SolidCashParser.RULE_tryCatchStatement);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1964;
			this.match(SolidCashParser.T__110);
			this.state = 1965;
			this.expression(0);
			this.state = 1967;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 1966;
				this.tryReturns();
				}
			}

			this.state = 1969;
			localctx._tryBlock = this.block();
			this.state = 1971;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1970;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1973;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 210, this._ctx);
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
		this.enterRule(localctx, 222, SolidCashParser.RULE_tryReturns);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1975;
			this.match(SolidCashParser.T__72);
			this.state = 1976;
			this.match(SolidCashParser.T__48);
			this.state = 1988;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1977;
				this.parameter();
				this.state = 1982;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 211, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1978;
						this.match(SolidCashParser.T__4);
						this.state = 1979;
						this.parameter();
						}
						}
					}
					this.state = 1984;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 211, this._ctx);
				}
				this.state = 1986;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1985;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1990;
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
		this.enterRule(localctx, 224, SolidCashParser.RULE_catchClause);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1992;
			this.match(SolidCashParser.T__111);
			this.state = 1994;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 214, this._ctx) ) {
			case 1:
				{
				this.state = 1993;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 2011;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 218, this._ctx) ) {
			case 1:
				{
				this.state = 1996;
				this.match(SolidCashParser.T__48);
				this.state = 2008;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 1997;
					this.parameter();
					this.state = 2002;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 215, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1998;
							this.match(SolidCashParser.T__4);
							this.state = 1999;
							this.parameter();
							}
							}
						}
						this.state = 2004;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 215, this._ctx);
					}
					this.state = 2006;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2005;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2010;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
			this.state = 2013;
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
		this.enterRule(localctx, 226, SolidCashParser.RULE_breakStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2015;
			this.match(SolidCashParser.T__98);
			this.state = 2016;
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
		this.enterRule(localctx, 228, SolidCashParser.RULE_continueStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2018;
			this.match(SolidCashParser.T__99);
			this.state = 2019;
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
		this.enterRule(localctx, 230, SolidCashParser.RULE_requireMessage);
		try {
			this.state = 2024;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 151:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2021;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 180:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2022;
				this.match(SolidCashParser.Identifier);
				this.state = 2023;
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
		this.enterRule(localctx, 232, SolidCashParser.RULE_revertStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 2068;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 225, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
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
				this.match(SolidCashParser.T__48);
				this.state = 2033;
				this.match(SolidCashParser.T__3);
				this.state = 2045;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2034;
					this.namedArg();
					this.state = 2039;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 221, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2035;
							this.match(SolidCashParser.T__4);
							this.state = 2036;
							this.namedArg();
							}
							}
						}
						this.state = 2041;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 221, this._ctx);
					}
					this.state = 2043;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2042;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2047;
				this.match(SolidCashParser.T__5);
				this.state = 2048;
				this.match(SolidCashParser.T__49);
				this.state = 2049;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2050;
				this.match(SolidCashParser.T__35);
				this.state = 2051;
				this.match(SolidCashParser.Identifier);
				this.state = 2054;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 2052;
					this.match(SolidCashParser.T__11);
					this.state = 2053;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 2056;
				this.expressionList();
				this.state = 2057;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2059;
				this.match(SolidCashParser.T__35);
				this.state = 2060;
				this.match(SolidCashParser.T__48);
				this.state = 2061;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2062;
				this.match(SolidCashParser.T__49);
				this.state = 2063;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2064;
				this.match(SolidCashParser.T__35);
				this.state = 2065;
				this.match(SolidCashParser.T__48);
				this.state = 2066;
				this.match(SolidCashParser.T__49);
				this.state = 2067;
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
		this.enterRule(localctx, 234, SolidCashParser.RULE_assertStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2070;
			this.match(SolidCashParser.T__112);
			this.state = 2071;
			this.match(SolidCashParser.T__48);
			this.state = 2072;
			this.expression(0);
			this.state = 2073;
			this.match(SolidCashParser.T__49);
			this.state = 2074;
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
		this.enterRule(localctx, 236, SolidCashParser.RULE_consoleParameter);
		try {
			this.state = 2078;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 180:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2076;
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
				this.state = 2077;
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
		this.enterRule(localctx, 238, SolidCashParser.RULE_consoleParameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2080;
			this.match(SolidCashParser.T__48);
			this.state = 2092;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 3152921) !== 0) || _la===180) {
				{
				this.state = 2081;
				this.consoleParameter();
				this.state = 2086;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 227, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2082;
						this.match(SolidCashParser.T__4);
						this.state = 2083;
						this.consoleParameter();
						}
						}
					}
					this.state = 2088;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 227, this._ctx);
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
		this.enterRule(localctx, 240, SolidCashParser.RULE_functionCall);
		let _la: number;
		try {
			let _alt: number;
			this.state = 2120;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 233, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2096;
				this.match(SolidCashParser.Identifier);
				this.state = 2097;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2098;
				this.match(SolidCashParser.Identifier);
				this.state = 2099;
				this.match(SolidCashParser.T__11);
				this.state = 2100;
				this.match(SolidCashParser.Identifier);
				this.state = 2101;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2102;
				this.match(SolidCashParser.Identifier);
				this.state = 2103;
				this.match(SolidCashParser.T__48);
				this.state = 2104;
				this.match(SolidCashParser.T__3);
				this.state = 2116;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2105;
					this.namedArg();
					this.state = 2110;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 230, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2106;
							this.match(SolidCashParser.T__4);
							this.state = 2107;
							this.namedArg();
							}
							}
						}
						this.state = 2112;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 230, this._ctx);
					}
					this.state = 2114;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2113;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2118;
				this.match(SolidCashParser.T__5);
				this.state = 2119;
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
		this.enterRule(localctx, 242, SolidCashParser.RULE_namedArg);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2122;
			this.match(SolidCashParser.Identifier);
			this.state = 2123;
			this.match(SolidCashParser.T__109);
			this.state = 2124;
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
		this.enterRule(localctx, 244, SolidCashParser.RULE_expressionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2126;
			this.match(SolidCashParser.T__48);
			this.state = 2138;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
				{
				this.state = 2127;
				this.expression(0);
				this.state = 2132;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 234, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2128;
						this.match(SolidCashParser.T__4);
						this.state = 2129;
						this.expression(0);
						}
						}
					}
					this.state = 2134;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 234, this._ctx);
				}
				this.state = 2136;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2135;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2140;
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
		this.enterRule(localctx, 246, SolidCashParser.RULE_callOptions);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2142;
			this.match(SolidCashParser.T__3);
			this.state = 2143;
			this.callOption();
			this.state = 2148;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 237, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2144;
					this.match(SolidCashParser.T__4);
					this.state = 2145;
					this.callOption();
					}
					}
				}
				this.state = 2150;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 237, this._ctx);
			}
			this.state = 2152;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2151;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 2154;
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
		this.enterRule(localctx, 248, SolidCashParser.RULE_callOption);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2156;
			this.match(SolidCashParser.Identifier);
			this.state = 2157;
			this.match(SolidCashParser.T__109);
			this.state = 2158;
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
		this.enterRule(localctx, 250, SolidCashParser.RULE_typeList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2160;
			this.match(SolidCashParser.T__48);
			this.state = 2161;
			this.typeListItem();
			this.state = 2166;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 239, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2162;
					this.match(SolidCashParser.T__4);
					this.state = 2163;
					this.typeListItem();
					}
					}
				}
				this.state = 2168;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 239, this._ctx);
			}
			this.state = 2170;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2169;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 2172;
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
		this.enterRule(localctx, 252, SolidCashParser.RULE_typeListItem);
		try {
			this.state = 2176;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 241, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2174;
				this.typeName();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2175;
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
		let _startState: number = 254;
		this.enterRecursionRule(localctx, 254, SolidCashParser.RULE_expression, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2333;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 250, this._ctx) ) {
			case 1:
				{
				localctx = new AssignmentExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 2179;
				this.match(SolidCashParser.T__48);
				this.state = 2180;
				this.match(SolidCashParser.Identifier);
				this.state = 2181;
				(localctx as AssignmentExpressionContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    (localctx as AssignmentExpressionContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2182;
				this.expression(0);
				this.state = 2183;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2185;
				this.match(SolidCashParser.T__48);
				this.state = 2186;
				this.expression(0);
				this.state = 2187;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				{
				localctx = new TupleExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2189;
				this.match(SolidCashParser.T__48);
				this.state = 2190;
				this.expression(0);
				this.state = 2193;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2191;
					this.match(SolidCashParser.T__4);
					this.state = 2192;
					this.expression(0);
					}
					}
					this.state = 2195;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2197;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 4:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2199;
				this.typeCast();
				this.state = 2200;
				this.match(SolidCashParser.T__48);
				this.state = 2201;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 2203;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2202;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 2205;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 5:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2207;
				this.functionCall();
				}
				break;
			case 6:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2208;
				this.match(SolidCashParser.T__113);
				this.state = 2209;
				this.match(SolidCashParser.Identifier);
				this.state = 2211;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 2210;
					this.callOptions();
					}
				}

				this.state = 2213;
				this.expressionList();
				}
				break;
			case 7:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2214;
				this.match(SolidCashParser.T__113);
				this.state = 2215;
				this.typeName();
				this.state = 2218;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2216;
					this.match(SolidCashParser.T__65);
					this.state = 2217;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 2220;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 2222;
				this.match(SolidCashParser.T__48);
				this.state = 2223;
				this.expression(0);
				this.state = 2224;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 8:
				{
				localctx = new NewDynamicBytesContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2226;
				this.match(SolidCashParser.T__113);
				this.state = 2227;
				this.match(SolidCashParser.UnboundedBytes);
				this.state = 2228;
				this.match(SolidCashParser.T__48);
				this.state = 2229;
				this.expression(0);
				this.state = 2230;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 9:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2232;
				this.match(SolidCashParser.T__54);
				this.state = 2233;
				this.match(SolidCashParser.T__48);
				this.state = 2234;
				this.typeName();
				this.state = 2235;
				this.match(SolidCashParser.T__49);
				this.state = 2236;
				this.match(SolidCashParser.T__11);
				this.state = 2237;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 10:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2239;
				this.match(SolidCashParser.T__114);
				this.state = 2240;
				this.expressionList();
				}
				break;
			case 11:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2241;
				this.match(SolidCashParser.T__115);
				this.state = 2242;
				this.expressionList();
				}
				break;
			case 12:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2243;
				this.match(SolidCashParser.T__116);
				this.state = 2244;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2245;
				this.match(SolidCashParser.T__117);
				this.state = 2246;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2247;
				this.match(SolidCashParser.T__118);
				this.state = 2248;
				this.match(SolidCashParser.T__48);
				this.state = 2249;
				this.match(SolidCashParser.Identifier);
				this.state = 2250;
				this.match(SolidCashParser.T__11);
				this.state = 2251;
				this.match(SolidCashParser.Identifier);
				this.state = 2252;
				this.match(SolidCashParser.T__4);
				this.state = 2253;
				this.expressionList();
				this.state = 2254;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 15:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2256;
				this.match(SolidCashParser.T__119);
				this.state = 2257;
				this.expressionList();
				}
				break;
			case 16:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2258;
				this.match(SolidCashParser.T__120);
				this.state = 2259;
				this.expressionList();
				}
				break;
			case 17:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2260;
				this.match(SolidCashParser.T__121);
				this.state = 2261;
				this.match(SolidCashParser.T__48);
				this.state = 2262;
				this.expression(0);
				this.state = 2263;
				this.match(SolidCashParser.T__4);
				this.state = 2264;
				this.typeList();
				this.state = 2265;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 18:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2267;
				this.match(SolidCashParser.T__122);
				this.state = 2268;
				this.match(SolidCashParser.T__48);
				this.state = 2269;
				this.expression(0);
				this.state = 2270;
				this.match(SolidCashParser.T__4);
				this.state = 2271;
				this.typeList();
				this.state = 2272;
				this.match(SolidCashParser.T__4);
				this.state = 2273;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 2274;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 19:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2276;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__123);
				this.state = 2277;
				this.match(SolidCashParser.T__65);
				this.state = 2278;
				this.expression(0);
				this.state = 2279;
				this.match(SolidCashParser.T__66);
				this.state = 2280;
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
				this.state = 2282;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__124);
				this.state = 2283;
				this.match(SolidCashParser.T__65);
				this.state = 2284;
				this.expression(0);
				this.state = 2285;
				this.match(SolidCashParser.T__66);
				this.state = 2286;
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
				this.state = 2288;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===127)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2289;
				this.expression(21);
				}
				break;
			case 22:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2290;
				this.match(SolidCashParser.T__65);
				this.state = 2302;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 2291;
					this.expression(0);
					this.state = 2296;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 246, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2292;
							this.match(SolidCashParser.T__4);
							this.state = 2293;
							this.expression(0);
							}
							}
						}
						this.state = 2298;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 246, this._ctx);
					}
					this.state = 2300;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2299;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2304;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 23:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2305;
				this.match(SolidCashParser.T__73);
				this.state = 2306;
				this.match(SolidCashParser.T__11);
				this.state = 2307;
				this.match(SolidCashParser.Identifier);
				this.state = 2308;
				this.match(SolidCashParser.T__11);
				this.state = 2309;
				this.match(SolidCashParser.Identifier);
				this.state = 2310;
				this.match(SolidCashParser.T__65);
				this.state = 2311;
				this.expression(0);
				this.state = 2312;
				this.match(SolidCashParser.T__66);
				this.state = 2313;
				this.memberName();
				}
				break;
			case 24:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2315;
				this.match(SolidCashParser.T__73);
				this.state = 2316;
				this.match(SolidCashParser.T__11);
				this.state = 2317;
				this.match(SolidCashParser.Identifier);
				this.state = 2322;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2318;
						this.match(SolidCashParser.T__65);
						this.state = 2319;
						this.expression(0);
						this.state = 2320;
						this.match(SolidCashParser.T__66);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2324;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 249, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 25:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2326;
				this.match(SolidCashParser.T__73);
				this.state = 2327;
				this.match(SolidCashParser.T__11);
				this.state = 2328;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 26:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2329;
				this.match(SolidCashParser.T__73);
				}
				break;
			case 27:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2330;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 28:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2331;
				this.anyIdentifier();
				}
				break;
			case 29:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2332;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2442;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 257, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2440;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 256, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2335;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 2336;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 2337;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2338;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 2339;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2340;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2341;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 2342;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2343;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2344;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 2345;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===128 || _la===129)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2346;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2347;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 2348;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2349;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2350;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2351;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2352;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2353;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2354;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2355;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2356;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2357;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2358;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2359;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2360;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2361;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2362;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2363;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__129);
						this.state = 2364;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2365;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2366;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__130);
						this.state = 2367;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2368;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 2369;
						this.match(SolidCashParser.T__131);
						this.state = 2370;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 2371;
						this.match(SolidCashParser.T__109);
						this.state = 2372;
						(localctx as TernaryOpContext)._ifFalse = this.expression(9);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2374;
						if (!(this.precpred(this._ctx, 33))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 33)");
						}
						this.state = 2375;
						this.match(SolidCashParser.T__65);
						this.state = 2376;
						(localctx as IndexRangeSliceContext)._start = this.expression(0);
						this.state = 2377;
						this.match(SolidCashParser.T__109);
						this.state = 2378;
						(localctx as IndexRangeSliceContext)._end = this.expression(0);
						this.state = 2379;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2381;
						if (!(this.precpred(this._ctx, 32))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 32)");
						}
						this.state = 2382;
						this.match(SolidCashParser.T__65);
						this.state = 2383;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2384;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2385;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 2386;
						this.match(SolidCashParser.T__65);
						this.state = 2387;
						this.expression(0);
						this.state = 2388;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2390;
						if (!(this.precpred(this._ctx, 28))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 28)");
						}
						this.state = 2391;
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
						this.state = 2392;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2393;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.DotSplit);
						this.state = 2394;
						this.match(SolidCashParser.T__48);
						this.state = 2395;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2396;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2398;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2399;
						this.match(SolidCashParser.DotSlice);
						this.state = 2400;
						this.match(SolidCashParser.T__48);
						this.state = 2401;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2402;
						this.match(SolidCashParser.T__4);
						this.state = 2403;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2404;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2406;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2407;
						this.match(SolidCashParser.T__11);
						this.state = 2408;
						this.match(SolidCashParser.Identifier);
						this.state = 2410;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2409;
							this.callOptions();
							}
						}

						this.state = 2412;
						this.match(SolidCashParser.T__48);
						this.state = 2413;
						this.match(SolidCashParser.T__3);
						this.state = 2425;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===180) {
							{
							this.state = 2414;
							this.namedArg();
							this.state = 2419;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 252, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2415;
									this.match(SolidCashParser.T__4);
									this.state = 2416;
									this.namedArg();
									}
									}
								}
								this.state = 2421;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 252, this._ctx);
							}
							this.state = 2423;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2422;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2427;
						this.match(SolidCashParser.T__5);
						this.state = 2428;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 20:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2429;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2430;
						this.match(SolidCashParser.T__11);
						this.state = 2431;
						this.match(SolidCashParser.Identifier);
						this.state = 2433;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2432;
							this.callOptions();
							}
						}

						this.state = 2435;
						this.expressionList();
						}
						break;
					case 21:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2436;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2437;
						this.memberName();
						}
						break;
					case 22:
						{
						localctx = new PostfixOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2438;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 2439;
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
				this.state = 2444;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 257, this._ctx);
			}
			}
		}
		catch (re) {
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
		this.enterRule(localctx, 256, SolidCashParser.RULE_memberName);
		try {
			this.state = 2458;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2445;
				this.match(SolidCashParser.T__11);
				this.state = 2446;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2447;
				this.match(SolidCashParser.DotValue);
				}
				break;
			case 172:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2448;
				this.match(SolidCashParser.DotLockingBytecode);
				}
				break;
			case 173:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2449;
				this.match(SolidCashParser.DotTokenCategory);
				}
				break;
			case 174:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2450;
				this.match(SolidCashParser.DotNftCommitment);
				}
				break;
			case 175:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2451;
				this.match(SolidCashParser.DotTokenAmount);
				}
				break;
			case 176:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2452;
				this.match(SolidCashParser.DotOutpointTransactionHash);
				}
				break;
			case 177:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2453;
				this.match(SolidCashParser.DotOutpointIndex);
				}
				break;
			case 178:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2454;
				this.match(SolidCashParser.DotUnlockingBytecode);
				}
				break;
			case 179:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2455;
				this.match(SolidCashParser.DotSequenceNumber);
				}
				break;
			case 170:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2456;
				this.match(SolidCashParser.DotCode);
				}
				break;
			case 171:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2457;
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
		this.enterRule(localctx, 258, SolidCashParser.RULE_modifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2460;
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
		this.enterRule(localctx, 260, SolidCashParser.RULE_literal);
		try {
			let _alt: number;
			this.state = 2476;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 141:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2462;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 145:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2463;
				this.numberLiteral();
				}
				break;
			case 144:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2464;
				this.decimalLiteral();
				}
				break;
			case 151:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2465;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2469;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 259, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2466;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2471;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 259, this._ctx);
				}
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2472;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2473;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 152:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2474;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 153:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2475;
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
		this.enterRule(localctx, 262, SolidCashParser.RULE_numberLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2478;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2480;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 261, this._ctx) ) {
			case 1:
				{
				this.state = 2479;
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
		this.enterRule(localctx, 264, SolidCashParser.RULE_decimalLiteral);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2482;
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
		this.enterRule(localctx, 266, SolidCashParser.RULE_typeName);
		let _la: number;
		try {
			this.state = 2534;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 267, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2484;
				this.match(SolidCashParser.T__107);
				this.state = 2485;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2486;
				this.match(SolidCashParser.T__107);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2487;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2488;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2489;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2490;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2491;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2492;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2493;
				this.match(SolidCashParser.T__137);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2494;
				this.match(SolidCashParser.T__138);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2495;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2496;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2497;
				this.match(SolidCashParser.T__6);
				this.state = 2498;
				this.match(SolidCashParser.T__48);
				this.state = 2507;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 2499;
					this.typeName();
					this.state = 2504;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2500;
						this.match(SolidCashParser.T__4);
						this.state = 2501;
						this.typeName();
						}
						}
						this.state = 2506;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2509;
				this.match(SolidCashParser.T__49);
				this.state = 2513;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===70 || _la===71) {
					{
					{
					this.state = 2510;
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
					this.state = 2515;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 2528;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===73) {
					{
					this.state = 2516;
					this.match(SolidCashParser.T__72);
					this.state = 2517;
					this.match(SolidCashParser.T__48);
					this.state = 2518;
					this.typeName();
					this.state = 2523;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2519;
						this.match(SolidCashParser.T__4);
						this.state = 2520;
						this.typeName();
						}
						}
						this.state = 2525;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2526;
					this.match(SolidCashParser.T__49);
					}
				}

				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2530;
				this.match(SolidCashParser.Identifier);
				this.state = 2531;
				this.match(SolidCashParser.T__11);
				this.state = 2532;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 2533;
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
		this.enterRule(localctx, 268, SolidCashParser.RULE_typeCast);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2536;
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
		case 127:
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

	public static readonly _serializedATN: number[] = [4,1,183,2539,2,0,7,0,
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
	7,133,2,134,7,134,1,0,5,0,272,8,0,10,0,12,0,275,9,0,1,0,5,0,278,8,0,10,
	0,12,0,281,9,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,5,0,293,8,0,10,0,
	12,0,296,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,5,1,313,8,1,10,1,12,1,316,9,1,1,1,3,1,319,8,1,1,1,1,1,1,1,1,1,1,1,3,1,
	326,8,1,1,2,1,2,1,2,3,2,331,8,2,1,3,1,3,1,3,1,3,5,3,337,8,3,10,3,12,3,340,
	9,3,1,3,3,3,343,8,3,1,3,1,3,5,3,347,8,3,10,3,12,3,350,9,3,1,3,1,3,1,4,1,
	4,1,4,1,4,1,4,1,4,3,4,360,8,4,1,4,3,4,363,8,4,1,4,1,4,1,4,1,4,1,4,1,4,5,
	4,371,8,4,10,4,12,4,374,9,4,1,4,3,4,377,8,4,1,4,1,4,1,4,1,4,1,4,3,4,384,
	8,4,1,4,3,4,387,8,4,1,4,1,4,3,4,391,8,4,1,5,1,5,1,5,3,5,396,8,5,1,5,1,5,
	3,5,400,8,5,1,6,1,6,1,7,1,7,1,8,1,8,1,8,1,8,1,8,1,9,1,9,1,10,1,10,3,10,
	415,8,10,1,11,3,11,418,8,11,1,11,1,11,1,12,1,12,1,13,1,13,1,13,1,13,1,13,
	1,13,5,13,430,8,13,10,13,12,13,433,9,13,3,13,435,8,13,1,13,1,13,1,13,1,
	13,1,13,1,13,1,13,1,13,1,13,5,13,446,8,13,10,13,12,13,449,9,13,1,13,1,13,
	1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,3,14,463,8,14,1,15,1,
	15,1,15,1,15,1,15,1,16,1,16,1,17,1,17,1,17,1,17,5,17,476,8,17,10,17,12,
	17,479,9,17,1,17,3,17,482,8,17,1,17,1,17,1,18,1,18,1,18,1,18,5,18,490,8,
	18,10,18,12,18,493,9,18,1,18,5,18,496,8,18,10,18,12,18,499,9,18,1,18,5,
	18,502,8,18,10,18,12,18,505,9,18,1,18,5,18,508,8,18,10,18,12,18,511,9,18,
	1,18,5,18,514,8,18,10,18,12,18,517,9,18,1,18,5,18,520,8,18,10,18,12,18,
	523,9,18,1,18,5,18,526,8,18,10,18,12,18,529,9,18,1,18,5,18,532,8,18,10,
	18,12,18,535,9,18,1,18,5,18,538,8,18,10,18,12,18,541,9,18,1,18,1,18,1,19,
	3,19,546,8,19,1,19,1,19,1,19,3,19,551,8,19,1,19,1,19,1,19,1,19,5,19,557,
	8,19,10,19,12,19,560,9,19,3,19,562,8,19,1,19,1,19,1,19,1,19,1,19,1,19,1,
	19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,5,19,579,8,19,10,19,12,19,582,
	9,19,1,19,1,19,1,20,1,20,3,20,588,8,20,1,21,1,21,1,21,1,21,5,21,594,8,21,
	10,21,12,21,597,9,21,1,21,5,21,600,8,21,10,21,12,21,603,9,21,1,21,3,21,
	606,8,21,1,21,1,21,1,22,1,22,1,22,1,22,1,22,1,22,5,22,616,8,22,10,22,12,
	22,619,9,22,1,22,3,22,622,8,22,3,22,624,8,22,1,22,1,22,3,22,628,8,22,1,
	22,1,22,1,23,1,23,3,23,634,8,23,1,23,3,23,637,8,23,1,23,3,23,640,8,23,1,
	24,1,24,1,24,1,24,1,24,1,24,5,24,648,8,24,10,24,12,24,651,9,24,1,24,3,24,
	654,8,24,3,24,656,8,24,1,24,1,24,1,24,1,25,1,25,3,25,663,8,25,1,26,1,26,
	1,26,1,26,4,26,669,8,26,11,26,12,26,670,1,26,1,26,1,27,1,27,1,27,3,27,678,
	8,27,1,27,1,27,1,27,1,28,1,28,1,28,1,28,1,28,1,28,5,28,689,8,28,10,28,12,
	28,692,9,28,1,28,3,28,695,8,28,1,28,1,28,1,29,1,29,1,29,3,29,702,8,29,1,
	30,1,30,1,30,1,30,1,30,1,30,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,32,1,32,
	1,32,5,32,720,8,32,10,32,12,32,723,9,32,1,32,5,32,726,8,32,10,32,12,32,
	729,9,32,1,32,1,32,5,32,733,8,32,10,32,12,32,736,9,32,1,32,1,32,1,33,1,
	33,1,33,1,33,5,33,744,8,33,10,33,12,33,747,9,33,1,33,5,33,750,8,33,10,33,
	12,33,753,9,33,1,33,1,33,5,33,757,8,33,10,33,12,33,760,9,33,1,33,1,33,1,
	34,1,34,1,34,3,34,767,8,34,1,35,1,35,1,35,1,35,1,35,1,35,1,35,5,35,776,
	8,35,10,35,12,35,779,9,35,1,35,1,35,1,36,1,36,1,36,1,37,3,37,787,8,37,1,
	37,1,37,5,37,791,8,37,10,37,12,37,794,9,37,1,37,1,37,1,37,3,37,799,8,37,
	1,37,1,37,1,37,1,37,1,37,5,37,806,8,37,10,37,12,37,809,9,37,1,37,1,37,1,
	37,3,37,814,8,37,1,37,1,37,1,37,3,37,819,8,37,1,37,1,37,5,37,823,8,37,10,
	37,12,37,826,9,37,1,37,1,37,1,37,1,37,3,37,832,8,37,1,37,1,37,5,37,836,
	8,37,10,37,12,37,839,9,37,1,37,1,37,1,37,3,37,844,8,37,1,37,1,37,3,37,848,
	8,37,1,38,1,38,3,38,852,8,38,1,39,1,39,1,40,1,40,1,40,1,40,3,40,860,8,40,
	1,40,1,40,1,40,3,40,865,8,40,1,40,1,40,1,40,1,40,1,40,1,40,3,40,873,8,40,
	1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,3,40,883,8,40,1,40,1,40,1,40,3,
	40,888,8,40,1,40,1,40,3,40,892,8,40,1,41,1,41,1,41,1,41,1,41,1,41,1,41,
	1,41,1,41,1,41,3,41,904,8,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,5,41,913,
	8,41,10,41,12,41,916,9,41,1,42,1,42,1,42,3,42,921,8,42,1,42,1,42,5,42,925,
	8,42,10,42,12,42,928,9,42,1,42,1,42,1,43,1,43,3,43,934,8,43,1,44,1,44,1,
	44,1,45,1,45,1,45,1,45,5,45,943,8,45,10,45,12,45,946,9,45,1,45,5,45,949,
	8,45,10,45,12,45,952,9,45,1,45,3,45,955,8,45,1,45,1,45,5,45,959,8,45,10,
	45,12,45,962,9,45,1,45,1,45,1,46,1,46,3,46,968,8,46,1,47,1,47,1,47,1,47,
	1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,3,47,984,8,47,1,48,1,
	48,1,48,1,48,1,48,5,48,991,8,48,10,48,12,48,994,9,48,1,48,3,48,997,8,48,
	1,49,1,49,1,49,1,49,3,49,1003,8,49,1,50,1,50,1,50,1,50,1,50,5,50,1010,8,
	50,10,50,12,50,1013,9,50,1,50,3,50,1016,8,50,1,50,1,50,1,51,1,51,5,51,1022,
	8,51,10,51,12,51,1025,9,51,1,51,3,51,1028,8,51,1,51,1,51,5,51,1032,8,51,
	10,51,12,51,1035,9,51,1,51,3,51,1038,8,51,3,51,1040,8,51,1,52,1,52,1,52,
	1,52,5,52,1046,8,52,10,52,12,52,1049,9,52,1,52,3,52,1052,8,52,3,52,1054,
	8,52,1,52,1,52,1,53,1,53,5,53,1060,8,53,10,53,12,53,1063,9,53,1,53,3,53,
	1066,8,53,1,53,1,53,5,53,1070,8,53,10,53,12,53,1073,9,53,1,53,3,53,1076,
	8,53,1,53,1,53,5,53,1080,8,53,10,53,12,53,1083,9,53,1,53,3,53,1086,8,53,
	3,53,1088,8,53,1,54,1,54,5,54,1092,8,54,10,54,12,54,1095,9,54,1,54,1,54,
	3,54,1099,8,54,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,
	55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,
	1,55,1,55,1,55,1,55,1,55,1,55,3,55,1133,8,55,1,56,1,56,1,56,1,56,1,56,1,
	56,1,56,1,56,1,56,1,56,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,
	1,57,1,57,5,57,1157,8,57,10,57,12,57,1160,9,57,1,57,1,57,1,57,1,58,1,58,
	1,58,1,58,1,58,1,58,5,58,1171,8,58,10,58,12,58,1174,9,58,1,58,1,58,1,58,
	1,58,1,58,1,58,1,58,5,58,1183,8,58,10,58,12,58,1186,9,58,1,58,3,58,1189,
	8,58,1,58,1,58,1,58,3,58,1194,8,58,1,59,1,59,1,59,3,59,1199,8,59,1,59,1,
	59,1,59,1,59,1,59,5,59,1206,8,59,10,59,12,59,1209,9,59,1,59,3,59,1212,8,
	59,3,59,1214,8,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,
	1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,3,59,1236,8,59,1,59,1,59,1,
	59,3,59,1241,8,59,1,60,1,60,1,60,1,60,3,60,1247,8,60,1,60,1,60,1,60,1,61,
	1,61,1,61,1,61,1,61,1,61,1,62,1,62,1,62,1,62,3,62,1262,8,62,1,62,1,62,1,
	62,1,62,1,62,5,62,1269,8,62,10,62,12,62,1272,9,62,1,62,3,62,1275,8,62,3,
	62,1277,8,62,1,62,1,62,1,62,1,62,1,62,1,62,1,62,3,62,1286,8,62,1,62,1,62,
	1,62,3,62,1291,8,62,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1300,8,63,11,
	63,12,63,1301,3,63,1304,8,63,1,63,5,63,1307,8,63,10,63,12,63,1310,9,63,
	1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1321,8,63,11,63,12,63,
	1322,1,63,5,63,1326,8,63,10,63,12,63,1329,9,63,1,63,1,63,1,63,1,63,1,63,
	1,63,4,63,1337,8,63,11,63,12,63,1338,1,63,1,63,1,63,1,63,1,63,1,63,4,63,
	1347,8,63,11,63,12,63,1348,1,63,1,63,1,63,1,63,4,63,1355,8,63,11,63,12,
	63,1356,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1370,
	8,63,11,63,12,63,1371,3,63,1374,8,63,1,63,5,63,1377,8,63,10,63,12,63,1380,
	9,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1389,8,63,11,63,12,63,1390,
	1,63,5,63,1394,8,63,10,63,12,63,1397,9,63,1,63,1,63,1,63,1,63,1,63,4,63,
	1404,8,63,11,63,12,63,1405,1,63,1,63,1,63,3,63,1411,8,63,1,64,1,64,1,64,
	3,64,1416,8,64,1,65,1,65,1,65,1,65,1,65,1,65,1,65,5,65,1425,8,65,10,65,
	12,65,1428,9,65,1,65,1,65,1,65,1,65,1,65,1,65,1,66,1,66,5,66,1438,8,66,
	10,66,12,66,1441,9,66,1,66,1,66,1,66,3,66,1446,8,66,1,66,1,66,1,66,1,66,
	5,66,1452,8,66,10,66,12,66,1455,9,66,1,66,1,66,1,66,3,66,1460,8,66,1,66,
	1,66,3,66,1464,8,66,1,67,1,67,1,67,1,67,1,67,1,67,4,67,1472,8,67,11,67,
	12,67,1473,1,67,1,67,1,67,1,67,1,67,1,67,1,67,1,67,4,67,1484,8,67,11,67,
	12,67,1485,1,67,1,67,1,67,1,67,1,67,1,67,4,67,1494,8,67,11,67,12,67,1495,
	1,67,1,67,1,67,1,67,1,67,1,67,1,67,4,67,1505,8,67,11,67,12,67,1506,1,67,
	1,67,1,67,1,67,1,67,3,67,1514,8,67,1,68,1,68,5,68,1518,8,68,10,68,12,68,
	1521,9,68,1,68,1,68,1,68,1,68,3,68,1527,8,68,1,69,1,69,1,69,1,69,1,69,1,
	69,1,69,1,69,1,69,1,69,1,69,3,69,1540,8,69,1,70,1,70,1,70,1,70,1,70,1,70,
	1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,3,70,1558,8,70,1,71,1,
	71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,3,71,1572,8,71,1,72,
	1,72,1,72,1,72,1,72,1,72,1,72,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,
	73,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,75,1,75,1,75,1,75,1,75,1,75,
	1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,4,75,1614,8,75,11,75,
	12,75,1615,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,4,75,1626,8,75,11,75,
	12,75,1627,1,75,1,75,1,75,1,75,1,75,1,75,4,75,1636,8,75,11,75,12,75,1637,
	1,75,1,75,1,75,1,75,4,75,1644,8,75,11,75,12,75,1645,1,75,1,75,3,75,1650,
	8,75,1,76,1,76,1,76,1,76,1,76,1,76,1,76,3,76,1659,8,76,1,76,1,76,1,76,1,
	77,1,77,1,77,1,77,1,77,3,77,1669,8,77,1,77,1,77,1,77,1,78,1,78,1,78,1,78,
	1,78,1,78,1,78,3,78,1681,8,78,1,79,1,79,1,79,1,79,1,79,1,79,3,79,1689,8,
	79,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,
	1,80,1,80,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,82,1,
	82,1,82,1,82,1,82,1,82,1,82,1,82,1,82,1,82,1,82,1,83,1,83,1,83,1,83,1,83,
	3,83,1734,8,83,1,83,1,83,1,83,1,84,1,84,5,84,1741,8,84,10,84,12,84,1744,
	9,84,1,84,1,84,1,84,3,84,1749,8,84,1,84,1,84,1,85,1,85,1,85,1,86,1,86,1,
	86,1,86,1,86,1,86,1,86,3,86,1763,8,86,1,87,1,87,1,87,1,87,1,87,1,87,1,87,
	1,87,1,88,1,88,1,88,1,88,1,88,1,88,1,89,1,89,1,89,1,89,1,90,1,90,1,90,1,
	91,1,91,5,91,1788,8,91,10,91,12,91,1791,9,91,1,91,1,91,1,92,1,92,1,92,1,
	92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,3,92,1808,8,92,1,93,1,93,
	1,93,1,93,5,93,1814,8,93,10,93,12,93,1817,9,93,1,93,1,93,3,93,1821,8,93,
	1,94,1,94,1,94,5,94,1826,8,94,10,94,12,94,1829,9,94,1,94,1,94,1,94,1,95,
	1,95,1,95,1,95,1,96,1,96,1,96,4,96,1841,8,96,11,96,12,96,1842,1,96,3,96,
	1846,8,96,1,96,3,96,1849,8,96,1,97,1,97,1,97,1,97,1,98,1,98,1,98,1,99,1,
	99,1,99,1,99,1,99,1,99,1,100,1,100,1,100,1,100,1,100,1,100,5,100,1870,8,
	100,10,100,12,100,1873,9,100,3,100,1875,8,100,1,100,1,100,1,100,1,100,1,
	100,5,100,1882,8,100,10,100,12,100,1885,9,100,3,100,1887,8,100,1,100,1,
	100,1,101,1,101,1,101,3,101,1894,8,101,1,102,1,102,1,102,1,102,1,102,5,
	102,1901,8,102,10,102,12,102,1904,9,102,3,102,1906,8,102,1,102,1,102,1,
	103,1,103,1,104,1,104,1,104,5,104,1915,8,104,10,104,12,104,1918,9,104,1,
	105,1,105,1,106,1,106,1,106,5,106,1925,8,106,10,106,12,106,1928,9,106,1,
	106,1,106,1,107,1,107,1,107,1,107,1,107,1,107,5,107,1938,8,107,10,107,12,
	107,1941,9,107,1,107,3,107,1944,8,107,1,107,1,107,1,108,1,108,1,108,1,108,
	5,108,1952,8,108,10,108,12,108,1955,9,108,1,109,1,109,1,109,5,109,1960,
	8,109,10,109,12,109,1963,9,109,1,110,1,110,1,110,3,110,1968,8,110,1,110,
	1,110,4,110,1972,8,110,11,110,12,110,1973,1,111,1,111,1,111,1,111,1,111,
	5,111,1981,8,111,10,111,12,111,1984,9,111,1,111,3,111,1987,8,111,3,111,
	1989,8,111,1,111,1,111,1,112,1,112,3,112,1995,8,112,1,112,1,112,1,112,1,
	112,5,112,2001,8,112,10,112,12,112,2004,9,112,1,112,3,112,2007,8,112,3,
	112,2009,8,112,1,112,3,112,2012,8,112,1,112,1,112,1,113,1,113,1,113,1,114,
	1,114,1,114,1,115,1,115,1,115,3,115,2025,8,115,1,116,1,116,1,116,1,116,
	3,116,2031,8,116,1,116,1,116,1,116,1,116,1,116,5,116,2038,8,116,10,116,
	12,116,2041,9,116,1,116,3,116,2044,8,116,3,116,2046,8,116,1,116,1,116,1,
	116,1,116,1,116,1,116,1,116,3,116,2055,8,116,1,116,1,116,1,116,1,116,1,
	116,1,116,1,116,1,116,1,116,1,116,1,116,1,116,3,116,2069,8,116,1,117,1,
	117,1,117,1,117,1,117,1,117,1,118,1,118,3,118,2079,8,118,1,119,1,119,1,
	119,1,119,5,119,2085,8,119,10,119,12,119,2088,9,119,1,119,3,119,2091,8,
	119,3,119,2093,8,119,1,119,1,119,1,120,1,120,1,120,1,120,1,120,1,120,1,
	120,1,120,1,120,1,120,1,120,1,120,5,120,2109,8,120,10,120,12,120,2112,9,
	120,1,120,3,120,2115,8,120,3,120,2117,8,120,1,120,1,120,3,120,2121,8,120,
	1,121,1,121,1,121,1,121,1,122,1,122,1,122,1,122,5,122,2131,8,122,10,122,
	12,122,2134,9,122,1,122,3,122,2137,8,122,3,122,2139,8,122,1,122,1,122,1,
	123,1,123,1,123,1,123,5,123,2147,8,123,10,123,12,123,2150,9,123,1,123,3,
	123,2153,8,123,1,123,1,123,1,124,1,124,1,124,1,124,1,125,1,125,1,125,1,
	125,5,125,2165,8,125,10,125,12,125,2168,9,125,1,125,3,125,2171,8,125,1,
	125,1,125,1,126,1,126,3,126,2177,8,126,1,127,1,127,1,127,1,127,1,127,1,
	127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,4,127,2194,8,
	127,11,127,12,127,2195,1,127,1,127,1,127,1,127,1,127,1,127,3,127,2204,8,
	127,1,127,1,127,1,127,1,127,1,127,1,127,3,127,2212,8,127,1,127,1,127,1,
	127,1,127,1,127,4,127,2219,8,127,11,127,12,127,2220,1,127,1,127,1,127,1,
	127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,
	127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,
	127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,
	127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,
	127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,
	127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,5,127,2295,8,127,10,
	127,12,127,2298,9,127,1,127,3,127,2301,8,127,3,127,2303,8,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,4,127,2323,8,127,11,127,12,127,2324,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,3,127,2334,8,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,3,127,
	2411,8,127,1,127,1,127,1,127,1,127,1,127,5,127,2418,8,127,10,127,12,127,
	2421,9,127,1,127,3,127,2424,8,127,3,127,2426,8,127,1,127,1,127,1,127,1,
	127,1,127,1,127,3,127,2434,8,127,1,127,1,127,1,127,1,127,1,127,5,127,2441,
	8,127,10,127,12,127,2444,9,127,1,128,1,128,1,128,1,128,1,128,1,128,1,128,
	1,128,1,128,1,128,1,128,1,128,1,128,3,128,2459,8,128,1,129,1,129,1,130,
	1,130,1,130,1,130,1,130,5,130,2468,8,130,10,130,12,130,2471,9,130,1,130,
	1,130,1,130,1,130,3,130,2477,8,130,1,131,1,131,3,131,2481,8,131,1,132,1,
	132,1,133,1,133,1,133,1,133,1,133,1,133,1,133,1,133,1,133,1,133,1,133,1,
	133,1,133,1,133,1,133,1,133,1,133,1,133,5,133,2503,8,133,10,133,12,133,
	2506,9,133,3,133,2508,8,133,1,133,1,133,5,133,2512,8,133,10,133,12,133,
	2515,9,133,1,133,1,133,1,133,1,133,1,133,5,133,2522,8,133,10,133,12,133,
	2525,9,133,1,133,1,133,3,133,2529,8,133,1,133,1,133,1,133,1,133,3,133,2535,
	8,133,1,134,1,134,1,134,0,2,82,254,135,0,2,4,6,8,10,12,14,16,18,20,22,24,
	26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,
	74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,110,112,114,
	116,118,120,122,124,126,128,130,132,134,136,138,140,142,144,146,148,150,
	152,154,156,158,160,162,164,166,168,170,172,174,176,178,180,182,184,186,
	188,190,192,194,196,198,200,202,204,206,208,210,212,214,216,218,220,222,
	224,226,228,230,232,234,236,238,240,242,244,246,248,250,252,254,256,258,
	260,262,264,266,268,0,25,2,0,10,10,13,27,5,0,11,11,28,36,143,143,147,147,
	180,180,1,0,38,39,3,0,20,23,26,27,40,40,1,0,43,44,2,0,43,44,58,59,3,0,43,
	44,58,58,63,63,2,0,145,145,180,180,2,0,40,40,77,86,1,0,87,88,6,0,31,31,
	36,36,75,75,108,108,149,149,180,180,5,0,141,141,145,145,151,151,153,153,
	162,162,2,0,163,163,172,175,2,0,163,163,172,179,3,0,14,14,27,27,127,127,
	2,0,10,10,15,16,1,0,13,14,1,0,128,129,1,0,20,23,1,0,18,19,2,0,126,126,164,
	164,3,0,33,33,56,56,133,137,1,0,142,143,1,0,70,71,5,0,59,59,108,108,138,
	139,146,149,155,159,2858,0,273,1,0,0,0,2,325,1,0,0,0,4,327,1,0,0,0,6,332,
	1,0,0,0,8,390,1,0,0,0,10,392,1,0,0,0,12,401,1,0,0,0,14,403,1,0,0,0,16,405,
	1,0,0,0,18,410,1,0,0,0,20,412,1,0,0,0,22,417,1,0,0,0,24,421,1,0,0,0,26,
	423,1,0,0,0,28,462,1,0,0,0,30,464,1,0,0,0,32,469,1,0,0,0,34,471,1,0,0,0,
	36,485,1,0,0,0,38,545,1,0,0,0,40,585,1,0,0,0,42,589,1,0,0,0,44,609,1,0,
	0,0,46,633,1,0,0,0,48,641,1,0,0,0,50,660,1,0,0,0,52,664,1,0,0,0,54,677,
	1,0,0,0,56,682,1,0,0,0,58,698,1,0,0,0,60,703,1,0,0,0,62,709,1,0,0,0,64,
	716,1,0,0,0,66,739,1,0,0,0,68,766,1,0,0,0,70,768,1,0,0,0,72,782,1,0,0,0,
	74,847,1,0,0,0,76,851,1,0,0,0,78,853,1,0,0,0,80,891,1,0,0,0,82,903,1,0,
	0,0,84,917,1,0,0,0,86,933,1,0,0,0,88,935,1,0,0,0,90,938,1,0,0,0,92,965,
	1,0,0,0,94,983,1,0,0,0,96,985,1,0,0,0,98,998,1,0,0,0,100,1004,1,0,0,0,102,
	1039,1,0,0,0,104,1041,1,0,0,0,106,1087,1,0,0,0,108,1098,1,0,0,0,110,1132,
	1,0,0,0,112,1134,1,0,0,0,114,1144,1,0,0,0,116,1193,1,0,0,0,118,1240,1,0,
	0,0,120,1242,1,0,0,0,122,1251,1,0,0,0,124,1290,1,0,0,0,126,1410,1,0,0,0,
	128,1415,1,0,0,0,130,1417,1,0,0,0,132,1463,1,0,0,0,134,1513,1,0,0,0,136,
	1526,1,0,0,0,138,1539,1,0,0,0,140,1557,1,0,0,0,142,1571,1,0,0,0,144,1573,
	1,0,0,0,146,1580,1,0,0,0,148,1589,1,0,0,0,150,1649,1,0,0,0,152,1651,1,0,
	0,0,154,1663,1,0,0,0,156,1673,1,0,0,0,158,1688,1,0,0,0,160,1690,1,0,0,0,
	162,1706,1,0,0,0,164,1717,1,0,0,0,166,1728,1,0,0,0,168,1738,1,0,0,0,170,
	1752,1,0,0,0,172,1762,1,0,0,0,174,1764,1,0,0,0,176,1772,1,0,0,0,178,1778,
	1,0,0,0,180,1782,1,0,0,0,182,1785,1,0,0,0,184,1807,1,0,0,0,186,1809,1,0,
	0,0,188,1822,1,0,0,0,190,1833,1,0,0,0,192,1837,1,0,0,0,194,1850,1,0,0,0,
	196,1854,1,0,0,0,198,1857,1,0,0,0,200,1863,1,0,0,0,202,1893,1,0,0,0,204,
	1895,1,0,0,0,206,1909,1,0,0,0,208,1911,1,0,0,0,210,1919,1,0,0,0,212,1921,
	1,0,0,0,214,1931,1,0,0,0,216,1947,1,0,0,0,218,1956,1,0,0,0,220,1964,1,0,
	0,0,222,1975,1,0,0,0,224,1992,1,0,0,0,226,2015,1,0,0,0,228,2018,1,0,0,0,
	230,2024,1,0,0,0,232,2068,1,0,0,0,234,2070,1,0,0,0,236,2078,1,0,0,0,238,
	2080,1,0,0,0,240,2120,1,0,0,0,242,2122,1,0,0,0,244,2126,1,0,0,0,246,2142,
	1,0,0,0,248,2156,1,0,0,0,250,2160,1,0,0,0,252,2176,1,0,0,0,254,2333,1,0,
	0,0,256,2458,1,0,0,0,258,2460,1,0,0,0,260,2476,1,0,0,0,262,2478,1,0,0,0,
	264,2482,1,0,0,0,266,2534,1,0,0,0,268,2536,1,0,0,0,270,272,3,16,8,0,271,
	270,1,0,0,0,272,275,1,0,0,0,273,271,1,0,0,0,273,274,1,0,0,0,274,279,1,0,
	0,0,275,273,1,0,0,0,276,278,3,2,1,0,277,276,1,0,0,0,278,281,1,0,0,0,279,
	277,1,0,0,0,279,280,1,0,0,0,280,294,1,0,0,0,281,279,1,0,0,0,282,293,3,62,
	31,0,283,293,3,56,28,0,284,293,3,52,26,0,285,293,3,60,30,0,286,293,3,8,
	4,0,287,293,3,48,24,0,288,293,3,26,13,0,289,293,3,6,3,0,290,293,3,36,18,
	0,291,293,3,38,19,0,292,282,1,0,0,0,292,283,1,0,0,0,292,284,1,0,0,0,292,
	285,1,0,0,0,292,286,1,0,0,0,292,287,1,0,0,0,292,288,1,0,0,0,292,289,1,0,
	0,0,292,290,1,0,0,0,292,291,1,0,0,0,293,296,1,0,0,0,294,292,1,0,0,0,294,
	295,1,0,0,0,295,297,1,0,0,0,296,294,1,0,0,0,297,298,5,0,0,1,298,1,1,0,0,
	0,299,300,5,1,0,0,300,301,5,151,0,0,301,326,5,2,0,0,302,303,5,1,0,0,303,
	304,5,151,0,0,304,305,5,3,0,0,305,306,5,180,0,0,306,326,5,2,0,0,307,308,
	5,1,0,0,308,309,5,4,0,0,309,314,3,4,2,0,310,311,5,5,0,0,311,313,3,4,2,0,
	312,310,1,0,0,0,313,316,1,0,0,0,314,312,1,0,0,0,314,315,1,0,0,0,315,318,
	1,0,0,0,316,314,1,0,0,0,317,319,5,5,0,0,318,317,1,0,0,0,318,319,1,0,0,0,
	319,320,1,0,0,0,320,321,5,6,0,0,321,322,5,180,0,0,322,323,5,151,0,0,323,
	324,5,2,0,0,324,326,1,0,0,0,325,299,1,0,0,0,325,302,1,0,0,0,325,307,1,0,
	0,0,326,3,1,0,0,0,327,330,5,180,0,0,328,329,5,3,0,0,329,331,5,180,0,0,330,
	328,1,0,0,0,330,331,1,0,0,0,331,5,1,0,0,0,332,333,5,7,0,0,333,334,3,14,
	7,0,334,338,3,104,52,0,335,337,3,94,47,0,336,335,1,0,0,0,337,340,1,0,0,
	0,338,336,1,0,0,0,338,339,1,0,0,0,339,342,1,0,0,0,340,338,1,0,0,0,341,343,
	3,100,50,0,342,341,1,0,0,0,342,343,1,0,0,0,343,344,1,0,0,0,344,348,5,4,
	0,0,345,347,3,110,55,0,346,345,1,0,0,0,347,350,1,0,0,0,348,346,1,0,0,0,
	348,349,1,0,0,0,349,351,1,0,0,0,350,348,1,0,0,0,351,352,5,6,0,0,352,7,1,
	0,0,0,353,354,5,8,0,0,354,355,5,180,0,0,355,359,5,9,0,0,356,360,3,82,41,
	0,357,360,3,266,133,0,358,360,5,10,0,0,359,356,1,0,0,0,359,357,1,0,0,0,
	359,358,1,0,0,0,360,362,1,0,0,0,361,363,5,11,0,0,362,361,1,0,0,0,362,363,
	1,0,0,0,363,364,1,0,0,0,364,391,5,2,0,0,365,366,5,8,0,0,366,367,5,4,0,0,
	367,372,3,10,5,0,368,369,5,5,0,0,369,371,3,10,5,0,370,368,1,0,0,0,371,374,
	1,0,0,0,372,370,1,0,0,0,372,373,1,0,0,0,373,376,1,0,0,0,374,372,1,0,0,0,
	375,377,5,5,0,0,376,375,1,0,0,0,376,377,1,0,0,0,377,378,1,0,0,0,378,379,
	5,6,0,0,379,383,5,9,0,0,380,384,3,82,41,0,381,384,3,266,133,0,382,384,5,
	10,0,0,383,380,1,0,0,0,383,381,1,0,0,0,383,382,1,0,0,0,384,386,1,0,0,0,
	385,387,5,11,0,0,386,385,1,0,0,0,386,387,1,0,0,0,387,388,1,0,0,0,388,389,
	5,2,0,0,389,391,1,0,0,0,390,353,1,0,0,0,390,365,1,0,0,0,391,9,1,0,0,0,392,
	395,5,180,0,0,393,394,5,12,0,0,394,396,5,180,0,0,395,393,1,0,0,0,395,396,
	1,0,0,0,396,399,1,0,0,0,397,398,5,3,0,0,398,400,3,12,6,0,399,397,1,0,0,
	0,399,400,1,0,0,0,400,11,1,0,0,0,401,402,7,0,0,0,402,13,1,0,0,0,403,404,
	7,1,0,0,404,15,1,0,0,0,405,406,5,37,0,0,406,407,3,18,9,0,407,408,3,20,10,
	0,408,409,5,2,0,0,409,17,1,0,0,0,410,411,7,2,0,0,411,19,1,0,0,0,412,414,
	3,22,11,0,413,415,3,22,11,0,414,413,1,0,0,0,414,415,1,0,0,0,415,21,1,0,
	0,0,416,418,3,24,12,0,417,416,1,0,0,0,417,418,1,0,0,0,418,419,1,0,0,0,419,
	420,5,140,0,0,420,23,1,0,0,0,421,422,7,3,0,0,422,25,1,0,0,0,423,424,5,41,
	0,0,424,434,5,180,0,0,425,426,5,42,0,0,426,431,5,180,0,0,427,428,5,5,0,
	0,428,430,5,180,0,0,429,427,1,0,0,0,430,433,1,0,0,0,431,429,1,0,0,0,431,
	432,1,0,0,0,432,435,1,0,0,0,433,431,1,0,0,0,434,425,1,0,0,0,434,435,1,0,
	0,0,435,436,1,0,0,0,436,447,5,4,0,0,437,446,3,56,28,0,438,446,3,52,26,0,
	439,446,3,60,30,0,440,446,3,44,22,0,441,446,3,48,24,0,442,446,3,30,15,0,
	443,446,3,28,14,0,444,446,3,34,17,0,445,437,1,0,0,0,445,438,1,0,0,0,445,
	439,1,0,0,0,445,440,1,0,0,0,445,441,1,0,0,0,445,442,1,0,0,0,445,443,1,0,
	0,0,445,444,1,0,0,0,446,449,1,0,0,0,447,445,1,0,0,0,447,448,1,0,0,0,448,
	450,1,0,0,0,449,447,1,0,0,0,450,451,5,6,0,0,451,27,1,0,0,0,452,453,3,32,
	16,0,453,454,3,80,40,0,454,455,5,180,0,0,455,456,5,2,0,0,456,463,1,0,0,
	0,457,458,3,32,16,0,458,459,3,82,41,0,459,460,5,180,0,0,460,461,5,2,0,0,
	461,463,1,0,0,0,462,452,1,0,0,0,462,457,1,0,0,0,463,29,1,0,0,0,464,465,
	3,32,16,0,465,466,3,266,133,0,466,467,5,180,0,0,467,468,5,2,0,0,468,31,
	1,0,0,0,469,470,7,4,0,0,470,33,1,0,0,0,471,472,5,7,0,0,472,473,5,180,0,
	0,473,477,3,104,52,0,474,476,3,94,47,0,475,474,1,0,0,0,476,479,1,0,0,0,
	477,475,1,0,0,0,477,478,1,0,0,0,478,481,1,0,0,0,479,477,1,0,0,0,480,482,
	3,100,50,0,481,480,1,0,0,0,481,482,1,0,0,0,482,483,1,0,0,0,483,484,5,2,
	0,0,484,35,1,0,0,0,485,486,5,45,0,0,486,487,5,180,0,0,487,491,5,4,0,0,488,
	490,3,56,28,0,489,488,1,0,0,0,490,493,1,0,0,0,491,489,1,0,0,0,491,492,1,
	0,0,0,492,497,1,0,0,0,493,491,1,0,0,0,494,496,3,52,26,0,495,494,1,0,0,0,
	496,499,1,0,0,0,497,495,1,0,0,0,497,498,1,0,0,0,498,503,1,0,0,0,499,497,
	1,0,0,0,500,502,3,60,30,0,501,500,1,0,0,0,502,505,1,0,0,0,503,501,1,0,0,
	0,503,504,1,0,0,0,504,509,1,0,0,0,505,503,1,0,0,0,506,508,3,44,22,0,507,
	506,1,0,0,0,508,511,1,0,0,0,509,507,1,0,0,0,509,510,1,0,0,0,510,515,1,0,
	0,0,511,509,1,0,0,0,512,514,3,48,24,0,513,512,1,0,0,0,514,517,1,0,0,0,515,
	513,1,0,0,0,515,516,1,0,0,0,516,521,1,0,0,0,517,515,1,0,0,0,518,520,3,62,
	31,0,519,518,1,0,0,0,520,523,1,0,0,0,521,519,1,0,0,0,521,522,1,0,0,0,522,
	527,1,0,0,0,523,521,1,0,0,0,524,526,3,74,37,0,525,524,1,0,0,0,526,529,1,
	0,0,0,527,525,1,0,0,0,527,528,1,0,0,0,528,533,1,0,0,0,529,527,1,0,0,0,530,
	532,3,8,4,0,531,530,1,0,0,0,532,535,1,0,0,0,533,531,1,0,0,0,533,534,1,0,
	0,0,534,539,1,0,0,0,535,533,1,0,0,0,536,538,3,6,3,0,537,536,1,0,0,0,538,
	541,1,0,0,0,539,537,1,0,0,0,539,540,1,0,0,0,540,542,1,0,0,0,541,539,1,0,
	0,0,542,543,5,6,0,0,543,37,1,0,0,0,544,546,5,46,0,0,545,544,1,0,0,0,545,
	546,1,0,0,0,546,547,1,0,0,0,547,548,5,47,0,0,548,550,5,180,0,0,549,551,
	3,104,52,0,550,549,1,0,0,0,550,551,1,0,0,0,551,561,1,0,0,0,552,553,5,42,
	0,0,553,558,3,40,20,0,554,555,5,5,0,0,555,557,3,40,20,0,556,554,1,0,0,0,
	557,560,1,0,0,0,558,556,1,0,0,0,558,559,1,0,0,0,559,562,1,0,0,0,560,558,
	1,0,0,0,561,552,1,0,0,0,561,562,1,0,0,0,562,563,1,0,0,0,563,580,5,4,0,0,
	564,579,3,56,28,0,565,579,3,52,26,0,566,579,3,60,30,0,567,579,3,44,22,0,
	568,579,3,48,24,0,569,579,3,62,31,0,570,579,3,8,4,0,571,579,3,74,37,0,572,
	579,3,84,42,0,573,579,3,64,32,0,574,579,3,90,45,0,575,579,3,42,21,0,576,
	579,3,66,33,0,577,579,3,70,35,0,578,564,1,0,0,0,578,565,1,0,0,0,578,566,
	1,0,0,0,578,567,1,0,0,0,578,568,1,0,0,0,578,569,1,0,0,0,578,570,1,0,0,0,
	578,571,1,0,0,0,578,572,1,0,0,0,578,573,1,0,0,0,578,574,1,0,0,0,578,575,
	1,0,0,0,578,576,1,0,0,0,578,577,1,0,0,0,579,582,1,0,0,0,580,578,1,0,0,0,
	580,581,1,0,0,0,581,583,1,0,0,0,582,580,1,0,0,0,583,584,5,6,0,0,584,39,
	1,0,0,0,585,587,5,180,0,0,586,588,3,244,122,0,587,586,1,0,0,0,587,588,1,
	0,0,0,588,41,1,0,0,0,589,590,5,7,0,0,590,591,3,14,7,0,591,595,3,104,52,
	0,592,594,3,94,47,0,593,592,1,0,0,0,594,597,1,0,0,0,595,593,1,0,0,0,595,
	596,1,0,0,0,596,601,1,0,0,0,597,595,1,0,0,0,598,600,3,92,46,0,599,598,1,
	0,0,0,600,603,1,0,0,0,601,599,1,0,0,0,601,602,1,0,0,0,602,605,1,0,0,0,603,
	601,1,0,0,0,604,606,3,100,50,0,605,604,1,0,0,0,605,606,1,0,0,0,606,607,
	1,0,0,0,607,608,5,2,0,0,608,43,1,0,0,0,609,610,5,48,0,0,610,611,5,180,0,
	0,611,623,5,49,0,0,612,617,3,46,23,0,613,614,5,5,0,0,614,616,3,46,23,0,
	615,613,1,0,0,0,616,619,1,0,0,0,617,615,1,0,0,0,617,618,1,0,0,0,618,621,
	1,0,0,0,619,617,1,0,0,0,620,622,5,5,0,0,621,620,1,0,0,0,621,622,1,0,0,0,
	622,624,1,0,0,0,623,612,1,0,0,0,623,624,1,0,0,0,624,625,1,0,0,0,625,627,
	5,50,0,0,626,628,5,51,0,0,627,626,1,0,0,0,627,628,1,0,0,0,628,629,1,0,0,
	0,629,630,5,2,0,0,630,45,1,0,0,0,631,634,3,266,133,0,632,634,3,82,41,0,
	633,631,1,0,0,0,633,632,1,0,0,0,634,636,1,0,0,0,635,637,5,52,0,0,636,635,
	1,0,0,0,636,637,1,0,0,0,637,639,1,0,0,0,638,640,5,180,0,0,639,638,1,0,0,
	0,639,640,1,0,0,0,640,47,1,0,0,0,641,642,5,35,0,0,642,643,5,180,0,0,643,
	655,5,49,0,0,644,649,3,50,25,0,645,646,5,5,0,0,646,648,3,50,25,0,647,645,
	1,0,0,0,648,651,1,0,0,0,649,647,1,0,0,0,649,650,1,0,0,0,650,653,1,0,0,0,
	651,649,1,0,0,0,652,654,5,5,0,0,653,652,1,0,0,0,653,654,1,0,0,0,654,656,
	1,0,0,0,655,644,1,0,0,0,655,656,1,0,0,0,656,657,1,0,0,0,657,658,5,50,0,
	0,658,659,5,2,0,0,659,49,1,0,0,0,660,662,3,266,133,0,661,663,5,180,0,0,
	662,661,1,0,0,0,662,663,1,0,0,0,663,51,1,0,0,0,664,665,5,53,0,0,665,666,
	5,180,0,0,666,668,5,4,0,0,667,669,3,54,27,0,668,667,1,0,0,0,669,670,1,0,
	0,0,670,668,1,0,0,0,670,671,1,0,0,0,671,672,1,0,0,0,672,673,5,6,0,0,673,
	53,1,0,0,0,674,678,3,266,133,0,675,678,3,82,41,0,676,678,3,80,40,0,677,
	674,1,0,0,0,677,675,1,0,0,0,677,676,1,0,0,0,678,679,1,0,0,0,679,680,3,14,
	7,0,680,681,5,2,0,0,681,55,1,0,0,0,682,683,5,54,0,0,683,684,5,180,0,0,684,
	685,5,4,0,0,685,690,3,58,29,0,686,687,5,5,0,0,687,689,3,58,29,0,688,686,
	1,0,0,0,689,692,1,0,0,0,690,688,1,0,0,0,690,691,1,0,0,0,691,694,1,0,0,0,
	692,690,1,0,0,0,693,695,5,5,0,0,694,693,1,0,0,0,694,695,1,0,0,0,695,696,
	1,0,0,0,696,697,5,6,0,0,697,57,1,0,0,0,698,701,5,180,0,0,699,700,5,40,0,
	0,700,702,5,145,0,0,701,699,1,0,0,0,701,702,1,0,0,0,702,59,1,0,0,0,703,
	704,5,55,0,0,704,705,5,180,0,0,705,706,5,42,0,0,706,707,3,266,133,0,707,
	708,5,2,0,0,708,61,1,0,0,0,709,710,3,266,133,0,710,711,5,56,0,0,711,712,
	5,180,0,0,712,713,5,40,0,0,713,714,3,254,127,0,714,715,5,2,0,0,715,63,1,
	0,0,0,716,717,5,57,0,0,717,721,3,104,52,0,718,720,7,5,0,0,719,718,1,0,0,
	0,720,723,1,0,0,0,721,719,1,0,0,0,721,722,1,0,0,0,722,727,1,0,0,0,723,721,
	1,0,0,0,724,726,3,72,36,0,725,724,1,0,0,0,726,729,1,0,0,0,727,725,1,0,0,
	0,727,728,1,0,0,0,728,730,1,0,0,0,729,727,1,0,0,0,730,734,5,4,0,0,731,733,
	3,110,55,0,732,731,1,0,0,0,733,736,1,0,0,0,734,732,1,0,0,0,734,735,1,0,
	0,0,735,737,1,0,0,0,736,734,1,0,0,0,737,738,5,6,0,0,738,65,1,0,0,0,739,
	740,5,60,0,0,740,741,3,104,52,0,741,745,5,44,0,0,742,744,3,68,34,0,743,
	742,1,0,0,0,744,747,1,0,0,0,745,743,1,0,0,0,745,746,1,0,0,0,746,751,1,0,
	0,0,747,745,1,0,0,0,748,750,3,92,46,0,749,748,1,0,0,0,750,753,1,0,0,0,751,
	749,1,0,0,0,751,752,1,0,0,0,752,754,1,0,0,0,753,751,1,0,0,0,754,758,5,4,
	0,0,755,757,3,110,55,0,756,755,1,0,0,0,757,760,1,0,0,0,758,756,1,0,0,0,
	758,759,1,0,0,0,759,761,1,0,0,0,760,758,1,0,0,0,761,762,5,6,0,0,762,67,
	1,0,0,0,763,767,5,59,0,0,764,767,5,61,0,0,765,767,3,96,48,0,766,763,1,0,
	0,0,766,764,1,0,0,0,766,765,1,0,0,0,767,69,1,0,0,0,768,769,5,62,0,0,769,
	770,5,49,0,0,770,771,5,50,0,0,771,772,5,44,0,0,772,773,5,59,0,0,773,777,
	5,4,0,0,774,776,3,110,55,0,775,774,1,0,0,0,776,779,1,0,0,0,777,775,1,0,
	0,0,777,778,1,0,0,0,778,780,1,0,0,0,779,777,1,0,0,0,780,781,5,6,0,0,781,
	71,1,0,0,0,782,783,5,180,0,0,783,784,3,244,122,0,784,73,1,0,0,0,785,787,
	3,78,39,0,786,785,1,0,0,0,786,787,1,0,0,0,787,788,1,0,0,0,788,792,3,266,
	133,0,789,791,3,258,129,0,790,789,1,0,0,0,791,794,1,0,0,0,792,790,1,0,0,
	0,792,793,1,0,0,0,793,795,1,0,0,0,794,792,1,0,0,0,795,798,5,180,0,0,796,
	797,5,40,0,0,797,799,3,254,127,0,798,796,1,0,0,0,798,799,1,0,0,0,799,800,
	1,0,0,0,800,801,5,2,0,0,801,848,1,0,0,0,802,803,3,266,133,0,803,807,3,78,
	39,0,804,806,3,258,129,0,805,804,1,0,0,0,806,809,1,0,0,0,807,805,1,0,0,
	0,807,808,1,0,0,0,808,810,1,0,0,0,809,807,1,0,0,0,810,813,5,180,0,0,811,
	812,5,40,0,0,812,814,3,254,127,0,813,811,1,0,0,0,813,814,1,0,0,0,814,815,
	1,0,0,0,815,816,5,2,0,0,816,848,1,0,0,0,817,819,3,78,39,0,818,817,1,0,0,
	0,818,819,1,0,0,0,819,820,1,0,0,0,820,824,3,80,40,0,821,823,3,76,38,0,822,
	821,1,0,0,0,823,826,1,0,0,0,824,822,1,0,0,0,824,825,1,0,0,0,825,827,1,0,
	0,0,826,824,1,0,0,0,827,828,5,180,0,0,828,829,5,2,0,0,829,848,1,0,0,0,830,
	832,3,78,39,0,831,830,1,0,0,0,831,832,1,0,0,0,832,833,1,0,0,0,833,837,3,
	82,41,0,834,836,3,76,38,0,835,834,1,0,0,0,836,839,1,0,0,0,837,835,1,0,0,
	0,837,838,1,0,0,0,838,840,1,0,0,0,839,837,1,0,0,0,840,843,5,180,0,0,841,
	842,5,40,0,0,842,844,3,254,127,0,843,841,1,0,0,0,843,844,1,0,0,0,844,845,
	1,0,0,0,845,846,5,2,0,0,846,848,1,0,0,0,847,786,1,0,0,0,847,802,1,0,0,0,
	847,818,1,0,0,0,847,831,1,0,0,0,848,75,1,0,0,0,849,852,3,258,129,0,850,
	852,3,78,39,0,851,849,1,0,0,0,851,850,1,0,0,0,852,77,1,0,0,0,853,854,7,
	6,0,0,854,79,1,0,0,0,855,856,5,64,0,0,856,857,5,49,0,0,857,859,3,266,133,
	0,858,860,5,180,0,0,859,858,1,0,0,0,859,860,1,0,0,0,860,861,1,0,0,0,861,
	862,5,65,0,0,862,864,3,266,133,0,863,865,5,180,0,0,864,863,1,0,0,0,864,
	865,1,0,0,0,865,866,1,0,0,0,866,867,5,50,0,0,867,892,1,0,0,0,868,869,5,
	64,0,0,869,870,5,49,0,0,870,872,3,266,133,0,871,873,5,180,0,0,872,871,1,
	0,0,0,872,873,1,0,0,0,873,874,1,0,0,0,874,875,5,65,0,0,875,876,3,80,40,
	0,876,877,5,50,0,0,877,892,1,0,0,0,878,879,5,64,0,0,879,880,5,49,0,0,880,
	882,3,266,133,0,881,883,5,180,0,0,882,881,1,0,0,0,882,883,1,0,0,0,883,884,
	1,0,0,0,884,885,5,65,0,0,885,887,3,82,41,0,886,888,5,180,0,0,887,886,1,
	0,0,0,887,888,1,0,0,0,888,889,1,0,0,0,889,890,5,50,0,0,890,892,1,0,0,0,
	891,855,1,0,0,0,891,868,1,0,0,0,891,878,1,0,0,0,892,81,1,0,0,0,893,894,
	6,41,-1,0,894,895,3,266,133,0,895,896,5,66,0,0,896,897,7,7,0,0,897,898,
	5,67,0,0,898,904,1,0,0,0,899,900,3,266,133,0,900,901,5,66,0,0,901,902,5,
	67,0,0,902,904,1,0,0,0,903,893,1,0,0,0,903,899,1,0,0,0,904,914,1,0,0,0,
	905,906,10,2,0,0,906,907,5,66,0,0,907,908,7,7,0,0,908,913,5,67,0,0,909,
	910,10,1,0,0,910,911,5,66,0,0,911,913,5,67,0,0,912,905,1,0,0,0,912,909,
	1,0,0,0,913,916,1,0,0,0,914,912,1,0,0,0,914,915,1,0,0,0,915,83,1,0,0,0,
	916,914,1,0,0,0,917,918,5,68,0,0,918,920,5,180,0,0,919,921,3,104,52,0,920,
	919,1,0,0,0,920,921,1,0,0,0,921,922,1,0,0,0,922,926,5,4,0,0,923,925,3,86,
	43,0,924,923,1,0,0,0,925,928,1,0,0,0,926,924,1,0,0,0,926,927,1,0,0,0,927,
	929,1,0,0,0,928,926,1,0,0,0,929,930,5,6,0,0,930,85,1,0,0,0,931,934,3,88,
	44,0,932,934,3,110,55,0,933,931,1,0,0,0,933,932,1,0,0,0,934,87,1,0,0,0,
	935,936,5,69,0,0,936,937,5,2,0,0,937,89,1,0,0,0,938,939,5,7,0,0,939,940,
	3,14,7,0,940,944,3,104,52,0,941,943,3,94,47,0,942,941,1,0,0,0,943,946,1,
	0,0,0,944,942,1,0,0,0,944,945,1,0,0,0,945,950,1,0,0,0,946,944,1,0,0,0,947,
	949,3,92,46,0,948,947,1,0,0,0,949,952,1,0,0,0,950,948,1,0,0,0,950,951,1,
	0,0,0,951,954,1,0,0,0,952,950,1,0,0,0,953,955,3,100,50,0,954,953,1,0,0,
	0,954,955,1,0,0,0,955,956,1,0,0,0,956,960,5,4,0,0,957,959,3,110,55,0,958,
	957,1,0,0,0,959,962,1,0,0,0,960,958,1,0,0,0,960,961,1,0,0,0,961,963,1,0,
	0,0,962,960,1,0,0,0,963,964,5,6,0,0,964,91,1,0,0,0,965,967,5,180,0,0,966,
	968,3,244,122,0,967,966,1,0,0,0,967,968,1,0,0,0,968,93,1,0,0,0,969,984,
	5,70,0,0,970,984,5,71,0,0,971,984,5,58,0,0,972,984,5,44,0,0,973,984,5,43,
	0,0,974,984,5,63,0,0,975,984,5,59,0,0,976,984,3,96,48,0,977,984,5,61,0,
	0,978,984,3,98,49,0,979,984,5,30,0,0,980,984,5,28,0,0,981,984,5,31,0,0,
	982,984,5,29,0,0,983,969,1,0,0,0,983,970,1,0,0,0,983,971,1,0,0,0,983,972,
	1,0,0,0,983,973,1,0,0,0,983,974,1,0,0,0,983,975,1,0,0,0,983,976,1,0,0,0,
	983,977,1,0,0,0,983,978,1,0,0,0,983,979,1,0,0,0,983,980,1,0,0,0,983,981,
	1,0,0,0,983,982,1,0,0,0,984,95,1,0,0,0,985,996,5,72,0,0,986,987,5,49,0,
	0,987,992,5,180,0,0,988,989,5,5,0,0,989,991,5,180,0,0,990,988,1,0,0,0,991,
	994,1,0,0,0,992,990,1,0,0,0,992,993,1,0,0,0,993,995,1,0,0,0,994,992,1,0,
	0,0,995,997,5,50,0,0,996,986,1,0,0,0,996,997,1,0,0,0,997,97,1,0,0,0,998,
	1002,5,32,0,0,999,1000,5,49,0,0,1000,1001,5,145,0,0,1001,1003,5,50,0,0,
	1002,999,1,0,0,0,1002,1003,1,0,0,0,1003,99,1,0,0,0,1004,1005,5,73,0,0,1005,
	1006,5,49,0,0,1006,1011,3,102,51,0,1007,1008,5,5,0,0,1008,1010,3,102,51,
	0,1009,1007,1,0,0,0,1010,1013,1,0,0,0,1011,1009,1,0,0,0,1011,1012,1,0,0,
	0,1012,1015,1,0,0,0,1013,1011,1,0,0,0,1014,1016,5,5,0,0,1015,1014,1,0,0,
	0,1015,1016,1,0,0,0,1016,1017,1,0,0,0,1017,1018,5,50,0,0,1018,101,1,0,0,
	0,1019,1023,3,266,133,0,1020,1022,3,258,129,0,1021,1020,1,0,0,0,1022,1025,
	1,0,0,0,1023,1021,1,0,0,0,1023,1024,1,0,0,0,1024,1027,1,0,0,0,1025,1023,
	1,0,0,0,1026,1028,3,14,7,0,1027,1026,1,0,0,0,1027,1028,1,0,0,0,1028,1040,
	1,0,0,0,1029,1033,3,82,41,0,1030,1032,3,258,129,0,1031,1030,1,0,0,0,1032,
	1035,1,0,0,0,1033,1031,1,0,0,0,1033,1034,1,0,0,0,1034,1037,1,0,0,0,1035,
	1033,1,0,0,0,1036,1038,3,14,7,0,1037,1036,1,0,0,0,1037,1038,1,0,0,0,1038,
	1040,1,0,0,0,1039,1019,1,0,0,0,1039,1029,1,0,0,0,1040,103,1,0,0,0,1041,
	1053,5,49,0,0,1042,1047,3,106,53,0,1043,1044,5,5,0,0,1044,1046,3,106,53,
	0,1045,1043,1,0,0,0,1046,1049,1,0,0,0,1047,1045,1,0,0,0,1047,1048,1,0,0,
	0,1048,1051,1,0,0,0,1049,1047,1,0,0,0,1050,1052,5,5,0,0,1051,1050,1,0,0,
	0,1051,1052,1,0,0,0,1052,1054,1,0,0,0,1053,1042,1,0,0,0,1053,1054,1,0,0,
	0,1054,1055,1,0,0,0,1055,1056,5,50,0,0,1056,105,1,0,0,0,1057,1061,3,266,
	133,0,1058,1060,3,258,129,0,1059,1058,1,0,0,0,1060,1063,1,0,0,0,1061,1059,
	1,0,0,0,1061,1062,1,0,0,0,1062,1065,1,0,0,0,1063,1061,1,0,0,0,1064,1066,
	3,14,7,0,1065,1064,1,0,0,0,1065,1066,1,0,0,0,1066,1088,1,0,0,0,1067,1071,
	3,82,41,0,1068,1070,3,258,129,0,1069,1068,1,0,0,0,1070,1073,1,0,0,0,1071,
	1069,1,0,0,0,1071,1072,1,0,0,0,1072,1075,1,0,0,0,1073,1071,1,0,0,0,1074,
	1076,3,14,7,0,1075,1074,1,0,0,0,1075,1076,1,0,0,0,1076,1088,1,0,0,0,1077,
	1081,3,80,40,0,1078,1080,3,258,129,0,1079,1078,1,0,0,0,1080,1083,1,0,0,
	0,1081,1079,1,0,0,0,1081,1082,1,0,0,0,1082,1085,1,0,0,0,1083,1081,1,0,0,
	0,1084,1086,3,14,7,0,1085,1084,1,0,0,0,1085,1086,1,0,0,0,1086,1088,1,0,
	0,0,1087,1057,1,0,0,0,1087,1067,1,0,0,0,1087,1077,1,0,0,0,1088,107,1,0,
	0,0,1089,1093,5,4,0,0,1090,1092,3,110,55,0,1091,1090,1,0,0,0,1092,1095,
	1,0,0,0,1093,1091,1,0,0,0,1093,1094,1,0,0,0,1094,1096,1,0,0,0,1095,1093,
	1,0,0,0,1096,1099,5,6,0,0,1097,1099,3,110,55,0,1098,1089,1,0,0,0,1098,1097,
	1,0,0,0,1099,109,1,0,0,0,1100,1133,3,88,44,0,1101,1133,3,132,66,0,1102,
	1133,3,134,67,0,1103,1133,3,140,70,0,1104,1133,3,142,71,0,1105,1133,3,144,
	72,0,1106,1133,3,146,73,0,1107,1133,3,148,74,0,1108,1133,3,138,69,0,1109,
	1133,3,126,63,0,1110,1133,3,130,65,0,1111,1133,3,152,76,0,1112,1133,3,154,
	77,0,1113,1133,3,156,78,0,1114,1133,3,158,79,0,1115,1133,3,178,89,0,1116,
	1133,3,124,62,0,1117,1133,3,112,56,0,1118,1133,3,114,57,0,1119,1133,3,116,
	58,0,1120,1133,3,118,59,0,1121,1133,3,120,60,0,1122,1133,3,122,61,0,1123,
	1133,3,180,90,0,1124,1133,3,220,110,0,1125,1133,3,232,116,0,1126,1133,3,
	234,117,0,1127,1133,3,150,75,0,1128,1133,3,212,106,0,1129,1133,3,214,107,
	0,1130,1133,3,226,113,0,1131,1133,3,228,114,0,1132,1100,1,0,0,0,1132,1101,
	1,0,0,0,1132,1102,1,0,0,0,1132,1103,1,0,0,0,1132,1104,1,0,0,0,1132,1105,
	1,0,0,0,1132,1106,1,0,0,0,1132,1107,1,0,0,0,1132,1108,1,0,0,0,1132,1109,
	1,0,0,0,1132,1110,1,0,0,0,1132,1111,1,0,0,0,1132,1112,1,0,0,0,1132,1113,
	1,0,0,0,1132,1114,1,0,0,0,1132,1115,1,0,0,0,1132,1116,1,0,0,0,1132,1117,
	1,0,0,0,1132,1118,1,0,0,0,1132,1119,1,0,0,0,1132,1120,1,0,0,0,1132,1121,
	1,0,0,0,1132,1122,1,0,0,0,1132,1123,1,0,0,0,1132,1124,1,0,0,0,1132,1125,
	1,0,0,0,1132,1126,1,0,0,0,1132,1127,1,0,0,0,1132,1128,1,0,0,0,1132,1129,
	1,0,0,0,1132,1130,1,0,0,0,1132,1131,1,0,0,0,1133,111,1,0,0,0,1134,1135,
	5,74,0,0,1135,1136,5,12,0,0,1136,1137,5,180,0,0,1137,1138,5,49,0,0,1138,
	1139,3,254,127,0,1139,1140,5,5,0,0,1140,1141,3,254,127,0,1141,1142,5,50,
	0,0,1142,1143,5,2,0,0,1143,113,1,0,0,0,1144,1145,5,74,0,0,1145,1146,5,12,
	0,0,1146,1147,5,180,0,0,1147,1148,5,66,0,0,1148,1149,3,254,127,0,1149,1150,
	5,67,0,0,1150,1151,5,12,0,0,1151,1152,5,180,0,0,1152,1153,5,49,0,0,1153,
	1158,3,254,127,0,1154,1155,5,5,0,0,1155,1157,3,254,127,0,1156,1154,1,0,
	0,0,1157,1160,1,0,0,0,1158,1156,1,0,0,0,1158,1159,1,0,0,0,1159,1161,1,0,
	0,0,1160,1158,1,0,0,0,1161,1162,5,50,0,0,1162,1163,5,2,0,0,1163,115,1,0,
	0,0,1164,1165,5,75,0,0,1165,1194,5,2,0,0,1166,1167,5,75,0,0,1167,1172,3,
	254,127,0,1168,1169,5,5,0,0,1169,1171,3,254,127,0,1170,1168,1,0,0,0,1171,
	1174,1,0,0,0,1172,1170,1,0,0,0,1172,1173,1,0,0,0,1173,1175,1,0,0,0,1174,
	1172,1,0,0,0,1175,1176,5,2,0,0,1176,1194,1,0,0,0,1177,1178,5,75,0,0,1178,
	1179,5,49,0,0,1179,1184,3,254,127,0,1180,1181,5,5,0,0,1181,1183,3,254,127,
	0,1182,1180,1,0,0,0,1183,1186,1,0,0,0,1184,1182,1,0,0,0,1184,1185,1,0,0,
	0,1185,1188,1,0,0,0,1186,1184,1,0,0,0,1187,1189,5,5,0,0,1188,1187,1,0,0,
	0,1188,1189,1,0,0,0,1189,1190,1,0,0,0,1190,1191,5,50,0,0,1191,1192,5,2,
	0,0,1192,1194,1,0,0,0,1193,1164,1,0,0,0,1193,1166,1,0,0,0,1193,1177,1,0,
	0,0,1194,117,1,0,0,0,1195,1198,5,180,0,0,1196,1197,5,12,0,0,1197,1199,5,
	180,0,0,1198,1196,1,0,0,0,1198,1199,1,0,0,0,1199,1200,1,0,0,0,1200,1201,
	5,49,0,0,1201,1213,5,4,0,0,1202,1207,3,242,121,0,1203,1204,5,5,0,0,1204,
	1206,3,242,121,0,1205,1203,1,0,0,0,1206,1209,1,0,0,0,1207,1205,1,0,0,0,
	1207,1208,1,0,0,0,1208,1211,1,0,0,0,1209,1207,1,0,0,0,1210,1212,5,5,0,0,
	1211,1210,1,0,0,0,1211,1212,1,0,0,0,1212,1214,1,0,0,0,1213,1202,1,0,0,0,
	1213,1214,1,0,0,0,1214,1215,1,0,0,0,1215,1216,5,6,0,0,1216,1217,5,50,0,
	0,1217,1241,5,2,0,0,1218,1219,5,180,0,0,1219,1220,3,244,122,0,1220,1221,
	5,2,0,0,1221,1241,1,0,0,0,1222,1223,5,180,0,0,1223,1224,5,12,0,0,1224,1225,
	5,180,0,0,1225,1226,3,244,122,0,1226,1227,5,2,0,0,1227,1241,1,0,0,0,1228,
	1229,5,180,0,0,1229,1230,3,244,122,0,1230,1231,5,12,0,0,1231,1232,5,180,
	0,0,1232,1233,5,12,0,0,1233,1235,5,180,0,0,1234,1236,3,246,123,0,1235,1234,
	1,0,0,0,1235,1236,1,0,0,0,1236,1237,1,0,0,0,1237,1238,3,244,122,0,1238,
	1239,5,2,0,0,1239,1241,1,0,0,0,1240,1195,1,0,0,0,1240,1218,1,0,0,0,1240,
	1222,1,0,0,0,1240,1228,1,0,0,0,1241,119,1,0,0,0,1242,1243,3,254,127,0,1243,
	1244,5,12,0,0,1244,1246,5,180,0,0,1245,1247,3,246,123,0,1246,1245,1,0,0,
	0,1246,1247,1,0,0,0,1247,1248,1,0,0,0,1248,1249,3,244,122,0,1249,1250,5,
	2,0,0,1250,121,1,0,0,0,1251,1252,5,31,0,0,1252,1253,5,49,0,0,1253,1254,
	3,254,127,0,1254,1255,5,50,0,0,1255,1256,5,2,0,0,1256,123,1,0,0,0,1257,
	1258,5,76,0,0,1258,1261,5,180,0,0,1259,1260,5,12,0,0,1260,1262,5,180,0,
	0,1261,1259,1,0,0,0,1261,1262,1,0,0,0,1262,1263,1,0,0,0,1263,1264,5,49,
	0,0,1264,1276,5,4,0,0,1265,1270,3,242,121,0,1266,1267,5,5,0,0,1267,1269,
	3,242,121,0,1268,1266,1,0,0,0,1269,1272,1,0,0,0,1270,1268,1,0,0,0,1270,
	1271,1,0,0,0,1271,1274,1,0,0,0,1272,1270,1,0,0,0,1273,1275,5,5,0,0,1274,
	1273,1,0,0,0,1274,1275,1,0,0,0,1275,1277,1,0,0,0,1276,1265,1,0,0,0,1276,
	1277,1,0,0,0,1277,1278,1,0,0,0,1278,1279,5,6,0,0,1279,1280,5,50,0,0,1280,
	1291,5,2,0,0,1281,1282,5,76,0,0,1282,1285,5,180,0,0,1283,1284,5,12,0,0,
	1284,1286,5,180,0,0,1285,1283,1,0,0,0,1285,1286,1,0,0,0,1286,1287,1,0,0,
	0,1287,1288,3,244,122,0,1288,1289,5,2,0,0,1289,1291,1,0,0,0,1290,1257,1,
	0,0,0,1290,1281,1,0,0,0,1291,125,1,0,0,0,1292,1293,5,74,0,0,1293,1294,5,
	12,0,0,1294,1303,5,180,0,0,1295,1296,5,66,0,0,1296,1297,3,254,127,0,1297,
	1298,5,67,0,0,1298,1300,1,0,0,0,1299,1295,1,0,0,0,1300,1301,1,0,0,0,1301,
	1299,1,0,0,0,1301,1302,1,0,0,0,1302,1304,1,0,0,0,1303,1299,1,0,0,0,1303,
	1304,1,0,0,0,1304,1308,1,0,0,0,1305,1307,3,128,64,0,1306,1305,1,0,0,0,1307,
	1310,1,0,0,0,1308,1306,1,0,0,0,1308,1309,1,0,0,0,1309,1311,1,0,0,0,1310,
	1308,1,0,0,0,1311,1312,7,8,0,0,1312,1313,3,254,127,0,1313,1314,5,2,0,0,
	1314,1411,1,0,0,0,1315,1320,5,180,0,0,1316,1317,5,66,0,0,1317,1318,3,254,
	127,0,1318,1319,5,67,0,0,1319,1321,1,0,0,0,1320,1316,1,0,0,0,1321,1322,
	1,0,0,0,1322,1320,1,0,0,0,1322,1323,1,0,0,0,1323,1327,1,0,0,0,1324,1326,
	3,128,64,0,1325,1324,1,0,0,0,1326,1329,1,0,0,0,1327,1325,1,0,0,0,1327,1328,
	1,0,0,0,1328,1330,1,0,0,0,1329,1327,1,0,0,0,1330,1331,7,8,0,0,1331,1332,
	3,254,127,0,1332,1333,5,2,0,0,1333,1411,1,0,0,0,1334,1336,5,180,0,0,1335,
	1337,3,128,64,0,1336,1335,1,0,0,0,1337,1338,1,0,0,0,1338,1336,1,0,0,0,1338,
	1339,1,0,0,0,1339,1340,1,0,0,0,1340,1341,7,8,0,0,1341,1342,3,254,127,0,
	1342,1343,5,2,0,0,1343,1411,1,0,0,0,1344,1346,5,180,0,0,1345,1347,3,128,
	64,0,1346,1345,1,0,0,0,1347,1348,1,0,0,0,1348,1346,1,0,0,0,1348,1349,1,
	0,0,0,1349,1354,1,0,0,0,1350,1351,5,66,0,0,1351,1352,3,254,127,0,1352,1353,
	5,67,0,0,1353,1355,1,0,0,0,1354,1350,1,0,0,0,1355,1356,1,0,0,0,1356,1354,
	1,0,0,0,1356,1357,1,0,0,0,1357,1358,1,0,0,0,1358,1359,7,8,0,0,1359,1360,
	3,254,127,0,1360,1361,5,2,0,0,1361,1411,1,0,0,0,1362,1363,5,74,0,0,1363,
	1364,5,12,0,0,1364,1373,5,180,0,0,1365,1366,5,66,0,0,1366,1367,3,254,127,
	0,1367,1368,5,67,0,0,1368,1370,1,0,0,0,1369,1365,1,0,0,0,1370,1371,1,0,
	0,0,1371,1369,1,0,0,0,1371,1372,1,0,0,0,1372,1374,1,0,0,0,1373,1369,1,0,
	0,0,1373,1374,1,0,0,0,1374,1378,1,0,0,0,1375,1377,3,128,64,0,1376,1375,
	1,0,0,0,1377,1380,1,0,0,0,1378,1376,1,0,0,0,1378,1379,1,0,0,0,1379,1381,
	1,0,0,0,1380,1378,1,0,0,0,1381,1382,7,9,0,0,1382,1411,5,2,0,0,1383,1388,
	5,180,0,0,1384,1385,5,66,0,0,1385,1386,3,254,127,0,1386,1387,5,67,0,0,1387,
	1389,1,0,0,0,1388,1384,1,0,0,0,1389,1390,1,0,0,0,1390,1388,1,0,0,0,1390,
	1391,1,0,0,0,1391,1395,1,0,0,0,1392,1394,3,128,64,0,1393,1392,1,0,0,0,1394,
	1397,1,0,0,0,1395,1393,1,0,0,0,1395,1396,1,0,0,0,1396,1398,1,0,0,0,1397,
	1395,1,0,0,0,1398,1399,7,9,0,0,1399,1400,5,2,0,0,1400,1411,1,0,0,0,1401,
	1403,5,180,0,0,1402,1404,3,128,64,0,1403,1402,1,0,0,0,1404,1405,1,0,0,0,
	1405,1403,1,0,0,0,1405,1406,1,0,0,0,1406,1407,1,0,0,0,1407,1408,7,9,0,0,
	1408,1409,5,2,0,0,1409,1411,1,0,0,0,1410,1292,1,0,0,0,1410,1315,1,0,0,0,
	1410,1334,1,0,0,0,1410,1344,1,0,0,0,1410,1362,1,0,0,0,1410,1383,1,0,0,0,
	1410,1401,1,0,0,0,1411,127,1,0,0,0,1412,1413,5,12,0,0,1413,1416,5,180,0,
	0,1414,1416,5,163,0,0,1415,1412,1,0,0,0,1415,1414,1,0,0,0,1416,129,1,0,
	0,0,1417,1418,5,74,0,0,1418,1419,5,12,0,0,1419,1426,5,180,0,0,1420,1421,
	5,66,0,0,1421,1422,3,254,127,0,1422,1423,5,67,0,0,1423,1425,1,0,0,0,1424,
	1420,1,0,0,0,1425,1428,1,0,0,0,1426,1424,1,0,0,0,1426,1427,1,0,0,0,1427,
	1429,1,0,0,0,1428,1426,1,0,0,0,1429,1430,5,169,0,0,1430,1431,5,49,0,0,1431,
	1432,3,254,127,0,1432,1433,5,50,0,0,1433,1434,5,2,0,0,1434,131,1,0,0,0,
	1435,1439,3,266,133,0,1436,1438,3,258,129,0,1437,1436,1,0,0,0,1438,1441,
	1,0,0,0,1439,1437,1,0,0,0,1439,1440,1,0,0,0,1440,1442,1,0,0,0,1441,1439,
	1,0,0,0,1442,1445,3,14,7,0,1443,1444,5,40,0,0,1444,1446,3,254,127,0,1445,
	1443,1,0,0,0,1445,1446,1,0,0,0,1446,1447,1,0,0,0,1447,1448,5,2,0,0,1448,
	1464,1,0,0,0,1449,1453,3,82,41,0,1450,1452,3,258,129,0,1451,1450,1,0,0,
	0,1452,1455,1,0,0,0,1453,1451,1,0,0,0,1453,1454,1,0,0,0,1454,1456,1,0,0,
	0,1455,1453,1,0,0,0,1456,1459,3,14,7,0,1457,1458,5,40,0,0,1458,1460,3,254,
	127,0,1459,1457,1,0,0,0,1459,1460,1,0,0,0,1460,1461,1,0,0,0,1461,1462,5,
	2,0,0,1462,1464,1,0,0,0,1463,1435,1,0,0,0,1463,1449,1,0,0,0,1464,133,1,
	0,0,0,1465,1466,3,266,133,0,1466,1471,5,180,0,0,1467,1468,5,5,0,0,1468,
	1469,3,266,133,0,1469,1470,5,180,0,0,1470,1472,1,0,0,0,1471,1467,1,0,0,
	0,1472,1473,1,0,0,0,1473,1471,1,0,0,0,1473,1474,1,0,0,0,1474,1475,1,0,0,
	0,1475,1476,5,40,0,0,1476,1477,3,254,127,0,1477,1478,5,2,0,0,1478,1514,
	1,0,0,0,1479,1480,5,49,0,0,1480,1483,3,136,68,0,1481,1482,5,5,0,0,1482,
	1484,3,136,68,0,1483,1481,1,0,0,0,1484,1485,1,0,0,0,1485,1483,1,0,0,0,1485,
	1486,1,0,0,0,1486,1487,1,0,0,0,1487,1488,5,50,0,0,1488,1489,5,40,0,0,1489,
	1490,5,49,0,0,1490,1493,3,254,127,0,1491,1492,5,5,0,0,1492,1494,3,254,127,
	0,1493,1491,1,0,0,0,1494,1495,1,0,0,0,1495,1493,1,0,0,0,1495,1496,1,0,0,
	0,1496,1497,1,0,0,0,1497,1498,5,50,0,0,1498,1499,5,2,0,0,1499,1514,1,0,
	0,0,1500,1501,5,49,0,0,1501,1504,3,136,68,0,1502,1503,5,5,0,0,1503,1505,
	3,136,68,0,1504,1502,1,0,0,0,1505,1506,1,0,0,0,1506,1504,1,0,0,0,1506,1507,
	1,0,0,0,1507,1508,1,0,0,0,1508,1509,5,50,0,0,1509,1510,5,40,0,0,1510,1511,
	3,254,127,0,1511,1512,5,2,0,0,1512,1514,1,0,0,0,1513,1465,1,0,0,0,1513,
	1479,1,0,0,0,1513,1500,1,0,0,0,1514,135,1,0,0,0,1515,1519,3,266,133,0,1516,
	1518,3,258,129,0,1517,1516,1,0,0,0,1518,1521,1,0,0,0,1519,1517,1,0,0,0,
	1519,1520,1,0,0,0,1520,1522,1,0,0,0,1521,1519,1,0,0,0,1522,1523,3,14,7,
	0,1523,1527,1,0,0,0,1524,1527,3,14,7,0,1525,1527,1,0,0,0,1526,1515,1,0,
	0,0,1526,1524,1,0,0,0,1526,1525,1,0,0,0,1527,137,1,0,0,0,1528,1529,5,180,
	0,0,1529,1530,7,8,0,0,1530,1531,3,254,127,0,1531,1532,5,2,0,0,1532,1540,
	1,0,0,0,1533,1534,5,180,0,0,1534,1535,7,9,0,0,1535,1540,5,2,0,0,1536,1537,
	7,9,0,0,1537,1538,5,180,0,0,1538,1540,5,2,0,0,1539,1528,1,0,0,0,1539,1533,
	1,0,0,0,1539,1536,1,0,0,0,1540,139,1,0,0,0,1541,1542,5,180,0,0,1542,1543,
	5,165,0,0,1543,1544,5,49,0,0,1544,1545,3,254,127,0,1545,1546,5,50,0,0,1546,
	1547,5,2,0,0,1547,1558,1,0,0,0,1548,1549,5,180,0,0,1549,1550,5,12,0,0,1550,
	1551,5,180,0,0,1551,1552,5,165,0,0,1552,1553,5,49,0,0,1553,1554,3,254,127,
	0,1554,1555,5,50,0,0,1555,1556,5,2,0,0,1556,1558,1,0,0,0,1557,1541,1,0,
	0,0,1557,1548,1,0,0,0,1558,141,1,0,0,0,1559,1560,5,180,0,0,1560,1561,5,
	166,0,0,1561,1562,5,49,0,0,1562,1563,5,50,0,0,1563,1572,5,2,0,0,1564,1565,
	5,180,0,0,1565,1566,5,12,0,0,1566,1567,5,180,0,0,1567,1568,5,166,0,0,1568,
	1569,5,49,0,0,1569,1570,5,50,0,0,1570,1572,5,2,0,0,1571,1559,1,0,0,0,1571,
	1564,1,0,0,0,1572,143,1,0,0,0,1573,1574,5,180,0,0,1574,1575,5,169,0,0,1575,
	1576,5,49,0,0,1576,1577,3,254,127,0,1577,1578,5,50,0,0,1578,1579,5,2,0,
	0,1579,145,1,0,0,0,1580,1581,5,74,0,0,1581,1582,5,12,0,0,1582,1583,5,180,
	0,0,1583,1584,5,165,0,0,1584,1585,5,49,0,0,1585,1586,3,254,127,0,1586,1587,
	5,50,0,0,1587,1588,5,2,0,0,1588,147,1,0,0,0,1589,1590,5,74,0,0,1590,1591,
	5,12,0,0,1591,1592,5,180,0,0,1592,1593,5,166,0,0,1593,1594,5,49,0,0,1594,
	1595,5,50,0,0,1595,1596,5,2,0,0,1596,149,1,0,0,0,1597,1598,5,89,0,0,1598,
	1599,5,180,0,0,1599,1650,5,2,0,0,1600,1601,5,89,0,0,1601,1602,5,74,0,0,
	1602,1603,5,12,0,0,1603,1604,5,180,0,0,1604,1650,5,2,0,0,1605,1606,5,89,
	0,0,1606,1607,5,74,0,0,1607,1608,5,12,0,0,1608,1613,5,180,0,0,1609,1610,
	5,66,0,0,1610,1611,3,254,127,0,1611,1612,5,67,0,0,1612,1614,1,0,0,0,1613,
	1609,1,0,0,0,1614,1615,1,0,0,0,1615,1613,1,0,0,0,1615,1616,1,0,0,0,1616,
	1617,1,0,0,0,1617,1618,5,2,0,0,1618,1650,1,0,0,0,1619,1620,5,89,0,0,1620,
	1625,5,180,0,0,1621,1622,5,66,0,0,1622,1623,3,254,127,0,1623,1624,5,67,
	0,0,1624,1626,1,0,0,0,1625,1621,1,0,0,0,1626,1627,1,0,0,0,1627,1625,1,0,
	0,0,1627,1628,1,0,0,0,1628,1629,1,0,0,0,1629,1630,5,2,0,0,1630,1650,1,0,
	0,0,1631,1632,5,89,0,0,1632,1635,5,180,0,0,1633,1634,5,12,0,0,1634,1636,
	5,180,0,0,1635,1633,1,0,0,0,1636,1637,1,0,0,0,1637,1635,1,0,0,0,1637,1638,
	1,0,0,0,1638,1643,1,0,0,0,1639,1640,5,66,0,0,1640,1641,3,254,127,0,1641,
	1642,5,67,0,0,1642,1644,1,0,0,0,1643,1639,1,0,0,0,1644,1645,1,0,0,0,1645,
	1643,1,0,0,0,1645,1646,1,0,0,0,1646,1647,1,0,0,0,1647,1648,5,2,0,0,1648,
	1650,1,0,0,0,1649,1597,1,0,0,0,1649,1600,1,0,0,0,1649,1605,1,0,0,0,1649,
	1619,1,0,0,0,1649,1631,1,0,0,0,1650,151,1,0,0,0,1651,1652,5,90,0,0,1652,
	1653,5,49,0,0,1653,1654,5,154,0,0,1654,1655,5,23,0,0,1655,1658,3,254,127,
	0,1656,1657,5,5,0,0,1657,1659,3,230,115,0,1658,1656,1,0,0,0,1658,1659,1,
	0,0,0,1659,1660,1,0,0,0,1660,1661,5,50,0,0,1661,1662,5,2,0,0,1662,153,1,
	0,0,0,1663,1664,5,90,0,0,1664,1665,5,49,0,0,1665,1668,3,254,127,0,1666,
	1667,5,5,0,0,1667,1669,3,230,115,0,1668,1666,1,0,0,0,1668,1669,1,0,0,0,
	1669,1670,1,0,0,0,1670,1671,5,50,0,0,1671,1672,5,2,0,0,1672,155,1,0,0,0,
	1673,1674,5,91,0,0,1674,1675,5,49,0,0,1675,1676,3,254,127,0,1676,1677,5,
	50,0,0,1677,1680,3,108,54,0,1678,1679,5,92,0,0,1679,1681,3,108,54,0,1680,
	1678,1,0,0,0,1680,1681,1,0,0,0,1681,157,1,0,0,0,1682,1689,3,174,87,0,1683,
	1689,3,176,88,0,1684,1689,3,166,83,0,1685,1689,3,160,80,0,1686,1689,3,162,
	81,0,1687,1689,3,164,82,0,1688,1682,1,0,0,0,1688,1683,1,0,0,0,1688,1684,
	1,0,0,0,1688,1685,1,0,0,0,1688,1686,1,0,0,0,1688,1687,1,0,0,0,1689,159,
	1,0,0,0,1690,1691,5,9,0,0,1691,1692,5,49,0,0,1692,1693,3,266,133,0,1693,
	1694,5,180,0,0,1694,1695,5,5,0,0,1695,1696,3,266,133,0,1696,1697,5,180,
	0,0,1697,1698,5,93,0,0,1698,1699,5,74,0,0,1699,1700,5,12,0,0,1700,1701,
	5,180,0,0,1701,1702,5,12,0,0,1702,1703,5,34,0,0,1703,1704,5,50,0,0,1704,
	1705,3,108,54,0,1705,161,1,0,0,0,1706,1707,5,9,0,0,1707,1708,5,49,0,0,1708,
	1709,3,266,133,0,1709,1710,5,180,0,0,1710,1711,5,94,0,0,1711,1712,5,74,
	0,0,1712,1713,5,12,0,0,1713,1714,5,180,0,0,1714,1715,5,50,0,0,1715,1716,
	3,108,54,0,1716,163,1,0,0,0,1717,1718,5,9,0,0,1718,1719,5,49,0,0,1719,1720,
	3,266,133,0,1720,1721,5,180,0,0,1721,1722,5,93,0,0,1722,1723,5,74,0,0,1723,
	1724,5,12,0,0,1724,1725,5,180,0,0,1725,1726,5,50,0,0,1726,1727,3,108,54,
	0,1727,165,1,0,0,0,1728,1729,5,9,0,0,1729,1730,5,49,0,0,1730,1731,3,168,
	84,0,1731,1733,3,170,85,0,1732,1734,3,172,86,0,1733,1732,1,0,0,0,1733,1734,
	1,0,0,0,1734,1735,1,0,0,0,1735,1736,5,50,0,0,1736,1737,3,108,54,0,1737,
	167,1,0,0,0,1738,1742,3,266,133,0,1739,1741,3,258,129,0,1740,1739,1,0,0,
	0,1741,1744,1,0,0,0,1742,1740,1,0,0,0,1742,1743,1,0,0,0,1743,1745,1,0,0,
	0,1744,1742,1,0,0,0,1745,1748,5,180,0,0,1746,1747,5,40,0,0,1747,1749,3,
	254,127,0,1748,1746,1,0,0,0,1748,1749,1,0,0,0,1749,1750,1,0,0,0,1750,1751,
	5,2,0,0,1751,169,1,0,0,0,1752,1753,3,254,127,0,1753,1754,5,2,0,0,1754,171,
	1,0,0,0,1755,1756,5,180,0,0,1756,1757,7,8,0,0,1757,1763,3,254,127,0,1758,
	1759,5,180,0,0,1759,1763,7,9,0,0,1760,1761,7,9,0,0,1761,1763,5,180,0,0,
	1762,1755,1,0,0,0,1762,1758,1,0,0,0,1762,1760,1,0,0,0,1763,173,1,0,0,0,
	1764,1765,5,95,0,0,1765,1766,3,108,54,0,1766,1767,5,96,0,0,1767,1768,5,
	49,0,0,1768,1769,3,254,127,0,1769,1770,5,50,0,0,1770,1771,5,2,0,0,1771,
	175,1,0,0,0,1772,1773,5,96,0,0,1773,1774,5,49,0,0,1774,1775,3,254,127,0,
	1775,1776,5,50,0,0,1776,1777,3,108,54,0,1777,177,1,0,0,0,1778,1779,5,97,
	0,0,1779,1780,3,238,119,0,1780,1781,5,2,0,0,1781,179,1,0,0,0,1782,1783,
	5,98,0,0,1783,1784,3,182,91,0,1784,181,1,0,0,0,1785,1789,5,4,0,0,1786,1788,
	3,184,92,0,1787,1786,1,0,0,0,1788,1791,1,0,0,0,1789,1787,1,0,0,0,1789,1790,
	1,0,0,0,1790,1792,1,0,0,0,1791,1789,1,0,0,0,1792,1793,5,6,0,0,1793,183,
	1,0,0,0,1794,1808,3,182,91,0,1795,1808,3,186,93,0,1796,1808,3,188,94,0,
	1797,1808,3,190,95,0,1798,1808,3,192,96,0,1799,1808,3,198,99,0,1800,1808,
	3,200,100,0,1801,1808,5,99,0,0,1802,1808,5,100,0,0,1803,1808,5,101,0,0,
	1804,1808,3,204,102,0,1805,1808,3,208,104,0,1806,1808,3,210,105,0,1807,
	1794,1,0,0,0,1807,1795,1,0,0,0,1807,1796,1,0,0,0,1807,1797,1,0,0,0,1807,
	1798,1,0,0,0,1807,1799,1,0,0,0,1807,1800,1,0,0,0,1807,1801,1,0,0,0,1807,
	1802,1,0,0,0,1807,1803,1,0,0,0,1807,1804,1,0,0,0,1807,1805,1,0,0,0,1807,
	1806,1,0,0,0,1808,185,1,0,0,0,1809,1810,5,102,0,0,1810,1815,3,14,7,0,1811,
	1812,5,5,0,0,1812,1814,3,14,7,0,1813,1811,1,0,0,0,1814,1817,1,0,0,0,1815,
	1813,1,0,0,0,1815,1816,1,0,0,0,1816,1820,1,0,0,0,1817,1815,1,0,0,0,1818,
	1819,5,103,0,0,1819,1821,3,202,101,0,1820,1818,1,0,0,0,1820,1821,1,0,0,
	0,1821,187,1,0,0,0,1822,1827,3,208,104,0,1823,1824,5,5,0,0,1824,1826,3,
	208,104,0,1825,1823,1,0,0,0,1826,1829,1,0,0,0,1827,1825,1,0,0,0,1827,1828,
	1,0,0,0,1828,1830,1,0,0,0,1829,1827,1,0,0,0,1830,1831,5,103,0,0,1831,1832,
	3,202,101,0,1832,189,1,0,0,0,1833,1834,5,91,0,0,1834,1835,3,202,101,0,1835,
	1836,3,182,91,0,1836,191,1,0,0,0,1837,1838,5,104,0,0,1838,1848,3,202,101,
	0,1839,1841,3,194,97,0,1840,1839,1,0,0,0,1841,1842,1,0,0,0,1842,1840,1,
	0,0,0,1842,1843,1,0,0,0,1843,1845,1,0,0,0,1844,1846,3,196,98,0,1845,1844,
	1,0,0,0,1845,1846,1,0,0,0,1846,1849,1,0,0,0,1847,1849,3,196,98,0,1848,1840,
	1,0,0,0,1848,1847,1,0,0,0,1849,193,1,0,0,0,1850,1851,5,105,0,0,1851,1852,
	3,210,105,0,1852,1853,3,182,91,0,1853,195,1,0,0,0,1854,1855,5,106,0,0,1855,
	1856,3,182,91,0,1856,197,1,0,0,0,1857,1858,5,9,0,0,1858,1859,3,182,91,0,
	1859,1860,3,202,101,0,1860,1861,3,182,91,0,1861,1862,3,182,91,0,1862,199,
	1,0,0,0,1863,1864,5,7,0,0,1864,1865,5,180,0,0,1865,1874,5,49,0,0,1866,1871,
	5,180,0,0,1867,1868,5,5,0,0,1868,1870,5,180,0,0,1869,1867,1,0,0,0,1870,
	1873,1,0,0,0,1871,1869,1,0,0,0,1871,1872,1,0,0,0,1872,1875,1,0,0,0,1873,
	1871,1,0,0,0,1874,1866,1,0,0,0,1874,1875,1,0,0,0,1875,1876,1,0,0,0,1876,
	1886,5,50,0,0,1877,1878,5,107,0,0,1878,1883,5,180,0,0,1879,1880,5,5,0,0,
	1880,1882,5,180,0,0,1881,1879,1,0,0,0,1882,1885,1,0,0,0,1883,1881,1,0,0,
	0,1883,1884,1,0,0,0,1884,1887,1,0,0,0,1885,1883,1,0,0,0,1886,1877,1,0,0,
	0,1886,1887,1,0,0,0,1887,1888,1,0,0,0,1888,1889,3,182,91,0,1889,201,1,0,
	0,0,1890,1894,3,204,102,0,1891,1894,3,208,104,0,1892,1894,3,210,105,0,1893,
	1890,1,0,0,0,1893,1891,1,0,0,0,1893,1892,1,0,0,0,1894,203,1,0,0,0,1895,
	1896,3,206,103,0,1896,1905,5,49,0,0,1897,1902,3,202,101,0,1898,1899,5,5,
	0,0,1899,1901,3,202,101,0,1900,1898,1,0,0,0,1901,1904,1,0,0,0,1902,1900,
	1,0,0,0,1902,1903,1,0,0,0,1903,1906,1,0,0,0,1904,1902,1,0,0,0,1905,1897,
	1,0,0,0,1905,1906,1,0,0,0,1906,1907,1,0,0,0,1907,1908,5,50,0,0,1908,205,
	1,0,0,0,1909,1910,7,10,0,0,1910,207,1,0,0,0,1911,1916,3,14,7,0,1912,1913,
	5,12,0,0,1913,1915,3,14,7,0,1914,1912,1,0,0,0,1915,1918,1,0,0,0,1916,1914,
	1,0,0,0,1916,1917,1,0,0,0,1917,209,1,0,0,0,1918,1916,1,0,0,0,1919,1920,
	7,11,0,0,1920,211,1,0,0,0,1921,1922,5,109,0,0,1922,1926,5,4,0,0,1923,1925,
	3,110,55,0,1924,1923,1,0,0,0,1925,1928,1,0,0,0,1926,1924,1,0,0,0,1926,1927,
	1,0,0,0,1927,1929,1,0,0,0,1928,1926,1,0,0,0,1929,1930,5,6,0,0,1930,213,
	1,0,0,0,1931,1932,5,104,0,0,1932,1933,5,49,0,0,1933,1934,3,254,127,0,1934,
	1935,5,50,0,0,1935,1939,5,4,0,0,1936,1938,3,216,108,0,1937,1936,1,0,0,0,
	1938,1941,1,0,0,0,1939,1937,1,0,0,0,1939,1940,1,0,0,0,1940,1943,1,0,0,0,
	1941,1939,1,0,0,0,1942,1944,3,218,109,0,1943,1942,1,0,0,0,1943,1944,1,0,
	0,0,1944,1945,1,0,0,0,1945,1946,5,6,0,0,1946,215,1,0,0,0,1947,1948,5,105,
	0,0,1948,1949,3,254,127,0,1949,1953,5,110,0,0,1950,1952,3,110,55,0,1951,
	1950,1,0,0,0,1952,1955,1,0,0,0,1953,1951,1,0,0,0,1953,1954,1,0,0,0,1954,
	217,1,0,0,0,1955,1953,1,0,0,0,1956,1957,5,106,0,0,1957,1961,5,110,0,0,1958,
	1960,3,110,55,0,1959,1958,1,0,0,0,1960,1963,1,0,0,0,1961,1959,1,0,0,0,1961,
	1962,1,0,0,0,1962,219,1,0,0,0,1963,1961,1,0,0,0,1964,1965,5,111,0,0,1965,
	1967,3,254,127,0,1966,1968,3,222,111,0,1967,1966,1,0,0,0,1967,1968,1,0,
	0,0,1968,1969,1,0,0,0,1969,1971,3,108,54,0,1970,1972,3,224,112,0,1971,1970,
	1,0,0,0,1972,1973,1,0,0,0,1973,1971,1,0,0,0,1973,1974,1,0,0,0,1974,221,
	1,0,0,0,1975,1976,5,73,0,0,1976,1988,5,49,0,0,1977,1982,3,106,53,0,1978,
	1979,5,5,0,0,1979,1981,3,106,53,0,1980,1978,1,0,0,0,1981,1984,1,0,0,0,1982,
	1980,1,0,0,0,1982,1983,1,0,0,0,1983,1986,1,0,0,0,1984,1982,1,0,0,0,1985,
	1987,5,5,0,0,1986,1985,1,0,0,0,1986,1987,1,0,0,0,1987,1989,1,0,0,0,1988,
	1977,1,0,0,0,1988,1989,1,0,0,0,1989,1990,1,0,0,0,1990,1991,5,50,0,0,1991,
	223,1,0,0,0,1992,1994,5,112,0,0,1993,1995,5,180,0,0,1994,1993,1,0,0,0,1994,
	1995,1,0,0,0,1995,2011,1,0,0,0,1996,2008,5,49,0,0,1997,2002,3,106,53,0,
	1998,1999,5,5,0,0,1999,2001,3,106,53,0,2000,1998,1,0,0,0,2001,2004,1,0,
	0,0,2002,2000,1,0,0,0,2002,2003,1,0,0,0,2003,2006,1,0,0,0,2004,2002,1,0,
	0,0,2005,2007,5,5,0,0,2006,2005,1,0,0,0,2006,2007,1,0,0,0,2007,2009,1,0,
	0,0,2008,1997,1,0,0,0,2008,2009,1,0,0,0,2009,2010,1,0,0,0,2010,2012,5,50,
	0,0,2011,1996,1,0,0,0,2011,2012,1,0,0,0,2012,2013,1,0,0,0,2013,2014,3,108,
	54,0,2014,225,1,0,0,0,2015,2016,5,99,0,0,2016,2017,5,2,0,0,2017,227,1,0,
	0,0,2018,2019,5,100,0,0,2019,2020,5,2,0,0,2020,229,1,0,0,0,2021,2025,5,
	151,0,0,2022,2023,5,180,0,0,2023,2025,3,244,122,0,2024,2021,1,0,0,0,2024,
	2022,1,0,0,0,2025,231,1,0,0,0,2026,2027,5,36,0,0,2027,2030,5,180,0,0,2028,
	2029,5,12,0,0,2029,2031,5,180,0,0,2030,2028,1,0,0,0,2030,2031,1,0,0,0,2031,
	2032,1,0,0,0,2032,2033,5,49,0,0,2033,2045,5,4,0,0,2034,2039,3,242,121,0,
	2035,2036,5,5,0,0,2036,2038,3,242,121,0,2037,2035,1,0,0,0,2038,2041,1,0,
	0,0,2039,2037,1,0,0,0,2039,2040,1,0,0,0,2040,2043,1,0,0,0,2041,2039,1,0,
	0,0,2042,2044,5,5,0,0,2043,2042,1,0,0,0,2043,2044,1,0,0,0,2044,2046,1,0,
	0,0,2045,2034,1,0,0,0,2045,2046,1,0,0,0,2046,2047,1,0,0,0,2047,2048,5,6,
	0,0,2048,2049,5,50,0,0,2049,2069,5,2,0,0,2050,2051,5,36,0,0,2051,2054,5,
	180,0,0,2052,2053,5,12,0,0,2053,2055,5,180,0,0,2054,2052,1,0,0,0,2054,2055,
	1,0,0,0,2055,2056,1,0,0,0,2056,2057,3,244,122,0,2057,2058,5,2,0,0,2058,
	2069,1,0,0,0,2059,2060,5,36,0,0,2060,2061,5,49,0,0,2061,2062,5,151,0,0,
	2062,2063,5,50,0,0,2063,2069,5,2,0,0,2064,2065,5,36,0,0,2065,2066,5,49,
	0,0,2066,2067,5,50,0,0,2067,2069,5,2,0,0,2068,2026,1,0,0,0,2068,2050,1,
	0,0,0,2068,2059,1,0,0,0,2068,2064,1,0,0,0,2069,233,1,0,0,0,2070,2071,5,
	113,0,0,2071,2072,5,49,0,0,2072,2073,3,254,127,0,2073,2074,5,50,0,0,2074,
	2075,5,2,0,0,2075,235,1,0,0,0,2076,2079,5,180,0,0,2077,2079,3,260,130,0,
	2078,2076,1,0,0,0,2078,2077,1,0,0,0,2079,237,1,0,0,0,2080,2092,5,49,0,0,
	2081,2086,3,236,118,0,2082,2083,5,5,0,0,2083,2085,3,236,118,0,2084,2082,
	1,0,0,0,2085,2088,1,0,0,0,2086,2084,1,0,0,0,2086,2087,1,0,0,0,2087,2090,
	1,0,0,0,2088,2086,1,0,0,0,2089,2091,5,5,0,0,2090,2089,1,0,0,0,2090,2091,
	1,0,0,0,2091,2093,1,0,0,0,2092,2081,1,0,0,0,2092,2093,1,0,0,0,2093,2094,
	1,0,0,0,2094,2095,5,50,0,0,2095,239,1,0,0,0,2096,2097,5,180,0,0,2097,2121,
	3,244,122,0,2098,2099,5,180,0,0,2099,2100,5,12,0,0,2100,2101,5,180,0,0,
	2101,2121,3,244,122,0,2102,2103,5,180,0,0,2103,2104,5,49,0,0,2104,2116,
	5,4,0,0,2105,2110,3,242,121,0,2106,2107,5,5,0,0,2107,2109,3,242,121,0,2108,
	2106,1,0,0,0,2109,2112,1,0,0,0,2110,2108,1,0,0,0,2110,2111,1,0,0,0,2111,
	2114,1,0,0,0,2112,2110,1,0,0,0,2113,2115,5,5,0,0,2114,2113,1,0,0,0,2114,
	2115,1,0,0,0,2115,2117,1,0,0,0,2116,2105,1,0,0,0,2116,2117,1,0,0,0,2117,
	2118,1,0,0,0,2118,2119,5,6,0,0,2119,2121,5,50,0,0,2120,2096,1,0,0,0,2120,
	2098,1,0,0,0,2120,2102,1,0,0,0,2121,241,1,0,0,0,2122,2123,5,180,0,0,2123,
	2124,5,110,0,0,2124,2125,3,254,127,0,2125,243,1,0,0,0,2126,2138,5,49,0,
	0,2127,2132,3,254,127,0,2128,2129,5,5,0,0,2129,2131,3,254,127,0,2130,2128,
	1,0,0,0,2131,2134,1,0,0,0,2132,2130,1,0,0,0,2132,2133,1,0,0,0,2133,2136,
	1,0,0,0,2134,2132,1,0,0,0,2135,2137,5,5,0,0,2136,2135,1,0,0,0,2136,2137,
	1,0,0,0,2137,2139,1,0,0,0,2138,2127,1,0,0,0,2138,2139,1,0,0,0,2139,2140,
	1,0,0,0,2140,2141,5,50,0,0,2141,245,1,0,0,0,2142,2143,5,4,0,0,2143,2148,
	3,248,124,0,2144,2145,5,5,0,0,2145,2147,3,248,124,0,2146,2144,1,0,0,0,2147,
	2150,1,0,0,0,2148,2146,1,0,0,0,2148,2149,1,0,0,0,2149,2152,1,0,0,0,2150,
	2148,1,0,0,0,2151,2153,5,5,0,0,2152,2151,1,0,0,0,2152,2153,1,0,0,0,2153,
	2154,1,0,0,0,2154,2155,5,6,0,0,2155,247,1,0,0,0,2156,2157,5,180,0,0,2157,
	2158,5,110,0,0,2158,2159,3,254,127,0,2159,249,1,0,0,0,2160,2161,5,49,0,
	0,2161,2166,3,252,126,0,2162,2163,5,5,0,0,2163,2165,3,252,126,0,2164,2162,
	1,0,0,0,2165,2168,1,0,0,0,2166,2164,1,0,0,0,2166,2167,1,0,0,0,2167,2170,
	1,0,0,0,2168,2166,1,0,0,0,2169,2171,5,5,0,0,2170,2169,1,0,0,0,2170,2171,
	1,0,0,0,2171,2172,1,0,0,0,2172,2173,5,50,0,0,2173,251,1,0,0,0,2174,2177,
	3,266,133,0,2175,2177,3,82,41,0,2176,2174,1,0,0,0,2176,2175,1,0,0,0,2177,
	253,1,0,0,0,2178,2179,6,127,-1,0,2179,2180,5,49,0,0,2180,2181,5,180,0,0,
	2181,2182,7,8,0,0,2182,2183,3,254,127,0,2183,2184,5,50,0,0,2184,2334,1,
	0,0,0,2185,2186,5,49,0,0,2186,2187,3,254,127,0,2187,2188,5,50,0,0,2188,
	2334,1,0,0,0,2189,2190,5,49,0,0,2190,2193,3,254,127,0,2191,2192,5,5,0,0,
	2192,2194,3,254,127,0,2193,2191,1,0,0,0,2194,2195,1,0,0,0,2195,2193,1,0,
	0,0,2195,2196,1,0,0,0,2196,2197,1,0,0,0,2197,2198,5,50,0,0,2198,2334,1,
	0,0,0,2199,2200,3,268,134,0,2200,2201,5,49,0,0,2201,2203,3,254,127,0,2202,
	2204,5,5,0,0,2203,2202,1,0,0,0,2203,2204,1,0,0,0,2204,2205,1,0,0,0,2205,
	2206,5,50,0,0,2206,2334,1,0,0,0,2207,2334,3,240,120,0,2208,2209,5,114,0,
	0,2209,2211,5,180,0,0,2210,2212,3,246,123,0,2211,2210,1,0,0,0,2211,2212,
	1,0,0,0,2212,2213,1,0,0,0,2213,2334,3,244,122,0,2214,2215,5,114,0,0,2215,
	2218,3,266,133,0,2216,2217,5,66,0,0,2217,2219,5,67,0,0,2218,2216,1,0,0,
	0,2219,2220,1,0,0,0,2220,2218,1,0,0,0,2220,2221,1,0,0,0,2221,2222,1,0,0,
	0,2222,2223,5,49,0,0,2223,2224,3,254,127,0,2224,2225,5,50,0,0,2225,2334,
	1,0,0,0,2226,2227,5,114,0,0,2227,2228,5,148,0,0,2228,2229,5,49,0,0,2229,
	2230,3,254,127,0,2230,2231,5,50,0,0,2231,2334,1,0,0,0,2232,2233,5,55,0,
	0,2233,2234,5,49,0,0,2234,2235,3,266,133,0,2235,2236,5,50,0,0,2236,2237,
	5,12,0,0,2237,2238,5,180,0,0,2238,2334,1,0,0,0,2239,2240,5,115,0,0,2240,
	2334,3,244,122,0,2241,2242,5,116,0,0,2242,2334,3,244,122,0,2243,2244,5,
	117,0,0,2244,2334,3,244,122,0,2245,2246,5,118,0,0,2246,2334,3,244,122,0,
	2247,2248,5,119,0,0,2248,2249,5,49,0,0,2249,2250,5,180,0,0,2250,2251,5,
	12,0,0,2251,2252,5,180,0,0,2252,2253,5,5,0,0,2253,2254,3,244,122,0,2254,
	2255,5,50,0,0,2255,2334,1,0,0,0,2256,2257,5,120,0,0,2257,2334,3,244,122,
	0,2258,2259,5,121,0,0,2259,2334,3,244,122,0,2260,2261,5,122,0,0,2261,2262,
	5,49,0,0,2262,2263,3,254,127,0,2263,2264,5,5,0,0,2264,2265,3,250,125,0,
	2265,2266,5,50,0,0,2266,2334,1,0,0,0,2267,2268,5,123,0,0,2268,2269,5,49,
	0,0,2269,2270,3,254,127,0,2270,2271,5,5,0,0,2271,2272,3,250,125,0,2272,
	2273,5,5,0,0,2273,2274,5,145,0,0,2274,2275,5,50,0,0,2275,2334,1,0,0,0,2276,
	2277,5,124,0,0,2277,2278,5,66,0,0,2278,2279,3,254,127,0,2279,2280,5,67,
	0,0,2280,2281,7,12,0,0,2281,2334,1,0,0,0,2282,2283,5,125,0,0,2283,2284,
	5,66,0,0,2284,2285,3,254,127,0,2285,2286,5,67,0,0,2286,2287,7,13,0,0,2287,
	2334,1,0,0,0,2288,2289,7,14,0,0,2289,2334,3,254,127,21,2290,2302,5,66,0,
	0,2291,2296,3,254,127,0,2292,2293,5,5,0,0,2293,2295,3,254,127,0,2294,2292,
	1,0,0,0,2295,2298,1,0,0,0,2296,2294,1,0,0,0,2296,2297,1,0,0,0,2297,2300,
	1,0,0,0,2298,2296,1,0,0,0,2299,2301,5,5,0,0,2300,2299,1,0,0,0,2300,2301,
	1,0,0,0,2301,2303,1,0,0,0,2302,2291,1,0,0,0,2302,2303,1,0,0,0,2303,2304,
	1,0,0,0,2304,2334,5,67,0,0,2305,2306,5,74,0,0,2306,2307,5,12,0,0,2307,2308,
	5,180,0,0,2308,2309,5,12,0,0,2309,2310,5,180,0,0,2310,2311,5,66,0,0,2311,
	2312,3,254,127,0,2312,2313,5,67,0,0,2313,2314,3,256,128,0,2314,2334,1,0,
	0,0,2315,2316,5,74,0,0,2316,2317,5,12,0,0,2317,2322,5,180,0,0,2318,2319,
	5,66,0,0,2319,2320,3,254,127,0,2320,2321,5,67,0,0,2321,2323,1,0,0,0,2322,
	2318,1,0,0,0,2323,2324,1,0,0,0,2324,2322,1,0,0,0,2324,2325,1,0,0,0,2325,
	2334,1,0,0,0,2326,2327,5,74,0,0,2327,2328,5,12,0,0,2328,2334,5,180,0,0,
	2329,2334,5,74,0,0,2330,2334,5,160,0,0,2331,2334,3,14,7,0,2332,2334,3,260,
	130,0,2333,2178,1,0,0,0,2333,2185,1,0,0,0,2333,2189,1,0,0,0,2333,2199,1,
	0,0,0,2333,2207,1,0,0,0,2333,2208,1,0,0,0,2333,2214,1,0,0,0,2333,2226,1,
	0,0,0,2333,2232,1,0,0,0,2333,2239,1,0,0,0,2333,2241,1,0,0,0,2333,2243,1,
	0,0,0,2333,2245,1,0,0,0,2333,2247,1,0,0,0,2333,2256,1,0,0,0,2333,2258,1,
	0,0,0,2333,2260,1,0,0,0,2333,2267,1,0,0,0,2333,2276,1,0,0,0,2333,2282,1,
	0,0,0,2333,2288,1,0,0,0,2333,2290,1,0,0,0,2333,2305,1,0,0,0,2333,2315,1,
	0,0,0,2333,2326,1,0,0,0,2333,2329,1,0,0,0,2333,2330,1,0,0,0,2333,2331,1,
	0,0,0,2333,2332,1,0,0,0,2334,2442,1,0,0,0,2335,2336,10,20,0,0,2336,2337,
	5,17,0,0,2337,2441,3,254,127,20,2338,2339,10,19,0,0,2339,2340,7,15,0,0,
	2340,2441,3,254,127,20,2341,2342,10,18,0,0,2342,2343,7,16,0,0,2343,2441,
	3,254,127,19,2344,2345,10,17,0,0,2345,2346,7,17,0,0,2346,2441,3,254,127,
	18,2347,2348,10,16,0,0,2348,2349,7,18,0,0,2349,2441,3,254,127,17,2350,2351,
	10,15,0,0,2351,2352,7,19,0,0,2352,2441,3,254,127,16,2353,2354,10,14,0,0,
	2354,2355,5,24,0,0,2355,2441,3,254,127,15,2356,2357,10,13,0,0,2357,2358,
	5,26,0,0,2358,2441,3,254,127,14,2359,2360,10,12,0,0,2360,2361,5,25,0,0,
	2361,2441,3,254,127,13,2362,2363,10,11,0,0,2363,2364,5,130,0,0,2364,2441,
	3,254,127,12,2365,2366,10,10,0,0,2366,2367,5,131,0,0,2367,2441,3,254,127,
	11,2368,2369,10,9,0,0,2369,2370,5,132,0,0,2370,2371,3,254,127,0,2371,2372,
	5,110,0,0,2372,2373,3,254,127,9,2373,2441,1,0,0,0,2374,2375,10,33,0,0,2375,
	2376,5,66,0,0,2376,2377,3,254,127,0,2377,2378,5,110,0,0,2378,2379,3,254,
	127,0,2379,2380,5,67,0,0,2380,2441,1,0,0,0,2381,2382,10,32,0,0,2382,2383,
	5,66,0,0,2383,2384,5,145,0,0,2384,2441,5,67,0,0,2385,2386,10,31,0,0,2386,
	2387,5,66,0,0,2387,2388,3,254,127,0,2388,2389,5,67,0,0,2389,2441,1,0,0,
	0,2390,2391,10,28,0,0,2391,2441,7,20,0,0,2392,2393,10,27,0,0,2393,2394,
	5,167,0,0,2394,2395,5,49,0,0,2395,2396,3,254,127,0,2396,2397,5,50,0,0,2397,
	2441,1,0,0,0,2398,2399,10,26,0,0,2399,2400,5,168,0,0,2400,2401,5,49,0,0,
	2401,2402,3,254,127,0,2402,2403,5,5,0,0,2403,2404,3,254,127,0,2404,2405,
	5,50,0,0,2405,2441,1,0,0,0,2406,2407,10,25,0,0,2407,2408,5,12,0,0,2408,
	2410,5,180,0,0,2409,2411,3,246,123,0,2410,2409,1,0,0,0,2410,2411,1,0,0,
	0,2411,2412,1,0,0,0,2412,2413,5,49,0,0,2413,2425,5,4,0,0,2414,2419,3,242,
	121,0,2415,2416,5,5,0,0,2416,2418,3,242,121,0,2417,2415,1,0,0,0,2418,2421,
	1,0,0,0,2419,2417,1,0,0,0,2419,2420,1,0,0,0,2420,2423,1,0,0,0,2421,2419,
	1,0,0,0,2422,2424,5,5,0,0,2423,2422,1,0,0,0,2423,2424,1,0,0,0,2424,2426,
	1,0,0,0,2425,2414,1,0,0,0,2425,2426,1,0,0,0,2426,2427,1,0,0,0,2427,2428,
	5,6,0,0,2428,2441,5,50,0,0,2429,2430,10,24,0,0,2430,2431,5,12,0,0,2431,
	2433,5,180,0,0,2432,2434,3,246,123,0,2433,2432,1,0,0,0,2433,2434,1,0,0,
	0,2434,2435,1,0,0,0,2435,2441,3,244,122,0,2436,2437,10,23,0,0,2437,2441,
	3,256,128,0,2438,2439,10,22,0,0,2439,2441,7,9,0,0,2440,2335,1,0,0,0,2440,
	2338,1,0,0,0,2440,2341,1,0,0,0,2440,2344,1,0,0,0,2440,2347,1,0,0,0,2440,
	2350,1,0,0,0,2440,2353,1,0,0,0,2440,2356,1,0,0,0,2440,2359,1,0,0,0,2440,
	2362,1,0,0,0,2440,2365,1,0,0,0,2440,2368,1,0,0,0,2440,2374,1,0,0,0,2440,
	2381,1,0,0,0,2440,2385,1,0,0,0,2440,2390,1,0,0,0,2440,2392,1,0,0,0,2440,
	2398,1,0,0,0,2440,2406,1,0,0,0,2440,2429,1,0,0,0,2440,2436,1,0,0,0,2440,
	2438,1,0,0,0,2441,2444,1,0,0,0,2442,2440,1,0,0,0,2442,2443,1,0,0,0,2443,
	255,1,0,0,0,2444,2442,1,0,0,0,2445,2446,5,12,0,0,2446,2459,5,180,0,0,2447,
	2459,5,163,0,0,2448,2459,5,172,0,0,2449,2459,5,173,0,0,2450,2459,5,174,
	0,0,2451,2459,5,175,0,0,2452,2459,5,176,0,0,2453,2459,5,177,0,0,2454,2459,
	5,178,0,0,2455,2459,5,179,0,0,2456,2459,5,170,0,0,2457,2459,5,171,0,0,2458,
	2445,1,0,0,0,2458,2447,1,0,0,0,2458,2448,1,0,0,0,2458,2449,1,0,0,0,2458,
	2450,1,0,0,0,2458,2451,1,0,0,0,2458,2452,1,0,0,0,2458,2453,1,0,0,0,2458,
	2454,1,0,0,0,2458,2455,1,0,0,0,2458,2456,1,0,0,0,2458,2457,1,0,0,0,2459,
	257,1,0,0,0,2460,2461,7,21,0,0,2461,259,1,0,0,0,2462,2477,5,141,0,0,2463,
	2477,3,262,131,0,2464,2477,3,264,132,0,2465,2469,5,151,0,0,2466,2468,5,
	151,0,0,2467,2466,1,0,0,0,2468,2471,1,0,0,0,2469,2467,1,0,0,0,2469,2470,
	1,0,0,0,2470,2477,1,0,0,0,2471,2469,1,0,0,0,2472,2477,5,161,0,0,2473,2477,
	5,162,0,0,2474,2477,5,152,0,0,2475,2477,5,153,0,0,2476,2462,1,0,0,0,2476,
	2463,1,0,0,0,2476,2464,1,0,0,0,2476,2465,1,0,0,0,2476,2472,1,0,0,0,2476,
	2473,1,0,0,0,2476,2474,1,0,0,0,2476,2475,1,0,0,0,2477,261,1,0,0,0,2478,
	2480,5,145,0,0,2479,2481,7,22,0,0,2480,2479,1,0,0,0,2480,2481,1,0,0,0,2481,
	263,1,0,0,0,2482,2483,5,144,0,0,2483,265,1,0,0,0,2484,2485,5,108,0,0,2485,
	2535,5,59,0,0,2486,2535,5,108,0,0,2487,2535,5,146,0,0,2488,2535,5,147,0,
	0,2489,2535,5,149,0,0,2490,2535,5,148,0,0,2491,2535,5,156,0,0,2492,2535,
	5,157,0,0,2493,2535,5,138,0,0,2494,2535,5,139,0,0,2495,2535,5,158,0,0,2496,
	2535,5,159,0,0,2497,2498,5,7,0,0,2498,2507,5,49,0,0,2499,2504,3,266,133,
	0,2500,2501,5,5,0,0,2501,2503,3,266,133,0,2502,2500,1,0,0,0,2503,2506,1,
	0,0,0,2504,2502,1,0,0,0,2504,2505,1,0,0,0,2505,2508,1,0,0,0,2506,2504,1,
	0,0,0,2507,2499,1,0,0,0,2507,2508,1,0,0,0,2508,2509,1,0,0,0,2509,2513,5,
	50,0,0,2510,2512,7,23,0,0,2511,2510,1,0,0,0,2512,2515,1,0,0,0,2513,2511,
	1,0,0,0,2513,2514,1,0,0,0,2514,2528,1,0,0,0,2515,2513,1,0,0,0,2516,2517,
	5,73,0,0,2517,2518,5,49,0,0,2518,2523,3,266,133,0,2519,2520,5,5,0,0,2520,
	2522,3,266,133,0,2521,2519,1,0,0,0,2522,2525,1,0,0,0,2523,2521,1,0,0,0,
	2523,2524,1,0,0,0,2524,2526,1,0,0,0,2525,2523,1,0,0,0,2526,2527,5,50,0,
	0,2527,2529,1,0,0,0,2528,2516,1,0,0,0,2528,2529,1,0,0,0,2529,2535,1,0,0,
	0,2530,2531,5,180,0,0,2531,2532,5,12,0,0,2532,2535,5,180,0,0,2533,2535,
	5,180,0,0,2534,2484,1,0,0,0,2534,2486,1,0,0,0,2534,2487,1,0,0,0,2534,2488,
	1,0,0,0,2534,2489,1,0,0,0,2534,2490,1,0,0,0,2534,2491,1,0,0,0,2534,2492,
	1,0,0,0,2534,2493,1,0,0,0,2534,2494,1,0,0,0,2534,2495,1,0,0,0,2534,2496,
	1,0,0,0,2534,2497,1,0,0,0,2534,2530,1,0,0,0,2534,2533,1,0,0,0,2535,267,
	1,0,0,0,2536,2537,7,24,0,0,2537,269,1,0,0,0,268,273,279,292,294,314,318,
	325,330,338,342,348,359,362,372,376,383,386,390,395,399,414,417,431,434,
	445,447,462,477,481,491,497,503,509,515,521,527,533,539,545,550,558,561,
	578,580,587,595,601,605,617,621,623,627,633,636,639,649,653,655,662,670,
	677,690,694,701,721,727,734,745,751,758,766,777,786,792,798,807,813,818,
	824,831,837,843,847,851,859,864,872,882,887,891,903,912,914,920,926,933,
	944,950,954,960,967,983,992,996,1002,1011,1015,1023,1027,1033,1037,1039,
	1047,1051,1053,1061,1065,1071,1075,1081,1085,1087,1093,1098,1132,1158,1172,
	1184,1188,1193,1198,1207,1211,1213,1235,1240,1246,1261,1270,1274,1276,1285,
	1290,1301,1303,1308,1322,1327,1338,1348,1356,1371,1373,1378,1390,1395,1405,
	1410,1415,1426,1439,1445,1453,1459,1463,1473,1485,1495,1506,1513,1519,1526,
	1539,1557,1571,1615,1627,1637,1645,1649,1658,1668,1680,1688,1733,1742,1748,
	1762,1789,1807,1815,1820,1827,1842,1845,1848,1871,1874,1883,1886,1893,1902,
	1905,1916,1926,1939,1943,1953,1961,1967,1973,1982,1986,1988,1994,2002,2006,
	2008,2011,2024,2030,2039,2043,2045,2054,2068,2078,2086,2090,2092,2110,2114,
	2116,2120,2132,2136,2138,2148,2152,2166,2170,2176,2195,2203,2211,2220,2296,
	2300,2302,2324,2333,2410,2419,2423,2425,2433,2440,2442,2458,2469,2476,2480,
	2504,2507,2513,2523,2528,2534];

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
