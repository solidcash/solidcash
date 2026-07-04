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
		let _la: number;
		try {
			this.state = 419;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 21, this._ctx) ) {
			case 1:
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
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 410;
				this.match(SolidCashParser.T__36);
				this.state = 411;
				this.match(SolidCashParser.Identifier);
				this.state = 415;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 2081) !== 0) || _la===180) {
					{
					{
					this.state = 412;
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
					this.state = 417;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 418;
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
			this.state = 421;
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
			this.state = 429;
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
				this.state = 424;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 423;
					this.versionConstraint();
					}
					}
					this.state = 426;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0) || _la===140 || _la===144);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 428;
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
			this.state = 432;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0)) {
				{
				this.state = 431;
				this.versionOperator();
				}
			}

			this.state = 434;
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
			this.state = 436;
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
			this.state = 438;
			this.match(SolidCashParser.T__40);
			this.state = 439;
			this.match(SolidCashParser.Identifier);
			this.state = 449;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 440;
				this.match(SolidCashParser.T__41);
				this.state = 441;
				this.match(SolidCashParser.Identifier);
				this.state = 446;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 442;
					this.match(SolidCashParser.T__4);
					this.state = 443;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 448;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 451;
			this.match(SolidCashParser.T__3);
			this.state = 462;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1843969) !== 0)) {
				{
				this.state = 460;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 27, this._ctx) ) {
				case 1:
					{
					this.state = 452;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 453;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 454;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 455;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 456;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 457;
					this.interfaceStateVariable();
					}
					break;
				case 7:
					{
					this.state = 458;
					this.interfaceCollection();
					}
					break;
				case 8:
					{
					this.state = 459;
					this.interfaceFunction();
					}
					break;
				}
				}
				this.state = 464;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 465;
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
			this.state = 477;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 29, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 467;
				this.interfaceStateVariableVisibility();
				this.state = 468;
				this.mappingType();
				this.state = 469;
				this.match(SolidCashParser.Identifier);
				this.state = 470;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 472;
				this.interfaceStateVariableVisibility();
				this.state = 473;
				this.arrayType(0);
				this.state = 474;
				this.match(SolidCashParser.Identifier);
				this.state = 475;
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
			this.state = 479;
			this.interfaceStateVariableVisibility();
			this.state = 480;
			this.typeName();
			this.state = 481;
			this.match(SolidCashParser.Identifier);
			this.state = 482;
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
			this.state = 484;
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
			this.state = 486;
			this.match(SolidCashParser.T__6);
			this.state = 487;
			this.match(SolidCashParser.Identifier);
			this.state = 488;
			this.parameterList();
			this.state = 492;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 489;
				this.functionModifier();
				}
				}
				this.state = 494;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 496;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 495;
				this.returnType();
				}
			}

			this.state = 498;
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
			this.state = 500;
			this.match(SolidCashParser.T__44);
			this.state = 501;
			this.match(SolidCashParser.Identifier);
			this.state = 502;
			this.match(SolidCashParser.T__3);
			this.state = 506;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===54) {
				{
				{
				this.state = 503;
				this.enumDefinition();
				}
				}
				this.state = 508;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 512;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===53) {
				{
				{
				this.state = 509;
				this.structDefinition();
				}
				}
				this.state = 514;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 518;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===55) {
				{
				{
				this.state = 515;
				this.typeDefinition();
				}
				}
				this.state = 520;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 524;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===48) {
				{
				{
				this.state = 521;
				this.eventDefinition();
				}
				}
				this.state = 526;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 530;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===35) {
				{
				{
				this.state = 527;
				this.errorDefinition();
				}
				}
				this.state = 532;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 536;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 37, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 533;
					this.constantDefinition();
					}
					}
				}
				this.state = 538;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 37, this._ctx);
			}
			this.state = 542;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 38, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 539;
					this.stateVariableDeclaration();
					}
					}
				}
				this.state = 544;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 38, this._ctx);
			}
			this.state = 548;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===8) {
				{
				{
				this.state = 545;
				this.usingForDirective();
				}
				}
				this.state = 550;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 554;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7) {
				{
				{
				this.state = 551;
				this.freeFunctionDefinition();
				}
				}
				this.state = 556;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 557;
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
			this.state = 560;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===46) {
				{
				this.state = 559;
				this.match(SolidCashParser.T__45);
				}
			}

			this.state = 562;
			this.match(SolidCashParser.T__46);
			this.state = 563;
			this.match(SolidCashParser.Identifier);
			this.state = 565;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 564;
				this.parameterList();
				}
			}

			this.state = 576;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 567;
				this.match(SolidCashParser.T__41);
				this.state = 568;
				this.inheritanceSpecifier();
				this.state = 573;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 569;
					this.match(SolidCashParser.T__4);
					this.state = 570;
					this.inheritanceSpecifier();
					}
					}
					this.state = 575;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 578;
			this.match(SolidCashParser.T__3);
			this.state = 595;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 268435459) !== 0) || ((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 37411875) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 593;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 45, this._ctx) ) {
				case 1:
					{
					this.state = 579;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 580;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 581;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 582;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 583;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 584;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 585;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 586;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 587;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 588;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 589;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 590;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 591;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 592;
					this.receiveDefinition();
					}
					break;
				}
				}
				this.state = 597;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 598;
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
			this.state = 600;
			this.match(SolidCashParser.Identifier);
			this.state = 602;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 601;
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
			this.state = 604;
			this.match(SolidCashParser.T__6);
			this.state = 605;
			this.anyIdentifier();
			this.state = 606;
			this.parameterList();
			this.state = 611;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0) || _la===180) {
				{
				this.state = 609;
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
					this.state = 607;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 608;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 613;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 615;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 614;
				this.returnType();
				}
			}

			this.state = 617;
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
			this.state = 619;
			this.match(SolidCashParser.T__47);
			this.state = 620;
			this.match(SolidCashParser.Identifier);
			this.state = 621;
			this.match(SolidCashParser.T__48);
			this.state = 633;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 622;
				this.eventParameter();
				this.state = 627;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 623;
						this.match(SolidCashParser.T__4);
						this.state = 624;
						this.eventParameter();
						}
						}
					}
					this.state = 629;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				}
				this.state = 631;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 630;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 635;
			this.match(SolidCashParser.T__49);
			this.state = 637;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===51) {
				{
				this.state = 636;
				this.match(SolidCashParser.T__50);
				}
			}

			this.state = 639;
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
			this.state = 643;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 55, this._ctx) ) {
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
			}
			this.state = 646;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===52) {
				{
				this.state = 645;
				this.match(SolidCashParser.T__51);
				}
			}

			this.state = 649;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 648;
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
			this.state = 651;
			this.match(SolidCashParser.T__34);
			this.state = 652;
			this.match(SolidCashParser.Identifier);
			this.state = 653;
			this.match(SolidCashParser.T__48);
			this.state = 665;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 654;
				this.errorParameter();
				this.state = 659;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 58, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 655;
						this.match(SolidCashParser.T__4);
						this.state = 656;
						this.errorParameter();
						}
						}
					}
					this.state = 661;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 58, this._ctx);
				}
				this.state = 663;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 662;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 667;
			this.match(SolidCashParser.T__49);
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
	public errorParameter(): ErrorParameterContext {
		let localctx: ErrorParameterContext = new ErrorParameterContext(this, this._ctx, this.state);
		this.enterRule(localctx, 50, SolidCashParser.RULE_errorParameter);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 670;
			this.typeName();
			this.state = 672;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 671;
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
			this.state = 674;
			this.match(SolidCashParser.T__52);
			this.state = 675;
			this.match(SolidCashParser.Identifier);
			this.state = 676;
			this.match(SolidCashParser.T__3);
			this.state = 678;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 677;
				this.structField();
				}
				}
				this.state = 680;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180);
			this.state = 682;
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
			this.state = 687;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 63, this._ctx) ) {
			case 1:
				{
				this.state = 684;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 685;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 686;
				this.mappingType();
				}
				break;
			}
			this.state = 689;
			this.anyIdentifier();
			this.state = 690;
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
			this.state = 692;
			this.match(SolidCashParser.T__53);
			this.state = 693;
			this.match(SolidCashParser.Identifier);
			this.state = 694;
			this.match(SolidCashParser.T__3);
			this.state = 695;
			this.enumMember();
			this.state = 700;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 64, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 696;
					this.match(SolidCashParser.T__4);
					this.state = 697;
					this.enumMember();
					}
					}
				}
				this.state = 702;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 64, this._ctx);
			}
			this.state = 704;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 703;
				this.match(SolidCashParser.T__4);
				}
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
	public enumMember(): EnumMemberContext {
		let localctx: EnumMemberContext = new EnumMemberContext(this, this._ctx, this.state);
		this.enterRule(localctx, 58, SolidCashParser.RULE_enumMember);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 708;
			this.match(SolidCashParser.Identifier);
			this.state = 711;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 709;
				this.match(SolidCashParser.T__39);
				this.state = 710;
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
			this.state = 713;
			this.match(SolidCashParser.T__54);
			this.state = 714;
			this.match(SolidCashParser.Identifier);
			this.state = 715;
			this.match(SolidCashParser.T__41);
			this.state = 716;
			this.typeName();
			this.state = 717;
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
			this.state = 719;
			this.typeName();
			this.state = 720;
			this.match(SolidCashParser.T__55);
			this.state = 721;
			this.match(SolidCashParser.Identifier);
			this.state = 722;
			this.match(SolidCashParser.T__39);
			this.state = 723;
			this.expression(0);
			this.state = 724;
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
			this.state = 726;
			this.match(SolidCashParser.T__56);
			this.state = 727;
			this.parameterList();
			this.state = 731;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 98307) !== 0)) {
				{
				{
				this.state = 728;
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
				this.parentInvocation();
				}
				}
				this.state = 739;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 740;
			this.match(SolidCashParser.T__3);
			this.state = 744;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 741;
				this.statement();
				}
				}
				this.state = 746;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 747;
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
			this.state = 749;
			this.match(SolidCashParser.T__59);
			this.state = 750;
			this.parameterList();
			this.state = 751;
			this.match(SolidCashParser.T__43);
			this.state = 755;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 8197) !== 0)) {
				{
				{
				this.state = 752;
				this.fallbackModifier();
				}
				}
				this.state = 757;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 761;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 758;
				this.customModifierInvocation();
				}
				}
				this.state = 763;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 764;
			this.match(SolidCashParser.T__3);
			this.state = 768;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 765;
				this.statement();
				}
				}
				this.state = 770;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 771;
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
			this.state = 776;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 59:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 773;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 774;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 775;
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
			this.state = 778;
			this.match(SolidCashParser.T__61);
			this.state = 779;
			this.match(SolidCashParser.T__48);
			this.state = 780;
			this.match(SolidCashParser.T__49);
			this.state = 781;
			this.match(SolidCashParser.T__43);
			this.state = 782;
			this.match(SolidCashParser.T__58);
			this.state = 783;
			this.match(SolidCashParser.T__3);
			this.state = 787;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 784;
				this.statement();
				}
				}
				this.state = 789;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 790;
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
			this.state = 792;
			this.match(SolidCashParser.Identifier);
			this.state = 793;
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
			this.state = 863;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 86, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 796;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 795;
					this.stateVariableVisibility();
					}
				}

				this.state = 798;
				this.typeName();
				this.state = 802;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 799;
					this.modifier();
					}
					}
					this.state = 804;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 805;
				this.match(SolidCashParser.Identifier);
				this.state = 808;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 806;
					this.match(SolidCashParser.T__39);
					this.state = 807;
					this.expression(0);
					}
				}

				this.state = 810;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 812;
				this.typeName();
				this.state = 816;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 813;
					this.modifier();
					}
					}
					this.state = 818;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 819;
				this.stateVariableVisibility();
				this.state = 823;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 820;
					this.modifier();
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
			case 3:
				this.enterOuterAlt(localctx, 3);
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
				this.mappingType();
				this.state = 840;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 837;
					this.collectionModifier();
					}
					}
					this.state = 842;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 843;
				this.match(SolidCashParser.Identifier);
				this.state = 844;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 847;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 846;
					this.stateVariableVisibility();
					}
				}

				this.state = 849;
				this.arrayType(0);
				this.state = 853;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 850;
					this.collectionModifier();
					}
					}
					this.state = 855;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 856;
				this.match(SolidCashParser.Identifier);
				this.state = 859;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 857;
					this.match(SolidCashParser.T__39);
					this.state = 858;
					this.expression(0);
					}
				}

				this.state = 861;
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
			this.state = 867;
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
				this.state = 865;
				this.modifier();
				}
				break;
			case 43:
			case 44:
			case 58:
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 866;
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
			this.state = 869;
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
			this.state = 907;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 93, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 871;
				this.match(SolidCashParser.T__63);
				this.state = 872;
				this.match(SolidCashParser.T__48);
				this.state = 873;
				this.typeName();
				this.state = 875;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 874;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 877;
				this.match(SolidCashParser.T__64);
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
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 884;
				this.match(SolidCashParser.T__63);
				this.state = 885;
				this.match(SolidCashParser.T__48);
				this.state = 886;
				this.typeName();
				this.state = 888;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 887;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 890;
				this.match(SolidCashParser.T__64);
				this.state = 891;
				this.mappingType();
				this.state = 892;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 894;
				this.match(SolidCashParser.T__63);
				this.state = 895;
				this.match(SolidCashParser.T__48);
				this.state = 896;
				this.typeName();
				this.state = 898;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 897;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 900;
				this.match(SolidCashParser.T__64);
				this.state = 901;
				this.arrayType(0);
				this.state = 903;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 902;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 905;
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
			this.state = 919;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 94, this._ctx) ) {
			case 1:
				{
				this.state = 910;
				this.typeName();
				this.state = 911;
				this.match(SolidCashParser.T__65);
				this.state = 912;
				_la = this._input.LA(1);
				if(!(_la===145 || _la===180)) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 913;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 2:
				{
				this.state = 915;
				this.typeName();
				this.state = 916;
				this.match(SolidCashParser.T__65);
				this.state = 917;
				this.match(SolidCashParser.T__66);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 930;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 96, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 928;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 95, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 921;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 922;
						this.match(SolidCashParser.T__65);
						this.state = 923;
						_la = this._input.LA(1);
						if(!(_la===145 || _la===180)) {
						this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 924;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 925;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 926;
						this.match(SolidCashParser.T__65);
						this.state = 927;
						this.match(SolidCashParser.T__66);
						}
						break;
					}
					}
				}
				this.state = 932;
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
			this.state = 933;
			this.match(SolidCashParser.T__67);
			this.state = 934;
			this.match(SolidCashParser.Identifier);
			this.state = 936;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 935;
				this.parameterList();
				}
			}

			this.state = 938;
			this.match(SolidCashParser.T__3);
			this.state = 942;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 939;
				this.modifierStatement();
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
	public modifierStatement(): ModifierStatementContext {
		let localctx: ModifierStatementContext = new ModifierStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 86, SolidCashParser.RULE_modifierStatement);
		try {
			this.state = 949;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 99, this._ctx) ) {
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
		this.enterRule(localctx, 88, SolidCashParser.RULE_placeholderStatement);
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
		this.enterRule(localctx, 90, SolidCashParser.RULE_functionDefinition);
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
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
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
		this.enterRule(localctx, 92, SolidCashParser.RULE_customModifierInvocation);
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
		this.enterRule(localctx, 94, SolidCashParser.RULE_functionModifier);
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
		this.enterRule(localctx, 96, SolidCashParser.RULE_overrideSpecifier);
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
		this.enterRule(localctx, 98, SolidCashParser.RULE_unsafeModifier);
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
		this.enterRule(localctx, 100, SolidCashParser.RULE_returnType);
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
			_alt = this._interp.adaptivePredict(this._input, 109, this._ctx);
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
				_alt = this._interp.adaptivePredict(this._input, 109, this._ctx);
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
		this.enterRule(localctx, 102, SolidCashParser.RULE_returnParam);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1050;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 115, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1030;
				this.typeName();
				this.state = 1034;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 111, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 111, this._ctx);
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
				_alt = this._interp.adaptivePredict(this._input, 113, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 113, this._ctx);
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
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1052;
			this.match(SolidCashParser.T__48);
			this.state = 1064;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1053;
				this.parameter();
				this.state = 1058;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 116, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1054;
						this.match(SolidCashParser.T__4);
						this.state = 1055;
						this.parameter();
						}
						}
					}
					this.state = 1060;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 116, this._ctx);
				}
				this.state = 1062;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1061;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1066;
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
			this.state = 1098;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 125, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1068;
				this.typeName();
				this.state = 1072;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 119, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1069;
						this.modifier();
						}
						}
					}
					this.state = 1074;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 119, this._ctx);
				}
				this.state = 1076;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1075;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1078;
				this.arrayType(0);
				this.state = 1082;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 121, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 121, this._ctx);
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
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1088;
				this.mappingType();
				this.state = 1092;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 123, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 123, this._ctx);
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
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1109;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1100;
				this.match(SolidCashParser.T__3);
				this.state = 1104;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
					{
					{
					this.state = 1101;
					this.statement();
					}
					}
					this.state = 1106;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1107;
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
				this.state = 1108;
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
			this.state = 1143;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 128, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1111;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1112;
				this.variableDefinition();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1113;
				this.tupleAssignment();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1114;
				this.arrayPushStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1115;
				this.arrayPopStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1116;
				this.arrayDeleteStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1117;
				this.stateArrayPushStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1118;
				this.stateArrayPopStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1119;
				this.assignStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1120;
				this.assignmentStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1121;
				this.mappingDeleteStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1122;
				this.timeOpStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1123;
				this.requireStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1124;
				this.ifStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1125;
				this.loopStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1126;
				this.consoleStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1127;
				this.emitStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1128;
				this.transferStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1129;
				this.tokenContainerMethodStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1130;
				this.returnStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1131;
				this.functionCallStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1132;
				this.addressMethodStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1133;
				this.selfdestructStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1134;
				this.assemblyStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1135;
				this.tryCatchStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1136;
				this.revertStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1137;
				this.assertStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1138;
				this.deleteStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1139;
				this.uncheckedStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1140;
				this.switchStatement();
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 31);
				{
				this.state = 1141;
				this.breakStatement();
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 32);
				{
				this.state = 1142;
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
			this.state = 1145;
			this.match(SolidCashParser.T__73);
			this.state = 1146;
			this.match(SolidCashParser.T__11);
			this.state = 1147;
			this.match(SolidCashParser.Identifier);
			this.state = 1148;
			this.match(SolidCashParser.T__48);
			this.state = 1149;
			this.expression(0);
			this.state = 1150;
			this.match(SolidCashParser.T__4);
			this.state = 1151;
			this.expression(0);
			this.state = 1152;
			this.match(SolidCashParser.T__49);
			this.state = 1153;
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
			this.state = 1155;
			this.match(SolidCashParser.T__73);
			this.state = 1156;
			this.match(SolidCashParser.T__11);
			this.state = 1157;
			this.match(SolidCashParser.Identifier);
			this.state = 1158;
			this.match(SolidCashParser.T__65);
			this.state = 1159;
			this.expression(0);
			this.state = 1160;
			this.match(SolidCashParser.T__66);
			this.state = 1161;
			this.match(SolidCashParser.T__11);
			this.state = 1162;
			this.match(SolidCashParser.Identifier);
			this.state = 1163;
			this.match(SolidCashParser.T__48);
			this.state = 1164;
			this.expression(0);
			this.state = 1169;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1165;
				this.match(SolidCashParser.T__4);
				this.state = 1166;
				this.expression(0);
				}
				}
				this.state = 1171;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1172;
			this.match(SolidCashParser.T__49);
			this.state = 1173;
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
			this.state = 1204;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 133, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1175;
				this.match(SolidCashParser.T__74);
				this.state = 1176;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1177;
				this.match(SolidCashParser.T__74);
				this.state = 1178;
				this.expression(0);
				this.state = 1183;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1179;
					this.match(SolidCashParser.T__4);
					this.state = 1180;
					this.expression(0);
					}
					}
					this.state = 1185;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1186;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1188;
				this.match(SolidCashParser.T__74);
				this.state = 1189;
				this.match(SolidCashParser.T__48);
				this.state = 1190;
				this.expression(0);
				this.state = 1195;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 131, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1191;
						this.match(SolidCashParser.T__4);
						this.state = 1192;
						this.expression(0);
						}
						}
					}
					this.state = 1197;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 131, this._ctx);
				}
				this.state = 1199;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1198;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1201;
				this.match(SolidCashParser.T__49);
				this.state = 1202;
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
			this.state = 1251;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 139, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1206;
				this.match(SolidCashParser.Identifier);
				this.state = 1209;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1207;
					this.match(SolidCashParser.T__11);
					this.state = 1208;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1211;
				this.match(SolidCashParser.T__48);
				this.state = 1212;
				this.match(SolidCashParser.T__3);
				this.state = 1224;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1213;
					this.namedArg();
					this.state = 1218;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 135, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1214;
							this.match(SolidCashParser.T__4);
							this.state = 1215;
							this.namedArg();
							}
							}
						}
						this.state = 1220;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 135, this._ctx);
					}
					this.state = 1222;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1221;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1226;
				this.match(SolidCashParser.T__5);
				this.state = 1227;
				this.match(SolidCashParser.T__49);
				this.state = 1228;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1229;
				this.match(SolidCashParser.Identifier);
				this.state = 1230;
				this.expressionList();
				this.state = 1231;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1233;
				this.match(SolidCashParser.Identifier);
				this.state = 1234;
				this.match(SolidCashParser.T__11);
				this.state = 1235;
				this.match(SolidCashParser.Identifier);
				this.state = 1236;
				this.expressionList();
				this.state = 1237;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1239;
				this.match(SolidCashParser.Identifier);
				this.state = 1240;
				this.expressionList();
				this.state = 1241;
				this.match(SolidCashParser.T__11);
				this.state = 1242;
				this.match(SolidCashParser.Identifier);
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
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1253;
			this.expression(0);
			this.state = 1254;
			this.match(SolidCashParser.T__11);
			this.state = 1255;
			this.match(SolidCashParser.Identifier);
			this.state = 1257;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===4) {
				{
				this.state = 1256;
				this.callOptions();
				}
			}

			this.state = 1259;
			this.expressionList();
			this.state = 1260;
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
			this.state = 1262;
			this.match(SolidCashParser.T__30);
			this.state = 1263;
			this.match(SolidCashParser.T__48);
			this.state = 1264;
			this.expression(0);
			this.state = 1265;
			this.match(SolidCashParser.T__49);
			this.state = 1266;
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
			this.state = 1301;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 146, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1268;
				this.match(SolidCashParser.T__75);
				this.state = 1269;
				this.match(SolidCashParser.Identifier);
				this.state = 1272;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1270;
					this.match(SolidCashParser.T__11);
					this.state = 1271;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1274;
				this.match(SolidCashParser.T__48);
				this.state = 1275;
				this.match(SolidCashParser.T__3);
				this.state = 1287;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1276;
					this.namedArg();
					this.state = 1281;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 142, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1277;
							this.match(SolidCashParser.T__4);
							this.state = 1278;
							this.namedArg();
							}
							}
						}
						this.state = 1283;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 142, this._ctx);
					}
					this.state = 1285;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1284;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1289;
				this.match(SolidCashParser.T__5);
				this.state = 1290;
				this.match(SolidCashParser.T__49);
				this.state = 1291;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1292;
				this.match(SolidCashParser.T__75);
				this.state = 1293;
				this.match(SolidCashParser.Identifier);
				this.state = 1296;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1294;
					this.match(SolidCashParser.T__11);
					this.state = 1295;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1298;
				this.expressionList();
				this.state = 1299;
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
			this.state = 1421;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 161, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1303;
				this.match(SolidCashParser.T__73);
				this.state = 1304;
				this.match(SolidCashParser.T__11);
				this.state = 1305;
				this.match(SolidCashParser.Identifier);
				this.state = 1314;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===66) {
					{
					this.state = 1310;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1306;
						this.match(SolidCashParser.T__65);
						this.state = 1307;
						this.expression(0);
						this.state = 1308;
						this.match(SolidCashParser.T__66);
						}
						}
						this.state = 1312;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===66);
					}
				}

				this.state = 1319;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12 || _la===163) {
					{
					{
					this.state = 1316;
					this.lvMember();
					}
					}
					this.state = 1321;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1322;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1323;
				this.expression(0);
				this.state = 1324;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
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
				this.state = 1338;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12 || _la===163) {
					{
					{
					this.state = 1335;
					this.lvMember();
					}
					}
					this.state = 1340;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1341;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1342;
				this.expression(0);
				this.state = 1343;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1345;
				this.match(SolidCashParser.Identifier);
				this.state = 1347;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1346;
					this.lvMember();
					}
					}
					this.state = 1349;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12 || _la===163);
				this.state = 1351;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1352;
				this.expression(0);
				this.state = 1353;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1355;
				this.match(SolidCashParser.Identifier);
				this.state = 1357;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1356;
					this.lvMember();
					}
					}
					this.state = 1359;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12 || _la===163);
				this.state = 1365;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1361;
					this.match(SolidCashParser.T__65);
					this.state = 1362;
					this.expression(0);
					this.state = 1363;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1367;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1369;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1370;
				this.expression(0);
				this.state = 1371;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1373;
				this.match(SolidCashParser.T__73);
				this.state = 1374;
				this.match(SolidCashParser.T__11);
				this.state = 1375;
				this.match(SolidCashParser.Identifier);
				this.state = 1384;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===66) {
					{
					this.state = 1380;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1376;
						this.match(SolidCashParser.T__65);
						this.state = 1377;
						this.expression(0);
						this.state = 1378;
						this.match(SolidCashParser.T__66);
						}
						}
						this.state = 1382;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===66);
					}
				}

				this.state = 1389;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12 || _la===163) {
					{
					{
					this.state = 1386;
					this.lvMember();
					}
					}
					this.state = 1391;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1392;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1393;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1394;
				this.match(SolidCashParser.Identifier);
				this.state = 1399;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1395;
					this.match(SolidCashParser.T__65);
					this.state = 1396;
					this.expression(0);
					this.state = 1397;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1401;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1406;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12 || _la===163) {
					{
					{
					this.state = 1403;
					this.lvMember();
					}
					}
					this.state = 1408;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1409;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1410;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1412;
				this.match(SolidCashParser.Identifier);
				this.state = 1414;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1413;
					this.lvMember();
					}
					}
					this.state = 1416;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12 || _la===163);
				this.state = 1418;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1419;
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
			this.state = 1426;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1423;
				this.match(SolidCashParser.T__11);
				this.state = 1424;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1425;
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
			this.state = 1428;
			this.match(SolidCashParser.T__73);
			this.state = 1429;
			this.match(SolidCashParser.T__11);
			this.state = 1430;
			this.match(SolidCashParser.Identifier);
			this.state = 1437;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===66) {
				{
				{
				this.state = 1431;
				this.match(SolidCashParser.T__65);
				this.state = 1432;
				this.expression(0);
				this.state = 1433;
				this.match(SolidCashParser.T__66);
				}
				}
				this.state = 1439;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1440;
			this.match(SolidCashParser.DotDelete);
			this.state = 1441;
			this.match(SolidCashParser.T__48);
			this.state = 1442;
			this.expression(0);
			this.state = 1443;
			this.match(SolidCashParser.T__49);
			this.state = 1444;
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
			this.state = 1474;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 168, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1446;
				this.typeName();
				this.state = 1450;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 164, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1447;
						this.modifier();
						}
						}
					}
					this.state = 1452;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 164, this._ctx);
				}
				this.state = 1453;
				this.anyIdentifier();
				this.state = 1456;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1454;
					this.match(SolidCashParser.T__39);
					this.state = 1455;
					this.expression(0);
					}
				}

				this.state = 1458;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1460;
				this.arrayType(0);
				this.state = 1464;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1461;
						this.modifier();
						}
						}
					}
					this.state = 1466;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
				}
				this.state = 1467;
				this.anyIdentifier();
				this.state = 1470;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1468;
					this.match(SolidCashParser.T__39);
					this.state = 1469;
					this.expression(0);
					}
				}

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
	public tupleAssignment(): TupleAssignmentContext {
		let localctx: TupleAssignmentContext = new TupleAssignmentContext(this, this._ctx, this.state);
		this.enterRule(localctx, 134, SolidCashParser.RULE_tupleAssignment);
		let _la: number;
		try {
			this.state = 1524;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 173, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1476;
				this.typeName();
				this.state = 1477;
				this.match(SolidCashParser.Identifier);
				this.state = 1482;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1478;
					this.match(SolidCashParser.T__4);
					this.state = 1479;
					this.typeName();
					this.state = 1480;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1484;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1486;
				this.match(SolidCashParser.T__39);
				this.state = 1487;
				this.expression(0);
				this.state = 1488;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1490;
				this.match(SolidCashParser.T__48);
				this.state = 1491;
				this.tupleSlot();
				this.state = 1494;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1492;
					this.match(SolidCashParser.T__4);
					this.state = 1493;
					this.tupleSlot();
					}
					}
					this.state = 1496;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1498;
				this.match(SolidCashParser.T__49);
				this.state = 1499;
				this.match(SolidCashParser.T__39);
				this.state = 1500;
				this.match(SolidCashParser.T__48);
				this.state = 1501;
				this.expression(0);
				this.state = 1504;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1502;
					this.match(SolidCashParser.T__4);
					this.state = 1503;
					this.expression(0);
					}
					}
					this.state = 1506;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1508;
				this.match(SolidCashParser.T__49);
				this.state = 1509;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1511;
				this.match(SolidCashParser.T__48);
				this.state = 1512;
				this.tupleSlot();
				this.state = 1515;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1513;
					this.match(SolidCashParser.T__4);
					this.state = 1514;
					this.tupleSlot();
					}
					}
					this.state = 1517;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1519;
				this.match(SolidCashParser.T__49);
				this.state = 1520;
				this.match(SolidCashParser.T__39);
				this.state = 1521;
				this.expression(0);
				this.state = 1522;
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
			this.state = 1537;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 175, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1526;
				this.typeName();
				this.state = 1530;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 174, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1527;
						this.modifier();
						}
						}
					}
					this.state = 1532;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 174, this._ctx);
				}
				this.state = 1533;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1535;
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
			this.state = 1550;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 176, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1539;
				this.match(SolidCashParser.Identifier);
				this.state = 1540;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1541;
				this.expression(0);
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
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1546;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
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
				this.match(SolidCashParser.Identifier);
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
	public arrayPushStatement(): ArrayPushStatementContext {
		let localctx: ArrayPushStatementContext = new ArrayPushStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 140, SolidCashParser.RULE_arrayPushStatement);
		let _la: number;
		try {
			this.state = 1583;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 178, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1552;
				this.match(SolidCashParser.Identifier);
				this.state = 1553;
				this.match(SolidCashParser.DotPush);
				this.state = 1554;
				this.match(SolidCashParser.T__48);
				this.state = 1555;
				this.expression(0);
				this.state = 1556;
				this.match(SolidCashParser.T__49);
				this.state = 1557;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1559;
				this.match(SolidCashParser.Identifier);
				this.state = 1560;
				this.match(SolidCashParser.T__11);
				this.state = 1561;
				this.match(SolidCashParser.Identifier);
				this.state = 1562;
				this.match(SolidCashParser.DotPush);
				this.state = 1563;
				this.match(SolidCashParser.T__48);
				this.state = 1564;
				this.expression(0);
				this.state = 1565;
				this.match(SolidCashParser.T__49);
				this.state = 1566;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1568;
				this.match(SolidCashParser.Identifier);
				this.state = 1573;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1569;
					this.match(SolidCashParser.T__65);
					this.state = 1570;
					this.expression(0);
					this.state = 1571;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1575;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
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
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		let _la: number;
		try {
			this.state = 1611;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 180, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
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
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1590;
				this.match(SolidCashParser.Identifier);
				this.state = 1591;
				this.match(SolidCashParser.T__11);
				this.state = 1592;
				this.match(SolidCashParser.Identifier);
				this.state = 1593;
				this.match(SolidCashParser.DotPop);
				this.state = 1594;
				this.match(SolidCashParser.T__48);
				this.state = 1595;
				this.match(SolidCashParser.T__49);
				this.state = 1596;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1597;
				this.match(SolidCashParser.Identifier);
				this.state = 1602;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1598;
					this.match(SolidCashParser.T__65);
					this.state = 1599;
					this.expression(0);
					this.state = 1600;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1604;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1606;
				this.match(SolidCashParser.DotPop);
				this.state = 1607;
				this.match(SolidCashParser.T__48);
				this.state = 1608;
				this.match(SolidCashParser.T__49);
				this.state = 1609;
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
			this.state = 1613;
			this.match(SolidCashParser.Identifier);
			this.state = 1614;
			this.match(SolidCashParser.DotDelete);
			this.state = 1615;
			this.match(SolidCashParser.T__48);
			this.state = 1616;
			this.expression(0);
			this.state = 1617;
			this.match(SolidCashParser.T__49);
			this.state = 1618;
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
		let _la: number;
		try {
			this.state = 1657;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 182, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1620;
				this.match(SolidCashParser.T__73);
				this.state = 1621;
				this.match(SolidCashParser.T__11);
				this.state = 1622;
				this.match(SolidCashParser.Identifier);
				this.state = 1623;
				this.match(SolidCashParser.DotPush);
				this.state = 1624;
				this.match(SolidCashParser.T__48);
				this.state = 1625;
				this.expression(0);
				this.state = 1626;
				this.match(SolidCashParser.T__49);
				this.state = 1627;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1629;
				this.match(SolidCashParser.T__73);
				this.state = 1630;
				this.match(SolidCashParser.T__11);
				this.state = 1631;
				this.match(SolidCashParser.Identifier);
				this.state = 1636;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1632;
					this.match(SolidCashParser.T__65);
					this.state = 1633;
					this.expression(0);
					this.state = 1634;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1638;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1640;
				this.match(SolidCashParser.DotPush);
				this.state = 1641;
				this.match(SolidCashParser.T__48);
				this.state = 1642;
				this.expression(0);
				this.state = 1643;
				this.match(SolidCashParser.T__49);
				this.state = 1644;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1646;
				this.match(SolidCashParser.T__73);
				this.state = 1647;
				this.match(SolidCashParser.T__11);
				this.state = 1648;
				this.match(SolidCashParser.Identifier);
				this.state = 1649;
				this.match(SolidCashParser.T__11);
				this.state = 1650;
				this.match(SolidCashParser.Identifier);
				this.state = 1651;
				this.match(SolidCashParser.DotPush);
				this.state = 1652;
				this.match(SolidCashParser.T__48);
				this.state = 1653;
				this.expression(0);
				this.state = 1654;
				this.match(SolidCashParser.T__49);
				this.state = 1655;
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
		this.enterRule(localctx, 148, SolidCashParser.RULE_stateArrayPopStatement);
		let _la: number;
		try {
			this.state = 1691;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 184, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1659;
				this.match(SolidCashParser.T__73);
				this.state = 1660;
				this.match(SolidCashParser.T__11);
				this.state = 1661;
				this.match(SolidCashParser.Identifier);
				this.state = 1662;
				this.match(SolidCashParser.DotPop);
				this.state = 1663;
				this.match(SolidCashParser.T__48);
				this.state = 1664;
				this.match(SolidCashParser.T__49);
				this.state = 1665;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1666;
				this.match(SolidCashParser.T__73);
				this.state = 1667;
				this.match(SolidCashParser.T__11);
				this.state = 1668;
				this.match(SolidCashParser.Identifier);
				this.state = 1673;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1669;
					this.match(SolidCashParser.T__65);
					this.state = 1670;
					this.expression(0);
					this.state = 1671;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1675;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1677;
				this.match(SolidCashParser.DotPop);
				this.state = 1678;
				this.match(SolidCashParser.T__48);
				this.state = 1679;
				this.match(SolidCashParser.T__49);
				this.state = 1680;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1682;
				this.match(SolidCashParser.T__73);
				this.state = 1683;
				this.match(SolidCashParser.T__11);
				this.state = 1684;
				this.match(SolidCashParser.Identifier);
				this.state = 1685;
				this.match(SolidCashParser.T__11);
				this.state = 1686;
				this.match(SolidCashParser.Identifier);
				this.state = 1687;
				this.match(SolidCashParser.DotPop);
				this.state = 1688;
				this.match(SolidCashParser.T__48);
				this.state = 1689;
				this.match(SolidCashParser.T__49);
				this.state = 1690;
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
		this.enterRule(localctx, 150, SolidCashParser.RULE_deleteStatement);
		let _la: number;
		try {
			this.state = 1745;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 189, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1693;
				this.match(SolidCashParser.T__88);
				this.state = 1694;
				this.match(SolidCashParser.Identifier);
				this.state = 1695;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1696;
				this.match(SolidCashParser.T__88);
				this.state = 1697;
				this.match(SolidCashParser.T__73);
				this.state = 1698;
				this.match(SolidCashParser.T__11);
				this.state = 1699;
				this.match(SolidCashParser.Identifier);
				this.state = 1700;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1701;
				this.match(SolidCashParser.T__88);
				this.state = 1702;
				this.match(SolidCashParser.T__73);
				this.state = 1703;
				this.match(SolidCashParser.T__11);
				this.state = 1704;
				this.match(SolidCashParser.Identifier);
				this.state = 1709;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1705;
					this.match(SolidCashParser.T__65);
					this.state = 1706;
					this.expression(0);
					this.state = 1707;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1711;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1713;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1715;
				this.match(SolidCashParser.T__88);
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
			case 5:
				localctx = new DeleteMemberEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1727;
				this.match(SolidCashParser.T__88);
				this.state = 1728;
				this.match(SolidCashParser.Identifier);
				this.state = 1731;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1729;
					this.match(SolidCashParser.T__11);
					this.state = 1730;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1733;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1739;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1735;
					this.match(SolidCashParser.T__65);
					this.state = 1736;
					this.expression(0);
					this.state = 1737;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1741;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1743;
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
			this.state = 1747;
			this.match(SolidCashParser.T__89);
			this.state = 1748;
			this.match(SolidCashParser.T__48);
			this.state = 1749;
			this.match(SolidCashParser.TxVar);
			this.state = 1750;
			this.match(SolidCashParser.T__22);
			this.state = 1751;
			this.expression(0);
			this.state = 1754;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1752;
				this.match(SolidCashParser.T__4);
				this.state = 1753;
				this.requireMessage();
				}
			}

			this.state = 1756;
			this.match(SolidCashParser.T__49);
			this.state = 1757;
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
			this.state = 1759;
			this.match(SolidCashParser.T__89);
			this.state = 1760;
			this.match(SolidCashParser.T__48);
			this.state = 1761;
			this.expression(0);
			this.state = 1764;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1762;
				this.match(SolidCashParser.T__4);
				this.state = 1763;
				this.requireMessage();
				}
			}

			this.state = 1766;
			this.match(SolidCashParser.T__49);
			this.state = 1767;
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
			this.state = 1769;
			this.match(SolidCashParser.T__90);
			this.state = 1770;
			this.match(SolidCashParser.T__48);
			this.state = 1771;
			this.expression(0);
			this.state = 1772;
			this.match(SolidCashParser.T__49);
			this.state = 1773;
			localctx._ifBlock = this.block();
			this.state = 1776;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 192, this._ctx) ) {
			case 1:
				{
				this.state = 1774;
				this.match(SolidCashParser.T__91);
				this.state = 1775;
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
			this.state = 1784;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 193, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1778;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1779;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1780;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1781;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1782;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1783;
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
			this.state = 1786;
			this.match(SolidCashParser.T__8);
			this.state = 1787;
			this.match(SolidCashParser.T__48);
			this.state = 1788;
			this.typeName();
			this.state = 1789;
			this.match(SolidCashParser.Identifier);
			this.state = 1790;
			this.match(SolidCashParser.T__4);
			this.state = 1791;
			this.typeName();
			this.state = 1792;
			this.match(SolidCashParser.Identifier);
			this.state = 1793;
			this.match(SolidCashParser.T__92);
			this.state = 1794;
			this.match(SolidCashParser.T__73);
			this.state = 1795;
			this.match(SolidCashParser.T__11);
			this.state = 1796;
			this.match(SolidCashParser.Identifier);
			this.state = 1797;
			this.match(SolidCashParser.T__11);
			this.state = 1798;
			this.match(SolidCashParser.T__33);
			this.state = 1799;
			this.match(SolidCashParser.T__49);
			this.state = 1800;
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
			this.state = 1802;
			this.match(SolidCashParser.T__8);
			this.state = 1803;
			this.match(SolidCashParser.T__48);
			this.state = 1804;
			this.typeName();
			this.state = 1805;
			this.match(SolidCashParser.Identifier);
			this.state = 1806;
			this.match(SolidCashParser.T__93);
			this.state = 1807;
			this.match(SolidCashParser.T__73);
			this.state = 1808;
			this.match(SolidCashParser.T__11);
			this.state = 1809;
			this.match(SolidCashParser.Identifier);
			this.state = 1810;
			this.match(SolidCashParser.T__49);
			this.state = 1811;
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
			this.state = 1813;
			this.match(SolidCashParser.T__8);
			this.state = 1814;
			this.match(SolidCashParser.T__48);
			this.state = 1815;
			this.typeName();
			this.state = 1816;
			this.match(SolidCashParser.Identifier);
			this.state = 1817;
			this.match(SolidCashParser.T__92);
			this.state = 1818;
			this.match(SolidCashParser.T__73);
			this.state = 1819;
			this.match(SolidCashParser.T__11);
			this.state = 1820;
			this.match(SolidCashParser.Identifier);
			this.state = 1821;
			this.match(SolidCashParser.T__49);
			this.state = 1822;
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
			this.state = 1824;
			this.match(SolidCashParser.T__8);
			this.state = 1825;
			this.match(SolidCashParser.T__48);
			this.state = 1826;
			this.forInit();
			this.state = 1827;
			this.forCondition();
			this.state = 1829;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===87 || _la===88 || _la===180) {
				{
				this.state = 1828;
				this.forUpdate();
				}
			}

			this.state = 1831;
			this.match(SolidCashParser.T__49);
			this.state = 1832;
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
			this.state = 1854;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 197, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1834;
				this.typeName();
				this.state = 1838;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 1835;
					this.modifier();
					}
					}
					this.state = 1840;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1841;
				this.match(SolidCashParser.Identifier);
				this.state = 1844;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1842;
					this.match(SolidCashParser.T__39);
					this.state = 1843;
					this.expression(0);
					}
				}

				this.state = 1846;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1848;
				this.match(SolidCashParser.Identifier);
				this.state = 1849;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1850;
				this.expression(0);
				this.state = 1851;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1853;
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
		this.enterRule(localctx, 170, SolidCashParser.RULE_forCondition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1856;
			this.expression(0);
			this.state = 1857;
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
			this.state = 1866;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 198, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1859;
				this.match(SolidCashParser.Identifier);
				this.state = 1860;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1861;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1862;
				this.match(SolidCashParser.Identifier);
				this.state = 1863;
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
				this.state = 1864;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1865;
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
			this.state = 1868;
			this.match(SolidCashParser.T__94);
			this.state = 1869;
			this.block();
			this.state = 1870;
			this.match(SolidCashParser.T__95);
			this.state = 1871;
			this.match(SolidCashParser.T__48);
			this.state = 1872;
			this.expression(0);
			this.state = 1873;
			this.match(SolidCashParser.T__49);
			this.state = 1874;
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
			this.state = 1876;
			this.match(SolidCashParser.T__95);
			this.state = 1877;
			this.match(SolidCashParser.T__48);
			this.state = 1878;
			this.expression(0);
			this.state = 1879;
			this.match(SolidCashParser.T__49);
			this.state = 1880;
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
			this.state = 1882;
			this.match(SolidCashParser.T__96);
			this.state = 1883;
			this.consoleParameterList();
			this.state = 1884;
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
			this.state = 1886;
			this.match(SolidCashParser.T__97);
			this.state = 1887;
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
			this.state = 1889;
			this.match(SolidCashParser.T__3);
			this.state = 1893;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026534544) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 31) !== 0) || ((((_la - 75)) & ~0x1F) === 0 && ((1 << (_la - 75)) & 788594689) !== 0) || _la===108 || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				{
				this.state = 1890;
				this.yulStatement();
				}
				}
				this.state = 1895;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1896;
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
			this.state = 1911;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 200, this._ctx) ) {
			case 1:
				localctx = new YulNestedBlockStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1898;
				this.yulBlock();
				}
				break;
			case 2:
				localctx = new YulVarDeclStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1899;
				this.yulVariableDeclaration();
				}
				break;
			case 3:
				localctx = new YulAssignStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1900;
				this.yulAssignment();
				}
				break;
			case 4:
				localctx = new YulIfStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1901;
				this.yulIf();
				}
				break;
			case 5:
				localctx = new YulSwitchStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1902;
				this.yulSwitch();
				}
				break;
			case 6:
				localctx = new YulForStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1903;
				this.yulForLoop();
				}
				break;
			case 7:
				localctx = new YulFunctionDefStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1904;
				this.yulFunctionDefinition();
				}
				break;
			case 8:
				localctx = new YulBreakStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1905;
				this.match(SolidCashParser.T__98);
				}
				break;
			case 9:
				localctx = new YulContinueStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1906;
				this.match(SolidCashParser.T__99);
				}
				break;
			case 10:
				localctx = new YulLeaveStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1907;
				this.match(SolidCashParser.T__100);
				}
				break;
			case 11:
				localctx = new YulCallStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1908;
				this.yulFunctionCall();
				}
				break;
			case 12:
				localctx = new YulPathStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1909;
				this.yulPath();
				}
				break;
			case 13:
				localctx = new YulLiteralStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1910;
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
			this.state = 1913;
			this.match(SolidCashParser.T__101);
			this.state = 1914;
			this.anyIdentifier();
			this.state = 1919;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1915;
				this.match(SolidCashParser.T__4);
				this.state = 1916;
				this.anyIdentifier();
				}
				}
				this.state = 1921;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1924;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===103) {
				{
				this.state = 1922;
				this.match(SolidCashParser.T__102);
				this.state = 1923;
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
			this.state = 1926;
			this.yulPath();
			this.state = 1931;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1927;
				this.match(SolidCashParser.T__4);
				this.state = 1928;
				this.yulPath();
				}
				}
				this.state = 1933;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1934;
			this.match(SolidCashParser.T__102);
			this.state = 1935;
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
			this.state = 1937;
			this.match(SolidCashParser.T__90);
			this.state = 1938;
			this.yulExpression();
			this.state = 1939;
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
			this.state = 1941;
			this.match(SolidCashParser.T__103);
			this.state = 1942;
			this.yulExpression();
			this.state = 1952;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 105:
				{
				this.state = 1944;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1943;
					this.yulCase();
					}
					}
					this.state = 1946;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===105);
				this.state = 1949;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===106) {
					{
					this.state = 1948;
					this.yulDefault();
					}
				}

				}
				break;
			case 106:
				{
				this.state = 1951;
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
			this.state = 1954;
			this.match(SolidCashParser.T__104);
			this.state = 1955;
			this.yulLiteral();
			this.state = 1956;
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
			this.state = 1958;
			this.match(SolidCashParser.T__105);
			this.state = 1959;
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
			this.state = 1961;
			this.match(SolidCashParser.T__8);
			this.state = 1962;
			this.yulBlock();
			this.state = 1963;
			this.yulExpression();
			this.state = 1964;
			this.yulBlock();
			this.state = 1965;
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
			this.state = 1967;
			this.match(SolidCashParser.T__6);
			this.state = 1968;
			this.match(SolidCashParser.Identifier);
			this.state = 1969;
			this.match(SolidCashParser.T__48);
			this.state = 1978;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 1970;
				this.match(SolidCashParser.Identifier);
				this.state = 1975;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1971;
					this.match(SolidCashParser.T__4);
					this.state = 1972;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1977;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1980;
			this.match(SolidCashParser.T__49);
			this.state = 1990;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===107) {
				{
				this.state = 1981;
				this.match(SolidCashParser.T__106);
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
			this.state = 1997;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 211, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1994;
				this.yulFunctionCall();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1995;
				this.yulPath();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1996;
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
			this.state = 1999;
			this.yulFunctionName();
			this.state = 2000;
			this.match(SolidCashParser.T__48);
			this.state = 2009;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===75 || _la===108 || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				this.state = 2001;
				this.yulExpression();
				this.state = 2006;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 2002;
					this.match(SolidCashParser.T__4);
					this.state = 2003;
					this.yulExpression();
					}
					}
					this.state = 2008;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 2011;
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
			this.state = 2013;
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
			this.state = 2015;
			this.anyIdentifier();
			this.state = 2020;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===12) {
				{
				{
				this.state = 2016;
				this.match(SolidCashParser.T__11);
				this.state = 2017;
				this.anyIdentifier();
				}
				}
				this.state = 2022;
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
			this.state = 2023;
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
			this.state = 2025;
			this.match(SolidCashParser.T__108);
			this.state = 2026;
			this.match(SolidCashParser.T__3);
			this.state = 2030;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 2027;
				this.statement();
				}
				}
				this.state = 2032;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 2033;
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
			this.state = 2035;
			this.match(SolidCashParser.T__103);
			this.state = 2036;
			this.match(SolidCashParser.T__48);
			this.state = 2037;
			this.expression(0);
			this.state = 2038;
			this.match(SolidCashParser.T__49);
			this.state = 2039;
			this.match(SolidCashParser.T__3);
			this.state = 2043;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===105) {
				{
				{
				this.state = 2040;
				this.switchCase();
				}
				}
				this.state = 2045;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 2047;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===106) {
				{
				this.state = 2046;
				this.switchDefault();
				}
			}

			this.state = 2049;
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
			this.state = 2051;
			this.match(SolidCashParser.T__104);
			this.state = 2052;
			this.expression(0);
			this.state = 2053;
			this.match(SolidCashParser.T__109);
			this.state = 2057;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 2054;
				this.statement();
				}
				}
				this.state = 2059;
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
			this.state = 2060;
			this.match(SolidCashParser.T__105);
			this.state = 2061;
			this.match(SolidCashParser.T__109);
			this.state = 2065;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 2062;
				this.statement();
				}
				}
				this.state = 2067;
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
			this.state = 2068;
			this.match(SolidCashParser.T__110);
			this.state = 2069;
			this.expression(0);
			this.state = 2071;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 2070;
				this.tryReturns();
				}
			}

			this.state = 2073;
			localctx._tryBlock = this.block();
			this.state = 2075;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 2074;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 2077;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 221, this._ctx);
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
			this.state = 2079;
			this.match(SolidCashParser.T__72);
			this.state = 2080;
			this.match(SolidCashParser.T__48);
			this.state = 2092;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 2081;
				this.parameter();
				this.state = 2086;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 222, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2082;
						this.match(SolidCashParser.T__4);
						this.state = 2083;
						this.parameter();
						}
						}
					}
					this.state = 2088;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 222, this._ctx);
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
	public catchClause(): CatchClauseContext {
		let localctx: CatchClauseContext = new CatchClauseContext(this, this._ctx, this.state);
		this.enterRule(localctx, 224, SolidCashParser.RULE_catchClause);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2096;
			this.match(SolidCashParser.T__111);
			this.state = 2098;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 225, this._ctx) ) {
			case 1:
				{
				this.state = 2097;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 2115;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 229, this._ctx) ) {
			case 1:
				{
				this.state = 2100;
				this.match(SolidCashParser.T__48);
				this.state = 2112;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 2101;
					this.parameter();
					this.state = 2106;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 226, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2102;
							this.match(SolidCashParser.T__4);
							this.state = 2103;
							this.parameter();
							}
							}
						}
						this.state = 2108;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 226, this._ctx);
					}
					this.state = 2110;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2109;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2114;
				this.match(SolidCashParser.T__49);
				}
				break;
			}
			this.state = 2117;
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
			this.state = 2119;
			this.match(SolidCashParser.T__98);
			this.state = 2120;
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
			this.state = 2122;
			this.match(SolidCashParser.T__99);
			this.state = 2123;
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
			this.state = 2128;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 151:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2125;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 180:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2126;
				this.match(SolidCashParser.Identifier);
				this.state = 2127;
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
			this.state = 2172;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 236, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2130;
				this.match(SolidCashParser.T__35);
				this.state = 2131;
				this.match(SolidCashParser.Identifier);
				this.state = 2134;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 2132;
					this.match(SolidCashParser.T__11);
					this.state = 2133;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 2136;
				this.match(SolidCashParser.T__48);
				this.state = 2137;
				this.match(SolidCashParser.T__3);
				this.state = 2149;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2138;
					this.namedArg();
					this.state = 2143;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 232, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2139;
							this.match(SolidCashParser.T__4);
							this.state = 2140;
							this.namedArg();
							}
							}
						}
						this.state = 2145;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 232, this._ctx);
					}
					this.state = 2147;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2146;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2151;
				this.match(SolidCashParser.T__5);
				this.state = 2152;
				this.match(SolidCashParser.T__49);
				this.state = 2153;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2154;
				this.match(SolidCashParser.T__35);
				this.state = 2155;
				this.match(SolidCashParser.Identifier);
				this.state = 2158;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 2156;
					this.match(SolidCashParser.T__11);
					this.state = 2157;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 2160;
				this.expressionList();
				this.state = 2161;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2163;
				this.match(SolidCashParser.T__35);
				this.state = 2164;
				this.match(SolidCashParser.T__48);
				this.state = 2165;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2166;
				this.match(SolidCashParser.T__49);
				this.state = 2167;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2168;
				this.match(SolidCashParser.T__35);
				this.state = 2169;
				this.match(SolidCashParser.T__48);
				this.state = 2170;
				this.match(SolidCashParser.T__49);
				this.state = 2171;
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
			this.state = 2174;
			this.match(SolidCashParser.T__112);
			this.state = 2175;
			this.match(SolidCashParser.T__48);
			this.state = 2176;
			this.expression(0);
			this.state = 2177;
			this.match(SolidCashParser.T__49);
			this.state = 2178;
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
			this.state = 2182;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 180:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2180;
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
				this.state = 2181;
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
			this.state = 2184;
			this.match(SolidCashParser.T__48);
			this.state = 2196;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 3152921) !== 0) || _la===180) {
				{
				this.state = 2185;
				this.consoleParameter();
				this.state = 2190;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 238, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2186;
						this.match(SolidCashParser.T__4);
						this.state = 2187;
						this.consoleParameter();
						}
						}
					}
					this.state = 2192;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 238, this._ctx);
				}
				this.state = 2194;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2193;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2198;
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
			this.state = 2224;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 244, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2200;
				this.match(SolidCashParser.Identifier);
				this.state = 2201;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2202;
				this.match(SolidCashParser.Identifier);
				this.state = 2203;
				this.match(SolidCashParser.T__11);
				this.state = 2204;
				this.match(SolidCashParser.Identifier);
				this.state = 2205;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2206;
				this.match(SolidCashParser.Identifier);
				this.state = 2207;
				this.match(SolidCashParser.T__48);
				this.state = 2208;
				this.match(SolidCashParser.T__3);
				this.state = 2220;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2209;
					this.namedArg();
					this.state = 2214;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 241, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2210;
							this.match(SolidCashParser.T__4);
							this.state = 2211;
							this.namedArg();
							}
							}
						}
						this.state = 2216;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 241, this._ctx);
					}
					this.state = 2218;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2217;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2222;
				this.match(SolidCashParser.T__5);
				this.state = 2223;
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
			this.state = 2226;
			this.match(SolidCashParser.Identifier);
			this.state = 2227;
			this.match(SolidCashParser.T__109);
			this.state = 2228;
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
			this.state = 2230;
			this.match(SolidCashParser.T__48);
			this.state = 2242;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
				{
				this.state = 2231;
				this.expression(0);
				this.state = 2236;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 245, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 245, this._ctx);
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
			this.state = 2246;
			this.match(SolidCashParser.T__3);
			this.state = 2247;
			this.callOption();
			this.state = 2252;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 248, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2248;
					this.match(SolidCashParser.T__4);
					this.state = 2249;
					this.callOption();
					}
					}
				}
				this.state = 2254;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 248, this._ctx);
			}
			this.state = 2256;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2255;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 2258;
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
			this.state = 2260;
			this.match(SolidCashParser.Identifier);
			this.state = 2261;
			this.match(SolidCashParser.T__109);
			this.state = 2262;
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
			this.state = 2264;
			this.match(SolidCashParser.T__48);
			this.state = 2265;
			this.typeListItem();
			this.state = 2270;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 250, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2266;
					this.match(SolidCashParser.T__4);
					this.state = 2267;
					this.typeListItem();
					}
					}
				}
				this.state = 2272;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 250, this._ctx);
			}
			this.state = 2274;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2273;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 2276;
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
			this.state = 2280;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 252, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2278;
				this.typeName();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2279;
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
			this.state = 2437;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 261, this._ctx) ) {
			case 1:
				{
				localctx = new AssignmentExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 2283;
				this.match(SolidCashParser.T__48);
				this.state = 2284;
				this.match(SolidCashParser.Identifier);
				this.state = 2285;
				(localctx as AssignmentExpressionContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    (localctx as AssignmentExpressionContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2286;
				this.expression(0);
				this.state = 2287;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2289;
				this.match(SolidCashParser.T__48);
				this.state = 2290;
				this.expression(0);
				this.state = 2291;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				{
				localctx = new TupleExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2293;
				this.match(SolidCashParser.T__48);
				this.state = 2294;
				this.expression(0);
				this.state = 2297;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2295;
					this.match(SolidCashParser.T__4);
					this.state = 2296;
					this.expression(0);
					}
					}
					this.state = 2299;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2301;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 4:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2303;
				this.typeCast();
				this.state = 2304;
				this.match(SolidCashParser.T__48);
				this.state = 2305;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 2307;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2306;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 2309;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 5:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2311;
				this.functionCall();
				}
				break;
			case 6:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2312;
				this.match(SolidCashParser.T__113);
				this.state = 2313;
				this.match(SolidCashParser.Identifier);
				this.state = 2315;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 2314;
					this.callOptions();
					}
				}

				this.state = 2317;
				this.expressionList();
				}
				break;
			case 7:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2318;
				this.match(SolidCashParser.T__113);
				this.state = 2319;
				this.typeName();
				this.state = 2322;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2320;
					this.match(SolidCashParser.T__65);
					this.state = 2321;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 2324;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 2326;
				this.match(SolidCashParser.T__48);
				this.state = 2327;
				this.expression(0);
				this.state = 2328;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 8:
				{
				localctx = new NewDynamicBytesContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2330;
				this.match(SolidCashParser.T__113);
				this.state = 2331;
				this.match(SolidCashParser.UnboundedBytes);
				this.state = 2332;
				this.match(SolidCashParser.T__48);
				this.state = 2333;
				this.expression(0);
				this.state = 2334;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 9:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2336;
				this.match(SolidCashParser.T__54);
				this.state = 2337;
				this.match(SolidCashParser.T__48);
				this.state = 2338;
				this.typeName();
				this.state = 2339;
				this.match(SolidCashParser.T__49);
				this.state = 2340;
				this.match(SolidCashParser.T__11);
				this.state = 2341;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 10:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2343;
				this.match(SolidCashParser.T__114);
				this.state = 2344;
				this.expressionList();
				}
				break;
			case 11:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2345;
				this.match(SolidCashParser.T__115);
				this.state = 2346;
				this.expressionList();
				}
				break;
			case 12:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2347;
				this.match(SolidCashParser.T__116);
				this.state = 2348;
				this.expressionList();
				}
				break;
			case 13:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2349;
				this.match(SolidCashParser.T__117);
				this.state = 2350;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2351;
				this.match(SolidCashParser.T__118);
				this.state = 2352;
				this.match(SolidCashParser.T__48);
				this.state = 2353;
				this.match(SolidCashParser.Identifier);
				this.state = 2354;
				this.match(SolidCashParser.T__11);
				this.state = 2355;
				this.match(SolidCashParser.Identifier);
				this.state = 2356;
				this.match(SolidCashParser.T__4);
				this.state = 2357;
				this.expressionList();
				this.state = 2358;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 15:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2360;
				this.match(SolidCashParser.T__119);
				this.state = 2361;
				this.expressionList();
				}
				break;
			case 16:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2362;
				this.match(SolidCashParser.T__120);
				this.state = 2363;
				this.expressionList();
				}
				break;
			case 17:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2364;
				this.match(SolidCashParser.T__121);
				this.state = 2365;
				this.match(SolidCashParser.T__48);
				this.state = 2366;
				this.expression(0);
				this.state = 2367;
				this.match(SolidCashParser.T__4);
				this.state = 2368;
				this.typeList();
				this.state = 2369;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 18:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2371;
				this.match(SolidCashParser.T__122);
				this.state = 2372;
				this.match(SolidCashParser.T__48);
				this.state = 2373;
				this.expression(0);
				this.state = 2374;
				this.match(SolidCashParser.T__4);
				this.state = 2375;
				this.typeList();
				this.state = 2376;
				this.match(SolidCashParser.T__4);
				this.state = 2377;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 2378;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 19:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2380;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__123);
				this.state = 2381;
				this.match(SolidCashParser.T__65);
				this.state = 2382;
				this.expression(0);
				this.state = 2383;
				this.match(SolidCashParser.T__66);
				this.state = 2384;
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
				this.state = 2386;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__124);
				this.state = 2387;
				this.match(SolidCashParser.T__65);
				this.state = 2388;
				this.expression(0);
				this.state = 2389;
				this.match(SolidCashParser.T__66);
				this.state = 2390;
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
				this.state = 2392;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===127)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2393;
				this.expression(21);
				}
				break;
			case 22:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2394;
				this.match(SolidCashParser.T__65);
				this.state = 2406;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 2395;
					this.expression(0);
					this.state = 2400;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 257, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2396;
							this.match(SolidCashParser.T__4);
							this.state = 2397;
							this.expression(0);
							}
							}
						}
						this.state = 2402;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 257, this._ctx);
					}
					this.state = 2404;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2403;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2408;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 23:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2409;
				this.match(SolidCashParser.T__73);
				this.state = 2410;
				this.match(SolidCashParser.T__11);
				this.state = 2411;
				this.match(SolidCashParser.Identifier);
				this.state = 2412;
				this.match(SolidCashParser.T__11);
				this.state = 2413;
				this.match(SolidCashParser.Identifier);
				this.state = 2414;
				this.match(SolidCashParser.T__65);
				this.state = 2415;
				this.expression(0);
				this.state = 2416;
				this.match(SolidCashParser.T__66);
				this.state = 2417;
				this.memberName();
				}
				break;
			case 24:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2419;
				this.match(SolidCashParser.T__73);
				this.state = 2420;
				this.match(SolidCashParser.T__11);
				this.state = 2421;
				this.match(SolidCashParser.Identifier);
				this.state = 2426;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2422;
						this.match(SolidCashParser.T__65);
						this.state = 2423;
						this.expression(0);
						this.state = 2424;
						this.match(SolidCashParser.T__66);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2428;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 260, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 25:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2430;
				this.match(SolidCashParser.T__73);
				this.state = 2431;
				this.match(SolidCashParser.T__11);
				this.state = 2432;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 26:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2433;
				this.match(SolidCashParser.T__73);
				}
				break;
			case 27:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2434;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 28:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2435;
				this.anyIdentifier();
				}
				break;
			case 29:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2436;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2546;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 268, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2544;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 267, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2439;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 2440;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 2441;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2442;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 2443;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2444;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2445;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 2446;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2447;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2448;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 2449;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===128 || _la===129)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2450;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2451;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 2452;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2453;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2454;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2455;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2456;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2457;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2458;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2459;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2460;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2461;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2462;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2463;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2464;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2465;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2466;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2467;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__129);
						this.state = 2468;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2469;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2470;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__130);
						this.state = 2471;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2472;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 2473;
						this.match(SolidCashParser.T__131);
						this.state = 2474;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 2475;
						this.match(SolidCashParser.T__109);
						this.state = 2476;
						(localctx as TernaryOpContext)._ifFalse = this.expression(9);
						}
						break;
					case 13:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2478;
						if (!(this.precpred(this._ctx, 33))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 33)");
						}
						this.state = 2479;
						this.match(SolidCashParser.T__65);
						this.state = 2480;
						(localctx as IndexRangeSliceContext)._start = this.expression(0);
						this.state = 2481;
						this.match(SolidCashParser.T__109);
						this.state = 2482;
						(localctx as IndexRangeSliceContext)._end = this.expression(0);
						this.state = 2483;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 14:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2485;
						if (!(this.precpred(this._ctx, 32))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 32)");
						}
						this.state = 2486;
						this.match(SolidCashParser.T__65);
						this.state = 2487;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2488;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 15:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2489;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 2490;
						this.match(SolidCashParser.T__65);
						this.state = 2491;
						this.expression(0);
						this.state = 2492;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 16:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2494;
						if (!(this.precpred(this._ctx, 28))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 28)");
						}
						this.state = 2495;
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
						this.state = 2496;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2497;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.DotSplit);
						this.state = 2498;
						this.match(SolidCashParser.T__48);
						this.state = 2499;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2500;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 18:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2502;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2503;
						this.match(SolidCashParser.DotSlice);
						this.state = 2504;
						this.match(SolidCashParser.T__48);
						this.state = 2505;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2506;
						this.match(SolidCashParser.T__4);
						this.state = 2507;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2508;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2510;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2511;
						this.match(SolidCashParser.T__11);
						this.state = 2512;
						this.match(SolidCashParser.Identifier);
						this.state = 2514;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2513;
							this.callOptions();
							}
						}

						this.state = 2516;
						this.match(SolidCashParser.T__48);
						this.state = 2517;
						this.match(SolidCashParser.T__3);
						this.state = 2529;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===180) {
							{
							this.state = 2518;
							this.namedArg();
							this.state = 2523;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 263, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2519;
									this.match(SolidCashParser.T__4);
									this.state = 2520;
									this.namedArg();
									}
									}
								}
								this.state = 2525;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 263, this._ctx);
							}
							this.state = 2527;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2526;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2531;
						this.match(SolidCashParser.T__5);
						this.state = 2532;
						this.match(SolidCashParser.T__49);
						}
						break;
					case 20:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2533;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2534;
						this.match(SolidCashParser.T__11);
						this.state = 2535;
						this.match(SolidCashParser.Identifier);
						this.state = 2537;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2536;
							this.callOptions();
							}
						}

						this.state = 2539;
						this.expressionList();
						}
						break;
					case 21:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2540;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2541;
						this.memberName();
						}
						break;
					case 22:
						{
						localctx = new PostfixOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2542;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 2543;
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
				this.state = 2548;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 268, this._ctx);
			}
			}
		}
		catch (re) {
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
			this.state = 2562;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2549;
				this.match(SolidCashParser.T__11);
				this.state = 2550;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2551;
				this.match(SolidCashParser.DotValue);
				}
				break;
			case 172:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2552;
				this.match(SolidCashParser.DotLockingBytecode);
				}
				break;
			case 173:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2553;
				this.match(SolidCashParser.DotTokenCategory);
				}
				break;
			case 174:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2554;
				this.match(SolidCashParser.DotNftCommitment);
				}
				break;
			case 175:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2555;
				this.match(SolidCashParser.DotTokenAmount);
				}
				break;
			case 176:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2556;
				this.match(SolidCashParser.DotOutpointTransactionHash);
				}
				break;
			case 177:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2557;
				this.match(SolidCashParser.DotOutpointIndex);
				}
				break;
			case 178:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2558;
				this.match(SolidCashParser.DotUnlockingBytecode);
				}
				break;
			case 179:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2559;
				this.match(SolidCashParser.DotSequenceNumber);
				}
				break;
			case 170:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2560;
				this.match(SolidCashParser.DotCode);
				}
				break;
			case 171:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2561;
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
			this.state = 2564;
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
			this.state = 2580;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 141:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2566;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 145:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2567;
				this.numberLiteral();
				}
				break;
			case 144:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2568;
				this.decimalLiteral();
				}
				break;
			case 151:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2569;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2573;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 270, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2570;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2575;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 270, this._ctx);
				}
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2576;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2577;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 152:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2578;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 153:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2579;
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
			this.state = 2582;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2584;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 272, this._ctx) ) {
			case 1:
				{
				this.state = 2583;
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
			this.state = 2586;
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
			this.state = 2638;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 278, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2588;
				this.match(SolidCashParser.T__107);
				this.state = 2589;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2590;
				this.match(SolidCashParser.T__107);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2591;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2592;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2593;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2594;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2595;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2596;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2597;
				this.match(SolidCashParser.T__137);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2598;
				this.match(SolidCashParser.T__138);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2599;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2600;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2601;
				this.match(SolidCashParser.T__6);
				this.state = 2602;
				this.match(SolidCashParser.T__48);
				this.state = 2611;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 2603;
					this.typeName();
					this.state = 2608;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2604;
						this.match(SolidCashParser.T__4);
						this.state = 2605;
						this.typeName();
						}
						}
						this.state = 2610;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2613;
				this.match(SolidCashParser.T__49);
				this.state = 2617;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===70 || _la===71) {
					{
					{
					this.state = 2614;
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
					this.state = 2619;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 2632;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===73) {
					{
					this.state = 2620;
					this.match(SolidCashParser.T__72);
					this.state = 2621;
					this.match(SolidCashParser.T__48);
					this.state = 2622;
					this.typeName();
					this.state = 2627;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2623;
						this.match(SolidCashParser.T__4);
						this.state = 2624;
						this.typeName();
						}
						}
						this.state = 2629;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2630;
					this.match(SolidCashParser.T__49);
					}
				}

				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2634;
				this.match(SolidCashParser.Identifier);
				this.state = 2635;
				this.match(SolidCashParser.T__11);
				this.state = 2636;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 2637;
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
			this.state = 2640;
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

	public static readonly _serializedATN: number[] = [4,1,183,2643,2,0,7,0,
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
	3,5,400,8,5,1,6,1,6,1,7,1,7,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,5,8,414,8,8,
	10,8,12,8,417,9,8,1,8,3,8,420,8,8,1,9,1,9,1,10,4,10,425,8,10,11,10,12,10,
	426,1,10,3,10,430,8,10,1,11,3,11,433,8,11,1,11,1,11,1,12,1,12,1,13,1,13,
	1,13,1,13,1,13,1,13,5,13,445,8,13,10,13,12,13,448,9,13,3,13,450,8,13,1,
	13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,5,13,461,8,13,10,13,12,13,464,
	9,13,1,13,1,13,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,3,14,478,
	8,14,1,15,1,15,1,15,1,15,1,15,1,16,1,16,1,17,1,17,1,17,1,17,5,17,491,8,
	17,10,17,12,17,494,9,17,1,17,3,17,497,8,17,1,17,1,17,1,18,1,18,1,18,1,18,
	5,18,505,8,18,10,18,12,18,508,9,18,1,18,5,18,511,8,18,10,18,12,18,514,9,
	18,1,18,5,18,517,8,18,10,18,12,18,520,9,18,1,18,5,18,523,8,18,10,18,12,
	18,526,9,18,1,18,5,18,529,8,18,10,18,12,18,532,9,18,1,18,5,18,535,8,18,
	10,18,12,18,538,9,18,1,18,5,18,541,8,18,10,18,12,18,544,9,18,1,18,5,18,
	547,8,18,10,18,12,18,550,9,18,1,18,5,18,553,8,18,10,18,12,18,556,9,18,1,
	18,1,18,1,19,3,19,561,8,19,1,19,1,19,1,19,3,19,566,8,19,1,19,1,19,1,19,
	1,19,5,19,572,8,19,10,19,12,19,575,9,19,3,19,577,8,19,1,19,1,19,1,19,1,
	19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,5,19,594,8,19,
	10,19,12,19,597,9,19,1,19,1,19,1,20,1,20,3,20,603,8,20,1,21,1,21,1,21,1,
	21,1,21,5,21,610,8,21,10,21,12,21,613,9,21,1,21,3,21,616,8,21,1,21,1,21,
	1,22,1,22,1,22,1,22,1,22,1,22,5,22,626,8,22,10,22,12,22,629,9,22,1,22,3,
	22,632,8,22,3,22,634,8,22,1,22,1,22,3,22,638,8,22,1,22,1,22,1,23,1,23,3,
	23,644,8,23,1,23,3,23,647,8,23,1,23,3,23,650,8,23,1,24,1,24,1,24,1,24,1,
	24,1,24,5,24,658,8,24,10,24,12,24,661,9,24,1,24,3,24,664,8,24,3,24,666,
	8,24,1,24,1,24,1,24,1,25,1,25,3,25,673,8,25,1,26,1,26,1,26,1,26,4,26,679,
	8,26,11,26,12,26,680,1,26,1,26,1,27,1,27,1,27,3,27,688,8,27,1,27,1,27,1,
	27,1,28,1,28,1,28,1,28,1,28,1,28,5,28,699,8,28,10,28,12,28,702,9,28,1,28,
	3,28,705,8,28,1,28,1,28,1,29,1,29,1,29,3,29,712,8,29,1,30,1,30,1,30,1,30,
	1,30,1,30,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,32,1,32,1,32,5,32,730,8,
	32,10,32,12,32,733,9,32,1,32,5,32,736,8,32,10,32,12,32,739,9,32,1,32,1,
	32,5,32,743,8,32,10,32,12,32,746,9,32,1,32,1,32,1,33,1,33,1,33,1,33,5,33,
	754,8,33,10,33,12,33,757,9,33,1,33,5,33,760,8,33,10,33,12,33,763,9,33,1,
	33,1,33,5,33,767,8,33,10,33,12,33,770,9,33,1,33,1,33,1,34,1,34,1,34,3,34,
	777,8,34,1,35,1,35,1,35,1,35,1,35,1,35,1,35,5,35,786,8,35,10,35,12,35,789,
	9,35,1,35,1,35,1,36,1,36,1,36,1,37,3,37,797,8,37,1,37,1,37,5,37,801,8,37,
	10,37,12,37,804,9,37,1,37,1,37,1,37,3,37,809,8,37,1,37,1,37,1,37,1,37,5,
	37,815,8,37,10,37,12,37,818,9,37,1,37,1,37,5,37,822,8,37,10,37,12,37,825,
	9,37,1,37,1,37,1,37,3,37,830,8,37,1,37,1,37,1,37,3,37,835,8,37,1,37,1,37,
	5,37,839,8,37,10,37,12,37,842,9,37,1,37,1,37,1,37,1,37,3,37,848,8,37,1,
	37,1,37,5,37,852,8,37,10,37,12,37,855,9,37,1,37,1,37,1,37,3,37,860,8,37,
	1,37,1,37,3,37,864,8,37,1,38,1,38,3,38,868,8,38,1,39,1,39,1,40,1,40,1,40,
	1,40,3,40,876,8,40,1,40,1,40,1,40,3,40,881,8,40,1,40,1,40,1,40,1,40,1,40,
	1,40,3,40,889,8,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,3,40,899,8,40,
	1,40,1,40,1,40,3,40,904,8,40,1,40,1,40,3,40,908,8,40,1,41,1,41,1,41,1,41,
	1,41,1,41,1,41,1,41,1,41,1,41,3,41,920,8,41,1,41,1,41,1,41,1,41,1,41,1,
	41,1,41,5,41,929,8,41,10,41,12,41,932,9,41,1,42,1,42,1,42,3,42,937,8,42,
	1,42,1,42,5,42,941,8,42,10,42,12,42,944,9,42,1,42,1,42,1,43,1,43,3,43,950,
	8,43,1,44,1,44,1,44,1,45,1,45,1,45,1,45,1,45,5,45,960,8,45,10,45,12,45,
	963,9,45,1,45,3,45,966,8,45,1,45,1,45,5,45,970,8,45,10,45,12,45,973,9,45,
	1,45,1,45,1,46,1,46,3,46,979,8,46,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,
	47,1,47,1,47,1,47,1,47,1,47,1,47,3,47,995,8,47,1,48,1,48,1,48,1,48,1,48,
	5,48,1002,8,48,10,48,12,48,1005,9,48,1,48,3,48,1008,8,48,1,49,1,49,1,49,
	1,49,3,49,1014,8,49,1,50,1,50,1,50,1,50,1,50,5,50,1021,8,50,10,50,12,50,
	1024,9,50,1,50,3,50,1027,8,50,1,50,1,50,1,51,1,51,5,51,1033,8,51,10,51,
	12,51,1036,9,51,1,51,3,51,1039,8,51,1,51,1,51,5,51,1043,8,51,10,51,12,51,
	1046,9,51,1,51,3,51,1049,8,51,3,51,1051,8,51,1,52,1,52,1,52,1,52,5,52,1057,
	8,52,10,52,12,52,1060,9,52,1,52,3,52,1063,8,52,3,52,1065,8,52,1,52,1,52,
	1,53,1,53,5,53,1071,8,53,10,53,12,53,1074,9,53,1,53,3,53,1077,8,53,1,53,
	1,53,5,53,1081,8,53,10,53,12,53,1084,9,53,1,53,3,53,1087,8,53,1,53,1,53,
	5,53,1091,8,53,10,53,12,53,1094,9,53,1,53,3,53,1097,8,53,3,53,1099,8,53,
	1,54,1,54,5,54,1103,8,54,10,54,12,54,1106,9,54,1,54,1,54,3,54,1110,8,54,
	1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,
	55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,
	1,55,1,55,1,55,3,55,1144,8,55,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,
	56,1,56,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,5,57,
	1168,8,57,10,57,12,57,1171,9,57,1,57,1,57,1,57,1,58,1,58,1,58,1,58,1,58,
	1,58,5,58,1182,8,58,10,58,12,58,1185,9,58,1,58,1,58,1,58,1,58,1,58,1,58,
	1,58,5,58,1194,8,58,10,58,12,58,1197,9,58,1,58,3,58,1200,8,58,1,58,1,58,
	1,58,3,58,1205,8,58,1,59,1,59,1,59,3,59,1210,8,59,1,59,1,59,1,59,1,59,1,
	59,5,59,1217,8,59,10,59,12,59,1220,9,59,1,59,3,59,1223,8,59,3,59,1225,8,
	59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,
	1,59,1,59,1,59,1,59,1,59,1,59,3,59,1247,8,59,1,59,1,59,1,59,3,59,1252,8,
	59,1,60,1,60,1,60,1,60,3,60,1258,8,60,1,60,1,60,1,60,1,61,1,61,1,61,1,61,
	1,61,1,61,1,62,1,62,1,62,1,62,3,62,1273,8,62,1,62,1,62,1,62,1,62,1,62,5,
	62,1280,8,62,10,62,12,62,1283,9,62,1,62,3,62,1286,8,62,3,62,1288,8,62,1,
	62,1,62,1,62,1,62,1,62,1,62,1,62,3,62,1297,8,62,1,62,1,62,1,62,3,62,1302,
	8,62,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1311,8,63,11,63,12,63,1312,
	3,63,1315,8,63,1,63,5,63,1318,8,63,10,63,12,63,1321,9,63,1,63,1,63,1,63,
	1,63,1,63,1,63,1,63,1,63,1,63,4,63,1332,8,63,11,63,12,63,1333,1,63,5,63,
	1337,8,63,10,63,12,63,1340,9,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1348,
	8,63,11,63,12,63,1349,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1358,8,63,11,63,
	12,63,1359,1,63,1,63,1,63,1,63,4,63,1366,8,63,11,63,12,63,1367,1,63,1,63,
	1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,4,63,1381,8,63,11,63,12,63,
	1382,3,63,1385,8,63,1,63,5,63,1388,8,63,10,63,12,63,1391,9,63,1,63,1,63,
	1,63,1,63,1,63,1,63,1,63,4,63,1400,8,63,11,63,12,63,1401,1,63,5,63,1405,
	8,63,10,63,12,63,1408,9,63,1,63,1,63,1,63,1,63,1,63,4,63,1415,8,63,11,63,
	12,63,1416,1,63,1,63,1,63,3,63,1422,8,63,1,64,1,64,1,64,3,64,1427,8,64,
	1,65,1,65,1,65,1,65,1,65,1,65,1,65,5,65,1436,8,65,10,65,12,65,1439,9,65,
	1,65,1,65,1,65,1,65,1,65,1,65,1,66,1,66,5,66,1449,8,66,10,66,12,66,1452,
	9,66,1,66,1,66,1,66,3,66,1457,8,66,1,66,1,66,1,66,1,66,5,66,1463,8,66,10,
	66,12,66,1466,9,66,1,66,1,66,1,66,3,66,1471,8,66,1,66,1,66,3,66,1475,8,
	66,1,67,1,67,1,67,1,67,1,67,1,67,4,67,1483,8,67,11,67,12,67,1484,1,67,1,
	67,1,67,1,67,1,67,1,67,1,67,1,67,4,67,1495,8,67,11,67,12,67,1496,1,67,1,
	67,1,67,1,67,1,67,1,67,4,67,1505,8,67,11,67,12,67,1506,1,67,1,67,1,67,1,
	67,1,67,1,67,1,67,4,67,1516,8,67,11,67,12,67,1517,1,67,1,67,1,67,1,67,1,
	67,3,67,1525,8,67,1,68,1,68,5,68,1529,8,68,10,68,12,68,1532,9,68,1,68,1,
	68,1,68,1,68,3,68,1538,8,68,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,
	1,69,1,69,3,69,1551,8,69,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,
	70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,4,70,1574,8,70,
	11,70,12,70,1575,1,70,1,70,1,70,1,70,1,70,1,70,3,70,1584,8,70,1,71,1,71,
	1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,1,
	71,4,71,1603,8,71,11,71,12,71,1604,1,71,1,71,1,71,1,71,1,71,3,71,1612,8,
	71,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,73,1,73,1,73,1,73,1,73,1,73,1,73,
	1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,4,73,1637,8,73,11,73,12,73,
	1638,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,
	73,1,73,1,73,1,73,3,73,1658,8,73,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,
	1,74,1,74,1,74,1,74,1,74,1,74,4,74,1674,8,74,11,74,12,74,1675,1,74,1,74,
	1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,3,74,1692,8,
	74,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,
	1,75,1,75,4,75,1710,8,75,11,75,12,75,1711,1,75,1,75,1,75,1,75,1,75,1,75,
	1,75,1,75,4,75,1722,8,75,11,75,12,75,1723,1,75,1,75,1,75,1,75,1,75,1,75,
	4,75,1732,8,75,11,75,12,75,1733,1,75,1,75,1,75,1,75,4,75,1740,8,75,11,75,
	12,75,1741,1,75,1,75,3,75,1746,8,75,1,76,1,76,1,76,1,76,1,76,1,76,1,76,
	3,76,1755,8,76,1,76,1,76,1,76,1,77,1,77,1,77,1,77,1,77,3,77,1765,8,77,1,
	77,1,77,1,77,1,78,1,78,1,78,1,78,1,78,1,78,1,78,3,78,1777,8,78,1,79,1,79,
	1,79,1,79,1,79,1,79,3,79,1785,8,79,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,
	80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,81,1,81,1,81,1,81,1,81,1,81,
	1,81,1,81,1,81,1,81,1,81,1,82,1,82,1,82,1,82,1,82,1,82,1,82,1,82,1,82,1,
	82,1,82,1,83,1,83,1,83,1,83,1,83,3,83,1830,8,83,1,83,1,83,1,83,1,84,1,84,
	5,84,1837,8,84,10,84,12,84,1840,9,84,1,84,1,84,1,84,3,84,1845,8,84,1,84,
	1,84,1,84,1,84,1,84,1,84,1,84,1,84,3,84,1855,8,84,1,85,1,85,1,85,1,86,1,
	86,1,86,1,86,1,86,1,86,1,86,3,86,1867,8,86,1,87,1,87,1,87,1,87,1,87,1,87,
	1,87,1,87,1,88,1,88,1,88,1,88,1,88,1,88,1,89,1,89,1,89,1,89,1,90,1,90,1,
	90,1,91,1,91,5,91,1892,8,91,10,91,12,91,1895,9,91,1,91,1,91,1,92,1,92,1,
	92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,3,92,1912,8,92,1,93,
	1,93,1,93,1,93,5,93,1918,8,93,10,93,12,93,1921,9,93,1,93,1,93,3,93,1925,
	8,93,1,94,1,94,1,94,5,94,1930,8,94,10,94,12,94,1933,9,94,1,94,1,94,1,94,
	1,95,1,95,1,95,1,95,1,96,1,96,1,96,4,96,1945,8,96,11,96,12,96,1946,1,96,
	3,96,1950,8,96,1,96,3,96,1953,8,96,1,97,1,97,1,97,1,97,1,98,1,98,1,98,1,
	99,1,99,1,99,1,99,1,99,1,99,1,100,1,100,1,100,1,100,1,100,1,100,5,100,1974,
	8,100,10,100,12,100,1977,9,100,3,100,1979,8,100,1,100,1,100,1,100,1,100,
	1,100,5,100,1986,8,100,10,100,12,100,1989,9,100,3,100,1991,8,100,1,100,
	1,100,1,101,1,101,1,101,3,101,1998,8,101,1,102,1,102,1,102,1,102,1,102,
	5,102,2005,8,102,10,102,12,102,2008,9,102,3,102,2010,8,102,1,102,1,102,
	1,103,1,103,1,104,1,104,1,104,5,104,2019,8,104,10,104,12,104,2022,9,104,
	1,105,1,105,1,106,1,106,1,106,5,106,2029,8,106,10,106,12,106,2032,9,106,
	1,106,1,106,1,107,1,107,1,107,1,107,1,107,1,107,5,107,2042,8,107,10,107,
	12,107,2045,9,107,1,107,3,107,2048,8,107,1,107,1,107,1,108,1,108,1,108,
	1,108,5,108,2056,8,108,10,108,12,108,2059,9,108,1,109,1,109,1,109,5,109,
	2064,8,109,10,109,12,109,2067,9,109,1,110,1,110,1,110,3,110,2072,8,110,
	1,110,1,110,4,110,2076,8,110,11,110,12,110,2077,1,111,1,111,1,111,1,111,
	1,111,5,111,2085,8,111,10,111,12,111,2088,9,111,1,111,3,111,2091,8,111,
	3,111,2093,8,111,1,111,1,111,1,112,1,112,3,112,2099,8,112,1,112,1,112,1,
	112,1,112,5,112,2105,8,112,10,112,12,112,2108,9,112,1,112,3,112,2111,8,
	112,3,112,2113,8,112,1,112,3,112,2116,8,112,1,112,1,112,1,113,1,113,1,113,
	1,114,1,114,1,114,1,115,1,115,1,115,3,115,2129,8,115,1,116,1,116,1,116,
	1,116,3,116,2135,8,116,1,116,1,116,1,116,1,116,1,116,5,116,2142,8,116,10,
	116,12,116,2145,9,116,1,116,3,116,2148,8,116,3,116,2150,8,116,1,116,1,116,
	1,116,1,116,1,116,1,116,1,116,3,116,2159,8,116,1,116,1,116,1,116,1,116,
	1,116,1,116,1,116,1,116,1,116,1,116,1,116,1,116,3,116,2173,8,116,1,117,
	1,117,1,117,1,117,1,117,1,117,1,118,1,118,3,118,2183,8,118,1,119,1,119,
	1,119,1,119,5,119,2189,8,119,10,119,12,119,2192,9,119,1,119,3,119,2195,
	8,119,3,119,2197,8,119,1,119,1,119,1,120,1,120,1,120,1,120,1,120,1,120,
	1,120,1,120,1,120,1,120,1,120,1,120,5,120,2213,8,120,10,120,12,120,2216,
	9,120,1,120,3,120,2219,8,120,3,120,2221,8,120,1,120,1,120,3,120,2225,8,
	120,1,121,1,121,1,121,1,121,1,122,1,122,1,122,1,122,5,122,2235,8,122,10,
	122,12,122,2238,9,122,1,122,3,122,2241,8,122,3,122,2243,8,122,1,122,1,122,
	1,123,1,123,1,123,1,123,5,123,2251,8,123,10,123,12,123,2254,9,123,1,123,
	3,123,2257,8,123,1,123,1,123,1,124,1,124,1,124,1,124,1,125,1,125,1,125,
	1,125,5,125,2269,8,125,10,125,12,125,2272,9,125,1,125,3,125,2275,8,125,
	1,125,1,125,1,126,1,126,3,126,2281,8,126,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,4,127,2298,
	8,127,11,127,12,127,2299,1,127,1,127,1,127,1,127,1,127,1,127,3,127,2308,
	8,127,1,127,1,127,1,127,1,127,1,127,1,127,3,127,2316,8,127,1,127,1,127,
	1,127,1,127,1,127,4,127,2323,8,127,11,127,12,127,2324,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,5,127,2399,8,127,
	10,127,12,127,2402,9,127,1,127,3,127,2405,8,127,3,127,2407,8,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,4,127,2427,8,127,11,127,12,127,2428,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,3,127,2438,8,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,
	3,127,2515,8,127,1,127,1,127,1,127,1,127,1,127,5,127,2522,8,127,10,127,
	12,127,2525,9,127,1,127,3,127,2528,8,127,3,127,2530,8,127,1,127,1,127,1,
	127,1,127,1,127,1,127,3,127,2538,8,127,1,127,1,127,1,127,1,127,1,127,5,
	127,2545,8,127,10,127,12,127,2548,9,127,1,128,1,128,1,128,1,128,1,128,1,
	128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,3,128,2563,8,128,1,129,1,
	129,1,130,1,130,1,130,1,130,1,130,5,130,2572,8,130,10,130,12,130,2575,9,
	130,1,130,1,130,1,130,1,130,3,130,2581,8,130,1,131,1,131,3,131,2585,8,131,
	1,132,1,132,1,133,1,133,1,133,1,133,1,133,1,133,1,133,1,133,1,133,1,133,
	1,133,1,133,1,133,1,133,1,133,1,133,1,133,1,133,5,133,2607,8,133,10,133,
	12,133,2610,9,133,3,133,2612,8,133,1,133,1,133,5,133,2616,8,133,10,133,
	12,133,2619,9,133,1,133,1,133,1,133,1,133,1,133,5,133,2626,8,133,10,133,
	12,133,2629,9,133,1,133,1,133,3,133,2633,8,133,1,133,1,133,1,133,1,133,
	3,133,2639,8,133,1,134,1,134,1,134,0,2,82,254,135,0,2,4,6,8,10,12,14,16,
	18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,
	66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,
	110,112,114,116,118,120,122,124,126,128,130,132,134,136,138,140,142,144,
	146,148,150,152,154,156,158,160,162,164,166,168,170,172,174,176,178,180,
	182,184,186,188,190,192,194,196,198,200,202,204,206,208,210,212,214,216,
	218,220,222,224,226,228,230,232,234,236,238,240,242,244,246,248,250,252,
	254,256,258,260,262,264,266,268,0,27,2,0,10,10,13,27,5,0,11,11,28,36,143,
	143,147,147,180,180,4,0,140,140,145,145,151,151,180,180,1,0,38,39,2,0,140,
	140,144,144,3,0,20,23,26,27,40,40,1,0,43,44,2,0,43,44,58,59,3,0,43,44,58,
	58,63,63,2,0,145,145,180,180,2,0,40,40,77,86,1,0,87,88,6,0,31,31,36,36,
	75,75,108,108,149,149,180,180,5,0,141,141,145,145,151,151,153,153,162,162,
	2,0,163,163,172,175,2,0,163,163,172,179,3,0,14,14,27,27,127,127,2,0,10,
	10,15,16,1,0,13,14,1,0,128,129,1,0,20,23,1,0,18,19,2,0,126,126,164,164,
	3,0,33,33,56,56,133,137,1,0,142,143,1,0,70,71,5,0,59,59,108,108,138,139,
	146,149,155,159,2978,0,273,1,0,0,0,2,325,1,0,0,0,4,327,1,0,0,0,6,332,1,
	0,0,0,8,390,1,0,0,0,10,392,1,0,0,0,12,401,1,0,0,0,14,403,1,0,0,0,16,419,
	1,0,0,0,18,421,1,0,0,0,20,429,1,0,0,0,22,432,1,0,0,0,24,436,1,0,0,0,26,
	438,1,0,0,0,28,477,1,0,0,0,30,479,1,0,0,0,32,484,1,0,0,0,34,486,1,0,0,0,
	36,500,1,0,0,0,38,560,1,0,0,0,40,600,1,0,0,0,42,604,1,0,0,0,44,619,1,0,
	0,0,46,643,1,0,0,0,48,651,1,0,0,0,50,670,1,0,0,0,52,674,1,0,0,0,54,687,
	1,0,0,0,56,692,1,0,0,0,58,708,1,0,0,0,60,713,1,0,0,0,62,719,1,0,0,0,64,
	726,1,0,0,0,66,749,1,0,0,0,68,776,1,0,0,0,70,778,1,0,0,0,72,792,1,0,0,0,
	74,863,1,0,0,0,76,867,1,0,0,0,78,869,1,0,0,0,80,907,1,0,0,0,82,919,1,0,
	0,0,84,933,1,0,0,0,86,949,1,0,0,0,88,951,1,0,0,0,90,954,1,0,0,0,92,976,
	1,0,0,0,94,994,1,0,0,0,96,996,1,0,0,0,98,1009,1,0,0,0,100,1015,1,0,0,0,
	102,1050,1,0,0,0,104,1052,1,0,0,0,106,1098,1,0,0,0,108,1109,1,0,0,0,110,
	1143,1,0,0,0,112,1145,1,0,0,0,114,1155,1,0,0,0,116,1204,1,0,0,0,118,1251,
	1,0,0,0,120,1253,1,0,0,0,122,1262,1,0,0,0,124,1301,1,0,0,0,126,1421,1,0,
	0,0,128,1426,1,0,0,0,130,1428,1,0,0,0,132,1474,1,0,0,0,134,1524,1,0,0,0,
	136,1537,1,0,0,0,138,1550,1,0,0,0,140,1583,1,0,0,0,142,1611,1,0,0,0,144,
	1613,1,0,0,0,146,1657,1,0,0,0,148,1691,1,0,0,0,150,1745,1,0,0,0,152,1747,
	1,0,0,0,154,1759,1,0,0,0,156,1769,1,0,0,0,158,1784,1,0,0,0,160,1786,1,0,
	0,0,162,1802,1,0,0,0,164,1813,1,0,0,0,166,1824,1,0,0,0,168,1854,1,0,0,0,
	170,1856,1,0,0,0,172,1866,1,0,0,0,174,1868,1,0,0,0,176,1876,1,0,0,0,178,
	1882,1,0,0,0,180,1886,1,0,0,0,182,1889,1,0,0,0,184,1911,1,0,0,0,186,1913,
	1,0,0,0,188,1926,1,0,0,0,190,1937,1,0,0,0,192,1941,1,0,0,0,194,1954,1,0,
	0,0,196,1958,1,0,0,0,198,1961,1,0,0,0,200,1967,1,0,0,0,202,1997,1,0,0,0,
	204,1999,1,0,0,0,206,2013,1,0,0,0,208,2015,1,0,0,0,210,2023,1,0,0,0,212,
	2025,1,0,0,0,214,2035,1,0,0,0,216,2051,1,0,0,0,218,2060,1,0,0,0,220,2068,
	1,0,0,0,222,2079,1,0,0,0,224,2096,1,0,0,0,226,2119,1,0,0,0,228,2122,1,0,
	0,0,230,2128,1,0,0,0,232,2172,1,0,0,0,234,2174,1,0,0,0,236,2182,1,0,0,0,
	238,2184,1,0,0,0,240,2224,1,0,0,0,242,2226,1,0,0,0,244,2230,1,0,0,0,246,
	2246,1,0,0,0,248,2260,1,0,0,0,250,2264,1,0,0,0,252,2280,1,0,0,0,254,2437,
	1,0,0,0,256,2562,1,0,0,0,258,2564,1,0,0,0,260,2580,1,0,0,0,262,2582,1,0,
	0,0,264,2586,1,0,0,0,266,2638,1,0,0,0,268,2640,1,0,0,0,270,272,3,16,8,0,
	271,270,1,0,0,0,272,275,1,0,0,0,273,271,1,0,0,0,273,274,1,0,0,0,274,279,
	1,0,0,0,275,273,1,0,0,0,276,278,3,2,1,0,277,276,1,0,0,0,278,281,1,0,0,0,
	279,277,1,0,0,0,279,280,1,0,0,0,280,294,1,0,0,0,281,279,1,0,0,0,282,293,
	3,62,31,0,283,293,3,56,28,0,284,293,3,52,26,0,285,293,3,60,30,0,286,293,
	3,8,4,0,287,293,3,48,24,0,288,293,3,26,13,0,289,293,3,6,3,0,290,293,3,36,
	18,0,291,293,3,38,19,0,292,282,1,0,0,0,292,283,1,0,0,0,292,284,1,0,0,0,
	292,285,1,0,0,0,292,286,1,0,0,0,292,287,1,0,0,0,292,288,1,0,0,0,292,289,
	1,0,0,0,292,290,1,0,0,0,292,291,1,0,0,0,293,296,1,0,0,0,294,292,1,0,0,0,
	294,295,1,0,0,0,295,297,1,0,0,0,296,294,1,0,0,0,297,298,5,0,0,1,298,1,1,
	0,0,0,299,300,5,1,0,0,300,301,5,151,0,0,301,326,5,2,0,0,302,303,5,1,0,0,
	303,304,5,151,0,0,304,305,5,3,0,0,305,306,5,180,0,0,306,326,5,2,0,0,307,
	308,5,1,0,0,308,309,5,4,0,0,309,314,3,4,2,0,310,311,5,5,0,0,311,313,3,4,
	2,0,312,310,1,0,0,0,313,316,1,0,0,0,314,312,1,0,0,0,314,315,1,0,0,0,315,
	318,1,0,0,0,316,314,1,0,0,0,317,319,5,5,0,0,318,317,1,0,0,0,318,319,1,0,
	0,0,319,320,1,0,0,0,320,321,5,6,0,0,321,322,5,180,0,0,322,323,5,151,0,0,
	323,324,5,2,0,0,324,326,1,0,0,0,325,299,1,0,0,0,325,302,1,0,0,0,325,307,
	1,0,0,0,326,3,1,0,0,0,327,330,5,180,0,0,328,329,5,3,0,0,329,331,5,180,0,
	0,330,328,1,0,0,0,330,331,1,0,0,0,331,5,1,0,0,0,332,333,5,7,0,0,333,334,
	3,14,7,0,334,338,3,104,52,0,335,337,3,94,47,0,336,335,1,0,0,0,337,340,1,
	0,0,0,338,336,1,0,0,0,338,339,1,0,0,0,339,342,1,0,0,0,340,338,1,0,0,0,341,
	343,3,100,50,0,342,341,1,0,0,0,342,343,1,0,0,0,343,344,1,0,0,0,344,348,
	5,4,0,0,345,347,3,110,55,0,346,345,1,0,0,0,347,350,1,0,0,0,348,346,1,0,
	0,0,348,349,1,0,0,0,349,351,1,0,0,0,350,348,1,0,0,0,351,352,5,6,0,0,352,
	7,1,0,0,0,353,354,5,8,0,0,354,355,5,180,0,0,355,359,5,9,0,0,356,360,3,82,
	41,0,357,360,3,266,133,0,358,360,5,10,0,0,359,356,1,0,0,0,359,357,1,0,0,
	0,359,358,1,0,0,0,360,362,1,0,0,0,361,363,5,11,0,0,362,361,1,0,0,0,362,
	363,1,0,0,0,363,364,1,0,0,0,364,391,5,2,0,0,365,366,5,8,0,0,366,367,5,4,
	0,0,367,372,3,10,5,0,368,369,5,5,0,0,369,371,3,10,5,0,370,368,1,0,0,0,371,
	374,1,0,0,0,372,370,1,0,0,0,372,373,1,0,0,0,373,376,1,0,0,0,374,372,1,0,
	0,0,375,377,5,5,0,0,376,375,1,0,0,0,376,377,1,0,0,0,377,378,1,0,0,0,378,
	379,5,6,0,0,379,383,5,9,0,0,380,384,3,82,41,0,381,384,3,266,133,0,382,384,
	5,10,0,0,383,380,1,0,0,0,383,381,1,0,0,0,383,382,1,0,0,0,384,386,1,0,0,
	0,385,387,5,11,0,0,386,385,1,0,0,0,386,387,1,0,0,0,387,388,1,0,0,0,388,
	389,5,2,0,0,389,391,1,0,0,0,390,353,1,0,0,0,390,365,1,0,0,0,391,9,1,0,0,
	0,392,395,5,180,0,0,393,394,5,12,0,0,394,396,5,180,0,0,395,393,1,0,0,0,
	395,396,1,0,0,0,396,399,1,0,0,0,397,398,5,3,0,0,398,400,3,12,6,0,399,397,
	1,0,0,0,399,400,1,0,0,0,400,11,1,0,0,0,401,402,7,0,0,0,402,13,1,0,0,0,403,
	404,7,1,0,0,404,15,1,0,0,0,405,406,5,37,0,0,406,407,3,18,9,0,407,408,3,
	20,10,0,408,409,5,2,0,0,409,420,1,0,0,0,410,411,5,37,0,0,411,415,5,180,
	0,0,412,414,7,2,0,0,413,412,1,0,0,0,414,417,1,0,0,0,415,413,1,0,0,0,415,
	416,1,0,0,0,416,418,1,0,0,0,417,415,1,0,0,0,418,420,5,2,0,0,419,405,1,0,
	0,0,419,410,1,0,0,0,420,17,1,0,0,0,421,422,7,3,0,0,422,19,1,0,0,0,423,425,
	3,22,11,0,424,423,1,0,0,0,425,426,1,0,0,0,426,424,1,0,0,0,426,427,1,0,0,
	0,427,430,1,0,0,0,428,430,5,10,0,0,429,424,1,0,0,0,429,428,1,0,0,0,430,
	21,1,0,0,0,431,433,3,24,12,0,432,431,1,0,0,0,432,433,1,0,0,0,433,434,1,
	0,0,0,434,435,7,4,0,0,435,23,1,0,0,0,436,437,7,5,0,0,437,25,1,0,0,0,438,
	439,5,41,0,0,439,449,5,180,0,0,440,441,5,42,0,0,441,446,5,180,0,0,442,443,
	5,5,0,0,443,445,5,180,0,0,444,442,1,0,0,0,445,448,1,0,0,0,446,444,1,0,0,
	0,446,447,1,0,0,0,447,450,1,0,0,0,448,446,1,0,0,0,449,440,1,0,0,0,449,450,
	1,0,0,0,450,451,1,0,0,0,451,462,5,4,0,0,452,461,3,56,28,0,453,461,3,52,
	26,0,454,461,3,60,30,0,455,461,3,44,22,0,456,461,3,48,24,0,457,461,3,30,
	15,0,458,461,3,28,14,0,459,461,3,34,17,0,460,452,1,0,0,0,460,453,1,0,0,
	0,460,454,1,0,0,0,460,455,1,0,0,0,460,456,1,0,0,0,460,457,1,0,0,0,460,458,
	1,0,0,0,460,459,1,0,0,0,461,464,1,0,0,0,462,460,1,0,0,0,462,463,1,0,0,0,
	463,465,1,0,0,0,464,462,1,0,0,0,465,466,5,6,0,0,466,27,1,0,0,0,467,468,
	3,32,16,0,468,469,3,80,40,0,469,470,5,180,0,0,470,471,5,2,0,0,471,478,1,
	0,0,0,472,473,3,32,16,0,473,474,3,82,41,0,474,475,5,180,0,0,475,476,5,2,
	0,0,476,478,1,0,0,0,477,467,1,0,0,0,477,472,1,0,0,0,478,29,1,0,0,0,479,
	480,3,32,16,0,480,481,3,266,133,0,481,482,5,180,0,0,482,483,5,2,0,0,483,
	31,1,0,0,0,484,485,7,6,0,0,485,33,1,0,0,0,486,487,5,7,0,0,487,488,5,180,
	0,0,488,492,3,104,52,0,489,491,3,94,47,0,490,489,1,0,0,0,491,494,1,0,0,
	0,492,490,1,0,0,0,492,493,1,0,0,0,493,496,1,0,0,0,494,492,1,0,0,0,495,497,
	3,100,50,0,496,495,1,0,0,0,496,497,1,0,0,0,497,498,1,0,0,0,498,499,5,2,
	0,0,499,35,1,0,0,0,500,501,5,45,0,0,501,502,5,180,0,0,502,506,5,4,0,0,503,
	505,3,56,28,0,504,503,1,0,0,0,505,508,1,0,0,0,506,504,1,0,0,0,506,507,1,
	0,0,0,507,512,1,0,0,0,508,506,1,0,0,0,509,511,3,52,26,0,510,509,1,0,0,0,
	511,514,1,0,0,0,512,510,1,0,0,0,512,513,1,0,0,0,513,518,1,0,0,0,514,512,
	1,0,0,0,515,517,3,60,30,0,516,515,1,0,0,0,517,520,1,0,0,0,518,516,1,0,0,
	0,518,519,1,0,0,0,519,524,1,0,0,0,520,518,1,0,0,0,521,523,3,44,22,0,522,
	521,1,0,0,0,523,526,1,0,0,0,524,522,1,0,0,0,524,525,1,0,0,0,525,530,1,0,
	0,0,526,524,1,0,0,0,527,529,3,48,24,0,528,527,1,0,0,0,529,532,1,0,0,0,530,
	528,1,0,0,0,530,531,1,0,0,0,531,536,1,0,0,0,532,530,1,0,0,0,533,535,3,62,
	31,0,534,533,1,0,0,0,535,538,1,0,0,0,536,534,1,0,0,0,536,537,1,0,0,0,537,
	542,1,0,0,0,538,536,1,0,0,0,539,541,3,74,37,0,540,539,1,0,0,0,541,544,1,
	0,0,0,542,540,1,0,0,0,542,543,1,0,0,0,543,548,1,0,0,0,544,542,1,0,0,0,545,
	547,3,8,4,0,546,545,1,0,0,0,547,550,1,0,0,0,548,546,1,0,0,0,548,549,1,0,
	0,0,549,554,1,0,0,0,550,548,1,0,0,0,551,553,3,6,3,0,552,551,1,0,0,0,553,
	556,1,0,0,0,554,552,1,0,0,0,554,555,1,0,0,0,555,557,1,0,0,0,556,554,1,0,
	0,0,557,558,5,6,0,0,558,37,1,0,0,0,559,561,5,46,0,0,560,559,1,0,0,0,560,
	561,1,0,0,0,561,562,1,0,0,0,562,563,5,47,0,0,563,565,5,180,0,0,564,566,
	3,104,52,0,565,564,1,0,0,0,565,566,1,0,0,0,566,576,1,0,0,0,567,568,5,42,
	0,0,568,573,3,40,20,0,569,570,5,5,0,0,570,572,3,40,20,0,571,569,1,0,0,0,
	572,575,1,0,0,0,573,571,1,0,0,0,573,574,1,0,0,0,574,577,1,0,0,0,575,573,
	1,0,0,0,576,567,1,0,0,0,576,577,1,0,0,0,577,578,1,0,0,0,578,595,5,4,0,0,
	579,594,3,56,28,0,580,594,3,52,26,0,581,594,3,60,30,0,582,594,3,44,22,0,
	583,594,3,48,24,0,584,594,3,62,31,0,585,594,3,8,4,0,586,594,3,74,37,0,587,
	594,3,84,42,0,588,594,3,64,32,0,589,594,3,90,45,0,590,594,3,42,21,0,591,
	594,3,66,33,0,592,594,3,70,35,0,593,579,1,0,0,0,593,580,1,0,0,0,593,581,
	1,0,0,0,593,582,1,0,0,0,593,583,1,0,0,0,593,584,1,0,0,0,593,585,1,0,0,0,
	593,586,1,0,0,0,593,587,1,0,0,0,593,588,1,0,0,0,593,589,1,0,0,0,593,590,
	1,0,0,0,593,591,1,0,0,0,593,592,1,0,0,0,594,597,1,0,0,0,595,593,1,0,0,0,
	595,596,1,0,0,0,596,598,1,0,0,0,597,595,1,0,0,0,598,599,5,6,0,0,599,39,
	1,0,0,0,600,602,5,180,0,0,601,603,3,244,122,0,602,601,1,0,0,0,602,603,1,
	0,0,0,603,41,1,0,0,0,604,605,5,7,0,0,605,606,3,14,7,0,606,611,3,104,52,
	0,607,610,3,94,47,0,608,610,3,92,46,0,609,607,1,0,0,0,609,608,1,0,0,0,610,
	613,1,0,0,0,611,609,1,0,0,0,611,612,1,0,0,0,612,615,1,0,0,0,613,611,1,0,
	0,0,614,616,3,100,50,0,615,614,1,0,0,0,615,616,1,0,0,0,616,617,1,0,0,0,
	617,618,5,2,0,0,618,43,1,0,0,0,619,620,5,48,0,0,620,621,5,180,0,0,621,633,
	5,49,0,0,622,627,3,46,23,0,623,624,5,5,0,0,624,626,3,46,23,0,625,623,1,
	0,0,0,626,629,1,0,0,0,627,625,1,0,0,0,627,628,1,0,0,0,628,631,1,0,0,0,629,
	627,1,0,0,0,630,632,5,5,0,0,631,630,1,0,0,0,631,632,1,0,0,0,632,634,1,0,
	0,0,633,622,1,0,0,0,633,634,1,0,0,0,634,635,1,0,0,0,635,637,5,50,0,0,636,
	638,5,51,0,0,637,636,1,0,0,0,637,638,1,0,0,0,638,639,1,0,0,0,639,640,5,
	2,0,0,640,45,1,0,0,0,641,644,3,266,133,0,642,644,3,82,41,0,643,641,1,0,
	0,0,643,642,1,0,0,0,644,646,1,0,0,0,645,647,5,52,0,0,646,645,1,0,0,0,646,
	647,1,0,0,0,647,649,1,0,0,0,648,650,5,180,0,0,649,648,1,0,0,0,649,650,1,
	0,0,0,650,47,1,0,0,0,651,652,5,35,0,0,652,653,5,180,0,0,653,665,5,49,0,
	0,654,659,3,50,25,0,655,656,5,5,0,0,656,658,3,50,25,0,657,655,1,0,0,0,658,
	661,1,0,0,0,659,657,1,0,0,0,659,660,1,0,0,0,660,663,1,0,0,0,661,659,1,0,
	0,0,662,664,5,5,0,0,663,662,1,0,0,0,663,664,1,0,0,0,664,666,1,0,0,0,665,
	654,1,0,0,0,665,666,1,0,0,0,666,667,1,0,0,0,667,668,5,50,0,0,668,669,5,
	2,0,0,669,49,1,0,0,0,670,672,3,266,133,0,671,673,5,180,0,0,672,671,1,0,
	0,0,672,673,1,0,0,0,673,51,1,0,0,0,674,675,5,53,0,0,675,676,5,180,0,0,676,
	678,5,4,0,0,677,679,3,54,27,0,678,677,1,0,0,0,679,680,1,0,0,0,680,678,1,
	0,0,0,680,681,1,0,0,0,681,682,1,0,0,0,682,683,5,6,0,0,683,53,1,0,0,0,684,
	688,3,266,133,0,685,688,3,82,41,0,686,688,3,80,40,0,687,684,1,0,0,0,687,
	685,1,0,0,0,687,686,1,0,0,0,688,689,1,0,0,0,689,690,3,14,7,0,690,691,5,
	2,0,0,691,55,1,0,0,0,692,693,5,54,0,0,693,694,5,180,0,0,694,695,5,4,0,0,
	695,700,3,58,29,0,696,697,5,5,0,0,697,699,3,58,29,0,698,696,1,0,0,0,699,
	702,1,0,0,0,700,698,1,0,0,0,700,701,1,0,0,0,701,704,1,0,0,0,702,700,1,0,
	0,0,703,705,5,5,0,0,704,703,1,0,0,0,704,705,1,0,0,0,705,706,1,0,0,0,706,
	707,5,6,0,0,707,57,1,0,0,0,708,711,5,180,0,0,709,710,5,40,0,0,710,712,5,
	145,0,0,711,709,1,0,0,0,711,712,1,0,0,0,712,59,1,0,0,0,713,714,5,55,0,0,
	714,715,5,180,0,0,715,716,5,42,0,0,716,717,3,266,133,0,717,718,5,2,0,0,
	718,61,1,0,0,0,719,720,3,266,133,0,720,721,5,56,0,0,721,722,5,180,0,0,722,
	723,5,40,0,0,723,724,3,254,127,0,724,725,5,2,0,0,725,63,1,0,0,0,726,727,
	5,57,0,0,727,731,3,104,52,0,728,730,7,7,0,0,729,728,1,0,0,0,730,733,1,0,
	0,0,731,729,1,0,0,0,731,732,1,0,0,0,732,737,1,0,0,0,733,731,1,0,0,0,734,
	736,3,72,36,0,735,734,1,0,0,0,736,739,1,0,0,0,737,735,1,0,0,0,737,738,1,
	0,0,0,738,740,1,0,0,0,739,737,1,0,0,0,740,744,5,4,0,0,741,743,3,110,55,
	0,742,741,1,0,0,0,743,746,1,0,0,0,744,742,1,0,0,0,744,745,1,0,0,0,745,747,
	1,0,0,0,746,744,1,0,0,0,747,748,5,6,0,0,748,65,1,0,0,0,749,750,5,60,0,0,
	750,751,3,104,52,0,751,755,5,44,0,0,752,754,3,68,34,0,753,752,1,0,0,0,754,
	757,1,0,0,0,755,753,1,0,0,0,755,756,1,0,0,0,756,761,1,0,0,0,757,755,1,0,
	0,0,758,760,3,92,46,0,759,758,1,0,0,0,760,763,1,0,0,0,761,759,1,0,0,0,761,
	762,1,0,0,0,762,764,1,0,0,0,763,761,1,0,0,0,764,768,5,4,0,0,765,767,3,110,
	55,0,766,765,1,0,0,0,767,770,1,0,0,0,768,766,1,0,0,0,768,769,1,0,0,0,769,
	771,1,0,0,0,770,768,1,0,0,0,771,772,5,6,0,0,772,67,1,0,0,0,773,777,5,59,
	0,0,774,777,5,61,0,0,775,777,3,96,48,0,776,773,1,0,0,0,776,774,1,0,0,0,
	776,775,1,0,0,0,777,69,1,0,0,0,778,779,5,62,0,0,779,780,5,49,0,0,780,781,
	5,50,0,0,781,782,5,44,0,0,782,783,5,59,0,0,783,787,5,4,0,0,784,786,3,110,
	55,0,785,784,1,0,0,0,786,789,1,0,0,0,787,785,1,0,0,0,787,788,1,0,0,0,788,
	790,1,0,0,0,789,787,1,0,0,0,790,791,5,6,0,0,791,71,1,0,0,0,792,793,5,180,
	0,0,793,794,3,244,122,0,794,73,1,0,0,0,795,797,3,78,39,0,796,795,1,0,0,
	0,796,797,1,0,0,0,797,798,1,0,0,0,798,802,3,266,133,0,799,801,3,258,129,
	0,800,799,1,0,0,0,801,804,1,0,0,0,802,800,1,0,0,0,802,803,1,0,0,0,803,805,
	1,0,0,0,804,802,1,0,0,0,805,808,5,180,0,0,806,807,5,40,0,0,807,809,3,254,
	127,0,808,806,1,0,0,0,808,809,1,0,0,0,809,810,1,0,0,0,810,811,5,2,0,0,811,
	864,1,0,0,0,812,816,3,266,133,0,813,815,3,258,129,0,814,813,1,0,0,0,815,
	818,1,0,0,0,816,814,1,0,0,0,816,817,1,0,0,0,817,819,1,0,0,0,818,816,1,0,
	0,0,819,823,3,78,39,0,820,822,3,258,129,0,821,820,1,0,0,0,822,825,1,0,0,
	0,823,821,1,0,0,0,823,824,1,0,0,0,824,826,1,0,0,0,825,823,1,0,0,0,826,829,
	5,180,0,0,827,828,5,40,0,0,828,830,3,254,127,0,829,827,1,0,0,0,829,830,
	1,0,0,0,830,831,1,0,0,0,831,832,5,2,0,0,832,864,1,0,0,0,833,835,3,78,39,
	0,834,833,1,0,0,0,834,835,1,0,0,0,835,836,1,0,0,0,836,840,3,80,40,0,837,
	839,3,76,38,0,838,837,1,0,0,0,839,842,1,0,0,0,840,838,1,0,0,0,840,841,1,
	0,0,0,841,843,1,0,0,0,842,840,1,0,0,0,843,844,5,180,0,0,844,845,5,2,0,0,
	845,864,1,0,0,0,846,848,3,78,39,0,847,846,1,0,0,0,847,848,1,0,0,0,848,849,
	1,0,0,0,849,853,3,82,41,0,850,852,3,76,38,0,851,850,1,0,0,0,852,855,1,0,
	0,0,853,851,1,0,0,0,853,854,1,0,0,0,854,856,1,0,0,0,855,853,1,0,0,0,856,
	859,5,180,0,0,857,858,5,40,0,0,858,860,3,254,127,0,859,857,1,0,0,0,859,
	860,1,0,0,0,860,861,1,0,0,0,861,862,5,2,0,0,862,864,1,0,0,0,863,796,1,0,
	0,0,863,812,1,0,0,0,863,834,1,0,0,0,863,847,1,0,0,0,864,75,1,0,0,0,865,
	868,3,258,129,0,866,868,3,78,39,0,867,865,1,0,0,0,867,866,1,0,0,0,868,77,
	1,0,0,0,869,870,7,8,0,0,870,79,1,0,0,0,871,872,5,64,0,0,872,873,5,49,0,
	0,873,875,3,266,133,0,874,876,5,180,0,0,875,874,1,0,0,0,875,876,1,0,0,0,
	876,877,1,0,0,0,877,878,5,65,0,0,878,880,3,266,133,0,879,881,5,180,0,0,
	880,879,1,0,0,0,880,881,1,0,0,0,881,882,1,0,0,0,882,883,5,50,0,0,883,908,
	1,0,0,0,884,885,5,64,0,0,885,886,5,49,0,0,886,888,3,266,133,0,887,889,5,
	180,0,0,888,887,1,0,0,0,888,889,1,0,0,0,889,890,1,0,0,0,890,891,5,65,0,
	0,891,892,3,80,40,0,892,893,5,50,0,0,893,908,1,0,0,0,894,895,5,64,0,0,895,
	896,5,49,0,0,896,898,3,266,133,0,897,899,5,180,0,0,898,897,1,0,0,0,898,
	899,1,0,0,0,899,900,1,0,0,0,900,901,5,65,0,0,901,903,3,82,41,0,902,904,
	5,180,0,0,903,902,1,0,0,0,903,904,1,0,0,0,904,905,1,0,0,0,905,906,5,50,
	0,0,906,908,1,0,0,0,907,871,1,0,0,0,907,884,1,0,0,0,907,894,1,0,0,0,908,
	81,1,0,0,0,909,910,6,41,-1,0,910,911,3,266,133,0,911,912,5,66,0,0,912,913,
	7,9,0,0,913,914,5,67,0,0,914,920,1,0,0,0,915,916,3,266,133,0,916,917,5,
	66,0,0,917,918,5,67,0,0,918,920,1,0,0,0,919,909,1,0,0,0,919,915,1,0,0,0,
	920,930,1,0,0,0,921,922,10,2,0,0,922,923,5,66,0,0,923,924,7,9,0,0,924,929,
	5,67,0,0,925,926,10,1,0,0,926,927,5,66,0,0,927,929,5,67,0,0,928,921,1,0,
	0,0,928,925,1,0,0,0,929,932,1,0,0,0,930,928,1,0,0,0,930,931,1,0,0,0,931,
	83,1,0,0,0,932,930,1,0,0,0,933,934,5,68,0,0,934,936,5,180,0,0,935,937,3,
	104,52,0,936,935,1,0,0,0,936,937,1,0,0,0,937,938,1,0,0,0,938,942,5,4,0,
	0,939,941,3,86,43,0,940,939,1,0,0,0,941,944,1,0,0,0,942,940,1,0,0,0,942,
	943,1,0,0,0,943,945,1,0,0,0,944,942,1,0,0,0,945,946,5,6,0,0,946,85,1,0,
	0,0,947,950,3,88,44,0,948,950,3,110,55,0,949,947,1,0,0,0,949,948,1,0,0,
	0,950,87,1,0,0,0,951,952,5,69,0,0,952,953,5,2,0,0,953,89,1,0,0,0,954,955,
	5,7,0,0,955,956,3,14,7,0,956,961,3,104,52,0,957,960,3,94,47,0,958,960,3,
	92,46,0,959,957,1,0,0,0,959,958,1,0,0,0,960,963,1,0,0,0,961,959,1,0,0,0,
	961,962,1,0,0,0,962,965,1,0,0,0,963,961,1,0,0,0,964,966,3,100,50,0,965,
	964,1,0,0,0,965,966,1,0,0,0,966,967,1,0,0,0,967,971,5,4,0,0,968,970,3,110,
	55,0,969,968,1,0,0,0,970,973,1,0,0,0,971,969,1,0,0,0,971,972,1,0,0,0,972,
	974,1,0,0,0,973,971,1,0,0,0,974,975,5,6,0,0,975,91,1,0,0,0,976,978,5,180,
	0,0,977,979,3,244,122,0,978,977,1,0,0,0,978,979,1,0,0,0,979,93,1,0,0,0,
	980,995,5,70,0,0,981,995,5,71,0,0,982,995,5,58,0,0,983,995,5,44,0,0,984,
	995,5,43,0,0,985,995,5,63,0,0,986,995,5,59,0,0,987,995,3,96,48,0,988,995,
	5,61,0,0,989,995,3,98,49,0,990,995,5,30,0,0,991,995,5,28,0,0,992,995,5,
	31,0,0,993,995,5,29,0,0,994,980,1,0,0,0,994,981,1,0,0,0,994,982,1,0,0,0,
	994,983,1,0,0,0,994,984,1,0,0,0,994,985,1,0,0,0,994,986,1,0,0,0,994,987,
	1,0,0,0,994,988,1,0,0,0,994,989,1,0,0,0,994,990,1,0,0,0,994,991,1,0,0,0,
	994,992,1,0,0,0,994,993,1,0,0,0,995,95,1,0,0,0,996,1007,5,72,0,0,997,998,
	5,49,0,0,998,1003,5,180,0,0,999,1000,5,5,0,0,1000,1002,5,180,0,0,1001,999,
	1,0,0,0,1002,1005,1,0,0,0,1003,1001,1,0,0,0,1003,1004,1,0,0,0,1004,1006,
	1,0,0,0,1005,1003,1,0,0,0,1006,1008,5,50,0,0,1007,997,1,0,0,0,1007,1008,
	1,0,0,0,1008,97,1,0,0,0,1009,1013,5,32,0,0,1010,1011,5,49,0,0,1011,1012,
	5,145,0,0,1012,1014,5,50,0,0,1013,1010,1,0,0,0,1013,1014,1,0,0,0,1014,99,
	1,0,0,0,1015,1016,5,73,0,0,1016,1017,5,49,0,0,1017,1022,3,102,51,0,1018,
	1019,5,5,0,0,1019,1021,3,102,51,0,1020,1018,1,0,0,0,1021,1024,1,0,0,0,1022,
	1020,1,0,0,0,1022,1023,1,0,0,0,1023,1026,1,0,0,0,1024,1022,1,0,0,0,1025,
	1027,5,5,0,0,1026,1025,1,0,0,0,1026,1027,1,0,0,0,1027,1028,1,0,0,0,1028,
	1029,5,50,0,0,1029,101,1,0,0,0,1030,1034,3,266,133,0,1031,1033,3,258,129,
	0,1032,1031,1,0,0,0,1033,1036,1,0,0,0,1034,1032,1,0,0,0,1034,1035,1,0,0,
	0,1035,1038,1,0,0,0,1036,1034,1,0,0,0,1037,1039,3,14,7,0,1038,1037,1,0,
	0,0,1038,1039,1,0,0,0,1039,1051,1,0,0,0,1040,1044,3,82,41,0,1041,1043,3,
	258,129,0,1042,1041,1,0,0,0,1043,1046,1,0,0,0,1044,1042,1,0,0,0,1044,1045,
	1,0,0,0,1045,1048,1,0,0,0,1046,1044,1,0,0,0,1047,1049,3,14,7,0,1048,1047,
	1,0,0,0,1048,1049,1,0,0,0,1049,1051,1,0,0,0,1050,1030,1,0,0,0,1050,1040,
	1,0,0,0,1051,103,1,0,0,0,1052,1064,5,49,0,0,1053,1058,3,106,53,0,1054,1055,
	5,5,0,0,1055,1057,3,106,53,0,1056,1054,1,0,0,0,1057,1060,1,0,0,0,1058,1056,
	1,0,0,0,1058,1059,1,0,0,0,1059,1062,1,0,0,0,1060,1058,1,0,0,0,1061,1063,
	5,5,0,0,1062,1061,1,0,0,0,1062,1063,1,0,0,0,1063,1065,1,0,0,0,1064,1053,
	1,0,0,0,1064,1065,1,0,0,0,1065,1066,1,0,0,0,1066,1067,5,50,0,0,1067,105,
	1,0,0,0,1068,1072,3,266,133,0,1069,1071,3,258,129,0,1070,1069,1,0,0,0,1071,
	1074,1,0,0,0,1072,1070,1,0,0,0,1072,1073,1,0,0,0,1073,1076,1,0,0,0,1074,
	1072,1,0,0,0,1075,1077,3,14,7,0,1076,1075,1,0,0,0,1076,1077,1,0,0,0,1077,
	1099,1,0,0,0,1078,1082,3,82,41,0,1079,1081,3,258,129,0,1080,1079,1,0,0,
	0,1081,1084,1,0,0,0,1082,1080,1,0,0,0,1082,1083,1,0,0,0,1083,1086,1,0,0,
	0,1084,1082,1,0,0,0,1085,1087,3,14,7,0,1086,1085,1,0,0,0,1086,1087,1,0,
	0,0,1087,1099,1,0,0,0,1088,1092,3,80,40,0,1089,1091,3,258,129,0,1090,1089,
	1,0,0,0,1091,1094,1,0,0,0,1092,1090,1,0,0,0,1092,1093,1,0,0,0,1093,1096,
	1,0,0,0,1094,1092,1,0,0,0,1095,1097,3,14,7,0,1096,1095,1,0,0,0,1096,1097,
	1,0,0,0,1097,1099,1,0,0,0,1098,1068,1,0,0,0,1098,1078,1,0,0,0,1098,1088,
	1,0,0,0,1099,107,1,0,0,0,1100,1104,5,4,0,0,1101,1103,3,110,55,0,1102,1101,
	1,0,0,0,1103,1106,1,0,0,0,1104,1102,1,0,0,0,1104,1105,1,0,0,0,1105,1107,
	1,0,0,0,1106,1104,1,0,0,0,1107,1110,5,6,0,0,1108,1110,3,110,55,0,1109,1100,
	1,0,0,0,1109,1108,1,0,0,0,1110,109,1,0,0,0,1111,1144,3,88,44,0,1112,1144,
	3,132,66,0,1113,1144,3,134,67,0,1114,1144,3,140,70,0,1115,1144,3,142,71,
	0,1116,1144,3,144,72,0,1117,1144,3,146,73,0,1118,1144,3,148,74,0,1119,1144,
	3,138,69,0,1120,1144,3,126,63,0,1121,1144,3,130,65,0,1122,1144,3,152,76,
	0,1123,1144,3,154,77,0,1124,1144,3,156,78,0,1125,1144,3,158,79,0,1126,1144,
	3,178,89,0,1127,1144,3,124,62,0,1128,1144,3,112,56,0,1129,1144,3,114,57,
	0,1130,1144,3,116,58,0,1131,1144,3,118,59,0,1132,1144,3,120,60,0,1133,1144,
	3,122,61,0,1134,1144,3,180,90,0,1135,1144,3,220,110,0,1136,1144,3,232,116,
	0,1137,1144,3,234,117,0,1138,1144,3,150,75,0,1139,1144,3,212,106,0,1140,
	1144,3,214,107,0,1141,1144,3,226,113,0,1142,1144,3,228,114,0,1143,1111,
	1,0,0,0,1143,1112,1,0,0,0,1143,1113,1,0,0,0,1143,1114,1,0,0,0,1143,1115,
	1,0,0,0,1143,1116,1,0,0,0,1143,1117,1,0,0,0,1143,1118,1,0,0,0,1143,1119,
	1,0,0,0,1143,1120,1,0,0,0,1143,1121,1,0,0,0,1143,1122,1,0,0,0,1143,1123,
	1,0,0,0,1143,1124,1,0,0,0,1143,1125,1,0,0,0,1143,1126,1,0,0,0,1143,1127,
	1,0,0,0,1143,1128,1,0,0,0,1143,1129,1,0,0,0,1143,1130,1,0,0,0,1143,1131,
	1,0,0,0,1143,1132,1,0,0,0,1143,1133,1,0,0,0,1143,1134,1,0,0,0,1143,1135,
	1,0,0,0,1143,1136,1,0,0,0,1143,1137,1,0,0,0,1143,1138,1,0,0,0,1143,1139,
	1,0,0,0,1143,1140,1,0,0,0,1143,1141,1,0,0,0,1143,1142,1,0,0,0,1144,111,
	1,0,0,0,1145,1146,5,74,0,0,1146,1147,5,12,0,0,1147,1148,5,180,0,0,1148,
	1149,5,49,0,0,1149,1150,3,254,127,0,1150,1151,5,5,0,0,1151,1152,3,254,127,
	0,1152,1153,5,50,0,0,1153,1154,5,2,0,0,1154,113,1,0,0,0,1155,1156,5,74,
	0,0,1156,1157,5,12,0,0,1157,1158,5,180,0,0,1158,1159,5,66,0,0,1159,1160,
	3,254,127,0,1160,1161,5,67,0,0,1161,1162,5,12,0,0,1162,1163,5,180,0,0,1163,
	1164,5,49,0,0,1164,1169,3,254,127,0,1165,1166,5,5,0,0,1166,1168,3,254,127,
	0,1167,1165,1,0,0,0,1168,1171,1,0,0,0,1169,1167,1,0,0,0,1169,1170,1,0,0,
	0,1170,1172,1,0,0,0,1171,1169,1,0,0,0,1172,1173,5,50,0,0,1173,1174,5,2,
	0,0,1174,115,1,0,0,0,1175,1176,5,75,0,0,1176,1205,5,2,0,0,1177,1178,5,75,
	0,0,1178,1183,3,254,127,0,1179,1180,5,5,0,0,1180,1182,3,254,127,0,1181,
	1179,1,0,0,0,1182,1185,1,0,0,0,1183,1181,1,0,0,0,1183,1184,1,0,0,0,1184,
	1186,1,0,0,0,1185,1183,1,0,0,0,1186,1187,5,2,0,0,1187,1205,1,0,0,0,1188,
	1189,5,75,0,0,1189,1190,5,49,0,0,1190,1195,3,254,127,0,1191,1192,5,5,0,
	0,1192,1194,3,254,127,0,1193,1191,1,0,0,0,1194,1197,1,0,0,0,1195,1193,1,
	0,0,0,1195,1196,1,0,0,0,1196,1199,1,0,0,0,1197,1195,1,0,0,0,1198,1200,5,
	5,0,0,1199,1198,1,0,0,0,1199,1200,1,0,0,0,1200,1201,1,0,0,0,1201,1202,5,
	50,0,0,1202,1203,5,2,0,0,1203,1205,1,0,0,0,1204,1175,1,0,0,0,1204,1177,
	1,0,0,0,1204,1188,1,0,0,0,1205,117,1,0,0,0,1206,1209,5,180,0,0,1207,1208,
	5,12,0,0,1208,1210,5,180,0,0,1209,1207,1,0,0,0,1209,1210,1,0,0,0,1210,1211,
	1,0,0,0,1211,1212,5,49,0,0,1212,1224,5,4,0,0,1213,1218,3,242,121,0,1214,
	1215,5,5,0,0,1215,1217,3,242,121,0,1216,1214,1,0,0,0,1217,1220,1,0,0,0,
	1218,1216,1,0,0,0,1218,1219,1,0,0,0,1219,1222,1,0,0,0,1220,1218,1,0,0,0,
	1221,1223,5,5,0,0,1222,1221,1,0,0,0,1222,1223,1,0,0,0,1223,1225,1,0,0,0,
	1224,1213,1,0,0,0,1224,1225,1,0,0,0,1225,1226,1,0,0,0,1226,1227,5,6,0,0,
	1227,1228,5,50,0,0,1228,1252,5,2,0,0,1229,1230,5,180,0,0,1230,1231,3,244,
	122,0,1231,1232,5,2,0,0,1232,1252,1,0,0,0,1233,1234,5,180,0,0,1234,1235,
	5,12,0,0,1235,1236,5,180,0,0,1236,1237,3,244,122,0,1237,1238,5,2,0,0,1238,
	1252,1,0,0,0,1239,1240,5,180,0,0,1240,1241,3,244,122,0,1241,1242,5,12,0,
	0,1242,1243,5,180,0,0,1243,1244,5,12,0,0,1244,1246,5,180,0,0,1245,1247,
	3,246,123,0,1246,1245,1,0,0,0,1246,1247,1,0,0,0,1247,1248,1,0,0,0,1248,
	1249,3,244,122,0,1249,1250,5,2,0,0,1250,1252,1,0,0,0,1251,1206,1,0,0,0,
	1251,1229,1,0,0,0,1251,1233,1,0,0,0,1251,1239,1,0,0,0,1252,119,1,0,0,0,
	1253,1254,3,254,127,0,1254,1255,5,12,0,0,1255,1257,5,180,0,0,1256,1258,
	3,246,123,0,1257,1256,1,0,0,0,1257,1258,1,0,0,0,1258,1259,1,0,0,0,1259,
	1260,3,244,122,0,1260,1261,5,2,0,0,1261,121,1,0,0,0,1262,1263,5,31,0,0,
	1263,1264,5,49,0,0,1264,1265,3,254,127,0,1265,1266,5,50,0,0,1266,1267,5,
	2,0,0,1267,123,1,0,0,0,1268,1269,5,76,0,0,1269,1272,5,180,0,0,1270,1271,
	5,12,0,0,1271,1273,5,180,0,0,1272,1270,1,0,0,0,1272,1273,1,0,0,0,1273,1274,
	1,0,0,0,1274,1275,5,49,0,0,1275,1287,5,4,0,0,1276,1281,3,242,121,0,1277,
	1278,5,5,0,0,1278,1280,3,242,121,0,1279,1277,1,0,0,0,1280,1283,1,0,0,0,
	1281,1279,1,0,0,0,1281,1282,1,0,0,0,1282,1285,1,0,0,0,1283,1281,1,0,0,0,
	1284,1286,5,5,0,0,1285,1284,1,0,0,0,1285,1286,1,0,0,0,1286,1288,1,0,0,0,
	1287,1276,1,0,0,0,1287,1288,1,0,0,0,1288,1289,1,0,0,0,1289,1290,5,6,0,0,
	1290,1291,5,50,0,0,1291,1302,5,2,0,0,1292,1293,5,76,0,0,1293,1296,5,180,
	0,0,1294,1295,5,12,0,0,1295,1297,5,180,0,0,1296,1294,1,0,0,0,1296,1297,
	1,0,0,0,1297,1298,1,0,0,0,1298,1299,3,244,122,0,1299,1300,5,2,0,0,1300,
	1302,1,0,0,0,1301,1268,1,0,0,0,1301,1292,1,0,0,0,1302,125,1,0,0,0,1303,
	1304,5,74,0,0,1304,1305,5,12,0,0,1305,1314,5,180,0,0,1306,1307,5,66,0,0,
	1307,1308,3,254,127,0,1308,1309,5,67,0,0,1309,1311,1,0,0,0,1310,1306,1,
	0,0,0,1311,1312,1,0,0,0,1312,1310,1,0,0,0,1312,1313,1,0,0,0,1313,1315,1,
	0,0,0,1314,1310,1,0,0,0,1314,1315,1,0,0,0,1315,1319,1,0,0,0,1316,1318,3,
	128,64,0,1317,1316,1,0,0,0,1318,1321,1,0,0,0,1319,1317,1,0,0,0,1319,1320,
	1,0,0,0,1320,1322,1,0,0,0,1321,1319,1,0,0,0,1322,1323,7,10,0,0,1323,1324,
	3,254,127,0,1324,1325,5,2,0,0,1325,1422,1,0,0,0,1326,1331,5,180,0,0,1327,
	1328,5,66,0,0,1328,1329,3,254,127,0,1329,1330,5,67,0,0,1330,1332,1,0,0,
	0,1331,1327,1,0,0,0,1332,1333,1,0,0,0,1333,1331,1,0,0,0,1333,1334,1,0,0,
	0,1334,1338,1,0,0,0,1335,1337,3,128,64,0,1336,1335,1,0,0,0,1337,1340,1,
	0,0,0,1338,1336,1,0,0,0,1338,1339,1,0,0,0,1339,1341,1,0,0,0,1340,1338,1,
	0,0,0,1341,1342,7,10,0,0,1342,1343,3,254,127,0,1343,1344,5,2,0,0,1344,1422,
	1,0,0,0,1345,1347,5,180,0,0,1346,1348,3,128,64,0,1347,1346,1,0,0,0,1348,
	1349,1,0,0,0,1349,1347,1,0,0,0,1349,1350,1,0,0,0,1350,1351,1,0,0,0,1351,
	1352,7,10,0,0,1352,1353,3,254,127,0,1353,1354,5,2,0,0,1354,1422,1,0,0,0,
	1355,1357,5,180,0,0,1356,1358,3,128,64,0,1357,1356,1,0,0,0,1358,1359,1,
	0,0,0,1359,1357,1,0,0,0,1359,1360,1,0,0,0,1360,1365,1,0,0,0,1361,1362,5,
	66,0,0,1362,1363,3,254,127,0,1363,1364,5,67,0,0,1364,1366,1,0,0,0,1365,
	1361,1,0,0,0,1366,1367,1,0,0,0,1367,1365,1,0,0,0,1367,1368,1,0,0,0,1368,
	1369,1,0,0,0,1369,1370,7,10,0,0,1370,1371,3,254,127,0,1371,1372,5,2,0,0,
	1372,1422,1,0,0,0,1373,1374,5,74,0,0,1374,1375,5,12,0,0,1375,1384,5,180,
	0,0,1376,1377,5,66,0,0,1377,1378,3,254,127,0,1378,1379,5,67,0,0,1379,1381,
	1,0,0,0,1380,1376,1,0,0,0,1381,1382,1,0,0,0,1382,1380,1,0,0,0,1382,1383,
	1,0,0,0,1383,1385,1,0,0,0,1384,1380,1,0,0,0,1384,1385,1,0,0,0,1385,1389,
	1,0,0,0,1386,1388,3,128,64,0,1387,1386,1,0,0,0,1388,1391,1,0,0,0,1389,1387,
	1,0,0,0,1389,1390,1,0,0,0,1390,1392,1,0,0,0,1391,1389,1,0,0,0,1392,1393,
	7,11,0,0,1393,1422,5,2,0,0,1394,1399,5,180,0,0,1395,1396,5,66,0,0,1396,
	1397,3,254,127,0,1397,1398,5,67,0,0,1398,1400,1,0,0,0,1399,1395,1,0,0,0,
	1400,1401,1,0,0,0,1401,1399,1,0,0,0,1401,1402,1,0,0,0,1402,1406,1,0,0,0,
	1403,1405,3,128,64,0,1404,1403,1,0,0,0,1405,1408,1,0,0,0,1406,1404,1,0,
	0,0,1406,1407,1,0,0,0,1407,1409,1,0,0,0,1408,1406,1,0,0,0,1409,1410,7,11,
	0,0,1410,1411,5,2,0,0,1411,1422,1,0,0,0,1412,1414,5,180,0,0,1413,1415,3,
	128,64,0,1414,1413,1,0,0,0,1415,1416,1,0,0,0,1416,1414,1,0,0,0,1416,1417,
	1,0,0,0,1417,1418,1,0,0,0,1418,1419,7,11,0,0,1419,1420,5,2,0,0,1420,1422,
	1,0,0,0,1421,1303,1,0,0,0,1421,1326,1,0,0,0,1421,1345,1,0,0,0,1421,1355,
	1,0,0,0,1421,1373,1,0,0,0,1421,1394,1,0,0,0,1421,1412,1,0,0,0,1422,127,
	1,0,0,0,1423,1424,5,12,0,0,1424,1427,5,180,0,0,1425,1427,5,163,0,0,1426,
	1423,1,0,0,0,1426,1425,1,0,0,0,1427,129,1,0,0,0,1428,1429,5,74,0,0,1429,
	1430,5,12,0,0,1430,1437,5,180,0,0,1431,1432,5,66,0,0,1432,1433,3,254,127,
	0,1433,1434,5,67,0,0,1434,1436,1,0,0,0,1435,1431,1,0,0,0,1436,1439,1,0,
	0,0,1437,1435,1,0,0,0,1437,1438,1,0,0,0,1438,1440,1,0,0,0,1439,1437,1,0,
	0,0,1440,1441,5,169,0,0,1441,1442,5,49,0,0,1442,1443,3,254,127,0,1443,1444,
	5,50,0,0,1444,1445,5,2,0,0,1445,131,1,0,0,0,1446,1450,3,266,133,0,1447,
	1449,3,258,129,0,1448,1447,1,0,0,0,1449,1452,1,0,0,0,1450,1448,1,0,0,0,
	1450,1451,1,0,0,0,1451,1453,1,0,0,0,1452,1450,1,0,0,0,1453,1456,3,14,7,
	0,1454,1455,5,40,0,0,1455,1457,3,254,127,0,1456,1454,1,0,0,0,1456,1457,
	1,0,0,0,1457,1458,1,0,0,0,1458,1459,5,2,0,0,1459,1475,1,0,0,0,1460,1464,
	3,82,41,0,1461,1463,3,258,129,0,1462,1461,1,0,0,0,1463,1466,1,0,0,0,1464,
	1462,1,0,0,0,1464,1465,1,0,0,0,1465,1467,1,0,0,0,1466,1464,1,0,0,0,1467,
	1470,3,14,7,0,1468,1469,5,40,0,0,1469,1471,3,254,127,0,1470,1468,1,0,0,
	0,1470,1471,1,0,0,0,1471,1472,1,0,0,0,1472,1473,5,2,0,0,1473,1475,1,0,0,
	0,1474,1446,1,0,0,0,1474,1460,1,0,0,0,1475,133,1,0,0,0,1476,1477,3,266,
	133,0,1477,1482,5,180,0,0,1478,1479,5,5,0,0,1479,1480,3,266,133,0,1480,
	1481,5,180,0,0,1481,1483,1,0,0,0,1482,1478,1,0,0,0,1483,1484,1,0,0,0,1484,
	1482,1,0,0,0,1484,1485,1,0,0,0,1485,1486,1,0,0,0,1486,1487,5,40,0,0,1487,
	1488,3,254,127,0,1488,1489,5,2,0,0,1489,1525,1,0,0,0,1490,1491,5,49,0,0,
	1491,1494,3,136,68,0,1492,1493,5,5,0,0,1493,1495,3,136,68,0,1494,1492,1,
	0,0,0,1495,1496,1,0,0,0,1496,1494,1,0,0,0,1496,1497,1,0,0,0,1497,1498,1,
	0,0,0,1498,1499,5,50,0,0,1499,1500,5,40,0,0,1500,1501,5,49,0,0,1501,1504,
	3,254,127,0,1502,1503,5,5,0,0,1503,1505,3,254,127,0,1504,1502,1,0,0,0,1505,
	1506,1,0,0,0,1506,1504,1,0,0,0,1506,1507,1,0,0,0,1507,1508,1,0,0,0,1508,
	1509,5,50,0,0,1509,1510,5,2,0,0,1510,1525,1,0,0,0,1511,1512,5,49,0,0,1512,
	1515,3,136,68,0,1513,1514,5,5,0,0,1514,1516,3,136,68,0,1515,1513,1,0,0,
	0,1516,1517,1,0,0,0,1517,1515,1,0,0,0,1517,1518,1,0,0,0,1518,1519,1,0,0,
	0,1519,1520,5,50,0,0,1520,1521,5,40,0,0,1521,1522,3,254,127,0,1522,1523,
	5,2,0,0,1523,1525,1,0,0,0,1524,1476,1,0,0,0,1524,1490,1,0,0,0,1524,1511,
	1,0,0,0,1525,135,1,0,0,0,1526,1530,3,266,133,0,1527,1529,3,258,129,0,1528,
	1527,1,0,0,0,1529,1532,1,0,0,0,1530,1528,1,0,0,0,1530,1531,1,0,0,0,1531,
	1533,1,0,0,0,1532,1530,1,0,0,0,1533,1534,3,14,7,0,1534,1538,1,0,0,0,1535,
	1538,3,14,7,0,1536,1538,1,0,0,0,1537,1526,1,0,0,0,1537,1535,1,0,0,0,1537,
	1536,1,0,0,0,1538,137,1,0,0,0,1539,1540,5,180,0,0,1540,1541,7,10,0,0,1541,
	1542,3,254,127,0,1542,1543,5,2,0,0,1543,1551,1,0,0,0,1544,1545,5,180,0,
	0,1545,1546,7,11,0,0,1546,1551,5,2,0,0,1547,1548,7,11,0,0,1548,1549,5,180,
	0,0,1549,1551,5,2,0,0,1550,1539,1,0,0,0,1550,1544,1,0,0,0,1550,1547,1,0,
	0,0,1551,139,1,0,0,0,1552,1553,5,180,0,0,1553,1554,5,165,0,0,1554,1555,
	5,49,0,0,1555,1556,3,254,127,0,1556,1557,5,50,0,0,1557,1558,5,2,0,0,1558,
	1584,1,0,0,0,1559,1560,5,180,0,0,1560,1561,5,12,0,0,1561,1562,5,180,0,0,
	1562,1563,5,165,0,0,1563,1564,5,49,0,0,1564,1565,3,254,127,0,1565,1566,
	5,50,0,0,1566,1567,5,2,0,0,1567,1584,1,0,0,0,1568,1573,5,180,0,0,1569,1570,
	5,66,0,0,1570,1571,3,254,127,0,1571,1572,5,67,0,0,1572,1574,1,0,0,0,1573,
	1569,1,0,0,0,1574,1575,1,0,0,0,1575,1573,1,0,0,0,1575,1576,1,0,0,0,1576,
	1577,1,0,0,0,1577,1578,5,165,0,0,1578,1579,5,49,0,0,1579,1580,3,254,127,
	0,1580,1581,5,50,0,0,1581,1582,5,2,0,0,1582,1584,1,0,0,0,1583,1552,1,0,
	0,0,1583,1559,1,0,0,0,1583,1568,1,0,0,0,1584,141,1,0,0,0,1585,1586,5,180,
	0,0,1586,1587,5,166,0,0,1587,1588,5,49,0,0,1588,1589,5,50,0,0,1589,1612,
	5,2,0,0,1590,1591,5,180,0,0,1591,1592,5,12,0,0,1592,1593,5,180,0,0,1593,
	1594,5,166,0,0,1594,1595,5,49,0,0,1595,1596,5,50,0,0,1596,1612,5,2,0,0,
	1597,1602,5,180,0,0,1598,1599,5,66,0,0,1599,1600,3,254,127,0,1600,1601,
	5,67,0,0,1601,1603,1,0,0,0,1602,1598,1,0,0,0,1603,1604,1,0,0,0,1604,1602,
	1,0,0,0,1604,1605,1,0,0,0,1605,1606,1,0,0,0,1606,1607,5,166,0,0,1607,1608,
	5,49,0,0,1608,1609,5,50,0,0,1609,1610,5,2,0,0,1610,1612,1,0,0,0,1611,1585,
	1,0,0,0,1611,1590,1,0,0,0,1611,1597,1,0,0,0,1612,143,1,0,0,0,1613,1614,
	5,180,0,0,1614,1615,5,169,0,0,1615,1616,5,49,0,0,1616,1617,3,254,127,0,
	1617,1618,5,50,0,0,1618,1619,5,2,0,0,1619,145,1,0,0,0,1620,1621,5,74,0,
	0,1621,1622,5,12,0,0,1622,1623,5,180,0,0,1623,1624,5,165,0,0,1624,1625,
	5,49,0,0,1625,1626,3,254,127,0,1626,1627,5,50,0,0,1627,1628,5,2,0,0,1628,
	1658,1,0,0,0,1629,1630,5,74,0,0,1630,1631,5,12,0,0,1631,1636,5,180,0,0,
	1632,1633,5,66,0,0,1633,1634,3,254,127,0,1634,1635,5,67,0,0,1635,1637,1,
	0,0,0,1636,1632,1,0,0,0,1637,1638,1,0,0,0,1638,1636,1,0,0,0,1638,1639,1,
	0,0,0,1639,1640,1,0,0,0,1640,1641,5,165,0,0,1641,1642,5,49,0,0,1642,1643,
	3,254,127,0,1643,1644,5,50,0,0,1644,1645,5,2,0,0,1645,1658,1,0,0,0,1646,
	1647,5,74,0,0,1647,1648,5,12,0,0,1648,1649,5,180,0,0,1649,1650,5,12,0,0,
	1650,1651,5,180,0,0,1651,1652,5,165,0,0,1652,1653,5,49,0,0,1653,1654,3,
	254,127,0,1654,1655,5,50,0,0,1655,1656,5,2,0,0,1656,1658,1,0,0,0,1657,1620,
	1,0,0,0,1657,1629,1,0,0,0,1657,1646,1,0,0,0,1658,147,1,0,0,0,1659,1660,
	5,74,0,0,1660,1661,5,12,0,0,1661,1662,5,180,0,0,1662,1663,5,166,0,0,1663,
	1664,5,49,0,0,1664,1665,5,50,0,0,1665,1692,5,2,0,0,1666,1667,5,74,0,0,1667,
	1668,5,12,0,0,1668,1673,5,180,0,0,1669,1670,5,66,0,0,1670,1671,3,254,127,
	0,1671,1672,5,67,0,0,1672,1674,1,0,0,0,1673,1669,1,0,0,0,1674,1675,1,0,
	0,0,1675,1673,1,0,0,0,1675,1676,1,0,0,0,1676,1677,1,0,0,0,1677,1678,5,166,
	0,0,1678,1679,5,49,0,0,1679,1680,5,50,0,0,1680,1681,5,2,0,0,1681,1692,1,
	0,0,0,1682,1683,5,74,0,0,1683,1684,5,12,0,0,1684,1685,5,180,0,0,1685,1686,
	5,12,0,0,1686,1687,5,180,0,0,1687,1688,5,166,0,0,1688,1689,5,49,0,0,1689,
	1690,5,50,0,0,1690,1692,5,2,0,0,1691,1659,1,0,0,0,1691,1666,1,0,0,0,1691,
	1682,1,0,0,0,1692,149,1,0,0,0,1693,1694,5,89,0,0,1694,1695,5,180,0,0,1695,
	1746,5,2,0,0,1696,1697,5,89,0,0,1697,1698,5,74,0,0,1698,1699,5,12,0,0,1699,
	1700,5,180,0,0,1700,1746,5,2,0,0,1701,1702,5,89,0,0,1702,1703,5,74,0,0,
	1703,1704,5,12,0,0,1704,1709,5,180,0,0,1705,1706,5,66,0,0,1706,1707,3,254,
	127,0,1707,1708,5,67,0,0,1708,1710,1,0,0,0,1709,1705,1,0,0,0,1710,1711,
	1,0,0,0,1711,1709,1,0,0,0,1711,1712,1,0,0,0,1712,1713,1,0,0,0,1713,1714,
	5,2,0,0,1714,1746,1,0,0,0,1715,1716,5,89,0,0,1716,1721,5,180,0,0,1717,1718,
	5,66,0,0,1718,1719,3,254,127,0,1719,1720,5,67,0,0,1720,1722,1,0,0,0,1721,
	1717,1,0,0,0,1722,1723,1,0,0,0,1723,1721,1,0,0,0,1723,1724,1,0,0,0,1724,
	1725,1,0,0,0,1725,1726,5,2,0,0,1726,1746,1,0,0,0,1727,1728,5,89,0,0,1728,
	1731,5,180,0,0,1729,1730,5,12,0,0,1730,1732,5,180,0,0,1731,1729,1,0,0,0,
	1732,1733,1,0,0,0,1733,1731,1,0,0,0,1733,1734,1,0,0,0,1734,1739,1,0,0,0,
	1735,1736,5,66,0,0,1736,1737,3,254,127,0,1737,1738,5,67,0,0,1738,1740,1,
	0,0,0,1739,1735,1,0,0,0,1740,1741,1,0,0,0,1741,1739,1,0,0,0,1741,1742,1,
	0,0,0,1742,1743,1,0,0,0,1743,1744,5,2,0,0,1744,1746,1,0,0,0,1745,1693,1,
	0,0,0,1745,1696,1,0,0,0,1745,1701,1,0,0,0,1745,1715,1,0,0,0,1745,1727,1,
	0,0,0,1746,151,1,0,0,0,1747,1748,5,90,0,0,1748,1749,5,49,0,0,1749,1750,
	5,154,0,0,1750,1751,5,23,0,0,1751,1754,3,254,127,0,1752,1753,5,5,0,0,1753,
	1755,3,230,115,0,1754,1752,1,0,0,0,1754,1755,1,0,0,0,1755,1756,1,0,0,0,
	1756,1757,5,50,0,0,1757,1758,5,2,0,0,1758,153,1,0,0,0,1759,1760,5,90,0,
	0,1760,1761,5,49,0,0,1761,1764,3,254,127,0,1762,1763,5,5,0,0,1763,1765,
	3,230,115,0,1764,1762,1,0,0,0,1764,1765,1,0,0,0,1765,1766,1,0,0,0,1766,
	1767,5,50,0,0,1767,1768,5,2,0,0,1768,155,1,0,0,0,1769,1770,5,91,0,0,1770,
	1771,5,49,0,0,1771,1772,3,254,127,0,1772,1773,5,50,0,0,1773,1776,3,108,
	54,0,1774,1775,5,92,0,0,1775,1777,3,108,54,0,1776,1774,1,0,0,0,1776,1777,
	1,0,0,0,1777,157,1,0,0,0,1778,1785,3,174,87,0,1779,1785,3,176,88,0,1780,
	1785,3,166,83,0,1781,1785,3,160,80,0,1782,1785,3,162,81,0,1783,1785,3,164,
	82,0,1784,1778,1,0,0,0,1784,1779,1,0,0,0,1784,1780,1,0,0,0,1784,1781,1,
	0,0,0,1784,1782,1,0,0,0,1784,1783,1,0,0,0,1785,159,1,0,0,0,1786,1787,5,
	9,0,0,1787,1788,5,49,0,0,1788,1789,3,266,133,0,1789,1790,5,180,0,0,1790,
	1791,5,5,0,0,1791,1792,3,266,133,0,1792,1793,5,180,0,0,1793,1794,5,93,0,
	0,1794,1795,5,74,0,0,1795,1796,5,12,0,0,1796,1797,5,180,0,0,1797,1798,5,
	12,0,0,1798,1799,5,34,0,0,1799,1800,5,50,0,0,1800,1801,3,108,54,0,1801,
	161,1,0,0,0,1802,1803,5,9,0,0,1803,1804,5,49,0,0,1804,1805,3,266,133,0,
	1805,1806,5,180,0,0,1806,1807,5,94,0,0,1807,1808,5,74,0,0,1808,1809,5,12,
	0,0,1809,1810,5,180,0,0,1810,1811,5,50,0,0,1811,1812,3,108,54,0,1812,163,
	1,0,0,0,1813,1814,5,9,0,0,1814,1815,5,49,0,0,1815,1816,3,266,133,0,1816,
	1817,5,180,0,0,1817,1818,5,93,0,0,1818,1819,5,74,0,0,1819,1820,5,12,0,0,
	1820,1821,5,180,0,0,1821,1822,5,50,0,0,1822,1823,3,108,54,0,1823,165,1,
	0,0,0,1824,1825,5,9,0,0,1825,1826,5,49,0,0,1826,1827,3,168,84,0,1827,1829,
	3,170,85,0,1828,1830,3,172,86,0,1829,1828,1,0,0,0,1829,1830,1,0,0,0,1830,
	1831,1,0,0,0,1831,1832,5,50,0,0,1832,1833,3,108,54,0,1833,167,1,0,0,0,1834,
	1838,3,266,133,0,1835,1837,3,258,129,0,1836,1835,1,0,0,0,1837,1840,1,0,
	0,0,1838,1836,1,0,0,0,1838,1839,1,0,0,0,1839,1841,1,0,0,0,1840,1838,1,0,
	0,0,1841,1844,5,180,0,0,1842,1843,5,40,0,0,1843,1845,3,254,127,0,1844,1842,
	1,0,0,0,1844,1845,1,0,0,0,1845,1846,1,0,0,0,1846,1847,5,2,0,0,1847,1855,
	1,0,0,0,1848,1849,5,180,0,0,1849,1850,7,10,0,0,1850,1851,3,254,127,0,1851,
	1852,5,2,0,0,1852,1855,1,0,0,0,1853,1855,5,2,0,0,1854,1834,1,0,0,0,1854,
	1848,1,0,0,0,1854,1853,1,0,0,0,1855,169,1,0,0,0,1856,1857,3,254,127,0,1857,
	1858,5,2,0,0,1858,171,1,0,0,0,1859,1860,5,180,0,0,1860,1861,7,10,0,0,1861,
	1867,3,254,127,0,1862,1863,5,180,0,0,1863,1867,7,11,0,0,1864,1865,7,11,
	0,0,1865,1867,5,180,0,0,1866,1859,1,0,0,0,1866,1862,1,0,0,0,1866,1864,1,
	0,0,0,1867,173,1,0,0,0,1868,1869,5,95,0,0,1869,1870,3,108,54,0,1870,1871,
	5,96,0,0,1871,1872,5,49,0,0,1872,1873,3,254,127,0,1873,1874,5,50,0,0,1874,
	1875,5,2,0,0,1875,175,1,0,0,0,1876,1877,5,96,0,0,1877,1878,5,49,0,0,1878,
	1879,3,254,127,0,1879,1880,5,50,0,0,1880,1881,3,108,54,0,1881,177,1,0,0,
	0,1882,1883,5,97,0,0,1883,1884,3,238,119,0,1884,1885,5,2,0,0,1885,179,1,
	0,0,0,1886,1887,5,98,0,0,1887,1888,3,182,91,0,1888,181,1,0,0,0,1889,1893,
	5,4,0,0,1890,1892,3,184,92,0,1891,1890,1,0,0,0,1892,1895,1,0,0,0,1893,1891,
	1,0,0,0,1893,1894,1,0,0,0,1894,1896,1,0,0,0,1895,1893,1,0,0,0,1896,1897,
	5,6,0,0,1897,183,1,0,0,0,1898,1912,3,182,91,0,1899,1912,3,186,93,0,1900,
	1912,3,188,94,0,1901,1912,3,190,95,0,1902,1912,3,192,96,0,1903,1912,3,198,
	99,0,1904,1912,3,200,100,0,1905,1912,5,99,0,0,1906,1912,5,100,0,0,1907,
	1912,5,101,0,0,1908,1912,3,204,102,0,1909,1912,3,208,104,0,1910,1912,3,
	210,105,0,1911,1898,1,0,0,0,1911,1899,1,0,0,0,1911,1900,1,0,0,0,1911,1901,
	1,0,0,0,1911,1902,1,0,0,0,1911,1903,1,0,0,0,1911,1904,1,0,0,0,1911,1905,
	1,0,0,0,1911,1906,1,0,0,0,1911,1907,1,0,0,0,1911,1908,1,0,0,0,1911,1909,
	1,0,0,0,1911,1910,1,0,0,0,1912,185,1,0,0,0,1913,1914,5,102,0,0,1914,1919,
	3,14,7,0,1915,1916,5,5,0,0,1916,1918,3,14,7,0,1917,1915,1,0,0,0,1918,1921,
	1,0,0,0,1919,1917,1,0,0,0,1919,1920,1,0,0,0,1920,1924,1,0,0,0,1921,1919,
	1,0,0,0,1922,1923,5,103,0,0,1923,1925,3,202,101,0,1924,1922,1,0,0,0,1924,
	1925,1,0,0,0,1925,187,1,0,0,0,1926,1931,3,208,104,0,1927,1928,5,5,0,0,1928,
	1930,3,208,104,0,1929,1927,1,0,0,0,1930,1933,1,0,0,0,1931,1929,1,0,0,0,
	1931,1932,1,0,0,0,1932,1934,1,0,0,0,1933,1931,1,0,0,0,1934,1935,5,103,0,
	0,1935,1936,3,202,101,0,1936,189,1,0,0,0,1937,1938,5,91,0,0,1938,1939,3,
	202,101,0,1939,1940,3,182,91,0,1940,191,1,0,0,0,1941,1942,5,104,0,0,1942,
	1952,3,202,101,0,1943,1945,3,194,97,0,1944,1943,1,0,0,0,1945,1946,1,0,0,
	0,1946,1944,1,0,0,0,1946,1947,1,0,0,0,1947,1949,1,0,0,0,1948,1950,3,196,
	98,0,1949,1948,1,0,0,0,1949,1950,1,0,0,0,1950,1953,1,0,0,0,1951,1953,3,
	196,98,0,1952,1944,1,0,0,0,1952,1951,1,0,0,0,1953,193,1,0,0,0,1954,1955,
	5,105,0,0,1955,1956,3,210,105,0,1956,1957,3,182,91,0,1957,195,1,0,0,0,1958,
	1959,5,106,0,0,1959,1960,3,182,91,0,1960,197,1,0,0,0,1961,1962,5,9,0,0,
	1962,1963,3,182,91,0,1963,1964,3,202,101,0,1964,1965,3,182,91,0,1965,1966,
	3,182,91,0,1966,199,1,0,0,0,1967,1968,5,7,0,0,1968,1969,5,180,0,0,1969,
	1978,5,49,0,0,1970,1975,5,180,0,0,1971,1972,5,5,0,0,1972,1974,5,180,0,0,
	1973,1971,1,0,0,0,1974,1977,1,0,0,0,1975,1973,1,0,0,0,1975,1976,1,0,0,0,
	1976,1979,1,0,0,0,1977,1975,1,0,0,0,1978,1970,1,0,0,0,1978,1979,1,0,0,0,
	1979,1980,1,0,0,0,1980,1990,5,50,0,0,1981,1982,5,107,0,0,1982,1987,5,180,
	0,0,1983,1984,5,5,0,0,1984,1986,5,180,0,0,1985,1983,1,0,0,0,1986,1989,1,
	0,0,0,1987,1985,1,0,0,0,1987,1988,1,0,0,0,1988,1991,1,0,0,0,1989,1987,1,
	0,0,0,1990,1981,1,0,0,0,1990,1991,1,0,0,0,1991,1992,1,0,0,0,1992,1993,3,
	182,91,0,1993,201,1,0,0,0,1994,1998,3,204,102,0,1995,1998,3,208,104,0,1996,
	1998,3,210,105,0,1997,1994,1,0,0,0,1997,1995,1,0,0,0,1997,1996,1,0,0,0,
	1998,203,1,0,0,0,1999,2000,3,206,103,0,2000,2009,5,49,0,0,2001,2006,3,202,
	101,0,2002,2003,5,5,0,0,2003,2005,3,202,101,0,2004,2002,1,0,0,0,2005,2008,
	1,0,0,0,2006,2004,1,0,0,0,2006,2007,1,0,0,0,2007,2010,1,0,0,0,2008,2006,
	1,0,0,0,2009,2001,1,0,0,0,2009,2010,1,0,0,0,2010,2011,1,0,0,0,2011,2012,
	5,50,0,0,2012,205,1,0,0,0,2013,2014,7,12,0,0,2014,207,1,0,0,0,2015,2020,
	3,14,7,0,2016,2017,5,12,0,0,2017,2019,3,14,7,0,2018,2016,1,0,0,0,2019,2022,
	1,0,0,0,2020,2018,1,0,0,0,2020,2021,1,0,0,0,2021,209,1,0,0,0,2022,2020,
	1,0,0,0,2023,2024,7,13,0,0,2024,211,1,0,0,0,2025,2026,5,109,0,0,2026,2030,
	5,4,0,0,2027,2029,3,110,55,0,2028,2027,1,0,0,0,2029,2032,1,0,0,0,2030,2028,
	1,0,0,0,2030,2031,1,0,0,0,2031,2033,1,0,0,0,2032,2030,1,0,0,0,2033,2034,
	5,6,0,0,2034,213,1,0,0,0,2035,2036,5,104,0,0,2036,2037,5,49,0,0,2037,2038,
	3,254,127,0,2038,2039,5,50,0,0,2039,2043,5,4,0,0,2040,2042,3,216,108,0,
	2041,2040,1,0,0,0,2042,2045,1,0,0,0,2043,2041,1,0,0,0,2043,2044,1,0,0,0,
	2044,2047,1,0,0,0,2045,2043,1,0,0,0,2046,2048,3,218,109,0,2047,2046,1,0,
	0,0,2047,2048,1,0,0,0,2048,2049,1,0,0,0,2049,2050,5,6,0,0,2050,215,1,0,
	0,0,2051,2052,5,105,0,0,2052,2053,3,254,127,0,2053,2057,5,110,0,0,2054,
	2056,3,110,55,0,2055,2054,1,0,0,0,2056,2059,1,0,0,0,2057,2055,1,0,0,0,2057,
	2058,1,0,0,0,2058,217,1,0,0,0,2059,2057,1,0,0,0,2060,2061,5,106,0,0,2061,
	2065,5,110,0,0,2062,2064,3,110,55,0,2063,2062,1,0,0,0,2064,2067,1,0,0,0,
	2065,2063,1,0,0,0,2065,2066,1,0,0,0,2066,219,1,0,0,0,2067,2065,1,0,0,0,
	2068,2069,5,111,0,0,2069,2071,3,254,127,0,2070,2072,3,222,111,0,2071,2070,
	1,0,0,0,2071,2072,1,0,0,0,2072,2073,1,0,0,0,2073,2075,3,108,54,0,2074,2076,
	3,224,112,0,2075,2074,1,0,0,0,2076,2077,1,0,0,0,2077,2075,1,0,0,0,2077,
	2078,1,0,0,0,2078,221,1,0,0,0,2079,2080,5,73,0,0,2080,2092,5,49,0,0,2081,
	2086,3,106,53,0,2082,2083,5,5,0,0,2083,2085,3,106,53,0,2084,2082,1,0,0,
	0,2085,2088,1,0,0,0,2086,2084,1,0,0,0,2086,2087,1,0,0,0,2087,2090,1,0,0,
	0,2088,2086,1,0,0,0,2089,2091,5,5,0,0,2090,2089,1,0,0,0,2090,2091,1,0,0,
	0,2091,2093,1,0,0,0,2092,2081,1,0,0,0,2092,2093,1,0,0,0,2093,2094,1,0,0,
	0,2094,2095,5,50,0,0,2095,223,1,0,0,0,2096,2098,5,112,0,0,2097,2099,5,180,
	0,0,2098,2097,1,0,0,0,2098,2099,1,0,0,0,2099,2115,1,0,0,0,2100,2112,5,49,
	0,0,2101,2106,3,106,53,0,2102,2103,5,5,0,0,2103,2105,3,106,53,0,2104,2102,
	1,0,0,0,2105,2108,1,0,0,0,2106,2104,1,0,0,0,2106,2107,1,0,0,0,2107,2110,
	1,0,0,0,2108,2106,1,0,0,0,2109,2111,5,5,0,0,2110,2109,1,0,0,0,2110,2111,
	1,0,0,0,2111,2113,1,0,0,0,2112,2101,1,0,0,0,2112,2113,1,0,0,0,2113,2114,
	1,0,0,0,2114,2116,5,50,0,0,2115,2100,1,0,0,0,2115,2116,1,0,0,0,2116,2117,
	1,0,0,0,2117,2118,3,108,54,0,2118,225,1,0,0,0,2119,2120,5,99,0,0,2120,2121,
	5,2,0,0,2121,227,1,0,0,0,2122,2123,5,100,0,0,2123,2124,5,2,0,0,2124,229,
	1,0,0,0,2125,2129,5,151,0,0,2126,2127,5,180,0,0,2127,2129,3,244,122,0,2128,
	2125,1,0,0,0,2128,2126,1,0,0,0,2129,231,1,0,0,0,2130,2131,5,36,0,0,2131,
	2134,5,180,0,0,2132,2133,5,12,0,0,2133,2135,5,180,0,0,2134,2132,1,0,0,0,
	2134,2135,1,0,0,0,2135,2136,1,0,0,0,2136,2137,5,49,0,0,2137,2149,5,4,0,
	0,2138,2143,3,242,121,0,2139,2140,5,5,0,0,2140,2142,3,242,121,0,2141,2139,
	1,0,0,0,2142,2145,1,0,0,0,2143,2141,1,0,0,0,2143,2144,1,0,0,0,2144,2147,
	1,0,0,0,2145,2143,1,0,0,0,2146,2148,5,5,0,0,2147,2146,1,0,0,0,2147,2148,
	1,0,0,0,2148,2150,1,0,0,0,2149,2138,1,0,0,0,2149,2150,1,0,0,0,2150,2151,
	1,0,0,0,2151,2152,5,6,0,0,2152,2153,5,50,0,0,2153,2173,5,2,0,0,2154,2155,
	5,36,0,0,2155,2158,5,180,0,0,2156,2157,5,12,0,0,2157,2159,5,180,0,0,2158,
	2156,1,0,0,0,2158,2159,1,0,0,0,2159,2160,1,0,0,0,2160,2161,3,244,122,0,
	2161,2162,5,2,0,0,2162,2173,1,0,0,0,2163,2164,5,36,0,0,2164,2165,5,49,0,
	0,2165,2166,5,151,0,0,2166,2167,5,50,0,0,2167,2173,5,2,0,0,2168,2169,5,
	36,0,0,2169,2170,5,49,0,0,2170,2171,5,50,0,0,2171,2173,5,2,0,0,2172,2130,
	1,0,0,0,2172,2154,1,0,0,0,2172,2163,1,0,0,0,2172,2168,1,0,0,0,2173,233,
	1,0,0,0,2174,2175,5,113,0,0,2175,2176,5,49,0,0,2176,2177,3,254,127,0,2177,
	2178,5,50,0,0,2178,2179,5,2,0,0,2179,235,1,0,0,0,2180,2183,5,180,0,0,2181,
	2183,3,260,130,0,2182,2180,1,0,0,0,2182,2181,1,0,0,0,2183,237,1,0,0,0,2184,
	2196,5,49,0,0,2185,2190,3,236,118,0,2186,2187,5,5,0,0,2187,2189,3,236,118,
	0,2188,2186,1,0,0,0,2189,2192,1,0,0,0,2190,2188,1,0,0,0,2190,2191,1,0,0,
	0,2191,2194,1,0,0,0,2192,2190,1,0,0,0,2193,2195,5,5,0,0,2194,2193,1,0,0,
	0,2194,2195,1,0,0,0,2195,2197,1,0,0,0,2196,2185,1,0,0,0,2196,2197,1,0,0,
	0,2197,2198,1,0,0,0,2198,2199,5,50,0,0,2199,239,1,0,0,0,2200,2201,5,180,
	0,0,2201,2225,3,244,122,0,2202,2203,5,180,0,0,2203,2204,5,12,0,0,2204,2205,
	5,180,0,0,2205,2225,3,244,122,0,2206,2207,5,180,0,0,2207,2208,5,49,0,0,
	2208,2220,5,4,0,0,2209,2214,3,242,121,0,2210,2211,5,5,0,0,2211,2213,3,242,
	121,0,2212,2210,1,0,0,0,2213,2216,1,0,0,0,2214,2212,1,0,0,0,2214,2215,1,
	0,0,0,2215,2218,1,0,0,0,2216,2214,1,0,0,0,2217,2219,5,5,0,0,2218,2217,1,
	0,0,0,2218,2219,1,0,0,0,2219,2221,1,0,0,0,2220,2209,1,0,0,0,2220,2221,1,
	0,0,0,2221,2222,1,0,0,0,2222,2223,5,6,0,0,2223,2225,5,50,0,0,2224,2200,
	1,0,0,0,2224,2202,1,0,0,0,2224,2206,1,0,0,0,2225,241,1,0,0,0,2226,2227,
	5,180,0,0,2227,2228,5,110,0,0,2228,2229,3,254,127,0,2229,243,1,0,0,0,2230,
	2242,5,49,0,0,2231,2236,3,254,127,0,2232,2233,5,5,0,0,2233,2235,3,254,127,
	0,2234,2232,1,0,0,0,2235,2238,1,0,0,0,2236,2234,1,0,0,0,2236,2237,1,0,0,
	0,2237,2240,1,0,0,0,2238,2236,1,0,0,0,2239,2241,5,5,0,0,2240,2239,1,0,0,
	0,2240,2241,1,0,0,0,2241,2243,1,0,0,0,2242,2231,1,0,0,0,2242,2243,1,0,0,
	0,2243,2244,1,0,0,0,2244,2245,5,50,0,0,2245,245,1,0,0,0,2246,2247,5,4,0,
	0,2247,2252,3,248,124,0,2248,2249,5,5,0,0,2249,2251,3,248,124,0,2250,2248,
	1,0,0,0,2251,2254,1,0,0,0,2252,2250,1,0,0,0,2252,2253,1,0,0,0,2253,2256,
	1,0,0,0,2254,2252,1,0,0,0,2255,2257,5,5,0,0,2256,2255,1,0,0,0,2256,2257,
	1,0,0,0,2257,2258,1,0,0,0,2258,2259,5,6,0,0,2259,247,1,0,0,0,2260,2261,
	5,180,0,0,2261,2262,5,110,0,0,2262,2263,3,254,127,0,2263,249,1,0,0,0,2264,
	2265,5,49,0,0,2265,2270,3,252,126,0,2266,2267,5,5,0,0,2267,2269,3,252,126,
	0,2268,2266,1,0,0,0,2269,2272,1,0,0,0,2270,2268,1,0,0,0,2270,2271,1,0,0,
	0,2271,2274,1,0,0,0,2272,2270,1,0,0,0,2273,2275,5,5,0,0,2274,2273,1,0,0,
	0,2274,2275,1,0,0,0,2275,2276,1,0,0,0,2276,2277,5,50,0,0,2277,251,1,0,0,
	0,2278,2281,3,266,133,0,2279,2281,3,82,41,0,2280,2278,1,0,0,0,2280,2279,
	1,0,0,0,2281,253,1,0,0,0,2282,2283,6,127,-1,0,2283,2284,5,49,0,0,2284,2285,
	5,180,0,0,2285,2286,7,10,0,0,2286,2287,3,254,127,0,2287,2288,5,50,0,0,2288,
	2438,1,0,0,0,2289,2290,5,49,0,0,2290,2291,3,254,127,0,2291,2292,5,50,0,
	0,2292,2438,1,0,0,0,2293,2294,5,49,0,0,2294,2297,3,254,127,0,2295,2296,
	5,5,0,0,2296,2298,3,254,127,0,2297,2295,1,0,0,0,2298,2299,1,0,0,0,2299,
	2297,1,0,0,0,2299,2300,1,0,0,0,2300,2301,1,0,0,0,2301,2302,5,50,0,0,2302,
	2438,1,0,0,0,2303,2304,3,268,134,0,2304,2305,5,49,0,0,2305,2307,3,254,127,
	0,2306,2308,5,5,0,0,2307,2306,1,0,0,0,2307,2308,1,0,0,0,2308,2309,1,0,0,
	0,2309,2310,5,50,0,0,2310,2438,1,0,0,0,2311,2438,3,240,120,0,2312,2313,
	5,114,0,0,2313,2315,5,180,0,0,2314,2316,3,246,123,0,2315,2314,1,0,0,0,2315,
	2316,1,0,0,0,2316,2317,1,0,0,0,2317,2438,3,244,122,0,2318,2319,5,114,0,
	0,2319,2322,3,266,133,0,2320,2321,5,66,0,0,2321,2323,5,67,0,0,2322,2320,
	1,0,0,0,2323,2324,1,0,0,0,2324,2322,1,0,0,0,2324,2325,1,0,0,0,2325,2326,
	1,0,0,0,2326,2327,5,49,0,0,2327,2328,3,254,127,0,2328,2329,5,50,0,0,2329,
	2438,1,0,0,0,2330,2331,5,114,0,0,2331,2332,5,148,0,0,2332,2333,5,49,0,0,
	2333,2334,3,254,127,0,2334,2335,5,50,0,0,2335,2438,1,0,0,0,2336,2337,5,
	55,0,0,2337,2338,5,49,0,0,2338,2339,3,266,133,0,2339,2340,5,50,0,0,2340,
	2341,5,12,0,0,2341,2342,5,180,0,0,2342,2438,1,0,0,0,2343,2344,5,115,0,0,
	2344,2438,3,244,122,0,2345,2346,5,116,0,0,2346,2438,3,244,122,0,2347,2348,
	5,117,0,0,2348,2438,3,244,122,0,2349,2350,5,118,0,0,2350,2438,3,244,122,
	0,2351,2352,5,119,0,0,2352,2353,5,49,0,0,2353,2354,5,180,0,0,2354,2355,
	5,12,0,0,2355,2356,5,180,0,0,2356,2357,5,5,0,0,2357,2358,3,244,122,0,2358,
	2359,5,50,0,0,2359,2438,1,0,0,0,2360,2361,5,120,0,0,2361,2438,3,244,122,
	0,2362,2363,5,121,0,0,2363,2438,3,244,122,0,2364,2365,5,122,0,0,2365,2366,
	5,49,0,0,2366,2367,3,254,127,0,2367,2368,5,5,0,0,2368,2369,3,250,125,0,
	2369,2370,5,50,0,0,2370,2438,1,0,0,0,2371,2372,5,123,0,0,2372,2373,5,49,
	0,0,2373,2374,3,254,127,0,2374,2375,5,5,0,0,2375,2376,3,250,125,0,2376,
	2377,5,5,0,0,2377,2378,5,145,0,0,2378,2379,5,50,0,0,2379,2438,1,0,0,0,2380,
	2381,5,124,0,0,2381,2382,5,66,0,0,2382,2383,3,254,127,0,2383,2384,5,67,
	0,0,2384,2385,7,14,0,0,2385,2438,1,0,0,0,2386,2387,5,125,0,0,2387,2388,
	5,66,0,0,2388,2389,3,254,127,0,2389,2390,5,67,0,0,2390,2391,7,15,0,0,2391,
	2438,1,0,0,0,2392,2393,7,16,0,0,2393,2438,3,254,127,21,2394,2406,5,66,0,
	0,2395,2400,3,254,127,0,2396,2397,5,5,0,0,2397,2399,3,254,127,0,2398,2396,
	1,0,0,0,2399,2402,1,0,0,0,2400,2398,1,0,0,0,2400,2401,1,0,0,0,2401,2404,
	1,0,0,0,2402,2400,1,0,0,0,2403,2405,5,5,0,0,2404,2403,1,0,0,0,2404,2405,
	1,0,0,0,2405,2407,1,0,0,0,2406,2395,1,0,0,0,2406,2407,1,0,0,0,2407,2408,
	1,0,0,0,2408,2438,5,67,0,0,2409,2410,5,74,0,0,2410,2411,5,12,0,0,2411,2412,
	5,180,0,0,2412,2413,5,12,0,0,2413,2414,5,180,0,0,2414,2415,5,66,0,0,2415,
	2416,3,254,127,0,2416,2417,5,67,0,0,2417,2418,3,256,128,0,2418,2438,1,0,
	0,0,2419,2420,5,74,0,0,2420,2421,5,12,0,0,2421,2426,5,180,0,0,2422,2423,
	5,66,0,0,2423,2424,3,254,127,0,2424,2425,5,67,0,0,2425,2427,1,0,0,0,2426,
	2422,1,0,0,0,2427,2428,1,0,0,0,2428,2426,1,0,0,0,2428,2429,1,0,0,0,2429,
	2438,1,0,0,0,2430,2431,5,74,0,0,2431,2432,5,12,0,0,2432,2438,5,180,0,0,
	2433,2438,5,74,0,0,2434,2438,5,160,0,0,2435,2438,3,14,7,0,2436,2438,3,260,
	130,0,2437,2282,1,0,0,0,2437,2289,1,0,0,0,2437,2293,1,0,0,0,2437,2303,1,
	0,0,0,2437,2311,1,0,0,0,2437,2312,1,0,0,0,2437,2318,1,0,0,0,2437,2330,1,
	0,0,0,2437,2336,1,0,0,0,2437,2343,1,0,0,0,2437,2345,1,0,0,0,2437,2347,1,
	0,0,0,2437,2349,1,0,0,0,2437,2351,1,0,0,0,2437,2360,1,0,0,0,2437,2362,1,
	0,0,0,2437,2364,1,0,0,0,2437,2371,1,0,0,0,2437,2380,1,0,0,0,2437,2386,1,
	0,0,0,2437,2392,1,0,0,0,2437,2394,1,0,0,0,2437,2409,1,0,0,0,2437,2419,1,
	0,0,0,2437,2430,1,0,0,0,2437,2433,1,0,0,0,2437,2434,1,0,0,0,2437,2435,1,
	0,0,0,2437,2436,1,0,0,0,2438,2546,1,0,0,0,2439,2440,10,20,0,0,2440,2441,
	5,17,0,0,2441,2545,3,254,127,20,2442,2443,10,19,0,0,2443,2444,7,17,0,0,
	2444,2545,3,254,127,20,2445,2446,10,18,0,0,2446,2447,7,18,0,0,2447,2545,
	3,254,127,19,2448,2449,10,17,0,0,2449,2450,7,19,0,0,2450,2545,3,254,127,
	18,2451,2452,10,16,0,0,2452,2453,7,20,0,0,2453,2545,3,254,127,17,2454,2455,
	10,15,0,0,2455,2456,7,21,0,0,2456,2545,3,254,127,16,2457,2458,10,14,0,0,
	2458,2459,5,24,0,0,2459,2545,3,254,127,15,2460,2461,10,13,0,0,2461,2462,
	5,26,0,0,2462,2545,3,254,127,14,2463,2464,10,12,0,0,2464,2465,5,25,0,0,
	2465,2545,3,254,127,13,2466,2467,10,11,0,0,2467,2468,5,130,0,0,2468,2545,
	3,254,127,12,2469,2470,10,10,0,0,2470,2471,5,131,0,0,2471,2545,3,254,127,
	11,2472,2473,10,9,0,0,2473,2474,5,132,0,0,2474,2475,3,254,127,0,2475,2476,
	5,110,0,0,2476,2477,3,254,127,9,2477,2545,1,0,0,0,2478,2479,10,33,0,0,2479,
	2480,5,66,0,0,2480,2481,3,254,127,0,2481,2482,5,110,0,0,2482,2483,3,254,
	127,0,2483,2484,5,67,0,0,2484,2545,1,0,0,0,2485,2486,10,32,0,0,2486,2487,
	5,66,0,0,2487,2488,5,145,0,0,2488,2545,5,67,0,0,2489,2490,10,31,0,0,2490,
	2491,5,66,0,0,2491,2492,3,254,127,0,2492,2493,5,67,0,0,2493,2545,1,0,0,
	0,2494,2495,10,28,0,0,2495,2545,7,22,0,0,2496,2497,10,27,0,0,2497,2498,
	5,167,0,0,2498,2499,5,49,0,0,2499,2500,3,254,127,0,2500,2501,5,50,0,0,2501,
	2545,1,0,0,0,2502,2503,10,26,0,0,2503,2504,5,168,0,0,2504,2505,5,49,0,0,
	2505,2506,3,254,127,0,2506,2507,5,5,0,0,2507,2508,3,254,127,0,2508,2509,
	5,50,0,0,2509,2545,1,0,0,0,2510,2511,10,25,0,0,2511,2512,5,12,0,0,2512,
	2514,5,180,0,0,2513,2515,3,246,123,0,2514,2513,1,0,0,0,2514,2515,1,0,0,
	0,2515,2516,1,0,0,0,2516,2517,5,49,0,0,2517,2529,5,4,0,0,2518,2523,3,242,
	121,0,2519,2520,5,5,0,0,2520,2522,3,242,121,0,2521,2519,1,0,0,0,2522,2525,
	1,0,0,0,2523,2521,1,0,0,0,2523,2524,1,0,0,0,2524,2527,1,0,0,0,2525,2523,
	1,0,0,0,2526,2528,5,5,0,0,2527,2526,1,0,0,0,2527,2528,1,0,0,0,2528,2530,
	1,0,0,0,2529,2518,1,0,0,0,2529,2530,1,0,0,0,2530,2531,1,0,0,0,2531,2532,
	5,6,0,0,2532,2545,5,50,0,0,2533,2534,10,24,0,0,2534,2535,5,12,0,0,2535,
	2537,5,180,0,0,2536,2538,3,246,123,0,2537,2536,1,0,0,0,2537,2538,1,0,0,
	0,2538,2539,1,0,0,0,2539,2545,3,244,122,0,2540,2541,10,23,0,0,2541,2545,
	3,256,128,0,2542,2543,10,22,0,0,2543,2545,7,11,0,0,2544,2439,1,0,0,0,2544,
	2442,1,0,0,0,2544,2445,1,0,0,0,2544,2448,1,0,0,0,2544,2451,1,0,0,0,2544,
	2454,1,0,0,0,2544,2457,1,0,0,0,2544,2460,1,0,0,0,2544,2463,1,0,0,0,2544,
	2466,1,0,0,0,2544,2469,1,0,0,0,2544,2472,1,0,0,0,2544,2478,1,0,0,0,2544,
	2485,1,0,0,0,2544,2489,1,0,0,0,2544,2494,1,0,0,0,2544,2496,1,0,0,0,2544,
	2502,1,0,0,0,2544,2510,1,0,0,0,2544,2533,1,0,0,0,2544,2540,1,0,0,0,2544,
	2542,1,0,0,0,2545,2548,1,0,0,0,2546,2544,1,0,0,0,2546,2547,1,0,0,0,2547,
	255,1,0,0,0,2548,2546,1,0,0,0,2549,2550,5,12,0,0,2550,2563,5,180,0,0,2551,
	2563,5,163,0,0,2552,2563,5,172,0,0,2553,2563,5,173,0,0,2554,2563,5,174,
	0,0,2555,2563,5,175,0,0,2556,2563,5,176,0,0,2557,2563,5,177,0,0,2558,2563,
	5,178,0,0,2559,2563,5,179,0,0,2560,2563,5,170,0,0,2561,2563,5,171,0,0,2562,
	2549,1,0,0,0,2562,2551,1,0,0,0,2562,2552,1,0,0,0,2562,2553,1,0,0,0,2562,
	2554,1,0,0,0,2562,2555,1,0,0,0,2562,2556,1,0,0,0,2562,2557,1,0,0,0,2562,
	2558,1,0,0,0,2562,2559,1,0,0,0,2562,2560,1,0,0,0,2562,2561,1,0,0,0,2563,
	257,1,0,0,0,2564,2565,7,23,0,0,2565,259,1,0,0,0,2566,2581,5,141,0,0,2567,
	2581,3,262,131,0,2568,2581,3,264,132,0,2569,2573,5,151,0,0,2570,2572,5,
	151,0,0,2571,2570,1,0,0,0,2572,2575,1,0,0,0,2573,2571,1,0,0,0,2573,2574,
	1,0,0,0,2574,2581,1,0,0,0,2575,2573,1,0,0,0,2576,2581,5,161,0,0,2577,2581,
	5,162,0,0,2578,2581,5,152,0,0,2579,2581,5,153,0,0,2580,2566,1,0,0,0,2580,
	2567,1,0,0,0,2580,2568,1,0,0,0,2580,2569,1,0,0,0,2580,2576,1,0,0,0,2580,
	2577,1,0,0,0,2580,2578,1,0,0,0,2580,2579,1,0,0,0,2581,261,1,0,0,0,2582,
	2584,5,145,0,0,2583,2585,7,24,0,0,2584,2583,1,0,0,0,2584,2585,1,0,0,0,2585,
	263,1,0,0,0,2586,2587,5,144,0,0,2587,265,1,0,0,0,2588,2589,5,108,0,0,2589,
	2639,5,59,0,0,2590,2639,5,108,0,0,2591,2639,5,146,0,0,2592,2639,5,147,0,
	0,2593,2639,5,149,0,0,2594,2639,5,148,0,0,2595,2639,5,156,0,0,2596,2639,
	5,157,0,0,2597,2639,5,138,0,0,2598,2639,5,139,0,0,2599,2639,5,158,0,0,2600,
	2639,5,159,0,0,2601,2602,5,7,0,0,2602,2611,5,49,0,0,2603,2608,3,266,133,
	0,2604,2605,5,5,0,0,2605,2607,3,266,133,0,2606,2604,1,0,0,0,2607,2610,1,
	0,0,0,2608,2606,1,0,0,0,2608,2609,1,0,0,0,2609,2612,1,0,0,0,2610,2608,1,
	0,0,0,2611,2603,1,0,0,0,2611,2612,1,0,0,0,2612,2613,1,0,0,0,2613,2617,5,
	50,0,0,2614,2616,7,25,0,0,2615,2614,1,0,0,0,2616,2619,1,0,0,0,2617,2615,
	1,0,0,0,2617,2618,1,0,0,0,2618,2632,1,0,0,0,2619,2617,1,0,0,0,2620,2621,
	5,73,0,0,2621,2622,5,49,0,0,2622,2627,3,266,133,0,2623,2624,5,5,0,0,2624,
	2626,3,266,133,0,2625,2623,1,0,0,0,2626,2629,1,0,0,0,2627,2625,1,0,0,0,
	2627,2628,1,0,0,0,2628,2630,1,0,0,0,2629,2627,1,0,0,0,2630,2631,5,50,0,
	0,2631,2633,1,0,0,0,2632,2620,1,0,0,0,2632,2633,1,0,0,0,2633,2639,1,0,0,
	0,2634,2635,5,180,0,0,2635,2636,5,12,0,0,2636,2639,5,180,0,0,2637,2639,
	5,180,0,0,2638,2588,1,0,0,0,2638,2590,1,0,0,0,2638,2591,1,0,0,0,2638,2592,
	1,0,0,0,2638,2593,1,0,0,0,2638,2594,1,0,0,0,2638,2595,1,0,0,0,2638,2596,
	1,0,0,0,2638,2597,1,0,0,0,2638,2598,1,0,0,0,2638,2599,1,0,0,0,2638,2600,
	1,0,0,0,2638,2601,1,0,0,0,2638,2634,1,0,0,0,2638,2637,1,0,0,0,2639,267,
	1,0,0,0,2640,2641,7,26,0,0,2641,269,1,0,0,0,279,273,279,292,294,314,318,
	325,330,338,342,348,359,362,372,376,383,386,390,395,399,415,419,426,429,
	432,446,449,460,462,477,492,496,506,512,518,524,530,536,542,548,554,560,
	565,573,576,593,595,602,609,611,615,627,631,633,637,643,646,649,659,663,
	665,672,680,687,700,704,711,731,737,744,755,761,768,776,787,796,802,808,
	816,823,829,834,840,847,853,859,863,867,875,880,888,898,903,907,919,928,
	930,936,942,949,959,961,965,971,978,994,1003,1007,1013,1022,1026,1034,1038,
	1044,1048,1050,1058,1062,1064,1072,1076,1082,1086,1092,1096,1098,1104,1109,
	1143,1169,1183,1195,1199,1204,1209,1218,1222,1224,1246,1251,1257,1272,1281,
	1285,1287,1296,1301,1312,1314,1319,1333,1338,1349,1359,1367,1382,1384,1389,
	1401,1406,1416,1421,1426,1437,1450,1456,1464,1470,1474,1484,1496,1506,1517,
	1524,1530,1537,1550,1575,1583,1604,1611,1638,1657,1675,1691,1711,1723,1733,
	1741,1745,1754,1764,1776,1784,1829,1838,1844,1854,1866,1893,1911,1919,1924,
	1931,1946,1949,1952,1975,1978,1987,1990,1997,2006,2009,2020,2030,2043,2047,
	2057,2065,2071,2077,2086,2090,2092,2098,2106,2110,2112,2115,2128,2134,2143,
	2147,2149,2158,2172,2182,2190,2194,2196,2214,2218,2220,2224,2236,2240,2242,
	2252,2256,2270,2274,2280,2299,2307,2315,2324,2400,2404,2406,2428,2437,2514,
	2523,2527,2529,2537,2544,2546,2562,2573,2580,2584,2608,2611,2617,2627,2632,
	2638];

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
