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
	public static readonly RULE_experimentalStdImport = 3;
	public static readonly RULE_freeFunctionDefinition = 4;
	public static readonly RULE_usingForDirective = 5;
	public static readonly RULE_usingFunctionBinding = 6;
	public static readonly RULE_userDefinableOperator = 7;
	public static readonly RULE_anyIdentifier = 8;
	public static readonly RULE_functionName = 9;
	public static readonly RULE_pragmaDirective = 10;
	public static readonly RULE_pragmaName = 11;
	public static readonly RULE_pragmaValue = 12;
	public static readonly RULE_versionAlternative = 13;
	public static readonly RULE_versionConstraint = 14;
	public static readonly RULE_versionOperator = 15;
	public static readonly RULE_interfaceDefinition = 16;
	public static readonly RULE_interfaceCollection = 17;
	public static readonly RULE_interfaceStateVariable = 18;
	public static readonly RULE_interfaceStateVariableVisibility = 19;
	public static readonly RULE_interfaceFunction = 20;
	public static readonly RULE_interfaceFallbackDefinition = 21;
	public static readonly RULE_libraryDefinition = 22;
	public static readonly RULE_contractDefinition = 23;
	public static readonly RULE_inheritanceSpecifier = 24;
	public static readonly RULE_abstractFunctionDefinition = 25;
	public static readonly RULE_eventDefinition = 26;
	public static readonly RULE_eventParameter = 27;
	public static readonly RULE_errorDefinition = 28;
	public static readonly RULE_errorParameter = 29;
	public static readonly RULE_structDefinition = 30;
	public static readonly RULE_structField = 31;
	public static readonly RULE_enumDefinition = 32;
	public static readonly RULE_enumMember = 33;
	public static readonly RULE_typeDefinition = 34;
	public static readonly RULE_constantDefinition = 35;
	public static readonly RULE_constructorDefinition = 36;
	public static readonly RULE_fallbackDefinition = 37;
	public static readonly RULE_fallbackModifier = 38;
	public static readonly RULE_receiveDefinition = 39;
	public static readonly RULE_receiveModifier = 40;
	public static readonly RULE_parentInvocation = 41;
	public static readonly RULE_stateVariableDeclaration = 42;
	public static readonly RULE_collectionModifier = 43;
	public static readonly RULE_stateVariableVisibility = 44;
	public static readonly RULE_mappingType = 45;
	public static readonly RULE_arrayType = 46;
	public static readonly RULE_modifierDefinition = 47;
	public static readonly RULE_modifierStatement = 48;
	public static readonly RULE_placeholderStatement = 49;
	public static readonly RULE_functionDefinition = 50;
	public static readonly RULE_customModifierInvocation = 51;
	public static readonly RULE_functionModifier = 52;
	public static readonly RULE_overrideSpecifier = 53;
	public static readonly RULE_unsafeModifier = 54;
	public static readonly RULE_returnType = 55;
	public static readonly RULE_returnParam = 56;
	public static readonly RULE_parameterList = 57;
	public static readonly RULE_parameter = 58;
	public static readonly RULE_block = 59;
	public static readonly RULE_blockStatement = 60;
	public static readonly RULE_statement = 61;
	public static readonly RULE_primitiveTypeReferenceStatement = 62;
	public static readonly RULE_userDefinedArrayTypeReferenceStatement = 63;
	public static readonly RULE_elementaryTypeToken = 64;
	public static readonly RULE_bareTypeExpressionStatement = 65;
	public static readonly RULE_bareCallOptionsStatement = 66;
	public static readonly RULE_callOptionsFunctionMember = 67;
	public static readonly RULE_bareNewWithOptionsStatement = 68;
	public static readonly RULE_parenthesizedArrayPopStatement = 69;
	public static readonly RULE_expressionStatement = 70;
	public static readonly RULE_assignChain = 71;
	public static readonly RULE_prefixIncDecStatement = 72;
	public static readonly RULE_returnStatement = 73;
	public static readonly RULE_selfdestructStatement = 74;
	public static readonly RULE_emitStatement = 75;
	public static readonly RULE_variableDefinition = 76;
	public static readonly RULE_tupleAssignment = 77;
	public static readonly RULE_nestedTupleAssignment = 78;
	public static readonly RULE_nestedTuplePattern = 79;
	public static readonly RULE_nestedTuplePatternItem = 80;
	public static readonly RULE_tupleSlot = 81;
	public static readonly RULE_pushArgument = 82;
	public static readonly RULE_deleteStatement = 83;
	public static readonly RULE_timeOpStatement = 84;
	public static readonly RULE_requireStatement = 85;
	public static readonly RULE_ifStatement = 86;
	public static readonly RULE_loopStatement = 87;
	public static readonly RULE_forOfEntriesStatement = 88;
	public static readonly RULE_forInStatement = 89;
	public static readonly RULE_forOfStatement = 90;
	public static readonly RULE_forStatement = 91;
	public static readonly RULE_forInit = 92;
	public static readonly RULE_forCondition = 93;
	public static readonly RULE_forUpdate = 94;
	public static readonly RULE_doWhileStatement = 95;
	public static readonly RULE_whileStatement = 96;
	public static readonly RULE_consoleStatement = 97;
	public static readonly RULE_assemblyStatement = 98;
	public static readonly RULE_yulBlock = 99;
	public static readonly RULE_yulStatement = 100;
	public static readonly RULE_yulVariableDeclaration = 101;
	public static readonly RULE_yulAssignment = 102;
	public static readonly RULE_yulIf = 103;
	public static readonly RULE_yulSwitch = 104;
	public static readonly RULE_yulCase = 105;
	public static readonly RULE_yulDefault = 106;
	public static readonly RULE_yulForLoop = 107;
	public static readonly RULE_yulFunctionDefinition = 108;
	public static readonly RULE_yulExpression = 109;
	public static readonly RULE_yulFunctionCall = 110;
	public static readonly RULE_yulFunctionName = 111;
	public static readonly RULE_yulPath = 112;
	public static readonly RULE_yulLiteral = 113;
	public static readonly RULE_uncheckedStatement = 114;
	public static readonly RULE_switchStatement = 115;
	public static readonly RULE_switchCase = 116;
	public static readonly RULE_switchDefault = 117;
	public static readonly RULE_tryCatchStatement = 118;
	public static readonly RULE_tryReturns = 119;
	public static readonly RULE_catchClause = 120;
	public static readonly RULE_breakStatement = 121;
	public static readonly RULE_continueStatement = 122;
	public static readonly RULE_requireMessage = 123;
	public static readonly RULE_revertStatement = 124;
	public static readonly RULE_assertStatement = 125;
	public static readonly RULE_consoleParameter = 126;
	public static readonly RULE_consoleParameterList = 127;
	public static readonly RULE_functionCall = 128;
	public static readonly RULE_namedArg = 129;
	public static readonly RULE_expressionList = 130;
	public static readonly RULE_callArgument = 131;
	public static readonly RULE_callOptions = 132;
	public static readonly RULE_callOption = 133;
	public static readonly RULE_typeList = 134;
	public static readonly RULE_typeListItem = 135;
	public static readonly RULE_expression = 136;
	public static readonly RULE_typeIntrospectionBase = 137;
	public static readonly RULE_abiEncodeCallArguments = 138;
	public static readonly RULE_bareAbiFunctionReferenceStatement = 139;
	public static readonly RULE_memberName = 140;
	public static readonly RULE_modifier = 141;
	public static readonly RULE_dataLocation = 142;
	public static readonly RULE_literal = 143;
	public static readonly RULE_numberLiteral = 144;
	public static readonly RULE_decimalLiteral = 145;
	public static readonly RULE_typeName = 146;
	public static readonly RULE_functionTypeParameter = 147;
	public static readonly RULE_functionTypeReturnParameter = 148;
	public static readonly RULE_typeCast = 149;
	public static readonly RULE_arrayCastType = 150;
	public static readonly literalNames: (string | null)[] = [ null, "'import'",
                                                            "';'", "'as'",
                                                            "'{'", "','",
                                                            "'}'", "'.'",
                                                            "'*'", "'function'",
                                                            "'using'", "'for'",
                                                            "'global'",
                                                            "'+'", "'-'",
                                                            "'/'", "'%'",
                                                            "'**'", "'=='",
                                                            "'!='", "'<'",
                                                            "'<='", "'>'",
                                                            "'>='", "'&'",
                                                            "'|'", "'^'",
                                                            "'~'", "'delegate'",
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
                                                            "'require'",
                                                            "'this'", "'_'",
                                                            "'pragma'",
                                                            "'solidity'",
                                                            "'solidcash'",
                                                            "'||'", "'='",
                                                            "'interface'",
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
                                                            "'pure'", "'view'",
                                                            "'override'",
                                                            "'returns'",
                                                            "'fixed'", "'ufixed'",
                                                            "'address'",
                                                            "'new'", "'+='",
                                                            "'-='", "'*='",
                                                            "'/='", "'%='",
                                                            "'&='", "'|='",
                                                            "'^='", "'<<='",
                                                            "'>>='", "'++'",
                                                            "'--'", "'return'",
                                                            "'emit'", "'delete'",
                                                            "'if'", "'else'",
                                                            "'of'", "'in'",
                                                            "'do'", "'while'",
                                                            "'console.log'",
                                                            "'assembly'",
                                                            "'break'", "'continue'",
                                                            "'let'", "':='",
                                                            "'switch'",
                                                            "'case'", "'default'",
                                                            "'->'", "'unchecked'",
                                                            "':'", "'try'",
                                                            "'catch'", "'assert'",
                                                            "'abi.encode'",
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
                                                            "'?'", "'memory'",
                                                            "'calldata'",
                                                            "'storage'",
                                                            "'immutable'",
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
		"sourceFile", "importDirective", "importBinding", "experimentalStdImport",
		"freeFunctionDefinition", "usingForDirective", "usingFunctionBinding",
		"userDefinableOperator", "anyIdentifier", "functionName", "pragmaDirective",
		"pragmaName", "pragmaValue", "versionAlternative", "versionConstraint",
		"versionOperator", "interfaceDefinition", "interfaceCollection", "interfaceStateVariable",
		"interfaceStateVariableVisibility", "interfaceFunction", "interfaceFallbackDefinition",
		"libraryDefinition", "contractDefinition", "inheritanceSpecifier", "abstractFunctionDefinition",
		"eventDefinition", "eventParameter", "errorDefinition", "errorParameter",
		"structDefinition", "structField", "enumDefinition", "enumMember", "typeDefinition",
		"constantDefinition", "constructorDefinition", "fallbackDefinition", "fallbackModifier",
		"receiveDefinition", "receiveModifier", "parentInvocation", "stateVariableDeclaration",
		"collectionModifier", "stateVariableVisibility", "mappingType", "arrayType",
		"modifierDefinition", "modifierStatement", "placeholderStatement", "functionDefinition",
		"customModifierInvocation", "functionModifier", "overrideSpecifier", "unsafeModifier",
		"returnType", "returnParam", "parameterList", "parameter", "block", "blockStatement",
		"statement", "primitiveTypeReferenceStatement", "userDefinedArrayTypeReferenceStatement",
		"elementaryTypeToken", "bareTypeExpressionStatement", "bareCallOptionsStatement",
		"callOptionsFunctionMember", "bareNewWithOptionsStatement", "parenthesizedArrayPopStatement",
		"expressionStatement", "assignChain", "prefixIncDecStatement", "returnStatement",
		"selfdestructStatement", "emitStatement", "variableDefinition", "tupleAssignment",
		"nestedTupleAssignment", "nestedTuplePattern", "nestedTuplePatternItem",
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
		"callArgument", "callOptions", "callOption", "typeList", "typeListItem",
		"expression", "typeIntrospectionBase", "abiEncodeCallArguments", "bareAbiFunctionReferenceStatement",
		"memberName", "modifier", "dataLocation", "literal", "numberLiteral",
		"decimalLiteral", "typeName", "functionTypeParameter", "functionTypeReturnParameter",
		"typeCast", "arrayCastType",
	];
	public get grammarFileName(): string { return "SolidCash.g4"; }
	public get literalNames(): (string | null)[] { return SolidCashParser.literalNames; }
	public get symbolicNames(): (string | null)[] { return SolidCashParser.symbolicNames; }
	public get ruleNames(): string[] { return SolidCashParser.ruleNames; }
	public get serializedATN(): number[] { return SolidCashParser._serializedATN; }

	protected createFailedPredicateException(predicate?: string, message?: string): FailedPredicateException {
		return new FailedPredicateException(this, predicate, message);
	}


	// Solidity lexes malformed elementary-type spellings as identifiers (`uint7`, `bytes01`, `fixed1x01`) while
	// keeping canonical forms (`uint8`, `bytes1`, `fixed8x0`) reserved. Our lexer deliberately captures the whole
	// family for useful type diagnostics, so identifier positions use this predicate to recover Solidity's split.
	isMalformedBoundedTypeName(text: string): boolean {
	  const integer = /^(u?int)([0-9]+)$/.exec(text);
	  if (integer) {
	    const width = Number(integer[2]);
	    return integer[2] !== String(width) || width < 8 || width > 256 || width % 8 !== 0;
	  }
	  const bytes = /^bytes([0-9]+)$/.exec(text);
	  if (bytes) {
	    const width = Number(bytes[1]);
	    return bytes[1] !== String(width) || width < 1 || width > 32;
	  }
	  const fixed = /^(u?fixed)([0-9]+)x([0-9]+)$/.exec(text);
	  if (fixed) {
	    const width = Number(fixed[2]);
	    const decimals = Number(fixed[3]);
	    return fixed[2] !== String(width) || fixed[3] !== String(decimals)
	      || width < 8 || width > 256 || width % 8 !== 0 || decimals < 0 || decimals > 80;
	  }
	  return false;
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
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 305;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 0, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 302;
					this.pragmaDirective();
					}
					}
				}
				this.state = 307;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 0, this._ctx);
			}
			this.state = 312;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===1) {
				{
				this.state = 310;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 1, this._ctx) ) {
				case 1:
					{
					this.state = 308;
					this.importDirective();
					}
					break;
				case 2:
					{
					this.state = 309;
					this.experimentalStdImport();
					}
					break;
				}
				}
				this.state = 314;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 329;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===9 || _la===10 || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 947422209) !== 0) || ((((_la - 79)) & ~0x1F) === 0 && ((1 << (_la - 79)) & 7) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 327;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 3, this._ctx) ) {
				case 1:
					{
					this.state = 315;
					this.pragmaDirective();
					}
					break;
				case 2:
					{
					this.state = 316;
					this.constantDefinition();
					}
					break;
				case 3:
					{
					this.state = 317;
					this.enumDefinition();
					}
					break;
				case 4:
					{
					this.state = 318;
					this.structDefinition();
					}
					break;
				case 5:
					{
					this.state = 319;
					this.typeDefinition();
					}
					break;
				case 6:
					{
					this.state = 320;
					this.usingForDirective();
					}
					break;
				case 7:
					{
					this.state = 321;
					this.errorDefinition();
					}
					break;
				case 8:
					{
					this.state = 322;
					this.eventDefinition();
					}
					break;
				case 9:
					{
					this.state = 323;
					this.interfaceDefinition();
					}
					break;
				case 10:
					{
					this.state = 324;
					this.freeFunctionDefinition();
					}
					break;
				case 11:
					{
					this.state = 325;
					this.libraryDefinition();
					}
					break;
				case 12:
					{
					this.state = 326;
					this.contractDefinition();
					}
					break;
				}
				}
				this.state = 331;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 332;
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
			this.state = 360;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 7, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 334;
				this.match(SolidCashParser.T__0);
				this.state = 335;
				this.match(SolidCashParser.StringLiteral);
				this.state = 336;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 337;
				this.match(SolidCashParser.T__0);
				this.state = 338;
				this.match(SolidCashParser.StringLiteral);
				this.state = 339;
				this.match(SolidCashParser.T__2);
				this.state = 340;
				this.match(SolidCashParser.Identifier);
				this.state = 341;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 342;
				this.match(SolidCashParser.T__0);
				this.state = 343;
				this.match(SolidCashParser.T__3);
				this.state = 344;
				this.importBinding();
				this.state = 349;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 5, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 345;
						this.match(SolidCashParser.T__4);
						this.state = 346;
						this.importBinding();
						}
						}
					}
					this.state = 351;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 5, this._ctx);
				}
				this.state = 353;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 352;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 355;
				this.match(SolidCashParser.T__5);
				this.state = 356;
				this.match(SolidCashParser.Identifier);
				this.state = 357;
				this.match(SolidCashParser.StringLiteral);
				this.state = 358;
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
			this.state = 362;
			this.match(SolidCashParser.Identifier);
			this.state = 365;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 363;
				this.match(SolidCashParser.T__2);
				this.state = 364;
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
	public experimentalStdImport(): ExperimentalStdImportContext {
		let localctx: ExperimentalStdImportContext = new ExperimentalStdImportContext(this, this._ctx, this.state);
		this.enterRule(localctx, 6, SolidCashParser.RULE_experimentalStdImport);
		let _la: number;
		try {
			this.state = 412;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 12, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 367;
				this.match(SolidCashParser.T__0);
				this.state = 368;
				this.match(SolidCashParser.Identifier);
				this.state = 369;
				this.match(SolidCashParser.T__6);
				this.state = 370;
				this.match(SolidCashParser.Identifier);
				this.state = 371;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 372;
				this.match(SolidCashParser.T__0);
				this.state = 373;
				this.match(SolidCashParser.Identifier);
				this.state = 374;
				this.match(SolidCashParser.T__6);
				this.state = 375;
				this.match(SolidCashParser.Identifier);
				this.state = 376;
				this.match(SolidCashParser.T__2);
				this.state = 377;
				this.match(SolidCashParser.Identifier);
				this.state = 378;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 379;
				this.match(SolidCashParser.T__0);
				this.state = 380;
				this.match(SolidCashParser.T__7);
				this.state = 381;
				this.match(SolidCashParser.T__2);
				this.state = 382;
				this.match(SolidCashParser.Identifier);
				this.state = 383;
				this.match(SolidCashParser.Identifier);
				this.state = 384;
				this.match(SolidCashParser.Identifier);
				this.state = 385;
				this.match(SolidCashParser.T__6);
				this.state = 386;
				this.match(SolidCashParser.Identifier);
				this.state = 387;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 388;
				this.match(SolidCashParser.T__0);
				this.state = 389;
				this.match(SolidCashParser.T__3);
				this.state = 390;
				this.match(SolidCashParser.Identifier);
				this.state = 393;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===3) {
					{
					this.state = 391;
					this.match(SolidCashParser.T__2);
					this.state = 392;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 403;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 395;
					this.match(SolidCashParser.T__4);
					this.state = 396;
					this.match(SolidCashParser.Identifier);
					this.state = 399;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===3) {
						{
						this.state = 397;
						this.match(SolidCashParser.T__2);
						this.state = 398;
						this.match(SolidCashParser.Identifier);
						}
					}

					}
					}
					this.state = 405;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 406;
				this.match(SolidCashParser.T__5);
				this.state = 407;
				this.match(SolidCashParser.Identifier);
				this.state = 408;
				this.match(SolidCashParser.Identifier);
				this.state = 409;
				this.match(SolidCashParser.T__6);
				this.state = 410;
				this.match(SolidCashParser.Identifier);
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
	public freeFunctionDefinition(): FreeFunctionDefinitionContext {
		let localctx: FreeFunctionDefinitionContext = new FreeFunctionDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 8, SolidCashParser.RULE_freeFunctionDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 414;
			this.match(SolidCashParser.T__8);
			this.state = 415;
			this.functionName();
			this.state = 416;
			this.parameterList();
			this.state = 421;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026531840) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 117932035) !== 0) || _la===180) {
				{
				this.state = 419;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 28:
				case 29:
				case 30:
				case 31:
				case 51:
				case 52:
				case 66:
				case 67:
				case 68:
				case 69:
				case 75:
				case 76:
				case 77:
					{
					this.state = 417;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 418;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 423;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 425;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===78) {
				{
				this.state = 424;
				this.returnType();
				}
			}

			this.state = 427;
			this.match(SolidCashParser.T__3);
			this.state = 431;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 16, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 428;
					this.statement();
					}
					}
				}
				this.state = 433;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 16, this._ctx);
			}
			this.state = 434;
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
		this.enterRule(localctx, 10, SolidCashParser.RULE_usingForDirective);
		let _la: number;
		try {
			let _alt: number;
			this.state = 475;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 23, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 436;
				this.match(SolidCashParser.T__9);
				this.state = 437;
				this.match(SolidCashParser.Identifier);
				this.state = 438;
				this.match(SolidCashParser.T__10);
				this.state = 443;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 17, this._ctx) ) {
				case 1:
					{
					this.state = 439;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 440;
					this.mappingType();
					}
					break;
				case 3:
					{
					this.state = 441;
					this.typeName();
					}
					break;
				case 4:
					{
					this.state = 442;
					this.match(SolidCashParser.T__7);
					}
					break;
				}
				this.state = 446;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 445;
					this.match(SolidCashParser.T__11);
					}
				}

				this.state = 448;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 449;
				this.match(SolidCashParser.T__9);
				this.state = 450;
				this.match(SolidCashParser.T__3);
				this.state = 451;
				this.usingFunctionBinding();
				this.state = 456;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 19, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 452;
						this.match(SolidCashParser.T__4);
						this.state = 453;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 458;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 19, this._ctx);
				}
				this.state = 460;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 459;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 462;
				this.match(SolidCashParser.T__5);
				this.state = 463;
				this.match(SolidCashParser.T__10);
				this.state = 468;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 21, this._ctx) ) {
				case 1:
					{
					this.state = 464;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 465;
					this.mappingType();
					}
					break;
				case 3:
					{
					this.state = 466;
					this.typeName();
					}
					break;
				case 4:
					{
					this.state = 467;
					this.match(SolidCashParser.T__7);
					}
					break;
				}
				this.state = 471;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 470;
					this.match(SolidCashParser.T__11);
					}
				}

				this.state = 473;
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
		this.enterRule(localctx, 12, SolidCashParser.RULE_usingFunctionBinding);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 477;
			this.match(SolidCashParser.Identifier);
			this.state = 480;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7) {
				{
				this.state = 478;
				this.match(SolidCashParser.T__6);
				this.state = 479;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 484;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 482;
				this.match(SolidCashParser.T__2);
				this.state = 483;
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
		this.enterRule(localctx, 14, SolidCashParser.RULE_userDefinableOperator);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 486;
			_la = this._input.LA(1);
			if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 268427520) !== 0))) {
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
		this.enterRule(localctx, 16, SolidCashParser.RULE_anyIdentifier);
		let _la: number;
		try {
			this.state = 508;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 26, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 488;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 489;
				this.match(SolidCashParser.T__27);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 490;
				this.match(SolidCashParser.T__28);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 491;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 492;
				this.match(SolidCashParser.T__30);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 493;
				this.match(SolidCashParser.T__31);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 494;
				this.match(SolidCashParser.T__32);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 495;
				this.match(SolidCashParser.T__33);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 496;
				this.match(SolidCashParser.T__11);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 497;
				this.match(SolidCashParser.T__34);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 498;
				this.match(SolidCashParser.T__35);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 499;
				this.match(SolidCashParser.T__36);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 500;
				this.match(SolidCashParser.T__37);
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 501;
				this.match(SolidCashParser.T__38);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 502;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 503;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 504;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 505;
				this.match(SolidCashParser.BchUnit);
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 506;
				if (!(this.isMalformedBoundedTypeName(this._input.LT(1).text ?? ''))) {
					throw this.createFailedPredicateException("this.isMalformedBoundedTypeName(this._input.LT(1).text ?? '')");
				}
				this.state = 507;
				_la = this._input.LA(1);
				if(!(((((_la - 149)) & ~0x1F) === 0 && ((1 << (_la - 149)) & 1921) !== 0))) {
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
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public functionName(): FunctionNameContext {
		let localctx: FunctionNameContext = new FunctionNameContext(this, this._ctx, this.state);
		this.enterRule(localctx, 18, SolidCashParser.RULE_functionName);
		try {
			this.state = 513;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 27, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 510;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 511;
				this.match(SolidCashParser.T__41);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 512;
				this.match(SolidCashParser.T__42);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 20, SolidCashParser.RULE_pragmaDirective);
		let _la: number;
		try {
			this.state = 529;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 29, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 515;
				this.match(SolidCashParser.T__43);
				this.state = 516;
				this.pragmaName();
				this.state = 517;
				this.pragmaValue();
				this.state = 518;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 520;
				this.match(SolidCashParser.T__43);
				this.state = 521;
				this.match(SolidCashParser.Identifier);
				this.state = 525;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===45 || ((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 2081) !== 0) || _la===180) {
					{
					{
					this.state = 522;
					_la = this._input.LA(1);
					if(!(_la===45 || ((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 2081) !== 0) || _la===180)) {
					this._errHandler.recoverInline(this);
					}
					else {
						this._errHandler.reportMatch(this);
					    this.consume();
					}
					}
					}
					this.state = 527;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 528;
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
		this.enterRule(localctx, 22, SolidCashParser.RULE_pragmaName);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 531;
			_la = this._input.LA(1);
			if(!(_la===45 || _la===46)) {
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
		this.enterRule(localctx, 24, SolidCashParser.RULE_pragmaValue);
		let _la: number;
		try {
			this.state = 542;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 20:
			case 21:
			case 22:
			case 23:
			case 26:
			case 27:
			case 48:
			case 140:
			case 144:
			case 145:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 533;
				this.versionAlternative();
				this.state = 538;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47) {
					{
					{
					this.state = 534;
					this.match(SolidCashParser.T__46);
					this.state = 535;
					this.versionAlternative();
					}
					}
					this.state = 540;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 541;
				this.match(SolidCashParser.T__7);
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
	public versionAlternative(): VersionAlternativeContext {
		let localctx: VersionAlternativeContext = new VersionAlternativeContext(this, this._ctx, this.state);
		this.enterRule(localctx, 26, SolidCashParser.RULE_versionAlternative);
		let _la: number;
		try {
			this.state = 553;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 33, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 544;
				this.versionConstraint();
				this.state = 545;
				this.match(SolidCashParser.T__13);
				this.state = 546;
				this.versionConstraint();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 549;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 548;
					this.versionConstraint();
					}
					}
					this.state = 551;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 268435663) !== 0) || ((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 49) !== 0));
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 28, SolidCashParser.RULE_versionConstraint);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 556;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 268435663) !== 0)) {
				{
				this.state = 555;
				this.versionOperator();
				}
			}

			this.state = 558;
			_la = this._input.LA(1);
			if(!(((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 49) !== 0))) {
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
		this.enterRule(localctx, 30, SolidCashParser.RULE_versionOperator);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 560;
			_la = this._input.LA(1);
			if(!(((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 268435663) !== 0))) {
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
		this.enterRule(localctx, 32, SolidCashParser.RULE_interfaceDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 562;
			this.match(SolidCashParser.T__48);
			this.state = 563;
			this.match(SolidCashParser.Identifier);
			this.state = 573;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===50) {
				{
				this.state = 564;
				this.match(SolidCashParser.T__49);
				this.state = 565;
				this.match(SolidCashParser.Identifier);
				this.state = 570;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 566;
					this.match(SolidCashParser.T__4);
					this.state = 567;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 572;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 575;
			this.match(SolidCashParser.T__3);
			this.state = 588;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===9 || _la===10 || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 944111633) !== 0)) {
				{
				this.state = 586;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 37, this._ctx) ) {
				case 1:
					{
					this.state = 576;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 577;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 578;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 579;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 580;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 581;
					this.usingForDirective();
					}
					break;
				case 7:
					{
					this.state = 582;
					this.interfaceStateVariable();
					}
					break;
				case 8:
					{
					this.state = 583;
					this.interfaceCollection();
					}
					break;
				case 9:
					{
					this.state = 584;
					this.interfaceFunction();
					}
					break;
				case 10:
					{
					this.state = 585;
					this.interfaceFallbackDefinition();
					}
					break;
				}
				}
				this.state = 590;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 591;
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
		this.enterRule(localctx, 34, SolidCashParser.RULE_interfaceCollection);
		try {
			this.state = 603;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 39, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 593;
				this.interfaceStateVariableVisibility();
				this.state = 594;
				this.mappingType();
				this.state = 595;
				this.match(SolidCashParser.Identifier);
				this.state = 596;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 598;
				this.interfaceStateVariableVisibility();
				this.state = 599;
				this.arrayType(0);
				this.state = 600;
				this.match(SolidCashParser.Identifier);
				this.state = 601;
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
		this.enterRule(localctx, 36, SolidCashParser.RULE_interfaceStateVariable);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 605;
			this.interfaceStateVariableVisibility();
			this.state = 606;
			this.typeName();
			this.state = 607;
			this.match(SolidCashParser.Identifier);
			this.state = 608;
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
		this.enterRule(localctx, 38, SolidCashParser.RULE_interfaceStateVariableVisibility);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 610;
			_la = this._input.LA(1);
			if(!(_la===51 || _la===52)) {
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
		this.enterRule(localctx, 40, SolidCashParser.RULE_interfaceFunction);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 612;
			this.match(SolidCashParser.T__8);
			this.state = 613;
			this.functionName();
			this.state = 614;
			this.parameterList();
			this.state = 618;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026531840) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 117932035) !== 0)) {
				{
				{
				this.state = 615;
				this.functionModifier();
				}
				}
				this.state = 620;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 622;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===78) {
				{
				this.state = 621;
				this.returnType();
				}
			}

			this.state = 624;
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
	public interfaceFallbackDefinition(): InterfaceFallbackDefinitionContext {
		let localctx: InterfaceFallbackDefinitionContext = new InterfaceFallbackDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 42, SolidCashParser.RULE_interfaceFallbackDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 626;
			this.match(SolidCashParser.T__37);
			this.state = 627;
			this.parameterList();
			this.state = 631;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 67)) & ~0x1F) === 0 && ((1 << (_la - 67)) & 1027) !== 0)) {
				{
				{
				this.state = 628;
				this.fallbackModifier();
				}
				}
				this.state = 633;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 634;
			this.match(SolidCashParser.T__51);
			this.state = 638;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 67)) & ~0x1F) === 0 && ((1 << (_la - 67)) & 1027) !== 0)) {
				{
				{
				this.state = 635;
				this.fallbackModifier();
				}
				}
				this.state = 640;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 642;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===78) {
				{
				this.state = 641;
				this.returnType();
				}
			}

			this.state = 644;
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
		this.enterRule(localctx, 44, SolidCashParser.RULE_libraryDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 646;
			this.match(SolidCashParser.T__52);
			this.state = 647;
			this.match(SolidCashParser.Identifier);
			this.state = 648;
			this.match(SolidCashParser.T__3);
			this.state = 661;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 9)) & ~0x1F) === 0 && ((1 << (_la - 9)) & 2181038083) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 1888263203) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 659;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 45, this._ctx) ) {
				case 1:
					{
					this.state = 649;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 650;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 651;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 652;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 653;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 654;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 655;
					this.stateVariableDeclaration();
					}
					break;
				case 8:
					{
					this.state = 656;
					this.usingForDirective();
					}
					break;
				case 9:
					{
					this.state = 657;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 658;
					this.freeFunctionDefinition();
					}
					break;
				}
				}
				this.state = 663;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
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
	public contractDefinition(): ContractDefinitionContext {
		let localctx: ContractDefinitionContext = new ContractDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 46, SolidCashParser.RULE_contractDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 667;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===54) {
				{
				this.state = 666;
				this.match(SolidCashParser.T__53);
				}
			}

			this.state = 669;
			this.match(SolidCashParser.T__54);
			this.state = 670;
			this.anyIdentifier();
			this.state = 672;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===57) {
				{
				this.state = 671;
				this.parameterList();
				}
			}

			this.state = 683;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===50) {
				{
				this.state = 674;
				this.match(SolidCashParser.T__49);
				this.state = 675;
				this.inheritanceSpecifier();
				this.state = 680;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 676;
					this.match(SolidCashParser.T__4);
					this.state = 677;
					this.inheritanceSpecifier();
					}
					}
					this.state = 682;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 685;
			this.match(SolidCashParser.T__3);
			this.state = 702;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 9)) & ~0x1F) === 0 && ((1 << (_la - 9)) & 3791650819) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 1888279587) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 700;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 51, this._ctx) ) {
				case 1:
					{
					this.state = 686;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 687;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 688;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 689;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 690;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 691;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 692;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 693;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 694;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 695;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 696;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 697;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 698;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 699;
					this.receiveDefinition();
					}
					break;
				}
				}
				this.state = 704;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 705;
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
		this.enterRule(localctx, 48, SolidCashParser.RULE_inheritanceSpecifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 707;
			this.match(SolidCashParser.Identifier);
			this.state = 709;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===57) {
				{
				this.state = 708;
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
		this.enterRule(localctx, 50, SolidCashParser.RULE_abstractFunctionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 711;
			this.match(SolidCashParser.T__8);
			this.state = 712;
			this.functionName();
			this.state = 713;
			this.parameterList();
			this.state = 718;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026531840) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 117932035) !== 0) || _la===180) {
				{
				this.state = 716;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 28:
				case 29:
				case 30:
				case 31:
				case 51:
				case 52:
				case 66:
				case 67:
				case 68:
				case 69:
				case 75:
				case 76:
				case 77:
					{
					this.state = 714;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 715;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 720;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 722;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===78) {
				{
				this.state = 721;
				this.returnType();
				}
			}

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
	public eventDefinition(): EventDefinitionContext {
		let localctx: EventDefinitionContext = new EventDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 52, SolidCashParser.RULE_eventDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 726;
			this.match(SolidCashParser.T__55);
			this.state = 727;
			this.anyIdentifier();
			this.state = 728;
			this.match(SolidCashParser.T__56);
			this.state = 740;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===9 || _la===34 || ((((_la - 70)) & ~0x1F) === 0 && ((1 << (_la - 70)) & 3585) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 729;
				this.eventParameter();
				this.state = 734;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 57, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 730;
						this.match(SolidCashParser.T__4);
						this.state = 731;
						this.eventParameter();
						}
						}
					}
					this.state = 736;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 57, this._ctx);
				}
				this.state = 738;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 737;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 742;
			this.match(SolidCashParser.T__57);
			this.state = 744;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===59) {
				{
				this.state = 743;
				this.match(SolidCashParser.T__58);
				}
			}

			this.state = 746;
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
		this.enterRule(localctx, 54, SolidCashParser.RULE_eventParameter);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 750;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 61, this._ctx) ) {
			case 1:
				{
				this.state = 748;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 749;
				this.arrayType(0);
				}
				break;
			}
			this.state = 753;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 62, this._ctx) ) {
			case 1:
				{
				this.state = 752;
				this.match(SolidCashParser.T__59);
				}
				break;
			}
			this.state = 756;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 63, this._ctx) ) {
			case 1:
				{
				this.state = 755;
				this.anyIdentifier();
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
	public errorDefinition(): ErrorDefinitionContext {
		let localctx: ErrorDefinitionContext = new ErrorDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 56, SolidCashParser.RULE_errorDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 758;
			this.match(SolidCashParser.T__33);
			this.state = 759;
			this.anyIdentifier();
			this.state = 760;
			this.match(SolidCashParser.T__56);
			this.state = 772;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===9 || _la===34 || ((((_la - 70)) & ~0x1F) === 0 && ((1 << (_la - 70)) & 3585) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 761;
				this.errorParameter();
				this.state = 766;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 64, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 762;
						this.match(SolidCashParser.T__4);
						this.state = 763;
						this.errorParameter();
						}
						}
					}
					this.state = 768;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 64, this._ctx);
				}
				this.state = 770;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 769;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 774;
			this.match(SolidCashParser.T__57);
			this.state = 775;
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
		this.enterRule(localctx, 58, SolidCashParser.RULE_errorParameter);
		try {
			this.state = 785;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 69, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 777;
				this.typeName();
				this.state = 779;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 67, this._ctx) ) {
				case 1:
					{
					this.state = 778;
					this.anyIdentifier();
					}
					break;
				}
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 781;
				this.arrayType(0);
				this.state = 783;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 68, this._ctx) ) {
				case 1:
					{
					this.state = 782;
					this.anyIdentifier();
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
	public structDefinition(): StructDefinitionContext {
		let localctx: StructDefinitionContext = new StructDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 60, SolidCashParser.RULE_structDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 787;
			this.match(SolidCashParser.T__60);
			this.state = 788;
			this.anyIdentifier();
			this.state = 789;
			this.match(SolidCashParser.T__3);
			this.state = 791;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 790;
				this.structField();
				}
				}
				this.state = 793;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===9 || _la===34 || ((((_la - 70)) & ~0x1F) === 0 && ((1 << (_la - 70)) & 3585) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180);
			this.state = 795;
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
		this.enterRule(localctx, 62, SolidCashParser.RULE_structField);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 800;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 71, this._ctx) ) {
			case 1:
				{
				this.state = 797;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 798;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 799;
				this.mappingType();
				}
				break;
			}
			this.state = 802;
			this.anyIdentifier();
			this.state = 803;
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
		this.enterRule(localctx, 64, SolidCashParser.RULE_enumDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 805;
			this.match(SolidCashParser.T__61);
			this.state = 806;
			this.anyIdentifier();
			this.state = 807;
			this.match(SolidCashParser.T__3);
			this.state = 808;
			this.enumMember();
			this.state = 813;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 72, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 809;
					this.match(SolidCashParser.T__4);
					this.state = 810;
					this.enumMember();
					}
					}
				}
				this.state = 815;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 72, this._ctx);
			}
			this.state = 817;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 816;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 819;
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
		this.enterRule(localctx, 66, SolidCashParser.RULE_enumMember);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 821;
			this.anyIdentifier();
			this.state = 824;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===48) {
				{
				this.state = 822;
				this.match(SolidCashParser.T__47);
				this.state = 823;
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
		this.enterRule(localctx, 68, SolidCashParser.RULE_typeDefinition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 826;
			this.match(SolidCashParser.T__62);
			this.state = 827;
			this.anyIdentifier();
			this.state = 828;
			this.match(SolidCashParser.T__49);
			this.state = 829;
			this.typeName();
			this.state = 830;
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
		this.enterRule(localctx, 70, SolidCashParser.RULE_constantDefinition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 832;
			this.typeName();
			this.state = 833;
			this.match(SolidCashParser.T__63);
			this.state = 834;
			this.anyIdentifier();
			this.state = 835;
			this.match(SolidCashParser.T__47);
			this.state = 836;
			this.expression(0);
			this.state = 837;
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
		this.enterRule(localctx, 72, SolidCashParser.RULE_constructorDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 839;
			this.match(SolidCashParser.T__64);
			this.state = 840;
			this.parameterList();
			this.state = 844;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 75, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 841;
					_la = this._input.LA(1);
					if(!(((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 98307) !== 0))) {
					this._errHandler.recoverInline(this);
					}
					else {
						this._errHandler.reportMatch(this);
					    this.consume();
					}
					}
					}
				}
				this.state = 846;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 75, this._ctx);
			}
			this.state = 850;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 76, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 847;
					this.parentInvocation();
					}
					}
				}
				this.state = 852;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 76, this._ctx);
			}
			this.state = 856;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 98307) !== 0)) {
				{
				{
				this.state = 853;
				_la = this._input.LA(1);
				if(!(((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 98307) !== 0))) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				}
				this.state = 858;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 862;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 859;
				this.customModifierInvocation();
				}
				}
				this.state = 864;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 865;
			this.match(SolidCashParser.T__3);
			this.state = 869;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 79, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 866;
					this.statement();
					}
					}
				}
				this.state = 871;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 79, this._ctx);
			}
			this.state = 872;
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
		this.enterRule(localctx, 74, SolidCashParser.RULE_fallbackDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 874;
			this.match(SolidCashParser.T__37);
			this.state = 875;
			this.parameterList();
			this.state = 879;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 67)) & ~0x1F) === 0 && ((1 << (_la - 67)) & 1027) !== 0)) {
				{
				{
				this.state = 876;
				this.fallbackModifier();
				}
				}
				this.state = 881;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 882;
			this.match(SolidCashParser.T__51);
			this.state = 886;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 67)) & ~0x1F) === 0 && ((1 << (_la - 67)) & 1027) !== 0)) {
				{
				{
				this.state = 883;
				this.fallbackModifier();
				}
				}
				this.state = 888;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 892;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 889;
				this.customModifierInvocation();
				}
				}
				this.state = 894;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 896;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===78) {
				{
				this.state = 895;
				this.returnType();
				}
			}

			this.state = 898;
			this.match(SolidCashParser.T__3);
			this.state = 902;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 84, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 899;
					this.statement();
					}
					}
				}
				this.state = 904;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 84, this._ctx);
			}
			this.state = 905;
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
		this.enterRule(localctx, 76, SolidCashParser.RULE_fallbackModifier);
		try {
			this.state = 910;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 67:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 907;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 68:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 908;
				this.match(SolidCashParser.T__67);
				}
				break;
			case 77:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 909;
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
		this.enterRule(localctx, 78, SolidCashParser.RULE_receiveDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.state = 980;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 96, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 912;
				this.match(SolidCashParser.T__38);
				this.state = 913;
				this.match(SolidCashParser.T__56);
				this.state = 914;
				this.match(SolidCashParser.T__57);
				this.state = 918;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===68 || _la===77) {
					{
					{
					this.state = 915;
					this.receiveModifier();
					}
					}
					this.state = 920;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 921;
				this.match(SolidCashParser.T__51);
				this.state = 925;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===68 || _la===77) {
					{
					{
					this.state = 922;
					this.receiveModifier();
					}
					}
					this.state = 927;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 928;
				this.match(SolidCashParser.T__66);
				this.state = 932;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===68 || _la===77) {
					{
					{
					this.state = 929;
					this.receiveModifier();
					}
					}
					this.state = 934;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 944;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 4:
					{
					this.state = 935;
					this.match(SolidCashParser.T__3);
					this.state = 939;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 89, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 936;
							this.statement();
							}
							}
						}
						this.state = 941;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 89, this._ctx);
					}
					this.state = 942;
					this.match(SolidCashParser.T__5);
					}
					break;
				case 2:
					{
					this.state = 943;
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
				this.state = 946;
				this.match(SolidCashParser.T__38);
				this.state = 947;
				this.match(SolidCashParser.T__56);
				this.state = 948;
				this.match(SolidCashParser.T__57);
				this.state = 952;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===68 || _la===77) {
					{
					{
					this.state = 949;
					this.receiveModifier();
					}
					}
					this.state = 954;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 955;
				this.match(SolidCashParser.T__66);
				this.state = 959;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===68 || _la===77) {
					{
					{
					this.state = 956;
					this.receiveModifier();
					}
					}
					this.state = 961;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 962;
				this.match(SolidCashParser.T__51);
				this.state = 966;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===68 || _la===77) {
					{
					{
					this.state = 963;
					this.receiveModifier();
					}
					}
					this.state = 968;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 978;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 4:
					{
					this.state = 969;
					this.match(SolidCashParser.T__3);
					this.state = 973;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 94, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 970;
							this.statement();
							}
							}
						}
						this.state = 975;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 94, this._ctx);
					}
					this.state = 976;
					this.match(SolidCashParser.T__5);
					}
					break;
				case 2:
					{
					this.state = 977;
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
		this.enterRule(localctx, 80, SolidCashParser.RULE_receiveModifier);
		try {
			this.state = 984;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 68:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 982;
				this.match(SolidCashParser.T__67);
				}
				break;
			case 77:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 983;
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
		this.enterRule(localctx, 82, SolidCashParser.RULE_parentInvocation);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 986;
			this.match(SolidCashParser.Identifier);
			this.state = 987;
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
		this.enterRule(localctx, 84, SolidCashParser.RULE_stateVariableDeclaration);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1063;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 113, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 990;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 294915) !== 0)) {
					{
					this.state = 989;
					this.stateVariableVisibility();
					}
				}

				this.state = 992;
				this.typeName();
				this.state = 997;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 100, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						this.state = 995;
						this._errHandler.sync(this);
						switch (this._input.LA(1)) {
						case 32:
						case 36:
						case 64:
						case 136:
						case 137:
						case 138:
						case 139:
							{
							this.state = 993;
							this.modifier();
							}
							break;
						case 77:
							{
							this.state = 994;
							this.overrideSpecifier();
							}
							break;
						default:
							throw new NoViableAltException(this);
						}
						}
					}
					this.state = 999;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 100, this._ctx);
				}
				this.state = 1000;
				this.anyIdentifier();
				this.state = 1003;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1001;
					this.match(SolidCashParser.T__47);
					this.state = 1002;
					this.expression(0);
					}
				}

				this.state = 1005;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1007;
				this.typeName();
				this.state = 1012;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===32 || _la===36 || _la===64 || _la===77 || ((((_la - 136)) & ~0x1F) === 0 && ((1 << (_la - 136)) & 15) !== 0)) {
					{
					this.state = 1010;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case 32:
					case 36:
					case 64:
					case 136:
					case 137:
					case 138:
					case 139:
						{
						this.state = 1008;
						this.modifier();
						}
						break;
					case 77:
						{
						this.state = 1009;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 1014;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1015;
				this.stateVariableVisibility();
				this.state = 1020;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 105, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						this.state = 1018;
						this._errHandler.sync(this);
						switch (this._input.LA(1)) {
						case 32:
						case 36:
						case 64:
						case 136:
						case 137:
						case 138:
						case 139:
							{
							this.state = 1016;
							this.modifier();
							}
							break;
						case 77:
							{
							this.state = 1017;
							this.overrideSpecifier();
							}
							break;
						default:
							throw new NoViableAltException(this);
						}
						}
					}
					this.state = 1022;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 105, this._ctx);
				}
				this.state = 1023;
				this.anyIdentifier();
				this.state = 1026;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1024;
					this.match(SolidCashParser.T__47);
					this.state = 1025;
					this.expression(0);
					}
				}

				this.state = 1028;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1031;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 294915) !== 0)) {
					{
					this.state = 1030;
					this.stateVariableVisibility();
					}
				}

				this.state = 1034;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1033;
					this.match(SolidCashParser.T__39);
					}
				}

				this.state = 1036;
				this.mappingType();
				this.state = 1040;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 109, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1037;
						this.collectionModifier();
						}
						}
					}
					this.state = 1042;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 109, this._ctx);
				}
				this.state = 1043;
				this.anyIdentifier();
				this.state = 1044;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1047;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 294915) !== 0)) {
					{
					this.state = 1046;
					this.stateVariableVisibility();
					}
				}

				this.state = 1049;
				this.arrayType(0);
				this.state = 1053;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 111, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1050;
						this.collectionModifier();
						}
						}
					}
					this.state = 1055;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 111, this._ctx);
				}
				this.state = 1056;
				this.anyIdentifier();
				this.state = 1059;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1057;
					this.match(SolidCashParser.T__47);
					this.state = 1058;
					this.expression(0);
					}
				}

				this.state = 1061;
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
		this.enterRule(localctx, 86, SolidCashParser.RULE_collectionModifier);
		try {
			this.state = 1068;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 32:
			case 36:
			case 64:
			case 136:
			case 137:
			case 138:
			case 139:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1065;
				this.modifier();
				}
				break;
			case 51:
			case 52:
			case 66:
			case 69:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1066;
				this.stateVariableVisibility();
				}
				break;
			case 77:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1067;
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
		this.enterRule(localctx, 88, SolidCashParser.RULE_stateVariableVisibility);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1070;
			_la = this._input.LA(1);
			if(!(((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 294915) !== 0))) {
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
		this.enterRule(localctx, 90, SolidCashParser.RULE_mappingType);
		try {
			this.state = 1111;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 121, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1072;
				this.match(SolidCashParser.T__69);
				this.state = 1073;
				this.match(SolidCashParser.T__56);
				this.state = 1074;
				this.typeName();
				this.state = 1076;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 115, this._ctx) ) {
				case 1:
					{
					this.state = 1075;
					this.anyIdentifier();
					}
					break;
				}
				this.state = 1078;
				this.match(SolidCashParser.T__70);
				this.state = 1079;
				this.typeName();
				this.state = 1081;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 116, this._ctx) ) {
				case 1:
					{
					this.state = 1080;
					this.anyIdentifier();
					}
					break;
				}
				this.state = 1083;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1085;
				this.match(SolidCashParser.T__69);
				this.state = 1086;
				this.match(SolidCashParser.T__56);
				this.state = 1087;
				this.typeName();
				this.state = 1089;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 117, this._ctx) ) {
				case 1:
					{
					this.state = 1088;
					this.anyIdentifier();
					}
					break;
				}
				this.state = 1091;
				this.match(SolidCashParser.T__70);
				this.state = 1092;
				this.mappingType();
				this.state = 1094;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 118, this._ctx) ) {
				case 1:
					{
					this.state = 1093;
					this.anyIdentifier();
					}
					break;
				}
				this.state = 1096;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1098;
				this.match(SolidCashParser.T__69);
				this.state = 1099;
				this.match(SolidCashParser.T__56);
				this.state = 1100;
				this.typeName();
				this.state = 1102;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 119, this._ctx) ) {
				case 1:
					{
					this.state = 1101;
					this.anyIdentifier();
					}
					break;
				}
				this.state = 1104;
				this.match(SolidCashParser.T__70);
				this.state = 1105;
				this.arrayType(0);
				this.state = 1107;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 120, this._ctx) ) {
				case 1:
					{
					this.state = 1106;
					this.anyIdentifier();
					}
					break;
				}
				this.state = 1109;
				this.match(SolidCashParser.T__57);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
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
		let _startState: number = 92;
		this.enterRecursionRule(localctx, 92, SolidCashParser.RULE_arrayType, _p);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1128;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 9:
			case 34:
			case 79:
			case 80:
			case 81:
			case 146:
			case 147:
			case 148:
			case 149:
			case 156:
			case 157:
			case 158:
			case 159:
			case 180:
				{
				this.state = 1114;
				this.typeName();
				this.state = 1115;
				this.match(SolidCashParser.T__71);
				this.state = 1117;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 122, this._ctx) ) {
				case 1:
					{
					this.state = 1116;
					this.expression(0);
					}
					break;
				}
				this.state = 1119;
				this.match(SolidCashParser.T__72);
				}
				break;
			case 70:
				{
				this.state = 1121;
				this.mappingType();
				this.state = 1122;
				this.match(SolidCashParser.T__71);
				this.state = 1124;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 123, this._ctx) ) {
				case 1:
					{
					this.state = 1123;
					this.expression(0);
					}
					break;
				}
				this.state = 1126;
				this.match(SolidCashParser.T__72);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 1138;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 126, this._ctx);
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
					this.state = 1130;
					if (!(this.precpred(this._ctx, 1))) {
						throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
					}
					this.state = 1131;
					this.match(SolidCashParser.T__71);
					this.state = 1133;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 125, this._ctx) ) {
					case 1:
						{
						this.state = 1132;
						this.expression(0);
						}
						break;
					}
					this.state = 1135;
					this.match(SolidCashParser.T__72);
					}
					}
				}
				this.state = 1140;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 126, this._ctx);
			}
			}
		}
		catch (re) {
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
		this.enterRule(localctx, 94, SolidCashParser.RULE_modifierDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1141;
			this.match(SolidCashParser.T__73);
			this.state = 1142;
			this.match(SolidCashParser.Identifier);
			this.state = 1144;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===57) {
				{
				this.state = 1143;
				this.parameterList();
				}
			}

			this.state = 1150;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===68 || _la===77) {
				{
				this.state = 1148;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 68:
					{
					this.state = 1146;
					this.match(SolidCashParser.T__67);
					}
					break;
				case 77:
					{
					this.state = 1147;
					this.overrideSpecifier();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 1152;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1162;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				{
				this.state = 1153;
				this.match(SolidCashParser.T__3);
				this.state = 1157;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 130, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1154;
						this.modifierStatement();
						}
						}
					}
					this.state = 1159;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 130, this._ctx);
				}
				this.state = 1160;
				this.match(SolidCashParser.T__5);
				}
				break;
			case 2:
				{
				this.state = 1161;
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
		this.enterRule(localctx, 96, SolidCashParser.RULE_modifierStatement);
		try {
			this.state = 1166;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 132, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1164;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1165;
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
		this.enterRule(localctx, 98, SolidCashParser.RULE_placeholderStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1168;
			this.match(SolidCashParser.T__42);
			this.state = 1169;
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
		this.enterRule(localctx, 100, SolidCashParser.RULE_functionDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1171;
			this.match(SolidCashParser.T__8);
			this.state = 1172;
			this.functionName();
			this.state = 1173;
			this.parameterList();
			this.state = 1178;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4026531840) !== 0) || ((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 117932035) !== 0) || _la===180) {
				{
				this.state = 1176;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 28:
				case 29:
				case 30:
				case 31:
				case 51:
				case 52:
				case 66:
				case 67:
				case 68:
				case 69:
				case 75:
				case 76:
				case 77:
					{
					this.state = 1174;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 1175;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 1180;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1182;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===78) {
				{
				this.state = 1181;
				this.returnType();
				}
			}

			this.state = 1184;
			this.match(SolidCashParser.T__3);
			this.state = 1188;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 136, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1185;
					this.statement();
					}
					}
				}
				this.state = 1190;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 136, this._ctx);
			}
			this.state = 1191;
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
		this.enterRule(localctx, 102, SolidCashParser.RULE_customModifierInvocation);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1195;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 137, this._ctx) ) {
			case 1:
				{
				this.state = 1193;
				this.match(SolidCashParser.Identifier);
				this.state = 1194;
				this.match(SolidCashParser.T__6);
				}
				break;
			}
			this.state = 1197;
			this.match(SolidCashParser.Identifier);
			this.state = 1199;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===57) {
				{
				this.state = 1198;
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
		this.enterRule(localctx, 104, SolidCashParser.RULE_functionModifier);
		try {
			this.state = 1214;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 75:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1201;
				this.match(SolidCashParser.T__74);
				}
				break;
			case 76:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1202;
				this.match(SolidCashParser.T__75);
				}
				break;
			case 66:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1203;
				this.match(SolidCashParser.T__65);
				}
				break;
			case 52:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1204;
				this.match(SolidCashParser.T__51);
				}
				break;
			case 51:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1205;
				this.match(SolidCashParser.T__50);
				}
				break;
			case 69:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1206;
				this.match(SolidCashParser.T__68);
				}
				break;
			case 67:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1207;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 77:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1208;
				this.overrideSpecifier();
				}
				break;
			case 68:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1209;
				this.match(SolidCashParser.T__67);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1210;
				this.unsafeModifier();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1211;
				this.match(SolidCashParser.T__28);
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1212;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1213;
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
		this.enterRule(localctx, 106, SolidCashParser.RULE_overrideSpecifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1216;
			this.match(SolidCashParser.T__76);
			this.state = 1227;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 141, this._ctx) ) {
			case 1:
				{
				this.state = 1217;
				this.match(SolidCashParser.T__56);
				this.state = 1218;
				this.match(SolidCashParser.Identifier);
				this.state = 1223;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1219;
					this.match(SolidCashParser.T__4);
					this.state = 1220;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1225;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1226;
				this.match(SolidCashParser.T__57);
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
	public unsafeModifier(): UnsafeModifierContext {
		let localctx: UnsafeModifierContext = new UnsafeModifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 108, SolidCashParser.RULE_unsafeModifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1229;
			this.match(SolidCashParser.T__30);
			this.state = 1233;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===57) {
				{
				this.state = 1230;
				this.match(SolidCashParser.T__56);
				this.state = 1231;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1232;
				this.match(SolidCashParser.T__57);
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
		this.enterRule(localctx, 110, SolidCashParser.RULE_returnType);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1235;
			this.match(SolidCashParser.T__77);
			this.state = 1236;
			this.match(SolidCashParser.T__56);
			this.state = 1237;
			this.returnParam();
			this.state = 1242;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 143, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1238;
					this.match(SolidCashParser.T__4);
					this.state = 1239;
					this.returnParam();
					}
					}
				}
				this.state = 1244;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 143, this._ctx);
			}
			this.state = 1246;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1245;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1248;
			this.match(SolidCashParser.T__57);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 112, SolidCashParser.RULE_returnParam);
		try {
			let _alt: number;
			this.state = 1280;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 151, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1250;
				this.typeName();
				this.state = 1254;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 145, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1251;
						this.modifier();
						}
						}
					}
					this.state = 1256;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 145, this._ctx);
				}
				this.state = 1258;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 146, this._ctx) ) {
				case 1:
					{
					this.state = 1257;
					this.anyIdentifier();
					}
					break;
				}
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1260;
				this.arrayType(0);
				this.state = 1264;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 147, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1261;
						this.modifier();
						}
						}
					}
					this.state = 1266;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 147, this._ctx);
				}
				this.state = 1268;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 148, this._ctx) ) {
				case 1:
					{
					this.state = 1267;
					this.anyIdentifier();
					}
					break;
				}
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1270;
				this.mappingType();
				this.state = 1274;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 149, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1271;
						this.modifier();
						}
						}
					}
					this.state = 1276;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 149, this._ctx);
				}
				this.state = 1278;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 150, this._ctx) ) {
				case 1:
					{
					this.state = 1277;
					this.anyIdentifier();
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
	public parameterList(): ParameterListContext {
		let localctx: ParameterListContext = new ParameterListContext(this, this._ctx, this.state);
		this.enterRule(localctx, 114, SolidCashParser.RULE_parameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1282;
			this.match(SolidCashParser.T__56);
			this.state = 1294;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===9 || _la===34 || ((((_la - 70)) & ~0x1F) === 0 && ((1 << (_la - 70)) & 3585) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1283;
				this.parameter();
				this.state = 1288;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 152, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1284;
						this.match(SolidCashParser.T__4);
						this.state = 1285;
						this.parameter();
						}
						}
					}
					this.state = 1290;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 152, this._ctx);
				}
				this.state = 1292;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1291;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1296;
			this.match(SolidCashParser.T__57);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 116, SolidCashParser.RULE_parameter);
		try {
			let _alt: number;
			this.state = 1328;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 161, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1298;
				this.typeName();
				this.state = 1302;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 155, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1299;
						this.modifier();
						}
						}
					}
					this.state = 1304;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 155, this._ctx);
				}
				this.state = 1306;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 156, this._ctx) ) {
				case 1:
					{
					this.state = 1305;
					this.anyIdentifier();
					}
					break;
				}
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1308;
				this.arrayType(0);
				this.state = 1312;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 157, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1309;
						this.modifier();
						}
						}
					}
					this.state = 1314;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 157, this._ctx);
				}
				this.state = 1316;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 158, this._ctx) ) {
				case 1:
					{
					this.state = 1315;
					this.anyIdentifier();
					}
					break;
				}
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1318;
				this.mappingType();
				this.state = 1322;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 159, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1319;
						this.modifier();
						}
						}
					}
					this.state = 1324;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 159, this._ctx);
				}
				this.state = 1326;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 160, this._ctx) ) {
				case 1:
					{
					this.state = 1325;
					this.anyIdentifier();
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
	public block(): BlockContext {
		let localctx: BlockContext = new BlockContext(this, this._ctx, this.state);
		this.enterRule(localctx, 118, SolidCashParser.RULE_block);
		try {
			let _alt: number;
			this.state = 1339;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 163, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1330;
				this.match(SolidCashParser.T__3);
				this.state = 1334;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 162, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1331;
						this.statement();
						}
						}
					}
					this.state = 1336;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 162, this._ctx);
				}
				this.state = 1337;
				this.match(SolidCashParser.T__5);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1338;
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
		this.enterRule(localctx, 120, SolidCashParser.RULE_blockStatement);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1341;
			this.match(SolidCashParser.T__3);
			this.state = 1345;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 164, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1342;
					this.statement();
					}
					}
				}
				this.state = 1347;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 164, this._ctx);
			}
			this.state = 1348;
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
		this.enterRule(localctx, 122, SolidCashParser.RULE_statement);
		try {
			this.state = 1381;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 165, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1350;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1351;
				this.blockStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1352;
				this.bareTypeExpressionStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1353;
				this.primitiveTypeReferenceStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1354;
				this.userDefinedArrayTypeReferenceStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1355;
				this.variableDefinition();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1356;
				this.nestedTupleAssignment();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1357;
				this.tupleAssignment();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1358;
				this.prefixIncDecStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1359;
				this.timeOpStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1360;
				this.requireStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1361;
				this.ifStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1362;
				this.loopStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1363;
				this.consoleStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1364;
				this.emitStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1365;
				this.returnStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1366;
				this.selfdestructStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1367;
				this.assemblyStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1368;
				this.tryCatchStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1369;
				this.revertStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1370;
				this.assertStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1371;
				this.deleteStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1372;
				this.uncheckedStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1373;
				this.switchStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1374;
				this.breakStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1375;
				this.continueStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1376;
				this.bareAbiFunctionReferenceStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1377;
				this.bareCallOptionsStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1378;
				this.bareNewWithOptionsStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1379;
				this.parenthesizedArrayPopStatement();
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 31);
				{
				this.state = 1380;
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
	public primitiveTypeReferenceStatement(): PrimitiveTypeReferenceStatementContext {
		let localctx: PrimitiveTypeReferenceStatementContext = new PrimitiveTypeReferenceStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 124, SolidCashParser.RULE_primitiveTypeReferenceStatement);
		let _la: number;
		try {
			this.state = 1410;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 79:
			case 80:
			case 81:
			case 146:
			case 147:
			case 148:
			case 149:
			case 156:
			case 157:
			case 158:
			case 159:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1383;
				this.elementaryTypeToken();
				this.state = 1391;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===72) {
					{
					{
					this.state = 1384;
					this.match(SolidCashParser.T__71);
					this.state = 1386;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 166, this._ctx) ) {
					case 1:
						{
						this.state = 1385;
						this.expression(0);
						}
						break;
					}
					this.state = 1388;
					this.match(SolidCashParser.T__72);
					}
					}
					this.state = 1393;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1394;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 57:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1396;
				this.match(SolidCashParser.T__56);
				this.state = 1397;
				this.elementaryTypeToken();
				this.state = 1403;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1398;
					this.match(SolidCashParser.T__71);
					this.state = 1400;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 168, this._ctx) ) {
					case 1:
						{
						this.state = 1399;
						this.expression(0);
						}
						break;
					}
					this.state = 1402;
					this.match(SolidCashParser.T__72);
					}
					}
					this.state = 1405;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===72);
				this.state = 1407;
				this.match(SolidCashParser.T__57);
				this.state = 1408;
				this.match(SolidCashParser.T__1);
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
	public userDefinedArrayTypeReferenceStatement(): UserDefinedArrayTypeReferenceStatementContext {
		let localctx: UserDefinedArrayTypeReferenceStatementContext = new UserDefinedArrayTypeReferenceStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 126, SolidCashParser.RULE_userDefinedArrayTypeReferenceStatement);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1412;
			this.match(SolidCashParser.Identifier);
			this.state = 1420;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 172, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1413;
					this.match(SolidCashParser.T__71);
					this.state = 1415;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 171, this._ctx) ) {
					case 1:
						{
						this.state = 1414;
						this.expression(0);
						}
						break;
					}
					this.state = 1417;
					this.match(SolidCashParser.T__72);
					}
					}
				}
				this.state = 1422;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 172, this._ctx);
			}
			this.state = 1423;
			this.match(SolidCashParser.T__71);
			this.state = 1424;
			this.match(SolidCashParser.T__72);
			this.state = 1432;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===72) {
				{
				{
				this.state = 1425;
				this.match(SolidCashParser.T__71);
				this.state = 1427;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 173, this._ctx) ) {
				case 1:
					{
					this.state = 1426;
					this.expression(0);
					}
					break;
				}
				this.state = 1429;
				this.match(SolidCashParser.T__72);
				}
				}
				this.state = 1434;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1435;
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
	public elementaryTypeToken(): ElementaryTypeTokenContext {
		let localctx: ElementaryTypeTokenContext = new ElementaryTypeTokenContext(this, this._ctx, this.state);
		this.enterRule(localctx, 128, SolidCashParser.RULE_elementaryTypeToken);
		let _la: number;
		try {
			this.state = 1451;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 146:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1437;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 147:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1438;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 149:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1439;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 148:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1440;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 156:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1441;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 157:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1442;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 158:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1443;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 159:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1444;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 79:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1445;
				this.match(SolidCashParser.T__78);
				}
				break;
			case 80:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1446;
				this.match(SolidCashParser.T__79);
				}
				break;
			case 81:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1447;
				this.match(SolidCashParser.T__80);
				this.state = 1449;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===67) {
					{
					this.state = 1448;
					this.match(SolidCashParser.T__66);
					}
				}

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
	public bareTypeExpressionStatement(): BareTypeExpressionStatementContext {
		let localctx: BareTypeExpressionStatementContext = new BareTypeExpressionStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 130, SolidCashParser.RULE_bareTypeExpressionStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1453;
			this.match(SolidCashParser.T__62);
			this.state = 1454;
			this.match(SolidCashParser.T__56);
			this.state = 1455;
			this.typeName();
			this.state = 1456;
			this.match(SolidCashParser.T__57);
			this.state = 1457;
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
	public bareCallOptionsStatement(): BareCallOptionsStatementContext {
		let localctx: BareCallOptionsStatementContext = new BareCallOptionsStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 132, SolidCashParser.RULE_bareCallOptionsStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1459;
			this.expression(0);
			this.state = 1460;
			this.match(SolidCashParser.T__6);
			this.state = 1461;
			this.match(SolidCashParser.Identifier);
			this.state = 1462;
			this.callOptions();
			this.state = 1464;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7) {
				{
				this.state = 1463;
				this.callOptionsFunctionMember();
				}
			}

			this.state = 1466;
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
	public callOptionsFunctionMember(): CallOptionsFunctionMemberContext {
		let localctx: CallOptionsFunctionMemberContext = new CallOptionsFunctionMemberContext(this, this._ctx, this.state);
		this.enterRule(localctx, 134, SolidCashParser.RULE_callOptionsFunctionMember);
		try {
			this.state = 1472;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 178, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1468;
				this.match(SolidCashParser.T__6);
				this.state = 1469;
				this.match(SolidCashParser.T__80);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1470;
				this.match(SolidCashParser.T__6);
				this.state = 1471;
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
	public bareNewWithOptionsStatement(): BareNewWithOptionsStatementContext {
		let localctx: BareNewWithOptionsStatementContext = new BareNewWithOptionsStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 136, SolidCashParser.RULE_bareNewWithOptionsStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1474;
			this.match(SolidCashParser.T__81);
			this.state = 1475;
			this.match(SolidCashParser.Identifier);
			this.state = 1476;
			this.callOptions();
			this.state = 1477;
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
	public parenthesizedArrayPopStatement(): ParenthesizedArrayPopStatementContext {
		let localctx: ParenthesizedArrayPopStatementContext = new ParenthesizedArrayPopStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 138, SolidCashParser.RULE_parenthesizedArrayPopStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1479;
			this.match(SolidCashParser.T__56);
			this.state = 1482;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 1480;
				this.match(SolidCashParser.T__41);
				this.state = 1481;
				this.match(SolidCashParser.T__6);
				}
			}

			this.state = 1484;
			this.match(SolidCashParser.Identifier);
			this.state = 1485;
			this.match(SolidCashParser.DotPop);
			this.state = 1486;
			this.match(SolidCashParser.T__57);
			this.state = 1487;
			this.match(SolidCashParser.T__56);
			this.state = 1488;
			this.match(SolidCashParser.T__57);
			this.state = 1489;
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
	public expressionStatement(): ExpressionStatementContext {
		let localctx: ExpressionStatementContext = new ExpressionStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 140, SolidCashParser.RULE_expressionStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1491;
			this.expression(0);
			this.state = 1572;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 187, this._ctx) ) {
			case 1:
				{
				this.state = 1492;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===48 || ((((_la - 83)) & ~0x1F) === 0 && ((1 << (_la - 83)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1493;
				this.assignChain();
				}
				break;
			case 2:
				{
				this.state = 1494;
				this.match(SolidCashParser.DotPush);
				this.state = 1495;
				this.match(SolidCashParser.T__56);
				this.state = 1496;
				this.match(SolidCashParser.T__57);
				this.state = 1497;
				localctx._second = this.match(SolidCashParser.DotPush);
				this.state = 1498;
				this.match(SolidCashParser.T__56);
				this.state = 1499;
				this.match(SolidCashParser.T__57);
				this.state = 1500;
				localctx._third = this.match(SolidCashParser.DotPush);
				this.state = 1501;
				this.match(SolidCashParser.T__56);
				this.state = 1502;
				this.match(SolidCashParser.T__57);
				this.state = 1505;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1503;
					this.match(SolidCashParser.T__47);
					this.state = 1504;
					this.expression(0);
					}
				}

				}
				break;
			case 3:
				{
				this.state = 1507;
				this.match(SolidCashParser.DotPush);
				this.state = 1508;
				this.match(SolidCashParser.T__56);
				this.state = 1509;
				this.match(SolidCashParser.T__57);
				this.state = 1510;
				localctx._second = this.match(SolidCashParser.DotPush);
				this.state = 1511;
				this.match(SolidCashParser.T__56);
				this.state = 1512;
				this.match(SolidCashParser.T__57);
				this.state = 1513;
				this.match(SolidCashParser.T__47);
				this.state = 1514;
				this.expression(0);
				this.state = 1523;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===165) {
					{
					this.state = 1515;
					localctx._rhsPush = this.match(SolidCashParser.DotPush);
					this.state = 1516;
					this.match(SolidCashParser.T__56);
					this.state = 1517;
					this.match(SolidCashParser.T__57);
					this.state = 1521;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===165) {
						{
						this.state = 1518;
						localctx._rhsPush2 = this.match(SolidCashParser.DotPush);
						this.state = 1519;
						this.match(SolidCashParser.T__56);
						this.state = 1520;
						this.match(SolidCashParser.T__57);
						}
					}

					}
				}

				}
				break;
			case 4:
				{
				this.state = 1525;
				this.match(SolidCashParser.DotPush);
				this.state = 1526;
				this.match(SolidCashParser.T__56);
				this.state = 1527;
				this.match(SolidCashParser.T__57);
				this.state = 1528;
				localctx._second = this.match(SolidCashParser.DotPush);
				this.state = 1529;
				this.match(SolidCashParser.T__56);
				this.state = 1531;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 183, this._ctx) ) {
				case 1:
					{
					this.state = 1530;
					this.pushArgument();
					}
					break;
				}
				this.state = 1533;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 5:
				{
				this.state = 1534;
				this.match(SolidCashParser.DotPush);
				this.state = 1535;
				this.match(SolidCashParser.T__56);
				this.state = 1536;
				this.match(SolidCashParser.T__57);
				this.state = 1537;
				this.match(SolidCashParser.T__6);
				this.state = 1538;
				localctx._pushField = this.anyIdentifier();
				this.state = 1539;
				this.match(SolidCashParser.T__47);
				this.state = 1540;
				this.expression(0);
				}
				break;
			case 6:
				{
				this.state = 1542;
				this.match(SolidCashParser.DotPush);
				this.state = 1543;
				this.match(SolidCashParser.T__56);
				this.state = 1544;
				this.match(SolidCashParser.T__57);
				this.state = 1545;
				localctx._pushAssignOp = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===48 || ((((_la - 83)) & ~0x1F) === 0 && ((1 << (_la - 83)) & 1023) !== 0))) {
				    localctx._pushAssignOp = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1546;
				this.expression(0);
				this.state = 1555;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===165) {
					{
					this.state = 1547;
					localctx._rhsPush = this.match(SolidCashParser.DotPush);
					this.state = 1548;
					this.match(SolidCashParser.T__56);
					this.state = 1549;
					this.match(SolidCashParser.T__57);
					this.state = 1553;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===165) {
						{
						this.state = 1550;
						localctx._rhsPush2 = this.match(SolidCashParser.DotPush);
						this.state = 1551;
						this.match(SolidCashParser.T__56);
						this.state = 1552;
						this.match(SolidCashParser.T__57);
						}
					}

					}
				}

				}
				break;
			case 7:
				{
				this.state = 1557;
				this.match(SolidCashParser.DotPush);
				this.state = 1558;
				this.match(SolidCashParser.T__56);
				this.state = 1560;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 186, this._ctx) ) {
				case 1:
					{
					this.state = 1559;
					this.pushArgument();
					}
					break;
				}
				this.state = 1562;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 8:
				{
				this.state = 1563;
				this.match(SolidCashParser.DotPop);
				this.state = 1564;
				this.match(SolidCashParser.T__56);
				this.state = 1565;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 9:
				{
				this.state = 1566;
				this.match(SolidCashParser.DotDelete);
				this.state = 1567;
				this.match(SolidCashParser.T__56);
				this.state = 1568;
				this.expression(0);
				this.state = 1569;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 10:
				{
				this.state = 1571;
				localctx._bareMember = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 165)) & ~0x1F) === 0 && ((1 << (_la - 165)) & 19) !== 0))) {
				    localctx._bareMember = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				break;
			}
			this.state = 1574;
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
		this.enterRule(localctx, 142, SolidCashParser.RULE_assignChain);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1576;
			this.expression(0);
			this.state = 1579;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 188, this._ctx) ) {
			case 1:
				{
				this.state = 1577;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===48 || ((((_la - 83)) & ~0x1F) === 0 && ((1 << (_la - 83)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1578;
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
		this.enterRule(localctx, 144, SolidCashParser.RULE_prefixIncDecStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1581;
			localctx._op = this._input.LT(1);
			_la = this._input.LA(1);
			if(!(_la===93 || _la===94)) {
			    localctx._op = this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			this.state = 1582;
			this.expression(0);
			this.state = 1583;
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
		this.enterRule(localctx, 146, SolidCashParser.RULE_returnStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1620;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 192, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1585;
				this.match(SolidCashParser.T__94);
				this.state = 1586;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1587;
				this.match(SolidCashParser.T__94);
				this.state = 1588;
				this.expression(0);
				this.state = 1589;
				localctx._rop = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===48 || ((((_la - 83)) & ~0x1F) === 0 && ((1 << (_la - 83)) & 1023) !== 0))) {
				    localctx._rop = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1590;
				this.assignChain();
				this.state = 1591;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1593;
				this.match(SolidCashParser.T__94);
				this.state = 1594;
				this.expression(0);
				this.state = 1599;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1595;
					this.match(SolidCashParser.T__4);
					this.state = 1596;
					this.expression(0);
					}
					}
					this.state = 1601;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1602;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1604;
				this.match(SolidCashParser.T__94);
				this.state = 1605;
				this.match(SolidCashParser.T__56);
				this.state = 1606;
				this.expression(0);
				this.state = 1611;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 190, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1607;
						this.match(SolidCashParser.T__4);
						this.state = 1608;
						this.expression(0);
						}
						}
					}
					this.state = 1613;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 190, this._ctx);
				}
				this.state = 1615;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1614;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1617;
				this.match(SolidCashParser.T__57);
				this.state = 1618;
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
		this.enterRule(localctx, 148, SolidCashParser.RULE_selfdestructStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1622;
			this.match(SolidCashParser.T__29);
			this.state = 1623;
			this.match(SolidCashParser.T__56);
			this.state = 1624;
			this.expression(0);
			this.state = 1625;
			this.match(SolidCashParser.T__57);
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
	public emitStatement(): EmitStatementContext {
		let localctx: EmitStatementContext = new EmitStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 150, SolidCashParser.RULE_emitStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1661;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 198, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1628;
				this.match(SolidCashParser.T__95);
				this.state = 1629;
				this.match(SolidCashParser.Identifier);
				this.state = 1632;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7) {
					{
					this.state = 1630;
					this.match(SolidCashParser.T__6);
					this.state = 1631;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1634;
				this.match(SolidCashParser.T__56);
				this.state = 1635;
				this.match(SolidCashParser.T__3);
				this.state = 1647;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1636;
					this.namedArg();
					this.state = 1641;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 194, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1637;
							this.match(SolidCashParser.T__4);
							this.state = 1638;
							this.namedArg();
							}
							}
						}
						this.state = 1643;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 194, this._ctx);
					}
					this.state = 1645;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1644;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1649;
				this.match(SolidCashParser.T__5);
				this.state = 1650;
				this.match(SolidCashParser.T__57);
				this.state = 1651;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1652;
				this.match(SolidCashParser.T__95);
				this.state = 1653;
				this.match(SolidCashParser.Identifier);
				this.state = 1656;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7) {
					{
					this.state = 1654;
					this.match(SolidCashParser.T__6);
					this.state = 1655;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1658;
				this.expressionList();
				this.state = 1659;
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
		this.enterRule(localctx, 152, SolidCashParser.RULE_variableDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1717;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 207, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1663;
				this.typeName();
				this.state = 1667;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 199, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1664;
						this.modifier();
						}
						}
					}
					this.state = 1669;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 199, this._ctx);
				}
				this.state = 1670;
				this.anyIdentifier();
				this.state = 1680;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1671;
					this.match(SolidCashParser.T__47);
					this.state = 1672;
					this.expression(0);
					this.state = 1678;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case 48:
					case 83:
					case 84:
					case 85:
					case 86:
					case 87:
					case 88:
					case 89:
					case 90:
					case 91:
					case 92:
						{
						this.state = 1673;
						localctx._iop = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===48 || ((((_la - 83)) & ~0x1F) === 0 && ((1 << (_la - 83)) & 1023) !== 0))) {
						    localctx._iop = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1674;
						this.assignChain();
						}
						break;
					case 165:
						{
						this.state = 1675;
						this.match(SolidCashParser.DotPush);
						this.state = 1676;
						this.match(SolidCashParser.T__56);
						this.state = 1677;
						this.match(SolidCashParser.T__57);
						}
						break;
					case 2:
						break;
					default:
						break;
					}
					}
				}

				this.state = 1682;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1684;
				this.arrayType(0);
				this.state = 1688;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 202, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1685;
						this.modifier();
						}
						}
					}
					this.state = 1690;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 202, this._ctx);
				}
				this.state = 1691;
				this.anyIdentifier();
				this.state = 1699;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1692;
					this.match(SolidCashParser.T__47);
					this.state = 1693;
					this.expression(0);
					this.state = 1697;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===165) {
						{
						this.state = 1694;
						this.match(SolidCashParser.DotPush);
						this.state = 1695;
						this.match(SolidCashParser.T__56);
						this.state = 1696;
						this.match(SolidCashParser.T__57);
						}
					}

					}
				}

				this.state = 1701;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1703;
				this.mappingType();
				this.state = 1707;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 205, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1704;
						this.modifier();
						}
						}
					}
					this.state = 1709;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 205, this._ctx);
				}
				this.state = 1710;
				this.anyIdentifier();
				this.state = 1713;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1711;
					this.match(SolidCashParser.T__47);
					this.state = 1712;
					this.expression(0);
					}
				}

				this.state = 1715;
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
		this.enterRule(localctx, 154, SolidCashParser.RULE_tupleAssignment);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1795;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 214, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1719;
				this.typeName();
				this.state = 1720;
				this.match(SolidCashParser.Identifier);
				this.state = 1725;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1721;
					this.match(SolidCashParser.T__4);
					this.state = 1722;
					this.typeName();
					this.state = 1723;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1727;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1729;
				this.match(SolidCashParser.T__47);
				this.state = 1730;
				this.expression(0);
				this.state = 1731;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1733;
				this.match(SolidCashParser.T__56);
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
				this.match(SolidCashParser.T__57);
				this.state = 1742;
				this.match(SolidCashParser.T__47);
				this.state = 1743;
				this.match(SolidCashParser.T__56);
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
				this.match(SolidCashParser.T__57);
				this.state = 1752;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1754;
				this.match(SolidCashParser.T__56);
				this.state = 1755;
				this.tupleSlot();
				this.state = 1758;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1756;
					this.match(SolidCashParser.T__4);
					this.state = 1757;
					this.tupleSlot();
					}
					}
					this.state = 1760;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1762;
				this.match(SolidCashParser.T__57);
				this.state = 1763;
				this.match(SolidCashParser.T__47);
				this.state = 1764;
				this.expression(0);
				this.state = 1765;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1767;
				this.match(SolidCashParser.T__56);
				this.state = 1768;
				this.typeName();
				this.state = 1772;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 212, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1769;
						this.modifier();
						}
						}
					}
					this.state = 1774;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 212, this._ctx);
				}
				this.state = 1775;
				this.anyIdentifier();
				this.state = 1776;
				this.match(SolidCashParser.T__57);
				this.state = 1777;
				this.match(SolidCashParser.T__47);
				this.state = 1778;
				this.expression(0);
				this.state = 1779;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1781;
				this.match(SolidCashParser.T__56);
				this.state = 1782;
				this.arrayType(0);
				this.state = 1786;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 213, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1783;
						this.modifier();
						}
						}
					}
					this.state = 1788;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 213, this._ctx);
				}
				this.state = 1789;
				this.anyIdentifier();
				this.state = 1790;
				this.match(SolidCashParser.T__57);
				this.state = 1791;
				this.match(SolidCashParser.T__47);
				this.state = 1792;
				this.expression(0);
				this.state = 1793;
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
	public nestedTupleAssignment(): NestedTupleAssignmentContext {
		let localctx: NestedTupleAssignmentContext = new NestedTupleAssignmentContext(this, this._ctx, this.state);
		this.enterRule(localctx, 156, SolidCashParser.RULE_nestedTupleAssignment);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1797;
			if (!(this._input.LT(1).text === '(' && this._input.LT(2).text === '(')) {
				throw this.createFailedPredicateException("this._input.LT(1).text === '(' && this._input.LT(2).text === '('");
			}
			this.state = 1798;
			this.nestedTuplePattern();
			this.state = 1799;
			this.match(SolidCashParser.T__47);
			this.state = 1800;
			this.expression(0);
			this.state = 1801;
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
	public nestedTuplePattern(): NestedTuplePatternContext {
		let localctx: NestedTuplePatternContext = new NestedTuplePatternContext(this, this._ctx, this.state);
		this.enterRule(localctx, 158, SolidCashParser.RULE_nestedTuplePattern);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1803;
			this.match(SolidCashParser.T__56);
			this.state = 1805;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 215, this._ctx) ) {
			case 1:
				{
				this.state = 1804;
				this.nestedTuplePatternItem();
				}
				break;
			}
			this.state = 1813;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1807;
				this.match(SolidCashParser.T__4);
				this.state = 1809;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 216, this._ctx) ) {
				case 1:
					{
					this.state = 1808;
					this.nestedTuplePatternItem();
					}
					break;
				}
				}
				}
				this.state = 1815;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1816;
			this.match(SolidCashParser.T__57);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public nestedTuplePatternItem(): NestedTuplePatternItemContext {
		let localctx: NestedTuplePatternItemContext = new NestedTuplePatternItemContext(this, this._ctx, this.state);
		this.enterRule(localctx, 160, SolidCashParser.RULE_nestedTuplePatternItem);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1849;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 222, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1818;
				this.typeName();
				this.state = 1822;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 218, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1819;
						this.modifier();
						}
						}
					}
					this.state = 1824;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 218, this._ctx);
				}
				this.state = 1825;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1827;
				this.arrayType(0);
				this.state = 1831;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 219, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1828;
						this.modifier();
						}
						}
					}
					this.state = 1833;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 219, this._ctx);
				}
				this.state = 1834;
				this.anyIdentifier();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1836;
				this.anyIdentifier();
				this.state = 1845;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===7 || _la===72) {
					{
					this.state = 1843;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case 72:
						{
						this.state = 1837;
						this.match(SolidCashParser.T__71);
						this.state = 1838;
						this.expression(0);
						this.state = 1839;
						this.match(SolidCashParser.T__72);
						}
						break;
					case 7:
						{
						this.state = 1841;
						this.match(SolidCashParser.T__6);
						this.state = 1842;
						this.anyIdentifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 1847;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1848;
				this.nestedTuplePattern();
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 162, SolidCashParser.RULE_tupleSlot);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1882;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 227, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1851;
				this.typeName();
				this.state = 1855;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 223, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1852;
						this.modifier();
						}
						}
					}
					this.state = 1857;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 223, this._ctx);
				}
				this.state = 1858;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1860;
				this.arrayType(0);
				this.state = 1864;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 224, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1861;
						this.modifier();
						}
						}
					}
					this.state = 1866;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 224, this._ctx);
				}
				this.state = 1867;
				this.anyIdentifier();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1869;
				this.anyIdentifier();
				this.state = 1878;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===7 || _la===72) {
					{
					this.state = 1876;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case 72:
						{
						this.state = 1870;
						this.match(SolidCashParser.T__71);
						this.state = 1871;
						this.expression(0);
						this.state = 1872;
						this.match(SolidCashParser.T__72);
						}
						break;
					case 7:
						{
						this.state = 1874;
						this.match(SolidCashParser.T__6);
						this.state = 1875;
						this.anyIdentifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 1880;
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
		this.enterRule(localctx, 164, SolidCashParser.RULE_pushArgument);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1884;
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
		this.enterRule(localctx, 166, SolidCashParser.RULE_deleteStatement);
		let _la: number;
		try {
			this.state = 1980;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 236, this._ctx) ) {
			case 1:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1886;
				this.match(SolidCashParser.T__96);
				this.state = 1887;
				this.match(SolidCashParser.Identifier);
				this.state = 1888;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteParenthesizedContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1889;
				this.match(SolidCashParser.T__96);
				this.state = 1890;
				this.match(SolidCashParser.T__56);
				this.state = 1891;
				this.expression(0);
				this.state = 1892;
				this.match(SolidCashParser.T__57);
				this.state = 1893;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1895;
				this.match(SolidCashParser.T__96);
				this.state = 1896;
				this.match(SolidCashParser.T__41);
				this.state = 1897;
				this.match(SolidCashParser.T__6);
				this.state = 1898;
				this.match(SolidCashParser.Identifier);
				this.state = 1899;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1900;
				this.match(SolidCashParser.T__96);
				this.state = 1901;
				this.match(SolidCashParser.T__41);
				this.state = 1902;
				this.match(SolidCashParser.T__6);
				this.state = 1903;
				this.match(SolidCashParser.Identifier);
				this.state = 1908;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1904;
					this.match(SolidCashParser.T__71);
					this.state = 1905;
					this.expression(0);
					this.state = 1906;
					this.match(SolidCashParser.T__72);
					}
					}
					this.state = 1910;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===72);
				this.state = 1912;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				localctx = new DeleteDeepMemberEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1914;
				this.match(SolidCashParser.T__96);
				this.state = 1915;
				this.match(SolidCashParser.Identifier);
				this.state = 1920;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1916;
					this.match(SolidCashParser.T__71);
					this.state = 1917;
					this.expression(0);
					this.state = 1918;
					this.match(SolidCashParser.T__72);
					}
					}
					this.state = 1922;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===72);
				this.state = 1935;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1924;
					this.match(SolidCashParser.T__6);
					this.state = 1925;
					this.match(SolidCashParser.Identifier);
					this.state = 1932;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===72) {
						{
						{
						this.state = 1926;
						this.match(SolidCashParser.T__71);
						this.state = 1927;
						this.expression(0);
						this.state = 1928;
						this.match(SolidCashParser.T__72);
						}
						}
						this.state = 1934;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
					}
					this.state = 1937;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===7);
				this.state = 1939;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 6:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1941;
				this.match(SolidCashParser.T__96);
				this.state = 1942;
				this.match(SolidCashParser.Identifier);
				this.state = 1947;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1943;
					this.match(SolidCashParser.T__71);
					this.state = 1944;
					this.expression(0);
					this.state = 1945;
					this.match(SolidCashParser.T__72);
					}
					}
					this.state = 1949;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===72);
				this.state = 1951;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 7:
				localctx = new DeleteMemberEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1953;
				this.match(SolidCashParser.T__96);
				this.state = 1954;
				this.match(SolidCashParser.Identifier);
				this.state = 1957;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1955;
					this.match(SolidCashParser.T__6);
					this.state = 1956;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1959;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===7);
				this.state = 1965;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1961;
					this.match(SolidCashParser.T__71);
					this.state = 1962;
					this.expression(0);
					this.state = 1963;
					this.match(SolidCashParser.T__72);
					}
					}
					this.state = 1967;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===72);
				this.state = 1969;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 8:
				localctx = new DeleteMemberContext(this, localctx);
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1971;
				this.match(SolidCashParser.T__96);
				this.state = 1972;
				this.match(SolidCashParser.Identifier);
				this.state = 1975;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1973;
					this.match(SolidCashParser.T__6);
					this.state = 1974;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1977;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===7);
				this.state = 1979;
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
		this.enterRule(localctx, 168, SolidCashParser.RULE_timeOpStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1982;
			this.match(SolidCashParser.T__40);
			this.state = 1983;
			this.match(SolidCashParser.T__56);
			this.state = 1984;
			this.match(SolidCashParser.TxVar);
			this.state = 1985;
			this.match(SolidCashParser.T__22);
			this.state = 1986;
			this.expression(0);
			this.state = 1989;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1987;
				this.match(SolidCashParser.T__4);
				this.state = 1988;
				this.requireMessage();
				}
			}

			this.state = 1991;
			this.match(SolidCashParser.T__57);
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
	public requireStatement(): RequireStatementContext {
		let localctx: RequireStatementContext = new RequireStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 170, SolidCashParser.RULE_requireStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1994;
			this.match(SolidCashParser.T__40);
			this.state = 1995;
			this.match(SolidCashParser.T__56);
			this.state = 1996;
			this.expression(0);
			this.state = 1999;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1997;
				this.match(SolidCashParser.T__4);
				this.state = 1998;
				this.requireMessage();
				}
			}

			this.state = 2001;
			this.match(SolidCashParser.T__57);
			this.state = 2002;
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
		this.enterRule(localctx, 172, SolidCashParser.RULE_ifStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2004;
			this.match(SolidCashParser.T__97);
			this.state = 2005;
			this.match(SolidCashParser.T__56);
			this.state = 2006;
			this.expression(0);
			this.state = 2007;
			this.match(SolidCashParser.T__57);
			this.state = 2008;
			localctx._ifBlock = this.block();
			this.state = 2011;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 239, this._ctx) ) {
			case 1:
				{
				this.state = 2009;
				this.match(SolidCashParser.T__98);
				this.state = 2010;
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
		this.enterRule(localctx, 174, SolidCashParser.RULE_loopStatement);
		try {
			this.state = 2019;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 240, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2013;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2014;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2015;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2016;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2017;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2018;
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
		this.enterRule(localctx, 176, SolidCashParser.RULE_forOfEntriesStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2021;
			this.match(SolidCashParser.T__10);
			this.state = 2022;
			this.match(SolidCashParser.T__56);
			this.state = 2023;
			this.typeName();
			this.state = 2024;
			this.match(SolidCashParser.Identifier);
			this.state = 2025;
			this.match(SolidCashParser.T__4);
			this.state = 2026;
			this.typeName();
			this.state = 2027;
			this.match(SolidCashParser.Identifier);
			this.state = 2028;
			this.match(SolidCashParser.T__99);
			this.state = 2029;
			this.match(SolidCashParser.T__41);
			this.state = 2030;
			this.match(SolidCashParser.T__6);
			this.state = 2031;
			this.match(SolidCashParser.Identifier);
			this.state = 2032;
			this.match(SolidCashParser.T__6);
			this.state = 2033;
			this.match(SolidCashParser.T__32);
			this.state = 2034;
			this.match(SolidCashParser.T__57);
			this.state = 2035;
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
		this.enterRule(localctx, 178, SolidCashParser.RULE_forInStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2037;
			this.match(SolidCashParser.T__10);
			this.state = 2038;
			this.match(SolidCashParser.T__56);
			this.state = 2039;
			this.typeName();
			this.state = 2040;
			this.match(SolidCashParser.Identifier);
			this.state = 2041;
			this.match(SolidCashParser.T__100);
			this.state = 2042;
			this.match(SolidCashParser.T__41);
			this.state = 2043;
			this.match(SolidCashParser.T__6);
			this.state = 2044;
			this.match(SolidCashParser.Identifier);
			this.state = 2045;
			this.match(SolidCashParser.T__57);
			this.state = 2046;
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
		this.enterRule(localctx, 180, SolidCashParser.RULE_forOfStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2048;
			this.match(SolidCashParser.T__10);
			this.state = 2049;
			this.match(SolidCashParser.T__56);
			this.state = 2050;
			this.typeName();
			this.state = 2051;
			this.match(SolidCashParser.Identifier);
			this.state = 2052;
			this.match(SolidCashParser.T__99);
			this.state = 2053;
			this.match(SolidCashParser.T__41);
			this.state = 2054;
			this.match(SolidCashParser.T__6);
			this.state = 2055;
			this.match(SolidCashParser.Identifier);
			this.state = 2056;
			this.match(SolidCashParser.T__57);
			this.state = 2057;
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
		this.enterRule(localctx, 182, SolidCashParser.RULE_forStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2059;
			this.match(SolidCashParser.T__10);
			this.state = 2060;
			this.match(SolidCashParser.T__56);
			this.state = 2061;
			this.forInit();
			this.state = 2062;
			this.forCondition();
			this.state = 2064;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 241, this._ctx) ) {
			case 1:
				{
				this.state = 2063;
				this.forUpdate();
				}
				break;
			}
			this.state = 2066;
			this.match(SolidCashParser.T__57);
			this.state = 2067;
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
		this.enterRule(localctx, 184, SolidCashParser.RULE_forInit);
		let _la: number;
		try {
			this.state = 2114;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 247, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2069;
				this.typeName();
				this.state = 2073;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===32 || _la===36 || _la===64 || ((((_la - 136)) & ~0x1F) === 0 && ((1 << (_la - 136)) & 15) !== 0)) {
					{
					{
					this.state = 2070;
					this.modifier();
					}
					}
					this.state = 2075;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 2076;
				this.match(SolidCashParser.Identifier);
				this.state = 2079;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 2077;
					this.match(SolidCashParser.T__47);
					this.state = 2078;
					this.expression(0);
					}
				}

				this.state = 2081;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2083;
				this.match(SolidCashParser.Identifier);
				this.state = 2084;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===48 || ((((_la - 83)) & ~0x1F) === 0 && ((1 << (_la - 83)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2085;
				this.expression(0);
				this.state = 2086;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2088;
				this.match(SolidCashParser.T__56);
				this.state = 2089;
				this.tupleSlot();
				this.state = 2092;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2090;
					this.match(SolidCashParser.T__4);
					this.state = 2091;
					this.tupleSlot();
					}
					}
					this.state = 2094;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2096;
				this.match(SolidCashParser.T__57);
				this.state = 2097;
				this.match(SolidCashParser.T__47);
				this.state = 2109;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 246, this._ctx) ) {
				case 1:
					{
					this.state = 2098;
					this.match(SolidCashParser.T__56);
					this.state = 2099;
					this.expression(0);
					this.state = 2102;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 2100;
						this.match(SolidCashParser.T__4);
						this.state = 2101;
						this.expression(0);
						}
						}
						this.state = 2104;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===5);
					this.state = 2106;
					this.match(SolidCashParser.T__57);
					}
					break;
				case 2:
					{
					this.state = 2108;
					this.expression(0);
					}
					break;
				}
				this.state = 2111;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2113;
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
		this.enterRule(localctx, 186, SolidCashParser.RULE_forCondition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2117;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 248, this._ctx) ) {
			case 1:
				{
				this.state = 2116;
				this.expression(0);
				}
				break;
			}
			this.state = 2119;
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
		this.enterRule(localctx, 188, SolidCashParser.RULE_forUpdate);
		let _la: number;
		try {
			this.state = 2152;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 252, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2121;
				this.match(SolidCashParser.Identifier);
				this.state = 2122;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===48 || ((((_la - 83)) & ~0x1F) === 0 && ((1 << (_la - 83)) & 1023) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2123;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2124;
				this.match(SolidCashParser.Identifier);
				this.state = 2125;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===93 || _la===94)) {
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
				this.state = 2126;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===93 || _la===94)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2127;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2128;
				this.match(SolidCashParser.T__56);
				this.state = 2129;
				this.tupleSlot();
				this.state = 2132;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2130;
					this.match(SolidCashParser.T__4);
					this.state = 2131;
					this.tupleSlot();
					}
					}
					this.state = 2134;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2136;
				this.match(SolidCashParser.T__57);
				this.state = 2137;
				this.match(SolidCashParser.T__47);
				this.state = 2149;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 251, this._ctx) ) {
				case 1:
					{
					this.state = 2138;
					this.match(SolidCashParser.T__56);
					this.state = 2139;
					this.expression(0);
					this.state = 2142;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 2140;
						this.match(SolidCashParser.T__4);
						this.state = 2141;
						this.expression(0);
						}
						}
						this.state = 2144;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===5);
					this.state = 2146;
					this.match(SolidCashParser.T__57);
					}
					break;
				case 2:
					{
					this.state = 2148;
					this.expression(0);
					}
					break;
				}
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2151;
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
	public doWhileStatement(): DoWhileStatementContext {
		let localctx: DoWhileStatementContext = new DoWhileStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 190, SolidCashParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2154;
			this.match(SolidCashParser.T__101);
			this.state = 2155;
			this.block();
			this.state = 2156;
			this.match(SolidCashParser.T__102);
			this.state = 2157;
			this.match(SolidCashParser.T__56);
			this.state = 2158;
			this.expression(0);
			this.state = 2159;
			this.match(SolidCashParser.T__57);
			this.state = 2160;
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
		this.enterRule(localctx, 192, SolidCashParser.RULE_whileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2162;
			this.match(SolidCashParser.T__102);
			this.state = 2163;
			this.match(SolidCashParser.T__56);
			this.state = 2164;
			this.expression(0);
			this.state = 2165;
			this.match(SolidCashParser.T__57);
			this.state = 2166;
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
		this.enterRule(localctx, 194, SolidCashParser.RULE_consoleStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2168;
			this.match(SolidCashParser.T__103);
			this.state = 2169;
			this.consoleParameterList();
			this.state = 2170;
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
		this.enterRule(localctx, 196, SolidCashParser.RULE_assemblyStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2172;
			this.match(SolidCashParser.T__104);
			this.state = 2174;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===151) {
				{
				this.state = 2173;
				this.match(SolidCashParser.StringLiteral);
				}
			}

			this.state = 2186;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===57) {
				{
				this.state = 2176;
				this.match(SolidCashParser.T__56);
				this.state = 2177;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2182;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 2178;
					this.match(SolidCashParser.T__4);
					this.state = 2179;
					this.match(SolidCashParser.StringLiteral);
					}
					}
					this.state = 2184;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 2185;
				this.match(SolidCashParser.T__57);
				}
			}

			this.state = 2188;
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
		this.enterRule(localctx, 198, SolidCashParser.RULE_yulBlock);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2190;
			this.match(SolidCashParser.T__3);
			this.state = 2194;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 256, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2191;
					this.yulStatement();
					}
					}
				}
				this.state = 2196;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 256, this._ctx);
			}
			this.state = 2197;
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
		this.enterRule(localctx, 200, SolidCashParser.RULE_yulStatement);
		try {
			this.state = 2212;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 257, this._ctx) ) {
			case 1:
				localctx = new YulNestedBlockStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2199;
				this.yulBlock();
				}
				break;
			case 2:
				localctx = new YulVarDeclStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2200;
				this.yulVariableDeclaration();
				}
				break;
			case 3:
				localctx = new YulAssignStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2201;
				this.yulAssignment();
				}
				break;
			case 4:
				localctx = new YulIfStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2202;
				this.yulIf();
				}
				break;
			case 5:
				localctx = new YulSwitchStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2203;
				this.yulSwitch();
				}
				break;
			case 6:
				localctx = new YulForStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2204;
				this.yulForLoop();
				}
				break;
			case 7:
				localctx = new YulFunctionDefStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2205;
				this.yulFunctionDefinition();
				}
				break;
			case 8:
				localctx = new YulBreakStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2206;
				this.match(SolidCashParser.T__105);
				}
				break;
			case 9:
				localctx = new YulContinueStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2207;
				this.match(SolidCashParser.T__106);
				}
				break;
			case 10:
				localctx = new YulLeaveStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2208;
				this.match(SolidCashParser.T__36);
				}
				break;
			case 11:
				localctx = new YulCallStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2209;
				this.yulFunctionCall();
				}
				break;
			case 12:
				localctx = new YulPathStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2210;
				this.yulPath();
				}
				break;
			case 13:
				localctx = new YulLiteralStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2211;
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
		this.enterRule(localctx, 202, SolidCashParser.RULE_yulVariableDeclaration);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2214;
			this.match(SolidCashParser.T__107);
			this.state = 2215;
			this.anyIdentifier();
			this.state = 2220;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 258, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2216;
					this.match(SolidCashParser.T__4);
					this.state = 2217;
					this.anyIdentifier();
					}
					}
				}
				this.state = 2222;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 258, this._ctx);
			}
			this.state = 2225;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 259, this._ctx) ) {
			case 1:
				{
				this.state = 2223;
				this.match(SolidCashParser.T__108);
				this.state = 2224;
				this.yulExpression();
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
	public yulAssignment(): YulAssignmentContext {
		let localctx: YulAssignmentContext = new YulAssignmentContext(this, this._ctx, this.state);
		this.enterRule(localctx, 204, SolidCashParser.RULE_yulAssignment);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2227;
			this.yulPath();
			this.state = 2232;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 2228;
				this.match(SolidCashParser.T__4);
				this.state = 2229;
				this.yulPath();
				}
				}
				this.state = 2234;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 2235;
			this.match(SolidCashParser.T__108);
			this.state = 2236;
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
		this.enterRule(localctx, 206, SolidCashParser.RULE_yulIf);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2238;
			this.match(SolidCashParser.T__97);
			this.state = 2239;
			this.yulExpression();
			this.state = 2240;
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
		this.enterRule(localctx, 208, SolidCashParser.RULE_yulSwitch);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2242;
			this.match(SolidCashParser.T__109);
			this.state = 2243;
			this.yulExpression();
			this.state = 2253;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 111:
				{
				this.state = 2245;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2244;
						this.yulCase();
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2247;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 261, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				this.state = 2250;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 262, this._ctx) ) {
				case 1:
					{
					this.state = 2249;
					this.yulDefault();
					}
					break;
				}
				}
				break;
			case 112:
				{
				this.state = 2252;
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
		this.enterRule(localctx, 210, SolidCashParser.RULE_yulCase);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2255;
			this.match(SolidCashParser.T__110);
			this.state = 2256;
			this.yulLiteral();
			this.state = 2257;
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
		this.enterRule(localctx, 212, SolidCashParser.RULE_yulDefault);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2259;
			this.match(SolidCashParser.T__111);
			this.state = 2260;
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
		this.enterRule(localctx, 214, SolidCashParser.RULE_yulForLoop);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2262;
			this.match(SolidCashParser.T__10);
			this.state = 2263;
			this.yulBlock();
			this.state = 2264;
			this.yulExpression();
			this.state = 2265;
			this.yulBlock();
			this.state = 2266;
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
		this.enterRule(localctx, 216, SolidCashParser.RULE_yulFunctionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2268;
			this.match(SolidCashParser.T__8);
			this.state = 2269;
			this.match(SolidCashParser.Identifier);
			this.state = 2270;
			this.match(SolidCashParser.T__56);
			this.state = 2279;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===180) {
				{
				this.state = 2271;
				this.match(SolidCashParser.Identifier);
				this.state = 2276;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 2272;
					this.match(SolidCashParser.T__4);
					this.state = 2273;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 2278;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 2281;
			this.match(SolidCashParser.T__57);
			this.state = 2291;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===113) {
				{
				this.state = 2282;
				this.match(SolidCashParser.T__112);
				this.state = 2283;
				this.match(SolidCashParser.Identifier);
				this.state = 2288;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 2284;
					this.match(SolidCashParser.T__4);
					this.state = 2285;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 2290;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 2293;
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
		this.enterRule(localctx, 218, SolidCashParser.RULE_yulExpression);
		try {
			this.state = 2298;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 268, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2295;
				this.yulFunctionCall();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2296;
				this.yulPath();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2297;
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
		this.enterRule(localctx, 220, SolidCashParser.RULE_yulFunctionCall);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2300;
			this.yulFunctionName();
			this.state = 2301;
			this.match(SolidCashParser.T__56);
			this.state = 2310;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 270, this._ctx) ) {
			case 1:
				{
				this.state = 2302;
				this.yulExpression();
				this.state = 2307;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 2303;
					this.match(SolidCashParser.T__4);
					this.state = 2304;
					this.yulExpression();
					}
					}
					this.state = 2309;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			}
			this.state = 2312;
			this.match(SolidCashParser.T__57);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 222, SolidCashParser.RULE_yulFunctionName);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2314;
			_la = this._input.LA(1);
			if(!(_la===30 || _la===35 || _la===81 || _la===95 || _la===149 || _la===180)) {
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
		this.enterRule(localctx, 224, SolidCashParser.RULE_yulPath);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2316;
			this.anyIdentifier();
			this.state = 2324;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 272, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					this.state = 2322;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 271, this._ctx) ) {
					case 1:
						{
						this.state = 2317;
						this.match(SolidCashParser.T__6);
						this.state = 2318;
						this.anyIdentifier();
						}
						break;
					case 2:
						{
						this.state = 2319;
						this.match(SolidCashParser.DotLength);
						}
						break;
					case 3:
						{
						this.state = 2320;
						this.match(SolidCashParser.T__6);
						this.state = 2321;
						this.match(SolidCashParser.T__80);
						}
						break;
					}
					}
				}
				this.state = 2326;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 272, this._ctx);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 226, SolidCashParser.RULE_yulLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2327;
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
		this.enterRule(localctx, 228, SolidCashParser.RULE_uncheckedStatement);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2329;
			this.match(SolidCashParser.T__113);
			this.state = 2330;
			this.match(SolidCashParser.T__3);
			this.state = 2334;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 273, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2331;
					this.statement();
					}
					}
				}
				this.state = 2336;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 273, this._ctx);
			}
			this.state = 2337;
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
		this.enterRule(localctx, 230, SolidCashParser.RULE_switchStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2339;
			this.match(SolidCashParser.T__109);
			this.state = 2340;
			this.match(SolidCashParser.T__56);
			this.state = 2341;
			this.expression(0);
			this.state = 2342;
			this.match(SolidCashParser.T__57);
			this.state = 2343;
			this.match(SolidCashParser.T__3);
			this.state = 2347;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===111) {
				{
				{
				this.state = 2344;
				this.switchCase();
				}
				}
				this.state = 2349;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 2351;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===112) {
				{
				this.state = 2350;
				this.switchDefault();
				}
			}

			this.state = 2353;
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
		this.enterRule(localctx, 232, SolidCashParser.RULE_switchCase);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2355;
			this.match(SolidCashParser.T__110);
			this.state = 2356;
			this.expression(0);
			this.state = 2357;
			this.match(SolidCashParser.T__114);
			this.state = 2361;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 276, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2358;
					this.statement();
					}
					}
				}
				this.state = 2363;
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
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public switchDefault(): SwitchDefaultContext {
		let localctx: SwitchDefaultContext = new SwitchDefaultContext(this, this._ctx, this.state);
		this.enterRule(localctx, 234, SolidCashParser.RULE_switchDefault);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2364;
			this.match(SolidCashParser.T__111);
			this.state = 2365;
			this.match(SolidCashParser.T__114);
			this.state = 2369;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 277, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2366;
					this.statement();
					}
					}
				}
				this.state = 2371;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 277, this._ctx);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 236, SolidCashParser.RULE_tryCatchStatement);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2372;
			this.match(SolidCashParser.T__115);
			this.state = 2373;
			this.expression(0);
			this.state = 2375;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 278, this._ctx) ) {
			case 1:
				{
				this.state = 2374;
				this.tryReturns();
				}
				break;
			}
			this.state = 2377;
			localctx._tryBlock = this.block();
			this.state = 2379;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 2378;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 2381;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 279, this._ctx);
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
		this.enterRule(localctx, 238, SolidCashParser.RULE_tryReturns);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2383;
			this.match(SolidCashParser.T__77);
			this.state = 2384;
			this.match(SolidCashParser.T__56);
			this.state = 2396;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===9 || _la===34 || ((((_la - 70)) & ~0x1F) === 0 && ((1 << (_la - 70)) & 3585) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 2385;
				this.parameter();
				this.state = 2390;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 280, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2386;
						this.match(SolidCashParser.T__4);
						this.state = 2387;
						this.parameter();
						}
						}
					}
					this.state = 2392;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 280, this._ctx);
				}
				this.state = 2394;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2393;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2398;
			this.match(SolidCashParser.T__57);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 240, SolidCashParser.RULE_catchClause);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2400;
			this.match(SolidCashParser.T__116);
			this.state = 2402;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 283, this._ctx) ) {
			case 1:
				{
				this.state = 2401;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 2419;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 287, this._ctx) ) {
			case 1:
				{
				this.state = 2404;
				this.match(SolidCashParser.T__56);
				this.state = 2416;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===9 || _la===34 || ((((_la - 70)) & ~0x1F) === 0 && ((1 << (_la - 70)) & 3585) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 2405;
					this.parameter();
					this.state = 2410;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 284, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2406;
							this.match(SolidCashParser.T__4);
							this.state = 2407;
							this.parameter();
							}
							}
						}
						this.state = 2412;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 284, this._ctx);
					}
					this.state = 2414;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2413;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2418;
				this.match(SolidCashParser.T__57);
				}
				break;
			}
			this.state = 2421;
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
		this.enterRule(localctx, 242, SolidCashParser.RULE_breakStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2423;
			this.match(SolidCashParser.T__105);
			this.state = 2424;
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
		this.enterRule(localctx, 244, SolidCashParser.RULE_continueStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2426;
			this.match(SolidCashParser.T__106);
			this.state = 2427;
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
		this.enterRule(localctx, 246, SolidCashParser.RULE_requireMessage);
		try {
			this.state = 2433;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 288, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2429;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2430;
				this.match(SolidCashParser.Identifier);
				this.state = 2431;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2432;
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
		this.enterRule(localctx, 248, SolidCashParser.RULE_revertStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 2479;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 294, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2435;
				this.match(SolidCashParser.T__34);
				this.state = 2436;
				this.anyIdentifier();
				this.state = 2439;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7) {
					{
					this.state = 2437;
					this.match(SolidCashParser.T__6);
					this.state = 2438;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 2441;
				this.match(SolidCashParser.T__56);
				this.state = 2442;
				this.match(SolidCashParser.T__3);
				this.state = 2454;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2443;
					this.namedArg();
					this.state = 2448;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 290, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2444;
							this.match(SolidCashParser.T__4);
							this.state = 2445;
							this.namedArg();
							}
							}
						}
						this.state = 2450;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 290, this._ctx);
					}
					this.state = 2452;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2451;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2456;
				this.match(SolidCashParser.T__5);
				this.state = 2457;
				this.match(SolidCashParser.T__57);
				this.state = 2458;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2460;
				this.match(SolidCashParser.T__34);
				this.state = 2461;
				this.anyIdentifier();
				this.state = 2464;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7) {
					{
					this.state = 2462;
					this.match(SolidCashParser.T__6);
					this.state = 2463;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 2466;
				this.expressionList();
				this.state = 2467;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2469;
				this.match(SolidCashParser.T__34);
				this.state = 2470;
				this.match(SolidCashParser.T__56);
				this.state = 2471;
				this.expression(0);
				this.state = 2472;
				this.match(SolidCashParser.T__57);
				this.state = 2473;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2475;
				this.match(SolidCashParser.T__34);
				this.state = 2476;
				this.match(SolidCashParser.T__56);
				this.state = 2477;
				this.match(SolidCashParser.T__57);
				this.state = 2478;
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
		this.enterRule(localctx, 250, SolidCashParser.RULE_assertStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2481;
			this.match(SolidCashParser.T__117);
			this.state = 2482;
			this.match(SolidCashParser.T__56);
			this.state = 2483;
			this.expression(0);
			this.state = 2484;
			this.match(SolidCashParser.T__57);
			this.state = 2485;
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
		this.enterRule(localctx, 252, SolidCashParser.RULE_consoleParameter);
		try {
			this.state = 2489;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 180:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2487;
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
				this.state = 2488;
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
		this.enterRule(localctx, 254, SolidCashParser.RULE_consoleParameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2491;
			this.match(SolidCashParser.T__56);
			this.state = 2503;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 3152921) !== 0) || _la===180) {
				{
				this.state = 2492;
				this.consoleParameter();
				this.state = 2497;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 296, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2493;
						this.match(SolidCashParser.T__4);
						this.state = 2494;
						this.consoleParameter();
						}
						}
					}
					this.state = 2499;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 296, this._ctx);
				}
				this.state = 2501;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2500;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2505;
			this.match(SolidCashParser.T__57);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 256, SolidCashParser.RULE_functionCall);
		let _la: number;
		try {
			let _alt: number;
			this.state = 2571;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 305, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2507;
				this.match(SolidCashParser.Identifier);
				this.state = 2508;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2509;
				this.match(SolidCashParser.T__30);
				this.state = 2510;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2511;
				this.match(SolidCashParser.Identifier);
				this.state = 2512;
				this.callOptions();
				this.state = 2513;
				this.expressionList();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2515;
				this.match(SolidCashParser.T__42);
				this.state = 2516;
				this.expressionList();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2517;
				this.match(SolidCashParser.Identifier);
				this.state = 2518;
				this.match(SolidCashParser.T__6);
				this.state = 2519;
				this.match(SolidCashParser.Identifier);
				this.state = 2520;
				this.expressionList();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2521;
				this.match(SolidCashParser.Identifier);
				this.state = 2522;
				this.match(SolidCashParser.T__56);
				this.state = 2523;
				this.match(SolidCashParser.T__3);
				this.state = 2535;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2524;
					this.namedArg();
					this.state = 2529;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 299, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2525;
							this.match(SolidCashParser.T__4);
							this.state = 2526;
							this.namedArg();
							}
							}
						}
						this.state = 2531;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 299, this._ctx);
					}
					this.state = 2533;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2532;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2537;
				this.match(SolidCashParser.T__5);
				this.state = 2538;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2539;
				this.match(SolidCashParser.T__56);
				this.state = 2540;
				this.match(SolidCashParser.Identifier);
				this.state = 2541;
				this.match(SolidCashParser.T__57);
				this.state = 2542;
				this.expressionList();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2543;
				this.match(SolidCashParser.T__56);
				this.state = 2544;
				this.match(SolidCashParser.Identifier);
				this.state = 2545;
				this.match(SolidCashParser.T__6);
				this.state = 2546;
				this.match(SolidCashParser.Identifier);
				this.state = 2547;
				this.match(SolidCashParser.T__57);
				this.state = 2548;
				this.expressionList();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2549;
				this.match(SolidCashParser.T__56);
				this.state = 2550;
				this.match(SolidCashParser.Identifier);
				this.state = 2551;
				this.match(SolidCashParser.T__6);
				this.state = 2552;
				this.match(SolidCashParser.Identifier);
				this.state = 2553;
				this.match(SolidCashParser.T__57);
				this.state = 2554;
				this.match(SolidCashParser.T__56);
				this.state = 2555;
				this.match(SolidCashParser.T__3);
				this.state = 2567;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2556;
					this.namedArg();
					this.state = 2561;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 302, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2557;
							this.match(SolidCashParser.T__4);
							this.state = 2558;
							this.namedArg();
							}
							}
						}
						this.state = 2563;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 302, this._ctx);
					}
					this.state = 2565;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2564;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2569;
				this.match(SolidCashParser.T__5);
				this.state = 2570;
				this.match(SolidCashParser.T__57);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 258, SolidCashParser.RULE_namedArg);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2573;
			this.match(SolidCashParser.Identifier);
			this.state = 2574;
			this.match(SolidCashParser.T__114);
			this.state = 2575;
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
		this.enterRule(localctx, 260, SolidCashParser.RULE_expressionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2577;
			this.match(SolidCashParser.T__56);
			this.state = 2589;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 308, this._ctx) ) {
			case 1:
				{
				this.state = 2578;
				this.callArgument();
				this.state = 2583;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 306, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2579;
						this.match(SolidCashParser.T__4);
						this.state = 2580;
						this.callArgument();
						}
						}
					}
					this.state = 2585;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 306, this._ctx);
				}
				this.state = 2587;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2586;
					this.match(SolidCashParser.T__4);
					}
				}

				}
				break;
			}
			this.state = 2591;
			this.match(SolidCashParser.T__57);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 262, SolidCashParser.RULE_callArgument);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2593;
			this.expression(0);
			this.state = 2596;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===48 || ((((_la - 83)) & ~0x1F) === 0 && ((1 << (_la - 83)) & 1023) !== 0)) {
				{
				this.state = 2594;
				localctx._aop = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===48 || ((((_la - 83)) & ~0x1F) === 0 && ((1 << (_la - 83)) & 1023) !== 0))) {
				    localctx._aop = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2595;
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
		this.enterRule(localctx, 264, SolidCashParser.RULE_callOptions);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2598;
			this.match(SolidCashParser.T__3);
			this.state = 2599;
			this.callOption();
			this.state = 2604;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 310, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2600;
					this.match(SolidCashParser.T__4);
					this.state = 2601;
					this.callOption();
					}
					}
				}
				this.state = 2606;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 310, this._ctx);
			}
			this.state = 2608;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2607;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 2610;
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
		this.enterRule(localctx, 266, SolidCashParser.RULE_callOption);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2612;
			this.match(SolidCashParser.Identifier);
			this.state = 2613;
			this.match(SolidCashParser.T__114);
			this.state = 2614;
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
		this.enterRule(localctx, 268, SolidCashParser.RULE_typeList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2616;
			this.match(SolidCashParser.T__56);
			this.state = 2628;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===9 || _la===34 || ((((_la - 57)) & ~0x1F) === 0 && ((1 << (_la - 57)) & 29368321) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 2617;
				this.typeListItem();
				this.state = 2622;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 312, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2618;
						this.match(SolidCashParser.T__4);
						this.state = 2619;
						this.typeListItem();
						}
						}
					}
					this.state = 2624;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 312, this._ctx);
				}
				this.state = 2626;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2625;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2630;
			this.match(SolidCashParser.T__57);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 270, SolidCashParser.RULE_typeListItem);
		let _la: number;
		try {
			this.state = 2647;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 317, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2632;
				this.typeName();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2633;
				this.arrayType(0);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2634;
				this.match(SolidCashParser.T__56);
				this.state = 2635;
				this.typeListItem();
				this.state = 2636;
				this.match(SolidCashParser.T__57);
				this.state = 2644;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===72) {
					{
					{
					this.state = 2637;
					this.match(SolidCashParser.T__71);
					this.state = 2639;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 315, this._ctx) ) {
					case 1:
						{
						this.state = 2638;
						this.expression(0);
						}
						break;
					}
					this.state = 2641;
					this.match(SolidCashParser.T__72);
					}
					}
					this.state = 2646;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
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
		let _startState: number = 272;
		this.enterRecursionRule(localctx, 272, SolidCashParser.RULE_expression, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2847;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 330, this._ctx) ) {
			case 1:
				{
				localctx = new AssignmentExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 2650;
				this.match(SolidCashParser.T__56);
				this.state = 2651;
				this.match(SolidCashParser.Identifier);
				this.state = 2652;
				(localctx as AssignmentExpressionContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===48 || ((((_la - 83)) & ~0x1F) === 0 && ((1 << (_la - 83)) & 1023) !== 0))) {
				    (localctx as AssignmentExpressionContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2653;
				this.expression(0);
				this.state = 2654;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 2:
				{
				localctx = new InstantiationWithOptionsContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2656;
				this.match(SolidCashParser.T__56);
				this.state = 2657;
				this.match(SolidCashParser.T__81);
				this.state = 2658;
				this.match(SolidCashParser.Identifier);
				this.state = 2659;
				this.match(SolidCashParser.T__57);
				this.state = 2660;
				this.callOptions();
				this.state = 2661;
				this.expressionList();
				}
				break;
			case 3:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2663;
				this.match(SolidCashParser.T__56);
				this.state = 2664;
				this.expression(0);
				this.state = 2665;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 4:
				{
				localctx = new TupleExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2667;
				this.match(SolidCashParser.T__56);
				this.state = 2668;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 5:
				{
				localctx = new TupleExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2669;
				this.match(SolidCashParser.T__56);
				this.state = 2670;
				this.expression(0);
				this.state = 2673;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2671;
					this.match(SolidCashParser.T__4);
					this.state = 2672;
					this.expression(0);
					}
					}
					this.state = 2675;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2677;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 6:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2679;
				this.typeCast();
				this.state = 2680;
				this.match(SolidCashParser.T__56);
				this.state = 2681;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 2683;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2682;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 2685;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 7:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2687;
				this.arrayCastType();
				this.state = 2688;
				this.match(SolidCashParser.T__56);
				this.state = 2689;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 2691;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2690;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 2693;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 8:
				{
				localctx = new ChainedFunctionCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2695;
				this.functionCall();
				this.state = 2697;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2696;
						this.expressionList();
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2699;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 321, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 9:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2701;
				this.functionCall();
				}
				break;
			case 10:
				{
				localctx = new ParenthesizedFunctionCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2702;
				this.match(SolidCashParser.T__56);
				this.state = 2703;
				this.expression(0);
				this.state = 2704;
				this.match(SolidCashParser.T__57);
				this.state = 2705;
				this.expressionList();
				}
				break;
			case 11:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2707;
				this.match(SolidCashParser.T__81);
				this.state = 2708;
				this.match(SolidCashParser.Identifier);
				this.state = 2710;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 2709;
					this.callOptions();
					}
				}

				this.state = 2712;
				this.expressionList();
				}
				break;
			case 12:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2713;
				this.match(SolidCashParser.T__81);
				this.state = 2714;
				this.typeName();
				this.state = 2720;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2715;
					this.match(SolidCashParser.T__71);
					this.state = 2717;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===145) {
						{
						this.state = 2716;
						this.match(SolidCashParser.NumberLiteral);
						}
					}

					this.state = 2719;
					this.match(SolidCashParser.T__72);
					}
					}
					this.state = 2722;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===72);
				this.state = 2724;
				this.match(SolidCashParser.T__56);
				this.state = 2725;
				this.expression(0);
				this.state = 2726;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 13:
				{
				localctx = new NewDynamicBytesContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2728;
				this.match(SolidCashParser.T__81);
				this.state = 2729;
				this.match(SolidCashParser.UnboundedBytes);
				this.state = 2730;
				this.match(SolidCashParser.T__56);
				this.state = 2731;
				this.expression(0);
				this.state = 2732;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 14:
				{
				localctx = new NewDynamicStringContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2734;
				this.match(SolidCashParser.T__81);
				this.state = 2735;
				this.match(SolidCashParser.PrimitiveType);
				this.state = 2736;
				this.match(SolidCashParser.T__56);
				this.state = 2737;
				this.expression(0);
				this.state = 2738;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 15:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2740;
				this.typeIntrospectionBase();
				this.state = 2741;
				this.match(SolidCashParser.T__6);
				this.state = 2742;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 16:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2744;
				this.match(SolidCashParser.T__118);
				this.state = 2745;
				this.expressionList();
				}
				break;
			case 17:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2746;
				this.match(SolidCashParser.T__119);
				this.state = 2747;
				this.expressionList();
				}
				break;
			case 18:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2748;
				this.match(SolidCashParser.T__120);
				this.state = 2749;
				this.expressionList();
				}
				break;
			case 19:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2750;
				this.match(SolidCashParser.T__121);
				this.state = 2751;
				this.expressionList();
				}
				break;
			case 20:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2752;
				this.match(SolidCashParser.T__122);
				this.state = 2753;
				this.match(SolidCashParser.T__56);
				this.state = 2761;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 325, this._ctx) ) {
				case 1:
					{
					this.state = 2754;
					_la = this._input.LA(1);
					if(!(_la===42 || _la===180)) {
					this._errHandler.recoverInline(this);
					}
					else {
						this._errHandler.reportMatch(this);
					    this.consume();
					}
					this.state = 2755;
					this.match(SolidCashParser.T__6);
					this.state = 2756;
					this.match(SolidCashParser.Identifier);
					}
					break;
				case 2:
					{
					this.state = 2757;
					this.match(SolidCashParser.Identifier);
					}
					break;
				case 3:
					{
					this.state = 2758;
					this.match(SolidCashParser.Identifier);
					this.state = 2759;
					this.match(SolidCashParser.T__56);
					this.state = 2760;
					this.match(SolidCashParser.T__57);
					}
					break;
				}
				this.state = 2763;
				this.match(SolidCashParser.T__4);
				this.state = 2764;
				this.abiEncodeCallArguments();
				this.state = 2765;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 21:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2767;
				this.match(SolidCashParser.T__123);
				this.state = 2768;
				this.expressionList();
				}
				break;
			case 22:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2769;
				this.match(SolidCashParser.T__124);
				this.state = 2770;
				this.expressionList();
				}
				break;
			case 23:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2771;
				this.match(SolidCashParser.T__125);
				this.state = 2772;
				this.match(SolidCashParser.T__56);
				this.state = 2773;
				this.expression(0);
				this.state = 2774;
				this.match(SolidCashParser.T__4);
				this.state = 2775;
				this.typeList();
				this.state = 2776;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 24:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2778;
				this.match(SolidCashParser.T__126);
				this.state = 2779;
				this.match(SolidCashParser.T__56);
				this.state = 2780;
				this.expression(0);
				this.state = 2781;
				this.match(SolidCashParser.T__4);
				this.state = 2782;
				this.typeList();
				this.state = 2783;
				this.match(SolidCashParser.T__4);
				this.state = 2784;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 2785;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 25:
				{
				localctx = new BareAbiReferenceExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2787;
				_la = this._input.LA(1);
				if(!(((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 287) !== 0))) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				break;
			case 26:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2788;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__127);
				this.state = 2789;
				this.match(SolidCashParser.T__71);
				this.state = 2790;
				this.expression(0);
				this.state = 2791;
				this.match(SolidCashParser.T__72);
				this.state = 2792;
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
			case 27:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2794;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__128);
				this.state = 2795;
				this.match(SolidCashParser.T__71);
				this.state = 2796;
				this.expression(0);
				this.state = 2797;
				this.match(SolidCashParser.T__72);
				this.state = 2798;
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
			case 28:
				{
				localctx = new PrefixOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2800;
				(localctx as PrefixOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===93 || _la===94)) {
				    (localctx as PrefixOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2801;
				this.expression(22);
				}
				break;
			case 29:
				{
				localctx = new UnaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2802;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===131)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2803;
				this.expression(21);
				}
				break;
			case 30:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2804;
				this.match(SolidCashParser.T__71);
				this.state = 2816;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 328, this._ctx) ) {
				case 1:
					{
					this.state = 2805;
					this.expression(0);
					this.state = 2810;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 326, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2806;
							this.match(SolidCashParser.T__4);
							this.state = 2807;
							this.expression(0);
							}
							}
						}
						this.state = 2812;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 326, this._ctx);
					}
					this.state = 2814;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2813;
						this.match(SolidCashParser.T__4);
						}
					}

					}
					break;
				}
				this.state = 2818;
				this.match(SolidCashParser.T__72);
				}
				break;
			case 31:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2819;
				this.match(SolidCashParser.T__41);
				this.state = 2820;
				this.match(SolidCashParser.T__6);
				this.state = 2821;
				this.match(SolidCashParser.Identifier);
				this.state = 2822;
				this.match(SolidCashParser.T__6);
				this.state = 2823;
				this.match(SolidCashParser.Identifier);
				this.state = 2824;
				this.match(SolidCashParser.T__71);
				this.state = 2825;
				this.expression(0);
				this.state = 2826;
				this.match(SolidCashParser.T__72);
				this.state = 2827;
				this.memberName();
				}
				break;
			case 32:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2829;
				this.match(SolidCashParser.T__41);
				this.state = 2830;
				this.match(SolidCashParser.T__6);
				this.state = 2831;
				this.match(SolidCashParser.Identifier);
				this.state = 2836;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2832;
						this.match(SolidCashParser.T__71);
						this.state = 2833;
						this.expression(0);
						this.state = 2834;
						this.match(SolidCashParser.T__72);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2838;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 329, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 33:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2840;
				this.match(SolidCashParser.T__41);
				this.state = 2841;
				this.match(SolidCashParser.T__6);
				this.state = 2842;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 34:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2843;
				this.match(SolidCashParser.T__41);
				}
				break;
			case 35:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2844;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 36:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2845;
				this.anyIdentifier();
				}
				break;
			case 37:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2846;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 3015;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 346, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 3013;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 345, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2849;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 2850;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 2851;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2852;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 2853;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 98560) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2854;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2855;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 2856;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2857;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2858;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 2859;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===132 || _la===133)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2860;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2861;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 2862;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2863;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2864;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2865;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2866;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2867;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2868;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2869;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2870;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2871;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2872;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2873;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2874;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2875;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2876;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2877;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__133);
						this.state = 2878;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2879;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2880;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__46);
						this.state = 2881;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2882;
						if (!(this.precpred(this._ctx, 40))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 40)");
						}
						this.state = 2883;
						this.match(SolidCashParser.T__71);
						this.state = 2885;
						this._errHandler.sync(this);
						switch ( this._interp.adaptivePredict(this._input, 331, this._ctx) ) {
						case 1:
							{
							this.state = 2884;
							(localctx as IndexRangeSliceContext)._start = this.expression(0);
							}
							break;
						}
						this.state = 2887;
						this.match(SolidCashParser.T__114);
						this.state = 2889;
						this._errHandler.sync(this);
						switch ( this._interp.adaptivePredict(this._input, 332, this._ctx) ) {
						case 1:
							{
							this.state = 2888;
							(localctx as IndexRangeSliceContext)._end = this.expression(0);
							}
							break;
						}
						this.state = 2891;
						this.match(SolidCashParser.T__72);
						}
						break;
					case 13:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2892;
						if (!(this.precpred(this._ctx, 39))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 39)");
						}
						this.state = 2893;
						this.match(SolidCashParser.T__71);
						this.state = 2894;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2895;
						this.match(SolidCashParser.T__72);
						}
						break;
					case 14:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2896;
						if (!(this.precpred(this._ctx, 38))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 38)");
						}
						this.state = 2897;
						this.match(SolidCashParser.T__71);
						this.state = 2898;
						this.expression(0);
						this.state = 2899;
						this.match(SolidCashParser.T__72);
						}
						break;
					case 15:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2901;
						if (!(this.precpred(this._ctx, 35))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 35)");
						}
						this.state = 2902;
						(localctx as UnaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===130 || _la===164)) {
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
						this.state = 2903;
						if (!(this.precpred(this._ctx, 34))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 34)");
						}
						this.state = 2904;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.DotSplit);
						this.state = 2905;
						this.match(SolidCashParser.T__56);
						this.state = 2906;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2907;
						this.match(SolidCashParser.T__57);
						}
						break;
					case 17:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2909;
						if (!(this.precpred(this._ctx, 33))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 33)");
						}
						this.state = 2910;
						this.match(SolidCashParser.DotSlice);
						this.state = 2911;
						this.match(SolidCashParser.T__56);
						this.state = 2912;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2913;
						this.match(SolidCashParser.T__4);
						this.state = 2914;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2915;
						this.match(SolidCashParser.T__57);
						}
						break;
					case 18:
						{
						localctx = new LegacyCallOptionCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2917;
						if (!(this.precpred(this._ctx, 32))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 32)");
						}
						this.state = 2918;
						this.match(SolidCashParser.T__6);
						this.state = 2919;
						this.match(SolidCashParser.Identifier);
						this.state = 2923;
						this._errHandler.sync(this);
						switch (this._input.LA(1)) {
						case 7:
							{
							this.state = 2920;
							this.match(SolidCashParser.T__6);
							this.state = 2921;
							this.match(SolidCashParser.Identifier);
							}
							break;
						case 163:
							{
							this.state = 2922;
							this.match(SolidCashParser.DotValue);
							}
							break;
						default:
							throw new NoViableAltException(this);
						}
						this.state = 2925;
						this.match(SolidCashParser.T__56);
						this.state = 2926;
						this.expression(0);
						this.state = 2927;
						this.match(SolidCashParser.T__57);
						this.state = 2928;
						this.expressionList();
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2930;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 2931;
						this.match(SolidCashParser.T__6);
						this.state = 2932;
						this.match(SolidCashParser.Identifier);
						this.state = 2934;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2933;
							this.callOptions();
							}
						}

						this.state = 2936;
						this.match(SolidCashParser.T__56);
						this.state = 2937;
						this.match(SolidCashParser.T__3);
						this.state = 2949;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===180) {
							{
							this.state = 2938;
							this.namedArg();
							this.state = 2943;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 335, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 2939;
									this.match(SolidCashParser.T__4);
									this.state = 2940;
									this.namedArg();
									}
									}
								}
								this.state = 2945;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 335, this._ctx);
							}
							this.state = 2947;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 2946;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 2951;
						this.match(SolidCashParser.T__5);
						this.state = 2952;
						this.match(SolidCashParser.T__57);
						}
						break;
					case 20:
						{
						localctx = new ChainedMethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2953;
						if (!(this.precpred(this._ctx, 30))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 30)");
						}
						this.state = 2954;
						this.match(SolidCashParser.T__6);
						this.state = 2955;
						this.match(SolidCashParser.Identifier);
						this.state = 2957;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2956;
							this.callOptions();
							}
						}

						this.state = 2959;
						this.expressionList();
						this.state = 2961;
						this._errHandler.sync(this);
						_alt = 1;
						do {
							switch (_alt) {
							case 1:
								{
								{
								this.state = 2960;
								this.expressionList();
								}
								}
								break;
							default:
								throw new NoViableAltException(this);
							}
							this.state = 2963;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 339, this._ctx);
						} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
						}
						break;
					case 21:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2965;
						if (!(this.precpred(this._ctx, 29))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 29)");
						}
						this.state = 2966;
						this.match(SolidCashParser.DotLength);
						this.state = 2968;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2967;
							this.callOptions();
							}
						}

						this.state = 2970;
						this.expressionList();
						}
						break;
					case 22:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2971;
						if (!(this.precpred(this._ctx, 28))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 28)");
						}
						this.state = 2972;
						this.match(SolidCashParser.DotValue);
						this.state = 2974;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2973;
							this.callOptions();
							}
						}

						this.state = 2976;
						this.expressionList();
						}
						break;
					case 23:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2977;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 2978;
						this.match(SolidCashParser.T__6);
						this.state = 2979;
						this.match(SolidCashParser.Identifier);
						this.state = 2981;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 2980;
							this.callOptions();
							}
						}

						this.state = 2983;
						this.expressionList();
						}
						break;
					case 24:
						{
						localctx = new CallOptionsMemberContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2984;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 2985;
						this.match(SolidCashParser.T__6);
						this.state = 2986;
						this.match(SolidCashParser.Identifier);
						this.state = 2987;
						this.callOptions();
						this.state = 2988;
						this.memberName();
						}
						break;
					case 25:
						{
						localctx = new IndexedFunctionCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexedFunctionCallContext)._base = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2990;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 2991;
						this.match(SolidCashParser.T__71);
						this.state = 2992;
						(localctx as IndexedFunctionCallContext)._index = this.expression(0);
						this.state = 2993;
						this.match(SolidCashParser.T__72);
						this.state = 2994;
						this.expressionList();
						}
						break;
					case 26:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2996;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 2997;
						this.memberName();
						}
						break;
					case 27:
						{
						localctx = new PostfixOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2998;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 2999;
						(localctx as PostfixOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===93 || _la===94)) {
						    (localctx as PostfixOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						}
						break;
					case 28:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3000;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 3001;
						this.match(SolidCashParser.T__134);
						this.state = 3002;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 3005;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===48 || ((((_la - 83)) & ~0x1F) === 0 && ((1 << (_la - 83)) & 1023) !== 0)) {
							{
							this.state = 3003;
							(localctx as TernaryOpContext)._tOp = this._input.LT(1);
							_la = this._input.LA(1);
							if(!(_la===48 || ((((_la - 83)) & ~0x1F) === 0 && ((1 << (_la - 83)) & 1023) !== 0))) {
							    (localctx as TernaryOpContext)._tOp = this._errHandler.recoverInline(this);
							}
							else {
								this._errHandler.reportMatch(this);
							    this.consume();
							}
							this.state = 3004;
							(localctx as TernaryOpContext)._tVal = this.assignChain();
							}
						}

						this.state = 3007;
						this.match(SolidCashParser.T__114);
						this.state = 3008;
						(localctx as TernaryOpContext)._ifFalse = this.expression(0);
						this.state = 3011;
						this._errHandler.sync(this);
						switch ( this._interp.adaptivePredict(this._input, 344, this._ctx) ) {
						case 1:
							{
							this.state = 3009;
							(localctx as TernaryOpContext)._fOp = this._input.LT(1);
							_la = this._input.LA(1);
							if(!(_la===48 || ((((_la - 83)) & ~0x1F) === 0 && ((1 << (_la - 83)) & 1023) !== 0))) {
							    (localctx as TernaryOpContext)._fOp = this._errHandler.recoverInline(this);
							}
							else {
								this._errHandler.reportMatch(this);
							    this.consume();
							}
							this.state = 3010;
							(localctx as TernaryOpContext)._fVal = this.assignChain();
							}
							break;
						}
						}
						break;
					}
					}
				}
				this.state = 3017;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 346, this._ctx);
			}
			}
		}
		catch (re) {
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
	public typeIntrospectionBase(): TypeIntrospectionBaseContext {
		let localctx: TypeIntrospectionBaseContext = new TypeIntrospectionBaseContext(this, this._ctx, this.state);
		this.enterRule(localctx, 274, SolidCashParser.RULE_typeIntrospectionBase);
		try {
			this.state = 3030;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 63:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 3018;
				this.match(SolidCashParser.T__62);
				this.state = 3019;
				this.match(SolidCashParser.T__56);
				this.state = 3020;
				this.typeName();
				this.state = 3021;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 57:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 3023;
				this.match(SolidCashParser.T__56);
				this.state = 3024;
				this.match(SolidCashParser.T__62);
				this.state = 3025;
				this.match(SolidCashParser.T__56);
				this.state = 3026;
				this.typeName();
				this.state = 3027;
				this.match(SolidCashParser.T__57);
				this.state = 3028;
				this.match(SolidCashParser.T__57);
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
	public abiEncodeCallArguments(): AbiEncodeCallArgumentsContext {
		let localctx: AbiEncodeCallArgumentsContext = new AbiEncodeCallArgumentsContext(this, this._ctx, this.state);
		this.enterRule(localctx, 276, SolidCashParser.RULE_abiEncodeCallArguments);
		try {
			this.state = 3040;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 348, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 3032;
				this.match(SolidCashParser.T__56);
				this.state = 3033;
				localctx._target = this.match(SolidCashParser.Identifier);
				this.state = 3034;
				this.match(SolidCashParser.T__57);
				this.state = 3035;
				localctx._aop = this.match(SolidCashParser.T__47);
				this.state = 3036;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 3037;
				this.expression(0);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 3038;
				this.match(SolidCashParser.T__56);
				this.state = 3039;
				this.match(SolidCashParser.T__57);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public bareAbiFunctionReferenceStatement(): BareAbiFunctionReferenceStatementContext {
		let localctx: BareAbiFunctionReferenceStatementContext = new BareAbiFunctionReferenceStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 278, SolidCashParser.RULE_bareAbiFunctionReferenceStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3042;
			_la = this._input.LA(1);
			if(!(((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 287) !== 0))) {
			this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			this.state = 3043;
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
	public memberName(): MemberNameContext {
		let localctx: MemberNameContext = new MemberNameContext(this, this._ctx, this.state);
		this.enterRule(localctx, 280, SolidCashParser.RULE_memberName);
		try {
			this.state = 3062;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 349, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 3045;
				this.match(SolidCashParser.T__6);
				this.state = 3046;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 3047;
				this.match(SolidCashParser.T__6);
				this.state = 3048;
				this.match(SolidCashParser.T__33);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 3049;
				this.match(SolidCashParser.T__6);
				this.state = 3050;
				this.match(SolidCashParser.T__80);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 3051;
				this.match(SolidCashParser.DotValue);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 3052;
				this.match(SolidCashParser.DotLockingBytecode);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 3053;
				this.match(SolidCashParser.DotTokenCategory);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 3054;
				this.match(SolidCashParser.DotNftCommitment);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 3055;
				this.match(SolidCashParser.DotTokenAmount);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 3056;
				this.match(SolidCashParser.DotOutpointTransactionHash);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 3057;
				this.match(SolidCashParser.DotOutpointIndex);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 3058;
				this.match(SolidCashParser.DotUnlockingBytecode);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 3059;
				this.match(SolidCashParser.DotSequenceNumber);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 3060;
				this.match(SolidCashParser.DotCode);
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 3061;
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
		this.enterRule(localctx, 282, SolidCashParser.RULE_modifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3064;
			_la = this._input.LA(1);
			if(!(_la===32 || _la===36 || _la===64 || ((((_la - 136)) & ~0x1F) === 0 && ((1 << (_la - 136)) & 15) !== 0))) {
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
		this.enterRule(localctx, 284, SolidCashParser.RULE_dataLocation);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3066;
			_la = this._input.LA(1);
			if(!(((((_la - 136)) & ~0x1F) === 0 && ((1 << (_la - 136)) & 7) !== 0))) {
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
		this.enterRule(localctx, 286, SolidCashParser.RULE_literal);
		try {
			let _alt: number;
			this.state = 3094;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 141:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 3068;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 145:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 3069;
				this.numberLiteral();
				}
				break;
			case 144:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 3070;
				this.decimalLiteral();
				}
				break;
			case 151:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 3071;
				this.match(SolidCashParser.StringLiteral);
				this.state = 3075;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 350, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 3072;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 3077;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 350, this._ctx);
				}
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 3078;
				this.match(SolidCashParser.UnicodeLiteral);
				this.state = 3082;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 351, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 3079;
						this.match(SolidCashParser.UnicodeLiteral);
						}
						}
					}
					this.state = 3084;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 351, this._ctx);
				}
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 3085;
				this.match(SolidCashParser.HexStringLiteral);
				this.state = 3089;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 352, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 3086;
						this.match(SolidCashParser.HexStringLiteral);
						}
						}
					}
					this.state = 3091;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 352, this._ctx);
				}
				}
				break;
			case 152:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 3092;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 153:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 3093;
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
		this.enterRule(localctx, 288, SolidCashParser.RULE_numberLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3096;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 3098;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 354, this._ctx) ) {
			case 1:
				{
				this.state = 3097;
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
		this.enterRule(localctx, 290, SolidCashParser.RULE_decimalLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3100;
			this.match(SolidCashParser.DecimalLiteral);
			this.state = 3102;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 355, this._ctx) ) {
			case 1:
				{
				this.state = 3101;
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
		this.enterRule(localctx, 292, SolidCashParser.RULE_typeName);
		let _la: number;
		try {
			let _alt: number;
			this.state = 3155;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 361, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 3104;
				this.match(SolidCashParser.T__80);
				this.state = 3105;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 3106;
				this.match(SolidCashParser.T__80);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 3107;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 3108;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 3109;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 3110;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 3111;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 3112;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 3113;
				this.match(SolidCashParser.T__78);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 3114;
				this.match(SolidCashParser.T__79);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 3115;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 3116;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 3117;
				this.match(SolidCashParser.T__8);
				this.state = 3118;
				this.match(SolidCashParser.T__56);
				this.state = 3127;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===9 || _la===34 || ((((_la - 70)) & ~0x1F) === 0 && ((1 << (_la - 70)) & 3585) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 3119;
					this.functionTypeParameter();
					this.state = 3124;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 3120;
						this.match(SolidCashParser.T__4);
						this.state = 3121;
						this.functionTypeParameter();
						}
						}
						this.state = 3126;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 3129;
				this.match(SolidCashParser.T__57);
				this.state = 3133;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 358, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 3130;
						_la = this._input.LA(1);
						if(!(((((_la - 52)) & ~0x1F) === 0 && ((1 << (_la - 52)) & 25214977) !== 0))) {
						this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						}
						}
					}
					this.state = 3135;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 358, this._ctx);
				}
				this.state = 3148;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 360, this._ctx) ) {
				case 1:
					{
					this.state = 3136;
					this.match(SolidCashParser.T__77);
					this.state = 3137;
					this.match(SolidCashParser.T__56);
					this.state = 3138;
					this.functionTypeReturnParameter();
					this.state = 3143;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===5) {
						{
						{
						this.state = 3139;
						this.match(SolidCashParser.T__4);
						this.state = 3140;
						this.functionTypeReturnParameter();
						}
						}
						this.state = 3145;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					this.state = 3146;
					this.match(SolidCashParser.T__57);
					}
					break;
				}
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 3150;
				this.match(SolidCashParser.Identifier);
				this.state = 3151;
				this.match(SolidCashParser.T__6);
				this.state = 3152;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 3153;
				this.match(SolidCashParser.T__33);
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 3154;
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
	public functionTypeParameter(): FunctionTypeParameterContext {
		let localctx: FunctionTypeParameterContext = new FunctionTypeParameterContext(this, this._ctx, this.state);
		this.enterRule(localctx, 294, SolidCashParser.RULE_functionTypeParameter);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3160;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 362, this._ctx) ) {
			case 1:
				{
				this.state = 3157;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 3158;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 3159;
				this.mappingType();
				}
				break;
			}
			this.state = 3163;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 363, this._ctx) ) {
			case 1:
				{
				this.state = 3162;
				this.dataLocation();
				}
				break;
			}
			this.state = 3166;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 364, this._ctx) ) {
			case 1:
				{
				this.state = 3165;
				this.anyIdentifier();
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
	public functionTypeReturnParameter(): FunctionTypeReturnParameterContext {
		let localctx: FunctionTypeReturnParameterContext = new FunctionTypeReturnParameterContext(this, this._ctx, this.state);
		this.enterRule(localctx, 296, SolidCashParser.RULE_functionTypeReturnParameter);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3171;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 365, this._ctx) ) {
			case 1:
				{
				this.state = 3168;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 3169;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 3170;
				this.mappingType();
				}
				break;
			}
			this.state = 3174;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 136)) & ~0x1F) === 0 && ((1 << (_la - 136)) & 7) !== 0)) {
				{
				this.state = 3173;
				this.dataLocation();
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
	public typeCast(): TypeCastContext {
		let localctx: TypeCastContext = new TypeCastContext(this, this._ctx, this.state);
		this.enterRule(localctx, 298, SolidCashParser.RULE_typeCast);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3176;
			_la = this._input.LA(1);
			if(!(((((_la - 67)) & ~0x1F) === 0 && ((1 << (_la - 67)) & 28673) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15887) !== 0))) {
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
	public arrayCastType(): ArrayCastTypeContext {
		let localctx: ArrayCastTypeContext = new ArrayCastTypeContext(this, this._ctx, this.state);
		this.enterRule(localctx, 300, SolidCashParser.RULE_arrayCastType);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3178;
			this.typeCast();
			this.state = 3184;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 3179;
				this.match(SolidCashParser.T__71);
				this.state = 3181;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 367, this._ctx) ) {
				case 1:
					{
					this.state = 3180;
					this.expression(0);
					}
					break;
				}
				this.state = 3183;
				this.match(SolidCashParser.T__72);
				}
				}
				this.state = 3186;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===72);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
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
		case 8:
			return this.anyIdentifier_sempred(localctx as AnyIdentifierContext, predIndex);
		case 46:
			return this.arrayType_sempred(localctx as ArrayTypeContext, predIndex);
		case 78:
			return this.nestedTupleAssignment_sempred(localctx as NestedTupleAssignmentContext, predIndex);
		case 136:
			return this.expression_sempred(localctx as ExpressionContext, predIndex);
		}
		return true;
	}
	private anyIdentifier_sempred(localctx: AnyIdentifierContext, predIndex: number): boolean {
		switch (predIndex) {
		case 0:
			return this.isMalformedBoundedTypeName(this._input.LT(1).text ?? '');
		}
		return true;
	}
	private arrayType_sempred(localctx: ArrayTypeContext, predIndex: number): boolean {
		switch (predIndex) {
		case 1:
			return this.precpred(this._ctx, 1);
		}
		return true;
	}
	private nestedTupleAssignment_sempred(localctx: NestedTupleAssignmentContext, predIndex: number): boolean {
		switch (predIndex) {
		case 2:
			return this._input.LT(1).text === '(' && this._input.LT(2).text === '(';
		}
		return true;
	}
	private expression_sempred(localctx: ExpressionContext, predIndex: number): boolean {
		switch (predIndex) {
		case 3:
			return this.precpred(this._ctx, 20);
		case 4:
			return this.precpred(this._ctx, 19);
		case 5:
			return this.precpred(this._ctx, 18);
		case 6:
			return this.precpred(this._ctx, 17);
		case 7:
			return this.precpred(this._ctx, 16);
		case 8:
			return this.precpred(this._ctx, 15);
		case 9:
			return this.precpred(this._ctx, 14);
		case 10:
			return this.precpred(this._ctx, 13);
		case 11:
			return this.precpred(this._ctx, 12);
		case 12:
			return this.precpred(this._ctx, 11);
		case 13:
			return this.precpred(this._ctx, 10);
		case 14:
			return this.precpred(this._ctx, 40);
		case 15:
			return this.precpred(this._ctx, 39);
		case 16:
			return this.precpred(this._ctx, 38);
		case 17:
			return this.precpred(this._ctx, 35);
		case 18:
			return this.precpred(this._ctx, 34);
		case 19:
			return this.precpred(this._ctx, 33);
		case 20:
			return this.precpred(this._ctx, 32);
		case 21:
			return this.precpred(this._ctx, 31);
		case 22:
			return this.precpred(this._ctx, 30);
		case 23:
			return this.precpred(this._ctx, 29);
		case 24:
			return this.precpred(this._ctx, 28);
		case 25:
			return this.precpred(this._ctx, 27);
		case 26:
			return this.precpred(this._ctx, 26);
		case 27:
			return this.precpred(this._ctx, 25);
		case 28:
			return this.precpred(this._ctx, 24);
		case 29:
			return this.precpred(this._ctx, 23);
		case 30:
			return this.precpred(this._ctx, 9);
		}
		return true;
	}

	public static readonly _serializedATN: number[] = [4,1,183,3189,2,0,7,0,
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
	7,133,2,134,7,134,2,135,7,135,2,136,7,136,2,137,7,137,2,138,7,138,2,139,
	7,139,2,140,7,140,2,141,7,141,2,142,7,142,2,143,7,143,2,144,7,144,2,145,
	7,145,2,146,7,146,2,147,7,147,2,148,7,148,2,149,7,149,2,150,7,150,1,0,5,
	0,304,8,0,10,0,12,0,307,9,0,1,0,1,0,5,0,311,8,0,10,0,12,0,314,9,0,1,0,1,
	0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,5,0,328,8,0,10,0,12,0,331,9,0,
	1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,5,1,348,8,1,
	10,1,12,1,351,9,1,1,1,3,1,354,8,1,1,1,1,1,1,1,1,1,1,1,3,1,361,8,1,1,2,1,
	2,1,2,3,2,366,8,2,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,
	3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,3,3,394,8,3,1,3,1,3,1,
	3,1,3,3,3,400,8,3,5,3,402,8,3,10,3,12,3,405,9,3,1,3,1,3,1,3,1,3,1,3,1,3,
	3,3,413,8,3,1,4,1,4,1,4,1,4,1,4,5,4,420,8,4,10,4,12,4,423,9,4,1,4,3,4,426,
	8,4,1,4,1,4,5,4,430,8,4,10,4,12,4,433,9,4,1,4,1,4,1,5,1,5,1,5,1,5,1,5,1,
	5,1,5,3,5,444,8,5,1,5,3,5,447,8,5,1,5,1,5,1,5,1,5,1,5,1,5,5,5,455,8,5,10,
	5,12,5,458,9,5,1,5,3,5,461,8,5,1,5,1,5,1,5,1,5,1,5,1,5,3,5,469,8,5,1,5,
	3,5,472,8,5,1,5,1,5,3,5,476,8,5,1,6,1,6,1,6,3,6,481,8,6,1,6,1,6,3,6,485,
	8,6,1,7,1,7,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,
	1,8,1,8,1,8,1,8,1,8,3,8,509,8,8,1,9,1,9,1,9,3,9,514,8,9,1,10,1,10,1,10,
	1,10,1,10,1,10,1,10,1,10,5,10,524,8,10,10,10,12,10,527,9,10,1,10,3,10,530,
	8,10,1,11,1,11,1,12,1,12,1,12,5,12,537,8,12,10,12,12,12,540,9,12,1,12,3,
	12,543,8,12,1,13,1,13,1,13,1,13,1,13,4,13,550,8,13,11,13,12,13,551,3,13,
	554,8,13,1,14,3,14,557,8,14,1,14,1,14,1,15,1,15,1,16,1,16,1,16,1,16,1,16,
	1,16,5,16,569,8,16,10,16,12,16,572,9,16,3,16,574,8,16,1,16,1,16,1,16,1,
	16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,5,16,587,8,16,10,16,12,16,590,9,16,
	1,16,1,16,1,17,1,17,1,17,1,17,1,17,1,17,1,17,1,17,1,17,1,17,3,17,604,8,
	17,1,18,1,18,1,18,1,18,1,18,1,19,1,19,1,20,1,20,1,20,1,20,5,20,617,8,20,
	10,20,12,20,620,9,20,1,20,3,20,623,8,20,1,20,1,20,1,21,1,21,1,21,5,21,630,
	8,21,10,21,12,21,633,9,21,1,21,1,21,5,21,637,8,21,10,21,12,21,640,9,21,
	1,21,3,21,643,8,21,1,21,1,21,1,22,1,22,1,22,1,22,1,22,1,22,1,22,1,22,1,
	22,1,22,1,22,1,22,1,22,5,22,660,8,22,10,22,12,22,663,9,22,1,22,1,22,1,23,
	3,23,668,8,23,1,23,1,23,1,23,3,23,673,8,23,1,23,1,23,1,23,1,23,5,23,679,
	8,23,10,23,12,23,682,9,23,3,23,684,8,23,1,23,1,23,1,23,1,23,1,23,1,23,1,
	23,1,23,1,23,1,23,1,23,1,23,1,23,1,23,1,23,5,23,701,8,23,10,23,12,23,704,
	9,23,1,23,1,23,1,24,1,24,3,24,710,8,24,1,25,1,25,1,25,1,25,1,25,5,25,717,
	8,25,10,25,12,25,720,9,25,1,25,3,25,723,8,25,1,25,1,25,1,26,1,26,1,26,1,
	26,1,26,1,26,5,26,733,8,26,10,26,12,26,736,9,26,1,26,3,26,739,8,26,3,26,
	741,8,26,1,26,1,26,3,26,745,8,26,1,26,1,26,1,27,1,27,3,27,751,8,27,1,27,
	3,27,754,8,27,1,27,3,27,757,8,27,1,28,1,28,1,28,1,28,1,28,1,28,5,28,765,
	8,28,10,28,12,28,768,9,28,1,28,3,28,771,8,28,3,28,773,8,28,1,28,1,28,1,
	28,1,29,1,29,3,29,780,8,29,1,29,1,29,3,29,784,8,29,3,29,786,8,29,1,30,1,
	30,1,30,1,30,4,30,792,8,30,11,30,12,30,793,1,30,1,30,1,31,1,31,1,31,3,31,
	801,8,31,1,31,1,31,1,31,1,32,1,32,1,32,1,32,1,32,1,32,5,32,812,8,32,10,
	32,12,32,815,9,32,1,32,3,32,818,8,32,1,32,1,32,1,33,1,33,1,33,3,33,825,
	8,33,1,34,1,34,1,34,1,34,1,34,1,34,1,35,1,35,1,35,1,35,1,35,1,35,1,35,1,
	36,1,36,1,36,5,36,843,8,36,10,36,12,36,846,9,36,1,36,5,36,849,8,36,10,36,
	12,36,852,9,36,1,36,5,36,855,8,36,10,36,12,36,858,9,36,1,36,5,36,861,8,
	36,10,36,12,36,864,9,36,1,36,1,36,5,36,868,8,36,10,36,12,36,871,9,36,1,
	36,1,36,1,37,1,37,1,37,5,37,878,8,37,10,37,12,37,881,9,37,1,37,1,37,5,37,
	885,8,37,10,37,12,37,888,9,37,1,37,5,37,891,8,37,10,37,12,37,894,9,37,1,
	37,3,37,897,8,37,1,37,1,37,5,37,901,8,37,10,37,12,37,904,9,37,1,37,1,37,
	1,38,1,38,1,38,3,38,911,8,38,1,39,1,39,1,39,1,39,5,39,917,8,39,10,39,12,
	39,920,9,39,1,39,1,39,5,39,924,8,39,10,39,12,39,927,9,39,1,39,1,39,5,39,
	931,8,39,10,39,12,39,934,9,39,1,39,1,39,5,39,938,8,39,10,39,12,39,941,9,
	39,1,39,1,39,3,39,945,8,39,1,39,1,39,1,39,1,39,5,39,951,8,39,10,39,12,39,
	954,9,39,1,39,1,39,5,39,958,8,39,10,39,12,39,961,9,39,1,39,1,39,5,39,965,
	8,39,10,39,12,39,968,9,39,1,39,1,39,5,39,972,8,39,10,39,12,39,975,9,39,
	1,39,1,39,3,39,979,8,39,3,39,981,8,39,1,40,1,40,3,40,985,8,40,1,41,1,41,
	1,41,1,42,3,42,991,8,42,1,42,1,42,1,42,5,42,996,8,42,10,42,12,42,999,9,
	42,1,42,1,42,1,42,3,42,1004,8,42,1,42,1,42,1,42,1,42,1,42,5,42,1011,8,42,
	10,42,12,42,1014,9,42,1,42,1,42,1,42,5,42,1019,8,42,10,42,12,42,1022,9,
	42,1,42,1,42,1,42,3,42,1027,8,42,1,42,1,42,1,42,3,42,1032,8,42,1,42,3,42,
	1035,8,42,1,42,1,42,5,42,1039,8,42,10,42,12,42,1042,9,42,1,42,1,42,1,42,
	1,42,3,42,1048,8,42,1,42,1,42,5,42,1052,8,42,10,42,12,42,1055,9,42,1,42,
	1,42,1,42,3,42,1060,8,42,1,42,1,42,3,42,1064,8,42,1,43,1,43,1,43,3,43,1069,
	8,43,1,44,1,44,1,45,1,45,1,45,1,45,3,45,1077,8,45,1,45,1,45,1,45,3,45,1082,
	8,45,1,45,1,45,1,45,1,45,1,45,1,45,3,45,1090,8,45,1,45,1,45,1,45,3,45,1095,
	8,45,1,45,1,45,1,45,1,45,1,45,1,45,3,45,1103,8,45,1,45,1,45,1,45,3,45,1108,
	8,45,1,45,1,45,3,45,1112,8,45,1,46,1,46,1,46,1,46,3,46,1118,8,46,1,46,1,
	46,1,46,1,46,1,46,3,46,1125,8,46,1,46,1,46,3,46,1129,8,46,1,46,1,46,1,46,
	3,46,1134,8,46,1,46,5,46,1137,8,46,10,46,12,46,1140,9,46,1,47,1,47,1,47,
	3,47,1145,8,47,1,47,1,47,5,47,1149,8,47,10,47,12,47,1152,9,47,1,47,1,47,
	5,47,1156,8,47,10,47,12,47,1159,9,47,1,47,1,47,3,47,1163,8,47,1,48,1,48,
	3,48,1167,8,48,1,49,1,49,1,49,1,50,1,50,1,50,1,50,1,50,5,50,1177,8,50,10,
	50,12,50,1180,9,50,1,50,3,50,1183,8,50,1,50,1,50,5,50,1187,8,50,10,50,12,
	50,1190,9,50,1,50,1,50,1,51,1,51,3,51,1196,8,51,1,51,1,51,3,51,1200,8,51,
	1,52,1,52,1,52,1,52,1,52,1,52,1,52,1,52,1,52,1,52,1,52,1,52,1,52,3,52,1215,
	8,52,1,53,1,53,1,53,1,53,1,53,5,53,1222,8,53,10,53,12,53,1225,9,53,1,53,
	3,53,1228,8,53,1,54,1,54,1,54,1,54,3,54,1234,8,54,1,55,1,55,1,55,1,55,1,
	55,5,55,1241,8,55,10,55,12,55,1244,9,55,1,55,3,55,1247,8,55,1,55,1,55,1,
	56,1,56,5,56,1253,8,56,10,56,12,56,1256,9,56,1,56,3,56,1259,8,56,1,56,1,
	56,5,56,1263,8,56,10,56,12,56,1266,9,56,1,56,3,56,1269,8,56,1,56,1,56,5,
	56,1273,8,56,10,56,12,56,1276,9,56,1,56,3,56,1279,8,56,3,56,1281,8,56,1,
	57,1,57,1,57,1,57,5,57,1287,8,57,10,57,12,57,1290,9,57,1,57,3,57,1293,8,
	57,3,57,1295,8,57,1,57,1,57,1,58,1,58,5,58,1301,8,58,10,58,12,58,1304,9,
	58,1,58,3,58,1307,8,58,1,58,1,58,5,58,1311,8,58,10,58,12,58,1314,9,58,1,
	58,3,58,1317,8,58,1,58,1,58,5,58,1321,8,58,10,58,12,58,1324,9,58,1,58,3,
	58,1327,8,58,3,58,1329,8,58,1,59,1,59,5,59,1333,8,59,10,59,12,59,1336,9,
	59,1,59,1,59,3,59,1340,8,59,1,60,1,60,5,60,1344,8,60,10,60,12,60,1347,9,
	60,1,60,1,60,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,
	1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,
	61,1,61,1,61,1,61,1,61,3,61,1382,8,61,1,62,1,62,1,62,3,62,1387,8,62,1,62,
	5,62,1390,8,62,10,62,12,62,1393,9,62,1,62,1,62,1,62,1,62,1,62,1,62,3,62,
	1401,8,62,1,62,4,62,1404,8,62,11,62,12,62,1405,1,62,1,62,1,62,3,62,1411,
	8,62,1,63,1,63,1,63,3,63,1416,8,63,1,63,5,63,1419,8,63,10,63,12,63,1422,
	9,63,1,63,1,63,1,63,1,63,3,63,1428,8,63,1,63,5,63,1431,8,63,10,63,12,63,
	1434,9,63,1,63,1,63,1,64,1,64,1,64,1,64,1,64,1,64,1,64,1,64,1,64,1,64,1,
	64,1,64,3,64,1450,8,64,3,64,1452,8,64,1,65,1,65,1,65,1,65,1,65,1,65,1,66,
	1,66,1,66,1,66,1,66,3,66,1465,8,66,1,66,1,66,1,67,1,67,1,67,1,67,3,67,1473,
	8,67,1,68,1,68,1,68,1,68,1,68,1,69,1,69,1,69,3,69,1483,8,69,1,69,1,69,1,
	69,1,69,1,69,1,69,1,69,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,
	1,70,1,70,1,70,1,70,3,70,1506,8,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,
	70,1,70,1,70,1,70,1,70,1,70,1,70,3,70,1522,8,70,3,70,1524,8,70,1,70,1,70,
	1,70,1,70,1,70,1,70,3,70,1532,8,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,
	70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,3,70,1554,
	8,70,3,70,1556,8,70,1,70,1,70,1,70,3,70,1561,8,70,1,70,1,70,1,70,1,70,1,
	70,1,70,1,70,1,70,1,70,1,70,3,70,1573,8,70,1,70,1,70,1,71,1,71,1,71,3,71,
	1580,8,71,1,72,1,72,1,72,1,72,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,
	73,1,73,1,73,1,73,5,73,1598,8,73,10,73,12,73,1601,9,73,1,73,1,73,1,73,1,
	73,1,73,1,73,1,73,5,73,1610,8,73,10,73,12,73,1613,9,73,1,73,3,73,1616,8,
	73,1,73,1,73,1,73,3,73,1621,8,73,1,74,1,74,1,74,1,74,1,74,1,74,1,75,1,75,
	1,75,1,75,3,75,1633,8,75,1,75,1,75,1,75,1,75,1,75,5,75,1640,8,75,10,75,
	12,75,1643,9,75,1,75,3,75,1646,8,75,3,75,1648,8,75,1,75,1,75,1,75,1,75,
	1,75,1,75,1,75,3,75,1657,8,75,1,75,1,75,1,75,3,75,1662,8,75,1,76,1,76,5,
	76,1666,8,76,10,76,12,76,1669,9,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,
	76,3,76,1679,8,76,3,76,1681,8,76,1,76,1,76,1,76,1,76,5,76,1687,8,76,10,
	76,12,76,1690,9,76,1,76,1,76,1,76,1,76,1,76,1,76,3,76,1698,8,76,3,76,1700,
	8,76,1,76,1,76,1,76,1,76,5,76,1706,8,76,10,76,12,76,1709,9,76,1,76,1,76,
	1,76,3,76,1714,8,76,1,76,1,76,3,76,1718,8,76,1,77,1,77,1,77,1,77,1,77,1,
	77,4,77,1726,8,77,11,77,12,77,1727,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,
	77,4,77,1738,8,77,11,77,12,77,1739,1,77,1,77,1,77,1,77,1,77,1,77,4,77,1748,
	8,77,11,77,12,77,1749,1,77,1,77,1,77,1,77,1,77,1,77,1,77,4,77,1759,8,77,
	11,77,12,77,1760,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,5,77,1771,8,77,
	10,77,12,77,1774,9,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,5,77,
	1785,8,77,10,77,12,77,1788,9,77,1,77,1,77,1,77,1,77,1,77,1,77,3,77,1796,
	8,77,1,78,1,78,1,78,1,78,1,78,1,78,1,79,1,79,3,79,1806,8,79,1,79,1,79,3,
	79,1810,8,79,5,79,1812,8,79,10,79,12,79,1815,9,79,1,79,1,79,1,80,1,80,5,
	80,1821,8,80,10,80,12,80,1824,9,80,1,80,1,80,1,80,1,80,5,80,1830,8,80,10,
	80,12,80,1833,9,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,1,80,5,80,1844,
	8,80,10,80,12,80,1847,9,80,1,80,3,80,1850,8,80,1,81,1,81,5,81,1854,8,81,
	10,81,12,81,1857,9,81,1,81,1,81,1,81,1,81,5,81,1863,8,81,10,81,12,81,1866,
	9,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,5,81,1877,8,81,10,81,
	12,81,1880,9,81,1,81,3,81,1883,8,81,1,82,1,82,1,83,1,83,1,83,1,83,1,83,
	1,83,1,83,1,83,1,83,1,83,1,83,1,83,1,83,1,83,1,83,1,83,1,83,1,83,1,83,1,
	83,1,83,1,83,4,83,1909,8,83,11,83,12,83,1910,1,83,1,83,1,83,1,83,1,83,1,
	83,1,83,1,83,4,83,1921,8,83,11,83,12,83,1922,1,83,1,83,1,83,1,83,1,83,1,
	83,5,83,1931,8,83,10,83,12,83,1934,9,83,4,83,1936,8,83,11,83,12,83,1937,
	1,83,1,83,1,83,1,83,1,83,1,83,1,83,1,83,4,83,1948,8,83,11,83,12,83,1949,
	1,83,1,83,1,83,1,83,1,83,1,83,4,83,1958,8,83,11,83,12,83,1959,1,83,1,83,
	1,83,1,83,4,83,1966,8,83,11,83,12,83,1967,1,83,1,83,1,83,1,83,1,83,1,83,
	4,83,1976,8,83,11,83,12,83,1977,1,83,3,83,1981,8,83,1,84,1,84,1,84,1,84,
	1,84,1,84,1,84,3,84,1990,8,84,1,84,1,84,1,84,1,85,1,85,1,85,1,85,1,85,3,
	85,2000,8,85,1,85,1,85,1,85,1,86,1,86,1,86,1,86,1,86,1,86,1,86,3,86,2012,
	8,86,1,87,1,87,1,87,1,87,1,87,1,87,3,87,2020,8,87,1,88,1,88,1,88,1,88,1,
	88,1,88,1,88,1,88,1,88,1,88,1,88,1,88,1,88,1,88,1,88,1,88,1,89,1,89,1,89,
	1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,90,1,90,1,90,1,90,1,90,1,90,1,
	90,1,90,1,90,1,90,1,90,1,91,1,91,1,91,1,91,1,91,3,91,2065,8,91,1,91,1,91,
	1,91,1,92,1,92,5,92,2072,8,92,10,92,12,92,2075,9,92,1,92,1,92,1,92,3,92,
	2080,8,92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,4,92,2093,
	8,92,11,92,12,92,2094,1,92,1,92,1,92,1,92,1,92,1,92,4,92,2103,8,92,11,92,
	12,92,2104,1,92,1,92,1,92,3,92,2110,8,92,1,92,1,92,1,92,3,92,2115,8,92,
	1,93,3,93,2118,8,93,1,93,1,93,1,94,1,94,1,94,1,94,1,94,1,94,1,94,1,94,1,
	94,1,94,1,94,4,94,2133,8,94,11,94,12,94,2134,1,94,1,94,1,94,1,94,1,94,1,
	94,4,94,2143,8,94,11,94,12,94,2144,1,94,1,94,1,94,3,94,2150,8,94,1,94,3,
	94,2153,8,94,1,95,1,95,1,95,1,95,1,95,1,95,1,95,1,95,1,96,1,96,1,96,1,96,
	1,96,1,96,1,97,1,97,1,97,1,97,1,98,1,98,3,98,2175,8,98,1,98,1,98,1,98,1,
	98,5,98,2181,8,98,10,98,12,98,2184,9,98,1,98,3,98,2187,8,98,1,98,1,98,1,
	99,1,99,5,99,2193,8,99,10,99,12,99,2196,9,99,1,99,1,99,1,100,1,100,1,100,
	1,100,1,100,1,100,1,100,1,100,1,100,1,100,1,100,1,100,1,100,3,100,2213,
	8,100,1,101,1,101,1,101,1,101,5,101,2219,8,101,10,101,12,101,2222,9,101,
	1,101,1,101,3,101,2226,8,101,1,102,1,102,1,102,5,102,2231,8,102,10,102,
	12,102,2234,9,102,1,102,1,102,1,102,1,103,1,103,1,103,1,103,1,104,1,104,
	1,104,4,104,2246,8,104,11,104,12,104,2247,1,104,3,104,2251,8,104,1,104,
	3,104,2254,8,104,1,105,1,105,1,105,1,105,1,106,1,106,1,106,1,107,1,107,
	1,107,1,107,1,107,1,107,1,108,1,108,1,108,1,108,1,108,1,108,5,108,2275,
	8,108,10,108,12,108,2278,9,108,3,108,2280,8,108,1,108,1,108,1,108,1,108,
	1,108,5,108,2287,8,108,10,108,12,108,2290,9,108,3,108,2292,8,108,1,108,
	1,108,1,109,1,109,1,109,3,109,2299,8,109,1,110,1,110,1,110,1,110,1,110,
	5,110,2306,8,110,10,110,12,110,2309,9,110,3,110,2311,8,110,1,110,1,110,
	1,111,1,111,1,112,1,112,1,112,1,112,1,112,1,112,5,112,2323,8,112,10,112,
	12,112,2326,9,112,1,113,1,113,1,114,1,114,1,114,5,114,2333,8,114,10,114,
	12,114,2336,9,114,1,114,1,114,1,115,1,115,1,115,1,115,1,115,1,115,5,115,
	2346,8,115,10,115,12,115,2349,9,115,1,115,3,115,2352,8,115,1,115,1,115,
	1,116,1,116,1,116,1,116,5,116,2360,8,116,10,116,12,116,2363,9,116,1,117,
	1,117,1,117,5,117,2368,8,117,10,117,12,117,2371,9,117,1,118,1,118,1,118,
	3,118,2376,8,118,1,118,1,118,4,118,2380,8,118,11,118,12,118,2381,1,119,
	1,119,1,119,1,119,1,119,5,119,2389,8,119,10,119,12,119,2392,9,119,1,119,
	3,119,2395,8,119,3,119,2397,8,119,1,119,1,119,1,120,1,120,3,120,2403,8,
	120,1,120,1,120,1,120,1,120,5,120,2409,8,120,10,120,12,120,2412,9,120,1,
	120,3,120,2415,8,120,3,120,2417,8,120,1,120,3,120,2420,8,120,1,120,1,120,
	1,121,1,121,1,121,1,122,1,122,1,122,1,123,1,123,1,123,1,123,3,123,2434,
	8,123,1,124,1,124,1,124,1,124,3,124,2440,8,124,1,124,1,124,1,124,1,124,
	1,124,5,124,2447,8,124,10,124,12,124,2450,9,124,1,124,3,124,2453,8,124,
	3,124,2455,8,124,1,124,1,124,1,124,1,124,1,124,1,124,1,124,1,124,3,124,
	2465,8,124,1,124,1,124,1,124,1,124,1,124,1,124,1,124,1,124,1,124,1,124,
	1,124,1,124,1,124,3,124,2480,8,124,1,125,1,125,1,125,1,125,1,125,1,125,
	1,126,1,126,3,126,2490,8,126,1,127,1,127,1,127,1,127,5,127,2496,8,127,10,
	127,12,127,2499,9,127,1,127,3,127,2502,8,127,3,127,2504,8,127,1,127,1,127,
	1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,
	1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,5,128,2528,8,128,10,128,
	12,128,2531,9,128,1,128,3,128,2534,8,128,3,128,2536,8,128,1,128,1,128,1,
	128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,
	128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,5,128,2560,8,128,10,128,12,
	128,2563,9,128,1,128,3,128,2566,8,128,3,128,2568,8,128,1,128,1,128,3,128,
	2572,8,128,1,129,1,129,1,129,1,129,1,130,1,130,1,130,1,130,5,130,2582,8,
	130,10,130,12,130,2585,9,130,1,130,3,130,2588,8,130,3,130,2590,8,130,1,
	130,1,130,1,131,1,131,1,131,3,131,2597,8,131,1,132,1,132,1,132,1,132,5,
	132,2603,8,132,10,132,12,132,2606,9,132,1,132,3,132,2609,8,132,1,132,1,
	132,1,133,1,133,1,133,1,133,1,134,1,134,1,134,1,134,5,134,2621,8,134,10,
	134,12,134,2624,9,134,1,134,3,134,2627,8,134,3,134,2629,8,134,1,134,1,134,
	1,135,1,135,1,135,1,135,1,135,1,135,1,135,3,135,2640,8,135,1,135,5,135,
	2643,8,135,10,135,12,135,2646,9,135,3,135,2648,8,135,1,136,1,136,1,136,
	1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,
	1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,4,136,2674,8,136,
	11,136,12,136,2675,1,136,1,136,1,136,1,136,1,136,1,136,3,136,2684,8,136,
	1,136,1,136,1,136,1,136,1,136,1,136,3,136,2692,8,136,1,136,1,136,1,136,
	1,136,4,136,2698,8,136,11,136,12,136,2699,1,136,1,136,1,136,1,136,1,136,
	1,136,1,136,1,136,1,136,3,136,2711,8,136,1,136,1,136,1,136,1,136,1,136,
	3,136,2718,8,136,1,136,4,136,2721,8,136,11,136,12,136,2722,1,136,1,136,
	1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,
	1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,
	1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,3,136,
	2762,8,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,
	1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,
	1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,
	1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,5,136,
	2809,8,136,10,136,12,136,2812,9,136,1,136,3,136,2815,8,136,3,136,2817,8,
	136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,
	136,1,136,1,136,1,136,1,136,1,136,1,136,4,136,2837,8,136,11,136,12,136,
	2838,1,136,1,136,1,136,1,136,1,136,1,136,1,136,3,136,2848,8,136,1,136,1,
	136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,
	136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,
	136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,3,136,2886,
	8,136,1,136,1,136,3,136,2890,8,136,1,136,1,136,1,136,1,136,1,136,1,136,
	1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,
	1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,
	1,136,1,136,3,136,2924,8,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,
	1,136,1,136,3,136,2935,8,136,1,136,1,136,1,136,1,136,1,136,5,136,2942,8,
	136,10,136,12,136,2945,9,136,1,136,3,136,2948,8,136,3,136,2950,8,136,1,
	136,1,136,1,136,1,136,1,136,1,136,3,136,2958,8,136,1,136,1,136,4,136,2962,
	8,136,11,136,12,136,2963,1,136,1,136,1,136,3,136,2969,8,136,1,136,1,136,
	1,136,1,136,3,136,2975,8,136,1,136,1,136,1,136,1,136,1,136,3,136,2982,8,
	136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,
	136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,136,3,136,3006,
	8,136,1,136,1,136,1,136,1,136,3,136,3012,8,136,5,136,3014,8,136,10,136,
	12,136,3017,9,136,1,137,1,137,1,137,1,137,1,137,1,137,1,137,1,137,1,137,
	1,137,1,137,1,137,3,137,3031,8,137,1,138,1,138,1,138,1,138,1,138,1,138,
	1,138,1,138,3,138,3041,8,138,1,139,1,139,1,139,1,140,1,140,1,140,1,140,
	1,140,1,140,1,140,1,140,1,140,1,140,1,140,1,140,1,140,1,140,1,140,1,140,
	1,140,3,140,3063,8,140,1,141,1,141,1,142,1,142,1,143,1,143,1,143,1,143,
	1,143,5,143,3074,8,143,10,143,12,143,3077,9,143,1,143,1,143,5,143,3081,
	8,143,10,143,12,143,3084,9,143,1,143,1,143,5,143,3088,8,143,10,143,12,143,
	3091,9,143,1,143,1,143,3,143,3095,8,143,1,144,1,144,3,144,3099,8,144,1,
	145,1,145,3,145,3103,8,145,1,146,1,146,1,146,1,146,1,146,1,146,1,146,1,
	146,1,146,1,146,1,146,1,146,1,146,1,146,1,146,1,146,1,146,1,146,5,146,3123,
	8,146,10,146,12,146,3126,9,146,3,146,3128,8,146,1,146,1,146,5,146,3132,
	8,146,10,146,12,146,3135,9,146,1,146,1,146,1,146,1,146,1,146,5,146,3142,
	8,146,10,146,12,146,3145,9,146,1,146,1,146,3,146,3149,8,146,1,146,1,146,
	1,146,1,146,1,146,3,146,3156,8,146,1,147,1,147,1,147,3,147,3161,8,147,1,
	147,3,147,3164,8,147,1,147,3,147,3167,8,147,1,148,1,148,1,148,3,148,3172,
	8,148,1,148,3,148,3175,8,148,1,149,1,149,1,150,1,150,1,150,3,150,3182,8,
	150,1,150,4,150,3185,8,150,11,150,12,150,3186,1,150,0,2,92,272,151,0,2,
	4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,
	54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,
	102,104,106,108,110,112,114,116,118,120,122,124,126,128,130,132,134,136,
	138,140,142,144,146,148,150,152,154,156,158,160,162,164,166,168,170,172,
	174,176,178,180,182,184,186,188,190,192,194,196,198,200,202,204,206,208,
	210,212,214,216,218,220,222,224,226,228,230,232,234,236,238,240,242,244,
	246,248,250,252,254,256,258,260,262,264,266,268,270,272,274,276,278,280,
	282,284,286,288,290,292,294,296,298,300,0,30,2,0,8,8,13,27,2,0,149,149,
	156,159,5,0,45,45,140,140,145,145,151,151,180,180,1,0,45,46,2,0,140,140,
	144,145,3,0,20,23,26,27,48,48,1,0,51,52,2,0,51,52,66,67,3,0,51,52,66,66,
	69,69,2,0,48,48,83,92,2,0,165,166,169,169,1,0,93,94,6,0,30,30,35,35,81,
	81,95,95,149,149,180,180,5,0,141,141,145,145,151,151,153,153,162,162,2,
	0,42,42,180,180,2,0,118,122,126,126,2,0,163,163,172,175,2,0,163,163,172,
	179,3,0,14,14,27,27,131,131,2,0,8,8,15,16,1,0,13,14,1,0,132,133,1,0,20,
	23,1,0,18,19,2,0,130,130,164,164,4,0,32,32,36,36,64,64,136,139,1,0,136,
	138,1,0,142,143,3,0,52,52,66,67,75,76,4,0,67,67,79,81,146,149,155,159,3682,
	0,305,1,0,0,0,2,360,1,0,0,0,4,362,1,0,0,0,6,412,1,0,0,0,8,414,1,0,0,0,10,
	475,1,0,0,0,12,477,1,0,0,0,14,486,1,0,0,0,16,508,1,0,0,0,18,513,1,0,0,0,
	20,529,1,0,0,0,22,531,1,0,0,0,24,542,1,0,0,0,26,553,1,0,0,0,28,556,1,0,
	0,0,30,560,1,0,0,0,32,562,1,0,0,0,34,603,1,0,0,0,36,605,1,0,0,0,38,610,
	1,0,0,0,40,612,1,0,0,0,42,626,1,0,0,0,44,646,1,0,0,0,46,667,1,0,0,0,48,
	707,1,0,0,0,50,711,1,0,0,0,52,726,1,0,0,0,54,750,1,0,0,0,56,758,1,0,0,0,
	58,785,1,0,0,0,60,787,1,0,0,0,62,800,1,0,0,0,64,805,1,0,0,0,66,821,1,0,
	0,0,68,826,1,0,0,0,70,832,1,0,0,0,72,839,1,0,0,0,74,874,1,0,0,0,76,910,
	1,0,0,0,78,980,1,0,0,0,80,984,1,0,0,0,82,986,1,0,0,0,84,1063,1,0,0,0,86,
	1068,1,0,0,0,88,1070,1,0,0,0,90,1111,1,0,0,0,92,1128,1,0,0,0,94,1141,1,
	0,0,0,96,1166,1,0,0,0,98,1168,1,0,0,0,100,1171,1,0,0,0,102,1195,1,0,0,0,
	104,1214,1,0,0,0,106,1216,1,0,0,0,108,1229,1,0,0,0,110,1235,1,0,0,0,112,
	1280,1,0,0,0,114,1282,1,0,0,0,116,1328,1,0,0,0,118,1339,1,0,0,0,120,1341,
	1,0,0,0,122,1381,1,0,0,0,124,1410,1,0,0,0,126,1412,1,0,0,0,128,1451,1,0,
	0,0,130,1453,1,0,0,0,132,1459,1,0,0,0,134,1472,1,0,0,0,136,1474,1,0,0,0,
	138,1479,1,0,0,0,140,1491,1,0,0,0,142,1576,1,0,0,0,144,1581,1,0,0,0,146,
	1620,1,0,0,0,148,1622,1,0,0,0,150,1661,1,0,0,0,152,1717,1,0,0,0,154,1795,
	1,0,0,0,156,1797,1,0,0,0,158,1803,1,0,0,0,160,1849,1,0,0,0,162,1882,1,0,
	0,0,164,1884,1,0,0,0,166,1980,1,0,0,0,168,1982,1,0,0,0,170,1994,1,0,0,0,
	172,2004,1,0,0,0,174,2019,1,0,0,0,176,2021,1,0,0,0,178,2037,1,0,0,0,180,
	2048,1,0,0,0,182,2059,1,0,0,0,184,2114,1,0,0,0,186,2117,1,0,0,0,188,2152,
	1,0,0,0,190,2154,1,0,0,0,192,2162,1,0,0,0,194,2168,1,0,0,0,196,2172,1,0,
	0,0,198,2190,1,0,0,0,200,2212,1,0,0,0,202,2214,1,0,0,0,204,2227,1,0,0,0,
	206,2238,1,0,0,0,208,2242,1,0,0,0,210,2255,1,0,0,0,212,2259,1,0,0,0,214,
	2262,1,0,0,0,216,2268,1,0,0,0,218,2298,1,0,0,0,220,2300,1,0,0,0,222,2314,
	1,0,0,0,224,2316,1,0,0,0,226,2327,1,0,0,0,228,2329,1,0,0,0,230,2339,1,0,
	0,0,232,2355,1,0,0,0,234,2364,1,0,0,0,236,2372,1,0,0,0,238,2383,1,0,0,0,
	240,2400,1,0,0,0,242,2423,1,0,0,0,244,2426,1,0,0,0,246,2433,1,0,0,0,248,
	2479,1,0,0,0,250,2481,1,0,0,0,252,2489,1,0,0,0,254,2491,1,0,0,0,256,2571,
	1,0,0,0,258,2573,1,0,0,0,260,2577,1,0,0,0,262,2593,1,0,0,0,264,2598,1,0,
	0,0,266,2612,1,0,0,0,268,2616,1,0,0,0,270,2647,1,0,0,0,272,2847,1,0,0,0,
	274,3030,1,0,0,0,276,3040,1,0,0,0,278,3042,1,0,0,0,280,3062,1,0,0,0,282,
	3064,1,0,0,0,284,3066,1,0,0,0,286,3094,1,0,0,0,288,3096,1,0,0,0,290,3100,
	1,0,0,0,292,3155,1,0,0,0,294,3160,1,0,0,0,296,3171,1,0,0,0,298,3176,1,0,
	0,0,300,3178,1,0,0,0,302,304,3,20,10,0,303,302,1,0,0,0,304,307,1,0,0,0,
	305,303,1,0,0,0,305,306,1,0,0,0,306,312,1,0,0,0,307,305,1,0,0,0,308,311,
	3,2,1,0,309,311,3,6,3,0,310,308,1,0,0,0,310,309,1,0,0,0,311,314,1,0,0,0,
	312,310,1,0,0,0,312,313,1,0,0,0,313,329,1,0,0,0,314,312,1,0,0,0,315,328,
	3,20,10,0,316,328,3,70,35,0,317,328,3,64,32,0,318,328,3,60,30,0,319,328,
	3,68,34,0,320,328,3,10,5,0,321,328,3,56,28,0,322,328,3,52,26,0,323,328,
	3,32,16,0,324,328,3,8,4,0,325,328,3,44,22,0,326,328,3,46,23,0,327,315,1,
	0,0,0,327,316,1,0,0,0,327,317,1,0,0,0,327,318,1,0,0,0,327,319,1,0,0,0,327,
	320,1,0,0,0,327,321,1,0,0,0,327,322,1,0,0,0,327,323,1,0,0,0,327,324,1,0,
	0,0,327,325,1,0,0,0,327,326,1,0,0,0,328,331,1,0,0,0,329,327,1,0,0,0,329,
	330,1,0,0,0,330,332,1,0,0,0,331,329,1,0,0,0,332,333,5,0,0,1,333,1,1,0,0,
	0,334,335,5,1,0,0,335,336,5,151,0,0,336,361,5,2,0,0,337,338,5,1,0,0,338,
	339,5,151,0,0,339,340,5,3,0,0,340,341,5,180,0,0,341,361,5,2,0,0,342,343,
	5,1,0,0,343,344,5,4,0,0,344,349,3,4,2,0,345,346,5,5,0,0,346,348,3,4,2,0,
	347,345,1,0,0,0,348,351,1,0,0,0,349,347,1,0,0,0,349,350,1,0,0,0,350,353,
	1,0,0,0,351,349,1,0,0,0,352,354,5,5,0,0,353,352,1,0,0,0,353,354,1,0,0,0,
	354,355,1,0,0,0,355,356,5,6,0,0,356,357,5,180,0,0,357,358,5,151,0,0,358,
	359,5,2,0,0,359,361,1,0,0,0,360,334,1,0,0,0,360,337,1,0,0,0,360,342,1,0,
	0,0,361,3,1,0,0,0,362,365,5,180,0,0,363,364,5,3,0,0,364,366,5,180,0,0,365,
	363,1,0,0,0,365,366,1,0,0,0,366,5,1,0,0,0,367,368,5,1,0,0,368,369,5,180,
	0,0,369,370,5,7,0,0,370,371,5,180,0,0,371,413,5,2,0,0,372,373,5,1,0,0,373,
	374,5,180,0,0,374,375,5,7,0,0,375,376,5,180,0,0,376,377,5,3,0,0,377,378,
	5,180,0,0,378,413,5,2,0,0,379,380,5,1,0,0,380,381,5,8,0,0,381,382,5,3,0,
	0,382,383,5,180,0,0,383,384,5,180,0,0,384,385,5,180,0,0,385,386,5,7,0,0,
	386,387,5,180,0,0,387,413,5,2,0,0,388,389,5,1,0,0,389,390,5,4,0,0,390,393,
	5,180,0,0,391,392,5,3,0,0,392,394,5,180,0,0,393,391,1,0,0,0,393,394,1,0,
	0,0,394,403,1,0,0,0,395,396,5,5,0,0,396,399,5,180,0,0,397,398,5,3,0,0,398,
	400,5,180,0,0,399,397,1,0,0,0,399,400,1,0,0,0,400,402,1,0,0,0,401,395,1,
	0,0,0,402,405,1,0,0,0,403,401,1,0,0,0,403,404,1,0,0,0,404,406,1,0,0,0,405,
	403,1,0,0,0,406,407,5,6,0,0,407,408,5,180,0,0,408,409,5,180,0,0,409,410,
	5,7,0,0,410,411,5,180,0,0,411,413,5,2,0,0,412,367,1,0,0,0,412,372,1,0,0,
	0,412,379,1,0,0,0,412,388,1,0,0,0,413,7,1,0,0,0,414,415,5,9,0,0,415,416,
	3,18,9,0,416,421,3,114,57,0,417,420,3,104,52,0,418,420,3,102,51,0,419,417,
	1,0,0,0,419,418,1,0,0,0,420,423,1,0,0,0,421,419,1,0,0,0,421,422,1,0,0,0,
	422,425,1,0,0,0,423,421,1,0,0,0,424,426,3,110,55,0,425,424,1,0,0,0,425,
	426,1,0,0,0,426,427,1,0,0,0,427,431,5,4,0,0,428,430,3,122,61,0,429,428,
	1,0,0,0,430,433,1,0,0,0,431,429,1,0,0,0,431,432,1,0,0,0,432,434,1,0,0,0,
	433,431,1,0,0,0,434,435,5,6,0,0,435,9,1,0,0,0,436,437,5,10,0,0,437,438,
	5,180,0,0,438,443,5,11,0,0,439,444,3,92,46,0,440,444,3,90,45,0,441,444,
	3,292,146,0,442,444,5,8,0,0,443,439,1,0,0,0,443,440,1,0,0,0,443,441,1,0,
	0,0,443,442,1,0,0,0,444,446,1,0,0,0,445,447,5,12,0,0,446,445,1,0,0,0,446,
	447,1,0,0,0,447,448,1,0,0,0,448,476,5,2,0,0,449,450,5,10,0,0,450,451,5,
	4,0,0,451,456,3,12,6,0,452,453,5,5,0,0,453,455,3,12,6,0,454,452,1,0,0,0,
	455,458,1,0,0,0,456,454,1,0,0,0,456,457,1,0,0,0,457,460,1,0,0,0,458,456,
	1,0,0,0,459,461,5,5,0,0,460,459,1,0,0,0,460,461,1,0,0,0,461,462,1,0,0,0,
	462,463,5,6,0,0,463,468,5,11,0,0,464,469,3,92,46,0,465,469,3,90,45,0,466,
	469,3,292,146,0,467,469,5,8,0,0,468,464,1,0,0,0,468,465,1,0,0,0,468,466,
	1,0,0,0,468,467,1,0,0,0,469,471,1,0,0,0,470,472,5,12,0,0,471,470,1,0,0,
	0,471,472,1,0,0,0,472,473,1,0,0,0,473,474,5,2,0,0,474,476,1,0,0,0,475,436,
	1,0,0,0,475,449,1,0,0,0,476,11,1,0,0,0,477,480,5,180,0,0,478,479,5,7,0,
	0,479,481,5,180,0,0,480,478,1,0,0,0,480,481,1,0,0,0,481,484,1,0,0,0,482,
	483,5,3,0,0,483,485,3,14,7,0,484,482,1,0,0,0,484,485,1,0,0,0,485,13,1,0,
	0,0,486,487,7,0,0,0,487,15,1,0,0,0,488,509,5,180,0,0,489,509,5,28,0,0,490,
	509,5,29,0,0,491,509,5,30,0,0,492,509,5,31,0,0,493,509,5,32,0,0,494,509,
	5,33,0,0,495,509,5,34,0,0,496,509,5,12,0,0,497,509,5,35,0,0,498,509,5,36,
	0,0,499,509,5,37,0,0,500,509,5,38,0,0,501,509,5,39,0,0,502,509,5,40,0,0,
	503,509,5,41,0,0,504,509,5,147,0,0,505,509,5,143,0,0,506,507,4,8,0,0,507,
	509,7,1,0,0,508,488,1,0,0,0,508,489,1,0,0,0,508,490,1,0,0,0,508,491,1,0,
	0,0,508,492,1,0,0,0,508,493,1,0,0,0,508,494,1,0,0,0,508,495,1,0,0,0,508,
	496,1,0,0,0,508,497,1,0,0,0,508,498,1,0,0,0,508,499,1,0,0,0,508,500,1,0,
	0,0,508,501,1,0,0,0,508,502,1,0,0,0,508,503,1,0,0,0,508,504,1,0,0,0,508,
	505,1,0,0,0,508,506,1,0,0,0,509,17,1,0,0,0,510,514,3,16,8,0,511,514,5,42,
	0,0,512,514,5,43,0,0,513,510,1,0,0,0,513,511,1,0,0,0,513,512,1,0,0,0,514,
	19,1,0,0,0,515,516,5,44,0,0,516,517,3,22,11,0,517,518,3,24,12,0,518,519,
	5,2,0,0,519,530,1,0,0,0,520,521,5,44,0,0,521,525,5,180,0,0,522,524,7,2,
	0,0,523,522,1,0,0,0,524,527,1,0,0,0,525,523,1,0,0,0,525,526,1,0,0,0,526,
	528,1,0,0,0,527,525,1,0,0,0,528,530,5,2,0,0,529,515,1,0,0,0,529,520,1,0,
	0,0,530,21,1,0,0,0,531,532,7,3,0,0,532,23,1,0,0,0,533,538,3,26,13,0,534,
	535,5,47,0,0,535,537,3,26,13,0,536,534,1,0,0,0,537,540,1,0,0,0,538,536,
	1,0,0,0,538,539,1,0,0,0,539,543,1,0,0,0,540,538,1,0,0,0,541,543,5,8,0,0,
	542,533,1,0,0,0,542,541,1,0,0,0,543,25,1,0,0,0,544,545,3,28,14,0,545,546,
	5,14,0,0,546,547,3,28,14,0,547,554,1,0,0,0,548,550,3,28,14,0,549,548,1,
	0,0,0,550,551,1,0,0,0,551,549,1,0,0,0,551,552,1,0,0,0,552,554,1,0,0,0,553,
	544,1,0,0,0,553,549,1,0,0,0,554,27,1,0,0,0,555,557,3,30,15,0,556,555,1,
	0,0,0,556,557,1,0,0,0,557,558,1,0,0,0,558,559,7,4,0,0,559,29,1,0,0,0,560,
	561,7,5,0,0,561,31,1,0,0,0,562,563,5,49,0,0,563,573,5,180,0,0,564,565,5,
	50,0,0,565,570,5,180,0,0,566,567,5,5,0,0,567,569,5,180,0,0,568,566,1,0,
	0,0,569,572,1,0,0,0,570,568,1,0,0,0,570,571,1,0,0,0,571,574,1,0,0,0,572,
	570,1,0,0,0,573,564,1,0,0,0,573,574,1,0,0,0,574,575,1,0,0,0,575,588,5,4,
	0,0,576,587,3,64,32,0,577,587,3,60,30,0,578,587,3,68,34,0,579,587,3,52,
	26,0,580,587,3,56,28,0,581,587,3,10,5,0,582,587,3,36,18,0,583,587,3,34,
	17,0,584,587,3,40,20,0,585,587,3,42,21,0,586,576,1,0,0,0,586,577,1,0,0,
	0,586,578,1,0,0,0,586,579,1,0,0,0,586,580,1,0,0,0,586,581,1,0,0,0,586,582,
	1,0,0,0,586,583,1,0,0,0,586,584,1,0,0,0,586,585,1,0,0,0,587,590,1,0,0,0,
	588,586,1,0,0,0,588,589,1,0,0,0,589,591,1,0,0,0,590,588,1,0,0,0,591,592,
	5,6,0,0,592,33,1,0,0,0,593,594,3,38,19,0,594,595,3,90,45,0,595,596,5,180,
	0,0,596,597,5,2,0,0,597,604,1,0,0,0,598,599,3,38,19,0,599,600,3,92,46,0,
	600,601,5,180,0,0,601,602,5,2,0,0,602,604,1,0,0,0,603,593,1,0,0,0,603,598,
	1,0,0,0,604,35,1,0,0,0,605,606,3,38,19,0,606,607,3,292,146,0,607,608,5,
	180,0,0,608,609,5,2,0,0,609,37,1,0,0,0,610,611,7,6,0,0,611,39,1,0,0,0,612,
	613,5,9,0,0,613,614,3,18,9,0,614,618,3,114,57,0,615,617,3,104,52,0,616,
	615,1,0,0,0,617,620,1,0,0,0,618,616,1,0,0,0,618,619,1,0,0,0,619,622,1,0,
	0,0,620,618,1,0,0,0,621,623,3,110,55,0,622,621,1,0,0,0,622,623,1,0,0,0,
	623,624,1,0,0,0,624,625,5,2,0,0,625,41,1,0,0,0,626,627,5,38,0,0,627,631,
	3,114,57,0,628,630,3,76,38,0,629,628,1,0,0,0,630,633,1,0,0,0,631,629,1,
	0,0,0,631,632,1,0,0,0,632,634,1,0,0,0,633,631,1,0,0,0,634,638,5,52,0,0,
	635,637,3,76,38,0,636,635,1,0,0,0,637,640,1,0,0,0,638,636,1,0,0,0,638,639,
	1,0,0,0,639,642,1,0,0,0,640,638,1,0,0,0,641,643,3,110,55,0,642,641,1,0,
	0,0,642,643,1,0,0,0,643,644,1,0,0,0,644,645,5,2,0,0,645,43,1,0,0,0,646,
	647,5,53,0,0,647,648,5,180,0,0,648,661,5,4,0,0,649,660,3,64,32,0,650,660,
	3,60,30,0,651,660,3,68,34,0,652,660,3,52,26,0,653,660,3,56,28,0,654,660,
	3,70,35,0,655,660,3,84,42,0,656,660,3,10,5,0,657,660,3,94,47,0,658,660,
	3,8,4,0,659,649,1,0,0,0,659,650,1,0,0,0,659,651,1,0,0,0,659,652,1,0,0,0,
	659,653,1,0,0,0,659,654,1,0,0,0,659,655,1,0,0,0,659,656,1,0,0,0,659,657,
	1,0,0,0,659,658,1,0,0,0,660,663,1,0,0,0,661,659,1,0,0,0,661,662,1,0,0,0,
	662,664,1,0,0,0,663,661,1,0,0,0,664,665,5,6,0,0,665,45,1,0,0,0,666,668,
	5,54,0,0,667,666,1,0,0,0,667,668,1,0,0,0,668,669,1,0,0,0,669,670,5,55,0,
	0,670,672,3,16,8,0,671,673,3,114,57,0,672,671,1,0,0,0,672,673,1,0,0,0,673,
	683,1,0,0,0,674,675,5,50,0,0,675,680,3,48,24,0,676,677,5,5,0,0,677,679,
	3,48,24,0,678,676,1,0,0,0,679,682,1,0,0,0,680,678,1,0,0,0,680,681,1,0,0,
	0,681,684,1,0,0,0,682,680,1,0,0,0,683,674,1,0,0,0,683,684,1,0,0,0,684,685,
	1,0,0,0,685,702,5,4,0,0,686,701,3,64,32,0,687,701,3,60,30,0,688,701,3,68,
	34,0,689,701,3,52,26,0,690,701,3,56,28,0,691,701,3,70,35,0,692,701,3,10,
	5,0,693,701,3,84,42,0,694,701,3,94,47,0,695,701,3,72,36,0,696,701,3,100,
	50,0,697,701,3,50,25,0,698,701,3,74,37,0,699,701,3,78,39,0,700,686,1,0,
	0,0,700,687,1,0,0,0,700,688,1,0,0,0,700,689,1,0,0,0,700,690,1,0,0,0,700,
	691,1,0,0,0,700,692,1,0,0,0,700,693,1,0,0,0,700,694,1,0,0,0,700,695,1,0,
	0,0,700,696,1,0,0,0,700,697,1,0,0,0,700,698,1,0,0,0,700,699,1,0,0,0,701,
	704,1,0,0,0,702,700,1,0,0,0,702,703,1,0,0,0,703,705,1,0,0,0,704,702,1,0,
	0,0,705,706,5,6,0,0,706,47,1,0,0,0,707,709,5,180,0,0,708,710,3,260,130,
	0,709,708,1,0,0,0,709,710,1,0,0,0,710,49,1,0,0,0,711,712,5,9,0,0,712,713,
	3,18,9,0,713,718,3,114,57,0,714,717,3,104,52,0,715,717,3,102,51,0,716,714,
	1,0,0,0,716,715,1,0,0,0,717,720,1,0,0,0,718,716,1,0,0,0,718,719,1,0,0,0,
	719,722,1,0,0,0,720,718,1,0,0,0,721,723,3,110,55,0,722,721,1,0,0,0,722,
	723,1,0,0,0,723,724,1,0,0,0,724,725,5,2,0,0,725,51,1,0,0,0,726,727,5,56,
	0,0,727,728,3,16,8,0,728,740,5,57,0,0,729,734,3,54,27,0,730,731,5,5,0,0,
	731,733,3,54,27,0,732,730,1,0,0,0,733,736,1,0,0,0,734,732,1,0,0,0,734,735,
	1,0,0,0,735,738,1,0,0,0,736,734,1,0,0,0,737,739,5,5,0,0,738,737,1,0,0,0,
	738,739,1,0,0,0,739,741,1,0,0,0,740,729,1,0,0,0,740,741,1,0,0,0,741,742,
	1,0,0,0,742,744,5,58,0,0,743,745,5,59,0,0,744,743,1,0,0,0,744,745,1,0,0,
	0,745,746,1,0,0,0,746,747,5,2,0,0,747,53,1,0,0,0,748,751,3,292,146,0,749,
	751,3,92,46,0,750,748,1,0,0,0,750,749,1,0,0,0,751,753,1,0,0,0,752,754,5,
	60,0,0,753,752,1,0,0,0,753,754,1,0,0,0,754,756,1,0,0,0,755,757,3,16,8,0,
	756,755,1,0,0,0,756,757,1,0,0,0,757,55,1,0,0,0,758,759,5,34,0,0,759,760,
	3,16,8,0,760,772,5,57,0,0,761,766,3,58,29,0,762,763,5,5,0,0,763,765,3,58,
	29,0,764,762,1,0,0,0,765,768,1,0,0,0,766,764,1,0,0,0,766,767,1,0,0,0,767,
	770,1,0,0,0,768,766,1,0,0,0,769,771,5,5,0,0,770,769,1,0,0,0,770,771,1,0,
	0,0,771,773,1,0,0,0,772,761,1,0,0,0,772,773,1,0,0,0,773,774,1,0,0,0,774,
	775,5,58,0,0,775,776,5,2,0,0,776,57,1,0,0,0,777,779,3,292,146,0,778,780,
	3,16,8,0,779,778,1,0,0,0,779,780,1,0,0,0,780,786,1,0,0,0,781,783,3,92,46,
	0,782,784,3,16,8,0,783,782,1,0,0,0,783,784,1,0,0,0,784,786,1,0,0,0,785,
	777,1,0,0,0,785,781,1,0,0,0,786,59,1,0,0,0,787,788,5,61,0,0,788,789,3,16,
	8,0,789,791,5,4,0,0,790,792,3,62,31,0,791,790,1,0,0,0,792,793,1,0,0,0,793,
	791,1,0,0,0,793,794,1,0,0,0,794,795,1,0,0,0,795,796,5,6,0,0,796,61,1,0,
	0,0,797,801,3,292,146,0,798,801,3,92,46,0,799,801,3,90,45,0,800,797,1,0,
	0,0,800,798,1,0,0,0,800,799,1,0,0,0,801,802,1,0,0,0,802,803,3,16,8,0,803,
	804,5,2,0,0,804,63,1,0,0,0,805,806,5,62,0,0,806,807,3,16,8,0,807,808,5,
	4,0,0,808,813,3,66,33,0,809,810,5,5,0,0,810,812,3,66,33,0,811,809,1,0,0,
	0,812,815,1,0,0,0,813,811,1,0,0,0,813,814,1,0,0,0,814,817,1,0,0,0,815,813,
	1,0,0,0,816,818,5,5,0,0,817,816,1,0,0,0,817,818,1,0,0,0,818,819,1,0,0,0,
	819,820,5,6,0,0,820,65,1,0,0,0,821,824,3,16,8,0,822,823,5,48,0,0,823,825,
	5,145,0,0,824,822,1,0,0,0,824,825,1,0,0,0,825,67,1,0,0,0,826,827,5,63,0,
	0,827,828,3,16,8,0,828,829,5,50,0,0,829,830,3,292,146,0,830,831,5,2,0,0,
	831,69,1,0,0,0,832,833,3,292,146,0,833,834,5,64,0,0,834,835,3,16,8,0,835,
	836,5,48,0,0,836,837,3,272,136,0,837,838,5,2,0,0,838,71,1,0,0,0,839,840,
	5,65,0,0,840,844,3,114,57,0,841,843,7,7,0,0,842,841,1,0,0,0,843,846,1,0,
	0,0,844,842,1,0,0,0,844,845,1,0,0,0,845,850,1,0,0,0,846,844,1,0,0,0,847,
	849,3,82,41,0,848,847,1,0,0,0,849,852,1,0,0,0,850,848,1,0,0,0,850,851,1,
	0,0,0,851,856,1,0,0,0,852,850,1,0,0,0,853,855,7,7,0,0,854,853,1,0,0,0,855,
	858,1,0,0,0,856,854,1,0,0,0,856,857,1,0,0,0,857,862,1,0,0,0,858,856,1,0,
	0,0,859,861,3,102,51,0,860,859,1,0,0,0,861,864,1,0,0,0,862,860,1,0,0,0,
	862,863,1,0,0,0,863,865,1,0,0,0,864,862,1,0,0,0,865,869,5,4,0,0,866,868,
	3,122,61,0,867,866,1,0,0,0,868,871,1,0,0,0,869,867,1,0,0,0,869,870,1,0,
	0,0,870,872,1,0,0,0,871,869,1,0,0,0,872,873,5,6,0,0,873,73,1,0,0,0,874,
	875,5,38,0,0,875,879,3,114,57,0,876,878,3,76,38,0,877,876,1,0,0,0,878,881,
	1,0,0,0,879,877,1,0,0,0,879,880,1,0,0,0,880,882,1,0,0,0,881,879,1,0,0,0,
	882,886,5,52,0,0,883,885,3,76,38,0,884,883,1,0,0,0,885,888,1,0,0,0,886,
	884,1,0,0,0,886,887,1,0,0,0,887,892,1,0,0,0,888,886,1,0,0,0,889,891,3,102,
	51,0,890,889,1,0,0,0,891,894,1,0,0,0,892,890,1,0,0,0,892,893,1,0,0,0,893,
	896,1,0,0,0,894,892,1,0,0,0,895,897,3,110,55,0,896,895,1,0,0,0,896,897,
	1,0,0,0,897,898,1,0,0,0,898,902,5,4,0,0,899,901,3,122,61,0,900,899,1,0,
	0,0,901,904,1,0,0,0,902,900,1,0,0,0,902,903,1,0,0,0,903,905,1,0,0,0,904,
	902,1,0,0,0,905,906,5,6,0,0,906,75,1,0,0,0,907,911,5,67,0,0,908,911,5,68,
	0,0,909,911,3,106,53,0,910,907,1,0,0,0,910,908,1,0,0,0,910,909,1,0,0,0,
	911,77,1,0,0,0,912,913,5,39,0,0,913,914,5,57,0,0,914,918,5,58,0,0,915,917,
	3,80,40,0,916,915,1,0,0,0,917,920,1,0,0,0,918,916,1,0,0,0,918,919,1,0,0,
	0,919,921,1,0,0,0,920,918,1,0,0,0,921,925,5,52,0,0,922,924,3,80,40,0,923,
	922,1,0,0,0,924,927,1,0,0,0,925,923,1,0,0,0,925,926,1,0,0,0,926,928,1,0,
	0,0,927,925,1,0,0,0,928,932,5,67,0,0,929,931,3,80,40,0,930,929,1,0,0,0,
	931,934,1,0,0,0,932,930,1,0,0,0,932,933,1,0,0,0,933,944,1,0,0,0,934,932,
	1,0,0,0,935,939,5,4,0,0,936,938,3,122,61,0,937,936,1,0,0,0,938,941,1,0,
	0,0,939,937,1,0,0,0,939,940,1,0,0,0,940,942,1,0,0,0,941,939,1,0,0,0,942,
	945,5,6,0,0,943,945,5,2,0,0,944,935,1,0,0,0,944,943,1,0,0,0,945,981,1,0,
	0,0,946,947,5,39,0,0,947,948,5,57,0,0,948,952,5,58,0,0,949,951,3,80,40,
	0,950,949,1,0,0,0,951,954,1,0,0,0,952,950,1,0,0,0,952,953,1,0,0,0,953,955,
	1,0,0,0,954,952,1,0,0,0,955,959,5,67,0,0,956,958,3,80,40,0,957,956,1,0,
	0,0,958,961,1,0,0,0,959,957,1,0,0,0,959,960,1,0,0,0,960,962,1,0,0,0,961,
	959,1,0,0,0,962,966,5,52,0,0,963,965,3,80,40,0,964,963,1,0,0,0,965,968,
	1,0,0,0,966,964,1,0,0,0,966,967,1,0,0,0,967,978,1,0,0,0,968,966,1,0,0,0,
	969,973,5,4,0,0,970,972,3,122,61,0,971,970,1,0,0,0,972,975,1,0,0,0,973,
	971,1,0,0,0,973,974,1,0,0,0,974,976,1,0,0,0,975,973,1,0,0,0,976,979,5,6,
	0,0,977,979,5,2,0,0,978,969,1,0,0,0,978,977,1,0,0,0,979,981,1,0,0,0,980,
	912,1,0,0,0,980,946,1,0,0,0,981,79,1,0,0,0,982,985,5,68,0,0,983,985,3,106,
	53,0,984,982,1,0,0,0,984,983,1,0,0,0,985,81,1,0,0,0,986,987,5,180,0,0,987,
	988,3,260,130,0,988,83,1,0,0,0,989,991,3,88,44,0,990,989,1,0,0,0,990,991,
	1,0,0,0,991,992,1,0,0,0,992,997,3,292,146,0,993,996,3,282,141,0,994,996,
	3,106,53,0,995,993,1,0,0,0,995,994,1,0,0,0,996,999,1,0,0,0,997,995,1,0,
	0,0,997,998,1,0,0,0,998,1000,1,0,0,0,999,997,1,0,0,0,1000,1003,3,16,8,0,
	1001,1002,5,48,0,0,1002,1004,3,272,136,0,1003,1001,1,0,0,0,1003,1004,1,
	0,0,0,1004,1005,1,0,0,0,1005,1006,5,2,0,0,1006,1064,1,0,0,0,1007,1012,3,
	292,146,0,1008,1011,3,282,141,0,1009,1011,3,106,53,0,1010,1008,1,0,0,0,
	1010,1009,1,0,0,0,1011,1014,1,0,0,0,1012,1010,1,0,0,0,1012,1013,1,0,0,0,
	1013,1015,1,0,0,0,1014,1012,1,0,0,0,1015,1020,3,88,44,0,1016,1019,3,282,
	141,0,1017,1019,3,106,53,0,1018,1016,1,0,0,0,1018,1017,1,0,0,0,1019,1022,
	1,0,0,0,1020,1018,1,0,0,0,1020,1021,1,0,0,0,1021,1023,1,0,0,0,1022,1020,
	1,0,0,0,1023,1026,3,16,8,0,1024,1025,5,48,0,0,1025,1027,3,272,136,0,1026,
	1024,1,0,0,0,1026,1027,1,0,0,0,1027,1028,1,0,0,0,1028,1029,5,2,0,0,1029,
	1064,1,0,0,0,1030,1032,3,88,44,0,1031,1030,1,0,0,0,1031,1032,1,0,0,0,1032,
	1034,1,0,0,0,1033,1035,5,40,0,0,1034,1033,1,0,0,0,1034,1035,1,0,0,0,1035,
	1036,1,0,0,0,1036,1040,3,90,45,0,1037,1039,3,86,43,0,1038,1037,1,0,0,0,
	1039,1042,1,0,0,0,1040,1038,1,0,0,0,1040,1041,1,0,0,0,1041,1043,1,0,0,0,
	1042,1040,1,0,0,0,1043,1044,3,16,8,0,1044,1045,5,2,0,0,1045,1064,1,0,0,
	0,1046,1048,3,88,44,0,1047,1046,1,0,0,0,1047,1048,1,0,0,0,1048,1049,1,0,
	0,0,1049,1053,3,92,46,0,1050,1052,3,86,43,0,1051,1050,1,0,0,0,1052,1055,
	1,0,0,0,1053,1051,1,0,0,0,1053,1054,1,0,0,0,1054,1056,1,0,0,0,1055,1053,
	1,0,0,0,1056,1059,3,16,8,0,1057,1058,5,48,0,0,1058,1060,3,272,136,0,1059,
	1057,1,0,0,0,1059,1060,1,0,0,0,1060,1061,1,0,0,0,1061,1062,5,2,0,0,1062,
	1064,1,0,0,0,1063,990,1,0,0,0,1063,1007,1,0,0,0,1063,1031,1,0,0,0,1063,
	1047,1,0,0,0,1064,85,1,0,0,0,1065,1069,3,282,141,0,1066,1069,3,88,44,0,
	1067,1069,3,106,53,0,1068,1065,1,0,0,0,1068,1066,1,0,0,0,1068,1067,1,0,
	0,0,1069,87,1,0,0,0,1070,1071,7,8,0,0,1071,89,1,0,0,0,1072,1073,5,70,0,
	0,1073,1074,5,57,0,0,1074,1076,3,292,146,0,1075,1077,3,16,8,0,1076,1075,
	1,0,0,0,1076,1077,1,0,0,0,1077,1078,1,0,0,0,1078,1079,5,71,0,0,1079,1081,
	3,292,146,0,1080,1082,3,16,8,0,1081,1080,1,0,0,0,1081,1082,1,0,0,0,1082,
	1083,1,0,0,0,1083,1084,5,58,0,0,1084,1112,1,0,0,0,1085,1086,5,70,0,0,1086,
	1087,5,57,0,0,1087,1089,3,292,146,0,1088,1090,3,16,8,0,1089,1088,1,0,0,
	0,1089,1090,1,0,0,0,1090,1091,1,0,0,0,1091,1092,5,71,0,0,1092,1094,3,90,
	45,0,1093,1095,3,16,8,0,1094,1093,1,0,0,0,1094,1095,1,0,0,0,1095,1096,1,
	0,0,0,1096,1097,5,58,0,0,1097,1112,1,0,0,0,1098,1099,5,70,0,0,1099,1100,
	5,57,0,0,1100,1102,3,292,146,0,1101,1103,3,16,8,0,1102,1101,1,0,0,0,1102,
	1103,1,0,0,0,1103,1104,1,0,0,0,1104,1105,5,71,0,0,1105,1107,3,92,46,0,1106,
	1108,3,16,8,0,1107,1106,1,0,0,0,1107,1108,1,0,0,0,1108,1109,1,0,0,0,1109,
	1110,5,58,0,0,1110,1112,1,0,0,0,1111,1072,1,0,0,0,1111,1085,1,0,0,0,1111,
	1098,1,0,0,0,1112,91,1,0,0,0,1113,1114,6,46,-1,0,1114,1115,3,292,146,0,
	1115,1117,5,72,0,0,1116,1118,3,272,136,0,1117,1116,1,0,0,0,1117,1118,1,
	0,0,0,1118,1119,1,0,0,0,1119,1120,5,73,0,0,1120,1129,1,0,0,0,1121,1122,
	3,90,45,0,1122,1124,5,72,0,0,1123,1125,3,272,136,0,1124,1123,1,0,0,0,1124,
	1125,1,0,0,0,1125,1126,1,0,0,0,1126,1127,5,73,0,0,1127,1129,1,0,0,0,1128,
	1113,1,0,0,0,1128,1121,1,0,0,0,1129,1138,1,0,0,0,1130,1131,10,1,0,0,1131,
	1133,5,72,0,0,1132,1134,3,272,136,0,1133,1132,1,0,0,0,1133,1134,1,0,0,0,
	1134,1135,1,0,0,0,1135,1137,5,73,0,0,1136,1130,1,0,0,0,1137,1140,1,0,0,
	0,1138,1136,1,0,0,0,1138,1139,1,0,0,0,1139,93,1,0,0,0,1140,1138,1,0,0,0,
	1141,1142,5,74,0,0,1142,1144,5,180,0,0,1143,1145,3,114,57,0,1144,1143,1,
	0,0,0,1144,1145,1,0,0,0,1145,1150,1,0,0,0,1146,1149,5,68,0,0,1147,1149,
	3,106,53,0,1148,1146,1,0,0,0,1148,1147,1,0,0,0,1149,1152,1,0,0,0,1150,1148,
	1,0,0,0,1150,1151,1,0,0,0,1151,1162,1,0,0,0,1152,1150,1,0,0,0,1153,1157,
	5,4,0,0,1154,1156,3,96,48,0,1155,1154,1,0,0,0,1156,1159,1,0,0,0,1157,1155,
	1,0,0,0,1157,1158,1,0,0,0,1158,1160,1,0,0,0,1159,1157,1,0,0,0,1160,1163,
	5,6,0,0,1161,1163,5,2,0,0,1162,1153,1,0,0,0,1162,1161,1,0,0,0,1163,95,1,
	0,0,0,1164,1167,3,98,49,0,1165,1167,3,122,61,0,1166,1164,1,0,0,0,1166,1165,
	1,0,0,0,1167,97,1,0,0,0,1168,1169,5,43,0,0,1169,1170,5,2,0,0,1170,99,1,
	0,0,0,1171,1172,5,9,0,0,1172,1173,3,18,9,0,1173,1178,3,114,57,0,1174,1177,
	3,104,52,0,1175,1177,3,102,51,0,1176,1174,1,0,0,0,1176,1175,1,0,0,0,1177,
	1180,1,0,0,0,1178,1176,1,0,0,0,1178,1179,1,0,0,0,1179,1182,1,0,0,0,1180,
	1178,1,0,0,0,1181,1183,3,110,55,0,1182,1181,1,0,0,0,1182,1183,1,0,0,0,1183,
	1184,1,0,0,0,1184,1188,5,4,0,0,1185,1187,3,122,61,0,1186,1185,1,0,0,0,1187,
	1190,1,0,0,0,1188,1186,1,0,0,0,1188,1189,1,0,0,0,1189,1191,1,0,0,0,1190,
	1188,1,0,0,0,1191,1192,5,6,0,0,1192,101,1,0,0,0,1193,1194,5,180,0,0,1194,
	1196,5,7,0,0,1195,1193,1,0,0,0,1195,1196,1,0,0,0,1196,1197,1,0,0,0,1197,
	1199,5,180,0,0,1198,1200,3,260,130,0,1199,1198,1,0,0,0,1199,1200,1,0,0,
	0,1200,103,1,0,0,0,1201,1215,5,75,0,0,1202,1215,5,76,0,0,1203,1215,5,66,
	0,0,1204,1215,5,52,0,0,1205,1215,5,51,0,0,1206,1215,5,69,0,0,1207,1215,
	5,67,0,0,1208,1215,3,106,53,0,1209,1215,5,68,0,0,1210,1215,3,108,54,0,1211,
	1215,5,29,0,0,1212,1215,5,30,0,0,1213,1215,5,28,0,0,1214,1201,1,0,0,0,1214,
	1202,1,0,0,0,1214,1203,1,0,0,0,1214,1204,1,0,0,0,1214,1205,1,0,0,0,1214,
	1206,1,0,0,0,1214,1207,1,0,0,0,1214,1208,1,0,0,0,1214,1209,1,0,0,0,1214,
	1210,1,0,0,0,1214,1211,1,0,0,0,1214,1212,1,0,0,0,1214,1213,1,0,0,0,1215,
	105,1,0,0,0,1216,1227,5,77,0,0,1217,1218,5,57,0,0,1218,1223,5,180,0,0,1219,
	1220,5,5,0,0,1220,1222,5,180,0,0,1221,1219,1,0,0,0,1222,1225,1,0,0,0,1223,
	1221,1,0,0,0,1223,1224,1,0,0,0,1224,1226,1,0,0,0,1225,1223,1,0,0,0,1226,
	1228,5,58,0,0,1227,1217,1,0,0,0,1227,1228,1,0,0,0,1228,107,1,0,0,0,1229,
	1233,5,31,0,0,1230,1231,5,57,0,0,1231,1232,5,145,0,0,1232,1234,5,58,0,0,
	1233,1230,1,0,0,0,1233,1234,1,0,0,0,1234,109,1,0,0,0,1235,1236,5,78,0,0,
	1236,1237,5,57,0,0,1237,1242,3,112,56,0,1238,1239,5,5,0,0,1239,1241,3,112,
	56,0,1240,1238,1,0,0,0,1241,1244,1,0,0,0,1242,1240,1,0,0,0,1242,1243,1,
	0,0,0,1243,1246,1,0,0,0,1244,1242,1,0,0,0,1245,1247,5,5,0,0,1246,1245,1,
	0,0,0,1246,1247,1,0,0,0,1247,1248,1,0,0,0,1248,1249,5,58,0,0,1249,111,1,
	0,0,0,1250,1254,3,292,146,0,1251,1253,3,282,141,0,1252,1251,1,0,0,0,1253,
	1256,1,0,0,0,1254,1252,1,0,0,0,1254,1255,1,0,0,0,1255,1258,1,0,0,0,1256,
	1254,1,0,0,0,1257,1259,3,16,8,0,1258,1257,1,0,0,0,1258,1259,1,0,0,0,1259,
	1281,1,0,0,0,1260,1264,3,92,46,0,1261,1263,3,282,141,0,1262,1261,1,0,0,
	0,1263,1266,1,0,0,0,1264,1262,1,0,0,0,1264,1265,1,0,0,0,1265,1268,1,0,0,
	0,1266,1264,1,0,0,0,1267,1269,3,16,8,0,1268,1267,1,0,0,0,1268,1269,1,0,
	0,0,1269,1281,1,0,0,0,1270,1274,3,90,45,0,1271,1273,3,282,141,0,1272,1271,
	1,0,0,0,1273,1276,1,0,0,0,1274,1272,1,0,0,0,1274,1275,1,0,0,0,1275,1278,
	1,0,0,0,1276,1274,1,0,0,0,1277,1279,3,16,8,0,1278,1277,1,0,0,0,1278,1279,
	1,0,0,0,1279,1281,1,0,0,0,1280,1250,1,0,0,0,1280,1260,1,0,0,0,1280,1270,
	1,0,0,0,1281,113,1,0,0,0,1282,1294,5,57,0,0,1283,1288,3,116,58,0,1284,1285,
	5,5,0,0,1285,1287,3,116,58,0,1286,1284,1,0,0,0,1287,1290,1,0,0,0,1288,1286,
	1,0,0,0,1288,1289,1,0,0,0,1289,1292,1,0,0,0,1290,1288,1,0,0,0,1291,1293,
	5,5,0,0,1292,1291,1,0,0,0,1292,1293,1,0,0,0,1293,1295,1,0,0,0,1294,1283,
	1,0,0,0,1294,1295,1,0,0,0,1295,1296,1,0,0,0,1296,1297,5,58,0,0,1297,115,
	1,0,0,0,1298,1302,3,292,146,0,1299,1301,3,282,141,0,1300,1299,1,0,0,0,1301,
	1304,1,0,0,0,1302,1300,1,0,0,0,1302,1303,1,0,0,0,1303,1306,1,0,0,0,1304,
	1302,1,0,0,0,1305,1307,3,16,8,0,1306,1305,1,0,0,0,1306,1307,1,0,0,0,1307,
	1329,1,0,0,0,1308,1312,3,92,46,0,1309,1311,3,282,141,0,1310,1309,1,0,0,
	0,1311,1314,1,0,0,0,1312,1310,1,0,0,0,1312,1313,1,0,0,0,1313,1316,1,0,0,
	0,1314,1312,1,0,0,0,1315,1317,3,16,8,0,1316,1315,1,0,0,0,1316,1317,1,0,
	0,0,1317,1329,1,0,0,0,1318,1322,3,90,45,0,1319,1321,3,282,141,0,1320,1319,
	1,0,0,0,1321,1324,1,0,0,0,1322,1320,1,0,0,0,1322,1323,1,0,0,0,1323,1326,
	1,0,0,0,1324,1322,1,0,0,0,1325,1327,3,16,8,0,1326,1325,1,0,0,0,1326,1327,
	1,0,0,0,1327,1329,1,0,0,0,1328,1298,1,0,0,0,1328,1308,1,0,0,0,1328,1318,
	1,0,0,0,1329,117,1,0,0,0,1330,1334,5,4,0,0,1331,1333,3,122,61,0,1332,1331,
	1,0,0,0,1333,1336,1,0,0,0,1334,1332,1,0,0,0,1334,1335,1,0,0,0,1335,1337,
	1,0,0,0,1336,1334,1,0,0,0,1337,1340,5,6,0,0,1338,1340,3,122,61,0,1339,1330,
	1,0,0,0,1339,1338,1,0,0,0,1340,119,1,0,0,0,1341,1345,5,4,0,0,1342,1344,
	3,122,61,0,1343,1342,1,0,0,0,1344,1347,1,0,0,0,1345,1343,1,0,0,0,1345,1346,
	1,0,0,0,1346,1348,1,0,0,0,1347,1345,1,0,0,0,1348,1349,5,6,0,0,1349,121,
	1,0,0,0,1350,1382,3,98,49,0,1351,1382,3,120,60,0,1352,1382,3,130,65,0,1353,
	1382,3,124,62,0,1354,1382,3,126,63,0,1355,1382,3,152,76,0,1356,1382,3,156,
	78,0,1357,1382,3,154,77,0,1358,1382,3,144,72,0,1359,1382,3,168,84,0,1360,
	1382,3,170,85,0,1361,1382,3,172,86,0,1362,1382,3,174,87,0,1363,1382,3,194,
	97,0,1364,1382,3,150,75,0,1365,1382,3,146,73,0,1366,1382,3,148,74,0,1367,
	1382,3,196,98,0,1368,1382,3,236,118,0,1369,1382,3,248,124,0,1370,1382,3,
	250,125,0,1371,1382,3,166,83,0,1372,1382,3,228,114,0,1373,1382,3,230,115,
	0,1374,1382,3,242,121,0,1375,1382,3,244,122,0,1376,1382,3,278,139,0,1377,
	1382,3,132,66,0,1378,1382,3,136,68,0,1379,1382,3,138,69,0,1380,1382,3,140,
	70,0,1381,1350,1,0,0,0,1381,1351,1,0,0,0,1381,1352,1,0,0,0,1381,1353,1,
	0,0,0,1381,1354,1,0,0,0,1381,1355,1,0,0,0,1381,1356,1,0,0,0,1381,1357,1,
	0,0,0,1381,1358,1,0,0,0,1381,1359,1,0,0,0,1381,1360,1,0,0,0,1381,1361,1,
	0,0,0,1381,1362,1,0,0,0,1381,1363,1,0,0,0,1381,1364,1,0,0,0,1381,1365,1,
	0,0,0,1381,1366,1,0,0,0,1381,1367,1,0,0,0,1381,1368,1,0,0,0,1381,1369,1,
	0,0,0,1381,1370,1,0,0,0,1381,1371,1,0,0,0,1381,1372,1,0,0,0,1381,1373,1,
	0,0,0,1381,1374,1,0,0,0,1381,1375,1,0,0,0,1381,1376,1,0,0,0,1381,1377,1,
	0,0,0,1381,1378,1,0,0,0,1381,1379,1,0,0,0,1381,1380,1,0,0,0,1382,123,1,
	0,0,0,1383,1391,3,128,64,0,1384,1386,5,72,0,0,1385,1387,3,272,136,0,1386,
	1385,1,0,0,0,1386,1387,1,0,0,0,1387,1388,1,0,0,0,1388,1390,5,73,0,0,1389,
	1384,1,0,0,0,1390,1393,1,0,0,0,1391,1389,1,0,0,0,1391,1392,1,0,0,0,1392,
	1394,1,0,0,0,1393,1391,1,0,0,0,1394,1395,5,2,0,0,1395,1411,1,0,0,0,1396,
	1397,5,57,0,0,1397,1403,3,128,64,0,1398,1400,5,72,0,0,1399,1401,3,272,136,
	0,1400,1399,1,0,0,0,1400,1401,1,0,0,0,1401,1402,1,0,0,0,1402,1404,5,73,
	0,0,1403,1398,1,0,0,0,1404,1405,1,0,0,0,1405,1403,1,0,0,0,1405,1406,1,0,
	0,0,1406,1407,1,0,0,0,1407,1408,5,58,0,0,1408,1409,5,2,0,0,1409,1411,1,
	0,0,0,1410,1383,1,0,0,0,1410,1396,1,0,0,0,1411,125,1,0,0,0,1412,1420,5,
	180,0,0,1413,1415,5,72,0,0,1414,1416,3,272,136,0,1415,1414,1,0,0,0,1415,
	1416,1,0,0,0,1416,1417,1,0,0,0,1417,1419,5,73,0,0,1418,1413,1,0,0,0,1419,
	1422,1,0,0,0,1420,1418,1,0,0,0,1420,1421,1,0,0,0,1421,1423,1,0,0,0,1422,
	1420,1,0,0,0,1423,1424,5,72,0,0,1424,1432,5,73,0,0,1425,1427,5,72,0,0,1426,
	1428,3,272,136,0,1427,1426,1,0,0,0,1427,1428,1,0,0,0,1428,1429,1,0,0,0,
	1429,1431,5,73,0,0,1430,1425,1,0,0,0,1431,1434,1,0,0,0,1432,1430,1,0,0,
	0,1432,1433,1,0,0,0,1433,1435,1,0,0,0,1434,1432,1,0,0,0,1435,1436,5,2,0,
	0,1436,127,1,0,0,0,1437,1452,5,146,0,0,1438,1452,5,147,0,0,1439,1452,5,
	149,0,0,1440,1452,5,148,0,0,1441,1452,5,156,0,0,1442,1452,5,157,0,0,1443,
	1452,5,158,0,0,1444,1452,5,159,0,0,1445,1452,5,79,0,0,1446,1452,5,80,0,
	0,1447,1449,5,81,0,0,1448,1450,5,67,0,0,1449,1448,1,0,0,0,1449,1450,1,0,
	0,0,1450,1452,1,0,0,0,1451,1437,1,0,0,0,1451,1438,1,0,0,0,1451,1439,1,0,
	0,0,1451,1440,1,0,0,0,1451,1441,1,0,0,0,1451,1442,1,0,0,0,1451,1443,1,0,
	0,0,1451,1444,1,0,0,0,1451,1445,1,0,0,0,1451,1446,1,0,0,0,1451,1447,1,0,
	0,0,1452,129,1,0,0,0,1453,1454,5,63,0,0,1454,1455,5,57,0,0,1455,1456,3,
	292,146,0,1456,1457,5,58,0,0,1457,1458,5,2,0,0,1458,131,1,0,0,0,1459,1460,
	3,272,136,0,1460,1461,5,7,0,0,1461,1462,5,180,0,0,1462,1464,3,264,132,0,
	1463,1465,3,134,67,0,1464,1463,1,0,0,0,1464,1465,1,0,0,0,1465,1466,1,0,
	0,0,1466,1467,5,2,0,0,1467,133,1,0,0,0,1468,1469,5,7,0,0,1469,1473,5,81,
	0,0,1470,1471,5,7,0,0,1471,1473,5,180,0,0,1472,1468,1,0,0,0,1472,1470,1,
	0,0,0,1473,135,1,0,0,0,1474,1475,5,82,0,0,1475,1476,5,180,0,0,1476,1477,
	3,264,132,0,1477,1478,5,2,0,0,1478,137,1,0,0,0,1479,1482,5,57,0,0,1480,
	1481,5,42,0,0,1481,1483,5,7,0,0,1482,1480,1,0,0,0,1482,1483,1,0,0,0,1483,
	1484,1,0,0,0,1484,1485,5,180,0,0,1485,1486,5,166,0,0,1486,1487,5,58,0,0,
	1487,1488,5,57,0,0,1488,1489,5,58,0,0,1489,1490,5,2,0,0,1490,139,1,0,0,
	0,1491,1572,3,272,136,0,1492,1493,7,9,0,0,1493,1573,3,142,71,0,1494,1495,
	5,165,0,0,1495,1496,5,57,0,0,1496,1497,5,58,0,0,1497,1498,5,165,0,0,1498,
	1499,5,57,0,0,1499,1500,5,58,0,0,1500,1501,5,165,0,0,1501,1502,5,57,0,0,
	1502,1505,5,58,0,0,1503,1504,5,48,0,0,1504,1506,3,272,136,0,1505,1503,1,
	0,0,0,1505,1506,1,0,0,0,1506,1573,1,0,0,0,1507,1508,5,165,0,0,1508,1509,
	5,57,0,0,1509,1510,5,58,0,0,1510,1511,5,165,0,0,1511,1512,5,57,0,0,1512,
	1513,5,58,0,0,1513,1514,5,48,0,0,1514,1523,3,272,136,0,1515,1516,5,165,
	0,0,1516,1517,5,57,0,0,1517,1521,5,58,0,0,1518,1519,5,165,0,0,1519,1520,
	5,57,0,0,1520,1522,5,58,0,0,1521,1518,1,0,0,0,1521,1522,1,0,0,0,1522,1524,
	1,0,0,0,1523,1515,1,0,0,0,1523,1524,1,0,0,0,1524,1573,1,0,0,0,1525,1526,
	5,165,0,0,1526,1527,5,57,0,0,1527,1528,5,58,0,0,1528,1529,5,165,0,0,1529,
	1531,5,57,0,0,1530,1532,3,164,82,0,1531,1530,1,0,0,0,1531,1532,1,0,0,0,
	1532,1533,1,0,0,0,1533,1573,5,58,0,0,1534,1535,5,165,0,0,1535,1536,5,57,
	0,0,1536,1537,5,58,0,0,1537,1538,5,7,0,0,1538,1539,3,16,8,0,1539,1540,5,
	48,0,0,1540,1541,3,272,136,0,1541,1573,1,0,0,0,1542,1543,5,165,0,0,1543,
	1544,5,57,0,0,1544,1545,5,58,0,0,1545,1546,7,9,0,0,1546,1555,3,272,136,
	0,1547,1548,5,165,0,0,1548,1549,5,57,0,0,1549,1553,5,58,0,0,1550,1551,5,
	165,0,0,1551,1552,5,57,0,0,1552,1554,5,58,0,0,1553,1550,1,0,0,0,1553,1554,
	1,0,0,0,1554,1556,1,0,0,0,1555,1547,1,0,0,0,1555,1556,1,0,0,0,1556,1573,
	1,0,0,0,1557,1558,5,165,0,0,1558,1560,5,57,0,0,1559,1561,3,164,82,0,1560,
	1559,1,0,0,0,1560,1561,1,0,0,0,1561,1562,1,0,0,0,1562,1573,5,58,0,0,1563,
	1564,5,166,0,0,1564,1565,5,57,0,0,1565,1573,5,58,0,0,1566,1567,5,169,0,
	0,1567,1568,5,57,0,0,1568,1569,3,272,136,0,1569,1570,5,58,0,0,1570,1573,
	1,0,0,0,1571,1573,7,10,0,0,1572,1492,1,0,0,0,1572,1494,1,0,0,0,1572,1507,
	1,0,0,0,1572,1525,1,0,0,0,1572,1534,1,0,0,0,1572,1542,1,0,0,0,1572,1557,
	1,0,0,0,1572,1563,1,0,0,0,1572,1566,1,0,0,0,1572,1571,1,0,0,0,1572,1573,
	1,0,0,0,1573,1574,1,0,0,0,1574,1575,5,2,0,0,1575,141,1,0,0,0,1576,1579,
	3,272,136,0,1577,1578,7,9,0,0,1578,1580,3,142,71,0,1579,1577,1,0,0,0,1579,
	1580,1,0,0,0,1580,143,1,0,0,0,1581,1582,7,11,0,0,1582,1583,3,272,136,0,
	1583,1584,5,2,0,0,1584,145,1,0,0,0,1585,1586,5,95,0,0,1586,1621,5,2,0,0,
	1587,1588,5,95,0,0,1588,1589,3,272,136,0,1589,1590,7,9,0,0,1590,1591,3,
	142,71,0,1591,1592,5,2,0,0,1592,1621,1,0,0,0,1593,1594,5,95,0,0,1594,1599,
	3,272,136,0,1595,1596,5,5,0,0,1596,1598,3,272,136,0,1597,1595,1,0,0,0,1598,
	1601,1,0,0,0,1599,1597,1,0,0,0,1599,1600,1,0,0,0,1600,1602,1,0,0,0,1601,
	1599,1,0,0,0,1602,1603,5,2,0,0,1603,1621,1,0,0,0,1604,1605,5,95,0,0,1605,
	1606,5,57,0,0,1606,1611,3,272,136,0,1607,1608,5,5,0,0,1608,1610,3,272,136,
	0,1609,1607,1,0,0,0,1610,1613,1,0,0,0,1611,1609,1,0,0,0,1611,1612,1,0,0,
	0,1612,1615,1,0,0,0,1613,1611,1,0,0,0,1614,1616,5,5,0,0,1615,1614,1,0,0,
	0,1615,1616,1,0,0,0,1616,1617,1,0,0,0,1617,1618,5,58,0,0,1618,1619,5,2,
	0,0,1619,1621,1,0,0,0,1620,1585,1,0,0,0,1620,1587,1,0,0,0,1620,1593,1,0,
	0,0,1620,1604,1,0,0,0,1621,147,1,0,0,0,1622,1623,5,30,0,0,1623,1624,5,57,
	0,0,1624,1625,3,272,136,0,1625,1626,5,58,0,0,1626,1627,5,2,0,0,1627,149,
	1,0,0,0,1628,1629,5,96,0,0,1629,1632,5,180,0,0,1630,1631,5,7,0,0,1631,1633,
	5,180,0,0,1632,1630,1,0,0,0,1632,1633,1,0,0,0,1633,1634,1,0,0,0,1634,1635,
	5,57,0,0,1635,1647,5,4,0,0,1636,1641,3,258,129,0,1637,1638,5,5,0,0,1638,
	1640,3,258,129,0,1639,1637,1,0,0,0,1640,1643,1,0,0,0,1641,1639,1,0,0,0,
	1641,1642,1,0,0,0,1642,1645,1,0,0,0,1643,1641,1,0,0,0,1644,1646,5,5,0,0,
	1645,1644,1,0,0,0,1645,1646,1,0,0,0,1646,1648,1,0,0,0,1647,1636,1,0,0,0,
	1647,1648,1,0,0,0,1648,1649,1,0,0,0,1649,1650,5,6,0,0,1650,1651,5,58,0,
	0,1651,1662,5,2,0,0,1652,1653,5,96,0,0,1653,1656,5,180,0,0,1654,1655,5,
	7,0,0,1655,1657,5,180,0,0,1656,1654,1,0,0,0,1656,1657,1,0,0,0,1657,1658,
	1,0,0,0,1658,1659,3,260,130,0,1659,1660,5,2,0,0,1660,1662,1,0,0,0,1661,
	1628,1,0,0,0,1661,1652,1,0,0,0,1662,151,1,0,0,0,1663,1667,3,292,146,0,1664,
	1666,3,282,141,0,1665,1664,1,0,0,0,1666,1669,1,0,0,0,1667,1665,1,0,0,0,
	1667,1668,1,0,0,0,1668,1670,1,0,0,0,1669,1667,1,0,0,0,1670,1680,3,16,8,
	0,1671,1672,5,48,0,0,1672,1678,3,272,136,0,1673,1674,7,9,0,0,1674,1679,
	3,142,71,0,1675,1676,5,165,0,0,1676,1677,5,57,0,0,1677,1679,5,58,0,0,1678,
	1673,1,0,0,0,1678,1675,1,0,0,0,1678,1679,1,0,0,0,1679,1681,1,0,0,0,1680,
	1671,1,0,0,0,1680,1681,1,0,0,0,1681,1682,1,0,0,0,1682,1683,5,2,0,0,1683,
	1718,1,0,0,0,1684,1688,3,92,46,0,1685,1687,3,282,141,0,1686,1685,1,0,0,
	0,1687,1690,1,0,0,0,1688,1686,1,0,0,0,1688,1689,1,0,0,0,1689,1691,1,0,0,
	0,1690,1688,1,0,0,0,1691,1699,3,16,8,0,1692,1693,5,48,0,0,1693,1697,3,272,
	136,0,1694,1695,5,165,0,0,1695,1696,5,57,0,0,1696,1698,5,58,0,0,1697,1694,
	1,0,0,0,1697,1698,1,0,0,0,1698,1700,1,0,0,0,1699,1692,1,0,0,0,1699,1700,
	1,0,0,0,1700,1701,1,0,0,0,1701,1702,5,2,0,0,1702,1718,1,0,0,0,1703,1707,
	3,90,45,0,1704,1706,3,282,141,0,1705,1704,1,0,0,0,1706,1709,1,0,0,0,1707,
	1705,1,0,0,0,1707,1708,1,0,0,0,1708,1710,1,0,0,0,1709,1707,1,0,0,0,1710,
	1713,3,16,8,0,1711,1712,5,48,0,0,1712,1714,3,272,136,0,1713,1711,1,0,0,
	0,1713,1714,1,0,0,0,1714,1715,1,0,0,0,1715,1716,5,2,0,0,1716,1718,1,0,0,
	0,1717,1663,1,0,0,0,1717,1684,1,0,0,0,1717,1703,1,0,0,0,1718,153,1,0,0,
	0,1719,1720,3,292,146,0,1720,1725,5,180,0,0,1721,1722,5,5,0,0,1722,1723,
	3,292,146,0,1723,1724,5,180,0,0,1724,1726,1,0,0,0,1725,1721,1,0,0,0,1726,
	1727,1,0,0,0,1727,1725,1,0,0,0,1727,1728,1,0,0,0,1728,1729,1,0,0,0,1729,
	1730,5,48,0,0,1730,1731,3,272,136,0,1731,1732,5,2,0,0,1732,1796,1,0,0,0,
	1733,1734,5,57,0,0,1734,1737,3,162,81,0,1735,1736,5,5,0,0,1736,1738,3,162,
	81,0,1737,1735,1,0,0,0,1738,1739,1,0,0,0,1739,1737,1,0,0,0,1739,1740,1,
	0,0,0,1740,1741,1,0,0,0,1741,1742,5,58,0,0,1742,1743,5,48,0,0,1743,1744,
	5,57,0,0,1744,1747,3,272,136,0,1745,1746,5,5,0,0,1746,1748,3,272,136,0,
	1747,1745,1,0,0,0,1748,1749,1,0,0,0,1749,1747,1,0,0,0,1749,1750,1,0,0,0,
	1750,1751,1,0,0,0,1751,1752,5,58,0,0,1752,1753,5,2,0,0,1753,1796,1,0,0,
	0,1754,1755,5,57,0,0,1755,1758,3,162,81,0,1756,1757,5,5,0,0,1757,1759,3,
	162,81,0,1758,1756,1,0,0,0,1759,1760,1,0,0,0,1760,1758,1,0,0,0,1760,1761,
	1,0,0,0,1761,1762,1,0,0,0,1762,1763,5,58,0,0,1763,1764,5,48,0,0,1764,1765,
	3,272,136,0,1765,1766,5,2,0,0,1766,1796,1,0,0,0,1767,1768,5,57,0,0,1768,
	1772,3,292,146,0,1769,1771,3,282,141,0,1770,1769,1,0,0,0,1771,1774,1,0,
	0,0,1772,1770,1,0,0,0,1772,1773,1,0,0,0,1773,1775,1,0,0,0,1774,1772,1,0,
	0,0,1775,1776,3,16,8,0,1776,1777,5,58,0,0,1777,1778,5,48,0,0,1778,1779,
	3,272,136,0,1779,1780,5,2,0,0,1780,1796,1,0,0,0,1781,1782,5,57,0,0,1782,
	1786,3,92,46,0,1783,1785,3,282,141,0,1784,1783,1,0,0,0,1785,1788,1,0,0,
	0,1786,1784,1,0,0,0,1786,1787,1,0,0,0,1787,1789,1,0,0,0,1788,1786,1,0,0,
	0,1789,1790,3,16,8,0,1790,1791,5,58,0,0,1791,1792,5,48,0,0,1792,1793,3,
	272,136,0,1793,1794,5,2,0,0,1794,1796,1,0,0,0,1795,1719,1,0,0,0,1795,1733,
	1,0,0,0,1795,1754,1,0,0,0,1795,1767,1,0,0,0,1795,1781,1,0,0,0,1796,155,
	1,0,0,0,1797,1798,4,78,2,0,1798,1799,3,158,79,0,1799,1800,5,48,0,0,1800,
	1801,3,272,136,0,1801,1802,5,2,0,0,1802,157,1,0,0,0,1803,1805,5,57,0,0,
	1804,1806,3,160,80,0,1805,1804,1,0,0,0,1805,1806,1,0,0,0,1806,1813,1,0,
	0,0,1807,1809,5,5,0,0,1808,1810,3,160,80,0,1809,1808,1,0,0,0,1809,1810,
	1,0,0,0,1810,1812,1,0,0,0,1811,1807,1,0,0,0,1812,1815,1,0,0,0,1813,1811,
	1,0,0,0,1813,1814,1,0,0,0,1814,1816,1,0,0,0,1815,1813,1,0,0,0,1816,1817,
	5,58,0,0,1817,159,1,0,0,0,1818,1822,3,292,146,0,1819,1821,3,282,141,0,1820,
	1819,1,0,0,0,1821,1824,1,0,0,0,1822,1820,1,0,0,0,1822,1823,1,0,0,0,1823,
	1825,1,0,0,0,1824,1822,1,0,0,0,1825,1826,3,16,8,0,1826,1850,1,0,0,0,1827,
	1831,3,92,46,0,1828,1830,3,282,141,0,1829,1828,1,0,0,0,1830,1833,1,0,0,
	0,1831,1829,1,0,0,0,1831,1832,1,0,0,0,1832,1834,1,0,0,0,1833,1831,1,0,0,
	0,1834,1835,3,16,8,0,1835,1850,1,0,0,0,1836,1845,3,16,8,0,1837,1838,5,72,
	0,0,1838,1839,3,272,136,0,1839,1840,5,73,0,0,1840,1844,1,0,0,0,1841,1842,
	5,7,0,0,1842,1844,3,16,8,0,1843,1837,1,0,0,0,1843,1841,1,0,0,0,1844,1847,
	1,0,0,0,1845,1843,1,0,0,0,1845,1846,1,0,0,0,1846,1850,1,0,0,0,1847,1845,
	1,0,0,0,1848,1850,3,158,79,0,1849,1818,1,0,0,0,1849,1827,1,0,0,0,1849,1836,
	1,0,0,0,1849,1848,1,0,0,0,1850,161,1,0,0,0,1851,1855,3,292,146,0,1852,1854,
	3,282,141,0,1853,1852,1,0,0,0,1854,1857,1,0,0,0,1855,1853,1,0,0,0,1855,
	1856,1,0,0,0,1856,1858,1,0,0,0,1857,1855,1,0,0,0,1858,1859,3,16,8,0,1859,
	1883,1,0,0,0,1860,1864,3,92,46,0,1861,1863,3,282,141,0,1862,1861,1,0,0,
	0,1863,1866,1,0,0,0,1864,1862,1,0,0,0,1864,1865,1,0,0,0,1865,1867,1,0,0,
	0,1866,1864,1,0,0,0,1867,1868,3,16,8,0,1868,1883,1,0,0,0,1869,1878,3,16,
	8,0,1870,1871,5,72,0,0,1871,1872,3,272,136,0,1872,1873,5,73,0,0,1873,1877,
	1,0,0,0,1874,1875,5,7,0,0,1875,1877,3,16,8,0,1876,1870,1,0,0,0,1876,1874,
	1,0,0,0,1877,1880,1,0,0,0,1878,1876,1,0,0,0,1878,1879,1,0,0,0,1879,1883,
	1,0,0,0,1880,1878,1,0,0,0,1881,1883,1,0,0,0,1882,1851,1,0,0,0,1882,1860,
	1,0,0,0,1882,1869,1,0,0,0,1882,1881,1,0,0,0,1883,163,1,0,0,0,1884,1885,
	3,272,136,0,1885,165,1,0,0,0,1886,1887,5,97,0,0,1887,1888,5,180,0,0,1888,
	1981,5,2,0,0,1889,1890,5,97,0,0,1890,1891,5,57,0,0,1891,1892,3,272,136,
	0,1892,1893,5,58,0,0,1893,1894,5,2,0,0,1894,1981,1,0,0,0,1895,1896,5,97,
	0,0,1896,1897,5,42,0,0,1897,1898,5,7,0,0,1898,1899,5,180,0,0,1899,1981,
	5,2,0,0,1900,1901,5,97,0,0,1901,1902,5,42,0,0,1902,1903,5,7,0,0,1903,1908,
	5,180,0,0,1904,1905,5,72,0,0,1905,1906,3,272,136,0,1906,1907,5,73,0,0,1907,
	1909,1,0,0,0,1908,1904,1,0,0,0,1909,1910,1,0,0,0,1910,1908,1,0,0,0,1910,
	1911,1,0,0,0,1911,1912,1,0,0,0,1912,1913,5,2,0,0,1913,1981,1,0,0,0,1914,
	1915,5,97,0,0,1915,1920,5,180,0,0,1916,1917,5,72,0,0,1917,1918,3,272,136,
	0,1918,1919,5,73,0,0,1919,1921,1,0,0,0,1920,1916,1,0,0,0,1921,1922,1,0,
	0,0,1922,1920,1,0,0,0,1922,1923,1,0,0,0,1923,1935,1,0,0,0,1924,1925,5,7,
	0,0,1925,1932,5,180,0,0,1926,1927,5,72,0,0,1927,1928,3,272,136,0,1928,1929,
	5,73,0,0,1929,1931,1,0,0,0,1930,1926,1,0,0,0,1931,1934,1,0,0,0,1932,1930,
	1,0,0,0,1932,1933,1,0,0,0,1933,1936,1,0,0,0,1934,1932,1,0,0,0,1935,1924,
	1,0,0,0,1936,1937,1,0,0,0,1937,1935,1,0,0,0,1937,1938,1,0,0,0,1938,1939,
	1,0,0,0,1939,1940,5,2,0,0,1940,1981,1,0,0,0,1941,1942,5,97,0,0,1942,1947,
	5,180,0,0,1943,1944,5,72,0,0,1944,1945,3,272,136,0,1945,1946,5,73,0,0,1946,
	1948,1,0,0,0,1947,1943,1,0,0,0,1948,1949,1,0,0,0,1949,1947,1,0,0,0,1949,
	1950,1,0,0,0,1950,1951,1,0,0,0,1951,1952,5,2,0,0,1952,1981,1,0,0,0,1953,
	1954,5,97,0,0,1954,1957,5,180,0,0,1955,1956,5,7,0,0,1956,1958,5,180,0,0,
	1957,1955,1,0,0,0,1958,1959,1,0,0,0,1959,1957,1,0,0,0,1959,1960,1,0,0,0,
	1960,1965,1,0,0,0,1961,1962,5,72,0,0,1962,1963,3,272,136,0,1963,1964,5,
	73,0,0,1964,1966,1,0,0,0,1965,1961,1,0,0,0,1966,1967,1,0,0,0,1967,1965,
	1,0,0,0,1967,1968,1,0,0,0,1968,1969,1,0,0,0,1969,1970,5,2,0,0,1970,1981,
	1,0,0,0,1971,1972,5,97,0,0,1972,1975,5,180,0,0,1973,1974,5,7,0,0,1974,1976,
	5,180,0,0,1975,1973,1,0,0,0,1976,1977,1,0,0,0,1977,1975,1,0,0,0,1977,1978,
	1,0,0,0,1978,1979,1,0,0,0,1979,1981,5,2,0,0,1980,1886,1,0,0,0,1980,1889,
	1,0,0,0,1980,1895,1,0,0,0,1980,1900,1,0,0,0,1980,1914,1,0,0,0,1980,1941,
	1,0,0,0,1980,1953,1,0,0,0,1980,1971,1,0,0,0,1981,167,1,0,0,0,1982,1983,
	5,41,0,0,1983,1984,5,57,0,0,1984,1985,5,154,0,0,1985,1986,5,23,0,0,1986,
	1989,3,272,136,0,1987,1988,5,5,0,0,1988,1990,3,246,123,0,1989,1987,1,0,
	0,0,1989,1990,1,0,0,0,1990,1991,1,0,0,0,1991,1992,5,58,0,0,1992,1993,5,
	2,0,0,1993,169,1,0,0,0,1994,1995,5,41,0,0,1995,1996,5,57,0,0,1996,1999,
	3,272,136,0,1997,1998,5,5,0,0,1998,2000,3,246,123,0,1999,1997,1,0,0,0,1999,
	2000,1,0,0,0,2000,2001,1,0,0,0,2001,2002,5,58,0,0,2002,2003,5,2,0,0,2003,
	171,1,0,0,0,2004,2005,5,98,0,0,2005,2006,5,57,0,0,2006,2007,3,272,136,0,
	2007,2008,5,58,0,0,2008,2011,3,118,59,0,2009,2010,5,99,0,0,2010,2012,3,
	118,59,0,2011,2009,1,0,0,0,2011,2012,1,0,0,0,2012,173,1,0,0,0,2013,2020,
	3,190,95,0,2014,2020,3,192,96,0,2015,2020,3,182,91,0,2016,2020,3,176,88,
	0,2017,2020,3,178,89,0,2018,2020,3,180,90,0,2019,2013,1,0,0,0,2019,2014,
	1,0,0,0,2019,2015,1,0,0,0,2019,2016,1,0,0,0,2019,2017,1,0,0,0,2019,2018,
	1,0,0,0,2020,175,1,0,0,0,2021,2022,5,11,0,0,2022,2023,5,57,0,0,2023,2024,
	3,292,146,0,2024,2025,5,180,0,0,2025,2026,5,5,0,0,2026,2027,3,292,146,0,
	2027,2028,5,180,0,0,2028,2029,5,100,0,0,2029,2030,5,42,0,0,2030,2031,5,
	7,0,0,2031,2032,5,180,0,0,2032,2033,5,7,0,0,2033,2034,5,33,0,0,2034,2035,
	5,58,0,0,2035,2036,3,118,59,0,2036,177,1,0,0,0,2037,2038,5,11,0,0,2038,
	2039,5,57,0,0,2039,2040,3,292,146,0,2040,2041,5,180,0,0,2041,2042,5,101,
	0,0,2042,2043,5,42,0,0,2043,2044,5,7,0,0,2044,2045,5,180,0,0,2045,2046,
	5,58,0,0,2046,2047,3,118,59,0,2047,179,1,0,0,0,2048,2049,5,11,0,0,2049,
	2050,5,57,0,0,2050,2051,3,292,146,0,2051,2052,5,180,0,0,2052,2053,5,100,
	0,0,2053,2054,5,42,0,0,2054,2055,5,7,0,0,2055,2056,5,180,0,0,2056,2057,
	5,58,0,0,2057,2058,3,118,59,0,2058,181,1,0,0,0,2059,2060,5,11,0,0,2060,
	2061,5,57,0,0,2061,2062,3,184,92,0,2062,2064,3,186,93,0,2063,2065,3,188,
	94,0,2064,2063,1,0,0,0,2064,2065,1,0,0,0,2065,2066,1,0,0,0,2066,2067,5,
	58,0,0,2067,2068,3,118,59,0,2068,183,1,0,0,0,2069,2073,3,292,146,0,2070,
	2072,3,282,141,0,2071,2070,1,0,0,0,2072,2075,1,0,0,0,2073,2071,1,0,0,0,
	2073,2074,1,0,0,0,2074,2076,1,0,0,0,2075,2073,1,0,0,0,2076,2079,5,180,0,
	0,2077,2078,5,48,0,0,2078,2080,3,272,136,0,2079,2077,1,0,0,0,2079,2080,
	1,0,0,0,2080,2081,1,0,0,0,2081,2082,5,2,0,0,2082,2115,1,0,0,0,2083,2084,
	5,180,0,0,2084,2085,7,9,0,0,2085,2086,3,272,136,0,2086,2087,5,2,0,0,2087,
	2115,1,0,0,0,2088,2089,5,57,0,0,2089,2092,3,162,81,0,2090,2091,5,5,0,0,
	2091,2093,3,162,81,0,2092,2090,1,0,0,0,2093,2094,1,0,0,0,2094,2092,1,0,
	0,0,2094,2095,1,0,0,0,2095,2096,1,0,0,0,2096,2097,5,58,0,0,2097,2109,5,
	48,0,0,2098,2099,5,57,0,0,2099,2102,3,272,136,0,2100,2101,5,5,0,0,2101,
	2103,3,272,136,0,2102,2100,1,0,0,0,2103,2104,1,0,0,0,2104,2102,1,0,0,0,
	2104,2105,1,0,0,0,2105,2106,1,0,0,0,2106,2107,5,58,0,0,2107,2110,1,0,0,
	0,2108,2110,3,272,136,0,2109,2098,1,0,0,0,2109,2108,1,0,0,0,2110,2111,1,
	0,0,0,2111,2112,5,2,0,0,2112,2115,1,0,0,0,2113,2115,5,2,0,0,2114,2069,1,
	0,0,0,2114,2083,1,0,0,0,2114,2088,1,0,0,0,2114,2113,1,0,0,0,2115,185,1,
	0,0,0,2116,2118,3,272,136,0,2117,2116,1,0,0,0,2117,2118,1,0,0,0,2118,2119,
	1,0,0,0,2119,2120,5,2,0,0,2120,187,1,0,0,0,2121,2122,5,180,0,0,2122,2123,
	7,9,0,0,2123,2153,3,272,136,0,2124,2125,5,180,0,0,2125,2153,7,11,0,0,2126,
	2127,7,11,0,0,2127,2153,5,180,0,0,2128,2129,5,57,0,0,2129,2132,3,162,81,
	0,2130,2131,5,5,0,0,2131,2133,3,162,81,0,2132,2130,1,0,0,0,2133,2134,1,
	0,0,0,2134,2132,1,0,0,0,2134,2135,1,0,0,0,2135,2136,1,0,0,0,2136,2137,5,
	58,0,0,2137,2149,5,48,0,0,2138,2139,5,57,0,0,2139,2142,3,272,136,0,2140,
	2141,5,5,0,0,2141,2143,3,272,136,0,2142,2140,1,0,0,0,2143,2144,1,0,0,0,
	2144,2142,1,0,0,0,2144,2145,1,0,0,0,2145,2146,1,0,0,0,2146,2147,5,58,0,
	0,2147,2150,1,0,0,0,2148,2150,3,272,136,0,2149,2138,1,0,0,0,2149,2148,1,
	0,0,0,2150,2153,1,0,0,0,2151,2153,3,272,136,0,2152,2121,1,0,0,0,2152,2124,
	1,0,0,0,2152,2126,1,0,0,0,2152,2128,1,0,0,0,2152,2151,1,0,0,0,2153,189,
	1,0,0,0,2154,2155,5,102,0,0,2155,2156,3,118,59,0,2156,2157,5,103,0,0,2157,
	2158,5,57,0,0,2158,2159,3,272,136,0,2159,2160,5,58,0,0,2160,2161,5,2,0,
	0,2161,191,1,0,0,0,2162,2163,5,103,0,0,2163,2164,5,57,0,0,2164,2165,3,272,
	136,0,2165,2166,5,58,0,0,2166,2167,3,118,59,0,2167,193,1,0,0,0,2168,2169,
	5,104,0,0,2169,2170,3,254,127,0,2170,2171,5,2,0,0,2171,195,1,0,0,0,2172,
	2174,5,105,0,0,2173,2175,5,151,0,0,2174,2173,1,0,0,0,2174,2175,1,0,0,0,
	2175,2186,1,0,0,0,2176,2177,5,57,0,0,2177,2182,5,151,0,0,2178,2179,5,5,
	0,0,2179,2181,5,151,0,0,2180,2178,1,0,0,0,2181,2184,1,0,0,0,2182,2180,1,
	0,0,0,2182,2183,1,0,0,0,2183,2185,1,0,0,0,2184,2182,1,0,0,0,2185,2187,5,
	58,0,0,2186,2176,1,0,0,0,2186,2187,1,0,0,0,2187,2188,1,0,0,0,2188,2189,
	3,198,99,0,2189,197,1,0,0,0,2190,2194,5,4,0,0,2191,2193,3,200,100,0,2192,
	2191,1,0,0,0,2193,2196,1,0,0,0,2194,2192,1,0,0,0,2194,2195,1,0,0,0,2195,
	2197,1,0,0,0,2196,2194,1,0,0,0,2197,2198,5,6,0,0,2198,199,1,0,0,0,2199,
	2213,3,198,99,0,2200,2213,3,202,101,0,2201,2213,3,204,102,0,2202,2213,3,
	206,103,0,2203,2213,3,208,104,0,2204,2213,3,214,107,0,2205,2213,3,216,108,
	0,2206,2213,5,106,0,0,2207,2213,5,107,0,0,2208,2213,5,37,0,0,2209,2213,
	3,220,110,0,2210,2213,3,224,112,0,2211,2213,3,226,113,0,2212,2199,1,0,0,
	0,2212,2200,1,0,0,0,2212,2201,1,0,0,0,2212,2202,1,0,0,0,2212,2203,1,0,0,
	0,2212,2204,1,0,0,0,2212,2205,1,0,0,0,2212,2206,1,0,0,0,2212,2207,1,0,0,
	0,2212,2208,1,0,0,0,2212,2209,1,0,0,0,2212,2210,1,0,0,0,2212,2211,1,0,0,
	0,2213,201,1,0,0,0,2214,2215,5,108,0,0,2215,2220,3,16,8,0,2216,2217,5,5,
	0,0,2217,2219,3,16,8,0,2218,2216,1,0,0,0,2219,2222,1,0,0,0,2220,2218,1,
	0,0,0,2220,2221,1,0,0,0,2221,2225,1,0,0,0,2222,2220,1,0,0,0,2223,2224,5,
	109,0,0,2224,2226,3,218,109,0,2225,2223,1,0,0,0,2225,2226,1,0,0,0,2226,
	203,1,0,0,0,2227,2232,3,224,112,0,2228,2229,5,5,0,0,2229,2231,3,224,112,
	0,2230,2228,1,0,0,0,2231,2234,1,0,0,0,2232,2230,1,0,0,0,2232,2233,1,0,0,
	0,2233,2235,1,0,0,0,2234,2232,1,0,0,0,2235,2236,5,109,0,0,2236,2237,3,218,
	109,0,2237,205,1,0,0,0,2238,2239,5,98,0,0,2239,2240,3,218,109,0,2240,2241,
	3,198,99,0,2241,207,1,0,0,0,2242,2243,5,110,0,0,2243,2253,3,218,109,0,2244,
	2246,3,210,105,0,2245,2244,1,0,0,0,2246,2247,1,0,0,0,2247,2245,1,0,0,0,
	2247,2248,1,0,0,0,2248,2250,1,0,0,0,2249,2251,3,212,106,0,2250,2249,1,0,
	0,0,2250,2251,1,0,0,0,2251,2254,1,0,0,0,2252,2254,3,212,106,0,2253,2245,
	1,0,0,0,2253,2252,1,0,0,0,2254,209,1,0,0,0,2255,2256,5,111,0,0,2256,2257,
	3,226,113,0,2257,2258,3,198,99,0,2258,211,1,0,0,0,2259,2260,5,112,0,0,2260,
	2261,3,198,99,0,2261,213,1,0,0,0,2262,2263,5,11,0,0,2263,2264,3,198,99,
	0,2264,2265,3,218,109,0,2265,2266,3,198,99,0,2266,2267,3,198,99,0,2267,
	215,1,0,0,0,2268,2269,5,9,0,0,2269,2270,5,180,0,0,2270,2279,5,57,0,0,2271,
	2276,5,180,0,0,2272,2273,5,5,0,0,2273,2275,5,180,0,0,2274,2272,1,0,0,0,
	2275,2278,1,0,0,0,2276,2274,1,0,0,0,2276,2277,1,0,0,0,2277,2280,1,0,0,0,
	2278,2276,1,0,0,0,2279,2271,1,0,0,0,2279,2280,1,0,0,0,2280,2281,1,0,0,0,
	2281,2291,5,58,0,0,2282,2283,5,113,0,0,2283,2288,5,180,0,0,2284,2285,5,
	5,0,0,2285,2287,5,180,0,0,2286,2284,1,0,0,0,2287,2290,1,0,0,0,2288,2286,
	1,0,0,0,2288,2289,1,0,0,0,2289,2292,1,0,0,0,2290,2288,1,0,0,0,2291,2282,
	1,0,0,0,2291,2292,1,0,0,0,2292,2293,1,0,0,0,2293,2294,3,198,99,0,2294,217,
	1,0,0,0,2295,2299,3,220,110,0,2296,2299,3,224,112,0,2297,2299,3,226,113,
	0,2298,2295,1,0,0,0,2298,2296,1,0,0,0,2298,2297,1,0,0,0,2299,219,1,0,0,
	0,2300,2301,3,222,111,0,2301,2310,5,57,0,0,2302,2307,3,218,109,0,2303,2304,
	5,5,0,0,2304,2306,3,218,109,0,2305,2303,1,0,0,0,2306,2309,1,0,0,0,2307,
	2305,1,0,0,0,2307,2308,1,0,0,0,2308,2311,1,0,0,0,2309,2307,1,0,0,0,2310,
	2302,1,0,0,0,2310,2311,1,0,0,0,2311,2312,1,0,0,0,2312,2313,5,58,0,0,2313,
	221,1,0,0,0,2314,2315,7,12,0,0,2315,223,1,0,0,0,2316,2324,3,16,8,0,2317,
	2318,5,7,0,0,2318,2323,3,16,8,0,2319,2323,5,164,0,0,2320,2321,5,7,0,0,2321,
	2323,5,81,0,0,2322,2317,1,0,0,0,2322,2319,1,0,0,0,2322,2320,1,0,0,0,2323,
	2326,1,0,0,0,2324,2322,1,0,0,0,2324,2325,1,0,0,0,2325,225,1,0,0,0,2326,
	2324,1,0,0,0,2327,2328,7,13,0,0,2328,227,1,0,0,0,2329,2330,5,114,0,0,2330,
	2334,5,4,0,0,2331,2333,3,122,61,0,2332,2331,1,0,0,0,2333,2336,1,0,0,0,2334,
	2332,1,0,0,0,2334,2335,1,0,0,0,2335,2337,1,0,0,0,2336,2334,1,0,0,0,2337,
	2338,5,6,0,0,2338,229,1,0,0,0,2339,2340,5,110,0,0,2340,2341,5,57,0,0,2341,
	2342,3,272,136,0,2342,2343,5,58,0,0,2343,2347,5,4,0,0,2344,2346,3,232,116,
	0,2345,2344,1,0,0,0,2346,2349,1,0,0,0,2347,2345,1,0,0,0,2347,2348,1,0,0,
	0,2348,2351,1,0,0,0,2349,2347,1,0,0,0,2350,2352,3,234,117,0,2351,2350,1,
	0,0,0,2351,2352,1,0,0,0,2352,2353,1,0,0,0,2353,2354,5,6,0,0,2354,231,1,
	0,0,0,2355,2356,5,111,0,0,2356,2357,3,272,136,0,2357,2361,5,115,0,0,2358,
	2360,3,122,61,0,2359,2358,1,0,0,0,2360,2363,1,0,0,0,2361,2359,1,0,0,0,2361,
	2362,1,0,0,0,2362,233,1,0,0,0,2363,2361,1,0,0,0,2364,2365,5,112,0,0,2365,
	2369,5,115,0,0,2366,2368,3,122,61,0,2367,2366,1,0,0,0,2368,2371,1,0,0,0,
	2369,2367,1,0,0,0,2369,2370,1,0,0,0,2370,235,1,0,0,0,2371,2369,1,0,0,0,
	2372,2373,5,116,0,0,2373,2375,3,272,136,0,2374,2376,3,238,119,0,2375,2374,
	1,0,0,0,2375,2376,1,0,0,0,2376,2377,1,0,0,0,2377,2379,3,118,59,0,2378,2380,
	3,240,120,0,2379,2378,1,0,0,0,2380,2381,1,0,0,0,2381,2379,1,0,0,0,2381,
	2382,1,0,0,0,2382,237,1,0,0,0,2383,2384,5,78,0,0,2384,2396,5,57,0,0,2385,
	2390,3,116,58,0,2386,2387,5,5,0,0,2387,2389,3,116,58,0,2388,2386,1,0,0,
	0,2389,2392,1,0,0,0,2390,2388,1,0,0,0,2390,2391,1,0,0,0,2391,2394,1,0,0,
	0,2392,2390,1,0,0,0,2393,2395,5,5,0,0,2394,2393,1,0,0,0,2394,2395,1,0,0,
	0,2395,2397,1,0,0,0,2396,2385,1,0,0,0,2396,2397,1,0,0,0,2397,2398,1,0,0,
	0,2398,2399,5,58,0,0,2399,239,1,0,0,0,2400,2402,5,117,0,0,2401,2403,5,180,
	0,0,2402,2401,1,0,0,0,2402,2403,1,0,0,0,2403,2419,1,0,0,0,2404,2416,5,57,
	0,0,2405,2410,3,116,58,0,2406,2407,5,5,0,0,2407,2409,3,116,58,0,2408,2406,
	1,0,0,0,2409,2412,1,0,0,0,2410,2408,1,0,0,0,2410,2411,1,0,0,0,2411,2414,
	1,0,0,0,2412,2410,1,0,0,0,2413,2415,5,5,0,0,2414,2413,1,0,0,0,2414,2415,
	1,0,0,0,2415,2417,1,0,0,0,2416,2405,1,0,0,0,2416,2417,1,0,0,0,2417,2418,
	1,0,0,0,2418,2420,5,58,0,0,2419,2404,1,0,0,0,2419,2420,1,0,0,0,2420,2421,
	1,0,0,0,2421,2422,3,118,59,0,2422,241,1,0,0,0,2423,2424,5,106,0,0,2424,
	2425,5,2,0,0,2425,243,1,0,0,0,2426,2427,5,107,0,0,2427,2428,5,2,0,0,2428,
	245,1,0,0,0,2429,2434,5,151,0,0,2430,2431,5,180,0,0,2431,2434,3,260,130,
	0,2432,2434,3,272,136,0,2433,2429,1,0,0,0,2433,2430,1,0,0,0,2433,2432,1,
	0,0,0,2434,247,1,0,0,0,2435,2436,5,35,0,0,2436,2439,3,16,8,0,2437,2438,
	5,7,0,0,2438,2440,5,180,0,0,2439,2437,1,0,0,0,2439,2440,1,0,0,0,2440,2441,
	1,0,0,0,2441,2442,5,57,0,0,2442,2454,5,4,0,0,2443,2448,3,258,129,0,2444,
	2445,5,5,0,0,2445,2447,3,258,129,0,2446,2444,1,0,0,0,2447,2450,1,0,0,0,
	2448,2446,1,0,0,0,2448,2449,1,0,0,0,2449,2452,1,0,0,0,2450,2448,1,0,0,0,
	2451,2453,5,5,0,0,2452,2451,1,0,0,0,2452,2453,1,0,0,0,2453,2455,1,0,0,0,
	2454,2443,1,0,0,0,2454,2455,1,0,0,0,2455,2456,1,0,0,0,2456,2457,5,6,0,0,
	2457,2458,5,58,0,0,2458,2459,5,2,0,0,2459,2480,1,0,0,0,2460,2461,5,35,0,
	0,2461,2464,3,16,8,0,2462,2463,5,7,0,0,2463,2465,5,180,0,0,2464,2462,1,
	0,0,0,2464,2465,1,0,0,0,2465,2466,1,0,0,0,2466,2467,3,260,130,0,2467,2468,
	5,2,0,0,2468,2480,1,0,0,0,2469,2470,5,35,0,0,2470,2471,5,57,0,0,2471,2472,
	3,272,136,0,2472,2473,5,58,0,0,2473,2474,5,2,0,0,2474,2480,1,0,0,0,2475,
	2476,5,35,0,0,2476,2477,5,57,0,0,2477,2478,5,58,0,0,2478,2480,5,2,0,0,2479,
	2435,1,0,0,0,2479,2460,1,0,0,0,2479,2469,1,0,0,0,2479,2475,1,0,0,0,2480,
	249,1,0,0,0,2481,2482,5,118,0,0,2482,2483,5,57,0,0,2483,2484,3,272,136,
	0,2484,2485,5,58,0,0,2485,2486,5,2,0,0,2486,251,1,0,0,0,2487,2490,5,180,
	0,0,2488,2490,3,286,143,0,2489,2487,1,0,0,0,2489,2488,1,0,0,0,2490,253,
	1,0,0,0,2491,2503,5,57,0,0,2492,2497,3,252,126,0,2493,2494,5,5,0,0,2494,
	2496,3,252,126,0,2495,2493,1,0,0,0,2496,2499,1,0,0,0,2497,2495,1,0,0,0,
	2497,2498,1,0,0,0,2498,2501,1,0,0,0,2499,2497,1,0,0,0,2500,2502,5,5,0,0,
	2501,2500,1,0,0,0,2501,2502,1,0,0,0,2502,2504,1,0,0,0,2503,2492,1,0,0,0,
	2503,2504,1,0,0,0,2504,2505,1,0,0,0,2505,2506,5,58,0,0,2506,255,1,0,0,0,
	2507,2508,5,180,0,0,2508,2572,3,260,130,0,2509,2510,5,31,0,0,2510,2572,
	3,260,130,0,2511,2512,5,180,0,0,2512,2513,3,264,132,0,2513,2514,3,260,130,
	0,2514,2572,1,0,0,0,2515,2516,5,43,0,0,2516,2572,3,260,130,0,2517,2518,
	5,180,0,0,2518,2519,5,7,0,0,2519,2520,5,180,0,0,2520,2572,3,260,130,0,2521,
	2522,5,180,0,0,2522,2523,5,57,0,0,2523,2535,5,4,0,0,2524,2529,3,258,129,
	0,2525,2526,5,5,0,0,2526,2528,3,258,129,0,2527,2525,1,0,0,0,2528,2531,1,
	0,0,0,2529,2527,1,0,0,0,2529,2530,1,0,0,0,2530,2533,1,0,0,0,2531,2529,1,
	0,0,0,2532,2534,5,5,0,0,2533,2532,1,0,0,0,2533,2534,1,0,0,0,2534,2536,1,
	0,0,0,2535,2524,1,0,0,0,2535,2536,1,0,0,0,2536,2537,1,0,0,0,2537,2538,5,
	6,0,0,2538,2572,5,58,0,0,2539,2540,5,57,0,0,2540,2541,5,180,0,0,2541,2542,
	5,58,0,0,2542,2572,3,260,130,0,2543,2544,5,57,0,0,2544,2545,5,180,0,0,2545,
	2546,5,7,0,0,2546,2547,5,180,0,0,2547,2548,5,58,0,0,2548,2572,3,260,130,
	0,2549,2550,5,57,0,0,2550,2551,5,180,0,0,2551,2552,5,7,0,0,2552,2553,5,
	180,0,0,2553,2554,5,58,0,0,2554,2555,5,57,0,0,2555,2567,5,4,0,0,2556,2561,
	3,258,129,0,2557,2558,5,5,0,0,2558,2560,3,258,129,0,2559,2557,1,0,0,0,2560,
	2563,1,0,0,0,2561,2559,1,0,0,0,2561,2562,1,0,0,0,2562,2565,1,0,0,0,2563,
	2561,1,0,0,0,2564,2566,5,5,0,0,2565,2564,1,0,0,0,2565,2566,1,0,0,0,2566,
	2568,1,0,0,0,2567,2556,1,0,0,0,2567,2568,1,0,0,0,2568,2569,1,0,0,0,2569,
	2570,5,6,0,0,2570,2572,5,58,0,0,2571,2507,1,0,0,0,2571,2509,1,0,0,0,2571,
	2511,1,0,0,0,2571,2515,1,0,0,0,2571,2517,1,0,0,0,2571,2521,1,0,0,0,2571,
	2539,1,0,0,0,2571,2543,1,0,0,0,2571,2549,1,0,0,0,2572,257,1,0,0,0,2573,
	2574,5,180,0,0,2574,2575,5,115,0,0,2575,2576,3,272,136,0,2576,259,1,0,0,
	0,2577,2589,5,57,0,0,2578,2583,3,262,131,0,2579,2580,5,5,0,0,2580,2582,
	3,262,131,0,2581,2579,1,0,0,0,2582,2585,1,0,0,0,2583,2581,1,0,0,0,2583,
	2584,1,0,0,0,2584,2587,1,0,0,0,2585,2583,1,0,0,0,2586,2588,5,5,0,0,2587,
	2586,1,0,0,0,2587,2588,1,0,0,0,2588,2590,1,0,0,0,2589,2578,1,0,0,0,2589,
	2590,1,0,0,0,2590,2591,1,0,0,0,2591,2592,5,58,0,0,2592,261,1,0,0,0,2593,
	2596,3,272,136,0,2594,2595,7,9,0,0,2595,2597,3,142,71,0,2596,2594,1,0,0,
	0,2596,2597,1,0,0,0,2597,263,1,0,0,0,2598,2599,5,4,0,0,2599,2604,3,266,
	133,0,2600,2601,5,5,0,0,2601,2603,3,266,133,0,2602,2600,1,0,0,0,2603,2606,
	1,0,0,0,2604,2602,1,0,0,0,2604,2605,1,0,0,0,2605,2608,1,0,0,0,2606,2604,
	1,0,0,0,2607,2609,5,5,0,0,2608,2607,1,0,0,0,2608,2609,1,0,0,0,2609,2610,
	1,0,0,0,2610,2611,5,6,0,0,2611,265,1,0,0,0,2612,2613,5,180,0,0,2613,2614,
	5,115,0,0,2614,2615,3,272,136,0,2615,267,1,0,0,0,2616,2628,5,57,0,0,2617,
	2622,3,270,135,0,2618,2619,5,5,0,0,2619,2621,3,270,135,0,2620,2618,1,0,
	0,0,2621,2624,1,0,0,0,2622,2620,1,0,0,0,2622,2623,1,0,0,0,2623,2626,1,0,
	0,0,2624,2622,1,0,0,0,2625,2627,5,5,0,0,2626,2625,1,0,0,0,2626,2627,1,0,
	0,0,2627,2629,1,0,0,0,2628,2617,1,0,0,0,2628,2629,1,0,0,0,2629,2630,1,0,
	0,0,2630,2631,5,58,0,0,2631,269,1,0,0,0,2632,2648,3,292,146,0,2633,2648,
	3,92,46,0,2634,2635,5,57,0,0,2635,2636,3,270,135,0,2636,2644,5,58,0,0,2637,
	2639,5,72,0,0,2638,2640,3,272,136,0,2639,2638,1,0,0,0,2639,2640,1,0,0,0,
	2640,2641,1,0,0,0,2641,2643,5,73,0,0,2642,2637,1,0,0,0,2643,2646,1,0,0,
	0,2644,2642,1,0,0,0,2644,2645,1,0,0,0,2645,2648,1,0,0,0,2646,2644,1,0,0,
	0,2647,2632,1,0,0,0,2647,2633,1,0,0,0,2647,2634,1,0,0,0,2648,271,1,0,0,
	0,2649,2650,6,136,-1,0,2650,2651,5,57,0,0,2651,2652,5,180,0,0,2652,2653,
	7,9,0,0,2653,2654,3,272,136,0,2654,2655,5,58,0,0,2655,2848,1,0,0,0,2656,
	2657,5,57,0,0,2657,2658,5,82,0,0,2658,2659,5,180,0,0,2659,2660,5,58,0,0,
	2660,2661,3,264,132,0,2661,2662,3,260,130,0,2662,2848,1,0,0,0,2663,2664,
	5,57,0,0,2664,2665,3,272,136,0,2665,2666,5,58,0,0,2666,2848,1,0,0,0,2667,
	2668,5,57,0,0,2668,2848,5,58,0,0,2669,2670,5,57,0,0,2670,2673,3,272,136,
	0,2671,2672,5,5,0,0,2672,2674,3,272,136,0,2673,2671,1,0,0,0,2674,2675,1,
	0,0,0,2675,2673,1,0,0,0,2675,2676,1,0,0,0,2676,2677,1,0,0,0,2677,2678,5,
	58,0,0,2678,2848,1,0,0,0,2679,2680,3,298,149,0,2680,2681,5,57,0,0,2681,
	2683,3,272,136,0,2682,2684,5,5,0,0,2683,2682,1,0,0,0,2683,2684,1,0,0,0,
	2684,2685,1,0,0,0,2685,2686,5,58,0,0,2686,2848,1,0,0,0,2687,2688,3,300,
	150,0,2688,2689,5,57,0,0,2689,2691,3,272,136,0,2690,2692,5,5,0,0,2691,2690,
	1,0,0,0,2691,2692,1,0,0,0,2692,2693,1,0,0,0,2693,2694,5,58,0,0,2694,2848,
	1,0,0,0,2695,2697,3,256,128,0,2696,2698,3,260,130,0,2697,2696,1,0,0,0,2698,
	2699,1,0,0,0,2699,2697,1,0,0,0,2699,2700,1,0,0,0,2700,2848,1,0,0,0,2701,
	2848,3,256,128,0,2702,2703,5,57,0,0,2703,2704,3,272,136,0,2704,2705,5,58,
	0,0,2705,2706,3,260,130,0,2706,2848,1,0,0,0,2707,2708,5,82,0,0,2708,2710,
	5,180,0,0,2709,2711,3,264,132,0,2710,2709,1,0,0,0,2710,2711,1,0,0,0,2711,
	2712,1,0,0,0,2712,2848,3,260,130,0,2713,2714,5,82,0,0,2714,2720,3,292,146,
	0,2715,2717,5,72,0,0,2716,2718,5,145,0,0,2717,2716,1,0,0,0,2717,2718,1,
	0,0,0,2718,2719,1,0,0,0,2719,2721,5,73,0,0,2720,2715,1,0,0,0,2721,2722,
	1,0,0,0,2722,2720,1,0,0,0,2722,2723,1,0,0,0,2723,2724,1,0,0,0,2724,2725,
	5,57,0,0,2725,2726,3,272,136,0,2726,2727,5,58,0,0,2727,2848,1,0,0,0,2728,
	2729,5,82,0,0,2729,2730,5,148,0,0,2730,2731,5,57,0,0,2731,2732,3,272,136,
	0,2732,2733,5,58,0,0,2733,2848,1,0,0,0,2734,2735,5,82,0,0,2735,2736,5,146,
	0,0,2736,2737,5,57,0,0,2737,2738,3,272,136,0,2738,2739,5,58,0,0,2739,2848,
	1,0,0,0,2740,2741,3,274,137,0,2741,2742,5,7,0,0,2742,2743,5,180,0,0,2743,
	2848,1,0,0,0,2744,2745,5,119,0,0,2745,2848,3,260,130,0,2746,2747,5,120,
	0,0,2747,2848,3,260,130,0,2748,2749,5,121,0,0,2749,2848,3,260,130,0,2750,
	2751,5,122,0,0,2751,2848,3,260,130,0,2752,2753,5,123,0,0,2753,2761,5,57,
	0,0,2754,2755,7,14,0,0,2755,2756,5,7,0,0,2756,2762,5,180,0,0,2757,2762,
	5,180,0,0,2758,2759,5,180,0,0,2759,2760,5,57,0,0,2760,2762,5,58,0,0,2761,
	2754,1,0,0,0,2761,2757,1,0,0,0,2761,2758,1,0,0,0,2762,2763,1,0,0,0,2763,
	2764,5,5,0,0,2764,2765,3,276,138,0,2765,2766,5,58,0,0,2766,2848,1,0,0,0,
	2767,2768,5,124,0,0,2768,2848,3,260,130,0,2769,2770,5,125,0,0,2770,2848,
	3,260,130,0,2771,2772,5,126,0,0,2772,2773,5,57,0,0,2773,2774,3,272,136,
	0,2774,2775,5,5,0,0,2775,2776,3,268,134,0,2776,2777,5,58,0,0,2777,2848,
	1,0,0,0,2778,2779,5,127,0,0,2779,2780,5,57,0,0,2780,2781,3,272,136,0,2781,
	2782,5,5,0,0,2782,2783,3,268,134,0,2783,2784,5,5,0,0,2784,2785,5,145,0,
	0,2785,2786,5,58,0,0,2786,2848,1,0,0,0,2787,2848,7,15,0,0,2788,2789,5,128,
	0,0,2789,2790,5,72,0,0,2790,2791,3,272,136,0,2791,2792,5,73,0,0,2792,2793,
	7,16,0,0,2793,2848,1,0,0,0,2794,2795,5,129,0,0,2795,2796,5,72,0,0,2796,
	2797,3,272,136,0,2797,2798,5,73,0,0,2798,2799,7,17,0,0,2799,2848,1,0,0,
	0,2800,2801,7,11,0,0,2801,2848,3,272,136,22,2802,2803,7,18,0,0,2803,2848,
	3,272,136,21,2804,2816,5,72,0,0,2805,2810,3,272,136,0,2806,2807,5,5,0,0,
	2807,2809,3,272,136,0,2808,2806,1,0,0,0,2809,2812,1,0,0,0,2810,2808,1,0,
	0,0,2810,2811,1,0,0,0,2811,2814,1,0,0,0,2812,2810,1,0,0,0,2813,2815,5,5,
	0,0,2814,2813,1,0,0,0,2814,2815,1,0,0,0,2815,2817,1,0,0,0,2816,2805,1,0,
	0,0,2816,2817,1,0,0,0,2817,2818,1,0,0,0,2818,2848,5,73,0,0,2819,2820,5,
	42,0,0,2820,2821,5,7,0,0,2821,2822,5,180,0,0,2822,2823,5,7,0,0,2823,2824,
	5,180,0,0,2824,2825,5,72,0,0,2825,2826,3,272,136,0,2826,2827,5,73,0,0,2827,
	2828,3,280,140,0,2828,2848,1,0,0,0,2829,2830,5,42,0,0,2830,2831,5,7,0,0,
	2831,2836,5,180,0,0,2832,2833,5,72,0,0,2833,2834,3,272,136,0,2834,2835,
	5,73,0,0,2835,2837,1,0,0,0,2836,2832,1,0,0,0,2837,2838,1,0,0,0,2838,2836,
	1,0,0,0,2838,2839,1,0,0,0,2839,2848,1,0,0,0,2840,2841,5,42,0,0,2841,2842,
	5,7,0,0,2842,2848,5,180,0,0,2843,2848,5,42,0,0,2844,2848,5,160,0,0,2845,
	2848,3,16,8,0,2846,2848,3,286,143,0,2847,2649,1,0,0,0,2847,2656,1,0,0,0,
	2847,2663,1,0,0,0,2847,2667,1,0,0,0,2847,2669,1,0,0,0,2847,2679,1,0,0,0,
	2847,2687,1,0,0,0,2847,2695,1,0,0,0,2847,2701,1,0,0,0,2847,2702,1,0,0,0,
	2847,2707,1,0,0,0,2847,2713,1,0,0,0,2847,2728,1,0,0,0,2847,2734,1,0,0,0,
	2847,2740,1,0,0,0,2847,2744,1,0,0,0,2847,2746,1,0,0,0,2847,2748,1,0,0,0,
	2847,2750,1,0,0,0,2847,2752,1,0,0,0,2847,2767,1,0,0,0,2847,2769,1,0,0,0,
	2847,2771,1,0,0,0,2847,2778,1,0,0,0,2847,2787,1,0,0,0,2847,2788,1,0,0,0,
	2847,2794,1,0,0,0,2847,2800,1,0,0,0,2847,2802,1,0,0,0,2847,2804,1,0,0,0,
	2847,2819,1,0,0,0,2847,2829,1,0,0,0,2847,2840,1,0,0,0,2847,2843,1,0,0,0,
	2847,2844,1,0,0,0,2847,2845,1,0,0,0,2847,2846,1,0,0,0,2848,3015,1,0,0,0,
	2849,2850,10,20,0,0,2850,2851,5,17,0,0,2851,3014,3,272,136,20,2852,2853,
	10,19,0,0,2853,2854,7,19,0,0,2854,3014,3,272,136,20,2855,2856,10,18,0,0,
	2856,2857,7,20,0,0,2857,3014,3,272,136,19,2858,2859,10,17,0,0,2859,2860,
	7,21,0,0,2860,3014,3,272,136,18,2861,2862,10,16,0,0,2862,2863,5,24,0,0,
	2863,3014,3,272,136,17,2864,2865,10,15,0,0,2865,2866,5,26,0,0,2866,3014,
	3,272,136,16,2867,2868,10,14,0,0,2868,2869,5,25,0,0,2869,3014,3,272,136,
	15,2870,2871,10,13,0,0,2871,2872,7,22,0,0,2872,3014,3,272,136,14,2873,2874,
	10,12,0,0,2874,2875,7,23,0,0,2875,3014,3,272,136,13,2876,2877,10,11,0,0,
	2877,2878,5,134,0,0,2878,3014,3,272,136,12,2879,2880,10,10,0,0,2880,2881,
	5,47,0,0,2881,3014,3,272,136,11,2882,2883,10,40,0,0,2883,2885,5,72,0,0,
	2884,2886,3,272,136,0,2885,2884,1,0,0,0,2885,2886,1,0,0,0,2886,2887,1,0,
	0,0,2887,2889,5,115,0,0,2888,2890,3,272,136,0,2889,2888,1,0,0,0,2889,2890,
	1,0,0,0,2890,2891,1,0,0,0,2891,3014,5,73,0,0,2892,2893,10,39,0,0,2893,2894,
	5,72,0,0,2894,2895,5,145,0,0,2895,3014,5,73,0,0,2896,2897,10,38,0,0,2897,
	2898,5,72,0,0,2898,2899,3,272,136,0,2899,2900,5,73,0,0,2900,3014,1,0,0,
	0,2901,2902,10,35,0,0,2902,3014,7,24,0,0,2903,2904,10,34,0,0,2904,2905,
	5,167,0,0,2905,2906,5,57,0,0,2906,2907,3,272,136,0,2907,2908,5,58,0,0,2908,
	3014,1,0,0,0,2909,2910,10,33,0,0,2910,2911,5,168,0,0,2911,2912,5,57,0,0,
	2912,2913,3,272,136,0,2913,2914,5,5,0,0,2914,2915,3,272,136,0,2915,2916,
	5,58,0,0,2916,3014,1,0,0,0,2917,2918,10,32,0,0,2918,2919,5,7,0,0,2919,2923,
	5,180,0,0,2920,2921,5,7,0,0,2921,2924,5,180,0,0,2922,2924,5,163,0,0,2923,
	2920,1,0,0,0,2923,2922,1,0,0,0,2924,2925,1,0,0,0,2925,2926,5,57,0,0,2926,
	2927,3,272,136,0,2927,2928,5,58,0,0,2928,2929,3,260,130,0,2929,3014,1,0,
	0,0,2930,2931,10,31,0,0,2931,2932,5,7,0,0,2932,2934,5,180,0,0,2933,2935,
	3,264,132,0,2934,2933,1,0,0,0,2934,2935,1,0,0,0,2935,2936,1,0,0,0,2936,
	2937,5,57,0,0,2937,2949,5,4,0,0,2938,2943,3,258,129,0,2939,2940,5,5,0,0,
	2940,2942,3,258,129,0,2941,2939,1,0,0,0,2942,2945,1,0,0,0,2943,2941,1,0,
	0,0,2943,2944,1,0,0,0,2944,2947,1,0,0,0,2945,2943,1,0,0,0,2946,2948,5,5,
	0,0,2947,2946,1,0,0,0,2947,2948,1,0,0,0,2948,2950,1,0,0,0,2949,2938,1,0,
	0,0,2949,2950,1,0,0,0,2950,2951,1,0,0,0,2951,2952,5,6,0,0,2952,3014,5,58,
	0,0,2953,2954,10,30,0,0,2954,2955,5,7,0,0,2955,2957,5,180,0,0,2956,2958,
	3,264,132,0,2957,2956,1,0,0,0,2957,2958,1,0,0,0,2958,2959,1,0,0,0,2959,
	2961,3,260,130,0,2960,2962,3,260,130,0,2961,2960,1,0,0,0,2962,2963,1,0,
	0,0,2963,2961,1,0,0,0,2963,2964,1,0,0,0,2964,3014,1,0,0,0,2965,2966,10,
	29,0,0,2966,2968,5,164,0,0,2967,2969,3,264,132,0,2968,2967,1,0,0,0,2968,
	2969,1,0,0,0,2969,2970,1,0,0,0,2970,3014,3,260,130,0,2971,2972,10,28,0,
	0,2972,2974,5,163,0,0,2973,2975,3,264,132,0,2974,2973,1,0,0,0,2974,2975,
	1,0,0,0,2975,2976,1,0,0,0,2976,3014,3,260,130,0,2977,2978,10,27,0,0,2978,
	2979,5,7,0,0,2979,2981,5,180,0,0,2980,2982,3,264,132,0,2981,2980,1,0,0,
	0,2981,2982,1,0,0,0,2982,2983,1,0,0,0,2983,3014,3,260,130,0,2984,2985,10,
	26,0,0,2985,2986,5,7,0,0,2986,2987,5,180,0,0,2987,2988,3,264,132,0,2988,
	2989,3,280,140,0,2989,3014,1,0,0,0,2990,2991,10,25,0,0,2991,2992,5,72,0,
	0,2992,2993,3,272,136,0,2993,2994,5,73,0,0,2994,2995,3,260,130,0,2995,3014,
	1,0,0,0,2996,2997,10,24,0,0,2997,3014,3,280,140,0,2998,2999,10,23,0,0,2999,
	3014,7,11,0,0,3000,3001,10,9,0,0,3001,3002,5,135,0,0,3002,3005,3,272,136,
	0,3003,3004,7,9,0,0,3004,3006,3,142,71,0,3005,3003,1,0,0,0,3005,3006,1,
	0,0,0,3006,3007,1,0,0,0,3007,3008,5,115,0,0,3008,3011,3,272,136,0,3009,
	3010,7,9,0,0,3010,3012,3,142,71,0,3011,3009,1,0,0,0,3011,3012,1,0,0,0,3012,
	3014,1,0,0,0,3013,2849,1,0,0,0,3013,2852,1,0,0,0,3013,2855,1,0,0,0,3013,
	2858,1,0,0,0,3013,2861,1,0,0,0,3013,2864,1,0,0,0,3013,2867,1,0,0,0,3013,
	2870,1,0,0,0,3013,2873,1,0,0,0,3013,2876,1,0,0,0,3013,2879,1,0,0,0,3013,
	2882,1,0,0,0,3013,2892,1,0,0,0,3013,2896,1,0,0,0,3013,2901,1,0,0,0,3013,
	2903,1,0,0,0,3013,2909,1,0,0,0,3013,2917,1,0,0,0,3013,2930,1,0,0,0,3013,
	2953,1,0,0,0,3013,2965,1,0,0,0,3013,2971,1,0,0,0,3013,2977,1,0,0,0,3013,
	2984,1,0,0,0,3013,2990,1,0,0,0,3013,2996,1,0,0,0,3013,2998,1,0,0,0,3013,
	3000,1,0,0,0,3014,3017,1,0,0,0,3015,3013,1,0,0,0,3015,3016,1,0,0,0,3016,
	273,1,0,0,0,3017,3015,1,0,0,0,3018,3019,5,63,0,0,3019,3020,5,57,0,0,3020,
	3021,3,292,146,0,3021,3022,5,58,0,0,3022,3031,1,0,0,0,3023,3024,5,57,0,
	0,3024,3025,5,63,0,0,3025,3026,5,57,0,0,3026,3027,3,292,146,0,3027,3028,
	5,58,0,0,3028,3029,5,58,0,0,3029,3031,1,0,0,0,3030,3018,1,0,0,0,3030,3023,
	1,0,0,0,3031,275,1,0,0,0,3032,3033,5,57,0,0,3033,3034,5,180,0,0,3034,3035,
	5,58,0,0,3035,3036,5,48,0,0,3036,3041,3,272,136,0,3037,3041,3,272,136,0,
	3038,3039,5,57,0,0,3039,3041,5,58,0,0,3040,3032,1,0,0,0,3040,3037,1,0,0,
	0,3040,3038,1,0,0,0,3041,277,1,0,0,0,3042,3043,7,15,0,0,3043,3044,5,2,0,
	0,3044,279,1,0,0,0,3045,3046,5,7,0,0,3046,3063,5,180,0,0,3047,3048,5,7,
	0,0,3048,3063,5,34,0,0,3049,3050,5,7,0,0,3050,3063,5,81,0,0,3051,3063,5,
	163,0,0,3052,3063,5,172,0,0,3053,3063,5,173,0,0,3054,3063,5,174,0,0,3055,
	3063,5,175,0,0,3056,3063,5,176,0,0,3057,3063,5,177,0,0,3058,3063,5,178,
	0,0,3059,3063,5,179,0,0,3060,3063,5,170,0,0,3061,3063,5,171,0,0,3062,3045,
	1,0,0,0,3062,3047,1,0,0,0,3062,3049,1,0,0,0,3062,3051,1,0,0,0,3062,3052,
	1,0,0,0,3062,3053,1,0,0,0,3062,3054,1,0,0,0,3062,3055,1,0,0,0,3062,3056,
	1,0,0,0,3062,3057,1,0,0,0,3062,3058,1,0,0,0,3062,3059,1,0,0,0,3062,3060,
	1,0,0,0,3062,3061,1,0,0,0,3063,281,1,0,0,0,3064,3065,7,25,0,0,3065,283,
	1,0,0,0,3066,3067,7,26,0,0,3067,285,1,0,0,0,3068,3095,5,141,0,0,3069,3095,
	3,288,144,0,3070,3095,3,290,145,0,3071,3075,5,151,0,0,3072,3074,5,151,0,
	0,3073,3072,1,0,0,0,3074,3077,1,0,0,0,3075,3073,1,0,0,0,3075,3076,1,0,0,
	0,3076,3095,1,0,0,0,3077,3075,1,0,0,0,3078,3082,5,161,0,0,3079,3081,5,161,
	0,0,3080,3079,1,0,0,0,3081,3084,1,0,0,0,3082,3080,1,0,0,0,3082,3083,1,0,
	0,0,3083,3095,1,0,0,0,3084,3082,1,0,0,0,3085,3089,5,162,0,0,3086,3088,5,
	162,0,0,3087,3086,1,0,0,0,3088,3091,1,0,0,0,3089,3087,1,0,0,0,3089,3090,
	1,0,0,0,3090,3095,1,0,0,0,3091,3089,1,0,0,0,3092,3095,5,152,0,0,3093,3095,
	5,153,0,0,3094,3068,1,0,0,0,3094,3069,1,0,0,0,3094,3070,1,0,0,0,3094,3071,
	1,0,0,0,3094,3078,1,0,0,0,3094,3085,1,0,0,0,3094,3092,1,0,0,0,3094,3093,
	1,0,0,0,3095,287,1,0,0,0,3096,3098,5,145,0,0,3097,3099,7,27,0,0,3098,3097,
	1,0,0,0,3098,3099,1,0,0,0,3099,289,1,0,0,0,3100,3102,5,144,0,0,3101,3103,
	7,27,0,0,3102,3101,1,0,0,0,3102,3103,1,0,0,0,3103,291,1,0,0,0,3104,3105,
	5,81,0,0,3105,3156,5,67,0,0,3106,3156,5,81,0,0,3107,3156,5,146,0,0,3108,
	3156,5,147,0,0,3109,3156,5,149,0,0,3110,3156,5,148,0,0,3111,3156,5,156,
	0,0,3112,3156,5,157,0,0,3113,3156,5,79,0,0,3114,3156,5,80,0,0,3115,3156,
	5,158,0,0,3116,3156,5,159,0,0,3117,3118,5,9,0,0,3118,3127,5,57,0,0,3119,
	3124,3,294,147,0,3120,3121,5,5,0,0,3121,3123,3,294,147,0,3122,3120,1,0,
	0,0,3123,3126,1,0,0,0,3124,3122,1,0,0,0,3124,3125,1,0,0,0,3125,3128,1,0,
	0,0,3126,3124,1,0,0,0,3127,3119,1,0,0,0,3127,3128,1,0,0,0,3128,3129,1,0,
	0,0,3129,3133,5,58,0,0,3130,3132,7,28,0,0,3131,3130,1,0,0,0,3132,3135,1,
	0,0,0,3133,3131,1,0,0,0,3133,3134,1,0,0,0,3134,3148,1,0,0,0,3135,3133,1,
	0,0,0,3136,3137,5,78,0,0,3137,3138,5,57,0,0,3138,3143,3,296,148,0,3139,
	3140,5,5,0,0,3140,3142,3,296,148,0,3141,3139,1,0,0,0,3142,3145,1,0,0,0,
	3143,3141,1,0,0,0,3143,3144,1,0,0,0,3144,3146,1,0,0,0,3145,3143,1,0,0,0,
	3146,3147,5,58,0,0,3147,3149,1,0,0,0,3148,3136,1,0,0,0,3148,3149,1,0,0,
	0,3149,3156,1,0,0,0,3150,3151,5,180,0,0,3151,3152,5,7,0,0,3152,3156,5,180,
	0,0,3153,3156,5,34,0,0,3154,3156,5,180,0,0,3155,3104,1,0,0,0,3155,3106,
	1,0,0,0,3155,3107,1,0,0,0,3155,3108,1,0,0,0,3155,3109,1,0,0,0,3155,3110,
	1,0,0,0,3155,3111,1,0,0,0,3155,3112,1,0,0,0,3155,3113,1,0,0,0,3155,3114,
	1,0,0,0,3155,3115,1,0,0,0,3155,3116,1,0,0,0,3155,3117,1,0,0,0,3155,3150,
	1,0,0,0,3155,3153,1,0,0,0,3155,3154,1,0,0,0,3156,293,1,0,0,0,3157,3161,
	3,292,146,0,3158,3161,3,92,46,0,3159,3161,3,90,45,0,3160,3157,1,0,0,0,3160,
	3158,1,0,0,0,3160,3159,1,0,0,0,3161,3163,1,0,0,0,3162,3164,3,284,142,0,
	3163,3162,1,0,0,0,3163,3164,1,0,0,0,3164,3166,1,0,0,0,3165,3167,3,16,8,
	0,3166,3165,1,0,0,0,3166,3167,1,0,0,0,3167,295,1,0,0,0,3168,3172,3,292,
	146,0,3169,3172,3,92,46,0,3170,3172,3,90,45,0,3171,3168,1,0,0,0,3171,3169,
	1,0,0,0,3171,3170,1,0,0,0,3172,3174,1,0,0,0,3173,3175,3,284,142,0,3174,
	3173,1,0,0,0,3174,3175,1,0,0,0,3175,297,1,0,0,0,3176,3177,7,29,0,0,3177,
	299,1,0,0,0,3178,3184,3,298,149,0,3179,3181,5,72,0,0,3180,3182,3,272,136,
	0,3181,3180,1,0,0,0,3181,3182,1,0,0,0,3182,3183,1,0,0,0,3183,3185,5,73,
	0,0,3184,3179,1,0,0,0,3185,3186,1,0,0,0,3186,3184,1,0,0,0,3186,3187,1,0,
	0,0,3187,301,1,0,0,0,369,305,310,312,327,329,349,353,360,365,393,399,403,
	412,419,421,425,431,443,446,456,460,468,471,475,480,484,508,513,525,529,
	538,542,551,553,556,570,573,586,588,603,618,622,631,638,642,659,661,667,
	672,680,683,700,702,709,716,718,722,734,738,740,744,750,753,756,766,770,
	772,779,783,785,793,800,813,817,824,844,850,856,862,869,879,886,892,896,
	902,910,918,925,932,939,944,952,959,966,973,978,980,984,990,995,997,1003,
	1010,1012,1018,1020,1026,1031,1034,1040,1047,1053,1059,1063,1068,1076,1081,
	1089,1094,1102,1107,1111,1117,1124,1128,1133,1138,1144,1148,1150,1157,1162,
	1166,1176,1178,1182,1188,1195,1199,1214,1223,1227,1233,1242,1246,1254,1258,
	1264,1268,1274,1278,1280,1288,1292,1294,1302,1306,1312,1316,1322,1326,1328,
	1334,1339,1345,1381,1386,1391,1400,1405,1410,1415,1420,1427,1432,1449,1451,
	1464,1472,1482,1505,1521,1523,1531,1553,1555,1560,1572,1579,1599,1611,1615,
	1620,1632,1641,1645,1647,1656,1661,1667,1678,1680,1688,1697,1699,1707,1713,
	1717,1727,1739,1749,1760,1772,1786,1795,1805,1809,1813,1822,1831,1843,1845,
	1849,1855,1864,1876,1878,1882,1910,1922,1932,1937,1949,1959,1967,1977,1980,
	1989,1999,2011,2019,2064,2073,2079,2094,2104,2109,2114,2117,2134,2144,2149,
	2152,2174,2182,2186,2194,2212,2220,2225,2232,2247,2250,2253,2276,2279,2288,
	2291,2298,2307,2310,2322,2324,2334,2347,2351,2361,2369,2375,2381,2390,2394,
	2396,2402,2410,2414,2416,2419,2433,2439,2448,2452,2454,2464,2479,2489,2497,
	2501,2503,2529,2533,2535,2561,2565,2567,2571,2583,2587,2589,2596,2604,2608,
	2622,2626,2628,2639,2644,2647,2675,2683,2691,2699,2710,2717,2722,2761,2810,
	2814,2816,2838,2847,2885,2889,2923,2934,2943,2947,2949,2957,2963,2968,2974,
	2981,3005,3011,3013,3015,3030,3040,3062,3075,3082,3089,3094,3098,3102,3124,
	3127,3133,3143,3148,3155,3160,3163,3166,3171,3174,3181,3186];

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
	public experimentalStdImport_list(): ExperimentalStdImportContext[] {
		return this.getTypedRuleContexts(ExperimentalStdImportContext) as ExperimentalStdImportContext[];
	}
	public experimentalStdImport(i: number): ExperimentalStdImportContext {
		return this.getTypedRuleContext(ExperimentalStdImportContext, i) as ExperimentalStdImportContext;
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


export class ExperimentalStdImportContext extends ParserRuleContext {
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
	return SolidCashParser.RULE_experimentalStdImport;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitExperimentalStdImport) {
			return visitor.visitExperimentalStdImport(this);
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
	public functionName(): FunctionNameContext {
		return this.getTypedRuleContext(FunctionNameContext, 0) as FunctionNameContext;
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
	public BoundedBytes(): TerminalNode {
		return this.getToken(SolidCashParser.BoundedBytes, 0);
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


export class FunctionNameContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
	this.parser = parser;
	}
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
	}
    public get ruleIndex(): number {
	return SolidCashParser.RULE_functionName;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitFunctionName) {
			return visitor.visitFunctionName(this);
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
	public versionAlternative_list(): VersionAlternativeContext[] {
		return this.getTypedRuleContexts(VersionAlternativeContext) as VersionAlternativeContext[];
	}
	public versionAlternative(i: number): VersionAlternativeContext {
		return this.getTypedRuleContext(VersionAlternativeContext, i) as VersionAlternativeContext;
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


export class VersionAlternativeContext extends ParserRuleContext {
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
	return SolidCashParser.RULE_versionAlternative;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitVersionAlternative) {
			return visitor.visitVersionAlternative(this);
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
	public NumberLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.NumberLiteral, 0);
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
	public interfaceFallbackDefinition_list(): InterfaceFallbackDefinitionContext[] {
		return this.getTypedRuleContexts(InterfaceFallbackDefinitionContext) as InterfaceFallbackDefinitionContext[];
	}
	public interfaceFallbackDefinition(i: number): InterfaceFallbackDefinitionContext {
		return this.getTypedRuleContext(InterfaceFallbackDefinitionContext, i) as InterfaceFallbackDefinitionContext;
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
	public functionName(): FunctionNameContext {
		return this.getTypedRuleContext(FunctionNameContext, 0) as FunctionNameContext;
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


export class InterfaceFallbackDefinitionContext extends ParserRuleContext {
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
	public returnType(): ReturnTypeContext {
		return this.getTypedRuleContext(ReturnTypeContext, 0) as ReturnTypeContext;
	}
    public get ruleIndex(): number {
	return SolidCashParser.RULE_interfaceFallbackDefinition;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitInterfaceFallbackDefinition) {
			return visitor.visitInterfaceFallbackDefinition(this);
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
	public modifierDefinition_list(): ModifierDefinitionContext[] {
		return this.getTypedRuleContexts(ModifierDefinitionContext) as ModifierDefinitionContext[];
	}
	public modifierDefinition(i: number): ModifierDefinitionContext {
		return this.getTypedRuleContext(ModifierDefinitionContext, i) as ModifierDefinitionContext;
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
	public functionName(): FunctionNameContext {
		return this.getTypedRuleContext(FunctionNameContext, 0) as FunctionNameContext;
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
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
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
	public anyIdentifier_list(): AnyIdentifierContext[] {
		return this.getTypedRuleContexts(AnyIdentifierContext) as AnyIdentifierContext[];
	}
	public anyIdentifier(i: number): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, i) as AnyIdentifierContext;
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
	public mappingType(): MappingTypeContext {
		return this.getTypedRuleContext(MappingTypeContext, 0) as MappingTypeContext;
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
	public functionName(): FunctionNameContext {
		return this.getTypedRuleContext(FunctionNameContext, 0) as FunctionNameContext;
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
	public Identifier_list(): TerminalNode[] {
		return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
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
	public bareTypeExpressionStatement(): BareTypeExpressionStatementContext {
		return this.getTypedRuleContext(BareTypeExpressionStatementContext, 0) as BareTypeExpressionStatementContext;
	}
	public primitiveTypeReferenceStatement(): PrimitiveTypeReferenceStatementContext {
		return this.getTypedRuleContext(PrimitiveTypeReferenceStatementContext, 0) as PrimitiveTypeReferenceStatementContext;
	}
	public userDefinedArrayTypeReferenceStatement(): UserDefinedArrayTypeReferenceStatementContext {
		return this.getTypedRuleContext(UserDefinedArrayTypeReferenceStatementContext, 0) as UserDefinedArrayTypeReferenceStatementContext;
	}
	public variableDefinition(): VariableDefinitionContext {
		return this.getTypedRuleContext(VariableDefinitionContext, 0) as VariableDefinitionContext;
	}
	public nestedTupleAssignment(): NestedTupleAssignmentContext {
		return this.getTypedRuleContext(NestedTupleAssignmentContext, 0) as NestedTupleAssignmentContext;
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
	public bareAbiFunctionReferenceStatement(): BareAbiFunctionReferenceStatementContext {
		return this.getTypedRuleContext(BareAbiFunctionReferenceStatementContext, 0) as BareAbiFunctionReferenceStatementContext;
	}
	public bareCallOptionsStatement(): BareCallOptionsStatementContext {
		return this.getTypedRuleContext(BareCallOptionsStatementContext, 0) as BareCallOptionsStatementContext;
	}
	public bareNewWithOptionsStatement(): BareNewWithOptionsStatementContext {
		return this.getTypedRuleContext(BareNewWithOptionsStatementContext, 0) as BareNewWithOptionsStatementContext;
	}
	public parenthesizedArrayPopStatement(): ParenthesizedArrayPopStatementContext {
		return this.getTypedRuleContext(ParenthesizedArrayPopStatementContext, 0) as ParenthesizedArrayPopStatementContext;
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


export class PrimitiveTypeReferenceStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
	this.parser = parser;
	}
	public elementaryTypeToken(): ElementaryTypeTokenContext {
		return this.getTypedRuleContext(ElementaryTypeTokenContext, 0) as ElementaryTypeTokenContext;
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
    public get ruleIndex(): number {
	return SolidCashParser.RULE_primitiveTypeReferenceStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitPrimitiveTypeReferenceStatement) {
			return visitor.visitPrimitiveTypeReferenceStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class UserDefinedArrayTypeReferenceStatementContext extends ParserRuleContext {
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
	return SolidCashParser.RULE_userDefinedArrayTypeReferenceStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitUserDefinedArrayTypeReferenceStatement) {
			return visitor.visitUserDefinedArrayTypeReferenceStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ElementaryTypeTokenContext extends ParserRuleContext {
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
    public get ruleIndex(): number {
	return SolidCashParser.RULE_elementaryTypeToken;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitElementaryTypeToken) {
			return visitor.visitElementaryTypeToken(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class BareTypeExpressionStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
	this.parser = parser;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
    public get ruleIndex(): number {
	return SolidCashParser.RULE_bareTypeExpressionStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitBareTypeExpressionStatement) {
			return visitor.visitBareTypeExpressionStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class BareCallOptionsStatementContext extends ParserRuleContext {
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
	public callOptions(): CallOptionsContext {
		return this.getTypedRuleContext(CallOptionsContext, 0) as CallOptionsContext;
	}
	public callOptionsFunctionMember(): CallOptionsFunctionMemberContext {
		return this.getTypedRuleContext(CallOptionsFunctionMemberContext, 0) as CallOptionsFunctionMemberContext;
	}
    public get ruleIndex(): number {
	return SolidCashParser.RULE_bareCallOptionsStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitBareCallOptionsStatement) {
			return visitor.visitBareCallOptionsStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class CallOptionsFunctionMemberContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
    public get ruleIndex(): number {
	return SolidCashParser.RULE_callOptionsFunctionMember;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitCallOptionsFunctionMember) {
			return visitor.visitCallOptionsFunctionMember(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class BareNewWithOptionsStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public callOptions(): CallOptionsContext {
		return this.getTypedRuleContext(CallOptionsContext, 0) as CallOptionsContext;
	}
    public get ruleIndex(): number {
	return SolidCashParser.RULE_bareNewWithOptionsStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitBareNewWithOptionsStatement) {
			return visitor.visitBareNewWithOptionsStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ParenthesizedArrayPopStatementContext extends ParserRuleContext {
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
	return SolidCashParser.RULE_parenthesizedArrayPopStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitParenthesizedArrayPopStatement) {
			return visitor.visitParenthesizedArrayPopStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExpressionStatementContext extends ParserRuleContext {
	public _op!: Token;
	public _second!: Token;
	public _third!: Token;
	public _rhsPush!: Token;
	public _rhsPush2!: Token;
	public _pushField!: AnyIdentifierContext;
	public _pushAssignOp!: Token;
	public _bareMember!: Token;
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
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
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


export class NestedTupleAssignmentContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
	this.parser = parser;
	}
	public nestedTuplePattern(): NestedTuplePatternContext {
		return this.getTypedRuleContext(NestedTuplePatternContext, 0) as NestedTuplePatternContext;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
	return SolidCashParser.RULE_nestedTupleAssignment;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitNestedTupleAssignment) {
			return visitor.visitNestedTupleAssignment(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class NestedTuplePatternContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
	this.parser = parser;
	}
	public nestedTuplePatternItem_list(): NestedTuplePatternItemContext[] {
		return this.getTypedRuleContexts(NestedTuplePatternItemContext) as NestedTuplePatternItemContext[];
	}
	public nestedTuplePatternItem(i: number): NestedTuplePatternItemContext {
		return this.getTypedRuleContext(NestedTuplePatternItemContext, i) as NestedTuplePatternItemContext;
	}
    public get ruleIndex(): number {
	return SolidCashParser.RULE_nestedTuplePattern;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitNestedTuplePattern) {
			return visitor.visitNestedTuplePattern(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class NestedTuplePatternItemContext extends ParserRuleContext {
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
	public nestedTuplePattern(): NestedTuplePatternContext {
		return this.getTypedRuleContext(NestedTuplePatternContext, 0) as NestedTuplePatternContext;
	}
    public get ruleIndex(): number {
	return SolidCashParser.RULE_nestedTuplePatternItem;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitNestedTuplePatternItem) {
			return visitor.visitNestedTuplePatternItem(this);
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
export class DeleteDeepMemberEntryContext extends DeleteStatementContext {
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
		if (visitor.visitDeleteDeepMemberEntry) {
			return visitor.visitDeleteDeepMemberEntry(this);
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
export class DeleteParenthesizedContext extends DeleteStatementContext {
	constructor(parser: SolidCashParser, ctx: DeleteStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitDeleteParenthesized) {
			return visitor.visitDeleteParenthesized(this);
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
	public callOptions(): CallOptionsContext {
		return this.getTypedRuleContext(CallOptionsContext, 0) as CallOptionsContext;
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
	public typeListItem(): TypeListItemContext {
		return this.getTypedRuleContext(TypeListItemContext, 0) as TypeListItemContext;
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
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
	public arrayCastType(): ArrayCastTypeContext {
		return this.getTypedRuleContext(ArrayCastTypeContext, 0) as ArrayCastTypeContext;
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
export class ChainedMethodCallContext extends ExpressionContext {
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
	public expressionList_list(): ExpressionListContext[] {
		return this.getTypedRuleContexts(ExpressionListContext) as ExpressionListContext[];
	}
	public expressionList(i: number): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, i) as ExpressionListContext;
	}
	public callOptions(): CallOptionsContext {
		return this.getTypedRuleContext(CallOptionsContext, 0) as CallOptionsContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitChainedMethodCall) {
			return visitor.visitChainedMethodCall(this);
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
	public typeIntrospectionBase(): TypeIntrospectionBaseContext {
		return this.getTypedRuleContext(TypeIntrospectionBaseContext, 0) as TypeIntrospectionBaseContext;
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
export class ChainedFunctionCallContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public functionCall(): FunctionCallContext {
		return this.getTypedRuleContext(FunctionCallContext, 0) as FunctionCallContext;
	}
	public expressionList_list(): ExpressionListContext[] {
		return this.getTypedRuleContexts(ExpressionListContext) as ExpressionListContext[];
	}
	public expressionList(i: number): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, i) as ExpressionListContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitChainedFunctionCall) {
			return visitor.visitChainedFunctionCall(this);
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
	public DotLength(): TerminalNode {
		return this.getToken(SolidCashParser.DotLength, 0);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
	public callOptions(): CallOptionsContext {
		return this.getTypedRuleContext(CallOptionsContext, 0) as CallOptionsContext;
	}
	public DotValue(): TerminalNode {
		return this.getToken(SolidCashParser.DotValue, 0);
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
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
export class BareAbiReferenceExpressionContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitBareAbiReferenceExpression) {
			return visitor.visitBareAbiReferenceExpression(this);
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
	public abiEncodeCallArguments(): AbiEncodeCallArgumentsContext {
		return this.getTypedRuleContext(AbiEncodeCallArgumentsContext, 0) as AbiEncodeCallArgumentsContext;
	}
	public Identifier_list(): TerminalNode[] {
		return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
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
export class CallOptionsMemberContext extends ExpressionContext {
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
	public memberName(): MemberNameContext {
		return this.getTypedRuleContext(MemberNameContext, 0) as MemberNameContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitCallOptionsMember) {
			return visitor.visitCallOptionsMember(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TypeIntrospectionBaseContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
	this.parser = parser;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
    public get ruleIndex(): number {
	return SolidCashParser.RULE_typeIntrospectionBase;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitTypeIntrospectionBase) {
			return visitor.visitTypeIntrospectionBase(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class AbiEncodeCallArgumentsContext extends ParserRuleContext {
	public _target!: Token;
	public _aop!: Token;
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
    public get ruleIndex(): number {
	return SolidCashParser.RULE_abiEncodeCallArguments;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitAbiEncodeCallArguments) {
			return visitor.visitAbiEncodeCallArguments(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class BareAbiFunctionReferenceStatementContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
	this.parser = parser;
	}
    public get ruleIndex(): number {
	return SolidCashParser.RULE_bareAbiFunctionReferenceStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitBareAbiFunctionReferenceStatement) {
			return visitor.visitBareAbiFunctionReferenceStatement(this);
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
	public UnicodeLiteral_list(): TerminalNode[] {
		return this.getTokens(SolidCashParser.UnicodeLiteral);
	}
	public UnicodeLiteral(i: number): TerminalNode {
		return this.getToken(SolidCashParser.UnicodeLiteral, i);
	}
	public HexStringLiteral_list(): TerminalNode[] {
		return this.getTokens(SolidCashParser.HexStringLiteral);
	}
	public HexStringLiteral(i: number): TerminalNode {
		return this.getToken(SolidCashParser.HexStringLiteral, i);
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
	public functionTypeParameter_list(): FunctionTypeParameterContext[] {
		return this.getTypedRuleContexts(FunctionTypeParameterContext) as FunctionTypeParameterContext[];
	}
	public functionTypeParameter(i: number): FunctionTypeParameterContext {
		return this.getTypedRuleContext(FunctionTypeParameterContext, i) as FunctionTypeParameterContext;
	}
	public functionTypeReturnParameter_list(): FunctionTypeReturnParameterContext[] {
		return this.getTypedRuleContexts(FunctionTypeReturnParameterContext) as FunctionTypeReturnParameterContext[];
	}
	public functionTypeReturnParameter(i: number): FunctionTypeReturnParameterContext {
		return this.getTypedRuleContext(FunctionTypeReturnParameterContext, i) as FunctionTypeReturnParameterContext;
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


export class FunctionTypeParameterContext extends ParserRuleContext {
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
	public mappingType(): MappingTypeContext {
		return this.getTypedRuleContext(MappingTypeContext, 0) as MappingTypeContext;
	}
	public dataLocation(): DataLocationContext {
		return this.getTypedRuleContext(DataLocationContext, 0) as DataLocationContext;
	}
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
	}
    public get ruleIndex(): number {
	return SolidCashParser.RULE_functionTypeParameter;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitFunctionTypeParameter) {
			return visitor.visitFunctionTypeParameter(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FunctionTypeReturnParameterContext extends ParserRuleContext {
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
	public mappingType(): MappingTypeContext {
		return this.getTypedRuleContext(MappingTypeContext, 0) as MappingTypeContext;
	}
	public dataLocation(): DataLocationContext {
		return this.getTypedRuleContext(DataLocationContext, 0) as DataLocationContext;
	}
    public get ruleIndex(): number {
	return SolidCashParser.RULE_functionTypeReturnParameter;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitFunctionTypeReturnParameter) {
			return visitor.visitFunctionTypeReturnParameter(this);
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


export class ArrayCastTypeContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
	this.parser = parser;
	}
	public typeCast(): TypeCastContext {
		return this.getTypedRuleContext(TypeCastContext, 0) as TypeCastContext;
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
    public get ruleIndex(): number {
	return SolidCashParser.RULE_arrayCastType;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitArrayCastType) {
			return visitor.visitArrayCastType(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
