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
	public static readonly RULE_transferStatement = 57;
	public static readonly RULE_tokenContainerMethodStatement = 58;
	public static readonly RULE_returnStatement = 59;
	public static readonly RULE_functionCallStatement = 60;
	public static readonly RULE_addressMethodStatement = 61;
	public static readonly RULE_selfdestructStatement = 62;
	public static readonly RULE_emitStatement = 63;
	public static readonly RULE_assignmentStatement = 64;
	public static readonly RULE_lvMember = 65;
	public static readonly RULE_mappingDeleteStatement = 66;
	public static readonly RULE_variableDefinition = 67;
	public static readonly RULE_tupleAssignment = 68;
	public static readonly RULE_tupleSlot = 69;
	public static readonly RULE_assignStatement = 70;
	public static readonly RULE_arrayPushStatement = 71;
	public static readonly RULE_pushArgument = 72;
	public static readonly RULE_arrayPopStatement = 73;
	public static readonly RULE_arrayDeleteStatement = 74;
	public static readonly RULE_stateArrayPushStatement = 75;
	public static readonly RULE_stateArrayPopStatement = 76;
	public static readonly RULE_deleteStatement = 77;
	public static readonly RULE_timeOpStatement = 78;
	public static readonly RULE_requireStatement = 79;
	public static readonly RULE_ifStatement = 80;
	public static readonly RULE_loopStatement = 81;
	public static readonly RULE_forOfEntriesStatement = 82;
	public static readonly RULE_forInStatement = 83;
	public static readonly RULE_forOfStatement = 84;
	public static readonly RULE_forStatement = 85;
	public static readonly RULE_forInit = 86;
	public static readonly RULE_forCondition = 87;
	public static readonly RULE_forUpdate = 88;
	public static readonly RULE_doWhileStatement = 89;
	public static readonly RULE_whileStatement = 90;
	public static readonly RULE_consoleStatement = 91;
	public static readonly RULE_assemblyStatement = 92;
	public static readonly RULE_yulBlock = 93;
	public static readonly RULE_yulStatement = 94;
	public static readonly RULE_yulVariableDeclaration = 95;
	public static readonly RULE_yulAssignment = 96;
	public static readonly RULE_yulIf = 97;
	public static readonly RULE_yulSwitch = 98;
	public static readonly RULE_yulCase = 99;
	public static readonly RULE_yulDefault = 100;
	public static readonly RULE_yulForLoop = 101;
	public static readonly RULE_yulFunctionDefinition = 102;
	public static readonly RULE_yulExpression = 103;
	public static readonly RULE_yulFunctionCall = 104;
	public static readonly RULE_yulFunctionName = 105;
	public static readonly RULE_yulPath = 106;
	public static readonly RULE_yulLiteral = 107;
	public static readonly RULE_uncheckedStatement = 108;
	public static readonly RULE_switchStatement = 109;
	public static readonly RULE_switchCase = 110;
	public static readonly RULE_switchDefault = 111;
	public static readonly RULE_tryCatchStatement = 112;
	public static readonly RULE_tryReturns = 113;
	public static readonly RULE_catchClause = 114;
	public static readonly RULE_breakStatement = 115;
	public static readonly RULE_continueStatement = 116;
	public static readonly RULE_requireMessage = 117;
	public static readonly RULE_revertStatement = 118;
	public static readonly RULE_assertStatement = 119;
	public static readonly RULE_consoleParameter = 120;
	public static readonly RULE_consoleParameterList = 121;
	public static readonly RULE_functionCall = 122;
	public static readonly RULE_namedArg = 123;
	public static readonly RULE_expressionList = 124;
	public static readonly RULE_callOptions = 125;
	public static readonly RULE_callOption = 126;
	public static readonly RULE_typeList = 127;
	public static readonly RULE_typeListItem = 128;
	public static readonly RULE_expression = 129;
	public static readonly RULE_memberName = 130;
	public static readonly RULE_modifier = 131;
	public static readonly RULE_literal = 132;
	public static readonly RULE_numberLiteral = 133;
	public static readonly RULE_decimalLiteral = 134;
	public static readonly RULE_typeName = 135;
	public static readonly RULE_typeCast = 136;
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
		"receiveDefinition", "receiveModifier", "parentInvocation", "stateVariableDeclaration", 
		"collectionModifier", "stateVariableVisibility", "mappingType", "arrayType", 
		"modifierDefinition", "modifierStatement", "placeholderStatement", "functionDefinition", 
		"customModifierInvocation", "functionModifier", "overrideSpecifier", "unsafeModifier", 
		"returnType", "returnParam", "parameterList", "parameter", "block", "statement", 
		"transferStatement", "tokenContainerMethodStatement", "returnStatement", 
		"functionCallStatement", "addressMethodStatement", "selfdestructStatement", 
		"emitStatement", "assignmentStatement", "lvMember", "mappingDeleteStatement", 
		"variableDefinition", "tupleAssignment", "tupleSlot", "assignStatement", 
		"arrayPushStatement", "pushArgument", "arrayPopStatement", "arrayDeleteStatement", 
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
		"expressionList", "callOptions", "callOption", "typeList", "typeListItem", 
		"expression", "memberName", "modifier", "literal", "numberLiteral", "decimalLiteral", 
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
			this.state = 277;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===37) {
				{
				{
				this.state = 274;
				this.pragmaDirective();
				}
				}
				this.state = 279;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 283;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===1) {
				{
				{
				this.state = 280;
				this.importDirective();
				}
				}
				this.state = 285;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 298;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1842241) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 296;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 2, this._ctx) ) {
				case 1:
					{
					this.state = 286;
					this.constantDefinition();
					}
					break;
				case 2:
					{
					this.state = 287;
					this.enumDefinition();
					}
					break;
				case 3:
					{
					this.state = 288;
					this.structDefinition();
					}
					break;
				case 4:
					{
					this.state = 289;
					this.typeDefinition();
					}
					break;
				case 5:
					{
					this.state = 290;
					this.usingForDirective();
					}
					break;
				case 6:
					{
					this.state = 291;
					this.errorDefinition();
					}
					break;
				case 7:
					{
					this.state = 292;
					this.interfaceDefinition();
					}
					break;
				case 8:
					{
					this.state = 293;
					this.freeFunctionDefinition();
					}
					break;
				case 9:
					{
					this.state = 294;
					this.libraryDefinition();
					}
					break;
				case 10:
					{
					this.state = 295;
					this.contractDefinition();
					}
					break;
				}
				}
				this.state = 300;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 301;
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
			this.state = 329;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 6, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 303;
				this.match(SolidCashParser.T__0);
				this.state = 304;
				this.match(SolidCashParser.StringLiteral);
				this.state = 305;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 306;
				this.match(SolidCashParser.T__0);
				this.state = 307;
				this.match(SolidCashParser.StringLiteral);
				this.state = 308;
				this.match(SolidCashParser.T__2);
				this.state = 309;
				this.match(SolidCashParser.Identifier);
				this.state = 310;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 311;
				this.match(SolidCashParser.T__0);
				this.state = 312;
				this.match(SolidCashParser.T__3);
				this.state = 313;
				this.importBinding();
				this.state = 318;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 314;
						this.match(SolidCashParser.T__4);
						this.state = 315;
						this.importBinding();
						}
						}
					}
					this.state = 320;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				}
				this.state = 322;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 321;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 324;
				this.match(SolidCashParser.T__5);
				this.state = 325;
				this.match(SolidCashParser.Identifier);
				this.state = 326;
				this.match(SolidCashParser.StringLiteral);
				this.state = 327;
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
			this.state = 331;
			this.match(SolidCashParser.Identifier);
			this.state = 334;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 332;
				this.match(SolidCashParser.T__2);
				this.state = 333;
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
			this.state = 336;
			this.match(SolidCashParser.T__6);
			this.state = 337;
			this.anyIdentifier();
			this.state = 338;
			this.parameterList();
			this.state = 342;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 339;
				this.functionModifier();
				}
				}
				this.state = 344;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 346;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 345;
				this.returnType();
				}
			}

			this.state = 348;
			this.match(SolidCashParser.T__3);
			this.state = 352;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 349;
				this.statement();
				}
				}
				this.state = 354;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 355;
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
			this.state = 394;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 17, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 357;
				this.match(SolidCashParser.T__7);
				this.state = 358;
				this.match(SolidCashParser.Identifier);
				this.state = 359;
				this.match(SolidCashParser.T__8);
				this.state = 363;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 11, this._ctx) ) {
				case 1:
					{
					this.state = 360;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 361;
					this.typeName();
					}
					break;
				case 3:
					{
					this.state = 362;
					this.match(SolidCashParser.T__9);
					}
					break;
				}
				this.state = 366;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 365;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 368;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 369;
				this.match(SolidCashParser.T__7);
				this.state = 370;
				this.match(SolidCashParser.T__3);
				this.state = 371;
				this.usingFunctionBinding();
				this.state = 376;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 372;
						this.match(SolidCashParser.T__4);
						this.state = 373;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 378;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				}
				this.state = 380;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 379;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 382;
				this.match(SolidCashParser.T__5);
				this.state = 383;
				this.match(SolidCashParser.T__8);
				this.state = 387;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 15, this._ctx) ) {
				case 1:
					{
					this.state = 384;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 385;
					this.typeName();
					}
					break;
				case 3:
					{
					this.state = 386;
					this.match(SolidCashParser.T__9);
					}
					break;
				}
				this.state = 390;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 389;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 392;
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
			this.state = 396;
			this.match(SolidCashParser.Identifier);
			this.state = 399;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===12) {
				{
				this.state = 397;
				this.match(SolidCashParser.T__11);
				this.state = 398;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 403;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 401;
				this.match(SolidCashParser.T__2);
				this.state = 402;
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
			this.state = 405;
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
			this.state = 407;
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
			this.state = 423;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 21, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 409;
				this.match(SolidCashParser.T__36);
				this.state = 410;
				this.pragmaName();
				this.state = 411;
				this.pragmaValue();
				this.state = 412;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 414;
				this.match(SolidCashParser.T__36);
				this.state = 415;
				this.match(SolidCashParser.Identifier);
				this.state = 419;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 2081) !== 0) || _la===180) {
					{
					{
					this.state = 416;
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
					this.state = 421;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 422;
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
			this.state = 425;
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
			this.state = 433;
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
				this.state = 428;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 427;
					this.versionConstraint();
					}
					}
					this.state = 430;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0) || _la===140 || _la===144);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 432;
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
			this.state = 436;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 1048783) !== 0)) {
				{
				this.state = 435;
				this.versionOperator();
				}
			}

			this.state = 438;
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
			this.state = 440;
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
			this.state = 442;
			this.match(SolidCashParser.T__40);
			this.state = 443;
			this.match(SolidCashParser.Identifier);
			this.state = 453;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 444;
				this.match(SolidCashParser.T__41);
				this.state = 445;
				this.match(SolidCashParser.Identifier);
				this.state = 450;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 446;
					this.match(SolidCashParser.T__4);
					this.state = 447;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 452;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 455;
			this.match(SolidCashParser.T__3);
			this.state = 466;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 1843969) !== 0)) {
				{
				this.state = 464;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 27, this._ctx) ) {
				case 1:
					{
					this.state = 456;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 457;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 458;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 459;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 460;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 461;
					this.interfaceStateVariable();
					}
					break;
				case 7:
					{
					this.state = 462;
					this.interfaceCollection();
					}
					break;
				case 8:
					{
					this.state = 463;
					this.interfaceFunction();
					}
					break;
				}
				}
				this.state = 468;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 469;
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
			this.state = 481;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 29, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 471;
				this.interfaceStateVariableVisibility();
				this.state = 472;
				this.mappingType();
				this.state = 473;
				this.match(SolidCashParser.Identifier);
				this.state = 474;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 476;
				this.interfaceStateVariableVisibility();
				this.state = 477;
				this.arrayType(0);
				this.state = 478;
				this.match(SolidCashParser.Identifier);
				this.state = 479;
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
			this.state = 483;
			this.interfaceStateVariableVisibility();
			this.state = 484;
			this.typeName();
			this.state = 485;
			this.match(SolidCashParser.Identifier);
			this.state = 486;
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
			this.state = 488;
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
			this.state = 490;
			this.match(SolidCashParser.T__6);
			this.state = 491;
			this.match(SolidCashParser.Identifier);
			this.state = 492;
			this.parameterList();
			this.state = 496;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0)) {
				{
				{
				this.state = 493;
				this.functionModifier();
				}
				}
				this.state = 498;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 500;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 499;
				this.returnType();
				}
			}

			this.state = 502;
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
			this.state = 504;
			this.match(SolidCashParser.T__44);
			this.state = 505;
			this.match(SolidCashParser.Identifier);
			this.state = 506;
			this.match(SolidCashParser.T__3);
			this.state = 518;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 815538945) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 516;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 32, this._ctx) ) {
				case 1:
					{
					this.state = 507;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 508;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 509;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 510;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 511;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 512;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 513;
					this.stateVariableDeclaration();
					}
					break;
				case 8:
					{
					this.state = 514;
					this.usingForDirective();
					}
					break;
				case 9:
					{
					this.state = 515;
					this.freeFunctionDefinition();
					}
					break;
				}
				}
				this.state = 520;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 521;
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
			this.state = 524;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===46) {
				{
				this.state = 523;
				this.match(SolidCashParser.T__45);
				}
			}

			this.state = 526;
			this.match(SolidCashParser.T__46);
			this.state = 527;
			this.match(SolidCashParser.Identifier);
			this.state = 529;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 528;
				this.parameterList();
				}
			}

			this.state = 540;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 531;
				this.match(SolidCashParser.T__41);
				this.state = 532;
				this.inheritanceSpecifier();
				this.state = 537;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 533;
					this.match(SolidCashParser.T__4);
					this.state = 534;
					this.inheritanceSpecifier();
					}
					}
					this.state = 539;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 542;
			this.match(SolidCashParser.T__3);
			this.state = 559;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 268435459) !== 0) || ((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 37411875) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 557;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 38, this._ctx) ) {
				case 1:
					{
					this.state = 543;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 544;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 545;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 546;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 547;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 548;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 549;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 550;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 551;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 552;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 553;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 554;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 555;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 556;
					this.receiveDefinition();
					}
					break;
				}
				}
				this.state = 561;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 562;
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
			this.state = 564;
			this.match(SolidCashParser.Identifier);
			this.state = 566;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 565;
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
			this.state = 568;
			this.match(SolidCashParser.T__6);
			this.state = 569;
			this.anyIdentifier();
			this.state = 570;
			this.parameterList();
			this.state = 575;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0) || _la===180) {
				{
				this.state = 573;
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
					this.state = 571;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 572;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 577;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 579;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 578;
				this.returnType();
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
	public eventDefinition(): EventDefinitionContext {
		let localctx: EventDefinitionContext = new EventDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 44, SolidCashParser.RULE_eventDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 583;
			this.match(SolidCashParser.T__47);
			this.state = 584;
			this.match(SolidCashParser.Identifier);
			this.state = 585;
			this.match(SolidCashParser.T__48);
			this.state = 597;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 586;
				this.eventParameter();
				this.state = 591;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 44, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 587;
						this.match(SolidCashParser.T__4);
						this.state = 588;
						this.eventParameter();
						}
						}
					}
					this.state = 593;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 44, this._ctx);
				}
				this.state = 595;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 594;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 599;
			this.match(SolidCashParser.T__49);
			this.state = 601;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===51) {
				{
				this.state = 600;
				this.match(SolidCashParser.T__50);
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
	public eventParameter(): EventParameterContext {
		let localctx: EventParameterContext = new EventParameterContext(this, this._ctx, this.state);
		this.enterRule(localctx, 46, SolidCashParser.RULE_eventParameter);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 607;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 48, this._ctx) ) {
			case 1:
				{
				this.state = 605;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 606;
				this.arrayType(0);
				}
				break;
			}
			this.state = 610;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===52) {
				{
				this.state = 609;
				this.match(SolidCashParser.T__51);
				}
			}

			this.state = 613;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 612;
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
			this.state = 615;
			this.match(SolidCashParser.T__34);
			this.state = 616;
			this.match(SolidCashParser.Identifier);
			this.state = 617;
			this.match(SolidCashParser.T__48);
			this.state = 629;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 618;
				this.errorParameter();
				this.state = 623;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 619;
						this.match(SolidCashParser.T__4);
						this.state = 620;
						this.errorParameter();
						}
						}
					}
					this.state = 625;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				}
				this.state = 627;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 626;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 631;
			this.match(SolidCashParser.T__49);
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
	public errorParameter(): ErrorParameterContext {
		let localctx: ErrorParameterContext = new ErrorParameterContext(this, this._ctx, this.state);
		this.enterRule(localctx, 50, SolidCashParser.RULE_errorParameter);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 634;
			this.typeName();
			this.state = 636;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 635;
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
			this.state = 638;
			this.match(SolidCashParser.T__52);
			this.state = 639;
			this.match(SolidCashParser.Identifier);
			this.state = 640;
			this.match(SolidCashParser.T__3);
			this.state = 642;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 641;
				this.structField();
				}
				}
				this.state = 644;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180);
			this.state = 646;
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
			this.state = 651;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 56, this._ctx) ) {
			case 1:
				{
				this.state = 648;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 649;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 650;
				this.mappingType();
				}
				break;
			}
			this.state = 653;
			this.anyIdentifier();
			this.state = 654;
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
			this.state = 656;
			this.match(SolidCashParser.T__53);
			this.state = 657;
			this.match(SolidCashParser.Identifier);
			this.state = 658;
			this.match(SolidCashParser.T__3);
			this.state = 659;
			this.enumMember();
			this.state = 664;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 57, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 660;
					this.match(SolidCashParser.T__4);
					this.state = 661;
					this.enumMember();
					}
					}
				}
				this.state = 666;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 57, this._ctx);
			}
			this.state = 668;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 667;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 670;
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
			this.state = 672;
			this.match(SolidCashParser.Identifier);
			this.state = 675;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===40) {
				{
				this.state = 673;
				this.match(SolidCashParser.T__39);
				this.state = 674;
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
			this.state = 677;
			this.match(SolidCashParser.T__54);
			this.state = 678;
			this.match(SolidCashParser.Identifier);
			this.state = 679;
			this.match(SolidCashParser.T__41);
			this.state = 680;
			this.typeName();
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
	public constantDefinition(): ConstantDefinitionContext {
		let localctx: ConstantDefinitionContext = new ConstantDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 62, SolidCashParser.RULE_constantDefinition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 683;
			this.typeName();
			this.state = 684;
			this.match(SolidCashParser.T__55);
			this.state = 685;
			this.match(SolidCashParser.Identifier);
			this.state = 686;
			this.match(SolidCashParser.T__39);
			this.state = 687;
			this.expression(0);
			this.state = 688;
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
			this.state = 690;
			this.match(SolidCashParser.T__56);
			this.state = 691;
			this.parameterList();
			this.state = 695;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 98307) !== 0)) {
				{
				{
				this.state = 692;
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
				this.state = 697;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 701;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 698;
				this.parentInvocation();
				}
				}
				this.state = 703;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 704;
			this.match(SolidCashParser.T__3);
			this.state = 708;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 705;
				this.statement();
				}
				}
				this.state = 710;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 711;
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
			this.state = 713;
			this.match(SolidCashParser.T__59);
			this.state = 714;
			this.parameterList();
			this.state = 715;
			this.match(SolidCashParser.T__43);
			this.state = 719;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 8197) !== 0)) {
				{
				{
				this.state = 716;
				this.fallbackModifier();
				}
				}
				this.state = 721;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 725;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 722;
				this.customModifierInvocation();
				}
				}
				this.state = 727;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 728;
			this.match(SolidCashParser.T__3);
			this.state = 732;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 729;
				this.statement();
				}
				}
				this.state = 734;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 735;
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
			this.state = 740;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 59:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 737;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 738;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 739;
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
			this.state = 742;
			this.match(SolidCashParser.T__61);
			this.state = 743;
			this.match(SolidCashParser.T__48);
			this.state = 744;
			this.match(SolidCashParser.T__49);
			this.state = 748;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===61 || _la===72) {
				{
				{
				this.state = 745;
				this.receiveModifier();
				}
				}
				this.state = 750;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 751;
			this.match(SolidCashParser.T__43);
			this.state = 755;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===61 || _la===72) {
				{
				{
				this.state = 752;
				this.receiveModifier();
				}
				}
				this.state = 757;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 758;
			this.match(SolidCashParser.T__58);
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
			this.match(SolidCashParser.T__3);
			this.state = 769;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 766;
				this.statement();
				}
				}
				this.state = 771;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 772;
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
			this.state = 776;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 61:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 774;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 2);
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
	public parentInvocation(): ParentInvocationContext {
		let localctx: ParentInvocationContext = new ParentInvocationContext(this, this._ctx, this.state);
		this.enterRule(localctx, 74, SolidCashParser.RULE_parentInvocation);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 778;
			this.match(SolidCashParser.Identifier);
			this.state = 779;
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
			this.state = 852;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 86, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 782;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 781;
					this.stateVariableVisibility();
					}
				}

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
				this.match(SolidCashParser.Identifier);
				this.state = 795;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 793;
					this.match(SolidCashParser.T__39);
					this.state = 794;
					this.expression(0);
					}
				}

				this.state = 797;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 799;
				this.typeName();
				this.state = 804;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					this.state = 802;
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
						this.state = 800;
						this.modifier();
						}
						break;
					case 72:
						{
						this.state = 801;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 806;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 807;
				this.stateVariableVisibility();
				this.state = 812;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===33 || _la===56 || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					this.state = 810;
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
						this.state = 808;
						this.modifier();
						}
						break;
					case 72:
						{
						this.state = 809;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 814;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 815;
				this.match(SolidCashParser.Identifier);
				this.state = 818;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 816;
					this.match(SolidCashParser.T__39);
					this.state = 817;
					this.expression(0);
					}
				}

				this.state = 820;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 823;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 1081347) !== 0)) {
					{
					this.state = 822;
					this.stateVariableVisibility();
					}
				}

				this.state = 825;
				this.mappingType();
				this.state = 829;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
					{
					{
					this.state = 826;
					this.collectionModifier();
					}
					}
					this.state = 831;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 832;
				this.match(SolidCashParser.Identifier);
				this.state = 833;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
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
				this.arrayType(0);
				this.state = 842;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1115687937) !== 0) || _la===72 || ((((_la - 133)) & ~0x1F) === 0 && ((1 << (_la - 133)) & 31) !== 0)) {
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
				this.state = 848;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 846;
					this.match(SolidCashParser.T__39);
					this.state = 847;
					this.expression(0);
					}
				}

				this.state = 850;
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
			this.state = 857;
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
				this.state = 854;
				this.modifier();
				}
				break;
			case 43:
			case 44:
			case 58:
			case 63:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 855;
				this.stateVariableVisibility();
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 856;
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
			this.state = 859;
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
			this.state = 897;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 93, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 861;
				this.match(SolidCashParser.T__63);
				this.state = 862;
				this.match(SolidCashParser.T__48);
				this.state = 863;
				this.typeName();
				this.state = 865;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 864;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 867;
				this.match(SolidCashParser.T__64);
				this.state = 868;
				this.typeName();
				this.state = 870;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 869;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 872;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 874;
				this.match(SolidCashParser.T__63);
				this.state = 875;
				this.match(SolidCashParser.T__48);
				this.state = 876;
				this.typeName();
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
				this.match(SolidCashParser.T__64);
				this.state = 881;
				this.mappingType();
				this.state = 882;
				this.match(SolidCashParser.T__49);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
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
				this.arrayType(0);
				this.state = 893;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 892;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 895;
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
			this.state = 909;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 94, this._ctx) ) {
			case 1:
				{
				this.state = 900;
				this.typeName();
				this.state = 901;
				this.match(SolidCashParser.T__65);
				this.state = 902;
				_la = this._input.LA(1);
				if(!(_la===145 || _la===180)) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 903;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 2:
				{
				this.state = 905;
				this.typeName();
				this.state = 906;
				this.match(SolidCashParser.T__65);
				this.state = 907;
				this.match(SolidCashParser.T__66);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 920;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 96, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 918;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 95, this._ctx) ) {
					case 1:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 911;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 912;
						this.match(SolidCashParser.T__65);
						this.state = 913;
						_la = this._input.LA(1);
						if(!(_la===145 || _la===180)) {
						this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 914;
						this.match(SolidCashParser.T__66);
						}
						break;
					case 2:
						{
						localctx = new ArrayTypeContext(this, _parentctx, _parentState);
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_arrayType);
						this.state = 915;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 916;
						this.match(SolidCashParser.T__65);
						this.state = 917;
						this.match(SolidCashParser.T__66);
						}
						break;
					}
					}
				}
				this.state = 922;
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
		this.enterRule(localctx, 86, SolidCashParser.RULE_modifierDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 923;
			this.match(SolidCashParser.T__67);
			this.state = 924;
			this.match(SolidCashParser.Identifier);
			this.state = 926;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 925;
				this.parameterList();
				}
			}

			this.state = 928;
			this.match(SolidCashParser.T__3);
			this.state = 932;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 929;
				this.modifierStatement();
				}
				}
				this.state = 934;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 935;
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
			this.state = 939;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 99, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 937;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 938;
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
			this.state = 941;
			this.match(SolidCashParser.T__68);
			this.state = 942;
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
			this.state = 944;
			this.match(SolidCashParser.T__6);
			this.state = 945;
			this.anyIdentifier();
			this.state = 946;
			this.parameterList();
			this.state = 951;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 3221323807) !== 0) || ((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & 3589) !== 0) || _la===180) {
				{
				this.state = 949;
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
					this.state = 947;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 948;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 953;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 955;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===73) {
				{
				this.state = 954;
				this.returnType();
				}
			}

			this.state = 957;
			this.match(SolidCashParser.T__3);
			this.state = 961;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				{
				this.state = 958;
				this.statement();
				}
				}
				this.state = 963;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 964;
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
			this.state = 966;
			this.match(SolidCashParser.Identifier);
			this.state = 968;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 967;
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
			this.state = 984;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 70:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 970;
				this.match(SolidCashParser.T__69);
				}
				break;
			case 71:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 971;
				this.match(SolidCashParser.T__70);
				}
				break;
			case 58:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 972;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 44:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 973;
				this.match(SolidCashParser.T__43);
				}
				break;
			case 43:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 974;
				this.match(SolidCashParser.T__42);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 975;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 59:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 976;
				this.match(SolidCashParser.T__58);
				}
				break;
			case 72:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 977;
				this.overrideSpecifier();
				}
				break;
			case 61:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 978;
				this.match(SolidCashParser.T__60);
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 979;
				this.unsafeModifier();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 980;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 981;
				this.match(SolidCashParser.T__27);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 982;
				this.match(SolidCashParser.T__30);
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 983;
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
			this.state = 986;
			this.match(SolidCashParser.T__71);
			this.state = 997;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 987;
				this.match(SolidCashParser.T__48);
				this.state = 988;
				this.match(SolidCashParser.Identifier);
				this.state = 993;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 989;
					this.match(SolidCashParser.T__4);
					this.state = 990;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 995;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 996;
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
			this.state = 999;
			this.match(SolidCashParser.T__31);
			this.state = 1003;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===49) {
				{
				this.state = 1000;
				this.match(SolidCashParser.T__48);
				this.state = 1001;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1002;
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
			this.state = 1005;
			this.match(SolidCashParser.T__72);
			this.state = 1006;
			this.match(SolidCashParser.T__48);
			this.state = 1007;
			this.returnParam();
			this.state = 1012;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 109, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1008;
					this.match(SolidCashParser.T__4);
					this.state = 1009;
					this.returnParam();
					}
					}
				}
				this.state = 1014;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 109, this._ctx);
			}
			this.state = 1016;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1015;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1018;
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
			this.state = 1040;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 115, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1020;
				this.typeName();
				this.state = 1024;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 111, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1021;
						this.modifier();
						}
						}
					}
					this.state = 1026;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 111, this._ctx);
				}
				this.state = 1028;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1027;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1030;
				this.arrayType(0);
				this.state = 1034;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 113, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 113, this._ctx);
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
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1042;
			this.match(SolidCashParser.T__48);
			this.state = 1054;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===64 || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3221225473) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1043;
				this.parameter();
				this.state = 1048;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 116, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1044;
						this.match(SolidCashParser.T__4);
						this.state = 1045;
						this.parameter();
						}
						}
					}
					this.state = 1050;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 116, this._ctx);
				}
				this.state = 1052;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1051;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1056;
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
			this.state = 1088;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 125, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1058;
				this.typeName();
				this.state = 1062;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 119, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1059;
						this.modifier();
						}
						}
					}
					this.state = 1064;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 119, this._ctx);
				}
				this.state = 1066;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 66977793) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1065;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1068;
				this.arrayType(0);
				this.state = 1072;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 121, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 121, this._ctx);
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
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1078;
				this.mappingType();
				this.state = 1082;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 123, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 123, this._ctx);
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
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1099;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1090;
				this.match(SolidCashParser.T__3);
				this.state = 1094;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 1072693397) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 236061761) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & 4251074335) !== 0) || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 2136473983) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
					{
					{
					this.state = 1091;
					this.statement();
					}
					}
					this.state = 1096;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1097;
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
				this.state = 1098;
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
			this.state = 1133;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 128, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1101;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1102;
				this.variableDefinition();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1103;
				this.tupleAssignment();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1104;
				this.arrayPushStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1105;
				this.arrayPopStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1106;
				this.arrayDeleteStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1107;
				this.stateArrayPushStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1108;
				this.stateArrayPopStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1109;
				this.assignStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1110;
				this.assignmentStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1111;
				this.mappingDeleteStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1112;
				this.timeOpStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1113;
				this.requireStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1114;
				this.ifStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1115;
				this.loopStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1116;
				this.consoleStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1117;
				this.emitStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1118;
				this.transferStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1119;
				this.tokenContainerMethodStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1120;
				this.returnStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1121;
				this.functionCallStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1122;
				this.addressMethodStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1123;
				this.selfdestructStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1124;
				this.assemblyStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1125;
				this.tryCatchStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1126;
				this.revertStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1127;
				this.assertStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1128;
				this.deleteStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1129;
				this.uncheckedStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1130;
				this.switchStatement();
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 31);
				{
				this.state = 1131;
				this.breakStatement();
				}
				break;
			case 32:
				this.enterOuterAlt(localctx, 32);
				{
				this.state = 1132;
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
		this.enterRule(localctx, 114, SolidCashParser.RULE_transferStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1135;
			this.match(SolidCashParser.T__73);
			this.state = 1136;
			this.match(SolidCashParser.T__11);
			this.state = 1137;
			this.match(SolidCashParser.Identifier);
			this.state = 1138;
			this.match(SolidCashParser.T__48);
			this.state = 1139;
			this.expression(0);
			this.state = 1140;
			this.match(SolidCashParser.T__4);
			this.state = 1141;
			this.expression(0);
			this.state = 1142;
			this.match(SolidCashParser.T__49);
			this.state = 1143;
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
		this.enterRule(localctx, 116, SolidCashParser.RULE_tokenContainerMethodStatement);
		let _la: number;
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
			this.match(SolidCashParser.T__65);
			this.state = 1149;
			this.expression(0);
			this.state = 1150;
			this.match(SolidCashParser.T__66);
			this.state = 1151;
			this.match(SolidCashParser.T__11);
			this.state = 1152;
			this.match(SolidCashParser.Identifier);
			this.state = 1153;
			this.match(SolidCashParser.T__48);
			this.state = 1154;
			this.expression(0);
			this.state = 1159;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1155;
				this.match(SolidCashParser.T__4);
				this.state = 1156;
				this.expression(0);
				}
				}
				this.state = 1161;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1162;
			this.match(SolidCashParser.T__49);
			this.state = 1163;
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
			this.state = 1194;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 133, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1165;
				this.match(SolidCashParser.T__74);
				this.state = 1166;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1167;
				this.match(SolidCashParser.T__74);
				this.state = 1168;
				this.expression(0);
				this.state = 1173;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1169;
					this.match(SolidCashParser.T__4);
					this.state = 1170;
					this.expression(0);
					}
					}
					this.state = 1175;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1176;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1178;
				this.match(SolidCashParser.T__74);
				this.state = 1179;
				this.match(SolidCashParser.T__48);
				this.state = 1180;
				this.expression(0);
				this.state = 1185;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 131, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1181;
						this.match(SolidCashParser.T__4);
						this.state = 1182;
						this.expression(0);
						}
						}
					}
					this.state = 1187;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 131, this._ctx);
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

				this.state = 1191;
				this.match(SolidCashParser.T__49);
				this.state = 1192;
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
		this.enterRule(localctx, 120, SolidCashParser.RULE_functionCallStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1241;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 139, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1196;
				this.match(SolidCashParser.Identifier);
				this.state = 1199;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1197;
					this.match(SolidCashParser.T__11);
					this.state = 1198;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1201;
				this.match(SolidCashParser.T__48);
				this.state = 1202;
				this.match(SolidCashParser.T__3);
				this.state = 1214;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1203;
					this.namedArg();
					this.state = 1208;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 135, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1204;
							this.match(SolidCashParser.T__4);
							this.state = 1205;
							this.namedArg();
							}
							}
						}
						this.state = 1210;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 135, this._ctx);
					}
					this.state = 1212;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1211;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1216;
				this.match(SolidCashParser.T__5);
				this.state = 1217;
				this.match(SolidCashParser.T__49);
				this.state = 1218;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1219;
				this.match(SolidCashParser.Identifier);
				this.state = 1220;
				this.expressionList();
				this.state = 1221;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1223;
				this.match(SolidCashParser.Identifier);
				this.state = 1224;
				this.match(SolidCashParser.T__11);
				this.state = 1225;
				this.match(SolidCashParser.Identifier);
				this.state = 1226;
				this.expressionList();
				this.state = 1227;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1229;
				this.match(SolidCashParser.Identifier);
				this.state = 1230;
				this.expressionList();
				this.state = 1231;
				this.match(SolidCashParser.T__11);
				this.state = 1232;
				this.match(SolidCashParser.Identifier);
				this.state = 1233;
				this.match(SolidCashParser.T__11);
				this.state = 1234;
				this.match(SolidCashParser.Identifier);
				this.state = 1236;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 1235;
					this.callOptions();
					}
				}

				this.state = 1238;
				this.expressionList();
				this.state = 1239;
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
		this.enterRule(localctx, 122, SolidCashParser.RULE_addressMethodStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1243;
			this.expression(0);
			this.state = 1244;
			this.match(SolidCashParser.T__11);
			this.state = 1245;
			this.match(SolidCashParser.Identifier);
			this.state = 1247;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===4) {
				{
				this.state = 1246;
				this.callOptions();
				}
			}

			this.state = 1249;
			this.expressionList();
			this.state = 1250;
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
		this.enterRule(localctx, 124, SolidCashParser.RULE_selfdestructStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1252;
			this.match(SolidCashParser.T__30);
			this.state = 1253;
			this.match(SolidCashParser.T__48);
			this.state = 1254;
			this.expression(0);
			this.state = 1255;
			this.match(SolidCashParser.T__49);
			this.state = 1256;
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
			this.state = 1291;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 146, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1258;
				this.match(SolidCashParser.T__75);
				this.state = 1259;
				this.match(SolidCashParser.Identifier);
				this.state = 1262;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1260;
					this.match(SolidCashParser.T__11);
					this.state = 1261;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1264;
				this.match(SolidCashParser.T__48);
				this.state = 1265;
				this.match(SolidCashParser.T__3);
				this.state = 1277;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1266;
					this.namedArg();
					this.state = 1271;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 142, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1267;
							this.match(SolidCashParser.T__4);
							this.state = 1268;
							this.namedArg();
							}
							}
						}
						this.state = 1273;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 142, this._ctx);
					}
					this.state = 1275;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1274;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1279;
				this.match(SolidCashParser.T__5);
				this.state = 1280;
				this.match(SolidCashParser.T__49);
				this.state = 1281;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1282;
				this.match(SolidCashParser.T__75);
				this.state = 1283;
				this.match(SolidCashParser.Identifier);
				this.state = 1286;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1284;
					this.match(SolidCashParser.T__11);
					this.state = 1285;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1288;
				this.expressionList();
				this.state = 1289;
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
		this.enterRule(localctx, 128, SolidCashParser.RULE_assignmentStatement);
		let _la: number;
		try {
			this.state = 1411;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 161, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1293;
				this.match(SolidCashParser.T__73);
				this.state = 1294;
				this.match(SolidCashParser.T__11);
				this.state = 1295;
				this.match(SolidCashParser.Identifier);
				this.state = 1304;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===66) {
					{
					this.state = 1300;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1296;
						this.match(SolidCashParser.T__65);
						this.state = 1297;
						this.expression(0);
						this.state = 1298;
						this.match(SolidCashParser.T__66);
						}
						}
						this.state = 1302;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===66);
					}
				}

				this.state = 1309;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12 || _la===163) {
					{
					{
					this.state = 1306;
					this.lvMember();
					}
					}
					this.state = 1311;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1312;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1313;
				this.expression(0);
				this.state = 1314;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1316;
				this.match(SolidCashParser.Identifier);
				this.state = 1321;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1317;
					this.match(SolidCashParser.T__65);
					this.state = 1318;
					this.expression(0);
					this.state = 1319;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1323;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1328;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12 || _la===163) {
					{
					{
					this.state = 1325;
					this.lvMember();
					}
					}
					this.state = 1330;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1331;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1332;
				this.expression(0);
				this.state = 1333;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1335;
				this.match(SolidCashParser.Identifier);
				this.state = 1337;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1336;
					this.lvMember();
					}
					}
					this.state = 1339;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12 || _la===163);
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
			case 4:
				this.enterOuterAlt(localctx, 4);
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
				this.state = 1355;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1351;
					this.match(SolidCashParser.T__65);
					this.state = 1352;
					this.expression(0);
					this.state = 1353;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1357;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1359;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1360;
				this.expression(0);
				this.state = 1361;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1363;
				this.match(SolidCashParser.T__73);
				this.state = 1364;
				this.match(SolidCashParser.T__11);
				this.state = 1365;
				this.match(SolidCashParser.Identifier);
				this.state = 1374;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===66) {
					{
					this.state = 1370;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1366;
						this.match(SolidCashParser.T__65);
						this.state = 1367;
						this.expression(0);
						this.state = 1368;
						this.match(SolidCashParser.T__66);
						}
						}
						this.state = 1372;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===66);
					}
				}

				this.state = 1379;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12 || _la===163) {
					{
					{
					this.state = 1376;
					this.lvMember();
					}
					}
					this.state = 1381;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1382;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1383;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1384;
				this.match(SolidCashParser.Identifier);
				this.state = 1389;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1385;
					this.match(SolidCashParser.T__65);
					this.state = 1386;
					this.expression(0);
					this.state = 1387;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1391;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1396;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12 || _la===163) {
					{
					{
					this.state = 1393;
					this.lvMember();
					}
					}
					this.state = 1398;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1399;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1400;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1402;
				this.match(SolidCashParser.Identifier);
				this.state = 1404;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1403;
					this.lvMember();
					}
					}
					this.state = 1406;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12 || _la===163);
				this.state = 1408;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1409;
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
		this.enterRule(localctx, 130, SolidCashParser.RULE_lvMember);
		try {
			this.state = 1416;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1413;
				this.match(SolidCashParser.T__11);
				this.state = 1414;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1415;
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
		this.enterRule(localctx, 132, SolidCashParser.RULE_mappingDeleteStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1418;
			this.match(SolidCashParser.T__73);
			this.state = 1419;
			this.match(SolidCashParser.T__11);
			this.state = 1420;
			this.match(SolidCashParser.Identifier);
			this.state = 1427;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===66) {
				{
				{
				this.state = 1421;
				this.match(SolidCashParser.T__65);
				this.state = 1422;
				this.expression(0);
				this.state = 1423;
				this.match(SolidCashParser.T__66);
				}
				}
				this.state = 1429;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1430;
			this.match(SolidCashParser.DotDelete);
			this.state = 1431;
			this.match(SolidCashParser.T__48);
			this.state = 1432;
			this.expression(0);
			this.state = 1433;
			this.match(SolidCashParser.T__49);
			this.state = 1434;
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
		this.enterRule(localctx, 134, SolidCashParser.RULE_variableDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1464;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 168, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1436;
				this.typeName();
				this.state = 1440;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 164, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1437;
						this.modifier();
						}
						}
					}
					this.state = 1442;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 164, this._ctx);
				}
				this.state = 1443;
				this.anyIdentifier();
				this.state = 1446;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1444;
					this.match(SolidCashParser.T__39);
					this.state = 1445;
					this.expression(0);
					}
				}

				this.state = 1448;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1450;
				this.arrayType(0);
				this.state = 1454;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1451;
						this.modifier();
						}
						}
					}
					this.state = 1456;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
				}
				this.state = 1457;
				this.anyIdentifier();
				this.state = 1460;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1458;
					this.match(SolidCashParser.T__39);
					this.state = 1459;
					this.expression(0);
					}
				}

				this.state = 1462;
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
		this.enterRule(localctx, 136, SolidCashParser.RULE_tupleAssignment);
		let _la: number;
		try {
			this.state = 1514;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 173, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1466;
				this.typeName();
				this.state = 1467;
				this.match(SolidCashParser.Identifier);
				this.state = 1472;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1468;
					this.match(SolidCashParser.T__4);
					this.state = 1469;
					this.typeName();
					this.state = 1470;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1474;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1476;
				this.match(SolidCashParser.T__39);
				this.state = 1477;
				this.expression(0);
				this.state = 1478;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1480;
				this.match(SolidCashParser.T__48);
				this.state = 1481;
				this.tupleSlot();
				this.state = 1484;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1482;
					this.match(SolidCashParser.T__4);
					this.state = 1483;
					this.tupleSlot();
					}
					}
					this.state = 1486;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1488;
				this.match(SolidCashParser.T__49);
				this.state = 1489;
				this.match(SolidCashParser.T__39);
				this.state = 1490;
				this.match(SolidCashParser.T__48);
				this.state = 1491;
				this.expression(0);
				this.state = 1494;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1492;
					this.match(SolidCashParser.T__4);
					this.state = 1493;
					this.expression(0);
					}
					}
					this.state = 1496;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1498;
				this.match(SolidCashParser.T__49);
				this.state = 1499;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1501;
				this.match(SolidCashParser.T__48);
				this.state = 1502;
				this.tupleSlot();
				this.state = 1505;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1503;
					this.match(SolidCashParser.T__4);
					this.state = 1504;
					this.tupleSlot();
					}
					}
					this.state = 1507;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1509;
				this.match(SolidCashParser.T__49);
				this.state = 1510;
				this.match(SolidCashParser.T__39);
				this.state = 1511;
				this.expression(0);
				this.state = 1512;
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
		this.enterRule(localctx, 138, SolidCashParser.RULE_tupleSlot);
		try {
			let _alt: number;
			this.state = 1527;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 175, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1516;
				this.typeName();
				this.state = 1520;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 174, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1517;
						this.modifier();
						}
						}
					}
					this.state = 1522;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 174, this._ctx);
				}
				this.state = 1523;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1525;
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
		this.enterRule(localctx, 140, SolidCashParser.RULE_assignStatement);
		let _la: number;
		try {
			this.state = 1540;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 176, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1529;
				this.match(SolidCashParser.Identifier);
				this.state = 1530;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===40 || ((((_la - 77)) & ~0x1F) === 0 && ((1 << (_la - 77)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1531;
				this.expression(0);
				this.state = 1532;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1534;
				this.match(SolidCashParser.Identifier);
				this.state = 1535;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1536;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1537;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===87 || _la===88)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1538;
				this.match(SolidCashParser.Identifier);
				this.state = 1539;
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
		this.enterRule(localctx, 142, SolidCashParser.RULE_arrayPushStatement);
		let _la: number;
		try {
			this.state = 1577;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 181, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1542;
				this.match(SolidCashParser.Identifier);
				this.state = 1543;
				this.match(SolidCashParser.DotPush);
				this.state = 1544;
				this.match(SolidCashParser.T__48);
				this.state = 1546;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 1545;
					this.pushArgument();
					}
				}

				this.state = 1548;
				this.match(SolidCashParser.T__49);
				this.state = 1549;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1550;
				this.match(SolidCashParser.Identifier);
				this.state = 1551;
				this.match(SolidCashParser.T__11);
				this.state = 1552;
				this.match(SolidCashParser.Identifier);
				this.state = 1553;
				this.match(SolidCashParser.DotPush);
				this.state = 1554;
				this.match(SolidCashParser.T__48);
				this.state = 1556;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 1555;
					this.pushArgument();
					}
				}

				this.state = 1558;
				this.match(SolidCashParser.T__49);
				this.state = 1559;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1560;
				this.match(SolidCashParser.Identifier);
				this.state = 1565;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1561;
					this.match(SolidCashParser.T__65);
					this.state = 1562;
					this.expression(0);
					this.state = 1563;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1567;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1569;
				this.match(SolidCashParser.DotPush);
				this.state = 1570;
				this.match(SolidCashParser.T__48);
				this.state = 1572;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 1571;
					this.pushArgument();
					}
				}

				this.state = 1574;
				this.match(SolidCashParser.T__49);
				this.state = 1575;
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
		this.enterRule(localctx, 144, SolidCashParser.RULE_pushArgument);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1579;
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
		this.enterRule(localctx, 146, SolidCashParser.RULE_arrayPopStatement);
		let _la: number;
		try {
			this.state = 1607;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 183, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1581;
				this.match(SolidCashParser.Identifier);
				this.state = 1582;
				this.match(SolidCashParser.DotPop);
				this.state = 1583;
				this.match(SolidCashParser.T__48);
				this.state = 1584;
				this.match(SolidCashParser.T__49);
				this.state = 1585;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1586;
				this.match(SolidCashParser.Identifier);
				this.state = 1587;
				this.match(SolidCashParser.T__11);
				this.state = 1588;
				this.match(SolidCashParser.Identifier);
				this.state = 1589;
				this.match(SolidCashParser.DotPop);
				this.state = 1590;
				this.match(SolidCashParser.T__48);
				this.state = 1591;
				this.match(SolidCashParser.T__49);
				this.state = 1592;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1593;
				this.match(SolidCashParser.Identifier);
				this.state = 1598;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1594;
					this.match(SolidCashParser.T__65);
					this.state = 1595;
					this.expression(0);
					this.state = 1596;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1600;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1602;
				this.match(SolidCashParser.DotPop);
				this.state = 1603;
				this.match(SolidCashParser.T__48);
				this.state = 1604;
				this.match(SolidCashParser.T__49);
				this.state = 1605;
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
		this.enterRule(localctx, 148, SolidCashParser.RULE_arrayDeleteStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1609;
			this.match(SolidCashParser.Identifier);
			this.state = 1610;
			this.match(SolidCashParser.DotDelete);
			this.state = 1611;
			this.match(SolidCashParser.T__48);
			this.state = 1612;
			this.expression(0);
			this.state = 1613;
			this.match(SolidCashParser.T__49);
			this.state = 1614;
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
		this.enterRule(localctx, 150, SolidCashParser.RULE_stateArrayPushStatement);
		let _la: number;
		try {
			this.state = 1657;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 188, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1616;
				this.match(SolidCashParser.T__73);
				this.state = 1617;
				this.match(SolidCashParser.T__11);
				this.state = 1618;
				this.match(SolidCashParser.Identifier);
				this.state = 1619;
				this.match(SolidCashParser.DotPush);
				this.state = 1620;
				this.match(SolidCashParser.T__48);
				this.state = 1622;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 1621;
					this.pushArgument();
					}
				}

				this.state = 1624;
				this.match(SolidCashParser.T__49);
				this.state = 1625;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1626;
				this.match(SolidCashParser.T__73);
				this.state = 1627;
				this.match(SolidCashParser.T__11);
				this.state = 1628;
				this.match(SolidCashParser.Identifier);
				this.state = 1633;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1629;
					this.match(SolidCashParser.T__65);
					this.state = 1630;
					this.expression(0);
					this.state = 1631;
					this.match(SolidCashParser.T__66);
					}
					}
					this.state = 1635;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===66);
				this.state = 1637;
				this.match(SolidCashParser.DotPush);
				this.state = 1638;
				this.match(SolidCashParser.T__48);
				this.state = 1640;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 1639;
					this.pushArgument();
					}
				}

				this.state = 1642;
				this.match(SolidCashParser.T__49);
				this.state = 1643;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1645;
				this.match(SolidCashParser.T__73);
				this.state = 1646;
				this.match(SolidCashParser.T__11);
				this.state = 1647;
				this.match(SolidCashParser.Identifier);
				this.state = 1648;
				this.match(SolidCashParser.T__11);
				this.state = 1649;
				this.match(SolidCashParser.Identifier);
				this.state = 1650;
				this.match(SolidCashParser.DotPush);
				this.state = 1651;
				this.match(SolidCashParser.T__48);
				this.state = 1653;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 67043337) !== 0) || ((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & 33686593) !== 0) || ((((_la - 108)) & ~0x1F) === 0 && ((1 << (_la - 108)) & 3222011841) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 4185597) !== 0) || _la===180) {
					{
					this.state = 1652;
					this.pushArgument();
					}
				}

				this.state = 1655;
				this.match(SolidCashParser.T__49);
				this.state = 1656;
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
		this.enterRule(localctx, 152, SolidCashParser.RULE_stateArrayPopStatement);
		let _la: number;
		try {
			this.state = 1691;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 190, this._ctx) ) {
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
		this.enterRule(localctx, 154, SolidCashParser.RULE_deleteStatement);
		let _la: number;
		try {
			this.state = 1745;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 195, this._ctx) ) {
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
		this.enterRule(localctx, 156, SolidCashParser.RULE_timeOpStatement);
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
		this.enterRule(localctx, 158, SolidCashParser.RULE_requireStatement);
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
		this.enterRule(localctx, 160, SolidCashParser.RULE_ifStatement);
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
			switch ( this._interp.adaptivePredict(this._input, 198, this._ctx) ) {
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
		this.enterRule(localctx, 162, SolidCashParser.RULE_loopStatement);
		try {
			this.state = 1784;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 199, this._ctx) ) {
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
		this.enterRule(localctx, 164, SolidCashParser.RULE_forOfEntriesStatement);
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
		this.enterRule(localctx, 166, SolidCashParser.RULE_forInStatement);
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
		this.enterRule(localctx, 168, SolidCashParser.RULE_forOfStatement);
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
		this.enterRule(localctx, 170, SolidCashParser.RULE_forStatement);
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
		this.enterRule(localctx, 172, SolidCashParser.RULE_forInit);
		let _la: number;
		try {
			this.state = 1854;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 203, this._ctx) ) {
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
		this.enterRule(localctx, 174, SolidCashParser.RULE_forCondition);
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
		this.enterRule(localctx, 176, SolidCashParser.RULE_forUpdate);
		let _la: number;
		try {
			this.state = 1866;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 204, this._ctx) ) {
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
		this.enterRule(localctx, 178, SolidCashParser.RULE_doWhileStatement);
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
		this.enterRule(localctx, 180, SolidCashParser.RULE_whileStatement);
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
		this.enterRule(localctx, 182, SolidCashParser.RULE_consoleStatement);
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
		this.enterRule(localctx, 184, SolidCashParser.RULE_assemblyStatement);
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
		this.enterRule(localctx, 186, SolidCashParser.RULE_yulBlock);
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
		this.enterRule(localctx, 188, SolidCashParser.RULE_yulStatement);
		try {
			this.state = 1911;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 206, this._ctx) ) {
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
		this.enterRule(localctx, 190, SolidCashParser.RULE_yulVariableDeclaration);
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
		this.enterRule(localctx, 192, SolidCashParser.RULE_yulAssignment);
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
		this.enterRule(localctx, 194, SolidCashParser.RULE_yulIf);
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
		this.enterRule(localctx, 196, SolidCashParser.RULE_yulSwitch);
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
		this.enterRule(localctx, 198, SolidCashParser.RULE_yulCase);
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
		this.enterRule(localctx, 200, SolidCashParser.RULE_yulDefault);
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
		this.enterRule(localctx, 202, SolidCashParser.RULE_yulForLoop);
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
		this.enterRule(localctx, 204, SolidCashParser.RULE_yulFunctionDefinition);
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
		this.enterRule(localctx, 206, SolidCashParser.RULE_yulExpression);
		try {
			this.state = 1997;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 217, this._ctx) ) {
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
		this.enterRule(localctx, 208, SolidCashParser.RULE_yulFunctionCall);
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
		this.enterRule(localctx, 210, SolidCashParser.RULE_yulFunctionName);
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
		this.enterRule(localctx, 212, SolidCashParser.RULE_yulPath);
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
		this.enterRule(localctx, 214, SolidCashParser.RULE_yulLiteral);
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
		this.enterRule(localctx, 216, SolidCashParser.RULE_uncheckedStatement);
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
		this.enterRule(localctx, 218, SolidCashParser.RULE_switchStatement);
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
		this.enterRule(localctx, 220, SolidCashParser.RULE_switchCase);
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
		this.enterRule(localctx, 222, SolidCashParser.RULE_switchDefault);
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
		this.enterRule(localctx, 224, SolidCashParser.RULE_tryCatchStatement);
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
		this.enterRule(localctx, 226, SolidCashParser.RULE_tryReturns);
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
				_alt = this._interp.adaptivePredict(this._input, 228, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 228, this._ctx);
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
		this.enterRule(localctx, 228, SolidCashParser.RULE_catchClause);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2096;
			this.match(SolidCashParser.T__111);
			this.state = 2098;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 231, this._ctx) ) {
			case 1:
				{
				this.state = 2097;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 2115;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 235, this._ctx) ) {
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
					_alt = this._interp.adaptivePredict(this._input, 232, this._ctx);
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
						_alt = this._interp.adaptivePredict(this._input, 232, this._ctx);
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
		this.enterRule(localctx, 230, SolidCashParser.RULE_breakStatement);
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
		this.enterRule(localctx, 232, SolidCashParser.RULE_continueStatement);
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
		this.enterRule(localctx, 234, SolidCashParser.RULE_requireMessage);
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
		this.enterRule(localctx, 236, SolidCashParser.RULE_revertStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 2172;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 242, this._ctx) ) {
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
					_alt = this._interp.adaptivePredict(this._input, 238, this._ctx);
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
						_alt = this._interp.adaptivePredict(this._input, 238, this._ctx);
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
		this.enterRule(localctx, 238, SolidCashParser.RULE_assertStatement);
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
		this.enterRule(localctx, 240, SolidCashParser.RULE_consoleParameter);
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
		this.enterRule(localctx, 242, SolidCashParser.RULE_consoleParameterList);
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
				_alt = this._interp.adaptivePredict(this._input, 244, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 244, this._ctx);
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
		this.enterRule(localctx, 244, SolidCashParser.RULE_functionCall);
		let _la: number;
		try {
			let _alt: number;
			this.state = 2224;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 250, this._ctx) ) {
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
					_alt = this._interp.adaptivePredict(this._input, 247, this._ctx);
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
						_alt = this._interp.adaptivePredict(this._input, 247, this._ctx);
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
		this.enterRule(localctx, 246, SolidCashParser.RULE_namedArg);
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
		this.enterRule(localctx, 248, SolidCashParser.RULE_expressionList);
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
				_alt = this._interp.adaptivePredict(this._input, 251, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 251, this._ctx);
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
		this.enterRule(localctx, 250, SolidCashParser.RULE_callOptions);
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
			_alt = this._interp.adaptivePredict(this._input, 254, this._ctx);
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
				_alt = this._interp.adaptivePredict(this._input, 254, this._ctx);
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
		this.enterRule(localctx, 252, SolidCashParser.RULE_callOption);
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
		this.enterRule(localctx, 254, SolidCashParser.RULE_typeList);
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
			_alt = this._interp.adaptivePredict(this._input, 256, this._ctx);
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
				_alt = this._interp.adaptivePredict(this._input, 256, this._ctx);
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
		this.enterRule(localctx, 256, SolidCashParser.RULE_typeListItem);
		try {
			this.state = 2280;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 258, this._ctx) ) {
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
		let _startState: number = 258;
		this.enterRecursionRule(localctx, 258, SolidCashParser.RULE_expression, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2437;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 267, this._ctx) ) {
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
					_alt = this._interp.adaptivePredict(this._input, 263, this._ctx);
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
						_alt = this._interp.adaptivePredict(this._input, 263, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 266, this._ctx);
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
			_alt = this._interp.adaptivePredict(this._input, 274, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2544;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 273, this._ctx) ) {
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
							_alt = this._interp.adaptivePredict(this._input, 269, this._ctx);
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
								_alt = this._interp.adaptivePredict(this._input, 269, this._ctx);
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
		this.enterRule(localctx, 260, SolidCashParser.RULE_memberName);
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
		this.enterRule(localctx, 262, SolidCashParser.RULE_modifier);
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
		this.enterRule(localctx, 264, SolidCashParser.RULE_literal);
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
				_alt = this._interp.adaptivePredict(this._input, 276, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 276, this._ctx);
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
		this.enterRule(localctx, 266, SolidCashParser.RULE_numberLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2582;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2584;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 278, this._ctx) ) {
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
		this.enterRule(localctx, 268, SolidCashParser.RULE_decimalLiteral);
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
		this.enterRule(localctx, 270, SolidCashParser.RULE_typeName);
		let _la: number;
		try {
			this.state = 2638;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 284, this._ctx) ) {
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
		this.enterRule(localctx, 272, SolidCashParser.RULE_typeCast);
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
		case 42:
			return this.arrayType_sempred(localctx as ArrayTypeContext, predIndex);
		case 129:
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
	7,133,2,134,7,134,2,135,7,135,2,136,7,136,1,0,5,0,276,8,0,10,0,12,0,279,
	9,0,1,0,5,0,282,8,0,10,0,12,0,285,9,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,
	0,1,0,5,0,297,8,0,10,0,12,0,300,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,5,1,317,8,1,10,1,12,1,320,9,1,1,1,3,1,323,8,1,1,
	1,1,1,1,1,1,1,1,1,3,1,330,8,1,1,2,1,2,1,2,3,2,335,8,2,1,3,1,3,1,3,1,3,5,
	3,341,8,3,10,3,12,3,344,9,3,1,3,3,3,347,8,3,1,3,1,3,5,3,351,8,3,10,3,12,
	3,354,9,3,1,3,1,3,1,4,1,4,1,4,1,4,1,4,1,4,3,4,364,8,4,1,4,3,4,367,8,4,1,
	4,1,4,1,4,1,4,1,4,1,4,5,4,375,8,4,10,4,12,4,378,9,4,1,4,3,4,381,8,4,1,4,
	1,4,1,4,1,4,1,4,3,4,388,8,4,1,4,3,4,391,8,4,1,4,1,4,3,4,395,8,4,1,5,1,5,
	1,5,3,5,400,8,5,1,5,1,5,3,5,404,8,5,1,6,1,6,1,7,1,7,1,8,1,8,1,8,1,8,1,8,
	1,8,1,8,1,8,5,8,418,8,8,10,8,12,8,421,9,8,1,8,3,8,424,8,8,1,9,1,9,1,10,
	4,10,429,8,10,11,10,12,10,430,1,10,3,10,434,8,10,1,11,3,11,437,8,11,1,11,
	1,11,1,12,1,12,1,13,1,13,1,13,1,13,1,13,1,13,5,13,449,8,13,10,13,12,13,
	452,9,13,3,13,454,8,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,5,13,
	465,8,13,10,13,12,13,468,9,13,1,13,1,13,1,14,1,14,1,14,1,14,1,14,1,14,1,
	14,1,14,1,14,1,14,3,14,482,8,14,1,15,1,15,1,15,1,15,1,15,1,16,1,16,1,17,
	1,17,1,17,1,17,5,17,495,8,17,10,17,12,17,498,9,17,1,17,3,17,501,8,17,1,
	17,1,17,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,5,18,
	517,8,18,10,18,12,18,520,9,18,1,18,1,18,1,19,3,19,525,8,19,1,19,1,19,1,
	19,3,19,530,8,19,1,19,1,19,1,19,1,19,5,19,536,8,19,10,19,12,19,539,9,19,
	3,19,541,8,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,
	19,1,19,1,19,1,19,5,19,558,8,19,10,19,12,19,561,9,19,1,19,1,19,1,20,1,20,
	3,20,567,8,20,1,21,1,21,1,21,1,21,1,21,5,21,574,8,21,10,21,12,21,577,9,
	21,1,21,3,21,580,8,21,1,21,1,21,1,22,1,22,1,22,1,22,1,22,1,22,5,22,590,
	8,22,10,22,12,22,593,9,22,1,22,3,22,596,8,22,3,22,598,8,22,1,22,1,22,3,
	22,602,8,22,1,22,1,22,1,23,1,23,3,23,608,8,23,1,23,3,23,611,8,23,1,23,3,
	23,614,8,23,1,24,1,24,1,24,1,24,1,24,1,24,5,24,622,8,24,10,24,12,24,625,
	9,24,1,24,3,24,628,8,24,3,24,630,8,24,1,24,1,24,1,24,1,25,1,25,3,25,637,
	8,25,1,26,1,26,1,26,1,26,4,26,643,8,26,11,26,12,26,644,1,26,1,26,1,27,1,
	27,1,27,3,27,652,8,27,1,27,1,27,1,27,1,28,1,28,1,28,1,28,1,28,1,28,5,28,
	663,8,28,10,28,12,28,666,9,28,1,28,3,28,669,8,28,1,28,1,28,1,29,1,29,1,
	29,3,29,676,8,29,1,30,1,30,1,30,1,30,1,30,1,30,1,31,1,31,1,31,1,31,1,31,
	1,31,1,31,1,32,1,32,1,32,5,32,694,8,32,10,32,12,32,697,9,32,1,32,5,32,700,
	8,32,10,32,12,32,703,9,32,1,32,1,32,5,32,707,8,32,10,32,12,32,710,9,32,
	1,32,1,32,1,33,1,33,1,33,1,33,5,33,718,8,33,10,33,12,33,721,9,33,1,33,5,
	33,724,8,33,10,33,12,33,727,9,33,1,33,1,33,5,33,731,8,33,10,33,12,33,734,
	9,33,1,33,1,33,1,34,1,34,1,34,3,34,741,8,34,1,35,1,35,1,35,1,35,5,35,747,
	8,35,10,35,12,35,750,9,35,1,35,1,35,5,35,754,8,35,10,35,12,35,757,9,35,
	1,35,1,35,5,35,761,8,35,10,35,12,35,764,9,35,1,35,1,35,5,35,768,8,35,10,
	35,12,35,771,9,35,1,35,1,35,1,36,1,36,3,36,777,8,36,1,37,1,37,1,37,1,38,
	3,38,783,8,38,1,38,1,38,1,38,5,38,788,8,38,10,38,12,38,791,9,38,1,38,1,
	38,1,38,3,38,796,8,38,1,38,1,38,1,38,1,38,1,38,5,38,803,8,38,10,38,12,38,
	806,9,38,1,38,1,38,1,38,5,38,811,8,38,10,38,12,38,814,9,38,1,38,1,38,1,
	38,3,38,819,8,38,1,38,1,38,1,38,3,38,824,8,38,1,38,1,38,5,38,828,8,38,10,
	38,12,38,831,9,38,1,38,1,38,1,38,1,38,3,38,837,8,38,1,38,1,38,5,38,841,
	8,38,10,38,12,38,844,9,38,1,38,1,38,1,38,3,38,849,8,38,1,38,1,38,3,38,853,
	8,38,1,39,1,39,1,39,3,39,858,8,39,1,40,1,40,1,41,1,41,1,41,1,41,3,41,866,
	8,41,1,41,1,41,1,41,3,41,871,8,41,1,41,1,41,1,41,1,41,1,41,1,41,3,41,879,
	8,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,3,41,889,8,41,1,41,1,41,1,
	41,3,41,894,8,41,1,41,1,41,3,41,898,8,41,1,42,1,42,1,42,1,42,1,42,1,42,
	1,42,1,42,1,42,1,42,3,42,910,8,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,5,
	42,919,8,42,10,42,12,42,922,9,42,1,43,1,43,1,43,3,43,927,8,43,1,43,1,43,
	5,43,931,8,43,10,43,12,43,934,9,43,1,43,1,43,1,44,1,44,3,44,940,8,44,1,
	45,1,45,1,45,1,46,1,46,1,46,1,46,1,46,5,46,950,8,46,10,46,12,46,953,9,46,
	1,46,3,46,956,8,46,1,46,1,46,5,46,960,8,46,10,46,12,46,963,9,46,1,46,1,
	46,1,47,1,47,3,47,969,8,47,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,
	1,48,1,48,1,48,1,48,1,48,3,48,985,8,48,1,49,1,49,1,49,1,49,1,49,5,49,992,
	8,49,10,49,12,49,995,9,49,1,49,3,49,998,8,49,1,50,1,50,1,50,1,50,3,50,1004,
	8,50,1,51,1,51,1,51,1,51,1,51,5,51,1011,8,51,10,51,12,51,1014,9,51,1,51,
	3,51,1017,8,51,1,51,1,51,1,52,1,52,5,52,1023,8,52,10,52,12,52,1026,9,52,
	1,52,3,52,1029,8,52,1,52,1,52,5,52,1033,8,52,10,52,12,52,1036,9,52,1,52,
	3,52,1039,8,52,3,52,1041,8,52,1,53,1,53,1,53,1,53,5,53,1047,8,53,10,53,
	12,53,1050,9,53,1,53,3,53,1053,8,53,3,53,1055,8,53,1,53,1,53,1,54,1,54,
	5,54,1061,8,54,10,54,12,54,1064,9,54,1,54,3,54,1067,8,54,1,54,1,54,5,54,
	1071,8,54,10,54,12,54,1074,9,54,1,54,3,54,1077,8,54,1,54,1,54,5,54,1081,
	8,54,10,54,12,54,1084,9,54,1,54,3,54,1087,8,54,3,54,1089,8,54,1,55,1,55,
	5,55,1093,8,55,10,55,12,55,1096,9,55,1,55,1,55,3,55,1100,8,55,1,56,1,56,
	1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,
	56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,56,
	1,56,3,56,1134,8,56,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,
	58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,5,58,1158,8,58,
	10,58,12,58,1161,9,58,1,58,1,58,1,58,1,59,1,59,1,59,1,59,1,59,1,59,5,59,
	1172,8,59,10,59,12,59,1175,9,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,5,59,
	1184,8,59,10,59,12,59,1187,9,59,1,59,3,59,1190,8,59,1,59,1,59,1,59,3,59,
	1195,8,59,1,60,1,60,1,60,3,60,1200,8,60,1,60,1,60,1,60,1,60,1,60,5,60,1207,
	8,60,10,60,12,60,1210,9,60,1,60,3,60,1213,8,60,3,60,1215,8,60,1,60,1,60,
	1,60,1,60,1,60,1,60,1,60,1,60,1,60,1,60,1,60,1,60,1,60,1,60,1,60,1,60,1,
	60,1,60,1,60,1,60,3,60,1237,8,60,1,60,1,60,1,60,3,60,1242,8,60,1,61,1,61,
	1,61,1,61,3,61,1248,8,61,1,61,1,61,1,61,1,62,1,62,1,62,1,62,1,62,1,62,1,
	63,1,63,1,63,1,63,3,63,1263,8,63,1,63,1,63,1,63,1,63,1,63,5,63,1270,8,63,
	10,63,12,63,1273,9,63,1,63,3,63,1276,8,63,3,63,1278,8,63,1,63,1,63,1,63,
	1,63,1,63,1,63,1,63,3,63,1287,8,63,1,63,1,63,1,63,3,63,1292,8,63,1,64,1,
	64,1,64,1,64,1,64,1,64,1,64,4,64,1301,8,64,11,64,12,64,1302,3,64,1305,8,
	64,1,64,5,64,1308,8,64,10,64,12,64,1311,9,64,1,64,1,64,1,64,1,64,1,64,1,
	64,1,64,1,64,1,64,4,64,1322,8,64,11,64,12,64,1323,1,64,5,64,1327,8,64,10,
	64,12,64,1330,9,64,1,64,1,64,1,64,1,64,1,64,1,64,4,64,1338,8,64,11,64,12,
	64,1339,1,64,1,64,1,64,1,64,1,64,1,64,4,64,1348,8,64,11,64,12,64,1349,1,
	64,1,64,1,64,1,64,4,64,1356,8,64,11,64,12,64,1357,1,64,1,64,1,64,1,64,1,
	64,1,64,1,64,1,64,1,64,1,64,1,64,4,64,1371,8,64,11,64,12,64,1372,3,64,1375,
	8,64,1,64,5,64,1378,8,64,10,64,12,64,1381,9,64,1,64,1,64,1,64,1,64,1,64,
	1,64,1,64,4,64,1390,8,64,11,64,12,64,1391,1,64,5,64,1395,8,64,10,64,12,
	64,1398,9,64,1,64,1,64,1,64,1,64,1,64,4,64,1405,8,64,11,64,12,64,1406,1,
	64,1,64,1,64,3,64,1412,8,64,1,65,1,65,1,65,3,65,1417,8,65,1,66,1,66,1,66,
	1,66,1,66,1,66,1,66,5,66,1426,8,66,10,66,12,66,1429,9,66,1,66,1,66,1,66,
	1,66,1,66,1,66,1,67,1,67,5,67,1439,8,67,10,67,12,67,1442,9,67,1,67,1,67,
	1,67,3,67,1447,8,67,1,67,1,67,1,67,1,67,5,67,1453,8,67,10,67,12,67,1456,
	9,67,1,67,1,67,1,67,3,67,1461,8,67,1,67,1,67,3,67,1465,8,67,1,68,1,68,1,
	68,1,68,1,68,1,68,4,68,1473,8,68,11,68,12,68,1474,1,68,1,68,1,68,1,68,1,
	68,1,68,1,68,1,68,4,68,1485,8,68,11,68,12,68,1486,1,68,1,68,1,68,1,68,1,
	68,1,68,4,68,1495,8,68,11,68,12,68,1496,1,68,1,68,1,68,1,68,1,68,1,68,1,
	68,4,68,1506,8,68,11,68,12,68,1507,1,68,1,68,1,68,1,68,1,68,3,68,1515,8,
	68,1,69,1,69,5,69,1519,8,69,10,69,12,69,1522,9,69,1,69,1,69,1,69,1,69,3,
	69,1528,8,69,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,3,70,
	1541,8,70,1,71,1,71,1,71,1,71,3,71,1547,8,71,1,71,1,71,1,71,1,71,1,71,1,
	71,1,71,1,71,3,71,1557,8,71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,4,71,1566,
	8,71,11,71,12,71,1567,1,71,1,71,1,71,3,71,1573,8,71,1,71,1,71,1,71,3,71,
	1578,8,71,1,72,1,72,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,
	73,1,73,1,73,1,73,1,73,1,73,1,73,4,73,1599,8,73,11,73,12,73,1600,1,73,1,
	73,1,73,1,73,1,73,3,73,1608,8,73,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,75,
	1,75,1,75,1,75,1,75,1,75,3,75,1623,8,75,1,75,1,75,1,75,1,75,1,75,1,75,1,
	75,1,75,1,75,4,75,1634,8,75,11,75,12,75,1635,1,75,1,75,1,75,3,75,1641,8,
	75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,3,75,1654,8,75,
	1,75,1,75,3,75,1658,8,75,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,
	76,1,76,1,76,1,76,1,76,4,76,1674,8,76,11,76,12,76,1675,1,76,1,76,1,76,1,
	76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,3,76,1692,8,76,1,77,
	1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,
	77,4,77,1710,8,77,11,77,12,77,1711,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,
	77,4,77,1722,8,77,11,77,12,77,1723,1,77,1,77,1,77,1,77,1,77,1,77,4,77,1732,
	8,77,11,77,12,77,1733,1,77,1,77,1,77,1,77,4,77,1740,8,77,11,77,12,77,1741,
	1,77,1,77,3,77,1746,8,77,1,78,1,78,1,78,1,78,1,78,1,78,1,78,3,78,1755,8,
	78,1,78,1,78,1,78,1,79,1,79,1,79,1,79,1,79,3,79,1765,8,79,1,79,1,79,1,79,
	1,80,1,80,1,80,1,80,1,80,1,80,1,80,3,80,1777,8,80,1,81,1,81,1,81,1,81,1,
	81,1,81,3,81,1785,8,81,1,82,1,82,1,82,1,82,1,82,1,82,1,82,1,82,1,82,1,82,
	1,82,1,82,1,82,1,82,1,82,1,82,1,83,1,83,1,83,1,83,1,83,1,83,1,83,1,83,1,
	83,1,83,1,83,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,85,
	1,85,1,85,1,85,1,85,3,85,1830,8,85,1,85,1,85,1,85,1,86,1,86,5,86,1837,8,
	86,10,86,12,86,1840,9,86,1,86,1,86,1,86,3,86,1845,8,86,1,86,1,86,1,86,1,
	86,1,86,1,86,1,86,1,86,3,86,1855,8,86,1,87,1,87,1,87,1,88,1,88,1,88,1,88,
	1,88,1,88,1,88,3,88,1867,8,88,1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,
	90,1,90,1,90,1,90,1,90,1,90,1,91,1,91,1,91,1,91,1,92,1,92,1,92,1,93,1,93,
	5,93,1892,8,93,10,93,12,93,1895,9,93,1,93,1,93,1,94,1,94,1,94,1,94,1,94,
	1,94,1,94,1,94,1,94,1,94,1,94,1,94,1,94,3,94,1912,8,94,1,95,1,95,1,95,1,
	95,5,95,1918,8,95,10,95,12,95,1921,9,95,1,95,1,95,3,95,1925,8,95,1,96,1,
	96,1,96,5,96,1930,8,96,10,96,12,96,1933,9,96,1,96,1,96,1,96,1,97,1,97,1,
	97,1,97,1,98,1,98,1,98,4,98,1945,8,98,11,98,12,98,1946,1,98,3,98,1950,8,
	98,1,98,3,98,1953,8,98,1,99,1,99,1,99,1,99,1,100,1,100,1,100,1,101,1,101,
	1,101,1,101,1,101,1,101,1,102,1,102,1,102,1,102,1,102,1,102,5,102,1974,
	8,102,10,102,12,102,1977,9,102,3,102,1979,8,102,1,102,1,102,1,102,1,102,
	1,102,5,102,1986,8,102,10,102,12,102,1989,9,102,3,102,1991,8,102,1,102,
	1,102,1,103,1,103,1,103,3,103,1998,8,103,1,104,1,104,1,104,1,104,1,104,
	5,104,2005,8,104,10,104,12,104,2008,9,104,3,104,2010,8,104,1,104,1,104,
	1,105,1,105,1,106,1,106,1,106,5,106,2019,8,106,10,106,12,106,2022,9,106,
	1,107,1,107,1,108,1,108,1,108,5,108,2029,8,108,10,108,12,108,2032,9,108,
	1,108,1,108,1,109,1,109,1,109,1,109,1,109,1,109,5,109,2042,8,109,10,109,
	12,109,2045,9,109,1,109,3,109,2048,8,109,1,109,1,109,1,110,1,110,1,110,
	1,110,5,110,2056,8,110,10,110,12,110,2059,9,110,1,111,1,111,1,111,5,111,
	2064,8,111,10,111,12,111,2067,9,111,1,112,1,112,1,112,3,112,2072,8,112,
	1,112,1,112,4,112,2076,8,112,11,112,12,112,2077,1,113,1,113,1,113,1,113,
	1,113,5,113,2085,8,113,10,113,12,113,2088,9,113,1,113,3,113,2091,8,113,
	3,113,2093,8,113,1,113,1,113,1,114,1,114,3,114,2099,8,114,1,114,1,114,1,
	114,1,114,5,114,2105,8,114,10,114,12,114,2108,9,114,1,114,3,114,2111,8,
	114,3,114,2113,8,114,1,114,3,114,2116,8,114,1,114,1,114,1,115,1,115,1,115,
	1,116,1,116,1,116,1,117,1,117,1,117,3,117,2129,8,117,1,118,1,118,1,118,
	1,118,3,118,2135,8,118,1,118,1,118,1,118,1,118,1,118,5,118,2142,8,118,10,
	118,12,118,2145,9,118,1,118,3,118,2148,8,118,3,118,2150,8,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,3,118,2159,8,118,1,118,1,118,1,118,1,118,
	1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,3,118,2173,8,118,1,119,
	1,119,1,119,1,119,1,119,1,119,1,120,1,120,3,120,2183,8,120,1,121,1,121,
	1,121,1,121,5,121,2189,8,121,10,121,12,121,2192,9,121,1,121,3,121,2195,
	8,121,3,121,2197,8,121,1,121,1,121,1,122,1,122,1,122,1,122,1,122,1,122,
	1,122,1,122,1,122,1,122,1,122,1,122,5,122,2213,8,122,10,122,12,122,2216,
	9,122,1,122,3,122,2219,8,122,3,122,2221,8,122,1,122,1,122,3,122,2225,8,
	122,1,123,1,123,1,123,1,123,1,124,1,124,1,124,1,124,5,124,2235,8,124,10,
	124,12,124,2238,9,124,1,124,3,124,2241,8,124,3,124,2243,8,124,1,124,1,124,
	1,125,1,125,1,125,1,125,5,125,2251,8,125,10,125,12,125,2254,9,125,1,125,
	3,125,2257,8,125,1,125,1,125,1,126,1,126,1,126,1,126,1,127,1,127,1,127,
	1,127,5,127,2269,8,127,10,127,12,127,2272,9,127,1,127,3,127,2275,8,127,
	1,127,1,127,1,128,1,128,3,128,2281,8,128,1,129,1,129,1,129,1,129,1,129,
	1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,4,129,2298,
	8,129,11,129,12,129,2299,1,129,1,129,1,129,1,129,1,129,1,129,3,129,2308,
	8,129,1,129,1,129,1,129,1,129,1,129,1,129,3,129,2316,8,129,1,129,1,129,
	1,129,1,129,1,129,4,129,2323,8,129,11,129,12,129,2324,1,129,1,129,1,129,
	1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,
	1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,
	1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,
	1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,
	1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,
	1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,5,129,2399,8,129,
	10,129,12,129,2402,9,129,1,129,3,129,2405,8,129,3,129,2407,8,129,1,129,
	1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,
	1,129,1,129,1,129,1,129,1,129,4,129,2427,8,129,11,129,12,129,2428,1,129,
	1,129,1,129,1,129,1,129,1,129,1,129,3,129,2438,8,129,1,129,1,129,1,129,
	1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,
	1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,
	1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,
	1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,
	1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,
	1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,1,129,
	3,129,2515,8,129,1,129,1,129,1,129,1,129,1,129,5,129,2522,8,129,10,129,
	12,129,2525,9,129,1,129,3,129,2528,8,129,3,129,2530,8,129,1,129,1,129,1,
	129,1,129,1,129,1,129,3,129,2538,8,129,1,129,1,129,1,129,1,129,1,129,5,
	129,2545,8,129,10,129,12,129,2548,9,129,1,130,1,130,1,130,1,130,1,130,1,
	130,1,130,1,130,1,130,1,130,1,130,1,130,1,130,3,130,2563,8,130,1,131,1,
	131,1,132,1,132,1,132,1,132,1,132,5,132,2572,8,132,10,132,12,132,2575,9,
	132,1,132,1,132,1,132,1,132,3,132,2581,8,132,1,133,1,133,3,133,2585,8,133,
	1,134,1,134,1,135,1,135,1,135,1,135,1,135,1,135,1,135,1,135,1,135,1,135,
	1,135,1,135,1,135,1,135,1,135,1,135,1,135,1,135,5,135,2607,8,135,10,135,
	12,135,2610,9,135,3,135,2612,8,135,1,135,1,135,5,135,2616,8,135,10,135,
	12,135,2619,9,135,1,135,1,135,1,135,1,135,1,135,5,135,2626,8,135,10,135,
	12,135,2629,9,135,1,135,1,135,3,135,2633,8,135,1,135,1,135,1,135,1,135,
	3,135,2639,8,135,1,136,1,136,1,136,0,2,84,258,137,0,2,4,6,8,10,12,14,16,
	18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,
	66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,
	110,112,114,116,118,120,122,124,126,128,130,132,134,136,138,140,142,144,
	146,148,150,152,154,156,158,160,162,164,166,168,170,172,174,176,178,180,
	182,184,186,188,190,192,194,196,198,200,202,204,206,208,210,212,214,216,
	218,220,222,224,226,228,230,232,234,236,238,240,242,244,246,248,250,252,
	254,256,258,260,262,264,266,268,270,272,0,27,2,0,10,10,13,27,5,0,11,11,
	28,36,143,143,147,147,180,180,4,0,140,140,145,145,151,151,180,180,1,0,38,
	39,2,0,140,140,144,144,3,0,20,23,26,27,40,40,1,0,43,44,2,0,43,44,58,59,
	3,0,43,44,58,58,63,63,2,0,145,145,180,180,2,0,40,40,77,86,1,0,87,88,6,0,
	31,31,36,36,75,75,108,108,149,149,180,180,5,0,141,141,145,145,151,151,153,
	153,162,162,2,0,163,163,172,175,2,0,163,163,172,179,3,0,14,14,27,27,127,
	127,2,0,10,10,15,16,1,0,13,14,1,0,128,129,1,0,20,23,1,0,18,19,2,0,126,126,
	164,164,3,0,33,33,56,56,133,137,1,0,142,143,1,0,70,71,5,0,59,59,108,108,
	138,139,146,149,155,159,2990,0,277,1,0,0,0,2,329,1,0,0,0,4,331,1,0,0,0,
	6,336,1,0,0,0,8,394,1,0,0,0,10,396,1,0,0,0,12,405,1,0,0,0,14,407,1,0,0,
	0,16,423,1,0,0,0,18,425,1,0,0,0,20,433,1,0,0,0,22,436,1,0,0,0,24,440,1,
	0,0,0,26,442,1,0,0,0,28,481,1,0,0,0,30,483,1,0,0,0,32,488,1,0,0,0,34,490,
	1,0,0,0,36,504,1,0,0,0,38,524,1,0,0,0,40,564,1,0,0,0,42,568,1,0,0,0,44,
	583,1,0,0,0,46,607,1,0,0,0,48,615,1,0,0,0,50,634,1,0,0,0,52,638,1,0,0,0,
	54,651,1,0,0,0,56,656,1,0,0,0,58,672,1,0,0,0,60,677,1,0,0,0,62,683,1,0,
	0,0,64,690,1,0,0,0,66,713,1,0,0,0,68,740,1,0,0,0,70,742,1,0,0,0,72,776,
	1,0,0,0,74,778,1,0,0,0,76,852,1,0,0,0,78,857,1,0,0,0,80,859,1,0,0,0,82,
	897,1,0,0,0,84,909,1,0,0,0,86,923,1,0,0,0,88,939,1,0,0,0,90,941,1,0,0,0,
	92,944,1,0,0,0,94,966,1,0,0,0,96,984,1,0,0,0,98,986,1,0,0,0,100,999,1,0,
	0,0,102,1005,1,0,0,0,104,1040,1,0,0,0,106,1042,1,0,0,0,108,1088,1,0,0,0,
	110,1099,1,0,0,0,112,1133,1,0,0,0,114,1135,1,0,0,0,116,1145,1,0,0,0,118,
	1194,1,0,0,0,120,1241,1,0,0,0,122,1243,1,0,0,0,124,1252,1,0,0,0,126,1291,
	1,0,0,0,128,1411,1,0,0,0,130,1416,1,0,0,0,132,1418,1,0,0,0,134,1464,1,0,
	0,0,136,1514,1,0,0,0,138,1527,1,0,0,0,140,1540,1,0,0,0,142,1577,1,0,0,0,
	144,1579,1,0,0,0,146,1607,1,0,0,0,148,1609,1,0,0,0,150,1657,1,0,0,0,152,
	1691,1,0,0,0,154,1745,1,0,0,0,156,1747,1,0,0,0,158,1759,1,0,0,0,160,1769,
	1,0,0,0,162,1784,1,0,0,0,164,1786,1,0,0,0,166,1802,1,0,0,0,168,1813,1,0,
	0,0,170,1824,1,0,0,0,172,1854,1,0,0,0,174,1856,1,0,0,0,176,1866,1,0,0,0,
	178,1868,1,0,0,0,180,1876,1,0,0,0,182,1882,1,0,0,0,184,1886,1,0,0,0,186,
	1889,1,0,0,0,188,1911,1,0,0,0,190,1913,1,0,0,0,192,1926,1,0,0,0,194,1937,
	1,0,0,0,196,1941,1,0,0,0,198,1954,1,0,0,0,200,1958,1,0,0,0,202,1961,1,0,
	0,0,204,1967,1,0,0,0,206,1997,1,0,0,0,208,1999,1,0,0,0,210,2013,1,0,0,0,
	212,2015,1,0,0,0,214,2023,1,0,0,0,216,2025,1,0,0,0,218,2035,1,0,0,0,220,
	2051,1,0,0,0,222,2060,1,0,0,0,224,2068,1,0,0,0,226,2079,1,0,0,0,228,2096,
	1,0,0,0,230,2119,1,0,0,0,232,2122,1,0,0,0,234,2128,1,0,0,0,236,2172,1,0,
	0,0,238,2174,1,0,0,0,240,2182,1,0,0,0,242,2184,1,0,0,0,244,2224,1,0,0,0,
	246,2226,1,0,0,0,248,2230,1,0,0,0,250,2246,1,0,0,0,252,2260,1,0,0,0,254,
	2264,1,0,0,0,256,2280,1,0,0,0,258,2437,1,0,0,0,260,2562,1,0,0,0,262,2564,
	1,0,0,0,264,2580,1,0,0,0,266,2582,1,0,0,0,268,2586,1,0,0,0,270,2638,1,0,
	0,0,272,2640,1,0,0,0,274,276,3,16,8,0,275,274,1,0,0,0,276,279,1,0,0,0,277,
	275,1,0,0,0,277,278,1,0,0,0,278,283,1,0,0,0,279,277,1,0,0,0,280,282,3,2,
	1,0,281,280,1,0,0,0,282,285,1,0,0,0,283,281,1,0,0,0,283,284,1,0,0,0,284,
	298,1,0,0,0,285,283,1,0,0,0,286,297,3,62,31,0,287,297,3,56,28,0,288,297,
	3,52,26,0,289,297,3,60,30,0,290,297,3,8,4,0,291,297,3,48,24,0,292,297,3,
	26,13,0,293,297,3,6,3,0,294,297,3,36,18,0,295,297,3,38,19,0,296,286,1,0,
	0,0,296,287,1,0,0,0,296,288,1,0,0,0,296,289,1,0,0,0,296,290,1,0,0,0,296,
	291,1,0,0,0,296,292,1,0,0,0,296,293,1,0,0,0,296,294,1,0,0,0,296,295,1,0,
	0,0,297,300,1,0,0,0,298,296,1,0,0,0,298,299,1,0,0,0,299,301,1,0,0,0,300,
	298,1,0,0,0,301,302,5,0,0,1,302,1,1,0,0,0,303,304,5,1,0,0,304,305,5,151,
	0,0,305,330,5,2,0,0,306,307,5,1,0,0,307,308,5,151,0,0,308,309,5,3,0,0,309,
	310,5,180,0,0,310,330,5,2,0,0,311,312,5,1,0,0,312,313,5,4,0,0,313,318,3,
	4,2,0,314,315,5,5,0,0,315,317,3,4,2,0,316,314,1,0,0,0,317,320,1,0,0,0,318,
	316,1,0,0,0,318,319,1,0,0,0,319,322,1,0,0,0,320,318,1,0,0,0,321,323,5,5,
	0,0,322,321,1,0,0,0,322,323,1,0,0,0,323,324,1,0,0,0,324,325,5,6,0,0,325,
	326,5,180,0,0,326,327,5,151,0,0,327,328,5,2,0,0,328,330,1,0,0,0,329,303,
	1,0,0,0,329,306,1,0,0,0,329,311,1,0,0,0,330,3,1,0,0,0,331,334,5,180,0,0,
	332,333,5,3,0,0,333,335,5,180,0,0,334,332,1,0,0,0,334,335,1,0,0,0,335,5,
	1,0,0,0,336,337,5,7,0,0,337,338,3,14,7,0,338,342,3,106,53,0,339,341,3,96,
	48,0,340,339,1,0,0,0,341,344,1,0,0,0,342,340,1,0,0,0,342,343,1,0,0,0,343,
	346,1,0,0,0,344,342,1,0,0,0,345,347,3,102,51,0,346,345,1,0,0,0,346,347,
	1,0,0,0,347,348,1,0,0,0,348,352,5,4,0,0,349,351,3,112,56,0,350,349,1,0,
	0,0,351,354,1,0,0,0,352,350,1,0,0,0,352,353,1,0,0,0,353,355,1,0,0,0,354,
	352,1,0,0,0,355,356,5,6,0,0,356,7,1,0,0,0,357,358,5,8,0,0,358,359,5,180,
	0,0,359,363,5,9,0,0,360,364,3,84,42,0,361,364,3,270,135,0,362,364,5,10,
	0,0,363,360,1,0,0,0,363,361,1,0,0,0,363,362,1,0,0,0,364,366,1,0,0,0,365,
	367,5,11,0,0,366,365,1,0,0,0,366,367,1,0,0,0,367,368,1,0,0,0,368,395,5,
	2,0,0,369,370,5,8,0,0,370,371,5,4,0,0,371,376,3,10,5,0,372,373,5,5,0,0,
	373,375,3,10,5,0,374,372,1,0,0,0,375,378,1,0,0,0,376,374,1,0,0,0,376,377,
	1,0,0,0,377,380,1,0,0,0,378,376,1,0,0,0,379,381,5,5,0,0,380,379,1,0,0,0,
	380,381,1,0,0,0,381,382,1,0,0,0,382,383,5,6,0,0,383,387,5,9,0,0,384,388,
	3,84,42,0,385,388,3,270,135,0,386,388,5,10,0,0,387,384,1,0,0,0,387,385,
	1,0,0,0,387,386,1,0,0,0,388,390,1,0,0,0,389,391,5,11,0,0,390,389,1,0,0,
	0,390,391,1,0,0,0,391,392,1,0,0,0,392,393,5,2,0,0,393,395,1,0,0,0,394,357,
	1,0,0,0,394,369,1,0,0,0,395,9,1,0,0,0,396,399,5,180,0,0,397,398,5,12,0,
	0,398,400,5,180,0,0,399,397,1,0,0,0,399,400,1,0,0,0,400,403,1,0,0,0,401,
	402,5,3,0,0,402,404,3,12,6,0,403,401,1,0,0,0,403,404,1,0,0,0,404,11,1,0,
	0,0,405,406,7,0,0,0,406,13,1,0,0,0,407,408,7,1,0,0,408,15,1,0,0,0,409,410,
	5,37,0,0,410,411,3,18,9,0,411,412,3,20,10,0,412,413,5,2,0,0,413,424,1,0,
	0,0,414,415,5,37,0,0,415,419,5,180,0,0,416,418,7,2,0,0,417,416,1,0,0,0,
	418,421,1,0,0,0,419,417,1,0,0,0,419,420,1,0,0,0,420,422,1,0,0,0,421,419,
	1,0,0,0,422,424,5,2,0,0,423,409,1,0,0,0,423,414,1,0,0,0,424,17,1,0,0,0,
	425,426,7,3,0,0,426,19,1,0,0,0,427,429,3,22,11,0,428,427,1,0,0,0,429,430,
	1,0,0,0,430,428,1,0,0,0,430,431,1,0,0,0,431,434,1,0,0,0,432,434,5,10,0,
	0,433,428,1,0,0,0,433,432,1,0,0,0,434,21,1,0,0,0,435,437,3,24,12,0,436,
	435,1,0,0,0,436,437,1,0,0,0,437,438,1,0,0,0,438,439,7,4,0,0,439,23,1,0,
	0,0,440,441,7,5,0,0,441,25,1,0,0,0,442,443,5,41,0,0,443,453,5,180,0,0,444,
	445,5,42,0,0,445,450,5,180,0,0,446,447,5,5,0,0,447,449,5,180,0,0,448,446,
	1,0,0,0,449,452,1,0,0,0,450,448,1,0,0,0,450,451,1,0,0,0,451,454,1,0,0,0,
	452,450,1,0,0,0,453,444,1,0,0,0,453,454,1,0,0,0,454,455,1,0,0,0,455,466,
	5,4,0,0,456,465,3,56,28,0,457,465,3,52,26,0,458,465,3,60,30,0,459,465,3,
	44,22,0,460,465,3,48,24,0,461,465,3,30,15,0,462,465,3,28,14,0,463,465,3,
	34,17,0,464,456,1,0,0,0,464,457,1,0,0,0,464,458,1,0,0,0,464,459,1,0,0,0,
	464,460,1,0,0,0,464,461,1,0,0,0,464,462,1,0,0,0,464,463,1,0,0,0,465,468,
	1,0,0,0,466,464,1,0,0,0,466,467,1,0,0,0,467,469,1,0,0,0,468,466,1,0,0,0,
	469,470,5,6,0,0,470,27,1,0,0,0,471,472,3,32,16,0,472,473,3,82,41,0,473,
	474,5,180,0,0,474,475,5,2,0,0,475,482,1,0,0,0,476,477,3,32,16,0,477,478,
	3,84,42,0,478,479,5,180,0,0,479,480,5,2,0,0,480,482,1,0,0,0,481,471,1,0,
	0,0,481,476,1,0,0,0,482,29,1,0,0,0,483,484,3,32,16,0,484,485,3,270,135,
	0,485,486,5,180,0,0,486,487,5,2,0,0,487,31,1,0,0,0,488,489,7,6,0,0,489,
	33,1,0,0,0,490,491,5,7,0,0,491,492,5,180,0,0,492,496,3,106,53,0,493,495,
	3,96,48,0,494,493,1,0,0,0,495,498,1,0,0,0,496,494,1,0,0,0,496,497,1,0,0,
	0,497,500,1,0,0,0,498,496,1,0,0,0,499,501,3,102,51,0,500,499,1,0,0,0,500,
	501,1,0,0,0,501,502,1,0,0,0,502,503,5,2,0,0,503,35,1,0,0,0,504,505,5,45,
	0,0,505,506,5,180,0,0,506,518,5,4,0,0,507,517,3,56,28,0,508,517,3,52,26,
	0,509,517,3,60,30,0,510,517,3,44,22,0,511,517,3,48,24,0,512,517,3,62,31,
	0,513,517,3,76,38,0,514,517,3,8,4,0,515,517,3,6,3,0,516,507,1,0,0,0,516,
	508,1,0,0,0,516,509,1,0,0,0,516,510,1,0,0,0,516,511,1,0,0,0,516,512,1,0,
	0,0,516,513,1,0,0,0,516,514,1,0,0,0,516,515,1,0,0,0,517,520,1,0,0,0,518,
	516,1,0,0,0,518,519,1,0,0,0,519,521,1,0,0,0,520,518,1,0,0,0,521,522,5,6,
	0,0,522,37,1,0,0,0,523,525,5,46,0,0,524,523,1,0,0,0,524,525,1,0,0,0,525,
	526,1,0,0,0,526,527,5,47,0,0,527,529,5,180,0,0,528,530,3,106,53,0,529,528,
	1,0,0,0,529,530,1,0,0,0,530,540,1,0,0,0,531,532,5,42,0,0,532,537,3,40,20,
	0,533,534,5,5,0,0,534,536,3,40,20,0,535,533,1,0,0,0,536,539,1,0,0,0,537,
	535,1,0,0,0,537,538,1,0,0,0,538,541,1,0,0,0,539,537,1,0,0,0,540,531,1,0,
	0,0,540,541,1,0,0,0,541,542,1,0,0,0,542,559,5,4,0,0,543,558,3,56,28,0,544,
	558,3,52,26,0,545,558,3,60,30,0,546,558,3,44,22,0,547,558,3,48,24,0,548,
	558,3,62,31,0,549,558,3,8,4,0,550,558,3,76,38,0,551,558,3,86,43,0,552,558,
	3,64,32,0,553,558,3,92,46,0,554,558,3,42,21,0,555,558,3,66,33,0,556,558,
	3,70,35,0,557,543,1,0,0,0,557,544,1,0,0,0,557,545,1,0,0,0,557,546,1,0,0,
	0,557,547,1,0,0,0,557,548,1,0,0,0,557,549,1,0,0,0,557,550,1,0,0,0,557,551,
	1,0,0,0,557,552,1,0,0,0,557,553,1,0,0,0,557,554,1,0,0,0,557,555,1,0,0,0,
	557,556,1,0,0,0,558,561,1,0,0,0,559,557,1,0,0,0,559,560,1,0,0,0,560,562,
	1,0,0,0,561,559,1,0,0,0,562,563,5,6,0,0,563,39,1,0,0,0,564,566,5,180,0,
	0,565,567,3,248,124,0,566,565,1,0,0,0,566,567,1,0,0,0,567,41,1,0,0,0,568,
	569,5,7,0,0,569,570,3,14,7,0,570,575,3,106,53,0,571,574,3,96,48,0,572,574,
	3,94,47,0,573,571,1,0,0,0,573,572,1,0,0,0,574,577,1,0,0,0,575,573,1,0,0,
	0,575,576,1,0,0,0,576,579,1,0,0,0,577,575,1,0,0,0,578,580,3,102,51,0,579,
	578,1,0,0,0,579,580,1,0,0,0,580,581,1,0,0,0,581,582,5,2,0,0,582,43,1,0,
	0,0,583,584,5,48,0,0,584,585,5,180,0,0,585,597,5,49,0,0,586,591,3,46,23,
	0,587,588,5,5,0,0,588,590,3,46,23,0,589,587,1,0,0,0,590,593,1,0,0,0,591,
	589,1,0,0,0,591,592,1,0,0,0,592,595,1,0,0,0,593,591,1,0,0,0,594,596,5,5,
	0,0,595,594,1,0,0,0,595,596,1,0,0,0,596,598,1,0,0,0,597,586,1,0,0,0,597,
	598,1,0,0,0,598,599,1,0,0,0,599,601,5,50,0,0,600,602,5,51,0,0,601,600,1,
	0,0,0,601,602,1,0,0,0,602,603,1,0,0,0,603,604,5,2,0,0,604,45,1,0,0,0,605,
	608,3,270,135,0,606,608,3,84,42,0,607,605,1,0,0,0,607,606,1,0,0,0,608,610,
	1,0,0,0,609,611,5,52,0,0,610,609,1,0,0,0,610,611,1,0,0,0,611,613,1,0,0,
	0,612,614,5,180,0,0,613,612,1,0,0,0,613,614,1,0,0,0,614,47,1,0,0,0,615,
	616,5,35,0,0,616,617,5,180,0,0,617,629,5,49,0,0,618,623,3,50,25,0,619,620,
	5,5,0,0,620,622,3,50,25,0,621,619,1,0,0,0,622,625,1,0,0,0,623,621,1,0,0,
	0,623,624,1,0,0,0,624,627,1,0,0,0,625,623,1,0,0,0,626,628,5,5,0,0,627,626,
	1,0,0,0,627,628,1,0,0,0,628,630,1,0,0,0,629,618,1,0,0,0,629,630,1,0,0,0,
	630,631,1,0,0,0,631,632,5,50,0,0,632,633,5,2,0,0,633,49,1,0,0,0,634,636,
	3,270,135,0,635,637,5,180,0,0,636,635,1,0,0,0,636,637,1,0,0,0,637,51,1,
	0,0,0,638,639,5,53,0,0,639,640,5,180,0,0,640,642,5,4,0,0,641,643,3,54,27,
	0,642,641,1,0,0,0,643,644,1,0,0,0,644,642,1,0,0,0,644,645,1,0,0,0,645,646,
	1,0,0,0,646,647,5,6,0,0,647,53,1,0,0,0,648,652,3,270,135,0,649,652,3,84,
	42,0,650,652,3,82,41,0,651,648,1,0,0,0,651,649,1,0,0,0,651,650,1,0,0,0,
	652,653,1,0,0,0,653,654,3,14,7,0,654,655,5,2,0,0,655,55,1,0,0,0,656,657,
	5,54,0,0,657,658,5,180,0,0,658,659,5,4,0,0,659,664,3,58,29,0,660,661,5,
	5,0,0,661,663,3,58,29,0,662,660,1,0,0,0,663,666,1,0,0,0,664,662,1,0,0,0,
	664,665,1,0,0,0,665,668,1,0,0,0,666,664,1,0,0,0,667,669,5,5,0,0,668,667,
	1,0,0,0,668,669,1,0,0,0,669,670,1,0,0,0,670,671,5,6,0,0,671,57,1,0,0,0,
	672,675,5,180,0,0,673,674,5,40,0,0,674,676,5,145,0,0,675,673,1,0,0,0,675,
	676,1,0,0,0,676,59,1,0,0,0,677,678,5,55,0,0,678,679,5,180,0,0,679,680,5,
	42,0,0,680,681,3,270,135,0,681,682,5,2,0,0,682,61,1,0,0,0,683,684,3,270,
	135,0,684,685,5,56,0,0,685,686,5,180,0,0,686,687,5,40,0,0,687,688,3,258,
	129,0,688,689,5,2,0,0,689,63,1,0,0,0,690,691,5,57,0,0,691,695,3,106,53,
	0,692,694,7,7,0,0,693,692,1,0,0,0,694,697,1,0,0,0,695,693,1,0,0,0,695,696,
	1,0,0,0,696,701,1,0,0,0,697,695,1,0,0,0,698,700,3,74,37,0,699,698,1,0,0,
	0,700,703,1,0,0,0,701,699,1,0,0,0,701,702,1,0,0,0,702,704,1,0,0,0,703,701,
	1,0,0,0,704,708,5,4,0,0,705,707,3,112,56,0,706,705,1,0,0,0,707,710,1,0,
	0,0,708,706,1,0,0,0,708,709,1,0,0,0,709,711,1,0,0,0,710,708,1,0,0,0,711,
	712,5,6,0,0,712,65,1,0,0,0,713,714,5,60,0,0,714,715,3,106,53,0,715,719,
	5,44,0,0,716,718,3,68,34,0,717,716,1,0,0,0,718,721,1,0,0,0,719,717,1,0,
	0,0,719,720,1,0,0,0,720,725,1,0,0,0,721,719,1,0,0,0,722,724,3,94,47,0,723,
	722,1,0,0,0,724,727,1,0,0,0,725,723,1,0,0,0,725,726,1,0,0,0,726,728,1,0,
	0,0,727,725,1,0,0,0,728,732,5,4,0,0,729,731,3,112,56,0,730,729,1,0,0,0,
	731,734,1,0,0,0,732,730,1,0,0,0,732,733,1,0,0,0,733,735,1,0,0,0,734,732,
	1,0,0,0,735,736,5,6,0,0,736,67,1,0,0,0,737,741,5,59,0,0,738,741,5,61,0,
	0,739,741,3,98,49,0,740,737,1,0,0,0,740,738,1,0,0,0,740,739,1,0,0,0,741,
	69,1,0,0,0,742,743,5,62,0,0,743,744,5,49,0,0,744,748,5,50,0,0,745,747,3,
	72,36,0,746,745,1,0,0,0,747,750,1,0,0,0,748,746,1,0,0,0,748,749,1,0,0,0,
	749,751,1,0,0,0,750,748,1,0,0,0,751,755,5,44,0,0,752,754,3,72,36,0,753,
	752,1,0,0,0,754,757,1,0,0,0,755,753,1,0,0,0,755,756,1,0,0,0,756,758,1,0,
	0,0,757,755,1,0,0,0,758,762,5,59,0,0,759,761,3,72,36,0,760,759,1,0,0,0,
	761,764,1,0,0,0,762,760,1,0,0,0,762,763,1,0,0,0,763,765,1,0,0,0,764,762,
	1,0,0,0,765,769,5,4,0,0,766,768,3,112,56,0,767,766,1,0,0,0,768,771,1,0,
	0,0,769,767,1,0,0,0,769,770,1,0,0,0,770,772,1,0,0,0,771,769,1,0,0,0,772,
	773,5,6,0,0,773,71,1,0,0,0,774,777,5,61,0,0,775,777,3,98,49,0,776,774,1,
	0,0,0,776,775,1,0,0,0,777,73,1,0,0,0,778,779,5,180,0,0,779,780,3,248,124,
	0,780,75,1,0,0,0,781,783,3,80,40,0,782,781,1,0,0,0,782,783,1,0,0,0,783,
	784,1,0,0,0,784,789,3,270,135,0,785,788,3,262,131,0,786,788,3,98,49,0,787,
	785,1,0,0,0,787,786,1,0,0,0,788,791,1,0,0,0,789,787,1,0,0,0,789,790,1,0,
	0,0,790,792,1,0,0,0,791,789,1,0,0,0,792,795,5,180,0,0,793,794,5,40,0,0,
	794,796,3,258,129,0,795,793,1,0,0,0,795,796,1,0,0,0,796,797,1,0,0,0,797,
	798,5,2,0,0,798,853,1,0,0,0,799,804,3,270,135,0,800,803,3,262,131,0,801,
	803,3,98,49,0,802,800,1,0,0,0,802,801,1,0,0,0,803,806,1,0,0,0,804,802,1,
	0,0,0,804,805,1,0,0,0,805,807,1,0,0,0,806,804,1,0,0,0,807,812,3,80,40,0,
	808,811,3,262,131,0,809,811,3,98,49,0,810,808,1,0,0,0,810,809,1,0,0,0,811,
	814,1,0,0,0,812,810,1,0,0,0,812,813,1,0,0,0,813,815,1,0,0,0,814,812,1,0,
	0,0,815,818,5,180,0,0,816,817,5,40,0,0,817,819,3,258,129,0,818,816,1,0,
	0,0,818,819,1,0,0,0,819,820,1,0,0,0,820,821,5,2,0,0,821,853,1,0,0,0,822,
	824,3,80,40,0,823,822,1,0,0,0,823,824,1,0,0,0,824,825,1,0,0,0,825,829,3,
	82,41,0,826,828,3,78,39,0,827,826,1,0,0,0,828,831,1,0,0,0,829,827,1,0,0,
	0,829,830,1,0,0,0,830,832,1,0,0,0,831,829,1,0,0,0,832,833,5,180,0,0,833,
	834,5,2,0,0,834,853,1,0,0,0,835,837,3,80,40,0,836,835,1,0,0,0,836,837,1,
	0,0,0,837,838,1,0,0,0,838,842,3,84,42,0,839,841,3,78,39,0,840,839,1,0,0,
	0,841,844,1,0,0,0,842,840,1,0,0,0,842,843,1,0,0,0,843,845,1,0,0,0,844,842,
	1,0,0,0,845,848,5,180,0,0,846,847,5,40,0,0,847,849,3,258,129,0,848,846,
	1,0,0,0,848,849,1,0,0,0,849,850,1,0,0,0,850,851,5,2,0,0,851,853,1,0,0,0,
	852,782,1,0,0,0,852,799,1,0,0,0,852,823,1,0,0,0,852,836,1,0,0,0,853,77,
	1,0,0,0,854,858,3,262,131,0,855,858,3,80,40,0,856,858,3,98,49,0,857,854,
	1,0,0,0,857,855,1,0,0,0,857,856,1,0,0,0,858,79,1,0,0,0,859,860,7,8,0,0,
	860,81,1,0,0,0,861,862,5,64,0,0,862,863,5,49,0,0,863,865,3,270,135,0,864,
	866,5,180,0,0,865,864,1,0,0,0,865,866,1,0,0,0,866,867,1,0,0,0,867,868,5,
	65,0,0,868,870,3,270,135,0,869,871,5,180,0,0,870,869,1,0,0,0,870,871,1,
	0,0,0,871,872,1,0,0,0,872,873,5,50,0,0,873,898,1,0,0,0,874,875,5,64,0,0,
	875,876,5,49,0,0,876,878,3,270,135,0,877,879,5,180,0,0,878,877,1,0,0,0,
	878,879,1,0,0,0,879,880,1,0,0,0,880,881,5,65,0,0,881,882,3,82,41,0,882,
	883,5,50,0,0,883,898,1,0,0,0,884,885,5,64,0,0,885,886,5,49,0,0,886,888,
	3,270,135,0,887,889,5,180,0,0,888,887,1,0,0,0,888,889,1,0,0,0,889,890,1,
	0,0,0,890,891,5,65,0,0,891,893,3,84,42,0,892,894,5,180,0,0,893,892,1,0,
	0,0,893,894,1,0,0,0,894,895,1,0,0,0,895,896,5,50,0,0,896,898,1,0,0,0,897,
	861,1,0,0,0,897,874,1,0,0,0,897,884,1,0,0,0,898,83,1,0,0,0,899,900,6,42,
	-1,0,900,901,3,270,135,0,901,902,5,66,0,0,902,903,7,9,0,0,903,904,5,67,
	0,0,904,910,1,0,0,0,905,906,3,270,135,0,906,907,5,66,0,0,907,908,5,67,0,
	0,908,910,1,0,0,0,909,899,1,0,0,0,909,905,1,0,0,0,910,920,1,0,0,0,911,912,
	10,2,0,0,912,913,5,66,0,0,913,914,7,9,0,0,914,919,5,67,0,0,915,916,10,1,
	0,0,916,917,5,66,0,0,917,919,5,67,0,0,918,911,1,0,0,0,918,915,1,0,0,0,919,
	922,1,0,0,0,920,918,1,0,0,0,920,921,1,0,0,0,921,85,1,0,0,0,922,920,1,0,
	0,0,923,924,5,68,0,0,924,926,5,180,0,0,925,927,3,106,53,0,926,925,1,0,0,
	0,926,927,1,0,0,0,927,928,1,0,0,0,928,932,5,4,0,0,929,931,3,88,44,0,930,
	929,1,0,0,0,931,934,1,0,0,0,932,930,1,0,0,0,932,933,1,0,0,0,933,935,1,0,
	0,0,934,932,1,0,0,0,935,936,5,6,0,0,936,87,1,0,0,0,937,940,3,90,45,0,938,
	940,3,112,56,0,939,937,1,0,0,0,939,938,1,0,0,0,940,89,1,0,0,0,941,942,5,
	69,0,0,942,943,5,2,0,0,943,91,1,0,0,0,944,945,5,7,0,0,945,946,3,14,7,0,
	946,951,3,106,53,0,947,950,3,96,48,0,948,950,3,94,47,0,949,947,1,0,0,0,
	949,948,1,0,0,0,950,953,1,0,0,0,951,949,1,0,0,0,951,952,1,0,0,0,952,955,
	1,0,0,0,953,951,1,0,0,0,954,956,3,102,51,0,955,954,1,0,0,0,955,956,1,0,
	0,0,956,957,1,0,0,0,957,961,5,4,0,0,958,960,3,112,56,0,959,958,1,0,0,0,
	960,963,1,0,0,0,961,959,1,0,0,0,961,962,1,0,0,0,962,964,1,0,0,0,963,961,
	1,0,0,0,964,965,5,6,0,0,965,93,1,0,0,0,966,968,5,180,0,0,967,969,3,248,
	124,0,968,967,1,0,0,0,968,969,1,0,0,0,969,95,1,0,0,0,970,985,5,70,0,0,971,
	985,5,71,0,0,972,985,5,58,0,0,973,985,5,44,0,0,974,985,5,43,0,0,975,985,
	5,63,0,0,976,985,5,59,0,0,977,985,3,98,49,0,978,985,5,61,0,0,979,985,3,
	100,50,0,980,985,5,30,0,0,981,985,5,28,0,0,982,985,5,31,0,0,983,985,5,29,
	0,0,984,970,1,0,0,0,984,971,1,0,0,0,984,972,1,0,0,0,984,973,1,0,0,0,984,
	974,1,0,0,0,984,975,1,0,0,0,984,976,1,0,0,0,984,977,1,0,0,0,984,978,1,0,
	0,0,984,979,1,0,0,0,984,980,1,0,0,0,984,981,1,0,0,0,984,982,1,0,0,0,984,
	983,1,0,0,0,985,97,1,0,0,0,986,997,5,72,0,0,987,988,5,49,0,0,988,993,5,
	180,0,0,989,990,5,5,0,0,990,992,5,180,0,0,991,989,1,0,0,0,992,995,1,0,0,
	0,993,991,1,0,0,0,993,994,1,0,0,0,994,996,1,0,0,0,995,993,1,0,0,0,996,998,
	5,50,0,0,997,987,1,0,0,0,997,998,1,0,0,0,998,99,1,0,0,0,999,1003,5,32,0,
	0,1000,1001,5,49,0,0,1001,1002,5,145,0,0,1002,1004,5,50,0,0,1003,1000,1,
	0,0,0,1003,1004,1,0,0,0,1004,101,1,0,0,0,1005,1006,5,73,0,0,1006,1007,5,
	49,0,0,1007,1012,3,104,52,0,1008,1009,5,5,0,0,1009,1011,3,104,52,0,1010,
	1008,1,0,0,0,1011,1014,1,0,0,0,1012,1010,1,0,0,0,1012,1013,1,0,0,0,1013,
	1016,1,0,0,0,1014,1012,1,0,0,0,1015,1017,5,5,0,0,1016,1015,1,0,0,0,1016,
	1017,1,0,0,0,1017,1018,1,0,0,0,1018,1019,5,50,0,0,1019,103,1,0,0,0,1020,
	1024,3,270,135,0,1021,1023,3,262,131,0,1022,1021,1,0,0,0,1023,1026,1,0,
	0,0,1024,1022,1,0,0,0,1024,1025,1,0,0,0,1025,1028,1,0,0,0,1026,1024,1,0,
	0,0,1027,1029,3,14,7,0,1028,1027,1,0,0,0,1028,1029,1,0,0,0,1029,1041,1,
	0,0,0,1030,1034,3,84,42,0,1031,1033,3,262,131,0,1032,1031,1,0,0,0,1033,
	1036,1,0,0,0,1034,1032,1,0,0,0,1034,1035,1,0,0,0,1035,1038,1,0,0,0,1036,
	1034,1,0,0,0,1037,1039,3,14,7,0,1038,1037,1,0,0,0,1038,1039,1,0,0,0,1039,
	1041,1,0,0,0,1040,1020,1,0,0,0,1040,1030,1,0,0,0,1041,105,1,0,0,0,1042,
	1054,5,49,0,0,1043,1048,3,108,54,0,1044,1045,5,5,0,0,1045,1047,3,108,54,
	0,1046,1044,1,0,0,0,1047,1050,1,0,0,0,1048,1046,1,0,0,0,1048,1049,1,0,0,
	0,1049,1052,1,0,0,0,1050,1048,1,0,0,0,1051,1053,5,5,0,0,1052,1051,1,0,0,
	0,1052,1053,1,0,0,0,1053,1055,1,0,0,0,1054,1043,1,0,0,0,1054,1055,1,0,0,
	0,1055,1056,1,0,0,0,1056,1057,5,50,0,0,1057,107,1,0,0,0,1058,1062,3,270,
	135,0,1059,1061,3,262,131,0,1060,1059,1,0,0,0,1061,1064,1,0,0,0,1062,1060,
	1,0,0,0,1062,1063,1,0,0,0,1063,1066,1,0,0,0,1064,1062,1,0,0,0,1065,1067,
	3,14,7,0,1066,1065,1,0,0,0,1066,1067,1,0,0,0,1067,1089,1,0,0,0,1068,1072,
	3,84,42,0,1069,1071,3,262,131,0,1070,1069,1,0,0,0,1071,1074,1,0,0,0,1072,
	1070,1,0,0,0,1072,1073,1,0,0,0,1073,1076,1,0,0,0,1074,1072,1,0,0,0,1075,
	1077,3,14,7,0,1076,1075,1,0,0,0,1076,1077,1,0,0,0,1077,1089,1,0,0,0,1078,
	1082,3,82,41,0,1079,1081,3,262,131,0,1080,1079,1,0,0,0,1081,1084,1,0,0,
	0,1082,1080,1,0,0,0,1082,1083,1,0,0,0,1083,1086,1,0,0,0,1084,1082,1,0,0,
	0,1085,1087,3,14,7,0,1086,1085,1,0,0,0,1086,1087,1,0,0,0,1087,1089,1,0,
	0,0,1088,1058,1,0,0,0,1088,1068,1,0,0,0,1088,1078,1,0,0,0,1089,109,1,0,
	0,0,1090,1094,5,4,0,0,1091,1093,3,112,56,0,1092,1091,1,0,0,0,1093,1096,
	1,0,0,0,1094,1092,1,0,0,0,1094,1095,1,0,0,0,1095,1097,1,0,0,0,1096,1094,
	1,0,0,0,1097,1100,5,6,0,0,1098,1100,3,112,56,0,1099,1090,1,0,0,0,1099,1098,
	1,0,0,0,1100,111,1,0,0,0,1101,1134,3,90,45,0,1102,1134,3,134,67,0,1103,
	1134,3,136,68,0,1104,1134,3,142,71,0,1105,1134,3,146,73,0,1106,1134,3,148,
	74,0,1107,1134,3,150,75,0,1108,1134,3,152,76,0,1109,1134,3,140,70,0,1110,
	1134,3,128,64,0,1111,1134,3,132,66,0,1112,1134,3,156,78,0,1113,1134,3,158,
	79,0,1114,1134,3,160,80,0,1115,1134,3,162,81,0,1116,1134,3,182,91,0,1117,
	1134,3,126,63,0,1118,1134,3,114,57,0,1119,1134,3,116,58,0,1120,1134,3,118,
	59,0,1121,1134,3,120,60,0,1122,1134,3,122,61,0,1123,1134,3,124,62,0,1124,
	1134,3,184,92,0,1125,1134,3,224,112,0,1126,1134,3,236,118,0,1127,1134,3,
	238,119,0,1128,1134,3,154,77,0,1129,1134,3,216,108,0,1130,1134,3,218,109,
	0,1131,1134,3,230,115,0,1132,1134,3,232,116,0,1133,1101,1,0,0,0,1133,1102,
	1,0,0,0,1133,1103,1,0,0,0,1133,1104,1,0,0,0,1133,1105,1,0,0,0,1133,1106,
	1,0,0,0,1133,1107,1,0,0,0,1133,1108,1,0,0,0,1133,1109,1,0,0,0,1133,1110,
	1,0,0,0,1133,1111,1,0,0,0,1133,1112,1,0,0,0,1133,1113,1,0,0,0,1133,1114,
	1,0,0,0,1133,1115,1,0,0,0,1133,1116,1,0,0,0,1133,1117,1,0,0,0,1133,1118,
	1,0,0,0,1133,1119,1,0,0,0,1133,1120,1,0,0,0,1133,1121,1,0,0,0,1133,1122,
	1,0,0,0,1133,1123,1,0,0,0,1133,1124,1,0,0,0,1133,1125,1,0,0,0,1133,1126,
	1,0,0,0,1133,1127,1,0,0,0,1133,1128,1,0,0,0,1133,1129,1,0,0,0,1133,1130,
	1,0,0,0,1133,1131,1,0,0,0,1133,1132,1,0,0,0,1134,113,1,0,0,0,1135,1136,
	5,74,0,0,1136,1137,5,12,0,0,1137,1138,5,180,0,0,1138,1139,5,49,0,0,1139,
	1140,3,258,129,0,1140,1141,5,5,0,0,1141,1142,3,258,129,0,1142,1143,5,50,
	0,0,1143,1144,5,2,0,0,1144,115,1,0,0,0,1145,1146,5,74,0,0,1146,1147,5,12,
	0,0,1147,1148,5,180,0,0,1148,1149,5,66,0,0,1149,1150,3,258,129,0,1150,1151,
	5,67,0,0,1151,1152,5,12,0,0,1152,1153,5,180,0,0,1153,1154,5,49,0,0,1154,
	1159,3,258,129,0,1155,1156,5,5,0,0,1156,1158,3,258,129,0,1157,1155,1,0,
	0,0,1158,1161,1,0,0,0,1159,1157,1,0,0,0,1159,1160,1,0,0,0,1160,1162,1,0,
	0,0,1161,1159,1,0,0,0,1162,1163,5,50,0,0,1163,1164,5,2,0,0,1164,117,1,0,
	0,0,1165,1166,5,75,0,0,1166,1195,5,2,0,0,1167,1168,5,75,0,0,1168,1173,3,
	258,129,0,1169,1170,5,5,0,0,1170,1172,3,258,129,0,1171,1169,1,0,0,0,1172,
	1175,1,0,0,0,1173,1171,1,0,0,0,1173,1174,1,0,0,0,1174,1176,1,0,0,0,1175,
	1173,1,0,0,0,1176,1177,5,2,0,0,1177,1195,1,0,0,0,1178,1179,5,75,0,0,1179,
	1180,5,49,0,0,1180,1185,3,258,129,0,1181,1182,5,5,0,0,1182,1184,3,258,129,
	0,1183,1181,1,0,0,0,1184,1187,1,0,0,0,1185,1183,1,0,0,0,1185,1186,1,0,0,
	0,1186,1189,1,0,0,0,1187,1185,1,0,0,0,1188,1190,5,5,0,0,1189,1188,1,0,0,
	0,1189,1190,1,0,0,0,1190,1191,1,0,0,0,1191,1192,5,50,0,0,1192,1193,5,2,
	0,0,1193,1195,1,0,0,0,1194,1165,1,0,0,0,1194,1167,1,0,0,0,1194,1178,1,0,
	0,0,1195,119,1,0,0,0,1196,1199,5,180,0,0,1197,1198,5,12,0,0,1198,1200,5,
	180,0,0,1199,1197,1,0,0,0,1199,1200,1,0,0,0,1200,1201,1,0,0,0,1201,1202,
	5,49,0,0,1202,1214,5,4,0,0,1203,1208,3,246,123,0,1204,1205,5,5,0,0,1205,
	1207,3,246,123,0,1206,1204,1,0,0,0,1207,1210,1,0,0,0,1208,1206,1,0,0,0,
	1208,1209,1,0,0,0,1209,1212,1,0,0,0,1210,1208,1,0,0,0,1211,1213,5,5,0,0,
	1212,1211,1,0,0,0,1212,1213,1,0,0,0,1213,1215,1,0,0,0,1214,1203,1,0,0,0,
	1214,1215,1,0,0,0,1215,1216,1,0,0,0,1216,1217,5,6,0,0,1217,1218,5,50,0,
	0,1218,1242,5,2,0,0,1219,1220,5,180,0,0,1220,1221,3,248,124,0,1221,1222,
	5,2,0,0,1222,1242,1,0,0,0,1223,1224,5,180,0,0,1224,1225,5,12,0,0,1225,1226,
	5,180,0,0,1226,1227,3,248,124,0,1227,1228,5,2,0,0,1228,1242,1,0,0,0,1229,
	1230,5,180,0,0,1230,1231,3,248,124,0,1231,1232,5,12,0,0,1232,1233,5,180,
	0,0,1233,1234,5,12,0,0,1234,1236,5,180,0,0,1235,1237,3,250,125,0,1236,1235,
	1,0,0,0,1236,1237,1,0,0,0,1237,1238,1,0,0,0,1238,1239,3,248,124,0,1239,
	1240,5,2,0,0,1240,1242,1,0,0,0,1241,1196,1,0,0,0,1241,1219,1,0,0,0,1241,
	1223,1,0,0,0,1241,1229,1,0,0,0,1242,121,1,0,0,0,1243,1244,3,258,129,0,1244,
	1245,5,12,0,0,1245,1247,5,180,0,0,1246,1248,3,250,125,0,1247,1246,1,0,0,
	0,1247,1248,1,0,0,0,1248,1249,1,0,0,0,1249,1250,3,248,124,0,1250,1251,5,
	2,0,0,1251,123,1,0,0,0,1252,1253,5,31,0,0,1253,1254,5,49,0,0,1254,1255,
	3,258,129,0,1255,1256,5,50,0,0,1256,1257,5,2,0,0,1257,125,1,0,0,0,1258,
	1259,5,76,0,0,1259,1262,5,180,0,0,1260,1261,5,12,0,0,1261,1263,5,180,0,
	0,1262,1260,1,0,0,0,1262,1263,1,0,0,0,1263,1264,1,0,0,0,1264,1265,5,49,
	0,0,1265,1277,5,4,0,0,1266,1271,3,246,123,0,1267,1268,5,5,0,0,1268,1270,
	3,246,123,0,1269,1267,1,0,0,0,1270,1273,1,0,0,0,1271,1269,1,0,0,0,1271,
	1272,1,0,0,0,1272,1275,1,0,0,0,1273,1271,1,0,0,0,1274,1276,5,5,0,0,1275,
	1274,1,0,0,0,1275,1276,1,0,0,0,1276,1278,1,0,0,0,1277,1266,1,0,0,0,1277,
	1278,1,0,0,0,1278,1279,1,0,0,0,1279,1280,5,6,0,0,1280,1281,5,50,0,0,1281,
	1292,5,2,0,0,1282,1283,5,76,0,0,1283,1286,5,180,0,0,1284,1285,5,12,0,0,
	1285,1287,5,180,0,0,1286,1284,1,0,0,0,1286,1287,1,0,0,0,1287,1288,1,0,0,
	0,1288,1289,3,248,124,0,1289,1290,5,2,0,0,1290,1292,1,0,0,0,1291,1258,1,
	0,0,0,1291,1282,1,0,0,0,1292,127,1,0,0,0,1293,1294,5,74,0,0,1294,1295,5,
	12,0,0,1295,1304,5,180,0,0,1296,1297,5,66,0,0,1297,1298,3,258,129,0,1298,
	1299,5,67,0,0,1299,1301,1,0,0,0,1300,1296,1,0,0,0,1301,1302,1,0,0,0,1302,
	1300,1,0,0,0,1302,1303,1,0,0,0,1303,1305,1,0,0,0,1304,1300,1,0,0,0,1304,
	1305,1,0,0,0,1305,1309,1,0,0,0,1306,1308,3,130,65,0,1307,1306,1,0,0,0,1308,
	1311,1,0,0,0,1309,1307,1,0,0,0,1309,1310,1,0,0,0,1310,1312,1,0,0,0,1311,
	1309,1,0,0,0,1312,1313,7,10,0,0,1313,1314,3,258,129,0,1314,1315,5,2,0,0,
	1315,1412,1,0,0,0,1316,1321,5,180,0,0,1317,1318,5,66,0,0,1318,1319,3,258,
	129,0,1319,1320,5,67,0,0,1320,1322,1,0,0,0,1321,1317,1,0,0,0,1322,1323,
	1,0,0,0,1323,1321,1,0,0,0,1323,1324,1,0,0,0,1324,1328,1,0,0,0,1325,1327,
	3,130,65,0,1326,1325,1,0,0,0,1327,1330,1,0,0,0,1328,1326,1,0,0,0,1328,1329,
	1,0,0,0,1329,1331,1,0,0,0,1330,1328,1,0,0,0,1331,1332,7,10,0,0,1332,1333,
	3,258,129,0,1333,1334,5,2,0,0,1334,1412,1,0,0,0,1335,1337,5,180,0,0,1336,
	1338,3,130,65,0,1337,1336,1,0,0,0,1338,1339,1,0,0,0,1339,1337,1,0,0,0,1339,
	1340,1,0,0,0,1340,1341,1,0,0,0,1341,1342,7,10,0,0,1342,1343,3,258,129,0,
	1343,1344,5,2,0,0,1344,1412,1,0,0,0,1345,1347,5,180,0,0,1346,1348,3,130,
	65,0,1347,1346,1,0,0,0,1348,1349,1,0,0,0,1349,1347,1,0,0,0,1349,1350,1,
	0,0,0,1350,1355,1,0,0,0,1351,1352,5,66,0,0,1352,1353,3,258,129,0,1353,1354,
	5,67,0,0,1354,1356,1,0,0,0,1355,1351,1,0,0,0,1356,1357,1,0,0,0,1357,1355,
	1,0,0,0,1357,1358,1,0,0,0,1358,1359,1,0,0,0,1359,1360,7,10,0,0,1360,1361,
	3,258,129,0,1361,1362,5,2,0,0,1362,1412,1,0,0,0,1363,1364,5,74,0,0,1364,
	1365,5,12,0,0,1365,1374,5,180,0,0,1366,1367,5,66,0,0,1367,1368,3,258,129,
	0,1368,1369,5,67,0,0,1369,1371,1,0,0,0,1370,1366,1,0,0,0,1371,1372,1,0,
	0,0,1372,1370,1,0,0,0,1372,1373,1,0,0,0,1373,1375,1,0,0,0,1374,1370,1,0,
	0,0,1374,1375,1,0,0,0,1375,1379,1,0,0,0,1376,1378,3,130,65,0,1377,1376,
	1,0,0,0,1378,1381,1,0,0,0,1379,1377,1,0,0,0,1379,1380,1,0,0,0,1380,1382,
	1,0,0,0,1381,1379,1,0,0,0,1382,1383,7,11,0,0,1383,1412,5,2,0,0,1384,1389,
	5,180,0,0,1385,1386,5,66,0,0,1386,1387,3,258,129,0,1387,1388,5,67,0,0,1388,
	1390,1,0,0,0,1389,1385,1,0,0,0,1390,1391,1,0,0,0,1391,1389,1,0,0,0,1391,
	1392,1,0,0,0,1392,1396,1,0,0,0,1393,1395,3,130,65,0,1394,1393,1,0,0,0,1395,
	1398,1,0,0,0,1396,1394,1,0,0,0,1396,1397,1,0,0,0,1397,1399,1,0,0,0,1398,
	1396,1,0,0,0,1399,1400,7,11,0,0,1400,1401,5,2,0,0,1401,1412,1,0,0,0,1402,
	1404,5,180,0,0,1403,1405,3,130,65,0,1404,1403,1,0,0,0,1405,1406,1,0,0,0,
	1406,1404,1,0,0,0,1406,1407,1,0,0,0,1407,1408,1,0,0,0,1408,1409,7,11,0,
	0,1409,1410,5,2,0,0,1410,1412,1,0,0,0,1411,1293,1,0,0,0,1411,1316,1,0,0,
	0,1411,1335,1,0,0,0,1411,1345,1,0,0,0,1411,1363,1,0,0,0,1411,1384,1,0,0,
	0,1411,1402,1,0,0,0,1412,129,1,0,0,0,1413,1414,5,12,0,0,1414,1417,5,180,
	0,0,1415,1417,5,163,0,0,1416,1413,1,0,0,0,1416,1415,1,0,0,0,1417,131,1,
	0,0,0,1418,1419,5,74,0,0,1419,1420,5,12,0,0,1420,1427,5,180,0,0,1421,1422,
	5,66,0,0,1422,1423,3,258,129,0,1423,1424,5,67,0,0,1424,1426,1,0,0,0,1425,
	1421,1,0,0,0,1426,1429,1,0,0,0,1427,1425,1,0,0,0,1427,1428,1,0,0,0,1428,
	1430,1,0,0,0,1429,1427,1,0,0,0,1430,1431,5,169,0,0,1431,1432,5,49,0,0,1432,
	1433,3,258,129,0,1433,1434,5,50,0,0,1434,1435,5,2,0,0,1435,133,1,0,0,0,
	1436,1440,3,270,135,0,1437,1439,3,262,131,0,1438,1437,1,0,0,0,1439,1442,
	1,0,0,0,1440,1438,1,0,0,0,1440,1441,1,0,0,0,1441,1443,1,0,0,0,1442,1440,
	1,0,0,0,1443,1446,3,14,7,0,1444,1445,5,40,0,0,1445,1447,3,258,129,0,1446,
	1444,1,0,0,0,1446,1447,1,0,0,0,1447,1448,1,0,0,0,1448,1449,5,2,0,0,1449,
	1465,1,0,0,0,1450,1454,3,84,42,0,1451,1453,3,262,131,0,1452,1451,1,0,0,
	0,1453,1456,1,0,0,0,1454,1452,1,0,0,0,1454,1455,1,0,0,0,1455,1457,1,0,0,
	0,1456,1454,1,0,0,0,1457,1460,3,14,7,0,1458,1459,5,40,0,0,1459,1461,3,258,
	129,0,1460,1458,1,0,0,0,1460,1461,1,0,0,0,1461,1462,1,0,0,0,1462,1463,5,
	2,0,0,1463,1465,1,0,0,0,1464,1436,1,0,0,0,1464,1450,1,0,0,0,1465,135,1,
	0,0,0,1466,1467,3,270,135,0,1467,1472,5,180,0,0,1468,1469,5,5,0,0,1469,
	1470,3,270,135,0,1470,1471,5,180,0,0,1471,1473,1,0,0,0,1472,1468,1,0,0,
	0,1473,1474,1,0,0,0,1474,1472,1,0,0,0,1474,1475,1,0,0,0,1475,1476,1,0,0,
	0,1476,1477,5,40,0,0,1477,1478,3,258,129,0,1478,1479,5,2,0,0,1479,1515,
	1,0,0,0,1480,1481,5,49,0,0,1481,1484,3,138,69,0,1482,1483,5,5,0,0,1483,
	1485,3,138,69,0,1484,1482,1,0,0,0,1485,1486,1,0,0,0,1486,1484,1,0,0,0,1486,
	1487,1,0,0,0,1487,1488,1,0,0,0,1488,1489,5,50,0,0,1489,1490,5,40,0,0,1490,
	1491,5,49,0,0,1491,1494,3,258,129,0,1492,1493,5,5,0,0,1493,1495,3,258,129,
	0,1494,1492,1,0,0,0,1495,1496,1,0,0,0,1496,1494,1,0,0,0,1496,1497,1,0,0,
	0,1497,1498,1,0,0,0,1498,1499,5,50,0,0,1499,1500,5,2,0,0,1500,1515,1,0,
	0,0,1501,1502,5,49,0,0,1502,1505,3,138,69,0,1503,1504,5,5,0,0,1504,1506,
	3,138,69,0,1505,1503,1,0,0,0,1506,1507,1,0,0,0,1507,1505,1,0,0,0,1507,1508,
	1,0,0,0,1508,1509,1,0,0,0,1509,1510,5,50,0,0,1510,1511,5,40,0,0,1511,1512,
	3,258,129,0,1512,1513,5,2,0,0,1513,1515,1,0,0,0,1514,1466,1,0,0,0,1514,
	1480,1,0,0,0,1514,1501,1,0,0,0,1515,137,1,0,0,0,1516,1520,3,270,135,0,1517,
	1519,3,262,131,0,1518,1517,1,0,0,0,1519,1522,1,0,0,0,1520,1518,1,0,0,0,
	1520,1521,1,0,0,0,1521,1523,1,0,0,0,1522,1520,1,0,0,0,1523,1524,3,14,7,
	0,1524,1528,1,0,0,0,1525,1528,3,14,7,0,1526,1528,1,0,0,0,1527,1516,1,0,
	0,0,1527,1525,1,0,0,0,1527,1526,1,0,0,0,1528,139,1,0,0,0,1529,1530,5,180,
	0,0,1530,1531,7,10,0,0,1531,1532,3,258,129,0,1532,1533,5,2,0,0,1533,1541,
	1,0,0,0,1534,1535,5,180,0,0,1535,1536,7,11,0,0,1536,1541,5,2,0,0,1537,1538,
	7,11,0,0,1538,1539,5,180,0,0,1539,1541,5,2,0,0,1540,1529,1,0,0,0,1540,1534,
	1,0,0,0,1540,1537,1,0,0,0,1541,141,1,0,0,0,1542,1543,5,180,0,0,1543,1544,
	5,165,0,0,1544,1546,5,49,0,0,1545,1547,3,144,72,0,1546,1545,1,0,0,0,1546,
	1547,1,0,0,0,1547,1548,1,0,0,0,1548,1549,5,50,0,0,1549,1578,5,2,0,0,1550,
	1551,5,180,0,0,1551,1552,5,12,0,0,1552,1553,5,180,0,0,1553,1554,5,165,0,
	0,1554,1556,5,49,0,0,1555,1557,3,144,72,0,1556,1555,1,0,0,0,1556,1557,1,
	0,0,0,1557,1558,1,0,0,0,1558,1559,5,50,0,0,1559,1578,5,2,0,0,1560,1565,
	5,180,0,0,1561,1562,5,66,0,0,1562,1563,3,258,129,0,1563,1564,5,67,0,0,1564,
	1566,1,0,0,0,1565,1561,1,0,0,0,1566,1567,1,0,0,0,1567,1565,1,0,0,0,1567,
	1568,1,0,0,0,1568,1569,1,0,0,0,1569,1570,5,165,0,0,1570,1572,5,49,0,0,1571,
	1573,3,144,72,0,1572,1571,1,0,0,0,1572,1573,1,0,0,0,1573,1574,1,0,0,0,1574,
	1575,5,50,0,0,1575,1576,5,2,0,0,1576,1578,1,0,0,0,1577,1542,1,0,0,0,1577,
	1550,1,0,0,0,1577,1560,1,0,0,0,1578,143,1,0,0,0,1579,1580,3,258,129,0,1580,
	145,1,0,0,0,1581,1582,5,180,0,0,1582,1583,5,166,0,0,1583,1584,5,49,0,0,
	1584,1585,5,50,0,0,1585,1608,5,2,0,0,1586,1587,5,180,0,0,1587,1588,5,12,
	0,0,1588,1589,5,180,0,0,1589,1590,5,166,0,0,1590,1591,5,49,0,0,1591,1592,
	5,50,0,0,1592,1608,5,2,0,0,1593,1598,5,180,0,0,1594,1595,5,66,0,0,1595,
	1596,3,258,129,0,1596,1597,5,67,0,0,1597,1599,1,0,0,0,1598,1594,1,0,0,0,
	1599,1600,1,0,0,0,1600,1598,1,0,0,0,1600,1601,1,0,0,0,1601,1602,1,0,0,0,
	1602,1603,5,166,0,0,1603,1604,5,49,0,0,1604,1605,5,50,0,0,1605,1606,5,2,
	0,0,1606,1608,1,0,0,0,1607,1581,1,0,0,0,1607,1586,1,0,0,0,1607,1593,1,0,
	0,0,1608,147,1,0,0,0,1609,1610,5,180,0,0,1610,1611,5,169,0,0,1611,1612,
	5,49,0,0,1612,1613,3,258,129,0,1613,1614,5,50,0,0,1614,1615,5,2,0,0,1615,
	149,1,0,0,0,1616,1617,5,74,0,0,1617,1618,5,12,0,0,1618,1619,5,180,0,0,1619,
	1620,5,165,0,0,1620,1622,5,49,0,0,1621,1623,3,144,72,0,1622,1621,1,0,0,
	0,1622,1623,1,0,0,0,1623,1624,1,0,0,0,1624,1625,5,50,0,0,1625,1658,5,2,
	0,0,1626,1627,5,74,0,0,1627,1628,5,12,0,0,1628,1633,5,180,0,0,1629,1630,
	5,66,0,0,1630,1631,3,258,129,0,1631,1632,5,67,0,0,1632,1634,1,0,0,0,1633,
	1629,1,0,0,0,1634,1635,1,0,0,0,1635,1633,1,0,0,0,1635,1636,1,0,0,0,1636,
	1637,1,0,0,0,1637,1638,5,165,0,0,1638,1640,5,49,0,0,1639,1641,3,144,72,
	0,1640,1639,1,0,0,0,1640,1641,1,0,0,0,1641,1642,1,0,0,0,1642,1643,5,50,
	0,0,1643,1644,5,2,0,0,1644,1658,1,0,0,0,1645,1646,5,74,0,0,1646,1647,5,
	12,0,0,1647,1648,5,180,0,0,1648,1649,5,12,0,0,1649,1650,5,180,0,0,1650,
	1651,5,165,0,0,1651,1653,5,49,0,0,1652,1654,3,144,72,0,1653,1652,1,0,0,
	0,1653,1654,1,0,0,0,1654,1655,1,0,0,0,1655,1656,5,50,0,0,1656,1658,5,2,
	0,0,1657,1616,1,0,0,0,1657,1626,1,0,0,0,1657,1645,1,0,0,0,1658,151,1,0,
	0,0,1659,1660,5,74,0,0,1660,1661,5,12,0,0,1661,1662,5,180,0,0,1662,1663,
	5,166,0,0,1663,1664,5,49,0,0,1664,1665,5,50,0,0,1665,1692,5,2,0,0,1666,
	1667,5,74,0,0,1667,1668,5,12,0,0,1668,1673,5,180,0,0,1669,1670,5,66,0,0,
	1670,1671,3,258,129,0,1671,1672,5,67,0,0,1672,1674,1,0,0,0,1673,1669,1,
	0,0,0,1674,1675,1,0,0,0,1675,1673,1,0,0,0,1675,1676,1,0,0,0,1676,1677,1,
	0,0,0,1677,1678,5,166,0,0,1678,1679,5,49,0,0,1679,1680,5,50,0,0,1680,1681,
	5,2,0,0,1681,1692,1,0,0,0,1682,1683,5,74,0,0,1683,1684,5,12,0,0,1684,1685,
	5,180,0,0,1685,1686,5,12,0,0,1686,1687,5,180,0,0,1687,1688,5,166,0,0,1688,
	1689,5,49,0,0,1689,1690,5,50,0,0,1690,1692,5,2,0,0,1691,1659,1,0,0,0,1691,
	1666,1,0,0,0,1691,1682,1,0,0,0,1692,153,1,0,0,0,1693,1694,5,89,0,0,1694,
	1695,5,180,0,0,1695,1746,5,2,0,0,1696,1697,5,89,0,0,1697,1698,5,74,0,0,
	1698,1699,5,12,0,0,1699,1700,5,180,0,0,1700,1746,5,2,0,0,1701,1702,5,89,
	0,0,1702,1703,5,74,0,0,1703,1704,5,12,0,0,1704,1709,5,180,0,0,1705,1706,
	5,66,0,0,1706,1707,3,258,129,0,1707,1708,5,67,0,0,1708,1710,1,0,0,0,1709,
	1705,1,0,0,0,1710,1711,1,0,0,0,1711,1709,1,0,0,0,1711,1712,1,0,0,0,1712,
	1713,1,0,0,0,1713,1714,5,2,0,0,1714,1746,1,0,0,0,1715,1716,5,89,0,0,1716,
	1721,5,180,0,0,1717,1718,5,66,0,0,1718,1719,3,258,129,0,1719,1720,5,67,
	0,0,1720,1722,1,0,0,0,1721,1717,1,0,0,0,1722,1723,1,0,0,0,1723,1721,1,0,
	0,0,1723,1724,1,0,0,0,1724,1725,1,0,0,0,1725,1726,5,2,0,0,1726,1746,1,0,
	0,0,1727,1728,5,89,0,0,1728,1731,5,180,0,0,1729,1730,5,12,0,0,1730,1732,
	5,180,0,0,1731,1729,1,0,0,0,1732,1733,1,0,0,0,1733,1731,1,0,0,0,1733,1734,
	1,0,0,0,1734,1739,1,0,0,0,1735,1736,5,66,0,0,1736,1737,3,258,129,0,1737,
	1738,5,67,0,0,1738,1740,1,0,0,0,1739,1735,1,0,0,0,1740,1741,1,0,0,0,1741,
	1739,1,0,0,0,1741,1742,1,0,0,0,1742,1743,1,0,0,0,1743,1744,5,2,0,0,1744,
	1746,1,0,0,0,1745,1693,1,0,0,0,1745,1696,1,0,0,0,1745,1701,1,0,0,0,1745,
	1715,1,0,0,0,1745,1727,1,0,0,0,1746,155,1,0,0,0,1747,1748,5,90,0,0,1748,
	1749,5,49,0,0,1749,1750,5,154,0,0,1750,1751,5,23,0,0,1751,1754,3,258,129,
	0,1752,1753,5,5,0,0,1753,1755,3,234,117,0,1754,1752,1,0,0,0,1754,1755,1,
	0,0,0,1755,1756,1,0,0,0,1756,1757,5,50,0,0,1757,1758,5,2,0,0,1758,157,1,
	0,0,0,1759,1760,5,90,0,0,1760,1761,5,49,0,0,1761,1764,3,258,129,0,1762,
	1763,5,5,0,0,1763,1765,3,234,117,0,1764,1762,1,0,0,0,1764,1765,1,0,0,0,
	1765,1766,1,0,0,0,1766,1767,5,50,0,0,1767,1768,5,2,0,0,1768,159,1,0,0,0,
	1769,1770,5,91,0,0,1770,1771,5,49,0,0,1771,1772,3,258,129,0,1772,1773,5,
	50,0,0,1773,1776,3,110,55,0,1774,1775,5,92,0,0,1775,1777,3,110,55,0,1776,
	1774,1,0,0,0,1776,1777,1,0,0,0,1777,161,1,0,0,0,1778,1785,3,178,89,0,1779,
	1785,3,180,90,0,1780,1785,3,170,85,0,1781,1785,3,164,82,0,1782,1785,3,166,
	83,0,1783,1785,3,168,84,0,1784,1778,1,0,0,0,1784,1779,1,0,0,0,1784,1780,
	1,0,0,0,1784,1781,1,0,0,0,1784,1782,1,0,0,0,1784,1783,1,0,0,0,1785,163,
	1,0,0,0,1786,1787,5,9,0,0,1787,1788,5,49,0,0,1788,1789,3,270,135,0,1789,
	1790,5,180,0,0,1790,1791,5,5,0,0,1791,1792,3,270,135,0,1792,1793,5,180,
	0,0,1793,1794,5,93,0,0,1794,1795,5,74,0,0,1795,1796,5,12,0,0,1796,1797,
	5,180,0,0,1797,1798,5,12,0,0,1798,1799,5,34,0,0,1799,1800,5,50,0,0,1800,
	1801,3,110,55,0,1801,165,1,0,0,0,1802,1803,5,9,0,0,1803,1804,5,49,0,0,1804,
	1805,3,270,135,0,1805,1806,5,180,0,0,1806,1807,5,94,0,0,1807,1808,5,74,
	0,0,1808,1809,5,12,0,0,1809,1810,5,180,0,0,1810,1811,5,50,0,0,1811,1812,
	3,110,55,0,1812,167,1,0,0,0,1813,1814,5,9,0,0,1814,1815,5,49,0,0,1815,1816,
	3,270,135,0,1816,1817,5,180,0,0,1817,1818,5,93,0,0,1818,1819,5,74,0,0,1819,
	1820,5,12,0,0,1820,1821,5,180,0,0,1821,1822,5,50,0,0,1822,1823,3,110,55,
	0,1823,169,1,0,0,0,1824,1825,5,9,0,0,1825,1826,5,49,0,0,1826,1827,3,172,
	86,0,1827,1829,3,174,87,0,1828,1830,3,176,88,0,1829,1828,1,0,0,0,1829,1830,
	1,0,0,0,1830,1831,1,0,0,0,1831,1832,5,50,0,0,1832,1833,3,110,55,0,1833,
	171,1,0,0,0,1834,1838,3,270,135,0,1835,1837,3,262,131,0,1836,1835,1,0,0,
	0,1837,1840,1,0,0,0,1838,1836,1,0,0,0,1838,1839,1,0,0,0,1839,1841,1,0,0,
	0,1840,1838,1,0,0,0,1841,1844,5,180,0,0,1842,1843,5,40,0,0,1843,1845,3,
	258,129,0,1844,1842,1,0,0,0,1844,1845,1,0,0,0,1845,1846,1,0,0,0,1846,1847,
	5,2,0,0,1847,1855,1,0,0,0,1848,1849,5,180,0,0,1849,1850,7,10,0,0,1850,1851,
	3,258,129,0,1851,1852,5,2,0,0,1852,1855,1,0,0,0,1853,1855,5,2,0,0,1854,
	1834,1,0,0,0,1854,1848,1,0,0,0,1854,1853,1,0,0,0,1855,173,1,0,0,0,1856,
	1857,3,258,129,0,1857,1858,5,2,0,0,1858,175,1,0,0,0,1859,1860,5,180,0,0,
	1860,1861,7,10,0,0,1861,1867,3,258,129,0,1862,1863,5,180,0,0,1863,1867,
	7,11,0,0,1864,1865,7,11,0,0,1865,1867,5,180,0,0,1866,1859,1,0,0,0,1866,
	1862,1,0,0,0,1866,1864,1,0,0,0,1867,177,1,0,0,0,1868,1869,5,95,0,0,1869,
	1870,3,110,55,0,1870,1871,5,96,0,0,1871,1872,5,49,0,0,1872,1873,3,258,129,
	0,1873,1874,5,50,0,0,1874,1875,5,2,0,0,1875,179,1,0,0,0,1876,1877,5,96,
	0,0,1877,1878,5,49,0,0,1878,1879,3,258,129,0,1879,1880,5,50,0,0,1880,1881,
	3,110,55,0,1881,181,1,0,0,0,1882,1883,5,97,0,0,1883,1884,3,242,121,0,1884,
	1885,5,2,0,0,1885,183,1,0,0,0,1886,1887,5,98,0,0,1887,1888,3,186,93,0,1888,
	185,1,0,0,0,1889,1893,5,4,0,0,1890,1892,3,188,94,0,1891,1890,1,0,0,0,1892,
	1895,1,0,0,0,1893,1891,1,0,0,0,1893,1894,1,0,0,0,1894,1896,1,0,0,0,1895,
	1893,1,0,0,0,1896,1897,5,6,0,0,1897,187,1,0,0,0,1898,1912,3,186,93,0,1899,
	1912,3,190,95,0,1900,1912,3,192,96,0,1901,1912,3,194,97,0,1902,1912,3,196,
	98,0,1903,1912,3,202,101,0,1904,1912,3,204,102,0,1905,1912,5,99,0,0,1906,
	1912,5,100,0,0,1907,1912,5,101,0,0,1908,1912,3,208,104,0,1909,1912,3,212,
	106,0,1910,1912,3,214,107,0,1911,1898,1,0,0,0,1911,1899,1,0,0,0,1911,1900,
	1,0,0,0,1911,1901,1,0,0,0,1911,1902,1,0,0,0,1911,1903,1,0,0,0,1911,1904,
	1,0,0,0,1911,1905,1,0,0,0,1911,1906,1,0,0,0,1911,1907,1,0,0,0,1911,1908,
	1,0,0,0,1911,1909,1,0,0,0,1911,1910,1,0,0,0,1912,189,1,0,0,0,1913,1914,
	5,102,0,0,1914,1919,3,14,7,0,1915,1916,5,5,0,0,1916,1918,3,14,7,0,1917,
	1915,1,0,0,0,1918,1921,1,0,0,0,1919,1917,1,0,0,0,1919,1920,1,0,0,0,1920,
	1924,1,0,0,0,1921,1919,1,0,0,0,1922,1923,5,103,0,0,1923,1925,3,206,103,
	0,1924,1922,1,0,0,0,1924,1925,1,0,0,0,1925,191,1,0,0,0,1926,1931,3,212,
	106,0,1927,1928,5,5,0,0,1928,1930,3,212,106,0,1929,1927,1,0,0,0,1930,1933,
	1,0,0,0,1931,1929,1,0,0,0,1931,1932,1,0,0,0,1932,1934,1,0,0,0,1933,1931,
	1,0,0,0,1934,1935,5,103,0,0,1935,1936,3,206,103,0,1936,193,1,0,0,0,1937,
	1938,5,91,0,0,1938,1939,3,206,103,0,1939,1940,3,186,93,0,1940,195,1,0,0,
	0,1941,1942,5,104,0,0,1942,1952,3,206,103,0,1943,1945,3,198,99,0,1944,1943,
	1,0,0,0,1945,1946,1,0,0,0,1946,1944,1,0,0,0,1946,1947,1,0,0,0,1947,1949,
	1,0,0,0,1948,1950,3,200,100,0,1949,1948,1,0,0,0,1949,1950,1,0,0,0,1950,
	1953,1,0,0,0,1951,1953,3,200,100,0,1952,1944,1,0,0,0,1952,1951,1,0,0,0,
	1953,197,1,0,0,0,1954,1955,5,105,0,0,1955,1956,3,214,107,0,1956,1957,3,
	186,93,0,1957,199,1,0,0,0,1958,1959,5,106,0,0,1959,1960,3,186,93,0,1960,
	201,1,0,0,0,1961,1962,5,9,0,0,1962,1963,3,186,93,0,1963,1964,3,206,103,
	0,1964,1965,3,186,93,0,1965,1966,3,186,93,0,1966,203,1,0,0,0,1967,1968,
	5,7,0,0,1968,1969,5,180,0,0,1969,1978,5,49,0,0,1970,1975,5,180,0,0,1971,
	1972,5,5,0,0,1972,1974,5,180,0,0,1973,1971,1,0,0,0,1974,1977,1,0,0,0,1975,
	1973,1,0,0,0,1975,1976,1,0,0,0,1976,1979,1,0,0,0,1977,1975,1,0,0,0,1978,
	1970,1,0,0,0,1978,1979,1,0,0,0,1979,1980,1,0,0,0,1980,1990,5,50,0,0,1981,
	1982,5,107,0,0,1982,1987,5,180,0,0,1983,1984,5,5,0,0,1984,1986,5,180,0,
	0,1985,1983,1,0,0,0,1986,1989,1,0,0,0,1987,1985,1,0,0,0,1987,1988,1,0,0,
	0,1988,1991,1,0,0,0,1989,1987,1,0,0,0,1990,1981,1,0,0,0,1990,1991,1,0,0,
	0,1991,1992,1,0,0,0,1992,1993,3,186,93,0,1993,205,1,0,0,0,1994,1998,3,208,
	104,0,1995,1998,3,212,106,0,1996,1998,3,214,107,0,1997,1994,1,0,0,0,1997,
	1995,1,0,0,0,1997,1996,1,0,0,0,1998,207,1,0,0,0,1999,2000,3,210,105,0,2000,
	2009,5,49,0,0,2001,2006,3,206,103,0,2002,2003,5,5,0,0,2003,2005,3,206,103,
	0,2004,2002,1,0,0,0,2005,2008,1,0,0,0,2006,2004,1,0,0,0,2006,2007,1,0,0,
	0,2007,2010,1,0,0,0,2008,2006,1,0,0,0,2009,2001,1,0,0,0,2009,2010,1,0,0,
	0,2010,2011,1,0,0,0,2011,2012,5,50,0,0,2012,209,1,0,0,0,2013,2014,7,12,
	0,0,2014,211,1,0,0,0,2015,2020,3,14,7,0,2016,2017,5,12,0,0,2017,2019,3,
	14,7,0,2018,2016,1,0,0,0,2019,2022,1,0,0,0,2020,2018,1,0,0,0,2020,2021,
	1,0,0,0,2021,213,1,0,0,0,2022,2020,1,0,0,0,2023,2024,7,13,0,0,2024,215,
	1,0,0,0,2025,2026,5,109,0,0,2026,2030,5,4,0,0,2027,2029,3,112,56,0,2028,
	2027,1,0,0,0,2029,2032,1,0,0,0,2030,2028,1,0,0,0,2030,2031,1,0,0,0,2031,
	2033,1,0,0,0,2032,2030,1,0,0,0,2033,2034,5,6,0,0,2034,217,1,0,0,0,2035,
	2036,5,104,0,0,2036,2037,5,49,0,0,2037,2038,3,258,129,0,2038,2039,5,50,
	0,0,2039,2043,5,4,0,0,2040,2042,3,220,110,0,2041,2040,1,0,0,0,2042,2045,
	1,0,0,0,2043,2041,1,0,0,0,2043,2044,1,0,0,0,2044,2047,1,0,0,0,2045,2043,
	1,0,0,0,2046,2048,3,222,111,0,2047,2046,1,0,0,0,2047,2048,1,0,0,0,2048,
	2049,1,0,0,0,2049,2050,5,6,0,0,2050,219,1,0,0,0,2051,2052,5,105,0,0,2052,
	2053,3,258,129,0,2053,2057,5,110,0,0,2054,2056,3,112,56,0,2055,2054,1,0,
	0,0,2056,2059,1,0,0,0,2057,2055,1,0,0,0,2057,2058,1,0,0,0,2058,221,1,0,
	0,0,2059,2057,1,0,0,0,2060,2061,5,106,0,0,2061,2065,5,110,0,0,2062,2064,
	3,112,56,0,2063,2062,1,0,0,0,2064,2067,1,0,0,0,2065,2063,1,0,0,0,2065,2066,
	1,0,0,0,2066,223,1,0,0,0,2067,2065,1,0,0,0,2068,2069,5,111,0,0,2069,2071,
	3,258,129,0,2070,2072,3,226,113,0,2071,2070,1,0,0,0,2071,2072,1,0,0,0,2072,
	2073,1,0,0,0,2073,2075,3,110,55,0,2074,2076,3,228,114,0,2075,2074,1,0,0,
	0,2076,2077,1,0,0,0,2077,2075,1,0,0,0,2077,2078,1,0,0,0,2078,225,1,0,0,
	0,2079,2080,5,73,0,0,2080,2092,5,49,0,0,2081,2086,3,108,54,0,2082,2083,
	5,5,0,0,2083,2085,3,108,54,0,2084,2082,1,0,0,0,2085,2088,1,0,0,0,2086,2084,
	1,0,0,0,2086,2087,1,0,0,0,2087,2090,1,0,0,0,2088,2086,1,0,0,0,2089,2091,
	5,5,0,0,2090,2089,1,0,0,0,2090,2091,1,0,0,0,2091,2093,1,0,0,0,2092,2081,
	1,0,0,0,2092,2093,1,0,0,0,2093,2094,1,0,0,0,2094,2095,5,50,0,0,2095,227,
	1,0,0,0,2096,2098,5,112,0,0,2097,2099,5,180,0,0,2098,2097,1,0,0,0,2098,
	2099,1,0,0,0,2099,2115,1,0,0,0,2100,2112,5,49,0,0,2101,2106,3,108,54,0,
	2102,2103,5,5,0,0,2103,2105,3,108,54,0,2104,2102,1,0,0,0,2105,2108,1,0,
	0,0,2106,2104,1,0,0,0,2106,2107,1,0,0,0,2107,2110,1,0,0,0,2108,2106,1,0,
	0,0,2109,2111,5,5,0,0,2110,2109,1,0,0,0,2110,2111,1,0,0,0,2111,2113,1,0,
	0,0,2112,2101,1,0,0,0,2112,2113,1,0,0,0,2113,2114,1,0,0,0,2114,2116,5,50,
	0,0,2115,2100,1,0,0,0,2115,2116,1,0,0,0,2116,2117,1,0,0,0,2117,2118,3,110,
	55,0,2118,229,1,0,0,0,2119,2120,5,99,0,0,2120,2121,5,2,0,0,2121,231,1,0,
	0,0,2122,2123,5,100,0,0,2123,2124,5,2,0,0,2124,233,1,0,0,0,2125,2129,5,
	151,0,0,2126,2127,5,180,0,0,2127,2129,3,248,124,0,2128,2125,1,0,0,0,2128,
	2126,1,0,0,0,2129,235,1,0,0,0,2130,2131,5,36,0,0,2131,2134,5,180,0,0,2132,
	2133,5,12,0,0,2133,2135,5,180,0,0,2134,2132,1,0,0,0,2134,2135,1,0,0,0,2135,
	2136,1,0,0,0,2136,2137,5,49,0,0,2137,2149,5,4,0,0,2138,2143,3,246,123,0,
	2139,2140,5,5,0,0,2140,2142,3,246,123,0,2141,2139,1,0,0,0,2142,2145,1,0,
	0,0,2143,2141,1,0,0,0,2143,2144,1,0,0,0,2144,2147,1,0,0,0,2145,2143,1,0,
	0,0,2146,2148,5,5,0,0,2147,2146,1,0,0,0,2147,2148,1,0,0,0,2148,2150,1,0,
	0,0,2149,2138,1,0,0,0,2149,2150,1,0,0,0,2150,2151,1,0,0,0,2151,2152,5,6,
	0,0,2152,2153,5,50,0,0,2153,2173,5,2,0,0,2154,2155,5,36,0,0,2155,2158,5,
	180,0,0,2156,2157,5,12,0,0,2157,2159,5,180,0,0,2158,2156,1,0,0,0,2158,2159,
	1,0,0,0,2159,2160,1,0,0,0,2160,2161,3,248,124,0,2161,2162,5,2,0,0,2162,
	2173,1,0,0,0,2163,2164,5,36,0,0,2164,2165,5,49,0,0,2165,2166,5,151,0,0,
	2166,2167,5,50,0,0,2167,2173,5,2,0,0,2168,2169,5,36,0,0,2169,2170,5,49,
	0,0,2170,2171,5,50,0,0,2171,2173,5,2,0,0,2172,2130,1,0,0,0,2172,2154,1,
	0,0,0,2172,2163,1,0,0,0,2172,2168,1,0,0,0,2173,237,1,0,0,0,2174,2175,5,
	113,0,0,2175,2176,5,49,0,0,2176,2177,3,258,129,0,2177,2178,5,50,0,0,2178,
	2179,5,2,0,0,2179,239,1,0,0,0,2180,2183,5,180,0,0,2181,2183,3,264,132,0,
	2182,2180,1,0,0,0,2182,2181,1,0,0,0,2183,241,1,0,0,0,2184,2196,5,49,0,0,
	2185,2190,3,240,120,0,2186,2187,5,5,0,0,2187,2189,3,240,120,0,2188,2186,
	1,0,0,0,2189,2192,1,0,0,0,2190,2188,1,0,0,0,2190,2191,1,0,0,0,2191,2194,
	1,0,0,0,2192,2190,1,0,0,0,2193,2195,5,5,0,0,2194,2193,1,0,0,0,2194,2195,
	1,0,0,0,2195,2197,1,0,0,0,2196,2185,1,0,0,0,2196,2197,1,0,0,0,2197,2198,
	1,0,0,0,2198,2199,5,50,0,0,2199,243,1,0,0,0,2200,2201,5,180,0,0,2201,2225,
	3,248,124,0,2202,2203,5,180,0,0,2203,2204,5,12,0,0,2204,2205,5,180,0,0,
	2205,2225,3,248,124,0,2206,2207,5,180,0,0,2207,2208,5,49,0,0,2208,2220,
	5,4,0,0,2209,2214,3,246,123,0,2210,2211,5,5,0,0,2211,2213,3,246,123,0,2212,
	2210,1,0,0,0,2213,2216,1,0,0,0,2214,2212,1,0,0,0,2214,2215,1,0,0,0,2215,
	2218,1,0,0,0,2216,2214,1,0,0,0,2217,2219,5,5,0,0,2218,2217,1,0,0,0,2218,
	2219,1,0,0,0,2219,2221,1,0,0,0,2220,2209,1,0,0,0,2220,2221,1,0,0,0,2221,
	2222,1,0,0,0,2222,2223,5,6,0,0,2223,2225,5,50,0,0,2224,2200,1,0,0,0,2224,
	2202,1,0,0,0,2224,2206,1,0,0,0,2225,245,1,0,0,0,2226,2227,5,180,0,0,2227,
	2228,5,110,0,0,2228,2229,3,258,129,0,2229,247,1,0,0,0,2230,2242,5,49,0,
	0,2231,2236,3,258,129,0,2232,2233,5,5,0,0,2233,2235,3,258,129,0,2234,2232,
	1,0,0,0,2235,2238,1,0,0,0,2236,2234,1,0,0,0,2236,2237,1,0,0,0,2237,2240,
	1,0,0,0,2238,2236,1,0,0,0,2239,2241,5,5,0,0,2240,2239,1,0,0,0,2240,2241,
	1,0,0,0,2241,2243,1,0,0,0,2242,2231,1,0,0,0,2242,2243,1,0,0,0,2243,2244,
	1,0,0,0,2244,2245,5,50,0,0,2245,249,1,0,0,0,2246,2247,5,4,0,0,2247,2252,
	3,252,126,0,2248,2249,5,5,0,0,2249,2251,3,252,126,0,2250,2248,1,0,0,0,2251,
	2254,1,0,0,0,2252,2250,1,0,0,0,2252,2253,1,0,0,0,2253,2256,1,0,0,0,2254,
	2252,1,0,0,0,2255,2257,5,5,0,0,2256,2255,1,0,0,0,2256,2257,1,0,0,0,2257,
	2258,1,0,0,0,2258,2259,5,6,0,0,2259,251,1,0,0,0,2260,2261,5,180,0,0,2261,
	2262,5,110,0,0,2262,2263,3,258,129,0,2263,253,1,0,0,0,2264,2265,5,49,0,
	0,2265,2270,3,256,128,0,2266,2267,5,5,0,0,2267,2269,3,256,128,0,2268,2266,
	1,0,0,0,2269,2272,1,0,0,0,2270,2268,1,0,0,0,2270,2271,1,0,0,0,2271,2274,
	1,0,0,0,2272,2270,1,0,0,0,2273,2275,5,5,0,0,2274,2273,1,0,0,0,2274,2275,
	1,0,0,0,2275,2276,1,0,0,0,2276,2277,5,50,0,0,2277,255,1,0,0,0,2278,2281,
	3,270,135,0,2279,2281,3,84,42,0,2280,2278,1,0,0,0,2280,2279,1,0,0,0,2281,
	257,1,0,0,0,2282,2283,6,129,-1,0,2283,2284,5,49,0,0,2284,2285,5,180,0,0,
	2285,2286,7,10,0,0,2286,2287,3,258,129,0,2287,2288,5,50,0,0,2288,2438,1,
	0,0,0,2289,2290,5,49,0,0,2290,2291,3,258,129,0,2291,2292,5,50,0,0,2292,
	2438,1,0,0,0,2293,2294,5,49,0,0,2294,2297,3,258,129,0,2295,2296,5,5,0,0,
	2296,2298,3,258,129,0,2297,2295,1,0,0,0,2298,2299,1,0,0,0,2299,2297,1,0,
	0,0,2299,2300,1,0,0,0,2300,2301,1,0,0,0,2301,2302,5,50,0,0,2302,2438,1,
	0,0,0,2303,2304,3,272,136,0,2304,2305,5,49,0,0,2305,2307,3,258,129,0,2306,
	2308,5,5,0,0,2307,2306,1,0,0,0,2307,2308,1,0,0,0,2308,2309,1,0,0,0,2309,
	2310,5,50,0,0,2310,2438,1,0,0,0,2311,2438,3,244,122,0,2312,2313,5,114,0,
	0,2313,2315,5,180,0,0,2314,2316,3,250,125,0,2315,2314,1,0,0,0,2315,2316,
	1,0,0,0,2316,2317,1,0,0,0,2317,2438,3,248,124,0,2318,2319,5,114,0,0,2319,
	2322,3,270,135,0,2320,2321,5,66,0,0,2321,2323,5,67,0,0,2322,2320,1,0,0,
	0,2323,2324,1,0,0,0,2324,2322,1,0,0,0,2324,2325,1,0,0,0,2325,2326,1,0,0,
	0,2326,2327,5,49,0,0,2327,2328,3,258,129,0,2328,2329,5,50,0,0,2329,2438,
	1,0,0,0,2330,2331,5,114,0,0,2331,2332,5,148,0,0,2332,2333,5,49,0,0,2333,
	2334,3,258,129,0,2334,2335,5,50,0,0,2335,2438,1,0,0,0,2336,2337,5,55,0,
	0,2337,2338,5,49,0,0,2338,2339,3,270,135,0,2339,2340,5,50,0,0,2340,2341,
	5,12,0,0,2341,2342,5,180,0,0,2342,2438,1,0,0,0,2343,2344,5,115,0,0,2344,
	2438,3,248,124,0,2345,2346,5,116,0,0,2346,2438,3,248,124,0,2347,2348,5,
	117,0,0,2348,2438,3,248,124,0,2349,2350,5,118,0,0,2350,2438,3,248,124,0,
	2351,2352,5,119,0,0,2352,2353,5,49,0,0,2353,2354,5,180,0,0,2354,2355,5,
	12,0,0,2355,2356,5,180,0,0,2356,2357,5,5,0,0,2357,2358,3,248,124,0,2358,
	2359,5,50,0,0,2359,2438,1,0,0,0,2360,2361,5,120,0,0,2361,2438,3,248,124,
	0,2362,2363,5,121,0,0,2363,2438,3,248,124,0,2364,2365,5,122,0,0,2365,2366,
	5,49,0,0,2366,2367,3,258,129,0,2367,2368,5,5,0,0,2368,2369,3,254,127,0,
	2369,2370,5,50,0,0,2370,2438,1,0,0,0,2371,2372,5,123,0,0,2372,2373,5,49,
	0,0,2373,2374,3,258,129,0,2374,2375,5,5,0,0,2375,2376,3,254,127,0,2376,
	2377,5,5,0,0,2377,2378,5,145,0,0,2378,2379,5,50,0,0,2379,2438,1,0,0,0,2380,
	2381,5,124,0,0,2381,2382,5,66,0,0,2382,2383,3,258,129,0,2383,2384,5,67,
	0,0,2384,2385,7,14,0,0,2385,2438,1,0,0,0,2386,2387,5,125,0,0,2387,2388,
	5,66,0,0,2388,2389,3,258,129,0,2389,2390,5,67,0,0,2390,2391,7,15,0,0,2391,
	2438,1,0,0,0,2392,2393,7,16,0,0,2393,2438,3,258,129,21,2394,2406,5,66,0,
	0,2395,2400,3,258,129,0,2396,2397,5,5,0,0,2397,2399,3,258,129,0,2398,2396,
	1,0,0,0,2399,2402,1,0,0,0,2400,2398,1,0,0,0,2400,2401,1,0,0,0,2401,2404,
	1,0,0,0,2402,2400,1,0,0,0,2403,2405,5,5,0,0,2404,2403,1,0,0,0,2404,2405,
	1,0,0,0,2405,2407,1,0,0,0,2406,2395,1,0,0,0,2406,2407,1,0,0,0,2407,2408,
	1,0,0,0,2408,2438,5,67,0,0,2409,2410,5,74,0,0,2410,2411,5,12,0,0,2411,2412,
	5,180,0,0,2412,2413,5,12,0,0,2413,2414,5,180,0,0,2414,2415,5,66,0,0,2415,
	2416,3,258,129,0,2416,2417,5,67,0,0,2417,2418,3,260,130,0,2418,2438,1,0,
	0,0,2419,2420,5,74,0,0,2420,2421,5,12,0,0,2421,2426,5,180,0,0,2422,2423,
	5,66,0,0,2423,2424,3,258,129,0,2424,2425,5,67,0,0,2425,2427,1,0,0,0,2426,
	2422,1,0,0,0,2427,2428,1,0,0,0,2428,2426,1,0,0,0,2428,2429,1,0,0,0,2429,
	2438,1,0,0,0,2430,2431,5,74,0,0,2431,2432,5,12,0,0,2432,2438,5,180,0,0,
	2433,2438,5,74,0,0,2434,2438,5,160,0,0,2435,2438,3,14,7,0,2436,2438,3,264,
	132,0,2437,2282,1,0,0,0,2437,2289,1,0,0,0,2437,2293,1,0,0,0,2437,2303,1,
	0,0,0,2437,2311,1,0,0,0,2437,2312,1,0,0,0,2437,2318,1,0,0,0,2437,2330,1,
	0,0,0,2437,2336,1,0,0,0,2437,2343,1,0,0,0,2437,2345,1,0,0,0,2437,2347,1,
	0,0,0,2437,2349,1,0,0,0,2437,2351,1,0,0,0,2437,2360,1,0,0,0,2437,2362,1,
	0,0,0,2437,2364,1,0,0,0,2437,2371,1,0,0,0,2437,2380,1,0,0,0,2437,2386,1,
	0,0,0,2437,2392,1,0,0,0,2437,2394,1,0,0,0,2437,2409,1,0,0,0,2437,2419,1,
	0,0,0,2437,2430,1,0,0,0,2437,2433,1,0,0,0,2437,2434,1,0,0,0,2437,2435,1,
	0,0,0,2437,2436,1,0,0,0,2438,2546,1,0,0,0,2439,2440,10,20,0,0,2440,2441,
	5,17,0,0,2441,2545,3,258,129,20,2442,2443,10,19,0,0,2443,2444,7,17,0,0,
	2444,2545,3,258,129,20,2445,2446,10,18,0,0,2446,2447,7,18,0,0,2447,2545,
	3,258,129,19,2448,2449,10,17,0,0,2449,2450,7,19,0,0,2450,2545,3,258,129,
	18,2451,2452,10,16,0,0,2452,2453,7,20,0,0,2453,2545,3,258,129,17,2454,2455,
	10,15,0,0,2455,2456,7,21,0,0,2456,2545,3,258,129,16,2457,2458,10,14,0,0,
	2458,2459,5,24,0,0,2459,2545,3,258,129,15,2460,2461,10,13,0,0,2461,2462,
	5,26,0,0,2462,2545,3,258,129,14,2463,2464,10,12,0,0,2464,2465,5,25,0,0,
	2465,2545,3,258,129,13,2466,2467,10,11,0,0,2467,2468,5,130,0,0,2468,2545,
	3,258,129,12,2469,2470,10,10,0,0,2470,2471,5,131,0,0,2471,2545,3,258,129,
	11,2472,2473,10,9,0,0,2473,2474,5,132,0,0,2474,2475,3,258,129,0,2475,2476,
	5,110,0,0,2476,2477,3,258,129,9,2477,2545,1,0,0,0,2478,2479,10,33,0,0,2479,
	2480,5,66,0,0,2480,2481,3,258,129,0,2481,2482,5,110,0,0,2482,2483,3,258,
	129,0,2483,2484,5,67,0,0,2484,2545,1,0,0,0,2485,2486,10,32,0,0,2486,2487,
	5,66,0,0,2487,2488,5,145,0,0,2488,2545,5,67,0,0,2489,2490,10,31,0,0,2490,
	2491,5,66,0,0,2491,2492,3,258,129,0,2492,2493,5,67,0,0,2493,2545,1,0,0,
	0,2494,2495,10,28,0,0,2495,2545,7,22,0,0,2496,2497,10,27,0,0,2497,2498,
	5,167,0,0,2498,2499,5,49,0,0,2499,2500,3,258,129,0,2500,2501,5,50,0,0,2501,
	2545,1,0,0,0,2502,2503,10,26,0,0,2503,2504,5,168,0,0,2504,2505,5,49,0,0,
	2505,2506,3,258,129,0,2506,2507,5,5,0,0,2507,2508,3,258,129,0,2508,2509,
	5,50,0,0,2509,2545,1,0,0,0,2510,2511,10,25,0,0,2511,2512,5,12,0,0,2512,
	2514,5,180,0,0,2513,2515,3,250,125,0,2514,2513,1,0,0,0,2514,2515,1,0,0,
	0,2515,2516,1,0,0,0,2516,2517,5,49,0,0,2517,2529,5,4,0,0,2518,2523,3,246,
	123,0,2519,2520,5,5,0,0,2520,2522,3,246,123,0,2521,2519,1,0,0,0,2522,2525,
	1,0,0,0,2523,2521,1,0,0,0,2523,2524,1,0,0,0,2524,2527,1,0,0,0,2525,2523,
	1,0,0,0,2526,2528,5,5,0,0,2527,2526,1,0,0,0,2527,2528,1,0,0,0,2528,2530,
	1,0,0,0,2529,2518,1,0,0,0,2529,2530,1,0,0,0,2530,2531,1,0,0,0,2531,2532,
	5,6,0,0,2532,2545,5,50,0,0,2533,2534,10,24,0,0,2534,2535,5,12,0,0,2535,
	2537,5,180,0,0,2536,2538,3,250,125,0,2537,2536,1,0,0,0,2537,2538,1,0,0,
	0,2538,2539,1,0,0,0,2539,2545,3,248,124,0,2540,2541,10,23,0,0,2541,2545,
	3,260,130,0,2542,2543,10,22,0,0,2543,2545,7,11,0,0,2544,2439,1,0,0,0,2544,
	2442,1,0,0,0,2544,2445,1,0,0,0,2544,2448,1,0,0,0,2544,2451,1,0,0,0,2544,
	2454,1,0,0,0,2544,2457,1,0,0,0,2544,2460,1,0,0,0,2544,2463,1,0,0,0,2544,
	2466,1,0,0,0,2544,2469,1,0,0,0,2544,2472,1,0,0,0,2544,2478,1,0,0,0,2544,
	2485,1,0,0,0,2544,2489,1,0,0,0,2544,2494,1,0,0,0,2544,2496,1,0,0,0,2544,
	2502,1,0,0,0,2544,2510,1,0,0,0,2544,2533,1,0,0,0,2544,2540,1,0,0,0,2544,
	2542,1,0,0,0,2545,2548,1,0,0,0,2546,2544,1,0,0,0,2546,2547,1,0,0,0,2547,
	259,1,0,0,0,2548,2546,1,0,0,0,2549,2550,5,12,0,0,2550,2563,5,180,0,0,2551,
	2563,5,163,0,0,2552,2563,5,172,0,0,2553,2563,5,173,0,0,2554,2563,5,174,
	0,0,2555,2563,5,175,0,0,2556,2563,5,176,0,0,2557,2563,5,177,0,0,2558,2563,
	5,178,0,0,2559,2563,5,179,0,0,2560,2563,5,170,0,0,2561,2563,5,171,0,0,2562,
	2549,1,0,0,0,2562,2551,1,0,0,0,2562,2552,1,0,0,0,2562,2553,1,0,0,0,2562,
	2554,1,0,0,0,2562,2555,1,0,0,0,2562,2556,1,0,0,0,2562,2557,1,0,0,0,2562,
	2558,1,0,0,0,2562,2559,1,0,0,0,2562,2560,1,0,0,0,2562,2561,1,0,0,0,2563,
	261,1,0,0,0,2564,2565,7,23,0,0,2565,263,1,0,0,0,2566,2581,5,141,0,0,2567,
	2581,3,266,133,0,2568,2581,3,268,134,0,2569,2573,5,151,0,0,2570,2572,5,
	151,0,0,2571,2570,1,0,0,0,2572,2575,1,0,0,0,2573,2571,1,0,0,0,2573,2574,
	1,0,0,0,2574,2581,1,0,0,0,2575,2573,1,0,0,0,2576,2581,5,161,0,0,2577,2581,
	5,162,0,0,2578,2581,5,152,0,0,2579,2581,5,153,0,0,2580,2566,1,0,0,0,2580,
	2567,1,0,0,0,2580,2568,1,0,0,0,2580,2569,1,0,0,0,2580,2576,1,0,0,0,2580,
	2577,1,0,0,0,2580,2578,1,0,0,0,2580,2579,1,0,0,0,2581,265,1,0,0,0,2582,
	2584,5,145,0,0,2583,2585,7,24,0,0,2584,2583,1,0,0,0,2584,2585,1,0,0,0,2585,
	267,1,0,0,0,2586,2587,5,144,0,0,2587,269,1,0,0,0,2588,2589,5,108,0,0,2589,
	2639,5,59,0,0,2590,2639,5,108,0,0,2591,2639,5,146,0,0,2592,2639,5,147,0,
	0,2593,2639,5,149,0,0,2594,2639,5,148,0,0,2595,2639,5,156,0,0,2596,2639,
	5,157,0,0,2597,2639,5,138,0,0,2598,2639,5,139,0,0,2599,2639,5,158,0,0,2600,
	2639,5,159,0,0,2601,2602,5,7,0,0,2602,2611,5,49,0,0,2603,2608,3,270,135,
	0,2604,2605,5,5,0,0,2605,2607,3,270,135,0,2606,2604,1,0,0,0,2607,2610,1,
	0,0,0,2608,2606,1,0,0,0,2608,2609,1,0,0,0,2609,2612,1,0,0,0,2610,2608,1,
	0,0,0,2611,2603,1,0,0,0,2611,2612,1,0,0,0,2612,2613,1,0,0,0,2613,2617,5,
	50,0,0,2614,2616,7,25,0,0,2615,2614,1,0,0,0,2616,2619,1,0,0,0,2617,2615,
	1,0,0,0,2617,2618,1,0,0,0,2618,2632,1,0,0,0,2619,2617,1,0,0,0,2620,2621,
	5,73,0,0,2621,2622,5,49,0,0,2622,2627,3,270,135,0,2623,2624,5,5,0,0,2624,
	2626,3,270,135,0,2625,2623,1,0,0,0,2626,2629,1,0,0,0,2627,2625,1,0,0,0,
	2627,2628,1,0,0,0,2628,2630,1,0,0,0,2629,2627,1,0,0,0,2630,2631,5,50,0,
	0,2631,2633,1,0,0,0,2632,2620,1,0,0,0,2632,2633,1,0,0,0,2633,2639,1,0,0,
	0,2634,2635,5,180,0,0,2635,2636,5,12,0,0,2636,2639,5,180,0,0,2637,2639,
	5,180,0,0,2638,2588,1,0,0,0,2638,2590,1,0,0,0,2638,2591,1,0,0,0,2638,2592,
	1,0,0,0,2638,2593,1,0,0,0,2638,2594,1,0,0,0,2638,2595,1,0,0,0,2638,2596,
	1,0,0,0,2638,2597,1,0,0,0,2638,2598,1,0,0,0,2638,2599,1,0,0,0,2638,2600,
	1,0,0,0,2638,2601,1,0,0,0,2638,2634,1,0,0,0,2638,2637,1,0,0,0,2639,271,
	1,0,0,0,2640,2641,7,26,0,0,2641,273,1,0,0,0,285,277,283,296,298,318,322,
	329,334,342,346,352,363,366,376,380,387,390,394,399,403,419,423,430,433,
	436,450,453,464,466,481,496,500,516,518,524,529,537,540,557,559,566,573,
	575,579,591,595,597,601,607,610,613,623,627,629,636,644,651,664,668,675,
	695,701,708,719,725,732,740,748,755,762,769,776,782,787,789,795,802,804,
	810,812,818,823,829,836,842,848,852,857,865,870,878,888,893,897,909,918,
	920,926,932,939,949,951,955,961,968,984,993,997,1003,1012,1016,1024,1028,
	1034,1038,1040,1048,1052,1054,1062,1066,1072,1076,1082,1086,1088,1094,1099,
	1133,1159,1173,1185,1189,1194,1199,1208,1212,1214,1236,1241,1247,1262,1271,
	1275,1277,1286,1291,1302,1304,1309,1323,1328,1339,1349,1357,1372,1374,1379,
	1391,1396,1406,1411,1416,1427,1440,1446,1454,1460,1464,1474,1486,1496,1507,
	1514,1520,1527,1540,1546,1556,1567,1572,1577,1600,1607,1622,1635,1640,1653,
	1657,1675,1691,1711,1723,1733,1741,1745,1754,1764,1776,1784,1829,1838,1844,
	1854,1866,1893,1911,1919,1924,1931,1946,1949,1952,1975,1978,1987,1990,1997,
	2006,2009,2020,2030,2043,2047,2057,2065,2071,2077,2086,2090,2092,2098,2106,
	2110,2112,2115,2128,2134,2143,2147,2149,2158,2172,2182,2190,2194,2196,2214,
	2218,2220,2224,2236,2240,2242,2252,2256,2270,2274,2280,2299,2307,2315,2324,
	2400,2404,2406,2428,2437,2514,2523,2527,2529,2537,2544,2546,2562,2573,2580,
	2584,2608,2611,2617,2627,2632,2638];

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
