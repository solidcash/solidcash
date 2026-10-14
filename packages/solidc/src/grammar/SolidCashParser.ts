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
	public static readonly T__139 = 140;
	public static readonly VersionLiteral = 141;
	public static readonly BooleanLiteral = 142;
	public static readonly NumberUnit = 143;
	public static readonly BchUnit = 144;
	public static readonly DecimalLiteral = 145;
	public static readonly NumberLiteral = 146;
	public static readonly PrimitiveType = 147;
	public static readonly CryptoType = 148;
	public static readonly UnboundedBytes = 149;
	public static readonly BoundedBytes = 150;
	public static readonly Bound = 151;
	public static readonly StringLiteral = 152;
	public static readonly DateLiteral = 153;
	public static readonly HexLiteral = 154;
	public static readonly TxVar = 155;
	public static readonly UnsafeCast = 156;
	public static readonly BoundedSignedInt = 157;
	public static readonly BoundedUnsignedInt = 158;
	public static readonly BoundedSignedFixed = 159;
	public static readonly BoundedUnsignedFixed = 160;
	public static readonly NullaryOp = 161;
	public static readonly UnicodeLiteral = 162;
	public static readonly HexStringLiteral = 163;
	public static readonly DotValue = 164;
	public static readonly DotLength = 165;
	public static readonly DotPush = 166;
	public static readonly DotPop = 167;
	public static readonly DotSplit = 168;
	public static readonly DotSlice = 169;
	public static readonly DotDelete = 170;
	public static readonly DotCode = 171;
	public static readonly DotCodehash = 172;
	public static readonly DotLockingBytecode = 173;
	public static readonly DotTokenCategory = 174;
	public static readonly DotNftCommitment = 175;
	public static readonly DotTokenAmount = 176;
	public static readonly DotOutpointTransactionHash = 177;
	public static readonly DotOutpointIndex = 178;
	public static readonly DotUnlockingBytecode = 179;
	public static readonly DotSequenceNumber = 180;
	public static readonly Identifier = 181;
	public static readonly WHITESPACE = 182;
	public static readonly COMMENT = 183;
	public static readonly LINE_COMMENT = 184;
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
	public static readonly RULE_functionArrayType = 77;
	public static readonly RULE_tupleAssignment = 78;
	public static readonly RULE_nestedTupleAssignment = 79;
	public static readonly RULE_nestedTuplePattern = 80;
	public static readonly RULE_nestedTuplePatternItem = 81;
	public static readonly RULE_tupleSlot = 82;
	public static readonly RULE_pushArgument = 83;
	public static readonly RULE_deleteStatement = 84;
	public static readonly RULE_timeOpStatement = 85;
	public static readonly RULE_requireStatement = 86;
	public static readonly RULE_ifStatement = 87;
	public static readonly RULE_loopStatement = 88;
	public static readonly RULE_forOfEntriesStatement = 89;
	public static readonly RULE_forInStatement = 90;
	public static readonly RULE_forOfStatement = 91;
	public static readonly RULE_forWindowStatement = 92;
	public static readonly RULE_forStatement = 93;
	public static readonly RULE_forInit = 94;
	public static readonly RULE_forCondition = 95;
	public static readonly RULE_forUpdate = 96;
	public static readonly RULE_doWhileStatement = 97;
	public static readonly RULE_whileStatement = 98;
	public static readonly RULE_consoleStatement = 99;
	public static readonly RULE_assemblyStatement = 100;
	public static readonly RULE_yulBlock = 101;
	public static readonly RULE_yulStatement = 102;
	public static readonly RULE_yulVariableDeclaration = 103;
	public static readonly RULE_yulAssignment = 104;
	public static readonly RULE_yulIf = 105;
	public static readonly RULE_yulSwitch = 106;
	public static readonly RULE_yulCase = 107;
	public static readonly RULE_yulDefault = 108;
	public static readonly RULE_yulForLoop = 109;
	public static readonly RULE_yulFunctionDefinition = 110;
	public static readonly RULE_yulExpression = 111;
	public static readonly RULE_yulFunctionCall = 112;
	public static readonly RULE_yulFunctionName = 113;
	public static readonly RULE_yulIdentifier = 114;
	public static readonly RULE_yulPath = 115;
	public static readonly RULE_yulLiteral = 116;
	public static readonly RULE_uncheckedStatement = 117;
	public static readonly RULE_switchStatement = 118;
	public static readonly RULE_switchCase = 119;
	public static readonly RULE_switchDefault = 120;
	public static readonly RULE_tryCatchStatement = 121;
	public static readonly RULE_tryReturns = 122;
	public static readonly RULE_catchClause = 123;
	public static readonly RULE_breakStatement = 124;
	public static readonly RULE_continueStatement = 125;
	public static readonly RULE_requireMessage = 126;
	public static readonly RULE_revertStatement = 127;
	public static readonly RULE_assertStatement = 128;
	public static readonly RULE_consoleParameter = 129;
	public static readonly RULE_consoleParameterList = 130;
	public static readonly RULE_functionCall = 131;
	public static readonly RULE_namedArg = 132;
	public static readonly RULE_expressionList = 133;
	public static readonly RULE_callArgument = 134;
	public static readonly RULE_callOptions = 135;
	public static readonly RULE_callOption = 136;
	public static readonly RULE_typeList = 137;
	public static readonly RULE_typeListItem = 138;
	public static readonly RULE_parenExpression = 139;
	public static readonly RULE_newExpression = 140;
	public static readonly RULE_expression = 141;
	public static readonly RULE_typeIntrospectionBase = 142;
	public static readonly RULE_abiEncodeCallArguments = 143;
	public static readonly RULE_bareAbiFunctionReferenceStatement = 144;
	public static readonly RULE_memberName = 145;
	public static readonly RULE_modifier = 146;
	public static readonly RULE_dataLocation = 147;
	public static readonly RULE_literal = 148;
	public static readonly RULE_numberLiteral = 149;
	public static readonly RULE_decimalLiteral = 150;
	public static readonly RULE_typeName = 151;
	public static readonly RULE_functionType = 152;
	public static readonly RULE_functionTypeParameter = 153;
	public static readonly RULE_functionTypeReturnParameter = 154;
	public static readonly RULE_typeCast = 155;
	public static readonly RULE_arrayCastType = 156;
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
                                                            "'+='", "'-='", 
                                                            "'*='", "'/='", 
                                                            "'%='", "'&='", 
                                                            "'|='", "'^='", 
                                                            "'<<='", "'>>='", 
                                                            "'private'", 
                                                            "'mapping'", 
                                                            "'=>'", "'['", 
                                                            "']'", "'modifier'", 
                                                            "'pure'", "'view'", 
                                                            "'override'", 
                                                            "'returns'", 
                                                            "'fixed'", "'ufixed'", 
                                                            "'address'", 
                                                            "'new'", "'++'", 
                                                            "'--'", "'return'", 
                                                            "'emit'", "'delete'", 
                                                            "'if'", "'else'", 
                                                            "'of'", "'in'", 
                                                            "'window'", 
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
                                                             null, "VersionLiteral", 
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
		"selfdestructStatement", "emitStatement", "variableDefinition", "functionArrayType", 
		"tupleAssignment", "nestedTupleAssignment", "nestedTuplePattern", "nestedTuplePatternItem", 
		"tupleSlot", "pushArgument", "deleteStatement", "timeOpStatement", "requireStatement", 
		"ifStatement", "loopStatement", "forOfEntriesStatement", "forInStatement", 
		"forOfStatement", "forWindowStatement", "forStatement", "forInit", "forCondition", 
		"forUpdate", "doWhileStatement", "whileStatement", "consoleStatement", 
		"assemblyStatement", "yulBlock", "yulStatement", "yulVariableDeclaration", 
		"yulAssignment", "yulIf", "yulSwitch", "yulCase", "yulDefault", "yulForLoop", 
		"yulFunctionDefinition", "yulExpression", "yulFunctionCall", "yulFunctionName", 
		"yulIdentifier", "yulPath", "yulLiteral", "uncheckedStatement", "switchStatement", 
		"switchCase", "switchDefault", "tryCatchStatement", "tryReturns", "catchClause", 
		"breakStatement", "continueStatement", "requireMessage", "revertStatement", 
		"assertStatement", "consoleParameter", "consoleParameterList", "functionCall", 
		"namedArg", "expressionList", "callArgument", "callOptions", "callOption", 
		"typeList", "typeListItem", "parenExpression", "newExpression", "expression", 
		"typeIntrospectionBase", "abiEncodeCallArguments", "bareAbiFunctionReferenceStatement", 
		"memberName", "modifier", "dataLocation", "literal", "numberLiteral", 
		"decimalLiteral", "typeName", "functionType", "functionTypeParameter", 
		"functionTypeReturnParameter", "typeCast", "arrayCastType",
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
	  if (!text) return false;
	  const c = text.charCodeAt(0);
	  // u/i/b/f — every malformed bounded-type spelling starts with one of these.
	  if (c !== 117 && c !== 105 && c !== 98 && c !== 102) return false;
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

	// Tokens reserved by the Solidity grammar remain ordinary identifiers inside Yul. Consume them through a
	// predicate + wildcard rather than spelling them as literals in yulIdentifier: new literal alternatives would
	// make previously non-reserved words into lexer tokens throughout the whole Solidity grammar.
	static YUL_SOLIDITY_KEYWORDS = new Set([
	  'abstract', 'anonymous', 'as', 'assembly', 'catch', 'constant', 'constructor', 'contract', 'delete', 'do',
	  'else', 'enum', 'emit', 'event', 'external', 'fallback', 'indexed', 'interface', 'internal', 'immutable',
	  'import', 'is', 'library', 'mapping', 'memory', 'modifier', 'new', 'override', 'payable', 'public', 'pragma',
	  'private', 'pure', 'receive', 'returns', 'storage', 'calldata', 'struct', 'throw', 'try', 'unicode', 'using',
	  'view', 'virtual', 'while', 'wei', 'gwei', 'ether', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'years',
	  'int', 'uint', 'bytes', 'string', 'address', 'bool', 'fixed', 'ufixed', 'after', 'alias', 'apply', 'auto', 'copyof',
	  'define', 'final', 'implements', 'in', 'inline', 'macro', 'match', 'mutable', 'null', 'of', 'partial',
	  'promise', 'reference', 'relocatable', 'sealed', 'sizeof', 'static', 'supports', 'typedef', 'typeof',
	  'unchecked', 'var',
	]);
	isYulSolidityKeyword(text: string): boolean {
	  return SolidCashParser.YUL_SOLIDITY_KEYWORDS.has(text);
	}

	// True when the tuple-assignment LHS contains a nested tuple item, including forms whose first item is plain:
	// `(a, (b, c))`. The older two-token check recognized only `((a, b), c)`. Restrict the scan to an opening
	// parenthesis immediately after the outer `(` or a depth-one comma, so parentheses inside an index/call do not
	// redirect an ordinary complex-lvalue tuple assignment to the nested-pattern rule.
	hasNestedTuplePatternAhead(): boolean {
	  const input = this._input;
	  const lparen = SolidCashParser.T__56;
	  const rparen = SolidCashParser.T__57;
	  const comma = SolidCashParser.T__4;
	  const assign = SolidCashParser.T__47;
	  let depth = 0;
	  let itemStart = false;
	  for (let i = 1; i < 4096; i++) {
	    const token = input.LA(i);
	    if (token === -1 || token === assign) return false;
	    if (token === lparen) {
	      if (depth === 1 && itemStart) return true;
	      depth++;
	      itemStart = depth === 1;
	      continue;
	    }
	    if (token === rparen) {
	      depth--;
	      itemStart = false;
	      continue;
	    }
	    if (token === comma && depth === 1) {
	      itemStart = true;
	      continue;
	    }
	    if (depth === 1) itemStart = false;
	  }
	  return false;
	}

	// The expression grammar's `functionCall` alternative precedes the bare-identifier alternative. Full-context
	// prediction can distinguish them, but SLL otherwise commits a plain `x`, `x[k]`, or `x.member` expression to a
	// call and only discovers the missing `(` later. The complete call prefix is bounded to four tokens, so expose
	// that distinction directly and keep the fast prediction path equivalent to LL.
	hasFunctionCallAhead(): boolean {
	  const input = this._input;
	  const lparen = SolidCashParser.T__56;
	  const rparen = SolidCashParser.T__57;
	  const dot = SolidCashParser.T__6;
	  const lbrace = SolidCashParser.T__3;
	  const first = input.LA(1);
	  const second = input.LA(2);
	  if (first === lparen) {
	    if (input.LA(3) === rparen) return input.LA(4) === lparen;
	    return input.LA(3) === dot && input.LA(5) === rparen && input.LA(6) === lparen;
	  }
	  // `x.y(` is the namespaced call only when `y` is an Identifier. A soft keyword there (`bar.leave(..)` on
	  // SushiBar, `token.delegate(..)`) is a member call, which the MethodCall alternative parses as anyIdentifier;
	  // predicting this rule for it failed on the keyword token.
	  return second === lparen || second === lbrace
	    || (second === dot && input.LA(3) === SolidCashParser.Identifier
	      && input.LA(4) === lparen && input.LA(5) !== lbrace);
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
			this.state = 317;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 0, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 314;
					this.pragmaDirective();
					}
					}
				}
				this.state = 319;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 0, this._ctx);
			}
			this.state = 324;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===1) {
				{
				this.state = 322;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 1, this._ctx) ) {
				case 1:
					{
					this.state = 320;
					this.importDirective();
					}
					break;
				case 2:
					{
					this.state = 321;
					this.experimentalStdImport();
					}
					break;
				}
				}
				this.state = 326;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 341;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===9 || _la===10 || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 947422209) !== 0) || ((((_la - 89)) & ~0x1F) === 0 && ((1 << (_la - 89)) & 7) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 15375) !== 0) || _la===181) {
				{
				this.state = 339;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 3, this._ctx) ) {
				case 1:
					{
					this.state = 327;
					this.pragmaDirective();
					}
					break;
				case 2:
					{
					this.state = 328;
					this.constantDefinition();
					}
					break;
				case 3:
					{
					this.state = 329;
					this.enumDefinition();
					}
					break;
				case 4:
					{
					this.state = 330;
					this.structDefinition();
					}
					break;
				case 5:
					{
					this.state = 331;
					this.typeDefinition();
					}
					break;
				case 6:
					{
					this.state = 332;
					this.usingForDirective();
					}
					break;
				case 7:
					{
					this.state = 333;
					this.errorDefinition();
					}
					break;
				case 8:
					{
					this.state = 334;
					this.eventDefinition();
					}
					break;
				case 9:
					{
					this.state = 335;
					this.interfaceDefinition();
					}
					break;
				case 10:
					{
					this.state = 336;
					this.freeFunctionDefinition();
					}
					break;
				case 11:
					{
					this.state = 337;
					this.libraryDefinition();
					}
					break;
				case 12:
					{
					this.state = 338;
					this.contractDefinition();
					}
					break;
				}
				}
				this.state = 343;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 344;
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
			this.state = 372;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 7, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 346;
				this.match(SolidCashParser.T__0);
				this.state = 347;
				this.match(SolidCashParser.StringLiteral);
				this.state = 348;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 349;
				this.match(SolidCashParser.T__0);
				this.state = 350;
				this.match(SolidCashParser.StringLiteral);
				this.state = 351;
				this.match(SolidCashParser.T__2);
				this.state = 352;
				this.match(SolidCashParser.Identifier);
				this.state = 353;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 354;
				this.match(SolidCashParser.T__0);
				this.state = 355;
				this.match(SolidCashParser.T__3);
				this.state = 356;
				this.importBinding();
				this.state = 361;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 5, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 357;
						this.match(SolidCashParser.T__4);
						this.state = 358;
						this.importBinding();
						}
						}
					}
					this.state = 363;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 5, this._ctx);
				}
				this.state = 365;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 364;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 367;
				this.match(SolidCashParser.T__5);
				this.state = 368;
				this.match(SolidCashParser.Identifier);
				this.state = 369;
				this.match(SolidCashParser.StringLiteral);
				this.state = 370;
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
			this.state = 374;
			this.match(SolidCashParser.Identifier);
			this.state = 377;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 375;
				this.match(SolidCashParser.T__2);
				this.state = 376;
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
			this.state = 424;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 12, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 379;
				this.match(SolidCashParser.T__0);
				this.state = 380;
				this.match(SolidCashParser.Identifier);
				this.state = 381;
				this.match(SolidCashParser.T__6);
				this.state = 382;
				this.match(SolidCashParser.Identifier);
				this.state = 383;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 384;
				this.match(SolidCashParser.T__0);
				this.state = 385;
				this.match(SolidCashParser.Identifier);
				this.state = 386;
				this.match(SolidCashParser.T__6);
				this.state = 387;
				this.match(SolidCashParser.Identifier);
				this.state = 388;
				this.match(SolidCashParser.T__2);
				this.state = 389;
				this.match(SolidCashParser.Identifier);
				this.state = 390;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 391;
				this.match(SolidCashParser.T__0);
				this.state = 392;
				this.match(SolidCashParser.T__7);
				this.state = 393;
				this.match(SolidCashParser.T__2);
				this.state = 394;
				this.match(SolidCashParser.Identifier);
				this.state = 395;
				this.match(SolidCashParser.Identifier);
				this.state = 396;
				this.match(SolidCashParser.Identifier);
				this.state = 397;
				this.match(SolidCashParser.T__6);
				this.state = 398;
				this.match(SolidCashParser.Identifier);
				this.state = 399;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 400;
				this.match(SolidCashParser.T__0);
				this.state = 401;
				this.match(SolidCashParser.T__3);
				this.state = 402;
				this.match(SolidCashParser.Identifier);
				this.state = 405;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===3) {
					{
					this.state = 403;
					this.match(SolidCashParser.T__2);
					this.state = 404;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 415;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 407;
					this.match(SolidCashParser.T__4);
					this.state = 408;
					this.match(SolidCashParser.Identifier);
					this.state = 411;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===3) {
						{
						this.state = 409;
						this.match(SolidCashParser.T__2);
						this.state = 410;
						this.match(SolidCashParser.Identifier);
						}
					}

					}
					}
					this.state = 417;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 418;
				this.match(SolidCashParser.T__5);
				this.state = 419;
				this.match(SolidCashParser.Identifier);
				this.state = 420;
				this.match(SolidCashParser.Identifier);
				this.state = 421;
				this.match(SolidCashParser.T__6);
				this.state = 422;
				this.match(SolidCashParser.Identifier);
				this.state = 423;
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
			this.state = 426;
			this.match(SolidCashParser.T__8);
			this.state = 427;
			this.functionName();
			this.state = 428;
			this.parameterList();
			this.state = 433;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 25165839) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3678215) !== 0) || _la===181) {
				{
				this.state = 431;
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
				case 79:
				case 85:
				case 86:
				case 87:
					{
					this.state = 429;
					this.functionModifier();
					}
					break;
				case 181:
					{
					this.state = 430;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 435;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 437;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===88) {
				{
				this.state = 436;
				this.returnType();
				}
			}

			this.state = 439;
			this.match(SolidCashParser.T__3);
			this.state = 443;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 16, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 440;
					this.statement();
					}
					}
				}
				this.state = 445;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 16, this._ctx);
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
	public usingForDirective(): UsingForDirectiveContext {
		let localctx: UsingForDirectiveContext = new UsingForDirectiveContext(this, this._ctx, this.state);
		this.enterRule(localctx, 10, SolidCashParser.RULE_usingForDirective);
		let _la: number;
		try {
			let _alt: number;
			this.state = 487;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 23, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 448;
				this.match(SolidCashParser.T__9);
				this.state = 449;
				this.match(SolidCashParser.Identifier);
				this.state = 450;
				this.match(SolidCashParser.T__10);
				this.state = 455;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 17, this._ctx) ) {
				case 1:
					{
					this.state = 451;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 452;
					this.mappingType();
					}
					break;
				case 3:
					{
					this.state = 453;
					this.typeName();
					}
					break;
				case 4:
					{
					this.state = 454;
					this.match(SolidCashParser.T__7);
					}
					break;
				}
				this.state = 458;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 457;
					this.match(SolidCashParser.T__11);
					}
				}

				this.state = 460;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 461;
				this.match(SolidCashParser.T__9);
				this.state = 462;
				this.match(SolidCashParser.T__3);
				this.state = 463;
				this.usingFunctionBinding();
				this.state = 468;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 19, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 464;
						this.match(SolidCashParser.T__4);
						this.state = 465;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 470;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 19, this._ctx);
				}
				this.state = 472;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 471;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 474;
				this.match(SolidCashParser.T__5);
				this.state = 475;
				this.match(SolidCashParser.T__10);
				this.state = 480;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 21, this._ctx) ) {
				case 1:
					{
					this.state = 476;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 477;
					this.mappingType();
					}
					break;
				case 3:
					{
					this.state = 478;
					this.typeName();
					}
					break;
				case 4:
					{
					this.state = 479;
					this.match(SolidCashParser.T__7);
					}
					break;
				}
				this.state = 483;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 482;
					this.match(SolidCashParser.T__11);
					}
				}

				this.state = 485;
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
			this.state = 489;
			this.match(SolidCashParser.Identifier);
			this.state = 492;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7) {
				{
				this.state = 490;
				this.match(SolidCashParser.T__6);
				this.state = 491;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 496;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 494;
				this.match(SolidCashParser.T__2);
				this.state = 495;
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
			this.state = 498;
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
			this.state = 520;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 26, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 500;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 501;
				this.match(SolidCashParser.T__27);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 502;
				this.match(SolidCashParser.T__28);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 503;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 504;
				this.match(SolidCashParser.T__30);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 505;
				this.match(SolidCashParser.T__31);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 506;
				this.match(SolidCashParser.T__32);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 507;
				this.match(SolidCashParser.T__33);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 508;
				this.match(SolidCashParser.T__11);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 509;
				this.match(SolidCashParser.T__34);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 510;
				this.match(SolidCashParser.T__35);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 511;
				this.match(SolidCashParser.T__36);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 512;
				this.match(SolidCashParser.T__37);
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 513;
				this.match(SolidCashParser.T__38);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 514;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 515;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 516;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 517;
				this.match(SolidCashParser.BchUnit);
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 518;
				if (!(this.isMalformedBoundedTypeName(this._input.LT(1).text ?? ''))) {
					throw this.createFailedPredicateException("this.isMalformedBoundedTypeName(this._input.LT(1).text ?? '')");
				}
				this.state = 519;
				_la = this._input.LA(1);
				if(!(((((_la - 150)) & ~0x1F) === 0 && ((1 << (_la - 150)) & 1921) !== 0))) {
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
			this.state = 525;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 27, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 522;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 523;
				this.match(SolidCashParser.T__41);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 524;
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
			this.state = 541;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 29, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 527;
				this.match(SolidCashParser.T__43);
				this.state = 528;
				this.pragmaName();
				this.state = 529;
				this.pragmaValue();
				this.state = 530;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 532;
				this.match(SolidCashParser.T__43);
				this.state = 533;
				this.match(SolidCashParser.Identifier);
				this.state = 537;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===45 || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2081) !== 0) || _la===181) {
					{
					{
					this.state = 534;
					_la = this._input.LA(1);
					if(!(_la===45 || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 2081) !== 0) || _la===181)) {
					this._errHandler.recoverInline(this);
					}
					else {
						this._errHandler.reportMatch(this);
					    this.consume();
					}
					}
					}
					this.state = 539;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 540;
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
			this.state = 543;
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
			this.state = 554;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 20:
			case 21:
			case 22:
			case 23:
			case 26:
			case 27:
			case 48:
			case 141:
			case 145:
			case 146:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 545;
				this.versionAlternative();
				this.state = 550;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47) {
					{
					{
					this.state = 546;
					this.match(SolidCashParser.T__46);
					this.state = 547;
					this.versionAlternative();
					}
					}
					this.state = 552;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 553;
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
			this.state = 565;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 33, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 556;
				this.versionConstraint();
				this.state = 557;
				this.match(SolidCashParser.T__13);
				this.state = 558;
				this.versionConstraint();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 561;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 560;
					this.versionConstraint();
					}
					}
					this.state = 563;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 268435663) !== 0) || ((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 49) !== 0));
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 568;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 268435663) !== 0)) {
				{
				this.state = 567;
				this.versionOperator();
				}
			}

			this.state = 570;
			_la = this._input.LA(1);
			if(!(((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 49) !== 0))) {
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
			this.state = 572;
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
			this.state = 574;
			this.match(SolidCashParser.T__48);
			this.state = 575;
			this.match(SolidCashParser.Identifier);
			this.state = 585;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===50) {
				{
				this.state = 576;
				this.match(SolidCashParser.T__49);
				this.state = 577;
				this.match(SolidCashParser.Identifier);
				this.state = 582;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 578;
					this.match(SolidCashParser.T__4);
					this.state = 579;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 584;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 587;
			this.match(SolidCashParser.T__3);
			this.state = 600;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===9 || _la===10 || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 944111633) !== 0)) {
				{
				this.state = 598;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 37, this._ctx) ) {
				case 1:
					{
					this.state = 588;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 589;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 590;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 591;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 592;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 593;
					this.usingForDirective();
					}
					break;
				case 7:
					{
					this.state = 594;
					this.interfaceStateVariable();
					}
					break;
				case 8:
					{
					this.state = 595;
					this.interfaceCollection();
					}
					break;
				case 9:
					{
					this.state = 596;
					this.interfaceFunction();
					}
					break;
				case 10:
					{
					this.state = 597;
					this.interfaceFallbackDefinition();
					}
					break;
				}
				}
				this.state = 602;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 603;
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
			this.state = 615;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 39, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 605;
				this.interfaceStateVariableVisibility();
				this.state = 606;
				this.mappingType();
				this.state = 607;
				this.match(SolidCashParser.Identifier);
				this.state = 608;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 610;
				this.interfaceStateVariableVisibility();
				this.state = 611;
				this.arrayType(0);
				this.state = 612;
				this.match(SolidCashParser.Identifier);
				this.state = 613;
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
			this.state = 617;
			this.interfaceStateVariableVisibility();
			this.state = 618;
			this.typeName();
			this.state = 619;
			this.match(SolidCashParser.Identifier);
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
	public interfaceStateVariableVisibility(): InterfaceStateVariableVisibilityContext {
		let localctx: InterfaceStateVariableVisibilityContext = new InterfaceStateVariableVisibilityContext(this, this._ctx, this.state);
		this.enterRule(localctx, 38, SolidCashParser.RULE_interfaceStateVariableVisibility);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 622;
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
			this.state = 624;
			this.match(SolidCashParser.T__8);
			this.state = 625;
			this.functionName();
			this.state = 626;
			this.parameterList();
			this.state = 630;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 25165839) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3678215) !== 0)) {
				{
				{
				this.state = 627;
				this.functionModifier();
				}
				}
				this.state = 632;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 634;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===88) {
				{
				this.state = 633;
				this.returnType();
				}
			}

			this.state = 636;
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
			this.state = 638;
			this.match(SolidCashParser.T__37);
			this.state = 639;
			this.parameterList();
			this.state = 643;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 67)) & ~0x1F) === 0 && ((1 << (_la - 67)) & 1048579) !== 0)) {
				{
				{
				this.state = 640;
				this.fallbackModifier();
				}
				}
				this.state = 645;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 646;
			this.match(SolidCashParser.T__51);
			this.state = 650;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 67)) & ~0x1F) === 0 && ((1 << (_la - 67)) & 1048579) !== 0)) {
				{
				{
				this.state = 647;
				this.fallbackModifier();
				}
				}
				this.state = 652;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 654;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===88) {
				{
				this.state = 653;
				this.returnType();
				}
			}

			this.state = 656;
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
			this.state = 658;
			this.match(SolidCashParser.T__52);
			this.state = 659;
			this.match(SolidCashParser.Identifier);
			this.state = 660;
			this.match(SolidCashParser.T__3);
			this.state = 673;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===9 || _la===10 || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 944111681) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 59006977) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 15375) !== 0) || _la===181) {
				{
				this.state = 671;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 45, this._ctx) ) {
				case 1:
					{
					this.state = 661;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 662;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 663;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 664;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 665;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 666;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 667;
					this.stateVariableDeclaration();
					}
					break;
				case 8:
					{
					this.state = 668;
					this.usingForDirective();
					}
					break;
				case 9:
					{
					this.state = 669;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 670;
					this.freeFunctionDefinition();
					}
					break;
				}
				}
				this.state = 675;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 676;
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
			this.state = 679;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===54) {
				{
				this.state = 678;
				this.match(SolidCashParser.T__53);
				}
			}

			this.state = 681;
			this.match(SolidCashParser.T__54);
			this.state = 682;
			this.anyIdentifier();
			this.state = 684;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===57) {
				{
				this.state = 683;
				this.parameterList();
				}
			}

			this.state = 695;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===50) {
				{
				this.state = 686;
				this.match(SolidCashParser.T__49);
				this.state = 687;
				this.inheritanceSpecifier();
				this.state = 692;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 688;
					this.match(SolidCashParser.T__4);
					this.state = 689;
					this.inheritanceSpecifier();
					}
					}
					this.state = 694;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 697;
			this.match(SolidCashParser.T__3);
			this.state = 714;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===9 || _la===10 || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 3091595377) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 59006977) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 15375) !== 0) || _la===181) {
				{
				this.state = 712;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 51, this._ctx) ) {
				case 1:
					{
					this.state = 698;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 699;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 700;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 701;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 702;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 703;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 704;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 705;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 706;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 707;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 708;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 709;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 710;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 711;
					this.receiveDefinition();
					}
					break;
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
	public inheritanceSpecifier(): InheritanceSpecifierContext {
		let localctx: InheritanceSpecifierContext = new InheritanceSpecifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 48, SolidCashParser.RULE_inheritanceSpecifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 719;
			this.match(SolidCashParser.Identifier);
			this.state = 721;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===57) {
				{
				this.state = 720;
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
			this.state = 723;
			this.match(SolidCashParser.T__8);
			this.state = 724;
			this.functionName();
			this.state = 725;
			this.parameterList();
			this.state = 730;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 25165839) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3678215) !== 0) || _la===181) {
				{
				this.state = 728;
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
				case 79:
				case 85:
				case 86:
				case 87:
					{
					this.state = 726;
					this.functionModifier();
					}
					break;
				case 181:
					{
					this.state = 727;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 732;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 734;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===88) {
				{
				this.state = 733;
				this.returnType();
				}
			}

			this.state = 736;
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
			this.state = 738;
			this.match(SolidCashParser.T__55);
			this.state = 741;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 57, this._ctx) ) {
			case 1:
				{
				this.state = 739;
				this.anyIdentifier();
				}
				break;
			case 2:
				{
				this.state = 740;
				localctx._eventSpecialName = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===42 || _la===43)) {
				    localctx._eventSpecialName = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				break;
			}
			this.state = 743;
			this.match(SolidCashParser.T__56);
			this.state = 755;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===9 || _la===34 || ((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 3585) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 15375) !== 0) || _la===181) {
				{
				this.state = 744;
				this.eventParameter();
				this.state = 749;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 58, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 745;
						this.match(SolidCashParser.T__4);
						this.state = 746;
						this.eventParameter();
						}
						}
					}
					this.state = 751;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 58, this._ctx);
				}
				this.state = 753;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 752;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 757;
			this.match(SolidCashParser.T__57);
			this.state = 759;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===59) {
				{
				this.state = 758;
				this.match(SolidCashParser.T__58);
				}
			}

			this.state = 761;
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
			this.state = 765;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 62, this._ctx) ) {
			case 1:
				{
				this.state = 763;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 764;
				this.arrayType(0);
				}
				break;
			}
			this.state = 768;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 63, this._ctx) ) {
			case 1:
				{
				this.state = 767;
				this.match(SolidCashParser.T__59);
				}
				break;
			}
			this.state = 771;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 64, this._ctx) ) {
			case 1:
				{
				this.state = 770;
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
			this.state = 773;
			this.match(SolidCashParser.T__33);
			this.state = 774;
			this.anyIdentifier();
			this.state = 775;
			this.match(SolidCashParser.T__56);
			this.state = 787;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===9 || _la===34 || ((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 3585) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 15375) !== 0) || _la===181) {
				{
				this.state = 776;
				this.errorParameter();
				this.state = 781;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 65, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 777;
						this.match(SolidCashParser.T__4);
						this.state = 778;
						this.errorParameter();
						}
						}
					}
					this.state = 783;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 65, this._ctx);
				}
				this.state = 785;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 784;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 789;
			this.match(SolidCashParser.T__57);
			this.state = 790;
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
			this.state = 800;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 70, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 792;
				this.typeName();
				this.state = 794;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 68, this._ctx) ) {
				case 1:
					{
					this.state = 793;
					this.anyIdentifier();
					}
					break;
				}
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 796;
				this.arrayType(0);
				this.state = 798;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 69, this._ctx) ) {
				case 1:
					{
					this.state = 797;
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
			this.state = 802;
			this.match(SolidCashParser.T__60);
			this.state = 803;
			this.anyIdentifier();
			this.state = 804;
			this.match(SolidCashParser.T__3);
			this.state = 806;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 805;
				this.structField();
				}
				}
				this.state = 808;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===9 || _la===34 || ((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 3585) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 15375) !== 0) || _la===181);
			this.state = 810;
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
			this.state = 815;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 72, this._ctx) ) {
			case 1:
				{
				this.state = 812;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 813;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 814;
				this.mappingType();
				}
				break;
			}
			this.state = 817;
			this.anyIdentifier();
			this.state = 818;
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
			this.state = 820;
			this.match(SolidCashParser.T__61);
			this.state = 821;
			this.anyIdentifier();
			this.state = 822;
			this.match(SolidCashParser.T__3);
			this.state = 823;
			this.enumMember();
			this.state = 828;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 73, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 824;
					this.match(SolidCashParser.T__4);
					this.state = 825;
					this.enumMember();
					}
					}
				}
				this.state = 830;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 73, this._ctx);
			}
			this.state = 832;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 831;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 834;
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
			this.state = 836;
			this.anyIdentifier();
			this.state = 839;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===48) {
				{
				this.state = 837;
				this.match(SolidCashParser.T__47);
				this.state = 838;
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
			this.state = 841;
			this.match(SolidCashParser.T__62);
			this.state = 842;
			this.anyIdentifier();
			this.state = 843;
			this.match(SolidCashParser.T__49);
			this.state = 844;
			this.typeName();
			this.state = 845;
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
			this.state = 847;
			this.typeName();
			this.state = 848;
			this.match(SolidCashParser.T__63);
			this.state = 849;
			this.anyIdentifier();
			this.state = 850;
			this.match(SolidCashParser.T__47);
			this.state = 851;
			this.expression(0);
			this.state = 852;
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
			this.state = 854;
			this.match(SolidCashParser.T__64);
			this.state = 855;
			this.parameterList();
			this.state = 859;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 76, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 856;
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
				this.state = 861;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 76, this._ctx);
			}
			this.state = 865;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 77, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 862;
					this.parentInvocation();
					}
					}
				}
				this.state = 867;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 77, this._ctx);
			}
			this.state = 871;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 98307) !== 0)) {
				{
				{
				this.state = 868;
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
				this.state = 873;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 877;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===181) {
				{
				{
				this.state = 874;
				this.customModifierInvocation();
				}
				}
				this.state = 879;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 880;
			this.match(SolidCashParser.T__3);
			this.state = 884;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 80, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 881;
					this.statement();
					}
					}
				}
				this.state = 886;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 80, this._ctx);
			}
			this.state = 887;
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
			this.state = 889;
			this.match(SolidCashParser.T__37);
			this.state = 890;
			this.parameterList();
			this.state = 894;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 67)) & ~0x1F) === 0 && ((1 << (_la - 67)) & 1048579) !== 0)) {
				{
				{
				this.state = 891;
				this.fallbackModifier();
				}
				}
				this.state = 896;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 897;
			this.match(SolidCashParser.T__51);
			this.state = 901;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 67)) & ~0x1F) === 0 && ((1 << (_la - 67)) & 1048579) !== 0)) {
				{
				{
				this.state = 898;
				this.fallbackModifier();
				}
				}
				this.state = 903;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 907;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===181) {
				{
				{
				this.state = 904;
				this.customModifierInvocation();
				}
				}
				this.state = 909;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 911;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===88) {
				{
				this.state = 910;
				this.returnType();
				}
			}

			this.state = 913;
			this.match(SolidCashParser.T__3);
			this.state = 917;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 85, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 914;
					this.statement();
					}
					}
				}
				this.state = 919;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 85, this._ctx);
			}
			this.state = 920;
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
			this.state = 925;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 67:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 922;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 68:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 923;
				this.match(SolidCashParser.T__67);
				}
				break;
			case 87:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 924;
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
			this.state = 995;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 97, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 927;
				this.match(SolidCashParser.T__38);
				this.state = 928;
				this.match(SolidCashParser.T__56);
				this.state = 929;
				this.match(SolidCashParser.T__57);
				this.state = 933;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===68 || _la===87) {
					{
					{
					this.state = 930;
					this.receiveModifier();
					}
					}
					this.state = 935;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 936;
				this.match(SolidCashParser.T__51);
				this.state = 940;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===68 || _la===87) {
					{
					{
					this.state = 937;
					this.receiveModifier();
					}
					}
					this.state = 942;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 943;
				this.match(SolidCashParser.T__66);
				this.state = 947;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===68 || _la===87) {
					{
					{
					this.state = 944;
					this.receiveModifier();
					}
					}
					this.state = 949;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 959;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 4:
					{
					this.state = 950;
					this.match(SolidCashParser.T__3);
					this.state = 954;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 90, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 951;
							this.statement();
							}
							}
						}
						this.state = 956;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 90, this._ctx);
					}
					this.state = 957;
					this.match(SolidCashParser.T__5);
					}
					break;
				case 2:
					{
					this.state = 958;
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
				this.state = 961;
				this.match(SolidCashParser.T__38);
				this.state = 962;
				this.match(SolidCashParser.T__56);
				this.state = 963;
				this.match(SolidCashParser.T__57);
				this.state = 967;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===68 || _la===87) {
					{
					{
					this.state = 964;
					this.receiveModifier();
					}
					}
					this.state = 969;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 970;
				this.match(SolidCashParser.T__66);
				this.state = 974;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===68 || _la===87) {
					{
					{
					this.state = 971;
					this.receiveModifier();
					}
					}
					this.state = 976;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 977;
				this.match(SolidCashParser.T__51);
				this.state = 981;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===68 || _la===87) {
					{
					{
					this.state = 978;
					this.receiveModifier();
					}
					}
					this.state = 983;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 993;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 4:
					{
					this.state = 984;
					this.match(SolidCashParser.T__3);
					this.state = 988;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 95, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 985;
							this.statement();
							}
							}
						}
						this.state = 990;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 95, this._ctx);
					}
					this.state = 991;
					this.match(SolidCashParser.T__5);
					}
					break;
				case 2:
					{
					this.state = 992;
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
			this.state = 999;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 68:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 997;
				this.match(SolidCashParser.T__67);
				}
				break;
			case 87:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 998;
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
			this.state = 1001;
			this.match(SolidCashParser.Identifier);
			this.state = 1002;
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
			this.state = 1086;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 116, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1005;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 268468227) !== 0)) {
					{
					this.state = 1004;
					this.stateVariableVisibility();
					}
				}

				this.state = 1007;
				this.typeName();
				this.state = 1012;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 101, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						this.state = 1010;
						this._errHandler.sync(this);
						switch (this._input.LA(1)) {
						case 32:
						case 36:
						case 64:
						case 137:
						case 138:
						case 139:
						case 140:
							{
							this.state = 1008;
							this.modifier();
							}
							break;
						case 87:
							{
							this.state = 1009;
							this.overrideSpecifier();
							}
							break;
						default:
							throw new NoViableAltException(this);
						}
						}
					}
					this.state = 1014;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 101, this._ctx);
				}
				this.state = 1015;
				this.anyIdentifier();
				this.state = 1022;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1016;
					this.match(SolidCashParser.T__47);
					this.state = 1017;
					this.expression(0);
					this.state = 1020;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0)) {
						{
						this.state = 1018;
						localctx._sop = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
						    localctx._sop = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1019;
						this.assignChain();
						}
					}

					}
				}

				this.state = 1024;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1026;
				this.typeName();
				this.state = 1031;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===32 || _la===36 || _la===64 || _la===87 || ((((_la - 137)) & ~0x1F) === 0 && ((1 << (_la - 137)) & 15) !== 0)) {
					{
					this.state = 1029;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case 32:
					case 36:
					case 64:
					case 137:
					case 138:
					case 139:
					case 140:
						{
						this.state = 1027;
						this.modifier();
						}
						break;
					case 87:
						{
						this.state = 1028;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 1033;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1034;
				this.stateVariableVisibility();
				this.state = 1039;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 107, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						this.state = 1037;
						this._errHandler.sync(this);
						switch (this._input.LA(1)) {
						case 32:
						case 36:
						case 64:
						case 137:
						case 138:
						case 139:
						case 140:
							{
							this.state = 1035;
							this.modifier();
							}
							break;
						case 87:
							{
							this.state = 1036;
							this.overrideSpecifier();
							}
							break;
						default:
							throw new NoViableAltException(this);
						}
						}
					}
					this.state = 1041;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 107, this._ctx);
				}
				this.state = 1042;
				this.anyIdentifier();
				this.state = 1049;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1043;
					this.match(SolidCashParser.T__47);
					this.state = 1044;
					this.expression(0);
					this.state = 1047;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0)) {
						{
						this.state = 1045;
						localctx._sop = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
						    localctx._sop = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1046;
						this.assignChain();
						}
					}

					}
				}

				this.state = 1051;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1054;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 268468227) !== 0)) {
					{
					this.state = 1053;
					this.stateVariableVisibility();
					}
				}

				this.state = 1057;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1056;
					this.match(SolidCashParser.T__39);
					}
				}

				this.state = 1059;
				this.mappingType();
				this.state = 1063;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 112, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1060;
						this.collectionModifier();
						}
						}
					}
					this.state = 1065;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 112, this._ctx);
				}
				this.state = 1066;
				this.anyIdentifier();
				this.state = 1067;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1070;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 268468227) !== 0)) {
					{
					this.state = 1069;
					this.stateVariableVisibility();
					}
				}

				this.state = 1072;
				this.arrayType(0);
				this.state = 1076;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 114, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1073;
						this.collectionModifier();
						}
						}
					}
					this.state = 1078;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 114, this._ctx);
				}
				this.state = 1079;
				this.anyIdentifier();
				this.state = 1082;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1080;
					this.match(SolidCashParser.T__47);
					this.state = 1081;
					this.expression(0);
					}
				}

				this.state = 1084;
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
			this.state = 1091;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 32:
			case 36:
			case 64:
			case 137:
			case 138:
			case 139:
			case 140:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1088;
				this.modifier();
				}
				break;
			case 51:
			case 52:
			case 66:
			case 79:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1089;
				this.stateVariableVisibility();
				}
				break;
			case 87:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1090;
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
			this.state = 1093;
			_la = this._input.LA(1);
			if(!(((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 268468227) !== 0))) {
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
			this.state = 1134;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 124, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1095;
				this.match(SolidCashParser.T__79);
				this.state = 1096;
				this.match(SolidCashParser.T__56);
				this.state = 1097;
				this.typeName();
				this.state = 1099;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 118, this._ctx) ) {
				case 1:
					{
					this.state = 1098;
					this.anyIdentifier();
					}
					break;
				}
				this.state = 1101;
				this.match(SolidCashParser.T__80);
				this.state = 1102;
				this.typeName();
				this.state = 1104;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 119, this._ctx) ) {
				case 1:
					{
					this.state = 1103;
					this.anyIdentifier();
					}
					break;
				}
				this.state = 1106;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1108;
				this.match(SolidCashParser.T__79);
				this.state = 1109;
				this.match(SolidCashParser.T__56);
				this.state = 1110;
				this.typeName();
				this.state = 1112;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 120, this._ctx) ) {
				case 1:
					{
					this.state = 1111;
					this.anyIdentifier();
					}
					break;
				}
				this.state = 1114;
				this.match(SolidCashParser.T__80);
				this.state = 1115;
				this.mappingType();
				this.state = 1117;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 121, this._ctx) ) {
				case 1:
					{
					this.state = 1116;
					this.anyIdentifier();
					}
					break;
				}
				this.state = 1119;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1121;
				this.match(SolidCashParser.T__79);
				this.state = 1122;
				this.match(SolidCashParser.T__56);
				this.state = 1123;
				this.typeName();
				this.state = 1125;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 122, this._ctx) ) {
				case 1:
					{
					this.state = 1124;
					this.anyIdentifier();
					}
					break;
				}
				this.state = 1127;
				this.match(SolidCashParser.T__80);
				this.state = 1128;
				this.arrayType(0);
				this.state = 1130;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 123, this._ctx) ) {
				case 1:
					{
					this.state = 1129;
					this.anyIdentifier();
					}
					break;
				}
				this.state = 1132;
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
			this.state = 1158;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 128, this._ctx) ) {
			case 1:
				{
				this.state = 1137;
				this.functionType();
				this.state = 1138;
				this.match(SolidCashParser.T__81);
				this.state = 1140;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 125, this._ctx) ) {
				case 1:
					{
					this.state = 1139;
					this.expression(0);
					}
					break;
				}
				this.state = 1142;
				this.match(SolidCashParser.T__82);
				}
				break;
			case 2:
				{
				this.state = 1144;
				this.typeName();
				this.state = 1145;
				this.match(SolidCashParser.T__81);
				this.state = 1147;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 126, this._ctx) ) {
				case 1:
					{
					this.state = 1146;
					this.expression(0);
					}
					break;
				}
				this.state = 1149;
				this.match(SolidCashParser.T__82);
				}
				break;
			case 3:
				{
				this.state = 1151;
				this.mappingType();
				this.state = 1152;
				this.match(SolidCashParser.T__81);
				this.state = 1154;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 127, this._ctx) ) {
				case 1:
					{
					this.state = 1153;
					this.expression(0);
					}
					break;
				}
				this.state = 1156;
				this.match(SolidCashParser.T__82);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 1168;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 130, this._ctx);
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
					this.state = 1160;
					if (!(this.precpred(this._ctx, 1))) {
						throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
					}
					this.state = 1161;
					this.match(SolidCashParser.T__81);
					this.state = 1163;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 129, this._ctx) ) {
					case 1:
						{
						this.state = 1162;
						this.expression(0);
						}
						break;
					}
					this.state = 1165;
					this.match(SolidCashParser.T__82);
					}
					}
				}
				this.state = 1170;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 130, this._ctx);
			}
			}
		}
		catch (re) {
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
			this.state = 1171;
			this.match(SolidCashParser.T__83);
			this.state = 1172;
			this.match(SolidCashParser.Identifier);
			this.state = 1174;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===57) {
				{
				this.state = 1173;
				this.parameterList();
				}
			}

			this.state = 1180;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===68 || _la===87) {
				{
				this.state = 1178;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 68:
					{
					this.state = 1176;
					this.match(SolidCashParser.T__67);
					}
					break;
				case 87:
					{
					this.state = 1177;
					this.overrideSpecifier();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 1182;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1192;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				{
				this.state = 1183;
				this.match(SolidCashParser.T__3);
				this.state = 1187;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 134, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1184;
						this.modifierStatement();
						}
						}
					}
					this.state = 1189;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 134, this._ctx);
				}
				this.state = 1190;
				this.match(SolidCashParser.T__5);
				}
				break;
			case 2:
				{
				this.state = 1191;
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
			this.state = 1196;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 136, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1194;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1195;
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
			this.state = 1198;
			this.match(SolidCashParser.T__42);
			this.state = 1199;
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
			this.state = 1201;
			this.match(SolidCashParser.T__8);
			this.state = 1202;
			this.functionName();
			this.state = 1203;
			this.parameterList();
			this.state = 1208;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & 25165839) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3678215) !== 0) || _la===181) {
				{
				this.state = 1206;
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
				case 79:
				case 85:
				case 86:
				case 87:
					{
					this.state = 1204;
					this.functionModifier();
					}
					break;
				case 181:
					{
					this.state = 1205;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 1210;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1212;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===88) {
				{
				this.state = 1211;
				this.returnType();
				}
			}

			this.state = 1214;
			this.match(SolidCashParser.T__3);
			this.state = 1218;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 140, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1215;
					this.statement();
					}
					}
				}
				this.state = 1220;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 140, this._ctx);
			}
			this.state = 1221;
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
			this.state = 1225;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 141, this._ctx) ) {
			case 1:
				{
				this.state = 1223;
				this.match(SolidCashParser.Identifier);
				this.state = 1224;
				this.match(SolidCashParser.T__6);
				}
				break;
			}
			this.state = 1227;
			this.match(SolidCashParser.Identifier);
			this.state = 1229;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===57) {
				{
				this.state = 1228;
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
			this.state = 1244;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 85:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1231;
				this.match(SolidCashParser.T__84);
				}
				break;
			case 86:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1232;
				this.match(SolidCashParser.T__85);
				}
				break;
			case 66:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1233;
				this.match(SolidCashParser.T__65);
				}
				break;
			case 52:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1234;
				this.match(SolidCashParser.T__51);
				}
				break;
			case 51:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1235;
				this.match(SolidCashParser.T__50);
				}
				break;
			case 79:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1236;
				this.match(SolidCashParser.T__78);
				}
				break;
			case 67:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1237;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 87:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1238;
				this.overrideSpecifier();
				}
				break;
			case 68:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1239;
				this.match(SolidCashParser.T__67);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1240;
				this.unsafeModifier();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1241;
				this.match(SolidCashParser.T__28);
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1242;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1243;
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
			this.state = 1246;
			this.match(SolidCashParser.T__86);
			this.state = 1257;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 145, this._ctx) ) {
			case 1:
				{
				this.state = 1247;
				this.match(SolidCashParser.T__56);
				this.state = 1248;
				this.match(SolidCashParser.Identifier);
				this.state = 1253;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1249;
					this.match(SolidCashParser.T__4);
					this.state = 1250;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1255;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1256;
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
			this.state = 1259;
			this.match(SolidCashParser.T__30);
			this.state = 1263;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===57) {
				{
				this.state = 1260;
				this.match(SolidCashParser.T__56);
				this.state = 1261;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1262;
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
			this.state = 1265;
			this.match(SolidCashParser.T__87);
			this.state = 1266;
			this.match(SolidCashParser.T__56);
			this.state = 1267;
			this.returnParam();
			this.state = 1272;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 147, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1268;
					this.match(SolidCashParser.T__4);
					this.state = 1269;
					this.returnParam();
					}
					}
				}
				this.state = 1274;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 147, this._ctx);
			}
			this.state = 1276;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1275;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1278;
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
			this.state = 1310;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 155, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1280;
				this.typeName();
				this.state = 1284;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 149, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1281;
						this.modifier();
						}
						}
					}
					this.state = 1286;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 149, this._ctx);
				}
				this.state = 1288;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 150, this._ctx) ) {
				case 1:
					{
					this.state = 1287;
					this.anyIdentifier();
					}
					break;
				}
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1290;
				this.arrayType(0);
				this.state = 1294;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 151, this._ctx);
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
					_alt = this._interp.adaptivePredict(this._input, 151, this._ctx);
				}
				this.state = 1298;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 152, this._ctx) ) {
				case 1:
					{
					this.state = 1297;
					this.anyIdentifier();
					}
					break;
				}
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1300;
				this.mappingType();
				this.state = 1304;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 153, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1301;
						this.modifier();
						}
						}
					}
					this.state = 1306;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 153, this._ctx);
				}
				this.state = 1308;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 154, this._ctx) ) {
				case 1:
					{
					this.state = 1307;
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
			this.state = 1312;
			this.match(SolidCashParser.T__56);
			this.state = 1324;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===9 || _la===34 || ((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 3585) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 15375) !== 0) || _la===181) {
				{
				this.state = 1313;
				this.parameter();
				this.state = 1318;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 156, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1314;
						this.match(SolidCashParser.T__4);
						this.state = 1315;
						this.parameter();
						}
						}
					}
					this.state = 1320;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 156, this._ctx);
				}
				this.state = 1322;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1321;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1326;
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
			this.state = 1358;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 165, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1328;
				this.typeName();
				this.state = 1332;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 159, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1329;
						this.modifier();
						}
						}
					}
					this.state = 1334;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 159, this._ctx);
				}
				this.state = 1336;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 160, this._ctx) ) {
				case 1:
					{
					this.state = 1335;
					this.anyIdentifier();
					}
					break;
				}
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1338;
				this.arrayType(0);
				this.state = 1342;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 161, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1339;
						this.modifier();
						}
						}
					}
					this.state = 1344;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 161, this._ctx);
				}
				this.state = 1346;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 162, this._ctx) ) {
				case 1:
					{
					this.state = 1345;
					this.anyIdentifier();
					}
					break;
				}
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1348;
				this.mappingType();
				this.state = 1352;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 163, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1349;
						this.modifier();
						}
						}
					}
					this.state = 1354;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 163, this._ctx);
				}
				this.state = 1356;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 164, this._ctx) ) {
				case 1:
					{
					this.state = 1355;
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
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1360;
			this.statement();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1362;
			this.match(SolidCashParser.T__3);
			this.state = 1366;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1363;
					this.statement();
					}
					}
				}
				this.state = 1368;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
			}
			this.state = 1369;
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
			this.state = 1402;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 167, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1371;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1372;
				this.blockStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1373;
				this.bareTypeExpressionStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1374;
				this.primitiveTypeReferenceStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1375;
				this.userDefinedArrayTypeReferenceStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1376;
				this.variableDefinition();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1377;
				this.nestedTupleAssignment();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1378;
				this.tupleAssignment();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1379;
				this.prefixIncDecStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1380;
				this.timeOpStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1381;
				this.requireStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1382;
				this.ifStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1383;
				this.loopStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1384;
				this.consoleStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1385;
				this.emitStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1386;
				this.returnStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1387;
				this.selfdestructStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1388;
				this.assemblyStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1389;
				this.tryCatchStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1390;
				this.revertStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1391;
				this.assertStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1392;
				this.deleteStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1393;
				this.uncheckedStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1394;
				this.switchStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1395;
				this.breakStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1396;
				this.continueStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1397;
				this.bareAbiFunctionReferenceStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1398;
				this.bareCallOptionsStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1399;
				this.bareNewWithOptionsStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1400;
				this.parenthesizedArrayPopStatement();
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 31);
				{
				this.state = 1401;
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
			this.state = 1431;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 89:
			case 90:
			case 91:
			case 147:
			case 148:
			case 149:
			case 150:
			case 157:
			case 158:
			case 159:
			case 160:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1404;
				this.elementaryTypeToken();
				this.state = 1412;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===82) {
					{
					{
					this.state = 1405;
					this.match(SolidCashParser.T__81);
					this.state = 1407;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 168, this._ctx) ) {
					case 1:
						{
						this.state = 1406;
						this.expression(0);
						}
						break;
					}
					this.state = 1409;
					this.match(SolidCashParser.T__82);
					}
					}
					this.state = 1414;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1415;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 57:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1417;
				this.match(SolidCashParser.T__56);
				this.state = 1418;
				this.elementaryTypeToken();
				this.state = 1424;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1419;
					this.match(SolidCashParser.T__81);
					this.state = 1421;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 170, this._ctx) ) {
					case 1:
						{
						this.state = 1420;
						this.expression(0);
						}
						break;
					}
					this.state = 1423;
					this.match(SolidCashParser.T__82);
					}
					}
					this.state = 1426;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===82);
				this.state = 1428;
				this.match(SolidCashParser.T__57);
				this.state = 1429;
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
			this.state = 1433;
			this.match(SolidCashParser.Identifier);
			this.state = 1441;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 174, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1434;
					this.match(SolidCashParser.T__81);
					this.state = 1436;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 173, this._ctx) ) {
					case 1:
						{
						this.state = 1435;
						this.expression(0);
						}
						break;
					}
					this.state = 1438;
					this.match(SolidCashParser.T__82);
					}
					}
				}
				this.state = 1443;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 174, this._ctx);
			}
			this.state = 1444;
			this.match(SolidCashParser.T__81);
			this.state = 1445;
			this.match(SolidCashParser.T__82);
			this.state = 1453;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===82) {
				{
				{
				this.state = 1446;
				this.match(SolidCashParser.T__81);
				this.state = 1448;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 175, this._ctx) ) {
				case 1:
					{
					this.state = 1447;
					this.expression(0);
					}
					break;
				}
				this.state = 1450;
				this.match(SolidCashParser.T__82);
				}
				}
				this.state = 1455;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1456;
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
			this.state = 1472;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 147:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1458;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 148:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1459;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 150:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1460;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 149:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1461;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 157:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1462;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 158:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1463;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 159:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1464;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 160:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1465;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 89:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1466;
				this.match(SolidCashParser.T__88);
				}
				break;
			case 90:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1467;
				this.match(SolidCashParser.T__89);
				}
				break;
			case 91:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1468;
				this.match(SolidCashParser.T__90);
				this.state = 1470;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===67) {
					{
					this.state = 1469;
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
			this.state = 1474;
			this.match(SolidCashParser.T__62);
			this.state = 1475;
			this.match(SolidCashParser.T__56);
			this.state = 1476;
			this.typeName();
			this.state = 1477;
			this.match(SolidCashParser.T__57);
			this.state = 1478;
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
			this.state = 1480;
			_la = this._input.LA(1);
			if(!(_la===42 || _la===181)) {
			this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			this.state = 1481;
			this.match(SolidCashParser.T__6);
			this.state = 1482;
			this.match(SolidCashParser.Identifier);
			this.state = 1483;
			this.callOptions();
			this.state = 1485;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7) {
				{
				this.state = 1484;
				this.callOptionsFunctionMember();
				}
			}

			this.state = 1487;
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
			this.state = 1493;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 180, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1489;
				this.match(SolidCashParser.T__6);
				this.state = 1490;
				this.match(SolidCashParser.T__90);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1491;
				this.match(SolidCashParser.T__6);
				this.state = 1492;
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
			this.state = 1495;
			this.match(SolidCashParser.T__91);
			this.state = 1496;
			this.match(SolidCashParser.Identifier);
			this.state = 1497;
			this.callOptions();
			this.state = 1498;
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
			this.state = 1500;
			this.match(SolidCashParser.T__56);
			this.state = 1503;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 1501;
				this.match(SolidCashParser.T__41);
				this.state = 1502;
				this.match(SolidCashParser.T__6);
				}
			}

			this.state = 1505;
			this.match(SolidCashParser.Identifier);
			this.state = 1506;
			this.match(SolidCashParser.DotPop);
			this.state = 1507;
			this.match(SolidCashParser.T__57);
			this.state = 1508;
			this.match(SolidCashParser.T__56);
			this.state = 1509;
			this.match(SolidCashParser.T__57);
			this.state = 1510;
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
			this.state = 1512;
			this.expression(0);
			this.state = 1593;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 189, this._ctx) ) {
			case 1:
				{
				this.state = 1513;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1514;
				this.assignChain();
				}
				break;
			case 2:
				{
				this.state = 1515;
				this.match(SolidCashParser.DotPush);
				this.state = 1516;
				this.match(SolidCashParser.T__56);
				this.state = 1517;
				this.match(SolidCashParser.T__57);
				this.state = 1518;
				localctx._second = this.match(SolidCashParser.DotPush);
				this.state = 1519;
				this.match(SolidCashParser.T__56);
				this.state = 1520;
				this.match(SolidCashParser.T__57);
				this.state = 1521;
				localctx._third = this.match(SolidCashParser.DotPush);
				this.state = 1522;
				this.match(SolidCashParser.T__56);
				this.state = 1523;
				this.match(SolidCashParser.T__57);
				this.state = 1526;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1524;
					this.match(SolidCashParser.T__47);
					this.state = 1525;
					this.expression(0);
					}
				}

				}
				break;
			case 3:
				{
				this.state = 1528;
				this.match(SolidCashParser.DotPush);
				this.state = 1529;
				this.match(SolidCashParser.T__56);
				this.state = 1530;
				this.match(SolidCashParser.T__57);
				this.state = 1531;
				localctx._second = this.match(SolidCashParser.DotPush);
				this.state = 1532;
				this.match(SolidCashParser.T__56);
				this.state = 1533;
				this.match(SolidCashParser.T__57);
				this.state = 1534;
				this.match(SolidCashParser.T__47);
				this.state = 1535;
				this.expression(0);
				this.state = 1544;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===166) {
					{
					this.state = 1536;
					localctx._rhsPush = this.match(SolidCashParser.DotPush);
					this.state = 1537;
					this.match(SolidCashParser.T__56);
					this.state = 1538;
					this.match(SolidCashParser.T__57);
					this.state = 1542;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===166) {
						{
						this.state = 1539;
						localctx._rhsPush2 = this.match(SolidCashParser.DotPush);
						this.state = 1540;
						this.match(SolidCashParser.T__56);
						this.state = 1541;
						this.match(SolidCashParser.T__57);
						}
					}

					}
				}

				}
				break;
			case 4:
				{
				this.state = 1546;
				this.match(SolidCashParser.DotPush);
				this.state = 1547;
				this.match(SolidCashParser.T__56);
				this.state = 1548;
				this.match(SolidCashParser.T__57);
				this.state = 1549;
				localctx._second = this.match(SolidCashParser.DotPush);
				this.state = 1550;
				this.match(SolidCashParser.T__56);
				this.state = 1552;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 185, this._ctx) ) {
				case 1:
					{
					this.state = 1551;
					this.pushArgument();
					}
					break;
				}
				this.state = 1554;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 5:
				{
				this.state = 1555;
				this.match(SolidCashParser.DotPush);
				this.state = 1556;
				this.match(SolidCashParser.T__56);
				this.state = 1557;
				this.match(SolidCashParser.T__57);
				this.state = 1558;
				this.match(SolidCashParser.T__6);
				this.state = 1559;
				localctx._pushField = this.anyIdentifier();
				this.state = 1560;
				this.match(SolidCashParser.T__47);
				this.state = 1561;
				this.expression(0);
				}
				break;
			case 6:
				{
				this.state = 1563;
				this.match(SolidCashParser.DotPush);
				this.state = 1564;
				this.match(SolidCashParser.T__56);
				this.state = 1565;
				this.match(SolidCashParser.T__57);
				this.state = 1566;
				localctx._pushAssignOp = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
				    localctx._pushAssignOp = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1567;
				this.expression(0);
				this.state = 1576;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===166) {
					{
					this.state = 1568;
					localctx._rhsPush = this.match(SolidCashParser.DotPush);
					this.state = 1569;
					this.match(SolidCashParser.T__56);
					this.state = 1570;
					this.match(SolidCashParser.T__57);
					this.state = 1574;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===166) {
						{
						this.state = 1571;
						localctx._rhsPush2 = this.match(SolidCashParser.DotPush);
						this.state = 1572;
						this.match(SolidCashParser.T__56);
						this.state = 1573;
						this.match(SolidCashParser.T__57);
						}
					}

					}
				}

				}
				break;
			case 7:
				{
				this.state = 1578;
				this.match(SolidCashParser.DotPush);
				this.state = 1579;
				this.match(SolidCashParser.T__56);
				this.state = 1581;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 188, this._ctx) ) {
				case 1:
					{
					this.state = 1580;
					this.pushArgument();
					}
					break;
				}
				this.state = 1583;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 8:
				{
				this.state = 1584;
				this.match(SolidCashParser.DotPop);
				this.state = 1585;
				this.match(SolidCashParser.T__56);
				this.state = 1586;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 9:
				{
				this.state = 1587;
				this.match(SolidCashParser.DotDelete);
				this.state = 1588;
				this.match(SolidCashParser.T__56);
				this.state = 1589;
				this.expression(0);
				this.state = 1590;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 10:
				{
				this.state = 1592;
				localctx._bareMember = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 166)) & ~0x1F) === 0 && ((1 << (_la - 166)) & 19) !== 0))) {
				    localctx._bareMember = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				break;
			}
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
	public assignChain(): AssignChainContext {
		let localctx: AssignChainContext = new AssignChainContext(this, this._ctx, this.state);
		this.enterRule(localctx, 142, SolidCashParser.RULE_assignChain);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1597;
			this.expression(0);
			this.state = 1600;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 190, this._ctx) ) {
			case 1:
				{
				this.state = 1598;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1599;
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
			this.state = 1602;
			localctx._op = this._input.LT(1);
			_la = this._input.LA(1);
			if(!(_la===93 || _la===94)) {
			    localctx._op = this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			this.state = 1603;
			this.expression(0);
			this.state = 1604;
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
			this.state = 1647;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 194, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1606;
				this.match(SolidCashParser.T__94);
				this.state = 1607;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1608;
				this.match(SolidCashParser.T__94);
				this.state = 1609;
				localctx._pushBase = this.match(SolidCashParser.Identifier);
				this.state = 1610;
				this.match(SolidCashParser.DotPush);
				this.state = 1611;
				this.match(SolidCashParser.T__56);
				this.state = 1612;
				this.match(SolidCashParser.T__57);
				this.state = 1613;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1614;
				this.match(SolidCashParser.T__94);
				this.state = 1615;
				this.expression(0);
				this.state = 1616;
				localctx._rop = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
				    localctx._rop = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1617;
				this.assignChain();
				this.state = 1618;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1620;
				this.match(SolidCashParser.T__94);
				this.state = 1621;
				this.expression(0);
				this.state = 1626;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1622;
					this.match(SolidCashParser.T__4);
					this.state = 1623;
					this.expression(0);
					}
					}
					this.state = 1628;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1629;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1631;
				this.match(SolidCashParser.T__94);
				this.state = 1632;
				this.match(SolidCashParser.T__56);
				this.state = 1633;
				this.expression(0);
				this.state = 1638;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 192, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1634;
						this.match(SolidCashParser.T__4);
						this.state = 1635;
						this.expression(0);
						}
						}
					}
					this.state = 1640;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 192, this._ctx);
				}
				this.state = 1642;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1641;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1644;
				this.match(SolidCashParser.T__57);
				this.state = 1645;
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
			this.state = 1657;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 195, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1649;
				this.match(SolidCashParser.T__29);
				this.state = 1650;
				this.match(SolidCashParser.T__56);
				this.state = 1651;
				this.expression(0);
				this.state = 1652;
				this.match(SolidCashParser.T__57);
				this.state = 1653;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1655;
				this.match(SolidCashParser.T__29);
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
	public emitStatement(): EmitStatementContext {
		let localctx: EmitStatementContext = new EmitStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 150, SolidCashParser.RULE_emitStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1692;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 201, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1659;
				this.match(SolidCashParser.T__95);
				this.state = 1660;
				this.match(SolidCashParser.Identifier);
				this.state = 1663;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7) {
					{
					this.state = 1661;
					this.match(SolidCashParser.T__6);
					this.state = 1662;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1665;
				this.match(SolidCashParser.T__56);
				this.state = 1666;
				this.match(SolidCashParser.T__3);
				this.state = 1678;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===181) {
					{
					this.state = 1667;
					this.namedArg();
					this.state = 1672;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 197, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1668;
							this.match(SolidCashParser.T__4);
							this.state = 1669;
							this.namedArg();
							}
							}
						}
						this.state = 1674;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 197, this._ctx);
					}
					this.state = 1676;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1675;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1680;
				this.match(SolidCashParser.T__5);
				this.state = 1681;
				this.match(SolidCashParser.T__57);
				this.state = 1682;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1683;
				this.match(SolidCashParser.T__95);
				this.state = 1684;
				this.match(SolidCashParser.Identifier);
				this.state = 1687;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7) {
					{
					this.state = 1685;
					this.match(SolidCashParser.T__6);
					this.state = 1686;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1689;
				this.expressionList();
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
	public variableDefinition(): VariableDefinitionContext {
		let localctx: VariableDefinitionContext = new VariableDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 152, SolidCashParser.RULE_variableDefinition);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1767;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 213, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1694;
				this.functionArrayType();
				this.state = 1698;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 202, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1695;
						this.modifier();
						}
						}
					}
					this.state = 1700;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 202, this._ctx);
				}
				this.state = 1701;
				this.anyIdentifier();
				this.state = 1709;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1702;
					this.match(SolidCashParser.T__47);
					this.state = 1703;
					this.expression(0);
					this.state = 1707;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===166) {
						{
						this.state = 1704;
						this.match(SolidCashParser.DotPush);
						this.state = 1705;
						this.match(SolidCashParser.T__56);
						this.state = 1706;
						this.match(SolidCashParser.T__57);
						}
					}

					}
				}

				this.state = 1711;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1713;
				this.arrayType(0);
				this.state = 1717;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 205, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1714;
						this.modifier();
						}
						}
					}
					this.state = 1719;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 205, this._ctx);
				}
				this.state = 1720;
				this.anyIdentifier();
				this.state = 1728;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1721;
					this.match(SolidCashParser.T__47);
					this.state = 1722;
					this.expression(0);
					this.state = 1726;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===166) {
						{
						this.state = 1723;
						this.match(SolidCashParser.DotPush);
						this.state = 1724;
						this.match(SolidCashParser.T__56);
						this.state = 1725;
						this.match(SolidCashParser.T__57);
						}
					}

					}
				}

				this.state = 1730;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1732;
				this.typeName();
				this.state = 1736;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 208, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1733;
						this.modifier();
						}
						}
					}
					this.state = 1738;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 208, this._ctx);
				}
				this.state = 1739;
				this.anyIdentifier();
				this.state = 1749;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1740;
					this.match(SolidCashParser.T__47);
					this.state = 1741;
					this.expression(0);
					this.state = 1747;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case 48:
					case 69:
					case 70:
					case 71:
					case 72:
					case 73:
					case 74:
					case 75:
					case 76:
					case 77:
					case 78:
						{
						this.state = 1742;
						localctx._iop = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
						    localctx._iop = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1743;
						this.assignChain();
						}
						break;
					case 166:
						{
						this.state = 1744;
						this.match(SolidCashParser.DotPush);
						this.state = 1745;
						this.match(SolidCashParser.T__56);
						this.state = 1746;
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

				this.state = 1751;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1753;
				this.mappingType();
				this.state = 1757;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 211, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1754;
						this.modifier();
						}
						}
					}
					this.state = 1759;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 211, this._ctx);
				}
				this.state = 1760;
				this.anyIdentifier();
				this.state = 1763;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1761;
					this.match(SolidCashParser.T__47);
					this.state = 1762;
					this.expression(0);
					}
				}

				this.state = 1765;
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
	public functionArrayType(): FunctionArrayTypeContext {
		let localctx: FunctionArrayTypeContext = new FunctionArrayTypeContext(this, this._ctx, this.state);
		this.enterRule(localctx, 154, SolidCashParser.RULE_functionArrayType);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1769;
			this.functionType();
			this.state = 1775;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1770;
					this.match(SolidCashParser.T__81);
					this.state = 1772;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 214, this._ctx) ) {
					case 1:
						{
						this.state = 1771;
						this.expression(0);
						}
						break;
					}
					this.state = 1774;
					this.match(SolidCashParser.T__82);
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1777;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 215, this._ctx);
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
	public tupleAssignment(): TupleAssignmentContext {
		let localctx: TupleAssignmentContext = new TupleAssignmentContext(this, this._ctx, this.state);
		this.enterRule(localctx, 156, SolidCashParser.RULE_tupleAssignment);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1855;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 222, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1779;
				this.typeName();
				this.state = 1780;
				this.match(SolidCashParser.Identifier);
				this.state = 1785;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1781;
					this.match(SolidCashParser.T__4);
					this.state = 1782;
					this.typeName();
					this.state = 1783;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1787;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1789;
				this.match(SolidCashParser.T__47);
				this.state = 1790;
				this.expression(0);
				this.state = 1791;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1793;
				this.match(SolidCashParser.T__56);
				this.state = 1794;
				this.tupleSlot();
				this.state = 1797;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1795;
					this.match(SolidCashParser.T__4);
					this.state = 1796;
					this.tupleSlot();
					}
					}
					this.state = 1799;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1801;
				this.match(SolidCashParser.T__57);
				this.state = 1802;
				this.match(SolidCashParser.T__47);
				this.state = 1803;
				this.match(SolidCashParser.T__56);
				this.state = 1804;
				this.expression(0);
				this.state = 1807;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1805;
					this.match(SolidCashParser.T__4);
					this.state = 1806;
					this.expression(0);
					}
					}
					this.state = 1809;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1811;
				this.match(SolidCashParser.T__57);
				this.state = 1812;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1814;
				this.match(SolidCashParser.T__56);
				this.state = 1815;
				this.tupleSlot();
				this.state = 1818;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1816;
					this.match(SolidCashParser.T__4);
					this.state = 1817;
					this.tupleSlot();
					}
					}
					this.state = 1820;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1822;
				this.match(SolidCashParser.T__57);
				this.state = 1823;
				this.match(SolidCashParser.T__47);
				this.state = 1824;
				this.expression(0);
				this.state = 1825;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1827;
				this.match(SolidCashParser.T__56);
				this.state = 1828;
				this.typeName();
				this.state = 1832;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 220, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1829;
						this.modifier();
						}
						}
					}
					this.state = 1834;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 220, this._ctx);
				}
				this.state = 1835;
				this.anyIdentifier();
				this.state = 1836;
				this.match(SolidCashParser.T__57);
				this.state = 1837;
				this.match(SolidCashParser.T__47);
				this.state = 1838;
				this.expression(0);
				this.state = 1839;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1841;
				this.match(SolidCashParser.T__56);
				this.state = 1842;
				this.arrayType(0);
				this.state = 1846;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 221, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1843;
						this.modifier();
						}
						}
					}
					this.state = 1848;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 221, this._ctx);
				}
				this.state = 1849;
				this.anyIdentifier();
				this.state = 1850;
				this.match(SolidCashParser.T__57);
				this.state = 1851;
				this.match(SolidCashParser.T__47);
				this.state = 1852;
				this.expression(0);
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
	public nestedTupleAssignment(): NestedTupleAssignmentContext {
		let localctx: NestedTupleAssignmentContext = new NestedTupleAssignmentContext(this, this._ctx, this.state);
		this.enterRule(localctx, 158, SolidCashParser.RULE_nestedTupleAssignment);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1857;
			if (!(this.hasNestedTuplePatternAhead())) {
				throw this.createFailedPredicateException("this.hasNestedTuplePatternAhead()");
			}
			this.state = 1858;
			this.nestedTuplePattern();
			this.state = 1859;
			this.match(SolidCashParser.T__47);
			this.state = 1860;
			this.expression(0);
			this.state = 1861;
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
		this.enterRule(localctx, 160, SolidCashParser.RULE_nestedTuplePattern);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1863;
			this.match(SolidCashParser.T__56);
			this.state = 1865;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 223, this._ctx) ) {
			case 1:
				{
				this.state = 1864;
				this.nestedTuplePatternItem();
				}
				break;
			}
			this.state = 1873;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1867;
				this.match(SolidCashParser.T__4);
				this.state = 1869;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 224, this._ctx) ) {
				case 1:
					{
					this.state = 1868;
					this.nestedTuplePatternItem();
					}
					break;
				}
				}
				}
				this.state = 1875;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1876;
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
		this.enterRule(localctx, 162, SolidCashParser.RULE_nestedTuplePatternItem);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1912;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 230, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1878;
				this.typeName();
				this.state = 1882;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 226, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1879;
						this.modifier();
						}
						}
					}
					this.state = 1884;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 226, this._ctx);
				}
				this.state = 1885;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1887;
				this.arrayType(0);
				this.state = 1891;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 227, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1888;
						this.modifier();
						}
						}
					}
					this.state = 1893;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 227, this._ctx);
				}
				this.state = 1894;
				this.anyIdentifier();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1896;
				this.anyIdentifier();
				this.state = 1908;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===7 || _la===82 || _la===166) {
					{
					this.state = 1906;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case 82:
						{
						this.state = 1897;
						this.match(SolidCashParser.T__81);
						this.state = 1898;
						this.expression(0);
						this.state = 1899;
						this.match(SolidCashParser.T__82);
						}
						break;
					case 7:
						{
						this.state = 1901;
						this.match(SolidCashParser.T__6);
						this.state = 1902;
						this.anyIdentifier();
						}
						break;
					case 166:
						{
						this.state = 1903;
						this.match(SolidCashParser.DotPush);
						this.state = 1904;
						this.match(SolidCashParser.T__56);
						this.state = 1905;
						this.match(SolidCashParser.T__57);
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 1910;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1911;
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
		this.enterRule(localctx, 164, SolidCashParser.RULE_tupleSlot);
		let _la: number;
		try {
			let _alt: number;
			this.state = 1948;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 235, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1914;
				this.typeName();
				this.state = 1918;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 231, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1915;
						this.modifier();
						}
						}
					}
					this.state = 1920;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 231, this._ctx);
				}
				this.state = 1921;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1923;
				this.arrayType(0);
				this.state = 1927;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 232, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1924;
						this.modifier();
						}
						}
					}
					this.state = 1929;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 232, this._ctx);
				}
				this.state = 1930;
				this.anyIdentifier();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1932;
				this.anyIdentifier();
				this.state = 1944;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===7 || _la===82 || _la===166) {
					{
					this.state = 1942;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case 82:
						{
						this.state = 1933;
						this.match(SolidCashParser.T__81);
						this.state = 1934;
						this.expression(0);
						this.state = 1935;
						this.match(SolidCashParser.T__82);
						}
						break;
					case 7:
						{
						this.state = 1937;
						this.match(SolidCashParser.T__6);
						this.state = 1938;
						this.anyIdentifier();
						}
						break;
					case 166:
						{
						this.state = 1939;
						this.match(SolidCashParser.DotPush);
						this.state = 1940;
						this.match(SolidCashParser.T__56);
						this.state = 1941;
						this.match(SolidCashParser.T__57);
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 1946;
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
		this.enterRule(localctx, 166, SolidCashParser.RULE_pushArgument);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1950;
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
		this.enterRule(localctx, 168, SolidCashParser.RULE_deleteStatement);
		let _la: number;
		try {
			this.state = 2057;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 245, this._ctx) ) {
			case 1:
				localctx = new DeletePushContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1952;
				this.match(SolidCashParser.T__96);
				this.state = 1953;
				this.match(SolidCashParser.Identifier);
				this.state = 1954;
				this.match(SolidCashParser.DotPush);
				this.state = 1955;
				this.match(SolidCashParser.T__56);
				this.state = 1956;
				this.match(SolidCashParser.T__57);
				this.state = 1960;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===166) {
					{
					this.state = 1957;
					(localctx as DeletePushContext)._second = this.match(SolidCashParser.DotPush);
					this.state = 1958;
					this.match(SolidCashParser.T__56);
					this.state = 1959;
					this.match(SolidCashParser.T__57);
					}
				}

				this.state = 1962;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1963;
				this.match(SolidCashParser.T__96);
				this.state = 1964;
				this.match(SolidCashParser.Identifier);
				this.state = 1965;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteParenthesizedContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1966;
				this.match(SolidCashParser.T__96);
				this.state = 1967;
				this.match(SolidCashParser.T__56);
				this.state = 1968;
				this.expression(0);
				this.state = 1969;
				this.match(SolidCashParser.T__57);
				this.state = 1970;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1972;
				this.match(SolidCashParser.T__96);
				this.state = 1973;
				this.match(SolidCashParser.T__41);
				this.state = 1974;
				this.match(SolidCashParser.T__6);
				this.state = 1975;
				this.match(SolidCashParser.Identifier);
				this.state = 1976;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1977;
				this.match(SolidCashParser.T__96);
				this.state = 1978;
				this.match(SolidCashParser.T__41);
				this.state = 1979;
				this.match(SolidCashParser.T__6);
				this.state = 1980;
				this.match(SolidCashParser.Identifier);
				this.state = 1985;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1981;
					this.match(SolidCashParser.T__81);
					this.state = 1982;
					this.expression(0);
					this.state = 1983;
					this.match(SolidCashParser.T__82);
					}
					}
					this.state = 1987;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===82);
				this.state = 1989;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 6:
				localctx = new DeleteDeepMemberEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1991;
				this.match(SolidCashParser.T__96);
				this.state = 1992;
				this.match(SolidCashParser.Identifier);
				this.state = 1997;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1993;
					this.match(SolidCashParser.T__81);
					this.state = 1994;
					this.expression(0);
					this.state = 1995;
					this.match(SolidCashParser.T__82);
					}
					}
					this.state = 1999;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===82);
				this.state = 2012;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2001;
					this.match(SolidCashParser.T__6);
					this.state = 2002;
					this.match(SolidCashParser.Identifier);
					this.state = 2009;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===82) {
						{
						{
						this.state = 2003;
						this.match(SolidCashParser.T__81);
						this.state = 2004;
						this.expression(0);
						this.state = 2005;
						this.match(SolidCashParser.T__82);
						}
						}
						this.state = 2011;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
					}
					this.state = 2014;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===7);
				this.state = 2016;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 7:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2018;
				this.match(SolidCashParser.T__96);
				this.state = 2019;
				this.match(SolidCashParser.Identifier);
				this.state = 2024;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2020;
					this.match(SolidCashParser.T__81);
					this.state = 2021;
					this.expression(0);
					this.state = 2022;
					this.match(SolidCashParser.T__82);
					}
					}
					this.state = 2026;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===82);
				this.state = 2028;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 8:
				localctx = new DeleteMemberEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2030;
				this.match(SolidCashParser.T__96);
				this.state = 2031;
				this.match(SolidCashParser.Identifier);
				this.state = 2034;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2032;
					this.match(SolidCashParser.T__6);
					this.state = 2033;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 2036;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===7);
				this.state = 2042;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2038;
					this.match(SolidCashParser.T__81);
					this.state = 2039;
					this.expression(0);
					this.state = 2040;
					this.match(SolidCashParser.T__82);
					}
					}
					this.state = 2044;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===82);
				this.state = 2046;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 9:
				localctx = new DeleteMemberContext(this, localctx);
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2048;
				this.match(SolidCashParser.T__96);
				this.state = 2049;
				this.match(SolidCashParser.Identifier);
				this.state = 2052;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2050;
					this.match(SolidCashParser.T__6);
					this.state = 2051;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 2054;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===7);
				this.state = 2056;
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
		this.enterRule(localctx, 170, SolidCashParser.RULE_timeOpStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2059;
			this.match(SolidCashParser.T__40);
			this.state = 2060;
			this.match(SolidCashParser.T__56);
			this.state = 2061;
			this.match(SolidCashParser.TxVar);
			this.state = 2062;
			this.match(SolidCashParser.T__22);
			this.state = 2063;
			this.expression(0);
			this.state = 2066;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2064;
				this.match(SolidCashParser.T__4);
				this.state = 2065;
				this.requireMessage();
				}
			}

			this.state = 2068;
			this.match(SolidCashParser.T__57);
			this.state = 2069;
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
		this.enterRule(localctx, 172, SolidCashParser.RULE_requireStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2071;
			this.match(SolidCashParser.T__40);
			this.state = 2072;
			this.match(SolidCashParser.T__56);
			this.state = 2073;
			this.expression(0);
			this.state = 2076;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2074;
				this.match(SolidCashParser.T__4);
				this.state = 2075;
				this.requireMessage();
				}
			}

			this.state = 2078;
			this.match(SolidCashParser.T__57);
			this.state = 2079;
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
		this.enterRule(localctx, 174, SolidCashParser.RULE_ifStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2081;
			this.match(SolidCashParser.T__97);
			this.state = 2082;
			this.match(SolidCashParser.T__56);
			this.state = 2083;
			this.expression(0);
			this.state = 2084;
			this.match(SolidCashParser.T__57);
			this.state = 2085;
			localctx._ifBlock = this.block();
			this.state = 2088;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 248, this._ctx) ) {
			case 1:
				{
				this.state = 2086;
				this.match(SolidCashParser.T__98);
				this.state = 2087;
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
		this.enterRule(localctx, 176, SolidCashParser.RULE_loopStatement);
		try {
			this.state = 2097;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 249, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2090;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2091;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2092;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2093;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2094;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2095;
				this.forOfStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2096;
				this.forWindowStatement();
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 178, SolidCashParser.RULE_forOfEntriesStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2099;
			this.match(SolidCashParser.T__10);
			this.state = 2100;
			this.match(SolidCashParser.T__56);
			this.state = 2101;
			this.typeName();
			this.state = 2102;
			this.match(SolidCashParser.Identifier);
			this.state = 2103;
			this.match(SolidCashParser.T__4);
			this.state = 2104;
			this.typeName();
			this.state = 2105;
			this.match(SolidCashParser.Identifier);
			this.state = 2106;
			this.match(SolidCashParser.T__99);
			this.state = 2107;
			this.match(SolidCashParser.T__41);
			this.state = 2108;
			this.match(SolidCashParser.T__6);
			this.state = 2109;
			this.match(SolidCashParser.Identifier);
			this.state = 2110;
			this.match(SolidCashParser.T__6);
			this.state = 2111;
			this.match(SolidCashParser.T__32);
			this.state = 2112;
			this.match(SolidCashParser.T__57);
			this.state = 2113;
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
		this.enterRule(localctx, 180, SolidCashParser.RULE_forInStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2115;
			this.match(SolidCashParser.T__10);
			this.state = 2116;
			this.match(SolidCashParser.T__56);
			this.state = 2117;
			this.typeName();
			this.state = 2118;
			this.match(SolidCashParser.Identifier);
			this.state = 2119;
			this.match(SolidCashParser.T__100);
			this.state = 2120;
			this.match(SolidCashParser.T__41);
			this.state = 2121;
			this.match(SolidCashParser.T__6);
			this.state = 2122;
			this.match(SolidCashParser.Identifier);
			this.state = 2123;
			this.match(SolidCashParser.T__57);
			this.state = 2124;
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
		this.enterRule(localctx, 182, SolidCashParser.RULE_forOfStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2126;
			this.match(SolidCashParser.T__10);
			this.state = 2127;
			this.match(SolidCashParser.T__56);
			this.state = 2128;
			this.typeName();
			this.state = 2129;
			this.match(SolidCashParser.Identifier);
			this.state = 2130;
			this.match(SolidCashParser.T__99);
			this.state = 2131;
			this.match(SolidCashParser.T__41);
			this.state = 2132;
			this.match(SolidCashParser.T__6);
			this.state = 2133;
			this.match(SolidCashParser.Identifier);
			this.state = 2134;
			this.match(SolidCashParser.T__57);
			this.state = 2135;
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
	public forWindowStatement(): ForWindowStatementContext {
		let localctx: ForWindowStatementContext = new ForWindowStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 184, SolidCashParser.RULE_forWindowStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2137;
			this.match(SolidCashParser.T__10);
			this.state = 2138;
			this.match(SolidCashParser.T__56);
			this.state = 2139;
			this.typeName();
			this.state = 2140;
			this.match(SolidCashParser.Identifier);
			this.state = 2141;
			this.match(SolidCashParser.T__99);
			this.state = 2142;
			this.match(SolidCashParser.T__41);
			this.state = 2143;
			this.match(SolidCashParser.T__6);
			this.state = 2144;
			this.match(SolidCashParser.Identifier);
			this.state = 2145;
			this.match(SolidCashParser.T__6);
			this.state = 2146;
			this.match(SolidCashParser.T__101);
			this.state = 2147;
			this.match(SolidCashParser.T__56);
			this.state = 2148;
			this.match(SolidCashParser.Identifier);
			this.state = 2149;
			this.match(SolidCashParser.T__4);
			this.state = 2150;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 2151;
			this.match(SolidCashParser.T__57);
			this.state = 2152;
			this.match(SolidCashParser.T__57);
			this.state = 2153;
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
		this.enterRule(localctx, 186, SolidCashParser.RULE_forStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2155;
			this.match(SolidCashParser.T__10);
			this.state = 2156;
			this.match(SolidCashParser.T__56);
			this.state = 2157;
			this.forInit();
			this.state = 2158;
			this.forCondition();
			this.state = 2160;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 250, this._ctx) ) {
			case 1:
				{
				this.state = 2159;
				this.forUpdate();
				}
				break;
			}
			this.state = 2162;
			this.match(SolidCashParser.T__57);
			this.state = 2163;
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
		this.enterRule(localctx, 188, SolidCashParser.RULE_forInit);
		let _la: number;
		try {
			this.state = 2210;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 256, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2165;
				this.typeName();
				this.state = 2169;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===32 || _la===36 || _la===64 || ((((_la - 137)) & ~0x1F) === 0 && ((1 << (_la - 137)) & 15) !== 0)) {
					{
					{
					this.state = 2166;
					this.modifier();
					}
					}
					this.state = 2171;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 2172;
				this.match(SolidCashParser.Identifier);
				this.state = 2175;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 2173;
					this.match(SolidCashParser.T__47);
					this.state = 2174;
					this.expression(0);
					}
				}

				this.state = 2177;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2179;
				this.match(SolidCashParser.Identifier);
				this.state = 2180;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2181;
				this.expression(0);
				this.state = 2182;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2184;
				this.match(SolidCashParser.T__56);
				this.state = 2185;
				this.tupleSlot();
				this.state = 2188;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2186;
					this.match(SolidCashParser.T__4);
					this.state = 2187;
					this.tupleSlot();
					}
					}
					this.state = 2190;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2192;
				this.match(SolidCashParser.T__57);
				this.state = 2193;
				this.match(SolidCashParser.T__47);
				this.state = 2205;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 255, this._ctx) ) {
				case 1:
					{
					this.state = 2194;
					this.match(SolidCashParser.T__56);
					this.state = 2195;
					this.expression(0);
					this.state = 2198;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 2196;
						this.match(SolidCashParser.T__4);
						this.state = 2197;
						this.expression(0);
						}
						}
						this.state = 2200;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===5);
					this.state = 2202;
					this.match(SolidCashParser.T__57);
					}
					break;
				case 2:
					{
					this.state = 2204;
					this.expression(0);
					}
					break;
				}
				this.state = 2207;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2209;
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
		this.enterRule(localctx, 190, SolidCashParser.RULE_forCondition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2213;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 257, this._ctx) ) {
			case 1:
				{
				this.state = 2212;
				this.expression(0);
				}
				break;
			}
			this.state = 2215;
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
		this.enterRule(localctx, 192, SolidCashParser.RULE_forUpdate);
		let _la: number;
		try {
			this.state = 2248;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 261, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2217;
				this.match(SolidCashParser.Identifier);
				this.state = 2218;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2219;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2220;
				this.match(SolidCashParser.Identifier);
				this.state = 2221;
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
				this.state = 2222;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===93 || _la===94)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2223;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2224;
				this.match(SolidCashParser.T__56);
				this.state = 2225;
				this.tupleSlot();
				this.state = 2228;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2226;
					this.match(SolidCashParser.T__4);
					this.state = 2227;
					this.tupleSlot();
					}
					}
					this.state = 2230;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2232;
				this.match(SolidCashParser.T__57);
				this.state = 2233;
				this.match(SolidCashParser.T__47);
				this.state = 2245;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 260, this._ctx) ) {
				case 1:
					{
					this.state = 2234;
					this.match(SolidCashParser.T__56);
					this.state = 2235;
					this.expression(0);
					this.state = 2238;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 2236;
						this.match(SolidCashParser.T__4);
						this.state = 2237;
						this.expression(0);
						}
						}
						this.state = 2240;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===5);
					this.state = 2242;
					this.match(SolidCashParser.T__57);
					}
					break;
				case 2:
					{
					this.state = 2244;
					this.expression(0);
					}
					break;
				}
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2247;
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
		this.enterRule(localctx, 194, SolidCashParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2250;
			this.match(SolidCashParser.T__102);
			this.state = 2251;
			this.block();
			this.state = 2252;
			this.match(SolidCashParser.T__103);
			this.state = 2253;
			this.match(SolidCashParser.T__56);
			this.state = 2254;
			this.expression(0);
			this.state = 2255;
			this.match(SolidCashParser.T__57);
			this.state = 2256;
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
		this.enterRule(localctx, 196, SolidCashParser.RULE_whileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2258;
			this.match(SolidCashParser.T__103);
			this.state = 2259;
			this.match(SolidCashParser.T__56);
			this.state = 2260;
			this.expression(0);
			this.state = 2261;
			this.match(SolidCashParser.T__57);
			this.state = 2262;
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
		this.enterRule(localctx, 198, SolidCashParser.RULE_consoleStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2264;
			this.match(SolidCashParser.T__104);
			this.state = 2266;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===181) {
				{
				this.state = 2265;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 2268;
			this.consoleParameterList();
			this.state = 2269;
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
		this.enterRule(localctx, 200, SolidCashParser.RULE_assemblyStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2271;
			this.match(SolidCashParser.T__105);
			this.state = 2273;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===152) {
				{
				this.state = 2272;
				this.match(SolidCashParser.StringLiteral);
				}
			}

			this.state = 2285;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===57) {
				{
				this.state = 2275;
				this.match(SolidCashParser.T__56);
				this.state = 2276;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2281;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 2277;
					this.match(SolidCashParser.T__4);
					this.state = 2278;
					this.match(SolidCashParser.StringLiteral);
					}
					}
					this.state = 2283;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 2284;
				this.match(SolidCashParser.T__57);
				}
			}

			this.state = 2287;
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
		this.enterRule(localctx, 202, SolidCashParser.RULE_yulBlock);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2289;
			this.match(SolidCashParser.T__3);
			this.state = 2293;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 266, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2290;
					this.yulStatement();
					}
					}
				}
				this.state = 2295;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 266, this._ctx);
			}
			this.state = 2296;
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
		this.enterRule(localctx, 204, SolidCashParser.RULE_yulStatement);
		try {
			this.state = 2311;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 267, this._ctx) ) {
			case 1:
				localctx = new YulNestedBlockStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2298;
				this.yulBlock();
				}
				break;
			case 2:
				localctx = new YulVarDeclStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2299;
				this.yulVariableDeclaration();
				}
				break;
			case 3:
				localctx = new YulAssignStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2300;
				this.yulAssignment();
				}
				break;
			case 4:
				localctx = new YulIfStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2301;
				this.yulIf();
				}
				break;
			case 5:
				localctx = new YulSwitchStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2302;
				this.yulSwitch();
				}
				break;
			case 6:
				localctx = new YulForStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2303;
				this.yulForLoop();
				}
				break;
			case 7:
				localctx = new YulFunctionDefStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2304;
				this.yulFunctionDefinition();
				}
				break;
			case 8:
				localctx = new YulBreakStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2305;
				this.match(SolidCashParser.T__106);
				}
				break;
			case 9:
				localctx = new YulContinueStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2306;
				this.match(SolidCashParser.T__107);
				}
				break;
			case 10:
				localctx = new YulLeaveStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2307;
				this.match(SolidCashParser.T__36);
				}
				break;
			case 11:
				localctx = new YulCallStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2308;
				this.yulFunctionCall();
				}
				break;
			case 12:
				localctx = new YulPathStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2309;
				this.yulPath();
				}
				break;
			case 13:
				localctx = new YulLiteralStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2310;
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
		this.enterRule(localctx, 206, SolidCashParser.RULE_yulVariableDeclaration);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2313;
			this.match(SolidCashParser.T__108);
			this.state = 2314;
			this.yulIdentifier();
			this.state = 2319;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 268, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2315;
					this.match(SolidCashParser.T__4);
					this.state = 2316;
					this.yulIdentifier();
					}
					}
				}
				this.state = 2321;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 268, this._ctx);
			}
			this.state = 2324;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 269, this._ctx) ) {
			case 1:
				{
				this.state = 2322;
				this.match(SolidCashParser.T__109);
				this.state = 2323;
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
		this.enterRule(localctx, 208, SolidCashParser.RULE_yulAssignment);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2326;
			this.yulPath();
			this.state = 2331;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 2327;
				this.match(SolidCashParser.T__4);
				this.state = 2328;
				this.yulPath();
				}
				}
				this.state = 2333;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 2334;
			this.match(SolidCashParser.T__109);
			this.state = 2335;
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
		this.enterRule(localctx, 210, SolidCashParser.RULE_yulIf);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2337;
			this.match(SolidCashParser.T__97);
			this.state = 2338;
			this.yulExpression();
			this.state = 2339;
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
		this.enterRule(localctx, 212, SolidCashParser.RULE_yulSwitch);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2341;
			this.match(SolidCashParser.T__110);
			this.state = 2342;
			this.yulExpression();
			this.state = 2352;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 112:
				{
				this.state = 2344;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2343;
						this.yulCase();
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2346;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 271, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				this.state = 2349;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 272, this._ctx) ) {
				case 1:
					{
					this.state = 2348;
					this.yulDefault();
					}
					break;
				}
				}
				break;
			case 113:
				{
				this.state = 2351;
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
		this.enterRule(localctx, 214, SolidCashParser.RULE_yulCase);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2354;
			this.match(SolidCashParser.T__111);
			this.state = 2355;
			this.yulLiteral();
			this.state = 2356;
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
		this.enterRule(localctx, 216, SolidCashParser.RULE_yulDefault);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2358;
			this.match(SolidCashParser.T__112);
			this.state = 2359;
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
		this.enterRule(localctx, 218, SolidCashParser.RULE_yulForLoop);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2361;
			this.match(SolidCashParser.T__10);
			this.state = 2362;
			this.yulBlock();
			this.state = 2363;
			this.yulExpression();
			this.state = 2364;
			this.yulBlock();
			this.state = 2365;
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
		this.enterRule(localctx, 220, SolidCashParser.RULE_yulFunctionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2367;
			this.match(SolidCashParser.T__8);
			this.state = 2368;
			this.yulIdentifier();
			this.state = 2369;
			this.match(SolidCashParser.T__56);
			this.state = 2378;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 275, this._ctx) ) {
			case 1:
				{
				this.state = 2370;
				this.yulIdentifier();
				this.state = 2375;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 2371;
					this.match(SolidCashParser.T__4);
					this.state = 2372;
					this.yulIdentifier();
					}
					}
					this.state = 2377;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			}
			this.state = 2380;
			this.match(SolidCashParser.T__57);
			this.state = 2390;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===114) {
				{
				this.state = 2381;
				this.match(SolidCashParser.T__113);
				this.state = 2382;
				this.yulIdentifier();
				this.state = 2387;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 2383;
					this.match(SolidCashParser.T__4);
					this.state = 2384;
					this.yulIdentifier();
					}
					}
					this.state = 2389;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 2392;
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
		this.enterRule(localctx, 222, SolidCashParser.RULE_yulExpression);
		try {
			this.state = 2397;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 278, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2394;
				this.yulFunctionCall();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2395;
				this.yulPath();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2396;
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
		this.enterRule(localctx, 224, SolidCashParser.RULE_yulFunctionCall);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2399;
			this.yulFunctionName();
			this.state = 2400;
			this.match(SolidCashParser.T__56);
			this.state = 2409;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 280, this._ctx) ) {
			case 1:
				{
				this.state = 2401;
				this.yulExpression();
				this.state = 2406;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 2402;
					this.match(SolidCashParser.T__4);
					this.state = 2403;
					this.yulExpression();
					}
					}
					this.state = 2408;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			}
			this.state = 2411;
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
		this.enterRule(localctx, 226, SolidCashParser.RULE_yulFunctionName);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2413;
			_la = this._input.LA(1);
			if(!(_la===30 || _la===35 || _la===91 || _la===95 || _la===150 || _la===181)) {
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
	public yulIdentifier(): YulIdentifierContext {
		let localctx: YulIdentifierContext = new YulIdentifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 228, SolidCashParser.RULE_yulIdentifier);
		try {
			this.state = 2418;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 281, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2415;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2416;
				if (!(this.isYulSolidityKeyword(this._input.LT(1).text ?? ''))) {
					throw this.createFailedPredicateException("this.isYulSolidityKeyword(this._input.LT(1).text ?? '')");
				}
				this.state = 2417;
				this.matchWildcard();
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 230, SolidCashParser.RULE_yulPath);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2420;
			this.yulIdentifier();
			this.state = 2428;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 283, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					this.state = 2426;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 282, this._ctx) ) {
					case 1:
						{
						this.state = 2421;
						this.match(SolidCashParser.T__6);
						this.state = 2422;
						this.yulIdentifier();
						}
						break;
					case 2:
						{
						this.state = 2423;
						this.match(SolidCashParser.DotLength);
						}
						break;
					case 3:
						{
						this.state = 2424;
						this.match(SolidCashParser.T__6);
						this.state = 2425;
						this.match(SolidCashParser.T__90);
						}
						break;
					}
					}
				}
				this.state = 2430;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 283, this._ctx);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 232, SolidCashParser.RULE_yulLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2431;
			_la = this._input.LA(1);
			if(!(((((_la - 142)) & ~0x1F) === 0 && ((1 << (_la - 142)) & 2102289) !== 0))) {
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
		this.enterRule(localctx, 234, SolidCashParser.RULE_uncheckedStatement);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2433;
			this.match(SolidCashParser.T__114);
			this.state = 2434;
			this.match(SolidCashParser.T__3);
			this.state = 2438;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 284, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2435;
					this.statement();
					}
					}
				}
				this.state = 2440;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 284, this._ctx);
			}
			this.state = 2441;
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
		this.enterRule(localctx, 236, SolidCashParser.RULE_switchStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2443;
			this.match(SolidCashParser.T__110);
			this.state = 2444;
			this.match(SolidCashParser.T__56);
			this.state = 2445;
			this.expression(0);
			this.state = 2446;
			this.match(SolidCashParser.T__57);
			this.state = 2447;
			this.match(SolidCashParser.T__3);
			this.state = 2451;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===112) {
				{
				{
				this.state = 2448;
				this.switchCase();
				}
				}
				this.state = 2453;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 2455;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===113) {
				{
				this.state = 2454;
				this.switchDefault();
				}
			}

			this.state = 2457;
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
		this.enterRule(localctx, 238, SolidCashParser.RULE_switchCase);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2459;
			this.match(SolidCashParser.T__111);
			this.state = 2460;
			this.expression(0);
			this.state = 2461;
			this.match(SolidCashParser.T__115);
			this.state = 2465;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 287, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2462;
					this.statement();
					}
					}
				}
				this.state = 2467;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 287, this._ctx);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 240, SolidCashParser.RULE_switchDefault);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2468;
			this.match(SolidCashParser.T__112);
			this.state = 2469;
			this.match(SolidCashParser.T__115);
			this.state = 2473;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 288, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2470;
					this.statement();
					}
					}
				}
				this.state = 2475;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 288, this._ctx);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 242, SolidCashParser.RULE_tryCatchStatement);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2476;
			this.match(SolidCashParser.T__116);
			this.state = 2477;
			this.expression(0);
			this.state = 2479;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 289, this._ctx) ) {
			case 1:
				{
				this.state = 2478;
				this.tryReturns();
				}
				break;
			}
			this.state = 2481;
			localctx._tryBlock = this.block();
			this.state = 2483;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 2482;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 2485;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 290, this._ctx);
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
		this.enterRule(localctx, 244, SolidCashParser.RULE_tryReturns);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2487;
			this.match(SolidCashParser.T__87);
			this.state = 2488;
			this.match(SolidCashParser.T__56);
			this.state = 2500;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===9 || _la===34 || ((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 3585) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 15375) !== 0) || _la===181) {
				{
				this.state = 2489;
				this.parameter();
				this.state = 2494;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 291, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2490;
						this.match(SolidCashParser.T__4);
						this.state = 2491;
						this.parameter();
						}
						}
					}
					this.state = 2496;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 291, this._ctx);
				}
				this.state = 2498;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2497;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2502;
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
		this.enterRule(localctx, 246, SolidCashParser.RULE_catchClause);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2504;
			this.match(SolidCashParser.T__117);
			this.state = 2506;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 294, this._ctx) ) {
			case 1:
				{
				this.state = 2505;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 2523;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 298, this._ctx) ) {
			case 1:
				{
				this.state = 2508;
				this.match(SolidCashParser.T__56);
				this.state = 2520;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===9 || _la===34 || ((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 3585) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 15375) !== 0) || _la===181) {
					{
					this.state = 2509;
					this.parameter();
					this.state = 2514;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 295, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2510;
							this.match(SolidCashParser.T__4);
							this.state = 2511;
							this.parameter();
							}
							}
						}
						this.state = 2516;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 295, this._ctx);
					}
					this.state = 2518;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2517;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2522;
				this.match(SolidCashParser.T__57);
				}
				break;
			}
			this.state = 2525;
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
		this.enterRule(localctx, 248, SolidCashParser.RULE_breakStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2527;
			this.match(SolidCashParser.T__106);
			this.state = 2528;
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
		this.enterRule(localctx, 250, SolidCashParser.RULE_continueStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2530;
			this.match(SolidCashParser.T__107);
			this.state = 2531;
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
		this.enterRule(localctx, 252, SolidCashParser.RULE_requireMessage);
		try {
			this.state = 2537;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 299, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2533;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2534;
				this.match(SolidCashParser.Identifier);
				this.state = 2535;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2536;
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
		this.enterRule(localctx, 254, SolidCashParser.RULE_revertStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 2583;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 305, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2539;
				this.match(SolidCashParser.T__34);
				this.state = 2540;
				this.anyIdentifier();
				this.state = 2543;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7) {
					{
					this.state = 2541;
					this.match(SolidCashParser.T__6);
					this.state = 2542;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 2545;
				this.match(SolidCashParser.T__56);
				this.state = 2546;
				this.match(SolidCashParser.T__3);
				this.state = 2558;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===181) {
					{
					this.state = 2547;
					this.namedArg();
					this.state = 2552;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 301, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2548;
							this.match(SolidCashParser.T__4);
							this.state = 2549;
							this.namedArg();
							}
							}
						}
						this.state = 2554;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 301, this._ctx);
					}
					this.state = 2556;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2555;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2560;
				this.match(SolidCashParser.T__5);
				this.state = 2561;
				this.match(SolidCashParser.T__57);
				this.state = 2562;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2564;
				this.match(SolidCashParser.T__34);
				this.state = 2565;
				this.anyIdentifier();
				this.state = 2568;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7) {
					{
					this.state = 2566;
					this.match(SolidCashParser.T__6);
					this.state = 2567;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 2570;
				this.expressionList();
				this.state = 2571;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2573;
				this.match(SolidCashParser.T__34);
				this.state = 2574;
				this.match(SolidCashParser.T__56);
				this.state = 2575;
				this.expression(0);
				this.state = 2576;
				this.match(SolidCashParser.T__57);
				this.state = 2577;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2579;
				this.match(SolidCashParser.T__34);
				this.state = 2580;
				this.match(SolidCashParser.T__56);
				this.state = 2581;
				this.match(SolidCashParser.T__57);
				this.state = 2582;
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
		this.enterRule(localctx, 256, SolidCashParser.RULE_assertStatement);
		try {
			this.state = 2593;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 306, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2585;
				this.match(SolidCashParser.T__118);
				this.state = 2586;
				this.match(SolidCashParser.T__56);
				this.state = 2587;
				this.expression(0);
				this.state = 2588;
				this.match(SolidCashParser.T__57);
				this.state = 2589;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2591;
				this.match(SolidCashParser.T__118);
				this.state = 2592;
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
	public consoleParameter(): ConsoleParameterContext {
		let localctx: ConsoleParameterContext = new ConsoleParameterContext(this, this._ctx, this.state);
		this.enterRule(localctx, 258, SolidCashParser.RULE_consoleParameter);
		try {
			this.state = 2597;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 181:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2595;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 142:
			case 145:
			case 146:
			case 152:
			case 153:
			case 154:
			case 162:
			case 163:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2596;
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
		this.enterRule(localctx, 260, SolidCashParser.RULE_consoleParameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2599;
			this.match(SolidCashParser.T__56);
			this.state = 2611;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 142)) & ~0x1F) === 0 && ((1 << (_la - 142)) & 3152921) !== 0) || _la===181) {
				{
				this.state = 2600;
				this.consoleParameter();
				this.state = 2605;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 308, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2601;
						this.match(SolidCashParser.T__4);
						this.state = 2602;
						this.consoleParameter();
						}
						}
					}
					this.state = 2607;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 308, this._ctx);
				}
				this.state = 2609;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2608;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2613;
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
		this.enterRule(localctx, 262, SolidCashParser.RULE_functionCall);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2615;
			if (!(this.hasFunctionCallAhead())) {
				throw this.createFailedPredicateException("this.hasFunctionCallAhead()");
			}
			this.state = 2680;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 317, this._ctx) ) {
			case 1:
				{
				this.state = 2616;
				this.match(SolidCashParser.Identifier);
				this.state = 2617;
				this.expressionList();
				}
				break;
			case 2:
				{
				this.state = 2618;
				this.match(SolidCashParser.T__30);
				this.state = 2619;
				this.expressionList();
				}
				break;
			case 3:
				{
				this.state = 2620;
				this.match(SolidCashParser.Identifier);
				this.state = 2621;
				this.callOptions();
				this.state = 2622;
				this.expressionList();
				}
				break;
			case 4:
				{
				this.state = 2624;
				this.match(SolidCashParser.T__42);
				this.state = 2625;
				this.expressionList();
				}
				break;
			case 5:
				{
				this.state = 2626;
				this.match(SolidCashParser.Identifier);
				this.state = 2627;
				this.match(SolidCashParser.T__6);
				this.state = 2628;
				this.match(SolidCashParser.Identifier);
				this.state = 2629;
				this.expressionList();
				}
				break;
			case 6:
				{
				this.state = 2630;
				this.match(SolidCashParser.Identifier);
				this.state = 2631;
				this.match(SolidCashParser.T__56);
				this.state = 2632;
				this.match(SolidCashParser.T__3);
				this.state = 2644;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===181) {
					{
					this.state = 2633;
					this.namedArg();
					this.state = 2638;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 311, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2634;
							this.match(SolidCashParser.T__4);
							this.state = 2635;
							this.namedArg();
							}
							}
						}
						this.state = 2640;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 311, this._ctx);
					}
					this.state = 2642;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2641;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2646;
				this.match(SolidCashParser.T__5);
				this.state = 2647;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 7:
				{
				this.state = 2648;
				this.match(SolidCashParser.T__56);
				this.state = 2649;
				this.match(SolidCashParser.Identifier);
				this.state = 2650;
				this.match(SolidCashParser.T__57);
				this.state = 2651;
				this.expressionList();
				}
				break;
			case 8:
				{
				this.state = 2652;
				this.match(SolidCashParser.T__56);
				this.state = 2653;
				this.match(SolidCashParser.Identifier);
				this.state = 2654;
				this.match(SolidCashParser.T__6);
				this.state = 2655;
				this.match(SolidCashParser.Identifier);
				this.state = 2656;
				this.match(SolidCashParser.T__57);
				this.state = 2657;
				this.expressionList();
				}
				break;
			case 9:
				{
				this.state = 2658;
				this.match(SolidCashParser.T__56);
				this.state = 2659;
				this.match(SolidCashParser.Identifier);
				this.state = 2660;
				this.match(SolidCashParser.T__6);
				this.state = 2661;
				this.match(SolidCashParser.Identifier);
				this.state = 2662;
				this.match(SolidCashParser.T__57);
				this.state = 2663;
				this.match(SolidCashParser.T__56);
				this.state = 2664;
				this.match(SolidCashParser.T__3);
				this.state = 2676;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===181) {
					{
					this.state = 2665;
					this.namedArg();
					this.state = 2670;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 314, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2666;
							this.match(SolidCashParser.T__4);
							this.state = 2667;
							this.namedArg();
							}
							}
						}
						this.state = 2672;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 314, this._ctx);
					}
					this.state = 2674;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2673;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2678;
				this.match(SolidCashParser.T__5);
				this.state = 2679;
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
	public namedArg(): NamedArgContext {
		let localctx: NamedArgContext = new NamedArgContext(this, this._ctx, this.state);
		this.enterRule(localctx, 264, SolidCashParser.RULE_namedArg);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2682;
			this.match(SolidCashParser.Identifier);
			this.state = 2683;
			this.match(SolidCashParser.T__115);
			this.state = 2684;
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
		this.enterRule(localctx, 266, SolidCashParser.RULE_expressionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2686;
			this.match(SolidCashParser.T__56);
			this.state = 2698;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 320, this._ctx) ) {
			case 1:
				{
				this.state = 2687;
				this.callArgument();
				this.state = 2692;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 318, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2688;
						this.match(SolidCashParser.T__4);
						this.state = 2689;
						this.callArgument();
						}
						}
					}
					this.state = 2694;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 318, this._ctx);
				}
				this.state = 2696;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2695;
					this.match(SolidCashParser.T__4);
					}
				}

				}
				break;
			}
			this.state = 2700;
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
		this.enterRule(localctx, 268, SolidCashParser.RULE_callArgument);
		let _la: number;
		try {
			this.state = 2711;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 322, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2702;
				localctx._pushBase = this.match(SolidCashParser.Identifier);
				this.state = 2703;
				this.match(SolidCashParser.DotPush);
				this.state = 2704;
				this.match(SolidCashParser.T__56);
				this.state = 2705;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2706;
				this.expression(0);
				this.state = 2709;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0)) {
					{
					this.state = 2707;
					localctx._aop = this._input.LT(1);
					_la = this._input.LA(1);
					if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
					    localctx._aop = this._errHandler.recoverInline(this);
					}
					else {
						this._errHandler.reportMatch(this);
					    this.consume();
					}
					this.state = 2708;
					this.assignChain();
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
	public callOptions(): CallOptionsContext {
		let localctx: CallOptionsContext = new CallOptionsContext(this, this._ctx, this.state);
		this.enterRule(localctx, 270, SolidCashParser.RULE_callOptions);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2713;
			this.match(SolidCashParser.T__3);
			this.state = 2714;
			this.callOption();
			this.state = 2719;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 323, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2715;
					this.match(SolidCashParser.T__4);
					this.state = 2716;
					this.callOption();
					}
					}
				}
				this.state = 2721;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 323, this._ctx);
			}
			this.state = 2723;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2722;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 2725;
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
		this.enterRule(localctx, 272, SolidCashParser.RULE_callOption);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2727;
			this.match(SolidCashParser.Identifier);
			this.state = 2728;
			this.match(SolidCashParser.T__115);
			this.state = 2729;
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
		this.enterRule(localctx, 274, SolidCashParser.RULE_typeList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2731;
			this.match(SolidCashParser.T__56);
			this.state = 2743;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===9 || _la===34 || _la===57 || ((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 3585) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 15375) !== 0) || _la===181) {
				{
				this.state = 2732;
				this.typeListItem();
				this.state = 2737;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 325, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2733;
						this.match(SolidCashParser.T__4);
						this.state = 2734;
						this.typeListItem();
						}
						}
					}
					this.state = 2739;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 325, this._ctx);
				}
				this.state = 2741;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2740;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2745;
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
		this.enterRule(localctx, 276, SolidCashParser.RULE_typeListItem);
		let _la: number;
		try {
			this.state = 2762;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 330, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2747;
				this.typeName();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2748;
				this.arrayType(0);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2749;
				this.match(SolidCashParser.T__56);
				this.state = 2750;
				this.typeListItem();
				this.state = 2751;
				this.match(SolidCashParser.T__57);
				this.state = 2759;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===82) {
					{
					{
					this.state = 2752;
					this.match(SolidCashParser.T__81);
					this.state = 2754;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 328, this._ctx) ) {
					case 1:
						{
						this.state = 2753;
						this.expression(0);
						}
						break;
					}
					this.state = 2756;
					this.match(SolidCashParser.T__82);
					}
					}
					this.state = 2761;
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
	// @RuleVersion(0)
	public parenExpression(): ParenExpressionContext {
		let localctx: ParenExpressionContext = new ParenExpressionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 278, SolidCashParser.RULE_parenExpression);
		let _la: number;
		try {
			this.state = 2798;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 332, this._ctx) ) {
			case 1:
				localctx = new AssignmentExpressionContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2764;
				this.match(SolidCashParser.T__56);
				this.state = 2765;
				this.match(SolidCashParser.Identifier);
				this.state = 2766;
				(localctx as AssignmentExpressionContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
				    (localctx as AssignmentExpressionContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2767;
				this.expression(0);
				this.state = 2768;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 2:
				localctx = new InstantiationWithOptionsContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2770;
				this.match(SolidCashParser.T__56);
				this.state = 2771;
				this.match(SolidCashParser.T__91);
				this.state = 2772;
				this.match(SolidCashParser.Identifier);
				this.state = 2773;
				this.match(SolidCashParser.T__57);
				this.state = 2774;
				this.callOptions();
				this.state = 2775;
				this.expressionList();
				}
				break;
			case 3:
				localctx = new TupleExpressionContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2777;
				this.match(SolidCashParser.T__56);
				this.state = 2778;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 4:
				localctx = new TupleExpressionContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2779;
				this.match(SolidCashParser.T__56);
				this.state = 2780;
				this.expression(0);
				this.state = 2783;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2781;
					this.match(SolidCashParser.T__4);
					this.state = 2782;
					this.expression(0);
					}
					}
					this.state = 2785;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2787;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 5:
				localctx = new ParenthesizedFunctionCallContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2789;
				this.match(SolidCashParser.T__56);
				this.state = 2790;
				this.expression(0);
				this.state = 2791;
				this.match(SolidCashParser.T__57);
				this.state = 2792;
				this.expressionList();
				}
				break;
			case 6:
				localctx = new ParenthesisedContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2794;
				this.match(SolidCashParser.T__56);
				this.state = 2795;
				this.expression(0);
				this.state = 2796;
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
	public newExpression(): NewExpressionContext {
		let localctx: NewExpressionContext = new NewExpressionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 280, SolidCashParser.RULE_newExpression);
		let _la: number;
		try {
			this.state = 2833;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 336, this._ctx) ) {
			case 1:
				localctx = new InstantiationContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2800;
				this.match(SolidCashParser.T__91);
				this.state = 2801;
				this.match(SolidCashParser.Identifier);
				this.state = 2803;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 2802;
					this.callOptions();
					}
				}

				this.state = 2805;
				this.expressionList();
				}
				break;
			case 2:
				localctx = new NewArrayContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2806;
				this.match(SolidCashParser.T__91);
				this.state = 2807;
				this.typeName();
				this.state = 2813;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2808;
					this.match(SolidCashParser.T__81);
					this.state = 2810;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===146) {
						{
						this.state = 2809;
						this.match(SolidCashParser.NumberLiteral);
						}
					}

					this.state = 2812;
					this.match(SolidCashParser.T__82);
					}
					}
					this.state = 2815;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===82);
				this.state = 2817;
				this.match(SolidCashParser.T__56);
				this.state = 2818;
				this.expression(0);
				this.state = 2819;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 3:
				localctx = new NewDynamicBytesContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2821;
				this.match(SolidCashParser.T__91);
				this.state = 2822;
				this.match(SolidCashParser.UnboundedBytes);
				this.state = 2823;
				this.match(SolidCashParser.T__56);
				this.state = 2824;
				this.expression(0);
				this.state = 2825;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 4:
				localctx = new NewDynamicStringContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2827;
				this.match(SolidCashParser.T__91);
				this.state = 2828;
				this.match(SolidCashParser.PrimitiveType);
				this.state = 2829;
				this.match(SolidCashParser.T__56);
				this.state = 2830;
				this.expression(0);
				this.state = 2831;
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
		let _startState: number = 282;
		this.enterRecursionRule(localctx, 282, SolidCashParser.RULE_expression, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2950;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 345, this._ctx) ) {
			case 1:
				{
				localctx = new GroupedExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 2836;
				this.parenExpression();
				}
				break;
			case 2:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2837;
				this.arrayCastType();
				this.state = 2838;
				this.match(SolidCashParser.T__56);
				this.state = 2839;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 2841;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2840;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 2843;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 3:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2845;
				this.functionCall();
				this.state = 2849;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 338, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2846;
						this.expressionList();
						}
						}
					}
					this.state = 2851;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 338, this._ctx);
				}
				}
				break;
			case 4:
				{
				localctx = new ConstructedExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2852;
				this.newExpression();
				}
				break;
			case 5:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2853;
				this.typeIntrospectionBase();
				this.state = 2854;
				this.match(SolidCashParser.T__6);
				this.state = 2855;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 6:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2857;
				_la = this._input.LA(1);
				if(!(((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 15) !== 0))) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2858;
				this.expressionList();
				}
				break;
			case 7:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2859;
				this.match(SolidCashParser.T__123);
				this.state = 2860;
				this.match(SolidCashParser.T__56);
				this.state = 2872;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 339, this._ctx) ) {
				case 1:
					{
					this.state = 2861;
					_la = this._input.LA(1);
					if(!(_la===42 || _la===181)) {
					this._errHandler.recoverInline(this);
					}
					else {
						this._errHandler.reportMatch(this);
					    this.consume();
					}
					this.state = 2862;
					this.match(SolidCashParser.T__6);
					this.state = 2863;
					this.match(SolidCashParser.Identifier);
					}
					break;
				case 2:
					{
					this.state = 2864;
					this.match(SolidCashParser.Identifier);
					this.state = 2865;
					this.match(SolidCashParser.T__81);
					this.state = 2866;
					this.match(SolidCashParser.NumberLiteral);
					this.state = 2867;
					this.match(SolidCashParser.T__82);
					}
					break;
				case 3:
					{
					this.state = 2868;
					this.match(SolidCashParser.Identifier);
					}
					break;
				case 4:
					{
					this.state = 2869;
					this.match(SolidCashParser.Identifier);
					this.state = 2870;
					this.match(SolidCashParser.T__56);
					this.state = 2871;
					this.match(SolidCashParser.T__57);
					}
					break;
				}
				this.state = 2874;
				this.match(SolidCashParser.T__4);
				this.state = 2875;
				this.abiEncodeCallArguments();
				this.state = 2876;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 8:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2878;
				_la = this._input.LA(1);
				if(!(_la===125 || _la===126)) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2879;
				this.expressionList();
				}
				break;
			case 9:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2880;
				this.match(SolidCashParser.T__126);
				this.state = 2881;
				this.match(SolidCashParser.T__56);
				this.state = 2882;
				this.expression(0);
				this.state = 2883;
				this.match(SolidCashParser.T__4);
				this.state = 2884;
				this.typeList();
				this.state = 2885;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 10:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2887;
				this.match(SolidCashParser.T__127);
				this.state = 2888;
				this.match(SolidCashParser.T__56);
				this.state = 2889;
				this.expression(0);
				this.state = 2890;
				this.match(SolidCashParser.T__4);
				this.state = 2891;
				this.typeList();
				this.state = 2892;
				this.match(SolidCashParser.T__4);
				this.state = 2893;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 2894;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 11:
				{
				localctx = new BareAbiReferenceExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2896;
				_la = this._input.LA(1);
				if(!(((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 287) !== 0))) {
				this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				break;
			case 12:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2897;
				(localctx as UnaryIntrospectionOpContext)._scope = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===129 || _la===130)) {
				    (localctx as UnaryIntrospectionOpContext)._scope = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2898;
				this.match(SolidCashParser.T__81);
				this.state = 2899;
				this.expression(0);
				this.state = 2900;
				this.match(SolidCashParser.T__82);
				this.state = 2901;
				(localctx as UnaryIntrospectionOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 164)) & ~0x1F) === 0 && ((1 << (_la - 164)) & 130561) !== 0))) {
				    (localctx as UnaryIntrospectionOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				break;
			case 13:
				{
				localctx = new PrefixOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2903;
				(localctx as PrefixOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===93 || _la===94)) {
				    (localctx as PrefixOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2904;
				this.expression(19);
				}
				break;
			case 14:
				{
				localctx = new UnaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2905;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===132)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2906;
				this.expression(18);
				}
				break;
			case 15:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2907;
				this.match(SolidCashParser.T__81);
				this.state = 2919;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 342, this._ctx) ) {
				case 1:
					{
					this.state = 2908;
					this.expression(0);
					this.state = 2913;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 340, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2909;
							this.match(SolidCashParser.T__4);
							this.state = 2910;
							this.expression(0);
							}
							}
						}
						this.state = 2915;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 340, this._ctx);
					}
					this.state = 2917;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2916;
						this.match(SolidCashParser.T__4);
						}
					}

					}
					break;
				}
				this.state = 2921;
				this.match(SolidCashParser.T__82);
				}
				break;
			case 16:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2922;
				this.match(SolidCashParser.T__41);
				this.state = 2945;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 344, this._ctx) ) {
				case 1:
					{
					this.state = 2923;
					this.match(SolidCashParser.T__6);
					this.state = 2924;
					this.match(SolidCashParser.Identifier);
					this.state = 2925;
					this.match(SolidCashParser.T__6);
					this.state = 2926;
					this.match(SolidCashParser.Identifier);
					this.state = 2927;
					this.match(SolidCashParser.T__81);
					this.state = 2928;
					this.expression(0);
					this.state = 2929;
					this.match(SolidCashParser.T__82);
					this.state = 2930;
					this.memberName();
					}
					break;
				case 2:
					{
					this.state = 2932;
					this.match(SolidCashParser.T__6);
					this.state = 2933;
					this.match(SolidCashParser.Identifier);
					this.state = 2938;
					this._errHandler.sync(this);
					_alt = 1;
					do {
						switch (_alt) {
						case 1:
							{
							{
							this.state = 2934;
							this.match(SolidCashParser.T__81);
							this.state = 2935;
							this.expression(0);
							this.state = 2936;
							this.match(SolidCashParser.T__82);
							}
							}
							break;
						default:
							throw new NoViableAltException(this);
						}
						this.state = 2940;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 343, this._ctx);
					} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
					}
					break;
				case 3:
					{
					this.state = 2942;
					this.match(SolidCashParser.T__6);
					this.state = 2943;
					this.match(SolidCashParser.Identifier);
					}
					break;
				case 4:
					// tslint:disable-next-line:no-empty
					{
					}
					break;
				}
				}
				break;
			case 17:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2947;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 18:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2948;
				this.anyIdentifier();
				}
				break;
			case 19:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2949;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 3102;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 361, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 3100;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 360, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2952;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 2953;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 2954;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2955;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 2956;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 98560) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2957;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2958;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2959;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2960;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2961;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2962;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===133 || _la===134)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2963;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2964;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2965;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2966;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2967;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2968;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2969;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2970;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2971;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2972;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2973;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2974;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2975;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2976;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 2977;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2978;
						(localctx as BinaryOpContext)._right = this.expression(10);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2979;
						if (!(this.precpred(this._ctx, 8))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 8)");
						}
						this.state = 2980;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__134);
						this.state = 2981;
						(localctx as BinaryOpContext)._right = this.expression(9);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2982;
						if (!(this.precpred(this._ctx, 7))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 7)");
						}
						this.state = 2983;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__46);
						this.state = 2984;
						(localctx as BinaryOpContext)._right = this.expression(8);
						}
						break;
					case 12:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as ArrayAccessContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2985;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 2986;
						this.match(SolidCashParser.T__81);
						this.state = 2996;
						this._errHandler.sync(this);
						switch ( this._interp.adaptivePredict(this._input, 348, this._ctx) ) {
						case 1:
							{
							this.state = 2988;
							this._errHandler.sync(this);
							switch ( this._interp.adaptivePredict(this._input, 346, this._ctx) ) {
							case 1:
								{
								this.state = 2987;
								(localctx as ArrayAccessContext)._start = this.expression(0);
								}
								break;
							}
							this.state = 2990;
							this.match(SolidCashParser.T__115);
							this.state = 2992;
							this._errHandler.sync(this);
							switch ( this._interp.adaptivePredict(this._input, 347, this._ctx) ) {
							case 1:
								{
								this.state = 2991;
								(localctx as ArrayAccessContext)._end = this.expression(0);
								}
								break;
							}
							}
							break;
						case 2:
							{
							this.state = 2994;
							(localctx as ArrayAccessContext)._index = this.match(SolidCashParser.NumberLiteral);
							}
							break;
						case 3:
							{
							this.state = 2995;
							this.expression(0);
							}
							break;
						}
						this.state = 2998;
						this.match(SolidCashParser.T__82);
						}
						break;
					case 13:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2999;
						if (!(this.precpred(this._ctx, 29))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 29)");
						}
						this.state = 3000;
						(localctx as UnaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===131 || _la===165)) {
						    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						}
						break;
					case 14:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3001;
						if (!(this.precpred(this._ctx, 28))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 28)");
						}
						this.state = 3002;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.DotSplit);
						this.state = 3003;
						this.match(SolidCashParser.T__56);
						this.state = 3004;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 3005;
						this.match(SolidCashParser.T__57);
						}
						break;
					case 15:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3007;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 3008;
						this.match(SolidCashParser.DotSlice);
						this.state = 3009;
						this.match(SolidCashParser.T__56);
						this.state = 3010;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 3011;
						this.match(SolidCashParser.T__4);
						this.state = 3012;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 3013;
						this.match(SolidCashParser.T__57);
						}
						break;
					case 16:
						{
						localctx = new LegacyCallOptionCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3015;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 3016;
						this.match(SolidCashParser.T__6);
						this.state = 3017;
						this.match(SolidCashParser.Identifier);
						this.state = 3021;
						this._errHandler.sync(this);
						switch (this._input.LA(1)) {
						case 7:
							{
							this.state = 3018;
							this.match(SolidCashParser.T__6);
							this.state = 3019;
							this.match(SolidCashParser.Identifier);
							}
							break;
						case 164:
							{
							this.state = 3020;
							this.match(SolidCashParser.DotValue);
							}
							break;
						default:
							throw new NoViableAltException(this);
						}
						this.state = 3023;
						this.match(SolidCashParser.T__56);
						this.state = 3024;
						this.expression(0);
						this.state = 3025;
						this.match(SolidCashParser.T__57);
						this.state = 3026;
						this.expressionList();
						}
						break;
					case 17:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3028;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 3029;
						this.match(SolidCashParser.T__6);
						this.state = 3030;
						this.match(SolidCashParser.Identifier);
						this.state = 3032;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 3031;
							this.callOptions();
							}
						}

						this.state = 3034;
						this.match(SolidCashParser.T__56);
						this.state = 3035;
						this.match(SolidCashParser.T__3);
						this.state = 3047;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===181) {
							{
							this.state = 3036;
							this.namedArg();
							this.state = 3041;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 351, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 3037;
									this.match(SolidCashParser.T__4);
									this.state = 3038;
									this.namedArg();
									}
									}
								}
								this.state = 3043;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 351, this._ctx);
							}
							this.state = 3045;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 3044;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 3049;
						this.match(SolidCashParser.T__5);
						this.state = 3050;
						this.match(SolidCashParser.T__57);
						}
						break;
					case 18:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3051;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 3056;
						this._errHandler.sync(this);
						switch (this._input.LA(1)) {
						case 165:
							{
							this.state = 3052;
							this.match(SolidCashParser.DotLength);
							}
							break;
						case 164:
							{
							this.state = 3053;
							this.match(SolidCashParser.DotValue);
							}
							break;
						case 7:
							{
							this.state = 3054;
							this.match(SolidCashParser.T__6);
							this.state = 3055;
							this.anyIdentifier();
							}
							break;
						default:
							throw new NoViableAltException(this);
						}
						this.state = 3059;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 3058;
							this.callOptions();
							}
						}

						this.state = 3061;
						this.expressionList();
						this.state = 3065;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 356, this._ctx);
						while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
							if (_alt === 1) {
								{
								{
								this.state = 3062;
								this.expressionList();
								}
								}
							}
							this.state = 3067;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 356, this._ctx);
						}
						}
						break;
					case 19:
						{
						localctx = new CallOptionsMemberContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3068;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 3069;
						this.match(SolidCashParser.T__6);
						this.state = 3070;
						this.match(SolidCashParser.Identifier);
						this.state = 3071;
						this.callOptions();
						this.state = 3072;
						this.memberName();
						}
						break;
					case 20:
						{
						localctx = new IndexedFunctionCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexedFunctionCallContext)._base = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3074;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 3075;
						this.match(SolidCashParser.T__81);
						this.state = 3076;
						(localctx as IndexedFunctionCallContext)._index = this.expression(0);
						this.state = 3077;
						this.match(SolidCashParser.T__82);
						this.state = 3079;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 3078;
							this.callOptions();
							}
						}

						this.state = 3081;
						this.expressionList();
						}
						break;
					case 21:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3083;
						if (!(this.precpred(this._ctx, 21))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 21)");
						}
						this.state = 3084;
						this.memberName();
						}
						break;
					case 22:
						{
						localctx = new PostfixOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3085;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 3086;
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
					case 23:
						{
						localctx = new TernaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as TernaryOpContext)._condition = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3087;
						if (!(this.precpred(this._ctx, 6))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 6)");
						}
						this.state = 3088;
						this.match(SolidCashParser.T__135);
						this.state = 3089;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 3092;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0)) {
							{
							this.state = 3090;
							(localctx as TernaryOpContext)._tOp = this._input.LT(1);
							_la = this._input.LA(1);
							if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
							    (localctx as TernaryOpContext)._tOp = this._errHandler.recoverInline(this);
							}
							else {
								this._errHandler.reportMatch(this);
							    this.consume();
							}
							this.state = 3091;
							(localctx as TernaryOpContext)._tVal = this.assignChain();
							}
						}

						this.state = 3094;
						this.match(SolidCashParser.T__115);
						this.state = 3095;
						(localctx as TernaryOpContext)._ifFalse = this.expression(0);
						this.state = 3098;
						this._errHandler.sync(this);
						switch ( this._interp.adaptivePredict(this._input, 359, this._ctx) ) {
						case 1:
							{
							this.state = 3096;
							(localctx as TernaryOpContext)._fOp = this._input.LT(1);
							_la = this._input.LA(1);
							if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
							    (localctx as TernaryOpContext)._fOp = this._errHandler.recoverInline(this);
							}
							else {
								this._errHandler.reportMatch(this);
							    this.consume();
							}
							this.state = 3097;
							(localctx as TernaryOpContext)._fVal = this.assignChain();
							}
							break;
						}
						}
						break;
					}
					}
				}
				this.state = 3104;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 361, this._ctx);
			}
			}
		}
		catch (re) {
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
		this.enterRule(localctx, 284, SolidCashParser.RULE_typeIntrospectionBase);
		try {
			this.state = 3117;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 63:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 3105;
				this.match(SolidCashParser.T__62);
				this.state = 3106;
				this.match(SolidCashParser.T__56);
				this.state = 3107;
				this.typeName();
				this.state = 3108;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 57:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 3110;
				this.match(SolidCashParser.T__56);
				this.state = 3111;
				this.match(SolidCashParser.T__62);
				this.state = 3112;
				this.match(SolidCashParser.T__56);
				this.state = 3113;
				this.typeName();
				this.state = 3114;
				this.match(SolidCashParser.T__57);
				this.state = 3115;
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
		this.enterRule(localctx, 286, SolidCashParser.RULE_abiEncodeCallArguments);
		try {
			this.state = 3127;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 363, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 3119;
				this.match(SolidCashParser.T__56);
				this.state = 3120;
				localctx._target = this.match(SolidCashParser.Identifier);
				this.state = 3121;
				this.match(SolidCashParser.T__57);
				this.state = 3122;
				localctx._aop = this.match(SolidCashParser.T__47);
				this.state = 3123;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 3124;
				this.expression(0);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 3125;
				this.match(SolidCashParser.T__56);
				this.state = 3126;
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
		this.enterRule(localctx, 288, SolidCashParser.RULE_bareAbiFunctionReferenceStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3129;
			_la = this._input.LA(1);
			if(!(((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 287) !== 0))) {
			this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			this.state = 3130;
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
		this.enterRule(localctx, 290, SolidCashParser.RULE_memberName);
		try {
			this.state = 3149;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 364, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 3132;
				this.match(SolidCashParser.T__6);
				this.state = 3133;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 3134;
				this.match(SolidCashParser.T__6);
				this.state = 3135;
				this.match(SolidCashParser.T__33);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 3136;
				this.match(SolidCashParser.T__6);
				this.state = 3137;
				this.match(SolidCashParser.T__90);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 3138;
				this.match(SolidCashParser.DotValue);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 3139;
				this.match(SolidCashParser.DotLockingBytecode);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 3140;
				this.match(SolidCashParser.DotTokenCategory);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 3141;
				this.match(SolidCashParser.DotNftCommitment);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 3142;
				this.match(SolidCashParser.DotTokenAmount);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 3143;
				this.match(SolidCashParser.DotOutpointTransactionHash);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 3144;
				this.match(SolidCashParser.DotOutpointIndex);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 3145;
				this.match(SolidCashParser.DotUnlockingBytecode);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 3146;
				this.match(SolidCashParser.DotSequenceNumber);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 3147;
				this.match(SolidCashParser.DotCode);
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 3148;
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
		this.enterRule(localctx, 292, SolidCashParser.RULE_modifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3151;
			_la = this._input.LA(1);
			if(!(_la===32 || _la===36 || _la===64 || ((((_la - 137)) & ~0x1F) === 0 && ((1 << (_la - 137)) & 15) !== 0))) {
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
		this.enterRule(localctx, 294, SolidCashParser.RULE_dataLocation);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3153;
			_la = this._input.LA(1);
			if(!(((((_la - 137)) & ~0x1F) === 0 && ((1 << (_la - 137)) & 7) !== 0))) {
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
		this.enterRule(localctx, 296, SolidCashParser.RULE_literal);
		try {
			let _alt: number;
			this.state = 3181;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 142:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 3155;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 146:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 3156;
				this.numberLiteral();
				}
				break;
			case 145:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 3157;
				this.decimalLiteral();
				}
				break;
			case 152:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 3158;
				this.match(SolidCashParser.StringLiteral);
				this.state = 3162;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 365, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 3159;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 3164;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 365, this._ctx);
				}
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 3165;
				this.match(SolidCashParser.UnicodeLiteral);
				this.state = 3169;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 366, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 3166;
						this.match(SolidCashParser.UnicodeLiteral);
						}
						}
					}
					this.state = 3171;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 366, this._ctx);
				}
				}
				break;
			case 163:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 3172;
				this.match(SolidCashParser.HexStringLiteral);
				this.state = 3176;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 367, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 3173;
						this.match(SolidCashParser.HexStringLiteral);
						}
						}
					}
					this.state = 3178;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 367, this._ctx);
				}
				}
				break;
			case 153:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 3179;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 154:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 3180;
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
		this.enterRule(localctx, 298, SolidCashParser.RULE_numberLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3183;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 3185;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 369, this._ctx) ) {
			case 1:
				{
				this.state = 3184;
				_la = this._input.LA(1);
				if(!(_la===143 || _la===144)) {
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
		this.enterRule(localctx, 300, SolidCashParser.RULE_decimalLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3187;
			this.match(SolidCashParser.DecimalLiteral);
			this.state = 3189;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 370, this._ctx) ) {
			case 1:
				{
				this.state = 3188;
				_la = this._input.LA(1);
				if(!(_la===143 || _la===144)) {
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
		this.enterRule(localctx, 302, SolidCashParser.RULE_typeName);
		try {
			this.state = 3210;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 371, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 3191;
				this.match(SolidCashParser.T__90);
				this.state = 3192;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 3193;
				this.match(SolidCashParser.T__90);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 3194;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 3195;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 3196;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 3197;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 3198;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 3199;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 3200;
				this.match(SolidCashParser.T__88);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 3201;
				this.match(SolidCashParser.T__89);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 3202;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 3203;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 3204;
				this.functionType();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 3205;
				this.match(SolidCashParser.Identifier);
				this.state = 3206;
				this.match(SolidCashParser.T__6);
				this.state = 3207;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 3208;
				this.match(SolidCashParser.T__33);
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 3209;
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
	public functionType(): FunctionTypeContext {
		let localctx: FunctionTypeContext = new FunctionTypeContext(this, this._ctx, this.state);
		this.enterRule(localctx, 304, SolidCashParser.RULE_functionType);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3212;
			this.match(SolidCashParser.T__8);
			this.state = 3213;
			this.match(SolidCashParser.T__56);
			this.state = 3222;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===9 || _la===34 || ((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 3585) !== 0) || ((((_la - 147)) & ~0x1F) === 0 && ((1 << (_la - 147)) & 15375) !== 0) || _la===181) {
				{
				this.state = 3214;
				this.functionTypeParameter();
				this.state = 3219;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 3215;
					this.match(SolidCashParser.T__4);
					this.state = 3216;
					this.functionTypeParameter();
					}
					}
					this.state = 3221;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 3224;
			this.match(SolidCashParser.T__57);
			this.state = 3228;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 374, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 3225;
					_la = this._input.LA(1);
					if(!(((((_la - 52)) & ~0x1F) === 0 && ((1 << (_la - 52)) & 49153) !== 0) || _la===85 || _la===86)) {
					this._errHandler.recoverInline(this);
					}
					else {
						this._errHandler.reportMatch(this);
					    this.consume();
					}
					}
					}
				}
				this.state = 3230;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 374, this._ctx);
			}
			this.state = 3243;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 376, this._ctx) ) {
			case 1:
				{
				this.state = 3231;
				this.match(SolidCashParser.T__87);
				this.state = 3232;
				this.match(SolidCashParser.T__56);
				this.state = 3233;
				this.functionTypeReturnParameter();
				this.state = 3238;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 3234;
					this.match(SolidCashParser.T__4);
					this.state = 3235;
					this.functionTypeReturnParameter();
					}
					}
					this.state = 3240;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 3241;
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
	public functionTypeParameter(): FunctionTypeParameterContext {
		let localctx: FunctionTypeParameterContext = new FunctionTypeParameterContext(this, this._ctx, this.state);
		this.enterRule(localctx, 306, SolidCashParser.RULE_functionTypeParameter);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3248;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 377, this._ctx) ) {
			case 1:
				{
				this.state = 3245;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 3246;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 3247;
				this.mappingType();
				}
				break;
			}
			this.state = 3251;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 378, this._ctx) ) {
			case 1:
				{
				this.state = 3250;
				this.dataLocation();
				}
				break;
			}
			this.state = 3254;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 379, this._ctx) ) {
			case 1:
				{
				this.state = 3253;
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
		this.enterRule(localctx, 308, SolidCashParser.RULE_functionTypeReturnParameter);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3259;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 380, this._ctx) ) {
			case 1:
				{
				this.state = 3256;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 3257;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 3258;
				this.mappingType();
				}
				break;
			}
			this.state = 3262;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 137)) & ~0x1F) === 0 && ((1 << (_la - 137)) & 7) !== 0)) {
				{
				this.state = 3261;
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
		this.enterRule(localctx, 310, SolidCashParser.RULE_typeCast);
		try {
			this.state = 3279;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 382, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 3264;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 3265;
				if (!(this._input.LT(1).text === 'uint')) {
					throw this.createFailedPredicateException("this._input.LT(1).text === 'uint'");
				}
				this.state = 3266;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 3267;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 3268;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 3269;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 3270;
				this.match(SolidCashParser.UnsafeCast);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 3271;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 3272;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 3273;
				this.match(SolidCashParser.T__88);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 3274;
				this.match(SolidCashParser.T__89);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 3275;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 3276;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 3277;
				this.match(SolidCashParser.T__90);
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 3278;
				this.match(SolidCashParser.T__66);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(localctx, 312, SolidCashParser.RULE_arrayCastType);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3281;
			this.typeCast();
			this.state = 3289;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===82) {
				{
				{
				this.state = 3282;
				this.match(SolidCashParser.T__81);
				this.state = 3284;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 383, this._ctx) ) {
				case 1:
					{
					this.state = 3283;
					this.expression(0);
					}
					break;
				}
				this.state = 3286;
				this.match(SolidCashParser.T__82);
				}
				}
				this.state = 3291;
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

	public sempred(localctx: RuleContext, ruleIndex: number, predIndex: number): boolean {
		switch (ruleIndex) {
		case 8:
			return this.anyIdentifier_sempred(localctx as AnyIdentifierContext, predIndex);
		case 46:
			return this.arrayType_sempred(localctx as ArrayTypeContext, predIndex);
		case 79:
			return this.nestedTupleAssignment_sempred(localctx as NestedTupleAssignmentContext, predIndex);
		case 114:
			return this.yulIdentifier_sempred(localctx as YulIdentifierContext, predIndex);
		case 131:
			return this.functionCall_sempred(localctx as FunctionCallContext, predIndex);
		case 141:
			return this.expression_sempred(localctx as ExpressionContext, predIndex);
		case 155:
			return this.typeCast_sempred(localctx as TypeCastContext, predIndex);
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
			return this.hasNestedTuplePatternAhead();
		}
		return true;
	}
	private yulIdentifier_sempred(localctx: YulIdentifierContext, predIndex: number): boolean {
		switch (predIndex) {
		case 3:
			return this.isYulSolidityKeyword(this._input.LT(1).text ?? '');
		}
		return true;
	}
	private functionCall_sempred(localctx: FunctionCallContext, predIndex: number): boolean {
		switch (predIndex) {
		case 4:
			return this.hasFunctionCallAhead();
		}
		return true;
	}
	private expression_sempred(localctx: ExpressionContext, predIndex: number): boolean {
		switch (predIndex) {
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
			return this.precpred(this._ctx, 8);
		case 15:
			return this.precpred(this._ctx, 7);
		case 16:
			return this.precpred(this._ctx, 31);
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
			return this.precpred(this._ctx, 22);
		case 25:
			return this.precpred(this._ctx, 21);
		case 26:
			return this.precpred(this._ctx, 20);
		case 27:
			return this.precpred(this._ctx, 6);
		}
		return true;
	}
	private typeCast_sempred(localctx: TypeCastContext, predIndex: number): boolean {
		switch (predIndex) {
		case 28:
			return this._input.LT(1).text === 'uint';
		}
		return true;
	}

	public static readonly _serializedATN: number[] = [4,1,184,3293,2,0,7,0,
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
	7,145,2,146,7,146,2,147,7,147,2,148,7,148,2,149,7,149,2,150,7,150,2,151,
	7,151,2,152,7,152,2,153,7,153,2,154,7,154,2,155,7,155,2,156,7,156,1,0,5,
	0,316,8,0,10,0,12,0,319,9,0,1,0,1,0,5,0,323,8,0,10,0,12,0,326,9,0,1,0,1,
	0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,5,0,340,8,0,10,0,12,0,343,9,0,
	1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,5,1,360,8,1,
	10,1,12,1,363,9,1,1,1,3,1,366,8,1,1,1,1,1,1,1,1,1,1,1,3,1,373,8,1,1,2,1,
	2,1,2,3,2,378,8,2,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,
	3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,3,3,406,8,3,1,3,1,3,1,
	3,1,3,3,3,412,8,3,5,3,414,8,3,10,3,12,3,417,9,3,1,3,1,3,1,3,1,3,1,3,1,3,
	3,3,425,8,3,1,4,1,4,1,4,1,4,1,4,5,4,432,8,4,10,4,12,4,435,9,4,1,4,3,4,438,
	8,4,1,4,1,4,5,4,442,8,4,10,4,12,4,445,9,4,1,4,1,4,1,5,1,5,1,5,1,5,1,5,1,
	5,1,5,3,5,456,8,5,1,5,3,5,459,8,5,1,5,1,5,1,5,1,5,1,5,1,5,5,5,467,8,5,10,
	5,12,5,470,9,5,1,5,3,5,473,8,5,1,5,1,5,1,5,1,5,1,5,1,5,3,5,481,8,5,1,5,
	3,5,484,8,5,1,5,1,5,3,5,488,8,5,1,6,1,6,1,6,3,6,493,8,6,1,6,1,6,3,6,497,
	8,6,1,7,1,7,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,
	1,8,1,8,1,8,1,8,1,8,3,8,521,8,8,1,9,1,9,1,9,3,9,526,8,9,1,10,1,10,1,10,
	1,10,1,10,1,10,1,10,1,10,5,10,536,8,10,10,10,12,10,539,9,10,1,10,3,10,542,
	8,10,1,11,1,11,1,12,1,12,1,12,5,12,549,8,12,10,12,12,12,552,9,12,1,12,3,
	12,555,8,12,1,13,1,13,1,13,1,13,1,13,4,13,562,8,13,11,13,12,13,563,3,13,
	566,8,13,1,14,3,14,569,8,14,1,14,1,14,1,15,1,15,1,16,1,16,1,16,1,16,1,16,
	1,16,5,16,581,8,16,10,16,12,16,584,9,16,3,16,586,8,16,1,16,1,16,1,16,1,
	16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,5,16,599,8,16,10,16,12,16,602,9,16,
	1,16,1,16,1,17,1,17,1,17,1,17,1,17,1,17,1,17,1,17,1,17,1,17,3,17,616,8,
	17,1,18,1,18,1,18,1,18,1,18,1,19,1,19,1,20,1,20,1,20,1,20,5,20,629,8,20,
	10,20,12,20,632,9,20,1,20,3,20,635,8,20,1,20,1,20,1,21,1,21,1,21,5,21,642,
	8,21,10,21,12,21,645,9,21,1,21,1,21,5,21,649,8,21,10,21,12,21,652,9,21,
	1,21,3,21,655,8,21,1,21,1,21,1,22,1,22,1,22,1,22,1,22,1,22,1,22,1,22,1,
	22,1,22,1,22,1,22,1,22,5,22,672,8,22,10,22,12,22,675,9,22,1,22,1,22,1,23,
	3,23,680,8,23,1,23,1,23,1,23,3,23,685,8,23,1,23,1,23,1,23,1,23,5,23,691,
	8,23,10,23,12,23,694,9,23,3,23,696,8,23,1,23,1,23,1,23,1,23,1,23,1,23,1,
	23,1,23,1,23,1,23,1,23,1,23,1,23,1,23,1,23,5,23,713,8,23,10,23,12,23,716,
	9,23,1,23,1,23,1,24,1,24,3,24,722,8,24,1,25,1,25,1,25,1,25,1,25,5,25,729,
	8,25,10,25,12,25,732,9,25,1,25,3,25,735,8,25,1,25,1,25,1,26,1,26,1,26,3,
	26,742,8,26,1,26,1,26,1,26,1,26,5,26,748,8,26,10,26,12,26,751,9,26,1,26,
	3,26,754,8,26,3,26,756,8,26,1,26,1,26,3,26,760,8,26,1,26,1,26,1,27,1,27,
	3,27,766,8,27,1,27,3,27,769,8,27,1,27,3,27,772,8,27,1,28,1,28,1,28,1,28,
	1,28,1,28,5,28,780,8,28,10,28,12,28,783,9,28,1,28,3,28,786,8,28,3,28,788,
	8,28,1,28,1,28,1,28,1,29,1,29,3,29,795,8,29,1,29,1,29,3,29,799,8,29,3,29,
	801,8,29,1,30,1,30,1,30,1,30,4,30,807,8,30,11,30,12,30,808,1,30,1,30,1,
	31,1,31,1,31,3,31,816,8,31,1,31,1,31,1,31,1,32,1,32,1,32,1,32,1,32,1,32,
	5,32,827,8,32,10,32,12,32,830,9,32,1,32,3,32,833,8,32,1,32,1,32,1,33,1,
	33,1,33,3,33,840,8,33,1,34,1,34,1,34,1,34,1,34,1,34,1,35,1,35,1,35,1,35,
	1,35,1,35,1,35,1,36,1,36,1,36,5,36,858,8,36,10,36,12,36,861,9,36,1,36,5,
	36,864,8,36,10,36,12,36,867,9,36,1,36,5,36,870,8,36,10,36,12,36,873,9,36,
	1,36,5,36,876,8,36,10,36,12,36,879,9,36,1,36,1,36,5,36,883,8,36,10,36,12,
	36,886,9,36,1,36,1,36,1,37,1,37,1,37,5,37,893,8,37,10,37,12,37,896,9,37,
	1,37,1,37,5,37,900,8,37,10,37,12,37,903,9,37,1,37,5,37,906,8,37,10,37,12,
	37,909,9,37,1,37,3,37,912,8,37,1,37,1,37,5,37,916,8,37,10,37,12,37,919,
	9,37,1,37,1,37,1,38,1,38,1,38,3,38,926,8,38,1,39,1,39,1,39,1,39,5,39,932,
	8,39,10,39,12,39,935,9,39,1,39,1,39,5,39,939,8,39,10,39,12,39,942,9,39,
	1,39,1,39,5,39,946,8,39,10,39,12,39,949,9,39,1,39,1,39,5,39,953,8,39,10,
	39,12,39,956,9,39,1,39,1,39,3,39,960,8,39,1,39,1,39,1,39,1,39,5,39,966,
	8,39,10,39,12,39,969,9,39,1,39,1,39,5,39,973,8,39,10,39,12,39,976,9,39,
	1,39,1,39,5,39,980,8,39,10,39,12,39,983,9,39,1,39,1,39,5,39,987,8,39,10,
	39,12,39,990,9,39,1,39,1,39,3,39,994,8,39,3,39,996,8,39,1,40,1,40,3,40,
	1000,8,40,1,41,1,41,1,41,1,42,3,42,1006,8,42,1,42,1,42,1,42,5,42,1011,8,
	42,10,42,12,42,1014,9,42,1,42,1,42,1,42,1,42,1,42,3,42,1021,8,42,3,42,1023,
	8,42,1,42,1,42,1,42,1,42,1,42,5,42,1030,8,42,10,42,12,42,1033,9,42,1,42,
	1,42,1,42,5,42,1038,8,42,10,42,12,42,1041,9,42,1,42,1,42,1,42,1,42,1,42,
	3,42,1048,8,42,3,42,1050,8,42,1,42,1,42,1,42,3,42,1055,8,42,1,42,3,42,1058,
	8,42,1,42,1,42,5,42,1062,8,42,10,42,12,42,1065,9,42,1,42,1,42,1,42,1,42,
	3,42,1071,8,42,1,42,1,42,5,42,1075,8,42,10,42,12,42,1078,9,42,1,42,1,42,
	1,42,3,42,1083,8,42,1,42,1,42,3,42,1087,8,42,1,43,1,43,1,43,3,43,1092,8,
	43,1,44,1,44,1,45,1,45,1,45,1,45,3,45,1100,8,45,1,45,1,45,1,45,3,45,1105,
	8,45,1,45,1,45,1,45,1,45,1,45,1,45,3,45,1113,8,45,1,45,1,45,1,45,3,45,1118,
	8,45,1,45,1,45,1,45,1,45,1,45,1,45,3,45,1126,8,45,1,45,1,45,1,45,3,45,1131,
	8,45,1,45,1,45,3,45,1135,8,45,1,46,1,46,1,46,1,46,3,46,1141,8,46,1,46,1,
	46,1,46,1,46,1,46,3,46,1148,8,46,1,46,1,46,1,46,1,46,1,46,3,46,1155,8,46,
	1,46,1,46,3,46,1159,8,46,1,46,1,46,1,46,3,46,1164,8,46,1,46,5,46,1167,8,
	46,10,46,12,46,1170,9,46,1,47,1,47,1,47,3,47,1175,8,47,1,47,1,47,5,47,1179,
	8,47,10,47,12,47,1182,9,47,1,47,1,47,5,47,1186,8,47,10,47,12,47,1189,9,
	47,1,47,1,47,3,47,1193,8,47,1,48,1,48,3,48,1197,8,48,1,49,1,49,1,49,1,50,
	1,50,1,50,1,50,1,50,5,50,1207,8,50,10,50,12,50,1210,9,50,1,50,3,50,1213,
	8,50,1,50,1,50,5,50,1217,8,50,10,50,12,50,1220,9,50,1,50,1,50,1,51,1,51,
	3,51,1226,8,51,1,51,1,51,3,51,1230,8,51,1,52,1,52,1,52,1,52,1,52,1,52,1,
	52,1,52,1,52,1,52,1,52,1,52,1,52,3,52,1245,8,52,1,53,1,53,1,53,1,53,1,53,
	5,53,1252,8,53,10,53,12,53,1255,9,53,1,53,3,53,1258,8,53,1,54,1,54,1,54,
	1,54,3,54,1264,8,54,1,55,1,55,1,55,1,55,1,55,5,55,1271,8,55,10,55,12,55,
	1274,9,55,1,55,3,55,1277,8,55,1,55,1,55,1,56,1,56,5,56,1283,8,56,10,56,
	12,56,1286,9,56,1,56,3,56,1289,8,56,1,56,1,56,5,56,1293,8,56,10,56,12,56,
	1296,9,56,1,56,3,56,1299,8,56,1,56,1,56,5,56,1303,8,56,10,56,12,56,1306,
	9,56,1,56,3,56,1309,8,56,3,56,1311,8,56,1,57,1,57,1,57,1,57,5,57,1317,8,
	57,10,57,12,57,1320,9,57,1,57,3,57,1323,8,57,3,57,1325,8,57,1,57,1,57,1,
	58,1,58,5,58,1331,8,58,10,58,12,58,1334,9,58,1,58,3,58,1337,8,58,1,58,1,
	58,5,58,1341,8,58,10,58,12,58,1344,9,58,1,58,3,58,1347,8,58,1,58,1,58,5,
	58,1351,8,58,10,58,12,58,1354,9,58,1,58,3,58,1357,8,58,3,58,1359,8,58,1,
	59,1,59,1,60,1,60,5,60,1365,8,60,10,60,12,60,1368,9,60,1,60,1,60,1,61,1,
	61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,
	1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,
	61,3,61,1403,8,61,1,62,1,62,1,62,3,62,1408,8,62,1,62,5,62,1411,8,62,10,
	62,12,62,1414,9,62,1,62,1,62,1,62,1,62,1,62,1,62,3,62,1422,8,62,1,62,4,
	62,1425,8,62,11,62,12,62,1426,1,62,1,62,1,62,3,62,1432,8,62,1,63,1,63,1,
	63,3,63,1437,8,63,1,63,5,63,1440,8,63,10,63,12,63,1443,9,63,1,63,1,63,1,
	63,1,63,3,63,1449,8,63,1,63,5,63,1452,8,63,10,63,12,63,1455,9,63,1,63,1,
	63,1,64,1,64,1,64,1,64,1,64,1,64,1,64,1,64,1,64,1,64,1,64,1,64,3,64,1471,
	8,64,3,64,1473,8,64,1,65,1,65,1,65,1,65,1,65,1,65,1,66,1,66,1,66,1,66,1,
	66,3,66,1486,8,66,1,66,1,66,1,67,1,67,1,67,1,67,3,67,1494,8,67,1,68,1,68,
	1,68,1,68,1,68,1,69,1,69,1,69,3,69,1504,8,69,1,69,1,69,1,69,1,69,1,69,1,
	69,1,69,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,
	1,70,3,70,1527,8,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,
	70,1,70,1,70,1,70,3,70,1543,8,70,3,70,1545,8,70,1,70,1,70,1,70,1,70,1,70,
	1,70,3,70,1553,8,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,
	70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,3,70,1575,8,70,3,70,1577,
	8,70,1,70,1,70,1,70,3,70,1582,8,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,
	70,1,70,1,70,3,70,1594,8,70,1,70,1,70,1,71,1,71,1,71,3,71,1601,8,71,1,72,
	1,72,1,72,1,72,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,
	73,1,73,1,73,1,73,1,73,1,73,1,73,5,73,1625,8,73,10,73,12,73,1628,9,73,1,
	73,1,73,1,73,1,73,1,73,1,73,1,73,5,73,1637,8,73,10,73,12,73,1640,9,73,1,
	73,3,73,1643,8,73,1,73,1,73,1,73,3,73,1648,8,73,1,74,1,74,1,74,1,74,1,74,
	1,74,1,74,1,74,3,74,1658,8,74,1,75,1,75,1,75,1,75,3,75,1664,8,75,1,75,1,
	75,1,75,1,75,1,75,5,75,1671,8,75,10,75,12,75,1674,9,75,1,75,3,75,1677,8,
	75,3,75,1679,8,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,3,75,1688,8,75,1,75,
	1,75,1,75,3,75,1693,8,75,1,76,1,76,5,76,1697,8,76,10,76,12,76,1700,9,76,
	1,76,1,76,1,76,1,76,1,76,1,76,3,76,1708,8,76,3,76,1710,8,76,1,76,1,76,1,
	76,1,76,5,76,1716,8,76,10,76,12,76,1719,9,76,1,76,1,76,1,76,1,76,1,76,1,
	76,3,76,1727,8,76,3,76,1729,8,76,1,76,1,76,1,76,1,76,5,76,1735,8,76,10,
	76,12,76,1738,9,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,3,76,1748,8,
	76,3,76,1750,8,76,1,76,1,76,1,76,1,76,5,76,1756,8,76,10,76,12,76,1759,9,
	76,1,76,1,76,1,76,3,76,1764,8,76,1,76,1,76,3,76,1768,8,76,1,77,1,77,1,77,
	3,77,1773,8,77,1,77,4,77,1776,8,77,11,77,12,77,1777,1,78,1,78,1,78,1,78,
	1,78,1,78,4,78,1786,8,78,11,78,12,78,1787,1,78,1,78,1,78,1,78,1,78,1,78,
	1,78,1,78,4,78,1798,8,78,11,78,12,78,1799,1,78,1,78,1,78,1,78,1,78,1,78,
	4,78,1808,8,78,11,78,12,78,1809,1,78,1,78,1,78,1,78,1,78,1,78,1,78,4,78,
	1819,8,78,11,78,12,78,1820,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,5,78,
	1831,8,78,10,78,12,78,1834,9,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,
	1,78,5,78,1845,8,78,10,78,12,78,1848,9,78,1,78,1,78,1,78,1,78,1,78,1,78,
	3,78,1856,8,78,1,79,1,79,1,79,1,79,1,79,1,79,1,80,1,80,3,80,1866,8,80,1,
	80,1,80,3,80,1870,8,80,5,80,1872,8,80,10,80,12,80,1875,9,80,1,80,1,80,1,
	81,1,81,5,81,1881,8,81,10,81,12,81,1884,9,81,1,81,1,81,1,81,1,81,5,81,1890,
	8,81,10,81,12,81,1893,9,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,
	1,81,1,81,1,81,5,81,1907,8,81,10,81,12,81,1910,9,81,1,81,3,81,1913,8,81,
	1,82,1,82,5,82,1917,8,82,10,82,12,82,1920,9,82,1,82,1,82,1,82,1,82,5,82,
	1926,8,82,10,82,12,82,1929,9,82,1,82,1,82,1,82,1,82,1,82,1,82,1,82,1,82,
	1,82,1,82,1,82,1,82,5,82,1943,8,82,10,82,12,82,1946,9,82,1,82,3,82,1949,
	8,82,1,83,1,83,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,3,84,1961,8,84,1,
	84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,
	1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,4,84,1986,8,84,11,84,12,84,1987,
	1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,4,84,1998,8,84,11,84,12,84,1999,
	1,84,1,84,1,84,1,84,1,84,1,84,5,84,2008,8,84,10,84,12,84,2011,9,84,4,84,
	2013,8,84,11,84,12,84,2014,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,4,84,
	2025,8,84,11,84,12,84,2026,1,84,1,84,1,84,1,84,1,84,1,84,4,84,2035,8,84,
	11,84,12,84,2036,1,84,1,84,1,84,1,84,4,84,2043,8,84,11,84,12,84,2044,1,
	84,1,84,1,84,1,84,1,84,1,84,4,84,2053,8,84,11,84,12,84,2054,1,84,3,84,2058,
	8,84,1,85,1,85,1,85,1,85,1,85,1,85,1,85,3,85,2067,8,85,1,85,1,85,1,85,1,
	86,1,86,1,86,1,86,1,86,3,86,2077,8,86,1,86,1,86,1,86,1,87,1,87,1,87,1,87,
	1,87,1,87,1,87,3,87,2089,8,87,1,88,1,88,1,88,1,88,1,88,1,88,1,88,3,88,2098,
	8,88,1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,
	89,1,89,1,89,1,90,1,90,1,90,1,90,1,90,1,90,1,90,1,90,1,90,1,90,1,90,1,91,
	1,91,1,91,1,91,1,91,1,91,1,91,1,91,1,91,1,91,1,91,1,92,1,92,1,92,1,92,1,
	92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,1,92,1,93,
	1,93,1,93,1,93,1,93,3,93,2161,8,93,1,93,1,93,1,93,1,94,1,94,5,94,2168,8,
	94,10,94,12,94,2171,9,94,1,94,1,94,1,94,3,94,2176,8,94,1,94,1,94,1,94,1,
	94,1,94,1,94,1,94,1,94,1,94,1,94,1,94,4,94,2189,8,94,11,94,12,94,2190,1,
	94,1,94,1,94,1,94,1,94,1,94,4,94,2199,8,94,11,94,12,94,2200,1,94,1,94,1,
	94,3,94,2206,8,94,1,94,1,94,1,94,3,94,2211,8,94,1,95,3,95,2214,8,95,1,95,
	1,95,1,96,1,96,1,96,1,96,1,96,1,96,1,96,1,96,1,96,1,96,1,96,4,96,2229,8,
	96,11,96,12,96,2230,1,96,1,96,1,96,1,96,1,96,1,96,4,96,2239,8,96,11,96,
	12,96,2240,1,96,1,96,1,96,3,96,2246,8,96,1,96,3,96,2249,8,96,1,97,1,97,
	1,97,1,97,1,97,1,97,1,97,1,97,1,98,1,98,1,98,1,98,1,98,1,98,1,99,1,99,3,
	99,2267,8,99,1,99,1,99,1,99,1,100,1,100,3,100,2274,8,100,1,100,1,100,1,
	100,1,100,5,100,2280,8,100,10,100,12,100,2283,9,100,1,100,3,100,2286,8,
	100,1,100,1,100,1,101,1,101,5,101,2292,8,101,10,101,12,101,2295,9,101,1,
	101,1,101,1,102,1,102,1,102,1,102,1,102,1,102,1,102,1,102,1,102,1,102,1,
	102,1,102,1,102,3,102,2312,8,102,1,103,1,103,1,103,1,103,5,103,2318,8,103,
	10,103,12,103,2321,9,103,1,103,1,103,3,103,2325,8,103,1,104,1,104,1,104,
	5,104,2330,8,104,10,104,12,104,2333,9,104,1,104,1,104,1,104,1,105,1,105,
	1,105,1,105,1,106,1,106,1,106,4,106,2345,8,106,11,106,12,106,2346,1,106,
	3,106,2350,8,106,1,106,3,106,2353,8,106,1,107,1,107,1,107,1,107,1,108,1,
	108,1,108,1,109,1,109,1,109,1,109,1,109,1,109,1,110,1,110,1,110,1,110,1,
	110,1,110,5,110,2374,8,110,10,110,12,110,2377,9,110,3,110,2379,8,110,1,
	110,1,110,1,110,1,110,1,110,5,110,2386,8,110,10,110,12,110,2389,9,110,3,
	110,2391,8,110,1,110,1,110,1,111,1,111,1,111,3,111,2398,8,111,1,112,1,112,
	1,112,1,112,1,112,5,112,2405,8,112,10,112,12,112,2408,9,112,3,112,2410,
	8,112,1,112,1,112,1,113,1,113,1,114,1,114,1,114,3,114,2419,8,114,1,115,
	1,115,1,115,1,115,1,115,1,115,5,115,2427,8,115,10,115,12,115,2430,9,115,
	1,116,1,116,1,117,1,117,1,117,5,117,2437,8,117,10,117,12,117,2440,9,117,
	1,117,1,117,1,118,1,118,1,118,1,118,1,118,1,118,5,118,2450,8,118,10,118,
	12,118,2453,9,118,1,118,3,118,2456,8,118,1,118,1,118,1,119,1,119,1,119,
	1,119,5,119,2464,8,119,10,119,12,119,2467,9,119,1,120,1,120,1,120,5,120,
	2472,8,120,10,120,12,120,2475,9,120,1,121,1,121,1,121,3,121,2480,8,121,
	1,121,1,121,4,121,2484,8,121,11,121,12,121,2485,1,122,1,122,1,122,1,122,
	1,122,5,122,2493,8,122,10,122,12,122,2496,9,122,1,122,3,122,2499,8,122,
	3,122,2501,8,122,1,122,1,122,1,123,1,123,3,123,2507,8,123,1,123,1,123,1,
	123,1,123,5,123,2513,8,123,10,123,12,123,2516,9,123,1,123,3,123,2519,8,
	123,3,123,2521,8,123,1,123,3,123,2524,8,123,1,123,1,123,1,124,1,124,1,124,
	1,125,1,125,1,125,1,126,1,126,1,126,1,126,3,126,2538,8,126,1,127,1,127,
	1,127,1,127,3,127,2544,8,127,1,127,1,127,1,127,1,127,1,127,5,127,2551,8,
	127,10,127,12,127,2554,9,127,1,127,3,127,2557,8,127,3,127,2559,8,127,1,
	127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,3,127,2569,8,127,1,127,1,
	127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,1,127,3,
	127,2584,8,127,1,128,1,128,1,128,1,128,1,128,1,128,1,128,1,128,3,128,2594,
	8,128,1,129,1,129,3,129,2598,8,129,1,130,1,130,1,130,1,130,5,130,2604,8,
	130,10,130,12,130,2607,9,130,1,130,3,130,2610,8,130,3,130,2612,8,130,1,
	130,1,130,1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,
	131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,5,131,2637,
	8,131,10,131,12,131,2640,9,131,1,131,3,131,2643,8,131,3,131,2645,8,131,
	1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,
	1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,1,131,5,131,2669,
	8,131,10,131,12,131,2672,9,131,1,131,3,131,2675,8,131,3,131,2677,8,131,
	1,131,1,131,3,131,2681,8,131,1,132,1,132,1,132,1,132,1,133,1,133,1,133,
	1,133,5,133,2691,8,133,10,133,12,133,2694,9,133,1,133,3,133,2697,8,133,
	3,133,2699,8,133,1,133,1,133,1,134,1,134,1,134,1,134,1,134,1,134,1,134,
	3,134,2710,8,134,3,134,2712,8,134,1,135,1,135,1,135,1,135,5,135,2718,8,
	135,10,135,12,135,2721,9,135,1,135,3,135,2724,8,135,1,135,1,135,1,136,1,
	136,1,136,1,136,1,137,1,137,1,137,1,137,5,137,2736,8,137,10,137,12,137,
	2739,9,137,1,137,3,137,2742,8,137,3,137,2744,8,137,1,137,1,137,1,138,1,
	138,1,138,1,138,1,138,1,138,1,138,3,138,2755,8,138,1,138,5,138,2758,8,138,
	10,138,12,138,2761,9,138,3,138,2763,8,138,1,139,1,139,1,139,1,139,1,139,
	1,139,1,139,1,139,1,139,1,139,1,139,1,139,1,139,1,139,1,139,1,139,1,139,
	1,139,1,139,4,139,2784,8,139,11,139,12,139,2785,1,139,1,139,1,139,1,139,
	1,139,1,139,1,139,1,139,1,139,1,139,1,139,3,139,2799,8,139,1,140,1,140,
	1,140,3,140,2804,8,140,1,140,1,140,1,140,1,140,1,140,3,140,2811,8,140,1,
	140,4,140,2814,8,140,11,140,12,140,2815,1,140,1,140,1,140,1,140,1,140,1,
	140,1,140,1,140,1,140,1,140,1,140,1,140,1,140,1,140,1,140,1,140,3,140,2834,
	8,140,1,141,1,141,1,141,1,141,1,141,1,141,3,141,2842,8,141,1,141,1,141,
	1,141,1,141,5,141,2848,8,141,10,141,12,141,2851,9,141,1,141,1,141,1,141,
	1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,
	1,141,1,141,1,141,1,141,1,141,3,141,2873,8,141,1,141,1,141,1,141,1,141,
	1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,
	1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,
	1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,5,141,2912,8,141,
	10,141,12,141,2915,9,141,1,141,3,141,2918,8,141,3,141,2920,8,141,1,141,
	1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,
	1,141,1,141,1,141,1,141,4,141,2939,8,141,11,141,12,141,2940,1,141,1,141,
	1,141,3,141,2946,8,141,1,141,1,141,1,141,3,141,2951,8,141,1,141,1,141,1,
	141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,
	141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,
	141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,3,141,2989,8,
	141,1,141,1,141,3,141,2993,8,141,1,141,1,141,3,141,2997,8,141,1,141,1,141,
	1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,
	1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,3,141,3022,8,141,
	1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,3,141,3033,8,141,
	1,141,1,141,1,141,1,141,1,141,5,141,3040,8,141,10,141,12,141,3043,9,141,
	1,141,3,141,3046,8,141,3,141,3048,8,141,1,141,1,141,1,141,1,141,1,141,1,
	141,1,141,3,141,3057,8,141,1,141,3,141,3060,8,141,1,141,1,141,5,141,3064,
	8,141,10,141,12,141,3067,9,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,
	1,141,1,141,1,141,1,141,3,141,3080,8,141,1,141,1,141,1,141,1,141,1,141,
	1,141,1,141,1,141,1,141,1,141,1,141,3,141,3093,8,141,1,141,1,141,1,141,
	1,141,3,141,3099,8,141,5,141,3101,8,141,10,141,12,141,3104,9,141,1,142,
	1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,3,142,
	3118,8,142,1,143,1,143,1,143,1,143,1,143,1,143,1,143,1,143,3,143,3128,8,
	143,1,144,1,144,1,144,1,145,1,145,1,145,1,145,1,145,1,145,1,145,1,145,1,
	145,1,145,1,145,1,145,1,145,1,145,1,145,1,145,1,145,3,145,3150,8,145,1,
	146,1,146,1,147,1,147,1,148,1,148,1,148,1,148,1,148,5,148,3161,8,148,10,
	148,12,148,3164,9,148,1,148,1,148,5,148,3168,8,148,10,148,12,148,3171,9,
	148,1,148,1,148,5,148,3175,8,148,10,148,12,148,3178,9,148,1,148,1,148,3,
	148,3182,8,148,1,149,1,149,3,149,3186,8,149,1,150,1,150,3,150,3190,8,150,
	1,151,1,151,1,151,1,151,1,151,1,151,1,151,1,151,1,151,1,151,1,151,1,151,
	1,151,1,151,1,151,1,151,1,151,1,151,1,151,3,151,3211,8,151,1,152,1,152,
	1,152,1,152,1,152,5,152,3218,8,152,10,152,12,152,3221,9,152,3,152,3223,
	8,152,1,152,1,152,5,152,3227,8,152,10,152,12,152,3230,9,152,1,152,1,152,
	1,152,1,152,1,152,5,152,3237,8,152,10,152,12,152,3240,9,152,1,152,1,152,
	3,152,3244,8,152,1,153,1,153,1,153,3,153,3249,8,153,1,153,3,153,3252,8,
	153,1,153,3,153,3255,8,153,1,154,1,154,1,154,3,154,3260,8,154,1,154,3,154,
	3263,8,154,1,155,1,155,1,155,1,155,1,155,1,155,1,155,1,155,1,155,1,155,
	1,155,1,155,1,155,1,155,1,155,3,155,3280,8,155,1,156,1,156,1,156,3,156,
	3285,8,156,1,156,5,156,3288,8,156,10,156,12,156,3291,9,156,1,156,0,2,92,
	282,157,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,
	46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,
	94,96,98,100,102,104,106,108,110,112,114,116,118,120,122,124,126,128,130,
	132,134,136,138,140,142,144,146,148,150,152,154,156,158,160,162,164,166,
	168,170,172,174,176,178,180,182,184,186,188,190,192,194,196,198,200,202,
	204,206,208,210,212,214,216,218,220,222,224,226,228,230,232,234,236,238,
	240,242,244,246,248,250,252,254,256,258,260,262,264,266,268,270,272,274,
	276,278,280,282,284,286,288,290,292,294,296,298,300,302,304,306,308,310,
	312,0,32,2,0,8,8,13,27,2,0,150,150,157,160,5,0,45,45,141,141,146,146,152,
	152,181,181,1,0,45,46,2,0,141,141,145,146,3,0,20,23,26,27,48,48,1,0,51,
	52,1,0,42,43,2,0,51,52,66,67,2,0,48,48,69,78,3,0,51,52,66,66,79,79,2,0,
	42,42,181,181,2,0,166,167,170,170,1,0,93,94,6,0,30,30,35,35,91,91,95,95,
	150,150,181,181,5,0,142,142,146,146,152,152,154,154,163,163,1,0,120,123,
	1,0,125,126,2,0,119,123,127,127,1,0,129,130,2,0,164,164,173,180,3,0,14,
	14,27,27,132,132,2,0,8,8,15,16,1,0,13,14,1,0,133,134,1,0,20,23,1,0,18,19,
	2,0,131,131,165,165,4,0,32,32,36,36,64,64,137,140,1,0,137,139,1,0,143,144,
	3,0,52,52,66,67,85,86,3803,0,317,1,0,0,0,2,372,1,0,0,0,4,374,1,0,0,0,6,
	424,1,0,0,0,8,426,1,0,0,0,10,487,1,0,0,0,12,489,1,0,0,0,14,498,1,0,0,0,
	16,520,1,0,0,0,18,525,1,0,0,0,20,541,1,0,0,0,22,543,1,0,0,0,24,554,1,0,
	0,0,26,565,1,0,0,0,28,568,1,0,0,0,30,572,1,0,0,0,32,574,1,0,0,0,34,615,
	1,0,0,0,36,617,1,0,0,0,38,622,1,0,0,0,40,624,1,0,0,0,42,638,1,0,0,0,44,
	658,1,0,0,0,46,679,1,0,0,0,48,719,1,0,0,0,50,723,1,0,0,0,52,738,1,0,0,0,
	54,765,1,0,0,0,56,773,1,0,0,0,58,800,1,0,0,0,60,802,1,0,0,0,62,815,1,0,
	0,0,64,820,1,0,0,0,66,836,1,0,0,0,68,841,1,0,0,0,70,847,1,0,0,0,72,854,
	1,0,0,0,74,889,1,0,0,0,76,925,1,0,0,0,78,995,1,0,0,0,80,999,1,0,0,0,82,
	1001,1,0,0,0,84,1086,1,0,0,0,86,1091,1,0,0,0,88,1093,1,0,0,0,90,1134,1,
	0,0,0,92,1158,1,0,0,0,94,1171,1,0,0,0,96,1196,1,0,0,0,98,1198,1,0,0,0,100,
	1201,1,0,0,0,102,1225,1,0,0,0,104,1244,1,0,0,0,106,1246,1,0,0,0,108,1259,
	1,0,0,0,110,1265,1,0,0,0,112,1310,1,0,0,0,114,1312,1,0,0,0,116,1358,1,0,
	0,0,118,1360,1,0,0,0,120,1362,1,0,0,0,122,1402,1,0,0,0,124,1431,1,0,0,0,
	126,1433,1,0,0,0,128,1472,1,0,0,0,130,1474,1,0,0,0,132,1480,1,0,0,0,134,
	1493,1,0,0,0,136,1495,1,0,0,0,138,1500,1,0,0,0,140,1512,1,0,0,0,142,1597,
	1,0,0,0,144,1602,1,0,0,0,146,1647,1,0,0,0,148,1657,1,0,0,0,150,1692,1,0,
	0,0,152,1767,1,0,0,0,154,1769,1,0,0,0,156,1855,1,0,0,0,158,1857,1,0,0,0,
	160,1863,1,0,0,0,162,1912,1,0,0,0,164,1948,1,0,0,0,166,1950,1,0,0,0,168,
	2057,1,0,0,0,170,2059,1,0,0,0,172,2071,1,0,0,0,174,2081,1,0,0,0,176,2097,
	1,0,0,0,178,2099,1,0,0,0,180,2115,1,0,0,0,182,2126,1,0,0,0,184,2137,1,0,
	0,0,186,2155,1,0,0,0,188,2210,1,0,0,0,190,2213,1,0,0,0,192,2248,1,0,0,0,
	194,2250,1,0,0,0,196,2258,1,0,0,0,198,2264,1,0,0,0,200,2271,1,0,0,0,202,
	2289,1,0,0,0,204,2311,1,0,0,0,206,2313,1,0,0,0,208,2326,1,0,0,0,210,2337,
	1,0,0,0,212,2341,1,0,0,0,214,2354,1,0,0,0,216,2358,1,0,0,0,218,2361,1,0,
	0,0,220,2367,1,0,0,0,222,2397,1,0,0,0,224,2399,1,0,0,0,226,2413,1,0,0,0,
	228,2418,1,0,0,0,230,2420,1,0,0,0,232,2431,1,0,0,0,234,2433,1,0,0,0,236,
	2443,1,0,0,0,238,2459,1,0,0,0,240,2468,1,0,0,0,242,2476,1,0,0,0,244,2487,
	1,0,0,0,246,2504,1,0,0,0,248,2527,1,0,0,0,250,2530,1,0,0,0,252,2537,1,0,
	0,0,254,2583,1,0,0,0,256,2593,1,0,0,0,258,2597,1,0,0,0,260,2599,1,0,0,0,
	262,2615,1,0,0,0,264,2682,1,0,0,0,266,2686,1,0,0,0,268,2711,1,0,0,0,270,
	2713,1,0,0,0,272,2727,1,0,0,0,274,2731,1,0,0,0,276,2762,1,0,0,0,278,2798,
	1,0,0,0,280,2833,1,0,0,0,282,2950,1,0,0,0,284,3117,1,0,0,0,286,3127,1,0,
	0,0,288,3129,1,0,0,0,290,3149,1,0,0,0,292,3151,1,0,0,0,294,3153,1,0,0,0,
	296,3181,1,0,0,0,298,3183,1,0,0,0,300,3187,1,0,0,0,302,3210,1,0,0,0,304,
	3212,1,0,0,0,306,3248,1,0,0,0,308,3259,1,0,0,0,310,3279,1,0,0,0,312,3281,
	1,0,0,0,314,316,3,20,10,0,315,314,1,0,0,0,316,319,1,0,0,0,317,315,1,0,0,
	0,317,318,1,0,0,0,318,324,1,0,0,0,319,317,1,0,0,0,320,323,3,2,1,0,321,323,
	3,6,3,0,322,320,1,0,0,0,322,321,1,0,0,0,323,326,1,0,0,0,324,322,1,0,0,0,
	324,325,1,0,0,0,325,341,1,0,0,0,326,324,1,0,0,0,327,340,3,20,10,0,328,340,
	3,70,35,0,329,340,3,64,32,0,330,340,3,60,30,0,331,340,3,68,34,0,332,340,
	3,10,5,0,333,340,3,56,28,0,334,340,3,52,26,0,335,340,3,32,16,0,336,340,
	3,8,4,0,337,340,3,44,22,0,338,340,3,46,23,0,339,327,1,0,0,0,339,328,1,0,
	0,0,339,329,1,0,0,0,339,330,1,0,0,0,339,331,1,0,0,0,339,332,1,0,0,0,339,
	333,1,0,0,0,339,334,1,0,0,0,339,335,1,0,0,0,339,336,1,0,0,0,339,337,1,0,
	0,0,339,338,1,0,0,0,340,343,1,0,0,0,341,339,1,0,0,0,341,342,1,0,0,0,342,
	344,1,0,0,0,343,341,1,0,0,0,344,345,5,0,0,1,345,1,1,0,0,0,346,347,5,1,0,
	0,347,348,5,152,0,0,348,373,5,2,0,0,349,350,5,1,0,0,350,351,5,152,0,0,351,
	352,5,3,0,0,352,353,5,181,0,0,353,373,5,2,0,0,354,355,5,1,0,0,355,356,5,
	4,0,0,356,361,3,4,2,0,357,358,5,5,0,0,358,360,3,4,2,0,359,357,1,0,0,0,360,
	363,1,0,0,0,361,359,1,0,0,0,361,362,1,0,0,0,362,365,1,0,0,0,363,361,1,0,
	0,0,364,366,5,5,0,0,365,364,1,0,0,0,365,366,1,0,0,0,366,367,1,0,0,0,367,
	368,5,6,0,0,368,369,5,181,0,0,369,370,5,152,0,0,370,371,5,2,0,0,371,373,
	1,0,0,0,372,346,1,0,0,0,372,349,1,0,0,0,372,354,1,0,0,0,373,3,1,0,0,0,374,
	377,5,181,0,0,375,376,5,3,0,0,376,378,5,181,0,0,377,375,1,0,0,0,377,378,
	1,0,0,0,378,5,1,0,0,0,379,380,5,1,0,0,380,381,5,181,0,0,381,382,5,7,0,0,
	382,383,5,181,0,0,383,425,5,2,0,0,384,385,5,1,0,0,385,386,5,181,0,0,386,
	387,5,7,0,0,387,388,5,181,0,0,388,389,5,3,0,0,389,390,5,181,0,0,390,425,
	5,2,0,0,391,392,5,1,0,0,392,393,5,8,0,0,393,394,5,3,0,0,394,395,5,181,0,
	0,395,396,5,181,0,0,396,397,5,181,0,0,397,398,5,7,0,0,398,399,5,181,0,0,
	399,425,5,2,0,0,400,401,5,1,0,0,401,402,5,4,0,0,402,405,5,181,0,0,403,404,
	5,3,0,0,404,406,5,181,0,0,405,403,1,0,0,0,405,406,1,0,0,0,406,415,1,0,0,
	0,407,408,5,5,0,0,408,411,5,181,0,0,409,410,5,3,0,0,410,412,5,181,0,0,411,
	409,1,0,0,0,411,412,1,0,0,0,412,414,1,0,0,0,413,407,1,0,0,0,414,417,1,0,
	0,0,415,413,1,0,0,0,415,416,1,0,0,0,416,418,1,0,0,0,417,415,1,0,0,0,418,
	419,5,6,0,0,419,420,5,181,0,0,420,421,5,181,0,0,421,422,5,7,0,0,422,423,
	5,181,0,0,423,425,5,2,0,0,424,379,1,0,0,0,424,384,1,0,0,0,424,391,1,0,0,
	0,424,400,1,0,0,0,425,7,1,0,0,0,426,427,5,9,0,0,427,428,3,18,9,0,428,433,
	3,114,57,0,429,432,3,104,52,0,430,432,3,102,51,0,431,429,1,0,0,0,431,430,
	1,0,0,0,432,435,1,0,0,0,433,431,1,0,0,0,433,434,1,0,0,0,434,437,1,0,0,0,
	435,433,1,0,0,0,436,438,3,110,55,0,437,436,1,0,0,0,437,438,1,0,0,0,438,
	439,1,0,0,0,439,443,5,4,0,0,440,442,3,122,61,0,441,440,1,0,0,0,442,445,
	1,0,0,0,443,441,1,0,0,0,443,444,1,0,0,0,444,446,1,0,0,0,445,443,1,0,0,0,
	446,447,5,6,0,0,447,9,1,0,0,0,448,449,5,10,0,0,449,450,5,181,0,0,450,455,
	5,11,0,0,451,456,3,92,46,0,452,456,3,90,45,0,453,456,3,302,151,0,454,456,
	5,8,0,0,455,451,1,0,0,0,455,452,1,0,0,0,455,453,1,0,0,0,455,454,1,0,0,0,
	456,458,1,0,0,0,457,459,5,12,0,0,458,457,1,0,0,0,458,459,1,0,0,0,459,460,
	1,0,0,0,460,488,5,2,0,0,461,462,5,10,0,0,462,463,5,4,0,0,463,468,3,12,6,
	0,464,465,5,5,0,0,465,467,3,12,6,0,466,464,1,0,0,0,467,470,1,0,0,0,468,
	466,1,0,0,0,468,469,1,0,0,0,469,472,1,0,0,0,470,468,1,0,0,0,471,473,5,5,
	0,0,472,471,1,0,0,0,472,473,1,0,0,0,473,474,1,0,0,0,474,475,5,6,0,0,475,
	480,5,11,0,0,476,481,3,92,46,0,477,481,3,90,45,0,478,481,3,302,151,0,479,
	481,5,8,0,0,480,476,1,0,0,0,480,477,1,0,0,0,480,478,1,0,0,0,480,479,1,0,
	0,0,481,483,1,0,0,0,482,484,5,12,0,0,483,482,1,0,0,0,483,484,1,0,0,0,484,
	485,1,0,0,0,485,486,5,2,0,0,486,488,1,0,0,0,487,448,1,0,0,0,487,461,1,0,
	0,0,488,11,1,0,0,0,489,492,5,181,0,0,490,491,5,7,0,0,491,493,5,181,0,0,
	492,490,1,0,0,0,492,493,1,0,0,0,493,496,1,0,0,0,494,495,5,3,0,0,495,497,
	3,14,7,0,496,494,1,0,0,0,496,497,1,0,0,0,497,13,1,0,0,0,498,499,7,0,0,0,
	499,15,1,0,0,0,500,521,5,181,0,0,501,521,5,28,0,0,502,521,5,29,0,0,503,
	521,5,30,0,0,504,521,5,31,0,0,505,521,5,32,0,0,506,521,5,33,0,0,507,521,
	5,34,0,0,508,521,5,12,0,0,509,521,5,35,0,0,510,521,5,36,0,0,511,521,5,37,
	0,0,512,521,5,38,0,0,513,521,5,39,0,0,514,521,5,40,0,0,515,521,5,41,0,0,
	516,521,5,148,0,0,517,521,5,144,0,0,518,519,4,8,0,0,519,521,7,1,0,0,520,
	500,1,0,0,0,520,501,1,0,0,0,520,502,1,0,0,0,520,503,1,0,0,0,520,504,1,0,
	0,0,520,505,1,0,0,0,520,506,1,0,0,0,520,507,1,0,0,0,520,508,1,0,0,0,520,
	509,1,0,0,0,520,510,1,0,0,0,520,511,1,0,0,0,520,512,1,0,0,0,520,513,1,0,
	0,0,520,514,1,0,0,0,520,515,1,0,0,0,520,516,1,0,0,0,520,517,1,0,0,0,520,
	518,1,0,0,0,521,17,1,0,0,0,522,526,3,16,8,0,523,526,5,42,0,0,524,526,5,
	43,0,0,525,522,1,0,0,0,525,523,1,0,0,0,525,524,1,0,0,0,526,19,1,0,0,0,527,
	528,5,44,0,0,528,529,3,22,11,0,529,530,3,24,12,0,530,531,5,2,0,0,531,542,
	1,0,0,0,532,533,5,44,0,0,533,537,5,181,0,0,534,536,7,2,0,0,535,534,1,0,
	0,0,536,539,1,0,0,0,537,535,1,0,0,0,537,538,1,0,0,0,538,540,1,0,0,0,539,
	537,1,0,0,0,540,542,5,2,0,0,541,527,1,0,0,0,541,532,1,0,0,0,542,21,1,0,
	0,0,543,544,7,3,0,0,544,23,1,0,0,0,545,550,3,26,13,0,546,547,5,47,0,0,547,
	549,3,26,13,0,548,546,1,0,0,0,549,552,1,0,0,0,550,548,1,0,0,0,550,551,1,
	0,0,0,551,555,1,0,0,0,552,550,1,0,0,0,553,555,5,8,0,0,554,545,1,0,0,0,554,
	553,1,0,0,0,555,25,1,0,0,0,556,557,3,28,14,0,557,558,5,14,0,0,558,559,3,
	28,14,0,559,566,1,0,0,0,560,562,3,28,14,0,561,560,1,0,0,0,562,563,1,0,0,
	0,563,561,1,0,0,0,563,564,1,0,0,0,564,566,1,0,0,0,565,556,1,0,0,0,565,561,
	1,0,0,0,566,27,1,0,0,0,567,569,3,30,15,0,568,567,1,0,0,0,568,569,1,0,0,
	0,569,570,1,0,0,0,570,571,7,4,0,0,571,29,1,0,0,0,572,573,7,5,0,0,573,31,
	1,0,0,0,574,575,5,49,0,0,575,585,5,181,0,0,576,577,5,50,0,0,577,582,5,181,
	0,0,578,579,5,5,0,0,579,581,5,181,0,0,580,578,1,0,0,0,581,584,1,0,0,0,582,
	580,1,0,0,0,582,583,1,0,0,0,583,586,1,0,0,0,584,582,1,0,0,0,585,576,1,0,
	0,0,585,586,1,0,0,0,586,587,1,0,0,0,587,600,5,4,0,0,588,599,3,64,32,0,589,
	599,3,60,30,0,590,599,3,68,34,0,591,599,3,52,26,0,592,599,3,56,28,0,593,
	599,3,10,5,0,594,599,3,36,18,0,595,599,3,34,17,0,596,599,3,40,20,0,597,
	599,3,42,21,0,598,588,1,0,0,0,598,589,1,0,0,0,598,590,1,0,0,0,598,591,1,
	0,0,0,598,592,1,0,0,0,598,593,1,0,0,0,598,594,1,0,0,0,598,595,1,0,0,0,598,
	596,1,0,0,0,598,597,1,0,0,0,599,602,1,0,0,0,600,598,1,0,0,0,600,601,1,0,
	0,0,601,603,1,0,0,0,602,600,1,0,0,0,603,604,5,6,0,0,604,33,1,0,0,0,605,
	606,3,38,19,0,606,607,3,90,45,0,607,608,5,181,0,0,608,609,5,2,0,0,609,616,
	1,0,0,0,610,611,3,38,19,0,611,612,3,92,46,0,612,613,5,181,0,0,613,614,5,
	2,0,0,614,616,1,0,0,0,615,605,1,0,0,0,615,610,1,0,0,0,616,35,1,0,0,0,617,
	618,3,38,19,0,618,619,3,302,151,0,619,620,5,181,0,0,620,621,5,2,0,0,621,
	37,1,0,0,0,622,623,7,6,0,0,623,39,1,0,0,0,624,625,5,9,0,0,625,626,3,18,
	9,0,626,630,3,114,57,0,627,629,3,104,52,0,628,627,1,0,0,0,629,632,1,0,0,
	0,630,628,1,0,0,0,630,631,1,0,0,0,631,634,1,0,0,0,632,630,1,0,0,0,633,635,
	3,110,55,0,634,633,1,0,0,0,634,635,1,0,0,0,635,636,1,0,0,0,636,637,5,2,
	0,0,637,41,1,0,0,0,638,639,5,38,0,0,639,643,3,114,57,0,640,642,3,76,38,
	0,641,640,1,0,0,0,642,645,1,0,0,0,643,641,1,0,0,0,643,644,1,0,0,0,644,646,
	1,0,0,0,645,643,1,0,0,0,646,650,5,52,0,0,647,649,3,76,38,0,648,647,1,0,
	0,0,649,652,1,0,0,0,650,648,1,0,0,0,650,651,1,0,0,0,651,654,1,0,0,0,652,
	650,1,0,0,0,653,655,3,110,55,0,654,653,1,0,0,0,654,655,1,0,0,0,655,656,
	1,0,0,0,656,657,5,2,0,0,657,43,1,0,0,0,658,659,5,53,0,0,659,660,5,181,0,
	0,660,673,5,4,0,0,661,672,3,64,32,0,662,672,3,60,30,0,663,672,3,68,34,0,
	664,672,3,52,26,0,665,672,3,56,28,0,666,672,3,70,35,0,667,672,3,84,42,0,
	668,672,3,10,5,0,669,672,3,94,47,0,670,672,3,8,4,0,671,661,1,0,0,0,671,
	662,1,0,0,0,671,663,1,0,0,0,671,664,1,0,0,0,671,665,1,0,0,0,671,666,1,0,
	0,0,671,667,1,0,0,0,671,668,1,0,0,0,671,669,1,0,0,0,671,670,1,0,0,0,672,
	675,1,0,0,0,673,671,1,0,0,0,673,674,1,0,0,0,674,676,1,0,0,0,675,673,1,0,
	0,0,676,677,5,6,0,0,677,45,1,0,0,0,678,680,5,54,0,0,679,678,1,0,0,0,679,
	680,1,0,0,0,680,681,1,0,0,0,681,682,5,55,0,0,682,684,3,16,8,0,683,685,3,
	114,57,0,684,683,1,0,0,0,684,685,1,0,0,0,685,695,1,0,0,0,686,687,5,50,0,
	0,687,692,3,48,24,0,688,689,5,5,0,0,689,691,3,48,24,0,690,688,1,0,0,0,691,
	694,1,0,0,0,692,690,1,0,0,0,692,693,1,0,0,0,693,696,1,0,0,0,694,692,1,0,
	0,0,695,686,1,0,0,0,695,696,1,0,0,0,696,697,1,0,0,0,697,714,5,4,0,0,698,
	713,3,64,32,0,699,713,3,60,30,0,700,713,3,68,34,0,701,713,3,52,26,0,702,
	713,3,56,28,0,703,713,3,70,35,0,704,713,3,10,5,0,705,713,3,84,42,0,706,
	713,3,94,47,0,707,713,3,72,36,0,708,713,3,100,50,0,709,713,3,50,25,0,710,
	713,3,74,37,0,711,713,3,78,39,0,712,698,1,0,0,0,712,699,1,0,0,0,712,700,
	1,0,0,0,712,701,1,0,0,0,712,702,1,0,0,0,712,703,1,0,0,0,712,704,1,0,0,0,
	712,705,1,0,0,0,712,706,1,0,0,0,712,707,1,0,0,0,712,708,1,0,0,0,712,709,
	1,0,0,0,712,710,1,0,0,0,712,711,1,0,0,0,713,716,1,0,0,0,714,712,1,0,0,0,
	714,715,1,0,0,0,715,717,1,0,0,0,716,714,1,0,0,0,717,718,5,6,0,0,718,47,
	1,0,0,0,719,721,5,181,0,0,720,722,3,266,133,0,721,720,1,0,0,0,721,722,1,
	0,0,0,722,49,1,0,0,0,723,724,5,9,0,0,724,725,3,18,9,0,725,730,3,114,57,
	0,726,729,3,104,52,0,727,729,3,102,51,0,728,726,1,0,0,0,728,727,1,0,0,0,
	729,732,1,0,0,0,730,728,1,0,0,0,730,731,1,0,0,0,731,734,1,0,0,0,732,730,
	1,0,0,0,733,735,3,110,55,0,734,733,1,0,0,0,734,735,1,0,0,0,735,736,1,0,
	0,0,736,737,5,2,0,0,737,51,1,0,0,0,738,741,5,56,0,0,739,742,3,16,8,0,740,
	742,7,7,0,0,741,739,1,0,0,0,741,740,1,0,0,0,742,743,1,0,0,0,743,755,5,57,
	0,0,744,749,3,54,27,0,745,746,5,5,0,0,746,748,3,54,27,0,747,745,1,0,0,0,
	748,751,1,0,0,0,749,747,1,0,0,0,749,750,1,0,0,0,750,753,1,0,0,0,751,749,
	1,0,0,0,752,754,5,5,0,0,753,752,1,0,0,0,753,754,1,0,0,0,754,756,1,0,0,0,
	755,744,1,0,0,0,755,756,1,0,0,0,756,757,1,0,0,0,757,759,5,58,0,0,758,760,
	5,59,0,0,759,758,1,0,0,0,759,760,1,0,0,0,760,761,1,0,0,0,761,762,5,2,0,
	0,762,53,1,0,0,0,763,766,3,302,151,0,764,766,3,92,46,0,765,763,1,0,0,0,
	765,764,1,0,0,0,766,768,1,0,0,0,767,769,5,60,0,0,768,767,1,0,0,0,768,769,
	1,0,0,0,769,771,1,0,0,0,770,772,3,16,8,0,771,770,1,0,0,0,771,772,1,0,0,
	0,772,55,1,0,0,0,773,774,5,34,0,0,774,775,3,16,8,0,775,787,5,57,0,0,776,
	781,3,58,29,0,777,778,5,5,0,0,778,780,3,58,29,0,779,777,1,0,0,0,780,783,
	1,0,0,0,781,779,1,0,0,0,781,782,1,0,0,0,782,785,1,0,0,0,783,781,1,0,0,0,
	784,786,5,5,0,0,785,784,1,0,0,0,785,786,1,0,0,0,786,788,1,0,0,0,787,776,
	1,0,0,0,787,788,1,0,0,0,788,789,1,0,0,0,789,790,5,58,0,0,790,791,5,2,0,
	0,791,57,1,0,0,0,792,794,3,302,151,0,793,795,3,16,8,0,794,793,1,0,0,0,794,
	795,1,0,0,0,795,801,1,0,0,0,796,798,3,92,46,0,797,799,3,16,8,0,798,797,
	1,0,0,0,798,799,1,0,0,0,799,801,1,0,0,0,800,792,1,0,0,0,800,796,1,0,0,0,
	801,59,1,0,0,0,802,803,5,61,0,0,803,804,3,16,8,0,804,806,5,4,0,0,805,807,
	3,62,31,0,806,805,1,0,0,0,807,808,1,0,0,0,808,806,1,0,0,0,808,809,1,0,0,
	0,809,810,1,0,0,0,810,811,5,6,0,0,811,61,1,0,0,0,812,816,3,302,151,0,813,
	816,3,92,46,0,814,816,3,90,45,0,815,812,1,0,0,0,815,813,1,0,0,0,815,814,
	1,0,0,0,816,817,1,0,0,0,817,818,3,16,8,0,818,819,5,2,0,0,819,63,1,0,0,0,
	820,821,5,62,0,0,821,822,3,16,8,0,822,823,5,4,0,0,823,828,3,66,33,0,824,
	825,5,5,0,0,825,827,3,66,33,0,826,824,1,0,0,0,827,830,1,0,0,0,828,826,1,
	0,0,0,828,829,1,0,0,0,829,832,1,0,0,0,830,828,1,0,0,0,831,833,5,5,0,0,832,
	831,1,0,0,0,832,833,1,0,0,0,833,834,1,0,0,0,834,835,5,6,0,0,835,65,1,0,
	0,0,836,839,3,16,8,0,837,838,5,48,0,0,838,840,5,146,0,0,839,837,1,0,0,0,
	839,840,1,0,0,0,840,67,1,0,0,0,841,842,5,63,0,0,842,843,3,16,8,0,843,844,
	5,50,0,0,844,845,3,302,151,0,845,846,5,2,0,0,846,69,1,0,0,0,847,848,3,302,
	151,0,848,849,5,64,0,0,849,850,3,16,8,0,850,851,5,48,0,0,851,852,3,282,
	141,0,852,853,5,2,0,0,853,71,1,0,0,0,854,855,5,65,0,0,855,859,3,114,57,
	0,856,858,7,8,0,0,857,856,1,0,0,0,858,861,1,0,0,0,859,857,1,0,0,0,859,860,
	1,0,0,0,860,865,1,0,0,0,861,859,1,0,0,0,862,864,3,82,41,0,863,862,1,0,0,
	0,864,867,1,0,0,0,865,863,1,0,0,0,865,866,1,0,0,0,866,871,1,0,0,0,867,865,
	1,0,0,0,868,870,7,8,0,0,869,868,1,0,0,0,870,873,1,0,0,0,871,869,1,0,0,0,
	871,872,1,0,0,0,872,877,1,0,0,0,873,871,1,0,0,0,874,876,3,102,51,0,875,
	874,1,0,0,0,876,879,1,0,0,0,877,875,1,0,0,0,877,878,1,0,0,0,878,880,1,0,
	0,0,879,877,1,0,0,0,880,884,5,4,0,0,881,883,3,122,61,0,882,881,1,0,0,0,
	883,886,1,0,0,0,884,882,1,0,0,0,884,885,1,0,0,0,885,887,1,0,0,0,886,884,
	1,0,0,0,887,888,5,6,0,0,888,73,1,0,0,0,889,890,5,38,0,0,890,894,3,114,57,
	0,891,893,3,76,38,0,892,891,1,0,0,0,893,896,1,0,0,0,894,892,1,0,0,0,894,
	895,1,0,0,0,895,897,1,0,0,0,896,894,1,0,0,0,897,901,5,52,0,0,898,900,3,
	76,38,0,899,898,1,0,0,0,900,903,1,0,0,0,901,899,1,0,0,0,901,902,1,0,0,0,
	902,907,1,0,0,0,903,901,1,0,0,0,904,906,3,102,51,0,905,904,1,0,0,0,906,
	909,1,0,0,0,907,905,1,0,0,0,907,908,1,0,0,0,908,911,1,0,0,0,909,907,1,0,
	0,0,910,912,3,110,55,0,911,910,1,0,0,0,911,912,1,0,0,0,912,913,1,0,0,0,
	913,917,5,4,0,0,914,916,3,122,61,0,915,914,1,0,0,0,916,919,1,0,0,0,917,
	915,1,0,0,0,917,918,1,0,0,0,918,920,1,0,0,0,919,917,1,0,0,0,920,921,5,6,
	0,0,921,75,1,0,0,0,922,926,5,67,0,0,923,926,5,68,0,0,924,926,3,106,53,0,
	925,922,1,0,0,0,925,923,1,0,0,0,925,924,1,0,0,0,926,77,1,0,0,0,927,928,
	5,39,0,0,928,929,5,57,0,0,929,933,5,58,0,0,930,932,3,80,40,0,931,930,1,
	0,0,0,932,935,1,0,0,0,933,931,1,0,0,0,933,934,1,0,0,0,934,936,1,0,0,0,935,
	933,1,0,0,0,936,940,5,52,0,0,937,939,3,80,40,0,938,937,1,0,0,0,939,942,
	1,0,0,0,940,938,1,0,0,0,940,941,1,0,0,0,941,943,1,0,0,0,942,940,1,0,0,0,
	943,947,5,67,0,0,944,946,3,80,40,0,945,944,1,0,0,0,946,949,1,0,0,0,947,
	945,1,0,0,0,947,948,1,0,0,0,948,959,1,0,0,0,949,947,1,0,0,0,950,954,5,4,
	0,0,951,953,3,122,61,0,952,951,1,0,0,0,953,956,1,0,0,0,954,952,1,0,0,0,
	954,955,1,0,0,0,955,957,1,0,0,0,956,954,1,0,0,0,957,960,5,6,0,0,958,960,
	5,2,0,0,959,950,1,0,0,0,959,958,1,0,0,0,960,996,1,0,0,0,961,962,5,39,0,
	0,962,963,5,57,0,0,963,967,5,58,0,0,964,966,3,80,40,0,965,964,1,0,0,0,966,
	969,1,0,0,0,967,965,1,0,0,0,967,968,1,0,0,0,968,970,1,0,0,0,969,967,1,0,
	0,0,970,974,5,67,0,0,971,973,3,80,40,0,972,971,1,0,0,0,973,976,1,0,0,0,
	974,972,1,0,0,0,974,975,1,0,0,0,975,977,1,0,0,0,976,974,1,0,0,0,977,981,
	5,52,0,0,978,980,3,80,40,0,979,978,1,0,0,0,980,983,1,0,0,0,981,979,1,0,
	0,0,981,982,1,0,0,0,982,993,1,0,0,0,983,981,1,0,0,0,984,988,5,4,0,0,985,
	987,3,122,61,0,986,985,1,0,0,0,987,990,1,0,0,0,988,986,1,0,0,0,988,989,
	1,0,0,0,989,991,1,0,0,0,990,988,1,0,0,0,991,994,5,6,0,0,992,994,5,2,0,0,
	993,984,1,0,0,0,993,992,1,0,0,0,994,996,1,0,0,0,995,927,1,0,0,0,995,961,
	1,0,0,0,996,79,1,0,0,0,997,1000,5,68,0,0,998,1000,3,106,53,0,999,997,1,
	0,0,0,999,998,1,0,0,0,1000,81,1,0,0,0,1001,1002,5,181,0,0,1002,1003,3,266,
	133,0,1003,83,1,0,0,0,1004,1006,3,88,44,0,1005,1004,1,0,0,0,1005,1006,1,
	0,0,0,1006,1007,1,0,0,0,1007,1012,3,302,151,0,1008,1011,3,292,146,0,1009,
	1011,3,106,53,0,1010,1008,1,0,0,0,1010,1009,1,0,0,0,1011,1014,1,0,0,0,1012,
	1010,1,0,0,0,1012,1013,1,0,0,0,1013,1015,1,0,0,0,1014,1012,1,0,0,0,1015,
	1022,3,16,8,0,1016,1017,5,48,0,0,1017,1020,3,282,141,0,1018,1019,7,9,0,
	0,1019,1021,3,142,71,0,1020,1018,1,0,0,0,1020,1021,1,0,0,0,1021,1023,1,
	0,0,0,1022,1016,1,0,0,0,1022,1023,1,0,0,0,1023,1024,1,0,0,0,1024,1025,5,
	2,0,0,1025,1087,1,0,0,0,1026,1031,3,302,151,0,1027,1030,3,292,146,0,1028,
	1030,3,106,53,0,1029,1027,1,0,0,0,1029,1028,1,0,0,0,1030,1033,1,0,0,0,1031,
	1029,1,0,0,0,1031,1032,1,0,0,0,1032,1034,1,0,0,0,1033,1031,1,0,0,0,1034,
	1039,3,88,44,0,1035,1038,3,292,146,0,1036,1038,3,106,53,0,1037,1035,1,0,
	0,0,1037,1036,1,0,0,0,1038,1041,1,0,0,0,1039,1037,1,0,0,0,1039,1040,1,0,
	0,0,1040,1042,1,0,0,0,1041,1039,1,0,0,0,1042,1049,3,16,8,0,1043,1044,5,
	48,0,0,1044,1047,3,282,141,0,1045,1046,7,9,0,0,1046,1048,3,142,71,0,1047,
	1045,1,0,0,0,1047,1048,1,0,0,0,1048,1050,1,0,0,0,1049,1043,1,0,0,0,1049,
	1050,1,0,0,0,1050,1051,1,0,0,0,1051,1052,5,2,0,0,1052,1087,1,0,0,0,1053,
	1055,3,88,44,0,1054,1053,1,0,0,0,1054,1055,1,0,0,0,1055,1057,1,0,0,0,1056,
	1058,5,40,0,0,1057,1056,1,0,0,0,1057,1058,1,0,0,0,1058,1059,1,0,0,0,1059,
	1063,3,90,45,0,1060,1062,3,86,43,0,1061,1060,1,0,0,0,1062,1065,1,0,0,0,
	1063,1061,1,0,0,0,1063,1064,1,0,0,0,1064,1066,1,0,0,0,1065,1063,1,0,0,0,
	1066,1067,3,16,8,0,1067,1068,5,2,0,0,1068,1087,1,0,0,0,1069,1071,3,88,44,
	0,1070,1069,1,0,0,0,1070,1071,1,0,0,0,1071,1072,1,0,0,0,1072,1076,3,92,
	46,0,1073,1075,3,86,43,0,1074,1073,1,0,0,0,1075,1078,1,0,0,0,1076,1074,
	1,0,0,0,1076,1077,1,0,0,0,1077,1079,1,0,0,0,1078,1076,1,0,0,0,1079,1082,
	3,16,8,0,1080,1081,5,48,0,0,1081,1083,3,282,141,0,1082,1080,1,0,0,0,1082,
	1083,1,0,0,0,1083,1084,1,0,0,0,1084,1085,5,2,0,0,1085,1087,1,0,0,0,1086,
	1005,1,0,0,0,1086,1026,1,0,0,0,1086,1054,1,0,0,0,1086,1070,1,0,0,0,1087,
	85,1,0,0,0,1088,1092,3,292,146,0,1089,1092,3,88,44,0,1090,1092,3,106,53,
	0,1091,1088,1,0,0,0,1091,1089,1,0,0,0,1091,1090,1,0,0,0,1092,87,1,0,0,0,
	1093,1094,7,10,0,0,1094,89,1,0,0,0,1095,1096,5,80,0,0,1096,1097,5,57,0,
	0,1097,1099,3,302,151,0,1098,1100,3,16,8,0,1099,1098,1,0,0,0,1099,1100,
	1,0,0,0,1100,1101,1,0,0,0,1101,1102,5,81,0,0,1102,1104,3,302,151,0,1103,
	1105,3,16,8,0,1104,1103,1,0,0,0,1104,1105,1,0,0,0,1105,1106,1,0,0,0,1106,
	1107,5,58,0,0,1107,1135,1,0,0,0,1108,1109,5,80,0,0,1109,1110,5,57,0,0,1110,
	1112,3,302,151,0,1111,1113,3,16,8,0,1112,1111,1,0,0,0,1112,1113,1,0,0,0,
	1113,1114,1,0,0,0,1114,1115,5,81,0,0,1115,1117,3,90,45,0,1116,1118,3,16,
	8,0,1117,1116,1,0,0,0,1117,1118,1,0,0,0,1118,1119,1,0,0,0,1119,1120,5,58,
	0,0,1120,1135,1,0,0,0,1121,1122,5,80,0,0,1122,1123,5,57,0,0,1123,1125,3,
	302,151,0,1124,1126,3,16,8,0,1125,1124,1,0,0,0,1125,1126,1,0,0,0,1126,1127,
	1,0,0,0,1127,1128,5,81,0,0,1128,1130,3,92,46,0,1129,1131,3,16,8,0,1130,
	1129,1,0,0,0,1130,1131,1,0,0,0,1131,1132,1,0,0,0,1132,1133,5,58,0,0,1133,
	1135,1,0,0,0,1134,1095,1,0,0,0,1134,1108,1,0,0,0,1134,1121,1,0,0,0,1135,
	91,1,0,0,0,1136,1137,6,46,-1,0,1137,1138,3,304,152,0,1138,1140,5,82,0,0,
	1139,1141,3,282,141,0,1140,1139,1,0,0,0,1140,1141,1,0,0,0,1141,1142,1,0,
	0,0,1142,1143,5,83,0,0,1143,1159,1,0,0,0,1144,1145,3,302,151,0,1145,1147,
	5,82,0,0,1146,1148,3,282,141,0,1147,1146,1,0,0,0,1147,1148,1,0,0,0,1148,
	1149,1,0,0,0,1149,1150,5,83,0,0,1150,1159,1,0,0,0,1151,1152,3,90,45,0,1152,
	1154,5,82,0,0,1153,1155,3,282,141,0,1154,1153,1,0,0,0,1154,1155,1,0,0,0,
	1155,1156,1,0,0,0,1156,1157,5,83,0,0,1157,1159,1,0,0,0,1158,1136,1,0,0,
	0,1158,1144,1,0,0,0,1158,1151,1,0,0,0,1159,1168,1,0,0,0,1160,1161,10,1,
	0,0,1161,1163,5,82,0,0,1162,1164,3,282,141,0,1163,1162,1,0,0,0,1163,1164,
	1,0,0,0,1164,1165,1,0,0,0,1165,1167,5,83,0,0,1166,1160,1,0,0,0,1167,1170,
	1,0,0,0,1168,1166,1,0,0,0,1168,1169,1,0,0,0,1169,93,1,0,0,0,1170,1168,1,
	0,0,0,1171,1172,5,84,0,0,1172,1174,5,181,0,0,1173,1175,3,114,57,0,1174,
	1173,1,0,0,0,1174,1175,1,0,0,0,1175,1180,1,0,0,0,1176,1179,5,68,0,0,1177,
	1179,3,106,53,0,1178,1176,1,0,0,0,1178,1177,1,0,0,0,1179,1182,1,0,0,0,1180,
	1178,1,0,0,0,1180,1181,1,0,0,0,1181,1192,1,0,0,0,1182,1180,1,0,0,0,1183,
	1187,5,4,0,0,1184,1186,3,96,48,0,1185,1184,1,0,0,0,1186,1189,1,0,0,0,1187,
	1185,1,0,0,0,1187,1188,1,0,0,0,1188,1190,1,0,0,0,1189,1187,1,0,0,0,1190,
	1193,5,6,0,0,1191,1193,5,2,0,0,1192,1183,1,0,0,0,1192,1191,1,0,0,0,1193,
	95,1,0,0,0,1194,1197,3,98,49,0,1195,1197,3,122,61,0,1196,1194,1,0,0,0,1196,
	1195,1,0,0,0,1197,97,1,0,0,0,1198,1199,5,43,0,0,1199,1200,5,2,0,0,1200,
	99,1,0,0,0,1201,1202,5,9,0,0,1202,1203,3,18,9,0,1203,1208,3,114,57,0,1204,
	1207,3,104,52,0,1205,1207,3,102,51,0,1206,1204,1,0,0,0,1206,1205,1,0,0,
	0,1207,1210,1,0,0,0,1208,1206,1,0,0,0,1208,1209,1,0,0,0,1209,1212,1,0,0,
	0,1210,1208,1,0,0,0,1211,1213,3,110,55,0,1212,1211,1,0,0,0,1212,1213,1,
	0,0,0,1213,1214,1,0,0,0,1214,1218,5,4,0,0,1215,1217,3,122,61,0,1216,1215,
	1,0,0,0,1217,1220,1,0,0,0,1218,1216,1,0,0,0,1218,1219,1,0,0,0,1219,1221,
	1,0,0,0,1220,1218,1,0,0,0,1221,1222,5,6,0,0,1222,101,1,0,0,0,1223,1224,
	5,181,0,0,1224,1226,5,7,0,0,1225,1223,1,0,0,0,1225,1226,1,0,0,0,1226,1227,
	1,0,0,0,1227,1229,5,181,0,0,1228,1230,3,266,133,0,1229,1228,1,0,0,0,1229,
	1230,1,0,0,0,1230,103,1,0,0,0,1231,1245,5,85,0,0,1232,1245,5,86,0,0,1233,
	1245,5,66,0,0,1234,1245,5,52,0,0,1235,1245,5,51,0,0,1236,1245,5,79,0,0,
	1237,1245,5,67,0,0,1238,1245,3,106,53,0,1239,1245,5,68,0,0,1240,1245,3,
	108,54,0,1241,1245,5,29,0,0,1242,1245,5,30,0,0,1243,1245,5,28,0,0,1244,
	1231,1,0,0,0,1244,1232,1,0,0,0,1244,1233,1,0,0,0,1244,1234,1,0,0,0,1244,
	1235,1,0,0,0,1244,1236,1,0,0,0,1244,1237,1,0,0,0,1244,1238,1,0,0,0,1244,
	1239,1,0,0,0,1244,1240,1,0,0,0,1244,1241,1,0,0,0,1244,1242,1,0,0,0,1244,
	1243,1,0,0,0,1245,105,1,0,0,0,1246,1257,5,87,0,0,1247,1248,5,57,0,0,1248,
	1253,5,181,0,0,1249,1250,5,5,0,0,1250,1252,5,181,0,0,1251,1249,1,0,0,0,
	1252,1255,1,0,0,0,1253,1251,1,0,0,0,1253,1254,1,0,0,0,1254,1256,1,0,0,0,
	1255,1253,1,0,0,0,1256,1258,5,58,0,0,1257,1247,1,0,0,0,1257,1258,1,0,0,
	0,1258,107,1,0,0,0,1259,1263,5,31,0,0,1260,1261,5,57,0,0,1261,1262,5,146,
	0,0,1262,1264,5,58,0,0,1263,1260,1,0,0,0,1263,1264,1,0,0,0,1264,109,1,0,
	0,0,1265,1266,5,88,0,0,1266,1267,5,57,0,0,1267,1272,3,112,56,0,1268,1269,
	5,5,0,0,1269,1271,3,112,56,0,1270,1268,1,0,0,0,1271,1274,1,0,0,0,1272,1270,
	1,0,0,0,1272,1273,1,0,0,0,1273,1276,1,0,0,0,1274,1272,1,0,0,0,1275,1277,
	5,5,0,0,1276,1275,1,0,0,0,1276,1277,1,0,0,0,1277,1278,1,0,0,0,1278,1279,
	5,58,0,0,1279,111,1,0,0,0,1280,1284,3,302,151,0,1281,1283,3,292,146,0,1282,
	1281,1,0,0,0,1283,1286,1,0,0,0,1284,1282,1,0,0,0,1284,1285,1,0,0,0,1285,
	1288,1,0,0,0,1286,1284,1,0,0,0,1287,1289,3,16,8,0,1288,1287,1,0,0,0,1288,
	1289,1,0,0,0,1289,1311,1,0,0,0,1290,1294,3,92,46,0,1291,1293,3,292,146,
	0,1292,1291,1,0,0,0,1293,1296,1,0,0,0,1294,1292,1,0,0,0,1294,1295,1,0,0,
	0,1295,1298,1,0,0,0,1296,1294,1,0,0,0,1297,1299,3,16,8,0,1298,1297,1,0,
	0,0,1298,1299,1,0,0,0,1299,1311,1,0,0,0,1300,1304,3,90,45,0,1301,1303,3,
	292,146,0,1302,1301,1,0,0,0,1303,1306,1,0,0,0,1304,1302,1,0,0,0,1304,1305,
	1,0,0,0,1305,1308,1,0,0,0,1306,1304,1,0,0,0,1307,1309,3,16,8,0,1308,1307,
	1,0,0,0,1308,1309,1,0,0,0,1309,1311,1,0,0,0,1310,1280,1,0,0,0,1310,1290,
	1,0,0,0,1310,1300,1,0,0,0,1311,113,1,0,0,0,1312,1324,5,57,0,0,1313,1318,
	3,116,58,0,1314,1315,5,5,0,0,1315,1317,3,116,58,0,1316,1314,1,0,0,0,1317,
	1320,1,0,0,0,1318,1316,1,0,0,0,1318,1319,1,0,0,0,1319,1322,1,0,0,0,1320,
	1318,1,0,0,0,1321,1323,5,5,0,0,1322,1321,1,0,0,0,1322,1323,1,0,0,0,1323,
	1325,1,0,0,0,1324,1313,1,0,0,0,1324,1325,1,0,0,0,1325,1326,1,0,0,0,1326,
	1327,5,58,0,0,1327,115,1,0,0,0,1328,1332,3,302,151,0,1329,1331,3,292,146,
	0,1330,1329,1,0,0,0,1331,1334,1,0,0,0,1332,1330,1,0,0,0,1332,1333,1,0,0,
	0,1333,1336,1,0,0,0,1334,1332,1,0,0,0,1335,1337,3,16,8,0,1336,1335,1,0,
	0,0,1336,1337,1,0,0,0,1337,1359,1,0,0,0,1338,1342,3,92,46,0,1339,1341,3,
	292,146,0,1340,1339,1,0,0,0,1341,1344,1,0,0,0,1342,1340,1,0,0,0,1342,1343,
	1,0,0,0,1343,1346,1,0,0,0,1344,1342,1,0,0,0,1345,1347,3,16,8,0,1346,1345,
	1,0,0,0,1346,1347,1,0,0,0,1347,1359,1,0,0,0,1348,1352,3,90,45,0,1349,1351,
	3,292,146,0,1350,1349,1,0,0,0,1351,1354,1,0,0,0,1352,1350,1,0,0,0,1352,
	1353,1,0,0,0,1353,1356,1,0,0,0,1354,1352,1,0,0,0,1355,1357,3,16,8,0,1356,
	1355,1,0,0,0,1356,1357,1,0,0,0,1357,1359,1,0,0,0,1358,1328,1,0,0,0,1358,
	1338,1,0,0,0,1358,1348,1,0,0,0,1359,117,1,0,0,0,1360,1361,3,122,61,0,1361,
	119,1,0,0,0,1362,1366,5,4,0,0,1363,1365,3,122,61,0,1364,1363,1,0,0,0,1365,
	1368,1,0,0,0,1366,1364,1,0,0,0,1366,1367,1,0,0,0,1367,1369,1,0,0,0,1368,
	1366,1,0,0,0,1369,1370,5,6,0,0,1370,121,1,0,0,0,1371,1403,3,98,49,0,1372,
	1403,3,120,60,0,1373,1403,3,130,65,0,1374,1403,3,124,62,0,1375,1403,3,126,
	63,0,1376,1403,3,152,76,0,1377,1403,3,158,79,0,1378,1403,3,156,78,0,1379,
	1403,3,144,72,0,1380,1403,3,170,85,0,1381,1403,3,172,86,0,1382,1403,3,174,
	87,0,1383,1403,3,176,88,0,1384,1403,3,198,99,0,1385,1403,3,150,75,0,1386,
	1403,3,146,73,0,1387,1403,3,148,74,0,1388,1403,3,200,100,0,1389,1403,3,
	242,121,0,1390,1403,3,254,127,0,1391,1403,3,256,128,0,1392,1403,3,168,84,
	0,1393,1403,3,234,117,0,1394,1403,3,236,118,0,1395,1403,3,248,124,0,1396,
	1403,3,250,125,0,1397,1403,3,288,144,0,1398,1403,3,132,66,0,1399,1403,3,
	136,68,0,1400,1403,3,138,69,0,1401,1403,3,140,70,0,1402,1371,1,0,0,0,1402,
	1372,1,0,0,0,1402,1373,1,0,0,0,1402,1374,1,0,0,0,1402,1375,1,0,0,0,1402,
	1376,1,0,0,0,1402,1377,1,0,0,0,1402,1378,1,0,0,0,1402,1379,1,0,0,0,1402,
	1380,1,0,0,0,1402,1381,1,0,0,0,1402,1382,1,0,0,0,1402,1383,1,0,0,0,1402,
	1384,1,0,0,0,1402,1385,1,0,0,0,1402,1386,1,0,0,0,1402,1387,1,0,0,0,1402,
	1388,1,0,0,0,1402,1389,1,0,0,0,1402,1390,1,0,0,0,1402,1391,1,0,0,0,1402,
	1392,1,0,0,0,1402,1393,1,0,0,0,1402,1394,1,0,0,0,1402,1395,1,0,0,0,1402,
	1396,1,0,0,0,1402,1397,1,0,0,0,1402,1398,1,0,0,0,1402,1399,1,0,0,0,1402,
	1400,1,0,0,0,1402,1401,1,0,0,0,1403,123,1,0,0,0,1404,1412,3,128,64,0,1405,
	1407,5,82,0,0,1406,1408,3,282,141,0,1407,1406,1,0,0,0,1407,1408,1,0,0,0,
	1408,1409,1,0,0,0,1409,1411,5,83,0,0,1410,1405,1,0,0,0,1411,1414,1,0,0,
	0,1412,1410,1,0,0,0,1412,1413,1,0,0,0,1413,1415,1,0,0,0,1414,1412,1,0,0,
	0,1415,1416,5,2,0,0,1416,1432,1,0,0,0,1417,1418,5,57,0,0,1418,1424,3,128,
	64,0,1419,1421,5,82,0,0,1420,1422,3,282,141,0,1421,1420,1,0,0,0,1421,1422,
	1,0,0,0,1422,1423,1,0,0,0,1423,1425,5,83,0,0,1424,1419,1,0,0,0,1425,1426,
	1,0,0,0,1426,1424,1,0,0,0,1426,1427,1,0,0,0,1427,1428,1,0,0,0,1428,1429,
	5,58,0,0,1429,1430,5,2,0,0,1430,1432,1,0,0,0,1431,1404,1,0,0,0,1431,1417,
	1,0,0,0,1432,125,1,0,0,0,1433,1441,5,181,0,0,1434,1436,5,82,0,0,1435,1437,
	3,282,141,0,1436,1435,1,0,0,0,1436,1437,1,0,0,0,1437,1438,1,0,0,0,1438,
	1440,5,83,0,0,1439,1434,1,0,0,0,1440,1443,1,0,0,0,1441,1439,1,0,0,0,1441,
	1442,1,0,0,0,1442,1444,1,0,0,0,1443,1441,1,0,0,0,1444,1445,5,82,0,0,1445,
	1453,5,83,0,0,1446,1448,5,82,0,0,1447,1449,3,282,141,0,1448,1447,1,0,0,
	0,1448,1449,1,0,0,0,1449,1450,1,0,0,0,1450,1452,5,83,0,0,1451,1446,1,0,
	0,0,1452,1455,1,0,0,0,1453,1451,1,0,0,0,1453,1454,1,0,0,0,1454,1456,1,0,
	0,0,1455,1453,1,0,0,0,1456,1457,5,2,0,0,1457,127,1,0,0,0,1458,1473,5,147,
	0,0,1459,1473,5,148,0,0,1460,1473,5,150,0,0,1461,1473,5,149,0,0,1462,1473,
	5,157,0,0,1463,1473,5,158,0,0,1464,1473,5,159,0,0,1465,1473,5,160,0,0,1466,
	1473,5,89,0,0,1467,1473,5,90,0,0,1468,1470,5,91,0,0,1469,1471,5,67,0,0,
	1470,1469,1,0,0,0,1470,1471,1,0,0,0,1471,1473,1,0,0,0,1472,1458,1,0,0,0,
	1472,1459,1,0,0,0,1472,1460,1,0,0,0,1472,1461,1,0,0,0,1472,1462,1,0,0,0,
	1472,1463,1,0,0,0,1472,1464,1,0,0,0,1472,1465,1,0,0,0,1472,1466,1,0,0,0,
	1472,1467,1,0,0,0,1472,1468,1,0,0,0,1473,129,1,0,0,0,1474,1475,5,63,0,0,
	1475,1476,5,57,0,0,1476,1477,3,302,151,0,1477,1478,5,58,0,0,1478,1479,5,
	2,0,0,1479,131,1,0,0,0,1480,1481,7,11,0,0,1481,1482,5,7,0,0,1482,1483,5,
	181,0,0,1483,1485,3,270,135,0,1484,1486,3,134,67,0,1485,1484,1,0,0,0,1485,
	1486,1,0,0,0,1486,1487,1,0,0,0,1487,1488,5,2,0,0,1488,133,1,0,0,0,1489,
	1490,5,7,0,0,1490,1494,5,91,0,0,1491,1492,5,7,0,0,1492,1494,5,181,0,0,1493,
	1489,1,0,0,0,1493,1491,1,0,0,0,1494,135,1,0,0,0,1495,1496,5,92,0,0,1496,
	1497,5,181,0,0,1497,1498,3,270,135,0,1498,1499,5,2,0,0,1499,137,1,0,0,0,
	1500,1503,5,57,0,0,1501,1502,5,42,0,0,1502,1504,5,7,0,0,1503,1501,1,0,0,
	0,1503,1504,1,0,0,0,1504,1505,1,0,0,0,1505,1506,5,181,0,0,1506,1507,5,167,
	0,0,1507,1508,5,58,0,0,1508,1509,5,57,0,0,1509,1510,5,58,0,0,1510,1511,
	5,2,0,0,1511,139,1,0,0,0,1512,1593,3,282,141,0,1513,1514,7,9,0,0,1514,1594,
	3,142,71,0,1515,1516,5,166,0,0,1516,1517,5,57,0,0,1517,1518,5,58,0,0,1518,
	1519,5,166,0,0,1519,1520,5,57,0,0,1520,1521,5,58,0,0,1521,1522,5,166,0,
	0,1522,1523,5,57,0,0,1523,1526,5,58,0,0,1524,1525,5,48,0,0,1525,1527,3,
	282,141,0,1526,1524,1,0,0,0,1526,1527,1,0,0,0,1527,1594,1,0,0,0,1528,1529,
	5,166,0,0,1529,1530,5,57,0,0,1530,1531,5,58,0,0,1531,1532,5,166,0,0,1532,
	1533,5,57,0,0,1533,1534,5,58,0,0,1534,1535,5,48,0,0,1535,1544,3,282,141,
	0,1536,1537,5,166,0,0,1537,1538,5,57,0,0,1538,1542,5,58,0,0,1539,1540,5,
	166,0,0,1540,1541,5,57,0,0,1541,1543,5,58,0,0,1542,1539,1,0,0,0,1542,1543,
	1,0,0,0,1543,1545,1,0,0,0,1544,1536,1,0,0,0,1544,1545,1,0,0,0,1545,1594,
	1,0,0,0,1546,1547,5,166,0,0,1547,1548,5,57,0,0,1548,1549,5,58,0,0,1549,
	1550,5,166,0,0,1550,1552,5,57,0,0,1551,1553,3,166,83,0,1552,1551,1,0,0,
	0,1552,1553,1,0,0,0,1553,1554,1,0,0,0,1554,1594,5,58,0,0,1555,1556,5,166,
	0,0,1556,1557,5,57,0,0,1557,1558,5,58,0,0,1558,1559,5,7,0,0,1559,1560,3,
	16,8,0,1560,1561,5,48,0,0,1561,1562,3,282,141,0,1562,1594,1,0,0,0,1563,
	1564,5,166,0,0,1564,1565,5,57,0,0,1565,1566,5,58,0,0,1566,1567,7,9,0,0,
	1567,1576,3,282,141,0,1568,1569,5,166,0,0,1569,1570,5,57,0,0,1570,1574,
	5,58,0,0,1571,1572,5,166,0,0,1572,1573,5,57,0,0,1573,1575,5,58,0,0,1574,
	1571,1,0,0,0,1574,1575,1,0,0,0,1575,1577,1,0,0,0,1576,1568,1,0,0,0,1576,
	1577,1,0,0,0,1577,1594,1,0,0,0,1578,1579,5,166,0,0,1579,1581,5,57,0,0,1580,
	1582,3,166,83,0,1581,1580,1,0,0,0,1581,1582,1,0,0,0,1582,1583,1,0,0,0,1583,
	1594,5,58,0,0,1584,1585,5,167,0,0,1585,1586,5,57,0,0,1586,1594,5,58,0,0,
	1587,1588,5,170,0,0,1588,1589,5,57,0,0,1589,1590,3,282,141,0,1590,1591,
	5,58,0,0,1591,1594,1,0,0,0,1592,1594,7,12,0,0,1593,1513,1,0,0,0,1593,1515,
	1,0,0,0,1593,1528,1,0,0,0,1593,1546,1,0,0,0,1593,1555,1,0,0,0,1593,1563,
	1,0,0,0,1593,1578,1,0,0,0,1593,1584,1,0,0,0,1593,1587,1,0,0,0,1593,1592,
	1,0,0,0,1593,1594,1,0,0,0,1594,1595,1,0,0,0,1595,1596,5,2,0,0,1596,141,
	1,0,0,0,1597,1600,3,282,141,0,1598,1599,7,9,0,0,1599,1601,3,142,71,0,1600,
	1598,1,0,0,0,1600,1601,1,0,0,0,1601,143,1,0,0,0,1602,1603,7,13,0,0,1603,
	1604,3,282,141,0,1604,1605,5,2,0,0,1605,145,1,0,0,0,1606,1607,5,95,0,0,
	1607,1648,5,2,0,0,1608,1609,5,95,0,0,1609,1610,5,181,0,0,1610,1611,5,166,
	0,0,1611,1612,5,57,0,0,1612,1613,5,58,0,0,1613,1648,5,2,0,0,1614,1615,5,
	95,0,0,1615,1616,3,282,141,0,1616,1617,7,9,0,0,1617,1618,3,142,71,0,1618,
	1619,5,2,0,0,1619,1648,1,0,0,0,1620,1621,5,95,0,0,1621,1626,3,282,141,0,
	1622,1623,5,5,0,0,1623,1625,3,282,141,0,1624,1622,1,0,0,0,1625,1628,1,0,
	0,0,1626,1624,1,0,0,0,1626,1627,1,0,0,0,1627,1629,1,0,0,0,1628,1626,1,0,
	0,0,1629,1630,5,2,0,0,1630,1648,1,0,0,0,1631,1632,5,95,0,0,1632,1633,5,
	57,0,0,1633,1638,3,282,141,0,1634,1635,5,5,0,0,1635,1637,3,282,141,0,1636,
	1634,1,0,0,0,1637,1640,1,0,0,0,1638,1636,1,0,0,0,1638,1639,1,0,0,0,1639,
	1642,1,0,0,0,1640,1638,1,0,0,0,1641,1643,5,5,0,0,1642,1641,1,0,0,0,1642,
	1643,1,0,0,0,1643,1644,1,0,0,0,1644,1645,5,58,0,0,1645,1646,5,2,0,0,1646,
	1648,1,0,0,0,1647,1606,1,0,0,0,1647,1608,1,0,0,0,1647,1614,1,0,0,0,1647,
	1620,1,0,0,0,1647,1631,1,0,0,0,1648,147,1,0,0,0,1649,1650,5,30,0,0,1650,
	1651,5,57,0,0,1651,1652,3,282,141,0,1652,1653,5,58,0,0,1653,1654,5,2,0,
	0,1654,1658,1,0,0,0,1655,1656,5,30,0,0,1656,1658,5,2,0,0,1657,1649,1,0,
	0,0,1657,1655,1,0,0,0,1658,149,1,0,0,0,1659,1660,5,96,0,0,1660,1663,5,181,
	0,0,1661,1662,5,7,0,0,1662,1664,5,181,0,0,1663,1661,1,0,0,0,1663,1664,1,
	0,0,0,1664,1665,1,0,0,0,1665,1666,5,57,0,0,1666,1678,5,4,0,0,1667,1672,
	3,264,132,0,1668,1669,5,5,0,0,1669,1671,3,264,132,0,1670,1668,1,0,0,0,1671,
	1674,1,0,0,0,1672,1670,1,0,0,0,1672,1673,1,0,0,0,1673,1676,1,0,0,0,1674,
	1672,1,0,0,0,1675,1677,5,5,0,0,1676,1675,1,0,0,0,1676,1677,1,0,0,0,1677,
	1679,1,0,0,0,1678,1667,1,0,0,0,1678,1679,1,0,0,0,1679,1680,1,0,0,0,1680,
	1681,5,6,0,0,1681,1682,5,58,0,0,1682,1693,5,2,0,0,1683,1684,5,96,0,0,1684,
	1687,5,181,0,0,1685,1686,5,7,0,0,1686,1688,5,181,0,0,1687,1685,1,0,0,0,
	1687,1688,1,0,0,0,1688,1689,1,0,0,0,1689,1690,3,266,133,0,1690,1691,5,2,
	0,0,1691,1693,1,0,0,0,1692,1659,1,0,0,0,1692,1683,1,0,0,0,1693,151,1,0,
	0,0,1694,1698,3,154,77,0,1695,1697,3,292,146,0,1696,1695,1,0,0,0,1697,1700,
	1,0,0,0,1698,1696,1,0,0,0,1698,1699,1,0,0,0,1699,1701,1,0,0,0,1700,1698,
	1,0,0,0,1701,1709,3,16,8,0,1702,1703,5,48,0,0,1703,1707,3,282,141,0,1704,
	1705,5,166,0,0,1705,1706,5,57,0,0,1706,1708,5,58,0,0,1707,1704,1,0,0,0,
	1707,1708,1,0,0,0,1708,1710,1,0,0,0,1709,1702,1,0,0,0,1709,1710,1,0,0,0,
	1710,1711,1,0,0,0,1711,1712,5,2,0,0,1712,1768,1,0,0,0,1713,1717,3,92,46,
	0,1714,1716,3,292,146,0,1715,1714,1,0,0,0,1716,1719,1,0,0,0,1717,1715,1,
	0,0,0,1717,1718,1,0,0,0,1718,1720,1,0,0,0,1719,1717,1,0,0,0,1720,1728,3,
	16,8,0,1721,1722,5,48,0,0,1722,1726,3,282,141,0,1723,1724,5,166,0,0,1724,
	1725,5,57,0,0,1725,1727,5,58,0,0,1726,1723,1,0,0,0,1726,1727,1,0,0,0,1727,
	1729,1,0,0,0,1728,1721,1,0,0,0,1728,1729,1,0,0,0,1729,1730,1,0,0,0,1730,
	1731,5,2,0,0,1731,1768,1,0,0,0,1732,1736,3,302,151,0,1733,1735,3,292,146,
	0,1734,1733,1,0,0,0,1735,1738,1,0,0,0,1736,1734,1,0,0,0,1736,1737,1,0,0,
	0,1737,1739,1,0,0,0,1738,1736,1,0,0,0,1739,1749,3,16,8,0,1740,1741,5,48,
	0,0,1741,1747,3,282,141,0,1742,1743,7,9,0,0,1743,1748,3,142,71,0,1744,1745,
	5,166,0,0,1745,1746,5,57,0,0,1746,1748,5,58,0,0,1747,1742,1,0,0,0,1747,
	1744,1,0,0,0,1747,1748,1,0,0,0,1748,1750,1,0,0,0,1749,1740,1,0,0,0,1749,
	1750,1,0,0,0,1750,1751,1,0,0,0,1751,1752,5,2,0,0,1752,1768,1,0,0,0,1753,
	1757,3,90,45,0,1754,1756,3,292,146,0,1755,1754,1,0,0,0,1756,1759,1,0,0,
	0,1757,1755,1,0,0,0,1757,1758,1,0,0,0,1758,1760,1,0,0,0,1759,1757,1,0,0,
	0,1760,1763,3,16,8,0,1761,1762,5,48,0,0,1762,1764,3,282,141,0,1763,1761,
	1,0,0,0,1763,1764,1,0,0,0,1764,1765,1,0,0,0,1765,1766,5,2,0,0,1766,1768,
	1,0,0,0,1767,1694,1,0,0,0,1767,1713,1,0,0,0,1767,1732,1,0,0,0,1767,1753,
	1,0,0,0,1768,153,1,0,0,0,1769,1775,3,304,152,0,1770,1772,5,82,0,0,1771,
	1773,3,282,141,0,1772,1771,1,0,0,0,1772,1773,1,0,0,0,1773,1774,1,0,0,0,
	1774,1776,5,83,0,0,1775,1770,1,0,0,0,1776,1777,1,0,0,0,1777,1775,1,0,0,
	0,1777,1778,1,0,0,0,1778,155,1,0,0,0,1779,1780,3,302,151,0,1780,1785,5,
	181,0,0,1781,1782,5,5,0,0,1782,1783,3,302,151,0,1783,1784,5,181,0,0,1784,
	1786,1,0,0,0,1785,1781,1,0,0,0,1786,1787,1,0,0,0,1787,1785,1,0,0,0,1787,
	1788,1,0,0,0,1788,1789,1,0,0,0,1789,1790,5,48,0,0,1790,1791,3,282,141,0,
	1791,1792,5,2,0,0,1792,1856,1,0,0,0,1793,1794,5,57,0,0,1794,1797,3,164,
	82,0,1795,1796,5,5,0,0,1796,1798,3,164,82,0,1797,1795,1,0,0,0,1798,1799,
	1,0,0,0,1799,1797,1,0,0,0,1799,1800,1,0,0,0,1800,1801,1,0,0,0,1801,1802,
	5,58,0,0,1802,1803,5,48,0,0,1803,1804,5,57,0,0,1804,1807,3,282,141,0,1805,
	1806,5,5,0,0,1806,1808,3,282,141,0,1807,1805,1,0,0,0,1808,1809,1,0,0,0,
	1809,1807,1,0,0,0,1809,1810,1,0,0,0,1810,1811,1,0,0,0,1811,1812,5,58,0,
	0,1812,1813,5,2,0,0,1813,1856,1,0,0,0,1814,1815,5,57,0,0,1815,1818,3,164,
	82,0,1816,1817,5,5,0,0,1817,1819,3,164,82,0,1818,1816,1,0,0,0,1819,1820,
	1,0,0,0,1820,1818,1,0,0,0,1820,1821,1,0,0,0,1821,1822,1,0,0,0,1822,1823,
	5,58,0,0,1823,1824,5,48,0,0,1824,1825,3,282,141,0,1825,1826,5,2,0,0,1826,
	1856,1,0,0,0,1827,1828,5,57,0,0,1828,1832,3,302,151,0,1829,1831,3,292,146,
	0,1830,1829,1,0,0,0,1831,1834,1,0,0,0,1832,1830,1,0,0,0,1832,1833,1,0,0,
	0,1833,1835,1,0,0,0,1834,1832,1,0,0,0,1835,1836,3,16,8,0,1836,1837,5,58,
	0,0,1837,1838,5,48,0,0,1838,1839,3,282,141,0,1839,1840,5,2,0,0,1840,1856,
	1,0,0,0,1841,1842,5,57,0,0,1842,1846,3,92,46,0,1843,1845,3,292,146,0,1844,
	1843,1,0,0,0,1845,1848,1,0,0,0,1846,1844,1,0,0,0,1846,1847,1,0,0,0,1847,
	1849,1,0,0,0,1848,1846,1,0,0,0,1849,1850,3,16,8,0,1850,1851,5,58,0,0,1851,
	1852,5,48,0,0,1852,1853,3,282,141,0,1853,1854,5,2,0,0,1854,1856,1,0,0,0,
	1855,1779,1,0,0,0,1855,1793,1,0,0,0,1855,1814,1,0,0,0,1855,1827,1,0,0,0,
	1855,1841,1,0,0,0,1856,157,1,0,0,0,1857,1858,4,79,2,0,1858,1859,3,160,80,
	0,1859,1860,5,48,0,0,1860,1861,3,282,141,0,1861,1862,5,2,0,0,1862,159,1,
	0,0,0,1863,1865,5,57,0,0,1864,1866,3,162,81,0,1865,1864,1,0,0,0,1865,1866,
	1,0,0,0,1866,1873,1,0,0,0,1867,1869,5,5,0,0,1868,1870,3,162,81,0,1869,1868,
	1,0,0,0,1869,1870,1,0,0,0,1870,1872,1,0,0,0,1871,1867,1,0,0,0,1872,1875,
	1,0,0,0,1873,1871,1,0,0,0,1873,1874,1,0,0,0,1874,1876,1,0,0,0,1875,1873,
	1,0,0,0,1876,1877,5,58,0,0,1877,161,1,0,0,0,1878,1882,3,302,151,0,1879,
	1881,3,292,146,0,1880,1879,1,0,0,0,1881,1884,1,0,0,0,1882,1880,1,0,0,0,
	1882,1883,1,0,0,0,1883,1885,1,0,0,0,1884,1882,1,0,0,0,1885,1886,3,16,8,
	0,1886,1913,1,0,0,0,1887,1891,3,92,46,0,1888,1890,3,292,146,0,1889,1888,
	1,0,0,0,1890,1893,1,0,0,0,1891,1889,1,0,0,0,1891,1892,1,0,0,0,1892,1894,
	1,0,0,0,1893,1891,1,0,0,0,1894,1895,3,16,8,0,1895,1913,1,0,0,0,1896,1908,
	3,16,8,0,1897,1898,5,82,0,0,1898,1899,3,282,141,0,1899,1900,5,83,0,0,1900,
	1907,1,0,0,0,1901,1902,5,7,0,0,1902,1907,3,16,8,0,1903,1904,5,166,0,0,1904,
	1905,5,57,0,0,1905,1907,5,58,0,0,1906,1897,1,0,0,0,1906,1901,1,0,0,0,1906,
	1903,1,0,0,0,1907,1910,1,0,0,0,1908,1906,1,0,0,0,1908,1909,1,0,0,0,1909,
	1913,1,0,0,0,1910,1908,1,0,0,0,1911,1913,3,160,80,0,1912,1878,1,0,0,0,1912,
	1887,1,0,0,0,1912,1896,1,0,0,0,1912,1911,1,0,0,0,1913,163,1,0,0,0,1914,
	1918,3,302,151,0,1915,1917,3,292,146,0,1916,1915,1,0,0,0,1917,1920,1,0,
	0,0,1918,1916,1,0,0,0,1918,1919,1,0,0,0,1919,1921,1,0,0,0,1920,1918,1,0,
	0,0,1921,1922,3,16,8,0,1922,1949,1,0,0,0,1923,1927,3,92,46,0,1924,1926,
	3,292,146,0,1925,1924,1,0,0,0,1926,1929,1,0,0,0,1927,1925,1,0,0,0,1927,
	1928,1,0,0,0,1928,1930,1,0,0,0,1929,1927,1,0,0,0,1930,1931,3,16,8,0,1931,
	1949,1,0,0,0,1932,1944,3,16,8,0,1933,1934,5,82,0,0,1934,1935,3,282,141,
	0,1935,1936,5,83,0,0,1936,1943,1,0,0,0,1937,1938,5,7,0,0,1938,1943,3,16,
	8,0,1939,1940,5,166,0,0,1940,1941,5,57,0,0,1941,1943,5,58,0,0,1942,1933,
	1,0,0,0,1942,1937,1,0,0,0,1942,1939,1,0,0,0,1943,1946,1,0,0,0,1944,1942,
	1,0,0,0,1944,1945,1,0,0,0,1945,1949,1,0,0,0,1946,1944,1,0,0,0,1947,1949,
	1,0,0,0,1948,1914,1,0,0,0,1948,1923,1,0,0,0,1948,1932,1,0,0,0,1948,1947,
	1,0,0,0,1949,165,1,0,0,0,1950,1951,3,282,141,0,1951,167,1,0,0,0,1952,1953,
	5,97,0,0,1953,1954,5,181,0,0,1954,1955,5,166,0,0,1955,1956,5,57,0,0,1956,
	1960,5,58,0,0,1957,1958,5,166,0,0,1958,1959,5,57,0,0,1959,1961,5,58,0,0,
	1960,1957,1,0,0,0,1960,1961,1,0,0,0,1961,1962,1,0,0,0,1962,2058,5,2,0,0,
	1963,1964,5,97,0,0,1964,1965,5,181,0,0,1965,2058,5,2,0,0,1966,1967,5,97,
	0,0,1967,1968,5,57,0,0,1968,1969,3,282,141,0,1969,1970,5,58,0,0,1970,1971,
	5,2,0,0,1971,2058,1,0,0,0,1972,1973,5,97,0,0,1973,1974,5,42,0,0,1974,1975,
	5,7,0,0,1975,1976,5,181,0,0,1976,2058,5,2,0,0,1977,1978,5,97,0,0,1978,1979,
	5,42,0,0,1979,1980,5,7,0,0,1980,1985,5,181,0,0,1981,1982,5,82,0,0,1982,
	1983,3,282,141,0,1983,1984,5,83,0,0,1984,1986,1,0,0,0,1985,1981,1,0,0,0,
	1986,1987,1,0,0,0,1987,1985,1,0,0,0,1987,1988,1,0,0,0,1988,1989,1,0,0,0,
	1989,1990,5,2,0,0,1990,2058,1,0,0,0,1991,1992,5,97,0,0,1992,1997,5,181,
	0,0,1993,1994,5,82,0,0,1994,1995,3,282,141,0,1995,1996,5,83,0,0,1996,1998,
	1,0,0,0,1997,1993,1,0,0,0,1998,1999,1,0,0,0,1999,1997,1,0,0,0,1999,2000,
	1,0,0,0,2000,2012,1,0,0,0,2001,2002,5,7,0,0,2002,2009,5,181,0,0,2003,2004,
	5,82,0,0,2004,2005,3,282,141,0,2005,2006,5,83,0,0,2006,2008,1,0,0,0,2007,
	2003,1,0,0,0,2008,2011,1,0,0,0,2009,2007,1,0,0,0,2009,2010,1,0,0,0,2010,
	2013,1,0,0,0,2011,2009,1,0,0,0,2012,2001,1,0,0,0,2013,2014,1,0,0,0,2014,
	2012,1,0,0,0,2014,2015,1,0,0,0,2015,2016,1,0,0,0,2016,2017,5,2,0,0,2017,
	2058,1,0,0,0,2018,2019,5,97,0,0,2019,2024,5,181,0,0,2020,2021,5,82,0,0,
	2021,2022,3,282,141,0,2022,2023,5,83,0,0,2023,2025,1,0,0,0,2024,2020,1,
	0,0,0,2025,2026,1,0,0,0,2026,2024,1,0,0,0,2026,2027,1,0,0,0,2027,2028,1,
	0,0,0,2028,2029,5,2,0,0,2029,2058,1,0,0,0,2030,2031,5,97,0,0,2031,2034,
	5,181,0,0,2032,2033,5,7,0,0,2033,2035,5,181,0,0,2034,2032,1,0,0,0,2035,
	2036,1,0,0,0,2036,2034,1,0,0,0,2036,2037,1,0,0,0,2037,2042,1,0,0,0,2038,
	2039,5,82,0,0,2039,2040,3,282,141,0,2040,2041,5,83,0,0,2041,2043,1,0,0,
	0,2042,2038,1,0,0,0,2043,2044,1,0,0,0,2044,2042,1,0,0,0,2044,2045,1,0,0,
	0,2045,2046,1,0,0,0,2046,2047,5,2,0,0,2047,2058,1,0,0,0,2048,2049,5,97,
	0,0,2049,2052,5,181,0,0,2050,2051,5,7,0,0,2051,2053,5,181,0,0,2052,2050,
	1,0,0,0,2053,2054,1,0,0,0,2054,2052,1,0,0,0,2054,2055,1,0,0,0,2055,2056,
	1,0,0,0,2056,2058,5,2,0,0,2057,1952,1,0,0,0,2057,1963,1,0,0,0,2057,1966,
	1,0,0,0,2057,1972,1,0,0,0,2057,1977,1,0,0,0,2057,1991,1,0,0,0,2057,2018,
	1,0,0,0,2057,2030,1,0,0,0,2057,2048,1,0,0,0,2058,169,1,0,0,0,2059,2060,
	5,41,0,0,2060,2061,5,57,0,0,2061,2062,5,155,0,0,2062,2063,5,23,0,0,2063,
	2066,3,282,141,0,2064,2065,5,5,0,0,2065,2067,3,252,126,0,2066,2064,1,0,
	0,0,2066,2067,1,0,0,0,2067,2068,1,0,0,0,2068,2069,5,58,0,0,2069,2070,5,
	2,0,0,2070,171,1,0,0,0,2071,2072,5,41,0,0,2072,2073,5,57,0,0,2073,2076,
	3,282,141,0,2074,2075,5,5,0,0,2075,2077,3,252,126,0,2076,2074,1,0,0,0,2076,
	2077,1,0,0,0,2077,2078,1,0,0,0,2078,2079,5,58,0,0,2079,2080,5,2,0,0,2080,
	173,1,0,0,0,2081,2082,5,98,0,0,2082,2083,5,57,0,0,2083,2084,3,282,141,0,
	2084,2085,5,58,0,0,2085,2088,3,118,59,0,2086,2087,5,99,0,0,2087,2089,3,
	118,59,0,2088,2086,1,0,0,0,2088,2089,1,0,0,0,2089,175,1,0,0,0,2090,2098,
	3,194,97,0,2091,2098,3,196,98,0,2092,2098,3,186,93,0,2093,2098,3,178,89,
	0,2094,2098,3,180,90,0,2095,2098,3,182,91,0,2096,2098,3,184,92,0,2097,2090,
	1,0,0,0,2097,2091,1,0,0,0,2097,2092,1,0,0,0,2097,2093,1,0,0,0,2097,2094,
	1,0,0,0,2097,2095,1,0,0,0,2097,2096,1,0,0,0,2098,177,1,0,0,0,2099,2100,
	5,11,0,0,2100,2101,5,57,0,0,2101,2102,3,302,151,0,2102,2103,5,181,0,0,2103,
	2104,5,5,0,0,2104,2105,3,302,151,0,2105,2106,5,181,0,0,2106,2107,5,100,
	0,0,2107,2108,5,42,0,0,2108,2109,5,7,0,0,2109,2110,5,181,0,0,2110,2111,
	5,7,0,0,2111,2112,5,33,0,0,2112,2113,5,58,0,0,2113,2114,3,118,59,0,2114,
	179,1,0,0,0,2115,2116,5,11,0,0,2116,2117,5,57,0,0,2117,2118,3,302,151,0,
	2118,2119,5,181,0,0,2119,2120,5,101,0,0,2120,2121,5,42,0,0,2121,2122,5,
	7,0,0,2122,2123,5,181,0,0,2123,2124,5,58,0,0,2124,2125,3,118,59,0,2125,
	181,1,0,0,0,2126,2127,5,11,0,0,2127,2128,5,57,0,0,2128,2129,3,302,151,0,
	2129,2130,5,181,0,0,2130,2131,5,100,0,0,2131,2132,5,42,0,0,2132,2133,5,
	7,0,0,2133,2134,5,181,0,0,2134,2135,5,58,0,0,2135,2136,3,118,59,0,2136,
	183,1,0,0,0,2137,2138,5,11,0,0,2138,2139,5,57,0,0,2139,2140,3,302,151,0,
	2140,2141,5,181,0,0,2141,2142,5,100,0,0,2142,2143,5,42,0,0,2143,2144,5,
	7,0,0,2144,2145,5,181,0,0,2145,2146,5,7,0,0,2146,2147,5,102,0,0,2147,2148,
	5,57,0,0,2148,2149,5,181,0,0,2149,2150,5,5,0,0,2150,2151,5,146,0,0,2151,
	2152,5,58,0,0,2152,2153,5,58,0,0,2153,2154,3,118,59,0,2154,185,1,0,0,0,
	2155,2156,5,11,0,0,2156,2157,5,57,0,0,2157,2158,3,188,94,0,2158,2160,3,
	190,95,0,2159,2161,3,192,96,0,2160,2159,1,0,0,0,2160,2161,1,0,0,0,2161,
	2162,1,0,0,0,2162,2163,5,58,0,0,2163,2164,3,118,59,0,2164,187,1,0,0,0,2165,
	2169,3,302,151,0,2166,2168,3,292,146,0,2167,2166,1,0,0,0,2168,2171,1,0,
	0,0,2169,2167,1,0,0,0,2169,2170,1,0,0,0,2170,2172,1,0,0,0,2171,2169,1,0,
	0,0,2172,2175,5,181,0,0,2173,2174,5,48,0,0,2174,2176,3,282,141,0,2175,2173,
	1,0,0,0,2175,2176,1,0,0,0,2176,2177,1,0,0,0,2177,2178,5,2,0,0,2178,2211,
	1,0,0,0,2179,2180,5,181,0,0,2180,2181,7,9,0,0,2181,2182,3,282,141,0,2182,
	2183,5,2,0,0,2183,2211,1,0,0,0,2184,2185,5,57,0,0,2185,2188,3,164,82,0,
	2186,2187,5,5,0,0,2187,2189,3,164,82,0,2188,2186,1,0,0,0,2189,2190,1,0,
	0,0,2190,2188,1,0,0,0,2190,2191,1,0,0,0,2191,2192,1,0,0,0,2192,2193,5,58,
	0,0,2193,2205,5,48,0,0,2194,2195,5,57,0,0,2195,2198,3,282,141,0,2196,2197,
	5,5,0,0,2197,2199,3,282,141,0,2198,2196,1,0,0,0,2199,2200,1,0,0,0,2200,
	2198,1,0,0,0,2200,2201,1,0,0,0,2201,2202,1,0,0,0,2202,2203,5,58,0,0,2203,
	2206,1,0,0,0,2204,2206,3,282,141,0,2205,2194,1,0,0,0,2205,2204,1,0,0,0,
	2206,2207,1,0,0,0,2207,2208,5,2,0,0,2208,2211,1,0,0,0,2209,2211,5,2,0,0,
	2210,2165,1,0,0,0,2210,2179,1,0,0,0,2210,2184,1,0,0,0,2210,2209,1,0,0,0,
	2211,189,1,0,0,0,2212,2214,3,282,141,0,2213,2212,1,0,0,0,2213,2214,1,0,
	0,0,2214,2215,1,0,0,0,2215,2216,5,2,0,0,2216,191,1,0,0,0,2217,2218,5,181,
	0,0,2218,2219,7,9,0,0,2219,2249,3,282,141,0,2220,2221,5,181,0,0,2221,2249,
	7,13,0,0,2222,2223,7,13,0,0,2223,2249,5,181,0,0,2224,2225,5,57,0,0,2225,
	2228,3,164,82,0,2226,2227,5,5,0,0,2227,2229,3,164,82,0,2228,2226,1,0,0,
	0,2229,2230,1,0,0,0,2230,2228,1,0,0,0,2230,2231,1,0,0,0,2231,2232,1,0,0,
	0,2232,2233,5,58,0,0,2233,2245,5,48,0,0,2234,2235,5,57,0,0,2235,2238,3,
	282,141,0,2236,2237,5,5,0,0,2237,2239,3,282,141,0,2238,2236,1,0,0,0,2239,
	2240,1,0,0,0,2240,2238,1,0,0,0,2240,2241,1,0,0,0,2241,2242,1,0,0,0,2242,
	2243,5,58,0,0,2243,2246,1,0,0,0,2244,2246,3,282,141,0,2245,2234,1,0,0,0,
	2245,2244,1,0,0,0,2246,2249,1,0,0,0,2247,2249,3,282,141,0,2248,2217,1,0,
	0,0,2248,2220,1,0,0,0,2248,2222,1,0,0,0,2248,2224,1,0,0,0,2248,2247,1,0,
	0,0,2249,193,1,0,0,0,2250,2251,5,103,0,0,2251,2252,3,118,59,0,2252,2253,
	5,104,0,0,2253,2254,5,57,0,0,2254,2255,3,282,141,0,2255,2256,5,58,0,0,2256,
	2257,5,2,0,0,2257,195,1,0,0,0,2258,2259,5,104,0,0,2259,2260,5,57,0,0,2260,
	2261,3,282,141,0,2261,2262,5,58,0,0,2262,2263,3,118,59,0,2263,197,1,0,0,
	0,2264,2266,5,105,0,0,2265,2267,5,181,0,0,2266,2265,1,0,0,0,2266,2267,1,
	0,0,0,2267,2268,1,0,0,0,2268,2269,3,260,130,0,2269,2270,5,2,0,0,2270,199,
	1,0,0,0,2271,2273,5,106,0,0,2272,2274,5,152,0,0,2273,2272,1,0,0,0,2273,
	2274,1,0,0,0,2274,2285,1,0,0,0,2275,2276,5,57,0,0,2276,2281,5,152,0,0,2277,
	2278,5,5,0,0,2278,2280,5,152,0,0,2279,2277,1,0,0,0,2280,2283,1,0,0,0,2281,
	2279,1,0,0,0,2281,2282,1,0,0,0,2282,2284,1,0,0,0,2283,2281,1,0,0,0,2284,
	2286,5,58,0,0,2285,2275,1,0,0,0,2285,2286,1,0,0,0,2286,2287,1,0,0,0,2287,
	2288,3,202,101,0,2288,201,1,0,0,0,2289,2293,5,4,0,0,2290,2292,3,204,102,
	0,2291,2290,1,0,0,0,2292,2295,1,0,0,0,2293,2291,1,0,0,0,2293,2294,1,0,0,
	0,2294,2296,1,0,0,0,2295,2293,1,0,0,0,2296,2297,5,6,0,0,2297,203,1,0,0,
	0,2298,2312,3,202,101,0,2299,2312,3,206,103,0,2300,2312,3,208,104,0,2301,
	2312,3,210,105,0,2302,2312,3,212,106,0,2303,2312,3,218,109,0,2304,2312,
	3,220,110,0,2305,2312,5,107,0,0,2306,2312,5,108,0,0,2307,2312,5,37,0,0,
	2308,2312,3,224,112,0,2309,2312,3,230,115,0,2310,2312,3,232,116,0,2311,
	2298,1,0,0,0,2311,2299,1,0,0,0,2311,2300,1,0,0,0,2311,2301,1,0,0,0,2311,
	2302,1,0,0,0,2311,2303,1,0,0,0,2311,2304,1,0,0,0,2311,2305,1,0,0,0,2311,
	2306,1,0,0,0,2311,2307,1,0,0,0,2311,2308,1,0,0,0,2311,2309,1,0,0,0,2311,
	2310,1,0,0,0,2312,205,1,0,0,0,2313,2314,5,109,0,0,2314,2319,3,228,114,0,
	2315,2316,5,5,0,0,2316,2318,3,228,114,0,2317,2315,1,0,0,0,2318,2321,1,0,
	0,0,2319,2317,1,0,0,0,2319,2320,1,0,0,0,2320,2324,1,0,0,0,2321,2319,1,0,
	0,0,2322,2323,5,110,0,0,2323,2325,3,222,111,0,2324,2322,1,0,0,0,2324,2325,
	1,0,0,0,2325,207,1,0,0,0,2326,2331,3,230,115,0,2327,2328,5,5,0,0,2328,2330,
	3,230,115,0,2329,2327,1,0,0,0,2330,2333,1,0,0,0,2331,2329,1,0,0,0,2331,
	2332,1,0,0,0,2332,2334,1,0,0,0,2333,2331,1,0,0,0,2334,2335,5,110,0,0,2335,
	2336,3,222,111,0,2336,209,1,0,0,0,2337,2338,5,98,0,0,2338,2339,3,222,111,
	0,2339,2340,3,202,101,0,2340,211,1,0,0,0,2341,2342,5,111,0,0,2342,2352,
	3,222,111,0,2343,2345,3,214,107,0,2344,2343,1,0,0,0,2345,2346,1,0,0,0,2346,
	2344,1,0,0,0,2346,2347,1,0,0,0,2347,2349,1,0,0,0,2348,2350,3,216,108,0,
	2349,2348,1,0,0,0,2349,2350,1,0,0,0,2350,2353,1,0,0,0,2351,2353,3,216,108,
	0,2352,2344,1,0,0,0,2352,2351,1,0,0,0,2353,213,1,0,0,0,2354,2355,5,112,
	0,0,2355,2356,3,232,116,0,2356,2357,3,202,101,0,2357,215,1,0,0,0,2358,2359,
	5,113,0,0,2359,2360,3,202,101,0,2360,217,1,0,0,0,2361,2362,5,11,0,0,2362,
	2363,3,202,101,0,2363,2364,3,222,111,0,2364,2365,3,202,101,0,2365,2366,
	3,202,101,0,2366,219,1,0,0,0,2367,2368,5,9,0,0,2368,2369,3,228,114,0,2369,
	2378,5,57,0,0,2370,2375,3,228,114,0,2371,2372,5,5,0,0,2372,2374,3,228,114,
	0,2373,2371,1,0,0,0,2374,2377,1,0,0,0,2375,2373,1,0,0,0,2375,2376,1,0,0,
	0,2376,2379,1,0,0,0,2377,2375,1,0,0,0,2378,2370,1,0,0,0,2378,2379,1,0,0,
	0,2379,2380,1,0,0,0,2380,2390,5,58,0,0,2381,2382,5,114,0,0,2382,2387,3,
	228,114,0,2383,2384,5,5,0,0,2384,2386,3,228,114,0,2385,2383,1,0,0,0,2386,
	2389,1,0,0,0,2387,2385,1,0,0,0,2387,2388,1,0,0,0,2388,2391,1,0,0,0,2389,
	2387,1,0,0,0,2390,2381,1,0,0,0,2390,2391,1,0,0,0,2391,2392,1,0,0,0,2392,
	2393,3,202,101,0,2393,221,1,0,0,0,2394,2398,3,224,112,0,2395,2398,3,230,
	115,0,2396,2398,3,232,116,0,2397,2394,1,0,0,0,2397,2395,1,0,0,0,2397,2396,
	1,0,0,0,2398,223,1,0,0,0,2399,2400,3,226,113,0,2400,2409,5,57,0,0,2401,
	2406,3,222,111,0,2402,2403,5,5,0,0,2403,2405,3,222,111,0,2404,2402,1,0,
	0,0,2405,2408,1,0,0,0,2406,2404,1,0,0,0,2406,2407,1,0,0,0,2407,2410,1,0,
	0,0,2408,2406,1,0,0,0,2409,2401,1,0,0,0,2409,2410,1,0,0,0,2410,2411,1,0,
	0,0,2411,2412,5,58,0,0,2412,225,1,0,0,0,2413,2414,7,14,0,0,2414,227,1,0,
	0,0,2415,2419,3,16,8,0,2416,2417,4,114,3,0,2417,2419,9,0,0,0,2418,2415,
	1,0,0,0,2418,2416,1,0,0,0,2419,229,1,0,0,0,2420,2428,3,228,114,0,2421,2422,
	5,7,0,0,2422,2427,3,228,114,0,2423,2427,5,165,0,0,2424,2425,5,7,0,0,2425,
	2427,5,91,0,0,2426,2421,1,0,0,0,2426,2423,1,0,0,0,2426,2424,1,0,0,0,2427,
	2430,1,0,0,0,2428,2426,1,0,0,0,2428,2429,1,0,0,0,2429,231,1,0,0,0,2430,
	2428,1,0,0,0,2431,2432,7,15,0,0,2432,233,1,0,0,0,2433,2434,5,115,0,0,2434,
	2438,5,4,0,0,2435,2437,3,122,61,0,2436,2435,1,0,0,0,2437,2440,1,0,0,0,2438,
	2436,1,0,0,0,2438,2439,1,0,0,0,2439,2441,1,0,0,0,2440,2438,1,0,0,0,2441,
	2442,5,6,0,0,2442,235,1,0,0,0,2443,2444,5,111,0,0,2444,2445,5,57,0,0,2445,
	2446,3,282,141,0,2446,2447,5,58,0,0,2447,2451,5,4,0,0,2448,2450,3,238,119,
	0,2449,2448,1,0,0,0,2450,2453,1,0,0,0,2451,2449,1,0,0,0,2451,2452,1,0,0,
	0,2452,2455,1,0,0,0,2453,2451,1,0,0,0,2454,2456,3,240,120,0,2455,2454,1,
	0,0,0,2455,2456,1,0,0,0,2456,2457,1,0,0,0,2457,2458,5,6,0,0,2458,237,1,
	0,0,0,2459,2460,5,112,0,0,2460,2461,3,282,141,0,2461,2465,5,116,0,0,2462,
	2464,3,122,61,0,2463,2462,1,0,0,0,2464,2467,1,0,0,0,2465,2463,1,0,0,0,2465,
	2466,1,0,0,0,2466,239,1,0,0,0,2467,2465,1,0,0,0,2468,2469,5,113,0,0,2469,
	2473,5,116,0,0,2470,2472,3,122,61,0,2471,2470,1,0,0,0,2472,2475,1,0,0,0,
	2473,2471,1,0,0,0,2473,2474,1,0,0,0,2474,241,1,0,0,0,2475,2473,1,0,0,0,
	2476,2477,5,117,0,0,2477,2479,3,282,141,0,2478,2480,3,244,122,0,2479,2478,
	1,0,0,0,2479,2480,1,0,0,0,2480,2481,1,0,0,0,2481,2483,3,118,59,0,2482,2484,
	3,246,123,0,2483,2482,1,0,0,0,2484,2485,1,0,0,0,2485,2483,1,0,0,0,2485,
	2486,1,0,0,0,2486,243,1,0,0,0,2487,2488,5,88,0,0,2488,2500,5,57,0,0,2489,
	2494,3,116,58,0,2490,2491,5,5,0,0,2491,2493,3,116,58,0,2492,2490,1,0,0,
	0,2493,2496,1,0,0,0,2494,2492,1,0,0,0,2494,2495,1,0,0,0,2495,2498,1,0,0,
	0,2496,2494,1,0,0,0,2497,2499,5,5,0,0,2498,2497,1,0,0,0,2498,2499,1,0,0,
	0,2499,2501,1,0,0,0,2500,2489,1,0,0,0,2500,2501,1,0,0,0,2501,2502,1,0,0,
	0,2502,2503,5,58,0,0,2503,245,1,0,0,0,2504,2506,5,118,0,0,2505,2507,5,181,
	0,0,2506,2505,1,0,0,0,2506,2507,1,0,0,0,2507,2523,1,0,0,0,2508,2520,5,57,
	0,0,2509,2514,3,116,58,0,2510,2511,5,5,0,0,2511,2513,3,116,58,0,2512,2510,
	1,0,0,0,2513,2516,1,0,0,0,2514,2512,1,0,0,0,2514,2515,1,0,0,0,2515,2518,
	1,0,0,0,2516,2514,1,0,0,0,2517,2519,5,5,0,0,2518,2517,1,0,0,0,2518,2519,
	1,0,0,0,2519,2521,1,0,0,0,2520,2509,1,0,0,0,2520,2521,1,0,0,0,2521,2522,
	1,0,0,0,2522,2524,5,58,0,0,2523,2508,1,0,0,0,2523,2524,1,0,0,0,2524,2525,
	1,0,0,0,2525,2526,3,118,59,0,2526,247,1,0,0,0,2527,2528,5,107,0,0,2528,
	2529,5,2,0,0,2529,249,1,0,0,0,2530,2531,5,108,0,0,2531,2532,5,2,0,0,2532,
	251,1,0,0,0,2533,2538,5,152,0,0,2534,2535,5,181,0,0,2535,2538,3,266,133,
	0,2536,2538,3,282,141,0,2537,2533,1,0,0,0,2537,2534,1,0,0,0,2537,2536,1,
	0,0,0,2538,253,1,0,0,0,2539,2540,5,35,0,0,2540,2543,3,16,8,0,2541,2542,
	5,7,0,0,2542,2544,5,181,0,0,2543,2541,1,0,0,0,2543,2544,1,0,0,0,2544,2545,
	1,0,0,0,2545,2546,5,57,0,0,2546,2558,5,4,0,0,2547,2552,3,264,132,0,2548,
	2549,5,5,0,0,2549,2551,3,264,132,0,2550,2548,1,0,0,0,2551,2554,1,0,0,0,
	2552,2550,1,0,0,0,2552,2553,1,0,0,0,2553,2556,1,0,0,0,2554,2552,1,0,0,0,
	2555,2557,5,5,0,0,2556,2555,1,0,0,0,2556,2557,1,0,0,0,2557,2559,1,0,0,0,
	2558,2547,1,0,0,0,2558,2559,1,0,0,0,2559,2560,1,0,0,0,2560,2561,5,6,0,0,
	2561,2562,5,58,0,0,2562,2563,5,2,0,0,2563,2584,1,0,0,0,2564,2565,5,35,0,
	0,2565,2568,3,16,8,0,2566,2567,5,7,0,0,2567,2569,5,181,0,0,2568,2566,1,
	0,0,0,2568,2569,1,0,0,0,2569,2570,1,0,0,0,2570,2571,3,266,133,0,2571,2572,
	5,2,0,0,2572,2584,1,0,0,0,2573,2574,5,35,0,0,2574,2575,5,57,0,0,2575,2576,
	3,282,141,0,2576,2577,5,58,0,0,2577,2578,5,2,0,0,2578,2584,1,0,0,0,2579,
	2580,5,35,0,0,2580,2581,5,57,0,0,2581,2582,5,58,0,0,2582,2584,5,2,0,0,2583,
	2539,1,0,0,0,2583,2564,1,0,0,0,2583,2573,1,0,0,0,2583,2579,1,0,0,0,2584,
	255,1,0,0,0,2585,2586,5,119,0,0,2586,2587,5,57,0,0,2587,2588,3,282,141,
	0,2588,2589,5,58,0,0,2589,2590,5,2,0,0,2590,2594,1,0,0,0,2591,2592,5,119,
	0,0,2592,2594,5,2,0,0,2593,2585,1,0,0,0,2593,2591,1,0,0,0,2594,257,1,0,
	0,0,2595,2598,5,181,0,0,2596,2598,3,296,148,0,2597,2595,1,0,0,0,2597,2596,
	1,0,0,0,2598,259,1,0,0,0,2599,2611,5,57,0,0,2600,2605,3,258,129,0,2601,
	2602,5,5,0,0,2602,2604,3,258,129,0,2603,2601,1,0,0,0,2604,2607,1,0,0,0,
	2605,2603,1,0,0,0,2605,2606,1,0,0,0,2606,2609,1,0,0,0,2607,2605,1,0,0,0,
	2608,2610,5,5,0,0,2609,2608,1,0,0,0,2609,2610,1,0,0,0,2610,2612,1,0,0,0,
	2611,2600,1,0,0,0,2611,2612,1,0,0,0,2612,2613,1,0,0,0,2613,2614,5,58,0,
	0,2614,261,1,0,0,0,2615,2680,4,131,4,0,2616,2617,5,181,0,0,2617,2681,3,
	266,133,0,2618,2619,5,31,0,0,2619,2681,3,266,133,0,2620,2621,5,181,0,0,
	2621,2622,3,270,135,0,2622,2623,3,266,133,0,2623,2681,1,0,0,0,2624,2625,
	5,43,0,0,2625,2681,3,266,133,0,2626,2627,5,181,0,0,2627,2628,5,7,0,0,2628,
	2629,5,181,0,0,2629,2681,3,266,133,0,2630,2631,5,181,0,0,2631,2632,5,57,
	0,0,2632,2644,5,4,0,0,2633,2638,3,264,132,0,2634,2635,5,5,0,0,2635,2637,
	3,264,132,0,2636,2634,1,0,0,0,2637,2640,1,0,0,0,2638,2636,1,0,0,0,2638,
	2639,1,0,0,0,2639,2642,1,0,0,0,2640,2638,1,0,0,0,2641,2643,5,5,0,0,2642,
	2641,1,0,0,0,2642,2643,1,0,0,0,2643,2645,1,0,0,0,2644,2633,1,0,0,0,2644,
	2645,1,0,0,0,2645,2646,1,0,0,0,2646,2647,5,6,0,0,2647,2681,5,58,0,0,2648,
	2649,5,57,0,0,2649,2650,5,181,0,0,2650,2651,5,58,0,0,2651,2681,3,266,133,
	0,2652,2653,5,57,0,0,2653,2654,5,181,0,0,2654,2655,5,7,0,0,2655,2656,5,
	181,0,0,2656,2657,5,58,0,0,2657,2681,3,266,133,0,2658,2659,5,57,0,0,2659,
	2660,5,181,0,0,2660,2661,5,7,0,0,2661,2662,5,181,0,0,2662,2663,5,58,0,0,
	2663,2664,5,57,0,0,2664,2676,5,4,0,0,2665,2670,3,264,132,0,2666,2667,5,
	5,0,0,2667,2669,3,264,132,0,2668,2666,1,0,0,0,2669,2672,1,0,0,0,2670,2668,
	1,0,0,0,2670,2671,1,0,0,0,2671,2674,1,0,0,0,2672,2670,1,0,0,0,2673,2675,
	5,5,0,0,2674,2673,1,0,0,0,2674,2675,1,0,0,0,2675,2677,1,0,0,0,2676,2665,
	1,0,0,0,2676,2677,1,0,0,0,2677,2678,1,0,0,0,2678,2679,5,6,0,0,2679,2681,
	5,58,0,0,2680,2616,1,0,0,0,2680,2618,1,0,0,0,2680,2620,1,0,0,0,2680,2624,
	1,0,0,0,2680,2626,1,0,0,0,2680,2630,1,0,0,0,2680,2648,1,0,0,0,2680,2652,
	1,0,0,0,2680,2658,1,0,0,0,2681,263,1,0,0,0,2682,2683,5,181,0,0,2683,2684,
	5,116,0,0,2684,2685,3,282,141,0,2685,265,1,0,0,0,2686,2698,5,57,0,0,2687,
	2692,3,268,134,0,2688,2689,5,5,0,0,2689,2691,3,268,134,0,2690,2688,1,0,
	0,0,2691,2694,1,0,0,0,2692,2690,1,0,0,0,2692,2693,1,0,0,0,2693,2696,1,0,
	0,0,2694,2692,1,0,0,0,2695,2697,5,5,0,0,2696,2695,1,0,0,0,2696,2697,1,0,
	0,0,2697,2699,1,0,0,0,2698,2687,1,0,0,0,2698,2699,1,0,0,0,2699,2700,1,0,
	0,0,2700,2701,5,58,0,0,2701,267,1,0,0,0,2702,2703,5,181,0,0,2703,2704,5,
	166,0,0,2704,2705,5,57,0,0,2705,2712,5,58,0,0,2706,2709,3,282,141,0,2707,
	2708,7,9,0,0,2708,2710,3,142,71,0,2709,2707,1,0,0,0,2709,2710,1,0,0,0,2710,
	2712,1,0,0,0,2711,2702,1,0,0,0,2711,2706,1,0,0,0,2712,269,1,0,0,0,2713,
	2714,5,4,0,0,2714,2719,3,272,136,0,2715,2716,5,5,0,0,2716,2718,3,272,136,
	0,2717,2715,1,0,0,0,2718,2721,1,0,0,0,2719,2717,1,0,0,0,2719,2720,1,0,0,
	0,2720,2723,1,0,0,0,2721,2719,1,0,0,0,2722,2724,5,5,0,0,2723,2722,1,0,0,
	0,2723,2724,1,0,0,0,2724,2725,1,0,0,0,2725,2726,5,6,0,0,2726,271,1,0,0,
	0,2727,2728,5,181,0,0,2728,2729,5,116,0,0,2729,2730,3,282,141,0,2730,273,
	1,0,0,0,2731,2743,5,57,0,0,2732,2737,3,276,138,0,2733,2734,5,5,0,0,2734,
	2736,3,276,138,0,2735,2733,1,0,0,0,2736,2739,1,0,0,0,2737,2735,1,0,0,0,
	2737,2738,1,0,0,0,2738,2741,1,0,0,0,2739,2737,1,0,0,0,2740,2742,5,5,0,0,
	2741,2740,1,0,0,0,2741,2742,1,0,0,0,2742,2744,1,0,0,0,2743,2732,1,0,0,0,
	2743,2744,1,0,0,0,2744,2745,1,0,0,0,2745,2746,5,58,0,0,2746,275,1,0,0,0,
	2747,2763,3,302,151,0,2748,2763,3,92,46,0,2749,2750,5,57,0,0,2750,2751,
	3,276,138,0,2751,2759,5,58,0,0,2752,2754,5,82,0,0,2753,2755,3,282,141,0,
	2754,2753,1,0,0,0,2754,2755,1,0,0,0,2755,2756,1,0,0,0,2756,2758,5,83,0,
	0,2757,2752,1,0,0,0,2758,2761,1,0,0,0,2759,2757,1,0,0,0,2759,2760,1,0,0,
	0,2760,2763,1,0,0,0,2761,2759,1,0,0,0,2762,2747,1,0,0,0,2762,2748,1,0,0,
	0,2762,2749,1,0,0,0,2763,277,1,0,0,0,2764,2765,5,57,0,0,2765,2766,5,181,
	0,0,2766,2767,7,9,0,0,2767,2768,3,282,141,0,2768,2769,5,58,0,0,2769,2799,
	1,0,0,0,2770,2771,5,57,0,0,2771,2772,5,92,0,0,2772,2773,5,181,0,0,2773,
	2774,5,58,0,0,2774,2775,3,270,135,0,2775,2776,3,266,133,0,2776,2799,1,0,
	0,0,2777,2778,5,57,0,0,2778,2799,5,58,0,0,2779,2780,5,57,0,0,2780,2783,
	3,282,141,0,2781,2782,5,5,0,0,2782,2784,3,282,141,0,2783,2781,1,0,0,0,2784,
	2785,1,0,0,0,2785,2783,1,0,0,0,2785,2786,1,0,0,0,2786,2787,1,0,0,0,2787,
	2788,5,58,0,0,2788,2799,1,0,0,0,2789,2790,5,57,0,0,2790,2791,3,282,141,
	0,2791,2792,5,58,0,0,2792,2793,3,266,133,0,2793,2799,1,0,0,0,2794,2795,
	5,57,0,0,2795,2796,3,282,141,0,2796,2797,5,58,0,0,2797,2799,1,0,0,0,2798,
	2764,1,0,0,0,2798,2770,1,0,0,0,2798,2777,1,0,0,0,2798,2779,1,0,0,0,2798,
	2789,1,0,0,0,2798,2794,1,0,0,0,2799,279,1,0,0,0,2800,2801,5,92,0,0,2801,
	2803,5,181,0,0,2802,2804,3,270,135,0,2803,2802,1,0,0,0,2803,2804,1,0,0,
	0,2804,2805,1,0,0,0,2805,2834,3,266,133,0,2806,2807,5,92,0,0,2807,2813,
	3,302,151,0,2808,2810,5,82,0,0,2809,2811,5,146,0,0,2810,2809,1,0,0,0,2810,
	2811,1,0,0,0,2811,2812,1,0,0,0,2812,2814,5,83,0,0,2813,2808,1,0,0,0,2814,
	2815,1,0,0,0,2815,2813,1,0,0,0,2815,2816,1,0,0,0,2816,2817,1,0,0,0,2817,
	2818,5,57,0,0,2818,2819,3,282,141,0,2819,2820,5,58,0,0,2820,2834,1,0,0,
	0,2821,2822,5,92,0,0,2822,2823,5,149,0,0,2823,2824,5,57,0,0,2824,2825,3,
	282,141,0,2825,2826,5,58,0,0,2826,2834,1,0,0,0,2827,2828,5,92,0,0,2828,
	2829,5,147,0,0,2829,2830,5,57,0,0,2830,2831,3,282,141,0,2831,2832,5,58,
	0,0,2832,2834,1,0,0,0,2833,2800,1,0,0,0,2833,2806,1,0,0,0,2833,2821,1,0,
	0,0,2833,2827,1,0,0,0,2834,281,1,0,0,0,2835,2836,6,141,-1,0,2836,2951,3,
	278,139,0,2837,2838,3,312,156,0,2838,2839,5,57,0,0,2839,2841,3,282,141,
	0,2840,2842,5,5,0,0,2841,2840,1,0,0,0,2841,2842,1,0,0,0,2842,2843,1,0,0,
	0,2843,2844,5,58,0,0,2844,2951,1,0,0,0,2845,2849,3,262,131,0,2846,2848,
	3,266,133,0,2847,2846,1,0,0,0,2848,2851,1,0,0,0,2849,2847,1,0,0,0,2849,
	2850,1,0,0,0,2850,2951,1,0,0,0,2851,2849,1,0,0,0,2852,2951,3,280,140,0,
	2853,2854,3,284,142,0,2854,2855,5,7,0,0,2855,2856,5,181,0,0,2856,2951,1,
	0,0,0,2857,2858,7,16,0,0,2858,2951,3,266,133,0,2859,2860,5,124,0,0,2860,
	2872,5,57,0,0,2861,2862,7,11,0,0,2862,2863,5,7,0,0,2863,2873,5,181,0,0,
	2864,2865,5,181,0,0,2865,2866,5,82,0,0,2866,2867,5,146,0,0,2867,2873,5,
	83,0,0,2868,2873,5,181,0,0,2869,2870,5,181,0,0,2870,2871,5,57,0,0,2871,
	2873,5,58,0,0,2872,2861,1,0,0,0,2872,2864,1,0,0,0,2872,2868,1,0,0,0,2872,
	2869,1,0,0,0,2873,2874,1,0,0,0,2874,2875,5,5,0,0,2875,2876,3,286,143,0,
	2876,2877,5,58,0,0,2877,2951,1,0,0,0,2878,2879,7,17,0,0,2879,2951,3,266,
	133,0,2880,2881,5,127,0,0,2881,2882,5,57,0,0,2882,2883,3,282,141,0,2883,
	2884,5,5,0,0,2884,2885,3,274,137,0,2885,2886,5,58,0,0,2886,2951,1,0,0,0,
	2887,2888,5,128,0,0,2888,2889,5,57,0,0,2889,2890,3,282,141,0,2890,2891,
	5,5,0,0,2891,2892,3,274,137,0,2892,2893,5,5,0,0,2893,2894,5,146,0,0,2894,
	2895,5,58,0,0,2895,2951,1,0,0,0,2896,2951,7,18,0,0,2897,2898,7,19,0,0,2898,
	2899,5,82,0,0,2899,2900,3,282,141,0,2900,2901,5,83,0,0,2901,2902,7,20,0,
	0,2902,2951,1,0,0,0,2903,2904,7,13,0,0,2904,2951,3,282,141,19,2905,2906,
	7,21,0,0,2906,2951,3,282,141,18,2907,2919,5,82,0,0,2908,2913,3,282,141,
	0,2909,2910,5,5,0,0,2910,2912,3,282,141,0,2911,2909,1,0,0,0,2912,2915,1,
	0,0,0,2913,2911,1,0,0,0,2913,2914,1,0,0,0,2914,2917,1,0,0,0,2915,2913,1,
	0,0,0,2916,2918,5,5,0,0,2917,2916,1,0,0,0,2917,2918,1,0,0,0,2918,2920,1,
	0,0,0,2919,2908,1,0,0,0,2919,2920,1,0,0,0,2920,2921,1,0,0,0,2921,2951,5,
	83,0,0,2922,2945,5,42,0,0,2923,2924,5,7,0,0,2924,2925,5,181,0,0,2925,2926,
	5,7,0,0,2926,2927,5,181,0,0,2927,2928,5,82,0,0,2928,2929,3,282,141,0,2929,
	2930,5,83,0,0,2930,2931,3,290,145,0,2931,2946,1,0,0,0,2932,2933,5,7,0,0,
	2933,2938,5,181,0,0,2934,2935,5,82,0,0,2935,2936,3,282,141,0,2936,2937,
	5,83,0,0,2937,2939,1,0,0,0,2938,2934,1,0,0,0,2939,2940,1,0,0,0,2940,2938,
	1,0,0,0,2940,2941,1,0,0,0,2941,2946,1,0,0,0,2942,2943,5,7,0,0,2943,2946,
	5,181,0,0,2944,2946,1,0,0,0,2945,2923,1,0,0,0,2945,2932,1,0,0,0,2945,2942,
	1,0,0,0,2945,2944,1,0,0,0,2946,2951,1,0,0,0,2947,2951,5,161,0,0,2948,2951,
	3,16,8,0,2949,2951,3,296,148,0,2950,2835,1,0,0,0,2950,2837,1,0,0,0,2950,
	2845,1,0,0,0,2950,2852,1,0,0,0,2950,2853,1,0,0,0,2950,2857,1,0,0,0,2950,
	2859,1,0,0,0,2950,2878,1,0,0,0,2950,2880,1,0,0,0,2950,2887,1,0,0,0,2950,
	2896,1,0,0,0,2950,2897,1,0,0,0,2950,2903,1,0,0,0,2950,2905,1,0,0,0,2950,
	2907,1,0,0,0,2950,2922,1,0,0,0,2950,2947,1,0,0,0,2950,2948,1,0,0,0,2950,
	2949,1,0,0,0,2951,3102,1,0,0,0,2952,2953,10,17,0,0,2953,2954,5,17,0,0,2954,
	3101,3,282,141,17,2955,2956,10,16,0,0,2956,2957,7,22,0,0,2957,3101,3,282,
	141,17,2958,2959,10,15,0,0,2959,2960,7,23,0,0,2960,3101,3,282,141,16,2961,
	2962,10,14,0,0,2962,2963,7,24,0,0,2963,3101,3,282,141,15,2964,2965,10,13,
	0,0,2965,2966,5,24,0,0,2966,3101,3,282,141,14,2967,2968,10,12,0,0,2968,
	2969,5,26,0,0,2969,3101,3,282,141,13,2970,2971,10,11,0,0,2971,2972,5,25,
	0,0,2972,3101,3,282,141,12,2973,2974,10,10,0,0,2974,2975,7,25,0,0,2975,
	3101,3,282,141,11,2976,2977,10,9,0,0,2977,2978,7,26,0,0,2978,3101,3,282,
	141,10,2979,2980,10,8,0,0,2980,2981,5,135,0,0,2981,3101,3,282,141,9,2982,
	2983,10,7,0,0,2983,2984,5,47,0,0,2984,3101,3,282,141,8,2985,2986,10,31,
	0,0,2986,2996,5,82,0,0,2987,2989,3,282,141,0,2988,2987,1,0,0,0,2988,2989,
	1,0,0,0,2989,2990,1,0,0,0,2990,2992,5,116,0,0,2991,2993,3,282,141,0,2992,
	2991,1,0,0,0,2992,2993,1,0,0,0,2993,2997,1,0,0,0,2994,2997,5,146,0,0,2995,
	2997,3,282,141,0,2996,2988,1,0,0,0,2996,2994,1,0,0,0,2996,2995,1,0,0,0,
	2997,2998,1,0,0,0,2998,3101,5,83,0,0,2999,3000,10,29,0,0,3000,3101,7,27,
	0,0,3001,3002,10,28,0,0,3002,3003,5,168,0,0,3003,3004,5,57,0,0,3004,3005,
	3,282,141,0,3005,3006,5,58,0,0,3006,3101,1,0,0,0,3007,3008,10,27,0,0,3008,
	3009,5,169,0,0,3009,3010,5,57,0,0,3010,3011,3,282,141,0,3011,3012,5,5,0,
	0,3012,3013,3,282,141,0,3013,3014,5,58,0,0,3014,3101,1,0,0,0,3015,3016,
	10,26,0,0,3016,3017,5,7,0,0,3017,3021,5,181,0,0,3018,3019,5,7,0,0,3019,
	3022,5,181,0,0,3020,3022,5,164,0,0,3021,3018,1,0,0,0,3021,3020,1,0,0,0,
	3022,3023,1,0,0,0,3023,3024,5,57,0,0,3024,3025,3,282,141,0,3025,3026,5,
	58,0,0,3026,3027,3,266,133,0,3027,3101,1,0,0,0,3028,3029,10,25,0,0,3029,
	3030,5,7,0,0,3030,3032,5,181,0,0,3031,3033,3,270,135,0,3032,3031,1,0,0,
	0,3032,3033,1,0,0,0,3033,3034,1,0,0,0,3034,3035,5,57,0,0,3035,3047,5,4,
	0,0,3036,3041,3,264,132,0,3037,3038,5,5,0,0,3038,3040,3,264,132,0,3039,
	3037,1,0,0,0,3040,3043,1,0,0,0,3041,3039,1,0,0,0,3041,3042,1,0,0,0,3042,
	3045,1,0,0,0,3043,3041,1,0,0,0,3044,3046,5,5,0,0,3045,3044,1,0,0,0,3045,
	3046,1,0,0,0,3046,3048,1,0,0,0,3047,3036,1,0,0,0,3047,3048,1,0,0,0,3048,
	3049,1,0,0,0,3049,3050,5,6,0,0,3050,3101,5,58,0,0,3051,3056,10,24,0,0,3052,
	3057,5,165,0,0,3053,3057,5,164,0,0,3054,3055,5,7,0,0,3055,3057,3,16,8,0,
	3056,3052,1,0,0,0,3056,3053,1,0,0,0,3056,3054,1,0,0,0,3057,3059,1,0,0,0,
	3058,3060,3,270,135,0,3059,3058,1,0,0,0,3059,3060,1,0,0,0,3060,3061,1,0,
	0,0,3061,3065,3,266,133,0,3062,3064,3,266,133,0,3063,3062,1,0,0,0,3064,
	3067,1,0,0,0,3065,3063,1,0,0,0,3065,3066,1,0,0,0,3066,3101,1,0,0,0,3067,
	3065,1,0,0,0,3068,3069,10,23,0,0,3069,3070,5,7,0,0,3070,3071,5,181,0,0,
	3071,3072,3,270,135,0,3072,3073,3,290,145,0,3073,3101,1,0,0,0,3074,3075,
	10,22,0,0,3075,3076,5,82,0,0,3076,3077,3,282,141,0,3077,3079,5,83,0,0,3078,
	3080,3,270,135,0,3079,3078,1,0,0,0,3079,3080,1,0,0,0,3080,3081,1,0,0,0,
	3081,3082,3,266,133,0,3082,3101,1,0,0,0,3083,3084,10,21,0,0,3084,3101,3,
	290,145,0,3085,3086,10,20,0,0,3086,3101,7,13,0,0,3087,3088,10,6,0,0,3088,
	3089,5,136,0,0,3089,3092,3,282,141,0,3090,3091,7,9,0,0,3091,3093,3,142,
	71,0,3092,3090,1,0,0,0,3092,3093,1,0,0,0,3093,3094,1,0,0,0,3094,3095,5,
	116,0,0,3095,3098,3,282,141,0,3096,3097,7,9,0,0,3097,3099,3,142,71,0,3098,
	3096,1,0,0,0,3098,3099,1,0,0,0,3099,3101,1,0,0,0,3100,2952,1,0,0,0,3100,
	2955,1,0,0,0,3100,2958,1,0,0,0,3100,2961,1,0,0,0,3100,2964,1,0,0,0,3100,
	2967,1,0,0,0,3100,2970,1,0,0,0,3100,2973,1,0,0,0,3100,2976,1,0,0,0,3100,
	2979,1,0,0,0,3100,2982,1,0,0,0,3100,2985,1,0,0,0,3100,2999,1,0,0,0,3100,
	3001,1,0,0,0,3100,3007,1,0,0,0,3100,3015,1,0,0,0,3100,3028,1,0,0,0,3100,
	3051,1,0,0,0,3100,3068,1,0,0,0,3100,3074,1,0,0,0,3100,3083,1,0,0,0,3100,
	3085,1,0,0,0,3100,3087,1,0,0,0,3101,3104,1,0,0,0,3102,3100,1,0,0,0,3102,
	3103,1,0,0,0,3103,283,1,0,0,0,3104,3102,1,0,0,0,3105,3106,5,63,0,0,3106,
	3107,5,57,0,0,3107,3108,3,302,151,0,3108,3109,5,58,0,0,3109,3118,1,0,0,
	0,3110,3111,5,57,0,0,3111,3112,5,63,0,0,3112,3113,5,57,0,0,3113,3114,3,
	302,151,0,3114,3115,5,58,0,0,3115,3116,5,58,0,0,3116,3118,1,0,0,0,3117,
	3105,1,0,0,0,3117,3110,1,0,0,0,3118,285,1,0,0,0,3119,3120,5,57,0,0,3120,
	3121,5,181,0,0,3121,3122,5,58,0,0,3122,3123,5,48,0,0,3123,3128,3,282,141,
	0,3124,3128,3,282,141,0,3125,3126,5,57,0,0,3126,3128,5,58,0,0,3127,3119,
	1,0,0,0,3127,3124,1,0,0,0,3127,3125,1,0,0,0,3128,287,1,0,0,0,3129,3130,
	7,18,0,0,3130,3131,5,2,0,0,3131,289,1,0,0,0,3132,3133,5,7,0,0,3133,3150,
	5,181,0,0,3134,3135,5,7,0,0,3135,3150,5,34,0,0,3136,3137,5,7,0,0,3137,3150,
	5,91,0,0,3138,3150,5,164,0,0,3139,3150,5,173,0,0,3140,3150,5,174,0,0,3141,
	3150,5,175,0,0,3142,3150,5,176,0,0,3143,3150,5,177,0,0,3144,3150,5,178,
	0,0,3145,3150,5,179,0,0,3146,3150,5,180,0,0,3147,3150,5,171,0,0,3148,3150,
	5,172,0,0,3149,3132,1,0,0,0,3149,3134,1,0,0,0,3149,3136,1,0,0,0,3149,3138,
	1,0,0,0,3149,3139,1,0,0,0,3149,3140,1,0,0,0,3149,3141,1,0,0,0,3149,3142,
	1,0,0,0,3149,3143,1,0,0,0,3149,3144,1,0,0,0,3149,3145,1,0,0,0,3149,3146,
	1,0,0,0,3149,3147,1,0,0,0,3149,3148,1,0,0,0,3150,291,1,0,0,0,3151,3152,
	7,28,0,0,3152,293,1,0,0,0,3153,3154,7,29,0,0,3154,295,1,0,0,0,3155,3182,
	5,142,0,0,3156,3182,3,298,149,0,3157,3182,3,300,150,0,3158,3162,5,152,0,
	0,3159,3161,5,152,0,0,3160,3159,1,0,0,0,3161,3164,1,0,0,0,3162,3160,1,0,
	0,0,3162,3163,1,0,0,0,3163,3182,1,0,0,0,3164,3162,1,0,0,0,3165,3169,5,162,
	0,0,3166,3168,5,162,0,0,3167,3166,1,0,0,0,3168,3171,1,0,0,0,3169,3167,1,
	0,0,0,3169,3170,1,0,0,0,3170,3182,1,0,0,0,3171,3169,1,0,0,0,3172,3176,5,
	163,0,0,3173,3175,5,163,0,0,3174,3173,1,0,0,0,3175,3178,1,0,0,0,3176,3174,
	1,0,0,0,3176,3177,1,0,0,0,3177,3182,1,0,0,0,3178,3176,1,0,0,0,3179,3182,
	5,153,0,0,3180,3182,5,154,0,0,3181,3155,1,0,0,0,3181,3156,1,0,0,0,3181,
	3157,1,0,0,0,3181,3158,1,0,0,0,3181,3165,1,0,0,0,3181,3172,1,0,0,0,3181,
	3179,1,0,0,0,3181,3180,1,0,0,0,3182,297,1,0,0,0,3183,3185,5,146,0,0,3184,
	3186,7,30,0,0,3185,3184,1,0,0,0,3185,3186,1,0,0,0,3186,299,1,0,0,0,3187,
	3189,5,145,0,0,3188,3190,7,30,0,0,3189,3188,1,0,0,0,3189,3190,1,0,0,0,3190,
	301,1,0,0,0,3191,3192,5,91,0,0,3192,3211,5,67,0,0,3193,3211,5,91,0,0,3194,
	3211,5,147,0,0,3195,3211,5,148,0,0,3196,3211,5,150,0,0,3197,3211,5,149,
	0,0,3198,3211,5,157,0,0,3199,3211,5,158,0,0,3200,3211,5,89,0,0,3201,3211,
	5,90,0,0,3202,3211,5,159,0,0,3203,3211,5,160,0,0,3204,3211,3,304,152,0,
	3205,3206,5,181,0,0,3206,3207,5,7,0,0,3207,3211,5,181,0,0,3208,3211,5,34,
	0,0,3209,3211,5,181,0,0,3210,3191,1,0,0,0,3210,3193,1,0,0,0,3210,3194,1,
	0,0,0,3210,3195,1,0,0,0,3210,3196,1,0,0,0,3210,3197,1,0,0,0,3210,3198,1,
	0,0,0,3210,3199,1,0,0,0,3210,3200,1,0,0,0,3210,3201,1,0,0,0,3210,3202,1,
	0,0,0,3210,3203,1,0,0,0,3210,3204,1,0,0,0,3210,3205,1,0,0,0,3210,3208,1,
	0,0,0,3210,3209,1,0,0,0,3211,303,1,0,0,0,3212,3213,5,9,0,0,3213,3222,5,
	57,0,0,3214,3219,3,306,153,0,3215,3216,5,5,0,0,3216,3218,3,306,153,0,3217,
	3215,1,0,0,0,3218,3221,1,0,0,0,3219,3217,1,0,0,0,3219,3220,1,0,0,0,3220,
	3223,1,0,0,0,3221,3219,1,0,0,0,3222,3214,1,0,0,0,3222,3223,1,0,0,0,3223,
	3224,1,0,0,0,3224,3228,5,58,0,0,3225,3227,7,31,0,0,3226,3225,1,0,0,0,3227,
	3230,1,0,0,0,3228,3226,1,0,0,0,3228,3229,1,0,0,0,3229,3243,1,0,0,0,3230,
	3228,1,0,0,0,3231,3232,5,88,0,0,3232,3233,5,57,0,0,3233,3238,3,308,154,
	0,3234,3235,5,5,0,0,3235,3237,3,308,154,0,3236,3234,1,0,0,0,3237,3240,1,
	0,0,0,3238,3236,1,0,0,0,3238,3239,1,0,0,0,3239,3241,1,0,0,0,3240,3238,1,
	0,0,0,3241,3242,5,58,0,0,3242,3244,1,0,0,0,3243,3231,1,0,0,0,3243,3244,
	1,0,0,0,3244,305,1,0,0,0,3245,3249,3,302,151,0,3246,3249,3,92,46,0,3247,
	3249,3,90,45,0,3248,3245,1,0,0,0,3248,3246,1,0,0,0,3248,3247,1,0,0,0,3249,
	3251,1,0,0,0,3250,3252,3,294,147,0,3251,3250,1,0,0,0,3251,3252,1,0,0,0,
	3252,3254,1,0,0,0,3253,3255,3,16,8,0,3254,3253,1,0,0,0,3254,3255,1,0,0,
	0,3255,307,1,0,0,0,3256,3260,3,302,151,0,3257,3260,3,92,46,0,3258,3260,
	3,90,45,0,3259,3256,1,0,0,0,3259,3257,1,0,0,0,3259,3258,1,0,0,0,3260,3262,
	1,0,0,0,3261,3263,3,294,147,0,3262,3261,1,0,0,0,3262,3263,1,0,0,0,3263,
	309,1,0,0,0,3264,3280,5,147,0,0,3265,3266,4,155,28,0,3266,3280,5,181,0,
	0,3267,3280,5,148,0,0,3268,3280,5,149,0,0,3269,3280,5,150,0,0,3270,3280,
	5,156,0,0,3271,3280,5,157,0,0,3272,3280,5,158,0,0,3273,3280,5,89,0,0,3274,
	3280,5,90,0,0,3275,3280,5,159,0,0,3276,3280,5,160,0,0,3277,3280,5,91,0,
	0,3278,3280,5,67,0,0,3279,3264,1,0,0,0,3279,3265,1,0,0,0,3279,3267,1,0,
	0,0,3279,3268,1,0,0,0,3279,3269,1,0,0,0,3279,3270,1,0,0,0,3279,3271,1,0,
	0,0,3279,3272,1,0,0,0,3279,3273,1,0,0,0,3279,3274,1,0,0,0,3279,3275,1,0,
	0,0,3279,3276,1,0,0,0,3279,3277,1,0,0,0,3279,3278,1,0,0,0,3280,311,1,0,
	0,0,3281,3289,3,310,155,0,3282,3284,5,82,0,0,3283,3285,3,282,141,0,3284,
	3283,1,0,0,0,3284,3285,1,0,0,0,3285,3286,1,0,0,0,3286,3288,5,83,0,0,3287,
	3282,1,0,0,0,3288,3291,1,0,0,0,3289,3287,1,0,0,0,3289,3290,1,0,0,0,3290,
	313,1,0,0,0,3291,3289,1,0,0,0,385,317,322,324,339,341,361,365,372,377,405,
	411,415,424,431,433,437,443,455,458,468,472,480,483,487,492,496,520,525,
	537,541,550,554,563,565,568,582,585,598,600,615,630,634,643,650,654,671,
	673,679,684,692,695,712,714,721,728,730,734,741,749,753,755,759,765,768,
	771,781,785,787,794,798,800,808,815,828,832,839,859,865,871,877,884,894,
	901,907,911,917,925,933,940,947,954,959,967,974,981,988,993,995,999,1005,
	1010,1012,1020,1022,1029,1031,1037,1039,1047,1049,1054,1057,1063,1070,1076,
	1082,1086,1091,1099,1104,1112,1117,1125,1130,1134,1140,1147,1154,1158,1163,
	1168,1174,1178,1180,1187,1192,1196,1206,1208,1212,1218,1225,1229,1244,1253,
	1257,1263,1272,1276,1284,1288,1294,1298,1304,1308,1310,1318,1322,1324,1332,
	1336,1342,1346,1352,1356,1358,1366,1402,1407,1412,1421,1426,1431,1436,1441,
	1448,1453,1470,1472,1485,1493,1503,1526,1542,1544,1552,1574,1576,1581,1593,
	1600,1626,1638,1642,1647,1657,1663,1672,1676,1678,1687,1692,1698,1707,1709,
	1717,1726,1728,1736,1747,1749,1757,1763,1767,1772,1777,1787,1799,1809,1820,
	1832,1846,1855,1865,1869,1873,1882,1891,1906,1908,1912,1918,1927,1942,1944,
	1948,1960,1987,1999,2009,2014,2026,2036,2044,2054,2057,2066,2076,2088,2097,
	2160,2169,2175,2190,2200,2205,2210,2213,2230,2240,2245,2248,2266,2273,2281,
	2285,2293,2311,2319,2324,2331,2346,2349,2352,2375,2378,2387,2390,2397,2406,
	2409,2418,2426,2428,2438,2451,2455,2465,2473,2479,2485,2494,2498,2500,2506,
	2514,2518,2520,2523,2537,2543,2552,2556,2558,2568,2583,2593,2597,2605,2609,
	2611,2638,2642,2644,2670,2674,2676,2680,2692,2696,2698,2709,2711,2719,2723,
	2737,2741,2743,2754,2759,2762,2785,2798,2803,2810,2815,2833,2841,2849,2872,
	2913,2917,2919,2940,2945,2950,2988,2992,2996,3021,3032,3041,3045,3047,3056,
	3059,3065,3079,3092,3098,3100,3102,3117,3127,3149,3162,3169,3176,3181,3185,
	3189,3210,3219,3222,3228,3238,3243,3248,3251,3254,3259,3262,3279,3284,3289];

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
	public _eventSpecialName!: Token;
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
	public _sop!: Token;
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
	public assignChain(): AssignChainContext {
		return this.getTypedRuleContext(AssignChainContext, 0) as AssignChainContext;
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
	public functionType(): FunctionTypeContext {
		return this.getTypedRuleContext(FunctionTypeContext, 0) as FunctionTypeContext;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
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
	public statement(): StatementContext {
		return this.getTypedRuleContext(StatementContext, 0) as StatementContext;
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
	public Identifier_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.Identifier);
	}
	public Identifier(i: number): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, i);
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
	public _pushBase!: Token;
	public _rop!: Token;
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public DotPush(): TerminalNode {
		return this.getToken(SolidCashParser.DotPush, 0);
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
	public functionArrayType(): FunctionArrayTypeContext {
		return this.getTypedRuleContext(FunctionArrayTypeContext, 0) as FunctionArrayTypeContext;
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
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public assignChain(): AssignChainContext {
		return this.getTypedRuleContext(AssignChainContext, 0) as AssignChainContext;
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


export class FunctionArrayTypeContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public functionType(): FunctionTypeContext {
		return this.getTypedRuleContext(FunctionTypeContext, 0) as FunctionTypeContext;
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_functionArrayType;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitFunctionArrayType) {
			return visitor.visitFunctionArrayType(this);
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
	public DotPush_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.DotPush);
	}
	public DotPush(i: number): TerminalNode {
		return this.getToken(SolidCashParser.DotPush, i);
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
	public DotPush_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.DotPush);
	}
	public DotPush(i: number): TerminalNode {
		return this.getToken(SolidCashParser.DotPush, i);
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
export class DeletePushContext extends DeleteStatementContext {
	public _second!: Token;
	constructor(parser: SolidCashParser, ctx: DeleteStatementContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
	}
	public DotPush_list(): TerminalNode[] {
	    	return this.getTokens(SolidCashParser.DotPush);
	}
	public DotPush(i: number): TerminalNode {
		return this.getToken(SolidCashParser.DotPush, i);
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitDeletePush) {
			return visitor.visitDeletePush(this);
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
	public forWindowStatement(): ForWindowStatementContext {
		return this.getTypedRuleContext(ForWindowStatementContext, 0) as ForWindowStatementContext;
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


export class ForWindowStatementContext extends ParserRuleContext {
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
	public NumberLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.NumberLiteral, 0);
	}
	public block(): BlockContext {
		return this.getTypedRuleContext(BlockContext, 0) as BlockContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_forWindowStatement;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitForWindowStatement) {
			return visitor.visitForWindowStatement(this);
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
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
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
	public yulIdentifier_list(): YulIdentifierContext[] {
		return this.getTypedRuleContexts(YulIdentifierContext) as YulIdentifierContext[];
	}
	public yulIdentifier(i: number): YulIdentifierContext {
		return this.getTypedRuleContext(YulIdentifierContext, i) as YulIdentifierContext;
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
	public yulIdentifier_list(): YulIdentifierContext[] {
		return this.getTypedRuleContexts(YulIdentifierContext) as YulIdentifierContext[];
	}
	public yulIdentifier(i: number): YulIdentifierContext {
		return this.getTypedRuleContext(YulIdentifierContext, i) as YulIdentifierContext;
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


export class YulIdentifierContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_yulIdentifier;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitYulIdentifier) {
			return visitor.visitYulIdentifier(this);
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
	public yulIdentifier_list(): YulIdentifierContext[] {
		return this.getTypedRuleContexts(YulIdentifierContext) as YulIdentifierContext[];
	}
	public yulIdentifier(i: number): YulIdentifierContext {
		return this.getTypedRuleContext(YulIdentifierContext, i) as YulIdentifierContext;
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
	public _pushBase!: Token;
	public _aop!: Token;
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public DotPush(): TerminalNode {
		return this.getToken(SolidCashParser.DotPush, 0);
	}
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
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


export class ParenExpressionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_parenExpression;
	}
	public override copyFrom(ctx: ParenExpressionContext): void {
		super.copyFrom(ctx);
	}
}
export class AssignmentExpressionContext extends ParenExpressionContext {
	public _op!: Token;
	constructor(parser: SolidCashParser, ctx: ParenExpressionContext) {
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
export class InstantiationWithOptionsContext extends ParenExpressionContext {
	constructor(parser: SolidCashParser, ctx: ParenExpressionContext) {
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
export class TupleExpressionContext extends ParenExpressionContext {
	constructor(parser: SolidCashParser, ctx: ParenExpressionContext) {
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
export class ParenthesizedFunctionCallContext extends ParenExpressionContext {
	constructor(parser: SolidCashParser, ctx: ParenExpressionContext) {
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
export class ParenthesisedContext extends ParenExpressionContext {
	constructor(parser: SolidCashParser, ctx: ParenExpressionContext) {
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


export class NewExpressionContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_newExpression;
	}
	public override copyFrom(ctx: NewExpressionContext): void {
		super.copyFrom(ctx);
	}
}
export class NewArrayContext extends NewExpressionContext {
	constructor(parser: SolidCashParser, ctx: NewExpressionContext) {
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
export class NewDynamicStringContext extends NewExpressionContext {
	constructor(parser: SolidCashParser, ctx: NewExpressionContext) {
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
export class InstantiationContext extends NewExpressionContext {
	constructor(parser: SolidCashParser, ctx: NewExpressionContext) {
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
export class NewDynamicBytesContext extends NewExpressionContext {
	constructor(parser: SolidCashParser, ctx: NewExpressionContext) {
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
	public arrayCastType(): ArrayCastTypeContext {
		return this.getTypedRuleContext(ArrayCastTypeContext, 0) as ArrayCastTypeContext;
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
export class ConstructedExpressionContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public newExpression(): NewExpressionContext {
		return this.getTypedRuleContext(NewExpressionContext, 0) as NewExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitConstructedExpression) {
			return visitor.visitConstructedExpression(this);
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
	public expressionList_list(): ExpressionListContext[] {
		return this.getTypedRuleContexts(ExpressionListContext) as ExpressionListContext[];
	}
	public expressionList(i: number): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, i) as ExpressionListContext;
	}
	public DotLength(): TerminalNode {
		return this.getToken(SolidCashParser.DotLength, 0);
	}
	public DotValue(): TerminalNode {
		return this.getToken(SolidCashParser.DotValue, 0);
	}
	public anyIdentifier(): AnyIdentifierContext {
		return this.getTypedRuleContext(AnyIdentifierContext, 0) as AnyIdentifierContext;
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
	public expressionList_list(): ExpressionListContext[] {
		return this.getTypedRuleContexts(ExpressionListContext) as ExpressionListContext[];
	}
	public expressionList(i: number): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, i) as ExpressionListContext;
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
	public _element!: ExpressionContext;
	public _start!: ExpressionContext;
	public _end!: ExpressionContext;
	public _index!: Token;
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
	public NumberLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.NumberLiteral, 0);
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
export class ThisExprContext extends ExpressionContext {
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
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
	public memberName(): MemberNameContext {
		return this.getTypedRuleContext(MemberNameContext, 0) as MemberNameContext;
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
	public callOptions(): CallOptionsContext {
		return this.getTypedRuleContext(CallOptionsContext, 0) as CallOptionsContext;
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
export class GroupedExpressionContext extends ExpressionContext {
	constructor(parser: SolidCashParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public parenExpression(): ParenExpressionContext {
		return this.getTypedRuleContext(ParenExpressionContext, 0) as ParenExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitGroupedExpression) {
			return visitor.visitGroupedExpression(this);
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
	public NumberLiteral(): TerminalNode {
		return this.getToken(SolidCashParser.NumberLiteral, 0);
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
	public functionType(): FunctionTypeContext {
		return this.getTypedRuleContext(FunctionTypeContext, 0) as FunctionTypeContext;
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


export class FunctionTypeContext extends ParserRuleContext {
	constructor(parser?: SolidCashParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
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
    public get ruleIndex(): number {
    	return SolidCashParser.RULE_functionType;
	}
	// @Override
	public accept<Result>(visitor: SolidCashVisitor<Result>): Result {
		if (visitor.visitFunctionType) {
			return visitor.visitFunctionType(this);
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
	public Identifier(): TerminalNode {
		return this.getToken(SolidCashParser.Identifier, 0);
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
