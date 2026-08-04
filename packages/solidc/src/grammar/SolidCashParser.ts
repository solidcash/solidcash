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
	public static readonly RULE_callArgument = 116;
	public static readonly RULE_callOptions = 117;
	public static readonly RULE_callOption = 118;
	public static readonly RULE_typeList = 119;
	public static readonly RULE_typeListItem = 120;
	public static readonly RULE_expression = 121;
	public static readonly RULE_memberName = 122;
	public static readonly RULE_modifier = 123;
	public static readonly RULE_dataLocation = 124;
	public static readonly RULE_literal = 125;
	public static readonly RULE_numberLiteral = 126;
	public static readonly RULE_decimalLiteral = 127;
	public static readonly RULE_typeName = 128;
	public static readonly RULE_typeCast = 129;
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
		"expressionList", "callArgument", "callOptions", "callOption", "typeList", 
		"typeListItem", "expression", "memberName", "modifier", "dataLocation", 
		"literal", "numberLiteral", "decimalLiteral", "typeName", "typeCast",
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
			this.state = 263;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===41) {
				{
				{
				this.state = 260;
				this.pragmaDirective();
				}
				}
				this.state = 265;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 269;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===1) {
				{
				{
				this.state = 266;
				this.importDirective();
				}
				}
				this.state = 271;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 285;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 59213825) !== 0) || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 283;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 2, this._ctx) ) {
				case 1:
					{
					this.state = 272;
					this.constantDefinition();
					}
					break;
				case 2:
					{
					this.state = 273;
					this.enumDefinition();
					}
					break;
				case 3:
					{
					this.state = 274;
					this.structDefinition();
					}
					break;
				case 4:
					{
					this.state = 275;
					this.typeDefinition();
					}
					break;
				case 5:
					{
					this.state = 276;
					this.usingForDirective();
					}
					break;
				case 6:
					{
					this.state = 277;
					this.errorDefinition();
					}
					break;
				case 7:
					{
					this.state = 278;
					this.eventDefinition();
					}
					break;
				case 8:
					{
					this.state = 279;
					this.interfaceDefinition();
					}
					break;
				case 9:
					{
					this.state = 280;
					this.freeFunctionDefinition();
					}
					break;
				case 10:
					{
					this.state = 281;
					this.libraryDefinition();
					}
					break;
				case 11:
					{
					this.state = 282;
					this.contractDefinition();
					}
					break;
				}
				}
				this.state = 287;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 288;
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
			this.state = 316;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 6, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 290;
				this.match(SolidCashParser.T__0);
				this.state = 291;
				this.match(SolidCashParser.StringLiteral);
				this.state = 292;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 293;
				this.match(SolidCashParser.T__0);
				this.state = 294;
				this.match(SolidCashParser.StringLiteral);
				this.state = 295;
				this.match(SolidCashParser.T__2);
				this.state = 296;
				this.match(SolidCashParser.Identifier);
				this.state = 297;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 298;
				this.match(SolidCashParser.T__0);
				this.state = 299;
				this.match(SolidCashParser.T__3);
				this.state = 300;
				this.importBinding();
				this.state = 305;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 301;
						this.match(SolidCashParser.T__4);
						this.state = 302;
						this.importBinding();
						}
						}
					}
					this.state = 307;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 4, this._ctx);
				}
				this.state = 309;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 308;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 311;
				this.match(SolidCashParser.T__5);
				this.state = 312;
				this.match(SolidCashParser.Identifier);
				this.state = 313;
				this.match(SolidCashParser.StringLiteral);
				this.state = 314;
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
			this.state = 318;
			this.match(SolidCashParser.Identifier);
			this.state = 321;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 319;
				this.match(SolidCashParser.T__2);
				this.state = 320;
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
			this.state = 323;
			this.match(SolidCashParser.T__6);
			this.state = 324;
			this.anyIdentifier();
			this.state = 325;
			this.parameterList();
			this.state = 329;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3758096384) !== 0) || ((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 235372547) !== 0)) {
				{
				{
				this.state = 326;
				this.functionModifier();
				}
				}
				this.state = 331;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 333;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===75) {
				{
				this.state = 332;
				this.returnType();
				}
			}

			this.state = 335;
			this.match(SolidCashParser.T__3);
			this.state = 339;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 336;
				this.statement();
				}
				}
				this.state = 341;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 342;
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
			this.state = 383;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 17, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 344;
				this.match(SolidCashParser.T__7);
				this.state = 345;
				this.match(SolidCashParser.Identifier);
				this.state = 346;
				this.match(SolidCashParser.T__8);
				this.state = 351;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 11, this._ctx) ) {
				case 1:
					{
					this.state = 347;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 348;
					this.mappingType();
					}
					break;
				case 3:
					{
					this.state = 349;
					this.typeName();
					}
					break;
				case 4:
					{
					this.state = 350;
					this.match(SolidCashParser.T__9);
					}
					break;
				}
				this.state = 354;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 353;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 356;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 357;
				this.match(SolidCashParser.T__7);
				this.state = 358;
				this.match(SolidCashParser.T__3);
				this.state = 359;
				this.usingFunctionBinding();
				this.state = 364;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 360;
						this.match(SolidCashParser.T__4);
						this.state = 361;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 366;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 13, this._ctx);
				}
				this.state = 368;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 367;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 370;
				this.match(SolidCashParser.T__5);
				this.state = 371;
				this.match(SolidCashParser.T__8);
				this.state = 376;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 15, this._ctx) ) {
				case 1:
					{
					this.state = 372;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 373;
					this.mappingType();
					}
					break;
				case 3:
					{
					this.state = 374;
					this.typeName();
					}
					break;
				case 4:
					{
					this.state = 375;
					this.match(SolidCashParser.T__9);
					}
					break;
				}
				this.state = 379;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===11) {
					{
					this.state = 378;
					this.match(SolidCashParser.T__10);
					}
				}

				this.state = 381;
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
			this.state = 385;
			this.match(SolidCashParser.Identifier);
			this.state = 388;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===12) {
				{
				this.state = 386;
				this.match(SolidCashParser.T__11);
				this.state = 387;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 392;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 390;
				this.match(SolidCashParser.T__2);
				this.state = 391;
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
			this.state = 394;
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
			this.state = 396;
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
			this.state = 412;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 21, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 398;
				this.match(SolidCashParser.T__40);
				this.state = 399;
				this.pragmaName();
				this.state = 400;
				this.pragmaValue();
				this.state = 401;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 403;
				this.match(SolidCashParser.T__40);
				this.state = 404;
				this.match(SolidCashParser.Identifier);
				this.state = 408;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===42 || ((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 2081) !== 0) || _la===180) {
					{
					{
					this.state = 405;
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
					this.state = 410;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 411;
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
			this.state = 414;
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
			this.state = 422;
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
				this.state = 417;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 416;
					this.versionConstraint();
					}
					}
					this.state = 419;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 16777423) !== 0) || _la===140 || _la===144);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 421;
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
			this.state = 425;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 16777423) !== 0)) {
				{
				this.state = 424;
				this.versionOperator();
				}
			}

			this.state = 427;
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
			this.state = 429;
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
			this.state = 431;
			this.match(SolidCashParser.T__44);
			this.state = 432;
			this.match(SolidCashParser.Identifier);
			this.state = 442;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===46) {
				{
				this.state = 433;
				this.match(SolidCashParser.T__45);
				this.state = 434;
				this.match(SolidCashParser.Identifier);
				this.state = 439;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 435;
					this.match(SolidCashParser.T__4);
					this.state = 436;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 441;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 444;
			this.match(SolidCashParser.T__3);
			this.state = 456;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===7 || _la===8 || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 59006977) !== 0)) {
				{
				this.state = 454;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 27, this._ctx) ) {
				case 1:
					{
					this.state = 445;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 446;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 447;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 448;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 449;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 450;
					this.usingForDirective();
					}
					break;
				case 7:
					{
					this.state = 451;
					this.interfaceStateVariable();
					}
					break;
				case 8:
					{
					this.state = 452;
					this.interfaceCollection();
					}
					break;
				case 9:
					{
					this.state = 453;
					this.interfaceFunction();
					}
					break;
				}
				}
				this.state = 458;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 459;
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
			this.state = 471;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 29, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 461;
				this.interfaceStateVariableVisibility();
				this.state = 462;
				this.mappingType();
				this.state = 463;
				this.match(SolidCashParser.Identifier);
				this.state = 464;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 466;
				this.interfaceStateVariableVisibility();
				this.state = 467;
				this.arrayType(0);
				this.state = 468;
				this.match(SolidCashParser.Identifier);
				this.state = 469;
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
			this.state = 473;
			this.interfaceStateVariableVisibility();
			this.state = 474;
			this.typeName();
			this.state = 475;
			this.match(SolidCashParser.Identifier);
			this.state = 476;
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
			this.state = 478;
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
			this.state = 480;
			this.match(SolidCashParser.T__6);
			this.state = 481;
			this.anyIdentifier();
			this.state = 482;
			this.parameterList();
			this.state = 486;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3758096384) !== 0) || ((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 235372547) !== 0)) {
				{
				{
				this.state = 483;
				this.functionModifier();
				}
				}
				this.state = 488;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 490;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===75) {
				{
				this.state = 489;
				this.returnType();
				}
			}

			this.state = 492;
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
			this.state = 494;
			this.match(SolidCashParser.T__48);
			this.state = 495;
			this.match(SolidCashParser.Identifier);
			this.state = 496;
			this.match(SolidCashParser.T__3);
			this.state = 508;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 134217731) !== 0) || ((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & 105779585) !== 0) || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 506;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 32, this._ctx) ) {
				case 1:
					{
					this.state = 497;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 498;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 499;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 500;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 501;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 502;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 503;
					this.stateVariableDeclaration();
					}
					break;
				case 8:
					{
					this.state = 504;
					this.usingForDirective();
					}
					break;
				case 9:
					{
					this.state = 505;
					this.freeFunctionDefinition();
					}
					break;
				}
				}
				this.state = 510;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 511;
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
			this.state = 514;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===50) {
				{
				this.state = 513;
				this.match(SolidCashParser.T__49);
				}
			}

			this.state = 516;
			this.match(SolidCashParser.T__50);
			this.state = 517;
			this.anyIdentifier();
			this.state = 519;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===53) {
				{
				this.state = 518;
				this.parameterList();
				}
			}

			this.state = 530;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===46) {
				{
				this.state = 521;
				this.match(SolidCashParser.T__45);
				this.state = 522;
				this.inheritanceSpecifier();
				this.state = 527;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 523;
					this.match(SolidCashParser.T__4);
					this.state = 524;
					this.inheritanceSpecifier();
					}
					}
					this.state = 529;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 532;
			this.match(SolidCashParser.T__3);
			this.state = 549;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & 2281701379) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 2363237123) !== 0) || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 547;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 38, this._ctx) ) {
				case 1:
					{
					this.state = 533;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 534;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 535;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 536;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 537;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 538;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 539;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 540;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 541;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 542;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 543;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 544;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 545;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 546;
					this.receiveDefinition();
					}
					break;
				}
				}
				this.state = 551;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 552;
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
			this.state = 554;
			this.match(SolidCashParser.Identifier);
			this.state = 556;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===53) {
				{
				this.state = 555;
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
			this.state = 558;
			this.match(SolidCashParser.T__6);
			this.state = 559;
			this.anyIdentifier();
			this.state = 560;
			this.parameterList();
			this.state = 565;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3758096384) !== 0) || ((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 235372547) !== 0) || _la===180) {
				{
				this.state = 563;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
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
					this.state = 561;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 562;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 567;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 569;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===75) {
				{
				this.state = 568;
				this.returnType();
				}
			}

			this.state = 571;
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
			this.state = 573;
			this.match(SolidCashParser.T__51);
			this.state = 574;
			this.anyIdentifier();
			this.state = 575;
			this.match(SolidCashParser.T__52);
			this.state = 587;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 576;
				this.eventParameter();
				this.state = 581;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 44, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 577;
						this.match(SolidCashParser.T__4);
						this.state = 578;
						this.eventParameter();
						}
						}
					}
					this.state = 583;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 44, this._ctx);
				}
				this.state = 585;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 584;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 589;
			this.match(SolidCashParser.T__53);
			this.state = 591;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===55) {
				{
				this.state = 590;
				this.match(SolidCashParser.T__54);
				}
			}

			this.state = 593;
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
			this.state = 597;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 48, this._ctx) ) {
			case 1:
				{
				this.state = 595;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 596;
				this.arrayType(0);
				}
				break;
			}
			this.state = 600;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===56) {
				{
				this.state = 599;
				this.match(SolidCashParser.T__55);
				}
			}

			this.state = 603;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073610753) !== 0) || _la===143 || _la===147 || _la===180) {
				{
				this.state = 602;
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
			this.state = 605;
			this.match(SolidCashParser.T__33);
			this.state = 606;
			this.anyIdentifier();
			this.state = 607;
			this.match(SolidCashParser.T__52);
			this.state = 619;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 608;
				this.errorParameter();
				this.state = 613;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 609;
						this.match(SolidCashParser.T__4);
						this.state = 610;
						this.errorParameter();
						}
						}
					}
					this.state = 615;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 51, this._ctx);
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
			this.match(SolidCashParser.T__53);
			this.state = 622;
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
			this.state = 632;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 56, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 624;
				this.typeName();
				this.state = 626;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 625;
					this.match(SolidCashParser.Identifier);
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 628;
				this.arrayType(0);
				this.state = 630;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 629;
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
			this.state = 634;
			this.match(SolidCashParser.T__56);
			this.state = 635;
			this.anyIdentifier();
			this.state = 636;
			this.match(SolidCashParser.T__3);
			this.state = 638;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 637;
				this.structField();
				}
				}
				this.state = 640;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===7 || _la===66 || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180);
			this.state = 642;
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
			this.state = 647;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 58, this._ctx) ) {
			case 1:
				{
				this.state = 644;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 645;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 646;
				this.mappingType();
				}
				break;
			}
			this.state = 649;
			this.anyIdentifier();
			this.state = 650;
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
			this.state = 652;
			this.match(SolidCashParser.T__57);
			this.state = 653;
			this.anyIdentifier();
			this.state = 654;
			this.match(SolidCashParser.T__3);
			this.state = 655;
			this.enumMember();
			this.state = 660;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 59, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 656;
					this.match(SolidCashParser.T__4);
					this.state = 657;
					this.enumMember();
					}
					}
				}
				this.state = 662;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 59, this._ctx);
			}
			this.state = 664;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 663;
				this.match(SolidCashParser.T__4);
				}
			}

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
	public enumMember(): EnumMemberContext {
		let localctx: EnumMemberContext = new EnumMemberContext(this, this._ctx, this.state);
		this.enterRule(localctx, 58, SolidCashParser.RULE_enumMember);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 668;
			this.anyIdentifier();
			this.state = 671;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===44) {
				{
				this.state = 669;
				this.match(SolidCashParser.T__43);
				this.state = 670;
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
			this.state = 673;
			this.match(SolidCashParser.T__58);
			this.state = 674;
			this.anyIdentifier();
			this.state = 675;
			this.match(SolidCashParser.T__45);
			this.state = 676;
			this.typeName();
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
	public constantDefinition(): ConstantDefinitionContext {
		let localctx: ConstantDefinitionContext = new ConstantDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 62, SolidCashParser.RULE_constantDefinition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 679;
			this.typeName();
			this.state = 680;
			this.match(SolidCashParser.T__59);
			this.state = 681;
			this.anyIdentifier();
			this.state = 682;
			this.match(SolidCashParser.T__43);
			this.state = 683;
			this.expression(0);
			this.state = 684;
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
			this.state = 686;
			this.match(SolidCashParser.T__60);
			this.state = 687;
			this.parameterList();
			this.state = 691;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 62, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 688;
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
				this.state = 693;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 62, this._ctx);
			}
			this.state = 697;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 63, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 694;
					this.parentInvocation();
					}
					}
				}
				this.state = 699;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 63, this._ctx);
			}
			this.state = 703;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 98307) !== 0)) {
				{
				{
				this.state = 700;
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
				this.state = 705;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 709;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 706;
				this.customModifierInvocation();
				}
				}
				this.state = 711;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 712;
			this.match(SolidCashParser.T__3);
			this.state = 716;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 713;
				this.statement();
				}
				}
				this.state = 718;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 719;
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
			this.state = 721;
			this.match(SolidCashParser.T__37);
			this.state = 722;
			this.parameterList();
			this.state = 726;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 63)) & ~0x1F) === 0 && ((1 << (_la - 63)) & 2051) !== 0)) {
				{
				{
				this.state = 723;
				this.fallbackModifier();
				}
				}
				this.state = 728;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 729;
			this.match(SolidCashParser.T__47);
			this.state = 733;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 63)) & ~0x1F) === 0 && ((1 << (_la - 63)) & 2051) !== 0)) {
				{
				{
				this.state = 730;
				this.fallbackModifier();
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
				this.customModifierInvocation();
				}
				}
				this.state = 741;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 743;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===75) {
				{
				this.state = 742;
				this.returnType();
				}
			}

			this.state = 745;
			this.match(SolidCashParser.T__3);
			this.state = 749;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 746;
				this.statement();
				}
				}
				this.state = 751;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 752;
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
			this.state = 757;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 63:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 754;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 64:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 755;
				this.match(SolidCashParser.T__63);
				}
				break;
			case 74:
				this.enterOuterAlt(localctx, 3);
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
	public receiveDefinition(): ReceiveDefinitionContext {
		let localctx: ReceiveDefinitionContext = new ReceiveDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 70, SolidCashParser.RULE_receiveDefinition);
		let _la: number;
		try {
			this.state = 827;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 83, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 759;
				this.match(SolidCashParser.T__38);
				this.state = 760;
				this.match(SolidCashParser.T__52);
				this.state = 761;
				this.match(SolidCashParser.T__53);
				this.state = 765;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===64 || _la===74) {
					{
					{
					this.state = 762;
					this.receiveModifier();
					}
					}
					this.state = 767;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 768;
				this.match(SolidCashParser.T__47);
				this.state = 772;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===64 || _la===74) {
					{
					{
					this.state = 769;
					this.receiveModifier();
					}
					}
					this.state = 774;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 775;
				this.match(SolidCashParser.T__62);
				this.state = 779;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===64 || _la===74) {
					{
					{
					this.state = 776;
					this.receiveModifier();
					}
					}
					this.state = 781;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 791;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 4:
					{
					this.state = 782;
					this.match(SolidCashParser.T__3);
					this.state = 786;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
						{
						{
						this.state = 783;
						this.statement();
						}
						}
						this.state = 788;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 789;
					this.match(SolidCashParser.T__5);
					}
					break;
				case 2:
					{
					this.state = 790;
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
				this.state = 793;
				this.match(SolidCashParser.T__38);
				this.state = 794;
				this.match(SolidCashParser.T__52);
				this.state = 795;
				this.match(SolidCashParser.T__53);
				this.state = 799;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===64 || _la===74) {
					{
					{
					this.state = 796;
					this.receiveModifier();
					}
					}
					this.state = 801;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 802;
				this.match(SolidCashParser.T__62);
				this.state = 806;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===64 || _la===74) {
					{
					{
					this.state = 803;
					this.receiveModifier();
					}
					}
					this.state = 808;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 809;
				this.match(SolidCashParser.T__47);
				this.state = 813;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===64 || _la===74) {
					{
					{
					this.state = 810;
					this.receiveModifier();
					}
					}
					this.state = 815;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 825;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 4:
					{
					this.state = 816;
					this.match(SolidCashParser.T__3);
					this.state = 820;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
						{
						{
						this.state = 817;
						this.statement();
						}
						}
						this.state = 822;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 823;
					this.match(SolidCashParser.T__5);
					}
					break;
				case 2:
					{
					this.state = 824;
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
			this.state = 831;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 64:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 829;
				this.match(SolidCashParser.T__63);
				}
				break;
			case 74:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 830;
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
			this.state = 833;
			this.match(SolidCashParser.Identifier);
			this.state = 834;
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
			this.state = 910;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 100, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 837;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 294915) !== 0)) {
					{
					this.state = 836;
					this.stateVariableVisibility();
					}
				}

				this.state = 839;
				this.typeName();
				this.state = 844;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 87, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						this.state = 842;
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
							this.state = 840;
							this.modifier();
							}
							break;
						case 74:
							{
							this.state = 841;
							this.overrideSpecifier();
							}
							break;
						default:
							throw new NoViableAltException(this);
						}
						}
					}
					this.state = 846;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 87, this._ctx);
				}
				this.state = 847;
				this.anyIdentifier();
				this.state = 850;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===44) {
					{
					this.state = 848;
					this.match(SolidCashParser.T__43);
					this.state = 849;
					this.expression(0);
					}
				}

				this.state = 852;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 854;
				this.typeName();
				this.state = 859;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 268435473) !== 0) || _la===74 || ((((_la - 134)) & ~0x1F) === 0 && ((1 << (_la - 134)) & 15) !== 0)) {
					{
					this.state = 857;
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
						this.state = 855;
						this.modifier();
						}
						break;
					case 74:
						{
						this.state = 856;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 861;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 862;
				this.stateVariableVisibility();
				this.state = 867;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 92, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						this.state = 865;
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
							this.state = 863;
							this.modifier();
							}
							break;
						case 74:
							{
							this.state = 864;
							this.overrideSpecifier();
							}
							break;
						default:
							throw new NoViableAltException(this);
						}
						}
					}
					this.state = 869;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 92, this._ctx);
				}
				this.state = 870;
				this.anyIdentifier();
				this.state = 873;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===44) {
					{
					this.state = 871;
					this.match(SolidCashParser.T__43);
					this.state = 872;
					this.expression(0);
					}
				}

				this.state = 875;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 878;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 294915) !== 0)) {
					{
					this.state = 877;
					this.stateVariableVisibility();
					}
				}

				this.state = 881;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 880;
					this.match(SolidCashParser.T__39);
					}
				}

				this.state = 883;
				this.mappingType();
				this.state = 887;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 96, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 884;
						this.collectionModifier();
						}
						}
					}
					this.state = 889;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 96, this._ctx);
				}
				this.state = 890;
				this.anyIdentifier();
				this.state = 891;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 894;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 294915) !== 0)) {
					{
					this.state = 893;
					this.stateVariableVisibility();
					}
				}

				this.state = 896;
				this.arrayType(0);
				this.state = 900;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 98, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 897;
						this.collectionModifier();
						}
						}
					}
					this.state = 902;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 98, this._ctx);
				}
				this.state = 903;
				this.anyIdentifier();
				this.state = 906;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===44) {
					{
					this.state = 904;
					this.match(SolidCashParser.T__43);
					this.state = 905;
					this.expression(0);
					}
				}

				this.state = 908;
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
			this.state = 915;
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
				this.state = 912;
				this.modifier();
				}
				break;
			case 47:
			case 48:
			case 62:
			case 65:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 913;
				this.stateVariableVisibility();
				}
				break;
			case 74:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 914;
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
			this.state = 917;
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
			this.state = 955;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 107, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 919;
				this.match(SolidCashParser.T__65);
				this.state = 920;
				this.match(SolidCashParser.T__52);
				this.state = 921;
				this.typeName();
				this.state = 923;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 922;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 925;
				this.match(SolidCashParser.T__66);
				this.state = 926;
				this.typeName();
				this.state = 928;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 927;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 930;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 932;
				this.match(SolidCashParser.T__65);
				this.state = 933;
				this.match(SolidCashParser.T__52);
				this.state = 934;
				this.typeName();
				this.state = 936;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 935;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 938;
				this.match(SolidCashParser.T__66);
				this.state = 939;
				this.mappingType();
				this.state = 940;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 942;
				this.match(SolidCashParser.T__65);
				this.state = 943;
				this.match(SolidCashParser.T__52);
				this.state = 944;
				this.typeName();
				this.state = 946;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 945;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 948;
				this.match(SolidCashParser.T__66);
				this.state = 949;
				this.arrayType(0);
				this.state = 951;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 950;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 953;
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
			this.state = 958;
			this.typeName();
			this.state = 959;
			this.match(SolidCashParser.T__67);
			this.state = 961;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073676297) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 33857) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 3766485027) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 4272948735) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				this.state = 960;
				this.expression(0);
				}
			}

			this.state = 963;
			this.match(SolidCashParser.T__68);
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 973;
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
					this.state = 965;
					if (!(this.precpred(this._ctx, 1))) {
						throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
					}
					this.state = 966;
					this.match(SolidCashParser.T__67);
					this.state = 968;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073676297) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 33857) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 3766485027) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 4272948735) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
						{
						this.state = 967;
						this.expression(0);
						}
					}

					this.state = 970;
					this.match(SolidCashParser.T__68);
					}
					}
				}
				this.state = 975;
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
			this.state = 976;
			this.match(SolidCashParser.T__69);
			this.state = 977;
			this.match(SolidCashParser.Identifier);
			this.state = 979;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===53) {
				{
				this.state = 978;
				this.parameterList();
				}
			}

			this.state = 985;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===64 || _la===74) {
				{
				this.state = 983;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 64:
					{
					this.state = 981;
					this.match(SolidCashParser.T__63);
					}
					break;
				case 74:
					{
					this.state = 982;
					this.overrideSpecifier();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 987;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 997;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				{
				this.state = 988;
				this.match(SolidCashParser.T__3);
				this.state = 992;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
					{
					{
					this.state = 989;
					this.modifierStatement();
					}
					}
					this.state = 994;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 995;
				this.match(SolidCashParser.T__5);
				}
				break;
			case 2:
				{
				this.state = 996;
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
			this.state = 1001;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 116, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 999;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1000;
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
			this.state = 1003;
			this.match(SolidCashParser.T__70);
			this.state = 1004;
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
			this.state = 1006;
			this.match(SolidCashParser.T__6);
			this.state = 1007;
			this.anyIdentifier();
			this.state = 1008;
			this.parameterList();
			this.state = 1013;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3758096384) !== 0) || ((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 235372547) !== 0) || _la===180) {
				{
				this.state = 1011;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
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
					this.state = 1009;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 1010;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 1015;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1017;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===75) {
				{
				this.state = 1016;
				this.returnType();
				}
			}

			this.state = 1019;
			this.match(SolidCashParser.T__3);
			this.state = 1023;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1020;
				this.statement();
				}
				}
				this.state = 1025;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1026;
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
			this.state = 1028;
			this.match(SolidCashParser.Identifier);
			this.state = 1030;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===53) {
				{
				this.state = 1029;
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
			this.state = 1044;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 72:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1032;
				this.match(SolidCashParser.T__71);
				}
				break;
			case 73:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1033;
				this.match(SolidCashParser.T__72);
				}
				break;
			case 62:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1034;
				this.match(SolidCashParser.T__61);
				}
				break;
			case 48:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1035;
				this.match(SolidCashParser.T__47);
				}
				break;
			case 47:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1036;
				this.match(SolidCashParser.T__46);
				}
				break;
			case 65:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1037;
				this.match(SolidCashParser.T__64);
				}
				break;
			case 63:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1038;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 74:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1039;
				this.overrideSpecifier();
				}
				break;
			case 64:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1040;
				this.match(SolidCashParser.T__63);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1041;
				this.unsafeModifier();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1042;
				this.match(SolidCashParser.T__28);
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1043;
				this.match(SolidCashParser.T__29);
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
			this.state = 1046;
			this.match(SolidCashParser.T__73);
			this.state = 1057;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===53) {
				{
				this.state = 1047;
				this.match(SolidCashParser.T__52);
				this.state = 1048;
				this.match(SolidCashParser.Identifier);
				this.state = 1053;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1049;
					this.match(SolidCashParser.T__4);
					this.state = 1050;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1055;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1056;
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
			this.state = 1059;
			this.match(SolidCashParser.T__30);
			this.state = 1063;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===53) {
				{
				this.state = 1060;
				this.match(SolidCashParser.T__52);
				this.state = 1061;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1062;
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
			this.state = 1065;
			this.match(SolidCashParser.T__74);
			this.state = 1066;
			this.match(SolidCashParser.T__52);
			this.state = 1067;
			this.returnParam();
			this.state = 1072;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 126, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1068;
					this.match(SolidCashParser.T__4);
					this.state = 1069;
					this.returnParam();
					}
					}
				}
				this.state = 1074;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 126, this._ctx);
			}
			this.state = 1076;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1075;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1078;
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
			this.state = 1110;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 134, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1080;
				this.typeName();
				this.state = 1084;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 128, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 128, this._ctx);
				}
				this.state = 1088;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073610753) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1087;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1090;
				this.arrayType(0);
				this.state = 1094;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 130, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 130, this._ctx);
				}
				this.state = 1098;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073610753) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1097;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1100;
				this.mappingType();
				this.state = 1104;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 132, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1101;
						this.modifier();
						}
						}
					}
					this.state = 1106;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 132, this._ctx);
				}
				this.state = 1108;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073610753) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1107;
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
			this.state = 1112;
			this.match(SolidCashParser.T__52);
			this.state = 1124;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===66 || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1113;
				this.parameter();
				this.state = 1118;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 135, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1114;
						this.match(SolidCashParser.T__4);
						this.state = 1115;
						this.parameter();
						}
						}
					}
					this.state = 1120;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 135, this._ctx);
				}
				this.state = 1122;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1121;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1126;
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
			this.state = 1158;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 144, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1128;
				this.typeName();
				this.state = 1132;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 138, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1129;
						this.modifier();
						}
						}
					}
					this.state = 1134;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 138, this._ctx);
				}
				this.state = 1136;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073610753) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1135;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1138;
				this.arrayType(0);
				this.state = 1142;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 140, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1139;
						this.modifier();
						}
						}
					}
					this.state = 1144;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 140, this._ctx);
				}
				this.state = 1146;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073610753) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1145;
					this.anyIdentifier();
					}
				}

				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1148;
				this.mappingType();
				this.state = 1152;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 142, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1149;
						this.modifier();
						}
						}
					}
					this.state = 1154;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 142, this._ctx);
				}
				this.state = 1156;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073610753) !== 0) || _la===143 || _la===147 || _la===180) {
					{
					this.state = 1155;
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
			this.state = 1169;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 146, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1160;
				this.match(SolidCashParser.T__3);
				this.state = 1164;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
					{
					{
					this.state = 1161;
					this.statement();
					}
					}
					this.state = 1166;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1167;
				this.match(SolidCashParser.T__5);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1168;
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
			this.state = 1171;
			this.match(SolidCashParser.T__3);
			this.state = 1175;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1172;
				this.statement();
				}
				}
				this.state = 1177;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1178;
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
			this.state = 1203;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 148, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1180;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1181;
				this.blockStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1182;
				this.variableDefinition();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1183;
				this.tupleAssignment();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1184;
				this.prefixIncDecStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1185;
				this.timeOpStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1186;
				this.requireStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1187;
				this.ifStatement();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1188;
				this.loopStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1189;
				this.consoleStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1190;
				this.emitStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1191;
				this.returnStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1192;
				this.selfdestructStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1193;
				this.assemblyStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1194;
				this.tryCatchStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1195;
				this.revertStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1196;
				this.assertStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1197;
				this.deleteStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1198;
				this.uncheckedStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1199;
				this.switchStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1200;
				this.breakStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1201;
				this.continueStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1202;
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
			this.state = 1205;
			this.expression(0);
			this.state = 1264;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 155, this._ctx) ) {
			case 1:
				{
				this.state = 1206;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1207;
				this.assignChain();
				}
				break;
			case 2:
				{
				this.state = 1208;
				this.match(SolidCashParser.DotPush);
				this.state = 1209;
				this.match(SolidCashParser.T__52);
				this.state = 1210;
				this.match(SolidCashParser.T__53);
				this.state = 1211;
				localctx._second = this.match(SolidCashParser.DotPush);
				this.state = 1212;
				this.match(SolidCashParser.T__52);
				this.state = 1213;
				this.match(SolidCashParser.T__53);
				this.state = 1214;
				this.match(SolidCashParser.T__43);
				this.state = 1215;
				this.expression(0);
				this.state = 1224;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===165) {
					{
					this.state = 1216;
					localctx._rhsPush = this.match(SolidCashParser.DotPush);
					this.state = 1217;
					this.match(SolidCashParser.T__52);
					this.state = 1218;
					this.match(SolidCashParser.T__53);
					this.state = 1222;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===165) {
						{
						this.state = 1219;
						localctx._rhsPush2 = this.match(SolidCashParser.DotPush);
						this.state = 1220;
						this.match(SolidCashParser.T__52);
						this.state = 1221;
						this.match(SolidCashParser.T__53);
						}
					}

					}
				}

				}
				break;
			case 3:
				{
				this.state = 1226;
				this.match(SolidCashParser.DotPush);
				this.state = 1227;
				this.match(SolidCashParser.T__52);
				this.state = 1228;
				this.match(SolidCashParser.T__53);
				this.state = 1229;
				localctx._second = this.match(SolidCashParser.DotPush);
				this.state = 1230;
				this.match(SolidCashParser.T__52);
				this.state = 1232;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073676297) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 33857) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 3766485027) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 4272948735) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
					{
					this.state = 1231;
					this.pushArgument();
					}
				}

				this.state = 1234;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 4:
				{
				this.state = 1235;
				this.match(SolidCashParser.DotPush);
				this.state = 1236;
				this.match(SolidCashParser.T__52);
				this.state = 1237;
				this.match(SolidCashParser.T__53);
				this.state = 1238;
				this.match(SolidCashParser.T__43);
				this.state = 1239;
				this.expression(0);
				this.state = 1248;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===165) {
					{
					this.state = 1240;
					localctx._rhsPush = this.match(SolidCashParser.DotPush);
					this.state = 1241;
					this.match(SolidCashParser.T__52);
					this.state = 1242;
					this.match(SolidCashParser.T__53);
					this.state = 1246;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===165) {
						{
						this.state = 1243;
						localctx._rhsPush2 = this.match(SolidCashParser.DotPush);
						this.state = 1244;
						this.match(SolidCashParser.T__52);
						this.state = 1245;
						this.match(SolidCashParser.T__53);
						}
					}

					}
				}

				}
				break;
			case 5:
				{
				this.state = 1250;
				this.match(SolidCashParser.DotPush);
				this.state = 1251;
				this.match(SolidCashParser.T__52);
				this.state = 1253;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073676297) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 33857) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 3766485027) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 4272948735) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
					{
					this.state = 1252;
					this.pushArgument();
					}
				}

				this.state = 1255;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 6:
				{
				this.state = 1256;
				this.match(SolidCashParser.DotPop);
				this.state = 1257;
				this.match(SolidCashParser.T__52);
				this.state = 1258;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 7:
				{
				this.state = 1259;
				this.match(SolidCashParser.DotDelete);
				this.state = 1260;
				this.match(SolidCashParser.T__52);
				this.state = 1261;
				this.expression(0);
				this.state = 1262;
				this.match(SolidCashParser.T__53);
				}
				break;
			}
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
	public assignChain(): AssignChainContext {
		let localctx: AssignChainContext = new AssignChainContext(this, this._ctx, this.state);
		this.enterRule(localctx, 118, SolidCashParser.RULE_assignChain);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1268;
			this.expression(0);
			this.state = 1271;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 156, this._ctx) ) {
			case 1:
				{
				this.state = 1269;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1270;
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
			this.state = 1273;
			localctx._op = this._input.LT(1);
			_la = this._input.LA(1);
			if(!(_la===86 || _la===87)) {
			    localctx._op = this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			this.state = 1274;
			this.expression(0);
			this.state = 1275;
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
			this.state = 1312;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 160, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1277;
				this.match(SolidCashParser.T__87);
				this.state = 1278;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1279;
				this.match(SolidCashParser.T__87);
				this.state = 1280;
				this.expression(0);
				this.state = 1281;
				localctx._rop = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
				    localctx._rop = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1282;
				this.assignChain();
				this.state = 1283;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1285;
				this.match(SolidCashParser.T__87);
				this.state = 1286;
				this.expression(0);
				this.state = 1291;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1287;
					this.match(SolidCashParser.T__4);
					this.state = 1288;
					this.expression(0);
					}
					}
					this.state = 1293;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1294;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1296;
				this.match(SolidCashParser.T__87);
				this.state = 1297;
				this.match(SolidCashParser.T__52);
				this.state = 1298;
				this.expression(0);
				this.state = 1303;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 158, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1299;
						this.match(SolidCashParser.T__4);
						this.state = 1300;
						this.expression(0);
						}
						}
					}
					this.state = 1305;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 158, this._ctx);
				}
				this.state = 1307;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1306;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1309;
				this.match(SolidCashParser.T__53);
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
	public selfdestructStatement(): SelfdestructStatementContext {
		let localctx: SelfdestructStatementContext = new SelfdestructStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 124, SolidCashParser.RULE_selfdestructStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1314;
			this.match(SolidCashParser.T__29);
			this.state = 1315;
			this.match(SolidCashParser.T__52);
			this.state = 1316;
			this.expression(0);
			this.state = 1317;
			this.match(SolidCashParser.T__53);
			this.state = 1318;
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
			this.state = 1353;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 166, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1320;
				this.match(SolidCashParser.T__88);
				this.state = 1321;
				this.match(SolidCashParser.Identifier);
				this.state = 1324;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1322;
					this.match(SolidCashParser.T__11);
					this.state = 1323;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1326;
				this.match(SolidCashParser.T__52);
				this.state = 1327;
				this.match(SolidCashParser.T__3);
				this.state = 1339;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1328;
					this.namedArg();
					this.state = 1333;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 162, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1329;
							this.match(SolidCashParser.T__4);
							this.state = 1330;
							this.namedArg();
							}
							}
						}
						this.state = 1335;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 162, this._ctx);
					}
					this.state = 1337;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1336;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1341;
				this.match(SolidCashParser.T__5);
				this.state = 1342;
				this.match(SolidCashParser.T__53);
				this.state = 1343;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1344;
				this.match(SolidCashParser.T__88);
				this.state = 1345;
				this.match(SolidCashParser.Identifier);
				this.state = 1348;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 1346;
					this.match(SolidCashParser.T__11);
					this.state = 1347;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1350;
				this.expressionList();
				this.state = 1351;
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
			this.state = 1409;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 175, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1355;
				this.typeName();
				this.state = 1359;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 167, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1356;
						this.modifier();
						}
						}
					}
					this.state = 1361;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 167, this._ctx);
				}
				this.state = 1362;
				this.anyIdentifier();
				this.state = 1372;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===44) {
					{
					this.state = 1363;
					this.match(SolidCashParser.T__43);
					this.state = 1364;
					this.expression(0);
					this.state = 1370;
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
						this.state = 1365;
						localctx._iop = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
						    localctx._iop = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1366;
						this.assignChain();
						}
						break;
					case 165:
						{
						this.state = 1367;
						this.match(SolidCashParser.DotPush);
						this.state = 1368;
						this.match(SolidCashParser.T__52);
						this.state = 1369;
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

				this.state = 1374;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1376;
				this.arrayType(0);
				this.state = 1380;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 170, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1377;
						this.modifier();
						}
						}
					}
					this.state = 1382;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 170, this._ctx);
				}
				this.state = 1383;
				this.anyIdentifier();
				this.state = 1391;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===44) {
					{
					this.state = 1384;
					this.match(SolidCashParser.T__43);
					this.state = 1385;
					this.expression(0);
					this.state = 1389;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===165) {
						{
						this.state = 1386;
						this.match(SolidCashParser.DotPush);
						this.state = 1387;
						this.match(SolidCashParser.T__52);
						this.state = 1388;
						this.match(SolidCashParser.T__53);
						}
					}

					}
				}

				this.state = 1393;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1395;
				this.mappingType();
				this.state = 1399;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 173, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1396;
						this.modifier();
						}
						}
					}
					this.state = 1401;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 173, this._ctx);
				}
				this.state = 1402;
				this.anyIdentifier();
				this.state = 1405;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===44) {
					{
					this.state = 1403;
					this.match(SolidCashParser.T__43);
					this.state = 1404;
					this.expression(0);
					}
				}

				this.state = 1407;
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
			this.state = 1487;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 182, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1411;
				this.typeName();
				this.state = 1412;
				this.match(SolidCashParser.Identifier);
				this.state = 1417;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1413;
					this.match(SolidCashParser.T__4);
					this.state = 1414;
					this.typeName();
					this.state = 1415;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1419;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1421;
				this.match(SolidCashParser.T__43);
				this.state = 1422;
				this.expression(0);
				this.state = 1423;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1425;
				this.match(SolidCashParser.T__52);
				this.state = 1426;
				this.tupleSlot();
				this.state = 1429;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1427;
					this.match(SolidCashParser.T__4);
					this.state = 1428;
					this.tupleSlot();
					}
					}
					this.state = 1431;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1433;
				this.match(SolidCashParser.T__53);
				this.state = 1434;
				this.match(SolidCashParser.T__43);
				this.state = 1435;
				this.match(SolidCashParser.T__52);
				this.state = 1436;
				this.expression(0);
				this.state = 1439;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1437;
					this.match(SolidCashParser.T__4);
					this.state = 1438;
					this.expression(0);
					}
					}
					this.state = 1441;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1443;
				this.match(SolidCashParser.T__53);
				this.state = 1444;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1446;
				this.match(SolidCashParser.T__52);
				this.state = 1447;
				this.tupleSlot();
				this.state = 1450;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1448;
					this.match(SolidCashParser.T__4);
					this.state = 1449;
					this.tupleSlot();
					}
					}
					this.state = 1452;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1454;
				this.match(SolidCashParser.T__53);
				this.state = 1455;
				this.match(SolidCashParser.T__43);
				this.state = 1456;
				this.expression(0);
				this.state = 1457;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1459;
				this.match(SolidCashParser.T__52);
				this.state = 1460;
				this.typeName();
				this.state = 1464;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 180, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 180, this._ctx);
				}
				this.state = 1467;
				this.anyIdentifier();
				this.state = 1468;
				this.match(SolidCashParser.T__53);
				this.state = 1469;
				this.match(SolidCashParser.T__43);
				this.state = 1470;
				this.expression(0);
				this.state = 1471;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1473;
				this.match(SolidCashParser.T__52);
				this.state = 1474;
				this.arrayType(0);
				this.state = 1478;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 181, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1475;
						this.modifier();
						}
						}
					}
					this.state = 1480;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 181, this._ctx);
				}
				this.state = 1481;
				this.anyIdentifier();
				this.state = 1482;
				this.match(SolidCashParser.T__53);
				this.state = 1483;
				this.match(SolidCashParser.T__43);
				this.state = 1484;
				this.expression(0);
				this.state = 1485;
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
			this.state = 1520;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 187, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1489;
				this.typeName();
				this.state = 1493;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 183, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1490;
						this.modifier();
						}
						}
					}
					this.state = 1495;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 183, this._ctx);
				}
				this.state = 1496;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1498;
				this.arrayType(0);
				this.state = 1502;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 184, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1499;
						this.modifier();
						}
						}
					}
					this.state = 1504;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 184, this._ctx);
				}
				this.state = 1505;
				this.anyIdentifier();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1507;
				this.anyIdentifier();
				this.state = 1516;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===12 || _la===68) {
					{
					this.state = 1514;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case 68:
						{
						this.state = 1508;
						this.match(SolidCashParser.T__67);
						this.state = 1509;
						this.expression(0);
						this.state = 1510;
						this.match(SolidCashParser.T__68);
						}
						break;
					case 12:
						{
						this.state = 1512;
						this.match(SolidCashParser.T__11);
						this.state = 1513;
						this.anyIdentifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 1518;
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
			this.state = 1522;
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
			this.state = 1585;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 193, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1524;
				this.match(SolidCashParser.T__89);
				this.state = 1525;
				this.match(SolidCashParser.Identifier);
				this.state = 1526;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1527;
				this.match(SolidCashParser.T__89);
				this.state = 1528;
				this.match(SolidCashParser.T__90);
				this.state = 1529;
				this.match(SolidCashParser.T__11);
				this.state = 1530;
				this.match(SolidCashParser.Identifier);
				this.state = 1531;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1532;
				this.match(SolidCashParser.T__89);
				this.state = 1533;
				this.match(SolidCashParser.T__90);
				this.state = 1534;
				this.match(SolidCashParser.T__11);
				this.state = 1535;
				this.match(SolidCashParser.Identifier);
				this.state = 1540;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1536;
					this.match(SolidCashParser.T__67);
					this.state = 1537;
					this.expression(0);
					this.state = 1538;
					this.match(SolidCashParser.T__68);
					}
					}
					this.state = 1542;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===68);
				this.state = 1544;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1546;
				this.match(SolidCashParser.T__89);
				this.state = 1547;
				this.match(SolidCashParser.Identifier);
				this.state = 1552;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1548;
					this.match(SolidCashParser.T__67);
					this.state = 1549;
					this.expression(0);
					this.state = 1550;
					this.match(SolidCashParser.T__68);
					}
					}
					this.state = 1554;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===68);
				this.state = 1556;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				localctx = new DeleteMemberEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1558;
				this.match(SolidCashParser.T__89);
				this.state = 1559;
				this.match(SolidCashParser.Identifier);
				this.state = 1562;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1560;
					this.match(SolidCashParser.T__11);
					this.state = 1561;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1564;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1570;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1566;
					this.match(SolidCashParser.T__67);
					this.state = 1567;
					this.expression(0);
					this.state = 1568;
					this.match(SolidCashParser.T__68);
					}
					}
					this.state = 1572;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===68);
				this.state = 1574;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 6:
				localctx = new DeleteMemberContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1576;
				this.match(SolidCashParser.T__89);
				this.state = 1577;
				this.match(SolidCashParser.Identifier);
				this.state = 1580;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1578;
					this.match(SolidCashParser.T__11);
					this.state = 1579;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1582;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===12);
				this.state = 1584;
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
			this.state = 1587;
			this.match(SolidCashParser.T__91);
			this.state = 1588;
			this.match(SolidCashParser.T__52);
			this.state = 1589;
			this.match(SolidCashParser.TxVar);
			this.state = 1590;
			this.match(SolidCashParser.T__22);
			this.state = 1591;
			this.expression(0);
			this.state = 1594;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1592;
				this.match(SolidCashParser.T__4);
				this.state = 1593;
				this.requireMessage();
				}
			}

			this.state = 1596;
			this.match(SolidCashParser.T__53);
			this.state = 1597;
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
			this.state = 1599;
			this.match(SolidCashParser.T__91);
			this.state = 1600;
			this.match(SolidCashParser.T__52);
			this.state = 1601;
			this.expression(0);
			this.state = 1604;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1602;
				this.match(SolidCashParser.T__4);
				this.state = 1603;
				this.requireMessage();
				}
			}

			this.state = 1606;
			this.match(SolidCashParser.T__53);
			this.state = 1607;
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
			this.state = 1609;
			this.match(SolidCashParser.T__92);
			this.state = 1610;
			this.match(SolidCashParser.T__52);
			this.state = 1611;
			this.expression(0);
			this.state = 1612;
			this.match(SolidCashParser.T__53);
			this.state = 1613;
			localctx._ifBlock = this.block();
			this.state = 1616;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 196, this._ctx) ) {
			case 1:
				{
				this.state = 1614;
				this.match(SolidCashParser.T__93);
				this.state = 1615;
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
			this.state = 1624;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 197, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1618;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1619;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1620;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1621;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1622;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1623;
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
			this.state = 1626;
			this.match(SolidCashParser.T__8);
			this.state = 1627;
			this.match(SolidCashParser.T__52);
			this.state = 1628;
			this.typeName();
			this.state = 1629;
			this.match(SolidCashParser.Identifier);
			this.state = 1630;
			this.match(SolidCashParser.T__4);
			this.state = 1631;
			this.typeName();
			this.state = 1632;
			this.match(SolidCashParser.Identifier);
			this.state = 1633;
			this.match(SolidCashParser.T__94);
			this.state = 1634;
			this.match(SolidCashParser.T__90);
			this.state = 1635;
			this.match(SolidCashParser.T__11);
			this.state = 1636;
			this.match(SolidCashParser.Identifier);
			this.state = 1637;
			this.match(SolidCashParser.T__11);
			this.state = 1638;
			this.match(SolidCashParser.T__32);
			this.state = 1639;
			this.match(SolidCashParser.T__53);
			this.state = 1640;
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
			this.state = 1642;
			this.match(SolidCashParser.T__8);
			this.state = 1643;
			this.match(SolidCashParser.T__52);
			this.state = 1644;
			this.typeName();
			this.state = 1645;
			this.match(SolidCashParser.Identifier);
			this.state = 1646;
			this.match(SolidCashParser.T__95);
			this.state = 1647;
			this.match(SolidCashParser.T__90);
			this.state = 1648;
			this.match(SolidCashParser.T__11);
			this.state = 1649;
			this.match(SolidCashParser.Identifier);
			this.state = 1650;
			this.match(SolidCashParser.T__53);
			this.state = 1651;
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
			this.state = 1653;
			this.match(SolidCashParser.T__8);
			this.state = 1654;
			this.match(SolidCashParser.T__52);
			this.state = 1655;
			this.typeName();
			this.state = 1656;
			this.match(SolidCashParser.Identifier);
			this.state = 1657;
			this.match(SolidCashParser.T__94);
			this.state = 1658;
			this.match(SolidCashParser.T__90);
			this.state = 1659;
			this.match(SolidCashParser.T__11);
			this.state = 1660;
			this.match(SolidCashParser.Identifier);
			this.state = 1661;
			this.match(SolidCashParser.T__53);
			this.state = 1662;
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
			this.state = 1664;
			this.match(SolidCashParser.T__8);
			this.state = 1665;
			this.match(SolidCashParser.T__52);
			this.state = 1666;
			this.forInit();
			this.state = 1667;
			this.forCondition();
			this.state = 1669;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===53 || _la===86 || _la===87 || _la===180) {
				{
				this.state = 1668;
				this.forUpdate();
				}
			}

			this.state = 1671;
			this.match(SolidCashParser.T__53);
			this.state = 1672;
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
			this.state = 1719;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 204, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1674;
				this.typeName();
				this.state = 1678;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 268435473) !== 0) || ((((_la - 134)) & ~0x1F) === 0 && ((1 << (_la - 134)) & 15) !== 0)) {
					{
					{
					this.state = 1675;
					this.modifier();
					}
					}
					this.state = 1680;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1681;
				this.match(SolidCashParser.Identifier);
				this.state = 1684;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===44) {
					{
					this.state = 1682;
					this.match(SolidCashParser.T__43);
					this.state = 1683;
					this.expression(0);
					}
				}

				this.state = 1686;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1688;
				this.match(SolidCashParser.Identifier);
				this.state = 1689;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1690;
				this.expression(0);
				this.state = 1691;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1693;
				this.match(SolidCashParser.T__52);
				this.state = 1694;
				this.tupleSlot();
				this.state = 1697;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1695;
					this.match(SolidCashParser.T__4);
					this.state = 1696;
					this.tupleSlot();
					}
					}
					this.state = 1699;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1701;
				this.match(SolidCashParser.T__53);
				this.state = 1702;
				this.match(SolidCashParser.T__43);
				this.state = 1714;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 203, this._ctx) ) {
				case 1:
					{
					this.state = 1703;
					this.match(SolidCashParser.T__52);
					this.state = 1704;
					this.expression(0);
					this.state = 1707;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1705;
						this.match(SolidCashParser.T__4);
						this.state = 1706;
						this.expression(0);
						}
						}
						this.state = 1709;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===5);
					this.state = 1711;
					this.match(SolidCashParser.T__53);
					}
					break;
				case 2:
					{
					this.state = 1713;
					this.expression(0);
					}
					break;
				}
				this.state = 1716;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1718;
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
			this.state = 1722;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073676297) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 33857) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 3766485027) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 4272948735) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				this.state = 1721;
				this.expression(0);
				}
			}

			this.state = 1724;
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
			this.state = 1756;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 209, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1726;
				this.match(SolidCashParser.Identifier);
				this.state = 1727;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1728;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1729;
				this.match(SolidCashParser.Identifier);
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
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1731;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===86 || _la===87)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1732;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1733;
				this.match(SolidCashParser.T__52);
				this.state = 1734;
				this.tupleSlot();
				this.state = 1737;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1735;
					this.match(SolidCashParser.T__4);
					this.state = 1736;
					this.tupleSlot();
					}
					}
					this.state = 1739;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1741;
				this.match(SolidCashParser.T__53);
				this.state = 1742;
				this.match(SolidCashParser.T__43);
				this.state = 1754;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 208, this._ctx) ) {
				case 1:
					{
					this.state = 1743;
					this.match(SolidCashParser.T__52);
					this.state = 1744;
					this.expression(0);
					this.state = 1747;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 1745;
						this.match(SolidCashParser.T__4);
						this.state = 1746;
						this.expression(0);
						}
						}
						this.state = 1749;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===5);
					this.state = 1751;
					this.match(SolidCashParser.T__53);
					}
					break;
				case 2:
					{
					this.state = 1753;
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
			this.state = 1758;
			this.match(SolidCashParser.T__96);
			this.state = 1759;
			this.block();
			this.state = 1760;
			this.match(SolidCashParser.T__97);
			this.state = 1761;
			this.match(SolidCashParser.T__52);
			this.state = 1762;
			this.expression(0);
			this.state = 1763;
			this.match(SolidCashParser.T__53);
			this.state = 1764;
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
			this.state = 1766;
			this.match(SolidCashParser.T__97);
			this.state = 1767;
			this.match(SolidCashParser.T__52);
			this.state = 1768;
			this.expression(0);
			this.state = 1769;
			this.match(SolidCashParser.T__53);
			this.state = 1770;
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
			this.state = 1772;
			this.match(SolidCashParser.T__98);
			this.state = 1773;
			this.consoleParameterList();
			this.state = 1774;
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
			this.state = 1776;
			this.match(SolidCashParser.T__99);
			this.state = 1778;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===151) {
				{
				this.state = 1777;
				this.match(SolidCashParser.StringLiteral);
				}
			}

			this.state = 1790;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===53) {
				{
				this.state = 1780;
				this.match(SolidCashParser.T__52);
				this.state = 1781;
				this.match(SolidCashParser.StringLiteral);
				this.state = 1786;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1782;
					this.match(SolidCashParser.T__4);
					this.state = 1783;
					this.match(SolidCashParser.StringLiteral);
					}
					}
					this.state = 1788;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1789;
				this.match(SolidCashParser.T__53);
				}
			}

			this.state = 1792;
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
			this.state = 1794;
			this.match(SolidCashParser.T__3);
			this.state = 1798;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026534544) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 511) !== 0) || ((((_la - 88)) & ~0x1F) === 0 && ((1 << (_la - 88)) & 2285601) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				{
				this.state = 1795;
				this.yulStatement();
				}
				}
				this.state = 1800;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1801;
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
			this.state = 1816;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 214, this._ctx) ) {
			case 1:
				localctx = new YulNestedBlockStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1803;
				this.yulBlock();
				}
				break;
			case 2:
				localctx = new YulVarDeclStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1804;
				this.yulVariableDeclaration();
				}
				break;
			case 3:
				localctx = new YulAssignStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1805;
				this.yulAssignment();
				}
				break;
			case 4:
				localctx = new YulIfStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1806;
				this.yulIf();
				}
				break;
			case 5:
				localctx = new YulSwitchStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1807;
				this.yulSwitch();
				}
				break;
			case 6:
				localctx = new YulForStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1808;
				this.yulForLoop();
				}
				break;
			case 7:
				localctx = new YulFunctionDefStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1809;
				this.yulFunctionDefinition();
				}
				break;
			case 8:
				localctx = new YulBreakStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1810;
				this.match(SolidCashParser.T__100);
				}
				break;
			case 9:
				localctx = new YulContinueStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1811;
				this.match(SolidCashParser.T__101);
				}
				break;
			case 10:
				localctx = new YulLeaveStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1812;
				this.match(SolidCashParser.T__36);
				}
				break;
			case 11:
				localctx = new YulCallStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1813;
				this.yulFunctionCall();
				}
				break;
			case 12:
				localctx = new YulPathStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1814;
				this.yulPath();
				}
				break;
			case 13:
				localctx = new YulLiteralStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1815;
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
			this.state = 1818;
			this.match(SolidCashParser.T__102);
			this.state = 1819;
			this.anyIdentifier();
			this.state = 1824;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1820;
				this.match(SolidCashParser.T__4);
				this.state = 1821;
				this.anyIdentifier();
				}
				}
				this.state = 1826;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1829;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===104) {
				{
				this.state = 1827;
				this.match(SolidCashParser.T__103);
				this.state = 1828;
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
			this.state = 1831;
			this.yulPath();
			this.state = 1836;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1832;
				this.match(SolidCashParser.T__4);
				this.state = 1833;
				this.yulPath();
				}
				}
				this.state = 1838;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1839;
			this.match(SolidCashParser.T__103);
			this.state = 1840;
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
			this.state = 1842;
			this.match(SolidCashParser.T__92);
			this.state = 1843;
			this.yulExpression();
			this.state = 1844;
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
			this.state = 1846;
			this.match(SolidCashParser.T__104);
			this.state = 1847;
			this.yulExpression();
			this.state = 1857;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 106:
				{
				this.state = 1849;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1848;
					this.yulCase();
					}
					}
					this.state = 1851;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===106);
				this.state = 1854;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===107) {
					{
					this.state = 1853;
					this.yulDefault();
					}
				}

				}
				break;
			case 107:
				{
				this.state = 1856;
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
			this.state = 1859;
			this.match(SolidCashParser.T__105);
			this.state = 1860;
			this.yulLiteral();
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
	public yulDefault(): YulDefaultContext {
		let localctx: YulDefaultContext = new YulDefaultContext(this, this._ctx, this.state);
		this.enterRule(localctx, 182, SolidCashParser.RULE_yulDefault);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1863;
			this.match(SolidCashParser.T__106);
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
	public yulForLoop(): YulForLoopContext {
		let localctx: YulForLoopContext = new YulForLoopContext(this, this._ctx, this.state);
		this.enterRule(localctx, 184, SolidCashParser.RULE_yulForLoop);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1866;
			this.match(SolidCashParser.T__8);
			this.state = 1867;
			this.yulBlock();
			this.state = 1868;
			this.yulExpression();
			this.state = 1869;
			this.yulBlock();
			this.state = 1870;
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
			this.state = 1872;
			this.match(SolidCashParser.T__6);
			this.state = 1873;
			this.match(SolidCashParser.Identifier);
			this.state = 1874;
			this.match(SolidCashParser.T__52);
			this.state = 1883;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 1875;
				this.match(SolidCashParser.Identifier);
				this.state = 1880;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1876;
					this.match(SolidCashParser.T__4);
					this.state = 1877;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1882;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1885;
			this.match(SolidCashParser.T__53);
			this.state = 1895;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===108) {
				{
				this.state = 1886;
				this.match(SolidCashParser.T__107);
				this.state = 1887;
				this.match(SolidCashParser.Identifier);
				this.state = 1892;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1888;
					this.match(SolidCashParser.T__4);
					this.state = 1889;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1894;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1897;
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
			this.state = 1902;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 225, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1899;
				this.yulFunctionCall();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1900;
				this.yulPath();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1901;
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
			this.state = 1904;
			this.yulFunctionName();
			this.state = 1905;
			this.match(SolidCashParser.T__52);
			this.state = 1914;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073610753) !== 0) || _la===88 || _la===109 || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2102613) !== 0) || _la===180) {
				{
				this.state = 1906;
				this.yulExpression();
				this.state = 1911;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1907;
					this.match(SolidCashParser.T__4);
					this.state = 1908;
					this.yulExpression();
					}
					}
					this.state = 1913;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 1916;
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
			this.state = 1918;
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
			this.state = 1920;
			this.anyIdentifier();
			this.state = 1926;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===12 || _la===164) {
				{
				this.state = 1924;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 12:
					{
					this.state = 1921;
					this.match(SolidCashParser.T__11);
					this.state = 1922;
					this.anyIdentifier();
					}
					break;
				case 164:
					{
					this.state = 1923;
					this.match(SolidCashParser.DotLength);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 1928;
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
			this.state = 1929;
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
			this.state = 1931;
			this.match(SolidCashParser.T__109);
			this.state = 1932;
			this.match(SolidCashParser.T__3);
			this.state = 1936;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1933;
				this.statement();
				}
				}
				this.state = 1938;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1939;
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
			this.state = 1941;
			this.match(SolidCashParser.T__104);
			this.state = 1942;
			this.match(SolidCashParser.T__52);
			this.state = 1943;
			this.expression(0);
			this.state = 1944;
			this.match(SolidCashParser.T__53);
			this.state = 1945;
			this.match(SolidCashParser.T__3);
			this.state = 1949;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===106) {
				{
				{
				this.state = 1946;
				this.switchCase();
				}
				}
				this.state = 1951;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1953;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===107) {
				{
				this.state = 1952;
				this.switchDefault();
				}
			}

			this.state = 1955;
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
			this.state = 1957;
			this.match(SolidCashParser.T__105);
			this.state = 1958;
			this.expression(0);
			this.state = 1959;
			this.match(SolidCashParser.T__110);
			this.state = 1963;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1960;
				this.statement();
				}
				}
				this.state = 1965;
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
			this.state = 1966;
			this.match(SolidCashParser.T__106);
			this.state = 1967;
			this.match(SolidCashParser.T__110);
			this.state = 1971;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4160768656) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2283799039) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2414870565) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 1610569887) !== 0) || ((((_la - 138)) & ~0x1F) === 0 && ((1 << (_la - 138)) & 33484779) !== 0) || _la===180) {
				{
				{
				this.state = 1968;
				this.statement();
				}
				}
				this.state = 1973;
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
			this.state = 1974;
			this.match(SolidCashParser.T__111);
			this.state = 1975;
			this.expression(0);
			this.state = 1977;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===75) {
				{
				this.state = 1976;
				this.tryReturns();
				}
			}

			this.state = 1979;
			localctx._tryBlock = this.block();
			this.state = 1981;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1980;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1983;
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
			this.state = 1985;
			this.match(SolidCashParser.T__74);
			this.state = 1986;
			this.match(SolidCashParser.T__52);
			this.state = 1998;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7 || _la===66 || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1987;
				this.parameter();
				this.state = 1992;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 237, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1988;
						this.match(SolidCashParser.T__4);
						this.state = 1989;
						this.parameter();
						}
						}
					}
					this.state = 1994;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 237, this._ctx);
				}
				this.state = 1996;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1995;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2000;
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
			this.state = 2002;
			this.match(SolidCashParser.T__112);
			this.state = 2004;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 240, this._ctx) ) {
			case 1:
				{
				this.state = 2003;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 2021;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 244, this._ctx) ) {
			case 1:
				{
				this.state = 2006;
				this.match(SolidCashParser.T__52);
				this.state = 2018;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || _la===66 || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 2007;
					this.parameter();
					this.state = 2012;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 241, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2008;
							this.match(SolidCashParser.T__4);
							this.state = 2009;
							this.parameter();
							}
							}
						}
						this.state = 2014;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 241, this._ctx);
					}
					this.state = 2016;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2015;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2020;
				this.match(SolidCashParser.T__53);
				}
				break;
			}
			this.state = 2023;
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
			this.state = 2025;
			this.match(SolidCashParser.T__100);
			this.state = 2026;
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
			this.state = 2028;
			this.match(SolidCashParser.T__101);
			this.state = 2029;
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
			this.state = 2035;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 245, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2031;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2032;
				this.match(SolidCashParser.Identifier);
				this.state = 2033;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2034;
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
			this.state = 2081;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 251, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2037;
				this.match(SolidCashParser.T__34);
				this.state = 2038;
				this.anyIdentifier();
				this.state = 2041;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 2039;
					this.match(SolidCashParser.T__11);
					this.state = 2040;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 2043;
				this.match(SolidCashParser.T__52);
				this.state = 2044;
				this.match(SolidCashParser.T__3);
				this.state = 2056;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2045;
					this.namedArg();
					this.state = 2050;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 247, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2046;
							this.match(SolidCashParser.T__4);
							this.state = 2047;
							this.namedArg();
							}
							}
						}
						this.state = 2052;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 247, this._ctx);
					}
					this.state = 2054;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2053;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2058;
				this.match(SolidCashParser.T__5);
				this.state = 2059;
				this.match(SolidCashParser.T__53);
				this.state = 2060;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2062;
				this.match(SolidCashParser.T__34);
				this.state = 2063;
				this.anyIdentifier();
				this.state = 2066;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 2064;
					this.match(SolidCashParser.T__11);
					this.state = 2065;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 2068;
				this.expressionList();
				this.state = 2069;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2071;
				this.match(SolidCashParser.T__34);
				this.state = 2072;
				this.match(SolidCashParser.T__52);
				this.state = 2073;
				this.expression(0);
				this.state = 2074;
				this.match(SolidCashParser.T__53);
				this.state = 2075;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2077;
				this.match(SolidCashParser.T__34);
				this.state = 2078;
				this.match(SolidCashParser.T__52);
				this.state = 2079;
				this.match(SolidCashParser.T__53);
				this.state = 2080;
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
			this.state = 2083;
			this.match(SolidCashParser.T__113);
			this.state = 2084;
			this.match(SolidCashParser.T__52);
			this.state = 2085;
			this.expression(0);
			this.state = 2086;
			this.match(SolidCashParser.T__53);
			this.state = 2087;
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
			this.state = 2091;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 180:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2089;
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
				this.state = 2090;
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
			this.state = 2093;
			this.match(SolidCashParser.T__52);
			this.state = 2105;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 3152921) !== 0) || _la===180) {
				{
				this.state = 2094;
				this.consoleParameter();
				this.state = 2099;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 253, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2095;
						this.match(SolidCashParser.T__4);
						this.state = 2096;
						this.consoleParameter();
						}
						}
					}
					this.state = 2101;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 253, this._ctx);
				}
				this.state = 2103;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2102;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2107;
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
			this.state = 2143;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 259, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2109;
				this.match(SolidCashParser.Identifier);
				this.state = 2110;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2111;
				this.match(SolidCashParser.Identifier);
				this.state = 2112;
				this.match(SolidCashParser.T__11);
				this.state = 2113;
				this.match(SolidCashParser.Identifier);
				this.state = 2114;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2115;
				this.match(SolidCashParser.Identifier);
				this.state = 2116;
				this.match(SolidCashParser.T__52);
				this.state = 2117;
				this.match(SolidCashParser.T__3);
				this.state = 2129;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2118;
					this.namedArg();
					this.state = 2123;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 256, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2119;
							this.match(SolidCashParser.T__4);
							this.state = 2120;
							this.namedArg();
							}
							}
						}
						this.state = 2125;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 256, this._ctx);
					}
					this.state = 2127;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2126;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2131;
				this.match(SolidCashParser.T__5);
				this.state = 2132;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2133;
				this.match(SolidCashParser.T__52);
				this.state = 2134;
				this.match(SolidCashParser.Identifier);
				this.state = 2135;
				this.match(SolidCashParser.T__53);
				this.state = 2136;
				this.expressionList();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2137;
				this.match(SolidCashParser.T__52);
				this.state = 2138;
				this.match(SolidCashParser.Identifier);
				this.state = 2139;
				this.match(SolidCashParser.T__11);
				this.state = 2140;
				this.match(SolidCashParser.Identifier);
				this.state = 2141;
				this.match(SolidCashParser.T__53);
				this.state = 2142;
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
			this.state = 2145;
			this.match(SolidCashParser.Identifier);
			this.state = 2146;
			this.match(SolidCashParser.T__110);
			this.state = 2147;
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
			this.state = 2149;
			this.match(SolidCashParser.T__52);
			this.state = 2161;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073676297) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 33857) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 3766485027) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 4272948735) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
				{
				this.state = 2150;
				this.callArgument();
				this.state = 2155;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 260, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2151;
						this.match(SolidCashParser.T__4);
						this.state = 2152;
						this.callArgument();
						}
						}
					}
					this.state = 2157;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 260, this._ctx);
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
	public callArgument(): CallArgumentContext {
		let localctx: CallArgumentContext = new CallArgumentContext(this, this._ctx, this.state);
		this.enterRule(localctx, 232, SolidCashParser.RULE_callArgument);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2165;
			this.expression(0);
			this.state = 2168;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0)) {
				{
				this.state = 2166;
				localctx._aop = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
				    localctx._aop = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2167;
				this.assignChain();
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
	public callOptions(): CallOptionsContext {
		let localctx: CallOptionsContext = new CallOptionsContext(this, this._ctx, this.state);
		this.enterRule(localctx, 234, SolidCashParser.RULE_callOptions);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2170;
			this.match(SolidCashParser.T__3);
			this.state = 2171;
			this.callOption();
			this.state = 2176;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 264, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2172;
					this.match(SolidCashParser.T__4);
					this.state = 2173;
					this.callOption();
					}
					}
				}
				this.state = 2178;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 264, this._ctx);
			}
			this.state = 2180;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2179;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 2182;
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
		this.enterRule(localctx, 236, SolidCashParser.RULE_callOption);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2184;
			this.match(SolidCashParser.Identifier);
			this.state = 2185;
			this.match(SolidCashParser.T__110);
			this.state = 2186;
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
		this.enterRule(localctx, 238, SolidCashParser.RULE_typeList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2188;
			this.match(SolidCashParser.T__52);
			this.state = 2189;
			this.typeListItem();
			this.state = 2194;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 266, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2190;
					this.match(SolidCashParser.T__4);
					this.state = 2191;
					this.typeListItem();
					}
					}
				}
				this.state = 2196;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 266, this._ctx);
			}
			this.state = 2198;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2197;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 2200;
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
		this.enterRule(localctx, 240, SolidCashParser.RULE_typeListItem);
		try {
			this.state = 2204;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 268, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2202;
				this.typeName();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2203;
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
		let _startState: number = 242;
		this.enterRecursionRule(localctx, 242, SolidCashParser.RULE_expression, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2384;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 278, this._ctx) ) {
			case 1:
				{
				localctx = new AssignmentExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 2207;
				this.match(SolidCashParser.T__52);
				this.state = 2208;
				this.match(SolidCashParser.Identifier);
				this.state = 2209;
				(localctx as AssignmentExpressionContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
				    (localctx as AssignmentExpressionContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2210;
				this.expression(0);
				this.state = 2211;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 2:
				{
				localctx = new InstantiationWithOptionsContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2213;
				this.match(SolidCashParser.T__52);
				this.state = 2214;
				this.match(SolidCashParser.T__114);
				this.state = 2215;
				this.match(SolidCashParser.Identifier);
				this.state = 2216;
				this.match(SolidCashParser.T__53);
				this.state = 2217;
				this.callOptions();
				this.state = 2218;
				this.expressionList();
				}
				break;
			case 3:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2220;
				this.match(SolidCashParser.T__52);
				this.state = 2221;
				this.expression(0);
				this.state = 2222;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 4:
				{
				localctx = new TupleExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2224;
				this.match(SolidCashParser.T__52);
				this.state = 2225;
				this.expression(0);
				this.state = 2228;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2226;
					this.match(SolidCashParser.T__4);
					this.state = 2227;
					this.expression(0);
					}
					}
					this.state = 2230;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2232;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 5:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2234;
				this.typeCast();
				this.state = 2235;
				this.match(SolidCashParser.T__52);
				this.state = 2236;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 2238;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2237;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 2240;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 6:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2242;
				this.functionCall();
				}
				break;
			case 7:
				{
				localctx = new ParenthesizedFunctionCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2243;
				this.match(SolidCashParser.T__52);
				this.state = 2244;
				this.expression(0);
				this.state = 2245;
				this.match(SolidCashParser.T__53);
				this.state = 2246;
				this.expressionList();
				}
				break;
			case 8:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2248;
				this.match(SolidCashParser.T__114);
				this.state = 2249;
				this.match(SolidCashParser.Identifier);
				this.state = 2251;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 2250;
					this.callOptions();
					}
				}

				this.state = 2253;
				this.expressionList();
				}
				break;
			case 9:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2254;
				this.match(SolidCashParser.T__114);
				this.state = 2255;
				this.typeName();
				this.state = 2261;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2256;
					this.match(SolidCashParser.T__67);
					this.state = 2258;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===145) {
						{
						this.state = 2257;
						this.match(SolidCashParser.NumberLiteral);
						}
					}

					this.state = 2260;
					this.match(SolidCashParser.T__68);
					}
					}
					this.state = 2263;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===68);
				this.state = 2265;
				this.match(SolidCashParser.T__52);
				this.state = 2266;
				this.expression(0);
				this.state = 2267;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 10:
				{
				localctx = new NewDynamicBytesContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2269;
				this.match(SolidCashParser.T__114);
				this.state = 2270;
				this.match(SolidCashParser.UnboundedBytes);
				this.state = 2271;
				this.match(SolidCashParser.T__52);
				this.state = 2272;
				this.expression(0);
				this.state = 2273;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 11:
				{
				localctx = new NewDynamicStringContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2275;
				this.match(SolidCashParser.T__114);
				this.state = 2276;
				this.match(SolidCashParser.PrimitiveType);
				this.state = 2277;
				this.match(SolidCashParser.T__52);
				this.state = 2278;
				this.expression(0);
				this.state = 2279;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 12:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2281;
				this.match(SolidCashParser.T__58);
				this.state = 2282;
				this.match(SolidCashParser.T__52);
				this.state = 2283;
				this.typeName();
				this.state = 2284;
				this.match(SolidCashParser.T__53);
				this.state = 2285;
				this.match(SolidCashParser.T__11);
				this.state = 2286;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 13:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2288;
				this.match(SolidCashParser.T__115);
				this.state = 2289;
				this.expressionList();
				}
				break;
			case 14:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2290;
				this.match(SolidCashParser.T__116);
				this.state = 2291;
				this.expressionList();
				}
				break;
			case 15:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2292;
				this.match(SolidCashParser.T__117);
				this.state = 2293;
				this.expressionList();
				}
				break;
			case 16:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2294;
				this.match(SolidCashParser.T__118);
				this.state = 2295;
				this.expressionList();
				}
				break;
			case 17:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2296;
				this.match(SolidCashParser.T__119);
				this.state = 2297;
				this.match(SolidCashParser.T__52);
				this.state = 2298;
				_la = this._input.LA(1);
				if(!(_la===91 || _la===180)) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2299;
				this.match(SolidCashParser.T__11);
				this.state = 2300;
				this.match(SolidCashParser.Identifier);
				this.state = 2301;
				this.match(SolidCashParser.T__4);
				this.state = 2302;
				this.expressionList();
				this.state = 2303;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 18:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2305;
				this.match(SolidCashParser.T__120);
				this.state = 2306;
				this.expressionList();
				}
				break;
			case 19:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2307;
				this.match(SolidCashParser.T__121);
				this.state = 2308;
				this.expressionList();
				}
				break;
			case 20:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2309;
				this.match(SolidCashParser.T__122);
				this.state = 2310;
				this.match(SolidCashParser.T__52);
				this.state = 2311;
				this.expression(0);
				this.state = 2312;
				this.match(SolidCashParser.T__4);
				this.state = 2313;
				this.typeList();
				this.state = 2314;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 21:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2316;
				this.match(SolidCashParser.T__123);
				this.state = 2317;
				this.match(SolidCashParser.T__52);
				this.state = 2318;
				this.expression(0);
				this.state = 2319;
				this.match(SolidCashParser.T__4);
				this.state = 2320;
				this.typeList();
				this.state = 2321;
				this.match(SolidCashParser.T__4);
				this.state = 2322;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 2323;
				this.match(SolidCashParser.T__53);
				}
				break;
			case 22:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2325;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__124);
				this.state = 2326;
				this.match(SolidCashParser.T__67);
				this.state = 2327;
				this.expression(0);
				this.state = 2328;
				this.match(SolidCashParser.T__68);
				this.state = 2329;
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
				this.state = 2331;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__125);
				this.state = 2332;
				this.match(SolidCashParser.T__67);
				this.state = 2333;
				this.expression(0);
				this.state = 2334;
				this.match(SolidCashParser.T__68);
				this.state = 2335;
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
				this.state = 2337;
				(localctx as PrefixOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===86 || _la===87)) {
				    (localctx as PrefixOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2338;
				this.expression(22);
				}
				break;
			case 25:
				{
				localctx = new UnaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2339;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===128)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2340;
				this.expression(21);
				}
				break;
			case 26:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2341;
				this.match(SolidCashParser.T__67);
				this.state = 2353;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073676297) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 33857) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 3766485027) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 4272948735) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
					{
					this.state = 2342;
					this.expression(0);
					this.state = 2347;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 274, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2343;
							this.match(SolidCashParser.T__4);
							this.state = 2344;
							this.expression(0);
							}
							}
						}
						this.state = 2349;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 274, this._ctx);
					}
					this.state = 2351;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2350;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2355;
				this.match(SolidCashParser.T__68);
				}
				break;
			case 27:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2356;
				this.match(SolidCashParser.T__90);
				this.state = 2357;
				this.match(SolidCashParser.T__11);
				this.state = 2358;
				this.match(SolidCashParser.Identifier);
				this.state = 2359;
				this.match(SolidCashParser.T__11);
				this.state = 2360;
				this.match(SolidCashParser.Identifier);
				this.state = 2361;
				this.match(SolidCashParser.T__67);
				this.state = 2362;
				this.expression(0);
				this.state = 2363;
				this.match(SolidCashParser.T__68);
				this.state = 2364;
				this.memberName();
				}
				break;
			case 28:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2366;
				this.match(SolidCashParser.T__90);
				this.state = 2367;
				this.match(SolidCashParser.T__11);
				this.state = 2368;
				this.match(SolidCashParser.Identifier);
				this.state = 2373;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2369;
						this.match(SolidCashParser.T__67);
						this.state = 2370;
						this.expression(0);
						this.state = 2371;
						this.match(SolidCashParser.T__68);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2375;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 277, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 29:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2377;
				this.match(SolidCashParser.T__90);
				this.state = 2378;
				this.match(SolidCashParser.T__11);
				this.state = 2379;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 30:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2380;
				this.match(SolidCashParser.T__90);
				}
				break;
			case 31:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2381;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 32:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2382;
				this.anyIdentifier();
				}
				break;
			case 33:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2383;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 2524;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 290, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 2522;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 289, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2386;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 2387;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 2388;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2389;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 2390;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 99328) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2391;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2392;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 2393;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2394;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2395;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 2396;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===129 || _la===130)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2397;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2398;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 2399;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2400;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2401;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2402;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2403;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2404;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2405;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2406;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2407;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2408;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2409;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2410;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2411;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2412;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2413;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2414;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__130);
						this.state = 2415;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2416;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2417;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__131);
						this.state = 2418;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2419;
						if (!(this.precpred(this._ctx, 36))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 36)");
						}
						this.state = 2420;
						this.match(SolidCashParser.T__67);
						this.state = 2422;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073676297) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 33857) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 3766485027) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 4272948735) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
							{
							this.state = 2421;
							(localctx as IndexRangeSliceContext)._start = this.expression(0);
							}
						}

						this.state = 2424;
						this.match(SolidCashParser.T__110);
						this.state = 2426;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (((((_la - 11)) & ~0x1F) === 0 && ((1 << (_la - 11)) & 1073676297) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 33857) !== 0) || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 3766485027) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 4272948735) !== 0) || ((((_la - 151)) & ~0x1F) === 0 && ((1 << (_la - 151)) & 536874999) !== 0)) {
							{
							this.state = 2425;
							(localctx as IndexRangeSliceContext)._end = this.expression(0);
							}
						}

						this.state = 2428;
						this.match(SolidCashParser.T__68);
						}
						break;
					case 13:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2429;
						if (!(this.precpred(this._ctx, 35))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 35)");
						}
						this.state = 2430;
						this.match(SolidCashParser.T__67);
						this.state = 2431;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2432;
						this.match(SolidCashParser.T__68);
						}
						break;
					case 14:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2433;
						if (!(this.precpred(this._ctx, 34))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 34)");
						}
						this.state = 2434;
						this.match(SolidCashParser.T__67);
						this.state = 2435;
						this.expression(0);
						this.state = 2436;
						this.match(SolidCashParser.T__68);
						}
						break;
					case 15:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2438;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 2439;
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
						this.state = 2440;
						if (!(this.precpred(this._ctx, 30))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 30)");
						}
						this.state = 2441;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.DotSplit);
						this.state = 2442;
						this.match(SolidCashParser.T__52);
						this.state = 2443;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2444;
						this.match(SolidCashParser.T__53);
						}
						break;
					case 17:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2446;
						if (!(this.precpred(this._ctx, 29))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 29)");
						}
						this.state = 2447;
						this.match(SolidCashParser.DotSlice);
						this.state = 2448;
						this.match(SolidCashParser.T__52);
						this.state = 2449;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2450;
						this.match(SolidCashParser.T__4);
						this.state = 2451;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2452;
						this.match(SolidCashParser.T__53);
						}
						break;
					case 18:
						{
						localctx = new LegacyCallOptionCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2454;
						if (!(this.precpred(this._ctx, 28))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 28)");
						}
						this.state = 2455;
						this.match(SolidCashParser.T__11);
						this.state = 2456;
						this.match(SolidCashParser.Identifier);
						this.state = 2460;
						this._errHandler.sync(this);
						switch (this._input.LA(1)) {
						case 12:
							{
							this.state = 2457;
							this.match(SolidCashParser.T__11);
							this.state = 2458;
							this.match(SolidCashParser.Identifier);
							}
							break;
						case 163:
							{
							this.state = 2459;
							this.match(SolidCashParser.DotValue);
							}
							break;
						default:
							throw new NoViableAltException(this);
						}
						this.state = 2462;
						this.match(SolidCashParser.T__52);
						this.state = 2463;
						this.expression(0);
						this.state = 2464;
						this.match(SolidCashParser.T__53);
						this.state = 2465;
						this.expressionList();
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2467;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2468;
						this.match(SolidCashParser.T__11);
						this.state = 2469;
						this.anyIdentifier();
						this.state = 2471;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2470;
							this.callOptions();
							}
						}

						this.state = 2473;
						this.match(SolidCashParser.T__52);
						this.state = 2474;
						this.match(SolidCashParser.T__3);
						this.state = 2486;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===180) {
							{
							this.state = 2475;
							this.namedArg();
							this.state = 2480;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 283, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2476;
									this.match(SolidCashParser.T__4);
									this.state = 2477;
									this.namedArg();
									}
									}
								}
								this.state = 2482;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 283, this._ctx);
							}
							this.state = 2484;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2483;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2488;
						this.match(SolidCashParser.T__5);
						this.state = 2489;
						this.match(SolidCashParser.T__53);
						}
						break;
					case 20:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2491;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2492;
						this.match(SolidCashParser.T__11);
						this.state = 2493;
						this.anyIdentifier();
						this.state = 2495;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2494;
							this.callOptions();
							}
						}

						this.state = 2497;
						this.expressionList();
						}
						break;
					case 21:
						{
						localctx = new IndexedFunctionCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexedFunctionCallContext)._base = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2499;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2500;
						this.match(SolidCashParser.T__67);
						this.state = 2501;
						(localctx as IndexedFunctionCallContext)._index = this.expression(0);
						this.state = 2502;
						this.match(SolidCashParser.T__68);
						this.state = 2503;
						this.expressionList();
						}
						break;
					case 22:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2505;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2506;
						this.memberName();
						}
						break;
					case 23:
						{
						localctx = new PostfixOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2507;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2508;
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
						this.state = 2509;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 2510;
						this.match(SolidCashParser.T__132);
						this.state = 2511;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 2514;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0)) {
							{
							this.state = 2512;
							(localctx as TernaryOpContext)._tOp = this._input.LT(1);
							_la = this._input.LA(1);
							if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
							    (localctx as TernaryOpContext)._tOp = this._errHandler.recoverInline(this);
							}
							else {
								this._errHandler.reportMatch(this);
							    this.consume();
							}
							this.state = 2513;
							(localctx as TernaryOpContext)._tVal = this.assignChain();
							}
						}

						this.state = 2516;
						this.match(SolidCashParser.T__110);
						this.state = 2517;
						(localctx as TernaryOpContext)._ifFalse = this.expression(0);
						this.state = 2520;
						this._errHandler.sync(this);
						switch ( this._interp.adaptivePredict(this._input, 288, this._ctx) ) {
						case 1:
							{
							this.state = 2518;
							(localctx as TernaryOpContext)._fOp = this._input.LT(1);
							_la = this._input.LA(1);
							if(!(_la===44 || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 1023) !== 0))) {
							    (localctx as TernaryOpContext)._fOp = this._errHandler.recoverInline(this);
							}
							else {
								this._errHandler.reportMatch(this);
							    this.consume();
							}
							this.state = 2519;
							(localctx as TernaryOpContext)._fVal = this.assignChain();
							}
							break;
						}
						}
						break;
					}
					}
				}
				this.state = 2526;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 290, this._ctx);
			}
			}
		}
		catch (re) {
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
		this.enterRule(localctx, 244, SolidCashParser.RULE_memberName);
		try {
			this.state = 2542;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 291, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2527;
				this.match(SolidCashParser.T__11);
				this.state = 2528;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2529;
				this.match(SolidCashParser.T__11);
				this.state = 2530;
				this.match(SolidCashParser.T__108);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2531;
				this.match(SolidCashParser.DotValue);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2532;
				this.match(SolidCashParser.DotLockingBytecode);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2533;
				this.match(SolidCashParser.DotTokenCategory);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2534;
				this.match(SolidCashParser.DotNftCommitment);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2535;
				this.match(SolidCashParser.DotTokenAmount);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2536;
				this.match(SolidCashParser.DotOutpointTransactionHash);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2537;
				this.match(SolidCashParser.DotOutpointIndex);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2538;
				this.match(SolidCashParser.DotUnlockingBytecode);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2539;
				this.match(SolidCashParser.DotSequenceNumber);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2540;
				this.match(SolidCashParser.DotCode);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2541;
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
		this.enterRule(localctx, 246, SolidCashParser.RULE_modifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2544;
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
		this.enterRule(localctx, 248, SolidCashParser.RULE_dataLocation);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2546;
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
		this.enterRule(localctx, 250, SolidCashParser.RULE_literal);
		try {
			let _alt: number;
			this.state = 2562;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 141:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2548;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 145:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2549;
				this.numberLiteral();
				}
				break;
			case 144:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2550;
				this.decimalLiteral();
				}
				break;
			case 151:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2551;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2555;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 292, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2552;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 2557;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 292, this._ctx);
				}
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2558;
				this.match(SolidCashParser.UnicodeLiteral);
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2559;
				this.match(SolidCashParser.HexStringLiteral);
				}
				break;
			case 152:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2560;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 153:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2561;
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
		this.enterRule(localctx, 252, SolidCashParser.RULE_numberLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2564;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2566;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 294, this._ctx) ) {
			case 1:
				{
				this.state = 2565;
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
		this.enterRule(localctx, 254, SolidCashParser.RULE_decimalLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2568;
			this.match(SolidCashParser.DecimalLiteral);
			this.state = 2570;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 295, this._ctx) ) {
			case 1:
				{
				this.state = 2569;
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
		this.enterRule(localctx, 256, SolidCashParser.RULE_typeName);
		let _la: number;
		try {
			let _alt: number;
			this.state = 2634;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 305, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2572;
				this.match(SolidCashParser.T__108);
				this.state = 2573;
				this.match(SolidCashParser.T__62);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2574;
				this.match(SolidCashParser.T__108);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2575;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2576;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2577;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2578;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2579;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2580;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2581;
				this.match(SolidCashParser.T__137);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2582;
				this.match(SolidCashParser.T__138);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2583;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2584;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2585;
				this.match(SolidCashParser.T__6);
				this.state = 2586;
				this.match(SolidCashParser.T__52);
				this.state = 2601;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7 || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 1610612737) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 2587;
					this.typeName();
					this.state = 2589;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (((((_la - 134)) & ~0x1F) === 0 && ((1 << (_la - 134)) & 7) !== 0)) {
						{
						this.state = 2588;
						this.dataLocation();
						}
					}

					this.state = 2598;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2591;
						this.match(SolidCashParser.T__4);
						this.state = 2592;
						this.typeName();
						this.state = 2594;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (((((_la - 134)) & ~0x1F) === 0 && ((1 << (_la - 134)) & 7) !== 0)) {
							{
							this.state = 2593;
							this.dataLocation();
							}
						}

						}
						}
						this.state = 2600;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 2603;
				this.match(SolidCashParser.T__53);
				this.state = 2607;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 300, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2604;
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
					this.state = 2609;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 300, this._ctx);
				}
				this.state = 2628;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===75) {
					{
					this.state = 2610;
					this.match(SolidCashParser.T__74);
					this.state = 2611;
					this.match(SolidCashParser.T__52);
					this.state = 2612;
					this.typeName();
					this.state = 2614;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (((((_la - 134)) & ~0x1F) === 0 && ((1 << (_la - 134)) & 7) !== 0)) {
						{
						this.state = 2613;
						this.dataLocation();
						}
					}

					this.state = 2623;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 2616;
						this.match(SolidCashParser.T__4);
						this.state = 2617;
						this.typeName();
						this.state = 2619;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (((((_la - 134)) & ~0x1F) === 0 && ((1 << (_la - 134)) & 7) !== 0)) {
							{
							this.state = 2618;
							this.dataLocation();
							}
						}

						}
						}
						this.state = 2625;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 2626;
					this.match(SolidCashParser.T__53);
					}
				}

				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 2630;
				this.match(SolidCashParser.Identifier);
				this.state = 2631;
				this.match(SolidCashParser.T__11);
				this.state = 2632;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 2633;
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
		this.enterRule(localctx, 258, SolidCashParser.RULE_typeCast);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2636;
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
		case 121:
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

	public static readonly _serializedATN: number[] = [4,1,183,2639,2,0,7,0,
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
	7,127,2,128,7,128,2,129,7,129,1,0,5,0,262,8,0,10,0,12,0,265,9,0,1,0,5,0,
	268,8,0,10,0,12,0,271,9,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,5,
	0,284,8,0,10,0,12,0,287,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,5,1,304,8,1,10,1,12,1,307,9,1,1,1,3,1,310,8,1,1,1,1,1,1,
	1,1,1,1,1,3,1,317,8,1,1,2,1,2,1,2,3,2,322,8,2,1,3,1,3,1,3,1,3,5,3,328,8,
	3,10,3,12,3,331,9,3,1,3,3,3,334,8,3,1,3,1,3,5,3,338,8,3,10,3,12,3,341,9,
	3,1,3,1,3,1,4,1,4,1,4,1,4,1,4,1,4,1,4,3,4,352,8,4,1,4,3,4,355,8,4,1,4,1,
	4,1,4,1,4,1,4,1,4,5,4,363,8,4,10,4,12,4,366,9,4,1,4,3,4,369,8,4,1,4,1,4,
	1,4,1,4,1,4,1,4,3,4,377,8,4,1,4,3,4,380,8,4,1,4,1,4,3,4,384,8,4,1,5,1,5,
	1,5,3,5,389,8,5,1,5,1,5,3,5,393,8,5,1,6,1,6,1,7,1,7,1,8,1,8,1,8,1,8,1,8,
	1,8,1,8,1,8,5,8,407,8,8,10,8,12,8,410,9,8,1,8,3,8,413,8,8,1,9,1,9,1,10,
	4,10,418,8,10,11,10,12,10,419,1,10,3,10,423,8,10,1,11,3,11,426,8,11,1,11,
	1,11,1,12,1,12,1,13,1,13,1,13,1,13,1,13,1,13,5,13,438,8,13,10,13,12,13,
	441,9,13,3,13,443,8,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,
	5,13,455,8,13,10,13,12,13,458,9,13,1,13,1,13,1,14,1,14,1,14,1,14,1,14,1,
	14,1,14,1,14,1,14,1,14,3,14,472,8,14,1,15,1,15,1,15,1,15,1,15,1,16,1,16,
	1,17,1,17,1,17,1,17,5,17,485,8,17,10,17,12,17,488,9,17,1,17,3,17,491,8,
	17,1,17,1,17,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,
	5,18,507,8,18,10,18,12,18,510,9,18,1,18,1,18,1,19,3,19,515,8,19,1,19,1,
	19,1,19,3,19,520,8,19,1,19,1,19,1,19,1,19,5,19,526,8,19,10,19,12,19,529,
	9,19,3,19,531,8,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,19,1,
	19,1,19,1,19,1,19,1,19,5,19,548,8,19,10,19,12,19,551,9,19,1,19,1,19,1,20,
	1,20,3,20,557,8,20,1,21,1,21,1,21,1,21,1,21,5,21,564,8,21,10,21,12,21,567,
	9,21,1,21,3,21,570,8,21,1,21,1,21,1,22,1,22,1,22,1,22,1,22,1,22,5,22,580,
	8,22,10,22,12,22,583,9,22,1,22,3,22,586,8,22,3,22,588,8,22,1,22,1,22,3,
	22,592,8,22,1,22,1,22,1,23,1,23,3,23,598,8,23,1,23,3,23,601,8,23,1,23,3,
	23,604,8,23,1,24,1,24,1,24,1,24,1,24,1,24,5,24,612,8,24,10,24,12,24,615,
	9,24,1,24,3,24,618,8,24,3,24,620,8,24,1,24,1,24,1,24,1,25,1,25,3,25,627,
	8,25,1,25,1,25,3,25,631,8,25,3,25,633,8,25,1,26,1,26,1,26,1,26,4,26,639,
	8,26,11,26,12,26,640,1,26,1,26,1,27,1,27,1,27,3,27,648,8,27,1,27,1,27,1,
	27,1,28,1,28,1,28,1,28,1,28,1,28,5,28,659,8,28,10,28,12,28,662,9,28,1,28,
	3,28,665,8,28,1,28,1,28,1,29,1,29,1,29,3,29,672,8,29,1,30,1,30,1,30,1,30,
	1,30,1,30,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,32,1,32,1,32,5,32,690,8,
	32,10,32,12,32,693,9,32,1,32,5,32,696,8,32,10,32,12,32,699,9,32,1,32,5,
	32,702,8,32,10,32,12,32,705,9,32,1,32,5,32,708,8,32,10,32,12,32,711,9,32,
	1,32,1,32,5,32,715,8,32,10,32,12,32,718,9,32,1,32,1,32,1,33,1,33,1,33,5,
	33,725,8,33,10,33,12,33,728,9,33,1,33,1,33,5,33,732,8,33,10,33,12,33,735,
	9,33,1,33,5,33,738,8,33,10,33,12,33,741,9,33,1,33,3,33,744,8,33,1,33,1,
	33,5,33,748,8,33,10,33,12,33,751,9,33,1,33,1,33,1,34,1,34,1,34,3,34,758,
	8,34,1,35,1,35,1,35,1,35,5,35,764,8,35,10,35,12,35,767,9,35,1,35,1,35,5,
	35,771,8,35,10,35,12,35,774,9,35,1,35,1,35,5,35,778,8,35,10,35,12,35,781,
	9,35,1,35,1,35,5,35,785,8,35,10,35,12,35,788,9,35,1,35,1,35,3,35,792,8,
	35,1,35,1,35,1,35,1,35,5,35,798,8,35,10,35,12,35,801,9,35,1,35,1,35,5,35,
	805,8,35,10,35,12,35,808,9,35,1,35,1,35,5,35,812,8,35,10,35,12,35,815,9,
	35,1,35,1,35,5,35,819,8,35,10,35,12,35,822,9,35,1,35,1,35,3,35,826,8,35,
	3,35,828,8,35,1,36,1,36,3,36,832,8,36,1,37,1,37,1,37,1,38,3,38,838,8,38,
	1,38,1,38,1,38,5,38,843,8,38,10,38,12,38,846,9,38,1,38,1,38,1,38,3,38,851,
	8,38,1,38,1,38,1,38,1,38,1,38,5,38,858,8,38,10,38,12,38,861,9,38,1,38,1,
	38,1,38,5,38,866,8,38,10,38,12,38,869,9,38,1,38,1,38,1,38,3,38,874,8,38,
	1,38,1,38,1,38,3,38,879,8,38,1,38,3,38,882,8,38,1,38,1,38,5,38,886,8,38,
	10,38,12,38,889,9,38,1,38,1,38,1,38,1,38,3,38,895,8,38,1,38,1,38,5,38,899,
	8,38,10,38,12,38,902,9,38,1,38,1,38,1,38,3,38,907,8,38,1,38,1,38,3,38,911,
	8,38,1,39,1,39,1,39,3,39,916,8,39,1,40,1,40,1,41,1,41,1,41,1,41,3,41,924,
	8,41,1,41,1,41,1,41,3,41,929,8,41,1,41,1,41,1,41,1,41,1,41,1,41,3,41,937,
	8,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,3,41,947,8,41,1,41,1,41,1,
	41,3,41,952,8,41,1,41,1,41,3,41,956,8,41,1,42,1,42,1,42,1,42,3,42,962,8,
	42,1,42,1,42,1,42,1,42,1,42,3,42,969,8,42,1,42,5,42,972,8,42,10,42,12,42,
	975,9,42,1,43,1,43,1,43,3,43,980,8,43,1,43,1,43,5,43,984,8,43,10,43,12,
	43,987,9,43,1,43,1,43,5,43,991,8,43,10,43,12,43,994,9,43,1,43,1,43,3,43,
	998,8,43,1,44,1,44,3,44,1002,8,44,1,45,1,45,1,45,1,46,1,46,1,46,1,46,1,
	46,5,46,1012,8,46,10,46,12,46,1015,9,46,1,46,3,46,1018,8,46,1,46,1,46,5,
	46,1022,8,46,10,46,12,46,1025,9,46,1,46,1,46,1,47,1,47,3,47,1031,8,47,1,
	48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,3,48,1045,8,48,
	1,49,1,49,1,49,1,49,1,49,5,49,1052,8,49,10,49,12,49,1055,9,49,1,49,3,49,
	1058,8,49,1,50,1,50,1,50,1,50,3,50,1064,8,50,1,51,1,51,1,51,1,51,1,51,5,
	51,1071,8,51,10,51,12,51,1074,9,51,1,51,3,51,1077,8,51,1,51,1,51,1,52,1,
	52,5,52,1083,8,52,10,52,12,52,1086,9,52,1,52,3,52,1089,8,52,1,52,1,52,5,
	52,1093,8,52,10,52,12,52,1096,9,52,1,52,3,52,1099,8,52,1,52,1,52,5,52,1103,
	8,52,10,52,12,52,1106,9,52,1,52,3,52,1109,8,52,3,52,1111,8,52,1,53,1,53,
	1,53,1,53,5,53,1117,8,53,10,53,12,53,1120,9,53,1,53,3,53,1123,8,53,3,53,
	1125,8,53,1,53,1,53,1,54,1,54,5,54,1131,8,54,10,54,12,54,1134,9,54,1,54,
	3,54,1137,8,54,1,54,1,54,5,54,1141,8,54,10,54,12,54,1144,9,54,1,54,3,54,
	1147,8,54,1,54,1,54,5,54,1151,8,54,10,54,12,54,1154,9,54,1,54,3,54,1157,
	8,54,3,54,1159,8,54,1,55,1,55,5,55,1163,8,55,10,55,12,55,1166,9,55,1,55,
	1,55,3,55,1170,8,55,1,56,1,56,5,56,1174,8,56,10,56,12,56,1177,9,56,1,56,
	1,56,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,
	57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,1,57,3,57,1204,8,57,1,58,1,58,
	1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,
	58,3,58,1223,8,58,3,58,1225,8,58,1,58,1,58,1,58,1,58,1,58,1,58,3,58,1233,
	8,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,1,58,3,58,1247,
	8,58,3,58,1249,8,58,1,58,1,58,1,58,3,58,1254,8,58,1,58,1,58,1,58,1,58,1,
	58,1,58,1,58,1,58,1,58,3,58,1265,8,58,1,58,1,58,1,59,1,59,1,59,3,59,1272,
	8,59,1,60,1,60,1,60,1,60,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,
	61,1,61,1,61,5,61,1290,8,61,10,61,12,61,1293,9,61,1,61,1,61,1,61,1,61,1,
	61,1,61,1,61,5,61,1302,8,61,10,61,12,61,1305,9,61,1,61,3,61,1308,8,61,1,
	61,1,61,1,61,3,61,1313,8,61,1,62,1,62,1,62,1,62,1,62,1,62,1,63,1,63,1,63,
	1,63,3,63,1325,8,63,1,63,1,63,1,63,1,63,1,63,5,63,1332,8,63,10,63,12,63,
	1335,9,63,1,63,3,63,1338,8,63,3,63,1340,8,63,1,63,1,63,1,63,1,63,1,63,1,
	63,1,63,3,63,1349,8,63,1,63,1,63,1,63,3,63,1354,8,63,1,64,1,64,5,64,1358,
	8,64,10,64,12,64,1361,9,64,1,64,1,64,1,64,1,64,1,64,1,64,1,64,1,64,3,64,
	1371,8,64,3,64,1373,8,64,1,64,1,64,1,64,1,64,5,64,1379,8,64,10,64,12,64,
	1382,9,64,1,64,1,64,1,64,1,64,1,64,1,64,3,64,1390,8,64,3,64,1392,8,64,1,
	64,1,64,1,64,1,64,5,64,1398,8,64,10,64,12,64,1401,9,64,1,64,1,64,1,64,3,
	64,1406,8,64,1,64,1,64,3,64,1410,8,64,1,65,1,65,1,65,1,65,1,65,1,65,4,65,
	1418,8,65,11,65,12,65,1419,1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,65,4,65,
	1430,8,65,11,65,12,65,1431,1,65,1,65,1,65,1,65,1,65,1,65,4,65,1440,8,65,
	11,65,12,65,1441,1,65,1,65,1,65,1,65,1,65,1,65,1,65,4,65,1451,8,65,11,65,
	12,65,1452,1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,65,5,65,1463,8,65,10,65,
	12,65,1466,9,65,1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,65,5,65,1477,
	8,65,10,65,12,65,1480,9,65,1,65,1,65,1,65,1,65,1,65,1,65,3,65,1488,8,65,
	1,66,1,66,5,66,1492,8,66,10,66,12,66,1495,9,66,1,66,1,66,1,66,1,66,5,66,
	1501,8,66,10,66,12,66,1504,9,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,1,66,
	1,66,5,66,1515,8,66,10,66,12,66,1518,9,66,1,66,3,66,1521,8,66,1,67,1,67,
	1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,
	68,1,68,4,68,1541,8,68,11,68,12,68,1542,1,68,1,68,1,68,1,68,1,68,1,68,1,
	68,1,68,4,68,1553,8,68,11,68,12,68,1554,1,68,1,68,1,68,1,68,1,68,1,68,4,
	68,1563,8,68,11,68,12,68,1564,1,68,1,68,1,68,1,68,4,68,1571,8,68,11,68,
	12,68,1572,1,68,1,68,1,68,1,68,1,68,1,68,4,68,1581,8,68,11,68,12,68,1582,
	1,68,3,68,1586,8,68,1,69,1,69,1,69,1,69,1,69,1,69,1,69,3,69,1595,8,69,1,
	69,1,69,1,69,1,70,1,70,1,70,1,70,1,70,3,70,1605,8,70,1,70,1,70,1,70,1,71,
	1,71,1,71,1,71,1,71,1,71,1,71,3,71,1617,8,71,1,72,1,72,1,72,1,72,1,72,1,
	72,3,72,1625,8,72,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,
	1,73,1,73,1,73,1,73,1,73,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,
	74,1,74,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,1,76,1,76,
	1,76,1,76,1,76,3,76,1670,8,76,1,76,1,76,1,76,1,77,1,77,5,77,1677,8,77,10,
	77,12,77,1680,9,77,1,77,1,77,1,77,3,77,1685,8,77,1,77,1,77,1,77,1,77,1,
	77,1,77,1,77,1,77,1,77,1,77,1,77,4,77,1698,8,77,11,77,12,77,1699,1,77,1,
	77,1,77,1,77,1,77,1,77,4,77,1708,8,77,11,77,12,77,1709,1,77,1,77,1,77,3,
	77,1715,8,77,1,77,1,77,1,77,3,77,1720,8,77,1,78,3,78,1723,8,78,1,78,1,78,
	1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,4,79,1738,8,79,11,
	79,12,79,1739,1,79,1,79,1,79,1,79,1,79,1,79,4,79,1748,8,79,11,79,12,79,
	1749,1,79,1,79,1,79,3,79,1755,8,79,3,79,1757,8,79,1,80,1,80,1,80,1,80,1,
	80,1,80,1,80,1,80,1,81,1,81,1,81,1,81,1,81,1,81,1,82,1,82,1,82,1,82,1,83,
	1,83,3,83,1779,8,83,1,83,1,83,1,83,1,83,5,83,1785,8,83,10,83,12,83,1788,
	9,83,1,83,3,83,1791,8,83,1,83,1,83,1,84,1,84,5,84,1797,8,84,10,84,12,84,
	1800,9,84,1,84,1,84,1,85,1,85,1,85,1,85,1,85,1,85,1,85,1,85,1,85,1,85,1,
	85,1,85,1,85,3,85,1817,8,85,1,86,1,86,1,86,1,86,5,86,1823,8,86,10,86,12,
	86,1826,9,86,1,86,1,86,3,86,1830,8,86,1,87,1,87,1,87,5,87,1835,8,87,10,
	87,12,87,1838,9,87,1,87,1,87,1,87,1,88,1,88,1,88,1,88,1,89,1,89,1,89,4,
	89,1850,8,89,11,89,12,89,1851,1,89,3,89,1855,8,89,1,89,3,89,1858,8,89,1,
	90,1,90,1,90,1,90,1,91,1,91,1,91,1,92,1,92,1,92,1,92,1,92,1,92,1,93,1,93,
	1,93,1,93,1,93,1,93,5,93,1879,8,93,10,93,12,93,1882,9,93,3,93,1884,8,93,
	1,93,1,93,1,93,1,93,1,93,5,93,1891,8,93,10,93,12,93,1894,9,93,3,93,1896,
	8,93,1,93,1,93,1,94,1,94,1,94,3,94,1903,8,94,1,95,1,95,1,95,1,95,1,95,5,
	95,1910,8,95,10,95,12,95,1913,9,95,3,95,1915,8,95,1,95,1,95,1,96,1,96,1,
	97,1,97,1,97,1,97,5,97,1925,8,97,10,97,12,97,1928,9,97,1,98,1,98,1,99,1,
	99,1,99,5,99,1935,8,99,10,99,12,99,1938,9,99,1,99,1,99,1,100,1,100,1,100,
	1,100,1,100,1,100,5,100,1948,8,100,10,100,12,100,1951,9,100,1,100,3,100,
	1954,8,100,1,100,1,100,1,101,1,101,1,101,1,101,5,101,1962,8,101,10,101,
	12,101,1965,9,101,1,102,1,102,1,102,5,102,1970,8,102,10,102,12,102,1973,
	9,102,1,103,1,103,1,103,3,103,1978,8,103,1,103,1,103,4,103,1982,8,103,11,
	103,12,103,1983,1,104,1,104,1,104,1,104,1,104,5,104,1991,8,104,10,104,12,
	104,1994,9,104,1,104,3,104,1997,8,104,3,104,1999,8,104,1,104,1,104,1,105,
	1,105,3,105,2005,8,105,1,105,1,105,1,105,1,105,5,105,2011,8,105,10,105,
	12,105,2014,9,105,1,105,3,105,2017,8,105,3,105,2019,8,105,1,105,3,105,2022,
	8,105,1,105,1,105,1,106,1,106,1,106,1,107,1,107,1,107,1,108,1,108,1,108,
	1,108,3,108,2036,8,108,1,109,1,109,1,109,1,109,3,109,2042,8,109,1,109,1,
	109,1,109,1,109,1,109,5,109,2049,8,109,10,109,12,109,2052,9,109,1,109,3,
	109,2055,8,109,3,109,2057,8,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,3,109,2067,8,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,
	1,109,1,109,1,109,1,109,1,109,3,109,2082,8,109,1,110,1,110,1,110,1,110,
	1,110,1,110,1,111,1,111,3,111,2092,8,111,1,112,1,112,1,112,1,112,5,112,
	2098,8,112,10,112,12,112,2101,9,112,1,112,3,112,2104,8,112,3,112,2106,8,
	112,1,112,1,112,1,113,1,113,1,113,1,113,1,113,1,113,1,113,1,113,1,113,1,
	113,1,113,1,113,5,113,2122,8,113,10,113,12,113,2125,9,113,1,113,3,113,2128,
	8,113,3,113,2130,8,113,1,113,1,113,1,113,1,113,1,113,1,113,1,113,1,113,
	1,113,1,113,1,113,1,113,3,113,2144,8,113,1,114,1,114,1,114,1,114,1,115,
	1,115,1,115,1,115,5,115,2154,8,115,10,115,12,115,2157,9,115,1,115,3,115,
	2160,8,115,3,115,2162,8,115,1,115,1,115,1,116,1,116,1,116,3,116,2169,8,
	116,1,117,1,117,1,117,1,117,5,117,2175,8,117,10,117,12,117,2178,9,117,1,
	117,3,117,2181,8,117,1,117,1,117,1,118,1,118,1,118,1,118,1,119,1,119,1,
	119,1,119,5,119,2193,8,119,10,119,12,119,2196,9,119,1,119,3,119,2199,8,
	119,1,119,1,119,1,120,1,120,3,120,2205,8,120,1,121,1,121,1,121,1,121,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,
	121,1,121,1,121,1,121,1,121,1,121,4,121,2229,8,121,11,121,12,121,2230,1,
	121,1,121,1,121,1,121,1,121,1,121,3,121,2239,8,121,1,121,1,121,1,121,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,3,121,2252,8,121,1,121,1,
	121,1,121,1,121,1,121,3,121,2259,8,121,1,121,4,121,2262,8,121,11,121,12,
	121,2263,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,5,121,2346,8,
	121,10,121,12,121,2349,9,121,1,121,3,121,2352,8,121,3,121,2354,8,121,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,
	121,1,121,1,121,1,121,1,121,1,121,4,121,2374,8,121,11,121,12,121,2375,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,3,121,2385,8,121,1,121,1,121,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,3,121,2423,8,
	121,1,121,1,121,3,121,2427,8,121,1,121,1,121,1,121,1,121,1,121,1,121,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,
	121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,
	121,1,121,3,121,2461,8,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,
	121,1,121,3,121,2472,8,121,1,121,1,121,1,121,1,121,1,121,5,121,2479,8,121,
	10,121,12,121,2482,9,121,1,121,3,121,2485,8,121,3,121,2487,8,121,1,121,
	1,121,1,121,1,121,1,121,1,121,1,121,3,121,2496,8,121,1,121,1,121,1,121,
	1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,
	1,121,1,121,3,121,2515,8,121,1,121,1,121,1,121,1,121,3,121,2521,8,121,5,
	121,2523,8,121,10,121,12,121,2526,9,121,1,122,1,122,1,122,1,122,1,122,1,
	122,1,122,1,122,1,122,1,122,1,122,1,122,1,122,1,122,1,122,3,122,2543,8,
	122,1,123,1,123,1,124,1,124,1,125,1,125,1,125,1,125,1,125,5,125,2554,8,
	125,10,125,12,125,2557,9,125,1,125,1,125,1,125,1,125,3,125,2563,8,125,1,
	126,1,126,3,126,2567,8,126,1,127,1,127,3,127,2571,8,127,1,128,1,128,1,128,
	1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,
	1,128,1,128,3,128,2590,8,128,1,128,1,128,1,128,3,128,2595,8,128,5,128,2597,
	8,128,10,128,12,128,2600,9,128,3,128,2602,8,128,1,128,1,128,5,128,2606,
	8,128,10,128,12,128,2609,9,128,1,128,1,128,1,128,1,128,3,128,2615,8,128,
	1,128,1,128,1,128,3,128,2620,8,128,5,128,2622,8,128,10,128,12,128,2625,
	9,128,1,128,1,128,3,128,2629,8,128,1,128,1,128,1,128,1,128,3,128,2635,8,
	128,1,129,1,129,1,129,0,2,84,242,130,0,2,4,6,8,10,12,14,16,18,20,22,24,
	26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,
	74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,110,112,114,
	116,118,120,122,124,126,128,130,132,134,136,138,140,142,144,146,148,150,
	152,154,156,158,160,162,164,166,168,170,172,174,176,178,180,182,184,186,
	188,190,192,194,196,198,200,202,204,206,208,210,212,214,216,218,220,222,
	224,226,228,230,232,234,236,238,240,242,244,246,248,250,252,254,256,258,
	0,28,2,0,10,10,13,27,5,0,11,11,28,40,143,143,147,147,180,180,5,0,42,42,
	140,140,145,145,151,151,180,180,1,0,42,43,2,0,140,140,144,144,3,0,20,23,
	26,27,44,44,1,0,47,48,2,0,47,48,62,63,3,0,47,48,62,62,65,65,2,0,44,44,76,
	85,1,0,86,87,6,0,30,30,35,35,88,88,109,109,149,149,180,180,5,0,141,141,
	145,145,151,151,153,153,162,162,2,0,91,91,180,180,2,0,163,163,172,175,2,
	0,163,163,172,179,3,0,14,14,27,27,128,128,2,0,10,10,15,16,1,0,13,14,1,0,
	129,130,1,0,20,23,1,0,18,19,2,0,127,127,164,164,4,0,32,32,36,36,60,60,134,
	137,1,0,134,136,1,0,142,143,3,0,48,48,62,63,72,73,5,0,63,63,109,109,138,
	139,146,149,155,159,3021,0,263,1,0,0,0,2,316,1,0,0,0,4,318,1,0,0,0,6,323,
	1,0,0,0,8,383,1,0,0,0,10,385,1,0,0,0,12,394,1,0,0,0,14,396,1,0,0,0,16,412,
	1,0,0,0,18,414,1,0,0,0,20,422,1,0,0,0,22,425,1,0,0,0,24,429,1,0,0,0,26,
	431,1,0,0,0,28,471,1,0,0,0,30,473,1,0,0,0,32,478,1,0,0,0,34,480,1,0,0,0,
	36,494,1,0,0,0,38,514,1,0,0,0,40,554,1,0,0,0,42,558,1,0,0,0,44,573,1,0,
	0,0,46,597,1,0,0,0,48,605,1,0,0,0,50,632,1,0,0,0,52,634,1,0,0,0,54,647,
	1,0,0,0,56,652,1,0,0,0,58,668,1,0,0,0,60,673,1,0,0,0,62,679,1,0,0,0,64,
	686,1,0,0,0,66,721,1,0,0,0,68,757,1,0,0,0,70,827,1,0,0,0,72,831,1,0,0,0,
	74,833,1,0,0,0,76,910,1,0,0,0,78,915,1,0,0,0,80,917,1,0,0,0,82,955,1,0,
	0,0,84,957,1,0,0,0,86,976,1,0,0,0,88,1001,1,0,0,0,90,1003,1,0,0,0,92,1006,
	1,0,0,0,94,1028,1,0,0,0,96,1044,1,0,0,0,98,1046,1,0,0,0,100,1059,1,0,0,
	0,102,1065,1,0,0,0,104,1110,1,0,0,0,106,1112,1,0,0,0,108,1158,1,0,0,0,110,
	1169,1,0,0,0,112,1171,1,0,0,0,114,1203,1,0,0,0,116,1205,1,0,0,0,118,1268,
	1,0,0,0,120,1273,1,0,0,0,122,1312,1,0,0,0,124,1314,1,0,0,0,126,1353,1,0,
	0,0,128,1409,1,0,0,0,130,1487,1,0,0,0,132,1520,1,0,0,0,134,1522,1,0,0,0,
	136,1585,1,0,0,0,138,1587,1,0,0,0,140,1599,1,0,0,0,142,1609,1,0,0,0,144,
	1624,1,0,0,0,146,1626,1,0,0,0,148,1642,1,0,0,0,150,1653,1,0,0,0,152,1664,
	1,0,0,0,154,1719,1,0,0,0,156,1722,1,0,0,0,158,1756,1,0,0,0,160,1758,1,0,
	0,0,162,1766,1,0,0,0,164,1772,1,0,0,0,166,1776,1,0,0,0,168,1794,1,0,0,0,
	170,1816,1,0,0,0,172,1818,1,0,0,0,174,1831,1,0,0,0,176,1842,1,0,0,0,178,
	1846,1,0,0,0,180,1859,1,0,0,0,182,1863,1,0,0,0,184,1866,1,0,0,0,186,1872,
	1,0,0,0,188,1902,1,0,0,0,190,1904,1,0,0,0,192,1918,1,0,0,0,194,1920,1,0,
	0,0,196,1929,1,0,0,0,198,1931,1,0,0,0,200,1941,1,0,0,0,202,1957,1,0,0,0,
	204,1966,1,0,0,0,206,1974,1,0,0,0,208,1985,1,0,0,0,210,2002,1,0,0,0,212,
	2025,1,0,0,0,214,2028,1,0,0,0,216,2035,1,0,0,0,218,2081,1,0,0,0,220,2083,
	1,0,0,0,222,2091,1,0,0,0,224,2093,1,0,0,0,226,2143,1,0,0,0,228,2145,1,0,
	0,0,230,2149,1,0,0,0,232,2165,1,0,0,0,234,2170,1,0,0,0,236,2184,1,0,0,0,
	238,2188,1,0,0,0,240,2204,1,0,0,0,242,2384,1,0,0,0,244,2542,1,0,0,0,246,
	2544,1,0,0,0,248,2546,1,0,0,0,250,2562,1,0,0,0,252,2564,1,0,0,0,254,2568,
	1,0,0,0,256,2634,1,0,0,0,258,2636,1,0,0,0,260,262,3,16,8,0,261,260,1,0,
	0,0,262,265,1,0,0,0,263,261,1,0,0,0,263,264,1,0,0,0,264,269,1,0,0,0,265,
	263,1,0,0,0,266,268,3,2,1,0,267,266,1,0,0,0,268,271,1,0,0,0,269,267,1,0,
	0,0,269,270,1,0,0,0,270,285,1,0,0,0,271,269,1,0,0,0,272,284,3,62,31,0,273,
	284,3,56,28,0,274,284,3,52,26,0,275,284,3,60,30,0,276,284,3,8,4,0,277,284,
	3,48,24,0,278,284,3,44,22,0,279,284,3,26,13,0,280,284,3,6,3,0,281,284,3,
	36,18,0,282,284,3,38,19,0,283,272,1,0,0,0,283,273,1,0,0,0,283,274,1,0,0,
	0,283,275,1,0,0,0,283,276,1,0,0,0,283,277,1,0,0,0,283,278,1,0,0,0,283,279,
	1,0,0,0,283,280,1,0,0,0,283,281,1,0,0,0,283,282,1,0,0,0,284,287,1,0,0,0,
	285,283,1,0,0,0,285,286,1,0,0,0,286,288,1,0,0,0,287,285,1,0,0,0,288,289,
	5,0,0,1,289,1,1,0,0,0,290,291,5,1,0,0,291,292,5,151,0,0,292,317,5,2,0,0,
	293,294,5,1,0,0,294,295,5,151,0,0,295,296,5,3,0,0,296,297,5,180,0,0,297,
	317,5,2,0,0,298,299,5,1,0,0,299,300,5,4,0,0,300,305,3,4,2,0,301,302,5,5,
	0,0,302,304,3,4,2,0,303,301,1,0,0,0,304,307,1,0,0,0,305,303,1,0,0,0,305,
	306,1,0,0,0,306,309,1,0,0,0,307,305,1,0,0,0,308,310,5,5,0,0,309,308,1,0,
	0,0,309,310,1,0,0,0,310,311,1,0,0,0,311,312,5,6,0,0,312,313,5,180,0,0,313,
	314,5,151,0,0,314,315,5,2,0,0,315,317,1,0,0,0,316,290,1,0,0,0,316,293,1,
	0,0,0,316,298,1,0,0,0,317,3,1,0,0,0,318,321,5,180,0,0,319,320,5,3,0,0,320,
	322,5,180,0,0,321,319,1,0,0,0,321,322,1,0,0,0,322,5,1,0,0,0,323,324,5,7,
	0,0,324,325,3,14,7,0,325,329,3,106,53,0,326,328,3,96,48,0,327,326,1,0,0,
	0,328,331,1,0,0,0,329,327,1,0,0,0,329,330,1,0,0,0,330,333,1,0,0,0,331,329,
	1,0,0,0,332,334,3,102,51,0,333,332,1,0,0,0,333,334,1,0,0,0,334,335,1,0,
	0,0,335,339,5,4,0,0,336,338,3,114,57,0,337,336,1,0,0,0,338,341,1,0,0,0,
	339,337,1,0,0,0,339,340,1,0,0,0,340,342,1,0,0,0,341,339,1,0,0,0,342,343,
	5,6,0,0,343,7,1,0,0,0,344,345,5,8,0,0,345,346,5,180,0,0,346,351,5,9,0,0,
	347,352,3,84,42,0,348,352,3,82,41,0,349,352,3,256,128,0,350,352,5,10,0,
	0,351,347,1,0,0,0,351,348,1,0,0,0,351,349,1,0,0,0,351,350,1,0,0,0,352,354,
	1,0,0,0,353,355,5,11,0,0,354,353,1,0,0,0,354,355,1,0,0,0,355,356,1,0,0,
	0,356,384,5,2,0,0,357,358,5,8,0,0,358,359,5,4,0,0,359,364,3,10,5,0,360,
	361,5,5,0,0,361,363,3,10,5,0,362,360,1,0,0,0,363,366,1,0,0,0,364,362,1,
	0,0,0,364,365,1,0,0,0,365,368,1,0,0,0,366,364,1,0,0,0,367,369,5,5,0,0,368,
	367,1,0,0,0,368,369,1,0,0,0,369,370,1,0,0,0,370,371,5,6,0,0,371,376,5,9,
	0,0,372,377,3,84,42,0,373,377,3,82,41,0,374,377,3,256,128,0,375,377,5,10,
	0,0,376,372,1,0,0,0,376,373,1,0,0,0,376,374,1,0,0,0,376,375,1,0,0,0,377,
	379,1,0,0,0,378,380,5,11,0,0,379,378,1,0,0,0,379,380,1,0,0,0,380,381,1,
	0,0,0,381,382,5,2,0,0,382,384,1,0,0,0,383,344,1,0,0,0,383,357,1,0,0,0,384,
	9,1,0,0,0,385,388,5,180,0,0,386,387,5,12,0,0,387,389,5,180,0,0,388,386,
	1,0,0,0,388,389,1,0,0,0,389,392,1,0,0,0,390,391,5,3,0,0,391,393,3,12,6,
	0,392,390,1,0,0,0,392,393,1,0,0,0,393,11,1,0,0,0,394,395,7,0,0,0,395,13,
	1,0,0,0,396,397,7,1,0,0,397,15,1,0,0,0,398,399,5,41,0,0,399,400,3,18,9,
	0,400,401,3,20,10,0,401,402,5,2,0,0,402,413,1,0,0,0,403,404,5,41,0,0,404,
	408,5,180,0,0,405,407,7,2,0,0,406,405,1,0,0,0,407,410,1,0,0,0,408,406,1,
	0,0,0,408,409,1,0,0,0,409,411,1,0,0,0,410,408,1,0,0,0,411,413,5,2,0,0,412,
	398,1,0,0,0,412,403,1,0,0,0,413,17,1,0,0,0,414,415,7,3,0,0,415,19,1,0,0,
	0,416,418,3,22,11,0,417,416,1,0,0,0,418,419,1,0,0,0,419,417,1,0,0,0,419,
	420,1,0,0,0,420,423,1,0,0,0,421,423,5,10,0,0,422,417,1,0,0,0,422,421,1,
	0,0,0,423,21,1,0,0,0,424,426,3,24,12,0,425,424,1,0,0,0,425,426,1,0,0,0,
	426,427,1,0,0,0,427,428,7,4,0,0,428,23,1,0,0,0,429,430,7,5,0,0,430,25,1,
	0,0,0,431,432,5,45,0,0,432,442,5,180,0,0,433,434,5,46,0,0,434,439,5,180,
	0,0,435,436,5,5,0,0,436,438,5,180,0,0,437,435,1,0,0,0,438,441,1,0,0,0,439,
	437,1,0,0,0,439,440,1,0,0,0,440,443,1,0,0,0,441,439,1,0,0,0,442,433,1,0,
	0,0,442,443,1,0,0,0,443,444,1,0,0,0,444,456,5,4,0,0,445,455,3,56,28,0,446,
	455,3,52,26,0,447,455,3,60,30,0,448,455,3,44,22,0,449,455,3,48,24,0,450,
	455,3,8,4,0,451,455,3,30,15,0,452,455,3,28,14,0,453,455,3,34,17,0,454,445,
	1,0,0,0,454,446,1,0,0,0,454,447,1,0,0,0,454,448,1,0,0,0,454,449,1,0,0,0,
	454,450,1,0,0,0,454,451,1,0,0,0,454,452,1,0,0,0,454,453,1,0,0,0,455,458,
	1,0,0,0,456,454,1,0,0,0,456,457,1,0,0,0,457,459,1,0,0,0,458,456,1,0,0,0,
	459,460,5,6,0,0,460,27,1,0,0,0,461,462,3,32,16,0,462,463,3,82,41,0,463,
	464,5,180,0,0,464,465,5,2,0,0,465,472,1,0,0,0,466,467,3,32,16,0,467,468,
	3,84,42,0,468,469,5,180,0,0,469,470,5,2,0,0,470,472,1,0,0,0,471,461,1,0,
	0,0,471,466,1,0,0,0,472,29,1,0,0,0,473,474,3,32,16,0,474,475,3,256,128,
	0,475,476,5,180,0,0,476,477,5,2,0,0,477,31,1,0,0,0,478,479,7,6,0,0,479,
	33,1,0,0,0,480,481,5,7,0,0,481,482,3,14,7,0,482,486,3,106,53,0,483,485,
	3,96,48,0,484,483,1,0,0,0,485,488,1,0,0,0,486,484,1,0,0,0,486,487,1,0,0,
	0,487,490,1,0,0,0,488,486,1,0,0,0,489,491,3,102,51,0,490,489,1,0,0,0,490,
	491,1,0,0,0,491,492,1,0,0,0,492,493,5,2,0,0,493,35,1,0,0,0,494,495,5,49,
	0,0,495,496,5,180,0,0,496,508,5,4,0,0,497,507,3,56,28,0,498,507,3,52,26,
	0,499,507,3,60,30,0,500,507,3,44,22,0,501,507,3,48,24,0,502,507,3,62,31,
	0,503,507,3,76,38,0,504,507,3,8,4,0,505,507,3,6,3,0,506,497,1,0,0,0,506,
	498,1,0,0,0,506,499,1,0,0,0,506,500,1,0,0,0,506,501,1,0,0,0,506,502,1,0,
	0,0,506,503,1,0,0,0,506,504,1,0,0,0,506,505,1,0,0,0,507,510,1,0,0,0,508,
	506,1,0,0,0,508,509,1,0,0,0,509,511,1,0,0,0,510,508,1,0,0,0,511,512,5,6,
	0,0,512,37,1,0,0,0,513,515,5,50,0,0,514,513,1,0,0,0,514,515,1,0,0,0,515,
	516,1,0,0,0,516,517,5,51,0,0,517,519,3,14,7,0,518,520,3,106,53,0,519,518,
	1,0,0,0,519,520,1,0,0,0,520,530,1,0,0,0,521,522,5,46,0,0,522,527,3,40,20,
	0,523,524,5,5,0,0,524,526,3,40,20,0,525,523,1,0,0,0,526,529,1,0,0,0,527,
	525,1,0,0,0,527,528,1,0,0,0,528,531,1,0,0,0,529,527,1,0,0,0,530,521,1,0,
	0,0,530,531,1,0,0,0,531,532,1,0,0,0,532,549,5,4,0,0,533,548,3,56,28,0,534,
	548,3,52,26,0,535,548,3,60,30,0,536,548,3,44,22,0,537,548,3,48,24,0,538,
	548,3,62,31,0,539,548,3,8,4,0,540,548,3,76,38,0,541,548,3,86,43,0,542,548,
	3,64,32,0,543,548,3,92,46,0,544,548,3,42,21,0,545,548,3,66,33,0,546,548,
	3,70,35,0,547,533,1,0,0,0,547,534,1,0,0,0,547,535,1,0,0,0,547,536,1,0,0,
	0,547,537,1,0,0,0,547,538,1,0,0,0,547,539,1,0,0,0,547,540,1,0,0,0,547,541,
	1,0,0,0,547,542,1,0,0,0,547,543,1,0,0,0,547,544,1,0,0,0,547,545,1,0,0,0,
	547,546,1,0,0,0,548,551,1,0,0,0,549,547,1,0,0,0,549,550,1,0,0,0,550,552,
	1,0,0,0,551,549,1,0,0,0,552,553,5,6,0,0,553,39,1,0,0,0,554,556,5,180,0,
	0,555,557,3,230,115,0,556,555,1,0,0,0,556,557,1,0,0,0,557,41,1,0,0,0,558,
	559,5,7,0,0,559,560,3,14,7,0,560,565,3,106,53,0,561,564,3,96,48,0,562,564,
	3,94,47,0,563,561,1,0,0,0,563,562,1,0,0,0,564,567,1,0,0,0,565,563,1,0,0,
	0,565,566,1,0,0,0,566,569,1,0,0,0,567,565,1,0,0,0,568,570,3,102,51,0,569,
	568,1,0,0,0,569,570,1,0,0,0,570,571,1,0,0,0,571,572,5,2,0,0,572,43,1,0,
	0,0,573,574,5,52,0,0,574,575,3,14,7,0,575,587,5,53,0,0,576,581,3,46,23,
	0,577,578,5,5,0,0,578,580,3,46,23,0,579,577,1,0,0,0,580,583,1,0,0,0,581,
	579,1,0,0,0,581,582,1,0,0,0,582,585,1,0,0,0,583,581,1,0,0,0,584,586,5,5,
	0,0,585,584,1,0,0,0,585,586,1,0,0,0,586,588,1,0,0,0,587,576,1,0,0,0,587,
	588,1,0,0,0,588,589,1,0,0,0,589,591,5,54,0,0,590,592,5,55,0,0,591,590,1,
	0,0,0,591,592,1,0,0,0,592,593,1,0,0,0,593,594,5,2,0,0,594,45,1,0,0,0,595,
	598,3,256,128,0,596,598,3,84,42,0,597,595,1,0,0,0,597,596,1,0,0,0,598,600,
	1,0,0,0,599,601,5,56,0,0,600,599,1,0,0,0,600,601,1,0,0,0,601,603,1,0,0,
	0,602,604,3,14,7,0,603,602,1,0,0,0,603,604,1,0,0,0,604,47,1,0,0,0,605,606,
	5,34,0,0,606,607,3,14,7,0,607,619,5,53,0,0,608,613,3,50,25,0,609,610,5,
	5,0,0,610,612,3,50,25,0,611,609,1,0,0,0,612,615,1,0,0,0,613,611,1,0,0,0,
	613,614,1,0,0,0,614,617,1,0,0,0,615,613,1,0,0,0,616,618,5,5,0,0,617,616,
	1,0,0,0,617,618,1,0,0,0,618,620,1,0,0,0,619,608,1,0,0,0,619,620,1,0,0,0,
	620,621,1,0,0,0,621,622,5,54,0,0,622,623,5,2,0,0,623,49,1,0,0,0,624,626,
	3,256,128,0,625,627,5,180,0,0,626,625,1,0,0,0,626,627,1,0,0,0,627,633,1,
	0,0,0,628,630,3,84,42,0,629,631,5,180,0,0,630,629,1,0,0,0,630,631,1,0,0,
	0,631,633,1,0,0,0,632,624,1,0,0,0,632,628,1,0,0,0,633,51,1,0,0,0,634,635,
	5,57,0,0,635,636,3,14,7,0,636,638,5,4,0,0,637,639,3,54,27,0,638,637,1,0,
	0,0,639,640,1,0,0,0,640,638,1,0,0,0,640,641,1,0,0,0,641,642,1,0,0,0,642,
	643,5,6,0,0,643,53,1,0,0,0,644,648,3,256,128,0,645,648,3,84,42,0,646,648,
	3,82,41,0,647,644,1,0,0,0,647,645,1,0,0,0,647,646,1,0,0,0,648,649,1,0,0,
	0,649,650,3,14,7,0,650,651,5,2,0,0,651,55,1,0,0,0,652,653,5,58,0,0,653,
	654,3,14,7,0,654,655,5,4,0,0,655,660,3,58,29,0,656,657,5,5,0,0,657,659,
	3,58,29,0,658,656,1,0,0,0,659,662,1,0,0,0,660,658,1,0,0,0,660,661,1,0,0,
	0,661,664,1,0,0,0,662,660,1,0,0,0,663,665,5,5,0,0,664,663,1,0,0,0,664,665,
	1,0,0,0,665,666,1,0,0,0,666,667,5,6,0,0,667,57,1,0,0,0,668,671,3,14,7,0,
	669,670,5,44,0,0,670,672,5,145,0,0,671,669,1,0,0,0,671,672,1,0,0,0,672,
	59,1,0,0,0,673,674,5,59,0,0,674,675,3,14,7,0,675,676,5,46,0,0,676,677,3,
	256,128,0,677,678,5,2,0,0,678,61,1,0,0,0,679,680,3,256,128,0,680,681,5,
	60,0,0,681,682,3,14,7,0,682,683,5,44,0,0,683,684,3,242,121,0,684,685,5,
	2,0,0,685,63,1,0,0,0,686,687,5,61,0,0,687,691,3,106,53,0,688,690,7,7,0,
	0,689,688,1,0,0,0,690,693,1,0,0,0,691,689,1,0,0,0,691,692,1,0,0,0,692,697,
	1,0,0,0,693,691,1,0,0,0,694,696,3,74,37,0,695,694,1,0,0,0,696,699,1,0,0,
	0,697,695,1,0,0,0,697,698,1,0,0,0,698,703,1,0,0,0,699,697,1,0,0,0,700,702,
	7,7,0,0,701,700,1,0,0,0,702,705,1,0,0,0,703,701,1,0,0,0,703,704,1,0,0,0,
	704,709,1,0,0,0,705,703,1,0,0,0,706,708,3,94,47,0,707,706,1,0,0,0,708,711,
	1,0,0,0,709,707,1,0,0,0,709,710,1,0,0,0,710,712,1,0,0,0,711,709,1,0,0,0,
	712,716,5,4,0,0,713,715,3,114,57,0,714,713,1,0,0,0,715,718,1,0,0,0,716,
	714,1,0,0,0,716,717,1,0,0,0,717,719,1,0,0,0,718,716,1,0,0,0,719,720,5,6,
	0,0,720,65,1,0,0,0,721,722,5,38,0,0,722,726,3,106,53,0,723,725,3,68,34,
	0,724,723,1,0,0,0,725,728,1,0,0,0,726,724,1,0,0,0,726,727,1,0,0,0,727,729,
	1,0,0,0,728,726,1,0,0,0,729,733,5,48,0,0,730,732,3,68,34,0,731,730,1,0,
	0,0,732,735,1,0,0,0,733,731,1,0,0,0,733,734,1,0,0,0,734,739,1,0,0,0,735,
	733,1,0,0,0,736,738,3,94,47,0,737,736,1,0,0,0,738,741,1,0,0,0,739,737,1,
	0,0,0,739,740,1,0,0,0,740,743,1,0,0,0,741,739,1,0,0,0,742,744,3,102,51,
	0,743,742,1,0,0,0,743,744,1,0,0,0,744,745,1,0,0,0,745,749,5,4,0,0,746,748,
	3,114,57,0,747,746,1,0,0,0,748,751,1,0,0,0,749,747,1,0,0,0,749,750,1,0,
	0,0,750,752,1,0,0,0,751,749,1,0,0,0,752,753,5,6,0,0,753,67,1,0,0,0,754,
	758,5,63,0,0,755,758,5,64,0,0,756,758,3,98,49,0,757,754,1,0,0,0,757,755,
	1,0,0,0,757,756,1,0,0,0,758,69,1,0,0,0,759,760,5,39,0,0,760,761,5,53,0,
	0,761,765,5,54,0,0,762,764,3,72,36,0,763,762,1,0,0,0,764,767,1,0,0,0,765,
	763,1,0,0,0,765,766,1,0,0,0,766,768,1,0,0,0,767,765,1,0,0,0,768,772,5,48,
	0,0,769,771,3,72,36,0,770,769,1,0,0,0,771,774,1,0,0,0,772,770,1,0,0,0,772,
	773,1,0,0,0,773,775,1,0,0,0,774,772,1,0,0,0,775,779,5,63,0,0,776,778,3,
	72,36,0,777,776,1,0,0,0,778,781,1,0,0,0,779,777,1,0,0,0,779,780,1,0,0,0,
	780,791,1,0,0,0,781,779,1,0,0,0,782,786,5,4,0,0,783,785,3,114,57,0,784,
	783,1,0,0,0,785,788,1,0,0,0,786,784,1,0,0,0,786,787,1,0,0,0,787,789,1,0,
	0,0,788,786,1,0,0,0,789,792,5,6,0,0,790,792,5,2,0,0,791,782,1,0,0,0,791,
	790,1,0,0,0,792,828,1,0,0,0,793,794,5,39,0,0,794,795,5,53,0,0,795,799,5,
	54,0,0,796,798,3,72,36,0,797,796,1,0,0,0,798,801,1,0,0,0,799,797,1,0,0,
	0,799,800,1,0,0,0,800,802,1,0,0,0,801,799,1,0,0,0,802,806,5,63,0,0,803,
	805,3,72,36,0,804,803,1,0,0,0,805,808,1,0,0,0,806,804,1,0,0,0,806,807,1,
	0,0,0,807,809,1,0,0,0,808,806,1,0,0,0,809,813,5,48,0,0,810,812,3,72,36,
	0,811,810,1,0,0,0,812,815,1,0,0,0,813,811,1,0,0,0,813,814,1,0,0,0,814,825,
	1,0,0,0,815,813,1,0,0,0,816,820,5,4,0,0,817,819,3,114,57,0,818,817,1,0,
	0,0,819,822,1,0,0,0,820,818,1,0,0,0,820,821,1,0,0,0,821,823,1,0,0,0,822,
	820,1,0,0,0,823,826,5,6,0,0,824,826,5,2,0,0,825,816,1,0,0,0,825,824,1,0,
	0,0,826,828,1,0,0,0,827,759,1,0,0,0,827,793,1,0,0,0,828,71,1,0,0,0,829,
	832,5,64,0,0,830,832,3,98,49,0,831,829,1,0,0,0,831,830,1,0,0,0,832,73,1,
	0,0,0,833,834,5,180,0,0,834,835,3,230,115,0,835,75,1,0,0,0,836,838,3,80,
	40,0,837,836,1,0,0,0,837,838,1,0,0,0,838,839,1,0,0,0,839,844,3,256,128,
	0,840,843,3,246,123,0,841,843,3,98,49,0,842,840,1,0,0,0,842,841,1,0,0,0,
	843,846,1,0,0,0,844,842,1,0,0,0,844,845,1,0,0,0,845,847,1,0,0,0,846,844,
	1,0,0,0,847,850,3,14,7,0,848,849,5,44,0,0,849,851,3,242,121,0,850,848,1,
	0,0,0,850,851,1,0,0,0,851,852,1,0,0,0,852,853,5,2,0,0,853,911,1,0,0,0,854,
	859,3,256,128,0,855,858,3,246,123,0,856,858,3,98,49,0,857,855,1,0,0,0,857,
	856,1,0,0,0,858,861,1,0,0,0,859,857,1,0,0,0,859,860,1,0,0,0,860,862,1,0,
	0,0,861,859,1,0,0,0,862,867,3,80,40,0,863,866,3,246,123,0,864,866,3,98,
	49,0,865,863,1,0,0,0,865,864,1,0,0,0,866,869,1,0,0,0,867,865,1,0,0,0,867,
	868,1,0,0,0,868,870,1,0,0,0,869,867,1,0,0,0,870,873,3,14,7,0,871,872,5,
	44,0,0,872,874,3,242,121,0,873,871,1,0,0,0,873,874,1,0,0,0,874,875,1,0,
	0,0,875,876,5,2,0,0,876,911,1,0,0,0,877,879,3,80,40,0,878,877,1,0,0,0,878,
	879,1,0,0,0,879,881,1,0,0,0,880,882,5,40,0,0,881,880,1,0,0,0,881,882,1,
	0,0,0,882,883,1,0,0,0,883,887,3,82,41,0,884,886,3,78,39,0,885,884,1,0,0,
	0,886,889,1,0,0,0,887,885,1,0,0,0,887,888,1,0,0,0,888,890,1,0,0,0,889,887,
	1,0,0,0,890,891,3,14,7,0,891,892,5,2,0,0,892,911,1,0,0,0,893,895,3,80,40,
	0,894,893,1,0,0,0,894,895,1,0,0,0,895,896,1,0,0,0,896,900,3,84,42,0,897,
	899,3,78,39,0,898,897,1,0,0,0,899,902,1,0,0,0,900,898,1,0,0,0,900,901,1,
	0,0,0,901,903,1,0,0,0,902,900,1,0,0,0,903,906,3,14,7,0,904,905,5,44,0,0,
	905,907,3,242,121,0,906,904,1,0,0,0,906,907,1,0,0,0,907,908,1,0,0,0,908,
	909,5,2,0,0,909,911,1,0,0,0,910,837,1,0,0,0,910,854,1,0,0,0,910,878,1,0,
	0,0,910,894,1,0,0,0,911,77,1,0,0,0,912,916,3,246,123,0,913,916,3,80,40,
	0,914,916,3,98,49,0,915,912,1,0,0,0,915,913,1,0,0,0,915,914,1,0,0,0,916,
	79,1,0,0,0,917,918,7,8,0,0,918,81,1,0,0,0,919,920,5,66,0,0,920,921,5,53,
	0,0,921,923,3,256,128,0,922,924,5,180,0,0,923,922,1,0,0,0,923,924,1,0,0,
	0,924,925,1,0,0,0,925,926,5,67,0,0,926,928,3,256,128,0,927,929,5,180,0,
	0,928,927,1,0,0,0,928,929,1,0,0,0,929,930,1,0,0,0,930,931,5,54,0,0,931,
	956,1,0,0,0,932,933,5,66,0,0,933,934,5,53,0,0,934,936,3,256,128,0,935,937,
	5,180,0,0,936,935,1,0,0,0,936,937,1,0,0,0,937,938,1,0,0,0,938,939,5,67,
	0,0,939,940,3,82,41,0,940,941,5,54,0,0,941,956,1,0,0,0,942,943,5,66,0,0,
	943,944,5,53,0,0,944,946,3,256,128,0,945,947,5,180,0,0,946,945,1,0,0,0,
	946,947,1,0,0,0,947,948,1,0,0,0,948,949,5,67,0,0,949,951,3,84,42,0,950,
	952,5,180,0,0,951,950,1,0,0,0,951,952,1,0,0,0,952,953,1,0,0,0,953,954,5,
	54,0,0,954,956,1,0,0,0,955,919,1,0,0,0,955,932,1,0,0,0,955,942,1,0,0,0,
	956,83,1,0,0,0,957,958,6,42,-1,0,958,959,3,256,128,0,959,961,5,68,0,0,960,
	962,3,242,121,0,961,960,1,0,0,0,961,962,1,0,0,0,962,963,1,0,0,0,963,964,
	5,69,0,0,964,973,1,0,0,0,965,966,10,1,0,0,966,968,5,68,0,0,967,969,3,242,
	121,0,968,967,1,0,0,0,968,969,1,0,0,0,969,970,1,0,0,0,970,972,5,69,0,0,
	971,965,1,0,0,0,972,975,1,0,0,0,973,971,1,0,0,0,973,974,1,0,0,0,974,85,
	1,0,0,0,975,973,1,0,0,0,976,977,5,70,0,0,977,979,5,180,0,0,978,980,3,106,
	53,0,979,978,1,0,0,0,979,980,1,0,0,0,980,985,1,0,0,0,981,984,5,64,0,0,982,
	984,3,98,49,0,983,981,1,0,0,0,983,982,1,0,0,0,984,987,1,0,0,0,985,983,1,
	0,0,0,985,986,1,0,0,0,986,997,1,0,0,0,987,985,1,0,0,0,988,992,5,4,0,0,989,
	991,3,88,44,0,990,989,1,0,0,0,991,994,1,0,0,0,992,990,1,0,0,0,992,993,1,
	0,0,0,993,995,1,0,0,0,994,992,1,0,0,0,995,998,5,6,0,0,996,998,5,2,0,0,997,
	988,1,0,0,0,997,996,1,0,0,0,998,87,1,0,0,0,999,1002,3,90,45,0,1000,1002,
	3,114,57,0,1001,999,1,0,0,0,1001,1000,1,0,0,0,1002,89,1,0,0,0,1003,1004,
	5,71,0,0,1004,1005,5,2,0,0,1005,91,1,0,0,0,1006,1007,5,7,0,0,1007,1008,
	3,14,7,0,1008,1013,3,106,53,0,1009,1012,3,96,48,0,1010,1012,3,94,47,0,1011,
	1009,1,0,0,0,1011,1010,1,0,0,0,1012,1015,1,0,0,0,1013,1011,1,0,0,0,1013,
	1014,1,0,0,0,1014,1017,1,0,0,0,1015,1013,1,0,0,0,1016,1018,3,102,51,0,1017,
	1016,1,0,0,0,1017,1018,1,0,0,0,1018,1019,1,0,0,0,1019,1023,5,4,0,0,1020,
	1022,3,114,57,0,1021,1020,1,0,0,0,1022,1025,1,0,0,0,1023,1021,1,0,0,0,1023,
	1024,1,0,0,0,1024,1026,1,0,0,0,1025,1023,1,0,0,0,1026,1027,5,6,0,0,1027,
	93,1,0,0,0,1028,1030,5,180,0,0,1029,1031,3,230,115,0,1030,1029,1,0,0,0,
	1030,1031,1,0,0,0,1031,95,1,0,0,0,1032,1045,5,72,0,0,1033,1045,5,73,0,0,
	1034,1045,5,62,0,0,1035,1045,5,48,0,0,1036,1045,5,47,0,0,1037,1045,5,65,
	0,0,1038,1045,5,63,0,0,1039,1045,3,98,49,0,1040,1045,5,64,0,0,1041,1045,
	3,100,50,0,1042,1045,5,29,0,0,1043,1045,5,30,0,0,1044,1032,1,0,0,0,1044,
	1033,1,0,0,0,1044,1034,1,0,0,0,1044,1035,1,0,0,0,1044,1036,1,0,0,0,1044,
	1037,1,0,0,0,1044,1038,1,0,0,0,1044,1039,1,0,0,0,1044,1040,1,0,0,0,1044,
	1041,1,0,0,0,1044,1042,1,0,0,0,1044,1043,1,0,0,0,1045,97,1,0,0,0,1046,1057,
	5,74,0,0,1047,1048,5,53,0,0,1048,1053,5,180,0,0,1049,1050,5,5,0,0,1050,
	1052,5,180,0,0,1051,1049,1,0,0,0,1052,1055,1,0,0,0,1053,1051,1,0,0,0,1053,
	1054,1,0,0,0,1054,1056,1,0,0,0,1055,1053,1,0,0,0,1056,1058,5,54,0,0,1057,
	1047,1,0,0,0,1057,1058,1,0,0,0,1058,99,1,0,0,0,1059,1063,5,31,0,0,1060,
	1061,5,53,0,0,1061,1062,5,145,0,0,1062,1064,5,54,0,0,1063,1060,1,0,0,0,
	1063,1064,1,0,0,0,1064,101,1,0,0,0,1065,1066,5,75,0,0,1066,1067,5,53,0,
	0,1067,1072,3,104,52,0,1068,1069,5,5,0,0,1069,1071,3,104,52,0,1070,1068,
	1,0,0,0,1071,1074,1,0,0,0,1072,1070,1,0,0,0,1072,1073,1,0,0,0,1073,1076,
	1,0,0,0,1074,1072,1,0,0,0,1075,1077,5,5,0,0,1076,1075,1,0,0,0,1076,1077,
	1,0,0,0,1077,1078,1,0,0,0,1078,1079,5,54,0,0,1079,103,1,0,0,0,1080,1084,
	3,256,128,0,1081,1083,3,246,123,0,1082,1081,1,0,0,0,1083,1086,1,0,0,0,1084,
	1082,1,0,0,0,1084,1085,1,0,0,0,1085,1088,1,0,0,0,1086,1084,1,0,0,0,1087,
	1089,3,14,7,0,1088,1087,1,0,0,0,1088,1089,1,0,0,0,1089,1111,1,0,0,0,1090,
	1094,3,84,42,0,1091,1093,3,246,123,0,1092,1091,1,0,0,0,1093,1096,1,0,0,
	0,1094,1092,1,0,0,0,1094,1095,1,0,0,0,1095,1098,1,0,0,0,1096,1094,1,0,0,
	0,1097,1099,3,14,7,0,1098,1097,1,0,0,0,1098,1099,1,0,0,0,1099,1111,1,0,
	0,0,1100,1104,3,82,41,0,1101,1103,3,246,123,0,1102,1101,1,0,0,0,1103,1106,
	1,0,0,0,1104,1102,1,0,0,0,1104,1105,1,0,0,0,1105,1108,1,0,0,0,1106,1104,
	1,0,0,0,1107,1109,3,14,7,0,1108,1107,1,0,0,0,1108,1109,1,0,0,0,1109,1111,
	1,0,0,0,1110,1080,1,0,0,0,1110,1090,1,0,0,0,1110,1100,1,0,0,0,1111,105,
	1,0,0,0,1112,1124,5,53,0,0,1113,1118,3,108,54,0,1114,1115,5,5,0,0,1115,
	1117,3,108,54,0,1116,1114,1,0,0,0,1117,1120,1,0,0,0,1118,1116,1,0,0,0,1118,
	1119,1,0,0,0,1119,1122,1,0,0,0,1120,1118,1,0,0,0,1121,1123,5,5,0,0,1122,
	1121,1,0,0,0,1122,1123,1,0,0,0,1123,1125,1,0,0,0,1124,1113,1,0,0,0,1124,
	1125,1,0,0,0,1125,1126,1,0,0,0,1126,1127,5,54,0,0,1127,107,1,0,0,0,1128,
	1132,3,256,128,0,1129,1131,3,246,123,0,1130,1129,1,0,0,0,1131,1134,1,0,
	0,0,1132,1130,1,0,0,0,1132,1133,1,0,0,0,1133,1136,1,0,0,0,1134,1132,1,0,
	0,0,1135,1137,3,14,7,0,1136,1135,1,0,0,0,1136,1137,1,0,0,0,1137,1159,1,
	0,0,0,1138,1142,3,84,42,0,1139,1141,3,246,123,0,1140,1139,1,0,0,0,1141,
	1144,1,0,0,0,1142,1140,1,0,0,0,1142,1143,1,0,0,0,1143,1146,1,0,0,0,1144,
	1142,1,0,0,0,1145,1147,3,14,7,0,1146,1145,1,0,0,0,1146,1147,1,0,0,0,1147,
	1159,1,0,0,0,1148,1152,3,82,41,0,1149,1151,3,246,123,0,1150,1149,1,0,0,
	0,1151,1154,1,0,0,0,1152,1150,1,0,0,0,1152,1153,1,0,0,0,1153,1156,1,0,0,
	0,1154,1152,1,0,0,0,1155,1157,3,14,7,0,1156,1155,1,0,0,0,1156,1157,1,0,
	0,0,1157,1159,1,0,0,0,1158,1128,1,0,0,0,1158,1138,1,0,0,0,1158,1148,1,0,
	0,0,1159,109,1,0,0,0,1160,1164,5,4,0,0,1161,1163,3,114,57,0,1162,1161,1,
	0,0,0,1163,1166,1,0,0,0,1164,1162,1,0,0,0,1164,1165,1,0,0,0,1165,1167,1,
	0,0,0,1166,1164,1,0,0,0,1167,1170,5,6,0,0,1168,1170,3,114,57,0,1169,1160,
	1,0,0,0,1169,1168,1,0,0,0,1170,111,1,0,0,0,1171,1175,5,4,0,0,1172,1174,
	3,114,57,0,1173,1172,1,0,0,0,1174,1177,1,0,0,0,1175,1173,1,0,0,0,1175,1176,
	1,0,0,0,1176,1178,1,0,0,0,1177,1175,1,0,0,0,1178,1179,5,6,0,0,1179,113,
	1,0,0,0,1180,1204,3,90,45,0,1181,1204,3,112,56,0,1182,1204,3,128,64,0,1183,
	1204,3,130,65,0,1184,1204,3,120,60,0,1185,1204,3,138,69,0,1186,1204,3,140,
	70,0,1187,1204,3,142,71,0,1188,1204,3,144,72,0,1189,1204,3,164,82,0,1190,
	1204,3,126,63,0,1191,1204,3,122,61,0,1192,1204,3,124,62,0,1193,1204,3,166,
	83,0,1194,1204,3,206,103,0,1195,1204,3,218,109,0,1196,1204,3,220,110,0,
	1197,1204,3,136,68,0,1198,1204,3,198,99,0,1199,1204,3,200,100,0,1200,1204,
	3,212,106,0,1201,1204,3,214,107,0,1202,1204,3,116,58,0,1203,1180,1,0,0,
	0,1203,1181,1,0,0,0,1203,1182,1,0,0,0,1203,1183,1,0,0,0,1203,1184,1,0,0,
	0,1203,1185,1,0,0,0,1203,1186,1,0,0,0,1203,1187,1,0,0,0,1203,1188,1,0,0,
	0,1203,1189,1,0,0,0,1203,1190,1,0,0,0,1203,1191,1,0,0,0,1203,1192,1,0,0,
	0,1203,1193,1,0,0,0,1203,1194,1,0,0,0,1203,1195,1,0,0,0,1203,1196,1,0,0,
	0,1203,1197,1,0,0,0,1203,1198,1,0,0,0,1203,1199,1,0,0,0,1203,1200,1,0,0,
	0,1203,1201,1,0,0,0,1203,1202,1,0,0,0,1204,115,1,0,0,0,1205,1264,3,242,
	121,0,1206,1207,7,9,0,0,1207,1265,3,118,59,0,1208,1209,5,165,0,0,1209,1210,
	5,53,0,0,1210,1211,5,54,0,0,1211,1212,5,165,0,0,1212,1213,5,53,0,0,1213,
	1214,5,54,0,0,1214,1215,5,44,0,0,1215,1224,3,242,121,0,1216,1217,5,165,
	0,0,1217,1218,5,53,0,0,1218,1222,5,54,0,0,1219,1220,5,165,0,0,1220,1221,
	5,53,0,0,1221,1223,5,54,0,0,1222,1219,1,0,0,0,1222,1223,1,0,0,0,1223,1225,
	1,0,0,0,1224,1216,1,0,0,0,1224,1225,1,0,0,0,1225,1265,1,0,0,0,1226,1227,
	5,165,0,0,1227,1228,5,53,0,0,1228,1229,5,54,0,0,1229,1230,5,165,0,0,1230,
	1232,5,53,0,0,1231,1233,3,134,67,0,1232,1231,1,0,0,0,1232,1233,1,0,0,0,
	1233,1234,1,0,0,0,1234,1265,5,54,0,0,1235,1236,5,165,0,0,1236,1237,5,53,
	0,0,1237,1238,5,54,0,0,1238,1239,5,44,0,0,1239,1248,3,242,121,0,1240,1241,
	5,165,0,0,1241,1242,5,53,0,0,1242,1246,5,54,0,0,1243,1244,5,165,0,0,1244,
	1245,5,53,0,0,1245,1247,5,54,0,0,1246,1243,1,0,0,0,1246,1247,1,0,0,0,1247,
	1249,1,0,0,0,1248,1240,1,0,0,0,1248,1249,1,0,0,0,1249,1265,1,0,0,0,1250,
	1251,5,165,0,0,1251,1253,5,53,0,0,1252,1254,3,134,67,0,1253,1252,1,0,0,
	0,1253,1254,1,0,0,0,1254,1255,1,0,0,0,1255,1265,5,54,0,0,1256,1257,5,166,
	0,0,1257,1258,5,53,0,0,1258,1265,5,54,0,0,1259,1260,5,169,0,0,1260,1261,
	5,53,0,0,1261,1262,3,242,121,0,1262,1263,5,54,0,0,1263,1265,1,0,0,0,1264,
	1206,1,0,0,0,1264,1208,1,0,0,0,1264,1226,1,0,0,0,1264,1235,1,0,0,0,1264,
	1250,1,0,0,0,1264,1256,1,0,0,0,1264,1259,1,0,0,0,1264,1265,1,0,0,0,1265,
	1266,1,0,0,0,1266,1267,5,2,0,0,1267,117,1,0,0,0,1268,1271,3,242,121,0,1269,
	1270,7,9,0,0,1270,1272,3,118,59,0,1271,1269,1,0,0,0,1271,1272,1,0,0,0,1272,
	119,1,0,0,0,1273,1274,7,10,0,0,1274,1275,3,242,121,0,1275,1276,5,2,0,0,
	1276,121,1,0,0,0,1277,1278,5,88,0,0,1278,1313,5,2,0,0,1279,1280,5,88,0,
	0,1280,1281,3,242,121,0,1281,1282,7,9,0,0,1282,1283,3,118,59,0,1283,1284,
	5,2,0,0,1284,1313,1,0,0,0,1285,1286,5,88,0,0,1286,1291,3,242,121,0,1287,
	1288,5,5,0,0,1288,1290,3,242,121,0,1289,1287,1,0,0,0,1290,1293,1,0,0,0,
	1291,1289,1,0,0,0,1291,1292,1,0,0,0,1292,1294,1,0,0,0,1293,1291,1,0,0,0,
	1294,1295,5,2,0,0,1295,1313,1,0,0,0,1296,1297,5,88,0,0,1297,1298,5,53,0,
	0,1298,1303,3,242,121,0,1299,1300,5,5,0,0,1300,1302,3,242,121,0,1301,1299,
	1,0,0,0,1302,1305,1,0,0,0,1303,1301,1,0,0,0,1303,1304,1,0,0,0,1304,1307,
	1,0,0,0,1305,1303,1,0,0,0,1306,1308,5,5,0,0,1307,1306,1,0,0,0,1307,1308,
	1,0,0,0,1308,1309,1,0,0,0,1309,1310,5,54,0,0,1310,1311,5,2,0,0,1311,1313,
	1,0,0,0,1312,1277,1,0,0,0,1312,1279,1,0,0,0,1312,1285,1,0,0,0,1312,1296,
	1,0,0,0,1313,123,1,0,0,0,1314,1315,5,30,0,0,1315,1316,5,53,0,0,1316,1317,
	3,242,121,0,1317,1318,5,54,0,0,1318,1319,5,2,0,0,1319,125,1,0,0,0,1320,
	1321,5,89,0,0,1321,1324,5,180,0,0,1322,1323,5,12,0,0,1323,1325,5,180,0,
	0,1324,1322,1,0,0,0,1324,1325,1,0,0,0,1325,1326,1,0,0,0,1326,1327,5,53,
	0,0,1327,1339,5,4,0,0,1328,1333,3,228,114,0,1329,1330,5,5,0,0,1330,1332,
	3,228,114,0,1331,1329,1,0,0,0,1332,1335,1,0,0,0,1333,1331,1,0,0,0,1333,
	1334,1,0,0,0,1334,1337,1,0,0,0,1335,1333,1,0,0,0,1336,1338,5,5,0,0,1337,
	1336,1,0,0,0,1337,1338,1,0,0,0,1338,1340,1,0,0,0,1339,1328,1,0,0,0,1339,
	1340,1,0,0,0,1340,1341,1,0,0,0,1341,1342,5,6,0,0,1342,1343,5,54,0,0,1343,
	1354,5,2,0,0,1344,1345,5,89,0,0,1345,1348,5,180,0,0,1346,1347,5,12,0,0,
	1347,1349,5,180,0,0,1348,1346,1,0,0,0,1348,1349,1,0,0,0,1349,1350,1,0,0,
	0,1350,1351,3,230,115,0,1351,1352,5,2,0,0,1352,1354,1,0,0,0,1353,1320,1,
	0,0,0,1353,1344,1,0,0,0,1354,127,1,0,0,0,1355,1359,3,256,128,0,1356,1358,
	3,246,123,0,1357,1356,1,0,0,0,1358,1361,1,0,0,0,1359,1357,1,0,0,0,1359,
	1360,1,0,0,0,1360,1362,1,0,0,0,1361,1359,1,0,0,0,1362,1372,3,14,7,0,1363,
	1364,5,44,0,0,1364,1370,3,242,121,0,1365,1366,7,9,0,0,1366,1371,3,118,59,
	0,1367,1368,5,165,0,0,1368,1369,5,53,0,0,1369,1371,5,54,0,0,1370,1365,1,
	0,0,0,1370,1367,1,0,0,0,1370,1371,1,0,0,0,1371,1373,1,0,0,0,1372,1363,1,
	0,0,0,1372,1373,1,0,0,0,1373,1374,1,0,0,0,1374,1375,5,2,0,0,1375,1410,1,
	0,0,0,1376,1380,3,84,42,0,1377,1379,3,246,123,0,1378,1377,1,0,0,0,1379,
	1382,1,0,0,0,1380,1378,1,0,0,0,1380,1381,1,0,0,0,1381,1383,1,0,0,0,1382,
	1380,1,0,0,0,1383,1391,3,14,7,0,1384,1385,5,44,0,0,1385,1389,3,242,121,
	0,1386,1387,5,165,0,0,1387,1388,5,53,0,0,1388,1390,5,54,0,0,1389,1386,1,
	0,0,0,1389,1390,1,0,0,0,1390,1392,1,0,0,0,1391,1384,1,0,0,0,1391,1392,1,
	0,0,0,1392,1393,1,0,0,0,1393,1394,5,2,0,0,1394,1410,1,0,0,0,1395,1399,3,
	82,41,0,1396,1398,3,246,123,0,1397,1396,1,0,0,0,1398,1401,1,0,0,0,1399,
	1397,1,0,0,0,1399,1400,1,0,0,0,1400,1402,1,0,0,0,1401,1399,1,0,0,0,1402,
	1405,3,14,7,0,1403,1404,5,44,0,0,1404,1406,3,242,121,0,1405,1403,1,0,0,
	0,1405,1406,1,0,0,0,1406,1407,1,0,0,0,1407,1408,5,2,0,0,1408,1410,1,0,0,
	0,1409,1355,1,0,0,0,1409,1376,1,0,0,0,1409,1395,1,0,0,0,1410,129,1,0,0,
	0,1411,1412,3,256,128,0,1412,1417,5,180,0,0,1413,1414,5,5,0,0,1414,1415,
	3,256,128,0,1415,1416,5,180,0,0,1416,1418,1,0,0,0,1417,1413,1,0,0,0,1418,
	1419,1,0,0,0,1419,1417,1,0,0,0,1419,1420,1,0,0,0,1420,1421,1,0,0,0,1421,
	1422,5,44,0,0,1422,1423,3,242,121,0,1423,1424,5,2,0,0,1424,1488,1,0,0,0,
	1425,1426,5,53,0,0,1426,1429,3,132,66,0,1427,1428,5,5,0,0,1428,1430,3,132,
	66,0,1429,1427,1,0,0,0,1430,1431,1,0,0,0,1431,1429,1,0,0,0,1431,1432,1,
	0,0,0,1432,1433,1,0,0,0,1433,1434,5,54,0,0,1434,1435,5,44,0,0,1435,1436,
	5,53,0,0,1436,1439,3,242,121,0,1437,1438,5,5,0,0,1438,1440,3,242,121,0,
	1439,1437,1,0,0,0,1440,1441,1,0,0,0,1441,1439,1,0,0,0,1441,1442,1,0,0,0,
	1442,1443,1,0,0,0,1443,1444,5,54,0,0,1444,1445,5,2,0,0,1445,1488,1,0,0,
	0,1446,1447,5,53,0,0,1447,1450,3,132,66,0,1448,1449,5,5,0,0,1449,1451,3,
	132,66,0,1450,1448,1,0,0,0,1451,1452,1,0,0,0,1452,1450,1,0,0,0,1452,1453,
	1,0,0,0,1453,1454,1,0,0,0,1454,1455,5,54,0,0,1455,1456,5,44,0,0,1456,1457,
	3,242,121,0,1457,1458,5,2,0,0,1458,1488,1,0,0,0,1459,1460,5,53,0,0,1460,
	1464,3,256,128,0,1461,1463,3,246,123,0,1462,1461,1,0,0,0,1463,1466,1,0,
	0,0,1464,1462,1,0,0,0,1464,1465,1,0,0,0,1465,1467,1,0,0,0,1466,1464,1,0,
	0,0,1467,1468,3,14,7,0,1468,1469,5,54,0,0,1469,1470,5,44,0,0,1470,1471,
	3,242,121,0,1471,1472,5,2,0,0,1472,1488,1,0,0,0,1473,1474,5,53,0,0,1474,
	1478,3,84,42,0,1475,1477,3,246,123,0,1476,1475,1,0,0,0,1477,1480,1,0,0,
	0,1478,1476,1,0,0,0,1478,1479,1,0,0,0,1479,1481,1,0,0,0,1480,1478,1,0,0,
	0,1481,1482,3,14,7,0,1482,1483,5,54,0,0,1483,1484,5,44,0,0,1484,1485,3,
	242,121,0,1485,1486,5,2,0,0,1486,1488,1,0,0,0,1487,1411,1,0,0,0,1487,1425,
	1,0,0,0,1487,1446,1,0,0,0,1487,1459,1,0,0,0,1487,1473,1,0,0,0,1488,131,
	1,0,0,0,1489,1493,3,256,128,0,1490,1492,3,246,123,0,1491,1490,1,0,0,0,1492,
	1495,1,0,0,0,1493,1491,1,0,0,0,1493,1494,1,0,0,0,1494,1496,1,0,0,0,1495,
	1493,1,0,0,0,1496,1497,3,14,7,0,1497,1521,1,0,0,0,1498,1502,3,84,42,0,1499,
	1501,3,246,123,0,1500,1499,1,0,0,0,1501,1504,1,0,0,0,1502,1500,1,0,0,0,
	1502,1503,1,0,0,0,1503,1505,1,0,0,0,1504,1502,1,0,0,0,1505,1506,3,14,7,
	0,1506,1521,1,0,0,0,1507,1516,3,14,7,0,1508,1509,5,68,0,0,1509,1510,3,242,
	121,0,1510,1511,5,69,0,0,1511,1515,1,0,0,0,1512,1513,5,12,0,0,1513,1515,
	3,14,7,0,1514,1508,1,0,0,0,1514,1512,1,0,0,0,1515,1518,1,0,0,0,1516,1514,
	1,0,0,0,1516,1517,1,0,0,0,1517,1521,1,0,0,0,1518,1516,1,0,0,0,1519,1521,
	1,0,0,0,1520,1489,1,0,0,0,1520,1498,1,0,0,0,1520,1507,1,0,0,0,1520,1519,
	1,0,0,0,1521,133,1,0,0,0,1522,1523,3,242,121,0,1523,135,1,0,0,0,1524,1525,
	5,90,0,0,1525,1526,5,180,0,0,1526,1586,5,2,0,0,1527,1528,5,90,0,0,1528,
	1529,5,91,0,0,1529,1530,5,12,0,0,1530,1531,5,180,0,0,1531,1586,5,2,0,0,
	1532,1533,5,90,0,0,1533,1534,5,91,0,0,1534,1535,5,12,0,0,1535,1540,5,180,
	0,0,1536,1537,5,68,0,0,1537,1538,3,242,121,0,1538,1539,5,69,0,0,1539,1541,
	1,0,0,0,1540,1536,1,0,0,0,1541,1542,1,0,0,0,1542,1540,1,0,0,0,1542,1543,
	1,0,0,0,1543,1544,1,0,0,0,1544,1545,5,2,0,0,1545,1586,1,0,0,0,1546,1547,
	5,90,0,0,1547,1552,5,180,0,0,1548,1549,5,68,0,0,1549,1550,3,242,121,0,1550,
	1551,5,69,0,0,1551,1553,1,0,0,0,1552,1548,1,0,0,0,1553,1554,1,0,0,0,1554,
	1552,1,0,0,0,1554,1555,1,0,0,0,1555,1556,1,0,0,0,1556,1557,5,2,0,0,1557,
	1586,1,0,0,0,1558,1559,5,90,0,0,1559,1562,5,180,0,0,1560,1561,5,12,0,0,
	1561,1563,5,180,0,0,1562,1560,1,0,0,0,1563,1564,1,0,0,0,1564,1562,1,0,0,
	0,1564,1565,1,0,0,0,1565,1570,1,0,0,0,1566,1567,5,68,0,0,1567,1568,3,242,
	121,0,1568,1569,5,69,0,0,1569,1571,1,0,0,0,1570,1566,1,0,0,0,1571,1572,
	1,0,0,0,1572,1570,1,0,0,0,1572,1573,1,0,0,0,1573,1574,1,0,0,0,1574,1575,
	5,2,0,0,1575,1586,1,0,0,0,1576,1577,5,90,0,0,1577,1580,5,180,0,0,1578,1579,
	5,12,0,0,1579,1581,5,180,0,0,1580,1578,1,0,0,0,1581,1582,1,0,0,0,1582,1580,
	1,0,0,0,1582,1583,1,0,0,0,1583,1584,1,0,0,0,1584,1586,5,2,0,0,1585,1524,
	1,0,0,0,1585,1527,1,0,0,0,1585,1532,1,0,0,0,1585,1546,1,0,0,0,1585,1558,
	1,0,0,0,1585,1576,1,0,0,0,1586,137,1,0,0,0,1587,1588,5,92,0,0,1588,1589,
	5,53,0,0,1589,1590,5,154,0,0,1590,1591,5,23,0,0,1591,1594,3,242,121,0,1592,
	1593,5,5,0,0,1593,1595,3,216,108,0,1594,1592,1,0,0,0,1594,1595,1,0,0,0,
	1595,1596,1,0,0,0,1596,1597,5,54,0,0,1597,1598,5,2,0,0,1598,139,1,0,0,0,
	1599,1600,5,92,0,0,1600,1601,5,53,0,0,1601,1604,3,242,121,0,1602,1603,5,
	5,0,0,1603,1605,3,216,108,0,1604,1602,1,0,0,0,1604,1605,1,0,0,0,1605,1606,
	1,0,0,0,1606,1607,5,54,0,0,1607,1608,5,2,0,0,1608,141,1,0,0,0,1609,1610,
	5,93,0,0,1610,1611,5,53,0,0,1611,1612,3,242,121,0,1612,1613,5,54,0,0,1613,
	1616,3,110,55,0,1614,1615,5,94,0,0,1615,1617,3,110,55,0,1616,1614,1,0,0,
	0,1616,1617,1,0,0,0,1617,143,1,0,0,0,1618,1625,3,160,80,0,1619,1625,3,162,
	81,0,1620,1625,3,152,76,0,1621,1625,3,146,73,0,1622,1625,3,148,74,0,1623,
	1625,3,150,75,0,1624,1618,1,0,0,0,1624,1619,1,0,0,0,1624,1620,1,0,0,0,1624,
	1621,1,0,0,0,1624,1622,1,0,0,0,1624,1623,1,0,0,0,1625,145,1,0,0,0,1626,
	1627,5,9,0,0,1627,1628,5,53,0,0,1628,1629,3,256,128,0,1629,1630,5,180,0,
	0,1630,1631,5,5,0,0,1631,1632,3,256,128,0,1632,1633,5,180,0,0,1633,1634,
	5,95,0,0,1634,1635,5,91,0,0,1635,1636,5,12,0,0,1636,1637,5,180,0,0,1637,
	1638,5,12,0,0,1638,1639,5,33,0,0,1639,1640,5,54,0,0,1640,1641,3,110,55,
	0,1641,147,1,0,0,0,1642,1643,5,9,0,0,1643,1644,5,53,0,0,1644,1645,3,256,
	128,0,1645,1646,5,180,0,0,1646,1647,5,96,0,0,1647,1648,5,91,0,0,1648,1649,
	5,12,0,0,1649,1650,5,180,0,0,1650,1651,5,54,0,0,1651,1652,3,110,55,0,1652,
	149,1,0,0,0,1653,1654,5,9,0,0,1654,1655,5,53,0,0,1655,1656,3,256,128,0,
	1656,1657,5,180,0,0,1657,1658,5,95,0,0,1658,1659,5,91,0,0,1659,1660,5,12,
	0,0,1660,1661,5,180,0,0,1661,1662,5,54,0,0,1662,1663,3,110,55,0,1663,151,
	1,0,0,0,1664,1665,5,9,0,0,1665,1666,5,53,0,0,1666,1667,3,154,77,0,1667,
	1669,3,156,78,0,1668,1670,3,158,79,0,1669,1668,1,0,0,0,1669,1670,1,0,0,
	0,1670,1671,1,0,0,0,1671,1672,5,54,0,0,1672,1673,3,110,55,0,1673,153,1,
	0,0,0,1674,1678,3,256,128,0,1675,1677,3,246,123,0,1676,1675,1,0,0,0,1677,
	1680,1,0,0,0,1678,1676,1,0,0,0,1678,1679,1,0,0,0,1679,1681,1,0,0,0,1680,
	1678,1,0,0,0,1681,1684,5,180,0,0,1682,1683,5,44,0,0,1683,1685,3,242,121,
	0,1684,1682,1,0,0,0,1684,1685,1,0,0,0,1685,1686,1,0,0,0,1686,1687,5,2,0,
	0,1687,1720,1,0,0,0,1688,1689,5,180,0,0,1689,1690,7,9,0,0,1690,1691,3,242,
	121,0,1691,1692,5,2,0,0,1692,1720,1,0,0,0,1693,1694,5,53,0,0,1694,1697,
	3,132,66,0,1695,1696,5,5,0,0,1696,1698,3,132,66,0,1697,1695,1,0,0,0,1698,
	1699,1,0,0,0,1699,1697,1,0,0,0,1699,1700,1,0,0,0,1700,1701,1,0,0,0,1701,
	1702,5,54,0,0,1702,1714,5,44,0,0,1703,1704,5,53,0,0,1704,1707,3,242,121,
	0,1705,1706,5,5,0,0,1706,1708,3,242,121,0,1707,1705,1,0,0,0,1708,1709,1,
	0,0,0,1709,1707,1,0,0,0,1709,1710,1,0,0,0,1710,1711,1,0,0,0,1711,1712,5,
	54,0,0,1712,1715,1,0,0,0,1713,1715,3,242,121,0,1714,1703,1,0,0,0,1714,1713,
	1,0,0,0,1715,1716,1,0,0,0,1716,1717,5,2,0,0,1717,1720,1,0,0,0,1718,1720,
	5,2,0,0,1719,1674,1,0,0,0,1719,1688,1,0,0,0,1719,1693,1,0,0,0,1719,1718,
	1,0,0,0,1720,155,1,0,0,0,1721,1723,3,242,121,0,1722,1721,1,0,0,0,1722,1723,
	1,0,0,0,1723,1724,1,0,0,0,1724,1725,5,2,0,0,1725,157,1,0,0,0,1726,1727,
	5,180,0,0,1727,1728,7,9,0,0,1728,1757,3,242,121,0,1729,1730,5,180,0,0,1730,
	1757,7,10,0,0,1731,1732,7,10,0,0,1732,1757,5,180,0,0,1733,1734,5,53,0,0,
	1734,1737,3,132,66,0,1735,1736,5,5,0,0,1736,1738,3,132,66,0,1737,1735,1,
	0,0,0,1738,1739,1,0,0,0,1739,1737,1,0,0,0,1739,1740,1,0,0,0,1740,1741,1,
	0,0,0,1741,1742,5,54,0,0,1742,1754,5,44,0,0,1743,1744,5,53,0,0,1744,1747,
	3,242,121,0,1745,1746,5,5,0,0,1746,1748,3,242,121,0,1747,1745,1,0,0,0,1748,
	1749,1,0,0,0,1749,1747,1,0,0,0,1749,1750,1,0,0,0,1750,1751,1,0,0,0,1751,
	1752,5,54,0,0,1752,1755,1,0,0,0,1753,1755,3,242,121,0,1754,1743,1,0,0,0,
	1754,1753,1,0,0,0,1755,1757,1,0,0,0,1756,1726,1,0,0,0,1756,1729,1,0,0,0,
	1756,1731,1,0,0,0,1756,1733,1,0,0,0,1757,159,1,0,0,0,1758,1759,5,97,0,0,
	1759,1760,3,110,55,0,1760,1761,5,98,0,0,1761,1762,5,53,0,0,1762,1763,3,
	242,121,0,1763,1764,5,54,0,0,1764,1765,5,2,0,0,1765,161,1,0,0,0,1766,1767,
	5,98,0,0,1767,1768,5,53,0,0,1768,1769,3,242,121,0,1769,1770,5,54,0,0,1770,
	1771,3,110,55,0,1771,163,1,0,0,0,1772,1773,5,99,0,0,1773,1774,3,224,112,
	0,1774,1775,5,2,0,0,1775,165,1,0,0,0,1776,1778,5,100,0,0,1777,1779,5,151,
	0,0,1778,1777,1,0,0,0,1778,1779,1,0,0,0,1779,1790,1,0,0,0,1780,1781,5,53,
	0,0,1781,1786,5,151,0,0,1782,1783,5,5,0,0,1783,1785,5,151,0,0,1784,1782,
	1,0,0,0,1785,1788,1,0,0,0,1786,1784,1,0,0,0,1786,1787,1,0,0,0,1787,1789,
	1,0,0,0,1788,1786,1,0,0,0,1789,1791,5,54,0,0,1790,1780,1,0,0,0,1790,1791,
	1,0,0,0,1791,1792,1,0,0,0,1792,1793,3,168,84,0,1793,167,1,0,0,0,1794,1798,
	5,4,0,0,1795,1797,3,170,85,0,1796,1795,1,0,0,0,1797,1800,1,0,0,0,1798,1796,
	1,0,0,0,1798,1799,1,0,0,0,1799,1801,1,0,0,0,1800,1798,1,0,0,0,1801,1802,
	5,6,0,0,1802,169,1,0,0,0,1803,1817,3,168,84,0,1804,1817,3,172,86,0,1805,
	1817,3,174,87,0,1806,1817,3,176,88,0,1807,1817,3,178,89,0,1808,1817,3,184,
	92,0,1809,1817,3,186,93,0,1810,1817,5,101,0,0,1811,1817,5,102,0,0,1812,
	1817,5,37,0,0,1813,1817,3,190,95,0,1814,1817,3,194,97,0,1815,1817,3,196,
	98,0,1816,1803,1,0,0,0,1816,1804,1,0,0,0,1816,1805,1,0,0,0,1816,1806,1,
	0,0,0,1816,1807,1,0,0,0,1816,1808,1,0,0,0,1816,1809,1,0,0,0,1816,1810,1,
	0,0,0,1816,1811,1,0,0,0,1816,1812,1,0,0,0,1816,1813,1,0,0,0,1816,1814,1,
	0,0,0,1816,1815,1,0,0,0,1817,171,1,0,0,0,1818,1819,5,103,0,0,1819,1824,
	3,14,7,0,1820,1821,5,5,0,0,1821,1823,3,14,7,0,1822,1820,1,0,0,0,1823,1826,
	1,0,0,0,1824,1822,1,0,0,0,1824,1825,1,0,0,0,1825,1829,1,0,0,0,1826,1824,
	1,0,0,0,1827,1828,5,104,0,0,1828,1830,3,188,94,0,1829,1827,1,0,0,0,1829,
	1830,1,0,0,0,1830,173,1,0,0,0,1831,1836,3,194,97,0,1832,1833,5,5,0,0,1833,
	1835,3,194,97,0,1834,1832,1,0,0,0,1835,1838,1,0,0,0,1836,1834,1,0,0,0,1836,
	1837,1,0,0,0,1837,1839,1,0,0,0,1838,1836,1,0,0,0,1839,1840,5,104,0,0,1840,
	1841,3,188,94,0,1841,175,1,0,0,0,1842,1843,5,93,0,0,1843,1844,3,188,94,
	0,1844,1845,3,168,84,0,1845,177,1,0,0,0,1846,1847,5,105,0,0,1847,1857,3,
	188,94,0,1848,1850,3,180,90,0,1849,1848,1,0,0,0,1850,1851,1,0,0,0,1851,
	1849,1,0,0,0,1851,1852,1,0,0,0,1852,1854,1,0,0,0,1853,1855,3,182,91,0,1854,
	1853,1,0,0,0,1854,1855,1,0,0,0,1855,1858,1,0,0,0,1856,1858,3,182,91,0,1857,
	1849,1,0,0,0,1857,1856,1,0,0,0,1858,179,1,0,0,0,1859,1860,5,106,0,0,1860,
	1861,3,196,98,0,1861,1862,3,168,84,0,1862,181,1,0,0,0,1863,1864,5,107,0,
	0,1864,1865,3,168,84,0,1865,183,1,0,0,0,1866,1867,5,9,0,0,1867,1868,3,168,
	84,0,1868,1869,3,188,94,0,1869,1870,3,168,84,0,1870,1871,3,168,84,0,1871,
	185,1,0,0,0,1872,1873,5,7,0,0,1873,1874,5,180,0,0,1874,1883,5,53,0,0,1875,
	1880,5,180,0,0,1876,1877,5,5,0,0,1877,1879,5,180,0,0,1878,1876,1,0,0,0,
	1879,1882,1,0,0,0,1880,1878,1,0,0,0,1880,1881,1,0,0,0,1881,1884,1,0,0,0,
	1882,1880,1,0,0,0,1883,1875,1,0,0,0,1883,1884,1,0,0,0,1884,1885,1,0,0,0,
	1885,1895,5,54,0,0,1886,1887,5,108,0,0,1887,1892,5,180,0,0,1888,1889,5,
	5,0,0,1889,1891,5,180,0,0,1890,1888,1,0,0,0,1891,1894,1,0,0,0,1892,1890,
	1,0,0,0,1892,1893,1,0,0,0,1893,1896,1,0,0,0,1894,1892,1,0,0,0,1895,1886,
	1,0,0,0,1895,1896,1,0,0,0,1896,1897,1,0,0,0,1897,1898,3,168,84,0,1898,187,
	1,0,0,0,1899,1903,3,190,95,0,1900,1903,3,194,97,0,1901,1903,3,196,98,0,
	1902,1899,1,0,0,0,1902,1900,1,0,0,0,1902,1901,1,0,0,0,1903,189,1,0,0,0,
	1904,1905,3,192,96,0,1905,1914,5,53,0,0,1906,1911,3,188,94,0,1907,1908,
	5,5,0,0,1908,1910,3,188,94,0,1909,1907,1,0,0,0,1910,1913,1,0,0,0,1911,1909,
	1,0,0,0,1911,1912,1,0,0,0,1912,1915,1,0,0,0,1913,1911,1,0,0,0,1914,1906,
	1,0,0,0,1914,1915,1,0,0,0,1915,1916,1,0,0,0,1916,1917,5,54,0,0,1917,191,
	1,0,0,0,1918,1919,7,11,0,0,1919,193,1,0,0,0,1920,1926,3,14,7,0,1921,1922,
	5,12,0,0,1922,1925,3,14,7,0,1923,1925,5,164,0,0,1924,1921,1,0,0,0,1924,
	1923,1,0,0,0,1925,1928,1,0,0,0,1926,1924,1,0,0,0,1926,1927,1,0,0,0,1927,
	195,1,0,0,0,1928,1926,1,0,0,0,1929,1930,7,12,0,0,1930,197,1,0,0,0,1931,
	1932,5,110,0,0,1932,1936,5,4,0,0,1933,1935,3,114,57,0,1934,1933,1,0,0,0,
	1935,1938,1,0,0,0,1936,1934,1,0,0,0,1936,1937,1,0,0,0,1937,1939,1,0,0,0,
	1938,1936,1,0,0,0,1939,1940,5,6,0,0,1940,199,1,0,0,0,1941,1942,5,105,0,
	0,1942,1943,5,53,0,0,1943,1944,3,242,121,0,1944,1945,5,54,0,0,1945,1949,
	5,4,0,0,1946,1948,3,202,101,0,1947,1946,1,0,0,0,1948,1951,1,0,0,0,1949,
	1947,1,0,0,0,1949,1950,1,0,0,0,1950,1953,1,0,0,0,1951,1949,1,0,0,0,1952,
	1954,3,204,102,0,1953,1952,1,0,0,0,1953,1954,1,0,0,0,1954,1955,1,0,0,0,
	1955,1956,5,6,0,0,1956,201,1,0,0,0,1957,1958,5,106,0,0,1958,1959,3,242,
	121,0,1959,1963,5,111,0,0,1960,1962,3,114,57,0,1961,1960,1,0,0,0,1962,1965,
	1,0,0,0,1963,1961,1,0,0,0,1963,1964,1,0,0,0,1964,203,1,0,0,0,1965,1963,
	1,0,0,0,1966,1967,5,107,0,0,1967,1971,5,111,0,0,1968,1970,3,114,57,0,1969,
	1968,1,0,0,0,1970,1973,1,0,0,0,1971,1969,1,0,0,0,1971,1972,1,0,0,0,1972,
	205,1,0,0,0,1973,1971,1,0,0,0,1974,1975,5,112,0,0,1975,1977,3,242,121,0,
	1976,1978,3,208,104,0,1977,1976,1,0,0,0,1977,1978,1,0,0,0,1978,1979,1,0,
	0,0,1979,1981,3,110,55,0,1980,1982,3,210,105,0,1981,1980,1,0,0,0,1982,1983,
	1,0,0,0,1983,1981,1,0,0,0,1983,1984,1,0,0,0,1984,207,1,0,0,0,1985,1986,
	5,75,0,0,1986,1998,5,53,0,0,1987,1992,3,108,54,0,1988,1989,5,5,0,0,1989,
	1991,3,108,54,0,1990,1988,1,0,0,0,1991,1994,1,0,0,0,1992,1990,1,0,0,0,1992,
	1993,1,0,0,0,1993,1996,1,0,0,0,1994,1992,1,0,0,0,1995,1997,5,5,0,0,1996,
	1995,1,0,0,0,1996,1997,1,0,0,0,1997,1999,1,0,0,0,1998,1987,1,0,0,0,1998,
	1999,1,0,0,0,1999,2000,1,0,0,0,2000,2001,5,54,0,0,2001,209,1,0,0,0,2002,
	2004,5,113,0,0,2003,2005,5,180,0,0,2004,2003,1,0,0,0,2004,2005,1,0,0,0,
	2005,2021,1,0,0,0,2006,2018,5,53,0,0,2007,2012,3,108,54,0,2008,2009,5,5,
	0,0,2009,2011,3,108,54,0,2010,2008,1,0,0,0,2011,2014,1,0,0,0,2012,2010,
	1,0,0,0,2012,2013,1,0,0,0,2013,2016,1,0,0,0,2014,2012,1,0,0,0,2015,2017,
	5,5,0,0,2016,2015,1,0,0,0,2016,2017,1,0,0,0,2017,2019,1,0,0,0,2018,2007,
	1,0,0,0,2018,2019,1,0,0,0,2019,2020,1,0,0,0,2020,2022,5,54,0,0,2021,2006,
	1,0,0,0,2021,2022,1,0,0,0,2022,2023,1,0,0,0,2023,2024,3,110,55,0,2024,211,
	1,0,0,0,2025,2026,5,101,0,0,2026,2027,5,2,0,0,2027,213,1,0,0,0,2028,2029,
	5,102,0,0,2029,2030,5,2,0,0,2030,215,1,0,0,0,2031,2036,5,151,0,0,2032,2033,
	5,180,0,0,2033,2036,3,230,115,0,2034,2036,3,242,121,0,2035,2031,1,0,0,0,
	2035,2032,1,0,0,0,2035,2034,1,0,0,0,2036,217,1,0,0,0,2037,2038,5,35,0,0,
	2038,2041,3,14,7,0,2039,2040,5,12,0,0,2040,2042,5,180,0,0,2041,2039,1,0,
	0,0,2041,2042,1,0,0,0,2042,2043,1,0,0,0,2043,2044,5,53,0,0,2044,2056,5,
	4,0,0,2045,2050,3,228,114,0,2046,2047,5,5,0,0,2047,2049,3,228,114,0,2048,
	2046,1,0,0,0,2049,2052,1,0,0,0,2050,2048,1,0,0,0,2050,2051,1,0,0,0,2051,
	2054,1,0,0,0,2052,2050,1,0,0,0,2053,2055,5,5,0,0,2054,2053,1,0,0,0,2054,
	2055,1,0,0,0,2055,2057,1,0,0,0,2056,2045,1,0,0,0,2056,2057,1,0,0,0,2057,
	2058,1,0,0,0,2058,2059,5,6,0,0,2059,2060,5,54,0,0,2060,2061,5,2,0,0,2061,
	2082,1,0,0,0,2062,2063,5,35,0,0,2063,2066,3,14,7,0,2064,2065,5,12,0,0,2065,
	2067,5,180,0,0,2066,2064,1,0,0,0,2066,2067,1,0,0,0,2067,2068,1,0,0,0,2068,
	2069,3,230,115,0,2069,2070,5,2,0,0,2070,2082,1,0,0,0,2071,2072,5,35,0,0,
	2072,2073,5,53,0,0,2073,2074,3,242,121,0,2074,2075,5,54,0,0,2075,2076,5,
	2,0,0,2076,2082,1,0,0,0,2077,2078,5,35,0,0,2078,2079,5,53,0,0,2079,2080,
	5,54,0,0,2080,2082,5,2,0,0,2081,2037,1,0,0,0,2081,2062,1,0,0,0,2081,2071,
	1,0,0,0,2081,2077,1,0,0,0,2082,219,1,0,0,0,2083,2084,5,114,0,0,2084,2085,
	5,53,0,0,2085,2086,3,242,121,0,2086,2087,5,54,0,0,2087,2088,5,2,0,0,2088,
	221,1,0,0,0,2089,2092,5,180,0,0,2090,2092,3,250,125,0,2091,2089,1,0,0,0,
	2091,2090,1,0,0,0,2092,223,1,0,0,0,2093,2105,5,53,0,0,2094,2099,3,222,111,
	0,2095,2096,5,5,0,0,2096,2098,3,222,111,0,2097,2095,1,0,0,0,2098,2101,1,
	0,0,0,2099,2097,1,0,0,0,2099,2100,1,0,0,0,2100,2103,1,0,0,0,2101,2099,1,
	0,0,0,2102,2104,5,5,0,0,2103,2102,1,0,0,0,2103,2104,1,0,0,0,2104,2106,1,
	0,0,0,2105,2094,1,0,0,0,2105,2106,1,0,0,0,2106,2107,1,0,0,0,2107,2108,5,
	54,0,0,2108,225,1,0,0,0,2109,2110,5,180,0,0,2110,2144,3,230,115,0,2111,
	2112,5,180,0,0,2112,2113,5,12,0,0,2113,2114,5,180,0,0,2114,2144,3,230,115,
	0,2115,2116,5,180,0,0,2116,2117,5,53,0,0,2117,2129,5,4,0,0,2118,2123,3,
	228,114,0,2119,2120,5,5,0,0,2120,2122,3,228,114,0,2121,2119,1,0,0,0,2122,
	2125,1,0,0,0,2123,2121,1,0,0,0,2123,2124,1,0,0,0,2124,2127,1,0,0,0,2125,
	2123,1,0,0,0,2126,2128,5,5,0,0,2127,2126,1,0,0,0,2127,2128,1,0,0,0,2128,
	2130,1,0,0,0,2129,2118,1,0,0,0,2129,2130,1,0,0,0,2130,2131,1,0,0,0,2131,
	2132,5,6,0,0,2132,2144,5,54,0,0,2133,2134,5,53,0,0,2134,2135,5,180,0,0,
	2135,2136,5,54,0,0,2136,2144,3,230,115,0,2137,2138,5,53,0,0,2138,2139,5,
	180,0,0,2139,2140,5,12,0,0,2140,2141,5,180,0,0,2141,2142,5,54,0,0,2142,
	2144,3,230,115,0,2143,2109,1,0,0,0,2143,2111,1,0,0,0,2143,2115,1,0,0,0,
	2143,2133,1,0,0,0,2143,2137,1,0,0,0,2144,227,1,0,0,0,2145,2146,5,180,0,
	0,2146,2147,5,111,0,0,2147,2148,3,242,121,0,2148,229,1,0,0,0,2149,2161,
	5,53,0,0,2150,2155,3,232,116,0,2151,2152,5,5,0,0,2152,2154,3,232,116,0,
	2153,2151,1,0,0,0,2154,2157,1,0,0,0,2155,2153,1,0,0,0,2155,2156,1,0,0,0,
	2156,2159,1,0,0,0,2157,2155,1,0,0,0,2158,2160,5,5,0,0,2159,2158,1,0,0,0,
	2159,2160,1,0,0,0,2160,2162,1,0,0,0,2161,2150,1,0,0,0,2161,2162,1,0,0,0,
	2162,2163,1,0,0,0,2163,2164,5,54,0,0,2164,231,1,0,0,0,2165,2168,3,242,121,
	0,2166,2167,7,9,0,0,2167,2169,3,118,59,0,2168,2166,1,0,0,0,2168,2169,1,
	0,0,0,2169,233,1,0,0,0,2170,2171,5,4,0,0,2171,2176,3,236,118,0,2172,2173,
	5,5,0,0,2173,2175,3,236,118,0,2174,2172,1,0,0,0,2175,2178,1,0,0,0,2176,
	2174,1,0,0,0,2176,2177,1,0,0,0,2177,2180,1,0,0,0,2178,2176,1,0,0,0,2179,
	2181,5,5,0,0,2180,2179,1,0,0,0,2180,2181,1,0,0,0,2181,2182,1,0,0,0,2182,
	2183,5,6,0,0,2183,235,1,0,0,0,2184,2185,5,180,0,0,2185,2186,5,111,0,0,2186,
	2187,3,242,121,0,2187,237,1,0,0,0,2188,2189,5,53,0,0,2189,2194,3,240,120,
	0,2190,2191,5,5,0,0,2191,2193,3,240,120,0,2192,2190,1,0,0,0,2193,2196,1,
	0,0,0,2194,2192,1,0,0,0,2194,2195,1,0,0,0,2195,2198,1,0,0,0,2196,2194,1,
	0,0,0,2197,2199,5,5,0,0,2198,2197,1,0,0,0,2198,2199,1,0,0,0,2199,2200,1,
	0,0,0,2200,2201,5,54,0,0,2201,239,1,0,0,0,2202,2205,3,256,128,0,2203,2205,
	3,84,42,0,2204,2202,1,0,0,0,2204,2203,1,0,0,0,2205,241,1,0,0,0,2206,2207,
	6,121,-1,0,2207,2208,5,53,0,0,2208,2209,5,180,0,0,2209,2210,7,9,0,0,2210,
	2211,3,242,121,0,2211,2212,5,54,0,0,2212,2385,1,0,0,0,2213,2214,5,53,0,
	0,2214,2215,5,115,0,0,2215,2216,5,180,0,0,2216,2217,5,54,0,0,2217,2218,
	3,234,117,0,2218,2219,3,230,115,0,2219,2385,1,0,0,0,2220,2221,5,53,0,0,
	2221,2222,3,242,121,0,2222,2223,5,54,0,0,2223,2385,1,0,0,0,2224,2225,5,
	53,0,0,2225,2228,3,242,121,0,2226,2227,5,5,0,0,2227,2229,3,242,121,0,2228,
	2226,1,0,0,0,2229,2230,1,0,0,0,2230,2228,1,0,0,0,2230,2231,1,0,0,0,2231,
	2232,1,0,0,0,2232,2233,5,54,0,0,2233,2385,1,0,0,0,2234,2235,3,258,129,0,
	2235,2236,5,53,0,0,2236,2238,3,242,121,0,2237,2239,5,5,0,0,2238,2237,1,
	0,0,0,2238,2239,1,0,0,0,2239,2240,1,0,0,0,2240,2241,5,54,0,0,2241,2385,
	1,0,0,0,2242,2385,3,226,113,0,2243,2244,5,53,0,0,2244,2245,3,242,121,0,
	2245,2246,5,54,0,0,2246,2247,3,230,115,0,2247,2385,1,0,0,0,2248,2249,5,
	115,0,0,2249,2251,5,180,0,0,2250,2252,3,234,117,0,2251,2250,1,0,0,0,2251,
	2252,1,0,0,0,2252,2253,1,0,0,0,2253,2385,3,230,115,0,2254,2255,5,115,0,
	0,2255,2261,3,256,128,0,2256,2258,5,68,0,0,2257,2259,5,145,0,0,2258,2257,
	1,0,0,0,2258,2259,1,0,0,0,2259,2260,1,0,0,0,2260,2262,5,69,0,0,2261,2256,
	1,0,0,0,2262,2263,1,0,0,0,2263,2261,1,0,0,0,2263,2264,1,0,0,0,2264,2265,
	1,0,0,0,2265,2266,5,53,0,0,2266,2267,3,242,121,0,2267,2268,5,54,0,0,2268,
	2385,1,0,0,0,2269,2270,5,115,0,0,2270,2271,5,148,0,0,2271,2272,5,53,0,0,
	2272,2273,3,242,121,0,2273,2274,5,54,0,0,2274,2385,1,0,0,0,2275,2276,5,
	115,0,0,2276,2277,5,146,0,0,2277,2278,5,53,0,0,2278,2279,3,242,121,0,2279,
	2280,5,54,0,0,2280,2385,1,0,0,0,2281,2282,5,59,0,0,2282,2283,5,53,0,0,2283,
	2284,3,256,128,0,2284,2285,5,54,0,0,2285,2286,5,12,0,0,2286,2287,5,180,
	0,0,2287,2385,1,0,0,0,2288,2289,5,116,0,0,2289,2385,3,230,115,0,2290,2291,
	5,117,0,0,2291,2385,3,230,115,0,2292,2293,5,118,0,0,2293,2385,3,230,115,
	0,2294,2295,5,119,0,0,2295,2385,3,230,115,0,2296,2297,5,120,0,0,2297,2298,
	5,53,0,0,2298,2299,7,13,0,0,2299,2300,5,12,0,0,2300,2301,5,180,0,0,2301,
	2302,5,5,0,0,2302,2303,3,230,115,0,2303,2304,5,54,0,0,2304,2385,1,0,0,0,
	2305,2306,5,121,0,0,2306,2385,3,230,115,0,2307,2308,5,122,0,0,2308,2385,
	3,230,115,0,2309,2310,5,123,0,0,2310,2311,5,53,0,0,2311,2312,3,242,121,
	0,2312,2313,5,5,0,0,2313,2314,3,238,119,0,2314,2315,5,54,0,0,2315,2385,
	1,0,0,0,2316,2317,5,124,0,0,2317,2318,5,53,0,0,2318,2319,3,242,121,0,2319,
	2320,5,5,0,0,2320,2321,3,238,119,0,2321,2322,5,5,0,0,2322,2323,5,145,0,
	0,2323,2324,5,54,0,0,2324,2385,1,0,0,0,2325,2326,5,125,0,0,2326,2327,5,
	68,0,0,2327,2328,3,242,121,0,2328,2329,5,69,0,0,2329,2330,7,14,0,0,2330,
	2385,1,0,0,0,2331,2332,5,126,0,0,2332,2333,5,68,0,0,2333,2334,3,242,121,
	0,2334,2335,5,69,0,0,2335,2336,7,15,0,0,2336,2385,1,0,0,0,2337,2338,7,10,
	0,0,2338,2385,3,242,121,22,2339,2340,7,16,0,0,2340,2385,3,242,121,21,2341,
	2353,5,68,0,0,2342,2347,3,242,121,0,2343,2344,5,5,0,0,2344,2346,3,242,121,
	0,2345,2343,1,0,0,0,2346,2349,1,0,0,0,2347,2345,1,0,0,0,2347,2348,1,0,0,
	0,2348,2351,1,0,0,0,2349,2347,1,0,0,0,2350,2352,5,5,0,0,2351,2350,1,0,0,
	0,2351,2352,1,0,0,0,2352,2354,1,0,0,0,2353,2342,1,0,0,0,2353,2354,1,0,0,
	0,2354,2355,1,0,0,0,2355,2385,5,69,0,0,2356,2357,5,91,0,0,2357,2358,5,12,
	0,0,2358,2359,5,180,0,0,2359,2360,5,12,0,0,2360,2361,5,180,0,0,2361,2362,
	5,68,0,0,2362,2363,3,242,121,0,2363,2364,5,69,0,0,2364,2365,3,244,122,0,
	2365,2385,1,0,0,0,2366,2367,5,91,0,0,2367,2368,5,12,0,0,2368,2373,5,180,
	0,0,2369,2370,5,68,0,0,2370,2371,3,242,121,0,2371,2372,5,69,0,0,2372,2374,
	1,0,0,0,2373,2369,1,0,0,0,2374,2375,1,0,0,0,2375,2373,1,0,0,0,2375,2376,
	1,0,0,0,2376,2385,1,0,0,0,2377,2378,5,91,0,0,2378,2379,5,12,0,0,2379,2385,
	5,180,0,0,2380,2385,5,91,0,0,2381,2385,5,160,0,0,2382,2385,3,14,7,0,2383,
	2385,3,250,125,0,2384,2206,1,0,0,0,2384,2213,1,0,0,0,2384,2220,1,0,0,0,
	2384,2224,1,0,0,0,2384,2234,1,0,0,0,2384,2242,1,0,0,0,2384,2243,1,0,0,0,
	2384,2248,1,0,0,0,2384,2254,1,0,0,0,2384,2269,1,0,0,0,2384,2275,1,0,0,0,
	2384,2281,1,0,0,0,2384,2288,1,0,0,0,2384,2290,1,0,0,0,2384,2292,1,0,0,0,
	2384,2294,1,0,0,0,2384,2296,1,0,0,0,2384,2305,1,0,0,0,2384,2307,1,0,0,0,
	2384,2309,1,0,0,0,2384,2316,1,0,0,0,2384,2325,1,0,0,0,2384,2331,1,0,0,0,
	2384,2337,1,0,0,0,2384,2339,1,0,0,0,2384,2341,1,0,0,0,2384,2356,1,0,0,0,
	2384,2366,1,0,0,0,2384,2377,1,0,0,0,2384,2380,1,0,0,0,2384,2381,1,0,0,0,
	2384,2382,1,0,0,0,2384,2383,1,0,0,0,2385,2524,1,0,0,0,2386,2387,10,20,0,
	0,2387,2388,5,17,0,0,2388,2523,3,242,121,20,2389,2390,10,19,0,0,2390,2391,
	7,17,0,0,2391,2523,3,242,121,20,2392,2393,10,18,0,0,2393,2394,7,18,0,0,
	2394,2523,3,242,121,19,2395,2396,10,17,0,0,2396,2397,7,19,0,0,2397,2523,
	3,242,121,18,2398,2399,10,16,0,0,2399,2400,5,24,0,0,2400,2523,3,242,121,
	17,2401,2402,10,15,0,0,2402,2403,5,26,0,0,2403,2523,3,242,121,16,2404,2405,
	10,14,0,0,2405,2406,5,25,0,0,2406,2523,3,242,121,15,2407,2408,10,13,0,0,
	2408,2409,7,20,0,0,2409,2523,3,242,121,14,2410,2411,10,12,0,0,2411,2412,
	7,21,0,0,2412,2523,3,242,121,13,2413,2414,10,11,0,0,2414,2415,5,131,0,0,
	2415,2523,3,242,121,12,2416,2417,10,10,0,0,2417,2418,5,132,0,0,2418,2523,
	3,242,121,11,2419,2420,10,36,0,0,2420,2422,5,68,0,0,2421,2423,3,242,121,
	0,2422,2421,1,0,0,0,2422,2423,1,0,0,0,2423,2424,1,0,0,0,2424,2426,5,111,
	0,0,2425,2427,3,242,121,0,2426,2425,1,0,0,0,2426,2427,1,0,0,0,2427,2428,
	1,0,0,0,2428,2523,5,69,0,0,2429,2430,10,35,0,0,2430,2431,5,68,0,0,2431,
	2432,5,145,0,0,2432,2523,5,69,0,0,2433,2434,10,34,0,0,2434,2435,5,68,0,
	0,2435,2436,3,242,121,0,2436,2437,5,69,0,0,2437,2523,1,0,0,0,2438,2439,
	10,31,0,0,2439,2523,7,22,0,0,2440,2441,10,30,0,0,2441,2442,5,167,0,0,2442,
	2443,5,53,0,0,2443,2444,3,242,121,0,2444,2445,5,54,0,0,2445,2523,1,0,0,
	0,2446,2447,10,29,0,0,2447,2448,5,168,0,0,2448,2449,5,53,0,0,2449,2450,
	3,242,121,0,2450,2451,5,5,0,0,2451,2452,3,242,121,0,2452,2453,5,54,0,0,
	2453,2523,1,0,0,0,2454,2455,10,28,0,0,2455,2456,5,12,0,0,2456,2460,5,180,
	0,0,2457,2458,5,12,0,0,2458,2461,5,180,0,0,2459,2461,5,163,0,0,2460,2457,
	1,0,0,0,2460,2459,1,0,0,0,2461,2462,1,0,0,0,2462,2463,5,53,0,0,2463,2464,
	3,242,121,0,2464,2465,5,54,0,0,2465,2466,3,230,115,0,2466,2523,1,0,0,0,
	2467,2468,10,27,0,0,2468,2469,5,12,0,0,2469,2471,3,14,7,0,2470,2472,3,234,
	117,0,2471,2470,1,0,0,0,2471,2472,1,0,0,0,2472,2473,1,0,0,0,2473,2474,5,
	53,0,0,2474,2486,5,4,0,0,2475,2480,3,228,114,0,2476,2477,5,5,0,0,2477,2479,
	3,228,114,0,2478,2476,1,0,0,0,2479,2482,1,0,0,0,2480,2478,1,0,0,0,2480,
	2481,1,0,0,0,2481,2484,1,0,0,0,2482,2480,1,0,0,0,2483,2485,5,5,0,0,2484,
	2483,1,0,0,0,2484,2485,1,0,0,0,2485,2487,1,0,0,0,2486,2475,1,0,0,0,2486,
	2487,1,0,0,0,2487,2488,1,0,0,0,2488,2489,5,6,0,0,2489,2490,5,54,0,0,2490,
	2523,1,0,0,0,2491,2492,10,26,0,0,2492,2493,5,12,0,0,2493,2495,3,14,7,0,
	2494,2496,3,234,117,0,2495,2494,1,0,0,0,2495,2496,1,0,0,0,2496,2497,1,0,
	0,0,2497,2498,3,230,115,0,2498,2523,1,0,0,0,2499,2500,10,25,0,0,2500,2501,
	5,68,0,0,2501,2502,3,242,121,0,2502,2503,5,69,0,0,2503,2504,3,230,115,0,
	2504,2523,1,0,0,0,2505,2506,10,24,0,0,2506,2523,3,244,122,0,2507,2508,10,
	23,0,0,2508,2523,7,10,0,0,2509,2510,10,9,0,0,2510,2511,5,133,0,0,2511,2514,
	3,242,121,0,2512,2513,7,9,0,0,2513,2515,3,118,59,0,2514,2512,1,0,0,0,2514,
	2515,1,0,0,0,2515,2516,1,0,0,0,2516,2517,5,111,0,0,2517,2520,3,242,121,
	0,2518,2519,7,9,0,0,2519,2521,3,118,59,0,2520,2518,1,0,0,0,2520,2521,1,
	0,0,0,2521,2523,1,0,0,0,2522,2386,1,0,0,0,2522,2389,1,0,0,0,2522,2392,1,
	0,0,0,2522,2395,1,0,0,0,2522,2398,1,0,0,0,2522,2401,1,0,0,0,2522,2404,1,
	0,0,0,2522,2407,1,0,0,0,2522,2410,1,0,0,0,2522,2413,1,0,0,0,2522,2416,1,
	0,0,0,2522,2419,1,0,0,0,2522,2429,1,0,0,0,2522,2433,1,0,0,0,2522,2438,1,
	0,0,0,2522,2440,1,0,0,0,2522,2446,1,0,0,0,2522,2454,1,0,0,0,2522,2467,1,
	0,0,0,2522,2491,1,0,0,0,2522,2499,1,0,0,0,2522,2505,1,0,0,0,2522,2507,1,
	0,0,0,2522,2509,1,0,0,0,2523,2526,1,0,0,0,2524,2522,1,0,0,0,2524,2525,1,
	0,0,0,2525,243,1,0,0,0,2526,2524,1,0,0,0,2527,2528,5,12,0,0,2528,2543,5,
	180,0,0,2529,2530,5,12,0,0,2530,2543,5,109,0,0,2531,2543,5,163,0,0,2532,
	2543,5,172,0,0,2533,2543,5,173,0,0,2534,2543,5,174,0,0,2535,2543,5,175,
	0,0,2536,2543,5,176,0,0,2537,2543,5,177,0,0,2538,2543,5,178,0,0,2539,2543,
	5,179,0,0,2540,2543,5,170,0,0,2541,2543,5,171,0,0,2542,2527,1,0,0,0,2542,
	2529,1,0,0,0,2542,2531,1,0,0,0,2542,2532,1,0,0,0,2542,2533,1,0,0,0,2542,
	2534,1,0,0,0,2542,2535,1,0,0,0,2542,2536,1,0,0,0,2542,2537,1,0,0,0,2542,
	2538,1,0,0,0,2542,2539,1,0,0,0,2542,2540,1,0,0,0,2542,2541,1,0,0,0,2543,
	245,1,0,0,0,2544,2545,7,23,0,0,2545,247,1,0,0,0,2546,2547,7,24,0,0,2547,
	249,1,0,0,0,2548,2563,5,141,0,0,2549,2563,3,252,126,0,2550,2563,3,254,127,
	0,2551,2555,5,151,0,0,2552,2554,5,151,0,0,2553,2552,1,0,0,0,2554,2557,1,
	0,0,0,2555,2553,1,0,0,0,2555,2556,1,0,0,0,2556,2563,1,0,0,0,2557,2555,1,
	0,0,0,2558,2563,5,161,0,0,2559,2563,5,162,0,0,2560,2563,5,152,0,0,2561,
	2563,5,153,0,0,2562,2548,1,0,0,0,2562,2549,1,0,0,0,2562,2550,1,0,0,0,2562,
	2551,1,0,0,0,2562,2558,1,0,0,0,2562,2559,1,0,0,0,2562,2560,1,0,0,0,2562,
	2561,1,0,0,0,2563,251,1,0,0,0,2564,2566,5,145,0,0,2565,2567,7,25,0,0,2566,
	2565,1,0,0,0,2566,2567,1,0,0,0,2567,253,1,0,0,0,2568,2570,5,144,0,0,2569,
	2571,7,25,0,0,2570,2569,1,0,0,0,2570,2571,1,0,0,0,2571,255,1,0,0,0,2572,
	2573,5,109,0,0,2573,2635,5,63,0,0,2574,2635,5,109,0,0,2575,2635,5,146,0,
	0,2576,2635,5,147,0,0,2577,2635,5,149,0,0,2578,2635,5,148,0,0,2579,2635,
	5,156,0,0,2580,2635,5,157,0,0,2581,2635,5,138,0,0,2582,2635,5,139,0,0,2583,
	2635,5,158,0,0,2584,2635,5,159,0,0,2585,2586,5,7,0,0,2586,2601,5,53,0,0,
	2587,2589,3,256,128,0,2588,2590,3,248,124,0,2589,2588,1,0,0,0,2589,2590,
	1,0,0,0,2590,2598,1,0,0,0,2591,2592,5,5,0,0,2592,2594,3,256,128,0,2593,
	2595,3,248,124,0,2594,2593,1,0,0,0,2594,2595,1,0,0,0,2595,2597,1,0,0,0,
	2596,2591,1,0,0,0,2597,2600,1,0,0,0,2598,2596,1,0,0,0,2598,2599,1,0,0,0,
	2599,2602,1,0,0,0,2600,2598,1,0,0,0,2601,2587,1,0,0,0,2601,2602,1,0,0,0,
	2602,2603,1,0,0,0,2603,2607,5,54,0,0,2604,2606,7,26,0,0,2605,2604,1,0,0,
	0,2606,2609,1,0,0,0,2607,2605,1,0,0,0,2607,2608,1,0,0,0,2608,2628,1,0,0,
	0,2609,2607,1,0,0,0,2610,2611,5,75,0,0,2611,2612,5,53,0,0,2612,2614,3,256,
	128,0,2613,2615,3,248,124,0,2614,2613,1,0,0,0,2614,2615,1,0,0,0,2615,2623,
	1,0,0,0,2616,2617,5,5,0,0,2617,2619,3,256,128,0,2618,2620,3,248,124,0,2619,
	2618,1,0,0,0,2619,2620,1,0,0,0,2620,2622,1,0,0,0,2621,2616,1,0,0,0,2622,
	2625,1,0,0,0,2623,2621,1,0,0,0,2623,2624,1,0,0,0,2624,2626,1,0,0,0,2625,
	2623,1,0,0,0,2626,2627,5,54,0,0,2627,2629,1,0,0,0,2628,2610,1,0,0,0,2628,
	2629,1,0,0,0,2629,2635,1,0,0,0,2630,2631,5,180,0,0,2631,2632,5,12,0,0,2632,
	2635,5,180,0,0,2633,2635,5,180,0,0,2634,2572,1,0,0,0,2634,2574,1,0,0,0,
	2634,2575,1,0,0,0,2634,2576,1,0,0,0,2634,2577,1,0,0,0,2634,2578,1,0,0,0,
	2634,2579,1,0,0,0,2634,2580,1,0,0,0,2634,2581,1,0,0,0,2634,2582,1,0,0,0,
	2634,2583,1,0,0,0,2634,2584,1,0,0,0,2634,2585,1,0,0,0,2634,2630,1,0,0,0,
	2634,2633,1,0,0,0,2635,257,1,0,0,0,2636,2637,7,27,0,0,2637,259,1,0,0,0,
	306,263,269,283,285,305,309,316,321,329,333,339,351,354,364,368,376,379,
	383,388,392,408,412,419,422,425,439,442,454,456,471,486,490,506,508,514,
	519,527,530,547,549,556,563,565,569,581,585,587,591,597,600,603,613,617,
	619,626,630,632,640,647,660,664,671,691,697,703,709,716,726,733,739,743,
	749,757,765,772,779,786,791,799,806,813,820,825,827,831,837,842,844,850,
	857,859,865,867,873,878,881,887,894,900,906,910,915,923,928,936,946,951,
	955,961,968,973,979,983,985,992,997,1001,1011,1013,1017,1023,1030,1044,
	1053,1057,1063,1072,1076,1084,1088,1094,1098,1104,1108,1110,1118,1122,1124,
	1132,1136,1142,1146,1152,1156,1158,1164,1169,1175,1203,1222,1224,1232,1246,
	1248,1253,1264,1271,1291,1303,1307,1312,1324,1333,1337,1339,1348,1353,1359,
	1370,1372,1380,1389,1391,1399,1405,1409,1419,1431,1441,1452,1464,1478,1487,
	1493,1502,1514,1516,1520,1542,1554,1564,1572,1582,1585,1594,1604,1616,1624,
	1669,1678,1684,1699,1709,1714,1719,1722,1739,1749,1754,1756,1778,1786,1790,
	1798,1816,1824,1829,1836,1851,1854,1857,1880,1883,1892,1895,1902,1911,1914,
	1924,1926,1936,1949,1953,1963,1971,1977,1983,1992,1996,1998,2004,2012,2016,
	2018,2021,2035,2041,2050,2054,2056,2066,2081,2091,2099,2103,2105,2123,2127,
	2129,2143,2155,2159,2161,2168,2176,2180,2194,2198,2204,2230,2238,2251,2258,
	2263,2347,2351,2353,2375,2384,2422,2426,2460,2471,2480,2484,2486,2495,2514,
	2520,2522,2524,2542,2555,2562,2566,2570,2589,2594,2598,2601,2607,2614,2619,
	2623,2628,2634];

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
	public callArgument_list(): CallArgumentContext[] {
		return this.getTypedRuleContexts(CallArgumentContext) as CallArgumentContext[];
	}
	public callArgument(i: number): CallArgumentContext {
		return this.getTypedRuleContext(CallArgumentContext, i) as CallArgumentContext;
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


export class CallArgumentContext extends ParserRuleContext {
	public _aop!: Token;
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
    	return SolidCashParser.RULE_callArgument;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitCallArgument) {
			return visitor.visitCallArgument(this);
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
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
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
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
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
